import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { PNG } from "pngjs";

import { canonicalJson } from "./normalize.js";
import { readRepositoryEvidence, readRepositoryJson } from "./evidence-path.js";
import {
  RECIPE_RASTER_CALIBRATION_CORPUS_HASH,
  RECIPE_RASTER_CALIBRATION_VERSION,
  RECIPE_RASTER_METRIC_HASH,
  assertRasterCalibration,
  evaluateHeldOutCalibration,
  type CalibrationRender,
} from "./raster-calibration.js";

const ROOT = "recipe/evidence/raster-calibration-v1";
const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const json = (file: string): Record<string, any> =>
  readRepositoryJson<Record<string, any>>(file);
const fileHash = (file: string): string => sha256(readRepositoryEvidence(file));
export const HISTORICAL_CALIBRATION_LIMITATIONS = [
  "the uncommitted tree cannot prove split or criterion chronology",
  "capture bytes and arithmetic are revalidated; live Figma provenance cannot be replayed offline",
] as const;

const render = (
  artifact: Record<string, any>,
  forceValidation = false,
): CalibrationRender => ({
  specimenId: artifact.specimenId,
  split: forceValidation ? "validation" : artifact.split,
  png: readRepositoryEvidence(artifact.path),
  root: artifact.root,
  roles: artifact.roles,
  text: artifact.text,
  structureHash: artifact.structureHash,
});
const sameMetric = (left: number, right: unknown): boolean =>
  typeof right === "number" &&
  Number.isFinite(right) &&
  Math.abs(left - right) <= Number.EPSILON * Math.max(1, Math.abs(right)) * 8;

export function verifyRasterCalibrationEvidence(): void {
  const index = json(`${ROOT}/index.json`);
  const receipt = json(`${ROOT}/receipt.json`);
  const results = json(`${ROOT}/results.json`);
  const candidate = json(`${ROOT}/candidate-calibration.json`);
  assert.equal(index.version, RECIPE_RASTER_CALIBRATION_VERSION);
  assert.equal(receipt.version, RECIPE_RASTER_CALIBRATION_VERSION);
  assert.equal(results.version, RECIPE_RASTER_CALIBRATION_VERSION);
  assert.equal(index.corpus.hash, RECIPE_RASTER_CALIBRATION_CORPUS_HASH);
  assert.equal(results.corpusHash, RECIPE_RASTER_CALIBRATION_CORPUS_HASH);
  assert.equal(results.metricHash, RECIPE_RASTER_METRIC_HASH);
  assert.equal(receipt.algorithm.metricHash, RECIPE_RASTER_METRIC_HASH);
  assertRasterCalibration(candidate.calibration);
  assert.deepEqual(results.parameters, candidate.calibration);
  assert.equal(
    candidate.calibrationHash,
    results.parametersHash,
    "CALIBRATION-HASH-DIVERGENCE",
  );
  assert.equal(index.results.sha256, fileHash(index.results.path));
  assert.equal(index.receipt.sha256, fileHash(index.receipt.path));
  assert.equal(
    receipt.evidence.results.sha256,
    fileHash(receipt.evidence.results.path),
  );
  assert.equal(
    receipt.evidence.candidateCalibration.sha256,
    fileHash(receipt.evidence.candidateCalibration.path),
  );
  assert.deepEqual(results.counts, { corpus: 24, training: 16, validation: 8 });
  assert.equal(results.splitLockedBeforeMeasurement, true);
  assert.equal(results.deterministic.browserDuplicateCaptureBytes, true);
  assert.equal(results.deterministic.figmaBaselineDuplicateExportBytes, true);
  assert.equal(results.deterministic.figmaCalibratedDuplicateExportBytes, true);
  assert.equal(results.structuralFactsUnchanged, true);
  assert.equal(
    receipt.sourceNeutrality.targetReferencePixelsReadByAlgorithm,
    false,
  );
  assert.equal(
    receipt.sourceNeutrality.targetOutputPixelsReadByAlgorithm,
    false,
  );
  assert.equal(receipt.sourceNeutrality.sourceIdentityBranches, 0);
  assert.equal(receipt.sourceNeutrality.componentBranches, 0);
  assert.equal(receipt.sourceNeutrality.cellBranches, 0);
  assert.equal(receipt.figma.exactPrePostState, true);
  assert.equal(receipt.figma.retainedCalibrationPage, false);
  assert.equal(receipt.figma.protectedStateUnchanged, true);
  assert.equal(receipt.figma.cleanup.removedPageIds.length, 1);
  assert.deepEqual(receipt.figma.cleanup.removedCollectionIds, []);
  assert.equal(receipt.immutableInputEvidence.exact, true);
  assert.equal(results.decision.appliedToInput, false);
  assert.equal(index.calibrationAppliedToInput, false);
  assert.equal(index.accepted, results.decision.accepted);
  assert.equal(index.inputV3Authorized, results.decision.inputV3Authorized);
  assert.equal(results.decision.inputV3Authorized, results.validation.accepted);
  const capture = (name: string): Record<string, any>[] => {
    const entries = results.captures[name];
    assert.ok(Array.isArray(entries) && entries.length > 0);
    return entries;
  };
  for (const split of ["training", "validation"] as const) {
    const browser = capture("browser")
      .filter((artifact) => artifact.split === split)
      .map((artifact) => render(artifact, true));
    const baseline = capture("figmaBaseline")
      .filter((artifact) => artifact.split === split)
      .map((artifact) => render(artifact, true));
    const calibrated = capture("figmaCalibrated")
      .filter((artifact) => artifact.split === split)
      .map((artifact) => render(artifact, true));
    const recomputed = evaluateHeldOutCalibration(
      browser,
      baseline,
      calibrated,
      candidate.calibration,
    );
    const claimed = results[split];
    for (const side of ["baseline", "calibrated"] as const) {
      for (const metric of ["geometry", "pixelInk"] as const) {
        assert.ok(
          sameMetric(recomputed[side][metric], claimed[side][metric]),
          `${split}.${side}.${metric}: arithmetic mismatch`,
        );
        assert.ok(
          recomputed[side][metric] >= 0 && recomputed[side][metric] <= 1,
          `${split}.${side}.${metric}: extreme aggregate`,
        );
      }
    }
    if (split === "validation") {
      assert.deepEqual(
        recomputed.catastrophicRegressions,
        results.validation.catastrophicRegressions,
      );
      assert.equal(
        recomputed.structuralFactsUnchanged,
        results.validation.structuralFactsUnchanged,
      );
      assert.equal(recomputed.allNonzero, results.validation.allNonzero);
      assert.equal(recomputed.accepted, results.validation.accepted);
    }
  }
  for (const group of Object.values(results.captures) as Array<
    Array<{ path: string; sha256: string }>
  >) {
    assert.ok(group.length > 0, "ZERO-COUNT-CAPTURE-GROUP");
    for (const artifact of group) {
      assert.equal(fileHash(artifact.path), artifact.sha256);
      const png = PNG.sync.read(readRepositoryEvidence(artifact.path));
      assert.ok(
        png.data.some((value) => value < 250),
        `${artifact.path}: ZERO-INK-CAPTURE`,
      );
    }
  }
  for (const attempt of receipt.attempts as Array<Record<string, any>>) {
    if (attempt.files) {
      assert.ok(attempt.files.length > 0);
      for (const artifact of attempt.files) {
        assert.equal(fileHash(artifact.path), artifact.sha256);
      }
      continue;
    }
    assert.equal(attempt.exactByteTransport, true);
    assert.equal(fileHash(attempt.writer.path), attempt.writer.sha256);
    assert.equal(fileHash(attempt.wrapper.path), attempt.wrapper.sha256);
    assert.equal(fileHash(attempt.envelope.path), attempt.envelope.sha256);
    assert.equal(attempt.decodedSha256, attempt.writer.sha256);
    assert.equal(attempt.decodedBytes, attempt.writer.bytes);
  }
  assert.equal(
    canonicalJson(receipt.figma.preState),
    canonicalJson(receipt.figma.postState),
  );
}

export function runRasterCalibrationTamperSelfTest(): void {
  const candidate = json(`${ROOT}/candidate-calibration.json`);
  const planted = structuredClone(candidate.calibration);
  planted.writer.fontSizeScale = 9;
  assert.throws(
    () => assertRasterCalibration(planted),
    /EXTREME-CALIBRATION-COEFFICIENT/,
  );
  const targeted = {
    ...candidate.calibration,
    componentIdentityBranch: "planted",
  };
  assert.throws(
    () => assertRasterCalibration(targeted),
    /TARGET-IDENTITY-BRANCH/,
  );
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  verifyRasterCalibrationEvidence();
  if (process.argv.includes("--self-test"))
    runRasterCalibrationTamperSelfTest();
  process.stdout.write(
    `${RECIPE_RASTER_CALIBRATION_VERSION}: evidence verified${process.argv.includes("--self-test") ? " with planted tamper refusals" : ""}\n`,
  );
}
