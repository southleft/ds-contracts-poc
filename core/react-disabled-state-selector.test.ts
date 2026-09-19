// A disabled state styles what the element actually exposes (docs/23 §D.45).
// `:disabled` matches only a native form control (button / input / select /
// textarea / fieldset …); on a `div`, `span`, `a`, `label` or custom element it
// never matches. The generated component renders `data-disabled` for the
// `disabled` prop on every such root, so `.root:disabled { … }` was a dead
// rule and a `:hover:not(:disabled)` guard never excluded the disabled state.
// The emitters now select on the attribute each surface renders; a native root
// keeps `:disabled` byte for byte. The last test MEASURES the paint in Chromium.
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import { emitReact } from './emit-react.js';
import { emitReactInline } from './emit-react-inline.js';
import { emitHtml } from './emit-html.js';
import { emitWebComponent, shadowCss } from '../packages/emitter-web-components/src/emit-wc.js';
import { disabledStateSelector, stateSelectorsFor } from '../packages/core/src/anatomy.js';
import { generatedTypeErrors, mountGenerated } from './react-test-runtime.js';
import { flattenTokens, tokenInventoryFromJson } from './tokens.js';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { extractReactTsx } from '../extract/adapters/react-tsx.js';

const tokens = {
  primitives: {
    paint: {
      ground: { $type: 'color', $value: '#ffffff' },
      hover: { $type: 'color', $value: '#0000ff' },
      muted: { $type: 'color', $value: '#cccccc' },
      ink: { $type: 'color', $value: '#111111' },
      faded: { $type: 'color', $value: '#888888' },
    },
    box: { side: { $type: 'dimension', $value: '40px' } },
  },
  semantic: {}, light: {}, dark: {}, brands: { default: {} },
};
const DISABLED = { name: 'disabled', type: 'boolean', default: false, bindings: { code: { prop: 'disabled' }, figma: { kind: 'BOOLEAN', property: 'Disabled' } } };
const AS = { name: 'as', type: { enum: ['button', 'div'] }, default: 'button', bindings: { code: { prop: 'as' }, figma: { kind: 'VARIANT', property: 'As', values: { button: 'Button', div: 'Div' } } } };

/** A root with a hover and a disabled state, and a part whose colour follows the disabled state. */
function contract(element: string, extra: { props?: unknown[]; elementByProp?: unknown } = {}): Contract {
  return ContractSchema.parse({
    id: `probe.disabled-${element}`, name: 'DisabledProbe', version: '1.0.0', archetype: 'none',
    description: 'Disabled-state selector conformance, not a qualified source component.',
    semantics: { element, ...(extra.elementByProp ? { elementByProp: extra.elementByProp } : {}) },
    props: [DISABLED, ...(extra.props ?? [])], states: ['hover', 'disabled'],
    anatomy: {
      root: {
        layout: { display: 'flex' },
        tokens: { 'background-color': '{paint.ground}', width: '{box.side}', height: '{box.side}' },
        states: { hover: { 'background-color': '{paint.hover}' }, disabled: { 'background-color': '{paint.muted}' } },
        parts: { label: { element: 'span', text: 'Label', tokens: { color: '{paint.ink}' }, states: { disabled: { color: '{paint.faded}' } } } },
      },
    },
    bindings: { code: { anchors: { importPath: './DisabledProbe', export: 'DisabledProbe' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
}
const ctx = (c: Contract) => ({ contracts: new Map([[c.id, c]]), icons: new Map<string, string>() });
const modules = (c: Contract) => emitReact(c, { ...ctx(c), tokens: tokenInventoryFromJson([tokens.primitives]), tokenValues: tokens });
const wcElement = (c: Contract) => emitWebComponent(c, { ...ctx(c), tokens: tokenInventoryFromJson([tokens.primitives]) }).element;
const html = (c: Contract) => emitHtml(c, { ...ctx(c), tokens: tokenInventoryFromJson([tokens.primitives]) } as never);
const rootVars = `:root {${[...flattenTokens(tokens.primitives)].map(([key, token]) => `--${key.replaceAll('.', '-')}: ${token.value};`).join('\n')}}\n`;

test('the selector table: a native root keeps the exact STATE_SELECTORS object; every other root selects on the attribute', () => {
  assert.equal(disabledStateSelector(true, false), ':disabled');
  assert.equal(disabledStateSelector(false, true), '[data-disabled]');
  assert.equal(disabledStateSelector(true, true), ':is(:disabled, [data-disabled])');
  assert.deepEqual(stateSelectorsFor(':disabled'), { hover: ':hover:not(:disabled)', active: ':active:not(:disabled)', 'focus-visible': ':focus-visible', disabled: ':disabled' });
  assert.deepEqual(stateSelectorsFor('[data-disabled]'), { hover: ':hover:not([data-disabled])', active: ':active:not([data-disabled])', 'focus-visible': ':focus-visible', disabled: '[data-disabled]' });
});

test('React: a div root styles [data-disabled], the attribute its TSX renders; the hover guard excludes it; the part rides the root', () => {
  const { tsx, css } = modules(contract('div'));
  assert.match(tsx, /data-disabled=\{disabled \|\| undefined\}/, 'the attribute the selector names is the one the component renders');
  assert.doesNotMatch(tsx, /\sdisabled=\{/, 'a div gets no native disabled attribute');
  assert.match(css, /\n\.root\[data-disabled\] \{\n {2}background-color: var\(--paint-muted\);/);
  assert.match(css, /\n\.root:hover:not\(\[data-disabled\]\) \{\n {2}background-color: var\(--paint-hover\);/);
  assert.match(css, /\n\.root\[data-disabled\] \.label \{\n {2}color: var\(--paint-faded\);/);
  assert.doesNotMatch(css, /:disabled/, 'no dead :disabled selector is left on a div');
});

test('React: a button root is unchanged — :disabled, :hover:not(:disabled), and the native attribute', () => {
  const { tsx, css } = modules(contract('button'));
  assert.match(tsx, /disabled=\{disabled\}/);
  assert.doesNotMatch(tsx, /data-disabled/);
  assert.match(css, /\n\.root:disabled \{\n {2}background-color: var\(--paint-muted\);/);
  assert.match(css, /\n\.root:hover:not\(:disabled\) \{/);
  assert.match(css, /\n\.root:disabled \.label \{/);
  assert.doesNotMatch(css, /data-disabled/);
});

test('every non-native root element the vocabulary allows takes the attribute (span, a, label, li, section)', () => {
  for (const el of ['span', 'a', 'label', 'li', 'section']) {
    const { css } = modules(contract(el));
    assert.match(css, /\.root\[data-disabled\] \{/, el);
    assert.doesNotMatch(css, /:disabled/, el);
  }
});

test('elementByProp: React renders data-disabled on every value (its ref is typed HTMLElement), so it selects the attribute; web components and static HTML render the native attribute on the button value, so they take both', () => {
  const c = contract('button', { props: [AS], elementByProp: { prop: 'as', map: { button: 'button', div: 'div' } } });
  const { tsx, css } = modules(c);
  assert.match(tsx, /data-disabled=\{disabled \|\| undefined\}/);
  assert.match(css, /\.root\[data-disabled\] \{/);
  assert.doesNotMatch(css, /:disabled/);
  const wc = shadowCss(c);
  assert.ok(wc.includes("[part='root']:is(:disabled, [data-disabled]) {"), wc);
  assert.ok(wc.includes("[part='root']:hover:not(:is(:disabled, [data-disabled])) {"), wc);
  assert.match(wcElement(c), /\? ' disabled' : ' data-disabled=""'/, 'the element renders one or the other per tag');
  assert.ok(html(c).css.includes('.disabled-probe:is(:disabled, [data-disabled]) {'), html(c).css);
});

test('web components: a div internal root styles [data-disabled]; a button root keeps :disabled; the part rides the root', () => {
  const div = shadowCss(contract('div'));
  assert.ok(div.includes("[part='root'][data-disabled] {\n  background-color: var(--paint-muted);"), div);
  assert.ok(div.includes("[part='root']:hover:not([data-disabled]) {"), div);
  assert.ok(div.includes("[part='root'][data-disabled] [part='label'] {"), div);
  assert.doesNotMatch(div, /:disabled/);
  assert.match(wcElement(contract('div')), /\$\{p\.disabled \? ' data-disabled=""' : ''\}/);
  const button = shadowCss(contract('button'));
  assert.ok(button.includes("[part='root']:disabled {") && button.includes("[part='root']:hover:not(:disabled) {") && button.includes("[part='root']:disabled [part='label'] {"), button);
  assert.doesNotMatch(button, /data-disabled/);
});

test('static HTML: a div root styles [data-disabled] (the showcase renders data-disabled="true"); a button root keeps :disabled', () => {
  const div = html(contract('div'));
  assert.ok(div.css.includes('.disabled-probe[data-disabled] {') && div.css.includes('.disabled-probe:hover:not([data-disabled]) {') && div.css.includes('.disabled-probe[data-disabled] .disabled-probe__label {'), div.css);
  assert.doesNotMatch(div.css, /:disabled/);
  assert.match(div.html, /data-disabled="true"/);
  const button = html(contract('button'));
  assert.ok(button.css.includes('.disabled-probe:disabled {') && button.css.includes('.disabled-probe:hover:not(:disabled) {'), button.css);
  assert.doesNotMatch(button.css, /data-disabled/);
});

test('React inline is untouched: its disabled plane rides the prop, not a selector, on every root', () => {
  const { tsx } = emitReactInline(contract('div'), { ...ctx(contract('div')), tokens } as never);
  assert.match(tsx, /\.\.\.\(disabled \? DISABLED_STYLE : \{\}\)/);
});

test('the inverse: code → contract reads the generated [data-disabled] / :not([data-disabled]) back as the disabled and hover states, exactly as it reads :disabled on a button', () => {
  for (const element of ['div', 'button']) {
    const c = contract(element);
    const out = modules(c);
    const dir = mkdtempSync(path.join(os.tmpdir(), 'disabled-inverse-'));
    try {
      mkdirSync(path.join(dir, c.name));
      writeFileSync(path.join(dir, c.name, `${c.name}.tsx`), out.tsx);
      writeFileSync(path.join(dir, c.name, `${c.name}.module.css`), out.css);
      writeFileSync(path.join(dir, 'tokens.json'), JSON.stringify(tokens.primitives));
      const [back] = extractReactTsx(dir, [], { tokenFiles: [path.join(dir, 'tokens.json')] } as never) as Array<{ anatomy?: { root?: { states?: unknown } } }>;
      assert.deepEqual(back.anatomy?.root?.states, { hover: { 'background-color': '{paint.hover}' }, disabled: { 'background-color': '{paint.muted}' } }, element);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

test('MEASURED in Chromium: on a mounted div root the disabled paint applies, hover no longer overrides it, and the part follows; a button root behaves as before', async (t) => {
  const browser = await chromium.launch();
  try {
    for (const element of ['div', 'button'] as const) await t.test(element, async () => {
      const c = contract(element);
      const out = modules(c);
      assert.deepEqual(generatedTypeErrors(c.name, out.tsx), []);
      const page = await browser.newPage();
      try {
        const render = await mountGenerated(page, c.name, out.tsx, rootVars + out.css);
        const root = page.locator('#root > :first-child');
        const paint = () => root.evaluate((el) => ({
          background: getComputedStyle(el).backgroundColor,
          label: getComputedStyle(el.querySelector('.label') ?? el.firstElementChild!).color,
        }));
        await render({ disabled: false });
        await page.mouse.move(0, 0);
        assert.deepEqual(await paint(), { background: 'rgb(255, 255, 255)', label: 'rgb(17, 17, 17)' }, 'enabled, at rest');
        await root.hover();
        assert.equal((await paint()).background, 'rgb(0, 0, 255)', 'enabled, hovered');
        await render({ disabled: true });
        await page.mouse.move(0, 0);
        assert.deepEqual(await paint(), { background: 'rgb(204, 204, 204)', label: 'rgb(136, 136, 136)' }, 'disabled: the drawn disabled look — never rendered on a div before');
        await root.hover({ force: true });
        assert.equal((await paint()).background, 'rgb(204, 204, 204)', 'disabled and hovered: the hover guard excludes the disabled state');
      } finally { await page.close(); }
    });
  } finally { await browser.close(); }
});
