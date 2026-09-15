import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { ContractSchema, PropSchema, resolveTokens, resolveLayout, resolveLiterals, walkAnatomy, type Contract } from '../scripts/contract-schema.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { proposeFromDump, ExactProjectionError } from './propose-figma.js';
import { readUnsetVariantAxes, lowerUnsetProposal, UnsetVariantError } from './figma-unset.js';
import { tokenCorpusFromJson } from './token-corpus.js';
import { createFigmaMock } from '../scripts/plugin-engine-mock-figma.mjs';
import type { DumpSet } from '../extract/figma/types.js';
import { mapRestToDump } from '../extract/figma/rest/map.js';
import { emitReact } from './emit-react.js';
import { emitReactInline } from './emit-react-inline.js';
import { tokenInventoryFromJson } from './tokens.js';
import { generatedTypeErrors } from './react-test-runtime.js';

const primitives = {
  blue: { $type: 'color', $value: '#0055ff' },
  gray: { $type: 'color', $value: '#889999' },
  red: { $type: 'color', $value: '#ee0011' },
  gap8: { $type: 'dimension', $value: '8px' },
  gap16: { $type: 'dimension', $value: '16px' },
};
const tokens = { primitives, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
const engine = createFigmaEngine({ tokens, icons: new Map() });
const corpus = tokenCorpusFromJson({ primitives, semantic: {}, light: {}, brandDefault: {} });
const prop = (name = 'variant', property = 'Variant') => ({
  name, type: { enum: ['secondary', 'tertiary', 'bare', 'danger'] },
  bindings: { code: { prop: name }, figma: {
    kind: 'VARIANT', property, unsetValue: '(unset)',
    values: { secondary: 'Secondary', tertiary: 'Tertiary', bare: 'Bare', danger: 'Danger' },
  } },
});
const seed = (): Contract => ContractSchema.parse({
  id: 'check.omitted', name: 'OmittedButton', version: '0.1.0', status: 'draft', description: 'Defaultless omission proof',
  props: [prop()], states: [], semantics: { element: 'button' },
  anatomy: { root: {
    layout: { display: 'flex' }, text: 'Submit',
    tokens: { 'background-color': '{blue}', gap: '{gap8}' },
    tokensByProp: [{ prop: 'variant', map: {
      secondary: { 'background-color': '{gray}' }, tertiary: { 'background-color': '{red}' },
      bare: { 'background-color': '{gray}' }, danger: { 'background-color': '{red}' },
    } }],
  } },
  bindings: { figma: { anchors: { fileKey: null, componentSetKey: null } }, code: { anchors: { importPath: 'check/omitted', export: 'OmittedButton' } } },
});
const compile = (c: Contract) => engine.compileComponentData(c, new Map([[c.id, c]]));

async function roundTrip(c: Contract) {
  const { figma, root } = createFigmaMock();
  const context = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
  const run = (code: string) => vm.runInContext(`(async () => {\n${code}\n})()`, context, { timeout: 20_000 }) as Promise<unknown>;
  await run(engine.buildTokensScript(null));
  const script = engine.buildComponentScript(c, new Map([[c.id, c]]));
  await run(script);
  type Node = { name: string; type: string; getSharedPluginData(ns: string, key: string): string; setSharedPluginData(ns: string, key: string, value: string): void };
  const node = root.findOne((n: Node) => n.type === 'COMPONENT_SET' && n.getSharedPluginData('ds_contracts', 'contractId') === c.id) as Node;
  assert.ok(node, 'writer actually created a set');
  const dump = async () => {
    const source = readFileSync(new URL('../extract/figma/dump.plugin.js', import.meta.url), 'utf8')
      .replace(/^const TARGET_SETS = \[[^\n]*\];$/m, `const TARGET_SETS = ${JSON.stringify([node.name])};`);
    const result = await run(source) as Record<string, unknown>;
    return result[node.name] as DumpSet;
  };
  return { set: await dump(), node, dump, run, script };
}
const propose = (set: DumpSet, mintUnbound = false) => proposeFromDump(set, { corpus, contractIdByName: new Map(), fileKey: null, projectionMode: 'exact', mintUnbound });
const refusal = (f: () => unknown, code = 'FIGMA_UNSET_METADATA_INVALID') => assert.throws(f, (error: unknown) => error instanceof UnsetVariantError && error.code === code);

test('legacy undrawn base remains a named refusal; opt-in compiles actual omitted base without a public value/default', () => {
  const c = seed();
  const old = structuredClone(c); delete old.props[0].bindings.figma.unsetValue;
  const before = compile(old);
  assert.equal(before.variants.length, 4);
  assert.ok(before.codeOnlyFacts?.some(f => f.reason.includes('FC-UNSET-PLANE-UNDRAWN')));
  assert.equal(before.variants[0].spec.fill, 'gray');
  const after = compile(c);
  assert.equal(after.variants.length, 5);
  assert.equal(after.variants[0].name, 'Variant=(unset)');
  assert.equal(after.variants[0].spec.fill, 'blue');
  assert.equal(after.variants[1].spec.fill, 'gray');
  assert.equal(after.codeOnlyFacts?.some(f => f.reason.includes('FC-UNSET-PLANE-UNDRAWN')) ?? false, false);
  assert.deepEqual(c.props[0].type, { enum: ['secondary', 'tertiary', 'bare', 'danger'] });
  assert.equal(Object.hasOwn(c.props[0], 'default'), false);
});

test('invalid/colliding bindings refuse both schema and direct compiler entry', () => {
  for (const mutate of [
    (p: Record<string, any>) => { p.default = 'secondary'; },
    (p: Record<string, any>) => { p.required = true; },
    (p: Record<string, any>) => { p.type = 'text'; },
    (p: Record<string, any>) => { p.bindings.figma.kind = 'TEXT'; },
    (p: Record<string, any>) => { p.bindings.code.prop = 'invalid-code-prop'; },
    ...['class', 'default', 'await', 'yield', 'arguments', 'eval', 'let', 'interface', 'ref', 'rest', 'classes', 'styles', 'style', 'className', 'children'].map(alias => (p: Record<string, any>) => { p.bindings.code.prop = alias; }),
    ...['', ' ', ' Unset', 'Unset, Other', 'Unset=Other', '\nUnset', 'Secondary', 'secondary!', '---', 'true', 'False'].map(label => (p: Record<string, any>) => { p.bindings.figma.unsetValue = label; }),
  ]) {
    const p = prop(); mutate(p);
    assert.equal(PropSchema.safeParse(p).success, false);
    const c = seed(); c.props[0] = p as Contract['props'][number];
    assert.throws(() => compile(c));
  }
});

test('real emitted program → canonical dump → exact proposal preserves omitted base and public API', async () => {
  const c = seed();
  const live = await roundTrip(c);
  assert.equal(live.set.variants.length, 5);
  assert.equal(live.set.propertyDefinitions?.Variant.defaultValue, '(unset)');
  assert.equal(readUnsetVariantAxes(live.set).length, 1);
  const result = propose(live.set);
  const back = ContractSchema.parse(result.contract);
  const p = back.props.find(p => p.name === 'variant')!;
  assert.deepEqual(p.type, c.props[0].type);
  assert.equal(Object.hasOwn(p, 'default'), false);
  assert.equal(p.bindings.figma.unsetValue, '(unset)');
  assert.equal(resolveTokens(back.anatomy.root, {})['background-color'], '{blue}');
  assert.equal(resolveTokens(back.anatomy.root, { variant: 'secondary' })['background-color'], '{gray}');
  assert.deepEqual(compile(back).variants.map(v => v.name), compile(c).variants.map(v => v.name));
  const stamp = live.node.getSharedPluginData('ds_contracts', 'unsetVariantAxes');
  live.node.setSharedPluginData('ds_contracts', 'unsetVariantAxes', '{broken');
  refusal(() => propose({ ...live.set, unsetVariantAxes: '{broken' }));
  assert.equal((await live.dump()).unsetVariantAxes, '{broken', 'malformed JSON survives canonical dump');
  await live.run(live.script);
  assert.equal(live.node.getSharedPluginData('ds_contracts', 'unsetVariantAxes'), stamp, 'unchanged path repairs metadata');
  const beforeOptOut = await live.dump();
  const without = structuredClone(c); delete without.props[0].bindings.figma.unsetValue;
  await assert.rejects(live.run(engine.buildComponentScript(without, new Map([[without.id, without]]))), /FIGMA_UNSET_RETIREMENT_REFUSED/);
  assert.equal(live.node.getSharedPluginData('ds_contracts', 'unsetVariantAxes'), stamp, 'opt-out retains original omission provenance');
  assert.deepEqual(await live.dump(), beforeOptOut, 'refused opt-out does not mutate target history or identity');
  const unchanged = ContractSchema.parse(propose(await live.dump()).contract);
  assert.deepEqual(unchanged.props[0].type, c.props[0].type, 'retained omitted cell never becomes public enum');
  const renamed = structuredClone(c); renamed.props[0].bindings.figma.unsetValue = '(omitted)';
  await assert.rejects(live.run(engine.buildComponentScript(renamed, new Map([[renamed.id, renamed]]))), /FIGMA_UNSET_RETIREMENT_REFUSED/);
  assert.deepEqual(await live.dump(), beforeOptOut);
});

test('two omitted axes preserve exact Cartesian rows and independent base carriers', async () => {
  const c = seed();
  c.props.push(PropSchema.parse({ name: 'size', type: { enum: ['large'] }, bindings: { code: { prop: 'size' }, figma: { kind: 'VARIANT', property: 'Size', values: { large: 'Large' }, unsetValue: '(unsized)' } } }));
  assert.ok(Array.isArray(c.anatomy.root.tokensByProp));
  c.anatomy.root.tokensByProp.push({ prop: 'size', map: { large: { gap: '{gap16}' } } });
  const before = compile(c);
  assert.equal(before.variants.length, 10);
  assert.equal(before.variants[0].name, 'Variant=(unset), Size=(unsized)');
  assert.equal(before.variants[0].spec.bindings?.itemSpacing, 'gap8');
  assert.equal(before.variants[1].spec.bindings?.itemSpacing, 'gap16');
  const { set } = await roundTrip(c);
  const duplicateCodeAlias = structuredClone(set);
  (duplicateCodeAlias.unsetVariantAxes as { axes: Array<{ codeProp: string }> }).axes[1].codeProp = 'variant';
  refusal(() => propose(duplicateCodeAlias));
  const back = ContractSchema.parse(propose(set).contract);
  assert.deepEqual(back.props.filter(p => p.bindings.figma.kind === 'VARIANT').map(p => p.type), c.props.map(p => p.type));
  assert.ok(back.props.filter(p => p.bindings.figma.kind === 'VARIANT').every(p => !Object.hasOwn(p, 'default')));
  assert.deepEqual(compile(back).variants.map(v => v.name), before.variants.map(v => v.name));
  assert.equal(resolveTokens(back.anatomy.root, {})['gap'], '{gap8}');
  assert.equal(resolveTokens(back.anatomy.root, { size: 'large' })['gap'], '{gap16}');
  const missing = structuredClone(set); missing.variants.splice(1, 1);
  assert.throws(() => propose(missing), (error: unknown) => error instanceof ExactProjectionError && error.code === 'EXACT_MATRIX_RAGGED');
});

test('omitted cells participate in declared sparse state previews and exact readback', async () => {
  const c = seed();
  c.states = ['hover'];
  c.bindings.figma.statePreviews = true;
  c.anatomy.root.states = { hover: { 'background-color': '{red}' } };
  const data = compile(c);
  assert.equal(data.variants.length, 5);
  assert.equal(data.stateVariants?.length, 5);
  assert.equal(data.stateVariants?.[0].name, 'Variant=(unset), State=Hover');
  assert.equal(data.stateVariants?.[0].spec.fill, 'red');
  const { set } = await roundTrip(c);
  const back = ContractSchema.parse(propose(set).contract);
  assert.equal(Object.hasOwn(back.props.find(p => p.name === 'variant')!, 'default'), false);
  const again = compile(back);
  assert.deepEqual([...again.variants, ...(again.stateVariants ?? [])].map(v => v.name), [...data.variants, ...(data.stateVariants ?? [])].map(v => v.name));
});

test('literal minting lowers its omitted placeholder to base plus public-value maps', async () => {
  const c = seed();
  delete c.anatomy.root.tokens;
  delete c.anatomy.root.tokensByProp;
  c.anatomy.root.literals = { 'background-color': '#0055ff' };
  c.anatomy.root.literalsByProp = [{ prop: 'variant', map: {
    secondary: { 'background-color': '#889999' }, tertiary: { 'background-color': '#ee0011' },
    bare: { 'background-color': '#889999' }, danger: { 'background-color': '#ee0011' },
  } }];
  const { set } = await roundTrip(c);
  const result = propose(set, true);
  const back = ContractSchema.parse(result.contract);
  assert.equal(Object.hasOwn(back.props[0], 'default'), false);
  assert.equal(JSON.stringify(back.anatomy).includes('{variant}'), false);
  const replayEngine = createFigmaEngine({ tokens: { ...tokens, semantic: result.mintedTokens?.tree ?? {} }, icons: new Map() });
  const replay = replayEngine.compileComponentData(back, new Map([[back.id, back]]));
  assert.equal(replay.variants.length, 5);
  const colors = [undefined, 'secondary', 'tertiary', 'bare', 'danger'].map(variant => {
    const subst: Record<string, string> = variant === undefined ? {} : { variant };
    const literal = resolveLiterals(back.anatomy.root, subst)['background-color'];
    const ref = resolveTokens(back.anatomy.root, subst)['background-color'];
    return literal ?? replayEngine.resolveTokenLiteral(ref.slice(1, -1));
  });
  assert.deepEqual(colors, ['#0055ff', '#889999', '#ee0011', '#889999', '#ee0011']);
});

test('untrusted, stale, colliding or incompletely corroborated metadata refuses; absence never infers omission', async () => {
  const { set } = await roundTrip(seed());
  for (const raw of [null, '', '{broken', {}, { version: 2, axes: [] }, { version: 1, axes: [] }]) refusal(() => propose({ ...set, unsetVariantAxes: raw }));
  for (const mutate of [
    (s: DumpSet) => { (s.unsetVariantAxes as any).axes.push((s.unsetVariantAxes as any).axes[0]); },
    (s: DumpSet) => { (s.unsetVariantAxes as any).axes[0].unsetValue = 'Secondary'; },
    (s: DumpSet) => { (s.unsetVariantAxes as any).axes[0].values[0].label = 'Other'; },
    (s: DumpSet) => { (s.unsetVariantAxes as any).axes[0].propName = 'invented'; },
    (s: DumpSet) => { (s.unsetVariantAxes as any).axes[0].codeProp = 'not-an-identifier'; },
    (s: DumpSet) => { s.propertyDefinitions!.Variant.defaultValue = 'Secondary'; },
    (s: DumpSet) => { s.variants[0].name = 'Variant=Secondary'; },
    (s: DumpSet) => { delete s.propNames; },
  ]) { const bad = structuredClone(set); mutate(bad); refusal(() => propose(bad)); }
  const absent = structuredClone(set); delete absent.unsetVariantAxes;
  const p = ContractSchema.parse(propose(absent).contract).props[0];
  assert.equal(p.default, 'unset');
  assert.equal(p.bindings.figma.unsetValue, undefined);
});

test('public code value identity survives design label canonicalization', async () => {
  const c = seed();
  c.props[0] = PropSchema.parse({ name: 'variant', type: { enum: ['secondary-emphasis'] }, bindings: { code: { prop: 'appearance' }, figma: { kind: 'VARIANT', property: 'Variant', values: { 'secondary-emphasis': 'Secondary' }, unsetValue: '(unset)' } } });
  c.anatomy.root.tokensByProp = [{ prop: 'variant', map: { 'secondary-emphasis': { 'background-color': '{gray}' } } }];
  const { set } = await roundTrip(c);
  const back = ContractSchema.parse(propose(set).contract);
  assert.deepEqual(back.props[0].type, { enum: ['secondary-emphasis'] });
  assert.equal(back.props[0].bindings.code.prop, 'appearance');
  assert.equal(resolveTokens(back.anatomy.root, { variant: 'secondary-emphasis' })['background-color'], '{gray}');
  const ctx = { contracts: new Map([[back.id, back]]), icons: new Map<string, string>() };
  assert.deepEqual(generatedTypeErrors(back.name, emitReact(back, { ...ctx, tokens: tokenInventoryFromJson([primitives]) }).tsx), []);
  assert.deepEqual(generatedTypeErrors(back.name, emitReactInline(back, { ...ctx, tokens }).tsx), []);
});

test('native omission aliases cannot replace public slots or become reserved JavaScript bindings', async () => {
  const c = seed();
  c.semantics = { element: 'div' };
  c.anatomy.root = { layout: { display: 'flex' }, parts: {
    body: { slot: { name: 'appearance' }, layout: { display: 'flex' } },
    actions: { slot: { name: 'actions' }, layout: { display: 'flex' } },
  } };
  const native = await roundTrip(c);
  const baseline = ContractSchema.parse(propose(native.set).contract);
  assert.deepEqual(walkAnatomy(baseline).flatMap(w => w.part.slot ? [w.part.slot.name] : []), ['children', 'actions']);
  for (const alias of ['actions', 'children', 'class', 'ref', 'rest', 'classes', 'styles', 'style', 'className']) {
    const stamp = structuredClone(native.set.unsetVariantAxes) as { axes: Array<{ codeProp: string }> };
    stamp.axes[0].codeProp = alias;
    native.node.setSharedPluginData('ds_contracts', 'unsetVariantAxes', JSON.stringify(stamp));
    const dump = await native.dump();
    refusal(() => propose(dump), alias === 'actions' ? 'FIGMA_UNSET_PROJECTION_UNSUPPORTED' : 'FIGMA_UNSET_METADATA_INVALID');
  }
});

test('omitted binding aliases collide with slots and declared events at source and returned-contract boundaries', () => {
  for (const alias of ['children', 'actions', 'onActivate', 'handleActivate']) {
    const c = seed(); c.props[0].bindings.code.prop = alias;
    if (alias === 'onActivate' || alias === 'handleActivate') c.events = [{ name: 'activate', trigger: 'root', bindings: { code: { prop: 'onActivate' } } }];
    else c.anatomy.root.parts = { nested: { layout: { display: 'flex' }, parts: { content: { slot: { name: alias } } } } };
    assert.equal(ContractSchema.safeParse(c).success, false, `${alias} schema collision`);
    assert.throws(() => compile(c), /collision|collides/i, `${alias} direct compiler collision`);
    const axes = [{ property: 'Variant', propName: 'variant', codeProp: alias, unsetValue: '(unset)', internalValue: 'unset', values: [{ value: 'secondary', label: 'Secondary' }] }];
    refusal(() => lowerUnsetProposal(c as unknown as Record<string, unknown>, axes), 'FIGMA_UNSET_PROJECTION_UNSUPPORTED');
  }
});

test('reserved generator names are grounded in errors from actual generated TypeScript, not spelling heuristics', () => {
  for (const alias of ['class', 'ref', 'rest', 'classes', 'styles', 'style', 'className', 'children']) {
    const c = seed();
    // The old, non-opt-in path is deliberately retained as a negative control:
    // it can emit unsupported bindings that the new boundary must refuse.
    delete c.props[0].bindings.figma.unsetValue;
    c.props[0].bindings.code.prop = alias;
    const ctx = { contracts: new Map([[c.id, c]]), icons: new Map<string, string>() };
    const moduleErrors = generatedTypeErrors(c.name, emitReact(c, { ...ctx, tokens: tokenInventoryFromJson([primitives]) }).tsx);
    const inlineErrors = generatedTypeErrors(c.name, emitReactInline(c, { ...ctx, tokens }).tsx);
    assert.ok(moduleErrors.length + inlineErrors.length > 0, `${alias} is unsupported by at least one required emitter`);
  }
});

test('reordered native rows retain declared omitted layout base and public overrides', async () => {
  const c = seed();
  c.anatomy.root.layout = { display: 'flex', direction: 'row' };
  c.anatomy.root.layoutByProp = { prop: 'variant', map: Object.fromEntries(['secondary', 'tertiary', 'bare', 'danger'].map(v => [v, { direction: 'column' as const }])) };
  const { set } = await roundTrip(c);
  set.variants.reverse();
  const before = JSON.stringify(set);
  const back = ContractSchema.parse(propose(set).contract);
  assert.equal(resolveLayout(back.anatomy.root, {})?.direction, 'row');
  for (const variant of ['secondary', 'tertiary', 'bare', 'danger']) assert.equal(resolveLayout(back.anatomy.root, { variant })?.direction, 'column');
  assert.equal(JSON.stringify(set), before, 'readback did not mutate observations');
});

test('partial-map rebasing preserves the prior public fallback or refuses an unrepresented fallback', () => {
  const axes = [{ property: 'Variant', propName: 'variant', codeProp: 'variant', unsetValue: '(unset)', internalValue: 'unset', values: [{ value: 'secondary', label: 'Secondary' }] }];
  refusal(() => lowerUnsetProposal({ props: [{ bindings: { code: { prop: 'variant' } } }, { bindings: { code: { prop: 'variant' } } }], anatomy: {} }, axes), 'FIGMA_UNSET_PROJECTION_UNSUPPORTED');
  const c = { anatomy: { root: { layout: { display: 'flex', direction: 'column' }, layoutByProp: { prop: 'variant', map: { unset: { direction: 'row' } } } } } };
  lowerUnsetProposal(c, axes);
  assert.equal(c.anatomy.root.layout.direction, 'row');
  assert.deepEqual(c.anatomy.root.layoutByProp.map, { secondary: { direction: 'column' } });
  refusal(() => lowerUnsetProposal({ anatomy: { root: { layoutByProp: { prop: 'variant', map: { unset: { direction: 'row' } } } } } }, axes), 'FIGMA_UNSET_PROJECTION_UNSUPPORTED');
});

test('unsupported omitted selectors and interacting placeholders refuse instead of inventing public values', () => {
  const axes = [{ property: 'Variant', propName: 'variant', codeProp: 'variant', unsetValue: '(unset)', internalValue: 'unset', values: [{ value: 'secondary', label: 'Secondary' }] }];
  for (const part of [
    { visibleWhen: { prop: 'variant', equals: 'unset' } },
    { component: { props: { child: { prop: 'variant', map: { unset: 'x', secondary: 'y' } } } } },
  ]) refusal(() => lowerUnsetProposal({ anatomy: { root: part } }, axes), 'FIGMA_UNSET_PROJECTION_UNSUPPORTED');
  const two = [...axes, { ...axes[0], property: 'Size', propName: 'size' }];
  refusal(() => lowerUnsetProposal({ anatomy: { root: { tokens: { color: '{color.{variant}.{size}}' } } } }, two), 'FIGMA_UNSET_PROJECTION_UNSUPPORTED');
});

test('REST ingestion preserves malformed omission stamp for refusal', () => {
  const response = { nodes: { '1:1': { document: { id: '1:1', name: 'Broken', type: 'COMPONENT_SET', sharedPluginData: { ds_contracts: { unsetVariantAxes: '{broken' } }, children: [] } } } };
  const mapped = mapRestToDump(response as Parameters<typeof mapRestToDump>[0]);
  assert.equal((mapped.dump.Broken as DumpSet).unsetVariantAxes, '{broken');
});

// Recorded REAL Figma, unlike roundTrip() above (which executes a mock).
// These bytes were captured from Scratch using engine 3158bee5. Replaying
// them offline does not refresh that observation or qualify Altitude/the app.
const nativeFixture = new URL('./fixtures/figma-omission-native-20260915/', import.meta.url);
const recordedText = (name: string): string => readFileSync(new URL(name, nativeFixture), 'utf8');
const recordedJson = (name: string) => JSON.parse(recordedText(name));
const sha256 = (raw: string): string => createHash('sha256').update(raw).digest('hex');

test('recorded real-Figma synthetic omission: identity, public API, five native rows and 144×40 literal paints survive exact replay', () => {
  const provenance = recordedJson('provenance.json');
  const source = ContractSchema.parse(recordedJson('contract.json'));
  const nativeDump = recordedJson('native-dump.json');
  const observed = nativeDump[source.name] as DumpSet;
  const before = JSON.stringify(nativeDump);
  const mint = JSON.parse(recordedJson('native-mint.json').content[0].text);
  const repeat = JSON.parse(recordedJson('native-repeat.json').content[0].text);
  assert.equal(provenance.engineCommit, '3158bee500dc74e6b86fcd81d38e0f68ab474277');
  assert.equal(provenance.measuredAt, '2026-09-15T15:15:27.358Z'); // analysis time, not mint time
  assert.equal(mint.timestamp, provenance.nativeMintTimestamp);
  assert.ok(Date.parse(provenance.measuredAt) > mint.timestamp);
  for (const [name, digest] of Object.entries(provenance.byteExactCopies)) assert.equal(sha256(recordedText(name)), digest, `${name} preserves captured bytes`);
  assert.equal(provenance.recordedRepeatDumpSha256, sha256(recordedText('native-dump.json')), 'recorded repeat canonical dump matched the first dump; this is not a new repeat execution');
  assert.equal(mint.success, true, 'captured transport result, not an owner grade');
  assert.equal(repeat.success, true);
  assert.equal(mint.fileContext.fileName, 'Scratch Project');
  assert.equal(mint.fileContext.fileKey, 'byMp6lt0Ij9b2QbkDGFwBh');
  assert.equal(nativeDump._provenance.fileKey, mint.fileContext.fileKey);
  assert.equal(source.bindings.figma.anchors.fileKey, mint.fileContext.fileKey);
  assert.equal(provenance.fileKey, mint.fileContext.fileKey);
  const identity = mint.result.results.find((row: { contractId: string }) => row.contractId === source.id);
  assert.ok(identity);
  assert.equal(identity.nodeId, '299:4052');
  assert.equal(identity.key, 'ff8ad63a320e01b2f00970afc0893b7f8b6e14e6');
  assert.equal(observed.contractId, source.id);
  assert.equal(observed.nodeId, identity.nodeId);
  assert.equal(observed.key, identity.key);
  assert.equal(provenance.contractNodeId, identity.nodeId);
  assert.equal(provenance.contractKey, identity.key);
  assert.deepEqual(mint.result.createdNodeIds, [identity.nodeId]);
  assert.deepEqual(repeat.result.createdNodeIds, []);
  assert.equal(repeat.result.results[0].nodeId, identity.nodeId);
  assert.equal(repeat.result.results[0].key, identity.key);
  assert.equal(repeat.result.results[0].skipped, true);
  assert.equal(repeat.result.results[0].reason, 'unchanged');
  assert.deepEqual(observed.semantics, source.semantics);
  assert.deepEqual(nativeDump._variables, {}, 'literal-color fixture has no original token bindings');
  assert.deepEqual(nativeDump._degradations, []);
  const publicValues = ['secondary', 'tertiary', 'bare', 'danger'];
  const nativeOptions = ['(unset)', 'Secondary', 'Tertiary', 'Bare', 'Danger'];
  assert.equal(observed.variants.length, 5);
  assert.deepEqual(observed.propertyDefinitions?.Variant, { type: 'VARIANT', defaultValue: '(unset)', variantOptions: nativeOptions });
  assert.deepEqual(observed.variants.map(v => v.variantProperties?.Variant), nativeOptions);

  const result = proposeFromDump(observed, {
    corpus: tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} }),
    contractIdByName: new Map(), fileKey: nativeDump._provenance.fileKey,
    projectionMode: 'exact', mintUnbound: true,
  });
  assert.equal(result.projection.status, 'verified-exact');
  assert.equal(result.projection.expectedCount, 5);
  assert.equal(result.projection.observedCount, 5);
  const back = ContractSchema.parse(result.contract);
  assert.equal(back.id, source.id);
  assert.equal(back.version, source.version);
  assert.deepEqual(back.semantics, source.semantics);
  assert.deepEqual(back.bindings.figma.anchors, { fileKey: provenance.fileKey, componentSetKey: identity.key, nodeId: identity.nodeId });
  const p = back.props.find(p => p.name === 'variant');
  assert.ok(p);
  assert.deepEqual(p.type, { enum: publicValues });
  assert.equal(Object.hasOwn(p, 'default'), false);
  assert.equal(p.bindings.code.prop, 'appearance');
  assert.equal(p.bindings.figma.unsetValue, '(unset)');
  assert.deepEqual(p.bindings, source.props[0].bindings);
  const replayEngine = createFigmaEngine({
    tokens: { primitives: {}, semantic: result.mintedTokens?.tree ?? {}, light: {}, dark: {}, brands: { default: {} } },
    icons: new Map(),
  });
  const compiled = replayEngine.compileComponentData(back, new Map([[back.id, back]]));
  assert.deepEqual(compiled.variants.map(v => v.name), observed.variants.map(v => v.name));
  const paints = ['#0055ff', '#889999', '#ee0011', '#889999', '#ee0011'];
  for (const [i, variant] of [undefined, ...publicValues].entries()) {
    const subst: Record<string, string> = variant === undefined ? {} : { variant };
    const valueAt = (channel: string) => {
      const literal = resolveLiterals(back.anatomy.root, subst)[channel];
      const ref = resolveTokens(back.anatomy.root, subst)[channel];
      return literal ?? replayEngine.resolveTokenLiteral(ref.slice(1, -1));
    };
    assert.deepEqual(observed.variants[i].bbox, { width: 144, height: 40 });
    assert.equal(valueAt('width'), '144px');
    assert.equal(valueAt('height'), '40px');
    assert.equal(`#${observed.variants[i].fill?.hex}`, paints[i]);
    assert.equal(valueAt('background-color'), paints[i]);
    assert.equal(resolveLiterals(source.anatomy.root, subst)['background-color'], paints[i]);
  }
  assert.equal(JSON.stringify(nativeDump), before, 'proposal must not rewrite captured native evidence');
});

test('recorded real-Figma replay rejects corrupted default/alias copies without mutating the fixture', () => {
  const source = ContractSchema.parse(recordedJson('contract.json'));
  const original = recordedJson('native-dump.json');
  const observed = original[source.name] as DumpSet;
  const originalBytes = recordedText('native-dump.json');
  const alteredDefault = structuredClone(observed);
  alteredDefault.propertyDefinitions!.Variant.defaultValue = 'Secondary';
  refusal(() => propose(alteredDefault));
  const alteredAlias = structuredClone(observed);
  (alteredAlias.unsetVariantAxes as { axes: Array<{ codeProp: string }> }).axes[0].codeProp = 'class';
  refusal(() => propose(alteredAlias));
  assert.deepEqual(observed, recordedJson('native-dump.json')[source.name]);
  assert.equal(recordedText('native-dump.json'), originalBytes);
});
