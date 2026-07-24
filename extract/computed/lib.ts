/**
 * COMPUTED-CAPTURE FLOOR — shared primitives.
 *
 * Productionized from extract/computed-spike/run.ts (the working prototype;
 * DESIGN.md in that directory is the design this module executes). Everything
 * here is pure (no browser, no fs) so the eval suite and the CLI share one
 * implementation of:
 *
 *   · the captured-truth data model + normalization (§3.2)
 *   · fusability exclusions: geometry / logical aliases / -webkit (§3.3)
 *   · DOM→anatomy: signatures, part naming, flatten/align (§4)
 *   · prop-space enumeration policy incl. the ≤512 cartesian / per-axis+
 *     pairwise switch and the ≥3-axis pairwise-inconsistency certificate
 *     (§1.4)
 *   · value kinds for minting and the contract-channel → computed-longhand
 *     map (the verify.ts channel map, shared verbatim)
 */
import type { MintObservation } from '../../core/mint-tokens.js';

// ---------------------------------------------------------------------------
// Captured data model + normalization (§3.2)
// ---------------------------------------------------------------------------
export type StyleMap = Record<string, string>;

export interface CapturedNode {
  tag: string;
  classes: string[];
  /** child NODES in document order: text runs and elements interleaved. */
  nodes: Array<{ t: 'text'; v: string } | { t: 'el'; el: CapturedNode }>;
  style: StyleMap;
  pseudo: Partial<Record<'::before' | '::after', StyleMap>>;
  /** DEPTH BUILD (Stage A/B, portal-aware capture only): the element's ARIA
   *  `role` / `aria-modal` attribute, read only on the portal-capture path so
   *  the root-descent (anatomy.realRootsOf) and multi-root naming can treat a
   *  `role="dialog"` node as a real root. The census sweep never sets these
   *  (its read carries no attributes), so they are undefined on every one of
   *  the committed 12 components — normalizeNode omits undefined keys, keeping
   *  the census captures byte-identical. */
  role?: string | null;
  ariaModal?: string | null;
  /** EMOTION/CSS-VARS READER (MUI round): channel → candidate [customPropertyName,
   *  resolvedRawValue] pairs from ALL matching rules (specificity is not
   *  document order — verification against the computed value picks) for declarations in matching CSSOM rules that
   *  reference `var(--<varPrefix>…)`. SOURCE evidence — the library's own
   *  emitted CSS names the token it binds. Captured only when the config
   *  declares `library.varPrefix`; undefined (and omitted by normalizeNode)
   *  everywhere else, keeping committed captures byte-identical. */
  vrefs?: Record<string, Array<[string, string]>>;
}

export interface Capture {
  combo: string;
  interaction: string;
  focusVisibleMatched?: boolean;
  root: CapturedNode;
}

/** Canonical rgba: Chromium serializes opaque colors rgb(r, g, b) — normalize
 *  every embedded occurrence to rgba(r, g, b, 1). Deterministic, lossless. */
export const normalizeValue = (v: string): string =>
  v.replace(/\brgb\((\d+), (\d+), (\d+)\)/g, 'rgba($1, $2, $3, 1)');

export function normalizeNode(n: CapturedNode): CapturedNode {
  const norm = (s: StyleMap): StyleMap => {
    const out: StyleMap = {};
    for (const k of Object.keys(s).sort()) out[k] = normalizeValue(s[k]);
    return out;
  };
  return {
    tag: n.tag,
    classes: n.classes,
    nodes: n.nodes.map((c) => (c.t === 'text' ? c : { t: 'el' as const, el: normalizeNode(c.el) })),
    style: norm(n.style),
    pseudo: Object.fromEntries(
      Object.entries(n.pseudo).map(([k, v]) => [k, norm(v as StyleMap)]),
    ) as CapturedNode['pseudo'],
    // Portal-capture-only attributes: preserved when present, OMITTED when
    // undefined (the census case) so committed captures stay byte-identical.
    ...(n.role !== undefined ? { role: n.role } : {}),
    ...(n.ariaModal !== undefined ? { ariaModal: n.ariaModal } : {}),
    ...(n.vrefs !== undefined
      ? { vrefs: Object.fromEntries(Object.keys(n.vrefs).sort().map((k) => [k, n.vrefs![k]])) }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Fusability exclusions (§3.3) — captured and replayed, folded OUT of fusion
// by name; every exclusion is quoted in the ledger.
// ---------------------------------------------------------------------------
/** Geometry channels: captured, but environment-dependent (font metrics /
 *  layout-derived) — excluded from fusion, NAMED in the ledger. */
export const GEOMETRY_CHANNELS = new Set([
  'width', 'height', 'inline-size', 'block-size', 'perspective-origin', 'transform-origin',
  'webkit-logical-width', 'webkit-logical-height',
]);

/** Logical-property aliases of physical longhands under the PINNED writing
 *  mode (horizontal-tb + ltr, recorded in provenance). Chromium enumerates
 *  both spellings; fusing both would double-count every box channel. */
export const LOGICAL_ALIASES = new Set([
  'min-inline-size', 'min-block-size', 'max-inline-size', 'max-block-size',
  'inset-block-start', 'inset-block-end', 'inset-inline-start', 'inset-inline-end',
  'margin-block-start', 'margin-block-end', 'margin-inline-start', 'margin-inline-end',
  'padding-block-start', 'padding-block-end', 'padding-inline-start', 'padding-inline-end',
  'border-block-start-width', 'border-block-end-width', 'border-inline-start-width', 'border-inline-end-width',
  'border-block-start-style', 'border-block-end-style', 'border-inline-start-style', 'border-inline-end-style',
  'border-block-start-color', 'border-block-end-color', 'border-inline-start-color', 'border-inline-end-color',
  'border-start-start-radius', 'border-start-end-radius', 'border-end-start-radius', 'border-end-end-radius',
  'overflow-block', 'overflow-inline', 'overscroll-behavior-block', 'overscroll-behavior-inline',
  'contain-intrinsic-block-size', 'contain-intrinsic-inline-size',
]);

export const isFusable = (prop: string): boolean =>
  !prop.startsWith('-webkit-') && !GEOMETRY_CHANNELS.has(prop) && !LOGICAL_ALIASES.has(prop);

/** Channels the replay cannot apply/serialize faithfully via inline styles —
 *  named, excluded from BOTH replay application and the re-read equality
 *  metric (never silently): app-region is unsettable outside app contexts;
 *  text-decoration is a SHORTHAND Chromium enumerates whose re-serialization
 *  reorders (its longhands are captured, applied, and compared individually). */
export const REPLAY_APPLY_EXCLUDE = new Set(['app-region', 'text-decoration']);

// ---------------------------------------------------------------------------
// Value kinds for minting (§5)
// ---------------------------------------------------------------------------
const rgbaRe = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/;
const pxRe = /^(-?\d+(?:\.\d+)?)px$/;
const numRe = /^\d*\.?\d+$/;

export type Kindled = { kind: MintObservation['kind']; value: string | number } | null;

export function kindOf(prop: string, value: string): Kindled {
  const m = rgbaRe.exec(value);
  if (m) {
    const hex = (x: number) => x.toString(16).padStart(2, '0');
    const a = Number(m[4]);
    const base = `${hex(+m[1])}${hex(+m[2])}${hex(+m[3])}`;
    return { kind: 'color', value: a >= 1 ? base : `${base}${hex(Math.round(a * 255))}` };
  }
  // v15 (S4): 'none' is a first-class shadow value — a disabled/active plane
  // that CLEARS the shadow is a fact, not an unmintable shape (it minted
  // nothing before, so state shadow-clears fell to the extension block).
  if (prop === 'box-shadow') return { kind: 'shadow', value };
  // v15 (S4/matrix a.3): gradient stacks ride background-image as a minted
  // 'gradient' kind — whole-value string identity, correlated by the same
  // uniform/per-axis/per-pair machinery ('none' is a first-class point: the
  // non-gradient variants of a gradient-bearing axis).
  if (prop === 'background-image' && (value === 'none' || /^(linear|radial|conic)-gradient\(/.test(value))) {
    return { kind: 'gradient', value };
  }
  const px = pxRe.exec(value);
  if (px) return { kind: 'px', value: Number(px[1]) };
  if (numRe.test(value)) return { kind: 'number', value: Number(value) };
  return null;
}

/** Contract channel → computed longhand(s) to check — the verify.ts channel
 *  map, shared verbatim (examples/polaris/scripts/verify.ts COMPUTED). */
export const CHANNEL_TO_COMPUTED: Record<string, string[]> = {
  background: ['background-color'],
  'background-color': ['background-color'],
  color: ['color'],
  fill: ['fill'],
  // Round 5d (owner finding: the canvas Badge radius inspected as a bare 8,
  // no variable): a carried SHORTHAND must cover EVERY constituent longhand.
  // The old single-longhand coverage ('border-radius' → top-left only) left
  // the other three corners UNLABELED, so the mint created sibling leaves
  // (imported.shared.size-8) that overrode the semantic token
  // ({p.border-radius-200}) on three of four corners — same class for
  // border-width, border-color and gap.
  'border-radius': [
    'border-top-left-radius', 'border-top-right-radius',
    'border-bottom-left-radius', 'border-bottom-right-radius',
  ],
  'border-color': ['border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'],
  'border-width': ['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'],
  'padding-block': ['padding-top', 'padding-bottom'],
  'padding-inline': ['padding-left', 'padding-right'],
  'font-size': ['font-size'],
  'font-weight': ['font-weight'],
  'line-height': ['line-height'],
  'letter-spacing': ['letter-spacing'],
  gap: ['column-gap', 'row-gap'],
  'min-height': ['min-height'],
  'min-width': ['min-width'],
  'box-shadow': ['box-shadow'],
  // v15 (S4 channel lifts): per-corner radii, per-side widths, gradient
  // carriage, and the text channels are carried longhands — identity map.
  'border-top-left-radius': ['border-top-left-radius'],
  'border-top-right-radius': ['border-top-right-radius'],
  'border-bottom-left-radius': ['border-bottom-left-radius'],
  'border-bottom-right-radius': ['border-bottom-right-radius'],
  'border-top-width': ['border-top-width'],
  'border-right-width': ['border-right-width'],
  'border-bottom-width': ['border-bottom-width'],
  'border-left-width': ['border-left-width'],
  'background-image': ['background-image'],
  'font-family': ['font-family'],
  'max-width': ['max-width'],
  'max-height': ['max-height'],
};

// ---------------------------------------------------------------------------
// DOM → anatomy (§4)
// ---------------------------------------------------------------------------
/** Class stems: drop modifier classes (contain '--'), strip the library's
 *  class prefix. A BEM block-root class spelled `Block--root` (Polaris Text)
 *  keeps its block name as the stem — it identifies the element, unlike
 *  value modifiers. Signature = tag + stems (presence/absence discipline). */
export const stems = (classes: string[], classPrefix: string): string[] =>
  classes
    .map((c) => (c.endsWith('--root') ? c.slice(0, -'--root'.length) : c))
    .filter((c) => !c.includes('--'))
    .map((c) => (classPrefix && c.startsWith(classPrefix) ? c.slice(classPrefix.length) : c))
    .sort();

export const signature = (n: CapturedNode, classPrefix: string): string =>
  `${n.tag}|${stems(n.classes, classPrefix).join('.')}`;

export interface FlatEl {
  /** DFS path of child-element indices from the root ('' = root). */
  path: string;
  sig: string;
  partName: string;
  node: CapturedNode;
}

export function flatten(root: CapturedNode, classPrefix = ''): FlatEl[] {
  const out: FlatEl[] = [];
  const visit = (n: CapturedNode, p: string) => {
    out.push({ path: p, sig: signature(n, classPrefix), partName: '', node: n });
    let i = 0;
    for (const c of n.nodes) if (c.t === 'el') visit(c.el, p === '' ? String(i++) : `${p}.${i++}`);
  };
  visit(root, '');
  return out;
}

/** Part naming (§4 role classification): root; svg → icon; direct text
 *  holder → label; else dominant class stem (component prefix stripped),
 *  fallback part-<path>. */
export function namePart(el: FlatEl, componentName: string, classPrefix: string): string {
  if (el.path === '') return 'root';
  if (el.node.tag === 'svg') return 'icon';
  const hasText = el.node.nodes.some((n) => n.t === 'text' && n.v.trim().length > 0);
  if (hasText) return 'label';
  const stem = stems(el.node.classes, classPrefix)[0];
  if (!stem) return `part-${el.path}`;
  const cleaned = stem.replace(new RegExp(`^${componentName}__?`), '').toLowerCase();
  return cleaned || 'root';
}

/** Name every element of a base capture, deduping repeated names. */
export function nameParts(baseFlat: FlatEl[], componentName: string, classPrefix: string): void {
  const seen = new Map<string, number>();
  for (const el of baseFlat) {
    el.partName = namePart(el, componentName, classPrefix);
    const n = seen.get(el.partName) ?? 0;
    seen.set(el.partName, n + 1);
    if (n > 0) el.partName = `${el.partName}-${n + 1}`;
  }
}

// ---------------------------------------------------------------------------
// Prop-space enumeration policy (§1.4)
// ---------------------------------------------------------------------------
export interface EnumAxisSpec {
  /** Canonical prop name. */
  prop: string;
  /** Values in axis order. For a defaultless enum, `unset` names the pseudo-
   *  value that is PREPENDED (S2: unset as a first-class mint-axis value). */
  values: string[];
  unset?: string;
}

export interface StateAxisSpec {
  /** Boolean prop driven as a state (Button `disabled`). Participates as a
   *  2-value axis AND as a state guard (§2). */
  prop: string;
  state: 'hover' | 'active' | 'focus-visible' | 'disabled';
}

export interface Combo {
  key: string;
  /** enum-axis prop → value (unset pseudo-values included, e.g. tone 'none'). */
  axisValues: Record<string, string>;
  /** state-prop → boolean flag. */
  stateFlags: Record<string, boolean>;
}

export interface EnumerationResult {
  policy: 'full-cartesian' | 'per-axis+pairwise';
  cartesianSize: number;
  combos: Combo[];
  receipts: string[];
}

const stateSegment = (prop: string, flag: boolean): string =>
  flag ? prop : prop === 'disabled' ? 'enabled' : `no-${prop}`;

export function comboKey(axes: EnumAxisSpec[], stateProps: StateAxisSpec[], axisValues: Record<string, string>, stateFlags: Record<string, boolean>): string {
  return [
    ...axes.map((a) => axisValues[a.prop]),
    ...stateProps.map((s) => stateSegment(s.prop, stateFlags[s.prop])),
  ].join('.');
}

/** Enumerate the prop space per §1.4: full cartesian when ∏|Aᵢ| ≤ limit
 *  (state props count as 2-value axes); above that, per-axis + all pairwise
 *  combinations, with OTHER axes rotated (not pinned) so every pair is
 *  observed in ≥2 third-axis contexts when ≥3 axes exist — the certificate
 *  needs two contexts to prove a ≥3-axis interaction (see
 *  pairwiseCertificate). Deterministic order. */
export function enumerate(
  axes: EnumAxisSpec[],
  stateProps: StateAxisSpec[],
  limit: number,
  baseAxisValues: Record<string, string>,
): EnumerationResult {
  const allAxes: Array<{ prop: string; values: Array<string | boolean>; isState: boolean }> = [
    ...axes.map((a) => ({ prop: a.prop, values: a.values as Array<string | boolean>, isState: false })),
    ...stateProps.map((s) => ({ prop: s.prop, values: [false, true] as Array<string | boolean>, isState: true })),
  ];
  const cartesianSize = allAxes.reduce((n, a) => n * a.values.length, 1);
  const receipts: string[] = [];

  const mk = (assignment: Array<string | boolean>): Combo => {
    const axisValues: Record<string, string> = {};
    const stateFlags: Record<string, boolean> = {};
    allAxes.forEach((a, i) => {
      if (a.isState) stateFlags[a.prop] = assignment[i] as boolean;
      else axisValues[a.prop] = assignment[i] as string;
    });
    return { key: comboKey(axes, stateProps, axisValues, stateFlags), axisValues, stateFlags };
  };

  if (cartesianSize <= limit) {
    const combos: Combo[] = [];
    const rec = (i: number, acc: Array<string | boolean>) => {
      if (i === allAxes.length) { combos.push(mk(acc)); return; }
      for (const v of allAxes[i].values) rec(i + 1, [...acc, v]);
    };
    rec(0, []);
    receipts.push(`enumeration-policy: full cartesian (${cartesianSize} ≤ ${limit})`);
    return { policy: 'full-cartesian', cartesianSize, combos, receipts };
  }

  // per-axis + pairwise (2-covering with rotated third-axis contexts)
  const baseAssign: Array<string | boolean> = allAxes.map((a) =>
    a.isState ? false : (baseAxisValues[a.prop] ?? (a.values[0] as string)),
  );
  const seen = new Map<string, Combo>();
  const push = (assignment: Array<string | boolean>) => {
    const c = mk(assignment);
    if (!seen.has(c.key)) seen.set(c.key, c);
  };
  push(baseAssign);
  allAxes.forEach((a, i) => {
    for (const v of a.values) {
      const row = [...baseAssign];
      row[i] = v;
      push(row);
    }
  });
  for (let i = 0; i < allAxes.length; i++) {
    for (let j = i + 1; j < allAxes.length; j++) {
      let rot = 0;
      for (const vi of allAxes[i].values) {
        for (const vj of allAxes[j].values) {
          // two rotated contexts per pair point (base context + rotated) so
          // the ≥3-axis certificate has two observations of every pair.
          for (const ctx of [0, 1]) {
            const row = allAxes.map((a, k) => {
              if (k === i) return vi;
              if (k === j) return vj;
              if (ctx === 0) return baseAssign[k];
              const vals = a.values;
              const bi = vals.indexOf(baseAssign[k]);
              return vals[(bi + 1 + rot) % vals.length];
            });
            push(row);
          }
          rot++;
        }
      }
    }
  }
  receipts.push(
    `enumeration-policy: per-axis+pairwise (cartesian ${cartesianSize} > ${limit}; ${seen.size} rows; pair points observed in 2 rotated contexts — ≥3-axis interactions are DETECTED and refused by name, never silently valued)`,
  );
  return { policy: 'per-axis+pairwise', cartesianSize, combos: [...seen.values()], receipts };
}

/** The §1.4 certificate: under per-axis+pairwise enumeration, a channel is
 *  representable only if its value is decided by at most two axes. Any pair
 *  point observed in two contexts with DIFFERENT values proves a ≥3-axis
 *  interaction — the channel is refused BY NAME (the correct contract
 *  outcome; pairwise cannot value unvisited ≥3-axis points).
 *
 *  `rows` are (axisValues → observed value) for one part/channel. Returns
 *  refusal reasons ([] = certificate holds). */
export function pairwiseCertificate(
  rows: Array<{ axisValues: Record<string, string>; value: string }>,
  axes: EnumAxisSpec[],
): string[] {
  const refusals: string[] = [];
  for (let i = 0; i < axes.length; i++) {
    for (let j = i + 1; j < axes.length; j++) {
      const a = axes[i].prop;
      const b = axes[j].prop;
      const byPair = new Map<string, Set<string>>();
      for (const r of rows) {
        const key = `${r.axisValues[a]}|${r.axisValues[b]}`;
        (byPair.get(key) ?? byPair.set(key, new Set()).get(key)!).add(r.value);
      }
      // A pair (a,b) can only explain the channel if every (a,b) point is
      // single-valued across contexts. If NO pair explains it, the channel
      // depends on ≥3 axes jointly.
      if ([...byPair.values()].every((s) => s.size === 1)) return [];
    }
  }
  if (axes.length >= 2) {
    refusals.push(
      'pairwise-inconsistent: no axis pair single-values every observed point — a ≥3-axis interaction exists; channel refused by name (unrepresentable in the contract vocabulary)',
    );
  }
  return refusals;
}
