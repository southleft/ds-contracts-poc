import { contractDependencyEdges, type Contract } from '../../../scripts/contract-schema.js';

/** The same dependency edges the generator checks, bounded to the session limit. */
export function reactLibraryFamily(root: Contract, scope: Map<string, Contract>): Contract[] {
  const family = new Map<string, Contract>();
  const visit = (contract: Contract) => {
    if (family.has(contract.id)) return;
    family.set(contract.id, contract);
    if (family.size > 30) throw Error('react-library-family-limit: at most 30 components can be downloaded together.');
    for (const edge of contractDependencyEdges(contract)) {
      const child = scope.get(edge.id);
      if (!child) throw Error(`react-library-dependency-missing: ${edge.id}`);
      visit(child);
    }
  };
  visit(root);
  return [...family.values()];
}
