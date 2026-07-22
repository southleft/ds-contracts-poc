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
  walkAnatomy,
  type Contract,
  type Part,
  type Prop,
} from '../scripts/contract-schema.js';
import { flattenTokens, aliasTarget, px, type TokenEntry, type TokenTreeInput } from './tokens.js';
import { isMultiRoot, topRoots, validateContract } from './emit-react.js';


export interface LayoutSpec {
  mode: 'HORIZONTAL' | 'VERTICAL';
  primary: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counter: 'MIN' | 'CENTER' | 'MAX';
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
   *  (base shape.rotation, or the stylesWhen rotate for this combo). */
  shape?: { kind: 'polygon' | 'ellipse' | 'rect'; sides?: number; width: number; height: number; rotation?: number };
  /** v9 shape placement — compiled from the part's stylesWhen entries whose
   *  condition holds for this combo (the proposer's closed placement
   *  grammar: position:absolute + px/50% offsets + translate(-50%)). The
   *  runtime sets layoutPositioning ABSOLUTE + constraints + exact offsets
   *  after append. h/v: MIN pins left/top, MAX right/bottom, CENTER centers. */
  absolute?: { h: 'MIN' | 'MAX' | 'CENTER'; v: 'MIN' | 'MAX' | 'CENTER'; left?: number; right?: number; top?: number; bottom?: number };
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
  colW: number;
}

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

function figmaType(entry: TokenEntry): 'COLOR' | 'FLOAT' | 'STRING' {
  if (entry.type === 'color') return 'COLOR';
  if (entry.type === 'fontFamily') return 'STRING';
  return 'FLOAT';
}

function figmaValue(entry: TokenEntry): unknown {
  if (entry.type === 'color' || entry.type === 'fontFamily') return entry.value;
  return px(entry.value);
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

const ALIGN_FIGMA: Record<string, 'MIN' | 'CENTER' | 'MAX'> = {
  start: 'MIN',
  center: 'CENTER',
  end: 'MAX',
  stretch: 'MIN',
};
const JUSTIFY_FIGMA: Record<string, LayoutSpec['primary']> = {
  start: 'MIN',
  center: 'CENTER',
  end: 'MAX',
  'space-between': 'SPACE_BETWEEN',
};

function layoutSpec(part: Part, isRoot: boolean, subst: Record<string, string> = {}): LayoutSpec {
  // v7 layoutByProp: each canvas variant is compiled with every enum axis's
  // value (subst), so the per-variant layout override resolves right here.
  const l = resolveLayout(part, subst);
  if (!l && isRoot) {
    return { mode: 'HORIZONTAL', primary: 'CENTER', counter: 'CENTER' };
  }
  return {
    mode: l?.direction?.startsWith('column') ? 'VERTICAL' : 'HORIZONTAL',
    primary: l?.justify ? JUSTIFY_FIGMA[l.justify] : 'MIN',
    counter: l?.align ? ALIGN_FIGMA[l.align] : 'MIN',
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
): TextCtx {
  const next: TextCtx = { ...ctx };
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
        }
        break;
      case 'row-gap':
        if (spec.layout?.mode === 'VERTICAL') {
          spec.bindings = { ...spec.bindings, itemSpacing: varName };
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
      case 'width':
        spec.fixedWidth = { px: px(resolveLiteral(tokenPath)), varName };
        break;
      case 'max-width':
        // Fluid-up-to on the code side; a canvas component renders at its
        // natural (max) width — the token still binds the dimension.
        spec.fixedWidth = { px: px(resolveLiteral(tokenPath)), varName };
        break;
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
      case 'height':
        spec.fixedHeight = { px: px(resolveLiteral(tokenPath)), varName };
        break;
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
      default:
        // outline-* are state/CSS concerns; max-height (dump v1.4 style
        // fact) stays CSS-side (min-height binds since Round 5 — see the
        // case above; the sync scripts' golden was regenerated with it).
        break;
    }
  }
  return next;
}

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
      case 'width': { const n = parseLitPx(value); if (n !== undefined) li().width = n; break; }
      case 'height': { const n = parseLitPx(value); if (n !== undefined) li().height = n; break; }
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
  const t = applyTokens(spec, resolveTokens(part, subst), subst, ctx);
  const l = applyLiterals(spec, resolveLiterals(part, subst), t);
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
function withPartStateOverrides(parts: Record<string, Part>, stateName: string): Record<string, Part> {
  let changed = false;
  const out: Record<string, Part> = {};
  for (const [key, part] of Object.entries(parts)) {
    let next = part;
    const nested = part.parts ? withPartStateOverrides(part.parts, stateName) : undefined;
    if (nested && nested !== part.parts) next = { ...next, parts: nested };
    const overrides = part.states?.[stateName];
    if (overrides && Object.keys(overrides).length > 0 && !part.component && !part.slot) {
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
  props: Record<string, string | boolean>,
  subst: Record<string, string>,
  text?: string,
): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const [propName, rawValue] of Object.entries(props)) {
    const depProp = dep.props.find((p) => p.name === propName);
    if (!depProp) continue;
    if (depProp.bindings.figma.kind === 'NONE') continue; // code-only (v7 arrayOf)
    let value = rawValue;
    if (typeof value === 'string') {
      const parentRef = value.match(PARENT_PROP_REF);
      if (parentRef) {
        const resolved = subst[parentRef[1]];
        if (resolved === undefined)
          throw new Error(`Cannot resolve parent prop mapping "{${parentRef[1]}}"`);
        value = resolved;
      }
    }
    if (typeof value === 'boolean') out[depProp.bindings.figma.property!] = value;
    else out[depProp.bindings.figma.property!] = depProp.bindings.figma.values?.[value] ?? value;
  }
  if (text !== undefined) {
    const textProp = dep.props.find((p) => p.type === 'text' && p.bindings.code.prop === 'children');
    if (textProp) out[textProp.bindings.figma.property!] = text;
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
  if (carried === 4 && numeric) return offsets;
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
  return Object.entries(parts).filter(([, p]) => {
    // v11: a native checkable control (input[type=checkbox|radio]) is CODE
    // semantics — the presentational box and glyphs are the visual; the
    // canvas doesn't draw semantics, so the part compiles to no node at all.
    if (isNativeCheckablePart(p)) return false;
    const vw = p.visibleWhen;
    if (vw && vw.equals !== undefined) {
      const value = subst[vw.prop];
      if (value !== undefined && value !== vw.equals) return false;
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
    applyVisibleWhen(spec, part, contract);
    return spec;
  }
  // v9 shape (#42): a REAL parametric node — geometry from the contract,
  // fill from tokens, placement/rotation from the compiled stylesWhen.
  if (part.shape) {
    const spec: NodeSpec = { type: 'shape', name, shape: { ...part.shape } };
    applyStyling(spec, part, subst, ctx);
    const placement = shapePlacement(part, contract, subst);
    if (placement.absolute) spec.absolute = placement.absolute;
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
    const spec: NodeSpec = {
      type: 'instance',
      name,
      dep: dep.name,
      depProps: mapDepProps(dep, part.component.props ?? {}, subst, part.component.text),
    };
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
  if (part.text !== undefined) {
    const spec: NodeSpec = { type: 'text', name };
    const textCtx = applyStyling(spec, part, subst, ctx);
    spec.characters = part.text;
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
    const spec: NodeSpec = { type: 'text', name };
    const textCtx = applyStyling(spec, part, subst, ctx);
    spec.characters = typeof prop.default === 'string' ? prop.default : contract.name;
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
    const isCandidate = (c: NodeSpec): boolean =>
      inFlow(c) &&
      (c.grow === true ||
        (s.layout?.stretchChildren === true && !c.fixedWidth && c.lits?.width === undefined && c.type !== 'instance'));
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
  const enums = contract.props.filter(isEnum);
  const textProp = contract.props.find(
    (p) => p.type === 'text' && p.bindings.code.prop === 'children',
  );
  const boolPropsData = contract.props
    .filter((p) => p.type === 'boolean')
    .map((p) => ({ property: p.bindings.figma.property!, default: p.default === true }));
  const label = typeof textProp?.default === 'string' ? textProp.default : contract.name;

  const orderedValues = (p: { type: { enum: string[] }; default?: unknown }) => {
    const values = [...p.type.enum];
    const i = p.default !== undefined ? values.indexOf(String(p.default)) : -1;
    if (i > 0) {
      values.splice(i, 1);
      values.unshift(String(p.default));
    }
    return values;
  };

  const root = contract.anatomy.root;
  const variants: VariantSpec[] = [];
  // N-axis variant support: EVERY enum prop becomes a variant axis, in prop
  // declaration order, with each axis's DEFAULT value first (orderedValues).
  // The cartesian product is enumerated with axis 0 slowest and the last
  // axis fastest, so the FIRST emitted variant is the all-defaults combo —
  // Figma's default variant is positional (first child), and the create +
  // amend paths both rely on that ordering invariant.
  // Grid mapping: rows = axis 0's values; columns = the ordered cartesian
  // product of axes 1..n (a 5×3×2 component renders 5 rows × 6 columns).
  const axes = enums.map((p) => ({ prop: p, values: orderedValues(p) }));
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
        nameParts.push(`${STATE_PREVIEW_PROPERTY}=${statePreviewLabel(stateName)}`);
        const row = primaryIdx === 0 && primary ? pi : 0;
        const col =
          primaryIdx === 0 || !primary
            ? baseColsN + si
            : baseColsN + si * primaryValues.length + pi;
        const rootSpec: NodeSpec = {
          type: 'root',
          name: nameParts.join(', '),
          layout: layoutSpec(root, true, subst),
        };
        // Same resolveTokens rule as the base loop: per-combo tokensByProp
        // overrides apply BEFORE the state overrides layer on top.
        const baseCtx = applyStyling(rootSpec, root, subst, {});
        const ctx = applyTokens(
          rootSpec,
          translateStateOverrides(overrides[stateName] ?? {}),
          subst,
          baseCtx,
        );
        applyStylesWhenOpacity(rootSpec, root, contract, subst);
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
          const stateParts = withPartStateOverrides(root.parts, stateName);
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
  const stripMisses = (spec: NodeSpec) => {
    if (spec.gradientMiss !== undefined) {
      gradientMissLines.add(`${spec.name}.background-image: ${spec.gradientMiss}`);
      delete spec.gradientMiss;
    }
    if (spec.shadowMiss !== undefined) {
      shadowMissLines.add(`${spec.name}.box-shadow: ${spec.shadowMiss}`);
      delete spec.shadowMiss;
    }
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
    hasMeter ||
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
    colW: Math.max(
      380,
      ...[...variants, ...stateVariants].map((v) => (v.spec.fixedWidth?.px ?? 0) + 60),
    ),
  };
}

/** The conditional minted-variable preamble (see FigmaScriptCtx.mintedTokens).
 *  Returns '' when the tree is absent/empty, so contracts without a minted
 *  layer emit byte-identical scripts — the golden guard's invariant. */
function mintedPreamble(mintedTokens?: Record<string, unknown>): string {
  const minted = mintedTokens ? flatten(mintedTokens) : null;
  if (!minted || minted.size === 0) return '';
  // Shadow-typed leaves (box-shadow values, dump v1.2) and gradient-typed
  // leaves (background-image stacks, v15) have no Figma variable projection —
  // skipped here; the limit is NAMED at proposal.
  const vars = [...minted]
    .filter(([, entry]) => entry.type !== 'shadow' && entry.type !== 'gradient')
    .map(([p, entry]) => ({
      name: figmaName(p),
      type: figmaType(entry),
      value: figmaValue(entry),
    }));
  if (vars.length === 0) return '';
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
  const byName = {};
  for (const v of await figma.variables.getLocalVariablesAsync()) {
    if (v.variableCollectionId === col.id) byName[v.name] = v;
  }
  for (const t of MINTED_VARIABLES) {
    let v = byName[t.name];
    if (!v) { v = figma.variables.createVariable(t.name, col, t.type); byName[t.name] = v; }
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

const shapeRuntime = (has: boolean, effects: string, alignExpr: string): string =>
  has
    ? ` else if (spec.type === 'shape') {
    // v9 shape (#42): a REAL parametric node with native rotation.
    node = spec.shape.kind === 'ellipse' ? figma.createEllipse()
      : spec.shape.kind === 'rect' ? figma.createRectangle()
      : figma.createPolygon();
    if (spec.shape.kind === 'polygon' && spec.shape.sides) node.pointCount = spec.shape.sides;
    node.resize(spec.shape.width, spec.shape.height);
    // Shape nodes ship a default gray paint — a spec with NO fill channel
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
    }
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
    childNode.constraints = {
      horizontal: a.h === 'MAX' ? 'MAX' : a.h === 'CENTER' ? 'CENTER' : 'MIN',
      vertical: a.v === 'MAX' ? 'MAX' : a.v === 'CENTER' ? 'CENTER' : 'MIN',
    };
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
    if (!childNode.children || childNode.children.length === 0) {
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

/** v14 literals: literal-fidelity channel application (applyFrameSpec tail).
 *  Emitted ONLY when a compiled spec carries lits — contracts without
 *  literals emit byte-identical scripts (the golden discipline, same as
 *  shapeRuntime/opacityRuntime). */
const litsRuntime = (has: boolean): string =>
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
    if (li.strokeSides) {
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
    preamble: mintedPreamble(mintedTokens),
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
  const hasShadow = datas.some((d) => dataSome(d, (x) => x.dropShadow !== undefined));
  const hasLineHeight = datas.some((d) => dataSome(d, (x) => x.lineHeight !== undefined));
  const hasAbsolute = datas.some((d) => dataSome(d, (x) => x.absolute !== undefined));
  const hasLits = datas.some((d) => dataSome(d, (x) => x.lits !== undefined));
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
  }${litsRuntime(hasLits)}${gradientRuntime(hasGradient)}
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
${absoluteRuntime(hasAbsolute)}${insetOverlayRuntime(hasInsetOverlay)}${marginBoxRuntime(hasMargins)}
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
      const wrap = figma.createFrame();
      wrap.layoutMode = 'HORIZONTAL';
      wrap.primaryAxisAlignItems = 'CENTER';
      wrap.counterAxisAlignItems = 'CENTER';
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
  }${shapeRuntime(hasShape, `${shadowRuntime(hasShadow)}${effectStackRuntime(hasEffectStack)}`, strokeAlignJs(hasStrokeOutside))} else {
    node = spec.type === 'root' ? figma.createComponent() : figma.createFrame();
    applyFrameSpec(node, spec);
  }
  node.name = spec.name;${opacityRuntime(hasOpacity)}
  if (spec.visibleProp) {
    registry.visibles.push({ node, prop: spec.visibleProp, default: spec.visibleDefault === true });
  }
  for (const child of spec.children || []) {
    const childNode = await buildNode(child, registry);
    node.appendChild(childNode);
    applyOverlay(node, childNode, child);${absoluteCall(hasAbsolute, 'node, childNode, child')}
    if (child.pct != null) {
      try {
        childNode.resize(Math.max(1, Math.round(node.width * child.pct)), childNode.height);
        childNode.primaryAxisSizingMode = 'FIXED';
      } catch (e) { /* track not fixed-width */ }
    }
    if (
      child.type === 'frame' && (!child.children || child.children.length === 0) &&
      !child.fixedHeight && !(child.lits && child.lits.height !== undefined) && !child.shape
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
  }
  return node;
}


// djb2 over the compiled spec — stored on the set so unchanged components
// skip cheaply and CHANGED ones amend in place.
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
      for (const childSpec of v.spec.children || []) {
        const childNode = await buildNode(childSpec, registry);
        comp.appendChild(childNode);
        applyOverlay(comp, childNode, childSpec);${absoluteCall(hasAbsolute, 'comp, childNode, childSpec')}
        if (childSpec.pct != null) {
          try { childNode.resize(Math.max(1, Math.round(comp.width * childSpec.pct)), childNode.height); childNode.primaryAxisSizingMode = 'FIXED'; } catch (e) {}
        }
        if (
          childSpec.type === 'frame' && (!childSpec.children || childSpec.children.length === 0) &&
          !childSpec.fixedHeight && !(childSpec.lits && childSpec.lits.height !== undefined) && !childSpec.shape
        ) {
          // #60 fix 4 (amend path): same empty-child declared default.
          try { childNode.layoutSizingVertical = 'FILL'; } catch (e) { /* parent not auto-layout */ }
        }
        if (childSpec.fillW && 'layoutSizingHorizontal' in childNode) {
          try { childNode.layoutSizingHorizontal = 'FILL'; } catch (e) {}
        }${insetOverlayCall(hasInsetOverlay, 'comp, childNode, childSpec')}${marginBoxCall(hasMargins, 'comp, childNode, childSpec')}
      }
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
  for (const childSpec of v.spec.children || []) {
    const childNode = await buildNode(childSpec, registry);
    comp.appendChild(childNode);
    applyOverlay(comp, childNode, childSpec);${absoluteCall(hasAbsolute, 'comp, childNode, childSpec')}
    if (childSpec.pct != null) {
      try { childNode.resize(Math.max(1, Math.round(comp.width * childSpec.pct)), childNode.height); childNode.primaryAxisSizingMode = 'FIXED'; } catch (e) {}
    }
    if (
      childSpec.type === 'frame' && (!childSpec.children || childSpec.children.length === 0) &&
      !childSpec.fixedHeight && !(childSpec.lits && childSpec.lits.height !== undefined) && !childSpec.shape
    ) {
      // #60 fix 4 (standalone amend path): same empty-child declared default.
      try { childNode.layoutSizingVertical = 'FILL'; } catch (e) { /* parent not auto-layout */ }
    }
    if (childSpec.fillW && 'layoutSizingHorizontal' in childNode) {
      try { childNode.layoutSizingHorizontal = 'FILL'; } catch (e) {}
    }${insetOverlayCall(hasInsetOverlay, 'comp, childNode, childSpec')}
  }
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
  ensureHostSection(compPage, target, displayName);

  return {
    name: C.setName,
    nodeId: target.id,
    key: target.key,
    variants: C.isSet ? target.children.length : 1,
    properties: Object.keys(target.componentPropertyDefinitions || {}),
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
