import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { proposeBatchFromDump } from '../../../core/propose-figma.js';
import { tokenCorpusFromJson } from '../../../core/token-corpus.js';
import type { DumpSet } from '../../../extract/figma/types.js';
import { buildSessionRegistry } from './session-registry.js';
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
