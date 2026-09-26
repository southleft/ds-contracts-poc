import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {transform} from 'esbuild';
import {readReactElementCreationSites,reactElementCreationHook} from './react-element-creation.js';
import {readReactElementInvocationPlans,transformReactElementSource,type ReactElementInvocation} from './react-element-invocation.js';

function source(text:string){
  const file='/source.mjs',sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),sites=readReactElementCreationSites(text,file,'source.mjs'),plans=readReactElementInvocationPlans(sf,sites);
  return {sites,plans,code:transformReactElementSource(sf,sites.map((s,index)=>({...s,index})),plans.map((p,index)=>({...p,index})))};
}

test('only simple synchronous functions receive invocation brackets',()=>{
  const result=source(`import {jsx} from 'react/jsx-runtime';
export const simple=(props,ref)=>jsx('button',{...props,ref});
export const defaults=(props={})=>jsx('button',{...props});
export const destructured=({children})=>jsx('button',{children});
export const rest=(...props)=>jsx('button',{...props});
export const asyncFn=async props=>jsx('button',{...props});
export function* generator(props){return jsx('button',{...props});}
export function hoisted(props){function inner(){};return jsx('button',{...props});}
export function args(props){void arguments;return jsx('button',{...props});}
export function directEval(props){eval('props');return jsx('button',{...props});}`);
  assert.equal(result.sites.length,9);assert.equal(result.plans.length,1);assert.deepEqual(result.plans[0].parameters.map(p=>p.name),['props','ref']);
});

test('bracketing preserves function names, lengths, this, exception identity and finally return precedence',async()=>{
  const text=`import {jsx} from 'react/jsx-runtime';
const input=value=>(globalThis.__DSC_ELEMENT_CREATION?.literal(value),value);
const C=function named(props){'use strict';if(props.fail)throw props.fail;return jsx(this.tag,{children:props.children});};
const arrow=(props,ref)=>jsx('span',{...props,ref});
const Overridden=props=>{try{return jsx('button',{children:'first'});}finally{return jsx('button',{children:props.children});}};
const err={message:'original'};let caught;try{C.call({tag:'div'},input({fail:err}));}catch(e){caught=e;}
const one=C.call({tag:'div'},input({children:'original'})),two=arrow(input({children:'second'}),null),three=Overridden(input({children:'final'}));
globalThis.result={names:[C.name,arrow.name,Overridden.name],lengths:[C.length,arrow.length,Overridden.length],sameError:caught===err,tag:one.type,labels:[one.props.children,two.props.children,three.props.children]};
globalThis.elements=[one,two,three];`;
  const observed=source(text),owner={};const results=[];
  for(const instrumented of [false,true]){
    const output=await transform(instrumented?observed.code:text,{format:'cjs',loader:'js'});
    const factory=(type:unknown,props:unknown)=>({type,props,_owner:owner});
    const context={require:()=>({jsx:factory}),module:{exports:{}},exports:{}};
    if(instrumented){runInNewContext(reactElementCreationHook(observed.sites,observed.plans),context);runInNewContext("globalThis.__DSC_ELEMENT_CREATION.register(require().jsx,require().jsx)",context);}
    runInNewContext(output.code,context);results.push(JSON.parse(runInNewContext('JSON.stringify(result)',context)));
    if(instrumented){
      const records=JSON.parse(runInNewContext('JSON.stringify(elements.map(e=>globalThis.__DSC_ELEMENT_CREATION.readInvocation({memoizedProps:e.props,type:e.type,_debugOwner:e._owner})))',context));
      assert(records.every((r:{status:string})=>r.status==='observed'));assert(records.every((r:{effectsVerified:boolean})=>r.effectsVerified===false));
    }
  }
  assert.deepEqual(results[0],results[1]);assert.deepEqual(results[0],{names:['named','arrow','Overridden'],lengths:[1,2,1],sameError:true,tag:'div',labels:['original','second','final']});
});

test('invocation records reject changed inputs, unreturned results and exceptions without reading opaque children',()=>{
  const site={module:'source.mjs',sourceSha256:'fixture',span:{start:20,end:30},functionSpan:{start:0,end:40},factory:'jsx' as const};
  const plan={module:site.module,sourceSha256:site.sourceSha256,span:site.functionSpan,parameters:[{name:'props',start:1,end:6}]};
  const context={};runInNewContext(reactElementCreationHook([site],[plan]),context);
  const output:{reads:number;results:Array<{mode:string;report:ReactElementInvocation}>}=JSON.parse(runInNewContext(`JSON.stringify((()=>{
    const api=globalThis.__DSC_ELEMENT_CREATION,owner={};let reads=0;
    const factory=(type,props)=>({type,props,_owner:owner});api.register(factory,factory);
    const opaque={get nested(){reads++;throw Error('opaque inspected');}};
    const results=[];
    for(const mode of ['same','changed','later-change','not-returned','thrown','accessor','numeric']){
      const input=mode==='accessor'?{get children(){reads++;throw Error('input getter');}}:{children:opaque,minusZero:-0,nan:NaN,positive:Infinity,negative:-Infinity};
      // This VM fixture explicitly registers its freshly constructed input.
      api.literal(input);
      const frame=api.enter(0,[input]);const element=api.call(0,factory,undefined,['button',{children:opaque}]);
      if(mode==='changed')input.extra=true;
      api.returned(frame,mode==='not-returned'?null:element);if(mode==='thrown')api.thrown(frame);api.leave(frame);
      if(mode==='later-change')input.children='later';
      const report=api.readInvocation({memoizedProps:element.props,type:element.type,_debugOwner:owner});results.push({mode,report});
    }
    return {reads,results};
  })())`,context));
  assert.equal(output.reads,0);
  const reports=new Map(output.results.map(r=>[r.mode,r.report]));
  const observed=(mode:string)=>{const r=reports.get(mode)!;assert.equal(r.status,'observed');if(r.status!=='observed')throw Error('expected observation');return r;};
  const refused=(mode:string)=>{const r=reports.get(mode)!;assert.equal(r.status,'refused');if(r.status!=='refused')throw Error('expected refusal');return r.reason;};
  assert.equal(observed('same').childrenIdentity,'same-value');assert.equal(observed('same').effectsVerified,false);
  for(const mode of ['changed','later-change'])assert.equal(refused(mode),'element-invocation-input-changed');
  for(const mode of ['not-returned','thrown'])assert.equal(refused(mode),'element-invocation-result-not-returned');
  assert.equal(refused('accessor'),'element-invocation-input-not-data');
  assert.deepEqual(observed('numeric').input.slice(1).map(p=>p[1].representation),['negative-zero','nan','positive-infinity','negative-infinity']);
});

async function compareClosures(text:string){
  // Manual fixture calls have no React entry. Register only the fresh input
  // literals explicitly passed through this helper, never an unknown object.
  text="const input=value=>(globalThis.__DSC_ELEMENT_CREATION?.literal(value),value);\n"+text;
  const observation=source(text),runs=[];
  for(const instrumented of [false,true]){
    const output=await transform(instrumented?observation.code:text,{format:'cjs',loader:'js'});
    const owner={},factory=(type:unknown,props:unknown)=>({type,props,_owner:owner});
    const context={require:()=>({jsx:factory}),module:{exports:{}},exports:{}};
    if(instrumented){runInNewContext(reactElementCreationHook(observation.sites,observation.plans),context);runInNewContext('globalThis.__DSC_ELEMENT_CREATION.register(require().jsx,require().jsx)',context);}
    runInNewContext(output.code,context);
    runs.push({result:JSON.parse(runInNewContext('JSON.stringify(result)',context)),
      ...(instrumented?{records:JSON.parse(runInNewContext('JSON.stringify(elements.map(e=>__DSC_ELEMENT_CREATION.readInvocation({memoizedProps:e.props,type:e.type,_debugOwner:e._owner})))',context)) as ReactElementInvocation[]}:{}),
    });
  }
  assert.deepEqual(runs[0].result,runs[1].result);
  const records=runs[1].records!;
  assert(records.every(r=>r.status==='observed'));
  return {result:runs[0].result,observation,records:records.map(r=>{if(r.status!=='observed')throw Error('expected observation');return r;})};
}

test('closure values are captured at selected reads for each factory instance, without eager TDZ reads',async()=>{
  const run=await compareClosures(`import {jsx} from 'react/jsx-runtime';
const make=(node)=>{
 const render=(props)=>jsx(props.other?unused:node,{...props});
 const element=render(input({children:'ok',other:false}));
 const unused='unread';return element;
};
const one=make('button'),two=make('span');globalThis.elements=[one,two];
globalThis.result=elements.map(e=>[e.type,e.props.children]);`);
  assert.deepEqual(run.result,[['button','ok'],['span','ok']]);
  const values=run.records.map(r=>r.closureReads.map(v=>({name:r.function.bindingReads![v.read].name,...v.value})));
  assert.deepEqual(values.map(v=>v.filter(x=>x.name==='node').map(x=>x.value)),[['button'],['span']]);
  assert(values.every(v=>!v.some(x=>x.name==='unused')));
  assert(run.records.every(r=>r.effectsVerified===false));
});

test('free typeof, property receivers, shorthand values and local shadows preserve their evaluation',async()=>{
  const run=await compareClosures(`import {jsx} from 'react/jsx-runtime';
const token='captured',obj={tag:'section',method(){return this.tag;}};
const C=props=>{const local=props.tag;let seen;{const token='shadow';seen=token;}
 return jsx(obj.method(),{...props,token,seen,local,missing:typeof (notDeclared)});};
const element=C(input({tag:'aside',children:'content'}));globalThis.elements=[element];
globalThis.result={tag:element.type,...element.props};`);
  assert.deepEqual(run.result,{tag:'aside',children:'content',token:'captured',seen:'shadow',local:'aside',missing:'undefined'});
  const reads=run.records[0].closureReads.map(r=>({name:run.records[0].function.bindingReads![r.read].name,...r.value}));
  assert.equal(reads.filter(r=>r.name==='token').length,1);
  assert.equal(reads.find(r=>r.name==='token')!.value,'captured');
  assert.equal(reads.find(r=>r.name==='notDeclared')!.value,'undefined');
  assert(!reads.some(r=>['props','local','seen','method','tag'].includes(r.name)));
});

test('closure observation preserves updates and assignment references and identifies effects without approving them',async()=>{
  const run=await compareClosures(`import {jsx} from 'react/jsx-runtime';
let target='before',counter=0;const state={};
const C=props=>{
 target='after';counter++;({target}={target:'last'});[target]=['array'];
 for(target of ['loop']){};state[target]=counter;
 return jsx(target,{...props,count:counter});
};const element=C(input({children:'content'}));globalThis.elements=[element];
globalThis.result={tag:element.type,count:element.props.count,state};`);
  assert.deepEqual(run.result,{tag:'loop',count:1,state:{loop:1}});
  const plan=run.records[0].function;
  assert(plan.effectSites!.filter(s=>s.kind==='write').length>=5);
  assert(run.records[0].closureReads.some(r=>plan.bindingReads![r.read].name==='target'&&r.value.value==='loop'));
  assert.equal(run.records[0].effectsVerified,false);
});

test('closure capture preserves TDZ exceptions and does not inspect opaque objects or functions',async()=>{
  const run=await compareClosures(`import {jsx} from 'react/jsx-runtime';
let accessed=0,caught=false;const object={get nested(){accessed++;throw Error('inspected');}};
const callback=()=>{throw Error('called');};
const C=props=>{if(props.bad)return jsx(later,{...props});return jsx('button',{...props,object,callback});};
try{C(input({bad:true}));}catch(e){caught=e instanceof ReferenceError;}
const later='span',element=C(input({children:'ok'}));globalThis.elements=[element];
globalThis.result={accessed,caught,tag:element.type,sameObject:element.props.object===object,sameFunction:element.props.callback===callback};`);
  assert.deepEqual(run.result,{accessed:0,caught:true,tag:'button',sameObject:true,sameFunction:true});
  const record=run.records[0],reads=record.closureReads.map(r=>({name:record.function.bindingReads![r.read].name,...r.value}));
  assert.deepEqual(reads.filter(r=>['object','callback'].includes(r.name)),[{name:'object',kind:'object'},{name:'callback',kind:'function'}]);
});

test('multiple closure reads retain ordering and changing primitive values within one invocation',async()=>{
  const run=await compareClosures(`import {jsx} from 'react/jsx-runtime';
let value='a';const update=()=>{value='b';};
const C=props=>{const first=value;update();return jsx('button',{...props,first,last:value});};
const element=C(input({children:'ok'}));globalThis.elements=[element];
globalThis.result=[element.props.first,element.props.last];`);
  assert.deepEqual(run.result,['a','b']);
  const record=run.records[0];
  assert.deepEqual(record.closureReads.filter(r=>record.function.bindingReads![r.read].name==='value').map(r=>r.value.value),['a','b']);
});

test('closure instrumentation keeps meta properties intact and refuses a locally shadowed observer global',async()=>{
  const run=await compareClosures(`import {jsx} from 'react/jsx-runtime';
function C(props){return jsx('button',{...props,constructing:new.target===C});}
const one=C(input({children:'call'})),two=new C(input({children:'new'}));globalThis.elements=[one,two];
globalThis.result=elements.map(e=>e.props.constructing);`);
  assert.deepEqual(run.result,[false,true]);
  assert(!run.records.some(r=>r.function.bindingReads!.some(b=>b.name==='target')));
  assert.throws(()=>source(`import {jsx} from 'react/jsx-runtime';const outside='value';
const C=props=>{let value;{const globalThis={};value=outside;}return jsx('button',{...props,value});};`),/element-closure-reserved-binding/);
});
