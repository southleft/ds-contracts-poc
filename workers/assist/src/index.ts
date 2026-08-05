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
 *   → per-IP daily cap → conservative global budget reservation → one model call.
 */
import type { Deps, Env } from './env';
import { corsHeaders, resolveOrigin } from './cors';
import { clientIp, reserveBudget, reserveIpSlot } from './limits';
import { AssistUpstreamError, callClaude, MODEL } from './anthropic';
import { ENDPOINTS } from './endpoints';
import { handleBridge } from './bridge';
import { handleChannel } from './channel';
export { BudgetCoordinator } from './budget-coordinator';

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
  // The plugin bridge routes first: it has its own CORS policy and explicit
  // capabilities (Origin is never authorization), plus its own kill switch.
  // Nothing below (assist CORS, ASSIST_ENABLED, Anthropic) applies.
  const url = new URL(request.url);
  if (url.pathname === '/bridge/session' || url.pathname.startsWith('/bridge/')) {
    return handleBridge(request, url, env, deps);
  }
  // The standing CI↔Figma channel (docs/18 G1) routes next, on the same
  // terms: its own kill switch (CHANNEL_ENABLED), its own counters, any
  // origin (both callers are origin-less — a CI runner and a Figma plugin),
  // and never a single Anthropic token. See src/channel.ts.
  if (url.pathname === '/channel/claim' || url.pathname.startsWith('/channel/')) {
    return handleChannel(request, url, env, deps);
  }

  // Browser CORS policy first for this anonymous surface. Origin is spoofable
  // by non-browser callers and is not treated as authentication.
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
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
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
  const userMessage = endpoint.buildUserMessage(data);

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
  // One token cannot represent less than one UTF-8 byte, so input bytes plus
  // max_tokens is a conservative per-request ceiling. Include compiled prompt
  // and tool schema plus fixed envelope headroom. The per-day Durable Object
  // atomically admits or refuses the global reservation before the model call.
  const reservationTokens =
    new TextEncoder().encode(endpoint.system + JSON.stringify(endpoint.tool) + userMessage).byteLength +
    endpoint.maxTokens +
    1024;
  if (!(await reserveBudget(env, reservationTokens, now))) {
    return json(429, { error: MESSAGES.budget }, cors);
  }

  let output: unknown;
  try {
    const result = await callClaude({
      system: endpoint.system,
      tool: endpoint.tool,
      toolName: endpoint.toolName,
      maxTokens: endpoint.maxTokens,
      userMessage,
      apiKey: env.ANTHROPIC_API_KEY,
      fetchImpl: deps.fetchImpl,
      expectedKeys: endpoint.expectedKeys,
    });
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
