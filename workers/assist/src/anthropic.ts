/**
 * Plain-fetch client for api.anthropic.com/v1/messages — no SDK, one call
 * shape: a single forced tool, thinking off, hard max_tokens. The tool
 * schema aims the generation; the client-side contract schema referees it.
 *
 * The API key travels in exactly one place (the x-api-key header) and is
 * never logged or echoed. Upstream failures surface as AssistUpstreamError
 * with a message safe to hand to anonymous visitors.
 */
export const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

/** Owner decision: every endpoint runs Opus — outputs people can trust; cost is capped elsewhere. */
export const MODEL = 'claude-opus-4-8';

export interface Usage {
  input_tokens: number;
  output_tokens: number;
}

export class AssistUpstreamError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface AnthropicResponse {
  content?: Array<Record<string, unknown>>;
  stop_reason?: string;
  usage?: { input_tokens?: unknown; output_tokens?: unknown };
  error?: { type?: string; message?: string };
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * The live API sometimes returns the tool input wrapped one level deep in a
 * single-property envelope (seen in the playground's Describe tab: the tool
 * schema's lone top-level property comes back as `{ contract: {…} }`).
 * If none of the expected keys are present but a lone object-valued key
 * contains them, unwrap. Tolerates the already-flat shape.
 */
export function unwrapToolInput(input: unknown, expectedKeys: string[]): unknown {
  if (!isObj(input)) return input;
  if (expectedKeys.some((k) => k in input)) return input;
  const keys = Object.keys(input);
  if (keys.length !== 1) return input;
  const inner = input[keys[0]];
  if (isObj(inner) && expectedKeys.some((k) => k in inner)) return inner;
  return input;
}

export interface ClaudeCall {
  system: string;
  tool: Record<string, unknown>;
  toolName: string;
  maxTokens: number;
  userMessage: string;
  apiKey: string;
  fetchImpl: typeof fetch;
  expectedKeys: string[];
}

export async function callClaude(
  call: ClaudeCall,
): Promise<{ output: unknown; usage: Usage }> {
  let res: Response;
  try {
    res = await call.fetchImpl(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': call.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: call.maxTokens,
        // Forced tool_choice pairs with thinking off; the schema does the aiming.
        thinking: { type: 'disabled' },
        system: call.system,
        tools: [call.tool],
        tool_choice: { type: 'tool', name: call.toolName },
        messages: [{ role: 'user', content: call.userMessage }],
      }),
    });
  } catch {
    throw new AssistUpstreamError(502, 'could not reach the model — try again shortly');
  }

  const body = (await res.json().catch(() => null)) as AnthropicResponse | null;
  if (!res.ok) {
    // Do not forward upstream detail verbatim to anonymous visitors; name the class.
    if (res.status === 429 || res.status === 529) {
      throw new AssistUpstreamError(429, 'the model is rate limited right now — try again shortly');
    }
    throw new AssistUpstreamError(502, `the model answered ${res.status} — nothing to propose from`);
  }
  if (!body || !Array.isArray(body.content)) {
    throw new AssistUpstreamError(502, 'the model answered without a message — nothing to propose from');
  }
  const toolUse = body.content.find((b) => b.type === 'tool_use' && b.name === call.toolName);
  if (!toolUse) {
    throw new AssistUpstreamError(
      502,
      `the model returned no ${call.toolName} call (stop_reason: ${body.stop_reason ?? 'unknown'}) — nothing to propose from`,
    );
  }
  const usage: Usage = {
    input_tokens: typeof body.usage?.input_tokens === 'number' ? body.usage.input_tokens : 0,
    output_tokens: typeof body.usage?.output_tokens === 'number' ? body.usage.output_tokens : 0,
  };
  return { output: unwrapToolInput(toolUse.input, call.expectedKeys), usage };
}
