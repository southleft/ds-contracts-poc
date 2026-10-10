import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { proposeBatchFromDump } from '../../../core/propose-figma.js';
import { tokenCorpusFromJson } from '../../../core/token-corpus.js';
import type { DumpSet } from '../../../extract/figma/types.js';
import { buildSessionRegistry } from './session-registry.js';
import { selectFigmaImportRoot } from '../../../core/figma-import-selection.js';
import { ContractSchema } from '../../../scripts/contract-schema.js';
import { clearWorkspace, recordImports, removeWorkspaceEntry, workspaceSnapshot } from './workspace.js';

const corpus = tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} });
function load(fileKey: string, key: string | undefined, setName = 'Chip', source: 'json' | 'figma' = 'json') {
  const session = buildSessionRegistry(workspaceSnapshot());
  const set: DumpSet = { setName, key, nodeId: '1:2', type: 'COMPONENT_SET', propertyDefinitions: { Tone: { type: 'VARIANT', defaultValue: 'A', variantOptions: ['A', 'B'] } }, variants: ['A', 'B'].map(Tone => ({ name: `Tone=${Tone}`, type: 'COMPONENT', variantProperties: { Tone } })) };
  const batch = proposeBatchFromDump({ [setName]: set }, { corpus, fileKey, mintUnbound: true,
    contractIdByName: session.idByName, contractIdByKey: session.idByKey,
    contractsById: session.contracts, sessionClaimedIds: new Set(session.contracts.keys()) });
  assert.deepEqual(batch.skipped, []);
  const proposal = batch.proposals[0];
  recordImports([{ name: setName, contractId: String(proposal.contract.id), contractText: JSON.stringify(proposal.contract), source, receipts: { source: fileKey, groups: [] } }]);
  return proposal;
}
beforeEach(clearWorkspace);

test('same-name sets in different files coexist and retain their IDs through repeated imports', () => {
  const first = load('file-a', 'key-a');
  const second = load('file-b', 'key-b');
  assert.equal(first.contract.id, 'ds.chip'); assert.equal(second.contract.id, 'ds.chip-2');
  assert.equal(workspaceSnapshot().length, 2, 'a display name must not evict the other library');
  assert.equal(load('file-b', 'key-b').contract.id, second.contract.id);
  assert.equal(load('file-a', 'key-a').contract.id, first.contract.id);
  assert.equal(workspaceSnapshot().length, 2);
});

test('an allocated suffix survives removal of the original collision and a Figma set rename', () => {
  load('file-a', 'key-a');
  const second = load('file-b', 'key-b');
  const original = workspaceSnapshot().find(entry => JSON.parse(entry.contractText).bindings.figma.anchors.fileKey === 'file-a');
  if (original) removeWorkspaceEntry(original.id);
  const repeat = load('file-b', 'key-b', 'Renamed chip');
  assert.equal(repeat.contract.id, second.contract.id, 'stable Figma identity outranks the now-free name-derived id');
  assert.equal(workspaceSnapshot().length, 1, 'renaming refreshes the same drawn component');
});

test('JSON and URL imports of the same anchored set refresh one entry', () => {
  const first = load('file-a', 'key-a');
  assert.equal(load('file-a', 'key-a', 'Chip', 'figma').contract.id, first.contract.id);
  assert.equal(workspaceSnapshot().length, 1);
});


test('file and node identity protect same-name imports when a set key was not captured', () => {
  const first = load('file-a', undefined);
  const second = load('file-b', undefined);
  assert.notEqual(first.contract.id, second.contract.id);
  assert.equal(load('file-b', undefined).contract.id, second.contract.id);
  assert.equal(workspaceSnapshot().length, 2);
});

test('contradicting file identity cannot borrow an existing id even when a key index matches', () => {
  const first = load('file-a', 'same-key');
  const second = load('file-b', 'same-key');
  assert.notEqual(first.contract.id, second.contract.id);
  assert.equal(load('file-b', 'same-key').contract.id, second.contract.id);
  assert.equal(workspaceSnapshot().length, 2);
});


test('caller occurrence identity cannot borrow a main declaration or serialized proof', () => {
  const main = ContractSchema.parse(load('file-a', 'main-key').contract);
  const dump = { _occurrences: { version: 1, dependencyInventory: 'complete', requested: ['2:3'],
    roots: [{ source: { fileKey: 'file-a', nodeId: '2:3' }, root: { nodeId: '2:3' } }],
    proof: { authenticated: true }, acceptedContract: main.id } };
  assert.throws(() => selectFigmaImportRoot(dump, [main]), /figma-occurrence-host-proof-required/);
  assert.throws(() => selectFigmaImportRoot(dump, [main], () => ({ contractId: main.id })), /figma-occurrence-proposal-mismatch/);
  let called = false;
  const malformed = structuredClone(dump); malformed._occurrences.roots[0].root.nodeId = 'foreign-node';
  assert.throws(() => selectFigmaImportRoot(malformed, [main], () => { called = true; return { contractId: main.id }; }), /figma-occurrence-source-mismatch/);
  assert.equal(called, false, 'contradictory caller identity stops before the host resolver');
});

test('caller occurrence root selection requires the host result and exact file and node identity', () => {
  const main = ContractSchema.parse(load('file-a', 'main-key').contract);
  const caller = structuredClone(main);
  caller.id = 'test.caller'; caller.name = 'Caller'; caller.bindings.figma.anchors.nodeId = '2:3';
  const dump = { _occurrences: { version: 1, dependencyInventory: 'complete', requested: ['2:3'],
    roots: [{ source: { fileKey: 'file-a', nodeId: '2:3' }, root: { nodeId: '2:3' } }] } };
  const resolve = (seen: unknown, nodeId: string) => { assert.equal(seen, dump); assert.equal(nodeId, '2:3'); return { contractId: caller.id }; };
  assert.deepEqual(selectFigmaImportRoot(dump, [main, caller], resolve), { kind: 'occurrence', nodeId: '2:3', contractId: caller.id, index: 1 });
  const foreign = structuredClone(caller); foreign.bindings.figma.anchors.fileKey = 'file-b';
  assert.throws(() => selectFigmaImportRoot(dump, [main, foreign], resolve), /figma-occurrence-proposal-mismatch/);
  assert.throws(() => selectFigmaImportRoot(dump, [caller, structuredClone(caller)], resolve), /figma-occurrence-proposal-mismatch/);
});

import { revisionOf } from '../../../core/contract-provenance.js';
import { resolveRetainedOccurrence, registerRetainedOccurrence, retainedOccurrenceForContract,
  retainedOccurrencePackageSelection } from './retained-occurrence.js';

/** Protocol fixtures exercise browser session state, never host capture authority. */
function retainedResponse(label: string, childId = 'test.retained-shared') {
  const child = ContractSchema.parse(load('transport-file', 'transport-key').contract);
  child.id = childId; child.name = 'RetainedChild'; child.description = label;
  child.bindings.figma.anchors.nodeId = '31:2';
  const root = structuredClone(child);
  root.id = `test.retained-${label.toLowerCase()}`; root.name = `Retained${label}`;
  root.bindings.figma.anchors.nodeId = `31:${label === 'Older' ? 3 : 4}`;
  root.anatomy.root = { element: 'div', parts: { child: { component: { id: child.id } } } };
  const contracts = [ContractSchema.parse(root), ContractSchema.parse(child)];
  const dump = { _occurrences: { version: 1, dependencyInventory: 'complete', requested: [root.bindings.figma.anchors.nodeId],
    roots: [{ source: { fileKey: 'transport-file', nodeId: root.bindings.figma.anchors.nodeId }, root: { nodeId: root.bindings.figma.anchors.nodeId } }] } };
  const key = { fileKey: 'transport-file', nodeId: root.bindings.figma.anchors.nodeId!, canonicalJsonSha256: revisionOf(dump).slice('sha256:'.length) };
  const tokens = { primitives: {}, semantic: { label: { $type: 'string', $value: label } }, light: {}, dark: {}, brands: {} };
  const envelope = { kind: 'host-retained-occurrence', key, request: { rootId: root.id, contracts, tokens, icons: [] },
    selection: { kind: 'occurrence', contractId: root.id }, degradations: [], qualification: 'unqualified', acceptedContract: null };
  return { dump, envelope, root: contracts[0], child: contracts[1], tokens, family: new Map(contracts.map(c => [c.id, c])) };
}
const retainedFetch = (value: ReturnType<typeof retainedResponse>['envelope']) =>
  (async () => ({ ok: true, json: async () => structuredClone(value) })) as unknown as typeof fetch;

test('late discarded occurrence resolution cannot replace an accepted shared-child session', async () => {
  const older = retainedResponse('Older'), newer = retainedResponse('Newer');
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  let revision = 0;
  const applyCurrent = async (fixture: typeof older, fetchImpl: typeof fetch) => {
    const mine = ++revision;
    const retained = await resolveRetainedOccurrence(fixture.dump, fetchImpl);
    if (mine === revision && retained) registerRetainedOccurrence(retained);
  };
  const pending = applyCurrent(older, (async () => { await wait; return retainedFetch(older.envelope)('', {}); }) as typeof fetch);
  await applyCurrent(newer, retainedFetch(newer.envelope));
  assert.equal(retainedOccurrenceForContract(newer.child)?.request.rootId, newer.root.id);
  release(); await pending;
  assert.equal(retainedOccurrenceForContract(newer.child)?.request.rootId, newer.root.id);
  assert.deepEqual(retainedOccurrencePackageSelection(newer.root, newer.family, newer.tokens), { occurrence: newer.envelope.key });
  assert.throws(() => retainedOccurrenceForContract(older.child), /retained-occurrence-contract-changed/);
});

test('resolved occurrence data stays unregistered when an import is cancelled or cannot apply', async () => {
  const fixture = retainedResponse('Cancelled', 'test.retained-cancelled-child');
  const resolved = await resolveRetainedOccurrence(fixture.dump, retainedFetch(fixture.envelope));
  assert(resolved);
  // Editor/token/reset cancellation and token-CSS refusal return before accepted apply.
  // Merely completing HTTP resolution must not create any session entry.
  assert.equal(retainedOccurrenceForContract(fixture.root), null);
  assert.equal(retainedOccurrenceForContract(fixture.child), null);
  assert.equal(retainedOccurrencePackageSelection(fixture.root, fixture.family, fixture.tokens), null);
});
