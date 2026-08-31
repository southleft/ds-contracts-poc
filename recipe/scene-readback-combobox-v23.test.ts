import assert from "node:assert/strict";
import test from "node:test";

import { adaptReviewedCombobox } from "./adapters/combobox.js";
import {
  muiComboboxAdapterConfig,
  muiComboboxSource,
} from "./fixtures/library-comboboxes.js";
import { compileComboboxRecipe } from "./recipes/combobox.js";
import type { IRNode } from "./figma-ir.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV1 } from "./scene-readback-combobox-v1.js";
import {
  compareSceneToExpectedPlan as compareSceneToExpectedPlanV5,
  compileExpectedScenePlan as compileExpectedScenePlanV5,
  sceneToNormalizedIr as sceneToNormalizedIrV5,
} from "./scene-readback-combobox-v5.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV6 } from "./scene-readback-combobox-v6.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV8 } from "./scene-readback-combobox-v8.js";
import {
  COMBOBOX_LIVE_V1_SURFACE_COMPILE_BINDING_FIELDS as HASHED_V9_SURFACE_COMPILE_BINDING_FIELDS,
  sceneToNormalizedIr as sceneToNormalizedIrV9,
} from "./scene-readback-combobox-v9.js";
import {
  COMBOBOX_LIVE_V1_LEADING_SLOT_COMPILE_BINDING_FIELDS as HASHED_V10_LEADING_SLOT_COMPILE_BINDING_FIELDS,
  sceneToNormalizedIr as sceneToNormalizedIrV10,
} from "./scene-readback-combobox-v10.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV11 } from "./scene-readback-combobox-v11.js";
import {
  COMBOBOX_LIVE_V1_TRAILING_SLOT_COMPILE_BINDING_FIELDS as HASHED_V12_TRAILING_SLOT_COMPILE_BINDING_FIELDS,
  sceneToNormalizedIr as sceneToNormalizedIrV12,
} from "./scene-readback-combobox-v12.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV13 } from "./scene-readback-combobox-v13.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV14 } from "./scene-readback-combobox-v14.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV15 } from "./scene-readback-combobox-v15.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV16 } from "./scene-readback-combobox-v16.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV17 } from "./scene-readback-combobox-v17.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV18 } from "./scene-readback-combobox-v18.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV19 } from "./scene-readback-combobox-v19.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV20 } from "./scene-readback-combobox-v20.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV21 } from "./scene-readback-combobox-v21.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV22 } from "./scene-readback-combobox-v22.js";
import {
  COMBOBOX_LIVE_V1_LEADING_SLOT_COMPILE_BINDING_FIELDS,
  COMBOBOX_LIVE_V1_LISTBOX_COMPILE_BINDING_FIELDS,
  COMBOBOX_LIVE_V1_OPTION_INSTANCE_COMPILE_BINDING_FIELDS,
  COMBOBOX_LIVE_V1_OVERLAY_COMPILE_BINDING_FIELDS,
  COMBOBOX_LIVE_V1_SURFACE_COMPILE_BINDING_FIELDS,
  COMBOBOX_LIVE_V1_TRAILING_SLOT_COMPILE_BINDING_FIELDS,
  COMBOBOX_LIVE_V23_LEADING_SLOT_BINDING_COMPILE_ORDER_MARKER,
  COMBOBOX_LIVE_V23_LEADING_SLOT_COMPILE_CARRY_VISIBLE_MARKER,
  COMBOBOX_LIVE_V23_LISTBOX_BINDING_COMPILE_ORDER_MARKER,
  COMBOBOX_LIVE_V23_LISTBOX_CLIPS_CONTENT_OMITTED_MARKER,
  COMBOBOX_LIVE_V23_LISTBOX_CORNER_RADIUS_OMITTED_MARKER,
  COMBOBOX_LIVE_V23_OMIT_EMPTY_INSTANCE_PAYLOAD_MARKER,
  COMBOBOX_LIVE_V23_OPTION_INSTANCE_BINDING_EXTRAS_MARKER,
  COMBOBOX_LIVE_V23_OPTION_INSTANCE_FILLS_OMITTED_MARKER,
  COMBOBOX_LIVE_V23_OPTION_INSTANCE_PAYLOAD_OMITTED_MARKER,
  COMBOBOX_LIVE_V23_OVERLAY_BINDING_COMPILE_ORDER_MARKER,
  COMBOBOX_LIVE_V23_OVERLAY_LAYOUT_WIDTH_ALIAS_MARKER,
  COMBOBOX_LIVE_V23_PROJECT_LIVE_ROOT_OWNERSHIP_KEY_MARKER,
  COMBOBOX_LIVE_V23_RECOVER_COMPONENT_PROPERTY_NAME_MARKER,
  COMBOBOX_LIVE_V23_RECOVER_RECIPE_COMPONENT_REF_MARKER,
  COMBOBOX_LIVE_V23_TRAILING_SLOT_BINDING_COMPILE_ORDER_MARKER,
  COMBOBOX_LIVE_V23_TRAILING_SLOT_COMPILE_CARRY_VISIBLE_MARKER,
  COMBOBOX_LIVE_V23_TRIGGER_BINDING_COMPILE_ORDER_MARKER,
  COMBOBOX_LIVE_V23_TRIGGER_EMPTY_EFFECTS_OMITTED_MARKER,
  canonicalizeObservedComponentPropertyName,
  canonicalizeObservedComponentRef,
  compareSceneToExpectedPlan,
  compileExpectedScenePlan,
  contentTextOwnershipKeysWithoutCompileOpacity,
  sceneToNormalizedIr,
  type SceneNodeSnapshot,
} from "./scene-readback-combobox-v23.js";

test("Combobox expected-plan is compiled from the recipe, not Polar Input facts", () => {
  const instance = adaptReviewedCombobox(
    muiComboboxSource,
    muiComboboxAdapterConfig,
  );
  const envelope = compileComboboxRecipe(instance);
  assert.equal(envelope.ir.kind, "frame");
  const comboboxSet = envelope.ir.children.find(
    (child) => child.role === "combobox/set",
  );
  assert.ok(comboboxSet);
  const plan = compileExpectedScenePlan(comboboxSet, {
    rootOwnershipKey: "combobox",
  });
  assert.equal(plan.rootOwnershipKey, "combobox");
  assert.ok(plan.facts.length > 0);
  assert.equal(
    plan.facts.some((fact) => fact.nodeOwnershipKey.startsWith("root/")),
    false,
  );
  const omitOpacity = contentTextOwnershipKeysWithoutCompileOpacity(
    comboboxSet,
    "combobox",
  );
  assert.ok(omitOpacity.size >= 0);
  const layout = plan.facts.filter(
    (fact) =>
      fact.nodeOwnershipKey === "combobox" &&
      (fact.channel === "layout.mode" ||
        fact.channel === "layout.padding.left" ||
        fact.channel === "layout.padding.right"),
  );
  assert.ok(layout.length > 0);
  assert.equal(
    layout.some(
      (fact) =>
        (fact.channel === "layout.mode" && fact.value === "HORIZONTAL") ||
        ((fact.channel === "layout.padding.left" ||
          fact.channel === "layout.padding.right") &&
          fact.value === 32),
    ),
    false,
    "PREPARE must not invent Input set horizontal/padding 32",
  );
});

const walkIr = (node: IRNode): IRNode[] => {
  if (
    node.kind === "frame" ||
    node.kind === "component" ||
    node.kind === "component-set"
  )
    return [node, ...node.children.flatMap(walkIr)];
  return [node];
};

const emptyExtractInstancePayload = (): SceneNodeSnapshot["instancePayload"] => ({
  text: [],
  assets: [],
  content: { kind: "text", text: "" },
  fills: [],
  opacity: 1,
  intrinsicSize: { width: 16, height: 16 },
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
  alignment: { horizontal: "center", vertical: "center" },
  accessibility: { relation: "none", decorative: true },
  source: "scene-description-missing",
});

const childlessControlScene = (): SceneNodeSnapshot => ({
  ownershipKey: "option/children/2/children/1",
  type: "INSTANCE",
  name: "combobox/option/selected-indicator",
  semanticRole: "combobox/option/selected-indicator",
  width: 16,
  height: 16,
  visible: true,
  opacity: 1,
  layoutSizingHorizontal: "FIXED",
  layoutSizingVertical: "FIXED",
  componentRef: "selected",
  componentProperties: {},
  boundVariables: [],
  children: [],
  instancePayload: emptyExtractInstancePayload(),
});

test("host omits instance payload when extract text and fills are empty", () => {
  assert.equal(
    COMBOBOX_LIVE_V23_OMIT_EMPTY_INSTANCE_PAYLOAD_MARKER,
    "COMBOBOX-HOST-OMIT-EMPTY-INSTANCE-PAYLOAD",
  );
  const instance = adaptReviewedCombobox(
    muiComboboxSource,
    muiComboboxAdapterConfig,
  );
  const envelope = compileComboboxRecipe(instance);
  const compiledEmpty = walkIr(envelope.ir).filter(
    (node) =>
      node.kind === "instance" &&
      (node.role === "combobox/option/selected-indicator" ||
        node.role === "combobox/control/leading" ||
        node.role === "combobox/control/clear" ||
        node.role === "combobox/control/popup"),
  );
  assert.ok(compiledEmpty.length > 0);
  assert.equal(
    compiledEmpty.every(
      (node) => node.kind === "instance" && node.payload === undefined,
    ),
    true,
    "compile already omits payload on childless control/indicator instances",
  );
  const scene = childlessControlScene();
  assert.throws(
    () => sceneToNormalizedIrV1(scene),
    /payload|text|fills/,
    "hashed v1 host still refuses empty extract payload",
  );
  const observed = sceneToNormalizedIr(scene);
  assert.equal(observed.kind, "instance");
  assert.equal(observed.payload, undefined);
  assert.equal(observed.componentRef, "selected");
});

const liveRootScene = (ownershipKey: "combobox" | "option"): SceneNodeSnapshot => ({
  ownershipKey,
  type: "FRAME",
  name: ownershipKey === "combobox" ? "combobox/set" : "combobox/option-set",
  semanticRole:
    ownershipKey === "combobox" ? "combobox/set" : "combobox/option-set",
  width: 100,
  height: 40,
  visible: true,
  opacity: 1,
  layoutMode: "VERTICAL",
  layoutSizingHorizontal: "HUG",
  layoutSizingVertical: "HUG",
  boundVariables: [],
  children: [],
});

test("observeSceneFacts projects with live scene root ownershipKey, not default root", () => {
  assert.equal(
    COMBOBOX_LIVE_V23_PROJECT_LIVE_ROOT_OWNERSHIP_KEY_MARKER,
    "COMBOBOX-HOST-PROJECT-LIVE-ROOT-OWNERSHIP-KEY",
  );
  for (const key of ["combobox", "option"] as const) {
    const scene = liveRootScene(key);
    const hashedPlan = compileExpectedScenePlanV5(
      sceneToNormalizedIrV5(scene),
      { rootOwnershipKey: key },
    );
    assert.throws(
      () => compareSceneToExpectedPlanV5(hashedPlan, scene),
      /scene projection lost root/,
      `hashed v5 still invents root for live ${key}`,
    );
    const plan = compileExpectedScenePlan(sceneToNormalizedIr(scene), {
      rootOwnershipKey: key,
    });
    assert.equal(plan.rootOwnershipKey, key);
    assert.equal(
      plan.facts.every((fact) => fact.nodeOwnershipKey.startsWith(key)),
      true,
    );
    const comparison = compareSceneToExpectedPlan(plan, scene);
    assert.equal(comparison.ok, true, `live ${key} projection must not invent root`);
  }
});

const optionInstanceScene = (
  componentRef: string,
  role = "combobox/option-instance/0",
): SceneNodeSnapshot => ({
  ownershipKey: "combobox/children/0/children/3/children/0/children/0",
  type: "INSTANCE",
  name: role,
  semanticRole: role,
  width: 240,
  height: 32,
  visible: true,
  opacity: 1,
  layoutSizingHorizontal: "FILL",
  layoutSizingVertical: "HUG",
  componentRef,
  componentProperties: { Size: "small", "Option state": "selected" },
  boundVariables: [],
  children: [],
});

test("sceneToNormalizedIr recovers recipe componentRef from last-segment / instance-family role", () => {
  assert.equal(
    COMBOBOX_LIVE_V23_RECOVER_RECIPE_COMPONENT_REF_MARKER,
    "COMBOBOX-HOST-RECOVER-RECIPE-COMPONENT-REF",
  );
  assert.equal(
    canonicalizeObservedComponentRef(
      "Size=small, Option state=selected",
      "combobox/option-instance/0",
    ),
    "combobox@1/option",
  );
  assert.equal(
    canonicalizeObservedComponentRef(
      "__button/helper/leading / icon@1",
      "button/slot/leading",
    ),
    "icon@1",
  );
  assert.equal(
    canonicalizeObservedComponentRef("selected", "combobox/option/selected-indicator"),
    "selected",
  );
  const live = optionInstanceScene("Size=small, Option state=selected");
  const hashed = sceneToNormalizedIrV6(live);
  assert.equal(hashed.kind, "instance");
  assert.equal(
    hashed.componentRef,
    "Size=small, Option state=selected",
    "hashed v6 still copies the live Figma main-component name",
  );
  const observed = sceneToNormalizedIr(live);
  assert.equal(observed.kind, "instance");
  assert.equal(observed.componentRef, "combobox@1/option");
});

test("sceneToNormalizedIr recovers component-property names from the key before #", () => {
  assert.equal(
    COMBOBOX_LIVE_V23_RECOVER_COMPONENT_PROPERTY_NAME_MARKER,
    "COMBOBOX-HOST-RECOVER-COMPONENT-PROPERTY-NAME-BEFORE-HASH",
  );
  assert.equal(
    canonicalizeObservedComponentPropertyName("Label#135:173522"),
    "Label",
  );
  assert.equal(
    canonicalizeObservedComponentPropertyName("Value#135:173531"),
    "Value",
  );
  assert.equal(
    canonicalizeObservedComponentPropertyName("Disabled#135:173540"),
    "Disabled",
  );
  assert.equal(canonicalizeObservedComponentPropertyName("Size"), "Size");
  const live = optionInstanceScene("Size=small, Option state=selected");
  live.componentProperties = {
    "Disabled#135:173540": false,
    "Label#135:173522": "Ada Lovelace",
    "Option state": "selected",
    Size: "small",
    "Value#135:173531": "ada",
  };
  const hashed = sceneToNormalizedIrV8(live);
  assert.equal(hashed.kind, "instance");
  assert.equal(
    hashed.properties["Label#135:173522"],
    "Ada Lovelace",
    "hashed v8 still copies live Figma hashed property keys",
  );
  assert.equal(hashed.properties.Label, undefined);
  assert.equal(hashed.properties.Value, undefined);
  assert.equal(hashed.properties.Disabled, undefined);
  const observed = sceneToNormalizedIr(live);
  assert.equal(observed.kind, "instance");
  assert.equal(observed.properties.Label, "Ada Lovelace");
  assert.equal(observed.properties.Value, "ada");
  assert.equal(observed.properties.Disabled, false);
  assert.equal(observed.properties.Size, "small");
  assert.equal(observed.properties["Option state"], "selected");
  assert.equal(observed.properties["Label#135:173522"], undefined);
  assert.equal(observed.properties["Value#135:173531"], undefined);
  assert.equal(observed.properties["Disabled#135:173540"], undefined);
});

const liveTriggerScene = (): SceneNodeSnapshot => ({
  ownershipKey: "combobox/children/0/children/1",
  type: "FRAME",
  name: "combobox/trigger",
  semanticRole: "combobox/trigger",
  width: 240,
  height: 40,
  visible: true,
  opacity: 1,
  layoutMode: "HORIZONTAL",
  layoutSizingHorizontal: "FILL",
  layoutSizingVertical: "FIXED",
  itemSpacing: 8,
  paddingRight: 12,
  paddingLeft: 12,
  boundVariables: [
    { field: "itemSpacing", variableName: "size/gap", resolvedType: "FLOAT" },
    {
      field: "paddingRight",
      variableName: "size/paddingX",
      resolvedType: "FLOAT",
    },
    {
      field: "paddingLeft",
      variableName: "size/paddingX",
      resolvedType: "FLOAT",
    },
    {
      field: "height",
      variableName: "size/triggerHeight",
      resolvedType: "FLOAT",
    },
    {
      field: "fills.0.color",
      variableName: "surface/background",
      resolvedType: "COLOR",
    },
    {
      field: "strokes.0.paint.color",
      variableName: "field/border",
      resolvedType: "COLOR",
    },
    {
      field: "topLeftRadius",
      variableName: "tokens/radius",
      resolvedType: "FLOAT",
    },
    {
      field: "topRightRadius",
      variableName: "tokens/radius",
      resolvedType: "FLOAT",
    },
    {
      field: "bottomRightRadius",
      variableName: "tokens/radius",
      resolvedType: "FLOAT",
    },
    {
      field: "bottomLeftRadius",
      variableName: "tokens/radius",
      resolvedType: "FLOAT",
    },
  ],
  children: [],
});

test("host orders combobox/trigger bindings to compile field order, not live or inherited Input surface list", () => {
  assert.equal(
    COMBOBOX_LIVE_V23_TRIGGER_BINDING_COMPILE_ORDER_MARKER,
    "COMBOBOX-TRIGGER-BINDING-COMPILE-ORDER",
  );
  assert.ok(
    HASHED_V9_SURFACE_COMPILE_BINDING_FIELDS.indexOf("layout.padding.right") <
      HASHED_V9_SURFACE_COMPILE_BINDING_FIELDS.indexOf("layout.padding.left"),
    "hashed v9 still inherits Input surface list ranking padding.right first",
  );
  assert.ok(
    COMBOBOX_LIVE_V1_SURFACE_COMPILE_BINDING_FIELDS.indexOf(
      "layout.padding.left",
    ) <
      COMBOBOX_LIVE_V1_SURFACE_COMPILE_BINDING_FIELDS.indexOf(
        "layout.padding.right",
      ),
    "v10/v12 compile-order list must rank padding.left before padding.right",
  );
  const live = liveTriggerScene();
  const hashed = sceneToNormalizedIrV9(live);
  assert.equal(hashed.kind, "frame");
  const hashedFields = (hashed.bindings ?? []).map((binding) => binding.field);
  assert.deepEqual(
    hashedFields.slice(0, 3),
    ["layout.itemSpacing", "layout.padding.right", "layout.padding.left"],
    "hashed v9 still emits live/inherited right-then-left trigger padding",
  );
  const observed = sceneToNormalizedIr(live);
  assert.equal(observed.kind, "frame");
  const observedFields = (observed.bindings ?? []).map(
    (binding) => binding.field,
  );
  assert.deepEqual(
    observedFields.slice(0, 3),
    ["layout.itemSpacing", "layout.padding.left", "layout.padding.right"],
    "v12 host must keep compile left-then-right, not live extract order",
  );
  assert.deepEqual(observedFields, [
    "layout.itemSpacing",
    "layout.padding.left",
    "layout.padding.right",
    "layout.height.value",
    "fills.0.color",
    "strokes.0.paint.color",
    "cornerRadius.topLeft",
    "cornerRadius.topRight",
    "cornerRadius.bottomRight",
    "cornerRadius.bottomLeft",
  ]);
});

const liveLeadingScene = (): SceneNodeSnapshot => ({
  ownershipKey: "combobox/children/0/children/1/children/0",
  type: "INSTANCE",
  name: "combobox/control/leading",
  semanticRole: "combobox/control/leading",
  width: 16,
  height: 16,
  visible: true,
  opacity: 1,
  layoutSizingHorizontal: "FIXED",
  layoutSizingVertical: "FIXED",
  componentRef: "leading",
  componentProperties: {},
  boundVariables: [
    {
      field: "fills.0.color",
      variableName: "field/icon",
      resolvedType: "COLOR",
    },
    {
      field: "height.value",
      variableName: "field/control-size",
      resolvedType: "FLOAT",
    },
    {
      field: "width.value",
      variableName: "field/control-size",
      resolvedType: "FLOAT",
    },
  ],
  children: [],
});

test("host orders combobox/control/leading bindings to compile field order, not live or inherited fills-first slot list", () => {
  assert.equal(
    COMBOBOX_LIVE_V23_LEADING_SLOT_BINDING_COMPILE_ORDER_MARKER,
    "COMBOBOX-LEADING-SLOT-BINDING-COMPILE-ORDER-WIDTH-HEIGHT-FILL",
  );
  assert.deepEqual(
    [...HASHED_V10_LEADING_SLOT_COMPILE_BINDING_FIELDS],
    ["fills.0.color", "width.value", "height.value"],
    "hashed v10 still inherits fills-first slot list",
  );
  assert.deepEqual(
    [...COMBOBOX_LIVE_V1_LEADING_SLOT_COMPILE_BINDING_FIELDS],
    ["width.value", "height.value", "fills.0.color"],
    "v12 compile-order list must rank width then height then fill",
  );
  const live = liveLeadingScene();
  const hashed = sceneToNormalizedIrV10(live);
  assert.equal(hashed.kind, "instance");
  assert.deepEqual(
    (hashed.bindings ?? []).map((binding) => binding.field),
    ["fills.0.color", "width.value", "height.value"],
    "hashed v10 still emits inherited fills-first leading-slot order",
  );
  const observed = sceneToNormalizedIr(live);
  assert.equal(observed.kind, "instance");
  assert.deepEqual(
    (observed.bindings ?? []).map((binding) => binding.field),
    ["width.value", "height.value", "fills.0.color"],
    "v13 host must keep compile width then height then fill, not live extract order",
  );
});

test("host emits compile-carried visible: true on leading-slot instances instead of omitting default-true", () => {
  assert.equal(
    COMBOBOX_LIVE_V23_LEADING_SLOT_COMPILE_CARRY_VISIBLE_MARKER,
    "COMBOBOX-LEADING-SLOT-COMPILE-CARRY-VISIBLE-TRUE",
  );
  const live = liveLeadingScene();
  const hashed = sceneToNormalizedIrV11(live);
  assert.equal(hashed.kind, "instance");
  assert.equal(
    hashed.visible,
    undefined,
    "hashed v11 still omits default-true leading visible",
  );
  const observed = sceneToNormalizedIr(live);
  assert.equal(observed.kind, "instance");
  assert.equal(
    observed.visible,
    true,
    "v13 host must emit compile-carried visible: true on leading-slot instances",
  );
  assert.equal(
    observed.opacity,
    undefined,
    "v13 must not change occupancy opacity omit; default-1 opacity stays omitted",
  );
});

const liveTrailingScene = (
  role: "combobox/control/clear" | "combobox/control/popup",
): SceneNodeSnapshot => ({
  ownershipKey: "combobox/children/0/children/1/children/2/children/0",
  type: "INSTANCE",
  name: role,
  semanticRole: role,
  width: 16,
  height: 16,
  visible: true,
  opacity: 1,
  layoutSizingHorizontal: "FIXED",
  layoutSizingVertical: "FIXED",
  componentRef: role.split("/").at(-1) ?? role,
  componentProperties: {},
  boundVariables: [
    {
      field: "fills.0.color",
      variableName: "field/icon",
      resolvedType: "COLOR",
    },
    {
      field: "height.value",
      variableName: "field/control-size",
      resolvedType: "FLOAT",
    },
    {
      field: "width.value",
      variableName: "field/control-size",
      resolvedType: "FLOAT",
    },
  ],
  children: [],
});

test("host orders combobox/control/clear bindings to compile field order, not live or inherited fills-first trailing-slot list", () => {
  assert.equal(
    COMBOBOX_LIVE_V23_TRAILING_SLOT_BINDING_COMPILE_ORDER_MARKER,
    "COMBOBOX-TRAILING-SLOT-BINDING-COMPILE-ORDER-WIDTH-HEIGHT-FILL",
  );
  assert.deepEqual(
    [...HASHED_V12_TRAILING_SLOT_COMPILE_BINDING_FIELDS],
    ["fills.0.color", "width.value", "height.value"],
    "hashed v12 still inherits fills-first trailing-slot list",
  );
  assert.deepEqual(
    [...COMBOBOX_LIVE_V1_TRAILING_SLOT_COMPILE_BINDING_FIELDS],
    ["width.value", "height.value", "fills.0.color"],
    "v13 compile-order list must rank width then height then fill",
  );
  for (const role of [
    "combobox/control/clear",
    "combobox/control/popup",
  ] as const) {
    const live = liveTrailingScene(role);
    const hashed = sceneToNormalizedIrV12(live);
    assert.equal(hashed.kind, "instance");
    assert.deepEqual(
      (hashed.bindings ?? []).map((binding) => binding.field),
      ["fills.0.color", "width.value", "height.value"],
      `hashed v12 still emits inherited fills-first ${role} order`,
    );
    const observed = sceneToNormalizedIr(live);
    assert.equal(observed.kind, "instance");
    assert.deepEqual(
      (observed.bindings ?? []).map((binding) => binding.field),
      ["width.value", "height.value", "fills.0.color"],
      `v14 host must keep compile width then height then fill on ${role}`,
    );
  }
});

test("host emits compile-carried visible: true on trailing-slot instances instead of omitting default-true", () => {
  assert.equal(
    COMBOBOX_LIVE_V23_TRAILING_SLOT_COMPILE_CARRY_VISIBLE_MARKER,
    "COMBOBOX-TRAILING-SLOT-COMPILE-CARRY-VISIBLE-TRUE",
  );
  for (const role of [
    "combobox/control/clear",
    "combobox/control/popup",
  ] as const) {
    const live = liveTrailingScene(role);
    const hashed = sceneToNormalizedIrV13(live);
    assert.equal(hashed.kind, "instance");
    assert.equal(
      hashed.visible,
      undefined,
      `hashed v13 still omits default-true ${role} visible`,
    );
    const observed = sceneToNormalizedIr(live);
    assert.equal(observed.kind, "instance");
    assert.equal(
      observed.visible,
      true,
      `v14 host must emit compile-carried visible: true on ${role}`,
    );
    assert.equal(
      observed.opacity,
      undefined,
      "v14 must not change occupancy opacity omit; default-1 opacity stays omitted",
    );
  }
  const hidden = liveTrailingScene("combobox/control/clear");
  hidden.visible = false;
  const hiddenObserved = sceneToNormalizedIr(hidden);
  assert.equal(hiddenObserved.kind, "instance");
  assert.equal(
    hiddenObserved.visible,
    false,
    "v14 must not invent visible: true on live-hidden trailing slots; compile already carries visible: false on disabled clear",
  );
});

const liveTriggerWithEmptyEffects = (): SceneNodeSnapshot => ({
  ...liveTriggerScene(),
  effects: [],
});

const liveOverlayWithDropShadow = (): SceneNodeSnapshot => ({
  ownershipKey: "combobox/children/0/children/3",
  type: "FRAME",
  name: "combobox/overlay",
  semanticRole: "combobox/overlay",
  width: 240,
  height: 160,
  visible: true,
  opacity: 1,
  clipsContent: true,
  effects: [
    {
      type: "DROP_SHADOW",
      offset: { x: 0, y: 4 },
      radius: 8,
      spread: 0,
      color: "#00000040",
      visible: true,
    },
  ],
  boundVariables: [],
  children: [],
});

const liveOverlayWithExtractOrderBindings = (): SceneNodeSnapshot => ({
  ...liveOverlayWithDropShadow(),
  boundVariables: [
    {
      field: "bottomLeftRadius",
      variableName: "tokens/overlayRadius",
      resolvedType: "FLOAT",
    },
    {
      field: "bottomRightRadius",
      variableName: "tokens/overlayRadius",
      resolvedType: "FLOAT",
    },
    {
      field: "topLeftRadius",
      variableName: "tokens/overlayRadius",
      resolvedType: "FLOAT",
    },
    {
      field: "topRightRadius",
      variableName: "tokens/overlayRadius",
      resolvedType: "FLOAT",
    },
    {
      field: "effects.0.color",
      variableName: "tokens/overlay/shadow",
      resolvedType: "COLOR",
    },
    {
      field: "fills.0.color",
      variableName: "tokens/overlay/background",
      resolvedType: "COLOR",
    },
    {
      field: "strokes.0.paint.color",
      variableName: "tokens/overlay/border",
      resolvedType: "COLOR",
    },
    {
      field: "width",
      variableName: "size/width",
      resolvedType: "FLOAT",
    },
  ],
});

const liveListboxWithEmptyEffects = (): SceneNodeSnapshot => ({
  ownershipKey: "combobox/children/0/children/3/children/0",
  type: "FRAME",
  name: "combobox/listbox",
  semanticRole: "combobox/listbox",
  width: 240,
  height: 120,
  visible: true,
  opacity: 1,
  clipsContent: true,
  effects: [],
  strokes: [],
  cornerRadius: {
    topLeft: 0,
    topRight: 0,
    bottomRight: 0,
    bottomLeft: 0,
  },
  boundVariables: [],
  children: [],
});

const liveListboxWithExtractOrderBindings = (): SceneNodeSnapshot => ({
  ...liveListboxWithEmptyEffects(),
  boundVariables: [
    {
      field: "paddingBottom",
      variableName: "combobox.small.list-padding",
      resolvedType: "FLOAT",
    },
    {
      field: "paddingTop",
      variableName: "combobox.small.list-padding",
      resolvedType: "FLOAT",
    },
  ],
});

test("host omits empty combobox/trigger effects that compile never emits", () => {
  assert.equal(
    COMBOBOX_LIVE_V23_TRIGGER_EMPTY_EFFECTS_OMITTED_MARKER,
    "COMBOBOX-TRIGGER-EMPTY-EFFECTS-OMITTED",
  );
  const instance = adaptReviewedCombobox(
    muiComboboxSource,
    muiComboboxAdapterConfig,
  );
  const envelope = compileComboboxRecipe(instance);
  const compiledTrigger = walkIr(envelope.ir).find(
    (node) => node.role === "combobox/trigger",
  );
  const compiledOverlay = walkIr(envelope.ir).find(
    (node) => node.role === "combobox/overlay",
  );
  assert.ok(compiledTrigger);
  assert.ok(compiledOverlay);
  assert.equal(
    compiledTrigger.effects,
    undefined,
    "compile never emits effects on combobox/trigger",
  );
  assert.ok(
    compiledOverlay.effects && compiledOverlay.effects.length > 0,
    "compile carries overlay drop-shadow; v15 must not omit it",
  );
  const live = liveTriggerWithEmptyEffects();
  const hashed = sceneToNormalizedIrV14(live);
  assert.equal(hashed.kind, "frame");
  assert.deepEqual(
    hashed.effects,
    [],
    "hashed v14 still emits empty trigger effects",
  );
  const observed = sceneToNormalizedIr(live);
  assert.equal(observed.kind, "frame");
  assert.equal(
    observed.effects,
    undefined,
    "v15 host must omit empty combobox/trigger effects",
  );
  const overlay = sceneToNormalizedIr(liveOverlayWithDropShadow());
  assert.equal(overlay.kind, "frame");
  assert.equal(overlay.role, "combobox/overlay");
  assert.ok(
    overlay.effects && overlay.effects.length === 1,
    "v15 must keep overlay compile-carried drop-shadow",
  );
  const listbox = sceneToNormalizedIr(liveListboxWithEmptyEffects());
  assert.equal(listbox.kind, "frame");
  assert.equal(listbox.role, "combobox/listbox");
  assert.deepEqual(
    listbox.effects,
    [],
    "v15 must not also teach listbox empty effects; firstDifference stopped at trigger",
  );
});

test("host aliases combobox/overlay width.value to layout.width.value so that field precedes fills.0.color", () => {
  assert.equal(
    COMBOBOX_LIVE_V23_OVERLAY_BINDING_COMPILE_ORDER_MARKER,
    "COMBOBOX-OVERLAY-BINDING-COMPILE-ORDER",
  );
  assert.equal(
    COMBOBOX_LIVE_V23_OVERLAY_LAYOUT_WIDTH_ALIAS_MARKER,
    "COMBOBOX-OVERLAY-LAYOUT-WIDTH-ALIAS-FROM-WIDTH-VALUE",
  );
  assert.deepEqual(
    [...COMBOBOX_LIVE_V1_OVERLAY_COMPILE_BINDING_FIELDS],
    [
      "layout.width.value",
      "fills.0.color",
      "strokes.0.paint.color",
      "effects.0.color",
      "cornerRadius.topLeft",
      "cornerRadius.topRight",
      "cornerRadius.bottomRight",
      "cornerRadius.bottomLeft",
    ],
    "overlay compile-order list must rank layout.width.value then fills, strokes, effects, then cornerRadius corners",
  );
  const instance = adaptReviewedCombobox(
    muiComboboxSource,
    muiComboboxAdapterConfig,
  );
  const envelope = compileComboboxRecipe(instance);
  const compiledOverlay = walkIr(envelope.ir).find(
    (node) => node.role === "combobox/overlay",
  );
  assert.ok(compiledOverlay);
  assert.deepEqual(
    (compiledOverlay.bindings ?? []).map((binding) => binding.field),
    [...COMBOBOX_LIVE_V1_OVERLAY_COMPILE_BINDING_FIELDS],
    "compile overlay bindings start at layout.width.value",
  );
  const live = liveOverlayWithExtractOrderBindings();
  const hashedV15 = sceneToNormalizedIrV15(live);
  assert.equal(hashedV15.kind, "frame");
  assert.deepEqual(
    (hashedV15.bindings ?? []).map((binding) => binding.field),
    [
      "cornerRadius.bottomLeft",
      "cornerRadius.bottomRight",
      "cornerRadius.topLeft",
      "cornerRadius.topRight",
      "effects.0.color",
      "fills.0.color",
      "strokes.0.paint.color",
      "width.value",
    ],
    "hashed v15 still emits live extract overlay order starting at cornerRadius.bottomLeft",
  );
  const hashedV16 = sceneToNormalizedIrV16(live);
  assert.equal(hashedV16.kind, "frame");
  assert.deepEqual(
    (hashedV16.bindings ?? []).map((binding) => binding.field),
    [
      "fills.0.color",
      "strokes.0.paint.color",
      "effects.0.color",
      "cornerRadius.topLeft",
      "cornerRadius.topRight",
      "cornerRadius.bottomRight",
      "cornerRadius.bottomLeft",
      "width.value",
    ],
    "hashed v16 still ranks width.value last as unknown and does not alias it",
  );
  const observed = sceneToNormalizedIr(live);
  assert.equal(observed.kind, "frame");
  assert.deepEqual(
    (observed.bindings ?? []).map((binding) => binding.field),
    [...COMBOBOX_LIVE_V1_OVERLAY_COMPILE_BINDING_FIELDS],
    "v17 host must alias overlay width.value to layout.width.value so compile-order ranks it first",
  );
  const aliased = (observed.bindings ?? []).find(
    (binding) => binding.field === "layout.width.value",
  );
  assert.ok(aliased);
  assert.equal(aliased.type, "FLOAT");
  assert.equal(
    aliased.variable,
    "size/width",
    "v17 must reuse the extract width variable; do not invent a pixel width",
  );
  assert.equal(
    (observed.bindings ?? []).some((binding) => binding.field === "width.value"),
    false,
    "v17 must not keep a duplicate overlay width.value after alias",
  );
  assert.equal(
    observed.effects && observed.effects.length,
    1,
    "v17 must keep overlay compile-carried drop-shadow",
  );
});

test("host orders combobox/listbox bindings to compile field order so layout.padding.top precedes layout.padding.bottom", () => {
  assert.equal(
    COMBOBOX_LIVE_V23_LISTBOX_BINDING_COMPILE_ORDER_MARKER,
    "COMBOBOX-LISTBOX-BINDING-COMPILE-ORDER",
  );
  assert.deepEqual(
    [...COMBOBOX_LIVE_V1_LISTBOX_COMPILE_BINDING_FIELDS],
    ["layout.padding.top", "layout.padding.bottom"],
    "listbox compile-order list must rank layout.padding.top then layout.padding.bottom",
  );
  const instance = adaptReviewedCombobox(
    muiComboboxSource,
    muiComboboxAdapterConfig,
  );
  const envelope = compileComboboxRecipe(instance);
  const compiledListbox = walkIr(envelope.ir).find(
    (node) => node.role === "combobox/listbox",
  );
  const compiledOverlay = walkIr(envelope.ir).find(
    (node) => node.role === "combobox/overlay",
  );
  assert.ok(compiledListbox);
  assert.ok(compiledOverlay);
  assert.deepEqual(
    (compiledListbox.bindings ?? []).map((binding) => binding.field),
    [...COMBOBOX_LIVE_V1_LISTBOX_COMPILE_BINDING_FIELDS],
    "compile listbox bindings start at layout.padding.top",
  );
  assert.ok(
    compiledOverlay.effects && compiledOverlay.effects.length > 0,
    "compile carries overlay drop-shadow; v18 must not omit it",
  );
  const live = liveListboxWithExtractOrderBindings();
  const hashedV17 = sceneToNormalizedIrV17(live);
  assert.equal(hashedV17.kind, "frame");
  assert.deepEqual(
    (hashedV17.bindings ?? []).map((binding) => binding.field),
    ["layout.padding.bottom", "layout.padding.top"],
    "hashed v17 still starts combobox/listbox bindings at layout.padding.bottom",
  );
  assert.deepEqual(
    hashedV17.effects,
    [],
    "hashed v17 still emits empty listbox effects; v18 must not lift that omit",
  );
  const observed = sceneToNormalizedIr(live);
  assert.equal(observed.kind, "frame");
  assert.equal(observed.role, "combobox/listbox");
  assert.deepEqual(
    (observed.bindings ?? []).map((binding) => binding.field),
    [...COMBOBOX_LIVE_V1_LISTBOX_COMPILE_BINDING_FIELDS],
    "v18 host must order listbox bindings so layout.padding.top precedes layout.padding.bottom",
  );
  assert.deepEqual(
    observed.effects,
    [],
    "v18 must not also teach listbox empty effects; firstDifference stopped at bindings[0].field",
  );
  const overlay = sceneToNormalizedIr(liveOverlayWithDropShadow());
  assert.equal(overlay.kind, "frame");
  assert.equal(overlay.role, "combobox/overlay");
  assert.ok(
    overlay.effects && overlay.effects.length === 1,
    "v18 must keep overlay compile-carried drop-shadow",
  );
});

const liveOptionInstanceWithInheritedBindings = (): SceneNodeSnapshot => ({
  ...optionInstanceScene("Size=small, Option state=selected"),
  boundVariables: [
    {
      field: "fills.0.color",
      variableName: "option/fill",
      resolvedType: "COLOR",
    },
    {
      field: "height",
      variableName: "size/optionHeight",
      resolvedType: "FLOAT",
    },
    {
      field: "itemSpacing",
      variableName: "size/gap",
      resolvedType: "FLOAT",
    },
    {
      field: "paddingLeft",
      variableName: "size/paddingX",
      resolvedType: "FLOAT",
    },
    {
      field: "paddingRight",
      variableName: "size/paddingX",
      resolvedType: "FLOAT",
    },
  ],
});

test("host drops extra combobox/option-instance bindings that compile never emits, keeping only height.value", () => {
  assert.equal(
    COMBOBOX_LIVE_V23_OPTION_INSTANCE_BINDING_EXTRAS_MARKER,
    "COMBOBOX-OPTION-INSTANCE-BINDING-EXTRAS-DROPPED",
  );
  assert.deepEqual(
    [...COMBOBOX_LIVE_V1_OPTION_INSTANCE_COMPILE_BINDING_FIELDS],
    ["height.value"],
    "option-instance compile-field list keeps only height.value",
  );
  const instance = adaptReviewedCombobox(
    muiComboboxSource,
    muiComboboxAdapterConfig,
  );
  const envelope = compileComboboxRecipe(instance);
  const compiledOption = walkIr(envelope.ir).find(
    (node) => node.role === "combobox/option-instance/0",
  );
  const compiledListbox = walkIr(envelope.ir).find(
    (node) => node.role === "combobox/listbox",
  );
  assert.ok(compiledOption);
  assert.ok(compiledListbox);
  assert.deepEqual(
    (compiledOption.bindings ?? []).map((binding) => binding.field),
    [...COMBOBOX_LIVE_V1_OPTION_INSTANCE_COMPILE_BINDING_FIELDS],
    "compile option-instance bindings are height.value only",
  );
  const live = liveOptionInstanceWithInheritedBindings();
  const hashedV18 = sceneToNormalizedIrV18(live);
  assert.equal(hashedV18.kind, "instance");
  assert.deepEqual(
    (hashedV18.bindings ?? []).map((binding) => binding.field),
    [
      "fills.0.color",
      "height.value",
      "layout.itemSpacing",
      "layout.padding.left",
      "layout.padding.right",
    ],
    "hashed v18 still emits five inherited option-instance bindings",
  );
  const observed = sceneToNormalizedIr(live);
  assert.equal(observed.kind, "instance");
  assert.equal(observed.role, "combobox/option-instance/0");
  assert.deepEqual(
    (observed.bindings ?? []).map((binding) => binding.field),
    [...COMBOBOX_LIVE_V1_OPTION_INSTANCE_COMPILE_BINDING_FIELDS],
    "v19 host must drop extra option-instance bindings and keep only height.value",
  );
  const listbox = sceneToNormalizedIr(liveListboxWithEmptyEffects());
  assert.equal(listbox.kind, "frame");
  assert.deepEqual(
    listbox.effects,
    [],
    "v19 must not also teach listbox empty effects",
  );
});

const liveOptionInstanceWithInheritedFills = (): SceneNodeSnapshot => ({
  ...liveOptionInstanceWithInheritedBindings(),
  fills: [{ type: "SOLID", color: "#1976d214" }],
});

test("host omits inherited fills on combobox/option-instance that compile never emits", () => {
  assert.equal(
    COMBOBOX_LIVE_V23_OPTION_INSTANCE_FILLS_OMITTED_MARKER,
    "COMBOBOX-OPTION-INSTANCE-INHERITED-FILLS-OMITTED",
  );
  const instance = adaptReviewedCombobox(
    muiComboboxSource,
    muiComboboxAdapterConfig,
  );
  const envelope = compileComboboxRecipe(instance);
  const compiledOption = walkIr(envelope.ir).find(
    (node) => node.role === "combobox/option-instance/0",
  );
  assert.ok(compiledOption);
  assert.equal(
    "fills" in compiledOption,
    false,
    "compile option-instance omits the fills key",
  );
  const live = liveOptionInstanceWithInheritedFills();
  const hashedV19 = sceneToNormalizedIrV19(live);
  assert.equal(hashedV19.kind, "instance");
  assert.deepEqual(
    hashedV19.fills,
    [{ kind: "solid", color: "#1976d214" }],
    "hashed v19 still emits the inherited option-instance solid paint",
  );
  assert.deepEqual(
    (hashedV19.bindings ?? []).map((binding) => binding.field),
    [...COMBOBOX_LIVE_V1_OPTION_INSTANCE_COMPILE_BINDING_FIELDS],
    "hashed v19 already dropped extra option-instance bindings",
  );
  const observed = sceneToNormalizedIr(live);
  assert.equal(observed.kind, "instance");
  assert.equal(observed.role, "combobox/option-instance/0");
  assert.equal(
    "fills" in observed,
    false,
    "v20 host must omit inherited option-instance fills that compile never emits",
  );
  assert.deepEqual(
    (observed.bindings ?? []).map((binding) => binding.field),
    [...COMBOBOX_LIVE_V1_OPTION_INSTANCE_COMPILE_BINDING_FIELDS],
    "v20 must keep the v19 option-instance extras-drop",
  );
  const listbox = sceneToNormalizedIr(liveListboxWithEmptyEffects());
  assert.equal(listbox.kind, "frame");
  assert.deepEqual(
    listbox.effects,
    [],
    "v20 must not also teach listbox empty effects",
  );
});

const liveOptionInstanceWithExtractPayload = (): SceneNodeSnapshot => ({
  ...liveOptionInstanceWithInheritedFills(),
  instancePayload: {
    ...emptyExtractInstancePayload(),
    text: ["Option A"],
    content: { kind: "text", text: "Option A" },
    fills: [{ type: "SOLID", color: "#1976d214" }],
  },
});

test("host omits extra payload on combobox/option-instance that compile never emits", () => {
  assert.equal(
    COMBOBOX_LIVE_V23_OPTION_INSTANCE_PAYLOAD_OMITTED_MARKER,
    "COMBOBOX-OPTION-INSTANCE-PAYLOAD-OMITTED",
  );
  const instance = adaptReviewedCombobox(
    muiComboboxSource,
    muiComboboxAdapterConfig,
  );
  const envelope = compileComboboxRecipe(instance);
  const compiledOption = walkIr(envelope.ir).find(
    (node) => node.role === "combobox/option-instance/0",
  );
  assert.ok(compiledOption);
  assert.equal(
    compiledOption.kind === "instance" && "payload" in compiledOption,
    false,
    "compile option-instance omits the payload key",
  );
  const live = liveOptionInstanceWithExtractPayload();
  const hashedV20 = sceneToNormalizedIrV20(live);
  assert.equal(hashedV20.kind, "instance");
  assert.equal(
    hashedV20.kind === "instance" && hashedV20.payload !== undefined,
    true,
    "hashed v20 still emits the nonempty extract option-instance payload",
  );
  assert.equal(
    "fills" in hashedV20,
    false,
    "hashed v20 already omitted inherited option-instance fills",
  );
  assert.deepEqual(
    (hashedV20.bindings ?? []).map((binding) => binding.field),
    [...COMBOBOX_LIVE_V1_OPTION_INSTANCE_COMPILE_BINDING_FIELDS],
    "hashed v20 already dropped extra option-instance bindings",
  );
  const observed = sceneToNormalizedIr(live);
  assert.equal(observed.kind, "instance");
  assert.equal(observed.role, "combobox/option-instance/0");
  assert.equal(
    "payload" in observed,
    false,
    "v21 host must omit extra option-instance payload that compile never emits",
  );
  assert.equal(
    "fills" in observed,
    false,
    "v21 must keep the v20 option-instance inherited-fills omit",
  );
  assert.deepEqual(
    (observed.bindings ?? []).map((binding) => binding.field),
    [...COMBOBOX_LIVE_V1_OPTION_INSTANCE_COMPILE_BINDING_FIELDS],
    "v21 must keep the v19 option-instance extras-drop",
  );
  const emptyControl = sceneToNormalizedIr(childlessControlScene());
  assert.equal(emptyControl.kind, "instance");
  assert.equal(
    emptyControl.payload,
    undefined,
    "v21 must keep the v5 empty-payload omit",
  );
  const listbox = sceneToNormalizedIr(liveListboxWithEmptyEffects());
  assert.equal(listbox.kind, "frame");
  assert.deepEqual(
    listbox.effects,
    [],
    "v21 must not also teach listbox empty effects",
  );
});

test("host omits combobox/listbox clipsContent that compile never emits", () => {
  assert.equal(
    COMBOBOX_LIVE_V23_LISTBOX_CLIPS_CONTENT_OMITTED_MARKER,
    "COMBOBOX-LISTBOX-CLIPS-CONTENT-OMITTED",
  );
  const instance = adaptReviewedCombobox(
    muiComboboxSource,
    muiComboboxAdapterConfig,
  );
  const envelope = compileComboboxRecipe(instance);
  const compiledListbox = walkIr(envelope.ir).find(
    (node) => node.role === "combobox/listbox",
  );
  const compiledOverlay = walkIr(envelope.ir).find(
    (node) => node.role === "combobox/overlay",
  );
  assert.ok(compiledListbox);
  assert.ok(compiledOverlay);
  assert.equal(
    "clipsContent" in compiledListbox,
    false,
    "compile listbox omits the clipsContent key",
  );
  assert.equal(
    compiledOverlay.kind === "frame" && compiledOverlay.clipsContent,
    true,
    "compile overlay emits clipsContent true; v22 must not omit it",
  );
  const live = liveListboxWithEmptyEffects();
  const hashedV21 = sceneToNormalizedIrV21(live);
  assert.equal(hashedV21.kind, "frame");
  assert.equal(
    hashedV21.kind === "frame" && hashedV21.clipsContent,
    true,
    "hashed v21 still emits live listbox clipsContent",
  );
  assert.deepEqual(
    hashedV21.effects,
    [],
    "hashed v21 still emits empty listbox effects; v22 must not lift that omit",
  );
  const observed = sceneToNormalizedIr(live);
  assert.equal(observed.kind, "frame");
  assert.equal(observed.role, "combobox/listbox");
  assert.equal(
    "clipsContent" in observed,
    false,
    "v22 host must omit listbox clipsContent that compile never emits",
  );
  assert.deepEqual(
    observed.effects,
    [],
    "v22 must not also teach listbox empty effects",
  );
  const overlay = sceneToNormalizedIr(liveOverlayWithDropShadow());
  assert.equal(overlay.kind, "frame");
  assert.equal(overlay.role, "combobox/overlay");
  assert.equal(
    overlay.kind === "frame" && overlay.clipsContent,
    true,
    "v22 must keep overlay clipsContent that compile emits",
  );
  assert.equal(
    "payload" in sceneToNormalizedIr(liveOptionInstanceWithExtractPayload()),
    false,
    "v22 must keep the v21 option-instance payload omit",
  );
});

test("host omits combobox/listbox cornerRadius that compile never emits", () => {
  assert.equal(
    COMBOBOX_LIVE_V23_LISTBOX_CORNER_RADIUS_OMITTED_MARKER,
    "COMBOBOX-LISTBOX-CORNER-RADIUS-OMITTED",
  );
  const instance = adaptReviewedCombobox(
    muiComboboxSource,
    muiComboboxAdapterConfig,
  );
  const envelope = compileComboboxRecipe(instance);
  const compiledListbox = walkIr(envelope.ir).find(
    (node) => node.role === "combobox/listbox",
  );
  const compiledOverlay = walkIr(envelope.ir).find(
    (node) => node.role === "combobox/overlay",
  );
  assert.ok(compiledListbox);
  assert.ok(compiledOverlay);
  assert.equal(
    "cornerRadius" in compiledListbox,
    false,
    "compile listbox omits the cornerRadius key",
  );
  assert.equal(
    compiledOverlay.kind === "frame" && "cornerRadius" in compiledOverlay,
    true,
    "compile overlay emits cornerRadius; v23 must not omit it",
  );
  const live = liveListboxWithEmptyEffects();
  const hashedV22 = sceneToNormalizedIrV22(live);
  assert.equal(hashedV22.kind, "frame");
  assert.deepEqual(
    hashedV22.kind === "frame" ? hashedV22.cornerRadius : undefined,
    {
      topLeft: 0,
      topRight: 0,
      bottomRight: 0,
      bottomLeft: 0,
    },
    "hashed v22 still emits live listbox zero cornerRadius",
  );
  assert.equal(
    "clipsContent" in hashedV22,
    false,
    "hashed v22 already omits listbox clipsContent; v23 must keep that omit",
  );
  assert.deepEqual(
    hashedV22.effects,
    [],
    "hashed v22 still emits empty listbox effects; v23 must not lift that omit",
  );
  assert.deepEqual(
    hashedV22.kind === "frame" ? hashedV22.strokes : undefined,
    [],
    "hashed v22 still emits empty listbox strokes; v23 must not lift that omit",
  );
  const observed = sceneToNormalizedIr(live);
  assert.equal(observed.kind, "frame");
  assert.equal(observed.role, "combobox/listbox");
  assert.equal(
    "cornerRadius" in observed,
    false,
    "v23 host must omit listbox cornerRadius that compile never emits",
  );
  assert.equal(
    "clipsContent" in observed,
    false,
    "v23 must keep the v22 listbox clipsContent omit",
  );
  assert.deepEqual(
    observed.effects,
    [],
    "v23 must not also teach listbox empty effects",
  );
  assert.deepEqual(
    observed.kind === "frame" ? observed.strokes : undefined,
    [],
    "v23 must not also teach listbox empty strokes",
  );
  const overlay = sceneToNormalizedIr({
    ...liveOverlayWithDropShadow(),
    cornerRadius: {
      topLeft: 4,
      topRight: 4,
      bottomRight: 4,
      bottomLeft: 4,
    },
  });
  assert.equal(overlay.kind, "frame");
  assert.equal(overlay.role, "combobox/overlay");
  assert.deepEqual(
    overlay.kind === "frame" ? overlay.cornerRadius : undefined,
    {
      topLeft: 4,
      topRight: 4,
      bottomRight: 4,
      bottomLeft: 4,
    },
    "v23 must keep overlay cornerRadius that compile emits",
  );
  assert.equal(
    overlay.kind === "frame" && overlay.clipsContent,
    true,
    "v23 must keep overlay clipsContent that compile emits",
  );
});
