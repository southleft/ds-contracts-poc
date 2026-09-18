import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeDefaultFillUpdateFixture as fixture } from './native-contract-default-fill-update-test-fixture.js';
import { NATIVE_DEFAULT_FILL } from './native-contract-default-fill-update.js';
import { prepareNativeContractUpdate, emitNativeContractUpdateScript, nativeContractUpdateMatches, verifyNativeContractUpdate } from './native-contract-update.js';
import { verifyNativeContractReadback } from './native-source-observation.js';

test('retained refused root fills are corrected without allocation, repeat writes, or loss of rollback', async () => {
  const f = await fixture(), ids = f.figma.root.findAll(() => true).map((n:any) => n.id);
  assert.equal(verifyNativeContractReadback(f.input.before, f.input.baseline).status, 'refused');
  assert.equal(f.plan.kind, 'native-contract-default-fill-update');
  const pre = await f.run(emitNativeContractUpdateScript(f.plan, 'apply', true));
  assert.equal(pre.status, 'preflight-observed', JSON.stringify(pre.problems));
  assert.ok(nativeContractUpdateMatches(f.plan, pre.observation));
  assert.equal(nativeContractUpdateMatches(f.plan, pre.observation, true), false);
  const applied = await f.run(emitNativeContractUpdateScript(f.plan));
  assert.equal(applied.status, 'updated', JSON.stringify(applied.problems));
  assert.equal(verifyNativeContractUpdate(f.plan, applied.observation).status, 'supported-structure-observed');
  assert.ok(nativeContractUpdateMatches(f.plan, applied.observation, true));
  assert.deepEqual(f.figma.root.findAll(() => true).map((n:any) => n.id), ids);
  assert.equal((await f.run(emitNativeContractUpdateScript(f.plan))).status, 'no-op');
  const rolled = await f.run(emitNativeContractUpdateScript(f.plan, 'rollback'));
  assert.equal(rolled.status, 'updated');
  assert.deepEqual(rolled.observation, f.input.baseline);
  assert.equal(verifyNativeContractUpdate(f.plan, rolled.observation).status, 'refused', 'rollback restores the actual failed baseline; it is not qualification');
});

test('only the exact default fill is repairable and every other structural failure remains refused', async () => {
  const f = await fixture();
  for (const mutate of [
    (r:any) => { r.values.fills[0].visible = true; },
    (r:any) => { r.values.fills[0].color.r = 0; },
    (r:any) => { r.values.fills[0].opacity = 0; },
    (r:any) => { r.values.fills[0].boundVariables.color = {type:'VARIABLE_ALIAS', id:'unknown'}; },
    (r:any) => { r.values.opacity = 0.9; },
    (r:any) => { r.metadata.nativeContractPart = '{}'; },
  ]) {
    const input = structuredClone(f.input); mutate(input.baseline.nodes!.find(r => r.id === f.nodes[0].id));
    assert.throws(() => prepareNativeContractUpdate(input));
  }
  const mixed = structuredClone(f.input); mixed.desired.component.variants[0].spec.opacity = 0.7;
  assert.throws(() => prepareNativeContractUpdate(mixed), /mixed-channels/);
  f.nodes[0].name = 'User changed name';
  const conflict = await f.run(emitNativeContractUpdateScript(f.plan));
  assert.equal(conflict.status, 'refused'); assert.deepEqual(conflict.changes, []);
  assert.deepEqual(f.nodes[1].fills, NATIVE_DEFAULT_FILL);
});

test('partial corrections resume, assignment failures restore paints, and unrelated post-write edits survive', async () => {
  const f = await fixture(); f.nodes[0].fills = [];
  const partial = await f.run(emitNativeContractUpdateScript(f.plan));
  assert.equal(partial.status, 'updated'); assert.deepEqual(partial.changes, [f.nodes[1].id]);
  await f.run(emitNativeContractUpdateScript(f.plan, 'rollback'));
  let value = f.nodes[1].fills;
  Object.defineProperty(f.nodes[1], 'fills', { configurable:true, get:()=>value, set:(v:any) => { if (!v.length) throw Error('assignment failed'); value=v; } });
  const failed = await f.run(emitNativeContractUpdateScript(f.plan));
  assert.equal(failed.status, 'rolled-back');
  assert.ok(f.nodes.every((n:any) => JSON.stringify(n.fills) === JSON.stringify(NATIVE_DEFAULT_FILL)));
  const edited = await fixture(); let paint = edited.nodes[0].fills;
  Object.defineProperty(edited.nodes[0], 'fills', { configurable:true, get:()=>paint, set:(v:any) => {paint=v;if(!v.length)edited.nodes[1].name='Independent edit';} });
  const refused = await edited.run(emitNativeContractUpdateScript(edited.plan));
  assert.equal(refused.status, 'rolled-back'); assert.equal(edited.nodes[1].name, 'Independent edit');
});
