import { nativeUpdateFixture as fixture } from './native-contract-update-test-fixture.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createNativeUpdatePlans } from '../source-reference/native-update-plans.js';
import { prepareNativeContractUpdate, emitNativeContractUpdateScript, verifyNativeContractUpdate } from './native-contract-update.js';

test('owned scalar update preserves identities, verifies, repeats without writes, and rolls back', async () => {
  const f = await fixture(), ids = f.figma.root.findAll(() => true).map((n:any)=>n.id);
  assert.equal(f.plan.changes.length,2);
  const preflight = await f.run(emitNativeContractUpdateScript(f.plan,'apply',true));
  assert.equal(preflight.status,'preflight-observed'); assert.ok(f.nodes.every((n:any)=>n.opacity===0.5));
  const applied = await f.run(emitNativeContractUpdateScript(f.plan));
  assert.equal(applied.status,'updated',JSON.stringify(applied.problems));
  assert.equal(verifyNativeContractUpdate(f.plan,applied.observation).status,'supported-structure-observed');
  assert.ok(f.nodes.every((n:any)=>n.opacity===0.25));
  assert.deepEqual(f.figma.root.findAll(()=>true).map((n:any)=>n.id),ids);
  const repeat = await f.run(emitNativeContractUpdateScript(f.plan));
  assert.equal(repeat.status,'no-op'); assert.deepEqual(repeat.changes,[]);
  const rollback = await f.run(emitNativeContractUpdateScript(f.plan,'rollback'));
  assert.equal(rollback.status,'updated'); assert.ok(f.nodes.every((n:any)=>n.opacity===0.5));
  assert.equal(verifyNativeContractUpdate(f.plan,rollback.observation,'rollback').status,'supported-structure-observed');
});

test('updates refuse changed live fields and unsupported desired channels before any write', async () => {
  const f = await fixture();
  const changed = structuredClone(f.input); changed.desired.component.variants[0].spec.fixedWidth!.px = 17;
  assert.throws(()=>prepareNativeContractUpdate(changed),/channel-change-unsupported/);
  const changedTokens = structuredClone(f.input); changedTokens.desired = structuredClone(f.input.desired);
  (changedTokens.desired.tokenInput.modes[0].tokens as any).size.$value = '17px';
  assert.throws(()=>prepareNativeContractUpdate(changedTokens),/token-change-unsupported/);
  for (const field of ['opacity','width','name']) {
    const previous = f.nodes[0][field]; f.nodes[0][field] = field === 'name' ? 'manual edit' : field === 'opacity' ? 0.75 : 30;
    const result = await f.run(emitNativeContractUpdateScript(f.plan));
    assert.equal(result.status,'refused'); assert.deepEqual(result.changes,[]); assert.equal(f.nodes[1].opacity,0.5);
    f.nodes[0][field] = previous;
  }
  f.figma.fileKey='DifferentAuthorizedFile';
  const wrongFile=await f.run(emitNativeContractUpdateScript(f.plan));
  assert.equal(wrongFile.status,'refused'); assert.ok(f.nodes.every((n:any)=>n.opacity===0.5));
});

test('a partial application can be inspected and resumed, while assignment failure restores attempted nodes', async () => {
  const f = await fixture(); f.nodes[0].opacity = 0.25;
  const read = await f.run(emitNativeContractUpdateScript(f.plan,'apply',true));
  assert.equal(read.status,'preflight-observed'); assert.deepEqual(read.states.map((s:any)=>s.value),[0.25,0.5]);
  const resumed = await f.run(emitNativeContractUpdateScript(f.plan));
  assert.equal(resumed.status,'updated'); assert.deepEqual(resumed.changes,[f.nodes[1].id]);
  await f.run(emitNativeContractUpdateScript(f.plan,'rollback'));
  let value = f.nodes[1].opacity;
  Object.defineProperty(f.nodes[1],'opacity',{get:()=>value,set:(next:number)=>{ if(next===0.25) throw Error('native assignment failed'); value=next; },configurable:true});
  const failed = await f.run(emitNativeContractUpdateScript(f.plan));
  assert.equal(failed.status,'rolled-back'); assert.ok(f.nodes.every((n:any)=>n.opacity===0.5));
});

test('host update proposals reopen unchanged and reject drift, path substitution and altered records', async t => {
  const f=await fixture(),repo=mkdtempSync(path.join(tmpdir(),'native-update-plan-'));
  t.after(()=>rmSync(repo,{recursive:true,force:true}));
  const parentId=f.input.before.operation.id;
  let journal='a'.repeat(64);
  const store=()=>createNativeUpdatePlans(repo,()=>({parentJournalRevision:journal,input:f.input}));
  const first=store().prepare(parentId);
  assert.deepEqual(store().prepare(parentId),first);
  assert.deepEqual(store().list(parentId),[first]);
  assert.equal(store().current(parentId,first.id).update.plan.changes.length,2);
  journal='b'.repeat(64);
  assert.throws(()=>store().current(parentId,first.id),/input-changed/);
  assert.throws(()=>store().list('../outside'),/parent-invalid/);
  journal='a'.repeat(64);
  const file=path.join(repo,'private/source-native-update-plans',parentId,first.id+'.json');
  const altered=JSON.parse(readFileSync(file,'utf8')); altered.update.plan.changes[0].after=0;
  writeFileSync(file,JSON.stringify(altered));
  assert.throws(()=>store().current(parentId,first.id),/plan-changed/);
  assert.throws(()=>store().prepare(parentId),/plan-changed/);
});

test('a failed postcondition restores only the attempted opacity changes and preserves other edits', async () => {
  const f=await fixture(),originalWidth=f.nodes[1].width;
  let opacity=f.nodes[0].opacity;
  Object.defineProperty(f.nodes[0],'opacity',{get:()=>opacity,set:(value:number)=>{
    opacity=value; if(value===0.25) f.nodes[1].width=originalWidth+1;
  },configurable:true});
  const result=await f.run(emitNativeContractUpdateScript(f.plan));
  assert.equal(result.status,'rolled-back');
  assert.ok(result.problems.includes('native-update-postcondition-conflict'));
  assert.ok(f.nodes.every((n:any)=>n.opacity===0.5));
  assert.equal(f.nodes[1].width,originalWidth+1);
});
