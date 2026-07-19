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
  /** v15 (S4/matrix a.8): flex-wrap: wrap — natively CARRY-BOTH (Figma
   *  layoutWrap: 'WRAP'). Chip rows and tag groups wrap in every target
   *  system; the counter-axis gap rides the same `gap` token (Figma
   *  counterAxisSpacing follows itemSpacing unless a row-gap fact lands). */
  wrap: z.boolean().optional(),
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

/** v14 (Polaris coverage round): a part may carry MULTIPLE tokensByProp
 *  entries — one per driving enum axis (Button: variant colors AND size
 *  paddings; Text: variant scale AND fontWeight map). The single-object
 *  spelling stays valid (every existing contract parses unchanged); an array
 *  is ordered: when two entries (necessarily on DIFFERENT props — see the
 *  refusal rule) override the same channel, the LATER entry wins, mirroring
 *  the CSS source-order cascade the values were extracted from. Refusal
 *  rules (validateContract): two entries may not share BOTH a prop and a
 *  channel — a conflicting channel+prop pair is refused by name. */
export const TokensByPropFieldSchema = z.union([
  TokensByPropSchema,
  z.array(TokensByPropSchema).min(1),
]);

/** v14: a literal styling value a contract may carry where the SOURCE style
 *  is a component-private literal (Polaris `--pc-*` pixel geometry), resolved
 *  deterministically through a var() chain — never invented, never minted
 *  into a token. Bounded grammar: px/rem/em/unitless numbers, hex and
 *  rgb()/rgba() colors, and the CSS keywords transparent/inherit/currentColor. */
export const LITERAL_VALUE_RE =
  /^(-?\d+(\.\d+)?(px|rem|em)?|transparent|inherit|currentColor|#[0-9a-fA-F]{3,8}|rgba?\([\d ,./%]+\))$/;
export const LiteralValueSchema = z
  .string()
  .regex(LITERAL_VALUE_RE, 'Literal value must be a px/rem/em/number, hex or rgb()/rgba() color, or transparent/inherit/currentColor');

/** v14: the channels a literal may ride — geometry and paint channels where
 *  foreign systems keep component-private literals. Everything else refuses
 *  by name (validateContract). */
export const LITERAL_CHANNELS = new Set([
  'background', 'background-color', 'color',
  'height', 'width', 'min-width', 'min-height',
  'padding-block', 'padding-inline', 'gap', 'border-radius', 'border-width',
  'font-size', 'line-height', 'letter-spacing',
  // v15 (S4/matrix a.4–a.5): per-corner radii and per-side border widths are
  // natively CARRY-BOTH (each corner/side field is independently
  // variable-bindable) — the literal grammar carries them like their
  // uniform shorthands.
  'border-top-left-radius', 'border-top-right-radius',
  'border-bottom-left-radius', 'border-bottom-right-radius',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  // Round 4: padding longhands — the base-plane literal fallback carries the
  // base combo's captured paddings when per-plane values refuse correlation
  // (Tag's remove-×/link planes shift them; the base plane is exact).
  'padding-left', 'padding-right', 'padding-top', 'padding-bottom',
]);

/** v14: per-enum-value literal overrides — the literals sibling of
 *  TokensByProp (ProgressBar's per-size `--pc-*` pixel heights, Avatar's
 *  per-size widths). Array-ordered exactly like tokensByProp entries. */
export const LiteralsByPropSchema = z.strictObject({
  prop: z.string(),
  map: z.record(z.string(), z.record(z.string(), LiteralValueSchema)),
});

/** v15 (S4 channel lifts — round 1 of the north-star push): a DECLARED FACT
 *  is a keyword/literal styling channel observed as computed truth that has
 *  no token vocabulary (cursor, user-select, text-rendering,
 *  font-feature-settings, …). Declared facts are FIRST-CLASS carried facts:
 *  every code emitter renders them verbatim; the canvas either DRAWS them
 *  natively (verdict 'draw' — textCase, textDecoration, textAlignHorizontal,
 *  fontName per docs/FIGMA-CAPABILITY-MATRIX.md) or DECLARES them without
 *  drawing (verdict 'annotate' — the matrix §b annotation copy lands in the
 *  component description). Channels outside this registry, and values
 *  outside each channel's bounded grammar, refuse by name
 *  (validateContract). */
export interface DeclaredChannelSpec {
  /** Bounded value grammar — anything else refuses by name. */
  value: RegExp;
  /** Canvas verdict per the capability matrix: 'draw' = a native node field
   *  expresses it; 'annotate' = declared-not-drawn (CARRY-CODE-ONLY). */
  canvas: 'draw' | 'annotate';
  /** Plain-language annotation copy (matrix §b) for the canvas description. */
  note: string;
}

const kw = (...words: string[]) => new RegExp(`^(${words.join('|')})$`);

export const DECLARED_CHANNELS: Record<string, DeclaredChannelSpec> = {
  // -- interaction-only channels (matrix §9: no canvas concept) -------------
  cursor: {
    value: /^[a-z-]+$/,
    canvas: 'annotate',
    note: 'Cursor changes (pointer on hover) exist only in the coded component.',
  },
  'user-select': {
    value: kw('none', 'auto', 'text', 'all', 'contain'),
    canvas: 'annotate',
    note: 'Text-selection behavior (user-select) exists only in the coded component.',
  },
  'pointer-events': {
    value: kw('none', 'auto'),
    canvas: 'annotate',
    note: 'Pointer-event gating exists only in the coded component.',
  },
  'touch-action': {
    value: /^(auto|none|manipulation|(pan-(x|y|left|right|up|down)|pinch-zoom)( (pan-(x|y|left|right|up|down)|pinch-zoom))*)$/,
    canvas: 'annotate',
    note: 'Touch gesture handling (touch-action) exists only in the coded component.',
  },
  // -- form-control / rendering hints ---------------------------------------
  appearance: {
    value: kw('none', 'auto'),
    canvas: 'annotate',
    note: 'Native form-control appearance is reset only in the coded component.',
  },
  'text-rendering': {
    value: kw('auto', 'optimizespeed', 'optimizelegibility', 'geometricprecision'),
    canvas: 'annotate',
    note: 'Text rasterization hints (text-rendering) apply only in code.',
  },
  'font-feature-settings': {
    value: /^(normal|"[a-z0-9]{4}"( (on|off|\d+))?(, "[a-z0-9]{4}"( (on|off|\d+))?)*)$/i,
    canvas: 'annotate',
    note: "Tabular figures / ligature settings apply only in code — Figma's plugin API cannot set OpenType features.",
  },
  // -- motion (standing CODE-ONLY class, now a declared fact) ---------------
  transition: {
    value: /^[a-z0-9 .,()%-]+$/i,
    canvas: 'annotate',
    note: 'Motion (spin, pulse, easing) runs only in the coded component; the canvas shows one still frame.',
  },
  'transition-property': {
    value: /^(none|all|[a-z-]+(, [a-z-]+)*)$/,
    canvas: 'annotate',
    note: 'Motion (spin, pulse, easing) runs only in the coded component; the canvas shows one still frame.',
  },
  'transition-duration': {
    value: /^-?[\d.]+m?s(, -?[\d.]+m?s)*$/,
    canvas: 'annotate',
    note: 'Motion (spin, pulse, easing) runs only in the coded component; the canvas shows one still frame.',
  },
  'transition-timing-function': {
    value: /^[a-z0-9 .,()-]+$/i,
    canvas: 'annotate',
    note: 'Motion (spin, pulse, easing) runs only in the coded component; the canvas shows one still frame.',
  },
  'transition-delay': {
    value: /^-?[\d.]+m?s(, -?[\d.]+m?s)*$/,
    canvas: 'annotate',
    note: 'Motion (spin, pulse, easing) runs only in the coded component; the canvas shows one still frame.',
  },
  // -- positioning context. Round 4: 'absolute' joins the grammar for
  //    PROMOTED inset overlays (Thumbnail's img, TextField's backdrop) — the
  //    part's inset channels ride minted tokens; the canvas lowers the
  //    inset-0 pattern to layoutPositioning ABSOLUTE (emit-figma-script
  //    isInsetOverlay). fixed/sticky still refuse. --------------------------
  position: {
    value: kw('relative', 'static', 'absolute'),
    canvas: 'annotate',
    note: 'Positioning context (relative) or an inset overlay (absolute, lowered to absolute positioning on canvas); fixed/sticky have no carried spelling.',
  },
  // -- intrinsic aspect (round 4): the real component keeps a square (or
  //    fixed-ratio) box via pseudo-element padding hacks the anatomy cannot
  //    carry — the RATIO is the fact (Avatar/Thumbnail 1:1), observed as
  //    equal computed width/height in every combo. Code renders CSS
  //    aspect-ratio; the canvas resolves height from the bound width. ------
  'aspect-ratio': {
    value: /^\d+(\.\d+)?( \/ \d+(\.\d+)?)?$/,
    canvas: 'draw', // emit-figma-script sizes height = width / ratio when only width is bound
    note: 'The intrinsic aspect ratio renders natively (height follows the bound width).',
  },
  // -- box constraints outside the token grammar ----------------------------
  'max-width': {
    value: /^(none|-?\d+(\.\d+)?(px|rem|em|%)|fit-content|max-content|min-content)$/,
    canvas: 'annotate',
    note: 'Fluid max-width constraints live in code; the canvas draws the component at its real size (standing choice).',
  },
  'max-height': {
    value: /^(none|-?\d+(\.\d+)?(px|rem|em|%)|fit-content|max-content|min-content)$/,
    canvas: 'annotate',
    note: 'Fluid max-height constraints live in code; the canvas draws the component at its real size (standing choice).',
  },
  // -- display keywords outside the flex layout vocabulary ------------------
  display: {
    value: kw('inline', 'inline-block', 'block', 'contents', 'none'),
    canvas: 'annotate',
    note: 'CSS display modes outside auto-layout flex (inline, block) have no direct Figma equivalent; the canvas approximates with frame nesting.',
  },
  // -- wrapping & overflow --------------------------------------------------
  'text-wrap-mode': {
    value: kw('wrap', 'nowrap'),
    canvas: 'annotate',
    note: 'Line-breaking rules differ: Figma wraps by box width only.',
  },
  'white-space': {
    value: kw('normal', 'nowrap', 'pre', 'pre-wrap', 'pre-line', 'break-spaces'),
    canvas: 'annotate',
    note: 'Line-breaking rules differ: Figma wraps by box width only.',
  },
  'overflow-x': {
    value: kw('visible', 'hidden', 'clip', 'auto', 'scroll'),
    canvas: 'annotate',
    note: 'Scrolling behavior and overflow clipping on this axis exist only in code.',
  },
  'overflow-y': {
    value: kw('visible', 'hidden', 'clip', 'auto', 'scroll'),
    canvas: 'annotate',
    note: 'Scrolling behavior and overflow clipping on this axis exist only in code.',
  },
  'text-overflow': {
    value: kw('clip', 'ellipsis'),
    canvas: 'draw', // textTruncation: 'ENDING' on text nodes (matrix a.9)
    note: 'Text truncation renders natively on the canvas (textTruncation).',
  },
  // -- the A22 text channels (matrix a.2 — natively drawable) ---------------
  'text-transform': {
    value: kw('none', 'uppercase', 'lowercase', 'capitalize'),
    canvas: 'draw', // textCase: UPPER | LOWER | TITLE
    note: 'Text case renders natively on the canvas (textCase).',
  },
  'text-decoration-line': {
    value: kw('none', 'underline', 'line-through', 'overline'),
    canvas: 'draw', // textDecoration: UNDERLINE | STRIKETHROUGH; overline has no enum value — annotated when observed
    note: 'Underline/strikethrough render natively (textDecoration); overline exists only in code.',
  },
  'text-decoration-style': {
    value: kw('solid', 'dashed', 'dotted', 'wavy', 'double'),
    canvas: 'annotate', // granular textDecorationStyle exists (SOLID|WAVY|DOTTED); carried in code, canvas upgrade deferred by name
    note: 'This decoration style variant exists only in code (canvas draws a solid decoration).',
  },
  'text-decoration-thickness': {
    value: /^(auto|from-font|-?\d+(\.\d+)?(px|rem|em|%))$/,
    canvas: 'annotate',
    note: 'Decoration thickness exists only in code (canvas draws the default thickness).',
  },
  'text-align': {
    value: kw('left', 'right', 'center', 'justify', 'start', 'end'),
    canvas: 'draw', // textAlignHorizontal (start/end map LTR — named limit)
    note: 'Text alignment renders natively on the canvas (textAlignHorizontal).',
  },
  'font-family': {
    value: /^[^;{}]+$/,
    canvas: 'draw', // fontName.family = first stack entry (named limit: no fallback chain on canvas)
    note: 'The first font-family stack entry renders on the canvas; fallback chains exist only in code.',
  },
  // -- border styles --------------------------------------------------------
  'border-style': {
    value: kw('none', 'solid', 'dashed', 'dotted'),
    canvas: 'annotate', // solid is the emitter's standing stroke; dashed/dotted dashPattern upgrade deferred by name
    note: 'Non-solid border styles exist only in code; the canvas shows a solid stroke of the same width.',
  },
  'border-top-style': {
    value: kw('none', 'solid', 'dashed', 'dotted'),
    canvas: 'annotate',
    note: "This part's borders use different styles per side in code; Figma strokes share one style.",
  },
  'border-right-style': {
    value: kw('none', 'solid', 'dashed', 'dotted'),
    canvas: 'annotate',
    note: "This part's borders use different styles per side in code; Figma strokes share one style.",
  },
  'border-bottom-style': {
    value: kw('none', 'solid', 'dashed', 'dotted'),
    canvas: 'annotate',
    note: "This part's borders use different styles per side in code; Figma strokes share one style.",
  },
  'border-left-style': {
    value: kw('none', 'solid', 'dashed', 'dotted'),
    canvas: 'annotate',
    note: "This part's borders use different styles per side in code; Figma strokes share one style.",
  },
  // -- background sub-channels beyond the color+gradient carriage -----------
  'background-attachment': {
    value: /^(scroll|fixed|local)(, (scroll|fixed|local))*$/,
    canvas: 'annotate',
    note: 'Background attachment exists only in code.',
  },
  'background-blend-mode': {
    value: /^[a-z-]+(, [a-z-]+)*$/,
    canvas: 'annotate',
    note: 'Background blend modes exist only in code (per-paint blendMode upgrade deferred by name).',
  },
  'background-clip': {
    value: /^(border-box|padding-box|content-box|text)(, (border-box|padding-box|content-box|text))*$/,
    canvas: 'annotate',
    note: 'Background clipping exists only in code.',
  },
  'background-origin': {
    value: /^(border-box|padding-box|content-box)(, (border-box|padding-box|content-box))*$/,
    canvas: 'annotate',
    note: 'Background origin exists only in code.',
  },
  'background-position': {
    value: /^[a-z0-9.% -]+(, [a-z0-9.% -]+)*$/,
    canvas: 'annotate',
    note: 'Background positioning exists only in code.',
  },
  'background-repeat': {
    value: /^[a-z-]+( [a-z-]+)?(, [a-z-]+( [a-z-]+)?)*$/,
    canvas: 'annotate',
    note: 'Background repetition exists only in code (uniform TILE approximation deferred by name).',
  },
  'background-size': {
    value: /^[a-z0-9.% -]+(, [a-z0-9.% -]+)*$/,
    canvas: 'annotate',
    note: 'Background sizing exists only in code.',
  },
  // -- compositing ----------------------------------------------------------
  isolation: {
    value: kw('auto', 'isolate'),
    canvas: 'annotate',
    note: 'Stacking-context isolation exists only in code.',
  },
  // -- focus-ring styling (the C5 stroke approximation stands on canvas) ----
  'outline-style': {
    value: kw('none', 'solid', 'dashed', 'dotted', 'auto'),
    canvas: 'annotate',
    note: 'Focus outlines render as a bound stroke approximation on canvas state previews (standing C5 approximation).',
  },
};

/** Schema-level value guard for declared facts: never a token ref, never a
 *  CSS injection vector. The per-channel grammar refusal lives in
 *  validateContract (generator level) where messages can name the channel. */
export const DeclaredValueSchema = z
  .string()
  .regex(/^[^;{}!]+$/, 'Declared value must be a plain CSS value (no token refs, no "!important", no rule injection)');

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

/** v12: repeated-children collection (P9 — menu items, breadcrumb segments,
 *  tab items, avatar stacks). The part is an ITEM TEMPLATE: a component-ref
 *  part rendered once per record of the `itemsProp` arrayOf prop. Field →
 *  child-prop mapping is BY NAME: every arrayOf field of `itemsProp` names a
 *  prop of the referenced child contract (text field → child text prop,
 *  boolean → boolean, number → number; per-item ENUM differences — the
 *  selected tab — are P10 and stay receipted, never carried). Constant child
 *  props ride `component.props` as today.
 *  Projections: the React surface maps the live array
 *  (`{items?.map(…)}` — undefined renders nothing, the arrayOf discipline);
 *  the static surfaces (html, react-inline) and the canvas render `sample` —
 *  the OBSERVED drawn siblings, the collection's honest static state (the
 *  `meter` discipline: the canvas renders the defaults' fraction; here it
 *  renders the drawn items). `sample` records hold field values only. */
export const RepeatSchema = z.strictObject({
  /** The arrayOf prop (by canonical name) the template maps over in code. */
  itemsProp: z.string(),
  /** The OBSERVED design-time sample — one record per drawn sibling, keys ⊆
   *  the arrayOf fields. Required: the canvas/static projection IS the
   *  sample; a sample-less collection would render nothing everywhere but
   *  React. */
  sample: z.array(z.record(z.string(), z.union([z.string(), z.boolean(), z.number()]))).min(1),
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
  /** v10: per-enum-value token overrides merged over `tokens`.
   *  v14: a part may carry MULTIPLE entries (one per driving axis) — ordered,
   *  later entries win per channel; conflicting channel+prop pairs refuse. */
  tokensByProp?: z.infer<typeof TokensByPropFieldSchema>;
  /** v14: literal styling values (channel → bounded literal) resolved
   *  deterministically from component-private source literals — carried with
   *  provenance at promotion, never minted into tokens. */
  literals?: Record<string, string>;
  /** v14: per-enum-value literal overrides merged over `literals` — the
   *  literals sibling of tokensByProp (ordered entries, same refusal rules). */
  literalsByProp?: Array<z.infer<typeof LiteralsByPropSchema>>;
  /** v15 (S4): DECLARED FACTS — keyword/literal channels with no token
   *  vocabulary (cursor, user-select, text-rendering, …), carried verbatim
   *  by every code emitter; the canvas draws the 'draw'-verdict channels
   *  natively and annotates the rest (DECLARED_CHANNELS registry — channel
   *  and value grammar refusals live in validateContract). */
  declared?: Record<string, string>;
  /** v15 (S4): per-state declared facts (cursor stays pointer on :disabled,
   *  text-decoration-line: underline on :hover, outline-style on
   *  :focus-visible). Same channel registry as `declared`; states must be
   *  drawn from the contract's declared `states`. Rendered as state-selector
   *  rules by the CSS emitters; declared-not-drawn on the canvas. */
  declaredStates?: Record<string, Record<string, string>>;
  /** interaction state → (CSS property → token reference). On the ROOT:
   *  the full state vocabulary (background-color, outline-*, opacity, …).
   *  v13 (P18 second half): on a NON-ref part (text/icon/box — never a
   *  component ref or slot), COLOR-KIND channels only (color,
   *  background-color, border-color; emit-react PART_STATE_CHANNELS) —
   *  rendered as descendant rules under the root's state selector
   *  (.root:disabled .label { color: … }) and applied inside the canvas
   *  State-preview variants. Unknown state names, undeclared states, ref/
   *  slot parts, and non-color channels refuse by name (validateContract). */
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
  /** v12: the part is an item TEMPLATE repeated over an arrayOf prop (P9).
   *  Requires `component` (the template is a component ref); refusal rules
   *  in emit-react validateContract. */
  repeat?: z.infer<typeof RepeatSchema>;
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
    /** v14: single entry OR ordered array of entries (see TokensByPropFieldSchema). */
    tokensByProp: TokensByPropFieldSchema.optional(),
    /** v14: bounded literal styling values with promotion-time provenance. */
    literals: z.record(z.string(), LiteralValueSchema).optional(),
    /** v14: ordered per-enum-value literal overrides. */
    literalsByProp: z.array(LiteralsByPropSchema).min(1).optional(),
    /** v15 (S4): declared facts — DECLARED_CHANNELS registry channels. */
    declared: z.record(z.string(), DeclaredValueSchema).optional(),
    /** v15 (S4): per-state declared facts (state → channel → value). */
    declaredStates: z.record(z.string(), z.record(z.string(), DeclaredValueSchema)).optional(),
    /** Root: full state vocabulary. v13: non-ref parts, color-kind channels
     *  only — see the Part interface doc + emit-react validateContract. */
    states: z.record(z.string(), z.record(z.string(), TokenRefSchema)).optional(),
    content: z.strictObject({ prop: z.string() }).optional(),
    text: z.string().optional(),
    meter: z.strictObject({ valueProp: z.string(), maxProp: z.string() }).optional(),
    animation: z.enum(['spin', 'pulse']).optional(),
    slot: SlotSchema.optional(),
    component: ComponentRefSchema.optional(),
    /** v12 (P9). */
    repeat: RepeatSchema.optional(),
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
  /** v12 (§3 theme-mode promotion): RECEIPT-GRADE metadata naming the token
   *  modes a drawn theme/mode variant axis carried (e.g. ['light','dark']).
   *  The axis is NEVER a prop — theming lives in the token collection's
   *  modes, not the component API — so this field changes no emitter output;
   *  it names the fact for reviewers and round-trip tooling. */
  modes: z.array(z.string()).optional(),
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
export type Repeat = z.infer<typeof RepeatSchema>;
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
  /** v15: flex-wrap: wrap (Figma layoutWrap 'WRAP'). */
  wrap?: boolean;
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
  let out = part.tokens ?? {};
  // v14: entries merge IN ORDER — later entries win per channel (the CSS
  // source-order cascade the values were extracted from). An axis with no
  // value in `subst` contributes nothing (a defaultless enum prop left unset
  // applies no override — the same rule the React surface renders live).
  for (const entry of tokensByPropEntries(part)) {
    const override = entry.map[subst[entry.prop] ?? ''];
    if (override) out = { ...out, ...override };
  }
  return out;
}

/** v14: normalize the single-or-array tokensByProp field to an ordered list.
 *  The ONE reader every surface goes through — the single-object spelling
 *  and the array spelling cannot diverge. */
export function tokensByPropEntries(part: Part): Array<z.infer<typeof TokensByPropSchema>> {
  const tbp = part.tokensByProp;
  if (!tbp) return [];
  return Array.isArray(tbp) ? tbp : [tbp];
}

/** v14: the literal record a part carries under one concrete variant combo —
 *  literalsByProp overrides merged over `literals`, resolveTokens semantics. */
export function resolveLiterals(part: Part, subst: Record<string, string>): Record<string, string> {
  let out = part.literals ?? {};
  for (const entry of part.literalsByProp ?? []) {
    const override = entry.map[subst[entry.prop] ?? ''];
    if (override) out = { ...out, ...override };
  }
  return out;
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
  // Root overrides AND (v13) part-level overrides — a substituted part-state
  // ref names the preview's primary axis exactly like a root one.
  const stateMaps = walkAnatomy(contract).map((w) => w.part.states ?? {});
  for (const state of contract.states) {
    for (const overrides of stateMaps) {
      for (const ref of Object.values(overrides[state] ?? {})) {
        for (const m of ref.matchAll(/\{([a-z][\w-]*)\}/g)) {
          if (enumNames.has(m[1])) out.add(m[1]);
        }
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
