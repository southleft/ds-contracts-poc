import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {readReactContextCalls,planReactContextHelpers} from './react-context-calls.js';
import {modelReactContextHelperInput} from './react-target-effects.js';
import type {ReactElementObservedValue} from './react-element-invocation.js';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const scalar=(v:unknown):ReactElementObservedValue=>v===undefined?{kind:'undefined'}:v===null?{kind:'null',value:null}:['boolean','string','number'].includes(typeof v)?{kind:typeof v,value:v as string|boolean|number}:{kind:typeof v};
function fixture(name:string,body:string,run:(f:ReturnType<typeof prepare>)=>void){
 const dir=mkdtempSync(path.join(process.cwd(),'source-reference/.context-helper-model-'));
 try{run(prepare(dir,`import * as React from 'react';export function build(BaseContext,scopeName,index,fallback){function ${name}(consumer,scope,options={}){const {optional=false}=options;${body}}return ${name};}`));}finally{rmSync(dir,{recursive:true,force:true});}
}
function prepare(dir:string,text:string){
 const file=path.join(dir,'fixture.mjs');writeFileSync(file,text);const hash=sha(text),reference={sourceRoot:dir,files:{[file]:hash}};
 const calls=readReactContextCalls(text,'fixture.mjs',hash),helpers=planReactContextHelpers(reference,calls);assert.equal(helpers.length,1);const helper=helpers[0];
 const reads=(names:string[],fallback:unknown=undefined)=>{
  const used=new Set<number>();return names.map(name=>{
   const index=helper.closureReads!.findIndex((r,i)=>r.name===name&&!used.has(i));assert(index>=0,name);used.add(index);const site=helper.closureReads![index].read;
   return {site,value:name==='BaseContext'||name==='React'?scalar({}):name==='scopeName'?scalar('space'):name==='index'?scalar(0):scalar(fallback),context:name==='BaseContext'?5:null};
  });
 };
 const native=(value:unknown,origin=true)=>calls.map(c=>({site:c.call,context:5,value:scalar(value),...(origin?{origin:{id:7,fields:Object.entries(value as object).map(([key,v])=>[key,scalar(v)] as const)}}:{})}));
 const execute=(value:unknown,fallback?:unknown)=>{
  const context={},seen:unknown[]=[],env={exports:{} as any,require:()=>({useContext:(c:unknown)=>{seen.push(c);return value;}})};
  runInNewContext(ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,env);
  const result=env.exports.build(context,'space',0,fallback)('Consumer',undefined);assert(seen.every(c=>c===context));return result;
 };
 return {text,file,reference,helper,calls,reads,native,execute};
}
const body=`const Context=scope?.[scopeName]?.[index]||BaseContext;const value=React.useContext(Context);if(value)return value;if(fallback!==void 0)return fallback;if(optional)return void 0;throw new Error('missing provider');`;
test('source context helper paths consume only reached closure reads and preserve native context value identity',()=>{
 for(const name of ['read','useSettings'])fixture(name,body,f=>{
  const value={checked:true,label:'active'},args=[scalar('Consumer'),scalar(undefined)],reads=f.reads(['BaseContext','React']);
  const model=modelReactContextHelperInput(f.reference,f.helper,args,reads,f.native(value));assert.equal(model.status,'modeled',model.status==='refused'?model.reason:'');if(model.status!=='modeled')return;
  assert.equal(model.qualification,'context-helper-source-path-model-only');assert.equal(model.effectsVerified,false);assert.equal(model.runtimeVerified,false);assert.equal(model.acceptedContract,null);
  assert.deepEqual(model.output,{kind:'context-value',value:7});assert.equal(model.closureReads,2);assert.equal(model.nativeCalls.length,1);assert.equal(model.nativeCalls[0].context,5);
  assert.equal(f.text.slice(model.returnSource!.start,model.returnSource!.end),'return value;');assert.deepEqual(model.writes,[]);assert.equal(f.execute(value),value);
  assert(!reads.some(r=>f.text.slice(r.site.start,r.site.end)==='scopeName'||f.text.slice(r.site.start,r.site.end)==='index'));
  for(const changed of [[...reads].reverse(),reads.slice(0,1),[...reads,reads[0]]])assert.equal(modelReactContextHelperInput(f.reference,f.helper,args,changed,f.native(value)).status,'refused');
  const wrong=modelReactContextHelperInput(f.reference,f.helper,args,reads,f.native(value).map(c=>({...c,context:6})));assert.equal(wrong.status,'refused');if(wrong.status==='refused')assert.equal(wrong.reason,'context-helper-native-context-mismatch');
  const scoped=modelReactContextHelperInput(f.reference,f.helper,[scalar('Consumer'),scalar({})],f.reads(['scopeName','index','React']),f.native(value));assert.equal(scoped.status,'refused');
  const forged={...f.helper,closureReads:f.helper.closureReads!.slice(1)};assert.equal(modelReactContextHelperInput(f.reference,forged,args,reads,f.native(value)).status,'refused');
  writeFileSync(f.file,f.text+' ');assert.equal(modelReactContextHelperInput(f.reference,f.helper,args,reads,f.native(value)).status,'refused');
 });
});
test('false native values follow the original fallback branch and missing-provider throws stay unqualified',()=>{
 fixture('read',body,f=>{
  const args=[scalar('Consumer'),scalar(undefined)],reads=f.reads(['BaseContext','React','fallback','fallback'],'fallback');
  const model=modelReactContextHelperInput(f.reference,f.helper,args,reads,f.native(null,false));assert.equal(model.status,'modeled',model.status==='refused'?model.reason:'');if(model.status!=='modeled')return;
  assert.deepEqual(model.output,{kind:'literal',type:'string',value:'fallback'});assert.equal(f.text.slice(model.returnSource!.start,model.returnSource!.end),'return fallback;');assert.equal(f.execute(null,'fallback'),'fallback');
  const missing=modelReactContextHelperInput(f.reference,f.helper,args,f.reads(['BaseContext','React','fallback']),f.native(null,false));assert.equal(missing.status,'refused');assert.throws(()=>f.execute(null),/missing provider/);
 });
});
test('one source context value origin cannot supply conflicting field assumptions across native reads',()=>{
 fixture('read',`const Context=BaseContext;const one=React.useContext(Context),two=React.useContext(Context);return one;`,f=>{
  const args=[scalar('Consumer'),scalar(undefined)],reads=f.reads(['BaseContext','React','React']),native=f.native({checked:true});
  assert.equal(modelReactContextHelperInput(f.reference,f.helper,args,reads,native).status,'modeled');
  const changed=native.map((n,i)=>i?{...n,origin:{id:7,fields:[['checked',scalar(false)]] as Array<readonly [string,ReactElementObservedValue]>}}:n);
  const model=modelReactContextHelperInput(f.reference,f.helper,args,reads,changed);assert.equal(model.status,'refused');if(model.status==='refused')assert.equal(model.reason,'context-helper-value-changed');
 });
});
