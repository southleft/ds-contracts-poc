import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { chromium } from 'playwright-core';
import { ContractSchema, walkAnatomy, type Contract } from '../scripts/contract-schema.js';
import type { DumpSet } from '../extract/figma/types.js';
import { asMinimalChildContract, proposeFromDump } from './propose-figma.js';
import { tokenCorpusFromJson } from './token-corpus.js';
import { reactEmitter, reactInlineEmitter } from './emitter.js';
import { mountGenerated } from './react-test-runtime.js';
import { validateContract } from '../packages/core/src/validate.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { createFigmaMock } from '../scripts/plugin-engine-mock-figma.mjs';

const corpus = tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} });

/** A keyed standalone SCALE/SCALE drawing (one currentColor path, recorded
 * 24 px main viewport) placed directly in a host at 16 and 24 px. */
function drawingFixture() {
  const child = ContractSchema.parse({
    id: 'check.glyph', name: 'Glyph', version: '0.1.0', status: 'draft', description: 'Standalone drawing',
    semantics: { element: 'span' }, props: [], states: [],
    anatomy: { root: { declared: { position: 'relative' }, tokens: { width: '{drawing.size}', height: '{drawing.size}', color: '{drawing.ink}' },
      overridable: ['size', 'color'], parts: { ink: { literals: { 'background-color': 'currentColor' }, declared: { position: 'absolute' },
        shape: { kind: 'path', width: 18, height: 18, paths: [{ data: 'M0 0L18 0L18 18L0 18Z', windingRule: 'NONZERO' }], parentViewport: { width: 24, height: 24, x: 3, y: 3 } } } } } },
    bindings: { figma: { anchors: { fileKey: 'fixture', componentSetKey: 'glyph-key', nodeId: '50:1' } }, code: { anchors: { importPath: './Glyph', export: 'Glyph' } } },
  });
  const boxes: Record<string, number> = { Small: 16, Large: 24 };
  const set: DumpSet = {
    setName: 'Holder', type: 'COMPONENT_SET', propNames: { Size: 'size' },
    propertyDefinitions: { Size: { type: 'VARIANT', defaultValue: 'Small', variantOptions: ['Small', 'Large'] } },
    variants: ['Small', 'Large'].map(size => ({ name: `Size=${size}`, type: 'COMPONENT', variantProperties: { Size: size },
      layout: { mode: 'HORIZONTAL', primary: 'MIN', counter: 'MIN', spacing: 0, padding: [0, 0, 0, 0], primarySizing: 'AUTO', counterSizing: 'AUTO' },
      children: [{ name: 'mark', type: 'INSTANCE', instanceOf: 'Glyph', instanceKey: 'glyph-key', bbox: { width: boxes[size], height: boxes[size] },
        hostOverrides: [{ path: 'Any display name', fields: ['fills'], fill: { hex: size === 'Small' ? 'b51833' : '0e61ba' },
          solidFillTarget: { nodeId: `I${size};50:2`, instanceId: `i-${size}`, componentId: '50:1', instancePath: [], childPath: [0] } }] }],
    })),
  };
  const scope = new Map<string, Contract>([[child.id, child]]);
  const propose = () => proposeFromDump(set, { corpus, mintUnbound: true, fileKey: 'fixture',
    contractIdByName: new Map([['Glyph', child.id]]), contractIdByKey: new Map([['glyph-key', child.id]]),
    contractsById: new Map([...scope].map(([id, c]) => [id, asMinimalChildContract(c)])) });
  const read = () => {
    const result = propose(), contract = ContractSchema.parse(result.contract);
    return { result, contract, overrides: walkAnatomy(contract).find(p => p.part.component?.id === child.id)?.part.component?.overrides };
  };
  return { child, set, scope, read, mark: (i: number) => set.variants[i].children![0] };
}

test('a direct instance of an exact SCALE drawing carries its observed square box and ink', () => {
  const f = drawingFixture(), before = JSON.stringify([...f.scope]);
  const { result, overrides } = f.read();
  assert.match(overrides?.size ?? '', /\{size\}\}$/);
  assert.match(overrides?.color ?? '', /\{size\}\}$/);
  const values = result.mintedTokens!.entries.map(e => e.value).sort();
  assert.deepEqual(values, ['#0e61ba', '#b51833', '16px', '24px'].sort());
  assert.equal(JSON.stringify([...f.scope]), before, 'the standalone main keeps its own facts');
  // Display names never identify the drawing; keys do.
  const renamed = drawingFixture();
  for (let i = 0; i < 2; i++) { renamed.mark(i).name = 'Renamed layer'; renamed.mark(i).instanceOf = 'Something else'; }
  renamed.set.variants.reverse();
  const again = renamed.read();
  assert.deepEqual(Object.keys(again.overrides ?? {}).sort(), ['color', 'size']);
  assert.deepEqual(again.result.mintedTokens!.entries.map(e => e.value).sort(), values);
});

test('size is carried only for an identity-qualified square box that diverges from the recorded main', () => {
  const noSize: Array<(f: ReturnType<typeof drawingFixture>) => void> = [
    f => { f.mark(0).instanceKey = 'foreign-key'; },
    f => { f.child.bindings.figma.anchors.fileKey = 'other-file'; },
    f => { delete f.child.bindings.figma.anchors.nodeId; },
    f => { f.child.props = [{ name: 'tone', type: { enum: ['a', 'b'] }, default: 'a', bindings: { code: { prop: 'tone' }, figma: { kind: 'VARIANT', property: 'Tone', values: { a: 'A', b: 'B' } } } }]; },
    f => { f.child.anatomy.root.parts!.second = structuredClone(f.child.anatomy.root.parts!.ink); },
    f => { delete f.child.anatomy.root.parts!.ink.shape!.parentViewport; },
    f => { f.child.anatomy.root.parts!.ink.shape!.parentViewport!.height = 23; },
    f => { f.mark(0).bbox = { width: 16, height: 15.5 }; },
    f => { delete f.mark(1).bbox; },
    f => { f.child.anatomy.root.overridable = ['color']; },
    f => { f.mark(0).children = [{ name: 'leak', type: 'VECTOR' }]; },
    f => { f.mark(0).bbox = { width: 24, height: 24 }; }, // no observed divergence
  ];
  for (const mutate of noSize) {
    const f = drawingFixture(); mutate(f);
    assert.equal(f.read().overrides?.size, undefined, String(mutate));
  }
  // Exact comparison: a float32-adjacent box is a divergence, not a match.
  const near = drawingFixture(); near.mark(1).bbox = { width: 24.000001, height: 24.000001 };
  assert.ok(near.read().result.mintedTokens!.entries.some(e => e.value === '24.000001px'));
});

test('ink is carried only for one identity-qualified fills override on the single path', () => {
  const noInk: Array<(f: ReturnType<typeof drawingFixture>) => void> = [
    f => { f.mark(0).hostOverrides![0].solidFillTarget!.componentId = 'wrong-main'; },
    f => { f.mark(0).hostOverrides![0].solidFillTarget!.instancePath = [0]; },
    f => { f.mark(0).hostOverrides![0].solidFillTarget!.childPath = [1]; },
    f => { delete f.mark(0).hostOverrides![0].solidFillTarget; },
    f => { f.mark(0).hostOverrides![0].fields.push('opacity'); },
    f => { f.mark(0).hostOverrides!.push(structuredClone(f.mark(0).hostOverrides![0])); },
    f => { delete f.mark(0).hostOverrides![0].fill!.hex; },
    f => { delete f.mark(1).hostOverrides; },
    f => { f.child.anatomy.root.parts!.ink.literals = { 'background-color': '#000000' }; },
    f => { f.child.anatomy.root.overridable = ['size']; },
  ];
  for (const mutate of noInk) {
    const f = drawingFixture(); mutate(f);
    assert.equal(f.read().overrides?.color, undefined, String(mutate));
  }
});

/** A child whose designer `state` axis was projected (§D.41): `disabled`
 * became the BOOLEAN "Disabled" prop; hover is a pseudo-class state. */
function projectedFixture() {
  const child = ContractSchema.parse({
    id: 'check.box', name: 'Box', version: '0.1.0', status: 'draft', description: 'Projected state child', semantics: { element: 'span' },
    props: [{ name: 'disabled', type: 'boolean', default: false, bindings: { code: { prop: 'disabled' }, figma: { kind: 'BOOLEAN', property: 'Disabled' } } }],
    states: ['hover', 'disabled'], anatomy: { root: { literals: { width: '10px', height: '10px', 'background-color': '#123456' },
      states: { hover: { 'background-color': '{box.hover}' }, disabled: { 'background-color': '{box.disabled}' } } } },
    bindings: { figma: { anchors: { fileKey: 'fixture', componentSetKey: 'box-key' } }, code: { anchors: { importPath: './Box', export: 'Box' } } },
  });
  const states = ['default', 'error', 'disabled', 'hover'];
  const set: DumpSet = {
    setName: 'Field', type: 'COMPONENT_SET', propNames: { Status: 'status' },
    propertyDefinitions: { Status: { type: 'VARIANT', defaultValue: 'default', variantOptions: states } },
    variants: states.map(s => ({ name: `Status=${s}`, type: 'COMPONENT', variantProperties: { Status: s },
      layout: { mode: 'HORIZONTAL', primary: 'MIN', counter: 'MIN', spacing: 0, padding: [0, 0, 0, 0], primarySizing: 'AUTO', counterSizing: 'AUTO' },
      children: [{ name: 'box', type: 'INSTANCE', instanceOf: 'Box', instanceSetKey: 'box-key', componentProperties: { state: s === 'error' ? 'default' : s } }] })),
  };
  const read = () => {
    const result = proposeFromDump(set, { corpus, mintUnbound: true, fileKey: 'fixture', stampsObservable: true,
      contractIdByName: new Map([['Box', child.id]]), contractIdByKey: new Map([['box-key', child.id]]),
      contractsById: new Map([[child.id, asMinimalChildContract(child)]]) });
    const contract = ContractSchema.parse(result.contract);
    return { result, props: walkAnatomy(contract).find(p => p.part.component?.id === child.id)?.part.component?.props };
  };
  return { child, set, read };
}

test('a host applying the child\'s projected state axis forwards disabled through the same table', () => {
  const f = projectedFixture(), { result, props } = f.read();
  assert.deepEqual(props?.disabled, { prop: 'status', map: { default: 'false', error: 'false', disabled: 'true', hover: 'false' } });
  assert.ok(result.notes.some(n => n.includes('state-forward-pseudo-class-unrepresentable') && n.includes('state=hover')));
  assert.ok(!result.notes.some(n => n.includes('applied prop "state"') && n.includes('does not map')));
  const refuse: Array<(f: ReturnType<typeof projectedFixture>) => void> = [
    f => { f.child.props.push({ name: 'mode', type: { enum: ['default', 'disabled', 'hover'] }, default: 'default', bindings: { code: { prop: 'mode' }, figma: { kind: 'VARIANT', property: 'state', values: { default: 'default', disabled: 'disabled', hover: 'hover' } } } }); },
    f => { (f.child.props[0].bindings.figma as { kind: string }).kind = 'VARIANT'; },
    f => { f.child.props[0].bindings.figma.property = 'Inactive'; },
    f => { f.child.bindings.figma.anchors.componentSetKey = 'other-key'; },
    f => { for (const v of f.set.variants) v.children![0].componentProperties = { Mode: String(v.children![0].componentProperties!.state) }; },
    f => { for (const v of f.set.variants) v.children![0].componentProperties!.Disabled = false; },
  ];
  for (const mutate of refuse) {
    const changed = projectedFixture(); mutate(changed);
    const disabled = changed.read().props?.disabled;
    assert.ok(disabled === undefined || typeof disabled === 'boolean', String(mutate));
  }
  // A value outside the closed table is not guessed.
  for (const change of [(v: DumpSet['variants'][number]) => { v.children![0].componentProperties!.state = 'selected'; },
    (v: DumpSet['variants'][number]) => { delete v.children![0].componentProperties; }]) {
    for (const index of [0, 3]) {
      const outside = projectedFixture(); change(outside.set.variants[index]);
      const read = outside.read();
      assert.equal(read.props?.disabled, undefined, `${String(change)} at ${index}`);
      assert.ok(read.result.notes.some(n => n.includes('state-forward-incomplete')), `${String(change)} at ${index}`);
    }
  }
});

/** Parent part states on a component ref may select only the child's
 * declared override variables. */
function stateContracts(channel = 'color') {
  const child = ContractSchema.parse({ ...drawingFixture().child, anatomy: { root: { ...drawingFixture().child.anatomy.root, tokens: { width: '{g.size}', height: '{g.size}', color: '{g.rest}' } } } });
  const parent = ContractSchema.parse({
    id: 'check.holder', name: 'Holder', version: '0.1.0', status: 'draft', description: 'State host', semantics: { element: 'button' },
    props: [{ name: 'disabled', type: 'boolean', default: false, bindings: { code: { prop: 'disabled' }, figma: { kind: 'BOOLEAN', property: 'Disabled' } } }],
    states: ['hover', 'disabled'],
    anatomy: { root: { layout: { display: 'flex', direction: 'row' }, parts: { mark: { component: { id: child.id, overrides: { size: '{g.small}', [channel]: '{g.base}' } },
      states: { hover: { [channel]: '{g.hover}' }, disabled: { [channel]: '{g.off}' } } } } } },
    bindings: { figma: { anchors: { fileKey: null, componentSetKey: null } }, code: { anchors: { importPath: './Holder', export: 'Holder' } } },
  });
  const values = { size: '24px', small: '16px', rest: '#000000', base: '#b51833', hover: '#7e0419', off: '#a2aebf' };
  const type = (v: string) => v.endsWith('px') ? 'dimension' : 'color';
  const semantic = { g: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { $type: type(v), $value: v }])) };
  const primitives = { raw: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { $type: type(v), $value: v }])) };
  const aliased = { g: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { $type: type(v), $value: `{raw.${k}}` }])) };
  return { child, parent, semantic, primitives, aliased };
}

test('component-ref states validate only declared channels of the child root', () => {
  const errorsOf = (f: ReturnType<typeof stateContracts>) => {
    const errors: string[] = [];
    validateContract(f.parent, new Map([[f.child.id, f.child], [f.parent.id, f.parent]]), errors, new Map());
    return errors.filter(e => e.includes('component instance'));
  };
  assert.deepEqual(errorsOf(stateContracts()), []);
  assert.ok(errorsOf(stateContracts('background-color')).some(e => e.includes('states cannot restyle it')));
  const undeclared = stateContracts(); undeclared.child.anatomy.root.overridable = ['size'];
  assert.ok(errorsOf(undeclared).some(e => e.includes('states cannot restyle it')));
  const byProp = stateContracts(); delete byProp.parent.anatomy.root.parts!.mark.states;
  byProp.parent.anatomy.root.parts!.mark.statesByProp = [{ prop: 'disabled', state: 'hover', map: { false: { 'border-color': '{g.hover}' } } }];
  assert.ok(errorsOf(byProp).some(e => e.includes('cannot restyle it')));
});

test('CSS Modules React renders the carried box and selects state ink through the child variable', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const { child, parent, semantic } = stateContracts();
  const ctx = { contracts: new Map<string, Contract>([[child.id, child], [parent.id, parent]]),
    tokens: { primitives: {}, semantic, light: {}, dark: {}, brands: { default: {} } }, icons: new Map<string, string>(), mode: 'light' as const };
  const files = reactEmitter.emit(parent, ctx), dep = reactEmitter.emit(child, ctx);
  const tokenCss = ':root{' + Object.entries(semantic.g).map(([k, v]) => `--g-${k}:${v.$value};`).join('') + '}';
  const page = await browser.newPage();
  try {
    const render = await mountGenerated(page, parent.name, files[0].contents, tokenCss + (files.find(f => f.path.endsWith('.css'))?.contents ?? ''),
      { Glyph: { tsx: dep[0].contents, css: dep.find(f => f.path.endsWith('.css'))?.contents } });
    const probe = () => page.locator('[class*=ink]').evaluate((el: Element) => { const r = el.getBoundingClientRect(), p = el.parentElement!.getBoundingClientRect();
      return { box: [p.width, p.height], path: [r.width, r.height, r.x - p.x, r.y - p.y], color: getComputedStyle(el).backgroundColor }; });
    for (const disabled of [false, true, false]) {
      await render({ disabled });
      await page.mouse.move(500, 500);
      const rest = await probe();
      assert.deepEqual(rest.box, [16, 16]);
      assert.deepEqual(rest.path, [12, 12, 2, 2]);
      assert.equal(rest.color, disabled ? 'rgb(162, 174, 191)' : 'rgb(181, 24, 51)');
      await page.locator('#root > *').first().hover();
      assert.equal((await probe()).color, disabled ? 'rgb(162, 174, 191)' : 'rgb(126, 4, 25)', `hover disabled=${disabled}`);
    }
  } finally { await page.close(); }
});

test('native state previews carry the merged child ink while the child main is unchanged', async () => {
  const { child, parent, primitives, aliased } = stateContracts();
  parent.bindings.figma.statePreviews = true;
  const scope = new Map<string, Contract>([[child.id, child], [parent.id, parent]]);
  const engine = createFigmaEngine({ tokens: { primitives, semantic: aliased, light: {}, dark: {}, brands: { default: {} } }, icons: new Map() });
  const host = createFigmaMock(), context = vm.createContext({ figma: host.figma, console: { log() {}, warn() {}, error() {} } });
  (host.figma as unknown as { createVector: () => unknown }).createVector = () => {
    const node = (host.figma as unknown as { createRectangle: () => Record<string, unknown> }).createRectangle();
    Object.assign(node, { type: 'VECTOR', isMask: false, blendMode: 'PASS_THROUGH', vectorPaths: [] });
    return node;
  };
  const run = (script: string) => vm.runInContext(`(async()=>{${script}\n})()`, context);
  await run(engine.buildTokensScript(null));
  await run(engine.buildComponentScript(child, scope));
  const main = host.root.findOne(n => n.getSharedPluginData('ds_contracts', 'contractId') === child.id)!;
  const before = JSON.stringify(main.findAll().map(n => [n.id, n.type, n.width, n.height, JSON.stringify(n.fills ?? null)]));
  await run(engine.buildComponentScript(parent, scope));
  assert.equal(JSON.stringify(main.findAll().map(n => [n.id, n.type, n.width, n.height, JSON.stringify(n.fills ?? null)])), before);
  const owner = host.root.findOne(n => n.type === 'COMPONENT_SET' && n.getSharedPluginData('ds_contracts', 'contractId') === parent.id)!;
  const inks = new Map<string, string>();
  for (const variant of owner.children!) {
    const instance = variant.findOne(n => n.type === 'INSTANCE')!;
    assert.deepEqual([instance.width, instance.height], [16, 16], variant.name);
    const paint = (instance.findOne(n => n.type === 'VECTOR')!.fills as Array<{ color?: unknown; boundVariables?: { color?: { id: string } } }>)[0];
    inks.set(variant.name, paint.boundVariables?.color?.id ?? JSON.stringify(paint.color));
  }
  const byState = (s: string) => [...inks].filter(([name]) => new RegExp(`State=${s}`, 'i').test(name)).map(([, v]) => v);
  assert.ok(byState('Default').length && byState('Hover').length, [...inks.keys()].join(', '));
  assert.notDeepEqual(byState('Hover'), byState('Default'), 'the hover preview selects the hover ink');
});

test('inline React carries the base box and ink and declares the part-state omission by name', () => {
  const { child, parent, semantic } = stateContracts();
  const ctx = { contracts: new Map<string, Contract>([[child.id, child], [parent.id, parent]]),
    tokens: { primitives: {}, semantic, light: {}, dark: {}, brands: { default: {} } }, icons: new Map<string, string>(), mode: 'light' as const };
  const tsx = reactInlineEmitter.emit(parent, ctx)[0].contents;
  assert.match(tsx, /"mark": \{\s*"width": "16px",\s*"height": "16px",\s*"color": "#b51833"/);
  assert.match(tsx, /PART-level state overrides \(Part\.states, v13\) are omitted/);
  assert.doesNotMatch(tsx, /#7e0419|#a2aebf/);
});
