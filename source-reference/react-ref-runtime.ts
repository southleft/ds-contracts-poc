import type {ReactContextValueWitness} from './react-context-runtime.js';
import type {HelperSourcePoint} from './react-helper-model.mjs';
export interface ReactRefRuntimeReport {
 qualification:'native-ref-state-and-source-call-only';effectsVerified:false;acceptedContract:null;states:number;
 invocations:Array<{id:number;sourceHook:number|null;render:number|null;phase:'mount'|'update';state:number;value:ReactContextValueWitness;initial:ReactContextValueWitness;current:ReactContextValueWitness;stateVerified:true}>;
 calls:Array<{id:number;site:HelperSourcePoint;consumer:HelperSourcePoint;render:number;consumerCallsBefore:number;kind:string;propertyEffectsVerified:true;arguments:ReactContextValueWitness[];completion:'returned'|'threw';nativeInvocation:number|null;value?:ReactContextValueWitness}>;
}
/** Only the pinned native object literal registers a ref. Updates look it up
 * before reflecting it; current values stay opaque. Snapshots describe each
 * native call, not later ref writes, dispatcher effects or lifecycle behavior. */
export const reactRefRuntime=String.raw`((plans,N,intrinsics,fail,scope,witness,nativeHooks)=>{
 const point=p=>JSON.stringify([p.file,p.sha256,p.start,p.end]);
 const sites=plans.map(p=>({...p,key:point(p.call),consumerKey:point(p.consumer)})),tokens=new N.WeakMapCtor(),states=new N.WeakMapCtor(),records=[],invocations=[],calls=[],frames=[];let invalid=null;
 const bad=reason=>{invalid??=reason;};
 function snapshot(value){
  const ds=N.descriptors(value),keys=N.keys(ds),d=ds.current;
  if(N.prototype(value)!==Object.prototype||keys.length!==1||keys[0]!=='current'||!d||!N.descriptor(d,'value')){bad('ref-state-shape');return {current:undefined};}
  return {current:d.value};
 }
 function state(value){
  intrinsics();if(records.length>=100000){bad('ref-state-limit');return value;}
  // This marker is installed only around the native {current: initialValue}.
  const snap=snapshot(value);if(N.apply(N.mapGet,states,[value]))bad('ref-state-duplicate');
  const item={id:records.length,value,initial:snap.current};records.push(item);N.apply(N.mapSet,states,[value,item]);return value;
 }
 function returned(value,phase){
  intrinsics();const item=N.apply(N.mapGet,states,[value]);if(!item){bad('ref-state-unregistered');return value;}
  if(invocations.length>=100000){bad('ref-invocation-limit');return value;}
  const snap=snapshot(value),context=scope(),frame=frames[frames.length-1];
  if(phase==='mount'&&item.mounted)bad('ref-mount-repeated');if(phase==='update'&&!item.mounted)bad('ref-update-before-mount');
  if(phase==='mount')item.mounted=true;
  const row={id:invocations.length,sourceHook:frame?.id??null,render:context.render,phase,item,current:snap.current};invocations.push(row);if(frame)frame.native.push(row);
  return value;
 }
 function token(key,lookup,receiver){
  const site=sites.find(p=>p.key===key),context=scope();if(!site||context.render===null||context.renderSource!==site.consumerKey)fail('ref-hook-scope');
  if(calls.length>=100000)fail('ref-source-call-limit');
  const handle={},row={id:calls.length,site,render:context.render,consumerCallsBefore:context.consumerCalls,lookup,receiver,used:false,args:[],native:[],returned:false};calls.push(row);N.apply(N.mapSet,tokens,[handle,row]);return handle;
 }
 function hookValue(key,fn){intrinsics();return token(key,nativeHooks.nativeHookValue('useRef',fn),undefined);}
 function hookRead(key,value,receiver){intrinsics();return token(key,nativeHooks.nativeHookRead('useRef',value),receiver?value:undefined);}
 function hookDefault(key,value){const native=nativeHooks.nativeDefault(value);return hookRead(key,native,true);}
 function hookCall(key,handle,argsThunk){
  intrinsics();const frame=N.apply(N.mapGet,tokens,[handle]);if(!frame||frame.used||frame.site.key!==key||typeof argsThunk!=='function'||scope().render!==frame.render)fail('ref-hook-token');
  frame.used=true;frames.push(frame);
  try{
   const args=N.apply(argsThunk,undefined,[]);if(!Array.isArray(args)||args.length!==1)fail('ref-hook-arguments');frame.args=args;
   const value=N.apply(frame.lookup.fn,frame.receiver,args);frame.value=value;frame.returned=true;
   if(frame.native.length!==1||!N.is(frame.native[0].item.value,value)||frame.native[0].render!==frame.render)bad('ref-hook-native-link');
   else if(frame.native[0].phase==='mount'&&!N.is(frame.native[0].item.initial,args[0]))bad('ref-hook-initial-value');
   return value;
  }finally{if(frames[frames.length-1]!==frame)bad('ref-hook-frame');else frames.pop();}
 }
 function report(){
  intrinsics();if(invalid)fail(invalid);if(frames.length||calls.some(c=>!c.used))fail('ref-hook-open');
  return {qualification:'native-ref-state-and-source-call-only',effectsVerified:false,acceptedContract:null,states:records.length,
   invocations:invocations.map(i=>({id:i.id,sourceHook:i.sourceHook,render:i.render,phase:i.phase,state:i.item.id,value:witness(i.item.value),initial:witness(i.item.initial),current:witness(i.current),stateVerified:true})),
   calls:calls.map(c=>({id:c.id,site:c.site.call,consumer:c.site.consumer,render:c.render,consumerCallsBefore:c.consumerCallsBefore,kind:c.lookup.kind,propertyEffectsVerified:true,arguments:c.args.map(witness),completion:c.returned?'returned':'threw',nativeInvocation:c.returned&&c.native.length===1?c.native[0].id:null,...(c.returned?{value:witness(c.value)}:{})}))};
 }
 return {count:render=>calls.filter(c=>c.render===render).length,state,mount:value=>returned(value,'mount'),update:value=>returned(value,'update'),hookValue,hookRead,hookDefault,hookCall,report};
})`;
