/** A source edit candidate, not a write permit. The host must supply an
 * authenticated original component identity, rebuild CSS in isolation and
 * observe every affected case before choosing a unique candidate. No source
 * code, class helper or project build script is executed by this module. */
import ts from 'typescript';
import { createHash } from 'node:crypto';
import type { ReactOwnership } from './react-ownership.js';

type SourceIdentity = ReactOwnership['components'][number]['source'];
const sha=(text:string)=>createHash('sha256').update(text).digest('hex');
const equal=(a:number,b:number)=>a===b||Math.fround(a)===Math.fround(b);
const fail=(reason:string):never=>{throw Error('react-utility-source-'+reason);};
const unwrap=(expression:ts.Expression):ts.Expression=>
  ts.isParenthesizedExpression(expression)||ts.isAsExpression(expression)||ts.isSatisfiesExpression(expression)
    ?unwrap(expression.expression):expression;

export function proposeReactOpacityUtilityEdits(text:string,source:SourceIdentity,change:{before:number;after:number}) {
  if(sha(text)!==source.sourceSha256)fail('changed');
  if(![change.before,change.after].every(n=>Number.isFinite(n)&&n>=0&&n<=1)||equal(change.before,change.after))
    fail('opacity-change-invalid');
  const file=ts.createSourceFile(source.module,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  if((file as ts.SourceFile & {parseDiagnostics:readonly ts.Diagnostic[]}).parseDiagnostics.length)fail('syntax-invalid');
  let declaration:ts.Node|undefined;
  const find=(node:ts.Node)=>{
    if(node.getStart(file)===source.span.start&&node.end===source.span.end&&
        (ts.isFunctionDeclaration(node)||ts.isVariableDeclaration(node)))declaration=node;
    ts.forEachChild(node,find);
  };
  find(file);
  if(!declaration)fail('declaration-unavailable');
  let fn:ts.FunctionDeclaration|ts.ArrowFunction|ts.FunctionExpression;
  if(ts.isFunctionDeclaration(declaration!))fn=declaration!;
  else {
    const initial=(declaration! as ts.VariableDeclaration).initializer;
    if(!initial)fail('function-unavailable');
    let value=unwrap(initial!);
    // Recognize only the same one-function wrapper shape as the source reader.
    // Its identity and actual output remain the host's observation obligation.
    if(ts.isCallExpression(value)&&value.arguments.length===1)value=unwrap(value.arguments[0]);
    if(!ts.isArrowFunction(value)&&!ts.isFunctionExpression(value))fail('function-unavailable');
    fn=value as ts.ArrowFunction|ts.FunctionExpression;
  }
  if(!fn.body)fail('function-unavailable');
  const returns:ts.Expression[]=[];
  if(ts.isBlock(fn.body!)) {
    for(const statement of (fn.body! as ts.Block).statements) {
      if(ts.isReturnStatement(statement)&&statement.expression)returns.push(statement.expression);
      if(ts.isIfStatement(statement)||ts.isSwitchStatement(statement)||ts.isTryStatement(statement)||
          ts.isIterationStatement(statement,false))fail('conditional-root-unsupported');
    }
  } else returns.push(fn.body! as ts.Expression);
  if(returns.length!==1)fail('root-unavailable');
  const root=unwrap(returns[0]);
  const element=ts.isJsxElement(root)?root.openingElement:ts.isJsxSelfClosingElement(root)?root:undefined;
  if(!element)fail('root-unavailable');
  const attributes=element!.attributes.properties.filter((p):p is ts.JsxAttribute=>ts.isJsxAttribute(p)&&p.name.getText(file)==='className');
  if(attributes.length!==1||!attributes[0].initializer)fail('class-unavailable');
  const literals:ts.StringLiteralLike[]=[];
  const visit=(node:ts.Node)=>{
    if(ts.isStringLiteralLike(node)){literals.push(node);return;}
    // Do not propose a replacement in an unevaluated nested callback or in
    // template substitutions whose runtime class boundaries are unknown.
    if(ts.isArrowFunction(node)||ts.isFunctionExpression(node)||ts.isTemplateExpression(node))return;
    ts.forEachChild(node,visit);
  };
  visit(attributes[0].initializer!);
  const percent=Math.round(change.after*100);
  const suffix=equal(percent/100,change.after)?String(percent):`[${change.after}]`;
  const candidates=[];
  for(const literal of literals) {
    const start=literal.getStart(file)+1,raw=text.slice(start,literal.end-1);
    // An escape or JSX entity needs its own source mapping. Never estimate an
    // offset from the cooked string and accidentally replace different bytes.
    if(raw!==literal.text||raw.includes('\\')||raw.includes('&'))continue;
    for(const token of raw.matchAll(/\S+/g)) {
      const match=/^(.*:)?opacity-(\d+(?:\.\d+)?|\[(?:\d*\.)?\d+\])$/.exec(token[0]);
      if(!match)continue;
      const before=match[2].startsWith('[')?Number(match[2].slice(1,-1)):Number(match[2])/100;
      if(!equal(before,change.before))continue;
      const after=(match[1]??'')+'opacity-'+suffix,offset=start+token.index!;
      const result=text.slice(0,offset)+after+text.slice(offset+token[0].length);
      candidates.push({qualification:'unverified-source-candidate' as const,source:structuredClone(source),
        beforeSha256:source.sourceSha256,afterSha256:sha(result),
        edit:{start:offset,end:offset+token[0].length,before:token[0],after},result,
        limitations:['isolated-css-build-required','all-case-observation-required','unique-effect-required','source-write-not-authorized']});
    }
  }
  if(!candidates.length)fail('opacity-utility-unavailable');
  return candidates;
}
