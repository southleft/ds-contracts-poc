import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePlan, planHash } from './react-native-replay.js';

test('plan normalization drops only run-derived values', () => {
  const plan = (op: string, run: string, color: string) => ({
    operation: { id: op }, componentRevision: 'sha256:' + run, requestRevision: 'sha256:' + run,
    tokenInput: { scopeId: 'source-' + op, source: { sourceProgramSha256: run } },
    component: { setName: 'Root', fill: color, nativeContractDraft: { revision: 'sha256:' + run, acceptedContract: null }, owner: 'observed ' + op },
  });
  const a = plan('11111111-1111-4111-8111-111111111111', 'a', '#fff'), b = plan('22222222-2222-4222-8222-222222222222', 'b', '#fff');
  assert.equal(planHash(a), planHash(b), 'operation ids, run revisions and path-derived hashes do not count');
  assert.notEqual(planHash(a), planHash(plan('11111111-1111-4111-8111-111111111111', 'a', '#000')), 'a compiled value does');
  assert.match(normalizePlan(a), /observed <id>/);
});

test('an observation-named draft replays equal across platforms; its content still counts', () => {
  const plan = (suffix: string, width: number, second = suffix) => ({
    draftRevision: 'sha256:' + suffix, projection: { contractRevision: 'sha256:' + suffix, tokenRevision: 'sha256:' + suffix },
    component: { contractId: `observed.react-initial-${suffix}`, setName: `InitialStates${suffix}StateApi`,
      variants: [{ spec: { fixedWidth: { varName: `imported/initial-states${suffix}/root/width` }, width } }],
      other: `observed.react-initial-${second}` },
    tokenInput: { modes: [{ tokenTreeRevision: 'sha256:' + suffix, tokens: { imported: { [`initial-states${suffix}`]: { w: { $value: `${width}px` } } } } }] },
  });
  // Measured: Linux and macOS name the same Switch draft from different raster digests.
  assert.equal(planHash(plan('2b72f17fbaa2049c', 44)), planHash(plan('3c02f9a3c2c5077f', 44)));
  assert.notEqual(planHash(plan('2b72f17fbaa2049c', 44)), planHash(plan('3c02f9a3c2c5077f', 45)), 'a compiled value still counts');
  // Two different observed names stay distinguishable from one name used twice.
  assert.notEqual(planHash(plan('2b72f17fbaa2049c', 44, '1111111111111111')), planHash(plan('2b72f17fbaa2049c', 44)));
  assert.match(normalizePlan(plan('2b72f17fbaa2049c', 44)), /InitialStates<observed-0>StateApi/);
});
