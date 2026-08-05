/**
 * Hard caps, backed by Workers KV.
 *
 * Counters keyed by UTC day:
 *   ip:<endpoint>:<ip>:<yyyy-mm-dd>   per-IP requests per endpoint class
 *   bridge-poll:<code>:<ip>:<day>     bridge polls per active code and IP
 * Model budget reservations use one Durable Object instance per UTC day.
 *
 * KV counters are eventually consistent abuse dampeners. The model budget is
 * different: its Durable Object storage transaction is billing-grade atomic.
 * It is conservatively reserved BEFORE each call (input bytes plus the
 * endpoint's max output tokens).
 */
import type { Env, KVNamespaceLite } from './env';

export const DEFAULT_IP_DAILY_LIMIT = 5;
export const DEFAULT_DAILY_TOKEN_BUDGET = 600_000;
export const DEFAULT_BRIDGE_IP_DAILY_LIMIT = 40;
/** One poll every 2.5s for 15 minutes is 360. 600 leaves retry/headroom while
 * bounding a caller's reads. The key includes code + IP, so one abusive
 * network cannot consume another receiver's allowance. */
export const DEFAULT_BRIDGE_POLL_DAILY_LIMIT = 600;
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
 * GET polling has the separate per-code + IP counter below.
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
 * Reserve one GET /bridge/:code poll for this code + IP today. Call only
 * after proving the session/payload exists, so random codes cannot create
 * unbounded counter keys. KV read-modify-write is explicitly non-atomic.
 */
export async function reserveBridgePollSlot(
  env: Env,
  code: string,
  ip: string,
  now: Date,
): Promise<boolean> {
  const limit = intVar(env.BRIDGE_POLL_DAILY_LIMIT, DEFAULT_BRIDGE_POLL_DAILY_LIMIT);
  const key = `bridge-poll:${code}:${ip}:${utcDay(now)}`;
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

/**
 * Conservatively reserve this request's maximum token exposure before the
 * model call. `tokens` includes one token per UTF-8 input byte plus the
 * endpoint's max_tokens output cap; this intentionally over-reserves rather
 * than relying on a tokenizer in the Worker.
 *
 * The per-day Durable Object serializes this check-and-increment. Reservations
 * are not refunded on low usage or upstream failure: conservative retained
 * reservations keep the hard cap simple and monotonic.
 *
 * Missing bindings, transport errors, malformed coordinator responses, and
 * invalid reservations all fail closed.
 */
export async function reserveBudget(env: Env, tokens: number, now: Date): Promise<boolean> {
  const budget = intVar(env.ASSIST_DAILY_TOKEN_BUDGET, DEFAULT_DAILY_TOKEN_BUDGET);
  const reservation = Number.isFinite(tokens) && tokens > 0 ? Math.ceil(tokens) : 0;
  if (!Number.isSafeInteger(reservation) || reservation === 0 || !env.BUDGET_COORDINATOR) {
    return false;
  }
  try {
    const id = env.BUDGET_COORDINATOR.idFromName(`budget:${utcDay(now)}`);
    const stub = env.BUDGET_COORDINATOR.get(id);
    const response = await stub.fetch('https://budget.internal/reserve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reservation, budget }),
    });
    if (!response.ok) return false;
    const result = (await response.json()) as { admitted?: unknown };
    return result.admitted === true;
  } catch {
    return false;
  }
}
