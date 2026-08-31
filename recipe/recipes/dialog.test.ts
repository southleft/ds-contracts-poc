import assert from "node:assert/strict";
import test from "node:test";

import { canonicalDialogRecipeInstance } from "../fixtures/dialog.js";
import {
  DIALOG_RECIPE_REF,
  compileDialogRecipe,
  normalizeDialogRecipeInstance,
  validateDialogStructure,
} from "./dialog.js";

test("dialog@1 canonical skeleton compiles", () => {
  const envelope = compileDialogRecipe(canonicalDialogRecipeInstance);
  assert.equal(envelope.recipe.id, DIALOG_RECIPE_REF.id);
  assert.equal(envelope.archetype, "modal / dialog");
  validateDialogStructure(envelope.ir);
  const again = normalizeDialogRecipeInstance(canonicalDialogRecipeInstance);
  assert.equal(again.identity.id, "ds.dialog");
  assert.equal(again.content.title, "Dialog title");
  assert.equal(again.tokens.paper.radius.fallback, 4);
});
