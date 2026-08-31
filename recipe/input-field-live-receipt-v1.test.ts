import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateInputFieldLiveReceiptV1 } from "./input-field-live-receipt-v1.js";

const receipt = () =>
  JSON.parse(
    readFileSync(
      "recipe/evidence/input-field-live-pivot-v1/receipt.json",
      "utf8",
    ),
  );

test("failed Input live receipt is complete, cleaned, and false", () => {
  assert.deepEqual(validateInputFieldLiveReceiptV1(receipt()), []);
});

test("Input live receipt plants catch success, target, count, and cleanup lies", () => {
  const plants = [
    (value: Record<string, any>) => {
      value.status.overallInputSuccess = true;
    },
    (value: Record<string, any>) => {
      value.target.fileKey = "Y8Jhw6R49wTLuXZ0is2GmV";
    },
    (value: Record<string, any>) => {
      value.finalLiveMeasurements.objective.denominator = 64;
    },
    (value: Record<string, any>) => {
      value.attempts[2].cleanup.complete = false;
    },
  ];
  for (const plant of plants) {
    const value = receipt();
    plant(value);
    assert.ok(validateInputFieldLiveReceiptV1(value).length > 0);
  }
});
