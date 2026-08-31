import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateLiveReceiptV4 } from "./live-receipt-v4.js";

const load = (): Record<string, any> =>
  JSON.parse(
    readFileSync("recipe/evidence/button-live-pivot-v4/receipt.json", "utf8"),
  );

test("v4 live receipt validates successful ungraded proof", () => {
  assert.deepEqual(validateLiveReceiptV4(load()), []);
});

test("v4 live receipt planted tampering fails closed", () => {
  const promoted = load();
  promoted.status.buttonSuccess = true;
  assert.match(
    validateLiveReceiptV4(promoted).join("\n"),
    /Button must remain false/,
  );

  const cardinality = load();
  cardinality.writer.counts.variables = 0;
  assert.match(
    validateLiveReceiptV4(cardinality).join("\n"),
    /cardinality is incomplete/,
  );

  const history = load();
  history.immutableHistory.v3Receipt.sha256 = "0".repeat(64);
  assert.match(
    validateLiveReceiptV4(history).join("\n"),
    /immutable history mismatch/,
  );

  const artifact = load();
  artifact.attempts[1].writerSha256 = "0".repeat(64);
  assert.match(
    validateLiveReceiptV4(artifact).join("\n"),
    /attempt 2 writerPath mismatch/,
  );
});
