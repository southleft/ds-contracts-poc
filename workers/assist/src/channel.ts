/**
 * THE STANDING CI↔FIGMA CHANNEL (docs/18 G1, slice S1) — the long-lived
 * successor to the pairing-code bridge for the CI→designer direction.
 *
 * The pairing-code bridge (src/bridge.ts) stays EXACTLY as it is: a
 * synchronous, deliver-once courier that needs a human on both ends at the
 * same time. It is now the documented "unverified / ad-hoc" path. The
 * channel is the other shape: CI publishes whenever it likes, the designer
 * checks whenever they like, and neither waits for the other.
 *
 *   POST /channel/claim        mint a { writeKey, readKey } pair
 *   POST /channel/<writeKey>   CI publishes { bundle, provenance? }
 *   GET  /channel/<readKey>    the plugin peeks — NON-CONSUMING
 *
 * THE KEY SPLIT (the whole security story — docs/18 Flow 5 names the
 * supply-chain concern this answers):
 *
 *   writeKey  dscw_<32 chars>   a CI secret. Publishes. Never leaves CI.
 *   readKey   dscr_<64 hex>     = SHA-256(writeKey). Reads. Pasted into the
 *                               Figma plugin, so it lives in a Figma file's
 *                               clientStorage where a plugin, a shared file
 *                               or a screenshot can leak it.
 *
 * The derivation runs one way: holding the writeKey you can compute the
 * readKey (CI may read its own channel); holding the readKey you cannot
 * compute the writeKey (SHA-256 preimage). So a leaked Figma-side key lets
 * an attacker READ contracts — it can never INJECT into the source of
 * truth. That asymmetry is the point, and it is asserted positively in
 * test/channel.test.ts ("writeKey cannot read / readKey cannot write").
 *
 * REJECTED, on purpose:
 *   - repeating pairing codes ("the courier that dies of neglect" —
 *     docs/18's own diagnosis of why the loop stops);
 *   - per-file key derivation (a leak would be unrevocable and would still
 *     be a write key).
 *
 * READ SEMANTICS: non-consuming, with a monotonic `seq`. Deliver-once (the
 * bridge's model) cannot answer "is there an update waiting?" — it can only
 * answer it destructively, once. `GET ?since=<seq>` answers `current` or
 * `update` and never deletes anything, which is also the base G3 will need
 * for staleness.
 *
 * KV IS LAST-WRITE-WINS AND EVENTUALLY CONSISTENT. Two publishes racing can
 * land the same `seq` twice, and a read moments after a publish can still
 * see the previous one. That imprecision is ACCEPTED and bounded, exactly
 * as limits.ts accepts it for the counters: this is a delivery channel with
 * a human pressing Apply at the end, not a ledger. The freshness guard on
 * the plugin side (figma-sync/plugin/engine/entry.ts) is what makes a
 * mis-ordered delivery visible rather than silent.
 *
 * TTL: 30 days, ROLLING — refreshed on every publish, NOT on reads. A
 * channel nobody has published to for 30 days is dead by definition and
 * expires; a channel CI touches weekly lives forever. Re-claiming after an
 * expiry mints a fresh pair whose `seq` restarts at 1 — which is precisely
 * the case the plugin-side freshness guard names.
 *
 * ORIGINS: every channel route answers ANY origin, including none. Both
 * callers are origin-less by nature — a CI runner's fetch has no Origin, a
 * Figma plugin's fetch sends `Origin: null`. THE KEY IS THE AUTH, the same
 * reasoning the bridge's upload route already documents.
 *
 * PRIVACY: bundle contents are never logged and never inspected beyond the
 * envelope ("is it JSON / is it under the cap / does it have a non-empty
 * contracts array"). The provenance sibling is stored and echoed WITHOUT
 * being read at all — the worker cannot tell you what repo published.
 *
 * NAMED EXCLUSIONS — what this file deliberately does NOT do, so nobody has
 * to read it to find out:
 *   - NO SIGNING. A delivery is authenticated by possession of the write
 *     key and nothing else. Anyone holding it can publish any `provenance`
 *     they like and the plugin will render it. HMAC-verified deliveries
 *     with a "verified" badge are docs/18 G1 slice S3 — excluded from this
 *     round by name, partly because the Figma plugin sandbox has no
 *     WebCrypto for an end-to-end in-plugin signature check.
 *   - NO READ HALF. G1's other half (a headless drift recompute off a REST
 *     file dump so CI can referee drift without a human clicking a tab) is
 *     not started.
 *   - NO SERVER PUSH. No Durable Objects, no cron, no WebSocket, no
 *     webhook out. The plugin asks; the worker answers. A Figma plugin has
 *     no background execution, so anything else would be theatre.
 *   - NO MULTI-CHANNEL MANAGEMENT. One key at a time in the plugin, no
 *     listing, no revoke endpoint. Revoking = stop publishing and let the
 *     30 days run out, or claim a new pair.
 *   - NO MERGE (G3), NO GITHUB APP (G5), NO HOSTED AUDIT (G13). The apply
 *     log this round writes is FILE-LOCAL, in the Figma file's own root
 *     pluginData; nothing about it is stored here.
 */
import type { Deps, Env } from './env';
import { clientIp, reserveChannelClaimSlot, reserveChannelPublishSlot } from './limits';
import { CONTRACTS_BUNDLE_TYPE } from './bridge';

/** 30 days, rolling — refreshed on publish, never on read. */
export const CHANNEL_TTL_SECONDS = 30 * 24 * 60 * 60;
/** Same 4 MB ceiling the bridge uses; KV's own value limit is far higher. */
export const CHANNEL_MAX_BYTES = 4 * 1024 * 1024;

export const WRITE_KEY_PREFIX = 'dscw_';
export const READ_KEY_PREFIX = 'dscr_';
/** 32 symbols — no l/o/0/1 confusables. 256 % 32 === 0, so a raw byte
 *  modulo is UNBIASED here (no rejection sampling needed, unlike the
 *  bridge's 31-symbol code alphabet). */
export const KEY_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
/** 32 symbols × 5 bits = 160 bits of entropy in the write key. */
export const WRITE_KEY_BODY_LENGTH = 32;

export const WRITE_KEY_RE = new RegExp(`^${WRITE_KEY_PREFIX}[${KEY_ALPHABET}]{${WRITE_KEY_BODY_LENGTH}}$`);
export const READ_KEY_RE = new RegExp(`^${READ_KEY_PREFIX}[0-9a-f]{64}$`);

export const CHANNEL_MESSAGES = {
  disabled: 'the CI channel is switched off — the owner has not enabled it yet',
  claimLimit:
    'channel-claim limit reached for today from this network — a channel is minted once per repository, not per build; try again tomorrow',
  publishLimit:
    'this channel has published its maximum for today — the cap is per CHANNEL per UTC day (CI runners churn IP addresses, so an IP cap would not hold), and it resets at midnight UTC',
  notWriteKey:
    'that is not a channel WRITE key — write keys look like "dscw_…" and come from `ds-contracts figma claim-channel`. A read key ("dscr_…") is the plugin half and can never publish: that split is what stops a leaked Figma file from injecting into the source of truth.',
  notReadKey:
    'that is not a channel READ key — read keys look like "dscr_…" and are the half you paste into the Figma plugin. A write key ("dscw_…") is a CI secret and is never read from over this route.',
  noChannel:
    'nothing is published under that key — check the key, or run `ds-contracts figma claim-channel` for a fresh pair (a channel with no publish for 30 days expires)',
  tooLarge:
    'that bundle is too large for the channel (over 4 MB) — publish fewer contracts, or fall back to the pairing-code path',
  notJson: 'the channel only carries JSON — this usually means a truncated publish; try again',
  badPublish:
    'a channel publish needs a "bundle" object — POST { "bundle": <CONTRACTS-BUNDLE>, "provenance": {…} } (`ds-contracts figma publish` builds it for you)',
  badBundle:
    'that "bundle" is not a well-formed CONTRACTS-BUNDLE — it needs a non-empty "contracts" array of contract documents (`ds-contracts figma bundle` builds one for you)',
  badProvenance:
    'the optional "provenance" sibling must be a JSON object — it rides through unread and is echoed to the plugin verbatim',
} as const;

const metaKey = (readKey: string) => `chan:${readKey}:meta`;
const bundleKey = (readKey: string) => `chan:${readKey}:bundle`;
const provKey = (readKey: string) => `chan:${readKey}:prov`;

/** Channel state head. `seq` 0 = claimed, nothing published yet. */
export interface ChannelMeta {
  seq: number;
  bytes: number;
  publishedAt: string | null;
  claimedAt: string;
}

const json = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

/** Any origin, including none — see the header comment. */
const channelCors: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};

/** Crypto-random write key. Unbiased: 256 % 32 === 0. */
export function randomWriteKey(): string {
  const bytes = new Uint8Array(WRITE_KEY_BODY_LENGTH);
  crypto.getRandomValues(bytes);
  let out = WRITE_KEY_PREFIX;
  for (const b of bytes) out += KEY_ALPHABET[b % KEY_ALPHABET.length];
  return out;
}

/** readKey = "dscr_" + SHA-256(writeKey). One way, on purpose. */
export async function deriveReadKey(writeKey: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(writeKey));
  let hex = '';
  for (const b of new Uint8Array(digest)) hex += b.toString(16).padStart(2, '0');
  return READ_KEY_PREFIX + hex;
}

/** Envelope-ONLY referee — the same shape the bridge accepts, checked here
 *  with the channel's own wording. Contract CONTENTS are never inspected;
 *  the plugin's schema referee owns that. */
export function isWellFormedBundle(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const o = value as { type?: unknown; contracts?: unknown };
  if (o.type !== CONTRACTS_BUNDLE_TYPE) return false;
  const contracts = o.contracts;
  return (
    Array.isArray(contracts) &&
    contracts.length > 0 &&
    !contracts.some((c) => c === null || typeof c !== 'object' || Array.isArray(c))
  );
}

export async function handleChannel(
  request: Request,
  url: URL,
  env: Env,
  deps: Deps,
): Promise<Response> {
  const cors = channelCors;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  // Independent kill switch: the channel costs KV reads/writes only, never
  // Anthropic tokens — exactly like BRIDGE_ENABLED, and orthogonal to it.
  if (env.CHANNEL_ENABLED !== 'true') return json(503, { error: CHANNEL_MESSAGES.disabled }, cors);

  if (url.pathname === '/channel/claim') {
    if (request.method !== 'POST') return json(405, { error: 'POST only' }, cors);
    // Claim is the ONE channel route capped per IP: there is no channel yet
    // to key a counter by. Publishes are capped per channel (see limits.ts).
    if (!(await reserveChannelClaimSlot(env, clientIp(request), deps.now()))) {
      return json(429, { error: CHANNEL_MESSAGES.claimLimit }, cors);
    }
    const writeKey = randomWriteKey();
    const readKey = await deriveReadKey(writeKey);
    const meta: ChannelMeta = {
      seq: 0,
      bytes: 0,
      publishedAt: null,
      claimedAt: deps.now().toISOString(),
    };
    await env.ASSIST_KV.put(metaKey(readKey), JSON.stringify(meta), {
      expirationTtl: CHANNEL_TTL_SECONDS,
    });
    return json(
      200,
      { writeKey, readKey, ttlSeconds: CHANNEL_TTL_SECONDS, maxBytes: CHANNEL_MAX_BYTES },
      cors,
    );
  }

  const rawKey = decodeURIComponent(url.pathname.slice('/channel/'.length));

  if (request.method === 'GET') return readChannel(rawKey, url, env, cors);
  if (request.method === 'POST') return publishChannel(rawKey, request, env, deps, cors);
  return json(405, { error: 'GET (read) or POST (publish) only' }, cors);
}

// ---------------------------------------------------------------------------
// POST /channel/<writeKey> — CI publishes.
// ---------------------------------------------------------------------------

async function publishChannel(
  rawKey: string,
  request: Request,
  env: Env,
  deps: Deps,
  cors: Record<string, string>,
): Promise<Response> {
  // The split, refused BY NAME on the wrong half. Key SHAPE is not a secret
  // (the caller can read its own prefix), so naming it costs nothing and
  // saves a confused CI engineer an hour; key EXISTENCE is a secret and
  // answers an indistinguishable 404 below.
  if (!WRITE_KEY_RE.test(rawKey)) {
    return json(400, { error: CHANNEL_MESSAGES.notWriteKey }, cors);
  }
  const readKey = await deriveReadKey(rawKey);

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > CHANNEL_MAX_BYTES) {
    return json(413, { error: CHANNEL_MESSAGES.tooLarge }, cors);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json(400, { error: CHANNEL_MESSAGES.notJson }, cors);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return json(400, { error: CHANNEL_MESSAGES.badPublish }, cors);
  }
  const body = parsed as { bundle?: unknown; provenance?: unknown };
  if (body.bundle === undefined) return json(400, { error: CHANNEL_MESSAGES.badPublish }, cors);
  if (!isWellFormedBundle(body.bundle)) return json(400, { error: CHANNEL_MESSAGES.badBundle }, cors);
  // The provenance sibling is checked for one thing only — that it is a JSON
  // object we can splice back out verbatim. Its FIELDS are never read.
  const provenance = body.provenance;
  if (
    provenance !== undefined &&
    (provenance === null || typeof provenance !== 'object' || Array.isArray(provenance))
  ) {
    return json(400, { error: CHANNEL_MESSAGES.badProvenance }, cors);
  }

  // Existence: a wrong or expired key is indistinguishable from one that
  // never existed — one KV read either way, one message.
  const metaRaw = await env.ASSIST_KV.get(metaKey(readKey));
  if (metaRaw === null) return json(404, { error: CHANNEL_MESSAGES.noChannel }, cors);

  if (!(await reserveChannelPublishSlot(env, readKey, deps.now()))) {
    return json(429, { error: CHANNEL_MESSAGES.publishLimit }, cors);
  }

  let previous: Partial<ChannelMeta> = {};
  try {
    previous = JSON.parse(metaRaw) as Partial<ChannelMeta>;
  } catch {
    /* corrupt head — restart the numbering rather than refuse the publish */
  }
  const seq = (Number.isFinite(Number(previous.seq)) ? Number(previous.seq) : 0) + 1;
  const bundleText = JSON.stringify(body.bundle);
  const bundleBytes = new TextEncoder().encode(bundleText).byteLength;
  const publishedAt = deps.now().toISOString();

  await env.ASSIST_KV.put(bundleKey(readKey), bundleText, { expirationTtl: CHANNEL_TTL_SECONDS });
  if (provenance !== undefined) {
    await env.ASSIST_KV.put(provKey(readKey), JSON.stringify(provenance), {
      expirationTtl: CHANNEL_TTL_SECONDS,
    });
  } else {
    // A publish WITHOUT provenance must not inherit the previous publish's —
    // stale provenance is worse than none.
    await env.ASSIST_KV.delete(provKey(readKey));
  }
  const meta: ChannelMeta = {
    seq,
    bytes: bundleBytes,
    publishedAt,
    claimedAt: typeof previous.claimedAt === 'string' ? previous.claimedAt : publishedAt,
  };
  await env.ASSIST_KV.put(metaKey(readKey), JSON.stringify(meta), {
    expirationTtl: CHANNEL_TTL_SECONDS,
  });
  return json(200, { ok: true, seq, bytes: bundleBytes, publishedAt }, cors);
}

// ---------------------------------------------------------------------------
// GET /channel/<readKey>?since=<seq>[&meta=1] — the plugin peeks. NEVER
// consumes, NEVER refreshes the TTL.
// ---------------------------------------------------------------------------

async function readChannel(
  rawKey: string,
  url: URL,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  if (!READ_KEY_RE.test(rawKey)) {
    return json(400, { error: CHANNEL_MESSAGES.notReadKey }, cors);
  }
  const metaRaw = await env.ASSIST_KV.get(metaKey(rawKey));
  if (metaRaw === null) return json(404, { error: CHANNEL_MESSAGES.noChannel }, cors);
  let meta: Partial<ChannelMeta>;
  try {
    meta = JSON.parse(metaRaw) as Partial<ChannelMeta>;
  } catch {
    return json(404, { error: CHANNEL_MESSAGES.noChannel }, cors);
  }
  const seq = Number.isFinite(Number(meta.seq)) ? Number(meta.seq) : 0;
  const publishedAt = typeof meta.publishedAt === 'string' ? meta.publishedAt : null;

  // Claimed but never published: a live channel with nothing in it. Saying
  // "current, seq 0" lets the designer paste the key BEFORE the first CI run
  // and see the channel is alive, instead of a 404 that reads like a typo.
  if (seq === 0) return json(200, { status: 'current', seq: 0, publishedAt: null }, cors);

  const sinceRaw = url.searchParams.get('since');
  const sinceParsed = sinceRaw === null ? NaN : Number.parseInt(sinceRaw, 10);
  const since = Number.isFinite(sinceParsed) ? sinceParsed : -1;
  if (since >= seq) return json(200, { status: 'current', seq, publishedAt }, cors);

  const provText = await env.ASSIST_KV.get(provKey(rawKey));

  // `meta=1` — the head WITHOUT the bundle. The plugin's check-on-open asks
  // this question ("is anything waiting?") and must not pull up to 4 MB just
  // to render a one-line status; the explicit button asks the full one.
  if (url.searchParams.get('meta') === '1') {
    return new Response(
      `{"status":"update","seq":${seq},"publishedAt":${JSON.stringify(publishedAt)},"bytes":${
        Number.isFinite(Number(meta.bytes)) ? Number(meta.bytes) : 0
      }${provText !== null ? `,"provenance":${provText}` : ''}}`,
      { status: 200, headers: { 'content-type': 'application/json', ...cors } },
    );
  }

  const bundleText = await env.ASSIST_KV.get(bundleKey(rawKey));
  // Head without a body: KV consistency lag, or a partially expired channel.
  // Same message as "nothing published" — the remedy is identical.
  if (bundleText === null) return json(404, { error: CHANNEL_MESSAGES.noChannel }, cors);
  const bundleBytes = new TextEncoder().encode(bundleText).byteLength;

  // Both were validated as JSON at publish — splice them in verbatim so the
  // bundle the designer applies is byte-for-byte what CI published.
  return new Response(
    `{"status":"update","seq":${seq},"publishedAt":${JSON.stringify(publishedAt)},"bytes":${bundleBytes}${
      provText !== null ? `,"provenance":${provText}` : ''
    },"bundle":${bundleText}}`,
    { status: 200, headers: { 'content-type': 'application/json', ...cors } },
  );
}
