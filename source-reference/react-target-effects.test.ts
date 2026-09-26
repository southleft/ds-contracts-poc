import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {readReactRuntimeExport} from './react-runtime-export.js';
import {readReactTargetInitializer} from './react-target-initializer.js';
import {readReactTargetEffects} from './react-target-effects.js';
import type {ReactElementInvocation} from './react-element-invocation.js';
import type {TargetValueShape} from './react-helper-model.mjs';

const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
function fixture(body:string,run:(input:ReturnType<typeof prepare>)=>void,name='Container',imports=''){
  const root=mkdtempSync(path.join(process.cwd(),'source-reference/.target-effects-'));
  const text=`import * as React from 'react';import {jsx as make,jsxs as many,Fragment} from 'react/jsx-runtime';${imports}
export function Provider(props){throw Error('provider body must not execute');}
export const ${name}=React.forwardRef(function Render(props,ref){${body}});`;
  try{run(prepare(root,text,name));}finally{rmSync(root,{recursive:true,force:true});}
}
function prepare(root:string,text:string,name:string){
  const file=path.join(root,'control.mjs');writeFileSync(file,text);
  const reference={sourceRoot:root,files:{[file]:sha(text)}};
  const target=readReactRuntimeExport(reference,'control.mjs',[name]);assert.equal(target.status,'resolved');
  const initializer=readReactTargetInitializer(reference,target.definition);
  // These are explicit source-model assumptions, not a claimed browser receipt.
  const invocation=(props:Record<string,unknown>):ReactElementInvocation=>({version:1,acceptedContract:null,effectsVerified:false,status:'observed',invocation:1,
    function:{module:'control.mjs',sourceSha256:sha(text),span:{start:initializer.render.start,end:initializer.render.end},parameters:[]},
    input:Object.entries(props).map(([key,v])=>[key,v===undefined?{kind:'undefined'}:v===null?{kind:'null',value:null}:['string','number','boolean'].includes(typeof v)?{kind:typeof v,value:v as string|number|boolean}:{kind:typeof v}]),
    childrenIdentity:'same-value',secondaryKinds:['object'],closureReads:[],globalReads:[],effects:[],
    inputProvenance:{status:'verified',qualification:'react-props-origin-only',kind:'jsx',source:{module:'control.mjs',sourceSha256:sha(text),span:{start:0,end:1},factory:'jsx'}},
    outputProvenance:{status:'verified',qualification:'react-props-origin-only',kind:'jsx',source:{module:'control.mjs',sourceSha256:sha(text),span:{start:0,end:1},factory:'jsx'}}});
  return {root,file,text,name,reference,initializer,invocation};
}
function check(shape:TargetValueShape,value:any,input:Record<string,unknown>,ref:unknown,provider:unknown):void{
  if(shape.kind==='literal'){assert.equal(typeof value,shape.type);assert.equal(value,shape.type==='undefined'?undefined:shape.value);return;}
  if(shape.kind==='opaque'){assert.equal(value,input.children);return;}
  if(shape.kind==='input'){assert.equal(value,input[shape.key]);return;}
  if(shape.kind==='parameter'){assert.equal(shape.index,1);assert.equal(value,ref);return;}
  if(shape.kind==='callback'){assert.equal(typeof value,'function');assert.equal(shape.qualification,'callback-body-unverified');return;}
  if(shape.kind==='array'){assert.equal(value.length,shape.items.length);shape.items.forEach((v,i)=>check(v,value[i],input,ref,provider));return;}
  if(shape.kind==='record'){assert.deepEqual(Object.keys(value),shape.fields.map(([key])=>key));for(const [key,item] of shape.fields)check(item,value[key],input,ref,provider);return;}
  assert.equal(value.type,shape.tag.kind==='source-binding'?provider:shape.tag.kind==='fragment'?React.Fragment:shape.tag.name);
  assert.equal(value.key,shape.key);check(shape.props,value.props,input,ref,provider);
}

test('target parameter aliases, defaults and rest match native destructuring without inspecting opaque fields',()=>{
 const root=mkdtempSync(path.join(process.cwd(),'source-reference/.target-parameter-'));
 try{
  for(const name of ['Container','IndependentShell'])for(const selected of [undefined,false,true]){
   const text=`import * as React from 'react';import {jsx} from 'react/jsx-runtime';
   export const ${name}=React.forwardRef(function Render({selected:active=false,label='Default',...rest},ref){return jsx('button',{...rest,ref,'data-active':active,'data-label':label});});`;
   const f=prepare(root,text,name),opaque=new Proxy({}, {get(){throw Error('opaque read');}}),onClick=()=>{throw Error('event invoked');};
   const input={selected,label:undefined,children:React.createElement('em',null,'Caller'),payload:opaque,onClick},ref={current:null};
   const model=readReactTargetEffects(f.reference,f.initializer,f.invocation(input));assert.equal(model.status,'modeled',JSON.stringify(model));if(model.status!=='modeled')continue;
   assert.equal(model.effectsVerified,false);assert.equal(model.runtimeVerified,false);assert.equal(model.acceptedContract,null);
   const context={exports:{} as Record<string,any>,require:createRequire(import.meta.url)};
   runInNewContext(ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
   check(model.output,context.exports[name].render(input,ref),input,ref,undefined);
   assert.deepEqual(model.decisions.filter(d=>d.kind==='binding-default').map(d=>d.taken),[selected===undefined,true]);
  }
  for(const [pattern,body,reason] of [
   ['{payload:{value}}',"return jsx('button',{children:value});",'opaque-input-inspected:payload'],
   ['{children:{value}}',"return jsx('button',{children:value});",'opaque-content-inspected'],
   ["{['id']:name}","return jsx('button',{id:name});",'computed-binding'],
  ]){
   const text=`import * as React from 'react';import {jsx} from 'react/jsx-runtime';export const Root=React.forwardRef(function Render(${pattern},ref){${body}});`;
   const f=prepare(root,text,'Root'),model=readReactTargetEffects(f.reference,f.initializer,f.invocation({payload:{},children:{},id:'example'}));
   assert.equal(model.status,'refused');if(model.status==='refused')assert.equal(model.reason,reason);
  }
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('dependency projection retains complete provider props, rest captures, opaque inputs and refs without executing deferred callbacks',()=>{
  for(const name of ['Container','IndependentShell'])fixture(`const {selected=false,scope,...rest}=props;
return make(Provider,{selected,scope,render:({visible})=>many(Fragment,{children:[make('button',{...rest,ref}),visible&&make('input',{scope})]})});`,f=>{
    const opaque=new Proxy({}, {get(){throw Error('opaque value inspected');}}),onClick=()=>{throw Error('event invoked');},ref={current:null};
    const input={selected:true,scope:undefined,label:'Caller',children:React.createElement('em',null,'Caller child'),payload:opaque,onClick};
    const model=readReactTargetEffects(f.reference,f.initializer,f.invocation(input));assert.equal(model.status,'modeled',JSON.stringify(model));
    if(model.status!=='modeled')return;
    assert.equal(model.effectsVerified,false);assert.equal(model.runtimeVerified,false);assert.equal(model.acceptedContract,null);
    assert.equal(model.targetFactories.length,1);assert.equal(model.jsxTargets.length,1);
    const callback=new Map(model.output.props.fields).get('render');assert(callback?.kind==='callback');
    assert.equal(callback.capturePhase,'render-return');assert.deepEqual(callback.captures.map(c=>c.name),['rest','ref','scope']);
    assert.deepEqual(callback.dependencies.map(d=>d.name),['many','Fragment','make','make']);
    assert.equal(callback.captures[0].value.kind,'record');
    const context={exports:{} as Record<string,any>,require:createRequire(import.meta.url)};
    runInNewContext(ts.transpileModule(f.text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
    const output=context.exports[name].render(input,ref);check(model.output,output,input,ref,context.exports.Provider);
    for(const visible of [false,true]){
      const result=output.props.render({visible});assert.equal(result.type,React.Fragment);
      check(callback.captures[0].value,Object.fromEntries(Object.entries(result.props.children[0].props).filter(([k])=>k!=='ref')),input,ref,context.exports.Provider);
      assert.equal(result.props.children[0].props.ref,ref);assert.equal(result.props.children[0].props.onClick,onClick);
      assert.equal(result.props.children[0].props.children,input.children);assert.equal(!!result.props.children[1],visible);
    }
  },name);
});

test('compiled factory argument order, renamed imports, key precedence, fragments and absent children match actual React',()=>{
  for(const body of [
    `const config={id:'before',key:'props'};return make('button',config,config.id='after');`,
    `return many(Fragment,{children:[make('b',{children:props.label}),make('i',{})]});`,
    `const {label='Default',...rest}=props;return make('button',{...rest,children:label});`,
  ])fixture(body,f=>{
    const input={},model=readReactTargetEffects(f.reference,f.initializer,f.invocation(input));assert.equal(model.status,'modeled',JSON.stringify(model));if(model.status!=='modeled')return;
    assert.equal(model.input.kind,'record');if(model.input.kind==='record')assert.equal(model.input.fields.length,0);
    const context={exports:{} as Record<string,any>,require:createRequire(import.meta.url)};
    runInNewContext(ts.transpileModule(f.text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
    check(model.output,context.exports.Container.render(input,null),input,null,context.exports.Provider);
  });
});

test('callback captures describe the binding at render return, including a local change after callback creation',()=>{
  fixture(`let label=props.label;const render=()=>make('b',{children:label});label=label+'!';return make(Provider,{render});`,f=>{
    const input={label:'Before'},model=readReactTargetEffects(f.reference,f.initializer,f.invocation(input));
    assert.equal(model.status,'modeled',JSON.stringify(model));if(model.status!=='modeled')return;
    const callback=new Map(model.output.props.fields).get('render');assert(callback?.kind==='callback');
    assert.equal(callback.capturePhase,'render-return');assert.equal(callback.captures.length,1);
    assert.deepEqual(callback.captures[0].value,{kind:'literal',type:'string',value:'Before!'});
    const context={exports:{} as Record<string,any>,require:createRequire(import.meta.url)};
    runInNewContext(ts.transpileModule(f.text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
    assert.equal(context.exports.Container.render(input,null).props.render().props.children,'Before!');
  });
});

test('unknown context effects, writes, opaque inspection, callback writes and guessed factories remain refusals',()=>{
  const cases=[
    [`const config={id:'before'};return make('button',config,(config.id='after','key'));`,{},'binary-unmodeled:,',''],
    [`props.label='changed';return make('button',{});`,{label:'Original'},'external-data-write',''],
    [`return make('button',{title:props.payload.value});`,{payload:{}},'opaque-input-inspected:payload',''],
    [`ref.current='changed';return make('button',{});`,{},'opaque-parameter-inspected',''],
    [`const state=useState(false);return make('button',{children:state});`,{},'executable-import-unresolved',`import {useState} from 'react';`],
    [`return make(Provider,{render:()=>{props.label='changed';return make('b',{});}});`,{},'target-callback-effects-unmodeled',''],
    [`return make(Provider,{render:()=>()=>props.children});`,{children:{}},'target-callback-effects-unmodeled',''],
    [`return make(Provider,{render:()=>this});`,{},'target-callback-context-unmodeled',''],
    [`return make(Provider,{render:({value=props.label})=>make('i',{children:value})});`,{},'target-callback-context-unmodeled',''],
    [`return make(Provider,{render:()=>arguments[0]});`,{},'target-callback-context-unmodeled',''],
    [`const fake=(tag,props)=>({tag,props});return fake('button',{});`,{},'component-return-not-jsx',''],
    [`const UI={get Provider(){throw Error('getter executed');}};return make(UI.Provider,{});`,{},'nondata-object-member',''],
  ] as const;
  for(const [body,input,reason,imports] of cases)fixture(body,f=>{
    const result=readReactTargetEffects(f.reference,f.initializer,f.invocation(input));assert.equal(result.status,'refused',body);if(result.status==='refused')assert.equal(result.reason,reason,body);
  },'Container',imports);
});

test('source-model observations are assumptions and cannot authenticate changed initializer, input provenance, source or callback dependencies',()=>{
  fixture(`const {children,...rest}=props;return make(Provider,{render:()=>untrusted(rest,children,ref)});`,f=>{
    const input=f.invocation({children:{},id:'value'}),model=readReactTargetEffects(f.reference,f.initializer,input);
    assert.equal(model.status,'modeled');if(model.status==='modeled'){
      const cb=new Map(model.output.props.fields).get('render');assert(cb?.kind==='callback');assert.deepEqual(cb.dependencies.map(d=>d.name),['untrusted']);assert.equal(cb.dependencies[0].binding,undefined);
      assert.equal(model.runtimeVerified,false);assert.equal(model.effectsVerified,false);
      assert(model.runtimeRequirements.includes('deferred-callback-body-and-module-dependency-effects'));
    }
    const changed=structuredClone(f.initializer);changed.render.start++;assert.equal(readReactTargetEffects(f.reference,changed,input).status,'refused');
    const bad=structuredClone(input);if(bad.status!=='observed')return;bad.inputProvenance={status:'refused',reason:'unregistered'};assert.equal(readReactTargetEffects(f.reference,f.initializer,bad).status,'refused');
    const duplicate=structuredClone(input);if(duplicate.status!=='observed')return;duplicate.input.push(duplicate.input[0]);assert.equal(readReactTargetEffects(f.reference,f.initializer,duplicate).status,'refused');
    writeFileSync(f.file,f.text+'\n');assert.equal(readReactTargetEffects(f.reference,f.initializer,input).status,'refused');
  });
});
