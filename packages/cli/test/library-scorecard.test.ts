/**
 * G6 — library coverage scorecard rollup, unit-pinned (plain node:test,
 * tsx-run).
 *
 * Load-bearing pins:
 *   · the floor is cell-WEIGHTED, never a naive per-component average;
 *   · unmeasurable components are counted BY NAME on their own line and
 *     excluded from the floor (the docs/18 lead's top-line ask);
 *   · refusal counts come from the extension sidecar's named channels;
 *   · open queue subtracts the decisions ledger;
 *   · smoke against the COMMITTED tailwind artifacts — the rollup reads the
 *     real shapes, not an invented one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  artifactsFromDir,
  coverageRow,
  libraryScorecard,
  type ComponentArtifacts,
} from '../../../extract/computed/library-scorecard.js';

const REPO = path.resolve(new URL('.', import.meta.url).pathname, '..', '..', '..');

const mk = (over: Partial<ComponentArtifacts>): ComponentArtifacts => ({
  scorecard: null,
  extension: null,
  queueIds: null,
  decidedIds: null,
  sourceFacts: null,
  ...over,
});

test('coverageRow: floor, pixel, refusal breakdown, and queue-minus-decisions', () => {
  const row = coverageRow('button', mk({
    scorecard: {
      combos: 50,
      computed: { cellsCompared: 1000, cellsEqual: 900, pctEqual: 90, rows: 200, rowsFullyEqual: 100 },
      pixel: { pairs: 200, perfectAA: 48 },
    },
    extension: { codeOnlyChannels: [1, 2], pairwiseRefusals: [1], stateOverflow: [], bindingContradictions: [1] },
    queueIds: ['a', 'b', 'c'],
    decidedIds: ['b'],
    sourceFacts: 118,
  }));
  assert.equal(row.measured, true);
  assert.equal(row.floorPct, 90);
  assert.equal(row.pixelPerfect, '48/200');
  assert.equal(row.namedRefusals, 4);
  assert.deepEqual(row.refusalBreakdown, { codeOnlyChannels: 2, pairwiseRefusals: 1, stateOverflow: 0, bindingContradictions: 1 });
  assert.equal(row.openQueue, 2, 'decided queue items are no longer open');
  assert.equal(row.sourceFacts, 118);
});

test('floor is cell-weighted, not a per-component average', () => {
  const big = coverageRow('big', mk({
    scorecard: { combos: 240, computed: { cellsCompared: 9000, cellsEqual: 9000, pctEqual: 100, rows: 1, rowsFullyEqual: 1 } },
  }));
  const small = coverageRow('small', mk({
    scorecard: { combos: 16, computed: { cellsCompared: 1000, cellsEqual: 0, pctEqual: 0, rows: 1, rowsFullyEqual: 1 } },
  }));
  const sc = libraryScorecard('lib', [big, small], []);
  // naive average would be 50; weighted is 9000/10000 = 90
  assert.equal(sc.totals.weightedFloorPct, 90);
  assert.ok(sc.lines.some((l) => l.includes('weighted by 10000 cells')));
});

test('unmeasurable components are named on their own line and excluded from the floor', () => {
  const measured = coverageRow('button', mk({
    scorecard: { combos: 10, computed: { cellsCompared: 100, cellsEqual: 80, pctEqual: 80, rows: 1, rowsFullyEqual: 1 } },
  }));
  const sc = libraryScorecard('lib', [measured], ['Popover', 'Modal']);
  assert.deepEqual(sc.unmeasured, ['Modal', 'Popover']);
  assert.equal(sc.totals.weightedFloorPct, 80, 'unmeasured components never dilute or inflate the floor');
  const line = sc.lines.find((l) => l.includes('UNMEASURABLE/SKIPPED'));
  assert.ok(line?.includes('2 UNMEASURABLE/SKIPPED'));
  assert.ok(line?.includes('Modal, Popover'), 'named, never just counted');
  assert.ok(line?.includes('NOT in the floor'));
});

test('zero-unmeasured prints the honest inverse, and an empty library refuses a fake 100%', () => {
  const sc = libraryScorecard('lib', [], []);
  assert.equal(sc.totals.weightedFloorPct, null, 'no cells → no floor claim');
  assert.ok(sc.lines.some((l) => l.includes('0 unmeasurable/skipped')));
});

test('determinism — same rows, same lines', () => {
  const rows = [coverageRow('a', mk({ scorecard: { combos: 1, computed: { cellsCompared: 10, cellsEqual: 5, pctEqual: 50, rows: 1, rowsFullyEqual: 0 } } }))];
  assert.deepEqual(libraryScorecard('l', rows, ['z', 'y']), libraryScorecard('l', structuredClone(rows), ['y', 'z']));
});

// ---------------------------------------------------------------------------
// Committed-artifact smoke — real shapes, no browser needed
// ---------------------------------------------------------------------------

test('committed tailwind/button artifacts parse into a sane row (real-shape smoke)', (t) => {
  const dir = path.join(REPO, 'extract', 'computed', 'out', 'tailwind', 'button');
  if (!existsSync(path.join(dir, 'scorecard.json'))) return t.skip('committed tailwind artifacts absent');
  const row = coverageRow('button', artifactsFromDir(dir));
  assert.equal(row.measured, true);
  assert.ok(row.floorPct !== null && row.floorPct > 50 && row.floorPct <= 100, `floor sane (${row.floorPct})`);
  assert.ok(row.cellsCompared > 0);
  assert.match(row.pixelPerfect, /^\d+\/\d+$/);
  assert.ok(row.sourceFacts === null || row.sourceFacts >= 0);
});

test('committed tailwind library rolls up: every captured component measured, totals line present', (t) => {
  const root = path.join(REPO, 'extract', 'computed', 'out', 'tailwind');
  if (!existsSync(root)) return t.skip('committed tailwind artifacts absent');
  const names = ['alert', 'badge', 'button', 'card', 'toggleswitch'].filter((n) =>
    existsSync(path.join(root, n, 'scorecard.json')),
  );
  const rows = names.map((n) => coverageRow(n, artifactsFromDir(path.join(root, n))));
  const sc = libraryScorecard('tailwind', rows, []);
  assert.equal(sc.totals.measured, names.length);
  assert.ok(sc.totals.weightedFloorPct !== null && sc.totals.weightedFloorPct > 0);
  assert.ok(sc.lines[0].includes('tailwind'));
  assert.ok(sc.lines.some((l) => l.startsWith('TOTALS:')));
});
