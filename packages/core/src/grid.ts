/**
 * A2 grid — the CSS half of the pinned layout grammar (G1–G5). Moved
 * verbatim from the reference repo's core/emit-react.ts; shared by every
 * CSS-producing emitter (React modules, static HTML, inline-styles React,
 * web components). Pure; imports @ds-contracts/schema only.
 */
import {
  walkAnatomy,
  type Contract,
  type GridArea,
  type GridPlacement,
  type GridTrack,
} from '@ds-contracts/schema';
import { placeholdersIn, stripBraces } from './anatomy.js';

// ---------------------------------------------------------------------------
// A2 grid — the CSS half of the pinned layout grammar (G1–G5), SHARED by all
// three CSS surfaces (emit-react modules, emit-html plain CSS, emit-react-
// inline style objects — the inline emitter camelCases these same decls).
// The spellings below are the G6-pinned emit-html row and are CANONICAL: the
// code-side proposer parses them back into the same contract facts, so any
// respelling here breaks the round trip by construction.
// ---------------------------------------------------------------------------

/** G1/P14 — the exact code spelling of each of the THREE track types the
 *  canvas round-trips: px → `Npx`, fr → `Nfr` (fractional carried exactly,
 *  P2b), fit → `fit-content(100%)` (P14: a HUG track's CSS readback,
 *  verbatim). Zero can never reach here — the schema refuses it (P2b's
 *  silent-rewrite hazard). */
export const gridTrackCss = (t: GridTrack): string =>
  'px' in t ? `${t.px}px` : 'fr' in t ? `${t.fr}fr` : 'fit-content(100%)';

/** G2 — contract align vocabulary → CSS self-alignment values. `auto` never
 *  emits (stretch-by-absence is the pinned spelling of fill, G3); `stretch`
 *  and `baseline` cannot reach here — the schema refuses them by name
 *  (grid-align-stretch-keyword / grid-baseline-align). */
export const GRID_SELF_ALIGN: Record<string, string> = {
  start: 'start',
  center: 'center',
  end: 'end',
};

/** G4 — `grid-template-areas` value: the declared rows × columns matrix with
 *  each named rect stamped in and `.` everywhere else. Always expressible:
 *  area rects are rectangles by schema construction and overlap/bounds are
 *  refused contract-side (validateGridPart), so the LOWERED longhand path
 *  the proposal reserves for non-rectangular occupancy can never trigger
 *  from a valid contract. */
export function gridTemplateAreasValue(
  rowCount: number,
  columnCount: number,
  areas: Record<string, GridArea>,
): string {
  const m: string[][] = Array.from({ length: rowCount }, () =>
    Array.from({ length: columnCount }, () => '.'),
  );
  for (const [areaName, a] of Object.entries(areas)) {
    for (let r = a.row; r < a.row + (a.rowSpan ?? 1); r++) {
      for (let c = a.column; c < a.column + (a.columnSpan ?? 1); c++) {
        m[r][c] = areaName;
      }
    }
  }
  return m.map((r) => `"${r.join(' ')}"`).join(' ');
}

/** Grid gap value → CSS text. Numbers are px; token refs go through the
 *  surface's own spelling (var(--…) on the stylesheet surfaces, resolved
 *  literal on the inline surface). A SUBSTITUTED gap ref ({space.{size}})
 *  has no single static spelling on the CSS surfaces — refused BY NAME, the
 *  fence discipline (the canvas surface resolves it per compiled variant;
 *  carrying it here would silently emit a var() no stylesheet defines). */
export function gridGapCss(
  v: number | string,
  tokenRefCss: (refPath: string) => string,
  where: string,
): string {
  if (typeof v === 'number') return `${v}px`;
  const refPath = stripBraces(v);
  if (placeholdersIn(refPath).length > 0) {
    throw new Error(
      `Refused — grid-gap-substituted-ref: ${where} carries a substituted gap ref "${v}" — a per-variant grid gap has no single static CSS spelling; bind a plain token ref (the canvas surface resolves substitution per compiled variant)`,
    );
  }
  return tokenRefCss(refPath);
}

/** G1/G4/G5 — the grid PARENT's declarations, pinned order:
 *  display → grid-template-rows → grid-template-columns →
 *  grid-template-areas → grid-auto-flow → row-gap → column-gap.
 *  Under flow (G5) rows are OMITTED on the CSS surfaces — `grid-auto-flow:
 *  row` + placement-from-order is the pinned spelling; the derived explicit
 *  row list is a CANVAS obligation (P9: the Plugin API under-reports
 *  implicit rows; CSS does not). */
export function gridParentDecls(
  l: {
    rows?: GridTrack[];
    columns?: GridTrack[];
    gap?: { row: number | string; column: number | string };
    areas?: Record<string, GridArea>;
    flow?: 'row';
  },
  tokenRefCss: (refPath: string) => string,
  where: string,
): string[] {
  const d: string[] = ['display: grid'];
  if (l.rows) d.push(`grid-template-rows: ${l.rows.map(gridTrackCss).join(' ')}`);
  d.push(`grid-template-columns: ${(l.columns ?? []).map(gridTrackCss).join(' ')}`);
  if (l.areas && l.rows) {
    d.push(`grid-template-areas: ${gridTemplateAreasValue(l.rows.length, (l.columns ?? []).length, l.areas)}`);
  }
  if (l.flow === 'row') d.push('grid-auto-flow: row');
  if (l.gap) {
    d.push(`row-gap: ${gridGapCss(l.gap.row, tokenRefCss, where)}`);
    d.push(`column-gap: ${gridGapCss(l.gap.column, tokenRefCss, where)}`);
  }
  return d;
}

/** G2 — a placed child's declarations. CSS lines are 1-based (the +1 is an
 *  emitter fact — contracts stay 0-based, the G6 pin); spans of 1 are the
 *  default and stay unspelled (deterministic minimal output, the same rule
 *  the canvas cell spec applies). */
export function gridPlacementDecls(p: GridPlacement): string[] {
  const d: string[] = [
    `grid-row: ${p.row + 1}${p.rowSpan && p.rowSpan > 1 ? ` / span ${p.rowSpan}` : ''}`,
    `grid-column: ${p.column + 1}${p.columnSpan && p.columnSpan > 1 ? ` / span ${p.columnSpan}` : ''}`,
  ];
  if (p.alignX && p.alignX !== 'auto') d.push(`justify-self: ${GRID_SELF_ALIGN[p.alignX]}`);
  if (p.alignY && p.alignY !== 'auto') d.push(`align-self: ${GRID_SELF_ALIGN[p.alignY]}`);
  return d;
}

/** The compiled cell plan for one contract — every grid parent's children
 *  resolved to their CSS placement decls, plus the placeholder elements the
 *  G4 dual-slot convention owes for EMPTY areas (an area with no matching
 *  part renders a placeholder element carrying the slot class and the
 *  area's placement on BOTH surfaces, so the grid's shape is visible with
 *  nothing in it — the canvas twin is emit-figma-script's stampGridCells). */
export interface GridCellPlan {
  /** part name → placement decls (`grid-area: x` for area-anchored parts —
   *  the area name IS the placement anchor, G4 — longhands for explicit
   *  `placement`). Empty under flow: placement fact is child order (G5). */
  cells: Map<string, string[]>;
  /** grid-parent part name → area names with NO matching child part, in
   *  declaration order. Each owes a placeholder element + a
   *  `grid-area: <name>` rule under the parent's part-class namespace. */
  placeholders: Map<string, string[]>;
  /** part names that are COMPONENT-REF children of a grid parent: the
   *  instance cannot carry the host's class, so the emitters wrap it in an
   *  element that IS the grid item (display: grid on the wrapper so the
   *  single instance stretches into the cell — the CSS spelling of the
   *  canvas FILL default, G3/P12). */
  wrappedInstances: Set<string>;
  /** Every in-flow direct child of a grid parent, manual OR auto-flow. A grid
   *  child is the one place the CSS and canvas cross-axis DEFAULTS disagree
   *  visibly (FC-SLOT-CROSS-AXIS-STRETCH) — see gridChildCrossAxisDecls. */
  gridChildren: Set<string>;
}

/** FC-SLOT-CROSS-AXIS-STRETCH. A part with no declared `layout.align` gets
 *  the surface's own default on each side, and the two defaults are not the
 *  same fact: CSS `display:flex` means `align-items: stretch`, while the
 *  canvas frame this emitter builds carries `counterAxisAlignItems: 'MIN'`.
 *  Everywhere else that difference is invisible, because a hugging parent is
 *  exactly as tall as its child. Inside a GRID CELL it is not: the cell gives
 *  the slot a definite box, so CSS stretched a 23px badge to the full 392px
 *  sidebar while the canvas left it 23px at the top — same contract, same
 *  child, two renderings. The contract's own spec says MIN, so CSS is the
 *  side that must spell its default out. Scoped to grid children: no
 *  pre-existing contract declares a grid, so this cannot move a single
 *  committed byte of the 51 lower-order components. */
export const gridChildCrossAxisDecls = (part: { layout?: { align?: string; display?: string } }): string[] =>
  part.layout?.align || part.layout?.display === 'grid' ? [] : ['align-items: flex-start'];

export function gridCellPlan(contract: Contract): GridCellPlan {
  const cells = new Map<string, string[]>();
  const placeholders = new Map<string, string[]>();
  const wrappedInstances = new Set<string>();
  const gridChildren = new Set<string>();
  for (const { part } of walkAnatomy(contract)) {
    // Auto-flow grids place by child ORDER and so carry no cell decls, but
    // their children are still grid children for cross-axis purposes.
    if (part.layout?.display !== 'grid') continue;
    for (const [childName, child] of Object.entries(part.parts ?? {})) {
      if (!child.overlay) gridChildren.add(childName);
    }
  }
  for (const { name, part } of walkAnatomy(contract)) {
    const l = part.layout;
    if (l?.display !== 'grid' || l.flow === 'row') continue;
    const areas = l.areas ?? {};
    const children = Object.entries(part.parts ?? {});
    for (const [childName, child] of children) {
      if (child.overlay) continue; // out-of-flow grammar survives (P13)
      const decls = areas[childName]
        ? [`grid-area: ${childName}`]
        : child.placement
          ? gridPlacementDecls(child.placement)
          : null;
      if (!decls) continue;
      cells.set(childName, decls);
      if (child.component) wrappedInstances.add(childName);
    }
    const childNames = new Set(children.map(([n]) => n));
    const empty = Object.keys(areas).filter((a) => !childNames.has(a));
    if (empty.length > 0) placeholders.set(name, empty);
  }
  return { cells, placeholders, wrappedInstances, gridChildren };
}

