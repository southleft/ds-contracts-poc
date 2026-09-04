import type {
  TableColorParameter,
  TableFontSpec,
  TableNumberParameter,
  TableRecipeInstance,
} from "../recipes/table.js";

const number = (variable: string, fallback: number): TableNumberParameter => ({
  variable,
  fallback,
});
const color = (
  variable: string,
  fallback: `#${string}`,
): TableColorParameter => ({ variable, fallback });
const font = (
  role: "header" | "body",
  family: string,
  style: string,
): TableFontSpec => ({
  requestedFamily: family,
  requestedStyle: style,
  requestSource: `recipe/fixtures/table.ts#${role}`,
  fallbackChain: [
    { family, style },
    {
      family: "Arial",
      style: style.replaceAll(/\s+/g, "") === "SemiBold" ? "Bold" : "Regular",
    },
  ],
  resolvedFamily: family,
  resolvedStyle: style,
  resolution: "requested",
});

export const canonicalTableRecipeInstance = {
  identity: { id: "ds.table", name: "Table" },
  semantic: {
    root: "table",
    header: "rowgroup",
    body: "rowgroup",
    row: "row",
    headerCell: "columnheader",
    bodyCell: "cell",
    columnAxis: "declared",
  },
  axes: {
    density: {
      name: "Density",
      values: ["compact", "comfortable"],
      default: "comfortable",
    },
    rowState: {
      name: "State",
      values: ["default", "selected"],
      default: "default",
    },
    cellKind: {
      name: "Kind",
      values: ["header", "body"],
      default: "body",
    },
  },
  content: {
    columns: [
      { id: "name", label: "Name", align: "left" },
      { id: "role", label: "Role", align: "left" },
      { id: "status", label: "Status", align: "left" },
    ],
    rows: [
      {
        id: "ada",
        state: "default",
        cells: ["Ada Lovelace", "Engineering", "Active"],
      },
      {
        id: "grace",
        state: "selected",
        cells: ["Grace Hopper", "Research", "Active"],
      },
    ],
    selectedRowId: "grace",
  },
  designerEditSurface: {
    textProperties: ["Label", "Column", "Cell 0", "Cell 1", "Cell 2"],
    variantProperties: ["Density", "State", "Kind"],
    instanceSwapProperties: [],
    columnAxis: {
      count: 3,
      editableProperties: ["Label", "Column", "Align"],
    },
    rowCollection: {
      componentRef: "table@1/row",
      repeatedAs: "instances",
      editableProperties: ["State", "Cell 0", "Cell 1", "Cell 2"],
    },
    cellTemplate: {
      componentRef: "table@1/cell",
      repeatedAs: "instances",
      editableProperties: ["Label", "Column", "Kind"],
    },
    resize: {
      // Both reviewed sources declare the root full-width and the rows
      // stretching to it; only the cell hugs. See fixtures/library-tables.ts for
      // the per-source citations. This previously read hug-contents on all
      // three, which was an authoring choice the sources contradict.
      root: "fill-container",
      row: "fill-container",
      cell: "hug-contents",
    },
    structuralEdits: "refuse",
  },
  publicApi: {
    controlled: ["selectedRowId"],
    uncontrolled: ["defaultSelectedRowId"],
    events: ["onRowSelect"],
    keyboard: ["ArrowDown", "ArrowUp", "Home", "End"],
  },
  tokens: {
    densities: {
      compact: {
        paddingX: number("table.compact.padding-x", 12),
        paddingY: number("table.compact.padding-y", 4),
        fontSize: number("table.compact.font-size", 14),
        minWidth: number("table.compact.min-width", 120),
      },
      comfortable: {
        paddingX: number("table.comfortable.padding-x", 12),
        paddingY: number("table.comfortable.padding-y", 12),
        fontSize: number("table.comfortable.font-size", 14),
        minWidth: number("table.comfortable.min-width", 120),
      },
    },
    rowStates: {
      default: {
        background: color("table.row.default.background", "#ffffffff"),
      },
      selected: {
        background: color("table.row.selected.background", "#dbeafeff"),
      },
    },
    surface: color("table.surface", "#ffffffff"),
    headerBackground: color("table.header.background", "#f3f4f6ff"),
    text: color("table.text", "#111827ff"),
    frameBorder: color("table.frame-border", "#e5e7ebff"),
    frameBorderWidth: number("table.frame-border-width", 1),
    cellRule: color("table.cell-rule", "#00000000"),
    cellRuleWidth: number("table.cell-rule-width", 0),
    radius: number("table.radius", 8),
    typography: {
      header: font("header", "Inter", "Semi Bold"),
      body: font("body", "Inter", "Regular"),
    },
  },
  inputFacts: [
    { path: "root", channel: "structure" },
    { path: "root", channel: "columns" },
    { path: "root", channel: "rows" },
    { path: "root", channel: "tokens" },
    { path: "root", channel: "designer-edit-surface" },
    { path: "root", channel: "aria-model" },
    { path: "root", channel: "events" },
    { path: "root", channel: "keyboard" },
    { path: "root", channel: "recipe-selection" },
  ],
  accounting: {
    carried: [
      { path: "root", channel: "structure" },
      { path: "root", channel: "columns" },
      { path: "root", channel: "rows" },
      { path: "root", channel: "tokens" },
      { path: "root", channel: "designer-edit-surface" },
    ],
  },
  extensions: [
    {
      id: "table/aria",
      kind: "a11y",
      stated:
        "relates table, rowgroup, row, columnheader, and cell roles on the declared column axis",
      why: "runtime ARIA relationships are not drawable Figma properties",
      absorbs: [{ path: "root", channel: "aria-model" }],
    },
    {
      id: "table/events",
      kind: "behaviour",
      stated: "dispatches row selection changes",
      why: "events require executable code",
      absorbs: [{ path: "root", channel: "events" }],
    },
    {
      id: "table/keyboard",
      kind: "keyboard",
      stated: "supports ArrowUp/Down, Home, and End over body rows",
      why: "keyboard interaction requires executable code",
      absorbs: [{ path: "root", channel: "keyboard" }],
    },
    {
      id: "table/recipe-selection",
      kind: "data",
      stated: "records the reviewed table@1 selection and setup cost",
      why: "selection provenance is review data",
      absorbs: [{ path: "root", channel: "recipe-selection" }],
    },
  ],
  receipts: [],
  provenance: {
    source: "recipe/fixtures/table.ts",
    tool: "table@1",
    generatedAt: "2026-08-29T00:00:00.000Z",
    selection: {
      candidates: [{ id: "table", version: 1 }],
      selectedBy: "recipe-pivot-table-review",
      mechanism: "human-review",
      source: "docs/32-recipe-ir-pivot.md §7",
      reviewedAt: "2026-08-29T00:00:00.000Z",
      manualCost: {
        value: 1,
        unit: "reviewed-mapping",
        note: "one explicit table / data-grid to table@1 selection",
      },
    },
  },
} as const satisfies TableRecipeInstance;
