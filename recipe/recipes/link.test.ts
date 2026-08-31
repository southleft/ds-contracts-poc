import assert from "node:assert/strict";
import test from "node:test";

import { canonicalLinkRecipeInstance } from "../fixtures/link.js";
import {
  LINK_RECIPE_REF,
  compileLinkRecipe,
  normalizeLinkRecipeInstance,
  validateLinkStructure,
} from "./link.js";

test("link@1 canonical skeleton compiles", () => {
  const envelope = compileLinkRecipe(canonicalLinkRecipeInstance);
  assert.equal(envelope.recipe.id, LINK_RECIPE_REF.id);
  assert.equal(envelope.archetype, "none");
  validateLinkStructure(envelope.ir);
  const again = normalizeLinkRecipeInstance(canonicalLinkRecipeInstance);
  assert.equal(again.identity.id, "ds.link");
  assert.equal(again.tokens.decoration, "none");
});
