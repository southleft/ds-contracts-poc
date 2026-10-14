import type {ReactAuthoredClassPlan} from './react-authored-classes.js';
import type {ReactContextValueWitness as Witness} from './react-context-runtime.js';

export interface ReactAuthoredClassRuntimeReport {
  qualification:'original-class-render-boundary-only';acceptedContract:null;effectsVerified:false;
  registered:number;
  constructions:Array<{id:number;target:ReactAuthoredClassPlan['target'];input:Witness;instance:Witness}>;
  resolvers:Array<{id:number;target:ReactAuthoredClassPlan['target'];source:Witness;effective:Witness;factoryProps:Witness;fields:Array<[string,Witness]>;factoryFields:Array<[string,Witness]>;current:boolean;valuesPreserved:false;defaultSemanticsVerified:false}>;
  calls:Array<{id:number;target:ReactAuthoredClassPlan['target'];render:ReactAuthoredClassPlan['render'];graphRender:number;construction:number;resolver:number;input:Witness;fields:Array<[string,Witness]>;factoryProps:Witness;factoryFields:Array<[string,Witness]>;output?:Witness;completion:'returned'|'threw';current:boolean;effectsVerified:false}>;
}

/** The host installs this only beside the hash-pinned React constructor,
 * class-props resolver and class-render call sites. Original class bodies are
 * unchanged. Planner-approved non-substituting construction plus the pinned native
 * React bases establishes instance origin before any instance reflection.
 *
 * A resolver receipt connects the native-created effective props object to its
 * original factory object; it never claims values/defaults were preserved.
 * Factory/element maps and render membership remain the existing authority.
 */
export const reactAuthoredClassRuntime=String.raw`((plans,N,intrinsics,sameDescriptor,fail,witness,props,elements,renderGraph)=>{
 'use strict';
 const objectPrototype=Object.prototype;
 const byConstructor=new N.WeakMapCtor(),byInstance=new N.WeakMapCtor(),tokens=new N.WeakMapCtor(),resolutions=new N.WeakMapCtor();
 const classes=new Map(),constructions=[],resolvers=[],calls=[],byRender=new Map();let bases=null;
 const key=p=>JSON.stringify([p.target.module,p.target.sourceSha256,p.target.span.start,p.target.span.end]);
 const get=(map,value)=>N.apply(N.mapGet,map,[value]),set=(map,value,item)=>N.apply(N.mapSet,map,[value,item]);
 const bad=reason=>{fail('authored-class-'+reason);throw Error('authored-class-'+reason);};
 const limit=(items,kind)=>{if(items.length>=100000)bad(kind+'-limit');};
 function sameData(value,before){
  if(N.prototype(value)!==objectPrototype)return false;
  const ds=N.descriptors(value),keys=N.keys(ds),old=N.keys(before);
  return keys.length===old.length&&keys.every((name,index)=>name===old[index]&&sameDescriptor(ds[name],before[name]));
 }
 function data(value,origin){
  if(N.prototype(value)!==objectPrototype)bad('props-prototype-unproved');
  const ds=N.descriptors(value),fields=[];
  for(const name of N.keys(ds)){
   const descriptor=ds[name];
   if(name==='key'&&origin?.keyWarning&&sameDescriptor(descriptor,origin.keyWarning))continue;
   if(typeof name!=='string'||!N.descriptor(descriptor,'value'))bad('props-not-data');
   fields.push([name,descriptor.value]);
  }
  return {descriptors:ds,fields};
 }
 function classCurrent(record){
  return bases&&N.prototype(record.ctor)===record.base.ctor&&N.prototype(record.proto)===record.base.proto&&
   sameDescriptor(N.descriptor(record.ctor,'prototype'),record.prototypeDescriptor)&&
   sameDescriptor(N.descriptor(record.proto,'render'),record.renderDescriptor)&&
   N.descriptor(record.proto,'constructor')?.value===record.ctor;
 }
 function registerBases(component,pure){
  intrinsics();if(bases||typeof component!=='function'||typeof pure!=='function')bad('bases-unproved');
  bases=[component,pure].map(ctor=>({ctor,proto:N.descriptor(ctor,'prototype')?.value}));
  if(bases.some(base=>!base.proto||typeof base.proto!=='object'))bad('bases-unproved');
 }
 function registerClass(source,value){
  intrinsics();const candidates=plans.filter(plan=>key(plan)===source);
  if(candidates.length!==1||classes.has(source)||typeof value!=='function'||get(byConstructor,value))bad('registration-unplanned-or-ambiguous');
  const plan=candidates[0];if(plan.qualification!=='original-class-render-boundary-only'||plan.effectsVerified!==false||plan.acceptedContract!==null)bad('plan-scope-changed');
  const prototypeDescriptor=N.descriptor(value,'prototype'),proto=prototypeDescriptor?.value;
  if(!proto||typeof proto!=='object')bad('prototype-unproved');
  const base=bases?.find(base=>N.prototype(value)===base.ctor&&N.prototype(proto)===base.proto),renderDescriptor=N.descriptor(proto,'render');
  if(!base||!renderDescriptor||!N.descriptor(renderDescriptor,'value')||typeof renderDescriptor.value!=='function'||N.descriptor(proto,'constructor')?.value!==value)bad('class-origin-unproved');
  const record={plan,ctor:value,proto,base,prototypeDescriptor,renderDescriptor,render:renderDescriptor.value};
  classes.set(source,record);set(byConstructor,value,record);return value;
 }
 function beginClassConstruction(ctor,input){
  const record=typeof ctor==='function'?get(byConstructor,ctor):null;if(!record)return;
  intrinsics();if(!classCurrent(record))bad('constructor-changed');
  const token={};set(tokens,token,{kind:'construction',record,input,finished:false});return token;
 }
 function finishClassConstruction(token,instance){
  if(!token)return instance;const pending=get(tokens,token);
  if(!pending||pending.kind!=='construction'||pending.finished)bad('construction-token-unproved');pending.finished=true;
  intrinsics();if(!classCurrent(pending.record)||!instance||typeof instance!=='object'||get(byInstance,instance))bad('construction-unproved');
  // Only the original result of the pinned new expression may reach here.
  // The source planner proved this constructor cannot substitute a Proxy.
  const descriptor=N.descriptor(instance,'props');
  if(N.prototype(instance)!==pending.record.proto||!descriptor||!N.descriptor(descriptor,'value')||!N.is(descriptor.value,pending.input))bad('constructed-instance-changed');
  limit(constructions,'construction');const record={id:constructions.length,registration:pending.record,input:pending.input,instance};
  constructions.push(record);set(byInstance,instance,record);return instance;
 }
 function constructed(ctor,input,instance){return finishClassConstruction(beginClassConstruction(ctor,input),instance);}
 function beginClassProps(ctor,from){
  const record=typeof ctor==='function'?get(byConstructor,ctor):null,origin=from&&typeof from==='object'?get(props,from):null;
  if(!record||!origin)return;
  intrinsics();if(!classCurrent(record)||!sameData(from,origin.descriptors))bad('resolver-source-changed');
  const token={};set(tokens,token,{kind:'resolver',record,from,origin,finished:false});return token;
 }
 function finishClassProps(token,to){
  if(!token)return to;const pending=get(tokens,token);
  if(!pending||pending.kind!=='resolver'||pending.finished)bad('resolver-token-unproved');pending.finished=true;
  intrinsics();if(!classCurrent(pending.record)||!sameData(pending.from,pending.origin.descriptors))bad('resolver-source-changed');
  // The pinned resolver returns the known input or its own ordinary allocation.
  // No defaultProps lookup, comparison, getter or Proxy reflection is added.
  const effective=data(to,to===pending.from?pending.origin:undefined),factoryProps=pending.origin.factoryProps??pending.from;
  const factoryOrigin=factoryProps&&typeof factoryProps==='object'?get(props,factoryProps):null;
  if(!factoryOrigin||!sameData(factoryProps,factoryOrigin.descriptors))bad('factory-props-origin-unproved');
  const factory=data(factoryProps,factoryOrigin);
  limit(resolvers,'resolver');const record={id:resolvers.length,registration:pending.record,from:pending.from,to,factoryProps,factory,sourceDescriptors:pending.origin.descriptors,effective};
  resolvers.push(record);set(resolutions,to,[...(get(resolutions,to)??[]),record]);
  const origin={...pending.origin,kind:'class-props-resolver',descriptors:effective.descriptors,factoryProps,forwarded:false,
   ...(to===pending.from?{}:{keyWarning:undefined})};
  set(props,to,origin);return to;
 }
 function resolverCurrent(record){return classCurrent(record.registration)&&sameData(record.from,record.sourceDescriptors)&&sameData(record.to,record.effective.descriptors)&&sameData(record.factoryProps,record.factory.descriptors);}
 function callCurrent(record){
  if(!classCurrent(record.registration)||N.prototype(record.instance)!==record.registration.proto||N.descriptor(record.instance,'render'))return false;
  const input=N.descriptor(record.instance,'props');
  if(!input||!N.descriptor(input,'value')||!N.is(input.value,record.input)||!resolverCurrent(record.resolver))return false;
  if(record.returned){
   const output=get(elements,record.output);if(!output||output!==record.outputOrigin||!sameData(record.output,output.descriptors)||!sameData(output.props,output.origin.descriptors))return false;
  }
  return true;
 }
 function invoke(instance,fn){
  const construction=instance&&typeof instance==='object'?get(byInstance,instance):null;
  if(!construction)return N.apply(fn,instance,[]);
  intrinsics();const registration=construction.registration;
  if(!classCurrent(registration)||N.prototype(instance)!==registration.proto||N.descriptor(instance,'render')||!N.is(fn,registration.render))bad('render-identity-changed');
  const inputDescriptor=N.descriptor(instance,'props');
  if(!inputDescriptor||!N.descriptor(inputDescriptor,'value'))bad('render-props-accessor');
  const input=inputDescriptor.value,origin=input&&typeof input==='object'?get(props,input):null;
  // Provenance lookup precedes any reflection on effective props.
  if(!origin)bad('render-props-origin-unproved');
  const candidates=(get(resolutions,input)??[]).filter(record=>record.registration===registration&&resolverCurrent(record));
  const resolver=candidates.at(-1);if(!resolver)bad('render-resolver-origin-unproved');
  const effective=data(input,origin);if(!sameData(input,resolver.effective.descriptors))bad('render-props-changed');
  limit(calls,'call');const record={id:calls.length,registration,construction,resolver,instance,input,fields:effective.fields,factoryProps:resolver.factoryProps,returned:false,graphRender:null};calls.push(record);
  try{return renderGraph.invoke(fn,input,()=>{
   const id=renderGraph.currentId();if(!Number.isSafeInteger(id)||id<0||byRender.has(id))bad('render-graph-identity-unproved');
   record.graphRender=id;byRender.set(id,record);
   const output=N.apply(fn,instance,[]);record.output=output;record.returned=true;
   const outputOrigin=output&&typeof output==='object'?get(elements,output):null;
   if(!outputOrigin)bad('render-output-origin-unproved');
   record.outputOrigin=outputOrigin;record.owner=outputOrigin.descriptors._owner?.value;
   if(!callCurrent(record))bad('render-boundary-changed');return output;
  });}finally{record.closed=true;}
 }
 function verifyHost(renderId,owner){
  const record=byRender.get(renderId);if(!record)return true;
  intrinsics();
  // Only the exact owner already retained by the pinned native element factory
  // may be inspected. An arbitrary owner/Proxy receives no descriptor reads.
  if(!record.closed||!record.returned||!callCurrent(record)||!owner||!N.is(owner,record.owner))return false;
  const state=N.descriptor(owner,'stateNode'),type=N.descriptor(owner,'type'),input=N.descriptor(owner,'memoizedProps');
  return !!state&&!!type&&!!input&&!!N.descriptor(state,'value')&&!!N.descriptor(type,'value')&&!!N.descriptor(input,'value')&&
   N.is(state.value,record.instance)&&N.is(type.value,record.registration.ctor)&&N.is(input.value,record.factoryProps);
 }
 function report(){
  intrinsics();if(calls.some(call=>!call.closed))bad('open-render');
  return {qualification:'original-class-render-boundary-only',acceptedContract:null,effectsVerified:false,registered:classes.size,
   constructions:constructions.map(record=>({id:record.id,target:record.registration.plan.target,input:witness(record.input),instance:witness(record.instance)})),
   resolvers:resolvers.map(record=>({id:record.id,target:record.registration.plan.target,source:witness(record.from),effective:witness(record.to),factoryProps:witness(record.factoryProps),fields:record.effective.fields.map(([name,value])=>[name,witness(value)]),factoryFields:record.factory.fields.map(([name,value])=>[name,witness(value)]),current:resolverCurrent(record),valuesPreserved:false,defaultSemanticsVerified:false})),
   calls:calls.map(record=>({id:record.id,target:record.registration.plan.target,render:record.registration.plan.render,graphRender:record.graphRender,construction:record.construction.id,resolver:record.resolver.id,input:witness(record.input),fields:record.fields.map(([name,value])=>[name,witness(value)]),factoryProps:witness(record.factoryProps),factoryFields:record.resolver.factory.fields.map(([name,value])=>[name,witness(value)]),...(record.returned?{output:witness(record.output)}:{}),completion:record.returned?'returned':'threw',current:callCurrent(record),effectsVerified:false}))};
 }
 return {registerBases,registerClass,beginClassConstruction,finishClassConstruction,constructed,beginClassProps,finishClassProps,invoke,verifyHost,report};
})`;
