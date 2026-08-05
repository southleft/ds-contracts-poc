/**
 * Plugin bridge — the "Send to Playground" transport. The Figma dev plugin
 * runs the SAME dump script the paste-box route uses (extract/figma/
 * dump.plugin.js) and POSTs the resulting dump v1 JSON here; the playground
 * picks it up under a short-lived pairing code. The bridge is a dumb pipe on
 * purpose:
 *
 *   POST /bridge/session   receiver asks for a pairing code + read capability
 *   POST /bridge/:code     plugin uploads the dump (only while session open)
 *   GET  /bridge/:code     playground polls; delivery is ONE-TIME, then the
 *                          payload envelope and session keys are deleted
 *
 * Privacy: dump contents are never logged, never inspected beyond "is it
 * JSON / is it under the size cap", and never persisted past delivery or the
 * 15-minute TTL — whichever comes first. KV deletes are best-effort (KV is
 * eventually consistent); the TTL bounds any residue.
 *
 * Origin is CORS metadata only, never authorization: any non-browser client
 * can spoof it. The pairing code authorizes uploads and bundle/proposal
 * reads. Sensitive design-dump reads additionally require the high-entropy
 * read capability minted with the session. A spoofed playground Origin plus
 * the short pairing code is therefore insufficient to retrieve a dump.
 */
import type { Deps, Env } from './env';
import { corsHeaders, resolveOrigin } from './cors';
import { clientIp, reserveBridgePollSlot, reserveBridgeSlot } from './limits';

export const BRIDGE_TTL_SECONDS = 15 * 60;
export const BRIDGE_MAX_DUMP_BYTES = 4 * 1024 * 1024; // 4 MB of JSON text

/** Unambiguous alphabet — no I/L/O/0/1 (31 symbols). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;
export const READ_CAPABILITY_HEADER = 'x-bridge-read-capability';
export const READ_CAPABILITY_BYTES = 24; // 192 bits, URL/header-safe hex

/** Payload types the bridge carries. Dumps (plugin → playground, the
 *  original direction) are untagged JSON; a CONTRACTS-BUNDLE (CLI/CI →
 *  plugin, the reverse direction: `ds-contracts figma push`) is tagged with
 *  this envelope type so the receiver can branch WITHOUT the bridge ever
 *  inspecting contract contents — the transport stays a dumb pipe, it only
 *  checks the envelope is well-formed and remembers which kind it carried.
 *  A CONTRACT-PROPOSAL (plugin → CLI, the dev door: the Send tab's export
 *  envelope sent to `ds-contracts figma receive`) rides the same mechanics:
 *  envelope-tagged, envelope-only validation, kind recorded at upload. */
export const CONTRACTS_BUNDLE_TYPE = 'CONTRACTS-BUNDLE';
export const CONTRACT_PROPOSAL_TYPE = 'CONTRACT-PROPOSAL';
export type BridgePayloadKind = 'dump' | 'contracts-bundle' | 'proposal';

export const BRIDGE_MESSAGES = {
  disabled: 'the plugin bridge is switched off — the owner has not enabled it yet',
  forbiddenOrigin:
    'the bridge only answers the ds-contracts playground — this origin is not allowed',
  sessionLimit: 'bridge limit reached for today from this network — try again tomorrow',
  pollLimit:
    'bridge polling limit reached for this code from this network — wait or mint a fresh session',
  readCapability:
    'this design dump requires the read capability minted with its bridge session — Origin is CORS metadata, not authorization',
  badCode:
    'that is not a bridge code — codes are 6 letters/digits (letters I, L, O and digits 0, 1 are never used); `ds-contracts figma receive` prints one',
  noSession:
    'nothing is waiting under that code — check the characters against the code your receiver printed (e.g. `ds-contracts figma receive`), or mint a fresh one there (codes expire after 15 minutes)',
  tooLarge:
    'that dump is too large for the bridge (over 4 MB) — narrow the target sets in the plugin and send again, or fall back to copy/paste',
  notJson:
    'the bridge only carries JSON — this usually means a truncated send; try Send again',
  expired:
    'this code has expired or its payload was already delivered — deliver-once is the design; mint a fresh code (e.g. run `ds-contracts figma receive` again) and re-send',
  badBundle:
    'that is tagged CONTRACTS-BUNDLE but is not a well-formed bundle — it needs a non-empty "contracts" array of contract documents (ds-contracts figma push builds one for you)',
  badProposal:
    'that is tagged CONTRACT-PROPOSAL but is not a well-formed proposal — it needs a "proposedContract" object (the plugin’s Send tab builds one for you)',
} as const;

const sessKey = (code: string) => `bridge:sess:${code}`;
const payloadKey = (code: string) => `bridge:payload:${code}`;
// Legacy pre-envelope keys are read and deleted during the compatibility
// window. New writes never use them.
const dumpKey = (code: string) => `bridge:dump:${code}`;
const kindKey = (code: string) => `bridge:kind:${code}`;
const readCapabilityKey = (code: string) => `bridge:read-cap:${code}`;

interface StoredPayload {
  version: 1;
  kind: BridgePayloadKind;
  raw: string;
}

function inferredPayloadKind(raw: string): BridgePayloadKind {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return 'dump';
    const record = parsed as { type?: unknown; contracts?: unknown; proposedContract?: unknown };
    if (
      record.type === CONTRACTS_BUNDLE_TYPE &&
      Array.isArray(record.contracts) &&
      record.contracts.length > 0 &&
      record.contracts.every((c) => c !== null && typeof c === 'object' && !Array.isArray(c))
    ) {
      return 'contracts-bundle';
    }
    if (
      record.type === CONTRACT_PROPOSAL_TYPE &&
      record.proposedContract !== null &&
      typeof record.proposedContract === 'object' &&
      !Array.isArray(record.proposedContract)
    ) {
      return 'proposal';
    }
  } catch {
    // Corrupt/unknown stored values always take the protected path.
  }
  return 'dump';
}

function decodeStoredPayload(envelopeRaw: string): StoredPayload {
  try {
    const parsed = JSON.parse(envelopeRaw) as Partial<StoredPayload>;
    if (parsed.version === 1 && typeof parsed.raw === 'string') {
      const inferred = inferredPayloadKind(parsed.raw);
      const kind = parsed.kind === inferred ? inferred : 'dump';
      return { version: 1, kind, raw: parsed.raw };
    }
  } catch {
    // Fall through to a protected representation of the corrupt value.
  }
  return { version: 1, kind: 'dump', raw: JSON.stringify(envelopeRaw) };
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

/** CORS for bridge routes: authorization is possession, never Origin. */
const uploadCors: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': `content-type, ${READ_CAPABILITY_HEADER}`,
  'access-control-max-age': '86400',
};

/** Crypto-random pairing code, rejection-sampled (no modulo bias). */
export function randomCode(): string {
  const limit = 256 - (256 % CODE_ALPHABET.length); // 248 for 31 symbols
  let out = '';
  while (out.length < CODE_LENGTH) {
    const bytes = new Uint8Array(CODE_LENGTH * 2);
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b < limit && out.length < CODE_LENGTH) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
    }
  }
  return out;
}

/** Independent capability for the sensitive dump-read direction. */
export function randomReadCapability(): string {
  const bytes = new Uint8Array(READ_CAPABILITY_BYTES);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

async function hashCapability(capability: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(capability));
  let out = '';
  for (const b of new Uint8Array(digest)) out += b.toString(16).padStart(2, '0');
  return out;
}

const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

export async function handleBridge(
  request: Request,
  url: URL,
  env: Env,
  deps: Deps,
): Promise<Response> {
  const isSessionRoute = url.pathname === '/bridge/session';
  // Upload/read route: /bridge/<code>. Codes are normalized to uppercase so a
  // hand-typed lowercase code still pairs.
  const rawCode = isSessionRoute ? null : decodeURIComponent(url.pathname.slice('/bridge/'.length));

  if (isSessionRoute || request.method === 'GET') {
    // Origin controls only which browsers may read this response. It is
    // attacker-controlled outside browsers and is never an authorization
    // decision. Payload authorization is checked below.
    const origin = resolveOrigin(request, env);
    const cors = origin ? corsHeaders(origin) : uploadCors;
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (env.BRIDGE_ENABLED !== 'true') return json(503, { error: BRIDGE_MESSAGES.disabled }, cors);

    if (isSessionRoute) {
      if (request.method !== 'POST') return json(405, { error: 'POST only' }, cors);
      if (!(await reserveBridgeSlot(env, 'session', clientIp(request), deps.now()))) {
        return json(429, { error: BRIDGE_MESSAGES.sessionLimit }, cors);
      }
      const code = randomCode();
      const readCapability = randomReadCapability();
      await env.ASSIST_KV.put(sessKey(code), deps.now().toISOString(), {
        expirationTtl: BRIDGE_TTL_SECONDS,
      });
      await env.ASSIST_KV.put(readCapabilityKey(code), await hashCapability(readCapability), {
        expirationTtl: BRIDGE_TTL_SECONDS,
      });
      return json(200, { code, readCapability, ttlSeconds: BRIDGE_TTL_SECONDS }, cors);
    }

    // GET /bridge/:code — poll + one-time read.
    const code = String(rawCode).toUpperCase();
    if (!CODE_RE.test(code)) return json(400, { error: BRIDGE_MESSAGES.badCode }, cors);
    const envelopeRaw = await env.ASSIST_KV.get(payloadKey(code));
    const legacyRaw = envelopeRaw === null ? await env.ASSIST_KV.get(dumpKey(code)) : null;
    const stored =
      envelopeRaw !== null
        ? decodeStoredPayload(envelopeRaw)
        : legacyRaw !== null
          ? {
              version: 1 as const,
              // Legacy kind markers are advisory only. Infer from the payload
              // itself so a stale/unknown marker can never unprotect a dump.
              kind: inferredPayloadKind(legacyRaw),
              raw: legacyRaw,
            }
          : null;
    const session = stored === null ? await env.ASSIST_KV.get(sessKey(code)) : 'active';
    if (stored === null && session === null) {
      return json(410, { error: BRIDGE_MESSAGES.expired }, cors);
    }
    if (!(await reserveBridgePollSlot(env, code, clientIp(request), deps.now()))) {
      return json(429, { error: BRIDGE_MESSAGES.pollLimit }, cors);
    }
    if (stored !== null) {
      const { kind, raw: dump } = stored;
      // Dump reads need an independent 192-bit capability. The short code
      // remains enough for bundle/proposal reads to preserve plugin/CLI
      // flows. A refused capability check never consumes the payload.
      if (kind === 'dump') {
        const presented = request.headers.get(READ_CAPABILITY_HEADER);
        const expectedHash = await env.ASSIST_KV.get(readCapabilityKey(code));
        const presentedHash = presented ? await hashCapability(presented) : null;
        if (expectedHash === null || presentedHash !== expectedHash) {
          return json(403, { error: BRIDGE_MESSAGES.readCapability }, cors);
        }
      }
      // One-time read: delete BEFORE answering; the dump exists nowhere
      // after this response (TTL is the backstop for KV consistency lag).
      await env.ASSIST_KV.delete(payloadKey(code));
      // Also clear legacy keys. They may be stale after deployment and must
      // never reappear as a second delivery after the envelope is consumed.
      await env.ASSIST_KV.delete(dumpKey(code));
      await env.ASSIST_KV.delete(kindKey(code));
      await env.ASSIST_KV.delete(sessKey(code));
      await env.ASSIST_KV.delete(readCapabilityKey(code));
      // `dump` was validated as JSON at upload — splice it in verbatim.
      return new Response(`{"status":"delivered","kind":${JSON.stringify(kind)},"dump":${dump}}`, {
        status: 200,
        headers: { 'content-type': 'application/json', ...cors },
      });
    }
    return json(200, { status: 'waiting' }, cors);
  }

  // Plugin side: POST /bridge/:code from any origin (Figma plugins send
  // `Origin: null`). The pairing code is the auth — see the header comment.
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: uploadCors });
  if (request.method !== 'POST') return json(405, { error: 'POST only' }, uploadCors);
  if (env.BRIDGE_ENABLED !== 'true') return json(503, { error: BRIDGE_MESSAGES.disabled }, uploadCors);

  const code = String(rawCode).toUpperCase();
  if (!CODE_RE.test(code)) return json(400, { error: BRIDGE_MESSAGES.badCode }, uploadCors);

  if (!(await reserveBridgeSlot(env, 'upload', clientIp(request), deps.now()))) {
    return json(429, { error: BRIDGE_MESSAGES.sessionLimit }, uploadCors);
  }

  const raw = await request.text();
  const rawBytes = new TextEncoder().encode(raw).byteLength;
  if (rawBytes > BRIDGE_MAX_DUMP_BYTES) return json(413, { error: BRIDGE_MESSAGES.tooLarge }, uploadCors);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw); // shape is the receiver's referee's problem; transport only checks "is JSON"
  } catch {
    return json(400, { error: BRIDGE_MESSAGES.notJson }, uploadCors);
  }

  // Envelope kind: a payload tagged CONTRACTS-BUNDLE gets its envelope (and
  // ONLY its envelope) checked — a non-empty contracts array of objects.
  // A payload tagged CONTRACT-PROPOSAL (the Send tab's export, sent to
  // `ds-contracts figma receive`) gets the same envelope-only treatment: a
  // proposedContract object must be present. Contract contents are never
  // inspected here; the receiver's schema referee owns that. Everything
  // untagged is a dump, exactly as before.
  let kind: BridgePayloadKind = 'dump';
  const tag =
    parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as { type?: unknown }).type
      : undefined;
  if (tag === CONTRACTS_BUNDLE_TYPE) {
    const contracts = (parsed as { contracts?: unknown }).contracts;
    if (
      !Array.isArray(contracts) ||
      contracts.length === 0 ||
      contracts.some((c) => c === null || typeof c !== 'object' || Array.isArray(c))
    ) {
      return json(400, { error: BRIDGE_MESSAGES.badBundle }, uploadCors);
    }
    kind = 'contracts-bundle';
  } else if (tag === CONTRACT_PROPOSAL_TYPE) {
    const proposed = (parsed as { proposedContract?: unknown }).proposedContract;
    if (proposed === null || typeof proposed !== 'object' || Array.isArray(proposed)) {
      return json(400, { error: BRIDGE_MESSAGES.badProposal }, uploadCors);
    }
    kind = 'proposal';
  }

  // Session must be open. Wrong code and expired code take the identical
  // path (one KV read, one message) — nothing to distinguish by timing.
  if ((await env.ASSIST_KV.get(sessKey(code))) === null) {
    return json(404, { error: BRIDGE_MESSAGES.noSession }, uploadCors);
  }

  // Last write wins while the session is open (re-sending with corrected
  // target sets is a feature). Kind and body share one KV value, so readers
  // cannot observe a cross-generation pair during a resend.
  const stored: StoredPayload = { version: 1, kind, raw };
  await env.ASSIST_KV.put(payloadKey(code), JSON.stringify(stored), {
    expirationTtl: BRIDGE_TTL_SECONDS,
  });
  return json(200, { ok: true, bytes: rawBytes }, uploadCors);
}
