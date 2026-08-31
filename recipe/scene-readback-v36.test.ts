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
import { buildFigmaSceneReadbackRuntime } from "./scene-readback-runtime-v36.js";
import {
  INPUT_LIVE_V36_CONTENT_BINDING_COMPILE_ORDER_MARKER,
  INPUT_LIVE_V36_CONTENT_BINDING_EXTRAS_MARKER,
  INPUT_LIVE_V36_CONTENT_HIDDEN_HEIGHT_HUG_MARKER,
  INPUT_LIVE_V36_CONTENT_LETTER_SPACING_OMITTED_MARKER,
  INPUT_LIVE_V36_CONTENT_ROW_CLIPS_CONTENT_OMITTED_MARKER,
  INPUT_LIVE_V36_CONTENT_ROW_CORNER_RADIUS_OMITTED_MARKER,
  INPUT_LIVE_V36_CONTENT_ROW_EFFECTS_OMITTED_MARKER,
  INPUT_LIVE_V36_CONTENT_ROW_STROKES_OMITTED_MARKER,
  INPUT_LIVE_V36_LABEL_BINDING_COMPILE_ORDER_MARKER,
  INPUT_LIVE_V36_LABEL_BINDING_EXTRAS_MARKER,
  INPUT_LIVE_V36_LABEL_LETTER_SPACING_OMITTED_MARKER,
  INPUT_LIVE_V36_LABEL_ROLES,
  INPUT_LIVE_V36_CONTENT_TEXT_CASE_OMITTED_MARKER,
  INPUT_LIVE_V36_CONTENT_TEXT_DECORATION_OMITTED_MARKER,
  INPUT_LIVE_V36_CONTENT_COMPILE_BINDING_FIELDS,
  INPUT_LIVE_V36_CONTENT_ROLES,
  INPUT_LIVE_V36_SLOT_COLOR_BINDING_MARKER,
  INPUT_LIVE_V36_SLOT_FILL_MARKER,
  INPUT_LIVE_V36_SLOT_ROLES,
  INPUT_LIVE_V36_SURFACE_BINDING_COMPILE_ORDER_MARKER,
  INPUT_LIVE_V36_SURFACE_BINDING_EXTRAS_MARKER,
  INPUT_LIVE_V36_SURFACE_COMPILE_BINDING_FIELDS,
  INPUT_LIVE_V36_SURFACE_LAYOUT_HEIGHT_ALIAS_MARKER,
  INPUT_LIVE_V36_SURFACE_LAYOUT_HEIGHT_MARKER,
  INPUT_LIVE_V36_SURFACE_STROKE_WEIGHT_MARKER,
  INPUT_LIVE_V36_VARIANT_LAYOUT_WIDTH_ALIAS_MARKER,
  INPUT_LIVE_V36_VARIANT_LAYOUT_WIDTH_COMPILE_INDEX_MARKER,
  INPUT_LIVE_V36_VARIANT_LAYOUT_WIDTH_MARKER,
  SCENE_READBACK_V12_TAUGHT_FILL_KINDS,
  scenePaintToIr,
  sceneToNormalizedIr,
  type SceneNodeSnapshot,
} from "./scene-readback-v36.js";
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
  assert.equal(INPUT_LIVE_V36_SLOT_FILL_MARKER, "INPUT-SLOT-FILL-FROM-PAYLOAD");
  assert.deepEqual([...INPUT_LIVE_V36_SLOT_ROLES], [
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
    INPUT_LIVE_V36_SLOT_COLOR_BINDING_MARKER,
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
    INPUT_LIVE_V36_SURFACE_STROKE_WEIGHT_MARKER,
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
    INPUT_LIVE_V36_SURFACE_BINDING_EXTRAS_MARKER,
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
    [...INPUT_LIVE_V36_SURFACE_COMPILE_BINDING_FIELDS],
  );
  assert.equal(
    INPUT_LIVE_V36_SURFACE_BINDING_COMPILE_ORDER_MARKER,
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
    [...INPUT_LIVE_V36_CONTENT_COMPILE_BINDING_FIELDS],
  );
  assert.equal(
    INPUT_LIVE_V36_CONTENT_BINDING_EXTRAS_MARKER,
    "INPUT-CONTENT-BINDING-EXTRAS-DROPPED",
  );
  assert.deepEqual([...INPUT_LIVE_V36_CONTENT_ROLES], [
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
    [...INPUT_LIVE_V36_CONTENT_COMPILE_BINDING_FIELDS],
  );
  assert.equal(
    INPUT_LIVE_V36_CONTENT_BINDING_COMPILE_ORDER_MARKER,
    "INPUT-CONTENT-BINDING-COMPILE-ORDER",
  );
});

test("v36 recovers hug height for hidden content text with FIXED vertical sizing", () => {
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
    INPUT_LIVE_V36_CONTENT_HIDDEN_HEIGHT_HUG_MARKER,
    "INPUT-CONTENT-HIDDEN-FIXED-HEIGHT-AS-HUG",
  );
});

test("v36 does not rewrite visible content FIXED height or invent a height variable", () => {
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

test("v36 does not lift hidden FIXED height onto non-content text", () => {
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
    INPUT_LIVE_V36_VARIANT_LAYOUT_WIDTH_MARKER,
    "INPUT-VARIANT-LAYOUT-WIDTH-FROM-WIDTH",
  );
  assert.equal(
    (ir.bindings ?? []).filter((binding) => binding.field === "width.value")
      .length,
    0,
  );
  assert.equal(
    INPUT_LIVE_V36_VARIANT_LAYOUT_WIDTH_ALIAS_MARKER,
    "INPUT-VARIANT-LAYOUT-WIDTH-ALIAS-NO-DUPLICATE-WIDTH-VALUE",
  );
  assert.deepEqual(
    (ir.bindings ?? []).map((binding) => binding.field),
    ["layout.itemSpacing", "layout.width.value", "layout.minWidth"],
  );
  assert.equal(
    INPUT_LIVE_V36_VARIANT_LAYOUT_WIDTH_COMPILE_INDEX_MARKER,
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
    INPUT_LIVE_V36_SURFACE_LAYOUT_HEIGHT_MARKER,
    "INPUT-SURFACE-LAYOUT-HEIGHT-FROM-HEIGHT",
  );
  assert.equal(
    (ir.bindings ?? []).filter((binding) => binding.field === "height.value")
      .length,
    0,
  );
  assert.equal(
    INPUT_LIVE_V36_SURFACE_LAYOUT_HEIGHT_ALIAS_MARKER,
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
    "recipe/input-field-live-v36-verifier.ts",
    "utf8",
  );
  const contract = readFileSync(
    "recipe/input-field-live-v36-contract.ts",
    "utf8",
  );
  const carried = readFileSync(
    "recipe/input-field-live-v3-verifier-v36.ts",
    "utf8",
  );
  assert.match(verifier, /input-field-live-v3-verifier-v36/);
  assert.doesNotMatch(verifier, /from "\.\/input-field-live-v3-verifier\.js"/);
  assert.doesNotMatch(verifier, /from "\.\/scene-readback\.js"/);
  assert.match(contract, /input-field-live-v3-verifier-v36/);
  assert.doesNotMatch(contract, /from "\.\/input-field-live-v3-verifier\.js"/);
  assert.doesNotMatch(contract, /from "\.\/scene-readback\.js"/);
  assert.match(carried, /from "\.\/scene-readback-v36\.js"/);
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

test("v36 omits content letterSpacing that compile never emits", () => {
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
    INPUT_LIVE_V36_CONTENT_LETTER_SPACING_OMITTED_MARKER,
    "INPUT-CONTENT-LETTER-SPACING-OMITTED",
  );
});

test("v36 does not omit letterSpacing on non-content non-label text", () => {
  const ir = sceneToNormalizedIr({
    ownershipKey: "helper",
    type: "TEXT",
    name: "input-field/message/helper :: Helper",
    width: 72,
    height: 20,
    visible: true,
    opacity: 1,
    layoutSizingHorizontal: "HUG",
    layoutSizingVertical: "HUG",
    fontName: { family: "Roboto", style: "Regular" },
    fontSize: 16,
    characters: "Helper",
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

test("v36 omits content textCase that compile never emits", () => {
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
    INPUT_LIVE_V36_CONTENT_TEXT_CASE_OMITTED_MARKER,
    "INPUT-CONTENT-TEXT-CASE-OMITTED",
  );
});

test("v36 does not omit textCase on non-content text", () => {
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

test("v36 omits content textDecoration that compile never emits", () => {
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
    INPUT_LIVE_V36_CONTENT_TEXT_DECORATION_OMITTED_MARKER,
    "INPUT-CONTENT-TEXT-DECORATION-OMITTED",
  );
});

test("v36 does not omit textDecoration on non-content text", () => {
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

test("v36 omits content-row clipsContent that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ...surfaceScene([]),
    name: "input-field/content-row :: Row",
    clipsContent: true,
  });
  assert.equal(ir.role, "input-field/content-row");
  assert.equal(ir.clipsContent, undefined);
  assert.equal(
    INPUT_LIVE_V36_CONTENT_ROW_CLIPS_CONTENT_OMITTED_MARKER,
    "INPUT-CONTENT-ROW-CLIPS-CONTENT-OMITTED",
  );
});

test("v36 does not omit clipsContent on labels", () => {
  const ir = sceneToNormalizedIr({
    ...surfaceScene([]),
    name: "input-field/label-row :: Row",
    clipsContent: true,
  });
  assert.equal(ir.role, "input-field/label-row");
  assert.equal(ir.clipsContent, true);
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

test("v36 omits content-row cornerRadius that compile never emits", () => {
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
    INPUT_LIVE_V36_CONTENT_ROW_CORNER_RADIUS_OMITTED_MARKER,
    "INPUT-CONTENT-ROW-CORNER-RADIUS-OMITTED",
  );
});

test("v36 does not omit cornerRadius on labels", () => {
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
  assert.deepEqual(ir.cornerRadius, {
    topLeft: 0,
    topRight: 0,
    bottomRight: 0,
    bottomLeft: 0,
  });
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

test("v36 omits content-row effects that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ...surfaceScene([]),
    name: "input-field/content-row :: Row",
    effects: [],
  });
  assert.equal(ir.role, "input-field/content-row");
  assert.equal(ir.effects, undefined);
  assert.equal(
    INPUT_LIVE_V36_CONTENT_ROW_EFFECTS_OMITTED_MARKER,
    "INPUT-CONTENT-ROW-EFFECTS-OMITTED",
  );
});

test("v36 does not omit effects on labels", () => {
  const ir = sceneToNormalizedIr({
    ...surfaceScene([]),
    name: "input-field/label-row :: Row",
    effects: [],
  });
  assert.equal(ir.role, "input-field/label-row");
  assert.deepEqual(ir.effects, []);
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

test("v36 omits content-row strokes that compile never emits", () => {
  const ir = sceneToNormalizedIr({
    ...surfaceScene([]),
    name: "input-field/content-row :: Row",
    strokes: [],
  });
  assert.equal(ir.role, "input-field/content-row");
  assert.equal(ir.strokes, undefined);
  assert.equal(
    INPUT_LIVE_V36_CONTENT_ROW_STROKES_OMITTED_MARKER,
    "INPUT-CONTENT-ROW-STROKES-OMITTED",
  );
});

test("v36 does not omit strokes on labels", () => {
  const ir = sceneToNormalizedIr({
    ...surfaceScene([]),
    name: "input-field/label-row :: Row",
    strokes: [],
  });
  assert.equal(ir.role, "input-field/label-row");
  assert.deepEqual(ir.strokes, []);
});

test("v36 drops duplicate label bindings and orders remaining fields to compile", () => {
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
    [...INPUT_LIVE_V36_CONTENT_COMPILE_BINDING_FIELDS],
  );
  assert.equal(
    INPUT_LIVE_V36_LABEL_BINDING_EXTRAS_MARKER,
    "INPUT-LABEL-BINDING-EXTRAS-DROPPED",
  );
  assert.equal(
    INPUT_LIVE_V36_LABEL_BINDING_COMPILE_ORDER_MARKER,
    "INPUT-LABEL-BINDING-COMPILE-ORDER",
  );
  assert.deepEqual([...INPUT_LIVE_V36_LABEL_ROLES], ["input-field/label"]);
});

test("v36 does not apply label binding teaching to surfaces", () => {
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

test("v36 omits label letterSpacing that compile never emits", () => {
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
    INPUT_LIVE_V36_LABEL_LETTER_SPACING_OMITTED_MARKER,
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
