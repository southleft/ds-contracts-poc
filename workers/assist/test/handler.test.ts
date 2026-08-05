/**
 * Request-handler unit checks — plain node:test, no vitest, no workerd.
 *
 * What runs here: the full handler pipeline (CORS, kill switch, routing,
 * validation, KV counters, budget, cache, Anthropic request shape, envelope
 * unwrapping, response shape) against a Map-backed KV and a scripted fetch.
 *
 * What does NOT run here (needs live infra — see README "What the tests
 * cover"): real workerd behavior (wrangler dev/deploy), real KV consistency,
 * real CF-Connecting-IP injection, and real Anthropic responses.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest, MESSAGES } from '../src/index';
import { MODEL, ANTHROPIC_URL } from '../src/anthropic';
import { BudgetCoordinator } from '../src/budget-coordinator';
import type {
  Deps,
  DurableObjectIdLite,
  DurableObjectNamespaceLite,
  DurableObjectStateLite,
  DurableObjectStorageLite,
  DurableObjectStorageTransactionLite,
  Env,
  KVNamespaceLite,
} from '../src/env';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

class MemoryKV implements KVNamespaceLite {
  store = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

class RaceStorage implements DurableObjectStorageLite {
  values = new Map<string, unknown>();
  private tail: Promise<void> = Promise.resolve();

  async transaction<T>(
    closure: (txn: DurableObjectStorageTransactionLite) => Promise<T>,
  ): Promise<T> {
    // Yield before taking the lock so parallel requests genuinely contend.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      const txn: DurableObjectStorageTransactionLite = {
        get: async <V>(key: string) => {
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
          return this.values.get(key) as V | undefined;
        },
        put: async <V>(key: string, value: V) => {
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
          this.values.set(key, value);
        },
      };
      return await closure(txn);
    } finally {
      release();
    }
  }
}

interface NamedId extends DurableObjectIdLite {
  name: string;
}

class RaceBudgetNamespace implements DurableObjectNamespaceLite {
  private readonly storages = new Map<string, RaceStorage>();
  private readonly coordinators = new Map<string, BudgetCoordinator>();

  idFromName(name: string): DurableObjectIdLite {
    return { name } as NamedId;
  }

  get(id: DurableObjectIdLite) {
    const name = (id as NamedId).name;
    let coordinator = this.coordinators.get(name);
    if (!coordinator) {
      const storage = new RaceStorage();
      this.storages.set(name, storage);
      coordinator = new BudgetCoordinator({ storage } as DurableObjectStateLite);
      this.coordinators.set(name, coordinator);
    }
    return { fetch: (input: RequestInfo | URL, init?: RequestInit) => coordinator.fetch(new Request(input, init)) };
  }

  used(name = 'budget:2026-07-08'): number {
    return Number(this.storages.get(name)?.values.get('used') ?? 0);
  }

  seed(used: number, name = 'budget:2026-07-08'): void {
    this.get(this.idFromName(name));
    this.storages.get(name)?.values.set('used', used);
  }
}

interface MockCall {
  url: string;
  body: Record<string, unknown>;
  headers: Record<string, string>;
}

/** Scripted Anthropic: records every call, answers with the given tool input. */
function mockAnthropic(toolInputsByName: Record<string, unknown>, opts: { status?: number } = {}) {
  const calls: MockCall[] = [];
  const fetchImpl = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    calls.push({ url: String(_url), body, headers: (init?.headers ?? {}) as Record<string, string> });
    if (opts.status && opts.status !== 200) {
      return new Response(JSON.stringify({ error: { type: 'x', message: 'upstream detail' } }), {
        status: opts.status,
      });
    }
    const toolChoice = body.tool_choice as { name: string };
    const input = toolInputsByName[toolChoice.name];
    return new Response(
      JSON.stringify({
        content: input === undefined ? [{ type: 'text', text: 'no tool' }] : [{ type: 'tool_use', name: toolChoice.name, input }],
        stop_reason: input === undefined ? 'end_turn' : 'tool_use',
        usage: { input_tokens: 1000, output_tokens: 200 },
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  return { fetchImpl, calls };
}

type TestEnv = Env & { ASSIST_KV: MemoryKV; BUDGET_COORDINATOR: RaceBudgetNamespace };

function makeEnv(overrides: Partial<Env> = {}): TestEnv {
  return {
    ANTHROPIC_API_KEY: 'sk-ant-test-not-a-real-key',
    ASSIST_KV: new MemoryKV(),
    BUDGET_COORDINATOR: new RaceBudgetNamespace(),
    ASSIST_ENABLED: 'true',
    ...overrides,
  } as TestEnv;
}

const ORIGIN = 'https://ds-contracts-playground.pages.dev';

function req(
  path: string,
  body: unknown,
  opts: { origin?: string | null; method?: string; ip?: string } = {},
): Request {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (opts.origin !== null) headers.set('origin', opts.origin ?? ORIGIN);
  headers.set('cf-connecting-ip', opts.ip ?? '203.0.113.7');
  return new Request(`https://assist.example${path}`, {
    method: opts.method ?? 'POST',
    headers,
    body: opts.method === 'GET' ? undefined : JSON.stringify(body),
  });
}

const deps = (fetchImpl: typeof fetch): Deps => ({ fetchImpl, now: () => new Date('2026-07-08T12:00:00Z') });

const FETCH_PLAN_BODY = {
  entryUrl: 'https://github.com/acme/ui/tree/main/src/components/Button',
  listing: [
    { path: 'src/components/Button/Button.tsx', size: 2048 },
    { path: 'src/components/Button/Button.module.css', size: 512 },
    { path: 'src/theme/tokens.css', size: 4096 },
  ],
  alreadyFetched: ['src/components/Button/Button.tsx'],
  gaps: ['hover background color source unknown'],
};

const NAME_TOKENS_BODY = {
  component: 'Button',
  entries: [{ ref: '{provisional.button-1}', value: '#3B5BDB', usageSites: ['root/background'] }],
  existingTokenPaths: ['color.action.primary.background', 'radius.control'],
};

const REPO_PROFILE_BODY = {
  repoUrl: 'https://github.com/acme/ui',
  ref: 'main',
  tree: [
    { path: 'package.json', size: 900 },
    { path: 'src/components/Button/Button.tsx', size: 2048 },
    { path: 'src/theme/tokens.css', size: 4096 },
  ],
  samples: [{ path: 'package.json', content: '{"dependencies":{"react":"^18"}}' }],
};

const FETCH_PLAN_OUTPUT = {
  fetch: [{ path: 'src/theme/tokens.css', reason: 'global custom properties feed the hover background' }],
  styleSystem: 'css-modules',
  notes: [],
};

const PROFILE_OUTPUT = {
  framework: 'react',
  styleSystem: 'css-modules',
  tokenSources: [{ path: 'src/theme/tokens.css', kind: 'css-custom-properties', note: 'root custom properties' }],
  componentDirGlobs: ['src/components/**'],
  conventions: ['co-located *.module.css per component'],
  notes: [],
};

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

test('CORS: unlisted origin is refused with 403', async () => {
  const { fetchImpl, calls } = mockAnthropic({});
  const res = await handleRequest(
    req('/v1/assist/fetch-plan', FETCH_PLAN_BODY, { origin: 'https://evil.example' }),
    makeEnv(),
    deps(fetchImpl),
  );
  assert.equal(res.status, 403);
  assert.equal(calls.length, 0);
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});

test('CORS: missing Origin (curl) is refused with 403', async () => {
  const res = await handleRequest(
    req('/v1/assist/fetch-plan', FETCH_PLAN_BODY, { origin: null }),
    makeEnv(),
    deps(mockAnthropic({}).fetchImpl),
  );
  assert.equal(res.status, 403);
});

test('CORS: a lookalike origin does not pass the regex', async () => {
  const res = await handleRequest(
    req('/v1/assist/fetch-plan', FETCH_PLAN_BODY, {
      origin: 'https://ds-contracts-playground.pages.dev.evil.example',
    }),
    makeEnv(),
    deps(mockAnthropic({}).fetchImpl),
  );
  assert.equal(res.status, 403);
});

test('CORS: preview subdomains pass; preflight answers 204 with the echoing headers', async () => {
  const preview = 'https://abc123.ds-contracts-playground.pages.dev';
  const res = await handleRequest(
    req('/v1/assist/fetch-plan', undefined, { origin: preview, method: 'OPTIONS' }),
    makeEnv(),
    deps(mockAnthropic({}).fetchImpl),
  );
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('access-control-allow-origin'), preview);
  assert.match(res.headers.get('access-control-allow-methods') ?? '', /POST/);
});

// ---------------------------------------------------------------------------
// Kill switch
// ---------------------------------------------------------------------------

test('kill switch: ships OFF — unset ASSIST_ENABLED answers 503 with the named message', async () => {
  const { fetchImpl, calls } = mockAnthropic({});
  const env = makeEnv({ ASSIST_ENABLED: undefined });
  const res = await handleRequest(req('/v1/assist/fetch-plan', FETCH_PLAN_BODY), env, deps(fetchImpl));
  assert.equal(res.status, 503);
  const body = (await res.json()) as { error: string };
  assert.equal(body.error, MESSAGES.disabled);
  assert.equal(calls.length, 0);
});

test('kill switch: "false" is also off', async () => {
  const res = await handleRequest(
    req('/v1/assist/fetch-plan', FETCH_PLAN_BODY),
    makeEnv({ ASSIST_ENABLED: 'false' }),
    deps(mockAnthropic({}).fetchImpl),
  );
  assert.equal(res.status, 503);
});

// ---------------------------------------------------------------------------
// Routing & validation
// ---------------------------------------------------------------------------

test('routing: unknown endpoint 404, GET 405, non-JSON 400, invalid input names the field', async () => {
  const env = makeEnv();
  const d = deps(mockAnthropic({}).fetchImpl);
  assert.equal((await handleRequest(req('/v1/assist/nope', {}), env, d)).status, 404);
  assert.equal(
    (await handleRequest(req('/v1/assist/fetch-plan', undefined, { method: 'GET' }), env, d)).status,
    405,
  );
  const badJson = new Request('https://assist.example/v1/assist/fetch-plan', {
    method: 'POST',
    headers: { origin: ORIGIN },
    body: 'not json',
  });
  assert.equal((await handleRequest(badJson, env, d)).status, 400);
  const invalid = await handleRequest(req('/v1/assist/fetch-plan', { entryUrl: 42 }), env, d);
  assert.equal(invalid.status, 400);
  assert.match(((await invalid.json()) as { error: string }).error, /entryUrl/);
});

test('request body cap counts UTF-8 bytes', async () => {
  const body = { ...FETCH_PLAN_BODY, entryUrl: '💥'.repeat(90_000) };
  const raw = JSON.stringify(body);
  assert.ok(raw.length < 320_000);
  assert.ok(Buffer.byteLength(raw, 'utf8') > 320_000);
  const response = await handleRequest(
    req('/v1/assist/fetch-plan', body),
    makeEnv(),
    deps(mockAnthropic({}).fetchImpl),
  );
  assert.equal(response.status, 413);
});

// ---------------------------------------------------------------------------
// Per-IP limit
// ---------------------------------------------------------------------------

test('per-IP limit: request N+1 on the same endpoint class answers 429; other IPs unaffected', async () => {
  const { fetchImpl } = mockAnthropic({ propose_fetch_plan: FETCH_PLAN_OUTPUT });
  const env = makeEnv({ ASSIST_IP_DAILY_LIMIT: '2' });
  const d = deps(fetchImpl);
  assert.equal((await handleRequest(req('/v1/assist/fetch-plan', FETCH_PLAN_BODY), env, d)).status, 200);
  assert.equal((await handleRequest(req('/v1/assist/fetch-plan', FETCH_PLAN_BODY), env, d)).status, 200);
  const third = await handleRequest(req('/v1/assist/fetch-plan', FETCH_PLAN_BODY), env, d);
  assert.equal(third.status, 429);
  assert.equal(((await third.json()) as { error: string }).error, MESSAGES.ipLimit);
  // A different visitor still gets through.
  const other = await handleRequest(
    req('/v1/assist/fetch-plan', FETCH_PLAN_BODY, { ip: '198.51.100.9' }),
    env,
    d,
  );
  assert.equal(other.status, 200);
});

// ---------------------------------------------------------------------------
// Global token budget
// ---------------------------------------------------------------------------

test('budget: a spent day answers 429 with the user-facing message; no model call is made', async () => {
  const { fetchImpl, calls } = mockAnthropic({ propose_fetch_plan: FETCH_PLAN_OUTPUT });
  const env = makeEnv({ ASSIST_DAILY_TOKEN_BUDGET: '500' });
  env.BUDGET_COORDINATOR.seed(500);
  const res = await handleRequest(req('/v1/assist/fetch-plan', FETCH_PLAN_BODY), env, deps(fetchImpl));
  assert.equal(res.status, 429);
  const body = (await res.json()) as { error: string };
  assert.equal(body.error, MESSAGES.budget);
  assert.match(body.error, /bring your own key/);
  assert.equal(calls.length, 0);
});

test('budget: conservative reservations land before calls and prevent sequential overshoot', async () => {
  const { fetchImpl, calls } = mockAnthropic({ propose_fetch_plan: FETCH_PLAN_OUTPUT });
  const env = makeEnv({ ASSIST_DAILY_TOKEN_BUDGET: '200000' });
  const d = deps(fetchImpl);
  assert.equal((await handleRequest(req('/v1/assist/fetch-plan', FETCH_PLAN_BODY), env, d)).status, 200);
  const reservation = env.BUDGET_COORDINATOR.used();
  assert.ok(reservation > 1200, 'reservation must conservatively exceed mocked actual usage');
  env.ASSIST_DAILY_TOKEN_BUDGET = String(reservation * 2);
  assert.equal((await handleRequest(req('/v1/assist/fetch-plan', FETCH_PLAN_BODY), env, d)).status, 200);
  assert.equal(env.BUDGET_COORDINATOR.used(), reservation * 2);
  const res = await handleRequest(req('/v1/assist/fetch-plan', FETCH_PLAN_BODY), env, d);
  assert.equal(res.status, 429);
  assert.equal(calls.length, 2, 'the refused request never reaches the model');
});

test('budget: parallel reservations are atomic and admitted total never exceeds the daily budget', async () => {
  const { fetchImpl, calls } = mockAnthropic({ propose_fetch_plan: FETCH_PLAN_OUTPUT });
  const probe = makeEnv({ ASSIST_DAILY_TOKEN_BUDGET: '200000' });
  assert.equal(
    (await handleRequest(req('/v1/assist/fetch-plan', FETCH_PLAN_BODY), probe, deps(fetchImpl))).status,
    200,
  );
  const reservation = probe.BUDGET_COORDINATOR.used();
  assert.ok(reservation > 0);

  calls.length = 0;
  const budget = reservation * 3;
  const env = makeEnv({
    ASSIST_DAILY_TOKEN_BUDGET: String(budget),
    ASSIST_IP_DAILY_LIMIT: '20',
  });
  const requests = Array.from({ length: 12 }, (_, i) =>
    handleRequest(
      req('/v1/assist/fetch-plan', FETCH_PLAN_BODY, { ip: `198.51.100.${i + 1}` }),
      env,
      deps(fetchImpl),
    ),
  );
  const responses = await Promise.all(requests);
  const admitted = responses.filter((response) => response.status === 200).length;
  const refused = responses.filter((response) => response.status === 429).length;

  assert.equal(admitted, 3);
  assert.equal(refused, 9);
  assert.equal(calls.length, admitted);
  assert.equal(env.BUDGET_COORDINATOR.used(), admitted * reservation);
  assert.ok(admitted * reservation <= budget);
});

test('budget: missing or unavailable coordinator fails closed with the named refusal', async () => {
  const { fetchImpl, calls } = mockAnthropic({ propose_fetch_plan: FETCH_PLAN_OUTPUT });
  const environments = [
    makeEnv({ BUDGET_COORDINATOR: undefined }),
    makeEnv({
      BUDGET_COORDINATOR: {
        idFromName: () => ({}),
        get: () => ({
          fetch: async () => {
            throw new Error('coordinator unavailable');
          },
        }),
      },
    }),
  ];
  for (const env of environments) {
    const response = await handleRequest(
      req('/v1/assist/fetch-plan', FETCH_PLAN_BODY),
      env,
      deps(fetchImpl),
    );
    assert.equal(response.status, 429);
    assert.equal(((await response.json()) as { error: string }).error, MESSAGES.budget);
  }
  assert.equal(calls.length, 0);
});

// ---------------------------------------------------------------------------
// fetch-plan happy path
// ---------------------------------------------------------------------------

test('fetch-plan: forced-tool request shape, key stays in the header, proposal comes back', async () => {
  const { fetchImpl, calls } = mockAnthropic({ propose_fetch_plan: FETCH_PLAN_OUTPUT });
  const env = makeEnv();
  const res = await handleRequest(req('/v1/assist/fetch-plan', FETCH_PLAN_BODY), env, deps(fetchImpl));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);

  // Anthropic request shape
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, ANTHROPIC_URL);
  assert.equal(MODEL, 'claude-opus-4-8');
  assert.equal(calls[0].body.model, 'claude-opus-4-8');
  assert.equal(calls[0].body.max_tokens, 1024);
  assert.deepEqual(calls[0].body.thinking, { type: 'disabled' });
  assert.deepEqual(calls[0].body.tool_choice, { type: 'tool', name: 'propose_fetch_plan' });
  assert.equal((calls[0].headers as Record<string, string>)['x-api-key'], env.ANTHROPIC_API_KEY);

  // Response: the proposal, plus usage; never the key.
  const body = (await res.json()) as Record<string, unknown>;
  assert.deepEqual(body.fetch, FETCH_PLAN_OUTPUT.fetch);
  assert.equal(body.styleSystem, 'css-modules');
  assert.equal(body.model, MODEL);
  assert.deepEqual(body.usage, { input_tokens: 1000, output_tokens: 200 });
  assert.ok(!JSON.stringify(body).includes(env.ANTHROPIC_API_KEY));
});

test('fetch-plan: the { wrapper } tool-input envelope is unwrapped', async () => {
  const { fetchImpl } = mockAnthropic({ propose_fetch_plan: { plan: FETCH_PLAN_OUTPUT } });
  const res = await handleRequest(req('/v1/assist/fetch-plan', FETCH_PLAN_BODY), makeEnv(), deps(fetchImpl));
  assert.equal(res.status, 200);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.styleSystem, 'css-modules');
  assert.deepEqual(body.fetch, FETCH_PLAN_OUTPUT.fetch);
});

test('fetch-plan: an overlong fetch list is clamped to 12 and a rogue styleSystem falls back to unknown', async () => {
  const over = {
    fetch: Array.from({ length: 20 }, (_, i) => ({ path: `f${i}.css`, reason: 'r' })),
    styleSystem: 'not-a-style-system',
    notes: [],
  };
  const { fetchImpl } = mockAnthropic({ propose_fetch_plan: over });
  const res = await handleRequest(req('/v1/assist/fetch-plan', FETCH_PLAN_BODY), makeEnv(), deps(fetchImpl));
  const body = (await res.json()) as { fetch: unknown[]; styleSystem: string };
  assert.equal(body.fetch.length, 12);
  assert.equal(body.styleSystem, 'unknown');
});

test('fetch-plan: an optional profile rides along into the user message', async () => {
  const { fetchImpl, calls } = mockAnthropic({ propose_fetch_plan: FETCH_PLAN_OUTPUT });
  const withProfile = { ...FETCH_PLAN_BODY, profile: PROFILE_OUTPUT };
  await handleRequest(req('/v1/assist/fetch-plan', withProfile), makeEnv(), deps(fetchImpl));
  const messages = calls[0].body.messages as Array<{ content: string }>;
  assert.match(messages[0].content, /componentDirGlobs/);
});

// ---------------------------------------------------------------------------
// name-tokens happy path
// ---------------------------------------------------------------------------

test('name-tokens: forced tool, 4096 cap, renames shape back', async () => {
  const renames = [
    {
      from: '{provisional.button-1}',
      to: 'color.action.primary.background',
      rationale: 'primary action surface; matches the existing action.* family',
    },
  ];
  const { fetchImpl, calls } = mockAnthropic({ propose_token_names: { renames } });
  const res = await handleRequest(req('/v1/assist/name-tokens', NAME_TOKENS_BODY), makeEnv(), deps(fetchImpl));
  assert.equal(res.status, 200);
  assert.equal(calls[0].body.max_tokens, 4096);
  assert.equal(calls[0].body.model, MODEL);
  assert.deepEqual(calls[0].body.tool_choice, { type: 'tool', name: 'propose_token_names' });
  const body = (await res.json()) as { renames: unknown[] };
  assert.deepEqual(body.renames, renames);
});

// ---------------------------------------------------------------------------
// repo-profile: model path + cache path
// ---------------------------------------------------------------------------

test('repo-profile: first call hits the model and caches; second is a zero-token cache hit that burns no quota', async () => {
  const { fetchImpl, calls } = mockAnthropic({ propose_repo_profile: PROFILE_OUTPUT });
  const env = makeEnv({ ASSIST_IP_DAILY_LIMIT: '1' });
  const d = deps(fetchImpl);

  const first = await handleRequest(req('/v1/assist/repo-profile', REPO_PROFILE_BODY), env, d);
  assert.equal(first.status, 200);
  const firstBody = (await first.json()) as Record<string, unknown>;
  assert.equal(firstBody.cached, false);
  assert.deepEqual(firstBody.profile, PROFILE_OUTPUT);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.max_tokens, 2048);
  assert.ok(env.ASSIST_KV.store.has('profile:https://github.com/acme/ui@main'));

  // Same repo@ref again — cache answers, no model call, and (limit=1, already
  // used) no per-IP refusal either: hits are pre-quota by design.
  const second = await handleRequest(req('/v1/assist/repo-profile', REPO_PROFILE_BODY), env, d);
  assert.equal(second.status, 200);
  const secondBody = (await second.json()) as Record<string, unknown>;
  assert.equal(secondBody.cached, true);
  assert.deepEqual(secondBody.profile, PROFILE_OUTPUT);
  assert.equal(calls.length, 1);
});

test('repo-profile: a different ref is a different cache entry', async () => {
  const { fetchImpl, calls } = mockAnthropic({ propose_repo_profile: PROFILE_OUTPUT });
  const env = makeEnv();
  const d = deps(fetchImpl);
  await handleRequest(req('/v1/assist/repo-profile', REPO_PROFILE_BODY), env, d);
  await handleRequest(req('/v1/assist/repo-profile', { ...REPO_PROFILE_BODY, ref: 'v2' }), env, d);
  assert.equal(calls.length, 2);
  assert.ok(env.ASSIST_KV.store.has('profile:https://github.com/acme/ui@v2'));
});

test('repo-profile: envelope-wrapped profile output is unwrapped before caching', async () => {
  const { fetchImpl } = mockAnthropic({ propose_repo_profile: { profile: PROFILE_OUTPUT } });
  const env = makeEnv();
  const res = await handleRequest(req('/v1/assist/repo-profile', REPO_PROFILE_BODY), env, deps(fetchImpl));
  const body = (await res.json()) as { profile: { framework: string } };
  assert.equal(body.profile.framework, 'react');
  const cached = JSON.parse(env.ASSIST_KV.store.get('profile:https://github.com/acme/ui@main') as string);
  assert.equal(cached.framework, 'react');
});

test('repo-profile: oversized samples are refused with a named 400', async () => {
  const big = {
    ...REPO_PROFILE_BODY,
    samples: [{ path: 'huge.css', content: 'x'.repeat(250_000) }],
  };
  const res = await handleRequest(req('/v1/assist/repo-profile', big), makeEnv(), deps(mockAnthropic({}).fetchImpl));
  // Body cap (320KB) or sample cap (200KB) both refuse loudly; this one trips the sample cap.
  assert.equal(res.status, 400);
  assert.match(((await res.json()) as { error: string }).error, /200KB/);
});

test('repo-profile: sample content cap counts UTF-8 bytes', async () => {
  const content = '💥'.repeat(60_000);
  assert.ok(content.length < 200_000);
  assert.ok(Buffer.byteLength(content, 'utf8') > 200_000);
  const response = await handleRequest(
    req('/v1/assist/repo-profile', {
      ...REPO_PROFILE_BODY,
      samples: [{ path: 'theme.css', content }],
    }),
    makeEnv(),
    deps(mockAnthropic({}).fetchImpl),
  );
  assert.equal(response.status, 400);
  assert.match(((await response.json()) as { error: string }).error, /200KB/);
});

// ---------------------------------------------------------------------------
// fix-contract: request shape, salvage paths, named 400s, caps, upstream
// ---------------------------------------------------------------------------

const FIX_CONTRACT = {
  id: 'ds.badge',
  name: 'Badge',
  version: '0.1.0',
  status: 'draft',
  description: 'A small status badge.',
  semantics: { element: 'span' },
  props: [],
  states: [],
  anatomy: { root: { tokens: { background: '{color.feedback.info.background}' } } },
  anchors: {
    figma: { fileKey: null, componentSetKey: null, nodeId: null },
    code: { importPath: '@ds/components', export: 'Badge' },
  },
};

const FIX_CONTRACT_BODY = {
  contract: FIX_CONTRACT,
  refusals: ['anatomy root/background: token path color.feedback.info.background is not in the inventory'],
  tokenPaths: ['imported.badge.background', 'color.action.primary.background', 'radius.badge'],
};

const FIXED_CONTRACT = {
  ...FIX_CONTRACT,
  anatomy: { root: { tokens: { background: '{imported.badge.background}' } } },
};

test('fix-contract: forced tool at 8192, non-strict schema, key in header only; refusals + inventory + contract ride the user message', async () => {
  const { fetchImpl, calls } = mockAnthropic({ propose_contract_fix: { contract: FIXED_CONTRACT } });
  const env = makeEnv();
  const res = await handleRequest(req('/v1/assist/fix-contract', FIX_CONTRACT_BODY), env, deps(fetchImpl));
  assert.equal(res.status, 200);

  // Anthropic request shape
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, ANTHROPIC_URL);
  assert.equal(calls[0].body.model, MODEL);
  assert.equal(calls[0].body.max_tokens, 8192);
  assert.deepEqual(calls[0].body.thinking, { type: 'disabled' });
  assert.deepEqual(calls[0].body.tool_choice, { type: 'tool', name: 'propose_contract_fix' });
  const tool = (calls[0].body.tools as Array<Record<string, unknown>>)[0];
  assert.equal(tool.name, 'propose_contract_fix');
  // Deliberately NON-strict: the mirrored contract shape needs oneOf/const/pattern.
  assert.equal(tool.strict, undefined);
  assert.equal((calls[0].headers as Record<string, string>)['x-api-key'], env.ANTHROPIC_API_KEY);

  // User message carries refusals, the token inventory, and the contract — as data.
  const messages = calls[0].body.messages as Array<{ content: string }>;
  assert.match(messages[0].content, /"refusals"/);
  assert.match(messages[0].content, /is not in the inventory/);
  assert.match(messages[0].content, /"tokenInventory"/);
  assert.match(messages[0].content, /imported\.badge\.background/);
  assert.match(messages[0].content, /"ds\.badge"/);

  // Response: the proposal plus usage; never the key.
  const body = (await res.json()) as Record<string, unknown>;
  assert.deepEqual(body.contract, FIXED_CONTRACT);
  assert.equal(body.model, MODEL);
  assert.deepEqual(body.usage, { input_tokens: 1000, output_tokens: 200 });
  assert.ok(!JSON.stringify(body).includes(env.ANTHROPIC_API_KEY));
});

test('fix-contract: a double-wrapped { contract: { contract } } tool input is unwrapped', async () => {
  const { fetchImpl } = mockAnthropic({ propose_contract_fix: { contract: { contract: FIXED_CONTRACT } } });
  const res = await handleRequest(req('/v1/assist/fix-contract', FIX_CONTRACT_BODY), makeEnv(), deps(fetchImpl));
  assert.equal(res.status, 200);
  assert.deepEqual(((await res.json()) as { contract: unknown }).contract, FIXED_CONTRACT);
});

test('fix-contract: a flat contract (model omits the wrapper) is salvaged', async () => {
  const { fetchImpl } = mockAnthropic({ propose_contract_fix: FIXED_CONTRACT });
  const res = await handleRequest(req('/v1/assist/fix-contract', FIX_CONTRACT_BODY), makeEnv(), deps(fetchImpl));
  assert.equal(res.status, 200);
  assert.deepEqual(((await res.json()) as { contract: unknown }).contract, FIXED_CONTRACT);
});

// --- removal guardrails (owner field case: an AI round "fixed" duplicate part
// --- names by DELETING parts — the rendered Dialog lost its close icon and
// --- action buttons; legal-but-lossy). The prompt forbids removal-as-fix and
// --- the tool carries a machine-readable `removals` declaration channel.

test('fix-contract: the system prompt forbids removal-as-fix and demands declared removals', async () => {
  const { fetchImpl, calls } = mockAnthropic({ propose_contract_fix: { contract: FIXED_CONTRACT } });
  await handleRequest(req('/v1/assist/fix-contract', FIX_CONTRACT_BODY), makeEnv(), deps(fetchImpl));
  const system = String(calls[0].body.system);
  assert.match(system, /NEVER remove anatomy parts, component refs, slots, props, or events/);
  assert.match(system, /deletion is not a fix/);
  assert.match(system, /RENAMING/);
  assert.match(system, /DECLARE every removed thing in the `removals` field/);
  assert.match(system, /undeclared loss/);
  assert.match(system, /removals: \[\]/);
});

test('fix-contract: the forced tool schema carries the removals declaration channel', async () => {
  const { fetchImpl, calls } = mockAnthropic({ propose_contract_fix: { contract: FIXED_CONTRACT } });
  await handleRequest(req('/v1/assist/fix-contract', FIX_CONTRACT_BODY), makeEnv(), deps(fetchImpl));
  const tool = (calls[0].body.tools as Array<Record<string, unknown>>)[0];
  const schema = tool.input_schema as {
    required: string[];
    properties: { removals?: { items?: { required?: string[]; properties?: { kind?: { enum?: string[] } } } } };
  };
  assert.ok(schema.required.includes('removals'), 'removals is a required top-level key');
  const items = schema.properties.removals?.items;
  assert.deepEqual(items?.required, ['kind', 'path', 'reason']);
  assert.ok(items?.properties?.kind?.enum?.includes('part'));
  assert.ok(items?.properties?.kind?.enum?.includes('component-ref'));
  assert.ok(items?.properties?.kind?.enum?.includes('slot'));
  assert.ok(items?.properties?.kind?.enum?.includes('prop'));
});

test('fix-contract: declared removals pass through shape-checked — junk dropped, unknown kind folds to "other"', async () => {
  const { fetchImpl } = mockAnthropic({
    propose_contract_fix: {
      contract: FIXED_CONTRACT,
      removals: [
        { kind: 'part', path: 'root/Actions/buttonBrandPrimary', reason: 'refusal named it unresolvable' },
        { kind: 'something-weird', path: 'root/scrollBar' },
        { reason: 'no path — dropped' },
        'not even an object',
      ],
    },
  });
  const res = await handleRequest(req('/v1/assist/fix-contract', FIX_CONTRACT_BODY), makeEnv(), deps(fetchImpl));
  assert.equal(res.status, 200);
  const body = (await res.json()) as { removals: unknown };
  assert.deepEqual(body.removals, [
    { kind: 'part', path: 'root/Actions/buttonBrandPrimary', reason: 'refusal named it unresolvable' },
    { kind: 'other', path: 'root/scrollBar', reason: '' },
  ]);
});

test('fix-contract: a response without removals answers an EMPTY array — never invented, never undefined', async () => {
  const { fetchImpl } = mockAnthropic({ propose_contract_fix: { contract: FIXED_CONTRACT } });
  const res = await handleRequest(req('/v1/assist/fix-contract', FIX_CONTRACT_BODY), makeEnv(), deps(fetchImpl));
  assert.equal(res.status, 200);
  assert.deepEqual(((await res.json()) as { removals: unknown }).removals, []);
});

test('fix-contract: every input violation is refused by name; the oversized body is a 413', async () => {
  const { fetchImpl, calls } = mockAnthropic({ propose_contract_fix: { contract: FIXED_CONTRACT } });
  const env = makeEnv();
  const d = deps(fetchImpl);
  const cases: Array<{ body: unknown; status: number; message: RegExp }> = [
    { body: { ...FIX_CONTRACT_BODY, contract: undefined }, status: 400, message: /contract \(object\) is required/ },
    { body: { ...FIX_CONTRACT_BODY, contract: 'not an object' }, status: 400, message: /contract \(object\) is required/ },
    { body: { ...FIX_CONTRACT_BODY, contract: { pad: 'x'.repeat(65_000) } }, status: 400, message: /under 64KB/ },
    { body: { ...FIX_CONTRACT_BODY, refusals: undefined }, status: 400, message: /refusals \(non-empty array of strings\)/ },
    { body: { ...FIX_CONTRACT_BODY, refusals: [] }, status: 400, message: /refusals \(non-empty array of strings\)/ },
    { body: { ...FIX_CONTRACT_BODY, refusals: [42] }, status: 400, message: /refusals \(non-empty array of strings\)/ },
    { body: { ...FIX_CONTRACT_BODY, refusals: Array.from({ length: 51 }, () => 'r') }, status: 400, message: /at most 50/ },
    { body: { ...FIX_CONTRACT_BODY, tokenPaths: undefined }, status: 400, message: /tokenPaths \(non-empty array of strings\)/ },
    { body: { ...FIX_CONTRACT_BODY, tokenPaths: [] }, status: 400, message: /tokenPaths \(non-empty array of strings\)/ },
    { body: { ...FIX_CONTRACT_BODY, tokenPaths: Array.from({ length: 3001 }, (_, i) => `p${i}`) }, status: 400, message: /at most 3000 paths/ },
    // 320KB body cap trips before JSON parsing or any named check.
    { body: { ...FIX_CONTRACT_BODY, refusals: ['x'.repeat(330_000)] }, status: 413, message: /too large/ },
  ];
  for (const c of cases) {
    const res = await handleRequest(req('/v1/assist/fix-contract', c.body), env, d);
    assert.equal(res.status, c.status, `expected ${c.status} for ${c.message}`);
    assert.match(((await res.json()) as { error: string }).error, c.message);
  }
  assert.equal(calls.length, 0); // refusals are free — no model call, no quota
});

test('fix-contract: serialized contract cap counts UTF-8 bytes', async () => {
  const multibyteContract = { ...FIX_CONTRACT, description: '💥'.repeat(20_000) };
  const serialized = JSON.stringify(multibyteContract);
  assert.ok(serialized.length < 64_000);
  assert.ok(Buffer.byteLength(serialized, 'utf8') > 64_000);
  const response = await handleRequest(
    req('/v1/assist/fix-contract', { ...FIX_CONTRACT_BODY, contract: multibyteContract }),
    makeEnv(),
    deps(mockAnthropic({}).fetchImpl),
  );
  assert.equal(response.status, 400);
  assert.match(((await response.json()) as { error: string }).error, /under 64KB/);
});

test('fix-contract: per-IP cap refuses with 429 and is its own endpoint class', async () => {
  const { fetchImpl } = mockAnthropic({
    propose_contract_fix: { contract: FIXED_CONTRACT },
    propose_fetch_plan: FETCH_PLAN_OUTPUT,
  });
  const env = makeEnv({ ASSIST_IP_DAILY_LIMIT: '1' });
  const d = deps(fetchImpl);
  assert.equal((await handleRequest(req('/v1/assist/fix-contract', FIX_CONTRACT_BODY), env, d)).status, 200);
  const second = await handleRequest(req('/v1/assist/fix-contract', FIX_CONTRACT_BODY), env, d);
  assert.equal(second.status, 429);
  assert.equal(((await second.json()) as { error: string }).error, MESSAGES.ipLimit);
  // The fix-contract cap does not burn the fetch-plan class for the same IP.
  assert.equal((await handleRequest(req('/v1/assist/fetch-plan', FETCH_PLAN_BODY), env, d)).status, 200);
});

test('fix-contract: a spent budget answers 429 before any model call', async () => {
  const { fetchImpl, calls } = mockAnthropic({ propose_contract_fix: { contract: FIXED_CONTRACT } });
  const env = makeEnv({ ASSIST_DAILY_TOKEN_BUDGET: '500' });
  env.BUDGET_COORDINATOR.seed(500);
  const res = await handleRequest(req('/v1/assist/fix-contract', FIX_CONTRACT_BODY), env, deps(fetchImpl));
  assert.equal(res.status, 429);
  assert.equal(((await res.json()) as { error: string }).error, MESSAGES.budget);
  assert.equal(calls.length, 0);
});

test('fix-contract: a non-object contract in the tool output answers 502 — with its reservation retained', async () => {
  const { fetchImpl, calls } = mockAnthropic({ propose_contract_fix: { contract: 'not an object' } });
  const env = makeEnv();
  const res = await handleRequest(req('/v1/assist/fix-contract', FIX_CONTRACT_BODY), env, deps(fetchImpl));
  assert.equal(res.status, 502);
  assert.match(((await res.json()) as { error: string }).error, /no contract object/);
  assert.equal(calls.length, 1);
  // The model was called, so the conservative pre-call reservation remains.
  assert.ok(env.BUDGET_COORDINATOR.used() > 8192);
});

test('fix-contract: upstream mapping — no tool_use 502, 429/529 retryable 429, other errors 502', async () => {
  const noTool = await handleRequest(
    req('/v1/assist/fix-contract', FIX_CONTRACT_BODY),
    makeEnv(),
    deps(mockAnthropic({}).fetchImpl), // scripted to answer text-only
  );
  assert.equal(noTool.status, 502);
  assert.match(((await noTool.json()) as { error: string }).error, /nothing to propose/);
  const rl = await handleRequest(
    req('/v1/assist/fix-contract', FIX_CONTRACT_BODY),
    makeEnv(),
    deps(mockAnthropic({}, { status: 529 }).fetchImpl),
  );
  assert.equal(rl.status, 429);
  const err = await handleRequest(
    req('/v1/assist/fix-contract', FIX_CONTRACT_BODY),
    makeEnv(),
    deps(mockAnthropic({}, { status: 500 }).fetchImpl),
  );
  assert.equal(err.status, 502);
  assert.ok(!(((await err.json()) as { error: string }).error).includes('upstream detail'));
});

// ---------------------------------------------------------------------------
// Upstream failure shapes
// ---------------------------------------------------------------------------

test('upstream: a response with no tool_use answers 502 without leaking upstream detail', async () => {
  const { fetchImpl } = mockAnthropic({}); // scripted to answer text-only
  const res = await handleRequest(req('/v1/assist/fetch-plan', FETCH_PLAN_BODY), makeEnv(), deps(fetchImpl));
  assert.equal(res.status, 502);
  assert.match(((await res.json()) as { error: string }).error, /nothing to propose/);
});

test('upstream: Anthropic 429/529 surfaces as a retryable 429; other errors as 502', async () => {
  const rl = await handleRequest(
    req('/v1/assist/fetch-plan', FETCH_PLAN_BODY),
    makeEnv(),
    deps(mockAnthropic({}, { status: 529 }).fetchImpl),
  );
  assert.equal(rl.status, 429);
  const err = await handleRequest(
    req('/v1/assist/fetch-plan', FETCH_PLAN_BODY),
    makeEnv(),
    deps(mockAnthropic({}, { status: 500 }).fetchImpl),
  );
  assert.equal(err.status, 502);
  assert.ok(!(((await err.json()) as { error: string }).error).includes('upstream detail'));
});
