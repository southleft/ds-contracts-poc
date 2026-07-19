/**
 * COMPUTED-CAPTURE FLOOR — captured-truth replay (DESIGN spike phases 3–4).
 *
 * The vocabulary-independent completeness check: every capture is rebuilt as
 * a static DOM with the captured computed truth applied verbatim (every
 * longhand inline; pseudo-elements via generated rules) and compared against
 * the original — computed re-read equality here isolates "did the capture
 * floor capture everything the pixels need?" from "can today's contract
 * vocabulary carry it?".
 *
 * This module is PURE (no browser, no fs): the CLI (run.ts) and the eval
 * (`computed-floor-gate`) share one implementation of the truth-file model,
 * capture reconstruction, replay page, and re-read comparison — the eval
 * replays the COMMITTED Button capture offline from exactly this code.
 */
import {
  flatten,
  normalizeValue,
  REPLAY_APPLY_EXCLUDE,
  type Capture,
  type CapturedNode,
  type StyleMap,
} from './lib.js';

// ---------------------------------------------------------------------------
// Captured-truth file model (committed artifact; replay-sufficient)
// ---------------------------------------------------------------------------
export interface TruthAnatomyEntry {
  part: string;
  path: string;
  signature: string;
  tag: string;
  classes: string[];
  join: 'matched' | 'computed-only';
}

export interface TruthCaptureEntry {
  key: string; // `${combo}__${interaction}`
  focusVisibleMatched?: boolean;
  /** Per base-part style delta over the base capture (null = part missing —
   *  such captures carry fullRoot instead). */
  elements?: Array<{ part: string; delta: StyleMap | null }>;
  /** `${part}${pseudo}` → full pseudo style map (present only when the
   *  pseudo element renders). */
  pseudo?: Record<string, StyleMap>;
  /** Full tree for captures whose structure drifts from the base. */
  fullRoot?: CapturedNode;
}

export interface CapturedTruthFile {
  _provenance: Record<string, unknown> & { channels: string[] };
  anatomy: TruthAnatomyEntry[];
  base: { key: string; root: CapturedNode };
  controls: Record<string, CapturedNode>;
  captures: TruthCaptureEntry[];
}

/** Rebuild every capture's full computed tree from the truth file (base +
 *  per-part deltas, or fullRoot for structure-drifted captures). */
export function reconstructCaptures(truth: CapturedTruthFile): Capture[] {
  const out: Capture[] = [];
  const split = (key: string): { combo: string; interaction: string } => {
    const i = key.lastIndexOf('__');
    return { combo: key.slice(0, i), interaction: key.slice(i + 2) };
  };
  out.push({ ...split(truth.base.key), root: truth.base.root });
  const pathByPart = new Map(truth.anatomy.map((a) => [a.part, a.path] as const));
  for (const cap of truth.captures) {
    const { combo, interaction } = split(cap.key);
    if (cap.fullRoot) {
      out.push({ combo, interaction, ...(cap.focusVisibleMatched !== undefined ? { focusVisibleMatched: cap.focusVisibleMatched } : {}), root: cap.fullRoot });
      continue;
    }
    const root = structuredClone(truth.base.root);
    const flat = flatten(root);
    const byPath = new Map(flat.map((e) => [e.path, e.node]));
    for (const el of cap.elements ?? []) {
      const p = pathByPart.get(el.part);
      if (p === undefined || el.delta === null) continue;
      const node = byPath.get(p);
      if (!node) continue;
      for (const [k, v] of Object.entries(el.delta)) node.style[k] = v;
    }
    // pseudo maps are FULL (not deltas): captures carry their own pseudo set
    for (const node of byPath.values()) node.pseudo = {};
    for (const [key, style] of Object.entries(cap.pseudo ?? {})) {
      const m = /^(.*)(::before|::after)$/.exec(key);
      if (!m) continue;
      const p = pathByPart.get(m[1]) ?? m[1]; // part name, else raw path
      const node = byPath.get(p);
      if (node) node.pseudo[m[2] as '::before' | '::after'] = style;
    }
    out.push({ combo, interaction, ...(cap.focusVisibleMatched !== undefined ? { focusVisibleMatched: cap.focusVisibleMatched } : {}), root });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Replay page
// ---------------------------------------------------------------------------
export interface ReplaySpec {
  key: string;
  root: CapturedNode;
}

export function buildReplayHtml(
  specs: ReplaySpec[],
  stage: { width: number; height: number; padding: number },
  colorScheme: 'light' | 'dark' = 'light',
): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<style>
html { color-scheme: ${colorScheme}; } body { margin: 0; background: #ddd; }
.stage { display: flex; align-items: flex-start; width: ${stage.width}px; height: ${stage.height}px; padding: ${stage.padding}px; box-sizing: border-box; background: #fff; overflow: hidden; }
</style>
<style id="pseudo"></style>
</head><body>
<script>
const DATA = ${JSON.stringify(specs)};
const pseudoRules = [];
let uid = 0;
function build(node) {
  const el = document.createElement(node.tag);
  const cls = 'u' + (uid++);
  el.className = cls;
  const EXCLUDE = ${JSON.stringify([...REPLAY_APPLY_EXCLUDE])};
  for (const [p, v] of Object.entries(node.style)) { if (!EXCLUDE.includes(p)) el.style.setProperty(p, v); }
  for (const [pe, style] of Object.entries(node.pseudo)) {
    pseudoRules.push('.' + cls + pe + ' { ' + Object.entries(style).map(([p, v]) => p + ': ' + v.replaceAll(';', '\\\\3b') + ' !important;').join(' ') + ' }');
  }
  for (const child of node.nodes) {
    if (child.t === 'text') el.appendChild(document.createTextNode(child.v));
    else el.appendChild(build(child.el));
  }
  return el;
}
for (const spec of DATA) {
  const stage = document.createElement('div');
  stage.className = 'stage';
  stage.dataset.replay = spec.key;
  stage.appendChild(build(spec.root));
  document.body.appendChild(stage);
}
document.getElementById('pseudo').textContent = pseudoRules.join('\\n');
window.__READY = true;
</script>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Computed re-read equality
// ---------------------------------------------------------------------------
export interface RereadResult {
  cellsCompared: number;
  cellsMatched: number;
  pct: number;
  namedExclusions: string[];
  topMismatchedChannels: Array<[string, number]>;
}

/** Evaluate on the replay page: read every channel back per element and
 *  compare against the applied truth. `evaluate` is the playwright
 *  page.evaluate (string form — the tsx __name serialization trap). */
export async function rereadEquality(
  evaluateJs: (js: string) => Promise<unknown>,
  specs: ReplaySpec[],
  allProps: string[],
): Promise<RereadResult> {
  const reread = (await evaluateJs(`(() => {
    const KEYS = ${JSON.stringify(specs.map((s) => s.key))};
    const PROPS = ${JSON.stringify(allProps)};
    function readEl(el) {
      const cs = getComputedStyle(el);
      const style = {};
      for (const p of PROPS) style[p] = cs.getPropertyValue(p);
      return { style, children: [...el.children].map(readEl) };
    }
    return KEYS.map((key) => {
      const stage = document.querySelector('[data-replay="' + key + '"]');
      return { key, root: stage && stage.firstElementChild ? readEl(stage.firstElementChild) : null };
    });
  })()`)) as Array<{ key: string; root: { style: StyleMap; children: unknown[] } | null }>;

  let cellsCompared = 0;
  let cellsMatched = 0;
  const mismatchByProp = new Map<string, number>();
  interface R {
    style: StyleMap;
    children: unknown[];
  }
  const flatStyles = (n: R): StyleMap[] => [n.style, ...(n.children as R[]).flatMap(flatStyles)];
  for (let i = 0; i < specs.length; i++) {
    const want = flatten(specs[i].root).map((e) => e.node.style);
    const got = reread[i].root ? flatStyles(reread[i].root!) : [];
    for (let j = 0; j < Math.min(want.length, got.length); j++) {
      for (const p of allProps) {
        if (REPLAY_APPLY_EXCLUDE.has(p)) continue;
        cellsCompared++;
        if (normalizeValue(got[j][p]) === want[j][p]) cellsMatched++;
        else mismatchByProp.set(p, (mismatchByProp.get(p) ?? 0) + 1);
      }
    }
  }
  return {
    cellsCompared,
    cellsMatched,
    pct: cellsCompared === 0 ? 100 : (100 * cellsMatched) / cellsCompared,
    namedExclusions: [...REPLAY_APPLY_EXCLUDE],
    topMismatchedChannels: [...mismatchByProp.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15),
  };
}
