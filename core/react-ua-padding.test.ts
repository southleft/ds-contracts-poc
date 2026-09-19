// UA PADDING (docs/23 §D.44, rule B). An element the user agent pads by default
// (UA_PADDING_ELEMENTS — measured in the repo's Chromium: button 1/6/1/6 px,
// input, textarea, fieldset, legend, ul/ol/menu inline-start 40 px, dialog,
// td/th, option) gets `<side>: 0` on every side the contract does not declare —
// a Figma frame's undeclared padding is 0. Measured defect: Altitude Tab Panel,
// a <button> root declaring only padding-top, rendered 12 px wider than the
// canvas. Only the undeclared sides are emitted; a contract that declares all
// four is byte-identical, on React modules, React inline and web components.
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import { emitReact } from './emit-react.js';
import { emitReactInline } from './emit-react-inline.js';
import { shadowCss } from '../packages/emitter-web-components/src/emit-wc.js';
import { UA_PADDING_ELEMENTS, undeclaredPaddingSides } from '../packages/core/src/anatomy.js';
import { tokenInventoryFromJson } from './tokens.js';

const tokens = { primitives: { space: { top: { $type: 'dimension', $value: '8px' } } }, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
const TONE = { name: 'tone', type: { enum: ['a', 'b'] }, default: 'a', bindings: { code: { prop: 'tone' }, figma: { kind: 'VARIANT', property: 'Tone', values: { a: 'A', b: 'B' } } } };
function contract(element: string, root: Record<string, unknown>, parts: Record<string, unknown> = {}): Contract {
  return ContractSchema.parse({
    id: 'probe.ua-padding', name: 'UaPaddingProbe', version: '1.0.0', archetype: 'none',
    description: 'UA padding conformance, not a qualified source component.',
    semantics: { element }, props: [TONE], states: [],
    anatomy: { root: { layout: { display: 'flex', direction: 'column' }, ...root, parts } },
    bindings: { code: { anchors: { importPath: './UaPaddingProbe', export: 'UaPaddingProbe' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
}
const ctx = (c: Contract) => ({ contracts: new Map([[c.id, c]]), icons: new Map<string, string>() });
const moduleCss = (c: Contract) => emitReact(c, { ...ctx(c), tokens: tokenInventoryFromJson([tokens.primitives]), tokenValues: tokens }).css;
const inlineTsx = (c: Contract) => emitReactInline(c, { ...ctx(c), tokens } as never).tsx;
const rule = (css: string, selector: string) => css.match(new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')} \\{[^}]*\\}`))?.[0] ?? '';
const ZEROED = ['padding-right: 0', 'padding-bottom: 0', 'padding-left: 0'];

test('the list is the Chromium measurement, not a recollection', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><body></body>');
    const padded = await page.evaluate((candidates) => {
      const out: string[] = [];
      for (const tag of candidates) {
        const el = document.createElement(tag);
        if (tag === 'td' || tag === 'th') document.body.appendChild(document.createElement('table')).insertRow().appendChild(el);
        else if (tag === 'legend') document.body.appendChild(document.createElement('fieldset')).appendChild(el);
        else if (tag === 'option') document.body.appendChild(document.createElement('select')).appendChild(el);
        else { if (tag === 'dialog') el.setAttribute('open', ''); document.body.appendChild(el); }
        const cs = getComputedStyle(el);
        if (['top', 'right', 'bottom', 'left'].some((s) => cs.getPropertyValue(`padding-${s}`) !== '0px')) out.push(tag);
      }
      return out;
    }, ['a', 'button', 'div', 'span', 'label', 'p', 'h2', 'li', 'section', 'select', 'input', 'textarea', 'fieldset', 'legend', 'ul', 'ol', 'menu', 'dialog', 'td', 'th', 'option']);
    assert.deepEqual(new Set(padded), UA_PADDING_ELEMENTS);
  } finally {
    await browser.close();
  }
});

test('undeclaredPaddingSides reads every unconditional and per-value channel; a shorthand or a logical pair covers its sides', () => {
  assert.deepEqual(undeclaredPaddingSides({ tokens: { 'padding-top': '{space.top}' } } as never), ['padding-right', 'padding-bottom', 'padding-left']);
  assert.deepEqual(undeclaredPaddingSides({ literals: { 'padding-inline': '8px' } } as never), ['padding-top', 'padding-bottom']);
  assert.deepEqual(undeclaredPaddingSides({ declared: { padding: '0' } } as never), []);
  assert.deepEqual(undeclaredPaddingSides({ tokensByProp: { prop: 'tone', map: { a: { 'padding-left': '{space.top}' } } } } as never), ['padding-top', 'padding-right', 'padding-bottom']);
  assert.deepEqual(undeclaredPaddingSides({ literalsByProp: [{ prop: 'tone', map: { b: { 'padding-block': '2px' } } }] } as never), ['padding-right', 'padding-left']);
});

test('a <button> root declaring only padding-top gets padding-right/bottom/left: 0 on React modules, React inline and web components', () => {
  const c = contract('button', { tokens: { 'padding-top': '{space.top}' } });
  const mod = rule(moduleCss(c), '.root');
  const wc = shadowCss(c);
  for (const decl of ZEROED) {
    assert.ok(mod.includes(`  ${decl};`), `module: ${decl}\n${mod}`);
    assert.ok(wc.includes(`${decl};`), `wc: ${decl}\n${wc}`);
  }
  for (const out of [mod, wc]) assert.doesNotMatch(out, /padding-top: 0/, 'the declared side is never zeroed');
  const tsx = inlineTsx(c);
  for (const key of ['"paddingRight": 0', '"paddingBottom": 0', '"paddingLeft": 0']) assert.ok(tsx.includes(key), `inline: ${key}`);
  assert.doesNotMatch(tsx, /"paddingTop": 0\b/);
});

test('a <button> root declaring all four paddings (or both logical pairs) gets no zeroed side on any surface', () => {
  const four = contract('button', { literals: { 'padding-top': '1px', 'padding-right': '2px', 'padding-bottom': '3px', 'padding-left': '4px' } });
  // Byte identity against the engine before the rule is pinned by the committed trees: every committed
  // button root that declares all four sides (generated:fresh, census d2c hashes) kept its bytes.
  for (const out of [moduleCss(four), shadowCss(four), inlineTsx(four)]) assert.doesNotMatch(out, /padding-(top|right|bottom|left): 0\b|"padding(Top|Right|Bottom|Left)": 0\b/, out);
  // The logical pairs cover their sides the same way.
  const logical = contract('button', { literals: { 'padding-block': '1px', 'padding-inline': '2px' } });
  for (const out of [moduleCss(logical), shadowCss(logical), inlineTsx(logical)]) assert.doesNotMatch(out, /padding-(top|right|bottom|left): 0\b|"padding(Top|Right|Bottom|Left)": 0\b/, out);
});

test('an element the UA does not pad is untouched', () => {
  const c = contract('div', { tokens: { 'padding-top': '{space.top}' } });
  for (const out of [moduleCss(c), shadowCss(c), inlineTsx(c)]) assert.doesNotMatch(out, /padding-(right|bottom|left): 0\b|"padding(Right|Bottom|Left)": 0\b/, out);
});

test('nested parts: a <ul> part zeroes its undeclared sides on every surface; an event-trigger <button> part keeps its own `padding: 0` and gets nothing more', () => {
  const c = contract('div', {}, { list: { element: 'ul', literals: { 'padding-left': '12px' } } });
  const mod = rule(moduleCss(c), '.list');
  for (const decl of ['padding-top: 0', 'padding-right: 0', 'padding-bottom: 0']) assert.ok(mod.includes(`  ${decl};`), `module: ${decl}\n${mod}`);
  assert.doesNotMatch(mod, /padding-left: 0/);
  assert.match(shadowCss(c), /padding-top: 0;[^}]*padding-bottom: 0;/);
  assert.match(inlineTsx(c), /"list": \{[^}]*"paddingTop": 0,[^}]*"paddingLeft": "12px"/);
  // An event-trigger <button> part already zeroes all padding with the shorthand — nothing is added beside it.
  const trigger = ContractSchema.parse({
    ...contract('div', {}, { close: { element: 'button', literals: { 'padding-top': '2px' } } }),
    events: [{ name: 'close', bindings: { code: { prop: 'onClose' } }, trigger: 'close' }],
  });
  const closeRule = rule(moduleCss(trigger), '.close');
  assert.match(closeRule, /padding: 0;/);
  assert.doesNotMatch(closeRule, /padding-(right|bottom|left): 0/);
});

test('measured: the <button> root renders as wide as its content plus the declared padding — no UA inline padding leaks', async () => {
  const c = contract('button', { literals: { 'padding-top': '8px', width: 'fit-content' } }, { box: { literals: { width: '40px', height: '10px' } } });
  const css = moduleCss(c);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`<!doctype html><style>:root{--space-top:8px}${css}</style><button class="root"><div class="box"></div></button>`);
    const box = await page.evaluate(() => { const r = document.querySelector('button')!.getBoundingClientRect(); return [r.width, r.height]; });
    assert.deepEqual(box, [40, 18], 'Figma: 40 wide, 10 + 8 padding-top high');
  } finally {
    await browser.close();
  }
});
