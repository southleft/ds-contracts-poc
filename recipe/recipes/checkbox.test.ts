import assert from "node:assert/strict";
import test from "node:test";

import { canonicalCheckboxRecipeInstance } from "../fixtures/checkbox.js";
import {
  CHECKBOX_RECIPE_REF,
  compileCheckboxRecipe,
  normalizeCheckboxRecipeInstance,
  validateCheckboxStructure,
} from "./checkbox.js";

test("checkbox@1 canonical skeleton compiles", () => {
  const envelope = compileCheckboxRecipe(canonicalCheckboxRecipeInstance);
  assert.equal(envelope.recipe.id, CHECKBOX_RECIPE_REF.id);
  validateCheckboxStructure(envelope.ir);
  const again = normalizeCheckboxRecipeInstance(canonicalCheckboxRecipeInstance);
  assert.equal(again.identity.id, "ds.checkbox");
});
