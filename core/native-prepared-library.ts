/** A retained contract library is not an observed React source program. The
 * host reopens its receipt, input and archive before calling this compiler. */
import { canonicalJson, revisionOf } from './contract-provenance.js';
import { isNativeTokenSource, type NativeTokenSource } from './native-token-source.js';
import { annotateNativeContractProjection, type NativeContractDraftProjection } from './native-contract-draft.js';
import type { Contract } from '../scripts/contract-schema.js';
import type { ComponentData } from './emit-figma-script.js';

export type NativePreparedLibrarySource = Extract<NativeTokenSource, {kind:'prepared-contract-library'}>;
export interface NativePreparedLibraryProjection extends Omit<NativeContractDraftProjection, 'kind' | 'source' | 'rootTextTemplate'> {
  kind: 'prepared-contract-library';
  source: NativePreparedLibrarySource;
  rootTextTemplate?: never;
}

export function prepareNativePreparedLibraryComponent(contract: Contract, component: ComponentData,
  source: NativePreparedLibrarySource, tokenRevision: string, context: NativeContractDraftProjection['context']) {
  if (!isNativeTokenSource(source) || source.kind !== 'prepared-contract-library' || !/^sha256:[a-f0-9]{64}$/.test(tokenRevision))
    throw Error('NATIVE_PREPARED_LIBRARY_SOURCE_IDENTITY_REQUIRED');
  if (contract.bindings.code.runtime || component.nativeSourceCandidate || component.nativeContractDraft)
    throw Error('NATIVE_PREPARED_LIBRARY_PLAIN_CONTRACT_REQUIRED');
  if (component.rootSlot?.textTemplate) throw Error('NATIVE_PREPARED_LIBRARY_TEXT_TEMPLATE_UNQUALIFIED');
  const projection: NativePreparedLibraryProjection = {
    version:1, kind:'prepared-contract-library', purpose:'source-candidate-inspection',
    acceptedContract:null, nativeQualification:'unqualified', contractId:contract.id,
    contractRevision:revisionOf(contract), tokenRevision, source:structuredClone(source), context:{...context},
  };
  return annotateNativeContractProjection(contract, component, projection);
}

/** Same declared State axis as the renderer. Version 1 deliberately keeps its
 * historical base-only inventory; version 2 checks every library preview. */
export function nativeGraphVariants(component: ComponentData, version: 1 | 2 = 1) {
  if (version !== 2 || !component.stateVariants?.length) return component.variants;
  return component.variants.map(v => {
    const name = v.name.includes('=') ? `${v.name}, State=Default` : 'State=Default';
    return {...v, name, spec:{...v.spec,name}};
  }).concat(component.stateVariants);
}

/** Figma returns the deprecated action mirror and an explicit false video
 * reset flag. Accept only those observed API defaults, never extra behavior. */
export function nativeLibraryReactionsMatch(actual: unknown, expected: unknown): boolean {
  if (!Array.isArray(actual)) return false;
  const normalized=[];
  for (const row of actual) {
    if (!row || typeof row !== 'object' || Object.keys(row).some(k=>!['action','actions','trigger'].includes(k)) ||
        !Array.isArray(row.actions) || row.actions.length !== 1) return false;
    const action=row.actions[0];
    if (!action || typeof action !== 'object' || Object.keys(action).some(k=>!['type','destinationId','navigation','transition','resetVideoPosition'].includes(k)) ||
        (action.resetVideoPosition !== undefined && action.resetVideoPosition !== false) ||
        (row.action !== undefined && canonicalJson(row.action) !== canonicalJson(action))) return false;
    const {resetVideoPosition:_,...semantic}=action;
    normalized.push({trigger:row.trigger,actions:[semantic]});
  }
  return canonicalJson(normalized) === canonicalJson(expected);
}
