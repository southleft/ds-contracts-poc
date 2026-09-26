import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,symlinkSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readReactRuntimeExport,observeReactRuntimeDependencies} from './react-runtime-export.js';
import type {ReactSourceProgram} from './react-source-program.js';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {reactOwnershipHook,reactOwnershipRead,type ReactOwnership} from './react-ownership.js';

function fixture(t:test.TestContext,source:Record<string,string>,edges:Array<[string,string,string]>=[]){
  const sourceRoot=realpathSync(mkdtempSync(path.join(tmpdir(),'react-runtime-export-')));t.after(()=>rmSync(sourceRoot,{recursive:true,force:true}));
  const files:Record<string,string>={};
  for(const [name,text] of Object.entries(source)){
    const file=path.join(sourceRoot,name);writeFileSync(file,text);files[file]=createHash('sha256').update(text).digest('hex');
  }
  return {sourceRoot,files,runtimeImports:edges.map(([importer,specifier,file])=>({importer:path.join(sourceRoot,importer),specifier,file:path.join(sourceRoot,file)}))};
}
const resolved=(r:ReturnType<typeof readReactRuntimeExport>)=>{assert.equal(r.status,'resolved',r.status==='refused'?r.reason:'resolved');if(r.status!=='resolved')throw Error('unreachable');return r;};
const refusal=(r:ReturnType<typeof readReactRuntimeExport>,reason:string)=>{assert.equal(r.status,'refused');if(r.status==='refused')assert.equal(r.reason,reason);};

test('follows named namespace imports and renamed exports through witnessed runtime edges',t=>{
  const r=fixture(t,{'entry.mjs':'import * as Controls from "package"; export {Controls as Widgets};','barrel.mjs':'export {Target as Root} from "implementation";','impl.mjs':'var Target = unknownFactory(); export {Target};'},[['entry.mjs','package','barrel.mjs'],['barrel.mjs','implementation','impl.mjs']]);
  const result=resolved(readReactRuntimeExport(r,'entry.mjs',['Widgets','Root']));
  assert.equal(result.definition.module,'impl.mjs');assert.equal(result.definition.bindingName,'Target');
  assert.equal(readFileSync(path.join(r.sourceRoot,'impl.mjs'),'utf8').slice(result.definition.span.start,result.definition.span.end),'Target = unknownFactory()');
  assert.equal(result.runtimeVerified,false);assert.equal(result.acceptedContract,null);assert.equal(Object.keys(result.files).length,3);
  assert.deepEqual(result.route.map(x=>x.exportPath),[['Widgets','Root'],['Root'],['Target']]);
});

test('does not execute module initializers or interpret an object member as an ESM namespace',t=>{
  const r=fixture(t,{'entry.mjs':'export const Api={get Root(){throw Error("must not execute")}}; export const Value=(()=>{throw Error("must not execute")})();'});
  resolved(readReactRuntimeExport(r,'entry.mjs',['Value']));
  refusal(readReactRuntimeExport(r,'entry.mjs',['Api','Root']),'runtime-export-member-not-namespace');
});

test('supports namespace reexports, default imports and direct default declarations',t=>{
  const r=fixture(t,{'entry.mjs':'export * as NS from "package";','barrel.mjs':'import Target from "implementation"; export {Target as Chosen};','impl.mjs':'export default function Original(){}'},[['entry.mjs','package','barrel.mjs'],['barrel.mjs','implementation','impl.mjs']]);
  const result=resolved(readReactRuntimeExport(r,'entry.mjs',['NS','Chosen']));assert.equal(result.definition.bindingName,'Original');assert.equal(result.definition.declarationKind,'FunctionDeclaration');
  refusal(readReactRuntimeExport(r,'entry.mjs',['NS']),'runtime-export-namespace-not-value');
});

test('star exports distinguish shared source bindings from conflicting bindings and omit default',t=>{
  const r=fixture(t,{'entry.mjs':'export * from "one"; export * from "two";','one.mjs':'export {Thing} from "shared";','two.mjs':'export {Thing} from "shared";','shared.mjs':'export const Thing=1; export default Thing;'},[['entry.mjs','one','one.mjs'],['entry.mjs','two','two.mjs'],['one.mjs','shared','shared.mjs'],['two.mjs','shared','shared.mjs']]);
  assert.equal(resolved(readReactRuntimeExport(r,'entry.mjs',['Thing'])).definition.module,'shared.mjs');
  refusal(readReactRuntimeExport(r,'entry.mjs',['default']),'runtime-export-missing');
  const conflict=fixture(t,{'entry.mjs':'export * from "one"; export * from "two";','one.mjs':'export const Thing=1;','two.mjs':'export const Thing=1;'},[['entry.mjs','one','one.mjs'],['entry.mjs','two','two.mjs']]);
  refusal(readReactRuntimeExport(conflict,'entry.mjs',['Thing']),'runtime-export-star-ambiguous');
});

test('explicit exports shadow star exports and unresolved cycles refuse',t=>{
  const r=fixture(t,{'entry.mjs':'export const Thing=1; export * from "other";','other.mjs':'export const Thing=2;'},[['entry.mjs','other','other.mjs']]);
  assert.equal(resolved(readReactRuntimeExport(r,'entry.mjs',['Thing'])).definition.module,'entry.mjs');
  const cycle=fixture(t,{'a.mjs':'export {Thing} from "b";','b.mjs':'export {Thing} from "a";'},[['a.mjs','b','b.mjs'],['b.mjs','a','a.mjs']]);
  refusal(readReactRuntimeExport(cycle,'a.mjs',['Thing']),'runtime-export-cycle');
});

test('two star routes to differently named exports of the same binding are not ambiguous',t=>{
  const r=fixture(t,{'entry.mjs':'export * from "one";export * from "two";','one.mjs':'export {A as Thing} from "shared";','two.mjs':'export {B as Thing} from "shared";','shared.mjs':'const Actual=1;export {Actual as A,Actual as B};'},[['entry.mjs','one','one.mjs'],['entry.mjs','two','two.mjs'],['one.mjs','shared','shared.mjs'],['two.mjs','shared','shared.mjs']]);
  assert.equal(resolved(readReactRuntimeExport(r,'entry.mjs',['Thing'])).definition.bindingName,'Actual');
});

test('a large acyclic star graph stops at a named traversal bound',t=>{
  const source:Record<string,string>={'base.mjs':'export const X=1;'},edges:Array<[string,string,string]>=[];
  for(let n=0;n<9;n++){const file=`level${n}.mjs`,next=n===0?'base.mjs':`level${n-1}.mjs`;source[file]='export * from "left";export * from "right";';edges.push([file,'left',next],[file,'right',next]);}
  const r=fixture(t,source,edges);refusal(readReactRuntimeExport(r,'level8.mjs',['X']),'runtime-export-traversal-limit');
});

test('declarations, missing runtime witnesses and changed executable bytes cannot identify runtime bindings',t=>{
  const r=fixture(t,{'entry.mjs':'export {Thing} from "package";','impl.mjs':'export const Thing=1;','types.d.ts':'export declare const Thing:number;'},[['entry.mjs','package','impl.mjs']]);
  refusal(readReactRuntimeExport({...r,runtimeImports:[]},'entry.mjs',['Thing']),'runtime-export-edge-unwitnessed');
  refusal(readReactRuntimeExport({...r,runtimeImports:[{importer:path.join(r.sourceRoot,'entry.mjs'),specifier:'package',file:path.join(r.sourceRoot,'types.d.ts')}]},'entry.mjs',['Thing']),'runtime-export-nonexecutable-source');
  writeFileSync(path.join(r.sourceRoot,'impl.mjs'),'export const Thing=2;');
  refusal(readReactRuntimeExport(r,'entry.mjs',['Thing']),'runtime-export-source-not-witnessed-or-changed');
});

test('ambiguous bundler edges and source paths escaping the source root refuse',t=>{
  const r=fixture(t,{'entry.mjs':'export {Thing} from "package";','one.mjs':'export const Thing=1;','two.mjs':'export const Thing=1;'},[['entry.mjs','package','one.mjs'],['entry.mjs','package','two.mjs']]);
  refusal(readReactRuntimeExport(r,'entry.mjs',['Thing']),'runtime-export-edge-ambiguous');
  const outside=fixture(t,{'outside.mjs':'export const Thing=1;'});symlinkSync(path.join(outside.sourceRoot,'outside.mjs'),path.join(r.sourceRoot,'link.mjs'));
  refusal(readReactRuntimeExport(r,'link.mjs',['Thing']),'runtime-export-outside-source-root');
});

test('duplicate exports, non-identifier default expressions and destructured exports refuse',t=>{
  const r=fixture(t,{'duplicate.mjs':'const X=1;export {X};export {X};','default.mjs':'export default (()=>1);','destructure.mjs':'export const {X}=unknown;','types.ts':'export type OnlyType=string;','commonjs.js':'module.exports={X:1};'});
  refusal(readReactRuntimeExport(r,'duplicate.mjs',['X']),'runtime-export-duplicate-binding');
  refusal(readReactRuntimeExport(r,'default.mjs',['default']),'runtime-export-expression-unmodeled');
  refusal(readReactRuntimeExport(r,'destructure.mjs',['X']),'runtime-export-destructured-export');
  refusal(readReactRuntimeExport(r,'types.ts',['OnlyType']),'runtime-export-missing');
  refusal(readReactRuntimeExport(r,'commonjs.js',['X']),'runtime-export-missing');
});

test('runtime registrations keep source semantics unresolved and deduplicate aliases without changing the caller program',t=>{
  const r=fixture(t,{'entry.mjs':'import * as P from "package";export function Host(){}','impl.mjs':'var Actual=unknownFactory();export {Actual as Root,Actual as Alias};'},[['entry.mjs','package','impl.mjs']]);
  const source:ReactSourceProgram={version:1,status:'observed',acceptedContract:null,typescriptVersion:'test',readerOptions:{},compatibilityNotes:[],files:{[path.join(r.sourceRoot,'entry.mjs')]:r.files[path.join(r.sourceRoot,'entry.mjs')]},problems:[],components:[{
    name:'Host',exportName:'Host',module:'entry.mjs',sourceSha256:r.files[path.join(r.sourceRoot,'entry.mjs')],span:{start:0,end:1},props:[],root:{kind:'unresolved'},children:{kind:'unresolved',reason:'unproven'},markers:[],defaults:{},forwardedProps:[],problems:[],
    componentReferences:['Root','Alias'].map(name=>({span:{start:0,end:1},target:{kind:'component',module:'package',export:name,dependencyProblem:'implementation-unavailable'}})),
  }]};
  const before=JSON.stringify(source),observed=observeReactRuntimeDependencies(r,source);assert.equal(JSON.stringify(source),before);
  assert.equal(observed.observations.length,2);assert.equal(observed.program.components.length,2);
  const dependency=observed.program.components[1];assert.equal(dependency.implementation,'unresolved');assert.equal(dependency.children.kind,'unresolved');assert.equal(dependency.root.kind,'unresolved');assert.deepEqual(dependency.props,[]);
  assert.equal(observed.program.files[path.join(r.sourceRoot,'impl.mjs')],r.files[path.join(r.sourceRoot,'impl.mjs')]);
  const unavailable=observeReactRuntimeDependencies({...r,runtimeImports:[]},source);assert.equal(unavailable.program.components.length,1);assert(unavailable.observations.every(o=>o.result.status==='refused'));
});

test('the renderer distinguishes component exports from host strings and context providers without changing DOM',async()=>{
  const output=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';
const kind=window.fixtureKind;
const value=kind==='host'?'button':kind==='context'?React.createContext('default'):kind==='forward'?React.forwardRef((props,ref)=>React.createElement('button',{id:'selected',ref},'Original')):()=>React.createElement('button',{id:'selected'},'Original');
window.__DSC_REACT_EXPORTS=[{identity:{module:'fixture.mjs',exportName:'Actual',sourceSha256:'fixture',span:{start:0,end:1}},value,runtimeObservationOnly:true}];
const element=kind==='context'?React.createElement(value,{value:'recorded'},React.createElement('button',{id:'selected'},'Original')):React.createElement(value,{id:'selected'},'Original');
createRoot(document.getElementById('root')).render(element);`,resolveDir:process.cwd(),loader:'js'},bundle:true,write:false,format:'iife',define:{'process.env.NODE_ENV':'"development"'}});
  const browser=await chromium.launch();
  try{for(const kind of ['host','context','forward','function']){
    const page=await browser.newPage();try{
      await page.setContent('<div id="root"></div>');await page.evaluate(reactOwnershipHook);await page.evaluate(k=>{(window as unknown as {fixtureKind:string}).fixtureKind=k;},kind);
      await page.addScriptTag({content:output.outputFiles[0].text});await page.locator('#selected').waitFor();
      const before=await page.locator('#selected').evaluate(n=>n.outerHTML),result=await page.evaluate<ReactOwnership>(reactOwnershipRead('#selected'));
      assert.equal(await page.locator('#selected').evaluate(n=>n.outerHTML),before);
      if(kind==='host')assert.deepEqual(result.problems,['react-ownership-runtime-export-not-component']);
      else if(kind==='context')assert(result.problems.includes('react-ownership-runtime-boundary-kind-unsupported'));
      else{assert.deepEqual(result.problems,[]);assert.equal(result.components.length,1);assert.deepEqual(result.components[0].roots,['']);}
    }finally{await page.close();}
  }}finally{await browser.close();}
});
