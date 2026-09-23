import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {revisionOf} from '../core/contract-provenance.js';
import {nativeTemplateValueUpdateFixture} from '../core/native-template-value-update-test-fixture.js';
import {createNativeUpdatePlans} from './native-update-plans.js';
import {createNativeUpdateJobs} from './native-update-jobs.js';
import {prepareNativeAppUpdate,prepareNativeTemplateAppUpdate,nativeAppUpdateMatches,nativeAppUpdatePreflight,emitNativeAppUpdateScript,emitNativeAppUpdateReadback,nativeAppUpdateDesignChanges} from './native-app-update.js';
import type {NativeOperationCommand} from './native-operation-jobs.js';
import {prepareNativeContractComparison} from '../core/native-contract-comparison.js';
import {emitNativeContractComparisonReadbackScript,verifyNativeContractComparisonReadback} from '../core/native-contract-comparison-observation.js';
import {emitNativeTokenContextScript,emitNativeTokenContextReadbackScript} from '../core/token-set.js';
import {nativeTextNodeBindings,nativeNodePaintBindings} from '../core/native-text-template-test-fixture.js';
import type {NativeTemplateConsumerInput} from '../core/native-template-value-consumers.js';

async function fixture(t:test.TestContext,settleCaller=false) {
  const h=await nativeTemplateValueUpdateFixture(true,true),repo=mkdtempSync(path.join(tmpdir(),'template-app-update-'));
  t.after(()=>rmSync(repo,{recursive:true,force:true}));
  if(settleCaller) {
    const row=h.input.consumers[0].baseline.content.nodes.find((n:any)=>n.type==='TEXT');
    const old=row.id,node=h.figma.getNodeById(old),get=h.figma.getNodeById;
    node.id=node.parent.id+';settled-app-text';
    h.figma.getNodeById=(id:string)=>id===old?node:get(id);
    h.figma.getNodeByIdAsync=async(id:string)=>h.figma.getNodeById(id);
  }
  let desired=structuredClone(h.input.desired),callerRevision='b'.repeat(64);
  const parent=h.input.before.operation.id,caller=structuredClone(h.input.consumers[0]);
  delete caller.baseline.images;delete caller.baseline.parent.images;delete caller.baseline.content.images;
  delete caller.input.comparison.receipt.images;
  const added:NativeTemplateConsumerInput[]=[];
  const inventory=(pins:Array<{operationId:string;journalRevision:string}>=[])=>({parentJournalRevision:'a'.repeat(64),
    currentRevision:revisionOf({callerRevision,added:added.map(c=>c.input.operation.id)}),consumers:[caller,...added].map(c=>({
      ...structuredClone(c),operationId:c.input.operation.id,
      journalRevision:pins.find(p=>p.operationId===c.input.operation.id)?.journalRevision??callerRevision,currentJournalRevision:callerRevision}))});
  const derive=(_id:string,_revision?:string,pins?:Array<{operationId:string;journalRevision:string}>)=>({parentJournalRevision:'a'.repeat(64),
    input:{before:h.input.before,baseline:h.input.baseline,templateGraph:desired,
      desired:{component:desired.component,tokenInput:desired.tokens,revision:revisionOf(desired)}},templateInventory:inventory(pins)});
  let jobs:ReturnType<typeof createNativeUpdateJobs>;
  const plans=createNativeUpdatePlans(repo,derive,id=>jobs.updateHistory(id),()=> 'a'.repeat(64),(_id,pins)=>inventory(pins));
  jobs=createNativeUpdateJobs(repo,plans);
  const accept=async(id:string,command:NativeOperationCommand)=>{
    if(command.phase==='update-apply')jobs.beginWrite(id,command.attemptId);
    const result=await h.run(command.script),{script:_script,kind:_kind,readOnly:_readOnly,...envelope}=command;
    return jobs.accept(id,{...envelope,result});
  };
  const prepare=()=>{const proposal=plans.prepare(parent);return {proposal,operation:jobs.prepare(parent,proposal.id)};};
  const finish=async(id:string)=>{
    for(const [phase,expected] of [['update-preflight-readback','update-preflight-observed'],['update-apply','update-applied'],['update-readback','update-verified']] as const) {
      const result=await accept(id,jobs.dispatch(id,phase));assert.equal(result.phase,expected,JSON.stringify(result.problems));
      jobs=createNativeUpdateJobs(repo,plans);
    }
    assert.equal(jobs.get(id).sourceCurrent,true,JSON.stringify(jobs.get(id)));
  };
  // A real second native caller born against the verified updated parent. This
  // bypasses the application birth route only; compilation, native allocation
  // and independent observation all use their production implementations.
  const addCaller=async()=>{
    const current=jobs.verifiedForParent(parent)!;
    const content=structuredClone(h.contract);content.id='test.added-caller';content.props=[];
    delete content.anatomy.root.slot;
    for(const [key,value] of Object.entries(content.anatomy.root.tokens!))
      content.anatomy.root.tokens![key]=value.replace('{size}','v1').replace('{ink}','v1');
    content.anatomy.root.parts={label:{text:'Added after update'}};
    const comparison={parent:current.input,receipt:current.receipt,caseId:'added-caller',
      variantName:current.input.component.variants.find(v=>v.name.includes('Size=v1')&&v.name.includes('Ink=v1'))!.name,
      slotSpecPath:[0],rootText:{version:1 as const,kind:'direct-root-text' as const,characters:'Added after update',
        contractRevision:revisionOf(content),treeRevision:revisionOf('added caller source')}};
    const byId=new Map([[content.id,content]]),operation={id:'10000000-0000-4000-8000-000000000097',fileKey:h.figma.fileKey};
    const prepared=prepareNativeContractComparison(content,h.engine.compileComponentData(content,byId),h.source,
      revisionOf(h.tokens),{mode:'light',brand:'default'},comparison,h.tokens);
    const tokenInput={fileKey:operation.fileKey,scopeId:'source-'+operation.id,
      source:{revision:h.source.revision,sourceProgramSha256:h.source.programSha256,tokensSha256:revisionOf(h.tokens).slice(7)},
      tokenPaths:[...h.context.tokens.input.tokenPaths],
      modes:[{sourceMode:'light',brand:'default',nativeModeName:'Light',tokens:structuredClone(h.tokens),tokenTreeRevision:revisionOf(h.tokens)}]};
    const tokens=await h.run(emitNativeTokenContextScript(tokenInput).script);
    assert.ok(tokens.creationIdentity,JSON.stringify(tokens));
    const read=await h.run(emitNativeTokenContextReadbackScript(tokenInput,tokens.creationIdentity));
    const context={operation,tokens:{input:tokenInput,identity:tokens.creationIdentity,receipt:read.receipt}};
    const creation=await h.run(h.engine.buildNativeContractComparisonScript(content,byId,h.source,context,comparison));
    assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
    for(const born of creation.nodes) {
      const node=await h.figma.getNodeByIdAsync(born.id);
      if(node.type==='TEXT')nativeTextNodeBindings(node,id=>h.variables.find(v=>v.id===id));
      nativeNodePaintBindings(node,id=>h.variables.find(v=>v.id===id));
    }
    const input={operation,planRevision:revisionOf('added caller observation'),comparison:prepared,
      tokenInput,tokenIdentity:tokens.creationIdentity,creation};
    const baseline=await h.run(emitNativeContractComparisonReadbackScript(input));
    const verified=verifyNativeContractComparisonReadback(input,baseline);
    assert.equal(verified.status,'supported-comparison-structure-observed',JSON.stringify(verified.problems));
    delete baseline.images;delete baseline.parent.images;delete baseline.content.images;delete input.comparison.receipt.images;
    added.push({input,baseline});return added[0];
  };
  return {...h,repo,parent,plans,prepare,finish,accept,jobs:()=>jobs,
    addCaller,
    readCallerAgain:()=>{callerRevision='c'.repeat(64);},
    reverse:()=>{desired=structuredClone(h.input.before.templateGraph!.input);},
    desired:()=>desired};
}

test('a template rollback needs an independent read and an explicit fresh write claim',async t=>{
  const f=await fixture(t), {operation}=f.prepare(), id=operation.id;
  const change=f.plan.valuePlan.changes[0], variable=f.variables.find(v=>v.id===change.variableId)!;
  const assign=variable.setValueForMode.bind(variable);let fail=true;
  variable.setValueForMode=(mode:string,value:unknown)=>{
    assign(mode,value);if(fail){fail=false;throw Error('failed after template assignment');}
  };
  await f.accept(id,f.jobs().dispatch(id,'update-preflight-readback'));
  const write=f.jobs().dispatch(id,'update-apply');
  assert.equal((await f.accept(id,write)).phase,'update-applied');
  assert.throws(()=>f.jobs().rearmWrite(id),/write-rearm-refused/);
  assert.throws(()=>f.jobs().verifiedForParent(f.parent),/effective-observation-unavailable/);
  const settled=await f.accept(id,f.jobs().dispatch(id,'update-readback'));
  assert.equal(settled.phase,'update-write-untouched',JSON.stringify(settled.problems));
  assert.equal(settled.completedUnchanged,'rolled-back');
  assert.throws(()=>f.jobs().beginWrite(id,write.attemptId),/write-begin-refused/);
  assert.throws(()=>f.jobs().dispatch(id,'update-apply'),/write-rearm-required/);
  f.jobs().rearmWrite(id);
  await f.accept(id,f.jobs().dispatch(id,'update-preflight-readback'));
  const fresh=f.jobs().dispatch(id,'update-apply');
  assert.notEqual(fresh.attemptId,write.attemptId);
  await f.accept(id,fresh);
  assert.equal((await f.accept(id,f.jobs().dispatch(id,'update-readback'))).phase,'update-verified');
});

test('a native edit after template rollback cannot be released by the rollback receipt',async t=>{
  const f=await fixture(t), {operation}=f.prepare(), id=operation.id;
  const change=f.plan.valuePlan.changes[0], variable=f.variables.find(v=>v.id===change.variableId)!;
  const assign=variable.setValueForMode.bind(variable);let fail=true;
  variable.setValueForMode=(mode:string,value:unknown)=>{
    assign(mode,value);if(fail){fail=false;throw Error('failed after template assignment');}
  };
  await f.accept(id,f.jobs().dispatch(id,'update-preflight-readback'));
  await f.accept(id,f.jobs().dispatch(id,'update-apply'));
  f.figma.getNodeById(f.input.before.creation.variants[0].id).name='Unrelated native edit';
  const observed=await f.accept(id,f.jobs().dispatch(id,'update-readback'));
  assert.equal(observed.phase,'update-recovery-required');
  assert.equal(observed.completedUnchanged,undefined);
  assert.throws(()=>f.jobs().rearmWrite(id),/write-rearm-refused/);
});

test('a new caller requires a combined successor read before the larger inventory is current',async t=>{
  const f=await fixture(t),first=f.prepare();await f.finish(first.operation.id);
  const oldPlan=f.plans.saved(f.parent,first.proposal.id),added=await f.addCaller();
  assert.equal(f.jobs().get(first.operation.id).sourceCurrent,false);
  await f.accept(first.operation.id,f.jobs().retryObservation(first.operation.id));
  assert.equal(f.jobs().get(first.operation.id).sourceCurrent,false,
    'rereading only the original caller must not certify a newly enlarged inventory');
  assert.throws(()=>f.jobs().verifiedForParent(f.parent),/consumer-inventory-refresh-required/);
  const combined=f.prepare();
  assert.notEqual(combined.proposal.id,first.proposal.id);
  assert.equal(combined.proposal.templateCallerCount,2);
  assert.deepEqual(combined.proposal.templateValueChanges,[]);
  const assignmentCount=f.assignments.length;
  const addedNode=f.figma.getNodeById(added.input.creation.comparisons[0].instanceId),opacity=addedNode.opacity;
  addedNode.opacity=0.25;
  const refused=await f.accept(combined.operation.id,f.jobs().dispatch(combined.operation.id,'update-preflight-readback'));
  assert.equal(refused.phase,'update-refused','a change on the added caller is part of the new preflight');
  assert.equal(f.assignments.length,assignmentCount);
  assert.throws(()=>f.jobs().dispatch(combined.operation.id,'update-apply'),/phase-refused/);
  addedNode.opacity=opacity;
  await f.finish(combined.operation.id);
  assert.equal(f.assignments.length,assignmentCount,'the new combined context writes no variable values');
  assert.equal(f.jobs().get(combined.operation.id).callerImageObservations?.length,2);
  assert.deepEqual(f.plans.saved(f.parent,first.proposal.id),oldPlan,'historical proposal bytes stay intact');
  assert.equal(f.plans.prepare(f.parent).id,combined.proposal.id,'repeat reuses the combined verification');
  f.reverse();const reverse=f.prepare();assert.equal(reverse.proposal.templateCallerCount,2);
  await f.finish(reverse.operation.id);
  assert.equal(f.jobs().get(reverse.operation.id).callerImageObservations?.some(c=>c.operationId===added.input.operation.id),true);
});

test('template proposals use compact storage and retain caller after-states through update, repeat, reverse and journal restart',async t=>{
  const f=await fixture(t),first=f.prepare();
  assert.equal(first.proposal.templateValueChanges?.length,1);
  assert.equal(first.proposal.templateCallerCount,1);
  const record=JSON.parse(readFileSync(path.join(f.repo,'private/source-native-update-plans',f.parent,first.proposal.id+'.json'),'utf8'));
  assert.equal(record.version,2);assert.ok(record.update.template);assert.equal(record.update.plan,undefined);
  assert.equal(record.update.template.input.consumers[0].input.comparison.parent,undefined);
  const file=path.join(f.repo,'private/source-native-update-plans',f.parent,first.proposal.id+'.json'),original=readFileSync(file,'utf8');
  const corrupt=structuredClone(record);corrupt.consumerPins[0].journalRevision='f'.repeat(64);
  writeFileSync(file,JSON.stringify(corrupt));assert.throws(()=>f.plans.saved(f.parent,first.proposal.id),/plan-changed/);
  writeFileSync(file,original);
  await f.finish(first.operation.id);
  const verifiedState=f.jobs().get(first.operation.id);
  for(const invoke of [
    ()=>f.jobs().designEvidence(first.operation.id),
    ()=>f.jobs().observeSourceRepair(first.operation.id,revisionOf(f.input.baseline)),
    ()=>f.jobs().sourceRepairReadEvidence(first.operation.id,'unissued',revisionOf(f.input.baseline)),
  ])assert.throws(invoke,/template-source-repair-unqualified/);
  assert.deepEqual(f.jobs().get(first.operation.id),verifiedState,'source repair refusals dispatch no observation or write');
  const callerNode=f.figma.getNodeById(f.input.consumers[0].input.creation.comparisons[0].instanceId);
  const callerOpacity=callerNode.opacity;callerNode.opacity=0.25;
  try {
    const design=await f.accept(first.operation.id,f.jobs().observeDesign(first.operation.id));
    assert.equal(design.phase,'update-verified');
    assert.ok(design.designChanges?.changes.some(c=>c.nodeId===callerNode.id&&c.channel==='opacity'),
      'the integrated design reader retains caller changes as well as main observations');
  }finally{callerNode.opacity=callerOpacity;}
  assert.equal(f.plans.prepare(f.parent).id,first.proposal.id,'unchanged review reuses the written update');
  assert.equal(f.jobs().verifiedForParent(f.parent)!.receipt.nodes!.length,f.input.baseline.nodes!.length);
  assert.equal(f.jobs().get(first.operation.id).imageObservation?.images.length,4);
  const callerImage=f.jobs().get(first.operation.id).callerImageObservations![0].observation.images[0];
  assert.ok(callerImage);assert.ok(f.jobs().image(first.operation.id,callerImage.sha256).length);
  const history=f.jobs().updateHistory(f.parent)[0],plan=f.plans.saved(f.parent,first.proposal.id).update.plan;
  assert.equal(nativeAppUpdateMatches(plan,history.receipt,true),true);
  const altered=structuredClone(history.receipt) as any;altered.consumerObservations[0].nodes[0].values.opacity=0.25;
  assert.equal(nativeAppUpdateMatches(plan,altered,true),false,'cached observations require complete unchanged contents');
  f.readCallerAgain();
  assert.equal(f.jobs().get(first.operation.id).sourceCurrent,false,'later caller context requires a new combined observation');
  await f.accept(first.operation.id,f.jobs().retryObservation(first.operation.id));
  assert.equal(f.jobs().get(first.operation.id).sourceCurrent,true);
  f.reverse(); const second=f.prepare();assert.notEqual(second.proposal.id,first.proposal.id);
  await f.finish(second.operation.id);
  const restored=f.jobs().verifiedForParent(f.parent)!;
  const baseline=structuredClone(f.input.baseline);delete baseline.images;
  assert.deepEqual(restored.receipt,baseline);
  assert.equal(f.plans.prepare(f.parent).id,second.proposal.id);
  assert.equal(f.assignments.length,2,'one assignment forward and one reverse; no duplicate allocation or repeat writes');
});

test('template admission refuses geometry changes and a plain main read cannot settle an update',async t=>{
  const f=await fixture(t),source=f.desired();
  const input={before:f.input.before,baseline:f.input.baseline,templateGraph:source,templateConsumers:f.input.consumers,
    desired:{component:source.component,tokenInput:source.tokens,revision:revisionOf(source)}};
  const color=prepareNativeAppUpdate(input);
  assert.equal(nativeAppUpdateMatches(color.plan,f.input.baseline,true),false);
  if(color.plan.kind!=='native-contract-template-value-update')throw Error('expected template plan');
  const forged=structuredClone(color.plan.template);forged.input.consumers=[];
  assert.throws(()=>prepareNativeTemplateAppUpdate(forged,color.plan.desiredRevision),/proposal-changed/,
    'memoized compilation requires complete unchanged bytes, not a claimed digest');
  const incomplete=await f.run(emitNativeAppUpdateScript(color.plan,true));
  assert.equal(nativeAppUpdatePreflight(color.plan,incomplete),true);
  const changedObservation=structuredClone(incomplete);
  changedObservation.consumerObservations[0].nodes[0].values.opacity=0.25;
  assert.equal(nativeAppUpdatePreflight(color.plan,changedObservation),false,
    'reusing compilation never reuses the result of a prior observation');
  const changedProposal=structuredClone(color.plan);
  changedProposal.template.input.consumers[0].baseline.unrequested='tampered';
  assert.equal(nativeAppUpdatePreflight(changedProposal,incomplete),false,
    'unchanged claimed revision cannot reuse compilation for different proposal bytes');
  assert.equal(nativeAppUpdatePreflight(color.plan,incomplete),true,
    'a refused observation or forged proposal cannot contaminate the saved result');
  delete incomplete.consumerObservations;assert.equal(nativeAppUpdatePreflight(color.plan,incomplete),false);
  const other=await nativeTemplateValueUpdateFixture(true,false);
  assert.throws(()=>prepareNativeAppUpdate({before:other.input.before,baseline:other.input.baseline,templateGraph:other.input.desired,
    templateConsumers:other.input.consumers,desired:{component:other.input.desired.component,tokenInput:other.input.desired.tokens,revision:revisionOf(other.input.desired)}}),
  /geometry-change-unqualified/);
  const first=f.prepare(),read=f.jobs().dispatch(first.operation.id,'update-preflight-readback');
  await f.accept(first.operation.id,read);
  const caller=f.figma.getNodeById(f.input.consumers[0].input.creation.comparisons[0].instanceId);caller.opacity=0.5;
  const result=await f.accept(first.operation.id,f.jobs().dispatch(first.operation.id,'update-apply'));
  assert.equal(result.phase,'update-applied');assert.deepEqual(f.assignments,[]);
  const refused=await f.accept(first.operation.id,f.jobs().dispatch(first.operation.id,'update-readback'));
  assert.equal(refused.phase,'update-recovery-required');
  assert.throws(()=>f.plans.prepare(f.parent),/effective-observation-unavailable/);
});

test('a lost template write is settled from combined native evidence and is never blindly repeated',async t=>{
  const f=await fixture(t),first=f.prepare(),id=first.operation.id;
  await f.accept(id,f.jobs().dispatch(id,'update-preflight-readback'));
  const command=f.jobs().dispatch(id,'update-apply');f.jobs().beginWrite(id,command.attemptId);
  const answer=await f.run(command.script);assert.equal(answer.status,'write-observed');
  assert.equal(f.jobs().get(id).pendingPhase,'update-apply');
  const settled=await f.accept(id,f.jobs().resolveWriteOutcome(id));assert.equal(settled.phase,'update-applied');
  await f.accept(id,f.jobs().dispatch(id,'update-readback'));
  assert.equal(f.jobs().get(id).sourceCurrent,true);
  assert.equal(f.plans.prepare(f.parent).id,first.proposal.id);
  assert.equal(f.assignments.length,1);
  assert.throws(()=>f.jobs().dispatch(id,'update-apply'),/phase-refused/);
});

test('an intervening caller edit during image export refuses the complete combined observation',async t=>{
  const f=await fixture(t),proposal=f.plans.prepare(f.parent),plan=f.plans.saved(f.parent,proposal.id).update.plan;
  const main=f.figma.getNodeById(plan.after.creation.variants[0].id),caller=f.figma.getNodeById(f.input.consumers[0].input.creation.comparisons[0].instanceId);
  const original=main.exportAsync,opacity=caller.opacity;
  main.exportAsync=async function(...args:any[]){caller.opacity=0.25;return original.apply(this,args);};
  try {
    const observed=await f.run(emitNativeAppUpdateReadback(plan));
    assert.equal(observed.status,'refused');assert.ok(observed.problems.includes('native-template-update-export-observation-changed'));
    assert.equal(nativeAppUpdateMatches(plan,observed,true),false);assert.deepEqual(f.assignments,[]);
  }finally{main.exportAsync=original;caller.opacity=opacity;}
});

test('design diagnostics include template routing and selector changes even when no rendered node changed',async t=>{
  const f=await fixture(t),proposal=f.plans.prepare(f.parent),plan=f.plans.saved(f.parent,proposal.id).update.plan;
  const observed=await f.run(emitNativeAppUpdateReadback(plan,undefined,false));
  for(const mutate of [
    (r:any)=>{const row=r.observation.templateGraph.receipt.routes[0];row.valuesByMode[Object.keys(row.valuesByMode)[0]]={type:'VARIABLE_ALIAS',id:'edited'};},
    (r:any)=>{r.observation.templateGraph.receipt.selectors[0].name='Edited selector';},
    (r:any)=>{const scopes=r.observation.templateGraph.receipt.sourceScopes;scopes[Object.keys(scopes)[0]]=['EDITED_SCOPE'];},
  ]) {
    const changed=structuredClone(observed);mutate(changed);
    const result=nativeAppUpdateDesignChanges(plan,observed,changed);
    assert.ok(result.changes.some(c=>c.channel.startsWith('template-')));
    assert.equal(nativeAppUpdateMatches(plan,changed,true),false);
  }
});


test('settled SDK caller IDs survive application preflight, independent image read, journal restart and reverse',async t=>{
  const f=await fixture(t,true),first=f.prepare();
  await f.finish(first.operation.id);
  const history=f.jobs().updateHistory(f.parent)[0];
  assert.equal((history.receipt as any).consumerObservations[0].slotIdentityAliases.length,1);
  assert.equal(f.plans.prepare(f.parent).id,first.proposal.id);
  assert.equal(f.assignments.length,1);
  f.reverse();const reverse=f.prepare();await f.finish(reverse.operation.id);
  assert.equal(f.assignments.length,2);
  assert.equal(f.plans.prepare(f.parent).id,reverse.proposal.id);
});


test('program reuse keys complete template bytes and options, never just the saved digest',async t=>{
  const f=await fixture(t),proposal=f.plans.prepare(f.parent),plan=f.plans.saved(f.parent,proposal.id).update.plan;
  assert.equal(plan.kind,'native-contract-template-value-update');
  const apply=emitNativeAppUpdateScript(plan),preflight=emitNativeAppUpdateScript(plan,true);
  assert.notEqual(apply,preflight);
  assert.equal(emitNativeAppUpdateScript(structuredClone(plan)),apply);
  assert.equal(emitNativeAppUpdateScript(structuredClone(plan),true),preflight);
  const read=emitNativeAppUpdateReadback(plan,undefined,false),images=emitNativeAppUpdateReadback(plan,undefined,true);
  assert.notEqual(read,images);
  assert.equal(emitNativeAppUpdateReadback(structuredClone(plan),undefined,false),read);
  assert.equal(emitNativeAppUpdateReadback(structuredClone(plan),undefined,true),images);
  const changed=structuredClone(plan);if(changed.kind!=='native-contract-template-value-update')throw Error('wrong plan');
  changed.template.input.consumers[0].baseline.unrequested='tampered';
  assert.throws(()=>emitNativeAppUpdateScript(changed),/proposal-changed/);
  assert.throws(()=>emitNativeAppUpdateReadback(changed),/proposal-changed/);
});
