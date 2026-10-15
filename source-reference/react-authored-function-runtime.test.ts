import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {reactAuthoredFunctionRuntime} from './react-authored-function-runtime.js';
const point={file:'surface.js',sha256:'source',start:0,end:99};
const plan={source:point,render:point,binding:'Control',qualification:'original-function-render-boundary-only',effectsVerified:false,acceptedContract:null};
const key=JSON.stringify([point.file,point.sha256,point.start,point.end]);
function run(source:string){
 return JSON.parse(runInNewContext(`JSON.stringify((()=>{
  const N={apply:Reflect.apply,is:Object.is,keys:Reflect.ownKeys,descriptors:Object.getOwnPropertyDescriptors,descriptor:Object.getOwnPropertyDescriptor,prototype:Object.getPrototypeOf,WeakMapCtor:WeakMap,mapGet:WeakMap.prototype.get,mapSet:WeakMap.prototype.set};
  const ids=new Map();let next=0;const props=new WeakMap(),elements=new WeakMap();
  const witness=v=>{if(v===null)return {kind:'null',value:null};const kind=typeof v;if(['undefined','string','number','boolean'].includes(kind))return {kind,...(kind==='undefined'?{}:{value:v})};if(!ids.has(v))ids.set(v,next++);return {kind,identity:ids.get(v)};};
  const same=(a,b)=>!!a&&!!b&&['value','get','set','writable','enumerable','configurable'].every(k=>Object.is(a[k],b[k]));
  const api=(${reactAuthoredFunctionRuntime})([${JSON.stringify(plan)}],N,()=>{},same,r=>{throw Error(r)},witness,props,elements,{currentId:()=>0});
  const input=v=>{props.set(v,{descriptors:N.descriptors(v)});return v;};
  const element=(v,owner)=>{const p=input(v),e={props:p,type:'section',_owner:owner};elements.set(e,{descriptors:N.descriptors(e),props:p,origin:props.get(p)});return e;};
  const register=(fn,read)=>api.register(${JSON.stringify(key)},fn,read);
  ${source}
 })())`));
}
test('plain function boundary preserves original values and refuses mutated props or binding',()=>{
 const r=run(`let traps=0;const opaque={get value(){traps++;throw Error('opaque read');}};const p=input({children:opaque}),owner={memoizedProps:p};
 let Control=props=>element({children:props.children},owner);owner.type=Control;register(Control,()=>Control);
 const output=api.invoke(Control,p,()=>Control(p)),before=api.report(),valid=api.verifyHost(0,owner);
 p.changed=true;const changedProps=api.report().calls[0].current;delete p.changed;
 Control=()=>null;const changedBinding=api.report().calls[0].current;
 return {same:output.props.children===opaque,traps,valid,changedProps,changedBinding,before};`);
 assert.deepEqual([r.same,r.traps,r.valid,r.changedProps,r.changedBinding],[true,0,true,false,false]);assert.equal(r.before.calls[0].current,true);assert.equal(r.before.calls[0].effectsVerified,false);
});
test('unknown functions pass through without reflection and foreign host owners refuse',()=>{
 const r=run(`let traps=0;const foreign=new Proxy(function(){},{get(){traps++;throw Error('get');},getPrototypeOf(){traps++;throw Error('prototype');},ownKeys(){traps++;throw Error('keys');}});
 const unknown=api.invoke(foreign,{},()=>17),p=input({}),owner={memoizedProps:p};let Control=props=>element({},owner);owner.type=Control;register(Control,()=>Control);api.invoke(Control,p,()=>Control(p));
 const proxy=new Proxy(owner,{getOwnPropertyDescriptor(){traps++;throw Error('owner read');}});
 return {unknown,traps,copied:api.verifyHost(0,{...owner}),proxy:api.verifyHost(0,proxy),valid:api.verifyHost(0,owner)};`);
 assert.deepEqual(r,{unknown:17,traps:0,copied:false,proxy:false,valid:true});
});
