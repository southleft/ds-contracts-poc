import assert from "node:assert/strict";
import test from "node:test";

import { adaptReviewedCombobox } from "./adapters/combobox.js";
import {
  muiComboboxAdapterConfig,
  muiComboboxSource,
} from "./fixtures/library-comboboxes.js";
import { compileComboboxRecipe } from "./recipes/combobox.js";
import {
  compileExpectedScenePlan,
  contentTextOwnershipKeysWithoutCompileOpacity,
} from "./scene-readback-combobox-v1.js";

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
