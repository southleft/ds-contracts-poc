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
import {readReactRuntimeExport} from './react-runtime-export.js';
import {readReactTargetInitializer} from './react-target-initializer.js';
import {replanReactTargetEffects} from './react-target-effects.js';
import {rebuildReactTargetCallbackPlan} from './react-target-callback-plan.js';
import {readReactElementSourceCalls} from './react-element-source-call.js';
import {createReactHelperObserver,reactRuntimeAdapters} from './react-helper-transform.js';
import {prepareReactJsxLookupBundle} from './react-jsx-lookup.js';
import {reactHelperRuntimeHook,reactHelperRuntimeRead,type ReactHelperRuntimeReport} from './react-helper-runtime.js';
import type {ReactReference} from './react-reference.js';

const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
test('deferred boundaries retain callback identity, callee order, transient contexts, clicks and refs while rejecting unknown origins',async t=>{
  const repo=process.cwd(),dir=mkdtempSync(path.join(repo,'source-reference/.target-callback-runtime-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const text=`import React from 'react';import {Root} from './targets.mjs';export const Control=React.forwardRef((props,ref)=><Root id={props.id} onClick={props.onClick} ref={ref}><span>{props.label}</span></Root>);`;
  const targetText=`import React from 'react';import {jsx} from 'react/jsx-runtime';
function decorate(value){return value;}
if(window.mode==='fake-return')decorate=value=>({...value});
if(window.mode==='throw')decorate=value=>{throw window.sentinel;};
export function Provider(props){
 let {render}=props;const [shown,setShown]=React.useState(false);React.useLayoutEffect(()=>setShown(true),[]);
 window.actualCallback=render;window.callbackName=render.name;
 if(window.mode==='proxy')render=new Proxy(render,{ownKeys(){window.proxyReads++;return [];},getPrototypeOf(){window.proxyReads++;return null;}});
 if(window.mode==='cross-owner'){window.savedCallback??=render;render=window.savedCallback;}
 if(window.mode==='order')return render({shown,payload:window.payload,changed:(render=()=>{throw Error('replacement must not be called');})});
 const context={shown,payload:window.payload};window.lastContext=context;
 if(window.mode==='getter')Object.defineProperty(context,'shown',{get(){window.proxyReads++;return true;},enumerable:true,configurable:true});
 let output;try{output=render(context);}catch(error){window.seenError=error;throw error;}
 if(window.mode==='mutate-after')context.shown=!context.shown;
 if(window.mode==='fake-provider')return {...output};
 return output;
}
export const Root=React.forwardRef(function Render(props,ref){const {disabled=false,...rest}=props;
 const render=({shown})=>decorate(jsx('button',{...rest,ref,'data-shown':shown}));return jsx(Provider,{disabled,render});});`;
  const file=path.join(dir,'fixture.tsx'),targetFile=path.join(dir,'targets.mjs'),config=path.join(dir,'tsconfig.json'),files:Record<string,string>={};
  for(const [f,s] of [[file,text],[targetFile,targetText],[config,'{"compilerOptions":{"jsx":"react-jsx","module":"ESNext","target":"ES2022","moduleResolution":"Bundler"}}']]){writeFileSync(f,s);files[f]=sha(s);}
  for(const a of reactRuntimeAdapters){const f=repo+a.suffix;files[f]=sha(readFileSync(f,'utf8'));}
  const reference={sourceRoot:dir,files,runtimeImports:[{importer:file,specifier:'./targets.mjs',file:targetFile}]} as unknown as ReactReference;
  const target=readReactRuntimeExport(reference,'targets.mjs',['Root']);assert.equal(target.status,'resolved');if(target.status!=='resolved')return;
  const initializer=readReactTargetInitializer(reference,target.definition),root=replanReactTargetEffects(reference,initializer,{kind:'record',fields:[['id',{kind:'literal',type:'string',value:'selected'}],['onClick',{kind:'input',key:'onClick'}],['children',{kind:'opaque'}]]});
  assert.equal(root.status,'modeled',JSON.stringify(root));if(root.status!=='modeled')return;
  const callback=new Map(root.output.props.fields).get('render');assert(callback?.kind==='callback');assert(root.output.tag.kind==='source-binding');
  const provider=root.output.tag.source;
  const calls=readReactElementSourceCalls(ts.createSourceFile(targetFile,targetText,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),'targets.mjs',sha(targetText));
  const providerCalls=calls.calls.filter(c=>c.functionSpan?.start===provider.start&&targetText.slice(c.span.start,c.span.end).startsWith('render('));assert.equal(providerCalls.length,2);
  const callbackPlans=providerCalls.map(call=>rebuildReactTargetCallbackPlan(reference,[root],{render:root.render,callback:callback.source,provider,
    call:{file:'targets.mjs',sha256:sha(targetText),...call.span},input:{file:'targets.mjs',sha256:sha(targetText),...calls.objects[call.object].span}}));
  const {program,sf,source,runtimeFiles}=prepareReactEffectProgram(reference,'fixture.tsx',{},{});let component:ts.ArrowFunction|undefined;
  const find=(n:ts.Node)=>{if(ts.isArrowFunction(n)&&n.parameters.length===2)component=n;ts.forEachChild(n,find);};find(sf);assert(component&&ts.isIdentifier(component.parameters[0].name));
  const model=modelReactJsxComponent({program,component,parameter:component.parameters[0].name,properties:[['id','selected'],['label','Original'],['onClick',{opaque:'function'}]],contentKey:'children',source,runtimeFiles,resolution:reference.runtimeImports,jsxTarget:()=>({file:target.definition.module,sha256:target.definition.sourceSha256,...target.definition.span})});
  assert.equal(model.status,'modeled');if(model.status!=='modeled')return;
  const base={kind:'jsx-component' as const,models:[model],component:model.component,targets:[target.definition],initializers:[initializer],targetEffects:[root]};
  const forged=structuredClone(callbackPlans[1]);forged.factories=[];assert.throws(()=>createReactHelperObserver(reference,{...base,callbackPlans:[forged]}),/target-callback-plan-changed/);
  const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {Control} from './fixture.tsx';window.clicks=0;const ref=React.createRef();window.testRef=ref;
const control=()=>React.createElement(Control,{id:'selected',label:'Original',onClick:()=>window.clicks++,ref});
createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,window.mode==='cross-owner'?[control(),control()]:control()));`;
  const browser=await chromium.launch();t.after(()=>browser.close());const pairs:Record<string,unknown>={};
  for(const mode of ['original','guarded','order-original','order-guarded','proxy','cross-owner','getter','fake-return','fake-provider','throw','mutate-after']){
    t.diagnostic(mode);
    const observed=!mode.endsWith('original'),order=mode.startsWith('order'),plan={...base,callbackPlans:[callbackPlans[order?0:1]]};
    const observer=createReactHelperObserver(reference,plan),input=observed?await observer.transform(entry,'react-reference.tsx','tsx'):{contents:entry,loader:'tsx' as const};
    const bundle=await build({stdin:{contents:input.contents,loader:input.loader,resolveDir:dir,sourcefile:'react-reference.tsx'},tsconfig:config,bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'guard',setup(b){b.onLoad({filter:/./},args=>args.path in files?observer.transform(readFileSync(args.path,'utf8'),args.path,args.path.endsWith('.tsx')?'tsx':'js'):undefined);}}]:[]});
    const javascript=observed?prepareReactJsxLookupBundle(bundle.outputFiles[0].text,plan).javascript:bundle.outputFiles[0].text;
    const page=await browser.newPage({viewport:{width:350,height:150}});try{
      await page.setContent('<div id="root"></div>');await page.evaluate(mode=>{Object.assign(window,{mode,proxyReads:0,sentinel:new Error('original sentinel'),payload:new Proxy({}, {get(){throw Error('opaque context inspected');}})});},order?'order':mode);
      if(observed)await page.evaluate(reactHelperRuntimeHook([],[model],true,plan.initializers,plan.targetEffects,plan.callbackPlans));
      const positive=['original','guarded','order-original','order-guarded'].includes(mode),failure=!positive&&mode!=='mutate-after'?page.waitForEvent('pageerror',{timeout:5000}):undefined;
      await page.addScriptTag({content:javascript});
      if(failure){
        await failure;const report=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(report.status,'refused',mode);
        const reasons:Record<string,string>={proxy:'target-callback-callee-owner-unproved','cross-owner':'target-callback-callee-owner-unproved',getter:'target-callback-input-mutated','fake-return':'target-callback-return-origin-unproved','fake-provider':'target-callback-provider-return-unregistered',throw:'helper-runtime-targetCallbackInvoke-failed'};
        if(report.status==='refused')assert.equal(report.reason,reasons[mode],mode);
        assert.equal(await page.evaluate('window.proxyReads'),0);if(mode==='throw')assert.equal(await page.evaluate('window.seenError===window.sentinel'),true);continue;
      }
      await page.locator('#selected[data-shown="true"]').waitFor();
      if(mode==='mutate-after'){const report=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(report.status,'refused');if(report.status==='refused')assert.match(report.reason,/target-callback-retained-input-mutated/);continue;}
      await page.locator('#selected').click();pairs[mode]={dom:await page.locator('#selected').evaluate(n=>n.outerHTML),png:await page.screenshot(),state:await page.evaluate('({clicks:window.clicks,ref:window.testRef.current===document.getElementById("selected"),name:window.callbackName})')};
      if(observed){
        observer.complete();const report=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(report.status,'observed',JSON.stringify(report));if(report.status!=='observed')continue;
        assert.equal(report.targetCallbacks?.qualification,'deferred-callback-invocation-boundaries-only');assert.equal(report.targetCallbacks.effectsVerified,false);assert.equal(report.targetCallbacks.acceptedContract,null);
        assert(report.targetCallbacks.providers>1);const values=report.targetCallbacks.invocations.map(i=>new Map(i.input).get('shown')?.value);assert(values.includes(false)&&values.includes(true));
        assert(report.targetCallbacks.invocations.every(i=>i.factories===1&&new Map(i.input).get('payload')?.kind==='object'));
        await page.evaluate('window.__DSC_RUNTIME_READ().targetCallbacks.invocations[0].input[0][1].value="forged"');assert.deepEqual(await page.evaluate(reactHelperRuntimeRead),report);
        if(!order){await page.evaluate('window.lastContext.shown="changed"');const changed=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(changed.status,'refused');}
      }
    }finally{await page.close();}
  }
  assert.deepEqual(pairs.original,pairs.guarded);assert.deepEqual(pairs['order-original'],pairs['order-guarded']);
});
