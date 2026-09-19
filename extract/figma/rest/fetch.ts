/**
 * Thin Figma REST client for the no-plugin import path: figma.com URL + user
 * token → dump v1 (via extract/figma/rest/map.ts).
 *
 * Browser-pure by construction: global `fetch` only (injectable), no node
 * builtins, no process.env at module scope — a playground page can import
 * this directly. The CLI wrapper (extract/figma/rest/cli.ts) owns the
 * filesystem and env concerns.
 *
 * Endpoints (https://www.figma.com/developers/api):
 *   GET /v1/files/:key/nodes?ids=…        node documents + components/styles metadata
 *   GET /v1/files/:key/variables/local    variable id → name + values per mode. Needs a
 *                                         token with the `file_variables:read` scope — a
 *                                         403 naming that scope is a TOKEN defect, not a
 *                                         plan tier; every refusal is a classified
 *                                         DEGRADATION (VariablesRefusal), never an error
 *   GET /v1/files/:key                    full document — only when the URL has no
 *                                         node-id and the target set must be found by name
 */
import {
  mapRestToDump,
  VARIABLES_SCOPE_FIX,
  type MapOptions,
  type MapResult,
  type RestNode,
  type RestNodesResponse,
  type RestVariablesResponse,
  type VariablesUnavailable,
} from './map.js';
import { followInstances, CLOSURE_SET_CAP, type DumpClosure } from './closure.js';

export const FIGMA_API_BASE = 'https://api.figma.com';

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

export interface ParsedFigmaUrl {
  /** The key API calls use — the branch key when the URL is a branch URL. */
  fileKey: string;
  /** The main file's key (differs from fileKey only on branch URLs). */
  mainFileKey: string;
  branchKey?: string;
  /** API-form node id ("123:456") — URLs spell it "123-456". */
  nodeId?: string;
}

/**
 * Accepts the figma.com URL forms that carry a file:
 *   https://www.figma.com/file/:key/:title?node-id=1-23
 *   https://www.figma.com/design/:key/:title?node-id=1-23
 *   https://www.figma.com/design/:key/branch/:branchKey/:title
 *   https://www.figma.com/proto|board/:key/…
 * node-id URL encoding: "1-23" (and %3A) ↔ API "1:23".
 */
export function parseFigmaUrl(url: string): ParsedFigmaUrl {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error(`Not a URL: ${url}`);
  }
  if (!/(^|\.)figma\.com$/.test(u.hostname)) {
    throw new Error(`Not a figma.com URL: ${u.hostname}`);
  }
  const segments = u.pathname.split('/').filter(Boolean);
  const kind = segments[0];
  if (!['file', 'design', 'proto', 'board'].includes(kind) || !segments[1]) {
    throw new Error(
      `Unrecognized figma.com URL shape "/${segments.join('/')}" — expected /file/:key/…, /design/:key/…, /design/:key/branch/:branchKey/…, /proto/:key/… or /board/:key/…`,
    );
  }
  const mainFileKey = segments[1];
  const branchKey = segments[2] === 'branch' && segments[3] ? segments[3] : undefined;
  const rawNodeId = u.searchParams.get('node-id') ?? undefined;
  return {
    fileKey: branchKey ?? mainFileKey,
    mainFileKey,
    ...(branchKey ? { branchKey } : {}),
    ...(rawNodeId ? { nodeId: decodeURIComponent(rawNodeId).replace(/-/g, ':') } : {}),
  };
}

// ---------------------------------------------------------------------------
// Endpoint calls
// ---------------------------------------------------------------------------

export type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  /** Read for `Retry-After` on a 429 only; optional so fixture transports need not carry it. */
  headers?: { get(name: string): string | null };
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

/** A 429 is retried at most this many times, waiting what `Retry-After` says
 *  (5 s when absent) — the same policy extract/figma/visual-truth/rest.mjs and
 *  visual-parity/figma-api.ts apply. The fourth 429 throws like any HTTP error. */
export const MAX_429_RETRIES = 3;
/** The longest single `Retry-After` wait honoured (seconds). A 429 asking for
 *  more REFUSES by name instead of sleeping for an unbounded time (review M4:
 *  Figma answers hours-long Retry-After values on an exhausted plan budget). */
export const MAX_RETRY_AFTER_SECONDS = 60;

export interface ClientOptions {
  /** Injectable for tests / non-browser runtimes. Defaults to global fetch. */
  fetchImpl?: FetchLike;
  apiBase?: string;
  /**
   * ONLY an injected transport (`fetchImpl`) or a non-default `apiBase` reads
   * this. `importFromUrl` records `_provenance.stampsObservable` — "a
   * ds_contracts stamp on this set WOULD have been in the response" — and that
   * is a fact about what ANSWERED the request, not about the query string this
   * module wrote: a fixture transport replays whatever bytes it holds
   * (the repo's own pipeline-written REST fixtures carry no `sharedPluginData`)
   * and used to be reported observable all the same (review, PR 131 M2). A
   * caller that injects the transport must assert the plane itself; default
   * FALSE — fail closed, so an unstamped set is never taken for a designer's
   * on a replay.
   */
  transportCarriesPluginData?: boolean;
  /**
   * Called when the variables endpoint refuses. The refusal is still swallowed
   * (the import degrades, as it always has) but the CALLER can now tell the
   * user-fixable case from the one they cannot fix — see
   * `classifyVariablesRefusal`.
   */
  onVariablesUnavailable?: (info: VariablesRefusal) => void;
  /** Injectable wait for the 429 back-off (tests pass a no-op). */
  sleep?: (ms: number) => Promise<void>;
  /** Where each 429 wait is announced (default: console.error — stderr in the
   *  CLI). Never silent. */
  onRateLimited?: (info: { path: string; attempt: number; waitSeconds: number }) => void;
}

async function get(path: string, token: string, opts: ClientOptions): Promise<unknown> {
  const fetchImpl = opts.fetchImpl ?? (fetch as unknown as FetchLike);
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const call = () =>
    fetchImpl(`${opts.apiBase ?? FIGMA_API_BASE}${path}`, {
      headers: { 'X-Figma-Token': token },
    });
  let res = await call();
  for (let attempt = 0; res.status === 429 && attempt < MAX_429_RETRIES; attempt++) {
    const raw = res.headers?.get('retry-after');
    const retryAfter = Number(raw ?? '5');
    const waitSeconds = Number.isFinite(retryAfter) && retryAfter >= 0 ? retryAfter : 5;
    if (waitSeconds > MAX_RETRY_AFTER_SECONDS) {
      const err = new Error(
        `Figma API 429 on ${path} — rate-limit-wait-exceeds-cap: Retry-After ${raw} s is over the ${MAX_RETRY_AFTER_SECONDS} s this import waits (MAX_RETRY_AFTER_SECONDS); refused instead of sleeping — re-run later`,
      );
      (err as Error & { status?: number }).status = 429;
      throw err;
    }
    const announce =
      opts.onRateLimited ??
      ((info: { path: string; attempt: number; waitSeconds: number }) =>
        console.error(`figma API 429 on ${info.path} — waiting ${info.waitSeconds} s (Retry-After), retry ${info.attempt} of ${MAX_429_RETRIES}`));
    announce({ path, attempt: attempt + 1, waitSeconds });
    await sleep(waitSeconds * 1000);
    res = await call();
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Figma API ${res.status} on ${path}${body ? ` — ${body.slice(0, 200)}` : ''}`);
    (err as Error & { status?: number; body?: string }).status = res.status;
    (err as Error & { status?: number; body?: string }).body = body;
    throw err;
  }
  return res.json();
}

export async function fetchNodes(
  fileKey: string,
  nodeIds: string[],
  token: string,
  opts: ClientOptions = {},
): Promise<RestNodesResponse> {
  const ids = encodeURIComponent(nodeIds.join(','));
  // `plugin_data=shared` rides every node fetch (dump v1.32): the response
  // then carries `sharedPluginData` — the ds_contracts stamps this pipeline
  // writes at emit time (contractId/specHash/version/propNames/semantics/
  // statePreviewAxis + the per-TEXT fontWeightVar/lineHeightVar token names).
  // Without it a REST dump of a stamped set forgets its own identity and
  // exact-mode proposal is impossible on this route.
  return (await get(`/v1/files/${fileKey}/nodes?ids=${ids}&plugin_data=shared`, token, opts)) as RestNodesResponse;
}

/**
 * Why the variables endpoint refused, and — the part that matters — whether
 * the person running the import can do anything about it.
 */
export interface VariablesRefusal extends VariablesUnavailable {
  status: number;
  /**
   * `scope`   — the token is missing `file_variables:read`. USER-FIXABLE: mint
   *             a new PAT with that scope ticked.
   * `unknown` — a 403 that names no scope, or a 404. Not user-fixable from
   *             here; the plan tier is one candidate cause and it is NOT
   *             something this code has verified (see below).
   * `network` — no HTTP status at all: fetch itself threw (DNS, offline,
   *             CORS). Not a refusal by Figma; the import continues degraded
   *             and the nodes fetch decides whether anything reaches at all.
   */
  kind: 'scope' | 'unknown' | 'network';
  userFixable: boolean;
  /** Ready to print at a CLI. */
  message: string;
  /** The one-line remedy (scope: VARIABLES_SCOPE_FIX), null when none. */
  fix: string | null;
  /** The API's own words, truncated — never paraphrased away. */
  body: string;
}

/**
 * MEASURED 2026-08-04, and the reason this function exists.
 *
 * The old comment above `fetchVariables` said the endpoint is "Enterprise-only"
 * and that "a 403 (plan) or 404 is the EXPECTED degraded path". A real call was
 * made with this repo's own PAT against this repo's own file:
 *
 *   GET https://api.figma.com/v1/files/8nim1d0IPnehMxA7B7SYxC/variables/local
 *   → 403
 *   {"status":403,"error":true,"message":"Invalid scope(s): files:read,
 *    file_comments:write, file_dev_resources:read, file_dev_resources:write,
 *    webhooks:write. This endpoint requires the file_variables:read scope"}
 *
 * (Control, same token, same file: GET /v1/files/:key → 200. The credential is
 * good; only the SCOPE is missing.)
 *
 * That is not a plan refusal. It is a token the user minted without ticking
 * one checkbox, and they can fix it in about a minute — but the old code
 * degraded it identically to every other 403 and said nothing, so nobody ever
 * learned that. Hence `kind: 'scope'` and `userFixable: true`.
 *
 * WHAT IS NOT CLAIMED. This does NOT establish that the plan limit is
 * fictional. Whether a PAT that DOES carry `file_variables:read` then succeeds
 * on a non-Enterprise file is UNTESTED — it needs a human to mint a scoped
 * token. docs/HANDOFF.md carries that one-curl probe, and its two outcomes
 * fork the design. Until someone runs it, a 403 with no scope wording stays
 * `kind: 'unknown'` and this file does not guess why.
 */
export function classifyVariablesRefusal(status: number, body: string): VariablesRefusal {
  const b = body ?? '';
  // Match on the scope the endpoint NAMES, not on the word "scope" alone —
  // "Invalid scope(s): …" also appears in the same body, and a future error
  // that merely mentions scopes must not be read as this one.
  if (status === 403 && /file_variables:read/.test(b)) {
    return {
      status,
      kind: 'scope',
      userFixable: true,
      message:
        'Figma refused /variables/local: your personal access token is missing the ' +
        '`file_variables:read` scope (HTTP 403 — a token scope, NOT a plan limit). This is fixable — mint a new token at ' +
        'figma.com → Settings → Security → Personal access tokens with "Variables: read" ' +
        'enabled, and re-run. (Variable NAMES will be unresolved until you do; the import ' +
        'still works, using resolved values.)',
      fix: VARIABLES_SCOPE_FIX,
      body: b.slice(0, 300),
    };
  }
  return {
    status,
    kind: 'unknown',
    userFixable: false,
    message:
      `Figma refused /variables/local with ${status} and did not name a missing scope. ` +
      'Possible causes include the file\'s plan tier — UNVERIFIED by this project, see ' +
      'docs/HANDOFF.md. Importing without variable names; resolved values are used instead.',
    fix: null,
    body: b.slice(0, 300),
  };
}

/** A thrown fetch (no HTTP status: DNS, offline, CORS) on the variables
 *  endpoint — named as NETWORK, the third cause the Phase 2 exam asked to be
 *  told apart from "scope" and "plan". */
export function classifyVariablesNetworkFailure(err: unknown): VariablesRefusal {
  const detail = err instanceof Error ? err.message : String(err);
  return {
    status: 0,
    kind: 'network',
    userFixable: false,
    message:
      `Figma /variables/local could not be reached (${detail}) — not a refusal by Figma; ` +
      'importing without variable names; re-run when the API is reachable.',
    fix: 're-run when api.figma.com is reachable',
    body: '',
  };
}

/**
 * Local variables. A 403 or 404 is a DEGRADATION, not a failure: this returns
 * undefined and the mapper names every consequence as a variable-unresolved
 * report entry with the resolved value used instead.
 *
 * The two 403s are no longer identical. `opts.onVariablesUnavailable` receives
 * a classified refusal so a caller can tell the user "tick one checkbox on
 * your token" instead of silently dropping variable names — see
 * `classifyVariablesRefusal` for the measurement behind that split.
 */
export async function fetchVariables(
  fileKey: string,
  token: string,
  opts: ClientOptions = {},
): Promise<RestVariablesResponse | undefined> {
  try {
    return (await get(`/v1/files/${fileKey}/variables/local`, token, opts)) as RestVariablesResponse;
  } catch (e) {
    const err = e as Error & { status?: number; body?: string };
    if (err.status === 403 || err.status === 404) {
      opts.onVariablesUnavailable?.(classifyVariablesRefusal(err.status, err.body ?? err.message ?? ''));
      return undefined;
    }
    if (err.status === undefined) {
      // fetch threw before any HTTP status existed — the network, not Figma.
      // A 5xx (status present) still THROWS (variables-refusal-check §6).
      opts.onVariablesUnavailable?.(classifyVariablesNetworkFailure(e));
      return undefined;
    }
    throw e;
  }
}

interface RestFileResponse {
  name?: string;
  document?: RestNode;
  components?: Record<string, { name: string; componentSetId?: string; key?: string }>;
  componentSets?: Record<string, { name: string; key?: string }>;
  styles?: Record<string, { name: string; styleType?: string }>;
}

export async function fetchFile(fileKey: string, token: string, opts: ClientOptions = {}): Promise<RestFileResponse> {
  return (await get(`/v1/files/${fileKey}?plugin_data=shared`, token, opts)) as RestFileResponse;
}

// ---------------------------------------------------------------------------
// URL → dump
// ---------------------------------------------------------------------------

export interface ImportOptions extends ClientOptions {
  /** Set/component name to map when the URL has no node-id (or to filter). */
  target?: string;
  /**
   * Follow the instances (docs/23 §D.43): every same-file component set an
   * INSTANCE in the imported set references is fetched — transitively, in
   * further /nodes rounds — and mapped into the same dump, so the proposer
   * resolves it to a real contract instead of a stub. The `extract:figma:rest`
   * CLI turns this ON by default (`--no-closure` turns it off); a library
   * caller opts in, so every fixture-backed caller keeps its bytes and its
   * request count. `cap` bounds the pulled sets (default CLOSURE_SET_CAP).
   */
  closure?: boolean | { cap?: number };
}

const findSets = (node: RestNode, out: RestNode[] = []): RestNode[] => {
  if (node.type === 'COMPONENT_SET' || node.type === 'COMPONENT') {
    // Variants live inside their set; the set is the unit.
    out.push(node);
    if (node.type === 'COMPONENT_SET') return out;
  }
  for (const child of node.children ?? []) findSets(child, out);
  return out;
};

/**
 * The whole no-plugin path: parse the URL, pull the component set, tolerate
 * the variables endpoint being unavailable, and map to dump v1 + MapReport.
 */
/** Whether a read through `opts` could have SEEN a ds_contracts stamp. */
export const stampsObservableOn = (opts: ClientOptions): boolean =>
  opts.fetchImpl === undefined && opts.apiBase === undefined ? true : opts.transportCarriesPluginData === true;

export async function importFromUrl(url: string, token: string, opts: ImportOptions = {}): Promise<MapResult> {
  const parsed = parseFigmaUrl(url);
  // The classified refusal reaches BOTH the caller's callback and the mapper
  // (Phase 2 exam: cli.ts never wired the callback, and the mapper had no
  // way to learn the cause — so 1,595 rows said "Enterprise").
  let refusal: VariablesRefusal | undefined;
  const variables = await fetchVariables(parsed.fileKey, token, {
    ...opts,
    onVariablesUnavailable: (info) => {
      refusal = info;
      opts.onVariablesUnavailable?.(info);
    },
  });
  const mapOptions: MapOptions = {
    ...(variables ? { variables } : {}),
    ...(refusal ? { variablesUnavailable: refusal } : {}),
    ...(opts.target ? { target: opts.target } : {}),
    fileKey: parsed.fileKey,
    // fetchNodes and fetchFile (below) both request `plugin_data=shared`, so a
    // stamp on any set WOULD be in these responses — said here because the
    // mapper cannot see the request. True only when the REAL transport answered
    // the REAL API; an injected one must assert it (transportCarriesPluginData).
    ...(stampsObservableOn(opts) ? { stampsObservable: true } : {}),
  };

  const withClosure = async (first: RestNodesResponse, requestedIds: string[]): Promise<MapResult> => {
    if (!opts.closure) return mapRestToDump(first, mapOptions);
    const cap = typeof opts.closure === 'object' && opts.closure.cap !== undefined ? opts.closure.cap : CLOSURE_SET_CAP;
    const { response, closure } = await followInstances(
      first,
      requestedIds,
      (ids) => fetchNodes(parsed.fileKey, ids, token, opts),
      { cap },
    );
    return mapRestToDump(response, { ...mapOptions, closure });
  };

  if (parsed.nodeId) {
    const nodes = await fetchNodes(parsed.fileKey, [parsed.nodeId], token, opts);
    return withClosure(nodes, [parsed.nodeId]);
  }

  // No node-id: fetch the document and synthesize a nodes-response around the
  // sets found (by name when a target is given, all sets otherwise).
  const file = await fetchFile(parsed.fileKey, token, opts);
  if (!file.document) throw new Error(`GET /v1/files/${parsed.fileKey} returned no document`);
  const sets = findSets(file.document).filter((s) => (opts.target ? s.name === opts.target : true));
  if (sets.length === 0) {
    throw new Error(
      opts.target
        ? `No COMPONENT_SET or COMPONENT named "${opts.target}" in ${file.name ?? parsed.fileKey} — pass a node-id URL or a valid --target`
        : `No COMPONENT_SET or COMPONENT in ${file.name ?? parsed.fileKey}`,
    );
  }
  const synthesized: RestNodesResponse = {
    name: file.name,
    nodes: Object.fromEntries(
      sets.map((s) => [
        s.id,
        { document: s, components: file.components, componentSets: file.componentSets, styles: file.styles },
      ]),
    ),
  };
  return withClosure(synthesized, sets.map((s) => s.id));
}

export type { DumpClosure };
