import type {ReactContextValueWitness as Witness} from './react-context-runtime.js';
export interface ReactHookHelperReport {
 qualification:'original-hook-helper-calls-only';effectsVerified:false;acceptedContract:null;
 invocations:Array<{id:number;source:string;consumerCall:number|null;render:number|null;consumerCallsBefore:number;callVerified:boolean;bindingsVerified:boolean;callee:Witness;bindings:Witness[];arguments:Witness[]|null;completion:'returned'|'threw';value?:Witness;calls:number[]}>;
 calls:Array<{id:number;source:string;invocation:number;kind:'state'|'effect';hook:string;lookup:string;arguments:Witness[];dependencies:Witness[]|null;callbackOriginVerified:boolean;native:number|null;completion:'returned'|'threw';value?:Witness;selected?:Witness;dispatch?:Witness}>;
}
/** Compiler-marked original function entries and native hook calls. Parameters,
 * setters and effect callbacks retain their original identity and live cells. */
export const reactHookHelperRuntime=String.raw`((plans,N,intrinsics,sameDescriptor,fail,context,states,effects)=>{
 const point=p=>JSON.stringify([p.file,p.sha256,p.start,p.end]),functions=new Map(),frames=[],invocations=[],calls=[],active=[],tokens=new N.WeakMapCtor();let invalid=null;
 const fs=(plans?.functions??[]).map(f=>({...f,key:point(f.source)})),sites=fs.flatMap(f=>f.hooks.map(h=>({...h,key:point(h.call),owner:f.key})));
 const bad=why=>{invalid??=why;};
 function register(key,fn){intrinsics();if(!fs.some(f=>f.key===key)||functions.has(key)||typeof fn!=='function')bad('hook-helper-register');else functions.set(key,fn);}
 function begin(key,fn,bindings){
  intrinsics();const plan=fs.find(f=>f.key===key),source=context.sourceScope(),render=context.renderScope();
  if(!plan||functions.get(key)!==fn||bindings.length!==plan.parameters.length)fail('hook-helper-entry');
  if(invocations.length>=100000||frames.length>=256)fail('hook-helper-limit');
  const matched=!!source&&source.callee===fn&&(plans?.consumers??[]).some(c=>point(c.call)===source.key&&point(c.source)===key);
  const frame={id:invocations.length,key,plan,fn,consumerCall:matched?source.id:null,render:matched?source.render:null,consumerCallsBefore:render.consumerCalls-1,callVerified:matched,bindingsVerified:matched&&bindings.every((v,i)=>N.is(v,source.args[i])),bindings,args:matched?source.args:null,returned:false,closed:false,calls:[]};
  frames.push(frame);invocations.push(frame);return frame;
 }
 function returned(frame,value){intrinsics();if(frames[frames.length-1]!==frame||frame.returned)bad('hook-helper-return');frame.returned=true;frame.value=value;return value;}
 function end(frame){if(frames[frames.length-1]!==frame)bad('hook-helper-frame');else frames.pop();frame.closed=true;}
 function site(key){const p=sites.find(s=>s.key===key);if(!p)fail('helper-hook-unplanned');return p;}
 function token(key,lookup,receiver){
  const p=site(key),owner=frames[frames.length-1];if(!owner||owner.key!==p.owner)fail('helper-hook-owner');
  if(calls.length>=100000)fail('helper-hook-limit');
  const handle={},c={id:calls.length,site:p,owner,lookup,receiver,used:false,returned:false,callback:null,dependency:null,args:[],native:null};calls.push(c);owner.calls.push(c.id);N.apply(N.mapSet,tokens,[handle,c]);return handle;
 }
 function hookValue(key,value){intrinsics();const p=site(key);const read=p.hook?{name:p.hook,...context.nativeHookValue(p.hook,value)}:context.nativeHookIdentify(value,['useEffect','useLayoutEffect','useInsertionEffect']);return token(key,read,undefined);}
 function hookRead(key,value,receiver){intrinsics();const p=site(key);if(!p.hook)fail('helper-hook-read-unknown');return token(key,{name:p.hook,...context.nativeHookRead(p.hook,value)},receiver?value:undefined);}
 function hookDefault(key,value){return hookRead(key,context.nativeDefault(value),true);}
 function literal(key,value){intrinsics();const c=active[active.length-1];if(!c||c.site.key!==key||c.site.kind!=='effect'||c.callback!==null||typeof value!=='function')fail('helper-hook-callback-origin');c.callback=value;return value;}
 function dependencies(key,value){
  intrinsics();const c=active[active.length-1];if(!c||c.site.key!==key||c.site.kind!=='effect'||c.dependency!==null)fail('helper-hook-dependency-origin');
  const ds=N.descriptors(value),keys=N.keys(ds),length=ds.length?.value;
  if(N.prototype(value)!==Array.prototype||!Number.isSafeInteger(length)||length<0||length>10000||keys.length!==length+1||keys[length]!=='length')fail('helper-hook-dependency-shape');
  const values=[];for(let i=0;i<length;i++){const d=ds[i];if(keys[i]!==String(i)||!d||!N.descriptor(d,'value'))fail('helper-hook-dependency-shape');values.push(d.value);}
  c.dependency={value,values,ds,keys};return value;
 }
 function stable(c){const d=c.dependency;if(!d)return;const ds=N.descriptors(d.value),keys=N.keys(ds);if(N.prototype(d.value)!==Array.prototype||keys.length!==d.keys.length||keys.some((k,i)=>k!==d.keys[i]||!sameDescriptor(ds[k],d.ds[k])))bad('helper-hook-dependency-mutated');}
 function hookCall(key,handle,argsThunk){
  intrinsics();const c=N.apply(N.mapGet,tokens,[handle]);if(!c||c.used||c.site.key!==key||frames[frames.length-1]!==c.owner||typeof argsThunk!=='function')fail('helper-hook-token');c.used=true;active.push(c);
  try{
   const args=N.apply(argsThunk,undefined,[]);if(!Array.isArray(args)||args.length>(c.site.kind==='state'?1:2))fail('helper-hook-arguments');c.args=args;
   if(c.site.kind==='effect'&&(args.length!==2||!c.dependency||args[0]!==c.callback||args[1]!==c.dependency.value))fail('helper-hook-effect-arguments');
   const value=N.apply(c.lookup.fn,c.receiver,args);intrinsics();c.value=value;c.returned=true;
   if(c.site.kind==='state'){const link=states.sourceReturn(c.id,value);c.native=link.id;c.selected=link.value;c.dispatch=link.dispatch;}
   else {c.native=effects.sourceReturn(c.id,args,value,c.lookup.name);stable(c);}
   return value;
  }finally{if(active[active.length-1]!==c)bad('helper-hook-active-frame');else active.pop();}
 }
 function report(){
  intrinsics();for(const c of calls)stable(c);if(invalid)fail(invalid);if(frames.length||active.length||invocations.some(f=>!f.closed)||calls.some(c=>!c.used))fail('hook-helper-frame-open');const witness=context.witness;
  return {qualification:'original-hook-helper-calls-only',effectsVerified:false,acceptedContract:null,
   invocations:invocations.map(f=>({id:f.id,source:f.key,consumerCall:f.consumerCall,render:f.render,consumerCallsBefore:f.consumerCallsBefore,callVerified:f.callVerified,bindingsVerified:f.bindingsVerified,callee:witness(f.fn),bindings:f.bindings.map(witness),arguments:f.args?.map(witness)??null,completion:f.returned?'returned':'threw',...(f.returned?{value:witness(f.value)}:{}),calls:f.calls})),
   calls:calls.map(c=>({id:c.id,source:c.site.key,invocation:c.owner.id,kind:c.site.kind,hook:c.lookup.name,lookup:c.lookup.kind,arguments:c.args.map(witness),dependencies:c.dependency?.values.map(witness)??null,callbackOriginVerified:c.callback!==null,native:c.native,completion:c.returned?'returned':'threw',...(c.returned?{value:witness(c.value)}:{}),...(c.site.kind==='state'&&c.returned?{selected:witness(c.selected),dispatch:witness(c.dispatch)}:{})}))};
 }
 return {register,begin,returned,end,hookValue,hookRead,hookDefault,hookCall,literal,dependencies,report,stateScope:()=>{const c=active[active.length-1];return c?.site.kind==='state'?c.id:null;},effectScope:()=>{const c=active[active.length-1];return c?.site.kind==='effect'?c.id:null;}};
})`;
