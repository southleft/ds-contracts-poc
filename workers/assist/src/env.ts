/**
 * Environment surface for the assist Worker.
 *
 * KVNamespaceLite is the slice of Cloudflare's KVNamespace this Worker uses —
 * declared locally so `tsc` runs without @cloudflare/workers-types and tests
 * can supply a Map-backed stand-in. The real binding satisfies it structurally.
 */
export interface KVNamespaceLite {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface Env {
  /** Worker secret (`wrangler secret put ANTHROPIC_API_KEY`). Never logged, never echoed. */
  ANTHROPIC_API_KEY: string;
  ASSIST_KV: KVNamespaceLite;
  /** Kill switch — anything other than "true" answers 503. Ships "false". */
  ASSIST_ENABLED?: string;
  /** Per-IP daily request cap per endpoint class. Default "5". */
  ASSIST_IP_DAILY_LIMIT?: string;
  /** Global daily token budget (input+output, all visitors). Default "600000" ≈ $10/day at Opus pricing. */
  ASSIST_DAILY_TOKEN_BUDGET?: string;
  /** Optional exact-match extra origin for local playground dev (e.g. "http://localhost:5173"). */
  ASSIST_DEV_ORIGIN?: string;
  /** Plugin-bridge kill switch — anything other than "true" answers 503. */
  BRIDGE_ENABLED?: string;
  /** Per-IP daily cap for bridge session creation and uploads (each its own class). Default "40". */
  BRIDGE_IP_DAILY_LIMIT?: string;
}

/** Injectable seams so tests run in plain node with no workerd and no network. */
export interface Deps {
  fetchImpl: typeof fetch;
  now: () => Date;
}
