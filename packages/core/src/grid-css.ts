/**
 * GRID CSS inversion — the CODE-SIDE half of the pinned layout grammar
 * (A2; docs/research/layout-grammar-proposal.md G1–G7 against the probe
 * receipts docs/research/grid-recon-probes.md P1–P14).
 *
 * PURE core (no node:* imports): consumed by the CSS-Module anatomy adapter
 * (core/extract-css-module.ts) and any future computed-CSS reader. Every
 * function returns FACTS + RECEIPTS, never throws:
 *
 *   · tracks     — the three carriageable spellings only: `Npx` → {px:n},
 *                  `Nfr` → {fr:n}, `fit-content(100%)` → {fit:true} (P14's
 *                  exact HUG spelling). Fractional values carry exactly
 *                  (P2b). `repeat(N, …)` expands when N is an integer
 *                  literal (a named LOWERED disposition).
 *   · `auto`     — LOWERED to {fit:true}: the canvas track enum has no AUTO
 *                  (P2b refuses it); HUG / fit-content(100%) is the closest
 *                  canvas-expressible content-sized track, and the lowering
 *                  is RECEIPTED by name, never silent.
 *   · refusals   — minmax / auto-fit / auto-fill / percent / subgrid /
 *                  column flow / dense / implicit tracks / negative lines /
 *                  stretch-keyword / baseline each produce the G7 NAMED
 *                  refusal (GRID_REFUSALS registry text, greppable by its
 *                  conformance name). NEVER a silent drop.
 *
 * The emitters' pinned CSS spellings (G6) are the inversion targets: this
 * module inverts exactly what `core/emit-html.ts` emits for a grid contract,
 * so code→contract→code closes on the same bytes.
 */
import { GRID_REFUSALS } from '@ds-contracts/schema';

/** Contract track IR — mirrors GridTrackSchema exactly. */
export type GridTrackIR = { px: number } | { fr: number } | { fit: true };

/** G4 area rect IR — mirrors GridAreaSchema exactly. */
export interface GridAreaIR {
  row: number;
  column: number;
  rowSpan?: number;
  columnSpan?: number;
}

/** Every parse returns facts plus receipts; a refusal empties the fact. */
export interface GridParseReceipts {
  /** G7 named refusals (GRID_REFUSALS text) — the construct is NOT carried. */
  refusals: string[];
  /** Named LOWERED dispositions — the fact IS carried, spelling changed. */
  lowered: string[];
}

const emptyReceipts = (): GridParseReceipts => ({ refusals: [], lowered: [] });

/** Split a CSS value on top-level whitespace (function args stay together). */
function splitTopLevelWs(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (cur) out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur) out.push(cur);
  return out;
}

const PX_RE = /^(-?\d*\.?\d+)px$/;
const FR_RE = /^(-?\d*\.?\d+)fr$/;

/** One track token → IR, or a receipt. Returns null when refused/reported. */
function parseTrackToken(
  token: string,
  receipts: GridParseReceipts,
): GridTrackIR | null {
  const t = token.trim();
  if (t === 'subgrid') {
    receipts.refusals.push(GRID_REFUSALS['grid-subgrid']);
    return null;
  }
  if (t.includes('minmax(')) {
    receipts.refusals.push(GRID_REFUSALS['grid-track-minmax']);
    return null;
  }
  if (/%/.test(t) && !t.startsWith('fit-content')) {
    receipts.refusals.push(GRID_REFUSALS['grid-track-percent']);
    return null;
  }
  let m: RegExpMatchArray | null;
  if ((m = t.match(PX_RE))) {
    const n = Number(m[1]);
    if (n === 0) {
      receipts.refusals.push(GRID_REFUSALS['grid-track-zero']);
      return null;
    }
    if (n < 0) {
      receipts.refusals.push(
        `grid track \`${t}\` — negative track sizes have no canvas spelling (P2b enum: FLEX | FIXED | HUG, values > 0); not extracted`,
      );
      return null;
    }
    return { px: n };
  }
  if ((m = t.match(FR_RE))) {
    const n = Number(m[1]);
    if (n === 0) {
      receipts.refusals.push(GRID_REFUSALS['grid-track-zero']);
      return null;
    }
    if (n < 0) {
      receipts.refusals.push(
        `grid track \`${t}\` — negative track sizes have no canvas spelling (P2b enum: FLEX | FIXED | HUG, values > 0); not extracted`,
      );
      return null;
    }
    return { fr: n };
  }
  if (t === '0') {
    receipts.refusals.push(GRID_REFUSALS['grid-track-zero']);
    return null;
  }
  if (t === 'fit-content(100%)') return { fit: true };
  if (t.startsWith('fit-content(')) {
    receipts.refusals.push(
      `grid track \`${t}\` — only fit-content(100%) is the canvas HUG track's exact code spelling (P14); a clamped fit-content has no canvas spelling, not extracted`,
    );
    return null;
  }
  if (t === 'auto') {
    // The canvas track enum refuses AUTO (P2b); HUG is the content-sized
    // track it does have, and its code spelling is fit-content(100%) (P14).
    receipts.lowered.push(
      "grid track `auto` LOWERED to {fit: true} — the canvas track enum has no AUTO (P2b: \"Expected 'FLEX' | 'FIXED' | 'HUG', received 'AUTO'\"); HUG / fit-content(100%) (P14) is the carried content-sized spelling",
    );
    return { fit: true };
  }
  if (/^(min-content|max-content)$/.test(t)) {
    receipts.refusals.push(
      `grid track \`${t}\` — intrinsic-sizing keywords have no canvas track spelling (P2b enum: FLEX | FIXED | HUG); not extracted`,
    );
    return null;
  }
  receipts.refusals.push(
    `grid track \`${t}\` is not a carriageable track spelling — tracks are Npx | Nfr | fit-content(100%) (P2/P2b: FIXED | FLEX | HUG); not extracted`,
  );
  return null;
}

/**
 * `grid-template-columns` / `grid-template-rows` → GridTrackIR[].
 * `tracks` is null whenever ANY refusal fired — a partially-parsed track
 * list is a different grid, never proposed.
 */
export function parseGridTrackList(value: string): {
  tracks: GridTrackIR[] | null;
  receipts: GridParseReceipts;
} {
  const receipts = emptyReceipts();
  const v = value.trim();
  if (/^repeat\(\s*auto-(fit|fill)\b/.test(v) || /repeat\(\s*auto-(fit|fill)\b/.test(v)) {
    receipts.refusals.push(GRID_REFUSALS['grid-auto-fit-minmax']);
    return { tracks: null, receipts };
  }
  if (v === 'subgrid') {
    receipts.refusals.push(GRID_REFUSALS['grid-subgrid']);
    return { tracks: null, receipts };
  }
  if (v === 'none') {
    return { tracks: null, receipts };
  }
  const tracks: GridTrackIR[] = [];
  for (const token of splitTopLevelWs(v)) {
    const rep = token.match(/^repeat\(\s*(\d+)\s*,(.*)\)$/s);
    if (rep) {
      const n = Number(rep[1]);
      const inner = splitTopLevelWs(rep[2].trim());
      const innerTracks: GridTrackIR[] = [];
      for (const it of inner) {
        const parsed = parseTrackToken(it, receipts);
        if (parsed) innerTracks.push(parsed);
      }
      if (innerTracks.length === inner.length && n >= 1) {
        for (let i = 0; i < n; i++) tracks.push(...innerTracks);
        receipts.lowered.push(
          `\`repeat(${n}, ${rep[2].trim()})\` LOWERED to its expanded ${n * innerTracks.length}-track list — integer-literal repeat carries as declared tracks (G6)`,
        );
      }
      continue;
    }
    if (token.startsWith('repeat(')) {
      receipts.refusals.push(
        `\`${token}\` — repeat() carries only with an integer-literal count (G6); a computed or keyword count is the auto-fit family: ${GRID_REFUSALS['grid-auto-fit-minmax']}`,
      );
      continue;
    }
    const parsed = parseTrackToken(token, receipts);
    if (parsed) tracks.push(parsed);
  }
  if (receipts.refusals.length > 0 || tracks.length === 0) {
    return { tracks: null, receipts };
  }
  return { tracks, receipts };
}

/**
 * CSS `gap` shorthand → the contract's independent pair (G1: gridRowGap /
 * gridColumnGap are separate facts, P2). `gap: A` → both; `gap: A B` →
 * row A, column B. Components come back as RAW strings — the caller owns
 * var() → token-ref resolution against the real token tree.
 */
export function parseGapPair(value: string): { row: string; column: string } | null {
  const parts = splitTopLevelWs(value.trim());
  if (parts.length === 1) return { row: parts[0], column: parts[0] };
  if (parts.length === 2) return { row: parts[0], column: parts[1] };
  return null;
}

/**
 * `grid-template-areas` → G4 areas map (0-based rects). The area NAMES
 * enter the contract HERE — this is the one surface that carries them
 * (Figma has no native area names; the contract owns them, G4).
 * Non-rectangular occupancy is invalid CSS and refused by name; `.` cells
 * are empty cells, not areas.
 */
export function parseGridTemplateAreas(value: string): {
  areas: Record<string, GridAreaIR> | null;
  rowCount: number;
  columnCount: number;
  refusal?: string;
} {
  const rows: string[][] = [];
  const re = /"([^"]*)"|'([^']*)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) {
    const cells = (m[1] ?? m[2]).trim().split(/\s+/).filter((c) => c.length > 0);
    if (cells.length > 0) rows.push(cells);
  }
  if (rows.length === 0) {
    return { areas: null, rowCount: 0, columnCount: 0, refusal: `grid-template-areas \`${value.trim()}\` — no quoted row strings parseable; not extracted` };
  }
  const columnCount = rows[0].length;
  if (rows.some((r) => r.length !== columnCount)) {
    return { areas: null, rowCount: rows.length, columnCount, refusal: `grid-template-areas — ragged rows (${rows.map((r) => r.length).join('/')} cells) are invalid CSS; not extracted` };
  }
  const cellsOf = new Map<string, Array<{ r: number; c: number }>>();
  rows.forEach((cells, r) =>
    cells.forEach((name, c) => {
      if (name === '.') return;
      const bucket = cellsOf.get(name) ?? [];
      bucket.push({ r, c });
      cellsOf.set(name, bucket);
    }),
  );
  const areas: Record<string, GridAreaIR> = {};
  for (const [name, cells] of cellsOf) {
    const rMin = Math.min(...cells.map((x) => x.r));
    const rMax = Math.max(...cells.map((x) => x.r));
    const cMin = Math.min(...cells.map((x) => x.c));
    const cMax = Math.max(...cells.map((x) => x.c));
    const rectSize = (rMax - rMin + 1) * (cMax - cMin + 1);
    if (cells.length !== rectSize) {
      return {
        areas: null,
        rowCount: rows.length,
        columnCount,
        refusal: `grid-template-areas — area "${name}" occupies a non-rectangular region (invalid CSS); not extracted`,
      };
    }
    areas[name] = {
      row: rMin,
      column: cMin,
      ...(rMax > rMin ? { rowSpan: rMax - rMin + 1 } : {}),
      ...(cMax > cMin ? { columnSpan: cMax - cMin + 1 } : {}),
    };
  }
  return { areas, rowCount: rows.length, columnCount };
}

/**
 * `grid-row` / `grid-column` → 0-based anchor + span (G2: contracts are
 * 0-based cells; CSS lines are 1-based — the −1 is the proposer's half of
 * the emitter's +1, G6). Carried forms: `N`, `N / span S`, `N / M`.
 * Negative lines refuse by name (grid-negative-line — cross-rule track
 * counts are not visible at the declaration, so no lowering is possible
 * here); bare `span S` is order-dependent and refused by name.
 */
export function parseGridLine(value: string): {
  anchor?: number;
  span?: number;
  refusal?: string;
} {
  const v = value.trim();
  const negative = (): { refusal: string } => ({ refusal: GRID_REFUSALS['grid-negative-line'] });
  let m: RegExpMatchArray | null;
  if ((m = v.match(/^(-?\d+)$/))) {
    const n = Number(m[1]);
    if (n < 0) return negative();
    if (n === 0) return { refusal: `grid line \`0\` is invalid CSS (lines are 1-based); not extracted` };
    return { anchor: n - 1, span: 1 };
  }
  if ((m = v.match(/^(-?\d+)\s*\/\s*span\s+(\d+)$/))) {
    const n = Number(m[1]);
    const s = Number(m[2]);
    if (n < 0) return negative();
    if (n === 0 || s < 1) return { refusal: `grid line \`${v}\` — invalid line/span numbers; not extracted` };
    return { anchor: n - 1, span: s };
  }
  if ((m = v.match(/^(-?\d+)\s*\/\s*(-?\d+)$/))) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a < 0 || b < 0) return negative();
    if (a === 0 || b === 0 || b <= a) return { refusal: `grid line \`${v}\` — end line must follow start line (1-based); not extracted` };
    return { anchor: a - 1, span: b - a };
  }
  if (/^span\s+\d+$/.test(v)) {
    return { refusal: `grid placement \`${v}\` — a span without an anchor is auto-placement-order-dependent; under the pinned grammar placement is either explicit anchors (G2) or child order under flow: "row" (G5); not extracted` };
  }
  return { refusal: `grid placement \`${v}\` — named-line / auto forms are not carriageable (anchors are 0-based cells, P3); not extracted` };
}

/**
 * `justify-self` / `align-self` on a grid child → the G2 align vocabulary.
 * `stretch` is a NAMED LOWERED disposition (the canvas align enum rejects
 * STRETCH, P3 — stretch is spelled as the ABSENCE of alignment plus fill
 * sizing, G3); `baseline` refuses by name.
 */
export function parseGridSelfAlign(value: string): {
  align?: 'start' | 'center' | 'end';
  refusal?: string;
  lowered?: string;
} {
  const v = value.trim();
  if (v === 'start' || v === 'flex-start' || v === 'self-start') return { align: 'start' };
  if (v === 'center') return { align: 'center' };
  if (v === 'end' || v === 'flex-end' || v === 'self-end') return { align: 'end' };
  if (v === 'stretch') {
    return { lowered: GRID_REFUSALS['grid-align-stretch-keyword'] };
  }
  if (v === 'baseline' || v === 'first baseline' || v === 'last baseline') {
    return { refusal: GRID_REFUSALS['grid-baseline-align'] };
  }
  if (v === 'auto') return {}; // the default — nothing to carry
  return { refusal: `grid self-alignment \`${v}\` — vocabulary is auto | start | center | end (P3/P4: AUTO | MIN | CENTER | MAX); not extracted` };
}

/** `grid-auto-flow` → G5's one bounded flow, or the named G7 refusal. */
export function parseGridAutoFlow(value: string): {
  flow?: 'row';
  refusal?: string;
} {
  const v = value.trim();
  if (v === 'row') return { flow: 'row' };
  if (v === 'column' || v === 'column dense') return { refusal: GRID_REFUSALS['grid-flow-column'] };
  if (v === 'dense' || v === 'row dense') return { refusal: GRID_REFUSALS['grid-flow-dense'] };
  return { refusal: `grid-auto-flow \`${v}\` — the one carriageable flow is "row" (P5: gridItemsPositioning is 'MANUAL' | 'ROW_AUTO_FLOW'); not extracted` };
}

/** Grid declarations that are STRUCTURAL under the pinned grammar: a
 *  per-variant occurrence is never a layoutByProp override — the canvas
 *  physically destroys tracks on a layout.mode switch (P10) and
 *  validateGridPart refuses layoutByProp on grid parts. */
export const GRID_STRUCTURAL_PROPS = new Set([
  'grid-template-columns',
  'grid-template-rows',
  'grid-template-areas',
  'grid-template',
  'grid',
  'grid-auto-flow',
  'grid-auto-rows',
  'grid-auto-columns',
  'grid-row',
  'grid-column',
  'grid-row-start',
  'grid-row-end',
  'grid-column-start',
  'grid-column-end',
  'grid-area',
]);
