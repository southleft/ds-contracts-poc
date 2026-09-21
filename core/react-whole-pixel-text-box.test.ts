// `Part.textAutoResize: 'WIDTH_AND_HEIGHT'` on the three code surfaces (dump v1.36).
// A Figma text box that sizes itself to its text is a WHOLE number of pixels wide
// (the advance rounded up, with no letter spacing after the last glyph); the
// browser lays the same run out at its fractional advance and adds tracking after
// every glyph. Measured by the design-led consumer check on the 72-variant CBDS
// Badge: 26 of the 48 × 16 px small variants missed the 5 % limit with every
// content size equal (a 47.40625 px root against Figma's 48). The emitters give
// the text element the same box —
//   inline-size: calc-size(fit-content, round(up, size[ - <letter-spacing>], 1px));
//   max-inline-size: 100%;            (unless the part carries its own max)
//   align-self: flex-start;           (only under a stretching flex column)
// — a progressive enhancement, and these tests MEASURE the box in Chromium rather
// than read the stylesheet's intent. Review (PR 132): the first cut used
// max-content, which made a runtime string non-wrapping (the flowbite Card grew to
// 596 px in a 240 px container); the wrap tests below are that finding, pinned.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import { emitReact, nativeTextRenderingRoots, nativeTextRenderingLeafParts, validateContract } from './emit-react.js';
import { emitReactInline } from './emit-react-inline.js';
import { shadowCss } from '../packages/emitter-web-components/src/emit-wc.js';
import { generatedTypeErrors, mountGenerated } from './react-test-runtime.js';
import { tokenInventoryFromJson } from './tokens.js';

const tokens = { primitives: {
  paint: { ground: { $type: 'color', $value: '#0e61ba' }, ink: { $type: 'color', $value: '#fcfeff' } },
  track: { wide: { $type: 'dimension', $value: '1px' }, pct: { $type: 'dimension', $value: '-0.5%' }, zero: { $type: 'dimension', $value: '0' }, flat: { $type: 'dimension', $value: '0px' } },
}, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
const TONE = { name: 'tone', type: { enum: ['brand', 'danger'] }, default: 'brand', bindings: { code: { prop: 'tone' }, figma: { kind: 'VARIANT', property: 'Tone', values: { brand: 'Brand', danger: 'Danger' } } } };
const TEXT = { name: 'label', type: 'text', default: 'Label', bindings: { code: { prop: 'label' }, figma: { kind: 'TEXT', property: 'Label' } } };
/** The Badge's shape: a hug root with 8px inline padding around one text part. */
const LABEL = { content: { prop: 'label' }, tokens: { color: '{paint.ink}' }, literals: { 'font-size': '14px', 'line-height': '16px' } };
const ROOT = { layout: { display: 'inline-flex', direction: 'row', align: 'center', justify: 'center' }, tokens: { 'background-color': '{paint.ground}' }, literals: { 'padding-inline': '8px', 'padding-block': '0px', width: 'fit-content' } };
/** A fixed-width COLUMN with no cross-axis alignment — the Card's label wrapper. */
const COLUMN = (width: string) => ({ layout: { display: 'flex', direction: 'column' }, literals: { width } });
function contract(label: Record<string, unknown>, root: Record<string, unknown> = ROOT): Contract {
  return ContractSchema.parse({
    id: 'probe.text-box', name: 'TextBoxProbe', version: '1.0.0', archetype: 'none',
    description: 'Whole-pixel text-box conformance, not a qualified source component.',
    semantics: { element: 'div' }, props: [TONE, TEXT], states: [],
    anatomy: { root: { ...root, parts: { caption: label } } },
    bindings: { code: { anchors: { importPath: './TextBoxProbe', export: 'TextBoxProbe' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
}
const ctx = (c: Contract) => ({ contracts: new Map([[c.id, c]]), icons: new Map<string, string>() });
const modules = (c: Contract, values: unknown = tokens) => emitReact(c, { ...ctx(c), tokens: tokenInventoryFromJson([tokens.primitives]), tokenValues: values });
const inline = (c: Contract) => emitReactInline(c, { ...ctx(c), tokens } as never);
const rule = (css: string, selector: string) => css.match(new RegExp(`(^|\\n)${selector.replace(/[.[\]=':()]/g, '\\$&')} \\{[^}]*\\}`))?.[0] ?? '';
const flagged = (extra: Record<string, unknown> = {}, root?: Record<string, unknown>) => contract({ ...LABEL, ...extra, textAutoResize: 'WIDTH_AND_HEIGHT' }, root);
const VALUE = 'calc-size(fit-content, round(up, size, 1px))';
const TRIMMED = 'calc-size(fit-content, round(up, size - 1px, 1px))';
const errorsOf = (c: Contract) => { const errors: string[] = []; validateContract(c, new Map([[c.id, c]]), errors, new Map()); return errors.join('\n'); };

test('without the flag every surface emits what it always did — no calc-size, no inline-size, no clamp, byte for byte the sheet of a contract that never heard of it', () => {
  for (const plain of [contract(LABEL), contract(LABEL, COLUMN('200px'))]) {
    for (const out of [modules(plain).css, shadowCss(plain), inline(plain).tsx]) assert.doesNotMatch(out, /calc-size|inline-size|inlineSize|align-self|alignSelf|textAutoResize/, out);
  }
});

test('CSS modules, the web-component sheet and the inline style give the flagged text part its whole-pixel FIT-CONTENT box and the container clamp, and nothing else moves', () => {
  const c = flagged();
  assert.match(rule(modules(c).css, '.caption'), /\n  inline-size: calc-size\(fit-content, round\(up, size, 1px\)\);\n  max-inline-size: 100%;\n\}/);
  assert.match(rule(shadowCss(c), "[part='caption']"), /\n  inline-size: calc-size\(fit-content, round\(up, size, 1px\)\);\n  max-inline-size: 100%;\n/);
  assert.ok(inline(c).tsx.includes(`"inlineSize": "${VALUE}"`) && inline(c).tsx.includes('"maxInlineSize": "100%"'), inline(c).tsx);
  assert.doesNotMatch(modules(c).css + shadowCss(c) + inline(c).tsx, /max-content/, 'never max-content: a runtime string must still wrap');
  // The inherited native-text rendering default changes paint policy only.
  const withoutRendering = (css: string) => css.replace('  text-rendering: geometricPrecision;\n', '');
  const plain = contract(LABEL);
  assert.equal(withoutRendering(rule(modules(c).css, '.root')), rule(modules(plain).css, '.root'));
  assert.equal(withoutRendering(rule(shadowCss(c), "[part='root']")), rule(shadowCss(plain), "[part='root']"));
  assert.equal(withoutRendering(modules(c).css).replace(`  inline-size: ${VALUE};\n  max-inline-size: 100%;\n`, ''), modules(plain).css, 'only two sizing declarations and the inherited paint default differ');
});

test('the clamp yields to the author: a part carrying its own max-width keeps it and gets no max-inline-size (the same property, same rule — ours would win)', () => {
  const capped = flagged({ declared: { 'max-width': '60px' } });
  const css = rule(modules(capped).css, '.caption');
  assert.match(css, /max-width: 60px;/);
  assert.doesNotMatch(css, /max-inline-size/);
  assert.doesNotMatch(inline(capped).tsx, /maxInlineSize/);
});

test('align-self: flex-start (an AGENT decision, docs/23 §D.42) — only under a flex column that would STRETCH the box; never under a row, an aligned column, a per-variant layout or an absolutely placed part', () => {
  const inColumn = flagged({}, COLUMN('200px'));
  assert.match(rule(modules(inColumn).css, '.caption'), /\n  align-self: flex-start;\n/);
  assert.match(rule(shadowCss(inColumn), "[part='caption']"), /\n  align-self: flex-start;\n/);
  assert.ok(inline(inColumn).tsx.includes('"alignSelf": "flex-start"'));
  assert.match(rule(modules(flagged({}, { ...COLUMN('200px'), layout: { display: 'flex', direction: 'column', align: 'stretch' } })).css, '.caption'), /align-self: flex-start;/, 'an explicit stretch is the same stretch');
  for (const [why, root] of [
    ['a row', ROOT],
    ['a column aligned center', { ...COLUMN('200px'), layout: { display: 'flex', direction: 'column', align: 'center' } }],
    ['a column whose layout varies by variant', { ...COLUMN('200px'), layoutByProp: { prop: 'tone', map: { danger: { align: 'center' } } } }],
  ] as const) assert.doesNotMatch(modules(flagged({}, root as never)).css, /align-self/, why);
  assert.doesNotMatch(modules(flagged({ declared: { position: 'absolute' } }, COLUMN('200px'))).css, /align-self/, 'an absolutely placed part is not a flex item');
});

test('the letter spacing CSS adds after the LAST glyph — which Figma\'s box does not have — is shed before rounding: only a px / em / rem length; a token by its var() on the sheets and its value inline', () => {
  const literal = flagged({ literals: { ...LABEL.literals, 'letter-spacing': '1px' } });
  assert.ok(rule(modules(literal).css, '.caption').includes(`inline-size: ${TRIMMED};`), modules(literal).css);
  assert.ok(rule(shadowCss(literal), "[part='caption']").includes(`inline-size: ${TRIMMED};`));
  assert.ok(inline(literal).tsx.includes(`"inlineSize": "${TRIMMED}"`));
  const em = flagged({ literals: { ...LABEL.literals, 'letter-spacing': '0.05em' } });
  assert.ok(rule(modules(em).css, '.caption').includes('inline-size: calc-size(fit-content, round(up, size - 0.05em, 1px));'));
  const token = flagged({ tokens: { ...LABEL.tokens, 'letter-spacing': '{track.wide}' } });
  assert.ok(rule(modules(token).css, '.caption').includes('inline-size: calc-size(fit-content, round(up, size - var(--track-wide), 1px));'), modules(token).css);
  assert.ok(inline(token).tsx.includes(`"inlineSize": "${TRIMMED}"`), 'the inline surface resolves the token to its literal');
  assert.ok(rule(modules(flagged({ tokens: { ...LABEL.tokens, 'letter-spacing': '{track.flat}' } })).css, '.caption').includes('size - var(--track-flat)'), '`0px` is a length and subtracts nothing');
  // A zero literal adds nothing after the last glyph: nothing to shed.
  for (const zero of ['0', '0px']) assert.ok(rule(modules(flagged({ literals: { ...LABEL.literals, 'letter-spacing': zero } })).css, '.caption').includes(`inline-size: ${VALUE};`));
});

test('a letter-spacing TOKEN is judged by its VALUE: a % or a unitless value is refused by name on every surface, and so is a token with no values to judge (review M3)', () => {
  for (const [ref, shows] of [['{track.pct}', /resolves to -0\.5%/], ['{track.zero}', /resolves to 0 —/]] as const) {
    const c = flagged({ tokens: { ...LABEL.tokens, 'letter-spacing': ref } });
    assert.equal(errorsOf(c), '', 'the path alone cannot decide — the refusal is the emitter\'s, which holds the values');
    assert.throws(() => modules(c), shows);
    assert.throws(() => inline(c), shows);
  }
  const token = flagged({ tokens: { ...LABEL.tokens, 'letter-spacing': '{track.wide}' } });
  assert.throws(() => modules(token, null), /no token VALUES were supplied/);
});

test('validateContract refuses a flag that would be wrong or inert, by name; the schema spells only the auto-width value', () => {
  assert.equal(errorsOf(flagged()), '');
  assert.match(errorsOf(contract({ layout: { display: 'flex' }, textAutoResize: 'WIDTH_AND_HEIGHT', tokens: { 'background-color': '{paint.ground}' } })), /owns no text/);
  assert.match(errorsOf(ContractSchema.parse({ ...flagged(), anatomy: { root: { ...ROOT, textAutoResize: 'WIDTH_AND_HEIGHT', content: { prop: 'label' } } } })), /is a top-level root/);
  assert.match(errorsOf(flagged({ literals: { ...LABEL.literals, width: '40px' } })), /carries width — a box that is sized/);
  assert.match(errorsOf(flagged({ layout: { grow: true } })), /carries layout\.grow —/);
  assert.match(errorsOf(flagged({ declared: { 'text-overflow': 'ellipsis' } })), /carries text-overflow —/, 'a truncated box is not sized by its text');
  assert.match(errorsOf(flagged({ literalsByProp: [{ prop: 'tone', map: { danger: { 'letter-spacing': '2px' } } }] })), /letter-spacing \(per variant or state\)/);
  assert.match(errorsOf(flagged({ tokens: { ...LABEL.tokens, 'letter-spacing': '{track.{tone}}' } })), /letter-spacing \(placeholder token\)/);
  // Review M3: tracking that is not a subtractable length.
  assert.match(errorsOf(flagged({ literals: { ...LABEL.literals, 'letter-spacing': '5%' } })), /letter-spacing "5%", which is not a px \/ em \/ rem length/);
  // Review M2: tracking the part INHERITS — a root's per-variant 2px drew a 42px box where Figma's is 40.
  const inherits = flagged({}, { ...ROOT, literalsByProp: [{ prop: 'tone', map: { danger: { 'letter-spacing': '2px' } } }] });
  assert.match(errorsOf(inherits), /inherits letter-spacing from "root" and states none of its own/);
  assert.match(errorsOf(flagged({}, { ...ROOT, literals: { ...ROOT.literals, 'letter-spacing': '2px' } })), /inherits letter-spacing from "root"/);
  assert.equal(errorsOf(flagged({ literals: { ...LABEL.literals, 'letter-spacing': '1px' } }, { ...ROOT, literals: { ...ROOT.literals, 'letter-spacing': '2px' } })), '', 'a part that states its own tracking does not inherit');
  // Review (low): an inline-level element — inline-size does nothing there.
  assert.match(errorsOf(flagged({ declared: { display: 'inline' } })), /declares display: inline — inline-size does not apply/);
  assert.match(errorsOf(flagged({ declared: { display: 'contents' } })), /declares display: contents/);
  assert.match(errorsOf(flagged({}, { ...ROOT, declared: { display: 'block' } })), /sits in a parent laid out as display: block/);
  assert.equal(errorsOf(flagged({ declared: { display: 'block' } }, { ...ROOT, declared: { display: 'block' } })), '', 'a part that is block-level itself is fine');
  assert.equal(errorsOf(flagged({ declared: { position: 'absolute' } }, { ...ROOT, declared: { display: 'block', position: 'relative' } })), '', 'absolute placement blockifies');
  assert.throws(() => contract({ ...LABEL, textAutoResize: 'HEIGHT' }), 'only the value that lowers is spelled');
  assert.throws(() => contract({ ...LABEL, textAutoResize: 'TRUNCATE' }));
});

// --- measured -------------------------------------------------------------
const FONT = { 'font-size': '13px', 'line-height': '16px', 'letter-spacing': '0.35px' };
const FACE = { 'font-family': 'Arial' };
const LONG = 'Please review the updated terms before continuing with your purchase today.';
/** Strip the calc-size declaration from every rule and inline style: an engine without calc-size(). */
const withoutCalcSize = (root: HTMLElement) => {
  for (const sheet of Array.from(document.styleSheets)) for (const r of Array.from(sheet.cssRules) as CSSStyleRule[]) if (r.style?.inlineSize?.startsWith('calc-size')) r.style.removeProperty('inline-size');
  const el = root.firstElementChild as HTMLElement;
  if (el.style.inlineSize.startsWith('calc-size')) el.style.removeProperty('inline-size');
};
type Seen = { width: number; height: number; root: number; rootHeight: number; runWidth: number; leftGap: number; rightGap: number; lines: number; overflow: number; x: number };
async function measurer(browser: import('playwright-core').Browser, surface: 'css-module' | 'inline') {
  return async (subject: Contract, props: Record<string, unknown> = {}, decorate: (root: HTMLElement) => void = () => {}): Promise<Seen> => {
    const out = surface === 'inline' ? { ...inline(subject), css: '' } : modules(subject);
    assert.deepEqual(generatedTypeErrors(subject.name, out.tsx), []);
    const p = await browser.newPage();
    try {
      const render = await mountGenerated(p, subject.name, out.tsx, out.css);
      await render({ tone: 'brand', ...props });
      return await p.locator('#root > :first-child').evaluate((root, decorateSrc) => {
        (new Function('root', `(${decorateSrc})(root)`))(root);
        const el = root.firstElementChild as HTMLElement;
        const range = document.createRange(); range.selectNodeContents(el);
        const box = el.getBoundingClientRect(), run = range.getBoundingClientRect(), r = root.getBoundingClientRect();
        const rs = getComputedStyle(root);
        const contentRight = r.right - parseFloat(rs.paddingRight) - parseFloat(rs.borderRightWidth);
        return {
          width: box.width, height: box.height, root: r.width, rootHeight: r.height, runWidth: run.width,
          leftGap: run.left - box.left, rightGap: box.right - run.right,
          lines: new Set(Array.from(range.getClientRects(), (x) => Math.round(x.top))).size,
          overflow: box.right - contentRight, x: box.left - r.left - parseFloat(rs.paddingLeft) - parseFloat(rs.borderLeftWidth),
        };
      }, decorate.toString());
    } finally { await p.close(); }
  };
}

test('MEASURED in Chromium: the flagged box is the run rounded up to the pixel (less the trailing tracking), the hug root follows, a centred run stays centred, RTL and vertical writing round the inline axis; the unflagged box keeps its fractional advance — both React surfaces', async (t) => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    try { assert.equal(await page.evaluate((v) => CSS.supports('inline-size', v), TRIMMED), true, 'the lowering rests on calc-size(); this Chromium has it'); } finally { await page.close(); }
    for (const surface of ['css-module', 'inline'] as const) await t.test(surface, async () => {
      const measure = await measurer(browser, surface);
      const plain = contract({ ...LABEL, literals: FONT, declared: FACE });
      const c = flagged({ literals: FONT, declared: FACE });
      const before = await measure(plain);
      const after = await measure(c);
      const ls = 0.35;
      assert.equal(after.runWidth, before.runWidth, 'the glyph run itself does not move');
      assert.ok(!Number.isInteger(before.width), `the control must have a fractional advance for this to prove anything (${before.width})`);
      assert.equal(after.width, Math.ceil(before.width - ls - 1e-6), `Figma's box: the run less the trailing tracking, rounded up (${before.width} → ${after.width})`);
      assert.ok(after.width < before.width + 1, 'never a whole pixel wider than the browser run');
      assert.equal(after.root, after.width + 16, 'the hug root is a whole number: padding plus the whole-pixel box');
      assert.equal(after.rootHeight, before.rootHeight, 'the block axis is untouched');
      const centred = await measure(flagged({ literals: FONT, declared: { ...FACE, 'text-align': 'center' } }));
      assert.ok(Math.abs(centred.leftGap - centred.rightGap) < 0.02, `centred run: ${centred.leftGap} vs ${centred.rightGap}`);
      assert.ok(after.leftGap < 0.02 && after.rightGap >= 0, 'left-aligned run at the start edge');
      const rtl = await measure(c, {}, (root) => { root.dir = 'rtl'; });
      assert.equal(rtl.width, after.width);
      assert.ok(rtl.rightGap < 0.02, `RTL run at the right edge (${rtl.rightGap})`);
      const vertical = await measure(c, {}, (root) => { root.style.writingMode = 'vertical-rl'; });
      assert.equal(vertical.height, after.width, 'logical inline-size rounds the axis the text runs along');
      assert.equal(vertical.width, 16);
    });
  } finally { await browser.close(); }
});

test('MEASURED in Chromium (review H1): a long runtime string still WRAPS exactly as without the fact and never overflows — in a fixed fractional-width flex column and in a fixed-width grid parent — both React surfaces', async (t) => {
  const browser = await chromium.launch();
  try {
    for (const surface of ['css-module', 'inline'] as const) await t.test(surface, async () => {
      const measure = await measurer(browser, surface);
      const grid = (root: HTMLElement) => { root.style.display = 'grid'; root.style.width = '120.5px'; root.style.alignItems = ''; root.style.justifyContent = ''; };
      for (const [where, root, decorate] of [
        ['flex column 120.5px', COLUMN('120.5px'), () => {}],
        ['flex column 240px', COLUMN('240px'), () => {}],
        ['grid 120.5px', ROOT, grid],
      ] as const) {
        const plain = await measure(contract({ ...LABEL, literals: FONT, declared: FACE }, root), { label: LONG }, decorate);
        const flag = await measure(flagged({ literals: FONT, declared: FACE }, root), { label: LONG }, decorate);
        assert.ok(plain.lines > 1, `${where}: the control wraps (${plain.lines} lines)`);
        assert.equal(flag.lines, plain.lines, `${where}: the same wrap as without the fact`);
        assert.equal(flag.height, plain.height, `${where}: the same block size`);
        assert.ok(flag.overflow <= 0.001, `${where}: no overflow past the parent's content edge (${flag.overflow})`);
        assert.ok(flag.root <= plain.root + 0.001, `${where}: the component does not grow (${plain.root} → ${flag.root})`);
      }
    });
  } finally { await browser.close(); }
});

test('MEASURED in Chromium (review M1): under a flex column that would stretch it, the flagged box starts at the start edge — the Figma hug box — with calc-size() AND in an engine without it; the unflagged box is stretched', async (t) => {
  const browser = await chromium.launch();
  try {
    for (const surface of ['css-module', 'inline'] as const) await t.test(surface, async () => {
      const measure = await measurer(browser, surface);
      const centred = { literals: FONT, declared: { ...FACE, 'text-align': 'center' } };
      const plain = await measure(contract({ ...LABEL, ...centred }, COLUMN('200px')));
      const flag = await measure(flagged(centred, COLUMN('200px')));
      const bare = await measure(flagged(centred, COLUMN('200px')), {}, withoutCalcSize);
      assert.equal(plain.width, 200, 'CSS stretches the unflagged label across the column');
      assert.ok(plain.leftGap > 80, `…and centres the run in it (${plain.leftGap})`);
      assert.equal(flag.x, 0);
      assert.equal(flag.width, Math.ceil(flag.runWidth - 0.35 - 1e-6));
      assert.equal(bare.x, 0, 'align-self keeps an engine without calc-size() at the same start edge');
      assert.ok(bare.width < flag.width && flag.width - bare.width < 1, `…with its fractional box, under a pixel narrower (${bare.width} vs ${flag.width})`);
    });
  } finally { await browser.close(); }
});

test('native text rendering is inherited from the root, leaves unflagged contracts alone, and yields to every authored rendering plane', () => {
  const plain = contract(LABEL);
  for (const output of [modules(plain).css, inline(plain).tsx, shadowCss(plain)]) assert.doesNotMatch(output, /text-rendering|textRendering/);
  const automatic = flagged();
  assert.match(rule(modules(automatic).css, '.root'), /text-rendering: geometricPrecision/);
  assert.doesNotMatch(rule(modules(automatic).css, '.caption'), /text-rendering/);
  assert.match(rule(shadowCss(automatic), "[part='root']"), /text-rendering: geometricPrecision/);
  assert.ok(inline(automatic).tsx.includes('"textRendering": "geometricPrecision"'));
  for (const c of [
    flagged({ declared: { 'text-rendering': 'auto' } }),
    flagged({}, { ...ROOT, declared: { 'text-rendering': 'optimizespeed' } }),
    flagged({ declaredStates: { hover: { 'text-rendering': 'optimizelegibility' } } }),
    flagged({}, { ...ROOT, declaredStates: { hover: { 'text-rendering': 'optimizespeed' } } }),
  ]) {
    c.states = ['hover'];
    for (const output of [modules(c).css, inline(c).tsx, shadowCss(c)]) assert.doesNotMatch(output, /geometricPrecision/);
  }
});

test('native text rendering does not cross a caller-content or child-component ownership boundary', () => {
  const withSlot = flagged();
  withSlot.anatomy.root!.parts!.external = { slot: { name: 'children' } };
  assert.equal(nativeTextRenderingRoots(withSlot).size, 0);
  assert.deepEqual([...nativeTextRenderingLeafParts(withSlot)], [withSlot.anatomy.root!.parts!.caption]);
  assert.doesNotMatch(rule(modules(withSlot).css, '.root') + rule(modules(withSlot).css, '.external'), /geometricPrecision/);
  assert.match(rule(modules(withSlot).css, '.caption'), /geometricPrecision/);
  assert.match(rule(shadowCss(withSlot), "[part='caption']"), /geometricPrecision/);
  // A child still owns its own rendering policy; inspecting the parent's
  // analysis must not need to compile or rewrite that child's contract.
  const withChild = flagged();
  withChild.anatomy.root!.parts!.external = { component: { id: 'probe.external' } };
  assert.equal(nativeTextRenderingRoots(withChild).size, 0);
  const multi = flagged();
  multi.anatomy.second = structuredClone(contract(LABEL).anatomy.root!);
  assert.deepEqual([...nativeTextRenderingRoots(multi)], [multi.anatomy.root]);
  multi.anatomy.second.declared = { 'text-rendering': 'optimizespeed' };
  assert.deepEqual([...nativeTextRenderingRoots(multi)], [multi.anatomy.root], 'another root cannot alter this root');
});

test('MEASURED native text rendering: defaults and caller overrides exactly match the authored policy across fonts, runtime strings, wrapping and RTL on both React surfaces', async t => {
  const browser = await chromium.launch();
  try {
    for (const surface of ['css-module', 'inline'] as const) await t.test(surface, async () => {
      for (const file of ['inter/inter-latin-variable.woff2', 'roboto/roboto-latin-400-normal.woff2', 'ibm-plex-sans/IBMPlexSans-Regular.woff2']) {
        const c = flagged({ declared: { 'font-family': 'Rendering Probe' } });
        const emit = (subject: Contract) => surface === 'inline' ? { ...inline(subject), css: '' } : modules(subject);
        const policies = ['geometricPrecision', 'auto'] as const;
        // A rendering-policy switch may change glyph metrics on Linux. Compare
        // the inferred/caller policy with an explicit contract declaration of
        // that SAME policy, without weakening any geometry comparison.
        const subjects = [c, ...policies.map(policy => flagged(
          { declared: { 'font-family': 'Rendering Probe' } },
          { ...ROOT, declared: { 'text-rendering': policy.toLowerCase() } },
        ))];
        const pages = await Promise.all(subjects.map(() => browser.newPage()));
        try {
          const font = readFileSync(new URL('../extract/computed/fonts/' + file, import.meta.url));
          const renders = [];
          for (const [index, subject] of subjects.entries()) {
            const output = emit(subject), page = pages[index];
            renders.push(await mountGenerated(page, subject.name, output.tsx, output.css));
            await page.addStyleTag({ content: `@font-face{font-family:"Rendering Probe";src:url(data:font/woff2;base64,${font.toString('base64')});font-weight:100 900}` });
            assert.equal(await page.evaluate(async () => {
              const faces = await document.fonts.load('14px "Rendering Probe"');
              await document.fonts.ready;
              return faces.length;
            }), 1, 'the provided face must load before either observation');
          }
          const observe = (index: number) => pages[index].locator('#root > :first-child').evaluate(root => {
            const origin = root.getBoundingClientRect();
            return [...[root], ...root.querySelectorAll('*')].map(el => {
              const box = el.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(el);
              return { x: box.x - origin.x, y: box.y - origin.y, width: box.width, height: box.height,
                runs: [...range.getClientRects()].map(r => ({ x: r.x - origin.x, y: r.y - origin.y, width: r.width, height: r.height })) };
            });
          });
          for (const label of ['AVATAR office ffi', 'Ångström naïve', LONG]) for (const dir of ['ltr', 'rtl']) {
            for (const [index, policy] of policies.entries()) {
              const style = { width: '120px' };
              await renders[index + 1]({ label, dir, style });
              await renders[0]({ label, dir, style: policy === 'auto' ? { ...style, textRendering: policy } : style });
              for (const page of [pages[0], pages[index + 1]])
                assert.equal(await page.locator('#root > :first-child > :first-child').evaluate(el => getComputedStyle(el).textRendering), policy.toLowerCase());
              assert.deepEqual(await observe(0), await observe(index + 1), `${surface}: ${file}: ${label}: ${dir}: ${policy}`);
            }
          }
        } finally { await Promise.all(pages.map(page => page.close())); }
      }
    });
  } finally { await browser.close(); }
});


test('owned leaf defaults stay on direct terminal text and yield to authored rendering channels', () => {
  const c = flagged();
  c.anatomy.root!.parts!.external = { slot: { name: 'children' } };
  for (const changed of [
    { ...c, anatomy: { root: { ...c.anatomy.root!, declared: { 'text-rendering': 'auto' } } } },
    flagged({ ...LABEL, textAutoResize: undefined }),
  ]) assert.equal(nativeTextRenderingLeafParts(changed).size, 0);
  const nested = structuredClone(c);
  nested.anatomy.root!.parts!.wrapper = { parts: { nested: nested.anatomy.root!.parts!.caption! } };
  delete nested.anatomy.root!.parts!.caption;
  assert.equal(nativeTextRenderingLeafParts(nested).size, 0, 'a deeper wrapper does not acquire the direct-leaf proof');
  const authored = structuredClone(c);
  authored.states = ['hover'];
  authored.anatomy.root!.parts!.external.declaredStates = { hover: { 'text-rendering': 'optimizelegibility' } };
  assert.equal(nativeTextRenderingLeafParts(authored).size, 0, 'any authored rendering plane suppresses inference');
});

test('MEASURED owned leaf hint leaves caller and component content untouched while caller rendering overrides win', async t => {
  const browser = await chromium.launch();
  try {
    for (const surface of ['css-module', 'inline'] as const) await t.test(surface, async () => {
      const c = flagged();
      c.anatomy.root!.parts!.external = { slot: { name: 'children' } };
      const child = contract(LABEL);
      child.id = 'probe.external'; child.name = 'External';
      c.anatomy.root!.parts!.child = { component: { id: child.id } };
      const context = { contracts: new Map([[c.id,c],[child.id,child]]), icons: new Map<string,string>() };
      const emit = (component: Contract) => surface === 'inline'
        ? { ...emitReactInline(component, { ...context, tokens }), css: '' }
        : emitReact(component, { ...context, tokens: tokenInventoryFromJson([tokens.primitives]), tokenValues: tokens });
      const output = emit(c), dep = emit(child);
      assert.deepEqual(generatedTypeErrors(c.name, output.tsx, { External: dep.tsx }), []);
      const page = await browser.newPage();
      try {
        const render = await mountGenerated(page,c.name,output.tsx,output.css,{External:dep});
        const observe = () => page.locator('#root > :first-child').evaluate(root => [root,...root.querySelectorAll('*')].map(el => ({text:el.textContent,rendering:getComputedStyle(el).textRendering,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})));
        await render({label:'Owned text',children:'Caller text'});
        const before = await observe();
        assert.deepEqual(before.map(x=>x.rendering), ['auto','geometricprecision','auto','auto','auto']);
        for (const value of ['auto','optimizeSpeed','optimizeLegibility']) {
          await render({label:'Owned text',children:'Caller text',style:{textRendering:value}});
          const after = await observe();
          assert.deepEqual(after.map(x=>x.rendering), after.map(()=>value.toLowerCase()));
          if(value==='auto') assert.deepEqual(after.map(({rendering,...geometry})=>geometry),before.map(({rendering,...geometry})=>geometry));
        }
      } finally { await page.close(); }
    });
  } finally { await browser.close(); }
});

test('MEASURED a contract style axis stays an enum without a duplicate HTML style binding', async t => {
  const browser=await chromium.launch();
  try {
    for(const surface of ['css-module','inline'] as const) await t.test(surface, async()=>{
      const c=flagged();
      c.props[0]={...c.props[0],name:'style',bindings:{...c.props[0].bindings,code:{prop:'style'}}};
      c.anatomy.root!.literalsByProp=[{prop:'style',map:{brand:{'background-color':'#0000ff'},danger:{'background-color':'#ff0000'}}}];
      c.anatomy.root!.parts!.external={slot:{name:'children'}};
      const out=surface==='inline'?{...inline(c),css:''}:modules(c);
      assert.deepEqual(generatedTypeErrors(c.name,out.tsx),[]);
      const page=await browser.newPage();
      try{
        const render=await mountGenerated(page,c.name,out.tsx,out.css);
        for(const [style,color] of [['brand','rgb(0, 0, 255)'],['danger','rgb(255, 0, 0)']]){
          await render({style,label:'Owned label',children:'Caller label'});
          assert.equal(await page.locator('#root > :first-child').evaluate(el=>getComputedStyle(el).backgroundColor),color);
          assert.deepEqual(await page.locator('#root > :first-child > *').evaluateAll(els=>els.map(el=>getComputedStyle(el).textRendering)),['geometricprecision','auto']);
        }
      }finally{await page.close();}
    });
  }finally{await browser.close();}
});
