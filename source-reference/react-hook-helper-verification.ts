import {planReactHookHelpers,type HookAtom} from './react-hook-helpers.js';
import type {ReactHelperReference} from './react-helper-effects.js';
import type {ReactJsxHelperInstrumentationPlan} from './react-helper-instrument.js';
import type {ReactHelperRuntimeReport} from './react-helper-runtime.js';
import type {ReactJsxLookupProof} from './react-jsx-lookup.js';
import type {ReactContextValueWitness as Witness} from './react-context-runtime.js';
import type {HelperSourcePoint} from './react-helper-model.mjs';
export interface ReactHookHelperVerification {
 qualification:'observed-hook-helper-body-only';effectsVerified:false;acceptedContract:null;
 rows:Array<{invocation:number;consumerCall:number|null;render:number|null;status:'verified'|'refused';reason?:string;source:HelperSourcePoint|null;bodyVerified:boolean;nativeStates:number[];nativeEffects:number[];value?:Witness;stateTransitionsVerified:false;effectBodiesVerified:false;capturesVerified:false}>;
}
const key=(p:HelperSourcePoint)=>JSON.stringify([p.file,p.sha256,p.start,p.end]);
function requireProof(value:unknown,reason:string):asserts value {if(!value)throw Error('hook-helper-'+reason);}
function equal(a:Witness|null|undefined,b:Witness|null|undefined){
 if(!a||!b||a.kind!==b.kind||a.representation||b.representation)return false;
 if(['object','function','symbol','bigint'].includes(a.kind))return Number.isSafeInteger(a.identity)&&a.identity!>=0&&a.identity===b.identity;
 return Object.is(a.value,b.value);
}
/** Independently re-read the entire bounded source body and join each original
 * call, argument, native result and return. Observed values cannot fill missing
 * statements, authorize callback bodies or qualify unobserved state behavior. */
export function verifyReactHookHelpers(reference:ReactHelperReference,plan:ReactJsxHelperInstrumentationPlan,runtime:ReactHelperRuntimeReport,lookup:ReactJsxLookupProof):ReactHookHelperVerification {
 const result:ReactHookHelperVerification={qualification:'observed-hook-helper-body-only',effectsVerified:false,acceptedContract:null,rows:[]};
 if(runtime.status!=='observed'||!runtime.hookHelpers)return result;
 const observed=runtime.hookHelpers,contexts=runtime.contexts;
 for(const frame of observed.invocations){
  const source=plan.hookHelpers?.functions.find(f=>key(f.source)===frame.source);
  const row:ReactHookHelperVerification['rows'][number]={invocation:frame.id,consumerCall:frame.consumerCall,render:frame.render,status:'refused',source:source?.source??null,bodyVerified:false,nativeStates:[],nativeEffects:[],stateTransitionsVerified:false,effectBodiesVerified:false,capturesVerified:false};result.rows.push(row);
  try{
   requireProof(JSON.stringify(planReactHookHelpers(reference,plan.contextConsumerCalls??[]))===JSON.stringify(plan.hookHelpers),'plan-changed');
   requireProof(source&&contexts&&lookup.status==='verified'&&frame.consumerCall!==null&&frame.render!==null,'source-scope');
   const actual=contexts.consumerCalls.invocations[frame.consumerCall],render=contexts.renders.invocations.find(r=>r.id===frame.render);
   requireProof(observed.invocations[frame.id]===frame&&observed.invocations.filter(i=>i.consumerCall===frame.consumerCall).length===1,'invocation-coverage');
   requireProof(actual&&actual.id===frame.consumerCall&&actual.render===frame.render&&actual.helperInvocation===null&&actual.calleeRead===null&&actual.completion==='returned'&&render&&render.consumerCalls.indexOf(actual.id)===frame.consumerCallsBefore&&lookup.contextConsumerCallees?.includes(key(actual.site))&&plan.hookHelpers?.consumers.some(c=>key(c.call)===key(actual.site)&&key(c.source)===frame.source),'original-call');
   requireProof(frame.callVerified&&equal(frame.callee,actual.callee)&&frame.bindingsVerified&&frame.completion==='returned'&&frame.arguments&&frame.arguments.length===actual.argumentWitnesses.length&&frame.arguments.every((v,i)=>equal(v,actual.argumentWitnesses[i]))&&frame.bindings.length===source.parameters.length&&frame.bindings.every((v,i)=>equal(v,actual.argumentWitnesses[i]??{kind:'undefined'}))&&equal(frame.value,actual.returnWitness),'entry-return-values');
   requireProof(frame.calls.length===source.hooks.length&&new Set(frame.calls).size===frame.calls.length&&frame.calls.length===observed.calls.filter(c=>c.invocation===frame.id).length,'body-call-coverage');
   const states:Array<[Witness,Witness]>=[];
   const atom=(a:HookAtom):Witness=>{
    if(a.kind==='parameter'){const v=frame.bindings[a.index];requireProof(v,'parameter-unavailable');return v;}
    if(a.kind==='state'){const v=states[a.index]?.[a.part];requireProof(v,'state-binding-unavailable');return v;}
    return a;
   };
   for(const [index,p] of source.hooks.entries()){
    const call=observed.calls[frame.calls[index]];
    requireProof(call&&call.id===frame.calls[index]&&call.invocation===frame.id&&call.source===key(p.call)&&call.kind===p.kind&&(!p.hook||call.hook===p.hook)&&lookup.helperHookReads?.includes(call.source)&&['lexical','native-exports-data','native-interop-getter'].includes(call.lookup)&&call.completion==='returned'&&call.native!==null,'source-hook');
    if(p.kind==='state'){
     const native=runtime.stateHooks?.invocations[call.native!],initial=atom(p.initial!);
     requireProof(call.hook==='useState'&&call.arguments.length<=1&&equal(call.arguments[0]??{kind:'undefined'},initial)&&initial.kind!=='function','state-initial-argument');
     requireProof(native&&native.id===call.native&&native.sourceHook===call.id&&native.render===frame.render&&native.consumerCall===frame.consumerCall&&native.completion==='returned'&&native.tupleVerified&&native.dispatchIdentityVerified&&native.queue!==null&&equal(native.tuple,call.value)&&equal(native.value,call.selected)&&equal(native.dispatch,call.dispatch)&&native.dispatch?.kind==='function'&&runtime.stateHooks!.invocations.filter(n=>n.sourceHook===call.id).length===1,'native-state-link');
     const history=runtime.stateHooks!.invocations.filter(n=>n.queue===native.queue&&n.id<=native.id);
     requireProof(history.length>0&&history[0].phase==='mount'&&history.filter(n=>n.phase==='mount').length===1&&history.every(n=>n.completion==='returned'&&equal(n.dispatch,native.dispatch)),'native-state-history');
     if(native.phase==='mount')requireProof(native.initializationVerified&&native.initializerReturns.length===0&&equal(native.initialArgument,initial)&&equal(native.value,initial),'native-state-initialization');
     states.push([native.value!,native.dispatch!]);row.nativeStates.push(native.id);
    }else{
     const native=runtime.effectHooks?.effects[call.native!],flag=call.hook==='useEffect'?8:call.hook==='useLayoutEffect'?4:call.hook==='useInsertionEffect'?2:0;
     requireProof(native&&native.id===call.native&&native.helperHook===call.id&&native.sourceHook===null&&native.render===frame.render&&flag&&(native.tag&~1)===flag&&runtime.effectHooks!.effects.filter(n=>n.helperHook===call.id).length===1,'native-effect-link');
     requireProof(call.callbackOriginVerified&&call.arguments.length===2&&call.arguments[0].kind==='function'&&equal(native.create,call.arguments[0])&&equal(native.dependencies,call.arguments[1])&&call.arguments[1].kind==='object'&&equal(call.value,{kind:'undefined'}),'effect-values');
     requireProof(call.dependencies&&p.values&&call.dependencies.length===p.values.length&&p.values.every((a,i)=>equal(atom(a),call.dependencies![i])),'effect-dependencies');
     row.nativeEffects.push(native.id);
    }
   }
   requireProof(equal(atom(source.result),frame.value),'return-value');
   row.status='verified';row.bodyVerified=true;row.value=frame.value;
  }catch(error){row.reason=error instanceof Error?error.message:'hook-helper-verification-unavailable';}
 }
 return result;
}
