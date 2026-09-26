import ts from 'typescript';
import path from 'node:path';
import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type {ReactHelperReference} from './react-helper-effects.js';
import type {ReactContextConsumerCall} from './react-context-calls.js';
import type {HelperSourcePoint} from './react-helper-model.mjs';
import {readReactRuntimeExport} from './react-runtime-export.js';
export type HookAtom={kind:'parameter';index:number}|{kind:'state';index:number;part:0|1}|{kind:'undefined'}|{kind:'null';value:null}|{kind:'boolean';value:boolean}|{kind:'number';value:number}|{kind:'string';value:string};
export interface ReactHelperHook {
 call:HelperSourcePoint;callee:HelperSourcePoint;owner:HelperSourcePoint;receiver:'bare'|'namespace'|'default';
 kind:'state'|'effect';hook:'useState'|'useEffect'|'useLayoutEffect'|'useInsertionEffect'|null;
 initial?:HookAtom;callback?:HelperSourcePoint;dependencies?:HelperSourcePoint;values?:HookAtom[];
}
export interface ReactHookHelpers {
 consumers:Array<{call:HelperSourcePoint;source:HelperSourcePoint}>;
 functions:Array<{source:HelperSourcePoint;name:string;parameters:Array<{source:HelperSourcePoint;name:string}>;hooks:ReactHelperHook[];returned:HelperSourcePoint;result:HookAtom}>;
}
/** Complete, straight-line helper bodies. Only parameter reads, original native
 * state tuples, effect registration with literal dependencies, and a return are
 * admitted. Deferred bodies, module initialization and state transitions remain
 * separate obligations. No component or package name selects a rule. */
export function planReactHookHelpers(reference:ReactHelperReference,consumers:readonly ReactContextConsumerCall[]):ReactHookHelpers {
 const result:ReactHookHelpers={consumers:[],functions:[]},cache=new Map<string,ReturnType<typeof parse>>();
 const unwrap=(n:ts.Expression):ts.Expression=>ts.isParenthesizedExpression(n)?unwrap(n.expression):n;
 function parse(name:string){
  const file=path.resolve(reference.sourceRoot,name),hash=reference.files[file];if(!hash||realpathSync(file)!==file)throw Error('hook-helper-source-unavailable');
  const text=readFileSync(file,'utf8');if(createHash('sha256').update(text).digest('hex')!==hash)throw Error('hook-helper-source-changed');
  const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,name.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.JS);
  const host:ts.CompilerHost={getSourceFile:f=>f===file?sf:undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=>reference.sourceRoot,getDirectories:()=>[],fileExists:f=>f===file,readFile:f=>f===file?text:undefined,getCanonicalFileName:f=>f,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n'};
  const checker=ts.createProgram([file],{allowJs:true,noLib:true,noResolve:true},host).getTypeChecker(),nodes=new Map<string,ts.Node>();
  const point=(n:ts.Node):HelperSourcePoint=>({file:name,sha256:hash,start:n.getStart(sf),end:n.end});
  const scan=(n:ts.Node)=>{nodes.set(JSON.stringify([n.getStart(sf),n.end]),n);ts.forEachChild(n,scan);};scan(sf);
  const declaration=(n:ts.Node)=>{const ds=checker.getSymbolAtLocation(n)?.declarations;return ds?.length===1?ds[0]:undefined;};
  return {sf,checker,nodes,point,declaration};
 }
 function module(name:string){let m=cache.get(name);if(!m){m=parse(name);cache.set(name,m);}return m;}
 for(const consumer of consumers){
  const m=module(consumer.call.file),callee=m.nodes.get(JSON.stringify([consumer.callee.start,consumer.callee.end]));if(!callee||!ts.isIdentifier(callee))continue;
  const d=m.declaration(callee);if(!d||!ts.isImportSpecifier(d)||d.isTypeOnly||d.parent.parent.isTypeOnly)continue;
  const imp=d.parent.parent.parent;if(!ts.isStringLiteral(imp.moduleSpecifier))continue;
  const edge=reference.runtimeImports?.find(r=>r.importer===path.resolve(reference.sourceRoot,consumer.call.file)&&r.specifier===(imp.moduleSpecifier as ts.StringLiteral).text);if(!edge)continue;
  const resolved=readReactRuntimeExport(reference,path.relative(reference.sourceRoot,edge.file),[(d.propertyName??d.name).text]);if(resolved.status!=='resolved')continue;
  const target=resolved.definition,tm=module(target.module),fn=tm.nodes.get(JSON.stringify([target.span.start,target.span.end]));
  if(!fn||!ts.isFunctionDeclaration(fn)||!fn.name||!fn.body||!ts.isSourceFile(fn.parent)||fn.asteriskToken||fn.modifiers?.some(p=>p.kind===ts.SyntaxKind.AsyncKeyword))continue;
  let unsafe=false;const scan=(n:ts.Node)=>{
   if(ts.isIdentifier(n)&&n.text==='__DSC_HOOK_HELPER_FRAME')unsafe=true;
   if(ts.isCallExpression(n)&&ts.isIdentifier(unwrap(n.expression))&&(unwrap(n.expression) as ts.Identifier).text==='eval')unsafe=true;
   if(tm.checker.getSymbolsInScope(n,ts.SymbolFlags.Value).find(s=>s.name==='globalThis')?.declarations?.some(d=>!(ts.isIdentifier(d)&&(ts.isPropertyAccessExpression(d.parent)||ts.isElementAccessExpression(d.parent))&&d.parent.expression===d)))unsafe=true;
   ts.forEachChild(n,scan);
  };scan(fn);if(unsafe)continue;
  const bindings=new Map<ts.Node,HookAtom>(),parameters:ReactHookHelpers['functions'][number]['parameters']=[];
  for(const [index,p] of fn.parameters.entries()){
   if(!ts.isIdentifier(p.name)||p.initializer||p.dotDotDotToken){unsafe=true;break;}
   bindings.set(p,{kind:'parameter',index});parameters.push({source:tm.point(p),name:p.name.text});
  }
  if(unsafe)continue;
  const atom=(value:ts.Expression):HookAtom|undefined=>{
   const n=unwrap(value);if(ts.isIdentifier(n)){const d=tm.declaration(n);return d&&bindings.get(d);}
   if(ts.isVoidExpression(n)&&ts.isNumericLiteral(n.expression)&&n.expression.text==='0')return {kind:'undefined'};
   if(ts.isStringLiteral(n))return {kind:'string',value:n.text};if(ts.isNumericLiteral(n)&&Number.isFinite(Number(n.text)))return {kind:'number',value:Number(n.text)};
   if(n.kind===ts.SyntaxKind.NullKeyword)return {kind:'null',value:null};if(n.kind===ts.SyntaxKind.TrueKeyword||n.kind===ts.SyntaxKind.FalseKeyword)return {kind:'boolean',value:n.kind===ts.SyntaxKind.TrueKeyword};
  };
  const hook=(n:ts.CallExpression,kind:'state'|'effect'):ReactHelperHook|undefined=>{
   if(n.questionDotToken||n.arguments.some(ts.isSpreadElement))return;
   const c=unwrap(n.expression);let receiver:ReactHelperHook['receiver']|undefined,hook:ReactHelperHook['hook']=null;
   const allowed=(s:string)=>kind==='state'?s==='useState':['useEffect','useLayoutEffect','useInsertionEffect'].includes(s);
   if(ts.isIdentifier(c)){
    const d=tm.declaration(c);if(d&&ts.isImportSpecifier(d)&&!d.isTypeOnly&&!d.parent.parent.isTypeOnly){
     const imp=d.parent.parent.parent;if(ts.isStringLiteral(imp.moduleSpecifier)){
      if(imp.moduleSpecifier.text==='react'&&allowed((d.propertyName??d.name).text)){receiver='bare';hook=(d.propertyName??d.name).text as ReactHelperHook['hook'];}
      else if(kind==='effect'&&imp.moduleSpecifier.text!=='react')receiver='bare';
     }
    }
   }else if(ts.isPropertyAccessExpression(c)&&!c.questionDotToken&&allowed(c.name.text)&&ts.isIdentifier(c.expression)){
    const d=tm.declaration(c.expression),imp=d&&ts.isNamespaceImport(d)&&!d.parent.isTypeOnly?d.parent.parent:d&&ts.isImportClause(d)&&!d.isTypeOnly?d.parent:undefined;
    if(imp&&ts.isImportDeclaration(imp)&&ts.isStringLiteral(imp.moduleSpecifier)&&imp.moduleSpecifier.text==='react'){receiver=d&&ts.isNamespaceImport(d)?'namespace':'default';hook=c.name.text as ReactHelperHook['hook'];}
   }
   if(!receiver)return;
   const base={call:tm.point(n),callee:tm.point(c),owner:tm.point(fn),receiver,kind,hook};
   if(kind==='state'){
    if(n.arguments.length>1)return;const initial=n.arguments.length?atom(n.arguments[0]):{kind:'undefined' as const};if(!initial)return;return {...base,initial};
   }
   if(n.arguments.length!==2)return;const callback=unwrap(n.arguments[0]),deps=unwrap(n.arguments[1]);
   if(!(ts.isArrowFunction(callback)||ts.isFunctionExpression(callback))||callback.modifiers?.length||ts.isFunctionExpression(callback)&&callback.asteriskToken||!ts.isArrayLiteralExpression(deps)||deps.elements.some(e=>ts.isSpreadElement(e)||ts.isOmittedExpression(e)))return;
   const values=deps.elements.map(atom);if(values.some(v=>!v))return;
   return {...base,callback:tm.point(callback),dependencies:tm.point(deps),values:values as HookAtom[]};
  };
  const hooks:ReactHelperHook[]=[],statements=fn.body.statements;let returned:HelperSourcePoint|undefined,value:HookAtom|undefined,stateIndex=0;
  for(const [index,s] of statements.entries()){
   if(index===statements.length-1&&ts.isReturnStatement(s)){
    returned=tm.point(s);value=s.expression?atom(s.expression):{kind:'undefined'};if(!value)unsafe=true;continue;
   }
   if(ts.isVariableStatement(s)&&s.declarationList.declarations.length===1&&(s.declarationList.flags&ts.NodeFlags.Const)!==0){
    const d=s.declarationList.declarations[0],n=d.initializer&&unwrap(d.initializer);
    if(!ts.isArrayBindingPattern(d.name)||d.name.elements.length!==2||d.name.elements.some(e=>!ts.isBindingElement(e)||!ts.isIdentifier(e.name)||e.initializer||e.dotDotDotToken||e.propertyName)||!n||!ts.isCallExpression(n)){unsafe=true;break;}
    const h=hook(n,'state');if(!h){unsafe=true;break;}hooks.push(h);
    for(const [part,b] of d.name.elements.entries())bindings.set(b,{kind:'state',index:stateIndex,part:part as 0|1});stateIndex++;continue;
   }
   if(ts.isExpressionStatement(s)&&ts.isCallExpression(unwrap(s.expression))){const h=hook(unwrap(s.expression) as ts.CallExpression,'effect');if(h){hooks.push(h);continue;}}
   unsafe=true;break;
  }
  if(unsafe||!returned||!value||!stateIndex)continue;
  const source=tm.point(fn);if(!result.functions.some(f=>JSON.stringify(f.source)===JSON.stringify(source)))result.functions.push({source,name:fn.name.text,parameters,hooks,returned,result:value});
  result.consumers.push({call:consumer.call,source});
 }
 return result;
}
