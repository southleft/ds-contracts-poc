import assert from 'node:assert/strict';
import test from 'node:test';
import { domDrawing, drawnColumn, dumpDrawing, figmaSkeletonOnly, numbers, reading, type SetResult } from './scoreboard.js';
import type { DumpNode, DumpSet } from './types.js';

const set = (name: string, variants: number, pass: number, extra: Partial<SetResult> = {}): SetResult => ({ set: name, grammar: 'in', variants, pass, fontBlocked: 0, ...extra });

test('the headline is the mean of per-set rates; raw first pass counts every variant; columns leave both and stay in coverage', () => {
  const sets = [set('a', 4, 4), set('b', 2, 1), set('out', 3, 0, { grammar: 'out' }), set('icon', 5, 5, { column: 'icon-only' }), set('sk', 1, 0, { column: 'skeleton-only' })];
  const r = reading(sets);
  assert.deepEqual([r.headline.headline, r.headline.pass, r.headline.of, r.headline.whole, r.headline.sets], [0.75, 5, 6, 1, 2]);
  assert.deepEqual(r.rawFirstPass, { pass: 5, of: 9 });
  assert.deepEqual(r.coverage, { inGrammar: 4, sets: 5 });
  assert.deepEqual([r.columns['icon-only'].headline, r.columns['skeleton-only'].headline, r.columns['glyph-only'].headline], [1, 0, null]);
  // Without columns the numbers are the plain mean the private A0 scorer computed.
  assert.equal(numbers(sets.filter((s) => s.grammar === 'in')).headline, (1 + 0.5 + 1 + 0) / 4);
});

test('a font-blocked variant is in no rate and is its own number; a set with every variant blocked has no rate and is named', () => {
  const r = reading([set('a', 4, 2, { fontBlocked: 2 }), set('b', 3, 0, { fontBlocked: 3 }), set('c', 2, 2)]);
  assert.deepEqual([r.headline.headline, r.headline.pass, r.headline.of, r.headline.whole, r.headline.sets, r.headline.rated], [1, 4, 4, 2, 3, 2]);
  assert.deepEqual([r.fontBlocked.total, r.fontBlocked.perSet, r.headline.noRate], [5, { a: 2, b: 3 }, [{ set: 'b', why: 'font-blocked' }]]);
  assert.match(r.firstLine, /^5 font-blocked variant\(s\), in no rate; headline 100\.0% .*; no rate for b \(font-blocked\)$/);
  assert.doesNotMatch(reading([set('c', 2, 2)]).firstLine, /font-blocked variant/);
  assert.throws(() => reading([set('x', 2, 2, { fontBlocked: 1 })]), /scoreboard-input-invalid:x/);
  assert.throws(() => reading([set('empty', 0, 0)]), /scoreboard-input-invalid:empty/, 'a set with no variant and no reason is refused, never dropped');
  assert.throws(() => reading([set('both', 2, 0, { noVariants: 'matrix-refused' })]), /scoreboard-input-invalid:both/);
});

test('a failed conversion counts at 0 in the headline; a matrix refused before conversion has no rate and is named', () => {
  const r = reading([set('ok', 2, 2), set('failed', 3, 0), set('refused', 0, 0, { noVariants: 'matrix-refused' })]);
  assert.deepEqual([r.headline.headline, r.headline.rated, r.headline.sets, r.rawFirstPass], [0.5, 2, 3, { pass: 2, of: 5 }]);
  assert.deepEqual([r.headline.noRate, r.coverage], [[{ set: 'refused', why: 'matrix-refused' }], { inGrammar: 3, sets: 3 }]);
  assert.match(r.firstLine, /no rate for refused \(matrix-refused\)$/);
});

test('icon-only and glyph-only are narrow: a painted box, text beside a graphic or a third character keeps a set in the headline', () => {
  const icon = { runs: [], graphics: ['vector' as const], painted: 0 };
  assert.equal(drawnColumn([icon, icon]), 'icon-only');
  assert.equal(drawnColumn([icon, { ...icon, painted: 1 }]), undefined, 'an icon button paints its root');
  assert.equal(drawnColumn([{ ...icon, graphics: ['other'] }]), undefined, 'an image is not a vector');
  assert.equal(drawnColumn([{ ...icon, runs: ['Go'] }]), undefined);
  assert.equal(drawnColumn([{ runs: ['A'], graphics: [], painted: 0 }, { runs: ['Zz'], graphics: [], painted: 0 }]), 'glyph-only');
  assert.equal(drawnColumn([{ runs: ['ABC'], graphics: [], painted: 0 }]), undefined);
  assert.equal(drawnColumn([{ runs: ['AB'], graphics: [], painted: 1 }]), undefined, 'an avatar paints its circle');
  assert.equal(drawnColumn([icon, null]), undefined, 'a variant with no reading keeps the set in the headline');
});

test('both sides read a variant the same way: Figma dump nodes and the reader content', () => {
  const vector = { type: 'VECTOR', name: 'p', fill: { hex: '#000' } } as unknown as DumpNode;
  const root = (kids: unknown[], own: object = {}) => ({ type: 'COMPONENT', name: 'v', ...own, children: kids }) as unknown as DumpNode;
  assert.deepEqual(dumpDrawing(root([{ type: 'INSTANCE', name: 'i', children: [vector] }])), { runs: [], graphics: ['vector'], painted: 0 });
  assert.deepEqual(dumpDrawing(root([vector, { type: 'TEXT', name: 't', text: { characters: ' 7 ' } }, { type: 'TEXT', name: 'h', hidden: true, text: { characters: 'x' } }], { fill: { hex: '#fff' } })),
    { runs: ['7'], graphics: ['vector'], painted: 1 });
  assert.deepEqual(domDrawing({ text: 'A', runs: [{ text: 'A' }], graphics: [{ tag: 'svg' }, { tag: 'img' }] }, 2), { runs: ['A'], graphics: ['vector', 'other'], painted: 2 });
});

test('a Figma set is skeleton-only when every variant carries the profile value, or when the profile lists it', () => {
  const s = (values: string[], nodeId = '1:1') => ({ setName: 'S', nodeId, variants: values.map((v) => ({ variantProperties: { State: v } })) }) as unknown as DumpSet;
  const data = { variant: { property: 'State', value: 'Skeleton' }, sets: ['9:9'] };
  assert.deepEqual([figmaSkeletonOnly(s(['Skeleton']), data), figmaSkeletonOnly(s(['Skeleton', 'Default']), data), figmaSkeletonOnly(s([], '9:9'), data), figmaSkeletonOnly(s(['Skeleton']), undefined)],
    [true, false, true, false]);
});
