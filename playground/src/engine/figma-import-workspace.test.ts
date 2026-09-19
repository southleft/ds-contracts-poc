import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { importFigmaUrl } from './figma-url-import.js';
import { recordFigmaClosure } from './figma-import-workspace.js';
import { tokenCorpusFromJson } from '../../../core/token-corpus.js';
import { proposeBatchFromDump } from '../../../core/propose-figma.js';
import { validateContract } from '../../../packages/core/src/validate.js';
import { htmlEmitter, reactEmitter } from '../../../core/emitter.js';
import { buildSessionRegistry, contractsInSession } from './session-registry.js';
import { applyLinkedScope, linkedImportScope } from './linked-scope.js';
import { clearWorkspace, workspaceSnapshot, WORKSPACE_CAP } from './workspace.js';
import type { FetchLike } from '../../../extract/figma/rest/fetch.js';
import type { DumpSet } from '../../../extract/figma/types.js';

const recorded = JSON.parse(readFileSync(new URL('../../../extract/figma/rest/fixtures/closure-cbds-icon.rest.json', import.meta.url), 'utf8'));
const calls: string[] = [];
const replay: FetchLike = async url => {
  calls.push(url);
  const status = url.includes('/variables/local') ? 403 : 200;
  const body = status === 403 ? { message: 'This endpoint requires the file_variables:read scope' } : {
    nodes: Object.fromEntries((new URL(url).searchParams.get('ids') ?? '').split(',')
      .map(id => [id, recorded.responses[id]?.nodes[id] ?? null])),
  };
  return { ok: status === 200, status, json: async () => body, text: async () => JSON.stringify(body) };
};
const propose = (dump: Record<string, unknown>) => proposeBatchFromDump(dump, {
  corpus: tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} }),
  contractIdByName: new Map(), mintUnbound: true, fileKey: 'test',
});
const load = async () => {
  const result = await importFigmaUrl('https://www.figma.com/design/test/Kit?node-id=188-894', 'fixture-token', { fetchImpl: replay });
  const batch = propose(result.dump);
  return { result, batch, closure: result.dump._provenance!.closure! };
};
const receiptsFor = () => ({ source: 'recorded REST replay', groups: [] });
beforeEach(() => { clearWorkspace(); calls.length = 0; });

test('the application imports children, saves the whole family, and selects the requested parent by its Figma node', async () => {
  const { batch, closure } = await load();
  assert.equal(calls.filter(url => url.includes('/nodes?')).length, 2, 'the UI transport follows the child');
  assert.deepEqual(batch.proposals.map(p => p.setName), ['Placeholder', 'Icon']);
  const saved = recordFigmaClosure(batch, closure, receiptsFor, null);
  assert.equal(saved.proposal.setName, 'Icon', 'the dependency-first array must not select its first child');
  assert.deepEqual(workspaceSnapshot().map(entry => entry.name), ['Icon', 'Placeholder']);
  const session = buildSessionRegistry(JSON.parse(JSON.stringify(workspaceSnapshot())));
  const parent = session.contracts.get(saved.recorded.entry.contractId)!;
  const scope = contractsInSession(new Map(), session, parent);
  const errors: string[] = [];
  validateContract(parent, scope, errors, new Map());
  assert.deepEqual(errors, []);
  assert.equal(session.contracts.size, 2);
  const linked = linkedImportScope(parent, scope, session.layersByContractId, new Set());
  const tokens = applyLinkedScope({ primitives: {}, semantic: saved.recorded.entry.mintedTokens?.tree ?? {}, light: {}, dark: {}, brands: { default: {} } }, linked);
  const ctx = { contracts: scope, tokens, icons: new Map<string, string>(), mode: 'light' as const };
  assert.match(reactEmitter.emit(parent, ctx).find(file => file.path.endsWith('.tsx'))!.contents, /Placeholder/);
  assert.ok(htmlEmitter.emit(parent, ctx).length, 'the stored family renders without relying on a bundled child');
  recordFigmaClosure(batch, closure, receiptsFor, null);
  assert.equal(workspaceSnapshot().length, 2, 'repeat imports do not duplicate the family');
});

test('missing or refused requested parents and oversized families leave the workspace untouched', async () => {
  const { batch, closure } = await load();
  recordFigmaClosure(batch, closure, receiptsFor, null);
  const before = workspaceSnapshot();
  const missing = { ...batch, proposals: batch.proposals.filter(row => row.setName !== 'Icon') };
  assert.throws(() => recordFigmaClosure(missing, closure, receiptsFor, null), /requested-contract-not-found/);
  assert.equal(workspaceSnapshot(), before);
  const ambiguous = { ...batch, proposals: [...batch.proposals, { ...batch.proposals[1], setName: 'Another parent' }] };
  assert.throws(() => recordFigmaClosure(ambiguous, closure, receiptsFor, null), /requested-contract-ambiguous/);
  assert.equal(workspaceSnapshot(), before);
  const refused = { ...missing, skipped: [{ setName: 'Icon', reason: 'unsupported fixture parent' }] };
  assert.throws(() => recordFigmaClosure(refused, closure, receiptsFor, null), /figma-requested-set-refused/);
  assert.equal(workspaceSnapshot(), before);
  const large = { ...batch, proposals: [...batch.proposals, ...Array.from({ length: WORKSPACE_CAP }, (_, index) => ({ ...batch.proposals[0], setName: 'Extra' + index }))] };
  assert.throws(() => recordFigmaClosure(large, closure, receiptsFor, null), /workspace-import-too-large/);
  assert.equal(workspaceSnapshot(), before);
});

test('a pasted REST closure preserves the same parent and dependencies in the JSON workspace', async () => {
  const { batch, closure } = await load();
  const saved = recordFigmaClosure(batch, closure, receiptsFor, null, 'json');
  assert.equal(saved.proposal.setName, 'Icon');
  assert.deepEqual(workspaceSnapshot().map(entry => [entry.name, entry.source]), [['Icon', 'json'], ['Placeholder', 'json']]);
});

test('a refused dependency remains a named provisional stub, never a successful child import', async () => {
  const { result, closure } = await load();
  (result.dump.Placeholder as DumpSet).variants = [];
  const partial = propose(result.dump);
  assert.deepEqual(partial.skipped.map(row => row.setName), ['Placeholder']);
  const saved = recordFigmaClosure(partial, closure, receiptsFor, null);
  assert.deepEqual(workspaceSnapshot().map(entry => entry.name), ['Icon']);
  assert.ok(saved.recorded.entry.childStubs?.length, 'the real proposer carries the refused dependency as a stub');
  const session = buildSessionRegistry(workspaceSnapshot());
  const parent = session.contracts.get(saved.recorded.entry.contractId)!;
  const errors: string[] = [];
  validateContract(parent, new Map([...session.stubs, ...session.contracts]), errors, new Map());
  assert.deepEqual(errors, []);
  assert.ok(saved.recorded.receipts?.groups.some(group => group.entries.some(entry => entry.message.includes('closure-child-refused:Placeholder'))));
});
