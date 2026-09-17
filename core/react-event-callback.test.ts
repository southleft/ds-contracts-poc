import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { ContractSchema } from '../scripts/contract-schema.js';
import { emitReact } from './emit-react.js';
import { emitReactInline } from './emit-react-inline.js';
import { generatedTypeErrors, mountGenerated } from './react-test-runtime.js';

function fixture(nested: boolean | 'slot' = false) {
  return ContractSchema.parse({
    id: 'probe.callback', name: 'Selection', version: '1.0.0', status: 'draft', archetype: 'none',
    description: 'Declared typed callback conformance; source behavior is not inferred.',
    semantics: nested ? { element: 'div' } : { element: 'button', role: 'checkbox', roleException: 'Declared button-backed toggle.' },
    props: [{ name: 'state', type: { enum: ['off', 'on', 'mixed'] }, default: 'off',
      bindings: { code: { prop: 'checked', values: { off: false, on: true, mixed: 'indeterminate' } },
        figma: { kind: 'VARIANT', property: 'State', values: { off: 'Off', on: 'On', mixed: 'Mixed' } } } },
      { name: 'disabled', type: 'boolean', default: false,
        bindings: { code: { prop: 'disabled' }, figma: { kind: 'BOOLEAN', property: 'Disabled' } } }],
    states: [], anatomy: { root: nested ? { parts: { control: { element: 'button', roleException: 'Declared button-backed toggle.',
      attrs: { role: 'checkbox', disabled: '{disabled}' },
      ...(nested === 'slot' ? { slot: { name: 'label' } } : { text: 'Select' }) } } } : { text: 'Select' } },
    events: [{ name: 'change', trigger: nested ? 'control' : 'root',
      toggles: { prop: 'state', between: ['off', 'on'], aria: 'checked' },
      bindings: { code: { prop: 'onCheckedChange', argument: 'next-value' } } }],
    bindings: { code: { anchors: { importPath: './Selection', export: 'Selection' } },
      figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
}

test('React callbacks carry typed next values and let a consumer update controlled root and nested toggles', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  for (const inline of [false, true]) for (const nested of [false, true, 'slot'] as const) {
    const contract = fixture(nested), contracts = new Map([[contract.id, contract]]), icons = new Map<string, string>();
    const output = inline ? { ...emitReactInline(contract, { contracts, icons,
      tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } } }), css: '' }
      : emitReact(contract, { contracts, icons, tokens: new Set<string>() });
    assert.deepEqual(generatedTypeErrors(contract.name, output.tsx + `
      const accepted = <Selection checked={false} onCheckedChange={(value: boolean | 'indeterminate') => {}}/>;
      // @ts-expect-error internal axis strings are not public callback values
      const wrong = <Selection onCheckedChange={(value: 'off' | 'on') => {}}/>;
    `), []);
    const page = await browser.newPage();
    page.setDefaultTimeout(3000);
    try {
      await mountGenerated(page, contract.name, output.tsx, output.css);
      // Consumer controls the state entirely through the generated callback.
      await page.evaluate(`window.calls=[]; const update=(checked)=>window.renderSubject({checked,label:'Select',onCheckedChange:(next)=>{window.calls.push(next);update(next)}});update('indeterminate');`);
      const control = page.locator('button');
      assert.equal(await control.textContent(), 'Select');
      assert.equal(await control.getAttribute('aria-checked'), 'mixed', JSON.stringify({ inline, nested, tsx: output.tsx }));
      await control.press('Space');
      assert.equal(await control.getAttribute('aria-checked'), 'true');
      await control.click();
      assert.equal(await control.getAttribute('aria-checked'), 'false');
      assert.deepEqual(await page.evaluate('window.calls'), [true, false]);

      // A consumer may refuse the requested update; generated code cannot override it.
      await page.evaluate(`window.calls=[];window.renderSubject({label:'Select',checked:false,onCheckedChange:(next)=>window.calls.push(next)});`);
      await control.click();
      assert.equal(await control.getAttribute('aria-checked'), 'false');
      assert.deepEqual(await page.evaluate('window.calls'), [true]);

      await page.evaluate(`window.calls=[];window.renderSubject({label:'Select',disabled:true,checked:'indeterminate',onCheckedChange:(next)=>window.calls.push(next)});`);
      await control.click({ force: true });
      await control.press('Space');
      assert.equal(await control.getAttribute('aria-checked'), 'mixed');
      assert.deepEqual(await page.evaluate('window.calls'), []);

      // Uncontrolled state still works and sends the same typed values.
      await page.evaluate(`window.calls=[];window.renderSubject({key:'uncontrolled',label:'Select',onCheckedChange:(next)=>window.calls.push(next)});`);
      await control.click(); await control.press('Space');
      assert.deepEqual(await page.evaluate('window.calls'), [true, false]);
      assert.equal(await control.getAttribute('aria-checked'), 'false');
    } finally { await page.close(); }
  }
});

test('next-value refuses missing, non-enum, unknown or degenerate toggle declarations', () => {
  for (const mutate of [
    (c: ReturnType<typeof fixture>) => { delete c.events![0].toggles; },
    (c: ReturnType<typeof fixture>) => { c.events![0].toggles!.prop = 'missing'; },
    (c: ReturnType<typeof fixture>) => { c.events![0].toggles!.prop = 'disabled'; },
    (c: ReturnType<typeof fixture>) => { c.events![0].toggles!.between = ['off', 'unknown']; },
    (c: ReturnType<typeof fixture>) => { c.events![0].toggles!.between = ['off', 'off']; },
  ]) {
    const contract = fixture(); mutate(contract);
    const parsed = ContractSchema.safeParse(contract);
    assert.equal(parsed.success, false);
    if (!parsed.success) assert.match(parsed.error.message, /next-value requires/);
    assert.throws(() => emitReact(contract, { contracts: new Map([[contract.id, contract]]), icons: new Map(), tokens: new Set() }), /REACT_EVENT_NEXT_VALUE_INVALID|Refused — .*contract violation/s);
  }
});

test('omitting callback argument preserves the existing zero-argument API', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  for (const inline of [false, true]) {
    const contract = fixture(); delete contract.events![0].bindings.code.argument;
    const contracts = new Map([[contract.id, contract]]), icons = new Map<string, string>();
    const output = inline ? { ...emitReactInline(contract, { contracts, icons,
      tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } } }), css: '' }
      : emitReact(contract, { contracts, icons, tokens: new Set<string>() });
    const page = await browser.newPage();
    try {
      await mountGenerated(page, contract.name, output.tsx, output.css);
      await page.evaluate('window.calls=[];window.renderSubject({onCheckedChange:(...args)=>window.calls.push(args)});');
      await page.locator('button').click();
      assert.deepEqual(await page.evaluate('window.calls'), [[]]);
    } finally { await page.close(); }
  }
});
