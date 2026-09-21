import {nativeBackgroundUpdateFixture} from '../core/native-contract-background-update-test-fixture.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {revisionOf} from '../core/contract-provenance.js';
import {nativeUpdateFixture} from '../core/native-contract-update-test-fixture.js';
import {createNativeUpdatePlans} from './native-update-plans.js';
import {createNativeUpdateJobs} from './native-update-jobs.js';
import {withEvidenceReadSnapshot} from './evidence-read-snapshot.js';

async function fixture(t:test.TestContext,make:typeof nativeUpdateFixture|typeof nativeBackgroundUpdateFixture=nativeUpdateFixture) {
 const f=await make(),repo=mkdtempSync(path.join(tmpdir(),'native-update-chain-'));
 t.after(()=>rmSync(repo,{recursive:true,force:true}));
 let stale=false,parentRevision='a'.repeat(64);
 const pins:Array<string|undefined>=[];
 const plans=createNativeUpdatePlans(repo,(_id,pinned)=>{pins.push(pinned);if(stale)throw Error('source drift');return {parentJournalRevision:pinned??parentRevision,input:f.input};},id=>jobs.updateHistory(id),()=>parentRevision);
 let jobs=createNativeUpdateJobs(repo,plans);
 const parent=f.input.before.operation.id;
 const prepare=()=>{const p=plans.prepare(parent);return {proposal:p,operation:jobs.prepare(parent,p.id)};};
 const step=async(id:string,phase:'update-preflight-readback'|'update-apply'|'update-readback')=>{
  const c=jobs.dispatch(id,phase);return jobs.accept(id,{...c,result:await f.run(c.script)});
 };
 const finish=async(id:string)=>{for(const p of ['update-preflight-readback','update-apply','update-readback'] as const)await step(id,p);};
 const next=()=>{for(const v of f.input.desired.component.variants)v.spec.opacity=0.125;f.input.desired.revision=revisionOf(f.input.desired.component);};
 return {...f,repo,parent,plans,prepare,step,finish,next,pins,moveParent:(revision='b'.repeat(64))=>{parentRevision=revision;},jobs:()=>jobs,stale:()=>{stale=true;},restart:()=>{jobs=createNativeUpdateJobs(repo,plans);}};
}

test('proposal lists isolate display copies and recheck altered proposals after the response',async t=>{
 const f=await fixture(t),first=f.prepare();
 const file=path.join(f.repo,'private/source-native-update-plans',f.parent,first.proposal.id+'.json');
 const before=readFileSync(file,'utf8'),expected=f.plans.list(f.parent);
 withEvidenceReadSnapshot(()=>{
  const list=f.plans.list(f.parent);list[0].changes.length=0;
  assert.deepEqual(f.plans.list(f.parent),expected,'a caller cannot mutate the shared display');
  const changed=JSON.parse(before);changed.parentJournalRevision='f'.repeat(64);
  writeFileSync(file,JSON.stringify(changed));
  assert.deepEqual(f.plans.list(f.parent),expected,'one response retains its checked proposal list');
  assert.throws(()=>f.plans.prepare(f.parent),/write-during-evidence-read-snapshot/);
 });
 assert.throws(()=>f.plans.list(f.parent),/native-update-plan-changed/);
 assert.throws(()=>f.jobs().dispatch(first.operation.id,'update-preflight-readback'),/native-update-plan-changed/);
 writeFileSync(file,before);assert.deepEqual(f.plans.list(f.parent),expected);
});

test('only written history pins the parent; later reads retain the first correction baseline',async t=>{
 const f=await fixture(t),first=f.prepare();
 assert.equal(f.pins.at(-1),undefined);
 f.moveParent();
 assert.throws(()=>f.plans.current(f.parent,first.proposal.id),/input-changed/,'unapplied plans cannot claim an old parent');
 const current=f.prepare();await f.finish(current.operation.id);
 const pin=f.plans.saved(f.parent,current.proposal.id).parentJournalRevision;
 assert.equal(pin,'b'.repeat(64));
 f.moveParent('c'.repeat(64));
 assert.throws(()=>f.jobs().verifiedForParent(f.parent),/parent-observation-refresh-required/,
   'an intact historical prefix cannot hide a newer canvas observation');
 assert.equal(f.jobs().get(current.operation.id).canRefreshObservation,true);
 await f.step(current.operation.id,'update-readback');
 assert.equal(f.jobs().verifiedForParent(f.parent)!.input.component.variants[0].spec.opacity,0.25);
 const eventsDir=path.join(f.repo,'private/source-native-updates',current.operation.id,'events');
 const observed=JSON.parse(readFileSync(path.join(eventsDir,'00000006.json'),'utf8'));
 assert.equal(observed.parentJournalRevision,'c'.repeat(64));
 f.next();const next=f.prepare();
 assert.equal(f.pins.at(-1),pin);
 assert.equal(f.plans.saved(f.parent,next.proposal.id).parentJournalRevision,pin);
 await f.finish(next.operation.id);
 assert.equal(f.jobs().verifiedForParent(f.parent)!.input.component.variants[0].spec.opacity,0.125);
 f.stale();assert.throws(()=>f.plans.current(f.parent,next.proposal.id),/source drift/,'the pinned parent never pins stale source');
});

test('a changed parent during readback or conflicting canvas cannot qualify historical recovery',async t=>{
 const f=await fixture(t),first=f.prepare();await f.finish(first.operation.id);f.moveParent();
 const command=f.jobs().dispatch(first.operation.id,'update-readback');
 f.moveParent('c'.repeat(64));f.jobs().accept(first.operation.id,{...command,result:await f.run(command.script)});
 assert.throws(()=>f.jobs().verifiedForParent(f.parent),/parent-observation-refresh-required/);
 f.nodes[0].opacity=0.75;
 await f.step(first.operation.id,'update-readback');
 assert.equal(f.jobs().get(first.operation.id).phase,'update-recovery-required');
 assert.throws(()=>f.jobs().verifiedForParent(f.parent),/effective-observation-unavailable/);
});

test('design repair evidence cannot outlive its parent context or the tip of its correction chain',async t=>{
 const f=await fixture(t),first=f.prepare();await f.finish(first.operation.id);
 const observe=async(id:string)=>{const c=f.jobs().observeDesign(id);f.jobs().accept(id,{...c,result:await f.run(c.script)});};
 await observe(first.operation.id);assert.ok(f.jobs().designEvidence(first.operation.id));
 assert.throws(()=>withEvidenceReadSnapshot(()=>f.jobs().designEvidence(first.operation.id)),/write-during-evidence-read-snapshot/);
 f.moveParent();assert.throws(()=>f.jobs().designEvidence(first.operation.id),/parent-observation-refresh-required/);
 await f.step(first.operation.id,'update-readback');await observe(first.operation.id);
 assert.ok(f.jobs().designEvidence(first.operation.id));
 f.next();const second=f.prepare();await f.step(second.operation.id,'update-preflight-readback');await f.step(second.operation.id,'update-apply');
 assert.throws(()=>f.jobs().designEvidence(first.operation.id),/effective-observation-unavailable/);
 await f.step(second.operation.id,'update-readback');await observe(second.operation.id);
 assert.throws(()=>f.jobs().designEvidence(first.operation.id),/superseded-observation-is-historical/);
 assert.equal(f.jobs().designEvidence(second.operation.id).input.component.variants[0].spec.opacity,0.125);
});

test('an allocation correction survives journal restart and requires the subsequent component review before repair',async t=>{
 const f=await fixture(t);
 f.input.desired=f.desiredFor({...f.tokens,newOpacity:{$type:'number',$value:0.6}});
 // The pending component correction must remain separate from allocation.
 for(const v of f.input.desired.component.variants)v.spec.opacity=0.6;
 f.input.desired.revision=revisionOf(f.input.desired.component);
 const first=f.prepare();assert.equal(first.proposal.tokenAllocations?.length,1);
 assert.equal(first.proposal.compilerReviewRequired,true);
 await f.step(first.operation.id,'update-preflight-readback');f.restart();
 await f.step(first.operation.id,'update-apply');
 assert.throws(()=>f.prepare(),/effective-observation-unavailable/);
 await f.step(first.operation.id,'update-readback');
 assert.equal(f.jobs().get(first.operation.id).phase,'update-verified');
 assert.throws(()=>f.jobs().designEvidence(first.operation.id),/compiler-review-required-after-token-allocation/);
 const second=f.prepare();assert.notEqual(second.proposal.id,first.proposal.id);
 assert.equal(second.proposal.tokenAllocations,undefined);assert.equal(second.proposal.changes.length,2);
 await f.finish(second.operation.id);
 assert.equal(f.jobs().get(second.operation.id).phase,'update-verified');
 assert.equal(f.jobs().verifiedForParent(f.parent)!.input.tokenIdentity.variables.length,3);
 const design=f.jobs().observeDesign(second.operation.id);f.jobs().accept(second.operation.id,{...design,result:await f.run(design.script)});
 assert.ok(f.jobs().designEvidence(second.operation.id));
 assert.equal(f.plans.prepare(f.parent).id,second.proposal.id,'a settled repeat does not allocate or duplicate');
});

test('a second correction starts at the verified first result, survives restart and preserves history',async t=>{
 const f=await fixture(t),first=f.prepare();await f.finish(first.operation.id);
 const original=readFileSync(path.join(f.repo,'private/source-native-update-plans',f.parent,first.proposal.id+'.json'),'utf8');
 f.next();const second=f.prepare(),record=f.plans.saved(f.parent,second.proposal.id);
 assert.equal(record.predecessor?.proposalId,first.proposal.id);
 assert.ok(record.update.plan.changes.every(c=>c.before===0.25&&c.after===0.125));
 await f.step(second.operation.id,'update-preflight-readback');f.restart();
 await f.step(second.operation.id,'update-apply');
 assert.throws(()=>f.jobs().verifiedForParent(f.parent),/effective-observation-unavailable/);
 await f.step(second.operation.id,'update-readback');
 assert.equal(f.jobs().get(second.operation.id).sourceCurrent,true);
 assert.equal(f.jobs().verifiedForParent(f.parent)!.input.component.variants[0].spec.opacity,0.125);
 assert.equal(f.jobs().get(first.operation.id).sourceCurrent,false);
 assert.equal(f.jobs().get(first.operation.id).superseded,true);
 assert.throws(()=>f.jobs().dispatch(first.operation.id,'update-readback'),/superseded-observation/);
 assert.equal(f.plans.prepare(f.parent).id,second.proposal.id,'repeat preparation reopens the verified correction');
 assert.equal(readFileSync(path.join(f.repo,'private/source-native-update-plans',f.parent,first.proposal.id+'.json'),'utf8'),original);
 f.stale();assert.throws(()=>f.jobs().verifiedForParent(f.parent),/source drift/);
});

test('an unresolved earlier write blocks a successor and competing proposals cannot write',async t=>{
 const f=await fixture(t),first=f.prepare();await f.step(first.operation.id,'update-preflight-readback');
 f.next();const competing=f.prepare();await f.step(competing.operation.id,'update-preflight-readback');
 // The first proposal's compiler input changed, so it cannot write either.
 assert.throws(()=>f.jobs().dispatch(first.operation.id,'update-apply'),/input-changed/);
 await f.step(competing.operation.id,'update-apply');
 assert.throws(()=>f.prepare(),/effective-observation-unavailable/);
 await f.step(competing.operation.id,'update-readback');
 for(const v of f.input.desired.component.variants)v.spec.opacity=0.25;
 f.input.desired.revision=f.plans.saved(f.parent,first.proposal.id).update.plan.desiredRevision;
 assert.throws(()=>f.jobs().dispatch(first.operation.id,'update-apply'),/input-changed/);
});

test('a changed native field or predecessor journal cannot be adopted as the second baseline',async t=>{
 const f=await fixture(t),first=f.prepare();await f.finish(first.operation.id);f.next();const second=f.prepare();
 f.nodes[0].name='designer edit';
 const refused=await f.step(second.operation.id,'update-preflight-readback');assert.equal(refused.phase,'update-refused');
 assert.throws(()=>f.jobs().dispatch(second.operation.id,'update-apply'),/phase-refused/);
 f.nodes[0].name=f.plans.saved(f.parent,first.proposal.id).update.plan.baseline.nodes!.find(n=>n.id===f.nodes[0].id)!.name;
 await f.step(first.operation.id,'update-readback');
 assert.throws(()=>f.plans.current(f.parent,second.proposal.id),/input-changed/);
});


test('a migrated allocation is retained through repeat preparation and a later scalar correction',async t=>{
 const f=await fixture(t,nativeBackgroundUpdateFixture),first=f.prepare();
 await f.finish(first.operation.id);
 assert.equal(f.plans.prepare(f.parent).id,first.proposal.id);
 const original=f.jobs().verifiedForParent(f.parent)!;
 f.next();const second=f.prepare(),record=f.plans.saved(f.parent,second.proposal.id);
 assert.equal(record.update.plan.kind,'native-contract-opacity-update');
 assert.deepEqual(record.update.plan.before.creation.nodes,original.input.creation.nodes);
 await f.finish(second.operation.id);
 assert.equal(f.jobs().get(second.operation.id).phase,'update-verified');
 assert.deepEqual(f.jobs().verifiedForParent(f.parent)!.input.creation.nodes,original.input.creation.nodes);
});

test('a paint migration follows a verified scalar correction without replacing its allocation owner',async t=>{
 const f=await fixture(t,nativeBackgroundUpdateFixture),paint=structuredClone(f.input.desired);
 f.input.desired.component=structuredClone(f.input.before.component);
 for(const v of f.input.desired.component.variants)v.spec.opacity=0.5;
 f.input.desired.revision=revisionOf(f.input.desired.component);
 const first=f.prepare();await f.finish(first.operation.id);
 const before=f.jobs().verifiedForParent(f.parent)!;
 f.input.desired=paint;
 const revision=revisionOf({updatedContract:true});
 const retag=(node:any)=>{node.nativeContractPart.contractRevision=revision;node.children?.forEach(retag);};
 for(const v of f.input.desired.component.variants){v.spec.opacity=0.5;retag(v.spec);}
 f.input.desired.revision=revisionOf(f.input.desired.component);
 const second=f.prepare();
 assert.equal(f.plans.saved(f.parent,second.proposal.id).update.plan.kind,'native-contract-background-update');
 await f.finish(second.operation.id);
 const after=f.jobs().verifiedForParent(f.parent)!;
 assert.deepEqual(after.input.creation.nodes.slice(0,before.input.creation.nodes.length),before.input.creation.nodes);
 assert.equal(after.input.component.variants[0].spec.nativeContractPart!.contractRevision,
   before.input.component.variants[0].spec.nativeContractPart!.contractRevision);
 assert.equal(after.input.component.variants[0].spec.opacity,0.5);
 assert.equal(f.plans.prepare(f.parent).id,second.proposal.id);
});
