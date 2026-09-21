import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { storeNativeUpdatePrograms, loadNativeUpdatePrograms } from './native-update-programs.js';
import { createNativeUpdatePlans } from './native-update-plans.js';
import { createNativeUpdateJobs } from './native-update-jobs.js';
import { nativeUpdateFixture } from '../core/native-contract-update-test-fixture.js';
import { emitNativeContractReadbackScript } from '../core/native-source-observation.js';
import { emitNativeContractUpdateScript } from '../core/native-contract-update.js';

const sha = (script: string) => createHash('sha256').update(script).digest('hex');
const make = (count: number) => {
  const scripts = Object.fromEntries(['update-preflight-readback','update-apply','update-readback'].map((phase, i) => {
    const script = '// ' + 'x'.repeat(count) + '\nreturn ' + i + ';'; return [phase, { script, sha256: sha(script) }];
  })) as Parameters<typeof storeNativeUpdatePrograms>[0]['scripts'];
  return { version: 1 as const, id: 'unchanged-operation', planRevision: 'unchanged-plan', scripts };
};
test('ordinary headers keep byte-identical inline programs and write no blobs', () => {
  const header = make(100), bytes = JSON.stringify(header);
  const stored = storeNativeUpdatePrograms(header, () => assert.fail('unexpected write'));
  assert.equal(JSON.stringify(stored), bytes);
  assert.equal(JSON.stringify(loadNativeUpdatePrograms(stored, () => assert.fail('unexpected read'))), bytes);
});
test('large headers use bounded hash-addressed records and reconstruct the complete original header', () => {
  const header = make(2*1024*1024), records = new Map<string, unknown>();
  const stored = storeNativeUpdatePrograms(header, (name, value) => {
    assert.match(name, /^program-[a-f0-9]{64}\.json$/); assert.equal(records.has(name), false);
    assert.ok(Buffer.byteLength(JSON.stringify(value)) <= 4*1024*1024); records.set(name, value);
  });
  assert.equal(stored.version, 2); assert.equal(records.size, 3);
  assert.ok(Buffer.byteLength(JSON.stringify(stored)) < 1024);
  assert.deepEqual(loadNativeUpdatePrograms(stored, name => records.get(name)), header);
  for (const change of [
    (r: any) => { r.scripts['update-apply'].sha256 = '../outside'; },
    (r: any) => { r.scripts['update-apply'].script = 'unverified'; },
    (r: any) => { delete r.scripts['update-readback']; },
  ]) { const bad = structuredClone(stored); change(bad); assert.throws(() => loadNativeUpdatePrograms(bad, name => records.get(name)), /record-invalid/); }
  assert.throws(() => loadNativeUpdatePrograms(stored, () => ({ script: 'changed' })), /record-invalid/);
  assert.throws(() => loadNativeUpdatePrograms(stored, () => undefined), /record-invalid/);
});
test('duplicate programs share one record and oversized programs refuse before any record is written', () => {
  const header = make(2*1024*1024), records = new Map<string, unknown>();
  header.scripts['update-readback'] = header.scripts['update-preflight-readback'];
  const stored = storeNativeUpdatePrograms(header, (name, value) => { assert.equal(records.has(name), false); records.set(name, value); });
  assert.equal(records.size, 2); assert.deepEqual(loadNativeUpdatePrograms(stored, name => records.get(name)), header);
  assert.throws(() => storeNativeUpdatePrograms(make(4*1024*1024), () => assert.fail('partial write')), /record-too-large/);
  const forged = make(100); forged.scripts['update-apply'].sha256 = 'a'.repeat(64);
  assert.throws(() => storeNativeUpdatePrograms(forged, () => assert.fail('partial write')), /record-invalid/);
});

test('a large real update journal survives restart, dispatch and independent verification without relaxing record limits', async t => {
  const h = await nativeUpdateFixture(), repo = mkdtempSync(path.join(tmpdir(), 'native-update-programs-'));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const plans = createNativeUpdatePlans(repo, () => ({ parentJournalRevision: 'a'.repeat(64), input: h.input }));
  const parentId = h.input.before.operation.id, proposal = plans.prepare(parentId), plan = plans.saved(parentId, proposal.id).update.plan;
  const scripts = Object.fromEntries([
    ['update-preflight-readback', emitNativeContractUpdateScript(plan, 'apply', true)],
    ['update-apply', emitNativeContractUpdateScript(plan)],
    ['update-readback', emitNativeContractReadbackScript(plan.after, true, true)],
  ].map(([phase, script]) => [phase, { script, sha256: sha(script) }]));
  const inlineBytes = Buffer.byteLength(JSON.stringify({ version: 1, id: 'x'.repeat(36), parentId, proposalId: proposal.id,
    planRevision: plans.saved(parentId, proposal.id).update.revision, scripts }));
  const padding = '// ' + 'x'.repeat(4*1024*1024 - inlineBytes + 1024) + '\n';
  const readers = { readback: ((...args: Parameters<typeof emitNativeContractReadbackScript>) => padding + emitNativeContractReadbackScript(...args)) };
  let jobs = createNativeUpdateJobs(repo, plans, readers), operation = jobs.prepare(parentId, proposal.id);
  const dir = path.join(repo, 'private/source-native-updates', operation.id), header = JSON.parse(readFileSync(path.join(dir, 'operation.json'), 'utf8'));
  assert.equal(header.version, 2);
  for (const phase of ['update-preflight-readback','update-apply','update-readback'] as const) {
    jobs = createNativeUpdateJobs(repo, plans, readers);
    const command = jobs.dispatch(operation.id, phase);
    assert.ok(Buffer.byteLength(JSON.stringify(command)) < 4*1024*1024);
    operation = jobs.accept(operation.id, { ...command, result: await h.run(command.script) });
  }
  assert.equal(operation.phase, 'update-verified'); assert.equal(operation.sourceCurrent, true);
  const target = path.join(dir, 'program-' + header.scripts['update-apply'].sha256 + '.json');
  writeFileSync(target, JSON.stringify({ script: 'return {status:"updated"};' }));
  assert.throws(() => createNativeUpdateJobs(repo, plans, readers).get(operation.id), /program-record-invalid/);
});
