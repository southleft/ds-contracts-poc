import assert from "node:assert/strict";
import test from "node:test";

import { canonicalTextareaRecipeInstance } from "../fixtures/textarea.js";
import {
  TEXTAREA_RECIPE_REF,
  compileTextareaRecipe,
  normalizeTextareaRecipeInstance,
  validateTextareaStructure,
} from "./textarea.js";

test("textarea@1 canonical skeleton compiles", () => {
  const envelope = compileTextareaRecipe(canonicalTextareaRecipeInstance);
  assert.equal(envelope.recipe.id, TEXTAREA_RECIPE_REF.id);
  assert.equal(envelope.archetype, "input / field");
  validateTextareaStructure(envelope.ir);
  const again = normalizeTextareaRecipeInstance(canonicalTextareaRecipeInstance);
  assert.equal(again.identity.id, "ds.textarea");
});
