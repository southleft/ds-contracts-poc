import assert from "node:assert/strict";
import test from "node:test";

import { PNG } from "pngjs";

import {
  RECIPE_RASTER_CALIBRATION_CORPUS,
  RECIPE_RASTER_CALIBRATION_CORPUS_HASH,
  RECIPE_RASTER_CALIBRATION_VERSION,
  RECIPE_RASTER_METRIC_HASH,
  assertCalibrationFontsAvailable,
  assertRasterCalibration,
  deriveRasterCalibration,
  evaluateHeldOutCalibration,
  type CalibrationRender,
  type RecipeRasterCalibration,
} from "./raster-calibration.js";
import { emitCalibrationFigmaWriter } from "./raster-calibration-figma-writer.js";

const png = (inkWidth: number): Buffer => {
  const image = new PNG({ width: 24, height: 16 });
  image.data.fill(255);
  for (let y = 4; y < 12; y += 1) {
    for (let x = 3; x < 3 + inkWidth; x += 1) {
      const offset = (y * image.width + x) * 4;
      image.data[offset] = 32;
      image.data[offset + 1] = 48;
      image.data[offset + 2] = 56;
      image.data[offset + 3] = 255;
    }
  }
  return PNG.sync.write(image);
};

const render = (
  specimenId: string,
  split: "training" | "validation",
  width: number,
  inkWidth = 8,
): CalibrationRender => ({
  specimenId,
  split,
  png: png(inkWidth),
  root: { x: 0, y: 0, width, height: 16 },
  roles: { root: { x: 0, y: 0, width, height: 16 } },
  text: [
    {
      id: "copy",
      characters: "Measured string",
      geometry: { x: 0, y: 0, width, height: 16 },
      resolvedFamily: "Inter",
      resolvedStyle: "Regular",
    },
  ],
  structureHash: "structural-fixed-point",
});

const validCalibration = (): RecipeRasterCalibration => ({
  version: RECIPE_RASTER_CALIBRATION_VERSION,
  corpusHash: RECIPE_RASTER_CALIBRATION_CORPUS_HASH,
  metricHash: RECIPE_RASTER_METRIC_HASH,
  writer: {
    fontSizeScale: 1,
    lineHeightScale: 1,
    letterSpacingPx: 0,
  },
  capture: { rgbLevels: 256 },
  bounds: {
    fontSizeScale: { minimum: 0.98, maximum: 1.02 },
    lineHeightScale: { minimum: 0.97, maximum: 1.03 },
    letterSpacingPx: { minimum: -0.35, maximum: 0.35 },
    rgbLevels: { minimum: 64, maximum: 256 },
  },
  provenance: {
    derivedFrom: "training-only",
    trainingIds: ["train-a"],
    validationIdsLockedBeforeMeasurement: ["held-a"],
  },
});

test("calibration corpus is split before measurement and covers generic families", () => {
  assert.equal(RECIPE_RASTER_CALIBRATION_CORPUS.length, 24);
  assert.equal(
    RECIPE_RASTER_CALIBRATION_CORPUS.filter(
      (entry) => entry.split === "training",
    ).length,
    16,
  );
  assert.equal(
    RECIPE_RASTER_CALIBRATION_CORPUS.filter(
      (entry) => entry.split === "validation",
    ).length,
    8,
  );
  assert.deepEqual(
    new Set(RECIPE_RASTER_CALIBRATION_CORPUS.map((entry) => entry.family)),
    new Set([
      "text",
      "auto-layout",
      "adornment",
      "surface",
      "overlay",
      "state-ring",
      "dimension",
    ]),
  );
  assert.equal(
    /\b(?:mui|polaris|material|shopify)\b/i.test(
      JSON.stringify(RECIPE_RASTER_CALIBRATION_CORPUS),
    ),
    false,
  );
});

test("training derivation rejects zero counts and validation leakage", () => {
  assert.throws(() => deriveRasterCalibration([], []), /ZERO-COUNT-TRAINING/);
  assert.throws(
    () =>
      deriveRasterCalibration(
        [render("held-a", "validation", 100)],
        [render("held-a", "validation", 99)],
      ),
    /TRAIN-VALIDATION-LEAKAGE/,
  );
});

test("calibration requires every declared font without fallback substitution", () => {
  assert.throws(
    () =>
      assertCalibrationFontsAvailable([
        { family: "Inter", style: "Regular" },
        { family: "Inter", style: "Medium" },
        { family: "Roboto", style: "Regular" },
      ]),
    /MISSING-CALIBRATION-FONT:Roboto\/Medium/,
  );
});

test("extreme coefficients, target branches, and metric manipulation fail closed", () => {
  const extreme = validCalibration();
  extreme.writer.fontSizeScale = 4;
  assert.throws(
    () => assertRasterCalibration(extreme),
    /EXTREME-CALIBRATION-COEFFICIENT/,
  );

  const targeted = {
    ...validCalibration(),
    sourceIdentityBranch: "special-case",
  } as RecipeRasterCalibration;
  assert.throws(
    () => assertRasterCalibration(targeted),
    /TARGET-IDENTITY-BRANCH/,
  );

  const reweighted = validCalibration();
  reweighted.metricHash = "0".repeat(64) as typeof RECIPE_RASTER_METRIC_HASH;
  assert.throws(() => assertRasterCalibration(reweighted));
});

test("planted training-shaped overfit without held-out gains is rejected", () => {
  const calibration = validCalibration();
  const browser = [render("held-a", "validation", 100, 8)];
  const baseline = [render("held-a", "validation", 100, 8)];
  const calibrated = [render("held-a", "validation", 90, 5)];
  const result = evaluateHeldOutCalibration(
    browser,
    baseline,
    calibrated,
    calibration,
  );
  assert.equal(result.accepted, false);
  assert.deepEqual(result.catastrophicRegressions, ["held-a"]);
});

test("writer calibration is explicit and never enabled by default", () => {
  const baseline = emitCalibrationFigmaWriter("baseline");
  assert.equal(baseline.phase, "baseline");
  assert.throws(
    () => emitCalibrationFigmaWriter("calibrated"),
    /requires explicit calibration/,
  );
  const calibrated = emitCalibrationFigmaWriter(
    "calibrated",
    validCalibration(),
  );
  assert.equal(calibrated.phase, "calibrated");
  assert.ok(calibrated.code.includes('"derivedFrom":"training-only"'));
});
