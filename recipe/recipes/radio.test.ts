import assert from "node:assert/strict";
import test from "node:test";

import { canonicalRadioRecipeInstance } from "../fixtures/radio.js";
import {
  RADIO_RECIPE_REF,
  compileRadioRecipe,
  normalizeRadioRecipeInstance,
  validateRadioStructure,
} from "./radio.js";

test("radio@1 canonical skeleton compiles as a list-shaped set", () => {
  const envelope = compileRadioRecipe(canonicalRadioRecipeInstance);
  assert.equal(envelope.recipe.id, RADIO_RECIPE_REF.id);
  validateRadioStructure(envelope.ir);
  const again = normalizeRadioRecipeInstance(canonicalRadioRecipeInstance);
  assert.equal(again.identity.id, "ds.radio");
  assert.equal(again.content.items.length, 2);
});
