import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  ABSOLUTE_GATE_PATH,
  adjudicateRelativePerformance,
  evaluatePerformanceReliability,
  GOLD_KEY_PATH,
  GOLD_PACKET_PATH,
  PERFORMANCE_PACKET_PATH,
  PROTOCOL_PATH,
  RECEIPT_PATH,
  ROOT,
  SCHEMA_PATH,
  scoreGoldEnvelope,
  validateCommittedPairedComparisonInstrument,
  validateGradeEnvelope,
  validateQualificationAdjudication,
  type GradeEnvelope,
  type PairedPacket,
  type QualificationReceipt,
} from "./input-field-paired-comparison-v1.js";

const json = <T>(file: string): T =>
  JSON.parse(readFileSync(file, "utf8")) as T;
const sha256 = (value: string | Buffer): string =>
  createHash("sha256").update(value).digest("hex");
const fileHash = (file: string): string => sha256(readFileSync(file));
const jsonHash = (value: unknown): string =>
  sha256(`${JSON.stringify(value, null, 2)}\n`);
const packetImageHash = (packet: PairedPacket, image: string): string =>
  fileHash(path.join(ROOT, packet.phase, "blind-packet", image));

type GoldKey = {
  counts: {
    tasks: number;
    primaryCases: number;
    clearWinnerPresentations: number;
    trueTiePresentations: number;
    materialityBoundaryPresentations: number;
  };
  answers: Array<{
    taskId: string;
    primaryPairId: string;
    presentation: "primary" | "side-swapped";
    expectedChoice: "left" | "right" | "tie";
    class: "clear-winner" | "true-tie" | "materiality-boundary";
  }>;
};

const rationale = (choice: "left" | "right" | "tie") => ({
  decisiveDifferences:
    choice === "tie"
      ? []
      : ["Structure and state are the first decisive ranked difference."],
  leftDefects:
    choice === "right"
      ? ["The left candidate has the larger concrete observable defect."]
      : [],
  rightDefects:
    choice === "left"
      ? ["The right candidate has the larger concrete observable defect."]
      : [],
  tieBasis:
    choice === "tie"
      ? "The candidates are exact pixel matches within 0 px tolerance."
      : null,
});

const completeGoldEnvelope = (): GradeEnvelope => {
  const packet = json<PairedPacket>(GOLD_PACKET_PATH);
  const key = json<GoldKey>(GOLD_KEY_PATH);
  const byTask = new Map(
    key.answers.map((answer) => [answer.taskId, answer.expectedChoice]),
  );
  const envelope = json<GradeEnvelope>(
    `${ROOT}/gold/templates/rater-pair-v1-a.json`,
  );
  envelope.counts.submitted = 48;
  for (const grade of envelope.grades) {
    grade.choice = byTask.get(grade.taskId)!;
    grade.confidence = "high";
    grade.rationale = rationale(grade.choice);
  }
  validateGradeEnvelope(envelope, packet, fileHash(GOLD_PACKET_PATH));
  return envelope;
};

const qualification = (
  raterId: GradeEnvelope["raterId"],
): QualificationReceipt => {
  const packet = json<PairedPacket>(GOLD_PACKET_PATH);
  return {
    version: "paired-comparison-qualification-receipt-v1",
    raterId,
    packetHash: fileHash(GOLD_PACKET_PATH),
    randomizedBatchHash: packet.randomizedBatchHash,
    protocolCommitment: packet.protocolCommitment,
    gradeHash: "a".repeat(64),
    correct: 48,
    denominator: 48,
    score: 1,
    clearWinnersCorrect: 24,
    clearWinnersDenominator: 24,
    allClearWinnersCorrect: true,
    envelopeValid: true,
    passed: true,
  };
};

const performanceEnvelopes = (
  choose: (packet: PairedPacket, taskIndex: number) => "left" | "right" | "tie",
) => {
  const packet = json<PairedPacket>(PERFORMANCE_PACKET_PATH);
  const raters = [
    "RATER-PAIR-V1-A",
    "RATER-PAIR-V1-B",
    "RATER-PAIR-V1-C",
  ] as const;
  const qualifications = {} as Record<
    (typeof raters)[number],
    QualificationReceipt
  >;
  const envelopes = raters.map((rater) => {
    const receipt = qualification(rater);
    qualifications[rater] = receipt;
    const envelope = json<GradeEnvelope>(
      `${ROOT}/performance/templates/${rater.toLowerCase()}.json`,
    );
    envelope.calibrationReceipt = {
      path: `${ROOT}/gold/receipts/${rater.toLowerCase()}.json`,
      sha256: jsonHash(receipt),
      score: 1,
      allClearWinnersCorrect: true,
      passed: true,
    };
    envelope.counts.submitted = 256;
    for (const [index, grade] of envelope.grades.entries()) {
      grade.choice = choose(packet, index);
      grade.confidence = "high";
      grade.rationale = rationale(grade.choice);
    }
    return envelope;
  });
  return { packet, envelopes, qualifications };
};

const chooseCanonicalCandidate = (
  packet: PairedPacket,
  taskIndex: number,
): "left" | "right" => {
  const task = packet.tasks[taskIndex]!;
  return packetImageHash(packet, task.left.image) <
    packetImageHash(packet, task.right.image)
    ? "left"
    : "right";
};

const syntheticPerformanceKey = (packet: PairedPacket) => {
  const groups = new Map<string, number[]>();
  for (const [index, task] of packet.tasks.entries()) {
    const signature = [
      packetImageHash(packet, task.reference.image),
      ...[
        packetImageHash(packet, task.left.image),
        packetImageHash(packet, task.right.image),
      ].sort(),
    ].join("\0");
    const indexes = groups.get(signature) ?? [];
    indexes.push(index);
    groups.set(signature, indexes);
  }
  let cell = 0;
  const rows: any[] = [];
  for (const indexes of groups.values()) {
    assert.equal(indexes.length, 2);
    const primary = indexes[0]!;
    for (const index of indexes) {
      const task = packet.tasks[index]!;
      const leftIsCanonical =
        packetImageHash(packet, task.left.image) <
        packetImageHash(packet, task.right.image);
      rows.push({
        taskId: task.taskId,
        primaryPairId: `synthetic-pair-${cell}`,
        presentation: index === primary ? "primary" : "side-swapped",
        cellKey: `synthetic-cell-${cell}`,
        source: cell % 2 === 0 ? "source-a" : "source-b",
        axes: {
          Size: cell % 2 === 0 ? "small" : "medium",
          State: ["default", "focus-visible", "error", "disabled"][cell % 4],
          Content: cell % 2 === 0 ? "placeholder" : "value",
          Required: cell % 2 === 0 ? "false" : "true",
          Adornments: cell % 2 === 0 ? "none" : "both",
        },
        left: {
          candidateId: task.left.candidateId,
          identity: leftIsCanonical ? "recipe" : "legacy",
        },
        right: {
          candidateId: task.right.candidateId,
          identity: leftIsCanonical ? "legacy" : "recipe",
        },
      });
    }
    cell += 1;
  }
  return {
    version: "input-field-paired-performance-key-v1" as const,
    revealOnlyAfterReliabilityPasses: true as const,
    randomizedBatchHash: packet.randomizedBatchHash,
    rows,
  };
};

test("committed paired instrument keeps performance sealed after qualification", () => {
  assert.doesNotThrow(() => validateCommittedPairedComparisonInstrument());
  const receipt = json<any>(RECEIPT_PATH);
  const absoluteGate = json<any>(ABSOLUTE_GATE_PATH);
  assert.equal(
    receipt.status,
    "qualification-incomplete-performance-not-commissioned-key-sealed",
  );
  assert.equal(receipt.performance.key.parsedForResult, false);
  assert.equal(receipt.qualification.allPassed, false);
  assert.equal(receipt.qualification.performanceCommissioned, false);
  assert.equal(receipt.qualification.performancePromptsIssued, false);
  assert.equal(receipt.qualification.performanceGraded, false);
  assert.deepEqual(receipt.qualification.qualifiedRaters, []);
  assert.deepEqual(receipt.qualification.failedRaters, [
    "RATER-PAIR-V1-A",
    "RATER-PAIR-V1-B",
    "RATER-PAIR-V1-C",
  ]);
  assert.equal(receipt.qualification.replacementProtocol.required, true);
  assert.equal(receipt.preservation.historicalRootsModified, false);
  assert.equal(receipt.preservation.snapshots.length, 5);
  assert.equal(absoluteGate.passed, false);
  assert.equal(
    absoluteGate.checks.geometryAndToleranceToIndependentReference.status,
    "not-evidenced",
  );
  assert.equal(absoluteGate.checks.semanticAndAria.status, "passed");
  assert.equal(absoluteGate.liveWorkAuthorized, false);
});

test("qualification receipts are deterministic, class-scored, and tamper-gated", () => {
  assert.doesNotThrow(() => validateQualificationAdjudication());
  const expected = {
    "RATER-PAIR-V1-A": {
      correct: 44,
      clear: 24,
      tie: 12,
      materiality: 8,
      sideSwapAccuracy: 22,
      sideSwapConsistency: 24,
    },
    "RATER-PAIR-V1-B": {
      correct: 42,
      clear: 21,
      tie: 12,
      materiality: 9,
      sideSwapAccuracy: 21,
      sideSwapConsistency: 22,
    },
    "RATER-PAIR-V1-C": {
      correct: 41,
      clear: 21,
      tie: 12,
      materiality: 8,
      sideSwapAccuracy: 20,
      sideSwapConsistency: 23,
    },
  } as const;
  for (const [rater, metrics] of Object.entries(expected)) {
    const receipt = json<any>(
      `${ROOT}/gold/receipts/${rater.toLowerCase()}.json`,
    );
    assert.equal(receipt.correct, metrics.correct);
    assert.equal(receipt.clearWinnersCorrect, metrics.clear);
    assert.equal(receipt.scoreBreakdown.trueTie.correct, metrics.tie);
    assert.equal(
      receipt.scoreBreakdown.materialityBoundary.correct,
      metrics.materiality,
    );
    assert.equal(
      receipt.sideSwapCalibration.accuracy.correct,
      metrics.sideSwapAccuracy,
    );
    assert.equal(
      receipt.sideSwapCalibration.consistency.correct,
      metrics.sideSwapConsistency,
    );
    assert.equal(receipt.envelopeValid, true);
    assert.equal(receipt.passed, false);
    assert.equal(receipt.performanceBinding.commissioned, false);
    assert.equal(receipt.accessControl.performancePacketOpened, false);
    assert.equal(receipt.accessControl.performanceAnswerKeyOpened, false);
    assert.equal(receipt.accessControl.performanceResultsOpened, false);
    for (const hash of Object.values(receipt.hashes))
      assert.match(hash as string, /^[a-f0-9]{64}$/);
  }
  const tampered = json<QualificationReceipt>(
    `${ROOT}/gold/receipts/rater-pair-v1-a.json`,
  );
  tampered.gradeHash = "0".repeat(64);
  assert.throws(
    () =>
      validateQualificationAdjudication({
        "RATER-PAIR-V1-A": tampered,
      }),
    /qualification receipt is stale or tampered/,
  );
});

test("GOLD is objective, balanced, side-swapped, and separate from target Input", () => {
  const packet = json<PairedPacket>(GOLD_PACKET_PATH);
  const key = json<GoldKey>(GOLD_KEY_PATH);
  assert.deepEqual(packet.counts, {
    tasks: 48,
    primaryTasks: 24,
    sideSwappedHiddenDuplicates: 24,
  });
  assert.deepEqual(key.counts, {
    tasks: 48,
    primaryCases: 24,
    clearWinnerPresentations: 24,
    trueTiePresentations: 12,
    materialityBoundaryPresentations: 12,
  });
  assert.equal(
    key.answers.filter((row) => row.expectedChoice === "left").length,
    18,
  );
  assert.equal(
    key.answers.filter((row) => row.expectedChoice === "right").length,
    18,
  );
  assert.equal(
    key.answers.filter((row) => row.expectedChoice === "tie").length,
    12,
  );
  assert.equal(new Set(key.answers.map((row) => row.primaryPairId)).size, 24);
  assert.doesNotMatch(
    JSON.stringify(packet.tasks),
    /legacy|recipe|mui|polaris/i,
  );
  assert.equal(
    readdirSync(path.join(ROOT, "gold/blind-packet/images")).length,
    48 * 3,
  );
  assert.equal(
    readdirSync(path.join(ROOT, "performance/blind-packet/images")).length,
    256 * 3,
  );
});

test("schema and templates bind exact IDs but remain invalid until filled", () => {
  const schema = json<any>(SCHEMA_PATH);
  const packet = json<PairedPacket>(PERFORMANCE_PACKET_PATH);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.properties.grades.items.properties.choice.enum, [
    "left",
    "right",
    "tie",
  ]);
  assert.equal(packet.tasks.length, 256);
  for (const rater of ["a", "b", "c"]) {
    const template = json<GradeEnvelope>(
      `${ROOT}/performance/templates/rater-pair-v1-${rater}.json`,
    );
    assert.equal(template.counts.expected, 256);
    assert.equal(template.counts.submitted, null);
    assert.equal(template.grades.length, 256);
    assert.equal(
      template.grades.every((grade) => grade.choice === null),
      true,
    );
  }
});

test("preflight rejects tampering, side leaks, non-concrete choices, and invalid ties", () => {
  const packet = json<PairedPacket>(GOLD_PACKET_PATH);
  const valid = completeGoldEnvelope();
  const changedId = structuredClone(valid);
  changedId.grades[0]!.leftCandidateId = "candidate-" + "0".repeat(24);
  assert.throws(
    () => validateGradeEnvelope(changedId, packet, fileHash(GOLD_PACKET_PATH)),
    /IDs, choice, confidence, or rationale differ/,
  );

  const leaked = structuredClone(valid);
  leaked.grades[0]!.rationale.decisiveDifferences = [
    "The legacy implementation is visibly different here.",
  ];
  assert.throws(
    () => validateGradeEnvelope(leaked, packet, fileHash(GOLD_PACKET_PATH)),
    /rationale differ/,
  );

  const invalidTie = structuredClone(valid);
  invalidTie.grades[0]!.choice = "tie";
  invalidTie.grades[0]!.rationale = {
    decisiveDifferences: [],
    leftDefects: [],
    rightDefects: [],
    tieBasis: "They seem about the same.",
  };
  assert.throws(
    () => validateGradeEnvelope(invalidTie, packet, fileHash(GOLD_PACKET_PATH)),
    /invalid tie/,
  );

  const bothFailEvasion = structuredClone(valid);
  bothFailEvasion.grades[0]!.choice = "left";
  bothFailEvasion.grades[0]!.rationale = {
    decisiveDifferences: [],
    leftDefects: [],
    rightDefects: [],
    tieBasis: null,
  };
  assert.throws(
    () =>
      validateGradeEnvelope(
        bothFailEvasion,
        packet,
        fileHash(GOLD_PACKET_PATH),
      ),
    /non-tie lacks a decisive difference or losing defect/,
  );
});

test("failed GOLD calibration cannot qualify a performance rater", () => {
  const packet = json<PairedPacket>(GOLD_PACKET_PATH);
  const key = json<any>(GOLD_KEY_PATH);
  const grade = completeGoldEnvelope();
  const clearIndexes = key.answers
    .map((answer: any, index: number) =>
      answer.class === "clear-winner" ? index : -1,
    )
    .filter((index: number) => index >= 0)
    .slice(0, 3);
  for (const index of clearIndexes) {
    const row = grade.grades[index]!;
    row.choice = row.choice === "left" ? "right" : "left";
    row.rationale = rationale(row.choice);
  }
  const receipt = scoreGoldEnvelope(
    grade,
    packet,
    key,
    fileHash(GOLD_PACKET_PATH),
    "b".repeat(64),
  );
  assert.equal(receipt.score, 45 / 48);
  assert.equal(receipt.allClearWinnersCorrect, false);
  assert.equal(receipt.passed, false);
});

test("failed side-swap reliability never invokes the performance key", () => {
  const { packet, envelopes, qualifications } = performanceEnvelopes(
    () => "left",
  );
  let unsealed = false;
  const result = adjudicateRelativePerformance(
    packet,
    envelopes,
    () => {
      unsealed = true;
      throw new Error("key must remain sealed");
    },
    qualifications,
  );
  assert.equal(result.reliability.passed, false);
  assert.equal(result.performanceKeyUnsealed, false);
  assert.equal(result.relativeResult, null);
  assert.equal(unsealed, false);
});

test("reliable paired grades unseal once and count only 128 primary cells", () => {
  const { packet, envelopes, qualifications } = performanceEnvelopes(
    chooseCanonicalCandidate,
  );
  const reliability = evaluatePerformanceReliability(
    packet,
    envelopes,
    qualifications,
  );
  assert.equal(reliability.passed, true);
  assert.equal(reliability.fleissKappa, 1);
  assert.equal(reliability.primaryDenominator, 128);
  assert.equal(reliability.tasksWithMajoritySupport, 256);
  assert.equal(
    Object.values(reliability.sideSwap).every((metric) => metric.ratio === 1),
    true,
  );

  let unsealCount = 0;
  const key = syntheticPerformanceKey(packet);
  const result = adjudicateRelativePerformance(
    packet,
    envelopes,
    () => {
      unsealCount += 1;
      return key;
    },
    qualifications,
  );
  assert.equal(unsealCount, 1);
  assert.equal(result.performanceKeyUnsealed, true);
  assert.deepEqual(result.relativeResult?.total, {
    recipeWins: 128,
    legacyWins: 0,
    ties: 0,
    denominator: 128,
  });
  assert.equal(
    result.relativeResult?.duplicateVotesExcludedFromFinalArithmetic,
    true,
  );
  assert.equal(result.relativeResult?.absoluteRecognisabilityInferred, false);
  assert.equal(result.relativeResult?.inputSuccessAuthorized, false);
  assert.equal(result.relativeResult?.liveWorkAuthorized, false);
});

test("locked protocol explains prevalence failure without changing old criteria", () => {
  const protocol = json<any>(PROTOCOL_PATH);
  assert.match(
    protocol.measurementFailureDiagnosis.diagnosis,
    /Extreme fail prevalence raised chance agreement, depressing kappa/,
  );
  assert.equal(
    protocol.measurementFailureDiagnosis.immutableFailedRounds[1]
      .overallRawPairwiseAgreement,
    0.956597222222222,
  );
  assert.equal(protocol.reliability.fleissKappaMinimum, 0.6);
  assert.equal(protocol.performance.totalTasks, 256);
  assert.equal(
    protocol.performance.duplicateVotesExcludedFromFinalArithmetic,
    true,
  );
});
