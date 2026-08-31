import assert from "node:assert/strict";
import test from "node:test";

import {
  readRepositoryEvidence,
  resolveRepositoryEvidencePath,
} from "./evidence-path.js";

test("evidence reads are repository-contained before filesystem access", () => {
  assert.match(
    resolveRepositoryEvidencePath(
      "recipe/evidence/input-field-live-pivot-v2/receipt.json",
    ),
    /recipe\/evidence\/input-field-live-pivot-v2\/receipt\.json$/,
  );
  assert.ok(
    readRepositoryEvidence(
      "recipe/evidence/input-field-live-pivot-v2/receipt.json",
    ).byteLength > 0,
  );
  for (const escaped of [
    "../outside.json",
    "recipe/../../outside.json",
    "/tmp/outside.json",
    "",
  ]) {
    assert.throws(
      () => resolveRepositoryEvidencePath(escaped),
      /evidence path/,
    );
  }
});
