import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {prepareReactEffectProgram} from './react-helper-effects.js';
import {planReactContextCalls,planReactContextHelpers,planReactContextConsumerCalls} from './react-context-calls.js';
import {modelReactJsxComponent} from './react-helper-model.mjs';
import {readReactRuntimeExport} from './react-runtime-export.js';
import {readReactTargetInitializer} from './react-target-initializer.js';
import {createReactHelperObserver,reactRuntimeAdapters} from './react-helper-transform.js';
import {prepareReactJsxLookupBundle} from './react-jsx-lookup.js';
import {reactHelperRuntimeHook,reactHelperRuntimeRead,type ReactHelperRuntimeReport} from './react-helper-runtime.js';
import type {ReactReference} from './react-reference.js';

const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
test('consumer calls preserve callee and argument order, caught throws and opaque values; proxy callees gain no helper identity',async t=>{
 const repo=process.cwd(),dir=mkdtempSync(path.join(repo,'source-reference/.context-consumers-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
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
  if(window.mode==='caught-throw'){try{first('throw');}catch(error){window.sameError=error===window.sentinel;}}
  const mode=['caught-throw','proxy','argument-throw'].includes(window.mode)?'same':window.mode;
  let selected=window.mode==='proxy'?new Proxy(first,{apply(fn,receiver,args){window.proxyApplies++;return Reflect.apply(fn,receiver,args);},get(){window.calleeReads++;throw Error('callee reflected');},getOwnPropertyDescriptor(){throw Error('callee reflected');},getPrototypeOf(){throw Error('callee reflected');}}):first;
  const argument=()=>{window.argumentEffects++;selected=second;return mode;};
  let a;
  if(window.mode==='argument-throw'){
   try{selected((()=>{throw window.sentinel;})());}catch(error){window.sameError=error===window.sentinel;}
   a=first('same',window.opaque);
  }else a=mode==='default'?selected():selected(argument(),window.opaque);
  const b=mode==='default'?second():second(mode);
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
 const plan={kind:'jsx-component' as const,models:[model],component:model.component,targets:[target.definition],initializers:[initializer],contextCalls:calls,contextHelpers:helpers,contextConsumerCalls:planReactContextConsumerCalls(reference,[initializer])};
 assert.throws(()=>createReactHelperObserver(reference,{...plan,contextConsumerCalls:[]}),/context-consumer-plan-changed/);
 const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {Control} from './fixture.tsx';import {A,B} from './targets.mjs';
 window.clicks=0;window.testRef=React.createRef();const root=createRoot(document.getElementById('root'));
 window.render=(label)=>root.render(React.createElement(A.Provider,{value:{label}},React.createElement(B.Provider,{value:{label:'b'}},React.createElement(Control,{id:'selected',onClick:()=>window.clicks++,ref:window.testRef}))));window.render('a');`;
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const mode of ['same','default','copy','foreign','implicit','caught-throw','proxy','argument-throw']){
  const pairs:unknown[]=[];
  for(const observed of [false,true]){
   const observer=createReactHelperObserver(reference,plan),input=observed?await observer.transform(entry,'react-reference.tsx','tsx'):{contents:entry,loader:'tsx' as const};
   const bundle=await build({stdin:{contents:input.contents,loader:input.loader,resolveDir:dir,sourcefile:'react-reference.tsx'},tsconfig:config,bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'guard',setup(b){b.onLoad({filter:/./},args=>args.path in files?observer.transform(readFileSync(args.path,'utf8'),args.path,args.path.endsWith('.tsx')?'tsx':'js'):undefined);}}]:[]});
   const javascript=observed?prepareReactJsxLookupBundle(bundle.outputFiles[0].text,plan).javascript:bundle.outputFiles[0].text;
   const page=await browser.newPage({viewport:{width:600,height:150}});try{
    await page.setContent('<div id="root"></div>');await page.evaluate(mode=>Object.assign(window,{mode,functions:[],argumentsSeen:[],helperCalls:0,proxyReads:0,proxyApplies:0,calleeReads:0,argumentEffects:0,opaque:new Proxy({},{get(){throw Error('argument reflected');}}),sentinel:new Error('original exception'),sameError:null,foreign:new Proxy({label:'foreign'},{get(target,key){(window as any).proxyReads++;return Reflect.get(target,key);}})}),mode);
    if(observed)await page.evaluate(reactHelperRuntimeHook([],[model],true,plan.initializers,[],[],[],calls,[],helpers,plan.contextConsumerCalls));
    await page.addScriptTag({content:javascript});await page.locator('#selected').filter({hasText:mode==='foreign'?'foreign:foreign':mode==='implicit'?'none:none':'a:b'}).waitFor({timeout:5000});
    await page.evaluate('window.render("updated")');await page.waitForFunction(mode==='caught-throw'?'window.helperCalls===6':'window.helperCalls===4');await page.locator('#selected').click();
    pairs.push({dom:await page.locator('#root').innerHTML(),png:await page.screenshot(),state:await page.evaluate('({clicks:window.clicks,ref:window.testRef.current===document.getElementById("selected"),helperCalls:window.helperCalls,argumentsSeen:window.argumentsSeen,proxyReads:window.proxyReads,sameError:window.sameError,proxyApplies:window.proxyApplies,calleeReads:window.calleeReads,argumentEffects:window.argumentEffects})')});
    if(observed){
     observer.complete();const r=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(r.status,'observed',JSON.stringify(r));if(r.status!=='observed')continue;
     const c=r.contexts!,h=c.helpers;assert.equal(h.qualification,'source-context-helper-return-identity-only');assert.equal(h.effectsVerified,false);assert.equal(h.acceptedContract,null);
     const renders=c.renders.invocations,boundaries=r.targetInitializers!.targets[0].invocations;
     assert.equal(c.renders.qualification,'original-render-context-boundaries-only');assert.equal(c.renders.effectsVerified,false);assert.equal(c.renders.acceptedContract,null);
     assert.equal(renders.length,2);assert.equal(boundaries.length,2);
     for(const [index,render] of renders.entries()){
      assert.equal(render.id,index);assert.deepEqual(render.source,initializer.render);assert.equal(render.completion,'returned');
      const boundary=boundaries.find(b=>b.input.render===render.id);assert(boundary);assert.equal(boundary.output.render,render.id);
      const input=new Map(boundary.input.fields),output=new Map(boundary.output.fields);
      assert.deepEqual(output.get('id'),input.get('id'));assert.deepEqual(output.get('onClick'),input.get('onClick'));
      assert.deepEqual(output.get('ref'),boundary.input.refValue);assert.equal(boundary.output.type.value,'button');assert.equal(boundary.output.key.kind,'null');
      assert.notEqual(boundary.input.value.identity,boundary.output.props.identity);
      assert.deepEqual(render.consumerCalls,c.consumerCalls.invocations.filter(i=>i.render===index).map(i=>i.id));
      assert.deepEqual(render.reads,c.reads.flatMap((r,i)=>r.render===index?[i]:[]));
     }
     assert.equal(h.planned,1);assert.equal(h.instances.length,2);assert.deepEqual(h.instances.map(i=>i.source),[helpers[0].source,helpers[0].source]);
     assert.deepEqual(h.invocations.map(i=>i.instance),mode==='caught-throw'?[0,0,1,0,0,1]:[0,1,0,1]);assert.deepEqual(h.invocations.map(i=>i.reads),h.invocations.map((_,i)=>[i]));
     for(const invocation of h.invocations){
      const thrown=mode==='caught-throw'&&(invocation.id===0||invocation.id===3);
      assert.equal(invocation.completion,thrown?'threw':'returned');assert.equal(invocation.returnSource===null,thrown||mode==='implicit');assert.deepEqual(invocation.consumer,initializer.render);
      assert(invocation.render!==null);for(const read of invocation.reads)assert.equal(c.reads[read].render,invocation.render);
      assert.deepEqual(invocation.matchingReads,!thrown&&['same','default','caught-throw','proxy','argument-throw'].includes(mode)?invocation.reads:[]);
      if(thrown)assert.equal(invocation.value,undefined);
     }
     assert.deepEqual(c.reads.map(v=>v.context),mode==='caught-throw'?[0,0,1,0,0,1]:[0,1,0,1]);assert.equal(await page.evaluate('window.proxyReads'),mode==='foreign'?4:0);
     if(mode==='caught-throw'||mode==='argument-throw')assert.equal(await page.evaluate('window.sameError'),true);
     const consumer=c.consumerCalls;assert.equal(consumer.qualification,'consumer-context-helper-call-identity-only');assert.equal(consumer.effectsVerified,false);assert.equal(consumer.acceptedContract,null);assert.equal(consumer.planned,plan.contextConsumerCalls.length);
     for(const invocation of consumer.invocations){
      assert.deepEqual(invocation.consumer,initializer.render);assert(plan.contextConsumerCalls.some(p=>JSON.stringify(p.call)===JSON.stringify(invocation.site)));
      if(invocation.helperInstance===null){assert.equal(invocation.helperInvocation,null);assert.equal(invocation.returnMatched,false);continue;}
      if(invocation.helperInvocation!==null){const helper=h.invocations[invocation.helperInvocation];assert.equal(helper.render,invocation.render);assert.equal(helper.sourceCall,invocation.id);assert.equal(helper.instance,invocation.helperInstance);assert.equal(invocation.returnMatched,invocation.completion==='returned');}
      else{assert.equal(mode,'argument-throw');assert.equal(invocation.completion,'threw');assert.deepEqual(invocation.arguments,[]);assert.equal(invocation.returnMatched,false);}
     }
     for(const helper of h.invocations){
      if(mode==='proxy'&&helper.instance===0)assert.equal(helper.sourceCall,null);
      else{assert.notEqual(helper.sourceCall,null);assert.equal(consumer.invocations[helper.sourceCall!].helperInvocation,helper.id);}
     }
     assert.equal(await page.evaluate('window.calleeReads'),0);assert.equal(await page.evaluate('window.proxyApplies'),mode==='proxy'?2:0);
     if(!['default','argument-throw'].includes(mode))assert.equal(await page.evaluate('window.argumentEffects'),2);
     if(mode==='same'){const passed=consumer.invocations.filter(i=>i.helperInstance===0);assert(passed.every(i=>i.arguments.length===2&&i.arguments[0].value==='same'&&i.arguments[1].kind==='object'));}
     await page.evaluate('window.__DSC_RUNTIME_READ().contexts.helpers.invocations[0].matchingReads.push(999)');assert.deepEqual(await page.evaluate(reactHelperRuntimeRead),r);
     await page.evaluate('window.__DSC_RUNTIME_READ().contexts.renders.invocations[0].consumerCalls.push(999);window.__DSC_RUNTIME_READ().targetInitializers.targets[0].invocations[0].input.fields[0][1].value="forged"');assert.deepEqual(await page.evaluate(reactHelperRuntimeRead),r);
     await page.evaluate('Object.defineProperty(window.functions[0],"changed",{get(){window.proxyReads++;return true;}})');
     const changed=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(changed.status,'refused');if(changed.status==='refused')assert.equal(changed.reason,'context-helper-boundary-changed');
     assert.equal(await page.evaluate('window.proxyReads'),mode==='foreign'?4:0);
    }
   }finally{await page.close();}
  }
  assert.deepEqual(pairs[1],pairs[0],mode);
 }
});
