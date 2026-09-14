/** Re-emit the held-out checkbox without re-authoring any reviewed leaf. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { adaptReviewedCheckbox } from "./adapters/checkbox.js";
import { emitCheckboxFigmaWriter } from "./checkbox-figma-writer.js";
import { radixThemesCheckboxAdapterConfig, radixThemesCheckboxSource } from "./fixtures/generated/checkbox.radix-themes.js";
import { hashRecipeInstance } from "./recipe.js";
import { checkboxRecipe, collapseCheckboxRecipe, compileCheckboxRecipe } from "./recipes/checkbox.js";

const out = "recipe/evidence/pointed/checkbox-radix-themes";
const instance = adaptReviewedCheckbox(radixThemesCheckboxSource, radixThemesCheckboxAdapterConfig);
const envelope = compileCheckboxRecipe(instance);
assert.equal(compileCheckboxRecipe(collapseCheckboxRecipe(envelope, instance.provenance.selection)).integrity.canonicalHash, envelope.integrity.canonicalHash);
const recipeHash = hashRecipeInstance(checkboxRecipe, instance);
const source = { adapterIdentity: "radix-themes-checkbox-proposed-v1", displayName: "Radix Themes", recipeHash, envelope };
const runIdentity = `${recipeHash.slice(0, 8)}-checkbox-v12-glyph-host`;
for (const target of ["plugin", "scratch"] as const) {
  const writer = emitCheckboxFigmaWriter([source], { target, runIdentity });
  const file = `${out}/writer.${target}.js`;
  if (process.argv.includes("--check")) {
    assert.equal(readFileSync(file, "utf8"), writer.code, `${file} is stale`);
    const mint = JSON.parse(readFileSync(`${out}/mint.json`, "utf8"));
    assert.equal(mint.success, true, "mint must have succeeded");
    assert.equal(mint.result.fileKey, "byMp6lt0Ij9b2QbkDGFwBh");
    assert.equal(mint.result.runIdentity, runIdentity);
    assert.equal(mint.result.sources[0].recipeHash, recipeHash);
    assert.equal(mint.result.sources[0].envelopeHash, envelope.integrity.canonicalHash, "live receipt is not this compiled envelope");
  } else writeFileSync(file, writer.code);
}
console.log(`F1 checkbox: fixed point and both writers current (${recipeHash.slice(0, 8)})`);
