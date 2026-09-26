import type {ReactContextValueWitness} from './react-context-runtime.js';

export interface ReactCallbackRuntimeReport {
  qualification:'native-callback-selection-only';effectsVerified:false;acceptedContract:null;
  states:number;
  invocations:Array<{id:number;sourceHook:number|null;phase:'mount'|'update';render:number|null;consumerCall:number|null;
    previousState:number|null;state:number|null;candidate:ReactContextValueWitness;previous:ReactContextValueWitness|null;
    dependencies:ReactContextValueWitness;previousDependencies:ReactContextValueWitness|null;
    comparison:boolean|null;reused:boolean;completion:'returned'|'threw';selected?:ReactContextValueWitness;
    candidateSource:number|null;selectedSource:number|null;dependencyRest:number|null;
    selectionVerified:boolean;consumerReturnMatched:boolean|null}>;
}

/** Native memo cells and comparison decisions from the pinned renderer. The
 * renderer creates each state tuple; source callbacks and dependency arrays
 * remain opaque. No extra dependency reads, callback calls, or wrapping occur.
 * Selection does not establish dependency purity, callback body, or ref effects. */
export const reactCallbackRuntime=String.raw`((N,intrinsics,fail,scope,witness,origins)=>{
 const states=new N.WeakMapCtor(),allStates=[],frames=[],invocations=[],byConsumer=new Map(),bySourceHook=new Map();let invalid=null;
 const bad=reason=>{invalid??=reason;};
 function record(frame){frame.sourceHook=origins?.hookScope?.()??null;invocations.push(frame);if(frame.sourceHook!==null){const calls=bySourceHook.get(frame.sourceHook)??[];calls.push(frame);bySourceHook.set(frame.sourceHook,calls);}if(frame.consumerCall!==null){const calls=byConsumer.get(frame.consumerCall)??[];calls.push(frame);byConsumer.set(frame.consumerCall,calls);}}
 function state(value){
  intrinsics();if(allStates.length>=100000){bad('callback-state-limit');return value;}
  // This marker receives only the new [callback,deps] literal in the pinned
  // renderer. Its elements are never inspected beyond their raw identities.
  const ds=N.descriptors(value),keys=N.keys(ds);
  if(N.prototype(value)!==Array.prototype||keys.length!==3||keys[0]!=='0'||keys[1]!=='1'||keys[2]!=='length'||!N.descriptor(ds[0],'value')||!N.descriptor(ds[1],'value')||ds.length.value!==2||N.apply(N.mapGet,states,[value])){bad('callback-state-origin');return value;}
  const item={id:allStates.length,value,callback:ds[0].value,deps:ds[1].value,descriptors:ds};allStates.push(item);N.apply(N.mapSet,states,[value,item]);return value;
 }
 function unchanged(item){
  if(!item)return;const ds=N.descriptors(item.value),keys=N.keys(ds);
  if(N.prototype(item.value)!==Array.prototype||keys.length!==3||keys[0]!=='0'||keys[1]!=='1'||keys[2]!=='length')return bad('callback-state-mutated');
  for(const key of keys)for(const field of ['value','get','set','writable','enumerable','configurable'])if(!N.is(ds[key][field],item.descriptors[key][field]))bad('callback-state-mutated');
 }
 function begin(candidate,deps,previous){
  intrinsics();const old=N.apply(N.mapGet,states,[previous]),context=scope();
  if(!old)bad('callback-previous-state-unregistered');
  unchanged(old);
  const frame={id:invocations.length,phase:'update',...context,old,candidate,deps,comparison:null,comparisons:0,reused:false,returned:false,closed:false,selectedState:null,consumerReturnMatched:null};
  if(invocations.length>=100000||frames.length>=256)bad('callback-invocation-limit');
  record(frame);frames.push(frame);return frame;
 }
 function compare(frame,value){
  intrinsics();if(frames[frames.length-1]!==frame||frame.comparisons++!==0||typeof value!=='boolean')bad('callback-comparison-unmatched');
  frame.comparison=value;return value;
 }
 function returned(frame,value,current,reused){
  intrinsics();const item=N.apply(N.mapGet,states,[current]);
  if(frames[frames.length-1]!==frame||frame.returned||!item)bad('callback-return-unmatched');
  const choice=frame.deps!==null&&frame.comparison===true;
  if(reused!==choice||frame.deps===null&&frame.comparisons!==0||frame.deps!==null&&frame.comparisons!==1)bad('callback-selection-decision-mismatch');
  if(reused){if(item!==frame.old||!N.is(value,frame.old?.callback))bad('callback-reused-value-mismatch');}
  else if(!item||item===frame.old||!N.is(item.callback,frame.candidate)||!N.is(item.deps,frame.deps)||!N.is(value,frame.candidate))bad('callback-new-value-mismatch');
  frame.returned=true;frame.value=value;frame.selectedState=item??null;frame.reused=reused;return value;
 }
 function end(frame){if(frames[frames.length-1]!==frame)bad('callback-frame-mismatch');else frames.pop();frame.closed=true;}
 function mount(current,candidate,deps){
  intrinsics();const item=N.apply(N.mapGet,states,[current]);
  if(!item||!N.is(item.callback,candidate)||!N.is(item.deps,deps===undefined?null:deps))bad('callback-mount-state-mismatch');
  if(invocations.length>=100000)bad('callback-invocation-limit');
  record({id:invocations.length,phase:'mount',...scope(),old:null,candidate,deps:deps===undefined?null:deps,comparison:null,comparisons:0,reused:false,returned:true,closed:true,selectedState:item??null,value:candidate,consumerReturnMatched:null});return candidate;
 }
 function consumerReturn(id,value){
  for(const call of byConsumer.get(id)??[])if(call.returned)call.consumerReturnMatched=N.is(call.value,value);
 }
 function sourceReturn(id,args,value){
  const calls=bySourceHook.get(id);if(calls?.length!==1)return null;const call=calls[0];
  return call.closed&&call.returned&&N.is(call.candidate,args[0])&&N.is(call.deps,args[1]===undefined?null:args[1])&&N.is(call.value,value)?call.id:null;
 }
 function report(){
  intrinsics();if(invalid)fail(invalid);if(frames.length||invocations.some(f=>!f.closed))fail('callback-frame-open');
  return {qualification:'native-callback-selection-only',effectsVerified:false,acceptedContract:null,states:allStates.length,
   invocations:invocations.map(f=>({id:f.id,sourceHook:f.sourceHook,phase:f.phase,render:f.render,consumerCall:f.consumerCall,previousState:f.old?.id??null,state:f.selectedState?.id??null,candidate:witness(f.candidate),previous:f.old?witness(f.old.callback):null,dependencies:witness(f.deps),previousDependencies:f.old?witness(f.old.deps):null,comparison:f.comparison,reused:f.reused,completion:f.returned?'returned':'threw',...(f.returned?{selected:witness(f.value)}:{}),candidateSource:origins?.origin(f.candidate)??null,selectedSource:f.returned?origins?.origin(f.value)??null:null,dependencyRest:origins?.rest(f.deps)??null,selectionVerified:f.returned,consumerReturnMatched:f.consumerReturnMatched}))};
 }
 return {state,begin,compare,returned,end,mount,consumerReturn,sourceReturn,report};
})`;
