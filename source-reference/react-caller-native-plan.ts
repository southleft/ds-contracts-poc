/** Durable application plan for one sealed React caller-composition graph. */
import { canonicalJson, revisionOf } from '../core/contract-provenance.js';
import { createFigmaEngine } from '../core/emit-figma-script.js';
import type { NativeContractDraftSource } from '../core/native-contract-draft.js';
import type { NativeSourceWriteContext } from '../core/native-source-write.js';
import { prepareNativeTokenContext, type NativeTokenContextInput } from '../core/native-token-context.js';
import { flattenTokens } from '../core/tokens.js';
import { compileReactCallerNative } from './react-caller-native.js';
import type { projectReactCallerCompositionGraph } from './react-caller-composition.js';

export interface ReactCallerNativePlanInput {
  operation: { id: string; fileKey: string };
  source: NativeContractDraftSource;
  graph: ReturnType<typeof projectReactCallerCompositionGraph>;
  graphVerification?: 1;
}

function compile(input: ReactCallerNativePlanInput) {
  const native = compileReactCallerNative(input.graph);
  if (native.report.unsupportedPropertyBindings.length || input.graph.draft.contextDifferences.length)
    throw Error('react-caller-native-graph-blocked');
  const parentId = input.graph.draft.contract!.id;
  const parent = native.scoped.contracts.get(parentId);
  if (!parent) throw Error('react-caller-native-parent-unavailable');
  const engine = createFigmaEngine({ tokens: {
    primitives: native.scoped.tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} },
  }, icons: native.scoped.icons });
  const compiled = engine.compileNativeContractGraphDraft(parent, native.scoped.contracts, input.source, input.operation.id);
  return { native, parent, engine, compiled };
}

export function prepareReactCallerNativePlan(input: ReactCallerNativePlanInput) {
  if (input.graphVerification !== undefined && input.graphVerification !== 1)
    throw Error('react-caller-native-verification-version');
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(input.operation.id) ||
      !/^[A-Za-z0-9]{10,80}$/.test(input.operation.fileKey))
    throw Error('react-caller-native-operation-invalid');
  const { native, compiled } = compile(input);
  const tokenInput: NativeTokenContextInput = {
    fileKey: input.operation.fileKey,
    scopeId: `source-${input.operation.id}`,
    source: { revision: input.source.revision, sourceProgramSha256: input.source.programSha256,
      tokensSha256: revisionOf(native.scoped.tokens).slice(7) },
    tokenPaths: [...flattenTokens(native.scoped.tokens).keys()].sort(),
    modes: [{ sourceMode: 'light', brand: 'default', nativeModeName: 'Light',
      tokens: structuredClone(native.scoped.tokens), tokenTreeRevision: compiled.projection.tokenRevision }],
  };
  const plan = {
    version: 1 as const,
    kind: 'react-caller-graph-draft-inspection' as const,
    purpose: 'source-candidate-inspection' as const,
    acceptedContract: null,
    nativeQualification: 'unqualified' as const,
    operation: { ...input.operation },
    graphRevision: native.report.graphRevision,
    projection: compiled.projection,
    component: compiled.component,
    graphComponents: compiled.components,
    ...(input.graphVerification ? {graphVerification: input.graphVerification} : {}),
    componentRevision: revisionOf(compiled.component),
    componentRevisions: compiled.componentRevisions,
    tokenInput,
    tokenPreparation: prepareNativeTokenContext(tokenInput),
    limitations: ['native-visual-fidelity-unverified', ...(input.graphVerification
      ? ['native-graph-computed-geometry-unverified', 'native-inherited-sample-token-bindings-unqualified']
      : ['native-graph-dependency-internals-identity-only']),
      'generated-consumer-not-installed', 'accepted-contract-unqualified'],
  };
  return { plan, revision: revisionOf(plan) };
}

export function buildReactCallerNativeWrite(input: ReactCallerNativePlanInput & {
  expectedPlanRevision: string;
  tokens: NativeSourceWriteContext['tokens'];
}) {
  const current = prepareReactCallerNativePlan(input);
  if (current.revision !== input.expectedPlanRevision ||
      canonicalJson(current.plan.tokenInput) !== canonicalJson(input.tokens.input))
    throw Error('react-caller-native-plan-write-stale');
  const { native, parent, engine } = compile(input);
  return { planRevision: current.revision, script: engine.buildNativeContractGraphDraftScript(
    parent, native.scoped.contracts, input.source, { operation: input.operation, tokens: input.tokens }, input.graphVerification,
  ) };
}
