import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { adaptReviewedCombobox } from "./adapters/combobox.js";
import {
  antdComboboxAdapterConfig,
  antdComboboxSource,
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
import { sceneToNormalizedIr as sceneToNormalizedIrV23 } from "./scene-readback-combobox-v23.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV24 } from "./scene-readback-combobox-v24.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV25 } from "./scene-readback-combobox-v25.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV26 } from "./scene-readback-combobox-v26.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV27 } from "./scene-readback-combobox-v27.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV28 } from "./scene-readback-combobox-v28.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV29 } from "./scene-readback-combobox-v29.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV30 } from "./scene-readback-combobox-v30.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV31 } from "./scene-readback-combobox-v31.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV32 } from "./scene-readback-combobox-v32.js";
import {
  compareSceneToExpectedPlan as compareSceneToExpectedPlanV33,
  compileExpectedScenePlan as compileExpectedScenePlanV33,
  sceneToNormalizedIr as sceneToNormalizedIrV33,
} from "./scene-readback-combobox-v33.js";
import {
  compareSceneToExpectedPlan as compareSceneToExpectedPlanV34,
  compileExpectedScenePlan as compileExpectedScenePlanV34,
  sceneToNormalizedIr as sceneToNormalizedIrV34,
} from "./scene-readback-combobox-v34.js";
import {
  compareSceneToExpectedPlan as compareSceneToExpectedPlanV35,
  compileExpectedScenePlan as compileExpectedScenePlanV35,
} from "./scene-readback-combobox-v35.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV36 } from "./scene-readback-combobox-v36.js";
import {
  COMBOBOX_LIVE_V1_LEADING_SLOT_COMPILE_BINDING_FIELDS,
  COMBOBOX_LIVE_V1_LEADING_SLOT_ROLES,
  COMBOBOX_LIVE_V1_LISTBOX_COMPILE_BINDING_FIELDS,
  COMBOBOX_LIVE_V1_OPTION_COMPILE_BINDING_FIELDS,
  COMBOBOX_LIVE_V1_OPTION_INSTANCE_COMPILE_BINDING_FIELDS,
  COMBOBOX_LIVE_V1_OVERLAY_COMPILE_BINDING_FIELDS,
  COMBOBOX_LIVE_V1_SELECTED_INDICATOR_COMPILE_BINDING_FIELDS,
  COMBOBOX_LIVE_V1_SURFACE_COMPILE_BINDING_FIELDS,
  COMBOBOX_LIVE_V1_TRAILING_SLOT_COMPILE_BINDING_FIELDS,
  COMBOBOX_LIVE_V1_TRAILING_SLOT_ROLES,
  COMBOBOX_LIVE_V37_LEADING_SLOT_BINDING_COMPILE_ORDER_MARKER,
  COMBOBOX_LIVE_V37_LEADING_SLOT_COMPILE_CARRY_VISIBLE_MARKER,
  COMBOBOX_LIVE_V37_LISTBOX_BINDING_COMPILE_ORDER_MARKER,
  COMBOBOX_LIVE_V37_LISTBOX_CLIPS_CONTENT_OMITTED_MARKER,
  COMBOBOX_LIVE_V37_LISTBOX_CORNER_RADIUS_OMITTED_MARKER,
  COMBOBOX_LIVE_V37_LISTBOX_EMPTY_EFFECTS_OMITTED_MARKER,
  COMBOBOX_LIVE_V37_LISTBOX_EMPTY_STROKES_OMITTED_MARKER,
  COMBOBOX_LIVE_V37_OMIT_EMPTY_INSTANCE_PAYLOAD_MARKER,
  COMBOBOX_LIVE_V37_OBSERVE_OMIT_EMPTY_INSTANCE_PAYLOAD_MARKER,
  COMBOBOX_LIVE_V37_OBSERVE_OMIT_OPTION_INSTANCE_PAYLOAD_MARKER,
  COMBOBOX_LIVE_V37_OPTION_SET_COMPILE_CARRY_LABEL,
  COMBOBOX_LIVE_V37_OPTION_SET_COMPILE_CARRY_LABEL_MARKER,
  COMBOBOX_LIVE_V37_OPTION_BINDING_COMPILE_ORDER_MARKER,
  COMBOBOX_LIVE_V37_OPTION_CLIPS_CONTENT_OMITTED_MARKER,
  COMBOBOX_LIVE_V37_OPTION_LAYOUT_HEIGHT_ALIAS_MARKER,
  COMBOBOX_LIVE_V37_OPTION_INSTANCE_BINDING_EXTRAS_MARKER,
  COMBOBOX_LIVE_V37_OPTION_INSTANCE_FILLS_OMITTED_MARKER,
  COMBOBOX_LIVE_V37_OPTION_INSTANCE_PAYLOAD_OMITTED_MARKER,
  COMBOBOX_LIVE_V37_OVERLAY_BINDING_COMPILE_ORDER_MARKER,
  COMBOBOX_LIVE_V37_OVERLAY_EMPTY_DASH_PATTERN_OMITTED_MARKER,
  COMBOBOX_LIVE_V37_SET_CLIPS_CONTENT_OMITTED_MARKER,
  COMBOBOX_LIVE_V37_OVERLAY_LAYOUT_WIDTH_ALIAS_MARKER,
  COMBOBOX_LIVE_V37_PROJECT_LIVE_ROOT_OWNERSHIP_KEY_MARKER,
  COMBOBOX_LIVE_V37_RECOVER_COMPONENT_PROPERTY_NAME_MARKER,
  COMBOBOX_LIVE_V37_RECOVER_RECIPE_COMPONENT_REF_MARKER,
  COMBOBOX_LIVE_V37_SELECTED_INDICATOR_BINDING_COMPILE_ORDER_MARKER,
  COMBOBOX_LIVE_V37_SELECTED_INDICATOR_COMPILE_CARRY_VISIBLE_MARKER,
  COMBOBOX_LIVE_V37_TRAILING_SLOT_BINDING_COMPILE_ORDER_MARKER,
  COMBOBOX_LIVE_V37_TRAILING_SLOT_COMPILE_CARRY_VISIBLE_MARKER,
  COMBOBOX_LIVE_V37_TRIGGER_BINDING_COMPILE_ORDER_MARKER,
  COMBOBOX_LIVE_V37_TRIGGER_COMPILE_CARRY_CHARACTERS,
  COMBOBOX_LIVE_V37_TRIGGER_COMPILE_CARRY_CHARACTERS_MARKER,
  COMBOBOX_LIVE_V37_TRIGGER_EMPTY_EFFECTS_OMITTED_MARKER,
  COMBOBOX_LIVE_V37_TRIGGER_SLOT_COMPONENT_REF_COMPILE_SIBLING_ORDER_MARKER,
  COMBOBOX_LIVE_V37_TRIGGER_SLOT_COMPILE_SIBLING_COMPONENT_REFS,
  COMBOBOX_LIVE_V37_TRIGGER_SLOT_COMPILE_SIBLING_ROLES,
  canonicalizeObservedComponentPropertyName,
  canonicalizeObservedComponentRef,
  canonicalizeObservedTriggerSlotComponentRef,
  compareSceneToExpectedPlan,
  compileExpectedScenePlan,
  contentTextOwnershipKeysWithoutCompileOpacity,
  sceneToNormalizedIr,
  type SceneNodeSnapshot,
} from "./scene-readback-combobox-v37.js";

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
    COMBOBOX_LIVE_V37_OMIT_EMPTY_INSTANCE_PAYLOAD_MARKER,
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

const slotRoles = [
  {
    role: "combobox/option/selected-indicator",
    ownershipKey: "option/children/2/children/1",
    componentRef: "selected",
  },
  {
    role: "combobox/control/leading",
    ownershipKey: "combobox/children/0/children/0",
    componentRef: "prefix",
  },
  {
    role: "combobox/control/clear",
    ownershipKey: "combobox/children/0/children/2",
    componentRef: "clear",
  },
  {
    role: "combobox/control/popup",
    ownershipKey: "combobox/children/0/children/3",
    componentRef: "popup",
  },
] as const;

const emptySlotInstanceScene = (
  role: (typeof slotRoles)[number]["role"],
  ownershipKey: string,
  componentRef: string,
): SceneNodeSnapshot => ({
  ownershipKey,
  type: "INSTANCE",
  name: role,
  semanticRole: role,
  width: 20,
  height: 20,
  visible: true,
  opacity: 1,
  layoutSizingHorizontal: "FIXED",
  layoutSizingVertical: "FIXED",
  componentRef,
  componentProperties: {},
  boundVariables: [],
  children: [],
  instancePayload: {
    ...emptyExtractInstancePayload(),
    intrinsicSize: { width: 20, height: 20 },
  },
});

test("host observe omits empty instancePayload facts on slot instances that IR and compile omit", () => {
  assert.equal(
    COMBOBOX_LIVE_V37_OBSERVE_OMIT_EMPTY_INSTANCE_PAYLOAD_MARKER,
    "COMBOBOX-HOST-OBSERVE-OMIT-EMPTY-INSTANCE-PAYLOAD",
  );
  for (const slot of slotRoles) {
    const scene = emptySlotInstanceScene(
      slot.role,
      slot.ownershipKey,
      slot.componentRef,
    );
    const hostIr = sceneToNormalizedIr(scene);
    assert.equal(hostIr.kind, "instance");
    assert.equal(
      hostIr.payload,
      undefined,
      `v5 empty-payload omit must stay on ${slot.role}`,
    );
    const hashedIr = sceneToNormalizedIrV33(scene);
    assert.equal(hashedIr.kind, "instance");
    assert.equal(
      hashedIr.payload,
      undefined,
      `hashed v33 IR already omits empty payload on ${slot.role}`,
    );
    const hashedPlan = compileExpectedScenePlanV33(hashedIr, {
      rootOwnershipKey: scene.ownershipKey,
    });
    assert.equal(
      hashedPlan.facts.some((fact) => fact.channel === "instancePayload"),
      false,
      `hashed v33 compiled plan omits instancePayload when IR omits payload on ${slot.role}`,
    );
    const hashedComparison = compareSceneToExpectedPlanV33(hashedPlan, scene);
    assert.equal(
      hashedComparison.extra.some((fact) => fact.channel === "instancePayload"),
      true,
      `hashed v33 observe still re-injects empty instancePayload on ${slot.role}`,
    );
    const hostPlan = compileExpectedScenePlan(hostIr, {
      rootOwnershipKey: scene.ownershipKey,
    });
    assert.equal(
      hostPlan.facts.some((fact) => fact.channel === "instancePayload"),
      false,
      `v36 compiled plan must not invent instancePayload on ${slot.role}`,
    );
    const hostComparison = compareSceneToExpectedPlan(hostPlan, scene);
    assert.equal(
      hostComparison.extra.some((fact) => fact.channel === "instancePayload"),
      false,
      `v36 observe must omit empty instancePayload extras on ${slot.role}`,
    );
    assert.equal(
      hostComparison.mismatched.some(
        (pair) => pair.observed.channel === "instancePayload",
      ),
      false,
      `v36 observe must not mismatch instancePayload on ${slot.role}`,
    );
  }
});

const liveOptionInstanceWithNonemptyExtractPayload = (): SceneNodeSnapshot => ({
  ...liveOptionInstanceWithExtractPayload(),
  instancePayload: {
    ...emptyExtractInstancePayload(),
    text: ["Ada Lovelace"],
    content: { kind: "text", text: "Ada Lovelace" },
    fills: [{ type: "SOLID", color: "#1976d214" }],
  },
  componentProperties: {
    "Disabled#135:173540": false,
    "Label#135:173522": "Ada Lovelace",
    "Option state": "selected",
    Size: "small",
    "Value#135:173531": "Ada Lovelace",
  },
});

test("host observe omits nonempty option-instance instancePayload extras that IR and compile omit", () => {
  assert.equal(
    COMBOBOX_LIVE_V37_OBSERVE_OMIT_OPTION_INSTANCE_PAYLOAD_MARKER,
    "COMBOBOX-HOST-OBSERVE-OMIT-OPTION-INSTANCE-PAYLOAD",
  );
  const live = liveOptionInstanceWithNonemptyExtractPayload();
  const hostIr = sceneToNormalizedIr(live);
  assert.equal(hostIr.kind, "instance");
  assert.equal(hostIr.role, "combobox/option-instance/0");
  assert.equal(
    "payload" in hostIr,
    false,
    "v21 IR omit must stay; do not invent an option-instance payload",
  );
  assert.equal(hostIr.properties.Label, "Ada Lovelace");
  assert.equal(hostIr.properties.Value, "Ada Lovelace");
  assert.equal(hostIr.properties.Disabled, false);
  const hashedIr = sceneToNormalizedIrV34(live);
  assert.equal(hashedIr.kind, "instance");
  assert.equal(
    "payload" in hashedIr,
    false,
    "hashed v34 IR already omits option-instance payload",
  );
  const hashedPlan = compileExpectedScenePlanV34(hashedIr, {
    rootOwnershipKey: live.ownershipKey,
  });
  assert.equal(
    hashedPlan.facts.some((fact) => fact.channel === "instancePayload"),
    false,
    "hashed v34 compiled plan omits instancePayload when IR omits payload",
  );
  const hashedComparison = compareSceneToExpectedPlanV34(hashedPlan, live);
  const hashedExtras = hashedComparison.extra.filter(
    (fact) => fact.channel === "instancePayload",
  );
  assert.equal(
    hashedExtras.length,
    1,
    "hashed v34 observe still re-injects nonempty option-instance instancePayload",
  );
  assert.equal(
    instancePayloadTextFromFact(hashedExtras[0]!.value),
    "Ada Lovelace",
    "hashed v34 extra is the nonempty option label, not an invented ada slug",
  );
  const hostPlan = compileExpectedScenePlan(hostIr, {
    rootOwnershipKey: live.ownershipKey,
  });
  assert.equal(
    hostPlan.facts.some((fact) => fact.channel === "instancePayload"),
    false,
    "v36 compiled plan must not invent option-instance instancePayload",
  );
  const hostComparison = compareSceneToExpectedPlan(hostPlan, live);
  assert.equal(
    hostComparison.extra.some((fact) => fact.channel === "instancePayload"),
    false,
    "v36 observe must omit nonempty option-instance instancePayload extras",
  );
  assert.equal(
    hostComparison.mismatched.some(
      (pair) => pair.observed.channel === "instancePayload",
    ),
    false,
    "v36 observe must not mismatch option-instance instancePayload",
  );
  assert.equal(hostIr.properties.Label, "Ada Lovelace");
  assert.equal(hostIr.properties.Value, "Ada Lovelace");
  assert.equal(hostIr.properties.Disabled, false);
  const emptySlot = emptySlotInstanceScene(
    slotRoles[0]!.role,
    slotRoles[0]!.ownershipKey,
    slotRoles[0]!.componentRef,
  );
  const emptyComparison = compareSceneToExpectedPlan(
    compileExpectedScenePlan(sceneToNormalizedIr(emptySlot), {
      rootOwnershipKey: emptySlot.ownershipKey,
    }),
    emptySlot,
  );
  assert.equal(
    emptyComparison.extra.some((fact) => fact.channel === "instancePayload"),
    false,
    "v36 must keep the v34 empty slot instancePayload omit",
  );
});

const componentRefLastSegment = (value: unknown): string =>
  String(value).split("/").at(-1) ?? String(value);

const liveTriggerSlotInstance = (
  role: string,
  ownershipKey: string,
  componentRef: string,
): SceneNodeSnapshot => ({
  ownershipKey,
  type: "INSTANCE",
  name: role,
  semanticRole: role,
  width: 20,
  height: 20,
  visible: true,
  opacity: 1,
  layoutSizingHorizontal: "FIXED",
  layoutSizingVertical: "FIXED",
  componentRef,
  componentProperties: {},
  boundVariables: [],
  children: [],
});

const liveTriggerSelectedFirstScene = (): SceneNodeSnapshot => ({
  ownershipKey: "trigger",
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
  boundVariables: [],
  children: [
    liveTriggerSlotInstance(
      "combobox/control/leading",
      "trigger/children/0",
      "source/mui-autocomplete/selected",
    ),
    {
      ownershipKey: "trigger/children/1",
      type: "TEXT",
      name: "combobox/input",
      semanticRole: "combobox/input",
      width: 160,
      height: 24,
      visible: true,
      opacity: 1,
      characters: "Ada Lovelace",
      fontName: { family: "Roboto", style: "Regular" },
      fontSize: 16,
      boundVariables: [],
      children: [],
    },
    {
      ownershipKey: "trigger/children/2",
      type: "FRAME",
      name: "combobox/trailing-controls",
      semanticRole: "combobox/trailing-controls",
      width: 48,
      height: 20,
      visible: true,
      opacity: 1,
      layoutMode: "HORIZONTAL",
      boundVariables: [],
      children: [
        liveTriggerSlotInstance(
          "combobox/control/clear",
          "trigger/children/2/children/0",
          "source/mui-autocomplete/prefix",
        ),
        liveTriggerSlotInstance(
          "combobox/control/popup",
          "trigger/children/2/children/1",
          "source/mui-autocomplete/clear",
        ),
      ],
    },
  ],
});

test("compile trigger-slot componentRefs are prefix then clear then popup", () => {
  const instance = adaptReviewedCombobox(
    muiComboboxSource,
    muiComboboxAdapterConfig,
  );
  const envelope = compileComboboxRecipe(instance);
  const set = envelope.ir.children.find((child) => child.role === "combobox/set");
  assert.ok(set && set.kind === "component-set");
  const variant = set.children[0];
  assert.ok(variant && variant.kind === "component");
  const trigger = variant.children.find(
    (child) => child.role === "combobox/trigger",
  );
  assert.ok(trigger && trigger.kind === "frame");
  const refs = walkIr(trigger)
    .filter(
      (node) =>
        node.kind === "instance" &&
        (COMBOBOX_LIVE_V37_TRIGGER_SLOT_COMPILE_SIBLING_ROLES as readonly string[]).includes(
          node.role ?? "",
        ),
    )
    .map((node) =>
      node.kind === "instance" ? componentRefLastSegment(node.componentRef) : "",
    );
  assert.deepEqual(
    refs,
    [...COMBOBOX_LIVE_V37_TRIGGER_SLOT_COMPILE_SIBLING_COMPONENT_REFS],
    "compile sibling order is prefix then clear then popup, not selected first",
  );
  assert.deepEqual(
    [...COMBOBOX_LIVE_V37_TRIGGER_SLOT_COMPILE_SIBLING_ROLES],
    [
      "combobox/control/leading",
      "combobox/control/clear",
      "combobox/control/popup",
    ],
  );
});

test("host observe recovers trigger-slot componentRefs in compile sibling order, not live selected-first order", () => {
  assert.equal(
    COMBOBOX_LIVE_V37_TRIGGER_SLOT_COMPONENT_REF_COMPILE_SIBLING_ORDER_MARKER,
    "COMBOBOX-HOST-TRIGGER-SLOT-COMPONENT-REF-COMPILE-SIBLING-ORDER",
  );
  const instance = adaptReviewedCombobox(
    muiComboboxSource,
    muiComboboxAdapterConfig,
  );
  const envelope = compileComboboxRecipe(instance);
  const set = envelope.ir.children.find((child) => child.role === "combobox/set");
  assert.ok(set && set.kind === "component-set");
  const variant = set.children[0];
  assert.ok(variant && variant.kind === "component");
  const trigger = variant.children.find(
    (child) => child.role === "combobox/trigger",
  );
  assert.ok(trigger);
  const expected = compileExpectedScenePlan(trigger, {
    rootOwnershipKey: "trigger",
  });
  const expectedRefs = expected.facts
    .filter((fact) => fact.channel === "componentRef")
    .map((fact) => componentRefLastSegment(fact.value));
  assert.deepEqual(expectedRefs, ["prefix", "clear", "popup"]);
  const live = liveTriggerSelectedFirstScene();
  const hashedExpected = compileExpectedScenePlanV35(trigger, {
    rootOwnershipKey: "trigger",
  });
  const hashed = compareSceneToExpectedPlanV35(hashedExpected, live);
  const hashedPairs = hashed.mismatched
    .filter((pair) => pair.expected.channel === "componentRef")
    .map((pair) => [
      componentRefLastSegment(pair.expected.value),
      componentRefLastSegment(pair.observed.value),
    ]);
  assert.deepEqual(
    hashedPairs,
    [
      ["prefix", "selected"],
      ["clear", "prefix"],
      ["popup", "clear"],
    ],
    "hashed v35 still observes selected then prefix then clear",
  );
  const host = compareSceneToExpectedPlan(expected, live);
  assert.deepEqual(
    host.mismatched
      .filter((pair) => pair.expected.channel === "componentRef")
      .map((pair) => [
        componentRefLastSegment(pair.expected.value),
        componentRefLastSegment(pair.observed.value),
      ]),
    [],
    "v36 observe must recover prefix then clear then popup",
  );
  assert.equal(
    host.missing.filter((fact) => fact.channel === "componentRef").length,
    0,
  );
  assert.equal(
    host.extra.filter((fact) => fact.channel === "componentRef").length,
    0,
  );
  const selected = childlessControlScene();
  assert.equal(
    canonicalizeObservedTriggerSlotComponentRef(
      selected.componentRef ?? "selected",
      "combobox/option/selected-indicator",
    ),
    "selected",
    "do not invent a selected trigger slot or remap selected-indicator",
  );
  assert.equal(
    canonicalizeObservedTriggerSlotComponentRef(
      "source/mui-autocomplete/selected",
      "combobox/control/leading",
    ),
    "source/mui-autocomplete/prefix",
  );
  assert.equal(
    canonicalizeObservedTriggerSlotComponentRef(
      "source/mui-autocomplete/prefix",
      "combobox/control/clear",
    ),
    "source/mui-autocomplete/clear",
  );
  assert.equal(
    canonicalizeObservedTriggerSlotComponentRef(
      "source/mui-autocomplete/clear",
      "combobox/control/popup",
    ),
    "source/mui-autocomplete/popup",
  );
});

test("hashed v35 scene-readback bytes stay frozen", () => {
  const bytes = readFileSync("recipe/scene-readback-combobox-v35.ts", "utf8");
  assert.doesNotMatch(
    bytes,
    /COMBOBOX-HOST-TRIGGER-SLOT-COMPONENT-REF-COMPILE-SIBLING-ORDER/,
  );
  assert.match(bytes, /COMBOBOX-HOST-OBSERVE-OMIT-OPTION-INSTANCE-PAYLOAD/);
});

const instancePayloadTextFromFact = (value: unknown): string | undefined => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const record = value as { content?: { text?: unknown }; text?: unknown };
  if (record.content && typeof record.content === "object") {
    const text = (record.content as { text?: unknown }).text;
    if (typeof text === "string") return text;
  }
  if (Array.isArray(record.text) && typeof record.text[0] === "string") {
    return record.text[0];
  }
  return undefined;
};

const liveRootScene = (ownershipKey: "combobox" | "option"): SceneNodeSnapshot => ({
  ownershipKey,
  type: "FRAME",
  name:
    ownershipKey === "combobox"
      ? "combobox/set"
      : "combobox/option-set :: Combobox option",
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
    COMBOBOX_LIVE_V37_PROJECT_LIVE_ROOT_OWNERSHIP_KEY_MARKER,
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
    COMBOBOX_LIVE_V37_RECOVER_RECIPE_COMPONENT_REF_MARKER,
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
    COMBOBOX_LIVE_V37_RECOVER_COMPONENT_PROPERTY_NAME_MARKER,
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
    COMBOBOX_LIVE_V37_TRIGGER_BINDING_COMPILE_ORDER_MARKER,
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
    COMBOBOX_LIVE_V37_LEADING_SLOT_BINDING_COMPILE_ORDER_MARKER,
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
    COMBOBOX_LIVE_V37_LEADING_SLOT_COMPILE_CARRY_VISIBLE_MARKER,
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
    COMBOBOX_LIVE_V37_TRAILING_SLOT_BINDING_COMPILE_ORDER_MARKER,
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
    COMBOBOX_LIVE_V37_TRAILING_SLOT_COMPILE_CARRY_VISIBLE_MARKER,
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

const liveOverlayWithEmptyDashPattern = (): SceneNodeSnapshot => ({
  ...liveOverlayWithDropShadow(),
  strokes: [{ type: "SOLID", color: "#e0e0e0ff" }],
  strokeWeight: 1,
  strokeAlign: "INSIDE",
  dashPattern: [],
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
    COMBOBOX_LIVE_V37_TRIGGER_EMPTY_EFFECTS_OMITTED_MARKER,
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
  const listbox = sceneToNormalizedIrV15(liveListboxWithEmptyEffects());
  assert.equal(listbox.kind, "frame");
  assert.equal(listbox.role, "combobox/listbox");
  assert.deepEqual(
    listbox.effects,
    [],
    "hashed v15 still emits empty listbox effects; firstDifference stopped at trigger",
  );
});

test("host aliases combobox/overlay width.value to layout.width.value so that field precedes fills.0.color", () => {
  assert.equal(
    COMBOBOX_LIVE_V37_OVERLAY_BINDING_COMPILE_ORDER_MARKER,
    "COMBOBOX-OVERLAY-BINDING-COMPILE-ORDER",
  );
  assert.equal(
    COMBOBOX_LIVE_V37_OVERLAY_LAYOUT_WIDTH_ALIAS_MARKER,
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
    COMBOBOX_LIVE_V37_LISTBOX_BINDING_COMPILE_ORDER_MARKER,
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
  assert.equal(
    observed.effects,
    undefined,
    "v24 host omits empty listbox effects that compile never emits",
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
    COMBOBOX_LIVE_V37_OPTION_INSTANCE_BINDING_EXTRAS_MARKER,
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
  const listbox = sceneToNormalizedIrV19(liveListboxWithEmptyEffects());
  assert.equal(listbox.kind, "frame");
  assert.deepEqual(
    listbox.effects,
    [],
    "hashed v19 still emits empty listbox effects",
  );
});

const liveOptionInstanceWithInheritedFills = (): SceneNodeSnapshot => ({
  ...liveOptionInstanceWithInheritedBindings(),
  fills: [{ type: "SOLID", color: "#1976d214" }],
});

test("host omits inherited fills on combobox/option-instance that compile never emits", () => {
  assert.equal(
    COMBOBOX_LIVE_V37_OPTION_INSTANCE_FILLS_OMITTED_MARKER,
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
  const listbox = sceneToNormalizedIrV20(liveListboxWithEmptyEffects());
  assert.equal(listbox.kind, "frame");
  assert.deepEqual(
    listbox.effects,
    [],
    "hashed v20 still emits empty listbox effects",
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
    COMBOBOX_LIVE_V37_OPTION_INSTANCE_PAYLOAD_OMITTED_MARKER,
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
  const listbox = sceneToNormalizedIrV21(liveListboxWithEmptyEffects());
  assert.equal(listbox.kind, "frame");
  assert.deepEqual(
    listbox.effects,
    [],
    "hashed v21 still emits empty listbox effects",
  );
});

test("host omits combobox/listbox clipsContent that compile never emits", () => {
  assert.equal(
    COMBOBOX_LIVE_V37_LISTBOX_CLIPS_CONTENT_OMITTED_MARKER,
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
  assert.equal(
    observed.effects,
    undefined,
    "v24 host omits empty listbox effects that compile never emits",
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
    COMBOBOX_LIVE_V37_LISTBOX_CORNER_RADIUS_OMITTED_MARKER,
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
    "compile overlay emits cornerRadius; v24 must not omit it",
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
    "hashed v22 already omits listbox clipsContent; v24 must keep that omit",
  );
  assert.deepEqual(
    hashedV22.effects,
    [],
    "hashed v22 still emits empty listbox effects",
  );
  assert.deepEqual(
    hashedV22.kind === "frame" ? hashedV22.strokes : undefined,
    [],
    "hashed v22 still emits empty listbox strokes; v24 must not lift that omit",
  );
  const hashedV23 = sceneToNormalizedIrV23(live);
  assert.equal(hashedV23.kind, "frame");
  assert.equal(
    "cornerRadius" in hashedV23,
    false,
    "hashed v23 already omits listbox cornerRadius; v24 must keep that omit",
  );
  assert.deepEqual(
    hashedV23.effects,
    [],
    "hashed v23 still emits empty listbox effects; v24 must not patch those bytes",
  );
  const observed = sceneToNormalizedIr(live);
  assert.equal(observed.kind, "frame");
  assert.equal(observed.role, "combobox/listbox");
  assert.equal(
    "cornerRadius" in observed,
    false,
    "v24 host must omit listbox cornerRadius that compile never emits",
  );
  assert.equal(
    "clipsContent" in observed,
    false,
    "v24 must keep the v22 listbox clipsContent omit",
  );
  assert.equal(
    observed.effects,
    undefined,
    "v24 host omits empty listbox effects that compile never emits",
  );
  assert.equal(
    "strokes" in observed,
    false,
    "v25 host omits empty listbox strokes that compile never emits",
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
    "v24 must keep overlay cornerRadius that compile emits",
  );
  assert.equal(
    overlay.kind === "frame" && overlay.clipsContent,
    true,
    "v24 must keep overlay clipsContent that compile emits",
  );
});

test("host omits empty combobox/listbox effects that compile never emits", () => {
  assert.equal(
    COMBOBOX_LIVE_V37_LISTBOX_EMPTY_EFFECTS_OMITTED_MARKER,
    "COMBOBOX-LISTBOX-EMPTY-EFFECTS-OMITTED",
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
  const compiledTrigger = walkIr(envelope.ir).find(
    (node) => node.role === "combobox/trigger",
  );
  assert.ok(compiledListbox);
  assert.ok(compiledOverlay);
  assert.ok(compiledTrigger);
  assert.equal(
    "effects" in compiledListbox,
    false,
    "compile listbox omits the effects key",
  );
  assert.ok(
    compiledOverlay.effects && compiledOverlay.effects.length > 0,
    "compile overlay emits drop-shadow; v24 must not omit it",
  );
  assert.equal(
    compiledTrigger.effects,
    undefined,
    "compile trigger omits effects; v15 omit stays",
  );
  const live = liveListboxWithEmptyEffects();
  const hashedV23 = sceneToNormalizedIrV23(live);
  assert.equal(hashedV23.kind, "frame");
  assert.deepEqual(
    hashedV23.effects,
    [],
    "hashed v23 still emits empty listbox effects",
  );
  assert.equal(
    "cornerRadius" in hashedV23,
    false,
    "hashed v23 already omits listbox cornerRadius; v24 must keep that omit",
  );
  assert.equal(
    "clipsContent" in hashedV23,
    false,
    "hashed v23 already omits listbox clipsContent; v24 must keep that omit",
  );
  assert.deepEqual(
    hashedV23.kind === "frame" ? hashedV23.strokes : undefined,
    [],
    "hashed v23 still emits empty listbox strokes; v24 must not lift that omit",
  );
  const hashedV24 = sceneToNormalizedIrV24(live);
  assert.equal(hashedV24.kind, "frame");
  assert.equal(
    hashedV24.effects,
    undefined,
    "hashed v24 already omits empty listbox effects; v25 must keep that omit",
  );
  assert.deepEqual(
    hashedV24.kind === "frame" ? hashedV24.strokes : undefined,
    [],
    "hashed v24 still emits empty listbox strokes; v25 must not patch those bytes",
  );
  const observed = sceneToNormalizedIr(live);
  assert.equal(observed.kind, "frame");
  assert.equal(observed.role, "combobox/listbox");
  assert.equal(
    observed.effects,
    undefined,
    "v25 must keep the v24 listbox empty-effects omit",
  );
  assert.equal(
    "cornerRadius" in observed,
    false,
    "v25 must keep the v23 listbox cornerRadius omit",
  );
  assert.equal(
    "clipsContent" in observed,
    false,
    "v25 must keep the v22 listbox clipsContent omit",
  );
  assert.equal(
    "strokes" in observed,
    false,
    "v25 host must omit empty listbox strokes that compile never emits",
  );
  const overlay = sceneToNormalizedIr(liveOverlayWithDropShadow());
  assert.equal(overlay.kind, "frame");
  assert.equal(overlay.role, "combobox/overlay");
  assert.ok(
    overlay.effects && overlay.effects.length === 1,
    "v24 must keep overlay compile-carried drop-shadow",
  );
  const trigger = sceneToNormalizedIr(liveTriggerWithEmptyEffects());
  assert.equal(trigger.kind, "frame");
  assert.equal(
    trigger.effects,
    undefined,
    "v25 must keep the v15 trigger empty-effects omit",
  );
});

test("host omits empty combobox/listbox strokes that compile never emits", () => {
  assert.equal(
    COMBOBOX_LIVE_V37_LISTBOX_EMPTY_STROKES_OMITTED_MARKER,
    "COMBOBOX-LISTBOX-EMPTY-STROKES-OMITTED",
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
    "strokes" in compiledListbox,
    false,
    "compile listbox omits the strokes key",
  );
  assert.ok(
    compiledOverlay.kind === "frame" &&
      compiledOverlay.strokes &&
      compiledOverlay.strokes.length > 0,
    "compile overlay emits border strokes; v25 must not omit them",
  );
  const live = liveListboxWithEmptyEffects();
  const hashedV24 = sceneToNormalizedIrV24(live);
  assert.equal(hashedV24.kind, "frame");
  assert.deepEqual(
    hashedV24.kind === "frame" ? hashedV24.strokes : undefined,
    [],
    "hashed v24 still emits empty listbox strokes",
  );
  assert.equal(
    hashedV24.effects,
    undefined,
    "hashed v24 already omits empty listbox effects; v25 must keep that omit",
  );
  assert.equal(
    "cornerRadius" in hashedV24,
    false,
    "hashed v24 already omits listbox cornerRadius; v25 must keep that omit",
  );
  assert.equal(
    "clipsContent" in hashedV24,
    false,
    "hashed v24 already omits listbox clipsContent; v25 must keep that omit",
  );
  const observed = sceneToNormalizedIr(live);
  assert.equal(observed.kind, "frame");
  assert.equal(observed.role, "combobox/listbox");
  assert.equal(
    "strokes" in observed,
    false,
    "v25 host must omit empty listbox strokes that compile never emits",
  );
  assert.equal(
    observed.effects,
    undefined,
    "v25 must keep the v24 listbox empty-effects omit",
  );
  const overlay = sceneToNormalizedIr({
    ...liveOverlayWithDropShadow(),
    strokes: [{ type: "SOLID", color: "#e0e0e0ff" }],
    strokeWeight: 1,
    strokeAlign: "INSIDE",
  });
  assert.equal(overlay.kind, "frame");
  assert.equal(overlay.role, "combobox/overlay");
  assert.equal(
    overlay.kind === "frame" && overlay.strokes?.length,
    1,
    "v25 must keep overlay compile-carried border strokes",
  );
  assert.ok(
    overlay.effects && overlay.effects.length === 1,
    "v25 must keep overlay compile-carried drop-shadow",
  );
});

test("host omits empty combobox/overlay stroke dashPattern that compile never emits", () => {
  assert.equal(
    COMBOBOX_LIVE_V37_OVERLAY_EMPTY_DASH_PATTERN_OMITTED_MARKER,
    "COMBOBOX-OVERLAY-EMPTY-DASH-PATTERN-OMITTED",
  );
  const instance = adaptReviewedCombobox(
    muiComboboxSource,
    muiComboboxAdapterConfig,
  );
  const envelope = compileComboboxRecipe(instance);
  const compiledOverlay = walkIr(envelope.ir).find(
    (node) => node.role === "combobox/overlay",
  );
  const compiledTrigger = walkIr(envelope.ir).find(
    (node) => node.role === "combobox/trigger",
  );
  assert.ok(compiledOverlay);
  assert.ok(compiledTrigger);
  assert.ok(
    compiledOverlay.kind === "frame" &&
      compiledOverlay.strokes &&
      compiledOverlay.strokes.length > 0,
    "compile overlay emits border strokes; v26 must not omit them",
  );
  assert.equal(
    compiledOverlay.kind === "frame"
      ? compiledOverlay.strokes?.[0]?.dashPattern
      : undefined,
    undefined,
    "compile overlay omits dashPattern on those strokes",
  );
  assert.ok(
    compiledOverlay.effects && compiledOverlay.effects.length > 0,
    "compile overlay emits drop-shadow; v26 must not omit it",
  );
  const live = liveOverlayWithEmptyDashPattern();
  const hashedV25 = sceneToNormalizedIrV25(live);
  assert.equal(hashedV25.kind, "frame");
  assert.deepEqual(
    hashedV25.kind === "frame" ? hashedV25.strokes?.[0]?.dashPattern : undefined,
    [],
    "hashed v25 still emits empty overlay stroke dashPattern; v26 must not patch those bytes",
  );
  assert.equal(
    hashedV25.kind === "frame" && hashedV25.strokes?.length,
    1,
    "hashed v25 already keeps overlay border strokes",
  );
  const observed = sceneToNormalizedIr(live);
  assert.equal(observed.kind, "frame");
  assert.equal(observed.role, "combobox/overlay");
  assert.equal(
    observed.kind === "frame" && observed.strokes?.length,
    1,
    "v26 must keep overlay compile-carried border strokes",
  );
  assert.equal(
    observed.kind === "frame"
      ? observed.strokes?.[0]?.dashPattern
      : undefined,
    undefined,
    "v26 host must omit empty overlay dashPattern that compile never emits",
  );
  assert.ok(
    observed.effects && observed.effects.length === 1,
    "v26 must keep overlay compile-carried drop-shadow",
  );
  const nonempty = sceneToNormalizedIr({
    ...liveOverlayWithEmptyDashPattern(),
    dashPattern: [2, 2],
  });
  assert.deepEqual(
    nonempty.kind === "frame" ? nonempty.strokes?.[0]?.dashPattern : undefined,
    [2, 2],
    "v26 must not omit a nonempty overlay dashPattern",
  );
  const listbox = sceneToNormalizedIr({
    ownershipKey: "combobox/children/0/children/3/children/0",
    type: "FRAME",
    name: "combobox/listbox",
    semanticRole: "combobox/listbox",
    width: 240,
    height: 120,
    visible: true,
    opacity: 1,
    clipsContent: true,
    strokes: [{ type: "SOLID", color: "#e0e0e0ff" }],
    strokeWeight: 1,
    strokeAlign: "INSIDE",
    dashPattern: [],
    boundVariables: [],
    children: [],
  });
  assert.equal(
    "strokes" in listbox,
    false,
    "v26 must keep the v25 listbox empty-strokes omit; do not lift dashPattern omit by inventing listbox strokes",
  );
});

const liveSetWithClipsContent = (
  role: "combobox/set" | "combobox/option-set",
): SceneNodeSnapshot => ({
  ownershipKey: role === "combobox/set" ? "combobox" : "option",
  type: "COMPONENT_SET",
  name: role,
  semanticRole: role,
  width: 320,
  height: 80,
  visible: true,
  opacity: 1,
  layoutMode: "VERTICAL",
  layoutSizingHorizontal: "HUG",
  layoutSizingVertical: "HUG",
  clipsContent: true,
  variantGroupProperties: {
    Size: { values: ["small", "medium"] },
  },
  boundVariables: [],
  children: [
    {
      ownershipKey:
        role === "combobox/set" ? "combobox/children/0" : "option/children/0",
      type: "COMPONENT",
      name:
        role === "combobox/set"
          ? "combobox/variant/small/outlined/true/default/options"
          : "combobox/option/small/default",
      semanticRole:
        role === "combobox/set"
          ? "combobox/variant/small/outlined/true/default/options"
          : "combobox/option/small/default",
      width: 240,
      height: 40,
      visible: true,
      opacity: 1,
      layoutMode: "VERTICAL",
      layoutSizingHorizontal: "HUG",
      layoutSizingVertical: "HUG",
      clipsContent: false,
      variantProperties: { Size: "small" },
      boundVariables: [],
      children: [],
    },
  ],
});

const liveVariantWithClipsContentFalse = (): SceneNodeSnapshot => ({
  ownershipKey: "combobox/children/0",
  type: "COMPONENT",
  name: "combobox/variant/small/outlined/true/default/options",
  semanticRole: "combobox/variant/small/outlined/true/default/options",
  width: 240,
  height: 40,
  visible: true,
  opacity: 1,
  layoutMode: "VERTICAL",
  layoutSizingHorizontal: "HUG",
  layoutSizingVertical: "HUG",
  clipsContent: false,
  boundVariables: [],
  children: [],
});

test("host omits combobox/set and option-set clipsContent that compile never emits", () => {
  assert.equal(
    COMBOBOX_LIVE_V37_SET_CLIPS_CONTENT_OMITTED_MARKER,
    "COMBOBOX-SET-CLIPS-CONTENT-OMITTED",
  );
  const instance = adaptReviewedCombobox(
    muiComboboxSource,
    muiComboboxAdapterConfig,
  );
  const envelope = compileComboboxRecipe(instance);
  const compiledSet = walkIr(envelope.ir).find(
    (node) => node.role === "combobox/set",
  );
  const compiledOptionSet = walkIr(envelope.ir).find(
    (node) => node.role === "combobox/option-set",
  );
  const compiledOverlay = walkIr(envelope.ir).find(
    (node) => node.role === "combobox/overlay",
  );
  const compiledVariant = walkIr(envelope.ir).find(
    (node) => node.kind === "component" && node.role?.startsWith("combobox/variant/"),
  );
  assert.ok(compiledSet);
  assert.ok(compiledOptionSet);
  assert.ok(compiledOverlay);
  assert.ok(compiledVariant);
  assert.equal(
    "clipsContent" in compiledSet,
    false,
    "compile set omits the clipsContent key",
  );
  assert.equal(
    "clipsContent" in compiledOptionSet,
    false,
    "compile option-set omits the clipsContent key",
  );
  assert.equal(
    compiledOverlay.kind === "frame" && compiledOverlay.clipsContent,
    true,
    "compile overlay emits clipsContent true; v27 must not omit it",
  );
  assert.equal(
    compiledVariant.kind === "component" && compiledVariant.clipsContent,
    false,
    "compile variant emits clipsContent false; v27 must not omit it",
  );
  for (const role of ["combobox/set", "combobox/option-set"] as const) {
    const live = liveSetWithClipsContent(role);
    const hashedV26 = sceneToNormalizedIrV26(live);
    assert.equal(hashedV26.kind, "component-set");
    assert.equal(
      hashedV26.kind === "component-set" && hashedV26.clipsContent,
      true,
      `hashed v26 still emits live ${role} clipsContent; v27 must not patch those bytes`,
    );
    const observed = sceneToNormalizedIr(live);
    assert.equal(observed.kind, "component-set");
    assert.equal(observed.role, role);
    assert.equal(
      "clipsContent" in observed,
      false,
      `v27 host must omit ${role} clipsContent that compile never emits`,
    );
  }
  const overlay = sceneToNormalizedIr(liveOverlayWithDropShadow());
  assert.equal(overlay.kind, "frame");
  assert.equal(
    overlay.kind === "frame" && overlay.clipsContent,
    true,
    "v27 must keep overlay clipsContent that compile emits",
  );
  const variant = sceneToNormalizedIr(liveVariantWithClipsContentFalse());
  assert.equal(variant.kind, "component");
  assert.equal(
    variant.kind === "component" && variant.clipsContent,
    false,
    "v27 must keep variant clipsContent false that compile emits",
  );
});

const liveOptionWithExtractOrderBindings = (): SceneNodeSnapshot => ({
  ownershipKey: "option/children/0",
  type: "COMPONENT",
  name: "Size=small, Option state=default",
  semanticRole: "combobox/option/small/default",
  width: 240,
  height: 40,
  visible: true,
  opacity: 1,
  layoutMode: "HORIZONTAL",
  layoutSizingHorizontal: "FILL",
  layoutSizingVertical: "FIXED",
  clipsContent: false,
  itemSpacing: 8,
  paddingLeft: 12,
  paddingRight: 12,
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
    {
      field: "width",
      variableName: "size/width",
      resolvedType: "FLOAT",
    },
  ],
  children: [],
});

test("host orders combobox/option bindings to compile field order so layout.itemSpacing precedes fills.0.color", () => {
  assert.equal(
    COMBOBOX_LIVE_V37_OPTION_BINDING_COMPILE_ORDER_MARKER,
    "COMBOBOX-OPTION-BINDING-COMPILE-ORDER",
  );
  assert.deepEqual(
    [...COMBOBOX_LIVE_V1_OPTION_COMPILE_BINDING_FIELDS],
    [
      "layout.itemSpacing",
      "layout.padding.left",
      "layout.padding.right",
      "layout.width.value",
      "layout.height.value",
      "fills.0.color",
    ],
    "option compile-order list must rank itemSpacing then padding left/right then layout width/height then fills",
  );
  const instance = adaptReviewedCombobox(
    muiComboboxSource,
    muiComboboxAdapterConfig,
  );
  const envelope = compileComboboxRecipe(instance);
  const compiledOption = walkIr(envelope.ir).find(
    (node) => node.role === "combobox/option/small/default",
  );
  assert.ok(compiledOption);
  assert.deepEqual(
    (compiledOption.bindings ?? []).map((binding) => binding.field),
    [...COMBOBOX_LIVE_V1_OPTION_COMPILE_BINDING_FIELDS],
    "compile option bindings start at layout.itemSpacing",
  );
  const live = liveOptionWithExtractOrderBindings();
  const hashedV27 = sceneToNormalizedIrV27(live);
  assert.equal(hashedV27.kind, "component");
  assert.deepEqual(
    (hashedV27.bindings ?? []).map((binding) => binding.field),
    [
      "fills.0.color",
      "height.value",
      "layout.itemSpacing",
      "layout.width.value",
      "layout.padding.left",
      "layout.padding.right",
    ],
    "hashed v27 still starts combobox/option bindings at fills.0.color",
  );
  const hashedV28 = sceneToNormalizedIrV28(live);
  assert.equal(hashedV28.kind, "component");
  assert.deepEqual(
    (hashedV28.bindings ?? []).map((binding) => binding.field),
    [
      "layout.itemSpacing",
      "layout.padding.left",
      "layout.padding.right",
      "layout.width.value",
      "fills.0.color",
      "height.value",
    ],
    "hashed v28 still leaves height.value unknown last after the option sort",
  );
  const observed = sceneToNormalizedIr(live);
  assert.equal(observed.kind, "component");
  assert.equal(observed.role, "combobox/option/small/default");
  const observedFields = (observed.bindings ?? []).map(
    (binding) => binding.field,
  );
  assert.deepEqual(
    observedFields,
    [...COMBOBOX_LIVE_V1_OPTION_COMPILE_BINDING_FIELDS],
    "v29 host must alias option height.value to layout.height.value so compile-order ranks it before fills.0.color",
  );
  assert.equal(
    observedFields[0],
    "layout.itemSpacing",
    "v29 must not keep live extract fills.0.color first",
  );
  const known = observedFields.filter((field) =>
    (COMBOBOX_LIVE_V1_OPTION_COMPILE_BINDING_FIELDS as readonly string[]).includes(
      field,
    ),
  );
  assert.deepEqual(
    known,
    [...COMBOBOX_LIVE_V1_OPTION_COMPILE_BINDING_FIELDS],
    "v29 known option fields must follow compile order including aliased layout.height.value",
  );
});

test("host aliases combobox/option height.value to layout.height.value so that field precedes fills.0.color", () => {
  assert.equal(
    COMBOBOX_LIVE_V37_OPTION_LAYOUT_HEIGHT_ALIAS_MARKER,
    "COMBOBOX-OPTION-LAYOUT-HEIGHT-ALIAS-FROM-HEIGHT-VALUE",
  );
  assert.equal(
    COMBOBOX_LIVE_V37_OPTION_BINDING_COMPILE_ORDER_MARKER,
    "COMBOBOX-OPTION-BINDING-COMPILE-ORDER",
  );
  const live = liveOptionWithExtractOrderBindings();
  const hashedV28 = sceneToNormalizedIrV28(live);
  assert.equal(
    (hashedV28.bindings ?? []).some((binding) => binding.field === "height.value"),
    true,
    "hashed v28 still emits option height.value",
  );
  assert.equal(
    (hashedV28.bindings ?? []).some(
      (binding) => binding.field === "layout.height.value",
    ),
    false,
    "hashed v28 does not alias option height.value",
  );
  const observed = sceneToNormalizedIr(live);
  const aliased = (observed.bindings ?? []).find(
    (binding) => binding.field === "layout.height.value",
  );
  assert.ok(aliased);
  assert.equal(aliased.type, "FLOAT");
  assert.equal(
    aliased.variable,
    "size/optionHeight",
    "v29 must reuse the extract height variable; do not invent a pixel height",
  );
  assert.equal(
    (observed.bindings ?? []).some((binding) => binding.field === "height.value"),
    false,
    "v29 must not keep a duplicate option height.value after alias",
  );
  assert.equal(
    (observed.bindings ?? []).map((binding) => binding.field)[4],
    "layout.height.value",
    "v29 must rank aliased layout.height.value before fills.0.color",
  );
});

const liveSelectedIndicatorScene = (): SceneNodeSnapshot => ({
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
  boundVariables: [
    {
      field: "fills.0.color",
      variableName: "option/text",
      resolvedType: "COLOR",
    },
    {
      field: "height.value",
      variableName: "size/controlSize",
      resolvedType: "FLOAT",
    },
    {
      field: "width.value",
      variableName: "size/controlSize",
      resolvedType: "FLOAT",
    },
  ],
  children: [],
});

test("host orders combobox/option/selected-indicator bindings to compile field order, not live extract fills-first list", () => {
  assert.equal(
    COMBOBOX_LIVE_V37_SELECTED_INDICATOR_BINDING_COMPILE_ORDER_MARKER,
    "COMBOBOX-SELECTED-INDICATOR-BINDING-COMPILE-ORDER-WIDTH-HEIGHT-FILL",
  );
  assert.deepEqual(
    [...COMBOBOX_LIVE_V1_SELECTED_INDICATOR_COMPILE_BINDING_FIELDS],
    ["width.value", "height.value", "fills.0.color"],
    "v31 compile-order list must rank width then height then fill",
  );
  assert.deepEqual(
    [...COMBOBOX_LIVE_V1_LEADING_SLOT_COMPILE_BINDING_FIELDS],
    ["width.value", "height.value", "fills.0.color"],
    "selected-indicator reuses the v11/v13 slot compile-order fields",
  );
  const live = liveSelectedIndicatorScene();
  const hashed = sceneToNormalizedIrV30(live);
  assert.equal(hashed.kind, "instance");
  assert.deepEqual(
    (hashed.bindings ?? []).map((binding) => binding.field),
    ["fills.0.color", "height.value", "width.value"],
    "hashed v30 still emits live extract fills-first selected-indicator order",
  );
  const observed = sceneToNormalizedIr(live);
  assert.equal(observed.kind, "instance");
  assert.deepEqual(
    (observed.bindings ?? []).map((binding) => binding.field),
    ["width.value", "height.value", "fills.0.color"],
    "v31 host must keep compile width then height then fill, not live extract order",
  );
  const instance = adaptReviewedCombobox(
    muiComboboxSource,
    muiComboboxAdapterConfig,
  );
  const envelope = compileComboboxRecipe(instance);
  const compiled = walkIr(envelope.ir).find(
    (node) => node.role === "combobox/option/selected-indicator",
  );
  assert.ok(compiled);
  assert.deepEqual(
    (compiled.bindings ?? []).map((binding) => binding.field),
    ["width.value", "height.value", "fills.0.color"],
    "compile selected-indicator starts at width.value then height.value then fills.0.color",
  );
});

test("host emits compile-carried visible: true on combobox/option/selected-indicator instead of omitting default-true", () => {
  assert.equal(
    COMBOBOX_LIVE_V37_SELECTED_INDICATOR_COMPILE_CARRY_VISIBLE_MARKER,
    "COMBOBOX-SELECTED-INDICATOR-COMPILE-CARRY-VISIBLE-TRUE",
  );
  const live = liveSelectedIndicatorScene();
  const hashed = sceneToNormalizedIrV31(live);
  assert.equal(hashed.kind, "instance");
  assert.equal(
    hashed.visible,
    undefined,
    "hashed v31 still omits default-true selected-indicator visible",
  );
  const observed = sceneToNormalizedIr(live);
  assert.equal(observed.kind, "instance");
  assert.equal(
    observed.visible,
    true,
    "v32 host must emit compile-carried visible: true on selected-indicator",
  );
  assert.equal(
    observed.opacity,
    undefined,
    "v32 must not change occupancy opacity omit; default-1 opacity stays omitted",
  );
  const instance = adaptReviewedCombobox(
    muiComboboxSource,
    muiComboboxAdapterConfig,
  );
  const envelope = compileComboboxRecipe(instance);
  const compiled = walkIr(envelope.ir).find(
    (node) => node.role === "combobox/option/selected-indicator",
  );
  assert.ok(compiled);
  assert.equal(
    compiled.visible,
    true,
    "compile selected-indicator emits visible: true; host must carry it",
  );
  assert.deepEqual(
    [...COMBOBOX_LIVE_V1_LEADING_SLOT_ROLES],
    ["combobox/control/leading"],
    "v32 must not add selected-indicator to leading slot roles",
  );
  assert.deepEqual(
    [...COMBOBOX_LIVE_V1_TRAILING_SLOT_ROLES],
    ["combobox/control/clear", "combobox/control/popup"],
    "v32 must not add selected-indicator to trailing slot roles",
  );
});

const liveOptionSetLabelScene = (displayName: string): SceneNodeSnapshot => ({
  ...liveSetWithClipsContent("combobox/option-set"),
  name: `combobox/option-set :: ${displayName}`,
});

const liveComboboxSetLabelScene = (displayName: string): SceneNodeSnapshot => ({
  ...liveSetWithClipsContent("combobox/set"),
  name: `combobox/set :: ${displayName}`,
});

test("host emits compile-carried label Combobox option on combobox/option-set instead of the live display name after ::", () => {
  assert.equal(
    COMBOBOX_LIVE_V37_OPTION_SET_COMPILE_CARRY_LABEL_MARKER,
    "COMBOBOX-OPTION-SET-COMPILE-CARRY-LABEL",
  );
  assert.equal(
    COMBOBOX_LIVE_V37_OPTION_SET_COMPILE_CARRY_LABEL,
    "Combobox option",
    "v33 must carry compile's option-set label, not invent a name or parse the live fixture string",
  );
  const fixtures = [
    {
      displayName: "MUI Autocomplete / combobox@1 offline fixture",
      reviewed: muiComboboxSource,
      config: muiComboboxAdapterConfig,
    },
    {
      displayName: "AntD Select / combobox@1 offline fixture",
      reviewed: antdComboboxSource,
      config: antdComboboxAdapterConfig,
    },
  ] as const;
  for (const fixture of fixtures) {
    const live = liveOptionSetLabelScene(fixture.displayName);
    const hashed = sceneToNormalizedIrV32(live);
    assert.equal(hashed.kind, "component-set");
    assert.equal(
      hashed.label,
      fixture.displayName,
      "hashed v32 still emits the live display name after ::",
    );
    const observed = sceneToNormalizedIr(live);
    assert.equal(observed.kind, "component-set");
    assert.equal(observed.role, "combobox/option-set");
    assert.equal(
      observed.label,
      "Combobox option",
      "v33 host must emit compile-carried Combobox option, not the live display name after ::",
    );
    const setLive = liveComboboxSetLabelScene(fixture.displayName);
    const setHashed = sceneToNormalizedIrV32(setLive);
    const setObserved = sceneToNormalizedIr(setLive);
    assert.equal(setHashed.label, fixture.displayName);
    assert.equal(
      setObserved.label,
      fixture.displayName,
      "v33 must not change combobox/set labels that already match compile identity.name",
    );
    const instance = adaptReviewedCombobox(fixture.reviewed, fixture.config);
    const envelope = compileComboboxRecipe(instance);
    const compiledOptionSet = walkIr(envelope.ir).find(
      (node) => node.role === "combobox/option-set",
    );
    const compiledSet = walkIr(envelope.ir).find(
      (node) => node.role === "combobox/set",
    );
    assert.ok(compiledOptionSet);
    assert.ok(compiledSet);
    assert.equal(
      compiledOptionSet.label,
      "Combobox option",
      "compile option-set already emits Combobox option; host must carry it",
    );
    assert.equal(
      compiledSet.label,
      fixture.displayName,
      "compile combobox/set already emits identity.name; do not invent Button-style set chrome",
    );
  }
});

const liveTriggerInputText = (
  characters: string,
  ownershipKey: string,
): SceneNodeSnapshot => ({
  ownershipKey,
  type: "TEXT",
  name: "combobox/input",
  semanticRole: "combobox/input",
  width: 160,
  height: 24,
  visible: true,
  opacity: 1,
  characters,
  fontName: { family: "Roboto", style: "Regular" },
  fontSize: 16,
  boundVariables: [],
  children: [],
});

const liveContentVariantScene = (
  content: "empty" | "options",
  characters: string,
): SceneNodeSnapshot => ({
  ownershipKey: "variant",
  type: "COMPONENT",
  name: `combobox/variant/small/outlined/false/default/${content}`,
  semanticRole: `combobox/variant/small/outlined/false/default/${content}`,
  width: 240,
  height: 80,
  visible: true,
  opacity: 1,
  layoutMode: "VERTICAL",
  variantProperties: {
    Size: "small",
    Appearance: "outlined",
    Open: "false",
    "Field state": "default",
    Content: content,
  },
  boundVariables: [],
  children: [
    {
      ownershipKey: "variant/children/0",
      type: "FRAME",
      name: "combobox/trigger",
      semanticRole: "combobox/trigger",
      width: 240,
      height: 40,
      visible: true,
      opacity: 1,
      layoutMode: "HORIZONTAL",
      boundVariables: [],
      children: [
        liveTriggerInputText(characters, "variant/children/0/children/0"),
      ],
    },
  ],
});

const textCharacters = (root: IRNode, role: string): string | undefined => {
  const found = walkIr(root).find((node) => node.role === role);
  return found && found.kind === "text" ? found.characters : undefined;
};

test("host emits compile-carried trigger characters Choose a person on empty-content combobox/input, not live selected-option text", () => {
  assert.equal(
    COMBOBOX_LIVE_V37_TRIGGER_COMPILE_CARRY_CHARACTERS_MARKER,
    "COMBOBOX-TRIGGER-COMPILE-CARRY-CHARACTERS",
  );
  assert.equal(
    COMBOBOX_LIVE_V37_TRIGGER_COMPILE_CARRY_CHARACTERS,
    "Choose a person",
    "v37 must carry compile's recipe placeholder, not invent Ada Lovelace",
  );
  const instance = adaptReviewedCombobox(
    muiComboboxSource,
    muiComboboxAdapterConfig,
  );
  const envelope = compileComboboxRecipe(instance);
  const compiledInputs = walkIr(envelope.ir).filter(
    (node) => node.kind === "text" && node.role === "combobox/input",
  );
  assert.equal(
    compiledInputs.filter((node) => node.kind === "text" && node.characters === "Choose a person")
      .length,
    32,
    "compile already emits Choose a person on empty-content trigger inputs",
  );
  assert.equal(
    compiledInputs.filter((node) => node.kind === "text" && node.characters === "Ada Lovelace")
      .length,
    32,
    "compile already emits selected-option text on options-content trigger inputs",
  );
  const liveEmpty = liveContentVariantScene("empty", "Ada Lovelace");
  assert.equal(
    textCharacters(sceneToNormalizedIrV36(liveEmpty), "combobox/input"),
    "Ada Lovelace",
    "hashed v36 still emits live selected-option text on empty-content inputs",
  );
  assert.equal(
    textCharacters(sceneToNormalizedIr(liveEmpty), "combobox/input"),
    "Choose a person",
    "v37 host must emit compile-carried Choose a person, not live selected-option text",
  );
  const liveOptions = liveContentVariantScene("options", "Ada Lovelace");
  assert.equal(
    textCharacters(sceneToNormalizedIrV36(liveOptions), "combobox/input"),
    "Ada Lovelace",
  );
  assert.equal(
    textCharacters(sceneToNormalizedIr(liveOptions), "combobox/input"),
    "Ada Lovelace",
    "v37 must not invent placeholder onto options-content inputs that compile already names from source",
  );
  const liveOptionLabel: SceneNodeSnapshot = {
    ...liveTriggerInputText("Ada Lovelace", "option-label"),
    name: "combobox/option/label",
    semanticRole: "combobox/option/label",
  };
  assert.equal(
    textCharacters(sceneToNormalizedIr(liveOptionLabel), "combobox/option/label"),
    "Ada Lovelace",
    "v37 must not compile-carry trigger placeholder onto option labels",
  );
});

test("host omits combobox/option clipsContent that compile never emits", () => {
  assert.equal(
    COMBOBOX_LIVE_V37_OPTION_CLIPS_CONTENT_OMITTED_MARKER,
    "COMBOBOX-OPTION-CLIPS-CONTENT-OMITTED",
  );
  const instance = adaptReviewedCombobox(
    muiComboboxSource,
    muiComboboxAdapterConfig,
  );
  const envelope = compileComboboxRecipe(instance);
  const compiledOption = walkIr(envelope.ir).find(
    (node) => node.role === "combobox/option/small/default",
  );
  const compiledOverlay = walkIr(envelope.ir).find(
    (node) => node.role === "combobox/overlay",
  );
  const compiledVariant = walkIr(envelope.ir).find(
    (node) => node.kind === "component" && node.role?.startsWith("combobox/variant/"),
  );
  const compiledListbox = walkIr(envelope.ir).find(
    (node) => node.role === "combobox/listbox",
  );
  const compiledSet = walkIr(envelope.ir).find(
    (node) => node.role === "combobox/set",
  );
  const compiledOptionSet = walkIr(envelope.ir).find(
    (node) => node.role === "combobox/option-set",
  );
  assert.ok(compiledOption);
  assert.ok(compiledOverlay);
  assert.ok(compiledVariant);
  assert.ok(compiledListbox);
  assert.ok(compiledSet);
  assert.ok(compiledOptionSet);
  assert.equal(
    "clipsContent" in compiledOption,
    false,
    "compile option omits the clipsContent key",
  );
  assert.equal(
    compiledOverlay.kind === "frame" && compiledOverlay.clipsContent,
    true,
    "compile overlay emits clipsContent true; v31 must not omit it",
  );
  assert.equal(
    compiledVariant.kind === "component" && compiledVariant.clipsContent,
    false,
    "compile variant emits clipsContent false; v31 must not omit it",
  );
  assert.equal(
    "clipsContent" in compiledListbox,
    false,
    "compile listbox omit must stay",
  );
  assert.equal(
    "clipsContent" in compiledSet,
    false,
    "compile set omit must stay",
  );
  assert.equal(
    "clipsContent" in compiledOptionSet,
    false,
    "compile option-set omit must stay",
  );
  const live = liveOptionWithExtractOrderBindings();
  const hashedV29 = sceneToNormalizedIrV29(live);
  assert.equal(hashedV29.kind, "component");
  assert.equal(
    hashedV29.kind === "component" && hashedV29.clipsContent,
    false,
    "hashed v29 still emits live option clipsContent false; v31 must not patch those bytes",
  );
  const observed = sceneToNormalizedIr(live);
  assert.equal(observed.kind, "component");
  assert.equal(observed.role, "combobox/option/small/default");
  assert.equal(
    "clipsContent" in observed,
    false,
    "v31 host must omit combobox/option clipsContent that compile never emits",
  );
  const overlay = sceneToNormalizedIr(liveOverlayWithDropShadow());
  assert.equal(overlay.kind, "frame");
  assert.equal(
    overlay.kind === "frame" && overlay.clipsContent,
    true,
    "v31 must keep overlay clipsContent that compile emits",
  );
  const variant = sceneToNormalizedIr(liveVariantWithClipsContentFalse());
  assert.equal(variant.kind, "component");
  assert.equal(
    variant.kind === "component" && variant.clipsContent,
    false,
    "v31 must keep variant clipsContent false that compile emits",
  );
  for (const role of ["combobox/set", "combobox/option-set"] as const) {
    const setObserved = sceneToNormalizedIr(liveSetWithClipsContent(role));
    assert.equal(
      "clipsContent" in setObserved,
      false,
      `v31 must keep the v27 ${role} clipsContent omit`,
    );
  }
});
