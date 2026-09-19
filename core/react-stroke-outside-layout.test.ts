// `Part.strokesIncludedInLayout: false` on the three code surfaces (dump v1.35).
// A designer's Figma stroke paints over the padding and takes no layout space;
// the CSS `border` it lowered to grows the box. Measured by the design-led
// consumer check on the 72-variant CBDS Badge: all 24 outline variants 4px too
// wide, and the 16px-high small one 20px high (8+8 padding plus a 2px border
// cannot fit a 16px border box). The emitters now draw that stroke as an inset
// box-shadow ring — same channels, same tokens, no layout space — and these
// tests MEASURE the box in Chromium rather than read the stylesheet's intent.
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import { emitReact, validateContract } from './emit-react.js';
import { emitReactInline } from './emit-react-inline.js';
import { shadowCss } from '../packages/emitter-web-components/src/emit-wc.js';
import { generatedTypeErrors, mountGenerated } from './react-test-runtime.js';
import { flattenTokens, tokenInventoryFromJson } from './tokens.js';
import { referencedCssVars } from './emit-tokens-css.js';

const tokens = { primitives: {
  paint: { ground: { $type: 'color', $value: '#ffffff' }, brand: { $type: 'color', $value: '#0e61ba' }, danger: { $type: 'color', $value: '#c6262e' } },
  stroke: { thin: { $type: 'dimension', $value: '1px' }, thick: { $type: 'dimension', $value: '2px' } },
  pad: { block: { $type: 'dimension', $value: '8px' }, inline: { $type: 'dimension', $value: '12px' } },
  box: { small: { $type: 'dimension', $value: '16px' }, wide: { $type: 'dimension', $value: '80px' } },
  lift: { $type: 'shadow', $value: '0 2px 4px #00000040' },
}, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
const TONE = { name: 'tone', type: { enum: ['brand', 'danger'] }, default: 'brand', bindings: { code: { prop: 'tone' }, figma: { kind: 'VARIANT', property: 'Tone', values: { brand: 'Brand', danger: 'Danger' } } } };
/** The Badge's own shape: a FIXED 16px-high box, 8px block padding, a 2px stroke. */
const BADGE = {
  layout: { display: 'inline-flex', direction: 'row', align: 'center', justify: 'center' },
  tokens: { 'background-color': '{paint.ground}', 'border-width': '{stroke.thick}', 'border-color': '{paint.{tone}}',
    'padding-block': '{pad.block}', 'padding-inline': '{pad.inline}', height: '{box.small}', width: '{box.wide}' },
};
function contract(root: Record<string, unknown>, element = 'div'): Contract {
  return ContractSchema.parse({
    id: 'probe.stroke-layout', name: 'StrokeLayoutProbe', version: '1.0.0', archetype: 'none',
    description: 'Stroke-outside-layout conformance, not a qualified source component.',
    semantics: { element }, props: [TONE], states: element === 'button' ? ['hover'] : [],
    anatomy: { root },
    bindings: { code: { anchors: { importPath: './StrokeLayoutProbe', export: 'StrokeLayoutProbe' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
}
const ctx = (c: Contract) => ({ contracts: new Map([[c.id, c]]), icons: new Map<string, string>() });
const modules = (c: Contract) => emitReact(c, { ...ctx(c), tokens: tokenInventoryFromJson([tokens.primitives]) });
const inline = (c: Contract) => emitReactInline(c, { ...ctx(c), tokens } as never);
const rootVars = `:root {${[...flattenTokens(tokens.primitives)].map(([key, token]) => `--${key.replaceAll('.', '-')}: ${token.value};`).join('\n')}}\n`;
const rule = (css: string, selector: string) => css.match(new RegExp(`(^|\\n)${selector.replace(/[.[\]=':()]/g, '\\$&')} \\{[^}]*\\}`))?.[0] ?? '';
const RING = 'inset 0 0 0 var(--_stroke-width) var(--_stroke-color)';
const flagged = (root: Record<string, unknown> = BADGE, element?: string) => contract({ ...root, strokesIncludedInLayout: false }, element);

test('without the flag every surface emits the border it always did — byte for byte the same sheet as a contract that never heard of it', () => {
  const plain = contract(BADGE);
  for (const out of [modules(plain).css, shadowCss(plain), inline(plain).tsx]) {
    assert.doesNotMatch(out, /_stroke|strokeRing|box-shadow|boxShadow/, out);
    assert.match(out, /border-style: solid|"borderStyle": "solid"/);
  }
});

test('CSS modules and the web-component sheet draw the stroke as an inset ring: the channels ride private variables, the base rule composes them, and no border is left to take space', () => {
  const c = flagged();
  for (const [css, root, brand] of [[modules(c).css, '.root', '.tone-danger'], [shadowCss(c), "[part='root']", "[part='root']:where([data-tone='danger'])"]] as const) {
    const base = rule(css, root);
    assert.match(base, /--_stroke-width: var\(--stroke-thick\);/, 'a token-bound width stays token-bound');
    assert.ok(base.includes(`box-shadow: ${RING};`), css);
    assert.match(base, /border: 0;/, 'the ordinary no-border reset — a <button> root needs it');
    assert.match(base, /--_stroke-color: currentColor;/, 'the substituted colour lands in per-value rules, so the base rule states the default and cuts inheritance');
    assert.match(rule(css, brand), /--_stroke-color: var\(--paint-danger\);/, css);
    assert.doesNotMatch(css, /border-(width|color|style)\s*:/, 'nothing left that takes layout space, and nothing synthesises a style keyword');
  }
});

test('a real shadow survives after the ring in every state; per-side weights draw one layer per side', () => {
  const lifted = flagged({ ...BADGE, tokens: { ...BADGE.tokens, 'box-shadow': '{lift}' }, literalsByProp: [{ prop: 'tone', map: { danger: { 'box-shadow': 'none' } } }] });
  const css = modules(lifted).css;
  assert.ok(rule(css, '.root').includes(`box-shadow: ${RING}, var(--_stroke-shadow);`), css);
  assert.match(rule(css, '.root'), /--_stroke-shadow: var\(--lift\);/);
  assert.doesNotMatch(rule(css, '.root'), /--_stroke-shadow: 0 0 #0000/, 'a default written after the carried value would erase it');
  assert.match(rule(css, '.tone-danger'), /--_stroke-shadow: 0 0 #0000;/, '`none` is not a list item — the no-op layer keeps the ring valid');

  const { 'border-width': _w, ...rest } = BADGE.tokens;
  const ruled = flagged({ ...BADGE, tokens: rest, literals: { 'border-top-width': '1px', 'border-right-width': '0px', 'border-bottom-width': '2px', 'border-left-width': '0px' } });
  const sides = rule(modules(ruled).css, '.root');
  assert.ok(sides.includes('box-shadow: inset 0 var(--_stroke-top-width) 0 0 var(--_stroke-color), inset 0 calc(-1 * var(--_stroke-bottom-width)) 0 0 var(--_stroke-color), inset var(--_stroke-left-width) 0 0 0 var(--_stroke-color), inset calc(-1 * var(--_stroke-right-width)) 0 0 0 var(--_stroke-color);'), sides);
  assert.match(sides, /--_stroke-bottom-width: 2px;/);
  assert.doesNotMatch(sides, /border-(top|bottom)-style/);
});

test('a nested flagged part states its own variables (custom properties inherit), and an outline-only part is left alone', () => {
  const nested = contract({ ...BADGE, strokesIncludedInLayout: false, parts: { chip: { layout: { display: 'flex' }, strokesIncludedInLayout: false, tokens: { 'border-width': '{stroke.thin}' } } } });
  const chip = rule(modules(nested).css, '.chip');
  assert.match(chip, /--_stroke-width: var\(--stroke-thin\);/);
  assert.match(chip, /--_stroke-color: currentColor;/, "never the root's colour");
  const focus = contract({ layout: { display: 'flex' }, strokesIncludedInLayout: false, tokens: { 'outline-width': '{stroke.thick}', 'outline-color': '{paint.brand}' }, declared: { 'outline-style': 'solid' } });
  assert.doesNotMatch(modules(focus).css, /_stroke|box-shadow/, 'an outline never takes layout space — nothing to redraw');
});

test('the tokens.css gate does not demand the ring\'s private variables of tokens.css — and still names one the sheet never declares', () => {
  const required = referencedCssVars(modules(flagged()).css);
  assert.deepEqual(required.filter((n) => n.startsWith('--_')), [], 'the base rule states them; `generate` refused the whole contract over them');
  assert.ok(required.includes('--stroke-thick') && required.includes('--paint-danger'), 'token references are still held to the rule');
  assert.deepEqual(referencedCssVars('.a { box-shadow: inset 0 0 0 var(--_stroke-width) red; }'), ['--_stroke-width'], 'referenced but never declared is still missing');
});

test('validateContract refuses a stray flag and what a ring cannot spell, by name', () => {
  const errorsOf = (root: Record<string, unknown>) => { const c = contract(root); const errors: string[] = []; validateContract(c, new Map([[c.id, c]]), errors, new Map()); return errors.join('\n'); };
  assert.match(errorsOf({ layout: { display: 'flex' }, strokesIncludedInLayout: false, tokens: { 'background-color': '{paint.ground}' } }), /strokesIncludedInLayout: false but no stroke channel/);
  assert.match(errorsOf({ ...BADGE, strokesIncludedInLayout: false, declared: { 'border-style': 'dashed' } }), /together with border-style/);
  assert.match(errorsOf({ ...BADGE, strokesIncludedInLayout: false, literals: { 'border-top-color': '#ff0000' } }), /together with border-top-color/);
  assert.equal(errorsOf({ ...BADGE, strokesIncludedInLayout: false }), '');
  assert.throws(() => ContractSchema.parse({ ...flagged(), anatomy: { root: { ...BADGE, strokesIncludedInLayout: true } } }), 'only the non-default value is spelled');
});

test('MEASURED in Chromium: the flagged box is the designer\'s 80×16 with a 2px ring, the unflagged one is 20px high; both React surfaces, a real shadow kept', async (t) => {
  const browser = await chromium.launch();
  try {
    for (const surface of ['css-module', 'inline'] as const) for (const flag of [false, true]) await t.test(`${surface} / ${flag ? 'strokesIncludedInLayout: false' : 'border'}`, async () => {
      const root = { ...BADGE, tokens: { ...BADGE.tokens, 'box-shadow': '{lift}' } };
      const c = flag ? flagged(root, 'button') : contract(root, 'button');
      const out = surface === 'inline' ? { ...inline(c), css: '' } : (() => { const o = modules(c); return { ...o, css: rootVars + o.css }; })();
      assert.deepEqual(generatedTypeErrors(c.name, out.tsx), []);
      const page = await browser.newPage();
      try {
        const render = await mountGenerated(page, c.name, out.tsx, out.css);
        const observe = () => page.locator('#root > :first-child').evaluate((el) => {
          const s = getComputedStyle(el); const b = el.getBoundingClientRect();
          return { width: b.width, height: b.height, border: s.borderTopWidth, shadow: s.boxShadow };
        });
        await render({ tone: 'danger' });
        const seen = await observe();
        if (!flag) {
          assert.deepEqual([seen.width, seen.height, seen.border], [80, 20, '2px'], 'the defect: 8+8 padding plus a 2px border cannot fit 16px');
          return;
        }
        assert.deepEqual([seen.width, seen.height, seen.border], [80, 16, '0px']);
        assert.equal(seen.shadow, 'rgb(198, 38, 46) 0px 0px 0px 2px inset, rgba(0, 0, 0, 0.25) 0px 2px 4px 0px', 'the ring first, in the variant colour, then the real shadow');
        await render({ tone: 'brand' });
        assert.match((await observe()).shadow, /^rgb\(14, 97, 186\) 0px 0px 0px 2px inset,/);
      } finally { await page.close(); }
    });
  } finally { await browser.close(); }
});
