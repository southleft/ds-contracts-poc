/**
 * docs/23 §D.164 — a parent-selected child interaction state reaches the
 * child's code-side preview input (bindings.code.statePreviews), is refused by
 * name where it cannot, and leaves every other contract byte-identical.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { chromium } from 'playwright-core';
import { ContractSchema, walkAnatomy, type Contract } from '../scripts/contract-schema.js';
import type { DumpSet } from '../extract/figma/types.js';
import { asMinimalChildContract, proposeFromDump } from './propose-figma.js';
import { tokenCorpusFromJson } from './token-corpus.js';
import { htmlEmitter, reactEmitter, reactInlineEmitter } from './emitter.js';
import { mountGenerated } from './react-test-runtime.js';
import { validateContract } from '../packages/core/src/validate.js';
import { generateCss } from '../packages/core/src/css.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { createFigmaMock } from '../scripts/plugin-engine-mock-figma.mjs';
import { emitWebComponent } from '../packages/emitter-web-components/src/emit-wc.js';
import { tokenInventoryFromJson } from '../packages/core/src/tokens.js';

const corpus = tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} });
const tokens = {
  primitives: { ink: { $type: 'color', $value: '#123456' }, hot: { $type: 'color', $value: '#aa2200' }, off: { $type: 'color', $value: '#a2aebf' }, box: { $type: 'dimension', $value: '16px' } },
  semantic: {}, light: {}, dark: {}, brands: { default: {} },
};

function contracts(opts: { childOptIn?: boolean; preview?: unknown } = {}) {
  const child = ContractSchema.parse({ id: 'check.glow', name: 'Glow', version: '0.1.0', status: 'draft', description: 'Previewable child',
    semantics: { element: 'span' }, states: ['hover', 'disabled'],
    props: [{ name: 'disabled', type: 'boolean', default: false, bindings: { code: { prop: 'disabled' }, figma: { kind: 'BOOLEAN', property: 'Disabled' } } }],
    anatomy: { root: { layout: { display: 'flex' }, tokens: { width: '{box}', height: '{box}', 'background-color': '{ink}' },
      states: { hover: { 'background-color': '{hot}' }, disabled: { 'background-color': '{off}' } } } },
    bindings: { code: { anchors: { importPath: './Glow', export: 'Glow' }, ...(opts.childOptIn === false ? {} : { statePreviews: true }) },
      figma: { statePreviews: true, anchors: { fileKey: null, componentSetKey: null } } } });
  const parent = ContractSchema.parse({ id: 'check.glow-host', name: 'GlowHost', version: '0.1.0', status: 'draft', description: 'Selects the drawn child state',
    semantics: { element: 'div' }, states: [],
    props: [{ name: 'state', type: { enum: ['default', 'hover', 'disabled'] }, default: 'default',
      bindings: { code: { prop: 'state' }, figma: { kind: 'VARIANT', property: 'State', values: { default: 'Default', hover: 'Hover', disabled: 'Disabled' } } } }],
    anatomy: { root: { layout: { display: 'flex' }, parts: { mark: { component: { id: child.id,
      props: { disabled: { prop: 'state', map: { disabled: 'true' } } },
      statePreview: opts.preview ?? { prop: 'state', map: { hover: 'hover' } } } } } } },
    bindings: { code: { anchors: { importPath: './GlowHost', export: 'GlowHost' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } } });
  return { child, parent, scope: new Map<string, Contract>([[child.id, child], [parent.id, parent]]) };
}

const errorsOf = (c: Contract, scope: Map<string, Contract>) => { const errors: string[] = []; validateContract(c, scope, errors, new Map()); return errors; };

test('validation admits a declared forced state and refuses every unsound one by name', () => {
  const ok = contracts();
  assert.deepEqual(errorsOf(ok.parent, ok.scope), []);
  assert.deepEqual(errorsOf(ok.child, ok.scope), []);
  const cases: Array<[ReturnType<typeof contracts>, RegExp]> = [
    [contracts({ childOptIn: false }), /needs check\.glow to declare bindings\.code\.statePreviews/],
    [contracts({ preview: 'focus-visible' }), /statePreview "focus-visible" is not a state check\.glow declares/],
    [contracts({ preview: { prop: 'tone', map: { hover: 'hover' } } }), /statePreview maps "tone" but no enum prop/],
    [contracts({ preview: { prop: 'state', map: { pressed: 'hover' } } }), /value "pressed", which is not one of its values/],
  ];
  for (const [c, pattern] of cases) assert.ok(errorsOf(c.parent, c.scope).some(e => pattern.test(e)), String(pattern));
  const noState = contracts(); noState.child.states = ['disabled'];
  assert.ok(errorsOf(noState.child, noState.scope).some(e => /declares none of hover, active, focus-visible/.test(e)));
  const taken = contracts(); taken.child.props.push({ name: 'preview', type: 'text', bindings: { code: { prop: 'statePreview' }, figma: { kind: 'NONE' } } } as never);
  assert.ok(errorsOf(taken.child, taken.scope).some(e => /reserves the code prop "statePreview"/.test(e)));
});

test('the module sheet keeps every rule and its specificity; only opted-in contracts change', () => {
  const { child } = contracts();
  const plain = contracts({ childOptIn: false }).child;
  const inventory = tokenInventoryFromJson([tokens.primitives]), errors: string[] = [];
  const on = generateCss(child, inventory, errors, tokens), off = generateCss(plain, inventory, errors, tokens);
  assert.deepEqual(errors, []);
  assert.match(on, /\.root:is\(:hover, \[data-state-preview=["']hover["']\]\):not\(\[data-disabled\]\)/);
  assert.doesNotMatch(off, /data-state-preview/);
  assert.equal(on.replace(/:is\(:hover, \[data-state-preview=["']hover["']\]\)/g, ':hover'), off);
});

test('CSS Modules React: the parent value shows the drawn hover; live hover still runs; other values force nothing', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const { child, parent, scope } = contracts();
  const ctx = { contracts: scope, tokens, icons: new Map<string, string>(), mode: 'light' as const };
  const files = reactEmitter.emit(parent, ctx), dep = reactEmitter.emit(child, ctx);
  assert.match(files[0].contents, /statePreview=\{state === "hover" \? "hover" : undefined\}/);
  assert.match(dep[0].contents, /statePreview\?: 'hover';/);
  const tokenCss = ':root{--ink:#123456;--hot:#aa2200;--off:#a2aebf;--box:16px}';
  const page = await browser.newPage();
  try {
    const render = await mountGenerated(page, parent.name, files[0].contents, tokenCss + (files.find(f => f.path.endsWith('.css'))?.contents ?? ''),
      { Glow: { tsx: dep[0].contents, css: dep.find(f => f.path.endsWith('.css'))?.contents } });
    const glow = () => page.locator('#root > * > *').first().evaluate((el: Element) => [getComputedStyle(el).backgroundColor, el.getAttribute('data-state-preview')]);
    await page.mouse.move(500, 500);
    for (const [state, expected] of [['default', ['rgb(18, 52, 86)', null]], ['hover', ['rgb(170, 34, 0)', 'hover']], ['disabled', ['rgb(162, 174, 191)', null]]] as const) {
      await render({ state });
      assert.deepEqual(await glow(), expected, state);
    }
    await render({ state: 'default' });
    await page.locator('#root > * > *').first().hover();
    assert.deepEqual(await glow(), ['rgb(170, 34, 0)', null], 'the live pseudo-class still runs');
  } finally { await page.close(); }
});

test('HTML renders the forced state; inline React names it; Web Components refuse it by name', () => {
  const { parent, scope } = contracts();
  const text = htmlEmitter.emit(parent, { contracts: scope, tokens, icons: new Map<string, string>(), mode: 'light' as const }).map(f => f.contents).join('\n');
  assert.match(text, /data-state-preview="hover"/);
  assert.match(text, /:is\(:hover, \[data-state-preview=["']hover["']\]\)/);
  const inline = reactInlineEmitter.emit(parent, { contracts: scope, tokens, icons: new Map<string, string>(), mode: 'light' as const })[0].contents;
  assert.match(inline, /component statePreview on mark \(docs\/23 §D\.164\)/);
  assert.throws(() => emitWebComponent(parent, { contracts: scope, tokens: tokenInventoryFromJson([tokens.primitives]), icons: new Map() }), /WEB_COMPONENT_STATE_PREVIEW_UNSUPPORTED/);
});

test('the canvas selects the child State preview for the forced state and names it where none is drawn', async () => {
  const { child, parent, scope } = contracts();
  const engine = createFigmaEngine({ tokens, icons: new Map() });
  const host = createFigmaMock({ instanceVariantSelection: true }), context = vm.createContext({ figma: host.figma, console: { log() {}, warn() {}, error() {} } });
  const run = (script: string) => vm.runInContext(`(async()=>{${script}\n})()`, context);
  await run(engine.buildTokensScript(null));
  await run(engine.buildComponentScript(child, scope));
  await run(engine.buildComponentScript(parent, scope));
  const owner = host.root.findOne(n => n.type === 'COMPONENT_SET' && n.getSharedPluginData('ds_contracts', 'contractId') === parent.id)!;
  const selected = Object.fromEntries(owner.children!.map(v => [v.name, (v.findOne(n => n.type === 'INSTANCE') as unknown as { _mainComponent: { name: string } })._mainComponent.name]));
  assert.match(selected['State=Hover'], /State=Hover/, JSON.stringify(selected));
  assert.match(selected['State=Disabled'], /State=Disabled/);
  assert.doesNotMatch(selected['State=Default'], /State=(Hover|Disabled)/);
  const unpreviewed = contracts(); delete (unpreviewed.child.bindings.figma as { statePreviews?: boolean }).statePreviews;
  const data = createFigmaEngine({ tokens, icons: new Map() }).compileComponentData(unpreviewed.parent, unpreviewed.scope);
  assert.ok(JSON.stringify(data).includes(`draws no State previews on the canvas`), 'the undrawn forced state is named');
});

/** A host drawing its child's projected Hover cell (the CBDS Checkbox shape). */
function projectedDump(childOptIn: boolean, hoverOn: (s: string, i: number) => boolean = s => s === 'hover') {
  const child = ContractSchema.parse({
    id: 'check.box', name: 'Box', version: '0.1.0', status: 'draft', description: 'Projected state child', semantics: { element: 'span' },
    props: [{ name: 'disabled', type: 'boolean', default: false, bindings: { code: { prop: 'disabled' }, figma: { kind: 'BOOLEAN', property: 'Disabled' } } }],
    states: ['hover', 'disabled'], anatomy: { root: { literals: { width: '10px', height: '10px', 'background-color': '#123456' },
      states: { hover: { 'background-color': '{box.hover}' }, disabled: { 'background-color': '{box.disabled}' } } } },
    bindings: { figma: { anchors: { fileKey: 'fixture', componentSetKey: 'box-key' } },
      code: { anchors: { importPath: './Box', export: 'Box' }, ...(childOptIn ? { statePreviews: true } : {}) } },
  });
  const states = ['default', 'error', 'disabled', 'hover'];
  const set: DumpSet = {
    setName: 'Field', type: 'COMPONENT_SET', propNames: { Status: 'status' },
    propertyDefinitions: { Status: { type: 'VARIANT', defaultValue: 'default', variantOptions: states } },
    variants: states.map((s, i) => ({ name: `Status=${s}`, type: 'COMPONENT', variantProperties: { Status: s },
      layout: { mode: 'HORIZONTAL', primary: 'MIN', counter: 'MIN', spacing: 0, padding: [0, 0, 0, 0], primarySizing: 'AUTO', counterSizing: 'AUTO' },
      children: [{ name: 'box', type: 'INSTANCE', instanceOf: 'Box', instanceSetKey: 'box-key',
        componentProperties: { state: s === 'hover' ? (hoverOn(s, i) ? 'hover' : 'default') : s === 'error' ? (hoverOn(s, i) ? 'hover' : 'default') : s } }] })),
  };
  const result = proposeFromDump(set, { corpus, mintUnbound: true, fileKey: 'fixture', stampsObservable: true,
    contractIdByName: new Map([['Box', child.id]]), contractIdByKey: new Map([['box-key', child.id]]),
    contractsById: new Map([[child.id, asMinimalChildContract(child)]]) });
  const contract = ContractSchema.parse(result.contract);
  return { result, ref: walkAnatomy(contract).find(p => p.part.component?.id === child.id)?.part.component };
}

test('the proposer forwards the drawn hover cell to an opted-in child and names it otherwise', () => {
  const on = projectedDump(true);
  assert.deepEqual(on.ref?.statePreview, { prop: 'status', map: { hover: 'hover' } });
  assert.deepEqual(on.ref?.props?.disabled, { prop: 'status', map: { default: 'false', error: 'false', disabled: 'true', hover: 'false' } });
  assert.ok(!on.result.notes.some(n => n.includes('state-forward-pseudo-class-unrepresentable')));
  assert.ok(on.result.notes.some(n => n.includes('carried as a per-value statePreview')));
  const off = projectedDump(false);
  assert.equal(off.ref?.statePreview, undefined);
  assert.ok(off.result.notes.some(n => n.includes('state-forward-pseudo-class-unrepresentable')));
  // Two parent values drawing hover are still one axis function.
  const both = projectedDump(true, s => s === 'hover' || s === 'error');
  assert.deepEqual(both.ref?.statePreview, { prop: 'status', map: { error: 'hover', hover: 'hover' } });
});
