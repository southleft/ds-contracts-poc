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
  STATE_PREVIEW_DEFAULT,
  STATE_PREVIEW_PROPERTY,
  isNativeCheckablePart,
  pascal,
  resolveLayout,
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
import { validateContract } from './emit-react.js';


export interface LayoutSpec {
  mode: 'HORIZONTAL' | 'VERTICAL';
  primary: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counter: 'MIN' | 'CENTER' | 'MAX';
  stretchChildren?: boolean;
}

export interface NodeSpec {
  type: 'root' | 'frame' | 'text' | 'instance' | 'slot' | 'svg' | 'shape';
  name: string;
  layout?: LayoutSpec;
  bindings?: Record<string, string>;
  fill?: string;
  stroke?: string;
  fixedWidth?: { px: number; varName: string };
  fixedHeight?: { px: number; varName: string };
  /** CSS grow → layoutSizingHorizontal FILL after append. */
  grow?: boolean;
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
  /** PIXEL line height (dump v1.3) — the runtime sets
   *  node.lineHeight = { unit: 'PIXELS', value }. */
  lineHeight?: number;
  // svg (icon parts) — markup with currentColor resolved to the variant's
  // literal foreground color (SVG paint is not variable-bindable on import)
  svg?: string;
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

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
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
  fontSize?: number;
  fontStyle?: string;
  /** Token dot-path behind fontSize — text nodes whose bindings exactly match
   *  a derived text style's definition carry that style (see matchTextStyle). */
  fontSizePath?: string;
  /** PIXEL line height (dump v1.3) — resolved literal. */
  lineHeight?: number;
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
    stretchChildren: l?.align === 'stretch' || undefined,
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
  for (const [cssProp, ref] of Object.entries(tokens)) {
    let tokenPath = ref.slice(1, -1);
    for (const [propName, value] of Object.entries(subst)) {
      tokenPath = tokenPath.replaceAll(`{${propName}}`, value);
    }
    const varName = figmaName(tokenPath);
    switch (cssProp) {
      case 'background-color':
        spec.fill = varName;
        break;
      case 'border-color':
        spec.stroke = varName;
        break;
      case 'border-width':
        spec.bindings = { ...spec.bindings, strokeWeight: varName };
        break;
      case 'color':
        next.textFill = varName;
        next.textFillPath = tokenPath;
        break;
      case 'font-size':
        next.fontSize = px(resolveLiteral(tokenPath));
        next.fontSizePath = tokenPath;
        break;
      case 'font-weight':
        next.fontStyle = FONT_STYLE_BY_WEIGHT[px(resolveLiteral(tokenPath))] ?? 'Medium';
        break;
      case 'font-family':
        break; // Inter (documented fidelity scope)
      case 'padding-inline':
        spec.bindings = { ...spec.bindings, paddingLeft: varName, paddingRight: varName };
        break;
      case 'padding-block':
        spec.bindings = { ...spec.bindings, paddingTop: varName, paddingBottom: varName };
        break;
      case 'gap':
        spec.bindings = { ...spec.bindings, itemSpacing: varName };
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
        // native effect (runtime) / CSS box-shadow (canvas preview).
        const shadow = parseBoxShadow(String(resolveLiteral(tokenPath)));
        if (shadow) spec.dropShadow = shadow;
        break;
      }
      case 'line-height':
        // dump v1.3: PIXEL line heights ride text nodes.
        next.lineHeight = px(resolveLiteral(tokenPath));
        break;
      default:
        // outline-* are state/CSS concerns; min-height/max-height (dump
        // v1.4 style facts) are CSS-side — the canvas variant is drawn at
        // its real per-variant height, so a min/max binding would be
        // redundant chrome there (and the sync scripts are golden-pinned).
        break;
    }
  }
  return next;
}

/** State-preview overrides pass through applyTokens with one honest
 *  translation: the focus outline has no canvas equivalent (outline sits
 *  outside the border box, with offset), so it renders as a bound stroke —
 *  an approximation, documented as such. Everything else (background-color,
 *  color, opacity) maps exactly like base tokens. */
function translateStateOverrides(overrides: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [cssProp, ref] of Object.entries(overrides)) {
    if (cssProp === 'outline-color') out['border-color'] = ref;
    else if (cssProp === 'outline-width') out['border-width'] = ref;
    else out[cssProp] = ref;
  }
  return out;
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
  const hex = ctx.textFillPath ? String(resolveLiteral(ctx.textFillPath)) : '#000000';
  let out = svg.replaceAll('currentColor', hex);
  if (part.icon!.size) {
    out = out
      .replace(/width="\d+"/, `width="${part.icon!.size}"`)
      .replace(/height="\d+"/, `height="${part.icon!.size}"`);
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
  const childCtx = applyTokens(spec, resolveTokens(part, subst), subst, ctx);
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
      textStyle: matchTextStyle(childCtx),
      textFill: 'color/input/placeholder',
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
    return true;
  });
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
    const spec: NodeSpec = {
      type: 'svg',
      name,
      svg: iconSvg(part, subst, iconCtx),
      grow: part.layout?.grow || undefined,
    };
    applyVisibleWhen(spec, part, contract);
    return spec;
  }
  // v9 shape (#42): a REAL parametric node — geometry from the contract,
  // fill from tokens, placement/rotation from the compiled stylesWhen.
  if (part.shape) {
    const spec: NodeSpec = { type: 'shape', name, shape: { ...part.shape } };
    applyTokens(spec, resolveTokens(part, subst), subst, ctx);
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
    applyTokens(spec, resolveTokens(part, subst), subst, ctx);
    applyVisibleWhen(spec, part, contract);
    return spec;
  }
  if (part.text !== undefined) {
    const spec: NodeSpec = { type: 'text', name };
    const textCtx = applyTokens(spec, resolveTokens(part, subst), subst, ctx);
    spec.characters = part.text;
    spec.fontSize = textCtx.fontSize ?? 14;
    spec.fontStyle = textCtx.fontStyle ?? 'Medium';
    spec.textStyle = matchTextStyle(textCtx);
    spec.textFill = textCtx.textFill;
    if (textCtx.lineHeight !== undefined) spec.lineHeight = textCtx.lineHeight;
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
    applyTokens(spec, resolveTokens(part, subst), subst, ctx);
    applyVisibleWhen(spec, part, contract);
    return spec;
  }
  if (part.content) {
    const prop = contract.props.find(
      (p) => p.type === 'text' && p.bindings.code.prop === part.content!.prop,
    )!;
    const spec: NodeSpec = { type: 'text', name };
    const textCtx = applyTokens(spec, resolveTokens(part, subst), subst, ctx);
    spec.characters = typeof prop.default === 'string' ? prop.default : contract.name;
    spec.fontSize = textCtx.fontSize ?? 16;
    spec.fontStyle = textCtx.fontStyle ?? 'Medium';
    spec.textStyle = matchTextStyle(textCtx);
    spec.textFill = textCtx.textFill;
    if (textCtx.lineHeight !== undefined) spec.lineHeight = textCtx.lineHeight;
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
  const childCtx = applyTokens(spec, resolveTokens(part, subst), subst, ctx);
  spec.children = variantParts(part.parts ?? {}, subst).map(([childName, child]) =>
    partToSpec(childName, child, contract, byId, childCtx, subst),
  );
  if (isReversed(part, subst)) spec.children.reverse();
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

    const rootSpec: NodeSpec = {
      type: 'root',
      name: nameParts.join(', ') || contract.name,
      layout: layoutSpec(root, true, subst),
    };
    // resolveTokens, not root.tokens: the root's tokensByProp overrides (v10
    // — per-size padding-inline/height on the owner's Button) resolve per
    // combo exactly like every child part's. Byte-neutral for contracts
    // without tokensByProp (resolveTokens returns the base map unchanged).
    const ctx = applyTokens(rootSpec, resolveTokens(root, subst), subst, {});
    applyStylesWhenOpacity(rootSpec, root, contract, subst);
    if (root.parts) {
      rootSpec.children = variantParts(root.parts, subst).map(([childName, child]) =>
        partToSpec(childName, child, contract, byId, ctx, subst),
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
        const baseCtx = applyTokens(rootSpec, resolveTokens(root, subst), subst, {});
        const ctx = applyTokens(
          rootSpec,
          translateStateOverrides(overrides[stateName] ?? {}),
          subst,
          baseCtx,
        );
        applyStylesWhenOpacity(rootSpec, root, contract, subst);
        if (root.parts) {
          rootSpec.children = variantParts(root.parts, subst).map(([childName, child]) =>
            partToSpec(childName, child, contract, byId, ctx, subst),
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

  return {
    setName: contract.name,
    contractId: contract.id,
    anchorKey: contract.anchors.figma.componentSetKey ?? null,
    // Events are code-only by declared fidelity limit (the canvas cannot run
    // behavior) — surfaced here as description text so designers see the
    // interaction surface in the properties panel.
    description:
      `${contract.description} — governed by contract ${contract.id} v${contract.version}` +
      (contract.events ?? [])
        .map((e) => {
          const t = e.toggles ? ` Toggles ${e.toggles.prop}: ${e.toggles.between.join(' ⇄ ')}.` : '';
          return `\nEvent (code): ${e.bindings.code.prop} — fires on ${e.trigger} activation.${t}`;
        })
        .join(''),
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
  // Shadow-typed leaves (box-shadow values, dump v1.2) have no Figma
  // variable projection — skipped here; the limit is NAMED at proposal.
  const vars = [...minted]
    .filter(([, entry]) => entry.type !== 'shadow')
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
const specSome = (s: NodeSpec, pred: (x: NodeSpec) => boolean): boolean =>
  pred(s) || (s.children ?? []).some((c) => specSome(c, pred));
const dataSome = (d: ComponentData, pred: (x: NodeSpec) => boolean): boolean =>
  [...d.variants, ...(d.stateVariants ?? [])].some((v) => specSome(v.spec, pred));

/** v9 shape: node-creation branch — a REAL RegularPolygon/Ellipse/Rectangle
 *  with native rotation (contract CSS-clockwise degrees → plugin CCW). */
const shapeRuntime = (has: boolean): string =>
  has
    ? ` else if (spec.type === 'shape') {
    // v9 shape (#42): a REAL parametric node with native rotation.
    node = spec.shape.kind === 'ellipse' ? figma.createEllipse()
      : spec.shape.kind === 'rect' ? figma.createRectangle()
      : figma.createPolygon();
    if (spec.shape.kind === 'polygon' && spec.shape.sides) node.pointCount = spec.shape.sides;
    node.resize(spec.shape.width, spec.shape.height);
    if (spec.fill) node.fills = [boundPaint(spec.fill, node)];
    if (typeof spec.shape.rotation === 'number' && spec.shape.rotation !== 0) node.rotation = -spec.shape.rotation;
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
  const hasOpacity = dataHasOpacity(data);
  const hasShape = dataSome(data, (x) => x.shape !== undefined);
  const hasShadow = dataSome(data, (x) => x.dropShadow !== undefined);
  const hasLineHeight = dataSome(data, (x) => x.lineHeight !== undefined);
  const hasAbsolute = dataSome(data, (x) => x.absolute !== undefined);

  return `// GENERATED by scripts/generate-figma.ts — DO NOT EDIT.
// Source of truth: contracts/${contract.id.replace(/^[^.]+\./, '')}.contract.json (${contract.id} v${contract.version})
let SET_NAME = ${JSON.stringify(data.setName)};
const CONTRACT_ID = ${JSON.stringify(data.contractId)};
const DESCRIPTION = ${JSON.stringify(data.description)};
const IS_SET = ${data.isSet};
const BOOL_PROPS = ${JSON.stringify(data.boolProps)};
const TEXT_PROPS = ${JSON.stringify(data.textProps)};
const FONT_STYLES = ${JSON.stringify(data.fontStyles)};
const VARIANTS = ${JSON.stringify(data.variants, null, 2)};
// figmaStatePreviews (canvas-only): preview variants carrying the State axis.
const STATE_VARIANTS = ${JSON.stringify(data.stateVariants ?? [], null, 2)};
const COL_W = ${data.colW}, ROW_H = 240, PAD = 40;

// State previews: merge the enum-API cartesian with the preview overlay;
// base variants gain an explicit State=Default segment so every variant in
// the set carries the axis (Figma derives variant properties from names).
function withStateAxis(variants, stateVariants) {
  if (!stateVariants || stateVariants.length === 0) return variants;
  return variants.map((v) => {
    const name = v.name.indexOf('=') >= 0 ? v.name + ', State=${STATE_PREVIEW_DEFAULT}' : 'State=${STATE_PREVIEW_DEFAULT}';
    return Object.assign({}, v, { name: name, spec: Object.assign({}, v.spec, { name: name }) });
  }).concat(stateVariants);
}
const ALL_VARIANTS = withStateAxis(VARIANTS, STATE_VARIANTS);

// File guard: multi-file bridge routing has been observed to hit the wrong
// file — never write without verifying the target.
const EXPECTED_FILE_KEY = ${JSON.stringify(fileKeyOverride ?? contract.anchors.figma.fileKey)};
if (EXPECTED_FILE_KEY && figma.fileKey && figma.fileKey !== EXPECTED_FILE_KEY) {
  throw new Error('WRONG FILE: expected ' + EXPECTED_FILE_KEY + ', got ' + figma.fileKey);
}

await figma.loadAllPagesAsync();

// Skip if OUR component (set) already exists on ANY page (idempotency guard).
// Identity is the ds_contracts/contractId marker — a set NAME is not identity
// in a brownfield file (CBDS pilot: a native 72-variant "Badge" name-matched).
let existing = null;
for (const page of figma.root.children) {
  existing = page.findOne(
    (n) => (n.type === 'COMPONENT_SET' || n.type === 'COMPONENT') &&
      n.getSharedPluginData('ds_contracts', 'contractId') === CONTRACT_ID,
  );
  if (existing) break;
}
if (existing) return { skipped: true, nodeId: existing.id, key: existing.key };
// A same-named set WITHOUT the marker is someone else's component: never touch
// it — create ours under a disambiguated name alongside it.
for (const page of figma.root.children) {
  const foreign = page.findOne(
    (n) => (n.type === 'COMPONENT_SET' || n.type === 'COMPONENT') && n.name === SET_NAME &&
      !n.getSharedPluginData('ds_contracts', 'contractId'),
  );
  if (foreign) { SET_NAME = SET_NAME + ' (' + CONTRACT_ID + ')'; break; }
}

${mintedPreamble(mintedTokens)}const allVars = await figma.variables.getLocalVariablesAsync();
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
  const v = need(varName);
  let base = { r: 0, g: 0, b: 0 };
  if (consumer) {
    try {
      const r = v.resolveForConsumer(consumer);
      if (r && r.value && r.value.r !== undefined) base = { r: r.value.r, g: r.value.g, b: r.value.b };
    } catch (e) { /* fall back to black base */ }
  }
  return figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: base }, 'color', v);
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

for (const style of FONT_STYLES) {
  await figma.loadFontAsync({ family: 'Inter', style });
}

function findComponentByName(name) {
  for (const page of figma.root.children) {
    const hit = page.findOne(
      (n) => (n.type === 'COMPONENT_SET' || n.type === 'COMPONENT') && n.name === name,
    );
    if (hit) return hit;
  }
  throw new Error('Dependency component not found in file: ' + name + ' (run its sync script first)');
}

function setInstanceProps(inst, props) {
  const available = Object.keys(inst.componentProperties);
  const resolved = {};
  for (const [wanted, value] of Object.entries(props)) {
    const key = available.find((k) => k === wanted || k.startsWith(wanted + '#'));
    if (key) resolved[key] = value;
  }
  if (Object.keys(resolved).length > 0) inst.setProperties(resolved);
}

let _slotUtil = null;
async function ensureSlotUtility() {
  if (_slotUtil) return _slotUtil;
  for (const page of figma.root.children) {
    const hit = page.findOne((n) => n.type === 'COMPONENT' && n.name === 'Slot');
    if (hit) { _slotUtil = hit; return hit; }
  }
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
  let utilities = figma.currentPage.findOne((n) => n.type === 'SECTION' && n.name === 'Utilities');
  if (!utilities) {
    utilities = figma.createSection();
    utilities.name = 'Utilities';
    let maxX = 0;
    for (const n of figma.currentPage.children) {
      if (n !== utilities) maxX = Math.max(maxX, n.x + n.width);
    }
    utilities.x = maxX + 100;
    utilities.y = 0;
    utilities.resizeWithoutConstraints(240, 160);
  }
  utilities.appendChild(util);
  util.x = 40; util.y = 40;
  _slotUtil = util;
  return util;
}

function applyFrameSpec(node, spec) {
  const l = spec.layout || { mode: 'HORIZONTAL', primary: 'MIN', counter: 'MIN' };
  node.layoutMode = l.mode;
  node.primaryAxisAlignItems = l.primary;
  node.counterAxisAlignItems = l.counter;
  node.primaryAxisSizingMode = 'AUTO';
  node.counterAxisSizingMode = 'AUTO';
  if (node.type === 'FRAME') node.fills = [];
  for (const [field, varName] of Object.entries(spec.bindings || {})) {
    node.setBoundVariable(field, need(varName));
  }
  if (spec.fill) node.fills = [boundPaint(spec.fill, node)];
  if (spec.stroke) {
    node.strokes = [boundPaint(spec.stroke, node)];
    node.strokeAlign = 'INSIDE';
  }${shadowRuntime(hasShadow)}
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
      node.setBoundVariable('height', need(spec.fixedHeight.varName));
    }
  }
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
${absoluteRuntime(hasAbsolute)}
async function buildNode(spec, registry) {
  let node;
  if (spec.type === 'svg') {
    node = figma.createNodeFromSvg(spec.svg);
    node.fills = [];
    node.clipsContent = false;
  } else if (spec.type === 'text') {
    node = figma.createText();
    node.fontName = { family: 'Inter', style: spec.fontStyle || 'Medium' };
    node.fontSize = spec.fontSize || 16;
    node.characters = spec.characters || '';${lineHeightRuntime(hasLineHeight)}
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
      if (spec.stroke) { wrap.strokes = [boundPaint(spec.stroke, wrap)]; wrap.strokeAlign = 'INSIDE'; }
      if (spec.characters) wrap.appendChild(node); else node.remove();
      if (spec.fixedWidth || spec.fixedHeight) {
        wrap.resize(spec.fixedWidth ? spec.fixedWidth.px : wrap.width, spec.fixedHeight ? spec.fixedHeight.px : wrap.height);
        if (spec.fixedWidth) { wrap.primaryAxisSizingMode = 'FIXED'; wrap.setBoundVariable('width', need(spec.fixedWidth.varName)); }
        if (spec.fixedHeight) { wrap.counterAxisSizingMode = 'FIXED'; wrap.setBoundVariable('height', need(spec.fixedHeight.varName)); }
      }
      wrap.name = spec.name;
      node = wrap;
    }
  } else if (spec.type === 'instance') {
    const target = findComponentByName(spec.dep);
    const main = target.type === 'COMPONENT_SET' ? target.defaultVariant : target;
    node = main.createInstance();
    if (spec.depProps) setInstanceProps(node, spec.depProps);
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
        if (item.props) setInstanceProps(inst, item.props);
        node.appendChild(inst);
        if (spec.layout && spec.layout.stretchChildren) {
          try { inst.layoutSizingHorizontal = 'FILL'; } catch (e) { /* fixed-size deps */ }
        }
        instances.push({ inst, main });
      }
      if (defaults.length === 1) {
        // Single default → still expressible as a swap property.
        registry.slots.push({ spec, wrapper: node, instance: instances[0].inst, defaultId: instances[0].main.id });
      }
      // >1 → multi-child slot: content rendered directly, no swap property
      // (INSTANCE_SWAP holds exactly one instance; native SLOT is the fix).
    }
  }${shapeRuntime(hasShape)} else {
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
    if (child.grow && 'layoutSizingHorizontal' in childNode) {
      try { childNode.layoutSizingHorizontal = 'FILL'; } catch (e) { /* HUG-only nodes */ }
    } else if (
      spec.layout && spec.layout.stretchChildren &&
      !child.fixedWidth && child.type !== 'instance' &&
      'layoutSizingHorizontal' in childNode
    ) {
      try { childNode.layoutSizingHorizontal = 'FILL'; } catch (e) { /* HUG-only nodes */ }
    }
  }
  return node;
}

// One page per component (see figma-sync/arrange.js for the file layout).
let compPage = figma.root.children.find((p) => p.name === SET_NAME);
if (!compPage) { compPage = figma.createPage(); compPage.name = SET_NAME; }

// Build every variant, then add properties BEFORE combining.
const built = [];
for (const v of ALL_VARIANTS) {
  const registry = { texts: [], slots: [], visibles: [] };
  const comp = await buildNode(v.spec, registry);
  built.push({ v, comp, registry });
}
for (const b of built) {
  for (const t of b.registry.texts) {
    const key = b.comp.addComponentProperty(t.prop, 'TEXT', t.default);
    t.node.componentPropertyReferences = { characters: key };
  }
  for (const s of b.registry.slots) {
    const util = await ensureSlotUtility();
    const preferred = [];
    for (const depName of s.spec.slotAccepts || []) {
      const target = findComponentByName(depName);
      preferred.push({
        type: target.type === 'COMPONENT_SET' ? 'COMPONENT_SET' : 'COMPONENT',
        key: target.key,
      });
    }
    const key = b.comp.addComponentProperty(
      s.spec.slotProperty,
      'INSTANCE_SWAP',
      s.defaultId || util.id,
      preferred.length > 0 ? { preferredValues: preferred } : undefined,
    );
    s.instance.componentPropertyReferences = { mainComponent: key };
    if (s.spec.slotOptional) {
      const vkey = b.comp.addComponentProperty('Show ' + s.spec.slotProperty, 'BOOLEAN', true);
      s.wrapper.componentPropertyReferences = { visible: vkey };
    }
  }
  const boolKeys = {};
  for (const bp of BOOL_PROPS) {
    boolKeys[bp.property] = b.comp.addComponentProperty(bp.property, 'BOOLEAN', bp.default);
  }
  for (const tp of TEXT_PROPS) {
    b.comp.addComponentProperty(tp.property, 'TEXT', tp.default);
  }
  // visibleWhen parts: visibility follows the BOOLEAN property, and the
  // canvas default matches the contract default.
  for (const vis of b.registry.visibles) {
    const key = boolKeys[vis.prop];
    if (!key) continue;
    vis.node.componentPropertyReferences = { visible: key };
    vis.node.visible = vis.default;
  }
}

let target;
if (IS_SET) {
  // combineAsVariants requires the nodes to already be ON the parent page.
  for (const b of built) compPage.appendChild(b.comp);
  target = figma.combineAsVariants(built.map((b) => b.comp), compPage);
  // Tight grid: rows = first axis, columns = second; per-track max sizing.
  const specByName = new Map(ALL_VARIANTS.map((s) => [s.name, s]));
  const rowsN = Math.max(...ALL_VARIANTS.map((v) => v.row)) + 1;
  const colsN = Math.max(...ALL_VARIANTS.map((v) => v.col)) + 1;
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
} else {
  target = built[0].comp;
  compPage.appendChild(target);
}
target.name = SET_NAME;
target.setSharedPluginData('ds_contracts', 'contractId', CONTRACT_ID);
target.description = DESCRIPTION;
target.x = 100;
target.y = 100;

const propNames = Object.keys(target.componentPropertyDefinitions || {});
return {
  createdNodeIds: [target.id],
  nodeId: target.id,
  key: target.key,
  variants: IS_SET ? target.children.length : 1,
  properties: propNames,
};
`;
}

// ---------------------------------------------------------------------------
// Batch script emission — several components per script (minified specs),
// same runtime as the per-component scripts but parameterized and looped.
// Existing components are skipped, so batches are safe to re-run.
// ---------------------------------------------------------------------------

function buildBatchScript(datas: ComponentData[], fileKey: string | null): string {
  const hasOpacity = datas.some(dataHasOpacity);
  const hasShape = datas.some((d) => dataSome(d, (x) => x.shape !== undefined));
  const hasShadow = datas.some((d) => dataSome(d, (x) => x.dropShadow !== undefined));
  const hasLineHeight = datas.some((d) => dataSome(d, (x) => x.lineHeight !== undefined));
  const hasAbsolute = datas.some((d) => dataSome(d, (x) => x.absolute !== undefined));
  return `// GENERATED by scripts/generate-figma.ts — DO NOT EDIT.
// Batch sync: ${datas.map((d) => d.setName).join(', ')} (existing components skip).
const COMPONENTS = ${JSON.stringify(datas)};
const ROW_H = 240, PAD = 40;

const EXPECTED_FILE_KEY = ${JSON.stringify(fileKey)};
if (EXPECTED_FILE_KEY && figma.fileKey && figma.fileKey !== EXPECTED_FILE_KEY) {
  throw new Error('WRONG FILE: expected ' + EXPECTED_FILE_KEY + ', got ' + figma.fileKey);
}

await figma.loadAllPagesAsync();

const allVars = await figma.variables.getLocalVariablesAsync();
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
  const v = need(varName);
  let base = { r: 0, g: 0, b: 0 };
  if (consumer) {
    try {
      const r = v.resolveForConsumer(consumer);
      if (r && r.value && r.value.r !== undefined) base = { r: r.value.r, g: r.value.g, b: r.value.b };
    } catch (e) { /* fall back to black base */ }
  }
  return figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: base }, 'color', v);
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

function setInstanceProps(inst, props) {
  const available = Object.keys(inst.componentProperties);
  const resolved = {};
  for (const [wanted, value] of Object.entries(props)) {
    const key = available.find((k) => k === wanted || k.startsWith(wanted + '#'));
    if (key) resolved[key] = value;
  }
  if (Object.keys(resolved).length > 0) inst.setProperties(resolved);
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
  node.counterAxisAlignItems = l.counter;
  node.primaryAxisSizingMode = 'AUTO';
  node.counterAxisSizingMode = 'AUTO';
  if (node.type === 'FRAME') node.fills = [];
  for (const [field, varName] of Object.entries(spec.bindings || {})) {
    node.setBoundVariable(field, need(varName));
  }
  if (spec.fill) node.fills = [boundPaint(spec.fill, node)];
  if (spec.stroke) {
    node.strokes = [boundPaint(spec.stroke, node)];
    node.strokeAlign = 'INSIDE';
  }${shadowRuntime(hasShadow)}
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
      node.setBoundVariable('height', need(spec.fixedHeight.varName));
    }
  }
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
${absoluteRuntime(hasAbsolute)}
async function buildNode(spec, registry) {
  let node;
  if (spec.type === 'svg') {
    node = figma.createNodeFromSvg(spec.svg);
    node.fills = [];
    node.clipsContent = false;
  } else if (spec.type === 'text') {
    node = figma.createText();
    node.fontName = { family: 'Inter', style: spec.fontStyle || 'Medium' };
    node.fontSize = spec.fontSize || 16;
    node.characters = spec.characters || '';${lineHeightRuntime(hasLineHeight)}
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
      if (spec.stroke) { wrap.strokes = [boundPaint(spec.stroke, wrap)]; wrap.strokeAlign = 'INSIDE'; }
      if (spec.characters) wrap.appendChild(node); else node.remove();
      if (spec.fixedWidth || spec.fixedHeight) {
        wrap.resize(spec.fixedWidth ? spec.fixedWidth.px : wrap.width, spec.fixedHeight ? spec.fixedHeight.px : wrap.height);
        if (spec.fixedWidth) { wrap.primaryAxisSizingMode = 'FIXED'; wrap.setBoundVariable('width', need(spec.fixedWidth.varName)); }
        if (spec.fixedHeight) { wrap.counterAxisSizingMode = 'FIXED'; wrap.setBoundVariable('height', need(spec.fixedHeight.varName)); }
      }
      wrap.name = spec.name;
      node = wrap;
    }
  } else if (spec.type === 'instance') {
    const target = findComponentByName(spec.dep);
    const main = target.type === 'COMPONENT_SET' ? target.defaultVariant : target;
    node = main.createInstance();
    if (spec.depProps) setInstanceProps(node, spec.depProps);
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
        if (item.props) setInstanceProps(inst, item.props);
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
  }${shapeRuntime(hasShape)} else {
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
    if (child.grow && 'layoutSizingHorizontal' in childNode) {
      try { childNode.layoutSizingHorizontal = 'FILL'; } catch (e) { /* HUG-only nodes */ }
    } else if (
      spec.layout && spec.layout.stretchChildren &&
      !child.fixedWidth && child.type !== 'instance' &&
      'layoutSizingHorizontal' in childNode
    ) {
      try { childNode.layoutSizingHorizontal = 'FILL'; } catch (e) { /* HUG-only nodes */ }
    }
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
        if (childSpec.grow && 'layoutSizingHorizontal' in childNode) {
          try { childNode.layoutSizingHorizontal = 'FILL'; } catch (e) {}
        } else if (v.spec.layout && v.spec.layout.stretchChildren && !childSpec.fixedWidth && childSpec.type !== 'instance' && 'layoutSizingHorizontal' in childNode) {
          try { childNode.layoutSizingHorizontal = 'FILL'; } catch (e) {}
        }
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
  set.description = C.description;
  set.setSharedPluginData('ds_contracts', 'specHash', hash);
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
  if (existing) {
    existing.setSharedPluginData('ds_contracts', 'contractId', C.contractId);
    return { name: C.setName, skipped: true, reason: 'standalone component — amend supports variant sets in v1', nodeId: existing.id, key: existing.key };
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
  for (const b of built) {
    for (const t of b.registry.texts) {
      const key = b.comp.addComponentProperty(t.prop, 'TEXT', t.default);
      t.node.componentPropertyReferences = { characters: key };
    }
    for (const s of b.registry.slots) {
      const util = await ensureSlotUtility();
      const preferred = [];
      for (const depName of s.spec.slotAccepts || []) {
        const target = findComponentByName(depName);
        preferred.push({
          type: target.type === 'COMPONENT_SET' ? 'COMPONENT_SET' : 'COMPONENT',
          key: target.key,
        });
      }
      const key = b.comp.addComponentProperty(
        s.spec.slotProperty,
        'INSTANCE_SWAP',
        s.defaultId || util.id,
        preferred.length > 0 ? { preferredValues: preferred } : undefined,
      );
      s.instance.componentPropertyReferences = { mainComponent: key };
      if (s.spec.slotOptional) {
        const vkey = b.comp.addComponentProperty('Show ' + s.spec.slotProperty, 'BOOLEAN', true);
        s.wrapper.componentPropertyReferences = { visible: vkey };
      }
    }
    const boolKeys = {};
    for (const bp of C.boolProps) {
      boolKeys[bp.property] = b.comp.addComponentProperty(bp.property, 'BOOLEAN', bp.default);
    }
    for (const tp of C.textProps || []) {
      b.comp.addComponentProperty(tp.property, 'TEXT', tp.default);
    }
    for (const vis of b.registry.visibles) {
      const key = boolKeys[vis.prop];
      if (!key) continue;
      vis.node.componentPropertyReferences = { visible: key };
      vis.node.visible = vis.default;
    }
  }

  let target;
  if (C.isSet) {
    // combineAsVariants requires the nodes to already be ON the parent page.
    for (const b of built) compPage.appendChild(b.comp);
    target = figma.combineAsVariants(built.map((b) => b.comp), compPage);
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
  } else {
    target = built[0].comp;
    compPage.appendChild(target);
  }
  target.name = displayName;
  target.description = C.description;
  target.x = 100;
  target.y = 100;
  target.setSharedPluginData('ds_contracts', 'specHash', specHash(C));
  target.setSharedPluginData('ds_contracts', 'contractId', C.contractId);

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
