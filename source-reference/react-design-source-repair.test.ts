import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {nativeUpdateFixture} from '../core/native-contract-update-test-fixture.js';
import {nativeDesignChanges} from '../core/native-design-changes.js';
import {planReactOpacitySourceRepair} from './react-design-source-repair.js';

const text='function Control() { return <button className="disabled:opacity-50"/>; }';
const source={module:'control.tsx',exportName:'Control',span:{start:0,end:text.length},sourceSha256:createHash('sha256').update(text).digest('hex')};
async function fixture() {
  const f=await nativeUpdateFixture(),baseline=structuredClone(f.input.baseline),observed=structuredClone(baseline);
  observed.nodes!.find((n:any)=>n.id===f.nodes[0].id)!.values.opacity=0.6;
  return {operationId:'10000000-0000-4000-8000-000000000009',parentId:f.input.before.operation.id,
    proposalId:'a'.repeat(64),journalRevision:'b'.repeat(64),attemptId:'10000000-0000-4000-8000-000000000010',
    input:f.input.before,baseline,observed,difference:nativeDesignChanges(baseline,observed)};
}

test('a full native opacity difference becomes an original-source candidate with the same pinned identities',async()=>{
  const evidence=await fixture(),plan=planReactOpacitySourceRepair(evidence,text,source);
  assert.equal(plan.qualification,'unverified-original-source-repair');
  assert.equal(plan.journalRevision,evidence.journalRevision);assert.equal(plan.attemptId,evidence.attemptId);
  assert.equal(plan.changes.length,1);assert.equal(plan.candidates.length,1);
  assert.equal(plan.candidates[0].result,text.replace('disabled:opacity-50','disabled:opacity-60'));
  assert.deepEqual(planReactOpacitySourceRepair(evidence,text,source),plan,'same bytes produce the same plan');
  assert.equal(evidence.observed.nodes!.find((n:any)=>n.id===plan.changes[0].nodeId)!.values.opacity,0.6);
});

test('the source planner refuses a partial display diff, added nodes, metadata drift, reparenting and extra channels',async()=>{
  const original=await fixture();
  for(const mutation of [
    (e:typeof original)=>{e.difference.changes=[];},
    (e:typeof original)=>{e.observed.nodes!.push({...e.observed.nodes![0],id:'extra'});},
    (e:typeof original)=>{e.observed.nodes![0].parentId='different-parent';},
    (e:typeof original)=>{e.observed.nodes![0].values.unknown='different';},
    (e:typeof original)=>{e.observed.status='refused';},
    (e:typeof original)=>{e.observed.planRevision='sha256:'+'c'.repeat(64);},
    (e:typeof original)=>{e.observed.problems.push('unreadable');},
  ]) {
    const changed=structuredClone(original);mutation(changed);
    if(changed.difference.changes.length)changed.difference=nativeDesignChanges(changed.baseline,changed.observed);
    assert.throws(()=>planReactOpacitySourceRepair(changed,text,source),/difference-changed|root-opacity-edit-required|unsupported-change|other-native-facts-changed/);
  }
  const extra=structuredClone(original);
  for(let i=0;i<205;i++)extra.observed.nodes![0].values['extra-'+i]=i;
  extra.difference=nativeDesignChanges(extra.baseline,extra.observed);
  assert.throws(()=>planReactOpacitySourceRepair(extra,text,source),/unsupported-change/);
  extra.difference.changes=extra.difference.changes.slice(0,200);
  assert.throws(()=>planReactOpacitySourceRepair(extra,text,source),/difference-changed/);
});
