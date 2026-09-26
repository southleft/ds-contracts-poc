import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {prepareReactEffectProgram} from './react-helper-effects.js';
import {planReactContextBindings,planReactContextConsumerCalls} from './react-context-calls.js';
import {modelReactJsxComponent} from './react-helper-model.mjs';
import {readReactRuntimeExport} from './react-runtime-export.js';
import {readReactTargetInitializer} from './react-target-initializer.js';
import {createReactHelperObserver,reactRuntimeAdapters} from './react-helper-transform.js';
import {prepareReactJsxLookupBundle} from './react-jsx-lookup.js';
import {reactHelperRuntimeHook,reactHelperRuntimeRead,type ReactHelperRuntimeReport} from './react-helper-runtime.js';
import type {ReactReference} from './react-reference.js';

const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
test('module binding observations preserve actual read timing, shorthand and typeof values, callee capture, and opaque proxy identity',async t=>{
 const repo=process.cwd(),dir=mkdtempSync(path.join(repo,'source-reference/.context-bindings-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const text=`import React from 'react';import {Root} from './targets.mjs';export const Control=React.forwardRef((props,ref)=><Root id={props.id} onClick={props.onClick} ref={ref}/>);`;
 const targetSource=`import React from 'react';import {jsx} from 'react/jsx-runtime';
 var label='initial';const opaque=window.opaque;
 function format(value){window.argumentsSeen.push(arguments[1]===window.opaque);return value?'on':'off';}
 const original=format;
 export const Root=React.forwardRef(function Reader(props,ref){
  window.renderCount++;
  const first=label;label='changed';const second=label,record={label},type=typeof label,same=opaque===window.opaque;
  if(window.mode==='proxy')format=new Proxy(original,{apply(fn,receiver,args){window.proxyCalls++;return Reflect.apply(fn,receiver,args);},get(){throw Error('callee reflected');},getOwnPropertyDescriptor(){throw Error('callee reflected');},getPrototypeOf(){throw Error('callee reflected');},ownKeys(){throw Error('callee reflected');}});
  const result=format((window.mode==='argument-switch'&&(format=window.replacement),true),opaque);
  label='initial';
  return jsx('button',{id:props.id,onClick:props.onClick,ref,children:first+':'+second+':'+record.label+':'+type+':'+same+':'+result});
 });`;

 const file=path.join(dir,'fixture.tsx'),targetFile=path.join(dir,'targets.mjs'),config=path.join(dir,'tsconfig.json'),files:Record<string,string>={};
 for(const [f,s] of [[file,text],[targetFile,targetSource],[config,'{"compilerOptions":{"jsx":"react-jsx","module":"ESNext","target":"ES2022","moduleResolution":"Bundler"}}']]){writeFileSync(f,s);files[f]=sha(s);}
 for(const a of reactRuntimeAdapters){const f=repo+a.suffix;files[f]=sha(readFileSync(f,'utf8'));}
 const reference={sourceRoot:dir,files,runtimeImports:[{importer:file,specifier:'./targets.mjs',file:targetFile}]} as unknown as ReactReference;
 const target=readReactRuntimeExport(reference,'targets.mjs',['Root']);assert.equal(target.status,'resolved');if(target.status!=='resolved')return;
 const initializer=readReactTargetInitializer(reference,target.definition),{program,sf,source,runtimeFiles}=prepareReactEffectProgram(reference,'fixture.tsx',{},{});let component:ts.ArrowFunction|undefined;
 const find=(n:ts.Node)=>{if(ts.isArrowFunction(n)&&n.parameters.length===2)component=n;ts.forEachChild(n,find);};find(sf);assert(component&&ts.isIdentifier(component.parameters[0].name));
 const model=modelReactJsxComponent({program,component,parameter:component.parameters[0].name,properties:[['id','selected'],['onClick',{opaque:'function'}]],contentKey:'children',source,runtimeFiles,resolution:reference.runtimeImports,jsxTarget:()=>({file:target.definition.module,sha256:target.definition.sourceSha256,...target.definition.span})});assert.equal(model.status,'modeled');if(model.status!=='modeled')return;
 const bindings=planReactContextBindings(reference,[initializer]),consumers=planReactContextConsumerCalls(reference,[initializer]);
 const plan={kind:'jsx-component' as const,models:[model],component:model.component,targets:[target.definition],initializers:[initializer],contextBindings:bindings,contextConsumerCalls:consumers};
 assert.throws(()=>createReactHelperObserver(reference,{...plan,contextBindings:{reads:[],functions:[]}}),/context-binding-plan-changed/);
 assert.throws(()=>createReactHelperObserver(reference,{...plan,contextBindings:{...bindings,reads:bindings.reads.map((r,i)=>i?r:{...r,binding:{...r.binding,start:r.binding.start+1}})}}),/context-binding-plan-changed/);

 const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {Control} from './fixture.tsx';window.clicks=0;window.testRef=React.createRef();const root=createRoot(document.getElementById('root'));window.render=()=>root.render(React.createElement(Control,{id:'selected',onClick:()=>window.clicks++,ref:window.testRef}));window.render();`;
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const mode of ['normal','proxy','argument-switch']){
  const pairs:unknown[]=[];
  for(const observed of [false,true]){
   const observer=createReactHelperObserver(reference,plan),input=observed?await observer.transform(entry,'react-reference.tsx','tsx'):{contents:entry,loader:'tsx' as const};
   const bundle=await build({stdin:{contents:input.contents,loader:input.loader,resolveDir:dir,sourcefile:'react-reference.tsx'},tsconfig:config,bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'guard',setup(b){b.onLoad({filter:/./},args=>args.path in files?observer.transform(readFileSync(args.path,'utf8'),args.path,args.path.endsWith('.tsx')?'tsx':'js'):undefined);}}]:[]});
   const javascript=observed?prepareReactJsxLookupBundle(bundle.outputFiles[0].text,plan).javascript:bundle.outputFiles[0].text;
   const page=await browser.newPage({viewport:{width:600,height:150}});try{
    await page.setContent('<div id="root"></div>');await page.evaluate(mode=>{
     const w=window as any;Object.assign(w,{mode,renderCount:0,argumentsSeen:[],proxyCalls:0});w.replacement=()=> 'replacement';
     w.opaque=new Proxy({}, {get(){throw Error('opaque reflected');},getOwnPropertyDescriptor(){throw Error('opaque reflected');},getPrototypeOf(){throw Error('opaque reflected');},ownKeys(){throw Error('opaque reflected');}});
    },mode);
    if(observed)await page.evaluate(reactHelperRuntimeHook([],[model],true,[initializer],[],[],[],[],[],[],consumers,[],bindings));
    await page.addScriptTag({content:javascript});await page.locator('#selected').waitFor({timeout:5000});
    await page.evaluate('window.render()');await page.waitForFunction('window.renderCount===2');await page.locator('#selected').click();
    pairs.push({dom:await page.locator('#root').innerHTML(),png:await page.screenshot(),state:await page.evaluate('({clicks:window.clicks,ref:window.testRef.current===document.getElementById("selected"),renders:window.renderCount,argumentsSeen:window.argumentsSeen,proxyCalls:window.proxyCalls})')});
    if(observed){
     observer.complete();const r=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(r.status,'observed',JSON.stringify(r));if(r.status!=='observed')continue;
     const c=r.contexts!,b=c.bindings;assert.equal(b.qualification,'source-module-binding-read-identity-only');assert.equal(b.effectsVerified,false);assert.equal(b.acceptedContract,null);assert.equal(b.planned,bindings.reads.length);assert.equal(b.functions,1);
     const renders=c.renders.invocations;assert.equal(renders.length,2);
     for(const render of renders){
      const reads=b.reads.filter(r=>r.render===render.id);assert(reads.every(r=>JSON.stringify(r.consumer)===JSON.stringify(initializer.render)));
      const labelReads=reads.filter(r=>targetSource.slice(r.binding.start,r.binding.end)==="label='initial'");
      assert.deepEqual(labelReads.map(r=>r.value.value),['initial','changed','changed','string']);assert.equal(labelReads[3].kind,'typeof');
      const opaqueReads=reads.filter(r=>targetSource.slice(r.binding.start,r.binding.end)==='opaque=window.opaque');assert.equal(opaqueReads.length,2);assert.deepEqual(opaqueReads[0].value,opaqueReads[1].value);assert.equal(opaqueReads[0].value.kind,'object');
      const call=c.consumerCalls.invocations.find(i=>i.render===render.id&&targetSource.slice(i.site.start,i.site.end).startsWith('format('));assert(call);assert.notEqual(call.calleeRead,null);
      const read=b.reads[call.calleeRead!];assert.equal(read.calleeOf,call.id);assert.equal(read.render,render.id);assert.deepEqual(read.value,call.callee);
      assert.equal(read.functionSource!==null,mode==='normal'||mode==='argument-switch'&&render.id===0);
      assert.deepEqual(call.arguments,[{kind:'boolean',value:true},{kind:'object'}]);assert.equal(call.value?.value,mode==='argument-switch'&&render.id===1?'replacement':'on');
      if(read.functionSource)assert.equal(targetSource.slice(read.functionSource.start,read.functionSource.end),"function format(value){window.argumentsSeen.push(arguments[1]===window.opaque);return value?'on':'off';}");
     }
     assert.equal(await page.evaluate('window.proxyCalls'),mode==='proxy'?2:0);
     await page.evaluate('const r=window.__DSC_RUNTIME_READ();r.contexts.bindings.reads[0].value.value="forged";r.contexts.bindings.reads[0].binding.start=-1;r.contexts.consumerCalls.invocations[0].calleeRead=-1');assert.deepEqual(await page.evaluate(reactHelperRuntimeRead),r);

    }
   }finally{await page.close();}
  }
  assert.deepEqual(pairs[1],pairs[0],mode);
 }
});
