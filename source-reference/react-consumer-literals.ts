import ts from 'typescript';
import path from 'node:path';
import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type {ReactHelperReference} from './react-helper-effects.js';
import type {ReactTargetInitializer} from './react-target-initializer.js';
import type {HelperSourcePoint} from './react-helper-model.mjs';
export interface ReactConsumerLiteral {source:HelperSourcePoint;consumer:HelperSourcePoint;kind:'record'|'array'}
/** Only original literal allocations in the synchronous render body. This plan
 * never authorizes getters, spread operands, deferred bodies or caller objects. */
export function planReactConsumerLiterals(reference:ReactHelperReference,initializers:readonly ReactTargetInitializer[]):ReactConsumerLiteral[]{
 const result:ReactConsumerLiteral[]=[];
 for(const name of [...new Set(initializers.map(i=>i.render.file))].sort()){
  const file=path.resolve(reference.sourceRoot,name),hash=reference.files[file];if(!hash||realpathSync(file)!==file)throw Error('consumer-literal-source-unavailable');
  const text=readFileSync(file,'utf8');if(createHash('sha256').update(text).digest('hex')!==hash)throw Error('consumer-literal-source-changed');
  const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,name.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.JS);
  const host:ts.CompilerHost={getSourceFile:f=>f===file?sf:undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=>reference.sourceRoot,getDirectories:()=>[],fileExists:f=>f===file,readFile:f=>f===file?text:undefined,getCanonicalFileName:f=>f,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n'};
  const checker=ts.createProgram([file],{allowJs:true,noLib:true,noResolve:true},host).getTypeChecker(),nodes=new Map<string,ts.Node>();
  const point=(n:ts.Node):HelperSourcePoint=>({file:name,sha256:hash,start:n.getStart(sf),end:n.end}),key=(n:ts.Node)=>JSON.stringify([n.getStart(sf),n.end]);
  const scan=(n:ts.Node)=>{nodes.set(key(n),n);ts.forEachChild(n,scan);};scan(sf);
  const globalAvailable=(n:ts.Node)=>!checker.getSymbolsInScope(n,ts.SymbolFlags.Value).find(s=>s.name==='globalThis')?.declarations?.some(d=>!(ts.isIdentifier(d)&&(ts.isPropertyAccessExpression(d.parent)||ts.isElementAccessExpression(d.parent))&&d.parent.expression===d));
  for(const initializer of initializers.filter(i=>i.render.file===name)){
   const fn=nodes.get(JSON.stringify([initializer.render.start,initializer.render.end]));if(!fn||initializer.render.sha256!==hash||!(ts.isArrowFunction(fn)||ts.isFunctionExpression(fn)))throw Error('consumer-literal-render-changed');
   const walk=(n:ts.Node)=>{
    if(ts.isFunctionLike(n)&&n!==fn)return;
    const object=ts.isObjectLiteralExpression(n)&&n.properties.every(p=>ts.isSpreadAssignment(p)||ts.isShorthandPropertyAssignment(p)&&!p.objectAssignmentInitializer||ts.isPropertyAssignment(p)&&(ts.isComputedPropertyName(p.name)||(ts.isIdentifier(p.name)||ts.isStringLiteral(p.name)||ts.isNumericLiteral(p.name))&&p.name.text!=='__proto__'));
    const array=ts.isArrayLiteralExpression(n)&&!n.elements.some(ts.isOmittedExpression);
    if((object||array)&&globalAvailable(n))result.push({source:point(n),consumer:initializer.render,kind:array?'array':'record'});
    ts.forEachChild(n,walk);
   };walk(fn);
  }
 }
 return result;
}
