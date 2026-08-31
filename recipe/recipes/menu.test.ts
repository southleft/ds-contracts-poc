import assert from "node:assert/strict";
import test from "node:test";

import { canonicalMenuRecipeInstance } from "../fixtures/menu.js";
import {
  MENU_RECIPE_REF,
  compileMenuRecipe,
  normalizeMenuRecipeInstance,
  validateMenuStructure,
} from "./menu.js";

test("menu@1 canonical skeleton compiles", () => {
  const envelope = compileMenuRecipe(canonicalMenuRecipeInstance);
  assert.equal(envelope.recipe.id, MENU_RECIPE_REF.id);
  assert.equal(envelope.archetype, "menu / dropdown");
  validateMenuStructure(envelope.ir);
  const again = normalizeMenuRecipeInstance(canonicalMenuRecipeInstance);
  assert.equal(again.identity.id, "ds.menu");
  assert.equal(again.content.first, "Item One");
  assert.equal(again.tokens.panel.radius.fallback, 4);
});
