import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { selectReactComparisonCase, assertReactComparisonFamily } from './react-comparison-case.js';
import { selectReactNativeRequest } from './react-native-evidence.js';
import { evidenceSha, inventoryEvidence } from './react-validation-evidence.js';
import { revisionOf } from '../core/contract-provenance.js';
import { isReactComparisonRequest, reactComparisonReservation, reactComparisonContentOperation, reactComparisonContentScope } from './react-comparison-request.js';

function fixture(t: test.TestContext, change: (row: any) => void = () => {}) {
  const repo = mkdtempSync(path.join(tmpdir(), 'reuse-family-'));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const source = path.join(repo, 'original.tsx'); writeFileSync(source, 'original');
  const reference = { id: 'a'.repeat(64), css: '', javascript: '', files: { [source]: evidenceSha(Buffer.from('original')) } };
  const row = { id: 'button-default', matched: true, problems: [], ownership: {
    components: [{ roots: [''], source: { file: 'component.tsx', exportName: 'Control' } }],
  }, propertyMatrix: { heldProps: { tone: 'default', disabled: false, children: { kind: 'array' } } },
  rootMatrix: { version: 1, qualification: 'combined-property-root-draft', acceptedContract: null, problems: [],
    draft: { status: 'native-compiled', problems: [], contract: { props: [{ bindings: { code: { prop: 'tone' } } }] }, tokens: { ink: '#000' } } } };
  const other = structuredClone(row); other.id = 'button-secondary'; other.propertyMatrix.heldProps.tone = 'secondary'; change(other);
  const report: any = { id: '10000000-0000-4000-8000-000000000001', referenceId: reference.id, state: 'complete', sourceUnchanged: true, rows: [row, other] };
  const dir = path.join(repo, 'private/react-source-ownership', reference.id, report.id); mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report));
  writeFileSync(path.join(dir, 'program.json'), JSON.stringify({ files: reference.files }));
  writeFileSync(path.join(dir, 'integrity.json'), JSON.stringify({ version: 1, files: inventoryEvidence(dir) }));
  return { repo, reference, report, source, main: selectReactNativeRequest(repo, report, row.id) };
}

test('reuse authenticates source identity, complete matrix and non-variant held inputs', t => {
  const f = fixture(t), selected = selectReactComparisonCase(f.repo, f.reference, f.main, 'button-secondary');
  assert.equal(selected.caseId, 'button-secondary');
  assert.notDeepEqual(selected, f.main);
  assertReactComparisonFamily(f.repo, f.reference, f.main, selected);
  assert.throws(() => assertReactComparisonFamily(f.repo, f.reference, f.main, { ...selected, inventorySha256: 'f'.repeat(64) }), /archive-mismatch/);
  writeFileSync(f.source, 'changed');
  assert.throws(() => selectReactComparisonCase(f.repo, f.reference, f.main, 'button-secondary'), /evidence-unavailable/);
});

for (const [name, mutate] of Object.entries({
  tokens: (r: any) => { r.rootMatrix.draft.tokens.ink = '#fff'; },
  source: (r: any) => { r.ownership.components[0].source.exportName = 'OtherControl'; },
  behavior: (r: any) => { r.propertyMatrix.heldProps.disabled = true; },
  ambiguous: (r: any) => { r.ownership.components.push(structuredClone(r.ownership.components[0])); },
})) test(`reuse refuses changed ${name}`, t => {
  const f = fixture(t, mutate);
  assert.throws(() => selectReactComparisonCase(f.repo, f.reference, f.main, 'button-secondary'), /react-comparison-family-/);
});

test('each reused source case has separate preparation and reservation while old requests retain theirs', t => {
  const f = fixture(t), root = selectReactComparisonCase(f.repo, f.reference, f.main, 'button-secondary');
  const parentOperationId = '10000000-0000-4000-8000-000000000002';
  const content = { id: '10000000-0000-4000-8000-000000000003', reportSha256: 'd'.repeat(64), inventorySha256: 'e'.repeat(64) };
  const old = { version: 1 as const, kind: 'react-content-comparison' as const, parentOperationId, root: f.main, content };
  const request = { ...old, version: 3 as const, mainRoot: f.main, root };
  assert.ok(isReactComparisonRequest(request));
  assert.notEqual(reactComparisonReservation(old), reactComparisonReservation(request));
  assert.equal(reactComparisonContentOperation(old), parentOperationId);
  assert.equal(reactComparisonContentOperation(request), reactComparisonContentScope(parentOperationId, root));
  assert.notEqual(reactComparisonContentOperation(request), parentOperationId);
  const icon = { ...request, root: { ...root, caseId: 'button-icon' } };
  assert.notEqual(reactComparisonReservation(icon), reactComparisonReservation(request));
  assert.notEqual(reactComparisonContentOperation(icon), reactComparisonContentOperation(request));
  assert.ok(isReactComparisonRequest({ ...request, composition: { revision: revisionOf('mapping') } }));
  for (const invalid of [{ ...request, mainRoot: undefined }, { ...request, nodeId: '1:2' },
    { ...request, composition: { revision: revisionOf('mapping'), references: [] } }, { ...old, mainRoot: f.main }])
    assert.equal(isReactComparisonRequest(invalid), false);
});
