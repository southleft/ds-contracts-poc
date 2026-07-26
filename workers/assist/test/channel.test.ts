/**
 * STANDING CHANNEL unit checks — the same discipline as bridge.test.ts:
 * plain node:test, no vitest, no workerd, the FULL handler pipeline against a
 * Map-backed KV that records every write's expirationTtl. What needs live
 * infra (real KV eventual consistency, real TTL expiry, real
 * CF-Connecting-IP) is out of scope here and named in the README.
 *
 * The load-bearing pins, in order of what they protect:
 *   - THE KEY SPLIT: a writeKey cannot read, a readKey cannot write, and the
 *     read key is exactly SHA-256(writeKey) — asserted positively, not by
 *     absence.
 *   - NON-CONSUMING reads: the whole reason this is not the bridge.
 *   - seq MONOTONICITY: the base the plugin-side freshness guard stands on.
 *   - TTL on EVERY write: a channel that outlives its 30 days silently is a
 *     data-retention bug.
 *   - caps BY CHANNEL (not by IP), kill-switch independence, 4 MB, and every
 *     malformed shape refused 400 BY NAME.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { handleRequest } from '../src/index';
import {
  CHANNEL_MAX_BYTES,
  CHANNEL_MESSAGES,
  CHANNEL_TTL_SECONDS,
  KEY_ALPHABET,
  READ_KEY_RE,
  WRITE_KEY_RE,
  deriveReadKey,
  isWellFormedBundle,
  randomWriteKey,
} from '../src/channel';
import { CONTRACTS_BUNDLE_TYPE } from '../src/bridge';
import type { Env, KVNamespaceLite, Deps } from '../src/env';

// ---------------------------------------------------------------------------
// Mocks (identical shape to bridge.test.ts — one harness idea, two suites)
// ---------------------------------------------------------------------------

class MemoryKV implements KVNamespaceLite {
  store = new Map<string, string>();
  /** expirationTtl per key, recorded so tests can assert the 30-day cap. */
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
    CHANNEL_ENABLED: 'true',
    ...overrides,
  } as Env & { ASSIST_KV: MemoryKV };
}

/** The channel must never reach the Anthropic transport. */
const deps: Deps = {
  fetchImpl: (() => {
    throw new Error('channel routes must not fetch');
  }) as unknown as typeof fetch,
  now: () => new Date('2026-07-25T12:00:00Z'),
};

/** A clock that advances one minute per call — publishedAt must move. */
function tickingDeps(startIso = '2026-07-25T12:00:00Z'): Deps {
  let t = new Date(startIso).getTime();
  return {
    fetchImpl: (() => {
      throw new Error('channel routes must not fetch');
    }) as unknown as typeof fetch,
    now: () => {
      const d = new Date(t);
      t += 60_000;
      return d;
    },
  };
}

function req(
  path: string,
  opts: { origin?: string | null; method?: string; ip?: string; body?: string } = {},
): Request {
  const headers = new Headers();
  // Default: NO Origin header at all — the CI runner's shape. `'null'` is
  // the literal origin a Figma plugin iframe sends.
  if (opts.origin !== undefined && opts.origin !== null) headers.set('origin', opts.origin);
  headers.set('cf-connecting-ip', opts.ip ?? '203.0.113.7');
  const method = opts.method ?? 'POST';
  return new Request(`https://assist.example${path}`, {
    method,
    headers,
    body: method === 'GET' || method === 'OPTIONS' ? undefined : (opts.body ?? '{}'),
  });
}

const BUNDLE = {
  type: CONTRACTS_BUNDLE_TYPE,
  version: 1,
  contracts: [{ id: 'acme.pill', name: 'Pill', version: '1.0.0', props: [] }],
};
const PROVENANCE = {
  repo: 'acme/design-system',
  runId: '17654321',
  runUrl: 'https://github.com/acme/design-system/actions/runs/17654321',
  commit: '9f1c2ab3d4e5f60718293a4b5c6d7e8f90a1b2c3',
  ref: 'refs/heads/main',
  publishedAt: '2026-07-25T11:59:00Z',
};

const publishBody = (bundle: unknown = BUNDLE, provenance?: unknown) =>
  JSON.stringify(provenance === undefined ? { bundle } : { bundle, provenance });

interface Claim {
  writeKey: string;
  readKey: string;
  ttlSeconds: number;
  maxBytes: number;
}

async function claim(env: Env & { ASSIST_KV: MemoryKV }, d: Deps = deps): Promise<Claim> {
  const res = await handleRequest(req('/channel/claim'), env, d);
  assert.equal(res.status, 200);
  return (await res.json()) as Claim;
}

// ---------------------------------------------------------------------------
// Keys + the split
// ---------------------------------------------------------------------------

test('keys: write keys are 160-bit, prefixed, from the unambiguous alphabet, and effectively unique', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const key = randomWriteKey();
    assert.match(key, WRITE_KEY_RE);
    assert.ok(key.startsWith('dscw_'));
    for (const ch of key.slice(5)) assert.ok(KEY_ALPHABET.includes(ch), `unexpected char ${ch}`);
    seen.add(key);
  }
  assert.equal(seen.size, 200, 'write keys should never repeat across 200 draws');
  for (const banned of ['l', 'o', '0', '1']) assert.ok(!KEY_ALPHABET.includes(banned));
});

test('keys: readKey is EXACTLY sha256(writeKey) — derivable one way, never the other', async () => {
  const writeKey = randomWriteKey();
  const readKey = await deriveReadKey(writeKey);
  assert.match(readKey, READ_KEY_RE);
  assert.equal(readKey, 'dscr_' + createHash('sha256').update(writeKey).digest('hex'));
  // The security claim in one line: nothing in the read key reveals the write
  // key (a preimage), and the read key is fully determined by the write key.
  assert.ok(!readKey.includes(writeKey.slice(5)));
  assert.equal(await deriveReadKey(writeKey), readKey, 'derivation is deterministic');
});

test('split: a writeKey cannot READ and a readKey cannot WRITE — both refused 400 by name', async () => {
  const env = makeEnv();
  const { writeKey, readKey } = await claim(env);
  await handleRequest(req(`/channel/${writeKey}`, { body: publishBody() }), env, deps);

  // The write key on the read route: refused by shape, and it does NOT leak
  // the bundle even though the holder could derive the read key themselves.
  const wrongRead = await handleRequest(req(`/channel/${writeKey}`, { method: 'GET' }), env, deps);
  assert.equal(wrongRead.status, 400);
  assert.equal(((await wrongRead.json()) as { error: string }).error, CHANNEL_MESSAGES.notReadKey);

  // The read key on the publish route: refused by shape. This is the leak
  // scenario — a Figma file's stored key can never inject a bundle.
  const wrongWrite = await handleRequest(req(`/channel/${readKey}`, { body: publishBody() }), env, deps);
  assert.equal(wrongWrite.status, 400);
  assert.equal(((await wrongWrite.json()) as { error: string }).error, CHANNEL_MESSAGES.notWriteKey);

  // And nothing changed: the channel still serves seq 1, not 2.
  const still = await handleRequest(req(`/channel/${readKey}`, { method: 'GET' }), env, deps);
  assert.equal(((await still.json()) as { seq: number }).seq, 1);
});

// ---------------------------------------------------------------------------
// Lifecycle: claim → publish → read (non-consuming) → re-read
// ---------------------------------------------------------------------------

test('lifecycle: claim → "current" at seq 0 → publish → "update" with the byte-identical bundle', async () => {
  const env = makeEnv();
  const c = await claim(env);
  assert.match(c.writeKey, WRITE_KEY_RE);
  assert.match(c.readKey, READ_KEY_RE);
  assert.equal(c.ttlSeconds, CHANNEL_TTL_SECONDS);
  assert.equal(c.maxBytes, CHANNEL_MAX_BYTES);
  assert.equal(env.ASSIST_KV.ttls.get(`chan:${c.readKey}:meta`), CHANNEL_TTL_SECONDS);

  // Claimed, nothing published: a LIVE channel, not a 404 that reads like a
  // typo — the designer can paste the key before the first CI run.
  const empty = await handleRequest(req(`/channel/${c.readKey}`, { method: 'GET' }), env, deps);
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), { status: 'current', seq: 0, publishedAt: null });

  const sent = await handleRequest(
    req(`/channel/${c.writeKey}`, { body: publishBody(BUNDLE, PROVENANCE) }),
    env,
    deps,
  );
  assert.equal(sent.status, 200);
  const sentBody = (await sent.json()) as { ok: boolean; seq: number; bytes: number; publishedAt: string };
  assert.equal(sentBody.ok, true);
  assert.equal(sentBody.seq, 1);
  assert.equal(sentBody.bytes, JSON.stringify(BUNDLE).length);
  assert.equal(sentBody.publishedAt, '2026-07-25T12:00:00.000Z');

  const got = await handleRequest(req(`/channel/${c.readKey}`, { method: 'GET' }), env, deps);
  assert.equal(got.status, 200);
  const body = (await got.json()) as {
    status: string;
    seq: number;
    publishedAt: string;
    provenance: unknown;
    bundle: unknown;
  };
  assert.equal(body.status, 'update');
  assert.equal(body.seq, 1);
  assert.equal(body.publishedAt, '2026-07-25T12:00:00.000Z');
  assert.deepEqual(body.bundle, BUNDLE);
  assert.deepEqual(body.provenance, PROVENANCE);
});

test('read is NON-CONSUMING: the same delivery answers ten times and the keys survive', async () => {
  const env = makeEnv();
  const c = await claim(env);
  await handleRequest(req(`/channel/${c.writeKey}`, { body: publishBody() }), env, deps);
  for (let i = 0; i < 10; i++) {
    const got = await handleRequest(req(`/channel/${c.readKey}`, { method: 'GET' }), env, deps);
    assert.equal(got.status, 200);
    const body = (await got.json()) as { status: string; seq: number; bundle: unknown };
    assert.equal(body.status, 'update', `read ${i + 1} should still deliver`);
    assert.equal(body.seq, 1);
    assert.deepEqual(body.bundle, BUNDLE);
  }
  // The bridge deletes before answering; the channel deletes nothing.
  for (const k of [`chan:${c.readKey}:meta`, `chan:${c.readKey}:bundle`]) {
    assert.ok(env.ASSIST_KV.store.has(k), `${k} must survive a read`);
  }
});

test('since: a caller already at the head is told "current" and gets NO bundle', async () => {
  const env = makeEnv();
  const c = await claim(env);
  await handleRequest(req(`/channel/${c.writeKey}`, { body: publishBody() }), env, deps);
  const current = await handleRequest(
    req(`/channel/${c.readKey}?since=1`, { method: 'GET' }),
    env,
    deps,
  );
  assert.equal(current.status, 200);
  const body = (await current.json()) as Record<string, unknown>;
  assert.equal(body.status, 'current');
  assert.equal(body.seq, 1);
  assert.ok(!('bundle' in body), '"current" must not ship the payload');
  // A caller ahead of the head (a re-claimed channel restarting at 1 while
  // the file remembers 7) is ALSO "current" here — naming that as stale is
  // the PLUGIN's job, where the file's own apply log is in hand.
  const ahead = await handleRequest(req(`/channel/${c.readKey}?since=7`, { method: 'GET' }), env, deps);
  assert.equal(((await ahead.json()) as { status: string }).status, 'current');
  // A garbage `since` is treated as "I have nothing" rather than refused.
  const junk = await handleRequest(
    req(`/channel/${c.readKey}?since=banana`, { method: 'GET' }),
    env,
    deps,
  );
  assert.equal(((await junk.json()) as { status: string }).status, 'update');
});

test('meta=1: the head WITHOUT the bundle — the plugin\'s cheap check-on-open', async () => {
  const env = makeEnv();
  const c = await claim(env);
  await handleRequest(
    req(`/channel/${c.writeKey}`, { body: publishBody(BUNDLE, PROVENANCE) }),
    env,
    deps,
  );
  const head = await handleRequest(
    req(`/channel/${c.readKey}?since=0&meta=1`, { method: 'GET' }),
    env,
    deps,
  );
  assert.equal(head.status, 200);
  const body = (await head.json()) as Record<string, unknown>;
  assert.equal(body.status, 'update');
  assert.equal(body.seq, 1);
  assert.equal(body.bytes, JSON.stringify(BUNDLE).length);
  assert.deepEqual(body.provenance, PROVENANCE);
  assert.ok(!('bundle' in body), 'meta=1 must never ship the payload');
});

test('seq is MONOTONIC across publishes, last write wins on the payload', async () => {
  const env = makeEnv();
  const ticking = tickingDeps();
  const c = await claim(env, ticking);
  const seqs: number[] = [];
  for (let i = 1; i <= 4; i++) {
    const bundle = {
      type: CONTRACTS_BUNDLE_TYPE,
      version: 1,
      contracts: [{ id: 'acme.pill', name: 'Pill', version: `1.0.${i}` }],
    };
    const res = await handleRequest(
      req(`/channel/${c.writeKey}`, { body: publishBody(bundle) }),
      env,
      ticking,
    );
    assert.equal(res.status, 200);
    seqs.push(((await res.json()) as { seq: number }).seq);
  }
  assert.deepEqual(seqs, [1, 2, 3, 4]);
  const got = await handleRequest(req(`/channel/${c.readKey}`, { method: 'GET' }), env, ticking);
  const body = (await got.json()) as { seq: number; bundle: { contracts: Array<{ version: string }> } };
  assert.equal(body.seq, 4, 'the head is the latest seq');
  assert.equal(body.bundle.contracts[0].version, '1.0.4', 'last write wins on the payload');
});

test('provenance: a publish WITHOUT it does not inherit the previous publish\'s', async () => {
  const env = makeEnv();
  const ticking = tickingDeps();
  const c = await claim(env, ticking);
  await handleRequest(
    req(`/channel/${c.writeKey}`, { body: publishBody(BUNDLE, PROVENANCE) }),
    env,
    ticking,
  );
  await handleRequest(req(`/channel/${c.writeKey}`, { body: publishBody(BUNDLE) }), env, ticking);
  const got = await handleRequest(req(`/channel/${c.readKey}`, { method: 'GET' }), env, ticking);
  const body = (await got.json()) as Record<string, unknown>;
  assert.equal(body.seq, 2);
  assert.ok(!('provenance' in body), 'stale provenance is worse than none');
  assert.ok(!env.ASSIST_KV.store.has(`chan:${c.readKey}:prov`));
});

test('provenance rides through UNREAD — arbitrary fields echo back verbatim', async () => {
  const env = makeEnv();
  const c = await claim(env);
  const weird = { repo: 'a/b', nested: { deep: [1, 2, { x: null }] }, unknownField: 'kept' };
  await handleRequest(req(`/channel/${c.writeKey}`, { body: publishBody(BUNDLE, weird) }), env, deps);
  const got = await handleRequest(req(`/channel/${c.readKey}`, { method: 'GET' }), env, deps);
  assert.deepEqual(((await got.json()) as { provenance: unknown }).provenance, weird);
});

// ---------------------------------------------------------------------------
// Wrong / expired keys
// ---------------------------------------------------------------------------

test('wrong key: a well-shaped read key nobody minted answers 404, identical to expired', async () => {
  const env = makeEnv();
  const never = 'dscr_' + 'a'.repeat(64);
  const res = await handleRequest(req(`/channel/${never}`, { method: 'GET' }), env, deps);
  assert.equal(res.status, 404);
  assert.equal(((await res.json()) as { error: string }).error, CHANNEL_MESSAGES.noChannel);

  // Expired (TTL elapsed = the KV entry is gone): same status, same message,
  // nothing to distinguish by.
  const c = await claim(env);
  await handleRequest(req(`/channel/${c.writeKey}`, { body: publishBody() }), env, deps);
  env.ASSIST_KV.store.delete(`chan:${c.readKey}:meta`);
  const expired = await handleRequest(req(`/channel/${c.readKey}`, { method: 'GET' }), env, deps);
  assert.equal(expired.status, 404);
  assert.equal(((await expired.json()) as { error: string }).error, CHANNEL_MESSAGES.noChannel);
});

test('wrong key: publishing to a write key whose channel expired answers 404 and stores nothing', async () => {
  const env = makeEnv();
  const c = await claim(env);
  env.ASSIST_KV.store.delete(`chan:${c.readKey}:meta`);
  const res = await handleRequest(req(`/channel/${c.writeKey}`, { body: publishBody() }), env, deps);
  assert.equal(res.status, 404);
  assert.equal(((await res.json()) as { error: string }).error, CHANNEL_MESSAGES.noChannel);
  assert.ok(!env.ASSIST_KV.store.has(`chan:${c.readKey}:bundle`));
});

test('wrong key: malformed keys are refused by SHAPE on both routes (no KV probe)', async () => {
  const env = makeEnv();
  for (const bad of ['nope', 'dscw_TOOSHORT', 'dscr_zzz', '']) {
    const up = await handleRequest(req(`/channel/${bad}`, { body: publishBody() }), env, deps);
    assert.equal(up.status, 400, `publish ${bad}`);
    assert.equal(((await up.json()) as { error: string }).error, CHANNEL_MESSAGES.notWriteKey);
    const down = await handleRequest(req(`/channel/${bad}`, { method: 'GET' }), env, deps);
    assert.equal(down.status, 400, `read ${bad}`);
    assert.equal(((await down.json()) as { error: string }).error, CHANNEL_MESSAGES.notReadKey);
  }
  assert.equal([...env.ASSIST_KV.store.keys()].filter((k) => k.startsWith('chan:')).length, 0);
});

// ---------------------------------------------------------------------------
// TTL — the retention promise
// ---------------------------------------------------------------------------

test('TTL: EVERY channel KV write carries the 30-day expirationTtl', async () => {
  const env = makeEnv();
  const c = await claim(env);
  await handleRequest(
    req(`/channel/${c.writeKey}`, { body: publishBody(BUNDLE, PROVENANCE) }),
    env,
    deps,
  );
  for (const key of [
    `chan:${c.readKey}:meta`,
    `chan:${c.readKey}:bundle`,
    `chan:${c.readKey}:prov`,
  ]) {
    assert.equal(env.ASSIST_KV.ttls.get(key), CHANNEL_TTL_SECONDS, key);
  }
  // No channel key was written WITHOUT a TTL, ever.
  for (const [key, ttl] of env.ASSIST_KV.ttls) {
    if (key.startsWith('chan:') && !key.startsWith('chan-pub:')) {
      assert.equal(ttl, CHANNEL_TTL_SECONDS, `${key} was written without the channel TTL`);
    }
  }
});

test('TTL is rolling on PUBLISH and is NOT refreshed by reads', async () => {
  const env = makeEnv();
  const c = await claim(env);
  await handleRequest(req(`/channel/${c.writeKey}`, { body: publishBody() }), env, deps);
  const writesAfterPublish = env.ASSIST_KV.ttls.size;
  for (let i = 0; i < 5; i++) {
    await handleRequest(req(`/channel/${c.readKey}`, { method: 'GET' }), env, deps);
  }
  assert.equal(
    env.ASSIST_KV.ttls.size,
    writesAfterPublish,
    'a read must perform no KV writes at all — a channel nobody publishes to expires',
  );
});

// ---------------------------------------------------------------------------
// Size cap / malformed envelopes — every refusal BY NAME
// ---------------------------------------------------------------------------

test('size cap: an over-4MB publish is refused 413 by name and nothing is stored', async () => {
  const env = makeEnv();
  const c = await claim(env);
  const big = '{"bundle":{"pad":"' + 'x'.repeat(CHANNEL_MAX_BYTES) + '"}}';
  const res = await handleRequest(req(`/channel/${c.writeKey}`, { body: big }), env, deps);
  assert.equal(res.status, 413);
  assert.equal(((await res.json()) as { error: string }).error, CHANNEL_MESSAGES.tooLarge);
  assert.ok(!env.ASSIST_KV.store.has(`chan:${c.readKey}:bundle`));
});

test('malformed: non-JSON, no bundle, bad bundle envelope, bad provenance — 400 each, BY NAME, nothing stored', async () => {
  const env = makeEnv();
  const c = await claim(env);
  const cases: Array<[string, string]> = [
    ['{"cut off', CHANNEL_MESSAGES.notJson],
    ['[1,2,3]', CHANNEL_MESSAGES.badPublish],
    ['{}', CHANNEL_MESSAGES.badPublish],
    [JSON.stringify({ provenance: PROVENANCE }), CHANNEL_MESSAGES.badPublish],
    [publishBody({ type: CONTRACTS_BUNDLE_TYPE }), CHANNEL_MESSAGES.badBundle],
    [publishBody({ type: CONTRACTS_BUNDLE_TYPE, contracts: [] }), CHANNEL_MESSAGES.badBundle],
    [publishBody({ type: CONTRACTS_BUNDLE_TYPE, contracts: ['nope'] }), CHANNEL_MESSAGES.badBundle],
    [publishBody({ type: CONTRACTS_BUNDLE_TYPE, contracts: [null] }), CHANNEL_MESSAGES.badBundle],
    [publishBody({ type: 'SOMETHING-ELSE', contracts: [{ id: 'a' }] }), CHANNEL_MESSAGES.badBundle],
    [publishBody(BUNDLE, 'a string'), CHANNEL_MESSAGES.badProvenance],
    [publishBody(BUNDLE, [1, 2]), CHANNEL_MESSAGES.badProvenance],
    [publishBody(BUNDLE, null), CHANNEL_MESSAGES.badProvenance],
  ];
  for (const [body, expected] of cases) {
    const res = await handleRequest(req(`/channel/${c.writeKey}`, { body }), env, deps);
    assert.equal(res.status, 400, body.slice(0, 60));
    assert.equal(((await res.json()) as { error: string }).error, expected, body.slice(0, 60));
  }
  assert.ok(!env.ASSIST_KV.store.has(`chan:${c.readKey}:bundle`));
  // The channel is unharmed: still live, still at seq 0.
  const still = await handleRequest(req(`/channel/${c.readKey}`, { method: 'GET' }), env, deps);
  assert.deepEqual(await still.json(), { status: 'current', seq: 0, publishedAt: null });
});

test('the envelope referee never inspects contract CONTENTS', () => {
  // A bundle of empty objects is well-formed to the transport. Whether those
  // documents are valid contracts is the plugin schema referee's question.
  assert.ok(isWellFormedBundle({ type: CONTRACTS_BUNDLE_TYPE, contracts: [{}] }));
  assert.ok(!isWellFormedBundle({ type: CONTRACTS_BUNDLE_TYPE, contracts: [] }));
  assert.ok(!isWellFormedBundle(null));
  assert.ok(!isWellFormedBundle([{ type: CONTRACTS_BUNDLE_TYPE, contracts: [{}] }]));
});

// ---------------------------------------------------------------------------
// Caps — by CHANNEL, not by IP
// ---------------------------------------------------------------------------

test('caps: the publish cap is per CHANNEL — a churning CI IP is irrelevant, another channel is unaffected', async () => {
  const env = makeEnv({ CHANNEL_PUBLISH_DAILY_LIMIT: '2', CHANNEL_CLAIM_IP_DAILY_LIMIT: '5' });
  const a = await claim(env);
  const b = await claim(env);
  // Every publish comes from a DIFFERENT runner IP — the cap must still hold.
  for (const [i, ip] of ['198.51.100.1', '198.51.100.2'].entries()) {
    const res = await handleRequest(
      req(`/channel/${a.writeKey}`, { body: publishBody(), ip }),
      env,
      deps,
    );
    assert.equal(res.status, 200, `publish ${i + 1}`);
  }
  const third = await handleRequest(
    req(`/channel/${a.writeKey}`, { body: publishBody(), ip: '198.51.100.3' }),
    env,
    deps,
  );
  assert.equal(third.status, 429);
  assert.equal(((await third.json()) as { error: string }).error, CHANNEL_MESSAGES.publishLimit);
  // The capped channel still SERVES its last publish — reads are never capped.
  const served = await handleRequest(req(`/channel/${a.readKey}`, { method: 'GET' }), env, deps);
  assert.equal(((await served.json()) as { seq: number }).seq, 2);
  // A different channel from the SAME IP has its own budget.
  const other = await handleRequest(
    req(`/channel/${b.writeKey}`, { body: publishBody(), ip: '198.51.100.3' }),
    env,
    deps,
  );
  assert.equal(other.status, 200);
});

test('caps: claim is the one IP-keyed channel counter; reads are uncounted', async () => {
  const env = makeEnv({ CHANNEL_CLAIM_IP_DAILY_LIMIT: '2' });
  const c = await claim(env);
  await claim(env);
  const third = await handleRequest(req('/channel/claim'), env, deps);
  assert.equal(third.status, 429);
  assert.equal(((await third.json()) as { error: string }).error, CHANNEL_MESSAGES.claimLimit);
  // Another visitor is unaffected.
  const other = await handleRequest(req('/channel/claim', { ip: '198.51.100.9' }), env, deps);
  assert.equal(other.status, 200);
  // Reads never count: fifty polls from the capped IP still answer.
  await handleRequest(req(`/channel/${c.writeKey}`, { body: publishBody() }), env, deps);
  for (let i = 0; i < 50; i++) {
    const poll = await handleRequest(req(`/channel/${c.readKey}`, { method: 'GET' }), env, deps);
    assert.equal(poll.status, 200);
  }
});

// ---------------------------------------------------------------------------
// Kill switch (independent) + origins + methods
// ---------------------------------------------------------------------------

test('kill switch: CHANNEL_ENABLED unset answers 503 everywhere and is INDEPENDENT of bridge + assist', async () => {
  const off = makeEnv({ CHANNEL_ENABLED: undefined });
  for (const r of [
    req('/channel/claim'),
    req(`/channel/dscw_${'a'.repeat(32)}`, { body: publishBody() }),
    req(`/channel/dscr_${'a'.repeat(64)}`, { method: 'GET' }),
  ]) {
    const res = await handleRequest(r, off, deps);
    assert.equal(res.status, 503);
    assert.equal(((await res.json()) as { error: string }).error, CHANNEL_MESSAGES.disabled);
  }
  // The bridge is untouched by the channel's switch…
  assert.equal((await handleRequest(req('/bridge/session'), off, deps)).status, 200);
  // …and the channel is untouched by the bridge's and by assist's.
  const env2 = makeEnv({ BRIDGE_ENABLED: undefined, ASSIST_ENABLED: 'false' });
  assert.equal((await handleRequest(req('/channel/claim'), env2, deps)).status, 200);
});

test('origins: every channel route answers ANY origin — CI sends none, the plugin sends "null"', async () => {
  const env = makeEnv();
  const c = await claim(env);
  // The plugin's literal "null" origin reads.
  const pluginRead = await handleRequest(
    req(`/channel/${c.readKey}`, { method: 'GET', origin: 'null' }),
    env,
    deps,
  );
  assert.equal(pluginRead.status, 200);
  assert.equal(pluginRead.headers.get('access-control-allow-origin'), '*');
  // A foreign browser origin publishes with the write key — allowed, because
  // the KEY is the auth (an origin gate cannot help an origin-less caller).
  const foreign = await handleRequest(
    req(`/channel/${c.writeKey}`, { body: publishBody(), origin: 'https://evil.example' }),
    env,
    deps,
  );
  assert.equal(foreign.status, 200);
  const preflight = await handleRequest(
    req('/channel/claim', { method: 'OPTIONS', origin: 'null' }),
    env,
    deps,
  );
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), '*');
  assert.match(String(preflight.headers.get('access-control-allow-methods')), /GET/);
});

test('methods: GET /channel/claim and PUT /channel/<key> answer 405', async () => {
  const env = makeEnv();
  const c = await claim(env);
  assert.equal((await handleRequest(req('/channel/claim', { method: 'GET' }), env, deps)).status, 405);
  assert.equal(
    (await handleRequest(req(`/channel/${c.readKey}`, { method: 'PUT', body: '{}' }), env, deps)).status,
    405,
  );
});

test('isolation: the channel never disturbs the bridge (both live in one worker, one KV)', async () => {
  const env = makeEnv();
  const c = await claim(env);
  await handleRequest(req(`/channel/${c.writeKey}`, { body: publishBody() }), env, deps);
  // A full bridge round trip still works with channel keys in the same KV.
  const created = await handleRequest(
    req('/bridge/session', { origin: 'https://ds-contracts-playground.pages.dev' }),
    env,
    deps,
  );
  const { code } = (await created.json()) as { code: string };
  const sent = await handleRequest(req(`/bridge/${code}`, { body: JSON.stringify(BUNDLE) }), env, deps);
  assert.equal(sent.status, 200);
  const delivered = await handleRequest(req(`/bridge/${code}`, { method: 'GET' }), env, deps);
  assert.equal(((await delivered.json()) as { status: string }).status, 'delivered');
  // …and the channel still serves after the bridge's deliver-once deletes.
  const got = await handleRequest(req(`/channel/${c.readKey}`, { method: 'GET' }), env, deps);
  assert.equal(((await got.json()) as { status: string }).status, 'update');
});
