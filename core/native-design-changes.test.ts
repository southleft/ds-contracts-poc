import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeUpdateFixture } from './native-contract-update-test-fixture.js';
import { emitNativeContractReadbackScript } from './native-source-observation.js';
import { nativeDesignChanges } from './native-design-changes.js';

test('an untouched canvas reports no design changes, including float32 storage of recorded values', async () => {
  const f = await nativeUpdateFixture(), read = () => f.run(emitNativeContractReadbackScript(f.input.before));
  const recorded = await read();
  assert.deepEqual(nativeDesignChanges(recorded, await read()), { version: 1, kind: 'native-design-changes', acceptedContract: null, changes: [], added: [], removed: [] });
  const stored = structuredClone(recorded);
  for (const row of stored.nodes) if (row.type === 'COMPONENT') row.values.opacity = Math.fround(0.4);
  const intended = structuredClone(recorded);
  for (const row of intended.nodes) if (row.type === 'COMPONENT') row.values.opacity = 0.4;
  assert.equal(nativeDesignChanges(intended, stored).changes.length, 0);
});

test('every designer edit is named by node, variant and channel without a channel list', async () => {
  const f = await nativeUpdateFixture(), read = () => f.run(emitNativeContractReadbackScript(f.input.before));
  const recorded = await read(), [first, second] = f.nodes as any[];
  first.opacity = 0.8; second.cornerRadius = 12; second.name = 'Kind=renamed';
  const observed = nativeDesignChanges(recorded, await read());
  assert.deepEqual(observed.changes.filter(c => c.nodeId === first.id).map(c => [c.channel, c.recorded, c.observed]), [['opacity', 0.5, 0.8]]);
  assert.equal(observed.changes.find(c => c.nodeId === first.id)!.variant, first.name);
  const renamed = observed.changes.filter(c => c.nodeId === second.id).map(c => c.channel);
  assert.ok(renamed.includes('name') && renamed.some(channel => /radius/i.test(channel)), renamed.join());
  assert.deepEqual([observed.added, observed.removed], [[], []]);
});

test('added and removed nodes are reported, and readbacks of different operations are refused', async () => {
  const f = await nativeUpdateFixture(), recorded = await f.run(emitNativeContractReadbackScript(f.input.before));
  const observed = structuredClone(recorded), gone = observed.nodes.pop()!;
  observed.nodes.push({ ...structuredClone(gone), id: '999:1' });
  const result = nativeDesignChanges(recorded, observed);
  assert.deepEqual([result.added, result.removed], [['999:1'], [gone.id]]);
  assert.throws(() => nativeDesignChanges(recorded, { ...observed, operationId: '00000000-0000-4000-8000-000000000000' }), /readback-mismatch/);
  assert.throws(() => nativeDesignChanges(recorded, { ...observed, nodes: [...observed.nodes, observed.nodes[0]] }), /duplicate-node/);
});
