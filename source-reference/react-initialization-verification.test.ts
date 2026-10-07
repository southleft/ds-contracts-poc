import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyReactInitialization} from './react-initialization-verification.js';
import {helperPointKey} from './react-helper-instrument.js';

// Minimal guarded-report fixture: this tests phase accounting, not runtime provenance.
function fixture(){
 const component={file:'component.mjs',sha256:'a'.repeat(64),start:0,end:100};
 const fn={file:'helper.cjs',sha256:'b'.repeat(64),start:10,end:40};
 const assignment={...fn,start:50,end:70},call={...fn,start:80,end:90};
 const output={kind:'object',identity:77},value={kind:'function',identity:42};
 const model={component,calls:[{source:component,site:null,phase:'render'},{source:fn,site:call,phase:'module-initialization'}],writes:[
  {phase:'render',origin:'local',operation:'set',key:'label'},
  {phase:'module-initialization',origin:'source-function',operation:'set',key:'default',source:assignment,valueSource:fn,targetSource:fn},
  {phase:'render',origin:'local',operation:'delete',key:'temporary'},
 ],intrinsics:[],runtimeBindings:{bindings:[{binding:fn}]}};
 const plan={boundaryOnly:true,models:[],bodyModels:[model]};
 const runtime={status:'observed',bodyTraces:[{source:helperPointKey(component),render:0,callTraceVerified:true,checkedCalls:0,bindingKeys:[helperPointKey(fn)],output}],
  targetInitializers:{targets:[{invocations:[{output:{render:0,value:output}}]}]},
  bindings:{initialization:{qualification:'source-initialization-call-order-only',checks:[{model:0,calls:[{site:helperPointKey(call),source:helperPointKey(fn),completion:'returned'}]}]}},
  contexts:{initializationWrites:{planned:1,writes:[{site:helperPointKey(assignment),property:'default',valueSource:helperPointKey(fn),value,target:value,owner:{kind:'source-function',source:helperPointKey(fn)}}]},bindings:{reads:[{render:0,functionSource:fn,value}]}}};
 const verify=()=>verifyReactInitialization(model as unknown as Parameters<typeof verifyReactInitialization>[0],plan as unknown as Parameters<typeof verifyReactInitialization>[1],runtime as unknown as Parameters<typeof verifyReactInitialization>[2],0);
 return {model,plan,runtime,verify};
}

test('initialization counts exclude traced render-local set and delete operations',()=>{
 const f=fixture();assert.deepEqual(f.verify(),{calls:1,writes:1,guardedBindings:[helperPointKey(f.model.runtimeBindings.bindings[0].binding)],guardedRenderCalls:0,qualification:'observed-initialization-path-only',effectsVerified:false});
});

test('phase accounting still requires exact initialization coverage and guarded local render ownership',()=>{
 const cases:Array<[string,(f:ReturnType<typeof fixture>)=>void,RegExp]>=[
  ['missing binding graph',f=>{f.runtime.bodyTraces[0].bindingKeys=[];},/binding-graph-coverage/],
  ['extra binding graph',f=>{f.runtime.bodyTraces[0].bindingKeys.push('forged');},/binding-graph-coverage/],
  ['missing assignment',f=>{f.runtime.contexts.initializationWrites.writes=[];},/write-coverage/],
  ['extra assignment',f=>{f.runtime.contexts.initializationWrites.writes.push(f.runtime.contexts.initializationWrites.writes[0]);},/write-coverage/],
  ['wrong plan count',f=>{f.runtime.contexts.initializationWrites.planned=3;},/write-coverage/],
  ['foreign render write',f=>{f.model.writes[0].origin='loader';},/render-write-owner/],
  ['unknown render phase',f=>{f.model.writes[0].phase='unknown';},/render-write-owner/],
  ['unverified call trace',f=>{f.runtime.bodyTraces[0].callTraceVerified=false;},/render-call-trace/],
  ['wrong exported value',f=>{f.runtime.contexts.initializationWrites.writes[0].value={kind:'function',identity:99};},/exported-value-link/],
 ];
 for(const [name,mutate,reason] of cases){const f=fixture();mutate(f);assert.throws(f.verify,reason,name);}
});
