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

export interface DurableObjectIdLite {}

export interface DurableObjectStubLite {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface DurableObjectNamespaceLite {
  idFromName(name: string): DurableObjectIdLite;
  get(id: DurableObjectIdLite): DurableObjectStubLite;
}

export interface DurableObjectStorageTransactionLite {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}

export interface DurableObjectStorageLite {
  transaction<T>(
    closure: (txn: DurableObjectStorageTransactionLite) => Promise<T>,
  ): Promise<T>;
}

export interface DurableObjectStateLite {
  storage: DurableObjectStorageLite;
}

export interface Env {
  /** Worker secret (`wrangler secret put ANTHROPIC_API_KEY`). Never logged, never echoed. */
  ANTHROPIC_API_KEY: string;
  ASSIST_KV: KVNamespaceLite;
  /** Kill switch — anything other than "true" answers 503. Ships "false". */
  ASSIST_ENABLED?: string;
  /** Per-IP daily request cap per endpoint class. Default "5". */
  ASSIST_IP_DAILY_LIMIT?: string;
  /** Global daily conservative token-reservation budget. Default "600000". */
  ASSIST_DAILY_TOKEN_BUDGET?: string;
  /** Serialized global model-budget coordinator. Missing/unavailable fails closed. */
  BUDGET_COORDINATOR?: DurableObjectNamespaceLite;
  /** Optional exact-match extra origin for local playground dev (e.g. "http://localhost:5173"). */
  ASSIST_DEV_ORIGIN?: string;
  /** Plugin-bridge kill switch — anything other than "true" answers 503. */
  BRIDGE_ENABLED?: string;
  /** Per-IP daily cap for bridge session creation and uploads (each its own class). Default "40". */
  BRIDGE_IP_DAILY_LIMIT?: string;
  /** Per-code, per-IP daily cap for GET bridge polling. Default "600". */
  BRIDGE_POLL_DAILY_LIMIT?: string;
  /** Standing CI↔Figma channel kill switch — anything other than "true" answers 503.
   *  Independent of BRIDGE_ENABLED and ASSIST_ENABLED. */
  CHANNEL_ENABLED?: string;
  /** Per-IP daily cap on MINTING channels (`POST /channel/claim`). A channel is
   *  claimed once per repository, not per build. Default "10". */
  CHANNEL_CLAIM_IP_DAILY_LIMIT?: string;
  /** Per-CHANNEL daily publish cap — keyed by channel, NOT by IP, because CI
   *  runners churn IP addresses and an IP cap would not hold. Default "200". */
  CHANNEL_PUBLISH_DAILY_LIMIT?: string;
}

/** Injectable seams so tests run in plain node with no workerd and no network. */
export interface Deps {
  fetchImpl: typeof fetch;
  now: () => Date;
}
