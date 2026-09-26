import {planReactCallbackFactories} from './react-callback-factories.js';
import {planReactEffectHooks} from './react-effect-hooks.js';
import {planReactRefHooks} from './react-ref-hooks.js';
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
import {prepareReactJsxLookupBundle,type ReactJsxLookupProof} from './react-jsx-lookup.js';
import {reactHelperRuntimeHook,reactHelperRuntimeRead,type ReactHelperRuntimeReport} from './react-helper-runtime.js';
import {verifyReactContextConsumers} from './react-context-verification.js';
import {planReactCallbackSources} from './react-callback-sources.js';
import type {ReactReference} from './react-reference.js';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');

for(const [callbackMode,refMode,effectMode,factoryMode] of [[false,'none','none'],[true,'none','none'],[true,'namespace','none'],[true,'default','none'],[true,'bare','none'],[true,'namespace','namespace'],[true,'default','default'],[true,'bare','bare'],[true,'namespace','namespace','named-default'],[true,'namespace','namespace','named-supplied'],[true,'namespace','namespace','plain']] as const)test('consumer verifier joins original context/helper/binding/factory evidence with deferred callback '+callbackMode+' and ref '+refMode+' and effects '+effectMode+' and factory '+factoryMode,async t=>{
 const repo=process.cwd(),dir=mkdtempSync(path.join(repo,'source-reference/.context-verification-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const text=`import React from 'react';import {Indicator} from './targets.mjs';export const Control=React.forwardRef((props,ref)=><Indicator id={props.id} onClick={props.onClick} ref={ref}/>);`;
 const refExpression=refMode==='bare'?'rememberRef':refMode==='default'?'ReactDefault.useRef':'React.useRef';
 const effectExpressions=effectMode==='bare'?['passive','layout','insertion']:['useEffect','useLayoutEffect','useInsertionEffect'].map(h=>(effectMode==='default'?'ReactDefault.':'React.')+h);
 const effectSource=effectMode==='none'?'':effectExpressions.map((h,i)=>`${h}(()=>{window.effectEvents.push(['create',${i},value.active]);return ()=>window.effectEvents.push(['cleanup',${i},value.active]);},[value.active]);`).join('');
 const factorySource=`${factoryMode?.startsWith('named')?'var define=Object.defineProperty;var nameFn=(fn,label)=>define(fn,"name",{value:label,configurable:true});':''}export function combine(first,second,{check=true}={}){return ${factoryMode?.startsWith('named')?'nameFn(':''}function combined(event){first?.(event);if(check===false||!event.defaultPrevented)return second?.(event);}${factoryMode?.startsWith('named')?',"combined")':''};}`;
 const factorySetup=factoryMode?`let late=value.active;const click=combine(props.onClick,()=>{window.factoryEvents.push(late);late=!late;}${factoryMode==='named-supplied'?',{check:false}':''});late=!late;`:'';
 const targetSource=`import * as React from 'react';import {jsx} from 'react/jsx-runtime';import {Widgets} from './tables.mjs';
 ${factoryMode?"import {combine} from './factories.mjs';":''}
 ${callbackMode?"import {useJoined} from './callbacks.mjs';":''}
 ${refMode==='default'?"import ReactDefault from 'react';":refMode==='bare'?"import {useRef as rememberRef} from 'react';":''}
 ${effectMode==='bare'?"import {useEffect as passive,useLayoutEffect as layout,useInsertionEffect as insertion} from 'react';":''}
 export const Context=React.createContext(null);
 export function Provider(props){const {children,...value}=props;return jsx(Context.Provider,{value,children});}
 function useSelection(name){const value=React.useContext(Context);if(value)return value;throw new Error(name);}
 var NAME='indicator';function label(active){return active?'on':'off';}
 export const Indicator=React.forwardRef(function Reader(props,ref){const value=useSelection(NAME);${callbackMode?'const merged=useJoined(ref,value.secondaryRef);':''}${refMode!=='none'?`const localRef=${refExpression}(value.active);`:''}${effectSource}${factorySetup}return jsx(Widgets.control,{'data-state':label(value.active),payload:value.payload,${refMode!=='none'?'payloadRef:localRef,':''}...props,${factoryMode?'onClick:click,':''}ref:${callbackMode?'merged':'ref'}});});`;
 const tableSource=`import * as React from 'react';import {jsx} from 'react/jsx-runtime';const Node=React.forwardRef((props,ref)=>{window.renderCount++;const {payload,payloadRef,...rest}=props;${refMode!=='none'?'window.savedRef=payloadRef;':''}return jsx('button',{...rest,ref,${refMode!=='none'?"'data-ref':String(payloadRef.current),":''}children:'Control'});});export const Widgets={control:Node};`;
 const factoryFile=path.join(dir,'factories.mjs'),callbackFile=path.join(dir,'callbacks.mjs');
 const callbackSource="import * as React from 'react';function join(...refs){return node=>{for(const ref of refs){if(typeof ref==='function')ref(node);else if(ref)ref.current=node;}};}export function useJoined(...refs){return React.useCallback(join(...refs),refs);}";
 const file=path.join(dir,'fixture.tsx'),targetFile=path.join(dir,'targets.mjs'),tableFile=path.join(dir,'tables.mjs'),config=path.join(dir,'tsconfig.json'),files:Record<string,string>={};
 for(const [f,s] of [[file,text],[targetFile,targetSource],[tableFile,tableSource],[callbackFile,callbackSource],[factoryFile,factorySource],[config,'{"compilerOptions":{"jsx":"react-jsx","module":"ESNext","target":"ES2022","moduleResolution":"Bundler"}}']]){writeFileSync(f,s);files[f]=sha(s);}
 for(const a of reactRuntimeAdapters){const f=repo+a.suffix;files[f]=sha(readFileSync(f,'utf8'));}
 const reference={sourceRoot:dir,files,runtimeImports:[{importer:targetFile,specifier:'./factories.mjs',file:factoryFile},{importer:targetFile,specifier:'./callbacks.mjs',file:callbackFile},{importer:file,specifier:'./targets.mjs',file:targetFile},{importer:targetFile,specifier:'./tables.mjs',file:tableFile}]} as unknown as ReactReference;
 const target=readReactRuntimeExport(reference,'targets.mjs',['Indicator']);assert.equal(target.status,'resolved');if(target.status!=='resolved')return;
 const initializer=readReactTargetInitializer(reference,target.definition),{program,sf,source,runtimeFiles}=prepareReactEffectProgram(reference,'fixture.tsx',{},{});let component:ts.ArrowFunction|undefined;
 const find=(n:ts.Node)=>{if(ts.isArrowFunction(n)&&n.parameters.length===2)component=n;ts.forEachChild(n,find);};find(sf);assert(component&&ts.isIdentifier(component.parameters[0].name));
 const model=modelReactJsxComponent({program,component,parameter:component.parameters[0].name,properties:[['id','selected'],['onClick',{opaque:'function'}]],contentKey:'children',source,runtimeFiles,resolution:reference.runtimeImports,jsxTarget:()=>({file:target.definition.module,sha256:target.definition.sourceSha256,...target.definition.span})});assert.equal(model.status,'modeled');if(model.status!=='modeled')return;
 const calls=planReactContextCalls(reference),initializers=[initializer],factories=planReactContextFactoryCalls(reference,initializers);
 const plan:import('./react-helper-instrument.js').ReactJsxHelperInstrumentationPlan={kind:'jsx-component' as const,models:[model],component:model.component,targets:[target.definition],initializers,contextCalls:calls,contextRests:planReactContextRests(reference,calls),contextHelpers:planReactContextHelpers(reference,calls),contextConsumerCalls:planReactContextConsumerCalls(reference,initializers),contextFactories:factories,contextBindings:planReactContextBindings(reference,initializers),contextTargets:planReactContextTargets(reference,factories)};
 plan.callbackFactories=planReactCallbackFactories(reference,plan.contextConsumerCalls??[]);
 plan.effectHooks=planReactEffectHooks(reference,initializers);
 plan.refHooks=planReactRefHooks(reference,initializers);
 plan.callbackSources=planReactCallbackSources(reference,plan.contextConsumerCalls!,plan.contextHelpers);
 const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {Control} from './fixture.tsx';import {Provider} from './targets.mjs';window.clicks=0;window.factoryEvents=[];window.prevent=false;window.refCalls=[];window.effectEvents=[];window.renderCount=0;window.secondaryRef=node=>window.refCalls.push(node?.id??null);window.testRef=React.createRef();const root=createRoot(document.getElementById('root'));window.render=active=>root.render(React.createElement(Provider,{active,payload:window.opaque,secondaryRef:window.secondaryRef},React.createElement(Control,{id:'selected',onClick:event=>{window.clicks++;if(window.prevent)event.preventDefault();},ref:window.testRef})));window.unmount=()=>root.unmount();window.render(false);`;
 const browser=await chromium.launch();t.after(()=>browser.close());const pairs:unknown[]=[];
 for(const observed of [false,true]){
  const observer=createReactHelperObserver(reference,plan),input=observed?await observer.transform(entry,'react-reference.tsx','tsx'):{contents:entry,loader:'tsx' as const};
  const bundle=await build({stdin:{contents:input.contents,loader:input.loader,resolveDir:dir,sourcefile:'react-reference.tsx'},tsconfig:config,bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'guard',setup(b){b.onLoad({filter:/./},args=>args.path in files?observer.transform(readFileSync(args.path,'utf8'),args.path,args.path.endsWith('.tsx')?'tsx':'js'):undefined);}}]:[]});
  const prepared=observed?prepareReactJsxLookupBundle(bundle.outputFiles[0].text,plan):undefined;if(observed)observer.complete();
  const page=await browser.newPage({viewport:{width:400,height:120}});try{
   await page.setContent('<div id="root"></div>');await page.evaluate(()=>{(window as any).opaque=new Proxy({}, {get(){throw Error('opaque accessed');},ownKeys(){throw Error('opaque reflected');}});});
   if(observed)await page.evaluate(reactHelperRuntimeHook([],[model],true,initializers,[],[],[],calls,plan.contextRests,plan.contextHelpers,plan.contextConsumerCalls,factories,plan.contextBindings,plan.contextTargets,plan.callbackSources,plan.refHooks,plan.effectHooks,plan.callbackFactories));
   await page.addScriptTag({content:prepared?.javascript??bundle.outputFiles[0].text});await page.locator('[data-state="off"]').waitFor();if(effectMode!=='none'){await page.waitForFunction('window.effectEvents.length===3');await page.evaluate('window.render(false)');await page.waitForFunction('window.renderCount===2');await page.waitForTimeout(30);assert.equal(await page.evaluate('window.effectEvents.length'),3);}
   if(refMode!=='none')await page.evaluate('window.savedRef.current="changed"');await page.evaluate('window.render(true)');await page.locator('[data-state="on"]').waitFor();await page.locator('#selected').click();if(factoryMode){await page.evaluate('window.prevent=true');await page.locator('#selected').click();assert.deepEqual(await page.evaluate('window.factoryEvents'),factoryMode==='named-supplied'?[false,true]:[false]);}
   pairs.push({dom:await page.locator('#root').innerHTML(),png:await page.screenshot(),state:await page.evaluate('({clicks:window.clicks,ref:window.testRef.current===document.getElementById("selected"),refCalls:window.refCalls,factoryEvents:window.factoryEvents})')});
   if(effectMode!=='none'){await page.waitForFunction('window.effectEvents.length===9');await page.evaluate('window.unmount()');assert.deepEqual(await page.evaluate('window.effectEvents.filter(e=>e[1]===0)'),[['create',0,false],['cleanup',0,false],['create',0,true],['cleanup',0,true]]);}
   if(!observed)continue;
   const runtime=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(runtime.status,'observed');if(runtime.status!=='observed')continue;
   const proof=prepared!.proof,verified=verifyReactContextConsumers(reference,plan,runtime,proof);
   assert.equal(verified.rows.length,effectMode==='none'?2:3);assert(verified.rows.every(r=>r.status==='verified'),JSON.stringify(verified));assert.equal(verified.effectsVerified,false);assert.equal(verified.acceptedContract,null);assert(verified.rows.every(r=>r.remainingRequirements.length===(callbackMode?5:3)+(refMode!=='none'?1:0)+(effectMode!=='none'?1:0)+(factoryMode?1:0)));
   if(factoryMode){
    const factory=runtime.callbackFactories!;assert.equal(factory.invocations.length,3);assert.equal(factory.callbacks.length,3);assert(factory.invocations.every(f=>f.callVerified&&f.bindingsVerified&&f.bindingPhase==='function-entry'));assert(factory.callbacks.every(c=>c.originVerified&&c.namingVerified&&!c.bodyVerified&&!c.capturesVerified));assert(verified.rows.every(r=>r.factoryCalls.length===1&&r.factoryCalls[0].creationBodyVerified&&!r.factoryCalls[0].callbackBodyVerified&&!r.factoryCalls[0].capturesVerified));
    for(const attack of ['binding','argument','literal','return','origin','order','lookup']){
     const changed=structuredClone(runtime),lookup=structuredClone(proof),f=changed.callbackFactories!,inv=f.invocations[2];
     if(attack==='binding')inv.bindings[2]={kind:'boolean',value:factoryMode==='named-supplied'};
     if(attack==='argument')inv.arguments![0]={kind:'function',identity:99999};
     if(attack==='literal')f.literals.find(l=>l.consumerCall===inv.consumerCall&&l.kind==='function')!.source='wrong';
     if(attack==='return')inv.value={kind:'function',identity:99999};
     if(attack==='origin')f.callbacks[inv.callback!].originVerified=false;
     if(attack==='order')inv.consumerCallsBefore=0;
     if(attack==='lookup')lookup.contextConsumerCallees=[];
     const failed=verifyReactContextConsumers(reference,plan,changed,lookup);assert.equal(failed.rows[2].status,'refused',attack);assert.equal(failed.rows[2].consumerBodyVerified,false,attack);
    }
   }
   if(effectMode!=='none'){
    const effects=runtime.effectHooks!;assert.equal(effects.calls.length,9);assert.equal(effects.effects.length,9);assert.equal(effects.instances,3);assert.equal(effects.executions.length,12);assert(effects.executions.every(e=>!e.bodyVerified));
    assert.deepEqual(effects.effects.map(e=>e.tag),[9,5,3,8,4,2,9,5,3]);
    for(const e of effects.executions.filter(e=>e.kind==='cleanup')){const creation=effects.executions[e.creation!];assert.equal(creation.kind,'create');assert.equal(effects.effects[e.effect].instance,effects.effects[creation.effect].instance);}
    assert(verified.rows.every(r=>r.effectCalls.length===3&&r.effectCalls.every(c=>c.dependenciesVerified&&!c.callbackBodyVerified)));
    for(const attack of ['lookup','dependency','origin','return','native-link','order','ref-order']){
     const changed=structuredClone(runtime),lookup=structuredClone(proof),call=changed.effectHooks!.calls[6];
     if(attack==='lookup')lookup.effectHookReads=[];if(attack==='dependency')call.dependencies[0]={kind:'boolean',value:false};if(attack==='origin')call.callbackOriginVerified=false;
     if(attack==='return')call.value={kind:'boolean',value:true};if(attack==='native-link')call.nativeEffect=0;if(attack==='order')call.consumerCallsBefore=0;if(attack==='ref-order')call.refCallsBefore=0;
     const failed=verifyReactContextConsumers(reference,plan,changed,lookup);assert.equal(failed.rows[2].status,'refused',attack);assert.equal(failed.rows[2].consumerBodyVerified,false,attack);
    }
   }
   if(refMode!=='none'&&effectMode==='none'){
    const refs=runtime.refHooks!;assert.equal(refs.calls.length,2);assert(refs.calls.every(c=>c.propertyEffectsVerified&&c.completion==='returned'));
    const natives=refs.calls.map(c=>refs.invocations[c.nativeInvocation!]);assert.deepEqual(natives.map(n=>n.phase),['mount','update']);
    assert.equal(natives[0].state,natives[1].state);assert.deepEqual(natives[0].value,natives[1].value);
    assert.deepEqual(natives.map(n=>n.initial),[{kind:'boolean',value:false},{kind:'boolean',value:false}]);
    assert.deepEqual(natives.map(n=>n.current),[{kind:'boolean',value:false},{kind:'string',value:'changed'}]);
    assert.deepEqual(refs.calls.map(c=>c.arguments),[[{kind:'boolean',value:false}],[{kind:'boolean',value:true}]]);
    assert(verified.rows.every(r=>r.refCalls.length===1&&r.refCalls[0].argumentVerified&&!r.refCalls[0].mutationEffectsVerified));
    for(const attack of ['lookup','argument','state','return','order','initial']){
     const changed=structuredClone(runtime),lookup=structuredClone(proof),call=changed.refHooks!.calls[1],native=changed.refHooks!.invocations[call.nativeInvocation!];
     if(attack==='lookup')lookup.refHookReads=[];
     if(attack==='argument')call.arguments[0]={kind:'boolean',value:false};
     if(attack==='state')native.state=999;
     if(attack==='return')call.value={kind:'object',identity:999};
     if(attack==='order')call.consumerCallsBefore=0;
     if(attack==='initial')native.initial={kind:'boolean',value:true};
     const failed=verifyReactContextConsumers(reference,plan,changed,lookup);assert.equal(failed.rows[1].status,'refused',attack);assert.equal(failed.rows[1].consumerBodyVerified,false,attack);
    }
   }
   if(callbackMode){
    assert.deepEqual(verified.rows.map(r=>r.callbackCalls.map(c=>c.selectedCallback)),effectMode==='none'?[[0],[0]]:[[0],[0],[0]]);
    assert(verified.rows.every(r=>r.callbackCalls.length===1&&r.callbackCalls[0].argumentsVerified&&!r.callbackCalls[0].callbackBodyVerified));
    const calls=runtime.contexts!.consumerCalls.invocations.filter(c=>plan.callbackSources!.consumers.some(p=>p.call.start===c.site.start));
    for(const kind of ['argument-witness','return-witness','provenance','lookup','extra-creation','earlier-origin']){
     const changed=structuredClone(runtime),lookup=structuredClone(proof),actual=changed.contexts!.consumerCalls.invocations[calls[0].id];
     if(kind==='argument-witness')actual.argumentWitnesses[0]={kind:'object',identity:99999};
     if(kind==='return-witness')actual.returnWitness={kind:'function',identity:99999};
     if(kind==='lookup')lookup.callbackHookReads=[];
     if(kind==='extra-creation')changed.callbackSources!.invocations.push({...changed.callbackSources!.invocations[0],id:99999});
     if(kind==='earlier-origin')changed.callbackSources!.callbacks[0].originVerified=false;
     if(kind==='provenance'){
      actual.argumentWitnesses[0]={kind:'object',identity:99999};
      for(const i of changed.callbackSources!.invocations.filter(i=>i.consumerCall===actual.id))i.arguments![0]={kind:'object',identity:99999};
      for(const rest of changed.callbackSources!.rests.filter(r=>changed.callbackSources!.invocations[r.invocation].consumerCall===actual.id))rest.elements[0]={kind:'object',identity:99999};
     }
     const refused=verifyReactContextConsumers(reference,plan,changed,lookup);assert.equal(refused.rows[0].status,'refused',kind);assert.equal(refused.rows[0].consumerBodyVerified,false,kind);
     if(kind==='provenance')assert.equal(refused.rows[0].reason,'context-consumer-callback-argument-provenance');
    }
   }
   const attacks:Array<[string,(r:Extract<ReactHelperRuntimeReport,{status:'observed'}>,p:ReactJsxLookupProof)=>void]>=[
    ['input',(r)=>{r.targetInitializers!.targets[0].invocations[0].input.fields[0][1]={kind:'string',value:'changed'};}],
    ['output',(r)=>{r.targetInitializers!.targets[0].invocations[0].output.fields[0][1]={kind:'string',value:'changed'};}],
    ['opaque identity',(r)=>{r.targetInitializers!.targets[0].invocations[0].output.fields[1][1].identity=9999;}],
    ['render',(r)=>{r.contexts!.consumerCalls.invocations[0].render=1;}],
    ['missing call',(r)=>{r.contexts!.renders.invocations[0].consumerCalls.pop();}],
    ['extra read',(r)=>{r.contexts!.renders.invocations[0].reads.push(9999);}],
    ['helper return',(r)=>{r.contexts!.helpers.invocations[0].returnSource=null;}],
    ['hook',(r)=>{r.contexts!.hookLookups.reads[0].read=9999;}],
    ['context origin',(r)=>{r.contexts!.providers[0].valueOrigin=9999;}],
    ['binding',(r)=>{r.contexts!.bindings.reads[0].value={kind:'string',value:'other'};}],
    ['function',(r)=>{r.contexts!.consumerCalls.invocations.find(c=>c.calleeRead!==null&&c.helperInvocation===null)!.calleeRead=null;}],
    ['factory',(r)=>{r.contexts!.renders.invocations[0].returnedFactory=9999;}],
    ['target',(r)=>{r.contexts!.targetReads.reads[0].factory=9999;}],
    ['nonlexical',(_r,p)=>{p.contextConsumerCallees=[];}],
   ];
   for(const [name,change] of attacks){const altered=structuredClone(runtime),lookup=structuredClone(proof);change(altered,lookup);const value=verifyReactContextConsumers(reference,plan,altered,lookup);assert.equal(value.rows[0].status,'refused',name);assert.equal(value.rows[0].consumerBodyVerified,false,name);}
   const code=bundle.outputFiles[0].text,tree=ts.createSourceFile('bundle.js',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);let call:ts.CallExpression|undefined;
   const scan=(n:ts.Node)=>{if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='contextConsumerCall')call=n;ts.forEachChild(n,scan);};scan(tree);assert(call);const callee=call.arguments[1];
   const changed=code.slice(0,callee.getStart(tree))+'(window.sideEffect(), '+callee.getText(tree)+')'+code.slice(callee.end),changedProof=prepareReactJsxLookupBundle(changed,plan).proof;
   assert.equal(changedProof.contextConsumerCallees!.length,proof.contextConsumerCallees!.length-1);
   writeFileSync(targetFile,targetSource+' ');assert(verifyReactContextConsumers(reference,plan,runtime,proof).rows.every(r=>r.status==='refused'));writeFileSync(targetFile,targetSource);
   await page.evaluate('window.__DSC_RUNTIME_READ().contexts.targetReads.reads[0].value.identity=9999');assert.deepEqual(await page.evaluate(reactHelperRuntimeRead),runtime);
  }finally{await page.close();}
 }
 assert.deepEqual(pairs[0],pairs[1]);
});
