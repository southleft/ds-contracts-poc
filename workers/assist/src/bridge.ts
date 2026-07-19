/**
 * Plugin bridge — the "Send to Playground" transport. The Figma dev plugin
 * runs the SAME dump script the paste-box route uses (extract/figma/
 * dump.plugin.js) and POSTs the resulting dump v1 JSON here; the playground
 * picks it up under a short-lived pairing code. The bridge is a dumb pipe on
 * purpose:
 *
 *   POST /bridge/session   playground asks for a pairing code
 *   POST /bridge/:code     plugin uploads the dump (only while session open)
 *   GET  /bridge/:code     playground polls; delivery is ONE-TIME, then both
 *                          keys are deleted (TTL is the backstop either way)
 *
 * Privacy: dump contents are never logged, never inspected beyond "is it
 * JSON / is it under the size cap", and never persisted past delivery or the
 * 15-minute TTL — whichever comes first. KV deletes are best-effort (KV is
 * eventually consistent); the TTL bounds any residue.
 *
 * Origins, deliberately asymmetric:
 *   - session + read answer ONLY the playground origin (same gate as assist):
 *     the code is minted where the human is looking.
 *   - upload answers ANY origin, including none — a Figma plugin's fetch
 *     arrives with `Origin: null` (the plugin UI iframe is sandboxed), so an
 *     origin gate cannot help there. The pairing code IS the auth: 6 chars
 *     from a 31-symbol alphabet (~890M codes), crypto-random, one-time,
 *     15-minute TTL. Wrong-code and expired-code uploads run the same single
 *     KV read as a correct one, so errors are not timing-distinguishable.
 */
import type { Deps, Env } from './env';
import { corsHeaders, resolveOrigin } from './cors';
import { clientIp, reserveBridgeSlot } from './limits';

export const BRIDGE_TTL_SECONDS = 15 * 60;
export const BRIDGE_MAX_DUMP_BYTES = 4 * 1024 * 1024; // 4 MB of JSON text

/** Unambiguous alphabet — no I/L/O/0/1 (31 symbols). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

/** Payload types the bridge carries. Dumps (plugin → playground, the
 *  original direction) are untagged JSON; a CONTRACTS-BUNDLE (CLI/CI →
 *  plugin, the reverse direction: `ds-contracts figma push`) is tagged with
 *  this envelope type so the receiver can branch WITHOUT the bridge ever
 *  inspecting contract contents — the transport stays a dumb pipe, it only
 *  checks the envelope is well-formed and remembers which kind it carried. */
export const CONTRACTS_BUNDLE_TYPE = 'CONTRACTS-BUNDLE';
export type BridgePayloadKind = 'dump' | 'contracts-bundle';

export const BRIDGE_MESSAGES = {
  disabled: 'the plugin bridge is switched off — the owner has not enabled it yet',
  forbiddenOrigin:
    'the bridge only answers the ds-contracts playground — this origin is not allowed',
  sessionLimit: 'bridge limit reached for today from this network — try again tomorrow',
  badCode:
    'that is not a bridge code — codes are 6 letters/digits shown in the playground’s “Receive from plugin” panel',
  noSession:
    'nothing is waiting under that code — check the characters against the playground, or press “Receive from plugin” there for a fresh code (codes expire after 15 minutes)',
  tooLarge:
    'that dump is too large for the bridge (over 4 MB) — narrow the target sets in the plugin and send again, or fall back to copy/paste',
  notJson:
    'the bridge only carries JSON — this usually means a truncated send; try Send again',
  expired:
    'this code has expired or its dump was already delivered — press “Receive from plugin” for a fresh code',
  badBundle:
    'that is tagged CONTRACTS-BUNDLE but is not a well-formed bundle — it needs a non-empty "contracts" array of contract documents (ds-contracts figma push builds one for you)',
} as const;

const sessKey = (code: string) => `bridge:sess:${code}`;
const dumpKey = (code: string) => `bridge:dump:${code}`;
const kindKey = (code: string) => `bridge:kind:${code}`;

const json = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

/** CORS for the upload route: any origin, including the plugin's `null`. */
const uploadCors: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
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
    // Playground-only side: same origin gate as assist.
    const origin = resolveOrigin(request, env);
    if (!origin) return json(403, { error: BRIDGE_MESSAGES.forbiddenOrigin });
    const cors = corsHeaders(origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (env.BRIDGE_ENABLED !== 'true') return json(503, { error: BRIDGE_MESSAGES.disabled }, cors);

    if (isSessionRoute) {
      if (request.method !== 'POST') return json(405, { error: 'POST only' }, cors);
      if (!(await reserveBridgeSlot(env, 'session', clientIp(request), deps.now()))) {
        return json(429, { error: BRIDGE_MESSAGES.sessionLimit }, cors);
      }
      const code = randomCode();
      await env.ASSIST_KV.put(sessKey(code), deps.now().toISOString(), {
        expirationTtl: BRIDGE_TTL_SECONDS,
      });
      return json(200, { code, ttlSeconds: BRIDGE_TTL_SECONDS }, cors);
    }

    // GET /bridge/:code — poll + one-time read.
    const code = String(rawCode).toUpperCase();
    if (!CODE_RE.test(code)) return json(400, { error: BRIDGE_MESSAGES.badCode }, cors);
    const dump = await env.ASSIST_KV.get(dumpKey(code));
    if (dump !== null) {
      // Payload kind, recorded at upload ('dump' when absent — pre-bundle
      // uploads and the original direction). Old receivers ignore the field.
      const kind = ((await env.ASSIST_KV.get(kindKey(code))) ?? 'dump') as BridgePayloadKind;
      // One-time read: delete BEFORE answering; the dump exists nowhere
      // after this response (TTL is the backstop for KV consistency lag).
      await env.ASSIST_KV.delete(dumpKey(code));
      await env.ASSIST_KV.delete(kindKey(code));
      await env.ASSIST_KV.delete(sessKey(code));
      // `dump` was validated as JSON at upload — splice it in verbatim.
      return new Response(`{"status":"delivered","kind":${JSON.stringify(kind)},"dump":${dump}}`, {
        status: 200,
        headers: { 'content-type': 'application/json', ...cors },
      });
    }
    if ((await env.ASSIST_KV.get(sessKey(code))) !== null) {
      return json(200, { status: 'waiting' }, cors);
    }
    return json(410, { error: BRIDGE_MESSAGES.expired }, cors);
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
  if (raw.length > BRIDGE_MAX_DUMP_BYTES) return json(413, { error: BRIDGE_MESSAGES.tooLarge }, uploadCors);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw); // shape is the receiver's referee's problem; transport only checks "is JSON"
  } catch {
    return json(400, { error: BRIDGE_MESSAGES.notJson }, uploadCors);
  }

  // Envelope kind: a payload tagged CONTRACTS-BUNDLE gets its envelope (and
  // ONLY its envelope) checked — a non-empty contracts array of objects.
  // Contract contents are never inspected here; the plugin's schema referee
  // owns that. Everything untagged is a dump, exactly as before.
  let kind: BridgePayloadKind = 'dump';
  if (
    parsed !== null &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    (parsed as { type?: unknown }).type === CONTRACTS_BUNDLE_TYPE
  ) {
    const contracts = (parsed as { contracts?: unknown }).contracts;
    if (
      !Array.isArray(contracts) ||
      contracts.length === 0 ||
      contracts.some((c) => c === null || typeof c !== 'object' || Array.isArray(c))
    ) {
      return json(400, { error: BRIDGE_MESSAGES.badBundle }, uploadCors);
    }
    kind = 'contracts-bundle';
  }

  // Session must be open. Wrong code and expired code take the identical
  // path (one KV read, one message) — nothing to distinguish by timing.
  if ((await env.ASSIST_KV.get(sessKey(code))) === null) {
    return json(404, { error: BRIDGE_MESSAGES.noSession }, uploadCors);
  }

  // Last write wins while the session is open (re-sending with corrected
  // target sets is a feature); delivery or TTL ends the session.
  await env.ASSIST_KV.put(dumpKey(code), raw, { expirationTtl: BRIDGE_TTL_SECONDS });
  await env.ASSIST_KV.put(kindKey(code), kind, { expirationTtl: BRIDGE_TTL_SECONDS });
  return json(200, { ok: true, bytes: raw.length }, uploadCors);
}
