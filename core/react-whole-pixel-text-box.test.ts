// `Part.textAutoResize: 'WIDTH_AND_HEIGHT'` on the three code surfaces (dump v1.36).
// A Figma text box that sizes itself to its text is a WHOLE number of pixels wide
// (the advance rounded up, with no letter spacing after the last glyph); the
// browser lays the same run out at its fractional advance and adds tracking after
// every glyph. Measured by the design-led consumer check on the 72-variant CBDS
// Badge: 26 of the 48 × 16 px small variants missed the 5 % limit with every
// content size equal (a 47.40625 px root against Figma's 48). The emitters now
// give the text element the same box — `inline-size: calc-size(max-content,
// round(up, size[ - <letter-spacing>], 1px))`, a progressive enhancement — and
// these tests MEASURE the box in Chromium rather than read the stylesheet's intent.
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import { emitReact, validateContract } from './emit-react.js';
import { emitReactInline } from './emit-react-inline.js';
import { shadowCss } from '../packages/emitter-web-components/src/emit-wc.js';
import { generatedTypeErrors, mountGenerated } from './react-test-runtime.js';
import { tokenInventoryFromJson } from './tokens.js';

const tokens = { primitives: {
  paint: { ground: { $type: 'color', $value: '#0e61ba' }, ink: { $type: 'color', $value: '#fcfeff' } },
  track: { wide: { $type: 'dimension', $value: '1px' } },
}, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
const TONE = { name: 'tone', type: { enum: ['brand', 'danger'] }, default: 'brand', bindings: { code: { prop: 'tone' }, figma: { kind: 'VARIANT', property: 'Tone', values: { brand: 'Brand', danger: 'Danger' } } } };
/** The Badge's shape: a hug root with 8px inline padding around one text part. */
const LABEL = { text: 'Label', tokens: { color: '{paint.ink}' }, literals: { 'font-size': '14px', 'line-height': '16px' } };
const ROOT = { layout: { display: 'inline-flex', direction: 'row', align: 'center', justify: 'center' }, tokens: { 'background-color': '{paint.ground}' }, literals: { 'padding-inline': '8px', 'padding-block': '0px', width: 'fit-content' } };
function contract(label: Record<string, unknown>, root: Record<string, unknown> = ROOT): Contract {
  return ContractSchema.parse({
    id: 'probe.text-box', name: 'TextBoxProbe', version: '1.0.0', archetype: 'none',
    description: 'Whole-pixel text-box conformance, not a qualified source component.',
    semantics: { element: 'div' }, props: [TONE], states: [],
    anatomy: { root: { ...root, parts: { caption: label } } },
    bindings: { code: { anchors: { importPath: './TextBoxProbe', export: 'TextBoxProbe' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
}
const ctx = (c: Contract) => ({ contracts: new Map([[c.id, c]]), icons: new Map<string, string>() });
const modules = (c: Contract) => emitReact(c, { ...ctx(c), tokens: tokenInventoryFromJson([tokens.primitives]), tokenValues: tokens });
const inline = (c: Contract) => emitReactInline(c, { ...ctx(c), tokens } as never);
const rule = (css: string, selector: string) => css.match(new RegExp(`(^|\\n)${selector.replace(/[.[\]=':()]/g, '\\$&')} \\{[^}]*\\}`))?.[0] ?? '';
const flagged = (extra: Record<string, unknown> = {}) => contract({ ...LABEL, ...extra, textAutoResize: 'WIDTH_AND_HEIGHT' });
const VALUE = 'calc-size(max-content, round(up, size, 1px))';
const TRIMMED = 'calc-size(max-content, round(up, size - 1px, 1px))';
const errorsOf = (c: Contract) => { const errors: string[] = []; validateContract(c, new Map([[c.id, c]]), errors, new Map()); return errors.join('\n'); };

test('without the flag every surface emits what it always did — no calc-size, no inline-size, byte for byte the sheet of a contract that never heard of it', () => {
  const plain = contract(LABEL);
  for (const out of [modules(plain).css, shadowCss(plain), inline(plain).tsx]) assert.doesNotMatch(out, /calc-size|inline-size|inlineSize|textAutoResize/, out);
});

test('CSS modules, the web-component sheet and the inline style give the flagged text part its whole-pixel box, and nothing else moves', () => {
  const c = flagged();
  assert.match(rule(modules(c).css, '.caption'), /\n  inline-size: calc-size\(max-content, round\(up, size, 1px\)\);\n/);
  assert.match(rule(shadowCss(c), "[part='caption']"), /\n  inline-size: calc-size\(max-content, round\(up, size, 1px\)\);\n/);
  assert.ok(inline(c).tsx.includes(`"inlineSize": "${VALUE}"`), inline(c).tsx);
  // The root — the part that does NOT carry the fact — is untouched on every surface.
  const plain = contract(LABEL);
  assert.equal(rule(modules(c).css, '.root'), rule(modules(plain).css, '.root'));
  assert.equal(rule(shadowCss(c), "[part='root']"), rule(shadowCss(plain), "[part='root']"));
  // One declaration is the whole difference between the two sheets.
  assert.equal(modules(c).css.replace(`  inline-size: ${VALUE};\n`, ''), modules(plain).css);
});

test('the letter spacing CSS adds after the LAST glyph — which Figma\'s box does not have — is shed before rounding: a literal verbatim, a token as its var() on the sheets and its value inline (letter-spacing is a literal or token channel, never declared)', () => {
  const literal = flagged({ literals: { ...LABEL.literals, 'letter-spacing': '1px' } });
  assert.ok(rule(modules(literal).css, '.caption').includes(`inline-size: ${TRIMMED};`), modules(literal).css);
  assert.ok(rule(shadowCss(literal), "[part='caption']").includes(`inline-size: ${TRIMMED};`));
  assert.ok(inline(literal).tsx.includes(`"inlineSize": "${TRIMMED}"`));
  const em = flagged({ literals: { ...LABEL.literals, 'letter-spacing': '0.05em' } });
  assert.ok(rule(modules(em).css, '.caption').includes('inline-size: calc-size(max-content, round(up, size - 0.05em, 1px));'));
  const token = flagged({ tokens: { ...LABEL.tokens, 'letter-spacing': '{track.wide}' } });
  assert.ok(rule(modules(token).css, '.caption').includes('inline-size: calc-size(max-content, round(up, size - var(--track-wide), 1px));'), modules(token).css);
  assert.ok(inline(token).tsx.includes(`"inlineSize": "${TRIMMED}"`), 'the inline surface resolves the token to its literal');
  // A zero adds nothing after the last glyph: nothing to shed (`normal` is not a literal the schema accepts).
  assert.ok(rule(modules(flagged({ literals: { ...LABEL.literals, 'letter-spacing': '0' } })).css, '.caption').includes(`inline-size: ${VALUE};`));
  assert.ok(rule(modules(flagged({ literals: { ...LABEL.literals, 'letter-spacing': '0px' } })).css, '.caption').includes(`inline-size: ${VALUE};`));
});

test('validateContract refuses a stray flag and what the box cannot be at the same time, by name; the schema spells only the auto-width value', () => {
  assert.equal(errorsOf(flagged()), '');
  assert.match(errorsOf(contract({ layout: { display: 'flex' }, textAutoResize: 'WIDTH_AND_HEIGHT', tokens: { 'background-color': '{paint.ground}' } })), /carries textAutoResize but owns no text/);
  assert.match(errorsOf(contract(LABEL, { ...ROOT, text: undefined, textAutoResize: 'WIDTH_AND_HEIGHT' })), /is a top-level root and carries textAutoResize/);
  assert.match(errorsOf(flagged({ literals: { ...LABEL.literals, width: '40px' } })), /textAutoResize: WIDTH_AND_HEIGHT together with width —/);
  assert.match(errorsOf(flagged({ layout: { grow: true } })), /together with layout\.grow —/);
  assert.match(errorsOf(flagged({ declared: { 'text-overflow': 'ellipsis' } })), /together with text-overflow —/, 'a truncated box is not sized by its text');
  assert.match(errorsOf(flagged({ literalsByProp: [{ prop: 'tone', map: { danger: { 'letter-spacing': '2px' } } }] })), /together with letter-spacing \(per variant or state\)/, 'the trailing tracking to shed has no single spelling');
  assert.match(errorsOf(flagged({ tokens: { ...LABEL.tokens, 'letter-spacing': '{track.{tone}}' } })), /letter-spacing \(placeholder token\)/);
  assert.throws(() => contract({ ...LABEL, textAutoResize: 'HEIGHT' }), 'only the value that lowers is spelled');
  assert.throws(() => contract({ ...LABEL, textAutoResize: 'TRUNCATE' }));
});

test('MEASURED in Chromium: the flagged box is the run rounded up to the pixel (less the trailing tracking), the hug root follows, a centred run stays centred, RTL and vertical writing round the inline axis; the unflagged box keeps its fractional advance — both React surfaces', async (t) => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    try {
      assert.equal(await page.evaluate((v) => CSS.supports('inline-size', v), TRIMMED), true, 'the lowering rests on calc-size(); this Chromium has it');
      // A font every Chromium has, at a size and tracking that make the advance fractional.
      const font = { 'font-size': '13px', 'line-height': '16px', 'letter-spacing': '0.35px' };
      const face = { 'font-family': 'Arial' };
      for (const surface of ['css-module', 'inline'] as const) await t.test(surface, async () => {
        const plain = contract({ ...LABEL, literals: font, declared: face });
        const c = flagged({ literals: font, declared: face });
        const measure = async (subject: Contract, decorate: (root: HTMLElement) => void = () => {}) => {
          const out = surface === 'inline' ? { ...inline(subject), css: '' } : modules(subject);
          assert.deepEqual(generatedTypeErrors(subject.name, out.tsx), []);
          const p = await browser.newPage();
          try {
            const render = await mountGenerated(p, subject.name, out.tsx, out.css);
            await render({ tone: 'brand' });
            return await p.locator('#root > :first-child').evaluate((root, decorateSrc) => {
              (new Function('root', `(${decorateSrc})(root)`))(root);
              const el = root.firstElementChild as HTMLElement;
              const range = document.createRange(); range.selectNodeContents(el);
              const box = el.getBoundingClientRect(), run = range.getBoundingClientRect(), r = root.getBoundingClientRect();
              return { width: box.width, height: box.height, root: r.width, rootHeight: r.height, runWidth: run.width, leftGap: run.left - box.left, rightGap: box.right - run.right, inlineSize: getComputedStyle(el).inlineSize };
            }, decorate.toString());
          } finally { await p.close(); }
        };
        const before = await measure(plain);
        const after = await measure(c);
        const n = 'Label'.length, ls = 0.35;
        assert.equal(after.runWidth, before.runWidth, 'the glyph run itself does not move');
        assert.ok(!Number.isInteger(before.width), `the control must have a fractional advance for this to prove anything (${before.width})`);
        assert.equal(after.width, Math.ceil(before.width - ls - 1e-6), `Figma's box: the run less the trailing tracking, rounded up (${before.width} → ${after.width})`);
        assert.ok(after.width < before.width + 1, 'never a whole pixel wider than the browser run');
        assert.equal(after.root, after.width + 16, 'the hug root is a whole number: padding plus the whole-pixel box');
        assert.equal(after.rootHeight, before.rootHeight, 'the block axis is untouched');
        // Centred: the run sits in the middle of the wider box; left-aligned (the default): at its start.
        const centred = await measure(flagged({ literals: font, declared: { ...face, 'text-align': 'center' } }));
        assert.ok(Math.abs(centred.leftGap - centred.rightGap) < 0.02, `centred run: ${centred.leftGap} vs ${centred.rightGap}`);
        assert.ok(after.leftGap < 0.02 && after.rightGap >= 0, 'left-aligned run at the start edge');
        // RTL: `inline-size` is the same axis, and the run starts at the right edge.
        const rtl = await measure(c, (root) => { root.dir = 'rtl'; });
        assert.equal(rtl.width, after.width);
        assert.ok(rtl.rightGap < 0.02, `RTL run at the right edge (${rtl.rightGap})`);
        // Vertical writing: the INLINE axis is now vertical, so the height is the whole-pixel one and the width is the line.
        const vertical = await measure(c, (root) => { root.style.writingMode = 'vertical-rl'; });
        assert.equal(vertical.height, after.width, 'logical inline-size rounds the axis the text runs along');
        assert.equal(vertical.width, 16);
      });
    } finally { await page.close(); }
  } finally { await browser.close(); }
});
