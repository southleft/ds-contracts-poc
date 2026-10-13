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

for(const reversePaint of [undefined,false,true])test('container stroke paints above translucent children without changing layout: '+reversePaint, async t => {
 const {chromium}=await import('playwright-core'),{PNG}=await import('pngjs'),{mountGenerated}=await import('./react-test-runtime.js');
 const c=flagged({layout:{display:'flex',...(reversePaint===undefined?{}:{reversePaint,childOrder:['layer']})},literals:{width:'40px',height:'20px','background-color':'#ffffff','border-width':'2px','border-color':'#ff0000','border-radius':'6px'},parts:{layer:{declared:{position:'absolute'},literals:{left:'0px',top:'0px',right:'0px',bottom:'0px','border-radius':'6px','background-color':'#0000ff80'}}}});
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
 for(const output of [modules(c),{...inline(c),css:''}]){
  const page=await browser.newPage({viewport:{width:40,height:20}});try{
   const render=await mountGenerated(page,c.name,output.tsx,output.css);await page.addStyleTag({content:'body{margin:0}'});await render({});
   const png=PNG.sync.read(await page.screenshot({omitBackground:true})),pixel=(x:number,y:number)=>[...png.data.subarray((y*png.width+x)*4,(y*png.width+x)*4+4)];
   assert.deepEqual(pixel(1,10),[255,0,0,255],'child paint must not recolor the native foreground stroke');
   assert.deepEqual(pixel(20,10),[127,127,255,255],'foreground stroke must preserve captured child paint');
   const root=await page.locator('#root > *').first().boundingBox();assert.equal(root?.width,40);assert.equal(root?.height,20);
  }finally{await page.close();}
 }
});

test('foreground stroke preserves an authored absolute position and per-side source widths', async t=>{
 const {chromium}=await import('playwright-core'),{PNG}=await import('pngjs'),{mountGenerated}=await import('./react-test-runtime.js');
 const c=flagged({layout:{display:'flex'},declared:{position:'absolute'},literals:{left:'3px',top:'4px',width:'40px',height:'20px','border-top-width':'1px','border-right-width':'2px','border-bottom-width':'3px','border-left-width':'4px','border-color':'#ff0000'},parts:{layer:{declared:{position:'absolute'},literals:{left:'0px',top:'0px',right:'0px',bottom:'0px','background-color':'#0000ff80'}}}});
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
 for(const output of [modules(c),{...inline(c),css:''}]){
  const page=await browser.newPage({viewport:{width:50,height:30}});try{
   const render=await mountGenerated(page,c.name,output.tsx,output.css);await page.addStyleTag({content:'body{margin:0}'});await render({});const png=PNG.sync.read(await page.screenshot({omitBackground:true})),pixel=(x:number,y:number)=>[...png.data.subarray((y*png.width+x)*4,(y*png.width+x)*4+4)];
   assert.deepEqual(pixel(5,14),[255,0,0,255]);assert.deepEqual(pixel(41,14),[255,0,0,255]);assert.deepEqual(pixel(20,4),[255,0,0,255]);assert.deepEqual(pixel(20,22),[255,0,0,255]);
   const root=await page.locator('#root > *').first().boundingBox();assert.deepEqual(root,{x:3,y:4,width:40,height:20});
  }finally{await page.close();}
 }
});


test('declared focus shadows replace the synthetic outline while forced colors and explicit outlines remain visible',async()=>{
 const browser=await chromium.launch();
 try{for(const explicit of ['none','state','variant']){
 for(const ring of [false,true]){
   const c=contract({strokesIncludedInLayout:ring?false:undefined,literals:{width:'32px',height:'32px','border-width':'1px','border-color':'#777777'},states:{'focus-visible':{'box-shadow':'{lift}',...(explicit==='state'?{'outline-color':'{paint.brand}'}:{})}},...(explicit==='variant'?{tokensByProp:[{prop:'tone',map:{brand:{'outline-color':'{paint.brand}'},danger:{'outline-color':'{paint.danger}'}}}]}:{})},'button');
   c.states=['focus-visible'];const out=modules(c),page=await browser.newPage();
   try{const render=await mountGenerated(page,c.name,out.tsx,out.css);await render({});await page.addStyleTag({content:rootVars});await page.keyboard.press('Tab');
     const read=()=>page.locator('#root>button').evaluate(el=>({focused:el.matches(':focus-visible'),outline:getComputedStyle(el).outlineStyle,shadow:getComputedStyle(el).boxShadow}));
     const normal=await read();assert.equal(normal.focused,true);assert.equal(normal.outline,explicit==='none'?'none':'solid');assert.notEqual(normal.shadow,'none');
     await page.emulateMedia({forcedColors:'active'});const forced=await read();assert.equal(forced.focused,true);assert.equal(forced.outline,'solid');
   }finally{await page.close();}
 }}}finally{await browser.close();}
});

test('an authored focus stroke replaces the extra outline but preserves keyboard and forced-color indicators', async () => {
 const browser=await chromium.launch();
 try { for (const indicator of ['changed','unchanged','explicit']) {
  const c=contract({strokesIncludedInLayout:false,literals:{width:'68px',height:'32px','border-color':'#0a0a0a'},tokens:{'border-width':'{stroke.thin}'},states:{'focus-visible':{'border-width':indicator==='unchanged'?'{stroke.thin}':'{stroke.thick}',...(indicator==='explicit'?{'outline-color':'{paint.brand}'}:{})}}},'button');
  c.states=['focus-visible'];const out=modules(c);const page=await browser.newPage();
  try {const render=await mountGenerated(page,c.name,out.tsx,out.css);await page.addStyleTag({content:rootVars});await render({});await page.keyboard.press('Tab');
   const read=()=>page.locator('#root>button').evaluate(el=>{const s=getComputedStyle(el),b=el.getBoundingClientRect();return {focus:el.matches(':focus-visible'),outline:s.outlineStyle,stroke:s.getPropertyValue('--_stroke-width').trim(),width:b.width,height:b.height};});
   const normal=await read();assert.equal(normal.focus,true);assert.equal(normal.outline,indicator==='changed'?'none':'solid');assert.equal(normal.stroke,indicator==='unchanged'?'1px':'2px');assert.deepEqual([normal.width,normal.height],[68,32]);
   await page.emulateMedia({forcedColors:'active'});assert.equal((await read()).outline,'solid');
  }finally{await page.close();}
 }}finally{await browser.close();}
});


// Explicit OUTSIDE is independent of the older no-layout INSIDE ring.
const outsideBox = (sides = [1, 2, 3, 4], extra: Record<string, unknown> = {}) => ({
  layout: { display: 'flex' }, strokesIncludedInLayout: false, strokeAlign: 'OUTSIDE',
  literals: { width: '40px', height: '20px', 'border-color': '#ff000080',
    ...Object.fromEntries(['top', 'right', 'bottom', 'left'].map((side, i) => [`border-${side}-width`, `${sides[i]}px`])) },
  ...extra,
});

test('explicit square OUTSIDE uses one exterior border on both sheets and the inline overlay; inside and absent carriers stay on their old paths', () => {
  const c = contract(outsideBox());
  for (const [css, selector] of [[modules(c).css, '.root'], [shadowCss(c), "[part='root']"]] as const) {
    const overlay = rule(css, selector + '::after');
    assert.match(overlay, /top: calc\(-1 \* var\(--_stroke-top-width\)\);/);
    assert.match(overlay, /left: calc\(-1 \* var\(--_stroke-left-width\)\);/);
    assert.match(overlay, /border-width: var\(--_stroke-top-width\) var\(--_stroke-right-width\) var\(--_stroke-bottom-width\) var\(--_stroke-left-width\);/);
    assert.match(overlay, /box-sizing: border-box;/);
    assert.match(overlay, /pointer-events: none;/);
    assert.doesNotMatch(css, /box-shadow: inset|outline-offset: calc\(-1 \*/);
  }
  const tsx = inline(c).tsx;
  assert.match(tsx, /const outsideStrokeOverlay/);
  assert.match(tsx, /outsideStrokeOverlay\(\{ \.\.\.S\.root/);
  assert.deepEqual(generatedTypeErrors(c.name, tsx), []);
  const inside = contract({ ...outsideBox(), strokeAlign: undefined });
  for (const css of [modules(inside).css, shadowCss(inside)]) {
    assert.match(css, /box-shadow: inset/);
    assert.doesNotMatch(css, /top: calc\(-1 \* var\(--_stroke-top-width\)/);
  }
  assert.doesNotMatch(inline(inside).tsx, /outsideStrokeOverlay/);
  const shadowed = contract(outsideBox([0, 0, 0, 4], {tokens: {'box-shadow': '{lift}'}}));
  assert.match(modules(shadowed).css, /box-shadow: var\(--_stroke-shadow\)/);
  assert.match(modules(shadowed).css, /--_stroke-shadow: var\(--lift\)/);
});

test('explicit OUTSIDE refuses clipping, rounded or backdrop-dependent ownership rather than changing those boxes', () => {
  for (const override of [
    {strokesIncludedInLayout: undefined}, {strokeAlign: 'CENTER'},
    {literals: {...outsideBox().literals, 'border-radius': '2px'}},
    {declared: {overflow: 'hidden'}}, {declared: {position: 'absolute'}},
    {parts: {child: {layout: {display: 'flex'}, declared: {'mix-blend-mode': 'multiply'}}}},
    {parts: {child: {component: {id: 'probe.dep'}}}},
  ]) {
    assert.throws(() => contract({...outsideBox(), ...override}), /outside-stroke|Invalid input/, JSON.stringify(override));
  }
  const c = contract(outsideBox(), 'input'), errors: string[] = [];
  validateContract(c, new Map([[c.id, c]]), errors, new Map());
  assert.ok(errors.some(error => /outside-stroke-void-element/.test(error)), errors.join('\n'));
});

test('MEASURED in Chromium: OUTSIDE left-only, asymmetric and zero sides retain the box, sibling flow and one alpha layer at corners', async t => {
  const {PNG} = await import('pngjs');
  const browser = await chromium.launch();
  t.after(() => browser.close());
  for (const sides of [[0, 0, 0, 4], [1, 2, 3, 4], [0, 0, 0, 0]]) {
    const c = contract(outsideBox(sides, {parts: {paint: {declared: {position: 'absolute'},
      literals: {top: '0px', right: '0px', bottom: '0px', left: '0px', 'background-color': '#0000ff'}}}}));
    for (const surface of ['css-module', 'inline'] as const) await t.test(`${surface} / ${sides.join(',')}`, async () => {
      const output = surface === 'inline' ? {...inline(c), css: ''} : modules(c);
      assert.deepEqual(generatedTypeErrors(c.name, output.tsx), []);
      const page = await browser.newPage({viewport: {width: 90, height: 55}});
      try {
        await mountGenerated(page, c.name, output.tsx, output.css);
        await page.addStyleTag({content: 'body{margin:0;background:white}#root{padding:12px;display:flex;align-items:flex-start;gap:9px}'});
        await page.evaluate(() => {
          const sibling = document.createElement('div'); sibling.id = 'sibling';
          Object.assign(sibling.style, {width: '7px', height: '7px', flexShrink: '0'});
          document.querySelector('#root')!.appendChild(sibling);
        });
        assert.deepEqual(await page.locator('#root > :first-child').boundingBox(), {x:12,y:12,width:40,height:20});
        assert.equal((await page.locator('#sibling').boundingBox())!.x, 61);
        const png = PNG.sync.read(await page.screenshot());
        const pixel = (x: number, y: number) => [...png.data.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 4)];
        const red = [255,127,127,255], white = [255,255,255,255];
        assert.deepEqual(pixel(10,22), sides[3] ? red : white);
        assert.deepEqual(pixel(53,22), sides[1] ? red : white);
        assert.deepEqual(pixel(32,11), sides[0] ? red : white);
        assert.deepEqual(pixel(32,33), sides[2] ? red : white);
        assert.deepEqual(pixel(10,11), sides[0] && sides[3] ? red : white, 'one border corner, never two alpha layers');
        assert.deepEqual(pixel(12,12), [0,0,255,255], 'the inside edge stays clear of the outside stroke');
        const pointer = await page.locator('#root > :first-child').evaluate((el, surface) =>
          getComputedStyle(surface === 'inline' ? el.lastElementChild! : el, surface === 'inline' ? undefined : '::after').pointerEvents, surface);
        assert.equal(pointer, 'none');
      } finally { await page.close(); }
    });
  }
});


test('native compilation retains the explicit OUTSIDE sides and original dimensions, including zero and transparent boxes', async () => {
  const {createFigmaEngine} = await import('./emit-figma-script.js');
  const engine = createFigmaEngine({tokens, icons: new Map()});
  for (const sides of [[0,0,0,4], [1,2,3,4], [0,0,0,0]]) {
    const c = contract(outsideBox(sides));
    const data = engine.compileComponentData(c, new Map([[c.id,c]]));
    for (const {spec} of data.variants) {
      assert.equal(spec.strokeOutside, true);
      assert.equal(spec.strokesIncludedInLayout, false);
      assert.deepEqual(spec.lits?.strokeSides, Object.fromEntries(['top','right','bottom','left'].map((side,i) => [side,sides[i]])));
      assert.equal(spec.lits?.width, 40);
      assert.equal(spec.lits?.height, 20);
      assert.equal(spec.lits?.fillColor, undefined, 'a transparent source is not collapsed into a filled stroke bar');
    }
  }
});


test('native sparse OUTSIDE literals initialize every omitted side from uniform width or zero', async () => {
  const {createFigmaEngine} = await import('./emit-figma-script.js');
  const engine = createFigmaEngine({tokens, icons: new Map()});
  for (const uniform of [undefined, '2px']) {
    const c = contract(outsideBox(undefined, {literals: {
      width: '40px', height: '20px', 'border-color': '#ff000080',
      ...(uniform === undefined ? {} : {'border-width': uniform}), 'border-left-width': '4px',
    }}));
    for (const {spec} of engine.compileComponentData(c, new Map([[c.id,c]])).variants) {
      assert.equal(spec.strokeOutside, true);
      assert.deepEqual(spec.lits?.strokeSides, {top: uniform ? 2 : 0, right: uniform ? 2 : 0, bottom: uniform ? 2 : 0, left: 4});
      assert.equal(spec.lits?.strokeWeight, undefined, 'no uniform tail write can overwrite an explicit side');
    }
  }
});

test('native sparse OUTSIDE keeps side bindings and resolves uniform fallback independently for every variant', async () => {
  const {createFigmaEngine} = await import('./emit-figma-script.js');
  const engine = createFigmaEngine({tokens, icons: new Map()});
  const root = outsideBox(undefined, {
    literals: {width: '40px', height: '20px', 'border-color': '#ff000080'},
    literalsByProp: [{prop: 'tone', map: {brand: {'border-left-width': '4px'}, danger: {'border-left-width': '6px'}}}],
  });
  const c = contract(root);
  for (const {name,spec} of engine.compileComponentData(c, new Map([[c.id,c]])).variants) {
    const left = name.includes('Tone=Brand') ? 4 : 6;
    assert.equal(spec.bindings?.strokeWeight, undefined);
    assert.deepEqual(spec.lits?.strokeSides, {top: 0, right: 0, bottom: 0, left}, name);
  }
  const bound = contract(outsideBox(undefined, {
    literals: {width: '40px', height: '20px', 'border-color': '#ff000080'},
    tokens: {'border-width': '{stroke.thin}', 'border-left-width': '{stroke.thick}'},
  }));
  for (const {spec} of engine.compileComponentData(bound, new Map([[bound.id,bound]])).variants) {
    assert.equal(spec.bindings?.strokeLeftWeight, 'stroke/thick');
    for (const side of ['Top','Right','Bottom']) assert.equal(spec.bindings?.[`stroke${side}Weight`], 'stroke/thin');
    assert.deepEqual(spec.lits?.strokeSides, {});
    assert.equal(spec.lits?.strokeWeight, undefined, 'uniform writes must not reset the bound left side');
  }
});

test('native sparse OUTSIDE applies final root state side widths without overwriting state bindings', async () => {
  const {createFigmaEngine} = await import('./emit-figma-script.js');
  const engine = createFigmaEngine({tokens, icons: new Map()});
  const literals = {width: '40px', height: '20px', 'border-color': '#ff000080', 'border-left-width': '4px'};
  for (const state of [{'border-left-width': '{stroke.thick}'}]) {
    const c = contract(outsideBox(undefined, {literals, states: {hover: state}}), 'button');
    c.bindings.figma.statePreviews = true;
    const data = engine.compileComponentData(c, new Map([[c.id,c]]));
    for (const {spec} of data.variants) assert.deepEqual(spec.lits?.strokeSides, {top: 0, right: 0, bottom: 0, left: 4});
    assert.ok(data.stateVariants?.length, 'actual hover previews are required');
    for (const {spec} of data.stateVariants!) {
      assert.equal(spec.bindings?.strokeLeftWeight, 'stroke/thick');
      assert.equal(spec.lits?.strokeSides?.left, undefined, 'a base literal cannot overwrite the state binding');
      assert.equal(spec.bindings?.strokeWeight, undefined);
      for (const side of ['top','right','bottom'] as const) assert.equal(spec.lits?.strokeSides?.[side], 0);
    }
  }
});


test('explicit OUTSIDE refuses mixed width precedence while the legacy projection remains accepted', () => {
  const base = {width: '40px', height: '20px', 'border-color': '#ff000080'};
  for (const override of [
    {literals: {...base, 'border-left-width': '4px'}, tokensByProp: [{prop: 'tone', map: {brand: {'border-width': '{stroke.thin}'}, danger: {'border-width': '{stroke.thick}'}}}]},
    {literals: {...base, 'border-width': '1px'}, tokens: {'border-left-width': '{stroke.thick}'}},
    {literals: {...base, 'border-left-width': '4px', 'border-width': '2px'}},
    {literals: {...base, 'border-left-width': '4px'}, states: {hover: {'border-width': '{stroke.thick}'}}},
  ]) {
    const root = outsideBox(undefined, override);
    assert.throws(() => contract(root, 'button'), /outside-stroke-width-precedence/);
    const {strokeAlign: _alignment, ...legacy} = root;
    assert.doesNotThrow(() => contract(legacy, 'button'), 'withdrawing only the new flag preserves the prior accepted projection');
  }
});


test('OUTSIDE refuses a variant literal over a resting token without changing the legacy projection', () => {
  const root = outsideBox(undefined, {
    literals: {width: '40px', height: '20px', 'border-color': '#ff000080'},
    tokens: {'border-left-width': '{stroke.thin}'},
    literalsByProp: [{prop: 'tone', map: {danger: {'border-left-width': '6px'}}}],
  });
  assert.throws(() => contract(root), /outside-stroke-width-precedence/);
  const {strokeAlign: _alignment, ...legacy} = root;
  const c = contract(legacy);
  const errors: string[] = [];
  validateContract(c, new Map([[c.id, c]]), errors, new Map());
  assert.deepEqual(errors, [], 'the old input remains valid; only the new carrier is refused');
  assert.deepEqual(c.anatomy.root.tokens, {'border-left-width': '{stroke.thin}'});
  assert.deepEqual(c.anatomy.root.literalsByProp, [{prop: 'tone', map: {danger: {'border-left-width': '6px'}}}]);
  assert.match(rule(modules(c).css, '.tone-danger'), /--_stroke-left-width: 6px;/);
});

test('OUTSIDE keeps base-literal to variant-token precedence and the later state-token override', async () => {
  const {createFigmaEngine} = await import('./emit-figma-script.js');
  const c = contract(outsideBox(undefined, {
    literals: {width: '40px', height: '20px', 'border-color': '#ff000080', 'border-left-width': '4px'},
    tokensByProp: [{prop: 'tone', map: {danger: {'border-left-width': '{stroke.thick}'}}}],
    states: {hover: {'border-left-width': '{stroke.thin}'}},
  }), 'button');
  c.bindings.figma.statePreviews = true;
  const engine = createFigmaEngine({tokens, icons: new Map()});
  const data = engine.compileComponentData(c, new Map([[c.id, c]]));
  assert.equal(data.variants.length, 2);
  for (const {name, spec} of data.variants) {
    const changed = name.includes('Tone=Danger');
    assert.equal(spec.bindings?.strokeLeftWeight, changed ? 'stroke/thick' : undefined);
    assert.equal(spec.lits?.strokeSides?.left, changed ? undefined : 4);
    for (const side of ['top', 'right', 'bottom'] as const) assert.equal(spec.lits?.strokeSides?.[side], 0);
  }
  assert.equal(data.stateVariants?.length, 2);
  for (const {spec} of data.stateVariants!) {
    assert.equal(spec.bindings?.strokeLeftWeight, 'stroke/thin', 'the final state overrides either resting value');
    assert.equal(spec.lits?.strokeSides?.left, undefined);
    assert.equal(spec.bindings?.strokeWeight, undefined);
  }
});
