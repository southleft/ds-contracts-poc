import ts from 'typescript';
import {readReactElementInvocationPlans,type ReactElementInvocationPlan} from './react-element-invocation.js';
import type {ReactElementCreationSite} from './react-element-creation.js';

export interface ReactOriginalJsxSite {
  span:{start:number;end:number};
  tagSpan?:{start:number;end:number};
  kind:'element'|'fragment';
  qualification:'original-jsx-factory-only';
}
export interface ReactJsxMarker {
  index:number;
  span:{start:number;end:number};
  factorySpan:{start:number;end:number};
}

/** Original JSX expression identity, independent of its containing function.
 * It does not resolve component names or prove target lookup/helper effects. */
export function readReactOriginalJsxSites(sf:ts.SourceFile):ReactOriginalJsxSite[]{
  const sites:ReactOriginalJsxSite[]=[];
  const walk=(node:ts.Node)=>{
    if(ts.isJsxElement(node)||ts.isJsxSelfClosingElement(node)||ts.isJsxFragment(node)){
      const tag=ts.isJsxFragment(node)?undefined:ts.isJsxElement(node)?node.openingElement.tagName:node.tagName;
      sites.push({span:{start:node.getStart(sf),end:node.end},...(tag?{tagSpan:{start:tag.getStart(sf),end:tag.end}}:{}),kind:tag?'element':'fragment',qualification:'original-jsx-factory-only'});
      if(sites.length>10000)throw Error('jsx-original-site-limit');
    }
    ts.forEachChild(node,walk);
  };walk(sf);return sites;
}

/** Compile-time markers survive type erasure and JSX lowering. Each must wrap
 * exactly one generated call and occur exactly once. The caller separately
 * authenticates that call's JSX-runtime import before claiming a factory site.
 * Markers are erased before source execution; no runtime wrapper is installed. */
export function bindReactOriginalJsxSites(sf:ts.SourceFile,sites:readonly ReactOriginalJsxSite[]){
  const bindings=new Map<string,ReactOriginalJsxSite>(),markers:ReactJsxMarker[]=[],seen=new Set<number>();
  const walk=(node:ts.Node)=>{
    if(ts.isCallExpression(node)){
      const callee=node.expression;
      if(ts.isPropertyAccessExpression(callee)&&callee.name.text==='originalJsx'&&
        ts.isPropertyAccessExpression(callee.expression)&&callee.expression.name.text==='__DSC_ELEMENT_CREATION'&&
        ts.isIdentifier(callee.expression.expression)&&callee.expression.expression.text==='globalThis'){
        const argument=node.arguments[0];let factory=node.arguments[1];
        if(node.questionDotToken||callee.questionDotToken||node.arguments.length!==2||!argument||!ts.isNumericLiteral(argument))throw Error('jsx-original-marker-unmodeled');
        const index=Number(argument.text),site=sites[index];
        if(!Number.isSafeInteger(index)||!site||seen.has(index))throw Error('jsx-original-marker-unmatched');
        while(factory&&ts.isParenthesizedExpression(factory))factory=factory.expression;
        if(!factory||!ts.isCallExpression(factory)||factory.questionDotToken)throw Error('jsx-original-factory-unmodeled');
        const factorySpan={start:factory.getStart(sf),end:factory.end},key=JSON.stringify(factorySpan);
        if(bindings.has(key))throw Error('jsx-original-factory-duplicate');
        seen.add(index);bindings.set(key,site);markers.push({index,span:{start:node.getStart(sf),end:node.end},factorySpan});
      }
    }
    ts.forEachChild(node,walk);
  };walk(sf);
  if(seen.size!==sites.length)throw Error('jsx-original-marker-missing');
  return {bindings,markers};
}

/** Select original functions containing JSX. Record actual ordinary expression
 * reads, preserving JSX name slots and erased types. Target bindings and full
 * effects remain unqualified by this invocation-only observation. */
export function readReactJsxInvocationPlans(sf:ts.SourceFile,module:string,sourceSha256:string):ReactElementInvocationPlan[]{
  const points:ReactElementCreationSite[]=[];
  const walk=(node:ts.Node,fn?:ts.Node)=>{
    const inside=ts.isFunctionLike(node)?node:ts.isClassLike(node)?undefined:fn;
    if(inside&&(ts.isJsxElement(node)||ts.isJsxSelfClosingElement(node)||ts.isJsxFragment(node))){
      points.push({module,sourceSha256,span:{start:node.getStart(sf),end:node.end},functionSpan:{start:inside.getStart(sf),end:inside.end},factory:'jsx'});
      if(points.length>10000)throw Error('jsx-invocation-site-limit');
    }
    ts.forEachChild(node,child=>walk(child,inside));
  };walk(sf);
  return readReactElementInvocationPlans(sf,points).filter(plan=>!plan.parameters.some(p=>p.name==='this'))
    .map(plan=>({...plan,observation:'original-function-invocation-only',operations:[]}));
}

/** The reserved entry was inserted into a known original AST function before
 * esbuild ran. Match that exact entry in its generated function, not text names
 * or approximate source-map positions. Every planned entry must appear once. */
export function bindReactJsxInvocations(sf:ts.SourceFile,plans:readonly (ReactElementInvocationPlan&{index:number})[]){
  const bindings=new Map<string,{span:{start:number;end:number};plan:number;qualification:'original-function-invocation-only'}>(),seen=new Set<number>();
  const walk=(node:ts.Node)=>{
    if((ts.isFunctionDeclaration(node)||ts.isFunctionExpression(node)||ts.isArrowFunction(node))&&node.body&&ts.isBlock(node.body)){
      const first=node.body.statements.find(statement=>!(ts.isExpressionStatement(statement)&&ts.isStringLiteral(statement.expression)));
      const declaration=first&&ts.isVariableStatement(first)&&first.declarationList.declarations.length===1?first.declarationList.declarations[0]:undefined;
      const call=declaration?.initializer,callee=call&&ts.isCallExpression(call)?call.expression:undefined;
      if(callee&&ts.isPropertyAccessExpression(callee)&&['enter','enterReact','enterSource'].includes(callee.name.text)&&
        ts.isPropertyAccessExpression(callee.expression)&&callee.expression.name.text==='__DSC_ELEMENT_CREATION'&&
        ts.isIdentifier(callee.expression.expression)&&callee.expression.expression.text==='globalThis'){
        const argument=(call as ts.CallExpression).arguments[0];
        if(!argument||!ts.isNumericLiteral(argument))throw Error('jsx-invocation-entry-index-unmodeled');
        const index=Number(argument.text),plan=plans.find(p=>p.index===index);
        if(!plan||seen.has(index))throw Error('jsx-invocation-entry-unmatched');
        const expected=plan.argumentSource==='react-call'?'enterReact':plan.argumentSource==='source-call'?'enterSource':'enter';
        if(callee.name.text!==expected)throw Error('jsx-invocation-entry-kind-changed');
        seen.add(index);bindings.set(JSON.stringify({start:node.getStart(sf),end:node.end}),{span:plan.span,plan:index,qualification:'original-function-invocation-only'});
      }
    }
    ts.forEachChild(node,walk);
  };walk(sf);
  if(seen.size!==plans.length)throw Error('jsx-invocation-entry-missing');
  return bindings;
}
