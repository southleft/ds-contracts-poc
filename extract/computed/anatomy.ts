/**
 * COMPUTED-CAPTURE FLOOR — Round 4: DOM-ANATOMY PROMOTION.
 *
 * The decisive fix for the one-to-one round: computed-only DOM elements —
 * captured by the floor but never carried — become REAL contract parts.
 *
 *   · UNION ALIGNMENT — captures are aligned into ONE union tree by
 *     hierarchical signature matching (tag + class stems, nth occurrence
 *     among same-signature siblings within the SAME parent), replacing the
 *     path-equality alignment that could only see the base combo's tree.
 *     Structure-creating optional props (Banner onDismiss → dismiss button)
 *     add union parts that the base combo never renders.
 *   · PART PROMOTION — every union element becomes a Part in the enriched
 *     contract at its captured nesting position. The static layer wins NAMES
 *     and semantics (§4.5): a static part with no captured name-match is
 *     re-joined by element/content evidence before anything is invented.
 *   · SVG CONTENT AS ASSETS — an element subtree rooted at <svg> is carried
 *     as a committed icon asset reconstructed from captured computed truth
 *     (the CSS `d` property carries every path's geometry; fill/fill-rule
 *     ride along). Markup varying over ONE axis lands as per-value icon
 *     parts gated by visibleWhen — existing vocabulary, no new schema.
 *     The viewBox is reconstructed from the svg's computed size and checked
 *     against the path data's coordinate extent — a NAMED reconstruction.
 *   · PRESENCE FACTS — a part present in only some combos carries
 *     visibleWhen (single boolean-true factor) and/or stylesWhen
 *     display:none entries (per-axis complement factors) when its presence
 *     set factors as a product of per-axis sets; anything else refuses BY
 *     NAME (never a silently always-drawn phantom).
 *
 * Pure module (no fs, no browser): run.ts writes the asset files.
 */
import type { Contract, Part } from '../../scripts/contract-schema.js';
import { GRID_REFUSALS, walkAnatomy } from '../../scripts/contract-schema.js';
import { parseGridAutoFlow, parseGridLine, parseGridSelfAlign, parseGridTemplateAreas, parseGridTrackList, type GridAreaIR, type GridTrackIR } from '../../core/grid-css.js';
import { PRESENCE_ON, PRESENCE_OFF, type ComponentConfig, type PropSpace } from './capture.js';
import { DECOR_PSEUDOS, isAbsurdRadius, PILL_RADIUS_SENTINEL, signature, stems, type Capture, type CapturedNode, type Combo, type FlatEl } from './lib.js';

// ---------------------------------------------------------------------------
// ORGANISM ROUND (Table) — TABLE-DISPLAY LOWERING
// ---------------------------------------------------------------------------
/** The CSS table box model is outside EVERY vocabulary the schema speaks:
 *  `LayoutSchema.display` is flex|inline-flex and the declared registry is
 *  inline|inline-block|block|contents|none. Before this round a
 *  `display:table-row` part fell through to the
 *  `display-outside-vocabulary` receipt and then took the emitter's default
 *  layoutSpec (HORIZONTAL/CENTER/CENTER) — structurally wrong for a table
 *  and SILENT.
 *
 *  The decision (organism round): do NOT grow the declared registry with
 *  table keywords no target can render. LOWER the table box model to the
 *  flex vocabulary it is behaviorally equivalent to for the non-spanning,
 *  colgroup-free case the anatomy can see:
 *
 *    table / inline-table / table-header-group / table-row-group /
 *    table-footer-group        → column stack, children stretch (rows fill
 *                                the table width — exactly what a table does)
 *    table-row                 → row, children stretch (every cell takes the
 *                                row's height — the table box model's own
 *                                rule; the CELLS then center their content)
 *    table-cell                → row; counter axis from the cell's OWN
 *                                computed vertical-align, main axis from its
 *                                computed text-align (align="right" columns)
 *    table-column / -caption   → NOT lowered (named residue below)
 *
 *  Everything the lowering cannot express — border-collapse, border-spacing,
 *  table-layout, colspan/rowspan — keeps flowing through the ordinary
 *  declared/codeOnly path and is named there.
 *
 *  Every lowering emits a `table-lowering:` receipt. */
const TABLE_DISPLAYS = new Set([
  'table', 'inline-table', 'table-header-group', 'table-row-group', 'table-footer-group',
  'table-row', 'table-cell',
]);

export const isTableDisplay = (d: string | undefined): boolean => (d ?? '').startsWith('table') || d === 'inline-table';

export interface TableLowering {
  layout: NonNullable<Part['layout']>;
  note: string;
}

/** Pure: lower ONE computed table display to the flex vocabulary, reading
 *  the element's own vertical-align / text-align for the axis alignments.
 *  Returns null for table displays outside the lowered set (named residue). */
export function lowerTableDisplay(display: string, style: Record<string, string>): TableLowering | null {
  const vAlign = style['vertical-align'] ?? '';
  const counter =
    vAlign === 'middle' ? 'center' : vAlign === 'bottom' ? 'end' : vAlign === 'top' ? 'start' : null;
  switch (display) {
    case 'table':
    case 'inline-table':
    case 'table-header-group':
    case 'table-row-group':
    case 'table-footer-group':
      return {
        layout: { display: 'flex', direction: 'column', align: 'stretch' },
        note: `${display} → flex column, children stretch (row groups stack and fill the table width)`,
      };
    case 'table-row':
      return {
        layout: { display: 'flex', direction: 'row', align: 'stretch' },
        note: 'table-row → flex row, children stretch (every cell takes the row height — the table box model\'s own rule; the cell centers its own content)',
      };
    case 'table-cell': {
      const ta = style['text-align'] ?? '';
      const justify = ta === 'right' || ta === 'end' ? 'end' : ta === 'center' ? 'center' : 'start';
      return {
        layout: { display: 'flex', direction: 'row', align: counter ?? 'center', justify },
        note: `table-cell → flex row (counter axis ${counter ?? 'center (vertical-align "' + (vAlign || 'unset') + '" outside the lowered set — middle assumed, named)'}, main axis ${justify} from text-align:${ta || 'unset'})`,
      };
    }
    default:
      return null;
  }
}

/** CARBON LIVE-DEFECT ROUND (D3) — CSS GRID LOWERED TO THE FLEX VOCABULARY.
 *
 *  `display:grid` / `inline-grid` had NO lowering at all: the part fell to the
 *  `display-outside-vocabulary` receipt, carried no `layout` and no `declared
 *  .display`, and the emitter's HORIZONTAL default then drew Carbon's Modal
 *  header/body/footer SIDE BY SIDE inside a container narrower than any of
 *  them (`modal-container` grid, 1 column × 4 rows) — the live paste's
 *  overlapping copy. Two of Carbon's ten components are built this way.
 *
 *  The lowering is MEASURED, never guessed: `grid-template-columns` and
 *  `grid-template-rows` resolve to explicit px track lists in computed style,
 *  so the track COUNTS are captured facts.
 *    · 1 column, ≥1 row   → flex COLUMN (a stack)      — gap from `row-gap`
 *    · 1 row, >1 column   → flex ROW                   — gap from `column-gap`
 *    · >1 column AND >1 row → REFUSED BY NAME: a 2D grid has no auto-layout
 *      spelling; one axis would have to be invented.
 *    · no explicit tracks (implicit-only) → REFUSED BY NAME.
 *  Item alignment follows CSS: the lowered flex CROSS axis takes
 *  `justify-items` for a column stack (cross = inline) and `align-items` for
 *  a row (cross = block). Grid's own default for both is `normal`, which for
 *  grid items MEANS stretch — carried as such, not dropped. */
export interface GridLowering {
  layout: NonNullable<Part['layout']>;
  note: string;
}

const gridTracks = (v: string | undefined): number => {
  const s = (v ?? 'none').trim();
  if (s === 'none' || s === '' || s === 'auto') return 0;
  return s.split(/\s+(?![^[]*\])/).filter((t) => t !== '' && !t.startsWith('[')).length;
};

const gridAlign = (v: string | undefined): 'start' | 'center' | 'end' | 'stretch' => {
  const s = (v ?? 'normal').trim().split(/\s+/).pop() ?? 'normal';
  if (s === 'center') return 'center';
  if (s === 'start' || s === 'flex-start' || s === 'self-start' || s === 'left') return 'start';
  if (s === 'end' || s === 'flex-end' || s === 'self-end' || s === 'right') return 'end';
  return 'stretch'; // 'normal' / 'stretch' — a grid item's default IS stretch
};

/** G8 (2026-08-08) — THE COMPUTED READER'S DEFINITE-AXIS OBLIGATION.
 *
 *  A grid part must make each axis definite on the axes where the two surfaces
 *  disagree about silence — an axis whose declared tracks carry NO {fr}
 *  (`grid-axis-indefinite`; an fr-bearing axis is sized from outside on both
 *  surfaces and is exempt). This reader has the strongest evidence of the
 *  three: the USED size, in px, straight off computed style. So it does not
 *  guess:
 *
 *    · used size == the intrinsic track sum (tracks + gaps + padding)
 *        -> `fit-content`: the box IS its content, exactly, and the canvas can
 *           hug it (layoutSizing HUG, the G8 lowering).
 *    · used size  > that sum
 *        -> the observed px: the box is established from OUTSIDE and hugging it
 *           would silently shrink the component.
 *
 *  Mutates `literals` in place; an axis another door already stated is left
 *  alone. Returns the receipts, never throws. */
export function gridDefiniteAxisLiterals(
  layout: NonNullable<Part['layout']>,
  style: Record<string, string>,
  literals: Record<string, string>,
  label: string,
): string[] {
  const out: string[] = [];
  if (layout.display !== 'grid') return out;
  const px = (v: string | undefined): number | null => {
    const m = /^(-?\d*\.?\d+)px$/.exec((v ?? '').trim());
    return m ? Number(m[1]) : null;
  };
  const hasFr = (tracks: ReadonlyArray<Record<string, unknown>> | undefined): boolean =>
    (tracks ?? []).some((t) => t !== null && typeof t === 'object' && 'fr' in t);
  const rowsDerived = layout.flow === 'row' && layout.rows === undefined;
  for (const axis of ['width', 'height'] as const) {
    const tracks = axis === 'width' ? layout.columns : layout.rows;
    if (axis === 'width' ? hasFr(tracks) : rowsDerived || hasFr(tracks)) continue;
    if (literals[axis] !== undefined) continue;
    const used = px(style[axis]);
    const gap = axis === 'width' ? layout.gap?.column : layout.gap?.row;
    const gapPx = typeof gap === 'number' ? gap : 0;
    const pad = axis === 'width'
      ? (px(style['padding-left']) ?? 0) + (px(style['padding-right']) ?? 0)
      : (px(style['padding-top']) ?? 0) + (px(style['padding-bottom']) ?? 0);
    let sum: number | null = 0;
    for (const t of tracks ?? []) {
      const v = (t as { px?: number }).px;
      if (typeof v !== 'number') { sum = null; break; }
      sum += v;
    }
    if (sum !== null) sum += gapPx * Math.max(0, (tracks ?? []).length - 1) + pad;
    // @door anatomy.grid-definite-axis-hug
    if (used !== null && sum !== null && Math.abs(used - sum) <= 0.5) {
      literals[axis] = 'fit-content';
      out.push(
        `grid-axis-definite: ${label} ${axis} carried as literals.${axis} "fit-content" (G8) — the used box ${used}px equals the intrinsic track sum (${sum}px), so the box IS its content and the canvas can hug it instead of keeping createFrame's FIXED 100 default (FC-GRID-ROOT-VSIZE)`,
      );
    } else if (used !== null) {
      literals[axis] = `${Math.round(used * 100) / 100}px`;
      out.push(
        `grid-axis-definite: ${label} ${axis} carried as literals.${axis} ${literals[axis]} (G8) — the used box${sum !== null ? ` exceeds the intrinsic track sum (${sum}px)` : ' cannot be summed from the declared tracks'}, so the size is established from OUTSIDE the part and "fit-content" would silently shrink it`,
      );
    } else {
      literals[axis] = 'fit-content';
      out.push(
        `grid-axis-definite: ${label} ${axis} carried as literals.${axis} "fit-content" (G8) — no used ${axis} in computed style; every declared ${axis === 'width' ? 'column' : 'row'} track is fixed or content-sized, so content sizing is the CSS truth`,
      );
    }
  }
  return out;
}

export function lowerGridDisplay(
  display: string,
  style: Record<string, string>,
  declared?: Record<string, string[]>,
): GridLowering | { refusal: string } | null {
  if (display !== 'grid' && display !== 'inline-grid') return null;
  // A2 (G7) — THE NAMED-REFUSAL FENCE RUNS BEFORE THE FLEX LOWERING.
  // docs/research/layout-grammar-proposal.md pins these constructs as
  // REFUSED BY NAME (each with its probe dead-end); the lowering below used
  // to absorb them into a flex row/column with a generic `grid-lowering`
  // receipt, which is exactly the receipt-drift the conformance gate's
  // WRONG-NAME verdict exists to catch. Two evidence planes:
  //   · computed truth — grid-auto-flow keeps `dense`/`column` verbatim, and
  //     grid-template-* keeps `subgrid` verbatim, so those three refuse from
  //     the computed read alone.
  //   · declared truth (`gdecl`, the capture's grid declared-track read) —
  //     minmax()/percent/auto-fit tracks resolve to USED px in computed
  //     style (P6/P2b constructs invisible after resolution), so their
  //     refusal reads the authored declaration.
  // @door anatomy.grid-g7-refusal-fence
  const flow = parseGridAutoFlow(style['grid-auto-flow'] || 'row');
  if (flow.refusal) return { refusal: flow.refusal }; // grid-flow-column (P5b) / grid-flow-dense (P5)
  if (/^subgrid\b/.test((style['grid-template-columns'] ?? '').trim()) || /^subgrid\b/.test((style['grid-template-rows'] ?? '').trim())) {
    return { refusal: GRID_REFUSALS['grid-subgrid'] }; // P1: no track-inheritance surface
  }
  for (const prop of ['grid-template-columns', 'grid-template-rows']) {
    for (const v of declared?.[prop] ?? []) {
      // auto-fit/fill BEFORE minmax: `repeat(auto-fit, minmax(…))` is the
      // responsive-count family, not the per-track-clamp family (G7 rows are
      // distinct constructs and must not collapse into one message).
      if (/repeat\(\s*auto-(fit|fill)\b/.test(v)) return { refusal: GRID_REFUSALS['grid-auto-fit-minmax'] };
      if (v.includes('minmax(')) return { refusal: GRID_REFUSALS['grid-track-minmax'] }; // P6
      if (/^subgrid\b/.test(v.trim())) return { refusal: GRID_REFUSALS['grid-subgrid'] };
      // Percent TRACK tokens only — fit-content(100%) is the HUG spelling
      // (P14) and must not misfire the percent refusal.
      for (const tok of v.split(/\s+/)) {
        if (/^-?\d*\.?\d+%$/.test(tok)) return { refusal: GRID_REFUSALS['grid-track-percent'] }; // P2b
        // Zero tracks are their own G7 row (grid-track-zero, P2b silent-rewrite
        // hazard) and were the one pinned track refusal this fence did not
        // mirror from parseTrackToken: a declared `0px 1fr` used to fall
        // through to the generic flex lowering, so the registry name never
        // appeared in any artifact — the conformance gate's WRONG-NAME verdict
        // on grid-track-zero-value measured exactly that drift (2026-08-08).
        const zm = /^(-?\d*\.?\d+)(px|fr)$/.exec(tok);
        if ((zm && Number(zm[1]) === 0) || tok === '0') return { refusal: GRID_REFUSALS['grid-track-zero'] }; // P2b
      }
    }
  }
  const cols = gridTracks(style['grid-template-columns']);
  const rows = gridTracks(style['grid-template-rows']);
  const d = display === 'inline-grid' ? 'inline-flex' : 'flex';
  if (cols === 0 && rows === 0) {
    return { refusal: `grid-implicit-tracks: ${display} declares no explicit grid-template-columns/rows (implicit tracks only) — the track counts that decide the lowered axis are not measurable; no layout carried (named refusal)` };
  }
  if (cols > 1 && rows > 1) {
    return { refusal: `grid-two-dimensional: ${display} resolves ${cols} columns × ${rows} rows — a two-dimensional grid has no auto-layout spelling (one axis would have to be invented); no layout carried (named refusal)` };
  }
  if (cols <= 1) {
    return {
      layout: { display: d, direction: 'column', align: gridAlign(style['justify-items']) },
      note: `${display} ${cols || 1}×${rows} → flex column, cross-axis ${gridAlign(style['justify-items'])} from justify-items:${style['justify-items'] ?? 'normal'} (measured track counts)`,
    };
  }
  return {
    layout: { display: d, direction: 'row', align: gridAlign(style['align-items']) },
    note: `${display} ${cols}×${rows || 1} → flex row, cross-axis ${gridAlign(style['align-items'])} from align-items:${style['align-items'] ?? 'normal'} (measured track counts)`,
  };
}

// ---------------------------------------------------------------------------
// A2 GRID PROMOTION (G1/G2/G4/G5) — the computed floor's half of the pinned
// layout grammar (docs/research/layout-grammar-proposal.md). A display:grid
// part whose declared-track list, child anchors/spans and per-cell aligns are
// all readable promotes as a STRUCTURED grid: layout.rows/columns/gap/areas +
// Part.placement — the same contract facts the code proposer
// (core/propose-code.ts) and the emitters (core/emit-react gridParentDecls /
// gridPlacementDecls) already speak. Anything the grammar cannot carry
// ABANDONS the promotion with a receipt and falls back to the existing
// lowerGridDisplay path, whose G7 fence names every refusal — the promotion
// never invents a fact and never absorbs a refusal.
//
// Track truth has two evidence planes (same split as lowerGridDisplay):
//   · gdecl (the capture's declared-track read) carries fr/fit spellings that
//     computed style resolves to USED px ("160px 1fr 1fr 120px" computes to
//     "160px 156px 156px 120px") — a declared candidate is used ONLY when it
//     agrees with the computed geometry (same track count; every px track
//     equal within 0.5px), receipted;
//   · computed truth alone carries all-px grids exactly.
// Area names enter from the computed floor itself: an area-anchored child's
// computed grid-row/column-start/end serialize as the area IDENT (Chromium),
// and renameGridAreaParts (alignSweep) has already given such parts the area
// name, so the G4 "the area name IS the slot anchor" rule holds by name.
//
// G5 (auto placement) is promoted too — see the placement-from-order block
// below. An all-auto grid's cells are derived from CHILD ORDER exactly as CSS
// row flow resolves them, and are then DECLARED: as explicit `Part.placement`
// anchors when the author declared row tracks, or as `layout.flow: "row"` with
// rows omitted when they did not. Occupancy that leaves the declared track
// rectangle refuses by name (grid-implicit-tracks, P9) instead of letting the
// canvas absorb it.
// ---------------------------------------------------------------------------
export interface GridPromotionOk {
  layout: NonNullable<Part['layout']>;
  /** child part name → explicit placement (area-anchored children get none —
   *  the area rect IS their placement, G4). */
  placements: Map<string, NonNullable<Part['placement']>>;
  receipts: string[];
}
export interface GridPromotionAbandoned {
  abandon: string;
  receipts: string[];
}

const GRID_AREA_IDENT_RE = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const isAreaIdent = (v: string | undefined): v is string =>
  v !== undefined && v !== 'auto' && !v.startsWith('span') && !/^-?\d+$/.test(v) && GRID_AREA_IDENT_RE.test(v);

export function promoteGridLayout(
  label: string,
  rep: CapturedNode,
  children: Array<{ partName: string; rep: CapturedNode }>,
  childParts: Record<string, Part>,
): GridPromotionOk | GridPromotionAbandoned {
  const receipts: string[] = [];
  const abandon = (why: string): GridPromotionAbandoned => ({ abandon: why, receipts });

  // -- tracks (G1): declared candidate verified against computed geometry --
  const pxList = (raw: string): number[] | null => {
    const out: number[] = [];
    for (const tok of raw.trim().split(/\s+/)) {
      const m = /^(-?\d*\.?\d+)px$/.exec(tok);
      if (!m) return null;
      out.push(parseFloat(m[1]));
    }
    return out.length > 0 ? out : null;
  };
  const trackAxis = (axis: 'rows' | 'columns'): { tracks: GridTrackIR[] } | GridPromotionAbandoned => {
    const ch = axis === 'rows' ? 'grid-template-rows' : 'grid-template-columns';
    const computedRaw = (rep.style[ch] ?? 'none').trim();
    const computedPx = pxList(computedRaw);
    /** P9 / N-DISP-02 — a parseable DECLARED list with FEWER tracks than the
     *  resolved list is the implicit-track signature: Chromium's resolved
     *  grid-template-* includes implicitly-created tracks, so "declared 16px,
     *  resolved 16px 16px" means the browser grew the grid beyond the
     *  declaration. Carrying the resolved list would rewrite the author's
     *  declaration inside the contract — the exact silent absorption the
     *  grammar refuses BY NAME (grid-implicit-tracks). Recorded during the
     *  candidate walk; abandons only if NO candidate verifies (a longer
     *  matching rule that agrees with the geometry wins the cascade). */
    let implicitEvidence: { declared: string; declaredCount: number } | null = null;
    for (const dv of [...(rep.gdecl?.[ch] ?? [])].reverse()) {
      // later matching rules approximate the higher cascade; the geometry
      // check below is what actually admits a candidate.
      if (dv.trim() === computedRaw) continue; // all-px declaration — computed carries it below
      const parsed = parseGridTrackList(dv);
      if (parsed.receipts.refusals.length > 0) {
        // a declared G7 construct (minmax/percent/auto-fit/…) — abandon so
        // lowerGridDisplay's fence names the refusal (one naming source).
        return abandon(`declared ${ch} "${dv}" is a refused track construct — the G7 fence names it`);
      }
      if (!parsed.tracks) continue;
      const agrees =
        computedPx !== null &&
        parsed.tracks.length === computedPx.length &&
        parsed.tracks.every((t, i) => !('px' in t) || Math.abs(t.px - computedPx[i]) <= 0.5);
      // @door anatomy.grid-declared-track-verify
      if (agrees) {
        receipts.push(
          `grid-tracks-declared: ${label}.${ch} carries the DECLARED list "${dv}" — verified against computed "${computedRaw}" (${parsed.tracks.length} tracks; every px track agrees ≤0.5px; fr/fit spellings resolve to used px in computed style and are carried from source)`,
        );
        receipts.push(...parsed.receipts.lowered.map((l) => `grid-tracks-lowered: ${label}.${ch} ${l}`));
        return { tracks: parsed.tracks };
      }
      if (computedPx !== null && parsed.tracks.length < computedPx.length) {
        implicitEvidence = { declared: dv, declaredCount: parsed.tracks.length };
        continue; // named below — a later-verifying candidate may still win
      }
      receipts.push(
        `grid-tracks-declared-unverified: ${label}.${ch} declared "${dv}" does not agree with computed "${computedRaw}" — declared candidate dropped; computed truth decides`,
      );
    }
    // @door anatomy.grid-implicit-tracks-abandon
    if (implicitEvidence !== null) {
      return abandon(
        `${GRID_REFUSALS['grid-implicit-tracks']} — measured on ${label}.${ch}: the declaration "${implicitEvidence.declared}" lists ${implicitEvidence.declaredCount} track(s) while the resolved grid reads "${computedRaw}" (${computedPx?.length ?? '?'} tracks, implicit tracks included in Chromium's resolved value) — the occupancy grew the grid beyond the declared list, and carrying the resolved list would rewrite the declaration inside the contract (P9/N-DISP-02)`,
      );
    }
    const computed = parseGridTrackList(computedRaw);
    if (computed.receipts.refusals.length > 0 || !computed.tracks) {
      return abandon(`computed ${ch} "${computedRaw}" yields no carriageable track list`);
    }
    return { tracks: computed.tracks };
  };
  const rowsR = trackAxis('rows');
  if ('abandon' in rowsR) return rowsR;
  const colsR = trackAxis('columns');
  if ('abandon' in colsR) return colsR;
  const rows = rowsR.tracks;
  const columns = colsR.tracks;

  // -- flow fence (G5/G7): dense/column refuse via the fallback's fence --
  const flow = parseGridAutoFlow(rep.style['grid-auto-flow'] || 'row');
  if (flow.refusal) return abandon('grid-auto-flow is a refused flow — the G7 fence names it');

  // -- gap pair (G1) --
  const gapOf = (ch: 'row-gap' | 'column-gap'): number | GridPromotionAbandoned => {
    const v = (rep.style[ch] ?? 'normal').trim();
    if (v === 'normal' || v === '') return 0;
    const m = /^(-?\d*\.?\d+)px$/.exec(v);
    if (!m) return abandon(`${ch} "${v}" has no carriageable px spelling`);
    return Math.max(0, parseFloat(m[1]));
  };
  const gapRow = gapOf('row-gap');
  if (typeof gapRow !== 'number') return gapRow;
  const gapColumn = gapOf('column-gap');
  if (typeof gapColumn !== 'number') return gapColumn;

  // -- areas (G4): computed grid-template-areas serializes the full matrix --
  let areas: Record<string, GridAreaIR> | undefined;
  const areasRaw = (rep.style['grid-template-areas'] ?? 'none').trim();
  if (areasRaw !== 'none' && areasRaw !== '') {
    const parsed = parseGridTemplateAreas(areasRaw);
    if (!parsed.areas) return abandon(parsed.refusal ?? `grid-template-areas "${areasRaw}" unparseable`);
    if (parsed.rowCount !== rows.length || parsed.columnCount !== columns.length) {
      return abandon(
        `grid-template-areas matrix is ${parsed.rowCount}×${parsed.columnCount} but the declared tracks are ${rows.length}×${columns.length} — the two facts disagree`,
      );
    }
    areas = parsed.areas;
  }

  // -- children (G2): every promoted in-flow child places explicitly or is
  //    named by the area it occupies; anything else abandons --
  const entryNames = new Set(children.map((c) => c.partName));
  for (const [name, p] of Object.entries(childParts)) {
    if (!entryNames.has(name) && !p.overlay) {
      return abandon(`child part "${name}" has no captured grid anchors (synthetic/decor part) and is not an overlay — it cannot take a cell`);
    }
  }
  // -- G5 AUTO-PLACEMENT: PLACEMENT FROM ORDER --------------------------------
  // A grid whose children carry no explicit `grid-row`/`grid-column` is the
  // single most common way CSS authors write a grid, and its placement is not
  // ambiguous: CSS resolves it row-major across the declared columns with a
  // cursor that never moves backwards, spans shifting every later item (CSS
  // Grid §8.5, "sparse" packing — `dense` is refused by name, G7). The fact is
  // CHILD ORDER, and this round carries it two ways, both pinned by G5:
  //
  //   · the author DECLARED row tracks → MANUAL mode: the order-derived cells
  //     are carried as EXPLICIT `Part.placement` anchors. flow: "row" is not
  //     available here — G5 requires `rows` to be OMITTED under flow, so
  //     declaring flow would DROP the author's declared row list.
  //   · the author declared NO row tracks → G5 flow mode: `layout.flow: "row"`,
  //     rows omitted, no anchors carried. Every row of such a grid is IMPLICIT
  //     in CSS; carrying Chromium's resolved implicit row list would write a
  //     declaration the author never made (the P9 lossy edge), so the emitter
  //     derives ceil(children / columns) explicit tracks itself (G5/G6) and the
  //     contract never relies on implicit tracks.
  //
  // Either way the placement is DECLARED, never implied, and any occupancy that
  // leaves the declared track rectangle refuses BY NAME (grid-implicit-tracks,
  // P9) rather than emitting a placement the canvas would absorb by rewriting
  // the declaration.
  const inFlowKids = children.filter((c) => childParts[c.partName] !== undefined && !childParts[c.partName].overlay);
  const isAutoLine = (v: string | undefined): boolean => (v ?? 'auto').trim() === 'auto';
  const bothAuto = (c: { rep: CapturedNode }): boolean =>
    isAutoLine(c.rep.style['grid-row-start']) && isAutoLine(c.rep.style['grid-column-start']);
  const halfAuto = inFlowKids.find(
    (c) => isAutoLine(c.rep.style['grid-row-start']) !== isAutoLine(c.rep.style['grid-column-start']),
  );
  if (halfAuto) {
    return abandon(
      `child "${halfAuto.partName}" is auto-placed on ONE axis and explicit on the other (grid-row-start "${(halfAuto.rep.style['grid-row-start'] ?? 'auto').trim()}", grid-column-start "${(halfAuto.rep.style['grid-column-start'] ?? 'auto').trim()}") — a half-auto item's cell is a function of the solver's per-axis cursor, not a declared fact (G2: explicit anchors, or G5: whole-grid child order)`,
    );
  }
  const autoKids = inFlowKids.filter(bothAuto);
  if (autoKids.length > 0 && autoKids.length < inFlowKids.length) {
    return abandon(
      `${autoKids.length} of ${inFlowKids.length} in-flow children are auto-placed and the rest carry explicit lines — G2 pins that every direct child places explicitly OR none does (auto-flow, G5); mixing is schema-invalid`,
    );
  }
  /** part name → the order-derived cell (MANUAL mode only; empty under flow). */
  let ordered: Map<string, { row: number; column: number; rowSpan: number; columnSpan: number }> | null = null;
  let flowRow = false;
  if (autoKids.length > 0) {
    /** An auto-placed item carries only a SPAN on each axis (`auto / span N`);
     *  anything else on the end line is not a cell this reader can declare. */
    const spanOf = (endRaw: string | undefined, axis: string, who: string): number | GridPromotionAbandoned => {
      const end = (endRaw ?? 'auto').trim();
      if (end === 'auto' || end === '') return 1;
      const m = /^span\s+(\d+)$/.exec(end);
      if (m && Number(m[1]) >= 1) return Number(m[1]);
      return abandon(
        `auto-placed child "${who}" reads ${axis} end line "${end}" — an auto-placed item carries only a span (CSS Grid §8.5); a named or numeric end line against an auto start is not a declared cell`,
      );
    };
    const cols = columns.length;
    const taken = new Set<string>();
    const blocked = (r: number, c: number, rs: number, cs: number): boolean => {
      for (let y = r; y < r + rs; y++) for (let x = c; x < c + cs; x++) if (taken.has(`${y},${x}`)) return true;
      return false;
    };
    const derived = new Map<string, { row: number; column: number; rowSpan: number; columnSpan: number }>();
    let curRow = 0;
    let curCol = 0;
    for (const c of inFlowKids) {
      const rowSpan = spanOf(c.rep.style['grid-row-end'], 'grid-row', c.partName);
      if (typeof rowSpan !== 'number') return rowSpan;
      const columnSpan = spanOf(c.rep.style['grid-column-end'], 'grid-column', c.partName);
      if (typeof columnSpan !== 'number') return columnSpan;
      if (columnSpan > cols) {
        return abandon(
          `auto-placed child "${c.partName}" spans ${columnSpan} columns but the grid declares ${cols} — P3's exact throw class ("Column span exceeds grid column count"); CSS clamps the span silently, the canvas refuses the write, so the contract refuses too`,
        );
      }
      let r = curRow;
      let col = curCol;
      if (col + columnSpan > cols) { r += 1; col = 0; }
      while (blocked(r, col, rowSpan, columnSpan)) {
        col += 1;
        if (col + columnSpan > cols) { r += 1; col = 0; }
      }
      for (let y = r; y < r + rowSpan; y++) for (let x = col; x < col + columnSpan; x++) taken.add(`${y},${x}`);
      derived.set(c.partName, { row: r, column: col, rowSpan, columnSpan });
      curRow = r;
      curCol = col + columnSpan;
    }
    const occupiedRows = [...derived.values()].reduce((n, d) => Math.max(n, d.row + d.rowSpan), 0);
    const unitSpans = [...derived.values()].every((d) => d.rowSpan === 1 && d.columnSpan === 1);
    const orderNote =
      `${inFlowKids.length} auto-placed child(ren) over ${cols} declared column track(s) → ${occupiedRows} occupied row(s)` +
      (unitSpans ? ` (ceil(${inFlowKids.length}/${cols}), P9's derivation)` : ' (spans shift the row-major cursor — occupancy honored exactly as CSS row flow does, §8.5)');
    const rowsDeclared = (rep.gdecl?.['grid-template-rows'] ?? []).length > 0;
    if (rowsDeclared) {
      ordered = derived;
      receipts.push(
        `grid-order-placement: ${label} — ${orderNote}; the author DECLARED ${rows.length} row track(s), which flow: "row" would have to DROP (G5 omits rows under flow), so the derived cells are carried as EXPLICIT Part.placement anchors instead (G2) — child order is the source, the anchor is the carried fact, and no cell relies on an implicit track (P9)`,
      );
    } else {
      if (areas) {
        return abandon(
          `${label} declares grid-template-areas AND places every child by order — a grid declares areas or flow, never both (G4/G5: under flow the placement fact is child order, and the canvas refuses position setters under ROW_AUTO_FLOW, P5)`,
        );
      }
      const autoRows = (rep.style['grid-auto-rows'] ?? 'auto').trim();
      if (autoRows !== 'auto' && autoRows !== '') {
        return abandon(
          `${GRID_REFUSALS['grid-implicit-tracks']} — measured on ${label}: every row of this order-placed grid is implicit (no declared grid-template-rows) and \`grid-auto-rows: ${autoRows}\` SIZES those implicit tracks; under flow the contract omits rows and the emitter derives them (G5), so the authored implicit-track size has nowhere to land`,
        );
      }
      if (occupiedRows !== rows.length) {
        return abandon(
          `${GRID_REFUSALS['grid-implicit-tracks']} — measured on ${label}: order derivation occupies ${occupiedRows} row(s) (${orderNote}) but the resolved grid-template-rows reads ${rows.length} track(s) ("${(rep.style['grid-template-rows'] ?? 'none').trim()}"); the browser materialized tracks the derivation does not predict, so the derived row list would be a guess`,
        );
      }
      flowRow = true;
      receipts.push(
        `grid-flow-order-placement: ${label} — ${orderNote}; the author declared NO row tracks, so layout.flow "row" carries the order fact (G5: gridItemsPositioning ROW_AUTO_FLOW, placement fact = CHILD ORDER, P5) and \`rows\` is OMITTED — the resolved implicit row list ("${(rep.style['grid-template-rows'] ?? 'none').trim()}") is NOT carried, because it is a declaration the author never made (P9); the emitter declares ceil(${inFlowKids.length}/${cols}) = ${occupiedRows} explicit row track(s) itself on the canvas surface (G5/G6), never an implicit one`,
      );
    }
  }

  const placements = new Map<string, NonNullable<Part['placement']>>();
  const rects: Array<{ who: string; r: number; c: number; rs: number; cs: number }> = [];
  for (const c of children) {
    const part = childParts[c.partName];
    if (!part) continue; // refused by the promotion — not a contract child
    if (part.overlay) continue; // out-of-flow grammar (P13)
    if (part.declared?.['display'] === 'none') {
      return abandon(`child "${c.partName}" is carried as display:none (sr-only) — a hidden box has no cell to take`);
    }
    const s = c.rep.style;
    const rs = (s['grid-row-start'] ?? 'auto').trim();
    const re = (s['grid-row-end'] ?? 'auto').trim();
    const cs = (s['grid-column-start'] ?? 'auto').trim();
    const ce = (s['grid-column-end'] ?? 'auto').trim();
    if (isAreaIdent(rs)) {
      // area-anchored child: all four computed lines carry the area ident
      if (re !== rs || cs !== rs || ce !== rs) {
        return abandon(`child "${c.partName}" mixes the area ident "${rs}" with explicit lines (${re}/${cs}/${ce})`);
      }
      if (!areas?.[rs]) return abandon(`child "${c.partName}" is anchored to area "${rs}" which grid-template-areas does not declare`);
      if (c.partName !== rs) {
        return abandon(`child "${c.partName}" occupies area "${rs}" but could not take its name (G4: the area name IS the slot anchor; see grid-area-name receipts)`);
      }
      continue; // the area rect IS the placement (validateGridPart reads areas[name])
    }
    const alignOf = (raw: string | undefined, ch: string): { align?: 'start' | 'center' | 'end' } | GridPromotionAbandoned => {
      const v = (raw ?? 'auto').trim();
      if (v === 'auto' || v === 'normal') return {};
      const p = parseGridSelfAlign(v);
      if (p.refusal) return abandon(`child "${c.partName}" ${ch}: ${p.refusal}`);
      if (p.lowered) {
        receipts.push(`grid-align-lowered: ${c.partName}.${ch} — ${p.lowered}`);
        return {};
      }
      return { align: p.align };
    };
    const ax = alignOf(s['justify-self'], 'justify-self');
    if ('abandon' in ax) return ax;
    const ay = alignOf(s['align-self'], 'align-self');
    if ('abandon' in ay) return ay;
    // G5 — the order-derived cell (see the auto-placement block above). Under
    // flow the child carries NO anchor at all: the placement fact IS the child
    // order, and the canvas refuses position setters under ROW_AUTO_FLOW (P5).
    if (rs === 'auto') {
      if (flowRow) continue;
      const d = ordered?.get(c.partName);
      if (!d) {
        return abandon(`child "${c.partName}" is auto-placed but the order derivation produced no cell for it — placement-from-order (G5) cannot be declared for this grid`);
      }
      placements.set(c.partName, {
        row: d.row,
        column: d.column,
        ...(d.rowSpan > 1 ? { rowSpan: d.rowSpan } : {}),
        ...(d.columnSpan > 1 ? { columnSpan: d.columnSpan } : {}),
        ...(ax.align ? { alignX: ax.align } : {}),
        ...(ay.align ? { alignY: ay.align } : {}),
      });
      rects.push({ who: `order-placed part "${c.partName}"`, r: d.row, c: d.column, rs: d.rowSpan, cs: d.columnSpan });
      continue;
    }
    const lineOf = (startRaw: string, endRaw: string, axis: string): { anchor: number; span: number } | GridPromotionAbandoned => {
      const spec = endRaw === 'auto' || endRaw === '' ? startRaw : `${startRaw} / ${endRaw}`;
      const p = parseGridLine(spec);
      if (p.refusal || p.anchor === undefined) return abandon(`child "${c.partName}" ${axis} "${spec}": ${p.refusal ?? 'no anchor'}`);
      return { anchor: p.anchor, span: p.span ?? 1 };
    };
    const rowLine = lineOf(rs, re, 'grid-row');
    if ('abandon' in rowLine) return rowLine;
    const colLine = lineOf(cs, ce, 'grid-column');
    if ('abandon' in colLine) return colLine;
    placements.set(c.partName, {
      row: rowLine.anchor,
      column: colLine.anchor,
      ...(rowLine.span > 1 ? { rowSpan: rowLine.span } : {}),
      ...(colLine.span > 1 ? { columnSpan: colLine.span } : {}),
      ...(ax.align ? { alignX: ax.align } : {}),
      ...(ay.align ? { alignY: ay.align } : {}),
    });
    rects.push({ who: `part "${c.partName}"`, r: rowLine.anchor, c: colLine.anchor, rs: rowLine.span, cs: colLine.span });
  }
  // area rects occupy too (empty areas keep their cells — G4's shared
  // placeholder convention); the placed-child rects above must not collide
  // with them or each other, and nothing may exceed the declared tracks —
  // the same two P3 throw classes validateGridPart refuses.
  const placedNames = new Set(placements.keys());
  for (const [name, a] of Object.entries(areas ?? {})) {
    if (!placedNames.has(name)) rects.push({ who: `area "${name}"`, r: a.row, c: a.column, rs: a.rowSpan ?? 1, cs: a.columnSpan ?? 1 });
  }
  for (const x of rects) {
    if (x.r + x.rs > rows.length || x.c + x.cs > columns.length) {
      return abandon(`${x.who} exceeds the declared tracks (${GRID_REFUSALS['grid-implicit-tracks']})`);
    }
  }
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      if (a.r < b.r + b.rs && b.r < a.r + a.rs && a.c < b.c + b.cs && b.c < a.c + a.cs) {
        return abandon(`${a.who} and ${b.who} overlap on the grid — the P3 occupancy class`);
      }
    }
  }

  // G5 — under flow the contract carries `flow: "row"` and OMITS `rows`: the
  // emitter derives and declares the explicit row tracks itself, because the
  // Plugin API under-reports implicitly created rows (P9). Both facts are
  // schema-enforced (LayoutSchema refuses rows+flow together).
  const layout: NonNullable<Part['layout']> = {
    display: 'grid',
    ...(flowRow ? {} : { rows }),
    columns,
    ...(gapRow > 0 || gapColumn > 0 ? { gap: { row: gapRow, column: gapColumn } } : {}),
    ...(areas ? { areas } : {}),
    ...(flowRow ? { flow: 'row' as const } : {}),
  };
  if (layout.gap) {
    // G1: the contract deliberately has NO single-`gap` shorthand — the pair
    // is the carried spelling, and the shorthand's lowering into it must be
    // RECEIPTED BY NAME. The authored spelling is not recoverable at this
    // layer: CSSOM re-serializes `gap: R C` and `row-gap: R; column-gap: C`
    // to the SAME declaration (probed 2026-08-08 in the pinned Chromium:
    // both spellings read back `gap: 12px 16px` from rule cssText), so the
    // browser has already lowered any authored shorthand into the longhand
    // pair before this reader looks — the receipt covers the construct
    // class, never silently.
    receipts.push(
      `grid-gap-shorthand: ${label} row-gap/column-gap carried as the independent {row: ${gapRow}, column: ${gapColumn}} pair (G1/P2: gridRowGap and gridColumnGap are separate canvas facts) — an authored \`gap\` shorthand (\`gap: R C\` / one-value \`gap: R\`) is LOWERED into this pair; the two authored spellings are indistinguishable in CSSOM (rule cssText re-serializes both as the shorthand — probe 2026-08-08), so the lowering is receipted here by name`,
    );
  }
  // G4's other half: per-child LONGHAND rects that leave declared cells
  // unoccupied have no total grid-template-areas tiling (and longhand-
  // authored CSS declares no area names for the contract to own) — the
  // occupancy is carried as Part.placement rects, the named LOWERED
  // disposition `grid-area-nonrectangular`.
  if (placements.size > 0 && !areas) {
    const totalCells = rows.length * columns.length;
    const coveredCells = rects.reduce((n, x) => n + x.rs * x.cs, 0);
    if (coveredCells < totalCells) {
      receipts.push(
        `grid-area-nonrectangular: ${label} — the ${rects.length} placed rect(s) occupy ${coveredCells} of ${totalCells} declared cells (gapped occupancy) and declare no area names, so no grid-template-areas + grid-area spelling exists for the code side (G4: areas require contract-owned names tiling rectangles); the occupancy is carried as per-child grid-row/grid-column LONGHAND rects (Part.placement) — the named LOWERED disposition`,
      );
    }
  }
  receipts.push(
    `grid-promoted: ${label} — ${flowRow ? `${columns.length} declared column tracks carried as layout.columns + flow "row" (rows derived by the emitter, G5)` : `${rows.length}×${columns.length} declared tracks carried as layout.rows/columns`}${gapRow > 0 || gapColumn > 0 ? `, gap ${gapRow}/${gapColumn}` : ''}${areas ? `, ${Object.keys(areas).length} named area(s) (G4: names are contract-owned slot anchors)` : ''}; ${flowRow ? `${inFlowKids.length} child(ren) placed by ORDER (no anchors carried — G5/P5)` : `${placements.size} child placement(s) (0-based cells, spans, per-cell align — A2 G1/G2/G4)`}${ordered ? `, ${ordered.size} of them ORDER-DERIVED (G5 placement-from-order into the declared row rectangle)` : ''}`,
  );
  return { layout, placements, receipts };
}

/** A2 (G4) — AREA NAMES ENTER FROM THE COMPUTED FLOOR. A grid child whose
 *  four computed grid lines all serialize as one area IDENT (Chromium's
 *  computed form for `grid-area: header`) occupies that declared area, and
 *  under the pinned grammar "the area name IS the slot anchor": the part
 *  takes the area's NAME as its contract name, exactly as rejoinStaticParts
 *  lets the reviewed static layer win names. Runs inside alignSweep (after
 *  nameUnion + rejoinStaticParts) so partNames, captured-truth anatomy, the
 *  mint pass and the promoted contract all agree on the one name. */
export function renameGridAreaParts(entries: UnionNode[], receipts: string[]): void {
  const taken = new Set(entries.map((e) => e.partName));
  for (const e of entries) {
    const parent = e.parent;
    if (!parent) continue;
    const pd = parent.rep.style['display'];
    if (pd !== 'grid' && pd !== 'inline-grid') continue;
    const tpl = (parent.rep.style['grid-template-areas'] ?? 'none').trim();
    if (tpl === 'none' || tpl === '') continue;
    const parsed = parseGridTemplateAreas(tpl);
    if (!parsed.areas) continue;
    const s = e.rep.style;
    const ident = (s['grid-row-start'] ?? '').trim();
    if (!isAreaIdent(ident)) continue;
    if ((s['grid-row-end'] ?? '').trim() !== ident || (s['grid-column-start'] ?? '').trim() !== ident || (s['grid-column-end'] ?? '').trim() !== ident) continue;
    if (!parsed.areas[ident]) continue;
    if (e.partName === ident) continue;
    if (taken.has(ident)) {
      receipts.push(
        `grid-area-name-collision: ${e.partName} occupies declared area "${ident}" but a sibling part already claims that name — captured name kept; the grid promotion will abandon rather than double-book the name (named)`,
      );
      continue;
    }
    receipts.push(
      `grid-area-part-renamed: ${e.partName} → "${ident}" — all four computed grid lines carry the area ident, so the part occupies the declared area and takes its name (G4: the area name IS the slot anchor; contract-owned, same rule as anatomy part names)`,
    );
    taken.delete(e.partName);
    taken.add(ident);
    e.partName = ident;
  }
}

/** The ARIA role a lowered table box keeps (the table box model's meaning,
 *  carried on a plain <div> — see the element lowering in buildPart). */
export function tableRoleFor(display: string, tag: string): string | null {
  switch (display) {
    case 'table':
    case 'inline-table':
      return 'table';
    case 'table-header-group':
    case 'table-row-group':
    case 'table-footer-group':
      return 'rowgroup';
    case 'table-row':
      return 'row';
    case 'table-cell':
      return tag === 'th' ? 'columnheader' : 'cell';
    default:
      return null;
  }
}

/** Visually-hidden (sr-only) style signature: clip-path inset(50%) or the
 *  1px clip box. Part of the UNION signature — a toned Badge renders an
 *  sr-only announcement span with the same tag+stems as the visible label,
 *  and occurrence matching would otherwise swap their identities. */
// @door anatomy.sr-only-signature
export const isSrOnlyStyle = (st: Record<string, string>): boolean =>
  (st['clip-path'] ?? '').startsWith('inset(50%') ||
  (st['overflow'] === 'hidden' && st['width'] === '1px' && st['height'] === '1px') ||
  // MUI round (Slider/Switch live finding): two more hiding idioms — the
  // legacy clip rect (Slider's input) and opacity:0 (Switch's input, drawn
  // 300% wide over the whole control). Without these the promoted input
  // parts carried their default WHITE background and painted over the thumb.
  st['clip'] === 'rect(0px, 0px, 0px, 0px)' ||
  st['opacity'] === '0';

// ===========================================================================
// DEPTH BUILD — Stage B: root descent through transparent wrappers (N3 fix).
//
// Ported VERBATIM from extract/depth-spike/run.ts (the proven prototype). A
// portaled new root (Modal's ThemeProvider container) is normalized THROUGH
// transparent wrappers — display:contents (Fragment idiom), box-less theme /
// anonymous containers, single-child box-less passthroughs — to the real
// styled root(s), supporting MULTI-ROOT (a container with several kept
// children is several real roots: Modal = {dialog, backdrop}).
//
// CRITICAL (regression safety): descent is applied ONLY at the seed — to the
// portaled new root, ONCE — to find the real root(s). It is NEVER run over a
// census capture: `buildUnion`/`alignSweep`/`sweep` are unchanged, so the 12
// committed components stay byte-identical. For an HTML-rooted component whose
// root carries a box (Badge span, Button button, Checkbox label), realRootsOf
// returns [root] unchanged (the additive/passthrough-only guarantee) — the
// regression guard (simple-component-anatomy-unchanged) pins exactly that.
// ---------------------------------------------------------------------------
/** Direct text runs of a node, concatenated and trimmed. */
const directText = (n: CapturedNode): string =>
  n.nodes.filter((c) => c.t === 'text').map((c) => (c as { v: string }).v).join('').trim();
/** Element children of a node (drops interleaved text runs). */
const childEls = (n: CapturedNode): CapturedNode[] =>
  n.nodes.filter((c) => c.t === 'el').map((c) => (c as { el: CapturedNode }).el);

/** A node draws NO box of its own: transparent background, no border, no
 *  shadow. (Geometry/padding are ignored — a box-less positioning div still
 *  reserves space but carries no anatomy.) */
// @door anatomy.boxless-wrapper-unwrap
export function isBoxlessNode(n: CapturedNode): boolean {
  const s = n.style;
  const bg = s['background-color'];
  const bgTransparent = !bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent';
  const noBorder = (s['border-top-width'] === '0px' || !s['border-top-width']) && (s['border-bottom-width'] === '0px' || !s['border-bottom-width']);
  const noShadow = !s['box-shadow'] || s['box-shadow'] === 'none';
  return bgTransparent && noBorder && noShadow;
}
const isThemeContainerNode = (n: CapturedNode): boolean => n.classes.some((c) => /theme/i.test(c));

/** Normalize a node THROUGH transparent wrappers to its real root(s), WITHOUT
 *  recursing into KEPT nodes' descendants (their raw children are preserved so
 *  the census union sees the full styled tree below the real root). Unwraps, in
 *  order: display:contents (Fragment / passthrough) → its children (multi-root);
 *  box-less theme/anon container with children → its children (multi-root: the
 *  Modal portal renders {dialog, backdrop} under one ThemeProvider div);
 *  single-child box-less passthrough → its child. A node with its own box,
 *  ARIA role, direct text, or a real class-stem is KEPT with raw children
 *  intact (the dialog, the backdrop, the list, the activator, the overlay).
 *
 *  `classPrefix` is the LIBRARY'S OWN, threaded from the capture config. It
 *  used to be a module constant spelled `'Polaris-'` — a vendor name sitting
 *  on the live path for every library. The descent only asks whether a wrapper
 *  has ANY own class-stem, so the wrong prefix was survivable (it can only
 *  over-keep, never over-strip) but it made the answer library-dependent for
 *  no reason. Defaulted to `''` so a caller with no config (the spike
 *  receipts) keeps the "any class at all is a stem" reading. */
export function realRootsOf(n: CapturedNode, classPrefix = ''): CapturedNode[] {
  if (n.style['display'] === 'contents') return childEls(n).flatMap((c) => realRootsOf(c, classPrefix));
  if (directText(n).length > 0 || (n.role != null && n.role !== '')) return [n];
  const boxless = isBoxlessNode(n);
  const kids = childEls(n);
  if (boxless && kids.length >= 1 && (stems(n.classes, classPrefix).length === 0 || isThemeContainerNode(n))) {
    return kids.flatMap((c) => realRootsOf(c, classPrefix)); // anon/theme wrapper → unwrap (multi-root)
  }
  if (boxless && kids.length === 1) return realRootsOf(kids[0], classPrefix); // single-child passthrough
  return [n];
}

/** Descend a captured new-root to its real root(s) (the Stage-B seed). */
export const descendToRealRoots = (n: CapturedNode, classPrefix = ''): CapturedNode[] =>
  realRootsOf(n, classPrefix);

/** A real root's part-name for a MULTI-root anatomy: role=dialog → 'dialog';
 *  aria-modal → 'dialog'; else the class-stem's last BEM segment lowercased
 *  (Polaris-Modal-Dialog → 'dialog', Polaris-Backdrop → 'backdrop'); fallback
 *  root-<index>. A SINGLE real root always keys as 'root' (byte-identical to
 *  the single-root promotion — the regression guard depends on this). */
export function rootPartName(n: CapturedNode, classPrefix: string, index: number, total: number): string {
  if (total <= 1) return 'root';
  if (n.role === 'dialog' || n.ariaModal === 'true') return 'dialog';
  const stem = stems(n.classes, classPrefix)[0];
  if (stem) {
    const seg = stem.split('-').filter(Boolean).pop() ?? stem;
    const name = seg.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
    if (name) return name;
  }
  return `root-${index + 1}`;
}

// ---------------------------------------------------------------------------
// Union alignment
// ---------------------------------------------------------------------------
export interface UnionNode {
  id: number;
  sig: string;
  /** Representative captured element (base capture when present there). */
  rep: CapturedNode;
  /** Representative path (in the capture that introduced the node). */
  repPath: string;
  /** Capture key that introduced the node ('' = the base capture). */
  repKey: string;
  inBase: boolean;
  parent: UnionNode | null;
  children: UnionNode[];
  partName: string;
}

export interface UnionResult {
  /** DFS order over the final union tree. */
  entries: UnionNode[];
  /** capture key → aligned FlatEl per union entry (null = absent). */
  alignedByKey: Map<string, (FlatEl | null)[]>;
  receipts: string[];
}

export function buildUnion(
  captures: Capture[],
  base: Capture,
  classPrefix: string,
): UnionResult {
  const receipts: string[] = [];
  let nextId = 0;
  const sigOf = (node: CapturedNode): string =>
    `${signature(node, classPrefix)}${isSrOnlyStyle(node.style) ? '|sr-only' : ''}`;
  const mk = (node: CapturedNode, path: string, parent: UnionNode | null, inBase: boolean, repKey: string): UnionNode => ({
    id: nextId++,
    sig: sigOf(node),
    rep: node,
    repPath: path,
    repKey,
    inBase,
    parent,
    children: [],
    partName: '',
  });

  // Seed from the base capture.
  const root = mk(base.root, '', null, true, '');
  const seed = (u: UnionNode, node: CapturedNode, path: string) => {
    let i = 0;
    for (const c of node.nodes) {
      if (c.t !== 'el') continue;
      const childPath = path === '' ? String(i) : `${path}.${i}`;
      const uc = mk(c.el, childPath, u, true, '');
      u.children.push(uc);
      seed(uc, c.el, childPath);
      i++;
    }
  };
  seed(root, base.root, '');

  // Align every capture (base included, for a uniform aligned map).
  const rawAligned = new Map<string, Map<number, FlatEl>>();
  for (const cap of captures) {
    const key = `${cap.combo}__${cap.interaction}`;
    const out = new Map<number, FlatEl>();
    // @door anatomy.union-signature-alignment
    const align = (u: UnionNode, node: CapturedNode, path: string) => {
      const sig = sigOf(node);
      if (sig !== u.sig && u.parent === null) {
        receipts.push(`root-signature-varies: ${key}: ${u.sig} → ${sig} (element-varies receipt; root always aligns)`);
      }
      out.set(u.id, { path, sig, partName: '', node });
      // TWO-PASS document-order merge: first match capture children to union
      // children by (signature, nth occurrence); then walk in capture order,
      // inserting NEW union nodes at the cursor — BEFORE the next matched
      // sibling — so union order follows document order (the Badge pip sits
      // LEFT of the label) while existing union nodes never reorder.
      const bySig = new Map<string, UnionNode[]>();
      for (const uc of u.children) (bySig.get(uc.sig) ?? bySig.set(uc.sig, []).get(uc.sig)!).push(uc);
      const used = new Map<string, number>();
      const pairs: Array<{ el: CapturedNode; path: string; match: UnionNode | null; sig: string }> = [];
      let i = 0;
      for (const c of node.nodes) {
        if (c.t !== 'el') continue;
        const childPath = path === '' ? String(i) : `${path}.${i}`;
        i++;
        const csig = sigOf(c.el);
        const n = used.get(csig) ?? 0;
        used.set(csig, n + 1);
        const list = bySig.get(csig);
        pairs.push({ el: c.el, path: childPath, match: list && n < list.length ? list[n] : null, sig: csig });
      }
      let cursor = 0;
      for (const pr of pairs) {
        if (pr.match) {
          const at = u.children.indexOf(pr.match);
          if (at >= cursor) cursor = at + 1;
          else receipts.push(`union-order-drift: ${key} @${pr.path} (${pr.sig}) matched behind the cursor — document order varies across captures (named)`);
          align(pr.match, pr.el, pr.path);
        } else {
          const uc = mk(pr.el, pr.path, u, false, key);
          u.children.splice(cursor, 0, uc);
          cursor++;
          receipts.push(`union-part-added: ${key} @${pr.path} (${pr.sig})`);
          align(uc, pr.el, pr.path);
        }
      }
    };
    align(root, cap.root, '');
    rawAligned.set(key, out);
  }

  // Final DFS order + aligned arrays.
  const entries: UnionNode[] = [];
  const dfs = (u: UnionNode) => {
    entries.push(u);
    for (const c of u.children) dfs(c);
  };
  dfs(root);
  const alignedByKey = new Map<string, (FlatEl | null)[]>();
  for (const [key, m] of rawAligned) {
    alignedByKey.set(key, entries.map((e) => m.get(e.id) ?? null));
  }
  return { entries, alignedByKey, receipts: [...new Set(receipts)] };
}

// ---------------------------------------------------------------------------
// Part naming over the union (extends lib.namePart to union entries) +
// static re-join (the static layer wins NAMES — §4.5)
// ---------------------------------------------------------------------------
export function nameUnion(
  entries: UnionNode[],
  componentName: string,
  classPrefix: string,
): void {
  const seen = new Map<string, number>();
  // BASE-capture entries claim names first (DFS order), then off-base
  // entries — an off-base subtree inserted before a base element (linked
  // Tag's inner text) must never steal the base element's name.
  const ordered = [...entries.filter((e) => e.inBase), ...entries.filter((e) => !e.inBase)];
  for (const e of ordered) {
    let name: string;
    if (e.parent === null) name = 'root';
    else if (e.rep.tag === 'svg') name = 'icon';
    else if (e.rep.nodes.some((n) => n.t === 'text' && n.v.trim().length > 0)) name = 'label';
    else {
      const stem = stems(e.rep.classes, classPrefix)[0];
      // fallback names are CSS-class-safe (they become real part class names
      // in the promoted contract — dots would break every selector)
      name = stem
        ? stem.replace(new RegExp(`^${componentName}__?`), '').toLowerCase() || 'root'
        : `part-${e.repPath.replace(/\./g, '-')}`;
    }
    const n = seen.get(name) ?? 0;
    seen.set(name, n + 1);
    e.partName = n > 0 ? `${name}-${n + 1}` : name;
  }
}

/** Re-join static-only parts to unmatched union entries by element/content
 *  evidence: the static part's element tag must equal the captured tag, and
 *  when the static part binds text content, the captured text must equal the
 *  bound prop's mounted sample. A unique match RENAMES the union entry to
 *  the static (human-reviewed) name. */
export function rejoinStaticParts(
  entries: UnionNode[],
  contract: Contract,
  comp: ComponentConfig,
  receipts: string[],
): void {
  const walked = walkAnatomy(contract);
  const staticByName = new Map(walked.map((w) => [w.name, w.part] as const));
  const captured = new Set(entries.map((e) => e.partName));
  const textOf = (n: CapturedNode): string =>
    n.nodes.filter((c) => c.t === 'text').map((c) => (c as { v: string }).v).join('').trim();
  const sampleFor = (propName: string): string | undefined => {
    const prop = contract.props.find((p) => p.name === propName);
    if (!prop) return undefined;
    if (prop.bindings.code.prop === 'children') return comp.sampleText;
    const fixed = comp.fixedProps?.[propName];
    return typeof fixed === 'string' ? fixed : typeof prop.default === 'string' ? prop.default : undefined;
  };
  for (const [name, part] of staticByName) {
    if (captured.has(name)) continue;
    const el = part.element ?? (part.content || part.text !== undefined ? 'span' : 'div');
    const wantText = part.content ? sampleFor(part.content.prop) : part.text;
    // @door anatomy.static-rejoin-evidence-floor
    const candidates = entries.filter((e) => {
      if (e.parent === null || staticByName.has(e.partName)) return false;
      if (e.rep.tag !== el) return false;
      if (wantText !== undefined) return textOf(e.rep) === wantText;
      return false; // element-only evidence is too weak to claim a reviewed name
    });
    const pick = candidates.length === 1 ? candidates[0]
      : candidates.filter((c) => c.inBase).length === 1 ? candidates.filter((c) => c.inBase)[0]
      : null;
    if (pick) {
      receipts.push(`static-rejoin: captured "${pick.partName}" renamed to reviewed static part "${name}" (element ${el}${wantText !== undefined ? ` + content "${wantText}"` : ''}${candidates.length > 1 ? '; base-capture candidate preferred' : ''})`);
      pick.partName = name;
      captured.add(name);
    }
  }
}

// ---------------------------------------------------------------------------
// Presence factorization
// ---------------------------------------------------------------------------
export interface PresenceFact {
  /** visibleWhen on a boolean-true presence factor (≤1). */
  visibleWhen?: { prop: string };
  /** stylesWhen display:none entries for complement factors. */
  hiddenWhen: Array<{ prop: string; equals?: string }>;
  /** Defaultless-axis strategy: the part is HIDDEN AT BASE (declared
   *  display:none) and SHOWN per set value — the only spelling for
   *  "present iff the defaultless prop is set" (the unset pseudo-value is
   *  not a contract enum value, so hiddenWhen cannot name it). */
  shownWhen: Array<{ prop: string; equals: string }>;
  receipts: string[];
}

/** Factor a presence set over the enabled default-interaction combos.
 *  Returns null when presence does not factor as a product of per-axis sets
 *  (the part must then refuse promotion by name). `presenceProps` maps axis
 *  prop → true when the axis is a presence axis (off/on ↔ boolean false/
 *  true on the contract side). */
export function factorPresence(
  presentCombos: Combo[],
  allCombos: Combo[],
  axes: PropSpace['axes'],
  presenceProps: Set<string>,
  stateProps: string[],
  partName: string,
  /** Contract prop names — a factor can only spell conditions on real props
   *  (Button declares the disabled STATE with no disabled prop). */
  contractProps?: Set<string>,
): PresenceFact | null {
  const receipts: string[] = [];
  if (presentCombos.length === allCombos.length) return { hiddenWhen: [], shownWhen: [], receipts };
  if (presentCombos.length === 0) return null;
  const presentKeys = new Set(presentCombos.map((c) => c.key));
  // per-axis observed value sets among present combos (state props are axes
  // too — value 'true'/'false')
  const axisNames = [...axes.map((a) => a.prop), ...stateProps];
  const valueOf = (c: Combo, ax: string): string =>
    ax in c.axisValues ? c.axisValues[ax] : String(c.stateFlags[ax]);
  const valuesFor = (ax: string): string[] => {
    const a = axes.find((x) => x.prop === ax);
    return a ? a.values : ['false', 'true'];
  };
  const sets = new Map<string, Set<string>>();
  for (const ax of axisNames) sets.set(ax, new Set(presentCombos.map((c) => valueOf(c, ax))));
  // product check: every combo whose per-axis values are all in the sets
  // must be present, and vice versa (vice versa holds by construction).
  // @door anatomy.presence-product-test
  for (const c of allCombos) {
    const inProduct = axisNames.every((ax) => sets.get(ax)!.has(valueOf(c, ax)));
    if (inProduct !== presentKeys.has(c.key)) {
      return null; // not a product — refuse upstream by name
    }
  }
  const fact: PresenceFact = { hiddenWhen: [], shownWhen: [], receipts };
  for (const ax of axisNames) {
    const va = sets.get(ax)!;
    const all = valuesFor(ax);
    if (va.size === all.length) continue; // axis does not constrain presence
    const spec = axes.find((x) => x.prop === ax);
    if (spec?.unset !== undefined && !presenceProps.has(ax) && !va.has(spec.unset)) {
      // defaultless enum axis, present only when SET: base-hidden strategy —
      // the unset pseudo-value is not a contract enum value, so the
      // complement has no hiddenWhen spelling. Show per set value instead.
      for (const v of all) {
        if (v === spec.unset || !va.has(v)) continue;
        fact.shownWhen.push({ prop: ax, equals: v });
      }
      continue;
    }
    if (presenceProps.has(ax)) {
      // @door anatomy.presence-second-boolean-factor
      if (va.size === 1 && va.has(PRESENCE_ON)) {
        if (fact.visibleWhen) {
          // two boolean-true factors — visibleWhen carries one; the second
          // has no complement spelling (stylesWhen booleans are truthy-only)
          receipts.push(`presence-second-boolean-factor: ${partName} also requires ${ax}=on — carried via visibleWhen on ${fact.visibleWhen.prop} only; residue named`);
          return null;
        }
        fact.visibleWhen = { prop: ax };
      } else if (va.size === 1 && va.has(PRESENCE_OFF)) {
        // present only when the boolean is OFF → hidden when ON (truthy)
        fact.hiddenWhen.push({ prop: ax });
      }
    // @door anatomy.state-axis-presence-drop
    } else if (stateProps.includes(ax)) {
      if (va.size === 1 && va.has('false')) {
        if (contractProps && !contractProps.has(ax)) {
          // the contract declares the STATE with no prop (Button disabled) —
          // there is no stylesWhen spelling; DROP the factor (the part
          // renders in the state plane too), receipted.
          receipts.push(`state-axis-presence-dropped: ${partName} absent under ${ax} but the contract has no "${ax}" prop — factor dropped, part renders in that plane (named residue)`);
        } else {
          fact.hiddenWhen.push({ prop: ax });
        }
      } else return null; // present only when disabled — no spelling
    } else {
      // enum axis: hide on each complement value (the unset pseudo-value is
      // handled by the base-hidden branch above and never lands here)
      for (const v of all) {
        if (v === spec?.unset) continue;
        if (!va.has(v)) fact.hiddenWhen.push({ prop: ax, equals: v });
      }
    }
  }
  return fact;
}

/** Round 5c — COMPLEMENT-OF-PRODUCT presence (the Tag default-label class).
 *  A default subtree that an ALTERNATIVE subtree replaces (Tag's label moves
 *  inside the link when `linked` is set and `clickable` is not) has a
 *  presence set that is the COMPLEMENT of a product — the product test
 *  refuses it, and round 5a showed that refusal blanks the whole component.
 *  When the ABSENCE set factors as a product of per-axis sets, the part is
 *  spellable as an ORDERED stylesWhen cascade: hide entries on ONE trigger
 *  axis's absence values, then RESTORE entries on every other constraining
 *  axis's complement values — later rules win at equal specificity, so
 *  hidden(c) = trigger-matches(c) ∧ ¬restore-matches(c) = the absence
 *  product, exactly. The chain is VERIFIED against every captured combo
 *  before it is carried; anything unverifiable refuses by name.
 *
 *  Domain note: this runs over ALL default-interaction combos (state planes
 *  included — a disabled Tag renders the plain label even when linked), so
 *  the disabled restore is part of the carried truth. */
export interface ComplementFact {
  hide: Array<{ prop: string; equals?: string }>;
  restore: Array<{ prop: string; equals?: string }>;
  receipts: string[];
}

export function factorComplement(
  presentKeys: Set<string>,
  allCombos: Combo[],
  axes: PropSpace['axes'],
  presenceProps: Set<string>,
  stateProps: string[],
  partName: string,
  contractProps: Set<string>,
): ComplementFact | null {
  const absent = allCombos.filter((c) => !presentKeys.has(c.key));
  if (absent.length === 0 || absent.length === allCombos.length) return null;
  const axisNames = [...axes.map((a) => a.prop), ...stateProps];
  const valueOf = (c: Combo, ax: string): string =>
    ax in c.axisValues ? c.axisValues[ax] : String(c.stateFlags[ax]);
  const valuesFor = (ax: string): string[] => {
    const a = axes.find((x) => x.prop === ax);
    return a ? a.values : ['false', 'true'];
  };
  const sets = new Map(axisNames.map((ax) => [ax, new Set(absent.map((c) => valueOf(c, ax)))] as const));
  const absentKeys = new Set(absent.map((c) => c.key));
  for (const c of allCombos) {
    const inProduct = axisNames.every((ax) => sets.get(ax)!.has(valueOf(c, ax)));
    if (inProduct !== absentKeys.has(c.key)) return null; // absence is not a product either
  }
  const constraining = axisNames.filter((ax) => sets.get(ax)!.size < valuesFor(ax).length);
  if (constraining.length === 0) return null;
  /** stylesWhen conditions selecting exactly `values` of axis `ax`, or null
   *  when the vocabulary has no spelling (truthy-only booleans; the unset
   *  pseudo-value is not a contract enum value; a state axis needs a real
   *  contract prop). */
  const spell = (ax: string, values: string[]): Array<{ prop: string; equals?: string }> | null => {
    if (values.length === 0) return null;
    if (presenceProps.has(ax)) {
      return values.length === 1 && values[0] === PRESENCE_ON ? [{ prop: ax }] : null;
    }
    if (stateProps.includes(ax)) {
      return values.length === 1 && values[0] === 'true' && contractProps.has(ax) ? [{ prop: ax }] : null;
    }
    const spec = axes.find((x) => x.prop === ax);
    if (!spec || !contractProps.has(ax)) return null;
    if (values.some((v) => v === spec.unset)) return null; // unset pseudo-value has no condition spelling
    return values.map((v) => ({ prop: ax, equals: v }));
  };
  const matches = (cond: { prop: string; equals?: string }, c: Combo): boolean => {
    const v = valueOf(c, cond.prop);
    if (cond.equals !== undefined) return v === cond.equals;
    return presenceProps.has(cond.prop) ? v === PRESENCE_ON : v === 'true';
  };
  for (const trigger of constraining) {
    const hide = spell(trigger, [...sets.get(trigger)!]);
    if (!hide) continue;
    const restore: Array<{ prop: string; equals?: string }> = [];
    let ok = true;
    for (const other of constraining) {
      if (other === trigger) continue;
      const complement = valuesFor(other).filter((v) => !sets.get(other)!.has(v));
      const r = spell(other, complement);
      if (!r) { ok = false; break; }
      restore.push(...r);
    }
    if (!ok) continue;
    // VERIFY the cascade against every captured combo before carrying it.
    const verified = allCombos.every((c) => {
      const hidden = hide.some((h) => matches(h, c)) && !restore.some((r) => matches(r, c));
      return hidden === absentKeys.has(c.key);
    });
    if (!verified) continue;
    const fmt = (e: { prop: string; equals?: string }) => (e.equals !== undefined ? `${e.prop}=${e.equals}` : e.prop);
    return {
      hide,
      restore,
      receipts: [
        `presence-complement-carried: ${partName} absent in ${absent.length}/${allCombos.length} default-interaction combos — absence factors as a product; carried as ORDERED stylesWhen (hide on ${hide.map(fmt).join(', ')}${restore.length ? `; cascade-restored on ${restore.map(fmt).join(', ')}` : ''}) — verified against every captured combo (round 5c complement-of-product spelling)`,
      ],
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// SVG reconstruction from captured computed truth
// ---------------------------------------------------------------------------
/** Non-painting SVG metadata elements (SVG 1.1 §5.4 — "not rendered").
 *  They are real DOM elements with real text, so a naive reader captures
 *  them; nothing about them is anatomy. */
export const SVG_NONPAINTING = new Set(['title', 'desc', 'metadata']);

/** The four border sides, in CSS order. */
const BORDER_SIDES = ['top', 'right', 'bottom', 'left'] as const;

/** Split a CSS value list on TOP-LEVEL commas — the commas inside `rgba(…)`
 *  do not split. Browser-serialized box-shadow stacks are full of them. */
function splitTopLevelCommas(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** CARBON LIVE-DEFECT ROUND (D2) — a PERCENTAGE corner radius resolved
 *  against the box. `border-radius: 50%` is how most libraries spell a
 *  circle, and computed style keeps it as a percentage: the px regex missed
 *  it, the radius folded to 0, and Carbon's round toggle knob would have
 *  compiled as a SQUARE (the same class of miss the `rounded-full`
 *  3.35544e+07px sentinel already covers for the other spelling). */
export function pctRadius(v: string | undefined, w: number, h: number): number | null {
  const m = /^(\d+(?:\.\d+)?)%$/.exec((v ?? '').trim());
  if (!m) return null;
  return (Number(m[1]) / 100) * Math.min(w, h);
}

const pxNum = (v: string | undefined): number | null => {
  if (!v) return null;
  const m = /^(-?\d+(?:\.\d+)?)px$/.exec(v);
  return m ? Number(m[1]) : null;
};

/** Shared stroke-attribute reconstruction for path/circle children. */
function svgStrokeAttrs(
  el: CapturedNode,
  inheritedColor: string | undefined,
  receipts: string[],
  label: string,
  /** Path draw-on animation (pathLength-relative) drops dashes; progress
   *  rings bake absolute px dasharray/offset so determinate arcs survive. */
  dashMode: 'drop-pathlength' | 'bake-absolute',
  /** The shape's own captured centre, passed only by the `circle` caller. The
   *  dash-fold below rotates about it, so the rotation origin is an OBSERVED
   *  coordinate rather than an assumed viewBox midpoint. Absent for `path`,
   *  where the fold does not apply. */
  center?: { cx: number; cy: number },
): string {
  const strokeRaw = el.style['stroke'];
  const stroke = strokeRaw && inheritedColor && strokeRaw === inheritedColor ? 'currentColor' : strokeRaw;
  const strokeAttrs: string[] = [];
  if (!stroke || stroke === 'none') return '';
  strokeAttrs.push(` stroke="${stroke}"`);
  const sw = el.style['stroke-width'];
  const swNum = /^(-?\d+(?:\.\d+)?)px$/.exec(sw ?? '');
  if (swNum && Number(swNum[1]) !== 1) strokeAttrs.push(` stroke-width="${swNum[1]}"`);
  for (const [ch, attr] of [
    ['stroke-linecap', 'stroke-linecap'],
    ['stroke-linejoin', 'stroke-linejoin'],
  ] as const) {
    const v = el.style[ch];
    if (v && v !== 'butt' && v !== 'miter') strokeAttrs.push(` ${attr}="${v}"`);
  }
  const dash = el.style['stroke-dasharray'];
  const dashOffset = el.style['stroke-dashoffset'];
  // @door anatomy.svg-dash-drop
  if (dashMode === 'drop-pathlength') {
    // Round 5d (owner finding: the check glyph drew as SEGMENTED
    // CAPSULES, not a continuous check): dash channels are
    // pathLength-RELATIVE, and `pathLength` is an ATTRIBUTE — not a
    // computed style (the viewBox class). Polaris normalizes the
    // check path to pathLength=1 and drives stroke-dashoffset as a
    // draw-on animation; the computed 2px dasharray is the ANIMATION
    // VEHICLE, not resting geometry. Re-basing that pattern onto the
    // real ~14-user-unit path drew 2px capsules with joints. The
    // resting truth of a settled draw-on stroke is the CONTINUOUS
    // stroke — dash channels are dropped with a named receipt
    // (visibility still rides the captured opacity channel).
    if ((dash && dash !== 'none') || (dashOffset && dashOffset !== '0px')) {
      receipts.push(
        `svg-dash-channels-dropped: ${label} — stroke-dasharray ${dash || 'none'} / stroke-dashoffset ${dashOffset || '0px'} are pathLength-relative and pathLength is not a computed style (draw-on animation idiom); continuous stroke carried (named reconstruction)`,
      );
    }
  } else if (dash && dash !== 'none') {
    // WAVE 5 — MUI CircularProgress: dasharray/offset are absolute px
    // circumference fractions (determinate arc), not pathLength=1 animation.
    const dashNum = /^(-?\d+(?:\.\d+)?)px$/.exec(dash.trim());
    const offNum = /^(-?\d+(?:\.\d+)?)px$/.exec((dashOffset ?? '0px').trim());
    if (dashNum) {
      // FIGMA'S SVG IMPORTER HONOURS `stroke-dasharray` AND SILENTLY IGNORES
      // `stroke-dashoffset`. Baking the pair faithfully therefore produced a
      // canvas ring that was WRONG in the one way the attribute pair exists to
      // express: MUI's determinate CircularProgress carries dasharray 126.92
      // (the full circumference) with dashoffset 50.768, i.e. draw 60% of the
      // ring. With the offset dropped on import, a single-value dasharray equal
      // to the circumference draws the ENTIRE circle — so the determinate cell
      // rendered identical to the indeterminate one. Its own receipt recorded
      // the tell without naming the cause: scoring the INDETERMINATE shot
      // against the determinate reference gave 1.78, which is only possible if
      // the two variants are pixel-identical on canvas.
      //
      // A two-value dasharray says the same thing in a form the importer keeps:
      // `visible gap` — draw (dasharray − dashoffset), then skip the rest. Both
      // numbers are the OBSERVED ones; nothing is invented, and the arithmetic
      // is exact (126.92 − 50.768 = 76.152, and 76.152/126.92 = 0.6 exactly).
      //
      // The PHASE is carried the same way. Dropping the offset also drops where
      // the arc STARTS, and MUI rotates the element −90° so the ring opens at
      // 12 o'clock — observed on the root as `transform: matrix(0,-1,1,0,0,0)`,
      // a fact fusion refuses as a declared channel because it VARIES across
      // combos (the indeterminate variant animates it). The channel cannot
      // carry it; this per-variant ASSET can, so the rotation is baked onto the
      // circle about its own captured centre rather than left to chance.
      const visible = offNum ? Number(dashNum[1]) - Number(offNum[1]) : null;
      if (center && visible !== null && visible > 0 && visible < Number(dashNum[1])) {
        const gap = Number(dashNum[1]) - visible;
        strokeAttrs.push(` stroke-dasharray="${visible} ${gap}"`);
        strokeAttrs.push(` transform="rotate(-90 ${center.cx} ${center.cy})"`);
        receipts.push(
          `svg-circle-dash-folded: ${label} — stroke-dasharray ${dash} / stroke-dashoffset ${dashOffset} folded to a two-value dasharray "${visible} ${gap}" (visible ${((visible / Number(dashNum[1])) * 100).toFixed(1)}% of the circumference) and a rotate(-90) about the captured centre, BECAUSE Figma's SVG importer honours dasharray and ignores dashoffset — carrying the pair verbatim drew the full ring and made the determinate variant identical to the indeterminate one`,
        );
      } else {
        strokeAttrs.push(` stroke-dasharray="${dashNum[1]}"`);
        if (offNum) strokeAttrs.push(` stroke-dashoffset="${offNum[1]}"`);
        receipts.push(
          `svg-circle-dash-baked: ${label} — stroke-dasharray ${dash} / stroke-dashoffset ${dashOffset || '0px'} carried as absolute user units (progress-ring idiom; not pathLength-relative)`,
        );
      }
    } else {
      receipts.push(
        `svg-circle-dash-unreadable: ${label} — stroke-dasharray ${dash} not px; dashes dropped`,
      );
    }
  }
  return strokeAttrs.join('');
}

/** Max |coord| from SVG path `d`, excluding elliptical-arc radii / flags.
 *  FC-SVG-VIEWBOX — A/a `rx ry x-rot large sweep x y`: only (x,y) count. */
export function pathDataExtent(d: string): number {
  let max = 0;
  const tokens = d.match(/[AaMmLlHhVvCcSsQqTtZz]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g) ?? [];
  let i = 0;
  let cmd = '';
  const take = (): number | null => {
    while (i < tokens.length && !/^-?\d/.test(tokens[i]) && tokens[i] !== '.' && !/^\.\d/.test(tokens[i])) {
      if (/^[AaMmLlHhVvCcSsQqTtZz]$/.test(tokens[i])) return null;
      i++;
    }
    if (i >= tokens.length) return null;
    const n = Number(tokens[i++]);
    return Number.isFinite(n) ? n : null;
  };
  const note = (n: number | null) => {
    if (n !== null) max = Math.max(max, Math.abs(n));
  };
  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[AaMmLlHhVvCcSsQqTtZz]$/.test(t)) {
      cmd = t;
      i++;
    }
    if (!cmd) {
      i++;
      continue;
    }
    const c = cmd.toUpperCase();
    if (c === 'Z') {
      continue;
    }
    if (c === 'A') {
      take(); // rx
      take(); // ry
      take(); // x-axis-rotation
      take(); // large-arc
      take(); // sweep
      note(take()); // x
      note(take()); // y
      continue;
    }
    if (c === 'H' || c === 'V') {
      note(take());
      continue;
    }
    // M/L/T: pairs; C: 6; S/Q: 4
    const pairCount = c === 'C' ? 3 : c === 'S' || c === 'Q' ? 2 : 1;
    for (let p = 0; p < pairCount; p++) {
      note(take());
      note(take());
    }
  }
  return max;
}

/** Reconstruct inline SVG markup for one captured <svg> subtree. Returns
 *  null with a receipt when a child is outside the bounded grammar
 *  (path / g / circle). Round 5c: the result also carries the reconstructed
 *  viewBox number, the path-coordinate extent, and whether the viewBox was
 *  BUMPED past the computed size — the authored-viewBox unification pass
 *  (promoteAnatomy) needs all three to recognize one authored glyph captured
 *  at many sizes. Wave 5 adds `<circle>` so MUI CircularProgress (and peers)
 *  promote as assets instead of minting unregistered cx/cy/r/stroke channels. */
export function reconstructSvg(
  svgEl: CapturedNode,
  receipts: string[],
  label: string,
  /** Round 5c: prefer the currentColor spelling for fills equal to the
   *  inherited color — set ONLY when the fill==color identity holds in
   *  EVERY captured combo of this svg (a per-svg decision; a per-combo one
   *  splits one authored asset into per-variant markups — the Button icon
   *  regression this flag exists to prevent). */
  preferCurrentColor = false,
): { markup: string; size: number; vb: number; extent: number; bumped: boolean } | null {
  // A path fill equal to the svg's inherited `color` is CSS currentColor in
  // spirit — emitting it AS currentColor separates glyph SHAPE from color
  // (the Badge pip: shape = f(progress), color = f(tone); a baked fill made
  // the markup two-axis and refused the asset).
  const inheritedColor = svgEl.style['color'];
  const inheritedFill = svgEl.style['fill'];
  const w = pxNum(svgEl.style['width']);
  const h = pxNum(svgEl.style['height']);
  // @door anatomy.svg-grammar-fence
  if (w === null || h === null || w <= 0 || h <= 0) {
    receipts.push(`svg-size-unreadable: ${label} — computed width/height not px; asset refused`);
    return null;
  }
  const paths: string[] = [];
  let maxCoord = 0;
  /** When every shape is a circle sharing one center, reconstruct the
   *  MUI-style offset viewBox (`SIZE/2 SIZE/2 SIZE SIZE`) instead of
   *  `0 0 vb vb` — otherwise cx=SIZE lands off-center in the display box. */
  let circleCenter: number | null = null;
  let circleOnly = true;
  // THE DOOR REGISTER — THE INHERITED-INK REWRITE STOPS BEING SILENT.
  //
  // This door rewrites a concrete literal colour to `currentColor`, so the
  // colour never lands in the asset and the glyph paints whatever the CONSUMING
  // surface's colour chain says. That is right when the chain is the
  // component's own — and it is exactly the Polaris inherited-ink shape when
  // the chain arrives from the PAGE: a provider sets `color` on an ancestor,
  // the svg inherits it, the fill matches, the literal is folded away, and the
  // generated surface (which has no provider) draws the glyph BLACK.
  //
  // The rewrite is unchanged. What changes is that each folded colour is now
  // named once per asset, with the value it discarded, so the loss is greppable
  // instead of invisible.
  const foldedInk = new Map<string, string>();
  // @door anatomy.svg-currentcolor-fold
  const resolveFill = (fillRaw: string): string => {
    const out =
      preferCurrentColor && fillRaw && inheritedColor && fillRaw === inheritedColor
        ? 'currentColor'
        : fillRaw && inheritedFill && fillRaw === inheritedFill
          ? ''
          : fillRaw && inheritedColor && fillRaw === inheritedColor
            ? 'currentColor'
            : fillRaw;
    if (out !== fillRaw && fillRaw) foldedInk.set(fillRaw, out === '' ? 'the svg host fill' : 'currentColor');
    return out;
  };
  const walkPaths = (n: CapturedNode): boolean => {
    for (const c of n.nodes) {
      if (c.t !== 'el') continue;
      const el = c.el;
      if (el.tag === 'path') {
        circleOnly = false;
        const dRaw = el.style['d'] ?? '';
        const m = /^path\("(.*)"\)$/.exec(dRaw);
        if (!m) {
          receipts.push(`svg-path-d-unreadable: ${label} — computed d "${dRaw.slice(0, 40)}"; asset refused`);
          return false;
        }
        const d = m[1];
        // FC-SVG-VIEWBOX: elliptical-arc radii (A/a rx ry …) can dwarf the
        // glyph's coordinate space (Polaris Banner warning: 20×20 icon with
        // A 449 radii → viewBox 450 → invisible at iconSize 20). Extent uses
        // endpoints / curve points only — not rx/ry.
        maxCoord = Math.max(maxCoord, pathDataExtent(d));
        const fill = resolveFill(el.style['fill'] ?? '');
        const fillRule = el.style['fill-rule'];
        const opacity = el.style['opacity'];
        // STROKE channels (round 4 fix: Polaris's checkmark is a STROKED
        // path — fill-only reconstruction rendered it invisible). Computed
        // px lengths convert to user units 1:1 (viewBox == computed size).
        const strokeAttrs = svgStrokeAttrs(el, inheritedColor, receipts, label, 'drop-pathlength');
        paths.push(
          `<path d="${d}"` +
            (fill ? ` fill="${fill}"` : '') +
            (fillRule === 'evenodd' ? ' fill-rule="evenodd"' : '') +
            (opacity && opacity !== '1' ? ` opacity="${opacity}"` : '') +
            strokeAttrs +
            '/>',
        );
      } else if (el.tag === 'circle') {
        const cx = pxNum(el.style['cx']);
        const cy = pxNum(el.style['cy']);
        const r = pxNum(el.style['r']);
        if (cx === null || cy === null || r === null || r <= 0) {
          receipts.push(`svg-circle-geometry-unreadable: ${label} — cx/cy/r not positive px; asset refused`);
          return false;
        }
        if (cx !== cy) circleOnly = false;
        else if (circleCenter === null) circleCenter = cx;
        else if (circleCenter !== cx) circleOnly = false;
        maxCoord = Math.max(maxCoord, Math.abs(cx) + r, Math.abs(cy) + r);
        const fillRaw = el.style['fill'] ?? '';
        const fill = fillRaw === 'none' ? 'none' : resolveFill(fillRaw);
        const opacity = el.style['opacity'];
        const strokeAttrs = svgStrokeAttrs(el, inheritedColor, receipts, label, 'bake-absolute', { cx, cy });
        paths.push(
          `<circle cx="${cx}" cy="${cy}" r="${r}"` +
            (fill ? ` fill="${fill}"` : '') +
            (opacity && opacity !== '1' ? ` opacity="${opacity}"` : '') +
            strokeAttrs +
            '/>',
        );
      } else if (el.tag === 'g') {
        if (!walkPaths(el)) return false;
      // @door anatomy.svg-metadata-skip-recon
      } else if (SVG_NONPAINTING.has(el.tag)) {
        // CARBON LIVE-DEFECT ROUND (D1): <title>/<desc>/<metadata> are SVG
        // a11y METADATA — non-painting by spec. Refusing the asset over one
        // of them is what turned Carbon's notification glyph into a tree of
        // per-path parts with the accessible title rendered as canvas TEXT
        // ("error icon" next to the notification heading). The capture now
        // drops them at the source; this branch keeps ALREADY-COMMITTED
        // captures reconstructible instead of silently refused.
        receipts.push(`svg-metadata-skipped: ${label} — <${el.tag}> is non-painting SVG metadata (SVG 1.1 §5.4), skipped rather than refusing the asset`);
      } else {
        receipts.push(`svg-child-outside-grammar: ${label} — <${el.tag}> (v1 carries path/g/circle); asset refused`);
        return false;
      }
    }
    return true;
  };
  if (!walkPaths(svgEl)) return null;
  if (paths.length === 0) {
    receipts.push(`svg-empty: ${label} — no path/circle children; asset refused`);
    return null;
  }
  // viewBox reconstruction (NAMED): the viewBox attribute is not a computed
  // style — reconstructed as 0 0 W H from the svg's computed size, sanity-
  // checked against the path data's coordinate extent (a glyph drawn in a
  // The receipt for `anatomy.svg-currentcolor-fold` — one line per discarded
  // literal, emitted on every return path this function has.
  for (const [was, now] of [...foldedInk].sort()) {
    receipts.push(
      `svg-currentcolor-folded: ${label} — the glyph's authored fill ${was} EQUALS the svg's inherited \`color\`${inheritedColor ? ` (${inheritedColor})` : ''} and is rewritten to ${now}, so the literal colour is NOT carried in the asset and the glyph paints whatever the consuming surface's colour chain says. When that chain arrives from the PAGE rather than the component (a theme provider setting \`color\` on an ancestor), the generated surface has nothing to inherit and the glyph draws black — the Polaris inherited-ink shape.`,
    );
  }
  // larger user space than its box would silently crop). Circle-only MUI
  // progress rings use the authored offset form `SIZE/2 SIZE/2 SIZE SIZE`.
  // @door anatomy.svg-viewbox-reconstruct
  if (circleOnly && circleCenter !== null && circleCenter > 0) {
    const size = Math.round(circleCenter);
    const origin = size / 2;
    receipts.push(
      `svg-viewbox-circle-offset: ${label} — ${origin} ${origin} ${size} ${size} from shared circle center ${circleCenter} (MUI CircularProgress idiom; viewBox is not a computed style — named reconstruction)`,
    );
    return {
      markup: `<svg viewBox="${origin} ${origin} ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${paths.join('')}</svg>`,
      size: Math.round(Math.max(w, h)),
      vb: size,
      extent: maxCoord,
      bumped: false,
    };
  }
  let vb = Math.round(Math.max(w, h));
  let bumped = false;
  if (maxCoord > vb * 1.02) {
    const bumpedVb = Math.ceil(maxCoord);
    receipts.push(`svg-viewbox-bumped: ${label} — computed size ${vb} < path extent ${maxCoord}; viewBox reconstructed as 0 0 ${bumpedVb} ${bumpedVb} (named reconstruction)`);
    vb = bumpedVb;
    bumped = true;
  } else {
    receipts.push(`svg-viewbox-reconstructed: ${label} — 0 0 ${vb} ${vb} from computed size ${w}×${h} (path extent ${maxCoord.toFixed(1)}; viewBox is not a computed style — named reconstruction)`);
  }
  return {
    markup: `<svg viewBox="0 0 ${vb} ${vb}" xmlns="http://www.w3.org/2000/svg">${paths.join('')}</svg>`,
    size: Math.round(Math.max(w, h)),
    vb,
    extent: maxCoord,
    bumped,
  };
}

// ---------------------------------------------------------------------------
// Anatomy promotion
// ---------------------------------------------------------------------------
export interface PromotionResult {
  /** Static contract clone with computed-only parts PROMOTED at their
   *  captured nesting positions (and presence boolean props added). */
  contract: Contract;
  /** New icon assets: asset name → svg markup (run.ts writes the files). */
  assets: Map<string, string>;
  /** Union indices whose channels are CONSUMED by svg assets (the svg
   *  element and its descendants) — excluded from styled-channel minting. */
  consumed: Set<number>;
  /** partName → union index for every promoted or matched part. */
  partIndex: Map<string, number>;
  receipts: string[];
  /** Parts refused promotion, with named reasons. */
  refusals: string[];
  /** A2 grid — `part|channel` keys the MINT PASS must refuse BY NAME instead
   *  of minting, with the named reason as the value:
   *    · `flex-grow` on any child of a display:grid parent — the Plugin API
   *      silently accepts layoutGrow on grid children with no effect (P4)
   *      AND the real grid layout ignores it, so a minted flex-grow token
   *      would be a dead canvas-inexpressible fact (grid-child-grow);
   *    · the grid placement longhands of children whose parent grid was NOT
   *      promoted (abandoned/refused — grid-implicit-tracks etc.): anchors
   *      of a grid the contract does not carry are dead facts (P9). */
  gridMintRefusals: Map<string, string>;
}

const isEnabledCombo = (c: Combo): boolean => Object.values(c.stateFlags).every((f) => !f);

/** Whether a union entry is an svg subtree root whose parent is a
 *  single-purpose icon wrapper (span with only this svg child). */
function svgTarget(e: UnionNode): { host: UnionNode; svg: UnionNode } | null {
  if (e.rep.tag !== 'svg') return null;
  const parent = e.parent;
  if (
    parent &&
    parent.children.length === 1 &&
    parent.children[0] === e &&
    !parent.rep.nodes.some((n) => n.t === 'text' && n.v.trim().length > 0)
  ) {
    return { host: parent, svg: e };
  }
  return e.parent ? { host: e, svg: e } : null;
}

export function promoteAnatomy(
  space: PropSpace,
  comp: ComponentConfig,
  union: UnionResult,
  componentKebab: string,
): PromotionResult {
  const receipts: string[] = [];
  const refusals: string[] = [];
  /** A2 grid — see PromotionResult.gridMintRefusals. */
  const gridMintRefusals = new Map<string, string>();
  const GRID_PLACEMENT_CHANNELS = ['grid-row-start', 'grid-row-end', 'grid-column-start', 'grid-column-end'] as const;
  /** Every child of a display:grid parent refuses a `flex-grow` mint by name
   *  (grid-child-grow): on the real DOM a grid item ignores flex-grow, and on
   *  the canvas layoutGrow is silently accepted with no effect (P4) — minted,
   *  it would be a dead fact riding as an imported.* token (N-DISP-02). */
  // @door anatomy.grid-child-grow-mint-refusal
  const refuseGridChildGrow = (parent: UnionNode): void => {
    for (const c of parent.children) {
      gridMintRefusals.set(
        `${c.partName}|flex-grow`,
        `${GRID_REFUSALS['grid-child-grow']} — observed on ${c.partName} under grid parent ${parent.partName || 'root'}; the real grid layout ignores it too, so a minted token would carry a dead fact (P4/N-DISP-02)`,
      );
    }
  };
  /** When a display:grid parent is NOT promoted (structured promotion
   *  abandoned or G7-refused), its children's placement longhands describe a
   *  grid the contract does not carry — refused from minting BY NAME with the
   *  abandoning reason (for placement beyond the declared track list that
   *  reason is the grid-implicit-tracks refusal, P9/N-DISP-02). */
  // @door anatomy.grid-placement-mint-refusal
  const refuseGridPlacementMint = (parent: UnionNode, reason: string): void => {
    for (const c of parent.children) {
      for (const ch of GRID_PLACEMENT_CHANNELS) {
        gridMintRefusals.set(
          `${c.partName}|${ch}`,
          `grid placement not carried: parent ${parent.partName || 'root'} declined structured grid promotion — ${reason}; an anchor/span of a grid the contract does not carry is a dead fact and is refused, not minted`,
        );
      }
    }
  };
  const assets = new Map<string, string>();
  /** ORPHAN-ASSET ROUND (task #42, second half) — asset name -> the union part
   *  that hosts it. The svg-asset door runs at the TOP of this function and the
   *  painting refusals (`non-painting-part`, `inert-overlay-wrapper`, …) run at
   *  the BOTTOM, so an asset could be reconstructed and committed for a part
   *  that never reaches the promoted contract. MEASURED:
   *  `examples/mui/assets/icons/autocomplete-autocomplete-clearindicator.svg`
   *  is written by promote-floor and referenced by no contract — its host
   *  `autocomplete-clearindicator` is refused `non-painting-part: renders NO
   *  INK in any combo it appears in (visibility: hidden)`. Same class of lie as
   *  the orphan minted leaf; fixed at the same door, below. */
  const assetOwner = new Map<string, string>();
  const consumed = new Set<number>();
  const contract = structuredClone(space.contract) as Contract;
  const entries = union.entries;
  const idxOf = new Map(entries.map((e, i) => [e.id, i] as const));
  const staticByName = new Map(walkAnatomy(contract).map((w) => [w.name, w.part] as const));
  const enabled = space.enumeration.combos.filter(isEnabledCombo);
  const presenceProps = new Set(space.presence.keys());
  const stateProps = space.stateProps.map((s) => s.prop);
  // Round 5f — OPTIONAL-ADORNMENT (defaultless structure-gating enum): any
  // defaultless enum axis that gates a part PRESENT-ONLY-WHEN-SET (a
  // factorPresence base-hidden `shownWhen` fact — the adornment is ABSENT at
  // unset and appears per SET value: Badge `progress` → the status pip) is
  // collected here. After the anatomy is built, each such axis materializes
  // its UNSET pseudo-value into the contract enum AS THE DEFAULT, so the emit
  // enumerates a PLAIN (adornment-absent) variant and the base-hidden part
  // renders nothing there. This extends the S2 unset-axis machinery from
  // STYLING to STRUCTURE (the round's spine). Booleans are NOT touched —
  // presence booleans already default OFF and expose a toggle; a defaultless
  // enum that only drives STYLING (Badge `tone`) is NOT collected (it gates
  // no part), so its unset stays the S2 styling base plane, not a variant.
  const structureGatingUnsetAxes = new Set<string>();

  // 1. presence boolean props (structure-creating optional props) join the
  //    contract's prop list.
  for (const pp of space.presence.values()) {
    if (contract.props.some((p) => p.name === pp.prop)) continue;
    contract.props.push({
      name: pp.prop,
      description: `Structure-creating optional prop promoted by the computed floor (round 4): ON mounts the library's \`${pp.libraryProp}\` (${JSON.stringify(pp.value).slice(0, 60)}); the created subtree is carried as parts gated on this prop.`,
      type: 'boolean',
      default: false,
      bindings: {
        figma: { kind: 'BOOLEAN', property: `Show ${pp.prop.charAt(0).toUpperCase()}${pp.prop.slice(1)}` },
        code: { prop: pp.prop },
      },
    } as Contract['props'][number]);
    receipts.push(`presence-prop-added: ${pp.prop} (boolean, default false; library prop ${pp.libraryProp})`);
  }

  // 2. presence facts per union entry (over enabled default-state captures).
  const presentBy = new Map<number, Combo[]>();
  for (const combo of enabled) {
    const els = union.alignedByKey.get(`${combo.key}__default`);
    if (!els) continue;
    entries.forEach((e, i) => {
      if (els[i]) (presentBy.get(i) ?? presentBy.set(i, []).get(i)!).push(combo);
    });
  }
  // Round 5c: presence over ALL default-interaction combos (state planes
  // included) — the complement-of-product spelling needs the full domain
  // (a disabled Tag renders the plain label even when linked).
  const allDefaultCombos = space.enumeration.combos.filter((c) => union.alignedByKey.has(`${c.key}__default`));
  const presentAllBy = new Map<number, Set<string>>();
  for (const combo of allDefaultCombos) {
    const els = union.alignedByKey.get(`${combo.key}__default`)!;
    entries.forEach((e, i) => {
      if (els[i]) (presentAllBy.get(i) ?? presentAllBy.set(i, new Set()).get(i)!).add(combo.key);
    });
  }

  // 3. svg targets: map host union index → per-combo markup.
  interface SvgPlan {
    hostIdx: number;
    /** value-keyed markup: axis prop + per-value assets, or single asset. */
    perValue: Array<{ value?: string; prop?: string; asset: string; size: number }>;
  }
  const svgPlans = new Map<number, SvgPlan>(); // host idx → plan
  const svgHostOf = new Map<number, number>(); // svg idx → host idx
  for (const e of entries) {
    const t = svgTarget(e);
    if (!t) continue;
    const hostIdx = idxOf.get(t.host.id)!;
    const svgIdx = idxOf.get(t.svg.id)!;
    // @door anatomy.svg-host-plan-first-wins
    if (svgPlans.has(hostIdx)) continue;
    svgHostOf.set(svgIdx, hostIdx);
    // per-combo markup over combos where the svg is present
    // Round 5c: the currentColor preference is a PER-SVG decision — the
    // fill==color identity must hold in EVERY present combo (see
    // reconstructSvg's preferCurrentColor doc).
    let identityEverywhere = true;
    for (const combo of presentBy.get(svgIdx) ?? []) {
      const el = union.alignedByKey.get(`${combo.key}__default`)![svgIdx];
      if (!el) continue;
      const st = el.node.style;
      if (!st['fill'] || !st['color'] || st['fill'] !== st['color']) { identityEverywhere = false; break; }
    }
    const markups = new Map<string, { markup: string; size: number; vb: number; extent: number; bumped: boolean }>(); // comboKey → markup
    for (const combo of presentBy.get(svgIdx) ?? []) {
      const els = union.alignedByKey.get(`${combo.key}__default`)!;
      const el = els[svgIdx];
      if (!el) continue;
      const r = reconstructSvg(el.node, receipts, `${comp.name}.${t.host.partName}@${combo.key}`, identityEverywhere);
      if (r) markups.set(combo.key, r);
    }
    if (markups.size === 0) continue;
    // Round 5c — AUTHORED-VIEWBOX unification: one authored glyph captured
    // at several sizes carries IDENTICAL path data; the reconstruction can
    // only see the authored user space at the size whose computed box bounds
    // the path extent (Avatar Xl: 40 ≥ 38.6 — exact on the canvas gate).
    // Smaller captures were BUMPED to ceil(extent) — a guess the package
    // contradicts. Group by path data; when a group has an UNBUMPED member
    // whose viewBox bounds every member's extent, bumped members adopt that
    // authored space (receipted; per-size stroke widths stay captured truth).
    {
      const dOf = (m: string) => (m.match(/ d="[^"]*"/g) ?? []).join('|');
      const byPath = new Map<string, Array<{ key: string; r: { markup: string; size: number; vb: number; extent: number; bumped: boolean } }>>();
      for (const [k, r] of markups) {
        const sig = dOf(r.markup);
        (byPath.get(sig) ?? byPath.set(sig, []).get(sig)!).push({ key: k, r });
      }
      for (const group of byPath.values()) {
        if (group.length < 2) continue;
        const anchors = group.filter((g) => !g.r.bumped);
        if (anchors.length === 0) continue;
        const cand = Math.max(...anchors.map((g) => g.r.vb));
        for (const g of group) {
          if (!g.r.bumped || g.r.vb === cand) continue;
          if (cand < g.r.extent) continue; // the authored space must bound the paths
          receipts.push(
            `svg-viewbox-unified: ${comp.name}.${t.host.partName}@${g.key} — bumped 0 0 ${g.r.vb} ${g.r.vb} adopts the sibling capture's authored space 0 0 ${cand} ${cand} (identical path data drawn where the computed box bounds the extent — the package's own viewBox; round 5c)`,
          );
          g.r.markup = g.r.markup.replace(/viewBox="0 0 [\d.]+ [\d.]+"/, `viewBox="0 0 ${cand} ${cand}"`);
          g.r.vb = cand;
        }
      }
    }
    // correlate: uniform | single-axis | refuse
    const distinct = new Map<string, string[]>(); // markup → combo keys
    for (const [k, m] of markups) (distinct.get(m.markup) ?? distinct.set(m.markup, []).get(m.markup)!).push(k);
    const kebabValue = (v: string) => v.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
    if (distinct.size === 1) {
      const name = `${componentKebab}-${kebabValue(t.host.partName)}`;
      assets.set(name, [...markups.values()][0].markup);
      assetOwner.set(name, t.host.partName);
      svgPlans.set(hostIdx, { hostIdx, perValue: [{ asset: name, size: [...markups.values()][0].size }] });
    } else {
      // single-axis explanation: find an axis whose value partitions markup
      const comboByKey = new Map(enabled.map((c) => [c.key, c] as const));
      // @door anatomy.svg-content-multi-axis
      const axis = space.axes.find((ax) => {
        const byValue = new Map<string, Set<string>>();
        for (const [k, m] of markups) {
          const v = comboByKey.get(k)!.axisValues[ax.prop];
          (byValue.get(v) ?? byValue.set(v, new Set()).get(v)!).add(m.markup);
        }
        return [...byValue.values()].every((s) => s.size === 1);
      });
      if (!axis) {
        refusals.push(`svg-content-multi-axis: ${comp.name}.${t.host.partName} — markup varies over more than one axis; asset refused (part still promoted as a box)`);
        continue;
      }
      const perValue: SvgPlan['perValue'] = [];
      const seenValues = new Set<string>();
      for (const [k, m] of markups) {
        const v = comboByKey.get(k)!.axisValues[axis.prop];
        if (seenValues.has(v)) continue;
        seenValues.add(v);
        const name = `${componentKebab}-${kebabValue(t.host.partName)}-${kebabValue(v)}`;
        assets.set(name, m.markup);
        assetOwner.set(name, t.host.partName);
        perValue.push({ value: v, prop: axis.prop, asset: name, size: m.size });
      }
      svgPlans.set(hostIdx, { hostIdx, perValue });
    }
    // consume the svg subtree. When the svg IS the host (no dedicated
    // wrapper), its OWN channels stay mintable — the per-tone fill cascades
    // to attribute-less paths in CSS; only descendants are consumed.
    // @door anatomy.svg-subtree-consume
    const consume = (u: UnionNode) => {
      consumed.add(idxOf.get(u.id)!);
      for (const c of u.children) consume(c);
    };
    if (t.host === t.svg) {
      for (const c of t.svg.children) consume(c);
    } else {
      consume(t.svg);
    }
  }

  // 4. build the promoted anatomy tree in union order.
  const rootEntry = entries[0];
  const rootPart = contract.anatomy['root'];
  if (!rootPart) throw new Error(`${comp.name}: contract has no root anatomy part`);
  const partIndex = new Map<string, number>();

  const textOf = (n: CapturedNode): string =>
    n.nodes.filter((c) => c.t === 'text').map((c) => (c as { v: string }).v).join('').trim();
  const samplesByProp = new Map<string, string>();
  for (const p of contract.props) {
    if (p.type !== 'text') continue;
    if (p.bindings.code.prop === 'children') samplesByProp.set(p.name, comp.sampleText);
    else {
      const fixed = comp.fixedProps?.[p.name];
      if (typeof fixed === 'string') samplesByProp.set(p.name, fixed);
    }
  }

  /** Apply a compiled svg plan onto a HOST part: single asset → Part.icon;
   *  per-value assets → per-value icon child parts. Round 5c: extracted so
   *  the ROOT can host a plan too (Spinner's glyph is the root's only child
   *  — buildPart never runs on the root, and the plan silently dropped). */
  const applySvgPlan = (part: Part, e: UnionNode, plan: SvgPlan): void => {
    if (e.rep.tag === 'svg') delete part.element; // icon parts render their own <svg> from the asset
    if (plan.perValue.length === 1 && plan.perValue[0].value === undefined) {
      part.icon = { asset: plan.perValue[0].asset, size: plan.perValue[0].size };
      // the host element wraps the glyph; its own element stays
      return;
    }
    // per-value icon parts nested under the host box part (names prefixed
    // by the host part — part names are contract-global). A glyph keyed by
    // the UNSET pseudo-value of a defaultless axis is the DEFAULT glyph:
    // visible unless a set value applies (stylesWhen display:none per set
    // value — the pseudo-value is not a contract enum value).
    part.parts = { ...part.parts };
    for (const pv of plan.perValue) {
      const axisSpec = space.axes.find((ax) => ax.prop === pv.prop);
      const isUnsetValue = axisSpec?.unset !== undefined && pv.value === axisSpec.unset;
      const child: Part = {
        icon: { asset: pv.asset, size: pv.size },
        ...(isUnsetValue
          ? {
              stylesWhen: axisSpec!.values
                .filter((v) => v !== axisSpec!.unset)
                .map((v) => ({ prop: pv.prop!, equals: v, styles: { display: 'none' } })),
            }
          : { visibleWhen: { prop: pv.prop!, equals: pv.value } }),
        description: `Per-value svg content promoted from the computed floor: the glyph drawn when ${pv.prop}=${isUnsetValue ? `unset (default)` : pv.value}.`,
      };
      part.parts[`${e.partName}-${pv.value!.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`] = child;
    }
  };

  /** Round 5c — S5 first real slice: DRAWN pseudo-element DECOR BOXES
   *  promote as shape parts (the RadioButton ::before selected dot). The
   *  floor's read includes ::before/::after; until now every finding was
   *  extension residue. Bounded v1 grammar, everything else refuses by name:
   *    · content must be the empty string (a decor box, never text ink);
   *    · the box must be DRAWN: opaque-ish background (alpha > 0), opacity
   *      > 0.05, positive px box, position:absolute, and any transform a
   *      pure translate at scale ≈ 1 (a scale-0/opacity-0 pseudo is the
   *      component's own hidden state — that combo counts as NOT drawn);
   *    · geometry + fill must be UNIFORM across every drawn enabled combo
   *      (translate folds into top/left, receipted);
   *    · visibility must factor per-axis (factorPresence), and placement
   *      needs an enum condition to ride stylesWhen — the v9 shape grammar
   *      the canvas already compiles (position/top/left per combo).
   */
  /** When the host part is a SHAPE LEAF (curated backdrop), the decor cannot
   *  nest inside it (shape parts refuse children) — it BUBBLES to the host's
   *  parent, offsets folded with the host's border widths, guarded by a
   *  geometry assertion: the parent's content box must equal the host's
   *  border box (else named refusal). */
  const pseudoDecorParts = (
    e: UnionNode,
    i: number,
    hostIsShapeLeaf: boolean,
    hostPart: Part | null = null,
  ): Array<[string, Part]> => {
    const out: Array<[string, Part]> = [];
    const px = (v: string | undefined): number | null => {
      const m = /^(-?\d+(?:\.\d+)?)px$/.exec(v ?? '');
      return m ? Number(m[1]) : null;
    };
    const alphaOf = (v: string | undefined): number => {
      const m = /^rgba\(\d+, \d+, \d+, ([\d.]+)\)$/.exec(v ?? '');
      return m ? Number(m[1]) : 0;
    };
    for (const pe of DECOR_PSEUDOS) {
      // Domain: ALL default-interaction combos where the host renders (state
      // planes included — a disabled checked Radio keeps its dot; an
      // enabled-only domain would fabricate a hidden-when-disabled fact).
      const domain = allDefaultCombos.filter((combo) => union.alignedByKey.get(`${combo.key}__default`)![i]);
      // COINCIDENT-SHADOW FOLD (mui/slider live-canvas round, 2026-08-11).
      //
      // A pseudo whose ONLY paint is a box-shadow was refused by name
      // ("painted by a mechanism the grammar cannot read") and the shadow
      // never reached the canvas. MUI's Slider thumb is exactly that shape:
      // `.MuiSlider-thumb` is a 20x20 blue circle with `box-shadow: none`,
      // and its ::before is a COINCIDENT 20x20 transparent circle carrying
      // Material elevation-2. The reference render's ink box is 24px tall
      // where the canvas draws 20 — the whole 4px is that shadow — and the
      // scorer then rescales by 1.2 to align, which blurs every edge and
      // costs the stem its pass on a fact the capture already holds.
      //
      // PROMOTING IT AS ITS OWN DECOR PART WOULD BE A SILENT LOSS, MEASURED:
      // a Figma node casts a shadow from its own alpha, so a transparent
      // ellipse with three DROP_SHADOW effects renders NOTHING (probed live
      // on the canvas — solid drew, transparent and fill-less drew nothing).
      // The only honest carriage is to FOLD the shadow onto the HOST part,
      // which is legitimate precisely because the box is coincident: same
      // size, same corner spelling, at 0,0, painting nothing else.
      //
      // BOUNDED, and the bound is what keeps it from adding wrong ink. Seven
      // of the corpus's eight shadow-only pseudo refusals are focus rings
      // spelled `0 0 0 -1px` (negative spread draws nothing) or `inset`
      // hairlines; requiring a NON-INSET layer that actually draws leaves
      // exactly one fold corpus-wide. A host that already carries its own
      // box-shadow is never overwritten.
      //
      // THE SHADOW FACTORS LIKE EVERY OTHER DECOR CHANNEL — measured, not
      // assumed. The first cut required one uniform value across the domain
      // and did not fire, because `size=small`'s thumb::before is
      // `box-shadow: none` and only `medium` carries the elevation. That is a
      // real MUI fact, so the fold uses the SAME one-enum-axis rule the
      // paint/size/geometry factoring already uses: uniform, or a function of
      // exactly ONE enum axis (then `literalsByProp`). At least one value must
      // actually draw, or there is nothing to carry.
      // @door anatomy.pseudo-shadow-fold
      if (hostPart) {
        const drawsShadow = (v: string): boolean =>
          splitTopLevelCommas(v).some((layer) => {
            if (/(^| )inset( |$)/.test(layer)) return false;
            const lens = [...layer.matchAll(/(-?[\d.]+)px/g)].map((m) => Number(m[1]));
            const [x = 0, y = 0, blur = 0, spread = 0] = lens;
            // A layer draws when it escapes its own box: blur or a positive
            // spread or an offset. `0 0 0 -1px` shrinks and shows nothing.
            return blur > 0 || spread > 0 || x !== 0 || y !== 0;
          });
        const foldRows: Array<{ combo: Combo; sh: string }> = [];
        let foldable = domain.length > 0;
        for (const combo of domain) {
          const els = union.alignedByKey.get(`${combo.key}__default`)!;
          const host = els[i];
          const st = host?.node.pseudo[pe];
          if (!st) continue;
          const hs = host!.node.style;
          const sh = st['box-shadow'] ?? 'none';
          const t = st['transform'] ?? 'none';
          const idTranslate =
            t === 'none' ||
            /^matrix\(1, 0, 0, 1, 0, 0\)$/.test(t);
          const hostW = px(hs['width']);
          const hostH = px(hs['height']);
          const w = px(st['width']);
          const h = px(st['height']);
          const ok =
            st['content'] === '""' &&
            st['position'] === 'absolute' &&
            (px(st['top']) ?? NaN) === 0 &&
            (px(st['left']) ?? NaN) === 0 &&
            idTranslate &&
            Number(st['opacity'] ?? '1') > 0.05 &&
            w !== null && h !== null && hostW !== null && hostH !== null &&
            Math.abs(w - hostW) <= 0.6 && Math.abs(h - hostH) <= 0.6 &&
            st['border-top-left-radius'] === hs['border-top-left-radius'] &&
            alphaOf(st['background-color']) === 0 &&
            Math.max(...BORDER_SIDES.map((s) => px(st[`border-${s}-width`]) ?? 0)) === 0 &&
            (hs['box-shadow'] ?? 'none') === 'none' &&
            // `none` is a legal VALUE here (MUI's small thumb has no
            // elevation); what disqualifies the fold is a shadow the bound
            // says draws nothing, because carrying it would add wrong ink.
            (sh === 'none' || drawsShadow(sh));
          if (!ok) { foldable = false; break; }
          foldRows.push({ combo, sh });
        }
        const foldAxes = space.axes.filter(
          (a) => !presenceProps.has(a.prop) && !stateProps.includes(a.prop) && contract.props.some((p) => p.name === a.prop),
        );
        /** Uniform, or a function of exactly ONE enum axis. null = neither. */
        const factorShadow = (): { kind: 'uniform'; value: string } | { kind: 'axis'; prop: string; map: Map<string, string> } | null => {
          const vals = foldRows.map((r) => r.sh);
          if (new Set(vals).size === 1) return { kind: 'uniform', value: vals[0] };
          for (const ax of foldAxes) {
            const byVal = new Map<string, string>();
            let ok = true;
            for (const r of foldRows) {
              const v = r.combo.axisValues[ax.prop];
              if (v === undefined) { ok = false; break; }
              const prev = byVal.get(v);
              if (prev === undefined) byVal.set(v, r.sh);
              else if (prev !== r.sh) { ok = false; break; }
            }
            if (ok && new Set(byVal.values()).size > 1) return { kind: 'axis', prop: ax.prop, map: byVal };
          }
          return null;
        };
        const fact = foldable && foldRows.length > 0 ? factorShadow() : null;
        if (fact && foldRows.some((r) => r.sh !== 'none')) {
          const baseShadow = (() => {
            if (fact.kind === 'uniform') return fact.value;
            const ax = space.axes.find((a) => a.prop === fact.prop)!;
            const decl = contract.props.find((p) => p.name === fact.prop)?.default;
            const baseVal = decl !== undefined ? String(decl) : (ax.values.find((v) => v !== ax.unset) ?? ax.values[0]);
            return fact.map.get(baseVal) ?? [...fact.map.values()].find((v) => v !== 'none') ?? [...fact.map.values()][0];
          })();
          hostPart.literals = { ...(hostPart.literals ?? {}), 'box-shadow': baseShadow };
          if (fact.kind === 'axis') {
            const byProp = (hostPart.literalsByProp ??= []);
            const entry = byProp.find((b) => b.prop === fact.prop);
            const map = Object.fromEntries([...fact.map].map(([v, sh]) => [v, { 'box-shadow': sh }]));
            if (entry) for (const [v, m] of Object.entries(map)) entry.map[v] = { ...entry.map[v], ...m };
            else byProp.push({ prop: fact.prop, map });
          }
          refusals.push(
            `pseudo-decor-shadow-folded: ${e.partName}${pe} is a coincident box that paints ONLY box-shadow — folded onto ${e.partName} as a literal rather than promoted as its own part, because a Figma node casts a shadow from its OWN alpha and a transparent one renders nothing (probed live). Carried ${fact.kind === 'uniform' ? `uniform (${fact.value})` : `per ${fact.prop} (${[...fact.map].map(([v, sh]) => `${v}: ${sh === 'none' ? 'none' : 'shadow'}`).join(', ')})`} over ${foldRows.length}/${domain.length} default combos`,
          );
          continue;
        }
      }
      const drawnRows: Array<{ combo: Combo; st: Record<string, string> }> = [];
      // SILENT-LOSS ROUND (task #33, fix 2) — THE TWO BARE `continue`s.
      //
      // Both of the skips in this loop used to be silent, and between them
      // they hid EVERY un-promoted pseudo-element:
      //
      //   · `content !== '""'` — text/glyph-bearing pseudo content, i.e.
      //     every ICON-FONT GLYPH. `content: "\ea01"` is how Bootstrap,
      //     FontAwesome and Material ligature sets draw carets, chevrons and
      //     close ×s. The grammar cannot promote one, which is fine; saying
      //     nothing about it is not.
      //   · `!drawn` — which CONFLATED two completely different facts:
      //     "legitimately hidden in this combo" (the component's own
      //     scale-0/opacity-0 hidden state — normal, expected, not a loss)
      //     with "painted by something the grammar cannot read"
      //     (position:static/relative decor, gradient/shadow/outline-only
      //     paint, opacity in (0, 0.05]). The second is exactly the shape of
      //     Carbon's hollow checkbox, and this is the change that would have
      //     caught it on its FIRST run.
      //
      // The two are reported under DIFFERENT names on purpose — a hidden
      // state is not a limit, and a limit is not a hidden state.
      const notDrawn = new Map<string, string>(); // reason-key -> message (deduped per part/pseudo)
      for (const combo of domain) {
        const el = union.alignedByKey.get(`${combo.key}__default`)![i];
        const st = el?.node.pseudo[pe];
        if (!st) continue;
        // @door anatomy.pseudo-content-empty-only
        if (st['content'] !== '""') {
          notDrawn.set('content', `pseudo-content-not-canvas-ink: ${e.partName}${pe} carries content ${st['content']} — the bounded decor grammar promotes EMPTY-content decor boxes only. A glyph drawn by an icon-font ligature (Bootstrap/FontAwesome/Material carets, chevrons, close ×s) is real ink that does NOT reach the canvas; named refusal`);
          continue;
        }
        const w = px(st['width']);
        const h = px(st['height']);
        const opacity = Number(st['opacity'] ?? '1');
        const alpha = alphaOf(st['background-color']);
        const t = st['transform'] ?? 'none';
        const mtx = /^matrix\((-?[\d.]+), (-?[\d.]+), (-?[\d.]+), (-?[\d.]+), (-?[\d.]+), (-?[\d.]+)\)$/.exec(t);
        const m = mtx
          ? {
              a: Number(mtx[1]),
              b: Number(mtx[2]),
              c: Number(mtx[3]),
              d: Number(mtx[4]),
              e: Number(mtx[5]),
              f: Number(mtx[6]),
            }
          : null;
        // Wave B.2 — TRANSFORM CARRIAGE (Carbon checkbox ::after live finding).
        // v1 allowed translate-only (identity linear part). That refused the
        // whole pseudo when ANY combo used scale(0) to hide the check, even
        // though checked/indeterminate draw a readable L-bar / minus with an
        // orthonormal rotate. Zero-scale is the component's OWN hidden state
        // (same class as opacity:0); orthonormal rotate is canvas-native
        // (`shape.rotation` / stylesWhen `rotate(<n>deg)`).
        const col1 = m ? Math.hypot(m.a, m.b) : 1;
        const col2 = m ? Math.hypot(m.c, m.d) : 1;
        const isZeroScale = m !== null && col1 < 0.02 && col2 < 0.02;
        const isTranslateOnly =
          t === 'none' ||
          (m !== null &&
            Math.abs(m.b) < 0.01 &&
            Math.abs(m.c) < 0.01 &&
            Math.abs(m.a - 1) < 0.01 &&
            Math.abs(m.d - 1) < 0.01);
        const isOrthonormalRotate =
          m !== null &&
          !isZeroScale &&
          Math.abs(col1 - 1) < 0.03 &&
          Math.abs(col2 - 1) < 0.03 &&
          Math.abs(m.a * m.c + m.b * m.d) < 0.03;
        // ANTD EXAM (heal loop, 2026-08-23 — W5, the scale half): antd's
        // Radio reveals its dot with `transform: scale(0.375)` on a 16×16
        // `::after` — a UNIFORM scale about the box's centre (transform-origin
        // 50% 50%), which is exactly a smaller box at a centred offset. The
        // fold below multiplies width/height by the scale and moves top/left
        // by the half-difference, so the dot lands as a 6×6 white ellipse;
        // non-uniform or skewed scales stay outside the grammar by name.
        const isUniformScale =
          m !== null &&
          !isZeroScale &&
          Math.abs(m.b) < 0.01 &&
          Math.abs(m.c) < 0.01 &&
          Math.abs(m.a - m.d) < 0.01 &&
          m.a > 0.02 &&
          m.a < 0.999;
        // @door anatomy.pseudo-transform-grammar
        const transformOk = isTranslateOnly || isOrthonormalRotate || isUniformScale;
        // PSEUDO-DECOR v2 (CARBON LIVE-DEFECT ROUND, D2) — DRAWN MEANS PAINTS
        // ANYTHING. v1 required an opaque-ish BACKGROUND, so a box made of a
        // RING was invisible to the grammar: an unchecked Carbon checkbox is
        // `background: transparent; border: 1px solid #161616`, and refusing
        // it is why the live canvas showed a checkbox with no box at all.
        const maxBorder = Math.max(...BORDER_SIDES.map((s) => px(st[`border-${s}-width`]) ?? 0));
        const borderAlpha = alphaOf(st['border-top-color']);
        // @door anatomy.pseudo-not-drawn-split
        const paints = alpha > 0 || (maxBorder > 0 && borderAlpha > 0);
        const drawn = paints && opacity > 0.05 && w !== null && h !== null && w > 0 && h > 0 && st['position'] === 'absolute';
        if (!drawn || isZeroScale) {
          // fix 2: name WHICH of the two it is, and MEASURE it.
          const pos = st['position'] ?? '(unset)';
          const zeroBox = w === null || h === null || w <= 0 || h <= 0;
          const hasGradient = (st['background-image'] ?? 'none') !== 'none';
          const hasShadow = (st['box-shadow'] ?? 'none') !== 'none';
          const outlineW = px(st['outline-width']) ?? 0;
          const hasOutline = outlineW > 0 && (st['outline-style'] ?? 'none') !== 'none';
          if (isZeroScale || opacity === 0 || zeroBox) {
            // the component's OWN hidden state for this combo — expected,
            // and NOT a limit of the grammar. Named separately so it can
            // never be mistaken for one. scale(0) is Carbon's checkbox
            // unchecked ::after hide (Wave B.2).
            notDrawn.set(
              'hidden',
              `pseudo-decor-hidden-in-combo: ${e.partName}${pe} is not drawn in every combo (${isZeroScale ? `transform ${t} (scale 0)` : `opacity ${opacity}, box ${w ?? 'null'}x${h ?? 'null'}`}) — the component's own hidden state, NOT a grammar limit`,
            );
          } else if (pos !== 'absolute') {
            notDrawn.set('position', `pseudo-decor-outside-grammar: ${e.partName}${pe} paints at position:${pos} (${w}x${h}, opacity ${opacity}) — the bounded decor grammar reads position:absolute boxes only; an in-flow decor box is NOT promoted and NOT on the canvas`);
          } else if (!paints && (hasGradient || hasShadow || hasOutline)) {
            const how = [hasGradient ? `background-image: ${st['background-image']}` : null, hasShadow ? `box-shadow: ${st['box-shadow']}` : null, hasOutline ? `outline: ${outlineW}px ${st['outline-style']}` : null].filter(Boolean).join('; ');
            notDrawn.set('paint', `pseudo-decor-outside-grammar: ${e.partName}${pe} is painted by a mechanism the grammar cannot read (${how}) — the decor grammar reads background-color alpha and border rings only; the box is NOT promoted`);
          } else if (!paints) {
            notDrawn.set('paint', `pseudo-decor-outside-grammar: ${e.partName}${pe} occupies ${w}x${h} at position:absolute but paints nothing the grammar reads (background-color ${st['background-color'] ?? '(unset)'}, border ${maxBorder}px ${st['border-top-color'] ?? '(unset)'}) — NOT promoted`);
          } else if (opacity <= 0.05) {
            notDrawn.set('opacity', `pseudo-decor-outside-grammar: ${e.partName}${pe} paints at opacity ${opacity} — inside the (0, 0.05] band the grammar treats as not-drawn. That band cannot tell a nearly-invisible DECOR box from a hidden state; named refusal rather than a guess`);
          }
          continue;
        }
        if (!transformOk) {
          refusals.push(`pseudo-decor-outside-grammar: ${e.partName}${pe} drawn with a non-carryable transform (${t}) — the bounded decor grammar carries translate + orthonormal rotate only; named refusal`);
          drawnRows.length = 0;
          break;
        }
        drawnRows.push({ combo, st });
      }
      if (drawnRows.length === 0) {
        // fix 2: nothing promoted for this pseudo — say why, by name. (When
        // SOME combos drew, the promotion proceeds and the per-combo notes
        // are the domain's own hidden-state facts, already carried by
        // factorPresence.)
        for (const msg of [...notDrawn.values()].sort()) refusals.push(msg);
        continue;
      }
      // uniform geometry + fill over the drawn combos (translate folded)
      // Bubbled decor: offsets are parent-relative — fold the HOST's border
      // widths in (absolute children position against the PADDING box) and
      // assert the parent's content box equals the host's border box.
      // @door anatomy.pseudo-bubble-geometry
      if (hostIsShapeLeaf) {
        let geometryOk = e.parent !== null;
        for (const { combo } of drawnRows) {
          const els = union.alignedByKey.get(`${combo.key}__default`)!;
          const host = els[i];
          const parent = e.parent ? els[idxOf.get(e.parent.id)!] : null;
          if (!host || !parent) { geometryOk = false; break; }
          const hs = host.node.style;
          const pst = parent.node.style;
          const num = (v: string | undefined) => px(v) ?? 0;
          const parentContentW = num(pst['width']) - num(pst['padding-left']) - num(pst['padding-right']) - num(pst['border-left-width']) - num(pst['border-right-width']);
          const parentContentH = num(pst['height']) - num(pst['padding-top']) - num(pst['padding-bottom']) - num(pst['border-top-width']) - num(pst['border-bottom-width']);
          if (
            Math.abs(parentContentW - num(hs['width'])) > 0.6 ||
            Math.abs(parentContentH - num(hs['height'])) > 0.6 ||
            num(hs['margin-top']) !== 0 || num(hs['margin-left']) !== 0
          ) { geometryOk = false; break; }
        }
        if (!geometryOk) {
          refusals.push(`pseudo-decor-bubble-geometry: ${e.partName}${pe} — the host is a shape leaf (cannot nest children) and the parent's content box does not equal the host's border box; decor NOT promoted (named refusal, v1 bounded)`);
          continue;
        }
      }
      const fold = (row: { combo: Combo; st: Record<string, string> }) => {
        const t = row.st['transform'] ?? 'none';
        const mtx = /^matrix\((-?[\d.]+), (-?[\d.]+), (-?[\d.]+), (-?[\d.]+), (-?[\d.]+), (-?[\d.]+)\)$/.exec(t);
        const tx = mtx ? Number(mtx[5]) : 0;
        const ty = mtx ? Number(mtx[6]) : 0;
        // CSS matrix(a,b,c,d,e,f): column1=(a,b)= (cosθ, sinθ). Degrees are
        // what emit's stylesWhen `rotate(<n>deg)` / shape.rotation expect.
        const rot =
          mtx && !(Math.abs(Number(mtx[2])) < 0.01 && Math.abs(Number(mtx[3])) < 0.01)
            ? (Math.atan2(Number(mtx[2]), Number(mtx[1])) * 180) / Math.PI
            : 0;
        // Bubbled: absolute children position against the host's PADDING box
        // — the host's border widths join the parent-relative offsets.
        const hostSt = hostIsShapeLeaf ? union.alignedByKey.get(`${row.combo.key}__default`)![i]!.node.style : null;
        const bT = hostSt ? (px(hostSt['border-top-width']) ?? 0) : 0;
        const bL = hostSt ? (px(hostSt['border-left-width']) ?? 0) : 0;
        const w0 = px(row.st['width'])!;
        const h0 = px(row.st['height'])!;
        // uniform scale (W5): the box shrinks about its centre
        const sc = mtx && Math.abs(Number(mtx[2])) < 0.01 && Math.abs(Number(mtx[3])) < 0.01 && Math.abs(Number(mtx[1]) - Number(mtx[4])) < 0.01 && Number(mtx[1]) > 0.02 && Number(mtx[1]) < 0.999 ? Number(mtx[1]) : 1;
        const w = Math.round(w0 * sc * 1000) / 1000;
        const h = Math.round(h0 * sc * 1000) / 1000;
        const scaleDx = (w0 - w) / 2;
        const scaleDy = (h0 - h) / 2;
        const borderW = Object.fromEntries(BORDER_SIDES.map((s) => [s, px(row.st[`border-${s}-width`]) ?? 0])) as Record<string, number>;
        const sideColors = BORDER_SIDES.map((s) => row.st[`border-${s}-color`] ?? '');
        return {
          w,
          h,
          // An absolute box's offset is top + margin-top (antd's Radio dot:
          // `top: 50%; margin-block-start: -8px` — the margin was never folded
          // and the dot landed at 12,12 in a 16px box instead of centred).
          top: (px(row.st['top']) ?? 0) + (px(row.st['margin-top']) ?? 0) + ty + bT + scaleDy,
          left: (px(row.st['left']) ?? 0) + (px(row.st['margin-left']) ?? 0) + tx + bL + scaleDx,
          rot: Math.round(rot * 1000) / 1000,
          bg: row.st['background-color'],
          borderW,
          // ONE Figma stroke paint. Prefer the color of SIDES THAT INK
          // (width > 0): Carbon's checkbox ::after check is white on
          // left+bottom and dark on zero-width top+right — requiring all
          // four colors to agree dropped the stroke entirely (Wave B.2).
          // @door anatomy.pseudo-border-ink-color
          borderColor: (() => {
            const ink = BORDER_SIDES.filter((s) => borderW[s] > 0).map((s) => row.st[`border-${s}-color`] ?? '');
            if (ink.length > 0 && new Set(ink).size === 1) return ink[0];
            if (new Set(sideColors).size === 1 && Math.max(...Object.values(borderW)) > 0) return sideColors[0];
            return '';
          })(),
          // PSEUDO-DECOR v2 (G3) — SQUARE-THUMB TRAP. `rounded-full` computes
          // to 3.35544e+07px, which the local px() regex does not match, so
          // the radius folded to 0 and the decor shipped as a RECT. Share the
          // pill sentinel fuse.ts already uses for minted radii; the kind rule
          // below (radius ≥ min(w,h)/2) then correctly reads it as an ellipse.
          // CARBON (D2): a PERCENTAGE radius is the third spelling of the same
          // idea — Carbon's toggle knob is `border-radius: 50%`, which the px
          // regex also missed, so the round knob compiled as a SQUARE.
          radius: isAbsurdRadius(row.st['border-top-left-radius'])
            ? parseFloat(PILL_RADIUS_SENTINEL)
            : (pctRadius(row.st['border-top-left-radius'], w, h) ?? px(row.st['border-top-left-radius']) ?? 0),
        };
      };
      type Folded = ReturnType<typeof fold>;
      const folded = drawnRows.map(fold);
      // ANTD EXAM (heal loop, 2026-08-23): a decor that PAINTS (and is
      // therefore carried) may also cast a shadow the grammar cannot read —
      // antd's Switch knob rides `box-shadow: var(--ant-switch-handle-shadow)`
      // on its `::before`. The box was carried and the shadow vanished with
      // no receipt (the shadow refusal above fires only when nothing else
      // paints). Named here, beside the carriage.
      // @door anatomy.pseudo-shadow-uncarried
      {
        const shadowed = drawnRows.filter((r) => (r.st['box-shadow'] ?? 'none') !== 'none');
        if (shadowed.length > 0) {
          refusals.push(`pseudo-decor-shadow-uncarried: ${e.partName}${pe} paints box-shadow ${shadowed[0].st['box-shadow']} in ${shadowed.length}/${drawnRows.length} drawn combos — the bounded decor grammar carries background alpha + border rings only; the box is promoted, its shadow is not`);
        }
      }
      // PSEUDO-DECOR v2 (D2) — GEOMETRY and PAINT are factored SEPARATELY.
      //
      // v1 hashed the whole box (size + offsets + fill + radius) into one key
      // and refused anything non-uniform. Both hollow Carbon components died
      // there, and for two DIFFERENT reasons that the one refusal hid:
      //   · the CHECKBOX box has IDENTICAL geometry in all six combos and
      //     only its PAINT moves (transparent+ring when unchecked, filled
      //     when checked, quarter-alpha when disabled);
      //   · the TOGGLE knob has identical PAINT in the enabled plane and only
      //     its LEFT offset moves (3px → 27px with `toggled`).
      // Neither is the two-axis GEOMETRY product named in
      // examples/tailwind/PROVENANCE.md (Size × Toggled knob offsets) — that
      // wall is still here and still refuses, below.
      const enumAxes = space.axes.filter(
        (a) => !presenceProps.has(a.prop) && !stateProps.includes(a.prop) && contract.props.some((p) => p.name === a.prop),
      );
      // @door anatomy.pseudo-enabled-plane-wins
      const isEnabledCombo = (c: Combo) => Object.values(c.stateFlags).every((v) => v !== true);
      const enabledDrawn = drawnRows.map((r, k) => ({ ...r, f: folded[k] })).filter((r) => isEnabledCombo(r.combo));
      const rowsForFactoring = enabledDrawn.length > 0 ? enabledDrawn : drawnRows.map((r, k) => ({ ...r, f: folded[k] }));
      /** Uniform, or a function of exactly ONE enum axis. null = neither. */
      const factorByAxis = <T>(
        rows: Array<{ combo: Combo; f: Folded }>,
        valueOf: (f: Folded) => T,
      ): { kind: 'uniform'; value: T } | { kind: 'axis'; prop: string; map: Map<string, T> } | null => {
        const keys = rows.map((r) => JSON.stringify(valueOf(r.f)));
        if (new Set(keys).size === 1) return { kind: 'uniform', value: valueOf(rows[0].f) };
        for (const ax of enumAxes) {
          const byVal = new Map<string, string>();
          let ok = true;
          for (let k = 0; k < rows.length; k++) {
            const v = rows[k].combo.axisValues[ax.prop];
            if (v === undefined) { ok = false; break; }
            const prev = byVal.get(v);
            if (prev === undefined) byVal.set(v, keys[k]);
            else if (prev !== keys[k]) { ok = false; break; }
          }
          if (ok && new Set(byVal.values()).size > 1) {
            const map = new Map<string, T>();
            for (let k = 0; k < rows.length; k++) {
              const v = rows[k].combo.axisValues[ax.prop];
              if (!map.has(v)) map.set(v, valueOf(rows[k].f));
            }
            return { kind: 'axis', prop: ax.prop, map };
          }
        }
        return null;
      };
      // Wave B.1 — OFFSETS, SIZE, and PAINT factor separately (same
      // factorByAxis pattern). Offsets used to bundle width/height, so a
      // thumb that only resized by `sizing` (Tailwind ToggleSwitch ::after
      // at 16/20/24) was refused as if it needed a multi-axis geometry
      // product. Size may now factor by exactly ONE enum axis; the base
      // shape keeps the axis-default intrinsic size and per-value
      // width/height ride `literalsByProp` (emit syncs those onto shape
      // before resize). A size that does not factor — or an offset product
      // across two axes — still refuses by name.
      const offsetOf = (f: Folded) => ({ top: f.top, left: f.left });
      const sizeOf = (f: Folded) => ({ w: f.w, h: f.h });
      const paintOf = (f: Folded) => ({ bg: f.bg, borderW: f.borderW, borderColor: f.borderColor, radius: f.radius });
      const rotOf = (f: Folded) => f.rot;
      // @door anatomy.pseudo-uniform-or-one-axis
      const geomFact = factorByAxis(rowsForFactoring, offsetOf);
      if (!geomFact) {
        refusals.push(
          `pseudo-decor-geometry-multiaxis: ${e.partName}${pe} drawn offsets vary across the enabled combos and do not factor as a function of ONE enum axis (${[...new Set(rowsForFactoring.map((r) => JSON.stringify(offsetOf(r.f))))].join(' vs ')}) — the two-axis geometry product named in examples/tailwind/PROVENANCE.md; named refusal`,
        );
        continue;
      }
      const sizeFact = factorByAxis(rowsForFactoring, sizeOf);
      if (!sizeFact) {
        refusals.push(
          `pseudo-decor-size-varies: ${e.partName}${pe} drawn at ${[...new Set(rowsForFactoring.map((r) => `${r.f.w}×${r.f.h}`))].join(' vs ')} — size does not factor as a function of ONE enum axis (per-variant resize spelling is literalsByProp width/height on a single axis); named refusal`,
        );
        continue;
      }
      const paintFact = factorByAxis(rowsForFactoring, paintOf);
      if (!paintFact) {
        refusals.push(
          `pseudo-decor-paint-multiaxis: ${e.partName}${pe} drawn paint varies across the enabled combos and does not factor as a function of ONE enum axis (${[...new Set(rowsForFactoring.map((r) => JSON.stringify(paintOf(r.f))))].join(' vs ')}); named refusal`,
        );
        continue;
      }
      // Wave B.2 — rotation factors like paint (Carbon check ≈ −45°, minus = 0°).
      const rotFact = factorByAxis(rowsForFactoring, rotOf);
      if (!rotFact) {
        refusals.push(
          `pseudo-decor-rotation-multiaxis: ${e.partName}${pe} drawn rotation varies across the enabled combos and does not factor as a function of ONE enum axis (${[...new Set(rowsForFactoring.map((r) => String(rotOf(r.f))))].join(' vs ')}); named refusal`,
        );
        continue;
      }
      // STATE-PLANE residue, NAMED not dropped: whatever the disabled plane
      // paints differently is not carried by the decor part (the contract's
      // `states` slot takes TOKEN REFS and this decor carries literals, so a
      // per-enum-value × per-state product has no spelling). The enabled
      // plane is what the canvas draws; the difference is printed.
      for (const r of drawnRows.map((rr, k) => ({ ...rr, f: folded[k] }))) {
        if (isEnabledCombo(r.combo)) continue;
        const twin = rowsForFactoring.find((x) =>
          enumAxes.every((ax) => x.combo.axisValues[ax.prop] === r.combo.axisValues[ax.prop]),
        );
        if (!twin) continue;
        if (JSON.stringify(paintOf(twin.f)) !== JSON.stringify(paintOf(r.f))) {
          refusals.push(
            `pseudo-decor-state-paint-uncarried: ${e.partName}${pe} at ${r.combo.key} paints ${JSON.stringify(paintOf(r.f))} where the matching enabled combo paints ${JSON.stringify(paintOf(twin.f))} — the decor carries the ENABLED plane; a per-enum-value × per-state paint product has no contract spelling (states take token refs, decor paint is literal); named residue`,
          );
        }
        if (
          JSON.stringify(offsetOf(twin.f)) !== JSON.stringify(offsetOf(r.f)) ||
          JSON.stringify(sizeOf(twin.f)) !== JSON.stringify(sizeOf(r.f))
        ) {
          refusals.push(
            `pseudo-decor-state-geometry-uncarried: ${e.partName}${pe} at ${r.combo.key} sits at ${JSON.stringify({ ...sizeOf(r.f), ...offsetOf(r.f) })} vs the enabled ${JSON.stringify({ ...sizeOf(twin.f), ...offsetOf(twin.f) })}; named residue`,
          );
        }
      }
      const f = rowsForFactoring[0].f;
      const baseValueOf = (prop: string): string => {
        const ax = space.axes.find((a) => a.prop === prop)!;
        const decl = contract.props.find((p) => p.name === prop)?.default;
        return decl !== undefined ? String(decl) : (ax.values.find((v) => v !== ax.unset) ?? ax.values[0]);
      };
      let baseSize = sizeOf(f);
      if (sizeFact.kind === 'axis') {
        baseSize = sizeFact.map.get(baseValueOf(sizeFact.prop)) ?? [...sizeFact.map.values()][0];
      }
      // presence over the enabled domain: drawn combos only
      const fact = factorPresence(
        drawnRows.map((r) => r.combo),
        domain,
        space.axes,
        presenceProps,
        stateProps,
        `${e.partName}${pe}`,
        new Set(contract.props.map((p) => p.name)),
      );
      // @door anatomy.pseudo-presence-fences
      if (!fact) {
        refusals.push(`pseudo-decor-presence-uncorrelated: ${e.partName}${pe} drawn in ${drawnRows.length}/${domain.length} default-interaction combos and the drawn set does not factor per-axis — decor NOT promoted (named refusal)`);
        continue;
      }
      if (fact.shownWhen.length > 0) {
        refusals.push(`pseudo-decor-unset-axis-gate: ${e.partName}${pe} is gated by a defaultless axis (base-hidden spelling) — outside the bounded v1 decor grammar; named refusal`);
        continue;
      }
      // placement rides stylesWhen (the v9 shape grammar) — it needs enum
      // conditions to hang on; the shown values of the constraining enum
      // axis provide them. Drawn-everywhere boxes have no condition slot.
      const placementConds: Array<{ prop: string; equals: string }> = [];
      const hiddenEnum = fact.hiddenWhen.filter((hw) => hw.equals !== undefined);
      if (hiddenEnum.length > 0) {
        const ax = space.axes.find((a) => a.prop === hiddenEnum[0].prop)!;
        const hiddenVals = new Set(hiddenEnum.filter((hw) => hw.prop === ax.prop).map((hw) => hw.equals!));
        for (const v of ax.values) {
          if (v === ax.unset || hiddenVals.has(v)) continue;
          placementConds.push({ prop: ax.prop, equals: v });
        }
      }
      const partName = `${e.partName}-${pe.slice(2)}`;
      const kind: 'ellipse' | 'rect' = f.radius >= Math.min(baseSize.w, baseSize.h) / 2 - 0.5 ? 'ellipse' : 'rect';
      /** Paint channels as contract literals. */
      const paintLits = (p: ReturnType<typeof paintOf>): Record<string, string> => {
        const out: Record<string, string> = {
          'background-color': alphaOf(p.bg) === 0 ? 'transparent' : p.bg,
        };
        // Always write every side's width (incl. 0px) so per-value paint maps
        // OVERRIDE base literals — Carbon indeterminate must clear the
        // checked left border or the minus reads as an L (Wave B.2 residual).
        for (const s of BORDER_SIDES) {
          out[`border-${s}-width`] = `${p.borderW[s]}px`;
        }
        if (p.borderColor) {
          for (const s of BORDER_SIDES) {
            if (p.borderW[s] > 0) out[`border-${s}-color`] = p.borderColor;
          }
        }
        // A rect keeps its corner radius; an ellipse IS the radius.
        if (kind === 'rect' && p.radius > 0) out['border-radius'] = `${p.radius}px`;
        return out;
      };
      const geomLits = (g: ReturnType<typeof offsetOf>): Record<string, string> => ({ top: `${g.top}px`, left: `${g.left}px` });
      const sizeLits = (s: ReturnType<typeof sizeOf>): Record<string, string> => ({ width: `${s.w}px`, height: `${s.h}px` });
      const mergeByProp = (
        byProp: Array<{ prop: string; map: Record<string, Record<string, string>> }>,
        prop: string,
        map: Record<string, Record<string, string>>,
      ) => {
        const entry = byProp.find((b) => b.prop === prop);
        if (entry) for (const [v, m] of Object.entries(map)) entry.map[v] = { ...entry.map[v], ...m };
        else byProp.push({ prop, map });
      };
      const sizeReceipt = sizeFact.kind === 'axis' ? `size per ${sizeFact.prop}` : 'size uniform';
      const rotReceipt = rotFact.kind === 'axis' ? `rotation per ${rotFact.prop}` : (Math.abs(rotOf(f)) > 0.5 ? `rotation ${rotOf(f)}deg` : 'rotation 0');
      let baseRot = rotOf(f);
      if (rotFact.kind === 'axis') {
        baseRot = rotFact.map.get(baseValueOf(rotFact.prop)) ?? [...rotFact.map.values()][0];
      }
      if (placementConds.length > 0) {
        // ENUM-GATED decor (Polaris's RadioButton dot; Carbon checkbox ✓/minus):
        // placement rides `stylesWhen` on the gating axis's shown values.
        // Wave B.1/B.2: per-value size/paint/geom/rotation join literalsByProp
        // + per-value placement styles (top/left/rotate).
        const byProp: Array<{ prop: string; map: Record<string, Record<string, string>> }> = [];
        if (sizeFact.kind === 'axis') {
          mergeByProp(byProp, sizeFact.prop, Object.fromEntries([...sizeFact.map].map(([v, s]) => [v, sizeLits(s)])));
        }
        if (paintFact.kind === 'axis') {
          mergeByProp(byProp, paintFact.prop, Object.fromEntries([...paintFact.map].map(([v, p]) => [v, paintLits(p)])));
        }
        if (geomFact.kind === 'axis') {
          mergeByProp(byProp, geomFact.prop, Object.fromEntries([...geomFact.map].map(([v, g]) => [v, geomLits(g)])));
        }
        let basePaintGated = paintOf(f);
        let baseGeomGated = offsetOf(f);
        if (paintFact.kind === 'axis') {
          basePaintGated = paintFact.map.get(baseValueOf(paintFact.prop)) ?? [...paintFact.map.values()][0];
        }
        if (geomFact.kind === 'axis') {
          baseGeomGated = geomFact.map.get(baseValueOf(geomFact.prop)) ?? [...geomFact.map.values()][0];
        }
        const rowFor = (prop: string, equals: string) =>
          rowsForFactoring.find((r) => r.combo.axisValues[prop] === equals);
        const decor: Part = {
          // When rotation factors by axis, keep it OFF the base shape — each
          // placement stylesWhen carries rotate(<n>deg) (incl. 0) so emit does
          // not leak the default-variant angle into indeterminate (Wave B.2).
          shape: {
            kind,
            width: baseSize.w,
            height: baseSize.h,
            ...(rotFact.kind === 'uniform' && Math.abs(baseRot) > 0.5 ? { rotation: baseRot } : {}),
          },
          literals: {
            ...paintLits(basePaintGated),
            ...(sizeFact.kind === 'axis' ? sizeLits(baseSize) : {}),
          },
          ...(byProp.length > 0 ? { literalsByProp: byProp } : {}),
          ...(fact.visibleWhen ? { visibleWhen: { prop: fact.visibleWhen.prop } } : {}),
          stylesWhen: [
            ...fact.hiddenWhen.map((hw) => ({ prop: hw.prop, ...(hw.equals !== undefined ? { equals: hw.equals } : {}), styles: { display: 'none' } })),
            ...placementConds.map((pc) => {
              const row = rowFor(pc.prop, pc.equals);
              const g = row ? offsetOf(row.f) : baseGeomGated;
              const rot = row ? rotOf(row.f) : baseRot;
              return {
                prop: pc.prop,
                equals: pc.equals,
                styles: {
                  position: 'absolute',
                  top: `${g.top}px`,
                  left: `${g.left}px`,
                  ...(rotFact.kind === 'axis' || Math.abs(rot) > 0.5
                    ? { transform: `rotate(${rot}deg)` }
                    : {}),
                },
              };
            }),
          ],
          description: `Drawn ${pe} pseudo-element decor promoted from the computed floor (round 5c S5 + Wave B.2 rotate): a ${baseSize.w}×${baseSize.h} ${kind} at ${baseGeomGated.left},${baseGeomGated.top} inside ${e.partName}, fill ${basePaintGated.bg} — background+box+radius; translate folded; ${rotReceipt} (receipted).`,
        };
        receipts.push(
          `pseudo-decor-carried: ${e.partName}${pe} → shape part "${partName}" (${kind} ${baseSize.w}×${baseSize.h} at ${baseGeomGated.left},${baseGeomGated.top}, fill ${basePaintGated.bg}; drawn in ${drawnRows.length}/${domain.length} default-interaction combos${fact.hiddenWhen.length ? `, hidden-when ${fact.hiddenWhen.map((hw) => (hw.equals ? `${hw.prop}=${hw.equals}` : hw.prop)).join(', ')}` : ''}; ${sizeReceipt}; ${rotReceipt}; translate${hostIsShapeLeaf ? ' + host border' : ''} folded into top/left${hostIsShapeLeaf ? '; BUBBLED to the host parent (shape leaves cannot nest children; parent content box == host border box, asserted)' : ''} — round 5c S5 + Wave B.2)`,
        );
        out.push([partName, decor]);
        continue;
      }
      // PSEUDO-DECOR v2 (D2) — UNCONDITIONAL ABSOLUTE DECOR. v1 refused
      // outright here ("stylesWhen placement has no condition to ride"), and
      // that refusal is precisely what left Carbon's checkbox with no box and
      // its toggle with no knob: both are drawn in EVERY combo, so neither
      // has a gate to hang a condition on. A decor drawn everywhere does not
      // need one — it declares `position: absolute` and carries its offsets
      // as ordinary literals, the same lowering every other absolute part in
      // the repo uses (absolutePartPlacement). Per-value geometry/paint/size
      // ride `literalsByProp`, one ordered entry per driving axis.
      const byProp: Array<{ prop: string; map: Record<string, Record<string, string>> }> = [];
      let baseGeom = offsetOf(f);
      let basePaint = paintOf(f);
      if (geomFact.kind === 'axis') {
        const base = geomFact.map.get(baseValueOf(geomFact.prop)) ?? [...geomFact.map.values()][0];
        baseGeom = base;
        mergeByProp(byProp, geomFact.prop, Object.fromEntries([...geomFact.map].map(([v, g]) => [v, geomLits(g)])));
      }
      if (sizeFact.kind === 'axis') {
        mergeByProp(byProp, sizeFact.prop, Object.fromEntries([...sizeFact.map].map(([v, s]) => [v, sizeLits(s)])));
      }
      if (paintFact.kind === 'axis') {
        const base = paintFact.map.get(baseValueOf(paintFact.prop)) ?? [...paintFact.map.values()][0];
        basePaint = base;
        mergeByProp(byProp, paintFact.prop, Object.fromEntries([...paintFact.map].map(([v, p]) => [v, paintLits(p)])));
      }
      const rotStyles: { prop: string; equals: string; styles: Record<string, string> }[] =
        rotFact.kind === 'axis'
          ? [...rotFact.map].map(([v, rot]) => ({
              prop: rotFact.prop,
              equals: v,
              styles: (Math.abs(rot) > 0.5 ? { transform: `rotate(${rot}deg)` } : {}) as Record<string, string>,
            })).filter((sw) => Object.keys(sw.styles).length > 0)
          : [];
      const decor: Part = {
        shape: {
          kind,
          width: baseSize.w,
          height: baseSize.h,
          ...(Math.abs(baseRot) > 0.5 ? { rotation: baseRot } : {}),
        },
        declared: { position: 'absolute' },
        literals: {
          ...paintLits(basePaint),
          ...geomLits(baseGeom),
          ...(sizeFact.kind === 'axis' ? sizeLits(baseSize) : {}),
        },
        ...(byProp.length > 0 ? { literalsByProp: byProp } : {}),
        ...(fact.visibleWhen ? { visibleWhen: { prop: fact.visibleWhen.prop } } : {}),
        ...((fact.hiddenWhen.length > 0 || rotStyles.length > 0)
          ? {
              stylesWhen: [
                ...fact.hiddenWhen.map((hw) => ({ prop: hw.prop, ...(hw.equals !== undefined ? { equals: hw.equals } : {}), styles: { display: 'none' } })),
                ...rotStyles,
              ],
            }
          : {}),
        description: `Drawn ${pe} pseudo-element decor promoted from the computed floor (pseudo-decor v2, Carbon live-defect round + Wave B.2): an UNCONDITIONAL ${baseSize.w}×${baseSize.h} ${kind} at ${baseGeom.left},${baseGeom.top} inside ${e.partName} — position:absolute with literal offsets${byProp.length ? `, per-value ${byProp.map((b) => b.prop).join(' + ')} overrides` : ''}; ${rotReceipt}; background+border+box+radius only, no content text; translate folded into top/left (receipted).`,
      };
      receipts.push(
        `pseudo-decor-carried: ${e.partName}${pe} → UNCONDITIONAL shape part "${partName}" (${kind} ${baseSize.w}×${baseSize.h} at ${baseGeom.left},${baseGeom.top}, fill ${basePaint.bg}${basePaint.borderColor ? `, ${Math.max(...Object.values(basePaint.borderW))}px ring ${basePaint.borderColor}` : ''}; drawn in ${drawnRows.length}/${domain.length} default-interaction combos; geometry ${geomFact.kind === 'axis' ? `per ${geomFact.prop}` : 'uniform'}, ${sizeReceipt}, paint ${paintFact.kind === 'axis' ? `per ${paintFact.prop}` : 'uniform'}, ${rotReceipt}${hostIsShapeLeaf ? '; BUBBLED to the host parent' : ''} — pseudo-decor v2)`,
      );
      out.push([partName, decor]);
    }
    return out;
  };

  /** Build a Part for a union entry (recursing into children). Returns null
   *  when the entry (and subtree) refuses promotion. */
  const buildPart = (e: UnionNode): Part | null => {
    const i = idxOf.get(e.id)!;
    if (consumed.has(i) && !svgPlans.has(i)) return null; // svg internals
    // CARBON LIVE-DEFECT ROUND (D1) — a non-painting SVG metadata element is
    // never a part. The capture drops these now; this is the promotion-side
    // backstop so a stale committed capture can never put an accessible
    // title on the canvas as visible ink.
    // @door anatomy.svg-metadata-not-a-part
    if (SVG_NONPAINTING.has(e.rep.tag)) {
      refusals.push(`svg-metadata-not-a-part: ${e.partName} <${e.rep.tag}> is non-painting SVG metadata (SVG 1.1 §5.4) — never promoted; its accessible text is not canvas ink`);
      return null;
    }
    const existing = staticByName.get(e.partName);
    const part: Part = existing ? structuredClone(existing) : {};
    if (existing) delete part.parts; // children re-derived from the captured tree
    // Round 5c — SHAPE GEOMETRY RECARRIED: a reviewed static shape (curated
    // decor geometry, round 2) whose numbers contradict the captured
    // computed box retires its numbers — geometry channels are excluded from
    // fusion (environment-dependent in general), but a decor box UNIFORM
    // across every enabled combo is measured truth the curation got wrong
    // (Checkbox/Radio backdrop: curated 20×20 vs the package's 18×18). The
    // curated KIND (rect/ellipse) stays the reviewed call.
    // @door anatomy.shape-geometry-recarry
    if (part.shape && (part.shape.kind === 'rect' || part.shape.kind === 'ellipse')) {
      const px = (v: string | undefined): number | null => {
        const m = /^(-?\d+(?:\.\d+)?)px$/.exec(v ?? '');
        return m ? Number(m[1]) : null;
      };
      const ws = new Set<number>();
      const hs = new Set<number>();
      let readable = true;
      for (const combo of presentBy.get(i) ?? []) {
        const el = union.alignedByKey.get(`${combo.key}__default`)![i];
        if (!el) continue;
        const w = px(el.node.style['width']);
        const h = px(el.node.style['height']);
        if (w === null || h === null || w <= 0 || h <= 0) { readable = false; break; }
        ws.add(Math.round(w * 100) / 100);
        hs.add(Math.round(h * 100) / 100);
      }
      if (readable && ws.size === 1 && hs.size === 1) {
        const [w] = ws;
        const [h] = hs;
        if (w !== part.shape.width || h !== part.shape.height) {
          receipts.push(
            `shape-geometry-recarried: ${e.partName} — reviewed shape ${part.shape.width}×${part.shape.height} contradicts the captured computed box ${w}×${h} (uniform across every enabled combo); computed truth wins geometry, the curated numbers retire (round 5c; kind "${part.shape.kind}" stays the reviewed call)`,
          );
          part.shape = { ...part.shape, width: w, height: h };
        }
      }
    }
    if (!existing) {
      // element: captured tag (span/div default conventions preserved)
      const hasText = e.rep.nodes.some((n) => n.t === 'text' && n.v.trim().length > 0);
      // @door anatomy.element-tag-omission
      if (e.rep.tag !== 'div' && !(hasText && e.rep.tag === 'span')) part.element = e.rep.tag;
      // text/content binding
      if (hasText) {
        const txt = textOf(e.rep);
        let boundProp = [...samplesByProp.entries()].find(([, v]) => v === txt)?.[0];
        // MUI round (Card live finding #2): a promoted text-holder whose text
        // IS the children sample binds content even when the contract has no
        // text prop yet — the mounted composition (CardContent holding the
        // children) is the proof; mint the children prop like the root flow.
        if (!boundProp && txt === comp.sampleText && comp.sampleText.length > 0) {
          if (!contract.props.some((p) => p.name === 'children')) {
            contract.props.push({
              name: 'children',
              type: 'text',
              default: comp.sampleText,
              description: 'Promoted from the computed floor: the mounted children render as this part\'s text (captured mount proof).',
              bindings: { figma: { kind: 'TEXT', property: 'Content' }, code: { prop: 'children' } },
            } as Contract['props'][number]);
            samplesByProp.set('children', comp.sampleText);
          }
          boundProp = 'children';
          receipts.push(`child-content-carried: ${e.partName} holds the children sample text — bound to minted text prop "children" (MUI CardContent class)`);
        }
        if (boundProp) part.content = { prop: boundProp };
        else {
          part.text = txt;
          receipts.push(`literal-text-carried: ${e.partName} = "${txt.slice(0, 40)}" (no text prop sample matches — the mounted value is carried verbatim)`);
        }
      }
      part.description = `Promoted from the computed floor (round 4): rendered anatomy ${e.sig} — this element exists in the real component's DOM; the static layer had no part for it.`;
    }

    // ═══ CONFORMANCE FRONTIER (R2) — THE GENERAL NON-PAINTING INVARIANT ═══
    //
    //  The SVG `<title>` defect (Carbon D1) was patched with a hardcoded TAG
    //  ALLOWLIST — `title`/`desc`/`metadata` — so the INVARIANT behind it was
    //  never written down and its general form kept shipping: an element that
    //  renders NO INK was promoted as ordinary, VISIBLE anatomy, text and all.
    //  Measured on the fixture: a `visibility: hidden` span carrying a sentinel
    //  string was promoted with `declared.display: "block"` and
    //  that literal text, so the contract asserted a visible block containing
    //  words the browser paints nowhere. Its `display: none` twin is SAFE for
    //  one reason only — promotion carries `declared.display: none` alongside
    //  the text, i.e. it CARRIES THE FACT THAT HIDES IT.
    //
    //  So that is the invariant, stated once and applied generally: a part
    //  that paints no ink must either CARRY THE FACT THAT HIDES IT, or be
    //  REFUSED BY NAME. It is never promoted as visible anatomy.
    //
    //  BOUNDED, and the bound is part of the rule:
    //   · `visibility: hidden|collapse` and `content-visibility: hidden`
    //     REFUSE — neither has a carried spelling, and both keep a full-size
    //     box the canvas would draw with its text.
    //   · a ZERO-SIZE box with clipped overflow REFUSES — nothing inside it
    //     can reach a pixel.
    //   · `display: none` does NOT refuse: promotion already carries
    //     `declared.display: none` (the twin above), which IS the fact that
    //     hides it — and per-axis presence factoring depends on those hidden
    //     parts surviving so a set value can restore them.
    //   · `opacity: 0` does NOT refuse: `opacity` is a registered TOKEN
    //     channel (TOKEN_CHANNELS, drawn as node opacity), so a part at zero
    //     opacity carries the fact that hides it on both surfaces.
    //   · sr-only does NOT refuse: it is handled immediately below, and it
    //     carries `declared.display: none` for exactly this reason.
    //
    //  An element is only refused when it paints nowhere in EVERY combo it
    //  appears in, AND no descendant paints (a `visibility: visible`
    //  descendant of a hidden ancestor DOES paint — refusing the ancestor
    //  would delete real ink). A part hidden in SOME combos is a state fact
    //  and rides the existing presence machinery untouched.
    // @door anatomy.non-painting-part
    {
      const paintsNowhere = (el: FlatEl | null | undefined): string | null => {
        if (!el) return null;
        const st = el.node.style;
        const vis = st['visibility'];
        if (vis === 'hidden' || vis === 'collapse') return `visibility: ${vis}`;
        if (st['content-visibility'] === 'hidden') return 'content-visibility: hidden';
        const zero = (v: string | undefined): boolean => v === '0px' || v === '0';
        const clipped = /^(hidden|clip)$/.test(st['overflow-x'] ?? '') && /^(hidden|clip)$/.test(st['overflow-y'] ?? '');
        if ((zero(st['width']) || zero(st['height'])) && clipped) return `a ${st['width']}×${st['height']} box with overflow ${st['overflow-x']}`;
        return null;
      };
      /** Does anything in this union subtree paint? `visibility` INHERITS, so
       *  a descendant may set `visibility: visible` and become real ink. */
      const subtreePaints = (node: UnionNode, comboKey: string): boolean => {
        const el = union.alignedByKey.get(comboKey)?.[idxOf.get(node.id)!];
        if (el && paintsNowhere(el) === null) return true;
        return node.children.some((k) => subtreePaints(k, comboKey));
      };
      const combos = presentBy.get(i) ?? [];
      const causes = new Set<string>();
      let everPaints = false;
      for (const combo of combos) {
        const key = `${combo.key}__default`;
        const el = union.alignedByKey.get(key)?.[i];
        if (!el) continue;
        const cause = paintsNowhere(el);
        if (cause === null || subtreePaints(e, key)) { everPaints = true; break; }
        causes.add(cause);
      }
      if (!everPaints && causes.size > 0 && !isSrOnlyStyle(e.rep.style)) {
        const text = e.rep.nodes.filter((n) => n.t === 'text' && n.v.trim()).map((n) => (n as { v: string }).v.trim()).join(' ');
        refusals.push(
          `non-painting-part: ${e.partName} <${e.rep.tag}> renders NO INK in any combo it appears in (${[...causes].sort().join('; ')}) and no descendant paints${text ? `, yet it carries the text "${text.slice(0, 60)}"` : ''} — NOT promoted. A part that paints nowhere must carry the fact that hides it (declared display:none / an opacity token) or be refused by name; neither \`visibility\` nor \`content-visibility\` has a carried spelling, so promoting this box would put a VISIBLE frame${text ? ' with visible text' : ''} on the canvas that the browser draws nowhere (the general form of the SVG <title> defect)`,
        );
        return null;
      }
    }

    // Visually-hidden (sr-only) fact: the real component clips these parts
    // out of the visual (clip-path inset(50%) / 1px clip box). The promoted
    // part carries declared display:none — visually identical; the a11y
    // surface of the GENERATED component is contract-owned (semantics/role),
    // NAMED as a downgrade receipt.
    // @door anatomy.sr-only-as-display-none
    const srOnly = isSrOnlyStyle(e.rep.style);
    if (srOnly) {
      part.declared = { ...part.declared, display: 'none' };
      receipts.push(`sr-only-carried-as-hidden: ${e.partName} is visually hidden in the real component (clip-path/1px box) — promoted with declared display:none (visual parity exact; AT semantics ride the contract's own semantics — NAMED downgrade)`);
      return part; // no children/facts needed beyond the hidden box
    }

    // Absolute-position fact: a promoted part whose computed position is
    // uniformly absolute is an overlay (Thumbnail's img fills its card) —
    // carried via the declared registry (round 4 grammar); its inset
    // channels mint like any other px channel.
    // @door anatomy.absolute-position-uniform
    {
      const positions = new Set<string>();
      for (const combo of presentBy.get(i) ?? []) {
        const el = union.alignedByKey.get(`${combo.key}__default`)![i];
        if (el) positions.add(el.node.style['position']);
      }
      if (positions.size === 1 && [...positions][0] === 'absolute') {
        part.declared = { ...part.declared, position: 'absolute' };
      }
    }

    // img parts: the capture reads no attributes — src/alt are wired by
    // prop-name heuristic (source/src → src, alt/accessibilityLabel → alt),
    // receipted; without a src the promoted img is an empty broken box.
    if (e.rep.tag === 'img') {
      const findProp = (...names: string[]) => contract.props.find((pr) => pr.type === 'text' && names.includes(pr.name))?.name;
      const srcProp = findProp('source', 'src');
      const altProp = findProp('alt', 'accessibilityLabel');
      const attrs: Record<string, string> = {};
      if (srcProp) attrs['src'] = `{${srcProp}}`;
      if (altProp) attrs['alt'] = `{${altProp}}`;
      if (Object.keys(attrs).length > 0) {
        part.attrs = { ...attrs, ...part.attrs };
        receipts.push(`img-attrs-wired: ${e.partName} src/alt bound by prop-name heuristic (${Object.entries(attrs).map(([a, v]) => `${a}=${v}`).join(', ')}) — the capture reads no attributes (named)`);
      }
    }

    // A2: set when the uniform computed display is `grid` — resolved AFTER
    // the children are built (placements are child facts), either into the
    // structured grid promotion or the named fallback lowering.
    let gridPromotionPending = false;
    // Display fact: every promoted part carries its computed display
    // EXPLICITLY — the emitters default structural parts to flex, but the
    // real tree mixes block/inline containers, and a wrong container display
    // cascades (flex-item blockification turned Banner's body span into a
    // block and let a block Box render as a flex row). flex/inline-flex ride
    // Part.layout (the schema's own vocabulary; enrichLayout adds
    // direction/align/justify); other uniform keywords ride Part.declared.
    // @door anatomy.display-vocabulary-gate
    {
      const displays = new Set<string>();
      for (const combo of presentBy.get(i) ?? []) {
        const el = union.alignedByKey.get(`${combo.key}__default`)![i];
        if (el) displays.add(el.node.style['display']);
      }
      if (displays.size === 1) {
        const d = [...displays][0];
        if (d === 'flex' || d === 'inline-flex') {
          part.layout = { display: d as 'flex' | 'inline-flex', ...part.layout };
        } else if (/^(inline|inline-block|block|contents|none)$/.test(d)) {
          part.declared = { display: d, ...part.declared };
        } else if (d === 'list-item' || d === 'flow-root') {
          // CARBON LIVE-DEFECT ROUND (D3): `list-item` is a BLOCK-LEVEL box
          // with a marker — CSS block flow, exactly like `block`. It was
          // falling into the outside-vocabulary receipt, so Carbon's
          // `<li class="cds--accordion__item">` carried no display at all and
          // the emitter's HORIZONTAL default put the 472px panel beside the
          // 174px heading inside a 328px item. `flow-root` rides the same
          // rule (block box, own BFC).
          part.declared = { display: d, ...part.declared };
          receipts.push(`block-level-display-carried: ${e.partName} = "${d}" — a block-level box in CSS block flow; carried in the declared registry so the canvas lowers it as a stack rather than the emitter's row default`);
        } else if (d === 'grid' || d === 'inline-grid') {
          // A2: display:grid DEFERS to the structured grid promotion, which
          // needs the children built first (placements are child facts) —
          // see the post-children block below. inline-grid stays on the
          // lowering path (the pinned grammar's display vocabulary is
          // flex | inline-flex | grid, G1).
          if (d === 'grid') {
            gridPromotionPending = true;
          } else {
            refuseGridChildGrow(e); // inline-grid children are grid items too (P4)
            const low = lowerGridDisplay(d, e.rep.style, e.rep.gdecl);
            if (low && 'refusal' in low) {
              refusals.push(`${low.refusal} (part ${e.partName})`);
            } else if (low) {
              part.layout = { ...low.layout, ...part.layout };
              receipts.push(`grid-lowering: ${e.partName} ${low.note}`);
            }
          }
        } else if (TABLE_DISPLAYS.has(d)) {
          // ORGANISM round: the CSS table box model lowered to the flex
          // vocabulary (see lowerTableDisplay). Receipted per part — the
          // canvas draws real rows/columns instead of the emitter's default
          // HORIZONTAL/CENTER/CENTER guess.
          const low = lowerTableDisplay(d, e.rep.style)!;
          part.layout = { ...low.layout, ...part.layout };
          // …and so is the ELEMENT. A promoted <tr>/<thead> outside a <table>
          // is DELETED by the HTML parser and a bare <th>/<td> ignores its
          // flex layout — the lowering must be complete or it is a silent
          // structural loss (caught by the fidelity gate: the first Table
          // capture scored 33.5% because the emitted rows were parsed away).
          // The semantics are NOT dropped: each lowered part carries the
          // matching ARIA role, which is what the table box model means.
          const role = tableRoleFor(d, e.rep.tag);
          part.element = 'div';
          if (role) part.attrs = { role, ...part.attrs };
          receipts.push(`table-lowering: ${e.partName} ${low.note}; element <${e.rep.tag}> → <div>${role ? ` role="${role}"` : ''} (a table element outside a <table> is dropped by the HTML parser — the lowering carries the semantics as ARIA)`);
        } else {
          receipts.push(`display-outside-vocabulary: ${e.partName} = "${d}" — carried by neither layout nor the declared registry (named residue)`);
        }
      } else if (displays.size > 1) {
        receipts.push(`display-varies: ${e.partName} = {${[...displays].sort().join(', ')}} across combos — no per-axis display spelling (named residue)`);
      }
    }

    // Aspect fact (geometry evidence): computed width == height in EVERY
    // enabled combo (>0, ≥2 distinct sizes or a sized axis) — the real
    // component keeps the square via pseudo-element padding hacks (Avatar's
    // ::after) that anatomy cannot carry; the RATIO is the carried fact.
    // @door anatomy.aspect-square-mint
    {
      const px = (v: string | undefined): number | null => {
        const m = /^(-?\d+(?:\.\d+)?)px$/.exec(v ?? '');
        return m ? Number(m[1]) : null;
      };
      let square = false;
      const sizes = new Set<number>();
      for (const combo of presentBy.get(i) ?? []) {
        const el = union.alignedByKey.get(`${combo.key}__default`)![i];
        if (!el) { square = false; break; }
        const w = px(el.node.style['width']);
        const h = px(el.node.style['height']);
        if (w === null || h === null || w <= 0 || Math.abs(w - h) > 0.6) { square = false; break; }
        sizes.add(Math.round(w));
        square = true;
      }
      // require ≥2 observed sizes: a single square observation could be
      // coincidence; a size axis driving both dimensions is the evidence.
      if (square && sizes.size >= 2) {
        part.declared = { ...part.declared, 'aspect-ratio': '1 / 1' };
        receipts.push(`aspect-carried: ${e.partName} computed width == height in every enabled combo (${[...sizes].sort((a, b) => a - b).join('/')}px) → declared aspect-ratio 1 / 1 (geometry evidence; the real square rides a pseudo-element padding hack)`);
      }
    }

    // Full-width fact (geometry evidence): a part inside a ROW flex parent
    // whose computed width equals the parent's content width in EVERY
    // enabled combo spans the row — carried as layout.grow (flex: 1 1 auto),
    // the schema's own spelling. Without it, promoted containers hug and
    // justify: space-between has no room to justify (the Banner dismiss ×
    // rendered next to the title instead of at the ribbon's right edge).
    // @door anatomy.full-width-grow-mint
    if (e.parent) {
      const pi = idxOf.get(e.parent.id)!;
      const px = (v: string | undefined): number | null => {
        const m = /^(-?\d+(?:\.\d+)?)px$/.exec(v ?? '');
        return m ? Number(m[1]) : null;
      };
      let fullWidth = false;
      for (const combo of presentBy.get(i) ?? []) {
        const els = union.alignedByKey.get(`${combo.key}__default`)!;
        const self = els[i];
        const parent = els[pi];
        if (!self || !parent) { fullWidth = false; break; }
        const ps = parent.node.style;
        if (ps['display'] !== 'flex' && ps['display'] !== 'inline-flex') { fullWidth = false; break; }
        const dir = ps['flex-direction'] ?? 'row';
        if (dir !== 'row') { fullWidth = false; break; }
        const w = px(self.node.style['width']);
        const pw = px(ps['width']);
        const padL = px(ps['padding-left']) ?? 0;
        const padR = px(ps['padding-right']) ?? 0;
        if (w === null || pw === null) { fullWidth = false; break; }
        if (Math.abs(w - (pw - padL - padR)) > 0.6) { fullWidth = false; break; }
        fullWidth = true;
      }
      if (fullWidth) {
        part.layout = { ...part.layout, grow: true };
        receipts.push(`full-width-carried: ${e.partName} spans its row parent's content width in every enabled combo → layout.grow (geometry evidence)`);
      }
    }

    // presence facts
    const present = presentBy.get(i) ?? [];
    if (present.length < enabled.length) {
      const contractPropNames = new Set(contract.props.map((p) => p.name));
      const fact = factorPresence(present, enabled, space.axes, presenceProps, stateProps, e.partName, contractPropNames);
      // @door anatomy.presence-complement-cascade
      if (!fact) {
        // Round 5c: complement-of-product fallback — a default subtree an
        // alternative replaces (Tag's label under `linked`) is spellable as
        // an ordered hide→restore stylesWhen cascade, verified per combo.
        const comp5c = factorComplement(
          presentAllBy.get(i) ?? new Set(),
          allDefaultCombos,
          space.axes,
          presenceProps,
          stateProps,
          e.partName,
          contractPropNames,
        );
        if (comp5c) {
          const restore =
            part.layout?.display ??
            (part.declared?.['display'] && part.declared['display'] !== 'none' ? part.declared['display'] : undefined) ??
            (e.children.length > 0 ? 'flex' : 'inline');
          part.stylesWhen = [
            ...(part.stylesWhen ?? []),
            ...comp5c.hide.map((h) => ({ prop: h.prop, ...(h.equals !== undefined ? { equals: h.equals } : {}), styles: { display: 'none' } })),
            ...comp5c.restore.map((r) => ({ prop: r.prop, ...(r.equals !== undefined ? { equals: r.equals } : {}), styles: { display: String(restore) } })),
          ];
          receipts.push(...comp5c.receipts);
        } else {
          refusals.push(`part-presence-uncorrelated: ${e.partName} present in ${present.length}/${enabled.length} enabled combos and the presence set does not factor per-axis (nor does its ABSENCE — the round-5c complement spelling was tried) — part NOT promoted (named refusal; a phantom always-drawn part would be worse)`);
          return null;
        }
      } else {
        if (fact.visibleWhen) part.visibleWhen = { prop: fact.visibleWhen.prop };
        if (fact.shownWhen.length > 0) {
          // Round 5f: this part is ABSENT at unset and appears per SET value —
          // its gating axis is a defaultless STRUCTURE-creating enum. Record
          // it so the unset value materializes into the enum as the default
          // (the plain, adornment-absent variant).
          for (const sw of fact.shownWhen) structureGatingUnsetAxes.add(sw.prop);
          // base-hidden: declared display none; each SET value restores the
          // part's own uniform display (captured; flex default for containers)
          const restore =
            part.layout?.display ??
            (part.declared?.['display'] && part.declared['display'] !== 'none' ? part.declared['display'] : undefined) ??
            (Object.keys(e.children).length > 0 ? 'flex' : 'inline');
          part.declared = { ...part.declared, display: 'none' };
          part.stylesWhen = [
            ...(part.stylesWhen ?? []),
            ...fact.shownWhen.map((sw) => ({ prop: sw.prop, equals: sw.equals, styles: { display: String(restore) } })),
          ];
        }
        if (fact.hiddenWhen.length > 0) {
          part.stylesWhen = [
            ...(part.stylesWhen ?? []),
            ...fact.hiddenWhen.map((hw) => ({ prop: hw.prop, ...(hw.equals !== undefined ? { equals: hw.equals } : {}), styles: { display: 'none' } })),
          ];
        }
        receipts.push(...fact.receipts);
        receipts.push(
          `presence-carried: ${e.partName} (${present.length}/${enabled.length} combos) → ${part.visibleWhen ? `visibleWhen ${part.visibleWhen.prop}` : ''}${fact.shownWhen.length ? ` base-hidden, shown-when ${fact.shownWhen.map((h) => `${h.prop}=${h.equals}`).join(', ')}` : ''}${fact.hiddenWhen.length ? ` hidden-when ${fact.hiddenWhen.map((h) => h.equals ? `${h.prop}=${h.equals}` : h.prop).join(', ')}` : ''}`,
        );
      }
    }

    // svg host → icon part(s)
    const plan = svgPlans.get(i);
    if (plan) {
      applySvgPlan(part, e, plan);
      return part;
    }

    // children
    const childParts: Record<string, Part> = {};
    for (const c of e.children) {
      const cp = buildPart(c);
      if (cp) childParts[c.partName] = cp;
      // Round 5c — S5 bubbling: a shape-leaf child's drawn pseudo decor
      // cannot nest inside it — it joins THIS part's children instead.
      if (cp?.shape) {
        for (const [decorName, decor] of pseudoDecorParts(c, idxOf.get(c.id)!, true, cp)) childParts[decorName] = decor;
      }
    }
    // Round 5c — S5: drawn pseudo-element decor boxes join as child parts.
    if (!part.shape) {
      for (const [decorName, decor] of pseudoDecorParts(e, i, false, part)) childParts[decorName] = decor;
    }
    if (Object.keys(childParts).length > 0) part.parts = childParts;
    // A2 — resolve the deferred display:grid fact now that children exist:
    // structured grid promotion first; on abandonment, the SAME fallback path
    // the display block used to take (flex lowering / G7 named refusal).
    if (gridPromotionPending) {
      refuseGridChildGrow(e); // P4: flex-grow is dead on grid children — promoted or not
      const g = promoteGridLayout(
        e.partName,
        e.rep,
        e.children.map((c) => ({ partName: c.partName, rep: c.rep })),
        childParts,
      );
      receipts.push(...g.receipts);
      if ('abandon' in g) {
        receipts.push(`grid-promotion-fallback: ${e.partName} — ${g.abandon}; the flex-era lowering decides (named)`);
        refuseGridPlacementMint(e, g.abandon);
        const low = lowerGridDisplay('grid', e.rep.style, e.rep.gdecl);
        if (low && 'refusal' in low) {
          refusals.push(`${low.refusal} (part ${e.partName})`);
        } else if (low) {
          part.layout = { ...low.layout, ...part.layout };
          receipts.push(`grid-lowering: ${e.partName} ${low.note}`);
          part.literals = part.literals ?? {};
          receipts.push(...gridDefiniteAxisLiterals(part.layout, e.rep.style, part.literals as Record<string, string>, e.partName));
          if (Object.keys(part.literals).length === 0) delete part.literals;
        }
      } else {
        part.layout = g.layout;
        part.literals = part.literals ?? {};
        receipts.push(...gridDefiniteAxisLiterals(part.layout, e.rep.style, part.literals as Record<string, string>, e.partName));
        if (Object.keys(part.literals).length === 0) delete part.literals;
        for (const [childName, pl] of g.placements) {
          const cp = childParts[childName];
          if (cp) cp.placement = pl;
        }
      }
    }
    // CARBON LIVE-DEFECT ROUND (D6) — INERT OVERLAY WRAPPER.
    //
    // In Carbon an icon button IS a tooltip trigger, so its captured anatomy
    // carries `span.cds--popover` — an absolutely-positioned wrapper whose
    // whole subtree is `display:none` until the tooltip opens. Promoted, it
    // became a 24×24 ABSOLUTE frame sitting over the entire component that
    // draws nothing at all (the live tree's "invisible absolute tooltip
    // part"). This is the census-capture sibling of the portal round's
    // `stripInertPortalChildren`: what paints nothing, contains nothing
    // visible, and says nothing is not anatomy.
    //
    // BOUNDED: the part must paint no box in EVERY captured combo, carry no
    // ink of its own (no text/icon/shape/component/slot), and have at least
    // one child with EVERY child declared `display:none`. A childless
    // paintless frame is LEFT ALONE — it can be a real spacer, and this
    // round has no measurement that says otherwise.
    // @door anatomy.inert-overlay-wrapper
    {
      const kids = Object.values(childParts);
      const inkless = !part.text && !part.icon && !part.shape && !part.component && !part.slot;
      const paintsNothing = (presentBy.get(i) ?? []).every((combo) => {
        const el = union.alignedByKey.get(`${combo.key}__default`)![i];
        if (!el) return true;
        const s = el.node.style;
        const bg = s['background-color'];
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return false;
        if (['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'].some((p) => s[p] !== undefined && s[p] !== '0px')) return false;
        if (s['box-shadow'] && s['box-shadow'] !== 'none') return false;
        if (s['background-image'] && s['background-image'] !== 'none') return false;
        return true;
      });
      if (
        inkless &&
        paintsNothing &&
        part.declared?.['display'] !== 'none' &&
        kids.length > 0 &&
        kids.every((k) => k.declared?.['display'] === 'none')
      ) {
        refusals.push(
          `inert-overlay-wrapper: ${e.partName} draws no box in any captured combo, carries no text/icon/shape of its own, and every one of its ${kids.length} child part(s) is declared display:none — a carried part that draws NOTHING; refused by name (Carbon's tooltip \`popover\` wrapper; census sibling of the portal round's stripInertPortalChildren)`,
        );
        return null;
      }
    }
    return part;
  };

  // root: keep the reviewed root part's facts, replace its children with the
  // captured nesting; unmatched static parts are re-attached afterwards.
  const newRoot = structuredClone(rootPart);
  delete newRoot.parts;
  // A2: set when the root's uniform computed display is `grid` — resolved
  // after rootChildren are built (placements are child facts).
  let rootGridPromotionPending = false;
  // Root display fact: computed truth wins the display channel (the static
  // extraction's layout.display is a source-reading guess; TextField's root
  // is a block in the browser, and a flex guess put the label beside the
  // field) — override is RECEIPTED, never silent.
  // @door anatomy.root-display-override
  {
    const displays = new Set<string>();
    for (const combo of enabled) {
      const el = union.alignedByKey.get(`${combo.key}__default`)?.[0];
      if (el) displays.add(el.node.style['display']);
    }
    if (displays.size === 1) {
      const d = [...displays][0];
      if (d === 'flex' || d === 'inline-flex') {
        if (newRoot.layout?.display !== d) {
          receipts.push(`root-display-carried: ${d}${newRoot.layout?.display ? ` (overrides reviewed "${newRoot.layout.display}" — computed truth wins display, receipted)` : ''}`);
        }
        newRoot.layout = { ...newRoot.layout, display: d };
      } else if (/^(inline|inline-block|block|contents)$/.test(d)) {
        if (newRoot.layout?.display) {
          receipts.push(`root-display-carried: ${d} via declared (overrides reviewed layout.display "${newRoot.layout.display}" — computed truth wins display, receipted)`);
          delete newRoot.layout.display;
          if (Object.keys(newRoot.layout).length === 0) delete newRoot.layout;
        }
        newRoot.declared = { display: d, ...newRoot.declared };
      } else if (d === 'list-item' || d === 'flow-root') {
        // D3, root edition — the same block-level carry as a promoted part.
        newRoot.declared = { display: d, ...newRoot.declared };
        receipts.push(`root-display-carried: ${d} via declared (a block-level box in CSS block flow)`);
      } else if (d === 'grid' || d === 'inline-grid') {
        // A2: display:grid defers to the structured grid promotion, resolved
        // after rootChildren are built (see the post-children block below);
        // inline-grid stays on the lowering path (G1 vocabulary).
        if (d === 'grid') {
          rootGridPromotionPending = true;
        } else {
          refuseGridChildGrow(rootEntry); // inline-grid children are grid items too (P4)
          const low = lowerGridDisplay(d, rootEntry.rep.style, rootEntry.rep.gdecl);
          if (low && 'refusal' in low) refusals.push(`${low.refusal} (root)`);
          else if (low) {
            newRoot.layout = { ...low.layout, ...newRoot.layout };
            receipts.push(`grid-lowering: root ${low.note}`);
          }
        }
      } else if (TABLE_DISPLAYS.has(d)) {
        // ORGANISM round: a display:table ROOT (the Table organism) lowers
        // exactly like a promoted part — the root is the column stack its
        // row groups fill.
        const low = lowerTableDisplay(d, rootEntry.rep.style)!;
        newRoot.layout = { ...low.layout, ...newRoot.layout };
        const rootRole = tableRoleFor(d, rootEntry.rep.tag);
        if (rootRole && contract.semantics.role === undefined) {
          contract.semantics.role = rootRole;
          receipts.push(`table-lowering: root semantics.role minted "${rootRole}" — the root's table box model is lowered to flex, and the reviewed contract declared no role (the meaning must not be lost with the display)`);
        }
        receipts.push(`table-lowering: root ${low.note}${contract.semantics.element !== 'div' ? ` — NOTE reviewed semantics.element is <${contract.semantics.element}>, which the code generator will emit outside any <table>` : ''}`);
      }
    }
  }
  const rootChildren: Record<string, Part> = {};
  for (const c of rootEntry.children) {
    const cp = buildPart(c);
    if (cp) rootChildren[c.partName] = cp;
  }
  // Round 5c — S5 on the root itself (drawn root pseudo decor) + bubbling
  // for the root's own shape-leaf children.
  for (const c of rootEntry.children) {
    if (rootChildren[c.partName]?.shape) {
      for (const [decorName, decor] of pseudoDecorParts(c, idxOf.get(c.id)!, true, rootChildren[c.partName] ?? null)) rootChildren[decorName] = decor;
    }
  }
  for (const [decorName, decor] of pseudoDecorParts(rootEntry, idxOf.get(rootEntry.id)!, false, newRoot)) rootChildren[decorName] = decor;
  if (Object.keys(rootChildren).length > 0) newRoot.parts = rootChildren;
  // A2 — resolve the root's deferred display:grid fact (see buildPart's
  // twin block): structured promotion first, the named fallback on abandon.
  if (rootGridPromotionPending) {
    refuseGridChildGrow(rootEntry); // P4: flex-grow is dead on grid children — promoted or not
    const g = promoteGridLayout(
      'root',
      rootEntry.rep,
      rootEntry.children.map((c) => ({ partName: c.partName, rep: c.rep })),
      rootChildren,
    );
    receipts.push(...g.receipts);
    if ('abandon' in g) {
      receipts.push(`grid-promotion-fallback: root — ${g.abandon}; the flex-era lowering decides (named)`);
      refuseGridPlacementMint(rootEntry, g.abandon);
      const low = lowerGridDisplay('grid', rootEntry.rep.style, rootEntry.rep.gdecl);
      if (low && 'refusal' in low) refusals.push(`${low.refusal} (root)`);
      else if (low) {
        newRoot.layout = { ...low.layout, ...newRoot.layout };
        receipts.push(`grid-lowering: root ${low.note}`);
        newRoot.literals = newRoot.literals ?? {};
        receipts.push(...gridDefiniteAxisLiterals(newRoot.layout, rootEntry.rep.style, newRoot.literals as Record<string, string>, 'root'));
        if (Object.keys(newRoot.literals).length === 0) delete newRoot.literals;
      }
    } else {
      // @door anatomy.root-grid-overrides-reviewed-layout
      if (newRoot.layout && Object.keys(newRoot.layout).length > 0) {
        receipts.push(
          `root-grid-overrides-reviewed-layout: computed truth promotes a structured grid; the reviewed layout (${Object.keys(newRoot.layout).join(', ')}) is replaced — flex-only fields are schema-invalid with display: "grid" (G1), receipted, never silent`,
        );
      }
      newRoot.layout = g.layout;
      newRoot.literals = newRoot.literals ?? {};
      receipts.push(...gridDefiniteAxisLiterals(newRoot.layout, rootEntry.rep.style, newRoot.literals as Record<string, string>, 'root'));
      if (Object.keys(newRoot.literals).length === 0) delete newRoot.literals;
      for (const [childName, pl] of g.placements) {
        const cp = rootChildren[childName];
        if (cp) cp.placement = pl;
      }
    }
  }
  // MUI round (Card live finding): the ROOT itself can hold direct text runs
  // — MUI's Card renders children as a BARE text node (no wrapping element,
  // so no child part exists to carry content, and the text silently vanished
  // from the canvas). Bind root content exactly as buildPart binds promoted
  // text holders; when the mounted text is the children sample and the
  // contract has no text prop, MINT a children-bound one — the captured
  // mount is the proof the surface accepts text children.
  {
    const rootText = textOf(rootEntry.rep);
    const carriesContent = (p: Part): boolean =>
      p.content !== undefined || p.text !== undefined || Object.values(p.parts ?? {}).some(carriesContent);
    if (rootText.length > 0 && !carriesContent(newRoot)) {
      let boundProp = [...samplesByProp.entries()].find(([, v]) => v === rootText)?.[0];
      if (!boundProp && rootText === comp.sampleText && comp.sampleText.length > 0) {
        const propName = 'children';
        if (!contract.props.some((p) => p.name === propName)) {
          contract.props.push({
            name: propName,
            type: 'text',
            default: comp.sampleText,
            description: 'Promoted from the computed floor: the root renders its children as direct text (captured mount proof).',
            bindings: { figma: { kind: 'TEXT', property: 'Content' }, code: { prop: 'children' } },
          } as Contract['props'][number]);
        }
        boundProp = propName;
      }
      if (boundProp) {
        newRoot.content = { prop: boundProp };
        receipts.push(`root-content-carried: the root holds direct text ("${rootText.slice(0, 30)}") with no text-holder child part — bound to text prop "${boundProp}" (MUI Card class)`);
      } else {
        newRoot.text = rootText;
        receipts.push(`root-literal-text-carried: root direct text "${rootText.slice(0, 30)}" matches no prop sample — carried verbatim (named)`);
      }
    }
  }
  // Round 5c — ROOT-HOSTED svg plan: buildPart never runs on the root, so a
  // plan whose host IS the root (Spinner: the glyph is the root's only
  // child) was silently dropped — the assets existed, the contract carried
  // no glyph. Apply it here exactly as buildPart applies it to nested hosts.
  {
    const rootPlan = svgPlans.get(idxOf.get(rootEntry.id)!);
    if (rootPlan) {
      newRoot.parts = rootChildren; // per-value children merge into the same map
      applySvgPlan(newRoot, rootEntry, rootPlan);
      receipts.push(
        `root-svg-plan-carried: ${comp.name} root hosts ${rootPlan.perValue.length === 1 && rootPlan.perValue[0].value === undefined ? `icon asset ${rootPlan.perValue[0].asset}` : `${rootPlan.perValue.length} per-value glyph part(s) (${rootPlan.perValue.map((pv) => pv.asset).join(', ')})`} — round 5c root-hosted svg plan (the round-5a named promotion drop)`,
      );
    }
  }

  // static parts that neither matched nor re-joined: kept OUT (they never
  // rendered in any captured combo — drawing them would be phantom ink), a
  // named receipt each. Their reviewed facts are recoverable from the static
  // contract in git.
  const promotedNames = new Set<string>();
  const collectNames = (p: Part, name: string) => {
    promotedNames.add(name);
    for (const [n, c] of Object.entries(p.parts ?? {})) collectNames(c, n);
  };
  collectNames(newRoot, 'root');
  // @door anatomy.static-part-unrendered
  for (const [name] of staticByName) {
    if (!promotedNames.has(name)) {
      refusals.push(`static-part-unrendered: reviewed static part "${name}" has no rendered counterpart in ANY captured combo — dropped from the promoted anatomy (named; usually a conditional the sweep never triggered)`);
    }
  }

  contract.anatomy = { root: newRoot };
  entries.forEach((e, i) => {
    if (promotedNames.has(e.partName)) partIndex.set(e.partName, i);
  });

  // ORPHAN-ASSET ROUND (task #42): an icon asset whose HOST PART the promotion
  // just refused belongs to nothing. It used to be written to
  // examples/<lib>/assets/icons/ by promote-floor and referenced by no
  // contract — a committed SVG file for a part that does not exist. Dropped
  // here, by NAME, at the same door that decides the part.
  // @door anatomy.orphan-asset-drop
  for (const [name, owner] of [...assetOwner].sort()) {
    if (promotedNames.has(owner) || !assets.has(name)) continue;
    assets.delete(name);
    refusals.push(
      `orphan-asset-dropped: icon asset "${name}" was reconstructed from the svg subtree of part "${owner}", which this promotion then REFUSED (see the named refusal above) — the asset belongs to no part of the promoted contract and is not carried. Before this door it was committed to the library's assets/icons/ directory and referenced by nothing (measured: examples/mui/assets/icons/autocomplete-autocomplete-clearindicator.svg).`,
    );
  }

  // Round 5f — materialize the UNSET pseudo-value of every defaultless
  // structure-gating enum into the contract enum AS THE DEFAULT. Only axes
  // whose gated part actually survived promotion count (a part refused
  // upstream leaves no plain variant to enumerate). This is the ONE place the
  // API surface gains the unset value; downstream (emit variants, gate
  // deriveCells, real-page mount) all read the enum uniformly, and the
  // gate/real-page omit the unset value on mount exactly as the capture's own
  // comboProps does (prop absent === adornment absent).
  const survivingGateProps = new Set<string>();
  const collectGates = (p: Part) => {
    if (p.declared?.['display'] === 'none') {
      for (const sw of p.stylesWhen ?? []) {
        if (sw.equals !== undefined && sw.styles['display'] !== undefined && sw.styles['display'] !== 'none') {
          survivingGateProps.add(sw.prop);
        }
      }
    }
    for (const c of Object.values(p.parts ?? {})) collectGates(c);
  };
  collectGates(newRoot);
  // @door anatomy.optional-adornment-unset-materialize
  for (const axProp of structureGatingUnsetAxes) {
    if (!survivingGateProps.has(axProp)) continue;
    const ax = space.axes.find((a) => a.prop === axProp);
    if (!ax || ax.unset === undefined) continue;
    const prop = contract.props.find((p) => p.name === axProp);
    if (!prop || typeof prop.type !== 'object' || !('enum' in prop.type)) continue;
    if (prop.type.enum.includes(ax.unset) || prop.default !== undefined) continue;
    prop.type.enum = [ax.unset, ...prop.type.enum];
    (prop as { default?: unknown }).default = ax.unset;
    // ANTD EXAM (2026-08-23): the enum grew and the figma VARIANT values map
    // did not — validateContract then refused the WHOLE component ("figma
    // values map is missing enum value unset") and antd's Progress was
    // quarantined with its capture intact. The materialized value needs its
    // display name in the same breath it joins the enum.
    const fb = (prop as { bindings?: { figma?: { kind?: string; values?: Record<string, string> } } }).bindings?.figma;
    if (fb?.kind === 'VARIANT' && fb.values && !(ax.unset in fb.values)) {
      fb.values = { [ax.unset]: ax.unset.charAt(0).toUpperCase() + ax.unset.slice(1), ...fb.values };
    }
    receipts.push(
      `optional-adornment-unset-materialized: ${axProp} — defaultless enum gates a present-only-when-set part; unset value "${ax.unset}" added to the enum as the DEFAULT so a PLAIN (adornment-absent) variant is enumerated and the base-hidden part renders nothing there (round 5f — S2 unset extended from styling to STRUCTURE)`,
    );
  }

  return { contract, assets, consumed, partIndex, receipts, refusals, gridMintRefusals };
}

// ===========================================================================
// DEPTH BUILD — Stage B: multi-root union + promotion.
//
// The census single-root machinery (buildUnion / nameUnion / promoteAnatomy)
// is REUSED per real-root index — nothing in those functions changes. A
// portalCapture component's new roots are descended (descendToRealRoots) to
// the real root set, then each root gets its own union and its own promoted
// Part subtree; the subtrees are assembled into a multi-root
// `anatomy: Record<string, Part>` (already legal in the schema — walkAnatomy
// iterates every top-level entry). For a SINGLE real root the top-level key is
// 'root' and the output is byte-identical to promoteAnatomy alone.
// ===========================================================================

/** Count Part nodes in a promoted subtree (the part-count receipt). */
export function countParts(p: Part): number {
  return 1 + Object.values(p.parts ?? {}).reduce((n, c) => n + countParts(c), 0);
}
/** Tree depth of a promoted subtree (the depth receipt). */
export function treeDepthPart(p: Part): number {
  const kids = Object.values(p.parts ?? {});
  return kids.length === 0 ? 1 : 1 + Math.max(...kids.map(treeDepthPart));
}

export interface MultiRootUnion {
  /** One entry per real root (index-aligned to the base combo's real roots). */
  roots: Array<{ name: string; union: UnionResult; baseRoot: CapturedNode }>;
  receipts: string[];
}

/** Build a per-real-root union set from portal captures. Each combo's new
 *  roots are descended to their real root(s); root index r gets a single-root
 *  union built by the census `buildUnion` (+ `nameUnion`). Combos whose real-
 *  root COUNT differs from the base are excluded with a named receipt (overlay
 *  multi-combo root alignment is Stage C+; the Stage-B receipt is single-combo). */
export function buildMultiRootUnion(
  combos: Array<{ combo: string; interaction: string; newRoots: CapturedNode[] }>,
  baseKey: string,
  componentName: string,
  classPrefix: string,
): MultiRootUnion {
  const perCombo = combos.map((c) => ({
    combo: c.combo,
    interaction: c.interaction,
    real: c.newRoots.flatMap((r) => descendToRealRoots(r, classPrefix)),
  }));
  const base = perCombo.find((c) => `${c.combo}__${c.interaction}` === baseKey);
  if (!base) throw new Error(`multi-root union: base ${baseKey} not among combos`);
  const rootCount = base.real.length;
  const receipts: string[] = [];
  const roots: MultiRootUnion['roots'] = [];
  for (let r = 0; r < rootCount; r++) {
    const perRootCaptures: Capture[] = perCombo
      .filter((c) => c.real.length === rootCount)
      .map((c) => ({ combo: c.combo, interaction: c.interaction, root: c.real[r] }));
    const baseCap = perRootCaptures.find((c) => `${c.combo}__${c.interaction}` === baseKey)!;
    const union = buildUnion(perRootCaptures, baseCap, classPrefix);
    nameUnion(union.entries, componentName, classPrefix);
    roots.push({ name: rootPartName(base.real[r], classPrefix, r, rootCount), union, baseRoot: base.real[r] });
    receipts.push(...union.receipts);
  }
  // @door anatomy.multi-root-count-varies
  for (const c of perCombo) {
    if (c.real.length !== rootCount) {
      receipts.push(
        `multi-root-count-varies: ${c.combo}__${c.interaction} descended to ${c.real.length} real root(s) ≠ base ${rootCount} — combo excluded from the union (named; overlay multi-combo root alignment is Stage C+)`,
      );
    }
  }
  return { roots, receipts: [...new Set(receipts)] };
}

export interface MultiRootPromotion {
  /** Static contract clone with a MULTI-ROOT promoted anatomy. */
  contract: Contract;
  assets: Map<string, string>;
  receipts: string[];
  refusals: string[];
  /** Top-level anatomy keys in order (Modal → ['dialog','backdrop']). */
  rootNames: string[];
  /** Total promoted parts across every root. */
  partCount: number;
  /** Max tree depth across roots. */
  depth: number;
}

/** Promote a multi-root union into one contract whose `anatomy` carries one
 *  top-level Part per real root. Each root reuses the census `promoteAnatomy`
 *  verbatim; the promoted `root` part is re-keyed by its real-root name
 *  (dialog / backdrop). A single real root keys as 'root' → byte-identical to
 *  `promoteAnatomy` alone (the regression-guard invariant). */
export function promoteMultiRootAnatomy(
  space: PropSpace,
  comp: ComponentConfig,
  multi: MultiRootUnion,
  componentKebab: string,
): MultiRootPromotion {
  const anatomy: Record<string, Part> = {};
  const assets = new Map<string, string>();
  const receipts = [...multi.receipts];
  const refusals: string[] = [];
  let contract: Contract | null = null;
  const usedNames = new Map<string, number>();
  for (const { name, union } of multi.roots) {
    const p = promoteAnatomy(space, comp, union, componentKebab);
    if (!contract) contract = p.contract;
    for (const [k, v] of p.assets) assets.set(k, v);
    receipts.push(...p.receipts);
    refusals.push(...p.refusals);
    const n = usedNames.get(name) ?? 0;
    usedNames.set(name, n + 1);
    anatomy[n > 0 ? `${name}-${n + 1}` : name] = p.contract.anatomy['root'];
  }
  contract = contract ?? (structuredClone(space.contract) as Contract);
  contract.anatomy = anatomy;
  const rootNames = Object.keys(anatomy);
  const partCount = Object.values(anatomy).reduce((s, part) => s + countParts(part), 0);
  const depth = rootNames.length ? Math.max(...Object.values(anatomy).map(treeDepthPart)) : 0;
  return { contract, assets, receipts: [...new Set(receipts)], refusals, rootNames, partCount, depth };
}
