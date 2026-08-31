import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { adaptReviewedInputField } from "./adapters/input-field.js";
import {
  emitInputFieldFigmaWriter,
  validateInputFieldFigmaSourcePlans,
  type InputFieldFigmaWriterInput,
} from "./input-field-figma-writer.js";
import { validateFigmaWriterConformance } from "./figma-writer-conformance.js";
import {
  muiInputFieldAdapterConfig,
  polarisInputFieldAdapterConfig,
} from "./fixtures/library-input-fields.js";
import { hashRecipeInstance } from "./recipe.js";
import {
  compileInputFieldRecipe,
  inputFieldRecipe,
} from "./recipes/input-field.js";

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, "utf8"));

const inputs = (): InputFieldFigmaWriterInput[] =>
  [
    {
      adapterIdentity: "material-text-field-reviewed-v1",
      displayName: "Material source",
      path: "examples/mui/contracts/text-field.contract.json",
      config: muiInputFieldAdapterConfig,
      slotCharacters: { leading: "$", trailing: "USD" },
    },
    {
      adapterIdentity: "commerce-text-field-reviewed-v1",
      displayName: "Commerce source",
      path: "examples/polaris/contracts/text-field.contract.json",
      config: polarisInputFieldAdapterConfig,
      slotCharacters: { leading: "$", trailing: "USD" },
    },
  ].map(({ path, config, ...source }) => {
    const instance = adaptReviewedInputField(readJson(path), config);
    return {
      ...source,
      recipeHash: hashRecipeInstance(inputFieldRecipe, instance),
      envelope: compileInputFieldRecipe(instance),
    };
  });

test("Input writer plans two complete primitive-IR sets without source branches", () => {
  const writer = emitInputFieldFigmaWriter(inputs());
  assert.equal(writer.sourcePlans.length, 2);
  assert.equal(
    writer.sourcePlans.reduce((sum, source) => sum + source.cells.length, 0),
    256,
  );
  assert.equal(
    writer.sourcePlans.every(
      (source) =>
        source.variables.length > 0 &&
        source.comparedIrFacts > 0 &&
        source.ir.kind === "component-set",
    ),
    true,
  );
  const generic = readFileSync(
    "recipe/input-field-figma-writer.ts",
    "utf8",
  ).toLowerCase();
  for (const identity of [
    "mui",
    "polaris",
    "@mui/material",
    "@shopify/polaris",
    "mui.text-field",
    "polaris.text-field",
  ]) {
    assert.equal(generic.includes(identity), false, identity);
  }
});

test("Input writer planted structure and API plans fail closed", async () => {
  const writer = emitInputFieldFigmaWriter(inputs());
  const omitted = structuredClone(writer.sourcePlans);
  assert.equal(omitted[0]!.ir.kind, "component-set");
  if (omitted[0]!.ir.kind !== "component-set") throw new Error("set absent");
  omitted[0]!.ir.children[0]!.children = [];
  assert.match(
    validateInputFieldFigmaSourcePlans(omitted).join("\n"),
    /missing input-field\/label/,
  );

  const zeroVariables = structuredClone(writer.sourcePlans);
  zeroVariables[0]!.variables = [];
  assert.match(
    validateInputFieldFigmaSourcePlans(zeroVariables).join("\n"),
    /variables denominator is zero/,
  );

  const plantedApi = writer.code.replace(
    "figma.createText()",
    "figma.createImaginaryText()",
  );
  assert.notEqual(plantedApi, writer.code);
  const conformance = await validateFigmaWriterConformance(plantedApi, {
    variants: 256,
    writerVersion: 1,
    requiredMarkers: ["INPUT-TEXT-GEOMETRY", "INPUT-FAKE-LAYOUT"],
  });
  assert.equal(conformance.ok, false);
  assert.match(conformance.failures.join("\n"), /createImaginaryText/);
});
