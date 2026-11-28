import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { ContractSchema } from '../scripts/contract-schema.js';
import { emitReact, generateTsx } from './emit-react.js';
import { emitReactInline } from './emit-react-inline.js';
import { emitHtml } from './emit-html.js';
import { emitCodeConnectHtml } from './emit-code-connect.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { emitWebComponent } from '../packages/emitter-web-components/src/emit-wc.js';
import { generatedTypeErrors, mountGenerated } from './react-test-runtime.js';

function fixture() {
  return ContractSchema.parse({ id: 'probe.action', name: 'Action', version: '1.0.0', status: 'draft',
    description: 'Explicit native activation policy.', semantics: { element: 'button', button: {
      prop: 'phase', states: { ready: { disabled: false, busy: false }, blocked: { disabled: true, busy: false }, pending: { disabled: true, busy: true } },
    } }, props: [{ name: 'phase', type: { enum: ['ready', 'blocked', 'pending'] }, default: 'ready',
      bindings: { code: { prop: 'phase' }, figma: { kind: 'VARIANT', property: 'Phase', values: { ready: 'Ready', blocked: 'Blocked', pending: 'Pending' } } } }],
    anatomy: { root: { text: 'Save' } }, bindings: { code: { anchors: { importPath: './Action', export: 'Action' } },
      figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
}
function output(contract = fixture(), inline = false) {
  const ctx = { contracts: new Map([[contract.id, contract]]), icons: new Map<string, string>() };
  return inline ? { ...emitReactInline(contract, { ...ctx, tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } } }), css: '' }
    : emitReact(contract, { ...ctx, tokens: new Set<string>() });
}

test('declared button behavior uses native activation, survives updates and owns disabled/busy/type', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  for (const inline of [false, true]) {
    const generated = output(fixture(), inline);
    assert.deepEqual(output(fixture(), inline), generated);
    assert.deepEqual(generatedTypeErrors('Action', generated.tsx + `
      const accepted = <Action onClick={event => event.currentTarget.focus()}/>;
      // @ts-expect-error type belongs to the declaration
      const wrongType = <Action type="submit"/>;
      // @ts-expect-error disabled belongs to the declaration
      const wrongDisabled = <Action disabled={false}/>;
    `), []);
    const page = await browser.newPage();
    await mountGenerated(page, 'Action', generated.tsx, generated.css);
    await page.evaluate(`window.calls=[];window.submits=0;window.button=document.querySelector('button');
      const form=document.createElement('form');form.onsubmit=e=>{e.preventDefault();window.submits++};
      document.body.append(form);form.append(document.querySelector('#root'));`);
    for (const phase of ['ready', 'blocked', 'pending', 'ready']) {
      await page.evaluate(`window.renderSubject({phase:${JSON.stringify(phase)},type:'submit',disabled:false,role:'link','aria-busy':false,
        ref:node=>window.ref=node,onClick:e=>window.calls.push([e.type,e.currentTarget.tagName,e.nativeEvent instanceof MouseEvent])});`);
      const button = page.locator('button'), before = await page.evaluate('window.calls.length');
      assert(await page.evaluate('window.button===window.ref && window.ref===document.querySelector("button")'));
      if (phase === 'ready') { await button.focus(); assert(await button.evaluate(n => n === document.activeElement)); await button.click(); }
      else { await button.click({ force: true }); await button.evaluate((n: HTMLButtonElement) => n.click()); }
      await button.press('Space'); await button.press('Enter');
      assert.deepEqual(await page.evaluate(`window.calls.slice(${before})`), phase === 'ready' ? Array(3).fill(['click', 'BUTTON', true]) : []);
      assert.equal(await page.evaluate('window.submits'), 0);
      assert.equal(await button.getAttribute('type'), 'button');
      assert.equal(await button.isDisabled(), phase !== 'ready');
      assert.equal(await button.getAttribute('aria-busy'), phase === 'pending' ? 'true' : null);
      assert.equal(await button.getAttribute('role'), null);
    }
    for (const phase of ['missing', 'toString', '__proto__', null, 0]) {
      const error = page.waitForEvent('pageerror');
      await page.evaluate(`window.renderSubject({phase:${JSON.stringify(phase)}})`);
      assert.match((await error).message, /button-behavior-state-invalid/);
      assert.equal(await page.locator('button').count(), 0);
    }
    await page.close();
  }
});

test('invalid declarations refuse; absent declarations preserve legacy output', () => {
  for (const mutate of [
    (c: any) => { delete c.semantics.button.states.pending; },
    (c: any) => { c.semantics.button.states.extra = { disabled: false, busy: false }; },
    (c: any) => { c.semantics.button.states.pending.disabled = 'true'; },
    (c: any) => { c.semantics.button.states.pending.disabled = false; },
    (c: any) => { c.semantics.button.prop = 'missing'; },
    (c: any) => { delete c.props[0].default; },
    (c: any) => { c.props[0].default = 'missing'; },
    (c: any) => { c.semantics.element = 'div'; },
    (c: any) => { c.semantics.role = 'checkbox'; },
    (c: any) => { c.anatomy.root.attrs = { type: 'submit' }; },
    (c: any) => { c.props[0].bindings.code.prop = 'disabled'; },
    (c: any) => { c.semantics.button = null; },
    (c: any) => { c.anatomy = { left: { text: 'One' }, right: { text: 'Two' } }; },
    (c: any) => { c.props[0].type.enum = ['ready', 'ready', 'blocked']; },
    (c: any) => { c.props[0].bindings.code.prop = 'rest'; },
    (c: any) => { c.anatomy.root.parts = { content: { slot: { name: 'onClick' } } }; },
    (c: any) => { c.props.push({ ...c.props[0], name: 'duplicate' }); },
    (c: any) => { c.anatomy.root.parts = { content: { slot: { name: 'phase' } } }; },
  ]) {
    const contract = fixture(); mutate(contract);
    assert(!ContractSchema.safeParse(contract).success);
    for (const inline of [false, true]) assert.throws(() => output(contract, inline), /button|semantics/);
    assert.throws(() => generateTsx(contract, new Map([[contract.id, contract]]), new Map()), /button|semantics/);
  }
  const contract = fixture(), ctx = { contracts: new Map([[contract.id, contract]]), icons: new Map<string, string>(), tokens: new Set<string>() };
  assert.throws(() => emitHtml(contract, ctx), /button-behavior-html-unsupported/);
  assert.throws(() => emitCodeConnectHtml(contract), /button-behavior-code-connect-html-unsupported/);
  assert.throws(() => emitWebComponent(contract, ctx), /button-behavior-web-components-unsupported/);
  const engine = createFigmaEngine({ tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: ctx.icons });
  const parent = fixture(); parent.id = 'probe.parent'; parent.name = 'Parent'; parent.semantics = { element: 'div' }; parent.props = [];
  parent.anatomy = { root: { parts: { child: { component: { id: contract.id, props: { phase: 'blocked' } } } } } };
  ctx.contracts.set(parent.id, parent);
  for (const subject of [contract, parent]) {
    assert.doesNotThrow(() => engine.buildComponentScript(subject, ctx.contracts));
    assert.deepEqual(engine.compileComponentData(contract, ctx.contracts).semantics?.button, contract.semantics.button);
    assert.throws(() => emitHtml(subject, ctx), /button-behavior-html-unsupported/);
    assert.throws(() => emitWebComponent(subject, ctx), /button-behavior-web-components-unsupported/);
  }
  delete contract.semantics.button;
  assert(!output(contract).tsx.includes('button-behavior'));
});
