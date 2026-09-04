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
  TABLE_LIVE_V1_ROW_INSTANCE_BINDING_EXTRAS_MARKER,
  TABLE_LIVE_V1_HEADER_BODY_CLIPS_CONTENT_OMITTED_MARKER,
  TABLE_LIVE_V1_VARIANT_CLIPS_CONTENT_OMITTED_MARKER,
  TABLE_LIVE_V1_ROW_VARIANT_CLIPS_CONTENT_OMITTED_MARKER,
  TABLE_LIVE_V1_HEADER_BODY_CORNER_RADIUS_OMITTED_MARKER,
  TABLE_LIVE_V1_ROW_VARIANT_CORNER_RADIUS_OMITTED_MARKER,
  TABLE_LIVE_V1_HEADER_BODY_EFFECTS_OMITTED_MARKER,
  TABLE_LIVE_V1_VARIANT_EFFECTS_OMITTED_MARKER,
  TABLE_LIVE_V1_HEADER_BODY_STROKES_OMITTED_MARKER,
  TABLE_LIVE_V1_VARIANT_EMPTY_STROKE_DASH_PATTERN_OMITTED_MARKER,
  TABLE_LIVE_V1_SET_CORNER_RADIUS_OMITTED_MARKER,
  TABLE_LIVE_V1_SET_EFFECTS_OMITTED_MARKER,
  TABLE_LIVE_V1_SET_STROKES_OMITTED_MARKER,
  TABLE_LIVE_V1_ROW_SET_COMPILE_CARRY_LABEL_MARKER,
  TABLE_LIVE_V1_ROW_SET_COMPILE_CARRY_LABEL,
  TABLE_LIVE_V1_WIDTH_HEIGHT_LAYOUT_ALIAS_MARKER,
  sceneToNormalizedIr,
  type SceneNodeSnapshot,
} from "./scene-readback-table-v1.js";
import type { IRNode } from "./figma-ir.js";

test("table host-normalize is table-shaped and does not copy Combobox roles", () => {
  const host = readFileSync("recipe/scene-readback-table-v1.ts", "utf8");
  assert.match(
    host,
    new RegExp(TABLE_LIVE_V1_PROJECT_LIVE_ROOT_OWNERSHIP_KEY_MARKER),
  );
  assert.match(
    host,
    new RegExp(TABLE_LIVE_V1_RECOVER_RECIPE_COMPONENT_REF_MARKER),
  );
  assert.match(
    host,
    new RegExp(TABLE_LIVE_V1_RECOVER_COMPONENT_PROPERTY_NAME_MARKER),
  );
  assert.match(
    host,
    new RegExp(TABLE_LIVE_V1_OMIT_EMPTY_INSTANCE_PAYLOAD_MARKER),
  );
  assert.match(host, new RegExp(TABLE_LIVE_V1_BINDING_COMPILE_ORDER_MARKER));
  assert.match(
    host,
    new RegExp(TABLE_LIVE_V1_WIDTH_HEIGHT_LAYOUT_ALIAS_MARKER),
  );
  assert.match(host, new RegExp(TABLE_LIVE_V1_OMIT_TEXT_EXTRAS_MARKER));
  assert.match(host, new RegExp(TABLE_LIVE_V1_OCCUPANCY_OPACITY_MARKER));
  assert.match(
    host,
    new RegExp(TABLE_LIVE_V1_COLLAPSE_OMIT_INVENTED_OPACITY_MARKER),
  );
  assert.match(host, new RegExp(TABLE_LIVE_V1_SET_LAYOUT_COMPILE_CARRY_MARKER));
  assert.match(
    host,
    new RegExp(TABLE_LIVE_V1_SET_CLIPS_CONTENT_OMITTED_MARKER),
  );
  assert.match(
    host,
    new RegExp(TABLE_LIVE_V1_UNIFORM_PER_SIDE_STROKE_WEIGHT_MARKER),
  );
  assert.match(
    host,
    new RegExp(TABLE_LIVE_V1_CELL_INSTANCE_BINDING_EXTRAS_MARKER),
  );
  assert.match(
    host,
    new RegExp(TABLE_LIVE_V1_ROW_INSTANCE_BINDING_EXTRAS_MARKER),
  );
  assert.match(
    host,
    new RegExp(TABLE_LIVE_V1_HEADER_BODY_CLIPS_CONTENT_OMITTED_MARKER),
  );
  assert.match(
    host,
    new RegExp(TABLE_LIVE_V1_VARIANT_CLIPS_CONTENT_OMITTED_MARKER),
  );
  assert.match(
    host,
    new RegExp(TABLE_LIVE_V1_ROW_VARIANT_CLIPS_CONTENT_OMITTED_MARKER),
  );
  assert.match(
    host,
    new RegExp(TABLE_LIVE_V1_HEADER_BODY_CORNER_RADIUS_OMITTED_MARKER),
  );
  assert.match(
    host,
    new RegExp(TABLE_LIVE_V1_ROW_VARIANT_CORNER_RADIUS_OMITTED_MARKER),
  );
  assert.match(
    host,
    new RegExp(TABLE_LIVE_V1_HEADER_BODY_EFFECTS_OMITTED_MARKER),
  );
  assert.match(host, new RegExp(TABLE_LIVE_V1_VARIANT_EFFECTS_OMITTED_MARKER));
  assert.match(
    host,
    new RegExp(TABLE_LIVE_V1_HEADER_BODY_STROKES_OMITTED_MARKER),
  );
  assert.match(
    host,
    new RegExp(TABLE_LIVE_V1_VARIANT_EMPTY_STROKE_DASH_PATTERN_OMITTED_MARKER),
  );
  assert.match(
    host,
    new RegExp(TABLE_LIVE_V1_SET_CORNER_RADIUS_OMITTED_MARKER),
  );
  assert.match(host, new RegExp(TABLE_LIVE_V1_SET_EFFECTS_OMITTED_MARKER));
  assert.match(host, new RegExp(TABLE_LIVE_V1_SET_STROKES_OMITTED_MARKER));
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

test("a cell that draws ONE edge reads back as one edge, with no uniform weight to fold", () => {
  // MUI's table cell is border-bottom 1px and 0 on the other three sides, and
  // Figma deletes the uniform strokeWeight property the moment the sides
  // differ — the canvas returns four per-side weights and no uniform one.
  // The read-back must carry those values (sideWeights) and take the recipe's
  // uniform weight from a side the cell actually draws, or the collapse
  // refuses a binding the writer never wrote.
  const scene = {
    ...tableVariantScene(
      (["strokeTopWeight", "strokeRightWeight", "strokeBottomWeight", "strokeLeftWeight"] as const).map((field) => ({
        field,
        variableName: field === "strokeBottomWeight" ? "mui.table.cellRuleWidth" : `mui.table.cellRuleSides-${field.replace("stroke", "").replace("Weight", "").toLowerCase()}`,
        resolvedType: "FLOAT" as const,
      })),
      "table/cell/comfortable/body",
    ),
    strokes: [{ type: "SOLID" as const, color: "#e0e0e0ff" }],
    strokeAlign: "INSIDE" as const,
    strokeTopWeight: 0,
    strokeRightWeight: 0,
    strokeBottomWeight: 1,
    strokeLeftWeight: 0,
  } as unknown as Parameters<typeof sceneToNormalizedIr>[0];
  const ir = sceneToNormalizedIr(scene);
  const stroke = (ir as { strokes?: Array<{ weight: number; sideWeights?: Record<string, number> }> }).strokes?.[0];
  assert.equal(stroke?.sideWeights?.bottom, 1);
  assert.equal(stroke?.sideWeights?.top, 0);
  assert.equal(stroke?.sideWeights?.right, 0);
  assert.equal(stroke?.sideWeights?.left, 0);
  // the uniform weight is the drawn side, not zero
  assert.equal(stroke?.weight, 1);
  // the four per-side bindings survive: their variables differ, so there is
  // nothing to fold, and no uniform binding is invented.
  const perSide = (ir.bindings ?? []).filter((binding) => binding.field.startsWith("strokes.0.weight."));
  assert.equal(perSide.length, 4);
  assert.equal((ir.bindings ?? []).filter((binding) => binding.field === "strokes.0.weight").length, 0);
});

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
    (cell.bindings ?? []).find(
      (binding) => binding.field === "strokes.0.weight",
    )?.variable,
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

const cellInstanceScene = (role: string): SceneNodeSnapshot => ({
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

const copiedRowInstanceBindings = (): SceneNodeSnapshot["boundVariables"] => [
  {
    field: "fills.0",
    variableName: "ds.table.rowStates-default-background",
    resolvedType: "COLOR",
  },
];

const rowInstanceScene = (): SceneNodeSnapshot => ({
  ownershipKey: "table/row-instance/0",
  type: "INSTANCE",
  name: "table/row-instance/0",
  semanticRole: "table/row-instance/0",
  width: 320,
  height: 32,
  visible: true,
  opacity: 1,
  componentRef: "Row",
  componentProperties: {
    Density: "comfortable",
    State: "default",
  },
  boundVariables: copiedRowInstanceBindings(),
  children: [],
});

const rowComponentScene = (): SceneNodeSnapshot => ({
  ownershipKey: "table/row/comfortable/default",
  type: "COMPONENT",
  name: "table/row/comfortable/default",
  semanticRole: "table/row/comfortable/default",
  width: 320,
  height: 32,
  visible: true,
  opacity: 1,
  boundVariables: copiedRowInstanceBindings(),
  children: [],
});

test("host omits Figma-copied bindings on row-instance; row components keep fills.0.color", () => {
  const instance = sceneToNormalizedIr(rowInstanceScene());
  const component = sceneToNormalizedIr(rowComponentScene());
  assert.equal(instance.kind, "instance");
  assert.equal(component.kind, "component");
  assert.equal("bindings" in instance, false);
  assert.equal(instance.componentRef, "table@1/row");
  const fill = (component.bindings ?? []).find(
    (binding) => binding.field === "fills.0.color",
  );
  assert.equal(fill?.variable, "ds.table.rowStates-default-background");
  assert.equal(fill?.type, "COLOR");
  const compile = compileTableRecipe(
    adaptReviewedTable(firstPartyTableSource, firstPartyTableAdapterConfig),
  );
  const compileRowInstance = byRole(compile.ir, "table/row-instance/0")[0];
  const compileRow = byRole(compile.ir, "table/row/comfortable/default")[0];
  assert.equal(compileRowInstance !== undefined, true);
  assert.equal(compileRow !== undefined, true);
  assert.equal("bindings" in (compileRowInstance ?? {}), false);
  assert.equal(
    (
      (compileRow as { bindings?: Array<{ field: string }> } | undefined)
        ?.bindings ?? []
    ).some((binding) => binding.field === "fills.0.color"),
    true,
  );
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
  const header = sceneToNormalizedIr(
    headerBodyFrameScene("table/header", true),
  );
  const body = sceneToNormalizedIr(headerBodyFrameScene("table/body", true));
  assert.equal(header.kind, "frame");
  assert.equal(body.kind, "frame");
  assert.equal("clipsContent" in header, false);
  assert.equal("clipsContent" in body, false);
});

test("host omits clipsContent on table/variant that compile never emits and keeps cornerRadius and strokes", () => {
  const compile = compileTableRecipe(
    adaptReviewedTable(firstPartyTableSource, firstPartyTableAdapterConfig),
  );
  const compileComfortable = byRole(compile.ir, "table/variant/comfortable")[0];
  const compileCompact = byRole(compile.ir, "table/variant/compact")[0];
  assert.equal(compileComfortable !== undefined, true);
  assert.equal(compileCompact !== undefined, true);
  assert.equal("clipsContent" in (compileComfortable ?? {}), false);
  assert.equal("clipsContent" in (compileCompact ?? {}), false);
  assert.equal("cornerRadius" in (compileComfortable ?? {}), true);
  assert.equal("strokes" in (compileComfortable ?? {}), true);
  const compileStrokes = (
    compileComfortable as {
      strokes?: Array<{
        weight: number;
        align: "inside" | "outside" | "center";
        paint: { kind: string; color?: string };
      }>;
    }
  ).strokes;
  assert.equal(Array.isArray(compileStrokes), true);
  assert.equal((compileStrokes?.length ?? 0) > 0, true);
  const compileStroke = compileStrokes?.[0];
  for (const role of [
    "table/variant/compact",
    "table/variant/comfortable",
  ] as const) {
    const variant = sceneToNormalizedIr({
      ...tableVariantScene([], role),
      clipsContent: false,
      cornerRadius: { topLeft: 8, topRight: 8, bottomRight: 8, bottomLeft: 8 },
      strokes: [{ type: "SOLID", color: compileStroke?.paint.color }],
      strokeWeight: compileStroke?.weight,
      strokeAlign: compileStroke?.align.toUpperCase() as
        "INSIDE" | "OUTSIDE" | "CENTER",
      effects: [],
    });
    assert.equal(variant.kind, "component");
    assert.equal("clipsContent" in variant, false);
    assert.equal("cornerRadius" in variant, true);
    assert.deepEqual(
      (variant as { cornerRadius?: typeof zeroCornerRadius }).cornerRadius,
      { topLeft: 8, topRight: 8, bottomRight: 8, bottomLeft: 8 },
    );
    assert.equal("strokes" in variant, true);
    assert.deepEqual(
      (variant as { strokes?: unknown[] }).strokes,
      compileStrokes,
    );
    assert.equal("effects" in variant, false);
  }
});

test("host omits clipsContent on table/row variants that compile never emits and keeps cell-variant clipsContent", () => {
  const compile = compileTableRecipe(
    adaptReviewedTable(firstPartyTableSource, firstPartyTableAdapterConfig),
  );
  const rowRoles = [
    "table/row/compact/default",
    "table/row/compact/selected",
    "table/row/comfortable/default",
    "table/row/comfortable/selected",
  ] as const;
  for (const role of rowRoles) {
    const compiled = byRole(compile.ir, role)[0];
    assert.equal(compiled !== undefined, true);
    assert.equal("clipsContent" in (compiled ?? {}), false);
    const observed = sceneToNormalizedIr({
      ...rowComponentScene(),
      ownershipKey: role,
      name: role,
      semanticRole: role,
      clipsContent: false,
    });
    assert.equal(observed.kind, "component");
    assert.equal("clipsContent" in observed, false);
  }
  const cell = sceneToNormalizedIr({
    ownershipKey: "table/cell/compact/body",
    type: "COMPONENT",
    name: "table/cell/compact/body",
    semanticRole: "table/cell/compact/body",
    width: 80,
    height: 32,
    visible: true,
    opacity: 1,
    clipsContent: false,
    boundVariables: [],
    children: [],
  });
  assert.equal(cell.kind, "component");
  // Taught after the v24 census measured compile omitting clipsContent on all
  // four table/cell variants (4 absent-left differences, both roots).
  assert.equal(
    "clipsContent" in cell,
    false,
    "cell variants omit clipsContent because compile omits it",
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

const hostDefaultSetCornerRadius = {
  topLeft: 5,
  topRight: 5,
  bottomRight: 5,
  bottomLeft: 5,
} as const;

const setScene = (
  role: "table/set" | "table/row-set" | "table/cell-set",
): SceneNodeSnapshot => ({
  ownershipKey: role,
  type: "COMPONENT_SET",
  name: role,
  semanticRole: role,
  width: 320,
  height: 120,
  visible: true,
  opacity: 1,
  cornerRadius: { ...hostDefaultSetCornerRadius },
  variantGroupProperties: {
    Density: { values: ["compact", "comfortable"] },
  },
  boundVariables: [],
  children: [
    {
      ...tableVariantScene([]),
      ownershipKey: `${role}/variant`,
    },
  ],
});

test("host omits effects on table/set, table/row-set, and table/cell-set that compile never emits and keeps variant cornerRadius", () => {
  const compile = compileTableRecipe(
    adaptReviewedTable(firstPartyTableSource, firstPartyTableAdapterConfig),
  );
  const compileTableSet = byRole(compile.ir, "table/set")[0];
  const compileRowSet = byRole(compile.ir, "table/row-set")[0];
  const compileCellSet = byRole(compile.ir, "table/cell-set")[0];
  const compileVariant = byRole(compile.ir, "table/variant/comfortable")[0];
  assert.equal(compileTableSet !== undefined, true);
  assert.equal(compileRowSet !== undefined, true);
  assert.equal(compileCellSet !== undefined, true);
  assert.equal(compileVariant !== undefined, true);
  assert.equal("effects" in (compileTableSet ?? {}), false);
  assert.equal("effects" in (compileRowSet ?? {}), false);
  assert.equal("effects" in (compileCellSet ?? {}), false);
  assert.equal("cornerRadius" in (compileVariant ?? {}), true);
  assert.deepEqual(
    (compileVariant as { cornerRadius?: typeof zeroCornerRadius }).cornerRadius,
    { topLeft: 8, topRight: 8, bottomRight: 8, bottomLeft: 8 },
  );
  for (const role of [
    "table/set",
    "table/row-set",
    "table/cell-set",
  ] as const) {
    const set = sceneToNormalizedIr({
      ...setScene(role),
      effects: [],
    });
    assert.equal(set.kind, "component-set");
    assert.equal("effects" in set, false);
    assert.equal("cornerRadius" in set, false);
  }
  const variant = sceneToNormalizedIr({
    ...tableVariantScene([]),
    effects: [],
    cornerRadius: { topLeft: 8, topRight: 8, bottomRight: 8, bottomLeft: 8 },
  });
  assert.equal(variant.kind, "component");
  assert.equal("effects" in variant, false);
  assert.equal("cornerRadius" in variant, true);
  assert.deepEqual(
    (variant as { cornerRadius?: typeof zeroCornerRadius }).cornerRadius,
    { topLeft: 8, topRight: 8, bottomRight: 8, bottomLeft: 8 },
  );
});

test("host omits strokes on table/set, table/row-set, and table/cell-set that compile never emits and keeps variant strokes", () => {
  const compile = compileTableRecipe(
    adaptReviewedTable(firstPartyTableSource, firstPartyTableAdapterConfig),
  );
  const compileTableSet = byRole(compile.ir, "table/set")[0];
  const compileRowSet = byRole(compile.ir, "table/row-set")[0];
  const compileCellSet = byRole(compile.ir, "table/cell-set")[0];
  const compileVariant = byRole(compile.ir, "table/variant/comfortable")[0];
  assert.equal(compileTableSet !== undefined, true);
  assert.equal(compileRowSet !== undefined, true);
  assert.equal(compileCellSet !== undefined, true);
  assert.equal(compileVariant !== undefined, true);
  assert.equal("strokes" in (compileTableSet ?? {}), false);
  assert.equal("strokes" in (compileRowSet ?? {}), false);
  assert.equal("strokes" in (compileCellSet ?? {}), false);
  assert.equal("strokes" in (compileVariant ?? {}), true);
  assert.equal("cornerRadius" in (compileVariant ?? {}), true);
  const compileStrokes = (
    compileVariant as {
      strokes?: Array<{
        weight: number;
        align: "inside" | "outside" | "center";
        paint: { kind: string; color?: string };
      }>;
    }
  ).strokes;
  assert.equal(Array.isArray(compileStrokes), true);
  assert.equal((compileStrokes?.length ?? 0) > 0, true);
  const compileStroke = compileStrokes?.[0];
  for (const role of [
    "table/set",
    "table/row-set",
    "table/cell-set",
  ] as const) {
    const set = sceneToNormalizedIr({
      ...setScene(role),
      strokes: [],
    });
    assert.equal(set.kind, "component-set");
    assert.equal("strokes" in set, false);
    assert.equal("effects" in set, false);
    assert.equal("cornerRadius" in set, false);
  }
  const variant = sceneToNormalizedIr({
    ...tableVariantScene([]),
    strokes: [{ type: "SOLID", color: compileStroke?.paint.color }],
    strokeWeight: compileStroke?.weight,
    strokeAlign: compileStroke?.align.toUpperCase() as
      "INSIDE" | "OUTSIDE" | "CENTER",
    cornerRadius: { topLeft: 8, topRight: 8, bottomRight: 8, bottomLeft: 8 },
  });
  assert.equal(variant.kind, "component");
  assert.equal("strokes" in variant, true);
  assert.deepEqual(
    (variant as { strokes?: unknown[] }).strokes,
    compileStrokes,
  );
  assert.equal("cornerRadius" in variant, true);
  assert.deepEqual(
    (variant as { cornerRadius?: typeof zeroCornerRadius }).cornerRadius,
    { topLeft: 8, topRight: 8, bottomRight: 8, bottomLeft: 8 },
  );
});

test("host omits cornerRadius on table/set, table/row-set, and table/cell-set that compile never emits and keeps variant cornerRadius", () => {
  const compile = compileTableRecipe(
    adaptReviewedTable(firstPartyTableSource, firstPartyTableAdapterConfig),
  );
  const compileTableSet = byRole(compile.ir, "table/set")[0];
  const compileRowSet = byRole(compile.ir, "table/row-set")[0];
  const compileCellSet = byRole(compile.ir, "table/cell-set")[0];
  const compileVariant = byRole(compile.ir, "table/variant/comfortable")[0];
  assert.equal(compileTableSet !== undefined, true);
  assert.equal(compileRowSet !== undefined, true);
  assert.equal(compileCellSet !== undefined, true);
  assert.equal(compileVariant !== undefined, true);
  assert.equal("cornerRadius" in (compileTableSet ?? {}), false);
  assert.equal("cornerRadius" in (compileRowSet ?? {}), false);
  assert.equal("cornerRadius" in (compileCellSet ?? {}), false);
  assert.equal("cornerRadius" in (compileVariant ?? {}), true);
  assert.deepEqual(
    (compileVariant as { cornerRadius?: typeof zeroCornerRadius }).cornerRadius,
    { topLeft: 8, topRight: 8, bottomRight: 8, bottomLeft: 8 },
  );
  for (const role of [
    "table/set",
    "table/row-set",
    "table/cell-set",
  ] as const) {
    const set = sceneToNormalizedIr(setScene(role));
    assert.equal(set.kind, "component-set");
    assert.equal("cornerRadius" in set, false);
  }
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

test("host omits cornerRadius on table/row variants that compile never emits and keeps table/variant cornerRadius", () => {
  const compile = compileTableRecipe(
    adaptReviewedTable(firstPartyTableSource, firstPartyTableAdapterConfig),
  );
  const rowRoles = [
    "table/row/compact/default",
    "table/row/compact/selected",
    "table/row/comfortable/default",
    "table/row/comfortable/selected",
  ] as const;
  for (const role of rowRoles) {
    const compiled = byRole(compile.ir, role)[0];
    assert.equal(compiled !== undefined, true);
    assert.equal("cornerRadius" in (compiled ?? {}), false);
    const observed = sceneToNormalizedIr({
      ...rowComponentScene(),
      ownershipKey: role,
      name: role,
      semanticRole: role,
      cornerRadius: { ...zeroCornerRadius },
    });
    assert.equal(observed.kind, "component");
    assert.equal("cornerRadius" in observed, false);
  }
  const compileVariant = byRole(compile.ir, "table/variant/comfortable")[0];
  assert.equal(compileVariant !== undefined, true);
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

test("host omits effects on table/row variants that compile never emits and keeps table/variant cornerRadius", () => {
  const compile = compileTableRecipe(
    adaptReviewedTable(firstPartyTableSource, firstPartyTableAdapterConfig),
  );
  const rowRoles = [
    "table/row/compact/default",
    "table/row/compact/selected",
    "table/row/comfortable/default",
    "table/row/comfortable/selected",
  ] as const;
  for (const role of rowRoles) {
    const compiled = byRole(compile.ir, role)[0];
    assert.equal(compiled !== undefined, true);
    assert.equal("effects" in (compiled ?? {}), false);
    const observed = sceneToNormalizedIr({
      ...rowComponentScene(),
      ownershipKey: role,
      name: role,
      semanticRole: role,
      effects: [],
    });
    assert.equal(observed.kind, "component");
    assert.equal("effects" in observed, false);
  }
  const compileVariant = byRole(compile.ir, "table/variant/comfortable")[0];
  assert.equal(compileVariant !== undefined, true);
  assert.equal("cornerRadius" in (compileVariant ?? {}), true);
  assert.deepEqual(
    (compileVariant as { cornerRadius?: typeof zeroCornerRadius }).cornerRadius,
    { topLeft: 8, topRight: 8, bottomRight: 8, bottomLeft: 8 },
  );
  const variant = sceneToNormalizedIr({
    ...tableVariantScene([]),
    cornerRadius: { topLeft: 8, topRight: 8, bottomRight: 8, bottomLeft: 8 },
    effects: [],
  });
  assert.equal(variant.kind, "component");
  assert.equal("cornerRadius" in variant, true);
  assert.deepEqual(
    (variant as { cornerRadius?: typeof zeroCornerRadius }).cornerRadius,
    { topLeft: 8, topRight: 8, bottomRight: 8, bottomLeft: 8 },
  );
  assert.equal("effects" in variant, false);
});

test("host omits strokes on table/row variants that compile never emits and keeps table/variant strokes", () => {
  const compile = compileTableRecipe(
    adaptReviewedTable(firstPartyTableSource, firstPartyTableAdapterConfig),
  );
  const rowRoles = [
    "table/row/compact/default",
    "table/row/compact/selected",
    "table/row/comfortable/default",
    "table/row/comfortable/selected",
  ] as const;
  for (const role of rowRoles) {
    const compiled = byRole(compile.ir, role)[0];
    assert.equal(compiled !== undefined, true);
    assert.equal("strokes" in (compiled ?? {}), false);
    const observed = sceneToNormalizedIr({
      ...rowComponentScene(),
      ownershipKey: role,
      name: role,
      semanticRole: role,
      strokes: [],
    });
    assert.equal(observed.kind, "component");
    assert.equal("strokes" in observed, false);
  }
  const compileVariant = byRole(compile.ir, "table/variant/comfortable")[0];
  assert.equal(compileVariant !== undefined, true);
  assert.equal("strokes" in (compileVariant ?? {}), true);
  const variant = sceneToNormalizedIr({
    ...tableVariantScene([]),
    strokes: [{ type: "SOLID", color: "#e5e7ebff" }],
  });
  assert.equal(variant.kind, "component");
  assert.equal("strokes" in variant, true);
});

test("set names carry the compile label, so the generic after-:: rule derives it", () => {
  const compile = compileTableRecipe(
    adaptReviewedTable(firstPartyTableSource, firstPartyTableAdapterConfig),
  );
  const compileRowSet = byRole(compile.ir, "table/row-set")[0];
  const compileCellSet = byRole(compile.ir, "table/cell-set")[0];
  const compileTableSet = byRole(compile.ir, "table/set")[0];
  assert.equal(
    (compileRowSet as { label?: string } | undefined)?.label,
    "Table row",
  );
  assert.equal(
    (compileCellSet as { label?: string } | undefined)?.label,
    "Table cell",
  );
  assert.equal(
    (compileTableSet as { label?: string } | undefined)?.label,
    "Table",
  );

  // The writer now names each set `<role> :: <compile label>`
  // (TABLE-WRITER-SET-NAME-CARRIES-COMPILE-LABEL), so host-normalize needs no
  // per-role label override: the generic after-`::` rule already agrees with
  // compile. Table live v25 proved the override alone was not enough -- the IR
  // diff went to zero while independent root accounting still refused on the
  // live node NAME, twice per root.
  const rowLive = sceneToNormalizedIr({
    ...setScene("table/row-set"),
    name: "table/row-set :: Table row",
  });
  assert.equal(rowLive.label, "Table row");
  const cellLive = sceneToNormalizedIr({
    ...setScene("table/cell-set"),
    name: "table/cell-set :: Table cell",
  });
  assert.equal(cellLive.label, "Table cell");
  const tableLive = sceneToNormalizedIr({
    ...setScene("table/set"),
    name: "table/set :: Table",
  });
  assert.equal(tableLive.label, "Table");

  // No override remains: a set named with the OLD writer's source display name
  // now derives that name verbatim rather than being silently patched. That is
  // what makes the writer defect visible instead of hidden.
  const staleRowLive = sceneToNormalizedIr({
    ...setScene("table/row-set"),
    name: "table/row-set :: Table",
  });
  assert.equal(
    staleRowLive.label,
    "Table",
    "an old-writer name must NOT be silently patched to the compile label",
  );
});

test("host omits effects on table/header and table/body that compile never emits", () => {
  const header = sceneToNormalizedIr({
    ...headerBodyFrameScene("table/header", true),
    effects: [],
  });
  const body = sceneToNormalizedIr({
    ...headerBodyFrameScene("table/body", true),
    effects: [],
  });
  assert.equal(header.kind, "frame");
  assert.equal(body.kind, "frame");
  assert.equal("effects" in header, false);
  assert.equal("effects" in body, false);
  const compile = compileTableRecipe(
    adaptReviewedTable(firstPartyTableSource, firstPartyTableAdapterConfig),
  );
  const compileHeader = byRole(compile.ir, "table/header")[0];
  const compileBody = byRole(compile.ir, "table/body")[0];
  const compileVariant = byRole(compile.ir, "table/variant/comfortable")[0];
  assert.equal(compileHeader !== undefined, true);
  assert.equal(compileBody !== undefined, true);
  assert.equal(compileVariant !== undefined, true);
  assert.equal("effects" in (compileHeader ?? {}), false);
  assert.equal("effects" in (compileBody ?? {}), false);
  assert.equal("effects" in (compileVariant ?? {}), false);
  const variant = sceneToNormalizedIr({
    ...tableVariantScene([]),
    effects: [],
  });
  assert.equal(variant.kind, "component");
  assert.equal("effects" in variant, false);
});

test("host omits effects on table/variant that compile never emits and keeps cornerRadius and strokes", () => {
  const compile = compileTableRecipe(
    adaptReviewedTable(firstPartyTableSource, firstPartyTableAdapterConfig),
  );
  const compileComfortable = byRole(compile.ir, "table/variant/comfortable")[0];
  const compileCompact = byRole(compile.ir, "table/variant/compact")[0];
  assert.equal(compileComfortable !== undefined, true);
  assert.equal(compileCompact !== undefined, true);
  assert.equal("effects" in (compileComfortable ?? {}), false);
  assert.equal("effects" in (compileCompact ?? {}), false);
  assert.equal("cornerRadius" in (compileComfortable ?? {}), true);
  assert.equal("strokes" in (compileComfortable ?? {}), true);
  const compileStrokes = (
    compileComfortable as {
      strokes?: Array<{
        weight: number;
        align: "inside" | "outside" | "center";
        paint: { kind: string; color?: string };
      }>;
    }
  ).strokes;
  assert.equal(Array.isArray(compileStrokes), true);
  assert.equal((compileStrokes?.length ?? 0) > 0, true);
  const compileStroke = compileStrokes?.[0];
  for (const role of [
    "table/variant/compact",
    "table/variant/comfortable",
  ] as const) {
    const variant = sceneToNormalizedIr({
      ...tableVariantScene([], role),
      effects: [],
      cornerRadius: { topLeft: 8, topRight: 8, bottomRight: 8, bottomLeft: 8 },
      strokes: [{ type: "SOLID", color: compileStroke?.paint.color }],
      strokeWeight: compileStroke?.weight,
      strokeAlign: compileStroke?.align.toUpperCase() as
        "INSIDE" | "OUTSIDE" | "CENTER",
    });
    assert.equal(variant.kind, "component");
    assert.equal("effects" in variant, false);
    assert.equal("cornerRadius" in variant, true);
    assert.deepEqual(
      (variant as { cornerRadius?: typeof zeroCornerRadius }).cornerRadius,
      { topLeft: 8, topRight: 8, bottomRight: 8, bottomLeft: 8 },
    );
    assert.equal("strokes" in variant, true);
    assert.deepEqual(
      (variant as { strokes?: unknown[] }).strokes,
      compileStrokes,
    );
  }
});

test("host omits empty dashPattern on table/variant strokes that compile never emits and keeps strokes and cornerRadius", () => {
  const compile = compileTableRecipe(
    adaptReviewedTable(firstPartyTableSource, firstPartyTableAdapterConfig),
  );
  const compileComfortable = byRole(compile.ir, "table/variant/comfortable")[0];
  const compileCompact = byRole(compile.ir, "table/variant/compact")[0];
  assert.equal(compileComfortable !== undefined, true);
  assert.equal(compileCompact !== undefined, true);
  const compileStrokes = (
    compileComfortable as {
      strokes?: Array<{
        weight: number;
        align: "inside" | "outside" | "center";
        paint: { kind: string; color?: string };
        dashPattern?: number[];
      }>;
    }
  ).strokes;
  assert.equal(Array.isArray(compileStrokes), true);
  assert.equal((compileStrokes?.length ?? 0) > 0, true);
  assert.equal("dashPattern" in (compileStrokes?.[0] ?? {}), false);
  assert.equal("cornerRadius" in (compileComfortable ?? {}), true);
  assert.equal("strokes" in (compileComfortable ?? {}), true);
  const compileStroke = compileStrokes?.[0];
  for (const role of [
    "table/variant/compact",
    "table/variant/comfortable",
  ] as const) {
    const variant = sceneToNormalizedIr({
      ...tableVariantScene([], role),
      dashPattern: [],
      cornerRadius: { topLeft: 8, topRight: 8, bottomRight: 8, bottomLeft: 8 },
      strokes: [{ type: "SOLID", color: compileStroke?.paint.color }],
      strokeWeight: compileStroke?.weight,
      strokeAlign: compileStroke?.align.toUpperCase() as
        "INSIDE" | "OUTSIDE" | "CENTER",
      effects: [],
    });
    assert.equal(variant.kind, "component");
    assert.equal("strokes" in variant, true);
    assert.equal("cornerRadius" in variant, true);
    assert.deepEqual(
      (variant as { cornerRadius?: typeof zeroCornerRadius }).cornerRadius,
      { topLeft: 8, topRight: 8, bottomRight: 8, bottomLeft: 8 },
    );
    const observedStrokes = (
      variant as {
        strokes?: Array<{
          weight: number;
          align: string;
          paint: unknown;
          dashPattern?: number[];
        }>;
      }
    ).strokes;
    assert.equal(Array.isArray(observedStrokes), true);
    assert.equal((observedStrokes?.length ?? 0) > 0, true);
    assert.equal("dashPattern" in (observedStrokes?.[0] ?? {}), false);
    assert.deepEqual(observedStrokes, compileStrokes);
  }
  const nonempty = sceneToNormalizedIr({
    ...tableVariantScene([], "table/variant/comfortable"),
    dashPattern: [2, 2],
    strokes: [{ type: "SOLID", color: compileStroke?.paint.color }],
    strokeWeight: compileStroke?.weight,
    strokeAlign: compileStroke?.align.toUpperCase() as
      "INSIDE" | "OUTSIDE" | "CENTER",
  });
  assert.deepEqual(
    (
      nonempty as {
        strokes?: Array<{ dashPattern?: number[] }>;
      }
    ).strokes?.[0]?.dashPattern,
    [2, 2],
  );
});

test("host omits strokes on table/header and table/body that compile never emits", () => {
  const header = sceneToNormalizedIr({
    ...headerBodyFrameScene("table/header", true),
    strokes: [],
  });
  const body = sceneToNormalizedIr({
    ...headerBodyFrameScene("table/body", true),
    strokes: [],
  });
  assert.equal(header.kind, "frame");
  assert.equal(body.kind, "frame");
  assert.equal("strokes" in header, false);
  assert.equal("strokes" in body, false);
  const compile = compileTableRecipe(
    adaptReviewedTable(firstPartyTableSource, firstPartyTableAdapterConfig),
  );
  const compileHeader = byRole(compile.ir, "table/header")[0];
  const compileBody = byRole(compile.ir, "table/body")[0];
  const compileVariant = byRole(compile.ir, "table/variant/comfortable")[0];
  assert.equal(compileHeader !== undefined, true);
  assert.equal(compileBody !== undefined, true);
  assert.equal(compileVariant !== undefined, true);
  assert.equal("strokes" in (compileHeader ?? {}), false);
  assert.equal("strokes" in (compileBody ?? {}), false);
  assert.equal("strokes" in (compileVariant ?? {}), true);
  const compileStrokes = (
    compileVariant as {
      strokes?: Array<{
        weight: number;
        align: "inside" | "outside" | "center";
        paint: { kind: string; color?: string };
      }>;
    }
  ).strokes;
  assert.equal(Array.isArray(compileStrokes), true);
  assert.equal((compileStrokes?.length ?? 0) > 0, true);
  const compileStroke = compileStrokes?.[0];
  assert.equal(compileStroke?.paint.kind, "solid");
  const variant = sceneToNormalizedIr({
    ...tableVariantScene([]),
    strokes: [{ type: "SOLID", color: compileStroke?.paint.color }],
    strokeWeight: compileStroke?.weight,
    strokeAlign: compileStroke?.align.toUpperCase() as
      "INSIDE" | "OUTSIDE" | "CENTER",
  });
  assert.equal(variant.kind, "component");
  assert.equal("strokes" in variant, true);
  assert.deepEqual(
    (variant as { strokes?: unknown[] }).strokes,
    compileStrokes,
  );
});

test("table probe is table-shaped: header/body/label, HUG, no overlay AABB", () => {
  const contract = readFileSync("recipe/table-live-v1-contract.ts", "utf8");
  assert.match(contract, /table\/header/);
  assert.match(contract, /table\/body/);
  assert.match(contract, /table\/cell\/label/);
  assert.match(contract, /contentHugPassed/);
  assert.match(contract, /TABLE-PROBE-EXCLUDE-OPACITY-ZERO-OCCUPANCY-OVERLAP/);
  assert.match(
    contract,
    /TABLE-PROBE-KEEP-EXACT-SCENE-RESTORATION-AFTER-DENSITY-WALK/,
  );
  assert.doesNotMatch(contract, /contentFillPassed/);
  assert.doesNotMatch(contract, /combobox\/overlay/);
  assert.doesNotMatch(contract, /listbox/);
  assert.doesNotMatch(contract, /Choose a person/);
});
