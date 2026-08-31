import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  GOLD_PACKET_PATH,
  GRADE_SCHEMA_PATH,
  PROTOCOL_PATH,
  RECEIPT_PATH,
  ROOT,
  validateGradeEnvelope,
  validatePacketDocument,
  validateProtocol,
  type GradeEnvelope,
} from "./input-field-comparison-calibration-v2.js";

const REPO = path.resolve(new URL(".", import.meta.url).pathname, "..");
const GOLD_KEY_PATH = `${ROOT}/gold/sealed-answer-key.json`;
const INDEX_PATH = `${ROOT}/index.json`;
const MINIMUM_SCORE = 0.95;
const REQUIRED_OBVIOUS_SCORE = 1;
const REQUIRED_QUALIFIED_RATERS = 3;

const RATERS = [
  {
    graderId: "RATER-CAL-V2-A",
    slug: "rater-cal-v2-a",
  },
  {
    graderId: "RATER-CAL-V2-B",
    slug: "rater-cal-v2-b",
  },
  {
    graderId: "RATER-CAL-V2-C",
    slug: "rater-cal-v2-c",
  },
] as const;

type Rater = (typeof RATERS)[number];

interface GoldAnswer {
  taskId: string;
  referenceId: string;
  specimenId: string;
  expectedRecognisable: boolean;
  obviousStructuralOrStateFailure: boolean;
  class: "exact-pass" | "controlled-minor-pass" | "obvious-fail";
  rationale: string;
  referenceHash: string;
  specimenHash: string;
}

interface GoldKey {
  version: "opaque-gold-answer-key-v1";
  revealOnlyAfterValidGoldSubmission: true;
  neverUsedForPerformanceScoring: true;
  calibrationCommitment: string;
  randomizedBatchHash: string;
  counts: {
    cases: 24;
    exactOrSemanticPasses: 8;
    controlledMinorPasses: 4;
    obviousStructuralOrStateFailures: 12;
  };
  answers: GoldAnswer[];
}

interface CalibrationError {
  taskId: string;
  submittedRecognisable: boolean;
  expectedRecognisable: boolean;
  obviousStructuralOrStateFailure: boolean;
  rationale: string;
}

export interface QualificationReceipt {
  version: "rater-calibration-receipt-v2";
  adjudication: "independent-objective-gold-qualification";
  graderId: string;
  submissionPath: string;
  submissionHash: string;
  gradeHash: string;
  goldAnswerKeyPath: typeof GOLD_KEY_PATH;
  goldAnswerKeyHash: string;
  protocolPath: typeof PROTOCOL_PATH;
  protocolHash: string;
  gradeSchemaPath: typeof GRADE_SCHEMA_PATH;
  gradeSchemaHash: string;
  templatePath: string;
  templateHash: string;
  calibrationCommitment: string;
  packetHash: string;
  randomizedBatchHash: string;
  counts: {
    expected: 24;
    submitted: 24;
    correct: number;
    incorrect: number;
    obviousStructuralStateFailures: 12;
    obviousStructuralStateFailuresCorrect: number;
    errors: number;
  };
  errors: CalibrationError[];
  score: number;
  correct: number;
  denominator: 24;
  obviousStructuralStateFailuresCorrect: number;
  obviousStructuralStateFailuresDenominator: 12;
  obviousFailureScore: number;
  obviousStructuralStateFailureScore: number;
  envelopeValid: true;
  thresholds: {
    minimumScore: 0.95;
    obviousFailureScoreRequired: 1;
    envelopeValidRequired: true;
  };
  passed: boolean;
  performanceEligibility: boolean;
  performanceBinding: {
    receiptPath: string;
    score: number;
    obviousStructuralStateFailureScore: number;
    passed: boolean;
  };
  performanceAccessed: false;
  performanceIdentityRevealed: false;
  signature: {
    algorithm: "sha256";
    signedPayloadHash: string;
  };
}

const absolute = (file: string): string => path.join(REPO, file);
const sha256 = (value: string | Buffer): string =>
  createHash("sha256").update(value).digest("hex");
const fileHash = (file: string): string => sha256(readFileSync(absolute(file)));
const parse = <T>(file: string): T =>
  JSON.parse(readFileSync(absolute(file), "utf8")) as T;
const jsonBytes = (value: unknown): string =>
  `${JSON.stringify(value, null, 2)}\n`;
const writeJson = (file: string, value: unknown): void => {
  mkdirSync(path.dirname(absolute(file)), { recursive: true });
  writeFileSync(absolute(file), jsonBytes(value));
};
const check: (condition: unknown, message: string) => asserts condition = (
  condition,
  message,
) => {
  if (!condition) throw new Error(`QUALIFICATION REFUSED: ${message}`);
};
const exactKeys = (
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void =>
  check(
    JSON.stringify(Object.keys(value).sort()) ===
      JSON.stringify([...expected].sort()),
    `${label} fields differ`,
  );

const submissionPath = (rater: Rater): string =>
  `${ROOT}/gold/submissions/${rater.slug}.json`;
const templatePath = (rater: Rater): string =>
  `${ROOT}/gold/blind-packet/templates/${rater.slug}.json`;
const receiptPath = (rater: Rater): string =>
  `${ROOT}/gold/receipts/${rater.slug}.json`;

const assertRegularFile = (file: string): void => {
  check(existsSync(absolute(file)), `${file} is absent`);
  const stat = lstatSync(absolute(file));
  check(
    stat.isFile() && !stat.isSymbolicLink(),
    `${file} is not a regular file`,
  );
};

const signedPayload = (
  receipt: Omit<QualificationReceipt, "signature">,
): string => sha256(JSON.stringify(receipt));

const validateGoldKey = (key: GoldKey, packet: any, topReceipt: any): void => {
  exactKeys(
    key as unknown as Record<string, unknown>,
    [
      "version",
      "revealOnlyAfterValidGoldSubmission",
      "neverUsedForPerformanceScoring",
      "calibrationCommitment",
      "randomizedBatchHash",
      "generation",
      "counts",
      "answers",
    ],
    "gold answer key",
  );
  check(
    key.version === "opaque-gold-answer-key-v1" &&
      key.revealOnlyAfterValidGoldSubmission &&
      key.neverUsedForPerformanceScoring &&
      key.calibrationCommitment === packet.calibrationCommitment &&
      key.randomizedBatchHash === packet.randomizedBatchHash &&
      key.counts.cases === 24 &&
      key.counts.exactOrSemanticPasses === 8 &&
      key.counts.controlledMinorPasses === 4 &&
      key.counts.obviousStructuralOrStateFailures === 12 &&
      key.answers.length === 24 &&
      key.answers.filter((answer) => answer.expectedRecognisable).length ===
        12 &&
      key.answers.filter((answer) => answer.obviousStructuralOrStateFailure)
        .length === 12,
    "gold answer key binding or counts differ",
  );
  check(
    JSON.stringify(
      key.answers.map((answer) => [
        answer.taskId,
        answer.referenceId,
        answer.specimenId,
      ]),
    ) ===
      JSON.stringify(
        packet.tasks.map((task: any) => [
          task.taskId,
          task.reference.referenceId,
          task.specimen.specimenId,
        ]),
      ),
    "gold answer key ordered IDs differ from packet",
  );
  check(
    fileHash(GOLD_KEY_PATH) === topReceipt.gold.sealedAnswerKeyHash,
    "gold answer key hash differs from locked receipt",
  );
};

const validateQualificationInputs = (): {
  protocol: any;
  packet: any;
  key: GoldKey;
  topReceipt: any;
  index: any;
} => {
  for (const file of [
    PROTOCOL_PATH,
    GRADE_SCHEMA_PATH,
    GOLD_PACKET_PATH,
    GOLD_KEY_PATH,
    RECEIPT_PATH,
    INDEX_PATH,
  ])
    assertRegularFile(file);
  const protocol = parse<any>(PROTOCOL_PATH);
  const packet = parse<any>(GOLD_PACKET_PATH);
  const key = parse<GoldKey>(GOLD_KEY_PATH);
  const topReceipt = parse<any>(RECEIPT_PATH);
  const index = parse<any>(INDEX_PATH);
  validateProtocol(protocol);
  validatePacketDocument(packet, "gold-calibration", 24, protocol);
  check(
    fileHash(PROTOCOL_PATH) === topReceipt.commitment.protocolHash &&
      fileHash(PROTOCOL_PATH) === index.protocolHash &&
      fileHash(RECEIPT_PATH) === index.receiptHash &&
      fileHash(GRADE_SCHEMA_PATH) === topReceipt.commitment.gradeSchemaHash &&
      fileHash(GRADE_SCHEMA_PATH) === index.gradeSchemaHash &&
      fileHash(GOLD_PACKET_PATH) === topReceipt.gold.packetHash &&
      fileHash(GOLD_PACKET_PATH) === index.goldPacketHash &&
      protocol.commitment === topReceipt.commitment.calibrationCommitment &&
      protocol.phases.goldCalibration.minimumScore === MINIMUM_SCORE &&
      protocol.phases.goldCalibration.obviousFailureScoreRequired ===
        REQUIRED_OBVIOUS_SCORE &&
      protocol.reliability.validEnvelopeRequired === true &&
      topReceipt.status.performancePacket === "sealed-ungraded" &&
      topReceipt.performance.answerKeyParsedForPerformanceResult === false &&
      topReceipt.performance.performanceIdentitiesRevealed === false &&
      topReceipt.performance.gradeWritten === false &&
      index.performanceGraded === false &&
      index.performanceUnsealed === false,
    "protocol, schema, packet, thresholds, or sealed performance status differs",
  );
  validateGoldKey(key, packet, topReceipt);
  return { protocol, packet, key, topReceipt, index };
};

const scoreRater = (
  rater: Rater,
  packet: any,
  key: GoldKey,
  topReceipt: any,
): QualificationReceipt => {
  const submission = submissionPath(rater);
  const template = templatePath(rater);
  assertRegularFile(submission);
  assertRegularFile(template);
  check(
    fileHash(template) === topReceipt.gold.templateHashes[rater.graderId],
    `${rater.graderId} gold template hash differs`,
  );
  const envelope = parse<GradeEnvelope>(submission);
  validateGradeEnvelope(
    envelope,
    packet,
    fileHash(GOLD_PACKET_PATH),
    rater.graderId,
  );
  const answers = new Map(key.answers.map((answer) => [answer.taskId, answer]));
  const errors: CalibrationError[] = [];
  let correct = 0;
  let obviousCorrect = 0;
  for (const grade of envelope.orderedGrades) {
    const answer = answers.get(grade.taskId);
    check(answer, `${grade.taskId} has no ordered gold answer`);
    if (grade.recognisable === answer.expectedRecognisable) correct += 1;
    else
      errors.push({
        taskId: grade.taskId,
        submittedRecognisable: grade.recognisable,
        expectedRecognisable: answer.expectedRecognisable,
        obviousStructuralOrStateFailure: answer.obviousStructuralOrStateFailure,
        rationale: answer.rationale,
      });
    if (answer.obviousStructuralOrStateFailure && !grade.recognisable)
      obviousCorrect += 1;
  }
  const score = correct / 24;
  const obviousFailureScore = obviousCorrect / 12;
  const passed =
    score >= MINIMUM_SCORE && obviousFailureScore === REQUIRED_OBVIOUS_SCORE;
  const submissionHash = fileHash(submission);
  const output = receiptPath(rater);
  const body: Omit<QualificationReceipt, "signature"> = {
    version: "rater-calibration-receipt-v2",
    adjudication: "independent-objective-gold-qualification",
    graderId: envelope.graderId,
    submissionPath: submission,
    submissionHash,
    gradeHash: submissionHash,
    goldAnswerKeyPath: GOLD_KEY_PATH,
    goldAnswerKeyHash: fileHash(GOLD_KEY_PATH),
    protocolPath: PROTOCOL_PATH,
    protocolHash: fileHash(PROTOCOL_PATH),
    gradeSchemaPath: GRADE_SCHEMA_PATH,
    gradeSchemaHash: fileHash(GRADE_SCHEMA_PATH),
    templatePath: template,
    templateHash: fileHash(template),
    calibrationCommitment: envelope.calibrationCommitment,
    packetHash: envelope.packetHash,
    randomizedBatchHash: envelope.randomizedBatchHash,
    counts: {
      expected: 24,
      submitted: envelope.orderedGrades.length as 24,
      correct,
      incorrect: 24 - correct,
      obviousStructuralStateFailures: 12,
      obviousStructuralStateFailuresCorrect: obviousCorrect,
      errors: errors.length,
    },
    errors,
    score,
    correct,
    denominator: 24,
    obviousStructuralStateFailuresCorrect: obviousCorrect,
    obviousStructuralStateFailuresDenominator: 12,
    obviousFailureScore,
    obviousStructuralStateFailureScore: obviousFailureScore,
    envelopeValid: true,
    thresholds: {
      minimumScore: 0.95,
      obviousFailureScoreRequired: 1,
      envelopeValidRequired: true,
    },
    passed,
    performanceEligibility: passed,
    performanceBinding: {
      receiptPath: output,
      score,
      obviousStructuralStateFailureScore: obviousFailureScore,
      passed,
    },
    performanceAccessed: false,
    performanceIdentityRevealed: false,
  };
  return {
    ...body,
    signature: {
      algorithm: "sha256",
      signedPayloadHash: signedPayload(body),
    },
  };
};

export const validateQualificationReceipt = (
  receipt: QualificationReceipt,
  expectedSubmissionHash?: string,
  expectedReceiptHash?: string,
): void => {
  const { signature, ...body } = receipt;
  check(
    signature.algorithm === "sha256" &&
      signature.signedPayloadHash === signedPayload(body),
    "calibration receipt signature differs",
  );
  check(
    !expectedSubmissionHash ||
      (receipt.submissionHash === expectedSubmissionHash &&
        receipt.gradeHash === expectedSubmissionHash),
    "calibration receipt submission hash differs",
  );
  check(
    !expectedReceiptHash || sha256(jsonBytes(receipt)) === expectedReceiptHash,
    "calibration receipt pin differs",
  );
  check(
    receipt.counts.expected === 24 &&
      receipt.counts.submitted === 24 &&
      receipt.denominator === 24 &&
      receipt.counts.correct === receipt.correct &&
      receipt.counts.incorrect === 24 - receipt.correct &&
      receipt.counts.errors === receipt.errors.length &&
      receipt.score === receipt.correct / receipt.denominator &&
      receipt.counts.obviousStructuralStateFailures === 12 &&
      receipt.obviousStructuralStateFailuresDenominator === 12 &&
      receipt.counts.obviousStructuralStateFailuresCorrect ===
        receipt.obviousStructuralStateFailuresCorrect &&
      receipt.obviousFailureScore ===
        receipt.obviousStructuralStateFailuresCorrect / 12 &&
      receipt.obviousStructuralStateFailureScore ===
        receipt.obviousFailureScore,
    "calibration receipt score arithmetic differs",
  );
  const expectedPass =
    receipt.envelopeValid &&
    receipt.score >= MINIMUM_SCORE &&
    receipt.obviousFailureScore === REQUIRED_OBVIOUS_SCORE;
  check(
    receipt.passed === expectedPass &&
      receipt.performanceEligibility === expectedPass &&
      receipt.performanceBinding.score === receipt.score &&
      receipt.performanceBinding.obviousStructuralStateFailureScore ===
        receipt.obviousFailureScore &&
      receipt.performanceBinding.passed === expectedPass &&
      receipt.performanceAccessed === false &&
      receipt.performanceIdentityRevealed === false,
    "calibration thresholds, performance binding, or access status differs",
  );
};

export const assertPerformanceAccessAllowed = (
  receipt: QualificationReceipt,
): void => {
  const rater = RATERS.find((entry) => entry.graderId === receipt.graderId);
  check(rater, "performance receipt grader is not assigned");
  const topReceipt = parse<any>(RECEIPT_PATH);
  const pin = topReceipt.gold.qualification?.receipts?.[rater.graderId];
  check(
    pin?.path === receiptPath(rater),
    "performance receipt path is not qualification-pinned",
  );
  validateQualificationReceipt(
    receipt,
    fileHash(submissionPath(rater)),
    pin.sha256,
  );
  check(
    receipt.passed &&
      receipt.performanceEligibility &&
      receipt.envelopeValid &&
      receipt.score >= MINIMUM_SCORE &&
      receipt.obviousFailureScore === REQUIRED_OBVIOUS_SCORE &&
      topReceipt.gold.qualification.status === "passed" &&
      topReceipt.gold.qualification.qualifiedCount ===
        REQUIRED_QUALIFIED_RATERS &&
      topReceipt.gold.qualification.performanceCommissioned === true,
    "performance access attempted before calibration pass",
  );
};

export function adjudicateGoldQualification(): QualificationReceipt[] {
  const { packet, key, topReceipt, index } = validateQualificationInputs();
  const receipts = RATERS.map((rater) =>
    scoreRater(rater, packet, key, topReceipt),
  );
  for (const [position, receipt] of receipts.entries()) {
    const rater = RATERS[position]!;
    validateQualificationReceipt(receipt, fileHash(submissionPath(rater)));
  }
  for (const [position, receipt] of receipts.entries())
    writeJson(receiptPath(RATERS[position]!), receipt);

  const receiptPins = Object.fromEntries(
    RATERS.map((rater) => [
      rater.graderId,
      {
        path: receiptPath(rater),
        sha256: fileHash(receiptPath(rater)),
      },
    ]),
  );
  const qualified = receipts.filter((receipt) => receipt.passed);
  const qualifiedIds = qualified.map((receipt) => receipt.graderId);
  const cohortReady = qualified.length === REQUIRED_QUALIFIED_RATERS;
  topReceipt.status.goldPacket = "qualification-adjudicated";
  topReceipt.status.recognisabilityInstrument = cohortReady
    ? "qualified-three-rater-cohort-performance-not-commissioned"
    : "blocked-insufficient-qualified-raters";
  topReceipt.gold.qualification = {
    status: cohortReady ? "passed" : "insufficient-qualified-raters",
    submissionsAdjudicated: receipts.length,
    qualifiedRaters: qualifiedIds,
    qualifiedCount: qualified.length,
    calibratedValidRatersRequired: REQUIRED_QUALIFIED_RATERS,
    replacementRatersRequired: Math.max(
      0,
      REQUIRED_QUALIFIED_RATERS - qualified.length,
    ),
    performanceCommissioned: false,
    performanceRemainsSealedAndUngraded: true,
    receipts: receiptPins,
  };
  topReceipt.raters = topReceipt.raters.map((entry: any) => {
    const result = receipts.find(
      (receipt) => receipt.graderId === entry.graderId,
    )!;
    return {
      ...entry,
      status: result.passed
        ? "qualified-waiting-for-complete-cohort"
        : "calibration-failed-replacement-required",
      qualification: {
        receipt: receiptPins[entry.graderId],
        score: result.score,
        obviousFailureScore: result.obviousFailureScore,
        envelopeValid: result.envelopeValid,
        passed: result.passed,
      },
    };
  });
  check(
    topReceipt.status.performancePacket === "sealed-ungraded" &&
      topReceipt.performance.answerKeyParsedForPerformanceResult === false &&
      topReceipt.performance.performanceIdentitiesRevealed === false &&
      topReceipt.performance.gradeWritten === false,
    "qualification attempted to change sealed performance state",
  );
  writeJson(RECEIPT_PATH, topReceipt);
  index.status = cohortReady
    ? "qualification-passed-performance-sealed-live-input-blocked"
    : "qualification-incomplete-performance-sealed-live-input-blocked";
  index.receiptHash = fileHash(RECEIPT_PATH);
  index.recognisabilityInstrumentUsable = false;
  index.performanceGraded = false;
  index.performanceUnsealed = false;
  index.liveInputMayProceed = false;
  writeJson(INDEX_PATH, index);
  return receipts;
}

const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const receipts = adjudicateGoldQualification();
  for (const receipt of receipts)
    console.log(
      `${receipt.graderId}: ${receipt.passed ? "QUALIFIED" : "NOT QUALIFIED"}; ${receipt.correct}/24; obvious ${receipt.obviousStructuralStateFailuresCorrect}/12`,
    );
  console.log(
    `${receipts.filter((receipt) => receipt.passed).length}/3 qualified; performance remains sealed and ungraded`,
  );
}
