/**
 * Plugin-bridge unit checks — plain node:test, no vitest, no workerd (same
 * discipline as handler.test.ts: full handler pipeline against a Map-backed
 * KV; what needs live infra — real KV consistency/TTL expiry, real
 * CF-Connecting-IP — is out of scope here and named in the README).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/index';
import {
  BRIDGE_MAX_DUMP_BYTES,
  BRIDGE_MESSAGES,
  BRIDGE_TTL_SECONDS,
  CODE_ALPHABET,
  CODE_LENGTH,
  randomCode,
} from '../src/bridge';
import type { Env, KVNamespaceLite, Deps } from '../src/env';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

class MemoryKV implements KVNamespaceLite {
  store = new Map<string, string>();
  /** expirationTtl per key, recorded so tests can assert the 15-minute cap. */
  ttls = new Map<string, number | undefined>();
  async get(key: string): Promise<string | null> {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    this.store.set(key, value);
    this.ttls.set(key, options?.expirationTtl);
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

function makeEnv(overrides: Partial<Env> = {}): Env & { ASSIST_KV: MemoryKV } {
  return {
    ANTHROPIC_API_KEY: 'sk-ant-test-not-a-real-key',
    ASSIST_KV: new MemoryKV(),
    ASSIST_ENABLED: 'true',
    BRIDGE_ENABLED: 'true',
    ...overrides,
  } as Env & { ASSIST_KV: MemoryKV };
}

const ORIGIN = 'https://ds-contracts-playground.pages.dev';

/** The Anthropic transport must never be reached by bridge routes. */
const deps: Deps = {
  fetchImpl: (() => {
    throw new Error('bridge routes must not fetch');
  }) as unknown as typeof fetch,
  now: () => new Date('2026-07-09T12:00:00Z'),
};

function req(
  path: string,
  opts: { origin?: string | null; method?: string; ip?: string; body?: string } = {},
): Request {
  const headers = new Headers();
  // `origin: null` = no Origin header (curl); `origin: 'null'` = the literal
  // "null" origin a Figma plugin iframe sends.
  if (opts.origin !== null) headers.set('origin', opts.origin ?? ORIGIN);
  headers.set('cf-connecting-ip', opts.ip ?? '203.0.113.7');
  const method = opts.method ?? 'POST';
  return new Request(`https://assist.example${path}`, {
    method,
    headers,
    body: method === 'GET' || method === 'OPTIONS' ? undefined : (opts.body ?? '{}'),
  });
}

const DUMP = JSON.stringify({
  _provenance: { fileKey: 'abc', note: 'test dump' },
  Badge: { setName: 'Badge', type: 'COMPONENT_SET', variants: [] },
});

async function createSession(env: Env & { ASSIST_KV: MemoryKV }): Promise<string> {
  const res = await handleRequest(req('/bridge/session'), env, deps);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { code: string; ttlSeconds: number };
  return body.code;
}

// ---------------------------------------------------------------------------
// Codes
// ---------------------------------------------------------------------------

test('codes: 6 chars from the unambiguous alphabet, no I/L/O/0/1, not obviously repeating', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const code = randomCode();
    assert.equal(code.length, CODE_LENGTH);
    for (const ch of code) assert.ok(CODE_ALPHABET.includes(ch), `unexpected char ${ch}`);
    seen.add(code);
  }
  assert.ok(seen.size > 190, 'codes should be effectively unique across 200 draws');
  for (const banned of ['I', 'L', 'O', '0', '1']) assert.ok(!CODE_ALPHABET.includes(banned));
});

// ---------------------------------------------------------------------------
// Session lifecycle + one-time read
// ---------------------------------------------------------------------------

test('lifecycle: create session → waiting → plugin upload (null origin) → delivered once → gone', async () => {
  const env = makeEnv();

  // 1. Playground asks for a code.
  const created = await handleRequest(req('/bridge/session'), env, deps);
  assert.equal(created.status, 200);
  const { code, ttlSeconds } = (await created.json()) as { code: string; ttlSeconds: number };
  assert.match(code, new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`));
  assert.equal(ttlSeconds, BRIDGE_TTL_SECONDS);
  assert.equal(env.ASSIST_KV.ttls.get(`bridge:sess:${code}`), BRIDGE_TTL_SECONDS);

  // 2. Poll before any upload: waiting.
  const waiting = await handleRequest(req(`/bridge/${code}`, { method: 'GET' }), env, deps);
  assert.equal(waiting.status, 200);
  assert.deepEqual(await waiting.json(), { status: 'waiting' });

  // 3. The plugin uploads — Origin is the literal "null" a Figma plugin sends.
  const sent = await handleRequest(req(`/bridge/${code}`, { origin: 'null', body: DUMP }), env, deps);
  assert.equal(sent.status, 200);
  assert.deepEqual(await sent.json(), { ok: true, bytes: DUMP.length });
  assert.equal(sent.headers.get('access-control-allow-origin'), '*');
  assert.equal(env.ASSIST_KV.ttls.get(`bridge:dump:${code}`), BRIDGE_TTL_SECONDS);

  // 4. Poll again: delivered, dump byte-identical.
  const delivered = await handleRequest(req(`/bridge/${code}`, { method: 'GET' }), env, deps);
  assert.equal(delivered.status, 200);
  const body = (await delivered.json()) as { status: string; dump: unknown };
  assert.equal(body.status, 'delivered');
  assert.deepEqual(body.dump, JSON.parse(DUMP));

  // 5. One-time read: both keys deleted; the second poll answers 410 by name.
  assert.ok(!env.ASSIST_KV.store.has(`bridge:dump:${code}`));
  assert.ok(!env.ASSIST_KV.store.has(`bridge:sess:${code}`));
  const again = await handleRequest(req(`/bridge/${code}`, { method: 'GET' }), env, deps);
  assert.equal(again.status, 410);
  assert.equal(((await again.json()) as { error: string }).error, BRIDGE_MESSAGES.expired);
});

test('lifecycle: a lowercase hand-typed code pairs (normalized to uppercase)', async () => {
  const env = makeEnv();
  const code = await createSession(env);
  const sent = await handleRequest(
    req(`/bridge/${code.toLowerCase()}`, { origin: 'null', body: DUMP }),
    env,
    deps,
  );
  assert.equal(sent.status, 200);
  const delivered = await handleRequest(
    req(`/bridge/${code.toLowerCase()}`, { method: 'GET' }),
    env,
    deps,
  );
  assert.equal(((await delivered.json()) as { status: string }).status, 'delivered');
});

test('lifecycle: re-sending while the session is open overwrites (last write wins)', async () => {
  const env = makeEnv();
  const code = await createSession(env);
  const first = JSON.stringify({ A: { variants: [] } });
  await handleRequest(req(`/bridge/${code}`, { origin: 'null', body: first }), env, deps);
  await handleRequest(req(`/bridge/${code}`, { origin: 'null', body: DUMP }), env, deps);
  const delivered = await handleRequest(req(`/bridge/${code}`, { method: 'GET' }), env, deps);
  assert.deepEqual(((await delivered.json()) as { dump: unknown }).dump, JSON.parse(DUMP));
});

// ---------------------------------------------------------------------------
// Wrong code / expired session / TTL
// ---------------------------------------------------------------------------

test('wrong code: upload to a code nobody minted answers 404 with the named message', async () => {
  const env = makeEnv();
  const res = await handleRequest(req('/bridge/ABC234', { origin: 'null', body: DUMP }), env, deps);
  assert.equal(res.status, 404);
  assert.equal(((await res.json()) as { error: string }).error, BRIDGE_MESSAGES.noSession);
  assert.equal([...env.ASSIST_KV.store.keys()].filter((k) => k.startsWith('bridge:dump:')).length, 0);
});

test('wrong code: a malformed code is refused by shape on both sides (no KV probe)', async () => {
  const env = makeEnv();
  const up = await handleRequest(req('/bridge/nope', { origin: 'null', body: DUMP }), env, deps);
  assert.equal(up.status, 400);
  assert.equal(((await up.json()) as { error: string }).error, BRIDGE_MESSAGES.badCode);
  const down = await handleRequest(req('/bridge/toolong99', { method: 'GET' }), env, deps);
  assert.equal(down.status, 400);
});

test('TTL: an expired session (KV entry gone) refuses the upload — "only while session open"', async () => {
  const env = makeEnv();
  const code = await createSession(env);
  env.ASSIST_KV.store.delete(`bridge:sess:${code}`); // TTL elapsed
  const res = await handleRequest(req(`/bridge/${code}`, { origin: 'null', body: DUMP }), env, deps);
  assert.equal(res.status, 404);
  assert.equal(((await res.json()) as { error: string }).error, BRIDGE_MESSAGES.noSession);
});

test('TTL: every bridge KV write carries the 15-minute expirationTtl', async () => {
  const env = makeEnv();
  const code = await createSession(env);
  await handleRequest(req(`/bridge/${code}`, { origin: 'null', body: DUMP }), env, deps);
  for (const key of [`bridge:sess:${code}`, `bridge:dump:${code}`]) {
    assert.equal(env.ASSIST_KV.ttls.get(key), BRIDGE_TTL_SECONDS, key);
  }
});

// ---------------------------------------------------------------------------
// Size cap / non-JSON
// ---------------------------------------------------------------------------

test('size cap: an over-4MB dump is refused 413 by name and nothing is stored', async () => {
  const env = makeEnv();
  const code = await createSession(env);
  const big = '{"pad":"' + 'x'.repeat(BRIDGE_MAX_DUMP_BYTES) + '"}';
  const res = await handleRequest(req(`/bridge/${code}`, { origin: 'null', body: big }), env, deps);
  assert.equal(res.status, 413);
  assert.equal(((await res.json()) as { error: string }).error, BRIDGE_MESSAGES.tooLarge);
  assert.ok(!env.ASSIST_KV.store.has(`bridge:dump:${code}`));
});

test('non-JSON body: refused 400 by name (truncated sends do not poison the session)', async () => {
  const env = makeEnv();
  const code = await createSession(env);
  const res = await handleRequest(
    req(`/bridge/${code}`, { origin: 'null', body: '{"cut off' }),
    env,
    deps,
  );
  assert.equal(res.status, 400);
  assert.equal(((await res.json()) as { error: string }).error, BRIDGE_MESSAGES.notJson);
  const waiting = await handleRequest(req(`/bridge/${code}`, { method: 'GET' }), env, deps);
  assert.deepEqual(await waiting.json(), { status: 'waiting' });
});

// ---------------------------------------------------------------------------
// Rate limits
// ---------------------------------------------------------------------------

test('rate limit: session creation N+1 answers 429; uploads are their own class; other IPs unaffected', async () => {
  const env = makeEnv({ BRIDGE_IP_DAILY_LIMIT: '2' });
  const codeA = await createSession(env);
  await createSession(env);
  const third = await handleRequest(req('/bridge/session'), env, deps);
  assert.equal(third.status, 429);
  assert.equal(((await third.json()) as { error: string }).error, BRIDGE_MESSAGES.sessionLimit);
  // The session cap does not burn the upload class for the same IP.
  const sent = await handleRequest(req(`/bridge/${codeA}`, { origin: 'null', body: DUMP }), env, deps);
  assert.equal(sent.status, 200);
  // A different visitor still gets a session.
  const other = await handleRequest(req('/bridge/session', { ip: '198.51.100.9' }), env, deps);
  assert.equal(other.status, 200);
});

test('rate limit: polling is uncounted — a long wait never trips the cap', async () => {
  const env = makeEnv({ BRIDGE_IP_DAILY_LIMIT: '1' });
  const code = await createSession(env);
  for (let i = 0; i < 10; i++) {
    const poll = await handleRequest(req(`/bridge/${code}`, { method: 'GET' }), env, deps);
    assert.equal(poll.status, 200);
  }
});

// ---------------------------------------------------------------------------
// Origins (asymmetric by design) + kill switch
// ---------------------------------------------------------------------------

test('origins: session and read answer the playground only; upload answers anyone with the code', async () => {
  const env = makeEnv();
  // Session from an unlisted origin / no origin: refused.
  assert.equal((await handleRequest(req('/bridge/session', { origin: 'https://evil.example' }), env, deps)).status, 403);
  assert.equal((await handleRequest(req('/bridge/session', { origin: null }), env, deps)).status, 403);
  // Read from the plugin's null origin: refused (the code renders in the playground).
  const code = await createSession(env);
  assert.equal((await handleRequest(req(`/bridge/${code}`, { method: 'GET', origin: 'null' }), env, deps)).status, 403);
  // Upload with NO origin header at all (curl-shaped) still lands: the code is the auth.
  const sent = await handleRequest(req(`/bridge/${code}`, { origin: null, body: DUMP }), env, deps);
  assert.equal(sent.status, 200);
});

test('origins: preview subdomains create sessions; upload preflight answers 204 with *', async () => {
  const env = makeEnv();
  const preview = 'https://abc123.ds-contracts-playground.pages.dev';
  const created = await handleRequest(req('/bridge/session', { origin: preview }), env, deps);
  assert.equal(created.status, 200);
  assert.equal(created.headers.get('access-control-allow-origin'), preview);
  const preflight = await handleRequest(
    req('/bridge/ABC234', { origin: 'null', method: 'OPTIONS' }),
    env,
    deps,
  );
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), '*');
});

test('kill switch: BRIDGE_ENABLED unset answers 503 on every bridge route, and is independent of ASSIST_ENABLED', async () => {
  const env = makeEnv({ BRIDGE_ENABLED: undefined, ASSIST_ENABLED: 'true' });
  const created = await handleRequest(req('/bridge/session'), env, deps);
  assert.equal(created.status, 503);
  assert.equal(((await created.json()) as { error: string }).error, BRIDGE_MESSAGES.disabled);
  const up = await handleRequest(req('/bridge/ABC234', { origin: 'null', body: DUMP }), env, deps);
  assert.equal(up.status, 503);
  // And the reverse: assist off does not kill the bridge.
  const env2 = makeEnv({ ASSIST_ENABLED: 'false' });
  assert.equal((await handleRequest(req('/bridge/session'), env2, deps)).status, 200);
});

test('methods: GET /bridge/session and PUT /bridge/:code answer 405', async () => {
  const env = makeEnv();
  assert.equal((await handleRequest(req('/bridge/session', { method: 'GET' }), env, deps)).status, 405);
  const code = await createSession(env);
  assert.equal(
    (await handleRequest(req(`/bridge/${code}`, { origin: 'null', method: 'PUT', body: DUMP }), env, deps)).status,
    405,
  );
});
