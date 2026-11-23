// Profile convention gated-part-hidden-by-boolean (core/profile-conventions.ts). A field absent in the Busy plane (so it
// carries a State presence gate) and hidden wherever Open is false, in a sparse set that draws Open=False only for
// State=A: no complete State × Open table exists, so off the hidden channel is named and the field draws when closed;
// on, the gate stays and Open=false hides the field with display: none.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mapRestToDump } from '../extract/figma/rest/map.js';
import { proposeFromDump } from './propose-figma.js';
import { generateCss } from './emit-react.js';
import { tokenCorpusFromJson } from './token-corpus.js';
import { ContractSchema } from '../scripts/contract-schema.js';
import type { DumpSet } from '../extract/figma/types.js';

const SOLID = [{ type: 'SOLID', color: { r: 0.1, g: 0.2, b: 0.3, a: 1 } }];
const box = (id: string, name: string, width: number, extra: Record<string, unknown> = {}) => ({ id, name, type: 'FRAME', layoutMode: 'HORIZONTAL',
  absoluteBoundingBox: { x: 0, y: 0, width, height: 16 }, fills: SOLID, ...extra });
// [State, Open, field drawn?, field hidden?]
const cells: Array<[string, string, boolean, boolean]> = [['A', 'True', true, false], ['A', 'False', true, true], ['B', 'True', true, false], ['Busy', 'True', false, false]];
const restSet = { id: '1:1', name: 'Finder', type: 'COMPONENT_SET', children: cells.map(([state, open, drawn, hidden], i) => ({
  id: `1:${i + 2}`, name: `State=${state}, Open=${open}`, type: 'COMPONENT', layoutMode: 'HORIZONTAL', counterAxisAlignItems: 'CENTER',
  absoluteBoundingBox: { x: 0, y: 0, width: 80, height: 16 }, fills: SOLID,
  children: [box(`1:${i + 2}:i`, 'Icon', 16), ...(drawn ? [box(`1:${i + 2}:f`, 'Field', 64, hidden ? { visible: false } : {})] : [])],
})) };
const set = (mapRestToDump({ name: 'fixture', nodes: { '1:1': { document: restSet } } } as never).dump as unknown as Record<string, DumpSet>).Finder;
const corpus = tokenCorpusFromJson({ primitives: { ink: { $type: 'color', $value: '#1a334d' } }, semantic: {}, light: {}, brandDefault: {} });
const propose = (conventions: string[]) => proposeFromDump(set, { corpus, contractIdByName: new Map(), fileKey: null, projectionMode: 'reviewable-inversion', mintUnbound: true, hiddenCaptured: true, conventions });
const field = (result: { contract: unknown }) => (result.contract as { anatomy: { root: { parts: Record<string, Record<string, unknown>> } } }).anatomy.root.parts.Field;
const css = (result: { contract: unknown }) => {
  const inventory = new Set(Array.from(JSON.stringify(result.contract).matchAll(/\{([a-z0-9.-]+)\}/gi), m => m[1]));
  const errors: string[] = [];
  const out = generateCss(result.contract as never, inventory, errors);
  assert.deepEqual(errors, []);
  return out;
};

test('off: the hidden channel is named as uncorrelated and the field keeps only its State gate', () => {
  const off = propose([]);
  assert.deepEqual(field(off).visibleWhen, { prop: 'state', equals: ['a', 'b'] });
  assert.equal(field(off).stylesWhen, undefined);
  assert.ok(off.notes.some(n => /Field: hidden in 1\/3 variants without correlating to any axis — kept unconditional/.test(n)));
  assert.doesNotMatch(css(off), /display: none/);
});

test('on: the State gate stays and Open=false hides the field with display: none', () => {
  const on = propose(['gated-part-hidden-by-boolean']);
  assert.deepEqual(field(on).visibleWhen, { prop: 'state', equals: ['a', 'b'] });
  assert.deepEqual(field(on).stylesWhen, [{ prop: 'open', equals: 'false', styles: { display: 'none' } }]);
  assert.ok(on.notes.some(n => /Field: hidden exactly where "Open" is false over its 3 drawn occurrences, beside its existing presence gate/.test(n)));
  assert.equal(on.notes.some(n => /Field: hidden in .* without correlating/.test(n)), false);
  ContractSchema.parse(on.contract);
  assert.match(css(on), /\n\.root\[data-dsc-false-open\] \.Field \{\n  display: none;\n\}/);
});
