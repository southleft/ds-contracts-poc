import {planReactConsumerLiterals} from './react-consumer-literals.js';
import {reactConsumerLiteralRuntime} from './react-consumer-literal-runtime.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,realpathSync} from 'node:fs';
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
 for(const a of reactRuntimeAdapters){const f=realpathSync(repo+a.suffix);files[f]=sha(readFileSync(f,'utf8'));}
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

test('imported synchronous helpers preserve allocation, call and ordered mutation authority',async t=>{
 const {readReactContextConsumerEffects}=await import('./react-target-effects.js');
 const {planContextImportFunctions}=await import('./react-context-import-functions.js');
 const repo=process.cwd(),dir=mkdtempSync(path.join(repo,'source-reference/.consumer-mutations-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const source=`import * as React from 'react';import {jsx} from 'react/jsx-runtime';import {extract} from './helper.mjs';import {defs} from './defs.mjs';export const Control=React.forwardRef(function Render(props,ref){const next=extract(props,defs);return jsx('span',{...next,ref});});`;
 const helper=`function merge(...args){return Object.assign({},...args);}export function extract(props,defs){const out={...props};const twin={...defs};const table=merge(defs);for(const key in table){const rule=table[key];if(rule.remove)delete out[key];else out[key]=rule.prefix+out[key];}return out;}`;
 const definitions=`export const defs={strip:{remove:true},id:{prefix:'checked-'}};`;
 const file=path.join(dir,'consumer.mjs'),helperFile=path.join(dir,'helper.mjs'),defsFile=path.join(dir,'defs.mjs'),config=path.join(dir,'tsconfig.json'),files:Record<string,string>={};
 for(const [f,s]of[[file,source],[helperFile,helper],[defsFile,definitions],[config,'{"compilerOptions":{"module":"ESNext","target":"ES2022","moduleResolution":"Bundler"}}']]){writeFileSync(f,s);files[f]=sha(s);}
 for(const a of reactRuntimeAdapters){const f=realpathSync(repo+a.suffix);files[f]=sha(readFileSync(f,'utf8'));}
 const reference={sourceRoot:dir,files,runtimeImports:[{importer:file,specifier:'./helper.mjs',file:helperFile},{importer:file,specifier:'./defs.mjs',file:defsFile}]} as unknown as ReactReference;
 const target=readReactRuntimeExport(reference,'consumer.mjs',['Control']);assert.equal(target.status,'resolved');if(target.status!=='resolved')return;
 const initializer=readReactTargetInitializer(reference,target.definition),initializers=[initializer];
 const invocation={version:1,acceptedContract:null,effectsVerified:false,status:'observed',invocation:1,function:{module:'consumer.mjs',sourceSha256:sha(source),span:{start:initializer.render.start,end:initializer.render.end},parameters:[]},input:[['id',{kind:'string',value:'one'}],['strip',{kind:'string',value:'unused'}],['children',{kind:'string',value:'content'}]],childrenIdentity:'same-value',secondaryKinds:['object'],closureReads:[],globalReads:[],effects:[],inputProvenance:{status:'verified',qualification:'react-props-origin-only',kind:'jsx',source:{module:'consumer.mjs',sourceSha256:sha(source),span:{start:0,end:1},factory:'jsx'}},outputProvenance:{status:'verified',qualification:'react-props-origin-only',kind:'jsx',source:{module:'consumer.mjs',sourceSha256:sha(source),span:{start:0,end:1},factory:'jsx'}}} as import('./react-element-invocation.js').ReactElementInvocation;
 const model=readReactContextConsumerEffects(reference,initializer,invocation,[]);assert.equal(model.status,'modeled',JSON.stringify(model));if(model.status!=='modeled')return;
 const contextFactories=planReactContextFactoryCalls(reference,initializers),contextBindings=planReactContextBindings(reference,initializers),contextImportFunctions=[{initializer,invocation}],imports=planContextImportFunctions(reference,contextImportFunctions);contextBindings.reads.push(...imports.reads);contextBindings.functions.push(...imports.functions);
 const plan:import('./react-helper-instrument.js').ReactJsxHelperInstrumentationPlan={kind:'jsx-component',boundaryOnly:true,models:[],bodyModels:[model],targets:[target.definition],initializers,contextFactories,contextConsumerCalls:planReactContextConsumerCalls(reference,initializers),contextBindings,contextTargets:planReactContextTargets(reference,contextFactories),contextImportFunctions,consumerLiterals:planReactConsumerLiterals(reference,initializers,[model])};
 const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {Control} from './consumer.mjs';createRoot(document.getElementById('root')).render(React.createElement(Control,{id:'one',strip:'unused',children:'content'}));`;
 const browser=await chromium.launch();t.after(()=>browser.close());const outputs=[];
 for(const observed of [false,true]){
  const observer=createReactHelperObserver(reference,plan),input=observed?await observer.transform(entry,'react-reference.tsx','tsx'):{contents:entry,loader:'tsx' as const};
  const bundle=await build({stdin:{contents:input.contents,loader:input.loader,resolveDir:dir,sourcefile:'react-reference.tsx'},tsconfig:config,bundle:true,write:false,format:'iife',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'guard',setup(b){b.onLoad({filter:/./},args=>args.path in files?observer.transform(readFileSync(args.path,'utf8'),args.path,'js'):undefined);}}]:[]});
  const prepared=observed?prepareReactJsxLookupBundle(bundle.outputFiles[0].text,plan):undefined;if(observed)observer.complete();
  const page=await browser.newPage();try{
   await page.setContent('<div id="root"></div>');if(observed)await page.evaluate(reactHelperRuntimeHook([],[],true,initializers,[],[],[],[],[],[],plan.contextConsumerCalls,contextFactories,contextBindings,plan.contextTargets,undefined,[],[],undefined,undefined,plan.consumerLiterals,true,[model]));
   await page.addScriptTag({content:prepared?.javascript??bundle.outputFiles[0].text});await page.locator('#checked-one').waitFor();outputs.push(await page.locator('#root').innerHTML());if(!observed)continue;
   const runtime=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(runtime.status,'observed',JSON.stringify(runtime));if(runtime.status!=='observed')continue;
   if(process.env.DSC_SPIKE_RECEIPTS){writeFileSync(path.join(process.env.DSC_SPIKE_RECEIPTS,'fixture-model.json'),JSON.stringify(model,null,2));writeFileSync(path.join(process.env.DSC_SPIKE_RECEIPTS,'fixture-runtime.json'),JSON.stringify(runtime,null,2));writeFileSync(path.join(process.env.DSC_SPIKE_RECEIPTS,'fixture-plan.json'),JSON.stringify(plan,null,2));}
   const verify=(r:ReactHelperRuntimeReport)=>verifyReactContextConsumers(reference,plan,r,prepared!.proof),result=verify(runtime);assert.equal(result.rows[0].status,'verified',JSON.stringify(result));
   assert(result.rows[0].literalValues.some(v=>v.mutationEffectsVerified));assert(runtime.consumerLiterals!.records.some(r=>!r.currentValuesVerified));
   for(const attack of ['old','creation','call-order','call-result','call-argument','mutation-order','mutation-source','mutation-key','mutation-value','mutation-after','native-input','alias','current','descriptor','extra-write','callee','call-before','call-after','nested-before','mutation-nested-before','assign-closure','assign-operand','current-flag','coordinated-native-source','coordinated-operand-source']){
    const r:Extract<ReactHelperRuntimeReport,{status:'observed'}>=structuredClone(runtime),l=r.consumerLiterals!;const mutation=l.mutations!.find(m=>m.operation==='set')!,assign=l.mutations!.find(m=>m.operation==='assign')!;
    if(attack==='old'){delete l.calls;delete l.mutations;}if(attack==='creation')l.records[mutation.record].fields=[];
    if(attack==='call-order')l.calls![0].entry++;if(attack==='call-result')l.calls![0].result={kind:'object',identity:9999};if(attack==='call-argument')l.calls![0].arguments[0]={kind:'object',identity:9999};
    if(attack==='mutation-order')mutation.sequence++;if(attack==='mutation-source')mutation.site='foreign';if(attack==='mutation-key')mutation.key='children';if(attack==='mutation-value')mutation.value={kind:'string',value:'forged'};
    if(attack==='mutation-after')mutation.after[0].fields=[];if(attack==='native-input')assign.inputs![0].fields.reverse();if(attack==='alias')assign.inputs![0].record=mutation.record;
    if(attack==='current')l.records[mutation.record].current!.fields=[];if(attack==='descriptor')mutation.before[0].dataVerified=false;if(attack==='extra-write')l.mutations!.push(structuredClone(mutation));
    if(attack==='callee')l.calls![0].callee={kind:'function',identity:9999};if(attack==='call-before')l.calls![0].before=[];if(attack==='call-after')l.calls![0].after=[];
    if(attack==='nested-before')l.calls![0].before.splice(1,1);if(attack==='mutation-nested-before')assign.after.splice(1,1);if(attack==='assign-closure')assign.inputSnapshots=[];
    if(attack==='assign-operand')assign.arguments![1]=l.records.find(x=>x.id===mutation.record)!.value;if(attack==='current-flag')l.records[mutation.record].currentValuesVerified=true;
    if(attack==='coordinated-native-source'||attack==='coordinated-operand-source'){
     const twin=l.records.find(x=>x.source.file==='helper.mjs'&&helper.slice(x.source.start,x.source.end)==='{...defs}')!;
     const replacement={...assign.inputs![0],record:twin.id};assign.inputValues![0]=twin.value;assign.inputs![0]=replacement;assign.inputSnapshots![0]=replacement;
     if(attack==='coordinated-operand-source')assign.arguments![1]=twin.value;
    }
    assert.equal(verify(r).rows[0].status,'refused',attack);
   }
  }finally{await page.close();}
 }
 assert.deepEqual(outputs[0],outputs[1]);
});

test('supplemental allocation and mutation injection refuses lexical globalThis shadows',()=>{
 const dir=mkdtempSync(path.join(process.cwd(),'source-reference/.consumer-shadow-'));
 try{for(const at of ['allocation','write'] as const){
  const text=at==='allocation'?'export function f(globalThis){return {value:1};}':'export function f(globalThis,value){value.x=2;return value;}';
  const file=path.join(dir,'helper.mjs');writeFileSync(file,text);const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true),hash=sha(text);let node:ts.Node|undefined;
  const scan=(n:ts.Node)=>{if(at==='allocation'?ts.isObjectLiteralExpression(n):ts.isPropertyAccessExpression(n)&&n.name.text==='x')node=n;ts.forEachChild(n,scan);};scan(sf);assert(node);
  const source={file:'helper.mjs',sha256:hash,start:node.getStart(sf),end:node.end};
  const model={status:'modeled',component:{...source,start:0,end:text.length},literalAllocations:at==='allocation'?[{kind:'record',allocation:{id:1,source},fields:[['value',{kind:'literal',type:'number',value:1}]]}]:[],writes:at==='write'?[{phase:'render',source}]:[]} as unknown as Parameters<typeof planReactConsumerLiterals>[2] extends readonly (infer V)[]?V:never;
  assert.throws(()=>planReactConsumerLiterals({sourceRoot:dir,files:{[file]:hash}} as any,[],[model]),/consumer-literal-global-shadowed/,at);
 }}finally{rmSync(dir,{recursive:true,force:true});}
});

test('native assign capture rejects aliases and unknown sources before reading their fields',()=>{
 const N={WeakMapCtor:WeakMap,descriptors:Object.getOwnPropertyDescriptors,descriptor:Object.getOwnPropertyDescriptor,prototype:Object.getPrototypeOf,keys:Reflect.ownKeys,apply:Reflect.apply,mapGet:WeakMap.prototype.get,mapSet:WeakMap.prototype.set,is:Object.is};
 const source={file:'helper.mjs',sha256:'a'.repeat(64),start:1,end:2},consumer={...source,start:0,end:9},key=(p:typeof source)=>JSON.stringify([p.file,p.sha256,p.start,p.end]);
 const api=Function('return '+reactConsumerLiteralRuntime)()([{source,consumer,kind:'record',synchronous:true}],N,()=>{},(s:string)=>{throw Error(s);},()=>({render:0,renderSource:key(consumer)}),(v:unknown)=>({kind:typeof v,identity:v}));
 const a=api.capture(key(source),{}),b=api.capture(key(source),{x:1});
 assert.throws(()=>api.assign('site',Object.assign,[a,b,a]),/assign-alias/);assert.deepEqual(a,{});
 assert.throws(()=>api.assign('site',Object.assign,[a,b,b]),/assign-alias/);assert.deepEqual(a,{});
 let reads=0;const foreign=new Proxy({}, {ownKeys(){reads++;throw Error('read');},getOwnPropertyDescriptor(){reads++;throw Error('read');}});
 assert.throws(()=>api.assign('site',Object.assign,[a,foreign]),/assign-input/);assert.equal(reads,0);assert.deepEqual(a,{});
 Object.defineProperty(b,'x',{get(){reads++;throw Error('read');}});assert.throws(()=>api.assign('site',Object.assign,[a,b]),/assign-descriptor/);assert.equal(reads,0);assert.deepEqual(a,{});
});

test('synchronous function arguments retain source creation owners and distinct allocation identities',async()=>{
 const {runInNewContext}=await import('node:vm');
 const {modelReactContextConsumer}=await import('./react-helper-model.mjs');
 const {readReactElementClosures}=await import('./react-element-closure.js');
 const {instrumentReactHelperSource}=await import('./react-helper-instrument.js');
 const {reactHelperBindingGuard}=await import('./react-helper-binding-runtime.js');
 const {verifyConsumerLiteralEffects}=await import('./react-consumer-literal-effects.js');
 const dir=mkdtempSync(path.join(process.cwd(),'source-reference/.consumer-functions-'));
 try{
  const fixture=(mode='plain')=>{
   const primitive=['primitive','missing-scope','missing-capture'].includes(mode);
   const text=primitive?`const Render=(props)=>{return <span>{value('one')}</span>;};function value(input){return input;}`:`const Render=(props)=>{const a=outer('one');const b=outer('two');return <span>{a+b}</span>;};function outer(value){return make(value);}function make(value,parse=${mode==='captured'?'x=>x+value':'x=>x'}){const out={value};out.value='checked-'+use(out.value,parse);return out.value;}function use(value,parse){return ${mode==='unused'?'value':'parse(value)'};}`;
   const file=path.join(dir,'fixture.tsx');writeFileSync(file,text);
   const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
   const host:ts.CompilerHost={getSourceFile:f=>f===file?sf:undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=>dir,getDirectories:()=>[],fileExists:f=>f===file,readFile:f=>f===file?text:undefined,getCanonicalFileName:f=>f,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n'};
   const program=ts.createProgram([file],{jsx:ts.JsxEmit.React,noLib:true,noResolve:true},host);let component:ts.ArrowFunction|undefined;
   const find=(n:ts.Node)=>{if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.name.text==='Render'&&n.initializer&&ts.isArrowFunction(n.initializer))component=n.initializer;ts.forEachChild(n,find);};find(sf);assert(component);
   const source=(n:ts.Node)=>({file:'fixture.tsx',sha256:sha(text),start:n.getStart(sf),end:n.end});
   const planning=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),closures=readReactElementClosures(planning),planned=new Map<string,ts.Node>(),actual=new Map<string,ts.Node>();
   const inventory=(n:ts.Node,into:Map<string,ts.Node>)=>{into.set(JSON.stringify([n.getStart(),n.end]),n);ts.forEachChild(n,c=>inventory(c,into));};inventory(planning,planned);inventory(sf,actual);
   const callback=(node:ts.ArrowFunction|ts.FunctionExpression)=>{const original=planned.get(JSON.stringify([node.getStart(),node.end])) as typeof node;assert(original);const item=closures(original);return {effects:item.effects,reads:item.reads.map(read=>({name:read.name,node:actual.get(JSON.stringify([read.span.start,read.span.end]))!,...(read.declaration?{declaration:{file:'fixture.tsx',sha256:sha(text),...read.declaration.span}}:{})}))};};
   const model=modelReactContextConsumer({program,component,parameter:component.parameters[0].name as ts.Identifier,properties:[],contentKey:'children',source,runtimeFiles:[file],contextCalls:[],target:()=>undefined,factory:()=>undefined,callback});
   assert.equal(model.status,'modeled',JSON.stringify(model));if(model.status!=='modeled')throw Error('fixture not modeled');
   const reference={sourceRoot:dir,files:{[file]:sha(text)}} as unknown as ReactReference;
   const literalPlans=planReactConsumerLiterals(reference,[],[model as any]);
   const plan={kind:'jsx-component' as const,models:[],bodyModels:[model],targets:[],consumerLiterals:literalPlans};
   const transformed=instrumentReactHelperSource(text,'fixture.tsx',plan as any);
   const emit=(value:string)=>ts.transpileModule(value,{compilerOptions:{jsx:ts.JsxEmit.React,jsxFactory:'h',target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
   const setup=`const N={WeakMapCtor:WeakMap,descriptors:Object.getOwnPropertyDescriptors,descriptor:Object.getOwnPropertyDescriptor,prototype:Object.getPrototypeOf,keys:Reflect.ownKeys,apply:Reflect.apply,mapGet:WeakMap.prototype.get,mapSet:WeakMap.prototype.set,is:Object.is};
    const models=${JSON.stringify([model])};let active=false;const ids=new Map(),known=new WeakSet();const point=p=>JSON.stringify([p.file,p.sha256,p.start,p.end]);
    const witness=value=>{if(value===null)return {kind:'null',value:null};if(['object','function','symbol','bigint'].includes(typeof value)){if(!ids.has(value))ids.set(value,ids.size);return {kind:typeof value,identity:ids.get(value)};}return value===undefined?{kind:'undefined'}:{kind:typeof value,value};};
    const fail=s=>{throw Error(s)};const literal=(${reactConsumerLiteralRuntime})(${JSON.stringify(literalPlans)},N,()=>{},fail,()=>({render:active?0:null,renderSource:point(models[0].component)}),witness);
    const guard=(${reactHelperBindingGuard})(models,()=>{},x=>known.has(x),fail,${mode==='missing-capture'?'undefined':'literal'});
    globalThis.__DSC_RUNTIME_PROOF={sourceFunction:guard.sourceFunction,binding:guard.binding,sourceCall:guard.sourceCall,contextBody(key,invoke){active=${mode!=='missing-scope'};try{return guard.component(0,key,invoke,true)}finally{active=false}},literal(x){known.add(x);return x},consumerLiteral:literal.capture,consumerLiteralWrite:literal.write,consumerLiteralAssign:literal.assign};
    const h=(tag,props,...children)=>({tag,props,children});`;
   const captured=runInNewContext('"use strict";'+setup+emit(transformed)+`const result=Render({children:'content'});({result,report:literal.report(),input:{value:witness({children:'content'}),fields:[['children',{kind:'string',value:'content'}]]},guard:guard.report()});`);
   const plain=runInNewContext(`"use strict";const h=(tag,props,...children)=>({tag,props,children});`+emit(text)+`Render({children:'content'});`);
   assert.deepEqual(JSON.parse(JSON.stringify(captured.result)),JSON.parse(JSON.stringify(plain)));
   const report=JSON.parse(JSON.stringify(captured.report)) as import('./react-consumer-literal-runtime.js').ReactConsumerLiteralReport;
   const input=JSON.parse(JSON.stringify(captured.input));
   const verify=(r=report)=>verifyConsumerLiteralEffects(model as any,r,literalPlans,0,input,(v,s)=>s.kind==='literal'&&JSON.stringify(v)===JSON.stringify(s.type==='undefined'?{kind:'undefined'}:{kind:s.type,value:s.value}));
   return {model,report,verify,input,guard:captured.guard};
  };
  const primitive=fixture('primitive');
  assert.equal(primitive.model.literalAllocations!.length,0,'call capture must not depend on literal allocation count');
  assert.equal(primitive.report.calls!.length,1);primitive.verify();
  assert.throws(()=>fixture('missing-scope'),/consumer-literal-operation-scope/,'planned calls require a live render scope before invoking the callee');
  assert.throws(()=>fixture('missing-capture'),/helper-binding-consumer-call-capture-missing/,'planned calls require capture runtime');
  const {model,report,verify,guard}=fixture();assert.equal(report.functions!.length,model.functionAllocations!.length,JSON.stringify({model:model.functionAllocations,actual:report.functions}));verify();
  assert(report.records.some(r=>!r.currentValuesVerified));assert(verify().records.some(r=>r.mutationEffectsVerified));
  assert.equal(model.functionAllocations!.length,2);assert.equal(report.functions!.length,2);
  assert.notDeepEqual(report.functions![0].value,report.functions![1].value);
  assert.equal(report.functions![0].source,report.functions![1].source);
  assert.notEqual(report.functions![0].ownerCall,report.functions![1].ownerCall);
  assert(guard.checkedCalls>=6);
  const callArgs=model.contextFunctionCalls.filter(c=>c.phase!=='module-initialization');
  const argumentIndex=callArgs.findIndex(c=>c.arguments.some(s=>s.kind==='callback'));
  const secondArgumentIndex=callArgs.findIndex((c,i)=>i>argumentIndex&&c.arguments.some(s=>s.kind==='callback'));
  const callbackIndex=callArgs[argumentIndex].arguments.findIndex(s=>s.kind==='callback');
  const first=report.calls![argumentIndex],second=report.calls![secondArgumentIndex];
  const nested=report.calls!.find(c=>c.entry>first.entry&&c.exit!<first.exit!)!;
  const secondNested=report.calls!.find(c=>c.entry>second.entry&&c.exit!<second.exit!)!;
  for(const attack of ['old','substitute','coordinated-swap','wrong-source','merge-identities','owner','ancestor-owner','order','moved','crossed','omitted','omitted-creation','duplicate-creation','creation-after-call','mutation-after','creation-fields','cross-render-identity']){
   const r=structuredClone(report),a=r.calls![argumentIndex],b=r.calls![secondArgumentIndex],n=r.calls![nested.id],n2=r.calls![secondNested.id];
   if(attack==='old')delete r.functions;
   if(attack==='substitute')a.arguments[callbackIndex]=b.arguments[callbackIndex];
   if(attack==='coordinated-swap'){const value=a.arguments[callbackIndex];a.arguments[callbackIndex]=b.arguments[callbackIndex];b.arguments[callbackIndex]=value;const callee=n.callee;n.callee=n2.callee;n2.callee=callee;}
   if(attack==='wrong-source')r.functions![0].source=r.functions![0].source.replace('fixture.tsx','foreign.tsx');
   if(attack==='merge-identities')r.functions![1].value=r.functions![0].value;
   if(attack==='owner')r.functions![0].ownerCall=r.functions![1].ownerCall;
   if(attack==='ancestor-owner')r.functions![0].ownerCall=r.calls!.find(c=>c.entry<r.calls![r.functions![0].ownerCall].entry&&c.exit!>r.calls![r.functions![0].ownerCall].exit!)!.id;
   if(attack==='order')r.functions!.reverse();
   if(attack==='moved')n.entry=a.exit!+1;
   if(attack==='crossed')n.exit=a.exit!+1;
   if(attack==='omitted-creation')r.functions!.splice(0,1);
   if(attack==='omitted')r.calls!.splice(n.id,1);
   if(attack==='duplicate-creation')r.functions!.push(structuredClone(r.functions![0]));
   if(attack==='creation-after-call')r.functions![0].sequence=a.entry+1;
   if(attack==='mutation-after')r.mutations![0].after[0].fields=[];
   if(attack==='creation-fields')r.records[0].fields=[];
   if(attack==='cross-render-identity'){const owner=structuredClone(r.calls![r.functions![0].ownerCall]);owner.id=r.calls!.length;owner.render=1;r.calls!.push(owner);r.functions!.push({...structuredClone(r.functions![0]),id:r.functions!.length,render:1,ownerCall:owner.id});}
   assert.throws(()=>verify(r),/context-consumer-literal-effects:/,attack);
  }
  const shape=callArgs[argumentIndex].arguments[callbackIndex];
  assert.equal(verify().matches(first.arguments[callbackIndex],shape),false,'general output matcher must not admit callback escape');
  assert.throws(()=>fixture('captured').verify(),/context-consumer-literal-effects:call-arguments/);
  assert.throws(()=>fixture('unused').verify(),/context-consumer-literal-effects:call-arguments/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
