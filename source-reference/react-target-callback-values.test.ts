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
import {rebuildReactTargetCallbackValues} from './react-target-callback-values.js';
import {rebuildReactTargetCallbackPlan} from './react-target-callback-plan.js';
import {readReactElementSourceCalls} from './react-element-source-call.js';
import {createReactHelperObserver,reactRuntimeAdapters} from './react-helper-transform.js';
import {prepareReactJsxLookupBundle} from './react-jsx-lookup.js';
import {reactHelperRuntimeHook,reactHelperRuntimeRead,type ReactHelperRuntimeReport} from './react-helper-runtime.js';
import type {ReactReference} from './react-reference.js';


const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
test('callback return values preserve child, ref and opaque context identities across real state changes and refuse mismatched values',async t=>{
 const repo=process.cwd(),dir=mkdtempSync(path.join(repo,'source-reference/.target-callback-values-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const text=`import React from 'react';import {Root} from './targets.mjs';export const Control=React.forwardRef((props,ref)=><Root id={props.id} onClick={props.onClick} ref={ref}><span>{props.label}</span></Root>);`;
 const targetText=`import React from 'react';import {jsx,jsxs,Fragment} from 'react/jsx-runtime';
let Item=React.forwardRef((props,ref)=>{const {payload,shown,...rest}=props;return jsx('button',{...rest,ref,'data-shown':shown});});
const Extra=React.forwardRef((props,ref)=>jsx('span',{...props,ref,children:'extra'}));
window.replaceTarget=()=>{Item=new Proxy(Item,{get(){window.proxyReads++;throw Error('unexpected proxy inspection');}});};
export {Item as Alias,Extra as Additional};
export function Provider(props){const [shown,setShown]=React.useState(false);React.useLayoutEffect(()=>setShown(true),[]);const context={shown,payload:window.payload};return props.render(context);}
export const Root=React.forwardRef(function Render(props,ref){const {disabled=false,...rest}=props;
 const render=({shown,payload})=>jsxs(Fragment,{children:[jsx(Item,{...rest,ref,shown,payload,title:'ORIGINAL_VALUE'},'control'),shown&&jsx(Extra,{title:'extra'},'extra-key')]});return jsx(Provider,{disabled,render});});`;
 // The call reader requires a bare callback call and an independently sourced object.
 const targetSource=targetText.replace('return props.render(context);','const render=props.render;return render(context);');
 const file=path.join(dir,'fixture.tsx'),targetFile=path.join(dir,'targets.mjs'),config=path.join(dir,'tsconfig.json'),files:Record<string,string>={};
 for(const [f,s] of [[file,text],[targetFile,targetSource],[config,'{"compilerOptions":{"jsx":"react-jsx","module":"ESNext","target":"ES2022","moduleResolution":"Bundler"}}']]){writeFileSync(f,s);files[f]=sha(s);}
 for(const a of reactRuntimeAdapters){const f=repo+a.suffix;files[f]=sha(readFileSync(f,'utf8'));}
 const reference={sourceRoot:dir,files,runtimeImports:[{importer:file,specifier:'./targets.mjs',file:targetFile}]} as unknown as ReactReference;
 const target=readReactRuntimeExport(reference,'targets.mjs',['Root']);assert.equal(target.status,'resolved');if(target.status!=='resolved')return;
 const initializer=readReactTargetInitializer(reference,target.definition),root=replanReactTargetEffects(reference,initializer,{kind:'record',fields:[['id',{kind:'literal',type:'string',value:'selected'}],['onClick',{kind:'input',key:'onClick'}],['children',{kind:'opaque'}]]});
 assert.equal(root.status,'modeled',JSON.stringify(root));if(root.status!=='modeled')return;
 const callback=new Map(root.output.props.fields).get('render');assert(callback?.kind==='callback');assert(root.output.tag.kind==='source-binding');const provider=root.output.tag.source;
 const inventory=readReactElementSourceCalls(ts.createSourceFile(targetFile,targetSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),'targets.mjs',sha(targetSource));
 const call=inventory.calls.find(c=>c.functionSpan?.start===provider.start);assert(call);
 const boundary=rebuildReactTargetCallbackPlan(reference,[root],{render:root.render,callback:callback.source,provider,call:{file:'targets.mjs',sha256:sha(targetSource),...call.span},input:{file:'targets.mjs',sha256:sha(targetSource),...inventory.objects[call.object].span}});
 const values=[false,true].map(shown=>rebuildReactTargetCallbackValues(reference,[root],[initializer],boundary,[['shown',{kind:'boolean',value:shown}],['payload',{kind:'object'}]]));
 assert.deepEqual(values[1].targets.map(p=>p.target.exportName),['Alias','Additional']);
 const {program,sf,source,runtimeFiles}=prepareReactEffectProgram(reference,'fixture.tsx',{},{});let component:ts.ArrowFunction|undefined;
 const find=(n:ts.Node)=>{if(ts.isArrowFunction(n)&&n.parameters.length===2)component=n;ts.forEachChild(n,find);};find(sf);assert(component&&ts.isIdentifier(component.parameters[0].name));
 const model=modelReactJsxComponent({program,component,parameter:component.parameters[0].name,properties:[['id','selected'],['label','Original'],['onClick',{opaque:'function'}]],contentKey:'children',source,runtimeFiles,resolution:reference.runtimeImports,jsxTarget:()=>({file:target.definition.module,sha256:target.definition.sourceSha256,...target.definition.span})});assert.equal(model.status,'modeled');if(model.status!=='modeled')return;
 const base={kind:'jsx-component' as const,models:[model],component:model.component,targets:[target.definition],initializers:[initializer,...values[1].targets],targetEffects:[root],callbackPlans:[boundary],callbackValues:values};
 const forged=structuredClone(values);forged[0].projection.output.key='forged';assert.throws(()=>createReactHelperObserver(reference,{...base,callbackValues:forged}),/target-callback-value-plan-changed/);
 const stale=structuredClone(reference);stale.files[targetFile]='stale';assert.throws(()=>rebuildReactTargetCallbackValues(stale,[root],[initializer],boundary,values[0].input),/source-changed/);
 const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {Control} from './fixture.tsx';window.clicks=0;const ref=React.createRef();window.testRef=ref;createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(Control,{id:'selected',label:'Original',onClick:()=>window.clicks++,ref})));`;
 const browser=await chromium.launch();t.after(()=>browser.close());const pairs:Record<string,unknown>={};
 for(const mode of ['original','guarded','changed-prop','changed-key','changed-ref','changed-children','changed-context','getter-config','missing-context']){
  t.diagnostic(mode);
  const observed=mode!=='original',plan=mode==='missing-context'?{...base,initializers:[initializer,...values[0].targets],callbackValues:[values[0]]}:base;
  const observer=createReactHelperObserver(reference,plan),input=observed?await observer.transform(entry,'react-reference.tsx','tsx'):{contents:entry,loader:'tsx' as const};
  const bundle=await build({stdin:{contents:input.contents,loader:input.loader,resolveDir:dir,sourcefile:'react-reference.tsx'},tsconfig:config,bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'guard',setup(b){b.onLoad({filter:/./},async args=>{if(!(args.path in files))return;const output=await observer.transform(readFileSync(args.path,'utf8'),args.path,args.path.endsWith('.tsx')?'tsx':'js');if(args.path===targetFile){
    if(mode==='changed-prop')output.contents=output.contents.replace('ORIGINAL_VALUE','ALTERED_VALUE');
    if(mode==='changed-key')output.contents=output.contents.replace(/(['"])control\1/,"'altered-key'");
    if(['changed-ref','changed-children','changed-context'].includes(mode)){
     const replacement=mode==='changed-ref'?'ref:null,shown,payload,':mode==='changed-children'?'ref,shown,payload,children:null,':'ref,shown,payload:{},';
     const changed=output.contents.replace(/\bref,\s*shown,\s*payload,/,replacement);assert.notEqual(changed,output.contents);output.contents=changed;
    }
    if(mode==='getter-config'){const changed=output.contents.replace(/title:\s*(['"])ORIGINAL_VALUE\1/,"get key(){window.proxyReads++;return 'unexpected';}");assert.notEqual(changed,output.contents);output.contents=changed;}
   }return output;});}}]:[]});
  const javascript=observed?prepareReactJsxLookupBundle(bundle.outputFiles[0].text,plan).javascript:bundle.outputFiles[0].text;
  const page=await browser.newPage({viewport:{width:350,height:150}}),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));try{
   await page.setContent('<div id="root"></div>');await page.evaluate(()=>Object.assign(window,{proxyReads:0,payload:new Proxy({}, {get(){throw Error('opaque context read');}})}));
   if(observed)await page.evaluate(reactHelperRuntimeHook([],[model],true,plan.initializers,plan.targetEffects,plan.callbackPlans,plan.callbackValues));
   const failure=['changed-prop','changed-key','changed-ref','changed-children','changed-context','getter-config','missing-context'].includes(mode)?page.waitForEvent('pageerror',{timeout:5000}):undefined;await page.addScriptTag({content:javascript});
   if(failure){await failure;const report=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(report.status,'refused',JSON.stringify(report));if(report.status==='refused')assert.equal(report.reason,mode==='missing-context'?'target-callback-input-context-unmodeled':mode==='getter-config'?'jsx-config-accessor':'target-callback-return-values-mismatch');assert.equal(await page.evaluate('window.proxyReads'),0);continue;}
   try{await page.locator('#selected[data-shown="true"]').waitFor({timeout:5000});}catch{throw Error(JSON.stringify({mode,errors,runtime:observed?await page.evaluate(reactHelperRuntimeRead):null}));}await page.locator('#selected').click();
   pairs[mode]={dom:await page.locator('#root').innerHTML(),png:await page.screenshot(),state:await page.evaluate('({clicks:window.clicks,ref:window.testRef.current===document.getElementById("selected")})')};
   if(observed){observer.complete();const report=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(report.status,'observed',JSON.stringify(report));if(report.status!=='observed')continue;
    assert.equal(report.targetCallbacks?.values?.contexts,2);assert.equal(report.targetCallbacks.values.targets,2);assert(report.targetCallbacks.values.invocations>2);assert.equal(report.targetCallbacks.values.effectsVerified,false);
    await page.evaluate('window.replaceTarget()');const changed=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(changed.status,'refused');if(changed.status==='refused')assert.equal(changed.reason,'target-callback-binding-changed');assert.equal(await page.evaluate('window.proxyReads'),0);
   }
  }finally{await page.close();}
 }
 assert.deepEqual(pairs.original,pairs.guarded);
});
