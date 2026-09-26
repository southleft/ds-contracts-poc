import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import type { ReactAuthoredSweepDraft } from './react-authored-sweep.js';

/** Allocation names only. The host authenticates the creation archive and
 * proves source identity separately; no old styling is carried into a rebuild. */
export type ReactAuthoredNamespace = ReadonlyMap<string, {
  id: string; name: string; codeAnchors: Contract['bindings']['code']['anchors'];
}>;

export function reactAuthoredNamespace(draft: ReactAuthoredSweepDraft): ReactAuthoredNamespace {
  const fail = (): never => { throw Error('react-authored-namespace-unavailable'); };
  if (draft.status !== 'native-compiled' || draft.problems.length || !draft.contract || !draft.contracts?.length ||
      draft.boundaries.length !== draft.contracts.length) fail();
  const contracts = draft.contracts!.map(c => ContractSchema.parse(c));
  if (new Set(contracts.map(c => c.id)).size !== contracts.length ||
      new Set(contracts.map(c => c.name)).size !== contracts.length ||
      new Set(draft.boundaries.map(b => b.path)).size !== contracts.length ||
      new Set(draft.boundaries.map(b => b.contractId)).size !== contracts.length ||
      draft.boundaries.find(b => b.path === '')?.contractId !== draft.contract!.id) fail();
  return new Map(draft.boundaries.map(boundary => {
    const contract = contracts.find(c => c.id === boundary.contractId) ?? fail();
    return [boundary.path, { id: contract.id, name: contract.name, codeAnchors: structuredClone(contract.bindings.code.anchors) }];
  }));
}
