import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  assessCalibratedReliability,
  assertCompleteRaterSet,
  assertHiddenDuplicateBytes,
  CALIBRATION_GRADE_PATHS,
  CALIBRATION_INDEX_PATH,
  CALIBRATION_PACKET_PATH,
  CALIBRATION_PROTOCOL_PATH,
  validateCalibratedPacketDocument,
  validateCommittedCalibratedPacket,
  validatePredeclaredCalibrationProtocol,
  validateProgressArithmetic,
  type BlindPacket,
  type CalibratedGrade,
  type CalibratedGradeBatch,
  type SealedKey,
} from "./input-field-comparison-calibrated.js";

const json = <T>(file: string): T =>
  JSON.parse(readFileSync(file, "utf8")) as T;
const hash = (file: string): string =>
  createHash("sha256").update(readFileSync(file)).digest("hex");

test("committed packet remains sealed and strict grade validation refuses", () => {
  assert.throws(
    () => validateCommittedCalibratedPacket(),
    /BATCH-CAL-A grade protocol or cardinality differs/,
  );
  const index = json<{
    overall: boolean;
    gradeWritten: boolean;
    liveInputMayProceed: boolean;
    packetHash: string;
    counts: Record<string, number>;
  }>(CALIBRATION_INDEX_PATH);
  assert.equal(index.overall, false);
  assert.equal(index.gradeWritten, false);
  assert.equal(index.liveInputMayProceed, false);
  assert.equal(hash(CALIBRATION_PACKET_PATH), index.packetHash);
  assert.deepEqual(index.counts, {
    sourceCells: 128,
    uniqueOriginalSourceReferences: 128,
    referencePresentations: 384,
    specimens: 384,
    correctedV2: 128,
    unchangedControlCopyA: 128,
    unchangedControlCopyB: 128,
  });
});

test("packet gate rejects a revealed hidden-copy field", () => {
  const packet = json<any>(CALIBRATION_PACKET_PATH);
  const protocol = json<any>(CALIBRATION_PROTOCOL_PATH);
  packet.tasks[0].duplicateGroup = "revealed";
  assert.throws(
    () => validateCalibratedPacketDocument(packet, protocol),
    /task 0 fields differ/,
  );
});

test("packet gate rejects a positional identity label leak", () => {
  const packet = json<any>(CALIBRATION_PACKET_PATH);
  const protocol = json<any>(CALIBRATION_PROTOCOL_PATH);
  packet.tasks[0].specimen.image = "specimens/legacy-copy-a.png";
  assert.throws(
    () => validateCalibratedPacketDocument(packet, protocol),
    /metadata leaks/,
  );
});

test("duplicate byte gate rejects an altered copy", () => {
  const packet = json<any>(CALIBRATION_PACKET_PATH);
  const specimenPath = `recipe/evidence/input-field-comparison-calibrated/blind-packet/${packet.tasks[0].specimen.image}`;
  const original = readFileSync(specimenPath);
  const changed = Buffer.from(original);
  changed[changed.length - 1] ^= 1;
  const expected = createHash("sha256").update(original).digest("hex");
  assert.throws(
    () => assertHiddenDuplicateBytes(original, changed, expected),
    /not byte-identical/,
  );
});

test("threshold commitment rejects a post-grade threshold change", () => {
  const protocol = json<any>(CALIBRATION_PROTOCOL_PATH);
  const recordedCommitment = protocol.commitmentHash;
  protocol.acceptance.everyPairwiseAgreementMinimum = 0.74;
  assert.throws(
    () => validatePredeclaredCalibrationProtocol(protocol, recordedCommitment),
    /protocol, rubric, thresholds, or recorded commitment changed/,
  );
});

test("rater gate rejects a missing independent rater", () => {
  assert.throws(
    () => assertCompleteRaterSet(CALIBRATION_GRADE_PATHS.slice(0, 2)),
    /all three rater files are required together/,
  );
});

test("synthetic reliability engine enforces hidden-copy thresholds before arithmetic", () => {
  const packet = json<BlindPacket>(CALIBRATION_PACKET_PATH);
  const raters = ["BATCH-CAL-A", "BATCH-CAL-B", "BATCH-CAL-C"] as const;
  const categories = [
    "structural-completeness-state-correctness",
    "geometry-proportions",
    "label-helper-adornments",
    "typography",
    "border-fill-focus-error-treatment",
  ] as const;
  const passingGrades = packet.tasks.map((task) => ({
    taskId: task.taskId,
    referenceId: task.reference.referenceId,
    specimenId: task.specimen.specimenId,
    recognisable: true,
    confidence: "high" as const,
    criteria: Object.fromEntries(
      categories.map((category) => [
        category,
        { verdict: "match", defects: [] },
      ]),
    ) as unknown as CalibratedGrade["criteria"],
    defects: [],
  }));
  const batches = raters.map((rater): CalibratedGradeBatch => ({
    version: "input-field-calibrated-grade-v1",
    rater,
    independentBlindGrade: true,
    packetHash: hash(CALIBRATION_PACKET_PATH),
    randomizedBatchHash: packet.randomizedBatchHash,
    calibrationCommitmentHash: packet.calibrationCommitmentHash,
    rubricHash: packet.rubricHash,
    counts: { tasks: 384, grades: 384 },
    grades: structuredClone(passingGrades),
  }));
  const paths = ["corrected-v2", "legacy-copy-a", "legacy-copy-b"] as const;
  const answers = packet.tasks.map((task, index) => ({
    taskId: task.taskId,
    referenceId: task.reference.referenceId,
    specimenId: task.specimen.specimenId,
    implementationPath: paths[index % 3],
    cellKey: `synthetic-cell-${Math.floor(index / 3)}`,
    referenceHash: "1".repeat(64),
    specimenHash: index % 3 === 0 ? "2".repeat(64) : "3".repeat(64),
  }));
  const key: SealedKey = {
    version: "input-field-calibrated-hidden-duplicate-v1",
    sealedFromBlindRaters: true,
    calibrationCommitmentHash: packet.calibrationCommitmentHash,
    randomizationSeedHash: "0".repeat(64),
    randomizedBatchHash: packet.randomizedBatchHash,
    answers,
  };
  const passing = assessCalibratedReliability(
    packet,
    key,
    batches,
    hash(CALIBRATION_PACKET_PATH),
  );
  assert.equal(passing.status, "passed");
  assert.deepEqual(passing.progress, {
    arithmetic: {
      denominator: 128,
      legacyConsensusRows: 128,
      recipeConsensusRows: 128,
      legacyVotesPerCell: 1,
      blockedCells: 0,
    },
    exact128CellScoresAvailable: true,
    legacyPasses: 128,
    recipePasses: 128,
  });

  for (let cell = 0; cell < 7; cell += 1) {
    const copyA = batches[0]!.grades[cell * 3 + 1]!;
    copyA.recognisable = false;
    copyA.criteria["structural-completeness-state-correctness"] = {
      verdict: "fail",
      defects: [
        "Synthetic planted structural mismatch used only to exercise the locked repeatability threshold.",
      ],
    };
    copyA.defects = [
      "Synthetic planted structural mismatch used only to exercise the locked repeatability threshold.",
    ];
  }
  const failed = assessCalibratedReliability(
    packet,
    key,
    batches,
    hash(CALIBRATION_PACKET_PATH),
  );
  assert.equal(
    failed.hiddenDuplicateAgreementByRater["BATCH-CAL-A"].agreements,
    121,
  );
  assert.equal(
    failed.duplicatePassRateDifferenceByRater["BATCH-CAL-A"].passed,
    false,
  );
  assert.equal(failed.status, "failed");
  assert.equal(failed.progress, null);
});

test("progress arithmetic rejects hidden-copy double weighting", () => {
  assert.throws(
    () =>
      validateProgressArithmetic({
        denominator: 256,
        legacyConsensusRows: 256,
        recipeConsensusRows: 128,
        legacyVotesPerCell: 2,
        blockedCells: 0,
      }),
    /double-weights legacy or changes the exact denominator/,
  );
  assert.doesNotThrow(() =>
    validateProgressArithmetic({
      denominator: 128,
      legacyConsensusRows: 128,
      recipeConsensusRows: 128,
      legacyVotesPerCell: 1,
      blockedCells: 0,
    }),
  );
});
