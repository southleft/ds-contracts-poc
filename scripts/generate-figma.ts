/**
 * Contract → Figma sync-script generator. (v2 — composition)
 *
 * Reads tokens/ and contracts/ and emits deterministic Figma Plugin API
 * scripts into figma-sync/. The scripts are TRANSPORT-AGNOSTIC: they run
 * unchanged through any tool that executes Plugin API JS in the file —
 * the Figma MCP's `use_figma`, or figma-console-mcp's `figma_execute`.
 *
 *   figma-sync/01-tokens.js   variables (collections, modes, aliases, scopes,
 *                             codeSyntax) — unchanged from v1
 *   figma-sync/NN-<name>.js   one component (set) per contract, emitted in
 *                             dependency order. v2 compiles each contract's
 *                             anatomy tree into a NODE SPEC executed by a
 *                             generic runtime: nested auto-layout frames,
 *                             fixed instances of dependency contracts,
 *                             TEXT-bound content parts, and slots
 *                             (Slot-utility placeholder + INSTANCE_SWAP with
 *                             preferredValues resolved from `accepts`;
 *                             optional slots get a "Show X" BOOLEAN).
 *
 * Fidelity scope (deliberate, documented in docs/05 + docs/08):
 * - fontSize/family/weight are not variable-bindable → set numerically from
 *   resolved token values (weight → Inter style name).
 * - Interaction states are CSS concerns; not represented in Figma.
 * - Slot `accepts` maps to INSTANCE_SWAP preferredValues (soft constraint);
 *   Figma's native SLOT property type + SlotSettings is the upgrade target.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  ContractSchema,
  pascal,
  slotFigmaProperty,
  slotVisibilityProperty,
  sortByDependencies,
  type Contract,
  type Part,
  type Prop,
} from './contract-schema.js';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'figma-sync');

// ---------------------------------------------------------------------------
// Token loading (shared with v1)
// ---------------------------------------------------------------------------

type TokenEntry = { value: unknown; type: string };

function flatten(
  tree: Record<string, unknown>,
  prefix: string[] = [],
  inheritedType = '',
  out = new Map<string, TokenEntry>(),
): Map<string, TokenEntry> {
  const ownType = typeof tree.$type === 'string' ? tree.$type : inheritedType;
  for (const [key, value] of Object.entries(tree)) {
    if (key.startsWith('$')) continue;
    if (value && typeof value === 'object') {
      const v = value as Record<string, unknown>;
      if ('$value' in v) {
        const type = typeof v.$type === 'string' ? v.$type : ownType;
        out.set([...prefix, key].join('.'), { value: v.$value, type });
      } else {
        flatten(v, [...prefix, key], ownType, out);
      }
    }
  }
  return out;
}

const read = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8'));
const primitives = flatten(read('tokens/primitives.tokens.json'));
const semantic = flatten(read('tokens/semantic.tokens.json'));
const light = flatten(read('tokens/modes/semantic.light.tokens.json'));
const dark = flatten(read('tokens/modes/semantic.dark.tokens.json'));

// Brand dimension (mirrors scripts/build-tokens.mjs discovery): one Figma
// collection "Brand" whose modes are the brand names — the enterprise
// collection-per-dimension pattern. Semantic aliases route through it.
const brandNames = readdirSync(path.join(ROOT, 'tokens', 'modes'))
  .filter((f) => /^brand\.[a-z][a-z0-9-]*\.tokens\.json$/.test(f))
  .map((f) => f.replace(/^brand\.|\.tokens\.json$/g, ''))
  .sort((a, b) => (a === 'default' ? -1 : b === 'default' ? 1 : a.localeCompare(b)));
const brandModes = new Map(
  brandNames.map((n) => [n, flatten(read(`tokens/modes/brand.${n}.tokens.json`))]),
);

const ALIAS = /^\{([^}]+)\}$/;
const aliasTarget = (v: unknown): string | null =>
  typeof v === 'string' ? (v.match(ALIAS)?.[1] ?? null) : null;

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

const px = (v: unknown): number => {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v));
  if (Number.isNaN(n)) throw new Error(`Not a numeric token value: ${v}`);
  return n;
};

const FONT_STYLE_BY_WEIGHT: Record<number, string> = {
  400: 'Regular',
  500: 'Medium',
  600: 'Semi Bold',
  700: 'Bold',
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

return {
  primitives: { collectionId: prim.id, total: PRIMITIVES.length, created: createdPrim },
  brand: { collectionId: brandCol.id, modes: BRAND_MODES, total: BRAND.length, created: createdBrand },
  semantic: { collectionId: sem.id, total: SEMANTIC.length, created: createdSem },
};
`;
}

// ---------------------------------------------------------------------------
// Node specs — the compiled form of a contract's anatomy tree
// ---------------------------------------------------------------------------

interface LayoutSpec {
  mode: 'HORIZONTAL' | 'VERTICAL';
  primary: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counter: 'MIN' | 'CENTER' | 'MAX';
  stretchChildren?: boolean;
}

interface NodeSpec {
  type: 'root' | 'frame' | 'text' | 'instance' | 'slot' | 'svg';
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
  // svg (icon parts) — markup with currentColor resolved to the variant's
  // literal foreground color (SVG paint is not variable-bindable on import)
  svg?: string;
  // text
  characters?: string;
  fontSize?: number;
  fontStyle?: string;
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

interface TextCtx {
  textFill?: string;
  /** Token dot-path behind textFill — icon parts resolve it to a literal hex. */
  textFillPath?: string;
  fontSize?: number;
  fontStyle?: string;
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

function layoutSpec(part: Part, isRoot: boolean): LayoutSpec {
  const l = part.layout;
  if (!l && isRoot) {
    return { mode: 'HORIZONTAL', primary: 'CENTER', counter: 'CENTER' };
  }
  return {
    mode: l?.direction === 'column' ? 'VERTICAL' : 'HORIZONTAL',
    primary: l?.justify ? JUSTIFY_FIGMA[l.justify] : 'MIN',
    counter: l?.align ? ALIGN_FIGMA[l.align] : 'MIN',
    stretchChildren: l?.align === 'stretch' || undefined,
  };
}

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
      default:
        break; // outline-* etc. are state/CSS concerns
    }
  }
  return next;
}

const isEnum = (p: Prop): p is Prop & { type: { enum: string[] } } =>
  typeof p.type === 'object' && 'enum' in p.type;

// Icon assets (assets/icons/*.svg) — same source the code generator inlines.
const iconAssets = new Map<string, string>();
{
  const dir = path.join(ROOT, 'assets', 'icons');
  try {
    for (const f of readdirSync(dir)) {
      if (f.endsWith('.svg')) {
        iconAssets.set(f.replace(/\.svg$/, ''), readFileSync(path.join(dir, f), 'utf8').trim());
      }
    }
  } catch {
    /* no icons dir — contracts without icon parts */
  }
}

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
  const childCtx = applyTokens(spec, part.tokens ?? {}, subst, ctx);
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
    if (typeof value === 'boolean') out[depProp.bindings.figma.property] = value;
    else out[depProp.bindings.figma.property] = depProp.bindings.figma.values?.[value] ?? value;
  }
  if (text !== undefined) {
    const textProp = dep.props.find((p) => p.type === 'text' && p.bindings.code.prop === 'children');
    if (textProp) out[textProp.bindings.figma.property] = text;
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
function variantParts(
  parts: Record<string, Part>,
  subst: Record<string, string>,
): Array<[string, Part]> {
  return Object.entries(parts).filter(([, p]) => {
    const vw = p.visibleWhen;
    if (!vw || vw.equals === undefined) return true;
    const value = subst[vw.prop];
    return value === undefined || value === vw.equals;
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
  if (part.icon) {
    // The part's own tokens (e.g. a color override) apply to the glyph.
    const iconCtx = applyTokens({ type: 'frame', name: '_' }, part.tokens ?? {}, subst, ctx);
    const spec: NodeSpec = {
      type: 'svg',
      name,
      svg: iconSvg(part, subst, iconCtx),
      grow: part.layout?.grow || undefined,
    };
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
    const dep = byId.get(part.component.id)!;
    return {
      type: 'instance',
      name,
      dep: dep.name,
      depProps: mapDepProps(dep, part.component.props ?? {}, subst, part.component.text),
    };
  }
  if (part.slot) {
    const spec: NodeSpec = {
      type: 'slot',
      name,
      layout: layoutSpec(part, false),
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
    applyTokens(spec, part.tokens ?? {}, subst, ctx);
    applyVisibleWhen(spec, part, contract);
    return spec;
  }
  if (part.text !== undefined) {
    const spec: NodeSpec = { type: 'text', name };
    const textCtx = applyTokens(spec, part.tokens ?? {}, subst, ctx);
    spec.characters = part.text;
    spec.fontSize = textCtx.fontSize ?? 14;
    spec.fontStyle = textCtx.fontStyle ?? 'Medium';
    spec.textFill = textCtx.textFill;
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
    applyTokens(spec, part.tokens ?? {}, subst, ctx);
    applyVisibleWhen(spec, part, contract);
    return spec;
  }
  if (part.content) {
    const prop = contract.props.find(
      (p) => p.type === 'text' && p.bindings.code.prop === part.content!.prop,
    )!;
    const spec: NodeSpec = { type: 'text', name };
    const textCtx = applyTokens(spec, part.tokens ?? {}, subst, ctx);
    spec.characters = typeof prop.default === 'string' ? prop.default : contract.name;
    spec.fontSize = textCtx.fontSize ?? 16;
    spec.fontStyle = textCtx.fontStyle ?? 'Medium';
    spec.textFill = textCtx.textFill;
    spec.contentProp = prop.bindings.figma.property;
    applyVisibleWhen(spec, part, contract);
    return spec;
  }
  const spec: NodeSpec = {
    type: 'frame',
    name,
    layout: layoutSpec(part, false),
    grow: part.layout?.grow || undefined,
  };
  const childCtx = applyTokens(spec, part.tokens ?? {}, subst, ctx);
  spec.children = variantParts(part.parts ?? {}, subst).map(([childName, child]) =>
    partToSpec(childName, child, contract, byId, childCtx, subst),
  );
  applyVisibleWhen(spec, part, contract);
  return spec;
}

// ---------------------------------------------------------------------------
// Component script emission
// ---------------------------------------------------------------------------

interface VariantSpec {
  name: string;
  row: number;
  col: number;
  spec: NodeSpec;
}

interface ComponentData {
  setName: string;
  description: string;
  isSet: boolean;
  boolProps: Array<{ property: string; default: boolean }>;
  /** Text props with no bound text node (aria-label-only props like
   *  StatusDot.label) — added as unbound TEXT properties so the API surface
   *  matches the contract. */
  textProps: Array<{ property: string; default: string }>;
  fontStyles: string[];
  variants: VariantSpec[];
  colW: number;
}

function compileComponentData(contract: Contract, byId: Map<string, Contract>): ComponentData {
  const enums = contract.props.filter(isEnum);
  const rowProp = enums[0];
  const colProp = enums[1] ?? null;
  const textProp = contract.props.find(
    (p) => p.type === 'text' && p.bindings.code.prop === 'children',
  );
  const boolPropsData = contract.props
    .filter((p) => p.type === 'boolean')
    .map((p) => ({ property: p.bindings.figma.property, default: p.default === true }));
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
  const rowValues = rowProp ? orderedValues(rowProp) : [''];
  const colValues = colProp ? orderedValues(colProp) : [''];
  const fontStyles = new Set<string>(['Medium']);

  for (let r = 0; r < rowValues.length; r++) {
    for (let c = 0; c < colValues.length; c++) {
      const subst: Record<string, string> = {};
      const nameParts: string[] = [];
      if (rowProp) {
        subst[rowProp.name] = rowValues[r];
        nameParts.push(
          `${rowProp.bindings.figma.property}=${rowProp.bindings.figma.values?.[rowValues[r]] ?? rowValues[r]}`,
        );
      }
      if (colProp) {
        subst[colProp.name] = colValues[c];
        nameParts.push(
          `${colProp.bindings.figma.property}=${colProp.bindings.figma.values?.[colValues[c]] ?? colValues[c]}`,
        );
      }

      const rootSpec: NodeSpec = {
        type: 'root',
        name: nameParts.join(', ') || contract.name,
        layout: layoutSpec(root, true),
      };
      const ctx = applyTokens(rootSpec, root.tokens ?? {}, subst, {});
      if (root.parts) {
        rootSpec.children = variantParts(root.parts, subst).map(([childName, child]) =>
          partToSpec(childName, child, contract, byId, ctx, subst),
        );
      } else if (textProp) {
        rootSpec.children = [
          {
            type: 'text',
            name: 'label',
            characters: label,
            fontSize: ctx.fontSize ?? 16,
            fontStyle: ctx.fontStyle ?? 'Medium',
            textFill: ctx.textFill,
            contentProp: textProp.bindings.figma.property,
          },
        ];
      }
      const collectStyles = (s: NodeSpec) => {
        if (s.fontStyle) fontStyles.add(s.fontStyle);
        (s.children ?? []).forEach(collectStyles);
      };
      collectStyles(rootSpec);
      variants.push({ name: rootSpec.name, row: r, col: c, spec: rootSpec });
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
        !boundTextProps.has(p.bindings.figma.property),
    )
    .map((p) => ({
      property: p.bindings.figma.property,
      default:
        typeof p.default === 'string' ? p.default : typeof p.default === 'number' ? String(p.default) : '',
    }));

  return {
    setName: contract.name,
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
    isSet: variants.length > 1,
    boolProps: boolPropsData,
    textProps: textOnlyProps,
    fontStyles: [...fontStyles],
    variants,
    colW: Math.max(380, ...variants.map((v) => (v.spec.fixedWidth?.px ?? 0) + 60)),
  };
}

function buildComponentScript(contract: Contract, byId: Map<string, Contract>): string {
  const data = compileComponentData(contract, byId);

  return `// GENERATED by scripts/generate-figma.ts — DO NOT EDIT.
// Source of truth: contracts/${contract.id.replace('ds.', '')}.contract.json (${contract.id} v${contract.version})
const SET_NAME = ${JSON.stringify(data.setName)};
const DESCRIPTION = ${JSON.stringify(data.description)};
const IS_SET = ${data.isSet};
const BOOL_PROPS = ${JSON.stringify(data.boolProps)};
const TEXT_PROPS = ${JSON.stringify(data.textProps)};
const FONT_STYLES = ${JSON.stringify(data.fontStyles)};
const VARIANTS = ${JSON.stringify(data.variants, null, 2)};
const COL_W = ${data.colW}, ROW_H = 240, PAD = 40;

// File guard: multi-file bridge routing has been observed to hit the wrong
// file — never write without verifying the target.
const EXPECTED_FILE_KEY = ${JSON.stringify(contract.anchors.figma.fileKey)};
if (EXPECTED_FILE_KEY && figma.fileKey && figma.fileKey !== EXPECTED_FILE_KEY) {
  throw new Error('WRONG FILE: expected ' + EXPECTED_FILE_KEY + ', got ' + figma.fileKey);
}

await figma.loadAllPagesAsync();

// Skip if the component (set) already exists on ANY page (idempotency guard).
let existing = null;
for (const page of figma.root.children) {
  existing = page.findOne(
    (n) => (n.type === 'COMPONENT_SET' || n.type === 'COMPONENT') && n.name === SET_NAME,
  );
  if (existing) break;
}
if (existing) return { skipped: true, nodeId: existing.id, key: existing.key };

const allVars = await figma.variables.getLocalVariablesAsync();
const varByName = {};
for (const v of allVars) varByName[v.name] = v;
const need = (name) => {
  const v = varByName[name];
  if (!v) throw new Error('Missing variable: ' + name);
  return v;
};
const boundPaint = (varName) =>
  figma.variables.setBoundVariableForPaint(
    { type: 'SOLID', color: { r: 0, g: 0, b: 0 } },
    'color',
    need(varName),
  );

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
  if (spec.fill) node.fills = [boundPaint(spec.fill)];
  if (spec.stroke) {
    node.strokes = [boundPaint(spec.stroke)];
    node.strokeAlign = 'INSIDE';
  }
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
    node.characters = spec.characters || '';
    if (spec.textFill) node.fills = [boundPaint(spec.textFill)];
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
      if (spec.fill) wrap.fills = [boundPaint(spec.fill)];
      if (spec.stroke) { wrap.strokes = [boundPaint(spec.stroke)]; wrap.strokeAlign = 'INSIDE'; }
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
  } else {
    node = spec.type === 'root' ? figma.createComponent() : figma.createFrame();
    applyFrameSpec(node, spec);
  }
  node.name = spec.name;
  if (spec.visibleProp) {
    registry.visibles.push({ node, prop: spec.visibleProp, default: spec.visibleDefault === true });
  }
  for (const child of spec.children || []) {
    const childNode = await buildNode(child, registry);
    node.appendChild(childNode);
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
for (const v of VARIANTS) {
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
  target = figma.combineAsVariants(built.map((b) => b.comp), compPage);
  // Tight grid: rows = first axis, columns = second; per-track max sizing.
  const specByName = new Map(VARIANTS.map((s) => [s.name, s]));
  const rowsN = Math.max(...VARIANTS.map((v) => v.row)) + 1;
  const colsN = Math.max(...VARIANTS.map((v) => v.col)) + 1;
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
target.description = DESCRIPTION;
target.x = 100;
target.y = 100;

const propNames = Object.keys(target.componentPropertyDefinitions || {});
return {
  createdNodeIds: [target.id],
  nodeId: target.id,
  key: target.key,
  sectionId: section.id,
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
const boundPaint = (varName) =>
  figma.variables.setBoundVariableForPaint(
    { type: 'SOLID', color: { r: 0, g: 0, b: 0 } },
    'color',
    need(varName),
  );

const fontStyles = new Set(['Medium']);
for (const C of COMPONENTS) for (const s of C.fontStyles) fontStyles.add(s);
for (const style of fontStyles) {
  await figma.loadFontAsync({ family: 'Inter', style });
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
  throw new Error('Slot utility component missing — run a per-component sync script first.');
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
  if (spec.fill) node.fills = [boundPaint(spec.fill)];
  if (spec.stroke) {
    node.strokes = [boundPaint(spec.stroke)];
    node.strokeAlign = 'INSIDE';
  }
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
    node.characters = spec.characters || '';
    if (spec.textFill) node.fills = [boundPaint(spec.textFill)];
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
      if (spec.fill) wrap.fills = [boundPaint(spec.fill)];
      if (spec.stroke) { wrap.strokes = [boundPaint(spec.stroke)]; wrap.strokeAlign = 'INSIDE'; }
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
  } else {
    node = spec.type === 'root' ? figma.createComponent() : figma.createFrame();
    applyFrameSpec(node, spec);
  }
  node.name = spec.name;
  if (spec.visibleProp) {
    registry.visibles.push({ node, prop: spec.visibleProp, default: spec.visibleDefault === true });
  }
  for (const child of spec.children || []) {
    const childNode = await buildNode(child, registry);
    node.appendChild(childNode);
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

async function syncOne(C) {
  let existing = null;
  for (const page of figma.root.children) {
    existing = page.findOne(
      (n) => (n.type === 'COMPONENT_SET' || n.type === 'COMPONENT') && n.name === C.setName,
    );
    if (existing) break;
  }
  if (existing) return { name: C.setName, skipped: true, nodeId: existing.id, key: existing.key };

  // One page per component (see figma-sync/arrange.js for the file layout).
  let compPage = figma.root.children.find((p) => p.name === C.setName);
  if (!compPage) { compPage = figma.createPage(); compPage.name = C.setName; }

  const built = [];
  for (const v of C.variants) {
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
    target = figma.combineAsVariants(built.map((b) => b.comp), compPage);
    // Tight grid: rows = first axis, columns = second; per-track max sizing.
    const specByName = new Map(C.variants.map((s) => [s.name, s]));
    const rowsN = Math.max(...C.variants.map((v) => v.row)) + 1;
    const colsN = Math.max(...C.variants.map((v) => v.col)) + 1;
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
  target.name = C.setName;
  target.description = C.description;
  target.x = 100;
  target.y = 100;

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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

mkdirSync(OUT, { recursive: true });

const contracts = readdirSync(path.join(ROOT, 'contracts'))
  .filter((f) => f.endsWith('.contract.json'))
  .map((f) => ContractSchema.parse(read(path.join('contracts', f))));
// FIGMA_FILE_KEY: rebuild-into-a-fresh-file support — overrides the anchor
// file key baked into every script's WRONG FILE guard. FIGMA_BATCH_LIMIT:
// transport cap per batch script (the desktop bridge accepts ~50k chars).
const targetFileKey = process.env.FIGMA_FILE_KEY ?? contracts[0]?.anchors.figma.fileKey ?? null;
writeFileSync(path.join(OUT, '01-tokens.js'), buildTokensScript(targetFileKey));
const ordered = sortByDependencies(contracts); // dependency order + cycle/ref gate
const byId = new Map(contracts.map((c) => [c.id, c]));

let index = 2;
const emitted = ['01-tokens.js'];
for (const contract of ordered) {
  if (contract.figmaRepresentation === 'native') continue; // maps to native canvas capability
  const outName = `${String(index).padStart(2, '0')}-${contract.name.toLowerCase()}.js`;
  writeFileSync(path.join(OUT, outName), buildComponentScript(contract, byId));
  emitted.push(outName);
  index++;
}

// Batch scripts: all components in dependency order, chunked so each script
// stays transport-friendly. Existing components skip, so re-runs are safe.
const BATCH_LIMIT = Number(process.env.FIGMA_BATCH_LIMIT ?? 60_000);
const batchable = ordered.filter((c) => c.figmaRepresentation !== 'native');
const fileKey = targetFileKey;
const batches: ComponentData[][] = [[]];
for (const contract of batchable) {
  const data = compileComponentData(contract, byId);
  const current = batches[batches.length - 1];
  const projected = JSON.stringify([...current, data]).length;
  if (current.length > 0 && projected > BATCH_LIMIT) batches.push([data]);
  else current.push(data);
}
batches.forEach((batch, i) => {
  const name = `batch-${String(i + 1).padStart(2, '0')}.js`;
  writeFileSync(path.join(OUT, name), buildBatchScript(batch, fileKey));
  emitted.push(name);
});

console.log(`✔ Emitted figma-sync scripts (dependency order): ${emitted.join(', ')}`);
