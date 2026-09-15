import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import { emitReact } from './emit-react.js';
import { emitReactInline } from './emit-react-inline.js';
import { generatedTypeErrors, mountGenerated } from './react-test-runtime.js';
import { flattenTokens, tokenInventoryFromJson } from './tokens.js';

const tokens = { primitives: { paint: {
  base: { $type: 'color', $value: '#4375ff' },
  true: { $type: 'color', $value: '#00aa00' },
  false: { $type: 'color', $value: '#ff0000' },
  soft: { true: { $type: 'color', $value: '#ffaa00' }, false: { $type: 'color', $value: '#aa00aa' } },
} }, semantic: {}, light: {}, dark: {}, brands: { default: {} } };

function fixture(nativeDisabled = false): Contract {
  const prop = nativeDisabled ? 'disabled' : 'flag';
  return ContractSchema.parse({
    id: 'probe.optional-bool-style', name: 'OptionalBoolStyleProbe', version: '1.0.0', archetype: 'none',
    description: 'Optional boolean style conformance, not source qualification.',
    semantics: { element: nativeDisabled ? 'button' : 'div' },
    props: [
      { name: prop, type: 'boolean', bindings: { code: { prop }, figma: { kind: 'BOOLEAN', property: 'Flag' } } },
      { name: 'tone', type: { enum: ['soft'] }, default: 'soft', bindings: {
        code: { prop: 'tone' }, figma: { kind: 'VARIANT', property: 'Tone', values: { soft: 'Soft' } },
      } },
    ], states: [], anatomy: { root: {
      tokens: { color: '{paint.base}', 'background-color': `{paint.{${prop}}}`, 'border-color': `{paint.{tone}.{${prop}}}` },
      literals: { 'border-width': '2px' },
      parts: { label: { element: 'span', text: 'Optional boolean',
        tokens: { color: `{paint.{${prop}}}` }, stylesWhen: [{ prop, styles: { opacity: '0.5' } }],
      } },
    } },
    bindings: { figma: { anchors: { fileKey: null, componentSetKey: null } },
      code: { anchors: { importPath: './OptionalBoolStyleProbe', export: 'OptionalBoolStyleProbe' } } },
  });
}

function emit(contract: Contract, inline: boolean) {
  const ctx = { contracts: new Map([[contract.id, contract]]), icons: new Map<string, string>() };
  if (inline) return { ...emitReactInline(contract, { ...ctx, tokens }), css: '' };
  const output = emitReact(contract, { ...ctx, tokens: tokenInventoryFromJson([tokens.primitives]) });
  const declarations = [...flattenTokens(tokens.primitives)].map(([key, token]) => `--${key.replaceAll('.', '-')}: ${token.value};`);
  return { ...output, css: `:root {${declarations.join('\n')}}\n${output.css}` };
}

test('omitted boolean token axes preserve absence separately from false across generated React styles', async t => {
  const browser = await chromium.launch();
  try {
    for (const nativeDisabled of [false, true]) {
      for (const inline of [false, true]) await t.test(`${nativeDisabled ? 'native-disabled' : 'data-flag'} / ${inline ? 'inline' : 'css-module'}`, async () => {
        const contract = fixture(nativeDisabled);
        const prop = contract.props[0].name;
        const output = emit(contract, inline);
        const page = await browser.newPage();
        try {
          const render = await mountGenerated(page, contract.name, output.tsx, output.css);
          const observe = () => page.locator('#root > :first-child').evaluate(el => {
            const label = el.firstElementChild!;
            return { background: getComputedStyle(el).backgroundColor, border: getComputedStyle(el).borderTopColor,
              label: getComputedStyle(label).color, opacity: getComputedStyle(label).opacity };
          });
          // This fixture leaves base bg/border unspecified. Preserve its
          // actual browser baseline without asserting OS-specific button UA
          // colors, while independently ruling out both declared overrides.
          const base = await observe();
          assert.ok(!['rgb(255, 0, 0)', 'rgb(0, 170, 0)'].includes(base.background), 'omission must apply neither boolean background override');
          assert.ok(!['rgb(170, 0, 170)', 'rgb(255, 170, 0)'].includes(base.border), 'omission must apply neither compound border override');
          assert.equal(base.label, 'rgb(67, 117, 255)', 'omitted nested color inherits the explicit root base');
          assert.equal(base.opacity, '1', 'a truthy stylesWhen rule must not apply to omission');
          await render({ [prop]: false });
          assert.deepEqual(await observe(), { background: 'rgb(255, 0, 0)', border: 'rgb(170, 0, 170)', label: 'rgb(255, 0, 0)', opacity: '1' });
          await render({ [prop]: true });
          assert.deepEqual(await observe(), { background: 'rgb(0, 170, 0)', border: 'rgb(255, 170, 0)', label: 'rgb(0, 170, 0)', opacity: '0.5' });
          await render({});
          assert.deepEqual(await observe(), base, 'removing an axis restores absence, including compound and nested bindings');
          assert.deepEqual(generatedTypeErrors(contract.name, output.tsx), []);
        } finally { await page.close(); }
      });
    }
  } finally { await browser.close(); }
});

test('declared boolean defaults retain the existing presence-selector CSS convention', () => {
  for (const nativeDisabled of [false, true]) {
    const contract = fixture(nativeDisabled);
    contract.props[0].default = false;
    const { css } = emit(contract, false);
    assert.match(css, nativeDisabled ? /:not\(:disabled\)/ : /:not\(\[data-flag\]\)/);
    assert.doesNotMatch(css, nativeDisabled ? /\.disabled-false/ : /\.flag-false/);
  }
});
