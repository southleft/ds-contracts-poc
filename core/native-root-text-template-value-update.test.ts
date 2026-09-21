import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { revisionOf, canonicalJson } from './contract-provenance.js';
import { nativeTextGraphFixture } from './native-text-template-test-fixture.js';
import type { NativeRootTextTemplateGraphInput } from './native-root-text-template-graph.js';
import { nativeFixtureHost } from '../source-reference/native-operation-test-fixture.js';
import { emitNativeTemplateGraphScript, emitNativeTemplateGraphReadbackScript } from './native-root-text-template-graph-native.js';
import { planNativeTemplateValueUpdate, verifyNativeTemplateValueUpdate, type NativeTemplateValueUpdateInput } from './native-root-text-template-value-update.js';

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
  return { f, host, compile, read, input: { before, desired: compile(), identity: created.identity, baseline } as NativeTemplateValueUpdateInput };
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
