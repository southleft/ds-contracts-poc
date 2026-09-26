import type {HelperSourcePoint} from './react-helper-model.mjs';
import type {ReactElementObservedValue} from './react-element-invocation.js';

export interface ReactTargetCallbackRuntimeReport {
  qualification:'deferred-callback-invocation-boundaries-only';effectsVerified:false;acceptedContract:null;
  providers:number;
  values?:{qualification:'deferred-callback-return-values-only';effectsVerified:false;acceptedContract:null;contexts:number;invocations:number;targets:number};
  invocations:Array<{render:HelperSourcePoint;callback:HelperSourcePoint;call:HelperSourcePoint;inputSource:HelperSourcePoint;
    input:Array<[string,ReactElementObservedValue]>;output:HelperSourcePoint;factories:number}>;
}
/** Private boundary observations only. Preserves the actual callback and native
 * call order; no context values, function objects or refs escape in the report. */
export const reactTargetCallbackRuntime=String.raw`((plans,N,intrinsics,sameDescriptor,fail,knownLiteral,bridge,valuePlans)=>{
 const point=p=>JSON.stringify([p.file,p.sha256,p.start,p.end]);
 const objectPrototype=Object.prototype,objects=new N.WeakMapCtor(),outputs=new N.WeakMapCtor(),providerStack=[],callbackStack=[],providers=[],events=[];
 const arrayPrototype=Array.prototype,bindings=new Map();
 function binding(key,value,read){
  intrinsics();if(bindings.has(key)||typeof read!=='function'||!valuePlans.some(p=>p.projection.jsxTargets.some(t=>point(t.binding)===key)))fail('target-callback-binding-unplanned');
  bridge.checkInitializer(key,value);const item={key,value,read};bindingCheck(item);bindings.set(key,item);
 }
 function bindingCheck(item){if(!N.is(item.value,N.apply(item.read,undefined,[])))fail('target-callback-binding-changed');bridge.checkInitializer(item.key,item.value);}
 function fields(value,shape,frame,reactProps=false,keyWarning=false){
  if(!reactProps&&!knownLiteral(value))return false;
  const array=shape.kind==='array';if(N.prototype(value)!==(array?arrayPrototype:objectPrototype))return false;
  const ds=N.descriptors(value),all=N.keys(ds),items=array?shape.items.map((s,i)=>[String(i),s]):shape.fields;
  const warning=reactProps&&keyWarning&&ds.key&&!N.descriptor(ds.key,'value')&&!ds.key.enumerable,keys=warning?all.filter(k=>k!=='key'):all;
  if(keys.length!==items.length+(array?1:0))return false;
  for(let i=0;i<items.length;i++){const [key,s]=items[i],d=ds[key];if(keys[i]!==key||!d||!N.descriptor(d,'value')||!d.enumerable||!match(d.value,s,frame))return false;}
  return !array||keys[keys.length-1]==='length'&&ds.length.value===shape.items.length;
 }
 function match(value,shape,frame){
  if(shape.kind==='literal')return typeof value===shape.type&&N.is(value,shape.type==='undefined'?undefined:shape.value);
  if(shape.kind==='callback-input'){const d=frame.before[shape.key];return !!d&&N.is(value,d.value);}
  if(shape.kind==='opaque'||shape.kind==='input'||shape.kind==='parameter')return bridge.matchRoot(value,shape,frame.callback.frame);
  if(shape.kind==='jsx'){
   const created=N.apply(N.mapGet,outputs,[value]),origin=bridge.element(value);
   if(!created||created.frame!==frame||point(created.site.source)!==point(shape.source)||!origin)return false;
   bridge.checkElement(value,origin);const ds=N.descriptors(value);if(ds.key?.value!==shape.key)return false;
   let expected;
   if(shape.tag.kind==='host')expected=shape.tag.name;
   else if(shape.tag.kind==='fragment')expected=Symbol.for('react.fragment');
   else{const item=bindings.get(point(shape.tag.source));if(!item)return false;bindingCheck(item);expected=item.value;}
   return N.is(ds.type?.value,expected)&&fields(origin.props,shape.props,frame,true,shape.key!==null);
  }
  return fields(value,shape,frame);
 }
 function inputMatches(frame,p){
  if(JSON.stringify(frame.callback.frame.model.input)!==JSON.stringify(p.rootInput))return false;
  const keys=N.keys(frame.before);if(keys.length!==p.input.length)return false;
  return keys.every((key,i)=>key===p.input[i][0]&&JSON.stringify(scalar(frame.before[key].value))===JSON.stringify(p.input[i][1]));
 }
 function checkValues(frame){
  if(!valuePlans.length)return;
  const p=frame.values;if(!p||!inputMatches(frame,p)||!match(frame.output,p.projection.output,frame)||
   JSON.stringify(frame.trace)!==JSON.stringify(p.projection.targetFactories.map(f=>point(f.source))))fail('target-callback-return-values-mismatch');
 }
 function stable(value,before,reason){
  if(N.prototype(value)!==objectPrototype)fail(reason);const now=N.descriptors(value),ks=N.keys(now),old=N.keys(before);
  if(ks.length!==old.length)fail(reason);for(let i=0;i<ks.length;i++)if(ks[i]!==old[i]||!sameDescriptor(now[ks[i]],before[ks[i]]))fail(reason);
 }
 function data(value){
  const ds=N.descriptors(value);if(N.prototype(value)!==objectPrototype)fail('target-callback-input-prototype');
  for(const key of N.keys(ds))if(typeof key!=='string'||!N.descriptor(ds[key],'value'))fail('target-callback-input-not-data');return ds;
 }
 function scalar(value){
  if(value===null)return {kind:'null',value:null};
  if(typeof value==='number')return N.is(value,-0)?{kind:'number',representation:'negative-zero'}:Number.isFinite(value)?{kind:'number',value}:{kind:'number',representation:Number.isNaN(value)?'nan':value>0?'positive-infinity':'negative-infinity'};
  return typeof value==='string'||typeof value==='boolean'?{kind:typeof value,value}:{kind:typeof value};
 }
 function provider(fn,input,call){
  intrinsics();const owner=bridge.provider(fn,input,plans);if(!owner)return call();
  if(providers.length>=100000||providerStack.length>=256)fail('target-callback-provider-limit');
  bridge.checkProvider(owner);const frame={owner,finished:false,threw:false};providers.push(frame);providerStack.push(frame);
  try{
   const result=call();intrinsics();bridge.checkProvider(owner);const origin=bridge.element(result);if(!origin)fail('target-callback-provider-return-unregistered');
   frame.result=result;frame.origin=origin;return result;
  }catch(error){frame.threw=true;throw error;}
  finally{frame.finished=true;if(providerStack[providerStack.length-1]!==frame)fail('target-callback-provider-stack');providerStack.pop();}
 }
 function object(key,value){
  intrinsics();const provider=providerStack[providerStack.length-1];
  if(!provider||!plans.some(p=>point(p.provider)===provider.owner.key&&point(p.input)===key))fail('target-callback-object-owner-unproved');
  if(!knownLiteral(value))fail('target-callback-object-unregistered');
  if(N.apply(N.mapGet,objects,[value]))fail('target-callback-object-reused');
  N.apply(N.mapSet,objects,[value,{key,provider,before:data(value)}]);return value;
 }
 function invoke(key,fn,input){
  intrinsics();const provider=providerStack[providerStack.length-1],callback=bridge.callback(fn);
  // Identity membership precedes any reflection on a function or argument.
  if(!provider||!callback||callback.frame!==provider.owner.frame)fail('target-callback-callee-owner-unproved');
  const plan=plans.find(p=>point(p.call)===key&&point(p.provider)===provider.owner.key&&point(p.callback)===callback.key&&point(p.render)===point(callback.frame.model.render));
  const origin=N.apply(N.mapGet,objects,[input]);
  if(!plan||!origin||origin.provider!==provider||origin.key!==point(plan.input))fail('target-callback-input-origin-unproved');
  bridge.checkProvider(provider.owner);bridge.checkCallback(callback);stable(input,origin.before,'target-callback-input-mutated');
  if(events.length>=100000||callbackStack.length>=256)fail('target-callback-invocation-limit');
  const frame={plan,provider,callback,input,before:origin.before,finished:false,threw:false,factories:0,trace:[]};
  if(valuePlans.length){
   const candidates=valuePlans.filter(p=>JSON.stringify(p.boundary)===JSON.stringify(plan)&&inputMatches(frame,p));
   if(candidates.length!==1)fail('target-callback-input-context-unmodeled');frame.values=candidates[0];
  }
  events.push(frame);callbackStack.push(frame);
  try{
   const output=N.apply(fn,undefined,[input]);intrinsics();bridge.checkProvider(provider.owner);bridge.checkCallback(callback);stable(input,origin.before,'target-callback-input-mutated');
   const created=N.apply(N.mapGet,outputs,[output]),element=bridge.element(output);
   if(!created||created.frame!==frame||!element)fail('target-callback-return-origin-unproved');
   frame.output=output;frame.created=created;frame.element=element;checkValues(frame);return output;
  }catch(error){frame.threw=true;throw error;}
  finally{frame.finished=true;if(callbackStack[callbackStack.length-1]!==frame)fail('target-callback-invocation-stack');callbackStack.pop();}
 }
 function factory(key,value){
  intrinsics();const frame=callbackStack[callbackStack.length-1];
  const site=frame&&frame.plan.factories.find(f=>point(f.source)===key);
  if(!site||!bridge.element(value))fail('target-callback-factory-origin-unproved');
  if(N.apply(N.mapGet,outputs,[value]))fail('target-callback-element-reused');
  N.apply(N.mapSet,outputs,[value,{frame,site}]);frame.factories++;frame.trace.push(point(site.source));return value;
 }
 function report(){
  intrinsics();if(providerStack.length||callbackStack.length)fail('target-callback-boundary-open');
  for(const plan of plans)if(!events.some(e=>e.plan===plan))fail('target-callback-plan-unobserved');
  for(const plan of valuePlans)if(!events.some(e=>e.values===plan))fail('target-callback-value-context-unobserved');
  for(const frame of providers){if(!frame.finished||frame.threw)fail('target-callback-provider-threw');bridge.checkProvider(frame.owner);bridge.checkElement(frame.result,frame.origin);}
  for(const frame of events){
   if(!frame.finished||frame.threw)fail('target-callback-invocation-threw');bridge.checkCallback(frame.callback);stable(frame.input,frame.before,'target-callback-retained-input-mutated');bridge.checkElement(frame.output,frame.element);checkValues(frame);
  }
  return {qualification:'deferred-callback-invocation-boundaries-only',effectsVerified:false,acceptedContract:null,providers:providers.length,
   ...(valuePlans.length?{values:{qualification:'deferred-callback-return-values-only',effectsVerified:false,acceptedContract:null,contexts:valuePlans.length,invocations:events.length,targets:bindings.size}}:{}),
   invocations:events.map(f=>({render:{...f.plan.render},callback:{...f.plan.callback},call:{...f.plan.call},inputSource:{...f.plan.input},
    input:N.keys(f.before).map(k=>[k,scalar(f.before[k].value)]),output:{...f.created.site.source},factories:f.factories}))};
 }
 return {provider,object,invoke,factory,report,binding};
})`;
