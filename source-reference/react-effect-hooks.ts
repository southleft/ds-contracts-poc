import ts from 'typescript';
import path from 'node:path';
import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type {ReactHelperReference} from './react-helper-effects.js';
import type {ReactTargetInitializer} from './react-target-initializer.js';
import type {HelperSourcePoint} from './react-helper-model.mjs';
export interface ReactEffectHook {call:HelperSourcePoint;callee:HelperSourcePoint;consumer:HelperSourcePoint;callback:HelperSourcePoint;dependencies:HelperSourcePoint;hook:'useEffect'|'useLayoutEffect'|'useInsertionEffect';receiver:'bare'|'namespace'|'default'}
/** Original lexical React imports in a registered render body. Nested callbacks,
 * computed imports and shadowed bindings receive no native-hook assumption. */
export function planReactEffectHooks(reference:ReactHelperReference,initializers:readonly ReactTargetInitializer[]):ReactEffectHook[]{
 const result:ReactEffectHook[]=[];
 for(const name of new Set(initializers.map(i=>i.render.file))){
  const file=path.resolve(reference.sourceRoot,name),hash=reference.files[file];if(!hash||realpathSync(file)!==file)throw Error('effect-hook-source-unavailable');
  const text=readFileSync(file,'utf8');if(createHash('sha256').update(text).digest('hex')!==hash)throw Error('effect-hook-source-changed');
  const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,name.endsWith('.tsx')?ts.ScriptKind.TSX:/\.[cm]?js$/.test(name)?ts.ScriptKind.JS:ts.ScriptKind.TS);
  const host:ts.CompilerHost={getSourceFile:f=>f===file?sf:undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=>reference.sourceRoot,getDirectories:()=>[],fileExists:f=>f===file,readFile:f=>f===file?text:undefined,getCanonicalFileName:f=>f,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n'};
  const checker=ts.createProgram([file],{allowJs:true,noLib:true,noResolve:true},host).getTypeChecker(),nodes=new Map<string,ts.Node>();
  const key=(n:ts.Node)=>JSON.stringify([n.getStart(sf),n.end]),point=(n:ts.Node):HelperSourcePoint=>({file:name,sha256:hash,start:n.getStart(sf),end:n.end});
  const scan=(n:ts.Node)=>{nodes.set(key(n),n);ts.forEachChild(n,scan);};scan(sf);
  const declaration=(n:ts.Identifier)=>{const ds=checker.getSymbolAtLocation(n)?.declarations;return ds?.length===1?ds[0]:undefined;};
  for(const initializer of initializers.filter(i=>i.render.file===name)){
   const fn=nodes.get(JSON.stringify([initializer.render.start,initializer.render.end]));
   if(initializer.render.sha256!==hash||!fn||!(ts.isFunctionExpression(fn)||ts.isArrowFunction(fn)))throw Error('effect-hook-render-changed');
   const walk=(n:ts.Node)=>{
    if(ts.isFunctionLike(n)&&n!==fn)return;
    if(ts.isCallExpression(n)&&!n.questionDotToken&&n.arguments.length===2&&!n.arguments.some(ts.isSpreadElement)){
     let callee:ts.Expression=n.expression;while(ts.isParenthesizedExpression(callee))callee=callee.expression;
     let receiver:ReactEffectHook['receiver']|undefined,hook:ReactEffectHook['hook']|undefined;
     const effectName=(name:string):name is ReactEffectHook['hook']=>['useEffect','useLayoutEffect','useInsertionEffect'].includes(name);
     if(ts.isIdentifier(callee)){
      const d=declaration(callee);
      if(d&&ts.isImportSpecifier(d)&&!d.isTypeOnly&&!d.parent.parent.isTypeOnly&&effectName((d.propertyName??d.name).text)){
       const imp=d.parent.parent.parent;if(ts.isStringLiteral(imp.moduleSpecifier)&&imp.moduleSpecifier.text==='react'){receiver='bare';hook=(d.propertyName??d.name).text as ReactEffectHook['hook'];}
      }
     }else if(ts.isPropertyAccessExpression(callee)&&!callee.questionDotToken&&effectName(callee.name.text)&&ts.isIdentifier(callee.expression)){
      const d=declaration(callee.expression),imp=d&&ts.isNamespaceImport(d)&&!d.parent.isTypeOnly?d.parent.parent:d&&ts.isImportClause(d)&&!d.isTypeOnly?d.parent:undefined;
      if(imp&&ts.isImportDeclaration(imp)&&ts.isStringLiteral(imp.moduleSpecifier)&&imp.moduleSpecifier.text==='react'){receiver=d&&ts.isNamespaceImport(d)?'namespace':'default';hook=callee.name.text;}
     }
     let movesScope=false;const inspectArgument=(a:ts.Node)=>{
      if(ts.isAwaitExpression(a)||ts.isYieldExpression(a))movesScope=true;
      if(ts.isCallExpression(a)){let e:ts.Expression=a.expression;while(ts.isParenthesizedExpression(e))e=e.expression;if(ts.isIdentifier(e)&&e.text==='eval')movesScope=true;}
      ts.forEachChild(a,inspectArgument);
     };n.arguments.forEach(inspectArgument);
     let callback=n.arguments[0],deps=n.arguments[1];while(ts.isParenthesizedExpression(callback))callback=callback.expression;while(ts.isParenthesizedExpression(deps))deps=deps.expression;
     if(receiver&&hook&&!movesScope&&(ts.isArrowFunction(callback)||ts.isFunctionExpression(callback))&&ts.isArrayLiteralExpression(deps)&&!deps.elements.some(e=>ts.isSpreadElement(e)||ts.isOmittedExpression(e))){
      const shadow=checker.getSymbolsInScope(n,ts.SymbolFlags.Value).find(s=>s.name==='globalThis');
      if(shadow?.declarations?.some(d=>!(ts.isIdentifier(d)&&(ts.isPropertyAccessExpression(d.parent)||ts.isElementAccessExpression(d.parent))&&d.parent.expression===d)))throw Error('effect-hook-global-shadowed');
      result.push({call:point(n),callee:point(callee),consumer:initializer.render,callback:point(callback),dependencies:point(deps),hook,receiver});
     }
    }
    ts.forEachChild(n,walk);
   };walk(fn);
  }
 }
 return result;
}
