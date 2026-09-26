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
import {reactRuntimeAdapters,createReactHelperObserver} from './react-helper-transform.js';
import {reactHelperRuntimeHook,reactHelperRuntimeRead,type ReactHelperRuntimeReport} from './react-helper-runtime.js';
import type {ReactReference} from './react-reference.js';
import {readReactRuntimeExport} from './react-runtime-export.js';
import {readReactTargetInitializer} from './react-target-initializer.js';
import {prepareReactJsxLookupBundle} from './react-jsx-lookup.js';
const sha=(text:string)=>createHash('sha256').update(text).digest('hex');

for(const named of [true,false])test('forwardRef initializer and renderer dispatch preserve '+(named?'named':'anonymous')+' source functions and refuse changed identities',async t=>{
 const repo=process.cwd(),dir=mkdtempSync(path.join(repo,'source-reference/.target-initializer-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const file=path.join(dir,'fixture.tsx'),targetFile=path.join(dir,'targets.tsx'),barrelFile=path.join(dir,'barrel.ts'),configFile=path.join(dir,'tsconfig.json');
 const text=`import React from 'react';import {Group as Library} from './barrel.ts';
export const Control=React.forwardRef((props,ref)=><Library.Root id={props.id} onClick={props.onClick} ref={ref}><span>{props.label}</span></Library.Root>);`;
 const body=`{window.bodyCalls=(window.bodyCalls||0)+1;window.lastProps=props;window.lastRef=ref;
const [phase,setPhase]=React.useState(0);if(phase===0)setPhase(1);
const result=<button {...props} ref={ref} data-phase={phase}/>;
if(window.targetMode==='mutate-input')props.id='changed';
if(window.targetMode==='prototype-input')Object.setPrototypeOf(props,{});
if(window.targetMode==='forged-output')return {...result};
if(window.targetMode==='proxy-output')return new Proxy(result,{ownKeys(){window.proxyReads++;return Reflect.ownKeys(result);},getPrototypeOf(){window.proxyReads++;return Object.getPrototypeOf(result);}});
return result;}`;
 const targets=`import React from 'react';var define=Object.defineProperty;var label=(target,value)=>define(target,'name',{value,configurable:true});
window.namingName=label.name;
if(window.badNamer)label=(target,value)=>Object.defineProperty(target,'name',{value,configurable:true});
if(window.badIntrinsic)define=(...args)=>Object.defineProperty(...args);
export let Root=React.forwardRef(${named?`label(function RenderRoot(props,ref)${body},'RenamedRoot')`:`(props,ref)=>${body}`});Root.displayName='RenamedRoot';
export const Other=React.forwardRef((props,ref)=><button {...props} ref={ref}/>);
export function replaceTarget(){Root=Other;}`;
 const barrel="export * as Group from './targets.tsx';",config='{"compilerOptions":{"target":"ES2022","module":"ESNext","moduleResolution":"Bundler","jsx":"react-jsx"}}';
 for(const [f,s] of [[file,text],[targetFile,targets],[barrelFile,barrel],[configFile,config]])writeFileSync(f,s);
 const files:Record<string,string>={[file]:sha(text),[targetFile]:sha(targets),[barrelFile]:sha(barrel),[configFile]:sha(config)};
 for(const adapter of reactRuntimeAdapters){const f=repo+adapter.suffix;files[f]=sha(readFileSync(f,'utf8'));}
 const reference={sourceRoot:dir,files,runtimeImports:[{importer:file,specifier:'./barrel.ts',file:barrelFile},{importer:barrelFile,specifier:'./targets.tsx',file:targetFile}]} as unknown as ReactReference;
 const target=readReactRuntimeExport(reference,'targets.tsx',['Root']);assert.equal(target.status,'resolved');if(target.status!=='resolved')return;
 const initializer=readReactTargetInitializer(reference,target.definition);assert.equal(initializer.naming?.name,named?'RenamedRoot':undefined);assert.equal(initializer.effectsVerified,false);
 if(named)assert.equal(targets.slice(initializer.render.start,initializer.render.start+19),'function RenderRoot');
 const {program,sf,source,runtimeFiles}=prepareReactEffectProgram(reference,'fixture.tsx',{},{});let component:ts.ArrowFunction|undefined;
 const find=(n:ts.Node)=>{if(ts.isArrowFunction(n)&&n.parameters.length===2)component=n;ts.forEachChild(n,find);};find(sf);assert(component&&ts.isIdentifier(component.parameters[0].name));
 const model=modelReactJsxComponent({program,component,parameter:component.parameters[0].name,properties:[['id','selected'],['label','Original'],['onClick',{opaque:'function'}]],contentKey:'children',source,runtimeFiles,resolution:reference.runtimeImports,jsxTarget:()=>({file:target.definition.module,sha256:target.definition.sourceSha256,...target.definition.span})});
 assert.equal(model.status,'modeled');if(model.status!=='modeled')return;
 const plan={kind:'jsx-component' as const,models:[model],component:model.component,targets:[target.definition],initializers:[initializer]};
 const wrong=structuredClone(plan);wrong.initializers[0].render.start++;assert.throws(()=>createReactHelperObserver(reference,wrong),/initializer-plan-changed/);
 const browser=await chromium.launch();t.after(()=>browser.close());const pairs=[];
 for(const mode of ['original','guarded','replace-export','replace-render','badNamer','badIntrinsic','prototype','mutate-input','prototype-input','forged-output','proxy-output'] as const){
  if(!named&&(mode==='badNamer'||mode==='badIntrinsic'))continue;
  const observed=mode!=='original',entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {Control} from './fixture.tsx';import {Root,replaceTarget} from './targets.tsx';
window.clicks=0;window.proxyReads=0;window.targetMode=${JSON.stringify(mode)};window.testRef=React.createRef();const ref=${named?'window.testRef':'node=>{window.testRef.current=node}'};window.testTarget=Root;
${mode==='replace-export'?'replaceTarget();':mode==='replace-render'?"Root.render=(props,ref)=>React.createElement('button',{...props,ref});":mode==='prototype'?'Object.setPrototypeOf(Root.render,{});':''}
createRoot(document.getElementById('root')).render(${named?"React.createElement(React.StrictMode,null,":''}React.createElement(Control,{id:'selected',label:'Original',onClick:()=>window.clicks++,ref})${named?')':''});`;
  const observer=createReactHelperObserver(reference,plan),input=observed?await observer.transform(entry,'react-reference.tsx','tsx'):{contents:entry,loader:'tsx' as const};
  const bundle=await build({stdin:{contents:input.contents,loader:input.loader,resolveDir:dir,sourcefile:'react-reference.tsx'},tsconfig:configFile,bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'guard',setup(b){b.onLoad({filter:/./},args=>args.path in files?observer.transform(readFileSync(args.path,'utf8'),args.path,args.path.endsWith('.tsx')?'tsx':args.path.endsWith('.ts')?'ts':'js'):undefined);}}]:[]});
  const javascript=observed?prepareReactJsxLookupBundle(bundle.outputFiles[0].text,plan).javascript:bundle.outputFiles[0].text;
  const page=await browser.newPage({viewport:{width:350,height:150}});try{
   await page.setContent('<div id="root"></div>');await page.evaluate('window.proxyReads=0');if(observed)await page.evaluate(reactHelperRuntimeHook([],[model],true,plan.initializers));
   if(mode==='badNamer'||mode==='badIntrinsic')await page.evaluate(key=>{(window as unknown as Record<string,boolean>)[key]=true;},mode);
   const failure=mode!=='original'&&mode!=='guarded'?page.waitForEvent('pageerror',{timeout:5000}):undefined;
   await page.addScriptTag({content:javascript});
   if(failure){await failure;assert.equal(await page.evaluate('window.proxyReads'),0);const result=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(result.status,'refused');if(result.status==='refused')assert.match(result.reason,mode==='replace-export'?/target-export-initializer-mismatch/:mode==='replace-render'?/target-initializer-object-changed/:mode==='prototype'?/target-initializer-prototype-changed/:mode==='mutate-input'?/target-input-mutated/:mode==='prototype-input'?/target-input-prototype-changed/:mode==='forged-output'||mode==='proxy-output'?/target-output-provenance-unproved/:/target-naming-call-changed/);continue;}
   await page.locator('#selected').waitFor();await page.locator('#selected').click();
   pairs.push({dom:await page.locator('#selected').evaluate(n=>n.outerHTML),png:await page.screenshot(),state:await page.evaluate('({clicks:window.clicks,ref:window.testRef.current===document.getElementById("selected"),namingName:window.namingName})')});
   if(observed){
    observer.complete();const report=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(report.status,'observed',JSON.stringify(report));if(report.status==='observed'){assert.equal(report.targetInitializers?.targets.length,1);assert.equal(report.targetInitializers?.targets[0].naming,named);assert(report.targetInitializers!.targets[0].dispatches>0);assert.equal(report.targetInitializers!.targets[0].invocations.length,await page.evaluate('window.bodyCalls'));assert(report.targetInitializers!.targets[0].invocations.length>report.targetInitializers!.targets[0].dispatches);assert(report.targetInitializers!.targets[0].invocations.every(i=>i.input.origin==='forward-ref-copy'&&i.input.ref===(named?'object':'function')&&i.output.factory==='jsx'));assert.equal(report.targetInitializers?.effectsVerified,false);assert.equal(report.targetInitializers?.acceptedContract,null);}
    if(report.status==='observed'){
     const invocations=report.targetInitializers!.targets[0].invocations,renders=report.contexts!.renders.invocations;
     assert.equal(new Set(invocations.map(i=>i.input.render)).size,invocations.length);assert.equal(renders.length,invocations.length);
     for(const invocation of invocations){
      assert.equal(invocation.output.render,invocation.input.render);const render=renders[invocation.input.render];assert.deepEqual(render.source,initializer.render);assert.equal(render.completion,'returned');
      assert.deepEqual(new Map(invocation.output.fields).get('ref'),invocation.input.refValue);
     }
     // Render-phase updates use the same input object and produce different
     // outputs. A props-only key must not collapse these two executions.
     const phase=(i:typeof invocations[number])=>new Map(i.output.fields).get('data-phase')?.value;
     assert(invocations.some(a=>phase(a)===0&&invocations.some(b=>b.input.value.identity===a.input.value.identity&&phase(b)===1)));
    }
    assert.deepEqual(await page.evaluate(reactHelperRuntimeRead),report);
    await page.evaluate('window.__DSC_RUNTIME_READ().targetInitializers.targets[0].render.start++;window.__DSC_RUNTIME_READ().targetInitializers.targets[0].invocations[0].input.keys.push("forged")');assert.deepEqual(await page.evaluate(reactHelperRuntimeRead),report);
    const probe=await browser.newPage();try{
      await probe.setContent('<div id="root"></div>');await probe.evaluate(reactHelperRuntimeHook([],[model],true,plan.initializers));await probe.addScriptTag({content:javascript});await probe.locator('#selected').waitFor();
      const result=await probe.evaluate(()=>{
        const original=Map.prototype.values;let calls=0,reason='';
        Map.prototype.values=function(){calls++;throw Error('changed map iterator ran');};
        try{(window as unknown as {testTarget:{displayName:string}}).testTarget.displayName='Changed';}catch(error){reason=(error as Error).message;}finally{Map.prototype.values=original;}
        return {calls,reason};
      });assert.equal(result.calls,0);assert.match(result.reason,/native-intrinsic-changed/);assert.equal((await probe.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead)).status,'refused');
    }finally{await probe.close();}
    for(const mode of ['proxy-input','wrong-ref','late-input-mutation','throw-render'] as const){
     const probe=await browser.newPage();try{
      await probe.setContent('<div id="root"></div>');await probe.evaluate(reactHelperRuntimeHook([],[model],true,plan.initializers));await probe.addScriptTag({content:javascript});await probe.locator('#selected').waitFor();
      const result=await probe.evaluate(mode=>{
       const w=window as unknown as {testTarget:{render:Function};lastProps:object;lastRef:object;__DSC_RUNTIME_PROOF:{targetInvoke:(fn:Function,input:object,ref:unknown,call:()=>void)=>unknown}};
       let reads=0,calls=0,reason='';const sentinel=new Error('original render failure');let sameError=false;const proxy=new Proxy({}, {ownKeys(){reads++;return [];},getPrototypeOf(){reads++;return null;}});
       if(mode==='late-input-mutation')Object.defineProperty(w.lastProps,'id',{value:'changed'});
       else try{w.__DSC_RUNTIME_PROOF.targetInvoke(w.testTarget.render,mode==='proxy-input'?proxy:w.lastProps,mode==='wrong-ref'?proxy:w.lastRef,()=>{calls++;if(mode==='throw-render')throw sentinel;});}catch(e){reason=(e as Error).message;sameError=e===sentinel;}
       return {reads,calls,reason,sameError};
      },mode);
      assert.equal(result.reads,0);assert.equal(result.calls,mode==='throw-render'?1:0);assert.equal(result.sameError,mode==='throw-render');
      const after=await probe.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(after.status,'refused');if(after.status==='refused')assert.match(after.reason,mode==='proxy-input'?/target-input-provenance-unproved/:mode==='wrong-ref'?/target-input-ref-mismatch/:mode==='throw-render'?/helper-runtime-targetInvoke-failed/:/target-input-mutated/);
     }finally{await probe.close();}
    }
    await page.evaluate("window.testTarget.render=()=>null");const after=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(after.status,'refused');if(after.status==='refused')assert.match(after.reason,/target-initializer-object-changed/);
   }
  }finally{await page.close();}
 }
 assert.deepEqual(pairs[0],pairs[1]);assert.deepEqual(pairs[0].state,{clicks:1,ref:true,namingName:'label'});
});
