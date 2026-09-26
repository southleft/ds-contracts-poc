import type {ReactJsxEffects} from './react-jsx-effects.js';
import type {ReactElementInvocation} from './react-element-invocation.js';
import type {ReactElementCreationSite} from './react-element-creation.js';
import {reactHelperIntrinsicGuard} from './react-helper-intrinsics.js';

export interface ReactJsxValueRequest {
  site:ReactElementCreationSite;
  observation:ReactElementInvocation;
  model:ReactJsxEffects;
}
export type ReactJsxValues = {
  version:1;acceptedContract:null;effectsVerified:false;
  qualification:'original-jsx-invocation-values-only';
} & ({status:'matched';invocation:number;targets:number;content:'forwarded'|'not-directly-forwarded'}|{status:'refused';reason:string});

/** Compare private original invocation values against a fresh host source model.
 * Export values come from compiler-inserted static imports of rebound executable
 * exports. Neither value identity nor this comparison proves initializer, lookup,
 * helper or enclosing effects; no native/content authority is returned. */
export const reactJsxValuesRuntime=`(provenance,readInvocation,elementRecord,knownArray,definitions)=>{
 const N={is:Object.is,d:Object.getOwnPropertyDescriptor,ds:Object.getOwnPropertyDescriptors,keys:Reflect.ownKeys,
  proto:Object.getPrototypeOf,stringify:JSON.stringify,integer:Number.isSafeInteger,array:Array.isArray,Map};
 const objectPrototype=Object.prototype,arrayPrototype=Array.prototype,targets=new N.Map();let fragment,fragmentRegistered=false;
 const intrinsics=${reactHelperIntrinsicGuard};
 const common={version:1,acceptedContract:null,effectsVerified:false,qualification:'original-jsx-invocation-values-only'};
 const refused=reason=>({...common,status:'refused',reason});
 const same=(a,b)=>N.stringify(a)===N.stringify(b);
 const point=(p,site,span)=>p&&span&&p.file===site.module&&p.sha256===site.sourceSha256&&p.start===span.start&&p.end===span.end;
 const key=p=>N.stringify([p.file,p.sha256,p.start,p.end]);
 return {
  register(index,value){
   intrinsics();const definition=definitions[index];if(!N.integer(index)||index<0||!definition)throw Error('jsx-values-target-registration-unplanned');
   const id=key({file:definition.module,sha256:definition.sourceSha256,...definition.span});
   if(targets.has(id))throw Error('jsx-values-target-registration-duplicate');targets.set(id,value);
  },
  fragment(value){intrinsics();if(fragmentRegistered||typeof value!=='symbol')throw Error('jsx-values-fragment-registration-invalid');fragment=value;fragmentRegistered=true;},
  compare(record,target){
   try{
    intrinsics();if(!record)return refused('jsx-values-invocation-unavailable');
    const site=record.site,frame=record.frame,model=target.model,observation=readInvocation(record);
    if(!site.transformed||!site.originalFunction||!site.originalJsx||site.referenceEntry)return refused('jsx-values-original-source-unavailable');
    if(observation?.status!=='observed'||!same(observation,target.observation))return refused('jsx-values-observation-changed');
    if(observation.inputProvenance.status!=='verified'||observation.outputProvenance.status!=='verified')return refused('jsx-values-react-origin-unproved');
    if(!same(site,target.site)||model?.status!=='modeled'||!same(model.site,site)||
      !point(model.component,site,frame.plan.span)||!point(model.output?.source,site,site.originalJsx.span))return refused('jsx-values-source-mismatch');
    let steps=0,targetCount=0;
    const match=(value,shape,reactProps=false,keyed=false)=>{
     if(++steps>100000)throw Error('jsx-values-limit');
     if(!shape||typeof shape!=='object')return false;
     if(shape.kind==='literal')return typeof value===shape.type&&N.is(value,shape.type==='undefined'?undefined:shape.value);
     if(shape.kind==='opaque'){const child=N.d(frame.before,'children');return !!child&&N.is(value,child.value.value);}
     if(shape.kind==='input'){const input=N.d(frame.before,shape.key);return !!input&&N.is(value,input.value.value);}
     if(shape.kind==='parameter')return N.integer(shape.index)&&shape.index>0&&shape.index<=frame.secondary.length&&N.is(value,frame.secondary[shape.index-1]);
     if(shape.kind==='jsx'){
      // Both lookups are private identity checks before any reflection. A proxy
      // or a structurally similar element cannot borrow React output provenance.
      const created=elementRecord(value),origin=provenance.readOutput(value);
      if(!created||created.frame!==frame||origin.status!=='verified'||!same(created.site,origin.source)||
        !point(shape.source,created.site,created.site.originalJsx?.span))return false;
      const ds=N.ds(value),type=ds.type?.value,tag=shape.tag;
      if(tag?.kind==='host'){if(type!==tag.name)return false;}
      else if(tag?.kind==='fragment'){if(!fragmentRegistered||type!==fragment)return false;}
      else if(tag?.kind==='source-binding'){
       const id=key(tag.source);if(!targets.has(id)||!N.is(type,targets.get(id)))return false;
       const reads=model.jsxTargets?.filter(t=>same(t.site,shape.source)&&same(t.binding,tag.source)&&point(t.read,created.site,created.site.originalJsx?.tagSpan));
       if(reads?.length!==1)return false;targetCount++;
      }else return false;
      return N.is(ds.key?.value,shape.key)&&match(ds.props?.value,shape.props,true,shape.key!==null);
     }
     if(shape.kind!=='record'&&shape.kind!=='array')return false;
     if(!reactProps&&!provenance.isLiteral(value)&&!(shape.kind==='array'&&knownArray(value)))return false;
     if(N.proto(value)!==(shape.kind==='array'?arrayPrototype:objectPrototype))return false;
     const ds=N.ds(value),all=N.keys(ds),warning=reactProps&&keyed&&ds.key&&!N.d(ds.key,'value')&&!ds.key.enumerable;
     const keys=warning?all.filter(k=>k!=='key'):all,fields=shape.kind==='array'?shape.items.map((v,i)=>[String(i),v]):shape.fields;
     if(!N.array(fields)||fields.length>10000||keys.length!==fields.length+(shape.kind==='array'?1:0))return false;
     for(let i=0;i<fields.length;i++){
      const [name,child]=fields[i],d=ds[name];if(keys[i]!==name||!d||!N.d(d,'value')||!d.enumerable||!match(d.value,child))return false;
     }
     return shape.kind!=='array'||keys[keys.length-1]==='length'&&ds.length.value===fields.length;
    };
    if(!match(frame.input,model.input,true))return refused('jsx-values-input-mismatch');
    if(!match(record.element,model.output))return refused('jsx-values-output-mismatch');
    if(!N.array(model.jsxTargets)||targetCount!==model.jsxTargets.length)return refused('jsx-values-target-coverage-mismatch');
    const child=model.output.props.fields.find(([name])=>name==='children'),content=child?.[1]?.kind==='opaque'?'forwarded':'not-directly-forwarded';
    if(content!==model.content)return refused('jsx-values-content-mismatch');
    intrinsics();return {...common,status:'matched',invocation:frame.id,targets:targetCount,content};
   }catch(error){return refused(error instanceof Error?error.message:'jsx-values-unavailable');}
  }
 };
}`;
