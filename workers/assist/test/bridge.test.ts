/**
 * Plugin-bridge unit checks — plain node:test, no vitest, no workerd (same
 * discipline as handler.test.ts: full handler pipeline against a Map-backed
 * KV; what needs live infra — real KV consistency/TTL expiry, real
 * CF-Connecting-IP — is out of scope here and named in the README).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { handleRequest } from '../src/index';
import {
  BRIDGE_MAX_DUMP_BYTES,
  BRIDGE_MESSAGES,
  BRIDGE_TTL_SECONDS,
  CODE_ALPHABET,
  CODE_LENGTH,
  CONTRACT_PROPOSAL_TYPE,
  CONTRACTS_BUNDLE_TYPE,
  READ_CAPABILITY_BYTES,
  READ_CAPABILITY_HEADER,
  randomCode,
  randomReadCapability,
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
const readCapabilities = new Map<string, string>();

/** The Anthropic transport must never be reached by bridge routes. */
const deps: Deps = {
  fetchImpl: (() => {
    throw new Error('bridge routes must not fetch');
  }) as unknown as typeof fetch,
  now: () => new Date('2026-07-09T12:00:00Z'),
};

function req(
  path: string,
  opts: {
    origin?: string | null;
    method?: string;
    ip?: string;
    body?: string;
    capability?: string | null;
  } = {},
): Request {
  const headers = new Headers();
  // `origin: null` = no Origin header (curl); `origin: 'null'` = the literal
  // "null" origin a Figma plugin iframe sends.
  if (opts.origin !== null) headers.set('origin', opts.origin ?? ORIGIN);
  headers.set('cf-connecting-ip', opts.ip ?? '203.0.113.7');
  const method = opts.method ?? 'POST';
  const code = /^\/bridge\/([^/?]+)$/.exec(path)?.[1]?.toUpperCase();
  const capability =
    opts.capability === null ? undefined : (opts.capability ?? (code ? readCapabilities.get(code) : undefined));
  if (method === 'GET' && capability) headers.set(READ_CAPABILITY_HEADER, capability);
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
  const body = (await res.json()) as { code: string; readCapability: string; ttlSeconds: number };
  readCapabilities.set(body.code, body.readCapability);
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

test('read capabilities: independent 192-bit values are well-shaped and effectively unique', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const capability = randomReadCapability();
    assert.match(capability, /^[0-9a-f]+$/);
    assert.equal(capability.length, READ_CAPABILITY_BYTES * 2);
    seen.add(capability);
  }
  assert.equal(seen.size, 200);
});

// ---------------------------------------------------------------------------
// Session lifecycle + one-time read
// ---------------------------------------------------------------------------

test('lifecycle: create session → waiting → plugin upload (null origin) → delivered once → gone', async () => {
  const env = makeEnv();

  // 1. Playground asks for a code.
  const created = await handleRequest(req('/bridge/session'), env, deps);
  assert.equal(created.status, 200);
  const { code, readCapability, ttlSeconds } = (await created.json()) as {
    code: string;
    readCapability: string;
    ttlSeconds: number;
  };
  readCapabilities.set(code, readCapability);
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
  assert.deepEqual(await sent.json(), { ok: true, bytes: Buffer.byteLength(DUMP, 'utf8') });
  assert.equal(sent.headers.get('access-control-allow-origin'), '*');
  assert.equal(env.ASSIST_KV.ttls.get(`bridge:payload:${code}`), BRIDGE_TTL_SECONDS);

  // 4. Poll again: delivered, dump byte-identical.
  const delivered = await handleRequest(req(`/bridge/${code}`, { method: 'GET' }), env, deps);
  assert.equal(delivered.status, 200);
  const body = (await delivered.json()) as { status: string; dump: unknown };
  assert.equal(body.status, 'delivered');
  assert.deepEqual(body.dump, JSON.parse(DUMP));

  // 5. One-time read: payload, session, kind, and read capability are deleted.
  assert.ok(!env.ASSIST_KV.store.has(`bridge:payload:${code}`));
  assert.ok(!env.ASSIST_KV.store.has(`bridge:sess:${code}`));
  assert.ok(!env.ASSIST_KV.store.has(`bridge:read-cap:${code}`));
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
// CONTRACTS-BUNDLE payloads (ds-contracts figma push — the reverse direction)
// ---------------------------------------------------------------------------

const BUNDLE = JSON.stringify({
  type: CONTRACTS_BUNDLE_TYPE,
  version: 1,
  contracts: [{ id: 'acme.pill', name: 'Pill', version: '1.0.0', props: [] }],
});

test('bundle: CLI push (no origin) → delivered once with kind "contracts-bundle", byte-identical, all keys gone', async () => {
  const env = makeEnv();
  const code = await createSession(env);
  // `ds-contracts figma push` is a plain fetch — no Origin header at all.
  const sent = await handleRequest(req(`/bridge/${code}`, { origin: null, body: BUNDLE }), env, deps);
  assert.equal(sent.status, 200);
  assert.deepEqual(await sent.json(), { ok: true, bytes: Buffer.byteLength(BUNDLE, 'utf8') });
  const storedBundle = JSON.parse(env.ASSIST_KV.store.get(`bridge:payload:${code}`) as string);
  assert.equal(storedBundle.kind, 'contracts-bundle');
  assert.equal(storedBundle.raw, BUNDLE);
  assert.equal(env.ASSIST_KV.ttls.get(`bridge:payload:${code}`), BRIDGE_TTL_SECONDS);

  const delivered = await handleRequest(
    req(`/bridge/${code}`, { method: 'GET', capability: null }),
    env,
    deps,
  );
  assert.equal(delivered.status, 200);
  const body = (await delivered.json()) as { status: string; kind: string; dump: unknown };
  assert.equal(body.status, 'delivered');
  assert.equal(body.kind, 'contracts-bundle');
  assert.deepEqual(body.dump, JSON.parse(BUNDLE));

  // One-time read deletes the kind marker along with dump + session.
  for (const k of [
    `bridge:payload:${code}`,
    `bridge:dump:${code}`,
    `bridge:kind:${code}`,
    `bridge:sess:${code}`,
    `bridge:read-cap:${code}`,
  ]) {
    assert.ok(!env.ASSIST_KV.store.has(k), k);
  }
  const again = await handleRequest(req(`/bridge/${code}`, { method: 'GET' }), env, deps);
  assert.equal(again.status, 410);
});

test('bundle: a dump delivery carries kind "dump" (receivers can branch)', async () => {
  const env = makeEnv();
  const code = await createSession(env);
  await handleRequest(req(`/bridge/${code}`, { origin: 'null', body: DUMP }), env, deps);
  const delivered = await handleRequest(req(`/bridge/${code}`, { method: 'GET' }), env, deps);
  const body = (await delivered.json()) as { status: string; kind: string; dump: unknown };
  assert.equal(body.kind, 'dump');
  assert.deepEqual(body.dump, JSON.parse(DUMP));
});

test('bundle: a malformed CONTRACTS-BUNDLE envelope is refused 400 by name, nothing stored, session stays open', async () => {
  const env = makeEnv();
  const code = await createSession(env);
  for (const bad of [
    JSON.stringify({ type: CONTRACTS_BUNDLE_TYPE }), // no contracts
    JSON.stringify({ type: CONTRACTS_BUNDLE_TYPE, contracts: [] }), // empty
    JSON.stringify({ type: CONTRACTS_BUNDLE_TYPE, contracts: ['not-an-object'] }),
    JSON.stringify({ type: CONTRACTS_BUNDLE_TYPE, contracts: [null] }),
  ]) {
    const res = await handleRequest(req(`/bridge/${code}`, { origin: null, body: bad }), env, deps);
    assert.equal(res.status, 400, bad);
    assert.equal(((await res.json()) as { error: string }).error, BRIDGE_MESSAGES.badBundle);
  }
  assert.ok(!env.ASSIST_KV.store.has(`bridge:payload:${code}`));
  const waiting = await handleRequest(req(`/bridge/${code}`, { method: 'GET' }), env, deps);
  assert.deepEqual(await waiting.json(), { status: 'waiting' });
});

test('bundle: last write wins across kinds — a dump then a bundle delivers the bundle with its kind', async () => {
  const env = makeEnv();
  const code = await createSession(env);
  await handleRequest(req(`/bridge/${code}`, { origin: 'null', body: DUMP }), env, deps);
  await handleRequest(req(`/bridge/${code}`, { origin: null, body: BUNDLE }), env, deps);
  const delivered = await handleRequest(
    req(`/bridge/${code}`, { method: 'GET', capability: null }),
    env,
    deps,
  );
  const body = (await delivered.json()) as { kind: string; dump: unknown };
  assert.equal(body.kind, 'contracts-bundle');
  assert.deepEqual(body.dump, JSON.parse(BUNDLE));
});

test('cross-kind resend: stale old bundle keys cannot downgrade a new dump to an unprotected kind', async () => {
  const env = makeEnv();
  const code = await createSession(env);
  env.ASSIST_KV.store.set(`bridge:dump:${code}`, BUNDLE);
  env.ASSIST_KV.store.set(`bridge:kind:${code}`, 'contracts-bundle');

  const resent = await handleRequest(req(`/bridge/${code}`, { origin: 'null', body: DUMP }), env, deps);
  assert.equal(resent.status, 200);

  const withoutCapability = await handleRequest(
    req(`/bridge/${code}`, { method: 'GET', capability: null }),
    env,
    deps,
  );
  assert.equal(withoutCapability.status, 403);
  assert.equal(
    ((await withoutCapability.json()) as { error: string }).error,
    BRIDGE_MESSAGES.readCapability,
  );

  const delivered = await handleRequest(req(`/bridge/${code}`, { method: 'GET' }), env, deps);
  assert.equal(delivered.status, 200);
  const body = (await delivered.json()) as { kind: string; dump: unknown };
  assert.equal(body.kind, 'dump');
  assert.deepEqual(body.dump, JSON.parse(DUMP));
});

test('legacy read: stale or unknown kind markers never unprotect an old-format dump', async () => {
  for (const staleKind of ['contracts-bundle', 'proposal', 'future-kind']) {
    const env = makeEnv();
    const code = await createSession(env);
    env.ASSIST_KV.store.set(`bridge:dump:${code}`, DUMP);
    env.ASSIST_KV.store.set(`bridge:kind:${code}`, staleKind);

    const refused = await handleRequest(
      req(`/bridge/${code}`, { method: 'GET', capability: null }),
      env,
      deps,
    );
    assert.equal(refused.status, 403, staleKind);
    assert.equal(
      ((await refused.json()) as { error: string }).error,
      BRIDGE_MESSAGES.readCapability,
    );
    assert.ok(env.ASSIST_KV.store.has(`bridge:dump:${code}`));
  }
});

test('legacy read: a valid old-format bundle remains code-readable without dump capability', async () => {
  const env = makeEnv();
  const code = await createSession(env);
  env.ASSIST_KV.store.set(`bridge:dump:${code}`, BUNDLE);
  env.ASSIST_KV.store.set(`bridge:kind:${code}`, 'contracts-bundle');
  const delivered = await handleRequest(
    req(`/bridge/${code}`, { method: 'GET', capability: null }),
    env,
    deps,
  );
  assert.equal(delivered.status, 200);
  const body = (await delivered.json()) as { kind: string; dump: unknown };
  assert.equal(body.kind, 'contracts-bundle');
  assert.deepEqual(body.dump, JSON.parse(BUNDLE));
});

// ---------------------------------------------------------------------------
// CONTRACT-PROPOSAL payloads (plugin Propose tab → `ds-contracts figma
// receive` — the dev door, no GitHub)
// ---------------------------------------------------------------------------

const PROPOSAL = JSON.stringify({
  type: CONTRACT_PROPOSAL_TYPE,
  baseContractId: 'acme.pill',
  baseVersion: '1.0.0',
  setName: 'Pill',
  summary: ['prop `tone`: enum value "warning" added'],
  proposedContract: { id: 'acme.pill', name: 'Pill', version: '1.1.0', props: [] },
  proposalNotes: [],
});

test('proposal: plugin upload ("null" origin) → CLI GET (no origin) delivers once with kind "proposal", byte-identical, all keys gone', async () => {
  const env = makeEnv();
  const code = await createSession(env);
  // The plugin's fetch arrives with the literal "null" origin.
  const sent = await handleRequest(req(`/bridge/${code}`, { origin: 'null', body: PROPOSAL }), env, deps);
  assert.equal(sent.status, 200);
  assert.deepEqual(await sent.json(), { ok: true, bytes: Buffer.byteLength(PROPOSAL, 'utf8') });
  const storedProposal = JSON.parse(env.ASSIST_KV.store.get(`bridge:payload:${code}`) as string);
  assert.equal(storedProposal.kind, 'proposal');
  assert.equal(storedProposal.raw, PROPOSAL);
  assert.equal(env.ASSIST_KV.ttls.get(`bridge:payload:${code}`), BRIDGE_TTL_SECONDS);

  // `figma receive` is a plain node fetch — no Origin header at all. The
  // pairing code is the auth; the proposal delivers.
  const delivered = await handleRequest(
    req(`/bridge/${code}`, { method: 'GET', origin: null, capability: null }),
    env,
    deps,
  );
  assert.equal(delivered.status, 200);
  const body = (await delivered.json()) as { status: string; kind: string; dump: unknown };
  assert.equal(body.status, 'delivered');
  assert.equal(body.kind, 'proposal');
  assert.deepEqual(body.dump, JSON.parse(PROPOSAL));

  // One-time read deletes the kind marker along with dump + session.
  for (const k of [
    `bridge:payload:${code}`,
    `bridge:dump:${code}`,
    `bridge:kind:${code}`,
    `bridge:sess:${code}`,
    `bridge:read-cap:${code}`,
  ]) {
    assert.ok(!env.ASSIST_KV.store.has(k), k);
  }
  const again = await handleRequest(req(`/bridge/${code}`, { method: 'GET', origin: null }), env, deps);
  assert.equal(again.status, 410);
});

test('proposal: a malformed CONTRACT-PROPOSAL envelope is refused 400 by name, nothing stored, session stays open', async () => {
  const env = makeEnv();
  const code = await createSession(env);
  for (const bad of [
    JSON.stringify({ type: CONTRACT_PROPOSAL_TYPE }), // no proposedContract
    JSON.stringify({ type: CONTRACT_PROPOSAL_TYPE, proposedContract: null }),
    JSON.stringify({ type: CONTRACT_PROPOSAL_TYPE, proposedContract: 'not-an-object' }),
    JSON.stringify({ type: CONTRACT_PROPOSAL_TYPE, proposedContract: [1, 2] }),
  ]) {
    const res = await handleRequest(req(`/bridge/${code}`, { origin: 'null', body: bad }), env, deps);
    assert.equal(res.status, 400, bad);
    assert.equal(((await res.json()) as { error: string }).error, BRIDGE_MESSAGES.badProposal);
  }
  assert.ok(!env.ASSIST_KV.store.has(`bridge:payload:${code}`));
  const waiting = await handleRequest(req(`/bridge/${code}`, { method: 'GET' }), env, deps);
  assert.deepEqual(await waiting.json(), { status: 'waiting' });
});

// ---------------------------------------------------------------------------
// Wrong code / expired session / TTL
// ---------------------------------------------------------------------------

test('wrong code: upload to a code nobody minted answers 404 with the named message', async () => {
  const env = makeEnv();
  const res = await handleRequest(req('/bridge/ABC234', { origin: 'null', body: DUMP }), env, deps);
  assert.equal(res.status, 404);
  assert.equal(((await res.json()) as { error: string }).error, BRIDGE_MESSAGES.noSession);
  assert.equal([...env.ASSIST_KV.store.keys()].filter((k) => k.startsWith('bridge:payload:')).length, 0);
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
  for (const key of [`bridge:sess:${code}`, `bridge:read-cap:${code}`, `bridge:payload:${code}`]) {
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
  assert.ok(!env.ASSIST_KV.store.has(`bridge:payload:${code}`));
});

test('size cap: counts UTF-8 bytes rather than JavaScript string length', async () => {
  const env = makeEnv();
  const code = await createSession(env);
  const multibyte = JSON.stringify({ pad: '💥'.repeat(Math.ceil(BRIDGE_MAX_DUMP_BYTES / 3)) });
  assert.ok(multibyte.length < BRIDGE_MAX_DUMP_BYTES);
  assert.ok(Buffer.byteLength(multibyte, 'utf8') > BRIDGE_MAX_DUMP_BYTES);
  const res = await handleRequest(
    req(`/bridge/${code}`, { origin: 'null', body: multibyte }),
    env,
    deps,
  );
  assert.equal(res.status, 413);
  assert.equal(((await res.json()) as { error: string }).error, BRIDGE_MESSAGES.tooLarge);
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

test('rate limit: normal polling fits, then exhaustion is refused per code + IP without consuming payload', async () => {
  const env = makeEnv({ BRIDGE_POLL_DAILY_LIMIT: '3' });
  const code = await createSession(env);
  for (let i = 0; i < 3; i++) {
    const poll = await handleRequest(req(`/bridge/${code}`, { method: 'GET' }), env, deps);
    assert.equal(poll.status, 200);
  }
  const exhausted = await handleRequest(req(`/bridge/${code}`, { method: 'GET' }), env, deps);
  assert.equal(exhausted.status, 429);
  assert.equal(((await exhausted.json()) as { error: string }).error, BRIDGE_MESSAGES.pollLimit);

  // A different receiver network has an independent allowance and can still
  // retrieve the uploaded payload.
  const sent = await handleRequest(req(`/bridge/${code}`, { origin: 'null', body: DUMP }), env, deps);
  assert.equal(sent.status, 200);
  const otherIp = await handleRequest(
    req(`/bridge/${code}`, { method: 'GET', ip: '198.51.100.9' }),
    env,
    deps,
  );
  assert.equal(otherIp.status, 200);
});

// ---------------------------------------------------------------------------
// Origins (asymmetric by design) + kill switch
// ---------------------------------------------------------------------------

test('authorization: spoofed Origin cannot read a dump; the independent capability can', async () => {
  const env = makeEnv();
  // Session minting is open to any origin now (the plugin's human mints
  // receive codes too) — per-IP limits bound abuse.
  assert.equal((await handleRequest(req('/bridge/session', { origin: 'https://evil.example' }), env, deps)).status, 200);
  assert.equal((await handleRequest(req('/bridge/session', { origin: null }), env, deps)).status, 200);
  // Origin is trivially spoofable and therefore grants nothing.
  const code = await createSession(env);
  const sent = await handleRequest(req(`/bridge/${code}`, { origin: null, body: DUMP }), env, deps);
  assert.equal(sent.status, 200);
  const spoofed = await handleRequest(
    req(`/bridge/${code}`, {
      method: 'GET',
      origin: ORIGIN,
      capability: null,
    }),
    env,
    deps,
  );
  assert.equal(spoofed.status, 403);
  assert.equal(((await spoofed.json()) as { error: string }).error, BRIDGE_MESSAGES.readCapability);
  const wrong = await handleRequest(
    req(`/bridge/${code}`, {
      method: 'GET',
      origin: ORIGIN,
      capability: '00'.repeat(READ_CAPABILITY_BYTES),
    }),
    env,
    deps,
  );
  assert.equal(wrong.status, 403);
  assert.ok(env.ASSIST_KV.store.has(`bridge:payload:${code}`), 'refused reads must not consume');
  const delivered = await handleRequest(req(`/bridge/${code}`, { method: 'GET' }), env, deps);
  assert.equal(delivered.status, 200);
  assert.equal(((await delivered.json()) as { status: string }).status, 'delivered');
  // A CONTRACTS BUNDLE delivers to the plugin's null origin — the pairing
  // code is the auth; the pusher explicitly targeted this code.
  const code2 = await createSession(env);
  const bundle = JSON.stringify({ type: 'CONTRACTS-BUNDLE', version: 1, contracts: [{ id: 'x.y' }] });
  assert.equal((await handleRequest(req(`/bridge/${code2}`, { origin: null, body: bundle }), env, deps)).status, 200);
  const pluginRead = await handleRequest(
    req(`/bridge/${code2}`, { method: 'GET', origin: 'null', capability: null }),
    env,
    deps,
  );
  assert.equal(pluginRead.status, 200);
  const body = (await pluginRead.json()) as { status: string; kind: string };
  assert.equal(body.status, 'delivered');
  assert.equal(body.kind, 'contracts-bundle');
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

test('committed kill switches: assist, bridge, and channel all default off', async () => {
  const config = await readFile(new URL('../wrangler.toml', import.meta.url), 'utf8');
  for (const name of ['ASSIST_ENABLED', 'BRIDGE_ENABLED', 'CHANNEL_ENABLED']) {
    assert.match(config, new RegExp(`^${name} = "false"$`, 'm'), `${name} must fail closed`);
  }
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
