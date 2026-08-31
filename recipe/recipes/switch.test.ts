import assert from "node:assert/strict";
import test from "node:test";

import { canonicalSwitchRecipeInstance } from "../fixtures/switch.js";
import {
  SWITCH_RECIPE_REF,
  compileSwitchRecipe,
  normalizeSwitchRecipeInstance,
  validateSwitchStructure,
} from "./switch.js";

test("switch@1 canonical skeleton compiles", () => {
  const envelope = compileSwitchRecipe(canonicalSwitchRecipeInstance);
  assert.equal(envelope.recipe.id, SWITCH_RECIPE_REF.id);
  assert.equal(envelope.archetype, "toggle / switch");
  validateSwitchStructure(envelope.ir);
  const again = normalizeSwitchRecipeInstance(canonicalSwitchRecipeInstance);
  assert.equal(again.identity.id, "ds.switch");
});
