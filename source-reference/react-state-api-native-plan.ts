/** A separately authenticated state experiment gets its own native operation.
 * It never substitutes behavior into an earlier initial-state observation. */
import { canonicalJson, revisionOf } from '../core/contract-provenance.js';
import { createFigmaEngine } from '../core/emit-figma-script.js';
import type { NativeContractDraftSource } from '../core/native-contract-draft.js';
import type { NativeSourceWriteContext } from '../core/native-source-write.js';
import {
  prepareNativeTokenContext,
  type NativeTokenContextInput,
} from '../core/native-token-context.js';
import { flattenTokens } from '../core/tokens.js';
import type { ReactBehaviorContract } from './react-behavior-contract.js';
import {
  isReactStateApiNativeRequest,
  type ReactStateApiNativeRequest,
} from './react-state-api-native-request.js';
export interface ReactStateApiNativePlanInput {
  operation: NativeSourceWriteContext['operation'];
  source: NativeContractDraftSource;
  request: ReactStateApiNativeRequest;
  draft: ReactBehaviorContract;
  tokens: Record<string, unknown>;
  assets: Array<[string, string]>;
}
function nativeDraft(input: ReactStateApiNativePlanInput) {
  if (
    !isReactStateApiNativeRequest(input.request) ||
    input.draft.status !== 'generated-draft' ||
    input.draft.problems.length ||
    !input.draft.contract
  )
    throw Error('react-state-api-native-draft-unavailable');
  const contract = input.draft.contract,
    engine = createFigmaEngine({
      tokens: {
        primitives: input.tokens,
        semantic: {},
        light: {},
        dark: {},
        brands: { default: {} },
      },
      icons: new Map(input.assets),
    });
  const contracts = new Map([[contract.id, contract]]),
    compiled = engine.compileNativeContractDraft(
      contract,
      contracts,
      input.source,
    );
  if (compiled.component.codeValueAxes?.version !== 2)
    throw Error('react-state-api-native-metadata-unavailable');
  return { engine, contract, contracts, compiled };
}
export function prepareReactStateApiNativePlan(
  input: ReactStateApiNativePlanInput,
) {
  if (
    !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(input.operation.id) ||
    !/^[A-Za-z0-9]{10,80}$/.test(input.operation.fileKey)
  )
    throw Error('react-state-api-native-operation-invalid');
  const { compiled } = nativeDraft(input),
    tokens = input.tokens;
  const tokenInput: NativeTokenContextInput = {
    fileKey: input.operation.fileKey,
    scopeId: 'source-' + input.operation.id,
    source: {
      revision: input.source.revision,
      sourceProgramSha256: input.source.programSha256,
      tokensSha256: revisionOf(tokens).slice(7),
    },
    tokenPaths: [...flattenTokens(tokens).keys()].sort(),
    modes: [
      {
        sourceMode: 'light',
        brand: 'default',
        nativeModeName: 'Light',
        tokens: structuredClone(tokens),
        tokenTreeRevision: compiled.projection.tokenRevision,
      },
    ],
  };
  const plan = {
    version: 1 as const,
    kind: 'react-state-api-draft-inspection' as const,
    purpose: 'source-candidate-inspection' as const,
    acceptedContract: null,
    nativeQualification: 'unqualified' as const,
    operation: { ...input.operation },
    requestRevision: revisionOf(input.request),
    draftRevision: revisionOf(input.draft),
    projection: compiled.projection,
    component: compiled.component,
    componentRevision: revisionOf(compiled.component),
    tokenInput,
    tokenPreparation: prepareNativeTokenContext(tokenInput),
    limitations: [
      ...input.draft.limitations,
      'retained-api-is-not-native-interaction',
      'native-output-not-observed',
      'state-api-live-update-not-qualified',
    ],
  };
  return { plan, revision: revisionOf(plan) };
}
export function buildReactStateApiNativeWrite(
  input: ReactStateApiNativePlanInput & {
    expectedPlanRevision: string;
    tokensContext: NativeSourceWriteContext['tokens'];
  },
) {
  const current = prepareReactStateApiNativePlan(input);
  if (
    current.revision !== input.expectedPlanRevision ||
    canonicalJson(current.plan.tokenInput) !==
      canonicalJson(input.tokensContext.input)
  )
    throw Error('react-state-api-native-write-stale');
  const { engine, contract, contracts } = nativeDraft(input);
  return {
    planRevision: current.revision,
    script: engine.buildNativeContractDraftScript(
      contract,
      contracts,
      input.source,
      { operation: input.operation, tokens: input.tokensContext },
    ),
  };
}
