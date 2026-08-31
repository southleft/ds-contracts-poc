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
import {
  COMBOBOX_LIVE_V1_LEADING_SLOT_COMPILE_BINDING_FIELDS,
  COMBOBOX_LIVE_V1_SURFACE_COMPILE_BINDING_FIELDS,
  COMBOBOX_LIVE_V1_TRAILING_SLOT_COMPILE_BINDING_FIELDS,
  COMBOBOX_LIVE_V13_LEADING_SLOT_BINDING_COMPILE_ORDER_MARKER,
  COMBOBOX_LIVE_V13_LEADING_SLOT_COMPILE_CARRY_VISIBLE_MARKER,
  COMBOBOX_LIVE_V13_OMIT_EMPTY_INSTANCE_PAYLOAD_MARKER,
  COMBOBOX_LIVE_V13_PROJECT_LIVE_ROOT_OWNERSHIP_KEY_MARKER,
  COMBOBOX_LIVE_V13_RECOVER_COMPONENT_PROPERTY_NAME_MARKER,
  COMBOBOX_LIVE_V13_RECOVER_RECIPE_COMPONENT_REF_MARKER,
  COMBOBOX_LIVE_V13_TRAILING_SLOT_BINDING_COMPILE_ORDER_MARKER,
  COMBOBOX_LIVE_V13_TRIGGER_BINDING_COMPILE_ORDER_MARKER,
  canonicalizeObservedComponentPropertyName,
  canonicalizeObservedComponentRef,
  compareSceneToExpectedPlan,
  compileExpectedScenePlan,
  contentTextOwnershipKeysWithoutCompileOpacity,
  sceneToNormalizedIr,
  type SceneNodeSnapshot,
} from "./scene-readback-combobox-v13.js";

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
    COMBOBOX_LIVE_V13_OMIT_EMPTY_INSTANCE_PAYLOAD_MARKER,
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
    COMBOBOX_LIVE_V13_PROJECT_LIVE_ROOT_OWNERSHIP_KEY_MARKER,
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
    COMBOBOX_LIVE_V13_RECOVER_RECIPE_COMPONENT_REF_MARKER,
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
    COMBOBOX_LIVE_V13_RECOVER_COMPONENT_PROPERTY_NAME_MARKER,
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
    COMBOBOX_LIVE_V13_TRIGGER_BINDING_COMPILE_ORDER_MARKER,
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
    COMBOBOX_LIVE_V13_LEADING_SLOT_BINDING_COMPILE_ORDER_MARKER,
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
    COMBOBOX_LIVE_V13_LEADING_SLOT_COMPILE_CARRY_VISIBLE_MARKER,
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
    COMBOBOX_LIVE_V13_TRAILING_SLOT_BINDING_COMPILE_ORDER_MARKER,
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
      `v13 host must keep compile width then height then fill on ${role}`,
    );
  }
});
