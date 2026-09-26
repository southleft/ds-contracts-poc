import ts from 'typescript';
import path from 'node:path';
import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type {ReactHelperReference} from './react-helper-effects.js';
import type {ReactContextConsumerCall} from './react-context-calls.js';
import type {HelperSourcePoint} from './react-helper-model.mjs';
import {readReactRuntimeExport} from './react-runtime-export.js';
import {readReactFunctionNaming,type ReactTargetInitializer} from './react-target-initializer.js';
export type FactoryLiteral={kind:'undefined'}|{kind:'null';value:null}|{kind:'string';value:string}|{kind:'boolean';value:boolean}|{kind:'number';value:number};
export interface ReactCallbackFactories {
 consumers:Array<{call:HelperSourcePoint;source:HelperSourcePoint;arguments:HelperSourcePoint[]}>;
 functions:Array<{source:HelperSourcePoint;name:string;returned:HelperSourcePoint;callback:HelperSourcePoint;naming?:NonNullable<ReactTargetInitializer['naming']>;
 parameters:Array<{index:number;object:boolean;defaultObject:boolean;default?:FactoryLiteral;bindings:Array<{source:HelperSourcePoint;name:string;key?:string;default?:FactoryLiteral}>}>}>;
 literals:Array<{source:HelperSourcePoint;call:HelperSourcePoint;kind:'function'|'object'}>;
}
/** A bounded original function factory: parameter initialization followed by one
 * returned literal, optionally passed through the checked native name helper.
 * This proves a creation shape, never the deferred callback's effects/captures. */
export function planReactCallbackFactories(reference:ReactHelperReference,consumers:readonly ReactContextConsumerCall[]):ReactCallbackFactories{
 const result:ReactCallbackFactories={consumers:[],functions:[],literals:[]},cache=new Map<string,ReturnType<typeof parse>>();
 function parse(name:string){
  const file=path.resolve(reference.sourceRoot,name),hash=reference.files[file];if(!hash||realpathSync(file)!==file)throw Error('callback-factory-source-unavailable');
  const text=readFileSync(file,'utf8');if(createHash('sha256').update(text).digest('hex')!==hash)throw Error('callback-factory-source-changed');
  const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,name.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.JS);
  const host:ts.CompilerHost={getSourceFile:f=>f===file?sf:undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=>reference.sourceRoot,getDirectories:()=>[],fileExists:f=>f===file,readFile:f=>f===file?text:undefined,getCanonicalFileName:f=>f,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n'};
  const checker=ts.createProgram([file],{allowJs:true,noLib:true,noResolve:true},host).getTypeChecker(),nodes=new Map<string,ts.Node>();
  const point=(n:ts.Node):HelperSourcePoint=>({file:name,sha256:hash,start:n.getStart(sf),end:n.end}),key=(n:ts.Node)=>JSON.stringify([n.getStart(sf),n.end]);
  const scan=(n:ts.Node)=>{nodes.set(key(n),n);ts.forEachChild(n,scan);};scan(sf);
  const declaration=(n:ts.Node)=>{const ds=checker.getSymbolAtLocation(n)?.declarations;return ds?.length===1?ds[0]:undefined;};
  const globalAvailable=(n:ts.Node)=>!checker.getSymbolsInScope(n,ts.SymbolFlags.Value).find(s=>s.name==='globalThis')?.declarations?.some(d=>!(ts.isIdentifier(d)&&(ts.isPropertyAccessExpression(d.parent)||ts.isElementAccessExpression(d.parent))&&d.parent.expression===d));
  return {sf,checker,nodes,point,declaration,globalAvailable};
 }
 function module(name:string){let m=cache.get(name);if(!m){m=parse(name);cache.set(name,m);}return m;}
 const unwrap=(n:ts.Expression):ts.Expression=>ts.isParenthesizedExpression(n)?unwrap(n.expression):n;
 const literal=(n:ts.Expression):FactoryLiteral|undefined=>{n=unwrap(n);if(ts.isStringLiteral(n))return {kind:'string',value:n.text};if(ts.isNumericLiteral(n)&&Number.isFinite(Number(n.text)))return {kind:'number',value:Number(n.text)};if(n.kind===ts.SyntaxKind.TrueKeyword||n.kind===ts.SyntaxKind.FalseKeyword)return {kind:'boolean',value:n.kind===ts.SyntaxKind.TrueKeyword};if(n.kind===ts.SyntaxKind.NullKeyword)return {kind:'null',value:null};};
 const same=(a:HelperSourcePoint,b:HelperSourcePoint)=>JSON.stringify(a)===JSON.stringify(b);
 for(const consumer of consumers){
  const m=module(consumer.call.file),callee=m.nodes.get(JSON.stringify([consumer.callee.start,consumer.callee.end]));if(!callee||!ts.isIdentifier(callee))continue;
  const d=m.declaration(callee);if(!d||!ts.isImportSpecifier(d)||d.isTypeOnly||d.parent.parent.isTypeOnly)continue;
  const imp=d.parent.parent.parent;if(!ts.isStringLiteral(imp.moduleSpecifier))continue;
  const edge=reference.runtimeImports?.find(r=>r.importer===path.resolve(reference.sourceRoot,consumer.call.file)&&r.specifier===(imp.moduleSpecifier as ts.StringLiteral).text);if(!edge)continue;
  const resolved=readReactRuntimeExport(reference,path.relative(reference.sourceRoot,edge.file),[(d.propertyName??d.name).text]);if(resolved.status!=='resolved')continue;
  const target=resolved.definition,tm=module(target.module),node=tm.nodes.get(JSON.stringify([target.span.start,target.span.end]));
  if(!node||!ts.isFunctionDeclaration(node)||!node.name||!node.body||!ts.isSourceFile(node.parent)||node.asteriskToken||node.modifiers?.some(p=>p.kind===ts.SyntaxKind.AsyncKeyword)||!tm.globalAvailable(node)||!tm.globalAvailable(node.body)||node.body.statements.length!==1)continue;
  const returned=node.body.statements[0];if(!ts.isReturnStatement(returned)||!returned.expression)continue;
  let value=unwrap(returned.expression),naming:ReactTargetInitializer['naming'];
  if(ts.isCallExpression(value)){try{const named=readReactFunctionNaming(tm.sf,tm.checker,value,tm.point);naming=named.naming;value=named.value;}catch{continue;}}
  if(!(ts.isFunctionExpression(value)||ts.isArrowFunction(value))||value.modifiers?.length||ts.isFunctionExpression(value)&&value.asteriskToken)continue;
  let unsafe=false;const scan=(n:ts.Node)=>{if(ts.isCallExpression(n)&&ts.isIdentifier(unwrap(n.expression))&&(unwrap(n.expression) as ts.Identifier).text==='eval')unsafe=true;ts.forEachChild(n,scan);};scan(node);
  const parameters:ReactCallbackFactories['functions'][number]['parameters']=[];
  for(let index=0;index<node.parameters.length;index++){
   const p=node.parameters[index];if(p.dotDotDotToken){unsafe=true;break;}
   if(ts.isIdentifier(p.name)){const fallback=p.initializer?literal(p.initializer):undefined;if(p.initializer&&!fallback){unsafe=true;break;}parameters.push({index,object:false,defaultObject:false,...(fallback?{default:fallback}:{}),bindings:[{source:tm.point(p),name:p.name.text}]});}
   else if(ts.isObjectBindingPattern(p.name)){
    const init=p.initializer&&unwrap(p.initializer);if(init&&(!ts.isObjectLiteralExpression(init)||init.properties.length)){unsafe=true;break;}
    const bindings:ReactCallbackFactories['functions'][number]['parameters'][number]['bindings']=[];
    for(const b of p.name.elements){const k=b.propertyName??b.name,fallback=b.initializer?literal(b.initializer):undefined;if(b.dotDotDotToken||!ts.isIdentifier(b.name)||!(ts.isIdentifier(k)||ts.isStringLiteral(k))||k.text==='__proto__'||b.initializer&&!fallback){unsafe=true;break;}bindings.push({source:tm.point(b),name:b.name.text,key:k.text,...(fallback?{default:fallback}:{})});}
    parameters.push({index,object:true,defaultObject:!!init,bindings});
   }else unsafe=true;
  }
  if(unsafe)continue;
  const fn={source:tm.point(node),name:node.name.text,returned:tm.point(returned),callback:tm.point(value),...(naming?{naming}:{}),parameters};
  if(!result.functions.some(f=>same(f.source,fn.source)))result.functions.push(fn);
  result.consumers.push({call:consumer.call,source:fn.source,arguments:consumer.arguments});
  for(const argument of consumer.arguments){const n=m.nodes.get(JSON.stringify([argument.start,argument.end]));if(!n||!ts.isExpression(n))continue;const a=unwrap(n);
   const function_=ts.isFunctionExpression(a)||ts.isArrowFunction(a),object=ts.isObjectLiteralExpression(a)&&a.properties.every(p=>ts.isShorthandPropertyAssignment(p)&&!p.objectAssignmentInitializer||ts.isPropertyAssignment(p)&&(ts.isIdentifier(p.name)||ts.isStringLiteral(p.name)||ts.isNumericLiteral(p.name))&&p.name.text!=='__proto__');
   if(function_||object)result.literals.push({source:m.point(a),call:consumer.call,kind:function_?'function':'object'});
  }
 }
 return result;
}
