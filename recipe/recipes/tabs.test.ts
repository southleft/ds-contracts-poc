import assert from "node:assert/strict";
import test from "node:test";

import { canonicalTabsRecipeInstance } from "../fixtures/tabs.js";
import {
  TABS_RECIPE_REF,
  compileTabsRecipe,
  normalizeTabsRecipeInstance,
  validateTabsStructure,
} from "./tabs.js";

test("tabs@1 canonical skeleton compiles", () => {
  const envelope = compileTabsRecipe(canonicalTabsRecipeInstance);
  assert.equal(envelope.recipe.id, TABS_RECIPE_REF.id);
  assert.equal(envelope.archetype, "tabs");
  validateTabsStructure(envelope.ir);
  const again = normalizeTabsRecipeInstance(canonicalTabsRecipeInstance);
  assert.equal(again.identity.id, "ds.tabs");
  assert.equal(again.content.selected, "Item One");
  assert.equal(again.tokens.indicator.height.fallback, 2);
});
