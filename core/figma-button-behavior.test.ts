import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import { createFigmaMock } from '../scripts/plugin-engine-mock-figma.mjs';
import { createFigmaEngine } from './emit-figma-script.js';
import { assertCapturedClosure } from './captured-closure.js';
import { proposeFromDump, settleInteractiveContent } from './propose-figma.js';
import { readButtonProfile, resolveButtonProfile } from './figma-button-profile.js';
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

test('profile declarations preserve capture origin, unrelated inputs and the declared axis', async () => {
  const c = fixture(), set = await (await native(c)).dump();
  delete set.semantics; delete set.propNames; delete set.contractId;
  set.propertyDefinitions!['Owner Label#1:1'] = { type: 'TEXT', defaultValue: 'one' };
  set.propertyDefinitions!['Owner-Label#2:2'] = { type: 'TEXT', defaultValue: 'two' };
  for (const variant of set.variants) variant.children = ['Owner Label', 'Owner-Label'].map(name => ({
    ...structuredClone(variant.children![0]), name, propRefs: { characters: name },
  }));
  const dump = { _provenance: { fileKey: 'file', closure: { rule: 'follow-instances', cap: 64,
    requested: [{ nodeId: set.nodeId, name: set.setName, type: set.type }], pulled: [], unresolved: [], cycles: [] } }, [set.setName]: set };
  const raw = { fileKey: 'file', nodeId: set.nodeId, prop: c.props[0], states: c.semantics.button!.states };
  const before = structuredClone(dump), declaration = resolveButtonProfile(dump, raw);
  const declared = ContractSchema.parse(proposeFromDump(set, { corpus: tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} }),
    contractIdByName: new Map(), fileKey: 'file', projectionMode: 'exact', mintUnbound: true, buttonDeclaration: declaration }).contract);
  assert.deepEqual(declared.props.find(p => p.name === 'phase'), c.props[0]);
  assert.deepEqual(declared.semantics, c.semantics);
  assert.deepEqual(declared.states, []);
  const unrelated = (v: Contract) => v.props.filter(p => p.bindings.figma.kind === 'TEXT');
  assert.equal(unrelated(declared).length, 2);
  assert.deepEqual(unrelated(declared), unrelated(propose(set)));
  assert.deepEqual(dump, before);
  const stamped = structuredClone(dump), target = stamped[set.setName] as DumpSet;
  target.semantics = { element: 'button', ...declaration.retained.stamp };
  target.propNames = { State: 'phase' };
  assert.deepEqual(resolveButtonProfile(stamped, raw).retained, declaration.retained);
  for (const mutate of [
    (p: any) => { p.fileKey = 'wrong'; }, (p: any) => { p.nodeId = 'wrong'; },
    (p: any) => { p.extra = true; }, (p: any) => { delete p.states.pending; },
    (p: any) => { p.prop.default = 'blocked'; }, (p: any) => { p.prop.type.enum.push('unknown'); },
    (p: any) => { p.states.ready.busy = true; },
    (p: any) => { delete p.prop.bindings.figma.values; },
    ...['type', 'disabled', 'onClick', 'role', 'aria-disabled', 'aria-busy'].map(name => (p: any) => { p.prop.bindings.code.prop = name; }),
  ]) { const bad = structuredClone(raw); mutate(bad); assert.throws(() => resolveButtonProfile(dump, bad), /FIGMA_BUTTON_PROFILE_INVALID/); }
  for (const bad of [null, [], {}, false]) assert.throws(() => readButtonProfile(bad), /PROFILE_INVALID/);
  const conflict = structuredClone(raw); conflict.states.pending.busy = false;
  assert.throws(() => resolveButtonProfile(stamped, conflict), /conflicting retained/);
  const stale = structuredClone(dump); (stale[set.setName] as DumpSet).variants.pop();
  assert.throws(() => resolveButtonProfile(stale, raw), /PROFILE_INVALID/);
  const missing = structuredClone(dump); delete missing[set.setName];
  assert.throws(() => resolveButtonProfile(missing, raw), /FIGMA_CAPTURE_CLOSURE_INCOMPLETE/);
  const collision = structuredClone(dump); (collision[set.setName] as DumpSet).propertyDefinitions!.Flag = { type: 'BOOLEAN', defaultValue: false };
  for (const key of ['name', 'code'] as const) {
    const p = structuredClone(raw);
    if (key === 'name') p.prop.name = 'flag'; else p.prop.bindings.code.prop = 'flag';
    assert.throws(() => resolveButtonProfile(collision, p), /input identity collides with Flag/);
  }
  delete (collision[set.setName] as DumpSet).propertyDefinitions!.Flag;
  (collision[set.setName] as DumpSet).boolDefaults = { Flag: false };
  const boolProfile = structuredClone(raw); boolProfile.prop.name = 'flag';
  assert.throws(() => resolveButtonProfile(collision, boolProfile), /input identity collides with Flag/);
  (collision[set.setName] as DumpSet).contractId = '!';
  assert.throws(() => resolveButtonProfile(collision, raw), /malformed native contract identity/);
});

test('explicit button policies refuse direct, slotted and transitive interactive descendants', () => {
  const button = fixture(), passive = { id: 'icon', name: 'Icon', semantics: { element: 'span' }, anatomy: { root: {} } };
  const interactive = { ...passive, id: 'input', name: 'Input', semantics: { element: 'input' } };
  const wrapper = { ...passive, id: 'wrapper', anatomy: { root: { component: { id: 'input' } } } };
  const multi = { ...passive, id: 'multi', anatomy: { label: {}, control: { element: 'button' } } };
  const mapped = { ...passive, id: 'mapped', semantics: { element: 'div', roleByProp: { prop: 'kind', map: { active: 'button' } } } };
  const map = new Map<string, unknown>([passive, interactive, wrapper, multi, mapped].map(c => [c.id, c]));
  for (const root of [ { parts: { child: { element: 'button' } } }, { parts: { child: { attrs: { tabindex: '-1' } } } },
    ...[{ tabIndex: '0' }, { TABINDEX: '0' }, { role: '{kind}' }, { contentEditable: 'true' }].map(attrs => ({ parts: { child: { attrs } } })),
    ...['input', 'wrapper', 'multi', 'mapped'].map(id => ({ component: { id } })), { slot: { defaultContent: [{ id: 'input' }] } } ]) {
    const c = { ...button, anatomy: { root } }, before = structuredClone(c);
    assert.throws(() => settleInteractiveContent([{ setName: 'Action', contract: c, notes: [] }], map), /FIGMA_BUTTON_INTERACTIVE_DESCENDANT/);
    assert.deepEqual(c, before);
    const legacy = structuredClone(c); delete (legacy.semantics as Partial<typeof button.semantics>).button;
    assert.doesNotThrow(() => settleInteractiveContent([{ setName: 'Action', contract: legacy, notes: [] }], map));
  }
  const c = { ...button, anatomy: { root: { component: { id: 'icon' } } } };
  assert.doesNotThrow(() => settleInteractiveContent([{ setName: 'Action', contract: c, notes: [] }], map));
  assert.throws(() => settleInteractiveContent([{ setName: 'Action', contract: c, notes: [], childStubs: [passive] }], map), /FIGMA_BUTTON_DEPENDENCY_UNRESOLVED/);
  assert.throws(() => settleInteractiveContent([{ setName: 'Action', contract: c, notes: [] }], new Map()), /FIGMA_BUTTON_DEPENDENCY_UNRESOLVED/);
});
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
