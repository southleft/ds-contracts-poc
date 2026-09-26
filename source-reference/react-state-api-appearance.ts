import { revisionOf } from '../core/contract-provenance.js';
import { walkAnatomy, type Contract } from '../scripts/contract-schema.js';
import type { ReactInitialInspection } from './react-initial-inspection.js';

/** The host reopens the appearance from sealed source observations. Prefer its
 * authored graph and never silently substitute a flattened draft. This only
 * admits an appearance to a separately observed state experiment. */
export function reactStateApiAppearance(initial: ReactInitialInspection): {
  contract: Contract; contracts: Contract[]; tokens: Record<string, unknown>;
  assets: Array<[string, string]>; authored: boolean;
} {
  if (initial.authoredDraft || initial.authoredOrigins || initial.authoredProblem) {
    const draft = initial.authoredDraft;
    if (initial.authoredProblem || draft?.status !== 'native-compiled' || draft.problems.length ||
        !draft.contract || !draft.contracts?.length || !draft.tokens)
      throw Error('state-api-authored-appearance-unavailable');
    const contracts = new Map(draft.contracts.map(c => [c.id, c]));
    if (contracts.size !== draft.contracts.length || new Set(draft.contracts.map(c => c.name)).size !== contracts.size ||
        revisionOf(contracts.get(draft.contract.id)) !== revisionOf(draft.contract) ||
        draft.boundaries.length !== contracts.size || new Set(draft.boundaries.map(b => b.contractId)).size !== contracts.size ||
        draft.boundaries.some(b => !contracts.has(b.contractId)) ||
        draft.boundaries.filter(b => b.path === '' && b.contractId === draft.contract!.id).length !== 1)
      throw Error('state-api-authored-graph-inconsistent');
    // Context components are appearances in the parent's exact input domain,
    // not independently discovered public state APIs. Require identity edges
    // throughout the graph before routing runtime state along them.
    for (const c of contracts.values()) {
      if (revisionOf(c.props) !== revisionOf(draft.contract.props) || c.events?.length || c.bindings.code.runtime)
        throw Error('state-api-authored-context-domain-unqualified');
      for (const { part } of walkAnatomy(c)) if (part.component) {
        if (!contracts.has(part.component.id) || part.component.initialProps ||
            revisionOf(part.component.props) !== revisionOf(Object.fromEntries(c.props.map(p => [p.name, '{' + p.name + '}']))))
          throw Error('state-api-authored-forwarding-unqualified');
      }
    }
    const visiting = new Set<string>(), reached = new Set<string>();
    const visit = (id: string) => {
      if (visiting.has(id)) throw Error('state-api-authored-cycle');
      if (reached.has(id)) return;
      visiting.add(id);
      for (const { part } of walkAnatomy(contracts.get(id)!)) if (part.component) visit(part.component.id);
      visiting.delete(id); reached.add(id);
    };
    visit(draft.contract.id);
    if (reached.size !== contracts.size) throw Error('state-api-authored-disconnected-graph');
    return { contract: draft.contract, contracts: draft.contracts, tokens: draft.tokens, assets: draft.assets ?? [], authored: true };
  }
  const compiled = initial.draft?.compiled;
  if (initial.draft?.status !== 'compiled-draft' || !compiled?.contract || !compiled.tokens)
    throw Error('state-api-source-evidence-incomplete');
  return { contract: compiled.contract, contracts: [compiled.contract], tokens: compiled.tokens, assets: compiled.assets ?? [], authored: false };
}
