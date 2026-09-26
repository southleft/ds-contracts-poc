import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {prepareReactEffectProgram} from './react-helper-effects.js';
import {planReactContextCalls} from './react-context-calls.js';
import {modelReactJsxComponent} from './react-helper-model.mjs';
import {readReactRuntimeExport} from './react-runtime-export.js';
import {readReactTargetInitializer} from './react-target-initializer.js';
import {createReactHelperObserver,reactRuntimeAdapters} from './react-helper-transform.js';
import {prepareReactJsxLookupBundle} from './react-jsx-lookup.js';
import {reactHelperRuntimeHook,reactHelperRuntimeRead,type ReactHelperRuntimeReport} from './react-helper-runtime.js';
import type {ReactReference} from './react-reference.js';



const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
test('pinned context transport preserves nested/default providers, updates, opaque values, clicks and refs; tampering refuses',async t=>{
 const repo=process.cwd(),dir=mkdtempSync(path.join(repo,'source-reference/.context-runtime-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const text=`import React from 'react';import {Root} from './targets.mjs';export const Control=React.forwardRef((props,ref)=><Root id={props.id} onClick={props.onClick} label={props.label} ref={ref}/>);`;
 const targetSource=`import React, {useContext as readContext} from 'react';import * as NS from 'react';import {jsx} from 'react/jsx-runtime';
export const Context=React.createContext('default'),Hidden=React.createContext(window.opaque);window.Context=Context;window.NativeNamespace=NS;window.NativeExports=React;const OriginalNativeHook=React.useContext;
export const Root=React.forwardRef(function Reader(props,ref){
 if(window.mode==='tamper-hook')React.useContext=new Proxy(React.useContext,{apply(){window.proxyReads++;throw Error('unknown hook invoked');},get(){window.proxyReads++;throw Error('unknown hook reflected');}});
 if(window.mode==='tamper-export-getter'){Object.defineProperty(React,'useContext',{get(){window.proxyReads++;return OriginalNativeHook;},configurable:true});}
 if(window.mode==='tamper-current')Context._currentValue='stolen';
 if(window.mode==='tamper-accessor'||window.mode==='tamper-use-accessor')Object.defineProperty(Context,'_currentValue',{get(){window.proxyReads++;return 'stolen';},configurable:true});
 const actual=window.mode==='context-proxy'?new Proxy(Context,{get(){window.proxyReads++;throw Error('unknown context reflected');}}):Context;
 const value=window.mode==='tamper-use-accessor'?React.use(actual):React.useContext(actual);readContext(Hidden);
 const again=NS.useContext((window.argOrder.push('context'),Context));if(again!==value)throw Error('context identity changed');
 if(window.mode==='throw')throw window.sentinel;
 return jsx('button',{id:props.id,onClick:props.onClick,ref,children:props.label+':'+value});
});`;
 const file=path.join(dir,'fixture.tsx'),targetFile=path.join(dir,'targets.mjs'),config=path.join(dir,'tsconfig.json'),files:Record<string,string>={};
 for(const [f,s] of [[file,text],[targetFile,targetSource],[config,'{"compilerOptions":{"jsx":"react-jsx","module":"ESNext","target":"ES2022","moduleResolution":"Bundler"}}']]){writeFileSync(f,s);files[f]=sha(s);}
 for(const a of reactRuntimeAdapters){const f=repo+a.suffix;files[f]=sha(readFileSync(f,'utf8'));}
 const reference={sourceRoot:dir,files,runtimeImports:[{importer:file,specifier:'./targets.mjs',file:targetFile}]} as unknown as ReactReference;
 const target=readReactRuntimeExport(reference,'targets.mjs',['Root']);assert.equal(target.status,'resolved');if(target.status!=='resolved')return;const initializer=readReactTargetInitializer(reference,target.definition);
 const {program,sf,source,runtimeFiles}=prepareReactEffectProgram(reference,'fixture.tsx',{},{});let component:ts.ArrowFunction|undefined;
 const find=(n:ts.Node)=>{if(ts.isArrowFunction(n)&&n.parameters.length===2)component=n;ts.forEachChild(n,find);};find(sf);assert(component&&ts.isIdentifier(component.parameters[0].name));
 const model=modelReactJsxComponent({program,component,parameter:component.parameters[0].name,properties:[['id','selected'],['label','Original'],['onClick',{opaque:'function'}]],contentKey:'children',source,runtimeFiles,resolution:reference.runtimeImports,jsxTarget:()=>({file:target.definition.module,sha256:target.definition.sourceSha256,...target.definition.span})});assert.equal(model.status,'modeled');if(model.status!=='modeled')return;
 const plan={kind:'jsx-component' as const,models:[model],component:model.component,targets:[target.definition],initializers:[initializer],contextCalls:planReactContextCalls(reference)};
 assert.equal(plan.contextCalls.length,3);
 assert.throws(()=>createReactHelperObserver(reference,{...plan,contextCalls:[]}),/context-call-plan-changed/);
 const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {Control} from './fixture.tsx';import {Root,Context} from './targets.mjs';
window.clicks=0;const ref=React.createRef();window.testRef=ref;const root=createRoot(document.getElementById('root'));
window.render=suffix=>root.render(React.createElement(React.StrictMode,null,
 React.createElement(Root,{id:'default',label:'Default'}),
 React.createElement(Context.Provider,{value:'outer'+suffix},React.createElement(Root,{id:'outer',label:'Outer'}),
  React.createElement(Context.Provider,{value:'inner'+suffix},React.createElement(Control,{id:'selected',label:'Original',onClick:()=>window.clicks++,ref})),
  React.createElement(Root,{id:'after',label:'After'}))));window.render('1');`;
 const browser=await chromium.launch();t.after(()=>browser.close());const pairs:Record<string,unknown>={};
 const thrown:Record<string,unknown>={};
 for(const mode of ['original','guarded','tamper-current','tamper-accessor','tamper-use-accessor','context-proxy','tamper-hook','tamper-export-getter','throw-before-context-adapter','throw']){
  t.diagnostic(mode);const observed=mode!=='original',activePlan=mode.startsWith('throw')?{...plan,contextCalls:undefined}:plan,observer=createReactHelperObserver(reference,activePlan),input=observed?await observer.transform(entry,'react-reference.tsx','tsx'):{contents:entry,loader:'tsx' as const};
  const bundle=await build({stdin:{contents:input.contents,loader:input.loader,resolveDir:dir,sourcefile:'react-reference.tsx'},tsconfig:config,bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'guard',setup(b){b.onLoad({filter:/./},args=>args.path in files?observer.transform(readFileSync(args.path,'utf8'),args.path,args.path.endsWith('.tsx')?'tsx':'js'):undefined);}}]:[]});
  let javascript=bundle.outputFiles[0].text;
  if(observed){
   const prepared=prepareReactJsxLookupBundle(javascript,plan);assert(prepared.proof.contextImports);assert(prepared.proof.contextImports.wrappers>0);assert.equal(prepared.proof.contextImports.bareHookReads,mode.startsWith('throw')?0:1);
   if(mode==='guarded')for(const [from,to] of [
    ['get: () => from[key]','get: () => (window.getterRan++, from[key])'],
    ['var __getProtoOf = Object.getPrototypeOf;','var __getProtoOf = window.fakePrototype;'],
    ['return to;','return new Proxy(to, {});'],
   ]){assert(javascript.includes(from));assert.throws(()=>prepareReactJsxLookupBundle(javascript.replace(from,to),plan),/context-interop-kernel-changed/);}
   javascript=prepared.javascript;
  }
  if(mode==='throw-before-context-adapter'){
   // Reproduce the pre-context framework guard, retaining the original source
   // and all earlier initializer/renderer checks. This is a diagnostic control.
   javascript=javascript.replace(/globalThis\.__DSC_RUNTIME_PROOF\.contextElement\(type\.type,\s*type\.props,\s*type\)/g,'type')
    .replace(/globalThis\.__DSC_RUNTIME_PROOF\.contextCreated\(defaultValue\)/g,'defaultValue')
    .replace(/globalThis\.__DSC_RUNTIME_PROOF\.context(?:Push|Pop|Read|Access|BeforeRead)\([^;]+\);/g,'');
  }
  const page=await browser.newPage({viewport:{width:600,height:150}}),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));try{
   await page.setContent('<div id="root"></div>');await page.evaluate(mode=>{Object.assign(window,{mode,proxyReads:0,argOrder:[],sentinel:new Error('sentinel-context-failure'),opaque:new Proxy({}, {get(){throw Error('opaque context read');}})});window.addEventListener('error',e=>Object.assign(window,{seenError:e.error}));},mode.startsWith('throw')?'throw':mode);
   if(observed)await page.evaluate(reactHelperRuntimeHook([],[model],true,plan.initializers,[],[],[],activePlan.contextCalls));
   const failure=!['original','guarded'].includes(mode)?page.waitForEvent('pageerror',{timeout:5000}):undefined;await page.addScriptTag({content:javascript});
   if(failure){await failure;const report=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(report.status,'refused',JSON.stringify(report));
    if(report.status==='refused')assert.equal(report.reason,mode.startsWith('throw')?'helper-runtime-targetInvoke-failed':{'tamper-current':'context-read-value-mismatch','tamper-accessor':'context-metadata-changed','tamper-use-accessor':'context-metadata-changed','context-proxy':'context-use-unregistered','tamper-hook':'context-hook-identity-changed','tamper-export-getter':'context-hook-exports-mutated'}[mode]);
    assert.equal(await page.evaluate('window.proxyReads'),0);if(mode.startsWith('throw'))thrown[mode]={errors,report,seen:await page.evaluate('window.seenError?.message')};continue;
   }
   try{await page.locator('#selected').filter({hasText:'Original:inner1'}).waitFor({timeout:5000});}catch{throw Error(JSON.stringify({mode,errors,runtime:observed?await page.evaluate(reactHelperRuntimeRead):null}));}
   await page.evaluate('window.render("2")');await page.locator('#selected').filter({hasText:'Original:inner2'}).waitFor({timeout:5000});await page.locator('#selected').click();
   // Verify click focus, then compare a pointer- and focus-neutral state.
   // Even two uninstrumented renders can differ by one gray level at an
   // adjoining native button border after different initial paint timing.
   // Blurring before capture removes that focus-paint history; retain the
   // click/ref checks and full byte-exact PNG comparison without a tolerance.
   assert.equal(await page.locator('#selected').evaluate(node=>node===document.activeElement),true);
   await page.mouse.move(590,140);
   await page.locator('#selected').evaluate(node=>(node as HTMLElement).blur());
   assert.equal(await page.evaluate(()=>document.activeElement===document.body),true);
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   pairs[mode]={dom:await page.locator('#root').innerHTML(),png:await page.screenshot(),state:await page.evaluate('({clicks:window.clicks,ref:window.testRef.current===document.getElementById("selected"),args:window.argOrder})')};
   if(observed){observer.complete();const report=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(report.status,'observed',JSON.stringify(report));if(report.status!=='observed')continue;
    const contexts=report.contexts;assert(contexts);assert.equal(contexts.qualification,'react-context-transport-only');assert.equal(contexts.effectsVerified,false);assert.equal(contexts.acceptedContract,null);assert.equal(contexts.contexts,2);
    assert.equal(contexts.calls.qualification,'source-use-context-values-only');assert.equal(contexts.calls.effectsVerified,false);assert.equal(contexts.calls.acceptedContract,null);assert.equal(contexts.calls.planned,3);
    assert.equal(contexts.calls.invocations.length,contexts.reads.length);
    for(const call of contexts.calls.invocations){assert.deepEqual(contexts.reads[call.read].call,call.site);assert.deepEqual(call.enclosingFunction,initializer.render);const lookup:typeof contexts.hookLookups.reads[number]=contexts.hookLookups.reads[call.lookup];assert.deepEqual(lookup.site,call.site);assert.equal(lookup.read,call.read);assert.equal(lookup.propertyEffectsVerified,true);}
    assert.equal(contexts.hookLookups.qualification,'native-context-hook-property-reads-only');assert(contexts.hookLookups.interopNamespaces>0);assert(contexts.hookLookups.reads.some(r=>r.kind==='native-exports-data'));assert(contexts.hookLookups.reads.some(r=>r.kind==='native-interop-getter'));
    await page.evaluate('window.__DSC_RUNTIME_READ().contexts.hookLookups.reads[0].propertyEffectsVerified=false');assert.deepEqual(await page.evaluate(reactHelperRuntimeRead),report);
    await page.evaluate('window.__DSC_RUNTIME_READ().contexts.calls.invocations[0].site.start=-1');assert.deepEqual(await page.evaluate(reactHelperRuntimeRead),report);
    const values=contexts.reads.filter(r=>r.consumer?.start===initializer.render.start&&r.value.kind==='string').map(r=>r.value.value);for(const v of ['default','outer1','inner1','outer2','inner2'])assert(values.includes(v),JSON.stringify(values));
    for(const r of contexts.reads)if(r.provider!==null){const provider:typeof contexts.providers[number]=contexts.providers[r.provider];assert.equal(provider.context,r.context);assert.deepEqual(provider.value,r.value);}
    assert(contexts.reads.some(r=>r.provider===null&&r.value.kind==='object'));assert(contexts.providers.length>=4);
    await page.evaluate('window.__DSC_RUNTIME_READ().contexts.reads[0].value.value="forged"');assert.deepEqual(await page.evaluate(reactHelperRuntimeRead),report);
    if(mode==='guarded')for(const dependency of ['__copyProps','__toESM']){
     const probe=await browser.newPage();try{
      const marker='globalThis.__DSC_RUNTIME_PROOF.contextInteropKernel(__toESM,()=>[__create,__defProp,__getOwnPropDesc,__getOwnPropNames,__getProtoOf,__hasOwnProp,__copyProps,__toESM]);';assert(javascript.includes(marker));
      const code=javascript.replace(marker,marker+'eval('+JSON.stringify(dependency+' = new Proxy('+dependency+', {apply(){window.kernelCalls++;throw Error("unexpected kernel execution");}})')+');');
      await probe.setContent('<div id="root"></div>');await probe.evaluate('window.kernelCalls=0;window.mode="guarded";window.argOrder=[];window.opaque={};');await probe.evaluate(reactHelperRuntimeHook([],[model],true,plan.initializers,[],[],[],plan.contextCalls));
      const failed=probe.waitForEvent('pageerror');await probe.addScriptTag({content:code});await failed;
      assert.equal(await probe.evaluate('window.kernelCalls'),0);const result=await probe.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(result.status,'refused');if(result.status==='refused')assert.match(result.reason,dependency==='__copyProps'?/context-interop-kernel-dependency-changed/:/context-interop-kernel-identity-changed/);
     }finally{await probe.close();}
    }
    if(mode==='guarded')for(const attack of ['proxy','prototype','extra-field','native-getter']){
     const probe=await browser.newPage();try{
      await probe.setContent('<div id="root"></div>');await probe.evaluate('window.mode="guarded";window.proxyReads=0;window.argOrder=[];window.opaque={};');await probe.evaluate(reactHelperRuntimeHook([],[model],true,plan.initializers,[],[],[],plan.contextCalls));await probe.addScriptTag({content:javascript});await probe.locator('#selected').waitFor();
      const result=await probe.evaluate(({attack,key})=>{
       const w=window as any;let traps=0,value=w.NativeNamespace;
       if(attack==='proxy')value=new Proxy(value,{get(){traps++;throw Error('proxy get');},getPrototypeOf(){traps++;throw Error('proxy prototype');},ownKeys(){traps++;throw Error('proxy keys');}});
       if(attack==='prototype')Object.setPrototypeOf(value,{});
       if(attack==='extra-field')Object.defineProperty(value,'unexpected',{value:1});
       if(attack==='native-getter'){const fn=w.NativeExports.useContext;Object.defineProperty(w.NativeExports,'useContext',{get(){traps++;return fn;},configurable:true});}
       let reason='';try{w.__DSC_RUNTIME_PROOF.contextHookRead(key,value);}catch(e){reason=(e as Error).message;}return {reason,traps};
      },{attack,key:JSON.stringify([plan.contextCalls[0].call.file,plan.contextCalls[0].call.sha256,plan.contextCalls[0].call.start,plan.contextCalls[0].call.end])});
      assert.equal(result.traps,0);assert.match(result.reason,attack==='proxy'?/context-hook-import-origin-unproved/:attack==='prototype'?/context-hook-import-prototype-changed/:attack==='extra-field'?/context-hook-import-mutated/:/context-hook-exports-mutated/);assert.equal((await probe.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead)).status,'refused');
     }finally{await probe.close();}
    }
    await page.evaluate('window.Context._currentValue="tampered"');const changed=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(changed.status,'refused');if(changed.status==='refused')assert.equal(changed.reason,'context-provider-open-or-mutated');
   }
  }finally{await page.close();}
 }
 assert.deepEqual(pairs.original,pairs.guarded);
 assert.deepEqual(thrown['throw-before-context-adapter'],thrown.throw);
 // Recovery after an original render exception remains unqualified: the
 // pre-existing guard reports a native-intrinsic diagnostic. No admission.
});
