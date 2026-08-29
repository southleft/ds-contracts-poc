import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { adaptReviewedTable } from "./adapters/table.js";
import {
  firstPartyTableAdapterConfig,
  firstPartyTableSource,
} from "./fixtures/library-tables.js";
import { compileTableRecipe } from "./recipes/table.js";
import {
  TABLE_LIVE_V1_BINDING_COMPILE_ORDER_MARKER,
  TABLE_LIVE_V1_COLLAPSE_OMIT_INVENTED_OPACITY_MARKER,
  TABLE_LIVE_V1_OCCUPANCY_OPACITY_MARKER,
  TABLE_LIVE_V1_OMIT_EMPTY_INSTANCE_PAYLOAD_MARKER,
  TABLE_LIVE_V1_OMIT_TEXT_EXTRAS_MARKER,
  TABLE_LIVE_V1_PROJECT_LIVE_ROOT_OWNERSHIP_KEY_MARKER,
  TABLE_LIVE_V1_RECOVER_COMPONENT_PROPERTY_NAME_MARKER,
  TABLE_LIVE_V1_RECOVER_RECIPE_COMPONENT_REF_MARKER,
  TABLE_LIVE_V1_SET_CLIPS_CONTENT_OMITTED_MARKER,
  TABLE_LIVE_V1_SET_LAYOUT_COMPILE_CARRY_MARKER,
  TABLE_LIVE_V1_UNIFORM_PER_SIDE_STROKE_WEIGHT_MARKER,
  TABLE_LIVE_V1_CELL_INSTANCE_BINDING_EXTRAS_MARKER,
  TABLE_LIVE_V1_HEADER_BODY_CLIPS_CONTENT_OMITTED_MARKER,
  TABLE_LIVE_V1_HEADER_BODY_CORNER_RADIUS_OMITTED_MARKER,
  TABLE_LIVE_V1_WIDTH_HEIGHT_LAYOUT_ALIAS_MARKER,
  sceneToNormalizedIr,
  type SceneNodeSnapshot,
} from "./scene-readback-table-v1.js";
import type { IRNode } from "./figma-ir.js";

test("table host-normalize is table-shaped and does not copy Combobox roles", () => {
  const host = readFileSync("recipe/scene-readback-table-v1.ts", "utf8");
  assert.match(host, new RegExp(TABLE_LIVE_V1_PROJECT_LIVE_ROOT_OWNERSHIP_KEY_MARKER));
  assert.match(host, new RegExp(TABLE_LIVE_V1_RECOVER_RECIPE_COMPONENT_REF_MARKER));
  assert.match(host, new RegExp(TABLE_LIVE_V1_RECOVER_COMPONENT_PROPERTY_NAME_MARKER));
  assert.match(host, new RegExp(TABLE_LIVE_V1_OMIT_EMPTY_INSTANCE_PAYLOAD_MARKER));
  assert.match(host, new RegExp(TABLE_LIVE_V1_BINDING_COMPILE_ORDER_MARKER));
  assert.match(host, new RegExp(TABLE_LIVE_V1_WIDTH_HEIGHT_LAYOUT_ALIAS_MARKER));
  assert.match(host, new RegExp(TABLE_LIVE_V1_OMIT_TEXT_EXTRAS_MARKER));
  assert.match(host, new RegExp(TABLE_LIVE_V1_OCCUPANCY_OPACITY_MARKER));
  assert.match(host, new RegExp(TABLE_LIVE_V1_COLLAPSE_OMIT_INVENTED_OPACITY_MARKER));
  assert.match(host, new RegExp(TABLE_LIVE_V1_SET_LAYOUT_COMPILE_CARRY_MARKER));
  assert.match(host, new RegExp(TABLE_LIVE_V1_SET_CLIPS_CONTENT_OMITTED_MARKER));
  assert.match(host, new RegExp(TABLE_LIVE_V1_UNIFORM_PER_SIDE_STROKE_WEIGHT_MARKER));
  assert.match(host, new RegExp(TABLE_LIVE_V1_CELL_INSTANCE_BINDING_EXTRAS_MARKER));
  assert.match(host, new RegExp(TABLE_LIVE_V1_HEADER_BODY_CLIPS_CONTENT_OMITTED_MARKER));
  assert.match(host, new RegExp(TABLE_LIVE_V1_HEADER_BODY_CORNER_RADIUS_OMITTED_MARKER));
  assert.match(host, /table@1\/cell/);
  assert.match(host, /table@1\/row/);
  assert.match(host, /rootOwnershipKey/);
  assert.doesNotMatch(host, /combobox\/overlay/);
  assert.doesNotMatch(host, /combobox\/option-set/);
  assert.doesNotMatch(host, /Choose a person/);
  assert.doesNotMatch(host, /if \(polaris\)/);
  assert.doesNotMatch(host, /9\/30\/0/);
});

const tableVariantScene = (
  boundVariables: SceneNodeSnapshot["boundVariables"],
  role = "table/variant/comfortable",
): SceneNodeSnapshot => ({
  ownershipKey: "table/children/1",
  type: "COMPONENT",
  name: role,
  semanticRole: role,
  width: 320,
  height: 120,
  visible: true,
  opacity: 1,
  boundVariables,
  children: [],
});

const uniformFigmaPerSideStrokeBindings = (
  variableName: string,
): SceneNodeSnapshot["boundVariables"] =>
  (
    [
      "strokeTopWeight",
      "strokeRightWeight",
      "strokeBottomWeight",
      "strokeLeftWeight",
    ] as const
  ).map((field) => ({
    field,
    variableName,
    resolvedType: "FLOAT" as const,
  }));

test("host folds uniform per-side stroke weight binds into strokes.0.weight", () => {
  const ir = sceneToNormalizedIr(
    tableVariantScene(
      uniformFigmaPerSideStrokeBindings("ds.table.frameBorderWidth"),
    ),
  );
  const weight = (ir.bindings ?? []).filter(
    (binding) => binding.field === "strokes.0.weight",
  );
  assert.equal(weight.length, 1);
  assert.equal(weight[0]?.variable, "ds.table.frameBorderWidth");
  assert.equal(weight[0]?.type, "FLOAT");
  assert.equal(
    (ir.bindings ?? []).some((binding) =>
      binding.field.startsWith("strokes.0.weight."),
    ),
    false,
  );
  const cell = sceneToNormalizedIr(
    tableVariantScene(
      uniformFigmaPerSideStrokeBindings("ds.table.cellRuleWidth"),
      "table/cell/comfortable/header",
    ),
  );
  assert.equal(
    (cell.bindings ?? []).find((binding) => binding.field === "strokes.0.weight")
      ?.variable,
    "ds.table.cellRuleWidth",
  );
});

test("host does not invent strokes.0.weight when per-side variables differ", () => {
  const ir = sceneToNormalizedIr(
    tableVariantScene([
      {
        field: "strokeTopWeight",
        variableName: "ds.table.frameBorderWidth",
        resolvedType: "FLOAT",
      },
      {
        field: "strokeRightWeight",
        variableName: "ds.table.cellRuleWidth",
        resolvedType: "FLOAT",
      },
      {
        field: "strokeBottomWeight",
        variableName: "ds.table.frameBorderWidth",
        resolvedType: "FLOAT",
      },
      {
        field: "strokeLeftWeight",
        variableName: "ds.table.frameBorderWidth",
        resolvedType: "FLOAT",
      },
    ]),
  );
  assert.equal(
    (ir.bindings ?? []).some((binding) => binding.field === "strokes.0.weight"),
    false,
  );
});

const copiedCellInstanceBindings = (): SceneNodeSnapshot["boundVariables"] => [
  {
    field: "minWidth",
    variableName: "ds.table.cellMinWidthComfortable",
    resolvedType: "FLOAT",
  },
  {
    field: "paddingBottom",
    variableName: "ds.table.cellPaddingYComfortable",
    resolvedType: "FLOAT",
  },
  {
    field: "paddingLeft",
    variableName: "ds.table.cellPaddingXComfortable",
    resolvedType: "FLOAT",
  },
  {
    field: "paddingRight",
    variableName: "ds.table.cellPaddingXComfortable",
    resolvedType: "FLOAT",
  },
  {
    field: "paddingTop",
    variableName: "ds.table.cellPaddingYComfortable",
    resolvedType: "FLOAT",
  },
  {
    field: "strokes.0",
    variableName: "ds.table.cellRule",
    resolvedType: "COLOR",
  },
  ...uniformFigmaPerSideStrokeBindings("ds.table.cellRuleWidth"),
];

const cellInstanceScene = (
  role: string,
): SceneNodeSnapshot => ({
  ownershipKey: role,
  type: "INSTANCE",
  name: role,
  semanticRole: role,
  width: 80,
  height: 32,
  visible: true,
  opacity: 1,
  componentRef: "Cell",
  componentProperties: {
    Density: "comfortable",
    Kind: role.includes("header") ? "header" : "body",
    Label: "Name",
    Column: "name",
    Align: "start",
  },
  boundVariables: copiedCellInstanceBindings(),
  children: [],
});

test("host omits Figma-copied bindings on header-cell-instance and cell-instance", () => {
  const header = sceneToNormalizedIr(
    cellInstanceScene("table/header-cell-instance/0"),
  );
  const body = sceneToNormalizedIr(cellInstanceScene("table/cell-instance/0"));
  assert.equal(header.kind, "instance");
  assert.equal(body.kind, "instance");
  assert.equal("bindings" in header, false);
  assert.equal("bindings" in body, false);
  assert.equal(header.componentRef, "table@1/cell");
  assert.equal(body.componentRef, "table@1/cell");
});

const headerBodyFrameScene = (
  role: "table/header" | "table/body",
  clipsContent: boolean,
): SceneNodeSnapshot => ({
  ownershipKey: role,
  type: "FRAME",
  name: role === "table/header" ? "Header" : "Body",
  semanticRole: role,
  width: 320,
  height: 40,
  visible: true,
  opacity: 1,
  clipsContent,
  boundVariables: [],
  children: [],
});

test("host omits clipsContent on table/header and table/body that compile never emits", () => {
  const header = sceneToNormalizedIr(headerBodyFrameScene("table/header", true));
  const body = sceneToNormalizedIr(headerBodyFrameScene("table/body", true));
  assert.equal(header.kind, "frame");
  assert.equal(body.kind, "frame");
  assert.equal("clipsContent" in header, false);
  assert.equal("clipsContent" in body, false);
  const variant = sceneToNormalizedIr({
    ...tableVariantScene([]),
    clipsContent: false,
  });
  assert.equal(variant.kind, "component");
  assert.equal("clipsContent" in variant, true);
  assert.equal(
    (variant as { clipsContent?: boolean }).clipsContent,
    false,
  );
});

const zeroCornerRadius = {
  topLeft: 0,
  topRight: 0,
  bottomRight: 0,
  bottomLeft: 0,
} as const;

const byRole = (node: IRNode, role: string): IRNode[] => {
  const matches = node.role === role ? [node] : [];
  if (
    node.kind === "frame" ||
    node.kind === "component" ||
    node.kind === "component-set"
  ) {
    for (const child of node.children) matches.push(...byRole(child, role));
  }
  return matches;
};

test("host omits cornerRadius on table/header and table/body that compile never emits", () => {
  const header = sceneToNormalizedIr({
    ...headerBodyFrameScene("table/header", true),
    cornerRadius: { ...zeroCornerRadius },
  });
  const body = sceneToNormalizedIr({
    ...headerBodyFrameScene("table/body", true),
    cornerRadius: { ...zeroCornerRadius },
  });
  assert.equal(header.kind, "frame");
  assert.equal(body.kind, "frame");
  assert.equal("cornerRadius" in header, false);
  assert.equal("cornerRadius" in body, false);
  const compile = compileTableRecipe(
    adaptReviewedTable(firstPartyTableSource, firstPartyTableAdapterConfig),
  );
  const compileHeader = byRole(compile.ir, "table/header")[0];
  const compileBody = byRole(compile.ir, "table/body")[0];
  const compileVariant = byRole(compile.ir, "table/variant/comfortable")[0];
  assert.equal(compileHeader !== undefined, true);
  assert.equal(compileBody !== undefined, true);
  assert.equal(compileVariant !== undefined, true);
  assert.equal("cornerRadius" in (compileHeader ?? {}), false);
  assert.equal("cornerRadius" in (compileBody ?? {}), false);
  assert.equal("cornerRadius" in (compileVariant ?? {}), true);
  assert.deepEqual(
    (compileVariant as { cornerRadius?: typeof zeroCornerRadius }).cornerRadius,
    { topLeft: 8, topRight: 8, bottomRight: 8, bottomLeft: 8 },
  );
  const variant = sceneToNormalizedIr({
    ...tableVariantScene([]),
    cornerRadius: { topLeft: 8, topRight: 8, bottomRight: 8, bottomLeft: 8 },
  });
  assert.equal(variant.kind, "component");
  assert.equal("cornerRadius" in variant, true);
  assert.deepEqual(
    (variant as { cornerRadius?: typeof zeroCornerRadius }).cornerRadius,
    { topLeft: 8, topRight: 8, bottomRight: 8, bottomLeft: 8 },
  );
});

test("table probe is table-shaped: header/body/label, HUG, no overlay AABB", () => {
  const contract = readFileSync("recipe/table-live-v1-contract.ts", "utf8");
  assert.match(contract, /table\/header/);
  assert.match(contract, /table\/body/);
  assert.match(contract, /table\/cell\/label/);
  assert.match(contract, /contentHugPassed/);
  assert.match(contract, /TABLE-PROBE-EXCLUDE-OPACITY-ZERO-OCCUPANCY-OVERLAP/);
  assert.match(contract, /TABLE-PROBE-KEEP-EXACT-SCENE-RESTORATION-AFTER-DENSITY-WALK/);
  assert.doesNotMatch(contract, /contentFillPassed/);
  assert.doesNotMatch(contract, /combobox\/overlay/);
  assert.doesNotMatch(contract, /listbox/);
  assert.doesNotMatch(contract, /Choose a person/);
});
