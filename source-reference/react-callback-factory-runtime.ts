import type {ReactContextValueWitness} from './react-context-runtime.js';
export interface ReactCallbackFactoryReport {
 qualification:'ordinary-callback-factory-creation-only';effectsVerified:false;acceptedContract:null;
 functions:number;
 literals:Array<{id:number;source:string;consumerCall:number;kind:'function'|'object';value:ReactContextValueWitness;fields?:Array<[string,ReactContextValueWitness]>}>;
 invocations:Array<{id:number;source:string;consumerCall:number|null;render:number|null;consumerCallsBefore:number;callVerified:boolean;bindingsVerified:boolean;bindingPhase:'function-entry';bindings:ReactContextValueWitness[];arguments:ReactContextValueWitness[]|null;completion:'returned'|'threw';callback:number|null;value?:ReactContextValueWitness}>;
 callbacks:Array<{id:number;source:string;invocation:number;value:ReactContextValueWitness;namingVerified:boolean;originVerified:boolean;bodyVerified:false;capturesVerified:false}>;
}
/** Actual parameter values are recorded only at entry, never treated as frozen
 * lexical cells. Original callback identities and deferred bodies stay intact. */
export const reactCallbackFactoryRuntime=String.raw`((plans,N,intrinsics,sameDescriptor,fail,sourceScope,renderScope,witness)=>{
 const point=p=>JSON.stringify([p.file,p.sha256,p.start,p.end]),functions=new Map(),namers=new Map(),frames=[],invocations=[],literals=[],callbacks=[],byLiteral=new N.WeakMapCtor();let invalid=null;
 const fnPlans=(plans?.functions??[]).map(p=>({...p,key:point(p.source)})),consumerPlans=(plans?.consumers??[]).map(p=>({...p,key:point(p.call),target:point(p.source)})),literalPlans=(plans?.literals??[]).map(p=>({...p,key:point(p.source),callKey:point(p.call)}));
 const bad=why=>{invalid??=why;};
 const primitive=p=>p?.kind==='undefined'||!p?undefined:p.value;
 function descriptors(value,before,why){const ds=N.descriptors(value),keys=N.keys(ds),old=N.keys(before);if(keys.length!==old.length||keys.some((k,i)=>k!==old[i]||!sameDescriptor(ds[k],before[k])))bad(why);}
 function register(key,fn){intrinsics();if(!fnPlans.some(p=>p.key===key)||typeof fn!=='function'||functions.has(key))bad('factory-registration');else functions.set(key,fn);}
 function argument(key,value){
  intrinsics();const plan=literalPlans.find(p=>p.key===key),context=sourceScope();if(!plan||!context||plan.callKey!==context.key){bad('factory-argument-scope');return value;}
  if(literals.length>=100000){bad('factory-literal-limit');return value;}
  let ds,fields;
  if(plan.kind==='function'){if(typeof value!=='function')bad('factory-argument-function');}
  else {ds=N.descriptors(value);if(N.prototype(value)!==Object.prototype||N.keys(ds).some(k=>typeof k!=='string'||!N.descriptor(ds[k],'value'))){bad('factory-argument-object');return value;}fields=N.keys(ds).map(k=>[k,ds[k].value]);}
  const item={id:literals.length,key,consumer:context.id,kind:plan.kind,value,ds,fields};literals.push(item);N.apply(N.mapSet,byLiteral,[value,item]);return value;
 }
 function begin(key,fn,bindings){
  intrinsics();const plan=fnPlans.find(p=>p.key===key),context=sourceScope(),render=renderScope(),registered=functions.get(key);
  if(!plan||registered!==fn){bad('factory-function-unmatched');}
  if(invocations.length>=100000||frames.length>=256)bad('factory-call-limit');
  const matched=!!plan&&!!context&&context.callee===fn&&consumerPlans.some(p=>p.key===context.key&&p.target===key);
  const frame={id:invocations.length,key,plan,consumer:matched?context.id:null,render:matched?context.render:null,consumerCallsBefore:render.consumerCalls-1,args:matched?context.args:null,bindings,verified:matched,bindingsVerified:matched,returned:false,closed:false,callback:null};invocations.push(frame);frames.push(frame);
  if(plan&&bindings.length!==plan.parameters.reduce((n,p)=>n+p.bindings.length,0))bad('factory-binding-count');
  if(matched){let cursor=0;for(const p of plan.parameters){let value=context.args[p.index];
   if(!p.object){if(value===undefined&&p.default)value=primitive(p.default);if(!N.is(bindings[cursor++],value))frame.bindingsVerified=false;continue;}
   let fields;
   if(value===undefined&&p.defaultObject)fields=[];
   else {const original=value!==null&&(typeof value==='object'||typeof value==='function')?N.apply(N.mapGet,byLiteral,[value]):null;
    if(!original||original.kind!=='object'||original.consumer!==context.id){frame.bindingsVerified=false;cursor+=p.bindings.length;continue;}
    if(N.prototype(value)!==Object.prototype)bad('factory-argument-object-mutated');descriptors(value,original.ds,'factory-argument-object-mutated');fields=original.fields;}
   for(const b of p.bindings){const entry=fields.find(x=>x[0]===b.key);let v=entry?entry[1]:undefined;if(v===undefined&&b.default)v=primitive(b.default);if(!N.is(bindings[cursor++],v))frame.bindingsVerified=false;}
  }}
  return frame;
 }
 function literal(key,fn){
  intrinsics();const frame=frames[frames.length-1];if(!frame||point(frame.plan.callback)!==key||frame.callback!==null||typeof fn!=='function'){bad('factory-return-literal');return fn;}
  // This is the compiler-marked original fresh literal, never a caller function.
  const ds=N.descriptors(fn);if(N.prototype(fn)!==Function.prototype||N.keys(ds).some(k=>!N.descriptor(ds[k],'value')))bad('factory-function-shape');
  const item={id:callbacks.length,key,frame,value:fn,ds,named:false};callbacks.push(item);frame.callback=item;return fn;
 }
 function namingHelper(key,fn,readNative){
  intrinsics();if(!fnPlans.some(p=>p.naming&&point(p.naming.helper)===key)||namers.has(key)||typeof fn!=='function'||typeof readNative!=='function'||N.apply(readNative,undefined,[])!==N.define)bad('factory-naming-helper');
  else namers.set(key,{fn,readNative,ds:N.descriptors(fn)});return fn;
 }
 function name(key,fn,value,label){
  intrinsics();const frame=frames[frames.length-1],plan=frame?.plan.naming,item=frame?.callback,helper=plan&&namers.get(point(plan.helper));
  if(!plan||point(plan.call)!==key||!item||item.value!==value||item.named||!helper||helper.fn!==fn||label!==plan.name||N.apply(helper.readNative,undefined,[])!==N.define)fail('factory-naming-call');
  descriptors(fn,helper.ds,'factory-naming-helper-mutated');descriptors(value,item.ds,'factory-before-name-mutated');if(invalid)fail(invalid);
  const result=N.apply(fn,undefined,[value,label]);intrinsics();const expected={...item.ds,name:{...item.ds.name,value:label,configurable:true}};
  descriptors(value,expected,'factory-naming-write');descriptors(fn,helper.ds,'factory-naming-helper-mutated');
  if(result!==value||N.prototype(value)!==Function.prototype||N.apply(helper.readNative,undefined,[])!==N.define)bad('factory-naming-return');item.ds=expected;item.named=true;return result;
 }
 function returned(frame,value){
  intrinsics();if(frames[frames.length-1]!==frame||frame.returned||!frame.callback||frame.callback.value!==value||frame.callback.named!==!!frame.plan.naming)bad('factory-return-unmatched');
  if(frame.callback)descriptors(value,frame.callback.ds,'factory-return-mutated');frame.returned=true;frame.value=value;return value;
 }
 function end(frame){if(frames[frames.length-1]!==frame)bad('factory-frame-unmatched');else frames.pop();frame.closed=true;}
 function report(){intrinsics();if(invalid)fail(invalid);if(frames.length||invocations.some(f=>!f.closed))fail('factory-frame-open');return {
  qualification:'ordinary-callback-factory-creation-only',effectsVerified:false,acceptedContract:null,functions:functions.size,
  literals:literals.map(l=>({id:l.id,source:l.key,consumerCall:l.consumer,kind:l.kind,value:witness(l.value),...(l.fields?{fields:l.fields.map(([k,v])=>[k,witness(v)])}:{})})),
  invocations:invocations.map(f=>({id:f.id,source:f.key,consumerCall:f.consumer,render:f.render,consumerCallsBefore:f.consumerCallsBefore,callVerified:f.verified,bindingsVerified:f.bindingsVerified,bindingPhase:'function-entry',bindings:f.bindings.map(witness),arguments:f.args?.map(witness)??null,completion:f.returned?'returned':'threw',callback:f.callback?.id??null,...(f.returned?{value:witness(f.value)}:{})})),
  callbacks:callbacks.map(c=>({id:c.id,source:c.key,invocation:c.frame.id,value:witness(c.value),namingVerified:c.named===!!c.frame.plan.naming,originVerified:c.frame.verified,bodyVerified:false,capturesVerified:false}))};}
 return {register,argument,begin,literal,namingHelper,name,returned,end,report};
})`;
