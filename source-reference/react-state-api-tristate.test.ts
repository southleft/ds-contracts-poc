import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { mixedStateApiEvidence } from './react-state-api-fixture.js';
import { planReactStateApi, observeReactStateApi, validateReactStateApiObservation } from './react-state-api.js';
import { projectReactStateApiContract } from './react-state-api-contract.js';
import { buildReactStateApiPreview } from './react-state-api-preview.js';
import { readReactSourceProgram } from './react-source-program.js';
import { reactOwnershipHook, reactOwnershipRead, type ReactOwnership } from './react-ownership.js';
import { reactReferenceHtml } from './react-reference.js';
import { generatedTypeErrors, mountGenerated } from '../core/react-test-runtime.js';

test('a three-state plan preserves typed keys and proposes every simultaneous input without asserting disabled behavior', () => {
  const input = mixedStateApiEvidence(), before = structuredClone(input);
  const plan = planReactStateApi(input.initial, input.behavior);
  assert.deepEqual(input, before);
  assert.equal(plan.version, 2); assert.equal(plan.cases.length, 48);
  assert.equal(plan.disabled, 'locked');
  assert(!input.behavior.observation!.rows.some(r => r.property === plan.disabled));
  assert(plan.cases.every(c => Object.hasOwn(c.changes, 'locked')));
  const mutations: Array<(value: typeof input) => void> = [
    v => { v.behavior.observation!.role = 'switch'; },
    v => { v.behavior.observation!.rows[4].initial.checked = 'false'; },
    v => { v.behavior.observation!.rows[5].steps[0].callback.calls = [[false]]; },
    v => { v.initial.draft!.compiled!.contract!.props[0].bindings.code.values!.mixed = true; },
    v => { v.behavior.observation!.rows[4].restored = false; },
  ];
  for (const mutate of mutations) { const value = structuredClone(input); mutate(value); assert.throws(() => planReactStateApi(value.initial, value.behavior), /state-api-/); }
});

type Defect = 'none' | 'mixed-transition' | 'disabled-input' | 'mixed-precedence';
async function sourceRun(defect: Defect) {
  const dir = mkdtempSync(path.join(process.cwd(), '.state-api-mixed-')), browser = await chromium.launch();
  try {
    const source = `import React from 'react';type Value=boolean|'indeterminate';
    export function Widget({chosen,seed=false,locked=false,onNotify}:{chosen?:Value;seed?:Value;locked?:boolean;onNotify?:(value:Value)=>void}){
      const [local,setLocal]=React.useState(seed);
      const current=${defect === 'mixed-precedence' ? "chosen!==undefined&&seed==='indeterminate'?seed:" : ''}chosen===undefined?local:chosen;
      return <button id="control" type="button" role="checkbox" disabled={${defect === 'disabled-input' ? 'false' : 'locked'}}
        aria-checked={current==='indeterminate'?'mixed':current} onClick={()=>{
          const next=${defect === 'mixed-transition' ? "current==='indeterminate'?false:" : ''}current!==true;
          if(chosen===undefined)setLocal(next);onNotify?.(next);
        }}>Choose</button>;
    }`;
    writeFileSync(path.join(dir, 'widget.tsx'), source);
    writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
      strict: true, skipLibCheck: true, jsx: 'react-jsx', target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler' } }));
    const program = readReactSourceProgram(dir, ['widget.tsx']); assert.deepEqual(program.problems, []);
    const component = program.components[0], identity = { module: component.module, exportName: component.exportName,
      sourceSha256: component.sourceSha256, span: component.span };
    const bundle = await build({ stdin: { contents: source + `;import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
      window.__DSC_REACT_CLONE_ELEMENT=React.cloneElement;window.__DSC_REACT_EXPORTS=[{identity:${JSON.stringify(identity)},value:Widget}];
      flushSync(()=>createRoot(document.getElementById('mount')).render(<main><label htmlFor="control">Preference</label><Widget seed={false}/></main>));`,
      resolveDir: dir, loader: 'tsx' }, bundle: true, write: false, format: 'iife' });
    const context = await browser.newContext(); await context.addInitScript(reactOwnershipHook);
    const page = await context.newPage(); await page.setContent('<div id="mount"></div>'); await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const ownership = await page.evaluate(reactOwnershipRead('#control')) as ReactOwnership; assert.deepEqual(ownership.problems, []);
    const input = mixedStateApiEvidence(); input.initial.observation!.source = identity; input.behavior.observation!.target!.source = identity;
    const plan = planReactStateApi(input.initial, input.behavior), original = await page.locator('#mount').innerHTML(); let restorations = 0;
    const result = await observeReactStateApi({ page, selector: '#control', program, ownership, plan, assertCurrent: () => {}, assertRestored: async () => {
      assert.equal(await page.locator('#mount').innerHTML(), original);
      assert.deepEqual(await page.evaluate(reactOwnershipRead('#control')), ownership);
      assert.equal(await page.evaluate(() => (window as any).__DSC_REACT_OWNERSHIP.propertyProbes.size), 0); restorations++;
    } });
    assert.equal(await page.locator('#mount').innerHTML(), original);
    return { input, plan, result, restorations };
  } finally { await browser.close(); rmSync(dir, { recursive: true, force: true }); }
}

test('three-state source and emitted React agree across all 96 activation trials and the preview retains mixed values', async () => {
  const { input, plan, result, restorations } = await sourceRun('none');
  assert.deepEqual(result.problems, []); assert.equal(result.rows.length, 96); assert.equal(restorations, 144);
  validateReactStateApiObservation(result, plan);
  const draft = projectReactStateApiContract(input.initial, { id: 'observed', caseId: plan.caseId, phase: 'complete',
    qualification: plan.qualification, plan, sourceUnchanged: true, restorationChecks: restorations, observation: result, problems: [] });
  assert.deepEqual(draft.problems, []); assert.deepEqual(generatedTypeErrors(draft.contract!.name, draft.tsx!), []);
  assert.deepEqual(draft.contract!.props[0].bindings.code.values, { off: false, on: true, mixed: 'indeterminate' });
  assert.deepEqual(draft.contract!.events![0].toggles!.between, ['off', 'on']);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(); await mountGenerated(page, draft.contract!.name, draft.tsx!);
    await page.locator('body').evaluate(body => { const label = document.createElement('label'); label.htmlFor = 'control'; label.textContent = 'Preference'; body.prepend(label); });
    const control = page.getByRole('checkbox');
    for (const item of plan.cases) for (const action of ['space', 'associated-label']) {
      const props = Object.fromEntries(Object.entries(item.changes).filter(([, c]) => c.kind === 'set').map(([key, c]) => [key, c.kind === 'set' ? c.value : undefined]));
      await page.evaluate(`window.calls=[];window.renderSubject({...${JSON.stringify(props)},key:${JSON.stringify(item.id + action)},id:'control',onNotify:function(value){window.calls.push([value])}})`);
      const expected = result.rows.find(r => r.id === item.id && r.action === action)!;
      assert.equal(await control.getAttribute('aria-checked'), expected.initial.checked); assert.equal(await control.isDisabled(), expected.initial.disabled);
      for (const step of expected.steps) {
        if (action === 'space') { await control.focus(); await page.keyboard.press('Space'); }
        else await page.getByText('Preference', { exact: true }).click({ force: expected.initial.disabled });
        assert.equal(await control.getAttribute('aria-checked'), step.control.checked);
        assert.deepEqual(await page.evaluate(() => (window as any).calls), step.callback.calls);
      }
    }
    await page.setContent(reactReferenceHtml(await buildReactStateApiPreview(process.cwd(), draft)));
    const preview = page.getByRole('checkbox', { name: 'State', exact: true });
    await page.getByLabel('Initial value', { exact: true }).selectOption('indeterminate');
    await page.getByRole('button', { name: 'Remount and clear callbacks' }).click();
    assert.equal(await preview.getAttribute('aria-checked'), 'mixed'); await preview.press('Space');
    assert.equal(await preview.getAttribute('aria-checked'), 'true');
    await page.getByLabel('Controlled value', { exact: true }).selectOption('indeterminate'); await preview.press('Space');
    assert.equal(await preview.getAttribute('aria-checked'), 'mixed');
    assert.deepEqual(await page.getByLabel('Disabled value', { exact: true }).locator('option').allTextContents(), ['Omitted', 'false', 'true']);
  } finally { await browser.close(); }
});

test('wrong mixed activation, ignored disabled input and wrong simultaneous precedence refuse with restoration', async () => {
  for (const defect of ['mixed-transition', 'disabled-input', 'mixed-precedence'] as const) {
    const { result } = await sourceRun(defect);
    assert.deepEqual(result.problems, [defect === 'mixed-transition' ? 'state-api-transition-unverified' : 'state-api-live-input-response-unverified']);
    assert(result.rows.length < 96);
  }
});
