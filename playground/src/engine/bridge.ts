/**
 * Plugin bridge client — the playground side of "Send to Playground"
 * (workers/assist/src/bridge.ts). The flow:
 *
 *   createBridgeSession() → a 6-char pairing code the visitor types into the
 *   Sync Runner plugin's "Send to Playground" tab → the plugin POSTs the
 *   dump v1 JSON to the bridge → pollBridge(code) picks it up ONCE (the
 *   bridge deletes on delivery; 15-minute TTL either way) → the dump feeds
 *   the SAME proposal path a pasted dump takes. The bridge is transport
 *   only — no new proposal logic lives on either side of it.
 *
 * Error discipline mirrors engine/assist.ts: the Worker's refusals are named
 * and user-facing — render them VERBATIM. The one condition the Worker
 * cannot name is its own origin gate (a localhost dev session needs
 * ASSIST_DEV_ORIGIN on the Worker) — named here.
 *
 * The base URL is the assist Worker (one deployment carries both surfaces);
 * VITE_BRIDGE_BASE_URL overrides it at build time — the seam the end-to-end
 * test uses to point a built playground at `wrangler dev`.
 */
import { ASSIST_BASE_URL } from './assist';

export const BRIDGE_BASE_URL: string =
  (import.meta.env.VITE_BRIDGE_BASE_URL as string | undefined) ?? ASSIST_BASE_URL;

export const BRIDGE_POLL_INTERVAL_MS = 2500;

export const BRIDGE_ORIGIN_NOTE =
  'bridge-origin-refused: the bridge only answers the deployed playground origin ' +
  '(and *.pages.dev previews). From a local dev server it refuses unless the Worker is ' +
  'deployed with ASSIST_DEV_ORIGIN set to your dev origin — see workers/assist/README.md.';

export interface BridgeSession {
  code: string;
  ttlSeconds: number;
}

export type BridgeSessionResult = { ok: true; session: BridgeSession } | { ok: false; message: string };

export type BridgePollResult =
  | { status: 'waiting' }
  | { status: 'delivered'; dump: unknown }
  /** fatal: stop polling (the Worker refused by name); transient network
   *  blips keep polling until the code's own expiry. */
  | { status: 'error'; message: string; fatal: boolean };

const workerError = async (res: Response): Promise<string> => {
  try {
    const parsed = (await res.json()) as { error?: unknown };
    if (typeof parsed.error === 'string') return parsed.error;
  } catch {
    /* non-JSON body — fall through */
  }
  if (res.status === 403) return BRIDGE_ORIGIN_NOTE;
  return `the bridge answered ${res.status} with no named message`;
};

/** Ask the Worker for a pairing session (code + TTL). */
export async function createBridgeSession(): Promise<BridgeSessionResult> {
  let res: Response;
  try {
    res = await fetch(`${BRIDGE_BASE_URL}/bridge/session`, { method: 'POST' });
  } catch (e) {
    return {
      ok: false,
      message: `${BRIDGE_ORIGIN_NOTE} (network detail: ${e instanceof Error ? e.message : String(e)})`,
    };
  }
  if (!res.ok) return { ok: false, message: await workerError(res) };
  const body = (await res.json()) as { code?: unknown; ttlSeconds?: unknown };
  if (typeof body.code !== 'string' || typeof body.ttlSeconds !== 'number') {
    return { ok: false, message: 'the bridge answered with an unexpected shape — try again' };
  }
  return { ok: true, session: { code: body.code, ttlSeconds: body.ttlSeconds } };
}

/** One poll. Delivery is one-time — a 'delivered' answer means the bridge
 *  has already deleted its copy. */
export async function pollBridge(code: string): Promise<BridgePollResult> {
  let res: Response;
  try {
    res = await fetch(`${BRIDGE_BASE_URL}/bridge/${encodeURIComponent(code)}`, { method: 'GET' });
  } catch (e) {
    return {
      status: 'error',
      fatal: false,
      message: `network hiccup while waiting (${e instanceof Error ? e.message : String(e)}) — still listening`,
    };
  }
  if (!res.ok) return { status: 'error', fatal: true, message: await workerError(res) };
  const body = (await res.json()) as { status?: unknown; dump?: unknown };
  if (body.status === 'delivered') return { status: 'delivered', dump: body.dump };
  if (body.status === 'waiting') return { status: 'waiting' };
  return { status: 'error', fatal: true, message: 'the bridge answered with an unexpected shape — press Receive from plugin again' };
}
