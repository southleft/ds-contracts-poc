import assert from "node:assert/strict";
import test from "node:test";

import { buttonRecipe } from "./recipes/button.js";
import { inputFieldRecipe } from "./recipes/input-field.js";
import { RecipeRefusal, RecipeRegistry } from "./recipe.js";

test("the registry selects an exact recipe id and version without guessing", () => {
  const registry = new RecipeRegistry([buttonRecipe, inputFieldRecipe]);

  assert.equal(registry.select({ id: "button", version: 1 }), buttonRecipe);
  assert.equal(
    registry.select({ id: "input-field", version: 1 }),
    inputFieldRecipe,
  );
  assert.deepEqual(registry.refs(), [
    { id: "button", version: 1 },
    { id: "input-field", version: 1 },
  ]);
  assert.throws(
    () => registry.select({ id: "Button from Acme", version: 1 }),
    (error: unknown) =>
      error instanceof RecipeRefusal &&
      /selection by component or library name is forbidden/.test(error.message),
  );
  assert.throws(
    () => registry.select({ id: "button", version: 2 }),
    /button@2: recipe is not registered/,
  );
});

test("duplicate recipe registrations refuse by exact key", () => {
  assert.throws(
    () => new RecipeRegistry([buttonRecipe, buttonRecipe]),
    /duplicate recipe registration: button@1/,
  );
});
