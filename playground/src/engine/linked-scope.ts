/**
 * LINKED-CHILD TOKEN SCOPE (dump v1.5 linking, cross-import) — rendering a
 * contract that LINKS to components imported earlier pulls each linked
 * contract's OWN import token layers (minted imported.* + captured Figma
 * variables) into scope, labeled in receipts.
 *
 * The field failure this retires: import Button-Brand Primary (its
 * typography mints imported.button-brand-primary.button.font-size.large —
 * fontSize is not variable-bindable, so it always mints), then import Dialog
 * in the same session. Session linking correctly links the Dialog's action
 * button to ds.button-brand-primary — and the CANVAS preview refused:
 * 'Cannot resolve token "imported.button-brand-primary.button.font-size.
 * large"'. Root cause: the composite batch carried earlier imports' minted
 * layers only as CSS TEXT into the preview/canvas documents
 * (sessionMintedCss) — a var(--…) channel — while the figma engine
 * (compileComponentData) resolves typography/geometry LITERALS through the
 * token TREE it was created over, and the active token source composes only
 * the ON-SCREEN contract's minted+captured layers (token-source.ts is
 * per-loaded-contract by design). The linked child's tree channel was never
 * composed anywhere.
 *
 * This module is the one composition rule, PURE (node-runnable — the
 * cross-import receipt replays it headlessly): given the contract on screen,
 * the contract scope, and the session's per-contract import layers, walk the
 * composition graph and return
 *   · the linked contracts' DTCG trees (minted + captured) to merge UNDER
 *     the active semantic layer (active/base wins on collision — captured
 *     names the base inventory already defines are PRUNED, the
 *     composeCaptured shadow rule, and named in the receipt line),
 *   · the minted trees alone (the figma-script preamble upserts exactly
 *     these — captured variables are the origin file's REAL variables and
 *     must never be re-upserted),
 *   · one receipt line per linked contract with layers:
 *     "resolving through Button-Brand Primary's imported tokens — N …".
 *
 * Consumers: canvas-preview.ts (engine token tree + fidelity notes),
 * Playground.tsx emitted outputs (react / html / react-inline / figma-script
 * emitter ctx.tokens + mintedTokens), preview.ts (the CSS channel rides
 * sessionImportCss, which covers ALL session layers).
 */
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

/** Nested DTCG tree from captured entries at `paths` only (the token-source
 *  capturedTree shape — value + type, modes elided: linked-child resolution
 *  is the consuming-mode value, same as the layer's own registration). */
function capturedTreeAt(
  entries: Array<{ path: string; value: string; type: string }>,
  paths: Set<string>,
): Record<string, unknown> {
  const tree: Record<string, unknown> = {};
  for (const e of entries) {
    if (!paths.has(e.path)) continue;
    const segs = e.path.split('.');
    let node = tree;
    for (const seg of segs.slice(0, -1)) node = (node[seg] ??= {}) as Record<string, unknown>;
    node[segs[segs.length - 1]] = { $value: e.value, $type: e.type };
  }
  return tree;
}

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
      const registrable = layers.captured.entries.filter((e) => !baseInventory.has(e.path));
      shadowedCount = layers.captured.entries.length - registrable.length;
      if (registrable.length > 0) {
        const paths = new Set(registrable.map((e) => e.path));
        scope.trees.push(capturedTreeAt(layers.captured.entries, paths));
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
  return {
    ...tree,
    semantic: mergeTrees([...scope.trees, tree.semantic as Record<string, unknown>]),
  };
}
