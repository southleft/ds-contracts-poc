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
import * as z from "zod";

/** THE CLOSED INTERACTION-STATE VOCABULARY. A `state` is a PSEUDO-CLASS
 *  PLANE — a rendering the same component instance takes without any prop
 *  changing. Anything a prop selects (checked, expanded, selected) is a
 *  VARIANT AXIS, not a state, and must be modelled as an enum prop.
 *
 *  This constant is the SINGLE source of that list: the contract `states`
 *  enum below, the extraction's mint-property suffix parser
 *  (`extract/computed/fuse.ts` STATE_SUFFIXES) and the capture-config
 *  load-time referee (`extract/computed/capture.ts` loadConfig) all read it.
 *  Before the state-plane projection round they were three independent
 *  spellings, and a config that named a state outside the list (MUI Switch's
 *  `checked`) minted channels — `background-color-state-checked` — that
 *  re-parsed as nothing and that NO emitter rendered. */
export const CONTRACT_STATES = [
  "hover",
  "active",
  "focus-visible",
  "disabled",
] as const;
export type ContractState = (typeof CONTRACT_STATES)[number];

/** A DTCG token reference, optionally containing `{propName}` substitution
 *  placeholders that expand over an enum prop's values.
 *  e.g. "{color.action.{variant}.background}" */
export const TokenRefSchema = z
  .string()
  .regex(
    /^\{[a-z0-9.{}-]+\}$/i,
    'Token reference must be brace-wrapped, e.g. "{color.action.primary.background}"',
  )
  // B.16 (docs/23) — THE DEFAULTLESS-AXIS WALL, named. The regex above
  // already forbids "_", but its brace-wrap message never said so: a capture
  // config whose `enumeration.unsetLabel` was the old drafter default
  // "__unset" minted that string into every defaultless-axis token path and
  // fusion died with ~40 "must be brace-wrapped" errors, none mentioning the
  // underscore. This refine adds the actual rule BY NAME whenever an
  // underscore-bearing ref is refused; it rejects nothing the regex did not
  // already reject.
  .refine((v) => !v.includes("_"), {
    message:
      'token refs may not contain underscores (path grammar: letters, digits, ".", "-"); ' +
      'if this is the "__unset" defaultless-axis sentinel, the axis needs a reviewed default ' +
      'in the capture config — set enumeration.unsetLabel to a token-ref-legal label ' +
      '(e.g. "unset") and pin the axis in baseCombo',
  });

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
  arrayOf: z.record(z.string(), z.enum(["text", "number", "boolean"])),
});

export const PropSchema = z
  .strictObject({
    name: z.string(),
    description: z.string().optional(),
    /** "boolean" | "text" | "number" | { enum: [...] } | { arrayOf: {...} } */
    type: z.union([
      z.literal("boolean"),
      z.literal("text"),
      z.literal("number"),
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
        kind: z.enum(["VARIANT", "BOOLEAN", "TEXT", "INSTANCE_SWAP", "NONE"]),
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
  .refine(
    (p) =>
      p.bindings.figma.kind === "NONE" ||
      typeof p.bindings.figma.property === "string",
    {
      message: 'bindings.figma.property is required unless kind is "NONE"',
      path: ["bindings", "figma", "property"],
    },
  )
  .refine(
    (p) =>
      p.bindings.figma.kind !== "NONE" ||
      p.bindings.figma.property === undefined,
    {
      message:
        'kind "NONE" declares no canvas property — omit bindings.figma.property',
      path: ["bindings", "figma", "property"],
    },
  );

// ---------------------------------------------------------------------------
// GRID layout grammar (A2, implements the PINNED proposal
// docs/research/layout-grammar-proposal.md G1–G7 against the probe receipts
// docs/research/grid-recon-probes.md P1–P14). Declared-track grids ONLY: a
// fixed list of row/column tracks, explicit (or order-deterministic)
// placement, spans, two gaps, per-child alignment. The solver half of CSS
// grid is REFUSED BY NAME below — never silently dropped, never approximated.
// ---------------------------------------------------------------------------

/** G7 — the refusal fence. One message per named construct, each citing the
 *  probe-proven dead end. The Zod schemas below quote these verbatim so a
 *  refusal is greppable by its conformance name
 *  (conformance/layout-cases-draft/MANIFEST.json ids). */
export const GRID_REFUSALS: Record<string, string> = {
  "grid-track-zero":
    "grid-track-zero: 0px/0fr tracks are refused — the Plugin API SILENTLY REWRITES them " +
    "(P2b: {FIXED,0} reads back snapped to the rendered px, {FLEX,0} clamps to 1fr); the schema " +
    "refuses so the emitter can never trigger the rewrite",
  "grid-track-percent":
    "grid-track-percent: percent tracks are refused — the track-type enum is FLEX | FIXED | HUG " +
    "(P2b exact error: \"Invalid enum value. Expected 'FLEX' | 'FIXED' | 'HUG', received 'PERCENT'\")",
  "grid-track-minmax":
    "grid-track-minmax: minmax() tracks are refused — no canvas spelling exists " +
    "(P6 exact error: \"Unrecognized key(s) in object: 'min', 'max'\" on gridColumnSizes)",
  "grid-auto-fit-minmax":
    "grid-auto-fit-minmax: repeat(auto-fit/auto-fill, …) is refused — the canvas track count is a " +
    "fixed number with no repeat-to-fit concept (P1 reflection); a viewport-responsive track COUNT " +
    "is a reflow family one frame cannot carry",
  "grid-subgrid":
    "grid-subgrid: subgrid is refused — no track-inheritance property exists anywhere in the " +
    "reflected Plugin API inventory (P1); a nested grid with copied literal tracks is a DIFFERENT " +
    "fact and must not be passed off as subgrid",
  "grid-flow-column":
    "grid-flow-column: grid-auto-flow: column is refused — gridItemsPositioning is exactly " +
    "'MANUAL' | 'ROW_AUTO_FLOW' (P5: COLUMN_AUTO_FLOW rejected); refusing beats a silent transpose",
  "grid-flow-dense":
    "grid-flow-dense: grid-auto-flow: dense is refused — dense packing is SOLVER OUTPUT, not a " +
    "declared fact, and the enum rejects it anyway (P5: DENSE rejected)",
  "grid-implicit-tracks":
    "grid-implicit-tracks: placement beyond the declared track list is refused — the canvas absorbs " +
    "overflow by REWRITING the declaration (P9: MANUAL append grew gridRowCount 2→3) or under-reports " +
    "it (P9: ROW_AUTO_FLOW anchors exceeded gridRowCount); the contract never relies on implicit tracks",
  "grid-align-stretch-keyword":
    "grid-align-stretch-keyword: an explicit stretch ALIGN fact is refused — the canvas align enum " +
    "rejects STRETCH (P3); stretch is spelled as the ABSENCE of alignment plus fill sizing (G3), a " +
    "named LOWERED disposition, never a silent normalization",
  "grid-baseline-align":
    "grid-baseline-align: baseline alignment in a grid cell is refused — the canvas align enum " +
    "rejects BASELINE (P3)",
  "grid-negative-line":
    "grid-negative-line: negative line indexes are refused — the anchor API has no negative-index " +
    "concept (gridRow/ColumnAnchorIndex are 0-based cells, P3); proposers lower RESOLVABLE negatives " +
    "to absolute indexes (LOWERED) and refuse unresolvable ones",
  "grid-child-grow":
    "grid-child-grow: layout.grow on a child of a grid parent is refused — the Plugin API silently " +
    "ACCEPTS layoutGrow on grid children with no layout effect (P4); the schema refuses what the " +
    "platform would silently swallow",
  // --- G7′, added by the composition round (2026-08-08, probes GP1–GP15) ---
  "grid-hug-flex-axis":
    "grid-hug-flex-axis: an intrinsically-sized axis (literals width/height \"fit-content\") is refused " +
    "on an axis whose declared track list contains an {fr} track — NO write order satisfies both " +
    "(GP1/GP5/GP12: hugging AFTER the tracks normalizes every FLEX track on that axis to HUG and the " +
    "ratio is silently gone; GP8/GP1b: hugging BEFORE the tracks preserves the ratio but the hug is " +
    "INERT — the node reports layoutSizing HUG and stays its FIXED size, a readback that lies to the " +
    "differ). CSS agrees: 1fr resolves against a definite size, so this fact exists on neither surface",
  "grid-axis-indefinite":
    "grid-axis-indefinite: a grid part must make each axis DEFINITE — a px/token size, " +
    "\"fit-content\" (G8), or layout.grow (width, flex parent). Absence is refused because it resolves " +
    "DIFFERENTLY per surface: primary/counterAxisSizingMode are INERT on a GRID frame (GP1b/GP8), so " +
    "the canvas keeps createFrame's FIXED 100 while CSS takes content height — the FC-GRID-ROOT-VSIZE " +
    "defect the composition corpus measured on three of five stems",
  "grid-overlay-edge-inversion":
    "grid-overlay-edge-inversion: inverting a captured absolute child (dump `abs`: x/y inside a cell) " +
    "into Part.overlay is refused PERMANENTLY — not a Plugin API dead end but a VOCABULARY one: " +
    "OverlaySchema is four edge values with NO offset channel, while the canvas fact is a point in R² " +
    "plus a 3×3 constraints lattice, so every total map either drops the offsets (a silent geometry " +
    "rewrite) or invents a channel the schema does not have (G9.1). The child is carried out-of-flow " +
    "through the existing abs door (position:absolute + minted insets) and the GRID is carried whole",
  "slot-accepts-cycle":
    "slot-accepts-cycle: a cycle in the slot.accepts dependency graph is refused — accepts is a HARD " +
    "emission-order dependency (a slot naming an absent component throws at compile), so the emitted " +
    "set is ordered topologically (G10); a cycle cannot be satisfied in one pass and dropping an edge " +
    "to break it would make the constraint depend on iteration order",
};

/** G8 — the one spelling for an intrinsically-sized axis. `fit-content` is
 *  already a legal Part literal and already the CSS truth; the canvas twin is
 *  layoutSizing{Horizontal,Vertical} = 'HUG'. No new field: a second spelling
 *  for a fact the grammar already has is the disease this round cures. */
export const HUG_KEYWORD = "fit-content";

/** G1 — a TRACK is exactly one of {"px": n}, {"fr": n}, {"fit": true}: the
 *  three spellings the API round-trips (P2/P2b: FIXED | FLEX | HUG; HUG's
 *  code spelling is fit-content(100%), P14). Values may be fractional (P2b:
 *  33.5px / 2.5fr carried exactly); ZERO is invalid (P2b normalization —
 *  see GRID_REFUSALS['grid-track-zero']). Every G7 track construct refuses
 *  BY NAME through the union's error map. */
const gridTrackRefusal = (input: unknown): string => {
  if (typeof input === "string") {
    const s = input.trim();
    if (/^repeat\(\s*auto-(fit|fill)/.test(s)) return GRID_REFUSALS["grid-auto-fit-minmax"];
    if (s.includes("minmax(")) return GRID_REFUSALS["grid-track-minmax"];
    if (s === "subgrid") return GRID_REFUSALS["grid-subgrid"];
    if (s.includes("%") && !s.startsWith("fit-content")) return GRID_REFUSALS["grid-track-percent"];
  }
  if (typeof input === "object" && input !== null) {
    const o = input as Record<string, unknown>;
    if ("min" in o || "max" in o) return GRID_REFUSALS["grid-track-minmax"];
    if ("percent" in o || o["type"] === "PERCENT") return GRID_REFUSALS["grid-track-percent"];
    if (o["px"] === 0 || o["fr"] === 0) return GRID_REFUSALS["grid-track-zero"];
    if (typeof o["px"] === "number" && o["px"] < 0) return GRID_REFUSALS["grid-negative-line"];
  }
  return (
    'grid track must be exactly one of {"px": number>0}, {"fr": number>0}, {"fit": true} — ' +
    "the three spellings the Plugin API round-trips (P2/P2b: FIXED | FLEX | HUG)"
  );
};
/** Zero names its refusal even when the union matched the option's shape —
 *  Zod surfaces the closest option's inner issue, so the inner check carries
 *  the same named message the union's error map would. */
const positiveTrackValue = z.number().positive({
  error: (iss) =>
    (iss as { input?: unknown }).input === 0
      ? GRID_REFUSALS["grid-track-zero"]
      : "grid track px/fr values must be > 0 (fractional ok — P2b: 33.5px / 2.5fr carried exactly)",
});
export const GridTrackSchema = z.union(
  [
    z.strictObject({ px: positiveTrackValue }),
    z.strictObject({ fr: positiveTrackValue }),
    z.strictObject({ fit: z.literal(true) }),
  ],
  { error: (iss) => gridTrackRefusal((iss as { input?: unknown }).input) },
);
export type GridTrack = z.infer<typeof GridTrackSchema>;

/** G1 — gap.row / gap.column are INDEPENDENT facts (P2: gridRowGap /
 *  gridColumnGap are separate setters); px numbers or token refs. There is
 *  deliberately NO single-`gap` shorthand in the contract — proposers
 *  normalize CSS `gap: 12px 16px` (and one-value `gap: 12px`) into the pair
 *  (a named LOWERED disposition). */
const GridGapValueSchema = z.union([z.number().min(0), TokenRefSchema]);
export const GridGapSchema = z.strictObject({
  row: GridGapValueSchema,
  column: GridGapValueSchema,
});

/** G5 — the ONE bounded auto-flow the canvas has (P5: gridItemsPositioning
 *  is exactly 'MANUAL' | 'ROW_AUTO_FLOW'). Placement fact = CHILD ORDER;
 *  rows must be omitted and derivable as ceil(children / columns.length) —
 *  the emitter declares that many explicit row tracks itself because the
 *  API under-reports implicit rows (P9). column/dense refuse BY NAME. */
const GridFlowSchema = z.literal("row", {
  error: (iss) => {
    const v = (iss as { input?: unknown }).input;
    if (v === "column" || v === "column dense") return GRID_REFUSALS["grid-flow-column"];
    if (v === "dense" || v === "row dense") return GRID_REFUSALS["grid-flow-dense"];
    return (
      'flow must be "row" — the one bounded auto-flow the canvas has ' +
      "(P5: gridItemsPositioning is 'MANUAL' | 'ROW_AUTO_FLOW')"
    );
  },
});

/** G2 — per-cell alignment vocabulary: auto | start | center | end →
 *  AUTO | MIN | CENTER | MAX (P3/P4: exactly those four; STRETCH and
 *  BASELINE are refused BY NAME — stretch is spelled as fill sizing, G3). */
const GridAlignSchema = z.enum(["auto", "start", "center", "end"], {
  error: (iss) => {
    const v = (iss as { input?: unknown }).input;
    if (v === "stretch") return GRID_REFUSALS["grid-align-stretch-keyword"];
    if (v === "baseline") return GRID_REFUSALS["grid-baseline-align"];
    return (
      "grid alignment vocabulary is auto | start | center | end " +
      "(P3/P4: AUTO | MIN | CENTER | MAX — exactly those four)"
    );
  },
});

/** 0-based anchor cell index. Negative line indexes refuse BY NAME (G7). */
const GridIndexSchema = z
  .number()
  .int()
  .nonnegative({ error: () => GRID_REFUSALS["grid-negative-line"] });
const GridSpanSchema = z.number().int().min(1);

/** G2 — explicit child placement on a part whose PARENT declares
 *  `layout.display: "grid"`. Anchors map to child.setGridChildPosition(row,
 *  column) — the child-side setter, the only one that exists (P3); spans map
 *  to gridRowSpan / gridColumnSpan. Bounds and occupancy are validated
 *  contract-side (the part-level referee below) BEFORE emitting, so the
 *  canvas write can never throw mid-script (P3's two named errors). */
export const GridPlacementSchema = z.strictObject({
  row: GridIndexSchema,
  column: GridIndexSchema,
  rowSpan: GridSpanSchema.optional(),
  columnSpan: GridSpanSchema.optional(),
  alignX: GridAlignSchema.optional(),
  alignY: GridAlignSchema.optional(),
});
export type GridPlacement = z.infer<typeof GridPlacementSchema>;

/** G4 — a named area IS a slot anchor: the key is simultaneously a slot
 *  name and a placement rect (same fields as G2 placements minus alignment).
 *  A part (or slot) with the same name under this parent takes the area's
 *  placement; declaring both an area and an explicit `placement` for one
 *  name is schema-invalid (one source of truth). Figma has no native area
 *  names — the CONTRACT owns the names, both surfaces carry the rects. */
export const GridAreaSchema = z.strictObject({
  row: GridIndexSchema,
  column: GridIndexSchema,
  rowSpan: GridSpanSchema.optional(),
  columnSpan: GridSpanSchema.optional(),
});
export type GridArea = z.infer<typeof GridAreaSchema>;

export const LayoutSchema = z
  .strictObject({
    /** "grid" joins the flex spellings (G1) — declared-track grids only. */
    display: z.enum(["flex", "inline-flex", "grid"]).optional(),
    direction: z.enum(["row", "column"]).optional(),
    /** Cross-axis alignment. `baseline` is CARRY-BOTH like the rest: CSS
     *  `align-items: baseline`, canvas `counterAxisAlignItems: 'BASELINE'`
     *  (native on HORIZONTAL auto-layout — on a column the canvas falls back
     *  to MIN, which is what a column baseline draws anyway). */
    align: z.enum(["start", "center", "end", "stretch", "baseline"]).optional(),
    justify: z.enum(["start", "center", "end", "space-between"]).optional(),
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
    /** G1 — the declared track lists ARE the contract fact; counts are
     *  derived (rows.length), never stored (the API's count-before-sizes
     *  ordering, P2, is an EMITTER obligation, not a schema concern). */
    rows: z.array(GridTrackSchema).min(1).optional(),
    columns: z.array(GridTrackSchema).min(1).optional(),
    /** G1 — the independent gap pair (see GridGapSchema). */
    gap: GridGapSchema.optional(),
    /** G4 — named areas as slot anchors (see GridAreaSchema). */
    areas: z.record(z.string(), GridAreaSchema).optional(),
    /** G5 — bounded row auto-flow (see GridFlowSchema). */
    flow: GridFlowSchema.optional(),
  })
  .superRefine((l, ctx) => {
    if (l.display === "grid") {
      // G1: direction/justify/align/wrap are flex-only facts. `overlap` joins
      // them: it lowers to negative itemSpacing, a field GRID frames do not
      // have — carrying it would be a dead fact, the grid-child-grow class.
      for (const f of ["direction", "justify", "align", "wrap", "overlap"] as const) {
        if (l[f] !== undefined) {
          ctx.addIssue({
            code: "custom",
            path: [f],
            message: `"${f}" is a flex-only fact and is schema-invalid together with display: "grid" (G1)`,
          });
        }
      }
      if (!l.columns) {
        ctx.addIssue({
          code: "custom",
          path: ["columns"],
          message:
            'display: "grid" requires a declared "columns" track list — the declared tracks ARE the contract fact (G1)',
        });
      }
      if (l.flow === "row") {
        // G5′ (2026-08-08): `rows` MAY be declared under flow. GP6/GP6b measured
        // gridItemsPositioning='ROW_AUTO_FLOW' and declared gridRowSizes coexisting
        // natively, in either write order, with anchors still computed row-major
        // from child order (P5). The old omit-only rule was inferred from P9
        // (which is about OVERFLOW) and over-applied. When `rows` IS omitted the
        // emitter still derives ceil(children/columns) × {fr:1}, so no existing
        // flow contract moves; the count bound lives in the part-level referee,
        // which is the only place the child count is visible.
        if (l.areas) {
          ctx.addIssue({
            code: "custom",
            path: ["areas"],
            message:
              'named areas are explicit placements; under flow: "row" placement is CHILD ORDER ' +
              "(P5: position setters are refused under auto-flow) — a grid declares areas or flow, never both",
          });
        }
      } else if (!l.rows) {
        ctx.addIssue({
          code: "custom",
          path: ["rows"],
          message:
            'display: "grid" requires a declared "rows" track list, or flow: "row" with derivable rows (G1/G5)',
        });
      }
    } else {
      for (const f of ["rows", "columns", "gap", "areas", "flow"] as const) {
        if (l[f] !== undefined) {
          ctx.addIssue({
            code: "custom",
            path: [f],
            message: `"${f}" is a grid-only fact — it requires display: "grid" (G1)`,
          });
        }
      }
    }
  });

/** v7: per-enum-value layout overrides (chat sender flip, toolbar density).
 *  A subset of LayoutSchema — plus REVERSED directions, which only make
 *  sense as variant overrides: code emits flex-direction rules under the
 *  enum class; the canvas (which has no reverse) reverses the compiled
 *  child order per variant instead. grow/overlap stay per-part invariants. */
export const VariantLayoutSchema = z.strictObject({
  display: z.enum(["flex", "inline-flex"]).optional(),
  direction: z
    .enum(["row", "column", "row-reverse", "column-reverse"])
    .optional(),
  align: z.enum(["start", "center", "end", "stretch", "baseline"]).optional(),
  justify: z.enum(["start", "center", "end", "space-between"]).optional(),
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

/** v17 (the hover-plane round) — an interaction state whose binding is ALSO a
 *  function of an enum axis: `statesByProp`.
 *
 *  `states` holds ONE ref per channel, and root `states` already expands a ref
 *  carrying a single {prop} placeholder into per-enum-value state rules. That
 *  covers a token FAMILY parameterised by the axis
 *  ({button.bg.hover.{variant}}). It cannot cover the far commoner case: a
 *  design system whose per-variant state colours are UNRELATED NAMES. Eventz's
 *  hover backgrounds are comp/button/primary/color/background/hover for
 *  primary and comp/button/color/background/knockout-hover for knockout —
 *  no family, no shared stem, nothing a placeholder can reach. Measured, that
 *  refusal cost Button and Icon Button their ENTIRE hover and active planes
 *  (6 refusals → 7 states promoted with nothing recoverable), and a state
 *  crossed with a variant axis is the single most common pattern in a real
 *  design system.
 *
 *  So the shape is `tokensByProp`'s, plus the state it applies to: `map`
 *  is value → (CSS property → token ref), identical to TokensByPropSchema's,
 *  which keeps ONE map grammar in the vocabulary rather than two. Entries are
 *  ordered like tokensByProp entries; refs are PLAIN (no placeholders — the
 *  axis is already pinned by the map key, and a second axis would need a
 *  second pin the map has nowhere to put). Rendered as enum-class state rules
 *  (.variant-primary:hover), emitted after the plain `states` rules so the
 *  per-value binding wins at equal specificity — the tokensByProp cascade
 *  discipline applied to a state selector. */
export const StatesByPropSchema = z.strictObject({
  prop: z.string(),
  state: z.string(),
  map: z.record(z.string(), z.record(z.string(), TokenRefSchema)),
});

/** v14: a literal styling value a contract may carry where the SOURCE style
 *  is a component-private literal (Polaris `--pc-*` pixel geometry), resolved
 *  deterministically through a var() chain — never invented, never minted
 *  into a token. Bounded grammar: px/rem/em/unitless numbers, hex and
 *  rgb()/rgba() colors, the CSS keywords transparent/inherit/currentColor,
 *  and (v16, gap-closing round 6) the CONTENT-SIZED keyword `fit-content`.
 *
 *  `fit-content` earns its place because a HUG axis is a FACT, not a number.
 *  A Figma frame that hugs on an axis has no design-authored measure there —
 *  its drawn box is a MEASUREMENT OF ITS DEFAULT CONTENT. Pinning that
 *  measurement as a literal px is a wrong-name: the host that overrides the
 *  content gets a box sized for content it no longer holds (field case: the
 *  UUI Tooltip's hug plane pinned at 112px, drawn from "This is a tooltip",
 *  reused by ProgressBar whose label says "40%" — a 52px bubble adrift in a
 *  112px root whose shadow, the bubble's only edge, drew the wrong
 *  rectangle). `fit-content` is the exact CSS twin of Figma HUG, and it is
 *  the one sizing keyword this grammar admits: `auto`/`max-content`/
 *  `stretch` are NOT synonyms for HUG in a flex context and stay out. */
export const LITERAL_VALUE_RE =
  /^(-?\d+(\.\d+)?(px|rem|em|%)?|transparent|inherit|currentColor|fit-content|#[0-9a-fA-F]{3,8}|rgba?\([\d ,./%]+\))$/;
export const LiteralValueSchema = z
  .string()
  .regex(
    LITERAL_VALUE_RE,
    "Literal value must be a px/rem/em/%/number, hex or rgb()/rgba() color, fit-content, or transparent/inherit/currentColor",
  );

/** v14: the channels a literal may ride — geometry and paint channels where
 *  foreign systems keep component-private literals. Everything else refuses
 *  by name (validateContract). */
export const LITERAL_CHANNELS = new Set([
  "background",
  "background-color",
  "color",
  "height",
  "width",
  "min-width",
  "min-height",
  "padding-block",
  "padding-inline",
  "gap",
  "border-radius",
  "border-width",
  "font-size",
  "line-height",
  "letter-spacing",
  // v15 (S4/matrix a.4–a.5): per-corner radii and per-side border widths are
  // natively CARRY-BOTH (each corner/side field is independently
  // variable-bindable) — the literal grammar carries them like their
  // uniform shorthands.
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-left-radius",
  "border-bottom-right-radius",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  // Round 4: padding longhands — the base-plane literal fallback carries the
  // base combo's captured paddings when per-plane values refuse correlation
  // (Tag's remove-×/link planes shift them; the base plane is exact).
  "padding-left",
  "padding-right",
  "padding-top",
  "padding-bottom",
  // CARBON LIVE-DEFECT ROUND (pseudo-decor v2): placement OFFSETS and border
  // COLOURS. An UNCONDITIONAL absolute decor box (Carbon's checkbox square,
  // its toggle knob) declares `position: absolute` and carries its own
  // offsets — `absolutePartPlacement` has always read them out of
  // `resolveLiterals`, so the emitter expected this spelling before the
  // registry allowed it. Border colours join for the same reason: an
  // unchecked checkbox box is a transparent square with a 1px RING, and a
  // ring is a colour, not only a width.
  "top",
  "right",
  "bottom",
  "left",
  "border-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
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
  canvas: "draw" | "annotate";
  /** Plain-language annotation copy (matrix §b) for the canvas description. */
  note: string;
}

const kw = (...words: string[]) => new RegExp(`^(${words.join("|")})$`);

export const DECLARED_CHANNELS: Record<string, DeclaredChannelSpec> = {
  // -- absolute-position round (MUI Slider/Switch): overlay-anatomy facts ---
  transform: {
    // Identity-translate matrices — matrix(1, 0, 0, 1, tx, ty), the shape
    // Chromium computes for translate()/translate(-50%,-50%) on a sized
    // box — fold tx/ty into absolute offsets.
    // FC-SVG-ROTATION: also `rotate(<n>deg)` (CSS-clockwise) for icon parts
    // whose capture path orientation differs from the developed receipt
    // (Polaris Spinner gap 12 o'clock → 3 o'clock). Scales/skews stay
    // outside the grammar (named residue).
    value: /^(?:matrix\(1, 0, 0, 1, -?[\d.]+, -?[\d.]+\)$|rotate\(-?[\d.]+deg\))$/,
    canvas: "draw",
    note: "Identity-translate (absolute offset fold) or rotate(<n>deg) for icon/shape orientation (FC-SVG-ROTATION).",
  },
  // PSEUDO-DECOR v2 ROUND: the INDEPENDENT `translate` longhand — what
  // Tailwind v4's translate-x-full actually compiles to (the toggle knob),
  // NOT `transform`. Bounded exactly like transform's grammar: one or two
  // <len|pct> components, `none` for the resting spelling. Percentages bake
  // against the element's own captured border box at the read boundary
  // (decomposeTranslate); the canvas lowering folds tx/ty into absolute
  // offsets through the very same synthetic translate-x/y channels.
  translate: {
    value: /^(none|-?[\d.]+(px|%)( -?[\d.]+(px|%))?)$/,
    canvas: "draw",
    note: "Independent translate longhand on an absolute part — folded into the canvas absolute offsets (tx/ty).",
  },
  "box-sizing": {
    value: kw("border-box", "content-box"),
    canvas: "draw",
    note: "Box-sizing changes what captured width/height mean — content-box geometry gets padding added when lowered to canvas frame sizes.",
  },
  // -- interaction-only channels (matrix §9: no canvas concept) -------------
  cursor: {
    value: /^[a-z-]+$/,
    canvas: "annotate",
    note: "Cursor changes (pointer on hover) exist only in the coded component.",
  },
  "user-select": {
    value: kw("none", "auto", "text", "all", "contain"),
    canvas: "annotate",
    note: "Text-selection behavior (user-select) exists only in the coded component.",
  },
  "pointer-events": {
    value: kw("none", "auto"),
    canvas: "annotate",
    note: "Pointer-event gating exists only in the coded component.",
  },
  "touch-action": {
    value:
      /^(auto|none|manipulation|(pan-(x|y|left|right|up|down)|pinch-zoom)( (pan-(x|y|left|right|up|down)|pinch-zoom))*)$/,
    canvas: "annotate",
    note: "Touch gesture handling (touch-action) exists only in the coded component.",
  },
  // -- form-control / rendering hints ---------------------------------------
  appearance: {
    value: kw("none", "auto"),
    canvas: "annotate",
    note: "Native form-control appearance is reset only in the coded component.",
  },
  "text-rendering": {
    value: kw(
      "auto",
      "optimizespeed",
      "optimizelegibility",
      "geometricprecision",
    ),
    canvas: "annotate",
    note: "Text rasterization hints (text-rendering) apply only in code.",
  },
  "font-feature-settings": {
    value:
      /^(normal|"[a-z0-9]{4}"( (on|off|\d+))?(, "[a-z0-9]{4}"( (on|off|\d+))?)*)$/i,
    canvas: "annotate",
    note: "Tabular figures / ligature settings apply only in code — Figma's plugin API cannot set OpenType features.",
  },
  // -- motion (standing CODE-ONLY class, now a declared fact) ---------------
  transition: {
    value: /^[a-z0-9 .,()%-]+$/i,
    canvas: "annotate",
    note: "Motion (spin, pulse, easing) runs only in the coded component; the canvas shows one still frame.",
  },
  "transition-property": {
    value: /^(none|all|[a-z-]+(, [a-z-]+)*)$/,
    canvas: "annotate",
    note: "Motion (spin, pulse, easing) runs only in the coded component; the canvas shows one still frame.",
  },
  "transition-duration": {
    value: /^-?[\d.]+m?s(, -?[\d.]+m?s)*$/,
    canvas: "annotate",
    note: "Motion (spin, pulse, easing) runs only in the coded component; the canvas shows one still frame.",
  },
  "transition-timing-function": {
    value: /^[a-z0-9 .,()-]+$/i,
    canvas: "annotate",
    note: "Motion (spin, pulse, easing) runs only in the coded component; the canvas shows one still frame.",
  },
  "transition-delay": {
    value: /^-?[\d.]+m?s(, -?[\d.]+m?s)*$/,
    canvas: "annotate",
    note: "Motion (spin, pulse, easing) runs only in the coded component; the canvas shows one still frame.",
  },
  // -- positioning context. Round 4: 'absolute' joins the grammar for
  //    PROMOTED inset overlays (Thumbnail's img, TextField's backdrop) — the
  //    part's inset channels ride minted tokens; the canvas lowers the
  //    inset-0 pattern to layoutPositioning ABSOLUTE (emit-figma-script
  //    isInsetOverlay). fixed/sticky still refuse. --------------------------
  position: {
    value: kw("relative", "static", "absolute"),
    canvas: "annotate",
    note: "Positioning context (relative) or an inset overlay (absolute, lowered to absolute positioning on canvas); fixed/sticky have no carried spelling.",
  },
  // -- intrinsic aspect (round 4): the real component keeps a square (or
  //    fixed-ratio) box via pseudo-element padding hacks the anatomy cannot
  //    carry — the RATIO is the fact (Avatar/Thumbnail 1:1), observed as
  //    equal computed width/height in every combo. Code renders CSS
  //    aspect-ratio; the canvas resolves height from the bound width. ------
  "aspect-ratio": {
    value: /^\d+(\.\d+)?( \/ \d+(\.\d+)?)?$/,
    canvas: "draw", // emit-figma-script sizes height = width / ratio when only width is bound
    note: "The intrinsic aspect ratio renders natively (height follows the bound width).",
  },
  // -- box constraints outside the token grammar ----------------------------
  "max-width": {
    value:
      /^(none|-?\d+(\.\d+)?(px|rem|em|%)|fit-content|max-content|min-content)$/,
    canvas: "annotate",
    note: "Fluid max-width constraints live in code; the canvas draws the component at its real size (standing choice).",
  },
  "max-height": {
    value:
      /^(none|-?\d+(\.\d+)?(px|rem|em|%)|fit-content|max-content|min-content)$/,
    canvas: "annotate",
    note: "Fluid max-height constraints live in code; the canvas draws the component at its real size (standing choice).",
  },
  // -- display keywords outside the flex layout vocabulary ------------------
  display: {
    // CARBON LIVE-DEFECT ROUND (D3): `list-item` and `flow-root` join the
    // grammar. Both are BLOCK-LEVEL boxes in CSS block flow, and leaving them
    // out did not make them safe — it made them SILENT: Carbon's
    // `<li class="cds--accordion__item">` carried no display fact at all, so
    // the canvas fell through to the emitter's row default and drew the 472px
    // panel beside the 174px heading inside a 328px item.
    value: kw(
      "inline",
      "inline-block",
      "block",
      "flow-root",
      "list-item",
      "contents",
      "none",
    ),
    canvas: "annotate",
    note: "CSS display modes outside auto-layout flex (inline, block, list-item) have no direct Figma equivalent; the canvas approximates with frame nesting (a block-level box lowers to a vertical stack).",
  },
  // -- wrapping & overflow --------------------------------------------------
  "text-wrap-mode": {
    value: kw("wrap", "nowrap"),
    canvas: "annotate",
    note: "Line-breaking rules differ: Figma wraps by box width only.",
  },
  "white-space": {
    value: kw(
      "normal",
      "nowrap",
      "pre",
      "pre-wrap",
      "pre-line",
      "break-spaces",
    ),
    canvas: "annotate",
    note: "Line-breaking rules differ: Figma wraps by box width only.",
  },
  "overflow-x": {
    value: kw("visible", "hidden", "clip", "auto", "scroll"),
    canvas: "annotate",
    note: "Scrolling behavior and overflow clipping on this axis exist only in code.",
  },
  "overflow-y": {
    value: kw("visible", "hidden", "clip", "auto", "scroll"),
    canvas: "annotate",
    note: "Scrolling behavior and overflow clipping on this axis exist only in code.",
  },
  "text-overflow": {
    value: kw("clip", "ellipsis"),
    canvas: "draw", // textTruncation: 'ENDING' on text nodes (matrix a.9)
    note: "Text truncation renders natively on the canvas (textTruncation).",
  },
  // -- the A22 text channels (matrix a.2 — natively drawable) ---------------
  "text-transform": {
    value: kw("none", "uppercase", "lowercase", "capitalize"),
    canvas: "draw", // textCase: UPPER | LOWER | TITLE
    note: "Text case renders natively on the canvas (textCase).",
  },
  "text-decoration-line": {
    value: kw("none", "underline", "line-through", "overline"),
    canvas: "draw", // textDecoration: UNDERLINE | STRIKETHROUGH; overline has no enum value — annotated when observed
    note: "Underline/strikethrough render natively (textDecoration); overline exists only in code.",
  },
  "text-decoration-style": {
    value: kw("solid", "dashed", "dotted", "wavy", "double"),
    canvas: "annotate", // granular textDecorationStyle exists (SOLID|WAVY|DOTTED); carried in code, canvas upgrade deferred by name
    note: "This decoration style variant exists only in code (canvas draws a solid decoration).",
  },
  "text-decoration-thickness": {
    value: /^(auto|from-font|-?\d+(\.\d+)?(px|rem|em|%))$/,
    canvas: "annotate",
    note: "Decoration thickness exists only in code (canvas draws the default thickness).",
  },
  "text-align": {
    value: kw("left", "right", "center", "justify", "start", "end"),
    canvas: "draw", // textAlignHorizontal (start/end map LTR — named limit)
    note: "Text alignment renders natively on the canvas (textAlignHorizontal).",
  },
  "font-family": {
    value: /^[^;{}]+$/,
    canvas: "draw", // fontName.family = first stack entry (named limit: no fallback chain on canvas)
    note: "The first font-family stack entry renders on the canvas; fallback chains exist only in code.",
  },
  // -- border styles --------------------------------------------------------
  "border-style": {
    value: kw("none", "solid", "dashed", "dotted"),
    canvas: "annotate", // solid is the emitter's standing stroke; dashed/dotted dashPattern upgrade deferred by name
    note: "Non-solid border styles exist only in code; the canvas shows a solid stroke of the same width.",
  },
  "border-top-style": {
    value: kw("none", "solid", "dashed", "dotted"),
    canvas: "annotate",
    note: "This part's borders use different styles per side in code; Figma strokes share one style.",
  },
  "border-right-style": {
    value: kw("none", "solid", "dashed", "dotted"),
    canvas: "annotate",
    note: "This part's borders use different styles per side in code; Figma strokes share one style.",
  },
  "border-bottom-style": {
    value: kw("none", "solid", "dashed", "dotted"),
    canvas: "annotate",
    note: "This part's borders use different styles per side in code; Figma strokes share one style.",
  },
  "border-left-style": {
    value: kw("none", "solid", "dashed", "dotted"),
    canvas: "annotate",
    note: "This part's borders use different styles per side in code; Figma strokes share one style.",
  },
  // -- background sub-channels beyond the color+gradient carriage -----------
  "background-attachment": {
    value: /^(scroll|fixed|local)(, (scroll|fixed|local))*$/,
    canvas: "annotate",
    note: "Background attachment exists only in code.",
  },
  "background-blend-mode": {
    value: /^[a-z-]+(, [a-z-]+)*$/,
    canvas: "annotate",
    note: "Background blend modes exist only in code (per-paint blendMode upgrade deferred by name).",
  },
  "background-clip": {
    value:
      /^(border-box|padding-box|content-box|text)(, (border-box|padding-box|content-box|text))*$/,
    canvas: "annotate",
    note: "Background clipping exists only in code.",
  },
  "background-origin": {
    value:
      /^(border-box|padding-box|content-box)(, (border-box|padding-box|content-box))*$/,
    canvas: "annotate",
    note: "Background origin exists only in code.",
  },
  "background-position": {
    value: /^[a-z0-9.% -]+(, [a-z0-9.% -]+)*$/,
    canvas: "annotate",
    note: "Background positioning exists only in code.",
  },
  "background-repeat": {
    value: /^[a-z-]+( [a-z-]+)?(, [a-z-]+( [a-z-]+)?)*$/,
    canvas: "annotate",
    note: "Background repetition exists only in code (uniform TILE approximation deferred by name).",
  },
  "background-size": {
    value: /^[a-z0-9.% -]+(, [a-z0-9.% -]+)*$/,
    canvas: "annotate",
    note: "Background sizing exists only in code.",
  },
  // -- compositing ----------------------------------------------------------
  isolation: {
    value: kw("auto", "isolate"),
    canvas: "annotate",
    note: "Stacking-context isolation exists only in code.",
  },
  // -- focus-ring styling (the C5 stroke approximation stands on canvas) ----
  "outline-style": {
    value: kw("none", "solid", "dashed", "dotted", "auto"),
    canvas: "annotate",
    note: "Focus outlines render as a bound stroke approximation on canvas state previews (standing C5 approximation).",
  },
};

/** SILENT-LOSS ROUND (task #33, fix 4) — THE TOKEN-CHANNEL REGISTRY.
 *
 *  `tokens` was typed `z.record(z.string(), TokenRefSchema)`: ANY string was a
 *  legal channel, and `validateContract` whitelisted `declared` and
 *  `literals` but never `tokens`. The consequence was live, not theoretical —
 *  `examples/mui/contracts/switch.contract.json` carries
 *  `tokens["translate-y"]`, a SYNTHETIC channel invented by
 *  `decomposeTranslate` (extract/computed/lib.ts), and the React/HTML
 *  emitters wrote `translate-y: var(…)` into the stylesheet: a property no
 *  browser understands, dropped by every UA in silence. That is the same
 *  class as the `-state-checked` bug this repo thought it had closed.
 *
 *  Every channel an emitter can carry is registered HERE, with two verdicts:
 *
 *   · `canvas` — 'draw'       a native Figma field expresses it (applyTokens,
 *                             or one of the named out-of-switch lowerings:
 *                             absolutePartPlacement / insetOverlayOffsets /
 *                             boundFullBleedScrimRoot).
 *                'state-only' drawn ONLY on the state-preview plane (the
 *                             ':outline-preview' stamp — a RESTING CSS
 *                             outline paints nothing, so the base plane
 *                             deliberately does not draw it).
 *                'annotate'   the contract carries a value and the canvas has
 *                             NO field for it. `channelMiss` says so on the
 *                             component (fix 3) — declared-not-drawn, never a
 *                             silent drop.
 *   · `css`    — 'verbatim'   the channel name IS the CSS property.
 *                'canvas-only' a SYNTHETIC channel with no CSS spelling; the
 *                             code emitters refuse it BY NAME in the emitted
 *                             stylesheet instead of writing an invalid
 *                             declaration (see foldTranslateDecls).
 *
 *  An unregistered channel is REFUSED BY NAME by validateContract. Adding a
 *  channel is a deliberate act: you must say what each surface does with it.
 */
export interface TokenChannelSpec {
  canvas: "draw" | "annotate" | "state-only";
  css: "verbatim" | "canvas-only";
  /** Why this verdict — quoted into the channelMiss note / the refusal. */
  note: string;
}

const drawn = (note: string): TokenChannelSpec => ({
  canvas: "draw",
  css: "verbatim",
  note,
});
const annotated = (note: string): TokenChannelSpec => ({
  canvas: "annotate",
  css: "verbatim",
  note,
});

export const TOKEN_CHANNELS: Record<string, TokenChannelSpec> = {
  // -- paint -----------------------------------------------------------------
  background: drawn("fills[0] (the CSS shorthand colour layer)."),
  "background-color": drawn("fills[0]."),
  "background-image": drawn(
    "a parsed linear gradient appends as a GRADIENT_LINEAR paint; radial/conic/unparseable values fall to gradientMiss.",
  ),
  "box-shadow": drawn(
    "DROP_SHADOW effect / effect stack; values outside the stack grammar fall to shadowMiss.",
  ),
  color: drawn("the text node fill."),
  fill: drawn(
    "baked into the promoted glyph markup (iconSvg), like currentColor bakes the text colour.",
  ),
  // SHADCN ROUND — stroke-drawn icon sets (lucide). Carbon-class glyphs are
  // fill-drawn; lucide-class glyphs are stroke-drawn (`stroke="currentColor"
  // fill="none"` on the <svg>), so the captured icon part carries `stroke`
  // (color) and `stroke-width` (px) as computed channels. Both are DRAWN the
  // same way `fill` is: the promoted glyph markup carries them verbatim, and
  // iconSvg's currentColor→hex pass bakes the stroke paint exactly like it
  // bakes a fill paint. CSS surfaces render the properties verbatim (both are
  // real CSS properties on SVG parts).
  stroke: drawn(
    "the glyph's stroke paint — baked into the promoted glyph markup (iconSvg) via the currentColor pass; the stroke-drawn (lucide-class) counterpart of `fill`.",
  ),
  "stroke-width": drawn(
    "the glyph's stroke weight — carried verbatim in the promoted glyph markup (stroke-width attribute); CSS surfaces render the computed value.",
  ),
  opacity: drawn(
    "the node opacity (literal — Figma opacity is percent-scaled, so the 0-1 token is not bound).",
  ),
  // -- border ----------------------------------------------------------------
  "border-color": drawn("the strokes paint."),
  "border-top-color": drawn(
    "one strokes paint serves all four sides — lowered only when every carried side agrees.",
  ),
  "border-right-color": drawn(
    "one strokes paint serves all four sides — lowered only when every carried side agrees.",
  ),
  "border-bottom-color": drawn(
    "one strokes paint serves all four sides — lowered only when every carried side agrees.",
  ),
  "border-left-color": drawn(
    "one strokes paint serves all four sides — lowered only when every carried side agrees.",
  ),
  "border-width": drawn("strokeWeight."),
  "border-top-width": drawn("strokeTopWeight."),
  "border-right-width": drawn("strokeRightWeight."),
  "border-bottom-width": drawn("strokeBottomWeight."),
  "border-left-width": drawn("strokeLeftWeight."),
  "border-radius": drawn("all four corner radius fields."),
  "border-top-left-radius": drawn("topLeftRadius."),
  "border-top-right-radius": drawn("topRightRadius."),
  "border-bottom-left-radius": drawn("bottomLeftRadius."),
  "border-bottom-right-radius": drawn("bottomRightRadius."),
  // -- box -------------------------------------------------------------------
  width: drawn("a fixed width."),
  height: drawn("a fixed height."),
  "min-width": drawn("minWidth."),
  "min-height": drawn(
    "minHeight (suppressed when the same part carries height — a fixed height is the drawn design truth).",
  ),
  "max-width": drawn(
    "a root/text part bakes it as a fixed width; any other part binds the real maxWidth ceiling and hugs beneath it.",
  ),
  "padding-inline": drawn("paddingLeft + paddingRight."),
  "padding-block": drawn("paddingTop + paddingBottom."),
  "padding-left": drawn("paddingLeft."),
  "padding-right": drawn("paddingRight."),
  "padding-top": drawn("paddingTop."),
  "padding-bottom": drawn("paddingBottom."),
  gap: drawn("itemSpacing."),
  "column-gap": drawn(
    "itemSpacing on a HORIZONTAL stack; on a VERTICAL stack it is the CROSS axis and only matters under wrap — CSS-side there.",
  ),
  "row-gap": drawn(
    "itemSpacing on a VERTICAL stack; on a HORIZONTAL stack it is the CROSS axis — CSS-side there.",
  ),
  "margin-top": drawn(
    "the margin-box wrapper / sibling-gap itemSpacing lowering.",
  ),
  "margin-right": drawn(
    "the margin-box wrapper / sibling-gap itemSpacing lowering.",
  ),
  "margin-bottom": drawn(
    "the margin-box wrapper / sibling-gap itemSpacing lowering.",
  ),
  "margin-left": drawn(
    "the margin-box wrapper / sibling-gap itemSpacing lowering.",
  ),
  // -- absolute placement (lowered OUTSIDE applyTokens) ----------------------
  top: drawn(
    "absolutePartPlacement / insetOverlayOffsets / boundFullBleedScrimRoot — absolute offsets, not a switch case.",
  ),
  right: drawn(
    "absolutePartPlacement / insetOverlayOffsets / boundFullBleedScrimRoot.",
  ),
  bottom: drawn(
    "absolutePartPlacement / insetOverlayOffsets / boundFullBleedScrimRoot.",
  ),
  left: drawn(
    "absolutePartPlacement / insetOverlayOffsets / boundFullBleedScrimRoot.",
  ),
  // -- SYNTHETIC: minted by decomposeTranslate, canvas-only ------------------
  //  CSS has NO per-component translate longhand — `translate` is ONE
  //  property taking 1-3 values. The repo's own contracts condition the two
  //  components on DIFFERENT axes (MUI Switch: translate-y on the base rule,
  //  translate-x per {size}×checked), so no single-property recomposition
  //  exists that would not silently clobber the other component. The canvas
  //  lowering (absolutePartPlacement) folds them into x/y offsets, which is
  //  exactly where a per-axis-conditioned offset belongs; the code emitters
  //  refuse the declaration BY NAME in the stylesheet.
  "translate-x": {
    canvas: "draw",
    css: "canvas-only",
    note: "SYNTHETIC (decomposeTranslate) — folded into absolute x placement on canvas; CSS has no translate-x longhand.",
  },
  "translate-y": {
    canvas: "draw",
    css: "canvas-only",
    note: "SYNTHETIC (decomposeTranslate) — folded into absolute y placement on canvas; CSS has no translate-y longhand.",
  },
  // -- type ------------------------------------------------------------------
  "font-family": drawn(
    "the text node family (falls back to Inter when unavailable — named limit).",
  ),
  "font-size": drawn("fontSize."),
  "font-weight": drawn("the font STYLE name (Regular/Medium/Semi Bold/Bold)."),
  "line-height": drawn("pixel lineHeight on text nodes."),
  "letter-spacing": drawn("pixel letterSpacing on text nodes."),
  // -- outline: the OUTSIDE-aligned stroke vocabulary -------------------------
  // ROUND 9: these two stopped being state-preview-only. dump v1.11 captures
  // strokeAlign, and an OUTSIDE-aligned Figma stroke has exactly one faithful
  // CSS twin — an outline, which draws outside the border box and takes no
  // layout space (a border under box-sizing:border-box draws INWARD, and
  // growing the box to hold the ring instead was measured and falsified).
  // They draw on the canvas as an OUTSIDE stroke when carried AS A PAIR;
  // either one alone stays inert and is refused by name, because a CSS
  // outline with no width paints nothing and a width with no colour has
  // nothing to paint.
  "outline-color": {
    canvas: "draw",
    css: "verbatim",
    note: "the strokes paint of an OUTSIDE-aligned stroke — drawn only when outline-width is carried too (a resting outline with no width paints nothing in CSS, and the toned base cells must not gain a ring).",
  },
  "outline-width": {
    canvas: "draw",
    css: "verbatim",
    note: "strokeWeight of an OUTSIDE-aligned stroke — drawn only when outline-color is carried too. emit-react supplies the outline-style:solid the pair needs; without a width no outline-style is written at all.",
  },
  "outline-offset": annotated(
    "Figma strokes have no offset field — an outside-aligned stroke sits flush against the box.",
  ),
  // -- annotate: carried by the contract, NO canvas field --------------------
  "flex-basis": annotated(
    "Figma auto-layout has no flex-basis; sizing is hug/fill/fixed.",
  ),
  "flex-grow": annotated(
    "the canvas approximates growth with layoutGrow/FILL, which is a boolean, not a ratio.",
  ),
  "flex-shrink": annotated(
    "Figma auto-layout children do not shrink below their content — there is no shrink factor.",
  ),
  "grid-template-columns": annotated(
    "Figma has no grid track sizing; the canvas lowers grids to nested auto-layout stacks.",
  ),
  "grid-template-rows": annotated("Figma has no grid track sizing."),
  "grid-column-start": annotated("Figma has no grid placement."),
  "grid-row-start": annotated("Figma has no grid placement."),
  "grid-row-end": annotated("Figma has no grid placement."),
  "max-height": annotated(
    "Figma has no maxHeight field (maxWidth exists; its height twin does not).",
  ),
  "text-indent": annotated("Figma text nodes have no first-line indent."),
  "vertical-align": annotated(
    "Figma has no inline baseline alignment; auto-layout counterAxisAlignItems is the nearest, coarser, fact.",
  ),
  "z-index": annotated(
    "paint order on canvas is CHILD ORDER — a z-index a part carries independently of its DOM order has no field.",
  ),
  // FLUENT 2 ROUND — the third INDEPENDENT TRANSFORM longhand (CSS Transforms
  // Level 2: `translate`, `rotate`, `scale`). The repo already knew two of
  // them: `translate` folds into absolute placement through the synthetic
  // translate-x/translate-y channels above, and `rotate` rides the `transform`
  // grammar's rotate(<n>deg) branch for icon orientation. `scale` had no entry
  // at all, so a library that sets it quarantined the whole component.
  //
  // Fluent's DialogSurface settles its open animation at an explicit
  // `scale: 1`. That is a REAL declaration, not a reader artifact — the CSS
  // initial for `scale` is `none`, so the fusion is right to read `1` as a
  // styled fact rather than an unset default, and right to refuse to guess
  // what a canvas should do with it.
  //
  // ANNOTATE, not draw, and the distinction is the point: a Figma node's size
  // IS its box. There is no field that renders a node at a visual size other
  // than its own, so a scale factor cannot be lowered without silently
  // rewriting the box it applies to — which would make the canvas disagree
  // with the contract about how big the component is. Registered so the value
  // is CARRIED and NAMED by channelMiss (declared-not-drawn) instead of
  // quarantining the component or being dropped. `scale: 1` is the identity,
  // so nothing is lost on canvas today; a library that ships a non-identity
  // scale gets a named miss rather than a wrong box.
  scale: annotated(
    "Figma has no scale transform — a node's size IS its box, so a scale factor cannot be lowered without silently rewriting the box; the third independent-transform longhand alongside translate (folded to absolute placement) and rotate (carried by the transform grammar).",
  ),
  "row-rule-color": annotated(
    "a Chromium GAP-DECORATION longhand (CSS gap decorations) that the computed sweep enumerates for every element — nobody authored it, and neither surface paints it. Registered so it is CARRIED and NAMED rather than silently believed.",
  ),
  "column-rule-color": annotated(
    "a column-rule longhand the computed sweep enumerates; the canvas has no column rules.",
  ),
  "caret-color": annotated("the text caret is runtime UI, not canvas ink."),
  "text-decoration-color": annotated(
    "Figma textDecoration is an enum with no independent colour.",
  ),
  "text-emphasis-color": annotated("Figma has no text-emphasis marks."),
};

/** PER-INSTANCE OVERRIDE CHANNELS (round 2 iteration 9) — THE REGISTRY.
 *
 *  A component-ref part may carry `component.overrides` ONLY for these
 *  channels, and a contract root may declare `overridable` ONLY for these.
 *  Each entry names the CSS channels of the CHILD it overrides (the child's
 *  own declarations become `var(<override var>, <own binding>)` fallback
 *  chains) and the Figma fact the override is observed from — every override
 *  value is minted from OBSERVED per-occurrence data, never invented.
 *  An unregistered channel is REFUSED BY NAME by validateContract. */
export const REF_OVERRIDE_CHANNELS: Record<
  string,
  { css: string[]; note: string }
> = {
  "background-image": {
    css: ["background-image"],
    note: "per-instance IMAGE fill identity (a Figma instance carries its own imageHash — dump v1.9 imageFill observed on the instance node).",
  },
  size: {
    css: ["width", "height"],
    note: "per-instance box (a Figma instance is freely resizable — observed bbox, SQUARE boxes only: one custom property drives width and height, and any nested part binding the same refs, e.g. a stub glyph).",
  },
  "background-color": {
    css: ["background-color"],
    note: "per-instance solid paint (dump v1.7 instancePrimaryFill, fill-shaped) — stub roots declare it (their paint IS the observed instance paint); a real child owns its own paint.",
  },
  color: {
    css: ["color"],
    note: "per-instance GLYPH INK (gap-closing round 8; dump v1.7 instancePrimaryFill, stroke- or fill-shaped, observed on the nested instance node). The twin of background-color for a vector child: an exported glyph whose whole drawing is ONE ink draws `currentColor`, its own contract binds that ink as `color`, and a host that draws the same glyph in its own ink sets this channel. A glyph with two or more distinct inks is refused by the single-ink test (examples/untitled-ui/glyph-ink.mts) and never reaches this channel — one custom property cannot honestly serve two paints.",
  },
};

/** The override custom property a host sets and a child consumes —
 *  derived from the CHILD contract id, so nesting different children never
 *  crosses channels ("ds.avatar" + "size" → "--ds-avatar-size"). */
export const refOverrideVar = (contractId: string, channel: string): string =>
  `--${contractId.replace(/[^a-zA-Z0-9]+/g, "-")}-${channel}`;

/** Schema-level value guard for declared facts: never a token ref, never a
 *  CSS injection vector. The per-channel grammar refusal lives in
 *  validateContract (generator level) where messages can name the channel. */
export const DeclaredValueSchema = z
  .string()
  .regex(
    /^[^;{}!]+$/,
    'Declared value must be a plain CSS value (no token refs, no "!important", no rule injection)',
  );

/** v7 stylesWhen: the tight whitelist of literal CSS properties a
 *  conditional style may set. Deliberately NOT tokens — these are
 *  behavioral/positional properties with no token vocabulary (a color or a
 *  dimension belongs in `tokens`, and the generator refuses it here). */
export const STYLES_WHEN_ALLOWED = new Set([
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "z-index",
  "overflow",
  "text-overflow",
  "white-space",
  "display",
  "opacity",
  "pointer-events",
  "transform",
  "transition",
  "flex-direction",
  "justify-content",
  "align-items",
  "cursor",
  "text-decoration",
  // Round 2 iteration 4 (ellipse arcs): an axis-varying arc sweep rides
  // per-value conic-gradient masks — the arcMaskCss spelling, literal CSS
  // with no token vocabulary (exactly the transform/rotation precedent).
  "mask",
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
  placement: z.enum(["top", "bottom", "start", "end"]),
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
  kind: z.enum(["polygon", "ellipse", "rect"]),
  /** Polygon point count, ≥3. Figma's REGULAR_POLYGON default is 3. */
  sides: z.number().int().min(3).optional(),
  /** Intrinsic (pre-rotation) size, px. */
  width: z.number().positive(),
  height: z.number().positive(),
  /** CSS-clockwise degrees (`transform: rotate(<n>deg)`). Omit for 0. */
  rotation: z.number().optional(),
  /** ELLIPSE arc sweep (dump v1.7 `shape.arc`, round 2 iteration 4) —
   *  Figma ArcData radians: 0 at 3 o'clock, increasing clockwise on screen.
   *  Ellipse-only vocabulary. Carried when the sweep is PARTIAL (< 2π) and
   *  constant across variants — a full sweep is the plain ellipse and an
   *  axis-varying sweep rides per-value `stylesWhen` mask rules instead (the
   *  rotation discipline). Code surfaces render the sweep as a
   *  conic-gradient mask (arcMaskCss below — the ONE spelling) over the
   *  part's border-drawn ring; the Figma generator sets native arcData.
   *  innerRadius is Figma's donut-hole fraction, recorded for round-trip
   *  fidelity: at 1 (the observed class — a pure stroked ring) the
   *  border-drawn ring already leaves the hole; the proposer NAMES
   *  innerRadius < 1 (a filled donut) instead of carrying it. */
  arc: z
    .strictObject({
      start: z.number(),
      end: z.number(),
      innerRadius: z.number().min(0).max(1),
    })
    .optional(),
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
  return `polygon(${pts.join(", ")})`;
}

/** CSS conic-gradient mask for an ELLIPSE arc sweep — the ONE spelling every
 *  code surface uses (shapeCssDecls for a constant arc; the proposer's
 *  per-axis-value `stylesWhen` mask for a variant-conditioned arc). Figma arc
 *  radians (0 = 3 o'clock, clockwise on screen) convert to CSS conic degrees
 *  (0 = 12 o'clock, clockwise) by +90°. Hard color stops render butt caps —
 *  Figma's stroke cap style is not on the dump surface (named residue).
 *  Returns null for empty/full sweeps: nothing to mask. */
export function arcMaskCss(startRad: number, endRad: number): string | null {
  const deg = (r: number) => (r * 180) / Math.PI;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const sweep = r2(deg(endRad - startRad));
  if (sweep <= 0 || sweep >= 360) return null;
  const from = r2((((deg(startRad) + 90) % 360) + 360) % 360);
  return `conic-gradient(from ${from}deg, #000 0deg ${sweep}deg, transparent ${sweep}deg 360deg)`;
}

/** The shape's CSS declarations — shared by every code-side surface
 *  (emit-react, emit-html, emit-react-inline, the playground canvas
 *  preview) so the projection cannot fork. A polygon with no captured side
 *  count renders the Figma default (3) — the proposer NAMES that assumption
 *  in its notes. */
export function shapeCssDecls(shape: z.infer<typeof ShapeSchema>): string[] {
  const d = [
    `width: ${shape.width}px`,
    `height: ${shape.height}px`,
    "flex-shrink: 0",
  ];
  if (shape.kind === "polygon")
    d.push(`clip-path: ${polygonClipPath(shape.sides ?? 3)}`);
  if (shape.kind === "ellipse") d.push("border-radius: 50%");
  if (shape.kind === "ellipse" && shape.arc) {
    const mask = arcMaskCss(shape.arc.start, shape.arc.end);
    if (mask) d.push(`mask: ${mask}`);
  }
  if (shape.rotation !== undefined && shape.rotation !== 0)
    d.push(`transform: rotate(${shape.rotation}deg)`);
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
  sample: z
    .array(z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])))
    .min(1),
});

/** Conditional part visibility (schema v4, gap G1): the part renders only
 *  when the prop matches. Boolean props map to Figma visibility bindings;
 *  enum conditions resolve per variant. */
export const VisibleWhenSchema = z.strictObject({
  prop: z.string(),
  /** Omit for boolean props (truthy). A single enum value, or — when a
   *  part's canvas presence is predicted by a value SUBSET of one axis
   *  (Untitled UI field case: ButtonBase circle drawn for Icon leading/only/
   *  trailing but not dot/false) — a nonempty array meaning "any of these
   *  values" (membership, order carries no meaning). */
  equals: z.union([z.string(), z.array(z.string()).min(1)]).optional(),
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
  acceptsMode: z.enum(["prefer", "restrict", "open"]).optional(),
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
/** An applied child-prop value that is a LOOKUP of one parent enum prop
 *  (first-variant-freeze fix, Untitled UI field case: SocialButton's nested
 *  icon platform 'x(twitter)' where the parent axis value is 'x' — identity
 *  threading "{parentProp}" cannot spell it). `map` is keyed by the PARENT
 *  prop's canonical values; a parent value absent from the map applies no
 *  value (the child's own default). */
export const PropByPropSchema = z.strictObject({
  prop: z.string(),
  map: z.record(z.string(), z.string()),
});

export const ComponentRefSchema = z.strictObject({
  /** The child contract's id, e.g. "ds.avatar". */
  id: z.string(),
  /** Fixed prop values, spelled canonically; mapped through the CHILD
   *  contract's bindings on each surface. A string value of the form
   *  "{parentProp}" maps the PARENT's enum prop into the child per variant
   *  (code: `childProp={parentProp}`; Figma: resolved per variant combo).
   *  The object form (PropByPropSchema) is the same idea through a per-value
   *  LOOKUP when the child's spelling differs from the parent's. */
  props: z
    .record(z.string(), z.union([z.string(), z.boolean(), PropByPropSchema]))
    .optional(),
  /** Overrides the child's `children` text prop (code: JSX children;
   *  Figma: TEXT property override on the instance). */
  text: z.string().optional(),
  /** PER-INSTANCE OVERRIDES (round 2 iteration 9): observed per-occurrence
   *  facts of THIS usage that diverge from what the child contract renders
   *  on its own — a Figma instance can carry its own image fill, its own
   *  box, its own solid paint, and the child contract cannot know them.
   *  Keys are REF_OVERRIDE_CHANNELS entries; values are token refs (minted
   *  from the OBSERVED per-occurrence values, axis-substitutable). The
   *  react-css-modules surface carries them as custom properties set by a
   *  structural wrapper (refOverrideVar naming) that the child's own CSS
   *  consumes as var() fallback chains — the child must declare the channel
   *  in its root part's `overridable` list (refused by name otherwise).
   *  The canvas emitter ledgers overrides as channelMiss (declared-not-
   *  drawn) this round. Absent — byte-identical classic behavior. */
  overrides: z.record(z.string(), TokenRefSchema).optional(),
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
  /** A2 grid (G2): explicit cell placement — legal ONLY on a part whose
   *  PARENT declares layout.display "grid" (the part-level referee refuses
   *  everything else, including placement+overlay: P13's absolute children
   *  report bogus 0,0 anchors, so overlays never carry cells). */
  placement?: z.infer<typeof GridPlacementSchema>;
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
  /** v16 (root max-width round, task #37) — MEASURED sizing evidence, never
   *  hand-authored. TRUE when the CAPTURED element's used width stayed
   *  STRICTLY BELOW its captured `max-width` in every enumerated combo: the
   *  max-width is a CEILING the box hugs beneath, not a design width.
   *
   *  Only the `max-width` lowering reads it, and only on a ROOT. A PART has
   *  bound Figma's real `maxWidth` field since the molecule round; a ROOT was
   *  EXEMPTED from that ("golden pins those design widths") and kept baking
   *  max-width as a FIXED width. That exemption is what drew Carbon's Button
   *  320px wide with its label stranded at the left by
   *  `justify: space-between`, while the SAME Carbon button nested in Modal's
   *  footer — a part, so it got the ceiling — hugged correctly at 125px.
   *
   *  The discriminator is the measurement, not a list: width BELOW max-width
   *  means the box hugs (⇒ ceiling); width EQUAL to max-width means it is
   *  sitting at its cap and the value may be a genuine design width (⇒ the
   *  fixed-width lowering). A contract with no captured evidence omits the
   *  field and keeps the design-width lowering — which is why the repo's
   *  hand-authored `{size.card.width}` roots are untouched.
   *
   *  Emitted by extract/computed (fuse.ts `hugEvidence`); a part with no
   *  `max-width` channel must not carry it (validateContract refuses). */
  hugsBelowMaxWidth?: boolean;
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
  /** v17: per-state bindings that are ALSO a function of an enum axis, where
   *  the per-value refs are unrelated names a placeholder cannot reach (see
   *  StatesByPropSchema). Same state/channel discipline as `states`. */
  statesByProp?: Array<z.infer<typeof StatesByPropSchema>>;
  /** Text content bound to a text prop: { prop: "title" }. */
  content?: { prop: string };
  /** Static literal text (a page number, an ellipsis) — same on both
   *  surfaces, not bound to any prop. */
  text?: string;
  /** Per-enum-value text overrides merged over `text` (first-variant-freeze
   *  fix): when a drawn text node's characters vary as a pure function of
   *  ONE enum axis (ProgressBar's Percentage '0%'…'100%', SocialButton's
   *  'Sign in with <platform>'), the deviating values ride a lookup keyed on
   *  that prop's canonical values — the tokensByProp discipline applied to
   *  characters. Requires `text` (the base is the default value's text). */
  textByProp?: z.infer<typeof PropByPropSchema>;
  /** Progress fill: width = (valueProp / maxProp) as a percentage of the
   *  parent track. Code computes live; the canvas renders the defaults'
   *  fraction (its honest static state). */
  meter?: { valueProp: string; maxProp: string };
  /** CSS-side motion (spin for spinners, pulse for skeletons). Not
   *  representable on the canvas — documented fidelity scope. */
  animation?: "spin" | "pulse";
  slot?: z.infer<typeof SlotSchema>;
  component?: z.infer<typeof ComponentRefSchema>;
  /** PER-INSTANCE OVERRIDE CONSUMPTION (round 2 iteration 9, ROOT part
   *  only): the listed REF_OVERRIDE_CHANNELS this contract's own styling
   *  consumes through the override custom property (refOverrideVar) with
   *  its own bindings as the var() fallback — absent override, behavior is
   *  value-identical to the plain bindings. Declared at propose time from
   *  the same observed evidence that minted the underlying channels (an
   *  image fill is per-instance identity in Figma; a minted box is the
   *  observed box). Hosts may carry `component.overrides` only for channels
   *  declared here. */
  overridable?: string[];
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

/** A2 grid — the PART-LEVEL grid referee (G2/G4/G5), run as a superRefine on
 *  every part: the cross-child rules a field schema cannot see. Both P3
 *  canvas throws (span > track count; occupancy collision) are refused HERE,
 *  contract-side, so the compiled canvas write can never throw mid-script. */
/** G9.2 — a part that renders OUT OF FLOW under a grid parent: an `overlay`
 *  part, or one that declares `position: absolute` (the abs door the proposer
 *  uses when `grid-overlay-edge-inversion` refuses the edge spelling). P13's
 *  dump gate already skips both when capturing cells; the referee now matches
 *  the instrument instead of knowing only about `overlay`. */
export function isOutOfFlowPart(part: Part): boolean {
  if (part.overlay) return true;
  return (
    part.declared?.position === "absolute" || part.literals?.position === "absolute"
  );
}

/** G8 — is this axis of a part DEFINITE, and if so how? Returns the spelling
 *  found so the referee can name it, or undefined when the axis is silent
 *  (`grid-axis-indefinite`). `fit-content` is the intrinsic spelling and is
 *  reported separately because it is the one that fights `fr` tracks (G8.2). */
export function gridAxisSizing(
  part: Part,
  axis: "width" | "height",
): "hug" | "definite" | undefined {
  const byProp = [
    ...(part.literalsByProp ?? []),
    ...(part.tokensByProp === undefined
      ? []
      : Array.isArray(part.tokensByProp)
        ? part.tokensByProp
        : [part.tokensByProp]),
  ];
  const seen: Array<string | undefined> = [
    part.literals?.[axis],
    part.tokens?.[axis],
    ...byProp.flatMap((e) =>
      Object.values(e.map ?? {}).map((m) => (m as Record<string, string>)[axis]),
    ),
  ];
  let definite = false;
  for (const v of seen) {
    if (v === undefined) continue;
    if (v === HUG_KEYWORD) return "hug";
    definite = true;
  }
  if (definite) return "definite";
  // FILL is a definite axis too: the parent establishes the box (P11).
  if (axis === "width" && part.layout?.grow) return "definite";
  return undefined;
}

/** G8 — the definite-axis referee for ONE grid part. Called from the part's
 *  PARENT (and from the contract root) rather than from the part's own
 *  superRefine, because the exemption needs parent context: a grid part placed
 *  in a parent grid CELL already has a definite box on both surfaces (G3 —
 *  FILL on the canvas, stretch in CSS), so its own axes need no spelling. */
export function checkGridAxesDefinite(
  part: Part,
  path: Array<string | number>,
  ctx: z.core.$RefinementCtx,
): void {
  const l = part.layout;
  if (l?.display !== "grid") return;
  const hasFr = (tracks: GridTrack[] | undefined): boolean =>
    (tracks ?? []).some((t) => "fr" in t);
  // Under flow with `rows` OMITTED the emitter derives ceil(n/cols) × {fr:1},
  // so the ROW axis carries fr even though the contract spells no track.
  const rowsAreFlex = l.flow === "row" && l.rows === undefined ? true : hasFr(l.rows);
  for (const [axis, axisHasFr] of [
    ["width", hasFr(l.columns)],
    ["height", rowsAreFlex],
  ] as const) {
    const sizing = gridAxisSizing(part, axis);
    // THE BOUND (G8.1). Silence is refused exactly where `fit-content` is both
    // AVAILABLE and CORRECT: an axis whose declared tracks are all fixed or
    // content-sized has an intrinsic answer, and the two surfaces resolve
    // silence differently (canvas FIXED 100 vs CSS content). An axis carrying
    // an {fr} track is a different fact — a fraction resolves against a size
    // supplied from OUTSIDE the part, on both surfaces, so a definite box there
    // is the requirement rather than a divergence, and `fit-content` is
    // refused on it anyway (G8.2). Refusing silence there would demand a size
    // the composition, not the part, owns.
    if (sizing === undefined) {
      if (!axisHasFr) {
        ctx.addIssue({
          code: "custom",
          path: [...path, "literals", axis],
          message: GRID_REFUSALS["grid-axis-indefinite"],
        });
      }
    } else if (sizing === "hug" && axisHasFr) {
      ctx.addIssue({
        code: "custom",
        path: [...path, "literals", axis],
        message: GRID_REFUSALS["grid-hug-flex-axis"],
      });
    }
  }
}

function validateGridPart(part: Part, ctx: z.core.$RefinementCtx): void {
  const issue = (path: Array<string | number>, message: string) =>
    ctx.addIssue({ code: "custom", path, message });
  const l = part.layout;
  const children = Object.entries(part.parts ?? {});
  // G8 child sweep — runs for EVERY part, grid or not: a nested grid states
  // its own axes unless this part's grid cell already defines its box.
  {
    const areaNames = new Set(Object.keys(l?.areas ?? {}));
    for (const [name, child] of children) {
      if (child.layout?.display !== "grid") continue;
      const inCell =
        l?.display === "grid" &&
        !isOutOfFlowPart(child) &&
        (child.placement !== undefined || areaNames.has(name) || l.flow === "row");
      if (!inCell) checkGridAxesDefinite(child, ["parts", name], ctx);
    }
  }
  if (l?.display !== "grid") {
    for (const [name, child] of children) {
      if (child.placement) {
        issue(
          ["parts", name, "placement"],
          `part "${name}" carries "placement" but its parent does not declare layout.display "grid" — placement is a grid-cell fact (G2)`,
        );
      }
    }
    return;
  }
  // P10: a layout.mode change physically DESTROYS tracks on the canvas — a
  // per-variant display override reaching a grid part is refused, never
  // compiled into a destructive mode switch.
  if (part.layoutByProp) {
    issue(
      ["layoutByProp"],
      "a grid part may not carry layoutByProp — a layout.mode change is STRUCTURAL " +
        "(P10: the canvas physically destroys tracks on mode switch); per-variant grids are separate parts",
    );
  }
  const rows = l.rows?.length ?? 0;
  const cols = l.columns?.length ?? 0;
  const flow = l.flow === "row";
  const areas = l.areas ?? {};
  const inFlow = children.filter(([, c]) => !isOutOfFlowPart(c));

  for (const [name, child] of children) {
    if (isOutOfFlowPart(child) && child.placement) {
      issue(
        ["parts", name, "placement"],
        `out-of-flow part "${name}" may not carry placement — overlays and absolutely positioned ` +
          "parts keep the out-of-flow grammar (P13: absolute children even report bogus 0,0 anchors, " +
          "which readers must gate; G9.2)",
      );
    }
    if (child.layout?.grow) {
      issue(["parts", name, "layout", "grow"], GRID_REFUSALS["grid-child-grow"]);
    }
    if (child.placement && areas[name]) {
      issue(
        ["parts", name, "placement"],
        `part "${name}" is named by an area AND carries explicit placement — the area name IS the ` +
          "placement anchor; one source of truth (G4)",
      );
    }
  }
  if (flow) {
    for (const [name, child] of inFlow) {
      if (child.placement) {
        issue(
          ["parts", name, "placement"],
          `flow: "row" places by CHILD ORDER — part "${name}" may not carry placement ` +
            "(P5: setGridChildPosition is refused under auto-flow)",
        );
      }
    }
    // G5′ — declared rows are legal under flow (GP6/GP6b: ROW_AUTO_FLOW and
    // declared gridRowSizes coexist natively), but they must COVER the flow.
    // GP10 measured 5 children over 2 columns with 2 declared rows: anchors
    // reached row 2 while gridRowCount stayed 2 and gridRowSizes stayed two
    // entries — P9's lossy readback, reproduced under declared rows.
    if (l.rows !== undefined && cols > 0) {
      const needed = Math.max(1, Math.ceil(inFlow.length / cols));
      if (rows < needed) {
        issue(
          ["rows"],
          `${GRID_REFUSALS["grid-implicit-tracks"]} — flow: "row" over ${cols} column(s) with ` +
            `${inFlow.length} in-flow child(ren) needs ${needed} declared row track(s), found ${rows} (G5′)`,
        );
      }
    }
    return;
  }
  // G2: every direct child of a manual grid places explicitly (or takes an
  // area's rect), OR none may (auto-flow, G5). Mixing is schema-invalid.
  const unplaced = inFlow.filter(([n, c]) => !c.placement && !areas[n]).map(([n]) => n);
  if (unplaced.length > 0) {
    issue(
      ["parts"],
      unplaced.length < inFlow.length
        ? "manual grid: every direct child must carry placement (or take an area's), or none may " +
            `(auto-flow, G5) — mixing is schema-invalid; unplaced: ${unplaced.join(", ")}`
        : 'manual grid: no direct child carries placement — declare flow: "row" for order-placed ' +
            "grids (G5) or place every child (G2)",
    );
    return;
  }
  // Bounds + occupancy over child placements AND area rects (empty areas
  // occupy too — G4's shared-placeholder convention keeps their cells).
  const rects: Array<{ who: string; r: number; c: number; rs: number; cs: number }> = [];
  for (const [name, child] of inFlow) {
    const p = child.placement ?? areas[name];
    if (p) rects.push({ who: `part "${name}"`, r: p.row, c: p.column, rs: p.rowSpan ?? 1, cs: p.columnSpan ?? 1 });
  }
  const childNames = new Set(inFlow.map(([n]) => n));
  for (const [name, a] of Object.entries(areas)) {
    if (!childNames.has(name)) {
      rects.push({ who: `area "${name}"`, r: a.row, c: a.column, rs: a.rowSpan ?? 1, cs: a.columnSpan ?? 1 });
    }
  }
  for (const x of rects) {
    if (x.r + x.rs > rows) {
      issue(
        ["parts"],
        `${x.who}: Row span exceeds grid row count — anchor ${x.r} + span ${x.rs} > ${rows} declared ` +
          "rows (P3's exact throw class; the canvas would absorb overflow by rewriting the declaration, P9)",
      );
    }
    if (x.c + x.cs > cols) {
      issue(
        ["parts"],
        `${x.who}: Column span exceeds grid column count — anchor ${x.c} + span ${x.cs} > ${cols} ` +
          "declared columns (P3's exact throw class)",
      );
    }
  }
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      if (a.r < b.r + b.rs && b.r < a.r + a.rs && a.c < b.c + b.cs && b.c < a.c + a.cs) {
        issue(
          ["parts"],
          `${a.who} and ${b.who} overlap on the grid — placements+spans may not occupy the same cell ` +
            "(P3: the canvas throws the occupancy error mid-script; the contract refuses BEFORE emitting)",
        );
      }
    }
  }
}

export const PartSchema: z.ZodType<Part> = z.lazy(() =>
  z.strictObject({
    description: z.string().optional(),
    element: z.string().optional(),
    /** v11: named exception to the native-semantics lint (see Part). */
    roleException: z.string().optional(),
    layout: LayoutSchema.optional(),
    /** A2 grid (G2) — see the Part interface + validateGridPart. */
    placement: GridPlacementSchema.optional(),
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
    declaredStates: z
      .record(z.string(), z.record(z.string(), DeclaredValueSchema))
      .optional(),
    /** v16 (task #37): MEASURED sizing evidence — see the Part interface. */
    hugsBelowMaxWidth: z.boolean().optional(),
    /** Root: full state vocabulary. v13: non-ref parts, color-kind channels
     *  only — see the Part interface doc + emit-react validateContract. */
    states: z
      .record(z.string(), z.record(z.string(), TokenRefSchema))
      .optional(),
    /** v17 — see StatesByPropSchema. */
    statesByProp: z.array(StatesByPropSchema).min(1).optional(),
    content: z.strictObject({ prop: z.string() }).optional(),
    text: z.string().optional(),
    /** Per-enum-value text overrides merged over `text` (see Part). */
    textByProp: PropByPropSchema.optional(),
    meter: z
      .strictObject({ valueProp: z.string(), maxProp: z.string() })
      .optional(),
    animation: z.enum(["spin", "pulse"]).optional(),
    slot: SlotSchema.optional(),
    component: ComponentRefSchema.optional(),
    /** Round 2 iteration 9 (root part only — see Part). */
    overridable: z.array(z.string()).optional(),
    /** v12 (P9). */
    repeat: RepeatSchema.optional(),
    /** Icon part (v4, gap G6): renders assets/icons/<asset>.svg inline on the
     *  code side and as a vector in Figma. '{prop}' substitutes an enum prop
     *  (icon-by-status). Icons are always decorative (aria-hidden). */
    icon: z
      .strictObject({ asset: z.string(), size: z.number().optional() })
      .optional(),
    /** v4, gap G2: HTML/ARIA attributes on this part's element — literal
     *  strings or '{prop}' references. Code-side surface; Figma ignores. */
    attrs: z.record(z.string(), z.string()).optional(),
    /** v4, gap G1. */
    visibleWhen: VisibleWhenSchema.optional(),
    optional: z.boolean().optional(),
    parts: z.record(z.string(), PartSchema).optional(),
  }).superRefine(validateGridPart),
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
      aria: z.enum(["expanded", "checked", "pressed", "selected"]).optional(),
    })
    .optional(),
});

/** Optional artifact provenance. Old contracts remain valid without it.
 * Cross-field/content hash verification lives at promotion/publication
 * boundaries in core/contract-provenance.ts. */
export const ContractProvenanceSchema = z.strictObject({
  version: z.literal(1),
  canonicalRevision: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  source: z.strictObject({
    kind: z.enum(["code", "design"]),
    adapter: z.string().min(1),
    revision: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  }),
  awaitingCodeAdoption: z
    .strictObject({
      designRevision: z.string().regex(/^sha256:[0-9a-f]{64}$/),
      sourceRevision: z.string().regex(/^sha256:[0-9a-f]{64}$/),
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
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, "version must be semver (MAJOR.MINOR.PATCH)"),
  status: z.enum(["draft", "stable", "deprecated"]).default("draft"),
  description: z.string(),
  semantics: z.strictObject({
    element: z.enum([
      "button",
      "span",
      "div",
      "a",
      "input",
      "article",
      "section",
      "header",
      "footer",
      "label",
      "nav",
      "hr",
      "ul",
      "li",
      "p",
      "textarea",
      "select",
      "fieldset",
      "blockquote",
      "code",
      "kbd",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
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
  states: z.array(z.enum(CONTRACT_STATES)).default([]),
  /** How this contract manifests in Figma. 'component' (default) generates a
   *  component (set). 'native' means the concept maps to a native canvas
   *  capability (e.g. layout primitives ARE auto-layout) — no Figma component
   *  is generated and parity does not expect one; the code surface is still
   *  fully generated and checked. */
  figmaRepresentation: z.enum(["component", "native"]).optional(),
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
      contrast: z.enum(["AA", "AAA"]).optional(),
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
  /** v1 provenance is optional for backward compatibility. */
  provenance: ContractProvenanceSchema.optional(),
}).superRefine((c, ctx) => {
  // G8 — the ROOT half of the definite-axis referee. A top-level anatomy part
  // has no parent cell to define its box, so a grid root always states both
  // axes (the nested half runs from each part's own child sweep).
  for (const [name, part] of Object.entries(c.anatomy ?? {})) {
    checkGridAxesDefinite(part as Part, ["anatomy", name], ctx);
  }
});

export type Contract = z.infer<typeof ContractSchema>;
export type ContractProvenance = z.infer<typeof ContractProvenanceSchema>;
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
  display?: "flex" | "inline-flex" | "grid";
  direction?: "row" | "column" | "row-reverse" | "column-reverse";
  align?: "start" | "center" | "end" | "stretch" | "baseline";
  justify?: "start" | "center" | "end" | "space-between";
  grow?: boolean;
  overlap?: boolean;
  /** v15: flex-wrap: wrap (Figma layoutWrap 'WRAP'). */
  wrap?: boolean;
  /** A2 grid (G1/G4/G5) — present only when display is "grid". layoutByProp
   *  can never override these (validateGridPart refuses layoutByProp on grid
   *  parts — P10 mode-switch destruction), so the base layout's grid facts
   *  always survive resolution unchanged. */
  rows?: GridTrack[];
  columns?: GridTrack[];
  gap?: { row: number | string; column: number | string };
  areas?: Record<string, GridArea>;
  flow?: "row";
}

export function resolveLayout(
  part: Part,
  subst: Record<string, string>,
): ResolvedLayout | undefined {
  const base = part.layout as ResolvedLayout | undefined;
  const byProp = part.layoutByProp;
  const override = byProp ? byProp.map[subst[byProp.prop] ?? ""] : undefined;
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
export function resolveTokens(
  part: Part,
  subst: Record<string, string>,
): Record<string, string> {
  let out = part.tokens ?? {};
  // v14: entries merge IN ORDER — later entries win per channel (the CSS
  // source-order cascade the values were extracted from). An axis with no
  // value in `subst` contributes nothing (a defaultless enum prop left unset
  // applies no override — the same rule the React surface renders live).
  for (const entry of tokensByPropEntries(part)) {
    const override = entry.map[subst[entry.prop] ?? ""];
    if (override) out = { ...out, ...override };
  }
  return out;
}

/** v14: normalize the single-or-array tokensByProp field to an ordered list.
 *  The ONE reader every surface goes through — the single-object spelling
 *  and the array spelling cannot diverge. */
export function tokensByPropEntries(
  part: Part,
): Array<z.infer<typeof TokensByPropSchema>> {
  const tbp = part.tokensByProp;
  if (!tbp) return [];
  return Array.isArray(tbp) ? tbp : [tbp];
}

/** v14: the literal record a part carries under one concrete variant combo —
 *  literalsByProp overrides merged over `literals`, resolveTokens semantics. */
export function resolveLiterals(
  part: Part,
  subst: Record<string, string>,
): Record<string, string> {
  let out = part.literals ?? {};
  for (const entry of part.literalsByProp ?? []) {
    const override = entry.map[subst[entry.prop] ?? ""];
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
    part.element === "input" &&
    (part.attrs?.type === "checkbox" || part.attrs?.type === "radio")
  );
}

/** HTML VOID elements — no closing tag, no children, EVER. React refuses
 *  children inside one at MOUNT, at runtime ("<input> is a void element tag
 *  and must neither have children nor use dangerouslySetInnerHTML"), so a
 *  contract that mounts anatomy children inside a void element renders
 *  NOTHING and no build step ever says why (Eventz field case, 2026-08:
 *  Atoms/Checkbox and Atoms/Input inferred `semantics.element: "input"` over
 *  drawn children — every one of their 10 default-plane fidelity rows painted
 *  nothing). ONE shared spelling so both ends of the pipe agree:
 *    · validateContract (core/emit-react.ts) refuses the shape BY NAME on
 *      every emit surface (react / html / react-inline / figma-script);
 *    · proposeFromDump (core/propose-figma.ts) demotes a void element
 *      inference to a container root with a REVIEW note, so a proposal can
 *      never carry the shape the emitters refuse.
 *  A void element with NO mounted children stays legal — that is
 *  ds.divider's <hr> exactly. */
export const VOID_ELEMENTS: ReadonlySet<string> = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

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
  for (const [name, part] of Object.entries(contract.anatomy))
    visit(name, part, [name]);
  return out;
}

export const slotsOf = (contract: Contract) =>
  walkAnatomy(contract)
    .filter((w) => w.part.slot)
    .map((w) => ({ ...w, slot: w.part.slot! }));

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
export const STATE_PREVIEW_PROPERTY = "State";
/** The axis value carried by every base (non-preview) variant. */
export const STATE_PREVIEW_DEFAULT = "Default";
/** Canonical state → axis value: "hover" → "Hover", "focus-visible" →
 *  "Focus Visible". Deterministic — the differ recomputes the same labels. */
export const statePreviewLabel = (state: string) =>
  state.split("-").map(pascal).join(" ");

// --- base ↔ preview variant NAME pairing -----------------------------------
// ONE rule, one place. The Figma generator builds preview names with it, the
// canvas-gate compiler re-derives them (and THROWS on drift), and the
// prototype-wiring round pairs a State=Default variant with its State=Hover /
// State=Active twin with it. The State= segment is ALWAYS emitted last and
// its values never contain a comma (statePreviewLabel joins with spaces), so
// the split is unambiguous.

/** Append (or replace) the trailing `State=<label>` segment on a variant
 *  name. An empty axis part yields a name that is only the State segment —
 *  the same rule the emitted runtime's `withStateAxis` applies. */
export function withStateSegment(axisPart: string, label: string): string {
  return axisPart
    ? `${axisPart}, ${STATE_PREVIEW_PROPERTY}=${label}`
    : `${STATE_PREVIEW_PROPERTY}=${label}`;
}

/** Split a variant name into its axis segments and its State= value.
 *  `state` is null when the name carries no State segment (a set that does
 *  not opt into previews). */
export function splitStateSegment(variantName: string): {
  axisPart: string;
  state: string | null;
} {
  const m = /^(.*?)(?:, )?State=([^,]*)$/.exec(variantName);
  if (!m) return { axisPart: variantName, state: null };
  return { axisPart: m[1], state: m[2] };
}

/** The name of the BASE (State=Default) twin of a preview variant — the
 *  reaction's source. Returns null for a name that is not a preview variant
 *  (no State segment, or already State=Default): those are destinations of
 *  nothing and sources of nothing. */
export function baseTwinName(previewVariantName: string): string | null {
  const { axisPart, state } = splitStateSegment(previewVariantName);
  if (state === null || state === STATE_PREVIEW_DEFAULT) return null;
  return withStateSegment(axisPart, STATE_PREVIEW_DEFAULT);
}

/** The prop names an opted-in contract's root state overrides substitute
 *  (e.g. "{color.action.{variant}.background-hover}" → "variant"). The
 *  single member (validation refuses more) names the PRIMARY enum axis that
 *  state previews multiply; empty means the overrides are variant-independent
 *  and previews attach to the first enum axis. */
export function statePreviewSubstProps(contract: Contract): string[] {
  const enumNames = new Set(
    contract.props
      .filter((p) => typeof p.type === "object" && "enum" in p.type)
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

export const slotFigmaProperty = (slot: Slot) =>
  slot.figmaProperty ?? pascal(slot.name);
export const slotVisibilityProperty = (slot: Slot) =>
  `Show ${slotFigmaProperty(slot)}`;

/** Topologically sort contracts by composition dependencies; throws on
 *  cycles and unknown references — invalid states are refused, not rendered. */
export function sortByDependencies(contracts: Contract[]): Contract[] {
  const byId = new Map(contracts.map((c) => [c.id, c]));
  const sorted: Contract[] = [];
  const state = new Map<string, "visiting" | "done">();
  /** G10: which ids are on the current chain because of an `accepts` edge —
   *  so a cycle closed by one refuses under its own name. */
  const viaAccepts = new Set<string>();
  const visit = (c: Contract, chain: string[]) => {
    if (state.get(c.id) === "done") return;
    if (state.get(c.id) === "visiting") {
      const path = [...chain, c.id].join(" → ");
      throw new Error(
        viaAccepts.has(c.id)
          ? `${GRID_REFUSALS["slot-accepts-cycle"]} — cycle: ${path}`
          : `Circular contract dependency: ${path}`,
      );
    }
    state.set(c.id, "visiting");
    for (const { ref } of componentRefsOf(c)) {
      const dep = byId.get(ref.id);
      if (!dep)
        throw new Error(`${c.id}: references unknown contract "${ref.id}"`);
      visit(dep, [...chain, c.id]);
    }
    for (const { slot } of slotsOf(c)) {
      for (const acceptedId of slot.accepts ?? []) {
        const dep = byId.get(acceptedId);
        if (!dep) {
          throw new Error(
            `${c.id}: slot "${slot.name}" accepts unknown contract "${acceptedId}"`,
          );
        }
        // G10 — THE `accepts` ORDERING PROPERTY, stated. `accepts` induces a
        // directed edge referenced → referencing over the emitted set, and the
        // emission runs in topological order of that graph: the canvas slot's
        // preferred values resolve through the accepted component's KEY, so it
        // must exist first. (Found by the 2026-07-06 fresh-file rebuild —
        // masked in the original file, where every component already existed.)
        // Runtime-side, an entry pointing OUTSIDE the emitted subset is a named
        // DEFERRAL (`slot-accepts-deferred`, emit-figma-script slotPreferredValues),
        // never a throw — preferredValues is a picker hint and refuses nothing.
        viaAccepts.add(acceptedId);
        visit(dep, [...chain, c.id]);
      }
      for (const item of slot.defaultContent ?? []) {
        const dep = byId.get(item.id);
        if (!dep) {
          throw new Error(
            `${c.id}: slot "${slot.name}" defaultContent references unknown contract "${item.id}"`,
          );
        }
        if (
          slot.accepts &&
          slot.accepts.length > 0 &&
          !slot.accepts.includes(item.id)
        ) {
          throw new Error(
            `${c.id}: slot "${slot.name}" defaultContent includes "${item.id}" which is not in accepts`,
          );
        }
        visit(dep, [...chain, c.id]);
      }
    }
    state.set(c.id, "done");
    sorted.push(c);
  };
  for (const c of contracts) visit(c, []);
  return sorted;
}
