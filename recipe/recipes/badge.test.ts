import assert from "node:assert/strict";
import test from "node:test";

import { canonicalBadgeRecipeInstance } from "../fixtures/badge.js";
import {
  BADGE_RECIPE_REF,
  compileBadgeRecipe,
  normalizeBadgeRecipeInstance,
  validateBadgeStructure,
} from "./badge.js";

test("badge@1 canonical skeleton compiles", () => {
  const envelope = compileBadgeRecipe(canonicalBadgeRecipeInstance);
  assert.equal(envelope.recipe.id, BADGE_RECIPE_REF.id);
  assert.equal(envelope.archetype, "badge / tag / chip");
  validateBadgeStructure(envelope.ir);
  const again = normalizeBadgeRecipeInstance(canonicalBadgeRecipeInstance);
  assert.equal(again.identity.id, "ds.badge");
});
