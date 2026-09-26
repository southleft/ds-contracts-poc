import type {HelperSourcePoint} from './react-helper-model.mjs';
import type {ReactElementObservedValue} from './react-element-invocation.js';

/** Opaque identity is local to this guarded run. It grants no reflection or
 * behavior authority, and never contains the original object or function. */
export type ReactContextValueWitness=ReactElementObservedValue & {identity?:number};
export interface ReactContextRuntimeReport {
  qualification:'react-context-transport-only';effectsVerified:false;acceptedContract:null;
  contexts:number;providers:Array<{id:number;context:number;factory:number;value:ReactElementObservedValue;valueOrigin:number|null}>;
  reads:Array<{context:number;provider:number|null;consumer:HelperSourcePoint|null;render:number|null;call:HelperSourcePoint|null;value:ReactElementObservedValue;valueOrigin:number|null}>;
  renders:{qualification:'original-render-context-boundaries-only';effectsVerified:false;acceptedContract:null;
    invocations:Array<{id:number;source:HelperSourcePoint;completion:'returned'|'threw';consumerCalls:number[];reads:number[];returnedFactory:number|null}>};
  bindings:{qualification:'source-module-binding-read-identity-only';effectsVerified:false;acceptedContract:null;planned:number;functions:number;
    reads:Array<{id:number;site:HelperSourcePoint;binding:HelperSourcePoint;consumer:HelperSourcePoint;render:number;kind:'value'|'typeof';value:ReactContextValueWitness;functionSource:HelperSourcePoint|null;calleeOf:number|null}>};
  factories:{qualification:'source-jsx-factory-identity-only';effectsVerified:false;acceptedContract:null;planned:number;
    invocations:Array<{id:number;site:HelperSourcePoint;target:HelperSourcePoint;consumer:HelperSourcePoint;render:number;factory:'jsx'|'jsxs';targetRead:number|null;callee:ReactContextValueWitness;arguments:ReactContextValueWitness[];completion:'returned'|'threw';value?:ReactContextValueWitness}>};
  targetReads:{qualification:'source-object-target-property-reads-only';effectsVerified:false;acceptedContract:null;planned:number;allocations:number;reads:Array<{id:number;site:HelperSourcePoint;objectSource:HelperSourcePoint;property:string;render:number;factory:number;value:ReactContextValueWitness;propertyEffectsVerified:true}>};
  values:{qualification:'source-object-rest-values-only';effectsVerified:false;acceptedContract:null;allocations:number;
    origins:Array<{id:number;source:HelperSourcePoint;identity:number;fields:Array<[string,ReactElementObservedValue]>|null;witnesses:Array<[string,ReactContextValueWitness]>|null}>};
  calls:{qualification:'source-use-context-values-only';effectsVerified:false;acceptedContract:null;planned:number;
    invocations:Array<{site:HelperSourcePoint;enclosingFunction:HelperSourcePoint|null;read:number;lookup:number}>};
  hookLookups:{qualification:'native-context-hook-property-reads-only';effectsVerified:false;acceptedContract:null;interopNamespaces:number;reads:Array<{id:number;site:HelperSourcePoint;kind:'native-exports-data'|'native-interop-getter'|'lexical';render:number|null;read:number|null;propertyEffectsVerified:true}>};
  helpers:{qualification:'source-context-helper-return-identity-only';effectsVerified:false;acceptedContract:null;planned:number;
    instances:Array<{id:number;source:HelperSourcePoint}>;
    invocations:Array<{id:number;instance:number;consumer:HelperSourcePoint|null;render:number|null;parent:number|null;sourceCall:number|null;reads:number[];closureReads:number[];completion:'returned'|'threw';returnSource:HelperSourcePoint|null;value?:ReactElementObservedValue;witness?:ReactContextValueWitness;matchingReads:number[]}>};
  helperClosures:{qualification:'source-context-helper-closure-reads-only';effectsVerified:false;acceptedContract:null;planned:number;
    reads:Array<{id:number;site:HelperSourcePoint;helper:number;instance:number;render:number|null;value:ReactContextValueWitness;context:number|null}>};
  consumerCalls:{qualification:'consumer-context-helper-call-identity-only';effectsVerified:false;acceptedContract:null;planned:number;
    invocations:Array<{id:number;site:HelperSourcePoint;consumer:HelperSourcePoint;render:number;callee:ReactContextValueWitness;calleeRead:number|null;arguments:ReactElementObservedValue[];argumentWitnesses:ReactContextValueWitness[];returnWitness?:ReactContextValueWitness;completion:'returned'|'threw';value?:ReactElementObservedValue;helperInstance:number|null;helperInvocation:number|null;returnMatched:boolean}>};
}
/** Exact context identities and nearest-provider values from the pinned React
 * factory/renderer. Only compiler-witnessed fresh object-rest allocations have
 * shallow data descriptors recorded; all other values remain opaque. This is
 * not a source model of providers, hooks, state, refs or event effects. */
export const reactContextRuntime=String.raw`((N,intrinsics,sameDescriptor,fail,callPlans,restPlans,helperPlans,consumerPlans,factoryPlans,invokeFactory,bindingPlans,targetPlans,observeConsumerReturn)=>{
 const contexts=new N.WeakMapCtor(),factories=new N.WeakMapCtor(),created=[],providers=[],reads=[],renders=[],renderInvocations=[],hookFrames=[],hookCalls=[];
 const identities=new Map();let nextIdentity=0;
 const allocated=new N.WeakMapCtor(),allocations=[];let restValidationFailed=false;
 const point=p=>JSON.stringify([p.file,p.sha256,p.start,p.end]);
 const source=key=>{if(key===null)return null;const p=JSON.parse(key);return {file:p[0],sha256:p[1],start:p[2],end:p[3]};};
 const sites=callPlans.map(p=>({key:point(p.call),enclosing:p.enclosingFunction?point(p.enclosingFunction):null}));let nativeHook,nativeCallback,nativeRef;const nativeEffects=new Map();
 const restSites=restPlans.map(p=>point(p.binding));
 const helperSites=(helperPlans??[]).map(p=>({key:point(p.source),calls:p.calls.map(point),returns:p.returns.map(point),closureReads:(p.closureReads??[]).map(r=>point(r.read))}));
 const closureReads=[];
 const nativeExports=new N.WeakMapCtor(),nativeNamespaces=new N.WeakMapCtor(),lookupTokens=new N.WeakMapCtor(),lookupReads=[];let namespaceCount=0,interopKernel=null;
 const helperByValue=new N.WeakMapCtor(),helperInstances=[],helperInvocations=[],helperFrames=[];let helperValidationFailed=false;
 const consumerSites=(consumerPlans??[]).map(p=>({key:point(p.call),consumer:point(p.consumer),callee:point(p.callee),arity:p.arguments.length})),consumerInvocations=[],consumerFrames=[];
 let consumerValidationFailed=false;
 const bindingSites=(bindingPlans?.reads??[]).map(p=>({key:point(p.read),binding:point(p.binding),consumer:point(p.consumer),kind:p.kind}));
 const functionSites=(bindingPlans?.functions??[]).map(p=>point(p.source)),bindingFunctions=new Map(),bindingReads=[];
 function bindingFunction(key,value){
  intrinsics();if(!functionSites.includes(key)||typeof value!=='function'||bindingFunctions.has(key))fail('context-binding-function-unplanned');
  // This exact lexical declaration is compiler-authenticated. Register identity
  // only; naming and other initialization metadata are outside this witness.
  bindingFunctions.set(key,value);
 }
 function bindingRead(key,value){
  intrinsics();const site=bindingSites.find(p=>p.key===key),render=renders[renders.length-1];
  if(!site||render?.key!==site.consumer)fail('context-binding-read-unplanned');
  if(bindingReads.length>=100000)fail('context-binding-read-limit');
  bindingReads.push({id:bindingReads.length,site,render,value,calleeOf:null,
   functionSource:site.kind==='value'&&bindingFunctions.has(site.binding)&&N.is(bindingFunctions.get(site.binding),value)?site.binding:null});
  return value;
 }

 const targetReadSites=(targetPlans?.reads??[]).map(p=>({key:point(p.read),consumer:point(p.consumer),property:p.property,origin:p.origin.module}));
 const objectSites=new Map((targetPlans?.objects??[]).map(p=>[point(p),p.file])),objectOrigins=new N.WeakMapCtor(),targetReads=[];let objectCount=0;
 function sourceObject(key,value){
  intrinsics();if(!objectSites.has(key)||N.apply(N.mapGet,objectOrigins,[value]))fail('context-target-object-unplanned');
  if(objectCount>=100000)fail('context-target-object-limit');
  N.apply(N.mapSet,objectOrigins,[value,{key,module:objectSites.get(key)}]);objectCount++;return value;
 }
 function targetRead(key,value,property){
  intrinsics();const site=targetReadSites.find(p=>p.key===key),frame=jsxFrames[jsxFrames.length-1],render=renders[renders.length-1];
  if(!site||site.property!==property||render?.key!==site.consumer||frame?.render!==render||frame.site.target!==key||frame.targetRead!==null)fail('context-target-read-unplanned');
  const origin=N.apply(N.mapGet,objectOrigins,[value]);
  if(!origin||origin.module!==site.origin)fail('context-target-object-origin-unproved');
  // This exact object came from original object-literal syntax. Own descriptor
  // inspection is safe even if its prototype is opaque; never inspect it.
  const before=N.descriptor(value,property);
  if(!before||!N.descriptor(before,'value'))fail('context-target-property-not-own-data');
  const result=value[property];intrinsics();
  if(!N.is(result,before.value)||!sameDescriptor(before,N.descriptor(value,property)))fail('context-target-property-changed');
  if(targetReads.length>=100000)fail('context-target-read-limit');
  frame.targetRead=targetReads.length;targetReads.push({id:targetReads.length,site,origin,render:render.id,factory:frame.id,value:result});return result;
 }
 const jsxSites=(factoryPlans??[]).map(p=>({key:point(p.call),target:point(p.arguments[0]),consumer:point(p.consumer),arity:p.arguments.length,factory:p.factory}));
 const jsxInvocations=[],jsxFrames=[],jsxByValue=new N.WeakMapCtor();let jsxValidationFailed=false;
 function factoryArgument(key,index,value){
  const frame=jsxFrames[jsxFrames.length-1];
  if(!frame||frame.site.key!==key||index!==frame.args.length||index>=frame.site.arity)fail('context-factory-argument-unmatched');
  frame.args.push(value);return value;
 }
 function factoryCall(key,fn,readArgs){
  intrinsics();const site=jsxSites.find(p=>p.key===key),render=renders[renders.length-1];
  if(!site||render?.key!==site.consumer||typeof readArgs!=='function')fail('context-factory-call-unplanned');
  if(jsxFrames.length>=256||jsxInvocations.length>=100000)fail('context-factory-call-limit');
  const frame={id:jsxInvocations.length,site,render,fn,args:[],targetRead:null,returned:false,closed:false};
  jsxInvocations.push(frame);jsxFrames.push(frame);
  try{
   // Only the compiler-owned array is inspected. Original argument values,
   // including target functions or proxies, stay opaque to this boundary.
   const args=N.apply(readArgs,undefined,[]);
   if(args.length!==site.arity||frame.args.length!==site.arity||args.some((v,i)=>!N.is(v,frame.args[i])))fail('context-factory-arguments-changed');
   const value=invokeFactory(fn,args);
   if(N.apply(N.mapGet,jsxByValue,[value]))fail('context-factory-result-reused');
   frame.value=value;frame.returned=true;N.apply(N.mapSet,jsxByValue,[value,frame]);return value;
  }finally{
   if(jsxFrames[jsxFrames.length-1]!==frame)jsxValidationFailed=true;else jsxFrames.pop();
   frame.closed=true;
  }
 }

 function consumerArgument(key,index,value){
  const frame=consumerFrames[consumerFrames.length-1];
  if(!frame||frame.site.key!==key||index!==frame.args.length||index>=frame.site.arity)fail('context-consumer-argument-unmatched');
  frame.args.push(value);return value;
 }
 function consumerCall(key,fn,invoke){
  intrinsics();const site=consumerSites.find(p=>p.key===key);
  if(!site||renders[renders.length-1]?.key!==site.consumer||typeof invoke!=='function')fail('context-consumer-call-unplanned');
  if(consumerFrames.length>=256||consumerInvocations.length>=100000)fail('context-consumer-call-limit');
  const render=renders[renders.length-1];
  const previous=bindingReads[bindingReads.length-1];
  const calleeRead=previous&&previous.render===render&&previous.site.key===site.callee&&previous.calleeOf===null&&N.is(previous.value,fn)?previous:null;
  const frame={id:consumerInvocations.length,site,render,callee:fn,calleeRead:calleeRead?.id??null,item:N.apply(N.mapGet,helperByValue,[fn])??null,helper:null,helperDepth:helperFrames.length,args:[],returned:false,closed:false,matched:false};
  if(calleeRead)calleeRead.calleeOf=frame.id;
  render.consumerCalls.push(frame.id);
  consumerInvocations.push(frame);consumerFrames.push(frame);
  try{
   // The compiler-owned arrow invokes the captured original callee once. Each
   // original argument stays inside that arrow in its original order. Unknown
   // callees are never reflected and receive no helper identity claim.
   const value=N.apply(invoke,undefined,[fn]);frame.value=value;frame.returned=true;
   if(frame.args.length!==site.arity)consumerValidationFailed=true;
   if(frame.item){
    if(!frame.helper||!frame.helper.closed||!frame.helper.returned||!N.is(frame.helper.value,value))consumerValidationFailed=true;
    else frame.matched=true;
   }
   if(observeConsumerReturn)observeConsumerReturn(frame.id,value);
   return value;
  }finally{
   if(consumerFrames[consumerFrames.length-1]!==frame)consumerValidationFailed=true;else consumerFrames.pop();
   frame.closed=true;
  }
 }
 const functionPrototype=Function.prototype;
 function helperUnchanged(item){
  if(item.before===null)return true;
  if(N.prototype(item.value)!==functionPrototype)return false;
  const ds=N.descriptors(item.value),keys=N.keys(ds),before=N.keys(item.before);
  return keys.length===before.length&&keys.every((k,i)=>k===before[i]&&sameDescriptor(ds[k],item.before[k]));
 }
 function helperRegister(key,value){
  intrinsics();const site=helperSites.find(p=>p.key===key);
  // Only an original lexical function declaration reaches this marker.
  if(!site||typeof value!=='function'||N.apply(N.mapGet,helperByValue,[value])||helperInstances.length>=100000)fail('context-helper-registration-invalid');
  // Declaration identity is known now. Module/factory initialization can still
  // legitimately name this function before its first call; that initialization
  // is outside this invocation-only witness.
  const item={id:helperInstances.length,site,value,before:null};
  helperInstances.push(item);N.apply(N.mapSet,helperByValue,[value,item]);
 }
 function helperBegin(key,value){
  intrinsics();const item=N.apply(N.mapGet,helperByValue,[value]);
  if(item&&item.site.key===key&&item.before===null){
   item.before=N.descriptors(item.value);
   if(N.prototype(item.value)!==functionPrototype||N.keys(item.before).some(k=>!N.descriptor(item.before[k],'value')))helperValidationFailed=true;
  }
  if(!item||item.site.key!==key||!helperUnchanged(item))helperValidationFailed=true;
  if(helperFrames.length>=256||helperInvocations.length>=100000)fail('context-helper-invocation-limit');
  const caller=consumerFrames[consumerFrames.length-1];
  const sourceCall=caller&&caller.item===item&&!caller.helper&&caller.helperDepth===helperFrames.length?caller:null;
  const frame={id:helperInvocations.length,item,consumer:renders[renders.length-1]?.key??null,render:renders[renders.length-1]?.id??null,parent:helperFrames[helperFrames.length-1]?.id??null,sourceCall:sourceCall?.id??null,reads:[],closureReads:[],returned:false,returnSource:null,closed:false};
  if(sourceCall)sourceCall.helper=frame;
  helperInvocations.push(frame);helperFrames.push(frame);return frame;
 }
 function helperRead(key,value){
  intrinsics();const frame=helperFrames[helperFrames.length-1];
  if(!frame?.item?.site.closureReads.includes(key))fail('context-helper-read-unplanned');
  if(closureReads.length>=100000)fail('context-helper-read-limit');
  frame.closureReads.push(closureReads.length);
  closureReads.push({id:closureReads.length,key,helper:frame.id,instance:frame.item.id,render:frame.render,value,context:get(value)?.id??null});
  return value;
 }
 function helperReturn(frame,key,value){
  if(helperFrames[helperFrames.length-1]!==frame||frame.returned||key!==null&&!frame.item?.site.returns.includes(key))helperValidationFailed=true;
  frame.returned=true;frame.returnSource=key;frame.value=value;return value;
 }
 function helperEnd(frame){
  if(helperFrames[helperFrames.length-1]!==frame)helperValidationFailed=true;else helperFrames.pop();
  if(!frame.item||!helperUnchanged(frame.item))helperValidationFailed=true;
  frame.closed=true;
 }
 function rest(key,value){
  intrinsics();if(!restSites.includes(key)||N.apply(N.mapGet,allocated,[value]))fail('context-rest-origin-unplanned');
  if(allocations.length>=100000)fail('context-rest-allocation-limit');
  // This marker follows original native object-rest syntax. The fresh result
  // is known; its possibly opaque input is never reflected or read again.
  const before=N.descriptors(value),keys=N.keys(before);
  if(N.prototype(value)!==Object.prototype||keys.length>10000||keys.some(k=>!N.descriptor(before[k],'value')))fail('context-rest-result-unmodeled');
  const item={id:allocations.length,key,value,before,keys,used:false};allocations.push(item);N.apply(N.mapSet,allocated,[value,item]);
  return value;
 }
 function restUnchanged(item){
  if(N.prototype(item.value)!==Object.prototype)return false;
  const ds=N.descriptors(item.value),keys=N.keys(ds);
  return keys.length===item.keys.length&&keys.every((k,i)=>k===item.keys[i]&&sameDescriptor(ds[k],item.before[k]));
 }
 function origin(value){
  const item=N.apply(N.mapGet,allocated,[value]);if(!item)return null;
  if(!restUnchanged(item))restValidationFailed=true;
  // Keep source execution and React's error/recovery bookkeeping intact.
  // This records a failed witness; only the host report refuses, so this
  // observer never invokes a source accessor or throws inside renderer work.
  item.used=true;return item.id;
 }
 function hook(fn,value){
  intrinsics();if(typeof fn!=='function'||nativeHook&&nativeHook!==fn)fail('context-hook-registration-changed');nativeHook=fn;
  // The pinned React adapter registers its own CommonJS exports object. No
  // source-supplied receiver is inspected until it matches this identity.
  const ds=N.descriptors(value);
  if(N.prototype(value)!==Object.prototype||N.keys(ds).some(k=>!N.descriptor(ds[k],'value'))||!N.is(ds.useContext?.value,fn))fail('context-hook-exports-unmodeled');
  if(ds.useCallback&&(typeof ds.useCallback.value!=='function'||nativeCallback&&nativeCallback!==ds.useCallback.value))fail('callback-hook-registration-changed');nativeCallback=ds.useCallback?.value;
  if(ds.useRef&&(typeof ds.useRef.value!=='function'||nativeRef&&nativeRef!==ds.useRef.value))fail('ref-hook-registration-changed');nativeRef=ds.useRef?.value;
  for(const name of ['useState','useEffect','useLayoutEffect','useInsertionEffect'])if(ds[name]){if(typeof ds[name].value!=='function'||nativeEffects.has(name)&&nativeEffects.get(name)!==ds[name].value)fail('effect-hook-registration-changed');nativeEffects.set(name,ds[name].value);}
  N.apply(N.mapSet,nativeExports,[value,{value,descriptors:ds}]);
 }
 function exportsUnchanged(item){
  if(N.prototype(item.value)!==Object.prototype)fail('context-hook-export-prototype-changed');
  const ds=N.descriptors(item.value),keys=N.keys(ds),before=N.keys(item.descriptors);
  if(ds.useContext&&N.descriptor(ds.useContext,'value')&&!N.is(ds.useContext.value,nativeHook))fail('context-hook-identity-changed');
  if(keys.length!==before.length||keys.some((k,i)=>k!==before[i]||!sameDescriptor(ds[k],item.descriptors[k])))fail('context-hook-exports-mutated');
 }
 function interopKernelRegister(fn,read){
  intrinsics();if(interopKernel||typeof fn!=='function'||typeof read!=='function')fail('context-interop-kernel-registration-invalid');
  const dependencies=N.apply(read,undefined,[]);
  if(!Array.isArray(dependencies)||dependencies.length!==8||dependencies.some(v=>typeof v!=='function')||dependencies[7]!==fn)fail('context-interop-kernel-dependencies-invalid');
  interopKernel={fn,read,dependencies};
 }
 function checkInteropKernel(fn){
  if(!interopKernel||fn!==interopKernel.fn)fail('context-interop-kernel-identity-changed');
  const current=N.apply(interopKernel.read,undefined,[]);
  if(current.length!==interopKernel.dependencies.length||current.some((v,i)=>v!==interopKernel.dependencies[i]))fail('context-interop-kernel-dependency-changed');
 }
 function interop(fn,mod,...args){
  intrinsics();checkInteropKernel(fn);const origin=N.apply(N.mapGet,nativeExports,[mod]);
  if(origin)exportsUnchanged(origin);
  // The host authenticates the complete bundler helper and its intrinsic
  // bindings. Its original execution creates a fresh wrapper. Unknown module
  // exports run normally and gain no native context-import claim.
  const value=N.apply(fn,undefined,[mod,...args]);intrinsics();checkInteropKernel(fn);
  if(origin){
   exportsUnchanged(origin);const ds=N.descriptors(value);
   if(N.prototype(value)!==Object.prototype||!ds.useContext||typeof ds.useContext.get!=='function'||ds.useContext.set!==undefined)fail('context-hook-interop-unmodeled');
   N.apply(N.mapSet,nativeNamespaces,[value,{origin,descriptors:ds}]);namespaceCount++;
  }
  return value;
 }
 function lookup(key,fn,kind){
  const site=sites.find(p=>p.key===key);if(!site)fail('context-hook-lookup-unplanned');
  if(fn!==nativeHook)fail('context-hook-identity-changed');
  if(lookupReads.length>=100000)fail('context-hook-lookup-limit');
  const token={},item={id:lookupReads.length,site,fn,kind,render:renders[renders.length-1]?.id??null,read:null};
  lookupReads.push(item);N.apply(N.mapSet,lookupTokens,[token,item]);return token;
 }
 function hookValue(key,fn){intrinsics();return lookup(key,fn,'lexical');}
 function nativeDefault(value){
  intrinsics();const wrapped=N.apply(N.mapGet,nativeNamespaces,[value]);if(!wrapped)fail('native-default-import-origin-unproved');
  exportsUnchanged(wrapped.origin);const ds=N.descriptors(value),keys=N.keys(ds),before=N.keys(wrapped.descriptors);
  if(N.prototype(value)!==Object.prototype||keys.length!==before.length||keys.some((k,i)=>k!==before[i]||!sameDescriptor(ds[k],wrapped.descriptors[k])))fail('native-default-import-mutated');
  if(!ds.default||!N.descriptor(ds.default,'value')||!N.is(ds.default.value,wrapped.origin.value))fail('native-default-import-unmodeled');
  return value.default;
 }
 function nativeHookIdentify(fn,names){
  intrinsics();const matches=names.filter(name=>nativeEffects.has(name)&&nativeEffects.get(name)===fn);
  if(matches.length!==1)fail('native-hook-alias-unproved');return {name:matches[0],...nativeHookValue(matches[0],fn)};
 }
 function nativeHookValue(name,fn){
  intrinsics();const expected=name==='useCallback'?nativeCallback:name==='useContext'?nativeHook:name==='useRef'?nativeRef:nativeEffects.get(name);
  if(!expected||fn!==expected)fail('native-hook-identity-changed');return {fn,kind:'lexical'};
 }
 function nativeHookRead(name,value){
  intrinsics();if(name!=='useContext'&&name!=='useCallback'&&name!=='useRef'&&!nativeEffects.has(name))fail('native-hook-property-unplanned');
  const direct=N.apply(N.mapGet,nativeExports,[value]),wrapped=N.apply(N.mapGet,nativeNamespaces,[value]);
  if(!direct&&!wrapped)fail('context-hook-import-origin-unproved');
  const origin=direct??wrapped.origin;exportsUnchanged(origin);
  if(wrapped){
   if(N.prototype(value)!==Object.prototype)fail('context-hook-import-prototype-changed');
   const ds=N.descriptors(value),keys=N.keys(ds),before=N.keys(wrapped.descriptors);
   if(keys.length!==before.length||keys.some((k,i)=>k!==before[i]||!sameDescriptor(ds[k],wrapped.descriptors[k])))fail('context-hook-import-mutated');
  }
  // Only a pinned native exports object or an authenticated compiler wrapper
  // reaches this read. Never invoke a source-supplied getter to identify it.
  const fn=value[name];intrinsics();exportsUnchanged(origin);nativeHookValue(name,fn);
  return {fn,kind:direct?'native-exports-data':'native-interop-getter'};
 }
 function hookRead(key,value){const read=nativeHookRead('useContext',value);return lookup(key,read.fn,read.kind);}
 function use(key,receiver,token,context){
  intrinsics();const site=sites.find(p=>p.key===key);
  if(!site)fail('context-source-call-unplanned');
  // Match before inspecting or invoking a source-supplied function or context.
  const lookup=N.apply(N.mapGet,lookupTokens,[token]);
  if(!lookup||lookup.site!==site||lookup.read!==null)fail('context-hook-lookup-unproved');
  const fn=lookup.fn;if(!nativeHook||fn!==nativeHook)fail('context-hook-identity-changed');
  access(context);if(hookFrames.length>=256)fail('context-hook-stack-limit');
  const frame={site,context,reads:[]};hookFrames.push(frame);
  try{
   const value=N.apply(fn,receiver,[context]);intrinsics();
   const read=frame.reads.length===1?reads[frame.reads[0]]:undefined;
   if(!read||read.context.value!==context||!N.is(read.value,value))fail('context-hook-return-unproved');
   if(hookCalls.length>=100000)fail('context-hook-call-limit');
   lookup.read=frame.reads[0];hookCalls.push({site,read:frame.reads[0],lookup:lookup.id});
   const helperSite=helperSites.find(p=>p.calls.includes(key));
   if(helperSite){
    const active=helperFrames[helperFrames.length-1];
    if(!active||active.item?.site!==helperSite)helperValidationFailed=true;else active.reads.push(frame.reads[0]);
   }
   return value;
  }finally{
   if(hookFrames[hookFrames.length-1]!==frame)fail('context-hook-stack-changed');hookFrames.pop();
  }
 }
 const objectPrototype=Object.prototype,contextType=Symbol.for('react.context'),consumerType=Symbol.for('react.consumer');let factoryCount=0;
 function scalar(value){
  if(value===null)return {kind:'null',value:null};
  if(typeof value==='number')return N.is(value,-0)?{kind:'number',representation:'negative-zero'}:Number.isFinite(value)?{kind:'number',value}:{kind:'number',representation:Number.isNaN(value)?'nan':value>0?'positive-infinity':'negative-infinity'};
  return typeof value==='string'||typeof value==='boolean'?{kind:typeof value,value}:{kind:typeof value};
 }
 function witness(value){
  const result=scalar(value);
  if(value!==null&&['object','function','symbol','bigint'].includes(typeof value)){
   let identity=identities.get(value);
   if(identity===undefined){if(nextIdentity>=100000)fail('context-value-identity-limit');identity=nextIdentity++;identities.set(value,identity);}
   result.identity=identity;
  }
  return result;
 }
 function get(value){return N.apply(N.mapGet,contexts,[value]);}
 function check(item){
  if(N.prototype(item.value)!==objectPrototype)fail('context-prototype-changed');
  const ds=N.descriptors(item.value);
  for(const key of ['$$typeof','Provider','Consumer','_currentValue','_currentValue2']){
   const expected=item.before[key],actual=ds[key];
   if(!actual||!N.descriptor(actual,'value')||!sameDescriptor(actual,key==='_currentValue'?{...expected,value:actual.value}:expected))fail('context-metadata-changed');
  }
  const consumer=N.descriptors(item.consumer);
  if(N.prototype(item.consumer)!==objectPrototype||!sameDescriptor(consumer.$$typeof,item.consumerBefore.$$typeof)||!sameDescriptor(consumer._context,item.consumerBefore._context))fail('context-consumer-changed');
  return ds._currentValue.value;
 }
 function register(value){
  intrinsics();if(created.length>=100000||get(value))fail('context-registration-invalid');
  // Emitted solely at the return of the pinned native createContext factory.
  const before=N.descriptors(value),consumer=before.Consumer?.value,ds=consumer&&N.descriptors(consumer);
  if(N.prototype(value)!==objectPrototype||before.$$typeof?.value!==contextType||before.Provider?.value!==value||!ds||ds.$$typeof?.value!==consumerType||ds._context?.value!==value)fail('context-factory-result-changed');
  const item={id:created.length,value,before,consumer,consumerBefore:ds,defaultValue:before._currentValue.value,stack:[]};
  N.apply(N.mapSet,contexts,[value,item]);created.push(item);check(item);return value;
 }
 function access(value){intrinsics();const item=get(value);if(!item)fail('context-use-unregistered');check(item);}
 function beforeRead(value){const item=get(value);if(!item){if(renders.length)fail('context-read-unregistered');return;}intrinsics();check(item);}
 function element(type,props,value){
  const context=get(type);if(!context)return value;intrinsics();check(context);
  if(factoryCount>=100000)fail('context-factory-limit');
  const list=N.apply(N.mapGet,factories,[props])??[];
  // Props may be an original JSX config. Store identity only: reflecting it
  // here could invoke a user proxy or getter before React normally would.
  list.push({id:factoryCount++,context,props,value});N.apply(N.mapSet,factories,[props,list]);return value;
 }
 function push(context,nextValue,props,fiber){
  const item=get(context);if(!item)return;intrinsics();const current=check(item),parent=item.stack[item.stack.length-1];
  if(!N.is(current,parent?parent.value:item.defaultValue))fail('context-current-value-changed');
  const candidates=(N.apply(N.mapGet,factories,[props])??[]).filter(f=>f.context===item);
  if(candidates.length!==1)fail('context-provider-factory-unproved');
  if(providers.length>=100000||item.stack.length>=256)fail('context-provider-limit');
  const frame={id:providers.length,context:item,factory:candidates[0],value:nextValue,valueOrigin:origin(nextValue),fiber,closed:false};providers.push(frame);item.stack.push(frame);
 }
 function pop(context,fiber){
  const item=get(context);if(!item)return;intrinsics();const frame=item.stack[item.stack.length-1];
  if(!frame||frame.fiber!==fiber||!N.is(check(item),frame.value))fail('context-provider-stack-changed');
  frame.closed=true;item.stack.pop();
 }
 function read(context,value){
  const item=get(context);if(!item){if(renders.length)fail('context-read-unregistered');return value;}
  intrinsics();const frame=item.stack[item.stack.length-1],expected=frame?frame.value:item.defaultValue;
  if(!N.is(check(item),value)||!N.is(value,expected))fail('context-read-value-mismatch');
  if(reads.length>=100000)fail('context-read-limit');
  const call=hookFrames[hookFrames.length-1];
  if(call){if(call.context!==context)fail('context-hook-read-changed');call.reads.push(reads.length);}
  const render=renders[renders.length-1];if(render?.id!==null&&render?.id!==undefined)render.reads.push(reads.length);
  reads.push({context:item,provider:frame??null,consumer:render?.key??null,render:render?.id??null,call:call?.site.key??null,value,valueOrigin:origin(value)});return value;
 }
 function begin(key){
  intrinsics();if(renders.length>=256||renderInvocations.length>=100000)fail('context-render-limit');
  const frame={key,id:key===null?null:renderInvocations.length,consumerCalls:[],reads:[],returnedFactory:null,returned:false,closed:false};
  if(key!==null)renderInvocations.push(frame);renders.push(frame);return frame;
 }
 function finish(frame,value){
  if(renders[renders.length-1]!==frame||frame.returned)fail('context-render-return-changed');
  const factory=N.apply(N.mapGet,jsxByValue,[value]);
  frame.returnedFactory=factory?.render===frame?factory.id:null;frame.returned=true;
 }
 function end(frame){if(renders[renders.length-1]!==frame)fail('context-render-stack-changed');frame.closed=true;renders.pop();}
 function report(){
  intrinsics();if(renders.length||hookFrames.length||renderInvocations.some(f=>!f.closed))fail('context-render-open');
  if(helperFrames.length||helperInvocations.some(f=>!f.closed)||helperInstances.some(i=>!helperUnchanged(i)))helperValidationFailed=true;
  if(helperValidationFailed)fail('context-helper-boundary-changed');
  if(jsxValidationFailed||jsxFrames.length||jsxInvocations.some(f=>!f.closed))fail('context-factory-boundary-changed');
  if(consumerValidationFailed||consumerFrames.length||consumerInvocations.some(f=>!f.closed))fail('context-consumer-boundary-changed');
  for(const item of created)if(item.stack.length||!N.is(check(item),item.defaultValue))fail('context-provider-open-or-mutated');
  for(const frame of providers)if(!frame.closed)fail('context-provider-open');
  for(const item of allocations)if(item.used&&!restUnchanged(item))restValidationFailed=true;
  if(restValidationFailed)fail('context-rest-value-mutated');
  return {qualification:'react-context-transport-only',effectsVerified:false,acceptedContract:null,contexts:created.length,
   providers:providers.map(f=>({id:f.id,context:f.context.id,factory:f.factory.id,value:scalar(f.value),valueOrigin:f.valueOrigin})),
   reads:reads.map(r=>({context:r.context.id,provider:r.provider?r.provider.id:null,consumer:source(r.consumer),render:r.render,call:source(r.call),value:scalar(r.value),valueOrigin:r.valueOrigin})),
   renders:{qualification:'original-render-context-boundaries-only',effectsVerified:false,acceptedContract:null,invocations:renderInvocations.map(f=>({id:f.id,source:source(f.key),completion:f.returned?'returned':'threw',consumerCalls:[...f.consumerCalls],reads:[...f.reads],returnedFactory:f.returnedFactory}))},
   bindings:{qualification:'source-module-binding-read-identity-only',effectsVerified:false,acceptedContract:null,planned:bindingSites.length,functions:bindingFunctions.size,
    reads:bindingReads.map(r=>({id:r.id,site:source(r.site.key),binding:source(r.site.binding),consumer:source(r.site.consumer),render:r.render.id,kind:r.site.kind,value:witness(r.value),functionSource:source(r.functionSource),calleeOf:r.calleeOf}))},
   factories:{qualification:'source-jsx-factory-identity-only',effectsVerified:false,acceptedContract:null,planned:jsxSites.length,
    invocations:jsxInvocations.map(f=>({id:f.id,site:source(f.site.key),target:source(f.site.target),consumer:source(f.site.consumer),render:f.render.id,factory:f.site.factory,targetRead:f.targetRead,callee:witness(f.fn),arguments:f.args.map(witness),completion:f.returned?'returned':'threw',...(f.returned?{value:witness(f.value)}:{})}))},
   targetReads:{qualification:'source-object-target-property-reads-only',effectsVerified:false,acceptedContract:null,planned:targetReadSites.length,allocations:objectCount,reads:targetReads.map(r=>({id:r.id,site:source(r.site.key),objectSource:source(r.origin.key),property:r.site.property,render:r.render,factory:r.factory,value:witness(r.value),propertyEffectsVerified:true}))},
   values:{qualification:'source-object-rest-values-only',effectsVerified:false,acceptedContract:null,allocations:allocations.length,origins:allocations.filter(a=>a.used).map(a=>({id:a.id,source:source(a.key),identity:witness(a.value).identity,fields:a.keys.some(k=>typeof k!=='string')?null:a.keys.map(k=>[k,scalar(a.before[k].value)]),witnesses:a.keys.some(k=>typeof k!=='string')?null:a.keys.map(k=>[k,witness(a.before[k].value)])}))},
   calls:{qualification:'source-use-context-values-only',effectsVerified:false,acceptedContract:null,planned:sites.length,invocations:hookCalls.map(c=>({site:source(c.site.key),enclosingFunction:source(c.site.enclosing),read:c.read,lookup:c.lookup}))},
   hookLookups:{qualification:'native-context-hook-property-reads-only',effectsVerified:false,acceptedContract:null,interopNamespaces:namespaceCount,reads:lookupReads.map(r=>({id:r.id,site:source(r.site.key),kind:r.kind,render:r.render,read:r.read,propertyEffectsVerified:true}))},
   helpers:{qualification:'source-context-helper-return-identity-only',effectsVerified:false,acceptedContract:null,planned:helperSites.length,
    instances:helperInstances.map(i=>({id:i.id,source:source(i.site.key)})),
    invocations:helperInvocations.map(f=>({id:f.id,instance:f.item.id,consumer:source(f.consumer),render:f.render,parent:f.parent,sourceCall:f.sourceCall,reads:[...f.reads],closureReads:[...f.closureReads],completion:f.returned?'returned':'threw',returnSource:source(f.returnSource),...(f.returned?{value:scalar(f.value),witness:witness(f.value)}:{}),matchingReads:f.returned?f.reads.filter(i=>N.is(reads[i].value,f.value)):[]}))},
   helperClosures:{qualification:'source-context-helper-closure-reads-only',effectsVerified:false,acceptedContract:null,planned:helperSites.reduce((n,s)=>n+s.closureReads.length,0),
    reads:closureReads.map(r=>({id:r.id,site:source(r.key),helper:r.helper,instance:r.instance,render:r.render,value:witness(r.value),context:r.context}))},
   consumerCalls:{qualification:'consumer-context-helper-call-identity-only',effectsVerified:false,acceptedContract:null,planned:consumerSites.length,
    invocations:consumerInvocations.map(f=>({id:f.id,site:source(f.site.key),consumer:source(f.site.consumer),render:f.render.id,callee:witness(f.callee),calleeRead:f.calleeRead,arguments:f.args.map(scalar),argumentWitnesses:f.args.map(witness),completion:f.returned?'returned':'threw',...(f.returned?{value:scalar(f.value),returnWitness:witness(f.value)}:{}),helperInstance:f.item?.id??null,helperInvocation:f.helper?.id??null,returnMatched:f.matched}))}};
 }
 return {renderScope:()=>{const r=renders[renders.length-1];return {render:r?.id??null,renderSource:r?.key??null,consumerCalls:r?.consumerCalls.length??0};},nativeHookRead,nativeHookValue,nativeHookIdentify,nativeDefault,sourceScope:()=>{const render=renders[renders.length-1],call=consumerFrames[consumerFrames.length-1];return call&&call.render===render?{id:call.id,key:call.site.key,render:render.id,callee:call.callee,args:call.args}:null;},scope:()=>{const render=renders[renders.length-1],call=consumerFrames[consumerFrames.length-1];return {render:render?.id??null,consumerCall:call&&call.render===render?call.id:null};},register,access,beforeRead,element,push,pop,read,begin,finish,end,report,witness,sourceObject,targetRead,hook,interopKernelRegister,interop,hookRead,hookValue,use,rest,helperRegister,helperBegin,helperReturn,helperEnd,helperRead,consumerCall,consumerArgument,factoryCall,factoryArgument,bindingFunction,bindingRead};
})`;
