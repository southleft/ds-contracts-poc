import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { revisionOf } from '../core/contract-provenance.js';
import { nativeComparisonFixture } from '../core/native-contract-comparison-test-fixture.js';
import { emitNativeContractReadbackScript } from '../core/native-source-observation.js';
import { createNativeOperationJobs, REACT_NATIVE_FILE_KEY, type NativeOperationCommand, type NativeOperationPhase, type NativeOperationJobsOptions } from './native-operation-jobs.js';
import { prepareReactNativePlan, prepareReactNativeCorrectionPlan, buildReactNativeComponentWrite } from './react-native-plan.js';
import { createNativeUpdatePlans } from './native-update-plans.js';
import { createNativeUpdateJobs } from './native-update-jobs.js';
import { nativeAppUpdateDesired } from './native-app-update.js';
import { prepareReactComparisonPlan, buildReactComparisonWrite, type ReactComparisonPlanInput } from './react-comparison-plan.js';
import type { ReactNativeRequest } from './react-native-request.js';
import type { ReactComparisonRequest } from './react-comparison-request.js';
import type { ReactRootMatrix } from './react-root-matrix.js';

const envelope=(c:NativeOperationCommand,result:Record<string,unknown>)=>({version:c.version,operationId:c.operationId,
  phase:c.phase,attemptId:c.attemptId,nonce:c.nonce,fileKey:c.fileKey,planRevision:c.planRevision,scriptSha256:c.scriptSha256,result});

/** Complete operation journals and generated native programs. The synthetic
 * canvas establishes protocol safety, never live geometry or visual fidelity. */
async function fixture(t: test.TestContext) {
  const repo=mkdtempSync(path.join(tmpdir(),'root-consumer-journal-'));
  t.after(()=>rmSync(repo,{recursive:true,force:true}));
  const f=await nativeComparisonFixture(REACT_NATIVE_FILE_KEY);
  let source=structuredClone(f.source),generation=0;
  const matrix:ReactRootMatrix={version:1,qualification:'combined-property-root-draft',acceptedContract:null,problems:[],
    draft:{properties:[],status:'native-compiled',contract:f.main,tokens:f.tokens,
      native:f.engine.compileComponentData(f.main,new Map([[f.main.id,f.main]])),problems:[],observations:[],lowerings:[],limitations:[]}};
  const request:ReactNativeRequest={version:1,kind:'react-root-draft',referenceId:'a'.repeat(64),
    ownership:{id:'10000000-0000-4000-8000-000000000099',sha256:'b'.repeat(64)},inventorySha256:'c'.repeat(64),
    caseId:'ordinary-root',matrixRevision:revisionOf(matrix)};
  let effective=request,updates:ReturnType<typeof createNativeUpdateJobs>;
  const evidence=new Map<string,Omit<ReactComparisonPlanInput,'operation'>>();
  const requests=new Map<string,ReactComparisonRequest>();
  const comparisonEvidence=(r:ReactComparisonRequest,id:string)=>{
    if(revisionOf(r.mainRoot)!==revisionOf(effective))throw Error('fixture-current-source-changed');
    const saved=evidence.get(r.root.caseId)!;
    if(r.version!==4)return saved;
    const current=updates.verifiedForNewConsumer(r.parentOperationId,id,r.parentUpdate!);
    return {...saved,source,comparison:{...saved.comparison,parent:current.input,receipt:current.receipt,
      sourceSuccession:{...r.parentUpdate!,source}}};
  };
  const options:NativeOperationJobsOptions={
    prepare:()=>{throw Error('legacy adapter must not run');},
    react:{effectiveSource:()=>effective,
      updatedObservation:(id,purpose)=>purpose==='caller'?updates.verifiedForCaller(id):updates.verifiedForParent(id),
      prepare:(_,operation)=>({visual:{id:request.ownership.id,reportSha256:request.ownership.sha256},
        preparation:{id:request.ownership.id,reportSha256:request.matrixRevision.slice(7)},plan:prepareReactNativePlan({operation,source,matrix})}),
      buildComponent:(_,c)=>buildReactNativeComponentWrite({operation:c.operation,source,matrix,expectedPlanRevision:c.planRevision,tokens:c.tokens})},
    reactComparison:{
      prepare:(r,operation)=>({visual:{id:r.content.id,reportSha256:r.content.reportSha256},preparation:{id:r.content.id,reportSha256:r.content.reportSha256},
        plan:prepareReactComparisonPlan({...comparisonEvidence(r,operation.id),operation})}),
      buildComponent:(r,c)=>buildReactComparisonWrite({...comparisonEvidence(r,c.operation.id),operation:c.operation,expectedPlanRevision:c.planRevision,tokens:c.tokens})},
  };
  let jobs=createNativeOperationJobs(repo,options);
  const plans=createNativeUpdatePlans(repo,(id,pin,_consumers,birth)=>{
    const baseline=jobs.reactUpdateBaseline(id,pin);
    const desired=nativeAppUpdateDesired(prepareReactNativeCorrectionPlan({operation:baseline.input.operation,source,matrix}));
    if(birth)jobs.reactRootComparisonBirth(id,birth);
    return {parentJournalRevision:baseline.journalRevision,input:{before:baseline.input,baseline:baseline.receipt,...desired}};
  },id=>updates.updateHistory(id),id=>jobs.reactUpdateJournalRevision(id));
  updates=createNativeUpdateJobs(repo,plans);
  const phase=async(id:string,p:NativeOperationPhase)=>{
    const command=jobs.dispatch(id,p);
    return jobs.accept(id,envelope(command,await f.run(command.script)));
  };
  const finish=async(id:string)=>{
    for(const p of ['token-create','token-readback','component-create','component-readback'] as const)await phase(id,p);
    assert.equal(jobs.get(id).phase,'component-structure-observed',JSON.stringify(jobs.get(id).problems));
  };
  const parentId=jobs.prepare(request).id;await finish(parentId);
  const prepareCaller=(caseId:string)=>{
    const parent=jobs.verifiedReactCallerObservation(parentId),treeRevision=revisionOf(caseId);
    evidence.set(caseId,{source,content:{version:1,status:'compiled-comparison-draft',qualification:'observed-comparison-content-only',
      acceptedContract:null,nativeQualification:'unqualified',inputRevision:treeRevision,treeRevision,fontsRevision:revisionOf('fonts'),
      contract:f.content,tokens:f.tokens,component:f.engine.compileComponentData(f.content,new Map([[f.content.id,f.content]])),assets:f.assets,
      receipts:[],residuals:[],problems:[],limitations:[]},comparison:{parent:parent.input,receipt:parent.receipt,caseId,
      variantName:parent.input.component.variants[0].name,slotSpecPath:[0]}});
    const selected:ReactComparisonRequest={version:parent.parentUpdate?4:3,...(parent.parentUpdate?{parentUpdate:parent.parentUpdate}:{}),
      kind:'react-content-comparison',parentOperationId:parentId,root:{...parent.request,caseId},mainRoot:parent.request,
      content:{id:request.ownership.id,reportSha256:'d'.repeat(64),inventorySha256:'e'.repeat(64)}};
    const id=jobs.prepare(selected).id;requests.set(id,selected);return id;
  };
  const updatePhase=async(id:string,p:'update-preflight-readback'|'update-apply'|'update-readback')=>{
    const c=updates.dispatch(id,p);if(p==='update-apply')updates.beginWrite(id,c.attemptId);
    return updates.accept(id,{...c,result:await f.run(c.script)});
  };
  const finishUpdate=async(id:string)=>{
    for(const p of ['update-preflight-readback','update-apply','update-readback'] as const)await updatePhase(id,p);
    assert.equal(updates.get(id).phase,'update-verified',JSON.stringify(updates.get(id).problems));
  };
  const prepareUpdate=()=>{const p=plans.prepare(parentId);return updates.prepare(parentId,p.id).id;};
  return {...f,repo,parentId,prepareCaller,prepareUpdate,finishUpdate,updatePhase,phase,finish,jobs:()=>jobs,updates:()=>updates,
    requests,evidenceFor:(id:string)=>comparisonEvidence(requests.get(id)!,id),
    advance:()=>{generation++;source={revision:revisionOf(['source',generation]),programSha256:String(generation).repeat(64),evidenceRevision:revisionOf(['evidence',generation])};
      effective={...request,referenceId:source.revision.slice(7),inventorySha256:source.programSha256,matrixRevision:revisionOf(matrix)};},
    addToken:()=>{(f.tokens as Record<string,unknown>).unboundOpacity={$type:'number',$value:1};},
    restart:()=>{jobs=createNativeOperationJobs(repo,options);updates=createNativeUpdateJobs(repo,plans);}};
}

test('ordinary callers follow a verified correction, resume and repeat without replacing mains or old callers',async t=>{
  const f=await fixture(t),first=f.prepareCaller('before');await f.finish(first);
  const oldDir=path.join(f.repo,'private/source-native-app/operations',first);
  const historical=()=>readdirSync(path.join(oldDir,'events')).map(name=>readFileSync(path.join(oldDir,'events',name),'utf8'));
  const oldEvents=historical();f.advance();const update=f.prepareUpdate();await f.finishUpdate(update);
  const parent=f.jobs().verifiedReactCallerObservation(f.parentId),before=await f.run(emitNativeContractReadbackScript(parent.input));
  const mains=f.figma.root.findAll((n:any)=>n.type==='COMPONENT').map((n:any)=>n.id);
  const second=f.prepareCaller('after'),request=f.requests.get(second)!;
  assert.equal(request.version,4);assert.equal(parent.input.templateGraph,undefined);
  const e=f.evidenceFor(second),operation={id:second,fileKey:REACT_NATIVE_FILE_KEY};
  assert.notEqual(e.source.revision,e.comparison.parent.projection.source.revision);
  for(const mutate of [
    (v:ReactComparisonPlanInput)=>{delete v.comparison.sourceSuccession;},
    (v:ReactComparisonPlanInput)=>{v.comparison.sourceSuccession!.source={...v.source,programSha256:'0'.repeat(64)};},
    (v:ReactComparisonPlanInput)=>{v.comparison.sourceSuccession!.observationRevision=revisionOf('forged');},
    (v:ReactComparisonPlanInput)=>{v.comparison.rootText={} as any;},
    (v:ReactComparisonPlanInput)=>{v.comparison.instances=[{specPath:[0],parent:v.comparison.parent,receipt:v.comparison.receipt,
      variantName:v.comparison.variantName,slotSpecPath:[0]}];},
  ]) {
    const changed=structuredClone({...e,operation});mutate(changed);
    assert.throws(()=>prepareReactComparisonPlan(changed),/source-changed|source-succession-unverified|nested-main-observation-required|direct-root-text-changed/);
  }
  await f.phase(second,'token-create');f.restart();
  assert.equal(f.jobs().prepare(request).id,second);
  await f.phase(second,'token-readback');await f.phase(second,'component-create');f.restart();await f.phase(second,'component-readback');
  assert.equal(f.jobs().get(second).phase,'component-structure-observed');
  const count=f.figma.root.findAll(()=>true).length;
  assert.equal(f.prepareCaller('after'),second);
  assert.equal(f.figma.root.findAll(()=>true).length,count);
  assert.deepEqual(f.figma.root.findAll((n:any)=>n.type==='COMPONENT').map((n:any)=>n.id),mains);
  assert.deepEqual(await f.run(emitNativeContractReadbackScript(parent.input)),before);
  assert.deepEqual(historical(),oldEvents);
  f.advance();await f.finishUpdate(f.prepareUpdate());
  assert.throws(()=>f.updates().verifiedForNewConsumer(f.parentId,second,request.parentUpdate!),/caller-birth-parent-changed/);
  assert.deepEqual(historical(),oldEvents,'a later correction cannot rewrite the historical caller');
});

test('ordinary birth refuses foreign IDs, altered proof, corrupted journals and unsettled correction reads',async t=>{
  const f=await fixture(t),old=f.prepareCaller('historical');await f.finish(old);
  f.advance();const update=f.prepareUpdate();await f.finishUpdate(update);
  const id=f.prepareCaller('current'),r=f.requests.get(id)!,proof=r.parentUpdate!;
  for(const foreign of [f.parentId,'invalid'])assert.throws(()=>f.updates().verifiedForNewConsumer(f.parentId,foreign,proof),/caller-birth-parent-changed/);
  assert.throws(()=>f.updates().verifiedForNewConsumer(f.parentId,old,proof),/caller-birth-invalid/);
  assert.throws(()=>f.updates().verifiedForNewConsumer(f.parentId,id,{...proof,proposalId:'0'.repeat(64)}),/caller-birth-parent-changed/);
  assert.throws(()=>f.updates().verifiedForNewConsumer(f.parentId,id,{...proof,observationRevision:revisionOf('changed')}),/caller-birth-invalid|caller-birth-parent-changed/);
  await f.phase(id,'token-create');
  const event=path.join(f.repo,'private/source-native-app/operations',id,'events','00000000.json');
  const bytes=readFileSync(event),bad=JSON.parse(bytes.toString());bad.previousSha256='0'.repeat(64);writeFileSync(event,JSON.stringify(bad));
  assert.throws(()=>f.updates().verifiedForNewConsumer(f.parentId,id,proof),/journal-chain-invalid/);
  writeFileSync(event,bytes);
  const read=f.updates().retryObservation(update);
  assert.throws(()=>f.updates().verifiedForNewConsumer(f.parentId,id,proof),/effective-observation-unavailable/);
  f.updates().accept(update,{...read,result:await f.run(read.script)});
  assert.equal(f.jobs().get(id).sourceCurrent,true);
  await f.phase(id,'token-readback');
  f.advance();assert.throws(()=>f.jobs().dispatch(id,'component-create'),/fixture-current-source-changed/);
});

test('an in-flight parent read cannot be hidden behind the verified correction',async t=>{
  const f=await fixture(t);f.advance();await f.finishUpdate(f.prepareUpdate());
  const id=f.prepareCaller('pending-parent'),proof=f.requests.get(id)!.parentUpdate!;
  f.jobs().retryObservation(f.parentId);
  assert.throws(()=>f.jobs().verifiedReactCallerObservation(f.parentId),/react-parent-observation-required/);
  assert.throws(()=>f.updates().verifiedForNewConsumer(f.parentId,id,proof),/baseline-observation-unsettled/);
});

test('a changed live main refuses caller allocation even after host authorization',async t=>{
  const f=await fixture(t);f.advance();await f.finishUpdate(f.prepareUpdate());
  const id=f.prepareCaller('conflict');await f.phase(id,'token-create');await f.phase(id,'token-readback');
  const command=f.jobs().dispatch(id,'component-create'),parent=f.jobs().verifiedReactCallerObservation(f.parentId);
  const main=await f.figma.getNodeByIdAsync(parent.input.creation.variants[0].id);main.name+=' designer edit';
  const count=f.figma.root.findAll(()=>true).length,result=await f.run(command.script);
  assert.equal(result.status,'refused');assert.equal(result.allocationAttempted,false);
  f.jobs().accept(id,envelope(command,result));
  assert.equal(f.figma.root.findAll(()=>true).length,count);
});

test('allocating variables alone cannot authorize a caller; a subsequent component review must settle',async t=>{
  const f=await fixture(t);f.addToken();f.advance();const allocation=f.prepareUpdate();await f.finishUpdate(allocation);
  const proof=f.updates().verifiedForParent(f.parentId)!.parentUpdate;
  assert.throws(()=>f.prepareCaller('premature'),/compiler-review-required-after-token-allocation/);
  assert.throws(()=>f.updates().verifiedForNewConsumer(f.parentId,'10000000-0000-4000-8000-000000000098',proof),/caller-birth-parent-changed/);
  const review=f.prepareUpdate();assert.notEqual(review,allocation);await f.finishUpdate(review);
  const id=f.prepareCaller('settled');await f.finish(id);
  assert.equal(f.jobs().get(id).sourceCurrent,true);
});
