import type {ReactContextValueWitness} from './react-context-runtime.js';
import type {HelperSourcePoint} from './react-helper-model.mjs';
export interface ReactEffectRuntimeReport {
 qualification:'native-effect-registration-and-execution-only';effectsVerified:false;acceptedContract:null;instances:number;
 effects:Array<{id:number;sourceHook:number|null;helperHook:number|null;render:number|null;instance:number;tag:number;create:ReactContextValueWitness;dependencies:ReactContextValueWitness}>;
 executions:Array<{id:number;kind:'create'|'cleanup';effect:number;creation:number|null;completion:'returned'|'threw';value?:ReactContextValueWitness;error?:ReactContextValueWitness;bodyVerified:false}>;
 calls:Array<{id:number;site:HelperSourcePoint;consumer:HelperSourcePoint;callback:HelperSourcePoint;hook:string;render:number;consumerCallsBefore:number;refCallsBefore:number;kind:string;propertyEffectsVerified:true;arguments:ReactContextValueWitness[];dependencies:ReactContextValueWitness[];completion:'returned'|'threw';nativeEffect:number|null;callbackOriginVerified:boolean;value?:ReactContextValueWitness}>;
}
/** Native queue records and actual create/cleanup calls retain original function
 * identities and exception handling. Neither recording nor executing a callback
 * qualifies its body, captured binding cells, dependency purity or recovery. */
export const reactEffectRuntime=String.raw`((plans,N,intrinsics,sameDescriptor,fail,scope,witness,nativeHooks,helperScope=()=>null)=>{
 const point=p=>JSON.stringify([p.file,p.sha256,p.start,p.end]);
 const sites=plans.map(p=>({...p,key:point(p.call),consumerKey:point(p.consumer)}));
 const tokens=new N.WeakMapCtor(),effects=new N.WeakMapCtor(),instances=new N.WeakMapCtor(),items=[],insts=[],runs=[],active=[],pending=[],calls=[],frames=[];let invalid=null;
 const bad=reason=>{invalid??=reason;};
 function data(value,keys){const ds=N.descriptors(value),actual=N.keys(ds);if(N.prototype(value)!==Object.prototype||actual.length!==keys.length||actual.some((k,i)=>k!==keys[i]||!N.descriptor(ds[k],'value'))){bad('effect-native-data-shape');return null;}return ds;}
 function record(value){
  intrinsics();if(items.length>=100000){bad('effect-record-limit');return value;}
  const ds=data(value,['tag','create','deps','inst','next']);if(!ds)return value;
  if(N.apply(N.mapGet,effects,[value])||!Number.isSafeInteger(ds.tag.value)||ds.next.value!==null){bad('effect-record-origin');return value;}
  const instanceValue=ds.inst.value;let instance=N.apply(N.mapGet,instances,[instanceValue]);
  if(!instance){const d=data(instanceValue,['destroy']);if(!d||d.destroy.value!==undefined){bad('effect-instance-origin');return value;}instance={id:insts.length,value:instanceValue,latest:null};insts.push(instance);N.apply(N.mapSet,instances,[instanceValue,instance]);}
  const frame=frames[frames.length-1],item={id:items.length,value,descriptors:ds,instance,sourceHook:frame?.id??null,helperHook:helperScope(),render:scope().render,tag:ds.tag.value,create:ds.create.value,deps:ds.deps.value};items.push(item);N.apply(N.mapSet,effects,[value,item]);if(frame)frame.native.push(item);return value;
 }
 function unchanged(item){
  if(!item)return;const ds=data(item.value,['tag','create','deps','inst','next']);if(!ds)return;
  for(const k of ['tag','create','deps','inst'])if(!sameDescriptor(ds[k],item.descriptors[k]))bad('effect-record-mutated');
  if(ds.next.value!==null&&!N.apply(N.mapGet,effects,[ds.next.value]))bad('effect-next-unregistered');
  data(item.instance.value,['destroy']);
 }
 function run(kind,item,creation){
  if(runs.length>=100000||active.length>=256)bad('effect-execution-limit');
  const frame={id:runs.length,kind,item,creation,closed:false,completion:null};runs.push(frame);return frame;
 }
 function createBegin(value){
  intrinsics();const item=N.apply(N.mapGet,effects,[value]);if(!item)bad('effect-create-unregistered');unchanged(item);
  const frame=run('create',item,null);active.push(frame);return frame;
 }
 function returned(frame,value){
  intrinsics();if(active[active.length-1]!==frame||frame.completion!==null)bad('effect-return-unmatched');
  frame.completion='returned';frame.value=value;if(frame.kind==='create'&&frame.item)frame.item.instance.latest=frame;return value;
 }
 function thrown(frame,error){if(active[active.length-1]!==frame)bad('effect-throw-unmatched');frame.completion='threw';frame.error=error;}
 function end(frame){if(active[active.length-1]!==frame||!frame.completion)bad('effect-end-unmatched');else active.pop();frame.closed=true;}
 function cleanupValue(value,instanceValue,destroy){
  intrinsics();const item=N.apply(N.mapGet,effects,[value]);if(!item||!N.is(item.instance.value,instanceValue))bad('effect-cleanup-unregistered');unchanged(item);
  const creation=item?.instance.latest;
  if(!creation||creation.completion!=='returned'||!N.is(creation.value,destroy))bad('effect-cleanup-origin');
  const frame=run('cleanup',item,creation??null);frame.destroy=destroy;pending.push(frame);return destroy;
 }
 function cleanupBegin(destroy){
  intrinsics();const frame=pending.pop();if(!frame||!N.is(frame.destroy,destroy)){bad('effect-cleanup-call-unmatched');const invalidFrame=run('cleanup',null,null);active.push(invalidFrame);return invalidFrame;}
  active.push(frame);return frame;
 }
 function site(key){const s=sites.find(p=>p.key===key);if(!s)fail('effect-hook-unplanned');return s;}
 function token(key,lookup,receiver){
  const p=site(key),context=scope();if(context.render===null||context.renderSource!==p.consumerKey)fail('effect-hook-scope');
  if(calls.length>=100000)fail('effect-source-call-limit');
  const handle={},frame={id:calls.length,site:p,render:context.render,consumerCallsBefore:context.consumerCalls,refCallsBefore:context.refCalls,lookup,receiver,used:false,args:[],native:[],returned:false,callback:null,dependency:null};calls.push(frame);N.apply(N.mapSet,tokens,[handle,frame]);return handle;
 }
 function hookValue(key,fn){intrinsics();return token(key,nativeHooks.nativeHookValue(site(key).hook,fn),undefined);}
 function hookRead(key,value,receiver){intrinsics();return token(key,nativeHooks.nativeHookRead(site(key).hook,value),receiver?value:undefined);}
 function hookDefault(key,value){return hookRead(key,nativeHooks.nativeDefault(value),true);}
 function literal(key,value){
  intrinsics();const frame=frames[frames.length-1];if(!frame||frame.site.key!==key||frame.callback!==null||typeof value!=='function')fail('effect-callback-origin');frame.callback={value};return value;
 }
 function dependencies(key,value){
  intrinsics();const frame=frames[frames.length-1];if(!frame||frame.site.key!==key||frame.dependency!==null)fail('effect-dependency-origin');
  const ds=N.descriptors(value),keys=N.keys(ds),length=ds.length?.value;
  if(N.prototype(value)!==Array.prototype||!Number.isSafeInteger(length)||length<0||length>10000||keys.length!==length+1||keys[length]!=='length')fail('effect-dependency-shape');
  const values=[];for(let i=0;i<length;i++){const d=ds[i];if(keys[i]!==String(i)||!d||!N.descriptor(d,'value'))fail('effect-dependency-shape');values.push(d.value);}
  frame.dependency={value,values,descriptors:ds,keys};return value;
 }
 function depsUnchanged(frame){const d=frame.dependency;if(!d)return bad('effect-dependency-missing');const ds=N.descriptors(d.value),keys=N.keys(ds);if(N.prototype(d.value)!==Array.prototype||keys.length!==d.keys.length||keys.some((k,i)=>k!==d.keys[i]||!sameDescriptor(ds[k],d.descriptors[k])))bad('effect-dependency-mutated');}
 function hookCall(key,handle,argsThunk){
  intrinsics();const frame=N.apply(N.mapGet,tokens,[handle]);if(!frame||frame.used||frame.site.key!==key||typeof argsThunk!=='function'||scope().render!==frame.render)fail('effect-hook-token');
  frame.used=true;frames.push(frame);
  try{
   const args=N.apply(argsThunk,undefined,[]);if(!Array.isArray(args)||args.length!==2||!frame.callback||!frame.dependency||!N.is(args[0],frame.callback.value)||!N.is(args[1],frame.dependency.value))fail('effect-hook-arguments');frame.args=args;
   const value=N.apply(frame.lookup.fn,frame.receiver,args);frame.value=value;frame.returned=true;depsUnchanged(frame);
   const native=frame.native[0],flag=frame.site.hook==='useEffect'?8:frame.site.hook==='useLayoutEffect'?4:2;
   if(frame.native.length!==1||!N.is(native.create,args[0])||!N.is(native.deps,args[1])||native.render!==frame.render||(native.tag&~1)!==flag||value!==undefined)bad('effect-hook-native-link');
   return value;
  }finally{if(frames[frames.length-1]!==frame)bad('effect-hook-frame');else frames.pop();}
 }
 function report(){
  intrinsics();for(const c of calls)if(c.returned)depsUnchanged(c);if(invalid)fail(invalid);if(frames.length||active.length||pending.length||runs.some(r=>!r.closed)||calls.some(c=>!c.used))fail('effect-frame-open');
  return {qualification:'native-effect-registration-and-execution-only',effectsVerified:false,acceptedContract:null,instances:insts.length,
   effects:items.map(i=>({id:i.id,sourceHook:i.sourceHook,helperHook:i.helperHook,render:i.render,instance:i.instance.id,tag:i.tag,create:witness(i.create),dependencies:witness(i.deps)})),
   executions:runs.map(r=>({id:r.id,kind:r.kind,effect:r.item.id,creation:r.creation?.id??null,completion:r.completion,...(r.completion==='returned'?{value:witness(r.value)}:{error:witness(r.error)}),bodyVerified:false})),
   calls:calls.map(c=>({id:c.id,site:c.site.call,consumer:c.site.consumer,callback:c.site.callback,hook:c.site.hook,render:c.render,consumerCallsBefore:c.consumerCallsBefore,refCallsBefore:c.refCallsBefore,kind:c.lookup.kind,propertyEffectsVerified:true,arguments:c.args.map(witness),dependencies:c.dependency?.values.map(witness)??[],completion:c.returned?'returned':'threw',nativeEffect:c.returned&&c.native.length===1?c.native[0].id:null,callbackOriginVerified:!!c.callback,...(c.returned?{value:witness(c.value)}:{})}))};
 }
 function sourceReturn(id,args,value,hook){
  intrinsics();const matches=items.filter(i=>i.helperHook===id),item=matches[0],flag=hook==='useEffect'?8:hook==='useLayoutEffect'?4:hook==='useInsertionEffect'?2:0;
  if(matches.length!==1||item.create!==args[0]||item.deps!==args[1]||!flag||(item.tag&~1)!==flag||value!==undefined||invalid)fail('effect-helper-native-link');
  return item.id;
 }
 return {sourceReturn,record,createBegin,cleanupValue,cleanupBegin,returned,thrown,end,hookValue,hookRead,hookDefault,hookCall,literal,dependencies,report};
})`;
