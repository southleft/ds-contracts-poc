import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { ContractSchema } from '../scripts/contract-schema.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { emitReactInline } from './emit-react-inline.js';
import { validateContract } from '../packages/core/src/validate.js';
import { proposeFromDump, proposeBatchFromDump } from './propose-figma.js';
import { prepareNativeContractComparison } from './native-contract-comparison.js';
import { capturedTokensFromDump } from './captured-tokens.js';
import { tokenCorpusFromJson } from './token-corpus.js';
import type { DumpSet } from '../extract/figma/types.js';
import { nativeFixtureHost } from '../source-reference/native-operation-test-fixture.js';
import { planNativeRootTextTemplate, expandRootTextTemplateTokenContext } from './native-root-text-template-plan.js';
import { revisionOf } from './contract-provenance.js';
import { flattenTokens } from './tokens.js';
import { emitNativeTokenContextScript, emitNativeTokenContextReadbackScript } from './token-set.js';
import type { NativeTokenContextInput } from './native-token-context.js';
import { emitNativeContractReadbackScript, verifyNativeContractReadback, type NativeContractObservationInput } from './native-source-observation.js';
import { emitNativeContractComparisonReadbackScript, verifyNativeContractComparisonReadback, type NativeContractComparisonObservationInput } from './native-contract-comparison-observation.js';
import { prepareNativeContractUpdate } from './native-contract-update.js';
import { prepareNativeComparisonRecovery } from './native-comparison-recovery.js';
import { prepareNativeComparisonRepair } from './native-comparison-repair.js';
import { prepareNativeComparisonMigrationRepair } from './native-comparison-migration-repair.js';

import { nativeTextBindings } from './native-text-template-test-fixture.js';

const primitives = {
  ink: { $type: 'color', $value: '#b21926' },
  size: { small: { $type: 'dimension', $value: '12px' }, large: { $type: 'dimension', $value: '20px' } },
  line: { small: { $type: 'dimension', $value: '18px' }, large: { $type: 'dimension', $value: '28px' } },
  weight: { $type: 'fontWeight', $value: 400 },
};
const tokens = { primitives, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
const seed = () => ContractSchema.parse({ id: 'test.slot-text-template', name: 'SlotTextTemplate', description: 'Reusable empty text slot fixture', version: '0.1.0', status: 'draft',
  props: [{ name: 'size', type: { enum: ['small', 'large'] }, default: 'small',
    bindings: { code: { prop: 'size' }, figma: { kind: 'VARIANT', property: 'Size', values: { small: 'Small', large: 'Large' } } } }],
  states: [], semantics: { element: 'span' }, anatomy: { root: {
    slot: { name: 'children', bindings: { figma: { textTemplate: true } } },
    layout: { display: 'inline-flex', direction: 'row', align: 'center' },
    tokens: { color: '{ink}', 'font-size': '{size.{size}}', 'line-height': '{line.{size}}', 'font-weight': '{weight}' },
    declared: { 'font-family': 'Inter' }, literals: { width: 'fit-content', height: 'fit-content', 'padding-inline': '8px', 'padding-block': '4px' },
  } }, bindings: { code: { anchors: { importPath: 'test/SlotTextTemplate', export: 'SlotTextTemplate' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } },
});

test('explicit root template carries typography without adding React content', () => {
  const c = seed(), engine = createFigmaEngine({ tokens, icons: new Map() });
  const data = engine.compileComponentData(c, new Map([[c.id, c]]));
  assert.deepEqual(data.rootSlot, { version: 1, property: 'Children', display: 'inline-flex', textTemplate: 1 });
  assert.deepEqual(data.variants.map(v => {
    const text = v.spec.children![0].children![0];
    return { type: text.type, template: text.slotTextTemplate, text: text.characters, size: text.fontSize, line: text.lineHeight,
      sizeVar: text.fontSizeVar, lineVar: text.lineHeightVar, fill: text.textFill };
  }), ['small', 'large'].map((size, i) => ({ type: 'text', template: true, text: '', size: i ? 20 : 12, line: { unit: 'PIXELS', value: i ? 28 : 18 },
    sizeVar: `size/${size}`, lineVar: `line/${size}`, fill: 'ink' })));
  const plain = structuredClone(c); delete plain.anatomy.root.slot!.bindings;
  const render = (contract: typeof c) => emitReactInline(contract, { tokens, icons: new Map(), contracts: new Map([[contract.id, contract]]) }).tsx;
  assert.equal(render(c), render(plain));
  assert.equal(engine.compileComponentData(plain, new Map([[plain.id, plain]])).variants[0].spec.children![0].children, undefined);
});

test('template compiler rejects incompatible slots and incomplete typography', () => {
  const engine = createFigmaEngine({ tokens, icons: new Map() });
  for (const change of [
    (c: ReturnType<typeof seed>) => { c.anatomy.root.slot!.required = true; },
    (c: ReturnType<typeof seed>) => { c.anatomy.root.slot!.max = 1; },
    (c: ReturnType<typeof seed>) => { delete c.anatomy.root.declared; },
    (c: ReturnType<typeof seed>) => { delete c.anatomy.root.tokens!['line-height']; },
  ]) {
    const c = seed(); change(c);
    assert.throws(() => engine.compileComponentData(c, new Map([[c.id, c]])), /FIGMA_SLOT_TEXT_TEMPLATE_/);
  }
  const constrained = seed(); constrained.anatomy.root.slot!.required = true;
  const errors: string[] = [];
  validateContract(constrained, new Map([[constrained.id, constrained]]), errors, new Map());
  assert.ok(errors.some(e => e.includes('FIGMA_SLOT_TEXT_TEMPLATE_')));
});

async function scopedTemplateFixture(tracking = 0) {
  const { figma } = nativeFixtureHost({ modeLimit: 2, consumerVariableModes: true }); nativeTextBindings(figma);
  Object.getPrototypeOf(figma.currentPage).setExplicitVariableModeForCollection = function(c: any, mode: string) {
    this.explicitVariableModes = { ...this.explicitVariableModes, [c.id]: mode };
  };
  const c = seed(), engine = createFigmaEngine({ tokens, icons: new Map() });
  if (tracking) c.anatomy.root.literals!['letter-spacing'] = tracking + 'px';
  const run = async (code: string) => JSON.parse(JSON.stringify(await vm.runInNewContext(`(async()=>{${code}\n})()`, { figma, console }, { timeout: 5000 })));
  const operation = { id: '10000000-0000-4000-8000-000000000003', fileKey: figma.fileKey };
  const source = { revision: revisionOf('template source'), programSha256: 'b'.repeat(64), evidenceRevision: revisionOf('template source evidence') };
  const baseTokenInput: NativeTokenContextInput = { fileKey: operation.fileKey, scopeId: 'source-' + operation.id,
    source: { revision: source.revision, sourceProgramSha256: source.programSha256, tokensSha256: revisionOf(primitives).slice(7) },
    tokenPaths: [...flattenTokens(primitives).keys()].sort(), modes: [{ sourceMode: 'light', brand: 'default', nativeModeName: 'Light', tokens: primitives, tokenTreeRevision: revisionOf(primitives) }] };
  const byId = new Map([[c.id, c]]), compiled = engine.compileNativeContractDraft(c, byId, source);
  const tokenInput = expandRootTextTemplateTokenContext(baseTokenInput, compiled.projection.rootTextTemplate!);
  const createdTokens = await run(emitNativeTokenContextScript(tokenInput).script);
  assert.equal(createdTokens.status, 'created-candidate');
  const tokenRead = await run(emitNativeTokenContextReadbackScript(tokenInput, createdTokens.creationIdentity));
  const context = { operation, tokens: { input: tokenInput, identity: createdTokens.creationIdentity, receipt: tokenRead.receipt } };
  const creation = await run(engine.buildNativeContractDraftScript(c, byId, source, context));
  assert.equal(creation.status, 'created-candidate', JSON.stringify(creation));
  const input: NativeContractObservationInput = { operation, planRevision: revisionOf('template plan'),
    projection: compiled.projection, component: compiled.component, tokenInput, tokenIdentity: context.tokens.identity, creation };
  return { c, engine, figma, run, source, compiled, context, input, creation, byId };
}

test('unscoped writers refuse templates before allocating; scoped reruns retain the existing operation', async () => {
  const { c, engine, figma, run, source, byId, context, creation } = await scopedTemplateFixture();
  assert.throws(() => engine.buildComponentScript(c, byId), /FIGMA_SLOT_TEXT_TEMPLATE_REQUIRES_SCOPED_MODES/);
  const compiled = engine.compileComponentData(c, byId);
  assert.throws(() => engine.buildBatchScript([compiled], figma.fileKey), /FIGMA_SLOT_TEXT_TEMPLATE_REQUIRES_SCOPED_MODES/);
  const set = await figma.getNodeByIdAsync(creation.target.id);
  const rows = () => set.children.map((main: any) => {
    const slot = main.children[0], text = slot.children[0];
    return { main: main.id, slot: slot.id, text: text.id, visible: text.visible, characters: text.characters,
      width: slot.width, height: slot.height, lineBinding: text.boundVariables.lineHeight };
  });
  const before = rows();
  assert.ok(before.length === 2 && before.every((r: any) => r.visible === false && r.characters === '' && r.width === 0 && r.height === 0 && r.lineBinding));
  const repeated = await run(engine.buildNativeContractDraftScript(c, byId, source, context));
  assert.equal(repeated.status, 'refused', JSON.stringify(repeated));
  assert.equal(repeated.allocationAttempted, false);
  assert.deepEqual(rows(), before);
});

test('canonical capture restores reusable root typography and refuses unsupported consuming evidence', async () => {
  const { c, run } = await scopedTemplateFixture();
  const set = { name: c.name };
  const source = readFileSync(new URL('../extract/figma/dump.plugin.js', import.meta.url), 'utf8')
    .replace(/^const TARGET_SETS = \[[^\n]*\];$/m, `const TARGET_SETS = ${JSON.stringify([set.name])};`);
  const dump = JSON.parse(JSON.stringify(await run(source))), captured = dump[set.name] as DumpSet;
  const capturedLayer = capturedTokensFromDump(dump)!;
  assert.equal(capturedLayer.entries.find(e => e.path === 'weight')?.value, '400');
  assert.equal(capturedLayer.entries.find(e => e.path === 'weight')?.type, 'number');
  const opts = { corpus: tokenCorpusFromJson({ primitives: capturedLayer.tree, semantic: {}, light: {}, brandDefault: {} }),
    contractIdByName: new Map<string, string>(), mintUnbound: true };
  const batch = proposeBatchFromDump(dump, opts);
  assert.deepEqual(batch.skipped, [], JSON.stringify(captured.variants[0].children?.[0].children?.[0]));
  assert.equal(batch.proposals.length, 1);
  const returned = ContractSchema.parse(batch.proposals[0].contract);
  assert.deepEqual(returned.anatomy.root.slot, c.anatomy.root.slot);
  assert.equal(returned.anatomy.root.text, undefined); assert.equal(returned.anatomy.root.parts, undefined);
  for (const key of ['color','font-size','line-height','font-weight']) assert.equal(returned.anatomy.root.tokens?.[key], c.anatomy.root.tokens?.[key]);
  assert.equal(returned.anatomy.root.declared?.['font-family'], 'Inter');
  const original = structuredClone(captured);
  for (const mutate of [
    (d: any) => { d.rootSlot.textTemplate = 2; },
    (d: any) => { d.variants[0].children[0].children[0].hidden = false; },
    (d: any) => { d.variants[0].children[0].children[0].text.characters = 'Invented default'; },
    (d: any) => { d.variants[0].children[0].children[0].text.style = 'Other owner'; },
    (d: any) => { d.variants[0].children[0].children[0].text.lineHeight = 99; },
    (d: any) => { d.variants[0].children[0].children[0].text.fontStyle = 'Bold'; },
    (d: any) => { d.variants[0].children[0].children[0].text.fontWeight = 700; },
    (d: any) => { delete d.variants[0].children[0].children[0].text.fontWeight; },
    (d: any) => { delete d.variants[0].children[0].children[0].variableConsumers; },
    (d: any) => { Object.values<any>(d.variants[0].children[0].children[0].variableConsumers)[0].selectedValue = { type:'VARIABLE_ALIAS',id:'unproven' }; },
    (d: any) => { Object.values<any>(d.variants[1].children[0].children[0].variableConsumers).forEach(v => { v.modeId = 'other'; }); },
    (d: any) => { d.variants[0].children[0].children[0].opacity = 0.5; },
    (d: any) => { d.variants[1].children[0].children[0].text.fontFamily = 'Other'; },
  ]) {
    const altered = structuredClone(captured); mutate(altered);
    assert.throws(() => proposeFromDump(altered, opts), /FIGMA_(ROOT_SLOT|SLOT_TEXT_TEMPLATE)_/);
  }
  assert.deepEqual(captured, original);
  const ambiguous = structuredClone(dump);
  ambiguous[set.name].variants[0].children[0].children[0].text.fontSizeVar = 'weight';
  assert.equal(proposeBatchFromDump(ambiguous, opts).proposals.length, 0);
  const degraded = structuredClone(dump);
  degraded._degradations = [{ code: 'text-channel-unsupported', nodePath: set.name + ':Size=Small/Children/Content text template', message: 'Uncarried text decoration' }];
  assert.equal(proposeBatchFromDump(degraded, opts).proposals.length, 0);
});

test('independent native draft readback requires template typography, bindings, visibility and empty geometry', async () => {
  const { c, engine, run, source, compiled, input } = await scopedTemplateFixture();
  const receipt = await run(emitNativeContractReadbackScript(input));
  assert.equal(verifyNativeContractReadback(input, receipt).status, 'supported-structure-observed', JSON.stringify(verifyNativeContractReadback(input, receipt)));
  const captureProgram = readFileSync(new URL('../extract/figma/dump.plugin.js', import.meta.url), 'utf8')
    .replace(/^const TARGET_SETS = \[[^\n]*\];$/m, `const TARGET_SETS = ${JSON.stringify([c.name])};`);
  const dump = await run(captureProgram), originalDump = structuredClone(dump);
  const layer = capturedTokensFromDump(dump)!;
  assert.deepEqual(layer.skipped, []);
  assert.equal(layer.entries.some(e => e.path.startsWith('dsc-native-template.')), false);
  const batch = proposeBatchFromDump(dump, { corpus: tokenCorpusFromJson({ primitives: layer.tree, semantic: {}, light: {}, brandDefault: {} }),
    contractIdByName: new Map<string, string>(), mintUnbound: true });
  assert.deepEqual(batch.skipped, []);
  const returned = ContractSchema.parse(batch.proposals[0].contract);
  for (const key of ['color','font-size','line-height','font-weight'])
    assert.equal(returned.anatomy.root.tokens?.[key], c.anatomy.root.tokens?.[key]);
  assert.deepEqual(dump, originalDump, 'inversion must not rewrite the captured evidence');
  const content = structuredClone(c); content.id = 'test.template-caller'; content.props = [];
  delete content.anatomy.root.slot;
  content.anatomy.root.tokens!['font-size'] = '{size.small}';
  content.anatomy.root.tokens!['line-height'] = '{line.small}';
  content.anatomy.root.parts = { label: { text: 'Editable caller text' } };
  const caller = engine.compileComponentData(content, new Map([[content.id, content]]));
  assert.throws(() => prepareNativeContractComparison(content, caller, source, revisionOf(primitives),
    { mode: 'light', brand: 'default' }, { parent: input, receipt, caseId: 'caller',
      variantName: compiled.component.variants[0].name, slotSpecPath: [0] }),
    /text-template-caller-mode-projection-required/);

  for (const mutate of [
    (r: any) => { r.nodes.find((n: any) => n.type === 'TEXT').values.visible = true; },
    (r: any) => { r.nodes.find((n: any) => n.type === 'TEXT').values.characters = 'not empty'; },
    (r: any) => { r.nodes.find((n: any) => n.type === 'TEXT').values.boundVariables.lineHeight = []; },
    (r: any) => { r.nodes.find((n: any) => n.type === 'TEXT').values.boundVariables.fontWeight = []; },
    (r: any) => { r.nodes.find((n: any) => n.type === 'TEXT').values.fontWeight = 700; },
    (r: any) => { r.nodes.find((n: any) => n.type === 'TEXT').values.textAutoResize = 'NONE'; },
    (r: any) => { r.nodes.find((n: any) => n.type === 'TEXT').values.letterSpacing = { unit: 'PIXELS', value: 1 }; },
    (r: any) => { r.nodes.find((n: any) => n.type === 'SLOT').values.width = 1; },
    (r: any) => { r.nodes.find((n: any) => n.type === 'TEXT').values.explicitVariableModes = { [input.tokenIdentity.collection.id]: input.tokenIdentity.modes[0].modeId }; },
    (r: any) => { r.nodes.find((n: any) => n.type === 'TEXT').values.resolvedVariableModes = {}; },
  ]) {
    const changed = structuredClone(receipt); mutate(changed);
    assert.notEqual(verifyNativeContractReadback(input, changed).status, 'supported-structure-observed');
  }
});


test('direct caller text uses the observed template bindings and selected main mode', async () => {
  const f = await scopedTemplateFixture(0.25), { c, engine, run, source, compiled, input } = f;
  const receipt = await run(emitNativeContractReadbackScript(input));
  const content = structuredClone(c); content.id = 'test.template-caller'; content.props = [];
  delete content.anatomy.root.slot;
  content.anatomy.root.tokens!['font-size'] = '{size.small}';
  content.anatomy.root.tokens!['line-height'] = '{line.small}';
  content.anatomy.root.parts = { label: { text: 'Editable caller text' } };
  const comparison = { parent: input, receipt, caseId: 'caller', variantName: compiled.component.variants[0].name, slotSpecPath: [0],
    rootText: { version: 1 as const, kind: 'direct-root-text' as const, characters: 'Editable caller text',
      contractRevision: revisionOf(content), treeRevision: revisionOf('authenticated direct text fixture') } };
  const caller = engine.compileComponentData(content, new Map([[content.id, content]]));
  const prepared = prepareNativeContractComparison(content, caller, source, revisionOf(primitives), { mode: 'light', brand: 'default' }, comparison, primitives);
  assert.ok(prepared.textTemplate);
  assert.notEqual(prepared.textTemplate.modeId, input.tokenIdentity.modes[0].modeId, 'the selected Small plane is not the first physical mode');
  for (const mutate of [
    (x: typeof comparison) => { x.rootText.treeRevision = 'unverified'; },
    (x: typeof comparison) => { x.rootText.contractRevision = revisionOf('different caller'); },
    (x: typeof comparison) => { x.rootText.characters = 'Substitution'; },
    (x: typeof comparison) => { x.variantName = 'Size=Large'; },
  ]) {
    const changed = structuredClone(comparison); mutate(changed);
    assert.throws(() => prepareNativeContractComparison(content, caller, source, revisionOf(primitives),
      { mode: 'light', brand: 'default' }, changed, primitives), /text-template-/);
  }
  for (const mutate of [
    (x: typeof caller) => { x.variants[0].spec.children![0].letterSpacing = 1; },
    (x: typeof caller) => { x.variants[0].spec.children![0].fontSizeVar = 'size/large'; },
    (x: typeof caller) => { delete x.variants[0].spec.children![0].fontWeightVar; },
    (x: typeof caller) => { x.variants[0].spec.children![0].children = []; },
    (x: typeof caller) => { Object.assign(x.variants[0].spec.children![0], { textBox: { width: 100, height: 20 } }); },
  ]) {
    const changed = structuredClone(caller); mutate(changed);
    assert.throws(() => prepareNativeContractComparison(content, changed, source, revisionOf(primitives),
      { mode: 'light', brand: 'default' }, comparison, primitives), /text-template-/);
  }
  const operation = { id: '10000000-0000-4000-8000-000000000004', fileKey: input.operation.fileKey };
  const tokenInput: NativeTokenContextInput = { fileKey: operation.fileKey, scopeId: 'source-' + operation.id,
    source: { revision: source.revision, sourceProgramSha256: source.programSha256, tokensSha256: revisionOf(primitives).slice(7) },
    tokenPaths: [...flattenTokens(primitives).keys()].sort(), modes: [{ sourceMode: 'light', brand: 'default', nativeModeName: 'Caller', tokens: primitives, tokenTreeRevision: revisionOf(primitives) }] };
  const tokenCreated = await run(emitNativeTokenContextScript(tokenInput).script);
  const tokenRead = await run(emitNativeTokenContextReadbackScript(tokenInput, tokenCreated.creationIdentity));
  const context = { operation, tokens: { input: tokenInput, identity: tokenCreated.creationIdentity, receipt: tokenRead.receipt } };
  const creation = await run(engine.buildNativeContractComparisonScript(content, new Map([[content.id, content]]), source, context, comparison));
  assert.equal(creation.status, 'created-candidate', JSON.stringify(creation));
  const observedInput: NativeContractComparisonObservationInput = { operation, planRevision: revisionOf('caller plan'), comparison: prepared,
    tokenInput, tokenIdentity: tokenCreated.creationIdentity, creation };
  const observed = await run(emitNativeContractComparisonReadbackScript(observedInput));
  const verified = verifyNativeContractComparisonReadback(observedInput, observed);
  assert.equal(verified.problems.length, 0, JSON.stringify(verified));
  const desired = { component: input.component, tokenInput: input.tokenInput, revision: revisionOf(input.component) };
  assert.throws(() => prepareNativeContractUpdate({ before: input, baseline: receipt, desired }), /native-update-root-text-template-unqualified/);
  assert.throws(() => prepareNativeComparisonRecovery(observedInput, observed), /text-template-unqualified/);
  assert.throws(() => prepareNativeComparisonRepair(observedInput, observed), /text-template-unqualified/);
  assert.throws(() => prepareNativeComparisonMigrationRepair(observedInput, observed), /text-template-unqualified/);
  for (const mutate of [
    (n: any) => { n.values.fontWeight = 700; },
    (n: any) => { n.values.characters = 'Substitution'; },
    (n: any) => { n.values.textAutoResize = 'NONE'; },
    (n: any) => { n.values.letterSpacing = { unit: 'PIXELS', value: 1 }; },
    (n: any) => { n.values.resolvedVariableModes[input.tokenIdentity.collection.id] = input.tokenIdentity.modes[0].modeId; },
    (n: any) => { n.values.explicitVariableModes = { [input.tokenIdentity.collection.id]: prepared.textTemplate!.modeId }; },
    (n: any) => { n.values.boundVariables.fontWeight = [{ type: 'VARIABLE_ALIAS', id: 'other' }]; },
    (n: any) => { n.values.fills[0].boundVariables.color.id = 'other'; },
    (n: any) => { n.metadata.nativeContractPart = '{}'; },
  ]) {
    const changed = structuredClone(observed); mutate(changed.content.nodes.find((n: any) => n.type === 'TEXT'));
    assert.ok(verifyNativeContractComparisonReadback(observedInput, changed).problems.length);
  }
  const unchangedParent = await run(emitNativeContractReadbackScript(input));
  assert.deepEqual(unchangedParent, receipt, 'caller token allocation and text edits must leave its parent unchanged');
  const rerun = await run(engine.buildNativeContractComparisonScript(content, new Map([[content.id, content]]), source, context, comparison));
  assert.equal(rerun.status, 'refused'); assert.equal(rerun.allocationAttempted, false);
});

test('template mode planner preserves source identities and deduplicates only identical binding tuples', () => {
  const c = seed(), engine = createFigmaEngine({ tokens, icons: new Map() });
  const component = engine.compileComponentData(c, new Map([[c.id, c]]));
  const source = { contractRevision: revisionOf(c), tokenRevision: revisionOf(primitives) };
  const before = structuredClone(component), plan = planNativeRootTextTemplate(component, source)!;
  assert.equal(plan.modes.length, 2);
  assert.deepEqual(plan.modes.map(m => m.targets.fontSize).sort(), ['size/large', 'size/small']);
  assert.equal(new Set(Object.values(plan.aliases)).size, 4);
  const reversed = structuredClone(component); reversed.variants.reverse();
  assert.deepEqual(planNativeRootTextTemplate(reversed, source), plan, 'input order cannot change mode identity');
  const extra = structuredClone(component); extra.variants.push({ ...structuredClone(extra.variants[0]), name: 'Size=Other' });
  const dedup = planNativeRootTextTemplate(extra, source)!;
  assert.equal(dedup.modes.length, 2); assert.equal(dedup.variants.length, 3);
  extra.variants[2].spec.children![0].children![0].fontSizeVar = 'size/same-value-other-identity';
  assert.equal(planNativeRootTextTemplate(extra, source)!.modes.length, 3, 'same numeric value cannot erase a different source reference');
  assert.deepEqual(component, before);
  const plain = structuredClone(component); delete plain.rootSlot!.textTemplate;
  assert.equal(planNativeRootTextTemplate(plain, source), undefined);
});

test('template mode planner refuses unbound variant typography and ambiguous template ownership', () => {
  const c = seed(), engine = createFigmaEngine({ tokens, icons: new Map() });
  const component = engine.compileComponentData(c, new Map([[c.id, c]]));
  const source = { contractRevision: revisionOf(c), tokenRevision: revisionOf(primitives) };
  for (const alter of [
    (d: typeof component) => { d.variants[1].spec.children![0].children![0].letterSpacing = 1; },
    (d: typeof component) => { d.variants[1].spec.children![0].children![0].fontFamily = 'Different'; },
    (d: typeof component) => { d.variants[1].spec.children![0].children![0].fontStyle = 'Italic'; },
    (d: typeof component) => { d.variants[1].spec.children![0].children![0].textAlignH = 'CENTER'; },
    (d: typeof component) => { d.variants[1].spec.children![0].children![0].textCase = 'UPPER'; },
    (d: typeof component) => { delete d.variants[1].spec.children![0].children![0].fontWeightVar; },
    (d: typeof component) => { d.variants[1].spec.children![0].children![0].characters = 'default'; },
    (d: typeof component) => { d.variants[1].spec.children!.push(structuredClone(d.variants[1].spec.children![0])); },
    (d: typeof component) => { d.variants[1].name = d.variants[0].name; },
  ]) {
    const changed = structuredClone(component); alter(changed);
    assert.throws(() => planNativeRootTextTemplate(changed, source), /NATIVE_ROOT_TEXT_TEMPLATE_PLAN_/);
  }
  assert.throws(() => planNativeRootTextTemplate(component, { ...source, tokenRevision: 'unverified' }), /SOURCE_REVISION_REQUIRED/);
});


test('template token expansion preserves source modes and original leaves while selecting native alias edges', () => {
  const c = seed(), engine = createFigmaEngine({ tokens, icons: new Map() });
  const component = engine.compileComponentData(c, new Map([[c.id, c]]));
  const plan = planNativeRootTextTemplate(component, { contractRevision: revisionOf(c), tokenRevision: revisionOf(primitives) })!;
  const base: NativeTokenContextInput = { fileKey: 'test-template-file', scopeId: 'test-template-scope',
    source: { revision: revisionOf('source'), sourceProgramSha256: 'b'.repeat(64), tokensSha256: revisionOf(primitives).slice(7) },
    tokenPaths: [...flattenTokens(primitives).keys()].sort(),
    modes: [{ sourceMode: 'light', brand: 'default', nativeModeName: 'Light', tokens: primitives, tokenTreeRevision: revisionOf(primitives) }] };
  const before = structuredClone(base), expanded = expandRootTextTemplateTokenContext(base, plan);
  assert.equal(expanded.writeProtocol, 'explicit-modes-v1');
  assert.equal(expanded.modes.length, 2);
  for (const [i, mode] of expanded.modes.entries()) {
    assert.equal(mode.sourceMode, 'light'); assert.equal(mode.brand, 'default');
    assert.deepEqual(mode.nativeSelection, { planRevision: plan.revision, modeKey: plan.modes[i].key });
    const tree = flattenTokens(mode.tokens);
    for (const [path, value] of flattenTokens(primitives)) assert.deepEqual(tree.get(path), value);
    for (const [field, alias] of Object.entries(plan.aliases))
      assert.equal(tree.get(alias.replaceAll('/', '.'))!.value, `{${plan.modes[i].targets[field as keyof typeof plan.aliases].replaceAll('/', '.')}}`);
  }
  assert.deepEqual(base, before);
  const altered = structuredClone(plan); altered.modes[0].targets.fontSize = 'size/unproven';
  assert.throws(() => expandRootTextTemplateTokenContext(base, altered), /PLAN_CHANGED/);
  assert.throws(() => expandRootTextTemplateTokenContext({ ...base, modes: [base.modes[0], base.modes[0]] }, plan), /SOURCE_CONTEXT/);
  assert.throws(() => expandRootTextTemplateTokenContext({ ...base, modes: [{ ...base.modes[0], tokenTreeRevision: revisionOf('changed') }] }, plan), /SOURCE_CONTEXT/);
});
