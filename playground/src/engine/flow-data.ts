/**
 * The walkthrough's committed INPUTS, loaded lazily — none of this is on the
 * playground's first paint. Every import here is a file the repo commits
 * and its own gates read:
 *
 *   - extract/figma/fixtures/main-file-dumps.json — the Badge/Switch/Card
 *     sets this pipeline drew, captured live 2026-07-08 (no dumpVersion, no
 *     stamps: it predates both); extract/figma/roundtrip.ts proposes from it
 *     and writes ROUNDTRIP.md.
 *   - extract/figma/fixtures/flowbite-eight.dump.json — the eight Flowbite
 *     sets, dump v1.30, with propertyDefinitions and the ds_contracts/*
 *     stamps; scripts/flowbite-dump-propose-check.ts pins its proposals.
 *   - examples/tailwind/figma/tailwind.bundle.json — the CONTRACTS-BUNDLE
 *     `ds-contracts figma bundle` wrote for those eight (raw contracts,
 *     token set, icons, codeOnlyFacts); core/code-only-facts-check.ts pins
 *     its per-contract fact counts.
 *   - extract/figma/ROUNDTRIP.md — the generated round-trip receipt the
 *     Adjudicate step replays.
 */
import type { Contract } from '../../../core/index.js';
import roundtripMd from '../../../extract/figma/ROUNDTRIP.md?raw';
import { applyUserTokens, resetToRepoTokens, storedUserTokensText, activeTokens } from './token-source.js';
import { parseContract, type BundleFactRow } from './flow-engine.js';

export { roundtripMd };

export type FixtureDump = Record<string, unknown>;

export async function loadBadgeFixture(): Promise<FixtureDump> {
  const mod = await import('../../../extract/figma/fixtures/main-file-dumps.json');
  return mod.default as FixtureDump;
}

export async function loadFlowbiteEight(): Promise<FixtureDump> {
  const mod = await import('../../../extract/figma/fixtures/flowbite-eight.dump.json');
  return mod.default as FixtureDump;
}

export interface TailwindBundle {
  type: string;
  version: number;
  tokenSet: { name: string; base: Record<string, unknown>; minted: Record<string, unknown> | null };
  icons?: Record<string, string>;
  /** Raw contract documents, exactly as the CLI bundled them. */
  contracts: unknown[];
  codeOnlyFacts: BundleFactRow[];
  /** Schema-parsed twins of `contracts`, by id. */
  contractsById: Map<string, Contract>;
  rawById: Map<string, unknown>;
}

let bundleCache: Promise<TailwindBundle> | null = null;

export function loadTailwindBundle(): Promise<TailwindBundle> {
  if (!bundleCache) {
    bundleCache = import('../../../examples/tailwind/figma/tailwind.bundle.json').then((mod) => {
      const raw = mod.default as unknown as Omit<TailwindBundle, 'contractsById' | 'rawById'>;
      const contractsById = new Map<string, Contract>();
      const rawById = new Map<string, unknown>();
      for (const doc of raw.contracts) {
        const parsed = parseContract(doc);
        contractsById.set(parsed.id, parsed);
        rawById.set(parsed.id, doc);
      }
      return { ...raw, contractsById, rawById };
    });
  }
  return bundleCache;
}

// ---------------------------------------------------------------------------
// The token source a walkthrough step validates against
// ---------------------------------------------------------------------------

/** What the visitor had applied before the walkthrough touched the token
 *  source — restored on exit. `undefined` = nothing touched yet. */
let preTourUserTokens: string | null | undefined;

/** Set while the ACTIVE user-token paste is the walkthrough's own (the
 *  bundle's token set). A reload mid-tour rehydrates that paste from
 *  sessionStorage as if the visitor had made it; this flag keeps it from
 *  being mistaken for theirs and "restored" on exit. */
const TOUR_TOKENS_KEY = 'ds-playground.tour-tokens';
const tourTokensFlag = (on: boolean) => {
  try {
    if (on) sessionStorage.setItem(TOUR_TOKENS_KEY, '1');
    else sessionStorage.removeItem(TOUR_TOKENS_KEY);
  } catch {
    /* storage unavailable — the flag just doesn't survive a reload */
  }
};
const tourTokensActive = () => {
  try {
    return sessionStorage.getItem(TOUR_TOKENS_KEY) === '1';
  } catch {
    return false;
  }
};

const snapshotOnce = () => {
  if (preTourUserTokens === undefined) {
    preTourUserTokens = activeTokens().kind === 'user' && !tourTokensActive() ? storedUserTokensText() : null;
  }
};

/** The repo's own tokens — what contracts/*.contract.json validate against. */
export function useRepoTokensForTour(): void {
  snapshotOnce();
  if (activeTokens().kind !== 'repo') resetToRepoTokens();
  tourTokensFlag(false);
}

/** The bundle's token set (base + minted trees, as two DTCG documents) as the
 *  ACTIVE token source, the way a visitor pasting the Tailwind tree into the
 *  Tokens tab would — the editor referee, the preview and every emitter then
 *  resolve `{imported.*}` refs. */
export function useBundleTokensForTour(bundle: TailwindBundle): { ok: true } | { ok: false; errors: string[] } {
  snapshotOnce();
  const docs = bundle.tokenSet.minted ? [bundle.tokenSet.base, bundle.tokenSet.minted] : [bundle.tokenSet.base];
  const result = applyUserTokens(JSON.stringify(docs, null, 2));
  if (result.ok) tourTokensFlag(true);
  return result.ok ? { ok: true } : { ok: false, errors: result.errors };
}

/** Put back whatever token source was active before the walkthrough. */
export function leaveTourTokens(): void {
  if (preTourUserTokens === undefined) {
    // Nothing snapshotted this page-load, but a reload mid-tour may have
    // left the walkthrough's paste active — clear that too.
    if (tourTokensActive()) resetToRepoTokens();
    tourTokensFlag(false);
    return;
  }
  if (preTourUserTokens === null) resetToRepoTokens();
  else applyUserTokens(preTourUserTokens);
  preTourUserTokens = undefined;
  tourTokensFlag(false);
}
