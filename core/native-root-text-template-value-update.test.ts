import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { revisionOf, canonicalJson } from './contract-provenance.js';
import { nativeTextGraphFixture, nativeTextGraphComponentFixture } from './native-text-template-test-fixture.js';
import { emitNativeContractReadbackScript, verifyNativeContractReadback, type NativeContractObservationInput } from './native-source-observation.js';
import type { NativeRootTextTemplateGraphInput } from './native-root-text-template-graph.js';
import { nativeFixtureHost } from '../source-reference/native-operation-test-fixture.js';
import { emitNativeTemplateGraphScript, emitNativeTemplateGraphReadbackScript, verifyNativeTemplateGraphReceipt } from './native-root-text-template-graph-native.js';
import { planNativeRootTextTemplateGraph } from './native-root-text-template-graph.js';
import { prepareNativeTokenContext } from './native-token-context.js';
import { planNativeTemplateValueUpdate, verifyNativeTemplateValueUpdate, observeNativeTemplateValueUpdate,
  emitNativeTemplateValueReadbackScript, resolveNativeTemplateValueState, resolveNativeTemplateContractValueState,
  type NativeTemplateValueUpdateInput } from './native-root-text-template-value-update.js';

async function fixture(prepare?: (f: ReturnType<typeof nativeTextGraphFixture>) => void) {
  const f = nativeTextGraphFixture(3, 2), host = nativeFixtureHost({ modeLimit: 2, consumerVariableModes: true });
  prepare?.(f);
  const compile = () => { const input: NativeRootTextTemplateGraphInput = f.compile(); input.tokens.fileKey = host.figma.fileKey; input.renderScope = 'component'; return structuredClone(input); };
  const before = compile();
  const run = async (script: string) => JSON.parse(JSON.stringify(await vm.runInNewContext(`(async () => {${script}\n})()`, { figma: host.figma })));
  const created = await run(emitNativeTemplateGraphScript(before).script);
  assert.equal(created.status, 'created-candidate');
  const read = () => run(emitNativeTemplateGraphReadbackScript(before, created.identity));
  const baseline = (await read()).receipt;
  return { f, host, compile, run, read, input: { before, desired: compile(), identity: created.identity, baseline } as NativeTemplateValueUpdateInput };
}

test('a four-channel value succession preserves every allocated ID and all routing edges without writing', async () => {
  const h = await fixture(), original = canonicalJson(h.input), native = canonicalJson((await h.read()).receipt);
  h.f.tokens.size.v0.$value = '15.5px'; h.f.tokens.line.v0.$value = '23px';
  h.f.tokens.weight.$value = 600; h.f.tokens.ink.v0.$value = '#abcdef';
  h.input.desired = h.compile();
  const untouched = canonicalJson(h.input), plan = planNativeTemplateValueUpdate(h.input);
  assert.equal(plan.writeAuthority, 'none');
  assert.equal(plan.changes.length, 4);
  assert.deepEqual(plan.changes.map(c => c.tokenPath), ['ink.v0', 'line.v0', 'size.v0', 'weight']);
  assert.notEqual(plan.beforeGraphRevision, plan.desiredGraphRevision);
  assert.deepEqual(plan.identity, h.input.identity);
  assert.equal(canonicalJson(h.input), untouched);
  assert.equal(canonicalJson((await h.read()).receipt), native);
  assert.notEqual(original, untouched);
  verifyNativeTemplateValueUpdate(h.input, plan);
  assert.deepEqual(planNativeTemplateValueUpdate(h.input), plan);
});

test('no-op and equal compiled value spellings produce no native assignments', async () => {
  const h = await fixture();
  assert.deepEqual(planNativeTemplateValueUpdate(h.input).changes, []);
  h.f.tokens.ink.v0.$value = '#123456ff'; h.input.desired = h.compile();
  const plan = planNativeTemplateValueUpdate(h.input);
  assert.deepEqual(plan.changes, []);
  assert.notEqual(plan.beforeGraphRevision, plan.desiredGraphRevision);
});

test('same-valued source peers keep distinct IDs when only one leaf changes', async () => {
  const h = await fixture();
  h.f.tokens.ink.v1.$value = '#ffffff'; h.input.desired = h.compile();
  const plan = planNativeTemplateValueUpdate(h.input);
  assert.equal(plan.changes.length, 1);
  assert.equal(plan.changes[0].variableId, h.input.identity.source.variables.find(v => v.tokenPath === 'ink.v1')!.id);
  assert.notEqual(plan.changes[0].variableId, h.input.identity.source.variables.find(v => v.tokenPath === 'ink.v0')!.id);
});

test('independent baseline corruption refuses even when a caller recomputes graph hashes', async () => {
  const h = await fixture();
  const mutations: Array<(i: NativeTemplateValueUpdateInput) => void> = [
    i => { i.baseline.source.variables[0].valuesByMode[i.identity.source.modes[0].modeId] = 999; },
    i => { i.baseline.routes[0].valuesByMode[Object.keys(i.baseline.routes[0].valuesByMode)[0]] = { type: 'VARIABLE_ALIAS', id: 'foreign' }; },
    i => { i.baseline.routes[0].scopes = []; },
    i => { i.baseline.selectors[0].ownership = {}; },
    i => { i.identity.routes[0].key = 'different'; },
    i => { i.identity.source.variables[0].id = 'different'; },
  ];
  for (const mutate of mutations) { const input = structuredClone(h.input); mutate(input); assert.throws(() => planNativeTemplateValueUpdate(input), /native-template-graph-/); }
});

test('source aliases, selector topology, ownership and unbound component changes refuse', async () => {
  const h = await fixture();
  const mutations: Array<(i: NativeTemplateValueUpdateInput) => void> = [
    i => { i.desired.tokens.scopeId = 'another-owner'; },
    i => { i.desired.source.contractRevision = revisionOf('another-contract'); },
    i => { i.desired.component.variants[0].spec.layout!.primary = 'CENTER'; },
    i => { i.desired.component.variants[0].spec.children![0].children![0].fontSize = 999; },
    i => { i.desired.component.fontStyles.push('Unobserved'); },
    i => { i.desired.component.variants[0].spec.children![0].children![0].fontFamily = 'Another'; },
    i => { (i.desired.tokens.modes[0].tokens.ink as any).v0.$value = '{ink.v1}'; },
  ];
  for (const mutate of mutations) {
    const input = structuredClone(h.input); mutate(input);
    const tokenRevision = revisionOf(input.desired.tokens.modes[0].tokens);
    input.desired.tokens.modes[0].tokenTreeRevision = tokenRevision;
    input.desired.tokens.source.tokensSha256 = tokenRevision.slice(7); input.desired.source.tokenRevision = tokenRevision;
    assert.throws(() => planNativeTemplateValueUpdate(input), /native-template-value-update-|NATIVE_ROOT_TEXT_TEMPLATE_/);
  }
});

test('token type and metadata edits cannot hide behind equivalent compiled values', async () => {
  const h = await fixture();
  for (const mutate of [
    (tree: any) => { tree.weight.$type = 'number'; },
    (tree: any) => { tree.ink.v0.$description = 'changed'; },
    (tree: any) => { tree.$description = 'changed group'; },
  ]) {
    const input = structuredClone(h.input); mutate(input.desired.tokens.modes[0].tokens);
    const revision = revisionOf(input.desired.tokens.modes[0].tokens);
    input.desired.tokens.modes[0].tokenTreeRevision = revision; input.desired.source.tokenRevision = revision;
    input.desired.tokens.source.tokensSha256 = revision.slice(7);
    assert.throws(() => planNativeTemplateValueUpdate(input), /token-(type|metadata)-changed/);
  }
});

test('a changed candidate with a freshly recomputed hash is rejected against original inputs', async () => {
  const h = await fixture(); h.f.tokens.size.v0.$value = '15px'; h.input.desired = h.compile();
  const plan = planNativeTemplateValueUpdate(h.input); plan.changes[0].after = 1000;
  const { revision, ...body } = plan; plan.revision = revisionOf(body);
  assert.throws(() => verifyNativeTemplateValueUpdate(h.input, plan), /plan-changed/);
});

test('unchanged source aliases resolve through their exact leaves and preserve italic faces', async () => {
  const h = await fixture(f => {
    f.tokens.size.v0.$value = '{size.v1}';
    f.contract.anatomy.root.declared!['font-style'] = 'italic';
  });
  h.f.tokens.size.v1.$value = '18px'; h.f.tokens.weight.$value = 600; h.input.desired = h.compile();
  const plan = planNativeTemplateValueUpdate(h.input);
  assert.deepEqual(plan.changes.map(c => c.tokenPath), ['size.v1', 'weight']);
  assert.ok(plan.desired.component.variants.every(v => v.spec.children![0].children![0].fontStyle === 'Semi Bold Italic'));
});

test('changes to unallocated leaves and allocation-extension histories are refused', async () => {
  const h = await fixture(f => { (f.tokens as any).unused = { $type: 'number', $value: 10 }; });
  // Rebuild the fixture with an unrequested leaf: its full source tree remains pinned.
  const input = structuredClone(h.input);
  for (const state of [input.before, input.desired]) state.tokens.tokenPaths = state.tokens.tokenPaths.filter(p => p !== 'unused');
  const host = nativeFixtureHost({ modeLimit: 2, consumerVariableModes: true });
  const run = async (script: string) => JSON.parse(JSON.stringify(await vm.runInNewContext(`(async () => {${script}\n})()`, { figma: host.figma })));
  const created = await run(emitNativeTemplateGraphScript(input.before).script);
  input.identity = created.identity;
  input.baseline = (await run(emitNativeTemplateGraphReadbackScript(input.before, input.identity))).receipt;
  (input.desired.tokens.modes[0].tokens.unused as any).$value = 20;
  const revision = revisionOf(input.desired.tokens.modes[0].tokens);
  input.desired.tokens.modes[0].tokenTreeRevision = revision; input.desired.source.tokenRevision = revision;
  input.desired.tokens.source.tokensSha256 = revision.slice(7);
  assert.throws(() => planNativeTemplateValueUpdate(input), /unallocated-value-changed/);
  const extended = structuredClone(h.input); Object.assign(extended.identity.source, { extensions: [] });
  assert.throws(() => planNativeTemplateValueUpdate(extended), /allocation-history-unqualified/);
});

test('the proposal retains observed float32 colors without rounding the requested value', async () => {
  const h = await fixture(), native = h.input.baseline.source.variables.find(v => v.name === 'ink/v0')!;
  const modeId = h.input.identity.source.modes[0].modeId;
  native.valuesByMode[modeId] = Object.fromEntries(Object.entries(native.valuesByMode[modeId] as Record<string, number>)
    .map(([key, value]) => [key, Math.fround(value)])) as any;
  h.f.tokens.ink.v0.$value = '#abcdef'; h.input.desired = h.compile();
  const plan = planNativeTemplateValueUpdate(h.input);
  assert.deepEqual(plan.changes[0].before, native.valuesByMode[modeId]);
  assert.deepEqual(plan.changes[0].after, { r: 171 / 255, g: 205 / 255, b: 239 / 255, a: 1 });
});

test('independent ID-based reads distinguish untouched, partial, complete and restored values without adopting new IDs', async () => {
  const h = await fixture();
  h.f.tokens.size.v0.$value = '15.5px'; h.f.tokens.ink.v0.$value = '#abcdef'; h.input.desired = h.compile();
  const plan = planNativeTemplateValueUpdate(h.input), script = emitNativeTemplateValueReadbackScript(h.input);
  const observe = async () => {
    const read = await h.run(script); assert.equal(read.status, 'readback-collected');
    return observeNativeTemplateValueUpdate(h.input, read.receipt);
  };
  assert.equal((await observe()).status, 'untouched');
  const inventory = { collections: h.host.collections.map(v => v.id), variables: h.host.variables.map(v => v.id) };
  // Explicit host fixture mutations exercise readback; the candidate emits no writer.
  const assign = (index: number, side: 'before' | 'after') => {
    const change = plan.changes[index], variable = h.host.variables.find(v => v.id === change.variableId)!;
    variable.setValueForMode(change.modeId, structuredClone(change[side]));
  };
  assign(0, 'after'); assert.equal((await observe()).status, 'partial');
  assign(1, 'after'); assert.equal((await observe()).status, 'updated');
  assign(0, 'before'); assert.equal((await observe()).status, 'partial');
  assign(1, 'before'); assert.equal((await observe()).status, 'untouched');
  assert.deepEqual({ collections: h.host.collections.map(v => v.id), variables: h.host.variables.map(v => v.id) }, inventory);
  assert.deepEqual((await h.read()).receipt, h.input.baseline);
  assert.equal(observeNativeTemplateValueUpdate({ ...h.input, desired: h.input.before }, h.input.baseline).status, 'no-op');
});

test('partial-state classification rejects conflicting values and drift in every untouched graph surface', async () => {
  const h = await fixture(); h.f.tokens.size.v0.$value = '15px'; h.input.desired = h.compile();
  const plan = planNativeTemplateValueUpdate(h.input), change = plan.changes[0];
  const mutations: Array<(r: typeof h.input.baseline) => void> = [
    r => { r.source.variables.find(v => v.id === change.variableId)!.valuesByMode[change.modeId] = 14; },
    r => { r.source.variables.find(v => v.id === change.variableId)!.valuesByMode[change.modeId] = { type: 'VARIABLE_ALIAS', id: 'same-valued' }; },
    r => { r.source.variables.find(v => v.id !== change.variableId)!.valuesByMode[change.modeId] = 123; },
    r => { r.source.variables.push(structuredClone(r.source.variables[0])); },
    r => { r.routes[0].valuesByMode[Object.keys(r.routes[0].valuesByMode)[1]] = { type: 'VARIABLE_ALIAS', id: 'wrong-unselected-edge' }; },
    r => { r.selectors[0].modes[0].name = 'changed'; },
    r => { r.sourceScopes[change.variableId] = []; },
    r => { r.source.collection.ownership.preparationRevision = plan.desiredGraphRevision; },
  ];
  for (const mutate of mutations) {
    const receipt = structuredClone(h.input.baseline); mutate(receipt);
    const original = canonicalJson(receipt), observation = observeNativeTemplateValueUpdate(h.input, receipt);
    assert.equal(observation.status, 'conflict'); assert.deepEqual(observation.values, []);
    assert.equal(observation.problems.length, 1); assert.equal(canonicalJson(receipt), original);
  }
});

test('new values accept only exact or float32 representations, with indistinguishable states reported explicitly', async () => {
  const h = await fixture(); h.f.tokens.size.v0.$value = '15.123456789px'; h.input.desired = h.compile();
  const change = planNativeTemplateValueUpdate(h.input).changes[0];
  for (const [value, expected] of [[15.123456789, 'updated'], [Math.fround(15.123456789), 'updated'], [15.123457, 'conflict']] as const) {
    const receipt = structuredClone(h.input.baseline);
    receipt.source.variables.find(v => v.id === change.variableId)!.valuesByMode[change.modeId] = value;
    assert.equal(observeNativeTemplateValueUpdate(h.input, receipt).status, expected);
  }
  const near = await fixture(f => { f.tokens.size.v0.$value = '12.00000001px'; });
  near.f.tokens.size.v0.$value = '12.00000002px'; near.input.desired = near.compile();
  const c = planNativeTemplateValueUpdate(near.input).changes[0], receipt = structuredClone(near.input.baseline);
  receipt.source.variables.find(v => v.id === c.variableId)!.valuesByMode[c.modeId] = 12;
  const result = observeNativeTemplateValueUpdate(near.input, receipt);
  assert.equal(result.status, 'no-op'); assert.deepEqual(result.values, [{ tokenPath: 'size.v0', state: 'both' }]);
});

test('current graph values retain allocation ownership across two updates, an unchanged repeat and full reversal', async () => {
  const h = await fixture(), original = structuredClone(h.input), originalGraph = planNativeRootTextTemplateGraph(original.before);
  h.f.tokens.size.v0.$value = '15.5px'; h.f.tokens.line.v0.$value = '23px';
  h.f.tokens.weight.$value = 600; h.f.tokens.ink.v0.$value = '#abcdef'; h.input.desired = h.compile();
  const plan = planNativeTemplateValueUpdate(h.input), state = resolveNativeTemplateValueState(h.input), graph = planNativeRootTextTemplateGraph(state);
  assert.equal(graph.allocationRevision, originalGraph.revision);
  assert.notEqual(graph.revision, originalGraph.revision);
  assert.deepEqual(graph.sourceTokens.source, originalGraph.sourceTokens.source);
  assert.equal(graph.sourceTokens.revision, originalGraph.sourceTokens.revision);
  assert.equal(state.tokens.allocatedValues!.length, 4);
  assert.throws(() => emitNativeTemplateGraphScript(state), /succession-not-creatable/);
  // Before any fixture assignment, the new current-value expectation must fail.
  assert.throws(() => verifyNativeTemplateGraphReceipt(state, h.input.identity, h.input.baseline), /source-readback/);
  const assign = (changes: typeof plan.changes) => { for (const change of changes)
    h.host.variables.find(v => v.id === change.variableId)!.setValueForMode(change.modeId, structuredClone(change.after)); };
  const read = async (input: NativeRootTextTemplateGraphInput) => {
    const result = await h.run(emitNativeTemplateGraphReadbackScript(input, h.input.identity));
    assert.equal(result.status, 'readback-collected');
    verifyNativeTemplateGraphReceipt(input, h.input.identity, result.receipt);
    return result.receipt;
  };
  assign(plan.changes); const firstReceipt = await read(state);
  assert.equal(firstReceipt.graphRevision, originalGraph.revision);
  assert.deepEqual(firstReceipt.selectors, original.baseline.selectors);
  assert.deepEqual(firstReceipt.routes, original.baseline.routes);
  assert.deepEqual(firstReceipt.source.collection, original.baseline.source.collection);
  const repeat = { ...h.input, before: state, baseline: firstReceipt };
  assert.deepEqual(planNativeTemplateValueUpdate(repeat).changes, []);
  assert.deepEqual(resolveNativeTemplateValueState(repeat), state);
  h.f.tokens.weight.$value = 700; h.f.tokens.size.v0.$value = '19px';
  const next = { ...repeat, desired: h.compile() }, second = resolveNativeTemplateValueState(next);
  assert.equal(second.tokens.allocatedValues!.find(v => v.tokenPath === 'weight')!.value, 400, 'history retains allocation, not previous update');
  assign(planNativeTemplateValueUpdate(next).changes); const secondReceipt = await read(second);
  const reverse = { ...next, before: second, desired: original.before, baseline: secondReceipt };
  const restored = resolveNativeTemplateValueState(reverse);
  assert.deepEqual(restored, original.before); assert.deepEqual(planNativeRootTextTemplateGraph(restored), originalGraph);
  assign(planNativeTemplateValueUpdate(reverse).changes);
  assert.deepEqual(await read(restored), original.baseline);
});

test('forged allocation history cannot reassign an existing graph or change the original token hash', async () => {
  const h = await fixture(); h.f.tokens.weight.$value = 600; h.input.desired = h.compile();
  const state = resolveNativeTemplateValueState(h.input);
  for (const mutate of [
    (i: typeof state) => { i.tokens.allocatedValues![0].value = 500; },
    (i: typeof state) => { i.tokens.source.tokensSha256 = '0'.repeat(64); },
    (i: typeof state) => { i.tokens.allocatedValues![0].value = '{weight}'; },
    (i: typeof state) => { i.tokens.allocatedValues!.push(structuredClone(i.tokens.allocatedValues![0])); },
    (i: typeof state) => { i.tokens.allocatedValueProtocol = 'px-dimension-v1'; },
    (i: typeof state) => { i.tokens.allocatedValues = []; },
  ]) {
    const changed = structuredClone(state); mutate(changed);
    assert.throws(() => emitNativeTemplateGraphReadbackScript(changed, h.input.identity), /NATIVE_ROOT_TEXT_TEMPLATE_GRAPH_|native-token-context-|native-template-graph-/);
  }
  const forged = structuredClone(h.input.identity); forged.graphRevision = planNativeRootTextTemplateGraph(state).revision;
  assert.throws(() => emitNativeTemplateGraphReadbackScript(state, forged), /identity-shape/);
  assert.equal(prepareNativeTokenContext(state.tokens).revision, h.input.identity.source.preparationRevision);
});

test('expected component state retains creation identities and independently verifies current size, line height, weight and paint', async () => {
  const h = await nativeTextGraphComponentFixture(2, 2), creation = await h.run(h.script());
  const draft = h.engine.compileNativeContractDraft(h.contract, h.byId, h.source);
  const before: NativeContractObservationInput = structuredClone({ operation: h.operation, planRevision: revisionOf('template value observation'),
    projection: draft.projection, component: draft.component, tokenInput: h.context.tokens.input,
    tokenIdentity: h.context.tokens.identity, creation, templateGraph: { input: h.input, identity: h.created.identity } });
  const baseline = await h.run(emitNativeContractReadbackScript(before));
  assert.equal(verifyNativeContractReadback(before, baseline).status, 'supported-structure-observed');
  assert.deepEqual(resolveNativeTemplateContractValueState({ before, baseline, desired: before.templateGraph!.input }), before);
  h.tokens.size.v1.$value = '17.5px'; h.tokens.line.v1.$value = '27px'; h.tokens.ink.v1.$value = '#abcdef';
  h.tokens.weight.$value = 700;
  const desired: NativeRootTextTemplateGraphInput = structuredClone(h.compile());
  desired.renderScope = 'component'; desired.tokens.fileKey = before.operation.fileKey;
  desired.tokens.scopeId = before.tokenInput.scopeId; desired.tokens.source.revision = before.tokenInput.source.revision;
  const next = resolveNativeTemplateContractValueState({ before, baseline, desired });
  assert.deepEqual(next.creation, before.creation); assert.deepEqual(next.tokenIdentity, before.tokenIdentity);
  assert.deepEqual(next.templateGraph!.identity, before.templateGraph!.identity);
  const plan = planNativeTemplateValueUpdate({ before: before.templateGraph!.input, desired,
    identity: before.templateGraph!.identity, baseline: baseline.templateGraph.receipt });
  for (const change of plan.changes) h.variables.find(v => v.id === change.variableId)!.setValueForMode(change.modeId, structuredClone(change.after));
  const readback = await h.run(emitNativeContractReadbackScript(next));
  assert.ok(readback.nodes.filter((n: any) => n.type === 'TEXT').every((n: any) => n.values.fontName.style === 'Bold'));
  const verification = verifyNativeContractReadback(next, readback);
  assert.equal(verification.status, 'supported-structure-observed', JSON.stringify(verification));
  assert.equal(verifyNativeContractReadback(before, readback).status, 'refused', 'allocation identity alone cannot certify stale content');
  const corrupt = structuredClone(baseline); corrupt.nodes.find((n: any) => n.type === 'TEXT').values.characters = 'unowned edit';
  assert.throws(() => resolveNativeTemplateContractValueState({ before, baseline: corrupt, desired }), /component-baseline/);
  const reverse = resolveNativeTemplateContractValueState({ before: next, baseline: readback, desired: before.templateGraph!.input });
  assert.deepEqual(reverse, before, 'full reversal recovers the original component expectation');
  const reversePlan = planNativeTemplateValueUpdate({ before: next.templateGraph!.input, desired: before.templateGraph!.input,
    identity: before.templateGraph!.identity, baseline: readback.templateGraph.receipt });
  for (const change of reversePlan.changes) h.variables.find(v => v.id === change.variableId)!.setValueForMode(change.modeId, structuredClone(change.after));
  assert.deepEqual(await h.run(emitNativeContractReadbackScript(reverse)), baseline);
});
