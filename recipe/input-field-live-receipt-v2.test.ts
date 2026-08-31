import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateInputFieldLiveReceiptV2 } from "./input-field-live-receipt-v2.js";

const receipt = (): Record<string, any> =>
  JSON.parse(
    readFileSync(
      "recipe/evidence/input-field-live-pivot-v2/receipt.json",
      "utf8",
    ),
  );

test("Input live v2 receipt is complete, cleaned, tamper-evident, and false", () => {
  assert.deepEqual(validateInputFieldLiveReceiptV2(receipt()), []);
});

test("Input live v2 receipt plants catch target, success, count, and cleanup lies", () => {
  const plants = [
    (value: Record<string, any>) => {
      value.target.fileKey = "other";
    },
    (value: Record<string, any>) => {
      value.status.overallInputSuccess = true;
    },
    (value: Record<string, any>) => {
      value.finalLiveMeasurements.zeroSilentAccounting.denominator -= 1;
    },
    (value: Record<string, any>) => {
      value.attempts.history[1].cleanup.complete = false;
    },
    (value: Record<string, any>) => {
      value.finalLiveMeasurements.objective.pixelInk.liveWins = 128;
    },
    (value: Record<string, any>) => {
      value.finalLiveMeasurements.objective.aggregates.meanGeometryError = 999;
    },
    (value: Record<string, any>) => {
      value.finalLiveMeasurements.objective.lockedProgressCriteria.declaredBeforeMeasurement =
        "posthoc";
    },
    (value: Record<string, any>) => {
      value.tamperGates.liveCapturesPresent = false;
    },
  ];
  for (const plant of plants) {
    const value = receipt();
    plant(value);
    assert.ok(validateInputFieldLiveReceiptV2(value).length > 0);
  }
});

test("Input live v2 reader refuses evidence paths outside the repository", () => {
  const value = receipt();
  value.finalLiveMeasurements.objectiveCanvas.path = "../../outside.json";
  assert.throws(
    () => validateInputFieldLiveReceiptV2(value),
    /evidence path escapes repository/,
  );
});
