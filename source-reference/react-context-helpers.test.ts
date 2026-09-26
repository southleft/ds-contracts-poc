import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {prepareReactEffectProgram} from './react-helper-effects.js';
import {planReactContextCalls,planReactContextHelpers} from './react-context-calls.js';
import {modelReactJsxComponent} from './react-helper-model.mjs';
import {readReactRuntimeExport} from './react-runtime-export.js';
import {readReactTargetInitializer} from './react-target-initializer.js';
import {createReactHelperObserver,reactRuntimeAdapters} from './react-helper-transform.js';
import {prepareReactJsxLookupBundle} from './react-jsx-lookup.js';
import {reactHelperRuntimeHook,reactHelperRuntimeRead,type ReactHelperRuntimeReport} from './react-helper-runtime.js';
import type {ReactReference} from './react-reference.js';

const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
test('distinct context helper closures preserve calls and original return identity; copies and opaque lookalikes gain no forwarding claim',async t=>{
 const repo=process.cwd(),dir=mkdtempSync(path.join(repo,'source-reference/.context-helpers-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const text=`import React from 'react';import {Root} from './targets.mjs';export const Control=React.forwardRef((props,ref)=><Root id={props.id} onClick={props.onClick} ref={ref}/>);`;
 const targetSource=`import React from 'react';import {jsx} from 'react/jsx-runtime';
 export const A=React.createContext({label:'default-a'}),B=React.createContext({label:'default-b'});
 function factory(Context){
  function read(mode='same'){
   'context helper';
   const value=React.useContext(Context);window.helperCalls++;window.argumentsSeen.push([arguments.length,this&&this.tag,read.name,read.length]);
   if(mode==='copy')return {...value};
   if(mode==='foreign')return window.foreign;
   if(mode==='throw')throw window.sentinel;
   if(mode!=='implicit')return value;
  }
  Object.defineProperty(read,'name',{value:'readContext',configurable:true});window.functions.push(read);return read;
 }
 const first=factory(A),second=factory(B);
 export const Root=React.forwardRef(function Reader(props,ref){
  if(window.mode==='caught-throw'){try{first.call({tag:'error'},'throw');}catch(error){window.sameError=error===window.sentinel;}}
  const mode=window.mode==='caught-throw'?'same':window.mode;
  const a=mode==='default'?first.call({tag:'a'}):first.call({tag:'a'},mode),b=mode==='default'?second.call({tag:'b'}):second.call({tag:'b'},mode);
  return jsx('button',{id:props.id,onClick:props.onClick,ref,children:(a?a.label:'none')+':'+(b?b.label:'none')});
 });`;
 const file=path.join(dir,'fixture.tsx'),targetFile=path.join(dir,'targets.mjs'),config=path.join(dir,'tsconfig.json'),files:Record<string,string>={};
 for(const [f,s] of [[file,text],[targetFile,targetSource],[config,'{"compilerOptions":{"jsx":"react-jsx","module":"ESNext","target":"ES2022","moduleResolution":"Bundler"}}']]){writeFileSync(f,s);files[f]=sha(s);}
 for(const a of reactRuntimeAdapters){const f=repo+a.suffix;files[f]=sha(readFileSync(f,'utf8'));}
 const reference={sourceRoot:dir,files,runtimeImports:[{importer:file,specifier:'./targets.mjs',file:targetFile}]} as unknown as ReactReference;
 const target=readReactRuntimeExport(reference,'targets.mjs',['Root']);assert.equal(target.status,'resolved');if(target.status!=='resolved')return;
 const initializer=readReactTargetInitializer(reference,target.definition),{program,sf,source,runtimeFiles}=prepareReactEffectProgram(reference,'fixture.tsx',{},{});let component:ts.ArrowFunction|undefined;
 const find=(n:ts.Node)=>{if(ts.isArrowFunction(n)&&n.parameters.length===2)component=n;ts.forEachChild(n,find);};find(sf);assert(component&&ts.isIdentifier(component.parameters[0].name));
 const model=modelReactJsxComponent({program,component,parameter:component.parameters[0].name,properties:[['id','selected'],['onClick',{opaque:'function'}]],contentKey:'children',source,runtimeFiles,resolution:reference.runtimeImports,jsxTarget:()=>({file:target.definition.module,sha256:target.definition.sourceSha256,...target.definition.span})});assert.equal(model.status,'modeled');if(model.status!=='modeled')return;
 const calls=planReactContextCalls(reference),helpers=planReactContextHelpers(reference,calls);assert.equal(helpers.length,1);assert.equal(helpers[0].name,'read');
 const plan={kind:'jsx-component' as const,models:[model],component:model.component,targets:[target.definition],initializers:[initializer],contextCalls:calls,contextHelpers:helpers};
 assert.throws(()=>createReactHelperObserver(reference,{...plan,contextHelpers:[]}),/context-helper-plan-changed/);
 const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {Control} from './fixture.tsx';import {A,B} from './targets.mjs';
 window.clicks=0;window.testRef=React.createRef();const root=createRoot(document.getElementById('root'));
 window.render=(label)=>root.render(React.createElement(A.Provider,{value:{label}},React.createElement(B.Provider,{value:{label:'b'}},React.createElement(Control,{id:'selected',onClick:()=>window.clicks++,ref:window.testRef}))));window.render('a');`;
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const mode of ['same','default','copy','foreign','implicit','caught-throw']){
  const pairs:unknown[]=[];
  for(const observed of [false,true]){
   const observer=createReactHelperObserver(reference,plan),input=observed?await observer.transform(entry,'react-reference.tsx','tsx'):{contents:entry,loader:'tsx' as const};
   const bundle=await build({stdin:{contents:input.contents,loader:input.loader,resolveDir:dir,sourcefile:'react-reference.tsx'},tsconfig:config,bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'guard',setup(b){b.onLoad({filter:/./},args=>args.path in files?observer.transform(readFileSync(args.path,'utf8'),args.path,args.path.endsWith('.tsx')?'tsx':'js'):undefined);}}]:[]});
   const javascript=observed?prepareReactJsxLookupBundle(bundle.outputFiles[0].text,plan).javascript:bundle.outputFiles[0].text;
   const page=await browser.newPage({viewport:{width:600,height:150}});try{
    await page.setContent('<div id="root"></div>');await page.evaluate(mode=>Object.assign(window,{mode,functions:[],argumentsSeen:[],helperCalls:0,proxyReads:0,sentinel:new Error('original exception'),sameError:null,foreign:new Proxy({label:'foreign'},{get(target,key){(window as any).proxyReads++;return Reflect.get(target,key);}})}),mode);
    if(observed)await page.evaluate(reactHelperRuntimeHook([],[model],true,plan.initializers,[],[],[],calls,[],helpers));
    await page.addScriptTag({content:javascript});await page.locator('#selected').filter({hasText:mode==='foreign'?'foreign:foreign':mode==='implicit'?'none:none':'a:b'}).waitFor({timeout:5000});
    await page.evaluate('window.render("updated")');await page.waitForFunction(mode==='caught-throw'?'window.helperCalls===6':'window.helperCalls===4');await page.locator('#selected').click();
    pairs.push({dom:await page.locator('#root').innerHTML(),png:await page.screenshot(),state:await page.evaluate('({clicks:window.clicks,ref:window.testRef.current===document.getElementById("selected"),helperCalls:window.helperCalls,argumentsSeen:window.argumentsSeen,proxyReads:window.proxyReads,sameError:window.sameError})')});
    if(observed){
     observer.complete();const r=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(r.status,'observed',JSON.stringify(r));if(r.status!=='observed')continue;
     const c=r.contexts!,h=c.helpers;assert.equal(h.qualification,'source-context-helper-return-identity-only');assert.equal(h.effectsVerified,false);assert.equal(h.acceptedContract,null);
     assert.equal(h.planned,1);assert.equal(h.instances.length,2);assert.deepEqual(h.instances.map(i=>i.source),[helpers[0].source,helpers[0].source]);
     assert.deepEqual(h.invocations.map(i=>i.instance),mode==='caught-throw'?[0,0,1,0,0,1]:[0,1,0,1]);assert.deepEqual(h.invocations.map(i=>i.reads),h.invocations.map((_,i)=>[i]));
     for(const invocation of h.invocations){
      const thrown=mode==='caught-throw'&&(invocation.id===0||invocation.id===3);
      assert.equal(invocation.completion,thrown?'threw':'returned');assert.equal(invocation.returnSource===null,thrown||mode==='implicit');assert.deepEqual(invocation.consumer,initializer.render);
      assert.deepEqual(invocation.matchingReads,!thrown&&['same','default','caught-throw'].includes(mode)?invocation.reads:[]);
      if(thrown)assert.equal(invocation.value,undefined);
      else assert.equal(invocation.witness?.kind,invocation.value?.kind);
      const closureReads=invocation.closureReads.map(i=>c.helperClosures.reads[i]);assert(closureReads.length);
      assert(closureReads.every(r=>r.helper===invocation.id&&r.instance===invocation.instance&&r.render===invocation.render));
      const contextRead=closureReads.find(r=>targetSource.slice(r.site.start,r.site.end)==='Context');assert(contextRead);
      assert.equal(contextRead.context,c.reads[invocation.reads[0]].context);assert.equal(contextRead.value.kind,'object');
      assert(closureReads.some(r=>targetSource.slice(r.site.start,r.site.end)==='React'&&r.context===null&&r.value.kind==='object'));
     }
     assert.deepEqual(c.reads.map(v=>v.context),mode==='caught-throw'?[0,0,1,0,0,1]:[0,1,0,1]);assert.equal(await page.evaluate('window.proxyReads'),mode==='foreign'?4:0);
     if(mode==='caught-throw')assert.equal(await page.evaluate('window.sameError'),true);
     await page.evaluate('const r=window.__DSC_RUNTIME_READ();r.contexts.helpers.invocations[0].matchingReads.push(999);r.contexts.helperClosures.reads[0].site.start=-1;r.contexts.helperClosures.reads[0].value.kind="forged"');assert.deepEqual(await page.evaluate(reactHelperRuntimeRead),r);
     await page.evaluate('Object.defineProperty(window.functions[0],"changed",{get(){window.proxyReads++;return true;}})');
     const changed=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(changed.status,'refused');if(changed.status==='refused')assert.equal(changed.reason,'context-helper-boundary-changed');
     assert.equal(await page.evaluate('window.proxyReads'),mode==='foreign'?4:0);
    }
   }finally{await page.close();}
  }
  assert.deepEqual(pairs[1],pairs[0],mode);
 }
});
