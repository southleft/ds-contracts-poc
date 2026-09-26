import {planReactHookHelpers} from './react-hook-helpers.js';
import {verifyReactHookHelpers} from './react-hook-helper-verification.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {prepareReactEffectProgram} from './react-helper-effects.js';
import {planReactContextCalls,planReactContextRests,planReactContextHelpers,planReactContextConsumerCalls,planReactContextFactoryCalls,planReactContextBindings,planReactContextTargets} from './react-context-calls.js';
import {modelReactJsxComponent} from './react-helper-model.mjs';
import {readReactRuntimeExport} from './react-runtime-export.js';
import {readReactTargetInitializer} from './react-target-initializer.js';
import {createReactHelperObserver,reactRuntimeAdapters} from './react-helper-transform.js';
import {prepareReactJsxLookupBundle} from './react-jsx-lookup.js';
import {reactHelperRuntimeHook,reactHelperRuntimeRead,type ReactHelperRuntimeReport} from './react-helper-runtime.js';
import {verifyReactContextConsumers} from './react-context-verification.js';
import type {ReactReference} from './react-reference.js';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');

for(const hookMode of ['namespace','default','bare'] as const)test('original hook helper body and native links preserve '+hookMode+' imports and renamed effect aliases',async t=>{
 const repo=process.cwd(),dir=mkdtempSync(path.join(repo,'source-reference/.context-verification-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const text=`import React from 'react';import {Indicator} from './targets.mjs';export const Control=React.forwardRef((props,ref)=><Indicator id={props.id} onClick={props.onClick} ref={ref}/>);`;
 const targetSource=`import {observeValue} from './hooks.mjs';import * as React from 'react';import {jsx} from 'react/jsx-runtime';import {Widgets} from './tables.mjs';
 export const Context=React.createContext(null);
 export function Provider(props){const {children,...value}=props;return jsx(Context.Provider,{value,children});}
 function useSelection(name){const value=React.useContext(Context);if(value)return value;throw new Error(name);}
 var NAME='indicator';function label(active){return active?'on':'off';}
 export const Indicator=React.forwardRef(function Reader(props,ref){const value=useSelection(NAME);const selected=observeValue(value.active);return jsx(Widgets.control,{'data-state':label(value.active),'data-observed':selected,payload:value.payload,...props,ref});});`;
 const tableSource=`import * as React from 'react';import {jsx} from 'react/jsx-runtime';const Node=React.forwardRef((props,ref)=>{const {payload,...rest}=props;return jsx('button',{...rest,ref,children:'Control'});});export const Widgets={control:Node};`;
 const hookFile=path.join(dir,'hooks.mjs'),aliasFile=path.join(dir,'alias.mjs');
 const hookImport=hookMode==='namespace'?"import * as R from 'react';":hookMode==='default'?"import R from 'react';":"import {useState as state} from 'react';";
 const state=hookMode==='bare'?'state':'R.useState';
 const hookSource=`${hookImport}import {synchronize as later} from './alias.mjs';export function observeValue(active){const [selected,setSelected]=${state}(void 0);const [flag,setFlag]=${state}(active);later(()=>{window.hookEvents.push(['create',active,flag]);window.originalSetter=setSelected;return ()=>window.hookEvents.push(['cleanup',active,flag]);},[active,flag,setSelected,setFlag]);return selected;}`;
 const aliasSource="import * as R from 'react';const candidate=globalThis?.document?R.useLayoutEffect:()=>{};export {candidate as synchronize};";
 const file=path.join(dir,'fixture.tsx'),targetFile=path.join(dir,'targets.mjs'),tableFile=path.join(dir,'tables.mjs'),config=path.join(dir,'tsconfig.json'),files:Record<string,string>={};
 for(const [f,s] of [[hookFile,hookSource],[aliasFile,aliasSource],[file,text],[targetFile,targetSource],[tableFile,tableSource],[config,'{"compilerOptions":{"jsx":"react-jsx","module":"ESNext","target":"ES2022","moduleResolution":"Bundler"}}']]){writeFileSync(f,s);files[f]=sha(s);}
 for(const a of reactRuntimeAdapters){const f=repo+a.suffix;files[f]=sha(readFileSync(f,'utf8'));}
 const reference={sourceRoot:dir,files,runtimeImports:[{importer:targetFile,specifier:'./hooks.mjs',file:hookFile},{importer:hookFile,specifier:'./alias.mjs',file:aliasFile},{importer:file,specifier:'./targets.mjs',file:targetFile},{importer:targetFile,specifier:'./tables.mjs',file:tableFile}]} as unknown as ReactReference;
 const target=readReactRuntimeExport(reference,'targets.mjs',['Indicator']);assert.equal(target.status,'resolved');if(target.status!=='resolved')return;
 const initializer=readReactTargetInitializer(reference,target.definition),{program,sf,source,runtimeFiles}=prepareReactEffectProgram(reference,'fixture.tsx',{},{});let component:ts.ArrowFunction|undefined;
 const find=(n:ts.Node)=>{if(ts.isArrowFunction(n)&&n.parameters.length===2)component=n;ts.forEachChild(n,find);};find(sf);assert(component&&ts.isIdentifier(component.parameters[0].name));
 const model=modelReactJsxComponent({program,component,parameter:component.parameters[0].name,properties:[['id','selected'],['onClick',{opaque:'function'}]],contentKey:'children',source,runtimeFiles,resolution:reference.runtimeImports,jsxTarget:()=>({file:target.definition.module,sha256:target.definition.sourceSha256,...target.definition.span})});assert.equal(model.status,'modeled');if(model.status!=='modeled')return;
 const calls=planReactContextCalls(reference),initializers=[initializer],factories=planReactContextFactoryCalls(reference,initializers);
 const plan:import('./react-helper-instrument.js').ReactJsxHelperInstrumentationPlan={kind:'jsx-component' as const,models:[model],component:model.component,targets:[target.definition],initializers,contextCalls:calls,contextRests:planReactContextRests(reference,calls),contextHelpers:planReactContextHelpers(reference,calls),contextConsumerCalls:planReactContextConsumerCalls(reference,initializers),contextFactories:factories,contextBindings:planReactContextBindings(reference,initializers),contextTargets:planReactContextTargets(reference,factories)};
 plan.hookHelpers=planReactHookHelpers(reference,plan.contextConsumerCalls??[]);
 assert.equal(plan.hookHelpers.functions.length,1);assert.equal(plan.hookHelpers.functions[0].hooks.length,3);
 const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {Control} from './fixture.tsx';import {Provider} from './targets.mjs';window.hookEvents=[];window.clicks=0;window.testRef=React.createRef();const root=createRoot(document.getElementById('root'));window.render=active=>root.render(React.createElement(Provider,{active,payload:window.opaque},React.createElement(Control,{id:'selected',onClick:()=>window.clicks++,ref:window.testRef})));window.unmount=()=>root.unmount();window.render(false);`;
 const browser=await chromium.launch();t.after(()=>browser.close());const pairs:unknown[]=[];
 for(const observed of [false,true]){
  const observer=createReactHelperObserver(reference,plan),input=observed?await observer.transform(entry,'react-reference.tsx','tsx'):{contents:entry,loader:'tsx' as const};
  const bundle=await build({stdin:{contents:input.contents,loader:input.loader,resolveDir:dir,sourcefile:'react-reference.tsx'},tsconfig:config,bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'guard',setup(b){b.onLoad({filter:/./},args=>args.path in files?observer.transform(readFileSync(args.path,'utf8'),args.path,args.path.endsWith('.tsx')?'tsx':'js'):undefined);}}]:[]});
  const prepared=observed?prepareReactJsxLookupBundle(bundle.outputFiles[0].text,plan):undefined;if(observed)observer.complete();
  const page=await browser.newPage({viewport:{width:400,height:120}});try{
   await page.setContent('<div id="root"></div>');await page.evaluate(()=>{(window as any).opaque=new Proxy({}, {get(){throw Error('opaque accessed');},ownKeys(){throw Error('opaque reflected');}});});
   if(observed)await page.evaluate(reactHelperRuntimeHook([],[model],true,initializers,[],[],[],calls,plan.contextRests,plan.contextHelpers,plan.contextConsumerCalls,factories,plan.contextBindings,plan.contextTargets,plan.callbackSources,plan.refHooks,plan.effectHooks,plan.callbackFactories,plan.hookHelpers));
   await page.addScriptTag({content:prepared?.javascript??bundle.outputFiles[0].text});await page.locator('[data-state="off"]').waitFor();
   await page.evaluate('window.render(true)');await page.locator('[data-state="on"]').waitFor();await page.locator('#selected').click();
   const dom=await page.locator('#root').innerHTML(),png=await page.screenshot();await page.evaluate('window.unmount()');await page.waitForFunction('window.hookEvents.length===4');
   pairs.push({dom,png,state:await page.evaluate('({clicks:window.clicks,ref:window.testRef.current,hookEvents:window.hookEvents})')});
   if(!observed)continue;
   const runtime=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(runtime.status,'observed');if(runtime.status!=='observed')continue;
   const proof=prepared!.proof,verified=verifyReactContextConsumers(reference,plan,runtime,proof);
   assert.equal(verified.rows.length,2);assert(verified.rows.every(r=>r.status==='verified'&&r.hookCalls.length===1),JSON.stringify(verified));
   const helpers=verifyReactHookHelpers(reference,plan,runtime,proof);assert.equal(helpers.rows.length,2);assert(helpers.rows.every(r=>r.bodyVerified&&r.nativeStates.length===2&&r.nativeEffects.length===1&&!r.stateTransitionsVerified&&!r.effectBodiesVerified&&!r.capturesVerified));
   assert(runtime.hookHelpers!.calls.every(c=>c.completion==='returned'));assert.equal(runtime.hookHelpers!.calls.filter(c=>c.kind==='effect').length,2);
   assert.deepEqual(runtime.hookHelpers!.invocations.map(f=>f.value),[{kind:'undefined'},{kind:'undefined'}]);
   for(const attack of ['argument','binding','return','missing-call','extra-call','call-order','native-link','native-origin','tuple','dispatch','dependencies','callback-origin','alias-kind','lookup','callee','callee-identity','body-source']){
    const changed:Extract<ReactHelperRuntimeReport,{status:'observed'}>=structuredClone(runtime);const lookup=structuredClone(proof),changedPlan=structuredClone(plan),helpers=changed.hookHelpers!,frame=helpers.invocations[1],state=helpers.calls[frame.calls[0]],effect=helpers.calls[frame.calls[2]],native=changed.stateHooks!.invocations[state.native!];
    if(attack==='argument')frame.arguments![0]={kind:'boolean',value:false};if(attack==='binding')frame.bindings[0]={kind:'boolean',value:false};
    if(attack==='return')frame.value={kind:'number',value:1};if(attack==='missing-call')frame.calls.pop();if(attack==='extra-call')frame.calls.push(frame.calls[0]);if(attack==='call-order')frame.calls.reverse();
    if(attack==='native-link')state.native=0;if(attack==='native-origin')native.sourceHook=0;if(attack==='tuple')native.tuple={kind:'object',identity:99999};if(attack==='dispatch')native.dispatch={kind:'function',identity:99999};
    if(attack==='dependencies')effect.dependencies![0]={kind:'boolean',value:false};if(attack==='callback-origin')effect.callbackOriginVerified=false;if(attack==='alias-kind')effect.hook='useInsertionEffect';
    if(attack==='lookup')lookup.helperHookReads=[];if(attack==='callee')lookup.contextConsumerCallees=[];if(attack==='callee-identity')frame.callee={kind:'function',identity:99999};if(attack==='body-source')changedPlan.hookHelpers!.functions[0].result={kind:'null',value:null};
    const refused=verifyReactHookHelpers(reference,changedPlan,changed,lookup);assert.equal(refused.rows[1].status,'refused',attack);
    assert.equal(verifyReactContextConsumers(reference,changedPlan,changed,lookup).rows[1].status,'refused',attack);
   }
  }finally{await page.close();}
 }
 assert.deepEqual(pairs[0],pairs[1]);
});

test('helper planning refuses extra work, eager expressions, shadowed imports and unsupported bindings',t=>{
 const dir=mkdtempSync(path.join(process.cwd(),'source-reference/.hook-plan-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const caller="import {mechanism} from './helper.mjs';export function Caller(arg){return mechanism(arg);}",callerFile=path.join(dir,'caller.mjs'),helperFile=path.join(dir,'helper.mjs');writeFileSync(callerFile,caller);
 const sf=ts.createSourceFile(callerFile,caller,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),fn=sf.statements[1] as ts.FunctionDeclaration,call=(fn.body!.statements[0] as ts.ReturnStatement).expression as ts.CallExpression;
 const point=(n:ts.Node)=>({file:'caller.mjs',sha256:sha(caller),start:n.getStart(sf),end:n.end});
 const consumers=[{call:point(call),callee:point(call.expression),consumer:point(fn),arguments:call.arguments.map(point)}];
 const good="import * as Native from 'react';import {synchronize} from './alias.mjs';export function mechanism(arg){const [state,setState]=Native.useState(arg);synchronize(()=>{},[arg,state,setState]);return state;}";
 const changes=[
  ['return state;','sideEffect();return state;'],['Native.useState(arg)','Native.useState(read())'],['mechanism(arg)','mechanism(arg=read())'],
  ['mechanism(arg)','mechanism(...arg)'],['mechanism(arg)','mechanism({arg})'],['const [state,setState]','const [state=read(),setState]'],
  ['const [state,setState]','let [state,setState]'],['return state;','return state.current;'],['[arg,state,setState]','[...arg]'],
  ['Native.useState(arg)','Native["useState"](arg)'],['mechanism(arg)','mechanism(Native)'],['mechanism(arg)','mechanism(globalThis)'],
  ['()=>{}','()=>eval("arg")'],['return state;','if(arg)return state;return arg;'],['return state;','return absent;'],
 ];
 for(const change of [null,...changes]){
  const text=change?good.replace(change[0],change[1]):good;writeFileSync(helperFile,text);
  const ref={sourceRoot:dir,files:{[callerFile]:sha(caller),[helperFile]:sha(text)},runtimeImports:[{importer:callerFile,specifier:'./helper.mjs',file:helperFile}]} as unknown as ReactReference;
  const plan=planReactHookHelpers(ref,consumers);assert.equal(plan.functions.length,change?0:1,JSON.stringify(change));assert.equal(plan.consumers.length,change?0:1,JSON.stringify(change));
  if(!change){assert.deepEqual(plan.functions[0].hooks[0].initial,{kind:'parameter',index:0});assert.deepEqual(plan.functions[0].result,{kind:'state',index:0,part:0});}
 }
});

test('native alias identification rejects wrappers and hostile lookalikes without invoking or inspecting them',async()=>{
 const {reactContextRuntime}=await import('./react-context-runtime.js');
 const N={WeakMapCtor:WeakMap,descriptors:Object.getOwnPropertyDescriptors,descriptor:Object.getOwnPropertyDescriptor,prototype:Object.getPrototypeOf,keys:Reflect.ownKeys,apply:Reflect.apply,mapGet:WeakMap.prototype.get,mapSet:WeakMap.prototype.set,is:Object.is};
 const same=(a:PropertyDescriptor,b:PropertyDescriptor)=>['value','get','set','writable','enumerable','configurable'].every(k=>Object.is((a as any)[k],(b as any)[k]));
 const context=Function('return '+reactContextRuntime)()(N,()=>{},same,(s:string)=>{throw Error(s);},[],[],[],[],[],()=>{},undefined,undefined,()=>{});
 const useContext=()=>{},useState=()=>{},useEffect=()=>{},useLayoutEffect=()=>{},useInsertionEffect=()=>{};
 context.hook(useContext,{useContext,useState,useEffect,useLayoutEffect,useInsertionEffect});
 const names=['useEffect','useLayoutEffect','useInsertionEffect'];
 for(const [name,fn] of Object.entries({useEffect,useLayoutEffect,useInsertionEffect})){
  const actual=context.nativeHookIdentify(fn,names);assert.equal(actual.name,name);assert.equal(actual.fn,fn);assert.equal(actual.kind,'lexical');
 }
 let traps=0;const hostile=new Proxy(()=>{}, {apply(){traps++;throw Error('called');},get(){traps++;throw Error('get');},ownKeys(){traps++;throw Error('keys');},getPrototypeOf(){traps++;throw Error('prototype');},getOwnPropertyDescriptor(){traps++;throw Error('descriptor');}});
 for(const value of [hostile,()=>useEffect(),useState,undefined,null,{}])assert.throws(()=>context.nativeHookIdentify(value,names),/native-hook-alias-unproved/);
 assert.equal(traps,0);
});
