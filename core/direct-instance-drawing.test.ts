import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { chromium } from 'playwright-core';
import {PNG} from 'pngjs';
import { ContractSchema, walkAnatomy, type Contract } from '../scripts/contract-schema.js';
import type { DumpSet } from '../extract/figma/types.js';
import { asMinimalChildContract, proposeFromDump } from './propose-figma.js';
import { tokenCorpusFromJson } from './token-corpus.js';
import { reactEmitter, reactInlineEmitter } from './emitter.js';
import { mountGenerated } from './react-test-runtime.js';
import { validateContract } from '../packages/core/src/validate.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { emitHtml } from './emit-html.js';
import { emitWebComponent } from '../packages/emitter-web-components/src/emit-wc.js';
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
  // A foreign owner key across variants is a source identity conflict, not
  // an optional size channel. The importer must refuse the whole proposal.
  const foreign = drawingFixture(); foreign.mark(0).instanceKey = 'foreign-key';
  assert.throws(() => foreign.read(), /figma-source-instance-identity-refused:.*unlinked-or-conflicting-owner:foreign-key/);
  const noSize: Array<(f: ReturnType<typeof drawingFixture>) => void> = [
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
      return { box: [p.width, p.height], path: [r.width, r.height, r.x - p.x, r.y - p.y], color: el.querySelector('svg[viewBox] path')?getComputedStyle(el.querySelector('svg[viewBox] path')!).fill:getComputedStyle(el).backgroundColor }; });
    for (const disabled of [false, true, false]) {
      await render({ disabled });
      await page.mouse.move(500, 500);
      const rest = await probe();
      assert.deepEqual(rest.box, [16, 16]);
      assert.deepEqual(rest.path, [16, 16, 0, 0]);
      // The mask now owns the complete parent plane. Verify the ink still
      // occupies the captured 12px square at (2,2), independent of its DOM box.
      const png=PNG.sync.read(await page.locator('[class*=ink]').locator('..').screenshot());
      const pixel=(x:number,y:number)=>Array.from(png.data.subarray((y*png.width+x)*4,(y*png.width+x)*4+4));
      assert.deepEqual(pixel(1,8),[255,255,255,255]);
      assert.deepEqual(pixel(3,8),disabled?[162,174,191,255]:[181,24,51,255]);
      assert.deepEqual(pixel(15,8),[255,255,255,255]);
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

test('a parent-set BOOLEAN state selects the child State preview on its pins and names it elsewhere', async () => {
  const tokens = { primitives: { ink: { $type: 'color', $value: '#123456' }, off: { $type: 'color', $value: '#a2aebf' }, box: { $type: 'dimension', $value: '16px' } },
    semantic: {}, light: {}, dark: {}, brands: { default: {} } };
  const child = ContractSchema.parse({ id: 'check.state-leaf', name: 'StateLeaf', version: '0.1.0', status: 'draft', description: 'Previewed child',
    semantics: { element: 'span' }, states: ['disabled'],
    props: [{ name: 'disabled', type: 'boolean', default: false, bindings: { code: { prop: 'disabled' }, figma: { kind: 'BOOLEAN', property: 'Disabled' } } },
      { name: 'size', type: { enum: ['small', 'large'] }, default: 'small', bindings: { code: { prop: 'size' }, figma: { kind: 'VARIANT', property: 'Size', values: { small: 'Small', large: 'Large' } } } },
      { name: 'tone', type: { enum: ['plain', 'strong'] }, default: 'plain', bindings: { code: { prop: 'tone' }, figma: { kind: 'VARIANT', property: 'Tone', values: { plain: 'Plain', strong: 'Strong' } } } }],
    anatomy: { root: { layout: { display: 'flex' }, tokens: { width: '{box}', height: '{box}', 'background-color': '{ink}' }, states: { disabled: { 'background-color': '{off}' } } } },
    bindings: { code: { anchors: { importPath: './StateLeaf', export: 'StateLeaf' } }, figma: { statePreviews: true, anchors: { fileKey: null, componentSetKey: null } } } });
  const parent = ContractSchema.parse({ id: 'check.state-host', name: 'StateHost', version: '0.1.0', status: 'draft', description: 'Forwards disabled',
    semantics: { element: 'div' }, states: [],
    props: [{ name: 'state', type: { enum: ['default', 'disabled'] }, default: 'default', bindings: { code: { prop: 'state' }, figma: { kind: 'VARIANT', property: 'State', values: { default: 'Default', disabled: 'Disabled' } } } },
      { name: 'tone', type: { enum: ['plain', 'strong'] }, default: 'plain', bindings: { code: { prop: 'tone' }, figma: { kind: 'VARIANT', property: 'Tone', values: { plain: 'Plain', strong: 'Strong' } } } }],
    anatomy: { root: { layout: { display: 'flex' }, parts: { mark: { component: { id: child.id, props: {
      tone: { prop: 'tone', map: { plain: 'plain', strong: 'strong' } }, disabled: { prop: 'state', map: { disabled: 'true' } } } } } } } },
    bindings: { code: { anchors: { importPath: './StateHost', export: 'StateHost' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } } });
  const scope = new Map<string, Contract>([[child.id, child], [parent.id, parent]]);
  const errors: string[] = []; validateContract(parent, scope, errors, new Map()); assert.deepEqual(errors, []);
  const engine = createFigmaEngine({ tokens, icons: new Map() });
  const host = createFigmaMock({ instanceVariantSelection: true }), context = vm.createContext({ figma: host.figma, console: { log() {}, warn() {}, error() {} } });
  const run = (script: string) => vm.runInContext(`(async()=>{${script}\n})()`, context);
  await run(engine.buildTokensScript(null));
  await run(engine.buildComponentScript(child, scope));
  await run(engine.buildComponentScript(parent, scope));
  const owner = host.root.findOne(n => n.type === 'COMPONENT_SET' && n.getSharedPluginData('ds_contracts', 'contractId') === parent.id)!;
  const selected = Object.fromEntries(owner.children!.map(v => [v.name, (v.findOne(n => n.type === 'INSTANCE') as unknown as { _mainComponent: { name: string } })._mainComponent.name]));
  assert.match(selected['State=Disabled, Tone=Plain'], /State=Disabled/, JSON.stringify(selected));
  assert.match(selected['State=Disabled, Tone=Strong'], /Tone=Strong/);
  assert.doesNotMatch(selected['State=Disabled, Tone=Strong'], /State=Disabled/);
  assert.doesNotMatch(selected['State=Default, Tone=Plain'], /State=Disabled/);
  const data = engine.compileComponentData(parent, scope);
  assert.ok(JSON.stringify(data).includes('draws its State previews only at Tone=Plain'), 'the undrawn large cell is named');
});


test('native filled-path color overrides do not require a resize viewport', () => {
  const {child,parent,primitives,aliased}=stateContracts();
  const drawing=Object.values(child.anatomy.root.parts!)[0]!;
  delete drawing.shape!.parentViewport;
  drawing.literals={...drawing.literals,left:'3px',top:'3px'};
  child.anatomy.root.overridable=['color'];
  for (const {part} of walkAnatomy(parent)) if (part.component?.overrides) delete part.component.overrides.size;
  const engine=createFigmaEngine({tokens:{primitives,semantic:aliased,light:{},dark:{},brands:{default:{}}},icons:new Map()});
  const data=engine.compileComponentData(parent,new Map([[child.id,child],[parent.id,parent]]));
  const inks:any[]=[];const visit=(v:any)=>{if(!v||typeof v!=='object')return;if(v.instanceInk)inks.push(v.instanceInk);Object.values(v).forEach(visit);};visit(data);
  assert.ok(inks.length>0);assert.ok(inks.every(i=>i.writeProtocol==='attached-v1'&&i.paintKind===undefined));
  const script=engine.buildComponentScript(parent,new Map([[child.id,child],[parent.id,parent]]));
  assert.match(script,/filled-path-instance-ink-tree-mismatch/);
  assert.equal(script.includes('per-instance override \"color\"'),false);
});


test('typed vector ink follows slot fallback anatomy, caller clearing and native attached instances', async()=>{
 const f=drawingFixture();
 f.set.propertyDefinitions!.Icon={type:'INSTANCE_SWAP',defaultValue:'50:1'};
 for(let i=0;i<2;i++){const n=f.mark(i);n.propRefs={mainComponent:'Icon'};
  n.hostOverrides![0].fields.push('fontSize','letterSpacing','lineHeightPercent','lineHeightPercentFontSize','lineHeightPx','inheritFillStyleId');}
 const original=JSON.stringify([...f.scope]),result=f.read(),parent=result.contract;
 const slot=walkAnatomy(parent).find(p=>p.part.slot)?.part;assert(slot?.slot?.renderDefault);
 const fallback=Object.values(slot!.parts??{})[0]?.component;assert.equal(fallback?.id,f.child.id);assert(fallback?.overrides?.color);
 assert.equal(JSON.stringify([...f.scope]),original,'caller paint does not rewrite main/default');
 const tree={primitives:{drawing:{size:{$type:'dimension',$value:'24px'},ink:{$type:'color',$value:'#123456'}},...result.result.mintedTokens!.tree},semantic:{},light:{},dark:{},brands:{default:{}}};
 const scope=new Map([[f.child.id,f.child],[parent.id,parent]]),ctx={tokens:tree,icons:new Map<string,string>(),contracts:scope};
 assert.throws(()=>emitHtml(parent,{...ctx,tokens:new Set<string>()}),/SLOT_RUNTIME_DEFAULT_ANATOMY_UNSUPPORTED:html/);
 assert.throws(()=>emitWebComponent(parent,{...ctx,tokens:new Set<string>()}),/SLOT_RUNTIME_DEFAULT_ANATOMY_UNSUPPORTED:web-components/);
 const engine=createFigmaEngine(ctx);const data=engine.compileComponentData(parent,scope);
 const all=(n:any):any[]=>[n,...(n.children??[]).flatMap(all)];
 for(const v of data.variants){const slotSpec=all(v.spec).find(n=>n.type==='slot');assert.equal(slotSpec.slotDefault,undefined,'fallback anatomy is not duplicated as a native sample');assert.equal(slotSpec.children.length,1);assert.equal(slotSpec.children[0].instanceInk.writeProtocol,'attached-v1');}
 const script=engine.buildComponentScript(parent,scope);assert(script.indexOf('if (parent && !spec.callerSlotProperty) parent.appendChild(node)')<script.indexOf('if (spec.instanceInk || spec.instanceStrokeWeight)'));
 const host=createFigmaMock(),context=vm.createContext({figma:host.figma,console:{log(){},warn(){},error(){}}});
 (host.figma as unknown as {createVector:()=>unknown}).createVector=()=>{const node=(host.figma as unknown as {createRectangle:()=>Record<string,unknown>}).createRectangle();Object.assign(node,{type:'VECTOR',isMask:false,blendMode:'PASS_THROUGH',vectorPaths:[]});return node;};
 const run=(source:string)=>vm.runInContext(`(async()=>{${source}\n})()`,context);
 await run(engine.buildTokensScript(null));await run(engine.buildComponentScript(f.child,scope));
 const main=host.root.findOne(n=>n.getSharedPluginData('ds_contracts','contractId')===f.child.id)!;
 const snapshot=()=>JSON.stringify(main.findAll().map(n=>[n.id,n.type,n.width,n.height,n.fills??null]));const before=snapshot();
 await run(script);assert.equal(snapshot(),before,'native fallback paint preserves the main component');
 const owner=host.root.findOne(n=>n.type==='COMPONENT_SET'&&n.getSharedPluginData('ds_contracts','contractId')===parent.id)!;
 const nativeInks=owner.children!.map(v=>{const instance=v.findOne(n=>n.type==='INSTANCE')!;assert(instance, v.name);const vector=instance.findOne(n=>n.type==='VECTOR')!;assert(vector,v.name);return JSON.stringify(vector.fills);});
 assert.equal(new Set(nativeInks).size,2,'native variants carry both caller paints');
 const browser=await chromium.launch();
 try{for(const emitter of [reactEmitter,reactInlineEmitter]){const parentFiles=emitter.emit(parent,ctx),childFiles=emitter.emit(f.child,ctx),page=await browser.newPage();
  try{const render=await mountGenerated(page,parent.name,parentFiles[0].contents,parentFiles.find(x=>x.path.endsWith('.css'))?.contents,{Glyph:{tsx:childFiles[0].contents,css:childFiles.find(x=>x.path.endsWith('.css'))?.contents}});
   await page.addStyleTag({content:':root{--drawing-size:24px;--drawing-ink:#123456;'+result.result.mintedTokens!.entries.map(e=>'--'+e.ref.slice(1,-1).replaceAll('.','-')+':'+e.value).join(';')+'}'});
   const ink=()=>page.evaluate(()=>{const el=[...document.querySelectorAll('#root *')].find(el=>getComputedStyle(el).clipPath.startsWith('url(')||(el.localName==='path'&&el.closest('svg[viewBox]')));return el?(el.localName==='path'?getComputedStyle(el).fill:getComputedStyle(el).backgroundColor):null;});
   await render({size:'small'});assert.equal(await ink(),'rgb(181, 24, 51)',emitter.name);
   await render({size:'large'});assert.equal(await ink(),'rgb(14, 97, 186)',emitter.name);
   for(const children of [null,false,'',0,'Caller']){await render({children});assert.equal(await ink(),null,'explicit caller content/clearing suppresses fallback');}
   await render({size:'small'});assert.equal(await ink(),'rgb(181, 24, 51)');
   const own=await browser.newPage();try{await mountGenerated(own,f.child.name,childFiles[0].contents,childFiles.find(x=>x.path.endsWith('.css'))?.contents);await own.addStyleTag({content:':root{--drawing-size:24px;--drawing-ink:#123456}'});assert.equal(await own.evaluate(()=>((e:Element)=>e.localName==='path'?getComputedStyle(e).fill:getComputedStyle(e).backgroundColor)([...document.querySelectorAll('#root *')].find(e=>(getComputedStyle(e).clipPath.startsWith('url(')||(e.localName==='path'&&e.closest('svg[viewBox]'))))!)),'rgb(18, 52, 86)');}finally{await own.close();}
  }finally{await page.close();}
 }}finally{await browser.close();}
 for(const bad of ['opacity','vectorPaths','relativeTransform']){const clone=structuredClone(f.set);clone.variants[0].children![0].hostOverrides![0].fields.push(bad);const r=proposeFromDump(clone,{corpus,mintUnbound:true,fileKey:'fixture',contractIdByName:new Map([['Glyph',f.child.id]]),contractIdByKey:new Map([['glyph-key',f.child.id]]),contractsById:new Map([[f.child.id,asMinimalChildContract(f.child)]])});const c=ContractSchema.parse(r.contract);assert.equal(walkAnatomy(c).find(p=>p.part.slot)?.part.parts,undefined,bad);}
 const wrong=structuredClone(parent);Object.values(walkAnatomy(wrong).find(p=>p.part.slot)!.part.parts!)[0].component!.id='foreign';const errors:string[]=[];validateContract(wrong,scope,errors,new Map());assert(errors.some(e=>e.includes('SLOT_RUNTIME_DEFAULT_ANATOMY_MISMATCH')));
});

test('slot square drawing size takes precedence over captured root width and height',()=>{
 const f=drawingFixture();f.child.anatomy.root.instanceRootInputs=['width','height'];
 f.set.propertyDefinitions!.Icon={type:'INSTANCE_SWAP',defaultValue:'50:1'};
 for(let i=0;i<2;i++){
  const n=f.mark(i);n.nodeId='i-'+i;n.propRefs={mainComponent:'Icon'};
  const transform:[[number,number,number],[number,number,number]]=[[1,0,0],[0,1,0]];
  const localSize={width:n.bbox!.width,height:n.bbox!.height};
  n.instanceGeometry={nodeId:n.nodeId,componentId:'50:1',transform,localSize};
  n.instanceRootOverrides={nodeId:n.nodeId,componentId:'50:1',componentKey:'glyph-key',fields:['width','height'],localTransform:transform,localSize,mainSize:{width:24,height:24}};
 }
 const {contract}=f.read();
 const fallback=walkAnatomy(contract).find(p=>p.part.component?.id===f.child.id)!.part.component!;
 assert(fallback.overrides?.size,'retain the qualified scalable drawing channel');
 assert.equal(fallback.rootOverrides?.width,undefined);
 assert.equal(fallback.rootOverrides?.height,undefined);
});

function boundDrawingFixture(){
 const f=drawingFixture();
 for(let i=0;i<2;i++){
  const h=f.mark(i).hostOverrides![0],color={r:i===0?.5:.25,g:i===0?.25:.5,b:.75},id='native-ink-'+i,value={...color,a:1};
  h.fields=['fillStyleId','fills'];h.fill={var:'Theme/Ink'};
  h.sourceNormalFillComposition={paint:{color,opacity:1,blendMode:'NORMAL'},variableId:id};
  h.variableConsumers={[id]:{name:'Theme/Ink',collectionId:'theme',modeId:i===0?'light':'dark',modeName:i===0?'Light':'Dark',resolvedType:'COLOR',value,selectedValue:value}};
 }
 return f;
}
test('bound native host ink uses its actual consuming mode and permits fillStyleId only with complete solid paint proof',()=>{
 const f=boundDrawingFixture(),before=JSON.stringify(f.set),{result,overrides}=f.read();
 assert(overrides?.color);assert(overrides?.size);assert.equal(JSON.stringify(f.set),before);
 assert.deepEqual(result.mintedTokens!.entries.map(e=>e.value).sort(),['#8040bf','#4080bf','16px','24px'].sort(),'same variable name in two consuming modes never falls back to one global value');
});
test('bound host ink rejects missing or contradictory paint/binding evidence and unsupported drawing fields',()=>{
 for(const fault of ['consumer','name','mode','value','selected','variable','alpha','field']){
  const f=boundDrawingFixture(),h=f.mark(0).hostOverrides![0],observation=h.sourceNormalFillComposition!;
  const id='native-ink-0',consumer=h.variableConsumers![id];
  if(fault==='consumer')delete h.variableConsumers;
  if(fault==='name')consumer.name='Other/Ink';
  if(fault==='mode')consumer.modeId='';
  if(fault==='value')consumer.value={r:1,g:0,b:0,a:1};
  if(fault==='selected')consumer.selectedValue={type:'VARIABLE_ALIAS',id:'uncaptured'};
  if(fault==='variable'&&'paint'in observation)observation.variableId='other';
  if(fault==='alpha'&&'paint'in observation)observation.paint.opacity=.5;
  if(fault==='field')h.fields.push('opacity');
  assert.equal(f.read().overrides?.color,undefined,fault);
 }
 const legacy=drawingFixture();legacy.mark(0).hostOverrides![0].fields.push('fillStyleId');assert.equal(legacy.read().overrides?.color,undefined,'style metadata alone is never bound-paint proof');
});

test('bound drawing qualification works in the plugin runtime without structuredClone',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'structuredClone');
 try{Object.defineProperty(globalThis,'structuredClone',{value:undefined,configurable:true});assert(boundDrawingFixture().read().overrides?.color);}
 finally{if(descriptor)Object.defineProperty(globalThis,'structuredClone',descriptor);}
});


test('inert stroke metadata permits caller ink only with exact observed empty-stroke ownership', () => {
  const prepared = () => {
    const f = drawingFixture();
    for (let i=0;i<2;i++) {
      const n=f.mark(i), h=n.hostOverrides![0];
      n.nodeId=h.solidFillTarget!.instanceId;
      h.fields.push('strokes','strokeWeight','strokeAlign');
      h.strokeWeight=2;
      h.emptyStrokeTarget=structuredClone(h.solidFillTarget!);
    }
    return f;
  };
  const f=prepared(), main=JSON.stringify(f.child);
  assert.ok(f.read().overrides?.color);
  assert.equal(JSON.stringify(f.child),main);
  const reject:Array<(f:ReturnType<typeof prepared>)=>void>=[
    f=>{delete f.mark(0).hostOverrides![0].emptyStrokeTarget;},
    f=>{f.mark(0).hostOverrides![0].emptyStrokeTarget!.nodeId='foreign';},
    f=>{f.mark(0).hostOverrides![0].emptyStrokeTarget!.childPath=[1];},
    f=>{f.mark(0).nodeId='foreign';},
    f=>{delete f.mark(0).nodeId;},
    f=>{f.mark(0).hostOverrides![0].stroke={hex:'000000'};},
    f=>{f.mark(0).hostOverrides![0].fields.push('opacity');},
  ];
  for(const mutate of reject){const bad=prepared();mutate(bad);assert.equal(bad.read().overrides?.color,undefined,String(mutate));}
});

test('exact keyed vector census carries inherited style ink without a fills override', () => {
  const f=drawingFixture();
  for(let i=0;i<2;i++){
    const n=f.mark(i);n.nodeId='usage-'+i;n.bbox={width:24,height:24};
    n.hostOverrides=[{path:'Any display name',fields:['inheritFillStyleId']}];
    n.instanceVectorContent={source:[{nodeId:n.nodeId,componentId:'50:1',key:'glyph-key'}],
      shape:{kind:'path',width:18,height:18,x:3,y:3,right:3,bottom:3,paths:[{data:'M0 0L18 0L18 18L0 18Z',windingRule:'NONZERO'}]},paint:{hex:'d1d1d1'}};
  }
  assert(f.read().overrides?.color,'usage ink must survive through the declared override');
  f.mark(0).instanceVectorContent!.source[0].componentId='foreign-main';
  assert.equal(f.read().overrides?.color,undefined,'a different main never supplies ink');
  f.mark(0).instanceVectorContent!.source[0].componentId='50:1';
  f.mark(0).instanceVectorContent!.shape.paths![0].data='M0 0L17 0L17 18L0 18Z';
  assert.equal(f.read().overrides?.color,undefined,'a different drawing never supplies ink');
});


function sharedKeyDefinitionsFixture(){
 const definitions=['old','new'].map((tag,i)=>ContractSchema.parse({id:'test.'+tag,name:'Definition'+tag,version:'0.1.0',status:'draft',description:'Distinct captured definition',semantics:{element:'span'},props:[],states:[],anatomy:{root:{literals:{width:'16px',height:'16px','background-color':i?'#0000ff':'#ff0000'}}},bindings:{figma:{anchors:{fileKey:'capture',componentSetKey:'shared-key',nodeId:tag+'-main'}},code:{anchors:{importPath:'./Definition'+tag,export:'Definition'+tag}}}}));
 const set:DumpSet={setName:'TwoDefinitions',type:'COMPONENT',variants:[{name:'TwoDefinitions',type:'COMPONENT',layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'},children:['old','new'].map(tag=>({name:tag,type:'INSTANCE',nodeId:tag+'-instance',instanceOf:'Same source name',instanceKey:'shared-key',instanceGeometry:{nodeId:tag+'-instance',componentId:tag+'-main',transform:[[1,0,0],[0,1,0]],localSize:{width:16,height:16}}}))}]};
 const run=()=>proposeFromDump(set,{corpus,mintUnbound:true,fileKey:'capture',contractIdByName:new Map([['Same source name','test.new']]),contractIdByKey:new Map([['shared-key','test.new']]),contractsById:new Map(definitions.map(c=>[c.id,asMinimalChildContract(c)]))});
 return {definitions,set,run};
}
test('instances sharing a library key resolve their distinct captured main identities independent of registration order',async t=>{
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const reverse of [false,true]){
  const f=sharedKeyDefinitionsFixture();if(reverse)f.definitions.reverse();
  const r=ContractSchema.parse(f.run().contract);
  assert.equal(r.anatomy.root.parts?.old.component?.id,'test.old');
  assert.equal(r.anatomy.root.parts?.new.component?.id,'test.new');
  const contracts=new Map([r,...f.definitions].map(c=>[c.id,c]));
  for(const emitter of [reactEmitter,reactInlineEmitter]){
   const context={contracts,tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()},out=emitter.emit(r,context),deps=Object.fromEntries(f.definitions.map(c=>{const files=emitter.emit(c,context);return [c.name,{tsx:files[0].contents,css:files.find(x=>x.path.endsWith('.css'))?.contents??''}];}));
   const page=await browser.newPage(),render=await mountGenerated(page,r.name,out[0].contents,out.find(x=>x.path.endsWith('.css'))?.contents,deps);
   await render({});assert.deepEqual(await page.locator('#root > * > *').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).backgroundColor)),['rgb(255, 0, 0)','rgb(0, 0, 255)']);await page.close();
  }

 }
});
test('ambiguous library keys refuse missing, contradictory, foreign and duplicate main identities',()=>{
 for(const fault of ['missing','contradictory','foreign','duplicate','unknown','wrong-node']){
  const f=sharedKeyDefinitionsFixture(),n=f.set.variants[0].children![0];
  if(fault==='missing')delete n.instanceGeometry;
  if(fault==='wrong-node')n.instanceGeometry!.nodeId='other-instance';
  if(fault==='unknown')n.instanceGeometry!.componentId='other-main';
  if(fault==='contradictory')n.instanceRootOverrides={nodeId:n.nodeId!,componentId:'new-main',fields:[]};
  if(fault==='foreign')f.definitions[0].bindings.figma.anchors.fileKey='other-file';
  if(fault==='duplicate')f.definitions[1].bindings.figma.anchors.nodeId='old-main';
  assert.throws(()=>f.run(),/captured-instance-definition-unqualified/,fault);
 }
});

test('variant-dependent same-key main identities become exclusive source-presence branches',async t=>{
 const f=sharedKeyDefinitionsFixture();f.set.type='COMPONENT_SET';
 f.set.propertyDefinitions={Mode:{type:'VARIANT',defaultValue:'A',variantOptions:['A','B']}};
 const first=f.set.variants[0];first.name='Mode=A';first.variantProperties={Mode:'A'};
 const second=structuredClone(first);second.name='Mode=B';second.variantProperties={Mode:'B'};second.children![0].instanceGeometry!.componentId='new-main';
 f.set.variants.push(second);
 const result=ContractSchema.parse(f.run().contract);
 const holder=result.anatomy.root.parts!.old;
 assert.equal(Object.keys(holder.parts!).length,2);
 const browser=await chromium.launch();t.after(()=>browser.close());
 const contracts=new Map([result,...f.definitions].map(c=>[c.id,c]));
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const context={contracts,tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()};
  const files=emitter.emit(result,context),deps=Object.fromEntries(f.definitions.map(c=>{const out=emitter.emit(c,context);return [c.name,{tsx:out[0].contents,css:out.find(x=>x.path.endsWith('.css'))?.contents??''}];}));
  const page=await browser.newPage(),render=await mountGenerated(page,result.name,files[0].contents,files.find(x=>x.path.endsWith('.css'))?.contents,deps);
  for(const [mode,color]of [['a','rgb(255, 0, 0)'],['b','rgb(0, 0, 255)']]){
   await render({mode});
   assert.deepEqual(await page.locator('#root > * > :first-child > *').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).backgroundColor)),[color]);
  }
  await page.close();
 }
});


test('a failed captured definition cannot fall back to its surviving same-key sibling',()=>{
 const f=sharedKeyDefinitionsFixture();
 const run=()=>proposeFromDump(f.set,{corpus,mintUnbound:true,fileKey:'capture',
  capturedMainIdsByKey:new Map([['shared-key',new Set(['old-main','new-main'])]]),
  contractIdByName:new Map([['Same source name','test.new']]),
  contractIdByKey:new Map([['shared-key','test.new']]),
  contractsById:new Map([[f.definitions[1].id,asMinimalChildContract(f.definitions[1])]])});
 assert.throws(run,/captured-instance-definition-unqualified/);
 f.set.variants[0].children!.shift();
 assert.equal(ContractSchema.parse(run().contract).anatomy.root.parts?.new.component?.id,'test.new');
});

test('permanently hidden painted instances retain paint ownership without becoming visible',async t=>{
 const f=sharedKeyDefinitionsFixture();
 f.set.type='COMPONENT_SET';
 f.set.propertyDefinitions={Mode:{type:'VARIANT',defaultValue:'A',variantOptions:['A','B']}};
 f.set.variants[0].name='Mode=A';f.set.variants[0].variantProperties={Mode:'A'};
 const node=f.set.variants[0].children![0];
 node.hidden=true;
 node.sourceFillComposition={paint:{color:{r:1,g:1,b:1},opacity:Math.fround(0.00001),blendMode:'MULTIPLY'}};
 f.definitions[0].anatomy.root.solidFillComposition=node.sourceFillComposition.paint;
 delete f.definitions[0].anatomy.root.literals!['background-color'];
 const second=structuredClone(f.set.variants[0]);second.name='Mode=B';second.variantProperties={Mode:'B'};f.set.variants.push(second);
 const before=JSON.stringify(f.set);
 const result=ContractSchema.parse(f.run().contract);
 assert(result.anatomy.root.parts?.old.presenceByCombination?.rows.every(row=>!row.present));
 assert.deepEqual(result.anatomy.root.parts?.old.solidFillComposition,node.sourceFillComposition.paint);
 assert.equal(result.anatomy.root.parts?.old.component?.id,'test.old');
 assert.equal(JSON.stringify(f.set),before);
 const browser=await chromium.launch();t.after(()=>browser.close());
 const contracts=new Map([result,...f.definitions].map(c=>[c.id,c]));
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const context={contracts,tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()};
  const files=emitter.emit(result,context);
  const deps=Object.fromEntries(f.definitions.map(c=>{const out=emitter.emit(c,context);return [c.name,{tsx:out[0].contents,css:out.find(x=>x.path.endsWith('.css'))?.contents??''}];}));
  const page=await browser.newPage();
  const render=await mountGenerated(page,result.name,files[0].contents,files.find(x=>x.path.endsWith('.css'))?.contents,deps);
  for(const mode of ['a','b']){
   await render({mode});
   assert.deepEqual(await page.locator('#root > * > *').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).backgroundColor)),['rgb(0, 0, 255)']);
  }
  await page.close();
 }
});

test('an observed empty vector fill clears only its exact child instance and restores ink',async()=>{
 const f=drawingFixture(),n=f.mark(0),h=n.hostOverrides![0];n.nodeId=h.solidFillTarget!.instanceId;delete h.fill;h.sourceEmptyFill=true;
 f.set.propNames!.Outer='outer';f.set.propertyDefinitions!.Outer={type:'VARIANT',defaultValue:'Shown',variantOptions:['Shown','Hidden']};
 f.set.variants=f.set.variants.flatMap(v=>['Shown','Hidden'].map(outer=>({...v,name:v.name+', Outer='+outer,variantProperties:{...v.variantProperties,Outer:outer},children:outer==='Hidden'?[]:[{name:'Ancestor',type:'FRAME',fill:{hex:'444444'},layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'},children:v.children}]}))) as DumpSet['variants'];
 const {result,contract,overrides}=f.read();assert(overrides?.color);assert(result.mintedTokens!.entries.some(e=>e.value==='rgba(0, 0, 0, 0)'||e.value==='#00000000'));
 const ctx={contracts:new Map([[f.child.id,f.child],[contract.id,contract]]),tokens:{primitives:{...result.mintedTokens!.tree,drawing:{size:{$type:'dimension',$value:'24px'},ink:{$type:'color',$value:'#804000'}}},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map<string,string>()};
 const browser=await chromium.launch();try{for(const emitter of [reactEmitter,reactInlineEmitter]){
  const c=emitter.emit(f.child,ctx),p=emitter.emit(contract,ctx),page=await browser.newPage();try{
   const render=await mountGenerated(page,contract.name,p[0].contents,p.find(x=>x.path.endsWith('.css'))?.contents,{[f.child.name]:{tsx:c[0].contents,css:c.find(x=>x.path.endsWith('.css'))?.contents}});
   await page.addStyleTag({content:':root{--drawing-size:24px;--drawing-ink:#804000;'+result.mintedTokens!.entries.map(e=>'--'+e.ref.slice(1,-1).replaceAll('.','-')+':'+e.value).join(';')+'}'});
   for(const [size,ink] of [['small','rgba(0, 0, 0, 0)'],['large','rgb(14, 97, 186)'],['small','rgba(0, 0, 0, 0)']] as const){await render({size,outer:'shown'});assert(await page.locator('#root').evaluate((n,ink)=>Array.from(n.querySelectorAll('*')).some(x=>getComputedStyle(x).color===ink),ink));}
  }finally{await page.close();}
 }}finally{await browser.close();}
 h.solidFillTarget!.instanceId='foreign';assert.equal(f.read().overrides?.color,undefined);
});


test('WC preserves equivalent ordered slot fallback anatomy and refuses additional facts', async () => {
 const make=(name:string,root:unknown)=>ContractSchema.parse({id:`test.${name.toLowerCase()}`,name,version:'1.0.0',status:'draft',description:'Slot fallback compatibility',semantics:{element:'div'},props:[],states:[],anatomy:{root},bindings:{code:{anchors:{importPath:`./${name}`,export:name}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
 const child=make('FallbackChild',{parts:{label:{text:'Fallback'}}});
 const call={id:child.id};
 const parent=make('FallbackParent',{parts:{body:{slot:{name:'children',renderDefault:true,defaultContent:[call]},parts:{one:{component:call}}}}});
 const ctx={contracts:new Map([[child.id,child],[parent.id,parent]]),tokens:new Set<string>(),icons:new Map<string,string>()};
 const actual=emitWebComponent(parent,ctx);
 const legacy=structuredClone(parent);delete legacy.anatomy.root.parts!.body.parts;
 const expected=emitWebComponent(legacy,ctx);
 assert.equal(actual.element,expected.element,'existing slot rendering remains byte-identical');
 assert.equal(actual.stylesheet,expected.stylesheet,'equivalent fallback adds no styling differences');
 for(const change of [
  (p:any)=>{p.parts.one.literals={width:'20px'};},
  (p:any)=>{p.parts.one.component.text='Different';},
  (p:any)=>{p.parts.two={component:call};},
  (p:any)=>{p.parts.one.component.overrides={color:'#ff0000'};},
 ]){const altered=structuredClone(parent);change(altered.anatomy.root.parts!.body);assert.throws(()=>emitWebComponent(altered,ctx),/SLOT_RUNTIME_DEFAULT_ANATOMY_UNSUPPORTED:web-components/);}
});
