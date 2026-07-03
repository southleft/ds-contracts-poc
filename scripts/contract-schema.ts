/**
 * The contract schema — the shape of the single source of truth.
 *
 * Defined in Zod so the generator gets runtime validation + inferred TS types,
 * and a JSON Schema can be emitted for editor tooling and non-TS consumers
 * (see scripts/emit-schema.ts → contracts/contract.schema.json).
 *
 * Design lineage (deliberate borrowing, not invention):
 *   - member model shape: Custom Elements Manifest (props/slots/parts)
 *   - prop/value binding grammar: Figma Code Connect
 *   - dual-anchor identity: DTCG $extensions pattern (rename-safe IDs per side)
 */
import * as z from 'zod';

/** A DTCG token reference, optionally containing `{propName}` substitution
 *  placeholders that expand over an enum prop's values.
 *  e.g. "{color.action.{variant}.background}" */
export const TokenRefSchema = z
  .string()
  .regex(
    /^\{[a-z0-9.{}-]+\}$/i,
    'Token reference must be brace-wrapped, e.g. "{color.action.primary.background}"',
  );

const EnumTypeSchema = z.object({
  enum: z.array(z.string()).min(1),
});

export const PropSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  /** "boolean" | "text" | { enum: [...] } */
  type: z.union([z.literal('boolean'), z.literal('text'), EnumTypeSchema]),
  default: z.union([z.string(), z.boolean()]).optional(),
  /** How this prop manifests on each side. Neither side is primary;
   *  the contract owns the canonical name and value set. */
  bindings: z.object({
    figma: z.object({
      kind: z.enum(['VARIANT', 'BOOLEAN', 'TEXT', 'INSTANCE_SWAP']),
      property: z.string(),
      /** canonical value → Figma variant value, e.g. { "primary": "Primary" } */
      values: z.record(z.string(), z.string()).optional(),
    }),
    code: z.object({
      prop: z.string(),
    }),
  }),
});

export const PartSchema = z.object({
  description: z.string().optional(),
  /** Accepts arbitrary children (maps to a Figma INSTANCE_SWAP / code ReactNode). */
  slot: z.boolean().optional(),
  optional: z.boolean().optional(),
  /** CSS property → token reference. This is where style decisions live —
   *  the CSS Module is GENERATED from these bindings, never handwritten. */
  tokens: z.record(z.string(), TokenRefSchema).optional(),
  /** interaction state → (CSS property → token reference) overrides */
  states: z.record(z.string(), z.record(z.string(), TokenRefSchema)).optional(),
});

export const ContractSchema = z.object({
  $schema: z.string().optional(),
  /** Stable canonical id, never renamed. e.g. "ds.button" */
  id: z.string().regex(/^ds\.[a-z][a-z0-9-]*$/),
  /** Display / export name. e.g. "Button" */
  name: z.string(),
  version: z.string(),
  status: z.enum(['draft', 'stable', 'deprecated']).default('draft'),
  description: z.string(),
  semantics: z.object({
    element: z.enum(['button', 'span', 'div', 'a', 'input']),
    role: z.string().optional(),
  }),
  props: z.array(PropSchema),
  states: z.array(z.enum(['hover', 'focus-visible', 'disabled'])).default([]),
  anatomy: z.record(z.string(), PartSchema),
  a11y: z
    .object({
      focusVisible: z.boolean().optional(),
      minHitArea: z.number().optional(),
      contrast: z.enum(['AA', 'AAA']).optional(),
    })
    .optional(),
  /** Per-side identity anchors. Written back after first generation on each
   *  side so renames on either side never fork identity. */
  anchors: z.object({
    figma: z.object({
      fileKey: z.string().nullable(),
      componentSetKey: z.string().nullable(),
      nodeId: z.string().nullable().optional(),
    }),
    code: z.object({
      importPath: z.string(),
      export: z.string(),
    }),
  }),
});

export type Contract = z.infer<typeof ContractSchema>;
export type Prop = z.infer<typeof PropSchema>;
export type Part = z.infer<typeof PartSchema>;
