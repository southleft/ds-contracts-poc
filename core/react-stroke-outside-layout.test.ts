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
import { lowerStrokeRingForcedColors } from '../packages/core/src/css.js';
import { generatedTypeErrors, mountGenerated } from './react-test-runtime.js';
import { flattenTokens, tokenInventoryFromJson } from './tokens.js';
import { referencedCssVars } from './emit-tokens-css.js';

const tokens = { primitives: {
  paint: { ground: { $type: 'color', $value: '#ffffff' }, brand: { $type: 'color', $value: '#0e61ba' }, danger: { $type: 'color', $value: '#c6262e' } },
  stroke: { thin: { $type: 'dimension', $value: '1px' }, thick: { $type: 'dimension', $value: '2px' } },
  pad: { block: { $type: 'dimension', $value: '8px' }, inline: { $type: 'dimension', $value: '12px' } },
  box: { small: { $type: 'dimension', $value: '16px' }, wide: { $type: 'dimension', $value: '80px' } },
  lift: { $type: 'shadow', $value: '0 2px 4px #00000040' },
  // The corpus shape: a shadow scale whose outlined / flat step is `none` (60+ such tokens in examples/).
  rise: { brand: { $type: 'shadow', $value: '0 2px 4px #00000040' }, danger: { $type: 'shadow', $value: 'none' } },
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
const modules = (c: Contract, values: unknown = tokens) => emitReact(c, { ...ctx(c), tokens: tokenInventoryFromJson([tokens.primitives]), tokenValues: values });
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

// --- adversarial review of PR 128 ------------------------------------------
const FORCED = `@media (forced-colors: active) {
  .root:not(:focus-visible) {
    outline: var(--_stroke-width) solid CanvasText;
    outline-offset: calc(-1 * var(--_stroke-width));
  }
}`;

test('forced colors: every ring part gets an inward outline inside the media query only, on both stylesheet surfaces; per-side strokes take the widest side; a sheet with no ring keeps its bytes', () => {
  const css = modules(flagged()).css;
  assert.ok(css.includes(FORCED), css);
  assert.ok(css.indexOf(FORCED) > css.indexOf('.root {') && css.indexOf(FORCED) < css.indexOf('.tone-brand'), 'directly after the rule it came out of');
  assert.equal(css.match(/outline/g)!.length, 2, 'outline is the focus ring\'s property everywhere else');
  assert.ok(shadowCss(flagged()).includes(`@media (forced-colors: active) {\n  [part='root']:not(:focus-visible) {\n    outline: var(--_stroke-width) solid CanvasText;`));
  const { 'border-width': _w, ...rest } = BADGE.tokens;
  const sides = modules(flagged({ ...BADGE, tokens: rest, literals: { 'border-top-width': '0px', 'border-right-width': '0px', 'border-bottom-width': '2px', 'border-left-width': '0px' } })).css;
  assert.match(sides, /outline: max\(var\(--_stroke-top-width\), var\(--_stroke-right-width\), var\(--_stroke-bottom-width\), var\(--_stroke-left-width\)\) solid CanvasText;/);
  const plain = modules(contract(BADGE)).css;
  assert.equal(lowerStrokeRingForcedColors(plain), plain);
  assert.doesNotMatch(plain, /forced-colors/);
});

test('every ring part resets its own border (a nested <button>/<fieldset> showed the UA border again); a unitless 0 side is a length', () => {
  for (const element of ['button', 'fieldset']) {
    const nested = contract({ layout: { display: 'inline-flex' }, tokens: { 'background-color': '{paint.ground}' },
      parts: { field: { element, layout: { display: 'flex' }, strokesIncludedInLayout: false, tokens: { 'border-width': '{stroke.thin}', 'border-color': '{paint.brand}' } } } });
    for (const [css, sel] of [[modules(nested).css, '.field'], [shadowCss(nested), "[part='field']"]] as const) {
      const field = rule(css, sel);
      assert.match(field, /border: 0;/, css);
      assert.doesNotMatch(field, /border-(width|style|color)\s*:/, 'and no border longhand is left for the reset to fight');
    }
    assert.match(inline(nested).tsx, /style=\{strokeRing\(\{ \.\.\.S\.field \}\)\}/, 'the inline ring always returns border: 0');
  }
  assert.equal(rule(modules(flagged()).css, '.root').match(/border: 0;/g)!.length, 1, 'the single root keeps the emitter\'s own reset, once');
  const { 'border-width': _w, ...rest } = BADGE.tokens;
  const zero = rule(modules(flagged({ ...BADGE, tokens: rest, literals: { 'border-top-width': '0', 'border-right-width': '0', 'border-bottom-width': '2px', 'border-left-width': '0' } })).css, '.root');
  assert.match(zero, /--_stroke-top-width: 0px;/, '`calc(-1 * 0)` is a number, not a length — it voided the whole declaration');
  assert.doesNotMatch(zero, /width: 0;/);
});

test('a shadow TOKEN that resolves to `none` cannot void the ring: settled where values are known; refused by name when the modes disagree or no values are supplied', () => {
  const lifted = flagged({ ...BADGE, tokens: { ...BADGE.tokens, 'box-shadow': '{rise.{tone}}' } });
  for (const [css, brand, danger] of [[modules(lifted).css, '.tone-brand', '.tone-danger'],
    [shadowCss(lifted, tokens), "[part='root']:where([data-tone='brand'])", "[part='root']:where([data-tone='danger'])"]] as const) {
    assert.match(rule(css, brand), /--_stroke-shadow: var\(--rise-brand\);/, css);
    assert.match(rule(css, danger), /--_stroke-shadow: 0 0 #0000;/, css);
  }
  // Only inside the ring's private variable: an unflagged part keeps its bytes.
  assert.match(rule(modules(contract({ ...BADGE, tokens: { ...BADGE.tokens, 'box-shadow': '{rise.{tone}}' } })).css, '.tone-danger'), /box-shadow: var\(--rise-danger\);/);
  // `none` in light, a real shadow in dark: no single spelling.
  const mixed = { ...tokens, dark: { rise: { danger: { $type: 'shadow', $value: '0 1px 2px #000000' } } } };
  assert.throws(() => modules(lifted, mixed), /--rise-danger, which resolves to `none` in one mode and to a shadow in the other/);
  // No values handed over (a bare emitReact): the deciding fact cannot be checked — refused, not guessed.
  assert.throws(() => modules(lifted, null), /binds box-shadow to --rise-brand, --rise-danger, and no token VALUES were supplied/);
  assert.doesNotThrow(() => modules(flagged(), null), 'a ring with no shadow token needs no values');
});

test('MEASURED in Chromium — the review\'s cases: forced colors keeps a boundary and focus still wins; a nested <button> has no UA border; a unitless 0 side and a `none` shadow token keep the ring; the inline consumer\'s style lands ON the ring', async (t) => {
  const browser = await chromium.launch();
  const mount = async (c: Contract, surface: 'css-module' | 'inline', forced = false) => {
    const out = surface === 'inline' ? { ...inline(c), css: '' } : (() => { const o = modules(c); return { ...o, css: rootVars + o.css }; })();
    assert.deepEqual(generatedTypeErrors(c.name, out.tsx), []);
    const page = await browser.newPage();
    if (forced) await page.emulateMedia({ forcedColors: 'active' });
    return { page, render: await mountGenerated(page, c.name, out.tsx, out.css) };
  };
  const seen = (page: import('playwright-core').Page, selector = '#root > :first-child') => page.locator(selector).evaluate((el) => {
    const s = getComputedStyle(el); const b = el.getBoundingClientRect();
    return { width: b.width, height: b.height, border: `${s.borderTopWidth} ${s.borderTopStyle}`, shadow: s.boxShadow, outline: `${s.outlineWidth} ${s.outlineStyle} ${s.outlineOffset}` };
  });
  try {
    await t.test('forced colors', async () => {
      const { page, render } = await mount(flagged(BADGE, 'button'), 'css-module', true);
      await render({ tone: 'brand' });
      const rest = await seen(page);
      assert.equal(rest.shadow, 'none', 'the mode erases the ring — this is the defect');
      assert.deepEqual([rest.width, rest.height, rest.outline], [80, 16, '2px solid -2px'], 'a boundary again, and still no layout space');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'BUTTON');
      const focused = await seen(page);
      assert.notEqual(focused.outline, rest.outline, 'focused: the fallback stands down');
      assert.doesNotMatch(focused.outline, /-2px$/, 'and the focus ring is drawn where a focus ring is drawn');
      await page.close();
      const normal = await mount(flagged(BADGE, 'button'), 'css-module');
      await normal.render({ tone: 'brand' });
      assert.match((await seen(normal.page)).outline, /none/, 'outside the mode the outline stays the focus ring\'s');
      await normal.page.close();
    });
    await t.test('nested native elements', async () => {
      for (const element of ['button', 'fieldset']) for (const surface of ['css-module', 'inline'] as const) {
        const nested = contract({ layout: { display: 'inline-flex' }, tokens: { 'background-color': '{paint.ground}' },
          parts: { field: { element, layout: { display: 'flex' }, strokesIncludedInLayout: false, tokens: { 'border-width': '{stroke.thin}', 'border-color': '{paint.brand}', height: '{box.small}', width: '{box.wide}' } } } });
        const { page } = await mount(nested, surface);
        const field = await seen(page, '#root > :first-child > :first-child');
        assert.deepEqual([field.width, field.height, field.border, field.shadow], [80, 16, '0px none', 'rgb(14, 97, 186) 0px 0px 0px 1px inset'], `${element} / ${surface}`);
        await page.close();
      }
    });
    await t.test('unitless 0 side / none shadow token', async () => {
      const { 'border-width': _w, ...rest } = BADGE.tokens;
      for (const surface of ['css-module', 'inline'] as const) {
        const zero = await mount(flagged({ ...BADGE, tokens: rest, literals: { 'border-top-width': '0', 'border-right-width': '0', 'border-bottom-width': '2px', 'border-left-width': '0' } }), surface);
        await zero.render({ tone: 'brand' });
        assert.match((await seen(zero.page)).shadow, /rgb\(14, 97, 186\) 0px -2px 0px 0px inset/, surface);
        await zero.page.close();
        const lifted = await mount(flagged({ ...BADGE, tokens: { ...BADGE.tokens, 'box-shadow': '{rise.{tone}}' } }), surface);
        await lifted.render({ tone: 'danger' });
        assert.match((await seen(lifted.page)).shadow, /^rgb\(198, 38, 46\) 0px 0px 0px 2px inset/, `${surface}: the stroke survives a shadow token that is none`);
        await lifted.render({ tone: 'brand' });
        assert.equal((await seen(lifted.page)).shadow, 'rgb(14, 97, 186) 0px 0px 0px 2px inset, rgba(0, 0, 0, 0.25) 0px 2px 4px 0px', surface);
        await lifted.page.close();
      }
    });
    await t.test('inline consumer style', async () => {
      const { page, render } = await mount(flagged(), 'inline');
      await render({ tone: 'brand', style: { boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)' } });
      assert.equal((await seen(page)).shadow, 'rgb(14, 97, 186) 0px 0px 0px 2px inset, rgba(0, 0, 0, 0.2) 0px 1px 2px 0px', 'the ring first, the caller\'s shadow after — it used to delete the stroke');
      await render({ tone: 'brand', style: { borderColor: 'rgb(255, 0, 255)', borderWidth: 3 } });
      const restyled = await seen(page);
      assert.deepEqual([restyled.shadow, restyled.height], ['rgb(255, 0, 255) 0px 0px 0px 3px inset', 16], 'the same contract channels, read as such — and still no layout space');
      await page.close();
    });
  } finally { await browser.close(); }
});

test('the tokens.css gate exempts only a private variable the sheet DECLARES — not a comment, a longer name, or a bare value', () => {
  assert.deepEqual(referencedCssVars('/* --_gap: 1px */\n.b { gap: var(--_gap); }'), ['--_gap']);
  assert.deepEqual(referencedCssVars('.a { --_stroke-width-x: 1px; width: var(--_stroke-width); }'), ['--_stroke-width']);
  assert.deepEqual(referencedCssVars('var(--_brand)'), ['--_brand'], 'core/css-vars-check.ts passes token VALUES through here; they declare nothing');
  assert.deepEqual(referencedCssVars('.a {\n  --_x: 1px;\n  width: var(--_x);\n}'), []);
  assert.deepEqual(referencedCssVars('.a { color: var(--paint-brand); }'), ['--paint-brand']);
});
