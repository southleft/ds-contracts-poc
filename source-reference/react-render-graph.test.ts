import {planReactConsumerLiterals} from './react-consumer-literals.js';
import {reactRenderGraphRuntime} from './react-render-graph-runtime.js';
import {verifyReactRenderGraph,reactRenderMembership} from './react-render-graph.js';
import {reactOwnershipHook,reactOwnershipRead,type ReactOwnership} from './react-ownership.js';
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

test('actual committed hosts join original render identities and authored children across updates',async t=>{
 const repo=process.cwd(),dir=mkdtempSync(path.join(repo,'source-reference/.render-graph-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const text=`import React from 'react';import {Indicator} from './targets.mjs';export const Control=React.forwardRef((props,ref)=><Indicator id={props.id} onClick={props.onClick} ref={ref}><span>Control</span><b>Value</b></Indicator>);`;
 const targetSource=`import * as React from 'react';import {jsx} from 'react/jsx-runtime';import {Widgets} from './tables.mjs';
 export const Context=React.createContext(null);
 export function Provider(props){const {children,...value}=props;return jsx(Context.Provider,{value,children});}
 function useSelection(name){const value=React.useContext(Context);if(value)return value;throw new Error(name);}
 var NAME='indicator';function label(active){return active?'on':'off';}
 export const Indicator=React.forwardRef(function Reader(props,ref){const value=useSelection(NAME);const shared={active:value.active,item:value.payload};const metadata={first:shared,second:shared,list:[shared,{label:"stable",absent:void 0}]};const style={...props.style,...value.optional,width:value.active?104:96,opacity:1};return jsx(Widgets.control,{'data-state':label(value.active),...props,style,metadata,ref});});`;
 const tableSource=`import * as React from 'react';import {jsx} from 'react/jsx-runtime';const Node=React.forwardRef((props,ref)=>{const {metadata,...rest}=props;window.metadata=metadata;window.same=metadata.first===metadata.second&&metadata.first===metadata.list[0];return jsx('button',{...rest,ref,children:[rest.children,jsx('i',{children:'Extra'})]});});export const Widgets={control:Node};`;
 const file=path.join(dir,'fixture.tsx'),targetFile=path.join(dir,'targets.mjs'),tableFile=path.join(dir,'tables.mjs'),config=path.join(dir,'tsconfig.json'),files:Record<string,string>={};
 for(const [f,s] of [[file,text],[targetFile,targetSource],[tableFile,tableSource],[config,'{"compilerOptions":{"jsx":"react-jsx","module":"ESNext","target":"ES2022","moduleResolution":"Bundler"}}']]){writeFileSync(f,s);files[f]=sha(s);}
 for(const a of reactRuntimeAdapters){const f=repo+a.suffix;files[f]=sha(readFileSync(f,'utf8'));}
 const reference={sourceRoot:dir,files,runtimeImports:[{importer:file,specifier:'./targets.mjs',file:targetFile},{importer:targetFile,specifier:'./tables.mjs',file:tableFile}]} as unknown as ReactReference;
 const target=readReactRuntimeExport(reference,'targets.mjs',['Indicator']);assert.equal(target.status,'resolved');if(target.status!=='resolved')return;
 const initializer=readReactTargetInitializer(reference,target.definition),{program,sf,source,runtimeFiles}=prepareReactEffectProgram(reference,'fixture.tsx',{},{});let component:ts.ArrowFunction|undefined;
 const find=(n:ts.Node)=>{if(ts.isArrowFunction(n)&&n.parameters.length===2)component=n;ts.forEachChild(n,find);};find(sf);assert(component&&ts.isIdentifier(component.parameters[0].name));
 const model=modelReactJsxComponent({program,component,parameter:component.parameters[0].name,properties:[['id','selected'],['onClick',{opaque:'function'}]],contentKey:'children',source,runtimeFiles,resolution:reference.runtimeImports,jsxTarget:()=>({file:target.definition.module,sha256:target.definition.sourceSha256,...target.definition.span})});assert.equal(model.status,'modeled');if(model.status!=='modeled')return;
 const calls=planReactContextCalls(reference),initializers=[initializer],factories=planReactContextFactoryCalls(reference,initializers);
 const plan:import('./react-helper-instrument.js').ReactJsxHelperInstrumentationPlan={kind:'jsx-component' as const,models:[model],component:model.component,targets:[target.definition],initializers,contextCalls:calls,contextRests:planReactContextRests(reference,calls),contextHelpers:planReactContextHelpers(reference,calls),contextConsumerCalls:planReactContextConsumerCalls(reference,initializers),contextFactories:factories,contextBindings:planReactContextBindings(reference,initializers),contextTargets:planReactContextTargets(reference,factories)};
 plan.consumerLiterals=planReactConsumerLiterals(reference,initializers);assert.equal(plan.consumerLiterals.length,6);
 const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {Control} from './fixture.tsx';import {Provider} from './targets.mjs';window.__DSC_REACT_EXPORTS=[];window.clicks=0;window.testRef=React.createRef();const root=createRoot(document.getElementById('root'));window.render=active=>root.render(React.createElement(Provider,{active,payload:window.opaque,optional:active?void 0:null},React.createElement(Control,{id:'selected',onClick:()=>window.clicks++,ref:window.testRef})));window.unmount=()=>root.unmount();window.render(false);`;
 const browser=await chromium.launch();t.after(()=>browser.close());const pairs:unknown[]=[];
 for(const observed of [false,true]){
  const observer=createReactHelperObserver(reference,plan),input=observed?await observer.transform(entry,'react-reference.tsx','tsx'):{contents:entry,loader:'tsx' as const};
  const bundle=await build({stdin:{contents:input.contents,loader:input.loader,resolveDir:dir,sourcefile:'react-reference.tsx'},tsconfig:config,bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'guard',setup(b){b.onLoad({filter:/./},args=>args.path in files?observer.transform(readFileSync(args.path,'utf8'),args.path,args.path.endsWith('.tsx')?'tsx':'js'):undefined);}}]:[]});
  const prepared=observed?prepareReactJsxLookupBundle(bundle.outputFiles[0].text,plan):undefined;if(observed)observer.complete();
  const page=await browser.newPage({viewport:{width:400,height:120}});try{
   await page.setContent('<div id="root"></div>');await page.evaluate(reactOwnershipHook);await page.evaluate(()=>{(window as any).opaque=new Proxy({}, {get(){throw Error('opaque accessed');},ownKeys(){throw Error('opaque reflected');}});});
   if(observed)await page.evaluate(reactHelperRuntimeHook([],[model],true,initializers,[],[],[],calls,plan.contextRests,plan.contextHelpers,plan.contextConsumerCalls,factories,plan.contextBindings,plan.contextTargets,plan.callbackSources,plan.refHooks,plan.effectHooks,plan.callbackFactories,plan.hookHelpers,plan.consumerLiterals));
   await page.addScriptTag({content:prepared?.javascript??bundle.outputFiles[0].text});await page.locator('[data-state="off"]').waitFor();
   await page.evaluate('window.render(true)');await page.locator('[data-state="on"]').waitFor();await page.locator('#selected').click();
   const dom=await page.locator('#root').innerHTML(),png=await page.screenshot();
   pairs.push({dom,png,state:await page.evaluate('({clicks:window.clicks,same:window.same,opaque:window.metadata.first.item===window.opaque})')});
   if(!observed)continue;
   const ownership=await page.evaluate<ReactOwnership>(reactOwnershipRead('#selected',true));assert.deepEqual(ownership.problems,[]);assert.equal(ownership.nodes.length,4);
   const runtime=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(runtime.status,'observed');if(runtime.status!=='observed')continue;
   assert.deepEqual(await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead),runtime);
   const consumers=verifyReactContextConsumers(reference,plan,runtime,prepared!.proof);assert(consumers.rows.every(r=>r.status==='verified'));
   const graph=verifyReactRenderGraph(ownership,runtime,consumers);assert.equal(graph.rows.length,4);
   assert.equal(graph.rows[0].status,'linked',JSON.stringify(graph));
   assert(graph.rows[0].steps.some(s=>s.consumerBodyVerified));assert(graph.rows[0].steps.some(s=>s.componentModels.length));
   for(const child of graph.rows.slice(1,3)){
    assert.equal(child.status,'linked',JSON.stringify(child));
    assert(child.steps.some(s=>s.membership?.some(m=>m.kind==='array-index')));
   }
   assert.equal(graph.rows[3].reason,'render-graph-membership-children-origin-unproved');
   const childStep=graph.rows[1].steps.find(s=>s.membership)!,arrayStep=childStep.membership!.find(m=>m.kind==='array-index')!;
   assert.equal(arrayStep.kind,'array-index');if(arrayStep.kind!=='array-index')continue;
   for(const attack of ['array-current','array-order','array-identity','array-duplicate','child-edge','child-origin','return-time','target-absent','cycle']){
    const changed:Extract<ReactHelperRuntimeReport,{status:'observed'}>=structuredClone(runtime);const g=changed.renderGraph!,list=g.arrays[arrayStep.array],r=g.renders[childStep.render];
    if(attack==='array-current')list.currentValuesVerified=false;
    if(attack==='array-order')list.items.reverse();
    if(attack==='array-identity')list.value={kind:'object',identity:99999};
    if(attack==='array-duplicate')list.items[1]=list.items[0];
    if(attack==='child-edge')g.factories[r.returnedFactory!].children={status:'verified',value:{kind:'object',identity:99999}};
    if(attack==='child-origin')g.factories[r.returnedFactory!].children={status:'refused',reason:'unproved'};
    if(attack==='return-time')r.membership={status:'refused',reason:'array-changed'};
    if(attack==='target-absent')list.items[0]={kind:'string',value:'removed'};
    if(attack==='cycle')list.items[1]=list.value;
    assert.equal(verifyReactRenderGraph(ownership,changed,consumers).rows[1].status,'refused',attack);
   }
   assert.equal(graph.acceptedContract,null);assert.equal(graph.effectsVerified,false);
   const first=graph.rows[0].steps[0],withConsumer=graph.rows[0].steps.find(s=>s.consumerBodyVerified)!;
   for(const attack of ['host-factory','host-props','host-type','creator','returned','input','duplicate','source-render','consumer-source','model','stale']){
    const changed:Extract<ReactHelperRuntimeReport,{status:'observed'}>=structuredClone(runtime);const owned=structuredClone(ownership),proof=structuredClone(consumers),g=changed.renderGraph!,host=owned.nodes[0].renderGraph!;
    assert.equal(host.status,'matched');if(host.status!=='matched')continue;
    if(attack==='host-factory')host.factory=99999;if(attack==='host-props')host.props={kind:'object',identity:99999};if(attack==='host-type')host.type={kind:'string',value:'aside'};
    if(attack==='creator')g.factories[first.factory].createdIn=99999;
    if(attack==='returned')g.renders[first.render].output={kind:'object',identity:99999};
    if(attack==='input')g.renders[first.render].factoryProps={kind:'object',identity:99999};
    if(attack==='duplicate')g.factories.push({...structuredClone(g.factories[first.factory]),id:g.factories.length});
    if(attack==='source-render')g.renders[withConsumer.render].sourceRender=99999;
    if(attack==='consumer-source')proof.rows.find(r=>r.render===withConsumer.sourceRender)!.source.start++;
    if(attack==='model')g.renders[first.render].componentModels=[99999];
    if(attack==='stale')g.factories[first.factory].current=false;
    const refused=verifyReactRenderGraph(owned,changed,proof);assert.equal(refused.rows[0].status,'refused',attack);
   }
   assert.equal(await page.evaluate(`window.__DSC_RUNTIME_PROOF.renderGraphHost(window.opaque,'button').status`),'refused');
  }finally{await page.close();}
 }
 assert.deepEqual(pairs[0],pairs[1]);
});


test('render graph refuses unknown props before reflection and preserves original return and thrown identities',()=>{
 const N={WeakMapCtor:WeakMap,mapGet:WeakMap.prototype.get,mapSet:WeakMap.prototype.set,apply:Reflect.apply,is:Object.is,descriptors:Object.getOwnPropertyDescriptors};
 const ids=new Map<unknown,number>(),witness=(v:unknown)=>{if(!ids.has(v))ids.set(v,ids.size);return {kind:typeof v,identity:ids.get(v)};};
 const known=new WeakMap<object,object>();let traps=0,current=true;
 const api=Function('return '+reactRenderGraphRuntime)()(N,()=>{},(s:string)=>{throw Error(s);},witness,{factoryProps:(v:object)=>known.get(v),current:()=>current,children:()=>({status:'refused',reason:'unproved'})});
 const opaque=new Proxy({}, {get(){traps++;throw Error('get');},getPrototypeOf(){traps++;throw Error('prototype');},getOwnPropertyDescriptor(){traps++;throw Error('descriptor');},ownKeys(){traps++;throw Error('keys');}});
 assert.equal(api.host(opaque,'button').status,'refused');assert.equal(traps,0);
 const props={},element={},owner={},origin={props,descriptors:{type:{value:'button'},_owner:{value:owner}}};known.set(props,props);
 const fn=()=>element;assert.equal(api.invoke(fn,props,()=>{api.factory(element,origin);return element;}),element);
 assert.equal(api.host(props,'button',owner).status,'matched');assert.equal(api.host(props,'button',{}).status,'refused');
 current=false;assert.equal(api.host(props,'button',owner).status,'refused');current=true;
 const native=Object.freeze({props:opaque,type:'input',_owner:owner});
 assert.equal(api.native(native,opaque,'input'),native);assert.equal(api.host(opaque,'input',owner).status,'matched');assert.equal(traps,0);
 api.native(Object.freeze({props:opaque,type:'input',_owner:owner}),opaque,'input');
 assert.equal(api.host(opaque,'input',owner).status,'refused');assert.equal(traps,0);
 const original=Error('original');assert.throws(()=>api.invoke(fn,opaque,()=>{throw original;}),e=>e===original);assert.equal(traps,0);
 const report=api.report();assert.deepEqual(report.renders.map((r:any)=>r.completion),['returned','threw']);assert.equal(report.factories[0].createdIn,0);assert.equal(report.effectsVerified,false);assert.equal(report.acceptedContract,null);
});

test('membership uses original arrays at return time and refuses mutation, opaque siblings and duplicate children',()=>{
 for(const attack of ['none','freeze','seal','duplicate','unknown-array','opaque','getter','prototype','order','extra-key','length','mutate-at-return','mutate-after-return']){
  const N={WeakMapCtor:WeakMap,mapGet:WeakMap.prototype.get,mapSet:WeakMap.prototype.set,apply:Reflect.apply,is:Object.is,
   descriptors:Object.getOwnPropertyDescriptors,descriptor:Object.getOwnPropertyDescriptor,prototype:Object.getPrototypeOf,keys:Reflect.ownKeys,
   array:Array.isArray,integer:Number.isSafeInteger,string:String,extensible:Object.isExtensible};
  const ids=new Map<unknown,number>(),witness=(value:unknown):any=>{
   if(value===null)return {kind:'null'};if(value===undefined)return {kind:'undefined'};
   if(typeof value!=='object'&&typeof value!=='function')return {kind:typeof value,value};
   if(!ids.has(value))ids.set(value,ids.size);return {kind:typeof value,identity:ids.get(value)};
  };
  const children=new WeakMap<object,unknown>();let traps=0;
  const api=Function('return '+reactRenderGraphRuntime)()(N,()=>{},(s:string)=>{throw Error(s);},witness,{
   factoryProps:(v:unknown)=>v,current:()=>true,
   children:(v:object)=>children.has(v)?{status:'verified',value:children.get(v)}:{status:'refused',reason:'unproved'}
  });
  const opaque=new Proxy({}, {get(){traps++;throw Error('get');},getPrototypeOf(){traps++;throw Error('prototype');},ownKeys(){traps++;throw Error('keys');},getOwnPropertyDescriptor(){traps++;throw Error('descriptor');}});
  function element(child?:unknown){const value=Object.freeze({type:'div',props:Object.freeze({children:child})});children.set(value,child);api.factory(value,{props:value.props,descriptors:Object.getOwnPropertyDescriptors(value)});return value;}
  let leaf:any,list:any[]=[];
  const returned=api.invoke(()=>{}, {},()=>{
   leaf=element('leaf');const other=element('other');
   list=attack==='unknown-array'?[leaf,other]:api.literal([leaf,attack==='duplicate'?leaf:attack==='opaque'?opaque:other]);
   const outer=api.literal([null,list]);
   if(attack==='freeze')Object.freeze(list);if(attack==='seal')Object.seal(list);
   if(attack==='getter')Object.defineProperty(list,'1',{get(){traps++;throw Error('getter');}});
   if(attack==='prototype')Object.setPrototypeOf(list,null);
   if(attack==='order')list.reverse();if(attack==='extra-key')Object.defineProperty(list,'extra',{value:1});if(attack==='length')list.length=1;
   if(attack==='mutate-at-return')list[0]=other;
   return element(outer);
  });
  if(attack==='mutate-at-return')list[0]=leaf; // A later restoration cannot rewrite what returned.
  if(attack==='mutate-after-return')list[0]=null;
  const graph=api.report();assert.equal(traps,0,attack);assert.deepEqual(graph.renders[0].output,witness(returned));
  api.literal([opaque]);assert.deepEqual(api.report(),graph,'unconsumed allocations cannot change return evidence');
  const target=graph.factories.find((f:any)=>JSON.stringify(f.element)===JSON.stringify(witness(leaf))).id;
  if(['none','freeze','seal'].includes(attack)){
   const route=reactRenderMembership(graph,graph.renders[0],target);assert.deepEqual(route.map(s=>s.kind),['children','array-index','array-index']);
  }else assert.throws(()=>reactRenderMembership(graph,graph.renders[0],target),/render-graph-membership-/,attack);
 }
});
