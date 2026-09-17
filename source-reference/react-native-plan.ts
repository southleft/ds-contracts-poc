/** Reproducible React draft -> native operation plan. Inputs are host-owned:
 * an application adapter must re-open sealed ownership evidence and check the
 * original source before each call. This module grants no delivery permission.
 */
import { revisionOf, canonicalJson } from '../core/contract-provenance.js';
import { createFigmaEngine } from '../core/emit-figma-script.js';
import type { NativeContractDraftSource } from '../core/native-contract-draft.js';
import type { NativeSourceWriteContext } from '../core/native-source-write.js';
import { prepareNativeTokenContext, type NativeTokenContextInput } from '../core/native-token-context.js';
import { flattenTokens } from '../core/tokens.js';
import type { ReactRootMatrix } from './react-root-matrix.js';
import type { ReactChildRoot } from './react-child-root.js';

export interface ReactNativePlanInput {
  operation: { id: string; fileKey: string };
  source: NativeContractDraftSource;
  matrix: ReactRootMatrix | ReactChildRoot;
}
function nativeDraft(input: ReactNativePlanInput, recompileForCorrection = false) {
  const { matrix } = input, draft = matrix.draft;
  if (matrix.version !== 1 || !['combined-property-root-draft', 'observed-child-root-draft'].includes(matrix.qualification) ||
      matrix.acceptedContract !== null || matrix.problems.length ||
      !draft || draft.status !== 'native-compiled' || draft.problems.length ||
      !draft.contract || !draft.tokens || !draft.native)
    throw Error('react-native-plan-draft-unavailable');
  const engine = createFigmaEngine({ tokens: {
    primitives: draft.tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} },
  }, icons: new Map(matrix.qualification==='observed-child-root-draft' ? matrix.assets : []) });
  const contracts = new Map([[draft.contract.id, draft.contract]]);
  if (!recompileForCorrection && canonicalJson(engine.compileComponentData(draft.contract, contracts)) !== canonicalJson(draft.native))
    throw Error('react-native-plan-compiler-output-changed');
  const compiled = engine.compileNativeContractDraft(draft.contract, contracts, input.source);
  return { engine, contracts, draft, compiled };
}

export function prepareReactNativePlan(input: ReactNativePlanInput) {
  return preparePlan(input, false);
}

/** The host must authenticate the original archive before requesting a current
 * compiler correction. Creation still requires its exact saved compiler output;
 * only the separate bounded update planner can authorize this desired state. */
export function prepareReactNativeCorrectionPlan(input: ReactNativePlanInput) {
  return preparePlan(input, true);
}
function preparePlan(input: ReactNativePlanInput, recompileForCorrection: boolean) {
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(input.operation.id) ||
      !/^[A-Za-z0-9]{10,80}$/.test(input.operation.fileKey))
    throw Error('react-native-plan-operation-invalid');
  const { draft, compiled } = nativeDraft(input, recompileForCorrection);
  const tokenInput: NativeTokenContextInput = {
    fileKey: input.operation.fileKey, scopeId: `source-${input.operation.id}`,
    source: { revision: input.source.revision, sourceProgramSha256: input.source.programSha256,
      tokensSha256: revisionOf(draft.tokens).slice(7) },
    tokenPaths: [...flattenTokens(draft.tokens!).keys()].sort(),
    modes: [{ sourceMode: 'light', brand: 'default', nativeModeName: 'Light',
      tokens: structuredClone(draft.tokens!), tokenTreeRevision: compiled.projection.tokenRevision }],
  };
  const plan = {
    version: 1 as const, kind: 'react-root-draft-inspection' as const, purpose: 'source-candidate-inspection' as const,
    acceptedContract: null, nativeQualification: 'unqualified' as const,
    operation: { ...input.operation }, matrixRevision: revisionOf(input.matrix),
    projection: compiled.projection, component: compiled.component,
    componentRevision: revisionOf(compiled.component),
    tokenInput, tokenPreparation: prepareNativeTokenContext(tokenInput),
    limitations: [...draft.limitations, 'native-content-comparisons-not-assembled',
      'native-output-not-observed', 'application-dispatch-not-authorized-by-plan'],
  };
  return { plan, revision: revisionOf(plan) };
}

/** Rebuild the complete pinned plan before generating the guarded shared
 * renderer. A journal must persist its command before the transport runs it. */
export function buildReactNativeComponentWrite(input: ReactNativePlanInput & {
  expectedPlanRevision: string;
  tokens: NativeSourceWriteContext['tokens'];
}) {
  const current = prepareReactNativePlan(input);
  if (current.revision !== input.expectedPlanRevision ||
      canonicalJson(current.plan.tokenInput) !== canonicalJson(input.tokens.input))
    throw Error('react-native-plan-write-stale');
  const { engine, contracts, draft } = nativeDraft(input);
  return { planRevision: current.revision, script: engine.buildNativeContractDraftScript(
    draft.contract!, contracts, input.source, { operation: input.operation, tokens: input.tokens },
  ) };
}
