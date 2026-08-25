/**
 * COMPUTED-CAPTURE FLOOR — fusion: computed floor × static semantic layer
 * (DESIGN §4–§5), productionized from the spike with three upgrades:
 *
 *   · DERIVED-CHANNEL FOLDING (spike risk #2): channels that provably track a
 *     source fact in EVERY capture — currentColor-initialized color channels
 *     tracking `color`, px channels tracking `font-size` at a constant em
 *     ratio — are folded into the source fact instead of minting independent
 *     leaves. Every fold is a named receipt; before→after leaf counts are
 *     quoted in numbers.json.
 *   · S2 — unset/defaultless enums are first-class mint-axis values: the
 *     unset pseudo-value's leaf becomes the part's BASE binding and the set
 *     values ride tokensByProp maps (single axis) or placeholder maps (pair
 *     with an unset axis — the reviewed emitter capability lift).
 *   · S3 — state×axis substituted-ref minting, hardened: per-axis state refs
 *     land in root `states` (the emitters expand single-placeholder state
 *     refs per enum class); unset-axis state refs carry their base plane and
 *     name the set-plane residue; pair state refs overflow BY NAME (root
 *     states carry ≤1 placeholder — nothing is dropped silently).
 *
 * Fusion precedence is the spike's, verbatim: BOUND (static layer confirmed
 * or contradicted by computed truth — contradictions are RECEIPTS, never
 * silent overrides), then MINTED via core/mint-tokens.ts UNCHANGED, then
 * CODE-ONLY extension block. The review queue (contradiction-resolution
 * workflow, extract/computed/resolve.ts) is a first-class output.
 */
import { mintTokens, type MintAxis, type MintObservation, type MintResult } from '../../core/mint-tokens.js';
import {
  CONTRACT_STATES,
  DECLARED_CHANNELS,
  LITERAL_CHANNELS,
  LITERAL_VALUE_RE,
  resolveLiterals,
  resolveTokens,
  tokensByPropEntries,
  walkAnatomy,
  type Contract,
  type Part,
} from '../../scripts/contract-schema.js';
import { PRESENCE_OFF } from './capture.js';
import type { ComponentConfig, PropSpace, SweepResult, Interaction } from './capture.js';
import {
  CHANNEL_TO_COMPUTED,
  GEOMETRY_CHANNELS,
  DECOR_PSEUDOS,
  flatten,
  isFusable,
  isAbsurdRadius,
  kindOf,
  pairwiseCertificate,
  PILL_RADIUS_SENTINEL,
  SYNTHETIC_CHANNELS,
  type Capture,
  type Combo,
  type FlatEl,
  type StyleMap,
} from './lib.js';
import { buildUnion, nameUnion, rejoinStaticParts, renameGridAreaParts } from './anatomy.js';

// ---------------------------------------------------------------------------
// Alignment across the sweep (§4)
// ---------------------------------------------------------------------------
export interface AlignedSweep {
  /** This component's captures, combo keys stripped of the component prefix. */
  captures: Capture[];
  byKey: Map<string, Capture>;
  base: Capture;
  /** Round 4: the UNION anatomy in DFS order — representative element per
   *  union part (base capture's element when present there). Parts created
   *  only under structure-creating props appear here with inBase=false. */
  baseFlat: FlatEl[];
  /** Parallel to baseFlat: whether the part exists in the base capture. */
  inBase: boolean[];
  partNames: string[];
  /** Round 4: the union tree itself (promotion input). */
  union: import('./anatomy.js').UnionResult;
  getAligned: (key: string) => (FlatEl | null)[];
  structureReceipts: string[];
  /** part-name → join vs the static anatomy: matched | computed-only;
   *  static-only parts are listed separately. */
  anatomyJoin: Array<{ part: string; join: 'matched' | 'computed-only' }>;
  staticOnlyParts: string[];
}

export function alignSweep(
  sweepResult: SweepResult,
  comp: ComponentConfig,
  space: PropSpace,
  classPrefix: string,
): AlignedSweep {
  const prefix = `${comp.name}:`;
  // @door fuse.component-prefix-filter
  const captures = sweepResult.captures
    .filter((c) => c.combo.startsWith(prefix))
    .map((c) => ({ ...c, combo: c.combo.slice(prefix.length) }));
  const byKey = new Map<string, Capture>(captures.map((c) => [`${c.combo}__${c.interaction}`, c]));
  const base = byKey.get(`${space.baseComboKey}__default`);
  if (!base) throw new Error(`${comp.name}: base capture missing (${space.baseComboKey}__default)`);

  // Round 4: UNION alignment — hierarchical signature matching across ALL
  // captures (structure-creating props add union parts the base combo never
  // renders); replaces the base-tree path alignment.
  const union = buildUnion(captures, base, classPrefix);
  const structureReceipts = [...union.receipts];
  nameUnion(union.entries, comp.name, classPrefix);
  rejoinStaticParts(union.entries, space.contract, comp, structureReceipts);
  // A2 (G4): a grid child anchored to a declared area takes the area's NAME
  // as its part name (the area name IS the slot anchor) — before partNames
  // materialize, so captured-truth anatomy, minting and the promoted
  // contract agree on the one name.
  renameGridAreaParts(union.entries, structureReceipts);
  const baseFlat: FlatEl[] = union.entries.map((e) => ({
    path: e.repPath,
    sig: e.sig,
    partName: e.partName,
    node: e.rep,
  }));
  const inBase = union.entries.map((e) => e.inBase);
  const partNames = baseFlat.map((e) => e.partName);

  // per-capture part-missing receipts (presence is the normal case now —
  // receipted only for parts the BASE capture has)
  for (const [key, els] of union.alignedByKey) {
    els.forEach((el, i) => {
      // @door fuse.part-missing-in-combo
      if (!el && inBase[i]) structureReceipts.push(`part-missing: ${key} ${partNames[i]}`);
      // @door fuse.signature-drift-named
      if (el && el.sig !== baseFlat[i].sig) structureReceipts.push(`signature-drift: ${key} ${partNames[i]}: ${baseFlat[i].sig} → ${el.sig}`);
    });
  }

  const getAligned = (key: string): (FlatEl | null)[] => {
    const a = union.alignedByKey.get(key);
    if (!a) throw new Error(`${comp.name}: no capture for ${key}`);
    return a;
  };

  // Join vs the static anatomy: the static side wins NAMES and semantics;
  // the computed tree wins EXISTENCE (§4.5).
  // @door fuse.static-only-part-not-admitted
  const staticParts = new Set(walkAnatomy(space.contract).map((w) => w.name));
  const anatomyJoin = partNames.map((p) => ({
    part: p,
    join: staticParts.has(p) ? ('matched' as const) : ('computed-only' as const),
  }));
  const staticOnlyParts = [...staticParts].filter((p) => !partNames.includes(p));

  return {
    captures, byKey, base, baseFlat, inBase, partNames, union, getAligned,
    structureReceipts: [...new Set(structureReceipts)], anatomyJoin, staticOnlyParts,
  };
}

// ---------------------------------------------------------------------------
// Styled channels: differ from the control probe at base, or vary anywhere
// in the enabled default-interaction sweep.
// ---------------------------------------------------------------------------
const isEnabled = (combo: Combo): boolean => Object.values(combo.stateFlags).every((f) => !f);

/** Absolute-position round: the overlay-anatomy CLUSTER — uniformly-
 *  absolute parts (absAdmit) plus every non-text sibling/ancestor part of a
 *  component that contains any (clusterAdmit). Shared by styledChannels
 *  (channel admission) and prepareMint (outer-size baking). */
export function absClusterParts(
  a: AlignedSweep,
  space: PropSpace,
): { absAdmit: Set<number>; clusterAdmit: Set<number>; textExcluded: Set<number> } {
  const absAdmit = new Set<number>();
  for (let pi = 0; pi < a.baseFlat.length; pi++) {
    let seen = 0;
    let abs = true;
    // @door fuse.uniform-or-nothing-absolute
    for (const combo of space.enumeration.combos) {
      // @door fuse.enabled-combos-only
      if (!isEnabled(combo)) continue;
      const el = a.getAligned(`${combo.key}__default`)[pi];
      if (!el) continue;
      seen++;
      // Tailwind round: an absolutely-positioned PSEUDO (Flowbite's toggle
      // thumb is ::after with position:absolute) makes its HOST an overlay
      // anatomy exactly like an absolute child element would.
      const pseudoAbs = Object.values(el.node.pseudo ?? {}).some((ps) => ps?.['position'] === 'absolute');
      if (el.node.style['position'] !== 'absolute' && !pseudoAbs) { abs = false; break; }
    }
    if (seen > 0 && abs) absAdmit.add(pi);
  }
  const clusterAdmit = new Set<number>();
  const textExcluded = new Set<number>();
  // @door fuse.cluster-only-if-any-absolute
  if (absAdmit.size > 0) {
    for (let pi = 0; pi < a.baseFlat.length; pi++) {
      if (absAdmit.has(pi)) continue;
      // @door fuse.text-part-geometry-exclusion
      const hasText = a.baseFlat[pi].node.nodes.some((n) => n.t === 'text' && n.v.trim().length > 0);
      if (hasText) textExcluded.add(pi);
      else clusterAdmit.add(pi);
    }
  }
  return { absAdmit, clusterAdmit, textExcluded };
}

// ---------------------------------------------------------------------------
// ORGANISM ROUND (Table) — TABLE-CELL COLUMN GEOMETRY
// ---------------------------------------------------------------------------
/** Geometry is excluded from fusion BY NAME (environment-dependent: font
 *  metrics, container width). The absolute round found the first class where
 *  that rule is wrong (overlay anatomy). This is the second.
 *
 *  A table cell's width is not the cell's own choice — the table's column
 *  algorithm assigns ONE width to the whole COLUMN, and the browser proves
 *  it: header and body cells of the same column measure identical outer
 *  widths in every combo. That agreement IS the evidence. Without it the
 *  canvas draws hugging cells and the table stops being a table.
 *
 *  Rules (all named, none silent):
 *   · column identity = the cell's INDEX within its row part (the anatomy
 *     has no colgroup concept). A row whose cell count differs from the
 *     others REFUSES the whole table by name.
 *   · agreement = every cell of a column, in every enabled combo, within
 *     0.5px of the column's first cell (OUTER, box-sizing-baked).
 *     Disagreement → `table-column-width-disagreement` refusal, nothing
 *     admitted (the honest fallback is hugging cells).
 *   · HEIGHT rides the ROW, not the cell: a cell's own computed height is
 *     its CONTENT height (Chromium reports 30px for a cell inside a 63px
 *     row). The table box model gives every cell in a row the row's height —
 *     so the cell's admitted height VALUE is read from its row element
 *     (`table-cell-height-from-row`). Without it the per-cell dividers
 *     (border-bottom lives on CELLS in MUI) land at different y positions.
 *   · The claim is only ever "deterministic at the PINNED stage width" —
 *     table-layout:auto reflows with available width. Same determinism class
 *     as every other computed-capture fact (recorded in provenance).
 *
 *  Table-display parts are also EXCLUDED from the absolute-cluster geometry
 *  admission: a table contains absolute descendants (MUI's Checkbox input),
 *  which would otherwise admit width/height for every non-text part —
 *  including the lying per-cell heights. Their sizes come from the lowered
 *  flex stack instead. */
export interface TableGeometry {
  /** part index → its uniform computed table display. */
  lowered: Map<number, string>;
  /** cell part indices whose COLUMN width agreed (width+height admitted). */
  cellAdmit: Set<number>;
  /** cell part index → its row part index (height is read from the row). */
  rowOfCell: Map<number, number>;
  receipts: string[];
  refusals: string[];
}

const pxNum = (val: string | undefined): number | null => {
  if (val === undefined) return null;
  const m = /^(-?[\d.]+)px$/.exec(val);
  return m ? parseFloat(m[1]) : null;
};

/** Outer (border-box) size of one element on one axis, box-sizing-aware —
 *  the same baking the absolute round applies in prepareMint. */
const outerPx = (style: Record<string, string>, axis: 'width' | 'height'): number | null => {
  const base = pxNum(style[axis]);
  if (base === null) return null;
  if (style['box-sizing'] === 'border-box') return base;
  const sides = axis === 'width' ? ['left', 'right'] : ['top', 'bottom'];
  let outer = base;
  for (const side of sides) {
    outer += pxNum(style[`padding-${side}`]) ?? 0;
    outer += pxNum(style[`border-${side}-width`]) ?? 0;
  }
  return Math.round(outer * 1000) / 1000;
};

export function tableGeometry(a: AlignedSweep, space: PropSpace): TableGeometry {
  const out: TableGeometry = { lowered: new Map(), cellAdmit: new Set(), rowOfCell: new Map(), receipts: [], refusals: [] };
  const enabled = space.enumeration.combos.filter(isEnabled);
  // 1. uniform table displays
  for (let pi = 0; pi < a.baseFlat.length; pi++) {
    const displays = new Set<string>();
    for (const combo of enabled) {
      const el = a.getAligned(`${combo.key}__default`)[pi];
      if (el) displays.add(el.node.style['display']);
    }
    // @door fuse.uniform-table-display-lowering
    if (displays.size === 1) {
      const d = [...displays][0];
      if (d === 'table' || d === 'inline-table' || d.startsWith('table-')) out.lowered.set(pi, d);
    }
  }
  // @door fuse.no-table-no-door
  if (out.lowered.size === 0) return out;

  // 2. rows → their cells, in union-child order (the DOM order the union
  //    preserves). Column identity = index within the row.
  const idxOf = new Map<number, number>();
  a.union.entries.forEach((e, i) => idxOf.set(e.id, i));
  const columns = new Map<number, number[]>(); // column index → cell part indices
  let cellCount: number | null = null;
  for (const [pi, d] of out.lowered) {
    if (d !== 'table-row') continue;
    const rowEntry = a.union.entries[pi];
    const cells = rowEntry.children
      .map((c) => idxOf.get(c.id)!)
      .filter((ci) => out.lowered.get(ci) === 'table-cell');
    if (cells.length === 0) continue;
    // @door fuse.table-column-arity-disagreement
    if (cellCount === null) cellCount = cells.length;
    else if (cells.length !== cellCount) {
      out.refusals.push(
        `table-column-arity-disagreement: row "${a.partNames[pi]}" has ${cells.length} cells, an earlier row has ${cellCount} — column identity is index-within-row (no colgroup/colspan concept in the anatomy); NO column widths admitted`,
      );
      return { ...out, cellAdmit: new Set(), rowOfCell: new Map() };
    }
    cells.forEach((ci, col) => {
      (columns.get(col) ?? columns.set(col, []).get(col)!).push(ci);
      out.rowOfCell.set(ci, pi);
    });
  }

  // 3. per column: outer widths agree across rows in EVERY enabled combo
  for (const [col, cells] of [...columns].sort((x, y) => x[0] - y[0])) {
    let agreed = true;
    const widths: string[] = [];
    for (const combo of enabled) {
      const els = a.getAligned(`${combo.key}__default`);
      const seen: Array<{ part: string; w: number }> = [];
      for (const ci of cells) {
        const el = els[ci];
        if (!el) continue;
        const w = outerPx(el.node.style, 'width');
        // @door fuse.table-column-width-unreadable
        if (w === null) {
          out.refusals.push(`table-column-width-unreadable: column ${col} cell "${a.partNames[ci]}" width "${el.node.style['width']}" is not a px length in combo ${combo.key} — column NOT admitted`);
          agreed = false;
          break;
        }
        seen.push({ part: a.partNames[ci], w });
      }
      if (!agreed) break;
      // @door fuse.single-row-column-proves-nothing
      if (seen.length < 2) continue; // a one-row column proves nothing across rows
      const first = seen[0].w;
      // @door fuse.table-column-width-disagreement
      const bad = seen.find((s) => Math.abs(s.w - first) > 0.5);
      if (bad) {
        out.refusals.push(
          `table-column-width-disagreement: column ${col} in combo ${combo.key} — "${seen[0].part}" ${first}px vs "${bad.part}" ${bad.w}px (>0.5px); the column algorithm did not produce one width, so NO width is admitted for this column (hugging cells is the honest fallback)`,
        );
        agreed = false;
        break;
      }
      widths.push(`${combo.key}=${first}px`);
    }
    // @door fuse.table-column-width-admitted
    if (!agreed) continue;
    for (const ci of cells) out.cellAdmit.add(ci);
    out.receipts.push(
      `table-column-width-admitted: column ${col} (${cells.map((ci) => a.partNames[ci]).join(', ')}) — every row measures the same OUTER width in every enabled combo (${widths.join(', ') || 'single-row column'}); width joins fusion for these parts (deterministic at the PINNED stage width — table-layout:auto reflows with available width, named)`,
    );
  }
  // @door fuse.table-cell-height-from-row
  if (out.cellAdmit.size > 0) {
    out.receipts.push(
      `table-cell-height-from-row: the admitted cells take their HEIGHT from their ROW element — a cell's own computed height is its CONTENT height (Chromium reports e.g. 30px inside a 63px row), and the table box model gives every cell in a row the row's height; without it the per-cell border-bottom dividers land at different y positions (named)`,
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// VIEWPORT-DERIVED GEOMETRY — a measurement of the capture WINDOW is not a
// library fact (task #20, defects A + B)
// ---------------------------------------------------------------------------
/** The harness facts fusion must know in order to tell a measurement OF THE
 *  LIBRARY from a measurement OF THE CAPTURE WINDOW.
 *
 *  Every number in a capture is read out of one browser window at one stage
 *  size. Almost all of them are library facts anyway (a 4px radius is 4px in
 *  any window). Geometry is the exception: a box laid out against the INITIAL
 *  CONTAINING BLOCK measures the window, and the window is the harness's
 *  choice, not the library's. Fusion cannot make that distinction without
 *  being told what the window and the stage were — so it is told, explicitly,
 *  and the receipts quote the arithmetic they judged on.
 *
 *  Required (not optional) on purpose: an env-less call would silently
 *  re-open the door this closes, and a door that is not wired must not look
 *  like a door that found nothing. */
export interface FusionEnv {
  /** cfg.browser.viewport — the initial containing block of the capture page. */
  viewport: { width: number; height: number };
  /** capture.stageFor(cfg, comp) — the mount stage for THIS component (a
   *  per-component override is normal: Heading/Accordion stage at 360). */
  stage: { width: number; height: number; padding: number };
  /** comp.portalCapture — the component is captured by the baseline-diff
   *  portal reader, so its root may be mounted OUTSIDE the stage entirely
   *  (a child of <body>, whose content box is the window: the capture page
   *  sets `body { margin: 0 }`). */
  portaled: boolean;
}

/** Which axes of a part were laid out against the browser window. */
export interface ViewportResolution {
  /** left + margin + border + padding + width + … + right closes on viewport.width. */
  x: boolean;
  y: boolean;
  /** The arithmetic that proves it, quoted into the receipt. */
  witnessX: string;
  witnessY: string;
}

const OWN_CB_TRIGGERS = ['transform', 'filter', 'backdrop-filter', 'perspective', 'translate', 'rotate', 'scale'] as const;

/** Does this ancestor establish the containing block for a descendant with
 *  the given position? `absolute` is contained by the nearest POSITIONED
 *  ancestor; `fixed` ignores positioning and is contained only by an ancestor
 *  that creates a containing block for fixed descendants (transform/filter/
 *  perspective/will-change/contain/container-type). */
const establishesContainingBlock = (st: StyleMap, forFixed: boolean): boolean => {
  if (!forFixed && st['position'] !== undefined && st['position'] !== 'static') return true;
  for (const p of OWN_CB_TRIGGERS) {
    const v = st[p];
    if (v !== undefined && v !== 'none') return true;
  }
  const wc = st['will-change'];
  if (wc !== undefined && /transform|filter|perspective/.test(wc)) return true;
  const contain = st['contain'];
  if (contain !== undefined && /\b(layout|paint|strict|content)\b/.test(contain)) return true;
  const ct = st['container-type'];
  if (ct !== undefined && ct !== 'normal') return true;
  return false;
};

/** CSS 2.1 §10.3.7/§10.6.4 — for an out-of-flow box the OVER-CONSTRAINED
 *  identity holds exactly: start + margin + border + padding + width +
 *  padding + border + margin + end == the containing block's inner size. */
const axisSpan = (st: StyleMap, axis: 'x' | 'y'): number | null => {
  const [start, end, size] = axis === 'x' ? ['left', 'right', 'width'] : ['top', 'bottom', 'height'];
  const sides = axis === 'x' ? ['left', 'right'] : ['top', 'bottom'];
  const s = pxNum(st[start]);
  const e = pxNum(st[end]);
  const base = pxNum(st[size]);
  if (s === null || e === null || base === null) return null;
  let box = base;
  if (st['box-sizing'] !== 'border-box') {
    for (const side of sides) {
      box += pxNum(st[`padding-${side}`]) ?? 0;
      box += pxNum(st[`border-${side}-width`]) ?? 0;
    }
  }
  for (const side of sides) box += pxNum(st[`margin-${side}`]) ?? 0;
  return Math.round((s + box + e) * 1000) / 1000;
};

/** THE PART'S BOX WAS LAID OUT AGAINST THE BROWSER WINDOW.
 *
 *  Two conditions, both measured, both quoted:
 *    1. STRUCTURE — the part is out of flow (position absolute/fixed) and
 *       NOTHING inside the captured tree establishes its containing block,
 *       so its containing block is the initial containing block: the window.
 *       (Above the captured root sit only the harness's own nodes — the
 *       stage div, #root, body — none of which is positioned or transformed;
 *       that is a fact about capture.ts's page, not about the library.)
 *    2. ARITHMETIC — the axis identity closes on the viewport dimension:
 *       left + width(+box) + right == viewport.width. This is what makes the
 *       claim falsifiable per part instead of assumed per component.
 *  Both must hold in EVERY enabled default-plane combo, or the part is not
 *  called viewport-resolved. */
export function viewportResolvedParts(
  a: AlignedSweep,
  space: PropSpace,
  env: FusionEnv,
): Map<number, ViewportResolution> {
  const out = new Map<number, ViewportResolution>();
  const idxByPath = new Map<string, number>(a.baseFlat.map((e, i) => [e.path, i]));
  const ancestorsOf = (pi: number): number[] => {
    const p = a.baseFlat[pi].path;
    if (p === '') return [];
    const segs = p.split('.');
    const out2: number[] = [];
    for (let k = 0; k < segs.length; k++) {
      const j = idxByPath.get(segs.slice(0, k).join('.'));
      if (j !== undefined) out2.push(j);
    }
    return out2;
  };
  for (let pi = 0; pi < a.baseFlat.length; pi++) {
    const anc = ancestorsOf(pi);
    let seen = 0;
    let x = true;
    let y = true;
    let witnessX = '';
    let witnessY = '';
    for (const combo of space.enumeration.combos) {
      if (!isEnabled(combo)) continue;
      const els = a.getAligned(`${combo.key}__default`);
      const el = els[pi];
      if (!el) continue;
      seen++;
      const st = el.node.style;
      const pos = st['position'];
      // @door fuse.out-of-flow-required
      if (pos !== 'absolute' && pos !== 'fixed') { x = false; y = false; break; }
      // @door fuse.ancestor-establishes-containing-block
      const contained = anc.some((ai) => {
        const ae = els[ai];
        return ae ? establishesContainingBlock(ae.node.style, pos === 'fixed') : false;
      });
      if (contained) { x = false; y = false; break; }
      // @door fuse.axis-identity-closes-on-viewport
      const sx = axisSpan(st, 'x');
      const sy = axisSpan(st, 'y');
      if (sx === null || Math.abs(sx - env.viewport.width) > 0.5) x = false;
      else if (!witnessX) witnessX = `left ${st['left']} + box ${st['width']} + right ${st['right']} = ${sx}px = browser.viewport.width (${env.viewport.width}px)`;
      if (sy === null || Math.abs(sy - env.viewport.height) > 0.5) y = false;
      else if (!witnessY) witnessY = `top ${st['top']} + box ${st['height']} + bottom ${st['bottom']} = ${sy}px = browser.viewport.height (${env.viewport.height}px)`;
      if (!x && !y) break;
    }
    if (seen > 0 && (x || y)) out.set(pi, { x, y, witnessX, witnessY });
  }
  return out;
}

/** The geometry channels a viewport-resolved part must NOT mint, per part.
 *
 *  Both ends of a resolved axis go together. Chromium reports the USED value
 *  of an `auto` inset — the window-size residue — and a specified inset with
 *  the same syntax, so the capture CANNOT say which end the library authored
 *  and which end the window supplied. Refusing the residue and keeping the
 *  author's end would require a guess; refusing the pair states exactly what
 *  is known. The size channel joins the refusal only when the box IS the
 *  window (width == viewport.width), which is the `inset: 0` overlay layer. */
export function viewportDerivedRefusals(
  a: AlignedSweep,
  space: PropSpace,
  env: FusionEnv,
): { refused: Map<number, Set<string>>; receipts: string[] } {
  const refused = new Map<number, Set<string>>();
  const receipts: string[] = [];
  const res = viewportResolvedParts(a, space, env);
  // @door fuse.viewport-derived-geometry-refused
  for (const [pi, r] of [...res].sort((p, q) => p[0] - q[0])) {
    const st = a.baseFlat[pi].node.style;
    const set = new Set<string>();
    const why: string[] = [];
    if (r.x) {
      set.add('left');
      set.add('right');
      if (pxNum(st['width']) === env.viewport.width) set.add('width');
      why.push(r.witnessX);
    }
    if (r.y) {
      set.add('top');
      set.add('bottom');
      if (pxNum(st['height']) === env.viewport.height) set.add('height');
      why.push(r.witnessY);
    }
    if (set.size === 0) continue;
    refused.set(pi, set);
    receipts.push(
      `viewport-derived-geometry-refused: ${a.partNames[pi]} (position:${st['position']}) — ${[...set].sort().join(', ')} NOT minted. The part is out of flow and no ancestor in the captured tree establishes its containing block, so its box was laid out against the INITIAL CONTAINING BLOCK — the capture window: ${why.join('; ')}. These numbers are a function of the harness viewport, not of the library; a canvas frame has no window, and Chromium reports a resolved \`auto\` inset with the same syntax as an authored one, so the pair is refused together rather than half-guessed.`,
    );
    // @door fuse.viewport-anchored-translate-carried
    if (st['translate-x'] !== undefined || st['translate-y'] !== undefined) {
      receipts.push(
        `viewport-anchored-translate-carried: ${a.partNames[pi]} — translate-x/${st['translate-x'] ?? '—'} translate-y/${st['translate-y'] ?? '—'} is a POSITIONING offset written by the library's own positioner (floating-ui/popper) against where the anchor happened to sit in the capture stage. It is harness-coupled by the same argument as the refused insets, but no arithmetic in one capture proves it, so it is CARRIED and named here rather than refused on a hunch.`,
      );
    }
  }
  return { refused, receipts };
}

export function styledChannels(
  a: AlignedSweep,
  space: PropSpace,
  controls: Record<string, StyleMap>,
  allProps: string[],
  receipts: string[],
  env: FusionEnv,
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  // ABSOLUTE-POSITION ROUND (MUI Slider/Switch live finding): geometry
  // channels are excluded from fusion as environment-dependent — the right
  // rule in general and the wrong rule for exactly one class: a part whose
  // computed position is uniformly ABSOLUTE (and its direct parent, which
  // must size itself when every child leaves the flow). Their captured
  // width/height/offsets are stable decorative geometry (a 20px thumb, a
  // 4px rail) — without them the canvas stacks the overlay anatomy into
  // auto-layout blocks. Admission is per-part and receipted; every other
  // part keeps the exclusion byte-identically.
  const GEOM_ADMIT = new Set(['width', 'height', 'top', 'left', 'right', 'bottom', 'translate-x', 'translate-y']);
  const { absAdmit } = absClusterParts(a, space);
  // An overlay stack is a CLUSTER: the absolute parts, the parent that must
  // size itself when children leave the flow, AND the in-flow members whose
  // boxes the stack is built against (Switch's track fills the root; its
  // thumb sits inside the absolute switchBase). Once a component contains
  // any uniformly-absolute part, geometry is admitted for EVERY non-text
  // part (text widths are font-metric-dependent — the one genuinely
  // environment-coupled case stays excluded, receipted).
  const { clusterAdmit: parentAdmit, textExcluded } = absClusterParts(a, space);
  // ORGANISM round (Table): table-display parts NEVER take the absolute-
  // cluster geometry admission — a table contains absolute descendants (MUI's
  // Checkbox input), which would otherwise admit the LYING per-cell heights
  // (a cell reports its content height, not its row's). Their sizes come from
  // the lowered flex stack, and admitted cells take width/height from the
  // column rule below.
  const table = tableGeometry(a, space);
  receipts.push(...table.receipts, ...table.refusals);
  for (const pi of textExcluded) {
    if (table.lowered.has(pi)) continue;
    receipts.push(`absolute-geometry-excluded: ${a.partNames[pi]} — text-bearing part in an overlay-anatomy component keeps the geometry exclusion (font-metric-dependent widths)`);
  }
  // VIEWPORT-DERIVED GEOMETRY (task #20): the parts whose boxes were laid out
  // against the capture WINDOW, and the geometry channels they must not mint.
  // Computed once and applied at EVERY door below — Carbon's Modal reaches
  // fusion through the absolute/overlay-cluster door, MUI's Dialog through the
  // block-root door, and Polaris' Badge through the plain `isFusable` path
  // (insets were never in GEOMETRY_CHANNELS at all); all three minted the
  // window.
  const vpDerived = viewportDerivedRefusals(a, space, env);
  receipts.push(...vpDerived.receipts);
  // @door fuse.absolute-geometry-admitted
  for (const pi of [...absAdmit, ...parentAdmit].sort((x, y) => x - y)) {
    // @door fuse.table-geometry-excluded
    if (table.lowered.has(pi)) {
      receipts.push(`table-geometry-excluded: ${a.partNames[pi]} (display:${table.lowered.get(pi)}) — table-box parts keep the geometry exclusion even inside an overlay-anatomy component; the lowered flex stack sizes them (organism round)`);
      continue;
    }
    // The admission is real, but for a viewport-resolved part it is
    // immediately subtracted from — say so HERE, where the reader is told the
    // channels "join fusion", instead of leaving two receipts that read as a
    // contradiction (Carbon's Modal root is admitted by this door and then
    // keeps nothing but its translates).
    const sub = vpDerived.refused.get(pi);
    receipts.push(`absolute-geometry-admitted: ${a.partNames[pi]} — ${absAdmit.has(pi) ? 'uniformly position:absolute' : 'overlay-cluster member (component contains absolute parts)'}; width/height/offset channels join fusion for this part (every other component keeps the geometry exclusion)${
      sub ? ` — EXCEPT ${[...sub].sort().join(', ')}, which this part's box took from the capture WINDOW (see viewport-derived-geometry-refused: ${a.partNames[pi]})` : ''
    }`);
  }
  // BLOCK-ROOT WIDTH (Card live finding, live-paste-3): a block-display root
  // fills its container in CSS — the canvas hug reads as "not a card." The
  // captured stage width IS the rendered truth of the capture (same
  // stage-dependent receipt as the slider root); admit the root's width
  // channel when its computed display is uniformly block.
  //
  // WHERE THAT CONTAINER ACTUALLY IS (task #20, defect B). The receipt above
  // says "the captured stage width" and for an in-stage root that is true —
  // MEASURED: mui Card 288px, altitude Divider 288px, carbon Accordion 328px
  // (its own 360-wide stage), each exactly stage.width − 2×padding. For a
  // PORTALED root it is false twice over: the root is a child of <body>
  // (`body { margin: 0 }` on the capture page), so the stage — 288px wide,
  // sitting in a sibling subtree — never bounds it, and MUI's Dialog root is
  // additionally `position: fixed; inset: 0`, i.e. STRETCHED by the initial
  // containing block rather than filling anything as a block. Both roads end
  // at browser.viewport.width. The committed corpus shipped the result:
  // imported.dialog.root.width = 900px, and the same defect in Carbon's Modal
  // through the other door.
  const rootPi = a.baseFlat.findIndex((e) => e.path === '');
  const blockRootAdmit = new Set<number>();
  // @door fuse.block-root-door-closed-for-cluster-roots
  if (rootPi >= 0 && !absAdmit.has(rootPi) && !parentAdmit.has(rootPi)) {
    let block = true;
    let seen = 0;
    for (const combo of space.enumeration.combos) {
      if (!isEnabled(combo)) continue;
      const el = a.getAligned(`${combo.key}__default`)[rootPi];
      if (!el) continue;
      seen++;
      if (el.node.style['display'] !== 'block') { block = false; break; }
    }
    // ANTD EXAM (heal loop): a root that is NOT display:block but measures
    // EXACTLY the stage's content box in every enabled combo fills its
    // container the same way a block root does — antd's Input is an
    // inline-block `width: 100%` (blockStage), its Progress a `width: 100%`
    // line. Without this the canvas hugged the Input to its (absent) text:
    // a 24px-wide, 10px-tall box nobody could read as an input. Same
    // stage-dependent receipt as the block root; the viewport door above
    // still refuses a body-wide box.
    // @door fuse.stage-fill-root-admitted
    if (seen > 0 && !block) {
      const stageContent = env.stage.width - 2 * env.stage.padding;
      let fills = true;
      for (const combo of space.enumeration.combos) {
        if (!isEnabled(combo)) continue;
        const el = a.getAligned(`${combo.key}__default`)[rootPi];
        if (!el) continue;
        if (pxNum(el.node.style['width']) !== stageContent) { fills = false; break; }
      }
      if (fills && !vpDerived.refused.get(rootPi)?.has('width')) {
        block = true;
        receipts.push(`stage-fill-root-admitted: ${a.partNames[rootPi]} — display:${a.baseFlat[rootPi].node.style['display']} root measures exactly the stage content box (${stageContent}px) in every enabled combo: it fills its container like a block root (antd Input \`width: 100%\`), so the captured stage width joins fusion under the block-root receipt below`);
      }
    }
    // @door fuse.block-root-width-admitted
    if (seen > 0 && block) {
      const rootStyle = a.baseFlat[rootPi].node.style;
      const rootW = pxNum(rootStyle['width']);
      const stageContent = env.stage.width - 2 * env.stage.padding;
      // (1) out-of-flow root stretched by the window (`inset: 0`) — proven by
      // the axis identity in viewportResolvedParts, already refused above.
      // @door fuse.block-root-width-refused
      const stretched = vpDerived.refused.get(rootPi)?.has('width') === true;
      // (2) in-flow block root whose containing block is the BODY, not the
      // stage: it measures the window exactly while the stage measures
      // something else. This is the flowbite-react shape — @floating-ui's
      // `<div data-floating-ui-portal>` (position:static, display:block,
      // zero-height) sits between <body> and the overlay and is what the
      // single-root portal policy hands to fusion.
      const bodyWide = rootW !== null && rootW === env.viewport.width && stageContent !== env.viewport.width;
      if (stretched || bodyWide) {
        receipts.push(
          `block-root-width-refused: ${a.partNames[rootPi]} — display:block root, width ${rootStyle['width']} = browser.viewport.width (${env.viewport.width}px), NOT the stage content box (stage ${env.stage.width}px − 2×${env.stage.padding}px = ${stageContent}px). ${
            stretched
              ? `The root is position:${rootStyle['position']} pinned to the initial containing block, so the window STRETCHED it; it is not "filling its container" in any sense the library chose.`
              : `The root is in normal flow but measures the window exactly, so its containing block is the document body (\`body { margin: 0 }\` on the capture page) — it was mounted OUTSIDE the stage${env.portaled ? ' (this component is captured through the portal reader, whose root is a child of <body>)' : ''}.`
          } A width that is a function of the capture window is a fact about the harness, not about the library: it is REFUSED here rather than minted with a warning, because the emitters read the token and not the receipt — a 900px token draws a 900px frame on canvas whatever the receipt says. The component's own drawn box is a DIFFERENT element (the dialog paper); choosing it is capture's root decision (demoteFullBleedScrim), not fusion's to fabricate.`,
        );
      } else {
        blockRootAdmit.add(rootPi);
        receipts.push(`block-root-width-admitted: ${a.partNames[rootPi]} — display:block root fills its container in CSS; the captured stage width joins fusion (stage-dependent, receipted — the canvas card draws at the captured block width instead of hugging its text)`);
        // @door fuse.block-root-width-source
        if (rootW !== null && rootW !== stageContent) {
          receipts.push(
            `block-root-width-source: ${a.partNames[rootPi]} — the admitted width ${rootStyle['width']} is NOT the stage content box (${stageContent}px) and NOT the viewport (${env.viewport.width}px); this block root did not fill anything, it took its own intrinsic/shrink-to-fit size (a flex stage makes a block child a flex item). The admission stands — the number is the library's — but the sentence above names a container this measurement did not come from.`,
          );
        }
      }
    }
  }
  /** CONFORMANCE FRONTIER (R4) — THE `-webkit-` BLANKET STOPS BEING SILENT.
   *
   *  `isFusable` refuses every `-webkit-` prefixed longhand by one blanket
   *  rule, and NOT ONE `-webkit-*` name appeared in ANY of the six libraries'
   *  union artifacts: the exclusion was total and unlogged, so a vendor-
   *  prefixed construct could disappear with no receipt at all. That is how
   *  `-webkit-line-clamp` (the ONLY cross-browser two-line truncation, i.e.
   *  every card description in every library) vanished.
   *
   *  The blanket STAYS — vendor-prefixed longhands are mostly Chromium's own
   *  internal mirrors of standard channels and fusing them would double-count
   *  — but every prefixed channel a subject actually STYLES (differs from the
   *  bare control element, or varies across combos) is now counted and named,
   *  so the next vendor-prefixed construct announces itself instead of
   *  evaporating. */
  const webkitStyled = new Map<string, Set<string>>(); // channel -> parts
  // ANTD EXAM (2026-08-23) — THE GEOMETRY EXCLUSION STOPS BEING SILENT PER
  // PART. Option B (docs/BETA.md) keeps width/height out of fusion as
  // environment-dependent and carries the obligation to LEDGER each drop.
  // Measured on the exam's accounting: Tag root.height 22px, Input root
  // width 288px (the stage's content box), Avatar 32×32, Progress's four
  // track boxes, Card's head/body heights — 46 (part, channel) facts that
  // differ from the control, refused by `isFusable`, and named by NOTHING in
  // LEDGER.md, the extension or stdout. Same shape as the -webkit census
  // above: one line per part naming every excluded geometry channel and its
  // base value, so the drop is greppable by part AND channel.
  const geometryExcluded = new Map<string, Map<string, string>>(); // part -> channel -> base value
  for (let pi = 0; pi < a.baseFlat.length; pi++) {
    const set = new Set<string>();
    const inTableBox = table.lowered.has(pi);
    // task #20: a geometry channel the window supplied is refused at EVERY
    // door, so the leading `!vpRefused` guard sits outside the whole
    // disjunction. It has to: MEASURED while building this — `isFusable`
    // excludes only GEOMETRY_CHANNELS = width/height/inline-size/block-size/
    // *-origin, and `top`/`right`/`bottom`/`left` ARE NOT IN THAT SET. The
    // insets were never gated by the geometry door at all (which is why
    // `absolute-geometry-admitted`'s "every other component keeps the
    // geometry exclusion" is true of sizes and false of offsets), so
    // Polaris Badge's sr-only span minted `bottom: 799px` — 800px window
    // minus a 1px box — through the ordinary fusable path.
    const vpRefused = vpDerived.refused.get(pi);
    // ANTD EXAM (heal loop, 2026-08-23) — TOKEN-NAMED GEOMETRY IS A DESIGN
    // VALUE. antd's Button is `height: var(--ant-control-height)` (32px), its
    // Input the same token, its Avatar `width/height: var(--ant-avatar-
    // container-size)`; the CSS-vars reader VERIFIED those bindings (vrefs)
    // and the geometry exclusion then threw the channel away as
    // "environment-dependent" — the canvas drew 18px-tall buttons and 12px
    // avatars. A dimension the library's own stylesheet names with a token
    // is not a measurement of the harness; it joins fusion with its name.
    // Percent/viewport-derived boxes keep the exclusion (vpRefused wins).
    // @door fuse.token-named-geometry-admitted
    const tokenNamed = (p: string): boolean =>
      (p === 'width' || p === 'height') && !inTableBox && (a.baseFlat[pi].node.vrefs?.[p]?.length ?? 0) > 0;
    for (const p of ['width', 'height'] as const) {
      if (tokenNamed(p) && !vpRefused?.has(p)) {
        const [name, value, rule] = a.baseFlat[pi].node.vrefs![p]![0];
        receipts.push(`token-named-geometry-admitted: ${a.partNames[pi]}.${p} — the library's own stylesheet binds it to ${name} (${value}) at \`${rule}\`; a dimension named by a token is a design value, not an environment measurement, so it joins fusion with its name (the absolute-cluster / table / block-root doors are unchanged)`);
      }
    }
    const admit = (p: string): boolean =>
      !vpRefused?.has(p) &&
      // @door fuse.webkit-blanket-refusal
      (isFusable(p) ||
        (GEOM_ADMIT.has(p) && !inTableBox && (absAdmit.has(pi) || parentAdmit.has(pi))) ||
        ((p === 'width' || p === 'height') && table.cellAdmit.has(pi)) ||
        (p === 'width' && blockRootAdmit.has(pi)) ||
        tokenNamed(p));
    // @door fuse.control-fallback
    const tag = a.baseFlat[pi].node.tag;
    const ctrl = controls[tag] ?? controls['span'];
    if (!controls[tag]) receipts.push(`control-fallback: no control for <${tag}> — span control used (part ${a.partNames[pi]})`);
    for (const p of allProps) {
      // R4: the -webkit census runs over the SAME comparison the fusion door
      // uses (differs from the control), on the channels the door refuses.
      if (p.startsWith('-webkit-') && a.baseFlat[pi].node.style[p] !== ctrl[p]) {
        (webkitStyled.get(p) ?? webkitStyled.set(p, new Set()).get(p)!).add(a.partNames[pi]);
      }
      // @door fuse.geometry-exclusion
      if (GEOMETRY_CHANNELS.has(p) && !admit(p) && a.baseFlat[pi].node.style[p] !== ctrl[p]) {
        (geometryExcluded.get(a.partNames[pi]) ?? geometryExcluded.set(a.partNames[pi], new Map()).get(a.partNames[pi])!).set(p, a.baseFlat[pi].node.style[p] ?? '');
      }
      // @door fuse.is-fusable-blanket
      if (!admit(p)) continue;
      // @door fuse.control-element-delta
      if (a.baseFlat[pi].node.style[p] !== ctrl[p]) set.add(p);
      // @door fuse.reset-supplied-border-style-admitted
      else if (resetSuppliedBorderStyle(p, a.baseFlat[pi].node.style, ctrl)) {
        set.add(p);
        receipts.push(
          `reset-supplied-border-style-admitted: ${a.partNames[pi]}.${p} = ${a.baseFlat[pi].node.style[p]} — EQUAL to the <${tag}> control, so the styled-channel door would normally drop it as "not a fact of this component". Admitted anyway because this part draws a real border (${p.replace('-style', '-width')} = ${a.baseFlat[pi].node.style[p.replace('-style', '-width')]}) and the style comes from the library's GLOBAL CSS (Tailwind preflight's \`* { border-style: solid }\` and its equivalents). The control correctly subtracts the reset; the emitted CSS does not REPRODUCE it, so without this the width and colour ship and the border paints nothing.`,
        );
      }
    }
    for (const combo of space.enumeration.combos) {
      if (!isEnabled(combo)) continue;
      const el = a.getAligned(`${combo.key}__default`)[pi];
      if (!el) continue;
      for (const p of allProps) {
        if (p.startsWith('-webkit-') && el.node.style[p] !== a.baseFlat[pi].node.style[p]) {
          (webkitStyled.get(p) ?? webkitStyled.set(p, new Set()).get(p)!).add(a.partNames[pi]);
        }
        if (!admit(p)) continue;
        // @door fuse.cross-combo-variance-admission
        if (el.node.style[p] !== a.baseFlat[pi].node.style[p]) set.add(p);
      }
    }
    // Synthetic translate channels live outside the browser enumeration.
    //
    // PSEUDO-DECOR v2 ROUND — GENERALIZED TRANSLATE DOOR. The v1 door only
    // admitted these when the BASE combo already carried the key
    // (`baseFlat[pi].style['translate-x'] !== undefined`). MUI Switch's thumb
    // is `transform: none` at base and only picks up matrix(1,0,0,1,20,0) on
    // the Checked plane — so its motion was never observed and the checked
    // thumb drew at the unchecked x (the state round's pinned residual).
    //
    // The door is now: an overlay-cluster member (absAdmit ∪ parentAdmit,
    // minus table-lowered) whose EVERY enabled default-plane combo is inside
    // the translate grammar (transform none|identity-translate, `translate`
    // none|<len|pct> pairs, never both) admits the pair as soon as ANY combo
    // carries motion. ABSENT ≡ '0px' (a combo with no translate is at rest,
    // not unobserved) — prepareMint's per-combo read applies the same
    // identity. Anything outside the grammar REFUSES BY NAME and admits
    // nothing (never silently picking one spelling).
    if (!inTableBox && (absAdmit.has(pi) || parentAdmit.has(pi))) {
      const styles: StyleMap[] = [a.baseFlat[pi].node.style];
      for (const combo of space.enumeration.combos) {
        if (!isEnabled(combo)) continue;
        const el = a.getAligned(`${combo.key}__default`)[pi];
        if (el) styles.push(el.node.style);
      }
      let anyMotion = false;
      let outside: string | null = null;
      // @door fuse.translate-door-refused
      for (const st of styles) {
        const tf = st['transform'] ?? 'none';
        const tr = st['translate'] ?? 'none';
        const tfSet = tf !== 'none';
        const trSet = tr !== 'none' && tr !== '';
        if (tfSet && trSet) { outside ??= `transform (${tf}) AND translate (${tr}) both set`; continue; }
        if (tfSet && st['translate-x'] === undefined) { outside ??= `non-translate transform (${tf})`; continue; }
        if (trSet && st['translate-x'] === undefined) { outside ??= `translate outside the bounded grammar (${tr})`; continue; }
        const tx = st['translate-x'];
        const ty = st['translate-y'];
        if ((tx !== undefined && tx !== '0px') || (ty !== undefined && ty !== '0px')) anyMotion = true;
      }
      if (outside !== null) {
        receipts.push(
          `translate-door-refused: ${a.partNames[pi]} — ${outside}; the synthetic translate-x/y channels are NOT admitted for this part (the bounded grammar carries identity-translate transforms and the independent translate longhand, one spelling at a time) — named refusal, pseudo-decor v2 round`,
        );
      // @door fuse.translate-door-generalized
      } else if (anyMotion) {
        set.add('translate-x');
        set.add('translate-y');
        receipts.push(
          `translate-door-generalized: ${a.partNames[pi]} — translate motion observed on a non-base combo (base at rest); translate-x/y admitted across the whole enabled default plane with ABSENT ≡ 0px (the v1 door required the BASE combo to carry the key and dropped state-plane motion into code-only) — pseudo-decor v2 round`,
        );
      }
    }
    // ORGANISM round: an admitted table cell ALWAYS carries width+height —
    // the column width and the row height are facts of the table box model,
    // not deltas from a <span> control baseline.
    // @door fuse.table-cell-always-carries-size
    if (table.cellAdmit.has(pi)) { set.add('width'); set.add('height'); }
    // Round 5c — TEXT-PART TYPOGRAPHY IS ALWAYS A FACT: a text-bearing
    // part whose typography equals the mount context (the provider's 13px/
    // 20px/450 body) looked "unstyled" against the span control and was
    // never carried — but the GENERATED surfaces have no Polaris body to
    // inherit from, so the canvas drew its own 14px/500 defaults (the
    // named 13px-vs-14px config-triage class on Checkbox/Radio/Banner
    // labels). Context-inherited or not, the rendered typography of a text
    // part is captured truth; carry the three box-driving channels
    // explicitly (sr-only parts excluded — they draw nothing).
    // Round 5c — SVG-HOST COLOR IS ALWAYS A FACT: a part directly hosting
    // an <svg> child whose glyph rides currentColor (Spinner's context-gray
    // arc) draws BLACK on the generated surfaces when the color chain is
    // context-inherited and therefore looked unstyled. Carry `color` on
    // svg hosts unconditionally (same rationale as text-part typography).
    // @door fuse.svg-host-color-carried
    if (a.baseFlat[pi].node.nodes.some((n) => n.t === 'el' && n.el.tag === 'svg') && !set.has('color')) {
      set.add('color');
      receipts.push(`svg-host-color-carried: ${a.partNames[pi]} — color carried even though equal to the control baseline (the hosted glyph rides the color chain; generated surfaces have no Polaris body context — round 5c)`);
    }
    // @door fuse.text-part-typography-carried
    const hasText = a.baseFlat[pi].node.nodes.some((n) => n.t === 'text' && n.v.trim().length > 0);
    // @door fuse.sr-only-typography-excluded
    const srOnly = (a.baseFlat[pi].node.style['clip-path'] ?? '').startsWith('inset(50%');
    if (hasText && !srOnly) {
      const added: string[] = [];
      // ALTITUDE LINK ROUND — `font-family` JOINS THE ROUND-5c TRIO.
      //
      // Round 5c carried the three BOX-DRIVING typography channels and left
      // the FOURTH — the one FC-FONT-SUBSTRATE is entirely about — behind.
      // The argument is identical and stronger: a library that ships a global
      // `body`/`:root` family (altitude's main.css, and its equivalent in
      // every other subject) styles the CONTROL too, so control-equality
      // reports "free" for a family the generated surfaces never inherit —
      // emit-html/emit-react ship component CSS only, and the canvas draws
      // its own default face.
      //
      // EVIDENCE THAT THIS IS THE ALREADY-AGREED ANSWER, not a new opinion:
      // commit ac5e6181 ("the hill-climb hand-edited committed contracts …
      // altitude's Plex families") put `font-family` into altitude's
      // enriched contracts BY HAND, for exactly the parts this clause
      // reaches. MEASURED: the 5 altitude parts whose family equals the
      // control are the 5 altitude enriched contracts that carry a
      // hand-added `font-family` (badge, button, chip, heading, link) — so
      // this door REPRODUCES the hand-edit instead of leaving it to be
      // silently erased by the next re-fuse.
      // (the round-5c trio stays UNGUARDED — adding an `admit()` test to it
      // would silently drop a channel the viewport-geometry door refused,
      // which is a different change than this one and was not measured.)
      for (const ch of ['font-size', 'line-height', 'font-weight']) {
        if (!set.has(ch)) { set.add(ch); added.push(ch); }
      }
      if (!set.has('font-family')) { set.add('font-family'); added.push('font-family'); }
      if (added.length > 0) {
        receipts.push(`text-part-typography-carried: ${a.partNames[pi]} — ${added.join('/')} carried even though equal to the control baseline (context-inherited typography IS the rendered truth; the generated surfaces have no library body context, and the canvas otherwise draws its own 14px/500/default-face defaults — round 5c + the font-family completion, altitude link round)`);
      }
    }
    // ALTITUDE LINK ROUND — A PAINTED TEXT DECORATION IS NEVER "FREE".
    //
    // The control-equality door drops a channel on the argument that the
    // EMITTED element inherits the value for nothing. That argument needs
    // two premises, and a painted `text-decoration-line` breaks both:
    //
    //  (1) the emitted DOM must reproduce the control's CONDITION. The <a>
    //      control is rendered `<a href="#c">SAMPLE</a>` (capture.ts,
    //      CONTROL_TAGS), so it matches `:any-link` and carries the UA's
    //      underline. core/emit-html writes the root as `<a class="link">`
    //      with NO href — not `:any-link`, UA rule never applies. MEASURED
    //      on altitude Link at Variant=Lg: library ink 34x16, contract
    //      render 32x14.
    //  (2) the target must BE a DOM. Figma has no user agent: a channel the
    //      contract does not record is a channel the canvas cannot draw.
    //      `text-decoration-line` is a DECLARED_CHANNELS 'draw' verdict
    //      (textDecoration = UNDERLINE), i.e. the canvas CAN draw it — but
    //      only if the contract carries it.
    //
    // And the coincidence is not even UA provenance: altitude's own shadow
    // stylesheet AUTHORS the value —
    //   .al-c-link { text-decoration: var(--al-link-text-decoration, underline) }
    // (altitude-web-components@1.0.2 dist/components/link/link.js). The
    // fallback happens to equal the UA default, so control-equality read a
    // LIBRARY-AUTHORED declaration as a browser freebie: a false negative,
    // not a UA fact.
    //
    // The door is deliberately ASYMMETRIC on value, not on tag: `none` equal
    // to the control is genuinely nothing to draw (no target paints a
    // decoration by default), so dropping it still loses nothing and no
    // `text-decoration-line: none` is minted anywhere. Only a value that
    // PAINTS A MARK is re-admitted. MEASURED across every committed capture
    // in extract/computed/out (all seven libraries): exactly ONE part in the
    // whole corpus has a non-`none` text-decoration-line — altitude Link's
    // root — so this widens the door by one fact and mints nothing else.
    //
    // SCOPED TO `text-decoration-line` ALONE, by measurement: the sibling
    // longhands need no special case, because every control (span/div/
    // button/a) computes the INITIAL `solid`/`auto` — a library that authors
    // a non-default decoration style or thickness already DIFFERS from the
    // control and walks through the ordinary door. Only `-line` collides,
    // and only against the `<a>` control.
    // @door fuse.painted-text-decoration-carried
    {
      const ch = 'text-decoration-line';
      const v = a.baseFlat[pi].node.style[ch];
      if (!set.has(ch) && admit(ch) && v !== undefined && v !== '' && v !== 'none') {
        set.add(ch);
        receipts.push(
          `painted-text-decoration-carried: ${a.partNames[pi]}.${ch} = ${v} — carried even though EQUAL to the <${tag}> control. Control-equality is a DOM-INHERITANCE argument ("the emitted element gets this for free") and it cannot justify dropping a decoration that must be PAINTED: the <a> control is rendered \`<a href="#c">\` (\`:any-link\`, so it carries the UA underline) while core/emit-html writes the root \`<a>\` with NO href, and the Figma canvas has no user agent at all. Equality with the control is therefore not evidence of UA provenance — the founding case (altitude Link) is a LIBRARY declaration, \`.al-c-link { text-decoration: var(--al-link-text-decoration, underline) }\`, whose fallback merely coincides with the UA default. \`none\` is still dropped by value: nothing paints a decoration by default, so the draws-nothing value costs nothing on any target.`,
        );
      }
    }
    // THE DOOR REGISTER — THE CONTROL-ELEMENT DELTA STOPS BEING SILENT.
    //
    // Every door above this line leaves a receipt when it fires. The LARGEST
    // subtraction in the whole pipeline did not: a channel whose value equals
    // the control for this part's tag is dropped by a bare `if` with no array,
    // no counter and no line anywhere. Measured on the committed corpus that is
    // ~82,000 (part, channel) drops — most of them genuine initial values, and
    // a named handful of them the two worst defects the owner has found.
    //
    // Enumerating all ~82,000 would bury the register in initial values, so the
    // census is split by the reader's OWN evidence (see librarySuppliedChannel):
    //
    //   * one COUNT line per part — the drop is never a silent zero again, and
    //     the size of the surface is greppable per part;
    //   * one NAMED line per channel the LIBRARY'S OWN STYLESHEET declares on
    //     this element. Those are the facts the premise is provably wrong
    //     about: the component authored them, the control only shares them
    //     because it is rendered inside the same page with the same global CSS,
    //     and the emitted CSS does not reproduce global CSS. This is the
    //     "missing ink" surface, named channel by channel.
    //
    // NOTHING IS CARRIED DIFFERENTLY. `set` is complete at this point — every
    // re-admission door (reset-supplied border style, cross-combo variance,
    // svg-host colour, text-part typography, painted text-decoration, the
    // geometry family) has already run, so a channel still absent here is one
    // the door really did subtract.
    // (The receipt for `fuse.control-element-delta`; the door itself is marked
    //  at its deciding `if` above.)
    {
      const dropped: string[] = [];
      const authored: string[] = [];
      for (const p of allProps) {
        if (p.startsWith('--')) continue; // the custom-property door owns these, and it receipts
        if (!admit(p)) continue; // the geometry / webkit / fusability doors own these, and they receipt
        if (set.has(p)) continue; // carried after every door
        const v = a.baseFlat[pi].node.style[p];
        if (v === undefined || v !== ctrl[p]) continue; // absent, or a different door's drop
        dropped.push(p);
        const supplied = librarySuppliedChannel(a.baseFlat[pi].node, p);
        if (supplied !== null) authored.push(`${p} = ${v} (declared by ${supplied})`);
      }
      if (dropped.length > 0) {
        receipts.push(
          `control-equal-drop: ${a.partNames[pi]} — ${dropped.length} channel(s) EQUAL to the <${tag}> control${controls[tag] ? '' : ' (SPAN FALLBACK — no control is rendered for this tag, so the baseline is the wrong element)'} and therefore NOT carried, on the premise that a value the bare control also has is the user agent's or the library's reset and the emitted DOM inherits it for free. ${authored.length} of them are DECLARED BY THE LIBRARY'S OWN STYLESHEET on this element, where that premise is false.`,
        );
      }
      for (const line of authored.sort()) {
        receipts.push(
          `control-equal-drop-authored: ${a.partNames[pi]}.${line} — dropped by the control-element delta because the <${tag}> control resolves to the SAME value, but the library's own stylesheet declares this channel on this element: the control shares the value only because it is rendered inside the same page with the same global CSS, and the emitted CSS reproduces the component's rules and NOT the page's. This is the shape of shadcn's invisible Input border (\`* { border-color: var(--border) }\`) and Polaris' inkless text (provider \`color\` reaching the control by inheritance).`,
        );
      }
    }
    out.set(a.partNames[pi], set);
  }
  // R4: emit the -webkit census. One line per prefixed channel the subject
  // actually styles, naming the channel and the parts, plus a count — so
  // "the blanket refused nothing here" and "the blanket ate a construct" are
  // different, visible facts. `-webkit-line-clamp` gets the argued refusal it
  // has earned by measurement (see WEBKIT_NOTES).
  for (const [part, chans] of [...geometryExcluded].sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))) {
    const listed = [...chans].sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)).map(([c, v]) => `${c} ${v}`).join(', ');
    receipts.push(
      `geometry-excluded: ${part} — ${listed} — FC-GEOMETRY-EXCLUDED (Option B): box geometry is environment-dependent and is not fused; it is admitted only through the absolute-cluster, table-cell and block-root doors, none of which this part passed. The canvas sizes the box from its carried content, padding and min/max channels.`,
    );
  }
  const wk = [...webkitStyled].sort(([x], [y]) => x.localeCompare(y));
  if (wk.length > 0) {
    receipts.push(
      `webkit-prefixed-channels-refused: ${wk.length} vendor-prefixed channel(s) are STYLED by this component and refused by the blanket \`-webkit-\` fusion exclusion (isFusable) — named here because the exclusion used to be silent: ${wk.map(([c, parts]) => `${c} (${[...parts].sort().join(', ')})`).join('; ')}`,
    );
    for (const [ch] of wk) {
      const note = WEBKIT_NOTES[ch];
      if (note) receipts.push(`webkit-refusal-argued: ${ch} — ${note}`);
    }
  }
  return out;
}

/** R4 — the vendor-prefixed channels whose refusal is an ARGUED call rather
 *  than the blanket, each with the measurement behind it. */
export const WEBKIT_NOTES: Record<string, string> = {
  '-webkit-line-clamp': `MULTI-LINE TRUNCATION, REFUSED BY NAME after measurement, not by the blanket. Figma DOES have the field (textTruncation + maxLines), so the canvas half is expressible — but the CODE half is NOT RECOVERABLE FROM COMPUTED STYLE. Measured in the subject browser: an element authored \`display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden\` COMPUTES \`display: flow-root\` (Chromium's current line-clamp implementation blockifies it), and re-authoring \`display: flow-root; -webkit-line-clamp: 2; overflow: hidden\` from that computed truth does NOT clamp — 100.73px tall against the clamped original's 28.78px. The authored \`-webkit-box\` that makes the clamp work is erased by the cascade before the reader sees it, so carrying the channel would put a DEAD declaration in the emitted CSS and a clamp on the canvas that the generated code does not reproduce: a contract that disagrees with itself. Refused on both surfaces until the reader can recover the authored display (a source-CSS read, not a computed read) — the upgrade is named, costed and NOT taken here.`,
  '-webkit-text-fill-color': `NOT a loss: this channel is FOLDED INTO \`color\` at the read boundary (lib.ts foldTextFillColor) because it IS the painted text ink whenever it differs from \`color\`. It stays in the capture as the evidence for that fold.`,
};

// ---------------------------------------------------------------------------
// DERIVED-CHANNEL FOLDING (item 4 / spike risk #2)
// ---------------------------------------------------------------------------
/** Channels whose CSS initial value is currentColor (or resolves to the used
 *  color): candidates for folding into the `color` fact. Folding is still
 *  EMPIRICAL — a candidate folds only when it equals the element's `color`
 *  in EVERY capture (all combos × all interactions). */
export const CURRENTCOLOR_FOLD_CANDIDATES = new Set([
  'caret-color', 'text-decoration-color', 'text-emphasis-color', 'column-rule-color',
  'outline-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  // ═══ TASK #35 — `row-rule-color`, THE 55% MISS, IS ONE MISSING LINE.
  //
  // `row-rule-color` accounted for 268 occurrences — 55% of ALL unhandled-
  // channel misses corpus-wide — and it reaches the SHIPPED contracts of five
  // of six libraries (altitude 25 refs, astryx 34, carbon 69, mui 124,
  // tailwind 32). Nobody authored it and neither surface paints it.
  //
  // WHY IT PASSED THE DELTA-FROM-CONTROL DOOR (measured, not assumed): its CSS
  // initial value is `currentcolor`, so its computed value IS the element's own
  // `color`. Verified on astryx/button's committed capture — every element:
  // `color: rgba(10,19,23,1)`, `row-rule-color: rgba(10,19,23,1)`,
  // `row-rule-style: none`, i.e. identical to `color` and structurally unable
  // to paint. The door compares the subject against a BARE control element
  // whose `color` is the UA default, so any part with an authored `color`
  // differs in `row-rule-color` too. The door is doing exactly what it should;
  // the channel is a DERIVED mirror, not an authored fact.
  //
  // WHICH IS WHAT THIS LIST IS FOR — and `row-rule-color` was simply missing
  // from it. `row-rule-*` is CSS Gap Decorations, a longhand family Chromium
  // began enumerating AFTER this list was written, and unlike every other
  // member of its class it is neither `-webkit-`-prefixed nor a logical alias,
  // so no earlier door caught it. Census over all 107 committed captures
  // (`equals color` on every element carrying both):
  //     -webkit-text-fill-color  100.0%  — refused earlier by the -webkit blanket
  //     -webkit-text-stroke-color 99.9%  — refused earlier by the -webkit blanket
  //     caret/column-rule/text-decoration/text-emphasis-color 99.9% — ON THIS LIST
  //     row-rule-color            99.8%  — NOT ON THIS LIST  ←  the whole defect
  //     border-{block,inline}-*-color 95-98% — refused earlier as LOGICAL_ALIASES
  //     border-{top,right,bottom,left}/outline-color 93-98% — ON THIS LIST
  // So the enumeration was not systemically stale: EXACTLY ONE fusable channel
  // slipped, and the `currentcolor-fold-candidate-missing` census receipt below
  // now makes the next browser widening announce itself instead of minting
  // another 268 leaves in silence.
  //
  // The fold stays EMPIRICAL — this only makes `row-rule-color` eligible; it
  // folds on a given part only when it equals that part's `color` in every
  // captured combo × interaction. Where it genuinely differs it still mints,
  // and the census names it.
  'row-rule-color',
]);

export interface FoldReceipt {
  part: string;
  channel: string;
  foldedInto: 'color' | 'font-size';
  /** em ratio for font-size folds. */
  ratio?: number;
  class: 'currentColor' | 'em-tracking';
}

/** Detect folds per part. A folded channel's base values AND state deltas are
 *  carried by its source fact — it mints nothing, receipted by name. */
export function detectFolds(
  a: AlignedSweep,
  styled: Map<string, Set<string>>,
  /** TASK #35 — the STALENESS CENSUS. `CURRENTCOLOR_FOLD_CANDIDATES` is a
   *  hand-maintained enumeration and the browser widens underneath it: that is
   *  precisely how `row-rule-color` (CSS Gap Decorations, added to Chromium's
   *  longhand enumeration after the list was written) became 55% of all
   *  unhandled-channel misses without one line of receipt anywhere. Any styled
   *  channel that WOULD have folded — equal to the part's own `color` on every
   *  captured plane — but is NOT on the candidate list is named here, so the
   *  next widening announces itself instead of minting leaves in silence.
   *  Same discipline as the R4 `-webkit` census in `styledChannels`. */
  receipts?: string[],
): FoldReceipt[] {
  const folds: FoldReceipt[] = [];
  const missingCandidates = new Map<string, Set<string>>(); // channel -> parts
  const pxOf = (v: string | undefined): number | null => {
    if (v === undefined) return null;
    const m = /^(-?\d+(?:\.\d+)?)px$/.exec(v);
    return m ? Number(m[1]) : null;
  };
  for (let pi = 0; pi < a.baseFlat.length; pi++) {
    const part = a.partNames[pi];
    const channels = styled.get(part);
    if (!channels) continue;
    for (const ch of [...channels].sort()) {
      // @door fuse.currentcolor-fold
      if (CURRENTCOLOR_FOLD_CANDIDATES.has(ch)) {
        let holds = true;
        for (const c of a.captures) {
          const el = a.getAligned(`${c.combo}__${c.interaction}`)[pi];
          if (!el) continue;
          if (el.node.style[ch] !== el.node.style['color']) { holds = false; break; }
        }
        if (holds) { folds.push({ part, channel: ch, foldedInto: 'color', class: 'currentColor' }); continue; }
      // @door fuse.currentcolor-fold-candidate-missing
      } else if (/-color$/.test(ch) && receipts) {
        // TASK #35 census: a non-candidate `*-color` channel that equals the
        // part's own `color` on EVERY captured plane is a currentcolor mirror
        // the list does not know about. Measured, never assumed — a channel
        // that ever differs is a real fact and is not named here.
        let mirrors = true;
        let seen = 0;
        for (const c of a.captures) {
          const el = a.getAligned(`${c.combo}__${c.interaction}`)[pi];
          if (!el || el.node.style[ch] === undefined) continue;
          seen++;
          if (el.node.style[ch] !== el.node.style['color']) { mirrors = false; break; }
        }
        if (mirrors && seen > 0) {
          (missingCandidates.get(ch) ?? missingCandidates.set(ch, new Set()).get(ch)!).add(part);
        }
      }
      // @door fuse.em-tracking-fold
      // @door fuse.font-size-never-folds
      if (ch === 'font-size') continue;
      // em-tracking: constant ratio to font-size across ALL captures, with
      // font-size actually varying (otherwise indistinguishable from a
      // uniform value — uniform minting is the honest classification).
      let ratio: number | null = null;
      let holds = true;
      const fontSizes = new Set<string>();
      for (const c of a.captures) {
        const el = a.getAligned(`${c.combo}__${c.interaction}`)[pi];
        if (!el) continue;
        const v = pxOf(el.node.style[ch]);
        const fs = pxOf(el.node.style['font-size']);
        if (v === null || fs === null || fs === 0) { holds = false; break; }
        fontSizes.add(el.node.style['font-size']);
        const r = Math.round((v / fs) * 10000) / 10000;
        if (ratio === null) ratio = r;
        else if (r !== ratio) { holds = false; break; }
      }
      // @door fuse.uniform-ratio-not-a-fold
      if (holds && ratio !== null && ratio !== 0 && fontSizes.size >= 2) {
        folds.push({ part, channel: ch, foldedInto: 'font-size', ratio, class: 'em-tracking' });
      }
    }
  }
  if (receipts && missingCandidates.size > 0) {
    for (const [ch, parts] of [...missingCandidates].sort()) {
      receipts.push(
        `currentcolor-fold-candidate-missing: ${ch} equals its part's own \`color\` on EVERY captured plane of ${[...parts].sort().join(', ')} — the signature of a \`currentcolor\`-initial channel — but it is NOT in CURRENTCOLOR_FOLD_CANDIDATES, so it passes the delta-from-control door as if it were an authored fact and MINTS. This is exactly how \`row-rule-color\` became 55% of all unhandled-channel misses (task #35). Either the list needs this channel or the channel is a genuine independent fact; it is named rather than left to accumulate.`,
      );
    }
  }
  return folds;
}

// ---------------------------------------------------------------------------
// HUG EVIDENCE (task #37): is a carried `max-width` a CEILING or a design
// width? The answer is a MEASUREMENT, not a list.
//
// The live-canvas defect: Carbon's Button carries `max-inline-size: 20rem`
// (320px) beside `inline-size: max-content`. The contract carries the
// max-width channel and — correctly — no width fact. The Figma emitter then
// baked the ROOT's max-width as a FIXED 320px width, and the root's own
// `justify: space-between` stranded the label at the left edge of a mostly
// empty box. The SAME button nested inside Modal's footer rendered at 125px
// — correct — because a non-root PART has bound Figma's real `maxWidth`
// field since the molecule round, which exempted roots by name.
//
// The discriminator, from the captured facts: an element whose USED width is
// STRICTLY BELOW its max-width is hugging beneath a ceiling; an element
// whose used width EQUALS its max-width is sitting at its cap, where the
// value may be a genuine design width and the old lowering is right.
//
// Deliberately conservative. Evidence is emitted ONLY when every enumerated
// combo agrees and both values are real pixels; `none`, percentages and
// calc() max-widths, and combos that disagree, produce a NAMED receipt and
// no field — so the contract keeps the design-width lowering. That is also
// why the repo's 21 hand-authored `{size.card.width}` roots are untouched:
// they carry no measurement at all.
// ---------------------------------------------------------------------------
const pxValue = (v: string | undefined): number | null => {
  if (typeof v !== 'string') return null;
  const m = /^(-?[\d.]+)px$/.exec(v.trim());
  return m ? Number(m[1]) : null;
};

export interface HugEvidence {
  /** part → true when the used width stayed strictly below max-width in
   *  EVERY enumerated combo. Absent from the map = no evidence (see
   *  `receipts`), and the consumer must keep the design-width lowering. */
  hugs: Map<string, boolean>;
  receipts: string[];
}

/** DETECTION ONLY (pure). Reads the captured computed `width` / `max-width`
 *  of every union part across the enabled combos. */
export function hugEvidence(a: AlignedSweep, space: PropSpace): HugEvidence {
  const out: HugEvidence = { hugs: new Map(), receipts: [] };
  const enabled = space.enumeration.combos.filter(isEnabled);
  for (let pi = 0; pi < a.baseFlat.length; pi++) {
    const partName = a.partNames[pi];
    const verdicts = new Set<boolean>();
    const unmeasurable = new Set<string>();
    let seen = 0;
    for (const combo of enabled) {
      const el = a.getAligned(`${combo.key}__default`)[pi];
      if (!el) continue;
      const maxRaw = el.node.style['max-width'];
      // @door fuse.no-max-width-no-question
      if (maxRaw === undefined || maxRaw === 'none') continue;
      seen++;
      const max = pxValue(maxRaw);
      const width = pxValue(el.node.style['width']);
      // @door fuse.hug-evidence-unmeasurable
      if (max === null || width === null) {
        unmeasurable.add(maxRaw);
        continue;
      }
      verdicts.add(width < max);
    }
    if (seen === 0) continue;
    if (unmeasurable.size > 0) {
      out.receipts.push(
        `hug-evidence-unmeasurable: ${partName}.max-width = ${[...unmeasurable].sort().join(' / ')} — not a pixel value, so "is the used width below the cap" cannot be asked. No sizing evidence carried; the max-width lowering is unchanged.`,
      );
      continue;
    }
    // @door fuse.hug-evidence-not-uniform
    if (verdicts.size !== 1) {
      out.receipts.push(
        `hug-evidence-not-uniform: ${partName} hugs beneath its max-width in some combos and sits at the cap in others — no sizing evidence carried (the max-width lowering is unchanged).`,
      );
      continue;
    }
    out.hugs.set(partName, [...verdicts][0]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// LAYOUT enrichment: computed flex keywords → the contract's OWN layout
// vocabulary (Part.layout). These channels are keyword-valued, so they can
// never mint — but the schema already has slots for them. Uniform observed
// values enrich absent slots; a carried slot that CONTRADICTS the computed
// truth becomes a named receipt (never silently overridden — the reviewed
// static layer wins values, the floor wins truth).
// ---------------------------------------------------------------------------
const LAYOUT_CHANNEL_TO_FIELD: Record<string, { field: 'display' | 'direction' | 'align' | 'justify'; map: Record<string, string> }> = {
  display: { field: 'display', map: { flex: 'flex', 'inline-flex': 'inline-flex' } },
  'flex-direction': { field: 'direction', map: { row: 'row', column: 'column' } },
  'align-items': { field: 'align', map: { 'flex-start': 'start', center: 'center', 'flex-end': 'end', stretch: 'stretch' } },
  'justify-content': { field: 'justify', map: { 'flex-start': 'start', center: 'center', 'flex-end': 'end', 'space-between': 'space-between' } },
};

export interface LayoutEnrichment {
  /** per part: layout channels consumed here (excluded from minting). */
  handled: Map<string, Set<string>>;
  enriched: Array<{ part: string; field: string; value: string | boolean }>;
  contradictions: Array<{ part: string; field: string; carried: string; observed: string }>;
  receipts: string[];
}

/** DETECTION ONLY (pure): reads the STATIC contract's layout slots; the
 *  enrichments are applied to the enriched clone by applyMintToContract. */
export function enrichLayout(
  a: AlignedSweep,
  space: PropSpace,
  styled: Map<string, Set<string>>,
  contract: Contract = space.contract,
): LayoutEnrichment {
  const staticParts = new Map(walkAnatomy(contract).map((w) => [w.name, w.part] as const));
  const out: LayoutEnrichment = { handled: new Map(), enriched: [], contradictions: [], receipts: [] };
  const enabled = space.enumeration.combos.filter(isEnabled);
  for (let pi = 0; pi < a.baseFlat.length; pi++) {
    const partName = a.partNames[pi];
    const target = staticParts.get(partName);
    const channels = styled.get(partName);
    // @door fuse.static-part-required-for-enrichment
    if (!target || !channels) continue;
    // only flex containers speak the layout vocabulary
    // @door fuse.flex-container-only-speaks-layout
    const baseDisplay = a.baseFlat[pi].node.style['display'];
    if (baseDisplay !== 'flex' && baseDisplay !== 'inline-flex') continue;
    for (const [channel, spec] of Object.entries(LAYOUT_CHANNEL_TO_FIELD)) {
      if (!channels.has(channel)) continue;
      const values = new Set<string>();
      for (const combo of enabled) {
        const el = a.getAligned(`${combo.key}__default`)[pi];
        if (el) values.add(el.node.style[channel]);
      }
      // @door fuse.layout-not-uniform
      if (values.size !== 1) {
        out.receipts.push(`layout-not-uniform: ${partName}.${channel} varies across combos — stays code-only`);
        continue;
      }
      const observed = [...values][0];
      const canonical = spec.map[observed];
      const handledSet = out.handled.get(partName) ?? new Set<string>();
      out.handled.set(partName, handledSet);
      // @door fuse.reviewed-layout-wins-contradiction
      const carried = target.layout?.[spec.field];
      if (carried !== undefined) {
        handledSet.add(channel);
        if (canonical !== carried) {
          out.contradictions.push({ part: partName, field: spec.field, carried: String(carried), observed });
        }
        continue;
      }
      // @door fuse.layout-value-outside-vocabulary
      if (canonical === undefined) {
        out.receipts.push(`layout-value-outside-vocabulary: ${partName}.${channel} = "${observed}" — stays code-only`);
        continue;
      }
      handledSet.add(channel);
      out.enriched.push({ part: partName, field: spec.field, value: canonical });
    }
  }
  // ANTD EXAM (heal loop, 2026-08-23) — GROW IS A LAYOUT FACT, NOT A TOKEN.
  // A flex child with `flex-grow ≥ 1` minted a `flex-grow` token the canvas
  // annotates and never draws (antd's Progress track: `flex: 1` inside the
  // inline-flex outer drew a 0-wide track; the 40% fill had nothing to
  // measure against). `layout.grow` is the schema's own spelling and the
  // canvas lowers it to layoutGrow / FILL, so a uniform flex-grow ≥ 1 on a
  // child of a flex container carries there. The second door is the root:
  // a NON-block root (inline-block — antd's Progress line, Input) is lowered
  // as a hugging row, so a child that MEASURES the root's content width in
  // every combo (the outer track's `width: 100%`) would hug to nothing —
  // it fills, and says so.
  const parentOf = (pi: number): number => {
    const path = a.baseFlat[pi].path;
    if (path === '') return -1;
    const pp = path.includes('.') ? path.slice(0, path.lastIndexOf('.')) : '';
    return a.baseFlat.findIndex((e) => e.path === pp);
  };
  const num = (v: string | undefined): number => (v === undefined ? 0 : (parseFloat(v) || 0));
  // @door fuse.layout-grow-carried
  for (let pi = 0; pi < a.baseFlat.length; pi++) {
    const partName = a.partNames[pi];
    const target = staticParts.get(partName);
    // @door fuse.grow-door-skips
    if (!target || target.layout?.grow !== undefined) continue;
    const ppi = parentOf(pi);
    if (ppi < 0) continue;
    const parentDisplay = a.baseFlat[ppi].node.style['display'];
    const childDisplay = a.baseFlat[pi].node.style['display'];
    if (childDisplay === 'none' || a.baseFlat[pi].node.style['position'] === 'absolute') continue;
    let reason: string | null = null;
    if (parentDisplay === 'flex' || parentDisplay === 'inline-flex') {
      const dir = a.baseFlat[ppi].node.style['flex-direction'] ?? 'row';
      if (!dir.startsWith('row')) continue;
      let grows = true;
      for (const combo of enabled) {
        const el = a.getAligned(`${combo.key}__default`)[pi];
        if (!el) continue;
        if (num(el.node.style['flex-grow']) < 1) { grows = false; break; }
      }
      if (grows) reason = `flex-grow ${a.baseFlat[pi].node.style['flex-grow']} in a flex row parent (${a.partNames[ppi]})`;
    } else if (ppi === a.baseFlat.findIndex((e) => e.path === '') && parentDisplay !== 'block' && parentDisplay !== 'flex' && parentDisplay !== 'inline-flex' && parentDisplay !== 'grid') {
      let fills = true;
      for (const combo of enabled) {
        const els = a.getAligned(`${combo.key}__default`);
        const el = els[pi]; const par = els[ppi];
        if (!el || !par) continue;
        const ps = par.node.style;
        const content = num(ps['width']) - num(ps['padding-left']) - num(ps['padding-right']) - num(ps['border-left-width']) - num(ps['border-right-width']);
        if (Math.abs(content - num(el.node.style['width'])) > 0.6 || content <= 0) { fills = false; break; }
      }
      if (fills) reason = `measures the ${parentDisplay} root's content box in every enabled combo (width ${a.baseFlat[pi].node.style['width']}) — a hugging row would give it no width`;
    }
    if (!reason) continue;
    out.enriched.push({ part: partName, field: 'grow', value: true });
    out.receipts.push(`layout-grow-carried: ${partName} — ${reason}; carried as layout.grow (the canvas FILL / layoutGrow twin)`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// BOUND (§5.1): the static layer's carried bindings, browser-probed to
// canonical values, confirmed or contradicted per combo.
// ---------------------------------------------------------------------------
export interface BoundRow {
  combo: string;
  part: string;
  channel: string;
  ref: string;
  computedProp: string;
  expected: string;
  observed: string;
  verdict: 'confirmed' | 'contradiction' | 'part-absent';
  cause?: string;
}

/** Substitution map for one combo: every enum prop at its default, overridden
 *  by the combo's axis values (unset pseudo-values contribute NOTHING — the
 *  defaultless-enum rule the schema resolver implements). */
export function substFor(space: PropSpace, combo: Combo): Record<string, string> {
  const subst: Record<string, string> = {};
  for (const p of space.contract.props) {
    if (typeof p.type === 'object' && 'enum' in p.type && p.default !== undefined) {
      subst[p.name] = String(p.default);
    }
  }
  for (const a of space.axes) {
    const v = combo.axisValues[a.prop];
    if (a.unset !== undefined && v === a.unset) continue;
    subst[a.prop] = v;
  }
  return subst;
}

export async function boundCheck(
  a: AlignedSweep,
  comp: ComponentConfig,
  space: PropSpace,
  probeToken: (ref: string, computedProp: string) => Promise<string>,
  contract: Contract = space.contract,
): Promise<{ rows: BoundRow[]; untriaged: BoundRow[] }> {
  const partByName = new Map(walkAnatomy(contract).map((w) => [w.name, w.part] as const));
  const rows: BoundRow[] = [];
  for (const combo of space.enumeration.combos) {
    if (!isEnabled(combo)) continue; // state-prop planes are states, not bases
    const subst = substFor(space, combo);
    const alignedEls = a.getAligned(`${combo.key}__default`);
    for (let pi = 0; pi < a.baseFlat.length; pi++) {
      // @door fuse.static-part-not-in-union
      const cPart = partByName.get(a.partNames[pi]);
      if (!cPart) continue;
      const carried = resolveTokens(cPart, subst);
      const el = alignedEls[pi];
      for (const [channel, ref] of Object.entries(carried)) {
        // @door fuse.channel-not-in-computed-registry
        const computedProps = CHANNEL_TO_COMPUTED[channel];
        if (!computedProps) continue;
        for (const cp of computedProps) {
          // @door fuse.part-absent-not-contradiction
          if (!el) {
            // Round 4: a presence-gated part legitimately absent in this
            // combo — the binding is untestable there, NOT contradicted.
            rows.push({ combo: combo.key, part: a.partNames[pi], channel, ref, computedProp: cp, expected: '', observed: '', verdict: 'part-absent' });
            continue;
          }
          const expected = await probeToken(ref, cp);
          const observed = el.node.style[cp];
          rows.push({
            combo: combo.key, part: a.partNames[pi], channel, ref, computedProp: cp,
            expected, observed,
            verdict: expected === observed ? 'confirmed' : 'contradiction',
          });
        }
      }
    }
  }
  // Named-cause triage from config (the verify.ts curation discipline).
  // part-absent rows are informational (presence-gated parts).
  // @door fuse.triage-named-cause
  const contradicted = rows.filter((r) => r.verdict === 'contradiction');
  for (const r of contradicted) {
    const axisValues: Record<string, string> = {};
    space.axes.forEach((ax, i) => { axisValues[ax.prop] = r.combo.split('.')[i]; });
    for (const rule of comp.triage ?? []) {
      if (rule.part !== r.part || !rule.channels.includes(r.channel)) continue;
      const when = rule.when ?? {};
      const ok = Object.entries(when).every(([axis, cond]) => {
        const v = axisValues[axis];
        if (cond.in && !cond.in.includes(v)) return false;
        if (cond.notIn && cond.notIn.includes(v)) return false;
        return true;
      });
      if (ok) { r.cause = rule.cause; break; }
    }
  }
  return { rows, untriaged: contradicted.filter((r) => !r.cause) };
}

/** Channels the contract carries for a part (any combo/state) — BOUND
 *  territory; the mint pass never re-mints them.
 *
 *  DEFECT FIXED (2026-08-23, docs/23 §D.33). The tokens / per-prop / literals /
 *  states branches mapped each channel through CHANNEL_TO_COMPUTED with
 *  `?? []`, so a channel that registry does not spell — `width`, `height`
 *  and every other bounded channel whose computed longhand IS its own name —
 *  was silently NOT in this set: the door said "never re-mints" and
 *  re-minted. First measured on polaris Tag's `link` part, a display:grid
 *  part whose G8 definite-axis pass (anatomy.ts gridDefiniteAxisLiterals,
 *  which runs BEFORE the mint) states `literals.width = "fit-content"`; the
 *  mint then minted `tokens.width = {imported.shared.size-59-9219}` beside it
 *  and validateContract refused the double spelling by name (the 2026-08-23
 *  drift re-measure's one REFUSED row). The `declared` branch below already
 *  fell back to the channel's own name; every branch does now, so a channel
 *  the promotion has stated — whichever field states it — is one carrier.
 *  The same hole let a root `width`/`height` carried by a REVIEWED
 *  literalsByProp entry (polaris avatar/progressbar/thumbnail, per size)
 *  mint per-size leaves that the tokensByProp merge then kept out of the
 *  contract ("conflict avoided") — orphan leaves in the minted tree. Those
 *  are no longer minted; the contracts are byte-identical either way. */
export function carriedChannels(part: Part | undefined): Set<string> {
  const out = new Set<string>();
  if (!part) return out;
  const addAll = (rec?: Record<string, string>) => {
    for (const ch of Object.keys(rec ?? {})) for (const cp of CHANNEL_TO_COMPUTED[ch] ?? [ch]) out.add(cp);
  };
  addAll(part.tokens);
  for (const e of tokensByPropEntries(part)) for (const m of Object.values(e.map)) addAll(m);
  addAll(part.literals);
  for (const e of part.literalsByProp ?? []) for (const m of Object.values(e.map)) addAll(m);
  for (const m of Object.values(part.states ?? {})) addAll(m);
  addAll(resolveLiterals(part, {}));
  // v15 declared facts: declared channels ARE computed longhands — a part
  // already carrying one never re-detects it.
  for (const ch of Object.keys(part.declared ?? {})) {
    for (const cp of CHANNEL_TO_COMPUTED[ch] ?? [ch]) out.add(cp);
  }
  for (const m of Object.values(part.declaredStates ?? {})) {
    for (const ch of Object.keys(m)) for (const cp of CHANNEL_TO_COMPUTED[ch] ?? [ch]) out.add(cp);
  }
  // A2 grid: a STRUCTURED grid part carries these computed longhands through
  // layout.rows/columns/gap/areas (the pinned G6 CSS spellings) and a placed
  // child carries its lines/aligns through Part.placement — the mint pass
  // must neither re-mint them as tokens nor name them as residue. Gated on
  // display === "grid" so no committed flex-library artifact moves a byte.
  if (part.layout?.display === 'grid') {
    for (const ch of ['display', 'grid-template-rows', 'grid-template-columns', 'grid-template-areas', 'grid-auto-flow', 'row-gap', 'column-gap']) out.add(ch);
  }
  if (part.placement) {
    for (const ch of ['grid-row-start', 'grid-row-end', 'grid-column-start', 'grid-column-end', 'justify-self', 'align-self']) out.add(ch);
  }
  return out;
}

// ---------------------------------------------------------------------------
// MINT observations (§5.2): base + state deltas
// ---------------------------------------------------------------------------
export interface CodeOnlyEntry {
  part: string;
  channel: string;
  reason: string;
  sample: string;
  distinctValues?: number;
  state?: string;
}

/** v15 declared facts detected by fusion: a uniform unmintable value on a
 *  registry channel is a FACT the schema now carries, not extension residue. */
export interface DeclaredEnrichment {
  part: string;
  channel: string;
  value: string;
  /** ANTD EXAM (heal loop): a declared-registry value that is a function of
   *  exactly ONE enum axis carries as a per-value `stylesWhen` rule instead
   *  of refusing (border-*-style only today — antd's dashed Button type). */
  when?: { prop: string; equals: string };
}
export interface DeclaredStateEnrichment extends DeclaredEnrichment {
  state: string;
}

export interface MintPrep {
  axes: MintAxis[];
  baseObs: MintObservation[];
  stateObs: MintObservation[];
  codeOnly: CodeOnlyEntry[];
  stateCodeOnly: CodeOnlyEntry[];
  /** v15: uniform declared facts (base plane) → Part.declared. */
  declared: DeclaredEnrichment[];
  /** v15: full-coverage uniform declared state deltas → Part.declaredStates. */
  declaredStates: DeclaredStateEnrichment[];
  inertOnDisabled: string[];
  /** SILENT-LOSS ROUND: parts observed on an INTERACTION plane but absent from
   *  that combo's DEFAULT plane. The base pass refuses their channels as
   *  "interaction-only — state rounds own it"; this is the state round, and it
   *  has no default-plane counterpart to diff against, so nothing is carried.
   *  Named here so the base receipt stops pointing at a door that drops them. */
  planeAbsentDrops: string[];
  pairwiseRefusals: string[];
  /** ORPHAN-LEAF ROUND (task #42) — one named line per union part the anatomy
   *  promotion refused, with the styled-channel count that therefore did NOT
   *  mint. The COUNT is the receipt: "0 orphan refusals" and "the door is not
   *  wired" must not look the same. */
  orphanRefusals: string[];
  /** leaf-count comparison: mint run WITHOUT the folding pass. */
  unfoldedLeafCount: number;
  foldedStateSkips: string[];
  /** Round 5c: carried channels re-minted because a DEFAULTLESS axis
   *  contests their values (the Button tone×variant paint class). */
  remintReceipts: string[];
  /** Round 5c: set-plane literals for UNMINTABLE-KIND geometry channels
   *  (min-height auto→24px) — the refused-mint set planes are computed in
   *  applyMintToContract from the observations themselves. */
  setPlaneLiterals: SetPlaneLiteral[];
  /** INHERITANCE-AWARE REFUSAL (this round) — `part|channel` keys for which
   *  the CAPTURE proves the part carries no independent fact: an INHERITED
   *  channel whose value equals its nearest captured ancestor's on EVERY
   *  captured plane (base and every interaction/state plane), where that
   *  ancestor itself carries the channel. A MEASURED fact, not a policy —
   *  applyMintToContract decides what to do with it. */
  inheritanceOnly: string[];
  /** `part|channel` keys (non-root) on which SOME state delta was OBSERVED —
   *  whatever became of it. The mint's own bindings are not a sufficient
   *  signal here: a delta can be dropped BEFORE minting (padding-incompatible
   *  coverage → stateCodeOnly), and polaris Button's `icon` is exactly that
   *  case, so reading only mintStates would have missed half the defect. */
  inheritanceStateDeltas: string[];
  /** Human-readable receipts for the entries above (and for the near-misses
   *  that were checked and REJECTED, so the check's reach is legible). */
  inheritanceReceipts: string[];
}

/** Box-geometry channels with no inheritance to lean on — the base-plane
 *  literal fallback set (round 4), module-scoped in round 5c so the
 *  SET-PLANE literal carriage shares it. */
export const BASE_FALLBACK_CHANNELS = new Set([
  'padding-left', 'padding-right', 'padding-top', 'padding-bottom',
  'padding-block', 'padding-inline', 'gap',
  'height', 'width', 'min-width', 'min-height',
  'border-radius', 'border-width',
  'border-top-left-radius', 'border-top-right-radius',
  'border-bottom-left-radius', 'border-bottom-right-radius',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
]);

/** CSS-INHERITED channels, restricted to the mintable kinds (color/px/number).
 *  The complement of BASE_FALLBACK_CHANNELS's premise: these channels DO have
 *  inheritance to lean on, so a child that is absent renders its ancestor's
 *  value — which is why round 4 already refuses a base-plane LITERAL here
 *  ("inherited channels are usually RIGHT via CSS inheritance when absent — a
 *  base literal would break that (Button's primary label went dark)").
 *  The membership is the CSS specification's, not a threshold: `color`,
 *  `fill`/`stroke` (SVG paint), and the text metrics all inherit. */
export const INHERITED_CHANNELS = new Set([
  'color', 'fill', 'stroke', 'caret-color',
  'font-size', 'font-weight', 'letter-spacing', 'line-height', 'word-spacing',
  'text-indent', 'stroke-width', 'fill-opacity', 'stroke-opacity',
]);

/** Nested (non-root) `Part.states` vocabulary — v13 carries PLAIN color-kind
 *  refs only. ONE implementation: the state-binding placer below refuses by
 *  it, and the inheritance-aware base refusal reads the same predicate to
 *  learn which nested state deltas will go uncarried. Two spellings of this
 *  rule is how the base door and the state door drifted apart in the first
 *  place (the regression this comment's round repairs). */
export const nestedStateCarriable = (channel: string, placeholders: string[]): boolean =>
  ['color', 'background-color', 'border-color'].includes(channel) && placeholders.length === 0;

/** Round 5c — SET-PLANE LITERALS: a geometry channel the mint refuses (or
 *  cannot kind — min-height auto→24px) still has EXACT per-plane truth on a
 *  DEFAULTLESS axis when, within one set value's presence-off slice, the
 *  captured value is uniform (Tag size=large: padding 8px, min-height 24px;
 *  the refusal came from presence-axis entanglement the boolean vocabulary
 *  cannot spell — those planes stay named residue). Carried as
 *  literalsByProp entries; the base plane keeps the round-4 base literal. */
export interface SetPlaneLiteral {
  part: string;
  channel: string;
  cands: Array<{ prop: string; value: string; lit: string }>;
}

export function setPlaneCandidates(
  rows: Array<{ axisValues: Record<string, string>; value: string }>,
  space: PropSpace,
): Array<{ prop: string; value: string; lit: string }> {
  const out: Array<{ prop: string; value: string; lit: string }> = [];
  // @door fuse.set-plane-candidate-skips
  const presenceOff = (r: { axisValues: Record<string, string> }) =>
    [...space.presence.keys()].every((pp) => (r.axisValues[pp] ?? PRESENCE_OFF) === PRESENCE_OFF);
  for (const ax of space.axes.filter((a) => a.unset !== undefined)) {
    const baseVals = new Set(
      rows.filter((r) => presenceOff(r) && r.axisValues[ax.prop] === ax.unset).map((r) => r.value),
    );
    for (const v of ax.values) {
      if (v === ax.unset) continue;
      const slice = rows.filter((r) => presenceOff(r) && r.axisValues[ax.prop] === v);
      if (slice.length === 0) continue;
      const vals = new Set(slice.map((r) => r.value));
      if (vals.size !== 1) continue;
      const lit = [...vals][0];
      if (!LITERAL_VALUE_RE.test(lit)) continue;
      if (baseVals.size === 1 && [...baseVals][0] === lit) continue; // redundant with the base plane
      out.push({ prop: ax.prop, value: v, lit });
    }
  }
  return out;
}

/** ONE spelling of the closed state vocabulary, shared with the contract
 *  schema and the capture-config referee (state-plane projection round). */
const STATE_SUFFIXES = CONTRACT_STATES;
export const stateOfMintProperty = (cssProperty: string): { channel: string; state: string } | null => {
  for (const s of STATE_SUFFIXES) {
    const suffix = `-state-${s}`;
    if (cssProperty.endsWith(suffix)) return { channel: cssProperty.slice(0, -suffix.length), state: s };
  }
  return null;
};

/** The tags the harness renders a CONTROL for (capture.ts CONTROL_TAGS).
 *
 *  DUPLICATED DELIBERATELY, AND GATED. fuse.ts must not import capture.ts —
 *  capture.ts pulls playwright and node:fs, and fusion runs offline over
 *  committed truth (regate, the eval lane, every check in this directory). So
 *  the list is restated here and `npm run ua-baseline:check` asserts the two
 *  are identical, because an undetected divergence would silently change which
 *  refusals get the fallback qualifier below. */
export const CONTROL_TAGS_MIRROR = new Set(['button', 'span', 'a', 'div']);

/** A BORDER THAT PAINTS ONLY BECAUSE THE LIBRARY'S GLOBAL CSS SUPPLIES THE STYLE.
 *
 *  The styled-channel door asks "does this differ from the control?", and the
 *  control is rendered INSIDE the harness with the library's own stylesheet
 *  loaded. That is the right question — it subtracts the user agent's defaults
 *  AND the library's reset, leaving what the COMPONENT authored. But the
 *  emitted CSS reproduces the component's rules and NOT the library's reset, so
 *  a fact the reset supplies is subtracted at capture and absent at emission.
 *  The round trip loses it.
 *
 *  MEASURED across the corpus, exactly two roots are in this shape:
 *    tailwind/card  <div>  border-top-width 1px, border-top-style solid,
 *                          control style ALSO solid (Tailwind preflight's
 *                          `* { border-style: solid }`), control width 0px
 *    astryx/card    <div>  the same shape
 *  and they are precisely the two components an earlier, cruder fix improved
 *  (astryx Card 98.601 → 100.000, tailwind Card 72.414 → 86.207) before it was
 *  reverted for regressing two others. Those two — altitude Chip and Button —
 *  are NOT in this class: their style DIFFERS from the control (`none` vs the
 *  button UA's `outset`), so `none` is already carried and their borders
 *  correctly paint nothing on both surfaces.
 *
 *  The condition is therefore narrow and all three clauses are load-bearing:
 *  the channel is a border-*-style, the same side carries a NON-ZERO width, the
 *  style is not `none`, and the control agrees (which is what proves the value
 *  came from the reset rather than from this component). Drop any one and the
 *  door either misses these two or re-admits the noise the control exists to
 *  remove. */
export const resetSuppliedBorderStyle = (
  channel: string,
  style: Record<string, string | undefined>,
  ctrl: Record<string, string | undefined>,
): boolean => {
  const m = /^border-(top|right|bottom|left)-style$/.exec(channel);
  if (!m) return false;
  const value = style[channel];
  if (!value || value === 'none') return false;
  if (ctrl[channel] !== value) return false; // it differs — the ordinary door already admits it
  const width = style[`border-${m[1]}-width`];
  return width !== undefined && width !== '0px' && width !== '0';
};

/** THE DOOR REGISTER (spec/DOOR-REGISTER.md) — evidence that the LIBRARY'S OWN
 *  stylesheet declares `channel` on this element, used to split the
 *  control-element delta door's silent subtraction into a risky half and a
 *  benign one.
 *
 *  The control-element delta (`fuse.control-element-delta`) drops every channel
 *  whose value EQUALS the bare control for that tag, on the premise that the
 *  value is the user agent's or the library's reset and the emitted DOM will
 *  inherit it for free. The premise fails whenever the library's GLOBAL CSS
 *  supplies the value — because the control is rendered inside the same page,
 *  with the same global CSS, so it carries the value too, while the emitted CSS
 *  reproduces the component's rules ONLY. That is exactly the shape of the two
 *  worst defects found on the corpus:
 *
 *    shadcn Input   `* { border-color: var(--border) }` puts oklch(0.922 0 0)
 *                   on the <span> fallback control as well as on the <input>,
 *                   so `border-top-color` compares EQUAL and is dropped while
 *                   `border-top-width: 1px` (0px on the control) ships — a 1px
 *                   border with no colour, i.e. an invisible input.
 *    polaris        the provider's `color` reaches the control by page
 *                   inheritance, so the component's ink compares EQUAL and is
 *                   dropped — inkless text on a surface with no provider.
 *
 *  The discriminator is the READER's own evidence, not a guess: `vrefs` records
 *  the (name, value, rule) of every longhand the library's stylesheet binds to
 *  a custom property on this element, and `vshorthands` records the same for a
 *  shorthand carrying `var()` that the longhand loop cannot see (capture.ts's
 *  shorthand ceiling — `border-color: var(--input)` is ONLY ever visible there).
 *  A channel with either is DECLARED BY THIS LIBRARY on this element; equality
 *  with the control is then a coincidence of resolved values, not evidence of
 *  UA provenance.
 *
 *  This function does NOT change what is carried. It classifies the drop so the
 *  receipt can say which half of the census a given loss is in. */
export const librarySuppliedChannel = (
  node: { vrefs?: Record<string, ReadonlyArray<readonly [string, string, string] | readonly [string, string, string, 1]>>; vshorthands?: Record<string, string[]> },
  channel: string,
): string | null => {
  const ref = node.vrefs?.[channel];
  if (ref && ref.length > 0) return `${ref[0][0]} at \`${ref[0][2]}\``;
  const sh = node.vshorthands;
  if (!sh) return null;
  for (const cand of [channel, ...shorthandsOf(channel)]) {
    const names = sh[cand];
    if (names && names.length > 0) return `${names.join('/')} via the \`${cand}\` shorthand`;
  }
  return null;
};

/** The shorthands a stylesheet could have used to set `longhand`. Bounded and
 *  mechanical — a shorthand this list omits reads as "not declared", which is
 *  the conservative direction for a census that measures a LOSS. */
export const shorthandsOf = (longhand: string): string[] => {
  const side = /^border-(top|right|bottom|left)-(color|width|style)$/.exec(longhand);
  if (side) return [`border-${side[2]}`, `border-${side[1]}`, 'border'];
  if (/^border-(top|bottom)-(left|right)-radius$/.test(longhand)) return ['border-radius'];
  if (/^(margin|padding)-(top|right|bottom|left)$/.test(longhand)) return [longhand.split('-')[0]];
  if (/^outline-(color|width|style)$/.test(longhand)) return ['outline'];
  if (/^font-(size|family|weight|style|variant)$/.test(longhand)) return ['font'];
  if (/^background-/.test(longhand)) return ['background'];
  if (/^flex-(grow|shrink|basis)$/.test(longhand)) return ['flex'];
  if (/^text-decoration-/.test(longhand)) return ['text-decoration'];
  if (/^(row|column)-gap$/.test(longhand)) return ['gap'];
  if (/^transition-/.test(longhand)) return ['transition'];
  if (/^animation-/.test(longhand)) return ['animation'];
  return [];
};

export function prepareMint(
  a: AlignedSweep,
  comp: ComponentConfig,
  space: PropSpace,
  styled: Map<string, Set<string>>,
  folds: FoldReceipt[],
  layoutHandled?: Map<string, Set<string>>,
  contract: Contract = space.contract,
  /** Union part names whose channels are consumed by promoted svg assets. */
  svgConsumedParts?: Set<string>,
  /** ORPHAN-LEAF ROUND (task #42) — the union part names the anatomy promotion
   *  actually CARRIED (`PromotionResult.partIndex` keys). Omitted ⇒ the door
   *  is derived from `contract` itself, which is the same set whenever the
   *  caller passes the PROMOTED contract (both callers do). */
  promotedParts?: Set<string>,
  /** A2 grid — `part|channel` → named reason (PromotionResult
   *  .gridMintRefusals): channels the mint pass REFUSES BY NAME instead of
   *  minting — flex-grow on grid children (grid-child-grow, P4) and the
   *  placement longhands of children whose parent grid was not promoted
   *  (grid-implicit-tracks etc., P9). The refusal lands in codeOnly so the
   *  ledger/extension carry the name; a dead fact never rides as a token. */
  gridMintRefusals?: Map<string, string>,
): MintPrep {
  const axes: MintAxis[] = space.axes.map((ax) => ({ propName: ax.prop, values: [...ax.values] }));
  const partByName = new Map(walkAnatomy(contract).map((w) => [w.name, w.part] as const));
  const foldedSet = new Set(folds.map((f) => `${f.part}|${f.channel}`));
  const enabledCombos = space.enumeration.combos.filter(isEnabled);

  // @door fuse.declarable-part-gate
  const declarablePart = (partName: string): Part | undefined => {
    const p = partByName.get(partName);
    if (!p || p.component || p.slot) return undefined; // ref/slot parts never carry declared facts
    return p;
  };

  // ═══ ORPHAN-LEAF ROUND (task #42) — THE PROMOTION REFUSAL NOW RUNS AT THE
  // MINT DOOR, NOT ONLY AT THE ANATOMY DOOR.
  //
  // `promoteAnatomy` already refuses parts BY NAME (`non-painting-part`,
  // `inert-overlay-wrapper`, `pseudo-decor-hidden-in-combo`,
  // `static-part-unrendered`, …) and the refused part is absent from the
  // promoted contract. But every loop below iterated `a.baseFlat` — the UNION
  // anatomy — so a refused part's channels went on minting exactly as if it
  // existed. The leaves landed in `extension.mintedTokens`, `promote` merged
  // them into the shipped `*-minted.dtcg.json`, and `figma bundle` shipped
  // them as real Figma variables that NOTHING references. Measured before this
  // door: carbon/IconButton minted 112 leaves under three refused parts
  // (`popover`, `label`, `popover-caret`); 224 such leaves corpus-wide.
  //
  // A leaf that exists because of a part that does not is the same class of
  // lie as the phantom part itself — so it is refused at the SAME door, by the
  // SAME decision, rather than swept up afterwards. Refusing here (instead of
  // post-mint) also means the refusal is a fact of fusion the receipts can
  // name per part+channel, not an anonymous count of deleted rows.
  // @door fuse.orphan-mint-refused
  const refusedByPromotion = new Set<string>();
  const orphanRefusals: string[] = [];
  {
    const carried = promotedParts ?? new Set(partByName.keys());
    const counts = new Map<string, number>();
    for (let pi = 0; pi < a.baseFlat.length; pi++) {
      const partName = a.partNames[pi];
      if (carried.has(partName)) continue;
      // @door fuse.svg-consumed-part-skip
      if (svgConsumedParts?.has(partName)) continue; // already named by the svg-asset door
      refusedByPromotion.add(partName);
      counts.set(partName, (styled.get(partName) ?? new Set()).size);
    }
    for (const [partName, n] of [...counts].sort()) {
      orphanRefusals.push(
        `orphan-mint-refused: ${partName} was REFUSED by the anatomy promotion (it is not a part of the promoted contract), so its ${n} styled channel(s) do not mint — before this door they minted leaves the contract could never reference, and \`figma bundle\` shipped them as Figma variables nothing binds (task #42). The named promotion refusal is in anatomyPromotion.refusals.`,
      );
    }
  }
  /** Union part names that may reach the mint: carried by the promotion AND
   *  not consumed by a promoted svg asset. */
  const mintablePart = (partName: string): boolean =>
    !refusedByPromotion.has(partName) && !svgConsumedParts?.has(partName);

  // Round 5c — CARRIED-CHANNEL RE-MINT on a defaultless-axis contest (the
  // Button tone×variant paint refusal): a channel the reviewed static layer
  // carries (per-variant tokensByProp) is BOUND territory, so the mint pass
  // skipped it — but when the observed values ALSO vary along a DEFAULTLESS
  // axis (tone), the reviewed carriage explains only the unset plane; the
  // set planes were silently absent (40 Primary cells at ~91% on the canvas
  // gate). Such channels re-mint: the S2 pair-with-unset carriage lands the
  // tone maps as tokensByProp entries with the unset plane as base, and the
  // applyMintToContract conflict rule keeps every reviewed binding (reviewed
  // same-prop channels are never re-added). Receipted by name.
  const unsetAxisNames = space.axes.filter((ax) => ax.unset !== undefined).map((ax) => ax.prop);
  const remintReceipts: string[] = [];
  const setPlaneLiterals: SetPlaneLiteral[] = [];
  const contestedByUnsetAxis = (pi: number, channel: string): string | null => {
    for (const axName of unsetAxisNames) {
      const groups = new Map<string, Set<string>>();
      for (const combo of enabledCombos) {
        const el = a.getAligned(`${combo.key}__default`)[pi];
        if (!el) continue;
        const ctx = JSON.stringify({ ...combo.axisValues, [axName]: '' });
        (groups.get(ctx) ?? groups.set(ctx, new Set()).get(ctx)!).add(el.node.style[channel]);
      }
      if ([...groups.values()].some((s) => s.size > 1)) return axName;
    }
    return null;
  };

  const pxOf = (val: string | undefined): number | null => {
    if (val === undefined) return null;
    const m = /^(-?[\d.]+)px$/.exec(val);
    return m ? parseFloat(m[1]) : null;
  };
  // ORGANISM round: the admitted table cells ride the SAME box-sizing-aware
  // outer baking (MUI's cells are content-box: 48px content + 4px padding is
  // a 52px canvas frame) — and their HEIGHT value is read from the ROW (a
  // cell's own computed height is its content height; see tableGeometry).
  const tableGeo = tableGeometry(a, space);
  const geomOuterParts = (() => {
    const { absAdmit, clusterAdmit } = absClusterParts(a, space);
    const out = new Set([...absAdmit, ...clusterAdmit]);
    // block-root width rides the same outer-size baking (box-sizing-aware)
    const rootPi = a.baseFlat.findIndex((e) => e.path === '');
    if (rootPi >= 0) out.add(rootPi);
    for (const pi of tableGeo.cellAdmit) out.add(pi);
    return out;
  })();
  const buildBaseObs = (skipFolds: boolean): { obs: MintObservation[]; codeOnly: CodeOnlyEntry[]; declared: DeclaredEnrichment[]; pairwiseRefusals: string[] } => {
    const obs: MintObservation[] = [];
    const codeOnly: CodeOnlyEntry[] = [];
    const declared: DeclaredEnrichment[] = [];
    const pairwiseRefusals: string[] = [];
    for (let pi = 0; pi < a.baseFlat.length; pi++) {
      const partName = a.partNames[pi];
      if (!mintablePart(partName)) continue; // svg internals (round 4) OR a part the promotion refused (task #42)
      const carried = carriedChannels(partByName.get(partName));
      for (const channel of [...(styled.get(partName) ?? [])].sort()) {
        if (carried.has(channel)) {
          const contestingAxis = contestedByUnsetAxis(pi, channel);
          if (contestingAxis === null) {
            // G8 (docs/23 §D.33): a grid part's definite axis that the
            // promotion already states as a literal (`fit-content` when the
            // used box equals the intrinsic track sum, else the used px) is
            // ONE fact. The computed used box the mint would have minted is
            // that literal's base-plane consequence, not a second fact; a
            // fixed token beside a hugging axis would pin the canvas to the
            // base plane's text width, and validateContract refuses the
            // double spelling by name. The literal wins; the not-minted px
            // is receipted here so the drop is greppable.
            // @door fuse.carried-axis-not-reminted
            const lit = partByName.get(partName)?.literals?.[channel];
            if (skipFolds && lit !== undefined && (channel === 'width' || channel === 'height')) {
              const base = a.getAligned(`${space.baseComboKey}__default`)[pi]?.node.style[channel];
              remintReceipts.push(
                `carried-axis-not-reminted: ${partName}.${channel} — the promotion states it as literals.${channel} ${JSON.stringify(lit)} (grid-axis-definite, G8); the computed ${base ?? '<unobserved>'} is that literal's base-plane used box, not a second fact, and is NOT minted beside it (one carrier per channel — validateContract refuses two)`,
              );
            }
            // @door fuse.bound-territory-never-reminted
            continue;
          }
          // @door fuse.carried-channel-reminted
          if (skipFolds) {
            remintReceipts.push(
              `carried-channel-reminted: ${partName}.${channel} — observed values vary along the defaultless axis "${contestingAxis}" while the reviewed carriage has no ${contestingAxis} plane; re-minted so the set planes carry (round 5c — S2 ${contestingAxis} maps with the unset base; reviewed bindings win every collision)`,
            );
          }
        }
        // @door fuse.layout-handled-skip
        if (layoutHandled?.get(partName)?.has(channel)) continue; // carried by Part.layout (enrichLayout)
        // @door fuse.folded-channel-skip
        if (skipFolds && foldedSet.has(`${partName}|${channel}`)) continue;
        const occurrences: MintObservation['occurrences'] = [];
        const rows: Array<{ axisValues: Record<string, string>; value: string }> = [];
        const values = new Set<string>();
        let unk: string | null = null;
        for (const combo of enabledCombos) {
          const el = a.getAligned(`${combo.key}__default`)[pi];
          if (!el) continue;
          let v = el.node.style[channel];
          // Absolute-position round: computed width/height are CONTENT-box
          // sizes; a canvas frame resize is the BORDER box. For the admitted
          // overlay-cluster geometry, bake padding+border into the minted
          // value so the variable carries the true canvas size (the slider
          // root: 4px content + 13px×2 padding = 30px frame).
          // @door fuse.outer-size-baking
          if ((channel === 'width' || channel === 'height') && geomOuterParts.has(pi) && el.node.style['box-sizing'] !== 'border-box') {
            // border-box parts already capture the outer size (Chromium's
            // computed geometry follows box-sizing — the Switch root read
            // 58px with its 12px paddings included; the content-box Slider
            // root read its bare 4px content height).
            const base = pxOf(v);
            if (base !== null) {
              const sides = channel === 'width' ? ['left', 'right'] : ['top', 'bottom'];
              let outer = base;
              for (const side of sides) {
                outer += pxOf(el.node.style[`padding-${side}`]) ?? 0;
                outer += pxOf(el.node.style[`border-${side}-width`]) ?? 0;
              }
              if (outer !== base) v = `${Math.round(outer * 1000) / 1000}px`;
            }
          }
          // ORGANISM round (Table): a cell's HEIGHT is its ROW's height. The
          // browser reports the cell's CONTENT height (30px inside a 63px
          // row) — carrying that would land the per-cell border-bottom
          // dividers at different y positions. Read from the row element in
          // the SAME combo; a row without a readable height leaves the cell's
          // own value (named through the unmintable path if it is unusable).
          if (channel === 'height' && tableGeo.cellAdmit.has(pi)) {
            const rowPi = tableGeo.rowOfCell.get(pi);
            const rowEl = rowPi === undefined ? null : a.getAligned(`${combo.key}__default`)[rowPi];
            const rh = rowEl ? outerPx(rowEl.node.style, 'height') : null;
            if (rh !== null) v = `${rh}px`;
          }
          // Tailwind round: rounded-full compiles to calc(infinity*1px);
          // Chromium clamps to 3.35544e+07px (scientific notation — outside
          // the px grammar). Any absurd radius IS the pill idiom — carried
          // as the 9999px pill sentinel (Figma clamps to half-box exactly
          // like the browser).
          // @door fuse.pill-radius-sentinel
          if (/^border-.*-radius$/.test(channel) && isAbsurdRadius(v)) {
            v = PILL_RADIUS_SENTINEL;
          }
          // Absolute-position round: %-radii on cluster parts resolve
          // against the part's own captured box (CSS: 50% of a 20px square
          // is the circle idiom) — baked to px so the mint carries them.
          // @door fuse.percent-radius-baked
          if (/^border-.*-radius$/.test(channel) && geomOuterParts.has(pi) && /^[\d.]+%$/.test(v ?? '')) {
            const pct = parseFloat(v);
            const w = pxOf(el.node.style['width']);
            const h = pxOf(el.node.style['height']);
            if (w !== null && h !== null) v = `${Math.round(((pct / 100) * Math.min(w, h)) * 1000) / 1000}px`;
          }
          // MUI round: a channel can be ABSENT on this part in some combos
          // (union-aligned parts that exist only under certain states).
          // `unk ??= undefined` is a no-op, so absence used to slip past the
          // unmintable guard and crash at kindOf — name it instead.
          // PSEUDO-DECOR v2 ROUND — ABSENT ≡ '0px' for the SYNTHETIC translate
          // channels. Under the generalized door a part is admitted because
          // SOME combo carries motion; the combos with no transform/translate
          // at all are AT REST, not unobserved. Without this identity the
          // pair would hit the missing-value guard below and the whole fact
          // would bail to unmintable — exactly what kept MUI Switch's checked
          // thumb from moving. The identity is only ever applied to channels
          // the door already admitted (SYNTHETIC_CHANNELS).
          // @door fuse.absent-synthetic-is-zero
          if (v === undefined && SYNTHETIC_CHANNELS.has(channel)) v = '0px';
          // @door fuse.channel-absent-in-combo
          if (v === undefined) { unk ??= '<channel absent in this combo>'; continue; }
          values.add(v);
          rows.push({ axisValues: combo.axisValues, value: v });
          const k = kindOf(channel, v);
          if (!k) { unk ??= v; continue; } // no break: declared detection needs the full value set
          occurrences.push({ variant: combo.key, axisValues: combo.axisValues, value: k.value });
        }
        // A2 grid — a channel the grid promotion refused BY NAME never mints,
        // whatever its value shape: flex-grow on a grid child is dead on both
        // surfaces (P4, grid-child-grow), and the placement longhands of a
        // grid the contract does not carry are P9's rewritten-declaration
        // facts (grid-implicit-tracks). The named reason lands in codeOnly
        // (ledger + extension), so the loss is greppable by its G7 name.
        // @door fuse.grid-mint-refusal
        {
          const gridReason = gridMintRefusals?.get(`${partName}|${channel}`);
          if (gridReason) {
            codeOnly.push({
              part: partName,
              channel,
              reason: gridReason,
              sample: [...values][0] ?? '<no default-state observation>',
              distinctValues: values.size,
            });
            continue;
          }
        }
        // @door fuse.zero-observation-part
        if (values.size === 0) {
          // MUI round: interaction-only union parts (-active, -focusVisible
          // thumbs) have NO element in any __default alignment — zero
          // observations is a named refusal, not a mintable base fact.
          // "state rounds own it" WAS FALSE. The state round diffs an
          // interaction plane against the DEFAULT plane, and a part with no
          // default-plane element fails that guard and is dropped there — so
          // this sentence sent every reviewer to a door that discards the fact.
          // Measured on carbon's `accordion__wrapper-2`: 10 channels refused
          // here, nothing carried anywhere, and the part ships with
          // `description` + `declared` only. The drop is now named at the state
          // round too (`planeAbsentDrops`), and this says what is true.
          codeOnly.push({ part: partName, channel, reason: 'part absent in every default-state combo — NOT carried at base, and NO combo plane (default or interaction) observes this part at all, so this channel is carried NOWHERE. It reached the anatomy from the BASE capture alone. (This used to read "interaction-only part — state rounds own it", which was false twice over: the part is not interaction-only, and the state round drops it too. See planeAbsentDrops.)', sample: '<no default-state observation>', distinctValues: 0 });
          continue;
        }
        if (unk !== null) {
          // Round 5c — set-plane literals for unmintable-kind geometry
          // channels (min-height 'auto' at base, '24px' on the set plane).
          // @door fuse.set-plane-literal-carried
          if (skipFolds && BASE_FALLBACK_CHANNELS.has(channel) && LITERAL_CHANNELS.has(channel)) {
            const cands = setPlaneCandidates(rows, space);
            if (cands.length > 0) {
              setPlaneLiterals.push({ part: partName, channel, cands });
              remintReceipts.push(
                `set-plane-literal-carried: ${partName}.${channel} — unmintable at base (${rows.find((r) => true)?.value ?? '?'} …) but uniform per defaultless-axis plane over the presence-off slice: ${cands.map((c) => `${c.prop}=${c.value} → ${c.lit}`).join(', ')} (presence planes stay named residue — round 5c)`,
              );
            }
          }
          // v15 declared facts: a registry channel whose observed value is
          // UNIFORM across combos and inside the channel's bounded grammar is
          // carried (Part.declared), not extension residue. Everything else
          // stays code-only with the refusal spelled out.
          // @door fuse.declared-uniform-admission
          const spec = DECLARED_CHANNELS[channel];
          const uniform = values.size === 1 ? [...values][0] : null;
          if (spec && uniform !== null && spec.value.test(uniform)) {
            if (declarablePart(partName)) {
              declared.push({ part: partName, channel, value: uniform });
            } else {
              codeOnly.push({ part: partName, channel, reason: 'declared channel on a computed-only (or ref/slot) part — adding parts is a curation decision, not a capture decision', sample: uniform, distinctValues: values.size });
            }
          // @door fuse.declared-value-outside-grammar
          } else if (spec && uniform !== null) {
            codeOnly.push({ part: partName, channel, reason: 'declared-channel value outside the bounded grammar — named residue (v15)', sample: uniform, distinctValues: values.size });
          // @door fuse.border-style-by-axis-carried
          } else if (spec && /^border-(top|right|bottom|left)-style$/.test(channel) && declarablePart(partName) && (() => {
            // ANTD EXAM (heal loop): factor the varying border style by ONE enum axis
            for (const ax of space.axes) {
              if (space.presence.has(ax.prop) || space.stateProps.some((sp) => sp.prop === ax.prop)) continue;
              const byVal = new Map<string, Set<string>>();
              for (const r of rows) { const av = r.axisValues[ax.prop]; if (av === undefined) { byVal.clear(); break; } (byVal.get(av) ?? byVal.set(av, new Set()).get(av)!).add(r.value); }
              if (byVal.size < 2 || [...byVal.values()].some((s) => s.size !== 1)) continue;
              if ([...byVal.values()].some((s) => !spec.value.test([...s][0]))) continue;
              for (const [av, s] of byVal) {
                const v = [...s][0];
                // @door fuse.border-style-solid-none-skip
                if (v === 'solid' || v === 'none') continue; // the emitters' standing stroke style; the zero-width side already draws nothing
                declared.push({ part: partName, channel, value: v, when: { prop: ax.prop, equals: av } });
              }
              remintReceipts.push(`border-style-by-axis-carried: ${partName}.${channel} varies by "${ax.prop}" (${[...byVal].map(([k, s]) => `${k}=${[...s][0]}`).join(', ')}) — carried as per-value stylesWhen rules (code: \`.${ax.prop}-<value> { ${channel}: … }\`; canvas: a dashPattern on that variant's stroke)`);
              return true;
            }
            return false;
          })()) {
            /* carried above as stylesWhen */
          // @door fuse.declared-varies-across-combos
          } else if (spec) {
            codeOnly.push({ part: partName, channel, reason: 'declared-channel value varies across combos — declared facts carry uniform values only (v15); named residue', sample: unk, distinctValues: values.size });
          // @door fuse.custom-property-not-a-channel-base
          } else if (channel.startsWith('--')) {
            // A CSS CUSTOM PROPERTY IS NOT A STYLED CHANNEL, and the generic
            // receipt was factually wrong about these. Measured over the
            // committed corpus: 14 of the 351 "no schema channel today"
            // refusals are custom properties, and the reason it gave —
            // "value shape outside mintable kinds (color/px/number/shadow/
            // gradient)" — is FALSE for most of them. `--cds-border-subtle`
            // is `#c6c6c6` (a colour) and `--tw-shadow` is
            // `0 4px 6px -1px rgb(0 0 0 / 0.1), …` (a shadow); both kinds are
            // mintable. What they are is the library's own TOKEN PLUMBING
            // observed on the element — Carbon's `--cds-*` are Carbon's design
            // tokens, already in its token system — not a styled fact of this
            // component. Counting them as losses says a fact was dropped when
            // nothing was, and blames a value shape that is perfectly mintable.
            codeOnly.push({ part: partName, channel, reason: `CSS custom property, not a styled channel — \`${channel}\` is a token DECLARATION the library sets on this element, not a rendered fact of the component. Its value may well be mintable (this one is \`${unk}\`); the refusal is the CHANNEL's nature, not the value's shape. The token belongs to the library's token system and is carried there if anywhere; the component contract has no channel for "declares a custom property" and should not invent one.`, sample: unk, distinctValues: values.size });
          // @door fuse.unmintable-kind-residue
          } else {
            // CONTROL-FALLBACK QUALIFIER. The styled-channel door admits a
            // channel when it DIFFERS FROM THE CONTROL for this part's tag —
            // but the harness renders controls for only four tags
            // (CONTROL_TAGS: button/span/a/div) and every other tag falls back
            // to the <span> control (already named by `control-fallback:` in
            // styledChannelReceipts). Measured: 147 of 403 captured parts
            // (36.5%) across 21 tags fall back, and 138 of these 351 refusals
            // sit on one of them.
            //
            // For those the difference from the control may be the USER
            // AGENT's, not the library's: a <td> is measured against a <span>,
            // so `unicode-bidi: isolate`, `border-collapse: collapse` and
            // `vertical-align: middle` — the UA's own table defaults — read as
            // authored facts. Same for `<li> list-style-type: none` and
            // `<svg> overflow-clip-margin`. The refusal itself does not change
            // (nothing is carried either way), but a reader must not be told
            // the library declared something the browser did. Widening
            // CONTROL_TAGS is the real fix and it is a CAPTURE change — see
            // docs/HANDOFF.md.
            const tag = a.baseFlat[pi]?.node.tag ?? '';
            const fellBack = tag !== '' && !CONTROL_TAGS_MIRROR.has(tag);
            codeOnly.push({
              part: partName,
              channel,
              reason:
                'value shape outside mintable kinds (color/px/number/shadow/gradient) and outside the declared-channel registry — no schema channel today' +
                (fellBack
                  ? `. NOTE — UNRELIABLE BASELINE: this part is a <${tag}>, and the harness renders a control for ${[...CONTROL_TAGS_MIRROR].join('/')} only, so it was measured against the <span> control (see the \`control-fallback\` receipt). The difference from that control may be the USER AGENT's default for <${tag}> rather than a fact the library authored — this refusal loses nothing either way, but it must not be read as evidence the library declared it.`
                  : ''),
              sample: unk,
              distinctValues: values.size,
            });
          }
          continue;
        }
        // @door fuse.pairwise-certificate-refusal
        if (space.enumeration.policy === 'per-axis+pairwise') {
          const refusals = pairwiseCertificate(rows, space.axes);
          if (refusals.length > 0) {
            pairwiseRefusals.push(`${partName}.${channel}: ${refusals.join('; ')}`);
            continue;
          }
        }
        obs.push({ nodePath: `${comp.name}:${partName}`, part: partName === 'root' ? '' : partName, cssProperty: channel, kind: kindOf(channel, [...values][0])!.kind, occurrences });
      }
    }
    return { obs, codeOnly, declared, pairwiseRefusals };
  };

  const folded = buildBaseObs(true);
  const unfolded = buildBaseObs(false);

  // ---- INHERITANCE-AWARE REFUSAL: measure pure-inheritance channels -------
  //
  // A nested part whose INHERITED channel reads EXACTLY its ancestor's value
  // on every captured plane carries no fact of its own — what the capture
  // recorded there IS CSS inheritance, observed. Binding it anyway pins the
  // child to ONE plane's value and severs the chain, so every plane the
  // ancestor changes (and the child cannot spell) renders the base value.
  //
  // Measured here from the captures; the POLICY (when the redundancy becomes
  // harmful enough to refuse) lives in applyMintToContract, which is the only
  // place that knows which nested state bindings actually go uncarried.
  const inheritanceOnly: string[] = [];
  const inheritanceReceipts: string[] = [];
  {
    // Parent by the UNION's own links, NOT by repPath: a repPath is only
    // meaningful inside the capture that introduced its node (an icon part
    // introduced by a withIcon=on capture can hold path '0' while the base
    // capture's label holds '0' too), so prefix arithmetic across parts
    // would mis-attribute ancestry. `union.entries` is DFS order over the
    // union tree and carries real parent pointers.
    const indexOfNode = new Map(a.union.entries.map((e, i) => [e, i] as const));
    const ancestorOf = (pi: number): number | null => {
      const parent = a.union.entries[pi]?.parent;
      const ai = parent ? indexOfNode.get(parent) : undefined;
      return ai === undefined ? null : ai;
    };
    for (let pi = 0; pi < a.baseFlat.length; pi++) {
      if (a.union.entries[pi]?.parent == null) continue; // root has no ancestor
      const partName = a.partNames[pi];
      if (!mintablePart(partName)) continue;
      const ai = ancestorOf(pi);
      if (ai === null) continue;
      const ancestorName = a.partNames[ai];
      const ancestorCarries = carriedChannels(partByName.get(ancestorName));
      const ancestorStyled = styled.get(ancestorName) ?? new Set<string>();
      for (const channel of [...(styled.get(partName) ?? [])].sort()) {
        // @door fuse.inherited-channels-only
        if (!INHERITED_CHANNELS.has(channel)) continue;
        // The ancestor must itself CARRY the channel — reviewed or mintable.
        // Without that, dropping the child's binding would leave the channel
        // bound nowhere and the "never worse" argument would not hold.
        // @door fuse.inheritance-check-rejected
        if (!ancestorCarries.has(channel) && !ancestorStyled.has(channel)) {
          inheritanceReceipts.push(
            `inheritance-check-rejected: ${partName}.${channel} — values track ancestor "${ancestorName}" but that ancestor carries the channel nowhere; the binding STAYS (dropping it would bind the channel nowhere)`,
          );
          continue;
        }
        // @door fuse.inheritance-only
        // Equality on EVERY captured plane, not just the default one — a
        // channel that agrees at rest and diverges on :hover is a real fact.
        let planes = 0;
        let equalEverywhere = true;
        for (const [, els] of a.union.alignedByKey) {
          const child = els[pi];
          const anc = els[ai];
          if (!child || !anc) continue;
          const cv = child.node.style[channel];
          const av = anc.node.style[channel];
          if (cv === undefined || av === undefined) continue;
          planes++;
          // @door fuse.plane-disagreement-closes-door
          if (cv !== av) { equalEverywhere = false; break; }
        }
        if (!equalEverywhere || planes === 0) continue;
        inheritanceOnly.push(`${partName}|${channel}`);
        inheritanceReceipts.push(
          `inheritance-only: ${partName}.${channel} equals ancestor "${ancestorName}" on all ${planes} captured planes — the part carries no independent ${channel} fact (CSS inheritance, observed)`,
        );
      }
    }
  }

  // ---- state deltas (§2 / §5.2 state minting) ----
  interface StateDelta { state: string; part: string; channel: string; occurrences: MintObservation['occurrences']; kinds: Set<string>; samples: Set<string>; combosSeen: Set<string> }
  const stateDeltaChannels = new Map<string, StateDelta>();
  const stateCodeOnly: CodeOnlyEntry[] = [];
  const declaredStates: DeclaredStateEnrichment[] = [];
  const inertOnDisabled: string[] = [];
  // Deduped at the end: one entry per (part, interaction), not per combo —
  // a 40-combo component would otherwise bury the finding in noise.
  const planeAbsentDrops: string[] = [];
  const foldedStateSkips: string[] = [];

  /** PSEUDO-DECOR v2 ROUND — the STATE observation path is the THIRD consumer
   *  of the ABSENT ≡ '0px' identity (after prepareMint's per-combo read and
   *  absolutePartPlacement). Under the generalized translate door a part is
   *  admitted because SOME combo carries motion, so an interaction plane with
   *  no transform/translate at all reads `undefined` — which used to reach
   *  kindOf() and CRASH inside the colour parser (astryx, offline re-fuse).
   *  A synthetic channel absent on a plane is AT REST; any OTHER channel
   *  absent on a plane is genuinely unobserved there and is skipped rather
   *  than crashed (that guard is a pre-existing latent hole, now closed). */
  const planeValue = (st: StyleMap, p: string): string | undefined =>
    st[p] !== undefined ? st[p] : SYNTHETIC_CHANNELS.has(p) ? '0px' : undefined;

  const pushStateValue = (state: string, part: string, channel: string, combo: Combo, v: string) => {
    const key = `${state}|${part}|${channel}`;
    let d = stateDeltaChannels.get(key);
    if (!d) stateDeltaChannels.set(key, (d = { state, part, channel, occurrences: [], kinds: new Set(), samples: new Set(), combosSeen: new Set() }));
    const k = kindOf(channel, v);
    d.samples.add(v);
    d.combosSeen.add(combo.key);
    if (k) {
      d.kinds.add(k.kind);
      d.occurrences.push({ variant: combo.key, axisValues: combo.axisValues, value: k.value });
    } else d.kinds.add('unmintable');
  };

  const allProps = Object.keys(a.baseFlat[0].node.style);
  for (const combo of space.enumeration.combos) {
    const defaults = a.getAligned(`${combo.key}__default`);
    for (const interaction of ['hover', 'focus-visible', 'active'] as Interaction[]) {
      // MOLECULE round: portal-swept components capture DEFAULT only —
      // interaction planes simply do not exist for them (named in
      // provenance); absence is not an error here.
      // @door fuse.interaction-plane-absent
      if (!a.byKey.has(`${combo.key}__${interaction}`)) continue;
      const els = a.getAligned(`${combo.key}__${interaction}`);
      for (let pi = 0; pi < a.baseFlat.length; pi++) {
        if (!mintablePart(a.partNames[pi])) continue;
        const d0 = defaults[pi];
        const d1 = els[pi];
        // @door fuse.plane-absent-drop
        if (!d0 || !d1) {
          // SILENT-LOSS ROUND — THE RECEIPT POINTED AT THIS DOOR.
          //
          // When a part has no DEFAULT-plane element, the base pass refuses its
          // channels with "part absent in every default-state combo
          // (interaction-only part) — state rounds own it". This is the state
          // round, and it dropped exactly those parts on this line, silently.
          // So the refusal named a destination that discards the fact: worse
          // than no receipt, because it tells a reviewer the case is handled.
          //
          // MEASURED: carbon's `accordion__wrapper-2` carries 10 such receipts
          // and ships in the anatomy with `description` + `declared` only — no
          // tokens, no states, nothing.
          //
          // The delta is still NOT carried (a state value diffed against a
          // default that does not exist is not an observation of a change), but
          // the loss is now named WHERE IT HAPPENS and the base receipt no
          // longer promises someone else handled it.
          // MEASURED, not assumed: a probe over carbon's Accordion found that
          // EVERY part reaching this guard has BOTH planes absent (3 parts —
          // accordion__wrapper, accordion__wrapper-2, label-2). The first cut
          // of this receipt fired only on `!d0 && d1` and was therefore dead
          // code; the case it imagined does not occur here.
          planeAbsentDrops.push(
            !d0 && !d1
              ? `${a.partNames[pi]}: absent from BOTH the default and ${interaction} planes — NO combo plane observes this part, so neither the base pass nor the state round can carry any channel for it. It reached the anatomy from the BASE capture alone (it renders only in a state no combo drives, e.g. an accordion panel that is open), and it ships with declared facts only`
              : !d0
                ? `${a.partNames[pi]}: observed on the ${interaction} plane but ABSENT from the default plane — no counterpart to diff against, so no state delta is carried`
                : `${a.partNames[pi]}: present at default but ABSENT from the ${interaction} plane — the part does not render in that interaction, so no delta is carried`,
          );
          continue;
        }
        for (const p of allProps) {
          if (!isFusable(p)) continue;
          const pv0 = planeValue(d0.node.style, p);
          const pv1 = planeValue(d1.node.style, p);
          // @door fuse.no-delta-no-fact
          if (pv0 === pv1) continue;
          // @door fuse.state-value-unobserved
          if (pv1 === undefined) continue; // channel unobserved on this interaction plane
          // @door fuse.inert-on-disabled
          if (!isEnabled(combo)) {
            const flagged = Object.entries(combo.stateFlags).filter(([, f]) => f).map(([n]) => n).join('+');
            inertOnDisabled.push(`interaction-on-${flagged}-changed: ${combo.key} ${interaction} ${a.partNames[pi]}.${p}`);
            continue;
          }
          pushStateValue(interaction, a.partNames[pi], p, combo, pv1);
        }
        // ANTD EXAM (S1 on the real Button, 2026-08-23) — THE OUTLINE PAIR.
        // antd's focus ring is `outline: var(--line-width-focus) solid …` and
        // its width is 3px — Chromium's OWN `outline-width: medium`. The rest
        // plane computes 3px too (style none, nothing painted), so the
        // focus-visible delta is style none→solid + color + offset and the
        // WIDTH never differs from the default: the loop above carried color
        // and offset, declared the style, and dropped the width as "not a
        // fact". The canvas draws an outside stroke only from the PAIR
        // (outline-color + outline-width), so the focus ring vanished with
        // every half of it receipted. When a plane changes outline-color or
        // outline-style and the plane's outline-width is a non-zero length,
        // that width IS the ring's width on this plane and rides the state
        // as a value, UA-default or not. (A zero or absent width stays
        // absent — nothing would be drawn.)
        // @door fuse.outline-width-pair-carried
        if (isEnabled(combo)) {
          // Interaction planes are reconstructed from DELTAS against the
          // default plane, so a channel that did not change reads undefined
          // there — the unchanged width is the default plane's width.
          const onPlane = (p: string): string | undefined => planeValue(d1.node.style, p) ?? planeValue(d0.node.style, p);
          const w1 = onPlane('outline-width');
          const styleOn = onPlane('outline-style');
          const ringChanged = (['outline-color', 'outline-style'] as const).some(
            (p) => planeValue(d1.node.style, p) !== undefined && planeValue(d0.node.style, p) !== planeValue(d1.node.style, p),
          );
          const widthUnchanged = planeValue(d1.node.style, 'outline-width') === undefined || planeValue(d0.node.style, 'outline-width') === w1;
          if (ringChanged && widthUnchanged && w1 !== undefined && styleOn !== undefined && styleOn !== 'none' && /^[1-9][\d.]*px$/.test(w1)) {
            pushStateValue(interaction, a.partNames[pi], 'outline-width', combo, w1);
          }
        }
      }
    }
  }
  // state-props (disabled-like): diff each flagged combo against its unflagged twin
  for (const s of space.stateProps) {
    for (const combo of space.enumeration.combos) {
      if (!combo.stateFlags[s.prop]) continue;
      // twin = same axis values + same other flags, this flag false
      // @door fuse.state-twin-required
      const twin = space.enumeration.combos.find(
        (c) =>
          space.axes.every((ax) => c.axisValues[ax.prop] === combo.axisValues[ax.prop]) &&
          space.stateProps.every((sp) => c.stateFlags[sp.prop] === (sp.prop === s.prop ? false : combo.stateFlags[sp.prop])),
      );
      if (!twin || !isEnabled(twin)) continue;
      const d0 = a.getAligned(`${twin.key}__default`);
      const d1 = a.getAligned(`${combo.key}__default`);
      for (let pi = 0; pi < a.baseFlat.length; pi++) {
        if (!mintablePart(a.partNames[pi])) continue;
        // @door fuse.state-prop-part-absent
        if (!d0[pi] || !d1[pi]) continue;
        for (const p of allProps) {
          if (!isFusable(p)) continue;
          const sv0 = planeValue(d0[pi]!.node.style, p);
          const sv1 = planeValue(d1[pi]!.node.style, p);
          if (sv0 === sv1) continue;
          if (sv1 === undefined) continue; // channel unobserved on this state plane
          pushStateValue(s.state, a.partNames[pi], p, twin, sv1);
        }
      }
    }
  }

  // full-coverage state deltas → mint; partial deltas padded with defaults
  // (a partial delta is itself a per-axis fact); unmintable → extension.
  // Folded channels are excluded from the FOLDED observation set (their
  // deltas ride the source fact, receipted) but included in the unfolded
  // set — the before→after leaf-count receipt measures the folding pass
  // end to end.
  const stateObsAll: Array<{ obs: MintObservation; folded: boolean }> = [];
  const expectedEnabled = enabledCombos.length;
  for (const d of [...stateDeltaChannels.values()].sort((x, y) => `${x.state}|${x.part}|${x.channel}`.localeCompare(`${y.state}|${y.part}|${y.channel}`))) {
    // @door fuse.fold-carries-state-delta
    const foldedChannel = foldedSet.has(`${d.part}|${d.channel}`);
    if (foldedChannel) foldedStateSkips.push(`fold-carries-state-delta: [${d.state}] ${d.part}.${d.channel} rides its source fact`);
    // SHADCN ROUND — the BASE plane's custom-property door, mirrored to the
    // STATE plane. A CSS custom property is not a styled channel (the base
    // fusion refuses it by name: it is the library's own token PLUMBING
    // observed on the element, not a rendered fact — the rendered fact rides
    // the consuming channel). The state-mint path lacked the same door, so
    // shadcn Button's `active:translate-y-px` minted `--tw-translate-y` as a
    // state token and the enriched contract failed generator validation
    // (TOKEN_CHANNELS has, correctly, no entry for a custom property). The
    // rendered motion itself is carried by the `translate` channel alongside.
    // Corpus-neutral by measurement: no committed contract carries a
    // custom-property channel anywhere (base door held everywhere else).
    // @door fuse.custom-property-not-a-channel-state
    if (d.channel.startsWith('--')) {
      if (!foldedChannel) {
        stateCodeOnly.push({
          state: d.state,
          part: d.part,
          channel: d.channel,
          sample: [...d.samples][0],
          reason:
            'CSS custom property, not a styled channel — the same door the base plane applies: a custom property is a token DECLARATION the library sets on this element (its plumbing), never a rendered fact; the rendered state delta rides the consuming channel',
        });
      }
      continue;
    }
    // @door fuse.declared-state-full-coverage
    if (d.kinds.has('unmintable') || d.kinds.size !== 1) {
      if (!foldedChannel) {
        // v15 declared state facts: a registry channel whose delta is
        // UNIFORM and observed on EVERY enabled combo (a partial delta would
        // misapply to non-delta variants under a state selector) carries as
        // Part.declaredStates. Everything else stays named residue.
        const spec = DECLARED_CHANNELS[d.channel];
        const uniform = d.samples.size === 1 ? [...d.samples][0] : null;
        if (spec && uniform !== null && spec.value.test(uniform) && d.combosSeen.size === expectedEnabled && declarablePart(d.part)) {
          declaredStates.push({ state: d.state, part: d.part, channel: d.channel, value: uniform });
        } else if (spec && uniform !== null && spec.value.test(uniform) && d.combosSeen.size !== expectedEnabled) {
          stateCodeOnly.push({ state: d.state, part: d.part, channel: d.channel, sample: uniform, reason: `declared-channel state delta on ${d.combosSeen.size}/${expectedEnabled} combos — partial coverage cannot carry as a state selector (v15); named residue` });
        } else {
          stateCodeOnly.push({ state: d.state, part: d.part, channel: d.channel, sample: [...d.samples][0], reason: d.kinds.has('unmintable') ? 'value shape outside mintable kinds and outside the declared vocabulary' : 'mixed value kinds across combos' });
        }
      }
      continue;
    }
    // @door fuse.state-delta-padding-incompatible
    if (d.occurrences.length < expectedEnabled) {
      const have = new Set(d.occurrences.map((o) => o.variant));
      let padded = true;
      for (const combo of enabledCombos) {
        if (have.has(combo.key)) continue;
        const pi = a.partNames.indexOf(d.part);
        const el = a.getAligned(`${combo.key}__default`)[pi];
        const v = el?.node.style[d.channel];
        const k = v !== undefined ? kindOf(d.channel, v) : null;
        if (!k || k.kind !== [...d.kinds][0]) { padded = false; break; }
        d.occurrences.push({ variant: combo.key, axisValues: combo.axisValues, value: k.value });
      }
      if (!padded) {
        if (!foldedChannel) stateCodeOnly.push({ state: d.state, part: d.part, channel: d.channel, sample: [...d.samples][0], reason: 'default-state values not kind-compatible for padding — cannot correlate' });
        continue;
      }
    }
    stateObsAll.push({
      folded: foldedChannel,
      obs: {
        nodePath: `${comp.name}:${d.part}:${d.state}`,
        part: d.part === 'root' ? '' : d.part,
        cssProperty: `${d.channel}-state-${d.state}`,
        kind: [...d.kinds][0] as MintObservation['kind'],
        occurrences: d.occurrences,
      },
    });
  }
  const stateObs = stateObsAll.filter((s) => !s.folded).map((s) => s.obs);

  // before→after: the unfolded mint (base + state observations, NO folding
  // pass) is the spike's leaf universe; the folded mint is what the
  // production module actually mints. Both counts are quoted.
  const unfoldedMint = mintTokens(comp.name, [...unfolded.obs, ...stateObsAll.map((s) => s.obs)], axes, { nestedPairs: true });

  return {
    axes,
    baseObs: folded.obs,
    stateObs,
    codeOnly: folded.codeOnly,
    stateCodeOnly,
    declared: folded.declared,
    declaredStates,
    inertOnDisabled,
    planeAbsentDrops: [...new Set(planeAbsentDrops)].sort(),
    pairwiseRefusals: folded.pairwiseRefusals,
    orphanRefusals,
    unfoldedLeafCount: unfoldedMint.count,
    foldedStateSkips: [...new Set(foldedStateSkips)],
    remintReceipts: [...new Set(remintReceipts)],
    setPlaneLiterals,
    inheritanceOnly: [...new Set(inheritanceOnly)].sort(),
    inheritanceStateDeltas: [
      ...new Set(
        [...stateDeltaChannels.values()]
          .filter((d) => d.part !== 'root')
          .map((d) => `${d.part}|${d.channel}`),
      ),
    ].sort(),
    inheritanceReceipts: [...new Set(inheritanceReceipts)].sort(),
  };
}

// ---------------------------------------------------------------------------
// Enriched-contract application (S2/S3-hardened; §5.4)
// ---------------------------------------------------------------------------
export interface OverflowBinding {
  part: string;
  channel: string;
  state?: string;
  ref?: string;
  refusal: string;
}

export interface ApplyResult {
  enriched: Contract & Record<string, unknown>;
  overflowBindings: OverflowBinding[];
  enrichmentNotes: string[];
}

const placeholdersOf = (ref: string): string[] => [...ref.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).slice(0);

export function applyMintToContract(
  contract: Contract,
  space: PropSpace,
  mintBase: MintResult,
  baseObs: MintObservation[],
  mintStates: MintResult,
  stateObs: MintObservation[],
  layoutEnrichments: LayoutEnrichment['enriched'] = [],
  declaredEnrichments: DeclaredEnrichment[] = [],
  declaredStateEnrichments: DeclaredStateEnrichment[] = [],
  setPlaneLiterals: SetPlaneLiteral[] = [],
  /** prepareMint's MEASURED inheritance facts: `only` = `part|channel` keys
   *  whose value is provably the ancestor's on every captured plane;
   *  `stateDeltas` = keys on which some state delta was observed at all
   *  (see MintPrep.inheritanceOnly / .inheritanceStateDeltas). */
  inheritance: { only: string[]; stateDeltas: string[] } = { only: [], stateDeltas: [] },
  /** ANTD EXAM (W4): prepareMint's STATE-plane code-only residue
   *  (`stateCodeOnly`) — a state delta whose value shape no mintable kind
   *  accepts, a partial-coverage declared delta, a custom property. Folded
   *  into `Part.codeOnly` below together with the state-plane overflow
   *  bindings this function refuses, so the contract itself names every
   *  state fact the capture saw and the grammar dropped. */
  captureCodeOnly: CodeOnlyEntry[] = [],
): ApplyResult {
  const enriched = structuredClone(contract) as Contract & Record<string, unknown>;
  const overflowBindings: OverflowBinding[] = [];
  const enrichmentNotes: string[] = [];
  const partByName = new Map(walkAnatomy(enriched).map((w) => [w.name, w.part] as const));
  for (const le of layoutEnrichments) {
    // @door fuse.enrichment-target-missing
    const target = partByName.get(le.part);
    if (!target) continue;
    target.layout ??= {};
    (target.layout as Record<string, string | boolean>)[le.field] = le.value;
    enrichmentNotes.push(`layout enriched: ${le.part}.layout.${le.field} = ${le.value} (uniform computed keyword — the schema's own vocabulary)`);
  }
  // v15 declared facts (S4): uniform registry-channel values → Part.declared;
  // full-coverage uniform state deltas → Part.declaredStates. The reviewed
  // static layer wins on collision (??=), like every other enrichment.
  for (const de of declaredEnrichments) {
    const target = partByName.get(de.part);
    if (!target || target.component || target.slot) continue; // guarded upstream; belt and braces
    if (de.when) {
      target.stylesWhen ??= [];
      const existing = target.stylesWhen.find((sw) => sw.prop === de.when!.prop && sw.equals === de.when!.equals);
      // @door fuse.reviewed-wins-collision
      if (existing) { if (!(de.channel in existing.styles)) existing.styles[de.channel] = de.value; }
      else target.stylesWhen.push({ prop: de.when.prop, equals: de.when.equals, styles: { [de.channel]: de.value } });
      enrichmentNotes.push(`declared fact carried per axis value: ${de.part}.${de.channel} = ${de.value} when ${de.when.prop}=${de.when.equals} (stylesWhen)`);
      continue;
    }
    target.declared ??= {};
    if (!(de.channel in target.declared)) {
      target.declared[de.channel] = de.value;
      enrichmentNotes.push(`declared fact carried: ${de.part}.${de.channel} = ${de.value} (v15 declared vocabulary — ${DECLARED_CHANNELS[de.channel]?.canvas === 'draw' ? 'canvas-drawable' : 'declared-not-drawn on canvas'})`);
    }
  }
  for (const de of declaredStateEnrichments) {
    const target = partByName.get(de.part);
    if (!target || target.component || target.slot) continue;
    target.declaredStates ??= {};
    target.declaredStates[de.state] ??= {};
    if (!(de.channel in target.declaredStates[de.state])) {
      target.declaredStates[de.state][de.channel] = de.value;
      if (!(enriched.states as string[]).includes(de.state)) (enriched.states as string[]).push(de.state as never);
      enrichmentNotes.push(`declared state fact carried: [${de.state}] ${de.part}.${de.channel} = ${de.value} (v15 declared vocabulary)`);
    }
  }
  const unsetAxes = new Map(space.axes.filter((ax) => ax.unset !== undefined).map((ax) => [ax.prop, ax.unset!] as const));
  const refusedSetPlaneLits: SetPlaneLiteral[] = [];

  const perAxisAdditions = new Map<string, Map<string, Record<string, Record<string, string>>>>(); // part → prop → value → channel → ref

  const addPerAxis = (partName: string, prop: string, value: string, channel: string, ref: string) => {
    const byProp = perAxisAdditions.get(partName) ?? new Map();
    perAxisAdditions.set(partName, byProp);
    const map = byProp.get(prop) ?? {};
    byProp.set(prop, map);
    (map[value] ??= {})[channel] = ref;
  };

  // ---- INHERITANCE-AWARE BASE REFUSAL (this round) -----------------------
  //
  // THE DEFECT THIS REPAIRS. The state-plane projection round lifted the mint
  // so a NESTED part may carry a two-axis BASE binding (`nestedPairs`), but
  // the nested STATE door stayed where v13 left it — plain color-kind refs
  // only. polaris Button's `label` therefore gained a base colour
  // (`{imported.button.label.color.{variant}.critical}`) while all four of
  // its per-state colour deltas were refused as pair refs. The committed
  // contract bound NO colour on `label` at all and the label simply inherited
  // the root's :hover/:focus-visible colour; the new base binding severs that
  // chain and nothing replaces it, so every hover/focus/active row renders
  // the resting colour (91.331 → 85.858 offline).
  //
  // The rule, and only where both halves are true:
  //   1. the CAPTURE proves the channel is pure inheritance (prepareMint's
  //      inheritanceOnly — equal to the ancestor on EVERY plane), AND
  //   2. a state delta on that channel WAS observed and is NOT carried as a
  //      nested state binding. "Not carried" is read from the outcome, not
  //      from one refusal site: a delta can die at the nested-state door
  //      (nestedStateCarriable — Button's `label`, a pair ref) or never reach
  //      the mint at all (padding-incompatible coverage → stateCodeOnly —
  //      Button's `icon`). Both leave the plane uncarried, and reading only
  //      the mint bindings would have repaired half the component.
  // Then the base binding is refused BY NAME and the channel stays uncarried,
  // which is what makes inheritance work again.
  //
  // Why this is never worse: (1) says the child's truth IS the ancestor's on
  // every plane, so an uncarried child renders exactly what the ancestor
  // renders and inherits the ancestor's accuracy — while the base binding can
  // only ever be right on the planes that do not move. Under (2) at least one
  // plane does move. Note round 4 already refuses a base-plane LITERAL on
  // these same channels for these same reasons ("Button's primary label went
  // dark"); this closes the tokensByProp door the lift opened beside it.
  const inheritanceOnlySet = new Set(inheritance.only);
  const inheritanceRefused = new Set<string>();
  if (inheritanceOnlySet.size > 0) {
    // Which nested state bindings the placer WILL carry (same predicate it
    // refuses by — one implementation, so the two doors cannot drift apart
    // again).
    const stateCarried = new Set<string>();
    mintStates.bindings.forEach((b, i) => {
      const obs = stateObs[i];
      if (!obs || b.ref === null) return;
      const partName = obs.part === '' ? 'root' : obs.part;
      if (partName === 'root') return; // root states are a different door
      const parsed = stateOfMintProperty(obs.cssProperty);
      if (!parsed) return;
      if (nestedStateCarriable(parsed.channel, placeholdersOf(b.ref.slice(1, -1)))) {
        stateCarried.add(`${partName}|${parsed.channel}`);
      }
    });
    for (const key of inheritance.stateDeltas) {
      if (!inheritanceOnlySet.has(key) || stateCarried.has(key)) continue;
      inheritanceRefused.add(key);
    }
  }

  const apply = (result: MintResult, obsList: MintObservation[], isState: boolean) => {
    result.bindings.forEach((b, i) => {
      const obs = obsList[i];
      const partName = obs.part === '' ? 'root' : obs.part;
      const parsed = isState ? stateOfMintProperty(obs.cssProperty) : null;
      const channel = parsed ? parsed.channel : obs.cssProperty;
      const state = parsed?.state;
      if (b.ref === null) {
        // Round 4 base-plane literal fallback: an UNCORRELATED base channel
        // still has one exact truth at the BASE combo — carried as a literal
        // (bounded LITERAL_CHANNELS grammar) so the default plane renders
        // right on every surface; the set planes stay NAMED residue.
        // @door fuse.base-plane-literal-fallback
        if (!state) {
          // NON-INHERITED box geometry only: inherited channels (color,
          // typography) are usually RIGHT via CSS inheritance when absent —
          // a base literal would break that (Button's primary label went
          // dark). Paddings/sizes/radii/borders have no inheritance to lean
          // on; absence there is a raw UA default.
          const target0 = partByName.get(partName);
          const baseOcc = obs.occurrences.find((o) => o.variant === space.baseComboKey);
          if (target0 && baseOcc !== undefined && BASE_FALLBACK_CHANNELS.has(channel) && LITERAL_CHANNELS.has(channel)) {
            const lit = obs.kind === 'px' ? `${baseOcc.value}px` : obs.kind === 'color' ? `#${baseOcc.value}` : obs.kind === 'number' ? String(baseOcc.value) : null;
            if (lit !== null && LITERAL_VALUE_RE.test(lit)) {
              target0.literals ??= {};
              if (!(channel in target0.literals)) {
                target0.literals[channel] = lit;
                enrichmentNotes.push(`base-plane literal carried: ${partName}.${channel} = ${lit} (uncorrelated across planes — the base combo's exact value; set planes remain named residue)`);
              }
            }
            // Round 5c — SET-PLANE literals: the refused channel's exact
            // per-plane truth on defaultless axes (presence-off slice
            // uniform), carried as literalsByProp (Tag size=large 8px).
            const rows = obs.occurrences
              .map((o) => ({
                axisValues: o.axisValues,
                value: obs.kind === 'px' ? `${o.value}px` : obs.kind === 'number' ? String(o.value) : '',
              }))
              .filter((r) => r.value !== '');
            const cands = setPlaneCandidates(rows, space);
            if (cands.length > 0) refusedSetPlaneLits.push({ part: partName, channel, cands });
          }
        }
        // @door fuse.uncorrelated-overflow
        overflowBindings.push({ part: partName, channel, ...(state ? { state } : {}), refusal: b.reason ?? 'uncorrelated' });
        return;
      }
      const target = partByName.get(partName);
      // @door fuse.computed-only-part-not-in-anatomy
      if (!target) {
        overflowBindings.push({ part: partName, channel, ...(state ? { state } : {}), ref: b.ref, refusal: 'computed-only part not present in the committed anatomy — adding parts is a curation decision, not a capture decision' });
        return;
      }
      const inner = b.ref.slice(1, -1);
      const phs = placeholdersOf(inner);

      if (state) {
        // @door fuse.state-outside-vocabulary
        if (!STATE_SUFFIXES.includes(state as (typeof STATE_SUFFIXES)[number])) {
          overflowBindings.push({ part: partName, channel, state, ref: b.ref, refusal: 'state outside the schema state vocabulary' });
          return;
        }
        const declareState = () => {
          if (!(enriched.states as string[]).includes(state)) (enriched.states as string[]).push(state as never);
        };
        // @door fuse.presence-prop-state-ref
        if (phs.some((p) => space.presence.has(p))) {
          overflowBindings.push({ part: partName, channel, state, ref: b.ref, refusal: 'presence-prop state ref — boolean substitution has no spelling (round 4 residue)' });
          return;
        }
        // @door fuse.nested-state-vocabulary
        if (partName !== 'root') {
          // v13 Part.states: color-kind channels, plain refs only
          if (!nestedStateCarriable(channel, phs)) {
            overflowBindings.push({ part: partName, channel, state, ref: b.ref, refusal: 'v13 Part.states carries plain color-kind refs only on non-root parts' });
            return;
          }
          target.states ??= {};
          target.states[state] ??= {};
          if (!(channel in target.states[state])) { target.states[state][channel] = b.ref; declareState(); }
          return;
        }
        // root states: the emitters expand ≤1 placeholder (S3)
        // @door fuse.root-state-one-placeholder
        if (phs.length === 0) {
          target.states ??= {};
          target.states[state] ??= {};
          if (!(channel in target.states[state])) { target.states[state][channel] = b.ref; declareState(); }
          return;
        }
        const unsetPh = phs.find((p) => unsetAxes.has(p));
        if (phs.length === 1 && !unsetPh) {
          // substituted state ref — expands per enum class (defaulted axis:
          // the class is always present, every plane carried)
          target.states ??= {};
          target.states[state] ??= {};
          if (!(channel in target.states[state])) { target.states[state][channel] = b.ref; declareState(); }
          return;
        }
        if (unsetPh) {
          // unset-axis state ref: carry the BASE (unset) plane — after
          // pinning the unset slot the ref has ≤1 remaining placeholder,
          // which root states DO carry (the emitters expand it per enum
          // class). The set planes are S3 residue, named — root states
          // cannot spell "axis value AND state" beyond one substitution.
          const reduced = `{${inner.replaceAll(`{${unsetPh}}`, unsetAxes.get(unsetPh)!)}}`;
          const remaining = placeholdersOf(reduced.slice(1, -1));
          if (remaining.length <= 1) {
            target.states ??= {};
            target.states[state] ??= {};
            if (!(channel in target.states[state])) { target.states[state][channel] = reduced; declareState(); }
            overflowBindings.push({ part: partName, channel, state, ref: b.ref, refusal: `state×${unsetPh} set-planes beyond the carried unset plane (S3 residue — leaves exist in the minted tree)` });
            return;
          }
          overflowBindings.push({ part: partName, channel, state, ref: b.ref, refusal: 'state ref with >1 placeholder after unset pinning — beyond root-state vocabulary (S3 residue)' });
          return;
        }
        overflowBindings.push({ part: partName, channel, state, ref: b.ref, refusal: 'state pair ref — root states carry ≤1 placeholder (S3 residue)' });
        return;
      }

      // ---- base bindings ----
      // Inheritance-aware refusal (see the precompute above): this nested
      // part's channel is provably its ancestor's on every captured plane AND
      // its own state deltas cannot be carried. Binding the base value here
      // would sever the inheritance that renders those planes correctly.
      // @door fuse.inheritance-refused-base-binding
      if (inheritanceRefused.has(`${partName}|${channel}`)) {
        overflowBindings.push({
          part: partName,
          channel,
          ref: b.ref,
          refusal:
            `inheritance-only channel with uncarried nested state deltas — the captured value equals this part's ancestor on EVERY plane, and its per-state deltas exceed the nested Part.states vocabulary (plain color-kind refs only); binding the base value would pin all state planes to the resting colour, so the channel stays UNCARRIED and CSS inheritance from the ancestor renders it (leaves exist in the minted tree)`,
        });
        return;
      }
      if (phs.length === 0) {
        target.tokens ??= {};
        if (!(channel in target.tokens)) target.tokens[channel] = b.ref;
        return;
      }
      if (phs.length === 1) {
        const axisProp = phs[0];
        const axis = space.axes.find((ax) => ax.prop === axisProp);
        // @door fuse.substituted-axis-not-enumerated
        if (!axis) {
          overflowBindings.push({ part: partName, channel, ref: b.ref, refusal: `substituted axis "${axisProp}" not an enumerated axis` });
          return;
        }
        // @door fuse.presence-off-plane-carried
        if (space.presence.has(axisProp)) {
          // Round 4: presence axes are BOOLEAN contract props — tokensByProp
          // has no boolean spelling; presence-driven styling is named residue
          // (the created SUBTREE itself is carried via visibleWhen instead).
          //
          // ANTD EXAM (heal loop, 2026-08-23): the refusal used to drop the
          // WHOLE channel — antd's Alert root padding (8px 12px; 20px 24px
          // with a description) vanished and the message text sat on the
          // border. The presence-OFF plane is the set's BASE rendering and
          // its leaf exists in the minted tree (`….off`); carry it as the
          // channel's binding and name the ON plane as the residue it is.
          const offRef = `{${inner.replace(`.{${axisProp}}`, `.${PRESENCE_OFF}`)}}`;
          target.tokens ??= {};
          if (!(channel in target.tokens)) {
            target.tokens[channel] = offRef;
            enrichmentNotes.push(`presence-off plane carried: ${partName}.${channel} = ${offRef} (the base rendering, presence "${axisProp}" absent); the presence-ON plane is named residue below`);
          }
          overflowBindings.push({ part: partName, channel, ref: b.ref, refusal: `presence-prop-driven styling (${axisProp}) — boolean tokensByProp has no spelling (round 4 residue); the presence-OFF plane is carried as the base binding, the ON plane (${axisProp} present) is not` });
          return;
        }
        const groupBase = inner.replace(`.{${axisProp}}`, '');
        if (axis.unset !== undefined) {
          // S2: the unset value's leaf is the BASE binding; set values ride
          // the tokensByProp map (plain refs — emitter-supported everywhere).
          target.tokens ??= {};
          if (!(channel in target.tokens)) target.tokens[channel] = `{${groupBase}.${axis.unset}}`;
          for (const v of axis.values) {
            if (v === axis.unset) continue;
            addPerAxis(partName, axisProp, v, channel, `{${groupBase}.${v}}`);
          }
        } else {
          for (const v of axis.values) addPerAxis(partName, axisProp, v, channel, `{${groupBase}.${v}}`);
        }
        return;
      }
      if (phs.length === 2) {
        const [pa, pb] = phs; // leaf-path order (mint axis discovery order)
        // @door fuse.presence-prop-pair-ref
        if (space.presence.has(pa) || space.presence.has(pb)) {
          overflowBindings.push({ part: partName, channel, ref: b.ref, refusal: 'presence-prop pair ref — boolean tokensByProp has no spelling (round 4 residue)' });
          return;
        }
        const ua = unsetAxes.get(pa);
        const ub = unsetAxes.get(pb);
        // @door fuse.pair-over-two-unset-axes
        if (ua !== undefined && ub !== undefined) {
          overflowBindings.push({ part: partName, channel, ref: b.ref, refusal: 'pair ref over TWO unset axes — no carried spelling; named residue' });
          return;
        }
        // @door fuse.nested-pair-map
        if (ua === undefined && ub === undefined) {
          if (partName === 'root') {
            // both axes defaulted → their enum classes are always present;
            // the two-placeholder root ref expands as compound modifier rules.
            target.tokens ??= {};
            if (!(channel in target.tokens)) target.tokens[channel] = b.ref;
            return;
          }
          // STATE-PLANE PROJECTION round — NESTED defaulted pair. A nested
          // part carries ≤1 placeholder per ref, so the pair is spelled as a
          // per-value tokensByProp map on ONE axis whose refs keep the OTHER
          // axis's placeholder. This is the SAME reviewed capability the
          // one-unset branch below already uses (validateContract allows a
          // per-value map ref carrying at most one placeholder naming a
          // DIFFERENT enum prop; every emitter substitutes over the full
          // prop subst at any depth).
          //
          // Map axis = the SECOND placeholder in leaf-path order (= mint
          // axis discovery order = the capture config's `axes` order).
          // Deterministic, no tie-break invented. Both axes are defaulted,
          // so every map key is always present in `subst` — no plane is
          // silently unreachable.
          const keyProp = pb;
          const keyAxis = space.axes.find((ax) => ax.prop === keyProp);
          if (!keyAxis) {
            overflowBindings.push({ part: partName, channel, ref: b.ref, refusal: `pair ref map axis "${keyProp}" is not an enumerated axis` });
            return;
          }
          for (const kv of keyAxis.values) {
            addPerAxis(partName, keyProp, kv, channel, `{${inner.replaceAll(`{${keyProp}}`, kv)}}`);
          }
          enrichmentNotes.push(
            `nested pair carried: ${partName}.${channel} = per-${keyProp} map whose refs substitute ${pa === keyProp ? pb : pa} (nested parts hold ONE placeholder per ref — the reviewed per-value-map capability)`,
          );
          return;
        }
        // @door fuse.pair-with-unset-carried
        // ONE unset axis (S2 pair carriage): base plane = per-OTHER-axis map
        // of fully resolved refs (unset slot pinned); set planes = per-UNSET-
        // value map whose refs keep the other placeholder — the reviewed
        // emitter capability lift expands them as compound rules.
        const unsetProp = ua !== undefined ? pa : pb;
        const unsetLabel = (ua ?? ub)!;
        const otherProp = ua !== undefined ? pb : pa;
        const otherAxis = space.axes.find((ax) => ax.prop === otherProp)!;
        const unsetAxis = space.axes.find((ax) => ax.prop === unsetProp)!;
        for (const ov of otherAxis.values) {
          const resolved = `{${inner.replaceAll(`{${unsetProp}}`, unsetLabel).replaceAll(`{${otherProp}}`, ov)}}`;
          addPerAxis(partName, otherProp, ov, channel, resolved);
        }
        for (const uv of unsetAxis.values) {
          if (uv === unsetLabel) continue;
          const partial = `{${inner.replaceAll(`{${unsetProp}}`, uv)}}`;
          addPerAxis(partName, unsetProp, uv, channel, partial);
        }
        enrichmentNotes.push(`pair-with-unset carried: ${partName}.${channel} = base plane per ${otherProp} + placeholder maps per ${unsetProp} (emitter capability lift)`);
        return;
      }
      // @door fuse.beyond-two-axis-vocabulary
      overflowBindings.push({ part: partName, channel, ref: b.ref, refusal: `${phs.length} placeholders — beyond the two-axis vocabulary` });
    });
  };

  apply(mintBase, baseObs, false);
  apply(mintStates, stateObs, true);

  // Round 5c — attach SET-PLANE literals (refused-mint geometry planes +
  // prepareMint's unmintable-kind planes) as literalsByProp entries; a
  // reviewed same-prop entry's channels are never re-added (the v14 rule,
  // mirrored from the tokensByProp merge below).
  {
    const byPart = new Map<string, Map<string, Record<string, Record<string, string>>>>();
    for (const spl of [...refusedSetPlaneLits, ...setPlaneLiterals]) {
      const target = partByName.get(spl.part);
      if (!target) continue;
      // @door fuse.set-plane-literal-channel-gate
      if (BASE_FALLBACK_CHANNELS.has(spl.channel) === false) continue;
      const byProp = byPart.get(spl.part) ?? new Map<string, Record<string, Record<string, string>>>();
      byPart.set(spl.part, byProp);
      for (const c of spl.cands) {
        const map = byProp.get(c.prop) ?? {};
        byProp.set(c.prop, map);
        (map[c.value] ??= {})[spl.channel] = c.lit;
      }
    }
    for (const [partName, byProp] of byPart) {
      const target = partByName.get(partName)!;
      const existing = (target.literalsByProp ?? []).map((e) => structuredClone(e));
      for (const [prop, map] of [...byProp.entries()].sort((x, y) => x[0].localeCompare(y[0]))) {
        // @door fuse.literals-by-prop-conflict-avoided
        for (const e of existing) {
          if (e.prop !== prop) continue;
          const reviewedChannels = new Set(Object.values(e.map).flatMap((m) => Object.keys(m)));
          for (const val of Object.keys(map)) {
            for (const chn of Object.keys(map[val])) {
              if (reviewedChannels.has(chn)) {
                delete map[val][chn];
                enrichmentNotes.push(`literalsByProp conflict avoided: ${partName}.${chn} on prop ${prop} already reviewed — set-plane literal not re-added`);
              }
            }
            if (Object.keys(map[val]).length === 0) delete map[val];
          }
        }
        if (Object.keys(map).length > 0) {
          const ordered: Record<string, Record<string, string>> = {};
          for (const k of Object.keys(map).sort()) {
            ordered[k] = Object.fromEntries(Object.entries(map[k]).sort(([x], [y]) => x.localeCompare(y)));
          }
          existing.push({ prop, map: ordered });
          enrichmentNotes.push(`set-plane literals carried: ${partName} per ${prop} → ${Object.entries(ordered).map(([v, m]) => `${v}:{${Object.entries(m).map(([chn, lv]) => `${chn}=${lv}`).join(', ')}}`).join(' ')} (round 5c — refused/unmintable geometry planes; presence planes stay named residue)`);
        }
      }
      if (existing.length > 0) target.literalsByProp = existing as never;
    }
  }

  // merge per-axis additions as v14 multi-entry tokensByProp — appended AFTER
  // existing entries (computed enrichment must not shadow reviewed bindings);
  // the v14 refusal rule (no two entries sharing BOTH prop and channel) is
  // honored by stripping channels a reviewed same-prop entry already maps.
  //
  // DEFECT FIXED (regate-drift triage): the v14 rule spans tokensByProp AND
  // literalsByProp (core/emit-react.ts:405 — "in two entries (tokensByProp[i]
  // and literalsByProp[j])"), but this merge only consulted tokensByProp and
  // the set-plane-literal block above only consulted literalsByProp — neither
  // looked ACROSS the two fields. Once the absolute-positioning round
  // (f52c334) admitted geometry channels to fusion, the mint started emitting
  // a per-size token for a channel a REVIEWED literalsByProp entry already
  // owned, and the referee refused the whole contract: polaris Avatar,
  // ProgressBar and Thumbnail have been UNFUSABLE since that commit (they
  // re-fused exactly at 82d312f: 70.652 / 92.105 / 100.000). Same precedence
  // as the same-field rule — the reviewed entry wins, the computed value is
  // dropped with a NAMED note.
  for (const [partName, byProp] of perAxisAdditions) {
    const target = partByName.get(partName);
    if (!target) continue;
    const existing = tokensByPropEntries(target).map((e) => structuredClone(e));
    const reviewedLiteralChannels = new Map<string, Set<string>>(); // prop → channels
    for (const e of (target.literalsByProp ?? []) as Array<{ prop: string; map: Record<string, Record<string, string>> }>) {
      const set = reviewedLiteralChannels.get(e.prop) ?? new Set<string>();
      for (const m of Object.values(e.map)) for (const ch of Object.keys(m)) set.add(ch);
      reviewedLiteralChannels.set(e.prop, set);
    }
    for (const [prop, map] of [...byProp.entries()].sort((x, y) => x[0].localeCompare(y[0]))) {
      // @door fuse.tokens-by-prop-conflict-cross-field
      const literalChannels = reviewedLiteralChannels.get(prop);
      if (literalChannels) {
        for (const val of Object.keys(map)) {
          for (const ch of Object.keys(map[val])) {
            if (literalChannels.has(ch)) {
              delete map[val][ch];
              enrichmentNotes.push(`tokensByProp conflict avoided: ${partName}.${ch} on prop ${prop} is carried by a reviewed literalsByProp entry — computed token not added (v14 cross-field rule)`);
            }
          }
          if (Object.keys(map[val]).length === 0) delete map[val];
        }
      }
      // @door fuse.tokens-by-prop-conflict-same-field
      for (const e of existing) {
        if (e.prop !== prop) continue;
        const reviewedChannels = new Set(Object.values(e.map).flatMap((m) => Object.keys(m)));
        for (const val of Object.keys(map)) {
          for (const ch of Object.keys(map[val])) {
            if (reviewedChannels.has(ch)) {
              delete map[val][ch];
              enrichmentNotes.push(`tokensByProp conflict avoided: ${partName}.${ch} on prop ${prop} already reviewed — computed value not re-added`);
            }
          }
          if (Object.keys(map[val]).length === 0) delete map[val];
        }
      }
      if (Object.keys(map).length > 0) {
        const ordered: Record<string, Record<string, string>> = {};
        for (const k of Object.keys(map).sort()) {
          ordered[k] = Object.fromEntries(Object.entries(map[k]).sort(([x], [y]) => x.localeCompare(y)));
        }
        existing.push({ prop, map: ordered });
      }
    }
    if (existing.length > 0) target.tokensByProp = existing as never;
  }

  // ANTD EXAM (W4) — THE STATE PLANE'S REFUSALS RIDE THE CONTRACT. Every
  // state-plane binding refused above (overflowBindings with a `state`) and
  // every state-plane code-only residue prepareMint named (captureCodeOnly)
  // lands on its part as `Part.codeOnly`, value resolved to the minted
  // literal where a leaf exists. Measured on the P2 exam's S1 case: the
  // focus-visible `outline-width: 3px` on a nested part was refused by name
  // ("v13 Part.states carries plain color-kind refs only on non-root parts")
  // into enriched.extension.json and LEDGER.md — and `figma bundle`, which
  // compiles codeOnlyFacts from the CONTRACT, never heard of it. The designer
  // pasting the bundle saw a Checkbox with no focus ring and no receipt.
  // Base-plane residue stays where it was (hundreds of per-part declared/
  // custom-property lines a designer would not read); the state plane is the
  // one whose silence costs a visible affordance.
  {
    const literalOf = (ref: string | undefined): string | undefined => {
      if (!ref) return undefined;
      const hit = mintStates.entries.find((e) => e.ref === ref) ?? mintBase.entries.find((e) => e.ref === ref);
      return hit?.value;
    };
    const seen = new Set<string>();
    const add = (partName: string, entry: { state?: string; channel: string; value: string; reason: string }) => {
      const target = partByName.get(partName);
      if (!target) return; // a computed-only part absent from the anatomy is already its own named refusal
      // @door fuse.code-only-dedup-by-reason
      const key = `${partName}|${entry.state ?? ''}|${entry.channel}|${entry.reason}`;
      if (seen.has(key)) return;
      seen.add(key);
      (target.codeOnly ??= []).push(entry);
    };
    // @door fuse.state-plane-residue-only-on-contract
    for (const o of overflowBindings) {
      if (!o.state) continue;
      add(o.part, { state: o.state, channel: o.channel, value: literalOf(o.ref) ?? o.ref ?? '', reason: o.refusal });
    }
    for (const c of captureCodeOnly) {
      if (!c.state) continue;
      add(c.part, { state: c.state, channel: c.channel, value: c.sample, reason: c.reason });
    }
    for (const target of partByName.values()) {
      // plain string order, never localeCompare — the enriched contract is byte-pinned
      if (target.codeOnly) target.codeOnly.sort((a, b) => { const ka = `${a.state}|${a.channel}|${a.reason}`; const kb = `${b.state}|${b.channel}|${b.reason}`; return ka < kb ? -1 : ka > kb ? 1 : 0; });
    }
  }
  // ANTD EXAM (heal loop, 2026-08-23) — THE UNSET PLANE MUST LOSE THE CASCADE.
  // The pair-with-unset carriage above spells a status×variant product as
  // TWO tokensByProp entries: the base plane per OTHER axis (variant, with
  // the unset status pinned) and the per-unset-value maps (status=error /
  // warning, whose refs keep the variant placeholder). resolveTokens merges
  // entries IN ORDER, later wins — and the entries were created in axis
  // order (status before variant), so every Status=Error cell on the canvas
  // took the UNSET border colour: antd's error input drew grey. The CSS
  // surfaces never saw it (a compound `.status-error.variant-outlined` rule
  // out-specifies `.variant-outlined`), the canvas did. Defaultless-axis
  // entries now sort AFTER defaulted-axis entries — stable, so nothing else
  // moves — and the named plane wins over its own fallback.
  // @door fuse.tokens-by-prop-reorder
  for (const target of partByName.values()) {
    const tbp = target.tokensByProp;
    if (!Array.isArray(tbp) || tbp.length < 2) continue;
    const rank = (e: { prop: string }) => (unsetAxes.has(e.prop) ? 1 : 0);
    const sorted = tbp.map((e, i) => ({ e, i })).sort((x, y) => rank(x.e) - rank(y.e) || x.i - y.i).map((x) => x.e);
    if (sorted.some((e, i) => e !== tbp[i])) {
      target.tokensByProp = sorted;
      enrichmentNotes.push(`tokensByProp reordered: ${[...new Set(sorted.map((e) => e.prop))].join(' → ')} — defaultless-axis maps (named planes) follow the defaulted-axis maps (the unset plane) so the in-order merge lets the named plane win`);
    }
  }
  return { enriched, overflowBindings, enrichmentNotes };
}

// ---------------------------------------------------------------------------
// Pseudo-element findings (§3.1 / S5)
// ---------------------------------------------------------------------------
export interface PseudoFinding {
  combo: string;
  interaction: string;
  part: string;
  pseudo: string;
  deltaVsDefault: StyleMap;
}

export function pseudoFindings(a: AlignedSweep, classPrefix: string): PseudoFinding[] {
  const findings: PseudoFinding[] = [];
  for (const c of a.captures) {
    const flatC = flatten(c.root, classPrefix);
    const def = a.byKey.get(`${c.combo}__default`);
    if (!def) continue;
    const flatD = flatten(def.root, classPrefix);
    // @door fuse.positional-index-alignment
    for (let i = 0; i < flatC.length; i++) {
      // @door fuse.decor-pseudos-only
      for (const pe of DECOR_PSEUDOS) {
        const now = flatC[i]?.node.pseudo[pe];
        if (!now) continue;
        const before = flatD[i]?.node.pseudo[pe];
        const delta: StyleMap = {};
        for (const [k, v] of Object.entries(now)) {
          if (!before || before[k] !== v) delta[k] = v;
        }
        // @door fuse.empty-delta-dropped
        // @door fuse.pseudo-default-content-only
        if (c.interaction === 'default' || Object.keys(delta).length > 0) {
          findings.push({
            combo: c.combo,
            interaction: c.interaction,
            part: a.partNames[i] ?? `el@${flatC[i].path}`,
            pseudo: pe,
            deltaVsDefault: c.interaction === 'default' ? { content: now.content } : delta,
          });
        }
      }
    }
  }
  return findings;
}
