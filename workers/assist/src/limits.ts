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
