import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {prepareReactEffectProgram} from './react-helper-effects.js';
import {planReactContextFactoryCalls} from './react-context-calls.js';
import {modelReactJsxComponent} from './react-helper-model.mjs';
import {readReactRuntimeExport} from './react-runtime-export.js';
import {readReactTargetInitializer} from './react-target-initializer.js';
import {createReactHelperObserver,reactRuntimeAdapters} from './react-helper-transform.js';
import {prepareReactJsxLookupBundle} from './react-jsx-lookup.js';
import {reactHelperRuntimeHook,reactHelperRuntimeRead,type ReactHelperRuntimeReport} from './react-helper-runtime.js';
import type {ReactReference} from './react-reference.js';

const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
test('source JSX factories retain nested order, original target reads, caught argument and native factory throws, and exact returned element identity',async t=>{
 const repo=process.cwd(),dir=mkdtempSync(path.join(repo,'source-reference/.context-factories-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const text=`import React from 'react';import {Root} from './targets.mjs';export const Control=React.forwardRef((props,ref)=><Root id={props.id} onClick={props.onClick} ref={ref}/>);`;
 const targetSource=`import React from 'react';import {jsx as one,jsxs as many} from 'react/jsx-runtime';
 const Tag=React.forwardRef((props,ref)=>one('button',{...props,ref}));
 Object.defineProperty(window.targets,'current',{get(){window.order.push('target');return Tag;}});
 export const Root=React.forwardRef(function Reader(props,ref){
  window.renderCount++;if(window.mode==='cached'&&window.cached)return window.cached;
  if(window.mode==='argument-throw'){try{one(window.targets.current,window.throwArgument());}catch(error){window.sameError=error===window.sentinel;}}
  if(window.mode==='factory-throw'){try{one('i',{},window.throwKey);}catch(error){window.sameError=error===window.sentinel;}}
  const output=(many)(window.targets.current,{id:(window.order.push('config'),props.id),onClick:props.onClick,ref,
   children:[one('span',{children:'label'}),' value']},(window.order.push('key'),'stable'));
  if(window.mode==='cached')window.cached=output;return output;
 });`;
 const file=path.join(dir,'fixture.tsx'),targetFile=path.join(dir,'targets.mjs'),config=path.join(dir,'tsconfig.json'),files:Record<string,string>={};
 for(const [f,s] of [[file,text],[targetFile,targetSource],[config,'{"compilerOptions":{"jsx":"react-jsx","module":"ESNext","target":"ES2022","moduleResolution":"Bundler"}}']]){writeFileSync(f,s);files[f]=sha(s);}
 for(const a of reactRuntimeAdapters){const f=repo+a.suffix;files[f]=sha(readFileSync(f,'utf8'));}
 const reference={sourceRoot:dir,files,runtimeImports:[{importer:file,specifier:'./targets.mjs',file:targetFile}]} as unknown as ReactReference;
 const target=readReactRuntimeExport(reference,'targets.mjs',['Root']);assert.equal(target.status,'resolved');if(target.status!=='resolved')return;
 const initializer=readReactTargetInitializer(reference,target.definition),{program,sf,source,runtimeFiles}=prepareReactEffectProgram(reference,'fixture.tsx',{},{});let component:ts.ArrowFunction|undefined;
 const find=(n:ts.Node)=>{if(ts.isArrowFunction(n)&&n.parameters.length===2)component=n;ts.forEachChild(n,find);};find(sf);assert(component&&ts.isIdentifier(component.parameters[0].name));
 const model=modelReactJsxComponent({program,component,parameter:component.parameters[0].name,properties:[['id','selected'],['onClick',{opaque:'function'}]],contentKey:'children',source,runtimeFiles,resolution:reference.runtimeImports,jsxTarget:()=>({file:target.definition.module,sha256:target.definition.sourceSha256,...target.definition.span})});assert.equal(model.status,'modeled');if(model.status!=='modeled')return;
 const factories=planReactContextFactoryCalls(reference,[initializer]);assert.equal(factories.length,4);
 const plan={kind:'jsx-component' as const,models:[model],component:model.component,targets:[target.definition],initializers:[initializer],contextFactories:factories};
 assert.throws(()=>createReactHelperObserver(reference,{...plan,contextFactories:[]}),/context-factory-plan-changed/);
 assert.throws(()=>createReactHelperObserver(reference,{...plan,contextFactories:factories.map((f,i)=>i?f:{...f,arguments:f.arguments.slice(1)})}),/context-factory-plan-changed/);
 const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {Control} from './fixture.tsx';window.clicks=0;window.testRef=React.createRef();const root=createRoot(document.getElementById('root'));window.render=()=>root.render(React.createElement(Control,{id:'selected',onClick:()=>window.clicks++,ref:window.testRef}));window.render();`;
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const mode of ['normal','argument-throw','factory-throw','cached']){
  const pairs:unknown[]=[];
  for(const observed of [false,true]){
   const observer=createReactHelperObserver(reference,plan),input=observed?await observer.transform(entry,'react-reference.tsx','tsx'):{contents:entry,loader:'tsx' as const};
   const bundle=await build({stdin:{contents:input.contents,loader:input.loader,resolveDir:dir,sourcefile:'react-reference.tsx'},tsconfig:config,bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'guard',setup(b){b.onLoad({filter:/./},args=>args.path in files?observer.transform(readFileSync(args.path,'utf8'),args.path,args.path.endsWith('.tsx')?'tsx':'js'):undefined);}}]:[]});
   const javascript=observed?prepareReactJsxLookupBundle(bundle.outputFiles[0].text,plan).javascript:bundle.outputFiles[0].text;
   const page=await browser.newPage({viewport:{width:600,height:150}});try{
    await page.setContent('<div id="root"></div>');await page.evaluate(mode=>{
     const w=window as any;Object.assign(w,{mode,targets:{},order:[],renderCount:0,sameError:null,sentinel:new Error('original exception')});
     w.throwArgument=()=>{w.order.push('argument-throw');throw w.sentinel;};
     w.throwKey={[Symbol.toPrimitive](){w.order.push('key-throw');throw w.sentinel;}};
    },mode);
    if(observed)await page.evaluate(reactHelperRuntimeHook([],[model],true,[initializer],[],[],[],[],[],[],[],factories));
    await page.addScriptTag({content:javascript});await page.locator('#selected').waitFor({timeout:5000});
    await page.evaluate('window.render()');await page.waitForFunction('window.renderCount===2');await page.locator('#selected').click();
    pairs.push({dom:await page.locator('#root').innerHTML(),png:await page.screenshot(),state:await page.evaluate('({clicks:window.clicks,ref:window.testRef.current===document.getElementById("selected"),renders:window.renderCount,order:window.order,sameError:window.sameError})')});
    if(observed){
     observer.complete();const r=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(r.status,'observed',JSON.stringify(r));if(r.status!=='observed')continue;
     const c=r.contexts!,f=c.factories;assert.equal(f.qualification,'source-jsx-factory-identity-only');assert.equal(f.effectsVerified,false);assert.equal(f.acceptedContract,null);assert.equal(f.planned,4);
     assert.equal(c.renders.invocations.length,2);assert.equal(f.invocations.length,mode==='cached'?2:mode==='normal'?4:6);
     for(const render of c.renders.invocations){
      if(mode==='cached'&&render.id===1){
       assert.equal(render.returnedFactory,null);assert(!f.invocations.some(i=>i.render===render.id));
       const boundaries:NonNullable<Extract<ReactHelperRuntimeReport,{status:'observed'}>['targetInitializers']>['targets'][number]['invocations']=r.targetInitializers!.targets[0].invocations;assert.deepEqual(boundaries[1].output.value,boundaries[0].output.value);continue;
      }
      assert.notEqual(render.returnedFactory,null);const factory=f.invocations[render.returnedFactory!];assert.equal(factory.factory,'jsxs');assert.equal(factory.render,render.id);
      assert.deepEqual(factory.consumer,initializer.render);assert.equal(factory.completion,'returned');assert.equal(factory.arguments.length,3);assert.equal(factory.arguments[2].value,'stable');
      const boundary:NonNullable<Extract<ReactHelperRuntimeReport,{status:'observed'}>['targetInitializers']>['targets'][number]['invocations'][number]=r.targetInitializers!.targets[0].invocations.find(v=>v.input.render===render.id)!;
      assert.deepEqual(factory.value,boundary.output.value);assert.deepEqual(factory.arguments[0],boundary.output.type);
      assert.equal(targetSource.slice(factory.target.start,factory.target.end),'window.targets.current');
      const nested=f.invocations[factory.id+1];assert.equal(nested.render,render.id);assert.equal(nested.factory,'jsx');assert.equal(nested.arguments[0].value,'span');assert.notDeepEqual(nested.value,factory.value);
      const thrown=f.invocations.filter(v=>v.render===render.id&&v.completion==='threw');assert.equal(thrown.length,mode==='normal'||mode==='cached'?0:1);
      if(thrown.length){assert.equal(thrown[0].arguments.length,mode==='argument-throw'?1:3);assert.equal(thrown[0].value,undefined);}
     }
     const order=mode==='normal'||mode==='cached'?['target','config','key']:mode==='argument-throw'?['target','argument-throw','target','config','key']:['key-throw','key-throw','target','config','key'];
     assert.deepEqual(await page.evaluate('window.order'),mode==='cached'?order:[...order,...order]);
     if(mode==='argument-throw'||mode==='factory-throw')assert.equal(await page.evaluate('window.sameError'),true);
     await page.evaluate('const r=window.__DSC_RUNTIME_READ();r.contexts.factories.invocations[0].arguments[0].kind="forged";r.contexts.factories.invocations[0].site.start=-1;r.contexts.renders.invocations[0].returnedFactory=-1');assert.deepEqual(await page.evaluate(reactHelperRuntimeRead),r);
    }
   }finally{await page.close();}
  }
  assert.deepEqual(pairs[1],pairs[0],mode);
 }
});
