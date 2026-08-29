import type {
  ReviewedTableAdapterConfig,
  ReviewedTableSource,
  ReviewedTableSourceFact,
  TableFactCategory,
} from "../adapters/table.js";
import { canonicalTableRecipeInstance } from "./table.js";
import type { TableRecipeInstance } from "../recipes/table.js";

export const firstPartyTableSource: ReviewedTableSource = {
  packageName: "ds-contracts-poc",
  version: "1.0.0-rc.1",
  exportName: "Table",
  framework: "react",
  sourceRoot: "src/components/Table",
  anatomy: {
    root: "contracts/table.contract.json anatomy.root flex column + src/components/Table/Table.tsx role=table",
    header: "contracts/table.contract.json anatomy.root.parts.header row of ds.table-header-cell",
    body: "contracts/table.contract.json anatomy.root.parts.body column slot of ds.table-row",
    row: "contracts/table-row.contract.json flex row + state default|selected",
    headerCell: "contracts/table-header-cell.contract.json role=columnheader",
    bodyCell: "contracts/table-cell.contract.json role=cell",
    columnAxis: "contracts/table.contract.json header nameHeader/roleHeader/statusHeader — three declared columns",
  },
  api: {
    density: "density comfortable|compact",
    rowState: "TableRow state default|selected",
    children: "body slot accepts TableRow",
    selection: "row state is declared, not a controlled selectedRowId API",
    keyboard: "no table keyboard handler in generated Table.tsx",
    extras: "no sort, checkbox, pagination, or sticky header in ds.table",
  },
  styleSources: [
    "src/components/Table/Table.module.css root/header/body",
    "src/components/TableCell/TableCell.module.css padding-inline and density padding-block",
    "src/components/TableHeaderCell/TableHeaderCell.module.css font-weight title",
    "src/components/TableRow/TableRow.module.css row background by state",
    "tokens/semantic.tokens.json space.table.cell-y and size.table.cell-width",
    "tokens/modes/semantic.light.tokens.json color.table.row and color.surface",
  ],
  fontSources: [
    "tokens/primitives.tokens.json font.family.sans Inter",
    "tokens/semantic.tokens.json font.control.size.sm → 14px and font.title.weight → semibold",
  ],
};

export const muiTableSource: ReviewedTableSource = {
  packageName: "@mui/material",
  version: "9.2.0",
  exportName: "Table",
  framework: "react",
  sourceRoot: "recipe/sandboxes/input-field-mui/node_modules/@mui/material",
  anatomy: {
    root: "extract/computed/out/mui/table/LEDGER.md table-lowering root table → flex column",
    header: "extract/computed/out/mui/table/LEDGER.md thead → rowgroup, header row → row of th",
    body: "extract/computed/out/mui/table/LEDGER.md tbody → rowgroup of tr",
    row: "extract/computed/out/mui/table/LEDGER.md tablerow-root table-row → flex row; tablerow-root-2 is the selected body row",
    headerCell: "extract/computed/out/mui/table/enriched.contract.json tablecell-head-2 / label-2 text columnheader",
    bodyCell: "extract/computed/out/mui/table/enriched.contract.json tablecell-body text cell",
    columnAxis: "extract/computed/out/mui/table/LEDGER.md Name / Role / Team / Actions plus a checkbox column — recipe keeps the three text columns",
  },
  api: {
    size: "Table size small|medium",
    rowState: "TableRow selected; hover is interaction-only",
    padding: "TableCell padding / paddingCheckbox / size",
    stickyHeader: "stickyHeader named exclusion in enriched.contract.json",
    selection: "TableRow selected is declared; no controlled selectedRowId API in the extract",
    keyboard: "no table keyboard handler in the MUI extract",
    extras: "checkbox column, TableSortLabel, actions cell, TablePagination",
  },
  styleSources: [
    "extract/computed/out/mui/table/enriched.extension.json tablecell-head-2 padding-top/bottom 6/16 and shared.size-16 inline",
    "extract/computed/out/mui/table/enriched.extension.json shared.color-e0e0e0 / shared.size-1 cell border-bottom",
    "extract/computed/out/mui/table/enriched.extension.json tablerow-root-2 background-color #1976d214",
    "extract/computed/out/mui/table/enriched.contract.json tablecell-head-2 color #000000de font-size 14 font-weight 500",
  ],
  fontSources: [
    "extract/computed/out/mui/table/enriched.contract.json font-family Roboto, Helvetica, Arial, sans-serif",
  ],
};

const categoryForToken = (path: string): TableFactCategory => {
  if (path.includes("typography")) return "typography";
  if (path.includes("rowStates")) return "state";
  if (
    path.includes("background") ||
    path.includes("surface") ||
    path.includes("text") ||
    path.includes("Border") ||
    path.includes("cellRule")
  )
    return "fill";
  return "geometry";
};

const tokenFacts = (
  sourceSlug: string,
  evidence: string,
  value: unknown,
  path = "tokens",
  facts: ReviewedTableSourceFact[] = [],
): ReviewedTableSourceFact[] => {
  if (value === null || typeof value !== "object") {
    if (path.startsWith("tokens.typography")) {
      facts.push({
        occurrenceId: `${sourceSlug}-ir-${facts.length + 1}`,
        category: "typography",
        source: {
          kind: "review",
          evidence: `${evidence}; reviewed font provenance field ${path}=${String(value)}`,
        },
        disposition: "ir",
        target: path,
      });
    }
    return facts;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.variable === "string" &&
    (typeof record.fallback === "string" || typeof record.fallback === "number")
  ) {
    facts.push({
      occurrenceId: `${sourceSlug}-ir-${facts.length + 1}`,
      category: categoryForToken(path),
      source: {
        kind: "review",
        evidence: `${evidence}; reviewed ${record.variable}=${record.fallback}`,
      },
      disposition: "ir",
      target: path,
    });
    return facts;
  }
  for (const [key, child] of Object.entries(record))
    tokenFacts(sourceSlug, evidence, child, `${path}.${key}`, facts);
  return facts;
};

const cloneTokens = (
  prefix: string,
  mutate: (path: string, fallback: string | number) => string | number,
): TableRecipeInstance["tokens"] => {
  const tokens = structuredClone(
    canonicalTableRecipeInstance.tokens,
  ) as TableRecipeInstance["tokens"];
  const visit = (value: unknown, path: string): void => {
    if (value === null || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (
      typeof record.variable === "string" &&
      (typeof record.fallback === "string" ||
        typeof record.fallback === "number")
    ) {
      record.variable = `${prefix}.${path.replaceAll(".", "-")}`;
      record.fallback = mutate(path, record.fallback);
      return;
    }
    for (const [key, child] of Object.entries(record))
      visit(child, path ? `${path}.${key}` : key);
  };
  visit(tokens, "");
  return tokens;
};

const firstPartyTokens = cloneTokens("ds.table", (_path, fallback) => fallback);

const muiTokens = cloneTokens("mui.table", (path, fallback) => {
  if (path.endsWith("compact.paddingX") || path.endsWith("comfortable.paddingX"))
    return 16;
  if (path.endsWith("compact.paddingY")) return 6;
  if (path.endsWith("comfortable.paddingY")) return 16;
  if (path.endsWith("compact.minWidth") || path.endsWith("comfortable.minWidth"))
    return 0;
  if (path.includes("rowStates.selected.background")) return "#1976d214";
  if (path === "headerBackground") return "#ffffffff";
  if (path === "text") return "#000000de";
  if (path === "frameBorder") return "#00000000";
  if (path === "frameBorderWidth") return 0;
  if (path === "cellRule") return "#e0e0e0ff";
  if (path === "cellRuleWidth") return 1;
  if (path === "radius") return 0;
  return fallback;
});
muiTokens.typography = {
  header: {
    requestedFamily: "Roboto",
    requestedStyle: "Medium",
    requestSource:
      "extract/computed/out/mui/table/enriched.contract.json tablecell-head-2 font-family/font-weight 500",
    fallbackChain: [
      { family: "Roboto", style: "Medium" },
      { family: "Helvetica", style: "Bold" },
      { family: "Arial", style: "Bold" },
    ],
    resolvedFamily: "Roboto",
    resolvedStyle: "Medium",
    resolution: "requested",
  },
  body: {
    requestedFamily: "Roboto",
    requestedStyle: "Regular",
    requestSource:
      "extract/computed/out/mui/table/enriched.contract.json tablecell-body font-family",
    fallbackChain: [
      { family: "Roboto", style: "Regular" },
      { family: "Helvetica", style: "Regular" },
      { family: "Arial", style: "Regular" },
    ],
    resolvedFamily: "Roboto",
    resolvedStyle: "Regular",
    resolution: "requested",
  },
};

const commonFacts = (
  slug: string,
  source: ReviewedTableSource,
  tokens: TableRecipeInstance["tokens"],
): ReviewedTableSourceFact[] => {
  const facts = tokenFacts(
    slug,
    `${source.packageName}@${source.version} source/style review`,
    tokens,
  );
  facts.push(
    {
      occurrenceId: `${slug}-anatomy-columns`,
      category: "anatomy",
      source: {
        kind: "pointer",
        pointer: "/anatomy/columnAxis",
        expected: source.anatomy.columnAxis,
      },
      disposition: "ir",
      target: "content.columns",
    },
    {
      occurrenceId: `${slug}-anatomy-rows`,
      category: "anatomy",
      source: {
        kind: "pointer",
        pointer: "/anatomy/row",
        expected: source.anatomy.row,
      },
      disposition: "ir",
      target: "content.rows",
    },
    {
      occurrenceId: `${slug}-semantics-aria`,
      category: "semantics",
      source: {
        kind: "pointer",
        pointer: "/anatomy/root",
        expected: source.anatomy.root,
      },
      disposition: "extension",
      target: "table/aria",
    },
    {
      occurrenceId: `${slug}-api-events`,
      category: "api",
      source: {
        kind: "pointer",
        pointer: "/api/selection",
        expected: source.api.selection,
      },
      disposition: "extension",
      target: "table/events",
    },
    {
      occurrenceId: `${slug}-api-keyboard`,
      category: "api",
      source: {
        kind: "pointer",
        pointer: "/api/keyboard",
        expected: source.api.keyboard,
      },
      disposition: "extension",
      target: "table/keyboard",
    },
    {
      occurrenceId: `${slug}-refusal-extras`,
      category: "refusal",
      source: {
        kind: "pointer",
        pointer: "/api/extras",
        expected: source.api.extras,
      },
      disposition: "refusal",
      target:
        "table@1 bounded three-column two-row proof; checkbox/sort/actions/pagination/sticky/hover are deferred",
    },
  );
  return facts;
};

const selection = (source: string, mappings: number) => ({
  candidates: [{ id: "table", version: 1 }],
  selectedBy: "recipe-pivot-table-review",
  mechanism: "reviewed-config" as const,
  source,
  reviewedAt: "2026-08-29T00:00:00.000Z",
  manualCost: {
    value: mappings,
    unit: "reviewed-mapping" as const,
    note: `${mappings} explicit occurrence mappings plus source setup; no source-name inference`,
  },
});

const buildConfig = (
  slug: string,
  source: ReviewedTableSource,
  sourcePath: string,
  identity: { id: string; name: string },
  sourceContent: TableRecipeInstance["content"],
  tokens: TableRecipeInstance["tokens"],
  setupSeconds: number,
  wrapper: string,
  unsupportedCells: string[],
): ReviewedTableAdapterConfig => {
  const sourceFacts = commonFacts(slug, source, tokens);
  const manualMappings = sourceFacts.map(
    (fact) => `${fact.occurrenceId}→${fact.disposition}:${fact.target}`,
  );
  return {
    sourcePath,
    generatedAt: "2026-08-29T00:00:00.000Z",
    selection: selection(
      `recipe/fixtures/library-tables.ts#${slug}`,
      manualMappings.length,
    ),
    identity,
    content: sourceContent,
    tokens,
    sourceFacts,
    manualMappings,
    benchmark: {
      packageName: source.packageName,
      version: source.version,
      exportName: source.exportName,
      importPath: source.packageName,
      wrapper,
      setupSeconds,
      sourceHarness: source.sourceRoot,
      sourceMatrixCells: TABLE_PAIRED_PROOF_PROTOCOL.cellsPerSource,
      unsupportedCells,
      captureCommand:
        "deferred: source references must be rendered in a separately authorized matched-benchmark task",
      renderedReferences: false,
      graded: false,
    },
  };
};

export const TABLE_PAIRED_PROOF_PROTOCOL = {
  artifactVersion: "table-paired-proof-protocol-v1",
  frozenBeforeResults: true,
  resultStatus: "not-run",
  cellsPerSource: 4,
  totalCells: 8,
  cells: [
    "compact/default",
    "compact/selected",
    "comfortable/default",
    "comfortable/selected",
  ],
  expected: {
    tableVariants: 2,
    rowVariants: 4,
    cellVariants: 4,
    components: 10,
    instances: 22,
  },
  performanceBoundsMs: {
    adaptCompileCollapseTwoCyclesPerSource: 4000,
  },
  comparison: {
    legacyContext: "first-party ds.table density×row plus MUI Table size extract; no live grade",
    sourceReferencesRendered: false,
    aiGrading: false,
    liveFigma: false,
  },
} as const;

export const firstPartyTableAdapterConfig = buildConfig(
  "first-party",
  firstPartyTableSource,
  "recipe/fixtures/library-tables.ts#firstPartyTableAdapterConfig",
  { id: "ds.table", name: "Table" },
  structuredClone(canonicalTableRecipeInstance.content),
  firstPartyTokens,
  18,
  "first-party Table + TableRow + TableHeaderCell",
  [
    "sort",
    "checkbox-column",
    "pagination",
    "sticky-header",
    "hover",
    "more-than-three-columns",
  ],
);

export const muiTableAdapterConfig = buildConfig(
  "mui",
  muiTableSource,
  "recipe/fixtures/library-tables.ts#muiTableAdapterConfig",
  { id: "mui.table", name: "Table" },
  {
    columns: [
      { id: "name", label: "Name", align: "left" },
      { id: "role", label: "Role", align: "left" },
      { id: "team", label: "Team", align: "left" },
    ],
    rows: [
      {
        id: "yogurt",
        state: "default",
        cells: ["Frozen yoghurt", "Designer", "Platform"],
      },
      {
        id: "sandwich",
        state: "selected",
        cells: ["Ice cream sandwich", "Engineer", "Contracts"],
      },
    ],
    selectedRowId: "sandwich",
  },
  muiTokens,
  22,
  "MUI Table + TableHead + TableBody + TableRow + TableCell",
  [
    "checkbox-column",
    "sort-label",
    "actions-column",
    "pagination",
    "sticky-header",
    "hover",
    "letter-spacing-0.14994",
    "size-small-as-recipe-name",
  ],
);
