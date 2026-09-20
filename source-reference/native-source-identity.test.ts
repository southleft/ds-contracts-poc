import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertNativeSourceIdentity, nativeSourceBelongsToReference, readNativeSourceIdentity } from './native-source-identity.js';
import { evidenceSha, inventoryEvidence } from './react-validation-evidence.js';
import type { ReactNativeRequest } from './react-native-request.js';
import type { ReactInitialNativeRequest } from './react-initial-native-request.js';
import type { ReactStateApiNativeRequest } from './react-state-api-native-request.js';

function fixture(t: test.TestContext) {
  const repo = mkdtempSync(path.join(tmpdir(), 'source-identity-'));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  let sequence = 0;
  function archive(options: { workspace?: string; exportName?: string; bytes?: string; roots?: string[]; duplicate?: boolean } = {}) {
    const referenceId = evidenceSha(String(sequence++)), id = `${referenceId.slice(0, 8)}-0000-4000-8000-000000000000`;
    const module = 'src/widget.tsx', file = path.join(repo, options.workspace ?? 'original', module);
    const source = { module, exportName: options.exportName ?? 'Widget', sourceSha256: evidenceSha(options.bytes ?? 'original source'), span: { start: 0, end: 10 } };
    const component = { id: 'instance-0', source, roots: options.roots ?? [''], props: {} };
    const row = (id: string) => ({ id, matched: true, problems: [], ownership: { version: 1, components: options.duplicate ? [component, { ...component, id: 'instance-1' }] : [component], nodes: [], rendererVersions: ['19.2.4'], problems: [] } });
    const report = { id, referenceId, state: 'complete', sourceUnchanged: true, rows: [row('widget-default'), row('widget-state')] };
    const program = { version: 1, problems: [], files: { [file]: source.sourceSha256 }, components: [source] };
    const dir = path.join(repo, 'private/react-source-ownership', referenceId, id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report));
    writeFileSync(path.join(dir, 'program.json'), JSON.stringify(program));
    const seal = JSON.stringify({ version: 1, files: inventoryEvidence(dir) });
    writeFileSync(path.join(dir, 'integrity.json'), seal);
    const request: ReactNativeRequest = { version: 1, kind: 'react-root-draft', referenceId, caseId: 'widget-default',
      ownership: { id, sha256: evidenceSha(JSON.stringify(report)) }, inventorySha256: evidenceSha(seal), matrixRevision: 'sha256:' + referenceId };
    return { request, dir, file, report, program };
  }
  return { repo, archive };
}

test('source edits retain identity; an identical case, export and relative path in another workspace do not', t => {
  const f = fixture(t), original = f.archive(), changed = f.archive({ bytes: 'changed source' }), foreign = f.archive({ workspace: 'another' });
  assert.deepEqual(readNativeSourceIdentity(f.repo, original.request), { file: original.file, exportName: 'Widget' });
  // These files need not exist now: historical bytes are authenticated by the
  // pinned archive, not compared with a source revision that has moved on.
  assert.doesNotThrow(() => assertNativeSourceIdentity(f.repo, original.request, changed.request));
  assert.throws(() => assertNativeSourceIdentity(f.repo, original.request, foreign.request), /component-mismatch/);
  assert.equal(nativeSourceBelongsToReference(f.repo, original.request, { files: { [changed.file]: 'new-hash' } }), true);
  assert.equal(nativeSourceBelongsToReference(f.repo, original.request, { files: { [foreign.file]: 'new-hash' } }), false);
  const replaced = f.archive({ exportName: 'DifferentWidget' });
  assert.throws(() => assertNativeSourceIdentity(f.repo, original.request, replaced.request), /component-mismatch/);
});

test('initial states use their own case, and ambiguous or missing roots refuse', t => {
  const f = fixture(t), a = f.archive();
  const initial: ReactInitialNativeRequest = { version: 1, kind: 'react-initial-draft', anchor: a.request, caseId: 'widget-state',
    observation: { id: a.request.ownership.id, inventorySha256: a.request.inventorySha256, reportSha256: a.request.ownership.sha256 } };
  assert.deepEqual(readNativeSourceIdentity(f.repo, initial), readNativeSourceIdentity(f.repo, a.request));
  assert.throws(() => readNativeSourceIdentity(f.repo, { ...initial, caseId: 'missing' }), /identity-unavailable/);
  for (const options of [{ roots: ['0'] }, { roots: ['', '1'] }, { duplicate: true }])
    assert.throws(() => readNativeSourceIdentity(f.repo, f.archive(options).request), /identity-unavailable/);
});

test('historical report, source program and inventory must retain the journal-pinned bytes', t => {
  const f = fixture(t);
  for (const filename of ['report.json', 'program.json', 'integrity.json']) {
    const a = f.archive(), file = path.join(a.dir, filename);
    writeFileSync(file, readFileSync(file, 'utf8') + ' ');
    assert.throws(() => readNativeSourceIdentity(f.repo, a.request), /identity-unavailable/);
  }
  const a = f.archive();
  assert.throws(() => readNativeSourceIdentity(f.repo, { ...a.request, ownership: { ...a.request.ownership, sha256: '0'.repeat(64) } }), /identity-unavailable/);
  assert.throws(() => readNativeSourceIdentity(f.repo, { ...a.request, referenceId: 'f'.repeat(64) }), /identity-unavailable/);
});

test('state-API wrappers use the archived initial case and refuse foreign modules and malformed experiment pins', t => {
  const f = fixture(t);
  const wrap = (a: ReturnType<typeof f.archive>): ReactStateApiNativeRequest => ({ version: 1, kind: 'react-state-api-draft',
    initial: { version: 1, kind: 'react-initial-draft', anchor: a.request, caseId: 'widget-state',
      observation: { id: a.request.ownership.id, inventorySha256: a.request.inventorySha256, reportSha256: a.request.ownership.sha256 } },
    observation: { key: 'a'.repeat(64), id: a.request.ownership.id, inventorySha256: 'b'.repeat(64), reportSha256: 'c'.repeat(64) } });
  const original = wrap(f.archive()), changed = wrap(f.archive({ bytes: 'new appearance' }));
  assert.doesNotThrow(() => assertNativeSourceIdentity(f.repo, original, changed));
  const reanchored={...changed,initial:{...changed.initial,anchor:{...changed.initial.anchor,caseId:'another-archive-root'}}};
  assert.doesNotThrow(() => assertNativeSourceIdentity(f.repo, original, reanchored), 'identity is the state case, not the archive anchor case');
  const foreign=wrap(f.archive({workspace:'foreign'}));
  foreign.initial.anchor.caseId='another-archive-root';
  assert.throws(() => assertNativeSourceIdentity(f.repo, original, foreign), /component-mismatch/);
  assert.throws(() => assertNativeSourceIdentity(f.repo, original, wrap(f.archive({ workspace: 'foreign' }))), /component-mismatch/);
  assert.throws(() => readNativeSourceIdentity(f.repo, { ...original, initial: { ...original.initial, caseId: 'missing' } }), /identity-unavailable/);
  assert.throws(() => readNativeSourceIdentity(f.repo, { ...original, observation: { ...original.observation, key: '../invalid' } }), /identity-unavailable/);
});
