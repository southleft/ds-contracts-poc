/**
 * ds-contracts-assist — the playground's agentic-assist backend.
 *
 * Anonymous visitors borrow a server-held Anthropic key for four narrow,
 * tool-forced tasks. The Worker is deliberately NOT a governance bypass:
 * everything it returns is a proposal, the playground's contract schema is
 * the referee, and the Worker has zero side-effect capabilities.
 *
 * Gate order (cheapest refusal first):
 *   CORS → kill switch → route/method → body parse → input validation
 *   → cache (repo-profile only; hits cost zero tokens and no quota)
 *   → per-IP daily cap → global daily token budget → one model call.
 */
import type { Deps, Env } from './env';
import { corsHeaders, resolveOrigin } from './cors';
import { budgetSpent, chargeBudget, clientIp, reserveIpSlot } from './limits';
import { AssistUpstreamError, callClaude, MODEL } from './anthropic';
import { ENDPOINTS } from './endpoints';
import { handleBridge } from './bridge';

export const MESSAGES = {
  disabled: 'assist is switched off — the owner has not enabled the shared budget yet',
  forbiddenOrigin: 'assist only answers the ds-contracts playground — this origin is not allowed',
  ipLimit: 'assist limit reached for today on this task — try again tomorrow',
  budget:
    'daily assist budget spent — bring your own key in the Describe tab pattern, or try tomorrow',
} as const;

const MAX_BODY_BYTES = 320_000; // repo-profile samples (200KB) + tree + headroom

const json = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

export async function handleRequest(
  request: Request,
  env: Env,
  deps: Deps = { fetchImpl: (...args: Parameters<typeof fetch>) => fetch(...args), now: () => new Date() },
): Promise<Response> {
  // The plugin bridge routes first: it has its own (asymmetric) origin gate —
  // the Figma plugin's upload arrives with `Origin: null` — and its own kill
  // switch. Nothing below (assist CORS, ASSIST_ENABLED, Anthropic) applies.
  const url = new URL(request.url);
  if (url.pathname === '/bridge/session' || url.pathname.startsWith('/bridge/')) {
    return handleBridge(request, url, env, deps);
  }

  // CORS first: an origin we do not serve learns nothing else about us.
  const origin = resolveOrigin(request, env);
  if (!origin) return json(403, { error: MESSAGES.forbiddenOrigin });
  const cors = corsHeaders(origin);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  if (env.ASSIST_ENABLED !== 'true') return json(503, { error: MESSAGES.disabled }, cors);

  const match = /^\/v1\/assist\/([a-z-]+)$/.exec(new URL(request.url).pathname);
  const endpoint = match ? ENDPOINTS[match[1]] : undefined;
  if (!endpoint) return json(404, { error: 'unknown assist endpoint' }, cors);
  if (request.method !== 'POST') return json(405, { error: 'POST only' }, cors);

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json(413, { error: 'request body too large — trim the listing/samples' }, cors);
  }
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return json(400, { error: 'body must be valid JSON' }, cors);
  }

  const invalid = endpoint.validate(input);
  if (invalid) return json(400, { error: invalid }, cors);
  const data = input as Record<string, unknown>;

  const now = deps.now();

  // Cache hit (repo-profile): shareable across visitors, costs zero tokens,
  // burns no per-IP quota. Checked before any counter on purpose.
  const cacheKey = endpoint.cacheKey?.(data);
  if (cacheKey) {
    const hit = await env.ASSIST_KV.get(cacheKey);
    if (hit !== null) {
      try {
        return json(200, { profile: JSON.parse(hit), cached: true }, cors);
      } catch {
        // A corrupt cache entry falls through to a fresh model call.
      }
    }
  }

  if (!(await reserveIpSlot(env, endpoint.name, clientIp(request), now))) {
    return json(429, { error: MESSAGES.ipLimit }, cors);
  }
  if (await budgetSpent(env, now)) {
    return json(429, { error: MESSAGES.budget }, cors);
  }

  let output: unknown;
  try {
    const result = await callClaude({
      system: endpoint.system,
      tool: endpoint.tool,
      toolName: endpoint.toolName,
      maxTokens: endpoint.maxTokens,
      userMessage: endpoint.buildUserMessage(data),
      apiKey: env.ANTHROPIC_API_KEY,
      fetchImpl: deps.fetchImpl,
      expectedKeys: endpoint.expectedKeys,
    });
    await chargeBudget(env, result.usage.input_tokens + result.usage.output_tokens, now);
    output = result.output;

    const proposal = endpoint.postprocess(output);
    if (cacheKey && endpoint.cacheTtlSeconds) {
      await env.ASSIST_KV.put(cacheKey, JSON.stringify(proposal), {
        expirationTtl: endpoint.cacheTtlSeconds,
      });
      return json(200, { profile: proposal, cached: false, model: MODEL, usage: result.usage }, cors);
    }
    return json(200, { ...proposal, model: MODEL, usage: result.usage }, cors);
  } catch (e) {
    if (e instanceof AssistUpstreamError) return json(e.status, { error: e.message }, cors);
    // Never leak internals (or the key) to anonymous visitors.
    return json(500, { error: 'assist failed unexpectedly — try again shortly' }, cors);
  }
}

export default {
  fetch: (request: Request, env: Env): Promise<Response> => handleRequest(request, env),
};
