import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { revisionOf } from '../core/contract-provenance.js';
import { stateApiEvidence, stateApiObservation } from './react-state-api-fixture.js';
import { planReactStateApi } from './react-state-api.js';
import { readReactStateApiNativeRecord, readReactStateApiInitialIdentity, readReactStateApiInspection, type ReactStateApiRequest, type ReactStateApiInspection } from './react-state-api-inspection.js';
import { evidenceSha, inventoryEvidence } from './react-validation-evidence.js';
import type { ReactStateApiNativeRequest } from './react-state-api-native-request.js';

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'state-api-record-')), id = randomUUID(), dir = path.join(root, id);
  const source = path.join(root, 'source.tsx'); mkdirSync(dir); writeFileSync(source, 'source');
  const { initial, behavior } = stateApiEvidence();
  initial.id = randomUUID();
  initial.draft!.compiled!.contract!.id = 'observed.react-initial-0123456789abcdef';
  for(const row of behavior.observation!.rows)row.callback='onNotify';
  for(const row of behavior.observation!.relationships)row.callback='onNotify';
  for(const row of behavior.observation!.candidates)row.callback='onNotify';
  for(const row of behavior.observation!.refusals!)row.callback='onNotify';
  const plan = planReactStateApi(initial, behavior), hash = 'a'.repeat(64);
  const request: ReactStateApiRequest = { version: 1, source: { version: 1, caseId: plan.caseId, anchor: {
    version: 1, kind: 'react-root-draft', caseId: plan.caseId, referenceId: hash, ownership: { id: randomUUID(), sha256: hash },
    inventorySha256: hash, matrixRevision: 'sha256:' + hash,
  } }, initialRevision: revisionOf(initial), callbackRevision: revisionOf(behavior), observerRevision: 'sha256:' + hash, plan };
  const observation = stateApiObservation(plan);
  const report: ReactStateApiInspection = { id, caseId: plan.caseId, phase: 'complete', qualification: plan.qualification,
    plan, sourceUnchanged: true, restorationChecks: 81, observation, problems: [] };
  const save = (file: string, data: unknown) => writeFileSync(path.join(dir, file), JSON.stringify(data));
  save('request.json', request); save('program.json', { files: { [source]: evidenceSha(readFileSync(source)) } });
  save('initial-input.json', initial); save('callback-input.json', behavior); save('report.json', report);
  const seal = () => {
    // Reordered JSON object keys must not affect valid evidence. This fixture
    // can deliberately reseal malformed producer output to exercise semantics.
    const files = inventoryEvidence(dir); delete files['integrity.json'];
    save('integrity.json', { version: 1, files: Object.fromEntries(Object.entries(files).reverse()) });
    writeFileSync(path.join(root, 'latest.json'), JSON.stringify({ id, inventorySha256: evidenceSha(readFileSync(path.join(dir, 'integrity.json'))) }));
  };
  seal();
  return { root, dir, source, initial, behavior, report, request, save, seal };
}

test('sealed state evidence reopens repeatedly and rejects changed requests, live source and file inventories', () => {
  const f = fixture();
  try {
    assert.deepEqual(readReactStateApiInspection(f.root, f.request), f.report);
    assert.deepEqual(readReactStateApiInspection(f.root, f.request), f.report);
    assert.equal(f.behavior.phase, 'failed');
    assert.throws(() => readReactStateApiInspection(f.root, { ...f.request, observerRevision: 'changed' }), /evidence-changed/);
    writeFileSync(f.source, 'changed');
    assert.throws(() => readReactStateApiInspection(f.root, f.request), /program-changed/);
    writeFileSync(f.source, 'source');
    const bytes = readFileSync(path.join(f.dir, 'report.json'));
    f.save('report.json', { ...f.report, sourceUnchanged: false });
    assert.throws(() => readReactStateApiInspection(f.root, f.request), /evidence-changed/);
    writeFileSync(path.join(f.dir, 'report.json'), bytes); f.save('unexpected.json', {});
    assert.throws(() => readReactStateApiInspection(f.root, f.request), /evidence-changed/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('a producer cannot qualify duplicate trials, corrupted callback history, missing restorations or substituted input records', () => {
  const changes: Array<(f: ReturnType<typeof fixture>) => void> = [
    f => { f.report.observation!.rows[1] = structuredClone(f.report.observation!.rows[0]); },
    f => { f.report.observation!.rows[0].steps[1].callback.calls[0] = [false]; },
    f => { f.report.observation!.rows[0].live.changed.checked = 'true'; },
    f => { f.report.restorationChecks--; },
    f => { f.report.phase = 'running'; },
    f => { f.behavior.id = 'substituted'; f.save('callback-input.json', f.behavior); },
  ];
  for (const change of changes) {
    const f = fixture();
    try {
      change(f); f.save('report.json', f.report); f.seal();
      assert.throws(() => readReactStateApiInspection(f.root, f.request), /state-api-/);
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  }
});


test('a native pin names the sealed state and appearance records and refuses failed or corrupted observations',()=>{
  const f=fixture();
  try {
    const result=readReactStateApiNativeRecord(f.root,f.request);
    assert.equal(result.pin.id,f.report.id);assert.equal(result.pin.key,revisionOf(f.request).slice(7));
    assert.equal(result.pin.reportSha256,evidenceSha(readFileSync(path.join(f.dir,'report.json'))));
    assert.equal(result.initialDraftRevision,revisionOf(f.initial.draft));assert.equal(result.draft.status,'generated-draft');
    assert.deepEqual(readReactStateApiNativeRecord(f.root,f.request),result);
    f.report.phase='failed';f.report.problems=['candidate-refused'];f.save('report.json',f.report);f.seal();
    assert.throws(()=>readReactStateApiNativeRecord(f.root,f.request),/native-observation-required/);
    f.report.phase='complete';f.report.problems=[];f.save('report.json',f.report);f.seal();
    f.initial.draft!.compiled!.contract!.props[0].bindings.code.prop='substituted';f.save('initial-input.json',f.initial);
    assert.throws(()=>readReactStateApiNativeRecord(f.root,f.request),/evidence-changed/);
  }finally{rmSync(f.root,{recursive:true,force:true})}
});


test('update namespace comes from the exact sealed creation archive even after source and latest observation move', t => {
  const f = fixture(); t.after(() => rmSync(f.root, { recursive: true, force: true }));
  const record = readReactStateApiNativeRecord(f.root, f.request);
  const pin: ReactStateApiNativeRequest = { version: 1, kind: 'react-state-api-draft',
    initial: { version: 1, kind: 'react-initial-draft', anchor: f.request.source.anchor, caseId: f.initial.caseId,
      observation: { id: f.initial.id, inventorySha256: 'a'.repeat(64), reportSha256: 'b'.repeat(64) } }, observation: record.pin };
  const repo = path.join(f.root, 'archive-repo'), root = path.join(repo, 'private/react-state-api-inspections', record.pin.key);
  mkdirSync(root, { recursive: true }); cpSync(f.dir, path.join(root, record.pin.id), { recursive: true });
  writeFileSync(path.join(root, 'latest.json'), JSON.stringify({ id: 'failed-later-experiment' }));
  writeFileSync(f.source, 'source changed');
  assert.equal(readReactStateApiInitialIdentity(repo, pin), f.initial.draft!.compiled!.contract!.id);
  assert.throws(() => readReactStateApiNativeRecord(f.root, f.request), /program-changed/, 'historical identity never makes a stale experiment writable');
  for (const bad of [
    { ...pin, observation: { ...pin.observation, reportSha256: 'f'.repeat(64) } },
    { ...pin, observation: { ...pin.observation, inventorySha256: 'f'.repeat(64) } },
    { ...pin, initial: { ...pin.initial, caseId: 'another' } },
    { ...pin, initial: { ...pin.initial, observation: { ...pin.initial.observation, id: randomUUID() } } },
  ]) assert.throws(() => readReactStateApiInitialIdentity(repo, bad), /state-api-/);
  const initialFile = path.join(root, record.pin.id, 'initial-input.json');
  writeFileSync(initialFile, readFileSync(initialFile, 'utf8').replace('0123456789abcdef', 'fedcba9876543210'));
  assert.throws(() => readReactStateApiInitialIdentity(repo, pin), /evidence-changed/);
});
