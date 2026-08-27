import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  selfTestLiveButtonReceiptV2,
  validateLiveButtonReceiptV2,
} from "./live-receipt-v2.js";

const receipt = (): Record<string, any> =>
  JSON.parse(
    readFileSync(
      "recipe/evidence/button-live-pivot-v2/receipt.json",
      "utf8",
    ),
  ) as Record<string, any>;

test("v2 live receipt preserves v1 and fails closed before execution", () => {
  assert.deepEqual(validateLiveButtonReceiptV2(receipt()), []);
});

test("v2 live receipt tamper self-tests all go red", () => {
  assert.deepEqual(selfTestLiveButtonReceiptV2(receipt()), []);
});
