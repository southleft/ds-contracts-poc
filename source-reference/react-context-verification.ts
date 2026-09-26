import {planReactConsumerLiterals} from './react-consumer-literals.js';
import {verifyReactHookHelpers,type ReactHookHelperVerification} from './react-hook-helper-verification.js';
import {planReactCallbackFactories} from './react-callback-factories.js';
import {planReactEffectHooks} from './react-effect-hooks.js';
import {planReactRefHooks} from './react-ref-hooks.js';
import type {ReactHelperReference} from './react-helper-effects.js';
import type {ReactHelperRuntimeReport,ReactTargetRenderInputWitness} from './react-helper-runtime.js';
import type {ReactContextValueWitness} from './react-context-runtime.js';
import type {ReactJsxHelperInstrumentationPlan} from './react-helper-instrument.js';
import type {ReactJsxLookupProof} from './react-jsx-lookup.js';
import type {ContextConsumerHookAssumption,ContextConsumerFactoryAssumption,ContextConsumerEffectAssumption,ContextConsumerRefAssumption,ContextConsumerCallbackAssumption,ContextConsumerCallAssumption,ContextConsumerValueShape,HelperSourcePoint} from './react-helper-model.mjs';
import {verifyReactCallbackCreations} from './react-callback-creation.js';
import {modelReactContextConsumerInput,modelReactContextHelperInput} from './react-target-effects.js';

export interface ReactContextConsumerVerification {
  qualification:'observed-context-consumer-body-only';effectsVerified:false;acceptedContract:null;
  hookHelpers?:ReactHookHelperVerification;
  rows:Array<{render:number;source:HelperSourcePoint;status:'verified'|'refused';reason?:string;at?:HelperSourcePoint;
    consumerBodyVerified:boolean;helperInvocations:number[];bindingReads:number[];functionCalls:number[];
    literalValues:Array<{record:number;allocation:number;source:HelperSourcePoint;valuesVerified:true;mutationEffectsVerified:false}>;
    hookCalls:Array<{call:number;invocation:number;bodyVerified:true;stateTransitionsVerified:false;effectBodiesVerified:false}>;
    factoryCalls:Array<{call:number;invocation:number;callback:number;creationBodyVerified:true;callbackBodyVerified:false;capturesVerified:false}>;
    effectCalls:Array<{call:number;effect:number;dependenciesVerified:true;callbackBodyVerified:false}>;
    refCalls:Array<{call:number;nativeInvocation:number;state:number;argumentVerified:true;mutationEffectsVerified:false}>;
    callbackCalls:Array<{call:number;sourceInvocation:number;selectedCallback:number;argumentsVerified:true;callbackBodyVerified:false}>;
    remainingRequirements:readonly string[]}>;
}
const remaining=['enclosing-provider-context-state-ref-and-event-semantics','module-initialization-and-returned-component-behavior','unobserved-inputs-and-recovery'];
const same=(a:HelperSourcePoint|null|undefined,b:HelperSourcePoint|null|undefined)=>!!a&&!!b&&a.file===b.file&&a.sha256===b.sha256&&a.start===b.start&&a.end===b.end;
const key=(p:HelperSourcePoint)=>JSON.stringify([p.file,p.sha256,p.start,p.end]);
function requireProof(value:unknown,reason:string):asserts value {if(!value)throw Error('context-consumer-'+reason);}
function equal(a:ReactContextValueWitness|undefined,b:ReactContextValueWitness|undefined):boolean {
  if(!a||!b||a.kind!==b.kind||a.representation||b.representation)return false;
  if(['object','function','symbol','bigint'].includes(a.kind))return Number.isSafeInteger(a.identity)&&a.identity!>=0&&a.identity===b.identity;
  return Object.is(a.value,b.value);
}
function primitive(v:ReactContextValueWitness):string|number|boolean|null|undefined {
  requireProof(!v.representation,'value-representation-unmodeled');
  if(v.kind==='undefined'&&!('value' in v))return undefined;
  if(v.kind==='null'&&v.value===null)return null;
  if(v.kind==='number'&&typeof v.value==='number'&&Number.isFinite(v.value)&&!Object.is(v.value,-0))return v.value;
  if((v.kind==='boolean'||v.kind==='string')&&typeof v.value===v.kind)return v.value as string|boolean;
  throw Error('context-consumer-primitive-unmodeled');
}
const literal=(v:string|number|boolean|null|undefined):ReactContextValueWitness=>v===undefined?{kind:'undefined'}:v===null?{kind:'null',value:null}:{kind:typeof v,value:v};

/** Called only inside the sealed, unchanged guarded observation. Rebuild the
 * original source path and join all observations from that same render. These
 * results never grant a serialized report native/content acceptance authority.
 * The current rule admits one shallow returned element and pure local helpers;
 * callback execution, writes, unknown calls and nested projections remain refusals.
 * Qualified callback creation paths may contribute deferred callback identities. */
export function verifyReactContextConsumers(reference:ReactHelperReference,plan:ReactJsxHelperInstrumentationPlan,runtime:ReactHelperRuntimeReport,lookup:ReactJsxLookupProof):ReactContextConsumerVerification {
  const result:ReactContextConsumerVerification={qualification:'observed-context-consumer-body-only',effectsVerified:false,acceptedContract:null,rows:[]};
  requireProof(runtime.status==='observed'&&runtime.contexts&&runtime.targetInitializers&&lookup.status==='verified','runtime-unavailable');
  const helperProof=verifyReactHookHelpers(reference,plan,runtime,lookup);result.hookHelpers=helperProof;
  const c=runtime.contexts,creations=verifyReactCallbackCreations(reference,plan,runtime,lookup);
  for(const render of c.renders.invocations){
    if(!render.consumerCalls.some(id=>c.consumerCalls.invocations[id]?.helperInvocation!==null&&c.consumerCalls.invocations[id]?.helperInvocation!==undefined))continue;
    const row:ReactContextConsumerVerification['rows'][number]={render:render.id,source:render.source,status:'refused',consumerBodyVerified:false,helperInvocations:[],bindingReads:[],functionCalls:[],callbackCalls:[],refCalls:[],effectCalls:[],factoryCalls:[],hookCalls:[],literalValues:[],remainingRequirements:remaining};result.rows.push(row);
    try{
      requireProof(render.completion==='returned','render-threw');
      if(plan.consumerLiterals)requireProof(JSON.stringify(planReactConsumerLiterals(reference,plan.initializers??[]))===JSON.stringify(plan.consumerLiterals),'literal-plan-changed');
      const initializer=plan.initializers?.find(p=>same(p.render,render.source));requireProof(initializer,'initializer-missing');
      const targets=runtime.targetInitializers.targets.filter(t=>same(t.render,render.source));requireProof(targets.length===1,'initializer-ambiguous');
      const boundaries=targets[0].invocations.filter(i=>i.input.render===render.id&&i.output.render===render.id);requireProof(boundaries.length===1,'boundary-ambiguous');
      const {input,output}=boundaries[0];
      requireProof(['jsx','forward-ref-copy'].includes(input.origin),'input-origin');
      const actualCalls=render.consumerCalls.map(id=>{const call=c.consumerCalls.invocations[id];requireProof(call&&call.id===id&&call.render===render.id&&same(call.consumer,render.source),'call-render-mismatch');return call;});
      requireProof(new Set(render.consumerCalls).size===render.consumerCalls.length&&actualCalls.length===c.consumerCalls.invocations.filter(i=>i.render===render.id).length,'call-coverage');
      const helperCalls=actualCalls.filter(i=>i.helperInvocation!==null),assumptions:ContextConsumerCallAssumption[]=[];
      const allReads:number[]=[];
      for(const call of helperCalls){
        requireProof(call.completion==='returned'&&call.returnMatched&&lookup.contextConsumerCallees?.includes(key(call.site)),'helper-call-unverified');
        const helper=c.helpers.invocations[call.helperInvocation!];requireProof(helper&&helper.id===call.helperInvocation&&helper.render===render.id&&helper.sourceCall===call.id&&helper.instance===call.helperInstance&&helper.parent===null&&helper.completion==='returned','helper-boundary');
        const instance=c.helpers.instances[helper.instance],source=plan.contextHelpers?.find(p=>same(p.source,instance?.source));requireProof(source,'helper-source');
        if(call.calleeRead!==null){
          const read=c.bindings.reads[call.calleeRead],callPlan=plan.contextConsumerCalls?.find(p=>same(p.call,call.site));
          requireProof(read&&read.id===call.calleeRead&&read.kind==='value'&&read.render===render.id&&read.calleeOf===call.id&&same(read.site,callPlan?.callee)&&equal(read.value,call.callee),'helper-callee-binding');
          row.bindingReads.push(read.id);
        }
        const closures=helper.closureReads.map(id=>{const read=c.helperClosures.reads[id];requireProof(read&&read.id===id&&read.helper===helper.id&&read.instance===helper.instance&&read.render===render.id,'helper-closure-link');return read;});
        requireProof(closures.length===c.helperClosures.reads.filter(r=>r.helper===helper.id).length,'helper-closure-coverage');
        const native=helper.reads.map(id=>{
          const read=c.reads[id],calls=c.calls.invocations.filter(i=>i.read===id);requireProof(read&&read.render===render.id&&calls.length===1&&same(calls[0].enclosingFunction,source.source),'native-read-link');
          const sourceCall=plan.contextCalls?.find(p=>same(p.call,calls[0].site));requireProof(sourceCall&&sourceCall.receiver!=='default','native-import-lookup-unmodeled');
          const hook=c.hookLookups.reads[calls[0].lookup];requireProof(hook&&hook.id===calls[0].lookup&&hook.read===id&&hook.render===render.id&&same(hook.site,calls[0].site)&&hook.propertyEffectsVerified,'native-lookup-link');
          const origin=c.values.origins.find(o=>o.id===read.valueOrigin),provider=read.provider===null?undefined:c.providers[read.provider];
          requireProof(origin?.fields&&origin.witnesses&&provider&&provider.valueOrigin===origin.id&&provider.context===read.context,'context-origin');
          requireProof(plan.contextRests?.some(p=>same(p.binding,origin.source)),'context-allocation-unplanned');
          requireProof(origin.fields.length===origin.witnesses.length&&origin.fields.every(([name,v],i)=>{
            const [witnessName,w]=origin.witnesses![i];return name===witnessName&&v.kind===w.kind&&v.representation===w.representation&&Object.is(v.value,w.value);
          }),'context-field-witnesses');
          allReads.push(id);return {site:calls[0].site,context:read.context,value:read.value,origin:{id:origin.id,fields:origin.fields}};
        });
        const model=modelReactContextHelperInput(reference,source,call.arguments,closures,native);
        requireProof(model.status==='modeled',model.status==='refused'?model.reason:'helper-model');
        requireProof(!model.writes.length&&model.calls.length===1&&model.calls[0].site===null&&same(model.calls[0].source,source.source)&&model.nativeCalls.length===native.length&&same(model.returnSource,helper.returnSource),'helper-path-effects');
        requireProof(model.output.kind==='context-value'&&helper.matchingReads.length===1&&helper.reads.includes(helper.matchingReads[0]),'helper-return-origin');
        const valueId=model.output.value,origin=c.values.origins.find(o=>o.id===valueId);requireProof(origin?.fields&&helper.witness?.kind==='object'&&helper.witness.identity===origin.identity,'helper-return-value');
        requireProof(c.reads[helper.matchingReads[0]].valueOrigin===valueId,'helper-matched-read');
        assumptions.push({site:call.site,arguments:call.arguments.map(primitive),value:{id:valueId,fields:origin.fields.map(([name,v])=>[name,['object','function','symbol','bigint'].includes(v.kind)?{opaque:v.kind}:primitive(v)])}});
        row.helperInvocations.push(helper.id);
      }
      requireProof(JSON.stringify(allReads)===JSON.stringify(render.reads),'context-read-order-or-coverage');
      const callbackAssumptions:ContextConsumerCallbackAssumption[]=[],callbackRoots=new Map<number,number>();
      for(const actual of actualCalls){
        const planned=plan.callbackSources?.consumers.find(p=>same(p.call,actual.site));if(!planned)continue;
        requireProof(actual.helperInvocation===null&&actual.completion==='returned'&&actual.calleeRead===null&&lookup.contextConsumerCallees?.includes(key(actual.site)),'callback-callee');
        const roots=runtime.callbackSources?.invocations.filter(i=>i.consumerCall===actual.id&&i.parent===null)??[];
        requireProof(roots.length===1,'callback-source-coverage');const root=roots[0];
        const qualified=creations.rows.filter(r=>r.sourceInvocation===root.id);
        requireProof(qualified.length===1&&qualified[0].status==='verified'&&qualified[0].creationBodyVerified,'callback-creation-unverified');
        const proof=qualified[0],selected=runtime.callbackSources!.callbacks[proof.selectedCallback!];
        requireProof(root.id>=0&&root.source===key(planned.source)&&root.render===render.id&&root.callVerified&&root.completion==='returned'&&root.arguments&&
          actual.argumentWitnesses?.length===root.arguments.length&&actual.argumentWitnesses.every((v,i)=>equal(v,root.arguments![i]))&&equal(actual.returnWitness,root.value)&&
          selected&&selected.id===proof.selectedCallback&&selected.originVerified&&equal(selected.value,root.value),'callback-source-values');
        const source=plan.callbackSources!.callbacks.find(p=>key(p.source)===selected.source);requireProof(source,'callback-selected-source');
        callbackAssumptions.push({site:actual.site,call:actual.id,contextCallsBefore:actualCalls.slice(0,actualCalls.indexOf(actual)).filter(c=>c.helperInvocation!==null).length,origin:selected.id,source:source.source});
        callbackRoots.set(actual.id,root.id);
      }
      const factoryAssumptions:ContextConsumerFactoryAssumption[]=[],factoryRuntime=runtime.callbackFactories,factoryRoots=new Map<number,number>();
      if(plan.callbackFactories)requireProof(JSON.stringify(planReactCallbackFactories(reference,plan.contextConsumerCalls??[]))===JSON.stringify(plan.callbackFactories),'factory-plan-changed');
      for(const actual of actualCalls){
        const planned=plan.callbackFactories?.consumers.find(p=>same(p.call,actual.site));if(!planned)continue;
        const source=plan.callbackFactories!.functions.find(p=>same(p.source,planned.source));requireProof(source&&actual.helperInvocation===null&&actual.calleeRead===null&&actual.completion==='returned'&&lookup.contextConsumerCallees?.includes(key(actual.site)),'factory-callee');
        const roots=factoryRuntime?.invocations.filter(i=>i.consumerCall===actual.id)??[];requireProof(roots.length===1,'factory-invocation-coverage');const root=roots[0],callback=factoryRuntime!.callbacks[root.callback!];
        requireProof(root.id>=0&&root.source===key(source.source)&&root.render===render.id&&root.callVerified&&root.bindingsVerified&&root.bindingPhase==='function-entry'&&root.consumerCallsBefore===actualCalls.indexOf(actual)&&root.completion==='returned'&&root.arguments&&root.arguments.length===actual.argumentWitnesses.length&&root.arguments.every((v,i)=>equal(v,actual.argumentWitnesses[i]))&&equal(root.value,actual.returnWitness),'factory-invocation-values');
        requireProof(callback&&callback.id===root.callback&&callback.invocation===root.id&&callback.source===key(source.callback)&&callback.originVerified&&callback.namingVerified&&equal(callback.value,root.value)&&callback.value.kind==='function','factory-return-identity');
        requireProof(factoryRuntime!.callbacks.filter(c=>c.invocation===root.id).length===1,'factory-callback-coverage');
        let index=0;
        for(const parameter of source.parameters){
          const arg=actual.argumentWitnesses[parameter.index]??literal(undefined);
          if(!parameter.object){const expected=arg.kind==='undefined'&&parameter.default?parameter.default:arg;requireProof(equal(root.bindings[index++],expected),'factory-parameter-value');continue;}
          let fields:Array<[string,ReactContextValueWitness]>;
          if(arg.kind==='undefined'&&parameter.defaultObject)fields=[];
          else {const items=factoryRuntime!.literals.filter(l=>l.consumerCall===actual.id&&l.kind==='object'&&equal(l.value,arg));requireProof(items.length===1&&items[0].fields&&plan.callbackFactories!.literals.some(l=>l.kind==='object'&&key(l.source)===items[0].source&&same(l.call,actual.site)),'factory-parameter-object-origin');fields=items[0].fields;requireProof(new Set(fields.map(([k])=>k)).size===fields.length,'factory-parameter-object-fields');}
          for(const binding of parameter.bindings){let expected=fields.find(([k])=>k===binding.key)?.[1]??literal(undefined);if(expected.kind==='undefined'&&binding.default)expected=binding.default;requireProof(equal(root.bindings[index++],expected),'factory-binding-value');}
        }
        requireProof(root.bindings.length===index,'factory-binding-coverage');
        factoryRoots.set(actual.id,root.id);factoryAssumptions.push({site:actual.site,call:actual.id,origin:callback.id,source:source.callback,consumerCallsBefore:root.consumerCallsBefore});
      }
      const hookAssumptions:ContextConsumerHookAssumption[]=[];
      for(const actual of actualCalls){
        const planned=plan.hookHelpers?.consumers.find(p=>same(p.call,actual.site));if(!planned)continue;
        const rows=helperProof.rows.filter(r=>r.consumerCall===actual.id),proof=rows[0],frame=runtime.hookHelpers?.invocations[proof?.invocation];
        requireProof(rows.length===1&&proof.status==='verified'&&proof.bodyVerified&&proof.value&&frame&&proof.source&&same(proof.source,planned.source),'hook-helper-body-unverified');
        const value=['object','function','symbol','bigint'].includes(proof.value.kind)?{opaque:true as const}:primitive(proof.value);
        hookAssumptions.push({site:actual.site,call:actual.id,invocation:proof.invocation,source:proof.source,consumerCallsBefore:frame.consumerCallsBefore,value});
      }
      const refAssumptions:ContextConsumerRefAssumption[]=[],refRuntime=runtime.refHooks;
      const actualRefs=refRuntime?.calls.filter(c=>c.render===render.id)??[];
      if(actualRefs.length)requireProof(JSON.stringify(planReactRefHooks(reference,plan.initializers??[]))===JSON.stringify(plan.refHooks),'ref-plan-changed');
      for(const call of actualRefs){
        const planned=plan.refHooks?.find(p=>same(p.call,call.site)),native=refRuntime!.invocations[call.nativeInvocation!];
        requireProof(planned&&same(planned.consumer,render.source)&&same(call.consumer,render.source)&&call.completion==='returned'&&call.arguments.length===1&&call.propertyEffectsVerified&&lookup.refHookReads?.includes(key(call.site)),'ref-source-call');
        requireProof(call.nativeInvocation!==null&&native&&native.id===call.nativeInvocation&&native.sourceHook===call.id&&native.render===render.id&&native.stateVerified&&equal(call.value,native.value)&&native.value.kind==='object','ref-native-link');
        const sameState=refRuntime!.invocations.filter(n=>n.state===native.state&&n.id<=native.id);
        requireProof(sameState.length>0&&sameState[0].phase==='mount'&&sameState.filter(n=>n.phase==='mount').length===1&&sameState.every(n=>equal(n.value,native.value)&&equal(n.initial,native.initial)),'ref-state-continuity');
        if(native.phase==='mount')requireProof(equal(native.initial,call.arguments[0])&&equal(native.current,native.initial),'ref-initial-value');
        else requireProof(sameState.length>1,'ref-prior-state');
        refAssumptions.push({site:call.site,call:call.id,state:native.state,consumerCallsBefore:call.consumerCallsBefore});
      }
      const effectAssumptions:ContextConsumerEffectAssumption[]=[],effectRuntime=runtime.effectHooks;
      const actualEffects=effectRuntime?.calls.filter(c=>c.render===render.id)??[];
      if(actualEffects.length)requireProof(JSON.stringify(planReactEffectHooks(reference,plan.initializers??[]))===JSON.stringify(plan.effectHooks),'effect-plan-changed');
      for(const call of actualEffects){
        const planned=plan.effectHooks?.find(p=>same(p.call,call.site)),native=effectRuntime!.effects[call.nativeEffect!];
        requireProof(planned&&same(planned.consumer,render.source)&&same(call.consumer,render.source)&&same(planned.callback,call.callback)&&planned.hook===call.hook&&call.completion==='returned'&&call.propertyEffectsVerified&&lookup.effectHookReads?.includes(key(call.site)),'effect-source-call');
        requireProof(call.nativeEffect!==null&&native&&native.id===call.nativeEffect&&native.sourceHook===call.id&&native.render===render.id&&call.callbackOriginVerified&&call.arguments.length===2&&equal(native.create,call.arguments[0])&&native.create.kind==='function'&&equal(native.dependencies,call.arguments[1])&&equal(call.value,literal(undefined)),'effect-native-link');
        const flag=call.hook==='useEffect'?8:call.hook==='useLayoutEffect'?4:2;requireProof((native.tag&~1)===flag,'effect-kind');
        effectAssumptions.push({site:call.site,callback:call.callback,call:call.id,effect:native.id,consumerCallsBefore:call.consumerCallsBefore,refCallsBefore:call.refCallsBefore});
      }
      const literalIdentities=new Map<number,number>(),modeledIdentities=new Map<number,number>();
      const matches=(value:ReactContextValueWitness|undefined,shape:ContextConsumerValueShape,boundary:ReactTargetRenderInputWitness=input):boolean=>{
        if(shape.kind==='record'||shape.kind==='array'){
          const allocation=shape.allocation,records=runtime.consumerLiterals?.records.filter(r=>r.render===render.id&&equal(r.value,value))??[];
          if(!allocation||!Number.isSafeInteger(allocation.id)||allocation.id<=0||records.length!==1)return false;
          const record=records[0],planned=plan.consumerLiterals?.find(p=>same(p.source,allocation.source)&&same(p.consumer,render.source)&&p.kind===shape.kind);
          if(!planned||runtime.consumerLiterals?.records[record.id]!==record||record.kind!==shape.kind||!same(record.source,allocation.source)||!same(record.consumer,render.source)||!record.creationDataVerified||!record.currentValuesVerified||value?.kind!=='object')return false;
          const previous=literalIdentities.get(allocation.id),model=modeledIdentities.get(record.id);
          if(previous!==undefined&&previous!==record.id||model!==undefined&&model!==allocation.id)return false;
          literalIdentities.set(allocation.id,record.id);modeledIdentities.set(record.id,allocation.id);
          const fields=shape.kind==='record'?shape.fields:shape.items.map((v,i)=>[String(i),v] as [string,ContextConsumerValueShape]);
          if(shape.kind==='array'&&record.length!==shape.items.length||fields.length!==record.fields.length||fields.some(([k,v],i)=>record.fields[i][0]!==k||!matches(record.fields[i][1],v,boundary)))return false;
          if(!row.literalValues.some(r=>r.record===record.id))row.literalValues.push({record:record.id,allocation:allocation.id,source:allocation.source,valuesVerified:true,mutationEffectsVerified:false});return true;
        }
        if(shape.kind==='literal')return equal(value,literal(shape.type==='undefined'?undefined:shape.value));
        if(shape.kind==='parameter')return shape.index===1&&equal(value,boundary.refValue);
        if(shape.kind==='input'||shape.kind==='opaque')return equal(value,new Map(boundary.fields).get(shape.kind==='opaque'?'children':shape.key));
        if(shape.kind==='context-field')return equal(value,new Map(c.values.origins.find(o=>o.id===shape.value)?.witnesses??[]).get(shape.key));
        if(shape.kind==='context-value')return value?.kind==='object'&&value.identity===c.values.origins.find(o=>o.id===shape.value)?.identity;
        if(shape.kind==='ref-reference')return refAssumptions.some(a=>a.call===shape.call&&a.state===shape.state)&&equal(value,refRuntime?.calls[shape.call]?.value);
        if(shape.kind==='hook-reference')return hookAssumptions.some(a=>a.invocation===shape.invocation)&&equal(value,runtime.hookHelpers?.invocations[shape.invocation]?.value);
        if(shape.kind==='factory-reference')return factoryAssumptions.some(a=>a.origin===shape.origin&&same(a.source,shape.source))&&equal(value,factoryRuntime?.callbacks[shape.origin]?.value);
        if(shape.kind==='callback-reference')return callbackAssumptions.some(a=>a.origin===shape.origin&&same(a.source,shape.source))&&equal(value,runtime.callbackSources?.callbacks[shape.origin]?.value);
        return false;
      };
      const model=modelReactContextConsumerInput(reference,initializer,input.fields,assumptions,callbackAssumptions,refAssumptions,effectAssumptions,factoryAssumptions,hookAssumptions);
      // A refused body can still provide a bounded, verified prefix. This does
      // not qualify its other effects or the deferred callback/ref lifecycle.
      for(const call of model.callbackCalls??[]){
        const assumed=callbackAssumptions[row.callbackCalls.length],actual=c.consumerCalls.invocations[call.call];
        requireProof(assumed&&actual&&call.call===assumed.call&&same(call.site,assumed.site)&&call.origin===assumed.origin&&same(call.source,assumed.source)&&call.contextCallsBefore===assumed.contextCallsBefore,'callback-model-link');
        requireProof(actual.argumentWitnesses.length===call.arguments.length&&actual.argumentWitnesses.every((v,i)=>matches(v,call.arguments[i])),'callback-argument-provenance');
        row.callbackCalls.push({call:actual.id,sourceInvocation:callbackRoots.get(actual.id)!,selectedCallback:call.origin,argumentsVerified:true,callbackBodyVerified:false});
      }
      for(const call of model.refCalls??[]){
        const assumed=refAssumptions[row.refCalls.length],actual=refRuntime?.calls[call.call];
        requireProof(assumed&&actual&&call.call===assumed.call&&same(call.site,assumed.site)&&call.state===assumed.state&&call.consumerCallsBefore===assumed.consumerCallsBefore,'ref-model-link');
        requireProof(matches(actual.arguments[0],call.argument),'ref-argument-provenance');
        row.refCalls.push({call:call.call,nativeInvocation:actual.nativeInvocation!,state:call.state,argumentVerified:true,mutationEffectsVerified:false});
      }
      for(const call of model.effectCalls??[]){
        const assumed=effectAssumptions[row.effectCalls.length],actual=effectRuntime?.calls[call.call];
        requireProof(assumed&&actual&&call.call===assumed.call&&same(call.site,assumed.site)&&same(call.callback,assumed.callback)&&call.effect===assumed.effect&&call.consumerCallsBefore===assumed.consumerCallsBefore&&call.refCallsBefore===assumed.refCallsBefore,'effect-model-link');
        requireProof(call.dependencies.length===actual.dependencies.length&&actual.dependencies.every((v,i)=>matches(v,call.dependencies[i])),'effect-dependency-provenance');
        row.effectCalls.push({call:call.call,effect:call.effect,dependenciesVerified:true,callbackBodyVerified:false});
      }
      for(const call of model.factoryCalls??[]){
        const assumed=factoryAssumptions[row.factoryCalls.length],actual=c.consumerCalls.invocations[call.call],root=factoryRuntime?.invocations[factoryRoots.get(call.call)!];
        requireProof(assumed&&actual&&root&&call.call===assumed.call&&same(call.site,assumed.site)&&call.origin===assumed.origin&&same(call.source,assumed.source)&&call.consumerCallsBefore===assumed.consumerCallsBefore,'factory-model-link');
        const argumentMatches=(value:ReactContextValueWitness,shape:ContextConsumerValueShape):boolean=>{
          if(shape.kind==='deferred-literal')return factoryRuntime!.literals.some(l=>l.consumerCall===actual.id&&l.kind==='function'&&l.source===key(shape.source)&&equal(l.value,value)&&plan.callbackFactories!.literals.some(p=>p.kind==='function'&&same(p.source,shape.source)&&same(p.call,actual.site)));
          if(shape.kind==='record'){const items=factoryRuntime!.literals.filter(l=>l.consumerCall===actual.id&&l.kind==='object'&&equal(l.value,value));return items.length===1&&!!items[0].fields&&plan.callbackFactories!.literals.some(p=>p.kind==='object'&&key(p.source)===items[0].source&&same(p.call,actual.site))&&items[0].fields.length===shape.fields.length&&items[0].fields.every(([name,v],i)=>name===shape.fields[i][0]&&argumentMatches(v,shape.fields[i][1]));}
          return matches(value,shape);
        };
        requireProof(actual.argumentWitnesses.length===call.arguments.length&&actual.argumentWitnesses.every((v,i)=>argumentMatches(v,call.arguments[i])),'factory-argument-provenance');
        row.factoryCalls.push({call:call.call,invocation:root.id,callback:call.origin,creationBodyVerified:true,callbackBodyVerified:false,capturesVerified:false});
      }
      for(const call of model.hookCalls??[]){
        const assumed=hookAssumptions[row.hookCalls.length],actual=c.consumerCalls.invocations[call.call];
        requireProof(assumed&&actual&&call.call===assumed.call&&same(call.site,assumed.site)&&call.invocation===assumed.invocation&&same(call.source,assumed.source)&&call.consumerCallsBefore===assumed.consumerCallsBefore,'hook-model-link');
        requireProof(actual.argumentWitnesses.length===call.arguments.length&&actual.argumentWitnesses.every((v,i)=>matches(v,call.arguments[i])),'hook-argument-provenance');
        row.hookCalls.push({call:call.call,invocation:call.invocation,bodyVerified:true,stateTransitionsVerified:false,effectBodiesVerified:false});
      }
      if(row.callbackCalls.length)row.remainingRequirements=[...remaining,'callback-body-and-ref-attachment-cleanup','native-hook-dispatcher-and-state-effects'];
      if(row.refCalls.length)row.remainingRequirements=[...row.remainingRequirements,'native-ref-mutation-and-lifecycle'];
      if(row.effectCalls.length)row.remainingRequirements=[...row.remainingRequirements,'effect-callback-binding-cells-body-cleanup-and-scheduling'];
      if(row.hookCalls.length)row.remainingRequirements=[...row.remainingRequirements,'hook-helper-state-transitions-effect-bodies-and-binding-cells'];
      if(row.factoryCalls.length)row.remainingRequirements=[...row.remainingRequirements,'returned-callback-binding-cells-and-event-execution'];
      if(model.status==='refused'&&model.at)row.at=model.at;
      requireProof(model.status==='modeled',model.status==='refused'?model.reason:'model');
      requireProof(row.hookCalls.length===hookAssumptions.length,'hook-model-coverage');
      requireProof(row.factoryCalls.length===factoryAssumptions.length,'factory-model-coverage');
      requireProof(row.effectCalls.length===effectAssumptions.length,'effect-model-coverage');
      requireProof(row.refCalls.length===refAssumptions.length,'ref-model-coverage');
      requireProof(row.callbackCalls.length===callbackAssumptions.length,'callback-model-coverage');
      requireProof(!model.writes.length&&!model.intrinsics.length&&!model.extraArguments.length&&model.targetFactories.length===1,'body-effects-unmodeled');
      requireProof(model.input.kind==='record'&&input.fields.length===model.input.fields.length&&input.fields.every(([name,v],i)=>model.input.kind==='record'&&model.input.fields[i][0]===name&&matches(v,model.input.fields[i][1])),'input-model-mismatch');
      const factories=c.factories.invocations.filter(f=>f.render===render.id);requireProof(factories.length===1,'factory-coverage');const factory=factories[0];
      requireProof(factory.id===render.returnedFactory&&factory.completion==='returned'&&same(factory.consumer,render.source)&&same(factory.site,model.output.source)&&same(factory.site,model.targetFactories[0].source)&&factory.factory===model.targetFactories[0].factory&&equal(factory.value,output.value)&&equal(factory.arguments[0],output.type)&&equal(factory.arguments[1],output.props),'factory-return-link');
      if(model.output.tag.kind==='source-read'){
        const target=c.targetReads.reads[factory.targetRead!],targetPlan=plan.contextTargets?.reads.find(p=>same(p.read,factory.target));
        requireProof(factory.targetRead!==null&&target&&target.id===factory.targetRead&&target.factory===factory.id&&target.render===render.id&&target.propertyEffectsVerified&&same(target.site,factory.target)&&same(target.site,model.output.tag.source)&&equal(target.value,output.type),'target-read-link');
        requireProof(targetPlan&&targetPlan.property===target.property&&targetPlan.origin.module===target.objectSource.file&&plan.contextTargets?.objects.some(p=>same(p,target.objectSource))&&lookup.contextTargets?.reads===plan.contextTargets.reads.length,'target-read-plan');
        requireProof(model.targetReads.length===1&&same(model.targetReads[0].site,factory.site)&&same(model.targetReads[0].read,target.site),'target-read-coverage');
      }else requireProof(model.output.tag.kind==='host'&&equal(output.type,literal(model.output.tag.name))&&!model.targetReads.length&&factory.targetRead===null,'target-unmodeled');
      requireProof(output.fields.length===model.output.props.fields.length&&output.fields.every(([name,v],i)=>name===model.output.props.fields[i][0]&&matches(v,model.output.props.fields[i][1]))&&equal(output.key,literal(model.output.key)),'output-mismatch-or-callback');
      for(const binding of model.runtimeBindings.bindings)for(const site of binding.reads){
        const reads=c.bindings.reads.filter(r=>r.render===render.id&&same(r.binding,binding.binding)&&same(r.site,site));requireProof(reads.length===1&&reads[0].kind==='value','binding-read-coverage');const read=reads[0];
        if(binding.value.kind==='literal')requireProof(matches(read.value,binding.value),'binding-value-mismatch');
        else {requireProof(binding.value.kind==='reference','binding-shape-unmodeled');const node=model.runtimeBindings.nodes[binding.value.id];requireProof(node?.kind==='function'&&same(read.functionSource,node.source)&&read.value.kind==='function','binding-function-mismatch');}
        row.bindingReads.push(read.id);
      }
      requireProof(new Set(row.bindingReads).size===row.bindingReads.length&&row.bindingReads.length===c.bindings.reads.filter(r=>r.render===render.id).length,'binding-extra-read');
      for(const call of model.contextFunctionCalls){
        const calls=actualCalls.filter(i=>same(i.site,call.site));requireProof(calls.length===1,'function-call-coverage');const actual=calls[0],read=c.bindings.reads[actual.calleeRead!];
        requireProof(actual.helperInvocation===null&&actual.completion==='returned'&&actual.calleeRead!==null&&read&&read.calleeOf===actual.id&&same(read.functionSource,call.source)&&read.render===render.id&&equal(read.value,actual.callee)&&row.bindingReads.includes(read.id)&&lookup.contextConsumerCallees?.includes(key(actual.site)),'function-callee-link');
        requireProof(actual.arguments.length===call.arguments.length&&actual.arguments.every((v,i)=>matches(v,call.arguments[i]))&&matches(actual.value,call.output),'function-values');row.functionCalls.push(actual.id);
      }
      requireProof(actualCalls.length===helperCalls.length+row.functionCalls.length+row.callbackCalls.length+row.factoryCalls.length+row.hookCalls.length&&new Set(row.functionCalls).size===row.functionCalls.length&&model.calls.length===row.functionCalls.length+1&&model.calls[0].site===null&&same(model.calls[0].source,render.source)&&model.calls.slice(1).every(m=>model.contextFunctionCalls.some(f=>same(f.source,m.source)&&same(f.site,m.site))),'unmodeled-body-call');
      row.status='verified';row.consumerBodyVerified=true;
    }catch(error){row.reason=error instanceof Error?error.message:'context-consumer-verification-unavailable';}
  }
  return result;
}
