// A cross-axis FILL that holds in only SOME variants is CARRIED when it follows
// one enum axis (G3b). Found by the design-led clean-consumer check on a
// designer's Tabs set: the header FILLs its COLUMN root under Variant=Stretch
// and hugs under Variant=Default. Both readers captured it; the proposer named
// it a loss ("no per-variant spelling") although `literalsByProp` over the
// `width` channel spells exactly that, so the `variant` axis reached the
// stylesheet with no rule and the React emitter ledgered it inert.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mapRestToDump } from './rest/map.js';
import { proposeFromDump } from '../../core/propose-figma.js';
import { generateCss, generateTsx } from '../../core/emit-react.js';
import { tokenCorpusFromJson } from '../../core/token-corpus.js';
import type { DumpSet } from './types.js';

type Mode = 'VERTICAL' | 'HORIZONTAL';
/** One variant: its name, and whether `header` FILLs across the root / `list` FILLs along the header. */
type Cell = { name: string; header?: boolean; list?: boolean };
const frame = (id: string, name: string, mode: Mode, fill: { h?: boolean; v?: boolean }, children: unknown[] = []) => ({
  id, name, type: 'FRAME', layoutMode: mode, children,
  ...(fill.h ? { layoutSizingHorizontal: 'FILL' } : {}), ...(fill.v ? { layoutSizingVertical: 'FILL' } : {}) });
/** root(rootMode) > [header(ROW) > [list], body]. `body` never fills, so the
 *  root cannot carry `align: stretch` for the header alone. */
const restSet = (rootMode: Mode, cells: Cell[]) => ({ id: '1:1', name: 'Tabs', type: 'COMPONENT_SET',
  children: cells.map((cell, i) => ({ id: `1:${i + 2}`, name: cell.name, type: 'COMPONENT', layoutMode: rootMode,
    absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 120 },
    children: [
      frame(`1:${i + 2}1`, 'header', 'HORIZONTAL', rootMode === 'VERTICAL' ? { h: cell.header } : { v: cell.header },
        [frame(`1:${i + 2}2`, 'list', 'HORIZONTAL', { h: cell.list })]),
      frame(`1:${i + 2}3`, 'body', 'VERTICAL', {}),
    ] })) });
const propose = (rootMode: Mode, cells: Cell[]) => {
  const mappedSet = mapRestToDump({ name: 'fixture', nodes: { '1:1': { document: restSet(rootMode, cells) } } } as never);
  const set = (mappedSet.dump as unknown as Record<string, DumpSet>).Tabs;
  return proposeFromDump(set, { corpus: tokenCorpusFromJson({ primitives: { paint: { a: { $type: 'color', $value: '#ffffff' } } }, semantic: {}, light: {}, brandDefault: {} }), contractIdByName: new Map(), fileKey: null, projectionMode: 'reviewable-inversion', mintUnbound: true });
};
type Part = Record<string, unknown> & { parts?: Record<string, Part> };
const headerOf = (result: { contract: unknown }) => (result.contract as { anatomy: { root: Part } }).anatomy.root.parts!.header;
const emit = (contract: unknown) => {
  const inventory = new Set(Array.from(JSON.stringify(contract).matchAll(/\{([a-z0-9.-]+)\}/gi), m => m[1]));
  const errors: string[] = [];
  const css = generateCss(contract as never, inventory, errors);
  assert.deepEqual(errors, []);
  return { css, tsx: generateTsx(contract as never, new Map(), new Map(), css) };
};
const INERT = /axis-inert \(ledgered, not a throw\): [^\n]*\bvariant\b/;
const NAMED = /header: drawn FILL-(width|height) under a (COLUMN|ROW) parent in \d\/\d variant occurrence\(s\) only, and "fills \/ does not fill" is not a pure function of ONE declared enum axis[^]*NAMED, not carried/;

test('a FILL-width that follows one enum axis rides literalsByProp as width: 100% on the filling value only', () => {
  const result = propose('VERTICAL', [{ name: 'Variant=Default' }, { name: 'Variant=Stretch', header: true }]);
  const header = headerOf(result);
  assert.deepEqual(header.literalsByProp, [{ prop: 'variant', map: { stretch: { width: '100%' } } }]);
  assert.equal((header.literals as Record<string, string> | undefined)?.width, undefined, 'no base width: the fill is not a fact of every variant');
  assert.equal((header.layout as Record<string, unknown>).grow, undefined, 'a cross-axis stretch is not a primary-axis grow');
  assert.ok(result.notes.some(n => /header: drawn FILL-width under a COLUMN parent in 1\/2 .* carried as width: 100% through literalsByProp on `variant` \(stretch\); the value\(s\) that do not fill \(default\) get NO literal/.test(n)));
  assert.ok(!result.notes.some(n => /header: .*no per-variant spelling/.test(n)), 'the refusal is gone for the carried fact');
});

test('the per-variant rule reaches the stylesheet, only for the filling value, and the React emitter no longer ledgers the axis inert', () => {
  const carried = emit(propose('VERTICAL', [{ name: 'Variant=Default' }, { name: 'Variant=Stretch', header: true }]).contract);
  assert.match(carried.css, /\.variant-stretch \.header \{\s*width: 100%;\s*\}/);
  assert.doesNotMatch(carried.css, /\.variant-default \.header/, 'the non-filling value gets no rule, so nothing overrides its own size');
  const base = carried.css.slice(carried.css.indexOf('.header {'), carried.css.indexOf('}', carried.css.indexOf('.header {')));
  assert.doesNotMatch(base, /width/, 'and the base rule does not fill');
  assert.doesNotMatch(carried.tsx, INERT);
  assert.match(carried.tsx, /styles\[`variant-\$\{variant\}`\]/, 'the class the rule hangs on is composed');
  // The control: with no fill drawn anywhere the same axis IS inert, so the assertion above can fail.
  const undrawn = emit(propose('VERTICAL', [{ name: 'Variant=Default' }, { name: 'Variant=Stretch' }]).contract);
  assert.match(undrawn.tsx, INERT);
});

test('the vertical twin: a FILL-height under a ROW parent with a definite height carries height: 100%', () => {
  const result = propose('HORIZONTAL', [{ name: 'Variant=Default' }, { name: 'Variant=Stretch', header: true }]);
  assert.deepEqual(headerOf(result).literalsByProp, [{ prop: 'variant', map: { stretch: { height: '100%' } } }]);
  assert.match(emit(result.contract).css, /\.variant-stretch \.header \{\s*height: 100%;\s*\}/);
});

test('a second axis the fill does not depend on is ignored; every value of the axis it follows is covered', () => {
  const result = propose('VERTICAL', [
    { name: 'Size=S, Variant=Default' }, { name: 'Size=S, Variant=Stretch', header: true },
    { name: 'Size=L, Variant=Default' }, { name: 'Size=L, Variant=Stretch', header: true }]);
  assert.deepEqual(headerOf(result).literalsByProp, [{ prop: 'variant', map: { stretch: { width: '100%' } } }]);
});

test('a FILL drawn in EVERY variant proposes exactly what it did before', () => {
  // Width under a COLUMN whose other child hugs: the whole-set path names it (its bytes are unchanged).
  const width = propose('VERTICAL', [{ name: 'Variant=Default', header: true }, { name: 'Variant=Stretch', header: true }]);
  assert.equal(headerOf(width).literalsByProp, undefined);
  assert.equal(headerOf(width).literals, undefined);
  assert.ok(width.notes.some(n => /header: drawn FILL-width under a COLUMN parent whose other children do not all fill/.test(n)));
  // Height under a definite ROW: the base literal, not a per-variant one.
  const height = propose('HORIZONTAL', [{ name: 'Variant=Default', header: true }, { name: 'Variant=Stretch', header: true }]);
  assert.deepEqual(headerOf(height).literals, { height: '100%' });
  assert.equal(headerOf(height).literalsByProp, undefined);
  for (const result of [width, height]) assert.ok(!result.notes.some(n => /variant occurrence\(s\) only/.test(n)));
});

test('anything less correlated stays NAMED with nothing proposed', () => {
  const refused = (cells: Cell[], why: string) => {
    const result = propose('VERTICAL', cells);
    const header = headerOf(result);
    assert.equal(header.literalsByProp, undefined, why);
    assert.equal(header.literals, undefined, why);
    assert.ok(result.notes.some(n => NAMED.test(n)), why);
    assert.doesNotMatch(emit(result.contract).css, /width: 100%/, why);
  };
  refused([
    { name: 'Size=S, Variant=Default' }, { name: 'Size=S, Variant=Stretch' },
    { name: 'Size=L, Variant=Default' }, { name: 'Size=L, Variant=Stretch', header: true },
  ], 'a two-axis split: it fills only where Size=L AND Variant=Stretch');
  refused([
    { name: 'Size=S, Variant=Default', header: true }, { name: 'Size=S, Variant=Stretch' },
    { name: 'Size=L, Variant=Default' }, { name: 'Size=L, Variant=Stretch', header: true },
  ], 'uncorrelated: every value of both axes fills in one occurrence and not in another');

  // Partial coverage: the header is absent from Variant=Wide, so the axis value
  // "Wide" was never observed for it and the split is not known there.
  const set = restSet('VERTICAL', [{ name: 'Variant=Default' }, { name: 'Variant=Stretch', header: true }, { name: 'Variant=Wide' }]);
  set.children[2].children = set.children[2].children.slice(1);
  const dump = (mapRestToDump({ name: 'fixture', nodes: { '1:1': { document: set } } } as never).dump as unknown as Record<string, DumpSet>).Tabs;
  const partial = proposeFromDump(dump, { corpus: tokenCorpusFromJson({ primitives: { paint: { a: { $type: 'color', $value: '#ffffff' } } }, semantic: {}, light: {}, brandDefault: {} }), contractIdByName: new Map(), fileKey: null, projectionMode: 'reviewable-inversion', mintUnbound: true });
  const header = headerOf(partial);
  assert.equal(header.literalsByProp, undefined);
  assert.ok(partial.notes.some(n => NAMED.test(n)));
});

test('the primary-axis twin has no per-variant spelling: it is NAMED with its axis, and carried as neither grow nor 100%', () => {
  const result = propose('VERTICAL', [{ name: 'Variant=Default' }, { name: 'Variant=Stretch', header: true, list: true }]);
  const list = headerOf(result).parts!.list;
  assert.equal(list.literalsByProp, undefined, 'three siblings at width: 100% would each claim the whole row');
  assert.equal((list.layout as Record<string, unknown> | undefined)?.grow, undefined, 'grow is a per-part invariant: it would fill Variant=Default too');
  assert.ok(result.notes.some(n => /header\/list: drawn FILL-width along a ROW parent's primary axis in 1\/2 variant occurrence\(s\) only — a pure function of axis "Variant" \(Stretch\)\..*VariantLayoutSchema\) has no `grow`.*NAMED, not carried/.test(n)));
  // Drawn in every variant it is the ordinary grow, and nothing is named.
  const every = propose('VERTICAL', [{ name: 'Variant=Default', list: true }, { name: 'Variant=Stretch', list: true }]);
  assert.equal((headerOf(every).parts!.list.layout as Record<string, unknown>).grow, true);
  assert.ok(!every.notes.some(n => /primary axis in/.test(n)));
});
