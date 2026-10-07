import type {ReactContextConsumerEffects} from './react-target-effects.js';
import type {ReactHelperRuntimeReport} from './react-helper-runtime.js';
import type {ReactJsxHelperInstrumentationPlan} from './react-helper-instrument.js';
import type {ReactContextValueWitness} from './react-context-runtime.js';
import {helperPointKey as key} from './react-helper-instrument.js';
type Model=Extract<ReactContextConsumerEffects,{status:'modeled'}>;
function requireProof(v:unknown,r:string):asserts v{if(!v)throw Error('context-initialization-'+r);}
const same=(a:ReactContextValueWitness,b:ReactContextValueWitness)=>a.kind===b.kind&&Number.isSafeInteger(a.identity)&&a.identity===b.identity;
/** Conditional on the same sealed runtime and freshly rebuilt source model.
 * Source-only records and a serialized report cannot grant acceptance. */
export function verifyReactInitialization(model:Model,plan:ReactJsxHelperInstrumentationPlan,runtime:ReactHelperRuntimeReport,render:number){
 requireProof(runtime.status==='observed'&&runtime.contexts&&plan.boundaryOnly&&plan.models.length===0,'guarded-boundary-required');
 const models=plan.bodyModels??[],index=models.findIndex(m=>key(m.component)===key(model.component));requireProof(index>=0,'body-model-missing');const guarded=models[index];
 for(const field of ['component','calls','writes','intrinsics','runtimeBindings'] as const)requireProof(JSON.stringify(guarded[field])===JSON.stringify(model[field]),'guard-model-changed:'+field);
 const traces=runtime.bodyTraces?.filter(t=>t.source===key(model.component)&&t.render===render)??[];
 requireProof(traces.length===1&&traces[0].callTraceVerified&&traces[0].checkedCalls===model.calls.filter(c=>c.site&&c.phase!=='module-initialization').length,'render-call-trace');
 const guardedBindings=model.runtimeBindings.bindings.map(b=>key(b.binding));
 requireProof(JSON.stringify(traces[0].bindingKeys)===JSON.stringify(guardedBindings),'binding-graph-coverage');
 const outputs=runtime.targetInitializers?.targets.flatMap(t=>t.invocations).filter(i=>i.output.render===render)??[];requireProof(outputs.length===1&&same(traces[0].output,outputs[0].output.value),'render-output-link');
 const initialization=runtime.bindings.initialization,checks=initialization?.checks.filter(c=>c.model===index)??[];
 const calls=model.calls.filter(c=>c.phase==='module-initialization'&&c.site);
 requireProof(initialization?.qualification==='source-initialization-call-order-only'&&checks.length===1&&checks[0].calls.length===calls.length,'call-coverage');
 requireProof(checks[0].calls.every((c,i)=>c.site===key(calls[i].site!)&&c.source===key(calls[i].source)&&c.completion==='returned'),'call-order-or-completion');
 // Render-local writes are covered by the exact guarded render call trace.
 // They are not module initialization assignments and must not inflate this receipt.
 requireProof(model.writes.every(w=>w.phase==='module-initialization'||w.phase==='render'&&w.origin==='local'&&(w.operation==='set'||w.operation==='delete')),'render-write-owner');
 const writes=model.writes.filter(w=>w.phase==='module-initialization');
 const report=runtime.contexts.initializationWrites;requireProof(report&&report.planned===writes.length&&report.writes.length===writes.length,'write-coverage');
 for(const [i,w] of writes.entries()){
  const actual=report.writes[i];requireProof(w.phase==='module-initialization'&&w.source&&w.operation==='set'&&w.valueSource,'write-model');
  requireProof(actual.site===key(w.source)&&actual.property===w.key&&actual.valueSource===key(w.valueSource)&&actual.value.kind==='function','write-value-or-order');
  const bindings=runtime.contexts.bindings.reads.filter(r=>r.render===render&&r.functionSource&&key(r.functionSource)===key(w.valueSource!));
  requireProof(bindings.length>0&&bindings.every(r=>same(r.value,actual.value)),'exported-value-link');
  if(w.origin==='source-function')requireProof(w.targetSource&&actual.owner.kind==='source-function'&&actual.owner.source===key(w.targetSource)&&key(w.targetSource)===key(w.valueSource)&&same(actual.target,actual.value),'function-owner');
  else if(w.origin==='loader'){
   const modules=runtime.contexts.commonJs?.modules.filter(m=>m.file===w.source!.file)??[];
   requireProof(modules.length===1&&actual.owner.kind==='loader'&&actual.owner.file===w.source.file&&actual.owner.allocation===modules[0].allocation&&same(actual.target,modules[0].module)&&same(actual.value,modules[0].currentExports),'module-owner');
  }else requireProof(false,'write-owner-unmodeled');
 }
 return {calls:calls.length,writes:writes.length,guardedBindings,guardedRenderCalls:traces[0].checkedCalls,qualification:'observed-initialization-path-only' as const,effectsVerified:false as const};
}
