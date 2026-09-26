import test from 'node:test';
import { stateApiEvidence } from './react-state-api-fixture.js';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { readReactSourceProgram } from './react-source-program.js';
import { reactOwnershipHook, reactOwnershipRead, type ReactOwnership } from './react-ownership.js';
import { planReactStateApi, observeReactStateApi } from './react-state-api.js';



test('the state API plan names its distinct scope without upgrading the failed broad observation', () => {
  const input = stateApiEvidence(), before = structuredClone(input);
  const plan = planReactStateApi(input.initial, input.behavior);
  assert.deepEqual([plan.controlled, plan.initial, plan.disabled, plan.callback], ['chosen', 'seed', 'locked', 'notify']);
  assert.equal(plan.defaultValue, false);
  assert.equal(plan.cases.length, 27);
  assert.deepEqual(plan.excludedInputs, ['vanish']);
  assert(plan.cases.every(c => c.changes.vanish.kind === 'omit'));
  assert.deepEqual(input, before);
  assert.equal(input.behavior.phase, 'failed');
});

test('a state API plan rejects bad relationships, restoration, selected refusals and unproved omitted values', () => {
  const mutations: Array<(value: ReturnType<typeof stateApiEvidence>) => void> = [
    x => { x.behavior.sourceUnchanged = false; },
    x => { x.behavior.observation!.rows[0].steps[0].callback.calls = [[false]]; },
    x => { x.behavior.observation!.rows[0].restored = false; },
    x => { x.behavior.observation!.rows[0].initial.inert = true; },
    x => { x.behavior.observation!.rows[0].live.inert = true; },
    x => { x.behavior.observation!.rows[0].steps[0].control.inert = true; },
    x => { x.behavior.observation!.rows.find(r => r.property === 'locked')!.initial.inert = true; },
    x => { x.behavior.observation!.rows.splice(0, 1); },
    x => { x.behavior.observation!.problems.push('callback-original-render-not-restored'); },
    x => { x.behavior.observation!.refusals![0].property = 'chosen'; },
    x => { x.behavior.observation!.target!.source = { ...x.behavior.observation!.target!.source, sourceSha256: 'b'.repeat(64) }; },
    x => { x.initial.observation!.rows[0].image = 'different'; },
    x => { x.behavior.observation!.rows.find(r => r.property === 'locked' && r.value === true)!.steps[0].callback.calls = [[true]]; },
    x => { x.behavior.observation!.candidates[0].stateProperties.push('chosen'); },
    x => { (x.behavior.observation as any).role = 'radio'; },
  ];
  for (const mutate of mutations) { const input = stateApiEvidence(); mutate(input); assert.throws(() => planReactStateApi(input.initial, input.behavior), /state-api-/); }
});

async function runSource(options: { wrongPrecedence?: boolean; failRestoration?: boolean; duplicateCase?: boolean } = {}) {
  const dir = mkdtempSync(path.join(process.cwd(), '.state-api-fixture-'));
  const browser = await chromium.launch();
  try {
    const source = `import React from 'react';
    export function Widget({chosen,seed=false,locked=false,vanish=false,notify}:{chosen?:boolean;seed?:boolean;locked?:boolean;vanish?:boolean;notify?:(value:boolean)=>void}){
      const [local,setLocal]=React.useState(seed);
      const current=${options.wrongPrecedence ? 'chosen!==undefined&&seed===true?seed:' : ''}chosen===undefined?local:chosen;
      if(vanish)return null;
      return <button id="control" type="button" role="switch" disabled={locked} aria-checked={current} onClick={()=>{const next=!current;if(chosen===undefined)setLocal(next);notify?.(next);}}>Choose</button>;
    }`;
    writeFileSync(path.join(dir, 'widget.tsx'), source);
    writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, skipLibCheck: true, jsx: 'react-jsx', target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler' } }));
    const program = readReactSourceProgram(dir, ['widget.tsx']);
    assert.deepEqual(program.problems, []);
    const component = program.components[0], identity = { module: component.module, exportName: component.exportName, sourceSha256: component.sourceSha256, span: component.span };
    const bundle = await build({ stdin: { contents: source + `;import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';window.__DSC_REACT_CLONE_ELEMENT=React.cloneElement;window.__DSC_REACT_EXPORTS=[{identity:${JSON.stringify(identity)},value:Widget}];flushSync(()=>createRoot(document.getElementById('mount')).render(<main><label htmlFor="control">Preference</label><Widget seed={false}/></main>));`, resolveDir: dir, loader: 'tsx' }, bundle: true, write: false, format: 'iife' });
    const context = await browser.newContext(); await context.addInitScript(reactOwnershipHook);
    const page = await context.newPage(); await page.setContent('<div id="mount"></div>');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const ownership = await page.evaluate(reactOwnershipRead('#control')) as ReactOwnership;
    assert.deepEqual(ownership.problems, []);
    const input = stateApiEvidence();
    input.initial.observation!.source = identity;
    input.behavior.observation!.target!.source = identity;
    const plan = planReactStateApi(input.initial, input.behavior);
    if (options.duplicateCase) plan.cases[1] = structuredClone(plan.cases[0]);
    const original = await page.locator('#mount').innerHTML(); let restorations = 0;
    const result = await observeReactStateApi({ page, selector: '#control', program, ownership, plan, assertCurrent: () => {},
      assertRestored: async () => {
        assert.equal(await page.locator('#mount').innerHTML(), original);
        assert.deepEqual(await page.evaluate(reactOwnershipRead('#control')), ownership);
        assert.equal(await page.evaluate(() => (window as any).__DSC_REACT_OWNERSHIP.propertyProbes.size), 0);
        restorations++; if (options.failRestoration) throw Error('host-restoration-failed');
      } });
    return { result, restorations };
  } finally { await browser.close(); rmSync(dir, { recursive: true, force: true }); }
}

test('the actual source executes all simultaneous input contexts, live updates and both real activation paths', async () => {
  const { result, restorations } = await runSource();
  assert.deepEqual(result.problems, []);
  assert.equal(result.rows.length, 54); assert.equal(restorations, 81);
  assert.equal(result.rows.filter(r => r.initial.disabled).length, 18);
  assert(result.rows.filter(r => r.initial.disabled).every(r => r.steps.every(s => !s.callback.calls.length)));
});

test('a component that works for isolated inputs but chooses the wrong simultaneous input is refused', async () => {
  const { result } = await runSource({ wrongPrecedence: true });
  assert.deepEqual(result.problems, ['state-api-live-input-response-unverified']);
  assert(result.rows.length < 54);
});

test('restoration and changed matrix failures stop before later trials', async () => {
  const failed = await runSource({ failRestoration: true });
  assert.deepEqual(failed.result.problems, ['host-restoration-failed']);
  assert.equal(failed.restorations, 1); assert.deepEqual(failed.result.rows, []);
  const changed = await runSource({ duplicateCase: true });
  assert.deepEqual(changed.result.problems, ['state-api-plan-domain-invalid']);
  assert.equal(changed.restorations, 0); assert.deepEqual(changed.result.rows, []);
});
