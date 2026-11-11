import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { f2rSets, largestUnit, r2fSets, report, systemCoverage } from './reading.js';

const dir = mkdtempSync(path.join(tmpdir(), 'reading-')), put = (name: string, v: unknown) => { const f = path.join(dir, name); writeFileSync(f, JSON.stringify(v)); return f; };
const variant = (kids: unknown[]) => ({ type: 'COMPONENT', name: 'v', children: kids });
const text = { type: 'TEXT', name: 't', text: { characters: 'Label' } };
const dump = (id: string, name: string, n: number) => put(`${id}.dump.json`, { [name]: { setName: name, nodeId: id, variants: Array.from({ length: n }, () => variant([text])) } });
const grammar = (name: string, g: 'in' | 'out') => put(`${name}.grammar.json`, { [name]: { grammar: g, reasons: [] } });
const profile = { figmaInternal: { namePrefix: '_' }, pairs: [{ code: ['TableBasic', 'TableSort'], figma: ['1:1', '1:2'], basis: 'page' }, { code: ['Tag'], figma: ['2:1'], basis: 'page' }] } as never;

test('Figma to React: each value from its receipt; a failed conversion counts at 0; an internal set is in no number', () => {
  const cells = [
    { set: '1:1', dump: dump('1:1', 'Table', 2), grammar: grammar('Table', 'in'), check: put('c1.json', { check: { counts: { pass: 1, fail: 1, unverified: 0, 'font-blocked': 0 } } }) },
    { set: '3:1', dump: dump('3:1', 'Button', 4), grammar: grammar('Button', 'in'), check: put('c2.json', { status: 'refused', reason: 'no contract' }) },
    { set: '4:1', dump: dump('4:1', '_Part', 1), grammar: grammar('_Part', 'in'), check: put('c3.json', { counts: { pass: 1, fail: 0, unverified: 0, 'font-blocked': 0 } }) },
  ];
  const sets = f2rSets(cells, profile);
  assert.deepEqual(sets.map((s) => [s.set, s.variants, s.pass, s.internal ?? false]), [['1:1 Table', 2, 1, false], ['3:1 Button', 4, 0, false], ['4:1 _Part', 1, 0, true]]);
  const lines = report(sets, profile);
  assert.match(lines[0]!, /headline 25\.0% over 2 in-grammar set\(s\).*1 internal set\(s\) left out/);
  assert.match(lines[1]!, /^sensitivity: without the Table unit: headline 0\.0% over 1 in-grammar set/);
  assert.throws(() => f2rSets([{ set: '5:1', dump: dump('5:1', 'Link', 1), grammar: grammar('Link', 'in') }]), /reading-receipt-missing:check:5:1/);
  assert.throws(() => f2rSets([{ set: '5:1', dump: dump('5:1', 'Link', 1), grammar: put('g.json', {}), failed: 'x' }]), /reading-receipt-missing:grammar:5:1/);
});

test('React to Figma: matrix refused has no rate; excluded titles count in coverage only; a title with no receipt is refused', () => {
  const comp = (title: string, extra: object = {}) => ({ title, grammar: { grammar: 'in' }, matrix: { status: 'ok', variants: 2 }, references: [], ...extra });
  const stories = { components: [comp('Tag'), comp('Grid', { matrix: { status: 'refused', reason: 'variant-matrix-no-story-variants' } }), comp('Link', { leftOut: [{ story: 's', reason: 'left-out-variant' }] })],
    excluded: [{ title: 'Old', reason: 'deprecated', grammar: { grammar: 'in' } }] };
  const checks = { Tag: { check: put('t.json', { counts: { pass: 2, fail: 0, unverified: 0, 'font-blocked': 0 } }) }, Grid: { refused: 'story-matrix-refused' }, Link: { failed: 'contract refused' } };
  const r = report(r2fSets(stories, checks), profile);
  assert.match(r[0]!, /headline 50\.0% over 2 in-grammar set\(s\), subset coverage 3\/4 with 1 title\(s\) excluded by profile counted \(3\/3 without\), 1 variant\(s\) left out by profile.*no rate for Grid \(matrix-refused\)/);
  assert.equal(r.length, 1, 'no member of the largest unit, so no sensitivity line');
  assert.throws(() => r2fSets(stories, { Tag: checks.Tag }), /reading-receipt-missing:check:Grid/);
  assert.equal(largestUnit(profile)!.name, 'Table');
  assert.throws(() => largestUnit({ pairs: [{ code: ['A'], figma: ['1:1'], basis: 'page' }, { code: ['B'], figma: ['2:1'], basis: 'page' }] } as never), /reading-largest-unit-tie:A \| B/);
});

test('system coverage comes from the system\'s full grammar reading, never from the run\'s subset; without it, the line says so', () => {
  const sets = [{ set: 'Tag', grammar: 'in' as const, variants: 2, pass: 1, fontBlocked: 0 }];
  assert.match(report(sets)[0]!, /, subset coverage 1\/1, .*; system coverage: not given$/);
  const reader = { components: [{ grammar: { grammar: 'in' } }, { grammar: { grammar: 'in' } }, { grammar: { grammar: 'out' } }], excluded: [{ title: 'Old' }] };
  assert.match(report(sets, undefined, reader)[0]!, /; system coverage 2\/4 with 1 title\(s\) excluded by profile counted \(2\/3 without\)$/);
  const figma = { sets: [{ name: 'Button', grammar: 'in' }, { name: 'Tile', grammar: 'out' }, { name: '_Part', grammar: 'in' }] };
  assert.equal(systemCoverage(figma, profile), '1/2 (1 internal set(s) in no number)');
  assert.throws(() => systemCoverage({ sets: [{ name: 'X' }] }, profile), /reading-coverage-unreadable:grammar/);
});

test('React to Figma, the check\'s own receipt: counts from `verdicts`, beside `counts` (whether the set counts); a set that does not count and passes a variant is refused', () => {
  const receipt = (counts: boolean, pass: number) => put(`r2f-${counts}-${pass}.json`, { version: 1, component: 'Tag', set: 'Tag', inputs: { stories: 'a', dump: 'b', capture: 'c' },
    verdicts: { pass, fail: 2 - pass, unverified: 0, 'font-blocked': 0 }, counts, problems: counts ? [] : ['layout:grid-layout'], boundColors: { solid: 1, bound: 1 }, variants: [] });
  const read = (f: string) => r2fSets({ components: [{ title: 'Tag', grammar: { grammar: 'in' }, matrix: { status: 'ok', variants: 2 }, references: [] }] }, { Tag: { check: f } })[0]!;
  assert.deepEqual([read(receipt(true, 1)).pass, read(receipt(true, 2)).pass, read(receipt(false, 0)).pass], [1, 2, 0]);
  assert.throws(() => read(receipt(false, 1)), /reading-receipt-inconsistent:counts:Tag/);
});
