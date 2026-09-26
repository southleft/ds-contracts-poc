import type {ReactContextValueWitness} from './react-context-runtime.js';
export interface ReactCallbackSourceReport {
 qualification:'callback-source-and-rest-captures-only';effectsVerified:false;acceptedContract:null;
 functions:number;
 hooks:Array<{id:number;site:string;invocation:number;render:number|null;consumerCall:number|null;kind:'native-exports-data'|'native-interop-getter'|'lexical';propertyEffectsVerified:true;completion:'returned'|'threw';nativeSelection:number|null;arguments:ReactContextValueWitness[]|null;value?:ReactContextValueWitness}>;
 invocations:Array<{id:number;source:string;render:number|null;consumerCall:number|null;parent:number|null;call:string|null;callVerified:boolean;completion:'returned'|'threw';arguments:ReactContextValueWitness[]|null;value?:ReactContextValueWitness}>;
 rests:Array<{id:number;invocation:number;binding:string;value:ReactContextValueWitness;elements:ReactContextValueWitness[]}>;
 callbacks:Array<{id:number;source:string;invocation:number;value:ReactContextValueWitness;captures:Array<{binding:string;rest:number}>;originVerified:boolean;bodyVerified:false}>;
}
/** Original function bodies and rest signatures remain intact. Only fresh native
 * rest arrays may be reflected; their elements and callback functions stay
 * opaque. Source calls and callback creation are evidence of origin, not body
 * effects, dependency equality, or ref attachment/cleanup qualification. */
export const reactCallbackSourceRuntime=String.raw`((plans,N,intrinsics,sameDescriptor,fail,scope,witness,nativeHooks,verifySelection)=>{
 const point=p=>JSON.stringify([p.file,p.sha256,p.start,p.end]);
 const hooks=[],hookFrames=[],hookTokens=new N.WeakMapCtor();
 const hookPlans=(plans?.hooks??[]).map(p=>({...p,key:point(p.call),ownerKey:point(p.owner)}));
 const functions=new Map(),frames=[],invocations=[],calls=[],rests=[],callbacks=[],byRest=new N.WeakMapCtor(),byCallback=new N.WeakMapCtor();let invalid=null;
 const bad=reason=>{invalid??=reason;};
 const functionPlans=(plans?.functions??[]).map(p=>({...p,key:point(p.source)}));
 const callPlans=(plans?.calls??[]).map(p=>({...p,key:point(p.call),target:point(p.source),callerKey:point(p.caller)}));
 const callbackPlans=(plans?.callbacks??[]).map(p=>({...p,key:point(p.source),ownerKey:point(p.owner)}));
 const consumers=(plans?.consumers??[]).map(p=>({key:point(p.call),target:point(p.source)}));
 function register(key,value){
  intrinsics();const plan=functionPlans.find(p=>p.key===key);
  if(!plan||typeof value!=='function'||functions.has(key)){bad('callback-source-registration');return;}
  functions.set(key,{plan,value});
 }
 function unchanged(rest){
  const ds=N.descriptors(rest.value),keys=N.keys(ds);
  if(N.prototype(rest.value)!==Array.prototype||keys.length!==rest.keys.length||keys.some((k,i)=>k!==rest.keys[i]||!sameDescriptor(ds[k],rest.descriptors[k])))bad('callback-source-rest-mutated');
 }
 function begin(key,fn,values){
  intrinsics();const item=functions.get(key),parent=frames[frames.length-1],context=scope(),local=calls[calls.length-1];
  if(!item||!N.is(item.value,fn)||values.length!==item.plan.parameters.length)bad('callback-source-function-unmatched');
  if(invocations.length>=100000||frames.length>=256)bad('callback-source-invocation-limit');
  const matched=local&&local.phase==='calling'&&!local.frame&&local.site.target===key&&N.is(local.fn,fn)&&parent===local.parent;
  const root=!parent&&context&&N.is(context.callee,fn)&&consumers.some(p=>p.key===context.key&&p.target===key);
  const args=matched?local.args:root?context.args:null;
  const frame={id:invocations.length,key,item,parent:parent??null,render:context?.render??null,consumerCall:context?.id??null,call:matched?local.site.key:null,args,verified:!!(matched?parent?.verified:root),rests:[],returned:false,closed:false};
  invocations.push(frame);frames.push(frame);if(matched)local.frame=frame;
  if(item)for(let i=0;i<item.plan.parameters.length;i++){
   const p=item.plan.parameters[i],value=values[i];
   if(!p.rest){if(args&&!N.is(value,args[i]))bad('callback-source-parameter-mismatch');continue;}
   // The compiler supplies this original rest parameter immediately on entry.
   // No caller-provided array is accepted at this registration boundary.
   const ds=N.descriptors(value),keys=N.keys(ds),length=ds.length?.value;
   if(N.prototype(value)!==Array.prototype||!Number.isInteger(length)||length<0||length>10000||keys.length!==length+1||keys[length]!=='length'||N.apply(N.mapGet,byRest,[value])){bad('callback-source-rest-origin');continue;}
   const elements=[];for(let j=0;j<length;j++){const d=ds[String(j)];if(keys[j]!==String(j)||!d||!N.descriptor(d,'value')||!d.writable||!d.enumerable||!d.configurable){bad('callback-source-rest-shape');break;}elements.push(d.value);}
   if(args&&(length!==(args.length>i?args.length-i:0)||elements.some((v,j)=>!N.is(v,args[i+j]))))bad('callback-source-rest-argument-mismatch');
   const rest={id:rests.length,frame,binding:point(p.binding),value,elements,descriptors:ds,keys};rests.push(rest);frame.rests.push(rest);N.apply(N.mapSet,byRest,[value,rest]);
  }
  return frame;
 }
 function returned(frame,key,value){
  intrinsics();if(frames[frames.length-1]!==frame||frame.returned||key!==null&&!frame.item?.plan.returns.some(p=>point(p)===key))bad('callback-source-return-unmatched');
  frame.returned=true;frame.value=value;return value;
 }
 function end(frame){if(frames[frames.length-1]!==frame)bad('callback-source-frame-mismatch');else frames.pop();frame.closed=true;}
 function call(key,fn,argumentsThunk){
  intrinsics();const site=callPlans.find(p=>p.key===key),parent=frames[frames.length-1];
  if(!site||!parent||parent.key!==site.callerKey||typeof argumentsThunk!=='function')fail('callback-source-call-unplanned');
  if(calls.length>=256)fail('callback-source-call-limit');
  const item={site,parent,fn,args:null,frame:null,phase:'arguments'};calls.push(item);
  try{
   const args=N.apply(argumentsThunk,undefined,[]);item.args=args;item.phase='calling';
   const value=N.apply(fn,undefined,args);
   if(!item.frame||!item.frame.closed||!item.frame.returned||!N.is(item.frame.value,value))bad('callback-source-call-unmatched');
   return value;
  }finally{if(calls[calls.length-1]!==item)bad('callback-source-call-stack');else calls.pop();}
 }
 function hookLookup(key,read,receiver){
  const site=hookPlans.find(p=>p.key===key),frame=frames[frames.length-1];
  if(!site||!frame||frame.key!==site.ownerKey)fail('callback-source-hook-lookup-unplanned');
  if(hooks.length>=100000)fail('callback-source-hook-limit');
  const token={},item={id:hooks.length,site,frame,fn:read.fn,kind:read.kind,receiver,args:null,returned:false,closed:false,nativeSelection:null,phase:'lookup'};
  hooks.push(item);N.apply(N.mapSet,hookTokens,[token,item]);return token;
 }
 function hookRead(key,value,receiver){intrinsics();return hookLookup(key,nativeHooks.nativeHookRead('useCallback',value),receiver?value:undefined);}
 function hookDefault(key,value){return hookRead(key,nativeHooks.nativeDefault(value),true);}
 function hookValue(key,value){intrinsics();return hookLookup(key,nativeHooks.nativeHookValue('useCallback',value),undefined);}
 function hookCall(key,token,argumentsThunk){
  intrinsics();const item=N.apply(N.mapGet,hookTokens,[token]);
  if(!item||item.site.key!==key||item.phase!=='lookup'||frames[frames.length-1]!==item.frame||typeof argumentsThunk!=='function')fail('callback-source-hook-call-unmatched');
  if(hookFrames.length>=256)fail('callback-source-hook-stack-limit');hookFrames.push(item);item.phase='arguments';
  try{
   item.args=N.apply(argumentsThunk,undefined,[]);if(item.args.length!==2)fail('callback-source-hook-arity');item.phase='calling';
   const value=N.apply(item.fn,item.receiver,item.args);item.value=value;item.returned=true;
   item.nativeSelection=verifySelection(item.id,item.args,value);if(item.nativeSelection===null)bad('callback-source-native-selection-unmatched');
   return value;
  }finally{if(hookFrames[hookFrames.length-1]!==item)bad('callback-source-hook-frame-mismatch');else hookFrames.pop();item.closed=true;item.phase='closed';}
 }
 const hookScope=()=>{const frame=hookFrames[hookFrames.length-1];return frame?.phase==='calling'?frame.id:null;};
 function callback(key,value,captures){
  intrinsics();const plan=callbackPlans.find(p=>p.key===key),frame=frames[frames.length-1];
  if(!plan||!frame||frame.key!==plan.ownerKey||typeof value!=='function'||N.apply(N.mapGet,byCallback,[value])||captures.length!==plan.captures.length){bad('callback-source-literal-unmatched');return value;}
  const found=[];
  for(let i=0;i<captures.length;i++){
   const rest=N.apply(N.mapGet,byRest,[captures[i]]),binding=point(plan.captures[i].binding);
   if(!rest||rest.frame!==frame||rest.binding!==binding){bad('callback-source-capture-unmatched');continue;}
   unchanged(rest);found.push({binding,rest});
  }
  const entry={id:callbacks.length,key,frame,value,captures:found};callbacks.push(entry);N.apply(N.mapSet,byCallback,[value,entry]);return value;
 }
 const origin=value=>N.apply(N.mapGet,byCallback,[value])?.id??null;
 const rest=value=>N.apply(N.mapGet,byRest,[value])?.id??null;
 function report(){
  intrinsics();for(const r of rests)unchanged(r);if(invalid)fail(invalid);if(frames.length||calls.length||hookFrames.length||hooks.some(h=>!h.closed)||invocations.some(f=>!f.closed))fail('callback-source-frame-open');
  return {qualification:'callback-source-and-rest-captures-only',effectsVerified:false,acceptedContract:null,functions:functions.size,
   hooks:hooks.map(h=>({id:h.id,site:h.site.key,invocation:h.frame.id,render:h.frame.render,consumerCall:h.frame.consumerCall,kind:h.kind,propertyEffectsVerified:true,completion:h.returned?'returned':'threw',nativeSelection:h.nativeSelection,arguments:h.args?.map(witness)??null,...(h.returned?{value:witness(h.value)}:{})})),
   invocations:invocations.map(f=>({id:f.id,source:f.key,render:f.render,consumerCall:f.consumerCall,parent:f.parent?.id??null,call:f.call,callVerified:f.verified,completion:f.returned?'returned':'threw',arguments:f.args?.map(witness)??null,...(f.returned?{value:witness(f.value)}:{})})),
   rests:rests.map(r=>({id:r.id,invocation:r.frame.id,binding:r.binding,value:witness(r.value),elements:r.elements.map(witness)})),
   callbacks:callbacks.map(c=>({id:c.id,source:c.key,invocation:c.frame.id,value:witness(c.value),captures:c.captures.map(x=>({binding:x.binding,rest:x.rest.id})),originVerified:c.frame.verified,bodyVerified:false}))};
 }
 return {register,begin,returned,end,call,callback,origin,rest,hookRead,hookDefault,hookValue,hookCall,hookScope,report};
})`;
