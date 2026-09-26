import test from 'node:test';
import assert from 'node:assert/strict';
import {reactCallbackFactoryRuntime} from './react-callback-factory-runtime.js';
import type {ReactCallbackFactories} from './react-callback-factories.js';
const point=(start:number)=>({file:'factory.mjs',sha256:'hash',start,end:start+1}),key=(p:ReturnType<typeof point>)=>JSON.stringify([p.file,p.sha256,p.start,p.end]);
const N={WeakMapCtor:WeakMap,descriptors:Object.getOwnPropertyDescriptors,descriptor:Object.getOwnPropertyDescriptor,prototype:Object.getPrototypeOf,keys:Reflect.ownKeys,apply:Reflect.apply,mapGet:WeakMap.prototype.get,mapSet:WeakMap.prototype.set,is:Object.is,define:Object.defineProperty};
const same=(a:PropertyDescriptor,b:PropertyDescriptor)=>['value','get','set','writable','enumerable','configurable'].every(k=>Object.is((a as any)[k],(b as any)[k]));
function setup(named=false){
 const source=point(1),callback=point(2),call=point(3),argument=point(4),object=point(5),naming={call:point(6),helper:point(7),nativeAlias:point(8),nativeName:'native',helperName:'nameFn',name:'created'};
 const plans:ReactCallbackFactories={consumers:[{call,source,arguments:[argument,object]}],functions:[{source,name:'factory',returned:point(9),callback,...(named?{naming}:{}),parameters:[{index:0,object:false,defaultObject:false,bindings:[{source:point(10),name:'handler'}]},{index:1,object:true,defaultObject:true,bindings:[{source:point(11),name:'enabled',key:'enabled',default:{kind:'boolean',value:true}}]}]}],literals:[{source:argument,call,kind:'function'},{source:object,call,kind:'object'}]};
 const ids=new Map<unknown,number>(),context={id:0,key:key(call),render:0,callee:null as unknown,args:[] as unknown[]};
 const api=Function('return '+reactCallbackFactoryRuntime)()(plans,N,()=>{},same,(s:string)=>{throw Error(s);},()=>context,()=>({consumerCalls:1}),(v:unknown)=>{if(v===null||['undefined','boolean','string','number'].includes(typeof v))return {kind:v===null?'null':typeof v,...(v===undefined?{}:{value:v})};if(!ids.has(v))ids.set(v,ids.size);return {kind:typeof v,identity:ids.get(v)};});
 let native=Object.defineProperty;const nameFn=(fn:Function,label:string)=>native(fn,'name',{value:label,configurable:true});if(named)api.namingHelper(key(naming.helper),nameFn,()=>native);
 function factory(handler:(value:boolean)=>unknown,{enabled=true}={}){
  const frame=api.begin(key(source),factory,[handler,enabled]);try{let result=api.literal(key(callback),function created(){const value=handler(enabled);enabled=!enabled;return value;});if(named)result=api.name(key(naming.call),nameFn,result,'created');return api.returned(frame,result);}finally{api.end(frame);}
 }
 context.callee=factory;api.register(key(source),factory);
 return {api,plans,context,factory,argument:key(argument),object:key(object),naming,key,changeNative(value:typeof Object.defineProperty){native=value;}};
}

test('ordinary factory captures preserve native identity and live parameter cells with default and supplied options',()=>{
 for(const named of [false,true])for(const supplied of [false,true]){
  const s=setup(named),values:boolean[]=[],handler=s.api.argument(s.argument,(value:boolean)=>{values.push(value);return value;});
  const options=supplied?s.api.argument(s.object,{enabled:false}):undefined;s.context.args=supplied?[handler,options]:[handler];
  const callback=s.factory(handler,options);assert.equal(callback.name,'created');assert.equal(callback(),!supplied);assert.equal(callback(),supplied);assert.deepEqual(values,[!supplied,supplied]);
  const report=s.api.report();assert.equal(report.invocations.length,1);assert(report.invocations[0].callVerified&&report.invocations[0].bindingsVerified);assert.equal(report.invocations[0].bindingPhase,'function-entry');assert.deepEqual(report.invocations[0].bindings[1],{kind:'boolean',value:!supplied});
  assert(report.callbacks[0].originVerified&&report.callbacks[0].namingVerified);assert.equal(report.callbacks[0].bodyVerified,false);assert.equal(report.callbacks[0].capturesVerified,false);assert.deepEqual(report.callbacks[0].value,report.invocations[0].value);assert.equal(report.effectsVerified,false);assert.equal(report.acceptedContract,null);
 }
});

test('unknown options retain original getters/errors without extra reflection or a binding qualification',()=>{
 const s=setup(),events:string[]=[],problem={},handler=()=>{throw problem;};
 const options=new Proxy({},{get(_t,k){events.push(String(k));return false;},getPrototypeOf(){throw Error('reflected');},ownKeys(){throw Error('reflected');},getOwnPropertyDescriptor(){throw Error('reflected');}});
 s.context.args=[handler,options];const callback=s.factory(handler,options);assert.deepEqual(events,['enabled']);assert.throws(callback,error=>error===problem);
 const report=s.api.report();assert.equal(report.invocations[0].callVerified,true);assert.equal(report.invocations[0].bindingsVerified,false);assert.deepEqual(events,['enabled']);assert.equal(report.callbacks[0].bodyVerified,false);
 const thrown=setup(),original=new Proxy({},{get(){throw problem;}});thrown.context.args=[handler,original];assert.throws(()=>thrown.factory(handler,original),error=>error===problem);assert.equal(thrown.api.report().invocations.length,0);
});

test('changed fresh options and naming aliases fail without invoking hostile metadata or naming behavior',()=>{
 for(const attack of ['getter','prototype','value']){
  const s=setup(),options=s.api.argument(s.object,{enabled:true}),handler=()=>{};let reads=0;
  if(attack==='getter')Object.defineProperty(options,'enabled',{get(){reads++;return true;}});
  if(attack==='prototype')Object.setPrototypeOf(options,{});
  if(attack==='value')options.enabled=false;
  s.context.args=[handler,options];s.factory(handler,options);assert.throws(()=>s.api.report(),/factory-argument-object-mutated/,attack);assert.equal(reads,attack==='getter'?1:0);
 }
 const s=setup(true);let calls=0;s.changeNative(new Proxy(Object.defineProperty,{apply(){calls++;throw Error('called');},get(){calls++;throw Error('read');}}));const handler=()=>{};s.context.args=[handler];assert.throws(()=>s.factory(handler),/factory-naming-call/);assert.equal(calls,0);
});
