import ts from 'typescript';
import { readLitTemplateBindings, type LitTemplateInput } from '../extract/adapters/lit-template.js';
import type { LitObservedValue, LitRenderObservation } from './lit-render-observation.js';

/** Corroborate the parser input returned by real Lit, never infer a registered
 * tag from a similar DOM or execute the source's registry/helper functions.
 * Hashes bind this to source bytes; the caller authenticates the observation,
 * package/runtime provenance, and source image/tree separately. */
export function proveLitStaticTemplates(source: LitTemplateInput, observation: LitRenderObservation) {
  const refuse = (code: string): never => { throw Error(`static-template-${code}`); };
  const read = readLitTemplateBindings(source);
  if (read.status === 'refused' || observation?.version !== 1 || observation.status !== 'captured' ||
      !Array.isArray(observation.problems) || observation.problems.length ||
      observation.policy?.version !== 1 || observation.policy.sourceSha256 !== source.sourceSha256 ||
      observation.policy.className !== source.className || !Number.isInteger(observation.renders) ||
      observation.renders < 1 || observation.renders > 32 || !observation.last ||
      !Array.isArray(observation.last.staticFields) || observation.last.staticFields.length > 2048) refuse('observation-invalid');
  const fields = new Map<string,string>();
  for(const field of observation.last!.staticFields) {
    if (!field || typeof field.property !== 'string' || typeof field.value !== 'string' || fields.has(field.property) ||
        !/^[A-Za-z_$][\w$]*$/.test(field.property)) refuse('field-invalid');
    fields.set(field.property,field.value);
  }
  const sourceFile = ts.createSourceFile('source.ts',source.source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  const ids = new Map(read.templates.map(t=>[t.id,t]));
  const expected = new Map<string,string[]>();
  const substitutions = new Map<number,string>();
  const unwrap = (node:ts.Expression):ts.Expression => {
    while(ts.isParenthesizedExpression(node)||ts.isAsExpression(node)||ts.isNonNullExpression(node)||ts.isTypeAssertionExpression(node)||ts.isSatisfiesExpression(node)) node=node.expression;
    return node;
  };
  const visit = (node:ts.Node) => {
    if(ts.isTaggedTemplateExpression(node)) {
      const id=`template:${node.getStart(sourceFile)}:${node.end}`, template=ids.get(id);
      if(template) {
        const isStatic=['lit/static-html.js','lit-html/static.js'].includes(template.import.module);
        const strings:string[]=[];
        if(ts.isNoSubstitutionTemplateLiteral(node.template)) strings.push(node.template.text);
        else {
          let current=node.template.head.text;
          for(const part of node.template.templateSpans) {
            const expression=unwrap(part.expression);
            const property=ts.isPropertyAccessExpression(expression)&&!expression.questionDotToken&&expression.expression.kind===ts.SyntaxKind.ThisKeyword ? expression.name.text : undefined;
            const value=isStatic&&property!==undefined ? fields.get(property) : undefined;
            if(value!==undefined) {
              // Only a whole custom-element tag, never arbitrary static markup,
              // attributes, partial names, raw-text elements, or slot names.
              if(!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(value)||!/<\/?$/.test(current)||! /^(?:\s|>)/.test(part.literal.text)) refuse('static-position-unsupported');
              substitutions.set(part.expression.getStart(sourceFile),value);
              current+=value+part.literal.text;
            } else { strings.push(current);current=part.literal.text; }
          }
          strings.push(current);
        }
        expected.set(id,strings);
      }
    }
    ts.forEachChild(node,visit);
  };
  visit(sourceFile);
  const templateGroups:string[][]=[];
  let budget=2048, bytes=0;
  const seen=new Set<object>();
  const walk=(value:LitObservedValue,depth=0,root=false):void=>{
    if(!value || typeof value!=='object'||--budget<0||depth>32||seen.has(value))refuse('value-invalid');
    seen.add(value);
    try {
      if(root&&value.kind!=='template')refuse('root-invalid');
      if(value.kind==='template'){
        if(!Array.isArray(value.strings)||!Array.isArray(value.values)||value.strings.length!==value.values.length+1||value.values.length>2048||!value.strings.every(s=>typeof s==='string'))refuse('template-invalid');
        bytes+=value.strings.reduce((n,s)=>n+s.length,0);if(bytes>262144)refuse('byte-limit');
        const matches=[...expected].filter(([id,strings])=>JSON.stringify(strings)===JSON.stringify(value.strings)&&(!root||ids.get(id)!.role==='returned')).map(([id])=>id);
        if(!matches.length)refuse('parser-input-unexplained');
        templateGroups.push(matches);
        value.values.forEach(child=>walk(child,depth+1));
      } else if(value.kind==='array'){
        if(!Array.isArray(value.values)||value.values.length>2048)refuse('array-invalid');
        value.values.forEach(child=>walk(child,depth+1));
      } else if(value.kind==='scalar'){
        if(value.value!==null && !['string','boolean','number'].includes(typeof value.value))refuse('scalar-invalid');
        if(typeof value.value==='number'&&!Number.isFinite(value.value))refuse('scalar-invalid');
        if(typeof value.value==='string'){bytes+=value.value.length;if(bytes>262144)refuse('byte-limit');}
      } else if(!['undefined','function','symbol','opaque'].includes(value.kind))refuse('value-kind-invalid');
    }finally{seen.delete(value);}
  };
  walk(observation.last!.value,0,true);
  return {substitutions,templateGroups};
}
