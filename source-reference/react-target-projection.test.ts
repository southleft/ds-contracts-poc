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
import {createReactHelperObserver,reactRuntimeAdapters} from './react-helper-transform.js';
import {prepareReactJsxLookupBundle} from './react-jsx-lookup.js';
import {reactHelperRuntimeHook,reactHelperRuntimeRead,type ReactHelperRuntimeReport} from './react-helper-runtime.js';
import type {ReactReference} from './react-reference.js';

const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
for(const parameterPattern of [false,true])test(`actual target returns and callback captures preserve ${parameterPattern?'destructured':'identifier'} inputs, refs and late locals; lookalikes refuse before proxy reads`,async t=>{
  const repo=process.cwd(),dir=mkdtempSync(path.join(repo,'source-reference/.target-projection-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const text=`import React from 'react';import {Root} from './targets.mjs';export const Control=React.forwardRef((props,ref)=><Root id={props.id} onClick={props.onClick} ref={ref}><span>{props.label}</span></Root>);`;
  const targetText=`import React from 'react';import {jsx} from 'react/jsx-runtime';
export function Provider(props){window.actualCallback=props.render;window.callbackName=props.render.name;return props.render({shown:true});}
function normalize(fn,rest){return fn;}
if(window.mode==='provider')Provider=function Other(props){return props.render({shown:true});};
if(window.mode==='proxy')normalize=(fn,rest)=>new Proxy(fn,{ownKeys(){window.proxyReads++;return Reflect.ownKeys(fn);},getPrototypeOf(){window.proxyReads++;return Object.getPrototypeOf(fn);}});
if(window.mode==='metadata')normalize=(fn,rest)=>{fn.extra=true;return fn;};
if(window.mode==='capture')normalize=(fn,rest)=>{rest.id='changed';return fn;};
if(window.mode==='reuse'){let saved;normalize=(fn,rest)=>saved||(saved=fn);}
export const Root=React.forwardRef(function Render(${parameterPattern?'{disabled=false,...rest}':'props'},ref){
 ${parameterPattern?'':'const {disabled=false,...rest}=props;'}let label=${parameterPattern?'rest':'props'}.id;
 const render=({shown})=>jsx('button',{...rest,ref,'data-shown':shown,'data-label':label});
 label=label+'!';return jsx(Provider,{disabled,render:normalize(render,rest)});
});`;
  const file=path.join(dir,'fixture.tsx'),targetFile=path.join(dir,'targets.mjs'),config=path.join(dir,'tsconfig.json');
  const files:Record<string,string>={};for(const [f,s] of [[file,text],[targetFile,targetText],[config,'{"compilerOptions":{"jsx":"react-jsx","module":"ESNext","target":"ES2022","moduleResolution":"Bundler"}}']]){writeFileSync(f,s);files[f]=sha(s);}
  for(const a of reactRuntimeAdapters){const f=repo+a.suffix;files[f]=sha(readFileSync(f,'utf8'));}
  const reference={sourceRoot:dir,files,runtimeImports:[{importer:file,specifier:'./targets.mjs',file:targetFile}]} as unknown as ReactReference;
  const target=readReactRuntimeExport(reference,'targets.mjs',['Root']);assert.equal(target.status,'resolved');if(target.status!=='resolved')return;
  const initializer=readReactTargetInitializer(reference,target.definition);
  const effect=replanReactTargetEffects(reference,initializer,{kind:'record',fields:[['id',{kind:'literal',type:'string',value:'selected'}],['onClick',{kind:'input',key:'onClick'}],['children',{kind:'opaque'}]]});
  assert.equal(effect.status,'modeled',JSON.stringify(effect));if(effect.status!=='modeled')return;
  const {program,sf,source,runtimeFiles}=prepareReactEffectProgram(reference,'fixture.tsx',{},{});let component:ts.ArrowFunction|undefined;
  const find=(n:ts.Node)=>{if(ts.isArrowFunction(n)&&n.parameters.length===2)component=n;ts.forEachChild(n,find);};find(sf);assert(component&&ts.isIdentifier(component.parameters[0].name));
  const model=modelReactJsxComponent({program,component,parameter:component.parameters[0].name,properties:[['id','selected'],['label','Original'],['onClick',{opaque:'function'}]],contentKey:'children',source,runtimeFiles,resolution:reference.runtimeImports,jsxTarget:()=>({file:target.definition.module,sha256:target.definition.sourceSha256,...target.definition.span})});
  assert.equal(model.status,'modeled');if(model.status!=='modeled')return;
  const plan={kind:'jsx-component' as const,models:[model],component:model.component,targets:[target.definition],initializers:[initializer],targetEffects:[effect]};
  const forged=structuredClone(plan);forged.targetEffects[0].output.props.fields[0][1]={kind:'literal',type:'boolean',value:true};
  assert.throws(()=>createReactHelperObserver(reference,forged),/target-projection-model-changed/);
  const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {Control} from './fixture.tsx';window.clicks=0;const ref=React.createRef();window.testRef=ref;
createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(Control,{id:'selected',label:'Original',onClick:()=>window.clicks++,ref})));`;
  const browser=await chromium.launch();t.after(()=>browser.close());const pairs=[];
  for(const mode of ['original','guarded','provider','proxy','metadata','capture','reuse']){
    const observed=mode!=='original',observer=createReactHelperObserver(reference,plan),input=observed?await observer.transform(entry,'react-reference.tsx','tsx'):{contents:entry,loader:'tsx' as const};
    const bundle=await build({stdin:{contents:input.contents,loader:input.loader,resolveDir:dir,sourcefile:'react-reference.tsx'},tsconfig:config,bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'guard',setup(b){b.onLoad({filter:/./},args=>args.path in files?observer.transform(readFileSync(args.path,'utf8'),args.path,args.path.endsWith('.tsx')?'tsx':'js'):undefined);}}]:[]});
    const javascript=observed?prepareReactJsxLookupBundle(bundle.outputFiles[0].text,plan).javascript:bundle.outputFiles[0].text;
    const page=await browser.newPage({viewport:{width:350,height:150}});try{
      await page.setContent('<div id="root"></div>');await page.evaluate(mode=>{Object.assign(window,{mode,proxyReads:0});},mode);
      if(observed)await page.evaluate(reactHelperRuntimeHook([],[model],true,plan.initializers,plan.targetEffects));
      const failure=!['original','guarded'].includes(mode)?page.waitForEvent('pageerror',{timeout:5000}):undefined;
      await page.addScriptTag({content:javascript});
      if(failure){await failure;const report=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(report.status,'refused',mode);assert.equal(await page.evaluate('window.proxyReads'),0);if(report.status==='refused')assert.match(report.reason,mode==='provider'?/target-projection-binding-changed/:mode==='metadata'?/target-projection-callback-changed/:/target-projection-return-mismatch/);continue;}
      await page.locator('#selected').waitFor();await page.locator('#selected').click();
      pairs.push({dom:await page.locator('#selected').evaluate(n=>n.outerHTML),png:await page.screenshot(),state:await page.evaluate('({clicks:window.clicks,ref:window.testRef.current===document.getElementById("selected"),name:window.callbackName})')});
      if(observed){
        observer.complete();const report=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(report.status,'observed',JSON.stringify(report));if(report.status==='observed'){
          assert.equal(report.targetProjections?.models,1);assert(report.targetProjections!.invocations.length>1);assert(report.targetProjections!.invocations.every(i=>i.callbacks===1&&i.captures===3));assert.equal(report.targetProjections?.effectsVerified,false);assert.equal(report.targetProjections?.acceptedContract,null);
        }
        await page.evaluate('window.__DSC_RUNTIME_READ().targetProjections.invocations[0].render.start++');assert.deepEqual(await page.evaluate(reactHelperRuntimeRead),report);
        await page.evaluate('window.actualCallback.extra=true');const after=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(after.status,'refused');if(after.status==='refused')assert.match(after.reason,/target-projection-callback-changed/);
      }
    }finally{await page.close();}
  }
  assert.deepEqual(pairs[0],pairs[1]);assert.deepEqual(pairs[0].state,{clicks:1,ref:true,name:'render'});
});
