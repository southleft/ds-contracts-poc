import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {transform} from 'esbuild';
import ts from 'typescript';
import {readReactElementCreationSites,reactElementCreationHook} from './react-element-creation.js';
import {readReactElementInvocationPlans,transformReactElementSource,type ReactElementInvocation} from './react-element-invocation.js';

async function compare(body:string,bootstrap='globalThis.window=globalThis'){
  const text=`import {jsx} from 'react/jsx-runtime';\nconst input=value=>(globalThis.__DSC_ELEMENT_CREATION?.literal(value),value);\n${body}`,file='/effects.mjs';
  const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),sites=readReactElementCreationSites(text,file,'effects.mjs'),plans=readReactElementInvocationPlans(sf,sites);
  const observed=transformReactElementSource(sf,sites.map((s,index)=>({...s,index})),plans.map((p,index)=>({...p,index})));
  const results=[];
  for(const instrumented of [false,true]){
    const output=await transform(instrumented?observed:text,{format:'cjs',loader:'js'});
    const owner={},factory=(type:unknown,props:unknown)=>({type,props,_owner:owner});
    const context={require:()=>({jsx:factory}),module:{exports:{}},exports:{}};
    if(bootstrap)runInNewContext(bootstrap,context);
    if(instrumented){runInNewContext(reactElementCreationHook(sites,plans),context);runInNewContext('__DSC_ELEMENT_CREATION.register(require().jsx,require().jsx)',context);}
    // The inputs are ECMAScript modules, whose assignments are strict.
    runInNewContext(`'use strict';\n${output.code}`,context);
    results.push({result:JSON.parse(runInNewContext('JSON.stringify(result)',context)),
      ...(instrumented?{records:JSON.parse(runInNewContext('JSON.stringify(elements.map(e=>__DSC_ELEMENT_CREATION.readInvocation({memoizedProps:e.props,type:e.type,_debugOwner:e._owner})))',context)) as ReactElementInvocation[]}:{}),
    });
  }
  assert.deepEqual(results[0].result,results[1].result);
  return {result:results[0].result,records:results[1].records!.map(r=>{assert.equal(r.status,'observed');if(r.status!=='observed')throw Error('invocation refused');return r;})};
}

test('native registry call and symbol data write are guarded in each invocation without named marker exemptions',async()=>{
  const run=await compare(`const C=props=>{if(typeof window!=='undefined')window[Symbol.for(props.marker)]=props.value;return jsx('button',{...props});};
const one=C(input({children:'one',marker:'arbitrary-first',value:true})),two=C(input({children:'two',marker:'arbitrary-second',value:4}));
globalThis.elements=[one,two];globalThis.result=[window[Symbol.for('arbitrary-first')],window[Symbol.for('arbitrary-second')]];`);
  assert.deepEqual(run.result,[true,4]);
  for(const record of run.records){
    assert(record.globalReads.every(r=>r.status==='verified'));
    assert.deepEqual(record.effects.map(e=>e.status==='verified'?e.kind:e.reason),['symbol-for','global-symbol-data-write']);
    assert.equal(record.effectsVerified,false);assert.equal(record.acceptedContract,null);
  }
});

test('a getter returning the original Symbol.for and a replaced native binding both refuse without extra getter calls',async()=>{
  for(const change of [
    `Object.defineProperty(Symbol,'for',{configurable:true,get(){reads++;return original;}});`,
    `Symbol.for=function(value){reads++;return original(value);};`,
    `const realmForTest=globalThis;Object.defineProperty(realmForTest,'Symbol',{configurable:true,get(){reads++;return originalConstructor;}});`,
  ]){
    const run=await compare(`const original=Symbol.for,originalConstructor=Symbol;let reads=0;${change}
const C=props=>{window[Symbol.for('changed-native')]=true;return jsx('button',{...props});};
const element=C(input({children:'kept'}));globalThis.elements=[element];globalThis.result={reads,value:window[original('changed-native')]};`);
    assert.deepEqual(run.result,{reads:1,value:true});
    assert(run.records[0].globalReads.some(r=>r.status==='refused'));
    assert(run.records[0].effects.every(e=>e.status==='refused'));
  }
});

test('an inherited getter introduced for an initially absent global cannot produce verified lookup evidence',async()=>{
  const run=await compare(`let reads=0;Object.setPrototypeOf(globalThis,{get window(){reads++;return undefined;}});
const C=props=>{const value=typeof window;return jsx('button',{...props,value});};
const element=C(input({children:'kept'}));globalThis.elements=[element];globalThis.result={reads,value:element.props.value};`,'');
  assert.deepEqual(run.result,{reads:1,value:'undefined'});
  assert(run.records[0].globalReads.some(r=>r.status==='refused'&&r.reason==='element-global-binding-changed:window'));
});

test('own and inherited accessors are never classified as data writes or inspected by running getters',async()=>{
  for(const target of ['globalThis','Object.getPrototypeOf(globalThis)']){
    const run=await compare(`let sets=0,gets=0;Object.defineProperty(${target},Symbol.for('accessor'),{configurable:true,get(){gets++;return true;},set(value){sets++;}});
const C=props=>{window[Symbol.for('accessor')]=true;return jsx('button',{...props});};
const element=C(input({children:'kept'}));globalThis.elements=[element];globalThis.result={sets,gets};`);
    assert.deepEqual(run.result,{sets:1,gets:0});
    assert.equal(run.records[0].effects[0].status,'verified');
    const write=run.records[0].effects[1];assert.equal(write.status,'refused');
    if(write.status==='refused')assert.equal(write.reason,'element-global-write-not-writable-data');
  }
});

test('unknown receivers execute once without observer descriptor traps and preserve thrown object identity',async()=>{
  const run=await compare(`let sets=0,descriptors=0,caught=false;const expected={};
const receiver=new Proxy(globalThis,{getOwnPropertyDescriptor(target,key){descriptors++;return Reflect.getOwnPropertyDescriptor(target,key);},set(){sets++;throw expected;}});
const C=props=>{try{receiver[Symbol.for('proxy')]=true;}catch(error){caught=error===expected;}return jsx('button',{...props});};
const element=C(input({children:'kept'}));globalThis.elements=[element];globalThis.result={sets,descriptors,caught};`);
  assert.deepEqual(run.result,{sets:1,descriptors:0,caught:true});
  assert(run.records[0].effects.some(e=>e.status==='refused'&&e.reason==='element-global-write-receiver-unproved'));
});

test('computed-key coercion retains original timing and a RHS-installed setter is rechecked',async()=>{
  const order=await compare(`const order=[];const key={[Symbol.toPrimitive](){order.push('key');return 'ordinary';}},target={};
const C=props=>{target[key]=(order.push('rhs'),true);return jsx('button',{...props});};
const element=C(input({children:'kept'}));globalThis.elements=[element];globalThis.result={order,value:target.ordinary};`);
  assert.deepEqual(order.result,{order:['rhs','key'],value:true});
  const changed=await compare(`let sets=0;const install=()=>{Object.defineProperty(window,Symbol.for('rhs'),{configurable:true,set(){sets++;}});return true;};
const C=props=>{window[Symbol.for('rhs')]=install();return jsx('button',{...props});};
const element=C(input({children:'kept'}));globalThis.elements=[element];globalThis.result={sets};`);
  assert.deepEqual(changed.result,{sets:1});
  assert(changed.records[0].effects.some(e=>e.status==='refused'&&e.reason==='element-global-write-not-writable-data'));
});

test('guards refuse object values escaping to a global while preserving the original value',async()=>{
  const run=await compare(`const C=props=>{window[Symbol.for('object-value')]=props.children;return jsx('button',{...props});};
const child={};const element=C(input({children:child}));globalThis.elements=[element];globalThis.result=window[Symbol.for('object-value')]===child;`);
  assert.equal(run.result,true);
  assert(run.records[0].effects.some(e=>e.status==='refused'&&e.reason==='element-write-value-not-primitive'));
});
