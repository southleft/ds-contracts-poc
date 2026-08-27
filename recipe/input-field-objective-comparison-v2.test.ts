import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const readJson = (file: string) =>
  JSON.parse(readFileSync(file, "utf8")) as Record<string, any>;
const sha256 = (file: string) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");

test("objective v2 rederives with the unchanged locked comparator", () => {
  execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "recipe/input-field-objective-comparison-v1.ts",
      "--v2",
    ],
    { stdio: "pipe" },
  );
  const result = readJson(
    "recipe/evidence/input-field-objective-comparison-v2/objective-result.json",
  );
  assert.equal(
    result.protocolHash,
    "b31c69642a69da054d644a91afa2b5dd6867ffe2eef3ca36fffe0763a93d1a34",
  );
  assert.equal(result.denominator, 128);
  assert.equal(
    Object.values(result.criteria as Record<string, boolean>).every(Boolean),
    true,
  );
  assert.deepEqual(result.aggregates.overall.geometry, {
    recipeWins: 128,
    legacyWins: 0,
    ties: 0,
    denominator: 128,
  });
  assert.deepEqual(result.aggregates.overall.pixelInk, {
    recipeWins: 128,
    legacyWins: 0,
    ties: 0,
    denominator: 128,
  });
  assert.equal(result.decision.liveInputEngineeringMayProceed, true);
  assert.equal(result.decision.overallInputSuccess, false);
  assert.equal(
    result.claims.humanRecognisability,
    "pending-final-independent-designer-review",
  );
  assert.equal(
    result.diagnosis.previousObjectiveCorrection
      .libraryConditionalsInGenericLogic,
    0,
  );
});

test("comparison v3 refuses reference, legacy, matrix, or environment drift", () => {
  const before = readJson(
    "recipe/evidence/input-field-comparison-v2/receipt.json",
  );
  const after = readJson(
    "recipe/evidence/input-field-comparison-v3/receipt.json",
  );
  assert.equal(after.version, 3);
  assert.equal(after.matrix.sampleMatrixHash, before.matrix.sampleMatrixHash);
  assert.equal(
    after.provenance.environmentHash,
    before.provenance.environmentHash,
  );
  for (const field of ["references"] as const) {
    assert.deepEqual(
      after[field].map((artifact: any) => [artifact.cellKey, artifact.hash]),
      before[field].map((artifact: any) => [artifact.cellKey, artifact.hash]),
    );
  }
  assert.deepEqual(
    after.outputs.legacy.map((artifact: any) => [
      artifact.cellKey,
      artifact.hash,
    ]),
    before.outputs.legacy.map((artifact: any) => [
      artifact.cellKey,
      artifact.hash,
    ]),
  );
  assert.equal(after.references.length, 128);
  assert.equal(after.outputs.legacy.length, 128);
  assert.equal(after.outputs.recipeReact.length, 128);
  assert.equal(after.outputs.recipeWebComponent.length, 128);
  assert.equal(
    sha256("recipe/evidence/input-field-objective-comparison-v1/protocol.json"),
    "b31c69642a69da054d644a91afa2b5dd6867ffe2eef3ca36fffe0763a93d1a34",
  );
});
