/**
 * Design-side node-tree dump format (dump v1) — the shapes produced by
 * extract/figma/dump.plugin.js and consumed by extract/figma/propose.ts.
 *
 * This is the ANATOMY-BEARING counterpart of extract/figma-dump.js (which
 * reads only the API surface). A dump is a per-component-set tree of the
 * canvas facts the extractor can invert: auto-layout geometry, variable
 * bindings, paints, text, and component-property references. Everything the
 * extractor cannot see is a declared fidelity limit, not a guess — see the
 * classification rules in roundtrip.ts.
 *
 * Fixture ground truth: extract/figma/fixtures/main-file-dumps.json (live
 * dumps of the contract-generated Badge / Switch / Card sets).
 */

/** One declared grid track (dump v1.17) — the NORMALIZED spelling shared by
 *  both producers (the plugin dump reads the structured
 *  gridRowSizes/gridColumnSizes arrays, the REST mapper parses the CSS-string
 *  gridRowsSizing/gridColumnsSizing) and by the contract grammar
 *  (GridTrackSchema): exactly one of {px}, {fr}, {fit: true}. Values are
 *  captured VERBATIM (fractional ok — P2b: 33.5px / 2.5fr carried exactly);
 *  the proposer, not the capture, refuses invalid values by name. */
export interface DumpGridTrack {
  px?: number;
  fr?: number;
  fit?: true;
}

/** GRID layout facts (dump v1.17, additive — the A2 layout grammar's
 *  design-side capture; docs/research/grid-recon-probes.md P1–P14).
 *  Declared-track grids only: tracks, the independent gap pair, and the one
 *  bounded auto-flow. Absence on a `mode: 'GRID'` layout means the producer
 *  predates v1.17 — NOT an empty grid; consumers refuse by name. */
export interface DumpGrid {
  rows: DumpGridTrack[];
  columns: DumpGridTrack[];
  /** Literal gridRowGap / gridColumnGap (px) — INDEPENDENT facts (P2).
   *  Bound gap variables ride `bound.gridRowGap` / `bound.gridColumnGap`. */
  rowGap: number;
  columnGap: number;
  /** gridItemsPositioning === 'ROW_AUTO_FLOW' → 'row' (P5: the enum is
   *  exactly MANUAL | ROW_AUTO_FLOW — no column, no dense). Absent = MANUAL.
   *  Under auto-flow the placement fact is CHILD ORDER, so children carry no
   *  `cell` (P5: position setters are refused there). */
  flow?: 'row';
}

/** Auto-layout facts, as the Plugin API spells them. */
export interface DumpLayout {
  /** dump v1.17: 'GRID' joins the flex modes. A GRID layout carries `grid`
   *  and OMITS the flex-era `primary`/`counter`/`spacing` fields — they read
   *  as inert defaults on GRID frames and would be invented facts. */
  mode: 'HORIZONTAL' | 'VERTICAL' | 'GRID';
  /** Absent exactly when mode is 'GRID' (dump v1.17). */
  primary?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  /** Absent exactly when mode is 'GRID' (dump v1.17). */
  counter?: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
  /** Literal itemSpacing (px). The bound variable, if any, is in
   *  `bound.itemSpacing`. Absent exactly when mode is 'GRID' (dump v1.17). */
  spacing?: number;
  /** Literal padding in CSS order: [top, right, bottom, left]. */
  padding: [number, number, number, number];
  /** dump v1.12: layoutWrap === 'WRAP'. Absent means a single line. */
  wrap?: true;
  /** dump v1.12: counterAxisSpacing, captured ONLY when it differs from
   *  `spacing` — Figma leaves it null to follow itemSpacing, which is exactly
   *  what a single CSS `gap` already says. */
  rowSpacing?: number;
  primarySizing: 'FIXED' | 'AUTO';
  counterSizing: 'FIXED' | 'AUTO';
  /** GRID facts (dump v1.17) — present exactly when mode is 'GRID' and the
   *  producer captures grid (see DumpGrid). */
  grid?: DumpGrid;
}

/** A solid paint: bound to a variable (`var`, slash-form name) or raw (`hex`). */
export interface DumpPaint {
  var?: string;
  hex?: string;
  /** Effective paint opacity 0–1 (color alpha × paint opacity), dump v1.1,
   *  additive — OMITTED when 1. Field case: Eventz secondary/bare fills are
   *  black at 5% opacity; dump v1 dropped it and every consumer rendered
   *  opaque black. Absence in older dumps means opaque, a declared limit. */
  alpha?: number;
}

/** A LINEAR gradient fill (dump v1.16, additive) — captured when the node's
 *  first visible fill is GRADIENT_LINEAR (the Eventz field case: Badge
 *  accent/info/warning/featured and Alert grounds, refused wholesale by dump
 *  ≤ v1.15's solid-only projection and scored as unpainted ground).
 *  Handles are NORMALIZED OBJECT SPACE points: `start` maps to ramp position
 *  0 and `end` to ramp position 1 — the REST surface's
 *  gradientHandlePositions[0]/[1] verbatim; the plugin producer inverts
 *  gradientTransform to the same two points (the transform maps object space
 *  → gradient space, so the handles are its inverse applied to (0, 0.5) and
 *  (1, 0.5)). Stops carry the RESOLVED color (+ the bound variable's
 *  slash-form name when the stop rides one — REST cannot name it, a plugin
 *  capture can). RADIAL/ANGULAR/DIAMOND gradients remain paint-unsupported
 *  degradation receipts — absence of this field on older dumps means NOT
 *  CAPTURED, never "no gradient". */
export interface DumpGradient {
  start: { x: number; y: number };
  end: { x: number; y: number };
  stops: Array<{ position: number; hex: string; alpha?: number; var?: string }>;
  /** Effective paint opacity 0–1 — OMITTED when 1 (the DumpPaint.alpha rule). */
  alpha?: number;
}

export interface DumpText {
  characters: string;
  fontSize: number;
  /** Inter style name ('Medium', 'Semi Bold', …) — the canvas projection of a
   *  font-weight token through FONT_STYLE_BY_WEIGHT. */
  fontStyle: string;
  /** Line height in PX (dump v1.3, additive) — captured ONLY when the canvas
   *  spells it in PIXELS (REST lineHeightUnit 'PIXELS' / Plugin lineHeight
   *  unit 'PIXELS'). PERCENT/AUTO units stay named degradation receipts
   *  (text-channel-unsupported). Absence in older dumps means not captured.
   *  Field case: CBDS Tooltip rides 16px line height on 12px text — dropping
   *  it distorts the text block's proportions. */
  lineHeight?: number;
  /** Name of the named TextStyle the node rides, when it rides one — derived
   *  styles mirror semantic size-token paths ('badge' ← font.badge.size,
   *  'control/sm' ← font.control.size.sm), so this is a token identity. */
  style?: string;
  /** Published TextStyle key when available (dump v1.15, additive). Local
   *  styles may have no portable key; their exact name remains the identity. */
  styleKey?: string;
  /** Variable bound to `fontSize`, slash-form (dump v1.19, additive) — the
   *  size token's identity on a node that rides NO named style. A style and
   *  this field are mutually exclusive by construction: Figma clears
   *  textStyleId on any fontName write, so a node whose contract overrides
   *  the style group's weight keeps its size token here instead. Absence in
   *  older dumps means not captured, never "no size token". */
  fontSizeVar?: string;
  /** Variable behind the text fill (slash-form), when bound. */
  fillVar?: string;
  /** Non-ORIGINAL text case (dump v1.16, additive) — the canvas fact behind
   *  CSS text-transform (UPPER→uppercase, LOWER→lowercase, TITLE→capitalize).
   *  Absence in older dumps means not captured (their captures receipted the
   *  channel as text-channel-unsupported), never "as typed". Field case:
   *  Eventz Badge labels ride textCase UPPER and rendered "Label" for
   *  "LABEL". */
  textCase?: 'UPPER' | 'LOWER' | 'TITLE';
}

/** One visible effect (dump v1.2, additive). Shadows carry their full
 *  geometry + color; blur types carry the type (and radius) only — enough
 *  for propose.ts to NAME the gap instead of losing the channel silently. */
export interface DumpEffect {
  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR' | string;
  /** Shadow color (shadow types only) — same {hex, alpha} shape as paints. */
  color?: { hex: string; alpha?: number };
  offset?: { x: number; y: number };
  radius?: number;
  /** Omitted when 0. */
  spread?: number;
}

/** Decor-shape geometry (dump v1.3, additive) — captured for the closed set
 *  of parametric vector nodes the pipeline can carry faithfully:
 *  REGULAR_POLYGON, ELLIPSE, and rotated RECTANGLE (#42). Arbitrary-path
 *  vectors (VECTOR / STAR / LINE / BOOLEAN_OPERATION) remain named
 *  degradation receipts — their geometry is not parametric.
 *  Field case: the CBDS Tooltip "Pointer" triangle (12×12 REGULAR_POLYGON,
 *  rotated per placement, absolutely positioned against the bubble). */
export interface DumpShape {
  /** Since dump v1.7 an UNROTATED RECTANGLE is also captured when nothing
   *  else carries its size — parent not auto-layout, or the node is
   *  ABSOLUTE (field case: Untitled UI slider/progress tracks, which
   *  collapsed to 0×0 with only fill+radius surviving). Inside auto-layout
   *  an unrotated rect still returns no shape (existing channels carry it). */
  kind: 'polygon' | 'ellipse' | 'rect';
  /** Polygon point count (Plugin API pointCount). The REST surface does not
   *  expose it — ABSENT means not captured; the proposer assumes the Figma
   *  default of 3 with a named review note, never silently. */
  sides?: number;
  /** Intrinsic (pre-rotation) size, px. REST exposes only the post-rotation
   *  bounding box; for quarter-turn rotations the intrinsic size is derived
   *  exactly (±90° swaps the axes). Non-quarter-turn rotations approximate
   *  by the bounding box, NAMED in a degradation receipt. */
  width: number;
  height: number;
  /** ELLIPSE arc geometry (dump v1.7, additive) — captured when the drawn
   *  ellipse is not a full disc (partial sweep) or is a donut
   *  (innerRadius > 0). Angles are the Plugin API's RADIANS, verbatim.
   *  NOT yet consumed by the proposer (a planned iteration renders arcs);
   *  presence is ledgered by name, never a throw. */
  arc?: { start: number; end: number; innerRadius: number };
  /** CSS-clockwise degrees: `transform: rotate(<n>deg)` reproduces the
   *  canvas rendering. The REST `rotation` field rides RADIANS with the same
   *  visual sign (verified against absoluteRenderBounds of the CBDS Tooltip
   *  pointers); the Plugin API's degrees are counterclockwise → negated.
   *  Omitted when 0. */
  rotation?: number;
  /** Placement within the PARENT box (px), captured only for out-of-flow
   *  nodes (layoutPositioning ABSOLUTE): offsets of the intrinsic box's
   *  top-left from the parent's top-left (x, y) and the mirror distances to
   *  the parent's right/bottom edges — spelled so that rotating the
   *  intrinsic box about its center reproduces the captured bounding box. */
  x?: number;
  y?: number;
  right?: number;
  bottom?: number;
  /** Figma constraints (REST spelling: LEFT|RIGHT|CENTER / TOP|BOTTOM|CENTER)
   *  — how the placement generalizes when the parent resizes; the proposer
   *  picks which offset spelling to carry from these. */
  constraints?: { horizontal: string; vertical: string };
}

export interface DumpNode {
  name: string;
  /** Node type. 'SLOT' (dump v1.5): a NATIVE Figma slot node (Schema 2025) —
   *  captured verbatim where the API exposes it; propose.ts maps it to the
   *  same contract `slot` part the INSTANCE_SWAP spelling maps to, with a
   *  named provenance note (regeneration should reproduce the spelling). */
  type: 'COMPONENT' | 'FRAME' | 'TEXT' | 'INSTANCE' | 'SLOT' | string;
  /** dump v1.14: authoritative realized VARIANT values for a direct child of
   *  a COMPONENT_SET. Keys are preserved verbatim from Figma's component
   *  property API; consumers must not reconstruct this tuple from `name`.
   *  Absence means legacy/not captured, never an empty tuple. */
  variantProperties?: Record<string, string>;
  layout?: DumpLayout;
  /** Literal corner radius when uniform and nonzero. Bound radii are in `bound`. */
  cornerRadius?: number;
  /** Bound variables: Plugin-API field name → variable name (slash-form),
   *  e.g. { paddingLeft: 'space/inset-x/sm', width: 'size/switch/width' }. */
  bound?: Record<string, string>;
  fill?: DumpPaint;
  /** First visible GRADIENT_LINEAR fill (dump v1.16, additive — see
   *  DumpGradient). Carried ALONE, or alongside `fill` when a visible SOLID
   *  sits BELOW it in the paint stack (Figma paints draw bottom-to-top, so
   *  that pair is exactly CSS background-color under background-image). A
   *  gradient hidden under a solid keeps the truncation receipt instead.
   *  Absence in older dumps means not captured, never "no gradient". */
  gradient?: DumpGradient;
  stroke?: DumpPaint;
  strokeWeight?: number;
  /** Where the stroke weight is drawn relative to the node box (dump v1.11,
   *  additive). Captured on EVERY stroke, INSIDE included — an ABSENT field
   *  means "not captured" (dump ≤ v1.10), which is NOT the same fact as
   *  INSIDE and must not be read as one; that conflation is what let
   *  Untitled UI's OUTSIDE Avatar focus ring lower to an inward CSS border
   *  for eight rounds. OUTSIDE inverts to the outline vocabulary, INSIDE to
   *  border, CENTER is refused BY NAME (stroke-align-unsupported). */
  strokeAlign?: 'INSIDE' | 'CENTER' | 'OUTSIDE';
  /** Literal min/max sizing in px (dump v1.4, additive) — carried as
   *  min-width/min-height/max-width/max-height style facts (a drawn
   *  minHeight 44 is a tap-target fact). Bound min/max variables ride
   *  `bound` instead. Absence in older dumps means not captured (their
   *  captures receipted the channel as min-max-size-unsupported). */
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  /** layoutSizingHorizontal === 'FILL' — the canvas projection of both
   *  `layout.grow` (in a row parent) and `align: stretch` (on children of a
   *  column parent); propose.ts disambiguates by parent direction. */
  fillWidth?: boolean;
  /** visible === false on the node (dump v1.1, additive). Positive evidence
   *  only: a visibility-bound part hidden in the default variant recovers a
   *  boolean-prop default of false. Absence means visible (REST mapper) or
   *  not captured (dump v1 fixtures) — never inverted into `true`. */
  hidden?: boolean;
  /** NODE opacity 0–1 (dump v1.2, additive) — OMITTED when 1. Distinct from
   *  paint alpha: Eventz disables whole variants with `opacity: 0.4` on the
   *  variant ROOT while the paints stay byte-identical to enabled; dump v1.1
   *  dropped the channel and every surface rendered disabled at full ink.
   *  Absence in older dumps means opaque, a declared limit. */
  opacity?: number;
  /** VISIBLE effects (dump v1.2, additive) — omitted when none. A single
   *  DROP_SHADOW mints as a box-shadow value; everything else is a NAMED
   *  proposal note. Absence in older dumps means not captured. */
  effects?: DumpEffect[];
  /** Decor-shape geometry (dump v1.3, additive — see DumpShape). Absence in
   *  older dumps means not captured, never "no shape". */
  shape?: DumpShape;
  /** ABSOLUTE placement for ALL node types (dump v1.7, additive) — the
   *  center-preserving spelling DumpShape placement uses, captured when the
   *  node is layoutPositioning ABSOLUTE or its parent is not auto-layout
   *  (where every child is placed by x/y). NOT yet consumed by the proposer
   *  (overlay rendering is a planned iteration); presence is ledgered by
   *  name, never a throw. Absence in older dumps means not captured. */
  abs?: {
    x: number;
    y: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
    constraints?: { horizontal: string; vertical: string };
  };
  /** Fixed drawn size of an IN-FLOW box no other channel carries (dump v1.8,
   *  additive): an in-flow child of an AUTO-layout parent that is NOT itself
   *  auto-layout gets no `layout` (needs auto-layout), no `abs` (needs
   *  ABSOLUTE or a non-auto parent), no `shape` (parametric decor only) and
   *  no `bbox` (COMPONENT roots / INSTANCE stubs) — yet its drawn box is a
   *  hard fact when layoutSizing is FIXED. Values come from
   *  absoluteBoundingBox (the DRAWN box — rotation-safe; UUI's tooltip arrow
   *  strip draws 6×16 from a 90°-rotated 16×6 frame). Per-axis: only FIXED
   *  axes carry (a rotated box carries only when BOTH axes are FIXED).
   *  Absence in older dumps means not captured, never "no size". */
  fixedSize?: { width?: number; height?: number };
  /** First visible SOLID fill found in an INSTANCE's subtree (dump v1.7,
   *  additive) — the stub-paint channel: a child stub with observed geometry
   *  but no paint rendered invisible (field case: Untitled UI Badge's _Dot,
   *  hex 9e77ed). Same {var|hex, alpha?} shape as paints; the node's OWN
   *  `fill` (when present) still wins downstream. Stroke-aware (additive):
   *  when NO subtree node carries a visible SOLID fill (line icons draw
   *  with strokes only — field case: Untitled UI Button's leading circle
   *  icon), the first visible SOLID stroke carries instead, flagged
   *  `{ stroke: true, weight }` so consumers render a border, never a
   *  background; a CIRCULAR stroke source (ELLIPSE node, or a VECTOR whose
   *  network is a pure ring) adds `ellipse: true` — the observed fact that
   *  makes a circular border-radius DERIVABLE (corner radius inside an
   *  instance is otherwise uncaptured) — plus, when the source is verified
   *  CENTERED in the instance, `src` (the source node's own box, px) and
   *  `align` (its strokeAlign) so the ring can render at the DRAWN radius.
   *  Absence in older dumps means not captured, never "no paint". */
  instancePrimaryFill?: DumpPaint & { stroke?: boolean; weight?: number; ellipse?: boolean; src?: number; align?: string };
  /** The node's first visible fill is an IMAGE paint (dump v1.7, additive).
   *  dump v1.9: the STRING form carries the paint's imageHash — the exported
   *  asset's name (<hash>.png, exported by the bridge alongside the dump);
   *  boolean true (v1.7/v1.8 dumps, or a hashless paint) means captured BY
   *  NAME with no exported bytes — consumers render the documented
   *  placeholder gradient. Absence means no image fill or not captured. */
  imageFill?: boolean | string;
  text?: DumpText;
  /** componentPropertyReferences, property-id suffixes stripped:
   *  characters → TEXT property, mainComponent → INSTANCE_SWAP property,
   *  visible → BOOLEAN property (the "Show X" optional-part convention). */
  propRefs?: Record<string, string>;
  /** For SLOT nodes (dump v1.18, additive): the UNSTRIPPED slotContentId —
   *  the SLOT property's id. Slot identity IS the id (instance content is
   *  stored against it, live probe 2d), so two same-named slots are only
   *  distinguishable here. Absence means an older dump, never "unbound". */
  slotKey?: string;
  /** For INSTANCE nodes: the main component's owning set/component name. */
  instanceOf?: string;
  /** For INSTANCE nodes (dump v1.5, additive): the main COMPONENT's publish
   *  key. Identity that survives renames — the session-linking resolver
   *  matches it against in-scope contracts' anchors. Absence in older dumps
   *  means not captured, never "no key". */
  instanceKey?: string;
  /** For INSTANCE nodes (dump v1.5, additive): the main component's OWNING
   *  COMPONENT_SET publish key (absent when the main component is not in a
   *  set). Matches contracts' anchors.figma.componentSetKey — checked FIRST
   *  by the resolver; instanceKey is the fallback for setless components. */
  instanceSetKey?: string;
  /** OBSERVED bounding box (dump v1.5, additive; post-layout width/height,
   *  px) on two node classes:
   *  · INSTANCE nodes — dump v1 stops at instance boundaries by design;
   *    this is the honest OBSERVED geometry a child STUB renders (a
   *    correctly-sized box, never invented anatomy).
   *  · variant ROOT (COMPONENT) nodes — when a root axis is drawn FIXED
   *    (primary/counterSizing), the drawn dimension is otherwise
   *    unrecoverable (field case: the CBDS Dialog's per-size fixed widths —
   *    without them the body text never wraps and every variant renders
   *    hundreds of px too wide).
   *  Absence in older dumps means not captured. */
  bbox?: { width: number; height: number };
  /** For INSTANCE nodes: applied component property values (dump v1.1,
   *  additive — the shipped fixtures predate it; propose.ts treats absence
   *  as a declared fidelity limit and never invents the values).
   *  KEYS (dump v1.5): keep their "#id" suffix, the Plugin API's own
   *  spelling — a suffixed string key is a TEXT property with certainty
   *  (promoteBaseInstanceCaptures' rule); v1.1–v1.4 producers stripped the
   *  suffix, so bare string keys stay VARIANT/TEXT-ambiguous. Consumers
   *  split on '#' for the property NAME either way. */
  componentProperties?: Record<string, string | boolean>;
  /** For INSTANCE nodes (dump v1.10): the characters this HOST set on the
   *  instance's text descendants, keyed by the overridden node's NAME PATH
   *  inside the instance ("Content/Text"). Source: InstanceNode.overrides
   *  filtered to 'characters' — Figma's own record, not a computed diff.
   *  The channel exists because a child component with NO TEXT property has
   *  nowhere else to carry a per-usage label: `componentProperties` is empty
   *  of it by construction. Absence = no override observed (or a pre-v1.10
   *  producer); consumers never invent text from it. */
  textOverrides?: Record<string, string>;
  /** GRID-cell placement (dump v1.17, additive) — captured on every IN-FLOW
   *  child of a MANUAL GRID parent: 0-based anchors
   *  (gridRowAnchorIndex/gridColumnAnchorIndex — read-only getters, P3),
   *  spans only when > 1 (gridRowSpan/gridColumnSpan), aligns only when not
   *  AUTO (gridChildHorizontalAlign/gridChildVerticalAlign — the API's own
   *  MIN | CENTER | MAX spelling; P3/P4: STRETCH and BASELINE do not exist).
   *  GATED on layoutPositioning !== 'ABSOLUTE' (P13 quirk: absolute children
   *  still report anchors 0,0 — reading them would invent a placement).
   *  Absent under ROW_AUTO_FLOW (placement fact = child order, P5) and on
   *  pre-v1.17 dumps (not captured, never "cell 0,0"). */
  cell?: {
    row: number;
    column: number;
    rowSpan?: number;
    columnSpan?: number;
    alignX?: 'MIN' | 'CENTER' | 'MAX';
    alignY?: 'MIN' | 'CENTER' | 'MAX';
  };
  children?: DumpNode[];
}

/** One INSTANCE_SWAP preferred value (dump v1.5) — the component (or set)
 *  publish key the design names as preferred slot content. Keys resolve
 *  through in-scope contracts' anchors (componentSetKey / component key) into
 *  slot `accepts`; unresolvable keys stay NAMED notes, never guessed ids. */
export interface DumpPreferredValue {
  type: 'COMPONENT' | 'COMPONENT_SET' | string;
  key: string;
}

/** dump v1.14: the full set-level component property definition. Property
 *  keys are preserved verbatim, including Figma's `#…` identity suffixes.
 *  Keeping the discriminated shape lets exact-projection validation compare
 *  the authoritative axis inventory against every realized row before any
 *  name normalization or semantic state/theme promotion occurs. */
export type DumpPropertyDefinition =
  | {
      type: 'VARIANT';
      defaultValue: string;
      variantOptions: string[];
    }
  | {
      type: 'BOOLEAN';
      defaultValue: boolean;
    }
  | {
      type: 'TEXT';
      defaultValue: string;
    }
  | {
      type: 'INSTANCE_SWAP';
      defaultValue: string;
      preferredValues?: DumpPreferredValue[];
    }
  | {
      type: 'SLOT';
      defaultValue: string;
      preferredValues?: DumpPreferredValue[];
      description?: string;
      slotSettings?: Record<string, unknown>;
    };

export interface DumpSet {
  setName: string;
  type: 'COMPONENT_SET' | 'COMPONENT';
  /** Set-level anchors (dump v1.1, additive). */
  nodeId?: string;
  key?: string;
  /** Full, verbatim component-property definitions (dump v1.14, additive).
   *  New exact consumers prefer this field. Absence means the producer did
   *  not capture structured metadata, so exactness is unverified. */
  propertyDefinitions?: Record<string, DumpPropertyDefinition>;
  /** INSTANCE_SWAP property definitions' preferredValues (dump v1.5,
   *  additive), keyed by property name with the "#id" suffix stripped —
   *  the same spelling propRefs.mainComponent carries. Absence in older
   *  dumps means not captured (their proposals note "author `accepts`
   *  manually"), never "no preferred values". */
  swapPreferredValues?: Record<string, DumpPreferredValue[]>;
  /** SLOT property `description` strings (dump v1.18, additive), keyed by
   *  suffix-stripped property name. Figma cannot enforce `min`/`max`/
   *  `required`/`acceptsMode: "restrict"`, so the emitter writes them here in
   *  words — the description is the only carriage, which makes reading it the
   *  only way propose can NAME the limit rather than lose it. */
  slotDescriptions?: Record<string, string>;
  /** BOOLEAN property definitions' defaultValues (dump v1.5, additive),
   *  keyed by suffix-stripped property name. The one property default the
   *  variants alone cannot recover (TEXT defaults ride characters, VARIANT
   *  defaults ride canvas order): a visibility-bound part's boolean prop
   *  default comes from HERE as captured evidence — field case: Eventz
   *  Button hasStartIcon/hasEndIcon default true, previously "default not
   *  recoverable, review". Absence in older dumps means not captured. */
  boolDefaults?: Record<string, boolean>;
  /** Each variant's node tree. Variant names carry the axes
   *  ("Variant=Info", "Value=Off, Size=Sm"); a standalone COMPONENT has a
   *  single entry named after the component. Order is the canvas order —
   *  the first variant is the set's default variant. */
  variants: DumpNode[];
}

/** One capture-side degradation receipt (dump v1.2) — the plugin dump's
 *  mirror of extract/figma/rest/map.ts MapDegradation: every channel the
 *  capture reads but cannot carry is NAMED, never dropped silently. */
export interface DumpDegradation {
  code: string;
  /** setName:variant/child/… — same spelling as propose.ts note paths. */
  nodePath: string;
  message: string;
}

/** One captured variable (dump v1.4) — the resolved value for the consuming
 *  mode plus the Plugin API's resolvedType. COLOR values are '#rrggbb' (or
 *  8-digit '#rrggbbaa'); FLOAT values are raw numbers (the consumer decides
 *  px vs unitless from usage — opacity-bound variables are unitless).
 *  STRING/BOOLEAN variables are carried for completeness but are not
 *  registrable as CSS custom properties (named receipt downstream). */
export interface DumpVariable {
  type: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN' | string;
  value: string | number | boolean;
  /** Per-mode resolved values, keyed by MODE NAME (dump v1.6, additive) —
   *  captured only when the variable's collection has more than one mode.
   *  The consuming mode's value stays `value` (v1.4 shape); the captured-
   *  token layer projects `modes` as per-mode token trees (the repo's own
   *  tokens/modes/*.tokens.json shape) so a §3-promoted theme axis resolves
   *  per mode instead of losing the non-default modes. Absence in older
   *  dumps means not captured, never "single-mode". */
  modes?: Record<string, string | number | boolean>;
}

export interface DumpFile {
  /** `dumpVersion` (dump v1.5, additive): producers that capture the FULL
   *  v1.5 surface stamp '1.5' here. Consumers use it as POSITIVE evidence
   *  for channels whose absence is ambiguous in older dumps — e.g. a
   *  visibility-bound node NOT hidden in the default variant recovers a
   *  boolean default of true only when the producer is known to capture
   *  `hidden` (absent marker → absence stays "not captured"). */
  _provenance?: {
    fileKey?: string | null;
    extractedAt?: string | number;
    note?: string;
    dumpVersion?: string;
    /** READ-LIMIT receipts (REST route, 2026-08-03): channels this dump's
     *  PRODUCER cannot capture, one human-readable entry each. Stamped by
     *  extract/figma/rest/map.ts; the propose pass surfaces them as a named
     *  note so "absent from the dump" and "absent from the design" stay
     *  different facts. Absent on plugin dumps (full capture) and on
     *  hand-authored fixtures — absence adds no note, so committed corpora
     *  are byte-stable. */
    captureGaps?: string[];
  };
  /** dump v1.2, additive — absent in older dumps (their captures were run
   *  before the channel existed; absence means "not receipted", not clean). */
  _degradations?: DumpDegradation[];
  /** dump v1.4, additive — every variable the capture resolved a binding
   *  through, keyed by its slash-form name, with the resolved value for the
   *  consuming mode. Absent in older dumps (names-only capture) and in REST
   *  dumps (the variables endpoint is Enterprise-only — value-only minting
   *  stays the degraded route there). */
  _variables?: Record<string, DumpVariable>;
  [setName: string]: DumpSet | DumpFile['_provenance'] | DumpDegradation[] | Record<string, DumpVariable> | undefined;
}

export const isDumpSet = (v: unknown): v is DumpSet =>
  typeof v === 'object' && v !== null && 'variants' in (v as Record<string, unknown>);
