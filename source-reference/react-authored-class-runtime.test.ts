import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {reactAuthoredClassRuntime} from './react-authored-class-runtime.js';

const target={module:'component.mjs',sourceSha256:'pinned-source',span:{start:1,end:300},exportName:'Button'};
const plan={target,render:{file:target.module,sha256:target.sourceSha256,start:100,end:290},name:'Button',qualification:'original-class-render-boundary-only',effectsVerified:false,acceptedContract:null};
const key=JSON.stringify([target.module,target.sourceSha256,target.span.start,target.span.end]);

function run(source:string){
 const context={};
 runInNewContext(`
 const N={apply:Reflect.apply,is:Object.is,keys:Reflect.ownKeys,descriptors:Object.getOwnPropertyDescriptors,
  descriptor:Object.getOwnPropertyDescriptor,prototype:Object.getPrototypeOf,WeakMapCtor:WeakMap,
  mapGet:WeakMap.prototype.get,mapSet:WeakMap.prototype.set};
 const ids=new Map();let next=0,frame=0,current=null,reads=0;const props=new WeakMap(),elements=new WeakMap();
 const witness=value=>{if(value===null)return {kind:'null',value:null};const kind=typeof value;
  if(kind==='undefined')return {kind};if(['string','number','boolean'].includes(kind))return {kind,value};
  if(!ids.has(value))ids.set(value,next++);return {kind,identity:ids.get(value)};};
 const sameDescriptor=(a,b)=>!!a&&!!b&&['value','get','set','writable','enumerable','configurable'].every(k=>Object.is(a[k],b[k]));
 const graph={currentId:()=>current,invoke(fn,input,call){const old=current;current=frame++;try{return call();}finally{current=old;}}};
 const api=(${reactAuthoredClassRuntime})([${JSON.stringify(plan)}],N,()=>{},sameDescriptor,reason=>{throw Error(reason)},witness,props,elements,graph);
 class Component{constructor(input){this.props=input;}}class PureComponent extends Component{}
 api.registerBases(Component,PureComponent);
 const input=value=>{props.set(value,{kind:'jsx',descriptors:N.descriptors(value)});return value;};
 const element=(value,owner)=>{const result={type:'button',props:input(value),_owner:owner};elements.set(result,{descriptors:N.descriptors(result),props:value,origin:props.get(value)});return result;};
 const register=value=>api.registerClass(${JSON.stringify(key)},value);
 const resolve=(type,from,to=from)=>api.finishClassProps(api.beginClassProps(type,from),to);
 globalThis.fixture={api,Component,PureComponent,input,element,register,resolve,props,elements,graph};
 `,context);
 return JSON.parse(runInNewContext(`JSON.stringify((()=>{const {api,Component,PureComponent,input,element,register,resolve,props,elements,graph}=fixture;${source}})())`,context));
}

test('class calls retain original identity, receiver and factory fields independently of resolved defaults',()=>{
 const result=run(`
 let inspections=0;const opaque={get nested(){inspections++;throw Error('opaque read');}};
 const original=input({children:opaque,missing:undefined});let owner;
 class Button extends Component{render(){return element({children:this.props.children,size:this.props.size},owner);}}
 const before=Function.prototype.toString.call(Button),renderBefore=Function.prototype.toString.call(Button.prototype.render);
 register(Button);const effective=resolve(Button,original,{children:opaque,missing:undefined,size:'small'});
 const instance=api.constructed(Button,effective,new Button(effective));owner={stateNode:instance,type:Button,memoizedProps:original};
 const output=api.invoke(instance,instance.render),report=api.report();
 return {inspections,same:output.props.children===opaque,host:api.verifyHost(0,owner),before,after:Function.prototype.toString.call(Button),renderBefore,renderAfter:Function.prototype.toString.call(Button.prototype.render),report};
 `);
 assert.equal(result.inspections,0);assert.equal(result.same,true);assert.equal(result.host,true);
 assert.equal(result.before,result.after);assert.equal(result.renderBefore,result.renderAfter);
 const call=result.report.calls[0];assert.equal(call.current,true);assert.equal(call.effectsVerified,false);assert.equal(call.graphRender,0);
 assert.deepEqual(call.factoryFields.map((entry:any)=>entry[0]),['children','missing']);
 assert.deepEqual(call.factoryFields[1][1],{kind:'undefined'});
 assert.deepEqual(call.fields.map((entry:any)=>entry[0]),['children','missing','size']);
 assert.equal(result.report.resolvers[0].valuesPreserved,false);assert.equal(result.report.resolvers[0].defaultSemanticsVerified,false);
});

test('unknown instances, constructors and owners are passed through without proxy inspection',()=>{
 const result=run(`
 let traps=0;const unknown=new Proxy({}, {get(){traps++;throw Error('get');},getPrototypeOf(){traps++;throw Error('prototype');},ownKeys(){traps++;throw Error('keys');},getOwnPropertyDescriptor(){traps++;throw Error('descriptor');}});
 const unknownCtor=new Proxy(function(){},{get(){traps++;throw Error('get');},getPrototypeOf(){traps++;throw Error('prototype');},getOwnPropertyDescriptor(){traps++;throw Error('descriptor');}});
 const same=api.invoke(unknown,function(){return this===unknown;});
 const constructed=api.constructed(unknownCtor,unknown,unknown)===unknown;
 const resolved=api.finishClassProps(api.beginClassProps(unknownCtor,unknown),unknown)===unknown;
 return {same,constructed,resolved,host:api.verifyHost(999,unknown),traps,report:api.report()};
 `);
 assert.deepEqual([result.same,result.constructed,result.resolved,result.host,result.traps],[true,true,true,true,0]);
 assert.equal(result.report.calls.length,0);
});

test('host join requires exact original owner, class instance, constructor and factory input',()=>{
 const result=run(`
 const original=input({children:'text'});let owner;class Button extends Component{render(){return element({children:this.props.children},owner);}}
 register(Button);const effective=resolve(Button,original,{children:'text',size:'small'}),instance=api.constructed(Button,effective,new Button(effective));
 owner={stateNode:instance,type:Button,memoizedProps:original};api.invoke(instance,instance.render);
 let traps=0;const proxy=new Proxy(owner,{getOwnPropertyDescriptor(){traps++;throw Error('inspected');}});
 const proxyResult=api.verifyHost(0,proxy),copied=api.verifyHost(0,{...owner}),good=api.verifyHost(0,owner);
 owner.memoizedProps=effective;const wrongInput=api.verifyHost(0,owner);owner.memoizedProps=original;
 owner.stateNode={};const wrongInstance=api.verifyHost(0,owner);owner.stateNode=instance;
 owner.type=Component;const wrongType=api.verifyHost(0,owner);
 return {traps,proxyResult,copied,good,wrongInput,wrongInstance,wrongType};
 `);
 assert.deepEqual(result,{traps:0,proxyResult:false,copied:false,good:true,wrongInput:false,wrongInstance:false,wrongType:false});
});

test('changes to original factory input invalidate a completed class boundary',()=>{
 const result=run(`
 const original=input({children:'original'});let owner;class Button extends Component{render(){return element({children:this.props.children},owner);}}
 register(Button);const effective=resolve(Button,original,{children:'original'}),instance=api.constructed(Button,effective,new Button(effective));
 owner={stateNode:instance,type:Button,memoizedProps:original};api.invoke(instance,instance.render);
 original.children='changed';return {current:api.report().calls[0].current,host:api.verifyHost(0,owner)};
 `);
 assert.deepEqual(result,{current:false,host:false});
});

test('getter props and changed render identities refuse without executing the getter',()=>{
 assert.throws(()=>run(`
 const original=input({children:'original'});class Button extends Component{render(){return element({},{});}}register(Button);
 const effective=resolve(Button,original),instance=api.constructed(Button,effective,new Button(effective));
 Object.defineProperty(instance,'props',{get(){throw Error('getter ran');}});api.invoke(instance,instance.render);return {};
 `),/authored-class-render-props-accessor/);
 assert.throws(()=>run(`
 const original=input({});class Button extends Component{render(){return element({},{});}}register(Button);
 const effective=resolve(Button,original),instance=api.constructed(Button,effective,new Button(effective));
 instance.render=()=>element({},{});api.invoke(instance,instance.render);return {};
 `),/authored-class-render-identity-changed/);
});

test('only the original registered class can establish a constructor receipt',()=>{
 assert.throws(()=>run(`
 class Button extends Component{render(){return element({},{});}}register(Button);const original=input({});
 api.constructed(Button,original,{props:original});return {};
 `),/authored-class-constructed-instance-changed/);
 assert.throws(()=>run(`
 class Button extends Component{render(){return element({},{});}}register(Button);
 Button.prototype.render=function replacement(){return element({},{});};const original=input({});
 api.constructed(Button,original,new Button(original));return {};
 `),/authored-class-constructor-changed/);
});

test('unowned return values refuse and original render exceptions retain identity',()=>{
 assert.throws(()=>run(`
 const original=input({});class Button extends Component{render(){return {type:'button',props:{}};}}register(Button);
 const effective=resolve(Button,original),instance=api.constructed(Button,effective,new Button(effective));api.invoke(instance,instance.render);return {};
 `),/authored-class-render-output-origin-unproved/);
 const result=run(`
 const error={message:'original'},original=input({});class Button extends Component{render(){throw error;}}register(Button);
 const effective=resolve(Button,original),instance=api.constructed(Button,effective,new Button(effective));let same=false;
 try{api.invoke(instance,instance.render);}catch(caught){same=caught===error;}return {same,report:api.report()};
 `);
 assert.equal(result.same,true);assert.equal(result.report.calls[0].completion,'threw');
});

test('state initialization keeps exact native instance origin without inspecting state',()=>{
 const result=run(`
 let stateReads=0;const original=input({percent:25});let owner;
 class Button extends Component{
  constructor(props){super(props);this._mounted=true;this._mounted=true;this.state={percentNumber:this.props.percent};}
  render(){return element({children:this.props.percent},owner);}
 }
 const before=Function.prototype.toString.call(Button),renderBefore=Function.prototype.toString.call(Button.prototype.render);
 register(Button);const effective=resolve(Button,original),instance=api.constructed(Button,effective,new Button(effective));
 Object.defineProperty(instance.state,'opaque',{get(){stateReads++;throw Error('unrequested state read');}});
 owner={stateNode:instance,type:Button,memoizedProps:original};const output=api.invoke(instance,instance.render),report=api.report();
 return {stateReads,percent:instance.state.percentNumber,sameOutput:output.props.children===25,host:api.verifyHost(0,owner),
  before,after:Function.prototype.toString.call(Button),renderBefore,renderAfter:Function.prototype.toString.call(Button.prototype.render),report};
 `);
 assert.equal(result.stateReads,0);assert.equal(result.percent,25);assert.equal(result.sameOutput,true);assert.equal(result.host,true);
 assert.equal(result.before,result.after);assert.equal(result.renderBefore,result.renderAfter);
 assert.equal(result.report.effectsVerified,false);assert.equal(result.report.calls[0].effectsVerified,false);
 assert.equal(result.report.calls[0].current,true);
});

test('accessor-bearing constructor input refuses before constructor or getter execution',()=>{
 const result=run(`
 let reads=0,constructed=0;const original=input({get percent(){reads++;throw Error('getter ran');}});
 class Button extends Component{constructor(props){super(props);constructed++;this.state={percentNumber:this.props.percent};}render(){return element({},{});}}
 register(Button);let reason;
 try{const effective=resolve(Button,original);api.constructed(Button,effective,new Button(effective));}catch(error){reason=error.message;}
 return {reads,constructed,reason,report:api.report()};
 `);
 assert.equal(result.reads,0);assert.equal(result.constructed,0);assert.match(result.reason,/authored-class-props-not-data/);
 assert.equal(result.report.constructions.length,0);assert.equal(result.report.calls.length,0);
});
