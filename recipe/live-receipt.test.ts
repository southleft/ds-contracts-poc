import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateLiveButtonReceipt } from "./live-receipt.js";

const receiptPath = "recipe/evidence/button-live-pivot/receipt.json";
const receipt = (): Record<string, any> =>
  JSON.parse(readFileSync(receiptPath, "utf8")) as Record<string, any>;

test("committed live receipt fails closed after the capped writer attempts", () => {
  assert.deepEqual(validateLiveButtonReceipt(receipt()), []);
});

test("live receipt refuses wrong target, forged success, and writer tamper", () => {
  const wrongFile = receipt();
  wrongFile.target.fileKey = "Y8Jhw6R49wTLuXZ0is2GmV";
  assert.match(
    validateLiveButtonReceipt(wrongFile).join("\n"),
    /Scratch Project/,
  );

  const forged = receipt();
  forged.status.buttonSuccess = true;
  assert.match(
    validateLiveButtonReceipt(forged).join("\n"),
    /Button success must remain false/,
  );

  const tampered = receipt();
  const original = readFileSync(tampered.provenance.finalOfflineWriter);
  assert.match(
    validateLiveButtonReceipt(tampered, (path) =>
      path === tampered.provenance.finalOfflineWriter
        ? Buffer.concat([original, Buffer.from("// tamper\n")])
        : readFileSync(path),
    ).join("\n"),
    /writer bytes changed/,
  );
});

test("live receipt catches planted omission, mislabel, and forged comparison", () => {
  const omitted = receipt();
  omitted.accounting.offlineSourceAndCompiledIr[
    "altitude-button-reviewed-v2"
  ].factsCompared -= 1;
  assert.match(
    validateLiveButtonReceipt(omitted).join("\n"),
    /offline zero-silent accounting/,
  );

  const mislabeled = receipt();
  const report =
    mislabeled.accounting.offlineSourceAndCompiledIr[
      "fluent-button-reviewed-v2"
    ];
  report.carried -= 1;
  report.codeOnly += 2;
  assert.match(
    validateLiveButtonReceipt(mislabeled).join("\n"),
    /offline zero-silent accounting/,
  );

  const forged = receipt();
  forged.readback.comparedFacts = 1;
  forged.readback.twoCompleteCyclesStable = true;
  assert.match(
    validateLiveButtonReceipt(forged).join("\n"),
    /zero-fact live readback/,
  );
});
