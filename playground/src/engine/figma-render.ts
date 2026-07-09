/**
 * Figma ground truth — the imported node's OWN render, fetched from the
 * images API (GET /v1/images/:fileKey?ids=:nodeId&format=png&scale=2).
 *
 * Where the anchor lives: every Figma-imported contract carries
 * `anchors.figma.{fileKey,nodeId}` (core/propose-figma.ts writes them from
 * the dump's _provenance + set nodeId), and the workspace entry's
 * contractText carries the anchors with it — nothing extra to store.
 *
 * Token handling: the personal access token is SESSION-ONLY state by
 * default, exactly like the Figma tab's field — remembered here (module
 * memory) when an import succeeds, sent to api.figma.com and nowhere else,
 * gone on reload. The one exception is the visitor's own opt-in: a token
 * remembered via "Remember on this device" (engine/remembered-tokens.ts,
 * localStorage) stands in when the session has none. When neither exists,
 * the panel says so and asks for a re-import; it never nags for a token of
 * its own.
 *
 * CORS: the images API answers JSON with a short-lived S3 URL; the PNG
 * itself loads via a plain <img src>, which needs no CORS grant.
 *
 * The demo transport: the committed fixture import has no real token, so
 * its "render" is a recorded fixture — a REAL images-API render of the
 * fixture file's Badge set, captured once and committed
 * (fixtures/badge.figma-render.png). Same philosophy as the REST demo:
 * identical semantics, fixture transport, named as such.
 */
import { FIGMA_API_BASE } from '../../../extract/figma/rest/fetch.js';
import { FIGMA_TOKEN_STORAGE_KEY, readRememberedToken } from './remembered-tokens.js';
import demoRenderUrl from './fixtures/badge.figma-render.png';

/** The marker the demo import remembers instead of a real token. */
export const DEMO_SESSION_TOKEN = 'demo-fixture-token';
/** The committed REST fixture's file (extract/figma/rest/fixtures). */
export const DEMO_FILE_KEY = '8nim1d0IPnehMxA7B7SYxC';

// ---------------------------------------------------------------------------
// Session token — module memory only, by design
// ---------------------------------------------------------------------------

let sessionToken: string | null = null;

/** Remember the token a successful import used. A real token always outranks
 *  the demo marker; nothing is ever written to storage. */
export function rememberFigmaSession(token: string): void {
  const t = token.trim();
  if (!t) return;
  if (t === DEMO_SESSION_TOKEN && sessionToken && sessionToken !== DEMO_SESSION_TOKEN) return;
  sessionToken = t;
}

export function figmaSessionToken(): string | null {
  // A token remembered on this device (opt-in "Remember on this device",
  // engine/remembered-tokens.ts) stands in when the session has none — so
  // ground truth works across reloads for visitors who opted in. A live
  // session token (a real import this session) still outranks it.
  if (sessionToken && sessionToken !== DEMO_SESSION_TOKEN) return sessionToken;
  return readRememberedToken(FIGMA_TOKEN_STORAGE_KEY) ?? sessionToken;
}

// ---------------------------------------------------------------------------
// The images API call
// ---------------------------------------------------------------------------

export type FigmaRenderResult =
  | { ok: true; url: string; note: string | null }
  | { ok: false; error: string };

/** Successful renders cache for the session — the S3 URL stays valid far
 *  longer than a tab lives; errors are never cached (retry must retry). */
const renderCache = new Map<string, { url: string; note: string | null }>();

export async function fetchFigmaRender(
  fileKey: string,
  nodeId: string,
  token: string,
): Promise<FigmaRenderResult> {
  if (token === DEMO_SESSION_TOKEN) {
    if (fileKey === DEMO_FILE_KEY) {
      return {
        ok: true,
        url: demoRenderUrl,
        note: 'recorded fixture — a real images-API render of the fixture file’s Badge set, captured and committed; with a session token this panel fetches live.',
      };
    }
    return {
      ok: false,
      error:
        'demo-session-only: the fixture transport has no recorded render for this file — import with a real token to fetch live ground truth.',
    };
  }

  const cacheKey = `${fileKey}::${nodeId}`;
  const cached = renderCache.get(cacheKey);
  if (cached) return { ok: true, ...cached };

  const path = `/v1/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=png&scale=2`;
  let res: { ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> };
  try {
    res = await fetch(`${FIGMA_API_BASE}${path}`, { headers: { 'X-Figma-Token': token } });
  } catch (e) {
    return {
      ok: false,
      error: `figma-images-unreachable: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  if (res.status === 429) {
    return {
      ok: false,
      error:
        'figma-images-rate-limited: HTTP 429 — the images API is rate-limited per token; wait a minute and retry.',
    };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return {
      ok: false,
      error: `Figma API ${res.status} on ${path.split('?')[0]}${body ? ` — ${body.slice(0, 200)}` : ''}`,
    };
  }
  const body = (await res.json().catch(() => null)) as {
    err?: string | null;
    images?: Record<string, string | null>;
  } | null;
  if (!body || body.err) {
    return { ok: false, error: `figma-images-error: ${body?.err ?? 'unreadable response body'}` };
  }
  const url = body.images?.[nodeId];
  if (!url) {
    // Real condition, observed: the API answers 200 with images[nodeId]=null
    // when the anchored node no longer exists in the live file.
    return {
      ok: false,
      error: `figma-images-empty: the API answered but rendered nothing for node ${nodeId} — the node may have been deleted or moved since import (the anchor is import-time state). Re-import from the current file to refresh it.`,
    };
  }
  const value = { url, note: null };
  renderCache.set(cacheKey, value);
  return { ok: true, ...value };
}
