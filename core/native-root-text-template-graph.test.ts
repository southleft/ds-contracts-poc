import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { ContractSchema } from '../scripts/contract-schema.js';
import { canonicalJson, revisionOf } from './contract-provenance.js';
import { emitNativeTokenContextScript, emitNativeTokenContextReadbackScript } from './token-set.js';
import { prepareNativeContractComparison } from './native-contract-comparison.js';
import { emitNativeContractComparisonReadbackScript, verifyNativeContractComparisonReadback, type NativeContractComparisonObservationInput } from './native-contract-comparison-observation.js';
import { prepareNativeTokenContext } from './native-token-context.js';
import { planNativeRootTextTemplateGraph, verifyNativeRootTextTemplateGraph, nativeRootTextTemplateGraphSelection,
  verifyNativeRootTextTemplateGraphSelection, type NativeRootTextTemplateGraphInput, type NativeRootTextTemplateGraph } from './native-root-text-template-graph.js';
import { projectRootTextTemplateAliases } from './figma-template-aliases.js';
import { capturedTokensFromDump } from './captured-tokens.js';
import { tokenCorpusFromJson } from './token-corpus.js';
import { proposeBatchFromDump } from './propose-figma.js';
import { nativeTextBindings, nativeTextGraphFixture as fixture, nativeTextGraphComponentFixture as componentFixture } from './native-text-template-test-fixture.js';
import { nativeFixtureHost } from '../source-reference/native-operation-test-fixture.js';
import { emitNativeTemplateGraphScript, emitNativeTemplateGraphReadbackScript, verifyNativeTemplateGraphReceipt } from './native-root-text-template-graph-native.js';
import { emitNativeContractReadbackScript, verifyNativeContractReadback, type NativeContractObservationInput } from './native-source-observation.js';

function selectedSources(graph: NativeRootTextTemplateGraph, variant: string) {
  const modes = nativeRootTextTemplateGraphSelection(graph, variant);
  return Object.fromEntries(Object.entries(graph.template.aliases).map(([channel, alias]) => {
    let target: { route: string } | { sourcePath: string } = { route: alias };
    const visited = new Set<string>();
    while ('route' in target) {
      assert.ok(!visited.has(target.route)); visited.add(target.route);
      const name: string = target.route;
      const route: NativeRootTextTemplateGraph['routes'][number] = graph.routes.find(r => r.name === name)!;
      assert.ok(route); target = route.targets[modes[route.selector] === '0' ? 0 : 1];
    }
    return [channel, target.sourcePath];
  }));
}

test('100 compiled variants retain all 400 source binding identities using seven two-mode collections', () => {
  const input = fixture().compile(), before = canonicalJson(input), graph = planNativeRootTextTemplateGraph(input);
  assert.equal(graph.template.variants.length, 100);
  assert.equal(graph.selections.length, 100);
  assert.equal(graph.selectors.length, 7);
  assert.ok(graph.selectors.every(s => canonicalJson(s.modes) === '["0","1"]'));
  assert.ok(graph.maximumSelectedChainEntries <= 8);
  assert.deepEqual(graph.sourceTokens, prepareNativeTokenContext(input.tokens));
  const inkPaths = new Set<string>();
  for (const variant of input.component.variants) {
    const text = variant.spec.children![0].children![0];
    const selected = selectedSources(graph, variant.name);
    assert.deepEqual(selected, { fontSize: text.fontSizeVar!.replaceAll('/', '.'), lineHeight: text.lineHeightVar!.replaceAll('/', '.'),
      fontWeight: text.fontWeightVar!.replaceAll('/', '.'), fill: text.textFill!.replaceAll('/', '.') });
    inkPaths.add(selected.fill);
  }
  assert.equal(inkPaths.size, 10, 'equal values do not merge source identities');
  assert.equal(canonicalJson(input), before, 'planning does not mutate compiler inputs');
  verifyNativeRootTextTemplateGraph(input, graph);
  const reordered = structuredClone(input); reordered.component.variants.reverse(); reordered.tokens.tokenPaths.reverse();
  assert.deepEqual(planNativeRootTextTemplateGraph(reordered), graph);
});

test('a single tuple still owns four stable carriers and rejects its unused native selector address', () => {
  const graph = planNativeRootTextTemplateGraph(fixture(1, 1).compile());
  assert.equal(graph.selectors.length, 1); assert.equal(graph.routes.length, 4);
  assert.equal(graph.selections.length, 1);
  assert.ok(graph.routes.every(r => canonicalJson(r.targets[0]) === canonicalJson(r.targets[1])));
  assert.throws(() => verifyNativeRootTextTemplateGraphSelection(graph, graph.template.variants[0].name, { 'bit-0': '1' }), /SELECTION_CHANGED/);
});

test('selection requires every selector even when a channel does not use that bit', () => {
  const graph = planNativeRootTextTemplateGraph(fixture(3, 1).compile()), variant = graph.template.variants[0].name;
  const modes = nativeRootTextTemplateGraphSelection(graph, variant);
  verifyNativeRootTextTemplateGraphSelection(graph, variant, modes);
  for (const altered of [{}, { ...modes, 'bit-0': '2' }, { ...modes, unrelated: '0' }, { 'bit-0': modes['bit-0'] }])
    assert.throws(() => verifyNativeRootTextTemplateGraphSelection(graph, variant, altered), /SELECTION_CHANGED/);
  assert.throws(() => nativeRootTextTemplateGraphSelection(graph, 'Unobserved'), /VARIANT_UNKNOWN/);
  modes['bit-0'] = '1';
  assert.notDeepEqual(modes, nativeRootTextTemplateGraphSelection(graph, variant), 'returned selection is not mutable plan state');
});

test('original token aliases remain in the source collection and count toward capture depth', () => {
  const f = fixture(2, 1);
  f.tokens.size.v0.$value = '{size.v1}';
  const input = f.compile(), graph = planNativeRootTextTemplateGraph(input);
  const alias = graph.sourceTokens.variables.find(v => v.tokenPath === 'size.v0')!;
  assert.deepEqual(alias.values[0].value, { type: 'TOKEN_ALIAS', targetPath: 'size.v1', targetName: 'size/v1' });
  assert.equal(graph.maximumSelectedChainEntries, 3);
  const first = input.component.variants.find(v => v.spec.children![0].children![0].fontSizeVar === 'size/v0')!;
  assert.equal(selectedSources(graph, first.name).fontSize, 'size.v0');
});

test('recomputed attacker hashes cannot authorize changed graph edges, source values, identities or public vectors', () => {
  const input = fixture(3, 2).compile(), original = planNativeRootTextTemplateGraph(input);
  const mutations: Array<(g: NativeRootTextTemplateGraph) => void> = [
    g => { g.routes[0].targets.reverse(); },
    g => { g.routes[0].targets[0] = { sourcePath: 'weight' }; },
    g => { g.sourceTokens.variables[0].name = 'renamed'; },
    g => { g.sourceTokens.variables[0].values[0].value = 123; },
    g => { g.selectors[0].collectionName = 'Unowned library'; },
    g => { g.selections[0].modes['bit-0'] = g.selections[0].modes['bit-0'] === '0' ? '1' : '0'; },
    g => { g.template.variants.pop(); },
  ];
  for (const mutate of mutations) {
    const graph = structuredClone(original); mutate(graph);
    if (canonicalJson(graph) === canonicalJson(original)) continue; // A carrier may legitimately have identical branches.
    const { revision, ...body } = graph; graph.revision = revisionOf(body);
    assert.throws(() => verifyNativeRootTextTemplateGraph(input, graph), /PLAN_CHANGED/);
  }
});

test('source histories, multiple source themes and missing binding identities refuse before allocation', () => {
  const original = fixture(2, 2).compile();
  for (const mutate of [
    (i: NativeRootTextTemplateGraphInput) => { i.tokens.writeProtocol = 'explicit-modes-v1'; },
    (i: NativeRootTextTemplateGraphInput) => { i.tokens.modes.push(structuredClone(i.tokens.modes[0])); },
    (i: NativeRootTextTemplateGraphInput) => { i.tokens.source.tokensSha256 = '0'.repeat(64); },
    (i: NativeRootTextTemplateGraphInput) => { i.tokens.tokenPaths = i.tokens.tokenPaths.filter(p => p !== 'ink.v1'); },
  ]) {
    const input = structuredClone(original); mutate(input);
    assert.throws(() => planNativeRootTextTemplateGraph(input), /NATIVE_ROOT_TEXT_TEMPLATE_GRAPH_(SOURCE_CONTEXT|SOURCE_BINDING_MISSING)/);
  }
});

function nativeFixture(modeLimit = 2, sizes = 10, colors = 10) {
  const host = nativeFixtureHost({ modeLimit, consumerVariableModes: true });
  const input = fixture(sizes, colors).compile(); input.tokens.fileKey = host.figma.fileKey;
  const run = async (code: string) => JSON.parse(JSON.stringify(await vm.runInNewContext(`(async () => {${code}\n})()`, { figma: host.figma }, { timeout: 5000 })));
  return { ...host, input, run };
}

test('generated writer and a separate ID-based readback preserve every graph edge in a two-mode host', async () => {
  const h = nativeFixture(), { graph, script } = emitNativeTemplateGraphScript(h.input);
  assert.equal(script, emitNativeTemplateGraphScript(h.input).script);
  const created = await h.run(script);
  assert.equal(created.status, 'created-candidate', JSON.stringify(created));
  assert.equal(created.receiptKind, 'creation-objects-only');
  assert.equal(h.collections.length, 8);
  assert.equal(h.variables.length, graph.sourceTokens.variables.length + graph.routes.length);
  const observed = await h.run(emitNativeTemplateGraphReadbackScript(h.input, created.identity));
  assert.equal(observed.status, 'readback-collected', JSON.stringify(observed));
  verifyNativeTemplateGraphReceipt(h.input, created.identity, observed.receipt);
  assert.deepEqual(observed.receipt, created.receipt);
  const before = JSON.stringify(observed.receipt), ids = h.variables.map(v => v.id);
  const repeated = await h.run(script);
  assert.equal(repeated.status, 'refused'); assert.equal(repeated.allocationAttempted, false);
  assert.deepEqual(h.variables.map(v => v.id), ids);
  assert.equal(JSON.stringify((await h.run(emitNativeTemplateGraphReadbackScript(h.input, created.identity))).receipt), before);
});

test('independent scopes can share compiler alias names without adopting or changing each other', async () => {
  const h = nativeFixture(2, 3, 2), first = await h.run(emitNativeTemplateGraphScript(h.input).script);
  assert.equal(first.status, 'created-candidate');
  const firstRead = emitNativeTemplateGraphReadbackScript(h.input, first.identity);
  const before = (await h.run(firstRead)).receipt;
  verifyNativeTemplateGraphReceipt(h.input, first.identity, before);
  const otherInput = structuredClone(h.input); otherInput.tokens.scopeId = 'independent-template-graph';
  const otherScript = emitNativeTemplateGraphScript(otherInput).script;
  const second = await h.run(otherScript);
  assert.equal(second.status, 'created-candidate', JSON.stringify(second));
  assert.deepEqual(second.identity.routes.map((v: any) => v.name), first.identity.routes.map((v: any) => v.name));
  const allocatedIds = (id: typeof first.identity): string[] => [id.source.collection.id,
    ...id.source.variables.map((v: any) => v.id), ...id.selectors.map((c: any) => c.id), ...id.routes.map((v: any) => v.id)];
  const firstIds = new Set(allocatedIds(first.identity));
  assert.ok(allocatedIds(second.identity).every(id => !firstIds.has(id)));
  const after = (await h.run(firstRead)).receipt;
  assert.deepEqual(after, before);
  verifyNativeTemplateGraphReceipt(h.input, first.identity, after);
  const secondObserved = await h.run(emitNativeTemplateGraphReadbackScript(otherInput, second.identity));
  verifyNativeTemplateGraphReceipt(otherInput, second.identity, secondObserved.receipt);
  const inventory = { collections: h.collections.map(c => c.id), variables: h.variables.map(v => v.id) };
  const repeated = await h.run(otherScript);
  assert.equal(repeated.status, 'refused'); assert.equal(repeated.allocationAttempted, false);
  assert.deepEqual(repeated.problems, ['native-template-graph-scope-collision']);
  assert.deepEqual({ collections: h.collections.map(c => c.id), variables: h.variables.map(v => v.id) }, inventory);
});

test('mode capacity and mid-variable failures retain exact source and selector allocation IDs', async () => {
  const limited = nativeFixture(1, 3, 2);
  const result = await limited.run(emitNativeTemplateGraphScript(limited.input).script);
  assert.equal(result.status, 'partial-allocation'); assert.equal(result.allocationAttempted, true);
  assert.equal(result.allocation.source.status, 'created-candidate');
  assert.deepEqual(limited.collections.map(c => c.id), [result.allocation.source.allocation.collection.id, ...result.allocation.selectors.map((c: any) => c.id)]);
  assert.equal(result.allocation.selectors[0].modes.length, 1);
  assert.deepEqual(result.allocation.routes, []);
  const h = nativeFixture(2, 3, 2), create = h.figma.variables.createVariable.bind(h.figma.variables);
  let routing = 0;
  h.figma.variables.createVariable = (...args: any[]) => {
    const v = create(...args);
    if (v.name.startsWith('dsc-native-template/') && ++routing === 3)
      v.setSharedPluginData = () => { throw Error('bounded metadata fault'); };
    return v;
  };
  const partial = await h.run(emitNativeTemplateGraphScript(h.input).script);
  assert.equal(partial.status, 'partial-allocation'); assert.equal(partial.allocation.routes.length, 3);
  assert.deepEqual(h.variables.map(v => v.id), [...partial.allocation.source.allocation.variables.map((v: any) => v.id), ...partial.allocation.routes.map((v: any) => v.id)]);
  assert.equal(partial.identity, undefined, 'partial objects cannot masquerade as a complete identity');
});

test('wrong-file and pre-existing renamed owned selectors refuse without allocating', async () => {
  const h = nativeFixture(2, 3, 2), generated = emitNativeTemplateGraphScript(h.input);
  h.figma.fileKey = 'wrong-file';
  const wrong = await h.run(generated.script);
  assert.deepEqual(wrong.problems, ['native-template-graph-file-mismatch']);
  assert.equal(h.collections.length, 0); assert.equal(h.variables.length, 0);
  h.figma.fileKey = h.input.tokens.fileKey;
  const preexisting = h.figma.variables.createVariableCollection('Renamed stranded selector');
  preexisting.setSharedPluginData('ds_contracts', 'nativeTextTemplateGraph', JSON.stringify({ scopeId: h.input.tokens.scopeId, graphRevision: 'older' }));
  const refused = await h.run(generated.script);
  assert.equal(refused.status, 'refused'); assert.equal(refused.allocationAttempted, false);
  assert.equal(h.collections.length, 1); assert.equal(h.variables.length, 0);
});

test('independent graph readback rejects same-valued aliases, foreign inventory, ownership and picker-scope drift', async () => {
  const h = nativeFixture(2, 3, 3), created = await h.run(emitNativeTemplateGraphScript(h.input).script);
  const read = emitNativeTemplateGraphReadbackScript(h.input, created.identity);
  const good = (await h.run(read)).receipt;
  for (const mutate of [
    (r: any) => { const route = r.routes.find((v: any) => v.resolvedType === 'COLOR'); route.valuesByMode[Object.keys(route.valuesByMode)[0]].id = created.identity.source.variables.find((v: any) => v.tokenPath === 'ink.v2').id; },
    (r: any) => { r.selectors[0].variableIds.push('unowned'); },
    (r: any) => { r.selectors[0].ownership.graphRevision = 'other'; },
    (r: any) => { r.routes[0].scopes = ['ALL_SCOPES']; },
    (r: any) => { r.sourceScopes[Object.keys(r.sourceScopes)[0]] = ['ALL_SCOPES']; },
    (r: any) => { r.routes[0].ownership.collectionId = created.identity.source.collection.id; },
    (r: any) => { r.source.variables[0].valuesByMode[created.identity.source.modes[0].modeId] = 999; },
  ]) {
    const receipt = structuredClone(good); mutate(receipt);
    assert.notDeepEqual(receipt, good);
    assert.throws(() => verifyNativeTemplateGraphReceipt(h.input, created.identity, receipt), /native-template-graph-(route-readback|selector-readback|source-readback|source-scopes)/);
  }
  const route = h.variables.find(v => v.name === created.identity.routes[0].name)!;
  route.name = 'Renamed without adoption';
  const drift = await h.run(read);
  assert.equal(drift.status, 'readback-collected', 'read collection is not a verification verdict');
  assert.throws(() => verifyNativeTemplateGraphReceipt(h.input, created.identity, drift.receipt), /route-readback/);
});

test('a file change after allocation retains the returned ID and prevents metadata or mode writes', async () => {
  const h = nativeFixture(2, 3, 2), create = h.figma.variables.createVariableCollection.bind(h.figma.variables);
  h.figma.variables.createVariableCollection = (name: string) => {
    const c = create(name);
    if (name.includes('/ Text selector')) h.figma.fileKey = 'changed-file';
    return c;
  };
  const created = await h.run(emitNativeTemplateGraphScript(h.input).script);
  assert.equal(created.status, 'partial-allocation');
  assert.deepEqual(created.problems, ['native-template-graph-file-mismatch']);
  const c = h.collections[1];
  assert.equal(created.allocation.selectors[0].id, c.id);
  assert.equal(c.getSharedPluginData('ds_contracts', 'nativeTextTemplateGraph'), '');
  assert.equal(c.modes.length, 1); assert.equal(c.modes[0].name, 'Mode 1');
});

test('a competing selector created during asynchronous source lookup stops further allocation', async () => {
  const h = nativeFixture(2, 3, 2), generated = emitNativeTemplateGraphScript(h.input);
  const read = h.figma.variables.getVariableByIdAsync.bind(h.figma.variables); let inserted = false;
  h.figma.variables.getVariableByIdAsync = async (id: string) => {
    if (!inserted) { inserted = true; h.figma.variables.createVariableCollection(generated.graph.selectors[0].collectionName); }
    return read(id);
  };
  const created = await h.run(generated.script);
  assert.equal(created.status, 'partial-allocation');
  assert.deepEqual(created.problems, ['native-template-graph-scope-collision']);
  assert.deepEqual(created.allocation.selectors, []); assert.deepEqual(created.allocation.routes, []);
  assert.equal(h.collections.length, 2); assert.equal(h.variables.length, generated.graph.sourceTokens.variables.length);
});



test('shared component renderer carries the complete selector vector and inherits four stable text bindings', async () => {
  const h = await componentFixture(), before = structuredClone(h.observed.receipt);
  const result = await h.run(h.script());
  assert.equal(result.status, 'created-candidate', JSON.stringify(result));
  const draft = h.engine.compileNativeContractDraft(h.contract, h.byId, h.source);
  const observation: NativeContractObservationInput = { operation: h.operation, planRevision: revisionOf('graph component observation'),
    projection: draft.projection, component: draft.component, tokenInput: h.context.tokens.input,
    tokenIdentity: h.context.tokens.identity, creation: result, templateGraph: { input: h.input, identity: h.created.identity } };
  const readback = await h.run(emitNativeContractReadbackScript(observation));
  assert.equal(verifyNativeContractReadback(observation, readback).status, 'supported-structure-observed', JSON.stringify(verifyNativeContractReadback(observation, readback)));
  for (const mutate of [
    (r: any) => { delete r.templateGraph; },
    (r: any) => { r.templateGraph.receipt.routes[0].valuesByMode = {}; },
    (r: any) => { delete r.nodes.find((n: any) => n.type === 'COMPONENT').values.explicitVariableModes[h.created.identity.selectors[0].id]; },
    (r: any) => { r.nodes.find((n: any) => n.type === 'TEXT').values.explicitVariableModes = { [h.created.identity.selectors[0].id]: h.created.identity.selectors[0].modes[0].modeId }; },
    (r: any) => { r.nodes.find((n: any) => n.type === 'TEXT').values.fontWeight = 800; },
  ]) {
    const altered = structuredClone(readback); mutate(altered);
    assert.equal(verifyNativeContractReadback(observation, altered).status, 'refused');
  }
  const set = await h.figma.getNodeByIdAsync(result.target.id);
  assert.equal(set.children.length, 9);
  for (const main of set.children) {
    const selected = nativeRootTextTemplateGraphSelection(h.graph, main.name);
    const modes = Object.fromEntries([[h.context.tokens.identity.collection.id, h.context.tokens.identity.modes[0].modeId],
      ...h.context.templateGraph.identity.selectors.map((s: any) => [s.id, s.modes[Number(selected[s.selector])].modeId])]);
    assert.deepEqual(main.explicitVariableModes, modes);
    const slot = main.children[0], text = slot.children[0];
    assert.equal(slot.type, 'SLOT'); assert.equal(text.type, 'TEXT');
    assert.equal(text.visible, false); assert.equal(text.characters, '');
    assert.deepEqual(slot.explicitVariableModes, {}); assert.deepEqual(text.explicitVariableModes, {});
    assert.deepEqual(text.resolvedVariableModes, modes);
    const sources = selectedSources(h.graph, main.name);
    for (const [channel, alias] of Object.entries(h.graph.template.aliases)) {
      const id = h.context.templateGraph.identity.routes.find((r: any) => r.name === alias)!.id;
      const variable = h.variables.find(v => v.id === id)!;
      const sourceId = h.context.tokens.identity.variables.find((v: any) => v.tokenPath === sources[channel])!.id;
      const source = h.variables.find(v => v.id === sourceId)!;
      assert.deepEqual(variable.resolveForConsumer(text), source.resolveForConsumer(text));
      if (channel === 'fill') assert.equal(text.fills[0].boundVariables.color.id, id);
      else assert.equal(text.boundVariables[channel][0].id, id);
    }
  }
  const after = await h.run(emitNativeTemplateGraphReadbackScript(h.input, h.created.identity));
  assert.deepEqual(after.receipt, before, 'component creation never modifies the routing graph');
  const size = h.context.tokens.identity.variables.find((v: any) => v.tokenPath === 'size.v0')!;
  assert.deepEqual(after.receipt.sourceScopes[size.id], ['CORNER_RADIUS', 'FONT_SIZE', 'GAP']);
  const ink = h.context.tokens.identity.variables.find((v: any) => v.tokenPath === 'ink.v0')!;
  assert.deepEqual(after.receipt.sourceScopes[ink.id], ['FRAME_FILL', 'STROKE_COLOR', 'TEXT_FILL']);
  const nodes = h.figma.root.findAll(() => true).map((n: any) => n.id);
  const repeat = await h.run(h.script());
  assert.equal(repeat.status, 'refused'); assert.equal(repeat.allocationAttempted, false);
  assert.deepEqual(h.figma.root.findAll(() => true).map((n: any) => n.id), nodes);
});

test('component graph context is rederived; receipt and source substitution refuse before a program is emitted', async () => {
  const h = await componentFixture();
  for (const mutate of [
    (c: typeof h.context) => { c.templateGraph.receipt.routes[0].valuesByMode = {}; },
    (c: typeof h.context) => { c.templateGraph.identity.source.collection.id = 'other'; },
    (c: typeof h.context) => { c.tokens.input.source.sourceProgramSha256 = 'b'.repeat(64); },
    (c: typeof h.context) => { c.tokens.input.modes[0].tokenTreeRevision = revisionOf('invented'); },
  ]) {
    const context = structuredClone(h.context); mutate(context);
    assert.throws(() => h.engine.buildNativeContractDraftScript(h.contract, h.byId, h.source, context), /native-template-graph-|native-source-write-template-graph-|NATIVE_ROOT_TEXT_TEMPLATE_GRAPH_/);
  }
  const c = structuredClone(h.contract); c.anatomy.root.tokens!['font-size'] = '{size.v0}';
  assert.throws(() => h.engine.buildNativeContractDraftScript(c, new Map([[c.id, c]]), h.source, h.context), /native-template-graph-identity-shape/);
});

test('a routing edit during asynchronous font preflight refuses with no node allocation', async () => {
  const h = await componentFixture(), script = h.script(), before = h.figma.root.findAll(() => true).map((n: any) => n.id);
  const load = h.figma.loadFontAsync.bind(h.figma); let changed = false;
  h.figma.loadFontAsync = async (...args: any[]) => {
    if (!changed) {
      changed = true;
      const route = h.variables.find(v => v.id === h.context.templateGraph.identity.routes[0].id)!;
      route.scopes = ['ALL_SCOPES'];
    }
    return load(...args);
  };
  const result = await h.run(script);
  assert.equal(result.status, 'refused'); assert.equal(result.allocationAttempted, false);
  assert.deepEqual(result.problems, ['native-source-write-template-graph-changed']);
  assert.deepEqual(h.figma.root.findAll(() => true).map((n: any) => n.id), before);
});

test('a competing operation page created during final graph lookup refuses before allocation', async () => {
  const h = await componentFixture(), script = h.script();
  const load = h.figma.loadFontAsync.bind(h.figma), lookup = h.figma.variables.getVariableByIdAsync.bind(h.figma.variables);
  let fontsReached = false, inserted = false, competingId = '';
  h.figma.loadFontAsync = async (...args: any[]) => { fontsReached = true; return load(...args); };
  h.figma.variables.getVariableByIdAsync = async (id: string) => {
    if (fontsReached && !inserted && id === h.created.identity.routes[0].id) {
      inserted = true;
      const page = h.figma.createPage(); page.name = 'DS contract draft / ' + h.operation.id; competingId = page.id;
    }
    return lookup(id);
  };
  const before = h.figma.root.findAll(() => true).map((n: any) => n.id);
  const result = await h.run(script);
  assert.equal(inserted, true);
  assert.equal(result.status, 'refused'); assert.equal(result.allocationAttempted, false);
  assert.deepEqual(result.problems, ['native-source-write-page-name-collision']);
  assert.deepEqual(h.figma.root.findAll(() => true).map((n: any) => n.id), [...before, competingId]);
});


async function graphCallerFixture() {
  const h = await componentFixture(), creation = await h.run(h.script());
  assert.equal(creation.status, 'created-candidate', JSON.stringify(creation));
  const draft = h.engine.compileNativeContractDraft(h.contract, h.byId, h.source);
  const parent: NativeContractObservationInput = { operation: h.operation, planRevision: revisionOf('graph caller parent'),
    projection: draft.projection, component: draft.component, tokenInput: h.context.tokens.input,
    tokenIdentity: h.context.tokens.identity, creation, templateGraph: { input: h.input, identity: h.created.identity } };
  const receipt = await h.run(emitNativeContractReadbackScript(parent));
  assert.equal(verifyNativeContractReadback(parent, receipt).status, 'supported-structure-observed');
  const content = structuredClone(h.contract); content.id = 'test.graph-caller'; content.props = [];
  delete content.anatomy.root.slot;
  for (const [key, value] of Object.entries(content.anatomy.root.tokens!))
    content.anatomy.root.tokens![key] = value.replace('{size}', 'v2').replace('{ink}', 'v1');
  content.anatomy.root.parts = { label: { text: 'Graph caller text' } };
  const variantName = parent.component.variants.find(v => v.name.includes('Size=v2') && v.name.includes('Ink=v1'))!.name;
  const comparison = { parent, receipt, caseId: 'graph-caller', variantName, slotSpecPath: [0],
    rootText: { version: 1 as const, kind: 'direct-root-text' as const, characters: 'Graph caller text',
      contractRevision: revisionOf(content), treeRevision: revisionOf('authenticated root direct text') } };
  const caller = h.engine.compileComponentData(content, new Map([[content.id, content]]));
  const prepared = prepareNativeContractComparison(content, caller, h.source, revisionOf(h.tokens),
    { mode: 'light', brand: 'default' }, comparison, h.tokens);
  const operation = { id: '10000000-0000-4000-8000-000000000098', fileKey: h.figma.fileKey };
  const tokenInput = structuredClone(h.context.tokens.input); tokenInput.scopeId = 'source-' + operation.id;
  const tokenCreation = await h.run(emitNativeTokenContextScript(tokenInput).script);
  assert.equal(tokenCreation.status, 'created-candidate', JSON.stringify(tokenCreation));
  const tokenRead = await h.run(emitNativeTokenContextReadbackScript(tokenInput, tokenCreation.creationIdentity));
  const context = { operation, tokens: { input: tokenInput, identity: tokenCreation.creationIdentity, receipt: tokenRead.receipt } };
  const script = () => h.engine.buildNativeContractComparisonScript(content, new Map([[content.id, content]]), h.source, context, comparison);
  return { h, parent, receipt, content, comparison, prepared, operation, tokenInput, context, script };
}

test('graph caller retains every inherited selector and edits existing text without changing any main or route', async () => {
  const f = await graphCallerFixture(), { h } = f;
  assert.equal(Object.keys(f.prepared.textTemplate!.modeVector!).length, h.graph.selectors.length + 1);
  const creation = await h.run(f.script());
  assert.equal(creation.status, 'created-candidate', JSON.stringify(creation));
  const input: NativeContractComparisonObservationInput = { operation: f.operation, planRevision: revisionOf('graph caller observation'),
    comparison: f.prepared, tokenInput: f.tokenInput, tokenIdentity: f.context.tokens.identity, creation };
  const observed = await h.run(emitNativeContractComparisonReadbackScript(input));
  const verified = verifyNativeContractComparisonReadback(input, observed);
  assert.equal(verified.status, 'supported-comparison-structure-observed', JSON.stringify(verified));
  const text = observed.content.nodes.find((n: any) => n.type === 'TEXT');
  const nativeOmission = structuredClone(observed);
  for (const node of nativeOmission.content.nodes) if (node.values.resolvedVariableModes)
    delete node.values.resolvedVariableModes[f.context.tokens.identity.collection.id];
  assert.equal(verifyNativeContractComparisonReadback(input, nativeOmission).status, 'supported-comparison-structure-observed');
  for (const mode of ['incorrect', undefined]) {
    const changed = structuredClone(observed), node = changed.content.nodes.find((n: any) => n.type === 'TEXT');
    if (mode) node.values.resolvedVariableModes[f.context.tokens.identity.collection.id] = mode;
    else node.values.resolvedVariableModes['foreign-collection'] = 'foreign-mode';
    assert.equal(verifyNativeContractComparisonReadback(input, changed).status, 'refused');
  }
  assert.equal(text.values.characters, 'Graph caller text');
  assert.equal(text.values.fontSize, 14); assert.equal(text.values.lineHeight.value, 20);
  assert.deepEqual(text.values.explicitVariableModes, {});
  assert.deepEqual(await h.run(emitNativeContractReadbackScript(f.parent)), f.receipt);
  for (const mutate of [
    (r: any) => { delete r.content.nodes.find((n: any) => n.type === 'TEXT').values.resolvedVariableModes[h.created.identity.selectors[0].id]; },
    (r: any) => { r.content.nodes.find((n: any) => n.type === 'SLOT').values.explicitVariableModes = f.prepared.textTemplate!.modeVector; },
    (r: any) => { r.content.nodes.find((n: any) => n.type === 'INSTANCE').values.resolvedVariableModes[h.created.identity.selectors[0].id] = 'wrong'; },
    (r: any) => { r.content.nodes.find((n: any) => n.type === 'TEXT').values.fontSize = 12; },
    (r: any) => { r.content.nodes.find((n: any) => n.type === 'TEXT').values.fills[0].boundVariables.color.id = h.context.tokens.identity.variables.find((v: any) => v.tokenPath === 'ink.v1').id; },
    (r: any) => { r.parent.templateGraph.receipt.routes[0].valuesByMode = {}; },
  ]) {
    const changed = structuredClone(observed); mutate(changed);
    assert.equal(verifyNativeContractComparisonReadback(input, changed).status, 'refused');
  }
  const forged = structuredClone(input); delete forged.comparison.textTemplate!.modeVector![h.created.identity.selectors[0].id];
  assert.throws(() => emitNativeContractComparisonReadbackScript(forged), /template-observation-input-invalid/);
  const before = h.figma.root.findAll(() => true).map((n: any) => n.id);
  const repeated = await h.run(f.script());
  assert.equal(repeated.status, 'refused'); assert.equal(repeated.allocationAttempted, false);
  assert.deepEqual(h.figma.root.findAll(() => true).map((n: any) => n.id), before);
});

test('graph caller refuses route drift during font loading and a new competing page during final parent observation', async () => {
  for (const race of ['route', 'page']) {
    const f = await graphCallerFixture(), { h } = f, script = f.script();
    const before = h.figma.root.findAll(() => true).map((n: any) => n.id);
    let injected = false, competitor: any;
    if (race === 'route') {
      const load = h.figma.loadFontAsync.bind(h.figma);
      h.figma.loadFontAsync = async (font: any) => {
        await load(font);
        if (!injected) { injected = true; h.variables.find(v => v.id === h.created.identity.routes[0].id)!.name += ' drift'; }
      };
    } else {
      const get = h.figma.variables.getVariableByIdAsync.bind(h.figma.variables);
      h.figma.variables.getVariableByIdAsync = async (id: string) => {
        const value = await get(id);
        if (!injected && id === h.created.identity.routes.at(-1).id) {
          injected = true; competitor = h.figma.createPage(); competitor.name = 'DS contract draft / ' + f.operation.id;
        }
        return value;
      };
    }
    const result = await h.run(script);
    assert.equal(injected, true); assert.equal(result.status, 'refused', JSON.stringify(result));
    assert.equal(result.allocationAttempted, false); assert.deepEqual(result.nodes, []);
    assert.deepEqual(h.figma.root.findAll(() => true).map((n: any) => n.id), [...before, ...(competitor ? [competitor.id] : [])]);
  }
});


const captureProgram = (name: string) => readFileSync(new URL('../extract/figma/dump.plugin.js', import.meta.url), 'utf8')
  .replace(/^const TARGET_SETS = \[[^\n]*\];$/m, `const TARGET_SETS = ${JSON.stringify([name])};`);

test('canonical capture retains every raw graph variable, mode, alias edge and main/child selector vector', async () => {
  const h = await componentFixture(), creation = await h.run(h.script());
  assert.equal(creation.status, 'created-candidate');
  const before = await h.run(emitNativeTemplateGraphReadbackScript(h.input, h.created.identity));
  const dump = await h.run(captureProgram(h.contract.name)), graph = dump[h.contract.name].templateVariableGraph;
  assert.equal(dump._provenance.dumpVersion, '1.47');
  assert.ok(graph, JSON.stringify(dump._degradations));
  assert.equal(graph.fileKey, h.figma.fileKey); assert.equal(graph.collections.length, h.collections.length);
  assert.equal(graph.variables.length, h.variables.length); assert.equal(graph.consumers.length, 27);
  for (const variable of h.variables) {
    const raw = graph.variables.find((v: any) => v.id === variable.id);
    assert.equal(raw.key, variable.key); assert.equal(raw.collectionId, variable.variableCollectionId);
    assert.equal(canonicalJson(raw.valuesByMode), canonicalJson(variable.valuesByMode));
  }
  for (const collection of h.collections) {
    const raw = graph.collections.find((v: any) => v.id === collection.id);
    assert.deepEqual(raw.variableIds, [...collection.variableIds].sort());
    assert.deepEqual(raw.modes, collection.modes); assert.equal(raw.defaultModeId, collection.defaultModeId);
  }
  for (const consumer of graph.consumers) {
    const node = await h.figma.getNodeByIdAsync(consumer.nodeId);
    assert.deepEqual(consumer.explicitVariableModes, node.explicitVariableModes);
    assert.deepEqual(consumer.resolvedVariableModes, node.resolvedVariableModes);
  }
  assert.deepEqual(await h.run(emitNativeTemplateGraphReadbackScript(h.input, h.created.identity)), before);
});

test('raw template capture includes unbound collection members and names inventory drift without a partial graph', async () => {
  for (const drift of [false, true]) {
    const h = await componentFixture(); await h.run(h.script());
    const collection = h.collections.find(c => c.id === h.created.identity.source.collection.id);
    const unused = h.figma.variables.createVariable('unbound/source', collection, 'FLOAT');
    unused.setValueForMode(collection.modes[0].modeId, 7);
    if (drift) {
      const get = h.figma.variables.getVariableByIdAsync.bind(h.figma.variables); let reads = 0;
      h.figma.variables.getVariableByIdAsync = async (id: string) => {
        if (id === unused.id && ++reads === 2) unused.setValueForMode(collection.modes[0].modeId, 8);
        return get(id);
      };
    }
    const dump = await h.run(captureProgram(h.contract.name)), graph = dump[h.contract.name].templateVariableGraph;
    if (drift) {
      assert.equal(graph, undefined);
      assert.ok(dump._degradations.some((d: any) => d.code === 'template-variable-graph-unavailable' && d.message.includes('variable changed')));
    } else {
      assert.deepEqual(graph.variables.find((v: any) => v.id === unused.id).valuesByMode, unused.valuesByMode);
      assert.ok(graph.collections.find((c: any) => c.id === collection.id).variableIds.includes(unused.id));
    }
  }
});


test('graph inverse restores original source references from the complete raw routing graph without changing the dump', async () => {
  const h = await componentFixture(); await h.run(h.script());
  const dump = await h.run(captureProgram(h.contract.name)), before = structuredClone(dump);
  const projection = projectRootTextTemplateAliases(dump[h.contract.name])!;
  assert.ok(projection); assert.equal(projection.syntheticNames.length, h.graph.routes.length);
  assert.equal(projection.tokens.some(t => t.name.startsWith('dsc-native-template/')), false);
  const layer = capturedTokensFromDump(dump)!; assert.deepEqual(layer.skipped, []);
  const batch = proposeBatchFromDump(dump, { corpus: tokenCorpusFromJson({ primitives: layer.tree, semantic: {}, light: {}, brandDefault: {} }),
    contractIdByName: new Map<string, string>(), mintUnbound: true });
  assert.deepEqual(batch.skipped, []); assert.equal(batch.proposals.length, 1);
  const returned = ContractSchema.parse(batch.proposals[0].contract);
  for (const field of ['color', 'font-size', 'line-height', 'font-weight'])
    assert.equal(returned.anatomy.root.tokens![field], h.contract.anatomy.root.tokens![field]);
  assert.equal(JSON.stringify(returned).includes('dsc-native-template'), false);
  assert.deepEqual(dump, before);
  const sourceInk = h.variables.find(v => v.name === 'ink/v1')!;
  sourceInk.setValueForMode(Object.keys(sourceInk.valuesByMode)[0], { r: 1, g: 0, b: 0, a: 1 });
  const edited = await h.run(captureProgram(h.contract.name));
  const updated = projectRootTextTemplateAliases(edited[h.contract.name])!;
  assert.equal(updated.tokens.find(t => t.name === 'ink/v1')!.value, '#ff0000');
  assert.deepEqual(edited[h.contract.name].templateVariableGraph.variables.filter((v: any) => v.name.startsWith('dsc-native-template/')),
    dump[h.contract.name].templateVariableGraph.variables.filter((v: any) => v.name.startsWith('dsc-native-template/')));
});

test('graph return keeps optional typography token identities including omission and equal-valued weight refs', async () => {
  const h = await componentFixture(3, 3, f => {
    delete f.contract.props[0].default;
    f.contract.props[0].bindings!.figma!.unsetValue = '(unset)';
    const root = f.contract.anatomy.root;
    (f.tokens as any).weights = Object.fromEntries(['base', 'v0', 'v1', 'v2'].map(k => [k, { $type: 'fontWeight', $value: 400 }]));
    Object.assign(root.tokens!, { 'font-size': '{size.v0}', 'line-height': '{line.v0}', 'font-weight': '{weights.base}' });
    root.tokensByProp = [{ prop: 'size', map: Object.fromEntries(['v0','v1','v2'].map(k => [k, {
      'font-size': `{size.${k}}`, 'line-height': `{line.${k}}`, 'font-weight': `{weights.${k}}`,
    }])) }];
  });
  await h.run(h.script());
  const dump = await h.run(captureProgram(h.contract.name)), layer = capturedTokensFromDump(dump)!;
  const batch = proposeBatchFromDump(dump, { corpus: tokenCorpusFromJson({ primitives: layer.tree, semantic: {}, light: {}, brandDefault: {} }),
    contractIdByName: new Map<string, string>(), mintUnbound: true });
  assert.deepEqual(batch.skipped, []); assert.equal(batch.proposals.length, 1);
  const returned = ContractSchema.parse(batch.proposals[0].contract);
  const evaluate = (root: typeof returned.anatomy.root, size?: string) => {
    const entries = !root.tokensByProp ? [] : Array.isArray(root.tokensByProp) ? root.tokensByProp : [root.tokensByProp];
    return { ...root.tokens, ...entries.find(e => e.prop === 'size')?.map[size!] };
  };
  for (const size of [undefined, 'v0','v1','v2']) for (const field of ['font-size','line-height','font-weight'])
    assert.equal(evaluate(returned.anatomy.root, size)[field], evaluate(h.contract.anatomy.root, size)[field], `${size}/${field}`);
  assert.equal(JSON.stringify(returned).includes('content-text-template'), false);
});

test('shared typography tokens require every consuming channel to match the captured value', async () => {
  const h = await componentFixture(2, 1, f => {
    f.contract.anatomy.root.tokens!['line-height'] = f.contract.anatomy.root.tokens!['font-size'];
  });
  await h.run(h.script());
  const dump = await h.run(captureProgram(h.contract.name));
  const layer = capturedTokensFromDump(dump)!;
  const options = { corpus: tokenCorpusFromJson({ primitives: layer.tree, semantic: {}, light: {}, brandDefault: {} }),
    contractIdByName: new Map<string, string>(), mintUnbound: true };
  const valid = proposeBatchFromDump(dump, options);
  assert.deepEqual(valid.skipped, []); assert.equal(valid.proposals.length, 1);
  const returned = ContractSchema.parse(valid.proposals[0].contract);
  assert.equal(returned.anatomy.root.tokens!['line-height'], returned.anatomy.root.tokens!['font-size']);
  for (const field of ['fontSize', 'lineHeight'] as const) {
    const changed = structuredClone(dump);
    changed[h.contract.name].variants[0].children[0].children[0].text[field] += 1;
    const refused = proposeBatchFromDump(changed, options);
    assert.equal(refused.proposals.length, 0, `${field} drift must refuse even when its token is shared`);
    assert.match(JSON.stringify(refused.skipped), /numeric binding.*disagrees with its consuming value/);
  }
});

test('graph inverse refuses changed unselected edges, missing inventory, foreign modes and source alias cycles', async () => {
  const h = await componentFixture(1, 1); await h.run(h.script());
  const dump = await h.run(captureProgram(h.contract.name)), set = dump[h.contract.name];
  const used = new Set<string>();
  for (const root of set.variants) for (const [id, c] of Object.entries<any>(root.children[0].children[0].variableConsumers))
    for (const hop of [{ id, ...c }, ...c.aliasChain]) used.add(hop.id + '/' + hop.modeId);
  const routes = set.templateVariableGraph.variables.filter((v: any) => v.name.startsWith('dsc-native-template/'));
  const unused = routes.flatMap((v: any) => Object.keys(v.valuesByMode).map(mode => ({ id: v.id, mode, type: v.resolvedType })))
    .find((x: any) => !used.has(x.id + '/' + x.mode));
  assert.ok(unused, 'the one-plane graph still records its unused carrier mode');
  for (const mutate of [
    (s: any) => { const v = s.templateVariableGraph.variables.find((v: any) => v.id === unused.id); v.valuesByMode[unused.mode] = { type: 'VARIABLE_ALIAS', id: v.id }; },
    (s: any) => { s.templateVariableGraph.collections[0].variableIds.pop(); },
    (s: any) => { s.templateVariableGraph.variables[0].valuesByMode.foreign = 1; },
    (s: any) => { s.templateVariableGraph.collections[0] = null; },
    (s: any) => { s.templateVariableGraph.variables[0].name = {}; },
    (s: any) => { s.templateVariableGraph.consumers[0].specPath = [-1]; },
    (s: any) => {
      const graph = s.templateVariableGraph, source = graph.collections.find((c: any) => c.id === h.created.identity.source.collection.id);
      assert.ok(source);
      const variable = { ...graph.variables.find((v: any) => v.name === 'weight'), id: 'unselected-cycle', key: 'unselected-cycle-key', name: 'unused/cycle',
        valuesByMode: { [source.modes[0].modeId]: { type: 'VARIABLE_ALIAS', id: 'unselected-cycle' } } };
      graph.variables.push(variable); source.variableIds.push(variable.id);
    },
    (s: any) => { s.templateVariableGraph.consumers[0].resolvedVariableModes.foreign = 'wrong'; },
    (s: any) => { s.templateVariableGraph.consumers[1].explicitVariableModes = s.templateVariableGraph.consumers[0].explicitVariableModes; },
    (s: any) => { s.templateVariableGraph.variables.find((v: any) => v.name === 'weight').valuesByMode = { [h.created.identity.source.modes[0].modeId]: { type:'VARIABLE_ALIAS',id:h.created.identity.routes.find((v: any)=>v.name.endsWith('/font-weight')).id } }; },
    (s: any) => { delete s.templateVariableGraph; },
    (s: any) => { s.variants[0].children[0].children[0].variableConsumers = {}; },
    (s: any) => { const c = s.variants[0].children[0].children[0].variableConsumers; c[Object.keys(c)[0]] = null; },
    (s: any) => { const c: any = Object.values(s.variants[0].children[0].children[0].variableConsumers)[0]; c.aliasChain[0] = null; },
  ]) {
    const changed = structuredClone(set); mutate(changed);
    assert.throws(() => projectRootTextTemplateAliases(changed), /FIGMA_SLOT_TEXT_TEMPLATE_READBACK_UNQUALIFIED/);
  }
});
