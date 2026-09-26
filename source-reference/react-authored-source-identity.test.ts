import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { revisionOf } from '../core/contract-provenance.js';
import { authoredStateApiEvidence } from './react-authored-state-api-fixture.js';
import { projectReactAuthoredStateApiDraft } from './react-authored-state-api.js';
import { reactAuthoredInitialAnchor, reactAuthoredOwnershipAnchor } from './react-authored-native-request.js';
import { reactInspectionRequest, type ReactInitialInspection } from './react-initial-inspection.js';
import { planReactStateApi } from './react-state-api.js';
import { stateApiObservation } from './react-state-api-fixture.js';
import { readReactAuthoredStateApiInitial } from './react-state-api-inspection.js';
import { evidenceSha, inventoryEvidence } from './react-validation-evidence.js';
import { assertNativeSourceIdentity, nativeSourceBelongsToReference, readNativeSourceIdentity } from './native-source-identity.js';
import { createNativeSourceSuccessions, isNativeSourcePin, nativeSourcePinAnchor } from './native-source-succession.js';

function fixture(t: test.TestContext) {
  const repo = mkdtempSync(path.join(tmpdir(), 'authored-source-identity-'));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  let sequence = 0;
  const save = (dir: string, files: Record<string, unknown>) => {
    mkdirSync(dir, { recursive: true });
    for (const [name, value] of Object.entries(files)) writeFileSync(path.join(dir, name), JSON.stringify(value));
    const seal = JSON.stringify({ version: 1, files: inventoryEvidence(dir) });
    writeFileSync(path.join(dir, 'integrity.json'), seal);
    return evidenceSha(seal);
  };
  function archive(options: { workspace?: string; exportName?: string; childExport?: string; bytes?: string; offset?: number;
    change?: (initial: ReactInitialInspection) => void; ambiguous?: boolean } = {}) {
    const f = authoredStateApiEvidence(), pin = f.request, initial = f.initial, graph = initial.authoredDraft!;
    const referenceId = evidenceSha(String(++sequence)), id = (n: number) => `${referenceId.slice(0,8)}-0000-4000-8000-${String(n).padStart(12,'0')}`;
    const offset = options.offset ?? 0, rootId = `instance-${offset}`, childId = `instance-${offset + 1}`;
    const source = { ...initial.observation!.source, exportName: options.exportName ?? 'Widget', sourceSha256: evidenceSha(options.bytes ?? 'source'), span: { start: offset, end: offset + 10 } };
    const childSource = { ...source, module: 'parts/knob.tsx', exportName: options.childExport ?? 'Knob' };
    initial.id = id(1); initial.instanceId = rootId;
    initial.observation!.instanceId = rootId; initial.observation!.source = source;
    f.behavior.instanceId = rootId; f.behavior.observation!.target!.instanceId = rootId;
    f.behavior.observation!.target!.source = source;
    const root = { id: rootId, source, parent: 'instance-999', roots: [''], props: {} };
    const child = { id: childId, source: childSource, parent: rootId, roots: ['0'], props: {} };
    for (const boundary of graph.boundaries) boundary.planes = graph.nativeVariants.map((v, index) =>
      ({ key: String(index), instances: [structuredClone(boundary.path === '' ? root : child)] }));
    options.change?.(initial);
    const authored = { fact: { instanceId: rootId }, boundaries: graph.boundaries.map(b =>
      ({ path: b.path, instances: b.planes[0].instances })) };
    const ownershipReport = { id: id(3), referenceId, state: 'complete', sourceUnchanged: true,
      rows: [{ id: initial.caseId, matched: true, problems: [], ownership: { components: [root, child], problems: [] },
        authoredTrees: [{ helper: 0, draft: authored }] }] };
    const file = path.join(repo, options.workspace ?? 'original', source.module);
    const childFile = path.join(repo, options.workspace ?? 'original', childSource.module);
    const program = { version: 1, problems: [], components: [source, childSource],
      files: { [file]: source.sourceSha256, [childFile]: childSource.sourceSha256,
        ...(options.ambiguous ? { [path.join(repo, 'ambiguous', source.module)]: source.sourceSha256 } : {}) } };
    pin.referenceId = referenceId; pin.ownership = { id: id(3), sha256: evidenceSha(JSON.stringify(ownershipReport)) };
    pin.initial.anchorDraftRevision = revisionOf(authored); pin.initial.id = initial.id; pin.initial.instanceId = rootId;
    const ownershipDir = path.join(repo, 'private/react-source-ownership', referenceId, id(3));
    pin.inventorySha256 = save(ownershipDir, { 'report.json': ownershipReport, 'program.json': program });
    const inspection = reactInspectionRequest(reactAuthoredOwnershipAnchor(pin), initial.caseId, rootId);
    pin.initial.key = revisionOf(inspection).slice(7);
    const initialDir = path.join(repo, 'private/react-initial-inspections', pin.initial.key, initial.id);
    const { draft: _draft, authoredDraft: _authoredDraft, ...observed } = initial;
    pin.initial.reportSha256 = evidenceSha(JSON.stringify(observed));
    pin.initial.inventorySha256 = save(initialDir, { 'request.json': inspection, 'report.json': observed, 'program.json': program });
    f.report.id = id(2); f.report.plan = planReactStateApi(initial, f.behavior);
    f.report.observation = stateApiObservation(f.report.plan);
    const request = { version: 1, source: inspection, initialRevision: revisionOf(initial), callbackRevision: revisionOf(f.behavior),
      observerRevision: revisionOf('test-observer'), plan: f.report.plan };
    pin.stateApi.key = revisionOf(request).slice(7); pin.stateApi.id = f.report.id;
    const stateDir = path.join(repo, 'private/react-state-api-inspections', pin.stateApi.key, pin.stateApi.id);
    pin.stateApi.reportSha256 = evidenceSha(JSON.stringify(f.report));
    pin.stateApi.inventorySha256 = save(stateDir, { 'request.json': request, 'report.json': f.report, 'program.json': program,
      'initial-input.json': initial, 'callback-input.json': f.behavior });
    pin.initialDraftRevision = revisionOf(initial.authoredDraft);
    pin.draftRevision = revisionOf(projectReactAuthoredStateApiDraft(initial, f.report));
    return { pin, initial, file, childFile, ownershipDir, initialDir, stateDir };
  }
  return { repo, archive };
}

test('authored history restores exact creation namespaces while identity survives source and positional changes', t => {
  const f = fixture(t), original = f.archive(), next = f.archive({ bytes: 'edited source', offset: 12 });
  assert.deepEqual(readReactAuthoredStateApiInitial(f.repo, original.pin), original.initial);
  assert.doesNotThrow(() => assertNativeSourceIdentity(f.repo, original.pin, next.pin));
  const identity = readNativeSourceIdentity(f.repo, original.pin);
  assert.equal(identity.file, original.file); assert.equal(identity.exportName, 'Widget');
  assert.equal('boundaries' in identity && identity.boundaries?.length, 2);
  assert.equal(nativeSourceBelongsToReference(f.repo, original.pin, { files: { [next.file]: 'new bytes' } }), true);
  assert.deepEqual(nativeSourcePinAnchor(original.pin), reactAuthoredOwnershipAnchor(original.pin));
});

test('same case and instance cannot substitute another workspace, root export, or nested component', t => {
  const f = fixture(t), original = f.archive();
  for (const options of [{ workspace: 'foreign' }, { exportName: 'Replacement' }, { childExport: 'OtherKnob' }]) {
    const changed = f.archive(options);
    assert.throws(() => assertNativeSourceIdentity(f.repo, original.pin, changed.pin), /component-mismatch/);
  }
  const foreign = f.archive({ workspace: 'foreign' });
  assert.equal(nativeSourceBelongsToReference(f.repo, original.pin, { files: { [foreign.file]: 'bytes' } }), false);
  assert.throws(() => readNativeSourceIdentity(f.repo, f.archive({ ambiguous: true }).pin), /identity-unavailable/);
});

test('all authored planes require unambiguous, connected, stable ownership', t => {
  const f = fixture(t);
  for (const change of [
    (i: ReactInitialInspection) => { i.authoredDraft!.boundaries[1].planes[0].instances = []; },
    (i: ReactInitialInspection) => { i.authoredDraft!.boundaries[1].planes[0].instances[0].parent = 'instance-90'; },
    (i: ReactInitialInspection) => { i.authoredDraft!.boundaries[1].planes[0].instances[0].parent = 'instance-1'; },
    (i: ReactInitialInspection) => { i.authoredDraft!.boundaries[1].planes[0].instances[0].source = i.observation!.source; },
    (i: ReactInitialInspection) => { i.authoredDraft!.boundaries[1].planes[0].instances[0].id = 'instance-0'; },
    (i: ReactInitialInspection) => { i.authoredDraft!.boundaries[1].planes.pop(); },
    (i: ReactInitialInspection) => { i.authoredDraft!.boundaries[1].path = ''; },
  ]) assert.throws(() => readNativeSourceIdentity(f.repo, f.archive({ change }).pin), /identity-unavailable/);
});

test('each pinned archive and every experiment field authenticates historical identity', t => {
  const f = fixture(t);
  for (const [area, names] of [
    ['ownershipDir', ['report.json', 'program.json', 'integrity.json']],
    ['initialDir', ['report.json', 'request.json', 'integrity.json']],
    ['stateDir', ['report.json', 'request.json', 'initial-input.json', 'callback-input.json', 'integrity.json']],
  ] as const) for (const name of names) {
    const a = f.archive(), file = path.join(a[area], name);
    writeFileSync(file, readFileSync(file, 'utf8') + ' ');
    assert.throws(() => readNativeSourceIdentity(f.repo, a.pin), /identity-unavailable/, area + '/' + name);
  }
  const a = f.archive();
  for (const mutate of [
    (p: typeof a.pin) => { p.initial.reportSha256 = '0'.repeat(64); },
    (p: typeof a.pin) => { p.initial.inventorySha256 = '0'.repeat(64); },
    (p: typeof a.pin) => { p.initial.instanceId = 'instance-1'; },
    (p: typeof a.pin) => { p.initialDraftRevision = revisionOf('substitute'); },
    (p: typeof a.pin) => { p.draftRevision = revisionOf('substitute'); },
    (p: typeof a.pin) => { p.stateApi.reportSha256 = '0'.repeat(64); },
    (p: typeof a.pin) => { p.stateApi.key = '../escape'; },
    (p: typeof a.pin) => { p.helper = 1; },
  ]) { const pin = structuredClone(a.pin); mutate(pin); assert.throws(() => readNativeSourceIdentity(f.repo, pin), /identity-unavailable/); }
});

test('authored succession persists complete evidence and refuses downgrade, tampering, and a different creation seed', t => {
  const f = fixture(t), a = f.archive(), b = f.archive({ bytes: 'changed', offset: 9 });
  const parent = '55555555-0000-4000-8000-000000000000';
  assertNativeSourceIdentity(f.repo, a.pin, b.pin);
  let store = createNativeSourceSuccessions(f.repo);
  assert.deepEqual(store.adopt(parent, a.pin, b.pin), { adopted: true, sequence: 0 });
  store = createNativeSourceSuccessions(f.repo);
  assert.deepEqual(store.effective(parent, a.pin), b.pin);
  assert.deepEqual(store.adopt(parent, a.pin, b.pin), { adopted: false, sequence: 1 });
  assert.deepEqual(store.history(parent, a.pin), [a.pin.referenceId, b.pin.referenceId]);
  assert.throws(() => store.effective(parent, b.pin), /journal-chain-invalid/);
  assert(!isNativeSourcePin(reactAuthoredInitialAnchor(a.pin)));
  assert(!isNativeSourcePin(reactAuthoredOwnershipAnchor(a.pin)));
  assert.throws(() => store.adopt(parent, a.pin, { ...b.pin, caseId: 'other-case' }), /case-mismatch/);
  const file = path.join(f.repo, 'private/source-native-successions', parent, '00000000.json');
  const record = JSON.parse(readFileSync(file, 'utf8')); delete record.request.stateApi;
  writeFileSync(file, JSON.stringify(record));
  assert.throws(() => store.effective(parent, a.pin), /case-mismatch/);
});
