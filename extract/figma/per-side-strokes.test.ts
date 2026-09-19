// Per-side stroke weights are CARRIED by both Figma readers (dump v1.34). Found
// by the design-led clean-consumer check on a designer's Tabs set: the header
// rule is drawn top 1 / right 0 / bottom 1 / left 0, both readers named that a
// loss (`stroke-weights-nonuniform`) and wrote the uniform weight Figma reports
// beside it — 0 — so the generated CSS drew a correctly coloured, zero-width,
// invisible border. The `border-<side>-width` literal channels, the
// `border-<side>-style: solid` synthesis and the CSS emitter already existed;
// only the dump field and the literal inversion were missing.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createFigmaMock } from '../../scripts/plugin-engine-mock-figma.mjs';
import { mapRestToDump } from './rest/map.js';
import { proposeFromDump } from '../../core/propose-figma.js';
import { generateCss } from '../../core/emit-react.js';
import { tokenCorpusFromJson } from '../../core/token-corpus.js';
import type { DumpNode, DumpSet } from './types.js';

type Sides = { top?: unknown; right?: unknown; bottom?: unknown; left?: unknown };
type HeaderSpec = { sides?: Sides; strokeWeight?: number; type?: string; strokes?: boolean };
const SOLID = (r: number, g: number, b: number) => [{ type: 'SOLID', color: { r, g, b, a: 1 } }];
// `strokesIncludedInLayout: true` — this file is about WHICH SIDES draw, on a rule
// that occupies layout (a CSS border). REST omits the field when it is false, and
// since dump v1.35 that absence is the fact "the stroke takes no layout space",
// which the emitters draw as an inset ring instead (stroke-outside-layout.test.ts).
const restHeader = (id: string, spec: HeaderSpec) => ({ id, name: 'header', type: spec.type ?? 'FRAME', layoutMode: 'HORIZONTAL',
  absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 40 }, strokeAlign: 'INSIDE', strokesIncludedInLayout: true,
  ...(spec.strokes === false ? {} : { strokes: SOLID(0.2, 0.2, 0.2) }),
  ...(spec.strokeWeight !== undefined ? { strokeWeight: spec.strokeWeight } : {}),
  ...(spec.sides ? { individualStrokeWeights: spec.sides } : {}), children: [] });
const restSet = (axis: string, specs: HeaderSpec[]) => ({ id: '1:1', name: 'Tabs', type: 'COMPONENT_SET',
  children: specs.map((spec, i) => ({ id: `1:${i + 2}`, name: `${axis}=${'ABC'[i]}`, type: 'COMPONENT', layoutMode: 'VERTICAL',
    absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 40 }, children: [restHeader(`1:${i + 2}9`, spec)] })) });
const mapped = (specs: HeaderSpec[], axis = 'Variant') => {
  const result = mapRestToDump({ name: 'fixture', nodes: { '1:1': { document: restSet(axis, specs) } } } as never);
  const set = (result.dump as unknown as Record<string, DumpSet>).Tabs;
  return { set, provenance: (result.dump as unknown as { _provenance: { dumpVersion: string } })._provenance,
    headers: set.variants.map(v => v.children![0]), receipts: result.report.degradations.filter(d => d.code === 'stroke-weights-nonuniform') };
};
const propose = (set: DumpSet) => proposeFromDump(set, { corpus: tokenCorpusFromJson({ primitives: { paint: { a: { $type: 'color', $value: '#ffffff' } } }, semantic: {}, light: {}, brandDefault: {} }), contractIdByName: new Map(), fileKey: null, projectionMode: 'reviewable-inversion', mintUnbound: true });
const headerPart = (contract: { anatomy: { root: { parts?: Record<string, Record<string, unknown>> } } }) => contract.anatomy.root.parts!.header;
const HEADER_RULE = { top: 1, right: 0, bottom: 1, left: 0 };
const WIDTHS = { 'border-top-width': '1px', 'border-right-width': '0px', 'border-bottom-width': '1px', 'border-left-width': '0px' };
const stripWeights = (n: DumpNode) => { const { strokeWeight: _w, strokeWeights: _s, ...rest } = n; return rest; };

test('the REST reader carries sides [1, 0, 1, 0] as strokeWeights, writes no uniform weight beside them, and names nothing', () => {
  // `strokeWeight: 0` is what Figma REST really reports for these sides.
  const { headers, receipts, provenance } = mapped([{ sides: HEADER_RULE, strokeWeight: 0 }, { sides: HEADER_RULE, strokeWeight: 0 }]);
  assert.equal(provenance.dumpVersion, '1.37');
  assert.deepEqual(headers.map(h => h.strokeWeights), [HEADER_RULE, HEADER_RULE]);
  assert.deepEqual(headers.map(h => 'strokeWeight' in h), [false, false], 'one stroke, one spelling — the reported 0 is not a drawn fact');
  assert.deepEqual(receipts, []);
  // An INSTANCE's sides are the same canvas fact (the active tab's bottom-only indicator).
  const instance = mapped([{ sides: { top: 0, right: 0, bottom: 2, left: 0 }, strokeWeight: 0, type: 'INSTANCE' }]);
  assert.deepEqual(instance.headers[0].strokeWeights, { top: 0, right: 0, bottom: 2, left: 0 });
  assert.equal('strokeWeight' in instance.headers[0], false);
});

test('uniform weights leave strokeWeights absent and the rest of the dump unchanged; an unreadable side keeps its receipt', () => {
  const plain = mapped([{ strokeWeight: 2 }]);
  const equalSides = mapped([{ strokeWeight: 2, sides: { top: 2, right: 2, bottom: 2, left: 2 } }]);
  assert.equal('strokeWeights' in equalSides.headers[0], false, 'absent means not captured, never zero');
  assert.equal(equalSides.headers[0].strokeWeight, 2);
  assert.deepEqual(equalSides.set, plain.set, 'four equal sides are the uniform stroke, byte for byte');
  assert.deepEqual(equalSides.receipts, []);
  // Differing sides change the two weight fields and nothing else on the node.
  assert.deepEqual(stripWeights(mapped([{ strokeWeight: 0, sides: HEADER_RULE }]).headers[0]), stripWeights(plain.headers[0]));
  // No visible stroke paint: neither spelling is written (a weight with no paint draws nothing).
  const unpainted = mapped([{ strokeWeight: 0, sides: HEADER_RULE, strokes: false }]);
  assert.deepEqual([unpainted.headers[0].stroke, unpainted.headers[0].strokeWeight, unpainted.headers[0].strokeWeights], [undefined, undefined, undefined]);
  // The residue that cannot be carried: a side with no pixel value is never read as 0.
  const broken = mapped([{ strokeWeight: 0, sides: { top: 1, right: 0, bottom: 1 } }]);
  assert.equal('strokeWeights' in broken.headers[0], false);
  assert.equal(broken.receipts.length, 1);
  assert.match(broken.receipts[0].message, /\[1, 0, 1, undefined\]/);
});

test('the plugin reader carries the same field from strokeTopWeight…strokeLeftWeight when strokeWeight is figma.mixed', async () => {
  const { figma, root } = createFigmaMock();
  const context = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
  const run = (code: string) => vm.runInContext(`(async () => {\n${code}\n})()`, context, { timeout: 20_000 }) as Promise<unknown>;
  // The Plugin API reports strokeWeight as figma.mixed once the four sides differ.
  await run(`
    const make = (name, sides) => { const c = figma.createComponent(); c.name = name; c.layoutMode = 'VERTICAL';
      const h = figma.createFrame(); h.name = 'header'; h.strokes = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }];
      if (sides === undefined) h.strokeWeight = 2;
      else { h.strokeTopWeight = sides[0]; h.strokeRightWeight = sides[1]; h.strokeBottomWeight = sides[2]; h.strokeLeftWeight = sides[3]; h.strokeWeight = figma.mixed; }
      c.appendChild(h); return c; };
    const set = figma.combineAsVariants([make('Variant=A', [1, 0, 1, 0]), make('Variant=B', undefined), make('Variant=C', [1, 0, 1, figma.mixed])], figma.currentPage);
    set.name = 'RuledTabs';`);
  assert.ok(root.findOne((n: { name: string }) => n.name === 'RuledTabs'));
  const source = readFileSync(new URL('./dump.plugin.js', import.meta.url), 'utf8')
    .replace(/^const TARGET_SETS = \[[^\n]*\];$/m, `const TARGET_SETS = ${JSON.stringify(['RuledTabs'])};`);
  const dumps = await run(source) as Record<string, DumpSet> & { _provenance: { dumpVersion: string }; _degradations: Array<{ code: string; nodePath: string }> };
  assert.equal(dumps._provenance.dumpVersion, '1.37');
  // The dump was built in the VM's realm; copy the values into this one.
  const headers = Array.from(dumps.RuledTabs.variants, v => JSON.parse(JSON.stringify(v.children![0])) as DumpNode);
  assert.deepEqual(headers.map(h => h.strokeWeights), [HEADER_RULE, undefined, undefined]);
  assert.deepEqual(headers.map(h => h.strokeWeight), [undefined, 2, undefined], 'a uniform stroke keeps riding strokeWeight alone');
  const receipts = Array.from(dumps._degradations).filter(d => d.code === 'stroke-weights-nonuniform');
  assert.deepEqual(receipts.map(d => d.nodePath), ['RuledTabs:Variant=C/header'], 'only the side with no pixel value is still named');
});

test('reader → proposer → CSS: the header rule reaches the stylesheet as four literal widths with no uniform border-width to hide it', () => {
  const { set } = mapped([{ sides: HEADER_RULE, strokeWeight: 0 }, { sides: HEADER_RULE, strokeWeight: 0 }]);
  const result = propose(set);
  const part = headerPart(result.contract as never);
  assert.deepEqual(part.literals, WIDTHS);
  assert.equal((part.tokens as Record<string, string>)['border-width'], undefined, 'the uniform mint stands down for a per-side node');
  assert.ok((part.tokens as Record<string, string>)['border-color'], 'the colour half of the stroke still carries');
  assert.ok(result.notes.some(n => /header: per-side stroke weights \[1, 0, 1, 0\].*carried as border-top-width/.test(n)));

  const inventory = new Set(Array.from(JSON.stringify(result.contract).matchAll(/\{([a-z0-9.-]+)\}/gi), m => m[1]));
  const errors: string[] = [];
  const css = generateCss(result.contract as never, inventory, errors);
  assert.deepEqual(errors, []);
  const rule = css.slice(css.indexOf('.header {'), css.indexOf('}', css.indexOf('.header {')));
  assert.match(rule, /border-top-width: 1px;/);
  assert.match(rule, /border-bottom-width: 1px;/);
  assert.match(rule, /border-right-width: 0px;/);
  assert.match(rule, /border-top-style: solid;/);
  assert.match(rule, /border-bottom-style: solid;/);
  assert.doesNotMatch(rule, /border-(right|left)-style/, 'a zero side earns no style keyword, so CSS paints nothing there');
  assert.doesNotMatch(css, /border-width\s*:/, 'no uniform border-width anywhere — nothing can zero the rule out');
});

test('a uniform stroke proposes exactly what it did before: a minted border-width and no per-side literal', () => {
  const result = propose(mapped([{ strokeWeight: 2 }, { strokeWeight: 2 }]).set);
  const part = headerPart(result.contract as never);
  assert.match((part.tokens as Record<string, string>)['border-width'], /^\{.+\}$/);
  assert.equal(part.literals, undefined);
  assert.equal(part.literalsByProp, undefined);
  assert.ok(!result.notes.some(n => /per-side stroke weights/.test(n)));
});

test('weights that follow one enum axis ride literalsByProp; a uniform variant expands to four equal sides, a strokeless one to four zeros', () => {
  const result = propose(mapped([{ sides: HEADER_RULE, strokeWeight: 0 }, { strokeWeight: 2 }, { strokes: false }], 'Tone').set);
  const part = headerPart(result.contract as never);
  assert.equal(part.literals, undefined);
  assert.deepEqual(part.literalsByProp, [{ prop: 'tone', map: {
    a: WIDTHS,
    b: { 'border-top-width': '2px', 'border-right-width': '2px', 'border-bottom-width': '2px', 'border-left-width': '2px' },
    c: { 'border-top-width': '0px', 'border-right-width': '0px', 'border-bottom-width': '0px', 'border-left-width': '0px' },
  } }]);
  assert.equal((part.tokens as Record<string, string> | undefined)?.['border-width'], undefined);
});

test('mixed or partial evidence is NAMED, never guessed', () => {
  // A stroked variant whose weight was not captured (a dump ≤ v1.33 plane) beside a per-side one.
  const { set } = mapped([{ sides: HEADER_RULE, strokeWeight: 0 }, { sides: HEADER_RULE, strokeWeight: 0 }]);
  delete set.variants[1].children![0].strokeWeights;
  const partial = propose(set);
  const part = headerPart(partial.contract as never);
  assert.equal(part.literals, undefined);
  assert.equal(part.literalsByProp, undefined);
  assert.equal((part.tokens as Record<string, string> | undefined)?.['border-width'], undefined, 'and no uniform width is invented in its place');
  assert.ok(partial.notes.some(n => /header: per-side stroke weights are mixed, partial, or invalid across variants \(\[1, 0, 1, 0\] \/ not captured/.test(n)));

  // An OUTSIDE stroke lowers to the outline vocabulary, which has no per-side widths.
  const outside = mapped([{ sides: HEADER_RULE, strokeWeight: 0 }]);
  outside.headers[0].strokeAlign = 'OUTSIDE';
  const named = propose(outside.set);
  assert.equal(headerPart(named.contract as never).literals, undefined);
  assert.ok(named.notes.some(n => /per-side stroke weights .* on an OUTSIDE stroke/.test(n)));
});
