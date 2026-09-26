import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { chromium } from 'playwright-core';
import { ContractSchema, componentRefsOf, walkAnatomy, type Contract } from '../scripts/contract-schema.js';
import type { DumpSet } from '../extract/figma/types.js';
import { asMinimalChildContract, proposeFromDump } from './propose-figma.js';
import { tokenCorpusFromJson } from './token-corpus.js';
import { reactEmitter, reactInlineEmitter } from './emitter.js';
import { generatedTypeErrors, mountGenerated } from './react-test-runtime.js';
import { lowerUnsetProposal } from './figma-unset.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { createFigmaMock } from '../scripts/plugin-engine-mock-figma.mjs';

const corpus = tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} });

function fixedContentFixture() {
  const { set, child } = fixture(false);
  child.anatomy.root = { layout: { display: 'flex', direction: 'column' }, literals: { width: '180px' }, parts: {
    region: { layout: { display: 'flex', direction: 'column' }, parts: {
      well: { slot: { name: 'children', bindings: { figma: { property: 'Payload' } }, defaultContent: [{ id: 'check.sample' }] } },
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

test('fixed caller content declines incomplete identity, variant selection and incompatible slots', () => {
  const mutations: Array<(f: ReturnType<typeof fixedContentFixture>) => void> = [
    f => { delete f.set.variants[1].children![0].fixedSwaps; },
    f => { delete f.set.variants[1].children![0].fixedSwaps!.Payload.key; },
    f => { f.set.variants[1].children![0].fixedSwaps!.Payload.id = '40:2'; },
    f => { f.set.variants[1].children![0].instanceSetKey = 'foreign-key'; },
    f => { delete f.set.variants[1].children![0].instanceSetKey; },
    f => { f.target.bindings.figma.anchors!.nodeId = 'different-node'; },
    f => { f.target.bindings.figma.anchors!.fileKey = 'foreign-file'; },
    f => { f.target.bindings.figma.anchors!.componentSetKey = 'foreign-key'; },
    f => { f.target.props = structuredClone(f.child.props); },
    f => { f.scope.delete(f.target.id); },
    f => { f.child.anatomy.root.parts!.region.parts!.well.slot!.name = 'namedContent'; },
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
  const mutations:Array<(f:ReturnType<typeof make>)=>void>=[
    f=>{delete f.target.anatomy.root.overridable;},
    f=>{delete f.set.variants[0].children![0].fixedSwaps!.Payload.observedInstances;},
    f=>{const a=f.set.variants[0].children![0].fixedSwaps!.Payload.observedInstances!;a.push(structuredClone(a[0]));},
    f=>{f.set.variants[0].children![0].fixedSwaps!.Payload.observedInstances![0].componentId='other';},
    f=>{f.set.variants[0].children![0].fixedSwaps!.Payload.observedInstances![0].path=[1];},
    f=>{f.set.variants[0].children![0].fixedSwaps!.Payload.observedInstances![0].size!.height=7.2501;},
    f=>{f.set.variants[0].children![0].fixedSwaps!.Payload.observedInstances![0].parentSize!.width=8;},
    f=>{f.set.variants[0].children![0].fixedSwaps!.Payload.observedInstances![0].relativeTransform![0][2]=1;},
    f=>{delete f.set.variants[0].children![0].fixedSwaps!.Payload.observedInstances![0].constraints;},
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
  assert.deepEqual(result.ref.props, { lit: '{power}' });
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
