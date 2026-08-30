/**
 * Column alignment for `table@1`.
 *
 * The live usability probe measures roles, fake layout, state semantics,
 * visible-area loss and overlap. Table live v27 passed every one of those on
 * both roots and on all twenty cells, and the MUI mint's columns still did not
 * line up: the first column was 127px in one row and 159px in another. A data
 * table whose columns do not line up is not usable, so a gate that cannot see
 * that is not measuring usability -- docs/32 §F item 2.
 *
 * This is the measurement, not the fix. It does not choose a column width and
 * it does not decide whether a table root hugs or fills; both are open human
 * authoring decisions, and picking either without a reviewed source fact would
 * be the invented FILL/FIXED teaching the standing constraints forbid.
 *
 * A table with a column model has ONE width per column index. A table without
 * one has as many widths as it has differing rows.
 */

export interface ColumnAlignmentNode {
  name?: string;
  description?: string;
  width?: number;
  children?: ColumnAlignmentNode[];
}

export interface ColumnAlignmentColumn {
  index: number;
  widths: number[];
  aligned: boolean;
  divergencePx: number;
}

export interface ColumnAlignmentReport {
  variant: string;
  rows: number;
  columns: ColumnAlignmentColumn[];
  aligned: boolean;
  worstDivergencePx: number;
}

const CELL_INSTANCE_PREFIX = "table/cell-instance/";
const ROW_GROUP_ROLE = /^table\/(header|body)$/;

/** The scene's own role convention: a description tag wins, else the first name segment. */
export const columnAlignmentRole = (node: ColumnAlignmentNode): string => {
  const description =
    typeof node.description === "string" ? node.description : "";
  const match = description.match(/(?:^|\n)recipe-role:([^\n]+)/);
  if (match) return match[1]!;
  const head = String(node.name ?? "").split(" :: ", 1)[0]!;
  return head.includes("/") && !head.includes("=") ? head : "";
};

const descendants = (
  node: ColumnAlignmentNode,
  out: ColumnAlignmentNode[] = [],
): ColumnAlignmentNode[] => {
  out.push(node);
  for (const child of node.children ?? []) descendants(child, out);
  return out;
};

/**
 * Measure one table variant. Walks its header and body groups, takes each row's
 * cell instances in order, and collects the distinct rounded widths seen at
 * each column index.
 */
export function measureColumnAlignment(
  variant: ColumnAlignmentNode,
): ColumnAlignmentReport {
  const widthsByColumn = new Map<number, Set<number>>();
  let rows = 0;

  for (const group of descendants(variant)) {
    if (!ROW_GROUP_ROLE.test(columnAlignmentRole(group))) continue;
    for (const row of group.children ?? []) {
      const cells = descendants(row).filter((node) =>
        columnAlignmentRole(node).startsWith(CELL_INSTANCE_PREFIX),
      );
      if (cells.length === 0) continue;
      rows += 1;
      for (const [index, cell] of cells.entries()) {
        if (!widthsByColumn.has(index)) widthsByColumn.set(index, new Set());
        widthsByColumn.get(index)!.add(Math.round(cell.width ?? 0));
      }
    }
  }

  const columns = [...widthsByColumn.entries()]
    .sort(([left], [right]) => left - right)
    .map(([index, set]): ColumnAlignmentColumn => {
      const widths = [...set].sort((left, right) => left - right);
      return {
        index,
        widths,
        aligned: widths.length === 1,
        divergencePx:
          widths.length === 0 ? 0 : widths[widths.length - 1]! - widths[0]!,
      };
    });

  return {
    variant: String(variant.name ?? ""),
    rows,
    columns,
    aligned: columns.every((column) => column.aligned),
    worstDivergencePx: columns.reduce(
      (worst, column) => Math.max(worst, column.divergencePx),
      0,
    ),
  };
}

/** Every variant of one minted `table/set`. */
export function measureTableSetColumnAlignment(
  tableSet: ColumnAlignmentNode,
): ColumnAlignmentReport[] {
  return (tableSet.children ?? [])
    .map((variant) => measureColumnAlignment(variant))
    .filter((report) => report.rows > 0);
}

/**
 * The gate line. A ragged column is a finding a reader can act on: it names the
 * variant, the column, and the widths that disagree.
 */
export function columnAlignmentFindings(
  reports: readonly ColumnAlignmentReport[],
): string[] {
  const findings: string[] = [];
  for (const report of reports)
    for (const column of report.columns)
      if (!column.aligned)
        findings.push(
          `${report.variant}: column ${column.index} carries ${column.widths.length} widths (${column.widths.join(", ")}) — ${column.divergencePx}px divergence`,
        );
  return findings;
}
