import assert from "node:assert/strict";
import test from "node:test";

import { canonicalTooltipRecipeInstance } from "../fixtures/tooltip.js";
import {
  TOOLTIP_RECIPE_REF,
  compileTooltipRecipe,
  normalizeTooltipRecipeInstance,
  validateTooltipStructure,
} from "./tooltip.js";

test("tooltip@1 canonical skeleton compiles", () => {
  const envelope = compileTooltipRecipe(canonicalTooltipRecipeInstance);
  assert.equal(envelope.recipe.id, TOOLTIP_RECIPE_REF.id);
  assert.equal(envelope.archetype, "tooltip / popover");
  validateTooltipStructure(envelope.ir);
  const again = normalizeTooltipRecipeInstance(canonicalTooltipRecipeInstance);
  assert.equal(again.identity.id, "ds.tooltip");
  assert.equal(again.tokens.decoration, "none");
});
