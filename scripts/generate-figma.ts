/**
 * Contract → Figma sync-script generator.
 *
 * Reads tokens/ and contracts/ and emits deterministic Figma Plugin API
 * scripts into figma-sync/. The scripts are TRANSPORT-AGNOSTIC: they run
 * unchanged through any tool that executes Plugin API JS in the file —
 * the Figma MCP's `use_figma`, or figma-console-mcp's `figma_execute`.
 *
 *   figma-sync/01-tokens.js   variables: Primitives (Value) + Semantic (Light/Dark),
 *                             aliases mirroring the DTCG alias graph, scopes,
 *                             codeSyntax.WEB = the generated CSS custom property
 *   figma-sync/02-<name>.js   one component set per contract (variant matrix,
 *                             variable bindings, Label/Boolean properties)
 *
 * All scripts are idempotent-safe: token script upserts; component scripts
 * skip if a set with the same name already exists (return its id/key).
 *
 * Known fidelity scope (deliberate, documented in docs/05-figma-sync.md):
 * - fontSize is not variable-bindable in the Plugin API → set numerically
 *   from the resolved token value.
 * - font-family/weight are set statically (Inter Medium).
 * - Interaction states (hover/focus/disabled) are CSS concerns; boolean props
 *   like Disabled are declared for API parity but not visually linked.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, type Contract } from './contract-schema.js';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'figma-sync');

// ---------------------------------------------------------------------------
// Token loading
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

/** Resolve a token path through aliases to its literal value. */
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

function figmaType(entry: TokenEntry): 'COLOR' | 'FLOAT' | 'STRING' {
  if (entry.type === 'color') return 'COLOR';
  if (entry.type === 'fontFamily') return 'STRING';
  return 'FLOAT'; // dimension, fontWeight, number
}

function figmaValue(entry: TokenEntry): unknown {
  if (entry.type === 'color') return entry.value; // hex string; script converts
  if (entry.type === 'fontFamily') return entry.value;
  return px(entry.value);
}

function scopesFor(dotPath: string, entry: TokenEntry): string[] {
  if (entry.type === 'color') return ['ALL_FILLS', 'STROKE_COLOR'];
  if (dotPath.startsWith('space')) return ['GAP', 'WIDTH_HEIGHT'];
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
// 01-tokens.js
// ---------------------------------------------------------------------------

function buildTokensScript(): string {
  const prim = [...primitives].map(([p, entry]) => ({
    name: figmaName(p),
    type: figmaType(entry),
    value: figmaValue(entry),
    scopes: scopesFor(p, entry),
    codeSyntax: cssVarName(p),
  }));

  // Semantic = mode-independent aliases (same target both modes) + mode-varying.
  const sem: Array<{
    name: string;
    type: string;
    light: string;
    dark: string;
    scopes: string[];
    codeSyntax: string;
  }> = [];
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

// --- Primitives ---
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

// --- Semantic ---
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
// Component scripts
// ---------------------------------------------------------------------------

const CSS_TO_FIGMA_BINDINGS: Record<string, string[]> = {
  'background-color': ['__fill__'],
  color: ['__textFill__'],
  'padding-inline': ['paddingLeft', 'paddingRight'],
  'padding-block': ['paddingTop', 'paddingBottom'],
  'border-radius': ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'],
  gap: ['itemSpacing'],
  'font-size': ['__fontSize__'], // not variable-bindable → numeric
  'font-family': [], // static Inter (documented fidelity scope)
  'font-weight': [], // static Medium (documented fidelity scope)
};

interface VariantSpec {
  name: string;
  bindings: Record<string, string>; // figma binding field → variable name
  fill: string | null;
  textFill: string | null;
  fontSize: number;
  row: number;
  col: number;
}

function buildComponentScript(contract: Contract): string {
  const enums = contract.props.filter(
    (p): p is (typeof contract.props)[number] & { type: { enum: string[] } } =>
      typeof p.type === 'object' && 'enum' in p.type,
  );
  const rowProp = enums[0];
  const colProp = enums[1] ?? null;
  const textProp = contract.props.find((p) => p.type === 'text');
  const boolProps = contract.props.filter((p) => p.type === 'boolean');
  const label = typeof textProp?.default === 'string' ? textProp.default : contract.name;

  const root = contract.anatomy.root;
  if (!root?.tokens) throw new Error(`${contract.id}: anatomy.root.tokens required`);

  const variants: VariantSpec[] = [];
  const rowValues = rowProp ? rowProp.type.enum : [''];
  const colValues = colProp ? colProp.type.enum : [''];

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

      const spec: VariantSpec = {
        name: nameParts.join(', '),
        bindings: {},
        fill: null,
        textFill: null,
        fontSize: 16,
        row: r,
        col: c,
      };

      for (const [cssProp, ref] of Object.entries(root.tokens)) {
        let tokenPath = ref.slice(1, -1);
        for (const [propName, value] of Object.entries(subst)) {
          tokenPath = tokenPath.replaceAll(`{${propName}}`, value);
        }
        const targets = CSS_TO_FIGMA_BINDINGS[cssProp];
        if (!targets) throw new Error(`${contract.id}: no Figma mapping for CSS "${cssProp}"`);
        for (const target of targets) {
          if (target === '__fill__') spec.fill = figmaName(tokenPath);
          else if (target === '__textFill__') spec.textFill = figmaName(tokenPath);
          else if (target === '__fontSize__') spec.fontSize = px(resolveLiteral(tokenPath));
          else spec.bindings[target] = figmaName(tokenPath);
        }
      }
      variants.push(spec);
    }
  }

  const boolPropsData = boolProps.map((p) => ({
    property: p.bindings.figma.property,
    default: p.default === true,
  }));

  return `// GENERATED by scripts/generate-figma.ts — DO NOT EDIT.
// Source of truth: contracts/${contract.id.replace('ds.', '')}.contract.json (${contract.id} v${contract.version})
const SET_NAME = ${JSON.stringify(contract.name)};
const DESCRIPTION = ${JSON.stringify(`${contract.description} — governed by contract ${contract.id} v${contract.version}`)};
const LABEL = ${JSON.stringify(label)};
const LABEL_PROPERTY = ${JSON.stringify(textProp?.bindings.figma.property ?? 'Label')};
const BOOL_PROPS = ${JSON.stringify(boolPropsData)};
const VARIANTS = ${JSON.stringify(variants, null, 2)};
const COL_W = 220, ROW_H = 90, PAD = 40;

// Skip if the set already exists (idempotency guard).
const existing = figma.currentPage.findOne(
  (n) => n.type === 'COMPONENT_SET' && n.name === SET_NAME,
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

await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });

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
// Place this set below whatever the section already contains.
let startY = PAD;
for (const n of section.children) startY = Math.max(startY, n.y + n.height + PAD);

const comps = [];
for (const spec of VARIANTS) {
  const comp = figma.createComponent();
  comp.name = spec.name;
  comp.layoutMode = 'HORIZONTAL';
  comp.primaryAxisAlignItems = 'CENTER';
  comp.counterAxisAlignItems = 'CENTER';
  comp.layoutSizingHorizontal = 'HUG';
  comp.layoutSizingVertical = 'HUG';
  for (const [field, varName] of Object.entries(spec.bindings)) {
    comp.setBoundVariable(field, need(varName));
  }
  if (spec.fill) {
    comp.fills = [
      figma.variables.setBoundVariableForPaint(
        { type: 'SOLID', color: { r: 0, g: 0, b: 0 } },
        'color',
        need(spec.fill),
      ),
    ];
  }

  const text = figma.createText();
  text.fontName = { family: 'Inter', style: 'Medium' };
  text.fontSize = spec.fontSize;
  text.characters = LABEL;
  if (spec.textFill) {
    text.fills = [
      figma.variables.setBoundVariableForPaint(
        { type: 'SOLID', color: { r: 0, g: 0, b: 0 } },
        'color',
        need(spec.textFill),
      ),
    ];
  }
  comp.appendChild(text);

  // Properties must be added per-variant BEFORE combineAsVariants.
  const labelKey = comp.addComponentProperty(LABEL_PROPERTY, 'TEXT', LABEL);
  text.componentPropertyReferences = { characters: labelKey };
  for (const bp of BOOL_PROPS) {
    // Declared for API parity with the contract; visual treatment of
    // interaction states is a documented fidelity gap (see docs/05).
    comp.addComponentProperty(bp.property, 'BOOLEAN', bp.default);
  }
  comps.push(comp);
}

const set = figma.combineAsVariants(comps, section);
set.name = SET_NAME;
set.description = DESCRIPTION;

// Grid layout: rows × cols from the contract's variant matrix.
for (let i = 0; i < set.children.length; i++) {
  const spec = VARIANTS[i];
  set.children[i].x = PAD + spec.col * COL_W;
  set.children[i].y = PAD + spec.row * ROW_H;
}
let maxX = 0, maxY = 0;
for (const child of set.children) {
  maxX = Math.max(maxX, child.x + child.width);
  maxY = Math.max(maxY, child.y + child.height);
}
set.resizeWithoutConstraints(maxX + PAD, maxY + PAD);
set.x = PAD;
set.y = startY;

// Grow the section to fit.
let sMaxX = 0, sMaxY = 0;
for (const n of section.children) {
  sMaxX = Math.max(sMaxX, n.x + n.width);
  sMaxY = Math.max(sMaxY, n.y + n.height);
}
section.resizeWithoutConstraints(sMaxX + PAD, sMaxY + PAD);

return {
  createdNodeIds: [set.id],
  nodeId: set.id,
  key: set.key,
  sectionId: section.id,
  variants: set.children.length,
  properties: Object.keys(set.componentPropertyDefinitions),
};
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, '01-tokens.js'), buildTokensScript());

const contractFiles = readdirSync(path.join(ROOT, 'contracts'))
  .filter((f) => f.endsWith('.contract.json'))
  .sort();
let index = 2;
const emitted = ['01-tokens.js'];
for (const file of contractFiles) {
  const contract = ContractSchema.parse(read(path.join('contracts', file)));
  const outName = `${String(index).padStart(2, '0')}-${contract.name.toLowerCase()}.js`;
  writeFileSync(path.join(OUT, outName), buildComponentScript(contract));
  emitted.push(outName);
  index++;
}

console.log(`✔ Emitted figma-sync scripts: ${emitted.join(', ')}`);
