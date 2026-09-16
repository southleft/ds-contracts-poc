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
import type { NativeContractComparisonInput } from './native-contract-comparison.js';

export async function nativeComparisonFixture(fileKey?: string, gridRoot = false) {
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
  if (gridRoot) {
    main.anatomy.root.layout = { display: 'grid', columns: [{fr:1},{fr:1}], rows: [{fit:true},{fit:true}], flow:'row' };
    main.anatomy.root.literals = {width:'300px',height:'fit-content'};
    main.anatomy.root.tokens!.gap = '{size}';
  }
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
  return { ...host, run, engine, tokens, source, main, content, assets, comparison, supplemental, emit, contract, context };
}

