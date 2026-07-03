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

const ALIAS = /^\{([^}]+)\}$/;
const aliasTarget = (v: unknown): string | null =>
  typeof v === 'string' ? (v.match(ALIAS)?.[1] ?? null) : null;

const figmaName = (dotPath: string) => dotPath.split('.').join('/');
const cssVarName = (dotPath: string) => `var(--${dotPath.split('.').join('-')})`;

function resolveLiteral(dotPath: string): unknown {
  const all = new Map([...primitives, ...semantic, ...light]);
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

function buildTokensScript(): string {
  const prim = [...primitives].map(([p, entry]) => ({
    name: figmaName(p),
    type: figmaType(entry),
    value: figmaValue(entry),
    scopes: scopesFor(p, entry),
    codeSyntax: cssVarName(p),
  }));

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
// Upserts variable collections: Primitives (mode "Value"), Semantic (modes "Light"/"Dark").
const PRIMITIVES = ${JSON.stringify(prim, null, 2)};
const SEMANTIC = ${JSON.stringify(sem, null, 2)};

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
  const lightVar = primByName[t.light];
  const darkVar = primByName[t.dark];
  if (!lightVar || !darkVar) throw new Error('Missing primitive for ' + t.name);
  v.setValueForMode(lightModeId, { type: 'VARIABLE_ALIAS', id: lightVar.id });
  v.setValueForMode(darkModeId, { type: 'VARIABLE_ALIAS', id: darkVar.id });
  v.scopes = t.scopes;
  v.setVariableCodeSyntax('WEB', t.codeSyntax);
}

return {
  primitives: { collectionId: prim.id, total: PRIMITIVES.length, created: createdPrim },
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
  type: 'root' | 'frame' | 'text' | 'instance' | 'slot';
  name: string;
  layout?: LayoutSpec;
  bindings?: Record<string, string>;
  fill?: string;
  stroke?: string;
  fixedWidth?: { px: number; varName: string };
  fixedHeight?: { px: number; varName: string };
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
  children?: NodeSpec[];
}

interface TextCtx {
  textFill?: string;
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

function partToSpec(
  name: string,
  part: Part,
  contract: Contract,
  byId: Map<string, Contract>,
  ctx: TextCtx,
): NodeSpec {
  if (part.component) {
    const dep = byId.get(part.component.id)!;
    const depProps: Record<string, string | boolean> = {};
    for (const [propName, value] of Object.entries(part.component.props ?? {})) {
      const depProp = dep.props.find((p) => p.name === propName);
      if (!depProp) continue;
      if (typeof value === 'boolean') depProps[depProp.bindings.figma.property] = value;
      else depProps[depProp.bindings.figma.property] = depProp.bindings.figma.values?.[value] ?? value;
    }
    return { type: 'instance', name, dep: dep.name, depProps };
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
    applyTokens(spec, part.tokens ?? {}, {}, ctx);
    return spec;
  }
  if (part.content) {
    const prop = contract.props.find(
      (p) => p.type === 'text' && p.bindings.code.prop === part.content!.prop,
    )!;
    const spec: NodeSpec = { type: 'text', name };
    const textCtx = applyTokens(spec, part.tokens ?? {}, {}, ctx);
    spec.characters = typeof prop.default === 'string' ? prop.default : contract.name;
    spec.fontSize = textCtx.fontSize ?? 16;
    spec.fontStyle = textCtx.fontStyle ?? 'Medium';
    spec.textFill = textCtx.textFill;
    spec.contentProp = prop.bindings.figma.property;
    return spec;
  }
  const spec: NodeSpec = { type: 'frame', name, layout: layoutSpec(part, false) };
  const childCtx = applyTokens(spec, part.tokens ?? {}, {}, ctx);
  spec.children = Object.entries(part.parts ?? {}).map(([childName, child]) =>
    partToSpec(childName, child, contract, byId, childCtx),
  );
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

function buildComponentScript(contract: Contract, byId: Map<string, Contract>): string {
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
        rootSpec.children = Object.entries(root.parts).map(([childName, child]) =>
          partToSpec(childName, child, contract, byId, ctx),
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

  return `// GENERATED by scripts/generate-figma.ts — DO NOT EDIT.
// Source of truth: contracts/${contract.id.replace('ds.', '')}.contract.json (${contract.id} v${contract.version})
const SET_NAME = ${JSON.stringify(contract.name)};
const DESCRIPTION = ${JSON.stringify(`${contract.description} — governed by contract ${contract.id} v${contract.version}`)};
const IS_SET = ${variants.length > 1};
const BOOL_PROPS = ${JSON.stringify(boolPropsData)};
const FONT_STYLES = ${JSON.stringify([...fontStyles])};
const VARIANTS = ${JSON.stringify(variants, null, 2)};
const COL_W = 380, ROW_H = 240, PAD = 40;

// File guard: multi-file bridge routing has been observed to hit the wrong
// file — never write without verifying the target.
const EXPECTED_FILE_KEY = ${JSON.stringify(contract.anchors.figma.fileKey)};
if (EXPECTED_FILE_KEY && figma.fileKey && figma.fileKey !== EXPECTED_FILE_KEY) {
  throw new Error('WRONG FILE: expected ' + EXPECTED_FILE_KEY + ', got ' + figma.fileKey);
}

await figma.loadAllPagesAsync();

// Skip if the component (set) already exists (idempotency guard).
const existing = figma.currentPage.findOne(
  (n) => (n.type === 'COMPONENT_SET' || n.type === 'COMPONENT') && n.name === SET_NAME,
);
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
  if (spec.type === 'text') {
    node = figma.createText();
    node.fontName = { family: 'Inter', style: spec.fontStyle || 'Medium' };
    node.fontSize = spec.fontSize || 16;
    node.characters = spec.characters || '';
    if (spec.textFill) node.fills = [boundPaint(spec.textFill)];
    if (spec.contentProp) {
      registry.texts.push({ prop: spec.contentProp, node, default: spec.characters || '' });
    }
  } else if (spec.type === 'instance') {
    const target = findComponentByName(spec.dep);
    const main = target.type === 'COMPONENT_SET' ? target.defaultVariant : target;
    node = main.createInstance();
    if (spec.depProps) setInstanceProps(node, spec.depProps);
  } else if (spec.type === 'slot') {
    const util = await ensureSlotUtility();
    node = figma.createFrame();
    applyFrameSpec(node, spec);
    const inst = util.createInstance();
    node.appendChild(inst);
    registry.slots.push({ spec, wrapper: node, instance: inst });
  } else {
    node = spec.type === 'root' ? figma.createComponent() : figma.createFrame();
    applyFrameSpec(node, spec);
  }
  node.name = spec.name;
  for (const child of spec.children || []) {
    const childNode = await buildNode(child, registry);
    node.appendChild(childNode);
    if (
      spec.layout && spec.layout.stretchChildren &&
      !child.fixedWidth && child.type !== 'instance' &&
      'layoutSizingHorizontal' in childNode
    ) {
      try { childNode.layoutSizingHorizontal = 'FILL'; } catch (e) { /* HUG-only nodes */ }
    }
  }
  return node;
}

// Find or create the Components section, placed clear of existing content.
let section = figma.currentPage.findOne((n) => n.type === 'SECTION' && n.name === 'Components');
if (!section) {
  section = figma.createSection();
  section.name = 'Components';
  let maxX = 0;
  for (const n of figma.currentPage.children) {
    if (n !== section) maxX = Math.max(maxX, n.x + n.width);
  }
  section.x = maxX + 100;
  section.y = 0;
}
let startY = PAD;
for (const n of section.children) startY = Math.max(startY, n.y + n.height + PAD);

// Build every variant, then add properties BEFORE combining.
const built = [];
for (const v of VARIANTS) {
  const registry = { texts: [], slots: [] };
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
      util.id,
      preferred.length > 0 ? { preferredValues: preferred } : undefined,
    );
    s.instance.componentPropertyReferences = { mainComponent: key };
    if (s.spec.slotOptional) {
      const vkey = b.comp.addComponentProperty('Show ' + s.spec.slotProperty, 'BOOLEAN', true);
      s.wrapper.componentPropertyReferences = { visible: vkey };
    }
  }
  for (const bp of BOOL_PROPS) {
    b.comp.addComponentProperty(bp.property, 'BOOLEAN', bp.default);
  }
}

let target;
if (IS_SET) {
  target = figma.combineAsVariants(built.map((b) => b.comp), section);
  const specByName = new Map(VARIANTS.map((s) => [s.name, s]));
  for (const child of target.children) {
    const spec = specByName.get(child.name);
    if (!spec) continue;
    child.x = PAD + spec.col * COL_W;
    child.y = PAD + spec.row * ROW_H;
  }
  let maxX = 0, maxY = 0;
  for (const child of target.children) {
    maxX = Math.max(maxX, child.x + child.width);
    maxY = Math.max(maxY, child.y + child.height);
  }
  target.resizeWithoutConstraints(maxX + PAD, maxY + PAD);
} else {
  target = built[0].comp;
  section.appendChild(target);
}
target.name = SET_NAME;
target.description = DESCRIPTION;
target.x = PAD;
target.y = startY;

let sMaxX = 0, sMaxY = 0;
for (const n of section.children) {
  sMaxX = Math.max(sMaxX, n.x + n.width);
  sMaxY = Math.max(sMaxY, n.y + n.height);
}
section.resizeWithoutConstraints(sMaxX + PAD, sMaxY + PAD);

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
// Main
// ---------------------------------------------------------------------------

mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, '01-tokens.js'), buildTokensScript());

const contracts = readdirSync(path.join(ROOT, 'contracts'))
  .filter((f) => f.endsWith('.contract.json'))
  .map((f) => ContractSchema.parse(read(path.join('contracts', f))));
const ordered = sortByDependencies(contracts); // dependency order + cycle/ref gate
const byId = new Map(contracts.map((c) => [c.id, c]));

let index = 2;
const emitted = ['01-tokens.js'];
for (const contract of ordered) {
  const outName = `${String(index).padStart(2, '0')}-${contract.name.toLowerCase()}.js`;
  writeFileSync(path.join(OUT, outName), buildComponentScript(contract, byId));
  emitted.push(outName);
  index++;
}

console.log(`✔ Emitted figma-sync scripts (dependency order): ${emitted.join(', ')}`);
