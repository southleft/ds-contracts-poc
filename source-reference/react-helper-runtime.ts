import {reactRenderGraphRuntime,type ReactRenderGraphReport} from './react-render-graph-runtime.js';
import type {ReactConsumerLiteral} from './react-consumer-literals.js';
import {reactConsumerLiteralRuntime,type ReactConsumerLiteralReport} from './react-consumer-literal-runtime.js';
import type {ReactHookHelpers} from './react-hook-helpers.js';
import {reactHookHelperRuntime,type ReactHookHelperReport} from './react-hook-helper-runtime.js';
import type {ReactCallbackFactories} from './react-callback-factories.js';
import {reactStateRuntime,type ReactStateRuntimeReport} from './react-state-runtime.js';
import {reactCallbackFactoryRuntime,type ReactCallbackFactoryReport} from './react-callback-factory-runtime.js';
import {reactEffectRuntime,type ReactEffectRuntimeReport} from './react-effect-runtime.js';
import type {ReactEffectHook} from './react-effect-hooks.js';
import {reactRefRuntime,type ReactRefRuntimeReport} from './react-ref-runtime.js';
import type {ReactRefHook} from './react-ref-hooks.js';
import {reactCallbackSourceRuntime,type ReactCallbackSourceReport} from './react-callback-source-runtime.js';
import type {ReactCallbackSources} from './react-callback-sources.js';
import {reactTargetProjectionRuntime} from './react-target-projection-runtime.js';
import {reactContextRuntime,type ReactContextRuntimeReport,type ReactContextValueWitness} from './react-context-runtime.js';
import {reactCallbackRuntime,type ReactCallbackRuntimeReport} from './react-callback-runtime.js';
import type {ReactContextCall,ReactContextRest,ReactContextHelper,ReactContextConsumerCall,ReactContextFactoryCall,ReactContextBindings,ReactContextTargets} from './react-context-calls.js';
import type {ReactTargetEffects} from './react-target-effects.js';
import type {ReactTargetCallbackPlan} from './react-target-callback-plan.js';
import type {ReactTargetCallbackValues} from './react-target-callback-values.js';
import type {ReactTargetCallbackRuntimeReport} from './react-target-callback-runtime.js';
import type {ReactTargetInitializer} from './react-target-initializer.js';
import {reactTargetInitializerRuntime} from './react-target-initializer-runtime.js';
import type {
  HelperModelResult,
  ComponentModelResult,
  JsxModelResult,
} from "./react-helper-model.mjs";
import { reactHelperIntrinsicGuard } from "./react-helper-intrinsics.js";
import { reactHelperBindingGuard } from "./react-helper-binding-runtime.js";

type Model = Extract<HelperModelResult, { status: "modeled" }>;
type ComponentModel = Extract<ComponentModelResult | JsxModelResult, { status: "modeled" }>;
export interface ReactTargetRenderInputWitness {
  render:number;origin:string;keys:string[];ref:'null'|'object'|'function';
  value:ReactContextValueWitness;refValue:ReactContextValueWitness;fields:Array<[string,ReactContextValueWitness]>;
}
export interface ReactTargetRenderOutputWitness {
  render:number;factory:string;keys:string[];value:ReactContextValueWitness;props:ReactContextValueWitness;
  type:ReactContextValueWitness;key:ReactContextValueWitness;fields:Array<[string,ReactContextValueWitness]>;
}
export type ReactHelperRuntimeReport =
  | { status: "refused"; reason: string }
  | {
      status: "observed";
      contexts?:ReactContextRuntimeReport;
      callbackSources?:ReactCallbackSourceReport;
      callbackMemo?:ReactCallbackRuntimeReport;
      refHooks?:ReactRefRuntimeReport;
      effectHooks?:ReactEffectRuntimeReport;
      callbackFactories?:ReactCallbackFactoryReport;
      stateHooks?:ReactStateRuntimeReport;
      hookHelpers?:ReactHookHelperReport;
      consumerLiterals?:ReactConsumerLiteralReport;
      renderGraph?:ReactRenderGraphReport;
      targetCallbacks?:ReactTargetCallbackRuntimeReport;
      targetInitializers?:{qualification:'forward-ref-initializer-and-render-boundaries-only';effectsVerified:false;acceptedContract:null;targets:Array<{target:string;render:import('./react-helper-model.mjs').HelperSourcePoint;naming:boolean;dispatches:number;invocations:Array<{input:ReactTargetRenderInputWitness;output:ReactTargetRenderOutputWitness}>}>};
      targetProjections?:{qualification:'target-return-and-callback-values-only';effectsVerified:false;acceptedContract:null;models:number;invocations:Array<{render:import('./react-helper-model.mjs').HelperSourcePoint;callbacks:number;captures:number}>};
      helperCalls: number;
      forwardCopies: number;
      jsxCalls: number;
      elementCalls: number;
      metadataNodes: number;
      events: Array<{
        origin: string;
        parent: string | null;
        inputKeys: string[];
        context: number;
      }>;
      bindings: { registeredBindings: number; checkedCalls: number };
      components?: Array<{
        context: number;
        helperCalls: number;
        checkedCalls?: number;
        targetReads?: number;
        content: ComponentModel["content"];
      }>;
    };

/** Host-owned models in a fresh realm. Reports contain no source object references
 * or opaque caller values. A report alone cannot qualify content forwarding. */
export function reactHelperRuntimeHook(
  models: readonly Model[],
  components: readonly ComponentModel[] = [],
  jsxOnly = false,
  initializerPlans: readonly ReactTargetInitializer[] = [],
  projectionModels: readonly ReactTargetEffects[] = [],
  callbackPlans: readonly ReactTargetCallbackPlan[] = [],
  callbackValues: readonly ReactTargetCallbackValues[] = [],
  contextCalls: readonly ReactContextCall[] = [],
  contextRests: readonly ReactContextRest[] = [],
  contextHelpers: readonly ReactContextHelper[] = [],
  contextConsumerCalls: readonly ReactContextConsumerCall[] = [],
  contextFactories: readonly ReactContextFactoryCall[] = [],
  contextBindings?: ReactContextBindings,
  contextTargets?: ReactContextTargets,
  callbackSources?: ReactCallbackSources,
  refHooks: readonly ReactRefHook[] = [],
  effectHooks: readonly ReactEffectHook[] = [],
  callbackFactories?: ReactCallbackFactories,
  hookHelpers?:ReactHookHelpers,
  consumerLiterals:readonly ReactConsumerLiteral[]=[],
): string {
  if (
    (!models.length && !jsxOnly) ||
    models.some(
      (m) =>
        JSON.stringify(m.extraArguments) !==
        JSON.stringify(models[0].extraArguments),
    )
  )
    throw Error("helper-runtime-contexts-incompatible");
  if (
    !jsxOnly && components.length &&
    (components.length !== models.length ||
      components.some(
        (m, i) => JSON.stringify(m.input) !== JSON.stringify(models[i].input),
      ))
  )
    throw Error("component-runtime-contexts-incompatible");
  if(initializerPlans.length&&!jsxOnly)throw Error('target-initializer-context-invalid');
  if(jsxOnly && (models.length || !components.length || components.some(m=>!("jsxTargets" in m))))
    throw Error("jsx-helper-runtime-contexts-invalid");
  return `(((models,componentModels,jsxOnly,initializerPlans,projectionModels,callbackPlans,callbackValues,contextCalls,contextRests,contextHelpers,contextConsumerCalls,contextFactories,contextBindings,contextTargets,callbackSources,refHooks,effectHooks,callbackFactories,hookHelpers,consumerLiterals) => {
 const expected=models[0]?.extraArguments??[],contexts=models;
 const N={keys:Reflect.ownKeys,descriptors:Object.getOwnPropertyDescriptors,descriptor:Object.getOwnPropertyDescriptor,apply:Reflect.apply,weakHas:WeakSet.prototype.has,weakAdd:WeakSet.prototype.add,mapGet:WeakMap.prototype.get,mapSet:WeakMap.prototype.set,WeakSetCtor:WeakSet,WeakMapCtor:WeakMap,prototype:Object.getPrototypeOf,is:Object.is,define:Object.defineProperty,remove:Reflect.deleteProperty,setPrototype:Object.setPrototypeOf,ErrorCtor:Error,array:Array.isArray,integer:Number.isSafeInteger,string:String,extensible:Object.isExtensible};
 const objectPrototype=Object.prototype,arrayPrototype=Array.prototype;
 const literals=new N.WeakSetCtor(),props=new N.WeakMapCtor(),elements=new N.WeakMapCtor(),runtimes=new N.WeakSetCtor(),seenMetadata=new N.WeakSetCtor();
 const metadataNodes=[],defs=[],registeredDefinitions=[],events=[],failures=[];let helper,helperCalls=0,forwardCopies=0,jsxCalls=0,elementCalls=0;
 const componentEvents=[];let activeComponent=null,inHelper=false,fragment;const targets=new Map(),namespaces=new N.WeakMapCtor();
 const fail=reason=>{failures[failures.length]=reason;throw new N.ErrorCtor(reason);};
 const sameDescriptor=(a,b)=>{if(!a||!b)return false;const fields=['value','get','set','writable','enumerable','configurable'];for(let i=0;i<fields.length;i++){const left=N.descriptor(a,fields[i]),right=N.descriptor(b,fields[i]);if(!!left!==!!right||left&&!N.is(left.value,right.value))return false;}return true;};
 const intrinsics=${reactHelperIntrinsicGuard};
 const contextTransport=(${reactContextRuntime})(N,intrinsics,sameDescriptor,fail,contextCalls,contextRests,contextHelpers,contextConsumerCalls,contextFactories,(fn,args)=>{
  const value=element(fn,args,'jsx'),origin=N.apply(N.mapGet,elements,[value]);
  if(!origin||!N.is(origin.descriptors.type?.value,args[0]))fail('context-factory-target-changed');
  return value;
 },contextBindings,contextTargets,(id,value)=>callbackMemo.consumerReturn(id,value));
 const literalOrigins=(${reactConsumerLiteralRuntime})(consumerLiterals,N,intrinsics,fail,contextTransport.renderScope,contextTransport.witness);
 const callbackOrigins=(${reactCallbackSourceRuntime})(callbackSources,N,intrinsics,sameDescriptor,fail,contextTransport.sourceScope,contextTransport.witness,contextTransport,(id,args,value)=>callbackMemo.sourceReturn(id,args,value));
 const factoryOrigins=(${reactCallbackFactoryRuntime})(callbackFactories,N,intrinsics,sameDescriptor,fail,contextTransport.sourceScope,contextTransport.renderScope,contextTransport.witness);
 let helperHooks;
 const states=(${reactStateRuntime})(N,intrinsics,fail,contextTransport.scope,contextTransport.witness,()=>helperHooks?.stateScope()??null);
 const refs=(${reactRefRuntime})(refHooks,N,intrinsics,fail,contextTransport.renderScope,contextTransport.witness,contextTransport);
 const effects=(${reactEffectRuntime})(effectHooks,N,intrinsics,sameDescriptor,fail,()=>{const scope=contextTransport.renderScope();return {...scope,refCalls:refs.count(scope.render)};},contextTransport.witness,contextTransport,()=>helperHooks?.effectScope()??null);
 helperHooks=(${reactHookHelperRuntime})(hookHelpers,N,intrinsics,sameDescriptor,fail,contextTransport,states,effects);
 const callbackMemo=(${reactCallbackRuntime})(N,intrinsics,fail,contextTransport.scope,contextTransport.witness,callbackOrigins);
 const projection=(${reactTargetProjectionRuntime})(projectionModels,N,intrinsics,sameDescriptor,fail,knownLiteral,props,elements,callbackPlans,callbackValues,(key,value)=>initializers.check(key,value));
 const renderGraph=(${reactRenderGraphRuntime})(N,intrinsics,fail,contextTransport.witness,{
  factoryProps(input){const origin=N.apply(N.mapGet,props,[input]);return origin?origin.factoryProps??input:input;},
  children(value){
   // Native element identity does not make native props safe to reflect.
   const origin=N.apply(N.mapGet,elements,[value]);
   if(!origin)return {status:'refused',reason:'children-origin-unproved'};
   for(const [target,expected] of [[value,origin.descriptors],[origin.props,origin.origin.descriptors]]){
    if(N.prototype(target)!==objectPrototype)return {status:'refused',reason:'children-prototype-changed'};
    const ds=N.descriptors(target),keys=N.keys(ds),before=N.keys(expected);
    if(keys.length!==before.length||keys.some((k,i)=>k!==before[i]||!sameDescriptor(ds[k],expected[k])))return {status:'refused',reason:'children-data-changed'};
   }
   const child=origin.origin.descriptors.children;
   if(child&&!N.descriptor(child,'value'))return {status:'refused',reason:'children-accessor'};
   return {status:'verified',value:child?.value};
  },
  current(value,origin){
   if(N.prototype(value)!==objectPrototype)return false;
   for(const [target,expected] of [[value,origin.descriptors]]){
    const ds=N.descriptors(target),keys=N.keys(ds),before=N.keys(expected);
    if(keys.length!==before.length||keys.some((k,i)=>k!==before[i]||!sameDescriptor(ds[k],expected[k])))return false;
   }return true;
  }
 });
 const initializers=(${reactTargetInitializerRuntime})(initializerPlans,N,intrinsics,sameDescriptor,fail,targetBoundaries());
 function literal(value){N.apply(N.weakAdd,literals,[value]);return renderGraph.literal(value);}
 function knownLiteral(value){return value!==null&&(typeof value==='object'||typeof value==='function')&&N.apply(N.weakHas,literals,[value]);}
 const bindingGuard=(${reactHelperBindingGuard})([...models,...componentModels],()=>{intrinsics();if(activeComponent)checkTargets();},knownLiteral,reason=>{failures[failures.length]=reason;});
 function data(value,reason,origin){const ds=N.descriptors(value),keys=N.keys(ds);if(N.prototype(value)!==objectPrototype)fail(reason+'-prototype');for(let i=0;i<keys.length;i++){const k=keys[i],d=ds[k];
  // Only the unchanged warning getter created by the pinned React factory is
  // excluded. Arbitrary accessors and caller-shaped lookalikes still refuse.
  if(k==='key'&&origin?.keyWarning&&sameDescriptor(d,origin.keyWarning)){delete ds.key;continue;}
  if(typeof k!=='string'||!N.descriptor(d,'value'))fail(reason+'-accessor');}return ds;}
 function stable(value,origin,reason){
  const now=N.descriptors(value),keys=N.keys(now),oldKeys=N.keys(origin.descriptors);
  if(keys.length!==oldKeys.length)fail(reason);for(let i=0;i<keys.length;i++)if(keys[i]!==oldKeys[i]||!sameDescriptor(now[keys[i]],origin.descriptors[keys[i]]))fail(reason);
 }
 function register(value,shape){
  if(shape.kind==='literal'){if(typeof value!==shape.type||!N.is(value,shape.type==='undefined'?undefined:shape.value))fail('metadata-value-mismatch');return;}
  if(!knownLiteral(value))fail('metadata-provenance-unproved');
  const prototype=shape.kind==='array'?arrayPrototype:objectPrototype;if(N.prototype(value)!==prototype)fail('metadata-prototype-mismatch');
  const ds=N.descriptors(value),keys=N.keys(ds),fields=shape.kind==='array'?shape.items.map((v,i)=>[String(i),v]):shape.fields;
  if(keys.length!==fields.length+(shape.kind==='array'?1:0))fail('metadata-keys-mismatch');
  for(let i=0;i<fields.length;i++){const [key,child]=fields[i],d=ds[key];if(keys[i]!==key||!d||!N.descriptor(d,'value')||!d.enumerable||!d.configurable||!d.writable)fail('metadata-not-literal-data');register(d.value,child);}
  if(shape.kind==='array'){const d=ds.length;if(keys[keys.length-1]!=='length'||d.value!==shape.items.length||!d.writable||d.enumerable||d.configurable)fail('metadata-array-length-mismatch');}
  if(!N.apply(N.weakHas,seenMetadata,[value])){N.apply(N.weakAdd,seenMetadata,[value]);metadataNodes[metadataNodes.length]={value,prototype,descriptors:ds};}
 }
 function metadata(){for(let i=0;i<metadataNodes.length;i++){
  const before=metadataNodes[i],now=N.descriptors(before.value),keys=N.keys(now),oldKeys=N.keys(before.descriptors);
  if(N.prototype(before.value)!==before.prototype||keys.length!==oldKeys.length)fail('metadata-changed');
  for(let j=0;j<keys.length;j++)if(keys[j]!==oldKeys[j]||!sameDescriptor(before.descriptors[keys[j]],now[keys[j]]))fail('metadata-changed');
 }}
 function definition(index,value){intrinsics();if(typeof index!=='number'||index%1!==0||index<0||index>=expected.length)fail('metadata-index-invalid');if(registeredDefinitions[index])fail('metadata-registered-twice');register(value,expected[index]);defs[index]=value;registeredDefinitions[index]=true;return value;}
 function element(fn,args,kind){
  intrinsics();if(!N.apply(N.weakHas,runtimes,[fn]))fail('react-runtime-unregistered');
  const config=args[1];if(config!==null&&config!==undefined&&!knownLiteral(config))fail('jsx-config-provenance-unproved');
  if(config!==null&&config!==undefined)data(config,'jsx-config');
  const result=N.apply(fn,undefined,args);intrinsics();
  // The exact installed React runtime is pinned, registered at initialization,
  // and receives only known fresh compiler configs. Its returned props are not
  // inferred trustworthy from their appearance.
  const d=N.descriptor(result,'props');if(!d||!N.descriptor(d,'value'))fail('react-props-missing');
  const ref=N.descriptor(d.value,'ref');
  const descriptors=N.descriptors(d.value),warning=descriptors.key;
  const keyWarning=warning&&!N.descriptor(warning,'value')&&!warning.enumerable&&typeof warning.get==='function'&&warning.set===undefined?warning:undefined;
  const origin={kind,descriptors,ref:ref&&N.descriptor(ref,'value')?ref.value??null:null,keyWarning};
  N.apply(N.mapSet,props,[d.value,origin]);
  N.apply(N.mapSet,elements,[result,{descriptors:N.descriptors(result),props:d.value,origin}]);
  renderGraph.factory(result,N.apply(N.mapGet,elements,[result]));
  if(kind==='jsx')jsxCalls++;else elementCalls++;return result;
 }
 function forward(from,to){
  const origin=N.apply(N.mapGet,props,[from]);if(!origin)return;
  intrinsics();stable(from,origin,'forward-origin-mutated');const before=data(from,'forward-input',origin),keys=N.keys(before);
  if(to===from){if(N.descriptor(from,'ref'))fail('forward-ref-not-removed');origin.forwarded=true;return;}
  const after=data(to,'forward-output'),afterKeys=N.keys(after);let n=0;
  for(let i=0;i<keys.length;i++){const key=keys[i];if(key==='ref')continue;if(afterKeys[n++]!==key||!N.is(before[key].value,after[key].value))fail('forward-copy-mismatch');}
  if(n!==afterKeys.length)fail('forward-copy-mismatch');
  N.apply(N.mapSet,props,[to,{kind:'forward-ref-copy',parent:origin.kind,descriptors:after,ref:origin.ref,forwarded:true,factoryProps:origin.factoryProps??from}]);forwardCopies++;
 }
 // Only private factory/forward-copy records grant boundary provenance. Props,
 // refs, children and return objects never leave this realm in reports.
 function targetBoundaries(){
  function checkInput(record){
   if(N.prototype(record.value)!==objectPrototype)fail('target-input-prototype-changed');
   stable(record.value,record.origin,'target-input-mutated');
  }
  function checkOutput(record){
   if(N.prototype(record.value)!==objectPrototype||N.prototype(record.origin.props)!==objectPrototype)fail('target-output-prototype-changed');
   stable(record.value,record.origin,'target-output-mutated');
   stable(record.origin.props,record.origin.origin,'target-output-props-mutated');
  }
  function fields(value,reason,origin){const ds=data(value,reason,origin);return N.keys(ds).map(key=>[key,contextTransport.witness(ds[key].value)]);}
  return {
   other:(fn,input,_ref,call)=>{const frame=contextTransport.begin(null);try{return projection.deferred.provider(fn,input,call);}finally{contextTransport.end(frame);}},
   input(value,ref,renderKey){
    const origin=N.apply(N.mapGet,props,[value]);
    if(!origin||!origin.forwarded)fail('target-input-provenance-unproved');
    if(!N.is(ref,origin.ref))fail('target-input-ref-mismatch');
    if(ref!==null&&typeof ref!=='object'&&typeof ref!=='function')fail('target-input-ref-unmodeled');
    const record={value,origin,ref};checkInput(record);data(value,'target-input',origin);record.context=contextTransport.begin(renderKey);renderGraph.source(record.context.id);record.projection=projection.begin(renderKey,value,ref);return record;
   },
   output(value,input){
    const origin=N.apply(N.mapGet,elements,[value]);
    if(!origin)fail('target-output-provenance-unproved');
    const record={value,origin,render:input.context.id};checkOutput(record);projection.finish(input.projection,value);contextTransport.finish(input.context,value);return record;
   },checkInput,checkOutput,end(input){try{projection.end(input.projection);}finally{contextTransport.end(input.context);}},
   describeInput(record){return {render:record.context.id,origin:record.origin.kind,keys:N.keys(record.origin.descriptors),ref:record.ref===null?'null':typeof record.ref,
    value:contextTransport.witness(record.value),refValue:contextTransport.witness(record.ref),fields:fields(record.value,'target-input',record.origin)};},
   describeOutput(record){return {render:record.render,factory:record.origin.origin.kind,keys:N.keys(record.origin.origin.descriptors),
    value:contextTransport.witness(record.value),props:contextTransport.witness(record.origin.props),type:contextTransport.witness(record.origin.descriptors.type.value),key:contextTransport.witness(record.origin.descriptors.key.value),
    fields:fields(record.origin.props,'target-output-props',record.origin.origin)};}
  };
 }
 function match(value,shape,child,inputs){
  if(jsxOnly&&shape.kind==='input'){const input=N.descriptor(inputs,shape.key);return !!input&&N.is(value,input.value.value);}
  if(shape.kind==='opaque')return N.is(value,child);
  if(shape.kind==='literal')return typeof value===shape.type&&N.is(value,shape.type==='undefined'?undefined:shape.value);
  if(!knownLiteral(value)||N.prototype(value)!==(shape.kind==='array'?arrayPrototype:objectPrototype))return false;
  const ds=N.descriptors(value),keys=N.keys(ds),fields=shape.kind==='array'?shape.items.map((v,i)=>[String(i),v]):shape.fields;
  if(keys.length!==fields.length+(shape.kind==='array'?1:0))return false;
  for(let i=0;i<fields.length;i++){const [key,childShape]=fields[i],d=ds[key];if(keys[i]!==key||!d||!N.descriptor(d,'value')||!d.enumerable||!d.writable||!d.configurable||!match(d.value,childShape,child))return false;}
  if(shape.kind==='array'){const d=ds.length;if(keys[keys.length-1]!=='length'||d.value!==shape.items.length||!d.writable||d.enumerable||d.configurable)return false;}return true;
 }
 function invoke(fn,args){
  intrinsics();metadata();if(fn!==helper)fail('helper-identity-changed');
  if(defs.length!==expected.length||expected.some((_,i)=>!registeredDefinitions[i]))fail('metadata-registration-missing');if(args.length!==defs.length+1)fail('helper-arguments-changed');for(let i=0;i<defs.length;i++)if(args[i+1]!==defs[i])fail('metadata-root-changed');
  const input=args[0],origin=N.apply(N.mapGet,props,[input]);if(!origin)fail('input-provenance-unproved');
  const ds=data(input,'input',origin),keys=N.keys(ds);stable(input,origin,'input-origin-mutated');for(let i=0;i<keys.length;i++){const key=keys[i],value=ds[key].value;if(key!=='children'&&value!==null&&typeof value!=='string'&&typeof value!=='number'&&typeof value!=='boolean'&&typeof value!=='undefined')fail('input-domain-unproved');}
  const child=ds.children?.value;let selected;
  for(let i=0;i<contexts.length;i++){const fields=contexts[i].input.fields;if(fields.length!==keys.length)continue;let okay=true;for(let j=0;j<fields.length;j++){const [key,shape]=fields[j];if(keys[j]!==key||!ds[key]||!match(ds[key].value,shape,child)){okay=false;break;}}if(okay){selected=contexts[i];break;}}
  if(!selected)fail('input-context-unmodeled');
  const selectedIndex=contexts.indexOf(selected);bindingGuard.check(selectedIndex);
  if(componentModels.length&&(!activeComponent||activeComponent.context!==selectedIndex||activeComponent.input!==input||inHelper))fail('component-helper-invocation-mismatch');
  helperCalls++;let output;inHelper=true;
  try{output=componentModels.length?bindingGuard.within(selectedIndex,fn,args):bindingGuard.run(selectedIndex,fn,args);}finally{inHelper=false;}
  intrinsics();metadata();
  stable(input,origin,'input-mutated');const after=data(input,'input',origin);if(N.keys(after).length!==keys.length)fail('input-mutated');for(let i=0;i<keys.length;i++)if(!sameDescriptor(ds[keys[i]],after[keys[i]]))fail('input-mutated');
  if(!match(output,selected.output,child))fail('output-model-mismatch');
  events[events.length]={origin:origin.kind,parent:origin.parent??null,inputKeys:keys,context:selectedIndex};return output;
 }
 function returned(value,shape,frame){
  if(jsxOnly&&shape.kind==='input'){const input=N.descriptor(frame.before,shape.key);return !!input&&N.is(value,input.value.value);}
  if(shape.kind==='opaque')return N.is(value,frame.child);
  if(shape.kind==='parameter')return shape.index>0&&shape.index<=frame.secondary.length&&N.is(value,frame.secondary[shape.index-1]);
  if(shape.kind==='literal')return typeof value===shape.type&&N.is(value,shape.type==='undefined'?undefined:shape.value);
  if(shape.kind==='jsx'){
   const origin=N.apply(N.mapGet,elements,[value]);if(!origin)return false;
   stable(value,origin,'component-element-mutated');stable(origin.props,origin.origin,'component-return-props-mutated');
   const ds=N.descriptors(value),tag=ds.type?.value,key=ds.key?.value;
   const target=shape.tag.kind==='source-binding'?JSON.stringify([shape.tag.source.file,shape.tag.source.sha256,shape.tag.source.start,shape.tag.source.end]):undefined;
   if(target!==undefined){if(!jsxOnly||!targets.has(target)||!N.is(tag,targets.get(target).value))return false;}
   else if(tag!==(shape.tag.kind==='host'?shape.tag.name:fragment)||shape.tag.kind==='fragment'&&fragment===undefined)return false;
   if(key!==shape.key)return false;
   return returnedRecord(origin.props,shape.props,frame,true,shape.key!==null);
  }
  if(!knownLiteral(value))return false;
  return returnedRecord(value,shape,frame,false,false);
 }
 function returnedRecord(value,shape,frame,reactProps,hasKey){
  if(N.prototype(value)!==(shape.kind==='array'?arrayPrototype:objectPrototype))return false;
  const ds=N.descriptors(value),ks=N.keys(ds),fields=shape.kind==='array'?shape.items.map((v,i)=>[String(i),v]):shape.fields;
  if(!fields)return false;
  // Pinned React development factories add a non-enumerable key warning getter.
  // It is never invoked; its descriptor is authenticated by the factory record.
  const warning=reactProps&&hasKey&&ds.key&&!N.descriptor(ds.key,'value')&&!ds.key.enumerable;
  const keys=warning?ks.filter(k=>k!=='key'):ks;
  if(keys.length!==fields.length+(shape.kind==='array'?1:0))return false;
  for(let i=0;i<fields.length;i++){const [key,child]=fields[i],d=ds[key];if(keys[i]!==key||!d||!N.descriptor(d,'value')||!d.enumerable||!returned(d.value,child,frame))return false;}
  if(shape.kind==='array'&&(keys[keys.length-1]!=='length'||ds.length.value!==shape.items.length))return false;
  return true;
 }
 function namespaceExport(emit,value,definitions){
  intrinsics();if(!jsxOnly||activeComponent||N.prototype(value)!==objectPrototype||N.prototype(definitions)!==objectPrototype||N.keys(value).length)fail('jsx-namespace-initializer-invalid');
  // Both objects and the pure lexical getter functions are compiler-owned and
  // authenticated in the complete bundle before this realm executes it.
  const fields=N.descriptors(definitions),keys=N.keys(fields);
  const result=N.apply(emit,undefined,[value,definitions]);intrinsics();
  const ds=N.descriptors(value),actual=N.keys(ds);
  if(N.prototype(value)!==objectPrototype||actual.length!==keys.length)fail('jsx-namespace-initialization-changed');
  for(let i=0;i<keys.length;i++){
   const key=keys[i],source=fields[key],got=ds[key];
   if(actual[i]!==key||!source||!N.descriptor(source,'value')||typeof source.value!=='function'||!got||got.get!==source.value||got.set!==undefined||got.configurable||!got.enumerable||N.descriptor(got,'value'))fail('jsx-namespace-getter-changed');
  }
  N.apply(N.mapSet,namespaces,[value,{descriptors:ds}]);return result;
 }
 function namespaceRead(value,key){
  intrinsics();const origin=N.apply(N.mapGet,namespaces,[value]);
  if(!origin)fail('jsx-namespace-origin-unproved');
  if(N.prototype(value)!==objectPrototype)fail('jsx-namespace-prototype-changed');stable(value,origin,'jsx-namespace-mutated');
  const field=N.descriptor(origin.descriptors,key);if(!field||typeof field.value.get!=='function')fail('jsx-namespace-field-unproved');
  const result=value[key];intrinsics();stable(value,origin,'jsx-namespace-mutated');return result;
 }
 const point=p=>JSON.stringify([p.file,p.sha256,p.start,p.end]);
 function checkTargets(){
  if(!jsxOnly)return;
  for(const model of componentModels)for(const planned of model.jsxTargets){
   const target=targets.get(point(planned.binding));if(!target)fail('jsx-target-binding-unregistered');
   if(!N.is(target.value,N.apply(target.read,undefined,[])))fail('jsx-target-binding-changed');initializers.check(point(planned.binding),target.value);
  }
 }
 // The host verifies these callbacks in the finished bundle before execution:
 // each must read only the exact lexical binding registered for that export.
 function targetRead(key,read){
  intrinsics();if(!jsxOnly||!activeComponent||typeof read!=='function')fail('jsx-target-read-outside-component');
  const planned=componentModels[activeComponent.context].jsxTargets[activeComponent.targetCursor++];
  if(!planned||point(planned.read)!==key)fail('jsx-target-read-order-changed');
  checkTargets();const value=N.apply(read,undefined,[]);intrinsics();checkTargets();
  if(!N.is(value,targets.get(point(planned.binding)).value))fail('jsx-target-read-value-changed');return value;
 }
 function component(key,input,secondary,body){
  intrinsics();metadata();if(activeComponent||inHelper)fail('component-reentrant');
  const origin=N.apply(N.mapGet,props,[input]);if(!origin)fail('component-input-provenance-unproved');
  stable(input,origin,'component-input-origin-mutated');const ds=data(input,'component-input',origin),keys=N.keys(ds),child=ds.children?.value;
  if(secondary.length>1||secondary.length===1&&!N.is(secondary[0],origin.forwarded?origin.ref:undefined))fail('component-secondary-parameter-unproved');
  let context=-1;
  for(let i=0;i<componentModels.length;i++){
   const m=componentModels[i];if(JSON.stringify([m.component.file,m.component.sha256,m.component.start,m.component.end])!==key)continue;
   const fields=m.input.fields;if(fields.length!==keys.length)continue;
   let matches=true;for(let j=0;j<fields.length;j++){const [name,shape]=fields[j];if(keys[j]!==name||!ds[name]||!match(ds[name].value,shape,child,ds)){matches=false;break;}}
   if(matches){context=i;break;}
  }
  if(context<0)fail('component-input-context-unmodeled');
  const frame={context,input,secondary,child,before:ds,targetCursor:0},before=helperCalls,callsBefore=bindingGuard.report().checkedCalls;activeComponent=frame;
  try{
   const output=bindingGuard.component(models.length+context,key,body,jsxOnly);intrinsics();metadata();stable(input,origin,'component-input-mutated');
   if(!jsxOnly&&helperCalls<=before)fail('component-helper-call-unobserved');
   if(jsxOnly&&frame.targetCursor!==componentModels[context].jsxTargets.length)fail('jsx-target-read-incomplete');
   if(!returned(output,componentModels[context].output,frame))fail('component-return-model-mismatch');
   renderGraph.component(context,input,output);
   componentEvents[componentEvents.length]={context,helperCalls:helperCalls-before,...(jsxOnly?{checkedCalls:bindingGuard.report().checkedCalls-callsBefore,targetReads:frame.targetCursor}:{}),content:componentModels[context].content};return output;
  }finally{activeComponent=null;}
 }
 const raw={renderGraphHost:renderGraph.host,consumerLiteral:literalOrigins.capture,helperRegister:helperHooks.register,helperBegin:helperHooks.begin,helperReturn:helperHooks.returned,helperEnd:helperHooks.end,helperHookValue:helperHooks.hookValue,helperHookRead:helperHooks.hookRead,helperHookDefault:helperHooks.hookDefault,helperHookCall:helperHooks.hookCall,helperHookLiteral:helperHooks.literal,helperHookDependencies:helperHooks.dependencies,stateBegin:states.begin,stateInitialized:states.initialized,stateQueue:states.queue,stateTuple:states.tuple,stateReturn:states.returned,stateThrow:states.thrown,stateEnd:states.end,factoryRegister:factoryOrigins.register,factoryArgument:factoryOrigins.argument,factoryBegin:factoryOrigins.begin,factoryLiteral:factoryOrigins.literal,factoryNamingHelper:factoryOrigins.namingHelper,factoryName:factoryOrigins.name,factoryReturn:factoryOrigins.returned,factoryEnd:factoryOrigins.end,effectRecord:effects.record,effectCreateBegin:effects.createBegin,effectCleanupValue:effects.cleanupValue,effectCleanupBegin:effects.cleanupBegin,effectRunReturn:effects.returned,effectRunThrow:effects.thrown,effectRunEnd:effects.end,effectHookValue:effects.hookValue,effectHookRead:effects.hookRead,effectHookDefault:effects.hookDefault,effectHookCall:effects.hookCall,effectLiteral:effects.literal,effectDependencies:effects.dependencies,refState:refs.state,refMount:refs.mount,refUpdate:refs.update,refHookValue:refs.hookValue,refHookRead:refs.hookRead,refHookDefault:refs.hookDefault,refHookCall:refs.hookCall,callbackSourceHookDefault:callbackOrigins.hookDefault,callbackSourceHookRead:callbackOrigins.hookRead,callbackSourceHookValue:callbackOrigins.hookValue,callbackSourceHookCall:callbackOrigins.hookCall,callbackSourceRegister:callbackOrigins.register,callbackSourceBegin:callbackOrigins.begin,callbackSourceReturn:callbackOrigins.returned,callbackSourceEnd:callbackOrigins.end,callbackSourceCall:callbackOrigins.call,callbackSourceLiteral:callbackOrigins.callback,callbackState:callbackMemo.state,callbackBegin:callbackMemo.begin,callbackCompare:callbackMemo.compare,callbackReturn:callbackMemo.returned,callbackEnd:callbackMemo.end,callbackMount:callbackMemo.mount,contextObject:contextTransport.sourceObject,contextTargetRead:contextTransport.targetRead,contextInteropKernel:contextTransport.interopKernelRegister,contextInterop:contextTransport.interop,contextHookRead:contextTransport.hookRead,contextHookValue:contextTransport.hookValue,contextHelperRead:contextTransport.helperRead,contextBindingRead:contextTransport.bindingRead,contextBindingFunction:contextTransport.bindingFunction,contextFactoryCall:contextTransport.factoryCall,contextFactoryArgument:contextTransport.factoryArgument,contextConsumerCall:contextTransport.consumerCall,contextConsumerArgument:contextTransport.consumerArgument,contextHelperRegister:contextTransport.helperRegister,contextHelperBegin:contextTransport.helperBegin,contextHelperReturn:contextTransport.helperReturn,contextHelperEnd:contextTransport.helperEnd,contextRest:contextTransport.rest,contextHook:contextTransport.hook,contextUse:contextTransport.use,contextBeforeRead:contextTransport.beforeRead,contextCreated:contextTransport.register,contextAccess:contextTransport.access,contextElement:(type,props,value)=>renderGraph.native(contextTransport.element(type,props,value),props,type),contextPush:contextTransport.push,contextPop:contextTransport.pop,contextRead:contextTransport.read,targetCallbackBinding:projection.deferred.binding,targetCallbackObject:projection.deferred.object,targetCallbackInvoke:projection.deferred.invoke,targetCallbackFactory:projection.deferred.factory,targetProjectionBinding:projection.binding,targetProjectionCallback:projection.callback,targetProjectionRest:projection.rest,targetProjectionResult:projection.result,literal,definition,targetRead,namespaceExport,namespaceRead,targetRender:initializers.render,targetNamingHelper:initializers.namingHelper,targetName:initializers.name,targetForward:initializers.forward,targetDispatch:initializers.dispatch,targetInvoke:(fn,input,ref,call)=>renderGraph.invoke(fn,input,()=>initializers.invoke(fn,input,ref,call)),registerForwardRef:initializers.registerForwardRef,registerTarget(key,value,read){intrinsics();if(!jsxOnly||typeof read!=='function'||targets.has(key)||!componentModels.some(m=>m.jsxTargets?.some(t=>point(t.binding)===key)))fail('jsx-target-registration-unplanned-or-duplicate');if(!N.is(value,N.apply(read,undefined,[])))fail('jsx-target-binding-changed');initializers.check(key,value);targets.set(key,{value,read});},sourceFunction:bindingGuard.sourceFunction,binding:bindingGuard.binding,sourceCall:bindingGuard.sourceCall,reactDisplayName:(fn,name,invoke)=>initializers.displayName(fn,name,()=>bindingGuard.reactDisplayName(fn,name,invoke)),registerHelper(fn){intrinsics();if(helper&&helper!==fn)fail('helper-registered-twice');helper=fn;},registerRuntime(...fns){intrinsics();for(let i=0;i<fns.length;i++)N.apply(N.weakAdd,runtimes,[fns[i]]);},registerFragment(value){intrinsics();if(fragment!==undefined&&fragment!==value)fail('react-fragment-changed');fragment=value;},jsx(fn,...args){return element(fn,args,'jsx');},createElement(fn,...args){return element(fn,args,'create-element');},forward,invoke,component};
 const api=Object.create(null);
 // A consumer or factory call can throw an original source exception that its caller
 // catches. Its boundary records that outcome; do not mark it as an observer
 // failure. Validation failures still go through fail() inside the boundary.
 for(const key of N.keys(raw))api[key]=(key==='contextConsumerCall'||key==='contextFactoryCall'||key==='callbackSourceCall'||key==='callbackSourceHookCall')?raw[key]:(...args)=>{try{return N.apply(raw[key],undefined,args);}catch(error){failures[failures.length]='helper-runtime-'+key+'-failed';throw error;}};
 Object.freeze(api);N.define(globalThis,'__DSC_RUNTIME_PROOF',{value:api,writable:false,configurable:false});
 N.define(globalThis,'__DSC_RUNTIME_READ',{value:()=>{
  try {
   intrinsics();metadata();checkTargets();for(let i=0;i<events.length;i++)bindingGuard.check(events[i].context);for(let i=0;i<componentEvents.length;i++)bindingGuard.check(models.length+componentEvents[i].context);const bindings=bindingGuard.report();
   if(failures.length)return {status:'refused',reason:failures[0]};
   if(!jsxOnly&&(!helperCalls||helperCalls!==events.length))return {status:'refused',reason:'helper-runtime-call-unobserved'};
   if(componentModels.length&&(!componentEvents.length||activeComponent||inHelper||componentEvents.reduce((n,e)=>n+e.helperCalls,0)!==helperCalls))return {status:'refused',reason:'component-runtime-call-unobserved'};
   return {status:'observed',consumerLiterals:literalOrigins.report(),hookHelpers:helperHooks.report(),stateHooks:states.report(),callbackFactories:factoryOrigins.report(),effectHooks:effects.report(),refHooks:refs.report(),contexts:contextTransport.report(),callbackSources:callbackOrigins.report(),callbackMemo:callbackMemo.report(),...(jsxOnly?{targetInitializers:initializers.report(),targetProjections:projection.report(),targetCallbacks:projection.deferred.report()}:{}),helperCalls,forwardCopies,jsxCalls,elementCalls,metadataNodes:metadataNodes.length,
    events:events.map(e=>({...e,inputKeys:[...e.inputKeys]})),bindings,...(componentModels.length?{components:componentEvents.map(e=>({...e}))}:{}),renderGraph:renderGraph.report()};
  }catch{return {status:'refused',reason:failures[0]??'helper-runtime-state-changed'};}
 },writable:false,configurable:false});
}))(${JSON.stringify(models)},${JSON.stringify(components)},${jsxOnly},${JSON.stringify(initializerPlans)},${JSON.stringify(projectionModels)},${JSON.stringify(callbackPlans)},${JSON.stringify(callbackValues)},${JSON.stringify(contextCalls)},${JSON.stringify(contextRests)},${JSON.stringify(contextHelpers)},${JSON.stringify(contextConsumerCalls)},${JSON.stringify(contextFactories)},${JSON.stringify(contextBindings)},${JSON.stringify(contextTargets)},${JSON.stringify(callbackSources)},${JSON.stringify(refHooks)},${JSON.stringify(effectHooks)},${JSON.stringify(callbackFactories)},${JSON.stringify(hookHelpers)},${JSON.stringify(consumerLiterals)});`;
}
export const reactHelperRuntimeRead = `(() => {
 return typeof __DSC_RUNTIME_READ==='function' ? __DSC_RUNTIME_READ() : {status:'refused',reason:'helper-runtime-missing'};
})()`;
