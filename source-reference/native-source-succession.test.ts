import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {revisionOf} from '../core/contract-provenance.js';
import {nativeUpdateFixture} from '../core/native-contract-update-test-fixture.js';
import {createNativeSourceSuccessions,nativeSourcePinReference} from './native-source-succession.js';
import {createNativeUpdatePlans} from './native-update-plans.js';
import {createNativeUpdateJobs} from './native-update-jobs.js';
import type {ReactNativeRequest} from './react-native-request.js';
import type {ReactInitialNativeRequest} from './react-initial-native-request.js';

const PARENT='11111111-2222-4333-8444-555555555555';
const root=(reference:string,caseId='button-default'):ReactNativeRequest=>({version:1,kind:'react-root-draft',referenceId:reference.repeat(64),
 ownership:{id:`${reference.repeat(8)}-0000-4000-8000-000000000000`,sha256:reference.repeat(64)},inventorySha256:reference.repeat(64),caseId,
 matrixRevision:'sha256:'+reference.repeat(64)});
const initial=(reference:string,caseId='checkbox-unchecked'):ReactInitialNativeRequest=>({version:1,kind:'react-initial-draft',anchor:root(reference,'checkbox-unchecked'),caseId,
 observation:{id:`${reference.repeat(8)}-0000-4000-8000-000000000001`,inventorySha256:reference.repeat(64),reportSha256:reference.repeat(64)}});
function store(t:test.TestContext) {
 const repo=mkdtempSync(path.join(tmpdir(),'native-source-succession-'));
 t.after(()=>rmSync(repo,{recursive:true,force:true}));
 return {repo,successions:createNativeSourceSuccessions(repo),dir:path.join(repo,'private/source-native-successions',PARENT)};
}

test('an operation follows its creation pin until a succession is recorded, and repeats record nothing',t=>{
 const {successions,dir}=store(t),original={...root('a'),compilation:'current' as const};
 assert.deepEqual(successions.effective(PARENT,original),original);
 assert.deepEqual(successions.adopt(PARENT,original,root('a')),{adopted:false,sequence:0},'the creation observation is not a successor of itself');
 assert.deepEqual(successions.adopt(PARENT,original,root('b')),{adopted:true,sequence:0});
 assert.deepEqual(successions.adopt(PARENT,original,root('b')),{adopted:false,sequence:1});
 assert.deepEqual(readdirSync(dir),['00000000.json']);
 assert.deepEqual(successions.effective(PARENT,original),root('b'));
 // Reverting the source is another explicit succession, never a rewrite.
 assert.deepEqual(successions.adopt(PARENT,original,root('a')),{adopted:true,sequence:1});
 assert.deepEqual(successions.history(PARENT,original),['a','b','a'].map(r=>r.repeat(64)));
});

test('only the same source case and request shape can succeed; nested child roots cannot',t=>{
 const {successions}=store(t);
 assert.throws(()=>successions.adopt(PARENT,root('a'),root('b','button-secondary')),/succession-case-mismatch/);
 assert.throws(()=>successions.adopt(PARENT,root('a'),initial('b')),/succession-case-mismatch/);
 assert.throws(()=>successions.adopt(PARENT,initial('a'),root('b')),/succession-case-mismatch/);
 assert.throws(()=>successions.adopt(PARENT,initial('a'),initial('b','checkbox-checked')),/succession-case-mismatch/);
 const nested={...root('a'),version:2 as const,selection:{instanceId:'button'}};
 assert.throws(()=>successions.adopt(PARENT,nested,root('b')),/succession-kind-unsupported/);
 assert.throws(()=>successions.adopt('not-an-operation',root('a'),root('b')),/succession-parent-invalid/);
 assert.deepEqual(successions.adopt(PARENT,initial('a'),initial('b')),{adopted:true,sequence:0});
});

test('an altered, reordered, foreign or re-seeded succession journal fails closed',t=>{
 const {successions,dir}=store(t),original=root('a');
 successions.adopt(PARENT,original,root('b'));successions.adopt(PARENT,original,root('c'));
 const first=path.join(dir,'00000000.json'),bytes=readFileSync(first,'utf8');
 // The chain is seeded by the creation pin: another operation's pin cannot read it.
 assert.throws(()=>successions.effective(PARENT,root('d')),/journal-chain-invalid/);
 writeFileSync(first,bytes.replace('b'.repeat(64),'e'.repeat(64)));
 assert.throws(()=>successions.effective(PARENT,original),/journal-chain-invalid/);
 writeFileSync(first,bytes);assert.deepEqual(successions.effective(PARENT,original),root('c'));
 writeFileSync(path.join(dir,'00000003.json'),bytes);
 assert.throws(()=>successions.effective(PARENT,original),/journal-sequence-invalid/);
 assert.throws(()=>successions.adopt(PARENT,original,root('f')),/journal-sequence-invalid/);
});

// The service derives `desired` from the sealed observation an operation
// follows, and that observation is readable only while it matches live source.
async function pipeline(t:test.TestContext) {
 const f=await nativeUpdateFixture(),{repo,successions}=store(t),parent=f.input.before.operation.id,original=root('a');
 const opacity:Record<string,number>={['a'.repeat(64)]:f.input.desired.component.variants[0].spec.opacity as number,['b'.repeat(64)]:0.125};
 let live='a'.repeat(64);
 const plans=createNativeUpdatePlans(repo,id=>{
  const followed=nativeSourcePinReference(successions.effective(id,original));
  if(followed!==live)throw Error('react-native-evidence-unavailable');
  const desired=structuredClone(f.input.desired);
  for(const v of desired.component.variants)v.spec.opacity=opacity[followed];
  desired.revision=revisionOf(desired.component);
  return {parentJournalRevision:'a'.repeat(64),input:{...f.input,desired}};
 },id=>jobs.updateHistory(id));
 const jobs=createNativeUpdateJobs(repo,plans);
 const finish=async(id:string)=>{const delivered=[];for(const p of ['update-preflight-readback','update-apply','update-readback'] as const){
  const c=jobs.dispatch(id,p);delivered.push(c);jobs.accept(id,{...c,result:await f.run(c.script)});}return delivered;};
 const apply=async()=>{const proposal=plans.prepare(parent),operation=jobs.prepare(parent,proposal.id);await finish(operation.id);return {proposal,operation};};
 return {f,parent,original,successions,plans,jobs,apply,source:(reference:string)=>{live=reference.repeat(64);}};
}

test('a changed source updates the SAME native nodes through a recorded succession, then repeats as a no-op',async t=>{
 const p=await pipeline(t),first=await p.apply();
 const nodes=p.plans.saved(p.parent,first.proposal.id).update.plan.changes.map(c=>c.nodeId);
 p.source('b');
 // Without a succession the existing operation is unreachable from the new source.
 assert.throws(()=>p.plans.prepare(p.parent),/react-native-evidence-unavailable/);
 assert.throws(()=>p.jobs.verifiedForParent(p.parent),/react-native-evidence-unavailable/);
 p.successions.adopt(p.parent,p.original,root('b'));
 const second=await p.apply(),record=p.plans.saved(p.parent,second.proposal.id);
 assert.equal(record.predecessor?.proposalId,first.proposal.id,'the source change continues the verified correction chain');
 assert.deepEqual(record.update.plan.changes.map(c=>c.nodeId),nodes,'no node is allocated or replaced');
 assert.ok(record.update.plan.changes.every(c=>c.after===0.125));
 assert.equal(p.jobs.get(second.operation.id).phase,'update-verified');
 assert.equal(p.jobs.verifiedForParent(p.parent)!.input.component.variants[0].spec.opacity,0.125);
 // Repeat: same proposal, same update operation, no second write.
 assert.equal(p.plans.prepare(p.parent).id,second.proposal.id);
 assert.equal(p.jobs.prepare(p.parent,second.proposal.id).id,second.operation.id);
 assert.deepEqual(p.successions.adopt(p.parent,p.original,root('b')),{adopted:false,sequence:1});
 assert.throws(()=>p.jobs.dispatch(second.operation.id,'update-apply'),/phase-refused/);
});

test('reverting the source needs its own succession and restores the earlier values on the same nodes',async t=>{
 const p=await pipeline(t),first=await p.apply();
 p.source('b');p.successions.adopt(p.parent,p.original,root('b'));await p.apply();
 p.source('a');
 assert.throws(()=>p.plans.prepare(p.parent),/react-native-evidence-unavailable/,'the operation still follows the changed source');
 p.successions.adopt(p.parent,p.original,root('a'));
 const third=await p.apply(),plan=p.plans.saved(p.parent,third.proposal.id).update.plan;
 assert.ok(plan.changes.length&&plan.changes.every(c=>c.before===0.125));
 assert.deepEqual(plan.changes.map(c=>c.after),p.plans.saved(p.parent,first.proposal.id).update.plan.changes.map(c=>c.after));
 assert.deepEqual(p.successions.history(p.parent,p.original),['a','b','a'].map(r=>r.repeat(64)));
});

test('a canvas edit made after the succession still refuses the write at preflight',async t=>{
 const p=await pipeline(t);await p.apply();
 p.source('b');p.successions.adopt(p.parent,p.original,root('b'));
 const proposal=p.plans.prepare(p.parent),operation=p.jobs.prepare(p.parent,proposal.id);
 p.f.nodes[0].opacity=0.8;
 const c=p.jobs.dispatch(operation.id,'update-preflight-readback');
 const refused=p.jobs.accept(operation.id,{...c,result:await p.f.run(c.script)});
 assert.equal(refused.phase,'update-refused');
 assert.equal(refused.problems[0],'native-update-observation-refused');
 assert.ok(refused.problems.some(problem=>problem==='native-update-opacity-conflict:'+p.f.nodes[0].id),'the refusal names the conflicting node: '+refused.problems.join());
 assert.throws(()=>p.jobs.dispatch(operation.id,'update-apply'),/phase-refused/);
 assert.equal(p.f.nodes[0].opacity,0.8,'the conflicting canvas value is left alone');
});
