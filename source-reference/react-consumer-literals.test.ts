import {planReactConsumerLiterals} from './react-consumer-literals.js';
import {reactConsumerLiteralRuntime} from './react-consumer-literal-runtime.js';
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

test('original nested records and arrays retain values, aliases and opaque leaves across renders',async t=>{
 const repo=process.cwd(),dir=mkdtempSync(path.join(repo,'source-reference/.consumer-literals-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const text=`import React from 'react';import {Indicator} from './targets.mjs';export const Control=React.forwardRef((props,ref)=><Indicator id={props.id} onClick={props.onClick} ref={ref}/>);`;
 const targetSource=`import * as React from 'react';import {jsx} from 'react/jsx-runtime';import {Widgets} from './tables.mjs';
 export const Context=React.createContext(null);
 export function Provider(props){const {children,...value}=props;return jsx(Context.Provider,{value,children});}
 function useSelection(name){const value=React.useContext(Context);if(value)return value;throw new Error(name);}
 var NAME='indicator';function label(active){return active?'on':'off';}
 export const Indicator=React.forwardRef(function Reader(props,ref){const value=useSelection(NAME);const shared={active:value.active,item:value.payload};const metadata={first:shared,second:shared,list:[shared,{label:"stable",absent:void 0}]};const style={...props.style,...value.optional,width:value.active?104:96,opacity:1};return jsx(Widgets.control,{'data-state':label(value.active),...props,style,metadata,ref});});`;
 const tableSource=`import * as React from 'react';import {jsx} from 'react/jsx-runtime';const Node=React.forwardRef((props,ref)=>{const {metadata,...rest}=props;window.metadata=metadata;window.same=metadata.first===metadata.second&&metadata.first===metadata.list[0];return jsx('button',{...rest,ref,children:'Control'});});export const Widgets={control:Node};`;
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
 const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {Control} from './fixture.tsx';import {Provider} from './targets.mjs';window.clicks=0;window.testRef=React.createRef();const root=createRoot(document.getElementById('root'));window.render=active=>root.render(React.createElement(Provider,{active,payload:window.opaque,optional:active?void 0:null},React.createElement(Control,{id:'selected',onClick:()=>window.clicks++,ref:window.testRef})));window.unmount=()=>root.unmount();window.render(false);`;
 const browser=await chromium.launch();t.after(()=>browser.close());const pairs:unknown[]=[];
 for(const observed of [false,true]){
  const observer=createReactHelperObserver(reference,plan),input=observed?await observer.transform(entry,'react-reference.tsx','tsx'):{contents:entry,loader:'tsx' as const};
  const bundle=await build({stdin:{contents:input.contents,loader:input.loader,resolveDir:dir,sourcefile:'react-reference.tsx'},tsconfig:config,bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'guard',setup(b){b.onLoad({filter:/./},args=>args.path in files?observer.transform(readFileSync(args.path,'utf8'),args.path,args.path.endsWith('.tsx')?'tsx':'js'):undefined);}}]:[]});
  const prepared=observed?prepareReactJsxLookupBundle(bundle.outputFiles[0].text,plan):undefined;if(observed)observer.complete();
  const page=await browser.newPage({viewport:{width:400,height:120}});try{
   await page.setContent('<div id="root"></div>');await page.evaluate(()=>{(window as any).opaque=new Proxy({}, {get(){throw Error('opaque accessed');},ownKeys(){throw Error('opaque reflected');}});});
   if(observed)await page.evaluate(reactHelperRuntimeHook([],[model],true,initializers,[],[],[],calls,plan.contextRests,plan.contextHelpers,plan.contextConsumerCalls,factories,plan.contextBindings,plan.contextTargets,plan.callbackSources,plan.refHooks,plan.effectHooks,plan.callbackFactories,plan.hookHelpers,plan.consumerLiterals));
   await page.addScriptTag({content:prepared?.javascript??bundle.outputFiles[0].text});await page.locator('[data-state="off"]').waitFor();
   await page.evaluate('window.render(true)');await page.locator('[data-state="on"]').waitFor();await page.locator('#selected').click();
   const dom=await page.locator('#root').innerHTML(),png=await page.screenshot();
   pairs.push({dom,png,state:await page.evaluate('({clicks:window.clicks,same:window.same,opaque:window.metadata.first.item===window.opaque})')});
   if(!observed)continue;
   const runtime=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(runtime.status,'observed');if(runtime.status!=='observed')continue;
   const verified=verifyReactContextConsumers(reference,plan,runtime,prepared!.proof);
   assert.equal(verified.rows.length,2);assert(verified.rows.every(r=>r.status==='verified'&&r.literalValues.length===5),JSON.stringify(verified));
   const records=runtime.consumerLiterals!.records;assert.equal(records.length,12);assert(records.every(r=>r.creationDataVerified&&r.currentValuesVerified));
   for(const attack of ['missing','origin','value','order','kind','creation','current','render','duplicate','array-length','alias','plan']){
    const changed=structuredClone(runtime),changedPlan=structuredClone(plan),rs=changed.consumerLiterals!.records,style=rs.find(r=>r.render===1&&r.fields.some(([k])=>k==='width'))!,list=rs.find(r=>r.render===1&&r.kind==='array')!;
    if(attack==='missing')rs.splice(style.id,1);if(attack==='origin')style.source.start++;if(attack==='value')style.fields[0][1]={kind:'number',value:999};if(attack==='order')style.fields.reverse();
    if(attack==='kind')style.kind='array';if(attack==='creation')style.creationDataVerified=false;if(attack==='current')style.currentValuesVerified=false;if(attack==='render')style.render=999;
    if(attack==='duplicate')rs.push(structuredClone(style));if(attack==='array-length')list.length=99;if(attack==='plan')changedPlan.consumerLiterals=[];
    if(attack==='alias'){
     const shared=rs.find(r=>r.render===1&&r.fields.some(([k])=>k==='active'))!,metadata=rs.find(r=>r.render===1&&r.fields.some(([k])=>k==='second'))!,copy=structuredClone(shared);
     copy.id=rs.length;copy.value={kind:'object',identity:99999};rs.push(copy);metadata.fields.find(([k])=>k==='second')![1]=copy.value;
    }
    const refused=verifyReactContextConsumers(reference,changedPlan,changed,prepared!.proof);assert.equal(refused.rows[1].status,'refused',attack);assert.equal(refused.rows[1].consumerBodyVerified,false,attack);
   }
  }finally{await page.close();}
 }
 assert.deepEqual(pairs[0],pairs[1]);
});


test('fresh literal snapshots allow freezing but refuse changed values, accessors, prototypes, keys and unknown sites without opaque reads',()=>{
 const N={WeakMapCtor:WeakMap,descriptors:Object.getOwnPropertyDescriptors,descriptor:Object.getOwnPropertyDescriptor,prototype:Object.getPrototypeOf,keys:Reflect.ownKeys,apply:Reflect.apply,mapGet:WeakMap.prototype.get,mapSet:WeakMap.prototype.set,is:Object.is};
 const source={file:'render.mjs',sha256:'hash',start:1,end:2},consumer={...source,start:0,end:3},key=(p:typeof source)=>JSON.stringify([p.file,p.sha256,p.start,p.end]);
 for(const kind of ['record','array'] as const)for(const attack of ['none','freeze','value','getter','prototype','key']){
  let traps=0;const opaque=new Proxy({}, {get(){traps++;throw Error('get');},ownKeys(){traps++;throw Error('keys');},getPrototypeOf(){traps++;throw Error('prototype');},getOwnPropertyDescriptor(){traps++;throw Error('descriptor');}}),ids=new Map<unknown,number>();
  const api=Function('return '+reactConsumerLiteralRuntime)()([{source,consumer,kind}],N,()=>{},(s:string)=>{throw Error(s);},()=>({render:0,renderSource:key(consumer)}),(value:unknown)=>{if(!ids.has(value))ids.set(value,ids.size);return {kind:typeof value,identity:ids.get(value)};});
  assert.throws(()=>api.capture('unknown',opaque),/consumer-literal-scope/);assert.equal(traps,0);
  const value:any=kind==='record'?{entry:opaque}:[opaque],field=kind==='record'?'entry':'0';assert.equal(api.capture(key(source),value),value);
  if(attack==='freeze')Object.freeze(value);if(attack==='value')value[field]=null;if(attack==='getter')Object.defineProperty(value,field,{get(){traps++;throw Error('getter');}});if(attack==='prototype')Object.setPrototypeOf(value,opaque);if(attack==='key')value.extra=1;
  const record=api.report().records[0];assert(record.creationDataVerified);assert.equal(record.currentValuesVerified,attack==='none'||attack==='freeze',kind+' '+attack);assert.equal(traps,0);assert.equal(api.report().effectsVerified,false);
 }
});
