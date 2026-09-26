import {verifyReactCallbackCreations} from './react-callback-creation.js';
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
import {planReactCallbackSources} from './react-callback-sources.js';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');

for(const kind of ['namespace','default','bare','effectful'] as const)test('native callback lookup authenticates '+kind+' imports before source getters or replacements can run',async t=>{
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
 const nativeImport=kind==='namespace'?"import * as React from 'react';":kind==='default'?"import React from 'react';":"import {useCallback as remember} from 'react';import * as React from 'react';";
 const helperSource=nativeImport+` function merge(...refs){return node=>{const cleanup=refs.map(ref=>typeof ref==='function'?ref(node):ref==null?undefined:(ref.current=node,undefined));return ()=>cleanup.forEach((fn,i)=>typeof fn==='function'?fn():typeof refs[i]==='function'?refs[i](null):refs[i]==null?undefined:refs[i].current=null);};}
 export function useMergedRef(...refs){${kind==='effectful'?'window.helperEffects=(window.helperEffects??0)+1;':''}return ${kind==='bare'?'remember':'React.useCallback'}(merge(...refs),refs);}

 Object.defineProperty(useMergedRef,'name',{value:'customName',configurable:true});window.sourceFunction=useMergedRef;window.NativeReceiver=React;`;
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
 assert.throws(()=>createReactHelperObserver(reference,{...plan,callbackSources:{...plan.callbackSources!,calls:[]}}),/callback-source-plan-changed/);
 const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {Entry} from './fixture.tsx';window.objectRef=React.createRef();const root=createRoot(document.getElementById('root'));window.render=()=>root.render(React.createElement(Entry,{id:'selected',ref:window.objectRef}));window.unmount=()=>root.unmount();window.render();`;
 const bundles=new Map<boolean,string>();let lookup:import('./react-jsx-lookup.js').ReactJsxLookupProof;
 for(const observed of [false,true]){
  const observer=createReactHelperObserver(reference,plan),input=observed?await observer.transform(entry,'react-reference.tsx','tsx'):{contents:entry,loader:'tsx' as const};
  const bundle=await build({stdin:{contents:input.contents,loader:input.loader,resolveDir:dir,sourcefile:'react-reference.tsx'},tsconfig:config,bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'guard',setup(b){b.onLoad({filter:/./},args=>args.path in files?observer.transform(readFileSync(args.path,'utf8'),args.path,args.path.endsWith('.tsx')?'tsx':'js'):undefined);}}]:[]});
  const raw=bundle.outputFiles[0].text,prepared=observed?prepareReactJsxLookupBundle(raw,plan):undefined;
  if(prepared){lookup=prepared.proof;assert.equal(prepared.proof.callbackHookReads?.length,1);assert(prepared.proof.contextImports?.wrappers);assert.throws(()=>prepareReactJsxLookupBundle(raw.replace('get: () => from[key]','get: () => (window.traps++, from[key])'),plan),/context-interop-kernel-changed/);observer.complete();}
  bundles.set(observed,prepared?.javascript??raw);
 }
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const mode of ['stable']){
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
    pairs.push({dom,png,state:await page.evaluate('({metadata:[window.sourceFunction.name,window.sourceFunction.length],helperEffects:window.helperEffects,actions:window.actions,lifecycle:window.lifecycle,ref:window.objectRef.current,dependencyReads:window.dependencyReads,choices:window.selected.map((v,i)=>({new:v===window.candidates[i],previous:i>0&&v===window.selected[i-1]}))})')});
    if(observed){
      const runtime=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(runtime.status,'observed',JSON.stringify(runtime));if(runtime.status!=='observed')continue;
      const verified=verifyReactCallbackCreations(reference,plan,runtime,lookup!);assert.equal(verified.rows.length,3);assert(verified.rows.every(r=>kind==='effectful'?r.status==='refused'&&!r.creationBodyVerified&&r.reason==='callback-creation-body-statements':r.status==='verified'&&r.creationBodyVerified),JSON.stringify(verified));assert.equal(verified.effectsVerified,false);assert.equal(verified.acceptedContract,null);
      if(kind!=='effectful')for(const tamper of ['lookup','callee','capture','hook-result','native-selection','extra-call']){
       const changed=JSON.parse(JSON.stringify(runtime)) as Extract<ReactHelperRuntimeReport,{status:'observed'}>,proof=JSON.parse(JSON.stringify(lookup!));
       if(tamper==='lookup')proof.callbackHookReads=[];
       if(tamper==='callee')proof.contextConsumerCallees=[];
       if(tamper==='capture')changed.callbackSources!.callbacks[0].captures[0].rest=999;
       if(tamper==='hook-result')changed.callbackSources!.hooks[0].value={kind:'function',identity:999};
       if(tamper==='native-selection')changed.callbackMemo!.invocations.find(m=>m.sourceHook===0)!.candidateSource=999;
       if(tamper==='extra-call')changed.callbackSources!.invocations.push({...changed.callbackSources!.invocations[1],id:999});
       const refused=verifyReactCallbackCreations(reference,plan,changed,proof);assert.equal(refused.rows[0].status,'refused',tamper);assert.equal(refused.rows[0].creationBodyVerified,false);
      }
      const origins=runtime.callbackSources!;assert.equal(origins.qualification,'callback-source-and-rest-captures-only');assert.equal(origins.effectsVerified,false);assert.equal(origins.acceptedContract,null);
      assert.equal(origins.invocations.length,6);assert.equal(origins.callbacks.length,3);assert.equal(origins.rests.length,6);assert(origins.invocations.every(i=>i.callVerified));assert(origins.callbacks.every(c=>c.originVerified&&!c.bodyVerified));
      assert.equal(origins.hooks.length,3);for(const hook of origins.hooks){assert(hook.propertyEffectsVerified);assert.equal(hook.completion,'returned');assert.equal(hook.kind,kind==='default'?'native-exports-data':'native-interop-getter');const native:NonNullable<Extract<ReactHelperRuntimeReport,{status:'observed'}>['callbackMemo']>['invocations'][number]=runtime.callbackMemo!.invocations[hook.nativeSelection!];assert.equal(native.sourceHook,hook.id);assert.deepEqual(hook.arguments,[native.candidate,native.dependencies]);assert.deepEqual(hook.value,native.selected);}
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
 for(const attack of ['export-getter','export-replacement','unknown-proxy','unknown-default']){
  const page=await browser.newPage();try{
   const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
   await page.setContent('<div id="root"></div>');await page.evaluate("Object.assign(window,{actions:0,label:'first',selected:[],candidates:[],lifecycle:[],dependencyReads:[],dependencies:[1],traps:0,externalRef:()=>{}})");
   await page.evaluate(reactHelperRuntimeHook([],[model],true,[initializer],[],[],[],[],[],[],plan.contextConsumerCalls,[],undefined,undefined,plan.callbackSources));
   await page.addScriptTag({content:bundles.get(true)!});await page.locator('#selected').waitFor();
   if(attack.startsWith('unknown')){
    await page.evaluate(({attack,key})=>{const w=window as any,value=new Proxy({}, {get(){w.traps++;throw Error('get');},ownKeys(){w.traps++;throw Error('keys');},getPrototypeOf(){w.traps++;throw Error('prototype');},getOwnPropertyDescriptor(){w.traps++;throw Error('descriptor');}});try{if(attack==='unknown-default')w.__DSC_RUNTIME_PROOF.callbackSourceHookDefault(key,value);else w.__DSC_RUNTIME_PROOF.callbackSourceHookRead(key,value,true);}catch{}},{attack,key:JSON.stringify(Object.values(plan.callbackSources!.hooks[0].call))});
   }else{
    const error=page.waitForEvent('pageerror',{timeout:5000});
    await page.evaluate(attack=>{const w=window as any;const ns=w.NativeReceiver,receiver=Object.getOwnPropertyDescriptor(ns,'default')?.value??ns,fn=receiver.useCallback;
     if(attack==='export-getter')Object.defineProperty(receiver,'useCallback',{configurable:true,get(){w.traps++;return fn;}});
     else receiver.useCallback=new Proxy(fn,{apply(){w.traps++;throw Error('apply');},get(){w.traps++;throw Error('get');}});
     w.render();},attack);await error;
   }
   const result=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(result.status,'refused',JSON.stringify({result,errors}));if(result.status==='refused')assert.match(result.reason,/context-hook-(exports-mutated|import-origin-unproved)|native-default-import-origin-unproved/);assert.equal(await page.evaluate('window.traps'),0,attack);
  }finally{await page.close();}
 }
 const native=readFileSync(repo+'/node_modules/react-dom/cjs/react-dom-client.development.js','utf8');
 assert.throws(()=>instrumentReactContextAdapter(native.replace('return prevState[0];','return callback;'),'forward-ref'),/callback-adapter-body-unmatched/);
});
