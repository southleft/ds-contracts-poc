import type { NodeSpec, GridTrackSpec } from './emit-figma-script.js';

// Collect these only on grids or their immediate children. Inert grid defaults
// must not change historical non-grid receipts.
export const NATIVE_GRID_FIELDS = ['gridRowCount', 'gridColumnCount', 'gridRowSizes', 'gridColumnSizes',
  'gridRowGap', 'gridColumnGap', 'gridItemsPositioning'];
export const NATIVE_GRID_CHILD_FIELDS = ['gridRowAnchorIndex', 'gridColumnAnchorIndex', 'gridRowSpan',
  'gridColumnSpan', 'gridChildHorizontalAlign', 'gridChildVerticalAlign'];

type Values = Record<string, unknown>;
const numeric = (actual: unknown, expected: number) => actual === expected || actual === Math.fround(expected);
function tracksMatch(actual: unknown, expected: GridTrackSpec[]) {
  return Array.isArray(actual) && actual.length === expected.length && expected.every((track, i) => {
    const value = actual[i];
    return value && value.type === track.type &&
      Object.keys(value).every(key => key === 'type' || key === 'value') &&
      (track.type === 'HUG' ? value.value === undefined || value.value === 1 : numeric(value.value, track.value));
  });
}

/** Check drawn facts against compiler expectations, never measured child sizes
 * or values copied from the write acknowledgement. */
export function nativeGridProblems(spec: NodeSpec, values: Values, children: Array<Values | undefined>): string[] {
  if (spec.layout?.mode !== 'GRID') return [];
  const grid = spec.layout.grid, problems: string[] = [];
  if (!grid) return ['declaration-missing'];
  if (values.gridRowCount !== grid.rows.length || !tracksMatch(values.gridRowSizes, grid.rows)) problems.push('rows');
  if (values.gridColumnCount !== grid.columns.length || !tracksMatch(values.gridColumnSizes, grid.columns)) problems.push('columns');
  if (!numeric(values.gridRowGap, grid.rowGap) || !numeric(values.gridColumnGap, grid.columnGap)) problems.push('gaps');
  if (values.gridItemsPositioning !== (grid.flow ?? 'MANUAL')) problems.push('flow');
  if ((grid.hugWidth && values.layoutSizingHorizontal !== 'HUG') ||
      (grid.hugHeight && values.layoutSizingVertical !== 'HUG')) problems.push('hug');
  let flowIndex = 0;
  for (const [i, child] of (spec.children ?? []).entries()) {
    if (child.absolute || child.overlay || child.insetOverlay) continue;
    const actual = children[i], cell = child.cell;
    // Manual placement must have an explicit compiler cell. Do not guess the
    // outcome of partially specified placements among already occupied cells.
    if (!grid.flow && !cell) { problems.push('child-placement-unqualified-' + i); continue; }
    const row = grid.flow ? Math.floor(flowIndex / grid.columns.length) : cell!.row;
    const column = grid.flow ? flowIndex % grid.columns.length : cell!.column;
    flowIndex++;
    if (!actual || actual.layoutPositioning === 'ABSOLUTE' || actual.gridRowAnchorIndex !== row ||
        actual.gridColumnAnchorIndex !== column || actual.gridRowSpan !== (cell?.rowSpan ?? 1) ||
        actual.gridColumnSpan !== (cell?.columnSpan ?? 1) ||
        actual.gridChildHorizontalAlign !== (cell?.hAlign ?? 'AUTO') ||
        actual.gridChildVerticalAlign !== (cell?.vAlign ?? 'AUTO')) problems.push('child-' + i);
  }
  return problems;
}
