import assert from "node:assert/strict";
import test from "node:test";

import { canonicalChipRecipeInstance } from "../fixtures/chip.js";
import {
  CHIP_RECIPE_REF,
  compileChipRecipe,
  normalizeChipRecipeInstance,
  validateChipStructure,
} from "./chip.js";

test("chip@1 canonical skeleton compiles", () => {
  const envelope = compileChipRecipe(canonicalChipRecipeInstance);
  assert.equal(envelope.recipe.id, CHIP_RECIPE_REF.id);
  assert.equal(envelope.archetype, "badge / tag / chip");
  validateChipStructure(envelope.ir);
  const again = normalizeChipRecipeInstance(canonicalChipRecipeInstance);
  assert.equal(again.identity.id, "ds.chip");
});
