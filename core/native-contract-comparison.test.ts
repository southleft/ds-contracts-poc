import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createNativeOperationJobs, REACT_NATIVE_FILE_KEY, type NativeOperationJobsOptions } from '../source-reference/native-operation-jobs.js';
import { prepareReactComparisonPlan, buildReactComparisonWrite, reactComparisonVariant } from '../source-reference/react-comparison-plan.js';
import type { ReactComparisonRequest } from '../source-reference/react-comparison-request.js';
import type { ObservedContentDraft } from '../source-reference/observed-content.js';
import { emitNativeContractComparisonReadbackScript, verifyNativeContractComparisonReadback, type NativeContractComparisonObservationInput } from './native-contract-comparison-observation.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { revisionOf } from './contract-provenance.js';
import { flattenTokens } from './tokens.js';
import { nativeFixtureHost } from '../source-reference/native-operation-test-fixture.js';
import { emitNativeTokenContextScript, emitNativeTokenContextReadbackScript } from './token-set.js';
import type { NativeTokenContextInput } from './native-token-context.js';
import { emitNativeContractReadbackScript, type NativeContractObservationInput } from './native-source-observation.js';
import { prepareNativeContractComparison, type NativeContractComparisonInput } from './native-contract-comparison.js';

async function fixture(fileKey?: string) {
  const host = nativeFixtureHost(), { figma } = host;
  if (fileKey) figma.fileKey = fileKey;
  Object.getPrototypeOf(figma.currentPage).setExplicitVariableModeForCollection = function(c: any, mode: string) {
    this.explicitVariableModes = { ...this.explicitVariableModes, [c.id]: mode };
  };
  const run = async (script: string) => JSON.parse(JSON.stringify(await vm.runInNewContext(`(async()=>{${script}\n})()`, { figma, console }, { timeout: 5000 })));
  const source = { revision: revisionOf('unchanged original'), programSha256: 'b'.repeat(64), evidenceRevision: revisionOf('sealed source') };
  const tokens = { surface: { $type: 'color', $value: '#123456' }, ink: { $type: 'color', $value: '#fafafa' }, size: { $type: 'dimension', $value: '14px' } };
  const assets: Array<[string, string]> = [['check', '<svg viewBox="0 0 24 24" fill="none"><path d="M4 12L10 18L20 4" stroke="currentColor"/></svg>']];
  const engine = createFigmaEngine({ tokens: { primitives: tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} } },
    icons: new Map(assets) });
  const contract = (id: string, anatomy: unknown) => ContractSchema.parse({ id, name: id.endsWith('main') ? 'Main' : 'Content', version: '0.1.0', status: 'draft',
    description: 'Synthetic compiler comparison fixture, never native fidelity evidence', props: [], states: [], semantics: { element: 'button' }, anatomy,
    bindings: { code: { anchors: { importPath: './fixture', export: 'Fixture' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } } });
  const main = contract('fixture.main', { root: { slot: { name: 'children' }, layout: { display: 'inline-flex', direction: 'row' }, tokens: { 'background-color': '{surface}' } } });
  const content = contract('fixture.content', { root: { layout: { display: 'inline-flex', direction: 'row' }, parts: {
    icon: { icon: { asset: 'check', size: 16 }, tokens: { color: '{ink}' } },
    label: { text: 'Save changes', tokens: { color: '{ink}', 'font-size': '{size}' }, declared: { 'font-family': 'Inter' } },
  } } });
  const context = async (id: string) => {
    const operation = { id, fileKey: figma.fileKey };
    const input: NativeTokenContextInput = { fileKey: operation.fileKey, scopeId: 'source-' + id,
      source: { revision: source.revision, sourceProgramSha256: source.programSha256, tokensSha256: revisionOf(tokens).slice(7) },
      tokenPaths: [...flattenTokens(tokens).keys()].sort(), modes: [{ sourceMode: 'light', brand: 'default', nativeModeName: 'Light', tokens, tokenTreeRevision: revisionOf(tokens) }] };
    const created = await run(emitNativeTokenContextScript(input).script);
    assert.equal(created.status, 'created-candidate');
    const observed = await run(emitNativeTokenContextReadbackScript(input, created.creationIdentity));
    return { operation, tokens: { input, identity: created.creationIdentity, receipt: observed.receipt } };
  };
  const original = await context('10000000-0000-4000-8000-000000000001');
  const mainData = engine.compileNativeContractDraft(main, new Map([[main.id, main]]), source);
  const creation = await run(engine.buildNativeContractDraftScript(main, new Map([[main.id, main]]), source, original));
  assert.equal(creation.status, 'created-candidate', JSON.stringify(creation));
  const parent: NativeContractObservationInput = { operation: original.operation, planRevision: revisionOf('parent plan'),
    projection: mainData.projection, component: mainData.component, tokenInput: original.tokens.input, tokenIdentity: original.tokens.identity, creation };
  const receipt = await run(emitNativeContractReadbackScript(parent));
  const comparison: NativeContractComparisonInput = { parent, receipt, caseId: 'sample', variantName: mainData.component.variants[0].name, slotSpecPath: [0] };
  const supplemental = await context('10000000-0000-4000-8000-000000000002');
  const emit = (c: Contract = content, selected = comparison) => engine.buildNativeContractComparisonScript(c, new Map([[c.id, c]]), source, supplemental, selected);
  return { ...host, run, engine, tokens, source, content, assets, comparison, supplemental, emit, contract, context };
}

test('shared writer fills an instance of the existing main, retaining editable content and both token contexts', async () => {
  const f = await fixture(), before = await f.run(emitNativeContractReadbackScript(f.comparison.parent));
  const componentCount = f.figma.root.findAll((n: any) => n.type === 'COMPONENT').length;
  const result = await f.run(f.emit());
  assert.equal(result.status, 'created-candidate', JSON.stringify(result));
  assert.equal(f.figma.root.findAll((n: any) => n.type === 'COMPONENT').length, componentCount);
  const record = result.comparisons[0], instance = await f.figma.getNodeByIdAsync(record.instanceId);
  assert.equal(instance.type, 'INSTANCE');
  assert.equal((await instance.getMainComponentAsync()).id, f.comparison.parent.creation.variants[0].id);
  const slot = await f.figma.getNodeByIdAsync(record.slots[0].nodeId);
  assert.equal(slot.type, 'SLOT'); assert.equal(slot.children.length, 2);
  assert.equal(slot.children[1].type, 'TEXT'); assert.equal(slot.children[1].characters, 'Save changes');
  assert.equal(slot.children[1].boundVariables.fontSize.id, f.supplemental.tokens.identity.variables.find((v: any) => v.tokenPath === 'size')!.id);
  assert.equal(instance.explicitVariableModes[f.comparison.parent.tokenIdentity.collection.id], f.comparison.parent.tokenIdentity.modes[0].modeId);
  assert.equal(instance.explicitVariableModes[f.supplemental.tokens.identity.collection.id], f.supplemental.tokens.identity.modes[0].modeId);
  assert.deepEqual(await f.run(emitNativeContractReadbackScript(f.comparison.parent)), before);
  const count = f.figma.root.findAll(() => true).length;
  const repeat = await f.run(f.emit());
  assert.equal(repeat.status, 'refused'); assert.equal(repeat.allocationAttempted, false);
  assert.equal(f.figma.root.findAll(() => true).length, count);
  const plain = f.engine.compileComponentData(f.content, new Map([[f.content.id, f.content]]));
  plain.variants[0].spec.children![0].nativeContractSample = { caseId: 'x', contentRevision: revisionOf('x'), specPath: [0] };
  assert.throws(() => f.engine.buildBatchScript([plain], f.figma.fileKey), /WRITE_CONTEXT_REQUIRED/);
});

test('changed main or tokens, absent fonts, and substituted source fail before allocation', async () => {
  for (const mutation of ['main', 'tokens', 'font']) {
    const f = await fixture(), script = f.emit();
    if (mutation === 'main') (await f.figma.getNodeByIdAsync(f.comparison.parent.creation.variants[0].id)).name = 'Changed';
    if (mutation === 'tokens') f.variables.find((v: any) => v.id === f.comparison.parent.tokenIdentity.variables[0].id)!.setValueForMode(f.comparison.parent.tokenIdentity.modes[0].modeId, 'changed');
    if (mutation === 'font') f.figma.loadFontAsync = async () => { throw Error('missing'); };
    const count = f.figma.root.findAll(() => true).length, result = await f.run(script);
    assert.equal(result.status, 'refused', JSON.stringify(result)); assert.equal(result.allocationAttempted, false);
    assert.equal(f.figma.root.findAll(() => true).length, count);
  }
  const f = await fixture();
  const changed = structuredClone(f.comparison); changed.receipt.nodes!.find(n => n.type === 'COMPONENT')!.metadata.nativeContractPart = '{}';
  assert.throws(() => f.emit(f.content, changed), /parent-observation-required/);
  changed.slotSpecPath = [999];
  assert.throws(() => f.emit(f.content, { ...f.comparison, slotSpecPath: changed.slotSpecPath }), /slot-path-invalid/);
  const data = f.engine.compileComponentData(f.content, new Map([[f.content.id, f.content]]));
  assert.throws(() => prepareNativeContractComparison(f.content, data, { ...f.source, revision: revisionOf('different') }, revisionOf(f.tokens), { mode: 'light', brand: 'default' }, f.comparison), /source-changed/);
});

test('partial allocations are retained and never recreated by repeating the writer', async () => {
  const f = await fixture(), script = f.emit();
  f.figma.createText = () => { throw Error('simulated native allocation interruption'); };
  const result = await f.run(script);
  assert.equal(result.status, 'partial-or-unknown-allocation'); assert.equal(result.allocationAttempted, true);
  assert(result.pageId); assert(result.comparisonBoardId); assert(result.comparisons[0].instanceId);
  assert(result.nodes.some((n: any) => n.type === 'INSTANCE'));
  const count = f.figma.root.findAll(() => true).length, repeat = await f.run(script);
  assert.equal(repeat.status, 'refused'); assert.equal(repeat.allocationAttempted, false);
  assert.equal(f.figma.root.findAll(() => true).length, count);
  assert.deepEqual(await f.run(emitNativeContractReadbackScript(f.comparison.parent)), f.comparison.receipt);
});

test('missing allocation ownership refuses instead of silently emitting styled text wrappers', async () => {
  const f = await fixture(), boxed = structuredClone(f.content);
  boxed.anatomy.root.parts!.label.tokens!['background-color'] = '{surface}';
  assert.throws(() => f.emit(boxed), /content-allocation-ownership-unqualified/);
  const wrongScope = structuredClone(f.supplemental); wrongScope.operation.id = f.comparison.parent.operation.id;
  assert.throws(() => f.engine.buildNativeContractComparisonScript(f.content, new Map([[f.content.id, f.content]]), f.source, wrongScope, f.comparison), /SCOPE_INVALID/);
});

async function observedFixture() {
  const f = await fixture(), creation = await f.run(f.emit());
  const data = f.engine.compileComponentData(f.content, new Map([[f.content.id, f.content]]));
  const comparison = prepareNativeContractComparison(f.content, data, f.source, revisionOf(f.tokens), { mode: 'light', brand: 'default' }, f.comparison);
  const input: NativeContractComparisonObservationInput = { operation: f.supplemental.operation, planRevision: revisionOf('comparison plan'), comparison,
    tokenInput: f.supplemental.tokens.input, tokenIdentity: f.supplemental.tokens.identity, creation };
  const receipt = await f.run(emitNativeContractComparisonReadbackScript(input, true));
  return { ...f, input, receipt };
}
test('independent comparison readback verifies the unchanged main, native content, bindings, inventory and export', async () => {
  const f = await observedFixture(), count = f.figma.root.findAll(() => true).length;
  assert.equal(f.receipt.status, 'native-comparison-readback-collected', JSON.stringify(f.receipt));
  const checked = verifyNativeContractComparisonReadback(f.input, f.receipt);
  assert.equal(checked.status, 'supported-comparison-structure-observed', JSON.stringify(checked));
  assert.equal(checked.nativeQualification, 'unqualified');
  assert.equal(f.receipt.content.images.length, 1);
  assert.equal(f.receipt.content.images[0].nodeId, f.input.creation.comparisons[0].instanceId);
  assert.equal(f.figma.root.findAll(() => true).length, count);
  assert.deepEqual(await f.run(emitNativeContractComparisonReadbackScript(f.input, true)), f.receipt);
  for (const mutate of [
    (r: any) => { r.content.nodes.find((n: any) => n.type === 'TEXT').values.characters = 'Changed'; },
    (r: any) => { r.content.nodes.find((n: any) => n.type === 'TEXT').values.fontName.family = 'Substitute'; },
    (r: any) => { r.content.nodes.find((n: any) => n.type === 'TEXT').values.boundVariables.fontSize.id = 'replacement'; },
    (r: any) => { r.content.nodes.find((n: any) => n.type === 'TEXT').values.fills[0].boundVariables.color.id = 'replacement'; },
    (r: any) => { r.content.nodes.find((n: any) => n.type === 'TEXT').metadata.nativeContractSample = '{}'; },
    (r: any) => { r.content.nodes.find((n: any) => n.type === 'INSTANCE').mainId = 'replacement'; },
    (r: any) => { r.content.nodes.find((n: any) => n.type === 'INSTANCE').values.fills = []; },
    (r: any) => { r.content.nodes.find((n: any) => n.type === 'SLOT').values.componentPropertyReferences.slotContentId = 'replacement'; },
    (r: any) => { r.content.nodes.find((n: any) => n.type === 'SLOT').childIds.reverse(); },
    (r: any) => { r.content.nodes.pop(); },
    (r: any) => { r.content.tokens.receipt.variables[0].key = 'replacement'; },
    (r: any) => { r.parent.nodes.find((n: any) => n.type === 'COMPONENT').name = 'changed'; },
  ]) {
    const changed = structuredClone(f.receipt); mutate(changed);
    assert.equal(verifyNativeContractComparisonReadback(f.input, changed).status, 'refused', mutate.toString());
  }
});

test('native text binding arrays and empty root references preserve strict binding checks', async () => {
  const f = await observedFixture(), native = structuredClone(f.receipt);
  const text = native.content.nodes.find((n: any) => n.type === 'TEXT');
  const instance = native.content.nodes.find((n: any) => n.type === 'INSTANCE');
  text.values.boundVariables.fontSize = [text.values.boundVariables.fontSize];
  instance.values.componentPropertyReferences = null;
  assert.equal(verifyNativeContractComparisonReadback(f.input, native).status, 'supported-comparison-structure-observed');
  for (const mutate of [
    (r: any) => { r.content.nodes.find((n: any) => n.type === 'TEXT').values.boundVariables.fontSize = []; },
    (r: any) => { const n = r.content.nodes.find((n: any) => n.type === 'TEXT'); n.values.boundVariables.fontSize.push(n.values.boundVariables.fontSize[0]); },
    (r: any) => { r.content.nodes.find((n: any) => n.type === 'TEXT').values.boundVariables.fontSize[0].id = 'replacement'; },
    (r: any) => { r.content.nodes.find((n: any) => n.type === 'INSTANCE').values.componentPropertyReferences = { visible: 'unexpected' }; },
    (r: any) => { r.content.nodes.find((n: any) => n.type === 'SLOT').values.componentPropertyReferences = null; },
  ]) {
    const changed = structuredClone(native); mutate(changed);
    assert.equal(verifyNativeContractComparisonReadback(f.input, changed).status, 'refused', mutate.toString());
  }
});

test('instance-derived slot IDs retain allocated roles; a forged role or changed source main refuses', async () => {
  const f = await observedFixture(), changed = structuredClone(f.receipt);
  const slot = changed.content.nodes.find((n: any) => n.type === 'SLOT');
  const aliases = new Map(f.input.creation.nodes.filter((n: any) => n.slotIdentity)
    .map((n: any) => [n.id, `${slot.id};derived-${n.id}`]));
  for (const row of changed.content.nodes) {
    row.id = aliases.get(row.id) ?? row.id; row.parentId = aliases.get(row.parentId) ?? row.parentId;
    row.childIds = row.childIds.map((id: string) => aliases.get(id) ?? id);
  }
  assert.equal(verifyNativeContractComparisonReadback(f.input, changed).status, 'supported-comparison-structure-observed');
  changed.content.nodes.find((n: any) => n.type === 'TEXT').metadata.nativeSourceAllocation = 'forged';
  assert.equal(verifyNativeContractComparisonReadback(f.input, changed).status, 'refused');
  const main = await f.figma.getNodeByIdAsync(f.input.comparison.mainId); main.name = 'Changed';
  const live = await f.run(emitNativeContractComparisonReadbackScript(f.input));
  assert.equal(verifyNativeContractComparisonReadback(f.input, live).status, 'refused');
});

test('comparison operation persists through every journal phase and repeat selection keeps its identity', async t => {
  const f = await fixture(REACT_NATIVE_FILE_KEY), repo = mkdtempSync(path.join(tmpdir(), 'react-comparison-journal-'));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const content: ObservedContentDraft = { version: 1, status: 'compiled-comparison-draft', qualification: 'observed-comparison-content-only',
    acceptedContract: null, nativeQualification: 'unqualified', inputRevision: revisionOf('observations'), treeRevision: revisionOf('tree'), fontsRevision: revisionOf('fonts'),
    contract: f.content, tokens: f.tokens, assets: f.assets, component: f.engine.compileComponentData(f.content, new Map([[f.content.id, f.content]])),
    receipts: [], residuals: [], problems: [], limitations: ['synthetic-test-only'] };
  const request: ReactComparisonRequest = { version: 1, kind: 'react-content-comparison', parentOperationId: f.comparison.parent.operation.id,
    root: { version: 1, kind: 'react-root-draft', referenceId: 'a'.repeat(64), ownership: { id: '10000000-0000-4000-8000-000000000010', sha256: 'b'.repeat(64) },
      inventorySha256: 'c'.repeat(64), caseId: 'sample', matrixRevision: revisionOf('matrix') },
    content: { id: '10000000-0000-4000-8000-000000000011', reportSha256: 'd'.repeat(64), inventorySha256: 'e'.repeat(64) } };
  let current = true;
  const options: NativeOperationJobsOptions = { prepare: () => { throw Error('unexpected source adapter'); }, reactComparison: {
    prepare: (selected, operation) => {
      assert.deepEqual(selected, request); if (!current) throw Error('source changed');
      return { visual: { id: request.root.ownership.id, reportSha256: request.root.ownership.sha256 },
        preparation: { id: request.content.id, reportSha256: request.content.reportSha256 },
        plan: prepareReactComparisonPlan({ operation, content, source: f.source, comparison: f.comparison }) };
    },
    buildComponent: (_, context) => buildReactComparisonWrite({ operation: context.operation, content, source: f.source,
      comparison: f.comparison, expectedPlanRevision: context.planRevision, tokens: context.tokens }),
  } };
  let jobs = createNativeOperationJobs(repo, options);
  const saved = jobs.prepare(request);
  for (const phase of ['token-create', 'token-readback', 'component-create', 'component-readback'] as const) {
    const command = jobs.dispatch(saved.id, phase), { script, readOnly: _, kind: __, ...identity } = command;
    const result = await f.run(script);
    jobs.accept(saved.id, { ...identity, result });
    jobs = createNativeOperationJobs(repo, options);
    assert.notEqual(jobs.get(saved.id).phase, 'evidence-unavailable', phase);
  }
  const final = jobs.get(saved.id);
  assert.equal(final.phase, 'component-structure-observed', JSON.stringify(final));
  assert.equal(final.structuralObservation?.status, 'supported-comparison-structure-observed');
  assert.equal(final.imageObservation?.images.length, 1);
  assert.equal(jobs.listReact(request.root.referenceId)[0].parentOperationId, request.parentOperationId);
  assert.equal(jobs.prepare(request).id, saved.id);
  assert.throws(() => jobs.dispatch(saved.id, 'component-create'), /already-dispatched/);
  const count = f.figma.root.findAll(() => true).length;
  const readback = jobs.retryObservation(saved.id), { script, readOnly: _, kind: __, ...identity } = readback;
  jobs.accept(saved.id, { ...identity, result: await f.run(script) });
  assert.equal(jobs.get(saved.id).phase, 'component-structure-observed');
  assert.equal(f.figma.root.findAll(() => true).length, count);
  current = false;
  assert.equal(jobs.get(saved.id).sourceCurrent, false);
  assert.throws(() => jobs.prepare(request), /source changed/);
});

test('comparison variant selection preserves typed null, string null, defaults and omitted values', () => {
  const prop = { name: 'tone', type: { enum: ['none', 'literal-null', 'quiet'] }, default: 'quiet',
    bindings: { code: { prop: 'appearance', values: { none: null, 'literal-null': 'null', quiet: 'quiet' } },
      figma: { kind: 'VARIANT', property: 'Tone', values: { none: 'None', 'literal-null': 'Null text', quiet: 'Quiet' } } } };
  const contract = ContractSchema.parse({ id: 'fixture.values', name: 'Values', version: '0.1.0', status: 'draft', description: 'Typed fixture',
    props: [prop], states: [], semantics: { element: 'div' }, anatomy: { root: {} }, bindings: { code: { anchors: { importPath: './fixture', export: 'Values' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } } });
  assert.equal(reactComparisonVariant(contract, { appearance: null }), 'Tone=None');
  assert.equal(reactComparisonVariant(contract, { appearance: 'null' }), 'Tone=Null text');
  assert.equal(reactComparisonVariant(contract, {}), 'Tone=Quiet');
  assert.equal(reactComparisonVariant(contract, { appearance: { kind: 'undefined' } }), 'Tone=Quiet');
  delete contract.props[0].default; contract.props[0].bindings.figma.unsetValue = '(unset)';
  assert.equal(reactComparisonVariant(contract, {}), 'Tone=(unset)');
  assert.throws(() => reactComparisonVariant(contract, { appearance: { kind: 'object' } }), /value-unqualified/);
});


async function nestedFixture() {
  const f = await fixture();
  const child = f.contract('fixture.child', { root: { slot: { name: 'children' }, layout: { display: 'inline-flex', direction: 'row' }, tokens: { 'background-color': '{ink}' } } });
  child.name = 'Main'; // Deliberate display-name collision with the outer main.
  const context = await f.context('10000000-0000-4000-8000-000000000003');
  const data = f.engine.compileNativeContractDraft(child, new Map([[child.id, child]]), f.source);
  const creation = await f.run(f.engine.buildNativeContractDraftScript(child, new Map([[child.id, child]]), f.source, context));
  assert.equal(creation.status, 'created-candidate');
  const parent: NativeContractObservationInput = { operation: context.operation, planRevision: revisionOf('nested main plan'),
    projection: data.projection, component: data.component, tokenInput: context.tokens.input, tokenIdentity: context.tokens.identity, creation };
  const receipt = await f.run(emitNativeContractReadbackScript(parent));
  const text = (value: string) => ({ text: value, tokens: { color: '{surface}', 'font-size': '{size}' }, declared: { 'font-family': 'Inter' } });
  const content = f.contract('fixture.composed', { root: { layout: { display: 'flex', direction: 'column' }, parts: {
    first: { layout: { display: 'flex', direction: 'row' }, parts: {
      nested: { layout: { display: 'flex', direction: 'row' }, parts: { label: text('First editable content') } },
    } },
    second: { layout: { display: 'flex', direction: 'row' }, parts: { secondLabel: text('Second editable content') } },
  } } });
  const reference = { parent, receipt, variantName: data.component.variants[0].name, slotSpecPath: [0] };
  const selected: NativeContractComparisonInput = { ...f.comparison, instances: [[0], [0, 0], [1]].map(specPath => ({ ...reference, specPath })) };
  const emit = () => f.emit(content, selected);
  const observe = async (creation: any) => {
    const component = f.engine.compileComponentData(content, new Map([[content.id, content]]));
    const comparison = prepareNativeContractComparison(content, component, f.source, revisionOf(f.tokens), { mode: 'light', brand: 'default' }, selected);
    const input: NativeContractComparisonObservationInput = { operation: f.supplemental.operation, planRevision: revisionOf('nested composition'), comparison,
      tokenInput: f.supplemental.tokens.input, tokenIdentity: f.supplemental.tokens.identity, creation };
    return { input, receipt: await f.run(emitNativeContractComparisonReadbackScript(input, true)) };
  };
  return { ...f, content, selected, reference, emit, observe };
}

test('nested caller content keeps main linkage, independent token contexts and editable slots at multiple depths', async () => {
  const f = await nestedFixture(), before = await f.run(emitNativeContractReadbackScript(f.reference.parent));
  const mains = f.figma.root.findAll((n: any) => n.type === 'COMPONENT').map((n: any) => n.id);
  const creation = await f.run(f.emit());
  assert.equal(creation.status, 'created-candidate', JSON.stringify(creation));
  assert.deepEqual(f.figma.root.findAll((n: any) => n.type === 'COMPONENT').map((n: any) => n.id), mains);
  const records = creation.comparisons[0].nested;
  assert.deepEqual(records.map((r: any) => r.index), [0, 1, 2]);
  for (const record of records) {
    const node = await f.figma.getNodeByIdAsync(record.instanceId);
    assert.equal(node.type, 'INSTANCE');
    assert.equal((await node.getMainComponentAsync()).id, f.reference.parent.creation.variants[0].id);
    assert.equal(node.children[0].type, 'SLOT');
    assert.equal(node.explicitVariableModes[f.reference.parent.tokenIdentity.collection.id], f.reference.parent.tokenIdentity.modes[0].modeId);
  }
  assert.deepEqual(await f.run(emitNativeContractReadbackScript(f.reference.parent)), before);
  const { input, receipt } = await f.observe(creation);
  assert.equal(receipt.nested.length, 1, 'repeated uses share one independent read of their pinned main');
  assert.equal(verifyNativeContractComparisonReadback(input, receipt).status, 'supported-comparison-structure-observed', JSON.stringify(verifyNativeContractComparisonReadback(input, receipt)));
  assert.deepEqual(await f.run(emitNativeContractComparisonReadbackScript(input, true)), receipt);
  // Figma may materialize every descendant under the outer slot using
  // instance-derived IDs. Nested instances must retain their original roles.
  const rebased = structuredClone(receipt), outerSlot = creation.comparisons[0].slots[0].nodeId;
  const aliases = new Map(creation.nodes.filter((n: any) => n.slotIdentity).map((n: any) => [n.id, `${outerSlot};derived-${n.id}`]));
  for (const row of rebased.content.nodes) {
    row.id = aliases.get(row.id) ?? row.id; row.parentId = aliases.get(row.parentId) ?? row.parentId;
    row.childIds = row.childIds.map((id: string) => aliases.get(id) ?? id);
  }
  assert.equal(verifyNativeContractComparisonReadback(input, rebased).status, 'supported-comparison-structure-observed');
  rebased.content.nodes.find((n: any) => n.type === 'TEXT').metadata.nativeSourceAllocation = 'forged';
  assert.equal(verifyNativeContractComparisonReadback(input, rebased).status, 'refused');
  assert.equal((await f.run(f.emit())).allocationAttempted, false, 'repeat must not create another composition');
  const changed = structuredClone(receipt);
  changed.content.nodes.find((n: any) => n.id === records[1].instanceId).mainId = f.comparison.parent.creation.variants[0].id;
  assert.equal(verifyNativeContractComparisonReadback(input, changed).status, 'refused');
  const wrongContent = structuredClone(receipt);
  wrongContent.content.nodes.find((n: any) => n.type === 'TEXT').values.characters = 'Lost caller text';
  assert.equal(verifyNativeContractComparisonReadback(input, wrongContent).status, 'refused');
  const wrongTokens = structuredClone(receipt);
  wrongTokens.content.nodes.find((n: any) => n.id === records[1].instanceId).values.explicitVariableModes = {};
  assert.equal(verifyNativeContractComparisonReadback(input, wrongTokens).status, 'refused');
  const omitted = structuredClone(input); omitted.creation.comparisons[0].nested.pop();
  assert.equal(verifyNativeContractComparisonReadback(omitted, receipt).status, 'refused');
  const changedMain = await f.figma.getNodeByIdAsync(f.reference.parent.creation.variants[0].id);
  changedMain.name = 'Native child changed after creation';
  const changedRead = await f.run(emitNativeContractComparisonReadbackScript(input));
  assert.equal(verifyNativeContractComparisonReadback(input, changedRead).status, 'refused');
});

test('nested references require pinned same-source mains and complete paths before allocation', async () => {
  const f = await nestedFixture();
  for (const mutate of [
    (c: NativeContractComparisonInput) => { c.instances![0].specPath = [99]; },
    (c: NativeContractComparisonInput) => { c.instances![0].specPath = [1]; },
    (c: NativeContractComparisonInput) => { c.instances![0].specPath = [0, 0, 0]; },
    (c: NativeContractComparisonInput) => { c.instances![0].parent.operation.fileKey = 'wrong-file'; },
    (c: NativeContractComparisonInput) => { c.instances![0].parent.projection.source.programSha256 = 'f'.repeat(64); },
    (c: NativeContractComparisonInput) => { c.instances![0].slotSpecPath = []; },
    (c: NativeContractComparisonInput) => { c.instances![0].receipt.nodes!.find(n => n.type === 'COMPONENT')!.metadata.nativeContractPart = '{}'; },
  ]) {
    const changed = structuredClone(f.selected); mutate(changed);
    assert.throws(() => f.engine.buildNativeContractComparisonScript(f.content, new Map([[f.content.id, f.content]]), f.source, f.supplemental, changed), /native-contract-comparison-/);
  }
  const script = f.emit();
  const count = f.figma.root.findAll(() => true).length;
  (await f.figma.getNodeByIdAsync(f.reference.parent.creation.variants[0].id)).name = 'Designer changed the main';
  const result = await f.run(script);
  assert.equal(result.status, 'refused'); assert.equal(result.allocationAttempted, false);
  assert.equal(f.figma.root.findAll(() => true).length, count);
});
