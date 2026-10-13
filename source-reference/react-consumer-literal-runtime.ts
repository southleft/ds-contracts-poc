import type {HelperSourcePoint} from './react-helper-model.mjs';
import type {ReactContextValueWitness as Witness} from './react-context-runtime.js';
export interface ConsumerLiteralSnapshot {record:number;fields:Array<[string,Witness]>;length?:number;dataVerified:boolean}
export interface ConsumerLiteralCall {id:number;render:number;site:string;source:string;entry:number;exit?:number;callee:Witness;arguments:Witness[];result?:Witness;before:ConsumerLiteralSnapshot[];after:ConsumerLiteralSnapshot[];returned:boolean}
export interface ConsumerFunctionOrigin {id:number;render:number;source:string;value:Witness;ownerCall:number;sequence:number}
export interface ConsumerLiteralMutation {render:number;sequence:number;site:string;record:number;operation:'set'|'delete'|'assign';key?:string;value?:Witness;before:ConsumerLiteralSnapshot[];after:ConsumerLiteralSnapshot[];arguments?:Witness[];inputs?:ConsumerLiteralSnapshot[];inputValues?:Witness[];inputSnapshots?:ConsumerLiteralSnapshot[]}
export interface ReactConsumerLiteralReport {
 qualification:'original-render-literal-values-only';effectsVerified:false;acceptedContract:null;
 calls?:ConsumerLiteralCall[];mutations?:ConsumerLiteralMutation[];functions?:ConsumerFunctionOrigin[];
 records:Array<{id:number;source:HelperSourcePoint;consumer:HelperSourcePoint;render:number;kind:'record'|'array';value:Witness;creationDataVerified:boolean;currentValuesVerified:boolean;fields:Array<[string,Witness]>;length?:number;current?:ConsumerLiteralSnapshot}>;
}
/** Reflect only compiler-marked fresh literals, one level at a time. Nested
 * values are opaque identities until their own allocation is independently
 * joined. Frozen data descriptors keep value authority, never write authority. */
export const reactConsumerLiteralRuntime=String.raw`((plans,N,intrinsics,fail,scope,witness)=>{
 const point=p=>JSON.stringify([p.file,p.sha256,p.start,p.end]),sites=plans.map(p=>({...p,key:point(p.source),owner:point(p.consumer)})),records=[],known=new N.WeakMapCtor(),calls=[],mutations=[],functions=[],callStack=[],sequences=new Map();
 function shape(value,kind){
  const ds=N.descriptors(value),keys=N.keys(ds);
  if(N.prototype(value)!==(kind==='record'?Object.prototype:Array.prototype)||keys.some(k=>typeof k!=='string'||!N.descriptor(ds[k],'value')))return null;
  if(kind==='array'){
   const length=ds.length?.value;if(!Number.isSafeInteger(length)||length<0||length>10000||keys.length!==length+1||keys[length]!=='length'||keys.slice(0,length).some((k,i)=>k!==String(i)||!ds[k].enumerable))return null;
  }else if(keys.some(k=>!ds[k].enumerable))return null;
  return {ds,keys};
 }
 function valid(data,kind){return !!data&&data.keys.every(k=>k==='length'&&kind==='array'?data.ds[k].writable&&!data.ds[k].enumerable&&!data.ds[k].configurable:data.ds[k].writable&&data.ds[k].configurable);}
 function next(count=1){const render=scope().render;if(render===null)fail('consumer-literal-operation-scope');const n=sequences.get(render)||0;sequences.set(render,n+count);return n;}
 function attach(origin){
  const render=scope();if(render.render===null)fail('consumer-literal-operation-scope');
  const plan=origin.plans.find(p=>p.owner===render.renderSource);if(!plan)fail('consumer-literal-owner');
  let record=origin.records.get(render.render);if(record)return record;
  if(records.length>=100000)fail('consumer-literal-budget');
  record={id:records.length,plan,render:render.render,value:origin.value,data:origin.data};records.push(record);origin.records.set(render.render,record);return record;
 }
 function capture(key,value){
  intrinsics();const plans=sites.filter(s=>s.key===key),render=scope();
  if(!plans.length||render.render===null&&!plans.some(p=>p.synchronous)||render.render!==null&&!plans.some(p=>p.owner===render.renderSource))fail('consumer-literal-scope');
  if(N.apply(N.mapGet,known,[value]))fail('consumer-literal-origin');
  const origin={plans,value,data:shape(value,plans[0].kind),records:new Map()};N.apply(N.mapSet,known,[value,origin]);
  if(render.render!==null)attach(origin);return value;
 }
 function snapshot(value,seen,out){
  const origin=N.apply(N.mapGet,known,[value]);if(!origin||seen.has(value))return;
  seen.add(value);const record=attach(origin),data=shape(value,record.plan.kind);
  const verified=valid(data,record.plan.kind);
  const result={record:record.id,dataVerified:verified,fields:data?data.keys.filter(k=>record.plan.kind!=='array'||k!=='length').map(k=>[k,witness(data.ds[k].value)]):[],...(data&&record.plan.kind==='array'?{length:data.ds.length.value}:{})};out.push(result);
  if(data)for(const k of data.keys)if(k!=='length'||record.plan.kind!=='array')snapshot(data.ds[k].value,seen,out);
 }
 function snapshots(values){const out=[],seen=new Set();for(const value of values)snapshot(value,seen,out);return out;}
 function beginCall(site,source,args,fn){intrinsics();if(calls.length>=100000)fail('consumer-literal-budget');const row={id:calls.length,render:scope().render,site,source,entry:next(),callee:witness(fn),arguments:args.map(witness),before:snapshots(args),after:[],returned:false};calls.push(row);callStack.push(row);return row;}
 function endCall(row,value,args){intrinsics();if(callStack[callStack.length-1]!==row)fail('consumer-literal-call-owner');row.exit=next();row.result=witness(value);row.after=snapshots([...args,value]);row.returned=true;callStack.pop();}
 function sourceFunction(source,fn){
  intrinsics();const owner=callStack[callStack.length-1];if(!owner)return;
  if(functions.length>=100000||owner.render!==scope().render)fail('consumer-literal-function-owner');
  functions.push({id:functions.length,render:owner.render,source,value:witness(fn),ownerCall:owner.id,sequence:next()});
 }
 function write(site,target,key,value,invoke,remove=false){
  intrinsics();if(typeof key!=='string'&&typeof key!=='number')fail('consumer-literal-write-key');key=String(key);
  if(key==='__proto__'||key==='prototype')fail('consumer-literal-write-key');
  const origin=N.apply(N.mapGet,known,[target]);if(!origin)fail('consumer-literal-write-origin');
  const before=snapshots([target]);if(!before[0]?.dataVerified)fail('consumer-literal-write-descriptor');
  const sequence=next(),result=invoke(target,key,value),after=snapshots([target]);
  mutations.push({render:scope().render,sequence,site,record:before[0].record,operation:remove?'delete':'set',key,...(remove?{}:{value:witness(value)}),before,after});return result;
 }
 function assign(site,fn,args){
  intrinsics();if(fn!==Object.assign||!args.length||!N.apply(N.mapGet,known,[args[0]]))fail('consumer-literal-assign-origin');
  const before=snapshots([args[0]]),inputs=[],inputValues=[],inputObjects=[];let count=0;
  if(!before[0]?.dataVerified)fail('consumer-literal-assign-descriptor');
  for(const value of args.slice(1)){if(value==null)continue;if(value===args[0]||inputObjects.includes(value))fail('consumer-literal-assign-alias');inputObjects.push(value);inputValues.push(witness(value));const origin=N.apply(N.mapGet,known,[value]);if(!origin)fail('consumer-literal-assign-input');const data=snapshots([value])[0];if(!data?.dataVerified)fail('consumer-literal-assign-descriptor');inputs.push(data);count+=data.fields.length;}
  const inputSnapshots=snapshots(inputObjects);if(inputSnapshots.some(s=>s.record===before[0].record))fail('consumer-literal-assign-alias');if(!count)fail('consumer-literal-assign-empty');const sequence=next(count),result=N.apply(fn,undefined,args),after=snapshots([args[0]]);
  mutations.push({render:scope().render,sequence,site,record:before[0].record,operation:'assign',before,after,arguments:args.map(witness),inputs,inputValues,inputSnapshots});return result;
 }
 function current(record){const data=shape(record.value,record.plan.kind);return {record:record.id,dataVerified:valid(data,record.plan.kind),fields:data?data.keys.filter(k=>record.plan.kind!=='array'||k!=='length').map(k=>[k,witness(data.ds[k].value)]):[],...(data&&record.plan.kind==='array'?{length:data.ds.length.value}:{})};}
 function stable(record){
  if(!record.data)return false;const now=shape(record.value,record.plan.kind);if(!now||now.keys.length!==record.data.keys.length)return false;
  return now.keys.every((k,i)=>k===record.data.keys[i]&&N.is(now.ds[k].value,record.data.ds[k].value));
 }
 function report(){
  intrinsics();return {calls,mutations,functions,qualification:'original-render-literal-values-only',effectsVerified:false,acceptedContract:null,records:records.map(r=>({id:r.id,source:r.plan.source,consumer:r.plan.consumer,render:r.render,kind:r.plan.kind,value:witness(r.value),creationDataVerified:!!r.data,currentValuesVerified:stable(r),current:current(r),fields:r.data?r.data.keys.filter(k=>r.plan.kind!=='array'||k!=='length').map(k=>[k,witness(r.data.ds[k].value)]):[],...(r.plan.kind==='array'&&r.data?{length:r.data.ds.length.value}:{})}))};
 }
 return {capture,report,beginCall,endCall,sourceFunction,write,assign};
})`;
