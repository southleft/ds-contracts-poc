import assert from "node:assert/strict";
import test from "node:test";

import { canonicalAvatarRecipeInstance } from "../fixtures/avatar.js";
import {
  AVATAR_RECIPE_REF,
  compileAvatarRecipe,
  normalizeAvatarRecipeInstance,
  validateAvatarStructure,
} from "./avatar.js";

test("avatar@1 canonical skeleton compiles", () => {
  const envelope = compileAvatarRecipe(canonicalAvatarRecipeInstance);
  assert.equal(envelope.recipe.id, AVATAR_RECIPE_REF.id);
  assert.equal(envelope.archetype, "avatar");
  validateAvatarStructure(envelope.ir);
  const again = normalizeAvatarRecipeInstance(canonicalAvatarRecipeInstance);
  assert.equal(again.identity.id, "ds.avatar");
});
