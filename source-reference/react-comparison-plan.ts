/** A supplemental comparison operation references an existing observed main.
 * The host authenticates all original/content evidence and selects actual props. */
import { canonicalJson, revisionOf } from '../core/contract-provenance.js';
import { createFigmaEngine } from '../core/emit-figma-script.js';
import { prepareNativeContractComparison, type NativeContractComparisonInput } from '../core/native-contract-comparison.js';
import { prepareNativeTokenContext, type NativeTokenContextInput } from '../core/native-token-context.js';
import type { NativeSourceWriteContext } from '../core/native-source-write.js';
import type { NativeContractDraftSource } from '../core/native-contract-draft.js';
import type { Contract } from '../scripts/contract-schema.js';
import type { ObservedContentDraft } from './observed-content.js';
import { flattenTokens } from '../core/tokens.js';

export function reactComparisonVariant(contract: Contract, actualProps: Record<string, unknown>): string {
  const properties = contract.props.map(prop => {
    if (typeof prop.type !== 'object' || !('enum' in prop.type) || prop.bindings.figma.kind !== 'VARIANT' || !prop.bindings.figma.property)
      throw Error('react-comparison-variant-type-unqualified');
    const raw = actualProps[prop.bindings.code.prop];
    const absent = !Object.hasOwn(actualProps, prop.bindings.code.prop) ||
      (raw && typeof raw === 'object' && canonicalJson(raw) === '{"kind":"undefined"}');
    let label: string | undefined;
    if (absent) {
      label = prop.default === undefined ? prop.bindings.figma.unsetValue : prop.bindings.figma.values?.[String(prop.default)] ?? String(prop.default);
    } else {
      // null is a meaningful mapped value; nullish fallback would erase it.
      const exact = prop.type.enum.filter(value => canonicalJson(prop.bindings.code.values && Object.hasOwn(prop.bindings.code.values, value)
        ? prop.bindings.code.values[value] : value) === canonicalJson(raw));
      if (exact.length !== 1) throw Error('react-comparison-variant-value-unqualified');
      label = prop.bindings.figma.values?.[exact[0]] ?? exact[0];
    }
    if (!label) throw Error('react-comparison-variant-omission-unqualified');
    return prop.bindings.figma.property + '=' + label;
  });
  return properties.join(', ') || contract.name;
}
export interface ReactComparisonPlanInput {
  operation: NativeSourceWriteContext['operation'];
  source: NativeContractDraftSource;
  content: ObservedContentDraft;
  comparison: NativeContractComparisonInput;
}
function compiled(input: ReactComparisonPlanInput) {
  const c = input.content;
  if (c.status !== 'compiled-comparison-draft' || c.problems.length || !c.contract || !c.component || !c.tokens || !c.assets)
    throw Error('react-comparison-content-unavailable');
  const engine = createFigmaEngine({ tokens: { primitives: c.tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map(c.assets) });
  const contracts = new Map([[c.contract.id, c.contract]]), data = engine.compileComponentData(c.contract, contracts);
  if (canonicalJson(data) !== canonicalJson(c.component)) throw Error('react-comparison-compiler-changed');
  const comparison = prepareNativeContractComparison(c.contract, data, input.source, revisionOf(c.tokens), { mode: 'light', brand: 'default' }, input.comparison);
  return { engine, contracts, comparison, contract: c.contract, tokens: c.tokens };
}
export function prepareReactComparisonPlan(input: ReactComparisonPlanInput) {
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(input.operation.id) ||
      input.operation.id === input.comparison.parent.operation.id || input.operation.fileKey !== input.comparison.parent.operation.fileKey)
    throw Error('react-comparison-operation-invalid');
  const { comparison, tokens } = compiled(input);
  const tokenInput: NativeTokenContextInput = { fileKey: input.operation.fileKey, scopeId: 'source-' + input.operation.id,
    source: { revision: input.source.revision, sourceProgramSha256: input.source.programSha256, tokensSha256: revisionOf(tokens).slice(7) },
    tokenPaths: [...flattenTokens(tokens).keys()].sort(), modes: [{ sourceMode: 'light', brand: 'default', nativeModeName: 'Light', tokens: structuredClone(tokens), tokenTreeRevision: revisionOf(tokens) }] };
  const plan = { version: 1 as const, kind: 'react-content-comparison' as const, purpose: 'source-candidate-inspection' as const,
    acceptedContract: null, nativeQualification: 'unqualified' as const, operation: { ...input.operation }, comparison,
    contentRevision: revisionOf(input.content), tokenInput, tokenPreparation: prepareNativeTokenContext(tokenInput),
    limitations: [...input.content.limitations, 'native-comparison-not-independently-observed'] };
  return { plan, revision: revisionOf(plan) };
}
export function buildReactComparisonWrite(input: ReactComparisonPlanInput & { expectedPlanRevision: string; tokens: NativeSourceWriteContext['tokens'] }) {
  const planned = prepareReactComparisonPlan(input);
  if (planned.revision !== input.expectedPlanRevision || canonicalJson(planned.plan.tokenInput) !== canonicalJson(input.tokens.input))
    throw Error('react-comparison-write-stale');
  const { engine, contracts, contract } = compiled(input);
  return { planRevision: planned.revision, script: engine.buildNativeContractComparisonScript(contract, contracts, input.source,
    { operation: input.operation, tokens: input.tokens }, input.comparison) };
}
