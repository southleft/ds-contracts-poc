import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { coverageCohort, captureProseFailures, coverageTableFailures } from './coverage-cohort.mjs';

test('unknown-size libraries remain counted but cannot inflate known-size coverage', () => {
  const known = { key: 'known', contracts: 12, pinned: 10, size: 100 };
  const before = coverageCohort([known]);
  const after = coverageCohort([known, { key: 'unknown', contracts: 7, pinned: 7, size: null }]);
  assert.equal(after.pct, before.pct);
  assert.equal(after.pinned, 10);
  assert.equal(after.allPinned, 17);
  assert.equal(after.unknownPinned, 7);
  assert.equal(after.libraries, 1);
  assert.equal(after.unknownLibraries, 1);
  assert.equal(coverageCohort([{ key: 'unknown', contracts: 7, pinned: 7, size: null }]).pct, null);
  for (const rows of [[known, known], [{ ...known, size: 0 }], [{ ...known, size: undefined }], [{ ...known, pinned: 13 }]]) {
    assert.throws(() => coverageCohort(rows), /coverage:/);
  }
});

test('worded and numeric stale corpus claims are checked, including nine rather than only six', () => {
  const expected = { measured: 133, libraries: 11, knownLibraries: 8, goldenFiles: 292, nonempty: 132, empty: 1 };
  const good = '133 components across 11 libraries; 11 third-party component libraries — names. Every one of the 133 is listed. the eight libraries with a measured size; 292 generated files hashed against a golden manifest. The mean uses 132 nonempty comparisons; 1 zero-cell scorecard is excluded.';
  assert.deepEqual(captureProseFailures(good, expected), []);
  for (const [from, to] of [['133 components', '116 components'], ['11 libraries', 'nine libraries'], ['11 third-party', 'Six third-party'], ['the eight', 'the seven'], ['292 generated', '291 generated'], ['132 nonempty', '133 nonempty'], ['1 zero-cell', '0 zero-cell']]) {
    assert.ok(captureProseFailures(good.replace(from, to), expected).length > 0);
  }
});

test('tampered tables cannot restore an inflated total beside a correct known-size subtotal', () => {
  const cohort = coverageCohort([{ key: 'known', contracts: 12, pinned: 10, size: 100 }, { key: 'unknown', contracts: 7, pinned: 7, size: null }]);
  const table = '| **total** | **19** | **17** | **unknown** | — | source |\n| **known-size cohort** | **12** | **10** | **100** | **10.0%** | source |';
  assert.deepEqual(coverageTableFailures(table, cohort), []);
  for (const [from, to] of [['**19**', '**20**'], ['**10**', '**17**'], ['**unknown**', '**100**'], ['| — |', '| **17.0%** |'], ['**10.0%**', '**17.0%**']]) {
    assert.ok(coverageTableFailures(table.replace(from, to), cohort).length > 0);
  }
  assert.ok(coverageTableFailures('', cohort).length > 0);
});

test('published aggregate coverage uses the same known-size cohort on both sides', () => {
  const report = readFileSync(new URL('../docs/24-what-works.md', import.meta.url), 'utf8');
  const lines = report.split('\n');
  const rows = lines.filter((line) => /^\| .*\(`/u.test(line)).map((line) => line.split('|').slice(1, -1));
  const known = rows.filter((r) => /^\s*[\d,]+\s*$/u.test(r[3] ?? ''));
  const number = (s) => Number(s.replace(/[^\d.]/g, ''));
  const covered = known.reduce((sum, r) => sum + number(r[2]), 0);
  const size = known.reduce((sum, r) => sum + number(r[3]), 0);
  assert.ok(known.length > 0 && size > 0, 'known-size population must be explicit');
  const aggregate = lines.find((l) => l.startsWith('| **known-size cohort** |'))
    ?? lines.find((l) => l.startsWith('| **total** |'));
  assert.ok(aggregate, 'report needs an aggregate row');
  const cells = aggregate.split('|').slice(1, -1);
  assert.equal(number(cells[2]), covered, 'an unknown-size library cannot enlarge only the numerator');
  assert.equal(number(cells[3]), size);
  assert.equal(number(cells[4]), Number((100 * covered / size).toFixed(1)));
});
