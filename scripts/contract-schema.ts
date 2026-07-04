/**
 * The contract schema — the shape of the single source of truth. (v2)
 *
 * Defined in Zod so the generator gets runtime validation + inferred TS types,
 * and a JSON Schema can be emitted for editor tooling and non-TS consumers
 * (see scripts/emit-schema.ts → contracts/contract.schema.json).
 *
 * Design lineage (deliberate borrowing, not invention):
 *   - member model shape: Custom Elements Manifest (props/slots/parts)
 *   - prop/value binding grammar: Figma Code Connect
 *   - dual-anchor identity: DTCG $extensions pattern (rename-safe IDs per side)
 *
 * v2 adds COMPOSITION — the three concrete decisions:
 *   1. Anatomy is a NESTED TREE (parts contain parts). Contracts are authored
 *      and reviewed by humans; a tree reads like the component. (Streaming
 *      payload formats like A2UI flatten to adjacency lists — that is a
 *      transport concern; a contract is a source document.)
 *   2. SLOTS are constrained insertion points: `accepts` lists contract IDs.
 *      Each surface resolves those IDs through the referenced contracts'
 *      anchors (code importPath / Figma componentSetKey → INSTANCE_SWAP
 *      preferredValues). CEM declares slots but cannot constrain them; the
 *      constraint is what makes generation and parity checkable.
 *   3. NESTED COMPONENT REFS point at other contracts by ID with fixed prop
 *      values (spelled in canonical values; each surface maps them through
 *      the child contract's own bindings). Composition never duplicates a
 *      child's definition.
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
  /** Text props may be required (no default in the code signature). */
  required: z.boolean().optional(),
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

export const LayoutSchema = z.object({
  display: z.enum(['flex', 'inline-flex']).optional(),
  direction: z.enum(['row', 'column']).optional(),
  align: z.enum(['start', 'center', 'end', 'stretch']).optional(),
  justify: z.enum(['start', 'center', 'end', 'space-between']).optional(),
  /** Part takes remaining space (code: flex 1 1 auto; Figma: fill container). */
  grow: z.boolean().optional(),
});

/** Conditional part visibility (schema v4, gap G1): the part renders only
 *  when the prop matches. Boolean props map to Figma visibility bindings;
 *  enum conditions resolve per variant. */
export const VisibleWhenSchema = z.object({
  prop: z.string(),
  /** Omit for boolean props (truthy). */
  equals: z.string().optional(),
});

/** Design-time default content for a slot (Curtis's fifth slot property).
 *  Renders as instances inside the slot in Figma and as the sample in code
 *  stories — never baked into the generated component itself. */
export const SlotContentItemSchema = z.object({
  id: z.string(),
  props: z.record(z.string(), z.union([z.string(), z.boolean()])).optional(),
  text: z.string().optional(),
});

/** A constrained insertion point — Nathan Curtis's slot model, aligned with
 *  Figma's two-tier constraint design (preferredValues = prefer;
 *  allowPreferredValuesOnly = restrict). */
export const SlotSchema = z.object({
  /** "children" = the default slot (React children). Any other name becomes
   *  a ReactNode prop of that name. */
  name: z.string(),
  /** Contract IDs this slot accepts. Omit = unconstrained. Resolved
   *  per-surface via each referenced contract's anchors. */
  accepts: z.array(z.string()).optional(),
  /** prefer (default): accepts guides pickers/generators. restrict: only
   *  accepts is legal. open: explicitly anything (the Subframe escape hatch).
   *  Compatibility rule: widening is a minor version; narrowing is major. */
  acceptsMode: z.enum(['prefer', 'restrict', 'open']).optional(),
  /** Arity bounds (map to Figma SlotSettings min/maxChildren). */
  min: z.number().int().min(0).optional(),
  max: z.number().int().min(1).optional(),
  required: z.boolean().optional(),
  /** Figma property name. Default: PascalCase(name). */
  figmaProperty: z.string().optional(),
  /** Sample content (see SlotContentItemSchema). Items must be drawn from
   *  `accepts` when accepts is present. NOTE: a slot whose default content
   *  has MULTIPLE items is a multi-child slot — inexpressible as a Figma
   *  INSTANCE_SWAP; it renders its content directly (no swap property) until
   *  the native SLOT property migration. */
  defaultContent: z.array(SlotContentItemSchema).optional(),
});

/** A fixed instance of another contract, embedded in this component. */
export const ComponentRefSchema = z.object({
  /** The child contract's id, e.g. "ds.avatar". */
  id: z.string(),
  /** Fixed prop values, spelled canonically; mapped through the CHILD
   *  contract's bindings on each surface. A string value of the form
   *  "{parentProp}" maps the PARENT's enum prop into the child per variant
   *  (code: `childProp={parentProp}`; Figma: resolved per variant combo). */
  props: z.record(z.string(), z.union([z.string(), z.boolean()])).optional(),
  /** Overrides the child's `children` text prop (code: JSX children;
   *  Figma: TEXT property override on the instance). */
  text: z.string().optional(),
});

export interface Part {
  description?: string;
  /** HTML element for this part (code side). Defaults: div (structural),
   *  span (content). Root uses semantics.element. */
  element?: string;
  layout?: z.infer<typeof LayoutSchema>;
  /** CSS property → token reference. The CSS Module AND the Figma bindings
   *  are generated from these — there is no handwritten style layer. */
  tokens?: Record<string, string>;
  /** interaction state → (CSS property → token reference). Root-level only
   *  in the current generators. */
  states?: Record<string, Record<string, string>>;
  /** Text content bound to a text prop: { prop: "title" }. */
  content?: { prop: string };
  slot?: z.infer<typeof SlotSchema>;
  component?: z.infer<typeof ComponentRefSchema>;
  icon?: { asset: string; size?: number };
  attrs?: Record<string, string>;
  visibleWhen?: z.infer<typeof VisibleWhenSchema>;
  /** Optional parts render conditionally (code: when the slot prop is
   *  provided; Figma: a "Show X" BOOLEAN controls visibility). */
  optional?: boolean;
  parts?: Record<string, Part>;
}

export const PartSchema: z.ZodType<Part> = z.lazy(() =>
  z.object({
    description: z.string().optional(),
    element: z.string().optional(),
    layout: LayoutSchema.optional(),
    tokens: z.record(z.string(), TokenRefSchema).optional(),
    states: z.record(z.string(), z.record(z.string(), TokenRefSchema)).optional(),
    content: z.object({ prop: z.string() }).optional(),
    slot: SlotSchema.optional(),
    component: ComponentRefSchema.optional(),
    /** Icon part (v4, gap G6): renders assets/icons/<asset>.svg inline on the
     *  code side and as a vector in Figma. '{prop}' substitutes an enum prop
     *  (icon-by-status). Icons are always decorative (aria-hidden). */
    icon: z.object({ asset: z.string(), size: z.number().optional() }).optional(),
    /** v4, gap G2: HTML/ARIA attributes on this part's element — literal
     *  strings or '{prop}' references. Code-side surface; Figma ignores. */
    attrs: z.record(z.string(), z.string()).optional(),
    /** v4, gap G1. */
    visibleWhen: VisibleWhenSchema.optional(),
    optional: z.boolean().optional(),
    parts: z.record(z.string(), PartSchema).optional(),
  }),
);

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
    element: z.enum([
      'button', 'span', 'div', 'a', 'input', 'article', 'section', 'header', 'footer',
      'label', 'nav', 'hr', 'ul', 'li', 'p', 'textarea', 'select', 'fieldset',
      'blockquote', 'code', 'kbd',
    ]),
    role: z.string().optional(),
    /** v4, gap G7: ARIA role driven by an enum prop (e.g. Banner: error →
     *  alert, info → status). Code emits a lookup; overrides `role`. */
    roleByProp: z
      .object({ prop: z.string(), map: z.record(z.string(), z.string()) })
      .optional(),
  }),
  props: z.array(PropSchema),
  states: z.array(z.enum(['hover', 'focus-visible', 'disabled'])).default([]),
  /** How this contract manifests in Figma. 'component' (default) generates a
   *  component (set). 'native' means the concept maps to a native canvas
   *  capability (e.g. layout primitives ARE auto-layout) — no Figma component
   *  is generated and parity does not expect one; the code surface is still
   *  fully generated and checked. */
  figmaRepresentation: z.enum(['component', 'native']).optional(),
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
export type Slot = z.infer<typeof SlotSchema>;
export type ComponentRef = z.infer<typeof ComponentRefSchema>;
export type Layout = z.infer<typeof LayoutSchema>;

// ---------------------------------------------------------------------------
// Shared composition helpers (used by both generators and the differ)
// ---------------------------------------------------------------------------

export interface WalkedPart {
  name: string;
  part: Part;
  path: string[];
}

/** Depth-first walk over a contract's anatomy tree. */
export function walkAnatomy(contract: Contract): WalkedPart[] {
  const out: WalkedPart[] = [];
  const visit = (name: string, part: Part, path: string[]) => {
    out.push({ name, part, path });
    for (const [childName, child] of Object.entries(part.parts ?? {})) {
      visit(childName, child, [...path, childName]);
    }
  };
  for (const [name, part] of Object.entries(contract.anatomy)) visit(name, part, [name]);
  return out;
}

export const slotsOf = (contract: Contract) =>
  walkAnatomy(contract).filter((w) => w.part.slot).map((w) => ({ ...w, slot: w.part.slot! }));

export const componentRefsOf = (contract: Contract) =>
  walkAnatomy(contract)
    .filter((w) => w.part.component)
    .map((w) => ({ ...w, ref: w.part.component! }));

export const pascal = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const slotFigmaProperty = (slot: Slot) => slot.figmaProperty ?? pascal(slot.name);
export const slotVisibilityProperty = (slot: Slot) => `Show ${slotFigmaProperty(slot)}`;

/** Topologically sort contracts by composition dependencies; throws on
 *  cycles and unknown references — invalid states are refused, not rendered. */
export function sortByDependencies(contracts: Contract[]): Contract[] {
  const byId = new Map(contracts.map((c) => [c.id, c]));
  const sorted: Contract[] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (c: Contract, chain: string[]) => {
    if (state.get(c.id) === 'done') return;
    if (state.get(c.id) === 'visiting') {
      throw new Error(`Circular contract dependency: ${[...chain, c.id].join(' → ')}`);
    }
    state.set(c.id, 'visiting');
    for (const { ref } of componentRefsOf(c)) {
      const dep = byId.get(ref.id);
      if (!dep) throw new Error(`${c.id}: references unknown contract "${ref.id}"`);
      visit(dep, [...chain, c.id]);
    }
    for (const { slot } of slotsOf(c)) {
      for (const acceptedId of slot.accepts ?? []) {
        if (!byId.has(acceptedId)) {
          throw new Error(`${c.id}: slot "${slot.name}" accepts unknown contract "${acceptedId}"`);
        }
      }
      for (const item of slot.defaultContent ?? []) {
        const dep = byId.get(item.id);
        if (!dep) {
          throw new Error(`${c.id}: slot "${slot.name}" defaultContent references unknown contract "${item.id}"`);
        }
        if (slot.accepts && slot.accepts.length > 0 && !slot.accepts.includes(item.id)) {
          throw new Error(
            `${c.id}: slot "${slot.name}" defaultContent includes "${item.id}" which is not in accepts`,
          );
        }
        visit(dep, [...chain, c.id]);
      }
    }
    state.set(c.id, 'done');
    sorted.push(c);
  };
  for (const c of contracts) visit(c, []);
  return sorted;
}
