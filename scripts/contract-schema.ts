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

/** v7: a structured/array prop — a list of records with scalar fields
 *  (Breadcrumbs items, Select options). CODE-ONLY by declared fidelity
 *  limit: the canvas has no list-of-records property type, so the figma
 *  binding kind is 'NONE' and every design-side consumer skips the prop.
 *  Code renders `Array<{ field: type; … }>` with no default (an optional
 *  array — undefined means "not provided", never a silent []). */
const ArrayTypeSchema = z.strictObject({
  arrayOf: z.record(z.string(), z.enum(['text', 'number', 'boolean'])),
});

export const PropSchema = z
  .strictObject({
    name: z.string(),
    description: z.string().optional(),
    /** "boolean" | "text" | "number" | { enum: [...] } | { arrayOf: {...} } */
    type: z.union([
      z.literal('boolean'),
      z.literal('text'),
      z.literal('number'),
      EnumTypeSchema,
      ArrayTypeSchema,
    ]),
    default: z.union([z.string(), z.boolean(), z.number()]).optional(),
    /** Text props may be required (no default in the code signature). */
    required: z.boolean().optional(),
    /** How this prop manifests on each side. Neither side is primary;
     *  the contract owns the canonical name and value set. */
    bindings: z.strictObject({
      figma: z.strictObject({
        /** 'NONE' (v7): the prop has no canvas manifestation — a declared
         *  fidelity limit; only legal (and required) for arrayOf props. */
        kind: z.enum(['VARIANT', 'BOOLEAN', 'TEXT', 'INSTANCE_SWAP', 'NONE']),
        /** Required unless kind is 'NONE' (enforced below). */
        property: z.string().optional(),
        /** canonical value → Figma variant value, e.g. { "primary": "Primary" } */
        values: z.record(z.string(), z.string()).optional(),
      }),
      code: z.strictObject({
        prop: z.string(),
      }),
    }),
  })
  .refine((p) => p.bindings.figma.kind === 'NONE' || typeof p.bindings.figma.property === 'string', {
    message: 'bindings.figma.property is required unless kind is "NONE"',
    path: ['bindings', 'figma', 'property'],
  })
  .refine((p) => p.bindings.figma.kind !== 'NONE' || p.bindings.figma.property === undefined, {
    message: 'kind "NONE" declares no canvas property — omit bindings.figma.property',
    path: ['bindings', 'figma', 'property'],
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

/** v10: token bindings driven by an enum prop — the VALUE-level sibling of
 *  the substituted ref (owner field case: CBDS Button-Brand Primary, whose
 *  root paddingLeft/paddingRight bind {spacing.200} on large/medium and
 *  {spacing.150} on small, and whose height binds {component-size.xlarge|
 *  large|medium} per size). A substituted ref ({spacing.{size}}) can only
 *  carry bindings whose token NAMES spell the axis value; real foreign
 *  vocabularies name tokens by scale step, so a binding that is a plain
 *  FUNCTION of one enum axis needs a per-value map. `map` values are
 *  OVERRIDES merged over the part's base `tokens` (layoutByProp semantics:
 *  only the values that deviate appear; refs are plain — no placeholders).
 *  Code: enum-modifier rules on the root / descendant rules on nested parts
 *  (exactly the substituted-ref rule shapes); canvas + inline emitters:
 *  resolved per compiled variant via resolveTokens below. */
export const TokensByPropSchema = z.strictObject({
  prop: z.string(),
  map: z.record(z.string(), z.record(z.string(), TokenRefSchema)),
});

/** v7 stylesWhen: the tight whitelist of literal CSS properties a
 *  conditional style may set. Deliberately NOT tokens — these are
 *  behavioral/positional properties with no token vocabulary (a color or a
 *  dimension belongs in `tokens`, and the generator refuses it here). */
export const STYLES_WHEN_ALLOWED = new Set([
  'position', 'top', 'right', 'bottom', 'left', 'z-index',
  'overflow', 'text-overflow', 'white-space', 'display', 'opacity',
  'pointer-events', 'transform', 'transition', 'flex-direction',
  'justify-content', 'align-items', 'cursor', 'text-decoration',
]);

/** v7: conditional literal styles — CSS applied only when the prop matches.
 *  Code: boolean conditions ride the existing per-boolean data attribute
 *  (`.root[data-x] .part`), enum conditions the root enum class
 *  (`.prop-value .part`). Canvas v1: not represented — a documented
 *  fidelity limit (boolean props cannot restyle canvas nodes; only
 *  visibility is bindable). */
export const StylesWhenSchema = z.strictObject({
  prop: z.string(),
  /** Required for enum props; omit for booleans (truthy). */
  equals: z.string().optional(),
  /** CSS property → literal value. Keys must be in STYLES_WHEN_ALLOWED. */
  styles: z.record(z.string(), z.string()),
});

/** v7 overlay: the part renders OUT of flow, attached to one edge of the
 *  root (Tooltip bubble, Combobox popup). Code: position:absolute with
 *  placement-derived insets, root becomes position:relative. Canvas:
 *  layoutPositioning ABSOLUTE with placement-derived constraints. Four
 *  placements in v1; offset/alignment tuning is a later axis. */
export const OverlaySchema = z.strictObject({
  placement: z.enum(['top', 'bottom', 'start', 'end']),
});

/** v9 shape: a LEAF decor part that is a parametric vector, not a box —
 *  the projection of dump v1.3 geometry capture (#42; field case: the CBDS
 *  Tooltip pointer triangle). Bounded by construction: exactly three kinds
 *  (polygon by side count / ellipse / rect), an explicit intrinsic size, and
 *  a CSS-clockwise rotation. Everything else about a shape rides existing
 *  channels: fill via `tokens.background-color`, per-variant placement via
 *  `stylesWhen` (position/top/right/bottom/left/transform are already in the
 *  literal whitelist), visibility via `visibleWhen`.
 *  Projections: code surfaces render width/height + clip-path polygon (or
 *  border-radius 50%) + transform rotate — see shapeCssDecls below, the ONE
 *  shared implementation; the Figma generator constructs a REAL
 *  RegularPolygon/Ellipse/Rectangle node with native rotation. Refusal
 *  rules (emit-react validateContract): a shape part must be a leaf (no
 *  parts/slot/component/content/text/icon/meter), sides only on polygons. */
export const ShapeSchema = z.strictObject({
  kind: z.enum(['polygon', 'ellipse', 'rect']),
  /** Polygon point count, ≥3. Figma's REGULAR_POLYGON default is 3. */
  sides: z.number().int().min(3).optional(),
  /** Intrinsic (pre-rotation) size, px. */
  width: z.number().positive(),
  height: z.number().positive(),
  /** CSS-clockwise degrees (`transform: rotate(<n>deg)`). Omit for 0. */
  rotation: z.number().optional(),
});

/** Vertex list for a regular n-gon inscribed in its box, as CSS clip-path
 *  percentages — vertex 0 at the top center, matching Figma's
 *  REGULAR_POLYGON (a triangle's apex points up at rotation 0). */
export function polygonClipPath(sides: number): string {
  const pts: string[] = [];
  const fmt = (n: number) => `${Math.round(n * 10000) / 10000}%`;
  for (let k = 0; k < sides; k++) {
    const a = ((-90 + (k * 360) / sides) * Math.PI) / 180;
    pts.push(`${fmt(50 + 50 * Math.cos(a))} ${fmt(50 + 50 * Math.sin(a))}`);
  }
  return `polygon(${pts.join(', ')})`;
}

/** The shape's CSS declarations — shared by every code-side surface
 *  (emit-react, emit-html, emit-react-inline, the playground canvas
 *  preview) so the projection cannot fork. A polygon with no captured side
 *  count renders the Figma default (3) — the proposer NAMES that assumption
 *  in its notes. */
export function shapeCssDecls(shape: z.infer<typeof ShapeSchema>): string[] {
  const d = [`width: ${shape.width}px`, `height: ${shape.height}px`, 'flex-shrink: 0'];
  if (shape.kind === 'polygon') d.push(`clip-path: ${polygonClipPath(shape.sides ?? 3)}`);
  if (shape.kind === 'ellipse') d.push('border-radius: 50%');
  if (shape.rotation !== undefined && shape.rotation !== 0) d.push(`transform: rotate(${shape.rotation}deg)`);
  return d;
}

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
  /** v11: DECLARED exception to the native-semantics lint — a one-sentence
   *  reason why this part claims an ARIA role (via attrs.role) that has a
   *  native HTML equivalent, on a non-native element. Legitimate APG
   *  composites declare it; everything else refuses by name. The sentence
   *  renders on the spec sheet so the exception is reviewable, never silent. */
  roleException?: string;
  layout?: z.infer<typeof LayoutSchema>;
  /** v7: per-enum-value layout overrides merged over `layout`. */
  layoutByProp?: z.infer<typeof LayoutByPropSchema>;
  /** v7: conditional literal styles (code-side; canvas fidelity limit). */
  stylesWhen?: Array<z.infer<typeof StylesWhenSchema>>;
  /** v7: out-of-flow edge attachment (tooltip/popup anatomy). */
  overlay?: z.infer<typeof OverlaySchema>;
  /** v9: parametric leaf decor (triangle/ellipse/rotated rect — #42). */
  shape?: z.infer<typeof ShapeSchema>;
  /** CSS property → token reference. The CSS Module AND the Figma bindings
   *  are generated from these — there is no handwritten style layer. */
  tokens?: Record<string, string>;
  /** v10: per-enum-value token overrides merged over `tokens`. */
  tokensByProp?: z.infer<typeof TokensByPropSchema>;
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
    /** v11: named exception to the native-semantics lint (see Part). */
    roleException: z.string().optional(),
    layout: LayoutSchema.optional(),
    /** v7. */
    layoutByProp: LayoutByPropSchema.optional(),
    /** v7. */
    stylesWhen: z.array(StylesWhenSchema).optional(),
    /** v7. */
    overlay: OverlaySchema.optional(),
    /** v9. */
    shape: ShapeSchema.optional(),
    tokens: z.record(z.string(), TokenRefSchema).optional(),
    /** v10. */
    tokensByProp: TokensByPropSchema.optional(),
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
    /** v11: DECLARED exception to the native-semantics lint for ROOT-level
     *  role claims (semantics.role, semantics.roleByProp, anatomy.root
     *  attrs.role) — a one-sentence reason why the role rides a non-native
     *  element (e.g. ProgressBar: <progress> cannot host the styled
     *  track/fill anatomy). Renders on the spec sheet; reviewable, never
     *  silent. */
    roleException: z.string().optional(),
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
  states: z.array(z.enum(['hover', 'active', 'focus-visible', 'disabled'])).default([]),
  /** How this contract manifests in Figma. 'component' (default) generates a
   *  component (set). 'native' means the concept maps to a native canvas
   *  capability (e.g. layout primitives ARE auto-layout) — no Figma component
   *  is generated and parity does not expect one; the code surface is still
   *  fully generated and checked. */
  figmaRepresentation: z.enum(['component', 'native']).optional(),
  /** OPT-IN canvas-only interaction previews — the mirror image of code-only
   *  events. When true, the FIGMA generator emits an additional "State"
   *  variant axis (State=Default, State=Hover, …) where each non-default
   *  state applies the contract's root state token overrides on top of the
   *  variant's base bindings. The code surface is COMPLETELY unaffected (CSS
   *  pseudo-classes already render these states live). Bounded explosion:
   *  state previews multiply only the PRIMARY enum axis — the one whose
   *  tokens the state overrides substitute — never the full cartesian; all
   *  other axes sit at their defaults in preview variants. Requires declared
   *  `states`, each with root token overrides (refused by name otherwise). */
  figmaStatePreviews: z.boolean().optional(),
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

/** The token record a part carries under one concrete variant combo:
 *  tokensByProp override (if the combo's value has one) merged over the base
 *  `tokens` (v10 — the resolveLayout shape). With an empty subst (no enum
 *  context) the base tokens win. The ONE shared resolver for every surface
 *  that compiles per variant (figma script, inline emitter, canvas preview);
 *  the static CSS emitters render the map as enum-class/descendant rules
 *  instead. */
export function resolveTokens(part: Part, subst: Record<string, string>): Record<string, string> {
  const base = part.tokens ?? {};
  const byProp = part.tokensByProp;
  const override = byProp ? byProp.map[subst[byProp.prop] ?? ''] : undefined;
  if (!override) return base;
  return { ...base, ...override };
}

/** A native CHECKABLE control part — a real `<input type="checkbox|radio">`
 *  inside a presentational box (the wrapper-label + visually-managed-input
 *  pattern; the imported-button P0 applied to checkable controls: native
 *  elements over ARIA re-creation, always). ONE shared predicate so every
 *  surface agrees on the projection:
 *    · code surfaces (react / html / react-inline) render the input as the
 *      focusable, checkable control (checked/indeterminate are DOM state,
 *      never ARIA attributes) and visually manage it over its parent box;
 *    · the canvas surfaces (figma script, canvas preview) draw NOTHING for
 *      it — the box and glyphs are the visual; semantics don't draw. */
export function isNativeCheckablePart(part: Part): boolean {
  return (
    part.element === 'input' &&
    (part.attrs?.type === 'checkbox' || part.attrs?.type === 'radio')
  );
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

// ---------------------------------------------------------------------------
// State previews (figmaStatePreviews) — shared vocabulary for the Figma
// generator (which emits the axis) and the differ (which expects it when the
// contract opts in, and flags a hand-built one as kit-rot drift when it
// doesn't).
// ---------------------------------------------------------------------------

/** The reserved variant-axis property name for canvas state previews. */
export const STATE_PREVIEW_PROPERTY = 'State';
/** The axis value carried by every base (non-preview) variant. */
export const STATE_PREVIEW_DEFAULT = 'Default';
/** Canonical state → axis value: "hover" → "Hover", "focus-visible" →
 *  "Focus Visible". Deterministic — the differ recomputes the same labels. */
export const statePreviewLabel = (state: string) => state.split('-').map(pascal).join(' ');

/** The prop names an opted-in contract's root state overrides substitute
 *  (e.g. "{color.action.{variant}.background-hover}" → "variant"). The
 *  single member (validation refuses more) names the PRIMARY enum axis that
 *  state previews multiply; empty means the overrides are variant-independent
 *  and previews attach to the first enum axis. */
export function statePreviewSubstProps(contract: Contract): string[] {
  const enumNames = new Set(
    contract.props
      .filter((p) => typeof p.type === 'object' && 'enum' in p.type)
      .map((p) => p.name),
  );
  const out = new Set<string>();
  const overrides = contract.anatomy.root?.states ?? {};
  for (const state of contract.states) {
    for (const ref of Object.values(overrides[state] ?? {})) {
      for (const m of ref.matchAll(/\{([a-z][\w-]*)\}/g)) {
        if (enumNames.has(m[1])) out.add(m[1]);
      }
    }
  }
  return [...out];
}

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
