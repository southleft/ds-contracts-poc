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
 *                       parts, and slots (Slot-utility placeholder +
 *                       INSTANCE_SWAP with preferredValues resolved from
 *                       `accepts`; optional slots get a "Show X" BOOLEAN).
 *
 * Fidelity scope (deliberate, documented in docs/05 + docs/08):
 * - fontSize/family/weight are not variable-bindable → set numerically from
 *   resolved token values (weight → Inter style name).
 * - Interaction states are CSS concerns; not represented in Figma.
 * - Slot `accepts` maps to INSTANCE_SWAP preferredValues (soft constraint);
 *   Figma's native SLOT property type + SlotSettings is the upgrade target.
 */
import {
  DECLARED_CHANNELS,
  TOKEN_CHANNELS,
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
  type Contract,
  type Part,
  type Prop,
} from '../scripts/contract-schema.js';
import { flattenTokens, aliasTarget, px, pxOrNull, type TokenEntry, type TokenTreeInput } from './tokens.js';
import { FINGERPRINT_SRC } from './canvas-fingerprint.js';
import { isMultiRoot, topRoots, validateContract } from './emit-react.js';


export interface LayoutSpec {
  mode: 'HORIZONTAL' | 'VERTICAL';
  primary: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  /** BASELINE is native, but ONLY on HORIZONTAL auto-layout — Figma throws on
   *  a VERTICAL frame. `layoutSpec` never produces it under mode VERTICAL. */
  counter: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
  stretchChildren?: boolean;
  /** v15 (S4/matrix a.8): flex-wrap: wrap → layoutWrap 'WRAP' (native). */
  wrap?: boolean;
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
   *  compileComponentData into the code-only-fact footnote (†) and STRIPPED
   *  before the spec JSON is emitted. */
  channelMiss?: string[];
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
   *  rendering residual margins as CSS margins. */
  margins?: { top?: number; right?: number; bottom?: number; left?: number };
  /** Round 5d: variable names for token-carried margin channels — consumed
   *  by the sibling-gap → itemSpacing lowering (the gap then BINDS the
   *  margin's own variable), stripped before serialization. */
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
  /** PIXEL line height (dump v1.3) — the runtime sets
   *  node.lineHeight = { unit: 'PIXELS', value }. */
  lineHeight?: number;
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
  // text
  characters?: string;
  fontSize?: number;
  fontStyle?: string;
  /** Name of the derived text style whose definition the node's font
   *  bindings exactly match — the runtime sets textStyleId when the style
   *  exists in the file (raw fontName/fontSize stand as the fallback). */
  textStyle?: string;
  textFill?: string;
  contentProp?: string;
  // instance
  dep?: string;
  depProps?: Record<string, string | boolean>;
  // slot
  slotProperty?: string;
  slotOptional?: boolean;
  slotAccepts?: string[];
  /** Design-time default content. >1 item = multi-child slot: rendered
   *  directly, NO swap property (INSTANCE_SWAP holds one instance — the
   *  native SLOT property type is the migration target, see docs/08). */
  slotDefault?: Array<{ dep: string; props?: Record<string, string | boolean> }>;
  children?: NodeSpec[];
}

export interface VariantSpec {
  name: string;
  row: number;
  col: number;
  spec: NodeSpec;
}

export interface ComponentData {
  setName: string;
  contractId: string;
  anchorKey: string | null;
  description: string;
  isSet: boolean;
  boolProps: Array<{ property: string; default: boolean }>;
  /** Text props with no bound text node (aria-label-only props like
   *  StatusDot.label) — added as unbound TEXT properties so the API surface
   *  matches the contract. */
  textProps: Array<{ property: string; default: string }>;
  fontStyles: string[];
  variants: VariantSpec[];
  /** figmaStatePreviews: canvas-only preview variants carrying the "State"
   *  axis. Kept SEPARATE from `variants` (the pure enum-API cartesian) —
   *  the runtimes merge them via withStateAxis, renaming base variants with
   *  an explicit State=Default segment. Omitted entirely when the contract
   *  does not opt in, so unchanged contracts keep a stable specHash. */
  stateVariants?: VariantSpec[];
  /** PROTOTYPE WIRING: deterministic Figma prototype reactions binding each
   *  base (State=Default) variant to its hover/active preview twin, so a
   *  generated set actually SWAPS in presentation mode. Names, never node
   *  ids — the runtime resolves them against the set it just built/amended.
   *  Omitted entirely when empty (a contract that does not opt in keeps a
   *  byte-identical specHash). NEVER carried inside spec/NodeSpec: the
   *  canvas-gate channels cannot measure reactions and must not grow the
   *  concept. */
  stateReactions?: StateReaction[];
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
      if (!target) return entry.value;
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
}

function deriveTextStyles(): DerivedTextStyle[] {
  const out: DerivedTextStyle[] = [];
  for (const [p] of semantic) {
    const m = p.match(/^font\.(.+?)\.size(?:\.([^.]+))?$/);
    if (!m) continue;
    const group = m[1];
    const name = [group, ...(m[2] ? [m[2]] : [])].join('/').split('.').join('/');
    const weightPath = `font.${group}.weight`;
    const fontStyle = semantic.has(weightPath)
      ? (FONT_STYLE_BY_WEIGHT[px(resolveLiteral(weightPath))] ?? 'Medium')
      : 'Medium';
    out.push({ name, tokenPath: p, fontSize: px(resolveLiteral(p)), fontStyle });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

const derivedTextStyles = deriveTextStyles();
const textStyleByTokenPath = new Map(derivedTextStyles.map((t) => [t.tokenPath, t]));

// ---------------------------------------------------------------------------
// 01-tokens.js (unchanged mechanism from v1)
// ---------------------------------------------------------------------------

function buildTokensScript(fileKey: string | null): string {
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

let prim = collections.find((c) => c.name === 'Primitives');
if (!prim) prim = figma.variables.createVariableCollection('Primitives');
if (prim.modes[0].name !== 'Value') prim.renameMode(prim.modes[0].modeId, 'Value');
const primModeId = prim.modes[0].modeId;
const primByName = {};
for (const v of varsIn(prim)) primByName[v.name] = v;
let createdPrim = 0;
for (const t of PRIMITIVES) {
  let v = primByName[t.name];
  if (!v) {
    v = figma.variables.createVariable(t.name, prim, t.type);
    primByName[t.name] = v;
    createdPrim++;
  }
  v.setValueForMode(primModeId, t.type === 'COLOR' ? hexToRgb(t.value) : t.value);
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
  if (!v) {
    v = figma.variables.createVariable(t.name, brandCol, t.type);
    brandByName[t.name] = v;
    createdBrand++;
  }
  for (const modeName of BRAND_MODES) {
    const target = primByName[t.perBrand[modeName]];
    if (!target) throw new Error('Missing primitive ' + t.perBrand[modeName] + ' for ' + t.name);
    v.setValueForMode(brandModeIds[modeName], { type: 'VARIABLE_ALIAS', id: target.id });
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
  if (!v) {
    v = figma.variables.createVariable(t.name, sem, t.type);
    semByName[t.name] = v;
    createdSem++;
  }
  const lightVar = primByName[t.light] || brandByName[t.light];
  const darkVar = primByName[t.dark] || brandByName[t.dark];
  if (!lightVar || !darkVar) throw new Error('Missing primitive/brand for ' + t.name);
  v.setValueForMode(lightModeId, { type: 'VARIABLE_ALIAS', id: lightVar.id });
  v.setValueForMode(darkModeId, { type: 'VARIABLE_ALIAS', id: darkVar.id });
  v.scopes = t.scopes;
  v.setVariableCodeSyntax('WEB', t.codeSyntax);
}

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
  await figma.loadFontAsync({ family: 'Inter', style: t.fontStyle });
  s.name = t.name;
  s.fontName = { family: 'Inter', style: t.fontStyle };
  s.fontSize = t.fontSize;
  s.description = 'ds_contracts: derived from tokens/' + t.tokenPath;
}

return {
  primitives: { collectionId: prim.id, total: PRIMITIVES.length, created: createdPrim },
  brand: { collectionId: brandCol.id, modes: BRAND_MODES, total: BRAND.length, created: createdBrand },
  semantic: { collectionId: sem.id, total: SEMANTIC.length, created: createdSem },
  textStyles: { total: TEXT_STYLES.length, created: createdStyles },
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
  /** Round 4: token dot-path behind a part's CSS `fill` channel — promoted
   *  svg hosts' glyph paint (attribute-less paths inherit it). */
  glyphFillPath?: string;
  fontSize?: number;
  fontStyle?: string;
  /** Token dot-path behind fontSize — text nodes whose bindings exactly match
   *  a derived text style's definition carry that style (see matchTextStyle). */
  fontSizePath?: string;
  /** PIXEL line height (dump v1.3) — resolved literal. */
  lineHeight?: number;
  /** v15: PIXEL letter spacing — resolved literal (lineHeight discipline). */
  letterSpacing?: number;
  /** v15 declared text facts (draw verdicts) — inherited to text children
   *  like every other text channel. */
  textCase?: NodeSpec['textCase'];
  textDecoration?: NodeSpec['textDecoration'];
  textAlignH?: NodeSpec['textAlignH'];
  fontFamily?: string;
  textTruncation?: boolean;
}

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
  notes: Set<string>,
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
  notes.add(
    `root: viewport-pinned overlay scrim (inset:0) — captured box ${was} is the CAPTURE STAGE, not the component; the canvas box is bound to the overlay's content (deliberate canvas-vs-DOM divergence; the contract's inset/width/height channels are unchanged)`,
  );
}

function layoutSpec(part: Part, isRoot: boolean, subst: Record<string, string> = {}): LayoutSpec {
  // v7 layoutByProp: each canvas variant is compiled with every enum axis's
  // value (subst), so the per-variant layout override resolves right here.
  const l = resolveLayout(part, subst);
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
): TextCtx {
  const next: TextCtx = { ...ctx };
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
          miss(spec, cssProp, 'per-side border COLOURS disagree (or no border width is carried) — one Figma strokes paint list serves all four sides.');
        }
        break;
      case 'border-width':
        spec.bindings = { ...spec.bindings, strokeWeight: varName };
        break;
      case 'color':
        next.textFill = varName;
        next.textFillPath = tokenPath;
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
        break;
      case 'font-weight':
        next.fontStyle = FONT_STYLE_BY_WEIGHT[px(resolveLiteral(tokenPath))] ?? 'Medium';
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
          miss(spec, cssProp, 'the cross axis of a VERTICAL stack — Figma has one itemSpacing and it is the main axis.');
        }
        break;
      case 'row-gap':
        if (spec.layout?.mode === 'VERTICAL') {
          spec.bindings = { ...spec.bindings, itemSpacing: varName };
        } else {
          miss(spec, cssProp, 'the cross axis of a HORIZONTAL stack — Figma has one itemSpacing and it is the main axis.');
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
          miss(spec, cssProp, outlineRefusal(outlinePaints && outlineColorPaints, borderClaimsStroke, 'outline-width'));
        }
        break;
      case 'outline-width':
        if (outlineDrawsStroke) {
          spec.bindings = { ...spec.bindings, strokeWeight: varName };
        } else {
          miss(spec, cssProp, outlineRefusal(outlinePaints && outlineColorPaints, borderClaimsStroke, 'outline-color'));
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
        // dump v1.3: PIXEL line heights ride text nodes.
        next.lineHeight = px(resolveLiteral(tokenPath));
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
        if (reg && reg.canvas !== 'draw') miss(spec, cssProp, reg.note);
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
function miss(spec: NodeSpec, cssProp: string, why: string): void {
  (spec.channelMiss ??= []).push(`${cssProp}: ${why}`);
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

/** v14 literals: distribute a part's resolved literal channels into the
 *  spec's `lits` struct (frame-kind runtime application) and the text ctx
 *  (font-size/line-height). Channels with no canvas projection here
 *  (`inherit`/`currentColor` paints, letter-spacing) stay CSS-side — the
 *  same documented fidelity scope as font-family. */
function applyLiterals(spec: NodeSpec, lits: Record<string, string>, ctx: TextCtx): TextCtx {
  const next: TextCtx = { ...ctx };
  const li = () => (spec.lits ??= {});
  for (const [cssProp, value] of Object.entries(lits)) {
    switch (cssProp) {
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
          (spec.channelMiss ??= []).push(`width: ${value.trim()} — a fractional width has no canvas twin (Figma sizing is FIXED / HUG / FILL; only 100% lowers, as FILL)`);
        }
        break;
      }
      case 'height': {
        if (isHugKeyword(value)) break; // HUG = no fixed size compiled (see applyTokens)
        const n = parseLitPx(value);
        if (n !== undefined) li().height = n;
        break;
      }
      case 'min-width': { const n = parseLitPx(value); if (n !== undefined) li().minWidth = n; break; }
      case 'min-height': { const n = parseLitPx(value); if (n !== undefined) li().minHeight = n; break; }
      case 'padding-block': { const n = parseLitPx(value); if (n !== undefined) { li().paddingTop = n; li().paddingBottom = n; } break; }
      case 'padding-inline': { const n = parseLitPx(value); if (n !== undefined) { li().paddingLeft = n; li().paddingRight = n; } break; }
      // Round 4 (canvas-gate finding): literal padding longhands were dropped.
      case 'padding-left': { const n = parseLitPx(value); if (n !== undefined) li().paddingLeft = n; break; }
      case 'padding-right': { const n = parseLitPx(value); if (n !== undefined) li().paddingRight = n; break; }
      case 'padding-top': { const n = parseLitPx(value); if (n !== undefined) li().paddingTop = n; break; }
      case 'padding-bottom': { const n = parseLitPx(value); if (n !== undefined) li().paddingBottom = n; break; }
      case 'gap': { const n = parseLitPx(value); if (n !== undefined) li().itemSpacing = n; break; }
      // Round 5: gap longhands (see the token side) — main-axis only.
      case 'column-gap': {
        const n = parseLitPx(value);
        if (n !== undefined && (spec.layout?.mode ?? 'HORIZONTAL') === 'HORIZONTAL') li().itemSpacing = n;
        break;
      }
      case 'row-gap': {
        const n = parseLitPx(value);
        if (n !== undefined && spec.layout?.mode === 'VERTICAL') li().itemSpacing = n;
        break;
      }
      // Round 5: literal margin channels — same lowering as the token side.
      case 'margin-top': { const n = parseLitPx(value); if (n !== undefined) spec.margins = { ...spec.margins, top: n }; break; }
      case 'margin-right': { const n = parseLitPx(value); if (n !== undefined) spec.margins = { ...spec.margins, right: n }; break; }
      case 'margin-bottom': { const n = parseLitPx(value); if (n !== undefined) spec.margins = { ...spec.margins, bottom: n }; break; }
      case 'margin-left': { const n = parseLitPx(value); if (n !== undefined) spec.margins = { ...spec.margins, left: n }; break; }
      case 'border-radius': { const n = parseLitPx(value); if (n !== undefined) li().radius = n; break; }
      case 'border-width': { const n = parseLitPx(value); if (n !== undefined) li().strokeWeight = n; break; }
      // v15 (S4): per-corner literal radii and per-side literal widths.
      case 'border-top-left-radius': { const n = parseLitPx(value); if (n !== undefined) (li().radiusCorners ??= {}).tl = n; break; }
      case 'border-top-right-radius': { const n = parseLitPx(value); if (n !== undefined) (li().radiusCorners ??= {}).tr = n; break; }
      case 'border-bottom-left-radius': { const n = parseLitPx(value); if (n !== undefined) (li().radiusCorners ??= {}).bl = n; break; }
      case 'border-bottom-right-radius': { const n = parseLitPx(value); if (n !== undefined) (li().radiusCorners ??= {}).br = n; break; }
      case 'border-top-width': { const n = parseLitPx(value); if (n !== undefined) (li().strokeSides ??= {}).top = n; break; }
      case 'border-right-width': { const n = parseLitPx(value); if (n !== undefined) (li().strokeSides ??= {}).right = n; break; }
      case 'border-bottom-width': { const n = parseLitPx(value); if (n !== undefined) (li().strokeSides ??= {}).bottom = n; break; }
      case 'border-left-width': { const n = parseLitPx(value); if (n !== undefined) (li().strokeSides ??= {}).left = n; break; }
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
      case 'letter-spacing': { const n = parseLitPx(value); if (n !== undefined) next.letterSpacing = n; break; }
      case 'font-size': {
        const n = parseLitPx(value);
        if (n !== undefined) { next.fontSize = n; next.fontSizePath = undefined; }
        break;
      }
      case 'line-height': { const n = parseLitPx(value); if (n !== undefined) next.lineHeight = n; break; }
      default:
        break;
    }
  }
  if (spec.lits && Object.keys(spec.lits).length === 0) delete spec.lits;
  return next;
}

/** v15: first font-family stack entry, unquoted — the canvas family. */
function firstFamily(stack: string): string | undefined {
  const first = splitTopLevel(stack)[0]?.trim().replace(/^["']|["']$/g, '');
  return first && !/^(sans-serif|serif|monospace|system-ui|ui-sans-serif|ui-serif|ui-monospace)$/.test(first)
    ? first
    : undefined;
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
  const t = applyTokens(spec, resolveTokens(part, subst), subst, ctx, part.hugsBelowMaxWidth, part.declared);
  const l = applyLiterals(spec, resolveLiterals(part, subst), t);
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
  // Round 4: declared aspect-ratio draws natively — height follows the bound
  // width when the contract carries no height channel (Avatar/Thumbnail
  // squares whose real height rides a pseudo-element padding hack).
  // Round 5: the LITERAL width channel (v14 lits — Avatar/Thumbnail carry
  // per-size width literals, not token widths) lowers the same way.
  const aspect = part.declared?.['aspect-ratio'];
  if (aspect && !spec.fixedHeight && spec.lits?.height === undefined) {
    const m = /^([\d.]+)(?: \/ ([\d.]+))?$/.exec(aspect);
    if (m) {
      const ratio = Number(m[1]) / Number(m[2] ?? '1');
      if (ratio > 0 && spec.fixedWidth && Number.isFinite(spec.fixedWidth.px)) {
        spec.fixedHeight = { px: spec.fixedWidth.px / ratio };
      } else if (ratio > 0 && spec.lits?.width !== undefined) {
        spec.lits.height = spec.lits.width / ratio;
      }
    }
  }
  return d;
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
  for (const child of Object.values(part.parts ?? {})) {
    const aspect = child.declared?.['aspect-ratio'];
    if (!aspect || child.declared?.['position'] !== 'absolute') continue;
    const m = /^([\d.]+)(?: \/ ([\d.]+))?$/.exec(aspect);
    if (!m) continue;
    const ratio = Number(m[1]) / Number(m[2] ?? '1');
    if (ratio > 0) {
      (spec.lits ??= {}).height = w / ratio;
      return;
    }
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
  if (t.fontSize !== ctx.fontSize || t.fontStyle !== (ctx.fontStyle ?? 'Medium')) return undefined;
  return t.name;
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
  const hasPreviews = Boolean(dep.figmaStatePreviews) && dep.states.length > 0;
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
  const hex = paintPath ? String(resolveLiteral(paintPath)) : '#000000';
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
  if (paintPath && !svgTagHasFill && !childHasFill) {
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
  spec.children = [
    {
      type: 'text',
      name: 'placeholder',
      characters:
        typeof prop?.default === 'string'
          ? prop.default
          : (part.attrs?.placeholder ?? ''),
      fontSize: childCtx.fontSize ?? 16,
      fontStyle: childCtx.fontStyle ?? 'Medium',
      ...(childCtx.lineHeight !== undefined ? { lineHeight: childCtx.lineHeight } : {}),
      ...textExtras(childCtx),
      textStyle: matchTextStyle(childCtx),
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
  ledger?: string[],
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
        ledger?.push(
          `${dep.name} prop "${propName}" set to ${typeof rawValue === 'object' ? `a per-value lookup on "${rawValue.prop}"` : JSON.stringify(rawValue)}: not wired — the dependency binds it figma kind NONE (code-only), so the canvas instance renders ${dep.name}'s own default`,
        );
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
        ledger?.push(
          `${dep.name} variant property "${fig.property}" bound to "${canonical}": not wired — the dependency emits standalone (single variant, no variant properties) and renders its only form${sole !== undefined ? ` ("${sole}")` : ''}`,
        );
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
      ledger?.push(
        `${dep.name} children text "${text}": not wired — ${dep.id} exposes no TEXT component property for it (the canvas carries such labels as raw instance overrides, which the contract vocabulary does not model)`,
      );
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
    if (raw === undefined) continue;
    const applies =
      sw.equals !== undefined
        ? subst[sw.prop] === sw.equals
        : subst[sw.prop] !== undefined
          ? subst[sw.prop] === 'true' // VARIANT-bound bool: a compiled axis
          : contract.props.find((p) => p.name === sw.prop)?.default === true;
    if (!applies) continue;
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
  const positioned = (p: Part): boolean => p.declared?.['position'] === 'absolute';
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
    ...(ctx.letterSpacing !== undefined ? { letterSpacing: ctx.letterSpacing } : {}),
    ...(ctx.textCase !== undefined ? { textCase: ctx.textCase } : {}),
    ...(ctx.textDecoration !== undefined ? { textDecoration: ctx.textDecoration } : {}),
    ...(ctx.textAlignH !== undefined ? { textAlignH: ctx.textAlignH } : {}),
    ...(ctx.fontFamily !== undefined ? { fontFamily: ctx.fontFamily } : {}),
    ...(ctx.textTruncation ? { textTruncation: true } : {}),
  };
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
        depProps: mapDepProps(dep, { ...(part.component!.props ?? {}), ...fields }, subst, part.component!.text),
      };
      applyVisibleWhen(spec, part, contract);
      return spec;
    });
  }
  return [partToSpec(name, part, contract, byId, ctx, subst)];
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
    const paintHex = paintPath ? String(resolveLiteral(paintPath)) : '#000000';
    const paintVar = svgSinglePaintVar(markup, paintHex, paintPath);
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
    applyVisibleWhen(frame, part, contract);
    return frame;
  }
  // v9 shape (#42): a REAL parametric node — geometry from the contract,
  // fill from tokens, placement/rotation from the compiled stylesWhen.
  if (part.shape) {
    const spec: NodeSpec = { type: 'shape', name, shape: { ...part.shape } };
    applyStyling(spec, part, subst, ctx);
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
    const depLedger: string[] = [];
    const spec: NodeSpec = {
      type: 'instance',
      name,
      dep: dep.name,
      depProps: mapDepProps(dep, part.component.props ?? {}, subst, part.component.text, depLedger),
    };
    for (const line of depLedger) (spec.channelMiss ??= []).push(line);
    // Round 2 iteration 9 — per-instance overrides (component.overrides):
    // natively a resize / image-fill / paint override on THIS instance, but
    // the canvas lowering is not carried this round — declared-not-drawn,
    // ledgered through the existing channelMiss footnote (never a silent
    // drop; the instance renders the child's own defaults).
    for (const [channel, ref] of Object.entries(part.component.overrides ?? {})) {
      (spec.channelMiss ??= []).push(
        `${name} per-instance override "${channel}" (${ref}): canvas emission not carried this round — the instance draws the child's own defaults`,
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
      slotProperty: slotFigmaProperty(part.slot),
      slotOptional: part.optional || undefined,
      slotAccepts: (part.slot.accepts ?? []).map((id) => byId.get(id)!.name),
    };
    if ((part.slot.defaultContent?.length ?? 0) > 0) {
      spec.slotDefault = part.slot.defaultContent!.map((item) => {
        const dep = byId.get(item.id)!;
        return { dep: dep.name, props: mapDepProps(dep, item.props ?? {}, subst, item.text) };
      });
    }
    applyStyling(spec, part, subst, ctx);
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
    textSpec.fontStyle = textCtx.fontStyle ?? 'Medium';
    textSpec.textStyle = matchTextStyle(textCtx);
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
    spec.fontStyle = textCtx.fontStyle ?? 'Medium';
    spec.textStyle = matchTextStyle(textCtx);
    spec.textFill = textCtx.textFill;
    if (textCtx.lineHeight !== undefined) spec.lineHeight = textCtx.lineHeight;
    Object.assign(spec, textExtras(textCtx));
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
    spec.fontStyle = textCtx.fontStyle ?? 'Medium';
    spec.textStyle = matchTextStyle(textCtx);
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
    } else if (part.declared?.['position'] === 'absolute') {
      // absolute-position round: overlay anatomy with carried offsets
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
    const isCandidate = (c: NodeSpec): boolean =>
      inFlow(c) &&
      !hasOwnWidth(c) &&
      (c.grow === true ||
        (s.layout?.stretchChildren === true &&
          (s.layout?.mode ?? 'HORIZONTAL') === 'VERTICAL' &&
          c.type !== 'instance'));
    const intrinsic = kids.some((c) => inFlow(c) && !isCandidate(c) && canHug(c));
    const ready = established || intrinsic;
    for (const c of kids) {
      const fills = ready && isCandidate(c);
      if (fills) c.fillW = true;
      walk(c, fills || hasOwnWidth(c));
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
  const textProp = contract.props.find(
    (p) => p.type === 'text' && p.bindings.code.prop === 'children',
  );
  // VARIANT-bound booleans are axes, not BOOLEAN component properties.
  const boolPropsData = contract.props
    .filter((p) => p.type === 'boolean' && !isVariantBool(p))
    .map((p) => ({ property: p.bindings.figma.property!, default: p.default === true }));
  const label = typeof textProp?.default === 'string' ? textProp.default : contract.name;

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
  const scrimNotes = new Set<string>();
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
    if (root.parts) {
      rootSpec.children = variantParts(root.parts, subst).flatMap(([childName, child]) =>
        partToSpecs(childName, child, contract, byId, ctx, subst),
      );
      if (isReversed(root, subst)) rootSpec.children.reverse();
    } else if (textProp) {
      rootSpec.children = [
        {
          type: 'text',
          name: 'label',
          characters: label,
          fontSize: ctx.fontSize ?? 16,
          fontStyle: ctx.fontStyle ?? 'Medium',
          textStyle: matchTextStyle(ctx),
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

  // figmaStatePreviews: compile the canvas-only "State" preview variants.
  // Bounded explosion: only the PRIMARY enum axis (the one whose tokens the
  // state overrides substitute; the first axis when overrides are variant-
  // independent) is multiplied — every other axis sits at its default.
  // Button (4 variants × 3 sizes, 3 states): 12 base + 4×3 = 24, not 48.
  const stateVariants: VariantSpec[] = [];
  if (contract.figmaStatePreviews && contract.states.length > 0) {
    const overrides = root.states ?? {};
    const substProps = statePreviewSubstProps(contract); // validated: ≤1
    const primaryIdx = Math.max(0, axes.findIndex((a) => substProps.includes(a.prop.name)));
    const primary = axes[primaryIdx] as (typeof axes)[number] | undefined;
    const primaryValues = primary ? primary.values : [null];
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
        if (root.parts) {
          // v13: part-level state overrides apply INSIDE the preview variant
          // (withPartStateOverrides) — the State=Disabled cell draws the
          // disabled label color, mirroring .root:disabled .label on the CSS
          // surfaces.
          const stateParts = withPartStateOverrides(root.parts, stateName, subst);
          rootSpec.children = variantParts(stateParts, subst).flatMap(([childName, child]) =>
            partToSpecs(childName, child, contract, byId, ctx, subst),
          );
          if (isReversed(root, subst)) rootSpec.children.reverse();
        } else if (textProp) {
          rootSpec.children = [
            {
              type: 'text',
              name: 'label',
              characters: label,
              fontSize: ctx.fontSize ?? 16,
              fontStyle: ctx.fontStyle ?? 'Medium',
              textStyle: matchTextStyle(ctx),
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

  // v15 (S4): declared-not-drawn facts land ON the component as description
  // text — the capability matrix's annotation copy, deduped and sorted for
  // deterministic emission. 'draw'-verdict base facts render natively and
  // need no note; state-plane declared facts are always annotated (state
  // previews do not draw declared facts yet — a named limit).
  const declaredNoteLines = new Set<string>();
  for (const { name: partName, part } of walkAnatomy(contract)) {
    const note = (channel: string, value: string, state?: string) => {
      const reg = DECLARED_CHANNELS[channel];
      if (!reg) return; // refused upstream by validateContract
      const drawn =
        reg.canvas === 'draw' && !state && !(channel === 'text-decoration-line' && value === 'overline');
      if (drawn) return;
      // Part D (owner directive, 2026-07-19): the annotation COPY no longer
      // lands on the canvas (it lives in repo receipts) — the set only feeds
      // the code-only-fact footnote (†) below.
      declaredNoteLines.add(`${partName}.${channel}: ${value}${state ? ` [${state}]` : ''}`);
    };
    for (const [ch, v] of Object.entries(part.declared ?? {})) note(ch, v);
    for (const [state, m] of Object.entries(part.declaredStates ?? {})) {
      for (const [ch, v] of Object.entries(m)) note(ch, v, state);
    }
  }
  // Gradient / shadow misses: collected off the compiled specs (they feed
  // the code-only-fact footnote) and STRIPPED from the emitted JSON — never
  // a silent drop, never emitted noise.
  const gradientMissLines = new Set<string>();
  const shadowMissLines = new Set<string>();
  // SILENT-LOSS ROUND (task #33, fix 3): channel misses ride the SAME
  // collection path as the gradient/shadow misses this file already had —
  // one "I had a value and could not draw it" mechanism, not three.
  const channelMissLines = new Set<string>();
  const stripMisses = (spec: NodeSpec) => {
    if (spec.gradientMiss !== undefined) {
      gradientMissLines.add(`${spec.name}.background-image: ${spec.gradientMiss}`);
      delete spec.gradientMiss;
    }
    if (spec.shadowMiss !== undefined) {
      shadowMissLines.add(`${spec.name}.box-shadow: ${spec.shadowMiss}`);
      delete spec.shadowMiss;
    }
    if (spec.channelMiss !== undefined) {
      for (const line of spec.channelMiss) channelMissLines.add(`${spec.name}.${line}`);
      delete spec.channelMiss;
    }
    // D5: compile-side flag only — the bounding already happened on the box.
    delete spec.scrimBounded;
    (spec.children ?? []).forEach(stripMisses);
  };
  for (const v of variants) stripMisses(v.spec);
  for (const v of stateVariants) stripMisses(v.spec);
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
  // Meter parts are runtime-sized (the canvas shows the defaults' fraction;
  // height follows the track) — a code-only fact like the rest.
  const hasMeter = walkAnatomy(contract).some((w) => w.part.meter);
  // Round 5: compiled facts the SYNC RUNTIME cannot apply natively — the
  // image-placeholder wash (raster content is runtime data), the block-root
  // width fact (no intrinsic width) — join the code-only footnote, never a
  // silent drop. (Round 5d: margin channels left this list — they now apply
  // on canvas as itemSpacing or the margin-box wrapper.)
  const hasPreviewOnlyFacts = [...variants, ...stateVariants].some((v) =>
    specSome(v.spec, (x) => x.imgPlaceholder === true || x.blockRoot === true),
  );
  // Part D (owner directive): every code-only fact — events, declared-not-
  // drawn channels, gradient/shadow misses, runtime-sized meters — leaves
  // exactly ONE canvas trace: a single trailing † on the caption line.
  const hasCodeOnlyFacts =
    (contract.events ?? []).length > 0 ||
    declaredNoteLines.size > 0 ||
    gradientMissLines.size > 0 ||
    shadowMissLines.size > 0 ||
    channelMissLines.size > 0 ||
    hasMeter ||
    scrimNotes.size > 0 ||
    hasPreviewOnlyFacts;

  return {
    setName: contract.name,
    contractId: contract.id,
    anchorKey: contract.anchors.figma.componentSetKey ?? null,
    // Part D (owner directive, 2026-07-19): the component description is ONE
    // short caption line — a name and a provenance pointer, nothing else.
    // The old paragraphs of capability-matrix copy (events, declared facts,
    // gradient misses, meter sizing) were meaningless to designers on the
    // canvas; the detailed docs stay in repo receipts. The single trailing
    // dagger marks that code-only facts exist. Plugin-data identity markers
    // (ds_contracts/*) are machine identity and remain untouched.
    description: `${contract.name} — generated from contract ${contract.id} v${contract.version}${hasCodeOnlyFacts ? ' †' : ''}`,
    isSet: variants.length + stateVariants.length > 1,
    boolProps: boolPropsData,
    textProps: textOnlyProps,
    fontStyles: [...fontStyles],
    variants,
    ...(stateVariants.length > 0 ? { stateVariants } : {}),
    ...(stateReactions.length > 0 ? { stateReactions } : {}),
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
  if (typeof spec.opacity === 'number') node.opacity = spec.opacity;`
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
function applyMarginBox(parent, childNode, childSpec) {
  const m = childSpec.margins;
  if (!m || childSpec.overlay || childSpec.insetOverlay || childSpec.absolute || childSpec.grow) return;
  try {
    if (childNode.layoutSizingHorizontal === 'FILL' || childNode.layoutSizingVertical === 'FILL') return;
  } catch (e) { /* nodes without layout sizing */ }
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
      if (sw.top !== undefined) node.strokeTopWeight = sw.top;
      if (sw.right !== undefined) node.strokeRightWeight = sw.right;
      if (sw.bottom !== undefined) node.strokeBottomWeight = sw.bottom;
      if (sw.left !== undefined) node.strokeLeftWeight = sw.left;
    }
    if (spec.lits && spec.lits.radius !== undefined) node.cornerRadius = spec.lits.radius;` : ''}
    for (const [field, varName] of Object.entries(spec.bindings || {})) {
      node.setBoundVariable(field, need(varName));
    }
    if (typeof spec.shape.rotation === 'number' && spec.shape.rotation !== 0) node.rotation = -spec.shape.rotation;${effects}
  }`
    : '';

/** v9: PIXEL line height on text nodes (dump v1.3). */
const lineHeightRuntime = (has: boolean): string =>
  has
    ? `
    if (typeof spec.lineHeight === 'number') node.lineHeight = { unit: 'PIXELS', value: spec.lineHeight };`
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

/** v15 (S4/matrix a.8): flex-wrap → native layoutWrap (auto-layout only). */
const wrapRuntime = (has: boolean): string =>
  has
    ? `
  if (l.wrap) node.layoutWrap = 'WRAP';`
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
      try {
        await figma.loadFontAsync({ family: spec.fontFamily, style: spec.fontStyle || 'Medium' });
        node.fontName = { family: spec.fontFamily, style: spec.fontStyle || 'Medium' };
      } catch (e) { /* family unavailable — Inter stands (named limit) */ }
    }
    if (typeof spec.letterSpacing === 'number') node.letterSpacing = { unit: 'PIXELS', value: spec.letterSpacing };
    if (spec.textCase) node.textCase = spec.textCase;
    if (spec.textDecoration) node.textDecoration = spec.textDecoration;
    if (spec.textAlignH) node.textAlignHorizontal = spec.textAlignH;
    if (spec.textTruncation) { try { node.textTruncation = 'ENDING'; } catch (e) { /* older API */ } }`
    : '';

/** v9 shape placement: layoutPositioning ABSOLUTE + constraints + exact
 *  offsets vs the parent box, AFTER append (mirrors applyOverlay). */
const absoluteRuntime = (has: boolean): string =>
  has
    ? `
// v9 shape placement: exact offsets vs the parent box, after append.
function applyShapeAbsolute(parent, childNode, childSpec) {
  if (!childSpec.absolute) return;
  try {
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
  } catch (e) { /* parent not auto-layout — leave in flow */ }
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
    childNode.constraints = { horizontal: 'STRETCH', vertical: 'STRETCH' };
    const o = childSpec.insetOffsets || { top: 0, right: 0, bottom: 0, left: 0 };
    childNode.x = o.left;
    childNode.y = o.top;
    childNode.resize(
      Math.max(1, parent.width - o.left - o.right),
      Math.max(1, parent.height - o.top - o.bottom),
    );
  } catch (e) { /* parent not auto-layout — leave in flow */ }
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
        childNode.resize(
          Math.max(1, parent.width - (o.left || 0) - (o.right || 0)),
          Math.max(1, parent.height - (o.top || 0) - (o.bottom || 0)),
        );
      } else if (childSpec.absolute && (childSpec.absolute.h === 'STRETCH' || childSpec.absolute.v === 'STRETCH')) {
        const a = childSpec.absolute;
        childNode.resize(
          a.h === 'STRETCH' ? Math.max(parent.width - (a.left || 0) - (a.right || 0), 0.01) : childNode.width,
          a.v === 'STRETCH' ? Math.max(parent.height - (a.top || 0) - (a.bottom || 0), 0.01) : childNode.height,
        );
        if (a.h === 'STRETCH') childNode.x = a.left || 0;
        if (a.v === 'STRETCH') childNode.y = a.top || 0;
      }
    } catch (e) { /* parent not auto-layout — the child stayed in flow */ }
  }
}
`
    : '';
const outOfFlowResizeCall = (has: boolean, args: string): string =>
  has ? `
  resizeOutOfFlow(${args});` : '';

/** v14 literals: literal-fidelity channel application (applyFrameSpec tail).
 *  Emitted ONLY when a compiled spec carries lits — contracts without
 *  literals emit byte-identical scripts (the golden discipline, same as
 *  shapeRuntime/opacityRuntime). */
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
    if (li.minWidth !== undefined) { try { node.minWidth = li.minWidth; } catch (e) { /* needs auto-layout */ } }
    if (li.minHeight !== undefined) { try { node.minHeight = li.minHeight; } catch (e) { /* needs auto-layout */ } }
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
      if (sw.top !== undefined) node.strokeTopWeight = sw.top;
      if (sw.right !== undefined) node.strokeRightWeight = sw.right;
      if (sw.bottom !== undefined) node.strokeBottomWeight = sw.bottom;
      if (sw.left !== undefined) node.strokeLeftWeight = sw.left;
    }
    if (li.width !== undefined || li.height !== undefined) {
      node.resize(li.width !== undefined ? li.width : node.width, li.height !== undefined ? li.height : node.height);
      const horizontalIsPrimary = (spec.layout || { mode: 'HORIZONTAL' }).mode === 'HORIZONTAL';
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
  return buildSyncScript([data], fileKeyOverride ?? contract.anchors.figma.fileKey, {
    header: `// GENERATED by scripts/generate-figma.ts — DO NOT EDIT.
// Source of truth: contracts/${contract.id.replace(/^[^.]+\./, '')}.contract.json (${contract.id} v${contract.version})
// Amend-capable (#60): an existing component (set) carrying our identity
// marker is reconciled IN PLACE (same node id + key); unchanged specs skip.`,
    preamble: mintedPreamble(mintedTokens, resolveLiteral),
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
  opts: { header: string; preamble: string },
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
  // …and the SHAPE branch's literal ring/weight/radius application.
  const hasShapeLits = datas.some((d) =>
    dataSome(d, (x) => x.shape !== undefined && (x.lits?.strokeColor !== undefined || x.lits?.strokeWeight !== undefined || x.lits?.strokeSides !== undefined || x.lits?.radius !== undefined)),
  );
  const hasWrap = datas.some((d) => dataSome(d, (x) => x.layout?.wrap === true));
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
    } catch (e) { /* fall back to black base */ }
  }
  return figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: base, opacity: alpha }, 'color', v);
};

// Named text styles (synced by 01-tokens.js): consumers look up OUR styles
// only — the ds_contracts/textStyleToken marker is identity, a foreign style
// sharing a name is never used. Missing style (tokens script not run yet)
// degrades gracefully: the raw fontName/fontSize already set on the node
// stand until the next amend after the styles exist.
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

// State previews (figmaStatePreviews): merge the enum-API cartesian with the
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

function findComponentByName(name) {
  for (const page of figma.root.children) {
    const hit = page.findOne(
      (n) => (n.type === 'COMPONENT_SET' || n.type === 'COMPONENT') && n.name === name,
    );
    if (hit) return hit;
  }
  throw new Error('Dependency component not found in file: ' + name + ' (sync it first)');
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
  try { ownerDefs = (owner && owner.componentPropertyDefinitions) || {}; } catch (e) { ownerDefs = {}; }
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

let _slotUtil = null;
async function ensureSlotUtility() {
  if (_slotUtil) return _slotUtil;
  for (const page of figma.root.children) {
    const hit = page.findOne((n) => n.type === 'COMPONENT' && n.name === 'Slot');
    if (hit) { _slotUtil = hit; return hit; }
  }
  // Fresh file: create it (found by the 2026-07-06 fresh-file rebuild test —
  // the lookup-only version threw in a blank file).
  await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
  const util = figma.createComponent();
  util.name = 'Slot';
  util.layoutMode = 'HORIZONTAL';
  util.primaryAxisAlignItems = 'CENTER';
  util.counterAxisAlignItems = 'CENTER';
  util.paddingLeft = util.paddingRight = 12;
  util.paddingTop = util.paddingBottom = 8;
  util.cornerRadius = 4;
  util.fills = [];
  util.strokes = [{ type: 'SOLID', color: { r: 0.6, g: 0.62, b: 0.68 } }];
  util.dashPattern = [4, 4];
  const t = figma.createText();
  t.fontName = { family: 'Inter', style: 'Medium' };
  t.fontSize = 12;
  t.characters = 'Slot';
  t.fills = [{ type: 'SOLID', color: { r: 0.6, g: 0.62, b: 0.68 } }];
  util.appendChild(t);
  let utilPage = figma.root.children.find((p) => p.name === 'Utilities');
  if (!utilPage) { utilPage = figma.createPage(); utilPage.name = 'Utilities'; }
  utilPage.appendChild(util);
  util.x = 100; util.y = 100;
  _slotUtil = util;
  return util;
}

function applyFrameSpec(node, spec) {
  const l = spec.layout || { mode: 'HORIZONTAL', primary: 'MIN', counter: 'MIN' };
  node.layoutMode = l.mode;
  node.primaryAxisAlignItems = l.primary;
  node.counterAxisAlignItems = l.counter;${wrapRuntime(hasWrap)}
  node.primaryAxisSizingMode = 'AUTO';
  node.counterAxisSizingMode = 'AUTO';
  if (node.type === 'FRAME') node.fills = [];
  for (const [field, varName] of Object.entries(spec.bindings || {})) {
    node.setBoundVariable(field, need(varName));
  }
  if (spec.fill) node.fills = [boundPaint(spec.fill, node)];
  if (spec.stroke) {
    node.strokes = [boundPaint(spec.stroke, node)];
    node.strokeAlign = ${strokeAlignJs(hasStrokeOutside)};
  }${shadowRuntime(hasShadow)}${effectStackRuntime(hasEffectStack)}
  if (spec.fixedWidth || spec.fixedHeight) {
    const w = spec.fixedWidth ? spec.fixedWidth.px : node.width;
    const h = spec.fixedHeight ? spec.fixedHeight.px : node.height;
    node.resize(w, h);
    const horizontalIsPrimary = l.mode === 'HORIZONTAL';
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
  } catch (e) { /* parent not auto-layout — leave in flow */ }
}
${absoluteRuntime(hasAbsolute)}${insetOverlayRuntime(hasInsetOverlay)}${outOfFlowResizeRuntime(hasInsetOverlay || hasAbsolute)}${marginBoxRuntime(hasMargins)}
async function buildNode(spec, registry) {
  let node;
  if (spec.type === 'svg') {
    node = figma.createNodeFromSvg(spec.svg);
    node.fills = [];
    node.clipsContent = false;
    if (spec.iconSize) node.resize(spec.iconSize, spec.iconSize);${svgPaintRuntime(hasSvgPaint)}
  } else if (spec.type === 'text') {
    node = figma.createText();
    node.fontName = { family: 'Inter', style: spec.fontStyle || 'Medium' };
    node.fontSize = spec.fontSize || 16;
    node.characters = spec.characters || '';${lineHeightRuntime(hasLineHeight)}${textExtrasRuntime(hasTextExtras)}
    if (spec.textStyle) {
      // Exact-definition match compiled in: ride the named style. Text
      // styles own typography only — the bound fill paint below coexists.
      const st = await ourTextStyle(spec.textStyle);
      if (st) { try { await node.setTextStyleIdAsync(st.id); } catch (e) { /* raw props stand */ } }
    }
    if (spec.textFill) node.fills = [boundPaint(spec.textFill, node)];
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
    const target = findComponentByName(spec.dep);
    const main = target.type === 'COMPONENT_SET' ? target.defaultVariant : target;
    node = main.createInstance();
    if (spec.depProps) setInstanceProps(node, spec.depProps, target);
  } else if (spec.type === 'slot') {
    node = figma.createFrame();
    applyFrameSpec(node, spec);
    const defaults = spec.slotDefault || [];
    if (defaults.length === 0) {
      const util = await ensureSlotUtility();
      const inst = util.createInstance();
      node.appendChild(inst);
      registry.slots.push({ spec, wrapper: node, instance: inst, defaultId: null });
    } else {
      const instances = [];
      for (const item of defaults) {
        const target = findComponentByName(item.dep);
        const main = target.type === 'COMPONENT_SET' ? target.defaultVariant : target;
        const inst = main.createInstance();
        if (item.props) setInstanceProps(inst, item.props, target);
        node.appendChild(inst);
        if (spec.layout && spec.layout.stretchChildren) {
          try { inst.layoutSizingHorizontal = 'FILL'; } catch (e) { /* fixed-size deps */ }
        }
        instances.push({ inst, main });
      }
      if (defaults.length === 1) {
        registry.slots.push({ spec, wrapper: node, instance: instances[0].inst, defaultId: instances[0].main.id });
      }
    }
  }${shapeRuntime(hasShape, `${shadowRuntime(hasShadow)}${effectStackRuntime(hasEffectStack)}`, strokeAlignJs(hasStrokeOutside), hasShapeLits, hasArc)} else {
    node = spec.type === 'root' ? figma.createComponent() : figma.createFrame();
    applyFrameSpec(node, spec);
  }
  node.name = spec.name;${opacityRuntime(hasOpacity)}
  if (spec.visibleProp) {
    registry.visibles.push({ node, prop: spec.visibleProp, default: spec.visibleDefault === true });
  }
  const built = [];
  for (const child of spec.children || []) {
    const childNode = await buildNode(child, registry);
    node.appendChild(childNode);
    built.push([child, childNode]);
    applyOverlay(node, childNode, child);${absoluteCall(hasAbsolute, 'node, childNode, child')}
    if (child.pct != null) {
      try {
        childNode.resize(Math.max(1, Math.round(node.width * child.pct)), childNode.height);
        childNode.primaryAxisSizingMode = 'FIXED';
      } catch (e) { /* track not fixed-width */ }
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
      try { childNode.layoutSizingVertical = 'FILL'; } catch (e) { /* parent not auto-layout */ }
    }
    // FILL is compiled (annotateFillW): candidates only fill when the parent
    // width is established — the hug↔fill collapse class stays impossible.
    if (child.fillW && 'layoutSizingHorizontal' in childNode) {
      try { childNode.layoutSizingHorizontal = 'FILL'; } catch (e) { /* HUG-only nodes */ }
    }${insetOverlayCall(hasInsetOverlay, 'node, childNode, child')}${marginBoxCall(hasMargins, 'node, childNode, child')}
  }${outOfFlowResizeCall(hasInsetOverlay || hasAbsolute, 'node, built')}
  return node;
}


// djb2 over the compiled spec — stored on the set so unchanged components
// skip cheaply and CHANGED ones amend in place.
${FINGERPRINT_SRC}

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

function specHash(C) {
  let h = 5381; const s = JSON.stringify(C);
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0;
  return String(h);
}

// IN-PLACE AMEND (2026-07-08, closes the create-only gap): reconcile an
// existing COMPONENT_SET against the compiled spec while preserving what
// instances bind to — the set node + key, each variant COMPONENT node, and
// existing componentProperty IDs. Variant interiors are contract-owned and
// rebuilt from spec (manual interior edits are drift by definition);
// instance-level property overrides survive because property IDs do.
// Destructive changes (extra variants from removed enum values) are
// REPORTED, never deleted — a human retires those.
async function amendSet(set, C) {
  set.setSharedPluginData('ds_contracts', 'contractId', C.contractId);
  const hash = specHash(C);
  if (set.getSharedPluginData('ds_contracts', 'specHash') === hash) {
    // DRIFT ROUND migration: no stamp OR a pre-v2 stamp (geometry-bearing —
    // unstable under real Figma's deferred layout) re-baselines NOW. A
    // current-version stamp is never overwritten on skip: canvas edits stay
    // detectable.
    var fpSkip = set.getSharedPluginData('ds_contracts', 'canvasFingerprint');
    if (!fpSkip || fpSkip.indexOf('v5:') !== 0) {
      dsStampFingerprints(set);
    }
    return { name: C.setName, skipped: true, reason: 'unchanged', nodeId: set.id, key: set.key };
  }
  const report = { name: C.setName, amended: true, nodeId: set.id, key: set.key,
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
      applyFrameSpec(comp, v.spec);
      const built = [];
      for (const childSpec of v.spec.children || []) {
        const childNode = await buildNode(childSpec, registry);
        comp.appendChild(childNode);
        built.push([childSpec, childNode]);
        applyOverlay(comp, childNode, childSpec);${absoluteCall(hasAbsolute, 'comp, childNode, childSpec')}
        if (childSpec.pct != null) {
          try { childNode.resize(Math.max(1, Math.round(comp.width * childSpec.pct)), childNode.height); childNode.primaryAxisSizingMode = 'FIXED'; } catch (e) {}
        }
        if (
          childSpec.type === 'frame' && (!childSpec.children || childSpec.children.length === 0) &&
          !childSpec.fixedHeight && !(childSpec.lits && childSpec.lits.height !== undefined) && !childSpec.shape &&
          !childSpec.overlay && !childSpec.insetOverlay && !childSpec.absolute
        ) {
          // #60 fix 4 (amend path): same empty-child declared default.
          try { childNode.layoutSizingVertical = 'FILL'; } catch (e) { /* parent not auto-layout */ }
        }
        if (childSpec.fillW && 'layoutSizingHorizontal' in childNode) {
          try { childNode.layoutSizingHorizontal = 'FILL'; } catch (e) {}
        }${insetOverlayCall(hasInsetOverlay, 'comp, childNode, childSpec')}${marginBoxCall(hasMargins, 'comp, childNode, childSpec')}
      }${outOfFlowResizeCall(hasInsetOverlay || hasAbsolute, 'comp, built')}
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
      const util = await ensureSlotUtility();
      let k = defKey(sl.spec.slotProperty);
      if (!k) {
        const preferred = [];
        for (const depName of sl.spec.slotAccepts || []) {
          const target = findComponentByName(depName);
          preferred.push({ type: target.type === 'COMPONENT_SET' ? 'COMPONENT_SET' : 'COMPONENT', key: target.key });
        }
        k = set.addComponentProperty(sl.spec.slotProperty, 'INSTANCE_SWAP', sl.defaultId || util.id,
          preferred.length > 0 ? { preferredValues: preferred } : undefined);
        newKeys[sl.spec.slotProperty] = k;
        report.addedProps.push(sl.spec.slotProperty);
      }
      sl.instance.componentPropertyReferences = { mainComponent: k };
      if (sl.spec.slotOptional) {
        let vk = defKey('Show ' + sl.spec.slotProperty);
        if (!vk) { vk = set.addComponentProperty('Show ' + sl.spec.slotProperty, 'BOOLEAN', true); newKeys['Show ' + sl.spec.slotProperty] = vk; }
        sl.wrapper.componentPropertyReferences = { visible: vk };
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
  const hash = specHash(C);
  if (comp.getSharedPluginData('ds_contracts', 'specHash') === hash) {
    var fpSkipC = comp.getSharedPluginData('ds_contracts', 'canvasFingerprint');
    if (!fpSkipC || fpSkipC.indexOf('v5:') !== 0) {
      dsStampFingerprints(comp);
    }
    return { name: C.setName, skipped: true, reason: 'unchanged', nodeId: comp.id, key: comp.key };
  }
  const report = { name: C.setName, amended: true, standalone: true, nodeId: comp.id, key: comp.key, addedProps: [], editedDefaults: [] };
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
  applyFrameSpec(comp, v.spec);
  const built = [];
  for (const childSpec of v.spec.children || []) {
    const childNode = await buildNode(childSpec, registry);
    comp.appendChild(childNode);
    built.push([childSpec, childNode]);
    applyOverlay(comp, childNode, childSpec);${absoluteCall(hasAbsolute, 'comp, childNode, childSpec')}
    if (childSpec.pct != null) {
      try { childNode.resize(Math.max(1, Math.round(comp.width * childSpec.pct)), childNode.height); childNode.primaryAxisSizingMode = 'FIXED'; } catch (e) {}
    }
    if (
      childSpec.type === 'frame' && (!childSpec.children || childSpec.children.length === 0) &&
      !childSpec.fixedHeight && !(childSpec.lits && childSpec.lits.height !== undefined) && !childSpec.shape &&
      !childSpec.overlay && !childSpec.insetOverlay && !childSpec.absolute
    ) {
      // #60 fix 4 (standalone amend path): same empty-child declared default.
      try { childNode.layoutSizingVertical = 'FILL'; } catch (e) { /* parent not auto-layout */ }
    }
    if (childSpec.fillW && 'layoutSizingHorizontal' in childNode) {
      try { childNode.layoutSizingHorizontal = 'FILL'; } catch (e) {}
    }${insetOverlayCall(hasInsetOverlay, 'comp, childNode, childSpec')}
  }${outOfFlowResizeCall(hasInsetOverlay || hasAbsolute, 'comp, built')}
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
    const util = await ensureSlotUtility();
    let k = defKey(sl.spec.slotProperty);
    if (!k) {
      const preferred = [];
      for (const depName of sl.spec.slotAccepts || []) {
        const target = findComponentByName(depName);
        preferred.push({ type: target.type === 'COMPONENT_SET' ? 'COMPONENT_SET' : 'COMPONENT', key: target.key });
      }
      k = comp.addComponentProperty(sl.spec.slotProperty, 'INSTANCE_SWAP', sl.defaultId || util.id,
        preferred.length > 0 ? { preferredValues: preferred } : undefined);
      newKeys[sl.spec.slotProperty] = k;
      report.addedProps.push(sl.spec.slotProperty);
    }
    sl.instance.componentPropertyReferences = { mainComponent: k };
    if (sl.spec.slotOptional) {
      let vk = defKey('Show ' + sl.spec.slotProperty);
      if (!vk) { vk = comp.addComponentProperty('Show ' + sl.spec.slotProperty, 'BOOLEAN', true); newKeys['Show ' + sl.spec.slotProperty] = vk; }
      sl.wrapper.componentPropertyReferences = { visible: vk };
    }
  }
  for (const vis of registry.visibles) {
    const k = defKey(vis.prop);
    if (!k) continue;
    vis.node.componentPropertyReferences = { visible: k };
    vis.node.visible = vis.default;
  }
  comp.description = C.description;
  comp.setSharedPluginData('ds_contracts', 'specHash', hash);
  dsStampFingerprints(comp);
  // Re-fit (or adopt into) the host section — mirrors amendSet.
  const compPage2 = comp.parent && comp.parent.type === 'SECTION' ? comp.parent.parent : comp.parent;
  if (compPage2 && compPage2.type === 'PAGE') ensureHostSection(compPage2, comp, comp.name);
  return report;
}

async function syncOne(C) {
  // Identity is the ds_contracts/contractId marker, NOT the set name — in a
  // brownfield file a name can belong to the host system's own component
  // (CBDS pilot: native 72-variant "Badge"). Legacy fallback: sets created
  // before the marker existed carry only specHash under the same namespace.
  let existing = null;
  for (const page of figma.root.children) {
    existing = page.findOne(
      (n) => (n.type === 'COMPONENT_SET' || n.type === 'COMPONENT') &&
        n.getSharedPluginData('ds_contracts', 'contractId') === C.contractId,
    );
    if (existing) break;
  }
  if (!existing) {
    for (const page of figma.root.children) {
      existing = page.findOne(
        (n) => (n.type === 'COMPONENT_SET' || n.type === 'COMPONENT') && n.name === C.setName &&
          n.getSharedPluginData('ds_contracts', 'specHash') !== '',
      );
      if (existing) break;
    }
  }
  // An anchored key is ours by definition — the contract records the key the
  // canvas minted. Covers legacy nodes that predate both plugin-data markers
  // (main-file finding, 2026-07-08: 17 standalone components duplicated).
  if (!existing && C.anchorKey) {
    for (const page of figma.root.children) {
      existing = page.findOne(
        (n) => (n.type === 'COMPONENT_SET' || n.type === 'COMPONENT') && n.key === C.anchorKey,
      );
      if (existing) break;
    }
    if (existing) existing.setSharedPluginData('ds_contracts', 'contractId', C.contractId);
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
    return { name: C.setName, skipped: true, reason: 'set/standalone shape mismatch (' + existing.type + ' vs isSet=' + C.isSet + ') — a human retires the old node', nodeId: existing.id, key: existing.key };
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
      const util = await ensureSlotUtility();
      let key = keys[s.spec.slotProperty];
      if (!key) {
        const preferred = [];
        for (const depName of s.spec.slotAccepts || []) {
          const dep = findComponentByName(depName);
          preferred.push({
            type: dep.type === 'COMPONENT_SET' ? 'COMPONENT_SET' : 'COMPONENT',
            key: dep.key,
          });
        }
        key = mintOnce(
          s.spec.slotProperty,
          'INSTANCE_SWAP',
          s.defaultId || util.id,
          preferred.length > 0 ? { preferredValues: preferred } : undefined,
        );
      }
      s.instance.componentPropertyReferences = { mainComponent: key };
      if (s.spec.slotOptional) {
        s.wrapper.componentPropertyReferences = { visible: mintOnce('Show ' + s.spec.slotProperty, 'BOOLEAN', true) };
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
  target.setSharedPluginData('ds_contracts', 'specHash', specHash(C));
  target.setSharedPluginData('ds_contracts', 'contractId', C.contractId);
  // PROTOTYPE WIRING — BEFORE the fingerprint stamp (see amendSet).
  const wiredReactions = await wireStateReactions(target, new Map(built.map((b) => [b.v.name, b.comp])), C);
  dsStampFingerprints(target);
  ensureHostSection(compPage, target, displayName);

  return {
    name: C.setName,
    nodeId: target.id,
    key: target.key,
    variants: C.isSet ? target.children.length : 1,
    properties: Object.keys(target.componentPropertyDefinitions || {}),
    ...(wiredReactions > 0 ? { wiredReactions: wiredReactions } : {}),
  };
}

const results = [];
for (const C of COMPONENTS) {
  results.push(await syncOne(C));
}
return { createdNodeIds: results.filter((r) => !r.skipped).map((r) => r.nodeId), results };
`;
}

  return { buildTokensScript, compileComponentData, buildComponentScript, buildBatchScript };
}

/** The compiled engine type — the CLI shell and the barrel share it. */
export type FigmaEngine = ReturnType<typeof createFigmaEngine>;
