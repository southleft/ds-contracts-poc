import assert from "node:assert/strict";
import test from "node:test";

import { canonicalAlertRecipeInstance } from "../fixtures/alert.js";
import {
  ALERT_RECIPE_REF,
  compileAlertRecipe,
  normalizeAlertRecipeInstance,
  validateAlertStructure,
} from "./alert.js";

test("alert@1 canonical skeleton compiles", () => {
  const envelope = compileAlertRecipe(canonicalAlertRecipeInstance);
  assert.equal(envelope.recipe.id, ALERT_RECIPE_REF.id);
  assert.equal(envelope.archetype, "banner / alert / toast");
  validateAlertStructure(envelope.ir);
  const again = normalizeAlertRecipeInstance(canonicalAlertRecipeInstance);
  assert.equal(again.identity.id, "ds.alert");
});
