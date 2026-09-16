/** Host-authenticated initial-state observations use the existing scoped native
 * compiler, token context and operation journal. No runtime semantics inferred. */
import { canonicalJson, revisionOf } from '../core/contract-provenance.js';
import { createFigmaEngine } from '../core/emit-figma-script.js';
import type { NativeContractDraftSource } from '../core/native-contract-draft.js';
import type { NativeSourceWriteContext } from '../core/native-source-write.js';
import { prepareNativeTokenContext, type NativeTokenContextInput } from '../core/native-token-context.js';
import { flattenTokens } from '../core/tokens.js';
import type { compileReactInitialContract } from './react-initial-contract.js';
export interface ReactInitialNativePlanInput {
  operation: NativeSourceWriteContext['operation']; source: NativeContractDraftSource;
  draft: ReturnType<typeof compileReactInitialContract>;
}
function nativeDraft(input: ReactInitialNativePlanInput) {
  const d = input.draft, c = d.compiled;
  if (d.version !== 1 || d.qualification !== 'observed-initial-state-contract' || d.status !== 'compiled-draft' ||
      d.acceptedContract !== null || d.nativeQualification !== 'unqualified' || d.problems.length ||
      !c?.contract || !c.tokens || !c.component || c.problems.length) throw Error('react-initial-native-draft-unavailable');
  const engine = createFigmaEngine({ tokens: { primitives: c.tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map(c.assets) });
  const contracts = new Map([[c.contract.id, c.contract]]);
  if (canonicalJson(engine.compileComponentData(c.contract, contracts)) !== canonicalJson(c.component))
    throw Error('react-initial-native-compiler-changed');
  return { engine, contracts, contract: c.contract, tokens: c.tokens,
    compiled: engine.compileNativeContractDraft(c.contract, contracts, input.source) };
}
export function prepareReactInitialNativePlan(input: ReactInitialNativePlanInput) {
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(input.operation.id) || !/^[A-Za-z0-9]{10,80}$/.test(input.operation.fileKey))
    throw Error('react-initial-native-operation-invalid');
  const { tokens, compiled } = nativeDraft(input);
  const tokenInput: NativeTokenContextInput = { fileKey: input.operation.fileKey, scopeId: 'source-' + input.operation.id,
    source: { revision: input.source.revision, sourceProgramSha256: input.source.programSha256, tokensSha256: revisionOf(tokens).slice(7) },
    tokenPaths: [...flattenTokens(tokens).keys()].sort(), modes: [{ sourceMode: 'light', brand: 'default', nativeModeName: 'Light', tokens: structuredClone(tokens), tokenTreeRevision: compiled.projection.tokenRevision }] };
  const plan = { version: 1 as const, kind: 'react-initial-draft-inspection' as const, purpose: 'source-candidate-inspection' as const,
    acceptedContract: null, nativeQualification: 'unqualified' as const, operation: { ...input.operation }, draftRevision: revisionOf(input.draft),
    projection: compiled.projection, component: compiled.component, componentRevision: revisionOf(compiled.component),
    tokenInput, tokenPreparation: prepareNativeTokenContext(tokenInput), limitations: [...input.draft.limitations, 'native-output-not-observed'] };
  return { plan, revision: revisionOf(plan) };
}
export function buildReactInitialNativeWrite(input: ReactInitialNativePlanInput & { expectedPlanRevision: string; tokens: NativeSourceWriteContext['tokens'] }) {
  const current = prepareReactInitialNativePlan(input);
  if (current.revision !== input.expectedPlanRevision || canonicalJson(current.plan.tokenInput) !== canonicalJson(input.tokens.input))
    throw Error('react-initial-native-write-stale');
  const { engine, contracts, contract } = nativeDraft(input);
  return { planRevision: current.revision, script: engine.buildNativeContractDraftScript(contract, contracts, input.source,
    { operation: input.operation, tokens: input.tokens }) };
}
