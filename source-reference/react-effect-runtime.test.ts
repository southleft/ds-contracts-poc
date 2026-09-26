import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {reactEffectRuntime} from './react-effect-runtime.js';
import {instrumentReactContextAdapter} from './react-context-adapter.js';
const N={WeakMapCtor:WeakMap,descriptors:Object.getOwnPropertyDescriptors,descriptor:Object.getOwnPropertyDescriptor,prototype:Object.getPrototypeOf,keys:Reflect.ownKeys,apply:Reflect.apply,mapGet:WeakMap.prototype.get,mapSet:WeakMap.prototype.set,is:Object.is};
const same=(a:PropertyDescriptor,b:PropertyDescriptor)=>['value','get','set','writable','enumerable','configurable'].every(k=>Object.is((a as any)[k],(b as any)[k]));
function runtime(){const ids=new Map<unknown,number>();return Function('return '+reactEffectRuntime)()([],N,()=>{},same,(s:string)=>{throw Error(s);},()=>({render:0,renderSource:null,consumerCalls:0,refCalls:0}),(v:unknown)=>{if(v===null||['undefined','boolean','string','number'].includes(typeof v))return {kind:v===null?'null':typeof v,...(v===undefined?{}:{value:v})};if(!ids.has(v))ids.set(v,ids.size);return {kind:typeof v,identity:ids.get(v)};},{});}

test('effect records preserve cleanup creation across new queue records and retain opaque thrown values',()=>{
 let traps=0;const opaque=new Proxy({}, {get(){traps++;throw Error('get');},ownKeys(){traps++;throw Error('keys');},getPrototypeOf(){traps++;throw Error('prototype');}});
 const api=runtime(),inst={destroy:undefined as unknown},create=()=>cleanup,cleanup=()=>{throw opaque;};
 const first=api.record({tag:9,create,deps:[opaque],inst,next:null});first.next=first;
 let frame=api.createBegin(first);const returned=create();assert.equal(api.returned(frame,returned),cleanup);inst.destroy=returned;api.end(frame);
 const next=api.record({tag:9,create:()=>undefined,deps:[false],inst,next:null});next.next=next;
 const destroy=inst.destroy;inst.destroy=undefined;assert.equal(api.cleanupValue(next,inst,destroy),cleanup);frame=api.cleanupBegin(destroy);
 try{cleanup();}catch(error){assert.equal(error,opaque);api.thrown(frame,error);}finally{api.end(frame);}
 frame=api.createBegin(next);api.thrown(frame,opaque);api.end(frame);
 const report=api.report();assert.equal(report.instances,1);assert.deepEqual(report.executions.map((e:any)=>[e.kind,e.effect,e.creation,e.completion]),[['create',0,null,'returned'],['cleanup',1,0,'threw'],['create',1,null,'threw']]);
 assert.deepEqual(report.executions[1].error,report.executions[2].error);assert(report.executions.every((e:any)=>!e.bodyVerified));assert.equal(report.effectsVerified,false);assert.equal(report.acceptedContract,null);assert.equal(traps,0);
});

test('effect runtime refuses unknown identities and changed native records without opaque traps',()=>{
 let traps=0;const opaque=new Proxy({}, {get(){traps++;throw Error('get');},ownKeys(){traps++;throw Error('keys');},getOwnPropertyDescriptor(){traps++;throw Error('descriptor');},getPrototypeOf(){traps++;throw Error('prototype');}});
 for(const attack of ['unknown-create','unknown-cleanup','changed-create','getter','next','instance','unmatched-cleanup','open']){
  const api=runtime(),inst={destroy:undefined},effect=api.record({tag:9,create:()=>{},deps:[opaque],inst,next:null});effect.next=effect;
  if(attack==='changed-create')effect.create=()=>{};
  if(attack==='getter')Object.defineProperty(effect,'create',{get(){traps++;return ()=>{};}});
  if(attack==='next')effect.next=opaque;
  if(attack==='instance')Object.defineProperty(inst,'destroy',{get(){traps++;return undefined;}});
  if(attack==='unknown-cleanup'){api.cleanupValue(opaque,inst,()=>{});}
  else if(attack==='unmatched-cleanup'){const frame=api.cleanupBegin(()=>{});api.returned(frame,undefined);api.end(frame);}
  else {const frame=api.createBegin(attack==='unknown-create'?opaque:effect);if(attack!=='open'){api.returned(frame,undefined);api.end(frame);}}
  assert.throws(()=>api.report(),/effect-/ ,attack);
 }
 assert.equal(traps,0);
});

test('native effect adapter rejects changed queue allocation, create, destroy and cleanup call sites',()=>{
 const source=readFileSync('node_modules/react-dom/cjs/react-dom-client.development.js','utf8'),result=instrumentReactContextAdapter(source,'forward-ref');
 for(const method of ['effectRecord','effectCreateBegin','effectCleanupValue','effectCleanupBegin'])assert.equal(result.split('.'+method+'(').length-1,1,method);
 for(const [from,to] of [
  ['tag = { tag: tag, create: create, deps: deps, inst: inst, next: null };','tag = { tag: tag, create: create, deps: deps, inst: inst, next: undefined };'],
  ['create = create();','create = otherCreate();'],
  ['destroy();','otherDestroy();'],
  ['callDestroyInDEV,','otherDestroyInDEV,']
 ]){assert(source.includes(from),from);assert.throws(()=>instrumentReactContextAdapter(source.replaceAll(from,to),'forward-ref'),/effect-adapter/,from);}
});

test('native effect instrumentation preserves replay and original errors with stable intrinsics, and refuses changed diagnostic metadata',async t=>{
 const {build}=await import('esbuild'),{chromium}=await import('playwright-core'),{createHash}=await import('node:crypto');
 const {createReactHelperObserver,reactRuntimeAdapters}=await import('./react-helper-transform.js');
 const {reactHelperRuntimeHook,reactHelperRuntimeRead}=await import('./react-helper-runtime.js');
 const files:Record<string,string>={};for(const a of reactRuntimeAdapters){const f=process.cwd()+a.suffix;files[f]=createHash('sha256').update(readFileSync(f)).digest('hex');}
 const dir=mkdtempSync(path.join(process.cwd(),'source-reference/.effect-errors-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const file=path.join(dir,'probe.tsx'),sourceText='export const Probe=(props)=><span/>;';writeFileSync(file,sourceText);files[file]=createHash('sha256').update(sourceText).digest('hex');
 const config=path.join(dir,'tsconfig.json'),configText=JSON.stringify({compilerOptions:{target:'ES2022',module:'ESNext',moduleResolution:'Bundler',jsx:'react-jsx'}});writeFileSync(config,configText);files[config]=createHash('sha256').update(configText).digest('hex');
 const reference={sourceRoot:dir,files,runtimeImports:[]} as unknown as import('./react-reference.js').ReactReference;
 const {prepareReactEffectProgram}=await import('./react-helper-effects.js'),{modelReactJsxComponent}=await import('./react-helper-model.mjs');
 const {program,sf,source,runtimeFiles}=prepareReactEffectProgram(reference,'probe.tsx',{},{});let component:ts.ArrowFunction|undefined;const scan=(n:ts.Node)=>{if(ts.isArrowFunction(n))component=n;ts.forEachChild(n,scan);};scan(sf);assert(component&&ts.isIdentifier(component.parameters[0].name));
 const model=modelReactJsxComponent({program,component,parameter:component.parameters[0].name,properties:[],contentKey:'children',source,runtimeFiles,resolution:[]});assert.equal(model.status,'modeled',JSON.stringify(model));if(model.status!=='modeled')return;
 const entry=`import {Probe} from './probe.tsx';import React from 'react';import {jsx} from 'react/jsx-runtime';import {createRoot} from 'react-dom/client';
 window.events=[];window.problem=new Error('original');window.caught=[];
 class Boundary extends React.Component{state={error:false};static getDerivedStateFromError(){return {error:true};}componentDidCatch(error){window.caught.push(error===window.problem);}render(){return this.state.error?jsx('span',{id:'failed',children:'Caught'}):this.props.children;}}
 function Child(){React.useEffect(()=>{window.events.push('create');if(window.mode==='create')throw window.problem;return ()=>{window.events.push('cleanup');if(window.mode==='cleanup')throw window.problem;};},[]);return React.createElement('button',{id:'selected'},'Ready');}
 const root=createRoot(document.getElementById('root'));window.replace=()=>root.render(React.createElement(React.Fragment,null,React.createElement(Probe),React.createElement(Boundary,null,React.createElement('span',{id:'replaced'},'Replaced'))));window.unmount=()=>root.unmount();root.render(React.createElement(window.mode==='strict'?React.StrictMode:React.Fragment,null,React.createElement(Probe),React.createElement(Boundary,null,React.createElement(Child))));`;
 const plan={kind:'jsx-component' as const,models:[model],targets:[],component:model.component};
 const bundles=new Map<boolean,string>();
 for(const observed of [false,true]){
  const observer=createReactHelperObserver(reference,plan),input=observed?await observer.transform(entry,'react-reference.tsx','tsx'):{contents:entry,loader:'tsx' as const};
  const bundle=await build({stdin:{...input,resolveDir:dir,sourcefile:'react-reference.tsx'},bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'guard',setup(b){b.onLoad({filter:/./},a=>a.path in files?observer.transform(readFileSync(a.path,'utf8'),a.path,a.path.endsWith('.tsx')?'tsx':'js'):undefined);}}]:[]});bundles.set(observed,bundle.outputFiles[0].text);if(observed)observer.complete();
 }
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const scenario of ['strict','create','cleanup','unseeded-create']){
  const mode=scenario==='unseeded-create'?'create':scenario;
  const pairs=[];
  for(const observed of [false,true]){
   const page=await browser.newPage();page.setDefaultTimeout(5000);page.on('pageerror',error=>t.diagnostic(mode+' '+observed+' '+error.message));try{
    await page.setContent('<div id="root"></div>');await page.evaluate(({mode,seed})=>{(window as any).mode=mode;if(seed)Object.defineProperty(Error,'prepareStackTrace',{value:undefined,writable:true,enumerable:true,configurable:true});},{mode,seed:scenario!=='unseeded-create'&&mode!=='strict'});if(observed)await page.evaluate(reactHelperRuntimeHook([],[model],true));
    // Error diagnostics restore this slot by assignment; default absence must
    // still refuse. No production intrinsic guard is relaxed by this fixture.
    const failure=scenario==='unseeded-create'&&observed?page.waitForEvent('pageerror'):undefined;
    await page.addScriptTag({content:bundles.get(observed)!});
    if(failure){assert.match((await failure).message,/helper-native-intrinsic-changed/);const runtime=await page.evaluate<import('./react-helper-runtime.js').ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(runtime.status,'refused');continue;}
    if(mode==='create')await page.locator('#failed').waitFor();
    else {await page.waitForFunction(mode=>(window as any).events.length===(mode==='strict'?3:1),mode);if(mode==='cleanup'){await page.evaluate('window.replace()');await page.locator('#failed').waitFor();}else await page.evaluate('window.unmount()');}
    pairs.push({dom:await page.locator('#root').innerHTML(),state:await page.evaluate('({events:window.events,caught:window.caught})')});
    if(observed){const runtime=await page.evaluate<import('./react-helper-runtime.js').ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(runtime.status,'observed',JSON.stringify(runtime));if(runtime.status==='observed'){const effects=runtime.effectHooks!;assert.equal(effects.executions.length,mode==='strict'?4:mode==='create'?1:2);assert.equal(effects.executions.filter(e=>e.completion==='threw').length,mode==='strict'?0:1);assert(effects.executions.every(e=>!e.bodyVerified));assert.equal(effects.calls.length,0);}}
   }finally{await page.close();}
  }
  if(scenario==='unseeded-create')continue;
  assert.deepEqual(pairs[0],pairs[1],mode);if(mode!=='strict')assert.deepEqual(pairs[1].state,{events:mode==='create'?['create']:['create','cleanup'],caught:[true]});
 }
});
