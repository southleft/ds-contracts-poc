/** Existing caller observations authorize their exact instance subtrees only.
 * Native geometry and visual fidelity still require their separate app proofs. */
import { canonicalJson } from './contract-provenance.js';
import { emitNativeTemplateCallerContentReadback, verifyNativeContractComparisonReadback,
  type NativeContractComparisonObservationInput } from './native-contract-comparison-observation.js';
import { nativeRootTextCallerModes } from './native-root-text-caller.js';
import { verifyNativeContractReadback, type NativeContractObservationInput, type NativeSourceReadback } from './native-source-observation.js';

export interface NativeTemplateConsumerInput {
  input: NativeContractComparisonObservationInput;
  baseline: Record<string, any>;
}
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const clean = (r: NativeSourceReadback) => { const out = structuredClone(r); delete out.images; return out; };
const fail = (reason: string): never => { throw Error('native-template-consumer-' + reason); };

export function prepareNativeTemplateConsumers(before: NativeContractObservationInput, baseline: NativeSourceReadback,
  inputs: NativeTemplateConsumerInput[] = []) {
  if (!Array.isArray(inputs) || inputs.length > 100) fail('inventory');
  const operations = new Set<string>(), pages = new Set<string>(), owned = new Set<string>();
  return inputs.map(consumer => {
    const { input, baseline: observed } = consumer;
    if (!input?.comparison?.textTemplate || !same(input.comparison.parent, before) ||
        !same(clean(input.comparison.receipt), clean(baseline)) ||
        verifyNativeContractComparisonReadback(input, observed).status !== 'supported-comparison-structure-observed') fail('baseline');
    emitNativeTemplateCallerContentReadback(input); // Validate supported reader before native execution.
    if (operations.has(input.operation.id) || pages.has(input.creation.pageId) || input.creation.pageId === before.creation.pageId) fail('duplicate');
    operations.add(input.operation.id); pages.add(input.creation.pageId);
    const nodes = new Map<string, Record<string, any>>(observed.content.nodes.map((n: Record<string, any>) => [n.id, n]));
    const instanceId: string = input.creation.comparisons[0].instanceId, nodeIds: string[] = [];
    const visit = (id: string) => {
      if (owned.has(id) || before.creation.nodes.some((n: {id: string}) => n.id === id)) fail('duplicate');
      const node = nodes.get(id); if (!node) return fail('topology');
      owned.add(id); nodeIds.push(id); node.childIds.forEach(visit);
    };
    visit(instanceId);
    return { input: structuredClone(input), baseline: { ...structuredClone(observed), parent: clean(observed.parent), content: clean(observed.content) },
      instanceId, nodeIds };
  });
}
export type PreparedNativeTemplateConsumer = ReturnType<typeof prepareNativeTemplateConsumers>[number];

/** Derive the caller's expected inherited styles from the new compiled main.
 * Caller text, allocation stamps, local tokens and topology retain their
 * original authority. This does not infer desired styles from the readback. */
export function nativeTemplateConsumerAfter(consumer: PreparedNativeTemplateConsumer,
  after: NativeContractObservationInput, parent: NativeSourceReadback): NativeContractComparisonObservationInput {
  if (!after.templateGraph || verifyNativeContractReadback(after, parent).status !== 'supported-structure-observed') fail('parent-after');
  const input = structuredClone(consumer.input), p = input.comparison;
  if (!same(after.creation, p.parent.creation) || !same(after.operation, p.parent.operation) ||
      !same(after.tokenIdentity, p.parent.tokenIdentity) || !same(after.templateGraph!.identity, p.parent.templateGraph?.identity)) fail('parent-identity');
  let carrier = after.component.variants.find(v => v.name === p.variantName)?.spec;
  for (const index of p.textTemplate!.specPath) carrier = carrier?.children?.[index];
  if (!carrier?.slotTextTemplate || p.specs.length !== 1) fail('carrier');
  const sample = p.specs[0];
  for (const field of ['fontFamily', 'fontStyle', 'fontSize', 'lineHeight', 'letterSpacing', 'textCase', 'textAlignH', 'textDecoration', 'textAutoResize'] as const) {
    if (carrier![field] === undefined) delete sample[field];
    else Object.assign(sample, { [field]: structuredClone(carrier![field]) });
  }
  p.parent = structuredClone(after); p.receipt = clean(parent);
  const modes = nativeRootTextCallerModes(after, p.variantName);
  p.textTemplate = { ...p.textTemplate!, planRevision: after.projection.rootTextTemplate!.revision,
    modeId: modes[after.tokenIdentity.collection.id], modeVector: modes };
  return input;
}

/** Combine independently collected parent/content observations for the existing
 * comparison verifier. A passing result verifies supported structure only. */
export function nativeTemplateConsumerObservation(input: NativeContractComparisonObservationInput,
  parent: NativeSourceReadback, content: NativeSourceReadback) {
  return { version: 1, status: 'native-comparison-readback-collected', operationId: input.operation.id,
    fileKey: input.operation.fileKey, planRevision: input.planRevision, acceptedContract: null,
    nativeQualification: 'unqualified', problems: [], parent: clean(parent), content: clean(content) };
}

export function verifyNativeTemplateConsumersAfter(consumers: PreparedNativeTemplateConsumer[],
  after: NativeContractObservationInput, parent: NativeSourceReadback, contents: NativeSourceReadback[]) {
  const problems: string[] = [];
  const states: NativeTemplateConsumerInput[] = [];
  try {
    if (!Array.isArray(contents) || contents.length !== consumers.length) fail('result-inventory');
    for (const [index, consumer] of consumers.entries()) {
      const input = nativeTemplateConsumerAfter(consumer, after, parent);
      const baseline = nativeTemplateConsumerObservation(input, parent, contents[index]);
      const result = verifyNativeContractComparisonReadback(input, baseline);
      if (result.status !== 'supported-comparison-structure-observed') problems.push(...result.problems);
      else states.push({ input, baseline });
    }
  } catch (error) { problems.push(error instanceof Error ? error.message : 'native-template-consumer-result-invalid'); }
  return { status: problems.length ? 'refused' as const : 'supported-consumer-structure-observed' as const,
    problems, states: problems.length ? [] : states,
    limitations: ['native-computed-geometry-unverified', 'native-visual-fidelity-unverified'] };
}
