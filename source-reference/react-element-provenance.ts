import {reactHelperIntrinsicGuard} from './react-helper-intrinsics.js';
import type {ReactElementCreationSite} from './react-element-creation.js';

export type ReactElementProvenance =
  | {status:'refused';reason:string}
  | {status:'verified';qualification:'react-props-origin-only';kind:'jsx'|'create-element'|'forward-ref-copy';source:ReactElementCreationSite};

/** Fresh syntax-created configs plus exact installed React mechanics establish
 * object origin. They do not establish the effects of spread expressions, the
 * parent component's semantics, or agreement with a compiled source model. */
export const reactElementProvenanceRuntime=`(enabled)=>{
 const N={apply:Reflect.apply,keys:Reflect.ownKeys,ds:Object.getOwnPropertyDescriptors,d:Object.getOwnPropertyDescriptor,
  proto:Object.getPrototypeOf,is:Object.is,get:WeakMap.prototype.get,set:WeakMap.prototype.set,
  has:WeakSet.prototype.has,add:WeakSet.prototype.add,WeakMap,WeakSet};
 const configs=new N.WeakSet(),props=new N.WeakMap(),elements=new N.WeakMap(),objectPrototype=Object.prototype;
 const intrinsics=${reactHelperIntrinsicGuard};
 const get=(map,key)=>N.apply(N.get,map,[key]),set=(map,key,value)=>N.apply(N.set,map,[key,value]);
 const refuse=reason=>({status:'refused',reason});
 const data=(value,warningKey=false)=>{
  if(!value||typeof value!=='object'||N.proto(value)!==objectPrototype)return;
  const ds=N.ds(value);for(const k of N.keys(ds))if(typeof k!=='string'||!N.d(ds[k],'value')&&
   !(warningKey&&k==='key'&&!ds[k].enumerable&&typeof ds[k].get==='function'&&ds[k].set===undefined))return;
  return ds;
 };
 const stable=(value,before)=>{
  const now=N.ds(value),ks=N.keys(now),old=N.keys(before);
  if(ks.length!==old.length||N.proto(value)!==objectPrototype)return false;
  for(let i=0;i<ks.length;i++){
   if(ks[i]!==old[i])return false;
   for(const f of ['value','get','set','writable','enumerable','configurable']){
    const a=N.d(now[ks[i]],f),b=N.d(before[old[i]],f);
    if(!!a!==!!b||a&&!N.is(a.value,b.value))return false;
   }
  }return true;
 };
 const report=origin=>({status:'verified',qualification:'react-props-origin-only',kind:origin.kind,source:origin.source});
 return {
  literal(value){N.apply(N.add,configs,[value]);return value;},
  isLiteral(value){return !!value&&N.apply(N.has,configs,[value]);},
  factoryProps(value){return get(props,value)?.factoryProps;},
  before(config,source){
   if(!enabled)return {failure:'react-props-adapter-unavailable'};
   // Identity lookup precedes descriptor access: never inspect an unknown proxy.
   const empty=source.factory==='createElement'&&config===null;
   if(!empty&&(!config||!N.apply(N.has,configs,[config])))return {failure:'react-config-origin-unproved'};
   try{intrinsics();if(!empty&&!data(config))return {failure:'react-config-not-plain-data'};return {source};}
   catch{return {failure:'react-props-native-environment-changed'};}
  },
  after(token,element){
   if(token.failure)return;
   try{
    intrinsics();const d=N.d(element,'props');if(!d||!N.d(d,'value'))return;
    const key=N.d(element,'key'),warningKey=!!key&&N.d(key,'value')&&key.value!==null;
    const value=d.value,ds=data(value,warningKey);if(!ds)return;
    const ref=ds.ref?.value??null,origin={kind:token.source.factory==='createElement'?'create-element':'jsx',source:token.source,descriptors:ds,ref,forwarded:false,warningKey,factoryProps:value};
    set(props,value,origin);set(elements,element,{origin,props:value,descriptors:N.ds(element)});
   }catch{/* The factory already ran. Unknown mechanics remain unqualified. */}
  },
  forward(from,to,ref){
   const origin=get(props,from);if(!origin)return;
   try{
    intrinsics();if(!stable(from,origin.descriptors)||!N.is(ref,origin.ref))return;
    const before=origin.descriptors,after=data(to);if(!after)return;
    const keys=N.keys(before),out=N.keys(after);let n=0;
    for(const key of keys){if(key==='ref'||origin.warningKey&&key==='key'&&!before[key].enumerable)continue;if(out[n++]!==key||!N.is(before[key].value,after[key].value))return;}
    if(n!==out.length||N.d(to,'ref'))return;
    set(props,to,{kind:'forward-ref-copy',source:origin.source,descriptors:after,ref,forwarded:true,factoryProps:origin.factoryProps});
   }catch{/* An unknown copy cannot acquire provenance. */}
  },
  input(value,secondary){
   const origin=get(props,value);if(!origin)return {failure:'react-input-origin-unproved'};
   try{
    intrinsics();if(!stable(value,origin.descriptors))return {failure:'react-input-origin-changed'};
    if(secondary.length>1||secondary.length===1&&(!origin.forwarded||!N.is(secondary[0],origin.ref)))return {failure:'react-secondary-origin-unproved'};
    return {value,origin};
   }catch{return {failure:'react-props-native-environment-changed'};}
  },
  readInput(token){
   if(token.failure)return refuse(token.failure);
   try{intrinsics();return stable(token.value,token.origin.descriptors)?report(token.origin):refuse('react-input-origin-changed');}
   catch{return refuse('react-props-native-environment-changed');}
  },
  readOutput(element){
   const record=get(elements,element);if(!record)return refuse('react-output-origin-unproved');
   try{intrinsics();return stable(element,record.descriptors)&&stable(record.props,record.origin.descriptors)
    ?report(record.origin):refuse('react-output-origin-changed');}
   catch{return refuse('react-props-native-environment-changed');}
  }
 };
}`;
