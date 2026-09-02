import assert from "node:assert/strict";
import test from "node:test";

import { canonicalCheckboxRecipeInstance } from "../fixtures/checkbox.js";
import {
  CHECKBOX_RECIPE_REF,
  compileCheckboxRecipe,
  normalizeCheckboxRecipeInstance,
  validateCheckboxStructure,
} from "./checkbox.js";

test("checkbox@1 canonical skeleton compiles", () => {
  const envelope = compileCheckboxRecipe(canonicalCheckboxRecipeInstance);
  assert.equal(envelope.recipe.id, CHECKBOX_RECIPE_REF.id);
  validateCheckboxStructure(envelope.ir);
  const again = normalizeCheckboxRecipeInstance(canonicalCheckboxRecipeInstance);
  assert.equal(again.identity.id, "ds.checkbox");
});

import {
  collapseCheckboxRecipe as collapseBare,
  compileCheckboxRecipe as compileBare,
  BARE_LABEL_COLOR,
  BARE_LABEL_FONT_SIZE,
} from "./checkbox.js";

test("checkbox@1 bare cell: a null label compiles no label node and round-trips as a fixed point", () => {
  const bare = { ...structuredClone(canonicalCheckboxRecipeInstance), content: { label: null } };
  const envelope = compileBare(bare);
  const variants = (envelope.ir as { children: Array<{ children: unknown[] }> }).children;
  assert.ok(variants.length > 0);
  for (const v of variants) assert.equal(v.children.length, 1, "the bare cell has the hit area only");
  const back = collapseBare(envelope, bare.provenance.selection);
  assert.equal(back.content.label, null);
  assert.equal(back.tokens.labelFontSize.fallback, BARE_LABEL_FONT_SIZE);
  assert.equal(back.tokens.typography.label.requestSource.startsWith("bare cell"), true);
  for (const state of Object.values(back.tokens.states)) for (const cell of Object.values(state)) assert.equal(cell.label.fallback, BARE_LABEL_COLOR);
  assert.equal(compileBare(back).integrity.canonicalHash, envelope.integrity.canonicalHash);
});
