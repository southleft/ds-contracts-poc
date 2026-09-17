import {nativeBackgroundUpdateFixture} from '../core/native-contract-background-update-test-fixture.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {revisionOf} from '../core/contract-provenance.js';
import {nativeUpdateFixture} from '../core/native-contract-update-test-fixture.js';
import {createNativeUpdatePlans} from './native-update-plans.js';
import {createNativeUpdateJobs} from './native-update-jobs.js';

async function fixture(t:test.TestContext,make:typeof nativeUpdateFixture|typeof nativeBackgroundUpdateFixture=nativeUpdateFixture) {
 const f=await make(),repo=mkdtempSync(path.join(tmpdir(),'native-update-chain-'));
 t.after(()=>rmSync(repo,{recursive:true,force:true}));
 let stale=false;
 const plans=createNativeUpdatePlans(repo,()=>{if(stale)throw Error('source drift');return {parentJournalRevision:'a'.repeat(64),input:f.input};},id=>jobs.updateHistory(id));
 let jobs=createNativeUpdateJobs(repo,plans);
 const parent=f.input.before.operation.id;
 const prepare=()=>{const p=plans.prepare(parent);return {proposal:p,operation:jobs.prepare(parent,p.id)};};
 const step=async(id:string,phase:'update-preflight-readback'|'update-apply'|'update-readback')=>{
  const c=jobs.dispatch(id,phase);return jobs.accept(id,{...c,result:await f.run(c.script)});
 };
 const finish=async(id:string)=>{for(const p of ['update-preflight-readback','update-apply','update-readback'] as const)await step(id,p);};
 const next=()=>{for(const v of f.input.desired.component.variants)v.spec.opacity=0.125;f.input.desired.revision=revisionOf(f.input.desired.component);};
 return {...f,repo,parent,plans,prepare,step,finish,next,jobs:()=>jobs,stale:()=>{stale=true;},restart:()=>{jobs=createNativeUpdateJobs(repo,plans);}};
}

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
