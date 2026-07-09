/**
 * Bring-your-own tokens — the ACTIVE token source, swappable at runtime.
 *
 * By default every consumer (contract validation, preview stylesheet, code-
 * import token matching, Figma-import nearest-token suggestions, the inline
 * emitter's literal resolution) runs against the repo's bundled trees. Paste
 * DTCG token JSON and they ALL rebind to the user's tree instead — via the
 * same core functions (tokenInventoryFromJson / tokenCorpusFromJson /
 * tokenIndexFromJson), so a contract referencing repo tokens that the user
 * tree does not define now REFUSES BY NAME. That honesty is the feature.
 *
 * Adapter note: tokenCorpusFromJson expects the repo's four-way split
 * (primitives / semantic / light / brandDefault). A pasted set has no such
 * split, so the documents are deep-merged into ONE combined tree and handed
 * to the corpus as the semantic layer — the layer contracts bind and
 * suggestions prefer — with the other slots empty. Same for the emitters'
 * TokenTreeInput: one modeless tree, so light and dark resolve identically.
 *
 * Session-only by design: the pasted text lives in sessionStorage (this tab,
 * gone on close), never anywhere else.
 */
import { useSyncExternalStore } from 'react';
import {
  flattenTokens,
  mintedTokenCss,
  tokenCorpusFromJson,
  tokenInventoryFromJson,
  type MintedEntry,
  type TokenCorpus,
  type TokenTreeInput,
} from '../../../core/index.js';
import {
  corpus as repoCorpus,
  tokenInventory as repoInventory,
  tokenStylesheets as repoStylesheets,
  tokenTree as repoTree,
  tokenTreesForCode as repoTreesForCode,
} from './data.js';
import { tokenTreeToCss } from './token-css.js';

export interface TokenSource {
  kind: 'repo' | 'user';
  /** Provenance line, shown wherever the source matters. */
  label: string;
  /** EmitterCtx.tokens for every registered emitter. */
  tree: TokenTreeInput;
  /** Token-path inventory — the referee for contract {token.ref}s. */
  inventory: Set<string>;
  /** Corpus for design→contract proposals (nearest-token suggestions). */
  corpus: TokenCorpus;
  /** Trees for the code→contract token index (proposeFromCode ctx.tokens). */
  treesForCode: unknown[];
  /** Preview iframe stylesheets (user sets regenerate base; dark/brands ''). */
  stylesheets: { base: string; dark: string; brands: string };
  /** How many documents the source was built from. */
  docCount: number;
}

export const repoTokenSource: TokenSource = {
  kind: 'repo',
  label: 'repo tokens (bundled tokens/*.tokens.json)',
  tree: repoTree,
  inventory: repoInventory,
  corpus: repoCorpus,
  treesForCode: repoTreesForCode,
  stylesheets: repoStylesheets,
  docCount: 4,
};

export type ApplyTokensResult = { ok: true; source: TokenSource } | { ok: false; errors: string[] };

/** Deep-merge DTCG documents, later documents winning on conflicts. */
function mergeTrees(docs: Record<string, unknown>[]): Record<string, unknown> {
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

/** Parse + validate a paste into a full TokenSource. Errors are NAMED, and
 *  nothing is applied unless the whole set holds together. */
export function buildUserTokenSource(text: string): ApplyTokensResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`Not JSON — ${e instanceof Error ? e.message : String(e)}`] };
  }
  const docs = Array.isArray(parsed) ? parsed : [parsed];
  const errors: string[] = [];
  for (const [i, doc] of docs.entries()) {
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
      errors.push(`Document ${i + 1} is not an object — a DTCG token document is a JSON object of groups and $value leaves`);
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  const trees = docs as Record<string, unknown>[];
  const inventory = tokenInventoryFromJson(trees);
  if (inventory.size === 0) {
    return {
      ok: false,
      errors: ['Not DTCG-shaped: no $value leaves found — tokens must be objects like { "$value": "#dbeafe", "$type": "color" }'],
    };
  }

  const merged = mergeTrees(trees);
  const { css, errors: cssErrors } = tokenTreeToCss(merged);
  if (cssErrors.length > 0) return { ok: false, errors: cssErrors };

  const empty: Record<string, unknown> = {};
  return {
    ok: true,
    source: {
      kind: 'user',
      label: `your tokens (pasted, session-only — ${docs.length} document${docs.length === 1 ? '' : 's'})`,
      // One combined, modeless tree in the semantic slot (see adapter note).
      tree: { primitives: empty, semantic: merged, light: empty, dark: empty, brands: {} },
      inventory,
      corpus: tokenCorpusFromJson({ primitives: empty, semantic: merged, light: empty, brandDefault: empty }),
      treesForCode: [merged],
      stylesheets: { base: css, dark: '', brands: '' },
      docCount: docs.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Minted provisional tokens — an ADDITIONAL layer over the base source.
//
// A degraded Figma import (variables endpoint 403) mints `imported.*` leaves
// (core/mint-tokens.ts) and the proposal binds to them. Registering that tree
// here rebinds EVERY consumer — validation inventory, preview stylesheet,
// emitter trees, the code-import token index — so the degraded import renders
// styled at literal fidelity instead of naked. The layer is per-loaded-
// contract: loading anything else clears or replaces it (Playground calls
// setMintedTokens on every load path), and a workspace entry restores its own.
// ---------------------------------------------------------------------------

export interface MintedTokenLayer {
  tree: Record<string, unknown>;
  count: number;
  entries: MintedEntry[];
}

/** Compose base + minted into the TokenSource every consumer reads. The
 *  minted tree deep-merges into the semantic slot (its root is `imported` —
 *  no semantic group ever collides by the MINT_NAMESPACE invariant). */
function composeSource(base: TokenSource, minted: MintedTokenLayer | null): TokenSource {
  if (!minted || minted.count === 0) return base;
  const semantic = mergeTrees([base.tree.semantic as Record<string, unknown>, minted.tree]);
  return {
    ...base,
    label: `${base.label} + ${minted.count} minted provisional token${minted.count === 1 ? '' : 's'} (imported.*)`,
    tree: { ...base.tree, semantic },
    inventory: new Set([...base.inventory, ...tokenInventoryFromJson([minted.tree])]),
    treesForCode: [...base.treesForCode, minted.tree],
    stylesheets: {
      ...base.stylesheets,
      base: `${base.stylesheets.base}\n/* Minted provisional tokens (imported.*) — literal fidelity, rename against your real tokens. */\n${mintedTokenCss(minted.tree)}`,
    },
  };
}

// ---------------------------------------------------------------------------
// The store — module-level, subscribable (useSyncExternalStore-friendly).
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'ds-playground.user-tokens';

let baseSource: TokenSource = repoTokenSource;
let mintedLayer: MintedTokenLayer | null = null;
let active: TokenSource = repoTokenSource;
const listeners = new Set<() => void>();
const recompose = () => {
  active = composeSource(baseSource, mintedLayer);
};
const notify = () => listeners.forEach((fn) => fn());

export const activeTokens = (): TokenSource => active;

/** The base (repo or user-pasted) source, minted layer excluded — the path
 *  list assist rename suggestions should follow. */
export const baseTokens = (): TokenSource => baseSource;

/** The registered minted layer, if any. */
export const activeMintedTokens = (): MintedTokenLayer | null => mintedLayer;

/** Register (or clear) the minted provisional layer. Playground calls this on
 *  every load path so the layer always belongs to the contract on screen. */
export function setMintedTokens(layer: MintedTokenLayer | null): void {
  const next = layer && layer.count > 0 ? layer : null;
  if (next === mintedLayer) return;
  mintedLayer = next;
  recompose();
  notify();
}

/**
 * Move one minted leaf to a semantic path (the per-row Apply of an assist
 * rename). The value travels: the leaf leaves the minted tree and — unless
 * the base source already defines `toPath` (deduplication) — lands in the
 * layer's tree at the new path, so the composed inventory/stylesheet resolve
 * the renamed ref immediately. Returns a NAMED error instead of guessing.
 */
export function applyMintedRename(
  fromPath: string,
  toPath: string,
): { ok: true; deduped: boolean } | { ok: false; error: string } {
  if (!mintedLayer) return { ok: false, error: 'no minted token layer is active' };
  const flat = flattenTokens(mintedLayer.tree);
  const entry = flat.get(fromPath);
  if (!entry) return { ok: false, error: `"${fromPath}" is not a minted leaf in the active layer` };
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(toPath) || toPath.endsWith('.')) {
    return { ok: false, error: `"${toPath}" is not a valid dot-separated token path` };
  }
  flat.delete(fromPath);
  const deduped = baseSource.inventory.has(toPath);
  if (!deduped) {
    if (flat.has(toPath)) return { ok: false, error: `"${toPath}" already exists in the minted layer with a different origin` };
    flat.set(toPath, entry);
  }
  // Rebuild the layer's tree from the flat map.
  const tree: Record<string, unknown> = {};
  for (const [path, e] of flat) {
    const segs = path.split('.');
    let node = tree;
    for (const seg of segs.slice(0, -1)) node = (node[seg] ??= {}) as Record<string, unknown>;
    node[segs[segs.length - 1]] = { $value: e.value, $type: e.type };
  }
  mintedLayer = {
    tree,
    count: flat.size,
    entries: mintedLayer.entries.map((e) =>
      e.ref === `{${fromPath}}` ? { ...e, ref: `{${toPath}}` } : e,
    ),
  };
  recompose();
  notify();
  return { ok: true, deduped };
}

export function subscribeTokens(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** React binding — any component using this re-renders on source changes. */
export function useTokenSource(): TokenSource {
  return useSyncExternalStore(subscribeTokens, activeTokens);
}

export function applyUserTokens(text: string): ApplyTokensResult {
  const result = buildUserTokenSource(text);
  if (result.ok) {
    baseSource = result.source;
    recompose();
    try {
      sessionStorage.setItem(STORAGE_KEY, text);
    } catch {
      /* storage full/unavailable — the source still applies, just won't survive reload */
    }
    notify();
  }
  return result;
}

export function resetToRepoTokens(): void {
  baseSource = repoTokenSource;
  recompose();
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  notify();
}

/** The raw paste, for rehydrating the editor textarea. */
export function storedUserTokensText(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/**
 * A starter tree for the Tokens rail — deliberately PARTIAL: it covers every
 * token ds.badge references (with values the repo never shipped, so the swap
 * is visible), and nothing else. Load any other contract against it and the
 * generator refuses by name — the honest-degradation demo in one paste.
 */
export const STARTER_USER_TOKENS = `{
  "color": {
    "$type": "color",
    "feedback": {
      "info": { "background": { "$value": "#fce7f3" }, "foreground": { "$value": "#9d174d" } },
      "success": { "background": { "$value": "#dcfce7" }, "foreground": { "$value": "#166534" } },
      "warning": { "background": { "$value": "#fef3c7" }, "foreground": { "$value": "#92400e" } },
      "danger": { "background": { "$value": "#fee2e2" }, "foreground": { "$value": "#991b1b" } },
      "error": { "background": { "$value": "#fee2e2" }, "foreground": { "$value": "#7f1d1d" } }
    }
  },
  "font": {
    "badge": { "size": { "$type": "dimension", "$value": "11px" } },
    "control": {
      "family": { "$type": "fontFamily", "$value": "Georgia, 'Times New Roman', serif" },
      "weight": { "$type": "fontWeight", "$value": 700 }
    }
  },
  "radius": {
    "pill": { "$type": "dimension", "$value": "999px" },
    "badge": { "$type": "dimension", "$value": "{radius.pill}" }
  },
  "space": {
    "$type": "dimension",
    "inset-x": { "sm": { "$value": "12px" } },
    "inset-y": { "sm": { "$value": "4px" } }
  }
}
`;

// Rehydrate a same-session reload (sessionStorage is per-tab). A paste that
// no longer parses is dropped silently — repo tokens are the fallback.
const stored = storedUserTokensText();
if (stored) {
  const result = buildUserTokenSource(stored);
  if (result.ok) {
    baseSource = result.source;
    recompose();
  }
}
