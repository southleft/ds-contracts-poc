import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  assertArtifactHash,
  GOLD_PACKET_PATH,
  GRADE_SCHEMA_PATH,
  PERFORMANCE_PACKET_PATH,
  PROTOCOL_PATH,
  RECEIPT_PATH,
  ROOT,
  validateCalibrationPrerequisite,
  validateGradeEnvelope,
  validatePacketDocument,
  validateProtocol,
  type CalibrationReceipt,
  type GradeEnvelope,
} from "./input-field-comparison-calibration-v2.js";
import {
  assertPerformanceAccessAllowed,
  validateQualificationReceipt,
  type QualificationReceipt,
} from "./input-field-comparison-calibration-v2-qualification.js";

const json = <T>(file: string): T =>
  JSON.parse(readFileSync(file, "utf8")) as T;
const hash = (file: string): string =>
  createHash("sha256").update(readFileSync(file)).digest("hex");

const completeTemplate = (
  phase: "gold-calibration" | "performance",
  rater = "RATER-CAL-V2-A",
): GradeEnvelope => {
  const slug = rater.toLowerCase();
  const folder = phase === "gold-calibration" ? "gold" : "performance";
  const template = json<any>(
    `${ROOT}/${folder}/blind-packet/templates/${slug}.json`,
  );
  template.counts.submitted = template.counts.expected;
  for (const grade of template.orderedGrades) {
    grade.recognisable = true;
    grade.confidence = "high";
    for (const criterion of Object.values(grade.criteria) as any[]) {
      criterion.verdict = "match";
      criterion.defects = [];
    }
    grade.defects = [];
  }
  return template as GradeEnvelope;
};

test("qualification is adjudicated while performance stays sealed", () => {
  const receipt = json<any>(RECEIPT_PATH);
  assert.equal(receipt.status.goldPacket, "qualification-adjudicated");
  assert.equal(receipt.status.performancePacket, "sealed-ungraded");
  assert.equal(receipt.status.architecturePerformance, "not-unsealed");
  assert.equal(receipt.gold.qualification.qualifiedCount, 2);
  assert.equal(receipt.gold.qualification.performanceCommissioned, false);
  assert.equal(receipt.performance.performanceIdentitiesRevealed, false);
  assert.equal(receipt.performance.gradeWritten, false);
  assert.deepEqual(receipt.performance.counts, {
    uniqueSourceReferences: 128,
    referencePresentations: 384,
    correctedV2: 128,
    hiddenLegacyCopyA: 128,
    hiddenLegacyCopyB: 128,
    specimens: 384,
  });
  assert.equal(
    receipt.performance.byteContinuity.sourceReferencesMatchingPriorRound,
    128,
  );
  assert.equal(
    receipt.performance.byteContinuity.correctedV2MatchingPriorRound,
    128,
  );
  assert.equal(
    receipt.performance.byteContinuity.hiddenByteIdenticalPairs,
    128,
  );
  assert.match(
    receipt.performance.byteContinuity.continuityHash,
    /^[a-f0-9]{64}$/,
  );
});

test("gold packet has objective balanced classes and no target specimens", () => {
  const receipt = json<any>(RECEIPT_PATH);
  assert.deepEqual(receipt.gold.counts, {
    cases: 24,
    exactOrSemanticPasses: 8,
    controlledMinorPasses: 4,
    obviousStructuralOrStateFailures: 12,
    expectedPass: 12,
    expectedFail: 12,
  });
  assert.equal(receipt.gold.syntheticGeneratorSourceHash.length, 64);
  assert.notEqual(receipt.gold.packetHash, receipt.performance.packetHash);
});

test("preflight rejects a planted missing required envelope field", () => {
  const packet = json<any>(GOLD_PACKET_PATH);
  const envelope = completeTemplate("gold-calibration") as any;
  delete envelope.schemaVersion;
  assert.throws(
    () => validateGradeEnvelope(envelope, packet, hash(GOLD_PACKET_PATH)),
    /grade envelope fields differ/,
  );
});

test("preflight rejects a planted wrong packet hash", () => {
  const packet = json<any>(GOLD_PACKET_PATH);
  const envelope = completeTemplate("gold-calibration");
  envelope.packetHash = "0".repeat(64);
  assert.throws(
    () => validateGradeEnvelope(envelope, packet, hash(GOLD_PACKET_PATH)),
    /binding, counts, or required fields differ/,
  );
});

test("performance prerequisite rejects a planted failed calibration", () => {
  const envelope = completeTemplate("performance");
  const binding = {
    path: `${ROOT}/gold/receipts/rater-cal-v2-a.json`,
    sha256: "0".repeat(64),
    score: 0.9166666666666666,
    obviousStructuralStateFailureScore: 1,
    passed: true as const,
  };
  const failedReceipt = {
    version: "rater-calibration-receipt-v1",
    graderId: envelope.graderId,
    calibrationCommitment: envelope.calibrationCommitment,
    packetHash: hash(GOLD_PACKET_PATH),
    randomizedBatchHash: "0".repeat(64),
    gradeHash: "0".repeat(64),
    score: 0.9166666666666666,
    correct: 22,
    denominator: 24,
    obviousStructuralStateFailuresCorrect: 12,
    obviousStructuralStateFailuresDenominator: 12,
    obviousStructuralStateFailureScore: 1,
    envelopeValid: true,
    passed: false,
    performanceEligibility: false,
    feedback: [],
  } satisfies CalibrationReceipt;
  assert.throws(
    () => validateCalibrationPrerequisite(binding, failedReceipt, envelope),
    /failed calibration or receipt prerequisites/,
  );
});

test("packet gate rejects label leakage and a revealed duplicate field", () => {
  const packet = json<any>(PERFORMANCE_PACKET_PATH);
  const protocol = json<any>(PROTOCOL_PATH);
  const leaked = structuredClone(packet);
  leaked.tasks[0].specimen.image = "specimens/legacy-copy-a.png";
  assert.throws(
    () => validatePacketDocument(leaked, "performance", 384, protocol),
    /label leakage/,
  );
  const revealed = structuredClone(packet);
  revealed.tasks[0].duplicateGroup = "same-as-task-2";
  assert.throws(
    () => validatePacketDocument(revealed, "performance", 384, protocol),
    /task 0 fields differ/,
  );
});

test("artifact gates reject altered gold, schema, and receipt bytes", () => {
  const goldPacket = json<any>(GOLD_PACKET_PATH);
  const performancePacket = json<any>(PERFORMANCE_PACKET_PATH);
  const goldPath = `${ROOT}/gold/blind-packet/${goldPacket.tasks[0].specimen.image}`;
  const performancePath = `${ROOT}/performance/blind-packet/${performancePacket.tasks[0].specimen.image}`;
  const sources = [goldPath, performancePath, GRADE_SCHEMA_PATH, RECEIPT_PATH];
  for (const source of sources) {
    const original = readFileSync(source);
    const changed = Buffer.from(original);
    changed[changed.length - 1] ^= 1;
    assert.throws(
      () => assertArtifactHash(changed, hash(source), source),
      /bytes or hash differ/,
    );
  }
});

test("protocol gate rejects post-grade threshold changes", () => {
  const protocol = json<any>(PROTOCOL_PATH);
  protocol.reliability.fleissKappaMinimum = 0.59;
  assert.throws(
    () => validateProtocol(protocol),
    /protocol, rubric, thresholds, or commitment changed after lock/,
  );
});

test("grade JSON Schema requires all binding fields and ordered rows", () => {
  const schema = json<any>(GRADE_SCHEMA_PATH);
  assert.deepEqual(schema.required, [
    "phase",
    "schemaVersion",
    "graderId",
    "packetProtocol",
    "packetHash",
    "randomizedBatchHash",
    "calibrationCommitment",
    "rubricVersion",
    "counts",
    "orderedGrades",
  ]);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(
    schema.properties.orderedGrades.items.properties.criteria.required,
    [
      "required-structure-content",
      "semantic-state",
      "geometry-proportion",
      "typography-raster",
      "color-border-effects",
    ],
  );
});

const qualificationReceipt = (slug: string): QualificationReceipt =>
  json<QualificationReceipt>(`${ROOT}/gold/receipts/${slug}.json`);

test("tamper gate rejects a forged qualification receipt", () => {
  const forged = structuredClone(qualificationReceipt("rater-cal-v2-b"));
  forged.passed = false;
  forged.performanceEligibility = false;
  forged.performanceBinding.passed = false;
  const body = structuredClone(forged) as Partial<QualificationReceipt>;
  delete body.signature;
  forged.signature.signedPayloadHash = createHash("sha256")
    .update(JSON.stringify(body))
    .digest("hex");
  assert.throws(
    () =>
      validateQualificationReceipt(
        forged,
        undefined,
        hash(`${ROOT}/gold/receipts/rater-cal-v2-b.json`),
      ),
    /calibration receipt pin differs/,
  );
});

test("tamper gate rejects a wrong submission hash", () => {
  const receipt = qualificationReceipt("rater-cal-v2-b");
  assert.throws(
    () => validateQualificationReceipt(receipt, "0".repeat(64)),
    /calibration receipt submission hash differs/,
  );
});

test("tamper gate rejects performance access before pass", () => {
  const failed = qualificationReceipt("rater-cal-v2-a");
  assert.throws(
    () => assertPerformanceAccessAllowed(failed),
    /performance access attempted before calibration pass/,
  );
});

test("cohort gate blocks qualified raters until three pass", () => {
  const qualified = qualificationReceipt("rater-cal-v2-b");
  assert.throws(
    () => assertPerformanceAccessAllowed(qualified),
    /performance access attempted before calibration pass/,
  );
});

test("tamper gate rejects altered score arithmetic", () => {
  const altered = structuredClone(qualificationReceipt("rater-cal-v2-c"));
  altered.correct = 23;
  const body = structuredClone(altered) as Partial<QualificationReceipt>;
  delete body.signature;
  altered.signature.signedPayloadHash = createHash("sha256")
    .update(JSON.stringify(body))
    .digest("hex");
  assert.throws(
    () => validateQualificationReceipt(altered),
    /calibration receipt score arithmetic differs/,
  );
});
