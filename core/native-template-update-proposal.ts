/** Lossless proposal storage without repeated parent component/receipt copies.
 * All authority still comes from re-deriving the existing guarded writer plan. */
import { canonicalJson, revisionOf } from './contract-provenance.js';
import { prepareNativeTemplateComponentUpdate, type NativeTemplateComponentUpdateInput } from './native-template-value-writer.js';
import type { NativeTemplateConsumerInput } from './native-template-value-consumers.js';
import type { NativeContractComparisonObservationInput } from './native-contract-comparison-observation.js';

type Comparison = NativeContractComparisonObservationInput['comparison'];
type Consumer = {
  input: Omit<NativeContractComparisonObservationInput, 'comparison'> & { comparison: Omit<Comparison, 'parent' | 'receipt'> };
  baseline: Record<string, unknown>;
};
export interface NativeTemplateUpdateProposal {
  version: 1;
  kind: 'native-template-update-proposal';
  input: Omit<NativeTemplateComponentUpdateInput, 'consumers'> & { consumers: Consumer[] };
  planRevision: string;
  revision: string;
}
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);

export function prepareNativeTemplateUpdateProposal(input: NativeTemplateComponentUpdateInput): NativeTemplateUpdateProposal {
  const plan = prepareNativeTemplateComponentUpdate(input);
  const consumers = plan.consumers.map(consumer => {
    const { parent: _parent, receipt: _receipt, ...comparison } = consumer.input.comparison;
    const { parent: _observedParent, ...baseline } = consumer.baseline;
    return { input: { ...consumer.input, comparison }, baseline };
  });
  const body = { version: 1 as const, kind: 'native-template-update-proposal' as const,
    input: { before: plan.before, baseline: plan.baseline, desired: structuredClone(input.desired), consumers }, planRevision: plan.revision };
  return { ...body, revision: revisionOf(body) };
}

/** A digest alone never authenticates a write. The application must separately
 * re-derive this proposal from its source and caller journals before dispatch.
 * This decoder checks only lossless representation and guarded-plan validity. */
export function restoreNativeTemplateUpdateProposal(proposal: NativeTemplateUpdateProposal): NativeTemplateComponentUpdateInput {
  if (!proposal || proposal.version !== 1 || proposal.kind !== 'native-template-update-proposal' ||
      !Array.isArray(proposal.input?.consumers) || proposal.input.consumers.length > 100)
    throw Error('native-template-update-proposal-invalid');
  const { revision, ...body } = proposal;
  if (revision !== revisionOf(body)) throw Error('native-template-update-proposal-changed');
  const input: NativeTemplateComponentUpdateInput = structuredClone({ ...proposal.input,
    consumers: proposal.input.consumers.map(consumer => {
      // A competing parent cannot be silently overwritten during hydration.
      if ('parent' in consumer.input.comparison || 'receipt' in consumer.input.comparison || 'parent' in consumer.baseline)
        throw Error('native-template-update-proposal-redundant-parent');
      return { input: { ...consumer.input, comparison: { ...consumer.input.comparison,
        parent: proposal.input.before, receipt: proposal.input.baseline } },
        baseline: { ...consumer.baseline, parent: proposal.input.baseline } } as NativeTemplateConsumerInput;
    }),
  });
  if (!same(prepareNativeTemplateUpdateProposal(input), proposal)) throw Error('native-template-update-proposal-not-canonical');
  return input;
}
