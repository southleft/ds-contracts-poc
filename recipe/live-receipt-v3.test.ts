import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  selfTestLiveButtonReceiptV3,
  validateLiveButtonReceiptV3,
} from "./live-receipt-v3.js";

const receipt = (): Record<string, any> =>
  JSON.parse(
    readFileSync(
      "recipe/evidence/button-live-pivot-v3/receipt.json",
      "utf8",
    ),
  ) as Record<string, any>;

test("v3 receipt preserves v1/v2 and records failed live proof", () => {
  assert.deepEqual(validateLiveButtonReceiptV3(receipt()), []);
});

test("v3 receipt tamper self-tests all go red", () => {
  assert.deepEqual(selfTestLiveButtonReceiptV3(receipt()), []);
});
