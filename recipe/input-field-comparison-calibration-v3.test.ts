import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  assertReplacementAuthorization,
  D_QUALIFICATION_RECEIPT_PATH,
  D_GOLD_TEMPLATE_PATH,
  INDEX_PATH,
  PROTOCOL_PATH,
  RECEIPT_PATH,
  ROOT,
  validateDQualificationReceipt,
  validateCommittedReplacementV3,
  validateReplacementEnvelope,
  validateReplacementProtocol,
} from "./input-field-comparison-calibration-v3.js";
import type { GradeEnvelope } from "./input-field-comparison-calibration-v2.js";

const V2_ROOT = "recipe/evidence/input-field-comparison-calibration-v2";
const GOLD_PACKET_PATH = `${V2_ROOT}/gold/blind-packet/packet.json`;
const PERFORMANCE_PACKET_PATH = `${V2_ROOT}/performance/blind-packet/packet.json`;
const PERFORMANCE_KEY_PATH = `${V2_ROOT}/performance/sealed-answer-key.json`;

const json = <T>(file: string): T =>
  JSON.parse(readFileSync(file, "utf8")) as T;
const hash = (file: string): string =>
  createHash("sha256").update(readFileSync(file)).digest("hex");

const completeDGoldTemplate = (): GradeEnvelope => {
  const template = json<any>(D_GOLD_TEMPLATE_PATH);
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

test("replacement commitment validates without mutating calibration v2", () => {
  assert.doesNotThrow(() => validateCommittedReplacementV3());
  const receipt = json<any>(RECEIPT_PATH);
  assert.equal(receipt.preservation.calibrationV2Modified, false);
  assert.match(
    receipt.preservation.calibrationV2Snapshot.aggregateSha256,
    /^[a-f0-9]{64}$/,
  );
});

test("B and C imports are exact, passing, and hash pinned", () => {
  const receipt = json<any>(RECEIPT_PATH);
  for (const rater of ["RATER-CAL-V2-B", "RATER-CAL-V2-C"]) {
    const imported = receipt.imports[rater];
    assert.equal(imported.status, "imported-valid");
    assert.equal(imported.score, 1);
    assert.equal(imported.obviousFailureScore, 1);
    assert.equal(imported.envelopeValid, true);
    assert.equal(imported.receiptHash, hash(imported.receiptPath));
    assert.equal(imported.submissionHash, hash(imported.submissionPath));
    assert.equal(
      imported.compatibilityFieldsHash,
      receipt.commitment.compatibilityFieldsHash,
    );
  }
});

test("A remains the excluded failed 22/24 and 11/12 rater", () => {
  const receipt = json<any>(RECEIPT_PATH);
  const protocol = json<any>(PROTOCOL_PATH);
  assert.deepEqual(protocol.roster.performanceRoster, [
    "RATER-CAL-V2-B",
    "RATER-CAL-V2-C",
    "RATER-CAL-V3-D",
  ]);
  assert.equal(receipt.historicalA.excludedRater, "RATER-CAL-V2-A");
  assert.equal(receipt.historicalA.correct, 22);
  assert.equal(receipt.historicalA.obviousFailuresCorrect, 11);
  assert.equal(receipt.historicalA.passed, false);
});

test("D qualification is hash pinned and passes the locked thresholds", () => {
  const receipt = json<any>(RECEIPT_PATH);
  const protocol = json<any>(PROTOCOL_PATH);
  const template = json<any>(D_GOLD_TEMPLATE_PATH);
  const qualification = json<any>(D_QUALIFICATION_RECEIPT_PATH);
  assert.equal(template.graderId, "RATER-CAL-V3-D");
  assert.equal(template.packetHash, hash(GOLD_PACKET_PATH));
  assert.equal(template.counts.expected, 24);
  assert.equal(receipt.freshD.status, "qualified-performance-authorized");
  assert.equal(
    protocol.dEnvelopeIdentityOverlay.onlyExtension,
    "graderId-is-exactly-RATER-CAL-V3-D",
  );
  assert.equal(
    protocol.dEnvelopeIdentityOverlay.scoringFieldsOrConstraintsChanged,
    false,
  );
  assert.equal(
    receipt.freshD.goldOutput,
    `${ROOT}/gold/submissions/rater-cal-v3-d.json`,
  );
  assert.equal(existsSync(receipt.freshD.goldOutput), true);
  assert.equal(existsSync(receipt.freshD.qualificationReceipt), true);
  assert.equal(
    receipt.freshD.qualification.receiptHash,
    hash(D_QUALIFICATION_RECEIPT_PATH),
  );
  assert.equal(qualification.counts.correct, 23);
  assert.equal(qualification.counts.submitted, 24);
  assert.equal(qualification.score, 23 / 24);
  assert.equal(qualification.obviousFailureScore, 1);
  assert.equal(qualification.envelopeValid, true);
  assert.equal(qualification.passed, true);
  assert.equal(qualification.performanceBinding.passed, true);
});

test("D envelope gate rejects relabelling A as D", () => {
  const packet = json<any>(GOLD_PACKET_PATH);
  const envelope = completeDGoldTemplate();
  envelope.graderId = "RATER-CAL-V2-A";
  assert.throws(
    () =>
      validateReplacementEnvelope(
        envelope,
        packet,
        hash(GOLD_PACKET_PATH),
        "RATER-CAL-V3-D",
      ),
    /grade envelope binding, counts, or required fields differ/,
  );
});

test("compatibility gate rejects changed gold packet, rubric, schema, and threshold pins", () => {
  const mutations: Array<(protocol: any) => void> = [
    (protocol) => {
      protocol.sourceCalibrationV2.goldPacketHash = "0".repeat(64);
    },
    (protocol) => {
      protocol.sourceCalibrationV2.compatibilityFields.rubricHash = "0".repeat(
        64,
      );
    },
    (protocol) => {
      protocol.sourceCalibrationV2.gradeSchemaHash = "0".repeat(64);
    },
    (protocol) => {
      protocol.importedQualifications["RATER-CAL-V2-B"].receiptHash =
        "0".repeat(64);
    },
    (protocol) => {
      protocol.reliability.calibrationScoreMinimum = 0.94;
    },
  ];
  for (const mutate of mutations) {
    const protocol = json<any>(PROTOCOL_PATH);
    mutate(protocol);
    assert.throws(
      () => validateReplacementProtocol(protocol),
      /protocol, commitment, compatibility fields, paths, or thresholds changed/,
    );
  }
});

test("performance continuity gate rejects changed packet, key, order, and roster pins", () => {
  const mutations: Array<(protocol: any) => void> = [
    (protocol) => {
      protocol.performanceContinuity.packetHash = "0".repeat(64);
    },
    (protocol) => {
      protocol.performanceContinuity.sealedAnswerKeyHash = "0".repeat(64);
    },
    (protocol) => {
      protocol.performanceContinuity.randomizedBatchHash = "0".repeat(64);
    },
    (protocol) => {
      protocol.roster.performanceRoster[2] = "RATER-CAL-V2-A";
    },
  ];
  for (const mutate of mutations) {
    const protocol = json<any>(PROTOCOL_PATH);
    mutate(protocol);
    assert.throws(
      () => validateReplacementProtocol(protocol),
      /protocol, commitment, compatibility fields, paths, or thresholds changed/,
    );
  }
  assert.equal(
    json<any>(PROTOCOL_PATH).performanceContinuity.packetHash,
    hash(PERFORMANCE_PACKET_PATH),
  );
  assert.equal(
    json<any>(PROTOCOL_PATH).performanceContinuity.sealedAnswerKeyHash,
    hash(PERFORMANCE_KEY_PATH),
  );
});

test("performance is authorized only for qualified B, C, and D", () => {
  assert.doesNotThrow(() => assertReplacementAuthorization());
  const index = json<any>(INDEX_PATH);
  const receipt = json<any>(RECEIPT_PATH);
  assert.equal(index.performanceAccessAllowed, true);
  assert.equal(index.performanceUnsealed, false);
  assert.equal(index.performanceGraded, false);
  assert.equal(index.liveInputMayProceed, false);
  assert.equal(receipt.performance.performanceCommissioned, true);
  assert.deepEqual(receipt.performance.authorizedRaters, [
    "RATER-CAL-V2-B",
    "RATER-CAL-V2-C",
    "RATER-CAL-V3-D",
  ]);
});

test("D receipt validation rejects score, signature, and binding tampering", () => {
  const protocol = json<any>(PROTOCOL_PATH);
  const mutations: Array<(receipt: any) => void> = [
    (receipt) => {
      receipt.score = 1;
    },
    (receipt) => {
      receipt.obviousFailureScore = 0.5;
    },
    (receipt) => {
      receipt.performanceBinding.passed = false;
    },
    (receipt) => {
      receipt.sourceGoldAnswerKeyHash = "0".repeat(64);
    },
  ];
  for (const mutate of mutations) {
    const receipt = json<any>(D_QUALIFICATION_RECEIPT_PATH);
    mutate(receipt);
    assert.throws(
      () => validateDQualificationReceipt(receipt, protocol),
      /D receipt signature differs|D receipt identity, continuity, arithmetic, independence, or threshold differs/,
    );
  }
});

test("future B, C, and D performance paths bind the unchanged packet", () => {
  const receipt = json<any>(RECEIPT_PATH);
  for (const rater of ["RATER-CAL-V2-B", "RATER-CAL-V2-C", "RATER-CAL-V3-D"]) {
    const template = json<any>(receipt.performance.templates[rater].path);
    assert.equal(template.graderId, rater);
    assert.equal(template.packetHash, hash(PERFORMANCE_PACKET_PATH));
    assert.equal(template.counts.expected, 384);
    assert.equal(
      receipt.performance.outputs[rater],
      `${ROOT}/performance/submissions/${rater.toLowerCase()}.json`,
    );
  }
});
