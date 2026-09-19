import assert from 'node:assert/strict';
import vm from 'node:vm';
import { ContractSchema } from '../scripts/contract-schema.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { revisionOf } from './contract-provenance.js';
import { flattenTokens } from './tokens.js';
import { nativeFixtureHost } from '../source-reference/native-operation-test-fixture.js';
import { emitNativeTokenContextScript, emitNativeTokenContextReadbackScript } from './token-set.js';
import { emitNativeContractReadbackScript, type NativeContractObservationInput } from './native-source-observation.js';
import type { NativeTokenContextInput } from './native-token-context.js';
import { prepareNativeContractUpdate } from './native-contract-update.js';

/** `extraTokens` are allocated beside the defaults and bound to nothing. With none, every byte is as before. */
export async function nativeUpdateFixture(extraTokens: Record<string, unknown> = {}) {
  const { figma } = nativeFixtureHost(), proto = Object.getPrototypeOf(figma.currentPage);
  proto.setExplicitVariableModeForCollection = function(c: any, mode: string) { this.explicitVariableModes = { [c.id]: mode }; };
  const run = async (script: string) => JSON.parse(JSON.stringify(await vm.runInNewContext(`(async()=>{${script}\n})()`, { figma, console }, { timeout: 5000 })));
  const tokens: Record<string, any> = { size: { $type: 'dimension', $value: '16px' }, opacity: { $type: 'number', $value: 0.5 }, ...structuredClone(extraTokens) };
  const context = (t: Record<string,unknown>) => ({ tokens: { primitives: t, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map<string,string>() });
  const engine = createFigmaEngine(context(tokens));
  const contract = ContractSchema.parse({ id: 'fixture.update', name: 'Update', version: '0.1.0', status: 'draft', description: 'Bounded update fixture', states: [], semantics: { element: 'div' },
    props: [{ name: 'kind', type: { enum: ['a','b'] }, default: 'a', bindings: { code: { prop: 'kind' }, figma: { kind: 'VARIANT', property: 'Kind' } } }],
    anatomy: { root: { layout: { display: 'flex', direction: 'row' }, tokens: { width: '{size}', height: '{size}', opacity: '{opacity}' } } },
    bindings: { code: { anchors: { importPath: './fixture', export: 'Update' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } } });
  const source = { revision: revisionOf('source'), programSha256: 'a'.repeat(64), evidenceRevision: revisionOf('evidence') };
  const byId = new Map([[contract.id,contract]]), compiled = engine.compileNativeContractDraft(contract, byId, source);
  const operation = { id: '10000000-0000-4000-8000-000000000008', fileKey: figma.fileKey };
  const tokenInput: NativeTokenContextInput = { fileKey: operation.fileKey, scopeId: 'source-' + operation.id,
    source: { revision: source.revision, sourceProgramSha256: source.programSha256, tokensSha256: revisionOf(tokens).slice(7) },
    tokenPaths: [...flattenTokens(tokens).keys()].sort(), modes: [{ sourceMode: 'light', brand: 'default', nativeModeName: 'Light', tokens, tokenTreeRevision: revisionOf(tokens) }] };
  const made = await run(emitNativeTokenContextScript(tokenInput).script), read = await run(emitNativeTokenContextReadbackScript(tokenInput, made.creationIdentity));
  const creation = await run(engine.buildNativeContractDraftScript(contract, byId, source, { operation, tokens: { input: tokenInput, identity: made.creationIdentity, receipt: read.receipt } }));
  assert.equal(creation.status,'created-candidate');
  const before: NativeContractObservationInput = { operation, planRevision: revisionOf('before'), component: compiled.component, projection: compiled.projection,
    tokenInput, tokenIdentity: made.creationIdentity, creation };
  const baseline = await run(emitNativeContractReadbackScript(before));
  const nextContract = structuredClone(contract); nextContract.anatomy.root.tokens!.opacity = '{nextOpacity}';
  const nextTokens = { ...tokens, nextOpacity: { $type: 'number', $value: 0.25 } };
  const nextEngine = createFigmaEngine(context(nextTokens)), next = nextEngine.compileNativeContractDraft(nextContract, new Map([[nextContract.id,nextContract]]), source);
  const desired = { component: next.component, revision: revisionOf(next), tokenInput: { ...tokenInput, modes: [{ ...tokenInput.modes[0], tokens: nextTokens }] } };
  const input = { before, baseline, desired }, { plan } = prepareNativeContractUpdate(input);
  /** The same contract compiled by the same engine against another token tree: what a changed source produces. */
  const desiredFor = (changed: Record<string, unknown>) => {
    const compiledNext = createFigmaEngine(context(changed)).compileNativeContractDraft(contract, byId, source);
    return { component: compiledNext.component, revision: revisionOf(compiledNext),
      tokenInput: { ...tokenInput, tokenPaths: [...flattenTokens(changed).keys()].sort(),
        modes: [{ ...tokenInput.modes[0], tokens: changed, tokenTreeRevision: revisionOf(changed) }] } };
  };
  return { figma, run, input, plan, tokens, tokenIdentity: made.creationIdentity, desiredFor, nodes: await Promise.all(creation.variants.map((v: any) => figma.getNodeByIdAsync(v.id))) };
}
