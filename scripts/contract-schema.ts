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

const EnumTypeSchema = z.strictObject({
  enum: z.array(z.string()).min(1),
});

export const PropSchema = z.strictObject({
  name: z.string(),
  description: z.string().optional(),
  /** "boolean" | "text" | "number" | { enum: [...] } */
  type: z.union([z.literal('boolean'), z.literal('text'), z.literal('number'), EnumTypeSchema]),
  default: z.union([z.string(), z.boolean(), z.number()]).optional(),
  /** Text props may be required (no default in the code signature). */
  required: z.boolean().optional(),
  /** How this prop manifests on each side. Neither side is primary;
   *  the contract owns the canonical name and value set. */
  bindings: z.strictObject({
    figma: z.strictObject({
      kind: z.enum(['VARIANT', 'BOOLEAN', 'TEXT', 'INSTANCE_SWAP']),
      property: z.string(),
      /** canonical value → Figma variant value, e.g. { "primary": "Primary" } */
      values: z.record(z.string(), z.string()).optional(),
    }),
    code: z.strictObject({
      prop: z.string(),
    }),
  }),
});

export const LayoutSchema = z.strictObject({
  display: z.enum(['flex', 'inline-flex']).optional(),
  direction: z.enum(['row', 'column']).optional(),
  align: z.enum(['start', 'center', 'end', 'stretch']).optional(),
  justify: z.enum(['start', 'center', 'end', 'space-between']).optional(),
  /** Part takes remaining space (code: flex 1 1 auto; Figma: fill container). */
  grow: z.boolean().optional(),
  /** Children overlap (AvatarGroup): the gap token is applied as a NEGATIVE
   *  child margin in CSS and as negative itemSpacing on the canvas. */
  overlap: z.boolean().optional(),
});

/** v7: per-enum-value layout overrides (chat sender flip, toolbar density).
 *  A subset of LayoutSchema — plus REVERSED directions, which only make
 *  sense as variant overrides: code emits flex-direction rules under the
 *  enum class; the canvas (which has no reverse) reverses the compiled
 *  child order per variant instead. grow/overlap stay per-part invariants. */
export const VariantLayoutSchema = z.strictObject({
  display: z.enum(['flex', 'inline-flex']).optional(),
  direction: z.enum(['row', 'column', 'row-reverse', 'column-reverse']).optional(),
  align: z.enum(['start', 'center', 'end', 'stretch']).optional(),
  justify: z.enum(['start', 'center', 'end', 'space-between']).optional(),
});

/** v7: layout driven by an enum prop. `map` values are OVERRIDES merged over
 *  the part's base `layout` — partial coverage is the point (only the
 *  values that deviate appear). Code: descendant rules under the root's
 *  enum class (`.sender-user .body { … }`); canvas: resolved per variant at
 *  compile time (the subst machinery already compiles each combo). */
export const LayoutByPropSchema = z.strictObject({
  prop: z.string(),
  map: z.record(z.string(), VariantLayoutSchema),
});

/** Conditional part visibility (schema v4, gap G1): the part renders only
 *  when the prop matches. Boolean props map to Figma visibility bindings;
 *  enum conditions resolve per variant. */
export const VisibleWhenSchema = z.strictObject({
  prop: z.string(),
  /** Omit for boolean props (truthy). */
  equals: z.string().optional(),
});

/** Design-time default content for a slot (Curtis's fifth slot property).
 *  Renders as instances inside the slot in Figma and as the sample in code
 *  stories — never baked into the generated component itself. */
export const SlotContentItemSchema = z.strictObject({
  id: z.string(),
  props: z.record(z.string(), z.union([z.string(), z.boolean()])).optional(),
  text: z.string().optional(),
});

/** A constrained insertion point — Nathan Curtis's slot model, aligned with
 *  Figma's two-tier constraint design (preferredValues = prefer;
 *  allowPreferredValuesOnly = restrict). */
export const SlotSchema = z.strictObject({
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
export const ComponentRefSchema = z.strictObject({
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
  /** v7: per-enum-value layout overrides merged over `layout`. */
  layoutByProp?: z.infer<typeof LayoutByPropSchema>;
  /** CSS property → token reference. The CSS Module AND the Figma bindings
   *  are generated from these — there is no handwritten style layer. */
  tokens?: Record<string, string>;
  /** interaction state → (CSS property → token reference). Root-level only
   *  in the current generators. */
  states?: Record<string, Record<string, string>>;
  /** Text content bound to a text prop: { prop: "title" }. */
  content?: { prop: string };
  /** Static literal text (a page number, an ellipsis) — same on both
   *  surfaces, not bound to any prop. */
  text?: string;
  /** Progress fill: width = (valueProp / maxProp) as a percentage of the
   *  parent track. Code computes live; the canvas renders the defaults'
   *  fraction (its honest static state). */
  meter?: { valueProp: string; maxProp: string };
  /** CSS-side motion (spin for spinners, pulse for skeletons). Not
   *  representable on the canvas — documented fidelity scope. */
  animation?: 'spin' | 'pulse';
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
  z.strictObject({
    description: z.string().optional(),
    element: z.string().optional(),
    layout: LayoutSchema.optional(),
    /** v7. */
    layoutByProp: LayoutByPropSchema.optional(),
    tokens: z.record(z.string(), TokenRefSchema).optional(),
    states: z.record(z.string(), z.record(z.string(), TokenRefSchema)).optional(),
    content: z.strictObject({ prop: z.string() }).optional(),
    text: z.string().optional(),
    meter: z.strictObject({ valueProp: z.string(), maxProp: z.string() }).optional(),
    animation: z.enum(['spin', 'pulse']).optional(),
    slot: SlotSchema.optional(),
    component: ComponentRefSchema.optional(),
    /** Icon part (v4, gap G6): renders assets/icons/<asset>.svg inline on the
     *  code side and as a vector in Figma. '{prop}' substitutes an enum prop
     *  (icon-by-status). Icons are always decorative (aria-hidden). */
    icon: z.strictObject({ asset: z.string(), size: z.number().optional() }).optional(),
    /** v4, gap G2: HTML/ARIA attributes on this part's element — literal
     *  strings or '{prop}' references. Code-side surface; Figma ignores. */
    attrs: z.record(z.string(), z.string()).optional(),
    /** v4, gap G1. */
    visibleWhen: VisibleWhenSchema.optional(),
    optional: z.boolean().optional(),
    parts: z.record(z.string(), PartSchema).optional(),
  }),
);

/** v6: the interaction SURFACE, declared — never the implementation.
 *  An event is a code-side callback (`bindings.code.prop`, e.g. `onToggle`)
 *  fired when the `trigger` part is activated. When `toggles` is present the
 *  generator also emits the whole toggle mechanically: an uncontrolled
 *  fallback (useState) so the component is interactive out of the box, the
 *  flip between exactly two values of an enum prop, and the matching ARIA
 *  state attribute on the trigger. Values of the toggled enum OUTSIDE the
 *  pair map to aria-*="mixed" (e.g. Checkbox `indeterminate`).
 *  The canvas cannot run behavior, so the design surface reflects events as
 *  component-description text only — a declared fidelity limit, like
 *  animation. Complex behavior (drag, typeahead, focus trapping) stays a
 *  hand-written layer; contracts refuse to pretend otherwise. */
export const EventSchema = z.strictObject({
  name: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
  description: z.string().optional(),
  bindings: z.strictObject({
    code: z.strictObject({ prop: z.string().regex(/^on[A-Z][a-zA-Z0-9]*$/) }),
  }),
  /** Anatomy part (by name) whose activation fires the event; 'root' allowed. */
  trigger: z.string(),
  toggles: z
    .object({
      prop: z.string(),
      /** [offValue, onValue] — activation flips to the other member; any
       *  non-member value flips to onValue (indeterminate → checked). */
      between: z.tuple([z.string(), z.string()]),
      aria: z.enum(['expanded', 'checked', 'pressed', 'selected']).optional(),
    })
    .optional(),
});

export const ContractSchema = z.strictObject({
  $schema: z.string().optional(),
  /** Stable canonical id, never renamed. e.g. "ds.button". The namespace
   *  before the dot is the owning system's — brownfield extractions use
   *  their own (e.g. "acme.chip"); full package-qualified namespacing is a
   *  Phase 3 spec item. */
  id: z.string().regex(/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/),
  /** Display / export name. e.g. "Button" */
  name: z.string(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'version must be semver (MAJOR.MINOR.PATCH)'),
  status: z.enum(['draft', 'stable', 'deprecated']).default('draft'),
  description: z.string(),
  semantics: z.strictObject({
    element: z.enum([
      'button', 'span', 'div', 'a', 'input', 'article', 'section', 'header', 'footer',
      'label', 'nav', 'hr', 'ul', 'li', 'p', 'textarea', 'select', 'fieldset',
      'blockquote', 'code', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    ]),
    role: z.string().optional(),
    /** v4, gap G7: ARIA role driven by an enum prop (e.g. Banner: error →
     *  alert, info → status). Code emits a lookup; overrides `role`. */
    roleByProp: z
      .object({ prop: z.string(), map: z.record(z.string(), z.string()) })
      .optional(),
    /** v7: HTML element driven by an enum prop (Heading: level "2" → h2).
     *  Mirrors roleByProp — code emits an ELEMENT_MAP lookup and renders a
     *  dynamic tag; `element` is the fallback. The canvas is unaffected
     *  (text nodes carry no element semantics). The map must cover every
     *  enum value and every mapped element must be in the code generator's
     *  element vocabulary — validated at generation time. */
    elementByProp: z
      .object({ prop: z.string(), map: z.record(z.string(), z.string()) })
      .optional(),
  }),
  props: z.array(PropSchema),
  events: z.array(EventSchema).optional(),
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
  anchors: z.strictObject({
    figma: z.strictObject({
      fileKey: z.string().nullable(),
      componentSetKey: z.string().nullable(),
      nodeId: z.string().nullable().optional(),
    }),
    code: z.strictObject({
      importPath: z.string(),
      export: z.string(),
    }),
  }),
});

export type Contract = z.infer<typeof ContractSchema>;
export type Prop = z.infer<typeof PropSchema>;
export type ContractEvent = z.infer<typeof EventSchema>;
export type Slot = z.infer<typeof SlotSchema>;
export type ComponentRef = z.infer<typeof ComponentRefSchema>;
export type Layout = z.infer<typeof LayoutSchema>;
export type VariantLayout = z.infer<typeof VariantLayoutSchema>;

/** The layout a part has under one concrete variant combo: layoutByProp
 *  override (if the combo's value has one) merged over the base layout.
 *  With an empty subst (code side / no enum context) the base layout wins. */
export interface ResolvedLayout {
  display?: 'flex' | 'inline-flex';
  direction?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'space-between';
  grow?: boolean;
  overlap?: boolean;
}

export function resolveLayout(
  part: Part,
  subst: Record<string, string>,
): ResolvedLayout | undefined {
  const base = part.layout as ResolvedLayout | undefined;
  const byProp = part.layoutByProp;
  const override = byProp ? byProp.map[subst[byProp.prop] ?? ''] : undefined;
  if (!override) return base;
  return { ...base, ...override };
}

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
        const dep = byId.get(acceptedId);
        if (!dep) {
          throw new Error(`${c.id}: slot "${slot.name}" accepts unknown contract "${acceptedId}"`);
        }
        // accepts is a BUILD-ORDER dependency: the canvas slot's preferred
        // values resolve through the accepted component's key, so it must
        // exist first. (Found by the 2026-07-06 fresh-file rebuild — masked
        // in the original file where every component already existed.)
        visit(dep, [...chain, c.id]);
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
