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

async function fixture() {
  const host = nativeFixtureHost(), { figma } = host;
  Object.getPrototypeOf(figma.currentPage).setExplicitVariableModeForCollection = function(c: any, mode: string) {
    this.explicitVariableModes = { ...this.explicitVariableModes, [c.id]: mode };
  };
  const run = async (script: string) => JSON.parse(JSON.stringify(await vm.runInNewContext(`(async()=>{${script}\n})()`, { figma, console }, { timeout: 5000 })));
  const source = { revision: revisionOf('unchanged original'), programSha256: 'b'.repeat(64), evidenceRevision: revisionOf('sealed source') };
  const tokens = { surface: { $type: 'color', $value: '#123456' }, ink: { $type: 'color', $value: '#fafafa' }, size: { $type: 'dimension', $value: '14px' } };
  const engine = createFigmaEngine({ tokens: { primitives: tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} } },
    icons: new Map([['check', '<svg viewBox="0 0 24 24" fill="none"><path d="M4 12L10 18L20 4" stroke="currentColor"/></svg>']]) });
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
  return { ...host, run, engine, tokens, source, content, comparison, supplemental, emit };
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
