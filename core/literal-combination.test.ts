/**
 * literalsByCombination (beta spike, "carry, don't drop") across surfaces.
 *
 * A literal that a variant set draws as a function of SEVERAL props at once —
 * the Radix Button content fill = f(variant, color, highContrast, state) —
 * used to be dropped by the Figma importer. The contract now carries it as a
 * sparse table of drawn combinations. These tests hold the referee, the
 * per-variant resolver, both React surfaces in a real browser, the shadow CSS
 * and the native compiler to one reading of the same table.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { ContractSchema, resolveLiterals, type Contract } from '../scripts/contract-schema.js';
import { validateContract } from '../packages/core/src/validate.js';
import { emitReact } from './emit-react.js';
import { emitReactInline } from './emit-react-inline.js';
import { shadowCss } from '../packages/emitter-web-components/src/emit-wc.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { tokenInventoryFromJson } from './tokens.js';
import { mountGenerated, generatedTypeErrors } from './react-test-runtime.js';

const tokens = { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
/** tone × size × loud; the label fill is drawn for four of the eight combinations. */
const labelRows = [
  { values: ['quiet', 'sm', 'false'], literals: { 'background-color': '#102030', color: '#ffffff' } },
  { values: ['quiet', 'lg', 'true'], literals: { 'background-color': '#203040', color: '#eeeeee' } },
  { values: ['strong', 'sm', 'true'], literals: { 'background-color': '#304050', color: '#dddddd' } },
  { values: ['strong', 'lg', 'false'], literals: { 'background-color': '#405060', color: '#cccccc' } },
];
const hex = (h: string) => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`;

function seed(): Contract {
  return ContractSchema.parse({
    id: 'probe.combo', name: 'ComboSurface', version: '0.1.0', status: 'draft', description: 'A sparse literal table over three props',
    props: [
      { name: 'tone', type: { enum: ['quiet', 'strong'] }, default: 'quiet', bindings: { code: { prop: 'tone' }, figma: { kind: 'VARIANT', property: 'Tone' } } },
      { name: 'size', type: { enum: ['sm', 'lg'] }, default: 'sm', bindings: { code: { prop: 'size' }, figma: { kind: 'VARIANT', property: 'Size' } } },
      { name: 'loud', type: 'boolean', default: false, bindings: { code: { prop: 'loud' }, figma: { kind: 'VARIANT', property: 'Loud' } } },
    ],
    states: [], semantics: { element: 'div' },
    anatomy: { root: {
      layout: { display: 'flex' },
      literals: { width: '48px', height: '24px' },
      literalsByCombination: [{ props: ['tone', 'loud'], rows: [{ values: ['strong', 'true'], literals: { opacity: '0.5' } }] }],
      parts: { label: { text: 'x', literalsByCombination: [{ props: ['tone', 'size', 'loud'], rows: labelRows }] } },
    } },
    bindings: { code: { anchors: { importPath: './ComboSurface', export: 'ComboSurface' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
}
const combos = ['quiet', 'strong'].flatMap((tone) => ['sm', 'lg'].flatMap((size) => ['false', 'true'].map((loud) => ({ tone, size, loud }))));
const rowOf = (c: { tone: string; size: string; loud: string }) =>
  labelRows.find((r) => r.values.join() === [c.tone, c.size, c.loud].join());
const errorsOf = (c: Contract) => {
  const errors: string[] = [];
  validateContract(c, new Map([[c.id, c]]), errors, new Map());
  return errors;
};

test('the referee admits a sparse table and refuses what no surface could read one way', () => {
  assert.deepEqual(errorsOf(seed()), []);
  const refuse = (change: (c: Contract) => void, why: RegExp) => {
    const bad = seed();
    change(bad);
    assert.match(errorsOf(bad).join('\n'), why);
  };
  const table = (c: Contract) => c.anatomy.root.parts!.label.literalsByCombination![0];
  refuse((c) => { table(c).props[0] = 'nope'; }, /unknown prop "nope"/);
  refuse((c) => { table(c).rows[0].values[0] = 'loudest'; }, /is not a value of prop "tone"/);
  refuse((c) => { table(c).rows[0].values[2] = 'maybe'; }, /is not a value of prop "loud"/);
  refuse((c) => { table(c).rows[1] = structuredClone(table(c).rows[0]); }, /carries the tuple .* twice/);
  refuse((c) => { table(c).rows[0].values.pop(); }, /has 2 value\(s\) for 3 prop\(s\)/);
  refuse((c) => { table(c).rows[0].literals = { cursor: '1px' }; }, /not a literal channel/);
  refuse((c) => { table(c).props = ['tone', 'tone', 'loud']; }, /lists a prop twice/);
  refuse((c) => { c.anatomy.root.parts!.label.tokens = { color: '{x.y}' }; }, /AND as a token binding/);
  refuse((c) => {
    c.anatomy.root.parts!.label.literalsByCombination!.push({ props: ['size'], rows: [{ values: ['sm'], literals: { color: '#000000' } }] });
  }, /in two literalsByCombination tables/);
});

test('resolveLiterals picks the one row every prop matches; an omitted prop or an undrawn combination matches none', () => {
  const label = seed().anatomy.root.parts!.label;
  for (const c of combos) {
    const row = rowOf(c);
    assert.deepEqual(resolveLiterals(label, c), row ? row.literals : {}, JSON.stringify(c));
  }
  assert.deepEqual(resolveLiterals(label, { tone: 'quiet', size: 'sm' }), {});
  assert.deepEqual(resolveLiterals(seed().anatomy.root, { tone: 'strong', size: 'lg', loud: 'true' }), { width: '48px', height: '24px', opacity: '0.5' });
});

test('React CSS Modules and inline React draw every drawn combination and leave the undrawn ones at the base', async () => {
  const c = seed(), contracts = new Map([[c.id, c]]), icons = new Map<string, string>();
  const css = emitReact(c, { contracts, icons, tokens: tokenInventoryFromJson([{}]) });
  const inline = emitReactInline(c, { contracts, icons, tokens });
  assert.match(css.css, /\.tone-strong\.size-lg:not\(\[data-loud\]\) \.label \{\n {2}background-color: #405060;\n {2}color: #cccccc;\n\}/);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const output of [css, { ...inline, css: '' }]) {
      assert.deepEqual(generatedTypeErrors(c.name, output.tsx), []);
      await mountGenerated(page, c.name, output.tsx, output.css);
      for (const combo of [...combos, ...combos.slice().reverse()]) {
        await page.evaluate((props) => (window as any).renderSubject(props), { tone: combo.tone, size: combo.size, loud: combo.loud === 'true' });
        const got = await page.locator('#root > div').evaluate((root) => {
          const label = root.firstElementChild as HTMLElement;
          return { bg: getComputedStyle(label).backgroundColor, ink: getComputedStyle(label).color, opacity: getComputedStyle(root).opacity };
        });
        const row = rowOf(combo);
        assert.equal(got.bg, row ? hex(row.literals['background-color']) : 'rgba(0, 0, 0, 0)', JSON.stringify(combo));
        if (row) assert.equal(got.ink, hex(row.literals.color), JSON.stringify(combo));
        assert.equal(got.opacity, combo.tone === 'strong' && combo.loud === 'true' ? '0.5' : '1', JSON.stringify(combo));
      }
    }
  } finally {
    await browser.close();
  }
});

test('shadow CSS and the native compiler carry the same rows', () => {
  const c = seed();
  const shadow = shadowCss(c, tokens, []);
  for (const row of labelRows) assert.ok(shadow.includes(`background-color: ${row.literals['background-color']}`), row.values.join());
  const native = createFigmaEngine({ tokens, icons: new Map() }).compileComponentData(c, new Map([[c.id, c]]));
  assert.equal(native.variants.length, 8);
  const serialized = native.variants.map((v: { name: string; spec: unknown }) => ({ name: v.name, spec: JSON.stringify(v.spec) }));
  for (const combo of combos) {
    const row = rowOf(combo);
    const variant = serialized.find((v: { name: string }) =>
      v.name.includes(`Tone=${combo.tone}`) && v.name.includes(`Size=${combo.size}`) && v.name.includes(`Loud=${combo.loud}`));
    assert.ok(variant, JSON.stringify(combo));
    const fill = row && hexToUnit(row.literals['background-color']);
    if (fill) assert.ok(variant.spec.includes(JSON.stringify(fill).slice(1, -1)), `${variant.name} draws ${row!.literals['background-color']}`);
  }
});

function hexToUnit(h: string) {
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
  return { r: n(1), g: n(3), b: n(5) };
}
