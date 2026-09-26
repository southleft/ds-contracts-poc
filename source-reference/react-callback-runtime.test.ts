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
import {reactCallbackRuntime} from './react-callback-runtime.js';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');

test('callback selection refuses unknown or mutated native cells and inconsistent selections without probing callback/dependency values',()=>{
 const N={WeakMapCtor:WeakMap,descriptors:Object.getOwnPropertyDescriptors,descriptor:Object.getOwnPropertyDescriptor,prototype:Object.getPrototypeOf,keys:Reflect.ownKeys,apply:Reflect.apply,mapGet:WeakMap.prototype.get,mapSet:WeakMap.prototype.set,is:Object.is};
 let traps=0;const opaque=new Proxy({}, {get(){traps++;throw Error('read');},getOwnPropertyDescriptor(){traps++;throw Error('descriptor');},getPrototypeOf(){traps++;throw Error('prototype');},ownKeys(){traps++;throw Error('keys');}});
 for(const attack of ['unknown-state','state-getter','wrong-choice','wrong-return','unknown-current']){
  const api=Function('return '+reactCallbackRuntime)()(N,()=>{},(s:string)=>{throw Error(s);},()=>({render:0,consumerCall:1}),(v:unknown)=>({kind:typeof v}));
  const old=()=>{},candidate=()=>{},deps=[opaque],state=api.state([old,deps]);api.mount(state,old,deps);
  if(attack==='state-getter')Object.defineProperty(state,'0',{get(){traps++;return old;}});
  const frame=api.begin(candidate,attack==='wrong-choice'?null:deps,attack==='unknown-state'?opaque:state);
  api.compare(frame,true);
  api.returned(frame,attack==='wrong-return'?candidate:old,attack==='unknown-current'?opaque:state,true);api.end(frame);
  assert.throws(()=>api.report(),/callback-(?:previous-state-unregistered|state-mutated|selection-decision-mismatch|reused-value-mismatch|return-unmatched)/,attack);
 }
 assert.equal(traps,0);
});

test('native callback selection preserves unchanged and changed dependencies, ref attachment and cleanup, and original dependency reads',async t=>{
 const repo=process.cwd(),dir=mkdtempSync(path.join(repo,'source-reference/.callback-selection-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const text=`import React from 'react';import {Control} from './targets.mjs';export const Entry=React.forwardRef((props,ref)=><Control id={props.id} ref={ref}/>);`;
 const targetSource=`import * as React from 'react';import {jsx} from 'react/jsx-runtime';
 function merge(...refs){return node=>{const cleanup=refs.map(ref=>typeof ref==='function'?ref(node):ref==null?undefined:(ref.current=node,undefined));return ()=>cleanup.forEach((fn,i)=>typeof fn==='function'?fn():typeof refs[i]==='function'?refs[i](null):refs[i]==null?undefined:refs[i].current=null);};}
 function useMergedRef(...refs){return React.useCallback(merge(...refs),refs);}
 export const Control=React.forwardRef(function Reader(props,ref){
   const merged=useMergedRef(ref,window.externalRef);
   const candidate=()=>window.actions++;window.candidates.push(candidate);
   const selected=React.useCallback(candidate,window.dependencies);window.selected.push(selected);
   return jsx('button',{id:props.id,ref:merged,onClick:selected,children:window.label});
 });`;
 const file=path.join(dir,'fixture.tsx'),targetFile=path.join(dir,'targets.mjs'),config=path.join(dir,'tsconfig.json'),files:Record<string,string>={};
 for(const [f,s] of [[file,text],[targetFile,targetSource],[config,'{"compilerOptions":{"jsx":"react-jsx","module":"ESNext","target":"ES2022","moduleResolution":"Bundler"}}']]){writeFileSync(f,s);files[f]=sha(s);}
 for(const a of reactRuntimeAdapters){const f=repo+a.suffix;files[f]=sha(readFileSync(f,'utf8'));}
 const reference={sourceRoot:dir,files,runtimeImports:[{importer:file,specifier:'./targets.mjs',file:targetFile}]} as unknown as ReactReference;
 const target=readReactRuntimeExport(reference,'targets.mjs',['Control']);assert.equal(target.status,'resolved');if(target.status!=='resolved')return;
 const initializer=readReactTargetInitializer(reference,target.definition),{program,sf,source,runtimeFiles}=prepareReactEffectProgram(reference,'fixture.tsx',{},{});let component:ts.ArrowFunction|undefined;
 const find=(n:ts.Node)=>{if(ts.isArrowFunction(n)&&n.parameters.length===2)component=n;ts.forEachChild(n,find);};find(sf);assert(component&&ts.isIdentifier(component.parameters[0].name));
 const model=modelReactJsxComponent({program,component,parameter:component.parameters[0].name,properties:[['id','selected']],contentKey:'children',source,runtimeFiles,resolution:reference.runtimeImports,jsxTarget:()=>({file:target.definition.module,sha256:target.definition.sourceSha256,...target.definition.span})});assert.equal(model.status,'modeled');if(model.status!=='modeled')return;
 const plan={kind:'jsx-component' as const,models:[model],component:model.component,targets:[target.definition],initializers:[initializer],contextConsumerCalls:planReactContextConsumerCalls(reference,[initializer])};
 const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {Entry} from './fixture.tsx';window.objectRef=React.createRef();const root=createRoot(document.getElementById('root'));window.render=()=>root.render(React.createElement(Entry,{id:'selected',ref:window.objectRef}));window.unmount=()=>root.unmount();window.render();`;
 const bundles=new Map<boolean,string>();
 for(const observed of [false,true]){
  const observer=createReactHelperObserver(reference,plan),input=observed?await observer.transform(entry,'react-reference.tsx','tsx'):{contents:entry,loader:'tsx' as const};
  const bundle=await build({stdin:{contents:input.contents,loader:input.loader,resolveDir:dir,sourcefile:'react-reference.tsx'},tsconfig:config,bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'guard',setup(b){b.onLoad({filter:/./},args=>args.path in files?observer.transform(readFileSync(args.path,'utf8'),args.path,args.path.endsWith('.tsx')?'tsx':'js'):undefined);}}]:[]});
  bundles.set(observed,observed?prepareReactJsxLookupBundle(bundle.outputFiles[0].text,plan).javascript:bundle.outputFiles[0].text);if(observed)observer.complete();
 }
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const mode of ['stable','nan','negative-zero','no-deps','getters','changed-length']){
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
    if(observed)await page.evaluate(reactHelperRuntimeHook([],[model],true,[initializer],[],[],[],[],[],[],plan.contextConsumerCalls));
    await page.addScriptTag({content:bundles.get(observed)!});await page.locator('#selected').filter({hasText:'first'}).waitFor();
    for(const phase of [1,2]){await page.evaluate(phase=>{const w=window as any;w.label='phase'+phase;w.dependencies=w.makeDeps(phase);if(phase===2){w.externalRef=(node:HTMLElement|null)=>{w.lifecycle.push(['new-attach',node?.id??null]);return ()=>w.lifecycle.push(['new-cleanup',node?.id??null]);};}w.render();},phase);await page.locator('#selected').filter({hasText:'phase'+phase}).waitFor();}
    await page.locator('#selected').click();const dom=await page.locator('#root').innerHTML(),png=await page.screenshot();await page.evaluate('window.unmount()');
    pairs.push({dom,png,state:await page.evaluate('({actions:window.actions,lifecycle:window.lifecycle,ref:window.objectRef.current,dependencyReads:window.dependencyReads,choices:window.selected.map((v,i)=>({new:v===window.candidates[i],previous:i>0&&v===window.selected[i-1]}))})')});
    if(observed){
      const runtime=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(runtime.status,'observed',JSON.stringify(runtime));if(runtime.status!=='observed')continue;
      const memo=runtime.callbackMemo!;assert.equal(memo.qualification,'native-callback-selection-only');assert.equal(memo.effectsVerified,false);assert.equal(memo.acceptedContract,null);assert.equal(memo.invocations.length,6);assert(memo.invocations.every(i=>i.selectionVerified&&i.completion==='returned'));
      const merged=memo.invocations.filter(i=>i.consumerCall!==null);assert.equal(merged.length,3);assert.deepEqual(merged.map(i=>i.reused),[false,true,false]);assert(merged.every(i=>i.consumerReturnMatched));
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
