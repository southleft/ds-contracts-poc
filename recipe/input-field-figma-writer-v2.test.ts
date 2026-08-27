import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { adaptReviewedInputField } from "./adapters/input-field.js";
import {
  resolveInputFieldFont,
  type InputFieldFigmaWriterInput,
} from "./input-field-figma-writer.js";
import {
  emitInputFieldFigmaWriterV2,
  validateInputFieldLiveMockV2,
  type InputFieldLiveMockV2,
} from "./input-field-figma-writer-v2.js";
import {
  muiInputFieldAdapterConfig,
  polarisInputFieldAdapterConfig,
} from "./fixtures/library-input-fields.js";
import { validateFigmaWriterConformance } from "./figma-writer-conformance.js";
import { hashRecipeInstance } from "./recipe.js";
import {
  compileInputFieldRecipe,
  inputFieldRecipe,
} from "./recipes/input-field.js";
import type { IRNode } from "./figma-ir.js";

const inputs = (): InputFieldFigmaWriterInput[] =>
  [
    {
      adapterIdentity: "material-text-field-reviewed-v1",
      displayName: "Material source",
      path: "examples/mui/contracts/text-field.contract.json",
      config: muiInputFieldAdapterConfig,
    },
    {
      adapterIdentity: "commerce-text-field-reviewed-v1",
      displayName: "Commerce source",
      path: "examples/polaris/contracts/text-field.contract.json",
      config: polarisInputFieldAdapterConfig,
    },
  ].map(({ path, config, ...source }) => {
    const instance = adaptReviewedInputField(
      JSON.parse(readFileSync(path, "utf8")),
      config,
    );
    return {
      ...source,
      recipeHash: hashRecipeInstance(inputFieldRecipe, instance),
      envelope: compileInputFieldRecipe(instance),
      slotCharacters: { leading: "$", trailing: "USD" },
    };
  });

const validMock = (): InputFieldLiveMockV2 => ({
  reflow: {
    beforeRoot: 195,
    afterRoot: 259,
    beforeSurface: 195,
    afterSurface: 259,
    beforeContent: 167,
    afterContent: 231,
  },
  overlay: {
    declared: true,
    absolute: true,
    clipsContent: false,
    offsetMatches: true,
    descendantsInsideOverlay: true,
    notchClearance: 2,
  },
  text: {
    width: 118,
    height: 23,
    expectedFontFamily: "Roboto",
    resolvedFontFamily: "Roboto",
  },
  restoration: { beforeSha256: "same", afterSha256: "same" },
});

test("v2 writer is source-neutral, deterministic, complete, and conformant", async () => {
  const first = emitInputFieldFigmaWriterV2(inputs());
  const second = emitInputFieldFigmaWriterV2(inputs());
  assert.equal(first.code, second.code);
  assert.equal(first.sourcePlans.length, 2);
  assert.equal(
    first.sourcePlans.reduce((sum, source) => sum + source.cells.length, 0),
    256,
  );
  assert.ok(first.sourcePlans.every((source) => source.variables.length > 0));
  const conformance = await validateFigmaWriterConformance(first.code, {
    variants: 256,
    writerVersion: 2,
    requiredMarkers: [
      "INPUT-OVERLAY-DECLARATION-INCOMPLETE",
      "INPUT-TEXT-ZERO-WIDTH-AFTER-PROPERTY",
      "INPUT-FONT-METRICS-DRIFT",
    ],
  });
  assert.deepEqual(conformance.failures, []);
  const generic = readFileSync(
    "recipe/input-field-figma-writer-v2.ts",
    "utf8",
  ).toLowerCase();
  for (const identity of ["mui", "polaris", "@mui", "@shopify"]) {
    assert.equal(generic.includes(identity), false, identity);
  }
  assert.equal(generic.includes("replaceexactlyonce"), false);
  assert.equal(generic.includes(".replaceall(base."), false);
  assert.match(first.code, /INPUT-PAGE-OWNERSHIP-COLLISION/);
  assert.match(first.code, /INPUT-VARIABLE-COLLECTION-COLLISION/);
  assert.match(first.code, /readSceneDerivedTree/);
  assert.doesNotMatch(first.code, /sourceIr|normalizedPrimitiveIr/);
  assert.throws(
    () => emitInputFieldFigmaWriterV2([inputs()[0]!, inputs()[0]!]),
    /adapter identity collision/,
  );
});

test("font resolution is deterministic and fails named provenance defects", () => {
  const exact = muiInputFieldAdapterConfig.parameters.typography.input;
  assert.deepEqual(
    resolveInputFieldFont(exact, [
      { family: "Arial", style: "Regular" },
      { family: "Roboto", style: "Regular" },
    ]),
    { family: "Roboto", style: "Regular", resolution: "requested" },
  );
  assert.throws(
    () => resolveInputFieldFont(exact, [{ family: "Roboto", style: "Bold" }]),
    /INPUT-FONT-UNAVAILABLE/,
  );
  assert.throws(
    () =>
      resolveInputFieldFont(exact, [{ family: "Roboto", style: "Regular" }], 0),
    /INPUT-FONT-ZERO-WIDTH/,
  );
  const fallback = structuredClone(exact);
  fallback.resolvedFamily = "Arial";
  fallback.resolvedStyle = "Regular";
  fallback.resolution = "fallback";
  fallback.degradation = "requested-font-unavailable";
  assert.deepEqual(
    resolveInputFieldFont(fallback, [{ family: "Arial", style: "Regular" }]),
    {
      family: "Arial",
      style: "Regular",
      resolution: "fallback",
      degradation: "requested-font-unavailable",
    },
  );
  const tampered = structuredClone(fallback);
  tampered.resolvedStyle = "Bold";
  assert.throws(
    () =>
      resolveInputFieldFont(tampered, [{ family: "Arial", style: "Regular" }]),
    /INPUT-FONT-PROVENANCE-TAMPER/,
  );
});

test("unavailable glyph/instance asset lowerings refuse before output", () => {
  for (const content of [
    { kind: "glyph", text: "$", assetRef: "currency-glyph" },
    { kind: "instance", componentRef: "currency-component", properties: {} },
  ] as const) {
    const planted = inputs()[0]!;
    const visit = (node: IRNode): boolean => {
      if (node.kind === "instance" && node.payload) {
        node.payload.content = content;
        return true;
      }
      if (
        node.kind === "frame" ||
        node.kind === "component" ||
        node.kind === "component-set"
      ) {
        for (const child of node.children) {
          if (visit(child)) return true;
        }
      }
      return false;
    };
    assert.equal(visit(planted.envelope.ir), true);
    assert.throws(
      () => emitInputFieldFigmaWriterV2([planted, inputs()[1]!]),
      /INPUT-ADORNMENT-(?:GLYPH|INSTANCE)-ASSET-UNAVAILABLE/,
    );
  }
});

test("v2 planted live mocks fail closed by defect", () => {
  const plants: Array<[string, (value: InputFieldLiveMockV2) => void]> = [
    ["content fill", (value) => (value.reflow.afterContent = 167)],
    ["overlay bounds", (value) => (value.overlay.offsetMatches = false)],
    ["notch", (value) => (value.overlay.notchClearance = -1)],
    ["zero live geometry", (value) => (value.text.width = 0)],
    ["font metrics", (value) => (value.text.resolvedFontFamily = "Arial")],
    ["restoration", (value) => (value.restoration.afterSha256 = "different")],
  ];
  assert.deepEqual(validateInputFieldLiveMockV2(validMock()), []);
  for (const [message, plant] of plants) {
    const value = validMock();
    plant(value);
    assert.match(
      validateInputFieldLiveMockV2(value).join("\n"),
      new RegExp(message),
    );
  }
});
