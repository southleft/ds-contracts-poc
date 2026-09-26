import type {ReactCompiledEffects} from './react-compiled-effects.js';
import type {ReactElementInvocation} from './react-element-invocation.js';
import type {ReactElementCreationSite} from './react-element-creation.js';
import {reactHelperIntrinsicGuard} from './react-helper-intrinsics.js';

export interface ReactCompiledValueRequest {
  site:ReactElementCreationSite;
  observation:ReactElementInvocation;
  model:ReactCompiledEffects;
}
export type ReactCompiledValues = {
  version:1;acceptedContract:null;effectsVerified:false;
  qualification:'compiled-invocation-values-only';
} & ({status:'matched';invocation:number;content:'forwarded'|'not-directly-forwarded'}|{status:'refused';reason:string});

/** The host supplies a freshly rebound source model. Opaque values never cross
 * this boundary: matching happens against the original private invocation.
 * A match is not enclosing caller/effect proof and grants no native authority. */
export const reactCompiledValuesRuntime=`(provenance,readInvocation)=>{
 const N={is:Object.is,d:Object.getOwnPropertyDescriptor,ds:Object.getOwnPropertyDescriptors,keys:Reflect.ownKeys,
  proto:Object.getPrototypeOf,stringify:JSON.stringify,parse:JSON.parse,integer:Number.isSafeInteger};
 const objectPrototype=Object.prototype,arrayPrototype=Array.prototype;
 const intrinsics=${reactHelperIntrinsicGuard};
 const common={version:1,acceptedContract:null,effectsVerified:false,qualification:'compiled-invocation-values-only'};
 const refused=reason=>({...common,status:'refused',reason});
 const same=(a,b)=>N.stringify(a)===N.stringify(b);
 const point=(p,site,span)=>p&&p.file===site.module&&p.sha256===site.sourceSha256&&p.start===span.start&&p.end===span.end;
 return (record,target)=>{
  try{
   intrinsics();if(!record)return refused('compiled-values-invocation-unavailable');
   if(record.site.transformed)return refused('compiled-values-transformed-source-unmodeled');
   const frame=record.frame,observation=readInvocation(record),model=target.model;
   if(observation?.status!=='observed'||!same(target.observation,observation))return refused('compiled-values-observation-changed');
   if(observation.inputProvenance.status!=='verified'||observation.outputProvenance.status!=='verified')return refused('compiled-values-react-origin-unproved');
   if(!same(record.site,target.site)||model?.status!=='modeled'||!same(model.site,target.site)||
    !point(model.component,record.site,frame.plan.span)||!point(model.output?.source,record.site,record.site.span))return refused('compiled-values-source-mismatch');
   let steps=0;
   const match=(value,shape,reactProps=false,keyed=false)=>{
    if(++steps>100000)throw Error('compiled-values-limit');
    if(!shape||typeof shape!=='object')return false;
    if(shape.kind==='literal')return typeof value===shape.type&&N.is(value,shape.type==='undefined'?undefined:shape.value);
    if(shape.kind==='opaque'){const child=N.d(frame.before,'children');return !!child&&N.is(value,child.value.value);}
    if(shape.kind==='input'){const input=N.d(frame.before,shape.key);return !!input&&N.is(value,input.value.value);}
    if(shape.kind==='parameter')return N.integer(shape.index)&&shape.index>0&&shape.index<=frame.secondary.length&&N.is(value,frame.secondary[shape.index-1]);
    if(shape.kind==='closure'){
     const r=frame.reads[shape.read];return N.integer(shape.read)&&shape.read>=0&&!!r&&frame.plan.bindingReads[r.read]?.name===shape.name&&N.is(value,frame.values[shape.read]);
    }
    if(shape.kind==='jsx'){
     const origin=provenance.readOutput(value);
     if(origin.status!=='verified'||origin.source.transformed||!point(shape.source,origin.source,origin.source.span))return false;
     const ds=N.ds(value);return shape.tag?.kind==='host'&&ds.type?.value===shape.tag.name&&N.is(ds.key?.value,shape.key)&&
      match(ds.props?.value,shape.props,true,shape.key!==null);
    }
    if(shape.kind!=='record'&&shape.kind!=='array')return false;
    // Root props are authenticated React outputs. Other structured values must
    // have a syntax-created identity; never inspect an unknown proxy by shape.
    if(!reactProps&&!provenance.isLiteral(value))return false;
    if(N.proto(value)!==(shape.kind==='array'?arrayPrototype:objectPrototype))return false;
    const ds=N.ds(value),all=N.keys(ds),warning=reactProps&&keyed&&ds.key&&!N.d(ds.key,'value')&&!ds.key.enumerable;
    const keys=warning?all.filter(k=>k!=='key'):all;
    const fields=shape.kind==='array'?shape.items.map((v,i)=>[String(i),v]):shape.fields;
    if(!Array.isArray(fields)||fields.length>10000||keys.length!==fields.length+(shape.kind==='array'?1:0))return false;
    for(let i=0;i<fields.length;i++){
     const [key,child]=fields[i],d=ds[key];if(keys[i]!==key||!d||!N.d(d,'value')||!d.enumerable||!match(d.value,child))return false;
    }
    return shape.kind!=='array'||keys[keys.length-1]==='length'&&ds.length.value===fields.length;
   };
   if(!match(frame.input,model.input,true))return refused('compiled-values-input-mismatch');
   if(!match(record.element,model.output))return refused('compiled-values-output-mismatch');
   const effects=frame.effects;
   if(!Array.isArray(model.nativeEffects)||model.nativeEffects.length!==effects.length)return refused('compiled-values-effects-mismatch');
   for(let i=0;i<effects.length;i++){
    const actual=effects[i],expected=model.nativeEffects[i],op=frame.plan.operations[actual.operation];
    if(actual.status!=='verified'||!op||!point(expected.source,record.site,op.span)||actual.kind!==expected.kind||actual.key!==expected.key)return refused('compiled-values-effects-mismatch');
    if(actual.kind==='global-symbol-data-write'){
     const value=actual.value.kind==='undefined'?undefined:actual.value.value;
     if(!match(value,expected.value))return refused('compiled-values-effects-mismatch');
    }
   }
   const child=model.output.props.fields.find(([key])=>key==='children');
   const content=child?.[1]?.kind==='opaque'?'forwarded':'not-directly-forwarded';
   if(content!==model.content)return refused('compiled-values-content-mismatch');
   intrinsics();return {...common,status:'matched',invocation:frame.id,content};
  }catch(error){return refused(error instanceof Error?error.message:'compiled-values-unavailable');}
 };
}`;
