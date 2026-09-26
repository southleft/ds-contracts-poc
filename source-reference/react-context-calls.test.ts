import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {readReactContextCalls,readReactContextRests,planReactContextHelpers,planReactContextConsumerCalls,planReactContextFactoryCalls,planReactContextBindings} from './react-context-calls.js';
import {readReactRuntimeExport} from './react-runtime-export.js';
import {readReactTargetInitializer} from './react-target-initializer.js';

const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
test('consumer call plans require original bare render calls and preserve source arguments',()=>{
 const root=mkdtempSync(path.join(process.cwd(),'source-reference/.context-consumer-plan-'));
 try{
  const text=`import React from 'react';import {jsx} from 'react/jsx-runtime';
  export const Root=React.forwardRef(function Render(props,ref){
   first(props.a);(renamed)(props.b);React.useRef();optional?.();spread(...props.values);eval('value');first(eval('value'));
   const later=()=>first('deferred');{const globalThis={};hidden(props.value);}
   return jsx('button',{});
  });`;
  const file=path.join(root,'fixture.mjs');writeFileSync(file,text);const reference={sourceRoot:root,files:{[file]:sha(text)}};
  const target=readReactRuntimeExport(reference,'fixture.mjs',['Root']);assert.equal(target.status,'resolved');if(target.status!=='resolved')return;
  const initializer=readReactTargetInitializer(reference,target.definition),calls=planReactContextConsumerCalls(reference,[initializer]);
  assert.deepEqual(calls.map(c=>text.slice(c.call.start,c.call.end)),['first(props.a)','(renamed)(props.b)']);
  assert.deepEqual(calls.map(c=>c.arguments.map(a=>text.slice(a.start,a.end))),[['props.a'],['props.b']]);assert(calls.every(c=>JSON.stringify(c.consumer)===JSON.stringify(initializer.render)));
  writeFileSync(file,text+' ');assert.throws(()=>planReactContextConsumerCalls(reference,[initializer]),/context-consumer-source-changed/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('context helper plans retain only original synchronous declaration and return boundaries',()=>{
 const root=mkdtempSync(path.join(process.cwd(),'source-reference/.context-helper-plan-'));
 try{
  const text=`import {useContext} from 'react';
  function factory(Context){function read(options={}){const value=useContext(Context);if(value)return value;return options.fallback;}return read;}
  async function asynchronous(){return useContext(Context);}
  function* generator(){return useContext(Context);}
  function evaluation(){eval('value');return useContext(Context);}
  function overrides(){try{return useContext(Context);}finally{return other;}}
  function shadow(shadow){return useContext(Context);}
  function defaults(value=useContext(Context)){return value;}
  function declarations(){function nested(){}return useContext(Context);}
  function outer(globalThis){function unavailable(){return useContext(Context);}return unavailable;}
  function returnScope(){const value=useContext(Context);{const globalThis={};return value;}}
  const arrow=()=>useContext(Context);`;
  const file=path.join(root,'fixture.mjs');writeFileSync(file,text);const reference={sourceRoot:root,files:{[file]:sha(text)}};
  const calls=readReactContextCalls(text,'fixture.mjs',sha(text)),helpers=planReactContextHelpers(reference,calls);
  assert.equal(helpers.length,1);assert.equal(helpers[0].name,'read');assert.equal(helpers[0].calls.length,1);
  assert.deepEqual(helpers[0].returns.map(r=>text.slice(r.start,r.end)),['return value;','return options.fallback;']);
  writeFileSync(file,text+' ');assert.throws(()=>planReactContextHelpers(reference,calls),/context-helper-source-changed/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('source context calls resolve original React imports and reject shadowed or indirect lookalikes',()=>{
 const text=`import React, {useContext as read} from 'react';import * as R from 'react';
 import {useContext as fake} from 'another-library';import type {useContext as typed} from 'react';
 function Consumer(value){const one=React.useContext(value);const two=R.useContext(value);const three=(read)(value);return [one,two,three];}
 function Shadow(React,R,read){React.useContext(value);R.useContext(value);read(value);}
 const alias=read;alias(value);fake(value);typed(value);React['useContext'](value);read?.(value);React?.useContext(value);read(...values);
 async function Suspends(){React.useContext(await getContext());}
 function* Yields(){React.useContext(yield value);}
 function Evaluation(){React.useContext(eval('var value = context; value'));React.useContext((eval)('value'));}
 `;
 const calls=readReactContextCalls(text,'fixture.tsx',sha(text));assert.equal(calls.length,3);
 assert.deepEqual(calls.map(c=>c.receiver),['default','namespace','bare']);
 assert.deepEqual(calls.map(c=>text.slice(c.call.start,c.call.end)),['React.useContext(value)','R.useContext(value)','(read)(value)']);
 assert(calls.every(c=>c.enclosingFunction&&text.slice(c.enclosingFunction.start,c.enclosingFunction.end).startsWith('function Consumer')));
 assert.deepEqual(calls.map(c=>text.slice(c.binding.start,c.binding.end)),['React, {useContext as read}','* as R','useContext as read']);
 assert.throws(()=>readReactContextCalls(text+' ','fixture.tsx',sha(text)),/context-call-source-changed/);
});

test('rest allocation sites require a standalone native const object-rest declaration',()=>{
 const text=String.raw`function Good(input){const {plain,'ch\u0069ldren':children,...rest}=input;return rest;}
 let {...loose}=input;const {...multiple}=input,other=1;
 for(const {...iteration} of inputs){}
 const {[key]:field,...computed}=input;const {nested:{child},...nested}=input;
 function Parameters({...parameter}){};`;
 const rests=readReactContextRests(text,'fixture.mjs',sha(text));assert.equal(rests.length,1);
 assert.equal(rests[0].name,'rest');assert.deepEqual(rests[0].excluded,['plain','children']);
 assert.equal(text.slice(rests[0].binding.start,rests[0].binding.end),'...rest');
 assert.throws(()=>readReactContextRests(text+' ','fixture.mjs',sha(text)),/context-rest-source-changed/);
});

test('factory call plans require imported jsx identity and safe original render argument boundaries',()=>{
 const root=mkdtempSync(path.join(process.cwd(),'source-reference/.context-factory-plan-'));
 try{
  const text=`import React from 'react';import {jsx as one,jsxs as many} from 'react/jsx-runtime';import {jsx as fake} from 'other';
  export const Root=React.forwardRef(function Render(props,ref){
   one?.('i',{});one(...props.values);one('i',eval('value'));fake('i',{});
   const later=()=>one('i',{});{const one=props.factory;one('i',{});}{const globalThis={};many('i',{});}
   return (many)(props.target,{children:one('span',{})},props.key);
  });`;
  const file=path.join(root,'fixture.mjs');writeFileSync(file,text);const reference={sourceRoot:root,files:{[file]:sha(text)}};
  const target=readReactRuntimeExport(reference,'fixture.mjs',['Root']);assert.equal(target.status,'resolved');if(target.status!=='resolved')return;
  const initializer=readReactTargetInitializer(reference,target.definition),calls=planReactContextFactoryCalls(reference,[initializer]);
  assert.deepEqual(calls.map(c=>text.slice(c.call.start,c.call.end)),["(many)(props.target,{children:one('span',{})},props.key)","one('span',{})"]);
  assert.deepEqual(calls.map(c=>c.factory),['jsxs','jsx']);assert.deepEqual(calls.map(c=>text.slice(c.arguments[0].start,c.arguments[0].end)),['props.target',"'span'"]);
  writeFileSync(file,text+' ');assert.throws(()=>planReactContextFactoryCalls(reference,[initializer]),/context-consumer-source-changed/);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('module binding reads retain original expressions and exclude write references, imports, locals and deferred callbacks',()=>{
 const root=mkdtempSync(path.join(process.cwd(),'source-reference/.context-binding-plan-'));
 try{
  const text=`import React from 'react';import {jsx} from 'react/jsx-runtime';
  var NAME='label';const object={};function state(v){return v?'on':'off';}
  export const Root=React.forwardRef(function Render(props,ref){
   NAME='changed';NAME++;({NAME}=props);const local=props.value;const later=()=>NAME;
   const record={NAME};const type=typeof NAME;object.field=NAME;
   {const NAME='local';void NAME;}
   return jsx('span',{children:state(NAME),record,type,local});
  });`;
  const file=path.join(root,'fixture.mjs');writeFileSync(file,text);const reference={sourceRoot:root,files:{[file]:sha(text)}};
  const target=readReactRuntimeExport(reference,'fixture.mjs',['Root']);assert.equal(target.status,'resolved');if(target.status!=='resolved')return;
  const initializer=readReactTargetInitializer(reference,target.definition),plan=planReactContextBindings(reference,[initializer]);
  assert.deepEqual(plan.reads.map(r=>text.slice(r.read.start,r.read.end)),['NAME','typeof NAME','object','NAME','state','NAME']);
  assert.equal(plan.functions.length,1);assert.equal(plan.functions[0].name,'state');
  assert(plan.reads.every(r=>JSON.stringify(r.consumer)===JSON.stringify(initializer.render)));
  writeFileSync(file,text+' ');assert.throws(()=>planReactContextBindings(reference,[initializer]),/context-binding-source-changed/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
