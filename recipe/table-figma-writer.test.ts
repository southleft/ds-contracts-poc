import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { adaptReviewedTable } from "./adapters/table.js";
import { validateFigmaWriterConformance } from "./figma-writer-conformance.js";
import {
  firstPartyTableAdapterConfig,
  firstPartyTableSource,
  muiTableAdapterConfig,
  muiTableSource,
  TABLE_PAIRED_PROOF_PROTOCOL,
} from "./fixtures/library-tables.js";
import type { IRNode } from "./figma-ir.js";
import { hashRecipeInstance } from "./recipe.js";
import { compileTableRecipe, tableRecipe } from "./recipes/table.js";
import {
  emitTableFigmaWriter,
  FORBIDDEN_COMBOBOX_NAMESPACE,
  FORBIDDEN_COMBOBOX_PAGE_ID,
  FORBIDDEN_COMBOBOX_RUN_IDENTITY,
  FORBIDDEN_INPUT_NAMESPACE,
  FORBIDDEN_INPUT_PAGE_ID,
  FORBIDDEN_INPUT_RUN_IDENTITY,
  FORBIDDEN_TABLE_V1_RUN_IDENTITY,
  FORBIDDEN_TABLE_V2_RUN_IDENTITY,
  FORBIDDEN_TABLE_V3_RUN_IDENTITY,
  FORBIDDEN_TABLE_V4_RUN_IDENTITY,
  FORBIDDEN_TABLE_V5_RUN_IDENTITY,
  FORBIDDEN_TABLE_V6_RUN_IDENTITY,
  FORBIDDEN_TABLE_V7_RUN_IDENTITY,
  FORBIDDEN_TABLE_V8_RUN_IDENTITY,
  FORBIDDEN_TABLE_V9_RUN_IDENTITY,
  FORBIDDEN_TABLE_V10_RUN_IDENTITY,
  FORBIDDEN_TABLE_V11_RUN_IDENTITY,
  FORBIDDEN_TABLE_V12_RUN_IDENTITY,
  FORBIDDEN_TABLE_V13_RUN_IDENTITY,
  FORBIDDEN_TABLE_V14_RUN_IDENTITY,
  FORBIDDEN_TABLE_V15_RUN_IDENTITY,
  FORBIDDEN_TABLE_V16_RUN_IDENTITY,
  FORBIDDEN_TABLE_V17_RUN_IDENTITY,
  FORBIDDEN_TABLE_V18_RUN_IDENTITY,
  TABLE_FIGMA_INSTANCES_PER_SOURCE,
  TABLE_FIGMA_NAMESPACE,
  TABLE_FIGMA_RUN_SUFFIX,
  TABLE_FIGMA_VARIANT_COUNT,
  validateTableFigmaSourcePlans,
  type TableFigmaWriterInput,
} from "./table-figma-writer.js";

const walkStripRole = (node: IRNode, role: string): void => {
  if (node.role === role) node.role = "stripped";
  if (
    node.kind === "frame" ||
    node.kind === "component" ||
    node.kind === "component-set"
  ) {
    for (const child of node.children) walkStripRole(child, role);
  }
};

const inputs = (): TableFigmaWriterInput[] =>
  [
    {
      adapterIdentity: "first-party-table-reviewed-v1",
      displayName: "First-party Table",
      source: firstPartyTableSource,
      config: firstPartyTableAdapterConfig,
    },
    {
      adapterIdentity: "material-table-reviewed-v1",
      displayName: "Reviewed Table",
      source: muiTableSource,
      config: muiTableAdapterConfig,
    },
  ].map(({ source, config, ...rest }) => {
    const instance = adaptReviewedTable(source, config);
    return {
      ...rest,
      recipeHash: hashRecipeInstance(tableRecipe, instance),
      envelope: compileTableRecipe(instance),
    };
  });

test("Table writer plans two complete 2+4+4 primitive-IR sets without source branches", () => {
  const writer = emitTableFigmaWriter(inputs());
  assert.equal(writer.sourcePlans.length, 2);
  assert.equal(writer.namespace, TABLE_FIGMA_NAMESPACE);
  assert.match(writer.runIdentity, new RegExp(`-${TABLE_FIGMA_RUN_SUFFIX}$`));
  assert.match(writer.pageName, /^Recipe Pivot \/ Table \/ /);
  assert.notEqual(writer.namespace, FORBIDDEN_INPUT_NAMESPACE);
  assert.notEqual(writer.namespace, FORBIDDEN_COMBOBOX_NAMESPACE);
  assert.notEqual(writer.runIdentity, FORBIDDEN_INPUT_RUN_IDENTITY);
  assert.notEqual(writer.runIdentity, FORBIDDEN_COMBOBOX_RUN_IDENTITY);
  assert.notEqual(writer.runIdentity, FORBIDDEN_TABLE_V1_RUN_IDENTITY);
  assert.notEqual(writer.runIdentity, FORBIDDEN_TABLE_V2_RUN_IDENTITY);
  assert.notEqual(writer.runIdentity, FORBIDDEN_TABLE_V3_RUN_IDENTITY);
  assert.notEqual(writer.runIdentity, FORBIDDEN_TABLE_V4_RUN_IDENTITY);
  assert.notEqual(writer.runIdentity, FORBIDDEN_TABLE_V5_RUN_IDENTITY);
  assert.notEqual(writer.runIdentity, FORBIDDEN_TABLE_V6_RUN_IDENTITY);
  assert.notEqual(writer.runIdentity, FORBIDDEN_TABLE_V7_RUN_IDENTITY);
  assert.notEqual(writer.runIdentity, FORBIDDEN_TABLE_V8_RUN_IDENTITY);
  assert.notEqual(writer.runIdentity, FORBIDDEN_TABLE_V9_RUN_IDENTITY);
  assert.notEqual(writer.runIdentity, FORBIDDEN_TABLE_V10_RUN_IDENTITY);
  assert.notEqual(writer.runIdentity, FORBIDDEN_TABLE_V11_RUN_IDENTITY);
  assert.notEqual(writer.runIdentity, FORBIDDEN_TABLE_V12_RUN_IDENTITY);
  assert.notEqual(writer.runIdentity, FORBIDDEN_TABLE_V13_RUN_IDENTITY);
  assert.notEqual(writer.runIdentity, FORBIDDEN_TABLE_V14_RUN_IDENTITY);
  assert.notEqual(writer.runIdentity, FORBIDDEN_TABLE_V15_RUN_IDENTITY);
  assert.notEqual(writer.runIdentity, FORBIDDEN_TABLE_V16_RUN_IDENTITY);
  assert.notEqual(writer.runIdentity, FORBIDDEN_TABLE_V17_RUN_IDENTITY);
  assert.notEqual(writer.runIdentity, FORBIDDEN_TABLE_V18_RUN_IDENTITY);
  assert.match(writer.code, /TABLE-V1-IDENTITY-REUSE/);
  assert.match(writer.code, /TABLE-V2-IDENTITY-REUSE/);
  assert.match(writer.code, /TABLE-V3-IDENTITY-REUSE/);
  assert.match(writer.code, /TABLE-V4-IDENTITY-REUSE/);
  assert.match(writer.code, /TABLE-V5-IDENTITY-REUSE/);
  assert.match(writer.code, /TABLE-V6-IDENTITY-REUSE/);
  assert.match(writer.code, /TABLE-V7-IDENTITY-REUSE/);
  assert.match(writer.code, /TABLE-V8-IDENTITY-REUSE/);
  assert.match(writer.code, /TABLE-V9-IDENTITY-REUSE/);
  assert.match(writer.code, /TABLE-V10-IDENTITY-REUSE/);
  assert.match(writer.code, /TABLE-V11-IDENTITY-REUSE/);
  assert.match(writer.code, /TABLE-V12-IDENTITY-REUSE/);
  assert.match(writer.code, /TABLE-V13-IDENTITY-REUSE/);
  assert.match(writer.code, /TABLE-V14-IDENTITY-REUSE/);
  assert.match(writer.code, /TABLE-V15-IDENTITY-REUSE/);
  assert.match(writer.code, /TABLE-V16-IDENTITY-REUSE/);
  assert.match(writer.code, /TABLE-V17-IDENTITY-REUSE/);
  assert.match(writer.code, /TABLE-V18-IDENTITY-REUSE/);
  assert.match(writer.code, /TABLE-WRITER-MIN-WIDTH-ZERO-UNSET/);
  assert.match(
    writer.code,
    /node\.minWidth=layout\.minWidth===0\?null:layout\.minWidth/,
  );
  assert.equal(writer.code.includes("if(layout.minWidth!==undefined)node.minWidth=layout.minWidth;"), false);
  assert.match(writer.code, /"requestedFamily":"Inter"/);
  assert.match(writer.code, /"requestedStyle":"Semi Bold"/);
  assert.match(writer.code, /"resolvedFamily":"Inter"/);
  assert.match(writer.code, /"resolvedStyle":"Semi Bold"/);
  assert.match(writer.code, /"resolution":"requested"/);
  assert.equal(writer.code.includes('"requestedStyle":"SemiBold"'), false);
  assert.equal(writer.code.includes('"resolvedStyle":"SemiBold"'), false);
  assert.equal(writer.pageName.includes(FORBIDDEN_INPUT_PAGE_ID), false);
  assert.equal(writer.pageName.includes(FORBIDDEN_COMBOBOX_PAGE_ID), false);
  assert.equal(
    writer.sourcePlans.reduce(
      (sum, source) =>
        sum +
        source.tableCells.length +
        source.rowCells.length +
        source.cellCells.length,
      0,
    ),
    TABLE_FIGMA_VARIANT_COUNT,
  );
  assert.equal(
    writer.sourcePlans.every(
      (source) =>
        source.variables.length > 0 &&
        source.comparedIrFacts > 0 &&
        source.instanceCount === TABLE_FIGMA_INSTANCES_PER_SOURCE &&
        source.tableSet.kind === "component-set" &&
        source.rowSet.kind === "component-set" &&
        source.cellSet.kind === "component-set",
    ),
    true,
  );
  assert.equal(
    writer.sourcePlans.every(
      (source) =>
        source.instanceCount === TABLE_PAIRED_PROOF_PROTOCOL.expected.instances,
    ),
    true,
  );
  const generic = readFileSync("recipe/table-figma-writer.ts", "utf8").toLowerCase();
  for (const identity of ["@mui", "mui.", "antd", "ant-design", "material"]) {
    assert.equal(generic.includes(identity), false, identity);
  }
  assert.match(writer.code, /TABLE-WRITER-FIRST-SEGMENT-BIND/);
  assert.match(writer.code, /TABLE-WRITER-HIDDEN-FILL-OCCUPANCY/);
  assert.match(writer.code, /TABLE-WRITER-CELL-PROPERTIES/);
  assert.match(writer.code, /TABLE-WRITER-ROW-PROPERTIES/);
  assert.match(writer.code, /TABLE-WRITER-ROW-OWNED-TEXT-CHARACTERS/);
  assert.match(writer.code, /TABLE-ROW-OWNED-TEXT-ABSENT/);
  assert.match(writer.code, /TABLE-ROW-CELL-LABEL-ABSENT/);
  assert.match(
    writer.code,
    /TABLE-COMPONENT-PROPERTY-REFERENCES-INSTANCE-SUBLAYER/,
  );
  assert.equal(writer.code.includes("labels[0].componentPropertyReferences"), false);
  assert.equal(writer.code.includes("componentPropertyReferences={[labelKey]"), false);
  assert.equal(/componentPropertyReferences=\{\[/.test(writer.code), false);
  assert.match(writer.code, /addComponentProperty\("Label","TEXT"/);
  assert.match(writer.code, /addComponentProperty\("Column","TEXT"/);
  assert.match(writer.code, /addComponentProperty\("Align","TEXT"/);
  assert.match(writer.code, /addComponentProperty\("Cell 0","TEXT"/);
  assert.match(writer.code, /addComponentProperty\("Cell 1","TEXT"/);
  assert.match(writer.code, /addComponentProperty\("Cell 2","TEXT"/);
  assert.match(writer.code, /TABLE-CELL-SOURCE-ABSENT/);
  assert.match(writer.code, /TABLE-ROW-SOURCE-ABSENT/);
  assert.equal(writer.code.includes("node.letterSpacing"), false);
  assert.equal(writer.code.includes("node.textCase"), false);
  assert.equal(writer.code.includes("node.textDecoration"), false);
  assert.equal(writer.code.includes("figma_arrange_component_set"), false);
  assert.match(writer.code, /TABLE-INPUT-IDENTITY-REUSE/);
  assert.match(writer.code, /TABLE-COMBOBOX-IDENTITY-REUSE/);
  assert.match(writer.code, /TABLE-MUST-NOT-WRITE-INPUT-PAGE/);
  assert.match(writer.code, /TABLE-MUST-NOT-WRITE-COMBOBOX-PAGE/);
});

test("Table writer planted structure and API plans fail closed", async () => {
  const writer = emitTableFigmaWriter(inputs());
  const omitted = structuredClone(writer.sourcePlans);
  walkStripRole(omitted[0]!.tableSet, "table/header");
  assert.match(
    validateTableFigmaSourcePlans(omitted).join("\n"),
    /missing table\/header/,
  );
  const zeroVariables = structuredClone(writer.sourcePlans);
  zeroVariables[0]!.variables = [];
  assert.match(
    validateTableFigmaSourcePlans(zeroVariables).join("\n"),
    /variables denominator is zero/,
  );
  const plantedApi = writer.code.replace(
    "figma.createText()",
    "figma.createImaginaryText()",
  );
  assert.notEqual(plantedApi, writer.code);
  const conformance = await validateFigmaWriterConformance(plantedApi, {
    variants: TABLE_FIGMA_VARIANT_COUNT,
    writerVersion: 1,
    requiredMarkers: ["TABLE-TEXT-GEOMETRY", "TABLE-FAKE-LAYOUT"],
  });
  assert.equal(conformance.ok, false);
  assert.match(conformance.failures.join("\n"), /createImaginaryText/);
});

test("Table writer mock-mints 20 variants under a Table identity", async () => {
  const writer = emitTableFigmaWriter(inputs());
  const conformance = await validateFigmaWriterConformance(writer.code, {
    variants: TABLE_FIGMA_VARIANT_COUNT,
    writerVersion: 1,
    requiredMarkers: [
      "TABLE-TEXT-GEOMETRY",
      "TABLE-FAKE-LAYOUT",
      "TABLE-WRITER-FIRST-SEGMENT-BIND",
      "TABLE-WRITER-HIDDEN-FILL-OCCUPANCY",
      "TABLE-WRITER-CELL-PROPERTIES",
      "TABLE-WRITER-ROW-PROPERTIES",
      "TABLE-WRITER-ROW-OWNED-TEXT-CHARACTERS",
      "TABLE-ROW-OWNED-TEXT-ABSENT",
      "TABLE-ROW-CELL-LABEL-ABSENT",
      "TABLE-COMPONENT-PROPERTY-REFERENCES-INSTANCE-SUBLAYER",
      "TABLE-WRITER-MIN-WIDTH-ZERO-UNSET",
    ],
  });
  assert.equal(conformance.ok, true, conformance.failures.join("\n"));
  assert.equal(conformance.result?.namespace, TABLE_FIGMA_NAMESPACE);
  assert.equal(
    conformance.result?.runIdentity.endsWith(TABLE_FIGMA_RUN_SUFFIX),
    true,
  );
  assert.equal(conformance.result?.pageId === FORBIDDEN_INPUT_PAGE_ID, false);
  assert.equal(conformance.result?.pageId === FORBIDDEN_COMBOBOX_PAGE_ID, false);
  assert.equal(
    Array.isArray(conformance.result?.sources) &&
      conformance.result.sources.every(
        (source: { variantCount?: number; instanceCount?: number }) =>
          source.variantCount === 10 &&
          source.instanceCount === TABLE_FIGMA_INSTANCES_PER_SOURCE,
      ),
    true,
  );
});
