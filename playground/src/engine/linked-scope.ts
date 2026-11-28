/** Shared token scope for linked contracts. Verified native graphs retain
 * their aliases and provenance; conflicting imported owners are refused. */
import { treeFromEntries } from '../../../core/captured-tokens.js';
import { applyCapturedAliasTrees } from '../../../core/captured-aliases.js';
import type { Contract } from '../../../core/index.js';
import { walkAnatomy } from '../../../scripts/contract-schema.js';
import type { TokenTreeInput } from '../../../core/index.js';
import type { SessionEntryLayers } from './session-registry.js';

export interface LinkedImportScope {
  /** DTCG trees (minted + shadow-pruned captured), link-discovery order —
   *  merge these UNDER the active semantic slot so the active source wins. */
  trees: Array<Record<string, unknown>>;
  /** Minted trees only — for the figma-script variable-upsert preamble. */
  mintedTrees: Array<Record<string, unknown>>;
  /** Token paths the linked layers add (inventory additions). */
  paths: Set<string>;
  /** One line per linked contract whose layers joined the scope. */
  receipts: string[];
}

const EMPTY_SCOPE: LinkedImportScope = { trees: [], mintedTrees: [], paths: new Set(), receipts: [] };

/** Flat dot-paths of every $value leaf in a DTCG tree. */
function leafPaths(tree: Record<string, unknown>, prefix = '', out: string[] = []): string[] {
  for (const [k, v] of Object.entries(tree)) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    const path = prefix ? `${prefix}.${k}` : k;
    if ('$value' in (v as Record<string, unknown>)) out.push(path);
    else leafPaths(v as Record<string, unknown>, path, out);
  }
  return out;
}

/** Deep-merge DTCG documents, later documents winning on conflicts (the
 *  token-source mergeTrees rule, exported here for scope consumers). */
export function mergeTrees(docs: Array<Record<string, unknown>>): Record<string, unknown> {
  const merge = (a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = { ...a };
    for (const [k, v] of Object.entries(b)) {
      const prev = out[k];
      out[k] =
        prev && v && typeof prev === 'object' && typeof v === 'object' && !Array.isArray(prev) && !Array.isArray(v)
          ? merge(prev as Record<string, unknown>, v as Record<string, unknown>)
          : v;
    }
    return out;
  };
  return docs.reduce(merge, {});
}

/**
 * The linked-child token scope for `contract` over `contracts` (the render
 * scope: repo + session + stubs + the contract itself). PURE — the session
 * wrapper lives in session-registry consumers; receipts replay this exact
 * function.
 *
 * `baseInventory` is the ACTIVE source's token-path inventory (base + the
 * on-screen contract's own layers): a linked CAPTURED name it already
 * defines is pruned (base wins — never silently overridden); minted
 * imported.* namespaces are per component and cannot collide across
 * different contracts (MINT_NAMESPACE invariant), so minted trees ride
 * whole.
 */
export function linkedImportScope(
  contract: Contract,
  contracts: Map<string, Contract>,
  layersByContractId: Map<string, SessionEntryLayers>,
  baseInventory: Set<string>,
): LinkedImportScope {
  if (layersByContractId.size === 0) return EMPTY_SCOPE;
  // Reachable linked contract ids, discovery order (composition refs, slot
  // defaultContent, repeat templates ride part.component), transitively.
  const reached: string[] = [];
  const seen = new Set<string>([contract.id]);
  const visit = (c: Contract) => {
    for (const w of walkAnatomy(c)) {
      const ids: string[] = [];
      if (w.part.component) ids.push(w.part.component.id);
      for (const item of w.part.slot?.defaultContent ?? []) ids.push(item.id);
      for (const id of ids) {
        if (seen.has(id)) continue;
        seen.add(id);
        reached.push(id);
        const dep = contracts.get(id);
        if (dep) visit(dep);
      }
    }
  };
  visit(contract);

  const scope: LinkedImportScope = { trees: [], mintedTrees: [], paths: new Set(), receipts: [] };
  for (const id of reached) {
    const layers = layersByContractId.get(id);
    if (!layers) continue;
    let mintedCount = 0;
    let capturedCount = 0;
    let shadowedCount = 0;
    if (layers.minted && layers.minted.count > 0) {
      scope.trees.push(layers.minted.tree);
      scope.mintedTrees.push(layers.minted.tree);
      const paths = leafPaths(layers.minted.tree);
      mintedCount = paths.length;
      for (const p of paths) scope.paths.add(p);
    }
    if (layers.captured && layers.captured.count > 0) {
      const registrable = layers.captured.entries.filter((e) => e.source || !baseInventory.has(e.path));
      shadowedCount = layers.captured.entries.length - registrable.length;
      if (registrable.length > 0) {
        const paths = new Set(registrable.map((e) => e.path));
        scope.trees.push(treeFromEntries(registrable));
        capturedCount = registrable.length;
        for (const p of paths) scope.paths.add(p);
      }
    }
    const total = mintedCount + capturedCount;
    if (total === 0) continue;
    const pieces = [
      ...(mintedCount > 0 ? [`${mintedCount} minted`] : []),
      ...(capturedCount > 0 ? [`${capturedCount} captured variable${capturedCount === 1 ? '' : 's'}`] : []),
    ];
    scope.receipts.push(
      `resolving through ${layers.name}'s imported tokens — ${total} (${pieces.join(' + ')})${
        shadowedCount > 0
          ? `; ${shadowedCount} captured name${shadowedCount === 1 ? '' : 's'} already defined by the active source (base wins, never overridden)`
          : ''
      }`,
    );
  }
  return scope.receipts.length > 0 ? scope : EMPTY_SCOPE;
}

/** The active token tree with the linked scope merged UNDER its semantic
 *  slot — linked trees first, the active semantic last, so the active source
 *  (base + the on-screen contract's own layers) wins every collision. */
export function applyLinkedScope(tree: TokenTreeInput, scope: LinkedImportScope): TokenTreeInput {
  if (scope.trees.length === 0) return tree;
  const owned = applyCapturedAliasTrees(tree, scope.trees);
  return {
    ...owned,
    semantic: mergeTrees([...scope.trees, owned.semantic as Record<string, unknown>]),
  };
}
