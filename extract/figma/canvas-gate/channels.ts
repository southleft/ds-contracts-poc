/**
 * CHANNEL TABLES — numeric verification, not pixels.
 *
 * For every canvas cell with a matching computed-floor capture, probe the
 * DRAWN node values straight off the compiled variant spec (bindings
 * resolved through the engine's own token trees; v14 literals as-is) and
 * quote them against the captured browser truth in
 * extract/computed/out/<component>/captured-truth.json — which IS the real
 * @shopify/polaris@13.9.5 package's computed truth (headless Chromium, the
 * file's _provenance block names browser + version).
 *
 * A row where the canvas value ≠ captured truth AND the CONTRACT itself
 * binds the channel to the captured value is flagged `EMITTER-DEFECT?` —
 * the pipeline had the number and the canvas dropped or misdrew it.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { Contract, Part } from '../../../scripts/contract-schema.js';
import type { NodeSpec } from '../../../core/emit-figma-script.js';
import type { TokenEntry } from '../../../core/tokens.js';
import { REPO, type Cell } from './compile.js';

// ---------------------------------------------------------------------------
// Captured truth
// ---------------------------------------------------------------------------
interface CapturedNodeJson {
  tag: string;
  classes: string[];
  nodes: Array<{ t: 'text'; v: string } | { t: 'el'; el: CapturedNodeJson }>;
  style: Record<string, string>;
}
interface TruthFile {
  _provenance: Record<string, unknown>;
  anatomy: Array<{ part: string; path: string }>;
  base: { key: string; root: CapturedNodeJson };
  captures: Array<{ key: string; elements: Array<{ part: string; delta: Record<string, string> }> }>;
}

export interface CaptureConfigComponent {
  name: string;
  axes: string[];
  stateProps?: Array<{ prop: string; state: string }>;
  /** Round-4 presence axes ('off'/'on' key segments). The canvas gate's
   *  cells never mount presence content → always 'off'. */
  presenceProps?: Array<{ prop: string }>;
}

export function loadCaptureConfig(): Map<string, CaptureConfigComponent> {
  const cfg = JSON.parse(
    readFileSync(path.join(REPO, 'extract', 'computed', 'configs', 'polaris.json'), 'utf8'),
  ) as { components: CaptureConfigComponent[] };
  return new Map(cfg.components.map((c) => [c.name, c]));
}

export function loadTruth(componentName: string): TruthFile | null {
  const p = path.join(REPO, 'extract', 'computed', 'out', componentName.toLowerCase(), 'captured-truth.json');
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8')) as TruthFile;
}

function nodeAtPath(root: CapturedNodeJson, pathStr: string): CapturedNodeJson | null {
  if (pathStr === '') return root;
  let n = root;
  for (const seg of pathStr.split('.')) {
    const els = n.nodes.filter((c): c is { t: 'el'; el: CapturedNodeJson } => c.t === 'el').map((c) => c.el);
    const next = els[Number(seg)];
    if (!next) return null;
    n = next;
  }
  return n;
}

/** Computed style of `part` for capture key `${combo}__${interaction}` —
 *  base styles overlaid with the capture's delta. */
function capturedStyle(truth: TruthFile, comboKey: string, interaction: string, part: string): Record<string, string> | null {
  const entry = truth.anatomy.find((a) => a.part === part);
  if (!entry) return null;
  const baseNode = nodeAtPath(truth.base.root, entry.path);
  if (!baseNode) return null;
  const fullKey = `${comboKey}__${interaction}`;
  if (fullKey === truth.base.key) return baseNode.style;
  const cap = truth.captures.find((c) => c.key === fullKey);
  if (!cap) return null;
  const delta = cap.elements.find((e) => e.part === part)?.delta ?? {};
  return { ...baseNode.style, ...delta };
}

/** lib.ts stateSegment, mirrored. */
const stateSegment = (prop: string, flag: boolean) => (flag ? prop : prop === 'disabled' ? 'enabled' : `no-${prop}`);

/** Capture axes VALID against the current committed contract: the capture
 *  config can run ahead of the contracts (concurrent regeneration), so an
 *  axis naming a prop the contract does not carry is dropped here and the
 *  derived key is validated against the truth file's own key roster. */
export function effectiveAxes(cfg: CaptureConfigComponent, contract: Contract): string[] {
  return cfg.axes.filter((a) =>
    contract.props.some((p) => p.name === a && typeof p.type === 'object' && 'enum' in p.type),
  );
}

export function captureKeyFor(cell: Cell, cfg: CaptureConfigComponent, contract: Contract): { comboKeys: string[]; interaction: string } | null {
  const axes = effectiveAxes(cfg, contract);
  // Held-fixed enum props (not capture axes) must sit at their contract
  // default for the captured truth to describe this cell. Defaultless held
  // props were captured UNSET — the canvas draws their first enum value;
  // accepted as the same nominal mount (named in the table header).
  for (const p of contract.props) {
    if (typeof p.type !== 'object' || !('enum' in p.type)) continue;
    if (axes.includes(p.name)) continue;
    if (p.default !== undefined && cell.subst[p.name] !== String(p.default)) return null;
  }
  const axisVals = axes.map((a) => cell.subst[a] ?? 'none');
  const presenceSegs = (cfg.presenceProps ?? []).map(() => 'off');
  const stateSegs = (cfg.stateProps ?? []).map((s) => stateSegment(s.prop, cell.state === s.state));
  const interaction =
    cell.state === 'hover' ? 'hover'
    : cell.state === 'focus-visible' ? 'focus-visible'
    : cell.state === 'active' ? 'active'
    : 'default';
  // A state the capture drives as a prop flag (disabled) keeps interaction
  // 'default'. Candidates cover both key vintages: with presence segments
  // (round-4 captures) and without (a truth file predating the config's
  // presence axes) — whichever exists in the truth wins.
  const withPresence = [...axisVals, ...presenceSegs, ...stateSegs].join('.');
  const withoutPresence = [...axisVals, ...stateSegs].join('.');
  return { comboKeys: [...new Set([withPresence, withoutPresence])], interaction };
}

// ---------------------------------------------------------------------------
// Canvas-drawn values off the compiled spec
// ---------------------------------------------------------------------------
export type FlatTokens = Map<string, TokenEntry>;

const varValue = (flat: FlatTokens, varName: string): string | null => {
  const e = flat.get(varName.split('/').join('.'));
  return e ? String(e.value) : null;
};

const pxNum = (v: string | null): number | null => {
  if (v === null) return null;
  const m = /^(-?\d+(?:\.\d+)?)(px)?$/.exec(v.trim());
  return m ? parseFloat(m[1]) : null;
};

/** Normalize any color spelling to `rgba(r, g, b, a)` (the computed form). */
export function normColor(v: string | null): string | null {
  if (v === null) return null;
  const s = v.trim();
  if (s === 'transparent' || s === 'none') return 'rgba(0, 0, 0, 0)';
  let m = /^#([0-9a-fA-F]{3,8})$/.exec(s);
  if (m) {
    let h = m[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = h.length === 8 ? Math.round((parseInt(h.slice(6, 8), 16) / 255) * 100) / 100 : 1;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  m = /^rgba?\(([^)]+)\)$/.exec(s);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    const a = parts.length > 3 ? Math.round(parts[3] * 100) / 100 : 1;
    return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${a})`;
  }
  return s;
}

interface CanvasProbe {
  /** channel → drawn value ('0px' when the renderer's default applies). */
  channels: Record<string, string>;
  isText: boolean;
}

export function probeCanvasNode(spec: NodeSpec, flat: FlatTokens): CanvasProbe {
  const b = spec.bindings ?? {};
  const li = spec.lits ?? {};
  const ch: Record<string, string> = {};
  const dim = (bindField: string, litVal: number | undefined, fallback = '0px'): string => {
    const bound = b[bindField];
    if (bound) {
      const v = varValue(flat, bound);
      return v ?? `UNRESOLVED(${bound})`;
    }
    if (litVal !== undefined) return `${litVal}px`;
    return fallback;
  };
  ch['padding-top'] = dim('paddingTop', li.paddingTop);
  ch['padding-right'] = dim('paddingRight', li.paddingRight);
  ch['padding-bottom'] = dim('paddingBottom', li.paddingBottom);
  ch['padding-left'] = dim('paddingLeft', li.paddingLeft);
  const rc = li.radiusCorners ?? {};
  ch['border-top-left-radius'] = dim('topLeftRadius', rc.tl ?? li.radius);
  ch['border-top-right-radius'] = dim('topRightRadius', rc.tr ?? li.radius);
  ch['border-bottom-left-radius'] = dim('bottomLeftRadius', rc.bl ?? li.radius);
  ch['border-bottom-right-radius'] = dim('bottomRightRadius', rc.br ?? li.radius);
  ch['gap'] = dim('itemSpacing', li.itemSpacing);
  // Stroke: a spec with `stroke` but no strokeWeight binding/literal renders
  // the RENDERER DEFAULT 1px border (canvas-preview.ts nodeStyle) — quoted
  // as such so a phantom ring shows up numerically.
  if (spec.stroke || b['strokeWeight'] || li.strokeWeight !== undefined) {
    ch['border-width'] = b['strokeWeight']
      ? (varValue(flat, b['strokeWeight']) ?? `UNRESOLVED(${b['strokeWeight']})`)
      : li.strokeWeight !== undefined
        ? `${li.strokeWeight}px`
        : '1px';
  } else {
    ch['border-width'] = '0px';
  }
  if (spec.fill) ch['background-color'] = normColor(varValue(flat, spec.fill)) ?? `UNRESOLVED(${spec.fill})`;
  else if (li.fillClear) ch['background-color'] = 'rgba(0, 0, 0, 0)';
  else if (li.fillColor) {
    const c = li.fillColor;
    ch['background-color'] = `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${c.a ?? 1})`;
  } else ch['background-color'] = 'rgba(0, 0, 0, 0)';
  const isText = spec.type === 'text';
  if (isText) {
    ch['font-size'] = `${spec.fontSize ?? 14}px`;
    ch['line-height'] = typeof spec.lineHeight === 'number' ? `${spec.lineHeight}px` : '(ratio 1.2)';
    if (spec.textFill) ch['color'] = normColor(varValue(flat, spec.textFill)) ?? `UNRESOLVED(${spec.textFill})`;
  }
  return { channels: ch, isText };
}

// ---------------------------------------------------------------------------
// Contract-side binding lookup (the EMITTER-DEFECT? evidence)
// ---------------------------------------------------------------------------
const CHANNEL_TOKEN_KEYS: Record<string, string[]> = {
  'padding-top': ['padding-top', 'padding-block', 'padding'],
  'padding-bottom': ['padding-bottom', 'padding-block', 'padding'],
  'padding-left': ['padding-left', 'padding-inline', 'padding'],
  'padding-right': ['padding-right', 'padding-inline', 'padding'],
  'border-top-left-radius': ['border-top-left-radius', 'border-radius'],
  'border-top-right-radius': ['border-top-right-radius', 'border-radius'],
  'border-bottom-left-radius': ['border-bottom-left-radius', 'border-radius'],
  'border-bottom-right-radius': ['border-bottom-right-radius', 'border-radius'],
  'background-color': ['background-color', 'background'],
  'border-width': ['border-width', 'border-top-width'],
  gap: ['gap'],
  'font-size': ['font-size'],
  'line-height': ['line-height'],
  color: ['color'],
};

function partByName(contract: Contract, name: string): Part | null {
  if (name === 'root' || name === contract.name || /=/.test(name)) return contract.anatomy.root as Part;
  const walk = (part: Part): Part | null => {
    const parts = (part as { parts?: Record<string, Part> }).parts ?? {};
    for (const [n, child] of Object.entries(parts)) {
      if (n === name) return child;
      const hit = walk(child);
      if (hit) return hit;
    }
    return null;
  };
  return walk(contract.anatomy.root as Part);
}

/** The contract's own resolved value for a channel on a part (tokens +
 *  tokensByProp for this cell's subst + literals), or null when unbound. */
export function contractValue(
  contract: Contract,
  partName: string,
  channel: string,
  subst: Record<string, string>,
  flat: FlatTokens,
): string | null {
  const part = partByName(contract, partName);
  if (!part) return null;
  const p = part as unknown as {
    tokens?: Record<string, string>;
    literals?: Record<string, string>;
    tokensByProp?: Array<{ prop: string; map: Record<string, Record<string, string>> }>;
    literalsByProp?: Array<{ prop: string; map: Record<string, Record<string, string>> }>;
  };
  const tokens: Record<string, string> = { ...(p.tokens ?? {}) };
  for (const e of p.tokensByProp ?? []) {
    const m = e.map[subst[e.prop]];
    if (m) Object.assign(tokens, m);
  }
  const literals: Record<string, string> = { ...(p.literals ?? {}) };
  for (const e of p.literalsByProp ?? []) {
    const m = e.map[subst[e.prop]];
    if (m) Object.assign(literals, m);
  }
  for (const key of CHANNEL_TOKEN_KEYS[channel] ?? [channel]) {
    const ref = tokens[key];
    if (ref) {
      let tokenPath = ref.slice(1, -1);
      for (const [prop, value] of Object.entries(subst)) tokenPath = tokenPath.replaceAll(`{${prop}}`, value);
      const v = varValue(flat, tokenPath.split('.').join('/'));
      if (v !== null) return v;
      return `UNRESOLVED{${tokenPath}}`;
    }
    if (literals[key] !== undefined) return literals[key];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Table assembly
// ---------------------------------------------------------------------------
export interface ChannelRow {
  part: string;
  channel: string;
  cells: string[];
  canvas: string;
  captured: string;
  delta: string;
  flag: string;
}

const valueDelta = (channel: string, canvas: string, captured: string): { same: boolean; delta: string } => {
  if (channel === 'background-color' || channel === 'color') {
    const a = normColor(canvas);
    const b = normColor(captured);
    return a === b ? { same: true, delta: 'match' } : { same: false, delta: 'DIFFERS' };
  }
  const a = pxNum(canvas);
  const b = pxNum(captured === 'normal' ? '0px' : captured);
  if (a !== null && b !== null) {
    const d = Math.round((a - b) * 100) / 100;
    return { same: d === 0, delta: d === 0 ? '0' : `${d > 0 ? '+' : ''}${d}px` };
  }
  return canvas === captured ? { same: true, delta: 'match' } : { same: false, delta: 'DIFFERS' };
};

/** Collect spec nodes by name (root gets 'root'). */
export function specNodesByName(spec: NodeSpec): Array<{ name: string; node: NodeSpec }> {
  const out: Array<{ name: string; node: NodeSpec }> = [{ name: 'root', node: spec }];
  const walk = (n: NodeSpec) => {
    for (const c of n.children ?? []) {
      out.push({ name: c.name, node: c });
      walk(c);
    }
  };
  walk(spec);
  return out;
}

export function buildChannelRows(
  contract: Contract,
  cells: Cell[],
  truth: TruthFile,
  cfg: CaptureConfigComponent,
  flat: FlatTokens,
  partMap: Record<string, string>,
): { rows: ChannelRow[]; matchedCells: number; skippedCells: number } {
  // (part, channel) → (canvas|captured) → cell names
  const agg = new Map<string, Map<string, { cells: string[]; canvas: string; captured: string; flag: string }>>();
  let matched = 0;
  let skipped = 0;
  for (const cell of cells) {
    const keyed = captureKeyFor(cell, cfg, contract);
    if (!keyed) {
      skipped++;
      continue;
    }
    const nodes = specNodesByName(cell.spec);
    let cellMatched = false;
    for (const { name, node } of nodes) {
      if (node.type === 'svg' || node.type === 'instance' || node.type === 'slot') continue;
      const capturePart = partMap[name] ?? name;
      let style: Record<string, string> | null = null;
      for (const comboKey of keyed.comboKeys) {
        style = capturedStyle(truth, comboKey, keyed.interaction, capturePart);
        if (style) break;
      }
      if (!style) continue;
      cellMatched = true;
      const probe = probeCanvasNode(node, flat);
      for (const [channel, canvasVal] of Object.entries(probe.channels)) {
        const capturedKey = channel === 'gap' ? 'column-gap' : channel === 'border-width' ? 'border-top-width' : channel;
        const capturedVal = style[capturedKey] ?? '(not captured)';
        const { same } = valueDelta(channel, canvasVal, capturedVal);
        let flag = '';
        if (!same) {
          const cv = contractValue(contract, name, channel, cell.subst, flat);
          if (cv !== null) {
            const contractMatchesCaptured = valueDelta(channel, cv, capturedVal).same;
            flag = contractMatchesCaptured
              ? `EMITTER-DEFECT? (contract binds ${cv})`
              : `contract binds ${cv}`;
          }
        }
        const rowKey = `${name} ${channel}`;
        const valKey = `${canvasVal} ${capturedVal}`;
        const byVal = agg.get(rowKey) ?? new Map();
        agg.set(rowKey, byVal);
        const e = byVal.get(valKey) ?? { cells: [], canvas: canvasVal, captured: capturedVal, flag };
        e.cells.push(cell.name);
        byVal.set(valKey, e);
      }
    }
    if (cellMatched) matched++;
    else skipped++;
  }
  const rows: ChannelRow[] = [];
  for (const [rowKey, byVal] of agg) {
    const [part, channel] = rowKey.split(' ');
    for (const e of byVal.values()) {
      const { delta } = valueDelta(channel, e.canvas, e.captured);
      rows.push({ part, channel, cells: e.cells, canvas: e.canvas, captured: e.captured, delta, flag: e.flag });
    }
  }
  return { rows, matchedCells: matched, skippedCells: skipped };
}

export function channelsMarkdown(
  component: string,
  contract: Contract,
  rows: ChannelRow[],
  matchedCells: number,
  skippedCells: number,
  truthProvenance: Record<string, unknown>,
  notes: string[],
): string {
  const cellsCol = (cells: string[]): string => {
    const uniq = [...new Set(cells)];
    if (uniq.length === 1) return `\`${uniq[0]}\``;
    if (uniq.length <= 3) return uniq.map((c) => `\`${c}\``).join(', ');
    return `${uniq.length} cells (e.g. \`${uniq[0]}\`)`;
  };
  const lines = [
    `# ${component} — channel table (canvas-drawn vs captured browser truth)`,
    '',
    `Contract: \`${contract.id}\` v${contract.version}. Canvas-drawn values are read directly off the`,
    'compiled variant node tree (`createFigmaEngine().compileComponentData`, bindings resolved through',
    'the engine token trees, v14 literals as-is). Captured-truth values come from',
    `\`extract/computed/out/${component.toLowerCase()}/captured-truth.json\` — the computed styles of the REAL`,
    `\`${String(truthProvenance['library'] ?? '@shopify/polaris')}\` package in \`${String(truthProvenance['browser'] ?? 'headless Chromium')}\`;`,
    'that file is simultaneously the real-package computed truth, so the second column serves as both',
    'reference columns the gate requires.',
    '',
    `Cells with a capture match: ${matchedCells}; cells with no captured combo (axis value or state the`,
    `computed sweep never mounted): ${skippedCells}. A drawn value of \`0px\` means the renderer's default`,
    'applies (no binding, no literal). `gap` compares against computed `column-gap`; captured `normal` = 0px.',
    '',
    ...(notes.length > 0 ? ['Notes:', ...notes.map((n) => `- ${n}`), ''] : []),
    '| part | channel | cell(s) | canvas-drawn | captured-truth (real Polaris computed) | delta | flag |',
    '|---|---|---|---|---|---|---|',
  ];
  const order = ['root'];
  rows.sort(
    (a, b) =>
      (order.indexOf(a.part) === -1 ? 1 : 0) - (order.indexOf(b.part) === -1 ? 1 : 0) ||
      a.part.localeCompare(b.part) ||
      a.channel.localeCompare(b.channel) ||
      a.canvas.localeCompare(b.canvas),
  );
  for (const r of rows) {
    lines.push(
      `| ${r.part} | ${r.channel} | ${cellsCol(r.cells)} | \`${r.canvas}\` | \`${r.captured}\` | ${r.delta} | ${r.flag} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}
