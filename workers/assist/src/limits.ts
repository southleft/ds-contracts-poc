/**
 * Hard caps, backed by Workers KV.
 *
 * Two counters, both keyed by UTC day:
 *   ip:<endpoint>:<ip>:<yyyy-mm-dd>   per-IP requests per endpoint class
 *   budget:<yyyy-mm-dd>               global tokens spent (input + output)
 *
 * KV is eventually consistent and read-modify-write here is not atomic —
 * a burst of parallel requests can slip a few past the line. That is
 * accepted: these are abuse dampeners with a bounded overshoot (max_tokens
 * caps every call), not billing-grade accounting. The per-IP counter is
 * reserved BEFORE the model call so retries and races err on the side of
 * refusing; the budget is checked before and charged after with actual usage.
 */
import type { Env, KVNamespaceLite } from './env';

export const DEFAULT_IP_DAILY_LIMIT = 5;
export const DEFAULT_DAILY_TOKEN_BUDGET = 600_000;
export const DEFAULT_BRIDGE_IP_DAILY_LIMIT = 40;
/** Minting a standing channel is a once-per-repository act, not a per-build
 *  one — 10/day/IP is generous for a team setting several up in one sitting
 *  and still stops a mint loop. */
export const DEFAULT_CHANNEL_CLAIM_IP_DAILY_LIMIT = 10;
/** Publishes are capped PER CHANNEL PER UTC DAY, never per IP: CI runners
 *  churn IP addresses, so an IP cap would not hold for the one caller that
 *  matters. 200/day comfortably covers a monorepo merging every few minutes;
 *  a runaway workflow loop stops at the line. */
export const DEFAULT_CHANNEL_PUBLISH_DAILY_LIMIT = 200;

const DAY_TTL_SECONDS = 2 * 24 * 60 * 60; // outlive the UTC day, then vanish

export const utcDay = (now: Date): string => now.toISOString().slice(0, 10);

function intVar(raw: string | undefined, fallback: number): number {
  const n = raw === undefined ? NaN : Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function clientIp(request: Request): string {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf;
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return 'unknown';
}

async function readCount(kv: KVNamespaceLite, key: string): Promise<number> {
  const raw = await kv.get(key);
  const n = raw === null ? 0 : Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Reserve one per-IP slot for this endpoint class today.
 * Returns false when the visitor is over the line.
 */
export async function reserveIpSlot(
  env: Env,
  endpoint: string,
  ip: string,
  now: Date,
): Promise<boolean> {
  const limit = intVar(env.ASSIST_IP_DAILY_LIMIT, DEFAULT_IP_DAILY_LIMIT);
  const key = `ip:${endpoint}:${ip}:${utcDay(now)}`;
  const used = await readCount(env.ASSIST_KV, key);
  if (used >= limit) return false;
  await env.ASSIST_KV.put(key, String(used + 1), { expirationTtl: DAY_TTL_SECONDS });
  return true;
}

/**
 * Same counter, bridge classes (`bridge-session` / `bridge-upload`), its own
 * higher default: pairing retries are cheap KV writes, not model calls.
 * Playground polls (GET) are deliberately uncounted — origin-gated reads
 * against an unguessable code.
 */
export async function reserveBridgeSlot(
  env: Env,
  kind: 'session' | 'upload',
  ip: string,
  now: Date,
): Promise<boolean> {
  const limit = intVar(env.BRIDGE_IP_DAILY_LIMIT, DEFAULT_BRIDGE_IP_DAILY_LIMIT);
  const key = `ip:bridge-${kind}:${ip}:${utcDay(now)}`;
  const used = await readCount(env.ASSIST_KV, key);
  if (used >= limit) return false;
  await env.ASSIST_KV.put(key, String(used + 1), { expirationTtl: DAY_TTL_SECONDS });
  return true;
}

/**
 * Reserve one channel-MINT slot for this IP today (`POST /channel/claim`).
 * The only channel counter keyed by IP — at claim time there is no channel
 * to key by yet.
 */
export async function reserveChannelClaimSlot(env: Env, ip: string, now: Date): Promise<boolean> {
  const limit = intVar(env.CHANNEL_CLAIM_IP_DAILY_LIMIT, DEFAULT_CHANNEL_CLAIM_IP_DAILY_LIMIT);
  const key = `ip:channel-claim:${ip}:${utcDay(now)}`;
  const used = await readCount(env.ASSIST_KV, key);
  if (used >= limit) return false;
  await env.ASSIST_KV.put(key, String(used + 1), { expirationTtl: DAY_TTL_SECONDS });
  return true;
}

/**
 * Reserve one PUBLISH slot for this CHANNEL today. Keyed by the derived read
 * key, so a CI fleet behind a hundred egress addresses shares one budget and
 * one runaway workflow cannot spend anyone else's. Channel reads are
 * deliberately UNCOUNTED, like bridge polls: an unguessable key, no writes.
 */
export async function reserveChannelPublishSlot(
  env: Env,
  readKey: string,
  now: Date,
): Promise<boolean> {
  const limit = intVar(env.CHANNEL_PUBLISH_DAILY_LIMIT, DEFAULT_CHANNEL_PUBLISH_DAILY_LIMIT);
  const key = `chan-pub:${readKey}:${utcDay(now)}`;
  const used = await readCount(env.ASSIST_KV, key);
  if (used >= limit) return false;
  await env.ASSIST_KV.put(key, String(used + 1), { expirationTtl: DAY_TTL_SECONDS });
  return true;
}

/** True when today's global token budget is already spent. */
export async function budgetSpent(env: Env, now: Date): Promise<boolean> {
  const budget = intVar(env.ASSIST_DAILY_TOKEN_BUDGET, DEFAULT_DAILY_TOKEN_BUDGET);
  const used = await readCount(env.ASSIST_KV, `budget:${utcDay(now)}`);
  return used >= budget;
}

/** Charge actual usage (input + output tokens) against today's budget. */
export async function chargeBudget(env: Env, tokens: number, now: Date): Promise<void> {
  if (!Number.isFinite(tokens) || tokens <= 0) return;
  const key = `budget:${utcDay(now)}`;
  const used = await readCount(env.ASSIST_KV, key);
  await env.ASSIST_KV.put(key, String(used + Math.round(tokens)), {
    expirationTtl: DAY_TTL_SECONDS,
  });
}
