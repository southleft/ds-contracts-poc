import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reactRefRuntime} from './react-ref-runtime.js';
import {instrumentReactContextAdapter} from './react-context-adapter.js';
const N={WeakMapCtor:WeakMap,descriptors:Object.getOwnPropertyDescriptors,descriptor:Object.getOwnPropertyDescriptor,prototype:Object.getPrototypeOf,keys:Reflect.ownKeys,apply:Reflect.apply,mapGet:WeakMap.prototype.get,mapSet:WeakMap.prototype.set,is:Object.is};
function runtime(){const ids=new Map<unknown,number>();return Function('return '+reactRefRuntime)()([],N,()=>{},(s:string)=>{throw Error(s);},()=>({render:0,renderSource:null,consumerCalls:0}),(v:unknown)=>{if(v===null||['undefined','boolean','string','number'].includes(typeof v))return {kind:v===null?'null':typeof v,...(v===undefined?{}:{value:v})};if(!ids.has(v))ids.set(v,ids.size);return {kind:typeof v,identity:ids.get(v)};},{});}

test('native ref evidence retains allocation and initial identity while current changes, without inspecting opaque values',()=>{
 let traps=0;const opaque=new Proxy({}, {get(){traps++;throw Error('get');},getOwnPropertyDescriptor(){traps++;throw Error('descriptor');},ownKeys(){traps++;throw Error('keys');},getPrototypeOf(){traps++;throw Error('prototype');}});
 const api=runtime(),ref=api.state({current:opaque});assert.equal(api.mount(ref),ref);ref.current=()=>{};assert.equal(api.update(ref),ref);
 const report=api.report();assert.equal(report.effectsVerified,false);assert.equal(report.acceptedContract,null);assert.equal(report.states,1);
 assert.deepEqual(report.invocations.map((i:any)=>i.phase),['mount','update']);assert.equal(report.invocations[0].state,report.invocations[1].state);
 assert.deepEqual(report.invocations[0].initial,report.invocations[1].initial);assert.notDeepEqual(report.invocations[0].current,report.invocations[1].current);assert.equal(traps,0);
 for(const attack of ['unknown','getter','extra','prototype','unmounted','repeat-mount']){
  const api=runtime(),ref=api.state({current:opaque});if(attack!=='unmounted')api.mount(ref);
  if(attack==='getter')Object.defineProperty(ref,'current',{get(){traps++;return opaque;}});
  if(attack==='extra')ref.extra=true;
  if(attack==='prototype')Object.setPrototypeOf(ref,opaque);
  if(attack==='repeat-mount')api.mount(ref);else api.update(attack==='unknown'?opaque:ref);
  assert.throws(()=>api.report(),/ref-(?:state-unregistered|state-shape|update-before-mount|mount-repeated)/,attack);
 }
 assert.equal(traps,0);
});

test('native ref adapter refuses changed allocation and any missing or changed update dispatcher site',()=>{
 const source=readFileSync('node_modules/react-dom/cjs/react-dom-client.development.js','utf8');
 const result=instrumentReactContextAdapter(source,'forward-ref');assert.equal(result.split('.refUpdate(').length-1,4);assert.equal(result.split('.refState(').length-1,1);assert.equal(result.split('.refMount(').length-1,1);
 assert.throws(()=>instrumentReactContextAdapter(source.replace('initialValue = { current: initialValue };','initialValue = { other: initialValue };'),'forward-ref'),/callback-adapter-body-unmatched:mountRef/);
 assert.throws(()=>instrumentReactContextAdapter(source.replace('return updateWorkInProgressHook().memoizedState;','return otherState;'),'forward-ref'),/ref-adapter-update-unmatched/);
});

test('ref hook lookup refuses replaced native exports and unknown receivers before getters or proxy traps',async()=>{
 const {reactContextRuntime}=await import('./react-context-runtime.js');let traps=0;
 const opaque=new Proxy({}, {get(){traps++;throw Error('get');},ownKeys(){traps++;throw Error('keys');},getOwnPropertyDescriptor(){traps++;throw Error('descriptor');},getPrototypeOf(){traps++;throw Error('prototype');}});
 const same=(a:PropertyDescriptor,b:PropertyDescriptor)=>['value','get','set','writable','enumerable','configurable'].every(k=>Object.is((a as any)[k],(b as any)[k]));
 for(const attack of ['unknown','default','getter','replacement']){
  const useContext=()=>{},useRef=()=>{},exports={useContext,useRef};
  const api=Function('return '+reactContextRuntime)()(N,()=>{},same,(s:string)=>{throw Error(s);},[],[],[],[],[],()=>{},undefined,undefined,()=>{});api.hook(useContext,exports);
  assert.equal(api.nativeHookRead('useRef',exports).fn,useRef);
  if(attack==='getter')Object.defineProperty(exports,'useRef',{configurable:true,get(){traps++;return useRef;}});
  if(attack==='replacement')exports.useRef=new Proxy(useRef,{get(){traps++;throw Error('get');},apply(){traps++;throw Error('apply');}});
  assert.throws(()=>attack==='default'?api.nativeDefault(opaque):api.nativeHookRead('useRef',attack==='unknown'?opaque:exports),/origin-unproved|exports-mutated/);
 }
 assert.equal(traps,0);
});
