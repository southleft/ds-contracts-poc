import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Resizable workbench columns — dependency-free, pointer-driven.
 *
 * The .pg grid gains two 5px gutters (rail | center and center | output);
 * each draws the 1px pane border down its middle and drags with
 * cursor: col-resize. A drag pins that side to a px width (the center stays
 * the flexible 1fr column); minimums are respected (rail ≥ 280, center
 * ≥ 320, output ≥ 360); widths persist in sessionStorage; a double-click
 * resets that gutter's side to the default template. Arrow keys nudge a
 * focused gutter 16px — the handles are real separators, not divs with
 * vibes. Below the 1100px stacked breakpoint the gutters are display: none
 * and the media query's `grid-template-columns: 1fr` outranks the pinned
 * widths (they only ride a CSS custom property).
 */

export interface PaneWidths {
  rail: number | null;
  output: number | null;
}

const KEY = 'ds-playground.pane-widths';
const GUTTER = 5;
const GUTTERS_TOTAL = GUTTER * 2;
const KEY_STEP = 16;

export const PANE_MIN = { rail: 280, center: 320, output: 360 } as const;
/** The default template's px rail — the fallback while rail is unpinned. */
const RAIL_DEFAULT = 420;

const load = (): PaneWidths => {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return { rail: null, output: null };
    const parsed = JSON.parse(raw) as Partial<PaneWidths>;
    return {
      rail: typeof parsed.rail === 'number' ? parsed.rail : null,
      output: typeof parsed.output === 'number' ? parsed.output : null,
    };
  } catch {
    return { rail: null, output: null };
  }
};

interface DragState {
  side: 'rail' | 'output';
  startX: number;
  start: number;
  max: number;
}

export function usePaneResize(
  pgRef: RefObject<HTMLDivElement | null>,
  railRef: RefObject<HTMLElement | null>,
  outputRef: RefObject<HTMLElement | null>,
) {
  const [widths, setWidths] = useState<PaneWidths>(load);
  useEffect(() => {
    try {
      if (widths.rail === null && widths.output === null) window.sessionStorage.removeItem(KEY);
      else window.sessionStorage.setItem(KEY, JSON.stringify(widths));
    } catch {
      /* storage unavailable — widths just reset next load */
    }
  }, [widths]);

  /** Pinned columns as a grid template, or null while both sides ride the
   *  default (the stylesheet's fallback wins). */
  const cols =
    widths.rail === null && widths.output === null
      ? null
      : `${widths.rail ?? RAIL_DEFAULT}px ${GUTTER}px minmax(${PANE_MIN.center}px, 1fr) ${GUTTER}px ${
          widths.output !== null ? `${widths.output}px` : `minmax(${PANE_MIN.output}px, 1.1fr)`
        }`;

  const drag = useRef<DragState | null>(null);

  /** The largest width `side` may take right now: the container minus both
   *  gutters, the center's minimum, and the other side's floor (its pinned
   *  px width, or its minimum while it still flexes). */
  const maxFor = (side: 'rail' | 'output'): number => {
    const total = pgRef.current?.clientWidth ?? 0;
    const other =
      side === 'rail' ? (widths.output ?? PANE_MIN.output) : (widths.rail ?? RAIL_DEFAULT);
    return total - GUTTERS_TOTAL - PANE_MIN.center - other;
  };

  const clamp = (side: 'rail' | 'output', raw: number, max: number) =>
    Math.round(Math.min(Math.max(raw, PANE_MIN[side]), Math.max(PANE_MIN[side], max)));

  const measured = (side: 'rail' | 'output'): number => {
    const el = side === 'rail' ? railRef.current : outputRef.current;
    return el?.getBoundingClientRect().width ?? (side === 'rail' ? RAIL_DEFAULT : PANE_MIN.output);
  };

  const gutterProps = (side: 'rail' | 'output') => ({
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      drag.current = { side, startX: e.clientX, start: measured(side), max: maxFor(side) };
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      if (!d || d.side !== side) return;
      const dx = e.clientX - d.startX;
      const next = clamp(side, side === 'rail' ? d.start + dx : d.start - dx, d.max);
      setWidths((w) => (w[side] === next ? w : { ...w, [side]: next }));
    },
    onPointerUp: () => {
      drag.current = null;
    },
    onPointerCancel: () => {
      drag.current = null;
    },
    onDoubleClick: () => setWidths((w) => ({ ...w, [side]: null })),
    onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      // The arrow moves the HANDLE: right grows the rail but shrinks the output.
      const delta = e.key === 'ArrowRight' ? KEY_STEP : -KEY_STEP;
      const next = clamp(
        side,
        measured(side) + (side === 'rail' ? delta : -delta),
        maxFor(side),
      );
      setWidths((w) => (w[side] === next ? w : { ...w, [side]: next }));
    },
  });

  return { cols, gutterProps };
}
