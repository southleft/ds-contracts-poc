import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { sceneToNormalizedIr as sceneToNormalizedIrV8 } from "./scene-readback.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV10 } from "./scene-readback-v10.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV16 } from "./scene-readback-v16.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV17 } from "./scene-readback-v17.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV18 } from "./scene-readback-v18.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV19 } from "./scene-readback-v19.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV20 } from "./scene-readback-v20.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV21 } from "./scene-readback-v21.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV22 } from "./scene-readback-v22.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV23 } from "./scene-readback-v23.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV24 } from "./scene-readback-v24.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV25 } from "./scene-readback-v25.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV26 } from "./scene-readback-v26.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV27 } from "./scene-readback-v27.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV28 } from "./scene-readback-v28.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV29 } from "./scene-readback-v29.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV30 } from "./scene-readback-v30.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV31 } from "./scene-readback-v31.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV32 } from "./scene-readback-v32.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV33 } from "./scene-readback-v33.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV34 } from "./scene-readback-v34.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV35 } from "./scene-readback-v35.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV36 } from "./scene-readback-v36.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV37 } from "./scene-readback-v37.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV38 } from "./scene-readback-v38.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV39 } from "./scene-readback-v39.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV40 } from "./scene-readback-v40.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV41 } from "./scene-readback-v41.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV42 } from "./scene-readback-v42.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV43 } from "./scene-readback-v43.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV44 } from "./scene-readback-v44.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV45 } from "./scene-readback-v45.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV46 } from "./scene-readback-v46.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV47 } from "./scene-readback-v47.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV48 } from "./scene-readback-v48.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV49 } from "./scene-readback-v49.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV50 } from "./scene-readback-v50.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV51 } from "./scene-readback-v51.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV52 } from "./scene-readback-v52.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV53 } from "./scene-readback-v53.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV54 } from "./scene-readback-v54.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV55 } from "./scene-readback-v55.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV56 } from "./scene-readback-v56.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV57 } from "./scene-readback-v57.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV58 } from "./scene-readback-v58.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV59 } from "./scene-readback-v59.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV60 } from "./scene-readback-v60.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV61 } from "./scene-readback-v61.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV62 } from "./scene-readback-v62.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV63 } from "./scene-readback-v63.js";
import { buildFigmaSceneReadbackRuntime } from "./scene-readback-runtime-v65.js";
import {
  INPUT_LIVE_V65_CONTENT_BINDING_COMPILE_ORDER_MARKER,
  INPUT_LIVE_V65_CONTENT_BINDING_EXTRAS_MARKER,
  INPUT_LIVE_V65_CONTENT_HIDDEN_HEIGHT_HUG_MARKER,
  INPUT_LIVE_V65_CONTENT_LETTER_SPACING_OMITTED_MARKER,
  INPUT_LIVE_V65_CONTENT_ROW_CLIPS_CONTENT_OMITTED_MARKER,
  INPUT_LIVE_V65_CONTENT_ROW_CORNER_RADIUS_OMITTED_MARKER,
  INPUT_LIVE_V65_CONTENT_ROW_EFFECTS_OMITTED_MARKER,
  INPUT_LIVE_V65_CONTENT_ROW_STROKES_OMITTED_MARKER,
  INPUT_LIVE_V65_LABEL_BINDING_COMPILE_ORDER_MARKER,
  INPUT_LIVE_V65_LABEL_BINDING_EXTRAS_MARKER,
  INPUT_LIVE_V65_LABEL_LETTER_SPACING_OMITTED_MARKER,
  INPUT_LIVE_V65_LABEL_TEXT_CASE_OMITTED_MARKER,
  INPUT_LIVE_V65_LABEL_TEXT_DECORATION_OMITTED_MARKER,
  INPUT_LIVE_V65_LABEL_ROW_CLIPS_CONTENT_OMITTED_MARKER,
  INPUT_LIVE_V65_LABEL_ROW_CORNER_RADIUS_OMITTED_MARKER,
  INPUT_LIVE_V65_LABEL_ROW_EFFECTS_OMITTED_MARKER,
  INPUT_LIVE_V65_LABEL_ROW_STROKES_OMITTED_MARKER,
  INPUT_LIVE_V65_SURFACE_STROKE_DASH_PATTERN_OMITTED_MARKER,
  INPUT_LIVE_V65_MESSAGE_BINDING_COMPILE_ORDER_MARKER,
  INPUT_LIVE_V65_MESSAGE_LETTER_SPACING_OMITTED_MARKER,
  INPUT_LIVE_V65_MESSAGE_TEXT_CASE_OMITTED_MARKER,
  INPUT_LIVE_V65_MESSAGE_TEXT_DECORATION_OMITTED_MARKER,
  INPUT_LIVE_V65_MESSAGE_CONTAINER_CLIPS_CONTENT_OMITTED_MARKER,
  INPUT_LIVE_V65_MESSAGE_CONTAINER_CORNER_RADIUS_OMITTED_MARKER,
  INPUT_LIVE_V65_MESSAGE_CONTAINER_EFFECTS_OMITTED_MARKER,
  INPUT_LIVE_V65_MESSAGE_CONTAINER_STROKES_OMITTED_MARKER,
  INPUT_LIVE_V65_VARIANT_CORNER_RADIUS_OMITTED_MARKER,
  INPUT_LIVE_V65_VARIANT_EFFECTS_OMITTED_MARKER,
  INPUT_LIVE_V65_VARIANT_STROKES_OMITTED_MARKER,
  INPUT_LIVE_V65_LEADING_SLOT_BINDING_COMPILE_ORDER_MARKER,
  INPUT_LIVE_V65_LEADING_SLOT_COMPILE_BINDING_FIELDS,
  INPUT_LIVE_V65_LEADING_SLOT_ROLES,
  INPUT_LIVE_V65_TRAILING_SLOT_BINDING_COMPILE_ORDER_MARKER,
  INPUT_LIVE_V65_TRAILING_SLOT_COMPILE_BINDING_FIELDS,
  INPUT_LIVE_V65_TRAILING_SLOT_ROLES,
  INPUT_LIVE_V65_REQUIRED_INDICATOR_BINDING_EXTRAS_MARKER,
  INPUT_LIVE_V65_REQUIRED_INDICATOR_BINDING_COMPILE_ORDER_MARKER,
  INPUT_LIVE_V65_REQUIRED_INDICATOR_COMPILE_BINDING_FIELDS,
  INPUT_LIVE_V65_REQUIRED_INDICATOR_LETTER_SPACING_OMITTED_MARKER,
  INPUT_LIVE_V65_REQUIRED_INDICATOR_TEXT_CASE_OMITTED_MARKER,
  INPUT_LIVE_V65_REQUIRED_INDICATOR_TEXT_DECORATION_OMITTED_MARKER,
  INPUT_LIVE_V65_SET_CORNER_RADIUS_OMITTED_MARKER,
  INPUT_LIVE_V65_SET_EFFECTS_OMITTED_MARKER,
  INPUT_LIVE_V65_SET_FILLS_OMITTED_MARKER,
  INPUT_LIVE_V65_REQUIRED_INDICATOR_ROLES,
  INPUT_LIVE_V65_MESSAGE_ROLES,
  INPUT_LIVE_V65_LABEL_ROLES,
  INPUT_LIVE_V65_CONTENT_TEXT_CASE_OMITTED_MARKER,
  INPUT_LIVE_V65_CONTENT_TEXT_DECORATION_OMITTED_MARKER,
  INPUT_LIVE_V65_CONTENT_COMPILE_BINDING_FIELDS,
  INPUT_LIVE_V65_CONTENT_ROLES,
  INPUT_LIVE_V65_SLOT_COLOR_BINDING_MARKER,
  INPUT_LIVE_V65_SLOT_FILL_MARKER,
  INPUT_LIVE_V65_SLOT_ROLES,
  INPUT_LIVE_V65_SURFACE_BINDING_COMPILE_ORDER_MARKER,
  INPUT_LIVE_V65_SURFACE_BINDING_EXTRAS_MARKER,
  INPUT_LIVE_V65_SURFACE_COMPILE_BINDING_FIELDS,
  INPUT_LIVE_V65_SURFACE_LAYOUT_HEIGHT_ALIAS_MARKER,
  INPUT_LIVE_V65_SURFACE_LAYOUT_HEIGHT_MARKER,
  INPUT_LIVE_V65_SURFACE_STROKE_WEIGHT_MARKER,
  INPUT_LIVE_V65_VARIANT_LAYOUT_WIDTH_ALIAS_MARKER,
  INPUT_LIVE_V65_VARIANT_LAYOUT_WIDTH_COMPILE_INDEX_MARKER,
  INPUT_LIVE_V65_VARIANT_LAYOUT_WIDTH_MARKER,
  SCENE_READBACK_V12_TAUGHT_FILL_KINDS,
  scenePaintToIr,
  sceneToNormalizedIr,
  type SceneNodeSnapshot,
} from "./scene-readback-v65.js";
import type { IRNode } from "./figma-ir.js";

const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");

const V8_INDEX = JSON.parse(
  readFileSync(
    "recipe/evidence/input-field-live-pivot-v8/antecedent-index.json",
    "utf8",
  ),
) as {
  artifacts: Record<string, { bytes: number; sha256: string }>;
};

const instanceScene = (
  fills: SceneNodeSnapshot["instancePayload"] extends infer Payload
    ? Payload extends { fills?: infer Fills }
      ? Fills
      : never
    : never,
): SceneNodeSnapshot => ({
  ownershipKey: "adornment",
  type: "INSTANCE",
  name: "leading",
  width: 16,
  height: 16,
  visible: true,
  opacity: 1,
  componentRef: "test.currency",
  componentProperties: { Side: "leading" },
  instancePayload: {
    text: ["$"],
    assets: [],
    content: { kind: "text", text: "$" },
    typography: {
      fontFamily: "Inter",
      fontStyle: "Regular",
      fontSize: 14,
      lineHeight: { unit: "px", value: 20 },
    },
    fills,
    opacity: 1,
    intrinsicSize: { width: 8, height: 20 },
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    alignment: { horizontal: "center", vertical: "center" },
    accessibility: { relation: "none", decorative: true },
    source: "live-v9-fixture",
  },
  boundVariables: [],
  children: [],
});

const instancePayloadFills = (scene: SceneNodeSnapshot) => {
  const ir = sceneToNormalizedIr(scene);
  assert.equal(ir.kind, "instance");
  const instance = ir as Extract<IRNode, { kind: "instance" }>;
  assert.ok(instance.payload);
  return instance.payload.fills;
};

test("v9 teaches the live fill kinds that v8 host IR refused", () => {
  assert.deepEqual(
    [...SCENE_READBACK_V12_TAUGHT_FILL_KINDS],
    ["VARIABLE_ALIAS", "boundVariablesOnly"],
  );
});

test("v9 maps VARIABLE_ALIAS payload fills into carried IR", () => {
  const fills = instancePayloadFills(
    instanceScene([
      { kind: "VARIABLE_ALIAS", id: "VariableID:1:2" },
      { type: "VARIABLE_ALIAS", id: "VariableID:3:4" },
    ]),
  );
  assert.deepEqual(fills, [
    {
      kind: "variable-alias",
      variable: "VariableID:1:2",
      resolvedType: "COLOR",
    },
    {
      kind: "variable-alias",
      variable: "VariableID:3:4",
      resolvedType: "COLOR",
    },
  ]);
});

test("v9 maps bound-variable-only payload fills into carried IR", () => {
  const fills = instancePayloadFills(
    instanceScene([
      {
        type: "boundVariablesOnly",
        boundVariables: {
          color: { type: "VARIABLE_ALIAS", id: "VariableID:5:6" },
        },
      },
      {
        boundVariables: {
          color: { type: "VARIABLE_ALIAS", id: "VariableID:7:8" },
        },
      } as never,
    ]),
  );
  assert.deepEqual(fills, [
    { kind: "bound-variable", fields: ["color"] },
    { kind: "bound-variable", fields: ["color"] },
  ]);
});

test("v17 surfaces empty leading-slot fills from instancePayload", () => {
  const scene: SceneNodeSnapshot = {
    ...instanceScene([{ type: "SOLID", color: "#111111ff" }]),
    name: "input-field/slot/leading :: $",
    fills: [],
  };
  const ir = sceneToNormalizedIr(scene);
  assert.equal(ir.kind, "instance");
  assert.equal(ir.role, "input-field/slot/leading");
  const instance = ir as Extract<IRNode, { kind: "instance" }>;
  assert.deepEqual(instance.fills, [{ kind: "solid", color: "#111111ff" }]);
  assert.equal(INPUT_LIVE_V65_SLOT_FILL_MARKER, "INPUT-SLOT-FILL-FROM-PAYLOAD");
  assert.deepEqual([...INPUT_LIVE_V65_SLOT_ROLES], [
    "input-field/slot/leading",
    "input-field/slot/trailing",
  ]);
});

test("v17 surfaces empty trailing-slot fills from the adornment-content child", () => {
  const scene: SceneNodeSnapshot = {
    ownershipKey: "adornment",
    type: "INSTANCE",
    name: "input-field/slot/trailing :: $",
    width: 16,
    height: 16,
    visible: true,
    opacity: 1,
    componentRef: "test.currency",
    fills: [],
    boundVariables: [],
    children: [
      {
        ownershipKey: "adornment/content",
        type: "FRAME",
        name: "input-field/adornment-content :: $",
        width: 8,
        height: 16,
        visible: true,
        opacity: 1,
        fills: [{ type: "SOLID", color: "#222222ff" }],
        boundVariables: [],
        children: [],
      },
    ],
  };
  const ir = sceneToNormalizedIr(scene);
  assert.equal(ir.kind, "instance");
  const instance = ir as Extract<IRNode, { kind: "instance" }>;
  assert.deepEqual(instance.fills, [{ kind: "solid", color: "#222222ff" }]);
});

test("v18 surfaces leading-slot fills.0.color from the adornment-content child", () => {
  const scene: SceneNodeSnapshot = {
    ownershipKey: "adornment",
    type: "INSTANCE",
    name: "input-field/slot/leading :: $",
    width: 16,
    height: 16,
    visible: true,
    opacity: 1,
    componentRef: "test.currency",
    fills: [],
    boundVariables: [
      {
        field: "height",
        variableName: "imported.text-field.medium.adornment-size",
        resolvedType: "FLOAT",
      },
      {
        field: "width",
        variableName: "imported.text-field.medium.leading-adornment-extent",
        resolvedType: "FLOAT",
      },
    ],
    children: [
      {
        ownershipKey: "adornment/content",
        type: "FRAME",
        name: "adornment-content",
        width: 8,
        height: 16,
        visible: true,
        opacity: 1,
        fills: [{ type: "SOLID", color: "#00000099" }],
        boundVariables: [
          {
            field: "fills.0.color",
            variableName: "imported.text-field.default.adornment-text",
            resolvedType: "COLOR",
          },
          {
            field: "fills.0",
            variableName: "imported.text-field.default.adornment-text",
            resolvedType: "COLOR",
          },
        ],
        children: [],
      },
    ],
  };
  const ir = sceneToNormalizedIr(scene);
  const instance = ir as Extract<IRNode, { kind: "instance" }>;
  const colorBindings = (instance.bindings ?? []).filter(
    (binding) => binding.field === "fills.0.color",
  );
  assert.equal(colorBindings.length, 1);
  assert.equal(
    colorBindings[0]?.variable,
    "imported.text-field.default.adornment-text",
  );
  assert.equal(colorBindings[0]?.type, "COLOR");
  assert.equal(
    INPUT_LIVE_V65_SLOT_COLOR_BINDING_MARKER,
    "INPUT-SLOT-COLOR-BINDING-FROM-CHILD",
  );
});

test("v18 does not invent a slot color binding when the child has none", () => {
  const scene: SceneNodeSnapshot = {
    ownershipKey: "adornment",
    type: "INSTANCE",
    name: "input-field/slot/leading :: $",
    width: 16,
    height: 16,
    visible: true,
    opacity: 1,
    componentRef: "test.currency",
    fills: [],
    boundVariables: [],
    children: [
      {
        ownershipKey: "adornment/content",
        type: "FRAME",
        name: "adornment-content",
        width: 8,
        height: 16,
        visible: true,
        opacity: 1,
        fills: [{ type: "SOLID", color: "#00000099" }],
        boundVariables: [],
        children: [],
      },
    ],
  };
  const ir = sceneToNormalizedIr(scene);
  const instance = ir as Extract<IRNode, { kind: "instance" }>;
  assert.equal(
    (instance.bindings ?? []).filter((binding) => binding.field === "fills.0.color")
      .length,
    0,
  );
});

const surfaceScene = (
  boundVariables: SceneNodeSnapshot["boundVariables"],
): SceneNodeSnapshot => ({
  ownershipKey: "surface",
  type: "FRAME",
  name: "input-field/surface :: Field",
  width: 320,
  height: 56,
  visible: true,
  opacity: 1,
  layoutMode: "HORIZONTAL",
  boundVariables,
  children: [],
});

const labelScene = (
  boundVariables: SceneNodeSnapshot["boundVariables"],
): SceneNodeSnapshot => ({
  ownershipKey: "label",
  type: "TEXT",
  name: "input-field/label :: Label",
  width: 57,
  height: 23,
  visible: true,
  opacity: 1,
  fontName: { family: "Roboto", style: "Regular" },
  fontSize: 16,
  characters: "Label",
  boundVariables,
  children: [],
});

const requiredIndicatorScene = (
  boundVariables: SceneNodeSnapshot["boundVariables"],
): SceneNodeSnapshot => ({
  ownershipKey: "required",
  type: "TEXT",
  name: "input-field/required-indicator :: *",
  width: 8,
  height: 20,
  visible: true,
  opacity: 1,
  fontName: { family: "Roboto", style: "Regular" },
  fontSize: 16,
  characters: "*",
  boundVariables,
  children: [],
});

const requiredIndicatorHostBindings = [
  {
    field: "fills.0.color",
    variableName: "imported.text-field.default.required-indicator",
    resolvedType: "COLOR" as const,
  },
  {
    field: "fills.0",
    variableName: "imported.text-field.default.required-indicator",
    resolvedType: "COLOR" as const,
  },
  {
    field: "fontSize.0",
    variableName: "imported.text-field.medium.required-font-size",
    resolvedType: "FLOAT" as const,
  },
  {
    field: "lineHeight.0",
    variableName: "imported.text-field.medium.required-line-height",
    resolvedType: "FLOAT" as const,
  },
];

const contentScene = (
  role: "input-field/content/placeholder" | "input-field/content/value",
  boundVariables: SceneNodeSnapshot["boundVariables"],
): SceneNodeSnapshot => ({
  ownershipKey: "content",
  type: "TEXT",
  name: `${role} :: Input`,
  width: 200,
  height: 24,
  visible: true,
  opacity: 1,
  fontName: { family: "Roboto", style: "Regular" },
  fontSize: 16,
  characters: "Placeholder",
  boundVariables,
  children: [],
});

const uniformPerSideStrokeBindings = (
  variableName: string,
): SceneNodeSnapshot["boundVariables"] =>
  (
    [
      "strokes.0.weight.top",
      "strokes.0.weight.right",
      "strokes.0.weight.bottom",
      "strokes.0.weight.left",
    ] as const
  ).map((field) => ({
    field,
    variableName,
    resolvedType: "FLOAT" as const,
  }));

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

test("v19 surfaces strokes.0.weight from uniform per-side FLOAT bindings", () => {
  const ir = sceneToNormalizedIr(
    surfaceScene(uniformPerSideStrokeBindings("imported.text-field.border-width")),
  );
  assert.equal(ir.kind, "frame");
  assert.equal(ir.role, "input-field/surface");
  const weight = (ir.bindings ?? []).filter(
    (binding) => binding.field === "strokes.0.weight",
  );
  assert.equal(weight.length, 1);
  assert.equal(weight[0]?.variable, "imported.text-field.border-width");
  assert.equal(weight[0]?.type, "FLOAT");
  assert.equal(
    INPUT_LIVE_V65_SURFACE_STROKE_WEIGHT_MARKER,
    "INPUT-SURFACE-STROKE-WEIGHT-FROM-PER-SIDE",
  );
});

test("v24 drops per-side stroke weights after aliasing strokes.0.weight", () => {
  const ir = sceneToNormalizedIr(
    surfaceScene(uniformPerSideStrokeBindings("imported.text-field.border-width")),
  );
  assert.deepEqual(
    (ir.bindings ?? []).map((binding) => binding.field),
    ["strokes.0.weight"],
  );
  assert.equal(
    INPUT_LIVE_V65_SURFACE_BINDING_EXTRAS_MARKER,
    "INPUT-SURFACE-BINDING-EXTRAS-DROPPED",
  );
});

test("v25 places remaining surface bindings at compile field order", () => {
  const leftover = [
    "cornerRadius.bottomLeft",
    "cornerRadius.bottomRight",
    "fills.0.color",
    "layout.minHeight",
    "layout.minWidth",
    "layout.padding.left",
    "layout.padding.right",
    "strokes.0.paint.color",
    "cornerRadius.topLeft",
    "cornerRadius.topRight",
    "strokes.0.weight",
    "layout.height.value",
  ];
  const ir = sceneToNormalizedIr(
    surfaceScene(
      leftover.map((field) => ({
        field,
        variableName: `imported.surface.${field}`,
        resolvedType: field.includes("color") ? ("COLOR" as const) : ("FLOAT" as const),
      })),
    ),
  );
  assert.deepEqual(
    (ir.bindings ?? []).map((binding) => binding.field),
    [...INPUT_LIVE_V65_SURFACE_COMPILE_BINDING_FIELDS],
  );
  assert.equal(
    INPUT_LIVE_V65_SURFACE_BINDING_COMPILE_ORDER_MARKER,
    "INPUT-SURFACE-BINDING-COMPILE-ORDER",
  );
});

test("v26 drops duplicate mapped content color bindings", () => {
  const ir = sceneToNormalizedIr(
    contentScene("input-field/content/placeholder", [
      {
        field: "fills.0.color",
        variableName: "imported.text-field.default.placeholder-text",
        resolvedType: "COLOR",
      },
      {
        field: "fills.0",
        variableName: "imported.text-field.default.placeholder-text",
        resolvedType: "COLOR",
      },
      {
        field: "fontSize.0",
        variableName: "imported.text-field.medium.input-font-size",
        resolvedType: "FLOAT",
      },
      {
        field: "lineHeight.0",
        variableName: "imported.text-field.medium.input-line-height",
        resolvedType: "FLOAT",
      },
    ]),
  );
  assert.deepEqual(
    (ir.bindings ?? []).map((binding) => binding.field),
    [...INPUT_LIVE_V65_CONTENT_COMPILE_BINDING_FIELDS],
  );
  assert.equal(
    INPUT_LIVE_V65_CONTENT_BINDING_EXTRAS_MARKER,
    "INPUT-CONTENT-BINDING-EXTRAS-DROPPED",
  );
  assert.deepEqual([...INPUT_LIVE_V65_CONTENT_ROLES], [
    "input-field/content/placeholder",
    "input-field/content/value",
  ]);
});

test("v26 places remaining content bindings at compile field order", () => {
  const ir = sceneToNormalizedIr(
    contentScene("input-field/content/value", [
      {
        field: "fills.0.color",
        variableName: "imported.text-field.default.input-text",
        resolvedType: "COLOR",
      },
      {
        field: "fontSize.0",
        variableName: "imported.text-field.medium.input-font-size",
        resolvedType: "FLOAT",
      },
      {
        field: "lineHeight.0",
        variableName: "imported.text-field.medium.input-line-height",
        resolvedType: "FLOAT",
      },
    ]),
  );
  assert.deepEqual(
    (ir.bindings ?? []).map((binding) => binding.field),
    [...INPUT_LIVE_V65_CONTENT_COMPILE_BINDING_FIELDS],
  );
  assert.equal(
    INPUT_LIVE_V65_CONTENT_BINDING_COMPILE_ORDER_MARKER,
    "INPUT-CONTENT-BINDING-COMPILE-ORDER",
  );
});

test("v65 recovers hug height for hidden content text with FIXED vertical sizing", () => {
  const ir = sceneToNormalizedIr({
    ...contentScene("input-field/content/placeholder", [
      {
        field: "fills.0.color",
        variableName: "imported.text-field.default.placeholder-text",
        resolvedType: "COLOR",
      },
      {
        field: "fontSize.0",
        variableName: "imported.text-field.medium.input-font-size",
        resolvedType: "FLOAT",
      },
      {
        field: "lineHeight.0",
        variableName: "imported.text-field.medium.input-line-height",
        resolvedType: "FLOAT",
      },
    ]),
    visible: false,
    layoutSizingHorizontal: "FILL",
    layoutSizingVertical: "FIXED",
    height: 23,
  });
  assert.deepEqual(ir.height, { mode: "hug" });
  assert.deepEqual(ir.width, { mode: "fill" });
  assert.equal(
    INPUT_LIVE_V65_CONTENT_HIDDEN_HEIGHT_HUG_MARKER,
    "INPUT-CONTENT-HIDDEN-FIXED-HEIGHT-AS-HUG",
  );
});

test("v65 does not rewrite visible content FIXED height or invent a height variable", () => {
  const ir = sceneToNormalizedIr({
    ...contentScene("input-field/content/value", [
      {
        field: "fontSize.0",
        variableName: "imported.text-field.medium.input-font-size",
        resolvedType: "FLOAT",
      },
    ]),
    visible: true,
    layoutSizingHorizontal: "FILL",
    layoutSizingVertical: "FIXED",
    height: 23,
  });
  assert.deepEqual(ir.height, { mode: "fixed", value: 23 });
  assert.deepEqual(ir.width, { mode: "fill" });
});

test("v65 does not lift hidden FIXED height onto non-content text", () => {
  const ir = sceneToNormalizedIr({
    ownershipKey: "label",
    type: "TEXT",
    name: "input-field/label :: Label",
    width: 72,
    height: 20,
    visible: false,
    opacity: 1,
    layoutSizingHorizontal: "HUG",
    layoutSizingVertical: "FIXED",
    fontName: { family: "Roboto", style: "Regular" },
    fontSize: 16,
    characters: "Store name",
    boundVariables: [],
    children: [],
  });
  assert.deepEqual(ir.height, { mode: "fixed", value: 20 });
});

test("hashed v26 scene-readback still emits fixed height for hidden content text", () => {
  const ir = sceneToNormalizedIrV26({
    ...contentScene("input-field/content/placeholder", [
      {
        field: "fills.0.color",
        variableName: "imported.text-field.default.placeholder-text",
        resolvedType: "COLOR",
      },
    ]),
    visible: false,
    layoutSizingHorizontal: "FILL",
    layoutSizingVertical: "FIXED",
    height: 23,
  });
  assert.deepEqual(ir.height, { mode: "fixed", value: 23 });
});

test("v26 does not invent a content binding that the extract omitted", () => {
  const ir = sceneToNormalizedIr(
    contentScene("input-field/content/placeholder", [
      {
        field: "fontSize.0",
        variableName: "imported.text-field.medium.input-font-size",
        resolvedType: "FLOAT",
      },
    ]),
  );
  assert.deepEqual(
    (ir.bindings ?? []).map((binding) => binding.field),
    ["type.fontSize"],
  );
});

test("v25 does not reorder or drop content/placeholder bindings", () => {
  const ir = sceneToNormalizedIrV25(
    contentScene("input-field/content/placeholder", [
      {
        field: "fills.0.color",
        variableName: "imported.text-field.default.placeholder-text",
        resolvedType: "COLOR",
      },
      {
        field: "fills.0",
        variableName: "imported.text-field.default.placeholder-text",
        resolvedType: "COLOR",
      },
      {
        field: "fontSize.0",
        variableName: "imported.text-field.medium.input-font-size",
        resolvedType: "FLOAT",
      },
      {
        field: "lineHeight.0",
        variableName: "imported.text-field.medium.input-line-height",
        resolvedType: "FLOAT",
      },
    ]),
  );
  assert.deepEqual(
    (ir.bindings ?? []).map((binding) => binding.field),
    ["fills.0.color", "fills.0.color", "type.fontSize", "type.lineHeight.value"],
  );
});

test("v24 drops duplicate mapped surface color bindings", () => {
  const ir = sceneToNormalizedIr(
    surfaceScene([
      {
        field: "fills.0.color",
        variableName: "imported.text-field.default.background",
        resolvedType: "COLOR",
      },
      {
        field: "fills.0",
        variableName: "imported.text-field.default.background",
        resolvedType: "COLOR",
      },
      {
        field: "strokes.0.paint.color",
        variableName: "imported.text-field.default.border",
        resolvedType: "COLOR",
      },
      {
        field: "strokes.0",
        variableName: "imported.text-field.default.border",
        resolvedType: "COLOR",
      },
    ]),
  );
  assert.deepEqual(
    (ir.bindings ?? []).map((binding) => binding.field),
    ["fills.0.color", "strokes.0.paint.color"],
  );
});

test("v19 surfaces strokes.0.weight from Figma per-side field names", () => {
  const ir = sceneToNormalizedIr(
    surfaceScene(
      uniformFigmaPerSideStrokeBindings("imported.text-field.border-width"),
    ),
  );
  const weight = (ir.bindings ?? []).filter(
    (binding) => binding.field === "strokes.0.weight",
  );
  assert.equal(weight.length, 1);
  assert.equal(weight[0]?.variable, "imported.text-field.border-width");
});

test("v19 does not invent strokes.0.weight when per-side variables differ", () => {
  const ir = sceneToNormalizedIr(
    surfaceScene([
      {
        field: "strokes.0.weight.top",
        variableName: "imported.text-field.border-width",
        resolvedType: "FLOAT",
      },
      {
        field: "strokes.0.weight.right",
        variableName: "imported.text-field.border-width",
        resolvedType: "FLOAT",
      },
      {
        field: "strokes.0.weight.bottom",
        variableName: "imported.text-field.other-width",
        resolvedType: "FLOAT",
      },
      {
        field: "strokes.0.weight.left",
        variableName: "imported.text-field.border-width",
        resolvedType: "FLOAT",
      },
    ]),
  );
  assert.equal(
    (ir.bindings ?? []).filter((binding) => binding.field === "strokes.0.weight")
      .length,
    0,
  );
});

test("v19 does not lift per-side stroke weights onto non-surface roles", () => {
  const ir = sceneToNormalizedIr({
    ...surfaceScene(uniformPerSideStrokeBindings("imported.text-field.border-width")),
    name: "input-field/content-row :: Row",
  });
  assert.equal(ir.role, "input-field/content-row");
  assert.equal(
    (ir.bindings ?? []).filter((binding) => binding.field === "strokes.0.weight")
      .length,
    0,
  );
});

test("v20 surfaces layout.width.value from an existing Figma width FLOAT", () => {
  const ir = sceneToNormalizedIr({
    ownershipKey: "variant",
    type: "COMPONENT",
    name: "input-field/variant/small/default/placeholder/true/none",
    width: 195,
    height: 56,
    visible: true,
    opacity: 1,
    layoutMode: "VERTICAL",
    layoutSizingHorizontal: "FIXED",
    boundVariables: [
      {
        field: "itemSpacing",
        variableName: "imported.text-field.small.stack-gap",
        resolvedType: "FLOAT",
      },
      {
        field: "minWidth",
        variableName: "imported.text-field.small.min-width",
        resolvedType: "FLOAT",
      },
      {
        field: "width",
        variableName: "imported.text-field.small.width",
        resolvedType: "FLOAT",
      },
    ],
    children: [],
  });
  const width = (ir.bindings ?? []).filter(
    (binding) => binding.field === "layout.width.value",
  );
  assert.equal(width.length, 1);
  assert.equal(width[0]?.variable, "imported.text-field.small.width");
  assert.equal(width[0]?.type, "FLOAT");
  assert.equal(
    INPUT_LIVE_V65_VARIANT_LAYOUT_WIDTH_MARKER,
    "INPUT-VARIANT-LAYOUT-WIDTH-FROM-WIDTH",
  );
  assert.equal(
    (ir.bindings ?? []).filter((binding) => binding.field === "width.value")
      .length,
    0,
  );
  assert.equal(
    INPUT_LIVE_V65_VARIANT_LAYOUT_WIDTH_ALIAS_MARKER,
    "INPUT-VARIANT-LAYOUT-WIDTH-ALIAS-NO-DUPLICATE-WIDTH-VALUE",
  );
  assert.deepEqual(
    (ir.bindings ?? []).map((binding) => binding.field),
    ["layout.itemSpacing", "layout.width.value", "layout.minWidth"],
  );
  assert.equal(
    INPUT_LIVE_V65_VARIANT_LAYOUT_WIDTH_COMPILE_INDEX_MARKER,
    "INPUT-VARIANT-LAYOUT-WIDTH-ALIAS-COMPILE-INDEX",
  );
});

test("v20 does not invent layout.width.value when width is absent", () => {
  const ir = sceneToNormalizedIr({
    ownershipKey: "variant",
    type: "COMPONENT",
    name: "input-field/variant/small/default/placeholder/true/leading",
    width: 195,
    height: 56,
    visible: true,
    opacity: 1,
    layoutMode: "VERTICAL",
    boundVariables: [
      {
        field: "itemSpacing",
        variableName: "imported.text-field.small.stack-gap",
        resolvedType: "FLOAT",
      },
      {
        field: "minWidth",
        variableName: "imported.text-field.small.min-width",
        resolvedType: "FLOAT",
      },
    ],
    children: [],
  });
  assert.equal(
    (ir.bindings ?? []).filter(
      (binding) => binding.field === "layout.width.value",
    ).length,
    0,
  );
});

test("v20 does not lift layout.width.value onto non-variant roles", () => {
  const ir = sceneToNormalizedIr({
    ownershipKey: "surface",
    type: "FRAME",
    name: "input-field/surface :: Field",
    width: 320,
    height: 56,
    visible: true,
    opacity: 1,
    layoutMode: "HORIZONTAL",
    boundVariables: [
      {
        field: "width",
        variableName: "imported.text-field.small.width",
        resolvedType: "FLOAT",
      },
    ],
    children: [],
  });
  assert.equal(ir.role, "input-field/surface");
  assert.equal(
    (ir.bindings ?? []).filter(
      (binding) => binding.field === "layout.width.value",
    ).length,
    0,
  );
});

test("v21 surfaces layout.height.value from an existing Figma height FLOAT", () => {
  const ir = sceneToNormalizedIr({
    ownershipKey: "surface",
    type: "FRAME",
    name: "input-field/surface :: Field",
    width: 320,
    height: 56,
    visible: true,
    opacity: 1,
    layoutMode: "HORIZONTAL",
    layoutSizingVertical: "FIXED",
    boundVariables: [
      {
        field: "height",
        variableName: "imported.text-field.medium.surface-height",
        resolvedType: "FLOAT",
      },
    ],
    children: [],
  });
  const height = (ir.bindings ?? []).filter(
    (binding) => binding.field === "layout.height.value",
  );
  assert.equal(height.length, 1);
  assert.equal(height[0]?.variable, "imported.text-field.medium.surface-height");
  assert.equal(height[0]?.type, "FLOAT");
  assert.equal(
    INPUT_LIVE_V65_SURFACE_LAYOUT_HEIGHT_MARKER,
    "INPUT-SURFACE-LAYOUT-HEIGHT-FROM-HEIGHT",
  );
  assert.equal(
    (ir.bindings ?? []).filter((binding) => binding.field === "height.value")
      .length,
    0,
  );
  assert.equal(
    INPUT_LIVE_V65_SURFACE_LAYOUT_HEIGHT_ALIAS_MARKER,
    "INPUT-SURFACE-LAYOUT-HEIGHT-ALIAS-NO-DUPLICATE-HEIGHT-VALUE",
  );
});

test("v21 does not invent layout.height.value when height is absent", () => {
  const ir = sceneToNormalizedIr({
    ownershipKey: "surface",
    type: "FRAME",
    name: "input-field/surface :: Field",
    width: 320,
    height: 56,
    visible: true,
    opacity: 1,
    layoutMode: "HORIZONTAL",
    boundVariables: [
      {
        field: "minHeight",
        variableName: "imported.text-field.medium.min-height",
        resolvedType: "FLOAT",
      },
    ],
    children: [],
  });
  assert.equal(
    (ir.bindings ?? []).filter(
      (binding) => binding.field === "layout.height.value",
    ).length,
    0,
  );
});

test("v21 does not lift layout.height.value onto non-surface roles", () => {
  const ir = sceneToNormalizedIr({
    ownershipKey: "variant",
    type: "COMPONENT",
    name: "input-field/variant/small/default/placeholder/true/none",
    width: 195,
    height: 56,
    visible: true,
    opacity: 1,
    layoutMode: "VERTICAL",
    boundVariables: [
      {
        field: "height",
        variableName: "imported.text-field.medium.surface-height",
        resolvedType: "FLOAT",
      },
    ],
    children: [],
  });
  assert.equal(ir.role, "input-field/variant/small/default/placeholder/true/none");
  assert.equal(
    (ir.bindings ?? []).filter(
      (binding) => binding.field === "layout.height.value",
    ).length,
    0,
  );
});

test("hashed v20 scene-readback still omits layout.height.value when only Figma height exists", () => {
  const ir = sceneToNormalizedIrV20({
    ownershipKey: "surface",
    type: "FRAME",
    name: "input-field/surface :: Field",
    width: 320,
    height: 56,
    visible: true,
    opacity: 1,
    layoutMode: "HORIZONTAL",
    boundVariables: [
      {
        field: "height",
        variableName: "imported.text-field.medium.surface-height",
        resolvedType: "FLOAT",
      },
    ],
    children: [],
  });
  assert.equal(
    (ir.bindings ?? []).filter((binding) => binding.field === "height.value")
      .length,
    1,
  );
  assert.equal(
    (ir.bindings ?? []).filter(
      (binding) => binding.field === "layout.height.value",
    ).length,
    0,
  );
});

test("hashed v19 scene-readback still omits layout.width.value when only Figma width exists", () => {
  const ir = sceneToNormalizedIrV19({
    ownershipKey: "variant",
    type: "COMPONENT",
    name: "input-field/variant/small/default/placeholder/true/none",
    width: 195,
    height: 56,
    visible: true,
    opacity: 1,
    layoutMode: "VERTICAL",
    boundVariables: [
      {
        field: "width",
        variableName: "imported.text-field.small.width",
        resolvedType: "FLOAT",
      },
    ],
    children: [],
  });
  assert.equal(
    (ir.bindings ?? []).filter((binding) => binding.field === "width.value")
      .length,
    1,
  );
  assert.equal(
    (ir.bindings ?? []).filter(
      (binding) => binding.field === "layout.width.value",
    ).length,
    0,
  );
});

test("hashed v18 scene-readback still omits strokes.0.weight when only per-side bindings exist", () => {
  const ir = sceneToNormalizedIrV18(
    surfaceScene(uniformPerSideStrokeBindings("imported.text-field.border-width")),
  );
  assert.equal(
    (ir.bindings ?? []).filter((binding) => binding.field === "strokes.0.weight")
      .length,
    0,
  );
});

test("hashed v17 scene-readback still omits the child fills.0.color binding", () => {
  const scene: SceneNodeSnapshot = {
    ownershipKey: "adornment",
    type: "INSTANCE",
    name: "input-field/slot/leading :: $",
    width: 16,
    height: 16,
    visible: true,
    opacity: 1,
    componentRef: "test.currency",
    fills: [],
    boundVariables: [
      {
        field: "width",
        variableName: "imported.text-field.medium.leading-adornment-extent",
        resolvedType: "FLOAT",
      },
    ],
    children: [
      {
        ownershipKey: "adornment/content",
        type: "FRAME",
        name: "adornment-content",
        width: 8,
        height: 16,
        visible: true,
        opacity: 1,
        fills: [{ type: "SOLID", color: "#00000099" }],
        boundVariables: [
          {
            field: "fills.0.color",
            variableName: "imported.text-field.default.adornment-text",
            resolvedType: "COLOR",
          },
        ],
        children: [],
      },
    ],
  };
  const ir = sceneToNormalizedIrV17(scene);
  const instance = ir as Extract<IRNode, { kind: "instance" }>;
  assert.equal(
    (instance.bindings ?? []).filter((binding) => binding.field === "fills.0.color")
      .length,
    0,
  );
});

test("v17 does not invent slot fills when payload and child are empty", () => {
  const scene: SceneNodeSnapshot = {
    ownershipKey: "adornment",
    type: "INSTANCE",
    name: "input-field/slot/leading :: $",
    width: 16,
    height: 16,
    visible: true,
    opacity: 1,
    componentRef: "test.currency",
    fills: [],
    boundVariables: [],
    children: [],
  };
  const ir = sceneToNormalizedIr(scene);
  const instance = ir as Extract<IRNode, { kind: "instance" }>;
  assert.deepEqual(instance.fills, []);
});

test("hashed v16 scene-readback still leaves empty leading-slot fills empty", () => {
  const scene: SceneNodeSnapshot = {
    ...instanceScene([{ type: "SOLID", color: "#111111ff" }]),
    name: "input-field/slot/leading :: $",
    fills: [],
  };
  const ir = sceneToNormalizedIrV16(scene);
  assert.equal(ir.kind, "instance");
  const instance = ir as Extract<IRNode, { kind: "instance" }>;
  assert.deepEqual(instance.fills, []);
});

test("v17 does not lift payload fills onto non-slot instances", () => {
  const scene: SceneNodeSnapshot = {
    ...instanceScene([{ type: "SOLID", color: "#111111ff" }]),
    fills: [],
  };
  const ir = sceneToNormalizedIr(scene);
  const instance = ir as Extract<IRNode, { kind: "instance" }>;
  assert.deepEqual(instance.fills, []);
  assert.deepEqual(instance.payload?.fills, [
    { kind: "solid", color: "#111111ff" },
  ]);
});

test("v9 still converts ordinary scene paints and does not invent colors", () => {
  assert.deepEqual(scenePaintToIr({ type: "SOLID", color: "#111111ff" }), {
    kind: "solid",
    color: "#111111ff",
  });
  assert.throws(
    () => scenePaintToIr({ type: "SOLID" }),
    /scene solid paint has no color/,
  );
});

test("hashed v8 scene-readback still refuses the live fill kinds", () => {
  const scene = instanceScene([
    { kind: "VARIABLE_ALIAS", id: "VariableID:1:2" },
  ]);
  assert.throws(
    () => sceneToNormalizedIrV8(scene),
    /kind|discriminator|Invalid/i,
  );
  assert.throws(
    () =>
      sceneToNormalizedIrV8(
        instanceScene([
          {
            type: "boundVariablesOnly",
            boundVariables: {
              color: { type: "VARIABLE_ALIAS", id: "VariableID:5:6" },
            },
          },
        ]),
      ),
    /kind|discriminator|Invalid/i,
  );
});

test("v8 hashed scene-readback bytes stay frozen", () => {
  for (const artifactPath of [
    "recipe/scene-readback.ts",
    "recipe/scene-readback-runtime.ts",
  ] as const) {
    const pinned = V8_INDEX.artifacts[artifactPath];
    assert.ok(pinned, `v8 index missing ${artifactPath}`);
    const bytes = readFileSync(artifactPath);
    assert.equal(bytes.byteLength, pinned.bytes);
    assert.equal(sha256(bytes), pinned.sha256);
  }
});

test("v10 extract runtime serializes the taught live fill kinds", () => {
  const runtime = buildFigmaSceneReadbackRuntime(
    "ds.contracts.input.recipe.v5",
  );
  assert.match(runtime, /VARIABLE_ALIAS/);
  assert.match(runtime, /boundVariablesOnly/);
  assert.doesNotMatch(
    readFileSync("recipe/scene-readback-runtime.ts", "utf8"),
    /boundVariablesOnly/,
  );
});

test("v16 extract measures hidden content FILL while visible, then restores visibility", () => {
  const runtime = buildFigmaSceneReadbackRuntime(
    "ds.contracts.input.recipe.v5",
  );
  assert.match(runtime, /INPUT-EXTRACT-MEASURE-HIDDEN-CONTENT-FILL/);
  assert.match(runtime, /input-field\/content\/placeholder/);
  assert.match(runtime, /input-field\/content\/value/);
  const reveal = runtime.indexOf("current.visible=true");
  const hide = runtime.lastIndexOf("current.visible=false");
  const sizing = runtime.indexOf("snapshot[field]=current[field]");
  assert.ok(reveal >= 0 && hide > reveal);
  assert.ok(sizing > reveal && sizing < hide);
  assert.doesNotMatch(
    readFileSync("recipe/scene-readback-runtime-v15.ts", "utf8"),
    /INPUT-EXTRACT-MEASURE-HIDDEN-CONTENT-FILL/,
  );
});

test("v10 live host path does not import hashed scene-readback.ts", () => {
  const verifier = readFileSync(
    "recipe/input-field-live-v65-verifier.ts",
    "utf8",
  );
  const contract = readFileSync(
    "recipe/input-field-live-v65-contract.ts",
    "utf8",
  );
  const carried = readFileSync(
    "recipe/input-field-live-v3-verifier-v65.ts",
    "utf8",
  );
  assert.match(verifier, /input-field-live-v3-verifier-v65/);
  assert.doesNotMatch(verifier, /from "\.\/input-field-live-v3-verifier\.js"/);
  assert.doesNotMatch(verifier, /from "\.\/scene-readback\.js"/);
  assert.match(contract, /input-field-live-v3-verifier-v65/);
  assert.doesNotMatch(contract, /from "\.\/input-field-live-v3-verifier\.js"/);
  assert.doesNotMatch(contract, /from "\.\/scene-readback\.js"/);
  assert.match(carried, /from "\.\/scene-readback-v65\.js"/);
  assert.doesNotMatch(carried, /from "\.\/scene-readback\.js"/);
});

test("v11 recovers text role and label when the name carries font-provenance=", () => {
  const helperName =
    "input-field/message/helper :: font-provenance=%7B%22requestedFamily%22%3A%22Roboto%22%7D";
  const scene: SceneNodeSnapshot = {
    ownershipKey: "message",
    type: "TEXT",
    name: helperName,
    width: 120,
    height: 16,
    visible: true,
    opacity: 1,
    characters: "Enter a valid amount",
    fontName: { family: "Roboto", style: "Regular" },
    fontSize: 12,
    lineHeight: { unit: "PIXELS", value: 16 },
    boundVariables: [],
    children: [],
  };
  const v11 = sceneToNormalizedIr(scene);
  assert.equal(v11.kind, "text");
  assert.equal(v11.role, "input-field/message/helper");
  assert.equal(v11.label, "input-field/message/helper");
  const v10 = sceneToNormalizedIrV10(scene);
  assert.equal(v10.kind, "text");
  assert.equal(v10.role, undefined);
  assert.notEqual(v10.label, "input-field/message/helper");
});

test("v11 still reads role :: label :: font-provenance= and ignores variant names", () => {
  const labeled = sceneToNormalizedIr({
    ownershipKey: "label",
    type: "TEXT",
    name: "input-field/label :: Field label :: font-provenance=%7B%7D",
    width: 80,
    height: 16,
    visible: true,
    opacity: 1,
    characters: "Email",
    fontName: { family: "Roboto", style: "Regular" },
    fontSize: 12,
    lineHeight: { unit: "PIXELS", value: 16 },
    boundVariables: [],
    children: [],
  });
  assert.equal(labeled.kind, "text");
  assert.equal(labeled.role, "input-field/label");
  assert.equal(labeled.label, "Field label");
  const variant = sceneToNormalizedIr({
    ownershipKey: "root/children/0",
    type: "COMPONENT",
    name: "Size=medium, State=default",
    width: 320,
    height: 72,
    visible: true,
    opacity: 1,
    layoutMode: "VERTICAL",
    variantProperties: { Size: "medium", State: "default" },
    boundVariables: [],
    children: [],
  });
  assert.equal(variant.kind, "component");
  assert.equal(variant.role, undefined);
});

test("hashed v22 scene-readback still appends layout.width.value after minWidth", () => {
  const ir = sceneToNormalizedIrV22({
    ownershipKey: "variant",
    type: "COMPONENT",
    name: "input-field/variant/small/default/placeholder/true/none",
    width: 195,
    height: 56,
    visible: true,
    opacity: 1,
    layoutMode: "VERTICAL",
    boundVariables: [
      {
        field: "itemSpacing",
        variableName: "imported.text-field.small.stack-gap",
        resolvedType: "FLOAT",
      },
      {
        field: "minWidth",
        variableName: "imported.text-field.small.min-width",
        resolvedType: "FLOAT",
      },
      {
        field: "width",
        variableName: "imported.text-field.small.width",
        resolvedType: "FLOAT",
      },
    ],
    children: [],
  });
  assert.deepEqual(
    (ir.bindings ?? []).map((binding) => binding.field),
    ["layout.itemSpacing", "layout.minWidth", "layout.width.value"],
  );
});

test("hashed v22 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v22.ts");
  assert.equal(
    sha256(bytes),
    "422419ddad44f6ff77f31c6e23ae55ad14cf37cb7693450669505a68fc1a0728",
  );
  assert.equal(bytes.byteLength, 48670);
});

test("hashed v23 scene-readback still keeps per-side stroke weights plus the alias", () => {
  const ir = sceneToNormalizedIrV23(
    surfaceScene(uniformPerSideStrokeBindings("imported.text-field.border-width")),
  );
  assert.deepEqual(
    (ir.bindings ?? []).map((binding) => binding.field),
    [
      "strokes.0.weight.top",
      "strokes.0.weight.right",
      "strokes.0.weight.bottom",
      "strokes.0.weight.left",
      "strokes.0.weight",
    ],
  );
});

test("hashed v23 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v23.ts");
  assert.equal(
    sha256(bytes),
    "346ebdc5630010553ac44b57afc852aaea6e4a5dcac18d2bba5a94542e40c256",
  );
  assert.equal(bytes.byteLength, 49433);
});

test("hashed v24 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v24.ts");
  assert.equal(
    sha256(bytes),
    "f8efe1c1dbfb7a8013716be81855971f05cc17c7653a81a8a97a2dde4f93c2ae",
  );
  assert.equal(bytes.byteLength, 50534);
});

test("hashed v25 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v25.ts");
  assert.equal(
    sha256(bytes),
    "4c4b10322a56b37ad2162c1ff5499bbafa19a01f184353f73b2dbd0c7407751b",
  );
  assert.equal(bytes.byteLength, 51785);
});

test("hashed v26 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v26.ts");
  assert.equal(
    sha256(bytes),
    "b34e18a12bb299c0f7027677d69a625e41a3f0c71873056cfae59ea5a2bd1620",
  );
  assert.equal(bytes.byteLength, 53539);
});

test("v65 omits content letterSpacing that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ...contentScene("input-field/content/placeholder", [
      {
        field: "fontSize.0",
        variableName: "imported.text-field.medium.input-font-size",
        resolvedType: "FLOAT",
      },
    ]),
    letterSpacing: { unit: "PERCENT", value: 0 },
  });
  assert.equal(ir.type?.letterSpacing, undefined);
  assert.equal(
    INPUT_LIVE_V65_CONTENT_LETTER_SPACING_OMITTED_MARKER,
    "INPUT-CONTENT-LETTER-SPACING-OMITTED",
  );
});

test("v65 does not omit letterSpacing on non-content non-label non-message text", () => {
  const ir = sceneToNormalizedIr({
    ownershipKey: "counter",
    type: "TEXT",
    name: "input-field/message/counter :: 0/100",
    width: 72,
    height: 20,
    visible: true,
    opacity: 1,
    layoutSizingHorizontal: "HUG",
    layoutSizingVertical: "HUG",
    fontName: { family: "Roboto", style: "Regular" },
    fontSize: 16,
    characters: "0/100",
    letterSpacing: { unit: "PERCENT", value: 0 },
    boundVariables: [],
    children: [],
  });
  assert.deepEqual(ir.type?.letterSpacing, { unit: "percent", value: 0 });
});

test("hashed v27 scene-readback still emits content letterSpacing", () => {
  const ir = sceneToNormalizedIrV27({
    ...contentScene("input-field/content/placeholder", [
      {
        field: "fontSize.0",
        variableName: "imported.text-field.medium.input-font-size",
        resolvedType: "FLOAT",
      },
    ]),
    letterSpacing: { unit: "PERCENT", value: 0 },
  });
  assert.deepEqual(ir.type?.letterSpacing, { unit: "percent", value: 0 });
});

test("hashed v27 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v27.ts");
  assert.equal(
    sha256(bytes),
    "53f7e39a70deaabf8ceefb63305b2eb9d6230c93f2b9a34cf9e248085b05f8f5",
  );
  assert.equal(bytes.byteLength, 54246);
});

test("v65 omits content textCase that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ...contentScene("input-field/content/placeholder", [
      {
        field: "fontSize.0",
        variableName: "imported.text-field.medium.input-font-size",
        resolvedType: "FLOAT",
      },
    ]),
    textCase: "ORIGINAL",
  });
  assert.equal(ir.type?.textCase, undefined);
  assert.equal(
    INPUT_LIVE_V65_CONTENT_TEXT_CASE_OMITTED_MARKER,
    "INPUT-CONTENT-TEXT-CASE-OMITTED",
  );
});

test("v65 does not omit textCase on non-content non-label non-message text", () => {
  const ir = sceneToNormalizedIr({
    ownershipKey: "counter",
    type: "TEXT",
    name: "input-field/message/counter :: 0/100",
    width: 72,
    height: 20,
    visible: true,
    opacity: 1,
    layoutSizingHorizontal: "HUG",
    layoutSizingVertical: "HUG",
    fontName: { family: "Roboto", style: "Regular" },
    fontSize: 16,
    characters: "0/100",
    textCase: "ORIGINAL",
    boundVariables: [],
    children: [],
  });
  assert.equal(ir.type?.textCase, "original");
});

test("hashed v28 scene-readback still emits content textCase", () => {
  const ir = sceneToNormalizedIrV28({
    ...contentScene("input-field/content/placeholder", [
      {
        field: "fontSize.0",
        variableName: "imported.text-field.medium.input-font-size",
        resolvedType: "FLOAT",
      },
    ]),
    textCase: "ORIGINAL",
  });
  assert.equal(ir.type?.textCase, "original");
});

test("v65 omits content textDecoration that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ...contentScene("input-field/content/placeholder", [
      {
        field: "fontSize.0",
        variableName: "imported.text-field.medium.input-font-size",
        resolvedType: "FLOAT",
      },
    ]),
    textDecoration: "NONE",
  });
  assert.equal(ir.type?.textDecoration, undefined);
  assert.equal(
    INPUT_LIVE_V65_CONTENT_TEXT_DECORATION_OMITTED_MARKER,
    "INPUT-CONTENT-TEXT-DECORATION-OMITTED",
  );
});

test("v65 does not omit textDecoration on non-content non-label non-message text", () => {
  const ir = sceneToNormalizedIr({
    ownershipKey: "counter",
    type: "TEXT",
    name: "input-field/message/counter :: 0/100",
    width: 72,
    height: 20,
    visible: true,
    opacity: 1,
    layoutSizingHorizontal: "HUG",
    layoutSizingVertical: "HUG",
    fontName: { family: "Roboto", style: "Regular" },
    fontSize: 16,
    characters: "0/100",
    textDecoration: "NONE",
    boundVariables: [],
    children: [],
  });
  assert.equal(ir.type?.textDecoration, "none");
});

test("hashed v29 scene-readback still emits content textDecoration", () => {
  const ir = sceneToNormalizedIrV29({
    ...contentScene("input-field/content/placeholder", [
      {
        field: "fontSize.0",
        variableName: "imported.text-field.medium.input-font-size",
        resolvedType: "FLOAT",
      },
    ]),
    textDecoration: "NONE",
  });
  assert.equal(ir.type?.textDecoration, "none");
});

test("hashed v29 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v29.ts");
  assert.equal(
    sha256(bytes),
    "95eebb6dcc343d3a715989b836dbe4650cc9bbe798b880382a1a0bda49e60a51",
  );
  assert.equal(bytes.byteLength, 55315);
});

test("v65 omits content-row clipsContent that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ...surfaceScene([]),
    name: "input-field/content-row :: Row",
    clipsContent: true,
  });
  assert.equal(ir.role, "input-field/content-row");
  assert.equal(ir.clipsContent, undefined);
  assert.equal(
    INPUT_LIVE_V65_CONTENT_ROW_CLIPS_CONTENT_OMITTED_MARKER,
    "INPUT-CONTENT-ROW-CLIPS-CONTENT-OMITTED",
  );
});

test("v65 omits label-row clipsContent that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ...surfaceScene([]),
    name: "input-field/label-row :: Row",
    clipsContent: true,
  });
  assert.equal(ir.role, "input-field/label-row");
  assert.equal(ir.clipsContent, undefined);
  assert.equal(
    INPUT_LIVE_V65_LABEL_ROW_CLIPS_CONTENT_OMITTED_MARKER,
    "INPUT-LABEL-ROW-CLIPS-CONTENT-OMITTED",
  );
});

test("v65 omits message-container clipsContent that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ...surfaceScene([]),
    name: "input-field/message-container :: Messages",
    clipsContent: true,
  });
  assert.equal(ir.role, "input-field/message-container");
  assert.equal(ir.clipsContent, undefined);
  assert.equal(
    INPUT_LIVE_V65_MESSAGE_CONTAINER_CLIPS_CONTENT_OMITTED_MARKER,
    "INPUT-MESSAGE-CONTAINER-CLIPS-CONTENT-OMITTED",
  );
});

test("hashed v47 scene-readback still emits message-container clipsContent true", () => {
  const ir = sceneToNormalizedIrV47({
    ...surfaceScene([]),
    name: "input-field/message-container :: Messages",
    clipsContent: true,
  });
  assert.equal(ir.role, "input-field/message-container");
  assert.equal(ir.clipsContent, true);
});

test("hashed v47 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v47.ts");
  assert.equal(
    sha256(bytes),
    "8696c4a047e0f6ec8a8a49c78db8ff725a5e4e61afe0e452ad5cd835bf11b49c",
  );
  assert.equal(bytes.byteLength, 60898);
});

test("v65 does not omit clipsContent on surfaces", () => {
  const ir = sceneToNormalizedIr({
    ...surfaceScene([]),
    name: "input-field/surface :: Surface",
    clipsContent: true,
  });
  assert.equal(ir.role, "input-field/surface");
  assert.equal(ir.clipsContent, true);
});

test("hashed v38 scene-readback still emits label-row clipsContent", () => {
  const ir = sceneToNormalizedIrV38({
    ...surfaceScene([]),
    name: "input-field/label-row :: Row",
    clipsContent: true,
  });
  assert.equal(ir.role, "input-field/label-row");
  assert.equal(ir.clipsContent, true);
});

test("hashed v38 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v38.ts");
  assert.equal(
    sha256(bytes),
    "6b53b3c127c19897cc5c92f155771a69d9a443dbc75f2b97e2a6446a74889561",
  );
  assert.equal(bytes.byteLength, 58786);
});

test("hashed v30 scene-readback still emits content-row clipsContent", () => {
  const ir = sceneToNormalizedIrV30({
    ...surfaceScene([]),
    name: "input-field/content-row :: Row",
    clipsContent: true,
  });
  assert.equal(ir.role, "input-field/content-row");
  assert.equal(ir.clipsContent, true);
});

test("hashed v30 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v30.ts");
  assert.equal(
    sha256(bytes),
    "ba3f671b69a4a348a4ea910cc85d1291f43d9b4b630500b6082b1408e560ca0e",
  );
  assert.equal(bytes.byteLength, 55944);
});

test("v65 omits message-container effects that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ...surfaceScene([]),
    name: "input-field/message-container :: Messages",
    effects: [],
  });
  assert.equal(ir.role, "input-field/message-container");
  assert.equal(ir.effects, undefined);
  assert.equal(
    INPUT_LIVE_V65_MESSAGE_CONTAINER_EFFECTS_OMITTED_MARKER,
    "INPUT-MESSAGE-CONTAINER-EFFECTS-OMITTED",
  );
});

test("hashed v49 scene-readback still emits message-container effects empty array", () => {
  const ir = sceneToNormalizedIrV49({
    ...surfaceScene([]),
    name: "input-field/message-container :: Messages",
    effects: [],
  });
  assert.equal(ir.role, "input-field/message-container");
  assert.deepEqual(ir.effects, []);
});

test("hashed v49 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v49.ts");
  assert.equal(sha256(bytes), "d3206a68dbea208b2d1f612a7d1606d26c295d6648b05d3e83eff6a79efd6dc6");
  assert.equal(bytes.byteLength, 61274);
});

test("v65 does not omit effects on surfaces", () => {
  const ir = sceneToNormalizedIr({
    ...surfaceScene([]),
    name: "input-field/surface :: Surface",
    effects: [],
  });
  assert.equal(ir.role, "input-field/surface");
  assert.deepEqual(ir.effects, []);
});

test("v65 omits message-container strokes that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ...surfaceScene([]),
    name: "input-field/message-container :: Messages",
    strokes: [],
  });
  assert.equal(ir.role, "input-field/message-container");
  assert.equal(ir.strokes, undefined);
  assert.equal(
    INPUT_LIVE_V65_MESSAGE_CONTAINER_STROKES_OMITTED_MARKER,
    "INPUT-MESSAGE-CONTAINER-STROKES-OMITTED",
  );
});

test("hashed v50 scene-readback still emits message-container strokes empty array", () => {
  const ir = sceneToNormalizedIrV50({
    ...surfaceScene([]),
    name: "input-field/message-container :: Messages",
    strokes: [],
  });
  assert.equal(ir.role, "input-field/message-container");
  assert.deepEqual(ir.strokes, []);
});

test("hashed v50 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v50.ts");
  assert.equal(sha256(bytes), "60920dfdc6bc7ecf292f61f53c35ab2e5c9ef855c141ed40789e3b7a3815797e");
  assert.equal(bytes.byteLength, 61450);
});

test("v65 does not omit strokes on surfaces", () => {
  const ir = sceneToNormalizedIr({
    ...surfaceScene([]),
    name: "input-field/surface :: Surface",
    strokes: [],
  });
  assert.equal(ir.role, "input-field/surface");
  assert.deepEqual(ir.strokes, []);
});

test("v65 omits message-container cornerRadius that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ...surfaceScene([]),
    name: "input-field/message-container :: Messages",
    cornerRadius: {
      topLeft: 0,
      topRight: 0,
      bottomRight: 0,
      bottomLeft: 0,
    },
  });
  assert.equal(ir.role, "input-field/message-container");
  assert.equal(ir.cornerRadius, undefined);
  assert.equal(
    INPUT_LIVE_V65_MESSAGE_CONTAINER_CORNER_RADIUS_OMITTED_MARKER,
    "INPUT-MESSAGE-CONTAINER-CORNER-RADIUS-OMITTED",
  );
});

test("hashed v48 scene-readback still emits message-container cornerRadius zeros", () => {
  const ir = sceneToNormalizedIrV48({
    ...surfaceScene([]),
    name: "input-field/message-container :: Messages",
    cornerRadius: {
      topLeft: 0,
      topRight: 0,
      bottomRight: 0,
      bottomLeft: 0,
    },
  });
  assert.equal(ir.role, "input-field/message-container");
  assert.deepEqual(ir.cornerRadius, {
    topLeft: 0,
    topRight: 0,
    bottomRight: 0,
    bottomLeft: 0,
  });
});

test("hashed v48 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v48.ts");
  assert.equal(sha256(bytes), "ee191e3b30982ab238afea52e492ae4a15ef0ea3825e8875245c0a73e6f92d8d");
  assert.equal(bytes.byteLength, 61086);
});

test("v65 omits variant cornerRadius that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ownershipKey: "variant",
    type: "COMPONENT",
    name: "input-field/variant/medium/default/placeholder/false/none",
    width: 320,
    height: 72,
    visible: true,
    opacity: 1,
    layoutMode: "VERTICAL",
    clipsContent: false,
    effects: [],
    strokes: [],
    cornerRadius: {
      topLeft: 0,
      topRight: 0,
      bottomRight: 0,
      bottomLeft: 0,
    },
    variantProperties: {
      Size: "medium",
      State: "default",
      Content: "placeholder",
      Required: "false",
      Adornments: "none",
    },
    boundVariables: [],
    children: [],
  });
  assert.equal(ir.role, "input-field/variant/medium/default/placeholder/false/none");
  assert.equal(ir.cornerRadius, undefined);
  assert.equal(ir.clipsContent, false);
  assert.equal(ir.effects, undefined);
  assert.equal(ir.strokes, undefined);
  assert.equal(
    INPUT_LIVE_V65_VARIANT_CORNER_RADIUS_OMITTED_MARKER,
    "INPUT-VARIANT-CORNER-RADIUS-OMITTED",
  );
});

test("hashed v51 scene-readback still emits variant cornerRadius zeros", () => {
  const ir = sceneToNormalizedIrV51({
    ownershipKey: "variant",
    type: "COMPONENT",
    name: "input-field/variant/medium/default/placeholder/false/none",
    width: 320,
    height: 72,
    visible: true,
    opacity: 1,
    layoutMode: "VERTICAL",
    cornerRadius: {
      topLeft: 0,
      topRight: 0,
      bottomRight: 0,
      bottomLeft: 0,
    },
    variantProperties: {
      Size: "medium",
      State: "default",
      Content: "placeholder",
      Required: "false",
      Adornments: "none",
    },
    boundVariables: [],
    children: [],
  });
  assert.equal(ir.role, "input-field/variant/medium/default/placeholder/false/none");
  assert.deepEqual(ir.cornerRadius, {
    topLeft: 0,
    topRight: 0,
    bottomRight: 0,
    bottomLeft: 0,
  });
});

test("hashed v51 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v51.ts");
  assert.equal(sha256(bytes), "5160037b2db00cf657098bbe114cc4c0d94c70c76b39b7d1c0946ac6aa8768da");
  assert.equal(bytes.byteLength, 61626);
});

test("v65 omits variant effects that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ownershipKey: "variant",
    type: "COMPONENT",
    name: "input-field/variant/medium/default/placeholder/false/none",
    width: 320,
    height: 72,
    visible: true,
    opacity: 1,
    layoutMode: "VERTICAL",
    clipsContent: false,
    effects: [],
    strokes: [],
    variantProperties: {
      Size: "medium",
      State: "default",
      Content: "placeholder",
      Required: "false",
      Adornments: "none",
    },
    boundVariables: [],
    children: [],
  });
  assert.equal(ir.role, "input-field/variant/medium/default/placeholder/false/none");
  assert.equal(ir.effects, undefined);
  assert.equal(ir.clipsContent, false);
  assert.equal(ir.strokes, undefined);
  assert.equal(
    INPUT_LIVE_V65_VARIANT_EFFECTS_OMITTED_MARKER,
    "INPUT-VARIANT-EFFECTS-OMITTED",
  );
});

test("hashed v52 scene-readback still emits variant effects empty arrays", () => {
  const ir = sceneToNormalizedIrV52({
    ownershipKey: "variant",
    type: "COMPONENT",
    name: "input-field/variant/medium/default/placeholder/false/none",
    width: 320,
    height: 72,
    visible: true,
    opacity: 1,
    layoutMode: "VERTICAL",
    effects: [],
    variantProperties: {
      Size: "medium",
      State: "default",
      Content: "placeholder",
      Required: "false",
      Adornments: "none",
    },
    boundVariables: [],
    children: [],
  });
  assert.equal(ir.role, "input-field/variant/medium/default/placeholder/false/none");
  assert.deepEqual(ir.effects, []);
});

test("hashed v52 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v52.ts");
  assert.equal(sha256(bytes), "499d96fd912a1e1614a25a20052d63f2b0581e08bddc0da6576b7130d1a8a71b");
  assert.equal(bytes.byteLength, 62231);
});

test("v65 omits variant strokes that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ownershipKey: "variant",
    type: "COMPONENT",
    name: "input-field/variant/medium/default/placeholder/false/none",
    width: 320,
    height: 72,
    visible: true,
    opacity: 1,
    layoutMode: "VERTICAL",
    clipsContent: false,
    strokes: [],
    variantProperties: {
      Size: "medium",
      State: "default",
      Content: "placeholder",
      Required: "false",
      Adornments: "none",
    },
    boundVariables: [],
    children: [],
  });
  assert.equal(ir.role, "input-field/variant/medium/default/placeholder/false/none");
  assert.equal(ir.strokes, undefined);
  assert.equal(ir.clipsContent, false);
  assert.equal(
    INPUT_LIVE_V65_VARIANT_STROKES_OMITTED_MARKER,
    "INPUT-VARIANT-STROKES-OMITTED",
  );
});

test("hashed v53 scene-readback still emits variant strokes empty arrays", () => {
  const ir = sceneToNormalizedIrV53({
    ownershipKey: "variant",
    type: "COMPONENT",
    name: "input-field/variant/medium/default/placeholder/false/none",
    width: 320,
    height: 72,
    visible: true,
    opacity: 1,
    layoutMode: "VERTICAL",
    strokes: [],
    variantProperties: {
      Size: "medium",
      State: "default",
      Content: "placeholder",
      Required: "false",
      Adornments: "none",
    },
    boundVariables: [],
    children: [],
  });
  assert.equal(ir.role, "input-field/variant/medium/default/placeholder/false/none");
  assert.deepEqual(ir.strokes, []);
});

test("hashed v53 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v53.ts");
  assert.equal(sha256(bytes), "df703ca45fb962cc34ee7a5cb54bac5fb6e927ebdb1a07d1b1ac2b9a4a364d50");
  assert.equal(bytes.byteLength, 62799);
});

test("hashed v54 scene-readback still emits leading-slot host binding order", () => {
  const ir = sceneToNormalizedIrV54(leadingSlotHostBindingScene("input-field/slot/leading"));
  assert.equal(ir.role, "input-field/slot/leading");
  assert.deepEqual(
    (ir.bindings ?? []).map((binding) => binding.field),
    ["height.value", "width.value", "fills.0.color"],
  );
});

test("hashed v54 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v54.ts");
  assert.equal(sha256(bytes), "4cc8f210f962c80aed7208102d88b66aff91d418a3438862c067ef91a47b62eb");
  assert.equal(bytes.byteLength, 63367);
});

test("hashed v55 scene-readback still emits trailing-slot host binding order", () => {
  const ir = sceneToNormalizedIrV55(leadingSlotHostBindingScene("input-field/slot/trailing"));
  assert.equal(ir.role, "input-field/slot/trailing");
  assert.deepEqual(
    (ir.bindings ?? []).map((binding) => binding.field),
    ["height.value", "width.value", "fills.0.color"],
  );
});

test("hashed v55 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v55.ts");
  assert.equal(sha256(bytes), "642790c1e59d7af8f90585b6bd5bb2cd8d5b71a14a21ee2c82009eb6b24f9b76");
  assert.equal(bytes.byteLength, 64469);
});

test("v65 orders leading-slot bindings to compile field order", () => {
  const ir = sceneToNormalizedIr(leadingSlotHostBindingScene("input-field/slot/leading"));
  assert.equal(ir.role, "input-field/slot/leading");
  assert.deepEqual(
    (ir.bindings ?? []).map((binding) => binding.field),
    ["fills.0.color", "width.value", "height.value"],
  );
  assert.deepEqual(
    [...INPUT_LIVE_V65_LEADING_SLOT_COMPILE_BINDING_FIELDS],
    ["fills.0.color", "width.value", "height.value"],
  );
  assert.deepEqual([...INPUT_LIVE_V65_LEADING_SLOT_ROLES], [
    "input-field/slot/leading",
  ]);
  assert.equal(
    INPUT_LIVE_V65_LEADING_SLOT_BINDING_COMPILE_ORDER_MARKER,
    "INPUT-LEADING-SLOT-BINDING-COMPILE-ORDER",
  );
});

test("v65 orders trailing-slot bindings to compile field order", () => {
  const ir = sceneToNormalizedIr(leadingSlotHostBindingScene("input-field/slot/trailing"));
  assert.equal(ir.role, "input-field/slot/trailing");
  assert.deepEqual(
    (ir.bindings ?? []).map((binding) => binding.field),
    ["fills.0.color", "width.value", "height.value"],
  );
  assert.deepEqual(
    [...INPUT_LIVE_V65_TRAILING_SLOT_COMPILE_BINDING_FIELDS],
    ["fills.0.color", "width.value", "height.value"],
  );
  assert.deepEqual([...INPUT_LIVE_V65_TRAILING_SLOT_ROLES], [
    "input-field/slot/trailing",
  ]);
  assert.equal(
    INPUT_LIVE_V65_TRAILING_SLOT_BINDING_COMPILE_ORDER_MARKER,
    "INPUT-TRAILING-SLOT-BINDING-COMPILE-ORDER",
  );
});

test("hashed v56 scene-readback still emits required-indicator duplicate fills.0.color first", () => {
  const ir = sceneToNormalizedIrV56(
    requiredIndicatorScene(requiredIndicatorHostBindings),
  );
  assert.equal(ir.role, "input-field/required-indicator");
  assert.deepEqual(
    (ir.bindings ?? []).map((binding) => binding.field),
    [
      "fills.0.color",
      "fills.0.color",
      "type.fontSize",
      "type.lineHeight.value",
    ],
  );
});

test("hashed v56 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v56.ts");
  assert.equal(
    sha256(bytes),
    "e4491546aa1a1c7a7037bab2e8a46008254fe6a13e38e83da14118692b16c132",
  );
  assert.equal(bytes.byteLength, 65681);
});

test("v65 drops required-indicator duplicate fills.0.color and orders remaining bindings to compile field order", () => {
  const ir = sceneToNormalizedIr(
    requiredIndicatorScene(requiredIndicatorHostBindings),
  );
  assert.equal(ir.role, "input-field/required-indicator");
  assert.deepEqual(
    (ir.bindings ?? []).map((binding) => binding.field),
    [...INPUT_LIVE_V65_REQUIRED_INDICATOR_COMPILE_BINDING_FIELDS],
  );
  assert.deepEqual(
    [...INPUT_LIVE_V65_REQUIRED_INDICATOR_COMPILE_BINDING_FIELDS],
    ["type.fontSize", "type.lineHeight.value", "fills.0.color"],
  );
  assert.deepEqual([...INPUT_LIVE_V65_REQUIRED_INDICATOR_ROLES], [
    "input-field/required-indicator",
  ]);
  assert.equal(
    INPUT_LIVE_V65_REQUIRED_INDICATOR_BINDING_EXTRAS_MARKER,
    "INPUT-REQUIRED-INDICATOR-BINDING-EXTRAS-DROP",
  );
  assert.equal(
    INPUT_LIVE_V65_REQUIRED_INDICATOR_BINDING_COMPILE_ORDER_MARKER,
    "INPUT-REQUIRED-INDICATOR-BINDING-COMPILE-ORDER",
  );
});

test("hashed v57 scene-readback still emits required-indicator letterSpacing", () => {
  const ir = sceneToNormalizedIrV57({
    ...requiredIndicatorScene(requiredIndicatorHostBindings),
    letterSpacing: { unit: "PERCENT", value: 0 },
    textCase: "ORIGINAL",
  });
  assert.equal(ir.role, "input-field/required-indicator");
  assert.deepEqual(ir.type?.letterSpacing, { unit: "percent", value: 0 });
  assert.equal(ir.type?.textCase, "original");
});

test("hashed v57 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v57.ts");
  assert.equal(
    sha256(bytes),
    "a46a9f703023dbc7d15a6f7f4e06704310a1e0f4e488e615eeeef1aef2232add",
  );
  assert.equal(bytes.byteLength, 67816);
});

test("v65 omits required-indicator letterSpacing that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ...requiredIndicatorScene(requiredIndicatorHostBindings),
    letterSpacing: { unit: "PERCENT", value: 0 },
    textCase: "ORIGINAL",
  });
  assert.equal(ir.role, "input-field/required-indicator");
  assert.equal(ir.type?.letterSpacing, undefined);
  assert.equal(
    INPUT_LIVE_V65_REQUIRED_INDICATOR_LETTER_SPACING_OMITTED_MARKER,
    "INPUT-REQUIRED-INDICATOR-LETTER-SPACING-OMITTED",
  );
});

test("hashed v58 scene-readback still emits required-indicator textCase", () => {
  const ir = sceneToNormalizedIrV58({
    ...requiredIndicatorScene(requiredIndicatorHostBindings),
    letterSpacing: { unit: "PERCENT", value: 0 },
    textCase: "ORIGINAL",
  });
  assert.equal(ir.role, "input-field/required-indicator");
  assert.equal(ir.type?.letterSpacing, undefined);
  assert.equal(ir.type?.textCase, "original");
});

test("hashed v58 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v58.ts");
  assert.equal(
    sha256(bytes),
    "76f3bab2e9bcd17b4aab5067cb0ededae2f7e07f051c7ddf787789cfbabec691",
  );
  assert.equal(bytes.byteLength, 68375);
});

test("v65 omits required-indicator textCase that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ...requiredIndicatorScene(requiredIndicatorHostBindings),
    letterSpacing: { unit: "PERCENT", value: 0 },
    textCase: "ORIGINAL",
    textDecoration: "NONE",
  });
  assert.equal(ir.role, "input-field/required-indicator");
  assert.equal(ir.type?.letterSpacing, undefined);
  assert.equal(ir.type?.textCase, undefined);
  assert.equal(
    INPUT_LIVE_V65_REQUIRED_INDICATOR_TEXT_CASE_OMITTED_MARKER,
    "INPUT-REQUIRED-INDICATOR-TEXT-CASE-OMITTED",
  );
});

test("hashed v59 scene-readback still emits required-indicator textDecoration", () => {
  const ir = sceneToNormalizedIrV59({
    ...requiredIndicatorScene(requiredIndicatorHostBindings),
    letterSpacing: { unit: "PERCENT", value: 0 },
    textCase: "ORIGINAL",
    textDecoration: "NONE",
  });
  assert.equal(ir.role, "input-field/required-indicator");
  assert.equal(ir.type?.letterSpacing, undefined);
  assert.equal(ir.type?.textCase, undefined);
  assert.equal(ir.type?.textDecoration, "none");
});

test("hashed v59 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v59.ts");
  assert.equal(
    sha256(bytes),
    "2c4592161da30d317ef6e84613c95d041ddca0edaa7fba80a7376c57c9bcd2f9",
  );
  assert.equal(bytes.byteLength, 68896);
});

test("v65 omits required-indicator textDecoration that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ...requiredIndicatorScene(requiredIndicatorHostBindings),
    letterSpacing: { unit: "PERCENT", value: 0 },
    textCase: "ORIGINAL",
    textDecoration: "NONE",
  });
  assert.equal(ir.role, "input-field/required-indicator");
  assert.equal(ir.type?.letterSpacing, undefined);
  assert.equal(ir.type?.textCase, undefined);
  assert.equal(ir.type?.textDecoration, undefined);
  assert.equal(
    INPUT_LIVE_V65_REQUIRED_INDICATOR_TEXT_DECORATION_OMITTED_MARKER,
    "INPUT-REQUIRED-INDICATOR-TEXT-DECORATION-OMITTED",
  );
});

const setScene = (): SceneNodeSnapshot => ({
  ownershipKey: "set",
  type: "COMPONENT_SET",
  name: "input-field/set :: Input Field",
  width: 320,
  height: 72,
  visible: true,
  opacity: 1,
  layoutMode: "NONE",
  clipsContent: false,
  fills: [],
  strokes: [],
  effects: [],
  cornerRadius: {
    topLeft: 5,
    topRight: 5,
    bottomRight: 5,
    bottomLeft: 5,
  },
  variantGroupProperties: {
    Size: { values: ["medium", "small"] },
  },
  boundVariables: [],
  children: [
    {
      ownershipKey: "set/variant",
      type: "COMPONENT",
      name: "input-field/variant/medium/default/placeholder/false/none",
      width: 320,
      height: 72,
      visible: true,
      opacity: 1,
      layoutMode: "VERTICAL",
      clipsContent: false,
      variantProperties: {
        Size: "medium",
        State: "default",
        Content: "placeholder",
        Required: "false",
        Adornments: "none",
      },
      boundVariables: [],
      children: [],
    },
  ],
});

test("hashed v60 scene-readback still emits set cornerRadius {5,5,5,5}", () => {
  const ir = sceneToNormalizedIrV60(setScene());
  assert.equal(ir.role, "input-field/set");
  assert.deepEqual(ir.cornerRadius, {
    topLeft: 5,
    topRight: 5,
    bottomRight: 5,
    bottomLeft: 5,
  });
  assert.equal(ir.clipsContent, false);
});

test("hashed v60 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v60.ts");
  assert.equal(
    sha256(bytes),
    "c0241c506cc15811b2d483a3d7622c583b25d1e4878527b4ddfaabc72a19b4d1",
  );
  assert.equal(bytes.byteLength, 69464);
});

test("v65 omits set cornerRadius that compile never emits", () => {
  const ir = sceneToNormalizedIr(setScene());
  assert.equal(ir.role, "input-field/set");
  assert.equal(ir.kind, "component-set");
  assert.equal(ir.cornerRadius, undefined);
  assert.equal(ir.clipsContent, false);
  assert.deepEqual(ir.strokes, []);
  assert.equal(
    INPUT_LIVE_V65_SET_CORNER_RADIUS_OMITTED_MARKER,
    "INPUT-SET-CORNER-RADIUS-OMITTED",
  );
});

test("hashed v61 scene-readback still emits set effects []", () => {
  const ir = sceneToNormalizedIrV61(setScene());
  assert.equal(ir.role, "input-field/set");
  assert.deepEqual(ir.effects, []);
  assert.equal(ir.cornerRadius, undefined);
  assert.equal(ir.clipsContent, false);
});

test("hashed v61 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v61.ts");
  assert.equal(
    sha256(bytes),
    "a0070b62de97fb0a29882fc87a3eed9537e390ecc18be987d5cd8c428d3f11b9",
  );
  assert.equal(bytes.byteLength, 70038);
});

test("v65 omits set effects that compile never emits", () => {
  const ir = sceneToNormalizedIr(setScene());
  assert.equal(ir.role, "input-field/set");
  assert.equal(ir.kind, "component-set");
  assert.equal(ir.effects, undefined);
  assert.deepEqual(ir.strokes, []);
  assert.equal(ir.clipsContent, false);
  assert.equal(
    INPUT_LIVE_V65_SET_EFFECTS_OMITTED_MARKER,
    "INPUT-SET-EFFECTS-OMITTED",
  );
});

test("hashed v62 scene-readback still emits set fills [{solid #f7f7f8ff}]", () => {
  const ir = sceneToNormalizedIrV62({
    ...setScene(),
    fills: [{ type: "SOLID", color: "#f7f7f8ff" }],
  });
  assert.equal(ir.role, "input-field/set");
  assert.deepEqual(ir.fills, [{ kind: "solid", color: "#f7f7f8ff" }]);
  assert.equal(ir.effects, undefined);
  assert.equal(ir.clipsContent, false);
});

test("hashed v62 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v62.ts");
  assert.equal(
    sha256(bytes),
    "ffcb094fe6df6afa9c4312e21fbca61ca581253a70c32fa06e05ff3700638aaf",
  );
  assert.equal(bytes.byteLength, 70510);
});

test("v65 omits set fills that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ...setScene(),
    fills: [{ type: "SOLID", color: "#f7f7f8ff" }],
  });
  assert.equal(ir.role, "input-field/set");
  assert.equal(ir.kind, "component-set");
  assert.deepEqual(ir.fills, []);
  assert.deepEqual(ir.strokes, []);
  assert.equal(ir.clipsContent, false);
  assert.equal(ir.effects, undefined);
  assert.equal(
    INPUT_LIVE_V65_SET_FILLS_OMITTED_MARKER,
    "INPUT-SET-FILLS-OMITTED",
  );
});

test("hashed v63 scene-readback still emits set layout.mode from the scene", () => {
  const ir = sceneToNormalizedIrV63({
    ...setScene(),
    layoutMode: "HORIZONTAL",
  });
  assert.equal(ir.role, "input-field/set");
  assert.equal(ir.layout.mode, "horizontal");
});

test("hashed v63 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v63.ts");
  assert.equal(
    sha256(bytes),
    "610618d19a004e96d7d58a4eeffa43c48c6b453153293bc9c47cb49f2397ede9",
  );
  assert.equal(bytes.byteLength, 71042);
});

test("v65 host-normalize emits set layout.mode horizontal from HORIZONTAL", () => {
  const ir = sceneToNormalizedIr({
    ...setScene(),
    layoutMode: "HORIZONTAL",
  });
  assert.equal(ir.role, "input-field/set");
  assert.equal(ir.kind, "component-set");
  assert.equal(ir.layout.mode, "horizontal");
  assert.equal(ir.clipsContent, false);
  assert.deepEqual(ir.strokes, []);
});

test("v65 does not omit set layout.mode that compile emits", () => {
  const ir = sceneToNormalizedIr({
    ...setScene(),
    layoutMode: "HORIZONTAL",
  });
  assert.equal(ir.role, "input-field/set");
  assert.equal(ir.layout.mode, "horizontal");
});

test("v65 does not omit set clipsContent that compile emits", () => {
  const ir = sceneToNormalizedIr({
    ...setScene(),
    clipsContent: false,
  });
  assert.equal(ir.role, "input-field/set");
  assert.equal(ir.clipsContent, false);
});

test("v65 keeps variant clipsContent present and variant cornerRadius absent", () => {
  const ir = sceneToNormalizedIr({
    ownershipKey: "variant",
    type: "COMPONENT",
    name: "input-field/variant/medium/default/placeholder/false/none",
    width: 320,
    height: 72,
    visible: true,
    opacity: 1,
    layoutMode: "VERTICAL",
    clipsContent: false,
    effects: [],
    strokes: [],
    cornerRadius: {
      topLeft: 0,
      topRight: 0,
      bottomRight: 0,
      bottomLeft: 0,
    },
    variantProperties: {
      Size: "medium",
      State: "default",
      Content: "placeholder",
      Required: "false",
      Adornments: "none",
    },
    boundVariables: [],
    children: [],
  });
  assert.equal(
    ir.role,
    "input-field/variant/medium/default/placeholder/false/none",
  );
  assert.equal(ir.clipsContent, false);
  assert.equal(ir.cornerRadius, undefined);
});

test("v65 does not omit cornerRadius on surfaces", () => {
  const ir = sceneToNormalizedIr({
    ...surfaceScene([]),
    name: "input-field/surface :: Surface",
    cornerRadius: {
      topLeft: 4,
      topRight: 4,
      bottomRight: 4,
      bottomLeft: 4,
    },
  });
  assert.equal(ir.role, "input-field/surface");
  assert.deepEqual(ir.cornerRadius, {
    topLeft: 4,
    topRight: 4,
    bottomRight: 4,
    bottomLeft: 4,
  });
});

test("v65 omits content-row cornerRadius that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ...surfaceScene([]),
    name: "input-field/content-row :: Row",
    cornerRadius: {
      topLeft: 0,
      topRight: 0,
      bottomRight: 0,
      bottomLeft: 0,
    },
  });
  assert.equal(ir.role, "input-field/content-row");
  assert.equal(ir.cornerRadius, undefined);
  assert.equal(
    INPUT_LIVE_V65_CONTENT_ROW_CORNER_RADIUS_OMITTED_MARKER,
    "INPUT-CONTENT-ROW-CORNER-RADIUS-OMITTED",
  );
});

test("v65 omits label-row cornerRadius that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ...surfaceScene([]),
    name: "input-field/label-row :: Row",
    cornerRadius: {
      topLeft: 0,
      topRight: 0,
      bottomRight: 0,
      bottomLeft: 0,
    },
  });
  assert.equal(ir.role, "input-field/label-row");
  assert.equal(ir.cornerRadius, undefined);
  assert.equal(
    INPUT_LIVE_V65_LABEL_ROW_CORNER_RADIUS_OMITTED_MARKER,
    "INPUT-LABEL-ROW-CORNER-RADIUS-OMITTED",
  );
});

test("hashed v39 scene-readback still emits label-row cornerRadius", () => {
  const ir = sceneToNormalizedIrV39({
    ...surfaceScene([]),
    name: "input-field/label-row :: Row",
    cornerRadius: {
      topLeft: 0,
      topRight: 0,
      bottomRight: 0,
      bottomLeft: 0,
    },
  });
  assert.equal(ir.role, "input-field/label-row");
  assert.deepEqual(ir.cornerRadius, {
    topLeft: 0,
    topRight: 0,
    bottomRight: 0,
    bottomLeft: 0,
  });
});

test("hashed v39 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v39.ts");
  assert.equal(
    sha256(bytes),
    "39d5dc991857826a742dca1a3f4b5bac14971eaa71bb2d9e804d693ab8b70418",
  );
  assert.equal(bytes.byteLength, 58938);
});

test("hashed v31 scene-readback still emits content-row cornerRadius", () => {
  const ir = sceneToNormalizedIrV31({
    ...surfaceScene([]),
    name: "input-field/content-row :: Row",
    cornerRadius: {
      topLeft: 0,
      topRight: 0,
      bottomRight: 0,
      bottomLeft: 0,
    },
  });
  assert.equal(ir.role, "input-field/content-row");
  assert.deepEqual(ir.cornerRadius, {
    topLeft: 0,
    topRight: 0,
    bottomRight: 0,
    bottomLeft: 0,
  });
});

test("hashed v31 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v31.ts");
  assert.equal(
    sha256(bytes),
    "700ce0a06982ead66076fd5f5b39bc3cbe3de37467b7e8d531f34469dc33f2ab",
  );
  assert.equal(bytes.byteLength, 56524);
});

test("v65 omits content-row effects that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ...surfaceScene([]),
    name: "input-field/content-row :: Row",
    effects: [],
  });
  assert.equal(ir.role, "input-field/content-row");
  assert.equal(ir.effects, undefined);
  assert.equal(
    INPUT_LIVE_V65_CONTENT_ROW_EFFECTS_OMITTED_MARKER,
    "INPUT-CONTENT-ROW-EFFECTS-OMITTED",
  );
});

test("v65 omits label-row effects that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ...surfaceScene([]),
    name: "input-field/label-row :: Row",
    effects: [],
  });
  assert.equal(ir.role, "input-field/label-row");
  assert.equal(ir.effects, undefined);
  assert.equal(
    INPUT_LIVE_V65_LABEL_ROW_EFFECTS_OMITTED_MARKER,
    "INPUT-LABEL-ROW-EFFECTS-OMITTED",
  );
});

test("hashed v40 scene-readback still emits label-row effects", () => {
  const ir = sceneToNormalizedIrV40({
    ...surfaceScene([]),
    name: "input-field/label-row :: Row",
    effects: [],
  });
  assert.equal(ir.role, "input-field/label-row");
  assert.deepEqual(ir.effects, []);
});

test("hashed v40 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v40.ts");
  assert.equal(
    sha256(bytes),
    "8256184bf54a8a8af3c5be36c2d52229cfaedb63b89dcb0b6f75d58c8700c604",
  );
  assert.equal(bytes.byteLength, 59106);
});

test("hashed v32 scene-readback still emits content-row effects", () => {
  const ir = sceneToNormalizedIrV32({
    ...surfaceScene([]),
    name: "input-field/content-row :: Row",
    effects: [],
  });
  assert.equal(ir.role, "input-field/content-row");
  assert.deepEqual(ir.effects, []);
});

test("v65 omits content-row strokes that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ...surfaceScene([]),
    name: "input-field/content-row :: Row",
    strokes: [],
  });
  assert.equal(ir.role, "input-field/content-row");
  assert.equal(ir.strokes, undefined);
  assert.equal(
    INPUT_LIVE_V65_CONTENT_ROW_STROKES_OMITTED_MARKER,
    "INPUT-CONTENT-ROW-STROKES-OMITTED",
  );
});

test("v65 omits label-row strokes that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ...surfaceScene([]),
    name: "input-field/label-row :: Row",
    strokes: [],
  });
  assert.equal(ir.role, "input-field/label-row");
  assert.equal(ir.strokes, undefined);
  assert.equal(
    INPUT_LIVE_V65_LABEL_ROW_STROKES_OMITTED_MARKER,
    "INPUT-LABEL-ROW-STROKES-OMITTED",
  );
});

test("hashed v41 scene-readback still emits label-row strokes", () => {
  const ir = sceneToNormalizedIrV41({
    ...surfaceScene([]),
    name: "input-field/label-row :: Row",
    strokes: [],
  });
  assert.equal(ir.role, "input-field/label-row");
  assert.deepEqual(ir.strokes, []);
});

test("hashed v41 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v41.ts");
  assert.equal(
    sha256(bytes),
    "5b543463e8bf6ee5f833059cc04cd3a510b05524db99cab5f3fc05754c20624d",
  );
  assert.equal(bytes.byteLength, 59246);
});

const surfaceStrokeScene = (): SceneNodeSnapshot => ({
  ...surfaceScene([]),
  strokes: [{ type: "SOLID", color: "#111111ff" }],
  strokeWeight: 1,
  strokeAlign: "INSIDE",
  dashPattern: [],
});

test("v65 omits surface stroke dashPattern that compile never emits", () => {
  const ir = sceneToNormalizedIr(surfaceStrokeScene());
  assert.equal(ir.role, "input-field/surface");
  assert.equal(ir.kind, "frame");
  const frame = ir as Extract<IRNode, { kind: "frame" }>;
  assert.equal(frame.strokes?.[0]?.dashPattern, undefined);
  assert.equal(frame.strokes?.[0]?.weight, 1);
  assert.equal(frame.strokes?.[0]?.align, "inside");
  assert.deepEqual(frame.strokes?.[0]?.paint, {
    kind: "solid",
    color: "#111111ff",
  });
  assert.equal(
    INPUT_LIVE_V65_SURFACE_STROKE_DASH_PATTERN_OMITTED_MARKER,
    "INPUT-SURFACE-STROKE-DASH-PATTERN-OMITTED",
  );
});

test("hashed v42 scene-readback still emits surface stroke dashPattern", () => {
  const ir = sceneToNormalizedIrV42(surfaceStrokeScene());
  assert.equal(ir.role, "input-field/surface");
  assert.equal(ir.kind, "frame");
  const frame = ir as Extract<IRNode, { kind: "frame" }>;
  assert.deepEqual(frame.strokes?.[0]?.dashPattern, []);
});

test("hashed v42 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v42.ts");
  assert.equal(
    sha256(bytes),
    "670aba5fe07b423a6cfd9851ddbd5e3a57a404980b8039bcb6a8fb1d1adee186",
  );
  assert.equal(bytes.byteLength, 59386);
});

const messageHelperHostBindings = (): SceneNodeSnapshot["boundVariables"] => [
  {
    field: "fills.0.color",
    variableName: "imported.text-field.default.message-text",
    resolvedType: "COLOR",
  },
  {
    field: "type.fontSize",
    variableName: "imported.text-field.medium.message-font-size",
    resolvedType: "FLOAT",
  },
  {
    field: "type.lineHeight.value",
    variableName: "imported.text-field.medium.message-line-height",
    resolvedType: "FLOAT",
  },
];

const leadingSlotHostBindingScene = (
  role: "input-field/slot/leading" | "input-field/slot/trailing",
): SceneNodeSnapshot => ({
  ownershipKey: "adornment",
  type: "INSTANCE",
  name: `${role} :: x`,
  width: 16,
  height: 16,
  visible: true,
  opacity: 1,
  componentRef: "test.currency",
  fills: [],
  boundVariables: [
    {
      field: "height.value",
      variableName: "imported.text-field.medium.adornment-size",
      resolvedType: "FLOAT",
    },
    {
      field: "width.value",
      variableName: "imported.text-field.medium.leading-adornment-extent",
      resolvedType: "FLOAT",
    },
    {
      field: "fills.0.color",
      variableName: "imported.text-field.default.adornment-text",
      resolvedType: "COLOR",
    },
  ],
  children: [],
});
const messageScene = (
  role: "input-field/message/helper" | "input-field/message/error",
  boundVariables: SceneNodeSnapshot["boundVariables"],
): SceneNodeSnapshot => ({
  ownershipKey: "message",
  type: "TEXT",
  name: `${role} :: Helper`,
  width: 120,
  height: 20,
  visible: true,
  opacity: 1,
  fontName: { family: "Roboto", style: "Regular" },
  fontSize: 12,
  characters: "Helper",
  boundVariables,
  children: [],
});

test("v65 orders message/helper bindings to compile field order", () => {
  const ir = sceneToNormalizedIr(
    messageScene("input-field/message/helper", messageHelperHostBindings()),
  );
  assert.equal(ir.role, "input-field/message/helper");
  assert.deepEqual(
    (ir.bindings ?? []).map((binding) => binding.field),
    ["type.fontSize", "type.lineHeight.value", "fills.0.color"],
  );
  assert.equal(
    INPUT_LIVE_V65_MESSAGE_BINDING_COMPILE_ORDER_MARKER,
    "INPUT-MESSAGE-BINDING-COMPILE-ORDER",
  );
  assert.deepEqual([...INPUT_LIVE_V65_MESSAGE_ROLES], [
    "input-field/message/helper",
    "input-field/message/error",
  ]);
});

test("v65 orders message/error bindings to compile field order", () => {
  const ir = sceneToNormalizedIr(
    messageScene("input-field/message/error", messageHelperHostBindings()),
  );
  assert.equal(ir.role, "input-field/message/error");
  assert.deepEqual(
    (ir.bindings ?? []).map((binding) => binding.field),
    ["type.fontSize", "type.lineHeight.value", "fills.0.color"],
  );
});

test("hashed v43 scene-readback still emits message/helper fills.0.color first", () => {
  const ir = sceneToNormalizedIrV43(
    messageScene("input-field/message/helper", messageHelperHostBindings()),
  );
  assert.equal(ir.role, "input-field/message/helper");
  assert.deepEqual(
    (ir.bindings ?? []).map((binding) => binding.field),
    ["fills.0.color", "type.fontSize", "type.lineHeight.value"],
  );
});

test("hashed v43 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v43.ts");
  assert.equal(
    sha256(bytes),
    "9760800b8bcda2cb7dce79c4bacc29d43f0dc66962f6b7d44de2a11e552cb909",
  );
  assert.equal(bytes.byteLength, 60107);
});

test("v65 omits message/helper letterSpacing that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ...messageScene("input-field/message/helper", []),
    letterSpacing: { unit: "PERCENT", value: 0 },
  });
  assert.equal(ir.role, "input-field/message/helper");
  assert.equal(ir.type?.letterSpacing, undefined);
  assert.equal(
    INPUT_LIVE_V65_MESSAGE_LETTER_SPACING_OMITTED_MARKER,
    "INPUT-MESSAGE-LETTER-SPACING-OMITTED",
  );
});

test("v65 omits message/error letterSpacing that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ...messageScene("input-field/message/error", []),
    letterSpacing: { unit: "PERCENT", value: 0 },
  });
  assert.equal(ir.role, "input-field/message/error");
  assert.equal(ir.type?.letterSpacing, undefined);
});

test("hashed v44 scene-readback still emits message/helper letterSpacing", () => {
  const ir = sceneToNormalizedIrV44({
    ...messageScene("input-field/message/helper", []),
    letterSpacing: { unit: "PERCENT", value: 0 },
  });
  assert.equal(ir.role, "input-field/message/helper");
  assert.deepEqual(ir.type?.letterSpacing, { unit: "percent", value: 0 });
});

test("hashed v44 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v44.ts");
  assert.equal(
    sha256(bytes),
    "3093131174abb7f493d34898f1fe8b6f96b6b0b3986694b9522f42f6cf3c91f7",
  );
  assert.equal(bytes.byteLength, 60582);
});

test("v65 omits message/helper textCase that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ...messageScene("input-field/message/helper", []),
    textCase: "ORIGINAL",
  });
  assert.equal(ir.role, "input-field/message/helper");
  assert.equal(ir.type?.textCase, undefined);
  assert.equal(
    INPUT_LIVE_V65_MESSAGE_TEXT_CASE_OMITTED_MARKER,
    "INPUT-MESSAGE-TEXT-CASE-OMITTED",
  );
});

test("v65 omits message/error textCase that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ...messageScene("input-field/message/error", []),
    textCase: "ORIGINAL",
  });
  assert.equal(ir.role, "input-field/message/error");
  assert.equal(ir.type?.textCase, undefined);
});

test("hashed v45 scene-readback still emits message/helper textCase original", () => {
  const ir = sceneToNormalizedIrV45({
    ...messageScene("input-field/message/helper", []),
    textCase: "ORIGINAL",
  });
  assert.equal(ir.role, "input-field/message/helper");
  assert.equal(ir.type?.textCase, "original");
});

test("hashed v45 scene-readback still emits message/error textCase original", () => {
  const ir = sceneToNormalizedIrV45({
    ...messageScene("input-field/message/error", []),
    textCase: "ORIGINAL",
  });
  assert.equal(ir.role, "input-field/message/error");
  assert.equal(ir.type?.textCase, "original");
});

test("hashed v45 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v45.ts");
  assert.equal(
    sha256(bytes),
    "70b2b9bb3ae82f3f7425267ff165a7e6595f1254657be1888b39d00d4d14369e",
  );
  assert.equal(bytes.byteLength, 60680);
});

test("v65 omits message/helper textDecoration that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ...messageScene("input-field/message/helper", []),
    textDecoration: "NONE",
  });
  assert.equal(ir.role, "input-field/message/helper");
  assert.equal(ir.type?.textDecoration, undefined);
  assert.equal(
    INPUT_LIVE_V65_MESSAGE_TEXT_DECORATION_OMITTED_MARKER,
    "INPUT-MESSAGE-TEXT-DECORATION-OMITTED",
  );
});

test("v65 omits message/error textDecoration that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ...messageScene("input-field/message/error", []),
    textDecoration: "NONE",
  });
  assert.equal(ir.role, "input-field/message/error");
  assert.equal(ir.type?.textDecoration, undefined);
});

test("hashed v46 scene-readback still emits message/helper textDecoration none", () => {
  const ir = sceneToNormalizedIrV46({
    ...messageScene("input-field/message/helper", []),
    textDecoration: "NONE",
  });
  assert.equal(ir.role, "input-field/message/helper");
  assert.equal(ir.type?.textDecoration, "none");
});

test("hashed v46 scene-readback still emits message/error textDecoration none", () => {
  const ir = sceneToNormalizedIrV46({
    ...messageScene("input-field/message/error", []),
    textDecoration: "NONE",
  });
  assert.equal(ir.role, "input-field/message/error");
  assert.equal(ir.type?.textDecoration, "none");
});

test("hashed v46 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v46.ts");
  assert.equal(
    sha256(bytes),
    "8e81de6ed4a199eb2563881cba5b82a7d41e4e7acaa462250a1525f10c6374df",
  );
  assert.equal(bytes.byteLength, 60779);
});

test("v65 does not omit surface stroke dashPattern when the host value is not empty", () => {
  const ir = sceneToNormalizedIr({
    ...surfaceStrokeScene(),
    dashPattern: [2, 2],
  });
  const frame = ir as Extract<IRNode, { kind: "frame" }>;
  assert.deepEqual(frame.strokes?.[0]?.dashPattern, [2, 2]);
});

test("v65 does not lift surface dashPattern omit onto a non-surface frame", () => {
  const ir = sceneToNormalizedIr({
    ...surfaceStrokeScene(),
    name: "other :: Frame",
  });
  assert.equal(ir.role, undefined);
  const frame = ir as Extract<IRNode, { kind: "frame" }>;
  assert.deepEqual(frame.strokes?.[0]?.dashPattern, []);
});

test("v65 drops duplicate label bindings and orders remaining fields to compile", () => {
  const ir = sceneToNormalizedIr(
    labelScene([
      {
        field: "fills.0.color",
        variableName: "imported.text-field.default.label-text",
        resolvedType: "COLOR",
      },
      {
        field: "fills.0",
        variableName: "imported.text-field.default.label-text",
        resolvedType: "COLOR",
      },
      {
        field: "fontSize.0",
        variableName: "imported.text-field.medium.label-font-size",
        resolvedType: "FLOAT",
      },
      {
        field: "lineHeight.0",
        variableName: "imported.text-field.medium.label-line-height",
        resolvedType: "FLOAT",
      },
    ]),
  );
  assert.equal(ir.role, "input-field/label");
  assert.deepEqual(
    (ir.bindings ?? []).map((binding) => binding.field),
    [...INPUT_LIVE_V65_CONTENT_COMPILE_BINDING_FIELDS],
  );
  assert.equal(
    INPUT_LIVE_V65_LABEL_BINDING_EXTRAS_MARKER,
    "INPUT-LABEL-BINDING-EXTRAS-DROPPED",
  );
  assert.equal(
    INPUT_LIVE_V65_LABEL_BINDING_COMPILE_ORDER_MARKER,
    "INPUT-LABEL-BINDING-COMPILE-ORDER",
  );
  assert.deepEqual([...INPUT_LIVE_V65_LABEL_ROLES], ["input-field/label"]);
});

test("v65 does not apply label binding teaching to surfaces", () => {
  const ir = sceneToNormalizedIr(
    surfaceScene([
      {
        field: "fills.0.color",
        variableName: "imported.text-field.default.background",
        resolvedType: "COLOR",
      },
      {
        field: "fills.0",
        variableName: "imported.text-field.default.background",
        resolvedType: "COLOR",
      },
    ]),
  );
  assert.equal(ir.role, "input-field/surface");
  assert.ok(
    (ir.bindings ?? []).every((binding) => binding.field !== "type.fontSize"),
  );
});

test("hashed v34 scene-readback still emits label bindings in extract order", () => {
  const ir = sceneToNormalizedIrV34(
    labelScene([
      {
        field: "fills.0.color",
        variableName: "imported.text-field.default.label-text",
        resolvedType: "COLOR",
      },
      {
        field: "fills.0",
        variableName: "imported.text-field.default.label-text",
        resolvedType: "COLOR",
      },
      {
        field: "fontSize.0",
        variableName: "imported.text-field.medium.label-font-size",
        resolvedType: "FLOAT",
      },
      {
        field: "lineHeight.0",
        variableName: "imported.text-field.medium.label-line-height",
        resolvedType: "FLOAT",
      },
    ]),
  );
  assert.equal(ir.role, "input-field/label");
  assert.deepEqual(
    (ir.bindings ?? []).map((binding) => binding.field),
    [
      "fills.0.color",
      "fills.0.color",
      "type.fontSize",
      "type.lineHeight.value",
    ],
  );
});

test("hashed v34 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v34.ts");
  assert.equal(
    sha256(bytes),
    "9da3d6a6d0583cd18b778906427d369b701cf3ac1799c679186f8c5e6b60d864",
  );
  assert.equal(bytes.byteLength, 58185);
});

test("v65 omits label letterSpacing that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ownershipKey: "label",
    type: "TEXT",
    name: "input-field/label :: Label",
    width: 72,
    height: 20,
    visible: true,
    opacity: 1,
    layoutSizingHorizontal: "HUG",
    layoutSizingVertical: "HUG",
    fontName: { family: "Roboto", style: "Regular" },
    fontSize: 16,
    characters: "Store name",
    letterSpacing: { unit: "PERCENT", value: 0 },
    boundVariables: [],
    children: [],
  });
  assert.equal(ir.role, "input-field/label");
  assert.equal(ir.type?.letterSpacing, undefined);
  assert.equal(
    INPUT_LIVE_V65_LABEL_LETTER_SPACING_OMITTED_MARKER,
    "INPUT-LABEL-LETTER-SPACING-OMITTED",
  );
});

test("hashed v35 scene-readback still emits label letterSpacing", () => {
  const ir = sceneToNormalizedIrV35({
    ownershipKey: "label",
    type: "TEXT",
    name: "input-field/label :: Label",
    width: 72,
    height: 20,
    visible: true,
    opacity: 1,
    layoutSizingHorizontal: "HUG",
    layoutSizingVertical: "HUG",
    fontName: { family: "Roboto", style: "Regular" },
    fontSize: 16,
    characters: "Store name",
    letterSpacing: { unit: "PERCENT", value: 0 },
    boundVariables: [],
    children: [],
  });
  assert.equal(ir.role, "input-field/label");
  assert.deepEqual(ir.type?.letterSpacing, { unit: "percent", value: 0 });
});

test("hashed v35 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v35.ts");
  assert.equal(
    sha256(bytes),
    "efcbd6dbd43a9dce8b9ec15c2e55138f74aee0b2e4bdccf91d56201ed1e31f30",
  );
  assert.equal(bytes.byteLength, 58601);
});

test("v65 omits label textCase that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ownershipKey: "label",
    type: "TEXT",
    name: "input-field/label :: Label",
    width: 72,
    height: 20,
    visible: true,
    opacity: 1,
    layoutSizingHorizontal: "HUG",
    layoutSizingVertical: "HUG",
    fontName: { family: "Roboto", style: "Regular" },
    fontSize: 16,
    characters: "Store name",
    textCase: "ORIGINAL",
    boundVariables: [],
    children: [],
  });
  assert.equal(ir.role, "input-field/label");
  assert.equal(ir.type?.textCase, undefined);
  assert.equal(
    INPUT_LIVE_V65_LABEL_TEXT_CASE_OMITTED_MARKER,
    "INPUT-LABEL-TEXT-CASE-OMITTED",
  );
});

test("v65 omits label textDecoration that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ownershipKey: "label",
    type: "TEXT",
    name: "input-field/label :: Label",
    width: 72,
    height: 20,
    visible: true,
    opacity: 1,
    layoutSizingHorizontal: "HUG",
    layoutSizingVertical: "HUG",
    fontName: { family: "Roboto", style: "Regular" },
    fontSize: 16,
    characters: "Store name",
    textDecoration: "NONE",
    boundVariables: [],
    children: [],
  });
  assert.equal(ir.role, "input-field/label");
  assert.equal(ir.type?.textDecoration, undefined);
  assert.equal(
    INPUT_LIVE_V65_LABEL_TEXT_DECORATION_OMITTED_MARKER,
    "INPUT-LABEL-TEXT-DECORATION-OMITTED",
  );
});

test("hashed v37 scene-readback still emits label textDecoration none", () => {
  const ir = sceneToNormalizedIrV37({
    ownershipKey: "label",
    type: "TEXT",
    name: "input-field/label :: Label",
    width: 72,
    height: 20,
    visible: true,
    opacity: 1,
    layoutSizingHorizontal: "HUG",
    layoutSizingVertical: "HUG",
    fontName: { family: "Roboto", style: "Regular" },
    fontSize: 16,
    characters: "Store name",
    textDecoration: "NONE",
    boundVariables: [],
    children: [],
  });
  assert.equal(ir.role, "input-field/label");
  assert.equal(ir.type?.textDecoration, "none");
});

test("hashed v37 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v37.ts");
  assert.equal(
    sha256(bytes),
    "625de907cc42fd2b616c1de1a366c753dd179ca86086ffb6d3b83f00aa03c47d",
  );
  assert.equal(bytes.byteLength, 58699);
});

test("hashed v36 scene-readback still emits label textCase original", () => {
  const ir = sceneToNormalizedIrV36({
    ownershipKey: "label",
    type: "TEXT",
    name: "input-field/label :: Label",
    width: 72,
    height: 20,
    visible: true,
    opacity: 1,
    layoutSizingHorizontal: "HUG",
    layoutSizingVertical: "HUG",
    fontName: { family: "Roboto", style: "Regular" },
    fontSize: 16,
    characters: "Store name",
    textCase: "ORIGINAL",
    boundVariables: [],
    children: [],
  });
  assert.equal(ir.role, "input-field/label");
  assert.equal(ir.type?.textCase, "original");
});

test("hashed v36 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v36.ts");
  assert.equal(
    sha256(bytes),
    "0991fb68b43d45d8f235b5a0197cd72e526baec98b3c057dfb7a3a6c55bb3f15",
  );
  assert.equal(bytes.byteLength, 58686);
});

test("hashed v33 scene-readback still emits content-row strokes", () => {
  const ir = sceneToNormalizedIrV33({
    ...surfaceScene([]),
    name: "input-field/content-row :: Row",
    strokes: [],
  });
  assert.equal(ir.role, "input-field/content-row");
  assert.deepEqual(ir.strokes, []);
});

test("hashed v33 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v33.ts");
  assert.equal(
    sha256(bytes),
    "421c41d4ff87720e4de3a3c60c949c2b10be7468eeab9a9ac885c0033fbed578",
  );
  assert.equal(bytes.byteLength, 57663);
});

test("hashed v32 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v32.ts");
  assert.equal(
    sha256(bytes),
    "275b30092b67d851c27226e60d20154ab0417f03d26184551ed6dfbc0c756eee",
  );
  assert.equal(bytes.byteLength, 57141);
});

test("hashed v28 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v28.ts");
  assert.equal(
    sha256(bytes),
    "44540881e24bd2e28f40917a4d6c289462f5ada0c9a30d8c565e18aad2521ac2",
  );
  assert.equal(bytes.byteLength, 54741);
});

test("hashed v24 scene-readback still leaves remaining surface bindings in encounter order", () => {
  const leftover = [
    "cornerRadius.bottomLeft",
    "cornerRadius.bottomRight",
    "fills.0.color",
    "layout.minHeight",
    "layout.minWidth",
    "layout.padding.left",
    "layout.padding.right",
    "strokes.0.paint.color",
    "cornerRadius.topLeft",
    "cornerRadius.topRight",
    "strokes.0.weight",
    "layout.height.value",
  ];
  const ir = sceneToNormalizedIrV24(
    surfaceScene(
      leftover.map((field) => ({
        field,
        variableName: `imported.surface.${field}`,
        resolvedType: field.includes("color") ? ("COLOR" as const) : ("FLOAT" as const),
      })),
    ),
  );
  assert.deepEqual(
    (ir.bindings ?? []).map((binding) => binding.field),
    leftover,
  );
});

test("hashed v21 scene-readback still keeps width.value when it also surfaces layout.width.value", () => {
  const ir = sceneToNormalizedIrV21({
    ownershipKey: "variant",
    type: "COMPONENT",
    name: "input-field/variant/small/default/placeholder/true/none",
    width: 195,
    height: 56,
    visible: true,
    opacity: 1,
    layoutMode: "VERTICAL",
    boundVariables: [
      {
        field: "width",
        variableName: "imported.text-field.small.width",
        resolvedType: "FLOAT",
      },
    ],
    children: [],
  });
  assert.equal(
    (ir.bindings ?? []).filter((binding) => binding.field === "width.value")
      .length,
    1,
  );
  assert.equal(
    (ir.bindings ?? []).filter(
      (binding) => binding.field === "layout.width.value",
    ).length,
    1,
  );
});

test("hashed v21 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v21.ts");
  assert.equal(
    sha256(bytes),
    "306879eb6bdb225739733ce2aa48bdd1a945453132d0f9beb1c4c208901f019a",
  );
  assert.equal(bytes.byteLength, 48257);
});

test("hashed v20 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v20.ts");
  assert.equal(
    sha256(bytes),
    "fb0a1934792454ca2cd2a925f70a0ce117b2cd6ed72076196f5f98aeefbacbb8",
  );
  assert.equal(bytes.byteLength, 47470);
});

test("hashed v19 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v19.ts");
  assert.equal(
    sha256(bytes),
    "6fea0cbd9c096b28d7c9178bb1c5e5b901a45d843c42ecac39b71e915a46e25f",
  );
  assert.equal(bytes.byteLength, 46550);
});

test("hashed v17 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-v17.ts");
  assert.equal(
    sha256(bytes),
    "4a99833d5576a23134a5be6a1b62225eadfae46949563249dd324d0e5d514762",
  );
  assert.equal(bytes.byteLength, 44359);
});

test("v11 hashed scene-readback, carried verifier, and writer bytes stay frozen", () => {
  const v11Index = JSON.parse(
    readFileSync(
      "recipe/evidence/input-field-live-pivot-v11/antecedent-index.json",
      "utf8",
    ),
  ) as {
    artifacts: Record<string, { bytes: number; sha256: string }>;
  };
  for (const artifactPath of [
    "recipe/scene-readback-v11.ts",
    "recipe/scene-readback-runtime-v11.ts",
    "recipe/input-field-live-v3-verifier-v11.ts",
    "recipe/input-field-live-v11-verifier.ts",
    "recipe/evidence/input-field-live-pivot-v11/programs/writer.txt",
    "recipe/evidence/input-field-live-pivot-v11/programs/writer-payload.js",
  ] as const) {
    const pinned = v11Index.artifacts[artifactPath];
    assert.ok(pinned, `v11 index missing ${artifactPath}`);
    const bytes = readFileSync(artifactPath);
    assert.equal(bytes.byteLength, pinned.bytes);
    assert.equal(sha256(bytes), pinned.sha256);
  }
});

test("v10 hashed scene-readback and carried verifier bytes stay frozen", () => {
  const v10Index = JSON.parse(
    readFileSync(
      "recipe/evidence/input-field-live-pivot-v10/antecedent-index.json",
      "utf8",
    ),
  ) as {
    artifacts: Record<string, { bytes: number; sha256: string }>;
  };
  for (const artifactPath of [
    "recipe/scene-readback-v10.ts",
    "recipe/scene-readback-runtime-v10.ts",
    "recipe/input-field-live-v3-verifier-v10.ts",
    "recipe/input-field-live-v10-verifier.ts",
  ] as const) {
    const pinned = v10Index.artifacts[artifactPath];
    assert.ok(pinned, `v10 index missing ${artifactPath}`);
    const bytes = readFileSync(artifactPath);
    assert.equal(bytes.byteLength, pinned.bytes);
    assert.equal(sha256(bytes), pinned.sha256);
  }
});

test("v9 hashed scene-readback and v3 verifier bytes stay frozen", () => {
  const v9Index = JSON.parse(
    readFileSync(
      "recipe/evidence/input-field-live-pivot-v9/antecedent-index.json",
      "utf8",
    ),
  ) as {
    artifacts: Record<string, { bytes: number; sha256: string }>;
  };
  for (const artifactPath of [
    "recipe/scene-readback-v9.ts",
    "recipe/scene-readback-runtime-v9.ts",
    "recipe/input-field-live-v3-verifier.ts",
    "recipe/input-field-live-v9-verifier.ts",
  ] as const) {
    const pinned = v9Index.artifacts[artifactPath];
    assert.ok(pinned, `v9 index missing ${artifactPath}`);
    const bytes = readFileSync(artifactPath);
    assert.equal(bytes.byteLength, pinned.bytes);
    assert.equal(sha256(bytes), pinned.sha256);
  }
});
