import {mintedTokenCss} from './mint-tokens.js';
import {webComponentsEmitter} from '../packages/emitter-web-components/src/index.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { chromium } from 'playwright-core';
import { ContractSchema, componentRefsOf, walkAnatomy, type Contract } from '../scripts/contract-schema.js';
import type { DumpSet, DumpNode } from '../extract/figma/types.js';
import { asMinimalChildContract, proposeFromDump, proposeBatchFromDump } from './propose-figma.js';
import { tokenCorpusFromJson } from './token-corpus.js';
import { htmlEmitter, reactEmitter, reactInlineEmitter } from './emitter.js';
import { generatedTypeErrors, mountGenerated } from './react-test-runtime.js';
import { allocateFigmaPropertyNames } from './figma-names.js';
import { validateExactVariantProjection } from './exact-projection.js';
import { lowerUnsetProposal } from './figma-unset.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { createFigmaMock } from '../scripts/plugin-engine-mock-figma.mjs';

const corpus = tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} });

function fixedContentFixture(slotName = 'children') {
  const { set, child } = fixture(false);
  child.anatomy.root = { layout: { display: 'flex', direction: 'column' }, literals: { width: '180px' }, parts: {
    region: { layout: { display: 'flex', direction: 'column' }, parts: {
      well: { slot: { name: slotName, bindings: { figma: { property: 'Payload' } }, defaultContent: [{ id: 'check.sample' }] } },
    } },
  } };
  const content = (id: string, name: string, text: string, key: string, nodeId: string) => ContractSchema.parse({
    ...child, id, name, props: [], anatomy: { root: { text } },
    bindings: { code: { anchors: { importPath: `./${name}`, export: name } },
      figma: { anchors: { fileKey: 'fixture', componentSetKey: key, nodeId } } },
  });
  const target = content('check.selected', 'Selected', 'Selected content', 'selected-key', '40:1');
  const sample = content('check.sample', 'Sample', 'Sample only', 'sample-key', '40:2');
  for (const variant of set.variants) variant.children![0].fixedSwaps = { Payload: { id: '40:1', key: 'selected-key', name: 'Old selected name' } };
  const scope = new Map([child, target, sample].map(c => [c.id, c]));
  const propose = () => proposeFromDump(set, { corpus, mintUnbound: true, fileKey: 'fixture',
    contractIdByName: new Map([['Indicator', child.id]]),
    contractIdByKey: new Map([['indicator-key', child.id], ['selected-key', target.id], ['sample-key', sample.id]]),
    contractsById: new Map([...scope].map(([id, c]) => [id, asMinimalChildContract(c)])) });
  return { set, child, target, sample, scope, propose };
}

test('fixed swaps become caller-owned default-slot content without changing samples or using names', () => {
  const f = fixedContentFixture(), before = JSON.stringify([...f.scope]);
  const result = f.propose(), contract = ContractSchema.parse(result.contract);
  const host = walkAnatomy(contract).find(p => p.part.component?.id === f.child.id)!.part;
  assert.deepEqual(host.parts, { selectedContent: { component: { id: f.target.id } } });
  assert(componentRefsOf(contract).some(p => p.ref.id === f.target.id));
  assert.equal(JSON.stringify([...f.scope]), before);
  assert(!result.notes.some(n => n.includes('Payload') && n.includes('NAMED, not carried')));
  f.set.variants.reverse();
  for (const variant of f.set.variants) variant.children![0].fixedSwaps!.Payload.name = 'Renamed again';
  const reversed = ContractSchema.parse(f.propose().contract);
  assert.deepEqual(walkAnatomy(reversed).find(p => p.part.component?.id === f.child.id)!.part.parts, host.parts);
});

test('independent fixed swaps populate named caller slots and retain unresolved siblings', () => {
  const f = fixedContentFixture('leading');
  f.child.anatomy.root.parts!.trailing = { slot: { name: 'trailing', bindings: { figma: { property: 'Tail' } }, defaultContent: [{ id: f.sample.id }] } };
  for (const v of f.set.variants) v.children![0].fixedSwaps!.Tail = { id: '40:2', key: 'sample-key' };
  const before = JSON.stringify([...f.scope]);
  const result = f.propose(), c = ContractSchema.parse(result.contract);
  const host = walkAnatomy(c).find(p => p.part.component?.id === f.child.id)!.part;
  assert.deepEqual(Object.keys(host.component!.contentSlots!).sort(), ['leading', 'trailing']);
  for (const [slot, id] of [['leading', f.target.id], ['trailing', f.sample.id]]) {
    const keys = host.component!.contentSlots![slot];
    assert.equal(keys.length, 1); assert.equal(host.parts![keys[0]].component!.id, id);
  }
  assert.equal(JSON.stringify([...f.scope]), before);
  for (const v of f.set.variants) v.children![0].fixedSwaps!.Tail.key = 'unresolved';
  const partial = f.propose(), pc = ContractSchema.parse(partial.contract);
  const ph = walkAnatomy(pc).find(p => p.part.component?.id === f.child.id)!.part;
  assert.deepEqual(Object.keys(ph.component!.contentSlots!), ['leading']);
  assert(partial.notes.some(n => n.includes('Tail') && n.includes('NAMED, not carried')));
});

test('fixed caller content declines incomplete identity, variant selection and incompatible slots', () => {
  const mutations: Array<(f: ReturnType<typeof fixedContentFixture>) => void> = [
    f => { delete f.set.variants[1].children![0].fixedSwaps; },
    f => { delete f.set.variants[1].children![0].fixedSwaps!.Payload.key; },
    f => { f.set.variants[1].children![0].fixedSwaps!.Payload.id = '40:2'; },

    f => { delete f.set.variants[1].children![0].instanceSetKey; },
    f => { f.target.bindings.figma.anchors!.nodeId = 'different-node'; },
    f => { f.target.bindings.figma.anchors!.fileKey = 'foreign-file'; },
    f => { f.target.bindings.figma.anchors!.componentSetKey = 'foreign-key'; },
    f => { f.target.props = structuredClone(f.child.props); },
    f => { f.scope.delete(f.target.id); },
    f => { f.child.anatomy.root.parts!.region.parts!.well.slot!.min = 1; },
    f => { f.child.anatomy.root.parts!.region.parts!.well.slot!.bindings!.figma!.property = 'Other'; },
    f => { f.child.anatomy.root.parts!.second = { slot: { name: 'children' } }; },
  ];
  for (const mutate of mutations) {
    const f = fixedContentFixture(); mutate(f);
    const result = f.propose(), contract = ContractSchema.parse(result.contract);
    assert(!componentRefsOf(contract).some(p => p.ref.id === f.target.id), String(mutate));
    assert(result.notes.some(n => n.includes('fixed-swap-caller-not-carried')), String(mutate));
    assert(result.notes.some(n => n.includes('Payload') && n.includes('NAMED, not carried')), String(mutate));
  }
});

test('caller size requires one complete observed instance and a scalable target; fractional sizes stay exact', () => {
  const make = () => {
    const f = fixedContentFixture();
    f.target.anatomy.root = {declared:{position:'relative'},tokens:{width:'{drawing.size}',height:'{drawing.size}'},overridable:['size'],parts:{
      ink:{shape:{kind:'path',width:12,height:8,paths:[{data:'M0 0L12 0L6 8Z',windingRule:'NONZERO'}],
        parentViewport:{width:24,height:24,x:3,y:4}},tokens:{'background-color':'{drawing.ink}'}},
    }};
    for (const v of f.set.variants) v.children![0].fixedSwaps!.Payload.observedInstances=[{nodeId:'instance:1',path:[0],componentId:'40:1',
      size:{width:7.25,height:7.25},parentSize:{width:7.25,height:7.25},relativeTransform:[[1,0,0],[0,1,0]],constraints:{horizontal:'SCALE',vertical:'SCALE'}}];
    return f;
  };
  const sizeRef = (f:ReturnType<typeof make>) => {
    const result=f.propose(),c=ContractSchema.parse(result.contract);
    return {result,ref:walkAnatomy(c).find(p=>p.part.component?.id===f.target.id)?.part.component?.overrides?.size};
  };
  const f=make(),before=JSON.stringify([...f.scope]),first=sizeRef(f);
  assert(first.ref);assert.equal(JSON.stringify([...f.scope]),before);
  assert(first.result.mintedTokens?.entries.some(e=>e.value==='7.25px'));
  const nested=make();
  for(const v of nested.set.variants){const row=v.children![0].fixedSwaps!.Payload.observedInstances![0];
    row.path=[0,0,0];row.relativeTransform=[[1,0,-0.3717],[0,1,0.000167]];
    row.constraints={horizontal:'CENTER',vertical:'CENTER'};row.parentSize={width:13.2531,height:13.999};row.size={width:14,height:14};}
  const nestedBefore=JSON.stringify([...nested.scope]),nestedResult=sizeRef(nested);
  assert(nestedResult.ref,'local resize is independent of ancestor placement and constraints');
  assert(nestedResult.result.mintedTokens?.entries.some(e=>e.value==='14px'));
  assert.equal(JSON.stringify([...nested.scope]),nestedBefore,'shared main/default stays unchanged');

  const mutations:Array<(f:ReturnType<typeof make>)=>void>=[
    f=>{delete f.target.anatomy.root.overridable;},
    f=>{delete f.set.variants[0].children![0].fixedSwaps!.Payload.observedInstances;},
    f=>{const a=f.set.variants[0].children![0].fixedSwaps!.Payload.observedInstances!;a.push(structuredClone(a[0]));},
    f=>{f.set.variants[0].children![0].fixedSwaps!.Payload.observedInstances![0].componentId='other';},
    f=>{f.set.variants[0].children![0].fixedSwaps!.Payload.observedInstances![0].path=[-1];},
    f=>{f.set.variants[0].children![0].fixedSwaps!.Payload.observedInstances![0].size!.height=7.2501;},
    f=>{f.set.variants[0].children![0].fixedSwaps!.Payload.observedInstances![0].size!.width=NaN;},
    f=>{f.set.variants[0].children![0].fixedSwaps!.Payload.observedInstances![0].relativeTransform![0][0]=0.5;},
    f=>{delete f.set.variants[0].children![0].fixedSwaps!.Payload.observedInstances![0].relativeTransform;},
  ];
  for(const mutate of mutations){const changed=make();mutate(changed);assert.equal(sizeRef(changed).ref,undefined,String(mutate));}
});

test('both React targets render imported fixed content while child samples remain design-time only', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const f = fixedContentFixture(), parent = ContractSchema.parse(f.propose().contract);
  f.scope.set(parent.id, parent);
  const ctx = { contracts: f.scope, tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map<string, string>() };
  for (const emitter of [reactEmitter, reactInlineEmitter]) {
    const files = emitter.emit(parent, ctx);
    const dependencies = Object.fromEntries([...f.scope.values()].filter(c => c.id !== parent.id).map(c => {
      const output = emitter.emit(c, ctx);
      return [c.name, { tsx: output[0].contents, css: output.find(f => f.path.endsWith('.css'))?.contents }];
    }));
    assert.deepEqual(generatedTypeErrors(parent.name, files[0].contents, Object.fromEntries(Object.entries(dependencies).map(([name, d]) => [name, d.tsx]))), []);
    const page = await browser.newPage();
    try {
      const render = await mountGenerated(page, parent.name, files[0].contents, files.find(f => f.path.endsWith('.css'))?.contents, dependencies);
      for (const power of [false, true, false]) {
        await render({ power });
        assert.equal(await page.getByText('Selected content', { exact: true }).count(), 1);
        assert.equal(await page.getByText('Sample only', { exact: true }).count(), 0);
      }
    } finally { await page.close(); }
  }
});

test('native imported fixed content is linked inside the slot without changing its child main', async () => {
  const f = fixedContentFixture(), parent = ContractSchema.parse(f.propose().contract);
  f.scope.set(parent.id, parent);
  const engine = createFigmaEngine({ tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map() });
  const host = createFigmaMock(), context = vm.createContext({ figma: host.figma, console: { log() {}, warn() {}, error() {} } });
  const run = (script: string) => vm.runInContext(`(async()=>{${script}\n})()`, context);
  await run(engine.buildTokensScript(null));
  for (const dependency of [f.sample, f.target, f.child]) await run(engine.buildComponentScript(dependency, f.scope));
  const main = host.root.findOne(n => n.type === 'COMPONENT_SET' && n.getSharedPluginData('ds_contracts', 'contractId') === f.child.id)!;
  const before = main.findAll().map(n => [n.id, n.type, n.name, n.characters]);
  await run(engine.buildComponentScript(parent, f.scope));
  assert.deepEqual(main.findAll().map(n => [n.id, n.type, n.name, n.characters]), before);
  const owner = host.root.findOne(n => n.type === 'COMPONENT_SET' && n.getSharedPluginData('ds_contracts', 'contractId') === parent.id)!;
  for (const variant of owner.children!) {
    assert.deepEqual(variant.findAll(n => n.type === 'TEXT').map(n => n.characters), ['Selected content']);
    assert.equal(variant.findAll(n => n.type === 'INSTANCE' && n.name === 'selectedContent').length, 1);
  }
});
test('both React targets route imported fixed content into a named slot while child samples remain design-time only', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const f = fixedContentFixture('iconStart');
  f.child.anatomy.root.parts!.region.parts!.well.slot!.renderDefault = true;
  const parent = ContractSchema.parse(f.propose().contract);
  f.scope.set(parent.id, parent);
  const ctx = { contracts: f.scope, tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map<string, string>() };
  for (const emitter of [reactEmitter, reactInlineEmitter]) {
    const files = emitter.emit(parent, ctx);
    const dependencies = Object.fromEntries([...f.scope.values()].filter(c => c.id !== parent.id).map(c => {
      const output = emitter.emit(c, ctx);
      return [c.name, { tsx: output[0].contents, css: output.find(f => f.path.endsWith('.css'))?.contents }];
    }));
    assert.deepEqual(generatedTypeErrors(parent.name, files[0].contents, Object.fromEntries(Object.entries(dependencies).map(([name, d]) => [name, d.tsx]))), []);
    const page = await browser.newPage();
    try {
      const render = await mountGenerated(page, parent.name, files[0].contents, files.find(f => f.path.endsWith('.css'))?.contents, dependencies);
      for (const power of [false, true, false]) {
        await render({ power });
        assert.equal(await page.getByText('Selected content', { exact: true }).count(), 1);
        assert.equal(await page.getByText('Sample only', { exact: true }).count(), 0);
      }
    } finally { await page.close(); }
  }
});

test('native named-slot fixed content is linked inside the slot without changing its child main', async () => {
  const f = fixedContentFixture('iconStart');
  f.child.anatomy.root.parts!.region.parts!.well.slot!.renderDefault = true;
  const parent = ContractSchema.parse(f.propose().contract);
  f.scope.set(parent.id, parent);
  const engine = createFigmaEngine({ tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map() });
  const host = createFigmaMock(), context = vm.createContext({ figma: host.figma, console: { log() {}, warn() {}, error() {} } });
  const run = (script: string) => vm.runInContext(`(async()=>{${script}\n})()`, context);
  await run(engine.buildTokensScript(null));
  for (const dependency of [f.sample, f.target, f.child]) await run(engine.buildComponentScript(dependency, f.scope));
  const main = host.root.findOne(n => n.type === 'COMPONENT_SET' && n.getSharedPluginData('ds_contracts', 'contractId') === f.child.id)!;
  const before = main.findAll().map(n => [n.id, n.type, n.name, n.characters]);
  await run(engine.buildComponentScript(parent, f.scope));
  assert.deepEqual(main.findAll().map(n => [n.id, n.type, n.name, n.characters]), before);
  const owner = host.root.findOne(n => n.type === 'COMPONENT_SET' && n.getSharedPluginData('ds_contracts', 'contractId') === parent.id)!;
  for (const variant of owner.children!) {
    assert.deepEqual(variant.findAll(n => n.type === 'TEXT').map(n => n.characters), ['Selected content']);
    assert.equal(variant.findAll(n => n.type === 'INSTANCE' && n.name === 'selectedContent').length, 1);
  }
});
function fixture(optional = true, boolean = true) {
  const values = boolean ? ['false', 'true'] : ['quiet', 'strong'];
  const labels = boolean && !optional ? ['False', 'True'] : ['Low', 'High'];
  const options = optional ? ['Automatic', ...labels] : labels;
  const child = ContractSchema.parse({
    id: 'check.indicator', name: 'Indicator', version: '0.1.0', status: 'draft',
    description: 'Distinct omitted and explicit appearances', semantics: { element: 'span' },
    props: [{ name: 'lit', type: boolean ? 'boolean' : { enum: values },
      ...(optional ? {} : { default: boolean ? false : values[0] }),
      bindings: { code: { prop: 'illumination' }, figma: { kind: 'VARIANT', property: 'Powered',
        values: Object.fromEntries(values.map((v, i) => [v, labels[i]])), ...(optional ? { unsetValue: 'Automatic' } : {}) } } }],
    states: [], anatomy: { root: { literals: { width: '18px', height: '10px', 'background-color': '#112233' },
      literalsByProp: [{ prop: 'lit', map: { [values[0]]: { 'background-color': '#dd2200' }, [values[1]]: { 'background-color': '#00aa44' } } }] } },
    bindings: { figma: { anchors: { fileKey: 'fixture', componentSetKey: 'indicator-key' } }, code: { anchors: { importPath: './Indicator', export: 'Indicator' } } },
  });
  const set: DumpSet = {
    setName: 'Housing', type: 'COMPONENT_SET', propNames: { Power: 'active' },
    propertyDefinitions: { Power: { type: 'VARIANT', defaultValue: options[0], variantOptions: options } },
    ...(optional ? { unsetVariantAxes: { version: boolean ? 2 : 1, axes: [{ property: 'Power', propName: 'active', codeProp: 'isActive',
      unsetValue: 'Automatic', ...(boolean ? { valueType: 'boolean' as const } : {}), values: values.map((v, i) => ({ value: v, label: labels[i] })) }] } } : {}),
    variants: options.map(label => ({ name: `Power=${label}`, type: 'COMPONENT', variantProperties: { Power: label },
      layout: { mode: 'HORIZONTAL', primary: 'MIN', counter: 'MIN', spacing: 0, padding: [0, 0, 0, 0], primarySizing: 'AUTO', counterSizing: 'AUTO' },
      children: [{ name: 'lamp', type: 'INSTANCE', instanceOf: 'Indicator', instanceSetKey: 'indicator-key', componentProperties: { Powered: label } }],
    })),
  };
  return { set, child };
}
function propose(f = fixture()) {
  const result = proposeFromDump(f.set, { corpus, mintUnbound: true, stampsObservable: true,
    contractIdByName: new Map([['Indicator', f.child.id]]), contractIdByKey: new Map([['indicator-key', f.child.id]]),
    contractsById: new Map([[f.child.id, asMinimalChildContract(f.child)]]) });
  const contract = ContractSchema.parse(result.contract);
  const ref = walkAnatomy(contract).find(row => row.part.component?.id === f.child.id)?.part.component;
  assert(ref);
  return { ...result, contract, ref };
}

test('optional boolean and enum identities retain omitted, false and true without a first-variant freeze', () => {
  for (const boolean of [true, false]) for (const reverse of [false, true]) {
    const f = fixture(true, boolean);
    if (reverse) f.set.variants.reverse();
    const result = propose(f);
    assert.deepEqual(result.ref.props, { lit: '{active}' });
    assert(!result.notes.some(n => n.includes('Powered') && n.includes('not carried')));
    assert.equal(Object.hasOwn(result.contract.props[0], 'default'), false);
  }
});

test('ordinary boolean identity forwards a typed value across renamed parent and child props', () => {
  const result = propose(fixture(false));
  assert.deepEqual(result.ref.props, { lit: '{active}' });
  assert.equal(result.contract.props[0].name, 'active', 'the retained parent name owns the binding');
});

function enumToBooleanFixture() {
  const f = fixture(false);
  const labels = ['Rest', 'Alert', 'Dormant'];
  f.set.propNames = { Mode: 'mode' };
  f.set.propertyDefinitions = { Mode: { type: 'VARIANT', defaultValue: 'Rest', variantOptions: labels } };
  f.set.variants = labels.map(label => ({ ...structuredClone(f.set.variants[0]),
    name: `Mode=${label}`, variantProperties: { Mode: label },
    children: [{ name: 'lamp', type: 'INSTANCE', instanceOf: 'Indicator', instanceSetKey: 'indicator-key',
      componentProperties: { Powered: label === 'Alert' ? 'True' : 'False' } }],
  }));
  return f;
}

test('enum-to-boolean lookups survive registering the child and reversing observed variants', () => {
  for (const reverse of [false, true]) {
    const f = enumToBooleanFixture();
    if (reverse) f.set.variants.reverse();
    const expected = { prop: 'mode', map: { rest: 'false', alert: 'true', dormant: 'false' } };
    assert.deepEqual(propose(f).ref.props, { lit: expected });
    const unknown = proposeFromDump(f.set, { corpus, mintUnbound: true, stampsObservable: true, contractIdByName: new Map() });
    const unknownRef = walkAnatomy(ContractSchema.parse(unknown.contract)).find(row => row.part.component)?.part.component;
    assert.deepEqual(unknownRef?.props, { powered: expected });
  }
});

test('typed boolean lookups do not infer missing, incompatible or contradictory observations', () => {
  const mutations: Array<(f: ReturnType<typeof enumToBooleanFixture>) => void> = [
    f => { delete f.set.variants[2].children![0].componentProperties; },
    f => { f.set.variants[2].children![0].componentProperties = { Powered: 'Unknown' }; },
    f => { f.set.variants[2].children![0].componentProperties = { Powered: 0 as unknown as boolean }; },
    f => {
      f.set.propertyDefinitions!.Side = { type: 'VARIANT', defaultValue: 'East', variantOptions: ['East', 'West'] };
      f.set.variants = f.set.variants.flatMap(row => ['East', 'West'].map(side => ({ ...structuredClone(row),
        name: `${row.name}, Side=${side}`, variantProperties: { ...row.variantProperties, Side: side } })));
      f.set.variants[1].children![0].componentProperties = { Powered: 'True' };
    },
  ];
  for (const mutate of mutations) {
    const f = enumToBooleanFixture(); mutate(f);
    const result = propose(f);
    assert.notEqual(typeof result.ref.props?.lit, 'object', String(mutate));
    assert(result.notes.some(note => note.includes('lit') && note.includes('review')));
  }
  const incomplete = enumToBooleanFixture();
  incomplete.set.variants.pop();
  // The source may declare a cell that was not captured. It must not acquire
  // a guessed default branch from the other two observed cells.
  delete incomplete.set.propNames;
  assert.throws(() => propose(incomplete), error => (error as { code?: string }).code === 'EXACT_MATRIX_RAGGED');
});

test('both React emitters deliver an imported enum-to-boolean lookup through repeated inputs', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const f = enumToBooleanFixture(), { contract } = propose(f);
  const ctx = { contracts: new Map<string, Contract>([[contract.id, contract], [f.child.id, f.child]]),
    tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map<string, string>(), mode: 'light' as const };
  for (const emitter of [reactEmitter, reactInlineEmitter]) {
    const parent = emitter.emit(contract, ctx), child = emitter.emit(f.child, ctx);
    assert.deepEqual(generatedTypeErrors(contract.name, parent[0].contents, { Indicator: child[0].contents }), []);
    const page = await browser.newPage();
    try {
      const render = await mountGenerated(page, contract.name, parent[0].contents, parent.find(f => f.path.endsWith('.css'))?.contents,
        { Indicator: { tsx: child[0].contents, css: child.find(f => f.path.endsWith('.css'))?.contents } });
      const lamp = page.locator('#root span');
      await lamp.evaluate(el => { (window as any).lookupChild = el; });
      for (const mode of ['rest', 'alert', 'dormant', 'alert', 'rest']) {
        await render({ mode });
        assert.deepEqual(await lamp.evaluate(el => ({ value: el.getAttribute('data-lit'), same: el === (window as any).lookupChild })),
          { value: mode === 'alert' ? 'true' : null, same: true }, `${emitter.name}: ${mode}`);
      }
    } finally { await page.close(); }
  }
});

test('native enum lookups respect BOOLEAN controls, boolean VARIANT labels and string enums', async () => {
  for (const kind of ['BOOLEAN', 'VARIANT', 'enum'] as const) {
    const f = enumToBooleanFixture();
    if (kind === 'BOOLEAN') {
      f.child.props[0].bindings.figma = { kind: 'BOOLEAN', property: 'Powered' };
      delete f.child.anatomy.root.literalsByProp;
      f.child.anatomy.root.parts = { marker: { shape: { kind: 'rect', width: 4, height: 4 }, visibleWhen: { prop: 'lit' } } };
    }
    if (kind === 'enum') {
      f.child.props[0].type = { enum: ['false', 'true'] };
      f.child.props[0].default = 'false';
    }
    const { contract, ref } = propose(f);
    const scope = new Map([[contract.id, contract], [f.child.id, f.child]]);
    const engine = createFigmaEngine({ tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map() });
    const compiled = engine.compileComponentData(contract, scope);
    const expected = (alert: boolean) => kind === 'BOOLEAN' ? alert : alert ? 'True' : 'False';
    for (const variant of compiled.variants) {
      const child = variant.spec.children!.find(n => n.name === 'lamp')!;
      assert.equal(child.depProps!.Powered, expected(variant.name === 'Mode=Alert'), kind);
    }
    const host = createFigmaMock();
    const context = vm.createContext({ figma: host.figma, console: { log() {}, warn() {}, error() {} } });
    const run = (script: string) => vm.runInContext(`(async()=>{${script}\n})()`, context);
    await run(engine.buildTokensScript(null));
    await run(engine.buildComponentScript(f.child, scope));
    await run(engine.buildComponentScript(contract, scope));
    const owner = host.root.findOne(n => n.type === 'COMPONENT_SET' && n.getSharedPluginData('ds_contracts', 'contractId') === contract.id)!;
    for (const main of owner.children!) {
      const instance = main.findOne(n => n.type === 'INSTANCE')! as any;
      const entry = Object.entries(instance.componentProperties).find(([name]) => name.split('#')[0] === 'Powered')!;
      assert.equal((entry[1] as { value: unknown }).value, expected(main.name === 'Mode=Alert'), kind);
      if (kind === 'BOOLEAN') {
        assert.equal(instance.findOne((n: { name: string }) => n.name === 'marker').visible, expected(main.name === 'Mode=Alert'));
        assert.throws(() => instance.setProperties({ [entry[0]]: 'false' }), /incompatible with component property type/);
        assert.equal(instance.componentProperties[entry[0]].value, expected(main.name === 'Mode=Alert'));
      }
    }
    if (kind !== 'enum') {
      ref.props!.lit = { prop: 'mode', map: { rest: 'invalid', alert: 'true', dormant: 'false' } };
      assert.throws(() => engine.compileComponentData(contract, scope), /COMPONENT_BOOLEAN_LOOKUP_INVALID:lit/);
    }
  }
});

test('every captured occurrence participates, while ambiguous sparse axes refuse', () => {
  const f = fixture();
  f.set.propertyDefinitions!.Mode = { type: 'VARIANT', defaultValue: 'Day', variantOptions: ['Day', 'Night'] };
  f.set.variants = f.set.variants.flatMap(row => ['Day', 'Night'].map(mode => ({ ...structuredClone(row),
    name: `${row.name}, Mode=${mode}`, variantProperties: { ...row.variantProperties, Mode: mode } })));
  assert.deepEqual(propose(f).ref.props, { lit: '{active}' });
  delete f.set.variants[3].children![0].componentProperties;
  const missing = propose(f);
  assert.notEqual(missing.ref.props?.lit, '{active}');
  assert(missing.notes.some(n => n.includes('typed input forwarding') && n.includes('not proved')));
  const sparse = fixture(false);
  delete sparse.set.propNames; // an unstamped designer set may declare absent cells
  sparse.set.propertyDefinitions!.Twin = { type: 'VARIANT', defaultValue: 'False', variantOptions: ['False', 'True'] };
  sparse.set.variants.forEach(row => { const value = row.variantProperties!.Power;
    row.name += `, Twin=${value}`; row.variantProperties!.Twin = value;
  });
  assert.throws(() => propose(sparse), /sparse-matrix-inference-ambiguous/);
});

test('missing, unmappable, mistyped and contradictory child values cannot become omission or identity', () => {
  const cases: Array<(f: ReturnType<typeof fixture>) => void> = [
    f => { delete f.set.variants[0].children![0].componentProperties; },
    f => { f.set.variants[0].children![0].componentProperties = {}; },
    f => { f.set.variants[0].children![0].componentProperties = { Powered: 'Unknown' }; },
    f => { f.set.variants[2].children![0].componentProperties = { Powered: 'Low' }; },
    f => { f.child.props[0].default = false; },
    f => { f.child.props[0].required = true; },
    f => { delete f.child.props[0].bindings.figma.unsetValue; },
    f => { f.child.props[0].type = { enum: ['false', 'true'] }; },
    f => { f.set.variants[1].children![0].componentProperties = { Powered: 0 as unknown as boolean }; },
  ];
  for (const mutate of cases) {
    const f = fixture(); mutate(f);
    const result = propose(f);
    assert.notEqual(result.ref.props?.lit, '{active}', String(mutate));
  }
});

test('omission lowering admits only an entire component prop reference, never token or lookup interpolation', () => {
  const axes = [{ property: 'Power', propName: 'active', codeProp: 'isActive', unsetValue: 'Automatic', internalValue: 'automatic',
    valueType: 'boolean' as const, values: [{ value: 'false', label: 'Low' }, { value: 'true', label: 'High' }] }];
  const contract = { anatomy: { root: { parts: { lamp: { component: { id: 'check.indicator', props: { lit: '{active}' } } } } } } };
  lowerUnsetProposal(contract, axes);
  assert.equal(contract.anatomy.root.parts.lamp.component.props.lit, '{active}');
  for (const part of [
    { component: { props: { lit: 'prefix-{active}' } } },
    { component: { props: { lit: { prop: 'active', map: { automatic: 'x', true: '{active}' } } } } },
    { attrs: { title: '{active}' } },
    { parts: { component: { parts: { props: { text: '{active}' } } } } },
  ]) assert.throws(() => lowerUnsetProposal({ anatomy: { root: part } }, axes), /FIGMA_UNSET_PROJECTION_UNSUPPORTED/);
});

test('both React emitters preserve the imported child appearance and identity through omitted and boolean input changes', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const f = fixture(), { contract } = propose(f);
  const ctx = { contracts: new Map<string, Contract>([[contract.id, contract], [f.child.id, f.child]]),
    tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map<string, string>(), mode: 'light' as const };
  for (const emitter of [reactEmitter, reactInlineEmitter]) {
    const parent = emitter.emit(contract, ctx), child = emitter.emit(f.child, ctx);
    assert.deepEqual(generatedTypeErrors(contract.name, parent[0].contents, { Indicator: child[0].contents }), []);
    const page = await browser.newPage();
    const css = child.find(f => f.path.endsWith('.css'))?.contents ?? '';
    const render = await mountGenerated(page, contract.name, parent[0].contents, parent.find(f => f.path.endsWith('.css'))?.contents,
      { Indicator: { tsx: child[0].contents, css } });
    if (css) await page.addStyleTag({ content: css });
    await page.evaluate(() => { (window as any).originalChild = document.querySelector('#root span'); });
    for (const [props, expected] of [[{}, 'rgb(17, 34, 51)'], [{ isActive: false }, 'rgb(221, 34, 0)'], [{ isActive: true }, 'rgb(0, 170, 68)'], [{}, 'rgb(17, 34, 51)']] as const) {
      await render(props);
      const observed = await page.locator('#root span').evaluate(el => ({ color: getComputedStyle(el).backgroundColor, same: el === (window as any).originalChild }));
      assert.deepEqual(observed, { color: expected, same: true }, emitter.name + JSON.stringify(props));
    }
    await page.close();
  }
});

test('finite lookup values follow the child boolean type while string enums stay strings', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  for (const boolean of [true, false]) {
    const f = fixture(false);
    const { contract, ref } = propose(f);
    contract.props = [{ name: 'status', type: { enum: ['rest', 'active', 'other'] }, default: 'rest',
      bindings: { code: { prop: 'stage' }, figma: { kind: 'VARIANT', property: 'Status', values: {rest:'Rest',active:'Active',other:'Other'} } } }];
    ref.props = { lit: {prop:'status',map:{rest:'false',active:'true'}} };
    f.child.props[0].default = boolean ? true : 'true';
    if (!boolean) f.child.props[0].type = {enum:['false','true']};
    const ctx = { contracts: new Map<string, Contract>([[contract.id, contract], [f.child.id, f.child]]),
      tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map<string, string>(), mode: 'light' as const };
    for (const emitter of [reactEmitter, reactInlineEmitter]) {
      const parent=emitter.emit(contract,ctx), child=emitter.emit(f.child,ctx);
      assert.deepEqual(generatedTypeErrors(contract.name,parent[0].contents,{Indicator:child[0].contents}),[]);
      const page=await browser.newPage();
      try {
        const render=await mountGenerated(page,contract.name,parent[0].contents,parent.find(f=>f.path.endsWith('.css'))?.contents,
          {Indicator:{tsx:child[0].contents,css:child.find(f=>f.path.endsWith('.css'))?.contents}});
        for (const [stage,expected] of [['rest',false],['active',true],['other',true],['rest',false]] as const) {
          await render({stage});
          const actual=await page.locator('#root span').evaluate(el=>({attribute:el.getAttribute('data-lit'),color:getComputedStyle(el).backgroundColor}));
          if(boolean) assert.equal(actual.attribute,expected?'true':null,`${emitter.name}, boolean=${boolean}, stage=${stage}`);
          else assert.equal(actual.color,expected?'rgb(0, 170, 68)':'rgb(221, 34, 0)');
        }
      } finally {await page.close();}
    }
    if (boolean) {
      ref.props.lit = {prop:'status',map:{rest:'not-a-boolean',active:'true'}};
      for (const emitter of [reactEmitter,reactInlineEmitter])
        assert.throws(()=>emitter.emit(contract,ctx),/COMPONENT_BOOLEAN_LOOKUP_INVALID:lit/);
    }
  }
});

test('caller ink requires a single identity-qualified fill and preserves the main and size override',()=>{
  const make=()=>{const f=fixedContentFixture();f.target.anatomy.root={declared:{position:'relative'},tokens:{width:'{drawing.size}',height:'{drawing.size}',color:'{drawing.ink}'},overridable:['size','color'],parts:{ink:{literals:{'background-color':'currentColor'},shape:{kind:'path',width:12,height:8,paths:[{data:'M0 0L12 0L6 8Z',windingRule:'NONZERO'}],parentViewport:{width:24,height:24,x:3,y:4}}}}};
    for(const v of f.set.variants){const n=v.children![0];n.fixedSwaps!.Payload.observedInstances=[{nodeId:'selected-instance',path:[0],componentId:'40:1',size:{width:12,height:12},parentSize:{width:12,height:12},relativeTransform:[[1,0,0],[0,1,0]],constraints:{horizontal:'SCALE',vertical:'SCALE'}}];n.hostOverrides=[{path:'Names / are not keys',fields:['fills'],fill:{hex:'b51833'},solidFillTarget:{nodeId:'paint-node',instanceId:'selected-instance',componentId:'40:1',instancePath:[0],childPath:[0]}}];}return f;};
  const read=(f:ReturnType<typeof make>)=>{const r=f.propose();return {r,overrides:walkAnatomy(ContractSchema.parse(r.contract)).find(p=>p.part.component?.id===f.target.id)!.part.component!.overrides};};
  const f=make(),before=JSON.stringify([...f.scope]),result=read(f);assert(result.overrides?.size);assert(result.overrides?.color);assert(result.r.mintedTokens?.entries.some(e=>e.value==='#b51833'));assert.equal(JSON.stringify([...f.scope]),before);
  const mutate:Array<(f:ReturnType<typeof make>)=>void>=[
    f=>{delete f.set.variants[0].children![0].hostOverrides![0].solidFillTarget;},
    f=>{f.set.variants[0].children![0].hostOverrides![0].solidFillTarget!.componentId='foreign';},
    f=>{f.set.variants[0].children![0].hostOverrides![0].solidFillTarget!.instanceId='foreign';},
    f=>{f.set.variants[0].children![0].hostOverrides![0].solidFillTarget!.instancePath=[1];},
    f=>{f.set.variants[0].children![0].hostOverrides![0].solidFillTarget!.childPath=[1];},
    f=>{f.set.variants[0].children![0].hostOverrides![0].fields.push('opacity');},
    f=>{f.set.variants[0].children![0].hostOverrides!.push(structuredClone(f.set.variants[0].children![0].hostOverrides![0]));},
    f=>{delete f.target.anatomy.root.parts;},
    f=>{f.target.anatomy.root.overridable=['size'];},
  ];
  for(const change of mutate){const f=make();change(f);assert.equal(read(f).overrides?.color,undefined,String(change));}
});

test('two callers of the same child allocate distinct contract-wide selected-content names', () => {
  const f = fixedContentFixture();
  for (const variant of f.set.variants) variant.children!.push({ ...structuredClone(variant.children![0]), name: 'second' });
  const contract = ContractSchema.parse(f.propose().contract);
  const hosts = walkAnatomy(contract).filter(p => p.part.component?.id === f.child.id);
  assert.equal(hosts.length, 2);
  const names = hosts.map(h => Object.keys(h.part.parts ?? {})).flat();
  assert.equal(names.length, 2);
  assert.equal(new Set(names).size, 2, names.join(', '));
  assert.equal(names[0], 'selectedContent', 'the first caller keeps the established name');
  const all = walkAnatomy(contract).map(p => p.name);
  assert.equal(new Set(all).size, all.length, 'no duplicate part names anywhere');
});

function sharedSlotFixture() {
  const f = fixedContentFixture();
  const contract = ContractSchema.parse({
    ...f.target,
    anatomy: { root: { layout: { display: 'flex', direction: 'column' }, parts: {
      first: { description: 'First placement', slot: { name: 'payload', bindings: { figma: { property: 'Payload' } } } },
      second: { description: 'Second placement', slot: { name: 'payload', bindings: { figma: { property: 'Payload' } } } },
    } } },
  });
  f.scope.set(contract.id, contract);
  const ctx = { contracts: f.scope, tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map<string, string>() };
  return { ...f, contract, ctx };
}

test('both React targets expose one shared slot input and render every physical occurrence', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const f = sharedSlotFixture(), before = JSON.stringify(f.contract);
  for (const emitter of [reactEmitter, reactInlineEmitter]) {
    const files = emitter.emit(f.contract, f.ctx);
    assert.deepEqual(generatedTypeErrors(f.contract.name, files[0].contents), []);
    assert.equal((files[0].contents.match(/payload\?: ReactNode;/g) ?? []).length, 1);
    assert.match(files[0].contents, /First placement/);
    assert.match(files[0].contents, /Second placement/);
    const page = await browser.newPage();
    try {
      const render = await mountGenerated(page, f.contract.name, files[0].contents, files.find(file => file.path.endsWith('.css'))?.contents);
      await render({ payload: 'Shared caller content' });
      assert.equal(await page.getByText('Shared caller content', { exact: true }).count(), 2);
      await render({ payload: 'Replacement caller content' });
      assert.equal(await page.getByText('Replacement caller content', { exact: true }).count(), 2);
      assert.equal(await page.getByText('Shared caller content', { exact: true }).count(), 0);
    } finally { await page.close(); }
    assert.equal(JSON.stringify(f.contract), before);
    assert.equal(walkAnatomy(f.contract).filter(row => row.part.slot?.name === 'payload').length, 2);
  }
});

test('shared slot stories keep one control and compile repeated identical samples', async () => {
  const f = sharedSlotFixture();
  for (const part of Object.values(f.contract.anatomy.root.parts!)) part.slot!.accepts = [f.sample.id];
  const before = JSON.stringify(f.contract), files = reactEmitter.emit(f.contract, f.ctx);
  const stories = files.find(file => file.path.endsWith('.stories.tsx'))!.contents;
  const { transformSync } = await import('esbuild');
  assert.doesNotThrow(() => transformSync(stories, { loader: 'tsx', format: 'esm' }));
  assert.equal((stories.match(/payload: \{ control: false \}/g) ?? []).length, 1);
  assert.equal((stories.match(/export const WithPayload:/g) ?? []).length, 1);
  assert.match(stories, /<Sample/);
  assert.equal(JSON.stringify(f.contract), before);
});

test('different declared samples for one shared input remain separate compilable stories', async () => {
  const f = sharedSlotFixture();
  f.contract.anatomy.root.parts!.first.slot!.defaultContent = [{ id: f.sample.id }];
  f.contract.anatomy.root.parts!.second.slot!.defaultContent = [{ id: f.child.id }];
  const before = JSON.stringify(f.contract), files = reactEmitter.emit(f.contract, f.ctx);
  const stories = files.find(file => file.path.endsWith('.stories.tsx'))!.contents;
  const { transformSync } = await import('esbuild');
  assert.doesNotThrow(() => transformSync(stories, { loader: 'tsx', format: 'esm' }));
  assert.equal((stories.match(/export const WithPayload:/g) ?? []).length, 1);
  assert.equal((stories.match(/export const WithPayload2:/g) ?? []).length, 1);
  assert.match(stories, /<Sample/);
  assert.match(stories, /<Indicator/);
  assert.equal(JSON.stringify(f.contract), before);
});


test('source input allocation is injective, traversal independent, and reserves existing names', () => {
  const properties = ['Label?', 'Label', 'label1', 'Tone', 'iconBefore', '↳ <Icon> before'];
  const names = allocateFigmaPropertyNames(properties);
  assert.deepEqual(names, allocateFigmaPropertyNames([...properties].reverse()));
  assert.equal(names.Tone, undefined);
  assert.equal(names.label1, undefined);
  assert.notEqual(names.Label, 'label1');
  assert.notEqual(names['Label?'], 'label1');
  assert.notEqual(names.Label, names['Label?']);
  assert.notEqual(names.iconBefore, names['↳ <Icon> before']);
  assert.equal(Object.getPrototypeOf(names), null);
});

function independentInputFixture(): DumpSet {
  return {
    setName: 'IndependentInputs', type: 'COMPONENT',
    propertyDefinitions: {
      'Label#10:1': {type: 'TEXT', defaultValue: 'Original label'},
      'Label?#10:2': {type: 'BOOLEAN', defaultValue: true},
    },
    boolDefaults: {'Label?': true},
    variants: [{name: 'IndependentInputs', type: 'COMPONENT', children: [{
      name: 'Caption', type: 'TEXT', propRefs: {characters: 'Label', visible: 'Label?'},
      text: {characters: 'Original label', fontFamily: 'Inter', fontSize: 14, fontStyle: 'Regular'},
    }]}],
  };
}

test('text and visibility retain separate source bindings and independently update in both React emitters', async t => {
  const set = independentInputFixture(), before = JSON.stringify(set);
  const proposed = proposeFromDump(set, {corpus, contractIdByName: new Map(), hiddenCaptured: true});
  const contract = ContractSchema.parse(proposed.contract);
  const label = contract.props.find(p => p.bindings.figma.property === 'Label')!;
  const visible = contract.props.find(p => p.bindings.figma.property === 'Label?')!;
  assert.equal(label.type, 'text'); assert.equal(visible.type, 'boolean');
  assert.notEqual(label.name, visible.name);
  assert.equal(label.default, 'Original label'); assert.equal(visible.default, true);
  assert.equal(label.bindings.code.prop, label.name); assert.equal(visible.bindings.code.prop, visible.name);
  assert.equal(JSON.stringify(set), before);
  const ctx = {contracts: new Map([[contract.id, contract]]),
    tokens: {primitives: {}, semantic: {}, light: {}, dark: {}, brands: {default: {}}},
    icons: new Map<string, string>(), mode: 'light' as const};
  const browser = await chromium.launch(); t.after(() => browser.close());
  for (const emitter of [reactEmitter, reactInlineEmitter]) {
    const files = emitter.emit(contract, ctx);
    assert.deepEqual(generatedTypeErrors(contract.name, files[0].contents), []);
    const page = await browser.newPage();
    try {
      const render = await mountGenerated(page, contract.name, files[0].contents, files.find(f => f.path.endsWith('.css'))?.contents);
      await render({[label.name]: 'Caller label', [visible.name]: true});
      assert.equal(await page.getByText('Caller label', {exact: true}).count(), 1);
      await render({[label.name]: 'Hidden replacement', [visible.name]: false});
      assert.equal(await page.getByText('Hidden replacement', {exact: true}).count(), 0);
      await render({[label.name]: 'Visible replacement', [visible.name]: true});
      assert.equal(await page.getByText('Visible replacement', {exact: true}).count(), 1);
    } finally {await page.close();}
  }
});

test('distinct axes keep every original tuple while allocated names remain checked', () => {
  const set: DumpSet = {setName: 'IndependentAxes', type: 'COMPONENT_SET', propertyDefinitions: {
    '<Extra': {type: 'VARIANT', defaultValue: 'Left', variantOptions: ['Left', 'Right']},
    'Extra>': {type: 'VARIANT', defaultValue: 'Top', variantOptions: ['Top', 'Bottom']},
  }, variants: ['Left', 'Right'].flatMap(left => ['Top', 'Bottom'].map(top => ({
    name: `<Extra=${left}, Extra>=${top}`, type: 'COMPONENT', variantProperties: {'<Extra': left, 'Extra>': top},
  })))};
  const original = JSON.stringify(set);
  const result = proposeFromDump(set, {corpus, contractIdByName: new Map()});
  assert.equal(result.projection.status, 'verified-exact');
  const contract = ContractSchema.parse(result.contract);
  assert.equal(new Set(contract.props.map(p => p.name)).size, 2);
  assert.deepEqual(contract.props.map(p => p.bindings.figma.property).sort(), ['<Extra', 'Extra>']);
  assert.equal(JSON.stringify(set), original);
  const duplicatedNames = validateExactVariantProjection(set, undefined, {propertyNames: {'<Extra': 'same', 'Extra>': 'same'}});
  assert.equal(duplicatedNames.status, 'refused');
  if (duplicatedNames.status === 'refused') assert.equal(duplicatedNames.code, 'EXACT_PROPERTY_CANONICAL_COLLISION');
  const incomplete = structuredClone(set); incomplete.variants.pop();
  assert.throws(() => proposeFromDump(incomplete, {corpus, contractIdByName: new Map()}), error => (error as {code?: string}).code === 'EXACT_MATRIX_RAGGED');
});


test('retained Figma property names preserve independent text and visibility APIs on readback', () => {
  const set = independentInputFixture();
  const first = ContractSchema.parse(proposeFromDump(set, {corpus, contractIdByName: new Map(), hiddenCaptured: true}).contract);
  const names = Object.fromEntries(first.props.map(p => [p.bindings.figma.property!, p.name]));
  const stamped = {...set, propNames: names};
  const before = JSON.stringify(stamped);
  const second = ContractSchema.parse(proposeFromDump(stamped, {corpus, contractIdByName: new Map(), hiddenCaptured: true}).contract);
  assert.deepEqual(second.props.map(p => [p.name, p.type, p.default, p.bindings.figma.property]),
    first.props.map(p => [p.name, p.type, p.default, p.bindings.figma.property]));
  assert.equal(JSON.stringify(stamped), before);
});

test('retained axis names survive readback without relaxing exact matrix checks', () => {
  const set: DumpSet = {setName: 'StampedAxes', type: 'COMPONENT_SET' as const, propNames: {'<Extra': 'extra1', 'Extra>': 'extra2'},
    propertyDefinitions: {
      '<Extra': {type: 'VARIANT', defaultValue: 'Left', variantOptions: ['Left', 'Right']},
      'Extra>': {type: 'VARIANT', defaultValue: 'Top', variantOptions: ['Top', 'Bottom']},
    }, variants: ['Left', 'Right'].flatMap(left => ['Top', 'Bottom'].map(top => ({
      name: `<Extra=${left}, Extra>=${top}`, type: 'COMPONENT', variantProperties: {'<Extra': left, 'Extra>': top},
    })))};
  const result = proposeFromDump(set, {corpus, contractIdByName: new Map()});
  assert.equal(result.projection.status, 'verified-exact');
  assert.deepEqual(ContractSchema.parse(result.contract).props.map(p => p.name).sort(), ['extra1', 'extra2']);
  const bad = {...set, propNames: {'<Extra': 'same', 'Extra>': 'same'}};
  assert.throws(() => proposeFromDump(bad, {corpus, contractIdByName: new Map()}), error => (error as {code?: string}).code === 'EXACT_PROPERTY_CANONICAL_COLLISION');
  const ragged = structuredClone(set); ragged.variants.pop();
  assert.throws(() => proposeFromDump(ragged, {corpus, contractIdByName: new Map()}), error => (error as {code?: string}).code === 'EXACT_MATRIX_RAGGED');
});

test('an unresolved child uses one complete input namespace across partial callers', () => {
  const set: DumpSet = {setName: 'PartialCallers', type: 'COMPONENT', propertyDefinitions: {}, variants: [{
    name: 'PartialCallers', type: 'COMPONENT', children: [
      {name: 'First', type: 'INSTANCE', instanceOf: 'UnknownChild', instanceSetKey: 'unknown-key', componentProperties: {'Label#1:1': 'First label'}},
      {name: 'Second', type: 'INSTANCE', instanceOf: 'UnknownChild', instanceSetKey: 'unknown-key', componentProperties: {'Label#1:1': 'Second label', 'Label?#1:2': true}},
    ],
  }]};
  const before = JSON.stringify(set);
  const proposed = proposeFromDump(set, {corpus, contractIdByName: new Map(), mintUnbound: true});
  const contract = ContractSchema.parse(proposed.contract);
  const stub = ContractSchema.parse(proposed.childStubs![0]);
  const label = stub.props.find(p => p.bindings.figma.property === 'Label')!;
  const visible = stub.props.find(p => p.bindings.figma.property === 'Label?')!;
  assert(label); assert(visible); assert.notEqual(label.name, visible.name);
  const callers = walkAnatomy(contract).filter(row => row.part.component?.id === stub.id).map(row => row.part.component!);
  assert.equal(callers.length, 2);
  assert.deepEqual(callers[0].props, {[label.name]: 'First label'});
  assert.deepEqual(callers[1].props, {[label.name]: 'Second label', [visible.name]: true});
  assert.equal(JSON.stringify(set), before);
});


test('distinct captured set keys beat normalized self names and keep both exports and live child props',async t=>{
 const f=fixture(false);f.set.setName='ToggleSwitch';f.set.key='outer-key';f.child.name='ToggleSwitch';f.child.bindings.code.anchors={importPath:'./ToggleSwitch',export:'ToggleSwitch'};
 for(const v of f.set.variants){v.children![0].instanceOf='_ToggleSwitch';v.children![0].name='_ToggleSwitch';}
 const before=JSON.stringify(f.set);
 const r=proposeFromDump(f.set,{corpus,mintUnbound:true,contractIdByName:new Map([['_ToggleSwitch',f.child.id]]),contractIdByKey:new Map([['indicator-key',f.child.id]]),contractsById:new Map([[f.child.id,asMinimalChildContract(f.child)]])});
 const c=ContractSchema.parse(r.contract);assert.equal(c.name,'ToggleSwitch2');assert.equal(JSON.stringify(f.set),before);assert(!r.notes.some(n=>n.includes('wrap an instance of the set')));
 assert(componentRefsOf(c).some(row=>row.ref.id===f.child.id));const ref=walkAnatomy(c).find(x=>x.part.component?.id===f.child.id)!.part.component!;assert.equal(ref.props?.lit,'{active}');
 const tokens={primitives:r.mintedTokens?.tree ?? {},semantic:{},light:{},dark:{},brands:{default:{}}};const ctx={contracts:new Map([[c.id,c],[f.child.id,f.child]]),tokens,icons:new Map<string,string>(),mode:'light' as const};
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){const parent=emitter.emit(c,ctx),child=emitter.emit(f.child,ctx);const page=await browser.newPage();try{const render=await mountGenerated(page,c.name,parent[0].contents,parent.find(f=>f.path.endsWith('.css'))?.contents,{ToggleSwitch:{tsx:child[0].contents,css:child.find(f=>f.path.endsWith('.css'))?.contents}});
  for(const active of [false,true,false]){await render({active});const node=page.locator('#root span');assert.equal(await node.count(),1);assert.deepEqual(await node.evaluate(el=>({lit:el.getAttribute('data-lit'),width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})),{lit:active?'true':null,width:18,height:10});}
 }finally{await page.close();}}
});

test('matching captured set identity still prevents recursive component references',()=>{
 const f=fixture(false);f.set.setName='ToggleSwitch';f.set.key='indicator-key';
 for(const v of f.set.variants)v.children![0].instanceOf='RenamedSelf';
 const r=proposeFromDump(f.set,{corpus,mintUnbound:true,contractIdByName:new Map()});const c=ContractSchema.parse(r.contract);assert.equal(componentRefsOf(c).length,0);assert(r.notes.some(n=>n.includes('wrap an instance of the set')));
});

function booleanToEnumFixture() {
  const f = fixture(false);
  f.child = fixture(false, false).child;
  for (const row of f.set.variants)
    row.children![0].componentProperties = {Powered: row.variantProperties!.Power === 'True' ? 'High' : 'Low'};
  return f;
}

test('complete boolean parent maps to a distinct child enum without first-state pinning', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  for (const reverse of [false, true]) {
    const f = booleanToEnumFixture(); if (reverse) f.set.variants.reverse();
    const before = JSON.stringify(f.set), result = propose(f), c = result.contract;
    assert.deepEqual(result.ref.props, {lit: {prop: 'active', map: {false: 'quiet', true: 'strong'}}});
    assert.equal(JSON.stringify(f.set), before);
    const ctx = {contracts: new Map([[c.id, c], [f.child.id, f.child]]),
      tokens: {primitives: {}, semantic: {}, light: {}, dark: {}, brands: {default: {}}}, icons: new Map<string, string>(), mode: 'light' as const};
    for (const emitter of [reactEmitter, reactInlineEmitter]) {
      const parent = emitter.emit(c, ctx), child = emitter.emit(f.child, ctx);
      assert.deepEqual(generatedTypeErrors(c.name, parent[0].contents, {Indicator: child[0].contents}), []);
      const page = await browser.newPage();
      try {
        const render = await mountGenerated(page, c.name, parent[0].contents, parent.find(f => f.path.endsWith('.css'))?.contents,
          {Indicator: {tsx: child[0].contents, css: child.find(f => f.path.endsWith('.css'))?.contents}});
        for (const active of [false, true, false]) {
          await render({[c.props.find(p => p.name === 'active')!.bindings.code.prop]: active});
          assert.equal(await page.locator('#root span').evaluate(el => getComputedStyle(el).backgroundColor), active ? 'rgb(0, 170, 68)' : 'rgb(221, 34, 0)');
        }
      } finally {await page.close();}
    }
  }
});

test('boolean parent lookup refuses absent and contradictory child values', () => {
  const missing = booleanToEnumFixture(); delete missing.set.variants[1].children![0].componentProperties;
  assert.notEqual(typeof propose(missing).ref.props?.lit, 'object');
  const contradictory = booleanToEnumFixture();
  contradictory.set.propertyDefinitions!.Side = {type: 'VARIANT', defaultValue: 'East', variantOptions: ['East', 'West']};
  contradictory.set.variants = contradictory.set.variants.flatMap(row => ['East', 'West'].map(side => ({...structuredClone(row),
    name: `${row.name}, Side=${side}`, variantProperties: {...row.variantProperties, Side: side}})));
  contradictory.set.variants[1].children![0].componentProperties = {Powered: 'High'};
  assert.notEqual(typeof propose(contradictory).ref.props?.lit, 'object');
});

test('boolean parent lookup selects the captured child enum on the Figma writer', async () => {
  const f = booleanToEnumFixture(), {contract} = propose(f), scope = new Map([[contract.id, contract], [f.child.id, f.child]]);
  const engine = createFigmaEngine({tokens: {primitives: {}, semantic: {}, light: {}, dark: {}, brands: {default: {}}}, icons: new Map()});
  const host = createFigmaMock(), context = vm.createContext({figma: host.figma, console: {log() {}, warn() {}, error() {}}});
  const run = (script: string) => vm.runInContext(`(async()=>{${script}\n})()`, context);
  await run(engine.buildTokensScript(null));
  await run(engine.buildComponentScript(f.child, scope));
  await run(engine.buildComponentScript(contract, scope));
  const owner = host.root.findOne(n => n.type === 'COMPONENT_SET' && n.getSharedPluginData('ds_contracts', 'contractId') === contract.id)!;
  for (const variant of owner.children!) {
    const instance = variant.findOne(n => n.type === 'INSTANCE')! as any;
    const prop = Object.entries(instance.componentProperties).find(([key]) => key.split('#')[0] === 'Powered')!;
    assert.equal((prop[1] as {value: string}).value, variant.name === 'Power=True' ? 'High' : 'Low');
  }
});

test('caller size excludes only absence proven by the linked child slot gate and captured props',()=>{
 const make=()=>{
  const f=fixedContentFixture();f.child.anatomy.root.parts!.region.parts!.well.visibleWhen={prop:'lit'};
  f.target.anatomy.root={tokens:{width:'{drawing.size}',height:'{drawing.size}'},overridable:['size'],parts:{ink:{shape:{kind:'path',width:24,height:24,paths:[{data:'M0 0L24 0L24 24Z',windingRule:'NONZERO'}],parentViewport:{width:24,height:24,x:0,y:0}}}}};
  f.set.variants[0].children![0].fixedSwaps!.Payload.observedInstances=[];
  f.set.variants[1].children![0].fixedSwaps!.Payload.observedInstances=[{nodeId:'actual',componentId:'40:1',path:[0],size:{width:16,height:16},relativeTransform:[[1,0,0],[0,1,0]]}];
  return f;
 };
 const read=(f:ReturnType<typeof make>)=>{const r=f.propose(),c=ContractSchema.parse(r.contract);return{r,c,ref:componentRefsOf(c).find(x=>x.ref.id===f.target.id)!.ref};};
 for(const reverse of [false,true]){const f=make(),before=JSON.stringify([...f.scope]);if(reverse)f.set.variants.reverse();const {r,ref}=read(f);assert(ref.overrides?.size);assert(r.mintedTokens!.entries.some(e=>e.value==='16px'));assert.equal(JSON.stringify([...f.scope]),before);const c=ContractSchema.parse(r.contract);assert.deepEqual(walkAnatomy(c).find(row=>row.part.component?.id===f.target.id)!.part.visibleWhen,{prop:'active'});}
 const fallback=make(),slot=fallback.child.anatomy.root.parts!.region.parts!.well;delete slot.visibleWhen;slot.parts={defaultContent:{component:{id:fallback.sample.id},visibleWhen:{prop:'lit'}}};assert.deepEqual(walkAnatomy(read(fallback).c).find(row=>row.part.component?.id===fallback.target.id)!.part.visibleWhen,{prop:'active'});
 const mutations:Array<(f:ReturnType<typeof make>)=>void>=[
  f=>{delete f.child.anatomy.root.parts!.region.parts!.well.visibleWhen;},
  f=>{delete f.set.variants[0].children![0].fixedSwaps!.Payload.observedInstances;},
  f=>{delete f.set.variants[0].children![0].componentProperties;},
  f=>{f.set.variants[0].children![0].componentProperties={Powered:'True'};},
  f=>{delete f.set.variants[1].children![0].fixedSwaps!.Payload.observedInstances;},
  f=>{f.set.variants[0].children![0].fixedSwaps!.Payload.observedInstances=[{nodeId:'unexpected',componentId:'foreign',path:[0],size:{width:16,height:16},relativeTransform:[[1,0,0],[0,1,0]]}];},
 ];
 for(const mutate of mutations){const f=make();mutate(f);assert.equal(read(f).ref.overrides?.size,undefined,String(mutate));}
});

function independentPresenceFixture(positioned = false){
 const f=fixture(false,false);f.child.anatomy.root.text='Lamp';
 f.set.propertyDefinitions!['Show lamp']={type:'BOOLEAN',defaultValue:true};
 f.set.variants[0].children=[];
 f.set.variants[1].children![0].propRefs={visible:'Show lamp'};
 if(positioned) f.set.variants[1].children![0].abs={x:7,y:-12,width:18,height:10,right:15,bottom:22,constraints:{horizontal:'LEFT',vertical:'TOP'}};
 const before=JSON.stringify(f.set),result=propose(f),scope=new Map([[result.contract.id,result.contract],[f.child.id,f.child]]);
 assert.equal(JSON.stringify(f.set),before);
 return{...f,result,scope};
}
test('component enum presence and independent Boolean visibility retain both gates without restyling the child',()=>{
 const f=independentPresenceFixture(),rows=walkAnatomy(f.result.contract),child=rows.find(row=>row.part.component?.id===f.child.id)!;
 assert(child);assert.equal(child.part.visibleWhen!.prop,'showLamp');
 const host=rows.find(row=>row.path.join('/')===child.path.slice(0,-1).join('/'))!;
 assert(host);assert.equal(host.part.visibleWhen!.prop,'showLamp');assert.deepEqual(host.part.presenceByCombination!.props,['active']);
 assert.equal(child.part.stylesWhen,undefined);assert.equal(child.part.component!.id,f.child.id);
 assert(f.result.notes.some(note=>note.includes('explicit structural host')));
 const engine=createFigmaEngine({tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
 const native=engine.compileComponentData(f.result.contract,f.scope);
 const low=native.variants.find(v=>v.name.includes('Low'))!,high=native.variants.find(v=>v.name.includes('High'))!;
 assert(low);assert(high);assert.equal(low.spec.children!.length,0);
 assert.equal(high.spec.children![0].children![0].depContractId,f.child.id);
});
test('missing visibility references cannot erase a separately proven component presence gate',()=>{
 const f=independentPresenceFixture();
 f.set.propertyDefinitions!.Tone={type:'VARIANT',defaultValue:'A',variantOptions:['A','B']};
 f.set.variants=f.set.variants.flatMap(v=>['A','B'].map(tone=>{const row=structuredClone(v);row.name+=`, Tone=${tone}`;row.variantProperties={...row.variantProperties,Tone:tone};if(tone==='B'&&row.children?.[0])delete row.children[0].propRefs;return row;}));
 for(const reverse of [false,true]){
  if(reverse)f.set.variants.reverse();
  const result=propose(f),rows=walkAnatomy(result.contract),child=rows.find(row=>row.part.component?.id===f.child.id)!;
  assert.equal(child.part.visibleWhen!.prop,'showLamp');
  const host=rows.find(row=>row.path.join('/')===child.path.slice(0,-1).join('/'))!;
  assert.equal(host.part.visibleWhen!.prop,'showLamp');assert.deepEqual(host.part.presenceByCombination!.props,['active']);
  const scope=new Map([[result.contract.id,result.contract],[f.child.id,f.child]]);
  const native=createFigmaEngine({tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()}).compileComponentData(result.contract,scope);
  for(const row of native.variants)assert.equal(row.spec.children!.length,row.name.includes('Low')?0:1);
 }
});

test('both actual React surfaces require source enum presence AND the live Boolean at defaults and through switches',async t=>{
 const f=independentPresenceFixture(),c=f.result.contract;
 const axis=c.props.find(p=>p.bindings.figma.property==='Power')!,boolean=c.props.find(p=>p.bindings.figma.property==='Show lamp')!;
 const values=Object.fromEntries(Object.entries(axis.bindings.figma.values!).map(([k,v])=>[v,k]));
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const ctx={contracts:f.scope,tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map<string,string>()},files=emitter.emit(c,ctx),dep=emitter.emit(f.child,ctx);
  const dependencies={[f.child.name]:{tsx:dep[0].contents,css:dep.find(file=>file.path.endsWith('.css'))?.contents}};
  assert.deepEqual(generatedTypeErrors(c.name,files[0].contents,{[f.child.name]:dep[0].contents}),[]);
  const page=await browser.newPage();try{
   const render=await mountGenerated(page,c.name,files[0].contents,files.find(file=>file.path.endsWith('.css'))?.contents,dependencies);
   await render({});assert.equal(await page.getByText('Lamp',{exact:true}).count(),0);
   for(const [label,show] of [['Low',true],['High',true],['High',false],['Low',false],['High',true]] as const){
    await render({[axis.bindings.code.prop]:values[label],[boolean.bindings.code.prop]:show});
    assert.equal(await page.getByText('Lamp',{exact:true}).count(),Number(label==='High'&&show),JSON.stringify({surface:emitter===reactEmitter?"module":"inline",label,show}));
    assert.equal(await page.locator('#root > * > *').count(),Number(label==='High'&&show),'hidden child must remove its flow host as well');
   }
  }finally{await page.close()}
 }
});

test('positioned components on both actual React surfaces require source enum presence AND the live Boolean at defaults and through switches',async t=>{
 const f=independentPresenceFixture(true),c=f.result.contract;
 const axis=c.props.find(p=>p.bindings.figma.property==='Power')!,boolean=c.props.find(p=>p.bindings.figma.property==='Show lamp')!;
 const values=Object.fromEntries(Object.entries(axis.bindings.figma.values!).map(([k,v])=>[v,k]));
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const ctx={contracts:f.scope,tokens:{primitives:f.result.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map<string,string>()},files=emitter.emit(c,ctx),dep=emitter.emit(f.child,ctx);
  const dependencies={[f.child.name]:{tsx:dep[0].contents,css:dep.find(file=>file.path.endsWith('.css'))?.contents}};
  assert.deepEqual(generatedTypeErrors(c.name,files[0].contents,{[f.child.name]:dep[0].contents}),[]);
  const page=await browser.newPage();try{
   const render=await mountGenerated(page,c.name,files[0].contents,files.find(file=>file.path.endsWith('.css'))?.contents,dependencies);
   await page.addStyleTag({content:mintedTokenCss(f.result.mintedTokens!.tree)});
   await render({});assert.equal(await page.getByText('Lamp',{exact:true}).count(),0);
   for(const [label,show] of [['Low',true],['High',true],['High',false],['Low',false],['High',true]] as const){
    await render({[axis.bindings.code.prop]:values[label],[boolean.bindings.code.prop]:show});
    assert.equal(await page.getByText('Lamp',{exact:true}).count(),Number(label==='High'&&show),JSON.stringify({surface:emitter===reactEmitter?"module":"inline",label,show}));
    if(label==='High'&&show) assert.deepEqual(await page.locator('#root > * > *').evaluate(el=>({position:getComputedStyle(el).position,left:getComputedStyle(el).left,top:getComputedStyle(el).top})),{position:'absolute',left:'7px',top:'-12px'});
   }
  }finally{await page.close()}
 }
});

function instanceRootInputFixture() {
 const base=fixture(false).child;
 const child=ContractSchema.parse({...base,props:[],anatomy:{root:{instanceRootInputs:['width','height','padding-left'],layout:{display:'flex',direction:'row'},
  literals:{width:'48px',height:'48px','padding-left':'4px','padding-right':'4px'},parts:{mark:{shape:{kind:'rect',width:20,height:20},literals:{'background-color':'#113355'}}}}}});
 const parent=ContractSchema.parse({...base,id:'check.root-host',name:'RootHost',props:[{name:'width-mode',type:{enum:['compact','roomy']},default:'compact',bindings:{code:{prop:'density',values:{compact:0,roomy:1}},figma:{kind:'VARIANT',property:'Density',values:{compact:'Compact',roomy:'Roomy'}}}}],anatomy:{root:{layout:{display:'flex',direction:'column'},parts:{usage:{component:{id:child.id,rootOverrides:{width:'{usage.width.{width-mode}}',height:'{usage.height}','padding-left':'{usage.padding-left}'}}}}}}});
 const tokens={primitives:{usage:{width:{compact:{$type:'dimension',$value:'24px'},roomy:{$type:'dimension',$value:'32px'}},height:{$type:'dimension',$value:'24px'},'padding-left':{$type:'dimension',$value:'0px'}}},semantic:{},light:{},dark:{},brands:{default:{}}};
 const scope=new Map([child,parent].map(c=>[c.id,c]));return {child,parent,tokens,scope};
}

test('declared root inputs resize only the real child usage on both React surfaces', async t => {
 const f=instanceRootInputFixture(),before=JSON.stringify(f.child),browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]) {
  const ctx={tokens:f.tokens,contracts:f.scope,icons:new Map<string,string>()},p=emitter.emit(f.parent,ctx),c=emitter.emit(f.child,ctx);
  assert.deepEqual(generatedTypeErrors(f.parent.name,p[0].contents,{[f.child.name]:c[0].contents}),[]);
  const page=await browser.newPage();try {
   const render=await mountGenerated(page,f.parent.name,p[0].contents,p.find(x=>x.path.endsWith('.css'))?.contents,{[f.child.name]:{tsx:c[0].contents,css:c.find(x=>x.path.endsWith('.css'))?.contents}});
   await page.addStyleTag({content:':root{--usage-width-compact:24px;--usage-width-roomy:32px;--usage-height:24px;--usage-padding-left:0px}'});
   for(const [density,width] of [[0,24],[1,32],[0,24]] as const){await render({density});const b=await page.locator('#root > * > * > *').evaluate(el=>{const root=el.parentElement!,s=getComputedStyle(root),m=el.getBoundingClientRect(),r=root.getBoundingClientRect();return {width:r.width,height:r.height,paddingLeft:s.paddingLeft,markWidth:m.width,markHeight:m.height}});assert.deepEqual(b,{width,height:24,paddingLeft:'0px',markWidth:20,markHeight:20});}
   await mountGenerated(page,f.child.name,c[0].contents,c.find(x=>x.path.endsWith('.css'))?.contents);
   const main=await page.locator('#root > *').boundingBox();assert.equal(main!.width,48);assert.equal(main!.height,48);
  }finally{await page.close()}
 }
 assert.equal(JSON.stringify(f.child),before);
});

test('root inputs refuse undeclared APIs, style collisions and competing subtree scaling',()=>{
 for(const emitter of [reactEmitter,reactInlineEmitter])for(const change of [
  (f:ReturnType<typeof instanceRootInputFixture>)=>{delete f.child.anatomy.root.instanceRootInputs},
  (f:ReturnType<typeof instanceRootInputFixture>)=>{f.child.anatomy.root.instanceRootInputs=['width']},
  (f:ReturnType<typeof instanceRootInputFixture>)=>{f.child.anatomy.root.instanceRootInputs!.push('width')},
  (f:ReturnType<typeof instanceRootInputFixture>)=>{f.child.props=[{name:'style',type:'text',bindings:{code:{prop:'style'},figma:{kind:'NONE'}}}]},
 ]){const f=instanceRootInputFixture();change(f);assert.throws(()=>{emitter.emit(f.child,{tokens:f.tokens,contracts:f.scope,icons:new Map()});emitter.emit(f.parent,{tokens:f.tokens,contracts:f.scope,icons:new Map()})},/instanceRootInputs|root override/)}
 const mixed=instanceRootInputFixture();mixed.child.anatomy.root.overridable=['size'];mixed.child.anatomy.root.tokens={width:'{usage.height}',height:'{usage.height}'};mixed.parent.anatomy.root.parts!.usage.component!.overrides={size:'{usage.height}'};
 assert.throws(()=>reactEmitter.emit(mixed.parent,{tokens:mixed.tokens,contracts:mixed.scope,icons:new Map()}),/mixes subtree size/);
 const f=instanceRootInputFixture();delete (f.tokens.primitives.usage.width as Record<string,unknown>).compact;
 assert.throws(()=>reactEmitter.emit(f.parent,{tokens:f.tokens,contracts:f.scope,icons:new Map()}),/rootOverrides.*does not exist/i);
});

test('native root inputs preserve child main geometry and resolve variant usage independently',async()=>{
 const f=instanceRootInputFixture(),engine=createFigmaEngine({tokens:f.tokens,icons:new Map()}),host=createFigmaMock(),context=vm.createContext({figma:host.figma,console:{log(){},warn(){},error(){}}});
 const run=(script:string)=>vm.runInContext(`(async()=>{${script}\n})()`,context);
 await run(engine.buildTokensScript(null));await run(engine.buildComponentScript(f.child,f.scope));
 const main=host.root.findOne(n=>['COMPONENT_SET','COMPONENT'].includes(n.type)&&n.getSharedPluginData('ds_contracts','contractId')===f.child.id)!;
 const mains=main.type==='COMPONENT_SET'?main.children!:[main];
 const before=mains.map(n=>[n.id,n.width,n.height,n.paddingLeft]);
 await run(engine.buildComponentScript(f.parent,f.scope));const owner=host.root.findOne(n=>n.type==='COMPONENT_SET'&&n.getSharedPluginData('ds_contracts','contractId')===f.parent.id)!;
 for(const variant of owner.children!){const usage=variant.findOne(n=>n.type==='INSTANCE'&&n.name==='usage')!;assert.equal(usage.width,variant.name.includes('Compact')?24:32);assert.equal(usage.height,24);assert.equal(usage.paddingLeft,0);assert.equal(usage.findOne(n=>n.name==='mark')!.width,20);}
 assert.deepEqual(mains.map(n=>[n.id,n.width,n.height,n.paddingLeft]),before);
});

test('indexed native identity lookup preserves ambiguity checks and sees changes between calls',()=>{
 const f=instanceRootInputFixture(),engine=createFigmaEngine({tokens:f.tokens,icons:new Map()}),host=createFigmaMock();
 const script=engine.buildComponentScript(f.parent,f.scope);
 const source=script.slice(script.indexOf('function isSyncTarget('),script.indexOf('function setInstanceProps('));
 const page=host.figma.currentPage as any,find=page.findAllWithCriteria.bind(page);let indexedCalls=0;
 page.findAllWithCriteria=(criteria:any)=>{indexedCalls++;assert.deepEqual(Array.from(criteria.types),['COMPONENT_SET','COMPONENT']);return find(criteria);};
 const resolve=vm.runInNewContext(source+'\nresolveComponentIdentity',{figma:host.figma});
 const make=(name:string,id:string,hash='')=>{const n=(host.figma as any).createComponent();n.name=name;page.appendChild(n);n.setSharedPluginData('ds_contracts','contractId',id);n.setSharedPluginData('ds_contracts','specHash',hash);return n;};
 const ref={contractId:'check.identity',name:'Target'},foreign=make('Target',''),own=make('Renamed',ref.contractId);
 assert.equal(resolve(ref,'semantic',false),own);
 const duplicate=make('Duplicate',ref.contractId);(host.figma as any).createPage().appendChild(duplicate);
 assert.throws(()=>resolve(ref,'duplicate',false),/duplicate ds_contracts/);duplicate.remove();
 assert.equal(resolve(ref,'after removal',false),own);
 own.setSharedPluginData('ds_contracts','contractId','other');
 assert.throws(()=>resolve({...ref,anchorKey:own.key},'anchor',false),/contradictory identity/);
 assert.equal(resolve(ref,'foreign',true),null);
 foreign.setSharedPluginData('ds_contracts','specHash','legacy');assert.equal(resolve(ref,'legacy',false),foreign);
 const legacy=make('Target','','legacy');assert.throws(()=>resolve(ref,'legacy duplicate',false),/duplicate explicit legacy/);legacy.remove();foreign.remove();
 assert.equal(resolve(ref,'optional missing',true),null);assert.throws(()=>resolve(ref,'required missing',false),/component not found/);
 assert(indexedCalls>0);
});

test('native instance root opacity uses unit values without percent-scaled variable bindings',async()=>{
 const f=instanceRootInputFixture();f.child.anatomy.root.instanceRootInputs!.push('opacity');
 f.parent.anatomy.root.parts!.usage.component!.rootOverrides!.opacity='{usage.opacity}';
 const values=f.tokens.primitives.usage as Record<string,unknown>;
 const host=createFigmaMock(),context=vm.createContext({figma:host.figma,console:{log(){},warn(){},error(){}}});
 const run=(script:string)=>vm.runInContext(`(async()=>{${script}\n})()`,context);
 for(const opacity of [0,0.7,1]){
  values.opacity={$type:'number',$value:opacity};
  const engine=createFigmaEngine({tokens:f.tokens,icons:new Map()});
  const compiled=engine.compileComponentData(f.parent,f.scope);
  for(const variant of compiled.variants){const usage=variant.spec.children![0];assert.equal(usage.opacity,opacity);assert.equal(usage.instanceRootOverrides?.opacity,undefined);}
  await run(engine.buildTokensScript(null));await run(engine.buildComponentScript(f.child,f.scope));await run(engine.buildComponentScript(f.parent,f.scope));
  const owner=host.root.findOne(n=>n.type==='COMPONENT_SET'&&n.getSharedPluginData('ds_contracts','contractId')===f.parent.id)!;
  for(const variant of owner.children!){const usage=variant.findOne(n=>n.type==='INSTANCE'&&n.name==='usage')!;assert.equal(usage.opacity,opacity);assert.equal((usage as any).boundVariables?.opacity,undefined);}
 }
});

test('root inputs reject unsupported targets and invalid pixel values without blocking unrelated manifest entries',()=>{
 const f=instanceRootInputFixture(),ctx={tokens:f.tokens,contracts:f.scope,icons:new Map<string,string>()};
 for(const emitter of [htmlEmitter,webComponentsEmitter]){assert.throws(()=>emitter.emit(f.parent,ctx),/instance-root-input-target-unsupported/);assert.doesNotThrow(()=>emitter.emit(f.child,ctx));}
 for(const value of ['-1px','2em','auto']){
  const invalid=instanceRootInputFixture();invalid.tokens.primitives.usage.height.$value=value;
  for(const emitter of [reactEmitter,reactInlineEmitter])assert.throws(()=>emitter.emit(invalid.parent,{tokens:invalid.tokens,contracts:invalid.scope,icons:new Map()}),/instance-root-input-value-unsupported/);
  assert.throws(()=>createFigmaEngine({tokens:invalid.tokens,icons:new Map()}).compileComponentData(invalid.parent,invalid.scope),/instance-root-input-value-unsupported/);
 }
});

function rootInputProposalFixture(boolean=false){
 const f=fixture(false,boolean);f.child.anatomy.root.instanceRootInputs=['width','height','padding-left'];f.child.anatomy.root.layout={display:'flex',direction:'row'};
 for(const [i,v] of f.set.variants.entries()){
  const n=v.children![0];n.instanceKey=`main-${i}`;n.instanceRootOverrides={nodeId:`use-${i}`,componentId:`main:${i}`,componentKey:n.instanceKey,componentSetKey:'indicator-key',localTransform:[[1,0,0],[0,1,0]],fields:['width','height','paddingLeft','preserveRatio'],localSize:{width:i?32:24,height:24}};
  n.layout={mode:'HORIZONTAL',primary:'CENTER',counter:'CENTER',spacing:0,padding:[4,4,4,0],primarySizing:'AUTO',counterSizing:'AUTO'};n.instanceSizing={horizontal:'HUG',vertical:'HUG'};n.bbox={width:999,height:999};
 }
 const run=()=>{const result=proposeFromDump(f.set,{corpus,mintUnbound:true,fileKey:'fixture',stampsObservable:true,contractIdByName:new Map([['Indicator',f.child.id]]),contractIdByKey:new Map([['indicator-key',f.child.id]]),contractsById:new Map([[f.child.id,asMinimalChildContract(f.child)]])});const c=ContractSchema.parse(result.contract);return {result,ref:walkAnatomy(c).find(r=>r.part.component?.id===f.child.id)!.part.component!}};
 return {...f,run};
}

test('source-qualified root inputs mint local authority through the child API without freezing HUG or using bbox',()=>{
 const f=rootInputProposalFixture(),before=JSON.stringify(f.child),result=f.run();
 assert.deepEqual(Object.keys(result.ref.rootOverrides??{}).sort(),['height','padding-left','width'],JSON.stringify(result.result.notes.filter(n=>n.includes('width')||n.includes('root'))));
 assert(result.result.mintedTokens!.entries.some(e=>e.value==='24px'));assert(result.result.mintedTokens!.entries.some(e=>e.value==='32px'));assert(!result.result.mintedTokens!.entries.some(e=>e.value==='999px'));
 assert(result.result.notes.some(n=>n.includes('root override fields not modeled')&&n.includes('preserveRatio')));
 f.set.variants.reverse();assert.deepEqual(f.run().ref.rootOverrides,result.ref.rootOverrides);assert.equal(JSON.stringify(f.child),before);
});

test('source root inputs decline missing authority, opaque identity and undeclared or competing values',()=>{
 const mutations=[
  (f:ReturnType<typeof rootInputProposalFixture>)=>{delete f.set.variants[0].children![0].instanceRootOverrides},
  (f:ReturnType<typeof rootInputProposalFixture>)=>{f.set.variants[0].children![0].instanceRootOverrides!.componentKey='foreign'},
  (f:ReturnType<typeof rootInputProposalFixture>)=>{f.set.variants[0].children![0].instanceRootOverrides!.componentSetKey='foreign'},
  (f:ReturnType<typeof rootInputProposalFixture>)=>{delete f.set.variants[0].children![0].instanceRootOverrides!.localTransform},
  (f:ReturnType<typeof rootInputProposalFixture>)=>{f.set.variants[0].children![0].instanceRootOverrides!.localTransform![0][0]=.5},
  (f:ReturnType<typeof rootInputProposalFixture>)=>{delete f.child.anatomy.root.instanceRootInputs},
  (f:ReturnType<typeof rootInputProposalFixture>)=>{f.child.bindings.figma.anchors.fileKey='foreign'},
  (f:ReturnType<typeof rootInputProposalFixture>)=>{delete f.set.variants[0].children![0].instanceRootOverrides!.localSize!.width},
  (f:ReturnType<typeof rootInputProposalFixture>)=>{f.set.variants[0].children![0].instanceRootOverrides!.localSize!.width=NaN},
  (f:ReturnType<typeof rootInputProposalFixture>)=>{f.set.variants[0].children![0].instanceRootOverrides!.fields=['height']},
  (f:ReturnType<typeof rootInputProposalFixture>)=>{f.set.variants[0].children![0].bound={width:'elsewhere/value'}},
 ];
 for(const change of mutations){const f=rootInputProposalFixture();change(f);const result=f.run();assert.equal(result.ref.rootOverrides?.width,undefined,String(change));assert(result.result.notes.some(n=>n.includes('instance-root-input-not-carried:width')));}
});


function rotatedRootInputFixture(){
 const f=rootInputProposalFixture(true);
 for(const v of f.set.variants){
  const n=v.children![0],w=n.instanceRootOverrides!;
  n.nodeId=w.nodeId;w.localTransform=[[0,-1,24],[1,0,0]];
  n.instanceGeometry={nodeId:w.nodeId,componentId:w.componentId,transform:structuredClone(w.localTransform) as [[number,number,number],[number,number,number]],
   localSize:{width:w.localSize!.width!,height:w.localSize!.height!}};
 }
 return f;
}

test('rotated local dimensions require consistent rigid capture and retain the separate transform limitation',()=>{
 const f=rotatedRootInputFixture(),r=f.run();
 assert(r.ref.rootOverrides?.width);assert(r.ref.rootOverrides?.height);
 assert.equal(r.ref.rootOverrides?.['padding-left'],undefined,'dimension evidence cannot authorize another channel');
 assert(r.result.notes.some(note=>note.includes('instance-affine-not-carried')));
 for(const change of [
  (n:any)=>{delete n.instanceGeometry},
  (n:any)=>{n.instanceGeometry.nodeId='foreign'},
  (n:any)=>{n.instanceGeometry.componentId='foreign'},
  (n:any)=>{n.instanceGeometry.localSize.width=999},
  (n:any)=>{delete n.instanceGeometry.localSize},
  (n:any)=>{n.instanceGeometry.transform[0][1]=-.5},
  (n:any)=>{n.instanceGeometry.transform[0][1]=-.5;n.instanceRootOverrides.localTransform[0][1]=-.5},
 ]){const bad=rotatedRootInputFixture();change(bad.set.variants[0].children![0]);assert.equal(bad.run().ref.rootOverrides?.width,undefined);}
});

for(const rotated of [false,true])test(`qualified source root inputs retain Boolean-dependent local sizes on both React surfaces (rotated capture: ${rotated})`,async t=>{
 const f=rotated?rotatedRootInputFixture():rootInputProposalFixture(true),before=JSON.stringify(f.child),result=f.run(),parent=ContractSchema.parse(result.result.contract);
 assert.match(result.ref.rootOverrides?.width??'',/\{active\}/);
 const tokens={primitives:result.result.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},scope=new Map([parent,f.child].map(c=>[c.id,c]));
 const browser=await chromium.launch();t.after(()=>browser.close());
 const axis=parent.props.find(p=>p.name==='active')!;
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const ctx={tokens,contracts:scope,icons:new Map<string,string>()},p=emitter.emit(parent,ctx),c=emitter.emit(f.child,ctx);
  assert.deepEqual(generatedTypeErrors(parent.name,p[0].contents,{[f.child.name]:c[0].contents}),[]);
  const page=await browser.newPage();try{
   const render=await mountGenerated(page,parent.name,p[0].contents,p.find(x=>x.path.endsWith('.css'))?.contents,{[f.child.name]:{tsx:c[0].contents,css:c.find(x=>x.path.endsWith('.css'))?.contents}});
   await page.addStyleTag({content:mintedTokenCss(tokens.primitives)});
   for(const [value,width] of [[false,24],[true,32],[false,24]] as const){await render({[axis.bindings!.code!.prop]:value});const bounds=await page.locator('#root > * > *').boundingBox();assert(bounds);assert.equal(bounds.width,width,JSON.stringify({surface:emitter===reactEmitter?"module":"inline",value}));assert.equal(bounds.height,24);}
  }finally{await page.close()}
 }
 const data=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(parent,scope);
 for(const variant of data.variants){
  const usage=variant.spec.children!.find(node=>node.type==='instance')!;
  assert.equal(usage.instanceRootOverrides?.width.px,variant.name.includes('True')?32:24);
  assert.equal(usage.instanceRootOverrides?.height.px,24);
  assert.equal(usage.instanceAffineAllocation,undefined,'dimension carriage must not invent an unqualified transform');
 }
 assert.equal(JSON.stringify(f.child),before);
});

function keyedIdentitySwapFixture(boolean=true){
 const f=fixture(false,boolean);f.child.props=[];f.child.anatomy.root={literals:{width:'24px',height:'24px','background-color':'#dd2200'}};
 const second=ContractSchema.parse({...structuredClone(f.child),id:'check.other-indicator',name:'OtherIndicator',anatomy:{root:{literals:{width:'24px',height:'24px','background-color':'#00aa44'}}},bindings:{figma:{anchors:{fileKey:'fixture',componentSetKey:'other-indicator-key'}},code:{anchors:{importPath:'./OtherIndicator',export:'OtherIndicator'}}}});
 for(const [i,v] of f.set.variants.entries()){const n=v.children![0];n.instanceOf=i?second.name:f.child.name;n.instanceKey=i?'other-main-key':'main-key';n.instanceSetKey=i?'other-indicator-key':'indicator-key';n.componentProperties={};}
 const run=()=>proposeFromDump(f.set,{corpus,mintUnbound:true,fileKey:'fixture',stampsObservable:true,contractIdByName:new Map([[f.child.name,f.child.id],[second.name,second.id]]),contractIdByKey:new Map([['indicator-key',f.child.id],['other-indicator-key',second.id]]),contractsById:new Map([f.child,second].map(c=>[c.id,asMinimalChildContract(c)]))});
 return {...f,second,run};
}

test('same-named keyed child replacements retain both identities and render the captured Boolean and enum choices',async t=>{
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const boolean of [true,false]){
  const f=keyedIdentitySwapFixture(boolean),before=JSON.stringify([f.child,f.second]),r=f.run(),parent=ContractSchema.parse(r.contract);
  assert.deepEqual(componentRefsOf(parent).map(x=>x.ref.id).sort(),[f.child.id,f.second.id].sort());
  f.set.variants.reverse();assert.deepEqual(componentRefsOf(ContractSchema.parse(f.run().contract)).map(x=>x.ref.id).sort(),[f.child.id,f.second.id].sort());
  const tokens={primitives:r.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}},scope=new Map([parent,f.child,f.second].map(c=>[c.id,c])),axis=parent.props.find(p=>p.name==='active')!;
  for(const emitter of [reactEmitter,reactInlineEmitter]){
   const ctx={tokens,contracts:scope,icons:new Map<string,string>()},p=emitter.emit(parent,ctx),children=[f.child,f.second].map(c=>({c,files:emitter.emit(c,ctx)}));
   assert.deepEqual(generatedTypeErrors(parent.name,p[0].contents,Object.fromEntries(children.map(({c,files})=>[c.name,files[0].contents]))),[]);
   const page=await browser.newPage();try{
    const render=await mountGenerated(page,parent.name,p[0].contents,p.find(x=>x.path.endsWith('.css'))?.contents,Object.fromEntries(children.map(({c,files})=>[c.name,{tsx:files[0].contents,css:files.find(x=>x.path.endsWith('.css'))?.contents}])));
    const values=axis.type==='boolean'?[false,true]:(axis.type as {enum:string[]}).enum;
    for(const i of [0,1,0]){await render({[axis.bindings!.code!.prop]:values[i]});const colors=await page.locator('#root *').evaluateAll(els=>els.filter(el=>{const b=el.getBoundingClientRect();return b.width>0&&b.height>0}).map(el=>getComputedStyle(el).backgroundColor).filter(c=>c!=='rgba(0, 0, 0, 0)'));assert.deepEqual(colors,[i?'rgb(0, 170, 68)':'rgb(221, 34, 0)']);}
   }finally{await page.close()}
  }
  assert.equal(JSON.stringify([f.child,f.second]),before);
 }
});

test('keyed child replacements refuse unlinked identities and unsupported placement instead of choosing the first child',()=>{
 for(const fault of ['unlinked','positioned']){
  const f=keyedIdentitySwapFixture();
  if(fault==='unlinked')f.second.bindings.figma.anchors.componentSetKey='contradicted-key';
  else f.set.variants[1].children![0].abs={x:0,y:0,width:24,height:24,right:0,bottom:0,constraints:{horizontal:'LEFT',vertical:'TOP'}};
  assert.throws(f.run,/figma-source-instance-identity-refused/);
 }
});

test('native keyed replacement branches select the correct child identity in each source plane',async()=>{
 const f=keyedIdentitySwapFixture(),parent=ContractSchema.parse(f.run().contract),scope=new Map([parent,f.child,f.second].map(c=>[c.id,c])),engine=createFigmaEngine({tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()}),host=createFigmaMock(),context=vm.createContext({figma:host.figma,console:{log(){},warn(){},error(){}}});
 const run=(code:string)=>vm.runInContext(`(async()=>{${code}\n})()`,context);
 await run(engine.buildComponentScript(f.child,scope));await run(engine.buildComponentScript(f.second,scope));await run(engine.buildComponentScript(parent,scope));
 const set=host.root.findOne(n=>n.type==='COMPONENT_SET'&&n.getSharedPluginData('ds_contracts','contractId')===parent.id)!;
 for(const variant of set.children!){const refs=variant.findAll(n=>n.type==='INSTANCE');assert.equal(refs.length,1);const main=await (refs[0] as unknown as {getMainComponentAsync:()=>Promise<{getSharedPluginData:(namespace:string,key:string)=>string}>}).getMainComponentAsync();assert.equal(main.getSharedPluginData('ds_contracts','contractId'),variant.name.includes('True')?f.second.id:f.child.id);}
});


test('contradictory fixed-caller owner keys refuse the owner rather than reusing its first main',()=>{
 const f=fixedContentFixture();f.set.variants[1].children![0].instanceSetKey='foreign-key';
 assert.throws(f.propose,/figma-source-instance-identity-refused.*foreign-key/);
});

test('source-qualified caller opacity uses unitless tokens and preserves child defaults',async t=>{
 const f=rootInputProposalFixture(true);f.child.anatomy.root.instanceRootInputs!.push('opacity');f.child.anatomy.root.tokens={...f.child.anatomy.root.tokens,opacity:'{child-default.opacity}'};
 for(const [i,v] of f.set.variants.entries()){const n=v.children![0];if(i===1){n.opacity=.38;n.instanceRootOverrides!.fields.push('opacity');}}
 const before=JSON.stringify(f.child),result=f.run(),parent=ContractSchema.parse(result.result.contract);
 assert.match(result.ref.rootOverrides?.opacity??'',/\{active\}/);
 assert(result.result.mintedTokens!.entries.some(e=>String(e.value)==='0.38'));
 const tokens={primitives:{...result.result.mintedTokens!.tree,'child-default':{opacity:{$type:'number',$value:0.8}}},semantic:{},light:{},dark:{},brands:{default:{}}},scope=new Map([parent,f.child].map(c=>[c.id,c])),axis=parent.props.find(p=>p.name==='active')!;
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const ctx={tokens,contracts:scope,icons:new Map<string,string>()},p=emitter.emit(parent,ctx),c=emitter.emit(f.child,ctx);assert.deepEqual(generatedTypeErrors(parent.name,p[0].contents,{[f.child.name]:c[0].contents}),[]);
  const page=await browser.newPage();try{
   const render=await mountGenerated(page,parent.name,p[0].contents,p.find(x=>x.path.endsWith('.css'))?.contents,{[f.child.name]:{tsx:c[0].contents,css:c.find(x=>x.path.endsWith('.css'))?.contents}});await page.addStyleTag({content:mintedTokenCss(tokens.primitives)});
   for(const [value,opacity] of [[false,'1'],[true,'0.38'],[false,'1']] as const){await render({[axis.bindings!.code!.prop]:value});assert.equal(await page.locator('#root > * > *').evaluate(n=>getComputedStyle(n).opacity),opacity);}
   await mountGenerated(page,f.child.name,c[0].contents,c.find(x=>x.path.endsWith('.css'))?.contents);await page.addStyleTag({content:mintedTokenCss(tokens.primitives)});assert.equal(await page.locator('#root > *').evaluate(n=>getComputedStyle(n).opacity),'0.8');
  }finally{await page.close()}
 }
 const engine=createFigmaEngine({tokens,icons:new Map()}),host=createFigmaMock(),context=vm.createContext({figma:host.figma,console:{log(){},warn(){},error(){}}}),run=(s:string)=>vm.runInContext(`(async()=>{${s}\n})()`,context);
 await run(engine.buildTokensScript(null));await run(engine.buildComponentScript(f.child,scope));await run(engine.buildComponentScript(parent,scope));
 const owner=host.root.findOne(n=>n.type==='COMPONENT_SET'&&n.getSharedPluginData('ds_contracts','contractId')===parent.id)!;
 for(const variant of owner.children!){const use=variant.findOne(n=>n.type==='INSTANCE')!;assert.equal(use.opacity,variant.name.toLowerCase().includes('true')?.38:1);}
 assert.equal(JSON.stringify(f.child),before);
});

test('caller opacity refuses malformed unitless values and missing API or source authority',()=>{
 for(const value of [-.1,1.1,'38%','0.38px','NaN']){
  const f=instanceRootInputFixture();f.child.anatomy.root.instanceRootInputs!.push('opacity');f.parent.anatomy.root.parts!.usage.component!.rootOverrides={opacity:'{usage.opacity}'};
  (f.tokens.primitives.usage as Record<string,unknown>).opacity={$type:'number',$value:value};
  for(const emitter of [reactEmitter,reactInlineEmitter])assert.throws(()=>emitter.emit(f.parent,{tokens:f.tokens,contracts:f.scope,icons:new Map()}),/instance-root-input-value-unsupported/);
  assert.throws(()=>createFigmaEngine({tokens:f.tokens,icons:new Map()}).compileComponentData(f.parent,f.scope),/instance-root-input-value-unsupported/);
 }
 for(const change of [
  (f:ReturnType<typeof rootInputProposalFixture>)=>{f.child.anatomy.root.instanceRootInputs!.pop()},
  (f:ReturnType<typeof rootInputProposalFixture>)=>{f.set.variants[0].children![0].bound={opacity:'foreign/opacity'}},
  (f:ReturnType<typeof rootInputProposalFixture>)=>{f.set.variants[0].children![0].opacity=1.1},
  (f:ReturnType<typeof rootInputProposalFixture>)=>{delete f.set.variants[0].children![0].instanceRootOverrides},
 ]){const f=rootInputProposalFixture();f.child.anatomy.root.instanceRootInputs!.push('opacity');f.set.variants[1].children![0].opacity=.38;f.set.variants[1].children![0].instanceRootOverrides!.fields.push('opacity');change(f);const r=f.run();assert.equal(r.ref.rootOverrides?.opacity,undefined);assert(r.result.notes.some(n=>n.includes('instance-root-input-not-carried:opacity')));}
});


function freshOpacityBatchFixture(){
 const child:DumpSet={setName:'Mark',type:'COMPONENT',nodeId:'1:1',key:'mark-key',variants:[{name:'Mark',type:'COMPONENT',opacity:.8,bbox:{width:24,height:24},layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'FIXED',counterSizing:'FIXED'},children:[{name:'ink',type:'RECTANGLE',fill:{hex:'113355'},shape:{kind:'rect',width:20,height:20}}]}]};
 const parent:DumpSet={setName:'Opacity host',type:'COMPONENT_SET',nodeId:'2:1',key:'host-key',propertyDefinitions:{Density:{type:'VARIANT',defaultValue:'Opaque',variantOptions:['Opaque','Muted']}},variants:['Opaque','Muted'].map((label,i)=>({name:`Density=${label}`,type:'COMPONENT',variantProperties:{Density:label},bbox:{width:24,height:24},layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'FIXED',counterSizing:'FIXED'},children:[{name:'usage',type:'INSTANCE',instanceOf:'Mark',instanceKey:'mark-key',...(i?{opacity:.38}:{}),instanceRootOverrides:{nodeId:`2:${i+2}`,componentId:'1:1',componentKey:'mark-key',fields:i?['opacity']:['name']}}]}))};
 return {child,parent,dump:{Mark:child,'Opacity host':parent},options:{corpus,mintUnbound:true,fileKey:'fixture',stampsObservable:true,contractIdByName:new Map<string,string>()}};
}

test('fresh batch declares generated opacity before resolving callers on both React surfaces',async t=>{
 const f=freshOpacityBatchFixture(),before=JSON.stringify(f.dump),batch=proposeBatchFromDump(f.dump,f.options);assert.deepEqual(batch.skipped,[]);
 const contracts=batch.proposals.map(p=>ContractSchema.parse(p.contract)),child=contracts.find(c=>c.name==='Mark')!,parent=contracts.find(c=>c.id!==child.id)!;
 assert.deepEqual(child.anatomy.root.instanceRootInputs,['opacity','width','height','background-color']);assert(walkAnatomy(parent).some(r=>r.part.component?.rootOverrides?.opacity));assert.equal(JSON.stringify(f.dump),before);
 const primitives:Record<string,unknown>={};
 function merge(target:Record<string,unknown>,source:Record<string,unknown>){for(const [key,value] of Object.entries(source)){if(value&&typeof value==='object'&&!('$value' in value)){const nested=(target[key]??={}) as Record<string,unknown>;merge(nested,value as Record<string,unknown>)}else {if(key in target)assert.deepEqual(target[key],value);target[key]=value}}}
 for(const p of batch.proposals)merge(primitives,p.mintedTokens?.tree??{});
 const tokens={primitives,semantic:{},light:{},dark:{},brands:{default:{}}},scope=new Map(contracts.map(c=>[c.id,c]));
 const axis=parent.props.find(p=>p.bindings.figma.kind==='VARIANT')!,prop=axis.bindings.code.prop,values=Object.entries(axis.bindings.figma.values!);
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){const ctx={tokens,contracts:scope,icons:new Map<string,string>()},c=emitter.emit(child,ctx),p=emitter.emit(parent,ctx);assert.deepEqual(generatedTypeErrors(parent.name,p[0].contents,{[child.name]:c[0].contents}),[]);
  const page=await browser.newPage();try{const render=await mountGenerated(page,parent.name,p[0].contents,p.find(f=>f.path.endsWith('.css'))?.contents,{[child.name]:{tsx:c[0].contents,css:c.find(f=>f.path.endsWith('.css'))?.contents}});await page.addStyleTag({content:mintedTokenCss(primitives)});
   for(const label of ['Opaque','Muted','Opaque']){await render({[prop]:values.find(([,v])=>v===label)![0]});assert.equal(await page.locator('#root > * > *').evaluate(n=>getComputedStyle(n).opacity),label==='Muted'?'0.38':'1');}
   await mountGenerated(page,child.name,c[0].contents,c.find(f=>f.path.endsWith('.css'))?.contents);await page.addStyleTag({content:mintedTokenCss(primitives)});assert.equal(await page.locator('#root > *').evaluate(n=>getComputedStyle(n).opacity),'0.8');
  }finally{await page.close()}
 }
 const engine=createFigmaEngine({tokens,icons:new Map()}),host=createFigmaMock(),context=vm.createContext({figma:host.figma,console:{log(){},warn(){},error(){}}}),run=(script:string)=>vm.runInContext(`(async()=>{${script}\n})()`,context);
 await run(engine.buildTokensScript(null));await run(engine.buildComponentScript(child,scope));
 const main=host.root.findOne(n=>n.type==='COMPONENT'&&n.getSharedPluginData('ds_contracts','contractId')===child.id)!;assert.equal(main.opacity,.8);
 await run(engine.buildComponentScript(parent,scope));const owner=host.root.findOne(n=>n.type==='COMPONENT_SET'&&n.getSharedPluginData('ds_contracts','contractId')===parent.id)!;
 for(const variant of owner.children!)assert.equal(variant.findOne(n=>n.type==='INSTANCE')!.opacity,variant.name.includes('Muted')?.38:1);
 assert.equal(main.opacity,.8);
});

test('fresh batch never grants root opacity to supplied or unobservable child APIs',()=>{
 const f=freshOpacityBatchFixture(),plain=ContractSchema.parse(proposeFromDump(f.child,f.options).contract),original=JSON.stringify(plain);
 for(const options of [{...f.options,stampsObservable:false},{...f.options,contractsById:new Map([[plain.id,asMinimalChildContract(plain)]])}]){
  const b=proposeBatchFromDump(f.dump,options),c=b.proposals.find(p=>p.setName==='Mark')!;assert.equal(ContractSchema.parse(c.contract).anatomy.root.instanceRootInputs,undefined);assert(!b.proposals.some(p=>walkAnatomy(ContractSchema.parse(p.contract)).some(r=>r.part.component?.rootOverrides?.opacity)));
 }
 assert.equal(JSON.stringify(plain),original);
});


test('stamped batch children do not acquire a fresh generated opacity API',()=>{
 const f=freshOpacityBatchFixture();f.child.contractId='authored.mark';
 const b=proposeBatchFromDump(f.dump,f.options),child=b.proposals.find(p=>p.setName==='Mark')!;
 assert.equal(ContractSchema.parse(child.contract).anatomy.root.instanceRootInputs,undefined);
});

test('named caller slots preserve explicit routing and refuse missing targets or content', () => {
  const f = fixedContentFixture('iconStart'), proposal = f.propose();
  const c = ContractSchema.parse(proposal.contract);
  const part = walkAnatomy(c).find(p=>p.part.component?.id===f.child.id)!.part;
  assert.equal(part.component!.contentSlot,'iconStart');
  assert.equal(f.child.anatomy.root.parts!.region.parts!.well.slot!.name,'iconStart');
  assert(componentRefsOf(c).some(r=>r.ref.id===f.target.id));
  const scope=new Map([...f.scope,[c.id,c]]);
  const ctx={contracts:scope,tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map<string,string>()};
  for (const target of ['missing','iconStart']) {
    part.component!.contentSlot=target;
    if(target==='iconStart')delete part.parts;
    assert.throws(()=>reactEmitter.emit(c,ctx), /slot|caller parts/);
    assert.throws(()=>createFigmaEngine(ctx).compileComponentData(c,scope), /slot|caller parts/);
  }
});

test('named slot standalone defaults and explicit caller clearing stay independent', async t => {
  const f=fixedContentFixture('iconStart');
  f.child.anatomy.root.parts!.region.parts!.well.slot!.renderDefault=true;
  const ctx={contracts:f.scope,tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map<string,string>()};
  const browser=await chromium.launch();t.after(()=>browser.close());
  for(const emitter of [reactEmitter,reactInlineEmitter]){
    const files=emitter.emit(f.child,ctx),dependencies=Object.fromEntries([f.sample,f.target].map(c=>{
      const out=emitter.emit(c,ctx);return[c.name,{tsx:out[0].contents,css:out.find(f=>f.path.endsWith('.css'))?.contents}];
    }));
    const page=await browser.newPage();
    try{
      const render=await mountGenerated(page,f.child.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents,dependencies);
      await render({});assert.equal(await page.getByText('Sample only',{exact:true}).count(),1);
      await render({iconStart:'External caller'});assert.equal(await page.getByText('External caller',{exact:true}).count(),1);
      assert.equal(await page.getByText('Sample only',{exact:true}).count(),0);
      await render({iconStart:null});assert.equal(await page.getByText('Sample only',{exact:true}).count(),0);
      await render({});assert.equal(await page.getByText('Sample only',{exact:true}).count(),1);
    }finally{await page.close();}
  }
});

test('declared instance root paint changes only the usage on both React surfaces',async t=>{
 const f=instanceRootInputFixture();f.child.anatomy.root.instanceRootInputs=['background-color'];f.child.anatomy.root.literals={'background-color':'#113355',width:'20px',height:'20px','border-radius':'6px'};delete f.child.anatomy.root.parts;
 f.parent.anatomy.root.parts!.usage.component!.rootOverrides={'background-color':'{usage.paint.{width-mode}}'};f.parent.anatomy.root.parts!.plain={component:{id:f.child.id}};
 (f.tokens.primitives.usage as any).paint={compact:{$type:'color',$value:'#ff0000'},roomy:{$type:'color',$value:'{usage.blue}'}};(f.tokens.primitives.usage as any).blue={$type:'color',$value:'rgba(0,0,255,0.5)'};
 const browser=await chromium.launch();t.after(()=>browser.close());const before=JSON.stringify([f.child,f.parent]);
 for(const emitter of [reactEmitter,reactInlineEmitter]){const ctx={tokens:f.tokens,contracts:f.scope,icons:new Map<string,string>()},child=emitter.emit(f.child,ctx),parent=emitter.emit(f.parent,ctx);const page=await browser.newPage();try{
  const render=await mountGenerated(page,f.parent.name,parent[0].contents,parent.find(x=>x.path.endsWith('.css'))?.contents,{[f.child.name]:{tsx:child[0].contents,css:child.find(x=>x.path.endsWith('.css'))?.contents}});await page.addStyleTag({content:mintedTokenCss(f.tokens.primitives)});
  for(const [density,color] of [[0,'rgb(255, 0, 0)'],[1,'rgba(0, 0, 255, 0.5)'],[0,'rgb(255, 0, 0)']] as const){await render({density});assert.deepEqual(await page.locator('#root > * > *').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).backgroundColor)),[color,'rgb(17, 51, 85)']);}
 }finally{await page.close()}}
 assert.equal(JSON.stringify([f.child,f.parent]),before);
 for(const value of ['url(bad)','rgba(0,0,256,1)','rgba(0,0,0,2)','red;display:none']){(f.tokens.primitives.usage as any).blue.$value=value;for(const emitter of [reactEmitter,reactInlineEmitter])assert.throws(()=>emitter.emit(f.parent,{tokens:f.tokens,contracts:f.scope,icons:new Map()}),/instance-root-input-color-unsupported/);assert.throws(()=>createFigmaEngine({tokens:f.tokens,icons:new Map()}).compileComponentData(f.parent,f.scope),/instance-root-input-color-unsupported/);}
});

function boundRootPaintProposalFixture(){
 const f=rootInputProposalFixture();f.child.anatomy.root.instanceRootInputs!.push('background-color');
 for(const [i,v] of f.set.variants.entries()){
  const n=v.children![0],id='paint-'+i,color={r:i?0:1,g:0,b:i?1:0},value={...color,a:1};
  n.nodeId=n.instanceRootOverrides!.nodeId;n.instanceRootOverrides!.fields=i?['fills']:[];
  n.sourceNormalFillComposition={variableId:id,paint:{color,opacity:1,blendMode:'NORMAL'}};
  n.variableConsumers={[id]:{name:id,collectionId:'theme',modeId:'light',modeName:'Light',resolvedType:'COLOR',value,selectedValue:{type:'VARIABLE_ALIAS',id:'base-'+i},aliasChain:[{id:'base-'+i,name:'base-'+i,collectionId:'palette',modeId:'base',modeName:'Base',resolvedType:'COLOR',value,selectedValue:value}]}};
 }
 return f;
}
test('public proposal preserves qualified root paint aliases through exact occurrence classification',()=>{
 const f=boundRootPaintProposalFixture(),before=JSON.stringify(f.set),r=f.run();
 assert(r.ref.rootOverrides?.['background-color'],JSON.stringify(r.result.notes.filter(n=>n.includes('root'))));
 const tree=r.result.mintedTokens!.tree as any;assert.equal(Object.keys(tree.sourcePaint).length,4);
 assert.equal(Object.values(tree.sourcePaint).filter((v:any)=>v.$value.startsWith('{')).length,2);
 assert.equal(JSON.stringify(f.set),before);const original=r.ref.rootOverrides;f.set.variants.reverse();assert.deepEqual(f.run().ref.rootOverrides,original);
});
test('root paint proposal refuses missing authority, consumer mismatch and cross-occurrence graph conflicts',()=>{
 for(const change of [
  (f:ReturnType<typeof boundRootPaintProposalFixture>)=>{delete f.set.variants[0].children![0].instanceRootOverrides},
  (f:ReturnType<typeof boundRootPaintProposalFixture>)=>{f.set.variants[0].children![0].nodeId='different'},
  (f:ReturnType<typeof boundRootPaintProposalFixture>)=>{delete f.set.variants[0].children![0].variableConsumers},
  (f:ReturnType<typeof boundRootPaintProposalFixture>)=>{f.set.variants[0].children![0].variableConsumers!['paint-0'].value={r:0,g:0,b:0,a:1}},
  (f:ReturnType<typeof boundRootPaintProposalFixture>)=>{f.set.variants[0].children![0].variableConsumers!['paint-0'].modeId='dark'},
  (f:ReturnType<typeof boundRootPaintProposalFixture>)=>{f.child.anatomy.root.instanceRootInputs=['opacity']},
 ]){const f=boundRootPaintProposalFixture();change(f);const r=f.run();assert.equal(r.ref.rootOverrides?.['background-color'],undefined);assert(r.result.notes.some(n=>n.includes('instance-root-input-not-carried:fills')));}
});

test('fresh batch root paint API renders qualified aliases on both public React surfaces',async t=>{
 const f=freshOpacityBatchFixture(),source=boundRootPaintProposalFixture();
 const main=f.child.variants[0],a=source.set.variants[0].children![0],b=source.set.variants[1].children![0];
 main.sourceNormalFillComposition=a.sourceNormalFillComposition;main.variableConsumers=a.variableConsumers;main.fill={hex:'ff0000'};
 for(const [i,v] of f.parent.variants.entries()){const n=v.children![0],paint=i?b:a;delete n.opacity;n.nodeId=n.instanceRootOverrides!.nodeId;n.instanceRootOverrides!.fields=i?['fills']:[];n.sourceNormalFillComposition=paint.sourceNormalFillComposition;n.variableConsumers=paint.variableConsumers;}
 const batch=proposeBatchFromDump(f.dump,f.options);assert.deepEqual(batch.skipped,[]);
 const contracts=batch.proposals.map(p=>ContractSchema.parse(p.contract)),child=contracts.find(c=>c.name==='Mark')!,parent=contracts.find(c=>c.id!==child.id)!;
 assert(child.anatomy.root.instanceRootInputs?.includes('background-color'));assert(walkAnatomy(parent).some(r=>r.part.component?.rootOverrides?.['background-color']));
 const primitives:any={};
 // Keep both proposals' imported namespace, which the batch shares by component.
 function merge(t:any,s:any){for(const [k,v]of Object.entries(s)){if(v&&typeof v==='object'&&!('$value'in v))merge(t[k]??={},v);else t[k]=v;}}
 for(const p of batch.proposals)merge(primitives,p.mintedTokens?.tree??{});
 const ctx={tokens:{primitives,semantic:{},light:{},dark:{},brands:{default:{}}},contracts:new Map(contracts.map(c=>[c.id,c])),icons:new Map<string,string>()},browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){const c=emitter.emit(child,ctx),p=emitter.emit(parent,ctx),page=await browser.newPage();try{const render=await mountGenerated(page,parent.name,p[0].contents,p.find(x=>x.path.endsWith('.css'))?.contents,{[child.name]:{tsx:c[0].contents,css:c.find(x=>x.path.endsWith('.css'))?.contents}});await page.addStyleTag({content:mintedTokenCss(primitives)});const prop=parent.props.find(p=>p.bindings.figma.property==='Density')!;
 for(const [label,color]of [['Opaque','rgb(255, 0, 0)'],['Muted','rgb(0, 0, 255)'],['Opaque','rgb(255, 0, 0)']]){const value=Object.entries(prop.bindings.figma.values!).find(([,v])=>v===label)![0];await render({[prop.bindings.code.prop]:value});assert.equal(await page.locator('#root > * > *').first().evaluate(n=>getComputedStyle(n).backgroundColor),color);}
 }finally{await page.close()}}
});


test('instance sizes preserve joint enum and boolean observations without changing the child main', () => {
  const f = fixedContentFixture();
  f.target.anatomy.root = {declared:{position:'relative'},tokens:{width:'{drawing.size}',height:'{drawing.size}'},overridable:['size'],parts:{
    ink:{shape:{kind:'path',width:12,height:8,paths:[{data:'M0 0L12 0L6 8Z',windingRule:'NONZERO'}],
      parentViewport:{width:24,height:24,x:3,y:4}},tokens:{'background-color':'{drawing.ink}'}},
  }};
  f.set.propertyDefinitions!.Density = {type:'VARIANT',defaultValue:'Small',variantOptions:['Small','Large']};
  f.set.variants = f.set.variants.flatMap(v => ['Small','Large'].map(density => {
    const row = structuredClone(v), size = density === 'Small' ? (v.variantProperties!.Power === 'True' ? 12 : 10) : 16;
    row.name += `, Density=${density}`;
    row.variantProperties = {...row.variantProperties,Density:density};
    row.children![0].fixedSwaps!.Payload.observedInstances=[{nodeId:'instance:1',path:[0],componentId:'40:1',
      size:{width:size,height:size},parentSize:{width:size,height:size},relativeTransform:[[1,0,0],[0,1,0]],constraints:{horizontal:'SCALE',vertical:'SCALE'}}];
    return row;
  }));
  const before=JSON.stringify([...f.scope]),result=f.propose(),contract=ContractSchema.parse(result.contract);
  const ref=walkAnatomy(contract).find(p=>p.part.component?.id===f.target.id)?.part.component?.overrides?.size;
  assert(ref?.includes('{active}') && ref.includes('{density}'),String(ref));
  assert.equal(JSON.stringify([...f.scope]),before);
  assert.deepEqual([...new Set(result.mintedTokens!.entries.filter(e=>e.ref.includes('.size.')).map(e=>e.value))].sort(),['10px','12px','16px']);
});


test('fresh generated container dimensions require independent local resize authority', () => {
 const make = () => {
  const f=freshOpacityBatchFixture();
  f.parent.variants.forEach((v,i)=>{
   const n=v.children![0];n.instanceRootOverrides!.fields.push('width','height');
   n.instanceRootOverrides!.localSize={width:i?48:32,height:24};
   n.instanceRootOverrides!.localTransform=[[1,0,0],[0,1,0]];
  });return f;
 };
 const f=make(),before=JSON.stringify(f.dump),run=(f:ReturnType<typeof make>)=>proposeBatchFromDump(f.dump,f.options);
 const batch=run(f),parent=ContractSchema.parse(batch.proposals.find(p=>p.setName==='Opacity host')!.contract);
 const ref=walkAnatomy(parent).find(r=>r.part.component)?.part.component;
 assert(ref?.rootOverrides?.width);assert(ref.rootOverrides.height);
 assert.equal(JSON.stringify(f.dump),before);
 assert.deepEqual(batch.proposals.find(p=>p.setName==='Mark')!.contract.anatomy,proposeBatchFromDump(freshOpacityBatchFixture().dump,f.options).proposals.find(p=>p.setName==='Mark')!.contract.anatomy);
 for(const change of [
  (f:ReturnType<typeof make>)=>{delete f.parent.variants[0].children![0].instanceRootOverrides!.localTransform},
  (f:ReturnType<typeof make>)=>{f.parent.variants[0].children![0].instanceRootOverrides!.componentKey='wrong-key'},
  (f:ReturnType<typeof make>)=>{f.parent.variants[0].children![0].instanceRootOverrides!.fields=['opacity']},
 ]){
  const changed=make();change(changed);const b=run(changed),p=ContractSchema.parse(b.proposals.find(p=>p.setName==='Opacity host')!.contract);
  assert(!walkAnatomy(p).some(r=>r.part.component?.rootOverrides?.width),String(change));
 }
});

test('fresh generated padding inputs carry explicit keyed callers without granting unstated overrides',()=>{
 const make=()=>{
  const f=freshOpacityBatchFixture();
  f.parent.variants.forEach((v,i)=>{
   const n=v.children![0];n.nodeId=n.instanceRootOverrides!.nodeId;
   n.instanceRootOverrides!.fields.push('paddingTop');
   n.instanceRootOverrides!.localTransform=[[1,0,0],[0,1,0]];
   n.layout={mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[i?8:4,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'};
  });return f;
 };
 const f=make(),before=JSON.stringify(f.dump),batch=proposeBatchFromDump(f.dump,f.options);
 const child=ContractSchema.parse(batch.proposals.find(p=>p.setName==='Mark')!.contract);
 assert(child.anatomy.root.instanceRootInputs!.includes('padding-top'));
 assert(!child.anatomy.root.instanceRootInputs!.includes('padding-bottom'));
 const parent=ContractSchema.parse(batch.proposals.find(p=>p.setName==='Opacity host')!.contract);
 assert(walkAnatomy(parent).some(r=>r.part.component?.rootOverrides?.['padding-top']));
 assert.equal(JSON.stringify(f.dump),before);
 for(const change of [
  (f:ReturnType<typeof make>)=>{delete f.parent.variants[0].children![0].instanceRootOverrides!.localTransform},
  (f:ReturnType<typeof make>)=>{f.parent.variants[0].children![0].instanceRootOverrides!.componentKey='wrong-key'},
  (f:ReturnType<typeof make>)=>{f.parent.variants[0].children![0].instanceRootOverrides!.fields=['name']},
 ]){const f=make();change(f);const b=proposeBatchFromDump(f.dump,f.options),p=ContractSchema.parse(b.proposals.find(p=>p.setName==='Opacity host')!.contract);assert(!walkAnatomy(p).some(r=>r.part.component?.rootOverrides?.['padding-top']));}
 const stamped=make();stamped.child.contractId='authored.mark';
 assert(!ContractSchema.parse(proposeBatchFromDump(stamped.dump,stamped.options).proposals.find(p=>p.setName==='Mark')!.contract).anatomy.root.instanceRootInputs);
});

test('fresh generated resize API preserves filled-path coordinate-basis validation', async t => {
 const child:DumpSet={setName:'Glyph',type:'COMPONENT',nodeId:'1:1',key:'glyph-key',variants:[{name:'Glyph',type:'COMPONENT',nodeId:'1:1',bbox:{width:24,height:24},children:[{name:'Vector',type:'VECTOR',nodeId:'1:2',fill:{hex:'000000'},shape:{kind:'path',width:12,height:8,paths:[{data:'M0 0L12 0L6 8Z',windingRule:'NONZERO'}],x:3,y:4,right:9,bottom:12,constraints:{horizontal:'SCALE',vertical:'SCALE'}}}]}]};
 const batch=proposeBatchFromDump({Glyph:child},{corpus,mintUnbound:true,fileKey:'fixture',stampsObservable:true,contractIdByName:new Map()});
 assert.deepEqual(batch.skipped,[]);
 const contract=ContractSchema.parse(batch.proposals[0].contract);
 assert(contract.anatomy.root.parts!.Vector.shape?.parentViewport);
 assert.deepEqual(contract.anatomy.root.instanceRootInputs,['opacity','width','height']);
 const tokens={primitives:batch.proposals[0].mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}};
 const scope=new Map([[contract.id,contract]]),browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(contract,{contracts:scope,tokens,icons:new Map()});
  const page=await browser.newPage();
  try{
   const render=await mountGenerated(page,contract.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents);
   await page.addStyleTag({content:mintedTokenCss(tokens.primitives)});
   for(const [width,height] of [[24,24],[48,72],[36,12]]){
    await render({style:{width,height}});
    const geometry=await page.locator('#root > *').evaluate(root=>{
     const r=root.getBoundingClientRect(),p=root.querySelector('path')!.getBoundingClientRect();
     return {width:r.width,height:r.height,x:p.x-r.x,y:p.y-r.y,pathWidth:p.width,pathHeight:p.height};
    });
    for(const [key,expected] of Object.entries({width,height,x:width*3/24,y:height*4/24,pathWidth:width*12/24,pathHeight:height*8/24}))
     assert(Math.abs(geometry[key as keyof typeof geometry]-expected)<0.02,`${emitter.name} ${width}x${height} ${key}: ${JSON.stringify(geometry)}`);
   }
  }finally{await page.close();}
 }
 const invalid=structuredClone(contract);invalid.anatomy.root.instanceRootInputs!.push('padding-left');
 assert.throws(()=>reactEmitter.emit(invalid,{contracts:new Map([[invalid.id,invalid]]),tokens,icons:new Map()}),/filled-path-parent-basis-unsupported|auto-layout root/);
});

test('root paint keeps resolved solids and explicit empty fills without inventing variable aliases',()=>{
 const make=()=>{const f=boundRootPaintProposalFixture();for(const v of f.set.variants){delete v.children![0].variableConsumers;v.children![0].fill={hex:'0000ff'};}
  const n=f.set.variants[0].children![0];delete n.sourceNormalFillComposition;delete n.fill;n.sourceEmptyFill=true;return f;};
 const f=make(),before=JSON.stringify(f.set),r=f.run();assert(r.ref.rootOverrides?.['background-color']);
 assert(r.result.mintedTokens!.entries.some(e=>e.value==='rgba(0,0,0,0)'));
 assert(r.result.mintedTokens!.entries.some(e=>e.value==='rgba(0,0,255,1)'));
 assert(!(r.result.mintedTokens!.tree as any).sourcePaint);assert.equal(JSON.stringify(f.set),before);
 for(const change of [(f:ReturnType<typeof make>)=>{delete f.set.variants[0].children![0].sourceEmptyFill},(f:ReturnType<typeof make>)=>{f.set.variants[0].children![0].fill={hex:'ffffff'}},(f:ReturnType<typeof make>)=>{f.set.variants[0].children![0].imagePaints=[{index:0,imageHash:'contradiction'}]},(f:ReturnType<typeof make>)=>{f.set.variants[1].children![0].instanceRootOverrides!.componentKey='wrong'}]){const bad=make();change(bad);assert.equal(bad.run().ref.rootOverrides?.['background-color'],undefined);}
});

test('unchanged dimensions complete a mixed resize mapping only with matching captured main geometry',()=>{
 const prepare=()=>{
  const f=rootInputProposalFixture();
  for(const [i,v] of f.set.variants.entries()){
   const n=v.children![0],w=n.instanceRootOverrides!;
   n.instanceGeometry={nodeId:n.nodeId!,componentId:w.componentId,transform:w.localTransform! as [[number,number,number],[number,number,number]],localSize:{width:i?32:24,height:24}};
   w.mainSize={width:24,height:24};
  }
  const w=f.set.variants[0].children![0].instanceRootOverrides!;
  w.fields=w.fields.filter(x=>x!=='width');delete w.localSize!.width;
  return f;
 };
 const f=prepare(),r=f.run();assert(r.ref.rootOverrides?.width);assert(r.result.mintedTokens!.entries.some(e=>e.value==='32px'));assert(r.result.mintedTokens!.entries.some(e=>e.value==='24px'));
 for(const mutate of [
  (n:any)=>delete n.instanceRootOverrides.mainSize,
  (n:any)=>n.instanceRootOverrides.mainSize.width=23,
  (n:any)=>n.instanceGeometry.componentId='other',
  (n:any)=>n.instanceGeometry.nodeId='other',
  (n:any)=>n.instanceGeometry.transform=[[1,0,1],[0,1,0]],
 ]){const bad=prepare();mutate(bad.set.variants[0].children![0]);assert.equal(bad.run().ref.rootOverrides?.width,undefined);}
});

test('multiple caller slots preserve both React payloads and native linked contents',async t=>{
 const f=fixedContentFixture('iconStart');
 f.child.anatomy.root.parts!.region.parts!.caption={slot:{name:'children',bindings:{figma:{property:'Caption'}},defaultContent:[{id:f.sample.id}]}};
 const parent=ContractSchema.parse(f.propose().contract),part=walkAnatomy(parent).find(w=>w.part.component?.id===f.child.id)!.part;
 part.parts!.captionText={text:'Actual label'};part.component!.contentSlots={iconStart:['selectedContent'],children:['captionText']};delete part.component!.contentSlot;
 f.scope.set(parent.id,parent);const ctx={contracts:f.scope,tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map<string,string>()};
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){const files=emitter.emit(parent,ctx),deps=Object.fromEntries([...f.scope.values()].filter(c=>c.id!==parent.id).map(c=>{const fs=emitter.emit(c,ctx);return[c.name,{tsx:fs[0].contents,css:fs.find(f=>f.path.endsWith('.css'))?.contents}];}));const page=await browser.newPage();try{const render=await mountGenerated(page,parent.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents,deps);for(const power of [false,true,false]){await render({power});assert.equal(await page.getByText('Actual label',{exact:true}).count(),1);assert.equal(await page.getByText('Selected content',{exact:true}).count(),1);assert.equal(await page.getByText('Sample only',{exact:true}).count(),0);}}finally{await page.close();}}
 const engine=createFigmaEngine(ctx),host=createFigmaMock(),context=vm.createContext({figma:host.figma,console:{log(){},warn(){},error(){}}}),run=(script:string)=>vm.runInContext(`(async()=>{${script}\n})()`,context);
 await run(engine.buildTokensScript(null));for(const c of [f.sample,f.target,f.child])await run(engine.buildComponentScript(c,f.scope));
 const main=host.root.findOne(n=>n.type==='COMPONENT_SET'&&n.getSharedPluginData('ds_contracts','contractId')===f.child.id)!;const before=main.findAll().map(n=>[n.id,n.type,n.name,n.characters]);
 await run(engine.buildComponentScript(parent,f.scope));assert.deepEqual(main.findAll().map(n=>[n.id,n.type,n.name,n.characters]),before);
 const owner=host.root.findOne(n=>n.type==='COMPONENT_SET'&&n.getSharedPluginData('ds_contracts','contractId')===parent.id)!;
 for(const variant of owner.children!)assert.deepEqual(variant.findAll(n=>n.type==='TEXT').map(n=>n.characters).sort(),['Actual label','Selected content']);
 for(const routes of [{iconStart:['selectedContent'],children:['selectedContent','captionText']},{iconStart:['missing'],children:['captionText']},{iconStart:['selectedContent']},{missing:['selectedContent','captionText']}] as Array<Record<string,string[]>>){part.component!.contentSlots=routes;assert.throws(()=>reactEmitter.emit(parent,ctx),/CALLER_SLOTS|slot/);assert.throws(()=>engine.compileComponentData(parent,f.scope),/CALLER_SLOTS|slot/);}
});

test('outside root stroke requires complete keyed source authority and paired child inputs',()=>{
 const make=()=>{const f=rootInputProposalFixture();f.child.anatomy.root.instanceRootInputs!.push('outline-color','outline-width');
  for(const v of f.set.variants){const n=v.children![0];n.nodeId=n.instanceRootOverrides!.nodeId;n.stroke={hex:'ffffff'};n.strokeWeight=2;n.strokeAlign='OUTSIDE';n.instanceRootOverrides!.fields.push('strokes','strokeWeight','strokeAlign');}
  return f;};
 const f=make(),before=JSON.stringify(f.child),r=f.run();
 assert.ok(r.ref.rootOverrides?.['outline-color']);assert.ok(r.ref.rootOverrides?.['outline-width']);assert.equal(JSON.stringify(f.child),before);
 for(const change of [(f:ReturnType<typeof make>)=>{f.set.variants[1].children![0].instanceRootOverrides!.componentKey='wrong';},
  (f:ReturnType<typeof make>)=>{f.set.variants[1].children![0].strokeAlign='INSIDE';},
  (f:ReturnType<typeof make>)=>{delete f.set.variants[1].children![0].stroke;},
  (f:ReturnType<typeof make>)=>{f.child.anatomy.root.instanceRootInputs!.pop();}]){
  const bad=make();change(bad);const result=bad.run();assert.equal(result.ref.rootOverrides?.['outline-color'],undefined);assert.equal(result.ref.rootOverrides?.['outline-width'],undefined);
  assert.ok(result.result.notes.some(n=>n.includes('instance-root-stroke-not-carried')));
 }
});

test('outside stroke updates only the selected usage in both React surfaces and native instances',async t=>{
 const f=instanceRootInputFixture();f.child.anatomy.root.instanceRootInputs=['outline-color','outline-width'];
 f.child.anatomy.root.literals={width:'24px',height:'24px','border-radius':'12px'};
 f.parent.anatomy.root.parts!.usage.component!.rootOverrides={'outline-color':'{usage.ink}','outline-width':'{usage.stroke.{width-mode}}'};
 f.parent.anatomy.root.parts!.plain={component:{id:f.child.id}};
 Object.assign(f.tokens.primitives.usage,{ink:{$type:'color',$value:'#ffffff'},stroke:{compact:{$type:'dimension',$value:'2px'},roomy:{$type:'dimension',$value:'4px'}}});
 const browser=await chromium.launch();t.after(()=>browser.close());const before=JSON.stringify(f.child);
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const ctx={tokens:f.tokens,contracts:f.scope,icons:new Map<string,string>()},child=emitter.emit(f.child,ctx),parent=emitter.emit(f.parent,ctx),page=await browser.newPage();
  try{const render=await mountGenerated(page,f.parent.name,parent[0].contents,parent.find(x=>x.path.endsWith('.css'))?.contents,{[f.child.name]:{tsx:child[0].contents,css:child.find(x=>x.path.endsWith('.css'))?.contents}});
   await page.addStyleTag({content:mintedTokenCss(f.tokens.primitives)});
   for(const density of [0,1,0]){await render({density});const values=await page.locator('#root > * > *').evaluateAll(nodes=>nodes.map(n=>{const s=getComputedStyle(n),b=n.getBoundingClientRect();return {stroke:s.outlineWidth,color:s.outlineColor,width:b.width,height:b.height}}));
    assert.equal(values[0].stroke,density?'4px':'2px');assert.equal(values[0].color,'rgb(255, 255, 255)');assert.equal(values[0].width,24);assert.equal(values[0].height,24);assert.notEqual(values[1].color,'rgb(255, 255, 255)');}
  }finally{await page.close();}
 }
 const engine=createFigmaEngine({tokens:f.tokens,icons:new Map()}),host=createFigmaMock(),context=vm.createContext({figma:host.figma,console:{log(){},warn(){},error(){}}});
 const run=(script:string)=>vm.runInContext(`(async()=>{${script}\n})()`,context);
 await run(engine.buildTokensScript(null));await run(engine.buildComponentScript(f.child,f.scope));await run(engine.buildComponentScript(f.parent,f.scope));
 const owner=host.root.findOne(n=>n.type==='COMPONENT_SET'&&n.getSharedPluginData('ds_contracts','contractId')===f.parent.id)!;
 for(const variant of owner.children!){const usage=variant.findOne(n=>n.type==='INSTANCE'&&n.name==='usage')!,plain=variant.findOne(n=>n.type==='INSTANCE'&&n.name==='plain')!;
  assert.equal(usage.strokeAlign,'OUTSIDE');assert.equal(usage.strokeWeight,variant.name.includes('Compact')?2:4);assert.equal(usage.strokes.length,1);assert.equal(plain.strokes.length,0);assert.equal(usage.width,24);}
 assert.equal(JSON.stringify(f.child),before);
 delete f.parent.anatomy.root.parts!.usage.component!.rootOverrides!['outline-width'];
 for(const emitter of [reactEmitter,reactInlineEmitter])assert.throws(()=>emitter.emit(f.parent,{tokens:f.tokens,contracts:f.scope,icons:new Map()}),/instance-root-stroke requires both/);
});

test('an unrelated component with the same contract id does not suppress fresh root capabilities',()=>{
 const f=freshOpacityBatchFixture();const original=ContractSchema.parse(proposeBatchFromDump(f.dump,f.options).proposals.find(p=>p.setName==='Mark')!.contract);
 for(const key of ['another-kit-key',original.bindings.figma.anchors.componentSetKey]){
  const existing=structuredClone(original);existing.bindings.figma.anchors={fileKey:'other-file',componentSetKey:key,nodeId:'900:1'};delete existing.anatomy.root.instanceRootInputs;
  const before=JSON.stringify(existing);const result=proposeBatchFromDump(f.dump,{...f.options,contractsById:new Map([[existing.id,asMinimalChildContract(existing)]])});
  const generated=ContractSchema.parse(result.proposals.find(p=>p.setName==='Mark')!.contract);
  assert.equal(!!generated.anatomy.root.instanceRootInputs,key==='another-kit-key');assert.equal(JSON.stringify(existing),before);
 }
});


function jointEnumFixture(){
 const f=fixture(false,false),prototype=f.set.variants[0];
 f.set.propNames=undefined;
 f.set.propertyDefinitions=Object.fromEntries(['A','B','C'].map(k=>[k,{type:'VARIANT',defaultValue:'Low',variantOptions:['Low','High']}]));
 f.set.variants=[];
 for(const a of ['Low','High'])for(const b of ['Low','High'])for(const c of ['Low','High']){
  const node=structuredClone(prototype);node.name=`A=${a}, B=${b}, C=${c}`;node.variantProperties={A:a,B:b,C:c};
  node.children![0].componentProperties={Powered:a==='High'&&b==='High'&&c==='High'?'High':'Low'};f.set.variants.push(node);
 }
 return f;
}
test('joint enum child selection preserves three-axis observations and refuses incomplete evidence',async t=>{
 const f=jointEnumFixture(),result=propose(f),table=result.ref.enumPropsByCombination!.lit;
 assert.equal(table.rows.length,8);assert.equal(result.ref.props?.lit,undefined);
 const {resolveBooleanArguments}=await import('./component-boolean-arguments.js');
 for(const row of table.rows)assert.equal(resolveBooleanArguments(f.child,result.ref,Object.fromEntries(table.props.map((p,i)=>[p,row.values[i]!]))).lit,row.values.every(v=>v==='high')?'strong':'quiet');
 const missing=structuredClone(result.contract);walkAnatomy(missing).find(w=>w.part.component)!.part.component!.enumPropsByCombination!.lit.rows.pop();assert.equal(ContractSchema.safeParse(missing).success,false);
 const invalid=structuredClone(result.ref);invalid.enumPropsByCombination!.lit.rows[0].value='invented';assert.throws(()=>resolveBooleanArguments(f.child,invalid,{}),/child-unqualified/);
 const conflicting=structuredClone(result.ref);conflicting.props={lit:'quiet'};assert.throws(()=>resolveBooleanArguments(f.child,conflicting,{}),/conflicting/);
 const incomplete=jointEnumFixture();delete incomplete.set.variants[0].children![0].componentProperties;assert.equal(propose(incomplete).ref.enumPropsByCombination,undefined);
 const browser=await chromium.launch();t.after(()=>browser.close());
 const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
 const scope=new Map([[result.contract.id,result.contract],[f.child.id,f.child]]),ctx={contracts:scope,tokens,icons:new Map<string,string>()};
 assert.throws(()=>htmlEmitter.emit(result.contract,ctx),/HTML_ENUM_ARGUMENTS_UNSUPPORTED/);
 assert.throws(()=>webComponentsEmitter.emit(result.contract,ctx),/WEB_COMPONENT_ENUM_ARGUMENTS_UNSUPPORTED/);
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const parent=emitter.emit(result.contract,ctx),child=emitter.emit(f.child,ctx),page=await browser.newPage();
  try{const render=await mountGenerated(page,result.contract.name,parent[0].contents,parent.find(x=>x.path.endsWith('.css'))?.contents,{[f.child.name]:{tsx:child[0].contents,css:child.find(x=>x.path.endsWith('.css'))?.contents}});
   for(const row of [...table.rows,...table.rows.slice().reverse()]){
    await render(Object.fromEntries(table.props.map((p,i)=>[result.contract.props.find(prop=>prop.name===p)!.bindings.code.prop,row.values[i]])));
    assert.equal(await page.locator('#root > * > *').first().evaluate(n=>getComputedStyle(n).backgroundColor),row.values.every(v=>v==='high')?'rgb(0, 170, 68)':'rgb(221, 34, 0)');
   }
  }finally{await page.close();}
 }
 const engine=createFigmaEngine({tokens,icons:new Map()}),host=createFigmaMock(),context=vm.createContext({figma:host.figma,console:{log(){},warn(){},error(){}}});
 const run=(script:string)=>vm.runInContext(`(async()=>{${script}\n})()`,context);
 await run(engine.buildTokensScript(null));await run(engine.buildComponentScript(f.child,scope));await run(engine.buildComponentScript(result.contract,scope));
 const owner=host.root.findOne(n=>n.type==='COMPONENT_SET'&&n.getSharedPluginData('ds_contracts','contractId')===result.contract.id)!;
 assert.equal(owner.children!.length,8);
 for(const variant of owner.children!){const instance=variant.findOne(n=>n.type==='INSTANCE')!;assert.equal(instance.componentProperties!.Powered.value,variant.name.split('High').length===4?'High':'Low');}
});


test('conditional fixed swaps select caller content on both React surfaces and native instances',async t=>{
 const f=fixedContentFixture();f.set.variants[1].children![0].fixedSwaps!.Payload={id:'40:2',key:'sample-key',name:'renamed'};
 const before=JSON.stringify([...f.scope]),parent=ContractSchema.parse(f.propose().contract);f.scope.set(parent.id,parent);
 const hostPart=walkAnatomy(parent).find(w=>w.part.component?.id===f.child.id)!.part;
 assert.equal(Object.keys(hostPart.parts!).length,2);assert(Object.values(hostPart.parts!).every(p=>p.presenceByCombination));
 const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},ctx={tokens,contracts:f.scope,icons:new Map<string,string>()};
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const output=emitter.emit(parent,ctx),deps=Object.fromEntries([f.child,f.sample,f.target].map(c=>{const files=emitter.emit(c,ctx);return[c.name,{tsx:files[0].contents,css:files.find(f=>f.path.endsWith('.css'))?.contents}]}));
  const page=await browser.newPage();try{const render=await mountGenerated(page,parent.name,output[0].contents,output.find(f=>f.path.endsWith('.css'))?.contents,deps);
   for(const power of [false,true,false]){await render({[parent.props.find(p=>p.bindings.figma.kind==='VARIANT')!.bindings.code.prop]:power});assert.equal(await page.getByText('Selected content',{exact:true}).count(),power?0:1);assert.equal(await page.getByText('Sample only',{exact:true}).count(),power?1:0);}
  }finally{await page.close();}
 }
 const engine=createFigmaEngine({tokens,icons:new Map()}),host=createFigmaMock(),context=vm.createContext({figma:host.figma,console:{log(){},warn(){},error(){}}});
 const run=(s:string)=>vm.runInContext(`(async()=>{${s}\n})()`,context);await run(engine.buildTokensScript(null));
 for(const c of [f.sample,f.target,f.child,parent])await run(engine.buildComponentScript(c,f.scope));
 const owner=host.root.findOne(n=>n.type==='COMPONENT_SET'&&n.getSharedPluginData('ds_contracts','contractId')===parent.id)!;
 for(const variant of owner.children!)assert.deepEqual(variant.findAll(n=>n.type==='TEXT').map(n=>n.characters),[variant.name.includes('True')?'Sample only':'Selected content']);
 f.scope.delete(parent.id);assert.equal(JSON.stringify([...f.scope]),before);
});


test('conditional caller swaps refuse unresolved branches without changing linked mains',()=>{
 for(const bad of ['unknown-key','wrong-id','missing-swap']){
  const f=fixedContentFixture(),before=JSON.stringify([...f.scope]);
  f.set.variants[1].children![0].fixedSwaps!.Payload={id:bad==='wrong-id'?'40:99':'40:2',key:bad==='unknown-key'?'unknown':'sample-key',name:'irrelevant'};
  if(bad==='missing-swap')delete f.set.variants[1].children![0].fixedSwaps;
  const result=f.propose(),parent=ContractSchema.parse(result.contract),part=walkAnatomy(parent).find(w=>w.part.component?.id===f.child.id)!.part;
  assert.equal(part.parts,undefined);assert(result.notes.some(n=>n.includes('fixed-swap-caller-not-carried')));assert.equal(JSON.stringify([...f.scope]),before);
 }
});

test('conditional child visibility does not make root input selection ill-typed', async t => {
 const f=instanceRootInputFixture();
 f.parent.anatomy.root.parts!.usage.visibleWhen={prop:'width-mode',equals:'roomy'};
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]) {
  const ctx={tokens:f.tokens,contracts:f.scope,icons:new Map<string,string>()},p=emitter.emit(f.parent,ctx),c=emitter.emit(f.child,ctx);
  assert.deepEqual(generatedTypeErrors(f.parent.name,p[0].contents,{[f.child.name]:c[0].contents}),[]);
  const page=await browser.newPage();try {
   const render=await mountGenerated(page,f.parent.name,p[0].contents,p.find(x=>x.path.endsWith('.css'))?.contents,{[f.child.name]:{tsx:c[0].contents,css:c.find(x=>x.path.endsWith('.css'))?.contents}});
   await page.addStyleTag({content:':root{--usage-width-compact:24px;--usage-width-roomy:32px;--usage-height:24px;--usage-padding-left:0px}'});
   for(const density of [0,1,0]) {
    await render({density});
    const usage=page.locator('#root > * > *');
    assert.equal(await usage.count(),density===1?1:0);
    if(density===1)assert.equal((await usage.boundingBox())!.width,32);
   }
  }finally{await page.close()}
 }
});


test('mixed inherited and overridden padding requires independent matching main padding',()=>{
 const make=()=>{const f=rootInputProposalFixture();const n=f.set.variants[0].children![0],w=n.instanceRootOverrides!;
  n.nodeId=w.nodeId;w.fields=w.fields.filter(field=>field!=='paddingLeft');w.mainPadding=[4,4,4,0];
  f.set.variants[1].children![0].layout!.padding[3]=12;return f;};
 const f=make(),before=JSON.stringify(f.set),r=f.run();assert(r.ref.rootOverrides?.['padding-left']);
 assert(r.result.mintedTokens!.entries.some(e=>e.value==='12px'));assert.equal(JSON.stringify(f.set),before);
 f.set.variants.reverse();assert.deepEqual(f.run().ref.rootOverrides,r.ref.rootOverrides);
 for(const mutate of [
  (n:DumpNode)=>{delete n.instanceRootOverrides!.mainPadding;},
  (n:DumpNode)=>{n.instanceRootOverrides!.mainPadding![3]=1;},
  (n:DumpNode)=>{n.instanceRootOverrides!.mainPadding![0]=NaN;},
  (n:DumpNode)=>{n.nodeId='foreign';},
  (n:DumpNode)=>{n.instanceRootOverrides!.componentKey='foreign';},
  (n:DumpNode)=>{delete n.instanceRootOverrides!.localTransform;},
  (n:DumpNode)=>{n.bound={paddingLeft:'unknown/token'};},
 ]){const bad=make();mutate(bad.set.variants[0].children![0]);assert.equal(bad.run().ref.rootOverrides?.['padding-left'],undefined);}
});

test('fresh empty containers accept identity-qualified local resize without changing supplied APIs',()=>{
 const make=()=>{
  const f=freshOpacityBatchFixture();f.child.variants[0].children=[];
  f.child.variants[0].layout!.primarySizing='AUTO';f.child.variants[0].layout!.counterSizing='AUTO';
  f.parent.variants.forEach((v,i)=>{const n=v.children![0];n.nodeId=n.instanceRootOverrides!.nodeId;
   n.instanceRootOverrides!.fields.push('width','height');
   n.instanceRootOverrides!.localSize={width:i?48:32,height:24};
   n.instanceRootOverrides!.localTransform=[[1,0,0],[0,1,0]];
  });return f;
 };
 const f=make(),before=JSON.stringify(f.dump),batch=proposeBatchFromDump(f.dump,f.options);
 assert.deepEqual(batch.skipped,[]);
 const child=ContractSchema.parse(batch.proposals.find(p=>p.setName==='Mark')!.contract);
 assert(child.anatomy.root.instanceRootInputs?.includes('width'));
 assert(child.anatomy.root.instanceRootInputs?.includes('height'));
 const parent=ContractSchema.parse(batch.proposals.find(p=>p.setName==='Opacity host')!.contract);
 assert(walkAnatomy(parent).some(r=>r.part.component?.rootOverrides?.width));
 assert(walkAnatomy(parent).some(r=>r.part.component?.rootOverrides?.height));
 assert.equal(JSON.stringify(f.dump),before);
 for(const mutate of [
  (f:ReturnType<typeof make>)=>{f.child.contractId='authored.mark';},
  (f:ReturnType<typeof make>)=>{f.options.stampsObservable=false;},
 ]){const f=make();mutate(f);const b=proposeBatchFromDump(f.dump,f.options);assert(!ContractSchema.parse(b.proposals.find(p=>p.setName==='Mark')!.contract).anatomy.root.instanceRootInputs);}
 const moving=make();moving.parent.variants[0].children![0].abs={x:0,y:0,right:0,bottom:0,width:32,height:24,constraints:{horizontal:'STRETCH',vertical:'CENTER'}};
 const m=proposeBatchFromDump(moving.dump,moving.options),p=ContractSchema.parse(m.proposals.find(p=>p.setName==='Opacity host')!.contract);
 assert(!walkAnatomy(p).some(r=>r.part.component?.rootOverrides?.width),'stretch must not become a fixed local width');
});

test('direct positioned child geometry requires matching source identity and measured local basis',()=>{
 const make=()=>{
  const f=freshOpacityBatchFixture();f.child.variants[0].children=[];
  for(const v of f.parent.variants){const n=v.children![0];n.nodeId=n.instanceRootOverrides!.nodeId;
   n.abs={x:-2,y:-2,width:28,height:28,right:-2,bottom:-2,constraints:{horizontal:'STRETCH',vertical:'CENTER'}};
   n.instanceGeometry={nodeId:n.nodeId!,componentId:'1:1',localSize:{width:28,height:28},transform:[[1,0,-2],[0,1,-2]]};
  }return f;
 };
 const direct=(f:ReturnType<typeof make>)=>{
  const batch=proposeBatchFromDump(f.dump,f.options);assert.deepEqual(batch.skipped,[]);
  const parent=ContractSchema.parse(batch.proposals.find(p=>p.setName==='Opacity host')!.contract);
  return walkAnatomy(parent).some(({part})=>part.component&&(part.absoluteGeometry||part.absoluteGeometryByCombination));
 };
 const f=make(),before=JSON.stringify(f.dump);assert(direct(f));assert.equal(JSON.stringify(f.dump),before);
 for(const mutate of [
  (f:ReturnType<typeof make>)=>{f.options.stampsObservable=false;},
  (f:ReturnType<typeof make>)=>{f.parent.variants[0].children![0].instanceGeometry!.nodeId='wrong';},
  (f:ReturnType<typeof make>)=>{f.parent.variants[0].children![0].instanceGeometry!.localSize.width=29;},
  (f:ReturnType<typeof make>)=>{f.parent.variants[0].children![0].instanceGeometry!.transform[0][1]=.1;},
 ]){const f=make();mutate(f);assert(!direct(f));}
 const rounded=make();rounded.parent.variants[0].children![0].instanceGeometry!.localSize.width+=.0000038;assert(direct(rounded));
});

test('direct absolute component geometry preserves enum presence together with a live Boolean',async t=>{
 const f=independentPresenceFixture(true);
 f.child.anatomy.root.instanceRootInputs=['width','height'];
 for(const v of f.set.variants)v.bbox={width:40,height:20};
 const n=f.set.variants[1].children![0];n.nodeId='3:1';n.instanceGeometry={nodeId:'3:1',componentId:'1:1',transform:[[1,0,7],[0,1,-12]],localSize:{width:18,height:10}};
 const result=proposeFromDump(f.set,{fileKey:'fixture',corpus,mintUnbound:true,stampsObservable:true,contractIdByName:new Map([['Indicator',f.child.id]]),contractIdByKey:new Map([['indicator-key',f.child.id]]),contractsById:new Map([[f.child.id,asMinimalChildContract(f.child)]])});
 const c=ContractSchema.parse(result.contract),part=walkAnatomy(c).find(r=>r.part.component?.id===f.child.id)!.part;
 assert(part.absoluteGeometry);assert.deepEqual(part.visibleWhen,{prop:'showLamp'});
 assert.deepEqual(part.presenceByCombination,{props:['active'],rows:[{values:['low'],present:false},{values:['high'],present:true}]});
 const scope=new Map([[c.id,c],[f.child.id,f.child]]);
 const native=createFigmaEngine({tokens:{primitives:result.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()}).compileComponentData(c,scope);
 for(const v of native.variants)assert.equal(v.spec.children!.length,v.name.includes('Low')?0:1);
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const ctx={contracts:scope,tokens:{primitives:result.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map<string,string>()},files=emitter.emit(c,ctx),dep=emitter.emit(f.child,ctx);
  const page=await browser.newPage();try{
   const render=await mountGenerated(page,c.name,files[0].contents,files.find(x=>x.path.endsWith('.css'))?.contents,{[f.child.name]:{tsx:dep[0].contents,css:dep.find(x=>x.path.endsWith('.css'))?.contents}});
   await page.addStyleTag({content:mintedTokenCss(result.mintedTokens!.tree)});
   for(const [active,showLamp] of [['low',true],['high',true],['high',false],['low',false],['high',true]] as const){await render({active,showLamp});assert.equal(await page.getByText('Lamp',{exact:true}).count(),Number(active==='high'&&showLamp));}
  }finally{await page.close();}
 }
});

test('promoted disabled state preserves qualified instance dimensions without changing the state API',async t=>{
 const make=()=>{
  const f=rootInputProposalFixture();delete f.set.propNames;
  f.set.propertyDefinitions={State:{type:'VARIANT',defaultValue:'Default',variantOptions:['Default','Disabled']}};
  for(const [i,v] of f.set.variants.entries()){
   const state=i?'Disabled':'Default';v.name=`State=${state}`;v.variantProperties={State:state};v.opacity=i?.5:1;
   const n=v.children![0];n.componentProperties={Powered:'Low'};n.nodeId=n.instanceRootOverrides!.nodeId;
   n.instanceRootOverrides!.localSize={width:32,height:i?44:48};
   n.instanceGeometry={nodeId:n.nodeId!,componentId:n.instanceRootOverrides!.componentId,transform:[[1,0,0],[0,1,0]],localSize:{width:32,height:i?44:48}};
  }
  return f;
 };
 const f=make(),before=JSON.stringify(f.set),r=f.run(),parent=ContractSchema.parse(r.result.contract);
 assert.match(r.ref.rootOverrides!.height!,/\{disabled\}/);
 assert(parent.props.some(p=>p.name==='disabled'&&p.type==='boolean'));
 assert(!parent.props.some(p=>p.name==='state'));
 const tokens={primitives:r.result.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},scope=new Map([parent,f.child].map(c=>[c.id,c]));
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const ctx={tokens,contracts:scope,icons:new Map<string,string>()},p=emitter.emit(parent,ctx),c=emitter.emit(f.child,ctx);
  assert.deepEqual(generatedTypeErrors(parent.name,p[0].contents,{[f.child.name]:c[0].contents}),[]);
  const page=await browser.newPage();try{
   const render=await mountGenerated(page,parent.name,p[0].contents,p.find(x=>x.path.endsWith('.css'))?.contents,{[f.child.name]:{tsx:c[0].contents,css:c.find(x=>x.path.endsWith('.css'))?.contents}});
   await page.addStyleTag({content:mintedTokenCss(tokens.primitives)});
   for(const disabled of [false,true,false,true]){await render({disabled});assert.equal(await page.locator('#root > * > *').evaluate(n=>n.getBoundingClientRect().height),disabled?44:48);}
  }finally{await page.close();}
 }
 const native=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(parent,scope);
 assert.equal(native.variants[0].spec.children![0].instanceRootOverrides!.height.px,48);
 assert.equal(native.stateVariants!.find(v=>v.name.includes('Disabled'))!.spec.children![0].instanceRootOverrides!.height.px,44);
 assert.equal(JSON.stringify(f.set),before);
 f.set.variants.reverse();assert.deepEqual(f.run().ref.rootOverrides,r.ref.rootOverrides);
 for(const mutate of [
  (n:DumpNode)=>{n.instanceRootOverrides!.componentKey='foreign';},
  (n:DumpNode)=>{delete n.instanceRootOverrides;},
  (n:DumpNode)=>{n.name='unmatched';},
 ]){const bad=make();mutate(bad.set.variants[1].children![0]);assert(!bad.run().ref.rootOverrides?.height?.includes('{disabled}'));}
});

test('inherited fill style overrides carry independently observed root paint without inventing an alias',()=>{
 const make=()=>{
  const f=boundRootPaintProposalFixture();
  for(const [i,v]of f.set.variants.entries()){
   const n=v.children![0];delete n.variableConsumers;n.instanceRootOverrides!.fields=i?['inheritFillStyleId']:[];
   if(i)n.fill={hex:'0000ff'};else{delete n.sourceNormalFillComposition;delete n.fill;n.sourceEmptyFill=true;}
  }
  return f;
 };
 const f=make(),r=f.run();assert(r.ref.rootOverrides?.['background-color']);
 assert(r.result.mintedTokens!.entries.some(e=>e.value==='rgba(0,0,255,1)'));
 assert(r.result.mintedTokens!.entries.some(e=>e.value==='rgba(0,0,0,0)'));
 assert(!(r.result.mintedTokens!.tree as any).sourcePaint);
 for(const change of [
  (f:ReturnType<typeof make>)=>{delete f.set.variants[1].children![0].sourceNormalFillComposition;},
  (f:ReturnType<typeof make>)=>{f.set.variants[1].children![0].fill={hex:'ff0000'};},
  (f:ReturnType<typeof make>)=>{f.set.variants[1].children![0].instanceRootOverrides!.componentKey='wrong';},
  (f:ReturnType<typeof make>)=>{f.set.variants[1].children![0].instanceRootOverrides!.fields=[];},
 ]){const bad=make();change(bad);assert.equal(bad.run().ref.rootOverrides?.['background-color'],undefined);}
});


test('cross-axis root fill follows parent resizing on both React surfaces and compiles native FILL',async t=>{
 const f=instanceRootInputFixture(),usage=f.parent.anatomy.root.parts!.usage.component!;
 delete usage.rootOverrides!.width;usage.rootFill=['width'];f.parent.anatomy.root.literals={width:'200px'};
 const ctx={tokens:f.tokens,contracts:f.scope,icons:new Map<string,string>()},browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const p=emitter.emit(f.parent,ctx),c=emitter.emit(f.child,ctx),page=await browser.newPage();
  const render=await mountGenerated(page,f.parent.name,p[0].contents,p.find(x=>x.path.endsWith('.css'))?.contents,{[f.child.name]:{tsx:c[0].contents,css:c.find(x=>x.path.endsWith('.css'))?.contents}});
  await page.addStyleTag({content:':root{--usage-height:24px;--usage-padding-left:0px}'});
  for(const width of [200,400,160]){await render({style:{width}});const box=await page.locator('#root > * > *').boundingBox();assert.equal(box!.width,width);assert.equal(box!.height,24);}
  await page.close();
 }
 const native=createFigmaEngine({tokens:f.tokens,icons:new Map()}).compileComponentData(f.parent,f.scope);
 for(const v of native.variants){assert.equal(v.spec.children![0].fillW,true);assert.equal(v.spec.children![0].fillH,undefined);}
 const host=createFigmaMock(),context=vm.createContext({figma:host.figma,console:{log(){},warn(){},error(){}}}),engine=createFigmaEngine({tokens:f.tokens,icons:new Map()});
 const run=async(script:string)=>vm.runInContext(`(async()=>{${script}})()`,context);
 await run(engine.buildTokensScript(null));await run(engine.buildComponentScript(f.child,f.scope));await run(engine.buildComponentScript(f.parent,f.scope));
 const owner=host.root.findOne(n=>n.type==='COMPONENT_SET'&&n.getSharedPluginData('ds_contracts','contractId')===f.parent.id)!;
 for(const variant of owner.children!){const usage=variant.findOne(n=>n.type==='INSTANCE'&&n.name==='usage')!;assert.equal((usage as any).layoutSizingHorizontal,'FILL');}
 for(const emitter of [htmlEmitter,webComponentsEmitter])assert.throws(()=>emitter.emit(f.parent,ctx),/instance-root-input-target-unsupported/);
 for(const mutation of ['conflict','hug','auto','axis','api']){
  const bad=structuredClone(f.parent),scope=new Map(f.scope);scope.set(bad.id,bad);
  if(mutation==='conflict')bad.anatomy.root.parts!.usage.component!.rootOverrides!.width='{usage.height}';
  if(mutation==='hug')bad.anatomy.root.literals!.width='fit-content';
  if(mutation==='auto')bad.anatomy.root.literals!.width='auto';
  if(mutation==='axis')bad.anatomy.root.layout!.direction='row';
  if(mutation==='api'){const child=structuredClone(f.child);child.anatomy.root.instanceRootInputs=['height'];scope.set(child.id,child);}
  assert.throws(()=>reactEmitter.emit(bad,{...ctx,contracts:scope}),/instance-root-fill-host-unproven/,mutation);
 }
});


test('cross-axis root fill and primary growth resize the same generated child on both React surfaces',async t=>{
 const f=instanceRootInputFixture(),part=f.parent.anatomy.root.parts!.usage;
 delete part.component!.rootOverrides!.width;part.component!.rootFill=['width'];
 part.layout={grow:true,growBasis:'zero'};
 f.parent.anatomy.root.literals={width:'200px',height:'120px'};
 const before=JSON.stringify(f.child),ctx={tokens:f.tokens,contracts:f.scope,icons:new Map<string,string>()};
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const p=emitter.emit(f.parent,ctx),c=emitter.emit(f.child,ctx),page=await browser.newPage();
  try{
   const render=await mountGenerated(page,f.parent.name,p[0].contents,p.find(x=>x.path.endsWith('.css'))?.contents,{[f.child.name]:{tsx:c[0].contents,css:c.find(x=>x.path.endsWith('.css'))?.contents}});
   await page.addStyleTag({content:':root{--usage-height:24px;--usage-padding-left:0px}'});
   for(const [width,height] of [[200,120],[400,180],[160,80]]){
    await render({style:{width,height}});
    const box=await page.locator('#root > * > *').boundingBox();assert.equal(box!.width,width);assert.equal(box!.height,height);
   }
  }finally{await page.close();}
 }
 const native=createFigmaEngine({tokens:f.tokens,icons:new Map()}).compileComponentData(f.parent,f.scope);
 for(const v of native.variants){assert.equal(v.spec.children![0].fillW,true);assert.equal(v.spec.children![0].grow,true);}
 assert.equal(JSON.stringify(f.child),before);
});

test('root fill follows an absolute wrapper with opposing insets and a definite containing block',async t=>{
 const f=instanceRootInputFixture(),root=f.parent.anatomy.root,part=root.parts!.usage;
 delete part.component!.rootOverrides!.width;part.component!.rootFill=['width'];part.layout={grow:true,growBasis:'zero'};
 root.declared={position:'relative'};root.literals={width:'200px',height:'120px'};
 root.parts={wrapper:{declared:{position:'absolute'},layout:{direction:'column'},literals:{left:'10px',right:'15px',top:'5px',bottom:'5px'},parts:{usage:part}}};
 const ctx={tokens:f.tokens,contracts:f.scope,icons:new Map<string,string>()},browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const p=emitter.emit(f.parent,ctx),c=emitter.emit(f.child,ctx),page=await browser.newPage();
  try{
   const render=await mountGenerated(page,f.parent.name,p[0].contents,p.find(x=>x.path.endsWith('.css'))?.contents,{[f.child.name]:{tsx:c[0].contents,css:c.find(x=>x.path.endsWith('.css'))?.contents}});
   await page.addStyleTag({content:':root{--usage-height:24px;--usage-padding-left:0px}'});
   for(const [width,height] of [[200,120],[400,180],[160,80]]){
    await render({style:{width,height}});const box=await page.locator('#root > * > * > *').boundingBox();assert.equal(box!.width,width-25);assert.equal(box!.height,height-10);
   }
  }finally{await page.close();}
 }
 const engine=createFigmaEngine({tokens:f.tokens,icons:new Map()}),native=engine.compileComponentData(f.parent,f.scope);
 for(const v of native.variants){
  const wrapper=v.spec.children![0],usage=wrapper.children![0];
  assert.deepEqual(wrapper.absolute,{h:'STRETCH',v:'STRETCH',left:10,right:15,top:5,bottom:5});
  assert.equal(wrapper.insetOverlay,undefined);assert.equal(wrapper.layout!.primary,'MIN');
  assert.equal(usage.fillW,true);assert.equal(usage.fillH,true);
 }
 const host=createFigmaMock(),context=vm.createContext({figma:host.figma,console:{log(){},warn(){},error(){}}});
 const run=async(script:string)=>vm.runInContext(`(async()=>{${script}})()`,context);
 await run(engine.buildTokensScript(null));await run(engine.buildComponentScript(f.child,f.scope));await run(engine.buildComponentScript(f.parent,f.scope));
 const owner=host.root.findOne(n=>n.type==='COMPONENT_SET'&&n.getSharedPluginData('ds_contracts','contractId')===f.parent.id)!;
 for(const variant of owner.children!){const wrapper=variant.findOne(n=>n.name==='wrapper')!;
  assert.equal(wrapper.width,175);assert.equal(wrapper.height,110);assert.equal(wrapper.primaryAxisAlignItems,'MIN');
  const usage=wrapper.findOne(n=>n.name==='usage')!;assert.equal((usage as any).layoutSizingHorizontal,'FILL');assert.equal((usage as any).layoutSizingVertical,'FILL');
 }
 for(const explicitSize of [false,true]){
  const legacy=structuredClone(f.parent),wrapper=legacy.anatomy.root.parts!.wrapper;
  wrapper.parts={mark:{shape:{kind:'rect',width:10,height:10}}};
  if(explicitSize)wrapper.literals!.width='80px';else delete wrapper.layout;
  const scope=new Map(f.scope);scope.set(legacy.id,legacy);
  for(const v of engine.compileComponentData(legacy,scope).variants)assert.equal(v.spec.children![0].insetOverlay,true);
 }
 for(const mutate of [
  (c:Contract)=>{delete c.anatomy.root.parts!.wrapper.literals!.right;},
  (c:Contract)=>{c.anatomy.root.parts!.wrapper.literals!.right='auto';},
  (c:Contract)=>{c.anatomy.root.literals!.width='fit-content';},
  (c:Contract)=>{delete c.anatomy.root.declared!.position;},
  (c:Contract)=>{c.anatomy.root.parts!.wrapper.declaredStates={hover:{position:'relative'}};},
 ]){const bad=structuredClone(f.parent);mutate(bad);const scope=new Map(f.scope);scope.set(bad.id,bad);assert.throws(()=>reactEmitter.emit(bad,{...ctx,contracts:scope}),/instance-root-fill-host-unproven/);}
});

test('root fill requires definite table dimensions on every visible child tuple',async t=>{
 const f=instanceRootInputFixture(),root=f.parent.anatomy.root,part=root.parts!.usage;
 f.parent.props.push({name:'state',type:{enum:['ready','loading']},default:'ready',bindings:{code:{prop:'state'},figma:{kind:'VARIANT',property:'State'}}});
 delete part.component!.rootOverrides!.width;part.component!.rootFill=['width'];part.visibleWhen={prop:'state',equals:'loading'};
 root.literalsByCombination=[{props:['width-mode','state'],rows:[
  {values:['compact','ready'],literals:{width:'fit-content'}},{values:['roomy','ready'],literals:{width:'fit-content'}},
  {values:['compact','loading'],literals:{width:'180px'}},{values:['roomy','loading'],literals:{width:'260px'}},
 ]}];
 const ctx={tokens:f.tokens,contracts:f.scope,icons:new Map<string,string>()},browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const p=emitter.emit(f.parent,ctx),c=emitter.emit(f.child,ctx),page=await browser.newPage();
  try{
   const render=await mountGenerated(page,f.parent.name,p[0].contents,p.find(x=>x.path.endsWith('.css'))?.contents,{[f.child.name]:{tsx:c[0].contents,css:c.find(x=>x.path.endsWith('.css'))?.contents}});
   await page.addStyleTag({content:':root{--usage-height:24px;--usage-padding-left:0px}'});
   for(const [density,width] of [[0,180],[1,260],[0,180]]){await render({density,state:'loading'});assert.equal((await page.locator('#root > * > *').boundingBox())!.width,width);}
   await render({state:'ready'});assert.equal(await page.locator('#root > * > *').count(),0);
  }finally{await page.close();}
 }
 for(const mutate of [
  (c:Contract)=>{c.anatomy.root.literalsByCombination![0].rows.pop();},
  (c:Contract)=>{c.anatomy.root.literalsByCombination![0].rows[3].literals.width='fit-content';},
  (c:Contract)=>{delete c.anatomy.root.parts!.usage.visibleWhen;},
  (c:Contract)=>{c.anatomy.root.declaredStates={hover:{width:'auto'}};},
 ]){const bad=structuredClone(f.parent);mutate(bad);const scope=new Map(f.scope);scope.set(bad.id,bad);assert.throws(()=>reactEmitter.emit(bad,{...ctx,contracts:scope}),/instance-root-fill-host-unproven/);}
});

test('root FILL proposal requires captured cross-axis allocation and independent local identity',()=>{
 const make=()=>{
  const f=rootInputProposalFixture();
  for(const v of f.set.variants){
   v.layout={mode:'VERTICAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'FIXED'};v.bbox={width:100,height:24};
   const n=v.children![0],w=n.instanceRootOverrides!;n.nodeId=w.nodeId;n.fillWidth=true;n.bbox={width:100,height:24};w.localSize={width:100,height:24};
   n.instanceGeometry={nodeId:w.nodeId,componentId:w.componentId,transform:[[1,0,0],[0,1,0]],localSize:{width:100,height:24}};
  }
  return f;
 };
 const f=make(),result=f.run();assert.deepEqual(result.ref.rootFill,['width']);assert.equal(result.ref.rootOverrides?.width,undefined);assert(result.ref.rootOverrides?.height);
 for(const change of [
  (f:ReturnType<typeof make>)=>{for(const v of f.set.variants)v.layout!.counterSizing='AUTO'},
  (f:ReturnType<typeof make>)=>{delete f.set.variants[0].children![0].fillWidth},
  (f:ReturnType<typeof make>)=>{f.set.variants[0].children![0].instanceGeometry!.componentId='foreign'},
  (f:ReturnType<typeof make>)=>{f.child.anatomy.root.instanceRootInputs=['height']},
 ]){const bad=make();change(bad);assert.equal(bad.run().ref.rootFill,undefined);}
});
