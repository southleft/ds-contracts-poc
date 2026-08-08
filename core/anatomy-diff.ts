/**
 * Contract anatomy → channel lines (Wave 7).
 *
 * Flattens part-tree + layout + token bindings already present on a contract
 * into `part|channel|value` lines so core/channel-diff can pair them. This is
 * the contract↔contract half of anatomy-level parity (canvas half lives in
 * parity/variant-drift.ts + the v6 fingerprint).
 */
import type { Contract } from '../scripts/contract-schema.js';
import { diffChannelLines, type ChannelChange } from './channel-diff.js';

export type AnatomyPartNode = {
  layout?: Record<string, unknown>;
  /** A2 grid (G2) — explicit cell placement on children of grid parts. */
  placement?: Record<string, unknown>;
  tokens?: Record<string, unknown>;
  declared?: Record<string, unknown>;
  parts?: Record<string, AnatomyPartNode>;
  states?: Record<string, Record<string, unknown>>;
  element?: string;
  content?: unknown;
  component?: unknown;
  [k: string]: unknown;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function flattenBindings(
  partPath: string,
  bag: Record<string, unknown> | undefined,
  kind: string,
  out: string[],
): void {
  if (!bag) return;
  for (const [channel, raw] of Object.entries(bag)) {
    if (raw === undefined || raw === null) continue;
    if (isPlainObject(raw) && !('$value' in raw) && !('ref' in raw)) {
      // nested axis map — emit each leaf
      for (const [axis, leaf] of Object.entries(raw)) {
        const value =
          typeof leaf === 'string' || typeof leaf === 'number' || typeof leaf === 'boolean'
            ? String(leaf)
            : JSON.stringify(leaf);
        out.push(`${partPath}|${kind}.${channel}.${axis}|${value}`);
      }
      continue;
    }
    const value =
      typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean'
        ? String(raw)
        : JSON.stringify(raw);
    out.push(`${partPath}|${kind}.${channel}|${value}`);
  }
}

function walkPart(partPath: string, node: AnatomyPartNode, out: string[]): void {
  if (node.element !== undefined) out.push(`${partPath}|element|${String(node.element)}`);
  if (node.content !== undefined) {
    out.push(
      `${partPath}|content|${
        typeof node.content === 'string' ? node.content : JSON.stringify(node.content)
      }`,
    );
  }
  if (node.component !== undefined) {
    out.push(`${partPath}|component|${JSON.stringify(node.component)}`);
  }
  flattenBindings(partPath, node.layout as Record<string, unknown> | undefined, 'layout', out);
  // A2 grid fact classes (proposal G6 differ row). The layout flatten above
  // already yields the parent-side buckets: `layout.rows` / `layout.columns`
  // (one ORDERED, TYPED line each — a track edit is ONE fact, a reorder a
  // different fact), `layout.gap.row` / `layout.gap.column` (two facts),
  // `layout.areas.<name>` (name→rect map, one line per name), `layout.flow`.
  // Placement is the child-side family, split per the pinned classes:
  //   grid-placement — anchor+span, ONE fact per part
  //   grid-align     — per-part alignment, its own fact
  if (isPlainObject(node.placement)) {
    const p = node.placement;
    const cell: Record<string, unknown> = { row: p.row, column: p.column };
    if (p.rowSpan !== undefined) cell.rowSpan = p.rowSpan;
    if (p.columnSpan !== undefined) cell.columnSpan = p.columnSpan;
    out.push(`${partPath}|placement.cell|${JSON.stringify(cell)}`);
    if (p.alignX !== undefined || p.alignY !== undefined) {
      out.push(
        `${partPath}|placement.align|${String(p.alignX ?? 'auto')}/${String(p.alignY ?? 'auto')}`,
      );
    }
  }
  flattenBindings(partPath, node.tokens as Record<string, unknown> | undefined, 'tokens', out);
  flattenBindings(partPath, node.declared as Record<string, unknown> | undefined, 'declared', out);
  if (node.states) {
    for (const [state, bag] of Object.entries(node.states)) {
      if (!isPlainObject(bag)) continue;
      flattenBindings(partPath, bag, `state.${state}`, out);
    }
  }
  if (node.parts) {
    for (const [name, child] of Object.entries(node.parts)) {
      if (!isPlainObject(child)) continue;
      walkPart(`${partPath}/${name}`, child as AnatomyPartNode, out);
    }
  }
}

/** Snapshot lines for one contract's anatomy (stable-sorted). */
export function anatomyChannelLines(contract: Contract): string[] {
  const anatomy = (contract as { anatomy?: AnatomyPartNode }).anatomy;
  if (!anatomy || !isPlainObject(anatomy)) return [];
  const out: string[] = [];
  // Contract anatomy is usually `{ root: { … } }` or `{ root: {}, parts: {} }`.
  if (anatomy.parts || anatomy.layout || anatomy.tokens || anatomy.element) {
    walkPart('root', anatomy, out);
  } else {
    for (const [name, child] of Object.entries(anatomy)) {
      if (!isPlainObject(child)) continue;
      walkPart(name === 'root' ? 'root' : `root/${name}`, child as AnatomyPartNode, out);
    }
  }
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** A2 grid — the P10 STRUCTURAL rule (proposal G6 differ row): a
 *  `layout.display` change into or out of "grid" is never an ordinary
 *  channel edit. The canvas physically DESTROYS tracks on a layout.mode
 *  switch (probe P10: GRID→HORIZONTAL→GRID lost a declared track), so every
 *  track/gap/area/placement fact under the switched part is invalidated —
 *  the differ surfaces that as ONE named structural finding on top of the
 *  per-fact removals, never absorbs it. */
export function gridModeSwitchFindings(changes: ChannelChange[]): ChannelChange[] {
  const out: ChannelChange[] = [];
  for (const c of changes) {
    if (c.channel !== 'layout.display') continue;
    const wasGrid = c.was === 'grid';
    const nowGrid = c.now === 'grid';
    if (wasGrid === nowGrid) continue;
    out.push({
      what: c.what,
      channel: 'layout.mode-switch',
      part: c.part,
      was: wasGrid
        ? 'grid (tracks, gaps, areas, placements)'
        : String(c.was),
      now:
        `STRUCTURAL LOSS — layout.mode changed ${wasGrid ? `grid → ${c.now}` : `${c.was} → grid`}: ` +
        'the canvas physically destroys tracks on a mode switch (P10); every grid fact under this part is invalidated, not individually edited',
    });
  }
  return out;
}

/** Diff two contracts' anatomies with the shared channel vocabulary. A
 *  grid↔flex display change additionally yields the P10 structural finding
 *  (see gridModeSwitchFindings) — appended, so per-fact removals stay
 *  visible AND the loss is named as one structural event. */
export function diffContractAnatomy(
  before: Contract,
  after: Contract,
): ChannelChange[] {
  const changes = diffChannelLines(anatomyChannelLines(before), anatomyChannelLines(after));
  return [...changes, ...gridModeSwitchFindings(changes)];
}

/** Token refs (`{a.b.c}`) → CSS custom-property names (`a-b-c`). */
export function tokenRefToCssVar(ref: string): string | null {
  const m = ref.match(/^\{([a-zA-Z0-9][a-zA-Z0-9._-]*)\}$/);
  if (!m) return null;
  const path = m[1]!;
  // Axis placeholders like `{variant}` / `{size}` are not tokens.
  if (!path.includes('.')) return null;
  return path.split('.').join('-');
}

/** Collect CSS custom-property names implied by contract anatomy bindings. */
export function expectedCssVarsFromAnatomy(contract: Contract): string[] {
  const vars = new Set<string>();
  for (const line of anatomyChannelLines(contract)) {
    const value = line.slice(line.lastIndexOf('|') + 1);
    const css = tokenRefToCssVar(value);
    if (css) vars.add(css);
  }
  return [...vars].sort();
}
