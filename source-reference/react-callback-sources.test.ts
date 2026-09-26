import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {prepareReactEffectProgram} from './react-helper-effects.js';
import {modelReactJsxComponent} from './react-helper-model.mjs';
import {planReactContextConsumerCalls} from './react-context-calls.js';
import {readReactRuntimeExport} from './react-runtime-export.js';
import {readReactTargetInitializer} from './react-target-initializer.js';
import {createReactHelperObserver,reactRuntimeAdapters} from './react-helper-transform.js';
import {prepareReactJsxLookupBundle} from './react-jsx-lookup.js';
import {reactHelperRuntimeHook,reactHelperRuntimeRead,type ReactHelperRuntimeReport} from './react-helper-runtime.js';
import {instrumentReactContextAdapter} from './react-context-adapter.js';
import type {ReactReference} from './react-reference.js';
import {reactCallbackSourceRuntime} from './react-callback-source-runtime.js';
import {planReactCallbackSources} from './react-callback-sources.js';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');

test('imported callback sources preserve original ref lifecycle and join native reused selections to their original rest captures',async t=>{
 const repo=process.cwd(),dir=mkdtempSync(path.join(repo,'source-reference/.callback-sources-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const text=`import React from 'react';import {Control} from './targets.mjs';export const Entry=React.forwardRef((props,ref)=><Control id={props.id} ref={ref}/>);`;
 const targetSource=`import * as React from 'react';import {jsx} from 'react/jsx-runtime';
 import {joinRef} from './barrel.mjs';
 export const Control=React.forwardRef(function Reader(props,ref){
   const merged=joinRef(ref,window.externalRef);
   const candidate=()=>window.actions++;window.candidates.push(candidate);
   const selected=React.useCallback(candidate,window.dependencies);window.selected.push(selected);
   return jsx('button',{id:props.id,ref:merged,onClick:selected,children:window.label});
 });`;
 const helperSource=`import * as React from 'react'; function merge(...refs){return node=>{const cleanup=refs.map(ref=>typeof ref==='function'?ref(node):ref==null?undefined:(ref.current=node,undefined));return ()=>cleanup.forEach((fn,i)=>typeof fn==='function'?fn():typeof refs[i]==='function'?refs[i](null):refs[i]==null?undefined:refs[i].current=null);};}
 export function useMergedRef(...refs){return React.useCallback(merge(...refs),refs);}

 Object.defineProperty(useMergedRef,'name',{value:'customName',configurable:true});window.sourceFunction=useMergedRef;`;
 const helperFile=path.join(dir,'helpers.mjs'),barrelFile=path.join(dir,'barrel.mjs');
 const file=path.join(dir,'fixture.tsx'),targetFile=path.join(dir,'targets.mjs'),config=path.join(dir,'tsconfig.json'),files:Record<string,string>={};
 for(const [f,s] of [[file,text],[targetFile,targetSource],[helperFile,helperSource],[barrelFile,"export {useMergedRef as joinRef} from './helpers.mjs';"],[config,'{"compilerOptions":{"jsx":"react-jsx","module":"ESNext","target":"ES2022","moduleResolution":"Bundler"}}']]){writeFileSync(f,s);files[f]=sha(s);}
 for(const a of reactRuntimeAdapters){const f=repo+a.suffix;files[f]=sha(readFileSync(f,'utf8'));}
 const reference={sourceRoot:dir,files,runtimeImports:[{importer:file,specifier:'./targets.mjs',file:targetFile},{importer:targetFile,specifier:'./barrel.mjs',file:barrelFile},{importer:barrelFile,specifier:'./helpers.mjs',file:helperFile}]} as unknown as ReactReference;
 const target=readReactRuntimeExport(reference,'targets.mjs',['Control']);assert.equal(target.status,'resolved');if(target.status!=='resolved')return;
 const initializer=readReactTargetInitializer(reference,target.definition),{program,sf,source,runtimeFiles}=prepareReactEffectProgram(reference,'fixture.tsx',{},{});let component:ts.ArrowFunction|undefined;
 const find=(n:ts.Node)=>{if(ts.isArrowFunction(n)&&n.parameters.length===2)component=n;ts.forEachChild(n,find);};find(sf);assert(component&&ts.isIdentifier(component.parameters[0].name));
 const model=modelReactJsxComponent({program,component,parameter:component.parameters[0].name,properties:[['id','selected']],contentKey:'children',source,runtimeFiles,resolution:reference.runtimeImports,jsxTarget:()=>({file:target.definition.module,sha256:target.definition.sourceSha256,...target.definition.span})});assert.equal(model.status,'modeled');if(model.status!=='modeled')return;
 const plan:import('./react-helper-instrument.js').ReactJsxHelperInstrumentationPlan={kind:'jsx-component' as const,models:[model],component:model.component,targets:[target.definition],initializers:[initializer],contextConsumerCalls:planReactContextConsumerCalls(reference,[initializer])};
 plan.callbackSources=planReactCallbackSources(reference,plan.contextConsumerCalls!);
 assert.equal(plan.callbackSources.functions.length,2);assert.equal(plan.callbackSources.callbacks.length,1);assert.equal(plan.callbackSources.consumers.length,1);
 assert.equal(plan.callbackSources.callbacks[0].captures[0].name,'refs');
 for(const mutation of ['refs=[];','({refs}={refs:[]});','[refs]=[[]];',"eval('refs=[]');",'void this;','void arguments;','const escape={method(){return refs;}};']){
  const changed=helperSource.replace('return node=>{','return node=>{'+mutation);writeFileSync(helperFile,changed);
  const altered={...reference,files:{...reference.files,[helperFile]:sha(changed)}};
  assert.equal(planReactCallbackSources(altered,plan.contextConsumerCalls!).callbacks.length,0,mutation);
 }
 const nested=helperSource.replace('return node=>{const cleanup=', 'return node=>()=>{const cleanup=');writeFileSync(helperFile,nested);
 assert.equal(planReactCallbackSources({...reference,files:{...reference.files,[helperFile]:sha(nested)}},plan.contextConsumerCalls!).callbacks.length,1);
 const otherCapture=helperSource.replace('function merge(...refs){return node=>{','function merge(...refs){let hidden=1;return node=>{const escape=()=>hidden;');writeFileSync(helperFile,otherCapture);
 assert.equal(planReactCallbackSources({...reference,files:{...reference.files,[helperFile]:sha(otherCapture)}},plan.contextConsumerCalls!).callbacks.length,0);
 for(const head of ['let hidden=1;return (node=hidden)=>{','return ({value:node})=>{']){
  const changed=helperSource.replace('return node=>{',head);writeFileSync(helperFile,changed);
  assert.equal(planReactCallbackSources({...reference,files:{...reference.files,[helperFile]:sha(changed)}},plan.contextConsumerCalls!).callbacks.length,0);
 }
 const shadow=helperSource.replace('return React.useCallback(merge(...refs),refs);','{ const globalThis={};return React.useCallback(merge(...refs),refs); }');writeFileSync(helperFile,shadow);
 assert.equal(planReactCallbackSources({...reference,files:{...reference.files,[helperFile]:sha(shadow)}},plan.contextConsumerCalls!).functions.length,0);
 writeFileSync(helperFile,helperSource);

 assert.throws(()=>createReactHelperObserver(reference,{...plan,callbackSources:{...plan.callbackSources!,calls:[]}}),/callback-source-plan-changed/);
 const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {Entry} from './fixture.tsx';window.objectRef=React.createRef();const root=createRoot(document.getElementById('root'));window.render=()=>root.render(React.createElement(Entry,{id:'selected',ref:window.objectRef}));window.unmount=()=>root.unmount();window.render();`;
 const bundles=new Map<boolean,string>();
 for(const observed of [false,true]){
  const observer=createReactHelperObserver(reference,plan),input=observed?await observer.transform(entry,'react-reference.tsx','tsx'):{contents:entry,loader:'tsx' as const};
  const bundle=await build({stdin:{contents:input.contents,loader:input.loader,resolveDir:dir,sourcefile:'react-reference.tsx'},tsconfig:config,bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'guard',setup(b){b.onLoad({filter:/./},args=>args.path in files?observer.transform(readFileSync(args.path,'utf8'),args.path,args.path.endsWith('.tsx')?'tsx':'js'):undefined);}}]:[]});
  bundles.set(observed,observed?prepareReactJsxLookupBundle(bundle.outputFiles[0].text,plan).javascript:bundle.outputFiles[0].text);if(observed)observer.complete();
 }
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const mode of ['stable','getters']){
  const pairs:unknown[]=[];
  for(const observed of [false,true]){
   const page=await browser.newPage({viewport:{width:400,height:120}});try{
    await page.setContent('<div id="root"></div>');await page.evaluate(mode=>{
      const w=window as any;Object.assign(w,{mode,actions:0,label:'first',selected:[],candidates:[],lifecycle:[],dependencyReads:[]});
      w.externalRef=(node:HTMLElement|null)=>{w.lifecycle.push(['attach',node?.id??null]);return ()=>w.lifecycle.push(['cleanup',node?.id??null]);};
      w.makeDeps=(phase:number)=>{
       if(mode==='no-deps')return undefined;
       const values=mode==='nan'?[NaN]:mode==='negative-zero'?[phase===2?-0:0]:mode==='changed-length'?(phase===2?[1,2]:[1]):[phase===2?2:1];
       if(mode!=='getters')return values;
       return new Proxy(values,{get(target,key,receiver){w.dependencyReads.push([phase,String(key)]);return Reflect.get(target,key,receiver);}});
      };w.dependencies=w.makeDeps(0);
    },mode);
    if(observed)await page.evaluate(reactHelperRuntimeHook([],[model],true,[initializer],[],[],[],[],[],[],plan.contextConsumerCalls,[],undefined,undefined,plan.callbackSources));
    await page.addScriptTag({content:bundles.get(observed)!});await page.locator('#selected').filter({hasText:'first'}).waitFor();
    for(const phase of [1,2]){await page.evaluate(phase=>{const w=window as any;w.label='phase'+phase;w.dependencies=w.makeDeps(phase);if(phase===2){w.externalRef=(node:HTMLElement|null)=>{w.lifecycle.push(['new-attach',node?.id??null]);return ()=>w.lifecycle.push(['new-cleanup',node?.id??null]);};}w.render();},phase);await page.locator('#selected').filter({hasText:'phase'+phase}).waitFor();}
    await page.locator('#selected').click();const dom=await page.locator('#root').innerHTML(),png=await page.screenshot();await page.evaluate('window.unmount()');
    pairs.push({dom,png,state:await page.evaluate('({metadata:[window.sourceFunction.name,window.sourceFunction.length],actions:window.actions,lifecycle:window.lifecycle,ref:window.objectRef.current,dependencyReads:window.dependencyReads,choices:window.selected.map((v,i)=>({new:v===window.candidates[i],previous:i>0&&v===window.selected[i-1]}))})')});
    if(observed){
      const runtime=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(runtime.status,'observed',JSON.stringify(runtime));if(runtime.status!=='observed')continue;
      const origins=runtime.callbackSources!;assert.equal(origins.qualification,'callback-source-and-rest-captures-only');assert.equal(origins.effectsVerified,false);assert.equal(origins.acceptedContract,null);
      assert.equal(origins.invocations.length,6);assert.equal(origins.callbacks.length,3);assert.equal(origins.rests.length,6);assert(origins.invocations.every(i=>i.callVerified));assert(origins.callbacks.every(c=>c.originVerified&&!c.bodyVerified));
      assert.equal(origins.hooks.length,3);for(const hook of origins.hooks){assert(hook.propertyEffectsVerified);assert.equal(hook.completion,'returned');const native:NonNullable<Extract<ReactHelperRuntimeReport,{status:'observed'}>['callbackMemo']>['invocations'][number]=runtime.callbackMemo!.invocations[hook.nativeSelection!];assert.equal(native.sourceHook,hook.id);assert.deepEqual(hook.arguments,[native.candidate,native.dependencies]);assert.deepEqual(hook.value,native.selected);}
      const memo=runtime.callbackMemo!;assert.equal(memo.qualification,'native-callback-selection-only');assert.equal(memo.effectsVerified,false);assert.equal(memo.acceptedContract,null);assert.equal(memo.invocations.length,6);assert(memo.invocations.every(i=>i.selectionVerified&&i.completion==='returned'));
      const merged=memo.invocations.filter(i=>i.consumerCall!==null);assert.equal(merged.length,3);assert.deepEqual(merged.map(i=>i.reused),[false,true,false]);assert(merged.every(i=>i.consumerReturnMatched));
      assert.deepEqual(merged.map(m=>m.candidateSource),[0,1,2]);assert.deepEqual(merged.map(m=>m.selectedSource),[0,0,2]);
      for(const m of merged){const c=origins.callbacks[m.candidateSource!],rest=origins.rests[c.captures[0].rest],deps=origins.rests[m.dependencyRest!];assert.deepEqual(rest.elements,deps.elements);assert.notEqual(rest.id,deps.id);assert.deepEqual(c.value,m.candidate);assert.deepEqual(origins.callbacks[m.selectedSource!].value,m.selected);}
      const choices=memo.invocations.filter(i=>i.consumerCall===null);assert.deepEqual(choices.map(i=>i.reused),mode==='no-deps'?[false,false,false]:mode==='nan'||mode==='changed-length'?[false,true,true]:[false,true,false]);
      for(const i of memo.invocations){assert.deepEqual(i.selected,i.reused?i.previous:i.candidate);if(i.reused)assert.equal(i.state,i.previousState);}
      await page.evaluate('window.__DSC_RUNTIME_READ().callbackMemo.invocations[0].selected.identity=999999');assert.deepEqual(await page.evaluate(reactHelperRuntimeRead),runtime);
    }
   }finally{await page.close();}
  }
  assert.deepEqual(pairs[0],pairs[1],mode);
 }
 const native=readFileSync(repo+'/node_modules/react-dom/cjs/react-dom-client.development.js','utf8');
 assert.throws(()=>instrumentReactContextAdapter(native.replace('return prevState[0];','return callback;'),'forward-ref'),/callback-adapter-body-unmatched/);
});


test('callback origins refuse substituted captures and mutated rest arrays without probing opaque refs; source throws remain catchable',()=>{
 const point=(start:number)=>({file:'original.mjs',sha256:'a'.repeat(64),start,end:start+1}),key=(start:number)=>JSON.stringify(Object.values(point(start)));
 const plan={consumers:[{call:point(1),source:point(2)}],functions:[{source:point(2),name:'hook',parameters:[{binding:point(3),name:'refs',rest:true}],returns:[point(4)]},{source:point(5),name:'create',parameters:[{binding:point(6),name:'refs',rest:true}],returns:[point(7)]}],calls:[{call:point(8),callee:point(9),caller:point(2),source:point(5)}],callbacks:[{source:point(10),owner:point(5),captures:[{binding:point(6),name:'refs'}],dependencies:[]}]};
 const N={WeakMapCtor:WeakMap,descriptors:Object.getOwnPropertyDescriptors,descriptor:Object.getOwnPropertyDescriptor,prototype:Object.getPrototypeOf,keys:Reflect.ownKeys,apply:Reflect.apply,mapGet:WeakMap.prototype.get,mapSet:WeakMap.prototype.set,is:Object.is};
 const equal=(a:PropertyDescriptor,b:PropertyDescriptor)=>!!a&&!!b&&['value','get','set','writable','enumerable','configurable'].every(k=>Object.is((a as any)[k],(b as any)[k]));
 for(const mode of ['normal','opaque-math','outside-consumer','rest-mutation','rest-getter','capture-copy','capture-proxy','callee-substitution','throw']){
  let traps=0,active:any=null,api:any;
  const opaque=new Proxy(()=>{}, {get(){traps++;throw Error('get');},ownKeys(){traps++;throw Error('keys');},getOwnPropertyDescriptor(){traps++;throw Error('descriptor');},getPrototypeOf(){traps++;throw Error('prototype');}});
  let captured:unknown[],returned:Function;
  function create(...refs:unknown[]){const f=api.begin(key(5),create,[refs]);try{
   if(mode==='throw')throw opaque;
   captured=refs;
   return api.returned(f,key(7),api.callback(key(10),()=>refs,[mode==='capture-copy'?[...refs]:mode==='capture-proxy'?opaque:refs]));
  }finally{api.end(f);}}
  function hook(...refs:unknown[]){const f=api.begin(key(2),hook,[refs]);try{return api.returned(f,key(4),api.call(key(8),mode==='callee-substitution'?()=>opaque:create,()=>[...refs]));}finally{api.end(f);}}
  api=Function('return '+reactCallbackSourceRuntime)()(plan,N,()=>{},equal,(reason:string)=>{throw Error(reason);},()=>active,(v:unknown)=>({kind:typeof v}));
  api.register(key(2),hook);api.register(key(5),create);
  if(mode!=='outside-consumer')active={id:0,key:key(1),render:0,callee:hook,args:[opaque]};
  if(mode==='throw'){let caught;try{hook(opaque);}catch(error){caught=error;}assert.equal(caught,opaque);const r=api.report();assert(r.invocations.every((i:any)=>i.completion==='threw'));assert.equal(traps,0);continue;}
  const math=Object.getOwnPropertyDescriptor(Math,'max')!;
  try{if(mode==='opaque-math')Object.defineProperty(Math,'max',{configurable:true,get(){traps++;throw Error('Math getter');}});returned=hook(opaque);}finally{Object.defineProperty(Math,'max',math);}
  if(mode==='rest-mutation')captured!.push(null);
  if(mode==='rest-getter')Object.defineProperty(captured!,'0',{get(){traps++;throw Error('getter');}});
  if(mode==='normal'||mode==='opaque-math'||mode==='outside-consumer'){
   const r=api.report();assert.equal(r.callbacks.length,1);assert.equal(r.callbacks[0].originVerified,mode!=='outside-consumer');assert.equal(api.origin(returned),0);assert.equal(api.origin(opaque),null);assert.equal(api.rest(opaque),null);
   r.callbacks[0].captures[0].rest=999;assert.notEqual(api.report().callbacks[0].captures[0].rest,999);
  }else assert.throws(()=>api.report(),/callback-source-(rest-mutated|capture-unmatched|call-unmatched)/,mode);
  assert.equal(traps,0,mode);
 }
});
