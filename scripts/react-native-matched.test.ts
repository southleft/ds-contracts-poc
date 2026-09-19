import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PNG } from 'pngjs';
import { MATCHED_EVIDENCE, checkMatchedEvidence, scoreMatchedEvidence, type MatchedManifest } from './react-native-matched-check.js';
import { authenticateMatchedOperation } from './react-native-matched-record.js';
import { REPO, sha256 } from './react-native-fidelity-check.js';
import type { DeclaredSpec } from './react-native-declared-record.js';
import { hasRecordedNativeMeasurement, readRecordedNativeMeasurement } from '../source-reference/matched-native-review.js';
import type { ReactInitialNativeRequest } from '../source-reference/react-initial-native-request.js';

const evidence = path.join(REPO, MATCHED_EVIDENCE);
const manifest = (): MatchedManifest => JSON.parse(readFileSync(path.join(evidence, 'manifest.json'), 'utf8'));
const temp = (fn: (dir: string) => void) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'matched-native-'));
  try { fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
};
test('new matched frames recompute on both backgrounds while historical evidence stays separate', () => {
  const result = checkMatchedEvidence(evidence);
  assert.equal(result.rows.length, 9);
  assert(result.rows.every(r => r.pass && r.scores.length === 2));
});
test('application review refuses another operation, source case or observation before reading private evidence', () => {
  const m = manifest(), operationId = String(m.cohort.native.operationId);
  const request = { kind: 'react-initial-draft', version: 1, caseId: m.cohort.source.caseId,
    anchor: { referenceId: m.cohort.source.referenceId }, observation: { id: m.cohort.source.inspectionId,
      reportSha256: m.cohort.source.reportSha256, inventorySha256: m.cohort.source.inventorySha256 } } as ReactInitialNativeRequest;
  assert(hasRecordedNativeMeasurement(REPO, operationId, request.anchor.referenceId));
  assert(!hasRecordedNativeMeasurement(REPO, 'wrong-operation', request.anchor.referenceId));
  assert.throws(() => readRecordedNativeMeasurement(REPO, 'wrong-operation', request), /operation-mismatch/);
  for (const changed of [{ ...request, caseId: 'other-case' },
    { ...request, anchor: { ...request.anchor, referenceId: '0'.repeat(64) } },
    { ...request, observation: { ...request.observation, reportSha256: '0'.repeat(64) } },
    { ...request, observation: { ...request.observation, inventorySha256: '0'.repeat(64) } },
  ]) assert.throws(() => readRecordedNativeMeasurement(REPO, operationId, changed), /operation-mismatch/);
});
test('geometry guards reject low-contrast one-pixel movement even with unchanged passing pixels', () => {
  for (const change of [
    (m: MatchedManifest) => { m.rows[0]!.native.rootPosition.x += 1; },
    (m: MatchedManifest) => { m.rows[0]!.native.rootSize.height = Math.fround(18.3906); },
    (m: MatchedManifest) => { m.rows[0]!.native.cloneSnapshotSha256 = '0'.repeat(64); },
  ]) {
    const m = manifest(); change(m);
    assert.throws(() => scoreMatchedEvidence(evidence, m), /geometry-changed/);
  }
});
test('coverage, producer identity and capture spans cannot silently change', () => {
  const m = manifest(); m.rows.pop(); assert.throws(() => scoreMatchedEvidence(evidence, m), /denominator/);
  const instrument = manifest(); instrument.instruments['source-reference/transparent-source-frame.ts'] = '0'.repeat(64);
  assert.throws(() => scoreMatchedEvidence(evidence, instrument), /instrument-changed/);
  const span = manifest(); span.rows[0]!.native.frameBounds.width += 1;
  assert.throws(() => scoreMatchedEvidence(evidence, span), /native-frame-invalid/);
});
test('stale PNGs, sibling contribution and native paint touching a crop edge fail independently of the pixel score', () => temp(dir => {
  cpSync(evidence, dir, { recursive: true });
  const mutateImage = (side: 'context' | 'native', x: number, y: number) => {
    const m = manifest(), file = path.join(dir, '0.' + side + '.png'), png = PNG.sync.read(readFileSync(file));
    png.data.set([255, 0, 0, 255], (y * png.width + x) * 4);
    const data = PNG.sync.write(png); writeFileSync(file, data);
    return { m, hash: sha256(data) };
  };
  const context = mutateImage('context', 40, 40);
  assert.throws(() => scoreMatchedEvidence(dir, context.m), /image-changed/);
  context.m.rows[0]!.files.context = context.hash; context.m.rows[0]!.source.contextSha256 = context.hash;
  assert.throws(() => scoreMatchedEvidence(dir, context.m), /source-context-changed/);
  cpSync(path.join(evidence, '0.context.png'), path.join(dir, '0.context.png'));
  const native = mutateImage('native', 0, 0); native.m.rows[0]!.files.native = native.hash;
  assert.throws(() => scoreMatchedEvidence(dir, native.m), /paint-outside-frame:native/);
}));

function fixture(dir: string) {
  const put = (name: string, value: unknown) => {
    const file = path.join(dir, name); mkdirSync(path.dirname(file), { recursive: true });
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value) + '\n');
    writeFileSync(file, bytes); return bytes;
  };
  const op = 'source-native-app/operations/probe', inspection = 'react-initial-inspections/probe/inspection';
  const png = PNG.sync.write(new PNG({ width: 30, height: 30 }));
  const request = { version: 1, anchor: { referenceId: 'reference' }, caseId: 'case' };
  const report = { phase: 'complete', sourceUnchanged: true, problems: [], observation: { rows: [
    { id: '0', status: 'observed', image: sha256(png), changes: { enabled: { kind: 'set', value: false } } },
  ] } };
  const state = { image: sha256(png), bounds: { x: 10, y: 10, width: 5, height: 5 } };
  const inputs = { 'request.json': request, 'report.json': report, 'states/0.json': state, 'states/0.png': png };
  const files = Object.fromEntries(Object.entries(inputs).map(([name, value]) => [name, sha256(put(inspection + '/' + name, value))]));
  const pin = { id: 'inspection', inventorySha256: sha256(put(inspection + '/integrity.json', { version: 1, files })), reportSha256: files['report.json'] };
  const plan = put(op + '/plan.json', {}), script = put(op + '/token-create.js', Buffer.from('creation'));
  const header = put(op + '/operation.json', { id: 'probe', policy: { fileKey: 'file' }, planRevision: 'revision', planSha256: sha256(plan),
    tokenScriptSha256: sha256(script), request: { ...request, kind: 'react-initial-draft', observation: pin } });
  const command = { operationId: 'probe', fileKey: 'file', planRevision: 'revision', attemptId: 'attempt', nonce: 'nonce', phase: 'component-readback', readOnly: true, script: 'read', scriptSha256: sha256('read') };
  const dispatch = put(op + '/events/00000000.json', { sequence: 0, previousSha256: sha256(header), kind: 'dispatch', command });
  put(op + '/events/00000001.json', { sequence: 1, previousSha256: sha256(dispatch), kind: 'result', envelope: { ...command,
    result: { status: 'native-readback-collected', receiptKind: 'independent-native-component-readback', operationId: 'probe', fileKey: 'file',
      planRevision: 'revision', nativeQualification: 'unqualified', acceptedContract: null, problems: [], images: [{ caseId: 'variant:enabled=false', nodeId: 'main' }] } } });
  const spec: DeclaredSpec = { id: 'cohort', component: 'Component', description: 'probe', operation: 'probe', journal: op,
    event: '00000001.json', source: { kind: 'initial', inspection } };
  return { spec, put, op, inspection };
}
test('source/native pairing authenticates journals without inventing origins for old unframed exports', () => temp(dir => {
  const f = fixture(dir), result = authenticateMatchedOperation(dir, f.spec);
  assert.equal(result.pairs.length, 1); assert.equal(result.pairs[0].native.nodeId, 'main');
  f.put(f.inspection + '/states/0.png', Buffer.from('substituted'));
  assert.throws(() => authenticateMatchedOperation(dir, f.spec), /source-changed/);
}));
test('changed plan, script hash, result identity and source pairing are refused', () => {
  for (const [kind, reason] of [ ['plan', /plan-changed/], ['script', /command-changed/], ['result', /result-uncorrelated/], ['pair', /variant-pairing/] ] as const) temp(dir => {
    const f = fixture(dir);
    if (kind === 'plan') f.put(f.op + '/plan.json', { changed: true });
    else {
      const name = kind === 'script' ? '00000000.json' : '00000001.json', file = path.join(dir, f.op, 'events', name);
      const e = JSON.parse(readFileSync(file, 'utf8'));
      if (kind === 'script') e.command.script = 'changed';
      if (kind === 'result') e.envelope.nonce = 'wrong';
      if (kind === 'pair') e.envelope.result.images[0].caseId = 'variant:enabled=true';
      f.put(f.op + '/events/' + name, e);
    }
    assert.throws(() => authenticateMatchedOperation(dir, f.spec), reason);
  });
});
