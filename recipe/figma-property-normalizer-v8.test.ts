import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeFigmaBindings as normalizeV1 } from "./figma-property-normalizer.js";
import {
  FIGMA_PER_SIDE_STROKE_WEIGHT_FIELDS,
  FIGMA_STROKE_WEIGHT_CANONICAL,
  FIGMA_UNIFORM_STROKE_WEIGHT_FIELD,
  normalizeFigmaBindings,
  type LocalVariableRecord,
} from "./figma-property-normalizer-v8.js";

const alias = (id: string) => ({ type: "VARIABLE_ALIAS" as const, id });
const variables: LocalVariableRecord[] = [
  {
    id: "float",
    name: "token/float/id-7374726f6b65",
    resolvedType: "FLOAT",
    collectionId: "collection",
    collectionName: "Input v8",
    remote: false,
  },
  {
    id: "color",
    name: "token/color/id-636f6c6f72",
    resolvedType: "COLOR",
    collectionId: "collection",
    collectionName: "Input v8",
    remote: false,
  },
];

test("v1 still refuses per-side stroke weights so v7 antecedent bytes stay frozen", () => {
  for (const field of FIGMA_PER_SIDE_STROKE_WEIGHT_FIELDS) {
    assert.throws(
      () =>
        normalizeV1({
          nodeBoundVariables: { [field]: alias("float") },
          variableTable: variables,
        }),
      /unsupported field/,
    );
  }
});

test("v8 FLOAT and canonical maps carry per-side stroke weights and the uniform sibling", () => {
  const source = readFileSync("recipe/figma-property-normalizer-v8.ts", "utf8");
  assert.match(source, /strokeWeight/);
  for (const field of [
    FIGMA_UNIFORM_STROKE_WEIGHT_FIELD,
    ...FIGMA_PER_SIDE_STROKE_WEIGHT_FIELDS,
  ]) {
    assert.match(source, new RegExp(field));
    assert.equal(typeof FIGMA_STROKE_WEIGHT_CANONICAL[field], "string");
  }
  assert.equal(FIGMA_STROKE_WEIGHT_CANONICAL.strokeWeight, "strokes.0.weight");
  assert.equal(
    FIGMA_STROKE_WEIGHT_CANONICAL.strokeBottomWeight,
    "strokes.0.weight.bottom",
  );
  assert.ok(
    source.includes("strokes\\.\\d+\\.weight(?:\\.(?:top|right|bottom|left))?"),
  );
});

test("per-side stroke weight bindings canonicalize as FLOAT siblings of strokeWeight", () => {
  const bindings = normalizeFigmaBindings({
    nodeBoundVariables: {
      strokeWeight: alias("float"),
      strokeTopWeight: alias("float"),
      strokeRightWeight: alias("float"),
      strokeBottomWeight: alias("float"),
      strokeLeftWeight: alias("float"),
    },
    variableTable: variables,
  });
  assert.deepEqual(
    bindings.map((binding) => [binding.field, binding.variable.resolvedType]),
    [
      ["strokes.0.weight.bottom", "FLOAT"],
      ["strokes.0.weight.left", "FLOAT"],
      ["strokes.0.weight.right", "FLOAT"],
      ["strokes.0.weight.top", "FLOAT"],
      ["strokes.0.weight", "FLOAT"],
    ],
  );
});

test("per-side stroke weight bindings still require FLOAT", () => {
  assert.throws(
    () =>
      normalizeFigmaBindings({
        nodeBoundVariables: { strokeBottomWeight: alias("color") },
        variableTable: variables,
      }),
    /requires FLOAT, received COLOR/,
  );
});

test("v8 protocol source names the transport facts and per-side stroke maps", () => {
  const source = readFileSync(
    "recipe/build-input-field-live-proof-v8.ts",
    "utf8",
  );
  for (const fact of [
    "oneCallDiskOperatorRequired",
    "honorSignedTimeoutRequired",
    "signedWriterTimeoutMs",
    "fileContextEditorTypeReconstructedFromExactScratchTarget",
    "emptyCodeEnvelopeRefused",
    "cursorReadMustNotIngestSignedWriter",
    "strokeTopWeight",
    "strokeRightWeight",
    "strokeBottomWeight",
    "strokeLeftWeight",
    "strokeWeight",
  ])
    assert.match(source, new RegExp(fact));
});
