/**
 * Prompt → contract (W9) — governed generation, browser-direct.
 *
 * A user-supplied Anthropic key and one prompt produce a CONTRACT, never
 * freeform code: the call forces a single tool whose input_schema is a
 * pruned, hand-authored JSON-Schema rendering of the contract shape, and
 * whatever comes back lands in the same ContractSchema + generator referee
 * every other source goes through. If the model's output refuses by name,
 * the refusal text goes back as a tool_result (max MAX_FIX_ROUNDS rounds,
 * never silently) — governance visible IS the demo.
 *
 * Browser-direct by design: the key is sent to api.anthropic.com and
 * nowhere else, never stored, gone on reload — same posture as the Figma
 * token. `anthropic-dangerous-direct-browser-access: true` is Anthropic's
 * documented CORS opt-in for exactly this user-key-in-browser pattern.
 *
 * The transport is injectable (github-import/figma-import pattern): the
 * demo mode replays recorded-shape responses through the identical code
 * path, so the whole flow is verifiable without a key.
 */
import badgeContract from '../../../contracts/badge.contract.json';
import { activeTokens } from './token-source.js';

/** Fixed model — cheap + capable default for schema-constrained generation. */
export const ANTHROPIC_MODEL = 'claude-sonnet-5';
export const MAX_FIX_ROUNDS = 2;

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const TOOL_NAME = 'propose_contract';
const MAX_OUTPUT_TOKENS = 8192;

export type FetchLike = typeof fetch;

// ---------------------------------------------------------------------------
// The tool schema — a PRUNED, hand-authored JSON-Schema view of the contract
// shape. Deliberately NOT a serialization of the full zod schema: it covers
// what a prompt-born component needs (identity, semantics, enum/text/boolean
// props with both bindings, states, an anatomy tree with token refs + layout,
// optional events, fixed-shape anchors). ContractSchema remains the referee;
// this schema only aims the generation.
// ---------------------------------------------------------------------------

const CONTRACT_TOOL = {
  name: TOOL_NAME,
  description:
    'Propose a component contract — the machine-readable single source of truth ' +
    'between design and code. Every token reference must come from the provided ' +
    'inventory; the contract is validated by the same schema and generator that ' +
    'ship the design system, and violations are refused by name.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'name', 'version', 'status', 'description', 'semantics', 'props', 'states', 'anatomy', 'anchors'],
    $defs: {
      tokenRef: {
        type: 'string',
        pattern: '^\\{[a-z0-9.{}-]+\\}$',
        description:
          'Brace-wrapped token path from the inventory, e.g. "{radius.badge}". ' +
          'May contain an enum-prop placeholder that expands over its values, ' +
          'e.g. "{color.feedback.{variant}.background}".',
      },
      layout: {
        type: 'object',
        additionalProperties: false,
        properties: {
          display: { enum: ['flex', 'inline-flex'] },
          direction: { enum: ['row', 'column'] },
          align: { enum: ['start', 'center', 'end', 'stretch'] },
          justify: { enum: ['start', 'center', 'end', 'space-between'] },
          grow: { type: 'boolean' },
        },
      },
      part: {
        type: 'object',
        additionalProperties: false,
        properties: {
          description: { type: 'string' },
          element: { type: 'string', description: 'HTML element for this part (default div/span).' },
          layout: { $ref: '#/$defs/layout' },
          tokens: {
            type: 'object',
            description: 'CSS property → token reference. The stylesheet and Figma bindings are generated from these.',
            additionalProperties: { $ref: '#/$defs/tokenRef' },
          },
          states: {
            type: 'object',
            description: 'Root part only: interaction state (hover | focus-visible | disabled) → (CSS property → token reference).',
            additionalProperties: {
              type: 'object',
              additionalProperties: { $ref: '#/$defs/tokenRef' },
            },
          },
          content: {
            type: 'object',
            additionalProperties: false,
            required: ['prop'],
            properties: { prop: { type: 'string', description: 'Text prop rendered as this part’s content.' } },
          },
          text: { type: 'string', description: 'Static literal text, same on both surfaces.' },
          visibleWhen: {
            type: 'object',
            additionalProperties: false,
            required: ['prop'],
            properties: {
              prop: { type: 'string' },
              equals: { type: 'string', description: 'Required for enum props; omit for booleans (truthy).' },
            },
          },
          optional: { type: 'boolean' },
          parts: {
            type: 'object',
            description: 'Nested child parts — anatomy is a tree.',
            additionalProperties: { $ref: '#/$defs/part' },
          },
        },
      },
    },
    properties: {
      id: {
        type: 'string',
        pattern: '^[a-z][a-z0-9-]*\\.[a-z][a-z0-9-]*$',
        description: 'Stable canonical id, namespace.name — use "ds.<kebab-name>".',
      },
      name: { type: 'string', description: 'PascalCase display/export name, e.g. "Badge".' },
      version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$', description: 'Semver. New contracts start at "0.1.0".' },
      status: { enum: ['draft', 'stable', 'deprecated'], description: 'New contracts are "draft".' },
      description: { type: 'string' },
      semantics: {
        type: 'object',
        additionalProperties: false,
        required: ['element'],
        properties: {
          element: {
            enum: ['button', 'span', 'div', 'a', 'input', 'article', 'section', 'header', 'footer',
              'label', 'nav', 'hr', 'ul', 'li', 'p', 'textarea', 'select', 'fieldset',
              'blockquote', 'code', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
          },
          role: { type: 'string', description: 'ARIA role when the element alone does not carry it.' },
        },
      },
      props: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'type', 'bindings'],
          properties: {
            name: { type: 'string', description: 'camelCase. The default text slot must be named "children".' },
            description: { type: 'string' },
            type: {
              description: '"text" | "boolean" | { "enum": [...] } — enum values are canonical lowercase.',
              oneOf: [
                { enum: ['text', 'boolean'] },
                {
                  type: 'object',
                  additionalProperties: false,
                  required: ['enum'],
                  properties: { enum: { type: 'array', items: { type: 'string' }, minItems: 1 } },
                },
              ],
            },
            default: {
              description: 'Default value. For enums: one of the values. Text props may omit it and set required.',
              oneOf: [{ type: 'string' }, { type: 'boolean' }],
            },
            required: { type: 'boolean' },
            bindings: {
              type: 'object',
              additionalProperties: false,
              required: ['figma', 'code'],
              properties: {
                figma: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['kind', 'property'],
                  properties: {
                    kind: { enum: ['VARIANT', 'BOOLEAN', 'TEXT'] },
                    property: { type: 'string', description: 'Figma property name — Title Case, e.g. "Variant", "Label".' },
                    values: {
                      type: 'object',
                      description: 'Enum props only: canonical value → Figma variant value, e.g. { "info": "Info" }.',
                      additionalProperties: { type: 'string' },
                    },
                  },
                },
                code: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['prop'],
                  properties: { prop: { type: 'string', description: 'The React prop name — usually the canonical name.' } },
                },
              },
            },
          },
        },
      },
      events: {
        type: 'array',
        description: 'Optional code-side callbacks fired when a part is activated.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'bindings', 'trigger'],
          properties: {
            name: { type: 'string', pattern: '^[a-z][a-zA-Z0-9]*$' },
            description: { type: 'string' },
            bindings: {
              type: 'object',
              additionalProperties: false,
              required: ['code'],
              properties: {
                code: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['prop'],
                  properties: { prop: { type: 'string', pattern: '^on[A-Z][a-zA-Z0-9]*$' } },
                },
              },
            },
            trigger: { type: 'string', description: 'Anatomy part name whose activation fires the event; "root" allowed.' },
          },
        },
      },
      states: {
        type: 'array',
        items: { enum: ['hover', 'focus-visible', 'disabled'] },
        description: 'Interaction states the component styles. Empty array for static components.',
      },
      anatomy: {
        type: 'object',
        description: 'Part tree. Must contain a part named "root"; the root part styles the semantics.element.',
        additionalProperties: { $ref: '#/$defs/part' },
      },
      a11y: {
        type: 'object',
        additionalProperties: false,
        properties: {
          focusVisible: { type: 'boolean' },
          minHitArea: { type: 'number' },
          contrast: { enum: ['AA', 'AAA'] },
        },
      },
      anchors: {
        type: 'object',
        additionalProperties: false,
        required: ['figma', 'code'],
        description: 'Per-side identity anchors. Prompt-born contracts have no canvas yet: every figma anchor is null.',
        properties: {
          figma: {
            type: 'object',
            additionalProperties: false,
            required: ['fileKey', 'componentSetKey', 'nodeId'],
            properties: {
              fileKey: { type: 'null' },
              componentSetKey: { type: 'null' },
              nodeId: { type: 'null' },
            },
          },
          code: {
            type: 'object',
            additionalProperties: false,
            required: ['importPath', 'export'],
            properties: {
              importPath: { const: '@ds/components' },
              export: { type: 'string', description: 'PascalCase(name).' },
            },
          },
        },
      },
    },
  },
} as const;

/** Rough size receipt for the tool schema (chars — the UI reports it). */
export const CONTRACT_TOOL_JSON = JSON.stringify(CONTRACT_TOOL);

// ---------------------------------------------------------------------------
// System prompt — authoring rules + the ACTIVE token inventory + one compact
// exemplar (Badge, anchors rewritten to the prompt-born shape).
// ---------------------------------------------------------------------------

const pascal = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function exemplar(): string {
  const raw = badgeContract as Record<string, unknown>;
  const { $schema: _drop, ...rest } = raw;
  return JSON.stringify({
    ...rest,
    anchors: {
      figma: { fileKey: null, componentSetKey: null, nodeId: null },
      code: { importPath: '@ds/components', export: 'Badge' },
    },
  });
}

export function buildSystemPrompt(): string {
  const source = activeTokens();
  const inventory = [...source.inventory].sort().join('\n');
  return [
    'You author COMPONENT CONTRACTS for a design system. A contract is the',
    'machine-readable single source of truth between the Figma canvas and code:',
    'props with bindings for both surfaces, an anatomy tree binding CSS',
    'properties to design tokens, and per-side identity anchors. You never',
    'write component code — the generators do; you produce the contract via',
    `the ${TOOL_NAME} tool, matching its schema exactly.`,
    '',
    'HARD RULES — violations are refused by name by the schema and generator:',
    '1. Every token reference must be a path from the TOKEN INVENTORY below,',
    '   brace-wrapped. Never invent, abbreviate, or guess a token path. An',
    '   enum-prop placeholder like {color.feedback.{variant}.background} is',
    '   legal ONLY if the expansion for EVERY enum value exists in the',
    '   inventory.',
    '2. Canonical enum values are lowercase (e.g. "info", "primary"); the',
    '   figma binding "values" map carries the Title Case canvas spellings.',
    '3. anchors are EXACTLY: {"figma":{"fileKey":null,"componentSetKey":null,',
    '   "nodeId":null},"code":{"importPath":"@ds/components","export":',
    '   PascalCase(name)}} — a prompt-born contract has no canvas yet.',
    '4. The anatomy must contain a part named "root". Root styles the',
    '   semantics.element. Text content binds to a prop via {"content":',
    '   {"prop":"children"}} on a part.',
    '5. id is "ds." + kebab-case(name); version starts at "0.1.0"; status is',
    '   "draft". Declared "states" require matching root state token',
    '   overrides.',
    '6. Prefer the smallest complete contract: only the props, parts, and',
    '   states the described component actually needs.',
    '',
    `TOKEN INVENTORY (${source.inventory.size} paths — ${source.label}):`,
    inventory,
    '',
    'EXEMPLAR (Badge — the shape and scale to aim for):',
    exemplar(),
  ].join('\n');
}

// ---------------------------------------------------------------------------
// The call + conversation state for fix rounds
// ---------------------------------------------------------------------------

interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}

interface AnthropicResponse {
  type?: string;
  content?: Array<Record<string, unknown>>;
  usage?: { input_tokens?: number; output_tokens?: number };
  stop_reason?: string;
  error?: { type?: string; message?: string };
}

/** Opaque-ish conversation state carried between generate and fix rounds. */
export interface PromptSession {
  messages: unknown[];
  lastToolUseId: string;
  /** Fix rounds used so far (0 after the first generation). */
  rounds: number;
  /** Cumulative usage across all calls in this session. */
  usage: { inputTokens: number | null; outputTokens: number | null };
}

export interface PromptResult {
  /** The tool input — a contract candidate. NOT yet validated; the editor referees it. */
  contract: unknown;
  session: PromptSession;
}

async function callClaude(
  messages: unknown[],
  apiKey: string,
  fetchImpl: FetchLike,
): Promise<{ toolUse: ToolUseBlock; usage: AnthropicResponse['usage']; assistantContent: unknown }> {
  let res: Response;
  try {
    res = await fetchImpl(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        // Anthropic's documented CORS opt-in for user-key browser apps.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        // Forced tool_choice pairs with thinking off; the schema does the aiming.
        thinking: { type: 'disabled' },
        system: buildSystemPrompt(),
        tools: [CONTRACT_TOOL],
        tool_choice: { type: 'tool', name: TOOL_NAME },
        messages,
      }),
    });
  } catch (e) {
    throw new Error(
      `Network error calling ${ANTHROPIC_URL} — ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const body = (await res.json().catch(() => null)) as AnthropicResponse | null;
  if (!res.ok) {
    const detail = body?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 401) throw new Error(`Anthropic answered 401 — the API key was rejected. ${detail}`);
    if (res.status === 429) throw new Error(`Anthropic answered 429 — rate limited. ${detail}`);
    throw new Error(`Anthropic answered ${res.status} (${body?.error?.type ?? 'error'}): ${detail}`);
  }
  if (!body || !Array.isArray(body.content)) {
    throw new Error('Anthropic answered 200 but the body is not a message — nothing to propose from.');
  }
  const toolUse = body.content.find(
    (b): b is Record<string, unknown> & ToolUseBlock => b.type === 'tool_use' && b.name === TOOL_NAME,
  );
  if (!toolUse) {
    throw new Error(
      `The response carries no ${TOOL_NAME} tool call (stop_reason: ${body.stop_reason ?? 'unknown'}) — nothing to propose from.`,
    );
  }
  return { toolUse, usage: body.usage, assistantContent: body.content };
}

const addUsage = (
  acc: PromptSession['usage'],
  usage: AnthropicResponse['usage'],
): PromptSession['usage'] => ({
  inputTokens:
    typeof usage?.input_tokens === 'number' ? (acc.inputTokens ?? 0) + usage.input_tokens : acc.inputTokens,
  outputTokens:
    typeof usage?.output_tokens === 'number' ? (acc.outputTokens ?? 0) + usage.output_tokens : acc.outputTokens,
});

/** First generation: prompt → contract candidate + a session for fix rounds. */
export async function generateFromPrompt(
  prompt: string,
  apiKey: string,
  opts: { fetchImpl?: FetchLike } = {},
): Promise<PromptResult> {
  const messages: unknown[] = [{ role: 'user', content: prompt }];
  const { toolUse, usage, assistantContent } = await callClaude(messages, apiKey, opts.fetchImpl ?? fetch);
  return {
    contract: toolUse.input,
    session: {
      messages: [...messages, { role: 'assistant', content: assistantContent }],
      lastToolUseId: toolUse.id,
      rounds: 0,
      usage: addUsage({ inputTokens: null, outputTokens: null }, usage),
    },
  };
}

/** A fix round: the NAMED refusals go back as an is_error tool_result. Never
 *  called silently — the UI shows the refusals and the user clicks. */
export async function requestFix(
  session: PromptSession,
  refusals: string[],
  apiKey: string,
  opts: { fetchImpl?: FetchLike } = {},
): Promise<PromptResult> {
  if (session.rounds >= MAX_FIX_ROUNDS) {
    throw new Error(`Fix round limit reached (${MAX_FIX_ROUNDS}) — edit the contract by hand instead.`);
  }
  const messages = [
    ...session.messages,
    {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: session.lastToolUseId,
          is_error: true,
          content:
            'The proposed contract was REFUSED by the schema/generator. Named violations:\n' +
            refusals.map((r) => `- ${r}`).join('\n') +
            `\nCall ${TOOL_NAME} again with a corrected contract. Fix only what the violations name.`,
        },
      ],
    },
  ];
  const { toolUse, usage, assistantContent } = await callClaude(messages, apiKey, opts.fetchImpl ?? fetch);
  return {
    contract: toolUse.input,
    session: {
      messages: [...messages, { role: 'assistant', content: assistantContent }],
      lastToolUseId: toolUse.id,
      rounds: session.rounds + 1,
      usage: addUsage(session.usage, usage),
    },
  };
}
