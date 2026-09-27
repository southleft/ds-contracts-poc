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
