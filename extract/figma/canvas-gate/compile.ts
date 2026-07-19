/**
 * CANVAS PIXEL GATE — world loading + cell derivation.
 *
 * Loads the SAME inputs examples/polaris/generate.ts hands the canvas engine
 * (committed contracts, the wrapped Polaris token tree pxified + alias-
 * resolved for the engine, the minted imported.* layer, committed icon
 * assets), builds the engine once, and re-derives the PER-CELL prop
 * substitution maps by running the exact enumeration compileComponentData
 * runs (axis order, orderedValues, cartesian axis-0-slowest, state-preview
 * loop) — asserted cell-by-cell against the compiled variant names so the
 * derivation can never drift from the engine.
 *
 * The rem→px + alias-resolution helpers are vendored VERBATIM from
 * examples/polaris/generate.ts (that file executes on import, so its
 * internals cannot be imported); CANVAS_PROJECTIONS + projectForCanvas are
 * vendored from the same file for the Text / TextField channel tables.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import {
  ContractSchema,
  statePreviewLabel,
  statePreviewSubstProps,
  STATE_PREVIEW_PROPERTY,
  type Contract,
} from '../../../scripts/contract-schema.js';
import {
  createFigmaEngine,
  type ComponentData,
  type NodeSpec,
} from '../../../core/emit-figma-script.js';
import { flattenTokens, aliasTarget, type TokenEntry } from '../../../core/tokens.js';
import { mintedTokenCss } from '../../../core/mint-tokens.js';

export const REPO = path.resolve(new URL('.', import.meta.url).pathname, '../../..');
export const EXAMPLE = path.join(REPO, 'examples', 'polaris');

const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;

// --- vendored from examples/polaris/generate.ts (remToPx / resolveAliases) ---
const remToPx = (node: unknown): unknown => {
  if (!node || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k === '$value' && typeof v === 'string' && /^-?\d*\.?\d+rem$/.test(v.trim())) {
      out[k] = `${parseFloat(v) * 16}px`;
    } else out[k] = remToPx(v);
  }
  return out;
};

const resolveAliases = (tree: Record<string, unknown>): Record<string, unknown> => {
  const flat = flattenTokens(tree);
  const resolve = (v: unknown, depth = 0): unknown => {
    const target = aliasTarget(v);
    if (!target || depth > 10) return v;
    return resolve(flat.get(target)?.value, depth + 1);
  };
  const walk = (node: unknown): unknown => {
    if (!node || typeof node !== 'object') return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      out[k] = k === '$value' ? resolve(v) : walk(v);
    }
    return out;
  };
  return walk(tree) as Record<string, unknown>;
};

// --- vendored from examples/polaris/generate.ts (canvas projections) ---
interface CanvasProjection {
  keep: Record<string, string[] | '*'>;
  note: string;
}
const CANVAS_PROJECTIONS: Record<string, CanvasProjection> = {
  'polaris.text': {
    keep: {
      variant: '*',
      tone: ['base', 'success', 'critical', 'caution', 'subdued'],
      fontWeight: ['regular'],
      alignment: ['start'],
      as: ['p'],
    },
    note: 'canvas projection (see generate.ts CANVAS_PROJECTIONS)',
  },
  'polaris.text-field': {
    keep: {
      type: ['text'],
      inputMode: ['text'],
      align: ['left'],
      variant: '*',
      size: '*',
    },
    note: 'canvas projection (see generate.ts CANVAS_PROJECTIONS)',
  },
};

export function projectForCanvas(contract: Contract): Contract {
  const projection = CANVAS_PROJECTIONS[contract.id];
  if (!projection) return contract;
  const clone = structuredClone(contract);
  const keptByProp = new Map<string, Set<string>>();
  for (const p of clone.props) {
    if (typeof p.type !== 'object' || !('enum' in p.type)) continue;
    const keep = projection.keep[p.name];
    if (!keep || keep === '*') continue;
    const kept = [...keep];
    if (p.default !== undefined && !kept.includes(String(p.default))) kept.unshift(String(p.default));
    p.type.enum = p.type.enum.filter((v: string) => kept.includes(v));
    if (p.type.enum.length === 0) throw new Error(`${contract.id}: canvas projection empties enum "${p.name}"`);
    keptByProp.set(p.name, new Set(p.type.enum));
    if (p.bindings.figma.values) {
      p.bindings.figma.values = Object.fromEntries(
        Object.entries(p.bindings.figma.values).filter(([k]) => keptByProp.get(p.name)!.has(k)),
      );
    }
  }
  const pruneMaps = (part: Record<string, unknown>) => {
    for (const field of ['tokensByProp', 'literalsByProp', 'layoutByProp'] as const) {
      const entries = part[field];
      if (!Array.isArray(entries)) continue;
      for (const e of entries as Array<{ prop: string; map: Record<string, unknown> }>) {
        const kept = keptByProp.get(e.prop);
        if (!kept) continue;
        e.map = Object.fromEntries(Object.entries(e.map).filter(([k]) => kept.has(k)));
      }
    }
    for (const child of Object.values((part.parts as Record<string, Record<string, unknown>>) ?? {})) pruneMaps(child);
  };
  pruneMaps(clone.anatomy.root as unknown as Record<string, unknown>);
  ContractSchema.parse(clone);
  return clone;
}

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------
export interface World {
  contracts: Contract[];
  byId: Map<string, Contract>;
  byName: Map<string, Contract>;
  engine: ReturnType<typeof createFigmaEngine>;
  /** pxified + alias-resolved wrapped Polaris tree (the engine's primitives). */
  engineTree: Record<string, unknown>;
  mintedTree: Record<string, unknown>;
  /** flat token path → entry, engine primitives + minted layer merged. */
  flat: Map<string, TokenEntry>;
  icons: Map<string, string>;
  /** :root custom-property stylesheet resolving every var(--…) the canvas
   *  renderer emits (engine px values + minted literals). */
  tokenCss: string;
}

export function loadWorld(): World {
  const tokensTree = readJson(path.join(EXAMPLE, 'tokens', 'polaris-light.dtcg.json'));
  const mintedPath = path.join(EXAMPLE, 'tokens', 'polaris-minted.dtcg.json');
  const mintedTree = existsSync(mintedPath) ? readJson(mintedPath) : {};
  const hasMinted = Object.keys(mintedTree).length > 0;
  const engineTree = resolveAliases(remToPx(tokensTree) as Record<string, unknown>);
  const trees = {
    primitives: engineTree,
    semantic: hasMinted ? mintedTree : {},
    light: {},
    dark: {},
    brands: { default: {} },
  };
  const icons = new Map<string, string>(
    readdirSync(path.join(EXAMPLE, 'assets', 'icons'))
      .filter((f) => f.endsWith('.svg'))
      .sort()
      .map((f) => [f.replace(/\.svg$/, ''), readFileSync(path.join(EXAMPLE, 'assets', 'icons', f), 'utf8').trim()]),
  );
  const contracts = readdirSync(path.join(EXAMPLE, 'contracts'))
    .filter((f) => f.endsWith('.contract.json'))
    .sort()
    .map((f) => ContractSchema.parse(readJson(path.join(EXAMPLE, 'contracts', f))));
  const byId = new Map(contracts.map((c) => [c.id, c]));
  const byName = new Map(contracts.map((c) => [c.name, c]));
  const engine = createFigmaEngine({ tokens: trees, icons });

  const flat = new Map<string, TokenEntry>();
  for (const [p, e] of flattenTokens(engineTree)) flat.set(p, e);
  for (const [p, e] of flattenTokens(mintedTree)) flat.set(p, e);

  const lines = [':root {'];
  for (const [p, entry] of flattenTokens(engineTree)) {
    lines.push(`  --${p.split('.').join('-')}: ${String(entry.value)};`);
  }
  lines.push('}');
  const tokenCss = lines.join('\n') + '\n' + (hasMinted ? mintedTokenCss(mintedTree) : '');

  return { contracts, byId, byName, engine, engineTree, mintedTree, flat, icons, tokenCss };
}

// ---------------------------------------------------------------------------
// Cell derivation — the engine's own enumeration, re-run and asserted
// ---------------------------------------------------------------------------
export interface Cell {
  /** The compiled variant name — the scorecard's cell id. */
  name: string;
  kind: 'base' | 'state';
  /** Contract state name for state-preview cells ('hover' | 'disabled' | …). */
  state?: string;
  /** Contract prop name → enum value for every enum axis of this cell. */
  subst: Record<string, string>;
  spec: NodeSpec;
}

const isEnum = (p: Contract['props'][number]): p is Contract['props'][number] & { type: { enum: string[] } } =>
  typeof p.type === 'object' && 'enum' in p.type;

export function deriveCells(contract: Contract, data: ComponentData): Cell[] {
  const enums = contract.props.filter(isEnum);
  const orderedValues = (p: { type: { enum: string[] }; default?: unknown }) => {
    const values = [...p.type.enum];
    const i = p.default !== undefined ? values.indexOf(String(p.default)) : -1;
    if (i > 0) {
      values.splice(i, 1);
      values.unshift(String(p.default));
    }
    return values;
  };
  const axes = enums.map((p) => ({ prop: p, values: orderedValues(p) }));
  let combos: number[][] = [[]];
  for (const axis of axes) {
    const next: number[][] = [];
    for (const combo of combos) {
      for (let i = 0; i < axis.values.length; i++) next.push([...combo, i]);
    }
    combos = next;
  }
  const cells: Cell[] = [];
  combos.forEach((combo, i) => {
    const subst: Record<string, string> = {};
    const nameParts: string[] = [];
    for (let a = 0; a < axes.length; a++) {
      const { prop, values } = axes[a];
      const value = values[combo[a]];
      subst[prop.name] = value;
      nameParts.push(`${prop.bindings.figma.property}=${prop.bindings.figma.values?.[value] ?? value}`);
    }
    const name = nameParts.join(', ') || contract.name;
    const v = data.variants[i];
    if (!v || v.name !== name) {
      throw new Error(`${contract.id}: cell derivation drift at base variant ${i}: derived "${name}" vs compiled "${v?.name}"`);
    }
    cells.push({ name, kind: 'base', subst, spec: v.spec });
  });

  const stateVariants = data.stateVariants ?? [];
  if (stateVariants.length > 0) {
    const substProps = statePreviewSubstProps(contract);
    const primaryIdx = Math.max(0, axes.findIndex((a) => substProps.includes(a.prop.name)));
    const primary = axes[primaryIdx] as (typeof axes)[number] | undefined;
    const primaryValues = primary ? primary.values : [null];
    let si2 = 0;
    for (const stateName of contract.states) {
      for (let pi = 0; pi < primaryValues.length; pi++) {
        const subst: Record<string, string> = {};
        const nameParts: string[] = [];
        for (let a = 0; a < axes.length; a++) {
          const { prop, values } = axes[a];
          const value = a === primaryIdx ? values[pi]! : values[0];
          subst[prop.name] = value;
          nameParts.push(`${prop.bindings.figma.property}=${prop.bindings.figma.values?.[value] ?? value}`);
        }
        nameParts.push(`${STATE_PREVIEW_PROPERTY}=${statePreviewLabel(stateName)}`);
        const name = nameParts.join(', ');
        const v = stateVariants[si2];
        if (!v || v.name !== name) {
          throw new Error(`${contract.id}: cell derivation drift at state variant ${si2}: derived "${name}" vs compiled "${v?.name}"`);
        }
        cells.push({ name, kind: 'state', state: stateName, subst, spec: v.spec });
        si2++;
      }
    }
  }
  return cells;
}
