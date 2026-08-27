import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { adaptReviewedButton } from "./adapters/button.js";
import {
  altitudeButtonAdapterConfig,
  fluentButtonAdapterConfig,
} from "./fixtures/library-buttons.js";
import { IR_DRAWABLE_FIELDS } from "./figma-ir.js";
import {
  RECIPE_FIGMA_ASSIGNMENTS,
  RECIPE_FIGMA_NAMESPACE,
  RECIPE_FIGMA_WRITER_VERSION,
  emitButtonFigmaWriter,
  validateButtonFigmaSourcePlans,
} from "./interpret.js";
import { hashRecipeInstance } from "./recipe.js";
import { buttonRecipe, compileButtonRecipe } from "./recipes/button.js";

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, "utf8"));

const build = () => {
  const sources = [
    {
      adapterIdentity: "altitude-button-reviewed-v2",
      displayName: "Altitude",
      contract: "examples/altitude/contracts/button.contract.json",
      config: altitudeButtonAdapterConfig,
    },
    {
      adapterIdentity: "fluent-button-reviewed-v2",
      displayName: "Fluent",
      contract: "examples/fluent/contracts/button.contract.json",
      config: fluentButtonAdapterConfig,
    },
  ].map((source) => {
    const instance = adaptReviewedButton(
      readJson(source.contract),
      source.config,
    );
    return {
      adapterIdentity: source.adapterIdentity,
      displayName: source.displayName,
      recipeHash: hashRecipeInstance(buttonRecipe, instance),
      envelope: compileButtonRecipe(instance),
    };
  });
  return emitButtonFigmaWriter(sources);
};

test("primitive-IR writer has a named Figma assignment for every closed field", () => {
  assert.deepEqual(
    Object.keys(RECIPE_FIGMA_ASSIGNMENTS).sort(),
    [...IR_DRAWABLE_FIELDS].sort(),
  );
  assert.equal(
    Object.values(RECIPE_FIGMA_ASSIGNMENTS).every((assignment) =>
      /[A-Za-z]+(?:Node|Mixin|API|PluginData|combineAsVariants)/.test(
        assignment,
      ),
    ),
    true,
  );
});

test("Button writer is page-scoped, source-parameterized, and full-matrix", () => {
  const writer = build();
  assert.equal(writer.pageName.startsWith("Recipe Pivot / Button / "), true);
  assert.match(writer.pageName, /-v4$/);
  assert.deepEqual(
    writer.sourcePlans.map((source) => [
      source.adapterIdentity,
      source.cells.length,
      source.comparedIrFacts > 0,
    ]),
    [
      ["altitude-button-reviewed-v2", 144, true],
      ["fluent-button-reviewed-v2", 144, true],
    ],
  );
  assert.match(writer.code, /figma\.fileKey !== EXPECTED_FILE_KEY/);
  assert.match(writer.code, /figma\.root\.name !== EXPECTED_FILE_NAME/);
  assert.match(writer.code, /figma\.combineAsVariants/);
  assert.match(writer.code, /layoutMode = "HORIZONTAL"/);
  assert.match(writer.code, /layoutWrap = "WRAP"/);
  assert.match(writer.code, /setBoundVariableForPaint/);
  assert.match(writer.code, /setSharedData\(node, "ownershipKey"/);
  assert.doesNotMatch(writer.code, /setSharedData\(variable, "irVariable"/);
  assert.match(writer.code, /FIGMA-VARIABLE-NAME-COLLISION/);
  assert.equal(RECIPE_FIGMA_NAMESPACE, "ds.contracts.recipe.v4");
  assert.equal(RECIPE_FIGMA_WRITER_VERSION, 4);
  assert.match(writer.code, /component\.layoutSizingHorizontal = "HUG"/);
  assert.match(writer.code, /BUTTON-LABEL-GEOMETRY/);
  assert.doesNotMatch(writer.code, /schema-v19|emit-figma-script/);
});

test("writer source preflight rejects empty, invalid, and invisible labels", () => {
  const source = structuredClone(build().sourcePlans[0]!);
  source.label = "";
  assert.match(
    validateButtonFigmaSourcePlans([source]).join("\n"),
    /label text is empty/,
  );
  source.label = "Button";
  source.sizes.medium!.fontSize.value = 0;
  assert.match(
    validateButtonFigmaSourcePlans([source]).join("\n"),
    /font geometry is invalid/,
  );
  source.sizes.medium!.fontSize.value = 16;
  source.appearance["primary/default"]!.foreground.value = "#00000000";
  assert.match(
    validateButtonFigmaSourcePlans([source]).join("\n"),
    /label fill is invisible/,
  );
});

test("generic writer runtime contains no source identity branches", () => {
  const writer = build();
  const runtime = writer.code
    .slice(writer.code.indexOf("\n") + 1)
    .toLowerCase();
  for (const identity of ["altitude", "fluent", "al-button"]) {
    assert.equal(
      runtime.includes(identity),
      false,
      `${identity} must remain data, not writer control flow`,
    );
  }
});

test("historical v4 writer is preserved and is not re-certified by the corrected writer", () => {
  const historical = readFileSync(
    "recipe/evidence/button-live-pivot-v4/writer.js",
    "utf8",
  );
  assert.notEqual(`${build().code}\n`, historical);
  assert.match(historical, /setSharedData\(variable, "irVariable"/);
  assert.doesNotMatch(build().code, /setSharedData\(variable, "irVariable"/);
});
