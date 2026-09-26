import {reactHelperIntrinsicGuard} from './react-helper-intrinsics.js';
import type {ReactElementCreationSite} from './react-element-creation.js';
import type {ReactElementSourcePoint} from './react-element-source-call.js';

export type ReactElementMembership={
  version:1;acceptedContract:null;effectsVerified:false;qualification:'react-return-membership-only';
}&({status:'matched';path:Array<
  {kind:'children';source:ReactElementCreationSite}|
  {kind:'array-index';index:number;source:ReactElementSourcePoint;factoryFreeze?:ReactElementCreationSite}
>}|{status:'refused';reason:string});

/** Private literal and React output identities precede every reflection. This
 * proves one occurrence in a returned JSX children graph, not DOM containment,
 * component execution, source effects or a content/native contract. */
export const reactElementCompositionRuntime=`(sources,provenance,elementRecord)=>{
 const N={apply:Reflect.apply,d:Object.getOwnPropertyDescriptor,ds:Object.getOwnPropertyDescriptors,keys:Reflect.ownKeys,
  proto:Object.getPrototypeOf,is:Object.is,extensible:Object.isExtensible,array:Array.isArray,integer:Number.isSafeInteger,string:String,
  WeakMap,get:WeakMap.prototype.get,set:WeakMap.prototype.set,WeakSet,has:WeakSet.prototype.has,add:WeakSet.prototype.add,remove:WeakSet.prototype.delete};
 const arrayPrototype=Array.prototype,arrays=new N.WeakMap(),intrinsics=${reactHelperIntrinsicGuard};let count=0;
 const get=value=>N.apply(N.get,arrays,[value]);
 const common={version:1,acceptedContract:null,effectsVerified:false,qualification:'react-return-membership-only'};
 const refused=reason=>({...common,status:'refused',reason});
 const snapshot=value=>{
  if(!N.array(value)||N.proto(value)!==arrayPrototype)return;
  const length=N.d(value,'length');if(!length||!N.d(length,'value')||!N.integer(length.value)||length.value<0||length.value>10000)return;
  const ds=N.ds(value),keys=N.keys(ds);
  for(const key of keys){
   if(typeof key!=='string'||!N.d(ds[key],'value'))return;
   if(key!=='length'){
    const index=+key;if(!N.integer(index)||index<0||index>=length.value||N.string(index)!==key||!ds[key].enumerable)return;
   }
  }
  return {ds,keys,length:length.value,extensible:N.extensible(value)};
 };
 const equal=(a,b,freeze=false)=>{
  if(!a||!b||a.keys.length!==b.keys.length||a.length!==b.length||
    (freeze?b.extensible!==false:a.extensible!==b.extensible))return false;
  for(let i=0;i<a.keys.length;i++){
   const key=a.keys[i];if(key!==b.keys[i])return false;
   const left=a.ds[key],right=b.ds[key];
   if(!N.is(left.value,right.value)||left.enumerable!==right.enumerable||
    (freeze?right.writable!==false||right.configurable!==false:left.writable!==right.writable||left.configurable!==right.configurable))return false;
  }return true;
 };
 const current=(value,record)=>!record.invalid&&equal(record.snapshot,snapshot(value));
 return {
  array(index,value){
   const source=sources[index];if(!source)throw Error('element-composition-array-unplanned');
   if(++count>100000)throw Error('element-composition-array-limit');
   try{
    intrinsics();const state=snapshot(value);
    if(state&&state.extensible&&state.keys.every(key=>state.ds[key].writable===true&&state.ds[key].configurable===(key!=='length')))
     N.apply(N.set,arrays,[value,{source,snapshot:state,invalid:false}]);
   }catch{/* source still receives its original array */}return value;
  },
  before(origin,config,site){
   if(origin.failure)return;
   try{
    intrinsics();const child=N.d(config,'children');if(!child||!N.d(child,'value'))return;
    const value=child.value,record=get(value);if(!record)return;
    if(!current(value,record)){record.invalid=true;return;}
    return {value,record,site};
   }catch{return;}
  },
  after(token,element){
   if(!token)return;const {value,record,site}=token;
   try{
    intrinsics();if(provenance.readOutput(element).status!=='verified')throw Error('output');
    const props=N.d(element,'props'),child=props&&N.d(props.value,'children');
    if(!child||!N.d(child,'value')||child.value!==value)throw Error('children');
    const now=snapshot(value);if(equal(record.snapshot,now))return;
    // These are the exact descriptor transitions of the pinned static JSX
    // factory's Object.freeze(children), with every original value unchanged.
    if(site.factory==='jsxs'&&equal(record.snapshot,now,true)){record.snapshot=now;record.factoryFreeze=site;return;}
    throw Error('array');
   }catch{record.invalid=true;}
  },
  isCurrentArray(value){try{intrinsics();const record=get(value);return !!record&&current(value,record);}catch{return false;}},
  read(root,target){
   try{
    intrinsics();const targetRecord=elementRecord(target);
    if(!targetRecord||provenance.readOutput(target).status!=='verified')return refused('element-composition-target-unproved');
    const active=new N.WeakSet(),paths=[];let steps=0;
    const walk=(value,route,depth)=>{
     if(++steps>100000||depth>32)throw Error('element-composition-traversal-limit');
     if(value===null||['undefined','string','number','boolean','bigint'].includes(typeof value))return;
     if(typeof value!=='object')throw Error('element-composition-child-unproved');
     if(N.apply(N.has,active,[value]))throw Error('element-composition-cycle');
     N.apply(N.add,active,[value]);
     try{
      const array=get(value);
      if(array){
       if(!current(value,array))throw Error('element-composition-array-changed');
       for(let i=0;i<array.snapshot.length;i++){
        const entry=N.d(array.snapshot.ds,N.string(i));if(!entry)continue;
        walk(entry.value.value,[...route,{kind:'array-index',index:i,source:array.source,...(array.factoryFreeze?{factoryFreeze:array.factoryFreeze}:{})}],depth+1);
       }return;
      }
      const element=elementRecord(value);if(!element||provenance.readOutput(value).status!=='verified')throw Error('element-composition-child-unproved');
      if(value===target)paths.push(route);
      if(paths.length>1)throw Error('element-composition-ambiguous');
      const child=N.d(element.props,'children');
      if(child){if(!N.d(child,'value'))throw Error('element-composition-child-accessor');walk(child.value,[...route,{kind:'children',source:element.site}],depth+1);}
     }finally{N.apply(N.remove,active,[value]);}
    };
    // The root is a returned React factory output, not an arbitrary array.
    if(!elementRecord(root)||provenance.readOutput(root).status!=='verified')return refused('element-composition-return-unproved');
    walk(root,[],0);intrinsics();
    return paths.length===1?{...common,status:'matched',path:paths[0]}:refused('element-composition-target-absent');
   }catch(error){return refused(error instanceof Error?error.message:'element-composition-unproved');}
  }
 };
}`;
