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
import { buildUnion, nameUnion, rejoinStaticParts } from './anatomy.js';

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
      if (!el && inBase[i]) structureReceipts.push(`part-missing: ${key} ${partNames[i]}`);
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
    for (const combo of space.enumeration.combos) {
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
  if (absAdmit.size > 0) {
    for (let pi = 0; pi < a.baseFlat.length; pi++) {
      if (absAdmit.has(pi)) continue;
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
    if (displays.size === 1) {
      const d = [...displays][0];
      if (d === 'table' || d === 'inline-table' || d.startsWith('table-')) out.lowered.set(pi, d);
    }
  }
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
        if (w === null) {
          out.refusals.push(`table-column-width-unreadable: column ${col} cell "${a.partNames[ci]}" width "${el.node.style['width']}" is not a px length in combo ${combo.key} — column NOT admitted`);
          agreed = false;
          break;
        }
        seen.push({ part: a.partNames[ci], w });
      }
      if (!agreed) break;
      if (seen.length < 2) continue; // a one-row column proves nothing across rows
      const first = seen[0].w;
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
    if (!agreed) continue;
    for (const ci of cells) out.cellAdmit.add(ci);
    out.receipts.push(
      `table-column-width-admitted: column ${col} (${cells.map((ci) => a.partNames[ci]).join(', ')}) — every row measures the same OUTER width in every enabled combo (${widths.join(', ') || 'single-row column'}); width joins fusion for these parts (deterministic at the PINNED stage width — table-layout:auto reflows with available width, named)`,
    );
  }
  if (out.cellAdmit.size > 0) {
    out.receipts.push(
      `table-cell-height-from-row: the admitted cells take their HEIGHT from their ROW element — a cell's own computed height is its CONTENT height (Chromium reports e.g. 30px inside a 63px row), and the table box model gives every cell in a row the row's height; without it the per-cell border-bottom dividers land at different y positions (named)`,
    );
  }
  return out;
}

export function styledChannels(
  a: AlignedSweep,
  space: PropSpace,
  controls: Record<string, StyleMap>,
  allProps: string[],
  receipts: string[],
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
  for (const pi of [...absAdmit, ...parentAdmit].sort((x, y) => x - y)) {
    if (table.lowered.has(pi)) {
      receipts.push(`table-geometry-excluded: ${a.partNames[pi]} (display:${table.lowered.get(pi)}) — table-box parts keep the geometry exclusion even inside an overlay-anatomy component; the lowered flex stack sizes them (organism round)`);
      continue;
    }
    receipts.push(`absolute-geometry-admitted: ${a.partNames[pi]} — ${absAdmit.has(pi) ? 'uniformly position:absolute' : 'overlay-cluster member (component contains absolute parts)'}; width/height/offset channels join fusion for this part (every other component keeps the geometry exclusion)`);
  }
  // BLOCK-ROOT WIDTH (Card live finding, live-paste-3): a block-display root
  // fills its container in CSS — the canvas hug reads as "not a card." The
  // captured stage width IS the rendered truth of the capture (same
  // stage-dependent receipt as the slider root); admit the root's width
  // channel when its computed display is uniformly block.
  const rootPi = a.baseFlat.findIndex((e) => e.path === '');
  const blockRootAdmit = new Set<number>();
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
    if (seen > 0 && block) {
      blockRootAdmit.add(rootPi);
      receipts.push(`block-root-width-admitted: ${a.partNames[rootPi]} — display:block root fills its container in CSS; the captured stage width joins fusion (stage-dependent, receipted — the canvas card draws at the captured block width instead of hugging its text)`);
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
  for (let pi = 0; pi < a.baseFlat.length; pi++) {
    const set = new Set<string>();
    const inTableBox = table.lowered.has(pi);
    const admit = (p: string): boolean =>
      isFusable(p) ||
      (GEOM_ADMIT.has(p) && !inTableBox && (absAdmit.has(pi) || parentAdmit.has(pi))) ||
      ((p === 'width' || p === 'height') && table.cellAdmit.has(pi)) ||
      (p === 'width' && blockRootAdmit.has(pi));
    const tag = a.baseFlat[pi].node.tag;
    const ctrl = controls[tag] ?? controls['span'];
    if (!controls[tag]) receipts.push(`control-fallback: no control for <${tag}> — span control used (part ${a.partNames[pi]})`);
    for (const p of allProps) {
      // R4: the -webkit census runs over the SAME comparison the fusion door
      // uses (differs from the control), on the channels the door refuses.
      if (p.startsWith('-webkit-') && a.baseFlat[pi].node.style[p] !== ctrl[p]) {
        (webkitStyled.get(p) ?? webkitStyled.set(p, new Set()).get(p)!).add(a.partNames[pi]);
      }
      if (!admit(p)) continue;
      if (a.baseFlat[pi].node.style[p] !== ctrl[p]) set.add(p);
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
    if (a.baseFlat[pi].node.nodes.some((n) => n.t === 'el' && n.el.tag === 'svg') && !set.has('color')) {
      set.add('color');
      receipts.push(`svg-host-color-carried: ${a.partNames[pi]} — color carried even though equal to the control baseline (the hosted glyph rides the color chain; generated surfaces have no Polaris body context — round 5c)`);
    }
    const hasText = a.baseFlat[pi].node.nodes.some((n) => n.t === 'text' && n.v.trim().length > 0);
    const srOnly = (a.baseFlat[pi].node.style['clip-path'] ?? '').startsWith('inset(50%');
    if (hasText && !srOnly) {
      const added: string[] = [];
      for (const ch of ['font-size', 'line-height', 'font-weight']) {
        if (!set.has(ch)) { set.add(ch); added.push(ch); }
      }
      if (added.length > 0) {
        receipts.push(`text-part-typography-carried: ${a.partNames[pi]} — ${added.join('/')} carried even though equal to the control baseline (context-inherited typography IS the rendered truth; the generated surfaces have no Polaris body context, and the canvas otherwise draws its own 14px/500 defaults — round 5c)`);
      }
    }
    out.set(a.partNames[pi], set);
  }
  // R4: emit the -webkit census. One line per prefixed channel the subject
  // actually styles, naming the channel and the parts, plus a count — so
  // "the blanket refused nothing here" and "the blanket ate a construct" are
  // different, visible facts. `-webkit-line-clamp` gets the argued refusal it
  // has earned by measurement (see WEBKIT_NOTES).
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
export function detectFolds(a: AlignedSweep, styled: Map<string, Set<string>>): FoldReceipt[] {
  const folds: FoldReceipt[] = [];
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
      if (CURRENTCOLOR_FOLD_CANDIDATES.has(ch)) {
        let holds = true;
        for (const c of a.captures) {
          const el = a.getAligned(`${c.combo}__${c.interaction}`)[pi];
          if (!el) continue;
          if (el.node.style[ch] !== el.node.style['color']) { holds = false; break; }
        }
        if (holds) { folds.push({ part, channel: ch, foldedInto: 'color', class: 'currentColor' }); continue; }
      }
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
      if (holds && ratio !== null && ratio !== 0 && fontSizes.size >= 2) {
        folds.push({ part, channel: ch, foldedInto: 'font-size', ratio, class: 'em-tracking' });
      }
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
      if (maxRaw === undefined || maxRaw === 'none') continue;
      seen++;
      const max = pxValue(maxRaw);
      const width = pxValue(el.node.style['width']);
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
  enriched: Array<{ part: string; field: string; value: string }>;
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
    if (!target || !channels) continue;
    // only flex containers speak the layout vocabulary
    const baseDisplay = a.baseFlat[pi].node.style['display'];
    if (baseDisplay !== 'flex' && baseDisplay !== 'inline-flex') continue;
    for (const [channel, spec] of Object.entries(LAYOUT_CHANNEL_TO_FIELD)) {
      if (!channels.has(channel)) continue;
      const values = new Set<string>();
      for (const combo of enabled) {
        const el = a.getAligned(`${combo.key}__default`)[pi];
        if (el) values.add(el.node.style[channel]);
      }
      if (values.size !== 1) {
        out.receipts.push(`layout-not-uniform: ${partName}.${channel} varies across combos — stays code-only`);
        continue;
      }
      const observed = [...values][0];
      const canonical = spec.map[observed];
      const handledSet = out.handled.get(partName) ?? new Set<string>();
      out.handled.set(partName, handledSet);
      const carried = target.layout?.[spec.field];
      if (carried !== undefined) {
        handledSet.add(channel);
        if (canonical !== carried) {
          out.contradictions.push({ part: partName, field: spec.field, carried: String(carried), observed });
        }
        continue;
      }
      if (canonical === undefined) {
        out.receipts.push(`layout-value-outside-vocabulary: ${partName}.${channel} = "${observed}" — stays code-only`);
        continue;
      }
      handledSet.add(channel);
      out.enriched.push({ part: partName, field: spec.field, value: canonical });
    }
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
      const cPart = partByName.get(a.partNames[pi]);
      if (!cPart) continue;
      const carried = resolveTokens(cPart, subst);
      const el = alignedEls[pi];
      for (const [channel, ref] of Object.entries(carried)) {
        const computedProps = CHANNEL_TO_COMPUTED[channel];
        if (!computedProps) continue;
        for (const cp of computedProps) {
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
 *  territory; the mint pass never re-mints them. */
export function carriedChannels(part: Part | undefined): Set<string> {
  const out = new Set<string>();
  if (!part) return out;
  const addAll = (rec?: Record<string, string>) => {
    for (const ch of Object.keys(rec ?? {})) for (const cp of CHANNEL_TO_COMPUTED[ch] ?? []) out.add(cp);
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
  pairwiseRefusals: string[];
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
): MintPrep {
  const axes: MintAxis[] = space.axes.map((ax) => ({ propName: ax.prop, values: [...ax.values] }));
  const partByName = new Map(walkAnatomy(contract).map((w) => [w.name, w.part] as const));
  const foldedSet = new Set(folds.map((f) => `${f.part}|${f.channel}`));
  const enabledCombos = space.enumeration.combos.filter(isEnabled);

  const declarablePart = (partName: string): Part | undefined => {
    const p = partByName.get(partName);
    if (!p || p.component || p.slot) return undefined; // ref/slot parts never carry declared facts
    return p;
  };

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
      if (svgConsumedParts?.has(partName)) continue; // svg internals: carried by the promoted icon asset (round 4)
      const carried = carriedChannels(partByName.get(partName));
      for (const channel of [...(styled.get(partName) ?? [])].sort()) {
        if (carried.has(channel)) {
          const contestingAxis = contestedByUnsetAxis(pi, channel);
          if (contestingAxis === null) continue;
          if (skipFolds) {
            remintReceipts.push(
              `carried-channel-reminted: ${partName}.${channel} — observed values vary along the defaultless axis "${contestingAxis}" while the reviewed carriage has no ${contestingAxis} plane; re-minted so the set planes carry (round 5c — S2 ${contestingAxis} maps with the unset base; reviewed bindings win every collision)`,
            );
          }
        }
        if (layoutHandled?.get(partName)?.has(channel)) continue; // carried by Part.layout (enrichLayout)
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
          if (/^border-.*-radius$/.test(channel) && isAbsurdRadius(v)) {
            v = PILL_RADIUS_SENTINEL;
          }
          // Absolute-position round: %-radii on cluster parts resolve
          // against the part's own captured box (CSS: 50% of a 20px square
          // is the circle idiom) — baked to px so the mint carries them.
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
          if (v === undefined && SYNTHETIC_CHANNELS.has(channel)) v = '0px';
          if (v === undefined) { unk ??= '<channel absent in this combo>'; continue; }
          values.add(v);
          rows.push({ axisValues: combo.axisValues, value: v });
          const k = kindOf(channel, v);
          if (!k) { unk ??= v; continue; } // no break: declared detection needs the full value set
          occurrences.push({ variant: combo.key, axisValues: combo.axisValues, value: k.value });
        }
        if (values.size === 0) {
          // MUI round: interaction-only union parts (-active, -focusVisible
          // thumbs) have NO element in any __default alignment — zero
          // observations is a named refusal, not a mintable base fact.
          codeOnly.push({ part: partName, channel, reason: 'part absent in every default-state combo (interaction-only part) — state rounds own it', sample: '<no default-state observation>', distinctValues: 0 });
          continue;
        }
        if (unk !== null) {
          // Round 5c — set-plane literals for unmintable-kind geometry
          // channels (min-height 'auto' at base, '24px' on the set plane).
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
          const spec = DECLARED_CHANNELS[channel];
          const uniform = values.size === 1 ? [...values][0] : null;
          if (spec && uniform !== null && spec.value.test(uniform)) {
            if (declarablePart(partName)) {
              declared.push({ part: partName, channel, value: uniform });
            } else {
              codeOnly.push({ part: partName, channel, reason: 'declared channel on a computed-only (or ref/slot) part — adding parts is a curation decision, not a capture decision', sample: uniform, distinctValues: values.size });
            }
          } else if (spec && uniform !== null) {
            codeOnly.push({ part: partName, channel, reason: 'declared-channel value outside the bounded grammar — named residue (v15)', sample: uniform, distinctValues: values.size });
          } else if (spec) {
            codeOnly.push({ part: partName, channel, reason: 'declared-channel value varies across combos — declared facts carry uniform values only (v15); named residue', sample: unk, distinctValues: values.size });
          } else {
            codeOnly.push({ part: partName, channel, reason: 'value shape outside mintable kinds (color/px/number/shadow/gradient) and outside the declared-channel registry — no schema channel today', sample: unk, distinctValues: values.size });
          }
          continue;
        }
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
      if (svgConsumedParts?.has(partName)) continue;
      const ai = ancestorOf(pi);
      if (ai === null) continue;
      const ancestorName = a.partNames[ai];
      const ancestorCarries = carriedChannels(partByName.get(ancestorName));
      const ancestorStyled = styled.get(ancestorName) ?? new Set<string>();
      for (const channel of [...(styled.get(partName) ?? [])].sort()) {
        if (!INHERITED_CHANNELS.has(channel)) continue;
        // The ancestor must itself CARRY the channel — reviewed or mintable.
        // Without that, dropping the child's binding would leave the channel
        // bound nowhere and the "never worse" argument would not hold.
        if (!ancestorCarries.has(channel) && !ancestorStyled.has(channel)) {
          inheritanceReceipts.push(
            `inheritance-check-rejected: ${partName}.${channel} — values track ancestor "${ancestorName}" but that ancestor carries the channel nowhere; the binding STAYS (dropping it would bind the channel nowhere)`,
          );
          continue;
        }
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
      if (!a.byKey.has(`${combo.key}__${interaction}`)) continue;
      const els = a.getAligned(`${combo.key}__${interaction}`);
      for (let pi = 0; pi < a.baseFlat.length; pi++) {
        if (svgConsumedParts?.has(a.partNames[pi])) continue;
        const d0 = defaults[pi];
        const d1 = els[pi];
        if (!d0 || !d1) continue;
        for (const p of allProps) {
          if (!isFusable(p)) continue;
          const pv0 = planeValue(d0.node.style, p);
          const pv1 = planeValue(d1.node.style, p);
          if (pv0 === pv1) continue;
          if (pv1 === undefined) continue; // channel unobserved on this interaction plane
          if (!isEnabled(combo)) {
            const flagged = Object.entries(combo.stateFlags).filter(([, f]) => f).map(([n]) => n).join('+');
            inertOnDisabled.push(`interaction-on-${flagged}-changed: ${combo.key} ${interaction} ${a.partNames[pi]}.${p}`);
            continue;
          }
          pushStateValue(interaction, a.partNames[pi], p, combo, pv1);
        }
      }
    }
  }
  // state-props (disabled-like): diff each flagged combo against its unflagged twin
  for (const s of space.stateProps) {
    for (const combo of space.enumeration.combos) {
      if (!combo.stateFlags[s.prop]) continue;
      // twin = same axis values + same other flags, this flag false
      const twin = space.enumeration.combos.find(
        (c) =>
          space.axes.every((ax) => c.axisValues[ax.prop] === combo.axisValues[ax.prop]) &&
          space.stateProps.every((sp) => c.stateFlags[sp.prop] === (sp.prop === s.prop ? false : combo.stateFlags[sp.prop])),
      );
      if (!twin || !isEnabled(twin)) continue;
      const d0 = a.getAligned(`${twin.key}__default`);
      const d1 = a.getAligned(`${combo.key}__default`);
      for (let pi = 0; pi < a.baseFlat.length; pi++) {
        if (svgConsumedParts?.has(a.partNames[pi])) continue;
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
    const foldedChannel = foldedSet.has(`${d.part}|${d.channel}`);
    if (foldedChannel) foldedStateSkips.push(`fold-carries-state-delta: [${d.state}] ${d.part}.${d.channel} rides its source fact`);
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
    pairwiseRefusals: folded.pairwiseRefusals,
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
): ApplyResult {
  const enriched = structuredClone(contract) as Contract & Record<string, unknown>;
  const overflowBindings: OverflowBinding[] = [];
  const enrichmentNotes: string[] = [];
  const partByName = new Map(walkAnatomy(enriched).map((w) => [w.name, w.part] as const));
  for (const le of layoutEnrichments) {
    const target = partByName.get(le.part);
    if (!target) continue;
    target.layout ??= {};
    (target.layout as Record<string, string>)[le.field] = le.value;
    enrichmentNotes.push(`layout enriched: ${le.part}.layout.${le.field} = ${le.value} (uniform computed keyword — the schema's own vocabulary)`);
  }
  // v15 declared facts (S4): uniform registry-channel values → Part.declared;
  // full-coverage uniform state deltas → Part.declaredStates. The reviewed
  // static layer wins on collision (??=), like every other enrichment.
  for (const de of declaredEnrichments) {
    const target = partByName.get(de.part);
    if (!target || target.component || target.slot) continue; // guarded upstream; belt and braces
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
        overflowBindings.push({ part: partName, channel, ...(state ? { state } : {}), refusal: b.reason ?? 'uncorrelated' });
        return;
      }
      const target = partByName.get(partName);
      if (!target) {
        overflowBindings.push({ part: partName, channel, ...(state ? { state } : {}), ref: b.ref, refusal: 'computed-only part not present in the committed anatomy — adding parts is a curation decision, not a capture decision' });
        return;
      }
      const inner = b.ref.slice(1, -1);
      const phs = placeholdersOf(inner);

      if (state) {
        if (!STATE_SUFFIXES.includes(state as (typeof STATE_SUFFIXES)[number])) {
          overflowBindings.push({ part: partName, channel, state, ref: b.ref, refusal: 'state outside the schema state vocabulary' });
          return;
        }
        const declareState = () => {
          if (!(enriched.states as string[]).includes(state)) (enriched.states as string[]).push(state as never);
        };
        if (phs.some((p) => space.presence.has(p))) {
          overflowBindings.push({ part: partName, channel, state, ref: b.ref, refusal: 'presence-prop state ref — boolean substitution has no spelling (round 4 residue)' });
          return;
        }
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
        if (!axis) {
          overflowBindings.push({ part: partName, channel, ref: b.ref, refusal: `substituted axis "${axisProp}" not an enumerated axis` });
          return;
        }
        if (space.presence.has(axisProp)) {
          // Round 4: presence axes are BOOLEAN contract props — tokensByProp
          // has no boolean spelling; presence-driven styling is named residue
          // (the created SUBTREE itself is carried via visibleWhen instead).
          overflowBindings.push({ part: partName, channel, ref: b.ref, refusal: `presence-prop-driven styling (${axisProp}) — boolean tokensByProp has no spelling (round 4 residue)` });
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
        if (space.presence.has(pa) || space.presence.has(pb)) {
          overflowBindings.push({ part: partName, channel, ref: b.ref, refusal: 'presence-prop pair ref — boolean tokensByProp has no spelling (round 4 residue)' });
          return;
        }
        const ua = unsetAxes.get(pa);
        const ub = unsetAxes.get(pb);
        if (ua !== undefined && ub !== undefined) {
          overflowBindings.push({ part: partName, channel, ref: b.ref, refusal: 'pair ref over TWO unset axes — no carried spelling; named residue' });
          return;
        }
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
    for (let i = 0; i < flatC.length; i++) {
      for (const pe of DECOR_PSEUDOS) {
        const now = flatC[i]?.node.pseudo[pe];
        if (!now) continue;
        const before = flatD[i]?.node.pseudo[pe];
        const delta: StyleMap = {};
        for (const [k, v] of Object.entries(now)) {
          if (!before || before[k] !== v) delta[k] = v;
        }
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
