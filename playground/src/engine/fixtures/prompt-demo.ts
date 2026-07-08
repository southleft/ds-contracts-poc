/**
 * Recorded-shape Anthropic responses for the Describe tab's demo mode.
 *
 * Served through the injectable transport so the code path from prompt to
 * proposal is byte-for-byte the live path — only fetch is swapped (the same
 * discipline as the Figma demo fixture). Two rounds by design:
 *   round 1 — a plausible model mistake: an INVENTED token path
 *             ("{radius.tag}") that the generator refuses by name,
 *   round 2 — the corrected contract, valid against the repo tokens.
 * That sequencing makes the whole governed loop demoable without a key:
 * generate → named refusal → "Ask the model to fix" → valid contract.
 */
import type { FetchLike } from '../prompt-import.js';

export const DEMO_PROMPT =
  'A small pill-shaped tag that labels content with a feedback tone: info, success, warning, or danger.';

const tagContract = (borderRadius: string) => ({
  id: 'ds.tag',
  name: 'Tag',
  version: '0.1.0',
  status: 'draft',
  description: 'A small pill-shaped label communicating a feedback tone at a glance. Non-interactive.',
  semantics: { element: 'span', role: 'status' },
  props: [
    {
      name: 'tone',
      description: 'The feedback tone being communicated.',
      type: { enum: ['info', 'success', 'warning', 'danger'] },
      default: 'info',
      bindings: {
        figma: {
          kind: 'VARIANT',
          property: 'Tone',
          values: { info: 'Info', success: 'Success', warning: 'Warning', danger: 'Danger' },
        },
        code: { prop: 'tone' },
      },
    },
    {
      name: 'children',
      description: 'Tag label.',
      type: 'text',
      default: 'Tag',
      bindings: {
        figma: { kind: 'TEXT', property: 'Label' },
        code: { prop: 'children' },
      },
    },
  ],
  states: [],
  anatomy: {
    root: {
      tokens: {
        'background-color': '{color.feedback.{tone}.background}',
        color: '{color.feedback.{tone}.foreground}',
        'padding-inline': '{space.inset-x.sm}',
        'padding-block': '{space.inset-y.sm}',
        'border-radius': borderRadius,
        'font-family': '{font.control.family}',
        'font-weight': '{font.control.weight}',
        'font-size': '{font.badge.size}',
      },
    },
  },
  a11y: { contrast: 'AA' },
  anchors: {
    figma: { fileKey: null, componentSetKey: null, nodeId: null },
    code: { importPath: '@ds/components', export: 'Tag' },
  },
});

/** Full messages-API response shape, as the live endpoint answers it. */
const message = (id: string, toolUseId: string, input: unknown, usage: { input_tokens: number; output_tokens: number }) => ({
  id,
  type: 'message',
  role: 'assistant',
  model: 'claude-sonnet-5',
  content: [{ type: 'tool_use', id: toolUseId, name: 'propose_contract', input }],
  stop_reason: 'tool_use',
  stop_sequence: null,
  usage,
});

const ROUNDS = [
  // Round 1: the model invents "{radius.tag}" — not in any inventory.
  message('msg_demo_round1', 'toolu_demo_round1', tagContract('{radius.tag}'), {
    input_tokens: 3187,
    output_tokens: 486,
  }),
  // Round 2: corrected to the real pill radius after the refusal came back.
  message('msg_demo_round2', 'toolu_demo_round2', tagContract('{radius.pill}'), {
    input_tokens: 3811,
    output_tokens: 489,
  }),
];

/** A fetch-shaped transport that answers with the recorded rounds in order. */
export function createDemoTransport(): FetchLike {
  let call = 0;
  return (() => {
    const body = ROUNDS[Math.min(call, ROUNDS.length - 1)];
    call += 1;
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    } as Response);
  }) as FetchLike;
}
