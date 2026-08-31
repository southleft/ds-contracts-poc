/**
 * THE EXPERIMENTAL RECIPE SURFACE — one place, so the boundary is visible.
 *
 * EXPERIMENTAL. Phase 0 of docs/32-recipe-ir-pivot.md. This module is NOT
 * exported from any published package, is not imported by the legacy engine,
 * and changes no shipped behaviour. It exists so that the pivot's Phase 0 can
 * be reviewed on its own, before anything depends on it.
 *
 * Phase 1 adds the versioned recipe registry and the offline button@1
 * compile/collapse fixed point. No interpreter or live Figma mutation is
 * exported here.
 */
import { RecipeRegistry } from "./recipe.js";
import { buttonRecipe } from "./recipes/button.js";
import { comboboxRecipe } from "./recipes/combobox.js";
import { inputFieldRecipe } from "./recipes/input-field.js";

export * from "./accounting.js";
export * from "./adapters/button.js";
export * from "./adapters/combobox.js";
export * from "./adapters/input-field.js";
export * from "./comparison.js";
export * from "./figma-ir.js";
export * from "./envelope.js";
export * from "./normalize.js";
export * from "./hash.js";
export * from "./interpret.js";
export * from "./live-receipt.js";
export * from "./output/button.js";
export * from "./output/combobox.js";
export * from "./output/input-field.js";
export * from "./output-safety.js";
export * from "./recipe.js";
export * from "./required-facts.js";
export * from "./scene-readback.js";
export * from "./recipes/button.js";
export * from "./recipes/combobox.js";
export * from "./recipes/input-field.js";
export * from "./fixtures/button.js";
export * from "./fixtures/combobox.js";
export * from "./fixtures/input-field.js";
export * from "./fixtures/library-buttons.js";
export * from "./fixtures/library-comboboxes.js";
export * from "./fixtures/library-input-fields.js";

/** Exact id/version selection only; recipe inference is deliberately absent. */
export const recipeRegistry = new RecipeRegistry([
  buttonRecipe,
  comboboxRecipe,
  inputFieldRecipe,
]);
