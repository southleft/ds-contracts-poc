import type {ReactAuthoredFunctionPlan} from './react-authored-functions.js';
import type {ReactContextValueWitness as Witness} from './react-context-runtime.js';
export interface ReactAuthoredFunctionRuntimeReport {
 qualification:'original-function-render-boundary-only';effectsVerified:false;acceptedContract:null;
 registered:number;
 calls:Array<{source:ReactAuthoredFunctionPlan['source'];render:ReactAuthoredFunctionPlan['render'];graphRender:number;
  function:Witness;input:Witness;factoryProps:Witness;fields:Array<[string,Witness]>;factoryFields:Array<[string,Witness]>;
  output?:Witness;completion:'returned'|'threw';current:boolean;effectsVerified:false}>;
}
/** Registrations must first pass the host's emitted lexical-literal check.
 * Only known native factory props and returned elements may be reflected. */
export const reactAuthoredFunctionRuntime=String.raw`((plans,N,intrinsics,sameDescriptor,fail,witness,props,elements,graph)=>{
 const prototype=Function.prototype,objectPrototype=Object.prototype;
 const registered=new Map(),byFunction=new N.WeakMapCtor(),calls=[],byRender=new Map();
 const key=p=>JSON.stringify([p.source.file,p.source.sha256,p.source.start,p.source.end]);
 const get=(map,value)=>N.apply(N.mapGet,map,[value]);
 const bad=reason=>{fail('authored-function-'+reason);throw Error('authored-function-'+reason);};
 function sameData(value,ds){
  if(N.prototype(value)!==objectPrototype)return false;
  const now=N.descriptors(value),keys=N.keys(now),old=N.keys(ds);
  return keys.length===old.length&&keys.every((name,i)=>name===old[i]&&sameDescriptor(now[name],ds[name]));
 }
 function current(record){
  if(N.apply(record.read,undefined,[])!==record.fn||N.prototype(record.fn)!==prototype)return false;
  const now=N.descriptors(record.fn),keys=N.keys(now),old=N.keys(record.descriptors);
  return keys.length===old.length&&keys.every((name,i)=>name===old[i]&&sameDescriptor(now[name],record.descriptors[name]));
 }
 function register(source,fn,read){
  intrinsics();const matches=plans.filter(p=>key(p)===source);
  if(matches.length!==1||registered.has(source)||typeof fn!=='function'||typeof read!=='function'||get(byFunction,fn))bad('registration-unplanned-or-ambiguous');
  // The checked bundle proves fn is its direct lexical function literal and
  // read is a same-binding callback; no unknown function or proxy reaches here.
  if(N.apply(read,undefined,[])!==fn||N.prototype(fn)!==prototype)bad('registration-binding-changed');
  const descriptors=N.descriptors(fn);
  if(N.keys(descriptors).some(name=>!N.descriptor(descriptors[name],'value')))bad('function-accessor');
  const record={plan:matches[0],fn,read,descriptors};registered.set(source,record);N.apply(N.mapSet,byFunction,[fn,record]);return fn;
 }
 function fields(ds,origin){
  const out=[];
  for(const name of N.keys(ds)){
   const d=ds[name];if(name==='key'&&origin.keyWarning&&sameDescriptor(d,origin.keyWarning))continue;
   if(typeof name!=='string'||!N.descriptor(d,'value'))bad('props-accessor');
   out.push([name,d.value]);
  }return out;
 }
 function callCurrent(call){
  if(!current(call.registration)||!sameData(call.input,call.inputOrigin.descriptors)||!sameData(call.factoryProps,call.factoryOrigin.descriptors))return false;
  if(call.returned){const origin=get(elements,call.output);if(!origin||origin!==call.outputOrigin||!sameData(call.output,origin.descriptors)||!sameData(origin.props,origin.origin.descriptors))return false;}
  return true;
 }
 function invoke(fn,input,call){
  const registration=typeof fn==='function'?get(byFunction,fn):null;if(!registration)return call();
  intrinsics();if(!current(registration))bad('binding-changed');
  const origin=input&&typeof input==='object'?get(props,input):null;if(!origin)bad('input-origin-unproved');
  const factoryProps=origin.factoryProps??input,factoryOrigin=get(props,factoryProps);
  if(!factoryOrigin||!sameData(input,origin.descriptors)||!sameData(factoryProps,factoryOrigin.descriptors))bad('input-changed');
  const graphRender=graph.currentId();if(!Number.isSafeInteger(graphRender)||graphRender<0||byRender.has(graphRender)||calls.length>=100000)bad('render-identity-unproved');
  const record={registration,graphRender,input,inputOrigin:origin,factoryProps,factoryOrigin,
   fields:fields(origin.descriptors,origin),factoryFields:fields(factoryOrigin.descriptors,factoryOrigin),returned:false,closed:false};
  calls.push(record);byRender.set(graphRender,record);
  try{
   const output=call();record.output=output;record.returned=true;
   const outputOrigin=output&&typeof output==='object'?get(elements,output):null;
   if(!outputOrigin)bad('output-origin-unproved');record.outputOrigin=outputOrigin;
   record.owner=outputOrigin.descriptors._owner?.value;
   if(!callCurrent(record))bad('boundary-changed');return output;
  }finally{record.closed=true;}
 }
 function verifyHost(render,owner){
  const call=byRender.get(render);if(!call)return true;
  intrinsics();if(!call.closed||!call.returned||!callCurrent(call)||!owner||!N.is(owner,call.owner))return false;
  // Owner identity came from the pinned React factory before these reads.
  const type=N.descriptor(owner,'type'),input=N.descriptor(owner,'memoizedProps');
  return !!type&&!!input&&!!N.descriptor(type,'value')&&!!N.descriptor(input,'value')&&N.is(type.value,call.registration.fn)&&N.is(input.value,call.factoryProps);
 }
 function report(){
  intrinsics();if(registered.size!==plans.length||calls.some(c=>!c.closed))bad('registration-or-render-incomplete');
  return {qualification:'original-function-render-boundary-only',effectsVerified:false,acceptedContract:null,registered:registered.size,
   calls:calls.map(c=>({source:{...c.registration.plan.source},render:{...c.registration.plan.render},graphRender:c.graphRender,
    function:witness(c.registration.fn),input:witness(c.input),factoryProps:witness(c.factoryProps),fields:c.fields.map(([k,v])=>[k,witness(v)]),factoryFields:c.factoryFields.map(([k,v])=>[k,witness(v)]),
    ...(c.returned?{output:witness(c.output)}:{}),completion:c.returned?'returned':'threw',current:callCurrent(c),effectsVerified:false}))};
 }
 return {register,invoke,verifyHost,report};
})`;
