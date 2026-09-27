import assert from 'node:assert/strict';
import test from 'node:test';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { attach, check, judge, readCells, readPin, record, type Cell, type Pin, type Replay } from './benchmark-replay.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** A throwaway root holding one real cell, its input and its committed pin. */
function sandbox(t: test.TestContext, id = 'altitude-badge.figma-to-react') {
  const root = mkdtempSync(path.join(tmpdir(), 'benchmark-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const cell = readCells(repo).find(c => c.id === id)!;
  mkdirSync(path.join(root, 'benchmark', 'pins'), { recursive: true });
  mkdirSync(path.dirname(path.join(root, cell.input)), { recursive: true });
  cpSync(path.join(repo, cell.input), path.join(root, cell.input));
  cpSync(path.join(repo, 'benchmark', 'pins', id + '.json'), path.join(root, 'benchmark', 'pins', id + '.json'));
  writeFileSync(path.join(root, 'benchmark', 'cells.json'), JSON.stringify({ version: 1, cells: [cell] }));
  return { root, cell };
}

test('a committed cell replays to its pin', async t => {
  const { root } = sandbox(t);
  const [v] = await check(root);
  assert.equal(v.status, 'green', v.reason);
});

test('a changed input byte, a missing pin and drifted output are red by name', async t => {
  const a = sandbox(t);
  const input = path.join(a.root, a.cell.input);
  writeFileSync(input, readFileSync(input, 'utf8').replace('"Badge"', '"Badge "'));
  assert.match((await check(a.root))[0].reason, /benchmark-input-changed/);

  const b = sandbox(t);
  rmSync(path.join(b.root, 'benchmark', 'pins', b.cell.id + '.json'));
  const missing = (await check(b.root))[0];
  assert.deepEqual([missing.status, /no pin/.test(missing.reason)], ['red', true]);

  const c = sandbox(t);
  const pinFile = path.join(c.root, 'benchmark', 'pins', c.cell.id + '.json');
  const pin: Pin = JSON.parse(readFileSync(pinFile, 'utf8'));
  const first = Object.keys(pin.generated)[0];
  pin.generated[first] = '0'.repeat(64);
  writeFileSync(pinFile, JSON.stringify(pin));
  const drift = (await check(c.root))[0];
  assert.equal(drift.status, 'red');
  assert.match(drift.reason, new RegExp('generated React changed .*first: ' + first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('re-recording keeps a receipt only for identical generated files, and a foreign receipt is refused', async t => {
  const { root, cell } = sandbox(t);
  const pinFile = path.join(root, 'benchmark', 'pins', cell.id + '.json');
  await record(root, [cell.id]);
  assert.equal(readPin(root, cell.id)!.fidelity !== null, true, 'same bytes keep their receipt');
  const pin: Pin = JSON.parse(readFileSync(pinFile, 'utf8'));
  pin.fidelity!.generatedSha256 = 'f'.repeat(64);
  writeFileSync(pinFile, JSON.stringify(pin));
  await record(root, [cell.id]);
  assert.equal(readPin(root, cell.id)!.fidelity, null);
  assert.equal((await check(root))[0].status, 'stale', 'a re-pinned cell is stale until re-scored');
  // The CBDS receipt scored other files and another component.
  assert.throws(() => attach(root, cell.id, path.join(repo, 'benchmark', 'receipts', 'cbds-badge.figma-to-react', 'receipt.json'), 'x', 'y'),
    /benchmark-attach-(mismatch|component)/);
});

const cell = (over: Partial<Cell> = {}): Cell => ({ id: 'x', row: 'X', criterion: 'C2', kind: 'figma-to-react', component: 'X',
  input: 'i', inputSha256: 'i', expect: 'pass', scope: { outOfScope: [{ pattern: 'focus$', reason: 'V1.1' }] }, ...over });
const replay: Replay = { inputSha256: 'i', requestSha256: 'r', rootId: 'x', generated: { a: '1' }, entries: { b: '2' } };
const pinWith = (cases: Array<[string, boolean, string | null]>, problems: string[] = []): Pin => ({
  id: 'x', version: 1, inputSha256: 'i', requestSha256: 'r', rootId: 'x', generated: { a: '1' }, generatedSha256: 'g',
  entries: { b: '2' }, entriesSha256: 'e', recordedOn: 't', fidelity: { receipt: 'r', receiptSha256: 's', generatedSha256: 'g', component: 'X',
    measuredOn: 'm', measuredAt: 'd', problems, cases: cases.map(([key, withinLimit, residual]) => ({ key, withinLimit, residual, white: 1, black: 1 })) } });

test('scope, text-only partials and known failures follow the owner rules', () => {
  assert.equal(judge(cell(), pinWith([['a', true, null], ['b-focus', false, 'beyond-text']], ['content-size-mismatch:b-focus:1x1 vs 2x2']), replay).status,
    'green', 'out-of-scope cases and their problems do not count');
  assert.equal(judge(cell(), pinWith([['a', true, null], ['b', false, 'text-only']]), replay).status, 'partial', 'text-only overages are partials, never passes');
  assert.equal(judge(cell(), pinWith([['a', true, null], ['b', false, 'beyond-text']]), replay).status, 'red', 'a real failure in a pass cell is red');
  assert.equal(judge(cell(), pinWith([['a', true, null]], ['variant-prop-discarded:state']), replay).status, 'red', 'a case-less problem counts');
  assert.equal(judge(cell({ expect: 'known-failure', knownFailure: 'named' }), pinWith([['a', false, 'beyond-text']]), replay).status, 'known-failure');
  assert.equal(judge(cell(), { ...pinWith([['a', true, null]]), fidelity: null }, replay).status, 'stale');
  assert.equal(judge(cell(), pinWith([['a', true, null]]), { ...replay, requestSha256: 'other' }).status, 'red');
});
