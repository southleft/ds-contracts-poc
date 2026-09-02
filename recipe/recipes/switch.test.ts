import assert from "node:assert/strict";
import test from "node:test";

import { canonicalSwitchRecipeInstance } from "../fixtures/switch.js";
import {
  SWITCH_RECIPE_REF,
  compileSwitchRecipe,
  normalizeSwitchRecipeInstance,
  validateSwitchStructure,
} from "./switch.js";

test("switch@1 canonical skeleton compiles", () => {
  const envelope = compileSwitchRecipe(canonicalSwitchRecipeInstance);
  assert.equal(envelope.recipe.id, SWITCH_RECIPE_REF.id);
  assert.equal(envelope.archetype, "toggle / switch");
  validateSwitchStructure(envelope.ir);
  const again = normalizeSwitchRecipeInstance(canonicalSwitchRecipeInstance);
  assert.equal(again.identity.id, "ds.switch");
});

import {
  collapseSwitchRecipe as collapseBare,
  compileSwitchRecipe as compileBare,
  BARE_LABEL_COLOR,
  BARE_LABEL_FONT_SIZE,
} from "./switch.js";

test("switch@1 bare cell: a null label compiles no label node and round-trips as a fixed point", () => {
  const bare = { ...structuredClone(canonicalSwitchRecipeInstance), content: { label: null } };
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
