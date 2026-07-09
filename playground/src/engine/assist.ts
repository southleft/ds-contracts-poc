/**
 * Assist client — the playground's line to workers/assist (a Cloudflare
 * Worker holding a server-side Anthropic key for three narrow, tool-forced
 * tasks). Everything it returns is a PROPOSAL the UI labels ai-proposed; the
 * contract schema and token referee remain the only gate.
 *
 * Error discipline: the Worker's own messages are NAMED and user-facing
 * (429 budget/limit, 503 kill switch) — render them VERBATIM. The one case
 * the Worker cannot name for us is the CORS gate itself: it is Origin-gated
 * to the deployed playground (and *.pages.dev previews), so a localhost dev
 * session gets an opaque 403/network failure unless the Worker is deployed
 * with ASSIST_DEV_ORIGIN — that condition is named HERE.
 *
 * The transport is injectable two ways: a `fetchImpl` argument (unit-style),
 * and a `window.__ASSIST_FETCH__` override (the Playwright seam — lets a
 * browser test replay recorded worker responses through the identical UI
 * code path, the same pattern as the Describe tab's demo transport).
 */

export const ASSIST_BASE_URL = 'https://ds-contracts-assist.southleft-llc.workers.dev';

export type FetchLike = typeof fetch;

/** The names the client adds (the Worker's own messages pass through verbatim). */
export const ASSIST_ORIGIN_NOTE =
  'assist-origin-refused: the assist Worker only answers the deployed playground origin ' +
  '(and *.pages.dev previews). From a local dev server it refuses unless the Worker is ' +
  'deployed with ASSIST_DEV_ORIGIN set to your dev origin — see workers/assist/README.md.';

export interface AssistError {
  ok: false;
  /** 0 for network/CORS-level failures (no HTTP status reached us). */
  status: number;
  /** Named, user-facing — the Worker's message verbatim when it sent one. */
  message: string;
}

export type AssistResult<T> = { ok: true; data: T } | AssistError;

declare global {
  interface Window {
    /** Test seam: overrides the assist transport (Playwright mock). */
    __ASSIST_FETCH__?: FetchLike;
  }
}

async function postAssist<T>(
  path: string,
  body: unknown,
  fetchImpl?: FetchLike,
): Promise<AssistResult<T>> {
  const impl: FetchLike =
    fetchImpl ?? (typeof window !== 'undefined' ? window.__ASSIST_FETCH__ : undefined) ?? fetch;
  let res: Response;
  try {
    res = await impl(`${ASSIST_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    // A CORS-refused preflight surfaces as a TypeError with no status — from
    // a dev origin that IS the expected failure, so name it.
    return {
      ok: false,
      status: 0,
      message: `${ASSIST_ORIGIN_NOTE} (network detail: ${e instanceof Error ? e.message : String(e)})`,
    };
  }
  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    /* non-JSON body — fall through to the status-shaped message */
  }
  const workerMessage =
    parsed && typeof parsed === 'object' && typeof (parsed as { error?: unknown }).error === 'string'
      ? ((parsed as { error: string }).error)
      : null;
  if (!res.ok) {
    if (res.status === 403 && !workerMessage) {
      return { ok: false, status: 403, message: ASSIST_ORIGIN_NOTE };
    }
    return {
      ok: false,
      status: res.status,
      message: workerMessage ?? `assist answered ${res.status} with no named message`,
    };
  }
  return { ok: true, data: parsed as T };
}

// ---------------------------------------------------------------------------
// /v1/assist/name-tokens
// ---------------------------------------------------------------------------

export interface AssistRename {
  from: string;
  to: string;
  rationale: string;
}

export interface NameTokensResponse {
  renames: AssistRename[];
  model?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export function assistNameTokens(
  input: {
    component: string;
    entries: Array<{ ref: string; value: string; usageSites: string[] }>;
    existingTokenPaths: string[];
  },
  fetchImpl?: FetchLike,
): Promise<AssistResult<NameTokensResponse>> {
  return postAssist<NameTokensResponse>('/v1/assist/name-tokens', input, fetchImpl);
}

// ---------------------------------------------------------------------------
// /v1/assist/fix-contract — the generator-refusal backfill. The refused
// candidate goes up WITH its named refusals and the active token inventory
// (imported.* included); what comes back is a whole contract that is only
// ever a PROPOSAL — the editor re-referees it, and remaining refusals show.
// ---------------------------------------------------------------------------

/** Mirror of the Describe tab's fix discipline: two user-triggered rounds,
 *  then hand-editing — nothing retries silently. */
export const MAX_AI_FIX_ROUNDS = 2;

/** Worker-enforced request limits (client-checked to refuse by name early). */
export const FIX_CONTRACT_MAX_BYTES = 64 * 1024;
export const FIX_CONTRACT_MAX_REFUSALS = 50;
export const FIX_CONTRACT_MAX_TOKEN_PATHS = 3000;

export interface FixContractResponse {
  contract: unknown;
  model?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export function assistFixContract(
  input: {
    /** The refused candidate (schema-valid but generator-refused), ≤64 KB. */
    contract: object;
    /** The named violations, verbatim from the referee (≤50). */
    refusals: string[];
    /** ACTIVE token inventory incl. imported.* (≤3000 paths). */
    tokenPaths: string[];
  },
  fetchImpl?: FetchLike,
): Promise<AssistResult<FixContractResponse>> {
  return postAssist<FixContractResponse>('/v1/assist/fix-contract', input, fetchImpl);
}

// ---------------------------------------------------------------------------
// /v1/assist/fetch-plan
// ---------------------------------------------------------------------------

export interface AssistFetchPlan {
  fetch: Array<{ path: string; reason: string }>;
  styleSystem: string;
  notes: string[];
}

export function assistFetchPlan(
  input: {
    entryUrl: string;
    listing: Array<{ path: string; size?: number }>;
    alreadyFetched: string[];
    gaps: string[];
    profile?: Record<string, unknown>;
  },
  fetchImpl?: FetchLike,
): Promise<AssistResult<AssistFetchPlan>> {
  return postAssist<AssistFetchPlan>('/v1/assist/fetch-plan', input, fetchImpl);
}

// ---------------------------------------------------------------------------
// /v1/assist/repo-profile — cached per repo@ref for the session (the Worker
// additionally KV-caches it for a week across ALL visitors).
// ---------------------------------------------------------------------------

export interface AssistRepoProfile {
  profile: Record<string, unknown>;
  cached: boolean;
}

const profileSessionKey = (repoUrl: string, ref: string) =>
  `ds-playground.repo-profile:${repoUrl}@${ref}`;

export async function assistRepoProfile(
  input: {
    repoUrl: string;
    ref: string;
    tree: Array<{ path: string; size?: number }>;
    samples: Array<{ path: string; content: string }>;
  },
  fetchImpl?: FetchLike,
): Promise<AssistResult<AssistRepoProfile>> {
  const key = profileSessionKey(input.repoUrl, input.ref);
  try {
    const hit = sessionStorage.getItem(key);
    if (hit) return { ok: true, data: { profile: JSON.parse(hit) as Record<string, unknown>, cached: true } };
  } catch {
    /* storage unavailable — profile just re-fetches */
  }
  const result = await postAssist<AssistRepoProfile>('/v1/assist/repo-profile', input, fetchImpl);
  if (result.ok && result.data.profile) {
    try {
      sessionStorage.setItem(key, JSON.stringify(result.data.profile));
    } catch {
      /* ignore */
    }
  }
  return result;
}
