/**
 * Shared node-side harness plumbing: the SAME repo data the playground
 * bundles (playground/src/engine/data.ts) and the CLI shells read, loaded
 * from disk; plus the minted-layer composition token-source.ts performs
 * (minted tree deep-merged into the semantic slot, inventory extended).
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import {
  ContractSchema,
  tokenCorpusFromJson,
  tokenInventoryFromJson,
  type Contract,
  type TokenCorpus,
} from '../../../core/index.js';

export const REPO = path.resolve(new URL('../../..', import.meta.url).pathname);
export const MATRIX = path.join(REPO, 'extract', 'fidelity-matrix');

export const readJson = (p: string): unknown => JSON.parse(readFileSync(p, 'utf8'));

export interface RepoData {
  tokens: {
    primitives: Record<string, unknown>;
    semantic: Record<string, unknown>;
    light: Record<string, unknown>;
    dark: Record<string, unknown>;
    brands: Record<string, Record<string, unknown>>;
  };
  inventory: Set<string>;
  corpus: TokenCorpus;
  treesForCode: unknown[];
  contracts: Map<string, Contract>;
  contractIdByName: Map<string, string>;
  icons: Map<string, string>;
  /** src/styles/tokens.css — the preview document's custom-property source. */
  tokensCss: string;
}

export function loadRepoData(): RepoData {
  const t = (p: string) => readJson(path.join(REPO, 'tokens', p)) as Record<string, unknown>;
  const primitives = t('primitives.tokens.json');
  const semantic = t('semantic.tokens.json');
  const light = t('modes/semantic.light.tokens.json');
  const dark = t('modes/semantic.dark.tokens.json');
  const brands = Object.fromEntries(
    readdirSync(path.join(REPO, 'tokens', 'modes'))
      .filter((f) => /^brand\.[a-z][a-z0-9-]*\.tokens\.json$/.test(f))
      .map((f) => [f.replace(/^brand\.|\.tokens\.json$/g, ''), t(`modes/${f}`)]),
  );
  const contracts = new Map<string, Contract>(
    readdirSync(path.join(REPO, 'contracts'))
      .filter((f) => f.endsWith('.contract.json'))
      .map((f) => ContractSchema.parse(readJson(path.join(REPO, 'contracts', f))))
      .map((c) => [c.id, c]),
  );
  const icons = new Map<string, string>(
    readdirSync(path.join(REPO, 'assets', 'icons'))
      .filter((f) => f.endsWith('.svg'))
      .map((f) => [f.replace(/\.svg$/, ''), readFileSync(path.join(REPO, 'assets', 'icons', f), 'utf8').trim()]),
  );
  return {
    tokens: { primitives, semantic, light, dark, brands },
    inventory: tokenInventoryFromJson([primitives, semantic, light, dark]),
    corpus: tokenCorpusFromJson({ primitives, semantic, light, brandDefault: brands.default ?? {} }),
    treesForCode: [primitives, semantic, light, dark],
    contracts,
    contractIdByName: new Map([...contracts.values()].map((c) => [c.name, c.id])),
    icons,
    tokensCss: readFileSync(path.join(REPO, 'src', 'styles', 'tokens.css'), 'utf8'),
  };
}

/** token-source.ts composeSource, node-side: minted tree rides the semantic
 *  slot (root `imported` — no collision by the MINT_NAMESPACE invariant). */
export function composeMinted(
  data: RepoData,
  minted: { tree: Record<string, unknown>; count: number } | undefined,
): { tokens: RepoData['tokens']; inventory: Set<string> } {
  if (!minted || minted.count === 0) return { tokens: data.tokens, inventory: data.inventory };
  return {
    tokens: { ...data.tokens, semantic: { ...data.tokens.semantic, ...minted.tree } },
    inventory: new Set([...data.inventory, ...tokenInventoryFromJson([minted.tree])]),
  };
}
