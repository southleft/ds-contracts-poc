// Profile conventions text-align-by-combination and text-box-whole-pixel-beside-fixed-width (core/profile-conventions.ts).
// A label centered in every variant but one, and sized to its text in every variant but one, where no single axis
// decides either fact: off, both are named and nothing is proposed; on, the alignment is a literal combination table
// keyed by the two axes that decide it, and the whole-pixel box holds beside the fixed variant's own width row.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mapRestToDump } from '../extract/figma/rest/map.js';
import { proposeFromDump } from './propose-figma.js';
import { generateCss } from './emit-react.js';
import { tokenCorpusFromJson } from './token-corpus.js';
import { ContractSchema } from '../scripts/contract-schema.js';
import type { DumpSet } from '../extract/figma/types.js';

const SOLID = [{ type: 'SOLID', color: { r: 0.1, g: 0.2, b: 0.3, a: 1 } }];
// Kind × Size; (B, L) is LEFT-aligned and (A, L) is a fixed 40 px box: each is a function of both axes at once.
const cells = [['A', 'S', 'CENTER', 'WIDTH_AND_HEIGHT'], ['A', 'L', 'CENTER', 'HEIGHT'], ['B', 'S', 'CENTER', 'WIDTH_AND_HEIGHT'], ['B', 'L', 'LEFT', 'WIDTH_AND_HEIGHT']];
const restSet = { id: '1:1', name: 'Tag', type: 'COMPONENT_SET', children: cells.map(([kind, size, align, resize], i) => ({
  id: `1:${i + 2}`, name: `Kind=${kind}, Size=${size}`, type: 'COMPONENT', layoutMode: 'HORIZONTAL', primaryAxisAlignItems: 'CENTER',
  counterAxisAlignItems: 'CENTER', paddingTop: 0, paddingBottom: 0, paddingLeft: 4, paddingRight: 4,
  absoluteBoundingBox: { x: 0, y: 0, width: 48, height: 16 }, fills: SOLID,
  children: [{ id: `1:${i + 2}:t`, name: 'Label', type: 'TEXT', characters: 'AI', fills: SOLID,
    absoluteBoundingBox: { x: 4, y: 0, width: resize === 'HEIGHT' ? 40 : 14, height: 16 },
    layoutSizingHorizontal: resize === 'HEIGHT' ? 'FIXED' : 'HUG', layoutSizingVertical: 'HUG',
    style: { fontFamily: 'Inter', fontPostScriptName: 'Inter-SemiBold', fontWeight: 600, fontSize: 12, lineHeightPx: 16, lineHeightUnit: 'PIXELS',
      textAlignHorizontal: align, textAlignVertical: 'TOP', textAutoResize: resize } }],
})) };
const set = (mapRestToDump({ name: 'fixture', nodes: { '1:1': { document: restSet } } } as never).dump as unknown as Record<string, DumpSet>).Tag;
const corpus = tokenCorpusFromJson({ primitives: { ink: { $type: 'color', $value: '#1a334d' } }, semantic: {}, light: {}, brandDefault: {} });
const propose = (conventions: string[]) => proposeFromDump(set, { corpus, contractIdByName: new Map(), fileKey: null, projectionMode: 'reviewable-inversion', mintUnbound: true, conventions });
type Part = Record<string, unknown> & { literalsByCombination?: Array<{ props: string[]; rows: Array<{ values: string[]; literals: Record<string, string> }> }> };
const label = (result: { contract: unknown }) => (result.contract as { anatomy: { root: { parts: Record<string, Part> } } }).anatomy.root.parts.Label;
const rowsWith = (part: Part, channel: string) => (part.literalsByCombination ?? []).flatMap(t => t.rows.filter(r => channel in r.literals).map(r => ({ props: t.props, values: r.values, literals: r.literals })));
const valuesOf = (part: Part, channel: string) => rowsWith(part, channel).map(r => [...r.values, r.literals[channel]]);
const BOTH = ['text-align-by-combination', 'text-box-whole-pixel-beside-fixed-width'];

test('off: the mixed alignment and the mixed text box are named, and neither is proposed', () => {
  const off = propose([]);
  assert.deepEqual(rowsWith(label(off), 'text-align'), []);
  assert.equal('textAutoResize' in label(off), false);
  assert.deepEqual(rowsWith(label(off), 'width').map(r => r.literals), [{ width: '40px', 'min-width': '40px' }], 'the fixed variant keeps its width row');
  assert.ok(off.notes.some(n => /textAlignHorizontal differs across variants \(CENTER, LEFT\) — no complete enum-axis alignment correlation was proven; NAMED/.test(n)));
  assert.ok(off.notes.some(n => /sizes itself to its text .* in 3 of 4 variants and is HEIGHT in the rest .* REFUSED BY NAME/.test(n)));
});

test('on: alignment per combination of the two axes that decide it, and the whole-pixel box clamped by the fixed row', () => {
  const on = propose(BOTH);
  const part = label(on);
  assert.deepEqual(rowsWith(part, 'text-align').map(r => r.props), [['kind', 'size'], ['kind', 'size'], ['kind', 'size'], ['kind', 'size']]);
  assert.deepEqual(valuesOf(part, 'text-align'), [['a', 's', 'center'], ['a', 'l', 'center'], ['b', 's', 'center'], ['b', 'l', 'left']]);
  assert.equal(part.textAutoResize, 'WIDTH_AND_HEIGHT');
  assert.deepEqual([valuesOf(part, 'min-width'), valuesOf(part, 'max-width')], [[['a', 'l', '40px']], [['a', 'l', '40px']]]);
  assert.deepEqual(rowsWith(part, 'width'), [], 'no width row contradicts the whole-pixel box');
  ContractSchema.parse(on.contract);
  const inventory = new Set(Array.from(JSON.stringify(on.contract).matchAll(/\{([a-z0-9.-]+)\}/gi), m => m[1]));
  const errors: string[] = [];
  const css = generateCss(on.contract as never, inventory, errors);
  assert.deepEqual(errors, []);
  assert.match(css, /\n\.Label \{[^}]*inline-size: calc-size\(max-content, round\(up, size, 1px\)\)/);
  assert.match(css, /\.root:where\(\.kind-b\.size-l\) \.Label \{\n  text-align: left;\n\}/);
  assert.match(css, /\.root:where\(\.kind-a\.size-l\) \.Label \{\n  min-width: 40px;\n  text-align: center;\n  max-width: 40px;\n\}/);
  // Each convention stands alone.
  assert.equal('textAutoResize' in label(propose(BOTH.slice(0, 1))), false);
  assert.deepEqual(rowsWith(label(propose(BOTH.slice(1))), 'text-align'), []);
});
