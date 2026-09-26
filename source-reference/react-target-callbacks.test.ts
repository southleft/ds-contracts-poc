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
import {replanReactTargetEffects,replanReactTargetCallback} from './react-target-effects.js';
import type {TargetValueShape,TargetCallbackValueShape} from './react-helper-model.mjs';
import type {ReactElementObservedValue} from './react-element-invocation.js';

const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const described=(value:unknown):ReactElementObservedValue=>value===undefined?{kind:'undefined'}:value===null?{kind:'null',value:null}:
  ['string','number','boolean'].includes(typeof value)?{kind:typeof value,value:value as string|number|boolean}:{kind:typeof value};
function fixture(body:string,run:(f:ReturnType<typeof prepare>)=>void,helpers='',name='Container'){
  const root=mkdtempSync(path.join(process.cwd(),'source-reference/.target-callbacks-'));
  const text=`import * as React from 'react';import {jsx as make,jsxs as many,Fragment} from 'react/jsx-runtime';
export function Provider(props){throw Error('provider must not execute during source analysis');}
export const Leaf=React.forwardRef((p,r)=>make('button',{...p,ref:r}));${helpers}
export const ${name}=React.forwardRef(function Render(props,ref){${body}});`;
  try{run(prepare(root,text,name));}finally{rmSync(root,{recursive:true,force:true});}
}
function prepare(root:string,text:string,name:string){
  const file=path.join(root,'control.mjs');writeFileSync(file,text);const reference={sourceRoot:root,files:{[file]:sha(text)}};
  const target=readReactRuntimeExport(reference,'control.mjs',[name]);assert.equal(target.status,'resolved');
  const initializer=readReactTargetInitializer(reference,target.definition);
  const model=(input:Record<string,unknown>)=>replanReactTargetEffects(reference,initializer,{kind:'record',fields:Object.entries(input).map(([key,v])=>[key,
    v!==null&&['object','function','symbol','bigint'].includes(typeof v)?key==='children'?{kind:'opaque'}:{kind:'input',key}:
    {kind:'literal',type:typeof v,...(v===undefined?{}:{value:v as string|number|boolean|null})}])});
  const actual=()=>{const context={exports:{} as Record<string,any>,require:createRequire(import.meta.url)};
    runInNewContext(ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);return context.exports;};
  return {file,text,reference,initializer,model,actual,name};
}
function callback(shape:TargetValueShape):Extract<TargetValueShape,{kind:'callback'}>{
  assert.equal(shape.kind,'jsx');if(shape.kind!=='jsx')throw Error('expected JSX');
  const found=new Map(shape.props.fields).get('render');assert.equal(found?.kind,'callback');if(found?.kind!=='callback')throw Error('expected callback');return found;
}
function compare(shape:TargetCallbackValueShape,value:any,root:Record<string,unknown>,input:Record<string,unknown>,ref:unknown,leaf:unknown):void{
  if(shape.kind==='literal'){assert.equal(typeof value,shape.type);assert.equal(value,shape.type==='undefined'?undefined:shape.value);return;}
  if(shape.kind==='opaque'){assert.equal(value,root.children);return;}
  if(shape.kind==='input'){assert.equal(value,root[shape.key]);return;}
  if(shape.kind==='callback-input'){assert.equal(value,input[shape.key]);return;}
  if(shape.kind==='parameter'){assert.equal(shape.index,1);assert.equal(value,ref);return;}
  if(shape.kind==='record'){assert.deepEqual(Object.keys(value),shape.fields.map(([k])=>k));for(const [k,s] of shape.fields)compare(s,value[k],root,input,ref,leaf);return;}
  if(shape.kind==='array'){assert.equal(value.length,shape.items.length);shape.items.forEach((s,i)=>compare(s,value[i],root,input,ref,leaf));return;}
  assert.equal(value.type,shape.tag.kind==='host'?shape.tag.name:shape.tag.kind==='fragment'?React.Fragment:leaf);
  assert.equal(value.key,shape.key);compare(shape.props,value.props,root,input,ref,leaf);
}

test('deferred projection keeps the original render closure, both conditional branches and distinct opaque caller/context identities',()=>{
  for(const name of ['Container','IndependentShell'])fixture(`const {selected=false,...rest}=props;let label=props.label;
const render=({visible,payload})=>many(Fragment,{children:[make(Leaf,{...rest,ref,'data-label':label,payload}),visible&&make('input',{selected})]});
label=label+'!';return make(Provider,{render});`,f=>{
    let reads=0;const payload=new Proxy({}, {get(){reads++;throw Error('context payload inspected');}}),onClick=()=>{},ref={current:null};
    const input={selected:true,label:'Original',children:React.createElement('b',null,'Caller'),onClick};
    const root=f.model(input);assert.equal(root.status,'modeled',JSON.stringify(root));if(root.status!=='modeled')return;
    const original=JSON.stringify(root),cb=callback(root.output),actual=f.actual(),returned=actual[name].render(input,ref);
    for(const visible of [false,true]){
      const context={visible,payload,unused:()=>{}},result=replanReactTargetCallback(f.reference,f.initializer,root,cb.source,Object.entries(context).map(([k,v])=>[k,described(v)]));
      assert.equal(result.status,'modeled',JSON.stringify(result));if(result.status!=='modeled')continue;
      assert.equal(result.runtimeVerified,false);assert.equal(result.effectsVerified,false);assert.equal(result.acceptedContract,null);assert(result.deferred);
      assert.deepEqual(result.output,root.output);assert.deepEqual(result.calls,root.calls);assert.deepEqual(result.targetFactories,root.targetFactories);
      assert.equal(result.deferred.targetFactories.length,visible?3:2);assert.equal(result.deferred.jsxTargets.length,1);
      compare(result.deferred.input,context,input,context,ref,actual.Leaf);
      compare(result.deferred.output,returned.props.render(context),input,context,ref,actual.Leaf);
      assert.equal(JSON.stringify(root),original);
    }
    assert.equal(reads,0);
  },'',name);
});

test('deferred helper calls retain their source trace and key evaluation order',()=>{
  fixture(`const {children,...rest}=props;return make(Provider,{render:({visible})=>make('b',{...rest,children:format(visible,props.label),key:'selected'},'argument')});`,f=>{
    const input={label:'Caller',children:'Original'},root=f.model(input);assert.equal(root.status,'modeled');if(root.status!=='modeled')return;
    const cb=callback(root.output),result=replanReactTargetCallback(f.reference,f.initializer,root,cb.source,[['visible',{kind:'boolean',value:true}]]);
    assert.equal(result.status,'modeled',JSON.stringify(result));if(result.status!=='modeled')return;assert(result.deferred);
    assert.equal(result.deferred.calls.length,2);assert(result.deferred.calls[1].site);
    assert.equal(result.deferred.output.key,'selected');
    const exports=f.actual();compare(result.deferred.output,exports.Container.render(input,null).props.render({visible:true}),input,{visible:true},null,exports.Leaf);
  },`function format(visible,label){return visible?'['+label+']':label;}`);
});

test('unknown hooks, opaque inspection, captured-object mutation and new deferred callbacks remain named refusals',()=>{
  for(const [body,helpers,input,reason] of [
    [`const {children,...rest}=props;return make(Provider,{render:({visible})=>make('b',{children:mutate(rest)})});`,`function mutate(record){record.label='changed';return record.label;}`,{visible:true},'external-data-write'],
    [`return make(Provider,{render:({payload})=>make('b',{children:payload.value})});`,'',{payload:{}},'opaque-callback-input-inspected:payload'],
    [`return make(Provider,{render:()=>make('b',{children:useUnknownContext()})});`,'',{},'target-callback-parameter-unmodeled'],
    [`return make(Provider,{render:({visible})=>make('b',{children:useUnknownContext()})});`,'',{visible:true},'binding-without-source:useUnknownContext'],
    [`return make(Provider,{render:({visible})=>make('b',{render:factory()})});`,`function factory(){return ()=>1;}`,{visible:true},'target-callback-nested-output-unmodeled'],
  ] as const)fixture(body,f=>{
    const root=f.model({label:'Original',children:'Caller'});assert.equal(root.status,'modeled',JSON.stringify(root));if(root.status!=='modeled')return;
    const cb=callback(root.output),result=replanReactTargetCallback(f.reference,f.initializer,root,cb.source,Object.entries(input).map(([k,v])=>[k,described(v)]));
    assert.equal(result.status,'refused',JSON.stringify(result));if(result.status==='refused')assert.equal(result.reason,reason);
  },helpers);
});

test('changed root assumptions, absent or aliased callback returns and duplicate callback input refuse',()=>{
  fixture(`return make(Provider,{render:({visible})=>make('b',{children:props.label})});`,f=>{
    const root=f.model({label:'Original'});assert.equal(root.status,'modeled');if(root.status!=='modeled')return;const cb=callback(root.output);
    const changed=structuredClone(root);changed.output.key='forged';assert.equal(replanReactTargetCallback(f.reference,f.initializer,changed,cb.source,[]).status,'refused');
    assert.equal(replanReactTargetCallback(f.reference,f.initializer,root,{...cb.source,start:cb.source.start+1},[]).status,'refused');
    assert.equal(replanReactTargetCallback(f.reference,f.initializer,root,cb.source,[['visible',{kind:'boolean',value:true}],['visible',{kind:'boolean',value:false}]]).status,'refused');
    writeFileSync(f.file,f.text+'\n');assert.equal(replanReactTargetCallback(f.reference,f.initializer,root,cb.source,[]).status,'refused');
  });
  fixture(`const render=({visible})=>make('b',{});return make(Provider,{render,alias:render});`,f=>{
    const root=f.model({});assert.equal(root.status,'modeled');if(root.status!=='modeled')return;
    const result=replanReactTargetCallback(f.reference,f.initializer,root,callback(root.output).source,[['visible',{kind:'boolean',value:true}]]);
    assert.equal(result.status,'refused');if(result.status==='refused')assert.equal(result.reason,'target-callback-return-ambiguous');
  });
});
