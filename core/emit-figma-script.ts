/**
 * Contract → Figma sync-script text — the PURE core of scripts/generate-figma.ts.
 *
 * Everything here is string-in/string-out: token trees + icon assets +
 * contracts in, deterministic Figma Plugin API script TEXT out. No node:*
 * imports — this module runs unchanged in a browser (core/index.ts,
 * npm run core:browser-check). The CLI shell (scripts/generate-figma.ts)
 * owns file discovery and writes into figma-sync/; its output is
 * byte-guarded by evals/golden.json.
 *
 * The emitted scripts are TRANSPORT-AGNOSTIC: they run unchanged through
 * any tool that executes Plugin API JS in the file — the Figma MCP's
 * `use_figma`, or figma-console-mcp's `figma_execute`.
 *
 *   tokens script       variables (collections, modes, aliases, scopes,
 *                       codeSyntax) — unchanged from v1
 *   component script    one component (set) per contract. v2 compiles each
 *                       contract's anatomy tree into a NODE SPEC executed by
 *                       a generic runtime: nested auto-layout frames, fixed
 *                       instances of dependency contracts, TEXT-bound content
 *                       parts, and slots (NATIVE Figma SlotNodes minted by
 *                       `component.createSlot()`, unified to ONE set-level
 *                       SLOT property; `accepts` → preferredValues; optional
 *                       slots get a "Show X" BOOLEAN).
 *
 * Fidelity scope (deliberate, documented in docs/05 + docs/08):
 * - fontSize/family/weight are not variable-bindable → set numerically from
 *   resolved token values (weight → Inter style name).
 * - Interaction states are CSS concerns; not represented in Figma.
 * - Slots are NATIVE (Figma Schema 2025, pinned by docs/research/
 *   native-slots-proposal.md against the receipts in slots-recon-probes.md).
 *   `accepts` maps to the SLOT property's `preferredValues` — a picker hint,
 *   never enforcement — plus a `description` naming what the API cannot
 *   express (`min`/`max`/`required`/`acceptsMode: "restrict"`). GRID inside a
 *   slot and slot-in-slot are REFUSED BY NAME at compile.
 */
import {
  DECLARED_CHANNELS,
  channelDraws,
  TOKEN_CHANNELS,
  gridAxisSizing,
  STATE_PREVIEW_DEFAULT,
  STATE_PREVIEW_PROPERTY,
  isNativeCheckablePart,
  pascal,
  resolveLayout,
  resolveLiterals,
  resolveTokens,
  slotFigmaProperty,
  slotVisibilityProperty,
  statePreviewLabel,
  statePreviewSubstProps,
  withStateSegment,
  baseTwinName,
  walkAnatomy,
  designTimeSlotContent,
  SLOT_SAMPLE_LAYER,
  type Contract,
  type Part,
  type Prop,
} from '../scripts/contract-schema.js';
import { flattenTokens, aliasTarget, px, pxOrNull, type TokenEntry, type TokenTreeInput } from './tokens.js';
import { guardedValueUpsertRuntime, ownedCollectionPruneRuntime } from './token-set.js';
import { FINGERPRINT_SRC, FINGERPRINT_VERSION } from './canvas-fingerprint.js';
import { isMultiRoot, topRoots, validateContract } from './emit-react.js';


/** A2 grid: a compiled track — the Plugin API's own structured spelling
 *  (P2: gridRow/ColumnSizes entries are {type:'FIXED'|'FLEX'|'HUG', value}).
 *  HUG carries value 1, matching the API's readback noise (P2b). */
export interface GridTrackSpec {
  type: 'FIXED' | 'FLEX' | 'HUG';
  value: number;
}

export interface LayoutSpec {
  mode: 'HORIZONTAL' | 'VERTICAL' | 'GRID';
  primary: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  /** BASELINE is native, but ONLY on HORIZONTAL auto-layout — Figma throws on
   *  a VERTICAL frame. `layoutSpec` never produces it under mode VERTICAL. */
  counter: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
  stretchChildren?: boolean;
  /** v15 (S4/matrix a.8): flex-wrap: wrap → layoutWrap 'WRAP' (native). */
  wrap?: boolean;
  /** A2 grid (G1/G5/G6): the declared tracks, both gaps (compile-resolved to
   *  px), and the bounded auto-flow. Present exactly when mode is 'GRID'.
   *  Under flow, `rows` holds the EMITTER-DECLARED explicit tracks —
   *  ceil(children/columns) × {FLEX,1} — because the API under-reports
   *  implicit rows (P9); the contract never relies on implicit tracks. */
  grid?: {
    rows: GridTrackSpec[];
    columns: GridTrackSpec[];
    rowGap: number;
    columnGap: number;
    flow?: 'ROW_AUTO_FLOW';
    /** G8 (2026-08-08) — an INTRINSICALLY SIZED axis: the contract's
     *  `literals.width/height: "fit-content"` lowered to the canvas's
     *  layoutSizing{Horizontal,Vertical} = 'HUG'. `primary/counterAxisSizingMode`
     *  are INERT on a GRID frame (GP1b/GP8: they read back HUG while the frame
     *  stays its FIXED size), so this is the ONLY faithful spelling — and it is
     *  written LAST, after resize and after every child, because a later
     *  `resize()` of a hugged axis silently reverts both the sizing mode and the
     *  track list (GP4b). The schema refuses it on an axis carrying an {fr}
     *  track (`grid-hug-flex-axis`, GP1/GP5/GP12), so it can never destroy one. */
    hugWidth?: true;
    hugHeight?: true;
  };
}

export interface NodeSpec {
  type: 'root' | 'frame' | 'text' | 'instance' | 'slot' | 'svg' | 'shape';
  /** Round 4: intrinsic glyph size for svg specs (contract icon.size). */
  iconSize?: number;
  name: string;
  layout?: LayoutSpec;
  bindings?: Record<string, string>;
  fill?: string;
  stroke?: string;
  /** Round 5d (owner finding: the Banner focus ring drew on the bottom
   *  portion only): a stroke lowered from a CSS OUTLINE. CSS outlines sit
   *  OUTSIDE the border box and paint over everything — an INSIDE-aligned
   *  Figma stroke is painted over by opaque children (the Banner tone
   *  ribbon covered the top arc). The runtime aligns these strokes OUTSIDE
   *  so the ring wraps the full root bounds; the preview renders a CSS
   *  outline. */
  strokeOutside?: boolean;
  /** ANTD EXAM (heal loop): a stylesWhen `border-*-style: dashed|dotted` on
   *  this combo lowers to a Figma dashPattern on the stroke (solid otherwise). */
  dashPattern?: number[];
  fixedWidth?: { px: number; varName: string };
  fixedHeight?: { px: number; varName?: string };
  /** CSS grow → layoutSizingHorizontal FILL after append. */
  grow?: boolean;
  /** Compile-decided horizontal FILL (2026-07-21, live-canvas finding —
   *  handoff 08#1). CSS stretch/grow lowers to layoutSizing FILL only when
   *  the parent's width is ESTABLISHED (fixed/literal width, itself filling,
   *  or hugging ≥1 intrinsic non-filling child). A FILL child under a
   *  width-less hug parent is real Figma's degenerate cycle — the composite
   *  dialog collapsed to ~3px live; such candidates now HUG instead. The
   *  runtime applies this flag verbatim (see annotateFillW). */
  fillW?: true;
  /** D7 hug-ceiling (exact-conversion wave): this box carries the MEASURED
   *  `hugsBelowMaxWidth` fact — it HUGS beneath a bound maxWidth ceiling.
   *  A FILL child inside a hugging box contributes no intrinsic width (real
   *  Figma and the mock agree), so filling would collapse the measurement:
   *  inline-notification's grow:true details row shrank its own hug root to
   *  min-width 288 while its text-wrapper measured 331 (the D3 overflow).
   *  Children of such a box therefore never become fillW candidates. */
  hugCeiling?: true;
  /** FC-TEXT-FILL-ALIGNMENT (landing round for the exact-conversion wave):
   *  the compiler PROVED hugging displaces this text — the parent's
   *  horizontal alignment (primary on rows, counter on stacks) does not
   *  match the text's own textAlignH, so a hugged box is packed somewhere
   *  the CSS grow-box's glyphs never sit (MUI accordion title: grow:1 text
   *  in a justify-center summary paints LEFT in CSS, but a hugged 120px box
   *  centers in the 288px row — Live Defect 5a resurfaced). Only text
   *  carrying this flag may take layoutSizingHorizontal FILL; alignment-safe
   *  text keeps the Carbon Tabs HUG rule (FILL in a snug box truncates
   *  glyph overhang under font substitution). */
  fillText?: true;
  /** RC5: this TEXT node is the canvas emitter's OWN design-time slot sample
   *  (packages/schema DEFAULT_SLOT_SAMPLE, layer SLOT_SAMPLE_LAYER) — never a
   *  contract fact. Two readers, and nothing else:
   *    · annotateFillW grants it horizontal FILL when its slot's width is
   *      already established, so a 44-character sentence WRAPS inside the slot
   *      instead of running past the component's edge. Scoped to this flag on
   *      purpose: FC-TEXT-FILL-ALIGNMENT's hug rule for ordinary non-truncating
   *      text is untouched (it exists for Carbon's clipped tab labels).
   *    · nothing at runtime — the emitted spec carries it only as evidence.
   *  The INVERSE path does not read this flag (a compile-time flag has no
   *  canvas spelling); it recognises the sample by layer name + characters +
   *  sole-child, spelled once in packages/schema isDesignTimeSlotSample. */
  slotSample?: true;
  /** FC-FIGMA-CLIP-DEFAULT: opt into Figma clipsContent. Default false —
   *  createFrame clips by default but CSS overflow is visible; clipping HUG
   *  text truncates Semi Bold overhang (Carbon Tabs "Settings"). */
  clipsContent?: true;
  /** A2 grid (G2/G4): this node's cell under a GRID parent — 0-based anchor,
   *  spans only when >1, aligns only when not AUTO (deterministic minimal
   *  spec). The runtime applies it AFTER append in the probe-pinned order:
   *  place ALL children (child.setGridChildPosition, P3) → spans (all
   *  placements before any span — the occupancy throw) → FILL → aligns.
   *  Absent under flow (placement fact = child order, P5). */
  cell?: {
    row: number;
    column: number;
    rowSpan?: number;
    columnSpan?: number;
    hAlign?: 'MIN' | 'CENTER' | 'MAX';
    vAlign?: 'MIN' | 'CENTER' | 'MAX';
  };
  /** visibleWhen on a boolean prop → node visibility bound to its BOOLEAN
   *  component property. (visibleWhen.equals is resolved at compile time:
   *  the part is simply omitted from non-matching variants.) */
  visibleProp?: string;
  visibleDefault?: boolean;
  /** Meter fill: fraction of the parent track's width (the canvas renders
   *  the contract defaults' state). Runtime resizes after append. */
  pct?: number;
  /** v7 overlay: runtime sets layoutPositioning ABSOLUTE after append, with
   *  placement-derived constraints and position. */
  overlay?: { placement: 'top' | 'bottom' | 'start' | 'end' };
  /** NODE opacity (dump v1.2 channel, inverted back out): a stylesWhen
   *  `opacity` whose condition resolves TRUE for this compiled combo. The
   *  runtime sets node.opacity after construction. */
  opacity?: number;
  /** v9 shape (#42): the runtime constructs a REAL RegularPolygon / Ellipse /
   *  Rectangle node — pointCount from sides, exact resize, NATIVE rotation
   *  (the contract's CSS-clockwise degrees negate into the Plugin API's
   *  counterclockwise degrees). Rotation here is already resolved per combo
   *  (base shape.rotation, or the stylesWhen rotate for this combo).
   *  A constant ellipse arc sweep (round 2 iteration 4) sets native arcData
   *  — the same radians the dump captured. An AXIS-VARYING sweep rides
   *  stylesWhen `mask` rules, which the canvas slice does not compile — the
   *  documented canvas stylesWhen fidelity limit. */
  shape?: { kind: 'polygon' | 'ellipse' | 'rect'; sides?: number; width: number; height: number; rotation?: number; arc?: { start: number; end: number; innerRadius: number } };
  /** v9 shape placement — compiled from the part's stylesWhen entries whose
   *  condition holds for this combo (the proposer's closed placement
   *  grammar: position:absolute + px/50% offsets + translate(-50%)). The
   *  runtime sets layoutPositioning ABSOLUTE + constraints + exact offsets
   *  after append. h/v: MIN pins left/top, MAX right/bottom, CENTER centers. */
  absolute?: { h: 'MIN' | 'MAX' | 'CENTER' | 'STRETCH'; v: 'MIN' | 'MAX' | 'CENTER' | 'STRETCH'; left?: number; right?: number; top?: number; bottom?: number };
  /** Single DROP_SHADOW (dump v1.2 box-shadow grammar), parsed at compile
   *  time from the resolved box-shadow token value — the runtime applies it
   *  as a native effect. color is 6- or 8-digit hex. */
  dropShadow?: { x: number; y: number; radius: number; spread?: number; color: string };
  /** v15 (S4/matrix a.1): a FULL box-shadow stack — multi-layer and inset
   *  layers included — parsed at compile time (parseShadowStack) when the
   *  resolved value is outside the single-drop dump grammar. The runtime
   *  applies the whole list as native DROP_SHADOW/INNER_SHADOW effects
   *  (effects is an array; order preserved). */
  effectStack?: Array<{
    inner?: boolean;
    x: number;
    y: number;
    radius: number;
    spread?: number;
    color: { r: number; g: number; b: number; a?: number };
  }>;
  /** v15 (S4/matrix a.3): a CSS linear-gradient background-image layer parsed
   *  at compile time (parseCssGradient) → native GRADIENT_LINEAR paint,
   *  appended OVER the fill paint (CSS lists the top layer first; Figma's
   *  last paint renders topmost — the documented order inversion). Radial/
   *  conic gradients stay a named description limit. Angle is CSS degrees
   *  (0 = to top, clockwise); stops are 0–1 positions. */
  gradient?: { angle: number; stops: Array<{ color: { r: number; g: number; b: number; a?: number }; position: number }> };
  /** COMPILE-INTERNAL: a background-image whose resolved value did NOT parse
   *  as a linear gradient (radial/conic/foreign grammar). Collected into a
   *  named description limit by compileComponentData and STRIPPED before the
   *  spec JSON is emitted — never a silent drop, never emitted noise. */
  gradientMiss?: string;
  /** COMPILE-INTERNAL (B-3 finding 6 companion): a box-shadow whose resolved
   *  value parsed NEITHER as the single-drop dump grammar NOR as a full
   *  effect stack — genuinely inexpressible / foreign grammar. Collected by
   *  compileComponentData into the code-only-fact footnote (†) and STRIPPED
   *  before the spec JSON is emitted — never a silent drop. */
  shadowMiss?: string;
  /** SILENT-LOSS ROUND (task #33, fix 3) — CHANNEL MISSES.
   *
   *  `applyTokens`/`applyLiterals` both ended in `default: break;`. Three
   *  separate rounds of the SAME defect are documented in this file's own
   *  comments — padding longhands (Round 4), column-gap (Round 5), the
   *  RadioButton ring — each one found on a canvas, by a person, after
   *  shipping. A channel the contract CARRIES and the canvas has no field
   *  for is a fact that was measured and then dropped, and until now the
   *  drop left no trace anywhere.
   *
   *  Mirrors the existing good precedent in this file: `gradientMiss` and
   *  `shadowMiss` are explicit "I had a value and could not draw it" markers
   *  that reach the component description. `channelMiss` is the same marker
   *  for the whole registry — TOKEN_CHANNELS says, per channel, whether a
   *  native field exists; anything that is not `canvas: 'draw'` lands here,
   *  as do the three CONDITIONAL lowerings that silently no-op (cross-axis
   *  gap longhands, disagreeing per-side border colours). Collected by
   *  compileComponentData into `ComponentData.codeOnlyFacts` (the named
   *  receipt — every miss keeps its channel, value and reason) and STRIPPED
   *  from the spec before the JSON is emitted. */
  channelMiss?: CodeOnlyFactSeed[];
  /** B-3 finding 5: inset-0 overlay lowering. Compiled when a part carries
   *  ALL FOUR inset channels (top/right/bottom/left) resolving to 0 and does
   *  not itself declare position:relative (TextField's backdrop). The
   *  runtime pulls the node out of flow — layoutPositioning ABSOLUTE, x/y 0,
   *  STRETCH/STRETCH constraints, sized to the parent — and places it BEHIND
   *  the in-flow siblings (insert index 0), matching the declared anatomy
   *  and the paired HTML render. Round 5: a part DECLARING position:absolute
   *  with NO carried inset channels whose box is parent-bound (declared
   *  aspect-ratio, or max-width/max-height 100%) lowers the same way — the
   *  floor-promoted Checkbox glyph overlay (real CSS centers it with a 50%
   *  translate the capture cannot carry; the parent-square lowering is the
   *  honest approximation, receipted in the canvas fidelity notes). */
  insetOverlay?: boolean;
  /** Round 5: NON-ZERO inset offsets for an inset overlay (the Checkbox
   *  indeterminate glyph rides inset -2px — the 22px dash overhangs its
   *  parent square). Absent = inset 0 (byte-stable for existing specs). */
  insetOffsets?: { top: number; right: number; bottom: number; left: number };
  /** Round 5 (canvas-gate): margin channels the floor-promoted contracts
   *  carry (Badge pip -2/-2/-8, Checkbox control spacing), resolved to
   *  literal px at compile. Round 5d (owner findings: the Checkbox/Radio
   *  control↔label gap was missing on canvas; the Badge pip drew oversized):
   *  margins now APPLY on canvas — a uniform positive sibling gap lowers to
   *  the parent's itemSpacing at compile (variable-bound when the margin
   *  rode one token), and every residual margin becomes the child's CSS
   *  margin box at runtime (a fixed wrapper frame, clipsContent false, child
   *  placed at (left, top) — negative margins shrink the flow box and let
   *  the glyph overhang, the exact CSS geometry). The canvas preview keeps
   *  rendering residual margins as CSS margins.
   *  A ROOT spec cannot wrap itself (SET children are the component). Those
   *  margins are named and stripped (FC-EMIT-ROOT-MARGIN-SILENT). */
  margins?: { top?: number; right?: number; bottom?: number; left?: number };
  /** Round 5d: variable names for token-carried margin channels — consumed
   *  by the sibling-gap → itemSpacing lowering (the gap then BINDS the
   *  margin's own variable), stripped before serialization.
   *  FC-EMIT-ROOT-MARGIN-SILENT: a ROOT spec's margins are refused (no
   *  parent to wrap) — named and stripped, never left as a runtime no-op. */
  marginVars?: { top?: string; right?: string; bottom?: string; left?: string };
  /** Round 5: an `img` element part — raster content is runtime data with no
   *  canvas projection; the part draws the standard image-placeholder wash
   *  (compiled into lits.fillColor) and this flag names it in the preview
   *  fidelity notes. */
  imgPlaceholder?: boolean;
  /** Round 5: a block-display root with no width channel fills its container
   *  in CSS (the real ProgressBar track is a width-auto block). The canvas
   *  preview renders width:100%; the sync runtime keeps hug sizing — a named
   *  preview-only stage fact (the component has no intrinsic width). */
  blockRoot?: boolean;
  /** CARBON LIVE-DEFECT ROUND (D5): the root is a VIEWPORT-PINNED overlay
   *  scrim (`inset: 0` on all four edges) whose captured width/height
   *  measured the CAPTURE STAGE, not the component. The canvas box is bound
   *  to the overlay's content instead — a deliberate canvas-vs-DOM
   *  divergence, stripped before serialization and named in the code-only
   *  facts. The CONTRACT still carries the inset/width/height channels
   *  unchanged: what the DOM does is not edited, only what the canvas draws. */
  scrimBounded?: boolean;
  /** Line height for text nodes. Bare numbers stay PIXEL (dump v1.3).
   *  Object form carries unit — CSS unitless ratios (`1.4286`) compile to
   *  PERCENT so Figma does not treat them as ~1.4px (Astryx Toast clip). */
  lineHeight?: number | { value: number; unit: 'PIXELS' | 'PERCENT' };
  /** v15 (S4/matrix a.2): PIXEL letter spacing on text nodes — literal, the
   *  lineHeight discipline (binding upgrade deferred by name). */
  letterSpacing?: number;
  /** v15 (S4): declared text facts with NATIVE canvas fields (the 'draw'
   *  verdicts in DECLARED_CHANNELS): text-transform → textCase,
   *  text-decoration-line → textDecoration, text-align →
   *  textAlignHorizontal, font-family (first stack entry) → fontName.family,
   *  text-overflow: ellipsis → textTruncation 'ENDING'. */
  textCase?: 'UPPER' | 'LOWER' | 'TITLE' | 'ORIGINAL';
  textDecoration?: 'UNDERLINE' | 'STRIKETHROUGH' | 'NONE';
  textAlignH?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  fontFamily?: string;
  textTruncation?: boolean;
  /** v14 literals: literal-fidelity channels resolved from component-private
   *  source literals (schema `literals`/`literalsByProp`) — there is no
   *  variable to bind, so the runtime applies plain values. Colors are
   *  compile-parsed to RGBA so the runtime stays dumb; `fillClear` renders
   *  an explicit `transparent` as NO paint (never a default gray artifact).
   *  Applied by a CONDITIONAL runtime block: contracts without literals emit
   *  byte-identical scripts (the golden discipline). */
  lits?: {
    fillClear?: boolean;
    fillColor?: { r: number; g: number; b: number; a?: number };
    width?: number;
    height?: number;
    minWidth?: number;
    minHeight?: number;
    paddingTop?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    paddingRight?: number;
    itemSpacing?: number;
    radius?: number;
    strokeWeight?: number;
    /** v15 (S4/matrix a.4): per-corner literal radii. */
    radiusCorners?: { tl?: number; tr?: number; bl?: number; br?: number };
    /** v15 (S4/matrix a.5): per-side literal border widths. */
    strokeSides?: { top?: number; right?: number; bottom?: number; left?: number };
    /** CARBON LIVE-DEFECT ROUND (D2): a LITERAL border colour. Token-bound
     *  border colours have lowered to `spec.stroke` since round 4, but a
     *  literal one had no case at all in applyLiterals — it was a SILENT
     *  CANVAS DROP, and it is exactly what an unchecked Carbon checkbox box
     *  is made of (transparent fill, 1px solid #161616 ring). Figma strokes
     *  carry ONE paint, so the same uniform-sides rule the token path uses
     *  applies: disagreeing sides keep the CSS-side truth. */
    strokeColor?: { r: number; g: number; b: number; a?: number };
  };
  // svg (icon parts) — markup with currentColor resolved to the variant's
  // literal foreground color (SVG paint is not variable-bindable on import)
  svg?: string;
  /** Round 5d (owner finding: the Badge pip fill inspected as a bare hex):
   *  when the whole glyph rides ONE contract paint (every explicit fill/
   *  stroke in the baked markup is the same resolved literal), this is that
   *  paint's variable name — the sync runtime re-binds the imported vectors'
   *  paints to it after createNodeFromSvg, so the inspector shows the token. */
  svgPaintVar?: string;
  /** FC-SVG-ROTATION: CSS-clockwise degrees from declared `transform:
   *  rotate(<n>deg)` on an icon part. Plugin API is counterclockwise. */
  rotation?: number;
  // text
  characters?: string;
  fontSize?: number;
  fontStyle?: string;
  /** Name of the derived text style whose definition the node's font
   *  bindings exactly match — the runtime sets textStyleId when the style
   *  exists in the file (raw fontName/fontSize stand as the fallback). */
  textStyle?: string;
  /** FC-WEIGHT-IDENTITY — the size token's Figma VARIABLE (slash form), bound
   *  to `fontSize` on text nodes that CANNOT ride a derived text style.
   *
   *  A text style is the canvas's carrier of size-token identity, but it is
   *  all-or-nothing: setting `fontName` after `setTextStyleIdAsync` CLEARS
   *  `textStyleId` (live-verified against the Plugin API — Figma has no
   *  text-style weight override). So a contract that binds a group's size
   *  and overrides that group's weight — `{font.control.size.sm}` +
   *  `{font.weight.regular}`, which four first-party contracts do since the
   *  FC-WEIGHT-DEFAULT round — used to draw a bare 14px/Regular node with no
   *  token identity on the canvas at all: the design→contract inverter could
   *  see 14px but not WHICH 14px token, and 14 is ambiguous (font.avatar
   *  .size.md and font.control.size.sm both resolve to it). Binding the
   *  variable puts the identity back where a reader can see it. */
  fontSizeVar?: string;
  /** FC-WEIGHT-IDENTITY, second half. Figma has NO variable binding for font
   *  weight — the face name is the only thing on the node — so a contract's
   *  weight token used to die at emit: this file resolved it to "Medium" and
   *  threw the identity away, and "Medium" is the same face a node with no
   *  weight token at all draws. The inverter then could not tell a DECLARED
   *  500 from the runtime default, so it proposed nothing and said nothing
   *  (TJ-TEST.md §A7, the silent row). Stamped as plugin data instead, the
   *  same way the size token rides `fontSizeVar` when no style can carry it. */
  fontWeightVar?: string;
  /** Same story as fontWeightVar, one channel over. Figma's lineHeight takes a
   *  value, not a variable, so the contract's token resolved to a number here
   *  and the identity was gone — the reader then MINTED a replacement
   *  (`imported.label.label.line-height`) for a token the corpus already had
   *  (`imported.label.root.line-height`). Stamped so the original binds back. */
  lineHeightVar?: string;
  textFill?: string;
  /** R7 LITERAL INK: the TEXT node's fill when the contract carries
   *  `literals.color` and no variable binds the channel — a literal SOLID
   *  paint at runtime (no variable to bind), the text twin of lits.fillColor.
   *  Absent whenever textFill is set (a bound paint wins). */
  textFillLit?: { r: number; g: number; b: number; a?: number };
  contentProp?: string;
  // instance
  dep?: string;
  /** Authoritative semantic identity for a nested component. Names are only
   *  the explicit legacy-generated fallback at runtime. */
  depContractId?: string;
  /** Stable Figma identity when the child contract already has an anchor. */
  depAnchorKey?: string;
  depProps?: Record<string, string | boolean>;
  // slot
  slotProperty?: string;
  slotOptional?: boolean;
  slotAccepts?: Array<{ dep: string; contractId: string; anchorKey?: string }>;
  /** The SLOT property's `description` — the ONE surface Figma gives a slot
   *  for facts it cannot enforce. Carries `accepts` in words plus every
   *  refused constraint BY NAME (`min`/`max`/`required`/`acceptsMode:
   *  "restrict"`), so a designer reads the limit in the property panel
   *  instead of discovering it by violating it. Absent when the slot
   *  declares nothing beyond its name. */
  slotDescription?: string;
  /** Design-time default content — appended INSIDE the native SlotNode of the
   *  main component (instances inherit it; `resetSlot()` returns to it). Any
   *  number of items carries: a native slot holds a child SEQUENCE, so the
   *  old one-instance INSTANCE_SWAP ceiling is gone. */
  slotDefault?: Array<{ dep: string; contractId: string; anchorKey?: string; props?: Record<string, string | boolean> }>;
  children?: NodeSpec[];
}

export interface VariantSpec {
  name: string;
  row: number;
  col: number;
  spec: NodeSpec;
}

/** ONE fact the contract carries and the canvas cannot. THE receipt shape —
 *  the same object rides the emitted script (`COMPONENTS[i].codeOnlyFacts`),
 *  the `figma bundle` JSON (`bundle.codeOnlyFacts[i].facts`), the plugin's
 *  plan step, the built set's shared plugin data (`ds_contracts/
 *  codeOnlyFacts`) and the plugin UI's run report. Until 2026-08-22 every
 *  one of these was computed and then discarded: the only consumer was
 *  `.size`, feeding a single trailing `†` in the set description.
 *
 *  `part` is the anatomy part the fact sits on (`root`, `label`, …; for an
 *  event, its trigger part). `kind` names the honesty channel it came
 *  through; `channel` the CSS channel / event / property; `value` what the
 *  contract carried ('' when the fact has no single value); `reason` why the
 *  canvas has no field for it. `variants` says WHICH compiled variants carry
 *  the fact: `count === of` is every variant (names omitted — the common
 *  case, and what a contract-wide fact such as a declared channel or an
 *  event always reports); otherwise `names` lists them, the first
 *  CODE_ONLY_FACT_VARIANT_NAMES of them, with `more` counting the rest.
 *
 *  ONE entry per distinct (part, kind, channel, value, reason) — never one
 *  per variant. Measured before this fold, polaris.text-field produced
 *  47,655 per-variant entries for 89 distinct facts (the bundle path compiles
 *  the full cartesian) and the fluent genesis paste grew by 1.8 MB. Lists are
 *  sorted on that key and duplicate-free, so the same contract always names
 *  its facts in the same order. */
export interface CodeOnlyFact {
  part: string;
  /** `capture` (antd exam, W4): a state-plane fact the computed capture
   *  observed and the contract grammar refused — carried on the part as
   *  `Part.codeOnly` so the bundle, the plugin report and the set's plugin
   *  data repeat it. The channel is spelled `outline-width [focus-visible]`. */
  kind: 'channel' | 'declared' | 'gradient' | 'shadow' | 'event' | 'meter' | 'scrim' | 'preview' | 'capture';
  channel: string;
  value: string;
  reason: string;
  variants: { count: number; of: number; names?: string[]; more?: number };
}

/** The kinds a collector observes PER COMPILED VARIANT (the rest — declared
 *  channels, events, meters — are contract-wide by construction). Summaries
 *  spell out variant coverage for these only. */
export const CODE_ONLY_PER_VARIANT_KINDS: ReadonlySet<CodeOnlyFact['kind']> = new Set(['channel', 'gradient', 'shadow', 'scrim', 'preview']);

/** How many variant NAMES a partial-coverage fact spells out before it
 *  counts the rest (`more`). */
export const CODE_ONLY_FACT_VARIANT_NAMES = 24;

/** A channel miss BEFORE it knows its part (pushed onto `NodeSpec.channelMiss`
 *  by the lowering that refused it; compileComponentData adds the part). */
export type CodeOnlyFactSeed = Pick<CodeOnlyFact, 'channel' | 'value' | 'reason'>;

/** A fact as the collectors see it — one observation in one compiled
 *  variant ('' = contract-wide). foldCodeOnlyFacts turns observations into
 *  the receipt entries. */
export interface CodeOnlyFactObservation extends CodeOnlyFactSeed {
  part: string;
  variant: string;
  kind: CodeOnlyFact['kind'];
}

const factKey = (f: CodeOnlyFactSeed & { part: string; kind: string }): string =>
  JSON.stringify([f.part, f.kind, f.channel, f.value, f.reason]);

/** Observations → receipt entries: folded per distinct fact, sorted on the
 *  fact key, duplicate-free, with the variant coverage counted against
 *  `totalVariants` (the compiled variant + state-preview total). Plain
 *  string comparison (never localeCompare): the order must not depend on
 *  the host's locale, because the emitted bytes are golden-pinned. */
export function foldCodeOnlyFacts(observations: Iterable<CodeOnlyFactObservation>, totalVariants: number): CodeOnlyFact[] {
  const folded = new Map<string, { fact: Omit<CodeOnlyFact, 'variants'>; names: string[]; seen: Set<string>; all: boolean }>();
  for (const o of observations) {
    const key = factKey(o);
    let entry = folded.get(key);
    if (!entry) {
      entry = {
        fact: { part: o.part, kind: o.kind, channel: o.channel, value: o.value, reason: o.reason },
        names: [],
        seen: new Set(),
        all: false,
      };
      folded.set(key, entry);
    }
    if (o.variant === '') entry.all = true;
    else if (!entry.seen.has(o.variant)) {
      entry.seen.add(o.variant);
      entry.names.push(o.variant);
    }
  }
  const of = Math.max(totalVariants, 1);
  return [...folded.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, { fact, names, all }]) => {
      if (all || names.length >= of) return { ...fact, variants: { count: of, of } };
      const shown = names.slice(0, CODE_ONLY_FACT_VARIANT_NAMES);
      const more = names.length - shown.length;
      return { ...fact, variants: { count: names.length, of, names: shown, ...(more > 0 ? { more } : {}) } };
    });
}

/** The short label a summary line uses for one fact — `column-gap`,
 *  `event dismiss`, `declared overflow-x`, `gradient background-image`. */
export function codeOnlyFactLabel(f: CodeOnlyFact): string {
  if (f.kind === 'channel') return f.channel;
  return `${f.kind} ${f.channel}`;
}

/** The one-line per-contract summary `figma bundle` prints — counts per
 *  label so 225 Button facts read as a dozen channels with multipliers:
 *  `Button: 225 facts stay code-only (border-top-color ×45, …) — see
 *  bundle.codeOnlyFacts`. */
export function summarizeCodeOnlyFacts(name: string, facts: CodeOnlyFact[], maxGroups = 12): string {
  if (facts.length === 0) return `${name}: 0 facts stay code-only`;
  const verb = facts.length === 1 ? 'fact stays' : 'facts stay';
  const counts = new Map<string, number>();
  for (const f of facts) {
    const label = codeOnlyFactLabel(f);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const groups = [...counts.entries()].map(([label, n]) => (n > 1 ? `${label} ×${n}` : label));
  // A per-variant fact carried by several variants says so — Badge's
  // row-gap is one fact on all 24 variants, not one fact. Contract-wide
  // kinds (declared channels, events, meters) hold everywhere by
  // construction and carry no coverage suffix.
  const withCoverage = groups.map((g, i) => {
    const label = [...counts.keys()][i];
    const entries = facts.filter((f) => codeOnlyFactLabel(f) === label);
    const one = entries.length === 1 ? entries[0] : null;
    if (!one || !CODE_ONLY_PER_VARIANT_KINDS.has(one.kind) || one.variants.of <= 1) return g;
    return `${g} (${one.variants.count === one.variants.of ? 'all ' : `${one.variants.count} of `}${one.variants.of} variants)`;
  });
  const shown = withCoverage.slice(0, maxGroups);
  const rest = withCoverage.length - shown.length;
  return `${name}: ${facts.length} ${verb} code-only (${shown.join(', ')}${rest > 0 ? `, +${rest} more channel${rest === 1 ? '' : 's'}` : ''}) — see bundle.codeOnlyFacts`;
}

export interface ComponentData {
  setName: string;
  contractId: string;
  /** Authored contract version — stamped as `ds_contracts/version` so dump
   *  can recover it. Propose used to invent `0.1.0` (FC-DUMP-PROPOSE-VERSION-INVENTED). */
  version: string;
  anchorKey: string | null;
  description: string;
  /** schema 18 documentationLinks — written onto the set as Figma's own
   *  documentationLinks so the pointer survives contract → canvas too.
   *  OMITTED (not []) when the contract declares none, so the serialized
   *  ComponentData in every generated sync script is byte-identical for the
   *  corpus (figma:fresh) and specHash never moves for a link-less contract. */
  documentationLinks?: Array<{ uri: string }>;
  isSet: boolean;
  boolProps: Array<{ property: string; default: boolean }>;
  /** Text props with no bound text node (aria-label-only props like
   *  StatusDot.label) — added as unbound TEXT properties so the API surface
   *  matches the contract. */
  textProps: Array<{ property: string; default: string }>;
  fontStyles: string[];
  variants: VariantSpec[];
  /** bindings.figma.statePreviews: canvas-only preview variants carrying the "State"
   *  axis. Kept SEPARATE from `variants` (the pure enum-API cartesian) —
   *  the runtimes merge them via withStateAxis, renaming base variants with
   *  an explicit State=Default segment. Omitted entirely when the contract
   *  does not opt in, so unchanged contracts keep a stable specHash. */
  stateVariants?: VariantSpec[];
  /** The DECLARED shape of the sparse State matrix, stamped onto the set as
   *  `ds_contracts/statePreviewAxis` so the design→contract inverter can hold
   *  the drawn rows to the matrix the emitter MEANT to draw.
   *
   *  Without it the inverter assumed a full Cartesian and refused every
   *  previews set this emitter produced (EXACT_MATRIX_RAGGED — Badge draws 24
   *  where the Cartesian is 36, Button 45 where it is 125), so Path A could
   *  not invert the two most important Flowbite stems. `pinned` is carried
   *  EXPLICITLY rather than re-derived because the emitter pins each
   *  non-primary axis to its contract-declared first value while the reader
   *  sorts options alphabetically. Omitted when the contract does not opt in,
   *  so unchanged contracts keep a stable specHash. */
  /** The contract's SEMANTICS, stamped so the inverter reads the host element
   *  instead of guessing it. Figma draws no element, no role and no ARIA, so
   *  the reader fell back to a name/axis table: Label came back a `div` and
   *  Badge — a `span` whose only crime is carrying hover/active variants —
   *  came back a `button`, because an interaction-state axis reads as
   *  "interactive". A wrong element is worse than a missing one: it changes
   *  what the generated component IS. Omitted when the contract declares no
   *  semantics, so a set drawn elsewhere keeps the inference. */
  semantics?: { element?: string; role?: string };
  /** Figma property name → the CONTRACT's prop name for it. Figma carries the
   *  design-facing spelling ("Content"), the contract carries the code-facing
   *  one ("children"), and nothing on the canvas relates the two — so the
   *  reader canonicalised the design name and Alert's `children` came back as
   *  `content`. The reader was right to refuse to guess (renaming by
   *  convention would break design-property fidelity); this gives it the
   *  answer instead of a convention. Omitted when no prop declares a Figma
   *  binding. */
  propNames?: Record<string, string>;
  statePreviewAxis?: {
    axis: string;
    default: string;
    states: string[];
    primary: string | null;
    pinned: Record<string, string>;
  };
  /** PROTOTYPE WIRING: deterministic Figma prototype reactions binding each
   *  base (State=Default) variant to its hover/active preview twin, so a
   *  generated set actually SWAPS in presentation mode. Names, never node
   *  ids — the runtime resolves them against the set it just built/amended.
   *  Omitted entirely when empty (a contract that does not opt in keeps a
   *  byte-identical specHash). NEVER carried inside spec/NodeSpec: the
   *  canvas-gate channels cannot measure reactions and must not grow the
   *  concept. */
  stateReactions?: StateReaction[];
  /** THE NAMED RECEIPT (2026-08-22): every fact this contract carries that
   *  the canvas cannot — see CodeOnlyFact. Sorted, duplicate-free. Omitted
   *  entirely when empty, so a contract with nothing to name keeps a stable
   *  specHash; a contract WITH facts changes hash once (its description
   *  changes anyway — the count now rides beside the dagger). The runtime
   *  stamps it as `ds_contracts/codeOnlyFacts` (capped) and returns it in
   *  the per-set result, which is what the plugin report lists. */
  codeOnlyFacts?: CodeOnlyFact[];
  colW: number;
}

/** One wired interaction. `trigger` is the Figma Trigger type verbatim; the
 *  action is always `{type:'NODE', navigation:'CHANGE_TO', transition:null}`
 *  (see figma-sync/plugin/typings/reactions.d.ts for the vendored shapes). */
export interface StateReaction {
  /** Variant name of the source — always a `State=Default` variant. */
  from: string;
  trigger: 'ON_HOVER' | 'ON_PRESS';
  /** Variant name of the destination preview twin. */
  to: string;
}

/**
 * The trigger map, in CANONICAL emission order.
 *
 * hover  → ON_HOVER  CHANGE_TO State=Hover
 * active → ON_PRESS  CHANGE_TO State=Active
 *
 * Both auto-revert (Figma restores the source variant when the pointer
 * leaves / the press ends), so no return wiring is emitted and preview
 * variants carry ZERO reactions.
 *
 * EXCLUDED BY NAME — `focus-visible` and `disabled`: Figma's prototyping
 * Trigger union has no focus or disabled trigger at all (ON_CLICK, ON_HOVER,
 * ON_PRESS, ON_DRAG, AFTER_TIMEOUT, MOUSE_*, ON_KEY_DOWN, ON_MEDIA_*). Their
 * preview variants stay PREVIEW-ONLY: reachable by hand on the canvas,
 * destinations of nothing in the prototype. Not a gap in this round — a
 * limit of the target surface, positively asserted by the plugin-engine gate.
 *
 * The order is FIXED here, not read from `contract.states[]`: MUI Button
 * declares ["disabled","active","focus-visible","hover"] and Polaris Button
 * declares ["disabled","focus-visible","active","hover"] — same semantics
 * must emit the same bytes.
 */
type ContractState = Contract['states'][number];
const STATE_REACTION_TRIGGERS: ReadonlyArray<{ state: ContractState; trigger: StateReaction['trigger'] }> = [
  { state: 'hover', trigger: 'ON_HOVER' },
  { state: 'active', trigger: 'ON_PRESS' },
];

/** Data the engine needs — parsed trees and assets, never paths. */
export interface FigmaEngineInput {
  tokens: TokenTreeInput;
  /** Icon asset name → SVG markup (assets/icons/*.svg on the CLI side). */
  icons: Map<string, string>;
  /** When set, duplicate variable names resolve from this Figma collection
   *  (FC-THEME-ISO: console-loop shares one file across DS bundles). */
  variableCollection?: string;
}

/** Everything a single-contract emission needs (the playground surface). */
export interface FigmaScriptCtx extends FigmaEngineInput {
  /** Every known contract by id — composition refs resolve through it. */
  contracts: Map<string, Contract>;
  /** Overrides the anchor file key baked into the script's WRONG FILE guard
   *  (the CLI passes FIGMA_FILE_KEY for rebuild-into-a-fresh-file support). */
  fileKey?: string;
  /** Minted provisional tokens (the playground's `imported.*` layer, a DTCG
   *  tree). When present and non-empty, the component script gains a preamble
   *  that upserts one Figma variable per minted leaf into an 'Imported
   *  (provisional)' collection — so the script's variable lookups resolve in
   *  the ORIGIN file the designer pastes it back into, which never synced
   *  these tokens. Absent or empty → no preamble, byte-identical output
   *  (evals/golden.json safety: repo contracts mint nothing). */
  mintedTokens?: Record<string, unknown>;
}

/** FC-SLOT-BIRTH-BOX — Figma's 100x100 BIRTH BOX outlives the sizing writes
 *  that should dissolve it, on ANY childless auto-layout node.
 *
 *  Measured live 2026-08-10, twice, on two different node kinds:
 *   · DS Contracts Testing, Card 1:459 / Body SLOT 67:10995 — createSlot()
 *     mints 100x100 (probe 2b); after applyFrameSpec the node reported
 *     layoutSizingVertical 'HUG', primaryAxisSizingMode 'AUTO', ZERO children
 *     and 8+8 padding, and still measured 100 tall where hug is 16. The card
 *     shipped 320x142 against a 320x58 reference.
 *   · MUI Test 1, Divider 83:1610 variant FullWidth — a plain COMPONENT, 0
 *     children, 0 padding, reporting HUG, measuring 288x100 where the library
 *     divider is 288x1. Its scorecard read 0.00% PASS because the scorer crops
 *     both sides to their ink box and 99 transparent rows have no ink.
 *
 *  Re-asserting HUG is a NO-OP — Figma already believes it is hugging. Only a
 *  FIXED resize round-trip forces the relayout a childless node never gets;
 *  both probes then measured EXACTLY the reference box (58 / 1).
 *
 *  GRID is excluded by the caller: a resize on a GRID frame silently reverts
 *  HUG tracks to FLEX (G8/GP4b), so the repair would cost more than the defect.
 *  A refusal, not a swallow: an axis that will not round-trip is named. */
const birthBoxRuntime = (has: boolean): string =>
  has
    ? `
function remeasureBirthBox(node, label, hasW, hasH) {
  for (const axis of ['Vertical', 'Horizontal']) {
    // A DECLARED SIZE IS NOT A BIRTH BOX. This repair dissolves Figma's
    // 100x100 default by shrinking a HUG axis to 1 and letting it re-measure
    // — which is right for a node whose size is supposed to come from its
    // content, and destructive for one the CONTRACT sized. A childless frame
    // has nothing to re-measure against, so the axis hugs to 1 and stays
    // there: MUI's switch-track is declared 34x14 and shipped 1x1 exactly
    // this way (the compile receipt's pin caught it, and the pin was right).
    if (axis === 'Horizontal' && hasW) continue;
    if (axis === 'Vertical' && hasH) continue;
    const prop = 'layoutSizing' + axis;
    let mode;
    try { mode = node[prop]; } catch (e) { degrade('FC-RT-BIRTH-BOX-UNREADABLE', node, '"' + label + '": ' + prop + ' could not be read, so the HUG birth-box re-measure was skipped on this axis', e); continue; }
    if (mode !== 'HUG') continue;
    try {
      node[prop] = 'FIXED';
      node.resize(axis === 'Horizontal' ? 1 : node.width, axis === 'Vertical' ? 1 : node.height);
      node[prop] = 'HUG';
    } catch (e) {
      throw new Error(
        '"' + label + '": ' + axis.toLowerCase() + " axis reports HUG but kept Figma's 100px " +
        'birth box, and the FIXED round-trip that forces the re-measure was refused (' +
        e.message + ') — FC-SLOT-BIRTH-BOX',
      );
    }
  }
}
`
    : '';

/** Emits the birth-box re-measure at ONE of its two call sites.
 *
 *  TWO sites, because a variant COMPONENT reaches the canvas by two different
 *  paths and only one of them ran the repair. Measured on MUI Divider
 *  (set 83:1610, `amended:true, rebuiltVariants:3`): after the rt9 rebuild
 *  Inset was still 216x100 and Middle still 256x100. The AMEND path preserves
 *  the existing variant COMPONENT node and rebuilds only its interior, so
 *  buildNode — where the only call site lived — never runs on the root and the
 *  root keeps Figma's 100px birth box forever.
 *
 *  The layout default MIRRORS applyFrameSpec's (`spec.layout || {mode:
 *  'HORIZONTAL', ...}`). The first spelling guarded on `spec.layout &&`, which
 *  silently skipped every root that declares no layout — those nodes are
 *  auto-layout HORIZONTAL on canvas, not layout-less, so the guard was reading
 *  a fact the emitter had already defaulted away. */
const birthBoxCall = (has: boolean, nodeExpr: string, specExpr: string): string =>
  has
    ? `
  // FC-SLOT-BIRTH-BOX: dissolve Figma's 100x100 birth box now that every child
  // (including a slot's defaultContent) is in place. Only a node that ENDED UP
  // childless is affected — one with children has already relaid out — and GRID
  // is excluded because a resize there reverts HUG tracks to FLEX (G8/GP4b).
  // A DECLARED layout is required, and that is not the timidity it looks like.
  // I relaxed it to applyFrameSpec's default on the theory that a layout-less
  // root was a latent hole. It was speculation — the divider roots this fix
  // exists for all declare layout — and the canvas refuted it: MUI Switch's
  // switch-track is a childless FRAME with no declared layout that measures
  // 34x14 FIXED live (read from 21:612). Under the relaxed guard it entered
  // the re-measure, hugged to nothing and shipped 1x1, breaking the mui
  // compile receipt's 34x14 pin. A node the contract gave no layout is not a
  // node whose sizing this repair understands.
  //
  // \`children\` IS the container test, and it stays explicit: a TEXT node
  // answers 'layoutSizingVertical' in node just as truthfully as a frame does
  // and has no children array at all. Only FRAME / COMPONENT / SLOT carry a
  // birth box; a text or vector leaf measures itself.
  if (${specExpr}.layout && ${specExpr}.layout.mode !== 'GRID' &&
      'layoutSizingVertical' in ${nodeExpr} && ${nodeExpr}.children &&
      (${specExpr}.type === 'slot' || ${nodeExpr}.children.length === 0)) {
    remeasureBirthBox(${nodeExpr}, ${specExpr}.type === 'slot' ? ${specExpr}.slotProperty : ${specExpr}.name,
      Boolean(${specExpr}.fixedWidth), Boolean(${specExpr}.fixedHeight));
  }`
    : '';

/** Runtime template revision — the emitted runtime salts specHash with this
 *  value (bump it whenever the RUNTIME template changes without a COMPONENTS
 *  JSON delta, or amend skips as "unchanged" and canvas keeps the old runtime
 *  behavior). EXPORTED because the plugin engine's specHash mirror
 *  (figma-sync/plugin/engine/entry.ts specHashOf) must salt identically:
 *  the exact-conversion wave introduced the salt in the emitted runtime only,
 *  and stored-vs-mirror equality (plugin-engine-check's own pin) failed by
 *  construction the moment the zip-stale failure in front of it was fixed. */
export const RUNTIME_EMIT_REV = 'rt15-standalone-components-stamp-identity';

/** Contract → the single-component sync script text (pure). */
export function emitFigmaScript(contract: Contract, ctx: FigmaScriptCtx): string {
  return createFigmaEngine(ctx).buildComponentScript(
    contract,
    ctx.contracts,
    ctx.fileKey,
    ctx.mintedTokens,
  );
}

/**
 * The compiled engine over one token corpus: reuse it across contracts (the
 * CLI builds it once for all 51). All functions inside are the generator's
 * own code, moved verbatim — evals/golden.json guards every emitted byte.
 */
export function createFigmaEngine(input: FigmaEngineInput) {
  const variableCollection = input.variableCollection;
  const flatten = flattenTokens;
  const primitives = flatten(input.tokens.primitives);
  const semantic = flatten(input.tokens.semantic);
  const light = flatten(input.tokens.light);
  const dark = flatten(input.tokens.dark);

  // Brand dimension (mirrors scripts/build-tokens.mjs discovery): one Figma
  // collection "Brand" whose modes are the brand names — the enterprise
  // collection-per-dimension pattern. Semantic aliases route through it.
  const brandNames = Object.keys(input.tokens.brands)
    .sort((a, b) => (a === 'default' ? -1 : b === 'default' ? 1 : a.localeCompare(b)));
  const brandModes = new Map(
    brandNames.map((n) => [n, flatten(input.tokens.brands[n])]),
  );

  const figmaName = (dotPath: string) => dotPath.split('.').join('/');
  const cssVarName = (dotPath: string) => `var(--${dotPath.split('.').join('-')})`;

  function resolveLiteral(dotPath: string): unknown {
    // Canvas resolves per the DEFAULT brand mode (canvas variants render the
    // contract's default state; brand modes are switched in the design tool).
    const all = new Map([...primitives, ...brandModes.get('default')!, ...semantic, ...light]);
    let entry = all.get(dotPath);
    let guard = 0;
    while (entry && guard++ < 10) {
      const target = aliasTarget(entry.value);
      if (!target) {
        // A composite (DTCG shadow/typography object, an array) is not a
        // literal any emitter can place: `String()` downstream spelled it
        // "[object Object]" and px() made it NaN, silently. Refuse by name.
        if (entry.value !== null && typeof entry.value === 'object') {
          throw new Error(
            `Token "${dotPath}" resolves to a ${Array.isArray(entry.value) ? 'array' : 'object-form'} $value ` +
              `(${Array.isArray(entry.value) ? `${entry.value.length} entries` : Object.keys(entry.value as object).join(', ')}) — ` +
              'Figma variables hold one string/number/colour; flatten the composite into scalar tokens.',
          );
        }
        return entry.value;
      }
      entry = all.get(target);
    }
    throw new Error(`Cannot resolve token "${dotPath}"`);
  }

const FONT_STYLE_BY_WEIGHT: Record<number, string> = {
  100: 'Thin',
  200: 'Extra Light',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'Semi Bold',
  700: 'Bold',
  800: 'Extra Bold',
  900: 'Black',
};

/**
 * EVERYTHING THAT WAS NOT A COLOUR OR A FONT STACK USED TO BECOME A FLOAT, and
 * `figmaValue` forced it through `px()`, which strips the unit. Polaris ships a
 * `0ms` duration token: it was published as the Figma FLOAT 0, i.e. as ZERO
 * PIXELS — a different fact from "no delay", and nothing said so. `100%` would
 * have become a hard 100px the same way.
 *
 * `core/token-set.ts` — the sibling that compiles a foreign token set — already
 * had this right: try a numeric read, fall back to STRING. A Figma STRING
 * variable holds "0ms" losslessly. Two doors into the same product disagreeing
 * about a token's type is worse than either rule alone, so they now agree.
 * Carriage, not refusal: the fact survives, it just stops claiming to be px.
 */
function figmaType(entry: TokenEntry): 'COLOR' | 'FLOAT' | 'STRING' {
  if (entry.type === 'color') return 'COLOR';
  if (entry.type === 'fontFamily') return 'STRING';
  // AN ALIAS IS NOT A LITERAL — but it is not automatically a FLOAT either.
  // Brand and semantic entries carry "{space.150}", a pointer, and the emitted
  // record spells the target in `perBrand`/`light`/`dark`, using this only to
  // declare the Figma resolvedType. Running the dimension test on the alias
  // TEXT retyped every aliasing dimension token to STRING (the golden manifest
  // caught it); answering "always FLOAT" then broke it the other way. An
  // adversarial probe reproduced the failure through the real
  // buildTokensScript: primitive `motion/duration/fast` correctly became
  // STRING while a semantic alias to it stayed FLOAT, and the runtime does
  // createVariable(..., 'FLOAT') then setValueForMode({type:'VARIABLE_ALIAS'})
  // — FIGMA REFUSES AN ALIAS ACROSS RESOLVED TYPES, so that is a hard
  // live-canvas failure where the old (wrong but bindable) code merely lied.
  // Resolve the chain and type on the TERMINAL entry.
  const target = aliasTarget(entry.value);
  if (target !== null) {
    const seen = new Set<string>();
    let cur: string | null = target;
    while (cur !== null && !seen.has(cur)) {
      seen.add(cur);
      const hop: TokenEntry | undefined = primitives.get(cur);
      if (!hop) return 'FLOAT'; // unresolvable target: keep the historical spelling
      const next = aliasTarget(hop.value);
      if (next === null) return figmaType(hop);
      cur = next;
    }
    return 'FLOAT';
  }
  return pxOrNull(entry.value) === null ? 'STRING' : 'FLOAT';
}

function figmaValue(entry: TokenEntry): unknown {
  if (entry.type === 'color' || entry.type === 'fontFamily') return entry.value;
  if (aliasTarget(entry.value) !== null) return entry.value;
  const n = pxOrNull(entry.value);
  return n === null ? String(entry.value) : n;
}

/** The tokens step's shape referee: a `$value` that is not a string or number
 *  (an object-form shadow/typography composite, an array of layers, a
 *  boolean, null) has no Figma variable shape. `String()` turned it into
 *  "[object Object]" and that text shipped as a STRING variable — reported as
 *  synced, drawing nothing. Refused BY NAME at plan time (figma:plan / the
 *  CLI), so the first-party script can never carry one. */
function refuseCompositeValue(dotPath: string, entry: TokenEntry): void {
  const v = entry.value;
  if (typeof v === 'string' || typeof v === 'number') return;
  const shape =
    v === undefined ? 'no $value'
    : v === null ? 'null'
    : Array.isArray(v) ? `array[${v.length}]`
    : typeof v === 'object' ? `object-form {${Object.keys(v as object).join(', ')}}`
    : typeof v;
  throw new Error(
    `Token "${dotPath}" carries a $value no Figma variable can hold (${shape}) — ` +
      'variables hold one string/number/colour; flatten the composite (shadow → color/offsetX/offsetY/blur/spread, ' +
      'typography → fontFamily/fontSize/…) into scalar tokens before generating.',
  );
}

function scopesFor(dotPath: string, entry: TokenEntry): string[] {
  if (entry.type === 'color') return ['ALL_FILLS', 'STROKE_COLOR'];
  if (dotPath.startsWith('space')) return ['GAP', 'WIDTH_HEIGHT'];
  if (dotPath.startsWith('size') || dotPath.startsWith('container')) return ['WIDTH_HEIGHT'];
  if (dotPath.startsWith('radius')) return ['CORNER_RADIUS'];
  if (dotPath.startsWith('border-width') || dotPath.startsWith('border.width'))
    return ['STROKE_FLOAT'];
  if (entry.type === 'fontWeight') return ['FONT_WEIGHT'];
  if (entry.type === 'fontFamily') return ['FONT_FAMILY'];
  if (dotPath.includes('font') && dotPath.includes('size')) return ['FONT_SIZE'];
  if (dotPath.startsWith('opacity')) return ['OPACITY'];
  return ['ALL_SCOPES'];
}

// ---------------------------------------------------------------------------
// Text styles derived from semantic typography tokens.
//
// Real design systems ship NAMED text styles, not per-node font soup. Every
// semantic `font.<group>.size` leaf mints one style whose name mirrors the
// token path ("control/md" ← font.control.size.md, "badge" ← font.badge.size).
// The style's weight comes from the group's `font.<group>.weight` token when
// declared, else the runtimes' text default ('Medium') — the same fallback a
// bound text node gets, so definitions and consumers can match EXACTLY.
// Family is Inter: font stacks are not canvas-representable (documented
// fidelity scope, same as raw text nodes today). Primitive font.size.* stays
// style-less — text styles are semantic roles, not a size ramp.
// ---------------------------------------------------------------------------

interface DerivedTextStyle {
  name: string;
  /** The semantic size-token dot-path — the style's IDENTITY marker on the
   *  canvas (sharedPluginData ds_contracts/textStyleToken; rename-safe). */
  tokenPath: string;
  fontSize: number;
  fontStyle: string;
  sourceStyleKey?: string;
}

function deriveTextStyles(): {
  /** Canvas upsert list — one entry per semantic style name. */
  styles: DerivedTextStyle[];
  /** Every font-size token path that carries identity → its style (aliases
   *  share one canvas style when names match). */
  byTokenPath: Map<string, DerivedTextStyle>;
} {
  const styles: DerivedTextStyle[] = [];
  const byTokenPath = new Map<string, DerivedTextStyle>();
  const byName = new Map<string, DerivedTextStyle>();
  for (const [p] of semantic) {
    const m = p.match(/^font\.(.+?)\.size(?:\.([^.]+))?$/);
    if (!m) continue;
    const group = m[1];
    const name = [group, ...(m[2] ? [m[2]] : [])].join('/').split('.').join('/');
    const weightPath = `font.${group}.weight`;
    const fontStyle = semantic.has(weightPath)
      ? (FONT_STYLE_BY_WEIGHT[px(resolveLiteral(weightPath))] ?? 'Medium')
      : 'Medium';
    const style: DerivedTextStyle = {
      name,
      tokenPath: p,
      fontSize: px(resolveLiteral(p)),
      fontStyle,
    };
    styles.push(style);
    byName.set(name, style);
    byTokenPath.set(p, style);
  }
  // Exact text-style identity from mint metadata. Prefer imported.text.*
  // (designer vocabulary shared across components) as the canonical upsert
  // tokenPath, then map every component-path axis leaf
  // (imported.avatar.text.font-size.xl) to the same style by name so
  // matchTextStyle resolves whichever path the contract binds.
  const importedFontSize = /^(.+)\.font-size(?:\.[^.]+)?$/;
  const preferShared = (path: string) => path.startsWith('imported.text.');
  const candidates: Array<{
    path: string;
    identity: { name: string; key?: string; weight?: number };
  }> = [];
  for (const [p, entry] of primitives) {
    if (!importedFontSize.test(p)) continue;
    const identity = (
      entry.extensions as
        | {
            dsContracts?: {
              textStyle?: {
                name?: unknown;
                key?: unknown;
                weight?: unknown;
              };
            };
          }
        | undefined
    )?.dsContracts?.textStyle;
    if (!identity || typeof identity.name !== 'string') continue;
    candidates.push({
      path: p,
      identity: {
        name: identity.name,
        ...(typeof identity.key === 'string' ? { key: identity.key } : {}),
        ...(typeof identity.weight === 'number' ? { weight: identity.weight } : {}),
      },
    });
  }
  candidates.sort((a, b) => {
    const pref = Number(preferShared(b.path)) - Number(preferShared(a.path));
    return pref !== 0 ? pref : a.path.localeCompare(b.path);
  });
  for (const { path: p, identity } of candidates) {
    const group = p.replace(/\.font-size(?:\.[^.]+)?$/, '');
    const weightPath = `${group}.font-weight`;
    const fontStyle =
      typeof identity.weight === 'number'
        ? (FONT_STYLE_BY_WEIGHT[identity.weight] ?? 'Medium')
        : primitives.has(weightPath)
          ? (FONT_STYLE_BY_WEIGHT[px(resolveLiteral(weightPath))] ?? 'Medium')
          : 'Medium';
    const fontSize = px(resolveLiteral(p));
    let style = byName.get(identity.name);
    if (!style) {
      style = {
        name: identity.name,
        tokenPath: p,
        fontSize,
        fontStyle,
        ...(identity.key ? { sourceStyleKey: identity.key } : {}),
      };
      styles.push(style);
      byName.set(identity.name, style);
    } else if (style.fontSize !== fontSize || style.fontStyle !== fontStyle) {
      // Same semantic name with contradictory size/weight — never let one
      // definition silently win (exact text-style identity fails closed).
      throw new Error(
        `text-style-identity-refused: text style ${JSON.stringify(identity.name)} has conflicting definitions ` +
          `(${style.fontSize}px/${style.fontStyle} via ${style.tokenPath} vs ${fontSize}px/${fontStyle} via ${p})`,
      );
    } else if (!style.sourceStyleKey && identity.key) {
      style.sourceStyleKey = identity.key;
    }
    byTokenPath.set(p, style);
  }
  styles.sort((a, b) => a.name.localeCompare(b.name));
  return { styles, byTokenPath };
}

const { styles: derivedTextStyles, byTokenPath: textStyleByTokenPath } =
  deriveTextStyles();

// ---------------------------------------------------------------------------
// 01-tokens.js (unchanged mechanism from v1)
// ---------------------------------------------------------------------------

function buildTokensScript(fileKey: string | null): string {
  for (const [p, entry] of primitives) refuseCompositeValue(p, entry);
  for (const [p, entry] of semantic) refuseCompositeValue(p, entry);
  for (const [p, entry] of light) refuseCompositeValue(p, entry);
  for (const [p, entry] of dark) refuseCompositeValue(p, entry);
  for (const [, tokens] of brandModes) for (const [p, entry] of tokens) refuseCompositeValue(p, entry);
  const prim = [...primitives].map(([p, entry]) => ({
    name: figmaName(p),
    type: figmaType(entry),
    value: figmaValue(entry),
    scopes: scopesFor(p, entry),
    codeSyntax: cssVarName(p),
  }));

  // Brand collection payload: per-variable alias target per brand mode.
  const brandDefault = brandModes.get('default')!;
  const brand: Array<Record<string, unknown>> = [];
  for (const [p, entry] of brandDefault) {
    const perBrand: Record<string, string> = {};
    for (const [brandName, tokens] of brandModes) {
      const target = aliasTarget(tokens.get(p)?.value);
      if (!target) throw new Error(`Brand token "${p}" must be an alias in brand "${brandName}"`);
      perBrand[pascal(brandName)] = figmaName(target);
    }
    brand.push({
      name: figmaName(p),
      type: figmaType(entry),
      perBrand,
      scopes: scopesFor(p.replace(/^brand\./, ''), entry),
      codeSyntax: cssVarName(p),
    });
  }

  const sem: Array<Record<string, unknown>> = [];
  for (const [p, entry] of semantic) {
    const target = aliasTarget(entry.value);
    if (!target) throw new Error(`Semantic token "${p}" must be an alias`);
    sem.push({
      name: figmaName(p),
      type: figmaType(entry),
      light: figmaName(target),
      dark: figmaName(target),
      scopes: scopesFor(p, entry),
      codeSyntax: cssVarName(p),
    });
  }
  for (const [p, entry] of light) {
    const lightTarget = aliasTarget(entry.value);
    const darkEntry = dark.get(p);
    const darkTarget = darkEntry ? aliasTarget(darkEntry.value) : null;
    if (!lightTarget || !darkTarget)
      throw new Error(`Mode token "${p}" must be an alias in both modes`);
    sem.push({
      name: figmaName(p),
      type: figmaType(entry),
      light: figmaName(lightTarget),
      dark: figmaName(darkTarget),
      scopes: scopesFor(p, entry),
      codeSyntax: cssVarName(p),
    });
  }

  return `// GENERATED by scripts/generate-figma.ts — DO NOT EDIT.
// Source of truth: tokens/*.tokens.json
// Upserts variable collections: Primitives (mode "Value"), Brand (one mode
// per brand), Semantic (modes "Light"/"Dark", aliasing primitives AND brand).
// Leftovers in those three collections are NAMED; they are removed only when
// globalThis.DS_PRUNE_TOKENS === true (opt-in, FC-APPLY-TOKENS-NOT-PRUNED).
// Designer-edited variable VALUES are NAMED (variableDrift) and kept unless
// globalThis.DS_OVERWRITE_TOKENS === true (FC-APPLY-TOKENS-KEEP-EDITS).
const PRIMITIVES = ${JSON.stringify(prim)};
const BRAND = ${JSON.stringify(brand)};
const BRAND_MODES = ${JSON.stringify(brandNames.map((n) => pascal(n)))};
const SEMANTIC = ${JSON.stringify(sem)};
// Named text styles derived from semantic font.<group>.size tokens.
const TEXT_STYLES = ${JSON.stringify(derivedTextStyles)};

// File guard: multi-file bridge routing has been observed to hit the wrong
// file — never write without verifying the target.
const EXPECTED_FILE_KEY = ${JSON.stringify(fileKey)};
if (EXPECTED_FILE_KEY && figma.fileKey && figma.fileKey !== EXPECTED_FILE_KEY) {
  throw new Error('WRONG FILE: expected ' + EXPECTED_FILE_KEY + ', got ' + figma.fileKey);
}

function hexToRgb(value) {
  // Foreign DTCG wraps carry color values VERBATIM — Polaris spells them as
  // 'rgba(r, g, b, a)' strings, not hex (the Phase B live run failed on
  // setValueForMode with NaN channels; the fix now lives at the source).
  // Accepts #rgb / #rrggbb / #rrggbbaa and rgb() / rgba(); alpha preserved.
  const v = String(value).trim();
  const fn = v.match(/^rgba?\\(([^)]+)\\)$/);
  if (fn) {
    const parts = fn[1].split(/[\\s,/]+/).filter(Boolean).map(parseFloat);
    const c = { r: parts[0] / 255, g: parts[1] / 255, b: parts[2] / 255 };
    if (parts.length > 3 && !Number.isNaN(parts[3])) c.a = parts[3];
    return c;
  }
  let h = v.replace('#', '');
  if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
  const c = {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
  if (h.length === 8) c.a = parseInt(h.slice(6, 8), 16) / 255;
  return c;
}

const collections = await figma.variables.getLocalVariableCollectionsAsync();
const allVars = await figma.variables.getLocalVariablesAsync();
const varsIn = (col) => allVars.filter((v) => v.variableCollectionId === col.id);
${guardedValueUpsertRuntime()}
let prim = collections.find((c) => c.name === 'Primitives');
if (!prim) prim = figma.variables.createVariableCollection('Primitives');
if (prim.modes[0].name !== 'Value') prim.renameMode(prim.modes[0].modeId, 'Value');
const primModeId = prim.modes[0].modeId;
const primByName = {};
for (const v of varsIn(prim)) primByName[v.name] = v;
let createdPrim = 0;
for (const t of PRIMITIVES) {
  let v = primByName[t.name];
  const isNew = !v;
  if (!v) {
    v = figma.variables.createVariable(t.name, prim, t.type);
    primByName[t.name] = v;
    createdPrim++;
  }
  applyValue(v, primModeId, 'Value', t.type === 'COLOR' ? hexToRgb(t.value) : t.value, isNew);
  v.scopes = t.scopes;
  v.setVariableCodeSyntax('WEB', t.codeSyntax);
}

let brandCol = collections.find((c) => c.name === 'Brand');
if (!brandCol) brandCol = figma.variables.createVariableCollection('Brand');
if (brandCol.modes[0].name !== BRAND_MODES[0]) brandCol.renameMode(brandCol.modes[0].modeId, BRAND_MODES[0]);
const brandModeIds = {};
brandModeIds[BRAND_MODES[0]] = brandCol.modes[0].modeId;
for (const modeName of BRAND_MODES.slice(1)) {
  const existing = brandCol.modes.find((m) => m.name === modeName);
  brandModeIds[modeName] = existing ? existing.modeId : brandCol.addMode(modeName);
}
const brandByName = {};
for (const v of varsIn(brandCol)) brandByName[v.name] = v;
let createdBrand = 0;
for (const t of BRAND) {
  let v = brandByName[t.name];
  const isNew = !v;
  if (!v) {
    v = figma.variables.createVariable(t.name, brandCol, t.type);
    brandByName[t.name] = v;
    createdBrand++;
  }
  for (const modeName of BRAND_MODES) {
    const target = primByName[t.perBrand[modeName]];
    if (!target) throw new Error('Missing primitive ' + t.perBrand[modeName] + ' for ' + t.name);
    applyValue(v, brandModeIds[modeName], modeName, { type: 'VARIABLE_ALIAS', id: target.id }, isNew);
  }
  v.scopes = t.scopes;
  v.setVariableCodeSyntax('WEB', t.codeSyntax);
}

let sem = collections.find((c) => c.name === 'Semantic');
if (!sem) sem = figma.variables.createVariableCollection('Semantic');
if (sem.modes[0].name !== 'Light') sem.renameMode(sem.modes[0].modeId, 'Light');
const lightModeId = sem.modes[0].modeId;
let darkMode = sem.modes.find((m) => m.name === 'Dark');
const darkModeId = darkMode ? darkMode.modeId : sem.addMode('Dark');
const semByName = {};
for (const v of varsIn(sem)) semByName[v.name] = v;
let createdSem = 0;
for (const t of SEMANTIC) {
  let v = semByName[t.name];
  const isNew = !v;
  if (!v) {
    v = figma.variables.createVariable(t.name, sem, t.type);
    semByName[t.name] = v;
    createdSem++;
  }
  const lightVar = primByName[t.light] || brandByName[t.light];
  const darkVar = primByName[t.dark] || brandByName[t.dark];
  if (!lightVar || !darkVar) throw new Error('Missing primitive/brand for ' + t.name);
  applyValue(v, lightModeId, 'Light', { type: 'VARIABLE_ALIAS', id: lightVar.id }, isNew);
  applyValue(v, darkModeId, 'Dark', { type: 'VARIABLE_ALIAS', id: darkVar.id }, isNew);
  v.scopes = t.scopes;
  v.setVariableCodeSyntax('WEB', t.codeSyntax);
}

const owned = new Map();
owned.set(prim.id, new Set(PRIMITIVES.map((t) => t.name)));
owned.set(brandCol.id, new Set(BRAND.map((t) => t.name)));
owned.set(sem.id, new Set(SEMANTIC.map((t) => t.name)));
${ownedCollectionPruneRuntime()}

// Text styles: upsert by IDENTITY MARKER (ds_contracts/textStyleToken =
// the semantic size-token path), never by name — a rename on either side
// must not fork identity, and a foreign style that happens to share a name
// is never touched (same rule as component sets). Idempotent: re-runs
// update the marked style in place.
const localTextStyles = await figma.getLocalTextStylesAsync();
const styleByToken = {};
for (const s of localTextStyles) {
  const tp = s.getSharedPluginData('ds_contracts', 'textStyleToken');
  if (tp) styleByToken[tp] = s;
}
let createdStyles = 0;
for (const t of TEXT_STYLES) {
  let s = styleByToken[t.tokenPath];
  if (!s) {
    s = figma.createTextStyle();
    s.setSharedPluginData('ds_contracts', 'textStyleToken', t.tokenPath);
    styleByToken[t.tokenPath] = s;
    createdStyles++;
  }
  if (t.sourceStyleKey) {
    s.setSharedPluginData('ds_contracts', 'sourceTextStyleKey', t.sourceStyleKey);
  }
  await figma.loadFontAsync({ family: 'Inter', style: t.fontStyle });
  s.name = t.name;
  s.fontName = { family: 'Inter', style: t.fontStyle };
  s.fontSize = t.fontSize;
  s.description = 'ds_contracts: derived from tokens/' + t.tokenPath;
}

reportVariableDrift('Primitives/Brand/Semantic');
return {
  primitives: { collectionId: prim.id, total: PRIMITIVES.length, created: createdPrim },
  brand: { collectionId: brandCol.id, modes: BRAND_MODES, total: BRAND.length, created: createdBrand },
  semantic: { collectionId: sem.id, total: SEMANTIC.length, created: createdSem },
  textStyles: { total: TEXT_STYLES.length, created: createdStyles },
  pruned,
  leftovers,
  pruneSkipped,
  variableDrift,
  driftOverwritten: DS_OVERWRITE_TOKENS,
};
`;
}

// ---------------------------------------------------------------------------
// Node specs — the compiled form of a contract's anatomy tree
// ---------------------------------------------------------------------------



interface TextCtx {
  textFill?: string;
  /** Token dot-path behind textFill — icon parts resolve it to a literal hex. */
  textFillPath?: string;
  /** R7 LITERAL INK (2026-08-22, core/root-text-check.ts): a part's
   *  `literals.color`, compile-parsed — the TEXT fill when no token binds
   *  the channel on the same part. Inherited by text / icon children exactly
   *  as textFill is; a child's own `color` (token OR literal) replaces it.
   *  Until this round applyLiterals had no `color` case: the ink compiled to
   *  nothing, the text drew Figma's default black, and nothing named it. */
  textFillLit?: { r: number; g: number; b: number; a?: number };
  /** The same literal as CSS text — what an icon child bakes into its glyph
   *  markup in place of the token path's resolved literal (iconSvg). */
  textFillLitCss?: string;
  /** Round 4: token dot-path behind a part's CSS `fill` channel — promoted
   *  svg hosts' glyph paint (attribute-less paths inherit it). */
  glyphFillPath?: string;
  fontSize?: number;
  fontStyle?: string;
  /** Token dot-path behind fontSize — text nodes whose bindings exactly match
   *  a derived text style's definition carry that style (see matchTextStyle). */
  fontSizePath?: string;
  /** The same token in Figma's slash spelling — bound to `fontSize` when the
   *  node cannot ride a style (see NodeSpec.fontSizeVar). */
  fontSizeVar?: string;
  /** The weight token in Figma's slash spelling — stamped, never bound
   *  (Figma cannot bind a variable to font weight). See NodeSpec.fontWeightVar. */
  fontWeightVar?: string;
  /** The line-height token in Figma's slash spelling — stamped, never bound.
   *  See NodeSpec.lineHeightVar. */
  lineHeightVar?: string;
  /** Resolved line height — see NodeSpec.lineHeight. */
  lineHeight?: number | { value: number; unit: 'PIXELS' | 'PERCENT' };
  /** v15: PIXEL letter spacing — resolved literal (lineHeight discipline). */
  letterSpacing?: number;
  /** v15 declared text facts (draw verdicts) — inherited to text children
   *  like every other text channel. */
  textCase?: NodeSpec['textCase'];
  textDecoration?: NodeSpec['textDecoration'];
  textAlignH?: NodeSpec['textAlignH'];
  fontFamily?: string;
  textTruncation?: boolean;
  /** FC-FONT-SLANT-NOT-CARRIED: the declared `font-style` slant. It is kept
   *  SEPARATE from `fontStyle` (which is Figma's WEIGHT name) rather than
   *  baked into it, because the two arrive from different channels and in
   *  either order — a child that binds its own `font-weight` token rewrites
   *  `fontStyle` wholesale (applyTokens), which would silently erase a slant
   *  inherited from its parent. Composed into the face name once, at the
   *  spec boundary (figmaFaceStyle). */
  fontItalic?: boolean;
}

/** TextCtx → the Figma face name. Inter spells the italic faces
 *  "<Weight> Italic", except weight 400 whose italic is plain "Italic" (there
 *  is no "Regular Italic"). Non-italic contexts return exactly what the
 *  weight resolution produced, so slant-free corpora emit byte-identically. */
const figmaFaceStyle = (ctx: TextCtx): string => {
  const weight = ctx.fontStyle ?? 'Medium';
  if (!ctx.fontItalic) return weight;
  return weight === 'Regular' ? 'Italic' : `${weight} Italic`;
};

/** The dump v1.2 single-DROP_SHADOW box-shadow grammar
 *  ("0px 2px 4px [2px] #00000029") → the runtime effect struct. Anything
 *  else (multi-shadow, keywords, rgba()) has no canvas projection — the
 *  proposer only ever mints this grammar; foreign spellings stay CSS-only. */
function parseBoxShadow(value: string): NodeSpec['dropShadow'] | undefined {
  const m = value.trim().match(/^(-?[\d.]+)px (-?[\d.]+)px ([\d.]+)px(?: (-?[\d.]+)px)? (#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?)$/);
  if (!m) return undefined;
  const out: NodeSpec['dropShadow'] = { x: parseFloat(m[1]), y: parseFloat(m[2]), radius: parseFloat(m[3]), color: m[5].toLowerCase() };
  if (m[4] !== undefined && parseFloat(m[4]) !== 0) out.spread = parseFloat(m[4]);
  return out;
}

/** Split a CSS value list on TOP-LEVEL commas (commas inside function
 *  parentheses — rgba(), gradients — do not split). */
function splitTopLevel(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** A CSS color literal (hex / rgb() / rgba()) → RGBA floats. */
function parseCssColor(v: string): { r: number; g: number; b: number; a?: number } | undefined {
  return parseLitColor(v);
}

/** v15 (S4/matrix a.1): the FULL box-shadow stack grammar — multi-layer,
 *  inset, hex OR rgb()/rgba() colors (browser-serialized values put the
 *  color first; authored values may put it last — both accepted). Layers the
 *  single-drop dump grammar already carries never reach here (parseBoxShadow
 *  runs first, keeping existing emissions byte-identical). Lengths accept
 *  px/rem/em (rem/em at the documented 1rem = 16px base) — B-3 finding 6:
 *  Polaris spells its shadow tokens in rem (`0rem -0.0625rem … inset`), and
 *  the px-only grammar refused the whole stack, silently dropping the
 *  secondary/tertiary Button border ring. Unparseable layers refuse the
 *  WHOLE stack (undefined) — a partial shadow would lie. */
function parseShadowStack(value: string): NodeSpec['effectStack'] | undefined {
  if (value.trim() === 'none') return [];
  const layers = splitTopLevel(value.trim());
  const out: NonNullable<NodeSpec['effectStack']> = [];
  for (const layer of layers) {
    let rest = layer.trim();
    let inner = false;
    if (/(^| )inset( |$)/.test(rest)) {
      inner = true;
      rest = rest.replace(/(^| )inset( |$)/, ' ').trim();
    }
    const colorMatch = rest.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))/);
    if (!colorMatch) return undefined;
    const color = parseCssColor(colorMatch[1]);
    if (!color) return undefined;
    rest = rest.replace(colorMatch[1], '').trim();
    const lengths = rest.split(/\s+/).filter(Boolean);
    if (lengths.length < 2 || lengths.length > 4) return undefined;
    const px4 = lengths.map((l) => {
      const m = l.match(/^(-?[\d.]+)(px|rem|em)?$/);
      if (!m) return NaN;
      const n = parseFloat(m[1]);
      if (m[2] === 'rem' || m[2] === 'em') return n * 16;
      // A bare number is only valid CSS as 0 — anything else is foreign.
      return m[2] === 'px' || n === 0 ? n : NaN;
    });
    if (px4.some(Number.isNaN)) return undefined;
    const e: NonNullable<NodeSpec['effectStack']>[number] = {
      ...(inner ? { inner: true } : {}),
      x: px4[0],
      y: px4[1],
      radius: px4[2] ?? 0,
      color,
    };
    if (px4[3] !== undefined && px4[3] !== 0) e.spread = px4[3];
    out.push(e);
  }
  return out;
}

/** v15 (S4/matrix a.3): CSS linear-gradient() → angle + stops. Radial/conic
 *  gradients and unparseable stops return undefined — the caller names the
 *  limit in the component description, never drops it silently. */
function parseCssGradient(value: string): NodeSpec['gradient'] | undefined {
  const m = value.trim().match(/^linear-gradient\((.*)\)$/s);
  if (!m) return undefined;
  const args = splitTopLevel(m[1]);
  if (args.length === 0) return undefined;
  let angle = 180; // CSS default: to bottom
  let stopArgs = args;
  const first = args[0].trim();
  const deg = first.match(/^(-?[\d.]+)deg$/);
  if (deg) {
    angle = parseFloat(deg[1]);
    stopArgs = args.slice(1);
  } else if (first.startsWith('to ')) {
    const DIR: Record<string, number> = { 'to top': 0, 'to right': 90, 'to bottom': 180, 'to left': 270 };
    if (!(first in DIR)) return undefined; // corner directions: box-ratio-dependent — named limit
    angle = DIR[first];
    stopArgs = args.slice(1);
  }
  if (stopArgs.length < 2) return undefined;
  const stops: NonNullable<NodeSpec['gradient']>['stops'] = [];
  for (const s of stopArgs) {
    const parts = s.trim().match(/^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))(?:\s+(-?[\d.]+)%)?$/);
    if (!parts) return undefined; // double-position / length stops / hints — named limit
    const color = parseCssColor(parts[1]);
    if (!color) return undefined;
    stops.push({ color, position: parts[2] !== undefined ? parseFloat(parts[2]) / 100 : -1 });
  }
  // Missing positions interpolate evenly (the CSS rule) between neighbors.
  if (stops[0].position === -1) stops[0].position = 0;
  if (stops[stops.length - 1].position === -1) stops[stops.length - 1].position = 1;
  for (let i = 0; i < stops.length; i++) {
    if (stops[i].position !== -1) continue;
    let j = i;
    while (stops[j].position === -1) j++;
    const prev = stops[i - 1].position;
    const step = (stops[j].position - prev) / (j - i + 1);
    for (let k = i; k < j; k++) stops[k].position = prev + step * (k - i + 1);
  }
  for (const s of stops) s.position = Math.min(1, Math.max(0, s.position));
  return { angle: ((angle % 360) + 360) % 360, stops };
}

const ALIGN_FIGMA: Record<string, 'MIN' | 'CENTER' | 'MAX' | 'BASELINE'> = {
  start: 'MIN',
  center: 'CENTER',
  end: 'MAX',
  stretch: 'MIN',
  // Native counterAxisAlignItems value — see the VERTICAL guard in layoutSpec.
  baseline: 'BASELINE',
};
const JUSTIFY_FIGMA: Record<string, LayoutSpec['primary']> = {
  start: 'MIN',
  center: 'CENTER',
  end: 'MAX',
  'space-between': 'SPACE_BETWEEN',
};

/** CARBON LIVE-DEFECT ROUND (D5) — BOUND A VIEWPORT-PINNED OVERLAY SCRIM.
 *
 *  Carbon's Modal is `position: fixed; inset: 0` with a VISIBLE
 *  rgba(0,0,0,.6) scrim, so `demoteFullBleedScrim` correctly REFUSES to
 *  demote it (that rule is what keeps MUI's Dialog whole). The consequence
 *  was faithful to the DOM and useless on canvas: four modal variants as
 *  900×1000 dim rectangles — the exact width and height of the capture
 *  viewport. MUI's Dialog carries the same shape (measured: 900×126 — the
 *  900 is the stage, not the dialog), so this is a SHARED pre-existing
 *  canvas defect that Carbon made unmissable by pinning the height too.
 *
 *  The signature is exact and needs no new capture fact: only an OUT-OF-FLOW
 *  box has computed insets at all, so a ROOT carrying all four of
 *  top/right/bottom/left resolving to 0 IS `inset: 0` on a fixed/absolute
 *  layer. Its width/height then measured whatever contained it — the stage.
 *
 *  What changes: the CANVAS box only. The scrim keeps its fill, its layout,
 *  its inset and z-index channels, and the contract is not edited — the
 *  component simply bounds to the overlay's own content (the paper) instead
 *  of reproducing the capture viewport. Named in the code-only facts. */
function boundFullBleedScrimRoot(
  rootSpec: NodeSpec,
  root: Part,
  subst: Record<string, string>,
  notes: CodeOnlyFactObservation[],
): void {
  // A `position: relative | static | sticky` root's inset channels are INERT
  // in CSS — the box is still in flow and its width/height are its own. Only
  // an OUT-OF-FLOW layer can be pinned to the viewport. (Same exclusion
  // `insetOverlayOffsets` makes for parts, and the reason it matters: MUI's
  // Accordion / Checkbox / Slider / Switch roots all declare position
  // relative AND carry inset-0 channels — bounding those would have thrown
  // away four real component boxes.)
  const pos = root.declared?.['position'];
  if (pos === 'relative' || pos === 'static' || pos === 'sticky') return;
  const tokens = resolveTokens(root, subst);
  const lits = resolveLiterals(root, subst);
  const sides = ['top', 'right', 'bottom', 'left'] as const;
  const zero = sides.every((s) => {
    if (tokens[s] !== undefined) {
      let tokenPath = tokens[s].slice(1, -1);
      for (const [propName, v] of Object.entries(subst)) tokenPath = tokenPath.replaceAll(`{${propName}}`, v);
      return px(resolveLiteral(tokenPath)) === 0;
    }
    if (lits[s] !== undefined) return px(lits[s]) === 0;
    return false;
  });
  if (!zero) return;
  const hadW = rootSpec.fixedWidth !== undefined || rootSpec.lits?.width !== undefined;
  const hadH = rootSpec.fixedHeight !== undefined || rootSpec.lits?.height !== undefined;
  if (!hadW && !hadH) return;
  const was = `${rootSpec.fixedWidth?.px ?? rootSpec.lits?.width ?? '—'}×${rootSpec.fixedHeight?.px ?? rootSpec.lits?.height ?? '—'}`;
  delete rootSpec.fixedWidth;
  delete rootSpec.fixedHeight;
  if (rootSpec.lits) {
    delete rootSpec.lits.width;
    delete rootSpec.lits.height;
  }
  if (rootSpec.bindings) {
    delete rootSpec.bindings.width;
    delete rootSpec.bindings.height;
  }
  rootSpec.scrimBounded = true;
  notes.push({
    part: 'root',
    variant: rootSpec.name,
    kind: 'scrim',
    channel: 'inset',
    value: was,
    reason:
      "viewport-pinned overlay scrim (inset:0) — the captured box is the CAPTURE STAGE, not the component; the canvas box is bound to the overlay's content (deliberate canvas-vs-DOM divergence; the contract's inset/width/height channels are unchanged)",
  });
}

/** A2 grid: contract align vocabulary → the canvas enum (P3/P4's four).
 *  'auto' never compiles — AUTO is the canvas default, omitted for a
 *  deterministic minimal spec. */
const GRID_ALIGN_FIGMA: Record<string, 'MIN' | 'CENTER' | 'MAX'> = {
  start: 'MIN',
  center: 'CENTER',
  end: 'MAX',
};

function layoutSpec(part: Part, isRoot: boolean, subst: Record<string, string> = {}): LayoutSpec {
  // v7 layoutByProp: each canvas variant is compiled with every enum axis's
  // value (subst), so the per-variant layout override resolves right here.
  const l = resolveLayout(part, subst);
  // A2 grid (G1): declared tracks compile to the API's structured spelling;
  // gaps resolve to px at compile time (numbers or token refs). Zero tracks
  // can never reach here — the schema refuses them (P2b silent rewrite).
  if (l?.display === 'grid') {
    const toTrack = (t: NonNullable<typeof l.rows>[number]): GridTrackSpec =>
      'px' in t ? { type: 'FIXED', value: t.px }
      : 'fr' in t ? { type: 'FLEX', value: t.fr }
      : { type: 'HUG', value: 1 };
    const gapPx = (v: number | string | undefined): number => {
      if (v === undefined) return 0;
      if (typeof v === 'number') return v;
      let tokenPath = v.slice(1, -1);
      for (const [propName, val] of Object.entries(subst)) tokenPath = tokenPath.replaceAll(`{${propName}}`, val);
      const n = pxOrNull(String(resolveLiteral(tokenPath)));
      if (n === null) throw new Error(`grid gap token "${v}" does not resolve to a px value`);
      return n;
    };
    return {
      // primary/counter are flex fields — inert under GRID (the runtime's
      // grid branch never writes them); pinned to MIN for determinism.
      mode: 'GRID',
      primary: 'MIN',
      counter: 'MIN',
      grid: {
        // Under flow, rows are re-declared per compiled variant by
        // stampGridCells (ceil of the ACTUAL child count — G5/P9).
        rows: (l.rows ?? []).map(toTrack),
        columns: (l.columns ?? []).map(toTrack),
        rowGap: gapPx(l.gap?.row),
        columnGap: gapPx(l.gap?.column),
        ...(l.flow === 'row' ? { flow: 'ROW_AUTO_FLOW' as const } : {}),
        // G8: the intrinsic-axis fact. `fit-content` was always a legal Part
        // literal and always the CSS truth; the grid path simply dropped it.
        ...(gridAxisSizing(part, 'width') === 'hug' ? { hugWidth: true as const } : {}),
        ...(gridAxisSizing(part, 'height') === 'hug' ? { hugHeight: true as const } : {}),
      },
    };
  }
  // Polaris TextField live finding: root carries `layout.align: center` AND
  // `declared.display: block`. Presence of `l` used to short-circuit the
  // block-flow VERTICAL rule below, so label sat BESIDE the input (row).
  // CSS block roots still stack; align without direction must not force a row.
  if (l && !l.direction && part.declared?.['display'] === 'block') {
    const counter = l.align ? ALIGN_FIGMA[l.align] : 'MIN';
    return {
      mode: 'VERTICAL',
      primary: l.justify ? JUSTIFY_FIGMA[l.justify] : 'MIN',
      counter: counter === 'BASELINE' ? 'MIN' : counter,
      stretchChildren: true,
    };
  }
  if (!l && isRoot) {
    // BLOCK-FLOW ROOT (Card live-paste-4 finding): a declared display:block
    // root is CSS block flow — children stack vertically from the top-left
    // and block children span the width. The centered default is for
    // control-like roots (Button); centering a Card's content is wrong.
    if (part.declared?.['display'] === 'block') {
      return { mode: 'VERTICAL', primary: 'MIN', counter: 'MIN', stretchChildren: true };
    }
    return { mode: 'HORIZONTAL', primary: 'CENTER', counter: 'CENTER' };
  }
  // BLOCK-FLOW PART (round 6, Menu live finding): the block-flow rule above
  // was ROOT-ONLY, so a display:block container DEEPER in the tree fell
  // through to the HORIZONTAL default. MUI's `ul.MuiList-root` is exactly
  // that — the live paste drew the three MenuItems SIDE BY SIDE (and the
  // second one clipped off the paper). CSS decides by the CHILDREN's
  // outside display: a block box whose in-flow children are all BLOCK-LEVEL
  // stacks them vertically; inline-level children (MUI's inline-flex
  // IconButtons in an end-adornment, the pagination arrows) form a LINE box
  // and stay horizontal. `layout.display` is 'flex' | 'inline-flex' by
  // schema, so the two cases are distinguishable without guessing. A
  // single-child block box is left alone (one child lays out the same in
  // both modes and the byte-neutrality of every prior contract matters).
  //
  // CARBON LIVE-DEFECT ROUND (D3) — the rule was too narrow in TWO ways and
  // both of them drew overlapping children on the live canvas:
  //   (a) the TRIGGER was `display:block` only. Carbon's accordion item is an
  //       `<li>` (display:list-item) and its toggle label is an `inline` box —
  //       both are CSS block CONTAINERS, and both drew a 472px panel beside a
  //       174px heading inside a 328px item / the word "Toggle" on top of the
  //       track. list-item / flow-root / inline join block.
  //   (b) a `display:none` child was counted as an in-flow sibling, so one
  //       hidden part (accordion's second wrapper) vetoed the whole rule.
  // And the CSS truth the `every` test approximated is BLOCKIFICATION: a
  // block container with AT LEAST ONE block-level in-flow child wraps every
  // child in anonymous block boxes and stacks them. `every` is only the safe
  // half of that. The `some` half is taken here ONLY when no two inline-level
  // children are ADJACENT — a run of ≥2 inline siblings shares one anonymous
  // block (one LINE), which a flat VERTICAL frame cannot express, so that
  // shape keeps the row default and is named residue rather than guessed at.
  const BLOCK_FLOW_CONTAINER = new Set(['block', 'list-item', 'flow-root', 'inline']);
  if (!l && !isRoot && BLOCK_FLOW_CONTAINER.has(part.declared?.['display'] ?? '')) {
    const outOfFlow = (k: Part): boolean =>
      k.declared?.['position'] === 'absolute' ||
      k.declared?.['position'] === 'fixed' ||
      k.declared?.['display'] === 'none' ||
      // …and a part placed absolutely by a CONDITION (the v9 decor spelling:
      // `stylesWhen … styles.position = absolute`) is out of flow too. Polaris's
      // RadioButton dot is exactly that, and counting it as an in-flow inline
      // sibling is what made this rule's answer depend on a node that never
      // participates in the flow.
      (k.stylesWhen ?? []).some((sw) => sw.styles['position'] === 'absolute' || sw.styles['position'] === 'fixed');
    const kids = Object.values(part.parts ?? {}).filter((k) => !outOfFlow(k));
    const blockLevel = (k: Part): boolean => {
      const d = k.layout?.display ?? k.declared?.['display'];
      return d === 'flex' || d === 'block' || d === 'grid' || d === 'list-item' || d === 'table' || d === 'flow-root';
    };
    const adjacentInlines = kids.some((k, i) => i > 0 && !blockLevel(k) && !blockLevel(kids[i - 1]));
    if (kids.length >= 2 && (kids.every(blockLevel) || (kids.some(blockLevel) && !adjacentInlines))) {
      return { mode: 'VERTICAL', primary: 'MIN', counter: 'MIN', stretchChildren: true };
    }
  }
  const mode: 'HORIZONTAL' | 'VERTICAL' = l?.direction?.startsWith('column') ? 'VERTICAL' : 'HORIZONTAL';
  const counter = l?.align ? ALIGN_FIGMA[l.align] : 'MIN';
  return {
    mode,
    primary: l?.justify ? JUSTIFY_FIGMA[l.justify] : 'MIN',
    // counterAxisAlignItems = 'BASELINE' is a runtime THROW on a VERTICAL
    // auto-layout frame; a column's baseline is its start edge anyway, so the
    // column projection is MIN. (No-op for every other value.)
    counter: counter === 'BASELINE' && mode === 'VERTICAL' ? 'MIN' : counter,
    // Round 4 (CSS truth): flex align-items DEFAULTS to stretch — an
    // align-unset flex container stretches children on the counter axis
    // (the Banner ribbon spans the card). Explicit align values behave as
    // before.
    stretchChildren: (l?.align === 'stretch' || (l !== undefined && l.align === undefined)) || undefined,
    // v15 (S4/matrix a.8): flex-wrap → native layoutWrap 'WRAP'.
    ...(l?.wrap ? { wrap: true } : {}),
  };
}

/** Reversed flex directions have no auto-layout equivalent — the honest
 *  canvas rendering is the same children in reversed order, resolved per
 *  variant at compile time. */
const isReversed = (part: Part, subst: Record<string, string>): boolean =>
  resolveLayout(part, subst)?.direction?.endsWith('-reverse') ?? false;

/** Distribute a part's CSS token bindings into Figma spec fields. */
function applyTokens(
  spec: NodeSpec,
  tokens: Record<string, string>,
  subst: Record<string, string>,
  ctx: TextCtx,
  /** task #37: the part's MEASURED sizing evidence for its max-width
   *  channel — see the `max-width` case below and Part.hugsBelowMaxWidth. */
  hugsBelowMaxWidth?: boolean,
  /** The part's DECLARED keyword facts. Only `outline-style` is read here,
   *  and it is the fact that decides whether the outline pair is a drawn
   *  ring (an OUTSIDE-aligned canvas stroke) or a resting CSS
   *  focus-ring reservation that paints nothing — see the outline cases. */
  declared?: Record<string, string>,
  /** R7: whether THIS combo places the part absolutely — the emitter's own
   *  gate (isAbsoluteThisCombo: declared position OR a matching stylesWhen
   *  `position: absolute`). The inset default below used to read only the
   *  DECLARED position, so a part that goes absolute under one enum value
   *  (Astryx Slider's vertical readout, Carbon's checked checkmark) had its
   *  lowered offsets named as an in-flow drop — a false receipt. Callers
   *  that do not pass it keep the declared-only test byte-identically. */
  absoluteThisCombo?: boolean,
): TextCtx {
  const next: TextCtx = { ...ctx };
  const inFlowInsets = absoluteThisCombo === undefined ? (declared?.position ?? 'static') !== 'absolute' : !absoluteThisCombo;
  // ROUND 9 — DOES THIS OUTLINE ACTUALLY PAINT?
  //
  // A CSS outline with no `outline-style` draws NOTHING, and `outline: Npx
  // solid transparent` is a standard idiom for reserving focus-ring space,
  // so CSS-extracted contracts carry resting outline pairs in bulk — Carbon
  // alone has them on Tabs, TextInput, InlineNotification and Tag, the last
  // with OPAQUE per-tone colours. None of those is a drawn ring, and turning
  // them into canvas strokes put a 2px outline around every Tag in the
  // library. The pair alone therefore cannot decide; the declared KEYWORD
  // can, and dump v1.11's inversion declares it for exactly the strokes that
  // are drawn OUTSIDE.
  const outlinePaints =
    declared?.['outline-style'] !== undefined && declared['outline-style'] !== 'none';
  // Round 5c (canvas-gate finding): the floor promotes border-COLOR
  // longhands (border-top/right/bottom/left-color — the RadioButton ring
  // rode them and silently dropped, so the unchecked circle never drew).
  // Figma strokes carry ONE paint: lower to the stroke when every carried
  // side resolves to the same variable; disagreeing sides keep the CSS-side
  // truth (the same one-paint limit the per-side width fields do not have).
  const SIDE_COLOR_CHANNELS = ['border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'];
  const sidePaths = SIDE_COLOR_CHANNELS.filter((chn) => tokens[chn] !== undefined).map((chn) => {
    let p = tokens[chn].slice(1, -1);
    for (const [propName, value] of Object.entries(subst)) p = p.replaceAll(`{${propName}}`, value);
    return p;
  });
  // Uniformity is a VALUE question (the floor mints one leaf PER SIDE —
  // four different names, one color); the bound paint uses the first side's
  // variable. A width source must exist: a border-color with border-width 0
  // is INVISIBLE in CSS, and lowering it without a width would let the
  // renderer's 1px default manufacture a ring the real component never
  // draws (the Tag disabled state carries recolored 0-width borders).
  const sideValues = new Set(sidePaths.map((p) => String(resolveLiteral(p))));
  const hasWidthSource = ['border-width', 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width']
    .some((chn) => tokens[chn] !== undefined);
  const uniformSideStroke = sidePaths.length > 0 && sideValues.size === 1 && hasWidthSource ? figmaName(sidePaths[0]) : null;
  // Decided BEFORE the loop so it cannot depend on which channel the switch
  // happens to reach first: a Figma node has ONE strokes paint, so a drawn
  // outline and a drawn border compete for it, and the winner must not be
  // whichever key `Object.entries` yields last. The BORDER wins — it is the
  // resting fact — and the outline is then refused by name.
  const borderClaimsStroke = tokens['border-color'] !== undefined || uniformSideStroke !== null;
  // …and the colour has to actually paint. `outline: 2px solid transparent`
  // is the focus-ring-reservation idiom, so a CSS-extracted contract really
  // does declare outline-style: solid over a fully transparent colour
  // (Carbon's InlineNotification close button, TextInput, Tabs). This is the
  // SAME value test `hasWidthSource` above already applies to the border
  // pair — the file does not lower stroke facts that render nothing — and it
  // is evaluated per variant-combination, so Avatar's per-state ring draws a
  // canvas stroke on its FOCUSED variants and none on default/hover, which
  // is exactly what the canvas draws.
  const outlineColorPaints = (() => {
    const ref = tokens['outline-color'];
    if (ref === undefined) return false;
    let path = ref.slice(1, -1);
    for (const [propName, value] of Object.entries(subst)) path = path.replaceAll(`{${propName}}`, value);
    const v = String(resolveLiteral(path)).trim().toLowerCase();
    if (v === 'transparent' || v === 'none') return false;
    if (/^#[0-9a-f]{6}00$/.test(v) || /^#[0-9a-f]{3}0$/.test(v)) return false;
    const rgba = v.match(/^rgba?\([^)]*?,\s*0*(?:\.0+)?\s*\)$/);
    return rgba === null;
  })();
  const outlineDrawsStroke =
    outlinePaints &&
    outlineColorPaints &&
    tokens['outline-width'] !== undefined &&
    !borderClaimsStroke;
  for (const [cssProp, ref] of Object.entries(tokens)) {
    let tokenPath = ref.slice(1, -1);
    for (const [propName, value] of Object.entries(subst)) {
      tokenPath = tokenPath.replaceAll(`{${propName}}`, value);
    }
    const varName = figmaName(tokenPath);
    switch (cssProp) {
      // `background` carries the same single-token binding as
      // `background-color` (the promotion's CSS-shorthand color layer; the
      // HTML surface renders it as `background:`) — the cross-generator gap
      // the Phase B canvas surfaced: Avatar's HTML carried
      // p.color-avatar-bg-fill while this emitter dropped the channel.
      case 'background':
      case 'background-color':
        spec.fill = varName;
        break;
      case 'border-color':
        spec.stroke = varName;
        break;
      case 'border-top-color':
      case 'border-right-color':
      case 'border-bottom-color':
      case 'border-left-color':
        if (uniformSideStroke !== null && spec.stroke === undefined) spec.stroke = uniformSideStroke;
        // fix 3: ONE strokes paint list serves all four sides (matrix §2), so
        // per-side colours only lower when every carried side agrees AND a
        // width source exists. Disagreeing sides used to no-op in silence.
        else if (uniformSideStroke === null) {
          miss(spec, cssProp, 'per-side border COLOURS disagree (or no border width is carried) — one Figma strokes paint list serves all four sides.', ref);
        }
        break;
      case 'border-width':
        spec.bindings = { ...spec.bindings, strokeWeight: varName };
        break;
      case 'color':
        next.textFill = varName;
        next.textFillPath = tokenPath;
        // R7: a bound ink on THIS part replaces an inherited literal one.
        next.textFillLit = undefined;
        next.textFillLitCss = undefined;
        break;
      // Round 4 (canvas-gate finding): the CSS `fill` channel — promoted svg
      // hosts carry per-axis glyph paint as `fill` (attribute-less paths
      // inherit it in CSS); the canvas bakes it into the glyph markup
      // (iconSvg) exactly like currentColor bakes the text color.
      case 'fill':
        next.glyphFillPath = tokenPath;
        break;
      case 'font-size':
        next.fontSize = px(resolveLiteral(tokenPath));
        next.fontSizePath = tokenPath;
        next.fontSizeVar = varName;
        break;
      case 'font-weight':
        next.fontStyle = FONT_STYLE_BY_WEIGHT[px(resolveLiteral(tokenPath))] ?? 'Medium';
        // The face name alone is lossy — 'Medium' is also what a node with no
        // weight token draws. Keep the token so the canvas can say WHICH.
        next.fontWeightVar = varName;
        break;
      case 'font-family': {
        // v15 (S4/matrix a.6): the first font-family stack entry rides the
        // text node (retires the everything-renders-Inter fiat; the runtime
        // falls back to Inter when the family is unavailable — named limit).
        const family = firstFamily(String(resolveLiteral(tokenPath)));
        if (family) next.fontFamily = family;
        break;
      }
      case 'padding-inline':
        spec.bindings = { ...spec.bindings, paddingLeft: varName, paddingRight: varName };
        break;
      case 'padding-block':
        spec.bindings = { ...spec.bindings, paddingTop: varName, paddingBottom: varName };
        break;
      // Round 4 (canvas-gate finding): padding LONGHANDS fell through this
      // switch and were silently dropped — the floor-promoted contracts bind
      // per-side paddings (Tag root 6px/0px), each independently bindable.
      case 'padding-left':
        spec.bindings = { ...spec.bindings, paddingLeft: varName };
        break;
      case 'padding-right':
        spec.bindings = { ...spec.bindings, paddingRight: varName };
        break;
      case 'padding-top':
        spec.bindings = { ...spec.bindings, paddingTop: varName };
        break;
      case 'padding-bottom':
        spec.bindings = { ...spec.bindings, paddingBottom: varName };
        break;
      case 'gap':
        spec.bindings = { ...spec.bindings, itemSpacing: varName };
        break;
      // Round 5 (canvas-gate finding): the floor promotion carries the gap
      // LONGHANDS (column-gap/row-gap — Banner's InlineStack icon–title gap
      // rode column-gap and was silently dropped). The main-axis longhand
      // maps to itemSpacing; the cross-axis one only matters under wrap and
      // stays CSS-side.
      case 'column-gap':
        if ((spec.layout?.mode ?? 'HORIZONTAL') === 'HORIZONTAL') {
          spec.bindings = { ...spec.bindings, itemSpacing: varName };
        } else {
          // fix 3: the CROSS axis of a vertical stack — only observable
          // under wrap, which Figma auto-layout expresses differently. It
          // used to no-op in silence.
          miss(spec, cssProp, 'the cross axis of a VERTICAL stack — Figma has one itemSpacing and it is the main axis.', ref);
        }
        break;
      case 'row-gap':
        if (spec.layout?.mode === 'VERTICAL') {
          spec.bindings = { ...spec.bindings, itemSpacing: varName };
        } else {
          miss(spec, cssProp, 'the cross axis of a HORIZONTAL stack — Figma has one itemSpacing and it is the main axis.', ref);
        }
        break;
      // Round 5 (canvas-gate finding): margin channels — the floor-promoted
      // contracts carry them (Badge pip margin -2/-2/-8 is what keeps the
      // real pill 20px tall) and this switch silently dropped them. Resolved
      // to literal px; round 5d records the variable name too, so the
      // sibling-gap → itemSpacing lowering can BIND the margin's own token
      // (the Checkbox/Radio control↔label gap rides
      // imported.*.choice-control.margin-right).
      case 'margin-top': {
        const v = px(resolveLiteral(tokenPath));
        if (!Number.isNaN(v)) {
          spec.margins = { ...spec.margins, top: v };
          spec.marginVars = { ...spec.marginVars, top: varName };
        }
        break;
      }
      case 'margin-right': {
        const v = px(resolveLiteral(tokenPath));
        if (!Number.isNaN(v)) {
          spec.margins = { ...spec.margins, right: v };
          spec.marginVars = { ...spec.marginVars, right: varName };
        }
        break;
      }
      case 'margin-bottom': {
        const v = px(resolveLiteral(tokenPath));
        if (!Number.isNaN(v)) {
          spec.margins = { ...spec.margins, bottom: v };
          spec.marginVars = { ...spec.marginVars, bottom: varName };
        }
        break;
      }
      case 'margin-left': {
        const v = px(resolveLiteral(tokenPath));
        if (!Number.isNaN(v)) {
          spec.margins = { ...spec.margins, left: v };
          spec.marginVars = { ...spec.marginVars, left: varName };
        }
        break;
      }
      // Round 5d (owner finding: the Banner focus ring drew bottom-only): a
      // STATE-PREVIEW outline lowers to an OUTSIDE-aligned stroke, never an
      // inside border — outlines sit outside the border box and paint over
      // children, so the inside approximation let the opaque tone ribbon
      // cover the top arc. ONLY the ':outline-preview' spellings (stamped by
      // translateStateOverrides) reach these cases: a BASE-plane
      // outline-color/outline-width carried at rest must keep falling
      // through, because the real resting outline-style is none and CSS
      // draws nothing (the Button tone maps carry resting outline channels —
      // drawing them inflated every critical/success base cell by the ring).
      case 'outline-color:outline-preview':
        spec.stroke = varName;
        spec.strokeOutside = true;
        break;
      case 'outline-width:outline-preview':
        spec.bindings = { ...spec.bindings, strokeWeight: varName };
        break;
      // ROUND 9 — THE RETURN LEG FOR AN OUTSIDE-ALIGNED STROKE.
      //
      // dump v1.11 captures strokeAlign, and propose lowers an OUTSIDE
      // stroke to the outline vocabulary because that is its only exact CSS
      // twin. This is where that spelling has to survive the trip BACK: the
      // canvas fact it came from is `strokeAlign = 'OUTSIDE'`, and emitting
      // it as a default INSIDE stroke would silently return a different
      // drawing than the one captured — the ring would move 4px inward and
      // the round trip would report a match.
      //
      // The machinery is the state-preview path's, unchanged: spec.stroke +
      // spec.strokeOutside, which strokeAlignJs lowers to a literal
      // `'OUTSIDE'` at every stroke site (frame, shape, boxed-text wrapper).
      //
      // PAIR-GATED, exactly as translateStateOverrides gates the preview
      // stamp, and for the reason the comment above records: a LONE resting
      // outline channel must stay inert. A CSS outline with no width paints
      // nothing, emit-react only writes `outline-style: solid` when the
      // WIDTH is carried, and the Button tone maps carry resting outline
      // colours that must not become canvas rings. Both halves or neither —
      // the same rule the border pair got this round.
      case 'outline-color':
        if (outlineDrawsStroke) {
          spec.stroke = varName;
          spec.strokeOutside = true;
        } else {
          miss(spec, cssProp, outlineRefusal(outlinePaints && outlineColorPaints, borderClaimsStroke, 'outline-width'), ref);
        }
        break;
      case 'outline-width':
        if (outlineDrawsStroke) {
          spec.bindings = { ...spec.bindings, strokeWeight: varName };
        } else {
          miss(spec, cssProp, outlineRefusal(outlinePaints && outlineColorPaints, borderClaimsStroke, 'outline-color'), ref);
        }
        break;
      case 'border-radius':
        spec.bindings = {
          ...spec.bindings,
          topLeftRadius: varName,
          topRightRadius: varName,
          bottomLeftRadius: varName,
          bottomRightRadius: varName,
        };
        break;
      // v15 (S4/matrix a.4): per-corner radii — each corner field is
      // independently variable-bindable; the vocabulary now carries the four
      // longhand keys.
      case 'border-top-left-radius':
        spec.bindings = { ...spec.bindings, topLeftRadius: varName };
        break;
      case 'border-top-right-radius':
        spec.bindings = { ...spec.bindings, topRightRadius: varName };
        break;
      case 'border-bottom-left-radius':
        spec.bindings = { ...spec.bindings, bottomLeftRadius: varName };
        break;
      case 'border-bottom-right-radius':
        spec.bindings = { ...spec.bindings, bottomRightRadius: varName };
        break;
      // v15 (S4/matrix a.5): per-side border widths — strokeTopWeight etc.
      // are independently bindable (per-side border COLORS stay CODE-ONLY:
      // one strokes paint list serves all four sides — matrix §2).
      case 'border-top-width':
        spec.bindings = { ...spec.bindings, strokeTopWeight: varName };
        break;
      case 'border-right-width':
        spec.bindings = { ...spec.bindings, strokeRightWeight: varName };
        break;
      case 'border-bottom-width':
        spec.bindings = { ...spec.bindings, strokeBottomWeight: varName };
        break;
      case 'border-left-width':
        spec.bindings = { ...spec.bindings, strokeLeftWeight: varName };
        break;
      // v15 (S4/matrix a.3): gradient background layer — parsed at compile
      // time into a native GRADIENT_LINEAR paint appended over the fill.
      // Radial/conic/unparseable values are a NAMED description limit
      // (declaredNotes in compileComponentData), never a silent drop.
      case 'background-image': {
        const resolved = String(resolveLiteral(tokenPath));
        if (resolved !== 'none') {
          const g = parseCssGradient(resolved);
          if (g) spec.gradient = g;
          else spec.gradientMiss = resolved.slice(0, 60);
        }
        break;
      }
      // GAP-CLOSING ROUND 6 — a size channel may resolve to the CONTENT-SIZED
      // keyword `fit-content` (a HUG axis: the inversion states the sizing
      // MODE it observed instead of pinning a measurement of the default
      // content). Figma's twin is HUG, and HUG is exactly what these two
      // runtimes do when no fixedWidth/fixedHeight is compiled:
      // primaryAxisSizingMode / counterAxisSizingMode are initialised to
      // 'AUTO' and only forced FIXED inside `if (spec.fixedWidth ||
      // spec.fixedHeight)`. So the fact goes back as HUG by carrying
      // NOTHING here — and, crucially, we never reach `px('fit-content')`,
      // which would have compiled `node.resize(NaN, …)` plus a bound
      // variable whose value is the string 'fit-content'.
      case 'width': {
        if (isHugKeyword(resolveLiteral(tokenPath))) break;
        // TASK #37 / D7 (exact-conversion wave): a part carrying the MEASURED
        // `hugsBelowMaxWidth` fact HUGS beneath its max-width ceiling in every
        // enumerated combo — so any width channel captured alongside it (the
        // inline-notification `showcase-width`, the exhibit's used width at
        // the capture viewport) is a harness fact, not a design width. Baking
        // it as fixedWidth re-creates the 320-wide-Carbon-Button defect the
        // hug-ceiling pin exists to catch; the ceiling binds via the
        // `max-width` case below and the box keeps HUG.
        if (hugsBelowMaxWidth === true) break;
        spec.fixedWidth = { px: px(resolveLiteral(tokenPath)), varName };
        break;
      }
      case 'max-width': {
        // ROUND 6 (live paste): max-width is a CEILING, not a width.
        //
        // For a PART, baking it was catastrophic twice in one paste: MUI's
        // Tab carries max-width 360, so three 360px tabs overflowed a 288px
        // strip and only "Overview" reached the canvas; MUI's Tooltip bubble
        // carries max-width 300, so the bubble stretched to 300px instead of
        // hugging "Tooltip text". A PART binds the real Figma `maxWidth`
        // field and HUGS beneath it — the CSS semantics exactly. Text nodes
        // have no maxWidth field (Figma sizes text by textAutoResize), so a
        // bare-text part keeps the lowering.
        //
        // TASK #37 (the owner's live canvas: "the buttons are messed up").
        // That round EXEMPTED roots — "a component's root box has no
        // container to be fluid inside" — and the exemption was wrong for
        // any root that hugs. Carbon's Button is `inline-size: max-content;
        // max-inline-size: 20rem`: the root box HUGS its label under a 320px
        // ceiling. Baking 320 as a fixed width drew a mostly-empty box, and
        // the root's own `justify: space-between` stranded the label at its
        // left edge. The CONTROL was in the same paste: the SAME Carbon
        // button nested in Modal's footer rendered at 125px and 111px —
        // correct — because a nested part got the ceiling treatment.
        //
        // The discriminator is a MEASUREMENT carried on the contract, not a
        // list of components: `hugsBelowMaxWidth` is set by the capture when
        // the element's used width stayed STRICTLY BELOW its max-width in
        // every enumerated combo. A root sitting AT its cap, and any root
        // with no measurement at all (every hand-authored `{size.card.width}`
        // contract in this repo), keeps the fixed-width lowering — which is
        // exactly what the golden design widths depend on.
        const value = px(resolveLiteral(tokenPath));
        const ceiling = spec.type !== 'text' && Number.isFinite(value) &&
          (spec.type !== 'root' || hugsBelowMaxWidth === true);
        if (ceiling) {
          spec.bindings = { ...spec.bindings, maxWidth: varName };
          // The MEASURED hug fact also disqualifies this box's children from
          // horizontal FILL (see NodeSpec.hugCeiling / annotateFillW): a
          // hugging box has no surplus space for flex-grow to distribute, so
          // FILL is a no-op in CSS terms and a hug-collapse in Figma terms.
          if (hugsBelowMaxWidth === true) spec.hugCeiling = true;
        } else {
          spec.fixedWidth = { px: value, varName };
        }
        break;
      }
      case 'min-width':
        spec.bindings = { ...spec.bindings, minWidth: varName };
        break;
      // Round 5 (canvas-gate finding): min-height is NOT redundant chrome —
      // the floor-promoted Button carries min-height {p.height-800} (32px)
      // and the real package's sub-768px bucket (the floor capture's own
      // viewport) sizes the control BY IT: dropping the channel drew every
      // canvas Button 4px shorter than the captured truth. minHeight is a
      // bindable field, exactly like minWidth — but ONLY when the part
      // carries no height channel: a FIXED height is the drawn design truth
      // (the repo Button's captured Figma boxes are 32/40/48 while its
      // min-height 44 is a code-side a11y fact — the reviewed canvas-box
      // parity pin, evals design-canvas-box-parity).
      case 'min-height':
        if (tokens['height'] === undefined) {
          spec.bindings = { ...spec.bindings, minHeight: varName };
        }
        break;
      case 'height': {
        if (isHugKeyword(resolveLiteral(tokenPath))) break; // see `width` above
        spec.fixedHeight = { px: px(resolveLiteral(tokenPath)), varName };
        break;
      }
      case 'opacity': {
        // Only reachable via state-preview overrides today (no base token
        // uses it). NOT bound as a variable: Figma's opacity field is
        // PERCENT-scaled (0-100), so binding the repo's 0-1 number token
        // (opacity.disabled = 0.5) rendered the synced disabled preview at
        // 0.5% — nearly invisible (visual-parity receipt: Button
        // State=Disabled washed to #ffffff, 93.91% masked, vs the CSS
        // surfaces' correct 0.5 fade). A ×100 shadow variable would fork the
        // token's value; the honest rendering is the literal on the node —
        // the same node-opacity channel the dump v1.2 inversion uses.
        const value = px(resolveLiteral(tokenPath));
        if (!Number.isNaN(value)) spec.opacity = Math.min(1, Math.max(0, value));
        break;
      }
      case 'box-shadow': {
        // dump v1.3: the resolved single-DROP_SHADOW value projects as a
        // native effect (runtime) / CSS box-shadow (canvas preview). v15
        // (S4/matrix a.1): values outside that grammar — multi-layer stacks,
        // inset layers, rgba() colors — parse as a FULL effect stack; the
        // single-drop path stays first so existing emissions are
        // byte-identical.
        const value = String(resolveLiteral(tokenPath));
        const shadow = parseBoxShadow(value);
        if (shadow) spec.dropShadow = shadow;
        else {
          const stack = parseShadowStack(value);
          if (stack) spec.effectStack = stack;
          // B-3 finding 6: a token-referenced shadow the stack grammar still
          // cannot express is a NAMED code-only fact (the † footnote), never
          // a silent drop.
          else spec.shadowMiss = value.slice(0, 60);
        }
        break;
      }
      case 'line-height':
        // dump v1.3 PIXELS + CSS unitless ratios → PERCENT (compileLineHeight).
        next.lineHeight = compileLineHeight(resolveLiteral(tokenPath));
        // R7: compileLineHeight swallows its own parse failure (`catch {
        // return undefined }`); a token whose value it cannot spell is named.
        if (next.lineHeight === undefined) miss(spec, cssProp, `the token resolves to "${String(resolveLiteral(tokenPath))}", which is not a px/rem/em measure or a unitless ratio the canvas line height can hold`, ref);
        // The resolved number cannot say WHICH token produced it, and 20px is
        // not unique. Keep the token so the reader binds it instead of minting
        // a second name for a token the corpus already carries.
        next.lineHeightVar = varName;
        break;
      case 'letter-spacing': {
        // v15 (S4/matrix a.2): PIXEL letter spacing — literal on the text
        // node (the lineHeight discipline; binding upgrade deferred by name).
        const v = px(resolveLiteral(tokenPath));
        if (!Number.isNaN(v)) next.letterSpacing = v;
        break;
      }
      default: {
        // SILENT-LOSS ROUND (task #33, fix 3): this was a bare `break`. A
        // channel that reaches here is either lowered OUTSIDE this switch
        // (top/right/bottom/left and the synthetic translate-x/translate-y,
        // handled by absolutePartPlacement / insetOverlayOffsets /
        // boundFullBleedScrimRoot — TOKEN_CHANNELS marks those `draw`), or
        // it has NO canvas field at all. The second class is now named.
        const reg = TOKEN_CHANNELS[cssProp];
        if (reg && reg.canvas !== 'draw') miss(spec, cssProp, reg.note, ref);
        // SILENT-LOSS ROUND, the half that was left open. The comment above
        // is right that top/right/bottom/left are lowered OUTSIDE this switch
        // — but only for parts those paths actually claim (absolute,
        // inset-overlay, full-bleed scrim). Bind an inset on an IN-FLOW box
        // and no path claims it, `canvas: 'draw'` sends it down the silent
        // branch, and the binding vanishes with no receipt anywhere. That is
        // ToggleSwitch's `part-0`, which binds all four to size-0 under
        // `position: relative` — TJ-TEST.md §A7 listed the `bottom` half of
        // it as a silent loss and could not say where it went.
        //
        // Figma has no offset field for an in-flow child, so this cannot be
        // drawn and must not be invented. Name it instead. Read from the
        // part's DECLARED position (a contract fact) rather than from spec
        // flags, which the placement passes have not set yet at this point.
        else if (reg && INSET_CHANNELS.has(cssProp) && inFlowInsets) {
          miss(
            spec,
            cssProp,
            `bound on an in-flow box (position: ${declared?.position ?? 'static'}) — Figma lowers offsets only for absolutely-placed, inset-overlay and full-bleed parts, and has no offset field for a child in auto-layout, so this binding draws nothing and cannot be read back`,
            ref,
          );
        }
        break;
      }
    }
  }
  return next;
}

/** ROUND 9: why an outline channel did not become a canvas stroke. Three
 *  distinct reasons, each named rather than collapsed into one, because they
 *  are three different things an adopter would fix differently. */
function outlineRefusal(paints: boolean, borderWins: boolean, sibling: string): string {
  if (!paints) {
    return 'a resting outline with no drawn `outline-style` paints nothing in CSS — this is the focus-ring-reservation idiom (`outline: Npx solid transparent`), so it correctly draws no canvas stroke either. An OUTSIDE-aligned canvas stroke declares outline-style and DOES draw.';
  }
  if (borderWins) {
    return 'a Figma node carries ONE strokes paint and a border already claims it — a drawn border and a drawn outline cannot both be strokes, so the BORDER (the resting fact) wins and the outline is named here.';
  }
  return `a drawn outline needs BOTH halves and ${sibling} is not carried — carry the pair and it returns as an OUTSIDE-aligned stroke.`;
}

/** SILENT-LOSS ROUND (task #33, fix 3): record a carried-but-undrawable
 *  channel on the spec. Deduplicated and sorted at collection time. */
/** The CSS inset quartet. Lowered only by the absolute / inset-overlay /
 *  full-bleed-scrim paths; on any other part there is no canvas field to
 *  carry them, which is why the default branch names them. */
const INSET_CHANNELS = new Set(['top', 'right', 'bottom', 'left']);

function miss(spec: NodeSpec, cssProp: string, why: string, value = ''): void {
  (spec.channelMiss ??= []).push({ channel: cssProp, value, reason: why });
}

/** GAP-CLOSING ROUND 6 — the CONTENT-SIZED keyword a HUG axis carries
 *  (v16 literal grammar / mint `size` kind). Its canvas twin is Figma HUG,
 *  which both frame runtimes express by leaving primary/counterAxisSizingMode
 *  at their 'AUTO' default — i.e. by compiling no fixed size at all. */
const isHugKeyword = (value: unknown): boolean => String(value ?? '').trim() === 'fit-content';

/** v14 literals: parse a bounded literal dimension to px (rem/em at the
 *  documented 1rem = 16px base — same conversion the engine tree applies). */
function parseLitPx(value: string): number | undefined {
  const m = value.trim().match(/^(-?\d+(?:\.\d+)?)(px|rem|em)?$/);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  return m[2] === 'rem' || m[2] === 'em' ? n * 16 : n;
}

/** Compile a CSS line-height token/literal for Figma text nodes.
 *  Unitless ratios in (0, 4] → PERCENT (×100). px/rem/em and larger bare
 *  numbers → PIXELS. Prevents `1.4286` becoming a 1.4px line box. */
function compileLineHeight(raw: unknown): NodeSpec['lineHeight'] | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw > 0 && raw <= 4) return { value: raw * 100, unit: 'PERCENT' };
    return { value: raw, unit: 'PIXELS' };
  }
  const s = String(raw).trim();
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = parseFloat(s);
    if (n > 0 && n <= 4) return { value: n * 100, unit: 'PERCENT' };
    return { value: n, unit: 'PIXELS' };
  }
  const n = pxOrNull(s);
  if (n === null) {
    try {
      return { value: px(s), unit: 'PIXELS' };
    } catch {
      return undefined;
    }
  }
  return { value: n, unit: 'PIXELS' };
}

/** v14 literals: parse a hex / rgb() / rgba() literal color to RGBA floats
 *  (compile-time — the runtime never parses color strings). */
function parseLitColor(value: string): { r: number; g: number; b: number; a?: number } | undefined {
  const v = value.trim();
  const fn = v.match(/^rgba?\(([^)]+)\)$/);
  if (fn) {
    const parts = fn[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) return undefined;
    const c: { r: number; g: number; b: number; a?: number } = {
      r: parts[0] / 255, g: parts[1] / 255, b: parts[2] / 255,
    };
    if (parts.length > 3 && !Number.isNaN(parts[3])) c.a = parts[3];
    return c;
  }
  let h = v.replace('#', '');
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$|^[0-9a-fA-F]{8}$/.test(h)) return undefined;
  if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
  const c: { r: number; g: number; b: number; a?: number } = {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
  if (h.length === 8) c.a = parseInt(h.slice(6, 8), 16) / 255;
  return c;
}

/** R7 (2026-08-22): the literal-channel receipt. EVERY literal a part
 *  carries that does not become a canvas field lands here, through the same
 *  `miss` collector the token path uses (→ NodeSpec.channelMiss →
 *  codeOnlyFacts, kind `channel`). The reason always opens with the same
 *  words so a reader can grep the receipt for the class:
 *    "no canvas field for this literal channel — <why>". */
const LITERAL_MISS = 'no canvas field for this literal channel';
function literalMiss(spec: NodeSpec, cssProp: string, value: string, why: string): void {
  miss(spec, cssProp, `${LITERAL_MISS} — ${why}`, value.trim());
}

/** R7: parse a literal dimension for a px-shaped canvas field, NAMING the
 *  value the parser cannot spell (`50%`, `inherit`, `auto`) instead of
 *  returning undefined into an `if (n !== undefined)` that drops it. The
 *  storybook circle/dot pills carry `border-radius: 50%` — Figma's
 *  cornerRadius is px, and until this round the percentage vanished with no
 *  receipt. HUG keywords are the caller's business (they compile to no
 *  fixed size on purpose) and are never a miss. */
function litPx(spec: NodeSpec, cssProp: string, value: string): number | undefined {
  const n = parseLitPx(value);
  if (n === undefined && !isHugKeyword(value)) {
    literalMiss(spec, cssProp, value, `"${value.trim()}" is not a px/rem/em measure and the canvas field is px-shaped (percentages and keywords have no twin here)`);
  }
  return n;
}

/** v14 literals: distribute a part's resolved literal channels into the
 *  spec's `lits` struct (frame-kind runtime application) and the text ctx
 *  (font-size/line-height/colour). `inherit`/`currentColor` paints keep the
 *  inherited context (that IS the canvas behaviour — nothing is lost);
 *  everything else that cannot become a field is NAMED (R7 — see
 *  literalMiss; the `default` branch is no longer a bare `break`).
 *  @param placement whether THIS combo places the part absolutely (the
 *                   emitter's own gate, isAbsoluteThisCombo — declared OR a
 *                   matching stylesWhen) plus the declared position for the
 *                   receipt's wording; decides whether an inset literal is
 *                   lowered elsewhere (absolutePartPlacement) or has no
 *                   canvas field at all.
 *  @param tokens    the part's OWN resolved token bindings — a token on the
 *                   same channel wins over the literal, by name. */
function applyLiterals(
  spec: NodeSpec,
  lits: Record<string, string>,
  ctx: TextCtx,
  placement?: { absolute: boolean; position: string },
  tokens?: Record<string, string>,
): TextCtx {
  const next: TextCtx = { ...ctx };
  const li = () => (spec.lits ??= {});
  for (const [cssProp, value] of Object.entries(lits)) {
    switch (cssProp) {
      // R7 LITERAL INK — the case this switch never had. The text twin of
      // the `background-color` literal above: a literal SOLID paint on the
      // TEXT node (runtime), and the ink an icon child bakes into its glyph.
      // A token binding the same channel on THIS part wins (applyTokens ran
      // first) — the literal is then named, not dropped. inherit /
      // currentColor keep the inherited context: that is what the canvas
      // child inherits anyway, so nothing is lost and nothing is claimed.
      case 'color': {
        const v = value.trim();
        if (tokens?.color !== undefined) {
          literalMiss(spec, cssProp, value, 'a token binds the same channel on this part — the bound variable is the canvas fill, the literal is not drawn');
          break;
        }
        if (v === 'inherit' || v === 'currentColor') break; // inherited ink — the child context carries it
        const c = v === 'transparent' ? { r: 0, g: 0, b: 0, a: 0 } : parseLitColor(v);
        if (!c) {
          literalMiss(spec, cssProp, value, `"${v}" is not a hex / rgb() / rgba() colour the canvas can paint`);
          break;
        }
        next.textFillLit = c;
        next.textFillLitCss = v;
        next.textFill = undefined;
        next.textFillPath = undefined;
        break;
      }
      case 'background':
      case 'background-color': {
        // #60 fix 1 (compile side): fill + fillClear on one spec = fill wins.
        // applyTokens runs first in applyStyling, so a token-bound fill is
        // already on the spec here — the base transparent literal is the
        // CSS-cascade LOSER and must not compile at all.
        if (value === 'transparent') { if (!spec.fill) li().fillClear = true; break; }
        const c = parseLitColor(value);
        if (c) li().fillColor = c;
        break;
      }
      case 'width': {
        // GAP-CLOSING ROUND 6 — a percentage width is a RELATION to the
        // parent, not a measure, and `parseLitPx` cannot spell one, so it
        // used to fall out of this switch and vanish on the return leg. The
        // only percentage the inversion emits is `100%`: the CROSS-AXIS half
        // of a Figma FILL (crossAxisFillByProp — a child drawn fillWidth
        // under a parent whose auto-layout mode is a function of an axis).
        // Its canvas twin is layoutSizingHorizontal = FILL, which is exactly
        // what `grow` lowers to (annotateFillW), so the fact goes back the
        // way it came instead of being baked into a bogus literal. Any OTHER
        // percentage refuses BY NAME through the channelMiss registry rather
        // than falling out of the switch.
        if (value.trim() === '100%') { spec.grow = true; break; }
        if (isHugKeyword(value)) break; // HUG = no fixed size compiled (see applyTokens)
        const n = parseLitPx(value);
        if (n !== undefined) li().width = n;
        else if (value.trim().endsWith('%')) {
          miss(spec, 'width', 'a fractional width has no canvas twin (Figma sizing is FIXED / HUG / FILL; only 100% lowers, as FILL)', value.trim());
        } else {
          // R7: every other unparsable width (auto / inherit / calc) is named
          // through the same literal receipt as the px-shaped cases below.
          litPx(spec, cssProp, value);
        }
        break;
      }
      case 'height': {
        if (isHugKeyword(value)) break; // HUG = no fixed size compiled (see applyTokens)
        const n = litPx(spec, cssProp, value);
        if (n !== undefined) li().height = n;
        break;
      }
      case 'min-width': { const n = litPx(spec, cssProp, value); if (n !== undefined) li().minWidth = n; break; }
      case 'min-height': { const n = litPx(spec, cssProp, value); if (n !== undefined) li().minHeight = n; break; }
      case 'padding-block': { const n = litPx(spec, cssProp, value); if (n !== undefined) { li().paddingTop = n; li().paddingBottom = n; } break; }
      case 'padding-inline': { const n = litPx(spec, cssProp, value); if (n !== undefined) { li().paddingLeft = n; li().paddingRight = n; } break; }
      // Round 4 (canvas-gate finding): literal padding longhands were dropped.
      case 'padding-left': { const n = litPx(spec, cssProp, value); if (n !== undefined) li().paddingLeft = n; break; }
      case 'padding-right': { const n = litPx(spec, cssProp, value); if (n !== undefined) li().paddingRight = n; break; }
      case 'padding-top': { const n = litPx(spec, cssProp, value); if (n !== undefined) li().paddingTop = n; break; }
      case 'padding-bottom': { const n = litPx(spec, cssProp, value); if (n !== undefined) li().paddingBottom = n; break; }
      case 'gap': { const n = litPx(spec, cssProp, value); if (n !== undefined) li().itemSpacing = n; break; }
      // Round 5: gap longhands (see the token side) — main-axis only.
      case 'column-gap': {
        const n = litPx(spec, cssProp, value);
        if (n !== undefined && (spec.layout?.mode ?? 'HORIZONTAL') === 'HORIZONTAL') li().itemSpacing = n;
        break;
      }
      case 'row-gap': {
        const n = litPx(spec, cssProp, value);
        if (n !== undefined && spec.layout?.mode === 'VERTICAL') li().itemSpacing = n;
        break;
      }
      // Round 5: literal margin channels — same lowering as the token side.
      case 'margin-top': { const n = litPx(spec, cssProp, value); if (n !== undefined) spec.margins = { ...spec.margins, top: n }; break; }
      case 'margin-right': { const n = litPx(spec, cssProp, value); if (n !== undefined) spec.margins = { ...spec.margins, right: n }; break; }
      case 'margin-bottom': { const n = litPx(spec, cssProp, value); if (n !== undefined) spec.margins = { ...spec.margins, bottom: n }; break; }
      case 'margin-left': { const n = litPx(spec, cssProp, value); if (n !== undefined) spec.margins = { ...spec.margins, left: n }; break; }
      case 'border-radius': { const n = litPx(spec, cssProp, value); if (n !== undefined) li().radius = n; break; }
      case 'border-width': { const n = litPx(spec, cssProp, value); if (n !== undefined) li().strokeWeight = n; break; }
      // v15 (S4): per-corner literal radii and per-side literal widths.
      case 'border-top-left-radius': { const n = litPx(spec, cssProp, value); if (n !== undefined) (li().radiusCorners ??= {}).tl = n; break; }
      case 'border-top-right-radius': { const n = litPx(spec, cssProp, value); if (n !== undefined) (li().radiusCorners ??= {}).tr = n; break; }
      case 'border-bottom-left-radius': { const n = litPx(spec, cssProp, value); if (n !== undefined) (li().radiusCorners ??= {}).bl = n; break; }
      case 'border-bottom-right-radius': { const n = litPx(spec, cssProp, value); if (n !== undefined) (li().radiusCorners ??= {}).br = n; break; }
      case 'border-top-width': { const n = litPx(spec, cssProp, value); if (n !== undefined) (li().strokeSides ??= {}).top = n; break; }
      case 'border-right-width': { const n = litPx(spec, cssProp, value); if (n !== undefined) (li().strokeSides ??= {}).right = n; break; }
      case 'border-bottom-width': { const n = litPx(spec, cssProp, value); if (n !== undefined) (li().strokeSides ??= {}).bottom = n; break; }
      case 'border-left-width': { const n = litPx(spec, cssProp, value); if (n !== undefined) (li().strokeSides ??= {}).left = n; break; }
      // D2: LITERAL border colour (see lits.strokeColor). A token-bound
      // border colour wins (applyTokens ran first and set spec.stroke); the
      // per-side spellings only lower when every carried side agrees, the
      // same one-paint rule the token path applies.
      case 'border-color': {
        const c = parseLitColor(value);
        if (c && !spec.stroke) li().strokeColor = c;
        break;
      }
      case 'border-top-color':
      case 'border-right-color':
      case 'border-bottom-color':
      case 'border-left-color': {
        if (spec.stroke) break;
        const sides = ['border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color']
          .filter((ch) => lits[ch] !== undefined)
          .map((ch) => lits[ch]);
        if (new Set(sides).size !== 1) break; // disagreeing sides: CSS-side truth
        const c = parseLitColor(value);
        if (c) li().strokeColor = c;
        break;
      }
      case 'letter-spacing': { const n = litPx(spec, cssProp, value); if (n !== undefined) next.letterSpacing = n; break; }
      case 'font-size': {
        const n = litPx(spec, cssProp, value);
        if (n !== undefined) { next.fontSize = n; next.fontSizePath = undefined; }
        break;
      }
      case 'line-height': {
        const lh = compileLineHeight(value);
        if (lh !== undefined) next.lineHeight = lh;
        // R7: compileLineHeight swallows its own parse failure (`catch {
        // return undefined }`) — the literal then died in this `if`. Named.
        else literalMiss(spec, cssProp, value, `"${value.trim()}" is not a px/rem/em measure or a unitless ratio the canvas line height can hold`);
        break;
      }
      case 'box-shadow': {
        // v17 (mui/slider coincident-shadow fold). The literal path projects
        // a shadow through the SAME two grammars the token path uses above
        // (single DROP_SHADOW first, so existing emissions stay byte-equal;
        // then the full multi-layer/inset stack). Reached because a
        // shadow-only pseudo that is coincident with its host now folds onto
        // the host as a literal — see pseudoDecorParts in
        // extract/computed/anatomy.ts. `none` parses to an EMPTY stack, which
        // CLEARS the node's effects: that is the spelling MUI's `size=small`
        // thumb needs, since only `medium` carries the elevation.
        const shadow = parseBoxShadow(value);
        if (shadow) spec.dropShadow = shadow;
        else {
          const stack = parseShadowStack(value);
          if (stack) spec.effectStack = stack;
          else spec.shadowMiss = value.slice(0, 60);
        }
        break;
      }
      default: {
        // R7 — THE NAMED DEFAULT. This was a bare `break` (the fourth
        // occurrence of the S9 class: applyTokens' default, padding
        // longhands, column-gap, the RadioButton ring — each found on a
        // canvas, by a person, after shipping). A literal the schema admits
        // (LITERAL_CHANNELS) that reaches here is one of:
        //   · an inset (top/right/bottom/left) — lowered OUTSIDE this switch
        //     by absolutePartPlacement / insetOverlayOffsets /
        //     boundFullBleedScrimRoot for parts those paths claim; on an
        //     IN-FLOW box no path claims it, and Figma has no offset field
        //     for a child in auto-layout. The token default names exactly
        //     this case (declared position, not spec flags) — mirrored.
        //   · a channel the registry marks non-draw — the registry's own
        //     reason rides the receipt, as on the token path.
        //   · a channel with no literal case at all (the `color` hole this
        //     round closed lived here) — named so the NEXT one cannot hide.
        const reg = TOKEN_CHANNELS[cssProp];
        if (INSET_CHANNELS.has(cssProp)) {
          if (!(placement?.absolute ?? false)) {
            literalMiss(
              spec,
              cssProp,
              value,
              `carried on an in-flow box (position: ${placement?.position ?? 'static'}) — Figma lowers offsets only for absolutely-placed, inset-overlay and full-bleed parts, and has no offset field for a child in auto-layout, so this literal draws nothing and cannot be read back`,
            );
          }
        } else if (reg && reg.canvas !== 'draw') {
          literalMiss(spec, cssProp, value, reg.note);
        } else {
          literalMiss(
            spec,
            cssProp,
            value,
            `the literal lowering has no case for \`${cssProp}\`${reg ? ' (the token path draws it — carry it as a token, or add the literal case)' : ' (the channel registry does not know it either)'}`,
          );
        }
        break;
      }
    }
  }
  // Wave B.2 residual: transparent-fill + exactly one non-zero border side
  // is a CSS "bar" — collapse to a filled rect (Figma miters make an L-nub).
  collapseSingleSideStrokeBar(spec);
  // FC-PSEUDO-STROKE-GLYPH: transparent-fill + exactly two ADJACENT border
  // sides is a CSS checkmark/L — Figma per-side RECT strokes look like a
  // thin V. Collapse to a ROUND-cap polyline SVG (any DS using the trick).
  collapseTwoSideStrokeGlyph(spec);
  if (spec.lits && Object.keys(spec.lits).length === 0) delete spec.lits;
  return next;
}

/** Pending absolute adjust for collapseSingleSideStrokeBar (placement runs later). */
const barCollapsePending = new WeakMap<
  NodeSpec,
  { side: 'top' | 'right' | 'bottom' | 'left'; prior: number }
>();

/** See applyLiterals — single-side stroke → filled bar. */
function collapseSingleSideStrokeBar(spec: NodeSpec): void {
  const li = spec.lits;
  if (!li?.strokeSides || !li.strokeColor) return;
  if (spec.fill || li.fillColor) return;
  if (!(li.fillClear || li.fillColor === undefined)) return;
  const sw = li.strokeSides;
  const sides = (['top', 'right', 'bottom', 'left'] as const).filter(
    (s) => (sw[s] ?? 0) > 0,
  );
  if (sides.length !== 1) return;
  const side = sides[0];
  const t = sw[side]!;
  const color = li.strokeColor;
  const h = li.height ?? spec.shape?.height;
  const w = li.width ?? spec.shape?.width;
  li.fillColor = color;
  delete li.fillClear;
  delete li.strokeSides;
  delete li.strokeColor;
  delete li.strokeWeight;
  if (side === 'bottom' || side === 'top') {
    if (h != null && Number.isFinite(h)) {
      barCollapsePending.set(spec, { side, prior: h });
      li.height = t;
      if (spec.shape) spec.shape.height = t;
    }
  } else if (w != null && Number.isFinite(w)) {
    barCollapsePending.set(spec, { side, prior: w });
    li.width = t;
    if (spec.shape) spec.shape.width = t;
  }
}

/** Apply deferred top/left bump once absolute placement is on the shape. */
function applyBarCollapseAbsolute(spec: NodeSpec): void {
  const pending = barCollapsePending.get(spec);
  if (!pending || !spec.absolute) return;
  const t =
    pending.side === 'bottom' || pending.side === 'top'
      ? (spec.lits?.height ?? spec.shape?.height)
      : (spec.lits?.width ?? spec.shape?.width);
  if (t == null) return;
  const delta = pending.prior - t;
  if (pending.side === 'bottom' && spec.absolute.top != null) {
    spec.absolute.top += delta;
  } else if (pending.side === 'right' && spec.absolute.left != null) {
    spec.absolute.left += delta;
  }
  barCollapsePending.delete(spec);
}

const ADJACENT_CORNERS: ReadonlyArray<ReadonlyArray<'top' | 'right' | 'bottom' | 'left'>> = [
  ['left', 'bottom'],
  ['left', 'top'],
  ['right', 'bottom'],
  ['right', 'top'],
];

function rgbaToSvgStroke(c: { r: number; g: number; b: number; a?: number }): string {
  const R = Math.round(c.r * 255);
  const G = Math.round(c.g * 255);
  const B = Math.round(c.b * 255);
  if (c.a !== undefined && c.a < 1) return `rgba(${R},${G},${B},${c.a})`;
  return `rgb(${R},${G},${B})`;
}

/** Polyline through stroke centers for an L built from two adjacent borders. */
function lStrokePolylinePoints(
  a: 'top' | 'right' | 'bottom' | 'left',
  b: 'top' | 'right' | 'bottom' | 'left',
  W: number,
  H: number,
  t: number,
): string {
  const half = t / 2;
  const key = [a, b].sort().join('+');
  // Sort order: bottom,left / left,top / bottom,right / right,top
  // Inset endpoints by half stroke so ROUND caps stay inside the viewBox
  // (otherwise createNodeFromSvg overflows the host checkbox box).
  if (key === 'bottom+left') {
    return `${half},${half} ${half},${H - half} ${W - half},${H - half}`;
  }
  if (key === 'left+top') {
    return `${half},${H - half} ${half},${half} ${W - half},${half}`;
  }
  if (key === 'bottom+right') {
    return `${W - half},${half} ${W - half},${H - half} ${half},${H - half}`;
  }
  if (key === 'right+top') {
    return `${W - half},${H - half} ${W - half},${half} ${half},${half}`;
  }
  return '';
}

/**
 * FC-PSEUDO-STROKE-GLYPH — CSS checkmarks are often a transparent box with
 * two adjacent borders (left+bottom) rotated -45°. Figma's per-side rect
 * strokes miter into a thin V. Replace with a ROUND-cap polyline SVG that
 * rides the same absolute box + shape.rotation.
 */
function collapseTwoSideStrokeGlyph(spec: NodeSpec): void {
  if (spec.type !== 'shape' || !spec.shape) return;
  const li = spec.lits;
  if (!li?.strokeSides || !li.strokeColor) return;
  if (spec.fill || li.fillColor) return;
  if (!(li.fillClear || li.fillColor === undefined)) return;
  if (spec.svg) return;
  const sw = li.strokeSides;
  const sides = (['top', 'right', 'bottom', 'left'] as const).filter(
    (s) => (sw[s] ?? 0) > 0,
  );
  if (sides.length !== 2) return;
  const [s0, s1] = sides;
  const adjacent = ADJACENT_CORNERS.some(
    ([a, b]) => (a === s0 && b === s1) || (a === s1 && b === s0),
  );
  if (!adjacent) return;
  const t0 = sw[s0]!;
  const t1 = sw[s1]!;
  if (t0 !== t1) return; // unequal weights — leave as rect strokes
  const t = t0;
  const W = li.width ?? spec.shape.width;
  const H = li.height ?? spec.shape.height;
  if (!(W > 0) || !(H > 0) || !(t > 0)) return;
  const points = lStrokePolylinePoints(s0, s1, W, H, t);
  if (!points) return;
  const stroke = rgbaToSvgStroke(li.strokeColor);
  spec.svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none">` +
    `<polyline points="${points}" stroke="${stroke}" stroke-width="${t}" ` +
    `stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`;
  delete li.fillClear;
  delete li.strokeSides;
  delete li.strokeColor;
  delete li.strokeWeight;
}

/**
 * FC-PSEUDO-STROKE-GLYPH / FC-CHECKBOX-SVG-GLYPH placement: CSS capture offsets
 * for a rotated L often sit the layout box off-center in the control (Carbon
 * left:7 in a 16×16 host → ✓ bleeds right after -45°). SVG glyph hosts
 * (Polaris Checkbox check / indeterminate minus) pin top-left when the svg
 * rides auto-layout inside an ABSOLUTE-stretched overlay. When a glyph shares
 * a parent with a roughly-square host rect, center it on that host.
 * Library-agnostic checkbox/radio pattern — not Carbon/Polaris coordinates.
 */
function centerSvgGlyphsInHosts(children: NodeSpec[]): void {
  const hosts = children.filter(
    (c) =>
      c.type === 'shape' &&
      c.shape?.kind === 'rect' &&
      !c.svg &&
      c.shape.width >= 12 &&
      c.shape.height >= 12 &&
      Math.abs(c.shape.width - c.shape.height) <= 2,
  );
  if (hosts.length === 0) return;
  const host = hosts[0]!;
  const hw = host.shape!.width;
  const hh = host.shape!.height;
  for (const overlay of children) {
    if (overlay.type !== 'frame' || !overlay.insetOverlay || !overlay.children?.length) continue;
    for (const glyph of overlay.children) {
      if (glyph.type !== 'svg' || !glyph.iconSize) continue;
      const size = glyph.iconSize;
      glyph.absolute = {
        h: 'MIN',
        v: 'MIN',
        left: (hw - size) / 2,
        top: (hh - size) / 2,
      };
      // CENTERING SUPERSEDES STRETCHING — and the two must never both be
      // stamped on one node. Now that the icon early-return carries a boxless
      // icon part's declared position/insets, a glyph whose contract says
      // `position:absolute` + inset 0 arrives here ALREADY marked
      // `insetOverlay` (polaris Checkbox's `icon-6` is exactly that shape).
      // Left alone it would carry both "stretch to the parent" and "sit at
      // (hw-size)/2" — a contradiction each reader is free to resolve
      // differently, which is the class of silent disagreement this engine
      // exists to refuse. This pass is the MORE SPECIFIC decision: it can see
      // the host rect and the glyph's intrinsic `iconSize`, so a 14px check
      // stays 14px centred on its 18px box instead of being stretched to fill
      // it. Dropping the marks here keeps polaris byte-identical.
      delete glyph.insetOverlay;
      delete glyph.insetOffsets;
    }
  }
}

function centerStrokeGlyphsInHosts(children: NodeSpec[]): void {
  centerSvgGlyphsInHosts(children);
  const hosts = children.filter(
    (c) =>
      c.type === 'shape' &&
      c.shape?.kind === 'rect' &&
      !c.svg &&
      c.absolute?.left != null &&
      c.absolute?.top != null &&
      c.shape.width >= 12 &&
      c.shape.height >= 12 &&
      Math.abs(c.shape.width - c.shape.height) <= 2,
  );
  if (hosts.length === 0) return;
  for (const g of children) {
    if (g.type !== 'shape' || !g.svg || !g.shape || !g.absolute) continue;
    const rot = g.shape.rotation;
    if (typeof rot !== 'number' || Math.abs(Math.abs(rot) - 45) > 1) continue;
    const gw = g.shape.width;
    const gh = g.shape.height;
    // Prefer the host whose center is closest to the glyph's current center.
    const gcx = (g.absolute.left ?? 0) + gw / 2;
    const gcy = (g.absolute.top ?? 0) + gh / 2;
    let best = hosts[0]!;
    let bestD = Infinity;
    for (const h of hosts) {
      const hcx = h.absolute!.left! + h.shape!.width / 2;
      const hcy = h.absolute!.top! + h.shape!.height / 2;
      const d = (hcx - gcx) ** 2 + (hcy - gcy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = h;
      }
    }
    const hcx = best.absolute!.left! + best.shape!.width / 2;
    const hcy = best.absolute!.top! + best.shape!.height / 2;
    g.absolute.left = hcx - gw / 2;
    g.absolute.top = hcy - gh / 2;
    // L→✓ ink mass sits toward the acute vertex after ±45°; a small nudge
    // opposite that vertex makes the mark read centered in the host (AABB
    // centering alone leaves a bottom-biased check).
    const nudge = Math.min(gw, gh) * 0.2;
    if (rot < 0) {
      g.absolute.top -= nudge;
    } else {
      g.absolute.top += nudge;
    }
    g.absolute.h = 'MIN';
    g.absolute.v = 'MIN';
  }
}

/** v15: first font-family stack entry, unquoted — the canvas family.
 *
 *  THE KEYWORD HOLE (2026-08-09). The denylist covered the GENERIC families
 *  but not the SYSTEM-FONT keywords, so a stack opening `-apple-system, …`
 *  returned `-apple-system` as if it were a typeface. Figma has no such
 *  family, `loadFontAsync` throws, and the node keeps the runtime's Inter
 *  fallback. Measured on astryx, the only lane whose stack opens with one:
 *  148 emitted `fontFamily": "-apple-system"` declarations across 10 scripts
 *  and zero `Figtree`, while every reference render draws Figtree — a whole
 *  lane mis-fonted from one missing alternation. (Altitude emits
 *  "IBM Plex Sans", mui "Roboto", first-party "Inter"; none is affected.)
 *
 *  WHY THIS DOES NOT FALL THROUGH TO THE NEXT ENTRY, which was the proposed
 *  repair and is worse. `-apple-system, BlinkMacSystemFont, "Segoe UI", …`
 *  falls through to Segoe UI — a font the browser would never pick on the
 *  platform the reference was captured on, where the keyword resolves to San
 *  Francisco. Falling through trades a family Figma REFUSES for one it
 *  accepts and draws wrongly, turning a loud failure into a quiet one. So a
 *  keyword-only head yields NO family: the runtime keeps its documented
 *  fallback and, since rt7, says so on the console with a stable code. The
 *  right long-term answer is a real substitution table mapping each system
 *  keyword to the face that platform actually resolves it to; that needs the
 *  capture platform recorded per lane and is not invented here. */
const NON_FAMILY_KEYWORDS =
  /^(sans-serif|serif|monospace|cursive|fantasy|math|system-ui|ui-sans-serif|ui-serif|ui-monospace|ui-rounded|-apple-system|BlinkMacSystemFont|inherit|initial|revert|revert-layer|unset)$/i;
function firstFamily(stack: string): string | undefined {
  const first = splitTopLevel(stack)[0]?.trim().replace(/^["']|["']$/g, '');
  return first && !NON_FAMILY_KEYWORDS.test(first) ? first : undefined;
}

/** v15 (S4): declared facts with a NATIVE canvas field (the 'draw' verdicts
 *  in DECLARED_CHANNELS) compile into the text context; every 'annotate'
 *  verdict lands in the component DESCRIPTION instead (declaredNotes in
 *  compileComponentData) — declared-not-drawn, never silently dropped. */
function applyDeclared(declared: Record<string, string> | undefined, ctx: TextCtx): TextCtx {
  if (!declared) return ctx;
  const next: TextCtx = { ...ctx };
  for (const [prop, value] of Object.entries(declared)) {
    switch (prop) {
      case 'text-transform': {
        const CASE: Record<string, NodeSpec['textCase']> = {
          uppercase: 'UPPER', lowercase: 'LOWER', capitalize: 'TITLE', none: 'ORIGINAL',
        };
        if (CASE[value]) next.textCase = CASE[value];
        break;
      }
      case 'text-decoration-line':
        // overline has no textDecoration enum value — annotate verdict path.
        if (value === 'underline') next.textDecoration = 'UNDERLINE';
        else if (value === 'line-through') next.textDecoration = 'STRIKETHROUGH';
        else if (value === 'none') next.textDecoration = 'NONE';
        break;
      case 'text-align': {
        const ALIGN: Record<string, NodeSpec['textAlignH']> = {
          left: 'LEFT', start: 'LEFT', center: 'CENTER', right: 'RIGHT', end: 'RIGHT', justify: 'JUSTIFIED',
        };
        if (ALIGN[value]) next.textAlignH = ALIGN[value];
        break;
      }
      case 'font-family': {
        const family = firstFamily(value);
        if (family) next.fontFamily = family;
        break;
      }
      case 'text-overflow':
        if (value === 'ellipsis') next.textTruncation = true;
        break;
      // FC-FONT-SLANT-NOT-CARRIED: the slant selects a FACE, so it cannot be
      // written here — the weight half of the same face name may not have
      // been resolved yet, and a descendant may rebind it. The flag rides the
      // context and figmaFaceStyle composes both halves at the spec boundary.
      // `oblique` selects the same italic face Figma has (the synthesized
      // angled form is outside the grammar and never reaches here).
      case 'font-style':
        next.fontItalic = value === 'italic' || value === 'oblique';
        break;
      default:
        break; // annotate verdicts — description notes, not node fields
    }
  }
  return next;
}

/** Token bindings + literal channels + declared facts for one part under one
 *  combo — the ONE styling entry point every part kind compiles through. */
function applyStyling(
  spec: NodeSpec,
  part: Part,
  subst: Record<string, string>,
  ctx: TextCtx,
): TextCtx {
  const tokens = resolveTokens(part, subst);
  // R7: both passes read the SAME absolute gate the placement pass uses
  // (isAbsoluteThisCombo — declared OR this combo's stylesWhen), so an inset
  // that absolutePartPlacement lowers is never named as an in-flow drop.
  const absolute = isAbsoluteThisCombo(part, subst);
  const t = applyTokens(spec, tokens, subst, ctx, part.hugsBelowMaxWidth, part.declared, absolute);
  // The literal pass also sees the part's own token map (a token on the
  // same channel wins, by name).
  const l = applyLiterals(spec, resolveLiterals(part, subst), t, { absolute, position: part.declared?.['position'] ?? 'static' }, tokens);
  // absolute-position round: content-box geometry means captured width/
  // height EXCLUDE padding — a canvas frame resize is border-box, so the
  // carried paddings are added back (MUI's Slider root declares
  // box-sizing: content-box; every border-box part is untouched).
  if (part.declared?.['box-sizing'] === 'content-box' && spec.lits) {
    const li = spec.lits;
    if (li.height !== undefined) li.height += (li.paddingTop ?? 0) + (li.paddingBottom ?? 0);
    if (li.width !== undefined) li.width += (li.paddingLeft ?? 0) + (li.paddingRight ?? 0);
  }
  const d = applyDeclared(part.declared, l);
  // FC-OVERFLOW-CLIP-LOST: declared overflow hidden/clip draws natively as
  // clipsContent. It is set HERE, beside the other spec-level declared reads,
  // and not in applyDeclared — that function returns a TextCtx, has no `spec`
  // to write to, and its `default: break` was the unreceipted sink that ate
  // all 102 parts. auto|scroll are excluded by the registry's drawExcept, so
  // they still take the annotate path: Figma has no scroll container.
  for (const axis of ['overflow-x', 'overflow-y'] as const) {
    const v = part.declared?.[axis];
    if (v !== undefined && channelDraws(axis, v)) spec.clipsContent = true;
  }
  // Round 4: declared aspect-ratio draws natively — height follows the bound
  // width when the contract carries no height channel (Avatar/Thumbnail
  // squares whose real height rides a pseudo-element padding hack).
  // Round 5: the LITERAL width channel (v14 lits — Avatar/Thumbnail carry
  // per-size width literals, not token widths) lowers the same way.
  // R8 (2026-08-22, canvas gate `aspect-ratio` SILENT): the registry calls
  // this channel 'draw', so the declared collector in compileComponentData
  // names nothing — and what draws is a FIXED HEIGHT, not a ratio. Figma has
  // no aspect-ratio field: the dump reads back `height: 40` and the proposal
  // mints a height token; the channel the contract carried vanished with no
  // receipt. Every branch below now NAMES what happened to the ratio (the
  // lowering with its numbers, or why nothing was derived) through the same
  // channelMiss collector applyTokens / applyLiterals use.
  applyAspectRatio(spec, part.declared?.['aspect-ratio']);
  return d;
}

/** The receipt every aspect-ratio lowering opens with, so a reader can grep
 *  the code-only facts for the class. */
const ASPECT_MISS = 'the canvas has no aspect-ratio field';

/** Parse the declared grammar (`<n>` or `<n> / <n>`) to a width/height ratio;
 *  undefined when it does not parse or is not positive. */
function aspectRatioOf(aspect: string): number | undefined {
  const m = /^([\d.]+)(?: \/ ([\d.]+))?$/.exec(aspect);
  if (!m) return undefined;
  const ratio = Number(m[1]) / Number(m[2] ?? '1');
  return Number.isFinite(ratio) && ratio > 0 ? ratio : undefined;
}

const fmtPx = (n: number): string => `${Math.round(n * 100) / 100}px`;

/** Declared aspect-ratio on THIS part: lower it to a fixed height from the
 *  part's own bound/literal width when no height channel is carried, and
 *  NAME the outcome either way (see applyStyling). */
function applyAspectRatio(spec: NodeSpec, aspect: string | undefined): void {
  if (aspect === undefined) return;
  const ratio = aspectRatioOf(aspect);
  if (ratio === undefined) {
    miss(spec, 'aspect-ratio', `${ASPECT_MISS} — "${aspect}" did not parse as <n> or <n> / <n>, so nothing was derived from it`, aspect);
    return;
  }
  if (spec.fixedHeight !== undefined || spec.lits?.height !== undefined) {
    miss(spec, 'aspect-ratio', `${ASPECT_MISS} — this part already carries a height channel, which wins; the ratio itself is not enforced on the canvas`, aspect);
    return;
  }
  if (spec.fixedWidth && Number.isFinite(spec.fixedWidth.px)) {
    const h = spec.fixedWidth.px / ratio;
    spec.fixedHeight = { px: h };
    miss(spec, 'aspect-ratio', `${ASPECT_MISS} — LOWERED to a fixed height of ${fmtPx(h)} (bound width ${fmtPx(spec.fixedWidth.px)} ÷ ${ratio}); the ratio does not reach the canvas, a width change there will not follow it, and the dump reads back a fixed height`, aspect);
    return;
  }
  if (spec.lits?.width !== undefined) {
    const h = spec.lits.width / ratio;
    spec.lits.height = h;
    miss(spec, 'aspect-ratio', `${ASPECT_MISS} — LOWERED to a fixed height of ${fmtPx(h)} (literal width ${fmtPx(spec.lits.width)} ÷ ${ratio}); the ratio does not reach the canvas, a width change there will not follow it, and the dump reads back a fixed height`, aspect);
    return;
  }
  miss(spec, 'aspect-ratio', `${ASPECT_MISS} — this part carries no bound or literal width to derive a height from, so nothing was drawn from the ratio (a parent that takes its height from this part's ratio names that lowering on itself)`, aspect);
}

/** Round 5 (canvas-gate): parent aspect lowering. A frame with a known width
 *  and NO height whose ABSOLUTE child declares aspect-ratio takes its height
 *  from that child — the promoted Avatar/Thumbnail pattern: the root carries
 *  the per-size width literal; the real square rides the inset-0 child's
 *  aspect-ratio (the root's own height is a pseudo-element padding hack the
 *  capture cannot carry). Applied AFTER applyStyling, before children build. */
function applyChildAspect(spec: NodeSpec, part: Part): void {
  const w = spec.fixedWidth?.px ?? spec.lits?.width;
  if (w === undefined || !Number.isFinite(w)) return;
  if (spec.fixedHeight || spec.lits?.height !== undefined) return;
  for (const [childName, child] of Object.entries(part.parts ?? {})) {
    const aspect = child.declared?.['aspect-ratio'];
    if (!aspect || child.declared?.['position'] !== 'absolute') continue;
    const ratio = aspectRatioOf(aspect);
    if (ratio === undefined) continue;
    const h = w / ratio;
    (spec.lits ??= {}).height = h;
    // R8: the lowering is named on the frame that took the height (the
    // child's own receipt says it carried no width of its own).
    miss(spec, 'aspect-ratio', `${ASPECT_MISS} — child "${childName}"'s declared aspect-ratio LOWERED to this frame's fixed height of ${fmtPx(h)} (width ${fmtPx(w)} ÷ ${ratio}); the ratio does not reach the canvas and a width change there will not follow it`, aspect);
    return;
  }
}

/** State-preview overrides pass through applyTokens with one honest
 *  translation. Round 5d: outline-color/outline-width used to be respelled
 *  as border-* here, which drew the focus ring as an INSIDE stroke that
 *  opaque children painted over (the Banner ribbon covered the top arc).
 *  They are now stamped ':outline-preview' so applyTokens lowers them to an
 *  OUTSIDE-aligned stroke (spec.strokeOutside) — the stamp exists because
 *  the lowering is a STATE-PREVIEW approximation only: a base-plane resting
 *  outline channel draws nothing in CSS (resting outline-style is none) and
 *  must keep falling through applyTokens untranslated. Still an
 *  approximation of a CSS outline (no outline-offset carriage), documented
 *  as such. */
function translateStateOverrides(overrides: Record<string, string>): Record<string, string> {
  // The ring preview needs the FULL pair: an outline-color override alone
  // (the Button hover/active/disabled recolors) is INERT in CSS — the
  // resting outline-style/width still suppress the ring — so lowering it
  // would draw a default-width ring the web never shows (caught by the 5d
  // gate re-run: five critical secondary/tertiary state cells inflated by a
  // phantom ring).
  const ring = overrides['outline-color'] !== undefined && overrides['outline-width'] !== undefined;
  const out: Record<string, string> = {};
  for (const [cssProp, ref] of Object.entries(overrides)) {
    if (cssProp === 'outline-color' || cssProp === 'outline-width') {
      if (ring) out[`${cssProp}:outline-preview`] = ref;
      // lone outline channel: fall through untranslated (inert, like base)
    } else out[cssProp] = ref;
  }
  return out;
}

/** v13 part-level states (P18 second half): inside a State-axis PREVIEW
 *  variant, every part carrying `states[stateName]` renders with those
 *  color-kind overrides merged over its base tokens (the same
 *  translateStateOverrides rule as the root), recursively — so the drawn
 *  Disabled preview shows the disabled label color, not the default one
 *  (owner field case: #556275 on the #dfe3eb disabled fill). Returns the
 *  SAME object when nothing overrides, so base compiles stay byte-identical. */
function withPartStateOverrides(
  parts: Record<string, Part>,
  stateName: string,
  /** v17 — the preview variant's own combo, so a per-enum-value state binding
   *  resolves to THIS cell's value. Without it a statesByProp-only state would
   *  draw its preview identically to Default while the CSS surfaces render it,
   *  which is the canvas half of the same silent loss. */
  subst: Record<string, string> = {},
): Record<string, Part> {
  let changed = false;
  const out: Record<string, Part> = {};
  for (const [key, part] of Object.entries(parts)) {
    let next = part;
    const nested = part.parts ? withPartStateOverrides(part.parts, stateName, subst) : undefined;
    if (nested && nested !== part.parts) next = { ...next, parts: nested };
    const byPropOverrides: Record<string, string> = {};
    for (const e of part.statesByProp ?? []) {
      if (e.state !== stateName) continue;
      const v = subst[e.prop];
      if (v !== undefined) Object.assign(byPropOverrides, e.map[v] ?? {});
    }
    const overrides = { ...(part.states?.[stateName] ?? {}), ...byPropOverrides };
    if (Object.keys(overrides).length > 0 && !part.component && !part.slot) {
      next = { ...next, tokens: { ...(next.tokens ?? {}), ...translateStateOverrides(overrides) } };
    }
    if (next !== part) changed = true;
    out[key] = next;
  }
  return changed ? out : parts;
}

/** The derived text style a compiled text node rides, or undefined. EXACT
 *  definition match only: the node's font-size token must be a style's
 *  identity path AND the node's effective weight (its own font-weight
 *  binding, or the 'Medium' runtime default) must equal the style's — a
 *  node that overrides the group's weight keeps raw props, honestly. */
function matchTextStyle(ctx: TextCtx): string | undefined {
  if (!ctx.fontSizePath) return undefined;
  const t = textStyleByTokenPath.get(ctx.fontSizePath);
  if (!t) return undefined;
  if (t.fontSize !== ctx.fontSize || t.fontStyle !== figmaFaceStyle(ctx)) return undefined;
  return t.name;
}

/** FC-WEIGHT-IDENTITY — put the size token's identity on the canvas by the
 *  ONE carrier the node can actually hold.
 *
 *  Riding a derived text style is the preferred carrier and stays the exact
 *  bytes it always was. A node that overrides its group's weight cannot ride
 *  one (Figma clears textStyleId on any fontName write — live-verified), and
 *  used to fall through to a bare literal size: identity gone. It now binds
 *  the size VARIABLE, which is a canvas fact the inverter can read back to
 *  the token it came from. The two carriers are mutually exclusive by
 *  construction, so nothing double-declares. */
function textIdentity(
  ctx: TextCtx,
): { textStyle?: string; fontSizeVar?: string; fontWeightVar?: string } {
  // The weight token is ORTHOGONAL to the size/style carrier: a node riding a
  // text style still gets it, because the style holds the weight only until
  // someone overrides it, and the reader must not have to infer which case
  // it is looking at.
  const weight = {
    ...(ctx.fontWeightVar !== undefined ? { fontWeightVar: ctx.fontWeightVar } : {}),
    ...(ctx.lineHeightVar !== undefined ? { lineHeightVar: ctx.lineHeightVar } : {}),
  };
  const textStyle = matchTextStyle(ctx);
  if (textStyle !== undefined) return { textStyle, ...weight };
  return ctx.fontSizeVar !== undefined ? { fontSizeVar: ctx.fontSizeVar, ...weight } : weight;
}

function applyTextIdentity(spec: NodeSpec, ctx: TextCtx): void {
  Object.assign(spec, textIdentity(ctx));
}

const isEnum = (p: Prop): p is Prop & { type: { enum: string[] } } =>
  typeof p.type === 'object' && 'enum' in p.type;

/** RETURN-LEG bool axes (boolean-axis-placeholder fix): a boolean prop whose
 *  figma binding is kind VARIANT is a variant AXIS on the canvas — exactly
 *  like an enum — and its `{prop}` minted-path placeholders substitute as the
 *  two canonical value strings 'true'/'false' (the mint's own spelling:
 *  imported.avatar.root.background-image.false.true). BOOLEAN-kind props keep
 *  the component-property lowering byte-identically — measured: every
 *  committed library binds its booleans as kind BOOLEAN (487/487); the 13
 *  VARIANT-bound booleans all live in the Untitled UI proposal set. */
const isVariantBool = (p: Prop): boolean =>
  p.type === 'boolean' && p.bindings.figma.kind === 'VARIANT';

/** The two bool-axis values, canonical spelling, contract default FIRST (the
 *  same default-first invariant orderedValues gives enum axes). */
const boolAxisValues = (p: Prop): string[] =>
  p.default === true ? ['true', 'false'] : ['false', 'true'];

/** A dependency whose variant axes multiply to ONE combo (every enum axis
 *  single-valued, no VARIANT-bound booleans, no state previews) emits as a
 *  STANDALONE component — combineAsVariants never runs, so its VARIANT
 *  properties DO NOT EXIST on the emitted node (single-variant-dep-collapse).
 *  Mirrors compileComponentData's isSet computation exactly. */
const depEmitsStandalone = (dep: Contract): boolean => {
  const combos = dep.props
    .filter((p) => isEnum(p) || isVariantBool(p))
    .reduce((n, p) => n * (isEnum(p) ? p.type.enum.length : 2), 1);
  const hasPreviews = Boolean(dep.bindings.figma.statePreviews) && dep.states.length > 0;
  return combos === 1 && !hasPreviews;
};

// Icon assets (assets/icons/*.svg) — same source the code generator inlines.
const iconAssets = input.icons;

/** Compile an icon part to a concrete SVG for one variant: resolve the
 *  `{prop}` asset reference through subst, and bake currentColor to the
 *  inherited foreground color's literal value (SVG paint is not
 *  variable-bindable on import — documented fidelity scope). */
/** Round 5d (owner finding: the Badge pip fill inspected as a bare hex, no
 *  variable): when the baked markup's explicit paints (fill/stroke attrs,
 *  'none' excluded) collapse to the ONE resolved literal of the part's
 *  paint token, the glyph is single-painted and the sync runtime can
 *  re-bind the imported vectors to that token's variable. Multi-paint
 *  glyphs (distinct per-path fills) keep their baked literals — one
 *  variable cannot honestly serve two paints. */
function svgSinglePaintVar(markup: string, hex: string, paintPath: string | undefined): string | undefined {
  if (!paintPath) return undefined;
  const paints = new Set<string>();
  for (const m of markup.matchAll(/\s(?:fill|stroke)="([^"]+)"/g)) {
    if (m[1] !== 'none') paints.add(m[1]);
  }
  return paints.size === 1 && paints.has(hex) ? figmaName(paintPath) : undefined;
}

function iconSvg(part: Part, subst: Record<string, string>, ctx: TextCtx): string {
  let asset = part.icon!.asset;
  const ref = asset.match(PARENT_PROP_REF);
  if (ref) {
    const resolved = subst[ref[1]];
    if (resolved === undefined)
      throw new Error(`Cannot resolve icon asset reference "{${ref[1]}}"`);
    asset = resolved;
  }
  const svg = iconAssets.get(asset);
  if (!svg) throw new Error(`Unknown icon asset "${asset}" (expected assets/icons/${asset}.svg)`);
  // Round 4: glyph paint priority — the part's own `fill` channel (promoted
  // svg hosts), else the text color; currentColor AND attribute-less paths
  // (CSS-inherited fill) both bake to the resolved literal.
  const paintPath = ctx.glyphFillPath ?? ctx.textFillPath;
  // R7: a LITERAL ink (literals.color on the part or an ancestor) bakes into
  // the glyph exactly as the token path's resolved literal does.
  const hex = paintPath ? String(resolveLiteral(paintPath)) : (ctx.textFillLitCss ?? '#000000');
  const hasPaint = paintPath !== undefined || ctx.textFillLitCss !== undefined;
  let out = svg.replaceAll('currentColor', hex);
  // Bake the resolved paint as a `fill` ONLY for icons that declare no fill
  // anywhere — pure CSS-inherited glyphs. If the <svg> tag itself already sets
  // fill (e.g. stroke-based icons carry `fill="none"`, coloured via the
  // currentColor→hex pass above) or a child does, injecting a second `fill`
  // produces an <svg> with two `fill` attributes — invalid XML that the REAL
  // Figma createNodeFromSvg refuses ("Failed to convert SVG file"). The mock
  // parsed it leniently, so this only surfaced on a live canvas.
  const svgTagHasFill = /<svg\b[^>]*\sfill=/.test(out);
  const childHasFill = /<(path|circle|rect|polygon|ellipse|g)[^>]*\sfill=/.test(out);
  // REJECTED-SETS ROUND (shadcn.checkbox census reject): a STROKE-drawn glyph
  // whose markup carries no fill anywhere (the lucide check: an OPEN path with
  // stroke=currentColor) must NOT get the paint injected as fill — SVG's
  // initial fill is BLACK, so the open check path renders as a filled blob
  // (the browser truth was fill="none" on the <svg> tag; older reconstructed
  // assets dropped it). Inject fill="none" instead: the stroke pass above
  // already carries the paint, and the explicit none neutralises the black
  // default for both the real importer and the committed stroke-only assets.
  const childHasStroke = /<(path|circle|rect|polygon|ellipse|polyline|line|g)[^>]*\sstroke=/.test(out);
  if (!svgTagHasFill && !childHasFill && childHasStroke) {
    out = out.replace(/^<svg /, `<svg fill="none" `);
  } else if (hasPaint && !svgTagHasFill && !childHasFill) {
    out = out.replace(/^<svg /, `<svg fill="${hex}" `);
  }
  if (part.icon!.size) {
    // Round 5 (canvas-gate finding): anchor the size rewrite to the ROOT
    // <svg> tag's OWN width/height attributes. The old unanchored regex hit
    // the FIRST width-ish match anywhere — on viewBox-only assets (the 22
    // floor-reconstructed glyphs) that was a path's stroke-width, so the
    // Checkbox check drew at stroke-width 14 (a blob) and the Avatar xl
    // silhouette at stroke-width 40 (a filled square). Assets without a
    // root width/height keep their markup; the renderers/runtime size the
    // node from iconSize.
    out = out
      .replace(/^(<svg\b[^>]*?)\swidth="[^"]*"/, `$1 width="${part.icon!.size}"`)
      .replace(/^(<svg\b[^>]*?)\sheight="[^"]*"/, `$1 height="${part.icon!.size}"`);
  }
  return out;
}

const PLACEHOLDER_ATTR_REF = /^\{([a-z][\w-]*)\}$/;

/** Form-control parts (input/textarea) render as a real element in code via
 *  attrs; on the canvas the same part becomes a framed box whose placeholder
 *  text binds to the referenced TEXT property. */
function formControlSpec(
  name: string,
  part: Part,
  contract: Contract,
  ctx: TextCtx,
  subst: Record<string, string>,
): NodeSpec | null {
  if (part.element !== 'input' && part.element !== 'textarea') return null;
  const spec: NodeSpec = {
    type: 'frame',
    name,
    layout: { mode: 'HORIZONTAL', primary: 'MIN', counter: 'CENTER' },
    grow: part.layout?.grow || undefined,
  };
  const childCtx = applyStyling(spec, part, subst, ctx);
  const ref = (part.attrs?.placeholder ?? '').match(PLACEHOLDER_ATTR_REF);
  const prop = ref
    ? contract.props.find((p) => p.type === 'text' && p.name === ref[1])
    : undefined;
  // Never paint an unresolved `{placeholder}` brace form on canvas (Polaris
  // TextField live finding). Prefer the prop default; otherwise a short
  // showcase string when the attr is a prop-ref; only use a literal attr
  // when it is real text.
  let placeholderCharacters = '';
  if (typeof prop?.default === 'string' && prop.default.length) {
    placeholderCharacters = prop.default;
  } else if (prop) {
    placeholderCharacters = '';
  } else {
    const attr = part.attrs?.placeholder ?? '';
    placeholderCharacters = PLACEHOLDER_ATTR_REF.test(attr) ? '' : attr;
  }
  spec.children = [
    {
      type: 'text',
      name: 'placeholder',
      characters: placeholderCharacters,
      fontSize: childCtx.fontSize ?? 16,
      fontStyle: figmaFaceStyle(childCtx),
      ...(childCtx.lineHeight !== undefined ? { lineHeight: childCtx.lineHeight } : {}),
      ...textExtras(childCtx),
      ...textIdentity(childCtx),
      // B-3 finding 1: the placeholder paint comes from the CONTRACT — the
      // control part's own carried `color` channel (childCtx.textFill), the
      // same paint the coded input's text renders. The previous hardcoded
      // repo vocabulary name (`color/input/placeholder`) is a variable no
      // foreign token set mints: Polaris text-field.figma.js threw `Missing
      // variable` at run time. When the contract carries no color channel,
      // NO placeholder-specific variable reference is emitted at all.
      textFill: childCtx.textFill,
      contentProp: prop?.bindings.figma.property,
    },
  ];
  return spec;
}

const PARENT_PROP_REF = /^\{([a-z][\w-]*)\}$/;

/** Map canonical prop values to Figma property/value pairs through the CHILD
 *  contract's bindings. `{parentProp}` values resolve through `subst` first. */
function mapDepProps(
  dep: Contract,
  props: Record<string, string | boolean | { prop: string; map: Record<string, string> }>,
  subst: Record<string, string>,
  text?: string,
  /** Named-loss sink (single-variant-dep-collapse): the caller appends these
   *  to the instance spec's channelMiss footnote — never a silent drop. */
  ledger?: CodeOnlyFactSeed[],
): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  const standalone = depEmitsStandalone(dep);
  for (const [propName, rawValue] of Object.entries(props)) {
    const depProp = dep.props.find((p) => p.name === propName);
    if (!depProp) continue;
    if (depProp.bindings.figma.kind === 'NONE') {
      // code-only (v7 arrayOf; ROUND 3 promoted character overrides). An
      // arrayOf value never reaches here (the emitter refuses it in
      // anatomy); a fixed text value is a REAL canvas loss — ledgered.
      if (typeof rawValue === 'string' || typeof rawValue === 'object') {
        ledger?.push({
          channel: `${dep.name} prop "${propName}"`,
          value: typeof rawValue === 'object' ? `a per-value lookup on "${rawValue.prop}"` : JSON.stringify(rawValue),
          reason: `not wired — the dependency binds it figma kind NONE (code-only), so the canvas instance renders ${dep.name}'s own default`,
        });
      }
      continue;
    }
    let value: string | boolean;
    if (typeof rawValue === 'object') {
      // PropByProp lookup: resolve against this combo's subst at compile
      // time; a parent value absent from the map applies nothing (child
      // default).
      const resolved = rawValue.map[subst[rawValue.prop] ?? ''];
      if (resolved === undefined) continue;
      value = resolved;
    } else {
      value = rawValue;
    }
    if (typeof value === 'string') {
      const parentRef = value.match(PARENT_PROP_REF);
      if (parentRef) {
        const resolved = subst[parentRef[1]];
        if (resolved === undefined)
          throw new Error(`Cannot resolve parent prop mapping "{${parentRef[1]}}"`);
        value = resolved;
      }
    }
    const fig = depProp.bindings.figma;
    // single-variant-dep-collapse fix (parent side): a standalone dep exposes
    // NO variant properties — a VARIANT binding whose value IS the dep's sole
    // axis value is already guaranteed by the single-variant form (drop, the
    // honest no-op); any OTHER value is unrenderable and refuses BY NAME at
    // compile time instead of the runtime setInstanceProps throw.
    if (fig.kind === 'VARIANT' && standalone) {
      // A standalone dep exposes NO variant properties, so the binding cannot
      // be wired either way. Two dispositions, and the difference matters:
      //   · the bound value IS the dep's sole axis value — the single form
      //     already renders exactly it, so dropping the wire is a no-op;
      //   · any OTHER value is a real LOSS (the icon renders its only form,
      //     not the requested one) — LEDGERED by name, never a hard refusal.
      // It is a ledger and not a refusal because the parent still builds
      // correctly in every other respect: aborting a whole component set over
      // one unwireable nested property destroys working output and, measured,
      // regressed the owner's own two-import session (cross-import-check's
      // dialog + linked button, which compiled before this branch existed).
      const canonical = typeof value === 'boolean' ? String(value) : value;
      const sole =
        isEnum(depProp) && depProp.type.enum.length === 1 ? depProp.type.enum[0] : undefined;
      if (sole === undefined || canonical !== sole) {
        ledger?.push({
          channel: `${dep.name} variant property "${fig.property}"`,
          value: canonical,
          reason: `not wired — the dependency emits standalone (single variant, no variant properties) and renders its only form${sole !== undefined ? ` ("${sole}")` : ''}`,
        });
      }
      continue;
    }
    if (typeof value === 'boolean') {
      // A VARIANT-bound boolean is an axis: the wired value is the axis's
      // figma value name ('True'/'False'), the same spelling the dep's own
      // variant names use. BOOLEAN-kind keeps the raw boolean byte-identically.
      if (fig.kind === 'VARIANT') out[fig.property!] = fig.values?.[String(value)] ?? String(value);
      else out[fig.property!] = value;
    } else out[fig.property!] = fig.values?.[value] ?? value;
  }
  if (text !== undefined) {
    const textProp = dep.props.find((p) => p.type === 'text' && p.bindings.code.prop === 'children');
    // ROUND 3: a text prop promoted from a raw instance character override
    // binds figma kind NONE — there is no component property to write, and
    // `out[undefined]` would have minted a garbage key. Named loss instead.
    if (textProp && textProp.bindings.figma.kind === 'NONE') {
      ledger?.push({
        channel: `${dep.name} children text`,
        value: text,
        reason: `not wired — ${dep.id} exposes no TEXT component property for it (the canvas carries such labels as raw instance overrides, which the contract vocabulary does not model)`,
      });
    } else if (textProp) out[textProp.bindings.figma.property!] = text;
  }
  return out;
}

/** visibleWhen on a boolean prop → runtime visibility binding fields.
 *  (Enum-valued visibleWhen.equals never reaches here — those parts are
 *  filtered out of non-matching variants at compile time.) */
function applyVisibleWhen(spec: NodeSpec, part: Part, contract: Contract): void {
  if (!part.visibleWhen || part.visibleWhen.equals !== undefined) return;
  const prop = contract.props.find((p) => p.name === part.visibleWhen!.prop);
  if (!prop || prop.type !== 'boolean') return;
  // A VARIANT-bound boolean is a variant axis: presence is compiled per combo
  // in variantParts, and there is no BOOLEAN component property to bind (the
  // old binding registered a key the runtime never mints — the visibles loop
  // silently `continue`d and the node stayed visible in every variant).
  if (prop.bindings.figma.kind === 'VARIANT') return;
  spec.visibleProp = prop.bindings.figma.property;
  spec.visibleDefault = prop.default === true;
}

/** Drop parts whose visibleWhen.equals doesn't match this variant's values. */
/** v7 stylesWhen, canvas slice: OPACITY is the one whitelisted literal the
 *  canvas can honestly render (node opacity — the dump v1.2 channel inverted
 *  back out; field case: Eventz `isDisabled` roots at 0.4). A condition
 *  resolves at COMPILE time: enum `equals` against the combo's subst; a
 *  boolean against its contract DEFAULT (boolean-true combos are not
 *  compiled — the documented canvas limit). Every other stylesWhen key stays
 *  the documented canvas fidelity limit (schema note on StylesWhenSchema). */
function applyStylesWhenOpacity(
  spec: NodeSpec,
  part: Part,
  contract: Contract,
  subst: Record<string, string>,
): void {
  for (const sw of part.stylesWhen ?? []) {
    const raw = sw.styles['opacity'];
    const applies =
      sw.equals !== undefined
        ? subst[sw.prop] === sw.equals
        : subst[sw.prop] !== undefined
          ? subst[sw.prop] === 'true' // VARIANT-bound bool: a compiled axis
          : contract.props.find((p) => p.name === sw.prop)?.default === true;
    if (!applies) continue;
    // ANTD EXAM (heal loop): a per-value border STYLE on this combo — antd's
    // dashed Button type drew a SOLID stroke, a wrong fact rather than a
    // named one. dashed → [3,3], dotted → [1,2] (Chromium's 1px rendering).
    const styles = ['border-style', 'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style'].map((k) => sw.styles[k]).filter(Boolean);
    if (styles.includes('dashed')) spec.dashPattern = [3, 3];
    else if (styles.includes('dotted')) spec.dashPattern = [1, 2];
    if (raw === undefined) continue;
    const value = Number.parseFloat(raw);
    if (!Number.isNaN(value)) spec.opacity = value;
  }
}

/** v9 shape placement, compiled per combo from the part's stylesWhen — the
 *  PROPOSER'S closed grammar only (position:absolute; left/right/top/bottom
 *  as '<n>px' or '50%'; transform of translateX/Y(-50%) and rotate(<n>deg)).
 *  A condition holds like applyStylesWhenOpacity: enum `equals` against the
 *  combo's subst, a boolean against its contract default. Styles outside the
 *  grammar keep the documented canvas stylesWhen fidelity limit. */
function shapePlacement(
  part: Part,
  contract: Contract,
  subst: Record<string, string>,
): { absolute?: NodeSpec['absolute']; rotation?: number } {
  const out: { absolute?: NodeSpec['absolute']; rotation?: number } = {};
  const PX = /^(-?[\d.]+)px$/;
  for (const sw of part.stylesWhen ?? []) {
    const applies =
      sw.equals !== undefined
        ? subst[sw.prop] === sw.equals
        : subst[sw.prop] !== undefined
          ? subst[sw.prop] === 'true' // VARIANT-bound bool: a compiled axis
          : contract.props.find((p) => p.name === sw.prop)?.default === true;
    if (!applies) continue;
    const st = sw.styles;
    if (st['position'] !== 'absolute') {
      const rot = (st['transform'] ?? '').match(/rotate\((-?[\d.]+)deg\)/);
      if (rot) out.rotation = parseFloat(rot[1]);
      continue;
    }
    const a: NonNullable<NodeSpec['absolute']> = { h: 'MIN', v: 'MIN' };
    const t = st['transform'] ?? '';
    const px = (v: string | undefined) => {
      const m = (v ?? '').match(PX);
      return m ? parseFloat(m[1]) : undefined;
    };
    if (st['left'] === '50%' && t.includes('translateX(-50%)')) a.h = 'CENTER';
    else if (px(st['right']) !== undefined) { a.h = 'MAX'; a.right = px(st['right']); }
    else if (px(st['left']) !== undefined) { a.h = 'MIN'; a.left = px(st['left']); }
    if (st['top'] === '50%' && t.includes('translateY(-50%)')) a.v = 'CENTER';
    else if (px(st['bottom']) !== undefined) { a.v = 'MAX'; a.bottom = px(st['bottom']); }
    else if (px(st['top']) !== undefined) { a.v = 'MIN'; a.top = px(st['top']); }
    out.absolute = a;
    const rot = t.match(/rotate\((-?[\d.]+)deg\)/);
    if (rot) out.rotation = parseFloat(rot[1]);
  }
  return out;
}

/** True when this combo places the part absolutely — declared, or a matching
 *  stylesWhen `position: absolute` (Astryx Slider vertical valueDisplay=text
 *  pins the readout beside the thumb; horizontal stays in-flow). */
function isAbsoluteThisCombo(part: Part, subst: Record<string, string>): boolean {
  if (part.declared?.['position'] === 'absolute' || part.declared?.['position'] === 'fixed') return true;
  return (part.stylesWhen ?? []).some(
    (sw) =>
      sw.equals !== undefined &&
      subst[sw.prop] === sw.equals &&
      (sw.styles['position'] === 'absolute' || sw.styles['position'] === 'fixed'),
  );
}

function applyAbsoluteThisCombo(spec: NodeSpec, part: Part, subst: Record<string, string>): void {
  if (!isAbsoluteThisCombo(part, subst)) return;
  const a = absolutePartPlacement(part, subst);
  if (a) spec.absolute = a;
}

/** ABSOLUTE-POSITION ROUND (MUI Slider/Switch live finding): a declared
 *  position:absolute part whose offset facts were ADMITTED to fusion
 *  (absolute-geometry-admitted receipts) lowers to exact absolute placement.
 *  Offsets resolve from tokens/literals per combo; a declared identity-
 *  translate transform (matrix(1,0,0,1,tx,ty)) folds into them. Both sides
 *  carried → STRETCH (rail: left 0 + right 0 = full width at fixed height).
 *  No offset carried at all → null (the inset-overlay / parent-bound
 *  lowerings own those shapes). */
function absolutePartPlacement(
  part: Part,
  subst: Record<string, string>,
): NodeSpec['absolute'] | null {
  const tokens = resolveTokens(part, subst);
  const lits = resolveLiterals(part, subst);
  const num = (ch: string): number | undefined => {
    const ref = tokens[ch];
    let value: string | undefined;
    if (ref) {
      let tokenPath = ref.slice(1, -1);
      for (const [propName, v] of Object.entries(subst)) tokenPath = tokenPath.replaceAll(`{${propName}}`, v);
      value = String(resolveLiteral(tokenPath));
    } else if (lits[ch] !== undefined) value = String(lits[ch]);
    if (value === undefined) return undefined;
    return parseLitPx(value);
  };
  const left = num('left');
  const right = num('right');
  const top = num('top');
  const bottom = num('bottom');
  if (left === undefined && right === undefined && top === undefined && bottom === undefined) return null;
  // Per-axis translate rides the SYNTHETIC channels (minted planes resolve
  // per combo); a uniform declared identity matrix is the fallback spelling.
  const tm = /^matrix\(1, 0, 0, 1, (-?[\d.]+), (-?[\d.]+)\)$/.exec(part.declared?.['transform'] ?? '');
  const tx = num('translate-x') ?? (tm ? parseFloat(tm[1]) : 0);
  const ty = num('translate-y') ?? (tm ? parseFloat(tm[2]) : 0);
  const a: NonNullable<NodeSpec['absolute']> = { h: 'MIN', v: 'MIN' };
  if (left !== undefined && right !== undefined) { a.h = 'STRETCH'; a.left = left + tx; a.right = right - tx; }
  else if (left !== undefined) { a.h = 'MIN'; a.left = left + tx; }
  else if (right !== undefined) { a.h = 'MAX'; a.right = right - tx; }
  else { a.h = 'MIN'; a.left = tx; }
  if (top !== undefined && bottom !== undefined) { a.v = 'STRETCH'; a.top = top + ty; a.bottom = bottom - ty; }
  else if (top !== undefined) { a.v = 'MIN'; a.top = top + ty; }
  else if (bottom !== undefined) { a.v = 'MAX'; a.bottom = bottom - ty; }
  else { a.v = 'MIN'; a.top = ty; }
  return a;
}

/** B-3 finding 5: overlay-anatomy detection. A part whose FOUR inset
 *  channels (top/right/bottom/left) are ALL carried (tokens or literals) and
 *  ALL resolve to ~0 is an inset-0 overlay (`position: absolute; inset: 0`
 *  anatomy — TextField's backdrop): it must NOT flow as an auto-layout
 *  sibling. A part that itself declares `position: relative` (the in-flow
 *  element the overlay sits behind — TextField's input) is excluded: its
 *  inset channels are inert in CSS too. */
function insetOverlayOffsets(
  part: Part,
  subst: Record<string, string>,
): { top: number; right: number; bottom: number; left: number } | null {
  if (part.declared?.['position'] === 'relative') return null;
  const tokens = resolveTokens(part, subst);
  const lits = resolveLiterals(part, subst);
  const offsets = { top: 0, right: 0, bottom: 0, left: 0 };
  let carried = 0;
  let numeric = true;
  for (const ch of ['top', 'right', 'bottom', 'left'] as const) {
    let value: string | undefined;
    const ref = tokens[ch];
    if (ref) {
      let tokenPath = ref.slice(1, -1);
      for (const [propName, v] of Object.entries(subst)) {
        tokenPath = tokenPath.replaceAll(`{${propName}}`, v);
      }
      value = String(resolveLiteral(tokenPath));
    } else if (lits[ch] !== undefined) {
      value = String(lits[ch]);
    }
    if (value === undefined) continue;
    carried++;
    const n = parseLitPx(value);
    if (n === undefined) numeric = false;
    else offsets[ch] = n;
  }
  // All four inset channels carried and numeric → an inset overlay at those
  // offsets (Round 5: offsets generalized beyond 0 — the Checkbox
  // indeterminate glyph rides inset -2px; B-3 finding 5 was the 0 case).
  // Absolute-position round: carried SYNTHETIC translate channels shift the
  // box (MUI centers rails/thumbs via translate(-50%) idioms) — folded into
  // the offsets here. Contracts without the channels are byte-unchanged.
  if (carried === 4 && numeric) {
    const tnum = (ch: string): number => {
      const ref = tokens[ch];
      if (ref) {
        let tokenPath = ref.slice(1, -1);
        for (const [propName, v] of Object.entries(subst)) tokenPath = tokenPath.replaceAll(`{${propName}}`, v);
        const n = parseLitPx(String(resolveLiteral(tokenPath)));
        return n ?? 0;
      }
      const n = lits[ch] !== undefined ? parseLitPx(String(lits[ch])) : undefined;
      return n ?? 0;
    };
    const tx = tnum('translate-x');
    const ty = tnum('translate-y');
    if (tx !== 0 || ty !== 0) {
      return { top: offsets.top + ty, bottom: offsets.bottom - ty, left: offsets.left + tx, right: offsets.right - tx };
    }
    return offsets;
  }
  // Round 5: a DECLARED position:absolute part with NO carried inset
  // channels whose box is parent-bound (declared aspect-ratio, or max
  // dimensions 100%) lowers to the inset-0 overlay — the floor-promoted
  // Checkbox glyph host (real CSS centers it via a 50% translate the
  // computed capture cannot carry; parent attachment is the honest
  // approximation, named in the canvas fidelity notes).
  if (
    carried === 0 &&
    part.declared?.['position'] === 'absolute' &&
    (part.declared?.['aspect-ratio'] !== undefined ||
      part.declared?.['max-width'] === '100%' ||
      part.declared?.['max-height'] === '100%')
  ) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  return null;
}

function variantParts(
  parts: Record<string, Part>,
  subst: Record<string, string>,
): Array<[string, Part]> {
  // CSS PAINT ORDER (Switch live finding): OUT-OF-FLOW elements paint ABOVE
  // in-flow siblings, each group in DOM order — the thumb-bearing absolute
  // switchBase must sit over the in-flow track. Stable partition: in-flow
  // first, positioned after (TextField's backdrop→input pair keeps its DOM
  // order inside the positioned group).
  //
  // ORGANISM round — position:relative NO LONGER PARTITIONS. A relative box
  // stays IN FLOW: CSS paints it above overlapping siblings but never moves
  // it in the layout. In an auto-layout row there is no overlap to resolve,
  // so the partition only reordered the row — MUI's TablePagination select
  // jumped to the END of its toolbar (…label, displayedRows, actions, select)
  // and Autocomplete's relative chips fell BEHIND their input. Absolute parts
  // (the Switch/Slider overlay pins) partition exactly as before.
  const entries = Object.entries(parts);
  // Wave B.2 (Carbon checkbox): ::after check only declares position via
  // stylesWhen for shown values, while ::before has declared absolute. Treating
  // only `declared.position` as out-of-flow sorted the check BEFORE the box so
  // the filled ::before painted over the white L. Honor combo-matching
  // stylesWhen position:absolute too (CSS ::after still paints above ::before
  // when both are absolute — document order among the positioned group).
  const positioned = (p: Part): boolean =>
    p.declared?.['position'] === 'absolute' ||
    (p.stylesWhen ?? []).some(
      (sw) =>
        sw.styles['position'] === 'absolute' &&
        (sw.equals === undefined || subst[sw.prop] === sw.equals),
    );
  entries.sort((x, y) => Number(positioned(x[1])) - Number(positioned(y[1])));
  return entries.filter(([, p]) => {
    // v11: a native checkable control (input[type=checkbox|radio]) is CODE
    // semantics — the presentational box and glyphs are the visual; the
    // canvas doesn't draw semantics, so the part compiles to no node at all.
    if (isNativeCheckablePart(p)) return false;
    const vw = p.visibleWhen;
    if (vw && vw.equals !== undefined) {
      const value = subst[vw.prop];
      const eqs = Array.isArray(vw.equals) ? vw.equals : [vw.equals];
      if (value !== undefined && !eqs.includes(value)) return false;
    } else if (vw && subst[vw.prop] !== undefined && subst[vw.prop] !== 'true') {
      // Boolean visibleWhen over a VARIANT-bound bool: the bool is a variant
      // axis, so its value is in subst — the part exists only in the 'true'
      // half of the grid, resolved at COMPILE time exactly like enum equals.
      // BOOLEAN-kind props never enter subst and keep the runtime visibility
      // binding (absent-bool no-op).
      return false;
    }
    // v9: an enum-conditioned stylesWhen display:none that matches this
    // combo suppresses the part — the shape-placement spelling for axis
    // values where the decor is hidden in every drawn variant.
    for (const sw of p.stylesWhen ?? []) {
      if (sw.equals !== undefined && subst[sw.prop] === sw.equals && sw.styles['display'] === 'none') {
        return false;
      }
    }
    // Round 4 base-hidden presence: declared display:none is the BASE state
    // (sr-only parts, defaultless-axis glyphs); a stylesWhen entry matching
    // this combo RESTORES the part. Boolean-conditioned entries evaluate at
    // the drawn cell's boolean defaults (false) — a named canvas limit.
    if (p.declared?.['display'] === 'none') {
      const restored = (p.stylesWhen ?? []).some(
        (sw) => sw.equals !== undefined && subst[sw.prop] === sw.equals && sw.styles['display'] !== undefined && sw.styles['display'] !== 'none',
      );
      if (!restored) return false;
    }
    return true;
  });
}

/** v12 repeat (P9): a repeat part compiles to its OBSERVED sample — one REAL
 *  instance per drawn sibling (the meter discipline: the canvas renders the
 *  collection's honest static state; the array prop is code-only, kind
 *  'NONE'). Every other part kind compiles to exactly one spec. */
/** v15 text extras: conditional spread — absent facts add NO fields, so
 *  contracts without them emit byte-identical specs (golden discipline). */
function textExtras(ctx: TextCtx): Partial<NodeSpec> {
  return {
    // R7 LITERAL INK: rides every text-spec site through this one spread (the
    // child text part, the boxed text, the bound-prop label, the auto-injected
    // label, the input placeholder). A bound fill on the context wins.
    ...(ctx.textFillLit !== undefined && ctx.textFill === undefined ? { textFillLit: ctx.textFillLit } : {}),
    ...(ctx.letterSpacing !== undefined ? { letterSpacing: ctx.letterSpacing } : {}),
    ...(ctx.textCase !== undefined ? { textCase: ctx.textCase } : {}),
    ...(ctx.textDecoration !== undefined ? { textDecoration: ctx.textDecoration } : {}),
    ...(ctx.textAlignH !== undefined ? { textAlignH: ctx.textAlignH } : {}),
    ...(ctx.fontFamily !== undefined ? { fontFamily: ctx.fontFamily } : {}),
    ...(ctx.textTruncation ? { textTruncation: true } : {}),
  };
}

/** A2 grid (G2/G4/G5): stamp compiled cells onto a GRID parent's children.
 *  Runs AFTER the parent's children are compiled (specs carry the part
 *  names, which is how a cell finds its part). Three jobs:
 *    · manual mode — each child takes its part's `placement`, or the area
 *      rect its NAME anchors to (G4: the area name IS the slot anchor);
 *      spans of 1 and AUTO aligns are omitted (deterministic minimal spec).
 *    · empty areas — an area with no matching child compiles a PLACEHOLDER
 *      frame carrying the area's rect, so the grid's shape is visible with
 *      nothing in it. G4's convention is now STRUCTURAL (presence + name +
 *      placement box), not placeholder pixels: an area that IS a slot part
 *      compiles a native SLOT node with the contract's own styling and no
 *      chrome at all (native-slots-proposal §2 supersedes the dashed
 *      placeholder; layout-grammar-proposal G4 revised to match).
 *    · flow mode — placement fact is CHILD ORDER (P5); the emitter DECLARES
 *      the derived row tracks itself (ceil(children/columns) × {FLEX,1})
 *      because the API under-reports implicit rows (P9).
 *  Overlay/absolute parts keep the out-of-flow grammar and never take cells
 *  (P13: absolute children report bogus 0,0 anchors). */
function stampGridCells(parentSpec: NodeSpec, part: Part, subst: Record<string, string>): void {
  const g = parentSpec.layout?.grid;
  if (!g || parentSpec.layout?.mode !== 'GRID') return;
  const children = parentSpec.children ?? [];
  if (g.flow) {
    // G5′ (2026-08-08): declared rows under flow are the contract fact and are
    // written verbatim — GP6/GP6b measured ROW_AUTO_FLOW and declared
    // gridRowSizes coexisting natively. Only an OMITTED row list is derived,
    // so every pre-G5′ flow contract compiles to the same bytes.
    if (g.rows.length === 0) {
      const inFlow = children.filter((c) => !c.overlay && !c.insetOverlay && !c.absolute).length;
      const rowsN = Math.max(1, Math.ceil(inFlow / Math.max(1, g.columns.length)));
      g.rows = Array.from({ length: rowsN }, () => ({ type: 'FLEX' as const, value: 1 }));
    }
    return;
  }
  const areas = (resolveLayout(part, subst)?.areas ?? {});
  const parts = part.parts ?? {};
  for (const child of children) {
    const src = parts[child.name];
    if (!src || src.overlay) continue;
    const placement = src.placement ?? areas[child.name];
    if (!placement) continue;
    const alignX = ('alignX' in placement ? placement.alignX : undefined) as
      | 'auto' | 'start' | 'center' | 'end' | undefined;
    const alignY = ('alignY' in placement ? placement.alignY : undefined) as
      | 'auto' | 'start' | 'center' | 'end' | undefined;
    child.cell = {
      row: placement.row,
      column: placement.column,
      ...(placement.rowSpan && placement.rowSpan > 1 ? { rowSpan: placement.rowSpan } : {}),
      ...(placement.columnSpan && placement.columnSpan > 1 ? { columnSpan: placement.columnSpan } : {}),
      ...(alignX && alignX !== 'auto' ? { hAlign: GRID_ALIGN_FIGMA[alignX] } : {}),
      ...(alignY && alignY !== 'auto' ? { vAlign: GRID_ALIGN_FIGMA[alignY] } : {}),
    };
  }
  const childNames = new Set(children.map((c) => c.name));
  for (const [areaName, rect] of Object.entries(areas)) {
    if (childNames.has(areaName)) continue;
    children.push({
      type: 'frame',
      name: areaName,
      layout: { mode: 'HORIZONTAL', primary: 'MIN', counter: 'MIN' },
      children: [],
      cell: {
        row: rect.row,
        column: rect.column,
        ...(rect.rowSpan && rect.rowSpan > 1 ? { rowSpan: rect.rowSpan } : {}),
        ...(rect.columnSpan && rect.columnSpan > 1 ? { columnSpan: rect.columnSpan } : {}),
      },
    });
  }
  parentSpec.children = children;
}

function partToSpecs(
  name: string,
  part: Part,
  contract: Contract,
  byId: Map<string, Contract>,
  ctx: TextCtx,
  subst: Record<string, string>,
): NodeSpec[] {
  if (part.repeat && part.component) {
    const dep = byId.get(part.component.id)!; // resolvability guaranteed by refuseUnresolvableRefs
    return part.repeat.sample.map((rec, i) => {
      // Field values map through the child's bindings exactly like fixed
      // props (numbers spell as strings on the canvas — TEXT properties).
      const fields: Record<string, string | boolean> = {};
      for (const [k, v] of Object.entries(rec)) fields[k] = typeof v === 'number' ? String(v) : v;
      const spec: NodeSpec = {
        type: 'instance',
        name: i === 0 ? name : `${name} ${i + 1}`,
        dep: dep.name,
        depContractId: dep.id,
        ...(dep.bindings.figma.anchors.componentSetKey ? { depAnchorKey: dep.bindings.figma.anchors.componentSetKey } : {}),
        depProps: mapDepProps(dep, { ...(part.component!.props ?? {}), ...fields }, subst, part.component!.text),
      };
      applyVisibleWhen(spec, part, contract);
      return spec;
    });
  }
  // Wave B.4 / FC-ABS-SIZE residual (Astryx Slider live): `display:contents`
  // must not become a clipped hug frame. CSS makes the element's children
  // participate in the grandparent's box — hoist them so absolute thumbs
  // (left≈10 inside a ~49px track) are not half-clipped by a 20×20 wrapper.
  // Parent `stylesWhen display:none` is already applied by variantParts when
  // this part is selected; defend in-place for direct calls.
  if (part.declared?.['display'] === 'contents') {
    for (const sw of part.stylesWhen ?? []) {
      if (
        sw.equals !== undefined &&
        subst[sw.prop] === sw.equals &&
        sw.styles['display'] === 'none'
      ) {
        return [];
      }
    }
    return variantParts(part.parts ?? {}, subst).flatMap(([childName, child]) =>
      partToSpecs(childName, child, contract, byId, ctx, subst),
    );
  }
  return [partToSpec(name, part, contract, byId, ctx, subst)];
}

/** ROOT TEXT (canvas round-trip gate, 2026-08-22 — core/root-text-check.ts).
 *
 *  A contract whose ROOT carries `text` — `<div>Sample</div>` captured as
 *  one element (the conformance cases color-hex / custom-prop-two-hop /
 *  var-fallback-chain / webkit-text-fill-color / text-overflow-ellipsis;
 *  Fluent's Tooltip, whose root is the copy plus an arrow part) — was never
 *  lowered. `partToSpecs` reads `part.text` for CHILD parts only, and the
 *  root handling in compileComponentData knew `icon`, `parts` and the
 *  `children` text prop, not `text`: the variant compiled to `children: []`,
 *  the canvas drew a 1×1 empty box, and the root's characters, colour,
 *  font-size, font-weight and text-overflow vanished with ZERO code-only
 *  facts — five of the gate's six SILENT rows.
 *
 *  The root is a COMPONENT (a frame — it cannot itself be a TEXT node), so
 *  it HOSTS one TEXT child named `label`: the name the generator already
 *  gives the auto-injected `children` label, and the name the proposer's
 *  sole-root-text hoist looks for. The child is projected through
 *  partToSpecs exactly as a CHILD text part is — a part carrying only the
 *  text inherits the root's compiled text context (fill, size, weight,
 *  truncation, case, family) the way every child text part inherits its
 *  parent's — so nothing bespoke is invented: the root simply hosts the
 *  text it declared. `textByProp` rides along unchanged. */
function rootTextSpecs(
  root: Contract['anatomy']['root'],
  contract: Contract,
  byId: Map<string, Contract>,
  ctx: TextCtx,
  subst: Record<string, string>,
): NodeSpec[] {
  // ANTD EXAM (Tag, 2026-08-23): the root's text can also be PROP-BOUND —
  // `content: { prop: 'children' }` on a root that ALSO has parts (antd's
  // Tag: `<span class="ant-tag">Tag<span class="anticon">…</span></span>`).
  // The literal branch above was the only one this function knew, so a
  // prop-bound root label beside a part compiled to no text node at all —
  // the compile receipt's "no TEXT node carrying Tag" pin was the only
  // thing that noticed, and nothing named it. The bound label is hosted the
  // same way a child `content` part is (a TEXT child named `label` linked to
  // the text property). A root with NO parts keeps the `children` branch.
  if (root.text === undefined && root.content === undefined) return [];
  const hosted: Part = root.text !== undefined
    ? ({ text: root.text, ...(root.textByProp ? { textByProp: root.textByProp } : {}) } as Part)
    : ({ content: root.content } as Part);
  return partToSpecs('label', hosted, contract, byId, ctx, subst);
}

function partToSpec(
  name: string,
  part: Part,
  contract: Contract,
  byId: Map<string, Contract>,
  ctx: TextCtx,
  subst: Record<string, string>,
): NodeSpec {
  const spec = partToSpecInner(name, part, contract, byId, ctx, subst);
  // v7 overlay: stamped on whatever node kind the part compiled to; the
  // runtime applies it after the node is appended (layoutPositioning
  // requires an auto-layout parent).
  if (part.overlay) spec.overlay = part.overlay;
  applyStylesWhenOpacity(spec, part, contract, subst);
  return spec;
}

function partToSpecInner(
  name: string,
  part: Part,
  contract: Contract,
  byId: Map<string, Contract>,
  ctx: TextCtx,
  subst: Record<string, string>,
): NodeSpec {
  if (part.icon) {
    // The part's own tokens (e.g. a color override) apply to the glyph.
    const iconCtx = applyTokens({ type: 'frame', name: '_' }, resolveTokens(part, subst), subst, ctx);
    const markup = iconSvg(part, subst, iconCtx);
    const paintPath = iconCtx.glyphFillPath ?? iconCtx.textFillPath;
    // R7: a literal ink has no variable to re-bind (svgPaintVar stays unset);
    // the baked hex is the literal itself.
    const paintHex = paintPath ? String(resolveLiteral(paintPath)) : (iconCtx.textFillLitCss ?? '#000000');
    const paintVar = svgSinglePaintVar(markup, paintHex, paintPath);
    // FC-SVG-ROTATION: declared transform rotate(<n>deg) on bare (and
    // box-hosted) icon parts — Polaris Spinner capture gaps at 12 o'clock
    // while developed receipts open at ~3 o'clock.
    const declaredRot = (part.declared?.['transform'] ?? '').match(
      /rotate\((-?[\d.]+)deg\)/,
    );
    const svgRotation = declaredRot ? parseFloat(declaredRot[1]) : undefined;
    const spec: NodeSpec = {
      type: 'svg',
      name,
      svg: markup,
      ...(paintVar ? { svgPaintVar: paintVar } : {}),
      grow: part.layout?.grow || undefined,
      // Round 4 (canvas-gate finding): a viewBox-only svg has no intrinsic
      // size — the icon draws 0×0 in shrink-to-fit contexts. The contract's
      // icon.size (captured glyph size) sizes the node on every surface.
      ...(part.icon.size ? { iconSize: part.icon.size } : {}),
      ...(svgRotation !== undefined && !Number.isNaN(svgRotation)
        ? { rotation: svgRotation }
        : {}),
    };
    // CARBON LIVE-DEFECT ROUND (D6) — AN ICON PART CAN ALSO BE A BOX.
    //
    // The icon lowering compiled the part to a BARE svg node sized by
    // `icon.size` and threw the part's own box away — every fill, border,
    // padding, radius and width/height channel it carried. Carbon's
    // IconButton is exactly that shape: `button.cds--btn` carries the
    // per-kind background + 1px border + the 24/32/40/48 control box AND
    // hosts the glyph, so the live canvas drew a bare 16px glyph with no
    // button chrome at all (measured: `btn` 16×16 inside a 24×24 wrapper).
    //
    // Same lowering the MUI round gave box-carrying TEXT parts (`wrapTextInBox`
    // below): a box-carrying icon part becomes FRAME(box) → svg child; a
    // box-less icon part keeps the plain svg lowering BYTE-IDENTICALLY.
    // "Carries a box" = paints one (background / border / shadow) or reserves
    // space around the glyph (padding). A part whose only geometry is a
    // width/height equal to the glyph is NOT a box — it stays bare.
    const iconPartHasBox = (): boolean => {
      const chans = [...Object.keys(resolveTokens(part, subst)), ...Object.keys(resolveLiterals(part, subst))];
      return chans.some(
        (c) =>
          c === 'background-color' ||
          c === 'background-image' ||
          c === 'box-shadow' ||
          c.startsWith('padding') ||
          /^border-(top|right|bottom|left)-width$/.test(c),
      );
    };
    if (!iconPartHasBox()) {
      // AN ICON PART'S DECLARED POSITION WAS DROPPED IN SILENCE.
      //
      // This early return is the whole bug. `partToSpecs` handles `part.icon`
      // FIRST, and a boxless icon returned here — while the inset-overlay /
      // absolute lowering lives further down, on the general frame path. So a
      // contract could declare `position: absolute` plus all four inset
      // channels on an icon part and the emitter would carry NONE of it, with
      // nothing refused and nothing logged. The part just flowed as an
      // ordinary sibling.
      //
      // Measured on MUI Radio, which is two real committed SVGs — the
      // RadioButtonUnchecked donut and the RadioButtonChecked dot, the dot
      // declaring `position:absolute` + inset 0 so it rides ON the ring. Both
      // carry `grow`, so with the position dropped they became two in-flow
      // children of a 24px HORIZONTAL frame and split it 50/50: a squashed
      // ring with the dot BESIDE it instead of concentric circles. That is
      // the visible half of a 38.50% AA score whose boxes otherwise agree
      // exactly (20×20 both) — the reference was already falsified as the
      // cause (all 28 sibling gate-shots score identically).
      //
      // Applied to the BARE SVG here, and to the box-carrying FRAME below —
      // both, because each `if (part.icon)` branch RETURNS. The first cut of
      // this fix said the opposite in a comment ("a box-carrying icon builds a
      // frame that reaches the general lowering on its own"), and that was
      // FALSE: the frame branch does `applyVisibleWhen(frame, …); return frame`
      // ~15 lines below, while the general lowering lives ~250 lines further
      // on, unreachable from either. A confident sentence about control flow is
      // still a guess until the `return` between the two points is looked at.
      //
      // An icon part declaring no position and no insets is byte-unchanged on
      // both branches, so this is inert for every icon part in the corpus that
      // does not ask for placement.
      const io = insetOverlayOffsets(part, subst);
      if (io) {
        spec.insetOverlay = true;
        if (io.top !== 0 || io.right !== 0 || io.bottom !== 0 || io.left !== 0) spec.insetOffsets = io;
      } else {
        applyAbsoluteThisCombo(spec, part, subst);
      }
      applyVisibleWhen(spec, part, contract);
      return spec;
    }
    const frame: NodeSpec = {
      type: 'frame',
      name,
      // The glyph sits in the middle of its control unless the part says
      // otherwise — a button's own layout wins when it declares one.
      layout: resolveLayout(part, subst)
        ? layoutSpec(part, false, subst)
        : { mode: 'HORIZONTAL', primary: 'CENTER', counter: 'CENTER' },
      grow: part.layout?.grow || undefined,
      children: [{ ...spec, name: `${name}-icon`, grow: undefined }],
    };
    applyStyling(frame, part, subst, ctx);
    // THE SAME LOWERING THE BARE-SVG BRANCH GETS. A box-carrying icon part can
    // declare placement too — carbon's `inline-notification__close-button`
    // carries `top`/`right` alongside a background, four paddings and four
    // border widths — and this branch dropped it with nothing refused and
    // nothing logged, exactly like the boxless one did before cf7d9027.
    //
    // Nine icon parts across five libraries reach here with a position or
    // insets declared. All nine currently declare `position: relative`, which
    // `insetOverlayOffsets` early-returns null on and `isAbsoluteThisCombo`
    // rejects, so this is BYTE-NEUTRAL today — it closes the door before the
    // first part walks through it, rather than after.
    const frameIo = insetOverlayOffsets(part, subst);
    if (frameIo) {
      frame.insetOverlay = true;
      if (frameIo.top !== 0 || frameIo.right !== 0 || frameIo.bottom !== 0 || frameIo.left !== 0) frame.insetOffsets = frameIo;
    } else {
      applyAbsoluteThisCombo(frame, part, subst);
    }
    applyVisibleWhen(frame, part, contract);
    return frame;
  }
  // v9 shape (#42): a REAL parametric node — geometry from the contract,
  // fill from tokens, placement/rotation from the compiled stylesWhen.
  if (part.shape) {
    const spec: NodeSpec = { type: 'shape', name, shape: { ...part.shape } };
    applyStyling(spec, part, subst, ctx);
    // Wave B.1 — per-variant shape resize. `literalsByProp` may carry
    // width/height when size factors by one enum axis (Tailwind
    // ToggleSwitch thumbs at 16/20/24). applyLiterals already resolved
    // those into lits; sync onto shape so create + absolute placement both
    // see the combo's intrinsic box (shapeRuntime resizes from shape.*,
    // applyShapeAbsolute centers from shape.*).
    if (spec.lits?.width !== undefined) spec.shape!.width = spec.lits.width;
    if (spec.lits?.height !== undefined) spec.shape!.height = spec.lits.height;
    const placement = shapePlacement(part, contract, subst);
    if (placement.absolute) spec.absolute = placement.absolute;
    // CARBON LIVE-DEFECT ROUND (D2): UNCONDITIONAL absolute decor. v1 decor
    // could only be placed through `stylesWhen` — it needed an enum
    // condition to hang the placement on, so a box drawn in EVERY combo
    // (Carbon's checkbox square) was refused outright rather than placed.
    // A shape that declares position:absolute and carries offsets falls
    // back to the same `absolutePartPlacement` every other absolute part
    // uses; per-variant offsets ride `literalsByProp` (the toggle knob).
    else if (part.declared?.['position'] === 'absolute') {
      const abs = absolutePartPlacement(part, subst);
      if (abs) spec.absolute = abs;
    }
    // Merge literalsByProp top/left over stylesWhen defaults when both exist
    // (Carbon checkbox ::after checked vs indeterminate offsets).
    const absFromLits = absolutePartPlacement(part, subst);
    if (absFromLits) {
      if (spec.absolute) {
        if (absFromLits.left != null) spec.absolute.left = absFromLits.left;
        if (absFromLits.top != null) spec.absolute.top = absFromLits.top;
        if (absFromLits.right != null) spec.absolute.right = absFromLits.right;
        if (absFromLits.bottom != null) spec.absolute.bottom = absFromLits.bottom;
      } else {
        spec.absolute = absFromLits;
      }
    }
    applyBarCollapseAbsolute(spec);
    if (placement.rotation !== undefined) spec.shape!.rotation = placement.rotation;
    if (spec.shape!.rotation === undefined) delete spec.shape!.rotation;
    applyVisibleWhen(spec, part, contract);
    return spec;
  }
  {
    const control = formControlSpec(name, part, contract, ctx, subst);
    if (control) {
      applyVisibleWhen(control, part, contract);
      return control;
    }
  }
  if (part.component) {
    const dep = byId.get(part.component.id)!; // resolvability guaranteed by refuseUnresolvableRefs
    const depLedger: CodeOnlyFactSeed[] = [];
    const spec: NodeSpec = {
      type: 'instance',
      name,
      dep: dep.name,
      depContractId: dep.id,
      ...(dep.bindings.figma.anchors.componentSetKey ? { depAnchorKey: dep.bindings.figma.anchors.componentSetKey } : {}),
      depProps: mapDepProps(dep, part.component.props ?? {}, subst, part.component.text, depLedger),
    };
    for (const line of depLedger) (spec.channelMiss ??= []).push(line);
    // Round 2 iteration 9 — per-instance overrides (component.overrides):
    // natively a resize / image-fill / paint override on THIS instance, but
    // the canvas lowering is not carried this round — declared-not-drawn,
    // ledgered through the existing channelMiss footnote (never a silent
    // drop; the instance renders the child's own defaults).
    for (const [channel, ref] of Object.entries(part.component.overrides ?? {})) {
      miss(
        spec,
        `per-instance override "${channel}"`,
        "canvas emission not carried this round — the instance draws the child's own defaults",
        String(ref),
      );
    }
    // Boolean-toggled component-ref parts (CBDS icon toggles): the instance's
    // visibility binds to the BOOLEAN property like every other part kind.
    applyVisibleWhen(spec, part, contract);
    return spec;
  }
  if (part.slot) {
    const spec: NodeSpec = {
      type: 'slot',
      name,
      layout: layoutSpec(part, false, subst),
      // r10: a slot part's `layout.grow` lowers to layoutSizingHorizontal FILL
      // exactly like every other part class (the fillW runtime reads
      // `grow` on any in-flow child) — it was the one spec built without it,
      // so a proposed slot grow regenerated as a HUG slot (canvas conformance
      // slot-primary-axis-fill).
      grow: part.layout?.grow || undefined,
      slotProperty: slotFigmaProperty(part.slot),
      slotOptional: part.optional || undefined,
      slotAccepts: (part.slot.accepts ?? []).map((id) => {
        const dep = byId.get(id)!;
        return {
          dep: dep.name,
          contractId: dep.id,
          ...(dep.bindings.figma.anchors.componentSetKey ? { anchorKey: dep.bindings.figma.anchors.componentSetKey } : {}),
        };
      }),
    };
    const description = slotPropertyDescription(part.slot);
    if (description) spec.slotDescription = description;
    const slotCtx = applyStyling(spec, part, subst, ctx);
    // RC5 — DESIGN-TIME SLOT CONTENT. A Figma main component's slot content
    // and a generated Storybook meta's canonical args are the same object;
    // until now only emit-react computed one. ONE policy, read by both
    // emitters (packages/schema designTimeSlotContent), three outcomes.
    const designTime = designTimeSlotContent(part.slot);
    if (designTime.kind === 'declared') {
      spec.slotDefault = part.slot.defaultContent!.map((item) => {
        const dep = byId.get(item.id)!;
        return {
          dep: dep.name,
          contractId: dep.id,
          ...(dep.bindings.figma.anchors.componentSetKey ? { anchorKey: dep.bindings.figma.anchors.componentSetKey } : {}),
          props: mapDepProps(dep, item.props ?? {}, subst, item.text),
        };
      });
    } else if (designTime.kind === 'sample') {
      // The SAME sentence the generated story puts in `args.children`, drawn
      // in the slot part's own resolved text cascade — the colour/size the
      // consumer's content will inherit, so the designer sees the real thing
      // and not a grey placeholder. It is the slot's DEFAULT content:
      // Figma's resetSlot() returns to it and any fill replaces it, exactly
      // as a story's args are replaced by a control.
      spec.children = [
        {
          type: 'text',
          name: SLOT_SAMPLE_LAYER,
          slotSample: true,
          characters: designTime.text,
          fontSize: slotCtx.fontSize ?? 16,
          fontStyle: figmaFaceStyle(slotCtx),
          ...(slotCtx.lineHeight !== undefined ? { lineHeight: slotCtx.lineHeight } : {}),
          ...textExtras(slotCtx),
          ...textIdentity(slotCtx),
          textFill: slotCtx.textFill,
        },
      ];
    } else {
      // THE NAMED REFUSAL. Nothing to draw on EITHER surface, so the canvas
      // draws the same nothing the code surfaces draw — and says so, by
      // channel, in the component's code-only facts. Before RC5 this loss
      // was silent: the slot minted childless and the birth-box repair
      // floored it at Figma's 1px, which is how ds.two-column shipped as a
      // 640x1 sliver with no receipt anywhere.
      miss(spec, `slot "${part.slot.name}" design-time content`, designTime.reason);
    }
    applyVisibleWhen(spec, part, contract);
    return spec;
  }
  // MUI round (Chip live finding): a text-holder part can carry BOX channels
  // — MUI's Chip label span owns the pill's side padding (literals
  // padding-left/right 12px). A Figma TEXT node has no padding, so box-
  // carrying text parts lower to FRAME(padding) → TEXT child; box-less text
  // parts keep the plain TEXT lowering byte-identically.
  // PADDING only — the one box fact a TEXT node cannot express. Fills and
  // radii on text parts keep their proven styled-TEXT lowering (the repo
  // Switch thumb compiles as a styled TEXT spec — pinned by eval).
  const textPartHasBox = (): boolean => {
    const chans = [...Object.keys(resolveTokens(part, subst)), ...Object.keys(resolveLiterals(part, subst))];
    return chans.some((c) => c.startsWith('padding'));
  };
  const wrapTextInBox = (textSpec: NodeSpec): NodeSpec => {
    // ORGANISM round: the wrapper frame is the PART's box — when the part
    // carries a layout, that layout is the box's layout. The hardcoded
    // MIN/MIN default drew every text TABLE CELL's glyphs at the top-left of
    // a 57.8px-tall cell instead of vertically centered (and ignored
    // align="right" columns). Parts with no layout keep the MIN/MIN default
    // byte-identically.
    const frame: NodeSpec = {
      type: 'frame',
      name,
      layout: resolveLayout(part, subst) ? layoutSpec(part, false, subst) : { mode: 'HORIZONTAL', primary: 'MIN', counter: 'MIN' },
      grow: part.layout?.grow || undefined,
      children: [textSpec],
    };
    const textCtx = applyStyling(frame, part, subst, ctx);
    textSpec.name = `${name}-text`;
    textSpec.fontSize = textCtx.fontSize ?? 14;
    textSpec.fontStyle = figmaFaceStyle(textCtx);
    applyTextIdentity(textSpec, textCtx);
    textSpec.textFill = textCtx.textFill;
    if (textCtx.lineHeight !== undefined) textSpec.lineHeight = textCtx.lineHeight;
    Object.assign(textSpec, textExtras(textCtx));
    // MOLECULE round (Tooltip finding): a text part can CONTAIN parts — the
    // Tooltip bubble's label carries the absolute-positioned arrow span. The
    // old text lowering silently DROPPED child parts; here they compile
    // after the text child (childless text parts push nothing — byte-
    // identical for every prior contract).
    frame.children!.push(
      ...variantParts(part.parts ?? {}, subst).flatMap(([childName, child]) =>
        partToSpecs(childName, child, contract, byId, textCtx, subst),
      ),
    );
    applyAbsoluteThisCombo(frame, part, subst);
    applyVisibleWhen(frame, part, contract);
    return frame;
  };
  if (part.text !== undefined) {
    // textByProp (first-variant-freeze fix): per-enum-value characters
    // resolve at COMPILE time against this combo's subst; unmapped values
    // keep the base text.
    const partText = part.textByProp
      ? (part.textByProp.map[subst[part.textByProp.prop] ?? ''] ?? part.text)
      : part.text;
    // A TEXT node has no children — a child-BEARING text part must take the
    // frame lowering even without box channels (same Tooltip finding).
    if (textPartHasBox() || Object.keys(part.parts ?? {}).length > 0) {
      const textSpec: NodeSpec = { type: 'text', name, characters: partText };
      return wrapTextInBox(textSpec);
    }
    const spec: NodeSpec = { type: 'text', name };
    // ROUND 6 (Accordion live finding): `layout.grow` was carried on frame
    // parts and DROPPED on bare-text parts. MUI's AccordionSummary content
    // span is exactly that — flex-grow:1 inside a ButtonBase whose computed
    // justify-content is `center`, so the dropped grow left a hugging text
    // node CENTERED in the summary row. MUI left-aligns it because the span
    // fills the row. Carrying grow makes the text a fill candidate (and, as
    // a CSS consequence, skips the residual-margin box — a grown child has
    // no residual margin to reserve).
    if (part.layout?.grow) spec.grow = true;
    const textCtx = applyStyling(spec, part, subst, ctx);
    spec.characters = partText;
    spec.fontSize = textCtx.fontSize ?? 14;
    spec.fontStyle = figmaFaceStyle(textCtx);
    applyTextIdentity(spec, textCtx);
    spec.textFill = textCtx.textFill;
    if (textCtx.lineHeight !== undefined) spec.lineHeight = textCtx.lineHeight;
    Object.assign(spec, textExtras(textCtx));
    applyAbsoluteThisCombo(spec, part, subst);
    applyVisibleWhen(spec, part, contract);
    return spec;
  }
  if (part.meter) {
    const num = (propName: string, fallback: number) => {
      const pr = contract.props.find((p) => p.name === propName);
      return typeof pr?.default === 'number' ? pr.default : fallback;
    };
    const fraction = Math.min(1, Math.max(0, num(part.meter.valueProp, 0) / (num(part.meter.maxProp, 100) || 100)));
    const spec: NodeSpec = { type: 'frame', name, layout: { mode: 'HORIZONTAL', primary: 'MIN', counter: 'MIN' }, pct: fraction, children: [] };
    applyStyling(spec, part, subst, ctx);
    applyVisibleWhen(spec, part, contract);
    return spec;
  }
  // Round 5: a content part with fallback anatomy (per-value glyph children)
  // and NO prop default draws the CONTRACT'S OWN unset state — the children —
  // instead of fabricating a component-name placeholder (the Avatar initials
  // pattern: unset initials render the promoted person-silhouette glyphs; the
  // name placeholder forced a 6-char overflow no real mount shows). The TEXT
  // property still reaches the Figma surface via textProps (unbound). A
  // content part WITHOUT children keeps the design-time name placeholder.
  const contentFallsThrough =
    part.content !== undefined &&
    part.parts !== undefined &&
    Object.keys(part.parts).length > 0 &&
    typeof contract.props.find(
      (p) => p.type === 'text' && p.bindings.code.prop === part.content!.prop,
    )?.default !== 'string';
  if (part.content && !contentFallsThrough) {
    const prop = contract.props.find(
      (p) => p.type === 'text' && p.bindings.code.prop === part.content!.prop,
    )!;
    const characters = typeof prop.default === 'string' ? prop.default : contract.name;
    if (textPartHasBox()) {
      const textSpec: NodeSpec = { type: 'text', name, characters, contentProp: prop.bindings.figma.property };
      return wrapTextInBox(textSpec);
    }
    const spec: NodeSpec = { type: 'text', name };
    if (part.layout?.grow) spec.grow = true; // round 6 — see the text branch above
    const textCtx = applyStyling(spec, part, subst, ctx);
    spec.characters = characters;
    spec.fontSize = textCtx.fontSize ?? 16;
    spec.fontStyle = figmaFaceStyle(textCtx);
    applyTextIdentity(spec, textCtx);
    spec.textFill = textCtx.textFill;
    if (textCtx.lineHeight !== undefined) spec.lineHeight = textCtx.lineHeight;
    Object.assign(spec, textExtras(textCtx));
    spec.contentProp = prop.bindings.figma.property;
    applyVisibleWhen(spec, part, contract);
    return spec;
  }
  const spec: NodeSpec = {
    type: 'frame',
    name,
    layout: layoutSpec(part, false, subst),
    grow: part.layout?.grow || undefined,
  };
  // B-3 finding 5: inset overlay parts lower to ABSOLUTE + STRETCH behind
  // the in-flow siblings instead of flowing as one (Round 5: non-zero
  // offsets carried too).
  {
    const io = insetOverlayOffsets(part, subst);
    if (io) {
      spec.insetOverlay = true;
      if (io.top !== 0 || io.right !== 0 || io.bottom !== 0 || io.left !== 0) spec.insetOffsets = io;
    } else if (isAbsoluteThisCombo(part, subst)) {
      // absolute-position round: overlay anatomy with carried offsets
      // (declared or stylesWhen-matched for this combo).
      const a = absolutePartPlacement(part, subst);
      if (a) spec.absolute = a;
    }
  }
  const childCtx = applyStyling(spec, part, subst, ctx);
  // Round 5: `img` parts — raster content is runtime data; the frame draws
  // the standard image-placeholder wash (#D9D9D9), named in the fidelity
  // notes via the flag. A contract-carried fill always wins.
  if (part.element === 'img') {
    spec.imgPlaceholder = true;
    if (!spec.fill && spec.lits?.fillColor === undefined && spec.lits?.fillClear === undefined) {
      (spec.lits ??= {}).fillColor = { r: 217 / 255, g: 217 / 255, b: 217 / 255 };
    }
  }
  // Round 5: parent aspect lowering (Avatar/Thumbnail square roots).
  applyChildAspect(spec, part);
  spec.children = variantParts(part.parts ?? {}, subst).flatMap(([childName, child]) =>
    partToSpecs(childName, child, contract, byId, childCtx, subst),
  );
  if (isReversed(part, subst)) spec.children.reverse();
  centerStrokeGlyphsInHosts(spec.children);
  // A2 grid: cells stamp AFTER the child list is final (reversal is a flex
  // fact and cannot occur here — direction is schema-invalid with grid).
  stampGridCells(spec, part, subst);
  // Round 5f (CLASS 3): an inset-0 overlay that CONTAINS content — the
  // Checkbox check glyph, the RadioButton dot — must CENTER it in the control
  // box. The captured display:block carried no centering, so the glyph pinned
  // top-left (owner: the check glyph is not centered vertically/horizontally).
  // An empty backdrop overlay (TextField backdrop) has no children and is
  // unaffected — byte-neutral for those.
  if (spec.insetOverlay && spec.layout && spec.children.length > 0) {
    spec.layout = { ...spec.layout, primary: 'CENTER', counter: 'CENTER' };
  }
  applyVisibleWhen(spec, part, contract);
  return spec;
}

// ---------------------------------------------------------------------------
// Component script emission
// ---------------------------------------------------------------------------



/** Slot part names anywhere BELOW this part (slot-in-slot detection). */
function nestedSlotNames(part: Part): string[] {
  const out: string[] = [];
  const walk = (p: Part): void => {
    for (const [childName, child] of Object.entries(p.parts ?? {})) {
      if (child.slot) out.push(childName);
      walk(child);
    }
  };
  walk(part);
  return out;
}

/** The SLOT property `description` — Figma's only surface for a slot fact it
 *  cannot enforce. `accepts` carries functionally as `preferredValues`, which
 *  is a PICKER HINT: it sorts the listed components to the top of the swap
 *  menu and blocks nothing (probe 2b — an off-list append succeeded). So the
 *  description says, in words a designer reads in the property panel, both
 *  what the slot wants and which constraints the canvas cannot hold:
 *  `min`/`max`/`required`/`acceptsMode: "restrict"` have NO API analogue
 *  (docs/research/native-slots-proposal.md §5). Deterministic: declared
 *  order, no interpolation of anything canvas-side. */
function slotPropertyDescription(slot: NonNullable<Part['slot']>): string {
  const parts: string[] = [];
  const accepts = slot.accepts ?? [];
  const mode = slot.acceptsMode ?? (accepts.length > 0 ? 'prefer' : 'open');
  if (accepts.length > 0) {
    parts.push(
      mode === 'restrict'
        ? `Accepts ONLY: ${accepts.join(', ')} — REFUSED BY FIGMA: acceptsMode "restrict" has no canvas enforcement (preferredValues is a picker hint), so off-list content is a differ finding, not a canvas impossibility.`
        : `Accepts: ${accepts.join(', ')} (preferred — Figma sorts these first; any component may still be placed).`,
    );
  }
  if (slot.min !== undefined || slot.max !== undefined) {
    const range =
      slot.min !== undefined && slot.max !== undefined
        ? `${slot.min}–${slot.max}`
        : slot.min !== undefined
          ? `at least ${slot.min}`
          : `at most ${slot.max}`;
    parts.push(`Expects ${range} item(s) — REFUSED BY FIGMA: a slot carries no count constraint.`);
  }
  if (slot.required) {
    parts.push('Required — REFUSED BY FIGMA: an empty slot is always legal on canvas.');
  }
  return parts.join(' ');
}

/** NAMED REFUSAL for unresolvable contract references — the same discipline
 *  (and the same wording) as emit-react's validateContract. Field failure:
 *  the design-proposed CBDS Button carried a `ds.icon` component ref with no
 *  contract in scope and the compile crashed `undefined.name` inside
 *  partToSpecInner — the one place the "named refusal, never a crash" rule
 *  broke. The canvas stays deliberately MORE tolerant than emit-react (a
 *  child's unknown props are skipped by the runtime's setInstanceProps, so a
 *  foreign-kit composite still constructs) — only references that cannot
 *  resolve at all are refused here. */
function refuseUnresolvableRefs(contract: Contract, byId: Map<string, Contract>): void {
  const errors: string[] = [];
  for (const { name, part } of walkAnatomy(contract)) {
    if (part.component && !byId.has(part.component.id)) {
      errors.push(
        `${contract.id}: part "${name}" references component "${part.component.id}" which has no contract in scope`,
      );
    }
    for (const item of part.slot?.defaultContent ?? []) {
      if (!byId.has(item.id)) {
        errors.push(
          `${contract.id}: slot "${part.slot!.name}" defaultContent references "${item.id}" which has no contract in scope`,
        );
      }
    }
    for (const id of part.slot?.accepts ?? []) {
      if (!byId.has(id)) {
        errors.push(
          `${contract.id}: slot "${part.slot!.name}" accepts "${id}" which has no contract in scope`,
        );
      }
    }
    // NATIVE SLOTS — the two shapes the Plugin API refuses outright
    // (docs/research/native-slots-proposal.md §5, probe 2b/2f). Both are
    // schema-valid and legal CSS, so they are refused HERE (canvas emission)
    // rather than in the shared contract validator: the code surface renders
    // them fine.
    if (part.slot && part.layout?.display === 'grid') {
      errors.push(
        `${contract.id}: slot "${part.slot.name}" declares display:grid — Figma refuses it verbatim ("GRID layoutMode cannot be applied to Slot frames"); a slot interior is NONE/HORIZONTAL/VERTICAL only`,
      );
    }
    if (part.slot) {
      const nested = nestedSlotNames(part);
      if (nested.length > 0) {
        errors.push(
          `${contract.id}: slot "${part.slot.name}" contains slot part(s) "${nested.join('", "')}" — slot-in-slot is out of contract (API-tolerated but unspecified; the emitter never produces one)`,
        );
      }
    }
  }
  // Two slots sharing one Figma property name would mint one property and
  // silently share content between unrelated areas.
  const byProperty = new Map<string, string[]>();
  for (const { name, part } of walkAnatomy(contract)) {
    if (!part.slot) continue;
    const key = slotFigmaProperty(part.slot);
    byProperty.set(key, [...(byProperty.get(key) ?? []), name]);
  }
  for (const [property, names] of byProperty) {
    if (names.length > 1) {
      errors.push(
        `${contract.id}: slot parts "${names.join('", "')}" all resolve to the Figma property "${property}" — one SLOT property cannot serve two areas (set slot.bindings.figma.property to disambiguate)`,
      );
    }
  }
  if (errors.length > 0) {
    throw new Error(
      `Refused — ${errors.length} contract violation(s):\n${errors.map((e) => `  - ${e}`).join('\n')}`,
    );
  }
}

/** 2026-07-21 (live-canvas finding, handoff 08#1): decide horizontal FILL at
 *  COMPILE time, gated on the parent's width being ESTABLISHED. Real Figma
 *  resolves "hug-width parent whose every child fills" to the auto-layout
 *  minimum (~3px — the live composite dialog), because no node contributes
 *  an intrinsic width on the axis. The legitimate mixed pattern survives
 *  (Banner: an intrinsic sibling sets the hug width, the ribbon FILLs to
 *  span it): a parent is "ready" when it has a fixed/literal width, is
 *  itself filling, or hugs at least one NON-filling child that can
 *  contribute intrinsic width. Candidates under an unready parent HUG —
 *  they never collapse. Candidate selection replicates the old runtime
 *  conditions exactly (grow, or stretchChildren on non-instance children
 *  without fixedWidth); the ONLY change is the readiness gate. */
function annotateFillW(rootSpec: NodeSpec): void {
  const inFlow = (s: NodeSpec): boolean => !s.overlay && !s.insetOverlay && !s.absolute;
  const hasOwnWidth = (s: NodeSpec): boolean =>
    s.fixedWidth !== undefined || s.lits?.width !== undefined || s.pct != null;
  const canHug = (s: NodeSpec): boolean => {
    if (hasOwnWidth(s) || s.type === 'text' || s.type === 'svg' || s.type === 'instance' || s.shape !== undefined) {
      return true;
    }
    return (s.children ?? []).filter(inFlow).some(canHug);
  };
  const walk = (s: NodeSpec, established: boolean): void => {
    const kids = s.children ?? [];
    // CSS truth (Phase B live-in-mock finding, 2026-07-22): an EXPLICIT
    // width — token-bound OR literal — beats align-items:stretch. The first
    // gate only excluded fixedWidth (token) children; a lits.width child
    // (the Astryx DropdownMenu 240px menu) still got force-FILLed under its
    // hug container and collapsed. Explicit-width children are never fill
    // candidates on that axis.
    // Absolute-position round (Switch track pin): a measured explicit width
    // beats flex-grow too — the captured size IS the post-grow used size, so
    // re-applying FILL on canvas double-counts the stretch (34px track
    // ballooned to the 58px root). Explicit-width children never fill.
    // ROUND 6 (Tabs live finding): `stretchChildren` is CSS
    // `align-items: stretch` — a CROSS-axis fact. Under a VERTICAL layout
    // the cross axis IS horizontal (block flow: a block child spans its
    // container), which is what this annotation lowers. Under a HORIZONTAL
    // layout the cross axis is VERTICAL, so horizontal FILL is simply the
    // wrong axis: it makes every flex row child as wide as the whole row.
    // It went unnoticed while such children carried a baked width (MUI's
    // Tab rode `max-width: 360` as a fixed width); the moment max-width
    // became a real ceiling, all three Tabs FILLed to the strip width and
    // stacked on top of each other. Main-axis growth still lowers — through
    // `grow` (flex-grow), which is the channel that actually means it.
    // Carbon Tabs live finding: bare text with flex-grow compiled to fillW,
    // then layoutSizingHorizontal FILL inside a fixed-width label wrapper
    // clipped "Overview"/"Activity"/"Settings" on canvas. CSS grow fills
    // remaining space; Figma FILL in a fixed box truncates glyphs unless
    // textTruncation is explicitly declared — so non-truncating text HUGS…
    //
    // …WHEN HUGGING IS ALIGNMENT-SAFE (FC-TEXT-FILL-ALIGNMENT, the landing
    // round's refinement). Hug and fill place the glyphs identically only
    // when the box's horizontal packing agrees with the text's own
    // textAlignH (LEFT↔MIN, CENTER↔CENTER, RIGHT↔MAX; the horizontal axis is
    // primary on rows and counter on stacks). Carbon's tab labels are
    // MIN-packed LEFT text — hug is the fix and stays. MUI's accordion title
    // is LEFT text in a justify-CENTER summary: hugging re-centered it and
    // resurfaced Live Defect 5a, so alignment-displaced text keeps FILL and
    // carries `fillText` so the runtime can tell the two cases apart.
    const hugTextSafe = (c: NodeSpec): boolean => {
      const packed = (s.layout?.mode ?? 'HORIZONTAL') === 'VERTICAL'
        ? (s.layout?.counter ?? 'MIN')
        : (s.layout?.primary ?? 'MIN');
      const glyphs = ({ LEFT: 'MIN', CENTER: 'CENTER', RIGHT: 'MAX' } as const)[
        (c.textAlignH ?? 'LEFT') as 'LEFT' | 'CENTER' | 'RIGHT'
      ];
      // JUSTIFIED (and SPACE_BETWEEN packing) never proves equivalence.
      return glyphs !== undefined && packed === glyphs;
    };
    // RC5: the emitter's OWN design-time slot sample is the one text node
    // whose width is not a contract fact — it is a 44-character placeholder
    // standing in for whatever a consumer drops in. Hugging it would push the
    // component's width out to the sentence (370px inside a 288px slot under
    // a 320px root cap, measured on ds.card), so it FILLs its slot and wraps,
    // exactly as `args.children` wraps in the generated story. This is the
    // ONLY text that overrides the alignment-safe hug rule below, and it is
    // gated on a flag no contract can set.
    const isSlotSample = (c: NodeSpec): boolean => c.slotSample === true;
    const isCandidate = (c: NodeSpec): boolean =>
      inFlow(c) &&
      !hasOwnWidth(c) &&
      (isSlotSample(c) ||
        (!(c.type === 'text' && !c.textTruncation && hugTextSafe(c)) &&
          (c.grow === true ||
            (s.layout?.stretchChildren === true &&
              (s.layout?.mode ?? 'HORIZONTAL') === 'VERTICAL' &&
              c.type !== 'instance'))));
    const intrinsic = kids.some((c) => inFlow(c) && !isCandidate(c) && canHug(c));
    // D7 hug-ceiling: a box MEASURED hugging beneath its maxWidth ceiling
    // never grants FILL — its width IS its content, so a FILL child would
    // subtract itself from the very measurement (inline-notification's
    // grow:true details collapsed the root to min-width 288 under a 331px
    // text-wrapper — the D3 overflow the compile receipt caught).
    const ready = (established || intrinsic) && s.hugCeiling !== true;
    // A2 grid: a GRID parent's children are cell-sized by the grid runtime
    // (G3 FILL default — place→span→FILL→align), never flex fillW
    // candidates; their own subtrees ARE width-established (the declared
    // tracks size the cell the way a fixed width sizes a box).
    const gridParent = s.layout?.mode === 'GRID';
    for (const c of kids) {
      const fills = !gridParent && ready && isCandidate(c);
      if (fills) {
        c.fillW = true;
        // FC-TEXT-FILL-ALIGNMENT: a text candidate only reaches here when
        // hugging displaces it; the flag is the runtime's proof.
        if (c.type === 'text' && !c.textTruncation) c.fillText = true;
      }
      // REJECTED-SETS ROUND: an hAligned grid occupant HUGS its width (the
      // runtime skips FILL for it — CSS justify-self beats the stretch
      // default), so its subtree is NOT width-established; treating it as
      // established FILLed the dialog's Close button into its whole cell.
      walk(c, fills || hasOwnWidth(c) || (gridParent && c.cell?.hAlign === undefined));
    }
  };
  walk(rootSpec, hasOwnWidth(rootSpec));
}

function compileComponentData(contract: Contract, byId: Map<string, Contract>): ComponentData {
  refuseUnresolvableRefs(contract, byId);
  // Variant axes = enum props AND VARIANT-bound boolean props, in prop
  // declaration order (see isVariantBool). An enum-only contract's axis list
  // is exactly the old enum filter — byte-identical substitution space.
  const axisProps = contract.props.filter((p) => isEnum(p) || isVariantBool(p));
  // ANTD EXAM (heal loop): a root with no parts and no `children` prop can
  // still carry its text through another TEXT prop — antd's Input draws
  // its `placeholder`. The canvas label follows the first text prop when no
  // `children` exists (an <input> has no children in any grammar) — but ONLY
  // on a root the browser itself draws that text for: a text control
  // (`semantics.element` input/textarea, whose placeholder/value is visible
  // ink). Any other element's TEXT prop can be consumed invisibly — the
  // catalog's StatusDot binds `label` to `aria-label` alone, and the CSS
  // surface (emit-html textDefaultOf) renders NO text for it: "text props
  // used solely by attrs remain attributes, not content". The first cut of
  // this fallback keyed on "no parts" only and drew a 97×25 'Status' label
  // over an 8×8 dot (catalog gate: text-overflows-root-canvas ×5) — the
  // canvas must mirror the code surface's discipline, not out-draw it.
  const rootIsTextControl = contract.semantics?.element === 'input' || contract.semantics?.element === 'textarea';
  const textProp =
    contract.props.find((p) => p.type === 'text' && p.bindings.code.prop === 'children') ??
    (contract.anatomy.root?.parts || !rootIsTextControl
      ? undefined
      : contract.props.find((p) => p.type === 'text' && p.bindings.figma.kind === 'TEXT'));
  // VARIANT-bound booleans are axes, not BOOLEAN component properties.
  const boolPropsData = contract.props
    .filter((p) => p.type === 'boolean' && !isVariantBool(p))
    .map((p) => ({ property: p.bindings.figma.property!, default: p.default === true }));
  // A root that carries literal `text` beside a `children` prop with no
  // string default draws its own text as the bound label's characters — the
  // prop stays the per-usage API, the literal is its default (see
  // rootTextSpecs). Byte-identical whenever the prop carries a default.
  // (`root?.` — a MULTI-ROOT composite such as Modal = {dialog, backdrop}
  // has no `anatomy.root`; it takes the container branch below.)
  const label =
    typeof textProp?.default === 'string' ? textProp.default : (contract.anatomy.root?.text ?? contract.name);
  // ROOT TEXT (see rootTextSpecs): the root hosts its own text child unless
  // the `children` prop branch below is the one drawing it (no parts + a
  // bound text prop — the literal is that label's default, never a second
  // text node).
  const hostsRootText = (contract.anatomy.root?.text !== undefined || contract.anatomy.root?.content !== undefined) && !(textProp && !contract.anatomy.root?.parts);

  const orderedValues = (p: Prop): string[] => {
    if (!isEnum(p)) return boolAxisValues(p); // bool axis: default first
    const values = [...p.type.enum];
    const i = p.default !== undefined ? values.indexOf(String(p.default)) : -1;
    if (i > 0) {
      values.splice(i, 1);
      values.unshift(String(p.default));
    }
    return values;
  };

  const root = contract.anatomy.root;
  /** D5: viewport-pinned-scrim bounding notes (code-only facts, never silent). */
  const scrimNotes: CodeOnlyFactObservation[] = [];
  const variants: VariantSpec[] = [];
  // N-axis variant support: EVERY enum prop AND VARIANT-bound boolean prop
  // becomes a variant axis, in prop declaration order, with each axis's
  // DEFAULT value first (orderedValues; a bool axis's values are the two
  // canonical strings 'true'/'false' — the mint's own minted-path spelling).
  // The cartesian product is enumerated with axis 0 slowest and the last
  // axis fastest, so the FIRST emitted variant is the all-defaults combo —
  // Figma's default variant is positional (first child), and the create +
  // amend paths both rely on that ordering invariant.
  // Grid mapping: rows = axis 0's values; columns = the ordered cartesian
  // product of axes 1..n (a 5×3×2 component renders 5 rows × 6 columns).
  const axes = axisProps.map((p) => ({ prop: p, values: orderedValues(p) }));
  let combos: number[][] = [[]];
  for (const axis of axes) {
    const next: number[][] = [];
    for (const combo of combos) {
      for (let i = 0; i < axis.values.length; i++) next.push([...combo, i]);
    }
    combos = next;
  }
  const fontStyles = new Set<string>(['Medium']);

  for (const combo of combos) {
    // Every axis's value for this combo feeds BOTH the `{prop}` token
    // substitutions and the visibleWhen part filtering (variantParts).
    const subst: Record<string, string> = {};
    const nameParts: string[] = [];
    let col = 0;
    for (let a = 0; a < axes.length; a++) {
      const { prop, values } = axes[a];
      const value = values[combo[a]];
      subst[prop.name] = value;
      nameParts.push(
        `${prop.bindings.figma.property}=${prop.bindings.figma.values?.[value] ?? value}`,
      );
      if (a >= 1) col = col * values.length + combo[a];
    }
    const row = combo[0] ?? 0;

    // MULTI-ROOT composite: a Figma component/variant is ONE frame, so the N
    // anatomy roots (Modal = {dialog, backdrop}) become CHILDREN of a SYNTHETIC
    // container frame — the only place a wrapper is introduced, and ONLY for
    // multi-root. A single-root contract NEVER enters this branch, so its
    // variant frame IS the root (byte-identical — no synthetic wrapper).
    if (isMultiRoot(contract)) {
      // The container is a plain vertical auto-layout frame with no styling of
      // its own; each top-level root compiles through the same partToSpecs
      // path as any child part and is appended as a sibling child.
      const container: Part = { layout: { display: 'flex', direction: 'column' } } as Part;
      const rootSpec: NodeSpec = {
        type: 'root',
        name: nameParts.join(', ') || contract.name,
        layout: layoutSpec(container, true, subst),
      };
      const ctx = applyStyling(rootSpec, container, subst, {});
      rootSpec.children = topRoots(contract).flatMap(([childName, child]) =>
        partToSpecs(childName, child, contract, byId, ctx, subst),
      );
      const collectStylesMR = (s: NodeSpec) => {
        if (s.fontStyle) fontStyles.add(s.fontStyle);
        (s.children ?? []).forEach(collectStylesMR);
      };
      collectStylesMR(rootSpec);
      variants.push({ name: rootSpec.name, row, col, spec: rootSpec });
      continue;
    }

    const rootSpec: NodeSpec = {
      type: 'root',
      name: nameParts.join(', ') || contract.name,
      layout: layoutSpec(root, true, subst),
    };
    // resolveTokens, not root.tokens: the root's tokensByProp overrides (v10
    // — per-size padding-inline/height on the owner's Button) resolve per
    // combo exactly like every child part's. Byte-neutral for contracts
    // without tokensByProp (resolveTokens returns the base map unchanged).
    const ctx = applyStyling(rootSpec, root, subst, {});
    applyStylesWhenOpacity(rootSpec, root, contract, subst);
    boundFullBleedScrimRoot(rootSpec, root, subst, scrimNotes);
    // Round 5: parent aspect lowering + block-root width fact (see NodeSpec).
    applyChildAspect(rootSpec, root);
    if (
      root.declared?.['display'] === 'block' &&
      !rootSpec.fixedWidth &&
      rootSpec.lits?.width === undefined
    ) {
      rootSpec.blockRoot = true;
    }
    if (root.icon && Object.keys(root.parts ?? {}).length === 0) {
      // FC-ROOT-ICON-NOT-EMITTED (Flowbite Spinner, 2026-08-14).
      //
      // A contract may promote the icon onto the ROOT itself — Flowbite's
      // Spinner is one `<svg>` and nothing else, so capture gives
      // `anatomy.root = { icon: {...}, parts: {} }`. This branch did not
      // exist: children came ONLY from `root.parts`, so the root's own icon
      // was silently dropped and the emitted spec was `children: []`. On
      // canvas that is a 32x1 empty box — measured, 40 variants of nothing,
      // while capture had scored the stem at 100.000% computed equality.
      //
      // The glyph is projected through partToSpecs exactly as a CHILD icon
      // part is: same iconSvg, same single-paint variable binding, same
      // icon.size intrinsic sizing. Nothing bespoke is invented here — the
      // root simply hosts the part it already declared. The root's own
      // tokens ride along so the glyph keeps its paint (Spinner's root
      // carries `color`, which IS the spinner's fill).
      //
      // The guard counts KEYS rather than testing `root.parts` for truth:
      // promotion writes `parts: {}` on a part-less root, and `{}` is truthy,
      // so a `!root.parts` guard never fires. Measured — the first cut of
      // this fix emitted `children: []` exactly as before.
      rootSpec.children = partToSpecs(
        'icon',
        { icon: root.icon, tokens: root.tokens, declared: root.declared } as Part,
        contract, byId, ctx, subst,
      );
    } else if (root.parts || hostsRootText) {
      // ROOT TEXT: the root's own text child comes FIRST (DOM order — the
      // text precedes the element children), then the parts; a root with
      // no parts hosts the text alone. Reversal applies to the whole list
      // (CSS row-reverse reverses the anonymous text box too). Byte-neutral
      // for every root without `text`.
      rootSpec.children = [
        ...rootTextSpecs(root, contract, byId, ctx, subst),
        ...variantParts(root.parts ?? {}, subst).flatMap(([childName, child]) =>
          partToSpecs(childName, child, contract, byId, ctx, subst),
        ),
      ];
      if (isReversed(root, subst)) rootSpec.children.reverse();
      centerStrokeGlyphsInHosts(rootSpec.children);
      stampGridCells(rootSpec, root, subst); // A2 grid — see stampGridCells
    } else if (textProp) {
      // ANTD EXAM (heal loop): a root whose label is a NON-children text prop
      // is an <input> drawing its placeholder — text starts at the padding
      // edge (antd `text-align: start`), it is never centred like a Button.
      if (textProp.bindings.code.prop !== 'children' && rootSpec.layout && rootSpec.layout.primary === 'CENTER') rootSpec.layout = { ...rootSpec.layout, primary: 'MIN' };
      rootSpec.children = [
        {
          type: 'text',
          name: 'label',
          characters: label,
          fontSize: ctx.fontSize ?? 16,
          fontStyle: figmaFaceStyle(ctx),
          ...textIdentity(ctx),
          textFill: ctx.textFill,
          ...(ctx.lineHeight !== undefined ? { lineHeight: ctx.lineHeight } : {}),
          ...textExtras(ctx),
          contentProp: textProp.bindings.figma.property,
        },
      ];
    }
    const collectStyles = (s: NodeSpec) => {
      if (s.fontStyle) fontStyles.add(s.fontStyle);
      (s.children ?? []).forEach(collectStyles);
    };
    collectStyles(rootSpec);
    variants.push({ name: rootSpec.name, row, col, spec: rootSpec });
  }

  // bindings.figma.statePreviews: compile the canvas-only "State" preview variants.
  // Bounded explosion: only the PRIMARY enum axis (the one whose tokens the
  // state overrides substitute; the first axis when overrides are variant-
  // independent) is multiplied — every other axis sits at its default.
  // Button (4 variants × 3 sizes, 3 states): 12 base + 4×3 = 24, not 48.
  const stateVariants: VariantSpec[] = [];
  let statePreviewAxis: ComponentData['statePreviewAxis'];
  if (contract.bindings?.figma?.statePreviews && contract.states.length > 0) {
    const overrides = root.states ?? {};
    const substProps = statePreviewSubstProps(contract); // validated: ≤1
    const primaryIdx = Math.max(0, axes.findIndex((a) => substProps.includes(a.prop.name)));
    const primary = axes[primaryIdx] as (typeof axes)[number] | undefined;
    const primaryValues = primary ? primary.values : [null];
    // The descriptor is written from the SAME primaryIdx/values[0] rule the
    // loop below draws with, so the two can never disagree.
    const figmaLabel = (a: (typeof axes)[number], value: string) =>
      a.prop.bindings.figma.values?.[value] ?? value;
    statePreviewAxis = {
      axis: STATE_PREVIEW_PROPERTY,
      default: STATE_PREVIEW_DEFAULT,
      states: contract.states.map((s) => statePreviewLabel(s)),
      primary: primary?.prop.bindings.figma.property ?? null,
      pinned: Object.fromEntries(
        axes
          .filter((_, i) => i !== primaryIdx || !primary)
          .map((a) => [a.prop.bindings.figma.property, figmaLabel(a, a.values[0]!)]),
      ),
    };
    // Base grid columns = ordered cartesian of axes 1..n; preview variants
    // occupy appended columns so the grid never collides.
    const baseColsN = axes.slice(1).reduce((n, a) => n * a.values.length, 1);
    for (let si = 0; si < contract.states.length; si++) {
      const stateName = contract.states[si];
      for (let pi = 0; pi < primaryValues.length; pi++) {
        const subst: Record<string, string> = {};
        const nameParts: string[] = [];
        for (let a = 0; a < axes.length; a++) {
          const { prop, values } = axes[a];
          const value = a === primaryIdx ? values[pi]! : values[0];
          subst[prop.name] = value;
          nameParts.push(
            `${prop.bindings.figma.property}=${prop.bindings.figma.values?.[value] ?? value}`,
          );
        }
        const previewName = withStateSegment(nameParts.join(', '), statePreviewLabel(stateName));
        const row = primaryIdx === 0 && primary ? pi : 0;
        const col =
          primaryIdx === 0 || !primary
            ? baseColsN + si
            : baseColsN + si * primaryValues.length + pi;
        const rootSpec: NodeSpec = {
          type: 'root',
          name: previewName,
          layout: layoutSpec(root, true, subst),
        };
        // Same resolveTokens rule as the base loop: per-combo tokensByProp
        // overrides apply BEFORE the state overrides layer on top.
        const baseCtx = applyStyling(rootSpec, root, subst, {});
        // v17 — the root's per-enum-value state bindings resolved for THIS
        // preview cell, layered over the single-ref state overrides.
        const byPropState: Record<string, string> = {};
        for (const e of root.statesByProp ?? []) {
          if (e.state !== stateName) continue;
          const v = subst[e.prop];
          if (v !== undefined) Object.assign(byPropState, e.map[v] ?? {});
        }
        const ctx = applyTokens(
          rootSpec,
          translateStateOverrides({ ...(overrides[stateName] ?? {}), ...byPropState }),
          subst,
          baseCtx,
          root.hugsBelowMaxWidth,
        );
        applyStylesWhenOpacity(rootSpec, root, contract, subst);
        boundFullBleedScrimRoot(rootSpec, root, subst, scrimNotes);
        // Round 5: same parent-aspect + block-root facts as the base loop.
        applyChildAspect(rootSpec, root);
        if (
          root.declared?.['display'] === 'block' &&
          !rootSpec.fixedWidth &&
          rootSpec.lits?.width === undefined
        ) {
          rootSpec.blockRoot = true;
        }
        if (root.parts || hostsRootText) {
          // v13: part-level state overrides apply INSIDE the preview variant
          // (withPartStateOverrides) — the State=Disabled cell draws the
          // disabled label color, mirroring .root:disabled .label on the CSS
          // surfaces.
          const stateParts = withPartStateOverrides(root.parts ?? {}, stateName, subst);
          // ROOT TEXT — the same text-first rule as the base loop; the
          // state's root overrides already ride `ctx`, so the text child
          // draws the state's ink.
          rootSpec.children = [
            ...rootTextSpecs(root, contract, byId, ctx, subst),
            ...variantParts(stateParts, subst).flatMap(([childName, child]) =>
              partToSpecs(childName, child, contract, byId, ctx, subst),
            ),
          ];
          if (isReversed(root, subst)) rootSpec.children.reverse();
          centerStrokeGlyphsInHosts(rootSpec.children);
          stampGridCells(rootSpec, root, subst); // A2 grid — see stampGridCells
        } else if (textProp) {
          rootSpec.children = [
            {
              type: 'text',
              name: 'label',
              characters: label,
              fontSize: ctx.fontSize ?? 16,
              fontStyle: figmaFaceStyle(ctx),
              ...textIdentity(ctx),
              textFill: ctx.textFill,
              ...(ctx.lineHeight !== undefined ? { lineHeight: ctx.lineHeight } : {}),
              ...textExtras(ctx),
              contentProp: textProp.bindings.figma.property,
            },
          ];
        }
        const collectStyles = (s: NodeSpec) => {
          if (s.fontStyle) fontStyles.add(s.fontStyle);
          (s.children ?? []).forEach(collectStyles);
        };
        collectStyles(rootSpec);
        stateVariants.push({ name: rootSpec.name, row, col, spec: rootSpec });
      }
    }
  }

  // PROTOTYPE WIRING (this round): pair every base State=Default variant that
  // HAS a hover/active twin with that twin. Derived from the preview names by
  // the ONE shared pairing rule (baseTwinName / withStateSegment) — the same
  // rule the runtime's withStateAxis applies when it renames base variants.
  //
  // COVERAGE LIMIT, RECEIPTED: preview variants pin every non-primary axis to
  // values[0] (see the bounded-explosion loop above), so ONLY base variants
  // whose non-primary axes sit at their defaults get a twin — and therefore a
  // reaction. Every other base variant (MUI Button Size=Small/Large, every
  // Color≠the-primary-axis cell) carries ZERO reactions BY CONSTRUCTION. That
  // is a named exclusion, not a silent skip: the plugin-engine gate asserts
  // the off-default cells are empty, and the emitted script's stateReactions
  // list is the human-readable receipt of exactly which cells are wired.
  //
  // Standalone COMPONENT contracts are skipped by name: a contract with state
  // previews always has ≥2 compiled variants, so `isSet` is true below and a
  // non-set can never reach the wiring (asserted by the isSet guard).
  const stateReactions: StateReaction[] = [];
  if (stateVariants.length > 0) {
    const previewNames = new Set(stateVariants.map((v) => v.name));
    const seenBase = new Set<string>();
    for (const sv of stateVariants) {
      const from = baseTwinName(sv.name);
      if (from === null || seenBase.has(from)) continue;
      seenBase.add(from);
      const axisPart = from === `${STATE_PREVIEW_PROPERTY}=${STATE_PREVIEW_DEFAULT}`
        ? ''
        : from.slice(0, from.length - `, ${STATE_PREVIEW_PROPERTY}=${STATE_PREVIEW_DEFAULT}`.length);
      for (const { state, trigger } of STATE_REACTION_TRIGGERS) {
        if (!contract.states.includes(state)) continue;
        const to = withStateSegment(axisPart, statePreviewLabel(state));
        if (!previewNames.has(to)) continue;
        stateReactions.push({ from, trigger, to });
      }
    }
  }

  // Text props bound to a text node somewhere in the compiled specs.
  const boundTextProps = new Set<string>();
  const collectBound = (s: NodeSpec) => {
    if (s.contentProp) boundTextProps.add(s.contentProp);
    (s.children ?? []).forEach(collectBound);
  };
  variants.forEach((v) => collectBound(v.spec));
  const textOnlyProps = contract.props
    .filter(
      (p) =>
        (p.type === 'text' || p.type === 'number') &&
        // ROUND 3: kind NONE carries NO property name — declaring one here
        // would mint a Figma property literally named "undefined". Such a
        // prop is code-only by construction (a promoted raw-override label).
        p.bindings.figma.kind !== 'NONE' &&
        !boundTextProps.has(p.bindings.figma.property!),
    )
    .map((p) => ({
      property: p.bindings.figma.property!,
      default:
        typeof p.default === 'string' ? p.default : typeof p.default === 'number' ? String(p.default) : '',
    }));

  // THE NAMED RECEIPT (2026-08-22). Every code-only fact this function
  // learns about lands in `facts` — declared-not-drawn channels, gradient /
  // shadow grammar misses, channel misses, root margins, events, meters,
  // scrim bounding, preview-only washes — and leaves as
  // `ComponentData.codeOnlyFacts` (sorted, duplicate-free). Until this round
  // the lists below were Sets of strings whose ONLY consumer was `.size`,
  // feeding one trailing `†`: 279 channel misses and 19 declared facts on
  // the eight Flowbite contracts collapsed to 8 bare daggers, and nothing a
  // designer could open named a single one of them.
  const facts: CodeOnlyFactObservation[] = [];
  // v15 (S4): declared-not-drawn facts. 'draw'-verdict base facts render
  // natively and need no receipt; state-plane declared facts are always
  // code-only (state previews do not draw declared facts yet — a named limit).
  for (const { name: partName, part } of walkAnatomy(contract)) {
    const note = (channel: string, value: string, state?: string) => {
      const reg = DECLARED_CHANNELS[channel];
      // R8 (2026-08-22): a channel the registry does not know used to
      // `return` here — "refused upstream by validateContract" — which is
      // true only on the paths that validate first. A compile reached any
      // other way dropped the declared fact in silence. Name it: nothing
      // draws it and no registry note describes it.
      if (!reg) {
        facts.push({
          part: partName,
          variant: '',
          kind: 'declared',
          channel,
          value,
          reason: state
            ? `declared for the ${state} state on a channel outside the DECLARED_CHANNELS registry — nothing draws it and no registry note describes it (validateContract refuses it by name; named here so an unvalidated compile can never drop it in silence)`
            : 'declared channel outside the DECLARED_CHANNELS registry — nothing draws it and no registry note describes it (validateContract refuses it by name; named here so an unvalidated compile can never drop it in silence)',
        });
        return;
      }
      // channelDraws owns the per-value exceptions (drawExcept) that used to
      // be spelled out here — overflow-x/y auto|scroll annotate while
      // hidden|clip draw, and text-decoration-line/overline annotates.
      const drawn = channelDraws(channel, value) && !state;
      if (drawn) return;
      // Part D (owner directive, 2026-07-19): the annotation COPY does not
      // land on the canvas as description text — it rides the receipt.
      facts.push({
        part: partName,
        variant: '',
        kind: 'declared',
        channel,
        value,
        reason: state
          ? `declared for the ${state} state — state previews do not draw declared facts (a named limit)`
          : reg.canvas === 'draw'
            ? `declared value outside the canvas grammar for this channel — ${reg.note}`
            : reg.note,
      });
    };
    for (const [ch, v] of Object.entries(part.declared ?? {})) note(ch, v);
    for (const [state, m] of Object.entries(part.declaredStates ?? {})) {
      for (const [ch, v] of Object.entries(m)) note(ch, v, state);
    }
  }
  // FC-EMIT-ROOT-MARGIN-SILENT: applyMarginBox wraps a CHILD inside a parent
  // auto-layout. The variant ROOT is the COMPONENT itself — a SET cannot
  // wrap it — so compiled root margins were a runtime no-op (HelperText
  // margin-top 8px sat on every variant spec and nothing drew it). Name
  // the drop and strip the field so the plugin never carries a silent miss.
  const refuseRootMargins = (spec: NodeSpec) => {
    const m = spec.margins;
    if (!m) return;
    const sides = (['top', 'right', 'bottom', 'left'] as const).filter((s) => m[s]);
    if (sides.length === 0) return;
    miss(
      spec,
      sides.map((s) => `margin-${s}`).join('/'),
      'root margins have no parent auto-layout to wrap — a COMPONENT_SET child is the component itself, so residual root margin is not canvas-drawable (FC-EMIT-ROOT-MARGIN-SILENT)',
      sides.map((s) => `${m[s]}px`).join('/'),
    );
    delete spec.margins;
    delete spec.marginVars;
  };
  for (const v of variants) refuseRootMargins(v.spec);
  for (const v of stateVariants) refuseRootMargins(v.spec);
  // Gradient / shadow misses: collected off the compiled specs into the
  // receipt and STRIPPED from the emitted JSON — never a silent drop, never
  // emitted noise.
  // SILENT-LOSS ROUND (task #33, fix 3): channel misses ride the SAME
  // collection path as the gradient/shadow misses this file already had —
  // one "I had a value and could not draw it" mechanism, not three.
  // `variant` is the compiled variant's name; the root spec is NAMED after
  // its variant, so the part is re-spelled `root` there and every other node
  // keeps its part name — the same spelling the declared facts use.
  const stripMisses = (spec: NodeSpec, variant: string, part = spec.name) => {
    if (spec.gradientMiss !== undefined) {
      facts.push({
        part,
        variant,
        kind: 'gradient',
        channel: 'background-image',
        value: spec.gradientMiss,
        reason: 'did not parse as a linear gradient (radial / conic / foreign grammar) — Figma lowers linear-gradient stacks only',
      });
      delete spec.gradientMiss;
    }
    if (spec.shadowMiss !== undefined) {
      facts.push({
        part,
        variant,
        kind: 'shadow',
        channel: 'box-shadow',
        value: spec.shadowMiss,
        reason: 'parsed neither as a single drop shadow nor as an effect stack — inexpressible / foreign shadow grammar',
      });
      delete spec.shadowMiss;
    }
    if (spec.channelMiss !== undefined) {
      for (const seed of spec.channelMiss) facts.push({ part, variant, kind: 'channel', ...seed });
      delete spec.channelMiss;
    }
    // D5: compile-side flag only — the bounding already happened on the box.
    delete spec.scrimBounded;
    (spec.children ?? []).forEach((child) => stripMisses(child, variant));
  };
  for (const v of variants) stripMisses(v.spec, v.name, 'root');
  for (const v of stateVariants) stripMisses(v.spec, v.name, 'root');
  // Round 5d: sibling-margin → itemSpacing lowering (then marginVars strip —
  // compile-side only, never serialized).
  for (const v of variants) lowerMarginGaps(v.spec);
  for (const v of stateVariants) lowerMarginGaps(v.spec);
  const stripMarginVars = (s: NodeSpec) => {
    delete s.marginVars;
    (s.children ?? []).forEach(stripMarginVars);
  };
  for (const v of variants) stripMarginVars(v.spec);
  for (const v of stateVariants) stripMarginVars(v.spec);
  // FILL is a compile-time decision (see annotateFillW) — runs LAST so it
  // sees the final spec shape (after margin lowering / miss stripping).
  for (const v of variants) annotateFillW(v.spec);
  for (const v of stateVariants) annotateFillW(v.spec);
  // ANTD EXAM (S6, 2026-08-23) — THE MARGIN BOX HAS A SILENT EXIT. The
  // runtime's applyMarginBox returns without a word when the child is
  // FILL-sized, grows, or is out of flow (overlay / inset / absolute): a
  // wrapper around a FILL child would break the fill, so the residual margin
  // is simply not drawn. Measured on the conformance case
  // `antd-empty-margin-only-parts` (antd Switch's inner-checked/unchecked
  // spans): `margin-left: 24px` on a display:block child of a vertical stack
  // compiled to fillW, the margin box was skipped, and the canvas round trip
  // reported SILENT — the contract carried the token, the dump carried no
  // trace, and none of the three code-only facts was this one. FILL is
  // decided just above (annotateFillW runs last), so this is the first point
  // the compile can know the runtime will skip; name every residual side as
  // a channel miss and strip the dead field, exactly as refuseRootMargins
  // does for the root.
  const refuseSkippedMargins = (spec: NodeSpec, variant: string) => {
    for (const child of spec.children ?? []) {
      const m = child.margins;
      if (m) {
        const sides = (['top', 'right', 'bottom', 'left'] as const).filter((s) => m[s]);
        // The fourth exit is the one the exam found: an EMPTY in-flow frame
        // takes the parent's height (layoutSizingVertical FILL — the #60
        // runtime default, so a ProgressBar indicator never inherits Figma's
        // 100×100 createFrame box), and applyMarginBox tests EITHER axis.
        const emptyRuntimeSized =
          child.type === 'frame' && (child.children?.length ?? 0) === 0 &&
          !child.fixedHeight && child.lits?.height === undefined && !child.shape;
        const why = child.overlay || child.insetOverlay || child.absolute
          ? 'an out-of-flow child (overlay / inset / absolute) keeps its own placement lowering'
          : child.grow
            ? 'a growing child (flex-grow → layoutGrow) cannot be wrapped without breaking the grow'
            : child.fillW
              ? 'a FILL-sized child cannot be wrapped in a margin box without breaking the fill'
              : emptyRuntimeSized
                ? 'an EMPTY in-flow box takes the parent height (layoutSizingVertical FILL, the #60 runtime default) and a FILL-sized child cannot be wrapped'
                : null;
        if (sides.length > 0 && why) {
          facts.push({
            part: child.name,
            variant,
            kind: 'channel',
            channel: sides.map((s) => `margin-${s}`).join('/'),
            value: sides.map((s) => `${m[s]}px`).join('/'),
            reason: `the margin-box wrapper is skipped — ${why}; the residual margin is not canvas-drawable (FC-EMIT-MARGIN-BOX-SKIPPED)`,
          });
          delete child.margins;
        }
      }
      refuseSkippedMargins(child, variant);
    }
  };
  for (const v of variants) refuseSkippedMargins(v.spec, v.name);
  for (const v of stateVariants) refuseSkippedMargins(v.spec, v.name);
  // Meter parts are runtime-sized (the canvas shows the defaults' fraction;
  // height follows the track) — a code-only fact like the rest.
  for (const { name: partName, part } of walkAnatomy(contract)) {
    if (!part.meter) continue;
    facts.push({
      part: partName,
      variant: '',
      kind: 'meter',
      channel: 'meter',
      value: '',
      reason: "runtime-sized — the canvas shows the defaults' fraction and the height follows the track",
    });
  }
  // ANTD EXAM (W4): capture-side receipts the CONTRACT carries (Part.codeOnly)
  // — state-plane facts the computed capture observed and the grammar refused
  // (a nested part's focus-visible outline-width; a state delta outside every
  // mintable kind). Repeated here verbatim so the bundle, the plugin report
  // and the set's plugin data name them; nothing draws them.
  for (const { name: partName, part } of walkAnatomy(contract)) {
    for (const c of part.codeOnly ?? []) {
      facts.push({
        part: partName,
        variant: '',
        kind: 'capture',
        channel: c.state ? `${c.channel} [${c.state}]` : c.channel,
        value: c.value,
        reason: `observed by the computed capture and refused by the contract grammar — ${c.reason}`,
      });
    }
  }
  // ANTD EXAM (S1 third half, 2026-08-23) — THE UNDRAWN STATE PLANE. A
  // contract whose parts carry STATE token bindings (root.states.focus-visible
  // .outline-width …) draws them on the canvas only as State preview cells,
  // and those exist only when bindings.figma.statePreviews is on (promote's
  // referee probe turns it on where it can; an explicit reviewed `false` or a
  // refusal leaves it off). With previews off the whole state plane is
  // simply not built — measured on the conformance fixture (which never
  // promotes): the focus ring's three carried channels vanished from the
  // dump and the round trip reported SILENT, because the only receipts on
  // the set were about the REST plane. Name every state-bound channel the
  // undrawn plane holds.
  // ANTD EXAM (Badge / Tag, 2026-08-23) — THE UNSET PLANE. A DEFAULTLESS enum
  // axis (antd's Tag `color`, Badge `color`, Input `status`; Carbon's `size`,
  // Altitude's `variant`, Polaris's `tone`) renders the library's OWN default
  // when the prop is absent — antd's red count badge, its neutral grey tag —
  // and the capture measured that plane as the set's BASE (its tokens ride
  // `tokens`; the enum values ride tokensByProp). The canvas enumerates
  // VARIANT cells from the enum values only, so the unset rendering — usually
  // the most recognisable one — has no cell, and the round trip proposes the
  // first enum value as the default. Measured on the scratch-file dump:
  // Badge came back `Color: Blue|Green|Purple, default Blue` with the red
  // badge nowhere and nothing naming it. One fact per defaultless axis.
  for (const p of contract.props) {
    if (!isEnum(p) || p.default !== undefined || p.bindings.figma.kind !== 'VARIANT') continue;
    facts.push({
      part: 'root',
      variant: '',
      kind: 'channel',
      channel: `${p.name} [unset]`,
      value: p.type.enum.join('|'),
      reason: `defaultless axis — the library's own rendering when "${p.name}" is absent (the capture's base plane, whose tokens ride the parts' base bindings) has no VARIANT cell: the set enumerates the ${p.type.enum.length} declared values only, and a proposal read back from the canvas will call "${p.type.enum[0]}" the default (FC-UNSET-PLANE-UNDRAWN)`,
    });
  }
  if (!contract.bindings?.figma?.statePreviews && contract.states.length > 0) {
    for (const { name: partName, part } of walkAnatomy(contract)) {
      for (const [state, m] of Object.entries(part.states ?? {})) {
        for (const [ch, ref] of Object.entries(m)) {
          facts.push({
            part: partName,
            variant: '',
            kind: 'channel',
            channel: `${ch} [${state}]`,
            value: ref,
            reason: `the ${state} plane is not drawn — bindings.figma.statePreviews is off (a reviewed decision or the referee's refusal), so no State preview cell exists to carry this state binding (FC-STATE-PLANE-UNDRAWN)`,
          });
        }
      }
    }
  }
  // Round 5: compiled facts the SYNC RUNTIME cannot apply natively — the
  // image-placeholder wash (raster content is runtime data), the block-root
  // width fact (no intrinsic width) — join the receipt, never a silent drop.
  // (Round 5d: margin channels left this list — they now apply on canvas as
  // itemSpacing or the margin-box wrapper.)
  const collectPreviewOnly = (s: NodeSpec, variant: string, part = s.name) => {
    if (s.imgPlaceholder === true) {
      facts.push({
        part,
        variant,
        kind: 'preview',
        channel: 'img',
        value: '',
        reason: 'raster content is runtime data — the canvas draws the standard image-placeholder wash unless the contract carries a fill',
      });
    }
    if (s.blockRoot === true) {
      facts.push({
        part,
        variant,
        kind: 'preview',
        channel: 'display',
        value: 'block',
        reason: 'a block root has no intrinsic width — the canvas draws a preview width, the code surface fills its container',
      });
    }
    (s.children ?? []).forEach((child) => collectPreviewOnly(child, variant));
  };
  for (const v of variants) collectPreviewOnly(v.spec, v.name, 'root');
  for (const v of stateVariants) collectPreviewOnly(v.spec, v.name, 'root');
  // Events: the canvas cannot run behaviour — the interaction surface is
  // code-only by construction (the schema's own words).
  for (const ev of contract.events ?? []) {
    facts.push({
      part: ev.trigger,
      variant: '',
      kind: 'event',
      channel: ev.name,
      value: ev.bindings.code.prop,
      reason: `fires when the ${ev.trigger} part is activated — the canvas cannot run behaviour, so the event stays a code-side callback${ev.toggles ? ` (toggles ${ev.toggles.prop} between ${ev.toggles.between.join(' / ')})` : ''}`,
    });
  }
  facts.push(...scrimNotes);
  const codeOnlyFacts = foldCodeOnlyFacts(facts, variants.length + stateVariants.length);
  // Part D (owner directive): the canvas CAPTION carries one trailing † —
  // with the count beside it now, pointing at where the names live.
  const hasCodeOnlyFacts = codeOnlyFacts.length > 0;

  return {
    setName: contract.name,
    contractId: contract.id,
    version: contract.version,
    anchorKey: contract.bindings.figma.anchors.componentSetKey ?? null,
    // Part D (owner directive, 2026-07-19): the component description is ONE
    // short caption line — a name and a provenance pointer, nothing else.
    // The old paragraphs of capability-matrix copy (events, declared facts,
    // gradient misses, meter sizing) were meaningless to designers on the
    // canvas; the detailed facts ride `codeOnlyFacts` (stamped as plugin
    // data and listed in the plugin report). The single trailing dagger
    // marks that code-only facts exist, and says how many. Plugin-data
    // identity markers (ds_contracts/*) are machine identity and remain
    // untouched.
    description: `${contract.name} — generated from contract ${contract.id} v${contract.version}${hasCodeOnlyFacts ? ` † (${codeOnlyFacts.length} code-only facts — see plugin report)` : ''}`,
    ...(contract.documentationLinks && contract.documentationLinks.length > 0
      ? { documentationLinks: contract.documentationLinks.map((l) => ({ uri: l.uri })) }
      : {}),
    isSet: variants.length + stateVariants.length > 1,
    boolProps: boolPropsData,
    textProps: textOnlyProps,
    fontStyles: [...fontStyles],
    variants,
    ...(() => {
      const map: Record<string, string> = {};
      for (const p of contract.props ?? []) {
        const prop = p.bindings?.figma?.property;
        if (typeof prop === 'string' && prop && p.name) map[prop] = p.name;
      }
      return Object.keys(map).length > 0 ? { propNames: map } : {};
    })(),
    ...(contract.semantics && (contract.semantics.element || contract.semantics.role)
      ? {
          semantics: {
            ...(contract.semantics.element ? { element: contract.semantics.element } : {}),
            ...(contract.semantics.role ? { role: contract.semantics.role } : {}),
          },
        }
      : {}),
    ...(stateVariants.length > 0 ? { stateVariants } : {}),
    ...(stateVariants.length > 0 && statePreviewAxis ? { statePreviewAxis } : {}),
    ...(stateReactions.length > 0 ? { stateReactions } : {}),
    ...(hasCodeOnlyFacts ? { codeOnlyFacts } : {}),
    colW: Math.max(
      380,
      ...[...variants, ...stateVariants].map((v) => (v.spec.fixedWidth?.px ?? 0) + 60),
    ),
  };
}

/** The conditional minted-variable preamble (see FigmaScriptCtx.mintedTokens).
 *  Returns '' when the tree is absent/empty, so contracts without a minted
 *  layer emit byte-identical scripts — the golden guard's invariant. */
function mintedPreamble(
  mintedTokens?: Record<string, unknown>,
  resolveLiteral?: (dotPath: string) => unknown,
): string {
  const minted = mintedTokens ? flatten(mintedTokens) : null;
  if (!minted || minted.size === 0) return '';
  // Shadow-typed leaves (box-shadow values, dump v1.2) and gradient-typed
  // leaves (background-image stacks, v15) have no Figma variable projection —
  // skipped here; the limit is NAMED at proposal.
  // GAP-CLOSING ROUND 6: nor does a SIZING KEYWORD. A minted `size` leaf may
  // hold `fit-content` (a HUG plane of a mixed fixed/hug axis). Figma
  // variables are COLOR / FLOAT / STRING, and no STRING variable can bind
  // `width` — so there is nothing to upsert, and `figmaValue` would have run
  // px('fit-content'), which THROWS ("Not a numeric token value") and takes
  // the whole component script down. The fact is not lost by skipping: the
  // sizing MODE it states is applied structurally (applyTokens leaves
  // primary/counterAxisSizingMode at AUTO = HUG), and the value never needed
  // a variable to say so.
  const vars = [...minted]
    .filter(([, entry]) => entry.type !== 'shadow' && entry.type !== 'gradient' && !isHugKeyword(entry.value))
    .map(([p, entry]) => {
      // task #26: a SOURCE-ALIASED minted leaf carries `{p.font-weight-medium}`,
      // not a literal — px() on the raw ref was the crash class this round
      // exposed (MUI's aliases never reached this path: the CLI `figma` verb
      // emits no provisional preamble; only the generate.ts provisional path
      // does). The provisional upsert becomes a NATIVE VARIABLE ALIAS to the
      // real token variable when the origin file carries it (polaris's
      // 00-tokens script upserts the full base set), and falls back to the
      // resolved literal otherwise (the headless compile receipt runs each
      // script in an EMPTY file, where the target does not exist).
      const target = aliasTarget(entry.value);
      if (target) {
        const resolved = resolveLiteral?.(target);
        if (resolved === undefined) {
          throw new Error(
            `minted alias {${target}} does not resolve in the token corpus — the provisional preamble has no literal fallback to embed`,
          );
        }
        const rEntry = { ...entry, value: String(resolved) };
        return {
          name: figmaName(p),
          type: figmaType(rEntry),
          value: figmaValue(rEntry),
          alias: target.split('.').join('/'),
        };
      }
      return { name: figmaName(p), type: figmaType(entry), value: figmaValue(entry) };
    });
  if (vars.length === 0) return '';
  const hasAlias = vars.some((v) => 'alias' in v);
  return `// ---------------------------------------------------------------------------
// PROVISIONAL VARIABLES — minted from resolved values by a degraded import.
// This contract binds ${vars.length} provisional token(s) whose real variable names were
// unrecoverable, so this section upserts each one as a Figma variable in a
// collection named 'Imported (provisional)' — idempotent by name, within that
// collection only — before the bindings below look anything up. The values
// are literal-fidelity stand-ins, not your design vocabulary: rename them
// against your real tokens when you adopt the contract.
// ---------------------------------------------------------------------------
const MINTED_VARIABLES = ${JSON.stringify(vars)};
{
  // Minted colors may be 8-digit hex (paint opacity captured by dump v1.1) —
  // Figma COLOR variables accept RGBA, so the alpha channel survives.
  const hexToRgb = (hex) => {
    const h = hex.replace('#', '');
    const c = {
      r: parseInt(h.slice(0, 2), 16) / 255,
      g: parseInt(h.slice(2, 4), 16) / 255,
      b: parseInt(h.slice(4, 6), 16) / 255,
    };
    if (h.length === 8) c.a = parseInt(h.slice(6, 8), 16) / 255;
    return c;
  };
  const cols = await figma.variables.getLocalVariableCollectionsAsync();
  let col = cols.find((c) => c.name === 'Imported (provisional)');
  if (!col) col = figma.variables.createVariableCollection('Imported (provisional)');
  const modeId = col.modes[0].modeId;
  const byName = {};${hasAlias ? `
  // Source-aliased leaves (task #26): when the origin file already carries the
  // REAL token variable (p/font-weight-medium — polaris's 00-tokens script
  // upserts the full set), the provisional variable aliases it natively, so it
  // inherits mode values instead of freezing a literal. In a file without the
  // target (the headless compile receipt runs in an empty file) the embedded
  // resolved literal is the named fallback.
  const allByName = {};` : ''}
  for (const v of await figma.variables.getLocalVariablesAsync()) {
    if (v.variableCollectionId === col.id) byName[v.name] = v;${hasAlias ? `
    allByName[v.name] = v;` : ''}
  }
  for (const t of MINTED_VARIABLES) {
    let v = byName[t.name];
    if (!v) { v = figma.variables.createVariable(t.name, col, t.type); byName[t.name] = v; }${hasAlias ? `
    const aliasTarget = t.alias ? allByName[t.alias] : null;
    if (aliasTarget && aliasTarget.id !== v.id) {
      v.setValueForMode(modeId, { type: 'VARIABLE_ALIAS', id: aliasTarget.id });
      continue;
    }` : ''}
    v.setValueForMode(modeId, t.type === 'COLOR' ? hexToRgb(t.value) : t.value);
  }
}

`;
}

/** True when any compiled spec in the tree carries node opacity — the
 *  runtime opacity line is emitted ONLY then, so contracts without the
 *  channel emit byte-identical scripts (the golden guard's invariant, same
 *  discipline as mintedPreamble). */
const specHasOpacity = (s: NodeSpec): boolean =>
  typeof s.opacity === 'number' || (s.children ?? []).some(specHasOpacity);
const dataHasOpacity = (d: ComponentData): boolean =>
  [...d.variants, ...(d.stateVariants ?? [])].some((v) => specHasOpacity(v.spec));
const opacityRuntime = (has: boolean): string =>
  has
    ? `
  // Node opacity (dump v1.2 channel): applies to every node kind.
  // Unbind first: a stale OPACITY variable (repo 0-1 token bound into
  // Figma's percent-scaled field) wins over the literal and paints 0.5
  // as 0.5% — the Disabled wash (visual-parity Button, 93.91% masked).
  if (typeof spec.opacity === 'number') {
    try { if (node.boundVariables && node.boundVariables.opacity) node.setBoundVariable('opacity', null); } catch (e) { degrade('FC-RT-OPACITY-UNBIND-REFUSED', node, 'a stale opacity variable could not be unbound before the literal opacity was set; the variable may still win over spec.opacity', e); }
    node.opacity = spec.opacity;
  }`
    : '';

// Conditional runtimes (same golden discipline as opacityRuntime: contracts
// without the channel emit byte-identical scripts).
/** Round 5d (owner finding: the Checkbox/Radio control↔label gap was
 *  missing on canvas): a UNIFORM positive main-axis margin between in-flow
 *  siblings is the CSS spelling of the parent's itemSpacing — lower it
 *  there. When every gap comes from exactly ONE token-carried margin
 *  channel resolving to one variable, the itemSpacing BINDS that variable
 *  (the gap fact stays inspectable as a token); mixed sources lower as a
 *  literal. Non-uniform gaps, edge margins (leading margin of the first
 *  child / trailing margin of the last), cross-axis and negative margins
 *  stay on the child spec — the runtime renders those as the CSS margin
 *  box (wrapper frame), the preview as CSS margins. */
function lowerMarginGaps(spec: NodeSpec): void {
  for (const child of spec.children ?? []) lowerMarginGaps(child);
  if (!spec.layout) return;
  if (spec.bindings?.itemSpacing !== undefined || spec.lits?.itemSpacing !== undefined) return;
  const kids = (spec.children ?? []).filter(
    (c) => !c.overlay && !c.insetOverlay && !c.absolute,
  );
  if (kids.length < 2) return;
  const horiz = (spec.layout.mode ?? 'HORIZONTAL') === 'HORIZONTAL';
  const lead = horiz ? ('left' as const) : ('top' as const);
  const trail = horiz ? ('right' as const) : ('bottom' as const);
  const gaps: Array<{ px: number; vars: Array<string | null> }> = [];
  for (let i = 0; i < kids.length - 1; i++) {
    const t = kids[i].margins?.[trail] ?? 0;
    const l = kids[i + 1].margins?.[lead] ?? 0;
    const vars: Array<string | null> = [];
    if (t !== 0) vars.push(kids[i].marginVars?.[trail] ?? null);
    if (l !== 0) vars.push(kids[i + 1].marginVars?.[lead] ?? null);
    gaps.push({ px: t + l, vars });
  }
  const px = gaps[0].px;
  if (px <= 0 || !gaps.every((g) => g.px === px)) return;
  const sources = new Set(gaps.flatMap((g) => g.vars));
  if (sources.size === 1 && gaps.every((g) => g.vars.length === 1) && !sources.has(null)) {
    spec.bindings = { ...spec.bindings, itemSpacing: [...sources][0] as string };
  } else {
    (spec.lits ??= {}).itemSpacing = px;
  }
  for (let i = 0; i < kids.length; i++) {
    const m = kids[i].margins;
    if (!m) continue;
    if (i < kids.length - 1) {
      delete m[trail];
      if (kids[i].marginVars) delete kids[i].marginVars![trail];
    }
    if (i > 0) {
      delete m[lead];
      if (kids[i].marginVars) delete kids[i].marginVars![lead];
    }
    if (Object.values(m).every((v) => v === undefined)) delete kids[i].margins;
  }
}

const specSome = (s: NodeSpec, pred: (x: NodeSpec) => boolean): boolean =>
  pred(s) || (s.children ?? []).some((c) => specSome(c, pred));
const dataSome = (d: ComponentData, pred: (x: NodeSpec) => boolean): boolean =>
  [...d.variants, ...(d.stateVariants ?? [])].some((v) => specSome(v.spec, pred));

/** v9 shape: node-creation branch — a REAL RegularPolygon/Ellipse/Rectangle
 *  with native rotation (contract CSS-clockwise degrees → plugin CCW).
 *  B-3 finding 3: `effects` receives the SAME compiled shadow application as
 *  the frame branch (the shape branch silently dropped the Checkbox
 *  backdrop's inset ring) — the caller passes the shadow/effect-stack
 *  runtime snippets so conditional emission stays aligned with the frame
 *  path. */
/** Round 5d: stroke alignment expression — outline-lowered strokes align
 *  OUTSIDE (CSS outlines sit outside the border box and are never painted
 *  over by children; the Banner focus ring's top arc was covered by the
 *  opaque tone ribbon under the old INSIDE constant). Feature-gated: the
 *  constant is emitted verbatim when no spec carries strokeOutside. */
const strokeAlignJs = (hasOutside: boolean): string =>
  hasOutside ? `spec.strokeOutside ? 'OUTSIDE' : 'INSIDE'` : `'INSIDE'`;

/** Round 5d: the CSS margin box as a fixed wrapper frame (see
 *  NodeSpec.margins). Emitted only when a spec carries residual margins. */
const marginBoxRuntime = (has: boolean): string =>
  has
    ? `
// Round 5d: auto-layout has no per-child margin — a child carrying residual
// margins gets its CSS MARGIN BOX as a fixed wrapper frame (clipsContent
// false), the child placed at (left, top). Negative margins shrink the flow
// box and let the glyph overhang — the exact CSS geometry (the Badge pip's
// -2/-2/-8 is what keeps the real pill 20px tall). Out-of-flow children
// (overlay / inset / absolute) and FILL-sized children keep their own
// lowering.
function applyMarginBox(parent, childNode, childSpec, registry) {
  const m = childSpec.margins;
  if (!m || childSpec.overlay || childSpec.insetOverlay || childSpec.absolute || childSpec.grow) return;
  try {
    if (childNode.layoutSizingHorizontal === 'FILL' || childNode.layoutSizingVertical === 'FILL') return;
  } catch (e) { degrade('FC-RT-MARGIN-BOX-SIZING-UNREADABLE', childNode, 'layout sizing could not be read before the margin box was applied; applied as if the child were not FILL-sized', e); }
  const t = m.top || 0, r = m.right || 0, b = m.bottom || 0, l = m.left || 0;
  if (!t && !r && !b && !l) return;
  const w = Math.max(childNode.width + l + r, 0.01);
  const h = Math.max(childNode.height + t + b, 0.01);
  const box = figma.createFrame();
  box.name = childSpec.name + ' (margin box)';
  box.fills = [];
  box.clipsContent = false;
  parent.insertChild(parent.children.indexOf(childNode), box);
  box.resize(w, h);
  box.appendChild(childNode);
  childNode.x = l;
  childNode.y = t;
  // Wave B.4 / Polaris Button: a Show-bound child wrapped in a margin box
  // must transfer the visible binding to the WRAPPER — hiding only the
  // inner icon leaves the ~20px margin box in auto-layout (blank left gap).
  if (childSpec.visibleProp && registry && registry.visibles) {
    for (const vis of registry.visibles) {
      if (vis.node === childNode) vis.node = box;
    }
    childNode.visible = true;
  }
}
`
    : '';
const marginBoxCall = (has: boolean, args: string): string =>
  has
    ? `
    applyMarginBox(${args});`
    : '';

/** Round 5d: single-paint glyphs ride their contract variable — svg import
 *  bakes literal paints (SVG paint is not bindable at import), so the
 *  imported vectors re-bind to the SAME variable the contract carries and
 *  the inspector shows the token, not a bare hex (the Badge pip). */
const svgPaintRuntime = (has: boolean): string =>
  has
    ? `
    if (spec.svgPaintVar) {
      const glyphPaint = boundPaint(spec.svgPaintVar, node);
      const rebind = (n) => {
        if (Array.isArray(n.fills) && n.fills.length > 0) n.fills = [glyphPaint];
        if (Array.isArray(n.strokes) && n.strokes.length > 0) n.strokes = [glyphPaint];
        if (n.children) for (const c of n.children) rebind(c);
      };
      for (const c of node.children) rebind(c);
    }`
    : '';

const shapeRuntime = (has: boolean, effects: string, alignExpr: string, shapeLits = false, hasArc = false): string =>
  has
    ? ` else if (spec.type === 'shape') {
    // FC-PSEUDO-STROKE-GLYPH: adjacent two-side border L collapsed to a
    // ROUND-cap polyline SVG (see collapseTwoSideStrokeGlyph). Keep type
    // 'shape' so absolute/rotation placement still uses shape.width/height.
    if (spec.svg) {
      node = figma.createNodeFromSvg(spec.svg);
      node.fills = [];
      node.clipsContent = false;
      try { node.resize(spec.shape.width, spec.shape.height); } catch (e) { degrade('FC-RT-SVG-RESIZE-REFUSED', node, 'the glyph kept its intrinsic size (resize to ' + spec.shape.width + 'x' + spec.shape.height + ' refused)', e); }
      if (typeof spec.shape.rotation === 'number' && spec.shape.rotation !== 0) node.rotation = -spec.shape.rotation;${effects}
    } else {
    // v9 shape (#42): a REAL parametric node with native rotation.
    node = spec.shape.kind === 'ellipse' ? figma.createEllipse()
      : spec.shape.kind === 'rect' ? figma.createRectangle()
      : figma.createPolygon();
    if (spec.shape.kind === 'polygon' && spec.shape.sides) node.pointCount = spec.shape.sides;
    node.resize(spec.shape.width, spec.shape.height);
${hasArc ? `    // Constant ellipse arc sweep (round 2 iteration 4): native arcData, the
    // exact radians the dump captured (Figma ArcData semantics both ways).
    if (spec.shape.kind === 'ellipse' && spec.shape.arc) {
      node.arcData = { startingAngle: spec.shape.arc.start, endingAngle: spec.shape.arc.end, innerRadius: spec.shape.arc.innerRadius };
    }
` : ''}    // Shape nodes ship a default gray paint — a spec with NO fill channel
    // clears it (a canvas artifact is not contract data; Phase B deviation 3).
    // Round 5f (B5E finding 2): a shape's LITERAL fill (lits.fillColor — the
    // RadioButton checked dot's white, compiled from the decor's
    // background-color literal) was DROPPED here (the shape branch never runs
    // applyFrameSpec's litsRuntime), so the dot landed with no fill and had to
    // be hand-corrected on canvas each re-amend. Apply it at the SOURCE:
    // bound fill wins; else a literal fill; else clear.
    node.fills = spec.fill
      ? [boundPaint(spec.fill, node)]
      : (spec.lits && spec.lits.fillColor)
        ? [{ type: 'SOLID', color: { r: spec.lits.fillColor.r, g: spec.lits.fillColor.g, b: spec.lits.fillColor.b }, opacity: spec.lits.fillColor.a === undefined ? 1 : spec.lits.fillColor.a }]
        : [];
    // spec.stroke + spec.bindings apply exactly as on frames (Phase B
    // deviation 2: the emitted shape branch silently dropped the checkbox /
    // radio backdrop strokes and radii — the shim now lives at the source).
    if (spec.stroke) {
      node.strokes = [boundPaint(spec.stroke, node)];
      node.strokeAlign = ${alignExpr};
    }${shapeLits ? `
    // CARBON LIVE-DEFECT ROUND (D2): a shape's LITERAL RING. An unchecked
    // Carbon checkbox box is a transparent square with a 1px border — a ring
    // with no paint, no weight and no radius is not a box.
    else if (spec.lits && spec.lits.strokeColor) {
      node.strokes = [{ type: 'SOLID', color: { r: spec.lits.strokeColor.r, g: spec.lits.strokeColor.g, b: spec.lits.strokeColor.b }, opacity: spec.lits.strokeColor.a === undefined ? 1 : spec.lits.strokeColor.a }];
      node.strokeAlign = ${alignExpr};
    }
    if (spec.lits && spec.lits.strokeWeight !== undefined) node.strokeWeight = spec.lits.strokeWeight;
    if (spec.lits && spec.lits.strokeSides) {
      const sw = spec.lits.strokeSides;
      // ELLIPSE/LINE/etc. expose strokeWeight only — per-side props throw
      // "Cannot add property strokeTopWeight, object is not extensible".
      if ('strokeTopWeight' in node) {
        if (sw.top !== undefined) node.strokeTopWeight = sw.top;
        if (sw.right !== undefined) node.strokeRightWeight = sw.right;
        if (sw.bottom !== undefined) node.strokeBottomWeight = sw.bottom;
        if (sw.left !== undefined) node.strokeLeftWeight = sw.left;
      } else {
        const w = sw.top !== undefined ? sw.top : (sw.right !== undefined ? sw.right : (sw.bottom !== undefined ? sw.bottom : sw.left));
        if (w !== undefined) node.strokeWeight = w;
      }
    }
    if (spec.lits && spec.lits.radius !== undefined) node.cornerRadius = spec.lits.radius;` : ''}
    for (const [field, varName] of Object.entries(spec.bindings || {})) {
      node.setBoundVariable(field, need(varName));
    }
    if (typeof spec.shape.rotation === 'number' && spec.shape.rotation !== 0) node.rotation = -spec.shape.rotation;${effects}
    }
  }`
    : '';

/** Line height on text nodes — PIXELS (dump v1.3) or PERCENT (CSS ratios). */
const lineHeightRuntime = (has: boolean): string =>
  has
    ? `
    if (typeof spec.lineHeight === 'number') node.lineHeight = { unit: 'PIXELS', value: spec.lineHeight };
    else if (spec.lineHeight && typeof spec.lineHeight === 'object' && typeof spec.lineHeight.value === 'number') {
      node.lineHeight = { unit: spec.lineHeight.unit === 'PERCENT' ? 'PERCENT' : 'PIXELS', value: spec.lineHeight.value };
    }`
    : '';

/** dump v1.2 single DROP_SHADOW as a native effect (applyFrameSpec tail). */
const shadowRuntime = (has: boolean): string =>
  has
    ? `
  if (spec.dropShadow) {
    // Single DROP_SHADOW (dump v1.2 box-shadow grammar) as a native effect.
    const s8 = spec.dropShadow.color.replace('#', '');
    node.effects = [{
      type: 'DROP_SHADOW',
      color: {
        r: parseInt(s8.slice(0, 2), 16) / 255,
        g: parseInt(s8.slice(2, 4), 16) / 255,
        b: parseInt(s8.slice(4, 6), 16) / 255,
        a: s8.length === 8 ? parseInt(s8.slice(6, 8), 16) / 255 : 1,
      },
      offset: { x: spec.dropShadow.x, y: spec.dropShadow.y },
      radius: spec.dropShadow.radius,
      spread: spec.dropShadow.spread || 0,
      visible: true,
      blendMode: 'NORMAL',
    }];
  }`
    : '';

/** v15 (S4/matrix a.1): full shadow stack — DROP_SHADOW + INNER_SHADOW list
 *  (applyFrameSpec tail, conditional emission — the golden discipline). */
const effectStackRuntime = (has: boolean): string =>
  has
    ? `
  if (spec.effectStack) {
    // v15: full box-shadow stack — multi-layer + inset as native effects.
    node.effects = spec.effectStack.map((e) => ({
      type: e.inner ? 'INNER_SHADOW' : 'DROP_SHADOW',
      color: { r: e.color.r, g: e.color.g, b: e.color.b, a: e.color.a === undefined ? 1 : e.color.a },
      offset: { x: e.x, y: e.y },
      radius: e.radius,
      spread: e.spread || 0,
      visible: true,
      blendMode: 'NORMAL',
    }));
  }`
    : '';

/** v15 (S4/matrix a.3): linear-gradient background layer as a native
 *  GRADIENT_LINEAR paint appended over the fill (CSS top layer = Figma last
 *  paint — the documented order inversion). Runs AFTER lits so a literal
 *  fill/clear never tramples the gradient layer. */
const gradientRuntime = (has: boolean): string =>
  has
    ? `
  if (spec.gradient) {
    // CSS angle: 0deg = to top, clockwise. Unit-square gradientTransform.
    const ga = ((spec.gradient.angle - 90) * Math.PI) / 180;
    const gc = Math.cos(ga), gs = Math.sin(ga);
    const paint = {
      type: 'GRADIENT_LINEAR',
      gradientTransform: [[gc, gs, (1 - gc - gs) / 2], [-gs, gc, (1 + gs - gc) / 2]],
      gradientStops: spec.gradient.stops.map((st) => ({ position: st.position, color: { r: st.color.r, g: st.color.g, b: st.color.b, a: st.color.a === undefined ? 1 : st.color.a } })),
    };
    const base = node.fills === figma.mixed ? [] : (node.fills || []);
    node.fills = base.concat([paint]);
  }`
    : '';

/** v15 (S4/matrix a.8): flex-wrap → native layoutWrap (auto-layout only).
 *
 *  HORIZONTAL-ONLY, AND FIGMA THROWS OTHERWISE. The Plugin API states it
 *  plainly: layoutWrap "can only be set on layers with layoutMode ===
 *  'HORIZONTAL'. Setting it on layers without this property will throw an
 *  Error." This line had no guard from v15 until an adversarial probe replayed
 *  a compiled script and got exactly that throw. `layout: { direction:
 *  'column', wrap: true }` is legal CSS AND schema-valid (both are independent
 *  optional fields, and a `layoutByProp` column override merged over a base
 *  `wrap: true` reaches the same spec), so a contract nobody would call
 *  malformed KILLED the whole generate run. CSS wraps a column happily; Figma
 *  has no such thing, so the honest projection is to skip the unsettable field
 *  and SAY SO rather than crash or pretend it applied. */
const wrapRuntime = (has: boolean, columnWrap: boolean): string =>
  has
    ? `${
        columnWrap
          ? `
  // † layout.wrap on a COLUMN stack is NOT applied — Figma's layoutWrap is
  // HORIZONTAL-only and setting it on a column THROWS, so the guard below skips
  // it and the column renders as a single unwrapped stack. CSS wraps a column
  // happily; the canvas has no such thing.`
          : ''
      }
  if (l.wrap && node.layoutMode === 'HORIZONTAL') node.layoutWrap = 'WRAP';`
    : '';

/** NATIVE SLOTS — the whole slot runtime, feature-gated like every other
 *  optional runtime so a slot-less contract emits a byte-identical script.
 *
 *  Pinned by docs/research/native-slots-proposal.md against the receipts in
 *  docs/research/slots-recon-probes.md. Three facts drive every line below:
 *
 *   1. `createSlot()` lives on ComponentNode ONLY (probe 2a) — never on the
 *      SET node, never on a plain frame. The emission unit is the variant
 *      component, so the owner is always at hand.
 *   2. Per-variant `createSlot()` with the same layer name mints a DUPLICATE
 *      property per variant (probe 2c). Unification is mandatory: rebind
 *      every later slot node to the first variant's property id and delete
 *      the duplicate, leaving ONE set-level SLOT property.
 *   3. Instance slot content is stored against the PROPERTY ID, not the slot
 *      node (probe 2d). The emitter's interior rebuild replaces the node —
 *      harmless — but a rebuilt slot bound to a FRESH id orphans every
 *      designer fill. Rebinding to the preserved id RESURRECTS the content
 *      verbatim. `bindSlot` is that rule, and it is the same discipline that
 *      already keeps TEXT/BOOLEAN overrides alive across amends (property
 *      ids are preserved identity).
 *
 *  The dashed "Slot" utility component this replaces is never minted again;
 *  `retireSlotUtility` deletes it only once nothing in the file still points
 *  at it (proposal §6.4). */
const slotRuntime = (has: boolean): string =>
  has
    ? `
// The SLOT property id a slot node is bound to (the \`slotContentId\` key of
// componentPropertyReferences — a native reference kind, not \`mainComponent\`).
function slotKeyOf(slotNode) {
  const refs = slotNode.componentPropertyReferences || {};
  return refs.slotContentId || null;
}

// \`accepts\` → preferredValues, resolved through the SAME identity path the
// nested-instance emission uses. Soft by construction: Figma sorts these to
// the top of the picker and refuses nothing (probe 2b).
function slotPreferredValues(spec) {
  const out = [];
  for (const depRef of spec.slotAccepts || []) {
    // G10 (2026-08-08) — \`accepts\` IS a HARD EMISSION-ORDER DEPENDENCY, and
    // this is where that was discovered: resolving a preferred value needs the
    // accepted component to ALREADY EXIST IN THE FILE, so an accepts list
    // silently defines a build order. The order itself is handled (contracts
    // emit in topological order of the accepts graph, sortByDependencies), but
    // a PARTIAL emission legitimately cannot see outside its own subset — and
    // throwing there made the whole component unshippable over a picker hint.
    // The accepted component is not required for the slot to work: preferredValues
    // is a sort order and Figma refuses nothing (probe 2b). So an unresolvable
    // entry is a NAMED DEFERRAL, never a throw — the slot ships without that one
    // preferred value and says which one and why.
    const target = resolveComponentIdentity(
      { contractId: depRef.contractId, anchorKey: depRef.anchorKey, name: depRef.dep },
      'Slot "' + spec.slotProperty + '" preferred value',
      true,
    );
    if (!target) {
      console.log(
        'slot-accepts-deferred: Slot "' + spec.slotProperty + '" accepts "' + depRef.contractId +
        '", which is not in this file (a partial emission cannot carry a slot constraint pointing ' +
        'outside the emitted subset) — the slot ships WITHOUT that preferred value; emit "' +
        depRef.contractId + '" first to carry it (G10)'
      );
      continue;
    }
    out.push({ type: target.type === 'COMPONENT_SET' ? 'COMPONENT_SET' : 'COMPONENT', key: target.key });
  }
  return out;
}

// THE LOAD-BEARING RULE (probe 2d): one slot property per contract slot,
// shared by every variant's slot node. \`existingKey\` is the PRESERVED
// identity — the id an earlier variant minted (create path) or the id the set
// already carried under this display name (amend path). When the freshly
// minted id differs, the rebuilt node is rebound to the preserved one and the
// duplicate is deleted in the same pass; instance fills keyed to the
// preserved id come back verbatim.
function bindSlot(owner, sl, existingKey) {
  const minted = slotKeyOf(sl.slot);
  if (!minted && !existingKey) {
    throw new Error(
      'Slot "' + sl.spec.slotProperty + '": createSlot() minted no linked SLOT property ' +
      '(componentPropertyReferences.slotContentId absent) — refusing to ship an unbound slot',
    );
  }
  const key = existingKey || minted;
  let rebound = false;
  if (existingKey && minted && minted !== existingKey) {
    sl.slot.componentPropertyReferences = { slotContentId: existingKey };
    owner.deleteComponentProperty(minted);
    rebound = true;
  }
  // Non-destructive on every pass (proposal §3.6): accepts/description edits
  // never touch the id, so they cost no content.
  const preferred = slotPreferredValues(sl.spec);
  const patch = {};
  if (preferred.length > 0) patch.preferredValues = preferred;
  if (sl.spec.slotDescription) patch.description = sl.spec.slotDescription;
  if (Object.keys(patch).length > 0) owner.editComponentProperty(key, patch);
  return { key: key, rebound: rebound };
}

// MIGRATION (proposal §6): a set emitted under the old convention carries an
// INSTANCE_SWAP property (defaulting to the dashed "Slot" utility) where the
// contract now wants a native SLOT. The two property types cannot share an
// id, so the legacy property is retired — and every instance that OVERRODE
// it is named, because a swap override is an instance and a slot fill is a
// child subtree: the transfer is not automatic, and a silent drop would take
// a designer's choice with it.
async function strandedSwapOverrides(legacyKey, legacyDefault) {
  const out = [];
  for (const page of figma.root.children) {
    for (const inst of page.findAll((n) => n.type === 'INSTANCE')) {
      let props = {};
      try { props = inst.componentProperties || {}; } catch (e) { degrade('FC-RT-INSTANCE-PROPS-UNREADABLE', inst, 'componentProperties unreadable; this instance was not checked for stranded swap overrides', e); continue; }
      const def = props[legacyKey];
      if (!def || def.value === undefined || def.value === null) continue;
      if (String(def.value) === String(legacyDefault)) continue;
      let chosen = String(def.value);
      try {
        const node = await figma.getNodeByIdAsync(String(def.value));
        if (node && node.name) chosen = node.name;
      } catch (e) { degrade('FC-RT-SWAP-MAIN-MISSING', inst, 'the swapped main component could not be resolved by id; reported by id, not by name', e); }
      out.push(inst.name + ' (' + inst.id + ') → ' + chosen);
    }
  }
  return out;
}

async function migrateLegacySlotProperty(owner, legacyKey, legacyDef, name, report) {
  const stranded = await strandedSwapOverrides(legacyKey, legacyDef.defaultValue);
  owner.deleteComponentProperty(legacyKey);
  report.migratedSlots = (report.migratedSlots || []).concat([name]);
  if (stranded.length > 0) {
    report.strandedSwapOverrides = (report.strandedSwapOverrides || []).concat(stranded);
  }
}

function findSlotUtility() {
  for (const page of figma.root.children) {
    const hit = page.findOne((n) => n.type === 'COMPONENT' && n.name === 'Slot');
    if (hit) return hit;
  }
  return null;
}

// Proposal §6.4: the utility component goes LAST, and only when nothing in
// the file still points at it. Refusing to delete is reported with its
// reason — a stranded utility is a fact, not a failure.
function retireSlotUtility() {
  const util = findSlotUtility();
  if (!util) return null;
  for (const t of allSyncTargets()) {
    let defs = {};
    try { defs = t.componentPropertyDefinitions || {}; } catch (e) { defs = {}; degrade('FC-RT-PROP-DEFS-UNREADABLE', t, 'componentPropertyDefinitions unreadable; slot-utility references on this target were not checked', e); }
    for (const k of Object.keys(defs)) {
      const d = defs[k];
      if (d && d.type === 'INSTANCE_SWAP' && String(d.defaultValue) === util.id) {
        return { retired: false, reason: 'INSTANCE_SWAP property "' + k.split('#')[0] + '" on "' + t.name + '" still defaults to the Slot utility' };
      }
    }
  }
  for (const page of figma.root.children) {
    const live = page.findOne((n) => n.type === 'INSTANCE' && n.name === 'Slot');
    if (live) return { retired: false, reason: 'a "Slot" utility instance is still placed on page "' + page.name + '"' };
  }
  util.remove();
  return { retired: true };
}
`
    : '';

/** v15 (S4/matrix a.2/a.6/a.9): declared text facts with native fields —
 *  letterSpacing, textCase, textDecoration, textAlignHorizontal, fontName
 *  family (first stack entry; Inter stands when unavailable — named limit),
 *  textTruncation. Conditional emission keeps unchanged contracts
 *  byte-identical. */
const textExtrasRuntime = (has: boolean): string =>
  has
    ? `
    if (spec.fontFamily) {
      // PER-FAMILY STYLE SPELLING. The compiled style name comes from
      // FONT_STYLE_BY_WEIGHT, which is spelled Inter's way ("Semi Bold",
      // "Extra Light"). Other families spell the same face WITHOUT the space
      // — IBM Plex Sans ships "SemiBold", "ExtraLight" — so the Inter-spelled
      // load THROWS and the node silently keeps the Inter fallback assigned
      // above. That is a SUBSTITUTION, not a failure: nothing was logged,
      // nothing was refused, and the canvas rendered a different typeface at
      // different advance widths (altitude heading 194px of Inter Semi Bold
      // where IBM Plex Sans SemiBold is 185px).
      //
      // A space-free retry was tried on 2026-08-08 and REVERTED because the
      // then-pinned references were CONTRACT renders made by a harness that
      // loaded no @font-face, so the truer canvas font scored WORSE. That
      // premise is dead: the references are now the real library renders
      // (extract/computed/out/<lane>/<comp>/orig-shots/, committed by
      // run.ts --keep-originals) and the capture harness loads the library's
      // own faces (cfg.fonts). Truer is now also closer.
      //
      // The fallback is kept — a family Figma does not have at all must still
      // draw something — but it is no longer SILENT: an unresolved style is
      // named on the console with a stable code.
      const wantStyle = spec.fontStyle || 'Medium';
      const styleCandidates = [wantStyle];
      const tightStyle = wantStyle.split(' ').join('');
      if (tightStyle !== wantStyle) styleCandidates.push(tightStyle);
      let fontResolved = false;
      for (let i = 0; i < styleCandidates.length; i++) {
        try {
          await figma.loadFontAsync({ family: spec.fontFamily, style: styleCandidates[i] });
          node.fontName = { family: spec.fontFamily, style: styleCandidates[i] };
          fontResolved = true;
          break;
        } catch (e) { /* a RETRY, not a swallow: the next candidate is this family's own spelling of the same face; the final outcome is named below */ }
      }
      if (!fontResolved) {
        console.warn(
          'FC-FONT-STYLE-UNRESOLVED: ' + spec.fontFamily + ' / ' + wantStyle +
          ' is not available in this file (tried ' + styleCandidates.join(', ') +
          ') — Inter ' + wantStyle + ' stands in, so the glyph metrics are NOT the library ones',
        );
        degrade('FC-FONT-STYLE-UNRESOLVED', node, spec.fontFamily + ' / ' + wantStyle + ' is not available in this file (tried ' + styleCandidates.join(', ') + '); Inter ' + wantStyle + ' stands in, so the glyph metrics are NOT the library ones');
      }
    }
    if (typeof spec.letterSpacing === 'number') node.letterSpacing = { unit: 'PIXELS', value: spec.letterSpacing };
    if (spec.textCase) node.textCase = spec.textCase;
    if (spec.textDecoration) node.textDecoration = spec.textDecoration;
    if (spec.textAlignH) node.textAlignHorizontal = spec.textAlignH;
    if (spec.textTruncation) { try { node.textTruncation = 'ENDING'; } catch (e) { degrade('FC-RT-TRUNCATION-REFUSED', node, 'textTruncation ENDING refused (older Plugin API); the declared ellipsis does not draw', e); } }`
    : '';

/** A2 grid — the GRID runtime, feature-gated so grid-less corpora emit
 *  byte-identical scripts (the golden discipline). Two halves: applyGridFrame
 *  runs inside applyFrameSpec (the probe-pinned DECLARATION order) and
 *  applyGridChildren runs after append (the probe-pinned PLACEMENT order). */
const gridRuntime = (has: boolean): string =>
  has
    ? `
// A2 grid: declaration order is API-pinned (P2: sizes must match the CURRENT
// count — "Grid track sizes must be the same length as the grid column
// count"), so counts are written FIRST, then sizes, then gaps, then flow.
// P10 hazard guard (mode-switch destroys tracks): entering GRID resets the
// canvas to a default 2×2 — safe ONLY because the full declaration is
// rewritten here every time, and applyGridChildren re-verifies the canvas
// holds EXACTLY the declared lists before any placement. Nothing ever relies
// on tracks surviving a mode switch.
function applyGridFrame(node, l) {
  const g = l.grid;
  node.layoutMode = 'GRID';
  node.gridRowCount = g.rows.length;
  node.gridColumnCount = g.columns.length;
  // FC-GRID-HUG-VALUE. READ and WRITE are not symmetric here. P2b observed a
  // HUG track reading back as {type:'HUG', value:1} and this emitter mirrored
  // that shape into the WRITE — but writing {type:'HUG', value:1} makes the
  // API reinterpret the entry as FIXED at that value, so every "fit" track
  // silently became a 1px fixed track (live probe: {type:'HUG'} round-trips
  // as HUG; {type:'HUG', value:1} reads back FIXED, and re-setting it with a
  // value can never recover). HUG is written as the bare type, never valued.
  const trackWrite = (t) => (t.type === 'HUG' ? { type: 'HUG' } : { type: t.type, value: t.value });
  node.gridRowSizes = g.rows.map(trackWrite);
  node.gridColumnSizes = g.columns.map(trackWrite);
  node.gridRowGap = g.rowGap;
  node.gridColumnGap = g.columnGap;
  if (g.flow) node.gridItemsPositioning = g.flow;
  // FC-GRID-ROOT-VSIZE — CLOSED by G8 (2026-08-08). NOT here: see applyGridHug,
  // which runs LAST. primaryAxisSizingMode/counterAxisSizingMode = 'AUTO' (the
  // flex spelling of hug, applied by the caller) are INERT on a GRID frame
  // (GP1b/GP8: they read back HUG while the frame keeps its FIXED size), so a
  // grid frame kept createFrame's FIXED 100 on any unpinned axis. The contract
  // now states the fact — literals width/height "fit-content" — and the ONLY
  // faithful lowering is layoutSizing{Horizontal,Vertical}='HUG', written after
  // resize() and after every child (GP4b: a later resize of a hugged axis
  // silently reverts BOTH the sizing mode and the track list).
}

// G8 — the LAST write on a grid frame. Deliberately separate from
// applyGridFrame: hug must follow resize() and every child append (GP4b), so
// applyGridChildren calls it at its own tail. Hugging an axis that carries an
// {fr} track destroys the ratio silently (GP1/GP5/GP12), so the schema refuses
// that combination BY NAME (grid-hug-flex-axis) and this function asserts it
// rather than trusting the compile step.
function applyGridHug(node, l) {
  const g = l.grid;
  if (!g) return;
  if (g.hugWidth) {
    if (g.columns.some(function (t) { return t.type === 'FLEX'; }))
      throw new Error('grid-hug-flex-axis: refusing to hug the width of a grid whose column tracks contain FLEX — the ratio would be silently normalized to HUG (GP1/GP12)');
    node.layoutSizingHorizontal = 'HUG';
  }
  if (g.hugHeight) {
    if (g.rows.some(function (t) { return t.type === 'FLEX'; }))
      throw new Error('grid-hug-flex-axis: refusing to hug the height of a grid whose row tracks contain FLEX — the ratio would be silently normalized to HUG (GP1/GP5)');
    node.layoutSizingVertical = 'HUG';
  }
}

// A2 grid: children were appended by the caller — now the probe-pinned tail:
// place ALL children (child.setGridChildPosition, the child-side setter, P3)
// BEFORE any span (the occupancy throw) — but placement is a PERMUTATION,
// not a loop, because appendChild already auto-placed every child row-major
// (FC-GRID-APPEND-AUTOPLACE, see below) — then FILL (G3: a placed part fills
// both axes of its cell; fixed channels keep their box; TEXT hugs — the flex
// fence re-proved under grid, P4), then per-child aligns (P3's four-value
// fence). Out-of-flow children are skipped throughout (P13).
function applyGridChildren(parent, spec, built) {
  const l = spec.layout;
  if (!l || l.mode !== 'GRID' || !l.grid) return;
  // P9/P10 declaration guard: Figma absorbs placement overflow by REWRITING
  // gridRowCount (P9) and destroys tracks on mode switch (P10). A mismatch
  // here means the canvas holds a declaration the contract did not make —
  // refuse loudly, never carry the rewrite.
  if (parent.gridRowSizes.length !== l.grid.rows.length || parent.gridColumnSizes.length !== l.grid.columns.length) {
    throw new Error(
      'grid-declaration-rewritten: canvas holds ' + parent.gridRowSizes.length + 'x' + parent.gridColumnSizes.length +
      ' tracks but the contract declared ' + l.grid.rows.length + 'x' + l.grid.columns.length +
      ' (P9 overflow absorption / P10 mode-switch loss) — refusing to carry a write the contract did not make'
    );
  }
  // REJECTED-SETS ROUND (fluent.dialog): a grid child with margins is built
  // INSIDE its "(margin box)" wrapper — the WRAPPER is the node the grid
  // actually parents, and the child-side placement setter throws 'Node is
  // not a grid child' on the inner node. Every placement/sizing/align write
  // below therefore targets the outermost ancestor whose parent IS the grid
  // frame (the wrapper when one exists, the node itself otherwise).
  const gridChildOf = (n) => { let m = n; while (m.parent && m.parent !== parent) m = m.parent; return m; };
  const inFlow = built
    .filter((p) => !p[0].overlay && !p[0].insetOverlay && !p[0].absolute && p[1].layoutPositioning !== 'ABSOLUTE')
    .map((p) => [p[0], gridChildOf(p[1])]);
  const placed = inFlow.filter((p) => p[0].cell);
  if (!l.grid.flow) {
    // FC-GRID-APPEND-AUTOPLACE. appendChild does not park a grid child
    // nowhere — the canvas AUTO-PLACES it row-major into the next free cell
    // (live probe: five appends land (0,0)(0,1)(0,2)(0,3)(1,0)). So by the
    // time this runs every child already OCCUPIES a cell, and a naive
    // one-pass "place them all in contract order" throws P3's occupancy
    // error the moment a target cell is still held by a sibling that has not
    // been moved yet — which the canonical bento hits on its SECOND child.
    // Placement is therefore a PERMUTATION problem, not a loop: repeatedly
    // place every child whose target is free, and when only cycles remain,
    // park one child in a spare cell to break the cycle. Spans stay in the
    // second pass (all children at span 1 while the permutation resolves —
    // the probe-pinned place-before-span rule is what makes that sound).
    const rowCount = l.grid.rows.length;
    const colCount = l.grid.columns.length;
    const cellKey = (r, c) => r + ',' + c;
    const liveOccupancy = () => {
      const m = {};
      for (const p of placed) m[cellKey(p[1].gridRowAnchorIndex, p[1].gridColumnAnchorIndex)] = p;
      return m;
    };
    const moveTo = (p, r, c) => { p[1].setGridChildPosition(r, c); };
    const remaining = placed.slice();
    let guard = remaining.length * remaining.length + remaining.length + 8;
    while (remaining.length > 0) {
      if (guard-- <= 0) {
        throw new Error(
          'grid-placement-unresolvable: could not sequence ' + remaining.length +
          ' grid placement(s) without an occupancy collision (FC-GRID-APPEND-AUTOPLACE guard)'
        );
      }
      const occ = liveOccupancy();
      let moved = false;
      for (let i = remaining.length - 1; i >= 0; i--) {
        const p = remaining[i];
        const t = cellKey(p[0].cell.row, p[0].cell.column);
        const holder = occ[t];
        if (holder && holder !== p) continue; // still blocked by a sibling
        moveTo(p, p[0].cell.row, p[0].cell.column);
        remaining.splice(i, 1);
        moved = true;
      }
      if (moved || remaining.length === 0) continue;
      // Every remaining target is blocked by another remaining child — a
      // permutation CYCLE. Park one of them in a cell nobody wants and that
      // nobody currently holds; the next pass then has a free target.
      const occ2 = liveOccupancy();
      const wanted = {};
      for (const p of remaining) wanted[cellKey(p[0].cell.row, p[0].cell.column)] = true;
      let spare = null;
      for (let r = 0; r < rowCount && !spare; r++) {
        for (let c = 0; c < colCount && !spare; c++) {
          const k = cellKey(r, c);
          if (!occ2[k] && !wanted[k]) spare = { r: r, c: c };
        }
      }
      if (!spare) {
        throw new Error(
          'grid-placement-cycle-no-spare: the declared ' + rowCount + 'x' + colCount +
          ' grid has no free cell to break a placement cycle through — refusing rather than throwing P3 mid-script'
        );
      }
      moveTo(remaining[0], spare.r, spare.c);
    }
    for (const p of placed) {
      if (p[0].cell.rowSpan) p[1].gridRowSpan = p[0].cell.rowSpan;
      if (p[0].cell.columnSpan) p[1].gridColumnSpan = p[0].cell.columnSpan;
    }
  }
  for (const p of inFlow) {
    const cs = p[0], cn = p[1];
    if (cs.type === 'text') continue; // text hugs its glyphs (P4's fence)
    // G8: a child that declares its OWN intrinsic axis keeps it — FILL would
    // silently overwrite the hug applied by that child's own applyGridHug.
    const childGrid = cs.layout && cs.layout.grid ? cs.layout.grid : null;
    // G3′ (2026-08-08, probe GP14) — FILL AND HUG ON THE SAME AXIS IS CIRCULAR.
    // G3's default is that a placed part fills both axes of its cell. On an axis
    // the PARENT hugs, that makes the track's size a function of the child and
    // the child's size a function of the track: Figma resolves the loop by
    // FREEZING whatever box the node already had. Measured live: a hugging
    // two-column root with two FILL slots reported layoutSizingVertical 'HUG'
    // and stayed 640x100; the instant its children stopped filling, the root
    // collapsed to the real content height, and restoring FILL did not undo it.
    // A frozen box is worse than a wrong one — it is a stale box that reads as
    // a measurement. So on a hugged axis the child HUGS (its own content is what
    // the track must measure) and never fills. CSS agrees: against a
    // fit-content track, align-self:stretch resolves to the content size — the
    // track is sized first and the child stretches into the RESULT.
    // A non-auto-layout frame refuses HUG (P4) and keeps its drawn box, which is
    // exactly the right contribution.
    const hugW = !!(l.grid.hugWidth || (childGrid && childGrid.hugWidth));
    const hugH = !!(l.grid.hugHeight || (childGrid && childGrid.hugHeight));
    // REJECTED-SETS ROUND (fluent.dialog actions): G3's FILL is stretch-by-
    // ABSENCE — a child that CARRIES an alignment on an axis resolves to its
    // content size there (CSS: justify-self/align-self beat the stretch
    // default), so an aligned axis HUGS and never fills. Filling it drew the
    // dialog's Close button 267px wide (modal) and collapsed it to 0 inside
    // the hugging non-modal grid (the FILL-in-HUG degenerate cycle).
    const alignedW = !!(cs.cell && cs.cell.hAlign);
    const alignedH = !!(cs.cell && cs.cell.vAlign);
    if (!cs.fixedWidth && !(cs.lits && cs.lits.width !== undefined) && !hugW && !alignedW) {
      try { cn.layoutSizingHorizontal = 'FILL'; } catch (e) { degrade('FC-RT-GRID-SIZING-REFUSED', cn, 'layoutSizingHorizontal FILL refused; the grid child keeps its drawn width', e); }
    } else if ((l.grid.hugWidth || alignedW) && !cs.fixedWidth && !(cs.lits && cs.lits.width !== undefined)) {
      try { cn.layoutSizingHorizontal = 'HUG'; } catch (e) { degrade('FC-RT-GRID-SIZING-REFUSED', cn, 'layoutSizingHorizontal HUG refused; the grid child keeps its drawn width', e); }
    }
    if (!cs.fixedHeight && !(cs.lits && cs.lits.height !== undefined) && !hugH && !alignedH) {
      try { cn.layoutSizingVertical = 'FILL'; } catch (e) { degrade('FC-RT-GRID-SIZING-REFUSED', cn, 'layoutSizingVertical FILL refused; the grid child keeps its drawn height', e); }
    } else if ((l.grid.hugHeight || alignedH) && !cs.fixedHeight && !(cs.lits && cs.lits.height !== undefined)) {
      try { cn.layoutSizingVertical = 'HUG'; } catch (e) { degrade('FC-RT-GRID-SIZING-REFUSED', cn, 'layoutSizingVertical HUG refused; the grid child keeps its drawn height', e); }
    }
  }
  for (const p of placed) {
    if (p[0].cell.hAlign) p[1].gridChildHorizontalAlign = p[0].cell.hAlign;
    if (p[0].cell.vAlign) p[1].gridChildVerticalAlign = p[0].cell.vAlign;
  }
  // G8 — LAST, after resize and after every child (GP4b).
  applyGridHug(parent, spec.layout);
}
`
    : '';
const gridChildrenCall = (has: boolean, args: string): string =>
  has ? `
  applyGridChildren(${args});` : '';

/** v9 shape placement: layoutPositioning ABSOLUTE + constraints + exact
 *  offsets vs the parent box, AFTER append (mirrors applyOverlay). */
const absoluteRuntime = (has: boolean): string =>
  has
    ? `
// v9 shape placement: exact offsets vs the parent box, after append.
function applyShapeAbsolute(parent, childNode, childSpec) {
  if (!childSpec.absolute) return;
  try {
    // CSS overflow:visible — unclip parent AND FRAME/COMPONENT ancestors so
    // overhanging absolute thumbs (Slider left:-10) aren't half-cut by a
    // grandparent track that still defaults to clipsContent:true.
    for (let n = parent; n && 'clipsContent' in n; n = n.parent) {
      if (n.type === 'COMPONENT_SET' || n.type === 'PAGE' || n.type === 'SECTION') break;
      if (dsDeclaredClipStops(n)) break;
      n.clipsContent = false;
      dsOverhangUnclip.add(n.id);
    }
    childNode.layoutPositioning = 'ABSOLUTE';
    const a = childSpec.absolute;
    // absolute-position round: STRETCH pins BOTH sides — size derives from
    // the parent box minus the offsets (rail: left 0 + right 0, fixed height).
    if (a.h === 'STRETCH' || a.v === 'STRETCH') {
      const w2 = a.h === 'STRETCH' ? Math.max(parent.width - (a.left || 0) - (a.right || 0), 0.01) : childNode.width;
      const h2 = a.v === 'STRETCH' ? Math.max(parent.height - (a.top || 0) - (a.bottom || 0), 0.01) : childNode.height;
      childNode.resize(w2, h2);
    }
    childNode.constraints = {
      horizontal: a.h === 'STRETCH' ? 'STRETCH' : a.h === 'MAX' ? 'MAX' : a.h === 'CENTER' ? 'CENTER' : 'MIN',
      vertical: a.v === 'STRETCH' ? 'STRETCH' : a.v === 'MAX' ? 'MAX' : a.v === 'CENTER' ? 'CENTER' : 'MIN',
    };
    if (a.h === 'STRETCH' || a.v === 'STRETCH') {
      childNode.x = a.h === 'STRETCH' ? (a.left || 0) : childNode.x;
      childNode.y = a.v === 'STRETCH' ? (a.top || 0) : childNode.y;
      if (a.h !== 'STRETCH' && a.left !== undefined) childNode.x = a.left;
      if (a.h !== 'STRETCH' && a.right !== undefined) childNode.x = parent.width - a.right - childNode.width;
      if (a.v !== 'STRETCH' && a.top !== undefined) childNode.y = a.top;
      if (a.v !== 'STRETCH' && a.bottom !== undefined) childNode.y = parent.height - a.bottom - childNode.height;
      return;
    }
    const w = childSpec.shape ? childSpec.shape.width : childNode.width;
    const h = childSpec.shape ? childSpec.shape.height : childNode.height;
    // Center of the intrinsic box in parent coordinates (MIN pins left/top,
    // MAX pins right/bottom, CENTER centers):
    const cx = a.left !== undefined ? a.left + w / 2 : a.right !== undefined ? parent.width - a.right - w / 2 : parent.width / 2;
    const cy = a.top !== undefined ? a.top + h / 2 : a.bottom !== undefined ? parent.height - a.bottom - h / 2 : parent.height / 2;
    // Rotation moves the measured box — correct against the actual bounds.
    const bb = childNode.absoluteBoundingBox;
    const pb = parent.absoluteBoundingBox;
    if (bb && pb) {
      childNode.x += cx - bb.width / 2 - (bb.x - pb.x);
      childNode.y += cy - bb.height / 2 - (bb.y - pb.y);
    } else {
      childNode.x = cx - w / 2;
      childNode.y = cy - h / 2;
    }
  } catch (e) { degrade('FC-RT-OUT-OF-FLOW-PLACEMENT-REFUSED', childNode, 'the out-of-flow placement was refused (parent not auto-layout); the child stayed in flow', e); }
}
`
    : '';
const absoluteCall = (has: boolean, args: string): string =>
  has ? `
    applyShapeAbsolute(${args});` : '';

/** B-3 finding 5: inset-0 overlay lowering — layoutPositioning ABSOLUTE,
 *  x/y 0, STRETCH/STRETCH constraints, sized to the parent, inserted BEHIND
 *  the in-flow siblings (index 0). Runs at the END of the per-child block so
 *  the empty-frame FILL default (which an out-of-flow node must not keep)
 *  is overridden, and only after appendChild (ABSOLUTE requires an
 *  auto-layout parent). Conditional emission — the golden discipline. */
const insetOverlayRuntime = (has: boolean): string =>
  has
    ? `
// B-3 finding 5: an inset-0 overlay part (top/right/bottom/left all 0) is
// lowered out of flow — ABSOLUTE, stretched to the parent, BEHIND the
// in-flow siblings — matching the declared anatomy and the HTML render.
function applyInsetOverlay(parent, childNode, childSpec) {
  if (!childSpec.insetOverlay) return;
  try {
    // CSS overflow:visible — unclip parent AND FRAME/COMPONENT ancestors so
    // overhanging thumbs/rails aren't clipped by a grandparent track
    // (Astryx Slider semi-circle residual under default clipsContent:true).
    for (let n = parent; n && 'clipsContent' in n; n = n.parent) {
      if (n.type === 'COMPONENT_SET' || n.type === 'PAGE' || n.type === 'SECTION') break;
      if (dsDeclaredClipStops(n)) break;
      n.clipsContent = false;
      dsOverhangUnclip.add(n.id);
    }
    // Round 5f (B5E finding 3): only a childless BACKDROP overlay (an
    // inset:0 fill layer — TextField's backdrop) lowers BEHIND the in-flow
    // siblings (index 0). A CONTENT overlay that carries glyphs (the Checkbox
    // check, the RadioButton dot, a remove button) must stay ON TOP at its
    // natural post-backdrop index — else the opaque backdrop sibling paints
    // over the glyph (the checkbox backdrop-over-glyph z-order the owner saw,
    // previously hand-corrected on canvas each re-amend).
    // Absolute-position round: the backdrop shove applies ONLY to true
    // inset-0 backdrops (no offsets). An OFFSET overlay (Slider's rail/track
    // at their y positions) keeps its compile-time paint order — the shove
    // was inverting rail/track stacking.
    if ((!childNode.children || childNode.children.length === 0) && !childSpec.insetOffsets) {
      parent.insertChild(0, childNode);
    }
    childNode.layoutPositioning = 'ABSOLUTE';
    const o = childSpec.insetOffsets || { top: 0, right: 0, bottom: 0, left: 0 };
    // Astryx Slider thumb finding: inset overlays with fixedWidth/fixedHeight
    // (20×20 disk) must NOT STRETCH into a hug-zero display:contents parent —
    // that collapsed thumbs into 1px lines / semi-circles. Keep intrinsic size.
    const fw = childSpec.fixedWidth && typeof childSpec.fixedWidth.px === 'number' ? childSpec.fixedWidth.px : null;
    const fh = childSpec.fixedHeight && typeof childSpec.fixedHeight.px === 'number' ? childSpec.fixedHeight.px : null;
    if (fw != null || fh != null) {
      childNode.constraints = {
        horizontal: fw != null ? 'MIN' : 'STRETCH',
        vertical: fh != null ? 'MIN' : 'STRETCH',
      };
      childNode.x = o.left;
      childNode.y = o.top;
      childNode.resize(
        Math.max(1, fw != null ? fw : (parent.width - o.left - o.right)),
        Math.max(1, fh != null ? fh : (parent.height - o.top - o.bottom)),
      );
    } else {
      childNode.constraints = { horizontal: 'STRETCH', vertical: 'STRETCH' };
      childNode.x = o.left;
      childNode.y = o.top;
      childNode.resize(
        Math.max(1, parent.width - o.left - o.right),
        Math.max(1, parent.height - o.top - o.bottom),
      );
    }
  } catch (e) { degrade('FC-RT-OUT-OF-FLOW-PLACEMENT-REFUSED', childNode, 'the out-of-flow placement was refused (parent not auto-layout); the child stayed in flow', e); }
}
`
    : '';
const insetOverlayCall = (has: boolean, args: string): string =>
  has ? `
    applyInsetOverlay(${args});` : '';

/** ROUND 6 (Dialog live finding) — OUT-OF-FLOW RESIZE POST-PASS.
 *
 *  An out-of-flow child was sized against the parent box AS IT STOOD WHEN
 *  THAT CHILD WAS APPENDED. For a hug-height auto-layout parent the first
 *  child is appended into a parent that is still ~0 tall, so Dialog's
 *  `inset: 0` backdrop — the modal scrim, always child #0 so it paints
 *  behind — was resized to a few pixels and stayed there while the rest of
 *  the content grew the parent around it. That is the SQUAT GREY BAND the
 *  live paste showed: full width, wrong height, paper overlapping it.
 *  STRETCH constraints do not rescue it — Figma applies those when a frame
 *  is RESIZED, not when auto-layout content grows it.
 *
 *  Re-sizing every inset-0 / STRETCH-absolute child against the parent's
 *  FINAL box after the whole subtree is appended is idempotent: for a parent
 *  whose box was already established the numbers are identical, so every
 *  prior contract's canvas is unchanged. */
const outOfFlowResizeRuntime = (has: boolean): string =>
  has
    ? `
function resizeOutOfFlow(parent, built) {
  for (const pair of built) {
    const childSpec = pair[0], childNode = pair[1];
    try {
      if (childSpec.insetOverlay) {
        const o = childSpec.insetOffsets || { top: 0, right: 0, bottom: 0, left: 0 };
        childNode.x = o.left || 0;
        childNode.y = o.top || 0;
        const fw = childSpec.fixedWidth && typeof childSpec.fixedWidth.px === 'number' ? childSpec.fixedWidth.px : null;
        const fh = childSpec.fixedHeight && typeof childSpec.fixedHeight.px === 'number' ? childSpec.fixedHeight.px : null;
        if (fw != null || fh != null) {
          childNode.resize(
            Math.max(1, fw != null ? fw : (parent.width - (o.left || 0) - (o.right || 0))),
            Math.max(1, fh != null ? fh : (parent.height - (o.top || 0) - (o.bottom || 0))),
          );
        } else {
          childNode.resize(
            Math.max(1, parent.width - (o.left || 0) - (o.right || 0)),
            Math.max(1, parent.height - (o.top || 0) - (o.bottom || 0)),
          );
        }
      } else if (childSpec.absolute && (childSpec.absolute.h === 'STRETCH' || childSpec.absolute.v === 'STRETCH')) {
        const a = childSpec.absolute;
        childNode.resize(
          a.h === 'STRETCH' ? Math.max(parent.width - (a.left || 0) - (a.right || 0), 0.01) : childNode.width,
          a.v === 'STRETCH' ? Math.max(parent.height - (a.top || 0) - (a.bottom || 0), 0.01) : childNode.height,
        );
        if (a.h === 'STRETCH') childNode.x = a.left || 0;
        if (a.v === 'STRETCH') childNode.y = a.top || 0;
      }
    } catch (e) { degrade('FC-RT-ABSOLUTE-PLACEMENT-REFUSED', childNode, 'absolute placement was refused (parent not auto-layout); the child stayed in flow', e); }
  }
}
`
    : '';
const outOfFlowResizeCall = (has: boolean, args: string): string =>
  has ? `
  resizeOutOfFlow(${args});` : '';

/** Nested absolute/inset unclip runs inside buildNode BEFORE the parent
 *  frame is appended to ITS parent — so a grandparent track (Slider) would
 *  still clip. After append, propagate clipsContent:false upward.
 *
 *  ONLY for a child an OVERHANG actually unclipped. The trigger used to be
 *  `childNode.clipsContent === false`, which is true of very nearly every
 *  frame — CSS overflow defaults to visible, so applyFrameSpec writes
 *  clipsContent=false on all of them — meaning this walked to the root and
 *  unclipped every ancestor for any ordinary child, in any contract that
 *  carried a single absolute or inset overlay anywhere. That is far wider than
 *  the comment above claims, and it is why the first FC-OVERFLOW-CLIP-LOST
 *  build refused on MUI Checkbox: nothing overhung the clip-declaring node,
 *  an ordinary unclipped child simply walked past it. dsOverhangUnclip records
 *  the ancestors applyShapeAbsolute/applyInsetOverlay actually unclipped, so
 *  the propagation carries the overhang fact instead of re-deriving it from a
 *  default. */
const overflowPropagateRuntime = (has: boolean): string =>
  has
    ? `
function propagateOverflowVisible(childNode, parent) {
  if (!childNode || !('clipsContent' in childNode) || childNode.clipsContent !== false) return;
  if (!dsOverhangUnclip.has(childNode.id)) return;
  for (let n = parent; n && 'clipsContent' in n; n = n.parent) {
    if (n.type === 'COMPONENT_SET' || n.type === 'PAGE' || n.type === 'SECTION') break;
    if (dsDeclaredClipStops(n)) break;
    n.clipsContent = false;
    dsOverhangUnclip.add(n.id);
  }
}
`
    : '';
const overflowPropagateCall = (has: boolean, child: string, parent: string): string =>
  has ? `
    propagateOverflowVisible(${child}, ${parent});` : '';

/** v14 literals: literal-fidelity channel application (applyFrameSpec tail).
 *  Emitted ONLY when a compiled spec carries lits — contracts without
 *  literals emit byte-identical scripts (the golden discipline, same as
 *  shapeRuntime/opacityRuntime). */
/** R7 LITERAL INK: the TEXT node's literal fill — a plain SOLID paint, the
 *  text twin of lits.fillColor. Emitted only when a spec carries it. */
const textFillLitRuntime = (has: boolean): string =>
  has
    ? `
    else if (spec.textFillLit) node.fills = [{ type: 'SOLID', color: { r: spec.textFillLit.r, g: spec.textFillLit.g, b: spec.textFillLit.b }, opacity: spec.textFillLit.a === undefined ? 1 : spec.textFillLit.a }];`
    : '';

const litsRuntime = (has: boolean, hasStrokeColor = false): string =>
  has
    ? `
  if (spec.lits) {
    // v14 literals: no variable to bind — plain values, compile-parsed.
    const li = spec.lits;
    if (li.paddingTop !== undefined) node.paddingTop = li.paddingTop;
    if (li.paddingBottom !== undefined) node.paddingBottom = li.paddingBottom;
    if (li.paddingLeft !== undefined) node.paddingLeft = li.paddingLeft;
    if (li.paddingRight !== undefined) node.paddingRight = li.paddingRight;
    if (li.itemSpacing !== undefined) node.itemSpacing = li.itemSpacing;
    if (li.radius !== undefined) node.cornerRadius = li.radius;
    if (li.strokeWeight !== undefined) node.strokeWeight = li.strokeWeight;
    if (li.minWidth !== undefined) { try { node.minWidth = li.minWidth; } catch (e) { degrade('FC-RT-MIN-SIZE-REFUSED', node, 'minWidth ' + li.minWidth + ' refused (needs auto-layout); the literal min-width does not draw', e); } }
    if (li.minHeight !== undefined) { try { node.minHeight = li.minHeight; } catch (e) { degrade('FC-RT-MIN-SIZE-REFUSED', node, 'minHeight ' + li.minHeight + ' refused (needs auto-layout); the literal min-height does not draw', e); } }
    // #60 fix 1 (fillClear precedence): a spec-carried fill is NEVER
    // trampled — fillClear only clears when no fill was spec'd. The compile
    // side already drops fillClear when a fill binding exists (applyLiterals);
    // this runtime guard makes the emitted script safe even for hand-fed
    // specs carrying both.
    if (li.fillClear && !spec.fill) node.fills = [];
    else if (li.fillColor) node.fills = [{ type: 'SOLID', color: { r: li.fillColor.r, g: li.fillColor.g, b: li.fillColor.b }, opacity: li.fillColor.a === undefined ? 1 : li.fillColor.a }];
    if (li.radiusCorners) {
      const rc = li.radiusCorners;
      if (rc.tl !== undefined) node.topLeftRadius = rc.tl;
      if (rc.tr !== undefined) node.topRightRadius = rc.tr;
      if (rc.bl !== undefined) node.bottomLeftRadius = rc.bl;
      if (rc.br !== undefined) node.bottomRightRadius = rc.br;
    }
${hasStrokeColor ? `    if (li.strokeColor) node.strokes = [{ type: 'SOLID', color: { r: li.strokeColor.r, g: li.strokeColor.g, b: li.strokeColor.b }, opacity: li.strokeColor.a === undefined ? 1 : li.strokeColor.a }];\n` : ''}    if (li.strokeSides) {
      const sw = li.strokeSides;
      // ELLIPSE/LINE expose strokeWeight only — per-side props throw
      // "Cannot add property strokeTopWeight, object is not extensible"
      // (Tailwind ToggleSwitch thumb live finding, Wave B.1).
      if ('strokeTopWeight' in node) {
        if (sw.top !== undefined) node.strokeTopWeight = sw.top;
        if (sw.right !== undefined) node.strokeRightWeight = sw.right;
        if (sw.bottom !== undefined) node.strokeBottomWeight = sw.bottom;
        if (sw.left !== undefined) node.strokeLeftWeight = sw.left;
      } else {
        const w = sw.top !== undefined ? sw.top : (sw.right !== undefined ? sw.right : (sw.bottom !== undefined ? sw.bottom : sw.left));
        if (w !== undefined) node.strokeWeight = w;
      }
    }
    if (li.width !== undefined || li.height !== undefined) {
      node.resize(li.width !== undefined ? li.width : node.width, li.height !== undefined ? li.height : node.height);
      // GRID's primary axis is HORIZONTAL (GP1b: primaryAxisSizingMode='AUTO'
      // reads back as layoutSizingHorizontal 'HUG'), like a HORIZONTAL frame.
      const gm = (spec.layout || { mode: 'HORIZONTAL' }).mode;
      const horizontalIsPrimary = gm === 'HORIZONTAL' || gm === 'GRID';
      if (li.width !== undefined) {
        if (horizontalIsPrimary) node.primaryAxisSizingMode = 'FIXED'; else node.counterAxisSizingMode = 'FIXED';
      }
      if (li.height !== undefined) {
        if (horizontalIsPrimary) node.counterAxisSizingMode = 'FIXED'; else node.primaryAxisSizingMode = 'FIXED';
      }
    }
  }`
    : '';

/** Contract → the single-component sync script text. #60 fix 2: the emitted
 *  runtime is AMEND-CAPABLE — it shares the batch sync runtime (syncOne →
 *  amendSet / amendComponent), so re-running a committed per-component
 *  script reconciles an existing component (set) IN PLACE via the identity
 *  markers instead of returning create-only `{ skipped }` (Phase B-2 named
 *  finding 1). The minted-variable preamble and the referee validation are
 *  unchanged from the create-only emitter. */
function buildComponentScript(
  contract: Contract,
  byId: Map<string, Contract>,
  fileKeyOverride?: string,
  mintedTokens?: Record<string, unknown>,
): string {
  // The referee, same wording as emitReact: an invalid contract refuses BY
  // NAME on the canvas surface too. The gauntlet census found this was the
  // one emitter that never called validateContract — every referee-violating
  // set still emitted a sync script while react/html/react-inline refused.
  const refereeErrors: string[] = [];
  validateContract(contract, byId, refereeErrors, input.icons);
  if (refereeErrors.length > 0) {
    throw new Error(
      `Refused — ${refereeErrors.length} contract violation(s):\n${refereeErrors.map((e) => `  - ${e}`).join('\n')}`,
    );
  }
  const data = compileComponentData(contract, byId);
  return buildSyncScript([data], fileKeyOverride ?? contract.bindings.figma.anchors.fileKey, {
    header: `// GENERATED by scripts/generate-figma.ts — DO NOT EDIT.
// Source of truth: contracts/${contract.id.replace(/^[^.]+\./, '')}.contract.json (${contract.id} v${contract.version})
// Amend-capable (#60): an existing component (set) carrying our identity
// marker is reconciled IN PLACE (same node id + key); unchanged specs skip.`,
    preamble: mintedPreamble(mintedTokens, resolveLiteral),
    variableCollection,
  });
}


// ---------------------------------------------------------------------------
// Batch script emission — several components per script (minified specs),
// same runtime as the per-component scripts but parameterized and looped.
// Existing components are skipped, so batches are safe to re-run.
// ---------------------------------------------------------------------------

function buildBatchScript(datas: ComponentData[], fileKey: string | null): string {
  return buildSyncScript(datas, fileKey, {
    header: `// GENERATED by scripts/generate-figma.ts — DO NOT EDIT.
// Batch sync: ${datas.map((d) => d.setName).join(', ')} (unchanged components skip; changed ones amend in place).`,
    preamble: '',
  });
}

/** The ONE sync runtime (create + in-place amend), shared by the batch
 *  script and (#60 fix 2) every per-component script. `preamble` carries the
 *  minted-variable upsert for playground per-component emissions. */
function buildSyncScript(
  datas: ComponentData[],
  fileKey: string | null,
  opts: { header: string; preamble: string; variableCollection?: string },
): string {
  const hasOpacity = datas.some(dataHasOpacity);
  const hasShape = datas.some((d) => dataSome(d, (x) => x.shape !== undefined));
  // Golden-guard conditional (round 2 iteration 4): the arc runtime lines are
  // emitted ONLY when some spec carries shape.arc — arc-less corpora (all
  // seven committed libraries) emit byte-identical scripts.
  const hasArc = datas.some((d) => dataSome(d, (x) => x.shape !== undefined && (x.shape as { arc?: unknown }).arc !== undefined));
  const hasShadow = datas.some((d) => dataSome(d, (x) => x.dropShadow !== undefined));
  const hasLineHeight = datas.some((d) => dataSome(d, (x) => x.lineHeight !== undefined));
  const hasAbsolute = datas.some((d) => dataSome(d, (x) => x.absolute !== undefined));
  const hasLits = datas.some((d) => dataSome(d, (x) => x.lits !== undefined));
  // D2: literal stroke COLOUR — feature-gated like every other lits field so
  // a contract that never carries one emits a byte-identical script.
  const hasLitStrokeColor = datas.some((d) => dataSome(d, (x) => x.lits?.strokeColor !== undefined));
  // R7 LITERAL INK: the runtime line is emitted only when a spec carries it,
  // so every existing emission stays byte-identical.
  const hasTextFillLit = datas.some((d) => dataSome(d, (x) => x.textFillLit !== undefined));
  // …and the SHAPE branch's literal ring/weight/radius application.
  const hasShapeLits = datas.some((d) =>
    dataSome(d, (x) => x.shape !== undefined && (x.lits?.strokeColor !== undefined || x.lits?.strokeWeight !== undefined || x.lits?.strokeSides !== undefined || x.lits?.radius !== undefined)),
  );
  // A2 grid: the whole GRID runtime (declaration + placement passes) is
  // feature-gated — grid-less corpora emit byte-identical scripts.
  const hasGrid = datas.some((d) => dataSome(d, (x) => x.layout?.mode === 'GRID'));
  // NATIVE SLOTS: the slot runtime (createSlot + unification + the amend
  // rebind + the legacy-INSTANCE_SWAP migration) is feature-gated like the
  // grid runtime — a slot-less contract emits a byte-identical script and
  // never carries a line about slots.
  const hasSlot = datas.some((d) => dataSome(d, (x) => x.type === 'slot'));
  // FC-SLOT-BIRTH-BOX generalized: the 100x100 birth box is NOT a slot fact.
  // It survives on ANY childless auto-layout node that reports HUG, because a
  // node with no children never triggers the relayout that would dissolve it.
  // Measured live on MUI Divider 83:1610 (a plain COMPONENT, not a slot): 0
  // children, 0 padding, layoutSizingVertical 'HUG' — and 288x100, where the
  // library divider is 288x1. GRID is excluded: a resize on a GRID frame
  // silently reverts HUG tracks to FLEX (G8/GP4b), so the repair would cost
  // more than the defect.
  const hasChildlessBox = datas.some((d) =>
    dataSome(
      d,
      (x) =>
        (x.children ?? []).length === 0 &&
        (x.type === 'slot' || x.type === 'frame' || x.type === 'root') &&
        x.layout?.mode !== 'GRID',
    ),
  );
  const hasWrap = datas.some((d) => dataSome(d, (x) => x.layout?.wrap === true));
  // A COLUMN stack carrying `wrap` is schema-valid and legal CSS, and Figma
  // THROWS on it (layoutWrap is HORIZONTAL-only). Detected statically so the
  // dropped fact is a `†` receipt in the emitted script — the channel the
  // dagger census already counts — rather than a silent skip at runtime.
  const hasColumnWrap = datas.some((d) => dataSome(d, (x) => x.layout?.wrap === true && x.layout?.mode !== 'HORIZONTAL'));
  const hasEffectStack = datas.some((d) => dataSome(d, (x) => x.effectStack !== undefined));
  const hasGradient = datas.some((d) => dataSome(d, (x) => x.gradient !== undefined));
  const hasInsetOverlay = datas.some((d) => dataSome(d, (x) => x.insetOverlay === true));
  // Round 5d: margin-box wrapper / outline-lowered OUTSIDE strokes /
  // single-paint glyph variable re-binding — all feature-gated so contracts
  // without these facts emit byte-identical scripts (the golden discipline).
  const hasMargins = datas.some((d) => dataSome(d, (x) => x.margins !== undefined));
  const hasStrokeOutside = datas.some((d) => dataSome(d, (x) => x.strokeOutside === true));
  const hasSvgPaint = datas.some((d) => dataSome(d, (x) => x.svgPaintVar !== undefined));
  const hasTextExtras = datas.some((d) =>
    dataSome(
      d,
      (x) =>
        x.letterSpacing !== undefined || x.textCase !== undefined || x.textDecoration !== undefined ||
        x.textAlignH !== undefined || x.fontFamily !== undefined || x.textTruncation === true,
    ),
  );
  return `${opts.header}
const COMPONENTS = ${JSON.stringify(datas, null, 2)};
const ROW_H = 240, PAD = 40;

const EXPECTED_FILE_KEY = ${JSON.stringify(fileKey)};
if (EXPECTED_FILE_KEY && figma.fileKey && figma.fileKey !== EXPECTED_FILE_KEY) {
  throw new Error('WRONG FILE: expected ' + EXPECTED_FILE_KEY + ', got ' + figma.fileKey);
}

await figma.loadAllPagesAsync();

${opts.preamble}const allVars = await figma.variables.getLocalVariablesAsync();
const varByName = {};
for (const v of allVars) varByName[v.name] = v;
// FC-THEME-ISO: a multi-library file carries colliding variable names across
// collections (four \`imported/badge/root/background-color/info\`s on the
// Testing file). The last-created-collection-wins map above silently rebound
// fills across libraries (altitude Badge rendered a Polaris provisional
// light-blue). Prefer the single collection covering the MOST of THIS
// script's referenced names; names unique to one collection still resolve
// globally, and an explicit preferred collection (below) still wins.
{
  const _names = new Set(allVars.map((v) => v.name));
  const _wanted = new Set();
  const _walk = (x) => {
    if (typeof x === 'string') { if (_names.has(x)) _wanted.add(x); return; }
    if (Array.isArray(x)) { for (const y of x) _walk(y); return; }
    if (x && typeof x === 'object') { for (const k in x) _walk(x[k]); }
  };
  _walk(COMPONENTS);
  let _dupe = false;
  const _seen = new Set();
  for (const v of allVars) {
    if (!_wanted.has(v.name)) continue;
    if (_seen.has(v.name)) { _dupe = true; break; }
    _seen.add(v.name);
  }
  if (_dupe) {
    const _cov = new Map();
    for (const v of allVars) {
      if (!_wanted.has(v.name)) continue;
      if (!_cov.has(v.variableCollectionId)) _cov.set(v.variableCollectionId, new Set());
      _cov.get(v.variableCollectionId).add(v.name);
    }
    let _best = null, _bestN = 0;
    for (const [_colId, _covered] of _cov) {
      if (_covered.size > _bestN) { _best = _colId; _bestN = _covered.size; }
    }
    if (_best !== null) {
      for (const v of allVars) {
        if (v.variableCollectionId === _best && _wanted.has(v.name)) varByName[v.name] = v;
      }
    }
  }
}${opts.variableCollection ? `
{
  const _cols = await figma.variables.getLocalVariableCollectionsAsync();
  const _prefCol = _cols.find((c) => c.name === ${JSON.stringify(opts.variableCollection)});
  if (_prefCol) {
    for (const v of allVars) {
      if (v.variableCollectionId === _prefCol.id) varByName[v.name] = v;
    }
  }
}` : ''}
// NAMED RUNTIME DEGRADATIONS (R7, 2026-08-22). The emitted script used to
// carry ~30 bare try/catch swallows (a comment where the handler should be) — every one a
// canvas fact the spec asked for and the API refused (FILL sizing, out-of-
// flow placement, min sizes, truncation, a paint base) with NO trace in the
// result. Each now pushes ONE named entry here; syncOne's report carries
// the entries raised while it ran as report.degradations (the same code /
// nodePath / message shape the dump script's _degradations uses), and the
// plugin UI lists them under the set beside the code-only facts. A
// degradation is never a failure: the sync still completes, it just says so.
const DEGRADATIONS = [];
function nodePathOf(node) {
  const parts = [];
  let n = node;
  let guard = 0;
  while (n && n.type !== 'PAGE' && n.type !== 'DOCUMENT' && guard++ < 64) { parts.unshift(n.name || n.type); n = n.parent; }
  return parts.join('/');
}
function degrade(code, node, message, e) {
  DEGRADATIONS.push({ code: code, nodePath: node ? nodePathOf(node) : '', message: message + (e && e.message ? ' (' + e.message + ')' : '') });
}
const need = (name) => {
  const v = varByName[name];
  if (!v) throw new Error('Missing variable: ' + name);
  return v;
};
const boundPaint = (varName, consumer) => {
  // Seed the base with the resolved value when a consumer node is known:
  // Figma keeps rendering a reassigned bound paint's BASE color on
  // pre-existing nodes (fresh nodes normalize at assignment) — without the
  // seed, amended variants render black. The binding itself is unchanged.
  // B-3 finding 2: the resolved ALPHA rides the seed too (paint opacity) —
  // discarding it rendered Badge's rgba(0,0,0,.06) pill as opaque black on
  // amended nodes.
  const v = need(varName);
  let base = { r: 0, g: 0, b: 0 };
  let alpha = 1;
  if (consumer) {
    try {
      const r = v.resolveForConsumer(consumer);
      if (r && r.value && r.value.r !== undefined) {
        base = { r: r.value.r, g: r.value.g, b: r.value.b };
        if (typeof r.value.a === 'number') alpha = r.value.a;
      }
    } catch (e) { degrade('FC-RT-PAINT-BASE-UNRESOLVED', consumer, 'variable ' + varName + ' could not be resolved for this consumer; the bound paint keeps its binding over a black literal base', e); }
  }
  return figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: base, opacity: alpha }, 'color', v);
};

// Named text styles (synced by 01-tokens.js): consumers look up OUR styles
// only — the ds_contracts/textStyleToken marker is identity, a foreign style
// sharing a name is never used. When a compiled spec carries textStyle, the
// named style MUST bind — missing or failed setTextStyleIdAsync refuses by
// the stable code text-style-identity-refused (never silently keep raw props).
let _textStyleMap = null;
async function ourTextStyle(name) {
  if (!_textStyleMap) {
    _textStyleMap = {};
    for (const s of await figma.getLocalTextStylesAsync()) {
      if (s.getSharedPluginData('ds_contracts', 'textStyleToken')) _textStyleMap[s.name] = s;
    }
  }
  return _textStyleMap[name] || null;
}

const fontStyles = new Set(['Medium']);
for (const C of COMPONENTS) for (const s of C.fontStyles) fontStyles.add(s);
for (const style of fontStyles) {
  await figma.loadFontAsync({ family: 'Inter', style });
}

// State previews (bindings.figma.statePreviews): merge the enum-API cartesian with the
// canvas-only preview overlay; base variants gain an explicit State=Default
// segment so every variant in the set carries the axis (Figma derives
// variant properties from names). Contracts without previews pass through
// untouched — names, hashes, and amend reconciliation are unchanged.
function withStateAxis(C) {
  if (!C.stateVariants || C.stateVariants.length === 0) return C.variants;
  return C.variants.map((v) => {
    const name = v.name.indexOf('=') >= 0 ? v.name + ', State=${STATE_PREVIEW_DEFAULT}' : 'State=${STATE_PREVIEW_DEFAULT}';
    return Object.assign({}, v, { name: name, spec: Object.assign({}, v.spec, { name: name }) });
  }).concat(C.stateVariants);
}

// PROTOTYPE WIRING: turn the State preview axis into LIVE behavior. Each
// State=Default variant that has a hover/active twin gets a Figma prototype
// reaction CHANGE_TO that twin, so presentation mode swaps on hover/press
// instead of showing a static grid of previews.
//
// Shapes are pinned by figma-sync/plugin/typings/reactions.d.ts (vendored
// from @figma/plugin-typings@1.131.0): trigger {type:'ON_HOVER'|'ON_PRESS'},
// action {type:'NODE', destinationId, navigation:'CHANGE_TO', transition}.
// transition is ALWAYS null — durations/easings are not contract facts, and
// the capability matrix keeps animation code-only.
//
// The write goes through setReactionsAsync, never \`node.reactions = […]\`:
// the property is read-only whenever a manifest declares
// documentAccess: dynamic-page, and the async setter is correct in BOTH
// modes. The headless mock enforces this (assignment THROWS there).
//
// OWNERSHIP: within a set the contract opts in for, variant reactions are
// contract-owned — every variant is normalized (sources get their pair,
// everything else is cleared). Sets whose contract carries no stateReactions
// are NEVER touched, so hand-authored prototyping elsewhere survives.
async function wireStateReactions(setNode, byName, C) {
  const wires = C.stateReactions || [];
  if (wires.length === 0) return 0;
  if (!C.isSet) {
    throw new Error('State reactions on a non-set component (' + C.setName + ') — variant swaps need siblings');
  }
  const grouped = {};
  for (const w of wires) {
    const src = byName.get(w.from);
    const dst = byName.get(w.to);
    // REFUSE BY NAME rather than silently skipping: the emitter guarantees
    // both variants exist in every path that reaches here.
    if (!src) throw new Error('State reaction source variant not found in "' + C.setName + '": ' + w.from);
    if (!dst) throw new Error('State reaction destination variant not found in "' + C.setName + '": ' + w.to);
    (grouped[w.from] = grouped[w.from] || []).push({
      trigger: { type: w.trigger },
      actions: [{ type: 'NODE', destinationId: dst.id, navigation: 'CHANGE_TO', transition: null }],
    });
  }
  let wired = 0;
  for (const child of setNode.children) {
    const want = grouped[child.name] || [];
    const have = child.reactions || [];
    if (want.length === 0 && have.length === 0) continue;
    await child.setReactionsAsync(want);
    if (want.length > 0) wired++;
  }
  return wired;
}

function isSyncTarget(n) {
  return n.type === 'COMPONENT_SET' ||
    (n.type === 'COMPONENT' && (!n.parent || n.parent.type !== 'COMPONENT_SET'));
}

function allSyncTargets() {
  const out = [];
  for (const page of figma.root.children) {
    for (const node of page.findAll((n) => isSyncTarget(n))) out.push(node);
  }
  return out;
}

// One resolver for nested instances, slot defaults/preferred values, and
// top-level amend targets. Semantic identity wins; names are admitted only
// for explicit pre-contractId generated nodes.
function resolveComponentIdentity(ref, purpose, allowMissing) {
  const targets = allSyncTargets();
  const exact = targets.filter(
    (n) => n.getSharedPluginData('ds_contracts', 'contractId') === ref.contractId,
  );
  if (exact.length > 1) {
    throw new Error(
      purpose + ': duplicate ds_contracts/contractId "' + ref.contractId +
      '" on ' + exact.length + ' component targets — refusing ambiguous identity',
    );
  }
  if (exact.length === 1) return exact[0];

  if (ref.anchorKey) {
    const anchored = targets.filter((n) => n.key === ref.anchorKey);
    if (anchored.length > 1) {
      throw new Error(
        purpose + ': duplicate Figma anchor key "' + ref.anchorKey +
        '" — refusing ambiguous identity',
      );
    }
    if (anchored.length === 1) {
      const marker = anchored[0].getSharedPluginData('ds_contracts', 'contractId');
      if (marker && marker !== ref.contractId) {
        throw new Error(
          purpose + ': anchor key "' + ref.anchorKey + '" belongs to contractId "' +
          marker + '", not "' + ref.contractId + '" — refusing contradictory identity',
        );
      }
      return anchored[0];
    }
  }

  const legacy = targets.filter(
    (n) => n.name === ref.name &&
      n.getSharedPluginData('ds_contracts', 'contractId') === '' &&
      n.getSharedPluginData('ds_contracts', 'specHash') !== '',
  );
  if (legacy.length > 1) {
    throw new Error(
      purpose + ': duplicate explicit legacy-generated name "' + ref.name +
      '" on ' + legacy.length + ' unmarked component targets — refusing ambiguous identity',
    );
  }
  if (legacy.length === 1) return legacy[0];
  if (allowMissing) return null;
  throw new Error(
    purpose + ': component not found for contractId "' + ref.contractId + '"' +
    (ref.anchorKey ? ', anchor key "' + ref.anchorKey + '"' : '') +
    ', or unique explicit legacy-generated name "' + ref.name + '" (sync it first)',
  );
}

function setInstanceProps(inst, props, owner) {
  // REAL-FIGMA QUIRK (live finding 2026-07-22, pinned by the named refusal +
  // Desktop Bridge probes; supersedes the 07-21 "mixed VARIANT+TEXT call"
  // inference, which was wrong): a freshly created instance's
  // componentProperties can LAG behind its component set within a session,
  // listing only the VARIANT axes — the live composite refused with
  // "available: Variant, Size, State" on a Button set that demonstrably
  // carried Label/Disabled/Loading. The set's componentPropertyDefinitions
  // are always complete, and setProperties with the FULL set-level key
  // applies correctly even while the instance's view lags (probe-verified).
  // So: resolve against the instance first, fall back to the OWNER's
  // definitions, and refuse by name only when neither knows the property.
  const instProps = inst.componentProperties;
  const instKeys = Object.keys(instProps);
  let ownerDefs = {};
  try { ownerDefs = (owner && owner.componentPropertyDefinitions) || {}; } catch (e) { ownerDefs = {}; degrade('FC-RT-PROP-DEFS-UNREADABLE', owner, 'componentPropertyDefinitions unreadable on the owner; property references were resolved without them', e); }
  const ownerKeys = Object.keys(ownerDefs);
  const variantProps = {};
  const otherProps = {};
  const missing = [];
  for (const [wanted, value] of Object.entries(props)) {
    const match = (k) => k === wanted || k.startsWith(wanted + '#');
    const key = instKeys.find(match) || ownerKeys.find(match);
    if (!key) { missing.push(wanted); continue; }
    const def = instProps[key] || ownerDefs[key] || {};
    if (def.type === 'VARIANT') variantProps[key] = value; else otherProps[key] = value;
  }
  // 2026-07-21 (live-canvas finding, handoff 08#1): the old silent no-op is
  // exactly how the repeated Badge instances kept their default text live —
  // the contract said Label="Shipping", nothing matched, nothing was
  // reported, the build claimed success. A contract binding the runtime
  // cannot honor is a refusal, BY NAME, like every other refusal here.
  if (missing.length > 0) {
    const seen = instKeys.concat(ownerKeys.filter((k) => instKeys.indexOf(k) < 0));
    throw new Error(
      'Instance "' + inst.name + '": component propert' + (missing.length === 1 ? 'y "' : 'ies "') + missing.join('", "') +
      '" not found (instance + set expose: ' + (seen.map((k) => k.split('#')[0]).join(', ') || 'none') +
      ') — the dependency does not expose the properties this contract binds; sync the dependency component first',
    );
  }
  // Defensive two-phase apply (cheap): variant swap first, then non-variant
  // values on the settled instance — set-level property ids are stable
  // across the swap, so the resolved keys stay valid either way.
  if (Object.keys(variantProps).length > 0) inst.setProperties(variantProps);
  if (Object.keys(otherProps).length > 0) inst.setProperties(otherProps);
}

// Owner request (2026-07-21, roadmap P1): generated components land ON a
// named SECTION with a light background — not floating on the canvas. The
// section is identity-marked (ds_contracts/hostFor) so create and amend both
// re-fit the SAME section instead of stacking new ones; a component already
// hosted keeps its section.
function ensureHostSection(page, target, displayName) {
  const HOST_PAD = 60;
  const contractId = target.getSharedPluginData('ds_contracts', 'contractId');
  let section = null;
  for (const child of page.children) {
    if (child.type === 'SECTION' && child.getSharedPluginData('ds_contracts', 'hostFor') === contractId) {
      section = child;
      break;
    }
  }
  if (!section) {
    section = figma.createSection();
    page.appendChild(section);
    section.setSharedPluginData('ds_contracts', 'hostFor', contractId);
  }
  section.name = displayName;
  section.fills = [{ type: 'SOLID', color: { r: 0.969, g: 0.973, b: 0.98 } }];
  section.appendChild(target);
  target.x = HOST_PAD;
  target.y = HOST_PAD;
  section.resizeWithoutConstraints(target.width + HOST_PAD * 2, target.height + HOST_PAD * 2);
  section.x = 100;
  section.y = 100;
  return section;
}

${slotRuntime(hasSlot)}${birthBoxRuntime(hasChildlessBox)}
// FC-OVERFLOW-CLIP-LOST: node ids whose clip the CONTRACT declared
// (overflow-x/y hidden|clip). The unclip walks consult this so a declared clip
// can never be reverted silently by an overhanging descendant.
const dsDeclaredClip = new Set();
// Ancestors an OVERHANG (absolute / inset overlay) actually unclipped — see
// propagateOverflowVisible. Distinguishes "unclipped because something hangs
// out of it" from "unclipped because CSS overflow defaults to visible".
const dsOverhangUnclip = new Set();
/** Does a DECLARED clip stop the unclip walk at this node? See the body — the
 *  contract's captured overflow outranks the emitter's out-of-flow heuristic,
 *  and the walk ends rather than reverting a fact the contract stated. */
function dsDeclaredClipStops(n) {
  // A DECLARED clip beats the unclip heuristic, and the walk STOPS here.
  //
  // The heuristic is broader than CSS: it unclips every ancestor of any
  // out-of-flow child, but position:absolute does not ask its ancestors to
  // stop clipping — an absolutely positioned child inside overflow:hidden is
  // clipped, normally and correctly. The rule exists for one real case (a
  // Slider thumb at left:-10 genuinely hanging outside its track), and it was
  // reading "is out of flow" as if it meant "hangs outside the box".
  //
  // Fluent Spinner is the counter-example that made this visible: its root
  // declares overflow hidden (captured from the real component) and its
  // spinnerTail declares position:absolute INSIDE that root. Nothing overhangs.
  // The heuristic would have silently thrown the captured clip away.
  //
  // A captured fact outranks an inference about one. Stopping is also
  // sufficient: content clipped at this boundary cannot be revealed by
  // unclipping anything above it.
  return dsDeclaredClip.has(n.id);
}
function applyFrameSpec(node, spec) {
  const l = spec.layout || { mode: 'HORIZONTAL', primary: 'MIN', counter: 'MIN' };${hasGrid ? `
  // A2 grid: GRID frames take the declaration path — the flex fields below
  // (axis aligns, layoutWrap) are not grid facts and are never written.
  if (l.mode === 'GRID') { applyGridFrame(node, l); } else {` : ''}
  node.layoutMode = l.mode;
  node.primaryAxisAlignItems = l.primary;
  node.counterAxisAlignItems = l.counter;${wrapRuntime(hasWrap, hasColumnWrap)}${hasGrid ? `
  }` : ''}
  node.primaryAxisSizingMode = 'AUTO';
  node.counterAxisSizingMode = 'AUTO';
  // FC-FIGMA-CLIP-DEFAULT: createFrame/createComponent default clipsContent=true,
  // but CSS overflow defaults to visible. Clipping HUG text (Inter vs capture
  // font) truncates trailing glyphs (Carbon Tabs "Settings" → "Setting").
  // Unclip unless the contract explicitly asks for canvas clip.
  node.clipsContent = spec.clipsContent === true;
  // FC-OVERFLOW-CLIP-LOST: remember WHO asked for the clip. Three runtime
  // loops (applyShapeAbsolute / applyInsetOverlay / propagateOverflowVisible)
  // walk every ancestor setting clipsContent=false for an overhanging child,
  // and they would silently revert a clip the contract declared — last write
  // wins and nothing reports it. Measured across the whole corpus: NO
  // clip-declaring part has an absolute/insetOverlay/overlay descendant, so
  // this never fires today. It is recorded rather than trusted, because the
  // collision is one contract away and a silent revert is indistinguishable
  // from the fact never having been carried.
  if (spec.clipsContent === true) dsDeclaredClip.add(node.id);
  if (node.type === 'FRAME') node.fills = [];
  // FC-AMEND-CANNOT-CLEAR (astryx/banner live-canvas round, 2026-08-11).
  //
  // This function only ever SET what the spec declares, so on the AMEND path
  // a spacing fact the contract has since DROPPED survived on the node
  // forever. The create path never showed it — a fresh createComponent starts
  // at 0 — so the two paths silently disagreed, and \`specHash\` matching made
  // it invisible: the script reports "skipped: unchanged" while the canvas
  // carries a value the contract does not claim.
  //
  // Measured: astryx/banner's root carried a bound 12/16 padding + gap 8 that
  // its committed spec does not declare, applying the header's padding TWICE
  // (header 299x64 → root 331x88) against a reference and a contract render
  // that both measure 64 tall. Across all 77 scored cells on the two
  // connected files it is the ONLY root in that state — every other root with
  // padding declares it — so this reset changes exactly one scored cell.
  //
  // Only the ROOT needs it: amend removes and rebuilds every child, so no
  // descendant can carry stale state. Reset to Figma's own defaults FIRST,
  // then apply what the spec declares below.
  for (const field of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'itemSpacing']) {
    if (spec.bindings && spec.bindings[field] !== undefined) continue;
    if (spec.lits && spec.lits[field] !== undefined) continue;
    try {
      if (node.boundVariables && node.boundVariables[field]) node.setBoundVariable(field, null);
    } catch (e) { degrade('FC-RT-FIELD-UNBIND-REFUSED', node, 'a stale ' + field + ' variable could not be unbound before the reset', e); }
    try { node[field] = 0; } catch (e) { degrade('FC-RT-FIELD-RESET-REFUSED', node, field + ' could not be reset to 0 (not an auto-layout frame)', e); }
  }
  for (const [field, varName] of Object.entries(spec.bindings || {})) {
    node.setBoundVariable(field, need(varName));
  }
  if (spec.fill) node.fills = [boundPaint(spec.fill, node)];
  if (spec.stroke) {
    node.strokes = [boundPaint(spec.stroke, node)];
    node.strokeAlign = ${strokeAlignJs(hasStrokeOutside)};
    // ANTD EXAM (heal loop): a per-value border style (stylesWhen dashed/dotted) → dashPattern
    if (spec.dashPattern) { try { node.dashPattern = spec.dashPattern; } catch (e) { degrade('FC-RT-DASH-PATTERN-REFUSED', node, 'dashPattern refused on this node; the stroke stays solid', e); } }
  }${shadowRuntime(hasShadow)}${effectStackRuntime(hasEffectStack)}
  if (spec.fixedWidth || spec.fixedHeight) {
    const w = spec.fixedWidth ? spec.fixedWidth.px : node.width;
    const h = spec.fixedHeight ? spec.fixedHeight.px : node.height;
    node.resize(w, h);
    // GRID's primary axis is HORIZONTAL (GP1b), like a HORIZONTAL frame.
    const horizontalIsPrimary = l.mode === 'HORIZONTAL' || l.mode === 'GRID';
    if (spec.fixedWidth) {
      if (horizontalIsPrimary) node.primaryAxisSizingMode = 'FIXED';
      else node.counterAxisSizingMode = 'FIXED';
      node.setBoundVariable('width', need(spec.fixedWidth.varName));
    }
    if (spec.fixedHeight) {
      if (horizontalIsPrimary) node.counterAxisSizingMode = 'FIXED';
      else node.primaryAxisSizingMode = 'FIXED';
      if (spec.fixedHeight.varName) node.setBoundVariable('height', need(spec.fixedHeight.varName));
    }
  }${litsRuntime(hasLits, hasLitStrokeColor)}${gradientRuntime(hasGradient)}
}

// v7 overlay: out-of-flow edge attachment. Must run AFTER appendChild —
// layoutPositioning ABSOLUTE requires an auto-layout parent.
function applyOverlay(parent, childNode, childSpec) {
  if (!childSpec.overlay) return;
  try {
    childNode.layoutPositioning = 'ABSOLUTE';
    const p = childSpec.overlay.placement;
    childNode.constraints =
      p === 'bottom' ? { horizontal: 'MIN', vertical: 'MAX' } :
      p === 'end' ? { horizontal: 'MAX', vertical: 'MIN' } :
      { horizontal: 'MIN', vertical: 'MIN' };
    if (p === 'top') { childNode.x = 0; childNode.y = -childNode.height; }
    else if (p === 'bottom') { childNode.x = 0; childNode.y = parent.height; }
    else if (p === 'start') { childNode.x = -childNode.width; childNode.y = 0; }
    else { childNode.x = parent.width; childNode.y = 0; }
  } catch (e) { degrade('FC-RT-OUT-OF-FLOW-PLACEMENT-REFUSED', childNode, 'the out-of-flow placement was refused (parent not auto-layout); the child stayed in flow', e); }
}
${absoluteRuntime(hasAbsolute)}${insetOverlayRuntime(hasInsetOverlay)}${outOfFlowResizeRuntime(hasInsetOverlay || hasAbsolute)}${overflowPropagateRuntime(hasAbsolute || hasInsetOverlay)}${marginBoxRuntime(hasMargins)}${gridRuntime(hasGrid)}
async function buildNode(spec, registry) {
  let node;
  if (spec.type === 'svg') {
    node = figma.createNodeFromSvg(spec.svg);
    node.fills = [];
    node.clipsContent = false;
    if (spec.iconSize) node.resize(spec.iconSize, spec.iconSize);${svgPaintRuntime(hasSvgPaint)}
    // FC-SVG-ROTATION: CSS-clockwise → Plugin API counterclockwise
    if (typeof spec.rotation === 'number' && spec.rotation !== 0) node.rotation = -spec.rotation;
  } else if (spec.type === 'text') {
    node = figma.createText();
    node.fontName = { family: 'Inter', style: spec.fontStyle || 'Medium' };
    node.fontSize = spec.fontSize || 16;
    node.characters = spec.characters || '';${lineHeightRuntime(hasLineHeight)}${textExtrasRuntime(hasTextExtras)}
    if (spec.textStyle) {
      // Exact-definition match compiled in: ride the named style. Text
      // styles own typography only — the bound fill paint below coexists.
      // Fail closed: a compiled textStyle that cannot bind is identity loss.
      const st = await ourTextStyle(spec.textStyle);
      if (!st) {
        throw new Error(
          'text-style-identity-refused: missing local text style "' + spec.textStyle +
          '" (run the tokens sync so ds_contracts/textStyleToken styles exist)',
        );
      }
      try {
        await node.setTextStyleIdAsync(st.id);
      } catch (e) {
        throw new Error(
          'text-style-identity-refused: setTextStyleIdAsync failed for "' + spec.textStyle +
          '": ' + (e && e.message ? e.message : String(e)),
        );
      }
    } else if (spec.fontSizeVar) {
      // FC-WEIGHT-IDENTITY: no style could carry this node's size token (it
      // overrides its group's weight, and Figma clears textStyleId on any
      // fontName write), so the SIZE VARIABLE carries the identity instead.
      // Bound AFTER fontName/fontSize so the literal stays the fallback.
      node.setBoundVariable('fontSize', need(spec.fontSizeVar));
    }
    // FC-WEIGHT-IDENTITY, second half. Figma exposes no bindable field for
    // font weight, so the token cannot ride a variable the way the size does.
    // Stamp it instead: without this the node draws "Medium" and a reader
    // cannot tell a DECLARED weight from the runtime default. Written as ''
    // (which deletes the key) when the contract binds no weight, so a node
    // that stops declaring one cannot keep answering with a stale token.
    node.setSharedPluginData('ds_contracts', 'fontWeightVar', spec.fontWeightVar || '');
    node.setSharedPluginData('ds_contracts', 'lineHeightVar', spec.lineHeightVar || '');
    if (spec.textFill) node.fills = [boundPaint(spec.textFill, node)];${textFillLitRuntime(hasTextFillLit)}
    if (spec.contentProp) {
      registry.texts.push({ prop: spec.contentProp, node, default: spec.characters || '' });
    }
    if (spec.fill || spec.fixedWidth || spec.fixedHeight || spec.bindings) {
      // Styled static text (page chips, dots, thumbs): wrap in a frame so
      // fills/dimensions/radius apply to a container, not the glyphs.
      //
      // TASK #37, second live-canvas finding: "Modal's Label renders CENTERED
      // at the top rather than top-left". The wrapper's CENTER/CENTER was
      // hard-coded for the chip/dot/thumb case — a DRAWN box, where centering
      // the glyph is right. But 46 of the corpus's 62 wrapped texts have no
      // fill and no fixed size at all: they are wrapped only to carry
      // min-width/min-height bindings the floor promoted (Carbon's own reset
      // declares \`min-width: 0\`), and then the wrapper re-centered text that
      // CSS lays out at the start of its line box. Carbon's Modal "Label" is
      // exactly that: a bare h2 with \`min-width: 0\`, FILLing the header, so
      // the wrapper centered it in a 430px row.
      //
      // A wrapper with no drawn box inherits the CSS truth (start/start); a
      // wrapper that DOES draw a box keeps the centering it was built for.
      const boxed = Boolean(spec.fill || spec.fixedWidth || spec.fixedHeight);
      const wrap = figma.createFrame();
      wrap.layoutMode = 'HORIZONTAL';
      wrap.primaryAxisAlignItems = boxed ? 'CENTER' : 'MIN';
      wrap.counterAxisAlignItems = boxed ? 'CENTER' : 'MIN';
      wrap.primaryAxisSizingMode = 'AUTO';
      wrap.counterAxisSizingMode = 'AUTO';
      // FC-FIGMA-CLIP-DEFAULT — text hosts must not clip Semi Bold overhang.
      wrap.clipsContent = false;
      wrap.fills = [];
      for (const [field, varName] of Object.entries(spec.bindings || {})) {
        wrap.setBoundVariable(field, need(varName));
      }
      if (spec.fill) wrap.fills = [boundPaint(spec.fill, wrap)];
      if (spec.stroke) { wrap.strokes = [boundPaint(spec.stroke, wrap)]; wrap.strokeAlign = ${strokeAlignJs(hasStrokeOutside)}; }
      if (spec.characters) wrap.appendChild(node); else node.remove();
      if (spec.fixedWidth || spec.fixedHeight) {
        wrap.resize(spec.fixedWidth ? spec.fixedWidth.px : wrap.width, spec.fixedHeight ? spec.fixedHeight.px : wrap.height);
        if (spec.fixedWidth) { wrap.primaryAxisSizingMode = 'FIXED'; wrap.setBoundVariable('width', need(spec.fixedWidth.varName)); }
        if (spec.fixedHeight) { wrap.counterAxisSizingMode = 'FIXED'; if (spec.fixedHeight.varName) wrap.setBoundVariable('height', need(spec.fixedHeight.varName)); else wrap.resize(wrap.width, spec.fixedHeight.px); }
      }
      wrap.name = spec.name;
      node = wrap;
    }
  } else if (spec.type === 'instance') {
    const target = resolveComponentIdentity(
      { contractId: spec.depContractId, anchorKey: spec.depAnchorKey, name: spec.dep },
      'Instance "' + spec.name + '"',
      false,
    );
    const main = target.type === 'COMPONENT_SET' ? target.defaultVariant : target;
    node = main.createInstance();
    if (spec.depProps) setInstanceProps(node, spec.depProps, target);
  } else if (spec.type === 'slot') {
    // NATIVE SLOT. createSlot() exists on ComponentNode only (probe 2a), so
    // the slot is minted by the variant component that owns it and moved into
    // place by the ordinary child append below — a slot in a nested frame
    // keeps its property binding (probe 2f).
    if (!registry.owner) {
      throw new Error(
        'Slot "' + spec.slotProperty + '": no owning COMPONENT in scope — figma.createSlot is a ComponentNode method ' +
        '(never on a frame or a component SET); a slot outside a component build is refused',
      );
    }
    node = registry.owner.createSlot();
    applyFrameSpec(node, spec);
    // An empty native slot renders as Figma's own thing: no dashed chrome, no
    // "Slot" text, no placeholder instance (proposal §2). createSlot's default
    // solid-white fill is Figma's, not the contract's — the part's own styling
    // (usually nothing) is the truth.
    if (!spec.fill) node.fills = [];
    for (const item of spec.slotDefault || []) {
      const target = resolveComponentIdentity(
        { contractId: item.contractId, anchorKey: item.anchorKey, name: item.dep },
        'Slot "' + spec.name + '" default',
        false,
      );
      const main = target.type === 'COMPONENT_SET' ? target.defaultVariant : target;
      const inst = main.createInstance();
      if (item.props) setInstanceProps(inst, item.props, target);
      node.appendChild(inst);
      if (spec.layout && spec.layout.stretchChildren) {
        try { inst.layoutSizingHorizontal = 'FILL'; } catch (e) { degrade('FC-RT-FILL-SIZING-REFUSED', inst, 'slot default content could not stretch (layoutSizingHorizontal FILL refused); it keeps its own width', e); }
      }
    }
    registry.slots.push({ spec, slot: node });
  }${shapeRuntime(hasShape, `${shadowRuntime(hasShadow)}${effectStackRuntime(hasEffectStack)}`, strokeAlignJs(hasStrokeOutside), hasShapeLits, hasArc)} else {
    node = spec.type === 'root' ? figma.createComponent() : figma.createFrame();
    applyFrameSpec(node, spec);${hasSlot ? `
    // The variant COMPONENT is the slot owner for everything built below it
    // (figma.createSlot is a ComponentNode method).
    if (spec.type === 'root') registry.owner = node;` : ''}
  }
${hasSlot ? `  // A native slot's LAYER NAME is its property's display name: renaming the
  // layer renames the linked SLOT property (probe 2b), so the contract's
  // slot.bindings.figma.property is spelled here and nowhere else.
  node.name = spec.type === 'slot' ? spec.slotProperty : spec.name;` : `  node.name = spec.name;`}${opacityRuntime(hasOpacity)}
  if (spec.visibleProp) {
    registry.visibles.push({ node, prop: spec.visibleProp, default: spec.visibleDefault === true });
  }
  const built = [];
  for (const child of spec.children || []) {
    const childNode = await buildNode(child, registry);
    node.appendChild(childNode);${overflowPropagateCall(hasAbsolute || hasInsetOverlay, 'childNode', 'node')}
    built.push([child, childNode]);
    applyOverlay(node, childNode, child);${absoluteCall(hasAbsolute, 'node, childNode, child')}
    if (child.pct != null) {
      try {
        childNode.resize(Math.max(1, Math.round(node.width * child.pct)), childNode.height);
        childNode.primaryAxisSizingMode = 'FIXED';
        // ANTD EXAM (heal loop): the track may itself FILL a parent that is
        // not sized yet (antd's Progress: inner FILLs outer FILLs the root),
        // so the fraction above was taken of a hugging 2px track. Stamp the
        // fraction; the ROOT re-applies it once the whole tree has laid out.
        childNode.setPluginData('ds_meter', String(child.pct));
      } catch (e) { degrade('FC-RT-METER-RESIZE-REFUSED', childNode, 'the meter fraction could not be applied (resize / FIXED refused); the track is not fixed-width', e); }
    }
    if (
      child.type === 'frame' && (!child.children || child.children.length === 0) &&
      !child.fixedHeight && !(child.lits && child.lits.height !== undefined) && !child.shape &&
      // ROUND 6: an OUT-OF-FLOW child is not in the auto-layout flow — FILL
      // sizing is meaningless there (real Figma drops it the moment
      // layoutPositioning becomes ABSOLUTE) and the instruction only made
      // the Dialog backdrop LOOK healthy in the headless mock while the
      // canvas drew a squat band. Out-of-flow boxes are sized by
      // resizeOutOfFlow against the parent's final box.
      !child.overlay && !child.insetOverlay && !child.absolute
    ) {
      // #60 fix 4: empty runtime-sized geometry gets DECLARED defaults —
      // height follows the auto-layout parent (FILL), never Figma's 100×100
      // createFrame artifact (Phase B-2 finding 4: ProgressBar indicators
      // overflowed their fixed-height tracks). Width stays the spec'd
      // fraction (meter pct) or the placeholder box, named in the component
      // description.
      try { childNode.layoutSizingVertical = 'FILL'; } catch (e) { degrade('FC-RT-FILL-SIZING-REFUSED', childNode, 'the empty box could not take the parent height (layoutSizingVertical FILL refused)', e); }
    }
    // FILL is compiled (annotateFillW): candidates only fill when the parent
    // width is established — the hug↔fill collapse class stays impossible.
    if (child.fillW && !(child.type === 'text' && !child.textTruncation && child.fillText !== true) && 'layoutSizingHorizontal' in childNode) {
      try { childNode.layoutSizingHorizontal = 'FILL'; } catch (e) { degrade('FC-RT-FILL-SIZING-REFUSED', childNode, 'the compiled FILL width was refused (layoutSizingHorizontal FILL); the child keeps its drawn width', e); }
    }${insetOverlayCall(hasInsetOverlay, 'node, childNode, child')}${marginBoxCall(hasMargins, 'node, childNode, child, registry')}
  }${gridChildrenCall(hasGrid, 'node, spec, built')}${outOfFlowResizeCall(hasInsetOverlay || hasAbsolute, 'node, built')}${birthBoxCall(hasChildlessBox, 'node', 'spec')}
  if (spec.type === 'root') {
    // meters: re-apply each stamped fraction against its track's LAID-OUT width
    for (const m of node.findAll((x) => x.getPluginData && x.getPluginData('ds_meter') !== '')) {
      const pct = Number(m.getPluginData('ds_meter'));
      m.setPluginData('ds_meter', '');
      try { if (m.parent && m.parent.width > 0) m.resize(Math.max(1, Math.round(m.parent.width * pct)), m.height); } catch (e) { degrade('FC-RT-METER-RESIZE-REFUSED', m, 'the meter fraction could not be re-applied after layout', e); }
    }
  }
  return node;
}


// djb2 over the compiled spec — stored on the set so unchanged components
// skip cheaply and CHANGED ones amend in place.
${FINGERPRINT_SRC}
// v6: bindings are fingerprinted by variable NAME, and every Figma variable
// API that survives dynamic-page loading is async — so the id→name map is
// filled ONCE here, from the emitted script's top-level await, and the sync
// walk reads it. This runs AFTER the source above on purpose: the
// dsVarNames initializer would clobber an earlier fill.
await dsLoadVarNames();

// DRIFT ROUND: stamp the node — and, for a SET, each VARIANT child — so
// Check Drift can LOCALIZE an edit to the exact variant (live finding:
// "canvas edited" over 63 Button variants is not actionable).
function dsStampFingerprints(node) {
  node.setSharedPluginData('ds_contracts', 'canvasFingerprint', dsCanvasFingerprint(node));
  // v3: variants also store the SNAPSHOT the hash derives from, so Check
  // Drift can say WHAT changed, not just that something did. Each variant
  // node owns its own pluginData quota — the set never carries the bulk.
  if (node.type === 'COMPONENT_SET') {
    node.setSharedPluginData('ds_contracts', 'canvasSetSnapshot', JSON.stringify(dsCanvasSetSnapshot(node)));
    for (const child of node.children) {
      child.setSharedPluginData('ds_contracts', 'canvasFingerprint', dsCanvasFingerprint(child));
      child.setSharedPluginData('ds_contracts', 'canvasSnapshot', JSON.stringify(dsCanvasSnapshot(child)));
    }
  } else {
    node.setSharedPluginData('ds_contracts', 'canvasSetSnapshot', JSON.stringify(dsCanvasSetSnapshot(node)));
    node.setSharedPluginData('ds_contracts', 'canvasSnapshot', JSON.stringify(dsCanvasSnapshot(node)));
  }
}

// Bump when the emitted RUNTIME template changes without a COMPONENTS JSON
// delta (e.g. FC-FIGMA-CLIP-DEFAULT clipsContent default). Otherwise amend
// skips as "unchanged" and canvas keeps the old runtime behavior.
const RUNTIME_EMIT_REV = '${RUNTIME_EMIT_REV}';
function specHash(C) {
  let h = 5381; const s = JSON.stringify(C) + '|' + RUNTIME_EMIT_REV;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0;
  return String(h);
}

// THE NAMED RECEIPT ON THE CANVAS (2026-08-22): ds_contracts/codeOnlyFacts.
// C.codeOnlyFacts is the sorted list of facts the contract carries and the
// canvas cannot (see CodeOnlyFact in core/emit-figma-script.ts). Shared
// plugin data has a per-entry size limit, so the stamp keeps as many FULL
// facts as fit under CODE_ONLY_FACTS_STAMP_BYTES, then names the rest by
// part.channel ("+N more"), then counts whatever still does not fit. The
// count is always exact; the full list rides the bundle JSON and the
// per-set result the plugin report lists. Written as '' (deletes the key)
// when there is nothing to name, so a set that lost its last fact does not
// keep a stale receipt.
const CODE_ONLY_FACTS_STAMP_BYTES = 24000;
function codeOnlyFactsStamp(C) {
  const facts = C.codeOnlyFacts || [];
  if (facts.length === 0) return '';
  const kept = [];
  const moreNames = [];
  const body = () => JSON.stringify({ count: facts.length, facts: kept, more: facts.length - kept.length, moreNames: moreNames });
  for (const f of facts) {
    kept.push(f);
    if (body().length > CODE_ONLY_FACTS_STAMP_BYTES) { kept.pop(); break; }
  }
  for (let i = kept.length; i < facts.length; i++) {
    moreNames.push(facts[i].part + '.' + facts[i].channel);
    if (body().length > CODE_ONLY_FACTS_STAMP_BYTES) { moreNames.pop(); break; }
  }
  const stamp = { count: facts.length, facts: kept, more: facts.length - kept.length };
  if (stamp.more > 0) stamp.moreNames = moreNames;
  return JSON.stringify(stamp);
}
function withCodeOnlyFacts(report, C, degradedFrom) {
  if (C.codeOnlyFacts && C.codeOnlyFacts.length > 0) report.codeOnlyFacts = C.codeOnlyFacts;
  // R7: the runtime degradations raised while this set synced ride the same
  // per-set result — named beside the facts, never only in a console.
  if (typeof degradedFrom === 'number' && DEGRADATIONS.length > degradedFrom) report.degradations = DEGRADATIONS.slice(degradedFrom);
  return report;
}

// IN-PLACE AMEND (2026-07-08, closes the create-only gap): reconcile an
// existing COMPONENT_SET against the compiled spec while preserving what
// instances bind to — the set node + key, each variant COMPONENT node, and
// existing componentProperty IDs. Variant interiors are contract-owned and
// rebuilt from spec (manual interior edits are drift by definition);
// instance-level property overrides survive because property IDs do.
// Destructive changes (extra variants from removed enum values) are
// REPORTED, never deleted — except State preview leftovers when
// bindings.figma.statePreviews is off (FC-STATE-PREVIEW-NOISE), which amend removes.
async function amendSet(set, C) {
  set.setSharedPluginData('ds_contracts', 'contractId', C.contractId);
  set.setSharedPluginData('ds_contracts', 'version', C.version || '');
  // The DECLARED sparse-matrix shape, refreshed BEFORE the specHash early
  // return so a set that skips as unchanged still carries a current marker.
  // Written as '' (which deletes the key) when the contract no longer opts
  // into previews — a stale descriptor would describe a matrix nobody drew.
  set.setSharedPluginData('ds_contracts', 'statePreviewAxis',
    C.statePreviewAxis ? JSON.stringify(C.statePreviewAxis) : '');
  set.setSharedPluginData('ds_contracts', 'semantics',
    C.semantics ? JSON.stringify(C.semantics) : '');
  set.setSharedPluginData('ds_contracts', 'propNames',
    C.propNames ? JSON.stringify(C.propNames) : '');
  // The named receipt — refreshed BEFORE the specHash early return, like the
  // markers above, so an unchanged set still carries a current one.
  set.setSharedPluginData('ds_contracts', 'codeOnlyFacts', codeOnlyFactsStamp(C));
  const hash = specHash(C);
  if (set.getSharedPluginData('ds_contracts', 'specHash') === hash) {
    // DRIFT ROUND migration: no stamp OR a pre-v2 stamp (geometry-bearing —
    // unstable under real Figma's deferred layout) re-baselines NOW. A
    // current-version stamp is never overwritten on skip: canvas edits stay
    // detectable.
    var fpSkip = set.getSharedPluginData('ds_contracts', 'canvasFingerprint');
    if (!fpSkip || fpSkip.indexOf('${FINGERPRINT_VERSION}') !== 0) {
      dsStampFingerprints(set);
    }
    return { name: C.setName, contractId: C.contractId, skipped: true, reason: 'unchanged', nodeId: set.id, key: set.key };
  }
  const report = { name: C.setName, contractId: C.contractId, amended: true, nodeId: set.id, key: set.key,
    addedVariants: [], rebuiltVariants: 0, extraVariants: [], addedProps: [], editedDefaults: [] };
  const defs = set.componentPropertyDefinitions;
  const newKeys = {};
  const defKey = (name) => newKeys[name] ||
    Object.keys(defs).find((k) => k.split('#')[0] === name) || null;

  for (const w of [
    ...C.boolProps.map((bp) => ({ name: bp.property, type: 'BOOLEAN', def: bp.default })),
    ...(C.textProps || []).map((tp) => ({ name: tp.property, type: 'TEXT', def: tp.default })),
  ]) {
    const k = defKey(w.name);
    if (!k) { newKeys[w.name] = set.addComponentProperty(w.name, w.type, w.def); report.addedProps.push(w.name); }
    else if (defs[k].type === w.type && defs[k].defaultValue !== w.def) {
      set.editComponentProperty(k, { defaultValue: w.def });
      report.editedDefaults.push(w.name);
    }
  }

  // Sets gaining/losing the State preview axis reconcile by RENAME, not
  // duplication: an existing variant whose name matches an expected name
  // minus the ', State=Default' segment IS that variant (instances point at
  // it), so it is renamed in place — every variant node ID is preserved.
  // Main-file finding, 2026-07-08: name-only matching built 12 duplicates
  // and stranded the 12 originals as off-axis extras.
  const EV = withStateAxis(C);
  const expected = new Map(EV.map((v) => [v.name, v]));
  for (const ch of set.children) {
    if (expected.has(ch.name)) continue;
    const gained = ch.name + ', State=Default';
    const lost = ch.name.replace(', State=Default', '');
    if (expected.has(gained) && !set.children.some((o) => o.name === gained)) {
      ch.name = gained;
      report.renamedVariants = report.renamedVariants || [];
      report.renamedVariants.push(gained);
    } else if (lost !== ch.name && expected.has(lost) && !set.children.some((o) => o.name === lost)) {
      ch.name = lost;
      report.renamedVariants = report.renamedVariants || [];
      report.renamedVariants.push(lost);
    } else {
      report.extraVariants.push(ch.name);
    }
  }
  // FC-STATE-PREVIEW-NOISE: when the State preview axis is off, leftover
  // State=Focus Visible (etc.) variants from a prior statePreviews:true
  // sync must be removed — otherwise amend leaves a doubled showcase grid.
  const expectedHasState = EV.some((v) => /, State=/.test(v.name));
  if (!expectedHasState && report.extraVariants.length) {
    const removed = [];
    for (const name of [...report.extraVariants]) {
      if (!/, State=/.test(name)) continue;
      const ch = set.children.find((c) => c.name === name);
      if (ch) {
        ch.remove();
        removed.push(name);
      }
    }
    if (removed.length) {
      report.extraVariants = report.extraVariants.filter((n) => !removed.includes(n));
      report.removedVariants = removed;
    }
  }
  const existingByName = new Map(set.children.map((ch) => [ch.name, ch]));

  for (const v of EV) {
    let comp = existingByName.get(v.name);
    const registry = { texts: [], slots: [], visibles: [] };
    if (!comp) {
      comp = await buildNode(v.spec, registry);
      set.appendChild(comp);
      report.addedVariants.push(v.name);
    } else {
      for (const child of [...comp.children]) child.remove();
      applyFrameSpec(comp, v.spec);${hasSlot ? `
      registry.owner = comp;` : ''}
      const built = [];
      for (const childSpec of v.spec.children || []) {
        const childNode = await buildNode(childSpec, registry);
        comp.appendChild(childNode);${overflowPropagateCall(hasAbsolute || hasInsetOverlay, 'childNode', 'comp')}
        built.push([childSpec, childNode]);
        applyOverlay(comp, childNode, childSpec);${absoluteCall(hasAbsolute, 'comp, childNode, childSpec')}
        if (childSpec.pct != null) {
          try { childNode.resize(Math.max(1, Math.round(comp.width * childSpec.pct)), childNode.height); childNode.primaryAxisSizingMode = 'FIXED'; } catch (e) { degrade('FC-RT-METER-RESIZE-REFUSED', childNode, 'the meter fraction could not be applied (resize / FIXED refused); the track is not fixed-width', e); }
        }
        if (
          childSpec.type === 'frame' && (!childSpec.children || childSpec.children.length === 0) &&
          !childSpec.fixedHeight && !(childSpec.lits && childSpec.lits.height !== undefined) && !childSpec.shape &&
          !childSpec.overlay && !childSpec.insetOverlay && !childSpec.absolute
        ) {
          // #60 fix 4 (amend path): same empty-child declared default.
          try { childNode.layoutSizingVertical = 'FILL'; } catch (e) { degrade('FC-RT-FILL-SIZING-REFUSED', childNode, 'the empty box could not take the parent height (layoutSizingVertical FILL refused)', e); }
        }
        if (childSpec.fillW && !(childSpec.type === 'text' && !childSpec.textTruncation && childSpec.fillText !== true) && 'layoutSizingHorizontal' in childNode) {
          try { childNode.layoutSizingHorizontal = 'FILL'; } catch (e) { degrade('FC-RT-FILL-SIZING-REFUSED', childNode, 'the compiled FILL width was refused (layoutSizingHorizontal FILL); the child keeps its drawn width', e); }
        }${insetOverlayCall(hasInsetOverlay, 'comp, childNode, childSpec')}${marginBoxCall(hasMargins, 'comp, childNode, childSpec, registry')}
      }${gridChildrenCall(hasGrid, 'comp, v.spec, built')}${outOfFlowResizeCall(hasInsetOverlay || hasAbsolute, 'comp, built')}${birthBoxCall(hasChildlessBox, 'comp', 'v.spec')}
      report.rebuiltVariants++;
    }
    for (const t of registry.texts) {
      let k = defKey(t.prop);
      if (!k) { k = set.addComponentProperty(t.prop, 'TEXT', t.default); newKeys[t.prop] = k; report.addedProps.push(t.prop); }
      else if (defs[k] && defs[k].defaultValue !== t.default && !report.editedDefaults.includes(t.prop)) {
        set.editComponentProperty(k, { defaultValue: t.default });
        report.editedDefaults.push(t.prop);
      }
      t.node.componentPropertyReferences = { characters: k };
    }
    for (const sl of registry.slots) {
      let k = defKey(sl.spec.slotProperty);
      // MIGRATION (proposal §6.2): the same display name carried by the OLD
      // INSTANCE_SWAP convention is the same slot — but the two property
      // types cannot share an id, so the legacy one retires here (reported)
      // and the natively minted SLOT property takes over. ANY OTHER type
      // sharing the name is not a slot in disguise: deleting a TEXT/BOOLEAN
      // property to make room would destroy every instance override bound to
      // it, so that refuses by name instead.
      if (k && defs[k] && defs[k].type !== 'SLOT') {
        if (defs[k].type !== 'INSTANCE_SWAP') {
          throw new Error(
            'Slot "' + sl.spec.slotProperty + '": the set already carries a ' + defs[k].type +
            ' property with that name — a slot cannot adopt it, and deleting it would strip every instance override bound to it; rename the contract slot (slot.bindings.figma.property) or retire the property in Figma',
          );
        }
        await migrateLegacySlotProperty(set, k, defs[k], sl.spec.slotProperty, report);
        k = null;
      }
      const bound = bindSlot(set, sl, k);
      if (!k) {
        newKeys[sl.spec.slotProperty] = bound.key;
        report.addedProps.push(sl.spec.slotProperty);
      } else if (bound.rebound) {
        // The headline invariant: the rebuilt slot went back onto the
        // PRESERVED property id, so every instance fill keyed to it survives
        // this amend (probe 2d.3).
        report.preservedSlots = (report.preservedSlots || []).concat([sl.spec.slotProperty]);
      }
      if (sl.spec.slotOptional) {
        let vk = defKey('Show ' + sl.spec.slotProperty);
        // Optional slots default hidden — an empty slot still occupies its box
        // (Toast/ChatMessage live finding). Designers opt in.
        if (!vk) { vk = set.addComponentProperty('Show ' + sl.spec.slotProperty, 'BOOLEAN', false); newKeys['Show ' + sl.spec.slotProperty] = vk; }
        // BOTH references in one write: componentPropertyReferences is
        // replaced wholesale, and dropping slotContentId here would unbind
        // the slot (and strand its content) to gain a visibility toggle.
        sl.slot.componentPropertyReferences = { slotContentId: bound.key, visible: vk };
        sl.slot.visible = false;
      }
    }
    for (const vis of registry.visibles) {
      const k = defKey(vis.prop);
      if (!k) continue;
      vis.node.componentPropertyReferences = { visible: k };
      vis.node.visible = vis.default;
    }
  }

  // Contract default combo must be the FIRST variant (Figma default = first).
  const first = set.children.find((ch) => ch.name === EV[0].name);
  if (first && set.children[0] !== first) set.insertChild(0, first);

  // Grid re-layout with the create path's math.
  const specByName = new Map(EV.map((sv) => [sv.name, sv]));
  const rowsN = Math.max(...EV.map((vv) => vv.row)) + 1;
  const colsN = Math.max(...EV.map((vv) => vv.col)) + 1;
  const colWs = new Array(colsN).fill(0);
  const rowHs = new Array(rowsN).fill(0);
  for (const child of set.children) {
    const sp = specByName.get(child.name);
    if (!sp) continue;
    colWs[sp.col] = Math.max(colWs[sp.col], child.width);
    rowHs[sp.row] = Math.max(rowHs[sp.row], child.height);
  }
  for (const child of set.children) {
    const sp = specByName.get(child.name);
    if (!sp) continue;
    let x = PAD, y = PAD;
    for (let i = 0; i < sp.col; i++) x += colWs[i] + PAD;
    for (let i = 0; i < sp.row; i++) y += rowHs[i] + PAD;
    child.x = x; child.y = y;
  }
  // B-3 finding 4: after re-gridding, the SET CONTAINER refits to the
  // children's extent + grid padding (the create path's exact math) —
  // without this, added variants/columns stayed clipped by stale bounds
  // (Banner's Focus column, Button's 220-cell grid, ProgressBar's height).
  // Extra (human-owned) variants may sit beyond the grid; never shrink
  // below their extent.
  {
    let totalW = colWs.reduce((a, b) => a + b, 0) + PAD * (colsN + 1);
    let totalH = rowHs.reduce((a, b) => a + b, 0) + PAD * (rowsN + 1);
    for (const child of set.children) {
      totalW = Math.max(totalW, child.x + child.width + PAD);
      totalH = Math.max(totalH, child.y + child.height + PAD);
    }
    set.resizeWithoutConstraints(totalW, totalH);
  }
  set.description = C.description;
  if (C.documentationLinks && C.documentationLinks.length > 0) set.documentationLinks = C.documentationLinks;
  set.setSharedPluginData('ds_contracts', 'specHash', hash);
  // PROTOTYPE WIRING — BEFORE the fingerprint stamp, so the v5 reaction facts
  // are part of what gets stamped (a stripped reaction is drift).
  report.wiredReactions = await wireStateReactions(set, new Map(set.children.map((ch) => [ch.name, ch])), C);
  // DRIFT ROUND: the canvas fingerprint — recomputed by Check Drift; a
  // mismatch means the canvas was edited after generation.
  dsStampFingerprints(set);
  // Re-fit (or adopt into) the host section — legacy un-hosted sets gain one.
  const setPage = set.parent && set.parent.type === 'SECTION' ? set.parent.parent : set.parent;
  if (setPage && setPage.type === 'PAGE') ensureHostSection(setPage, set, set.name);
  return report;
}

// #60 fix 3: IN-PLACE AMEND for standalone COMPONENTs (non-set: Badge/Tag
// class) — the same identity-marker update semantics as amendSet: the
// component node (and key) instances bind to is preserved; the interior is
// contract-owned and rebuilt from spec; existing componentProperty IDs
// survive via defKey. Unchanged specs skip on the stored specHash.
async function amendComponent(comp, C) {
  comp.setSharedPluginData('ds_contracts', 'contractId', C.contractId);
  comp.setSharedPluginData('ds_contracts', 'version', C.version || '');
  // A STANDALONE component gets the identity stamps too. amendSet and the
  // create path carried these from the start; this path did not, so Card and
  // Kbd — the two Flowbite stems that are plain COMPONENTs rather than variant
  // sets — re-synced with no semantics and no propNames, and the inverter fell
  // back to guessing their host element and prop names. Same '' -> delete rule
  // as everywhere else. (No backticks in this region: it is inside the emitted
  // runtime's template literal, and one would terminate it.)
  comp.setSharedPluginData('ds_contracts', 'statePreviewAxis',
    C.statePreviewAxis ? JSON.stringify(C.statePreviewAxis) : '');
  comp.setSharedPluginData('ds_contracts', 'semantics',
    C.semantics ? JSON.stringify(C.semantics) : '');
  comp.setSharedPluginData('ds_contracts', 'propNames',
    C.propNames ? JSON.stringify(C.propNames) : '');
  comp.setSharedPluginData('ds_contracts', 'codeOnlyFacts', codeOnlyFactsStamp(C));
  const hash = specHash(C);
  if (comp.getSharedPluginData('ds_contracts', 'specHash') === hash) {
    var fpSkipC = comp.getSharedPluginData('ds_contracts', 'canvasFingerprint');
    if (!fpSkipC || fpSkipC.indexOf('${FINGERPRINT_VERSION}') !== 0) {
      dsStampFingerprints(comp);
    }
    return { name: C.setName, contractId: C.contractId, skipped: true, reason: 'unchanged', nodeId: comp.id, key: comp.key };
  }
  const report = { name: C.setName, contractId: C.contractId, amended: true, standalone: true, nodeId: comp.id, key: comp.key, addedProps: [], editedDefaults: [] };
  const defs = comp.componentPropertyDefinitions;
  const newKeys = {};
  const defKey = (name) => newKeys[name] ||
    Object.keys(defs).find((k) => k.split('#')[0] === name) || null;
  for (const w of [
    ...C.boolProps.map((bp) => ({ name: bp.property, type: 'BOOLEAN', def: bp.default })),
    ...(C.textProps || []).map((tp) => ({ name: tp.property, type: 'TEXT', def: tp.default })),
  ]) {
    const k = defKey(w.name);
    if (!k) { newKeys[w.name] = comp.addComponentProperty(w.name, w.type, w.def); report.addedProps.push(w.name); }
    else if (defs[k].type === w.type && defs[k].defaultValue !== w.def) {
      comp.editComponentProperty(k, { defaultValue: w.def });
      report.editedDefaults.push(w.name);
    }
  }
  const v = C.variants[0];
  const registry = { texts: [], slots: [], visibles: [] };
  for (const child of [...comp.children]) child.remove();
  applyFrameSpec(comp, v.spec);${hasSlot ? `
  registry.owner = comp;` : ''}
  const built = [];
  for (const childSpec of v.spec.children || []) {
    const childNode = await buildNode(childSpec, registry);
    comp.appendChild(childNode);${overflowPropagateCall(hasAbsolute || hasInsetOverlay, 'childNode', 'comp')}
    built.push([childSpec, childNode]);
    applyOverlay(comp, childNode, childSpec);${absoluteCall(hasAbsolute, 'comp, childNode, childSpec')}
    if (childSpec.pct != null) {
      try { childNode.resize(Math.max(1, Math.round(comp.width * childSpec.pct)), childNode.height); childNode.primaryAxisSizingMode = 'FIXED'; } catch (e) { degrade('FC-RT-METER-RESIZE-REFUSED', childNode, 'the meter fraction could not be applied (resize / FIXED refused); the track is not fixed-width', e); }
    }
    if (
      childSpec.type === 'frame' && (!childSpec.children || childSpec.children.length === 0) &&
      !childSpec.fixedHeight && !(childSpec.lits && childSpec.lits.height !== undefined) && !childSpec.shape &&
      !childSpec.overlay && !childSpec.insetOverlay && !childSpec.absolute
    ) {
      // #60 fix 4 (standalone amend path): same empty-child declared default.
      try { childNode.layoutSizingVertical = 'FILL'; } catch (e) { degrade('FC-RT-FILL-SIZING-REFUSED', childNode, 'the empty box could not take the parent height (layoutSizingVertical FILL refused)', e); }
    }
    if (childSpec.fillW && !(childSpec.type === 'text' && !childSpec.textTruncation && childSpec.fillText !== true) && 'layoutSizingHorizontal' in childNode) {
      try { childNode.layoutSizingHorizontal = 'FILL'; } catch (e) { degrade('FC-RT-FILL-SIZING-REFUSED', childNode, 'the compiled FILL width was refused (layoutSizingHorizontal FILL); the child keeps its drawn width', e); }
    }${insetOverlayCall(hasInsetOverlay, 'comp, childNode, childSpec')}
  }${gridChildrenCall(hasGrid, 'comp, v.spec, built')}${outOfFlowResizeCall(hasInsetOverlay || hasAbsolute, 'comp, built')}${birthBoxCall(hasChildlessBox, 'comp', 'v.spec')}
  for (const t of registry.texts) {
    let k = defKey(t.prop);
    if (!k) { k = comp.addComponentProperty(t.prop, 'TEXT', t.default); newKeys[t.prop] = k; report.addedProps.push(t.prop); }
    else if (defs[k] && defs[k].defaultValue !== t.default && !report.editedDefaults.includes(t.prop)) {
      comp.editComponentProperty(k, { defaultValue: t.default });
      report.editedDefaults.push(t.prop);
    }
    t.node.componentPropertyReferences = { characters: k };
  }
  for (const sl of registry.slots) {
    let k = defKey(sl.spec.slotProperty);
    if (k && defs[k] && defs[k].type !== 'SLOT') {
      if (defs[k].type !== 'INSTANCE_SWAP') {
        throw new Error(
          'Slot "' + sl.spec.slotProperty + '": the component already carries a ' + defs[k].type +
          ' property with that name — a slot cannot adopt it, and deleting it would strip every instance override bound to it; rename the contract slot (slot.bindings.figma.property) or retire the property in Figma',
        );
      }
      await migrateLegacySlotProperty(comp, k, defs[k], sl.spec.slotProperty, report);
      k = null;
    }
    const bound = bindSlot(comp, sl, k);
    if (!k) {
      newKeys[sl.spec.slotProperty] = bound.key;
      report.addedProps.push(sl.spec.slotProperty);
    } else if (bound.rebound) {
      report.preservedSlots = (report.preservedSlots || []).concat([sl.spec.slotProperty]);
    }
    if (sl.spec.slotOptional) {
      let vk = defKey('Show ' + sl.spec.slotProperty);
      if (!vk) { vk = comp.addComponentProperty('Show ' + sl.spec.slotProperty, 'BOOLEAN', false); newKeys['Show ' + sl.spec.slotProperty] = vk; }
      sl.slot.componentPropertyReferences = { slotContentId: bound.key, visible: vk };
      sl.slot.visible = false;
    }
  }
  for (const vis of registry.visibles) {
    const k = defKey(vis.prop);
    if (!k) continue;
    vis.node.componentPropertyReferences = { visible: k };
    vis.node.visible = vis.default;
  }
  comp.description = C.description;
  if (C.documentationLinks && C.documentationLinks.length > 0) comp.documentationLinks = C.documentationLinks;
  comp.setSharedPluginData('ds_contracts', 'specHash', hash);
  dsStampFingerprints(comp);
  // Re-fit (or adopt into) the host section — mirrors amendSet.
  const compPage2 = comp.parent && comp.parent.type === 'SECTION' ? comp.parent.parent : comp.parent;
  if (compPage2 && compPage2.type === 'PAGE') ensureHostSection(compPage2, comp, comp.name);
  return report;
}

async function syncOne(C) {
  // Semantic marker → stable anchor → unique explicit legacy-generated name.
  // A same-name foreign node has neither marker and is never adopted.
  let existing = resolveComponentIdentity(
    { contractId: C.contractId, anchorKey: C.anchorKey, name: C.setName },
    'Sync target "' + C.setName + '"',
    true,
  );
  // CREATE-ONLY APPLY DOOR. Amend-in-place is the product — it is how a
  // designer's file stays in sync without losing node ids or keys — but it
  // means "apply this bundle" on a file that already carries these stems
  // REWRITES them. A first look, a spare file, or any run that must not touch
  // shipped pages needs a door that cannot write over existing work.
  //
  // Set globalThis.DS_CREATE_ONLY = true before running this script and an
  // already-identified set is REFUSED BY NAME instead of amended: nothing is
  // written to it, not even the identity re-stamp below. Fresh stems on the
  // same file still create normally, so a partially-populated file fills in
  // its gaps without disturbing what is already there.
  //
  // This deliberately adds NO second identity scheme: the same
  // resolveComponentIdentity decides what "already exists" means, so the door
  // can never adopt a node the amend path would have refused.
  const DS_CREATE_ONLY =
    typeof globalThis !== 'undefined' && globalThis.DS_CREATE_ONLY === true;
  if (existing && DS_CREATE_ONLY) {
    return {
      name: C.setName,
      contractId: C.contractId,
      skipped: true,
      createOnly: true,
      reason: 'create-only apply: "' + C.setName + '" already exists on this file (' +
        existing.type + ' ' + existing.id + ') — refusing to amend it. Re-run without ' +
        'DS_CREATE_ONLY to sync it in place, or apply to a file that does not carry it.',
      nodeId: existing.id,
      key: existing.key,
    };
  }
  if (existing && existing.getSharedPluginData('ds_contracts', 'contractId') === '') {
    existing.setSharedPluginData('ds_contracts', 'contractId', C.contractId);
  }
  if (existing && existing.type === 'COMPONENT_SET' && C.isSet) {
    return await amendSet(existing, C);
  }
  // #60 fix 3: standalone COMPONENTs (Badge/Tag class) amend in place too —
  // the "amend supports variant sets in v1" skip forced delete+recreate and
  // re-minted node ids/keys (Phase B-2 named finding 2).
  if (existing && existing.type === 'COMPONENT' && !C.isSet) {
    return await amendComponent(existing, C);
  }
  if (existing) {
    existing.setSharedPluginData('ds_contracts', 'contractId', C.contractId);
    return { name: C.setName, contractId: C.contractId, skipped: true, reason: 'set/standalone shape mismatch (' + existing.type + ' vs isSet=' + C.isSet + ') — a human retires the old node', nodeId: existing.id, key: existing.key };
  }

  // A same-named unmarked set is foreign: leave it alone, disambiguate ours.
  let displayName = C.setName;
  for (const page of figma.root.children) {
    const foreign = page.findOne(
      (n) => (n.type === 'COMPONENT_SET' || n.type === 'COMPONENT') && n.name === C.setName,
    );
    if (foreign) { displayName = C.setName + ' (' + C.contractId + ')'; break; }
  }

  // One page per component (see figma-sync/arrange.js for the file layout).
  let compPage = figma.root.children.find((p) => p.name === displayName);
  if (!compPage) { compPage = figma.createPage(); compPage.name = displayName; }

  const EV = withStateAxis(C);
  const built = [];
  for (const v of EV) {
    const registry = { texts: [], slots: [], visibles: [] };
    const comp = await buildNode(v.spec, registry);
    built.push({ v, comp, registry });
  }

  let target;
  if (C.isSet) {
    // combineAsVariants requires the nodes to already be ON the parent page.
    for (const b of built) compPage.appendChild(b.comp);
    target = figma.combineAsVariants(built.map((b) => b.comp), compPage);
  } else {
    target = built[0].comp;
    compPage.appendChild(target);
  }

  // Component properties are minted on the PROPERTY OWNER — the SET for a
  // variant component, the component itself for a standalone — AFTER
  // combineAsVariants, one key per property name, wired into every variant.
  // (2026-07-21, live-canvas finding, handoff 08#1: the old per-variant
  // pre-combine minting produced id-suffixed keys that real set-instances
  // never surface, so an instance's TEXT property silently failed to apply —
  // repeated Badge instances kept the default "Badge" live. The amend path
  // (amendSet) always minted set-level; the create path now matches it.)
  const keys = {};
  const mintOnce = (name, type, def, opts) => {
    if (!keys[name]) keys[name] = target.addComponentProperty(name, type, def, opts);
    return keys[name];
  };
  for (const bp of C.boolProps) mintOnce(bp.property, 'BOOLEAN', bp.default);
  for (const tp of C.textProps || []) mintOnce(tp.property, 'TEXT', tp.default);
  for (const b of built) {
    for (const t of b.registry.texts) {
      t.node.componentPropertyReferences = { characters: mintOnce(t.prop, 'TEXT', t.default) };
    }
    for (const s of b.registry.slots) {
      // UNIFICATION (probe 2c): each variant's createSlot() minted its OWN
      // property; after combineAsVariants they all sit on the set under the
      // same display name. The first variant's id is canonical — every other
      // slot node rebinds to it and its duplicate is deleted, so the set ends
      // with ONE SLOT property that instance fills can ride across a variant
      // switch.
      const bound = bindSlot(target, s, keys[s.spec.slotProperty] || null);
      keys[s.spec.slotProperty] = bound.key;
      if (s.spec.slotOptional) {
        s.slot.componentPropertyReferences = {
          slotContentId: bound.key,
          visible: mintOnce('Show ' + s.spec.slotProperty, 'BOOLEAN', false),
        };
        s.slot.visible = false;
      }
    }
    for (const vis of b.registry.visibles) {
      const key = keys[vis.prop];
      if (!key) continue;
      vis.node.componentPropertyReferences = { visible: key };
      vis.node.visible = vis.default;
    }
  }

  if (C.isSet) {
    // Tight grid: rows = first axis, columns = second; per-track max sizing.
    const specByName = new Map(EV.map((s) => [s.name, s]));
    const rowsN = Math.max(...EV.map((v) => v.row)) + 1;
    const colsN = Math.max(...EV.map((v) => v.col)) + 1;
    const colWs = new Array(colsN).fill(0);
    const rowHs = new Array(rowsN).fill(0);
    for (const child of target.children) {
      const spec = specByName.get(child.name);
      if (!spec) continue;
      colWs[spec.col] = Math.max(colWs[spec.col], child.width);
      rowHs[spec.row] = Math.max(rowHs[spec.row], child.height);
    }
    for (const child of target.children) {
      const spec = specByName.get(child.name);
      if (!spec) continue;
      let x = PAD, y = PAD;
      for (let i = 0; i < spec.col; i++) x += colWs[i] + PAD;
      for (let i = 0; i < spec.row; i++) y += rowHs[i] + PAD;
      child.x = x;
      child.y = y;
    }
    const totalW = colWs.reduce((a, b) => a + b, 0) + PAD * (colsN + 1);
    const totalH = rowHs.reduce((a, b) => a + b, 0) + PAD * (rowsN + 1);
    target.resizeWithoutConstraints(totalW, totalH);
  }
  target.name = displayName;
  target.description = C.description;
  if (C.documentationLinks && C.documentationLinks.length > 0) target.documentationLinks = C.documentationLinks;
  target.setSharedPluginData('ds_contracts', 'specHash', specHash(C));
  target.setSharedPluginData('ds_contracts', 'contractId', C.contractId);
  target.setSharedPluginData('ds_contracts', 'version', C.version || '');
  target.setSharedPluginData('ds_contracts', 'statePreviewAxis',
    C.statePreviewAxis ? JSON.stringify(C.statePreviewAxis) : '');
  target.setSharedPluginData('ds_contracts', 'semantics',
    C.semantics ? JSON.stringify(C.semantics) : '');
  target.setSharedPluginData('ds_contracts', 'propNames',
    C.propNames ? JSON.stringify(C.propNames) : '');
  target.setSharedPluginData('ds_contracts', 'codeOnlyFacts', codeOnlyFactsStamp(C));
  // PROTOTYPE WIRING — BEFORE the fingerprint stamp (see amendSet).
  const wiredReactions = await wireStateReactions(target, new Map(built.map((b) => [b.v.name, b.comp])), C);
  dsStampFingerprints(target);
  ensureHostSection(compPage, target, displayName);

  return {
    name: C.setName,
    contractId: C.contractId,
    nodeId: target.id,
    key: target.key,
    variants: C.isSet ? target.children.length : 1,
    properties: Object.keys(target.componentPropertyDefinitions || {}),
    ...(wiredReactions > 0 ? { wiredReactions: wiredReactions } : {}),
  };
}

const results = [];
for (const C of COMPONENTS) {
  // Every per-set result — created, amended, skipped as unchanged, refused
  // by the create-only door — carries the named receipt, so the plugin's run
  // report can list the facts under the set whatever the sync did.
  const degradedFrom = DEGRADATIONS.length;
  results.push(withCodeOnlyFacts(await syncOne(C), C, degradedFrom));
}${hasSlot ? `
// Proposal §6.4 — the dashed "Slot" utility goes LAST, and only once no
// INSTANCE_SWAP slot reference remains anywhere in the file.
const slotUtility = retireSlotUtility();` : ''}
return { createdNodeIds: results.filter((r) => !r.skipped).map((r) => r.nodeId), results${hasSlot ? `, ...(slotUtility ? { slotUtility: slotUtility } : {})` : ''} };
`;
}

  return { buildTokensScript, compileComponentData, buildComponentScript, buildBatchScript };
}

/** The compiled engine type — the CLI shell and the barrel share it. */
export type FigmaEngine = ReturnType<typeof createFigmaEngine>;
