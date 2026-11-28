import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import { createFigmaMock } from '../scripts/plugin-engine-mock-figma.mjs';
import { createFigmaEngine } from './emit-figma-script.js';
import { assertCapturedClosure } from './captured-closure.js';
import { proposeFromDump } from './propose-figma.js';
import { tokenCorpusFromJson } from './token-corpus.js';
import { readButtonStamp, buttonStamp } from './figma-button-behavior.js';
import { mapRestToDump } from '../extract/figma/rest/map.js';
import type { DumpSet } from '../extract/figma/types.js';
const tokens = { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
const engine = createFigmaEngine({ tokens, icons: new Map() });
function fixture() {
  return ContractSchema.parse({ id: 'test.action', name: 'NativeAction', version: '1.0.0', status: 'draft', description: 'Explicit behavior inputs.',
    semantics: { element: 'button', button: { prop: 'phase', states: { ready: { disabled: false, busy: false }, blocked: { disabled: true, busy: false }, pending: { disabled: true, busy: true } } } },
    props: [{ name: 'phase', type: { enum: ['ready', 'blocked', 'pending'] }, default: 'ready', bindings: { code: { prop: 'status' }, figma: { kind: 'VARIANT', property: 'State', values: { ready: 'Default', blocked: 'Disabled', pending: 'Loading' } } } }],
    anatomy: { root: { text: 'Save' } }, bindings: { code: { anchors: { importPath: './NativeAction', export: 'NativeAction' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } } });
}
async function native(c = fixture()) {
  const { figma, root } = createFigmaMock();
  const context = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
  const run = (script: string) => vm.runInContext(`(async()=>{${script}\n})()`, context, { timeout: 20000 }) as Promise<any>;
  const script = (c: Contract) => engine.buildComponentScript(c, new Map([[c.id, c]]));
  await run(script(c));
  const node = root.findOne((n: any) => n.type === 'COMPONENT_SET' && n.getSharedPluginData('ds_contracts', 'contractId') === c.id);
  assert(node);
  const dump = async () => JSON.parse(JSON.stringify((await run(readFileSync('extract/figma/dump.plugin.js', 'utf8').replace(/^const TARGET_SETS = \[[^\n]*\];$/m, `const TARGET_SETS = ${JSON.stringify([node.name])};`)))[node.name])) as DumpSet;
  return { node, run, script, dump };
}
function propose(set: DumpSet) {
  return ContractSchema.parse(proposeFromDump(set, { corpus: tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} }),
    contractIdByName: new Map(), fileKey: null, projectionMode: 'exact', mintUnbound: true }).contract);
}
test('native round trip retains the explicit policy and complete aliased input without state promotion', async () => {
  const c = fixture(), live = await native(c), set = await live.dump(), before = structuredClone(set), back = propose(set);
  assert.deepEqual(back.semantics.button, c.semantics.button);
  assert.deepEqual(back.props.find(p => p.name === 'phase'), c.props[0]);
  assert.equal(back.states.length, 0);
  assert(!back.props.some(p => p.bindings.code.values));
  assert(!('buttonAxis' in back.semantics));
  assert.deepEqual(set, before);
  const reordered = structuredClone(set); reordered.variants.reverse();
  assert.deepEqual(propose(reordered).semantics.button, c.semantics.button);
  await live.run(live.script(c)); assert.deepEqual(await live.dump(), set);
  const b = fixture(); b.props[0].type = { enum: ['ready', 'blocked'] }; b.props[0].bindings.figma.values = { ready: 'false', blocked: 'true' }; delete b.semantics.button!.states.pending;
  const booleanLabels = propose(await (await native(b)).dump());
  assert.deepEqual(booleanLabels.props[0], b.props[0]);
});
test('incomplete or uncorroborated native behavior metadata refuses before a proposal', async () => {
  const set = await (await native()).dump();
  const mutations = [
    (s: any) => { delete s.semantics.button; }, (s: any) => { delete s.semantics.buttonAxis; },
    (s: any) => { s.semantics = '{bad'; }, (s: any) => { s.semantics = null; },
    (s: any) => { s.semantics.button.states.pending.disabled = false; },
    (s: any) => { s.semantics.buttonAxis.version = 2; },
    (s: any) => { s.semantics.buttonAxis.extra = true; },
    (s: any) => { s.semantics.buttonAxis.prop.default = 'pending'; },
    (s: any) => { s.propertyDefinitions.State.defaultValue = 'Loading'; },
    (s: any) => { s.propertyDefinitions.State.variantOptions.push('Extra'); },
    (s: any) => { s.variants.pop(); }, (s: any) => { s.propNames.State = 'wrong'; },
    (s: any) => { s.variants[0].variantProperties.State = 'wrong'; },
    (s: any) => { s.variants[0].name = 'State=wrong'; },
    (s: any) => { s.codeValueAxes = { version: 1, axes: [] }; },
    (s: any) => { s.unsetVariantAxes = { version: 1, axes: [] }; },
  ];
  for (const [i, mutate] of mutations.entries()) { const bad = structuredClone(set); mutate(bad); assert.throws(() => propose(bad), /FIGMA_BUTTON_BEHAVIOR_METADATA_INVALID/, String(i)); }
  const damaged = await native(); damaged.node.setSharedPluginData('ds_contracts', 'semantics', '{bad');
  assert.equal((await damaged.dump()).semantics, '{bad');
  assert.throws(() => readButtonStamp(set && { ...set, semantics: null } as any), /METADATA_INVALID/);
});
test('native compile refuses mappings that cannot be read back', () => {
  for (const mutate of [
    (c: Contract) => { c.props[0].bindings.figma.values!.ready = 'x,y'; },
    (c: Contract) => { c.props[0].bindings.figma.values!.ready = 'Loading'; },
    (c: Contract) => { c.props[0].bindings.figma.unsetValue = '(unset)'; },
    (c: Contract) => { c.props[0].bindings.figma.property = 'Bad=Axis'; },
    (c: Contract) => { c.props[0].type = { enum: ['in_progress', 'blocked', 'pending'] }; c.props[0].default = 'in_progress'; c.semantics.button!.states.in_progress = c.semantics.button!.states.ready; delete c.semantics.button!.states.ready; c.props[0].bindings.figma.values = { in_progress: 'Default', blocked: 'Disabled', pending: 'Loading' }; },
  ]) { const c = fixture(); mutate(c); assert.throws(() => buttonStamp(c), /METADATA_INVALID/); assert.throws(() => engine.compileComponentData(c, new Map([[c.id, c]]))); }
});
test('native updates refuse removal or reinterpretation before touching the target', async () => {
  const c = fixture(), live = await native(c), baseline = await live.dump();
  for (const mutate of [
    (c: Contract) => { delete c.semantics.button; },
    (c: Contract) => { c.semantics.button!.states.pending.busy = false; },
    (c: Contract) => { c.props[0].default = 'blocked'; },
    (c: Contract) => { c.props[0].bindings.code.prop = 'phase'; },
  ]) { const changed = structuredClone(c); mutate(changed); await assert.rejects(live.run(live.script(changed)), /FIGMA_BUTTON_BEHAVIOR_RETIREMENT_REFUSED/); assert.deepEqual(await live.dump(), baseline); }
  const raw = live.node.getSharedPluginData('ds_contracts', 'semantics'), parsed = JSON.parse(raw);
  live.node.setSharedPluginData('ds_contracts', 'semantics', JSON.stringify(Object.fromEntries(Object.entries(parsed).reverse())));
  await live.run(live.script(c));
  for (const damaged of ['{bad', 'null', JSON.stringify({ element: 'button', button: parsed.button }), JSON.stringify({ element: 'button', buttonAxis: parsed.buttonAxis })]) {
    live.node.setSharedPluginData('ds_contracts', 'semantics', damaged);
    await assert.rejects(live.run(live.script(c)), /FIGMA_BUTTON_BEHAVIOR_RETIREMENT_REFUSED/);
    assert.equal(live.node.getSharedPluginData('ds_contracts', 'semantics'), damaged);
  }
});

test('REST keeps corrupt and falsey semantics for the same explicit refusal as plugin capture', () => {
  for (const raw of ['{bad', 'null', 'false', '0', '""']) {
    const response = { nodes: { '1:1': { document: { id: '1:1', name: 'Broken', type: 'COMPONENT_SET', sharedPluginData: { ds_contracts: { semantics: raw } }, children: [] } } } };
    const set = mapRestToDump(response as Parameters<typeof mapRestToDump>[0]).dump.Broken as DumpSet;
    assert(Object.hasOwn(set, 'semantics'));
    assert.throws(() => readButtonStamp(set), /FIGMA_BUTTON_BEHAVIOR_METADATA_INVALID/);
  }
});

test('claimed closure payloads cannot disappear, duplicate or change identity', () => {
  const claim = { nodeId: '1:2', name: 'Child', type: 'COMPONENT' };
  const dump: any = { _provenance: { closure: { rule: 'follow-instances', cap: 64, requested: [], pulled: [claim], unresolved: [{ targetId: '1:2', reason: 'cycle-cut' }], cycles: [{ toNodeId: '1:2' }] } }, Child: { ...claim, setName: 'Child', variants: [] } };
  assert.doesNotThrow(() => assertCapturedClosure(dump)); assert.doesNotThrow(() => assertCapturedClosure({}));
  const internal = structuredClone(dump); internal._Child = internal.Child; delete internal.Child;
  internal._Child.name = internal._Child.setName = internal._provenance.closure.pulled[0].name = '_Child';
  assert.doesNotThrow(() => assertCapturedClosure(internal));
  for (const mutate of [
    (d: any) => { delete d.Child; }, (d: any) => { d.Other = { ...d.Child }; },
    (d: any) => { d.Child.type = 'FRAME'; }, (d: any) => { d.Child.setName = 'Other'; },
    (d: any) => { d._provenance.closure.pulled[0].nodeId = ''; },
    (d: any) => { d._provenance.closure.requested.push(d._provenance.closure.pulled[0]); },
    (d: any) => { d._provenance.closure = null; },
  ]) { const bad = structuredClone(dump); mutate(bad); assert.throws(() => assertCapturedClosure(bad), /FIGMA_CAPTURE_CLOSURE_INCOMPLETE/); }
  const requested = structuredClone(dump); requested._provenance.closure.requested = requested._provenance.closure.pulled; requested._provenance.closure.pulled = []; delete requested.Child;
  assert.throws(() => assertCapturedClosure(requested), /FIGMA_CAPTURE_CLOSURE_INCOMPLETE/);
});
