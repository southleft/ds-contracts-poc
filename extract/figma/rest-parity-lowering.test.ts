// What the proposer does with the channels the REST reader carries since
// REST dump v1.44 (plugin dump v1.48): text decoration, PERCENT line heights
// and CENTER stroke alignment. Found by the first real-kit scoreboard: Twilio
// Paste's Anchor and Progress Steps labels drew no underline, and Untitled
// UI's Featured icon drew its 2–10px CENTER rings as inward borders, off by
// half the weight on every side.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mapRestToDump, type RestNode } from './rest/map.js';
import { proposeFromDump } from '../../core/propose-figma.js';
import { generateCss } from '../../core/emit-react.js';
import { tokenCorpusFromJson } from '../../core/token-corpus.js';
import { ContractSchema } from '../../scripts/contract-schema.js';
import type { DumpNode, DumpSet } from './types.js';

const SOLID = (r: number, g: number, b: number) => [{ type: 'SOLID', color: { r, g, b, a: 1 } }];
const corpus = tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} });
const propose = (set: DumpSet, mintUnbound = true) =>
  proposeFromDump(set, { corpus, contractIdByName: new Map(), fileKey: null, projectionMode: 'reviewable-inversion', mintUnbound });
type Anatomy = { root: Record<string, unknown> & { parts?: Record<string, Record<string, unknown>> } };
const anatomyOf = (r: { contract: unknown }) => (r.contract as { anatomy: Anatomy }).anatomy;
const minted = (r: ReturnType<typeof propose>) => new Map((r.mintedTokens?.entries ?? []).map((e) => [e.ref, e.value]));
const cssOf = (r: ReturnType<typeof propose>) => {
  // Every ref the contract binds directly, plus every minted leaf (a per-value
  // ref like {imported.x.root.outline-offset.{size}} resolves to those).
  const inventory = new Set([
    ...Array.from(JSON.stringify(r.contract).matchAll(/\{([a-z0-9.-]+)\}/gi), (m) => m[1]),
    ...(r.mintedTokens?.entries ?? []).map((e) => e.ref.replace(/^\{|\}$/g, '')),
  ]);
  const errors: string[] = [];
  const css = generateCss(r.contract as never, inventory, errors);
  assert.deepEqual(errors, []);
  return css;
};

/** A REST COMPONENT_SET whose variants each hold one label text node. */
function labelSet(rows: Array<{ name: string; decoration?: string }>, axes: Record<string, string[]>): DumpSet {
  const set: RestNode = {
    id: '1:1', name: 'Link', type: 'COMPONENT_SET',
    componentPropertyDefinitions: Object.fromEntries(Object.entries(axes).map(([k, v]) => [k, { type: 'VARIANT', defaultValue: v[0], variantOptions: v }])),
    children: rows.map((row, i) => ({
      id: `1:${i + 2}`, name: row.name, type: 'COMPONENT', layoutMode: 'HORIZONTAL', absoluteBoundingBox: { x: 0, y: 40 * i, width: 60, height: 20 },
      children: [{ id: `2:${i}`, name: 'Label', type: 'TEXT', characters: 'Link', absoluteBoundingBox: { x: 0, y: 40 * i, width: 60, height: 20 },
        fills: SOLID(0.1, 0.2, 0.3),
        style: { fontFamily: 'Inter', fontWeight: 400, fontSize: 14, lineHeightUnit: 'FONT_SIZE_%', lineHeightPercentFontSize: 150, lineHeightPx: 21,
          ...(row.decoration ? { textDecoration: row.decoration } : {}) } }],
    })),
  };
  return (mapRestToDump({ name: 'fixture', nodes: { '1:1': { document: set } } }).dump as unknown as Record<string, DumpSet>).Link;
}

test('a decoration drawn in every variant carries as the declared text-decoration-line', () => {
  const r = propose(labelSet([{ name: 'Tone=A', decoration: 'UNDERLINE' }, { name: 'Tone=B', decoration: 'UNDERLINE' }], { Tone: ['A', 'B'] }));
  ContractSchema.parse(r.contract);
  const holders = JSON.stringify(anatomyOf(r));
  assert.match(holders, /"text-decoration-line":"underline"/);
  assert.match(cssOf(r), /text-decoration-line: underline/);
  assert.ok(r.notes.some((n) => /carried as declared text-decoration-line: underline/.test(n)), r.notes.join('\n'));
});

test('a decoration that is a function of one enum axis carries per value as stylesWhen text-decoration', () => {
  const r = propose(labelSet([
    { name: 'Kind=Anchor', decoration: 'UNDERLINE' },
    { name: 'Kind=Plain' },
    { name: 'Kind=Deleted', decoration: 'STRIKETHROUGH' },
  ], { Kind: ['Anchor', 'Plain', 'Deleted'] }));
  ContractSchema.parse(r.contract);
  const text = JSON.stringify(anatomyOf(r));
  assert.match(text, /"stylesWhen":\[\{"prop":"kind","equals":"anchor","styles":\{"text-decoration":"underline"\}\},\{"prop":"kind","equals":"deleted","styles":\{"text-decoration":"line-through"\}\}\]/);
  assert.doesNotMatch(text, /text-decoration-line/);
  const css = cssOf(r);
  assert.match(css, /text-decoration: underline/);
  assert.match(css, /text-decoration: line-through/);
});

test('a decoration on the TRUE side of a boolean axis carries; on the FALSE side, or uncorrelated, it is named', () => {
  const truthy = propose(labelSet([{ name: 'Linked=true', decoration: 'UNDERLINE' }, { name: 'Linked=false' }], { Linked: ['true', 'false'] }));
  assert.match(JSON.stringify(anatomyOf(truthy)), /"stylesWhen":\[\{"prop":"linked","styles":\{"text-decoration":"underline"\}\}\]/);
  const falsy = propose(labelSet([{ name: 'Plain=true' }, { name: 'Plain=false', decoration: 'UNDERLINE' }], { Plain: ['true', 'false'] }));
  assert.doesNotMatch(JSON.stringify(anatomyOf(falsy)), /text-decoration/);
  assert.ok(falsy.notes.some((n) => /FALSE side of boolean axis "Plain" .* NAMED, not proposed/.test(n)), falsy.notes.join('\n'));
  const mixed = propose(labelSet([
    { name: 'A=1, B=1', decoration: 'UNDERLINE' }, { name: 'A=1, B=2' }, { name: 'A=2, B=1' }, { name: 'A=2, B=2', decoration: 'UNDERLINE' },
  ], { A: ['1', '2'], B: ['1', '2'] }));
  assert.doesNotMatch(JSON.stringify(anatomyOf(mixed)), /text-decoration/);
  assert.ok(mixed.notes.some((n) => /without correlating to one variant axis .* NAMED, not proposed/.test(n)), mixed.notes.join('\n'));
});

test('a PERCENT line height reaches the contract as the drawn pixels', () => {
  const r = propose(labelSet([{ name: 'Tone=A' }, { name: 'Tone=B' }], { Tone: ['A', 'B'] }));
  const values = [...minted(r).entries()].filter(([ref]) => /line-height/.test(ref)).map(([, v]) => v);
  assert.deepEqual(values, ['21px']);
});

// --- CENTER strokes ---------------------------------------------------------
type Ring = { align: 'INSIDE' | 'CENTER' | 'OUTSIDE'; weight: number; included?: boolean } | null;
/** A free-frame icon container (Featured icon's shape): no auto-layout, so
 *  REST's absent strokesIncludedInLayout reads false on this route. */
function ringSet(rings: Ring[]): DumpSet {
  const set: RestNode = {
    id: '1:1', name: 'Featured', type: 'COMPONENT_SET',
    componentPropertyDefinitions: { Size: { type: 'VARIANT', defaultValue: 'S0', variantOptions: rings.map((_, i) => `S${i}`) } },
    children: rings.map((ring, i) => ({
      id: `1:${i + 2}`, name: `Size=S${i}`, type: 'COMPONENT', cornerRadius: 28, fills: SOLID(1, 1, 1),
      absoluteBoundingBox: { x: 0, y: 60 * i, width: 56, height: 56 },
      ...(ring ? { strokes: SOLID(0.9, 0.9, 0.9), strokeWeight: ring.weight, strokeAlign: ring.align } : {}),
      ...(ring?.included ? { layoutMode: 'HORIZONTAL', strokesIncludedInLayout: true } : {}),
      children: [],
    })),
  };
  return (mapRestToDump({ name: 'fixture', nodes: { '1:1': { document: set } } }).dump as unknown as Record<string, DumpSet>).Featured;
}

test('CENTER strokes that take no layout space carry as an outline pulled back by half the weight', () => {
  const set = ringSet([{ align: 'CENTER', weight: 10 }, { align: 'CENTER', weight: 4 }, null]);
  assert.deepEqual(set.variants.map((v) => [(v as DumpNode).strokeAlign, (v as DumpNode).strokesIncludedInLayout]), [['CENTER', false], ['CENTER', false], [undefined, undefined]]);
  const r = propose(set);
  ContractSchema.parse(r.contract);
  const root = anatomyOf(r).root;
  const tokens = root.tokens as Record<string, string>;
  assert.ok(tokens['outline-color'] && tokens['outline-width'] && tokens['outline-offset'], JSON.stringify(root));
  assert.equal(tokens['border-width'], undefined);
  assert.equal((root.declared as Record<string, string>)['outline-style'], 'solid');
  const values = minted(r);
  const offsets = [...values].filter(([ref]) => /outline-offset/.test(ref)).map(([, v]) => v).sort();
  const widths = [...values].filter(([ref]) => /outline-width/.test(ref)).map(([, v]) => v).sort();
  assert.deepEqual(offsets, ['-2px', '-5px', '0px']);
  assert.deepEqual(widths, ['0px', '10px', '4px']);
  const css = cssOf(r);
  assert.match(css, /outline-offset: var\(/);
  assert.doesNotMatch(css, /border-width\s*:/);
});

test('a node mixing INSIDE (no layout space) and CENTER strokes gets one outline spelling with per-variant offsets', () => {
  const r = propose(ringSet([{ align: 'INSIDE', weight: 1 }, { align: 'CENTER', weight: 10 }]));
  ContractSchema.parse(r.contract);
  const offsets = [...minted(r)].filter(([ref]) => /outline-offset/.test(ref)).map(([, v]) => v).sort();
  assert.deepEqual(offsets, ['-1px', '-5px']);
  assert.ok(!r.notes.some((n) => /stroke alignment differs across variants/.test(n)), 'the mix is no longer refused');
});

test('CENTER where the stroke takes layout space, or the fact is not captured, keeps the named INSIDE-border approximation', () => {
  const included = propose(ringSet([{ align: 'CENTER', weight: 2, included: true }, { align: 'CENTER', weight: 2, included: true }]));
  const tokens = anatomyOf(included).root.tokens as Record<string, string>;
  assert.ok(tokens['border-width'] && !tokens['outline-offset'], JSON.stringify(tokens));
  assert.ok(included.notes.some((n) => /strokeAlign CENTER .* REFUSED BY NAME/.test(n)), included.notes.join('\n'));
  const legacy = structuredClone(ringSet([{ align: 'CENTER', weight: 2 }, { align: 'CENTER', weight: 2 }]));
  for (const v of legacy.variants) delete (v as DumpNode).strokesIncludedInLayout;
  const old = propose(legacy);
  assert.ok((anatomyOf(old).root.tokens as Record<string, string>)['border-width']);
  // Without minting the offsets have no carrier, so nothing switches vocabulary.
  const bare = propose(ringSet([{ align: 'CENTER', weight: 2 }, { align: 'CENTER', weight: 2 }]), false);
  assert.equal((anatomyOf(bare).root.tokens as Record<string, string> | undefined)?.['outline-offset'], undefined);
});

test('an OUTSIDE stroke drawn on some sides only keeps its per-side widths as a border (no outline spelling), named', () => {
  // Radix's Blockquote: a 4px rule on the left side only, aligned OUTSIDE.
  const set: RestNode = {
    id: '1:1', name: 'Quote', type: 'COMPONENT_SET',
    componentPropertyDefinitions: { Size: { type: 'VARIANT', defaultValue: '1', variantOptions: ['1', '2'] } },
    children: ['1', '2'].map((size, i) => ({
      id: `1:${i + 2}`, name: `Size=${size}`, type: 'COMPONENT', layoutMode: 'HORIZONTAL', paddingLeft: 12,
      absoluteBoundingBox: { x: 0, y: 40 * i, width: 200, height: 24 },
      strokes: SOLID(0.2, 0.3, 0.9), strokeWeight: 0, strokeAlign: 'OUTSIDE',
      individualStrokeWeights: { top: 0, right: 0, bottom: 0, left: 4 },
      children: [],
    })),
  };
  const dumpSet = (mapRestToDump({ name: 'f', nodes: { '1:1': { document: set } } }).dump as unknown as Record<string, DumpSet>).Quote;
  const r = propose(dumpSet);
  ContractSchema.parse(r.contract);
  const root = JSON.stringify(anatomyOf(r).root);
  assert.doesNotMatch(root, /outline-color/);
  assert.match(root, /border-left-width/);
  assert.ok(r.notes.some((n) => /strokeAlign OUTSIDE on a stroke whose sides differ .* carries as a border drawn INWARD/.test(n)), r.notes.join('\n'));
  assert.match(cssOf(r), /--_stroke-left-width: 4px|border-left-width: 4px/);
});

test('an undrawable path node with a drawn size keeps its box but is not painted as one', () => {
  // HeroUI's office-badge: a BOOLEAN_OPERATION pencil in a free 16×16 frame.
  const variant = (id: string, name: string, child: RestNode): RestNode => ({
    id, name, type: 'COMPONENT', absoluteBoundingBox: { x: 0, y: 0, width: 16, height: 16 }, children: [child],
  });
  const glyph = (extra: Partial<RestNode> = {}): RestNode => ({
    id: '2:1', name: 'edit', type: 'BOOLEAN_OPERATION', fills: SOLID(0, 0, 0),
    absoluteBoundingBox: { x: 1, y: 1, width: 14, height: 13 }, constraints: { horizontal: 'LEFT', vertical: 'TOP' }, children: [], ...extra,
  });
  const proposeOne = (v: RestNode) => propose((mapRestToDump({ nodes: { a: { document: v } } }).dump as unknown as Record<string, DumpSet>)[v.name]);
  const free = proposeOne(variant('1:1', 'Badge', glyph()));
  ContractSchema.parse(free.contract);
  const edit = JSON.stringify(anatomyOf(free).root.parts?.edit);
  assert.match(edit, /"position":"absolute"/);
  assert.doesNotMatch(edit, /background-color/);
  assert.ok(free.notes.some((n) => /BOOLEAN_OPERATION geometry is not carried .* its paint is NOT carried/.test(n)), free.notes.join('\n'));
  // An unsized, fill-only, childless one (hugging in auto-layout: nothing gives
  // it a box, so its fill paints nothing) proposes what it always did…
  const flow = proposeOne({ ...variant('1:1', 'Flow', glyph({ absoluteBoundingBox: { x: 0, y: 0, width: 14, height: 13 } })), layoutMode: 'HORIZONTAL' });
  assert.match(JSON.stringify(anatomyOf(flow).root.parts?.edit), /background-color/);
  // …but a stroked one would paint a 2×weight square even at 0×0, so it is not painted either.
  const stroked = proposeOne({ ...variant('1:1', 'Stroked', glyph({ fills: [], strokes: SOLID(0, 0, 0), strokeWeight: 1.5, strokeAlign: 'CENTER',
    absoluteBoundingBox: { x: 0, y: 0, width: 14, height: 13 } })), layoutMode: 'HORIZONTAL' });
  assert.doesNotMatch(JSON.stringify(anatomyOf(stroked).root.parts?.edit ?? {}), /border|outline/);
});

test('absolute placement whose constraints differ across variants carries at the drawn geometry as LEFT×TOP, named', () => {
  // Chakra's Progress fill: ABSOLUTE in an auto-layout track, STRETCH at 100% and LEFT elsewhere.
  const fills = [{ value: '25', width: 50, h: 'LEFT' }, { value: '100', width: 200, h: 'LEFT_RIGHT' }];
  const set: RestNode = {
    id: '1:1', name: 'Meter', type: 'COMPONENT_SET',
    componentPropertyDefinitions: { Value: { type: 'VARIANT', defaultValue: '25', variantOptions: ['25', '100'] } },
    children: fills.map((f, i) => ({
      id: `1:${i + 2}`, name: `Value=${f.value}`, type: 'COMPONENT', layoutMode: 'VERTICAL', fills: SOLID(0.9, 0.9, 0.9),
      absoluteBoundingBox: { x: 0, y: 20 * i, width: 200, height: 8 },
      children: [{ id: `2:${i}`, name: 'Range', type: 'FRAME', layoutPositioning: 'ABSOLUTE', fills: SOLID(0.1, 0.5, 0.9),
        absoluteBoundingBox: { x: 0, y: 20 * i, width: f.width, height: 8 }, constraints: { horizontal: f.h, vertical: 'TOP' },
        layoutSizingHorizontal: 'FIXED', layoutSizingVertical: 'FIXED', children: [] }],
    })),
  };
  const dumpSet = (mapRestToDump({ name: 'f', nodes: { '1:1': { document: set } } }).dump as unknown as Record<string, DumpSet>).Meter;
  assert.deepEqual(dumpSet.variants.map((v) => (v as DumpNode).children![0].abs?.constraints?.horizontal), ['LEFT', 'STRETCH']);
  const r = propose(dumpSet);
  ContractSchema.parse(r.contract);
  const parts = anatomyOf(r).root.parts ?? {};
  const range = JSON.stringify(parts.Range ?? parts.range);
  assert.match(range, /"position":"absolute"/);
  assert.ok(r.notes.some((n) => /constraints differ across variants \(LEFT\|STRETCH × TOP\) — every drawn box is carried at its DRAWN geometry as LEFT×TOP/.test(n)), r.notes.join('\n'));
  const widths = [...minted(r)].filter(([ref]) => /range\.width/.test(ref)).map(([, v]) => v).sort();
  assert.deepEqual(widths, ['200px', '50px']);
});
