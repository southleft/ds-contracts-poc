import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {reactStateRuntime} from './react-state-runtime.js';
import {instrumentReactContextAdapter} from './react-context-adapter.js';
import {createReactHelperObserver,reactRuntimeAdapters} from './react-helper-transform.js';
import {reactHelperRuntimeHook,reactHelperRuntimeRead,type ReactHelperRuntimeReport} from './react-helper-runtime.js';
import {prepareReactEffectProgram} from './react-helper-effects.js';
import {modelReactJsxComponent} from './react-helper-model.mjs';
const N={WeakMapCtor:WeakMap,descriptors:Object.getOwnPropertyDescriptors,descriptor:Object.getOwnPropertyDescriptor,prototype:Object.getPrototypeOf,keys:Reflect.ownKeys,apply:Reflect.apply,mapGet:WeakMap.prototype.get,mapSet:WeakMap.prototype.set,is:Object.is};
function runtime(){const ids=new Map<unknown,number>();return Function('return '+reactStateRuntime)()(N,()=>{},(s:string)=>{throw Error(s);},()=>({render:1,consumerCall:2}),(v:unknown)=>{if(v===null||['undefined','boolean','string','number'].includes(typeof v))return {kind:v===null?'null':typeof v,...(v===undefined?{}:{value:v})};if(!ids.has(v))ids.set(v,ids.size);return {kind:typeof v,identity:ids.get(v)};});}
const queue=(value:unknown,reducer:Function)=>({pending:null,lanes:0,dispatch:null as Function|null,lastRenderedReducer:reducer,lastRenderedState:value});

test('native state tuples preserve lazy initialization, original opaque values and stable dispatch across updates',()=>{
 let traps=0;const opaque=new Proxy({}, {get(){traps++;throw Error('get');},ownKeys(){traps++;throw Error('keys');},getOwnPropertyDescriptor(){traps++;throw Error('descriptor');},getPrototypeOf(){traps++;throw Error('prototype');}});
 const api=runtime(),reducer=()=>{},dispatch=()=>{},init=()=>opaque;let frame=api.begin('mount',init);
 const value=api.initialized(init,init(),0);api.initialized(init,'ignored strict replay',1);
 const q=api.queue(queue(value,reducer),value,reducer);q.dispatch=dispatch;const first=[value,dispatch];assert.equal(api.tuple('mount',q,first,reducer),first);assert.equal(api.returned(frame,first),first);api.end(frame);
 for(const phase of ['update','rerender']){frame=api.begin(phase,undefined);q.lastRenderedState=phase;const next=[phase,dispatch];assert.equal(api.tuple(phase,q,next,reducer),next);assert.equal(api.returned(frame,next),next);api.end(frame);}
 const report=api.report();assert.equal(report.queues,1);assert.deepEqual(report.invocations.map((i:any)=>i.phase),['mount','update','rerender']);assert(report.invocations.every((i:any)=>i.tupleVerified&&i.dispatchIdentityVerified&&!i.updateSemanticsVerified&&i.queue===0));
 assert.deepEqual(report.invocations.map((i:any)=>i.initializationVerified),[true,false,false]);assert.equal(report.invocations[0].initializerReturns.length,2);assert.deepEqual(report.invocations[0].value,report.invocations[0].initializerReturns[0]);assert(report.invocations.every((i:any)=>JSON.stringify(i.dispatch)===JSON.stringify(report.invocations[0].dispatch)));assert.equal(traps,0);assert.equal(report.effectsVerified,false);assert.equal(report.acceptedContract,null);
 const thrown=runtime(),f=thrown.begin('mount',()=>{throw opaque;});thrown.thrown(f,opaque);thrown.end(f);assert.equal(thrown.report().invocations[0].completion,'threw');assert.equal(thrown.report().invocations[0].tupleVerified,false);assert.equal(traps,0);
});

test('native state proof refuses unknown queues, changed dispatch and hostile descriptors before extra source reads',()=>{
 let traps=0;const opaque=new Proxy({}, {get(){traps++;throw Error('get');},ownKeys(){traps++;throw Error('keys');},getOwnPropertyDescriptor(){traps++;throw Error('descriptor');},getPrototypeOf(){traps++;throw Error('prototype');}});
 for(const attack of ['unknown','getter','prototype','dispatch','reducer','tuple','return','initial','open']){
  const api=runtime(),r=()=>{},d=()=>{};let frame=api.begin('mount',false);const q=api.queue(queue(false,r),attack==='initial'?true:false,r);q.dispatch=d;const first=[false,d];api.tuple('mount',q,first,r);api.returned(frame,first);api.end(frame);
  frame=api.begin('update',undefined);if(attack==='getter')Object.defineProperty(q,'dispatch',{get(){traps++;return d;}});if(attack==='prototype')Object.setPrototypeOf(q,opaque);if(attack==='dispatch')q.dispatch=()=>{};if(attack==='reducer')q.lastRenderedReducer=()=>{};
  const next=[opaque,d];if(attack==='tuple')Object.defineProperty(next,'0',{get(){traps++;return opaque;}});
  api.tuple('update',attack==='unknown'?opaque:q,next,r);api.returned(frame,attack==='return'?[opaque,d]:next);if(attack!=='open')api.end(frame);assert.throws(()=>api.report(),/state-/,attack);
 }
 assert.equal(traps,0);
});

test('native state adapter requires exact initialization, tuple sites and every original dispatcher branch',()=>{
 const source=readFileSync('node_modules/react-dom/cjs/react-dom-client.development.js','utf8'),output=instrumentReactContextAdapter(source,'forward-ref');
 for(const [name,count] of [['stateBegin',7],['stateTuple',3],['stateQueue',1],['stateInitialized',2]] as const)assert.equal(output.split('.'+name+'(').length-1,count);
 for(const [from,to] of [['initialState = initialStateInitializer();','initialState = otherInitializer();'],['return [initialState.memoizedState, dispatch];','return [initialState.baseState, dispatch];'],['return updateReducer(basicStateReducer);','return updateReducer(otherReducer);'],['return rerenderReducer(basicStateReducer);','return rerenderReducer(otherReducer);']]){
  assert(source.includes(from),from);assert.throws(()=>instrumentReactContextAdapter(source.replace(from,to),'forward-ref'),/state-adapter/,from);
 }
});

test('native state observation preserves browser updates, same-value bailouts, strict replay, render-phase updates and original initializer errors',async t=>{
 const dir=mkdtempSync(path.join(process.cwd(),'source-reference/.native-state-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const files:Record<string,string>={},sha=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
 for(const a of reactRuntimeAdapters){const f=process.cwd()+a.suffix;files[f]=sha(readFileSync(f));}
 const file=path.join(dir,'probe.tsx'),text='export const Probe=(props)=><span/>;',config=path.join(dir,'tsconfig.json'),configText='{"compilerOptions":{"target":"ES2022","module":"ESNext","moduleResolution":"Bundler","jsx":"react-jsx"}}';
 for(const [f,s] of [[file,text],[config,configText]]){writeFileSync(f,s);files[f]=sha(s);}
 const reference={sourceRoot:dir,files,runtimeImports:[]} as unknown as import('./react-reference.js').ReactReference;
 const {program,sf,source,runtimeFiles}=prepareReactEffectProgram(reference,'probe.tsx',{},{});let component:ts.ArrowFunction|undefined;const scan=(n:ts.Node)=>{if(ts.isArrowFunction(n))component=n;ts.forEachChild(n,scan);};scan(sf);assert(component&&ts.isIdentifier(component.parameters[0].name));
 const model=modelReactJsxComponent({program,component,parameter:component.parameters[0].name,properties:[],contentKey:'children',source,runtimeFiles,resolution:[]});assert.equal(model.status,'modeled');if(model.status!=='modeled')return;
 const plan={kind:'jsx-component' as const,models:[model],targets:[],component:model.component};
 const entry=`import {Probe} from './probe.tsx';import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
 window.initializations=0;window.updates=0;window.renders=0;window.caught=[];window.setters=[];window.values=[];
 class Boundary extends React.Component{state={error:false};static getDerivedStateFromError(){return {error:true};}componentDidCatch(error){window.caught.push(error===window.problem);}render(){return this.state.error?React.createElement('span',{id:'failed'},'Caught'):this.props.children;}}
 function Child(){
  const [value,setValue]=React.useState(()=>{window.initializations++;if(window.mode==='throw')throw window.problem;return window.mode==='rerender'?0:window.initializations;});
  const [payload,setPayload]=React.useState(window.opaque);
  const [other,reduce]=React.useReducer(v=>v+1,0);
  window.renders++;window.setters.push(setValue);window.values.push(value);window.setValue=setValue;window.setPayload=setPayload;window.reduce=reduce;
  if(window.mode==='rerender'&&value===0)setValue(1);
  return React.createElement('button',{id:'selected','data-value':value,'data-payload':typeof payload,'data-other':other},'Value '+value);
 }
 const root=createRoot(document.getElementById('root'));window.render=()=>flushSync(()=>root.render(React.createElement(window.mode==='strict'?React.StrictMode:React.Fragment,null,React.createElement(Probe),React.createElement(Boundary,null,React.createElement(Child)))));
 window.step=kind=>flushSync(()=>{if(kind==='add')window.setValue(v=>{window.updates++;return v+2;});if(kind==='same')window.setValue(v=>{window.updates++;return v;});if(kind==='opaque')window.setPayload(window.other);if(kind==='function')window.setPayload(()=>window.originalFunction);if(kind==='reduce')window.reduce();});window.unmount=()=>flushSync(()=>root.unmount());window.render();`;
 const bundles=new Map<boolean,string>();for(const observed of [false,true]){
  const observer=createReactHelperObserver(reference,plan),input=observed?await observer.transform(entry,'react-reference.tsx','tsx'):{contents:entry,loader:'tsx' as const};
  const bundle=await build({stdin:{...input,resolveDir:dir,sourcefile:'react-reference.tsx'},tsconfig:config,bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'guard',setup(b){b.onLoad({filter:/./},a=>a.path in files?observer.transform(readFileSync(a.path,'utf8'),a.path,a.path.endsWith('.tsx')?'tsx':'js'):undefined);}}]:[]});bundles.set(observed,bundle.outputFiles[0].text);if(observed)observer.complete();
 }
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const mode of ['plain','strict','rerender','throw']){
  const pairs=[];
  for(const observed of [false,true]){
   const page=await browser.newPage({viewport:{width:400,height:120}});page.setDefaultTimeout(5000);page.on('pageerror',e=>t.diagnostic(mode+' '+observed+' '+e.message));page.on('console',m=>{if(m.type()==='error')t.diagnostic(mode+' '+observed+' '+m.text());});try{
    await page.setContent('<div id="root"></div>');await page.evaluate(mode=>{const w=window as any;w.mode=mode;w.problem=new Error('initializer');w.traps=0;const handlers={get(){w.traps++;throw Error('get');},ownKeys(){w.traps++;throw Error('keys');},getOwnPropertyDescriptor(){w.traps++;throw Error('descriptor');},getPrototypeOf(){w.traps++;throw Error('prototype');}};w.opaque=new Proxy({},handlers);w.other=new Proxy({},handlers);w.originalFunction=()=>{};if(mode==='throw')Object.defineProperty(Error,'prepareStackTrace',{value:undefined,writable:true,enumerable:true,configurable:true});},mode);
    if(observed)await page.evaluate(reactHelperRuntimeHook([],[model],true));await page.addScriptTag({content:bundles.get(observed)!});await page.locator(mode==='throw'?'#failed':'#selected').waitFor();
    if(mode!=='throw')for(const step of ['add','same','opaque','function','reduce'])await page.evaluate(step=>(window as any).step(step),step);
    if(mode!=='throw')await page.evaluate('window.render()');
    pairs.push({dom:await page.locator('#root').innerHTML(),png:await page.screenshot(),state:await page.evaluate<{initializations:number;updates:number;renders:number;caught:boolean[];values:unknown[];sameSetter:boolean;traps:number}>('({initializations:window.initializations,updates:window.updates,renders:window.renders,caught:window.caught,values:window.values,sameSetter:window.setters.every(s=>s===window.setters[0]),traps:window.traps})')});
    if(observed){
     const rt=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);
     // The existing enclosing-render guard refuses source render exceptions.
     // Preserve that limit while comparing the original error/recovery outcome.
     if(mode==='throw'){assert.equal(rt.status,'refused');if(rt.status==='refused')assert.equal(rt.reason,'helper-runtime-targetInvoke-failed');}
     else {assert.equal(rt.status,'observed',JSON.stringify({mode,rt}));if(rt.status!=='observed')continue;const states=rt.stateHooks!;assert.equal(states.qualification,'native-state-tuples-only');assert.equal(states.effectsVerified,false);assert.equal(states.acceptedContract,null);assert(states.invocations.every(i=>!i.updateSemanticsVerified));assert.equal(states.queues,2);assert(states.invocations.every(i=>i.completion==='returned'&&i.tupleVerified&&i.dispatchIdentityVerified));assert.equal(states.invocations.filter(i=>i.phase==='mount').length,2);assert(states.invocations.some(i=>i.phase==='update'));if(mode==='strict'||mode==='rerender')assert(states.invocations.some(i=>i.phase==='rerender'));const lazy=states.invocations.find(i=>i.phase==='mount'&&i.initialArgument?.kind==='function')!;assert.equal(lazy.initializerReturns.length,mode==='strict'?2:1);assert.deepEqual(lazy.value,lazy.initializerReturns[0]);for(const q of [0,1])assert(states.invocations.filter(i=>i.queue===q).every(i=>JSON.stringify(i.dispatch)===JSON.stringify(states.invocations.find(i=>i.queue===q)!.dispatch)));}
    }
    await page.evaluate('window.unmount()');
   }finally{await page.close();}
  }
  assert.deepEqual(pairs[0],pairs[1],mode);assert.equal(pairs[0].state.traps,0);assert(pairs[0].state.sameSetter);if(mode==='throw')assert.deepEqual(pairs[0].state.caught,[true]);
 }
});
