import type {HelperSourcePoint} from './react-helper-model.mjs';
import type {ReactContextValueWitness as Witness} from './react-context-runtime.js';
export interface ReactConsumerLiteralReport {
 qualification:'original-render-literal-values-only';effectsVerified:false;acceptedContract:null;
 records:Array<{id:number;source:HelperSourcePoint;consumer:HelperSourcePoint;render:number;kind:'record'|'array';value:Witness;creationDataVerified:boolean;currentValuesVerified:boolean;fields:Array<[string,Witness]>;length?:number}>;
}
/** Reflect only compiler-marked fresh literals, one level at a time. Nested
 * values are opaque identities until their own allocation is independently
 * joined. Frozen data descriptors keep value authority, never write authority. */
export const reactConsumerLiteralRuntime=String.raw`((plans,N,intrinsics,fail,scope,witness)=>{
 const point=p=>JSON.stringify([p.file,p.sha256,p.start,p.end]),sites=plans.map(p=>({...p,key:point(p.source),owner:point(p.consumer)})),records=[],known=new N.WeakMapCtor();
 function shape(value,kind){
  const ds=N.descriptors(value),keys=N.keys(ds);
  if(N.prototype(value)!==(kind==='record'?Object.prototype:Array.prototype)||keys.some(k=>typeof k!=='string'||!N.descriptor(ds[k],'value')))return null;
  if(kind==='array'){
   const length=ds.length?.value;if(!Number.isSafeInteger(length)||length<0||length>10000||keys.length!==length+1||keys[length]!=='length'||keys.slice(0,length).some((k,i)=>k!==String(i)||!ds[k].enumerable))return null;
  }else if(keys.some(k=>!ds[k].enumerable))return null;
  return {ds,keys};
 }
 function capture(key,value){
  intrinsics();const plan=sites.find(s=>s.key===key),render=scope();
  if(!plan||render.render===null||plan.owner!==render.renderSource)fail('consumer-literal-scope');
  if(records.length>=100000||N.apply(N.mapGet,known,[value]))fail('consumer-literal-origin');
  // Only the original AST literal, never a caller-provided value, enters here.
  const data=shape(value,plan.kind),record={id:records.length,plan,render:render.render,value,data};records.push(record);N.apply(N.mapSet,known,[value,record]);return value;
 }
 function stable(record){
  if(!record.data)return false;const now=shape(record.value,record.plan.kind);if(!now||now.keys.length!==record.data.keys.length)return false;
  return now.keys.every((k,i)=>k===record.data.keys[i]&&N.is(now.ds[k].value,record.data.ds[k].value));
 }
 function report(){
  intrinsics();return {qualification:'original-render-literal-values-only',effectsVerified:false,acceptedContract:null,records:records.map(r=>({id:r.id,source:r.plan.source,consumer:r.plan.consumer,render:r.render,kind:r.plan.kind,value:witness(r.value),creationDataVerified:!!r.data,currentValuesVerified:stable(r),fields:r.data?r.data.keys.filter(k=>r.plan.kind!=='array'||k!=='length').map(k=>[k,witness(r.data.ds[k].value)]):[],...(r.plan.kind==='array'&&r.data?{length:r.data.ds.length.value}:{})}))};
 }
 return {capture,report};
})`;
