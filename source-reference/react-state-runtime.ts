import type {ReactContextValueWitness} from './react-context-runtime.js';
export interface ReactStateRuntimeReport {
 qualification:'native-state-tuples-only';effectsVerified:false;acceptedContract:null;queues:number;
 invocations:Array<{id:number;phase:'mount'|'update'|'rerender';render:number|null;consumerCall:number|null;sourceHook:number|null;queue:number|null;
  initialArgument:ReactContextValueWitness|null;initializerReturns:ReactContextValueWitness[];
  completion:'returned'|'threw';tuple?:ReactContextValueWitness;value?:ReactContextValueWitness;dispatch?:ReactContextValueWitness;thrown?:ReactContextValueWitness;
  tupleVerified:boolean;initializationVerified:boolean;dispatchIdentityVerified:boolean;updateSemanticsVerified:false}>;
}
/** Observe fresh renderer-owned queues and tuples. Values, lazy initializers and
 * dispatch functions remain original and opaque. This does not model scheduling,
 * updater bodies, skipped/replayed updates or arbitrary state transitions. */
export const reactStateRuntime=String.raw`((N,intrinsics,fail,scope,witness,sourceScope=()=>null)=>{
 const queues=new N.WeakMapCtor(),records=[],frames=[],invocations=[];let invalid=null;
 const bad=why=>{invalid??=why;};
 const queueKeys=['pending','lanes','dispatch','lastRenderedReducer','lastRenderedState'];
 function queueShape(value){
  const ds=N.descriptors(value),keys=N.keys(ds);
  if(N.prototype(value)!==Object.prototype||keys.length!==queueKeys.length||keys.some((k,i)=>k!==queueKeys[i]||!N.descriptor(ds[k],'value')||!ds[k].writable||!ds[k].enumerable||!ds[k].configurable)){bad('state-queue-shape');return null;}
  return ds;
 }
 function begin(phase,initial){
  intrinsics();if(!['mount','update','rerender'].includes(phase))bad('state-phase');
  if(invocations.length>=100000||frames.length>=256)bad('state-invocation-limit');
  const f={id:invocations.length,phase,...scope(),sourceHook:sourceScope(),initial,initializerReturns:[],queue:null,tuple:null,returned:false,thrown:false,closed:false,initializationVerified:false};
  invocations.push(f);frames.push(f);return f;
 }
 function initialized(fn,value,index){
  intrinsics();const f=frames[frames.length-1];if(!f)return value;
  if(f.phase!=='mount'||fn!==f.initial||typeof fn!=='function'||index!==f.initializerReturns.length||index>1)bad('state-initializer-unmatched');
  f.initializerReturns.push(value);return value;
 }
 function queue(value,initial,reducer){
  intrinsics();if(records.length>=100000){bad('state-queue-limit');return value;}
  // This receives only the original fresh literal in mountStateImpl.
  const ds=queueShape(value),f=frames[frames.length-1];
  if(!ds||ds.pending.value!==null||ds.lanes.value!==0||ds.dispatch.value!==null||ds.lastRenderedReducer.value!==reducer||!N.is(ds.lastRenderedState.value,initial)||typeof reducer!=='function'||N.apply(N.mapGet,queues,[value])){bad('state-queue-origin');return value;}
  const q={id:records.length,value,initial,reducer,dispatch:null,frame:f??null,mounted:false};records.push(q);N.apply(N.mapSet,queues,[value,q]);
  if(f){
   if(f.phase!=='mount'||f.queue!==null)bad('state-initial-queue');f.queue=q;
   if(typeof f.initial==='function')f.initializationVerified=f.initializerReturns.length>=1&&N.is(initial,f.initializerReturns[0]);
   else f.initializationVerified=f.initializerReturns.length===0&&N.is(initial,f.initial);
   if(!f.initializationVerified)bad('state-initial-value');
  }
  return value;
 }
 function tuple(phase,queueValue,value,reducer){
  intrinsics();const f=frames[frames.length-1];if(!f)return value;
  const q=N.apply(N.mapGet,queues,[queueValue]);
  // Unknown identities refuse before descriptor/prototype reads.
  if(!q||f.phase!==phase||f.tuple!==null||reducer!==q.reducer){bad('state-tuple-unmatched');return value;}
  const ds=queueShape(q.value);if(!ds)return value;
  const tupleDs=N.descriptors(value),keys=N.keys(tupleDs);
  if(N.prototype(value)!==Array.prototype||keys.length!==3||keys[0]!=='0'||keys[1]!=='1'||keys[2]!=='length'||!N.descriptor(tupleDs[0],'value')||!N.descriptor(tupleDs[1],'value')||tupleDs.length.value!==2){bad('state-tuple-shape');return value;}
  const selected=tupleDs[0].value,dispatch=tupleDs[1].value;
  if(typeof dispatch!=='function'||dispatch!==ds.dispatch.value||ds.lastRenderedReducer.value!==reducer)bad('state-dispatch-value');
  if(phase==='mount'){
   if(q.frame!==f||q.mounted||f.queue!==q||q.dispatch!==null||!N.is(selected,q.initial))bad('state-mount-tuple');
   q.dispatch=dispatch;q.mounted=true;
  }else if(!q.mounted||q.dispatch!==dispatch)bad('state-update-dispatch');
  f.queue=q;f.tuple=value;f.selected=selected;f.dispatch=dispatch;return value;
 }
 function returned(f,value){
  intrinsics();if(frames[frames.length-1]!==f||f.returned||f.thrown||!f.tuple||f.tuple!==value||!f.queue?.mounted)bad('state-return-unmatched');
  f.returned=true;return value;
 }
 function thrown(f,error){if(frames[frames.length-1]!==f||f.returned||f.thrown)bad('state-throw-unmatched');f.thrown=true;f.error=error;}
 function end(f){if(frames[frames.length-1]!==f)bad('state-frame-unmatched');else frames.pop();f.closed=true;}
 function report(){
  intrinsics();if(invalid)fail(invalid);if(frames.length||invocations.some(f=>!f.closed||!f.returned&&!f.thrown))fail('state-frame-open');
  return {qualification:'native-state-tuples-only',effectsVerified:false,acceptedContract:null,queues:records.length,
   invocations:invocations.map(f=>({id:f.id,phase:f.phase,render:f.render,consumerCall:f.consumerCall,sourceHook:f.sourceHook,queue:f.queue?.id??null,initialArgument:f.phase==='mount'?witness(f.initial):null,initializerReturns:f.initializerReturns.map(witness),completion:f.returned?'returned':'threw',...(f.returned?{tuple:witness(f.tuple),value:witness(f.selected),dispatch:witness(f.dispatch)}:{thrown:witness(f.error)}),tupleVerified:f.returned,initializationVerified:f.phase==='mount'&&f.initializationVerified,dispatchIdentityVerified:f.returned,updateSemanticsVerified:false}))};
 }
 function sourceReturn(id,value){
  intrinsics();const matches=invocations.filter(f=>f.sourceHook===id),f=matches[0];
  if(matches.length!==1||!f.closed||!f.returned||f.tuple!==value||invalid)fail('state-source-native-link');
  return {id:f.id,value:f.selected,dispatch:f.dispatch};
 }
 return {begin,initialized,queue,tuple,returned,thrown,end,report,sourceReturn};
})`;
