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
import {
  COMBOBOX_LIVE_V6_OMIT_EMPTY_INSTANCE_PAYLOAD_MARKER,
  COMBOBOX_LIVE_V6_PROJECT_LIVE_ROOT_OWNERSHIP_KEY_MARKER,
  compareSceneToExpectedPlan,
  compileExpectedScenePlan,
  contentTextOwnershipKeysWithoutCompileOpacity,
  sceneToNormalizedIr,
  type SceneNodeSnapshot,
} from "./scene-readback-combobox-v6.js";

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
    COMBOBOX_LIVE_V6_OMIT_EMPTY_INSTANCE_PAYLOAD_MARKER,
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
    COMBOBOX_LIVE_V6_PROJECT_LIVE_ROOT_OWNERSHIP_KEY_MARKER,
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
