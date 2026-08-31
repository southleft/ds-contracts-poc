import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { format } from "prettier";

import {
  validateCommittedCalibrationV2,
  type GradeEnvelope,
  type OrderedGrade,
} from "./input-field-comparison-calibration-v2.js";
import {
  validateQualificationReceipt,
  type QualificationReceipt,
} from "./input-field-comparison-calibration-v2-qualification.js";

const REPO = path.resolve(new URL(".", import.meta.url).pathname, "..");
const V2_ROOT = "recipe/evidence/input-field-comparison-calibration-v2";
export const ROOT =
  "recipe/evidence/input-field-comparison-calibration-v3-replacement";
const NEXT_ROOT =
  "recipe/evidence/.input-field-comparison-calibration-v3-replacement-next";

export const PROTOCOL_PATH = `${ROOT}/protocol.json`;
export const RECEIPT_PATH = `${ROOT}/receipt.json`;
export const INDEX_PATH = `${ROOT}/index.json`;
export const D_GOLD_TEMPLATE_PATH = `${ROOT}/gold/templates/rater-cal-v3-d.json`;
export const D_GOLD_OUTPUT_PATH = `${ROOT}/gold/submissions/rater-cal-v3-d.json`;
export const D_QUALIFICATION_RECEIPT_PATH = `${ROOT}/gold/receipts/rater-cal-v3-d.json`;

const V2_PROTOCOL_PATH = `${V2_ROOT}/protocol.json`;
const V2_SCHEMA_PATH = `${V2_ROOT}/grade.schema.json`;
const V2_RECEIPT_PATH = `${V2_ROOT}/receipt.json`;
const V2_INDEX_PATH = `${V2_ROOT}/index.json`;
const GOLD_PACKET_PATH = `${V2_ROOT}/gold/blind-packet/packet.json`;
const GOLD_KEY_PATH = `${V2_ROOT}/gold/sealed-answer-key.json`;
const PERFORMANCE_PACKET_PATH = `${V2_ROOT}/performance/blind-packet/packet.json`;
const PERFORMANCE_KEY_PATH = `${V2_ROOT}/performance/sealed-answer-key.json`;

const VERSION = "input-field-recognisability-replacement-rater-v3";
const REPLACEMENT_COMMITMENT_VERSION = "input-field-replacement-commitment-v1";
const GOLD_PROTOCOL = "recognisability-gold-calibration-v1";
const PERFORMANCE_PROTOCOL = "input-field-performance-blind-v3";
const SCHEMA_VERSION = "recognisability-grade-envelope-v2";
const RUBRIC_VERSION = "input-field-observable-rubric-v2";
const D_RATER = "RATER-CAL-V3-D";
const IMPORTED_RATERS = ["RATER-CAL-V2-B", "RATER-CAL-V2-C"] as const;
const PERFORMANCE_RATERS = [...IMPORTED_RATERS, D_RATER] as const;
const CATEGORIES = [
  "required-structure-content",
  "semantic-state",
  "geometry-proportion",
  "typography-raster",
  "color-border-effects",
] as const;
const MINIMUM_SCORE = 0.95;
const OBVIOUS_FAILURE_SCORE_REQUIRED = 1;
const IDENTITY_LEAK =
  /\blegacy\b|\brecipe\b|\bcorrected\b|\bduplicate\b|\bcopy[- _]?[ab]\b|\bimplementation\b|\bexpected[- _]?winner\b|\bmui\b|\bpolaris\b|@shopify|@mui/i;

type PerformanceRater = (typeof PERFORMANCE_RATERS)[number];
type Category = (typeof CATEGORIES)[number];
type Phase = "gold-calibration" | "performance";

interface PacketTask {
  taskId: string;
  reference: { referenceId: string; image: string };
  specimen: { specimenId: string; image: string };
}

interface BlindPacket {
  version: string;
  phase: Phase;
  status: "opaque-ungraded";
  calibrationCommitment: string;
  rubricVersion: typeof RUBRIC_VERSION;
  rubric: unknown;
  instructions: string[];
  gradeSchema: string;
  preflight: string;
  assignedTemplates: Record<string, string>;
  counts: {
    tasks: number;
    referencePresentations: number;
    specimenPresentations: number;
  };
  randomizedBatchHash: string;
  tasks: PacketTask[];
}

interface V2Protocol {
  version: string;
  lockedBeforeAnyFreshGrade: true;
  phases: {
    goldCalibration: {
      protocol: typeof GOLD_PROTOCOL;
      expectedCases: 24;
      minimumScore: 0.95;
      obviousFailureScoreRequired: 1;
    };
    performance: {
      protocol: typeof PERFORMANCE_PROTOCOL;
      remainsSealedAndUngraded: true;
    };
  };
  gradeEnvelope: {
    schemaVersion: typeof SCHEMA_VERSION;
    schemaPath: typeof V2_SCHEMA_PATH;
    requiredTopLevelFields: string[];
    exactOrderedGradesRequired: true;
    preflightReadsAnswerKeys: false;
  };
  rubric: unknown;
  reliability: ReliabilityThresholds;
  commitment: string;
  rubricHash: string;
}

interface ReliabilityThresholds {
  calibratedValidRatersRequired: 3;
  calibrationScoreMinimum: 0.95;
  obviousFailureScoreRequired: 1;
  validEnvelopeRequired: true;
  hiddenDuplicateAgreementPerRaterMinimum: 0.95;
  majorityDuplicateAgreementMinimum: 127;
  majorityDuplicateAgreementDenominator: 128;
  everyPairwiseAgreementMinimum: 0.75;
  fleissKappaMinimum: 0.6;
  maximumDuplicateCopyPassRateDelta: 0.05;
  majorityFailureConcreteDefectRatersMinimum: 2;
  failureConsequence: string;
}

interface CompatibilityFields {
  goldPacketHash: string;
  goldRandomizedBatchHash: string;
  goldPacketProtocol: typeof GOLD_PROTOCOL;
  calibrationCommitment: string;
  rubricVersion: typeof RUBRIC_VERSION;
  rubricHash: string;
  gradeSchemaVersion: typeof SCHEMA_VERSION;
  gradeSchemaHash: string;
  exactOrderedGradesRequired: true;
  preflightReadsAnswerKeys: false;
  requiredTopLevelFields: string[];
  minimumScore: 0.95;
  obviousFailureScoreRequired: 1;
  validEnvelopeRequired: true;
}

interface TreeSnapshot {
  root: typeof V2_ROOT;
  files: number;
  bytes: number;
  aggregateSha256: string;
}

interface ProtocolBody {
  version: typeof VERSION;
  commitmentVersion: typeof REPLACEMENT_COMMITMENT_VERSION;
  lockedBeforeDGrades: true;
  purpose: string;
  sourceCalibrationV2: {
    root: typeof V2_ROOT;
    protocolPath: typeof V2_PROTOCOL_PATH;
    protocolHash: string;
    gradeSchemaPath: typeof V2_SCHEMA_PATH;
    gradeSchemaHash: string;
    goldPacketPath: typeof GOLD_PACKET_PATH;
    goldPacketHash: string;
    goldAnswerKeyPath: typeof GOLD_KEY_PATH;
    goldAnswerKeyHash: string;
    compatibilityFields: CompatibilityFields;
    compatibilityFieldsHash: string;
  };
  importedQualifications: Record<
    (typeof IMPORTED_RATERS)[number],
    {
      receiptPath: string;
      receiptHash: string;
      submissionPath: string;
      submissionHash: string;
    }
  >;
  historicalOutcome: {
    excludedRater: "RATER-CAL-V2-A";
    receiptPath: string;
    receiptHash: string;
    correct: 22;
    denominator: 24;
    obviousFailuresCorrect: 11;
    obviousFailuresDenominator: 12;
    passed: false;
    relabellingForbidden: true;
  };
  roster: {
    importedQualified: typeof IMPORTED_RATERS;
    freshReplacement: typeof D_RATER;
    performanceRoster: typeof PERFORMANCE_RATERS;
  };
  importRule: {
    exactCompatibilityFieldsRequired: true;
    changedRelevantByteOrThresholdRequiresRequalification: true;
    receiptSignatureAndFileHashRequired: true;
    sourceSubmissionHashRequired: true;
    rationale: string;
  };
  replacementAuthorization: {
    beforeDGrades: true;
    dMustBeFreshIndependent: true;
    dPriorPacketAccessForbidden: true;
    dPriorGradeAccessForbidden: true;
    dMinimumScore: 0.95;
    dObviousFailuresRequired: "12/12";
    dValidEnvelopeRequired: true;
    performanceRequiresImportedBAndCPlusValidD: true;
    performanceAccessBeforeAuthorizationForbidden: true;
  };
  dEnvelopeIdentityOverlay: {
    baseSchemaPath: typeof V2_SCHEMA_PATH;
    baseSchemaHash: string;
    baseSchemaBytesChanged: false;
    onlyExtension: "graderId-is-exactly-RATER-CAL-V3-D";
    scoringFieldsOrConstraintsChanged: false;
    validatorSource: "recipe/input-field-comparison-calibration-v3.ts";
    rationale: string;
  };
  performanceContinuity: {
    packetPath: typeof PERFORMANCE_PACKET_PATH;
    packetHash: string;
    randomizedBatchHash: string;
    sealedAnswerKeyPath: typeof PERFORMANCE_KEY_PATH;
    sealedAnswerKeyHash: string;
    packetBytesChanged: false;
    randomizedIdsOrOrderChanged: false;
    sealedKeyChanged: false;
    packetCopiedOrRebuilt: false;
    remainsSealedAndUngraded: true;
  };
  reliability: ReliabilityThresholds;
  paths: {
    dGoldTemplate: typeof D_GOLD_TEMPLATE_PATH;
    dGoldOutput: typeof D_GOLD_OUTPUT_PATH;
    dQualificationReceipt: typeof D_QUALIFICATION_RECEIPT_PATH;
    performanceTemplates: Record<PerformanceRater, string>;
    performanceOutputs: Record<PerformanceRater, string>;
  };
}

interface ReplacementProtocol extends ProtocolBody {
  commitment: string;
}

interface GoldAnswer {
  taskId: string;
  referenceId: string;
  specimenId: string;
  expectedRecognisable: boolean;
  obviousStructuralOrStateFailure: boolean;
  rationale: string;
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

export interface DQualificationReceipt {
  version: "replacement-rater-calibration-receipt-v3";
  graderId: typeof D_RATER;
  sourceCompatibilityFieldsHash: string;
  sourceGoldPacketHash: string;
  sourceGoldAnswerKeyHash: string;
  sourceProtocolHash: string;
  sourceRubricHash: string;
  sourceGradeSchemaHash: string;
  replacementProtocolHash: string;
  replacementCommitment: string;
  templateHash: string;
  submissionPath: typeof D_GOLD_OUTPUT_PATH;
  submissionHash: string;
  counts: {
    expected: 24;
    submitted: 24;
    correct: number;
    obviousStructuralStateFailures: 12;
    obviousStructuralStateFailuresCorrect: number;
  };
  score: number;
  obviousFailureScore: number;
  obviousStructuralStateFailureScore: number;
  envelopeValid: true;
  passed: boolean;
  performanceEligibility: boolean;
  performanceBinding: {
    receiptPath: typeof D_QUALIFICATION_RECEIPT_PATH;
    score: number;
    obviousStructuralStateFailureScore: number;
    passed: boolean;
  };
  performanceAccessed: false;
  priorGoldPacketAccess: false;
  priorGradeAccess: false;
  errors: Array<{
    taskId: string;
    submittedRecognisable: boolean;
    expectedRecognisable: boolean;
    obviousStructuralOrStateFailure: boolean;
    rationale: string;
  }>;
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
const writeFormattedJson = async (
  file: string,
  value: unknown,
): Promise<void> => {
  mkdirSync(path.dirname(absolute(file)), { recursive: true });
  writeFileSync(
    absolute(file),
    await format(JSON.stringify(value), { parser: "json" }),
  );
};
const check: (condition: unknown, message: string) => asserts condition = (
  condition,
  message,
) => {
  if (!condition) throw new Error(`REPLACEMENT V3 REFUSED: ${message}`);
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

const performanceTemplatePath = (rater: PerformanceRater): string =>
  `${ROOT}/performance/templates/${rater.toLowerCase()}.json`;
const performanceOutputPath = (rater: PerformanceRater): string =>
  `${ROOT}/performance/submissions/${rater.toLowerCase()}.json`;
const importedReceiptPath = (rater: (typeof IMPORTED_RATERS)[number]): string =>
  `${V2_ROOT}/gold/receipts/${rater.toLowerCase()}.json`;
const importedSubmissionPath = (
  rater: (typeof IMPORTED_RATERS)[number],
): string => `${V2_ROOT}/gold/submissions/${rater.toLowerCase()}.json`;
const v2TemplatePath = (
  phase: Phase,
  rater: (typeof IMPORTED_RATERS)[number],
): string =>
  `${V2_ROOT}/${phase === "gold-calibration" ? "gold" : "performance"}/blind-packet/templates/${rater.toLowerCase()}.json`;

const walkFiles = (root: string): string[] => {
  const output: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(absolute(directory), {
      withFileTypes: true,
    }).sort((left, right) => left.name.localeCompare(right.name))) {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) visit(file);
      else {
        check(entry.isFile(), `${file} is not a regular historical artifact`);
        check(
          !lstatSync(absolute(file)).isSymbolicLink(),
          `${file} is a symlink`,
        );
        output.push(file);
      }
    }
  };
  visit(root);
  return output;
};

const treeSnapshot = (): TreeSnapshot => {
  const files = walkFiles(V2_ROOT).map((file) => ({
    file,
    bytes: statSync(absolute(file)).size,
    sha256: fileHash(file),
  }));
  return {
    root: V2_ROOT,
    files: files.length,
    bytes: files.reduce((sum, file) => sum + file.bytes, 0),
    aggregateSha256: sha256(JSON.stringify(files)),
  };
};

const performancePaths = () => ({
  templates: Object.fromEntries(
    PERFORMANCE_RATERS.map((rater) => [rater, performanceTemplatePath(rater)]),
  ) as Record<PerformanceRater, string>,
  outputs: Object.fromEntries(
    PERFORMANCE_RATERS.map((rater) => [rater, performanceOutputPath(rater)]),
  ) as Record<PerformanceRater, string>,
});

const sourceCompatibilityFields = (
  protocol: V2Protocol,
  packet: BlindPacket,
): CompatibilityFields => ({
  goldPacketHash: fileHash(GOLD_PACKET_PATH),
  goldRandomizedBatchHash: packet.randomizedBatchHash,
  goldPacketProtocol: protocol.phases.goldCalibration.protocol,
  calibrationCommitment: protocol.commitment,
  rubricVersion: RUBRIC_VERSION,
  rubricHash: protocol.rubricHash,
  gradeSchemaVersion: protocol.gradeEnvelope.schemaVersion,
  gradeSchemaHash: fileHash(V2_SCHEMA_PATH),
  exactOrderedGradesRequired: protocol.gradeEnvelope.exactOrderedGradesRequired,
  preflightReadsAnswerKeys: protocol.gradeEnvelope.preflightReadsAnswerKeys,
  requiredTopLevelFields: protocol.gradeEnvelope.requiredTopLevelFields,
  minimumScore: protocol.phases.goldCalibration.minimumScore,
  obviousFailureScoreRequired:
    protocol.phases.goldCalibration.obviousFailureScoreRequired,
  validEnvelopeRequired: protocol.reliability.validEnvelopeRequired,
});

const protocolBody = (): ProtocolBody => {
  const v2Protocol = parse<V2Protocol>(V2_PROTOCOL_PATH);
  const goldPacket = parse<BlindPacket>(GOLD_PACKET_PATH);
  const performanceTemplate = parse<GradeEnvelope>(
    v2TemplatePath("performance", "RATER-CAL-V2-B"),
  );
  const fields = sourceCompatibilityFields(v2Protocol, goldPacket);
  const paths = performancePaths();
  return {
    version: VERSION,
    commitmentVersion: REPLACEMENT_COMMITMENT_VERSION,
    lockedBeforeDGrades: true,
    purpose:
      "Replace failed rater A with one fresh independent rater D while preserving valid B/C gold qualifications and every calibration-v2 and sealed-performance byte.",
    sourceCalibrationV2: {
      root: V2_ROOT,
      protocolPath: V2_PROTOCOL_PATH,
      protocolHash: fileHash(V2_PROTOCOL_PATH),
      gradeSchemaPath: V2_SCHEMA_PATH,
      gradeSchemaHash: fileHash(V2_SCHEMA_PATH),
      goldPacketPath: GOLD_PACKET_PATH,
      goldPacketHash: fileHash(GOLD_PACKET_PATH),
      goldAnswerKeyPath: GOLD_KEY_PATH,
      goldAnswerKeyHash: fileHash(GOLD_KEY_PATH),
      compatibilityFields: fields,
      compatibilityFieldsHash: sha256(JSON.stringify(fields)),
    },
    importedQualifications: Object.fromEntries(
      IMPORTED_RATERS.map((rater) => [
        rater,
        {
          receiptPath: importedReceiptPath(rater),
          receiptHash: fileHash(importedReceiptPath(rater)),
          submissionPath: importedSubmissionPath(rater),
          submissionHash: fileHash(importedSubmissionPath(rater)),
        },
      ]),
    ) as ProtocolBody["importedQualifications"],
    historicalOutcome: {
      excludedRater: "RATER-CAL-V2-A",
      receiptPath: `${V2_ROOT}/gold/receipts/rater-cal-v2-a.json`,
      receiptHash: fileHash(`${V2_ROOT}/gold/receipts/rater-cal-v2-a.json`),
      correct: 22,
      denominator: 24,
      obviousFailuresCorrect: 11,
      obviousFailuresDenominator: 12,
      passed: false,
      relabellingForbidden: true,
    },
    roster: {
      importedQualified: IMPORTED_RATERS,
      freshReplacement: D_RATER,
      performanceRoster: PERFORMANCE_RATERS,
    },
    importRule: {
      exactCompatibilityFieldsRequired: true,
      changedRelevantByteOrThresholdRequiresRequalification: true,
      receiptSignatureAndFileHashRequired: true,
      sourceSubmissionHashRequired: true,
      rationale:
        "B and C may be reused only because their immutable passing receipts bind the identical gold packet/order, rubric-bearing protocol commitment, grade schema, envelope rules, and qualification thresholds used by this replacement commitment.",
    },
    replacementAuthorization: {
      beforeDGrades: true,
      dMustBeFreshIndependent: true,
      dPriorPacketAccessForbidden: true,
      dPriorGradeAccessForbidden: true,
      dMinimumScore: MINIMUM_SCORE,
      dObviousFailuresRequired: "12/12",
      dValidEnvelopeRequired: true,
      performanceRequiresImportedBAndCPlusValidD: true,
      performanceAccessBeforeAuthorizationForbidden: true,
    },
    dEnvelopeIdentityOverlay: {
      baseSchemaPath: V2_SCHEMA_PATH,
      baseSchemaHash: fileHash(V2_SCHEMA_PATH),
      baseSchemaBytesChanged: false,
      onlyExtension: "graderId-is-exactly-RATER-CAL-V3-D",
      scoringFieldsOrConstraintsChanged: false,
      validatorSource: "recipe/input-field-comparison-calibration-v3.ts",
      rationale:
        "The locked v2 schema's roster-only graderId regex names A/B/C. D is validated against the identical envelope shape, packet bindings, ordered rows, criterion rules, and defect rollup, with only the assigned graderId changed to the fresh D identity; no scoring field or constraint changes.",
    },
    performanceContinuity: {
      packetPath: PERFORMANCE_PACKET_PATH,
      packetHash: fileHash(PERFORMANCE_PACKET_PATH),
      randomizedBatchHash: performanceTemplate.randomizedBatchHash,
      sealedAnswerKeyPath: PERFORMANCE_KEY_PATH,
      sealedAnswerKeyHash: fileHash(PERFORMANCE_KEY_PATH),
      packetBytesChanged: false,
      randomizedIdsOrOrderChanged: false,
      sealedKeyChanged: false,
      packetCopiedOrRebuilt: false,
      remainsSealedAndUngraded: true,
    },
    reliability: v2Protocol.reliability,
    paths: {
      dGoldTemplate: D_GOLD_TEMPLATE_PATH,
      dGoldOutput: D_GOLD_OUTPUT_PATH,
      dQualificationReceipt: D_QUALIFICATION_RECEIPT_PATH,
      performanceTemplates: paths.templates,
      performanceOutputs: paths.outputs,
    },
  };
};

const makeProtocol = (): ReplacementProtocol => {
  const body = protocolBody();
  return { ...body, commitment: sha256(JSON.stringify(body)) };
};

const cloneTemplate = <T>(value: T): T => structuredClone(value);

const makeDGoldTemplate = (): GradeEnvelope => {
  const template = cloneTemplate(
    parse<GradeEnvelope>(v2TemplatePath("gold-calibration", "RATER-CAL-V2-B")),
  );
  template.graderId = D_RATER;
  return template;
};

const makePerformanceTemplate = (rater: PerformanceRater): GradeEnvelope => {
  const source =
    rater === "RATER-CAL-V2-C" ? "RATER-CAL-V2-C" : "RATER-CAL-V2-B";
  const template = cloneTemplate(
    parse<GradeEnvelope>(v2TemplatePath("performance", source)),
  );
  template.graderId = rater;
  check(
    template.calibrationReceipt,
    "source performance template lacks receipt",
  );
  template.calibrationReceipt.path =
    rater === D_RATER
      ? D_QUALIFICATION_RECEIPT_PATH
      : importedReceiptPath(rater);
  return template;
};

const prompts = (protocol: ReplacementProtocol) => ({
  [D_RATER]: {
    gold: [
      `Act as fresh independent rater ${D_RATER}; you must have no prior access to this gold packet, any prior grade, or the sealed performance packet.`,
      `Open only ${GOLD_PACKET_PATH}, ${D_GOLD_TEMPLATE_PATH}, and the referenced images beneath ${V2_ROOT}/gold/blind-packet; do not inspect parent directories, prior submissions/receipts, or ${GOLD_KEY_PATH}.`,
      "Apply the unchanged locked rubric to all 24 tasks in exact order, replace every null, and preserve every field and ID.",
      `Write only ${D_GOLD_OUTPUT_PATH}, then run npx tsx recipe/input-field-comparison-calibration-v3.ts --preflight-gold ${D_GOLD_OUTPUT_PATH}.`,
      "Stop after submission. Do not open any performance artifact.",
    ].join(" "),
    performance: [
      `Phase 2 for ${D_RATER} is forbidden until ${D_QUALIFICATION_RECEIPT_PATH} is hash-pinned and proves envelopeValid=true, score>=0.95, 12/12 obvious failures, passed=true, no prior packet/grade access, and replacement commitment ${protocol.commitment}.`,
      `After the replacement gate authorizes the complete B/C/D cohort, open only ${PERFORMANCE_PACKET_PATH}, ${performanceTemplatePath(D_RATER)}, that receipt, and referenced images beneath ${V2_ROOT}/performance/blind-packet.`,
      `Write only ${performanceOutputPath(D_RATER)} and run npx tsx recipe/input-field-comparison-calibration-v3.ts --preflight-performance ${performanceOutputPath(D_RATER)}.`,
      `Never inspect ${PERFORMANCE_KEY_PATH}, parent evidence, source code, prior grades, or another rater's work; do not compare tasks, infer identities, rank paths, or change thresholds.`,
    ].join(" "),
  },
  "RATER-CAL-V2-B": {
    performance: [
      `RATER-CAL-V2-B uses imported qualification receipt ${importedReceiptPath("RATER-CAL-V2-B")} only after the replacement gate verifies its exact compatibility and valid D completes the B/C/D cohort.`,
      `Then open only ${PERFORMANCE_PACKET_PATH}, ${performanceTemplatePath("RATER-CAL-V2-B")}, that imported receipt, and referenced images beneath ${V2_ROOT}/performance/blind-packet.`,
      `Write only ${performanceOutputPath("RATER-CAL-V2-B")} and run npx tsx recipe/input-field-comparison-calibration-v3.ts --preflight-performance ${performanceOutputPath("RATER-CAL-V2-B")}.`,
      `Never inspect ${PERFORMANCE_KEY_PATH}, parent evidence, prior grades, or another rater's work.`,
    ].join(" "),
  },
  "RATER-CAL-V2-C": {
    performance: [
      `RATER-CAL-V2-C uses imported qualification receipt ${importedReceiptPath("RATER-CAL-V2-C")} only after the replacement gate verifies its exact compatibility and valid D completes the B/C/D cohort.`,
      `Then open only ${PERFORMANCE_PACKET_PATH}, ${performanceTemplatePath("RATER-CAL-V2-C")}, that imported receipt, and referenced images beneath ${V2_ROOT}/performance/blind-packet.`,
      `Write only ${performanceOutputPath("RATER-CAL-V2-C")} and run npx tsx recipe/input-field-comparison-calibration-v3.ts --preflight-performance ${performanceOutputPath("RATER-CAL-V2-C")}.`,
      `Never inspect ${PERFORMANCE_KEY_PATH}, parent evidence, prior grades, or another rater's work.`,
    ].join(" "),
  },
});

const assertImportedReceipt = (
  rater: (typeof IMPORTED_RATERS)[number],
  protocol: ReplacementProtocol,
): QualificationReceipt => {
  const sourceTop = parse<any>(V2_RECEIPT_PATH);
  const receiptPath = importedReceiptPath(rater);
  const submissionPath = importedSubmissionPath(rater);
  const receipt = parse<QualificationReceipt>(receiptPath);
  const pin = sourceTop.gold.qualification.receipts[rater];
  const committedImport = protocol.importedQualifications[rater];
  check(pin.path === receiptPath, `${rater} source receipt path differs`);
  check(
    committedImport.receiptPath === receiptPath &&
      committedImport.receiptHash === pin.sha256 &&
      committedImport.receiptHash === fileHash(receiptPath) &&
      committedImport.submissionPath === submissionPath &&
      committedImport.submissionHash === fileHash(submissionPath),
    `${rater} committed receipt or submission pin differs`,
  );
  validateQualificationReceipt(receipt, fileHash(submissionPath), pin.sha256);
  const compatibility = protocol.sourceCalibrationV2.compatibilityFields;
  check(
    receipt.graderId === rater &&
      receipt.packetHash === compatibility.goldPacketHash &&
      receipt.randomizedBatchHash === compatibility.goldRandomizedBatchHash &&
      receipt.calibrationCommitment === compatibility.calibrationCommitment &&
      receipt.protocolHash === protocol.sourceCalibrationV2.protocolHash &&
      receipt.gradeSchemaHash === compatibility.gradeSchemaHash &&
      receipt.thresholds.minimumScore === compatibility.minimumScore &&
      receipt.thresholds.obviousFailureScoreRequired ===
        compatibility.obviousFailureScoreRequired &&
      receipt.thresholds.envelopeValidRequired ===
        compatibility.validEnvelopeRequired &&
      receipt.score >= MINIMUM_SCORE &&
      receipt.obviousFailureScore === OBVIOUS_FAILURE_SCORE_REQUIRED &&
      receipt.envelopeValid &&
      receipt.passed &&
      receipt.performanceEligibility &&
      !receipt.performanceAccessed &&
      !receipt.performanceIdentityRevealed,
    `${rater} is not exactly compatible and passing`,
  );
  return receipt;
};

const assertHistoricalAExcluded = (
  protocol: ReplacementProtocol,
): QualificationReceipt => {
  const receipt = parse<QualificationReceipt>(
    protocol.historicalOutcome.receiptPath,
  );
  check(
    fileHash(protocol.historicalOutcome.receiptPath) ===
      protocol.historicalOutcome.receiptHash &&
      receipt.graderId === "RATER-CAL-V2-A" &&
      receipt.correct === 22 &&
      receipt.denominator === 24 &&
      receipt.obviousStructuralStateFailuresCorrect === 11 &&
      receipt.obviousStructuralStateFailuresDenominator === 12 &&
      !receipt.passed &&
      !receipt.performanceEligibility &&
      protocol.historicalOutcome.excludedRater === "RATER-CAL-V2-A" &&
      !protocol.roster.performanceRoster.includes(
        "RATER-CAL-V2-A" as PerformanceRater,
      ),
    "A was altered, relabelled, imported, or made eligible",
  );
  return receipt;
};

export const validateReplacementProtocol = (
  protocol: ReplacementProtocol,
): void => {
  const expected = makeProtocol();
  check(
    JSON.stringify(protocol) === JSON.stringify(expected) &&
      protocol.commitment === sha256(JSON.stringify(protocolBody())) &&
      protocol.sourceCalibrationV2.compatibilityFieldsHash ===
        sha256(
          JSON.stringify(protocol.sourceCalibrationV2.compatibilityFields),
        ),
    "protocol, commitment, compatibility fields, paths, or thresholds changed",
  );
};

const concreteDefect = (defect: unknown): defect is string =>
  typeof defect === "string" &&
  defect.trim().length >= 20 &&
  !IDENTITY_LEAK.test(defect);

export function validateReplacementEnvelope(
  envelope: GradeEnvelope,
  packet: BlindPacket,
  packetHash: string,
  expectedRater: PerformanceRater,
): void {
  const phase = packet.phase;
  exactKeys(
    envelope as unknown as Record<string, unknown>,
    [
      "phase",
      "schemaVersion",
      "graderId",
      "packetProtocol",
      "packetHash",
      "randomizedBatchHash",
      "calibrationCommitment",
      "rubricVersion",
      "counts",
      ...(phase === "performance" ? ["calibrationReceipt"] : []),
      "orderedGrades",
    ],
    "grade envelope",
  );
  check(
    envelope.phase === phase &&
      envelope.schemaVersion === SCHEMA_VERSION &&
      envelope.graderId === expectedRater &&
      envelope.packetProtocol === packet.version &&
      envelope.packetHash === packetHash &&
      envelope.randomizedBatchHash === packet.randomizedBatchHash &&
      envelope.calibrationCommitment === packet.calibrationCommitment &&
      envelope.rubricVersion === RUBRIC_VERSION &&
      envelope.counts.expected === packet.tasks.length &&
      envelope.counts.submitted === packet.tasks.length &&
      envelope.orderedGrades.length === packet.tasks.length,
    "grade envelope binding, counts, or required fields differ",
  );
  for (const [index, grade] of envelope.orderedGrades.entries()) {
    const task = packet.tasks[index]!;
    exactKeys(
      grade as unknown as Record<string, unknown>,
      [
        "taskId",
        "referenceId",
        "specimenId",
        "recognisable",
        "confidence",
        "criteria",
        "defects",
      ],
      `grade ${index}`,
    );
    check(
      grade.taskId === task.taskId &&
        grade.referenceId === task.reference.referenceId &&
        grade.specimenId === task.specimen.specimenId &&
        typeof grade.recognisable === "boolean" &&
        ["low", "medium", "high"].includes(grade.confidence),
      `grade ${index} order, IDs, verdict, or confidence differs`,
    );
    exactKeys(grade.criteria, CATEGORIES, `grade ${index} criteria`);
    for (const category of CATEGORIES) {
      const criterion = grade.criteria[category];
      exactKeys(
        criterion as unknown as Record<string, unknown>,
        ["verdict", "defects"],
        `grade ${index} ${category}`,
      );
      check(
        ["match", "minor", "fail"].includes(criterion.verdict) &&
          criterion.defects.every(concreteDefect) &&
          (criterion.verdict !== "fail" || criterion.defects.length > 0),
        `grade ${index} ${category} verdict or defects differ`,
      );
    }
    const recognisable = CATEGORIES.every(
      (category) => grade.criteria[category].verdict !== "fail",
    );
    const defects = CATEGORIES.flatMap(
      (category) => grade.criteria[category].defects,
    );
    check(
      grade.recognisable === recognisable &&
        grade.defects.every(concreteDefect) &&
        JSON.stringify(grade.defects) === JSON.stringify(defects),
      `grade ${index} pass rule or ordered defect rollup differs`,
    );
  }
}

const signedPayload = (
  receipt: Omit<DQualificationReceipt, "signature">,
): string => sha256(JSON.stringify(receipt));

const validateGoldKey = (
  key: GoldKey,
  packet: BlindPacket,
  protocol: ReplacementProtocol,
): void => {
  check(
    fileHash(GOLD_KEY_PATH) ===
      protocol.sourceCalibrationV2.goldAnswerKeyHash &&
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
        .length === 12 &&
      JSON.stringify(
        key.answers.map((answer) => [
          answer.taskId,
          answer.referenceId,
          answer.specimenId,
        ]),
      ) ===
        JSON.stringify(
          packet.tasks.map((task) => [
            task.taskId,
            task.reference.referenceId,
            task.specimen.specimenId,
          ]),
        ),
    "gold answer key hash, binding, counts, or ordered IDs differ",
  );
};

export const validateDQualificationReceipt = (
  receipt: DQualificationReceipt,
  protocol: ReplacementProtocol,
): void => {
  const { signature, ...body } = receipt;
  check(
    signature.algorithm === "sha256" &&
      signature.signedPayloadHash === signedPayload(body),
    "D receipt signature differs",
  );
  const expectedPass =
    receipt.envelopeValid &&
    receipt.score >= MINIMUM_SCORE &&
    receipt.obviousStructuralStateFailureScore ===
      OBVIOUS_FAILURE_SCORE_REQUIRED;
  check(
    receipt.graderId === D_RATER &&
      receipt.sourceCompatibilityFieldsHash ===
        protocol.sourceCalibrationV2.compatibilityFieldsHash &&
      receipt.sourceGoldPacketHash ===
        protocol.sourceCalibrationV2.goldPacketHash &&
      receipt.sourceGoldAnswerKeyHash ===
        protocol.sourceCalibrationV2.goldAnswerKeyHash &&
      receipt.sourceProtocolHash ===
        protocol.sourceCalibrationV2.protocolHash &&
      receipt.sourceRubricHash ===
        protocol.sourceCalibrationV2.compatibilityFields.rubricHash &&
      receipt.sourceGradeSchemaHash ===
        protocol.sourceCalibrationV2.gradeSchemaHash &&
      receipt.replacementProtocolHash === fileHash(PROTOCOL_PATH) &&
      receipt.replacementCommitment === protocol.commitment &&
      receipt.templateHash === fileHash(D_GOLD_TEMPLATE_PATH) &&
      receipt.submissionPath === D_GOLD_OUTPUT_PATH &&
      receipt.submissionHash === fileHash(D_GOLD_OUTPUT_PATH) &&
      receipt.counts.expected === 24 &&
      receipt.counts.submitted === 24 &&
      receipt.counts.correct === receipt.score * 24 &&
      receipt.counts.obviousStructuralStateFailures === 12 &&
      receipt.counts.obviousStructuralStateFailuresCorrect ===
        receipt.obviousStructuralStateFailureScore * 12 &&
      receipt.obviousFailureScore ===
        receipt.obviousStructuralStateFailureScore &&
      receipt.passed === expectedPass &&
      receipt.performanceEligibility === expectedPass &&
      receipt.performanceBinding.receiptPath === D_QUALIFICATION_RECEIPT_PATH &&
      receipt.performanceBinding.score === receipt.score &&
      receipt.performanceBinding.obviousStructuralStateFailureScore ===
        receipt.obviousStructuralStateFailureScore &&
      receipt.performanceBinding.passed === expectedPass &&
      !receipt.performanceAccessed &&
      !receipt.priorGoldPacketAccess &&
      !receipt.priorGradeAccess,
    "D receipt identity, continuity, arithmetic, independence, or threshold differs",
  );
};

export const assertReplacementAuthorization = (
  protocol: ReplacementProtocol = parse<ReplacementProtocol>(PROTOCOL_PATH),
): void => {
  validateReplacementProtocol(protocol);
  for (const rater of IMPORTED_RATERS) assertImportedReceipt(rater, protocol);
  assertHistoricalAExcluded(protocol);
  check(
    existsSync(absolute(D_QUALIFICATION_RECEIPT_PATH)),
    "performance access attempted before D qualifies",
  );
  const receipt = parse<DQualificationReceipt>(D_QUALIFICATION_RECEIPT_PATH);
  validateDQualificationReceipt(receipt, protocol);
  const topReceipt = parse<any>(RECEIPT_PATH);
  const index = parse<any>(INDEX_PATH);
  check(
    receipt.passed &&
      receipt.performanceEligibility &&
      topReceipt.freshD.qualification.receiptPath ===
        D_QUALIFICATION_RECEIPT_PATH &&
      topReceipt.freshD.qualification.receiptHash ===
        fileHash(D_QUALIFICATION_RECEIPT_PATH) &&
      topReceipt.performance.performanceCommissioned === true &&
      JSON.stringify(topReceipt.performance.authorizedRaters) ===
        JSON.stringify(PERFORMANCE_RATERS) &&
      index.performanceAccessAllowed === true &&
      index.performanceUnsealed === false &&
      index.performanceGraded === false,
    "performance access attempted before D qualifies",
  );
};

const assertV2Continuity = (
  protocol: ReplacementProtocol,
  snapshot: TreeSnapshot,
): void => {
  validateCommittedCalibrationV2();
  const v2Index = parse<any>(V2_INDEX_PATH);
  const v2Receipt = parse<any>(V2_RECEIPT_PATH);
  check(
    fileHash(V2_PROTOCOL_PATH) === protocol.sourceCalibrationV2.protocolHash &&
      fileHash(V2_SCHEMA_PATH) ===
        protocol.sourceCalibrationV2.gradeSchemaHash &&
      fileHash(GOLD_PACKET_PATH) ===
        protocol.sourceCalibrationV2.goldPacketHash &&
      fileHash(GOLD_KEY_PATH) ===
        protocol.sourceCalibrationV2.goldAnswerKeyHash &&
      fileHash(PERFORMANCE_PACKET_PATH) ===
        protocol.performanceContinuity.packetHash &&
      fileHash(PERFORMANCE_KEY_PATH) ===
        protocol.performanceContinuity.sealedAnswerKeyHash &&
      v2Index.goldPacketHash === protocol.sourceCalibrationV2.goldPacketHash &&
      v2Index.performancePacketHash ===
        protocol.performanceContinuity.packetHash &&
      v2Receipt.performance.randomizedBatchHash ===
        protocol.performanceContinuity.randomizedBatchHash &&
      v2Receipt.performance.sealedAnswerKeyHash ===
        protocol.performanceContinuity.sealedAnswerKeyHash &&
      v2Receipt.performance.answerKeyParsedForPerformanceResult === false &&
      v2Receipt.performance.performanceIdentitiesRevealed === false &&
      v2Receipt.performance.gradeWritten === false &&
      JSON.stringify(v2Receipt.thresholds) ===
        JSON.stringify(protocol.reliability) &&
      JSON.stringify(treeSnapshot()) === JSON.stringify(snapshot),
    "v2 packet, key, IDs/order, thresholds, seal, or protected bytes changed",
  );
};

export async function buildReplacementProtocolV3(): Promise<void> {
  const before = treeSnapshot();
  validateCommittedCalibrationV2();
  const protocol = makeProtocol();
  for (const rater of IMPORTED_RATERS) assertImportedReceipt(rater, protocol);
  assertHistoricalAExcluded(protocol);
  rmSync(absolute(NEXT_ROOT), { recursive: true, force: true });
  mkdirSync(absolute(NEXT_ROOT), { recursive: true });
  await writeFormattedJson(`${NEXT_ROOT}/protocol.json`, protocol);
  writeJson(D_GOLD_TEMPLATE_PATH.replace(ROOT, NEXT_ROOT), makeDGoldTemplate());
  for (const rater of PERFORMANCE_RATERS)
    writeJson(
      performanceTemplatePath(rater).replace(ROOT, NEXT_ROOT),
      makePerformanceTemplate(rater),
    );
  const importProof = Object.fromEntries(
    IMPORTED_RATERS.map((rater) => {
      const receipt = assertImportedReceipt(rater, protocol);
      return [
        rater,
        {
          status: "imported-valid",
          receiptPath: importedReceiptPath(rater),
          receiptHash: fileHash(importedReceiptPath(rater)),
          submissionPath: importedSubmissionPath(rater),
          submissionHash: fileHash(importedSubmissionPath(rater)),
          score: receipt.score,
          obviousFailureScore: receipt.obviousFailureScore,
          envelopeValid: receipt.envelopeValid,
          compatibilityFieldsHash:
            protocol.sourceCalibrationV2.compatibilityFieldsHash,
          whyValid:
            "Passing receipt and source submission hashes verify against the exact same gold packet/order, protocol commitment, rubric, grade schema, envelope rules, and thresholds.",
        },
      ];
    }),
  );
  const replacementPrompts = prompts(protocol);
  const receipt = {
    version: VERSION,
    status: {
      protocol: "locked-before-d-grade",
      qualification: "two-imported-valid-one-fresh-d-required",
      performancePacket: "sealed-ungraded-access-forbidden",
      recognisabilityInstrument: "blocked",
      architecturePerformance: "not-unsealed",
      liveInput: "blocked",
      inputOverall: false,
    },
    preservation: {
      calibrationV2Modified: false,
      calibrationV2Snapshot: before,
    },
    commitment: {
      protocol: PROTOCOL_PATH,
      protocolHash: fileHash(`${NEXT_ROOT}/protocol.json`),
      replacementCommitment: protocol.commitment,
      compatibilityFieldsHash:
        protocol.sourceCalibrationV2.compatibilityFieldsHash,
    },
    historicalA: protocol.historicalOutcome,
    imports: importProof,
    freshD: {
      graderId: D_RATER,
      status: "commissioned-not-graded",
      independenceRequired: {
        noPriorGoldPacketAccess: true,
        noPriorGradeAccess: true,
        noPerformanceAccess: true,
      },
      goldTemplate: D_GOLD_TEMPLATE_PATH,
      goldTemplateHash: fileHash(D_GOLD_TEMPLATE_PATH.replace(ROOT, NEXT_ROOT)),
      goldOutput: D_GOLD_OUTPUT_PATH,
      qualificationReceipt: D_QUALIFICATION_RECEIPT_PATH,
      prompt: replacementPrompts[D_RATER].gold,
    },
    performance: {
      ...protocol.performanceContinuity,
      packetAccessedByReplacementRater: false,
      performanceCommissioned: false,
      cohort: PERFORMANCE_RATERS,
      templates: Object.fromEntries(
        PERFORMANCE_RATERS.map((rater) => [
          rater,
          {
            path: performanceTemplatePath(rater),
            sha256: fileHash(
              performanceTemplatePath(rater).replace(ROOT, NEXT_ROOT),
            ),
          },
        ]),
      ),
      outputs: protocol.paths.performanceOutputs,
      prompts: Object.fromEntries(
        PERFORMANCE_RATERS.map((rater) => [
          rater,
          replacementPrompts[rater].performance,
        ]),
      ),
    },
    thresholds: protocol.reliability,
  };
  await writeFormattedJson(`${NEXT_ROOT}/receipt.json`, receipt);
  writeJson(`${NEXT_ROOT}/index.json`, {
    version: VERSION,
    status: "replacement-d-required-performance-sealed-live-input-blocked",
    overall: false,
    recognisabilityInstrumentUsable: false,
    performanceGraded: false,
    performanceUnsealed: false,
    performanceAccessAllowed: false,
    liveInputMayProceed: false,
    protocol: PROTOCOL_PATH,
    protocolHash: fileHash(`${NEXT_ROOT}/protocol.json`),
    receipt: RECEIPT_PATH,
    receiptHash: fileHash(`${NEXT_ROOT}/receipt.json`),
    sourceGoldPacket: GOLD_PACKET_PATH,
    sourceGoldPacketHash: fileHash(GOLD_PACKET_PATH),
    sealedPerformancePacket: PERFORMANCE_PACKET_PATH,
    sealedPerformancePacketHash: fileHash(PERFORMANCE_PACKET_PATH),
  });
  check(
    JSON.stringify(treeSnapshot()) === JSON.stringify(before),
    "building replacement changed calibration-v2",
  );
  rmSync(absolute(ROOT), { recursive: true, force: true });
  renameSync(absolute(NEXT_ROOT), absolute(ROOT));
  validateCommittedReplacementV3();
}

export function validateCommittedReplacementV3(): void {
  const protocol = parse<ReplacementProtocol>(PROTOCOL_PATH);
  const receipt = parse<any>(RECEIPT_PATH);
  const index = parse<any>(INDEX_PATH);
  const finalAdjudicationPath = `${ROOT}/final-adjudication.json`;
  const finalAdjudicated = existsSync(absolute(finalAdjudicationPath));
  validateReplacementProtocol(protocol);
  assertV2Continuity(protocol, receipt.preservation.calibrationV2Snapshot);
  for (const rater of IMPORTED_RATERS) {
    const imported = assertImportedReceipt(rater, protocol);
    const proof = receipt.imports[rater];
    check(
      proof.status === "imported-valid" &&
        proof.receiptPath === importedReceiptPath(rater) &&
        proof.receiptHash === fileHash(importedReceiptPath(rater)) &&
        proof.submissionPath === importedSubmissionPath(rater) &&
        proof.submissionHash === fileHash(importedSubmissionPath(rater)) &&
        proof.score === imported.score &&
        proof.obviousFailureScore === imported.obviousFailureScore &&
        proof.envelopeValid &&
        proof.compatibilityFieldsHash ===
          protocol.sourceCalibrationV2.compatibilityFieldsHash,
      `${rater} import proof differs`,
    );
  }
  assertHistoricalAExcluded(protocol);
  check(
    fileHash(index.protocol) === index.protocolHash &&
      fileHash(index.receipt) === index.receiptHash &&
      fileHash(index.sourceGoldPacket) === index.sourceGoldPacketHash &&
      fileHash(index.sealedPerformancePacket) ===
        index.sealedPerformancePacketHash &&
      !index.overall &&
      !index.recognisabilityInstrumentUsable &&
      !index.performanceGraded &&
      !index.performanceUnsealed &&
      !index.liveInputMayProceed &&
      receipt.status.liveInput === "blocked" &&
      !receipt.status.inputOverall &&
      receipt.freshD.graderId === D_RATER &&
      receipt.freshD.goldOutput === D_GOLD_OUTPUT_PATH &&
      receipt.performance.packetAccessedByReplacementRater === false,
    "index, seal, D status, recognisability, or live Input block differs",
  );
  check(
    protocol.dEnvelopeIdentityOverlay.baseSchemaHash ===
      protocol.sourceCalibrationV2.gradeSchemaHash &&
      !protocol.dEnvelopeIdentityOverlay.baseSchemaBytesChanged &&
      !protocol.dEnvelopeIdentityOverlay.scoringFieldsOrConstraintsChanged &&
      protocol.dEnvelopeIdentityOverlay.onlyExtension ===
        "graderId-is-exactly-RATER-CAL-V3-D",
    "D identity overlay changes schema bytes or scoring constraints",
  );
  const dTemplate = makeDGoldTemplate();
  check(
    JSON.stringify(parse(D_GOLD_TEMPLATE_PATH)) === JSON.stringify(dTemplate) &&
      fileHash(D_GOLD_TEMPLATE_PATH) === receipt.freshD.goldTemplateHash,
    "D gold template differs",
  );
  for (const rater of PERFORMANCE_RATERS) {
    const expected = makePerformanceTemplate(rater);
    const pin = receipt.performance.templates[rater];
    check(
      pin.path === performanceTemplatePath(rater) &&
        fileHash(pin.path) === pin.sha256 &&
        JSON.stringify(parse(pin.path)) === JSON.stringify(expected) &&
        receipt.performance.outputs[rater] === performanceOutputPath(rater),
      `${rater} future performance template or output differs`,
    );
  }
  if (finalAdjudicated) {
    check(
      PERFORMANCE_RATERS.every((rater) => {
        const output = performanceOutputPath(rater);
        return (
          existsSync(absolute(output)) &&
          receipt.performance.submissions[rater].path === output &&
          receipt.performance.submissions[rater].sha256 === fileHash(output)
        );
      }) &&
        receipt.performance.adjudicationPath === finalAdjudicationPath &&
        receipt.performance.reliability === "failed" &&
        receipt.performance.performanceIdentityUnsealed === false &&
        index.adjudication === finalAdjudicationPath &&
        index.reliability === "failed" &&
        index.architecturePerformance === null,
      "final performance submissions, seal, or evidence status differs",
    );
  } else {
    check(
      PERFORMANCE_RATERS.every(
        (rater) => !existsSync(absolute(performanceOutputPath(rater))),
      ),
      "performance output exists before final adjudication",
    );
  }
  if (existsSync(absolute(D_QUALIFICATION_RECEIPT_PATH))) {
    check(
      existsSync(absolute(D_GOLD_OUTPUT_PATH)),
      "D receipt exists without its submission",
    );
    const dReceipt = parse<DQualificationReceipt>(D_QUALIFICATION_RECEIPT_PATH);
    validateDQualificationReceipt(dReceipt, protocol);
    const statusValid = finalAdjudicated
      ? receipt.status.performancePacket === "sealed-reliability-failed" &&
        receipt.status.recognisabilityInstrument === "failed-reliability" &&
        index.status ===
          "reliability-failed-performance-sealed-live-input-blocked"
      : receipt.status.performancePacket ===
          "sealed-ungraded-access-authorized" &&
        receipt.status.recognisabilityInstrument ===
          "blocked-performance-pending" &&
        index.status ===
          "qualification-passed-performance-authorized-sealed-live-input-blocked";
    check(
      receipt.status.qualification === "passed-three-rater-cohort" &&
        statusValid &&
        receipt.status.architecturePerformance === "not-unsealed" &&
        receipt.freshD.status === "qualified-performance-authorized" &&
        receipt.freshD.qualification.receiptPath ===
          D_QUALIFICATION_RECEIPT_PATH &&
        receipt.freshD.qualification.receiptHash ===
          fileHash(D_QUALIFICATION_RECEIPT_PATH) &&
        receipt.freshD.qualification.submissionHash ===
          dReceipt.submissionHash &&
        receipt.freshD.qualification.score === dReceipt.score &&
        receipt.freshD.qualification.obviousFailureScore ===
          dReceipt.obviousFailureScore &&
        receipt.freshD.qualification.envelopeValid === dReceipt.envelopeValid &&
        receipt.freshD.qualification.passed === dReceipt.passed &&
        receipt.performance.performanceCommissioned === true &&
        JSON.stringify(receipt.performance.authorizedRaters) ===
          JSON.stringify(PERFORMANCE_RATERS) &&
        index.performanceAccessAllowed === true,
      "qualified D receipt, status, or performance authorization differs",
    );
  } else {
    check(
      receipt.status.qualification ===
        "two-imported-valid-one-fresh-d-required" &&
        receipt.status.performancePacket ===
          "sealed-ungraded-access-forbidden" &&
        receipt.freshD.status === "commissioned-not-graded" &&
        receipt.performance.performanceCommissioned === false &&
        index.performanceAccessAllowed === false,
      "pre-qualification D status differs",
    );
  }
}

const scoreD = (): DQualificationReceipt => {
  check(existsSync(absolute(D_GOLD_OUTPUT_PATH)), "D gold output is absent");
  const protocol = parse<ReplacementProtocol>(PROTOCOL_PATH);
  const topReceipt = parse<any>(RECEIPT_PATH);
  validateReplacementProtocol(protocol);
  assertV2Continuity(protocol, topReceipt.preservation.calibrationV2Snapshot);
  for (const rater of IMPORTED_RATERS) assertImportedReceipt(rater, protocol);
  assertHistoricalAExcluded(protocol);
  const packet = parse<BlindPacket>(GOLD_PACKET_PATH);
  const envelope = parse<GradeEnvelope>(D_GOLD_OUTPUT_PATH);
  validateReplacementEnvelope(
    envelope,
    packet,
    fileHash(GOLD_PACKET_PATH),
    D_RATER,
  );
  const key = parse<GoldKey>(GOLD_KEY_PATH);
  validateGoldKey(key, packet, protocol);
  const answers = new Map(key.answers.map((answer) => [answer.taskId, answer]));
  const errors: DQualificationReceipt["errors"] = [];
  let correct = 0;
  let obviousCorrect = 0;
  for (const grade of envelope.orderedGrades) {
    const answer = answers.get(grade.taskId);
    check(answer, `${grade.taskId} has no gold answer`);
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
  const obviousScore = obviousCorrect / 12;
  const passed =
    score >= MINIMUM_SCORE && obviousScore === OBVIOUS_FAILURE_SCORE_REQUIRED;
  const body: Omit<DQualificationReceipt, "signature"> = {
    version: "replacement-rater-calibration-receipt-v3",
    graderId: D_RATER,
    sourceCompatibilityFieldsHash:
      protocol.sourceCalibrationV2.compatibilityFieldsHash,
    sourceGoldPacketHash: protocol.sourceCalibrationV2.goldPacketHash,
    sourceGoldAnswerKeyHash: protocol.sourceCalibrationV2.goldAnswerKeyHash,
    sourceProtocolHash: protocol.sourceCalibrationV2.protocolHash,
    sourceRubricHash:
      protocol.sourceCalibrationV2.compatibilityFields.rubricHash,
    sourceGradeSchemaHash: protocol.sourceCalibrationV2.gradeSchemaHash,
    replacementProtocolHash: fileHash(PROTOCOL_PATH),
    replacementCommitment: protocol.commitment,
    templateHash: fileHash(D_GOLD_TEMPLATE_PATH),
    submissionPath: D_GOLD_OUTPUT_PATH,
    submissionHash: fileHash(D_GOLD_OUTPUT_PATH),
    counts: {
      expected: 24,
      submitted: 24,
      correct,
      obviousStructuralStateFailures: 12,
      obviousStructuralStateFailuresCorrect: obviousCorrect,
    },
    score,
    obviousFailureScore: obviousScore,
    obviousStructuralStateFailureScore: obviousScore,
    envelopeValid: true,
    passed,
    performanceEligibility: passed,
    performanceBinding: {
      receiptPath: D_QUALIFICATION_RECEIPT_PATH,
      score,
      obviousStructuralStateFailureScore: obviousScore,
      passed,
    },
    performanceAccessed: false,
    priorGoldPacketAccess: false,
    priorGradeAccess: false,
    errors,
  };
  const receipt: DQualificationReceipt = {
    ...body,
    signature: {
      algorithm: "sha256",
      signedPayloadHash: signedPayload(body),
    },
  };
  validateDQualificationReceipt(receipt, protocol);
  return receipt;
};

const updateDQualificationStatus = async (
  dReceipt: DQualificationReceipt,
): Promise<void> => {
  const topReceipt = parse<any>(RECEIPT_PATH);
  const index = parse<any>(INDEX_PATH);
  const receiptHash = fileHash(D_QUALIFICATION_RECEIPT_PATH);
  topReceipt.status.qualification = "passed-three-rater-cohort";
  topReceipt.status.performancePacket = "sealed-ungraded-access-authorized";
  topReceipt.status.recognisabilityInstrument = "blocked-performance-pending";
  topReceipt.status.architecturePerformance = "not-unsealed";
  topReceipt.freshD.status = "qualified-performance-authorized";
  topReceipt.freshD.qualification = {
    receiptPath: D_QUALIFICATION_RECEIPT_PATH,
    receiptHash,
    submissionHash: dReceipt.submissionHash,
    counts: dReceipt.counts,
    score: dReceipt.score,
    obviousFailureScore: dReceipt.obviousFailureScore,
    envelopeValid: dReceipt.envelopeValid,
    passed: dReceipt.passed,
  };
  topReceipt.performance.performanceCommissioned = true;
  topReceipt.performance.authorizedRaters = PERFORMANCE_RATERS;
  await writeFormattedJson(RECEIPT_PATH, topReceipt);
  index.status =
    "qualification-passed-performance-authorized-sealed-live-input-blocked";
  index.receiptHash = fileHash(RECEIPT_PATH);
  index.performanceAccessAllowed = true;
  await writeFormattedJson(INDEX_PATH, index);
};

const runGoldPreflight = (file: string): void => {
  const packet = parse<BlindPacket>(GOLD_PACKET_PATH);
  validateReplacementEnvelope(
    parse<GradeEnvelope>(file),
    packet,
    fileHash(GOLD_PACKET_PATH),
    D_RATER,
  );
  console.log(
    "PASS D gold preflight: valid 24-row envelope; no answer key or performance artifact accessed",
  );
};

const runPerformancePreflight = (file: string): void => {
  assertReplacementAuthorization();
  const envelope = parse<GradeEnvelope>(file);
  const rater = envelope.graderId as PerformanceRater;
  check(
    PERFORMANCE_RATERS.includes(rater),
    "performance grader is not B, C, or D",
  );
  const packet = parse<BlindPacket>(PERFORMANCE_PACKET_PATH);
  validateReplacementEnvelope(
    envelope,
    packet,
    fileHash(PERFORMANCE_PACKET_PATH),
    rater,
  );
  console.log(
    `PASS ${rater} performance preflight: replacement cohort authorized and 384-row envelope valid`,
  );
};

const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  if (process.argv.includes("--build")) {
    await buildReplacementProtocolV3();
  } else if (process.argv.includes("--preflight-gold")) {
    const index = process.argv.indexOf("--preflight-gold");
    runGoldPreflight(process.argv[index + 1] ?? "");
  } else if (process.argv.includes("--preflight-performance")) {
    const index = process.argv.indexOf("--preflight-performance");
    runPerformancePreflight(process.argv[index + 1] ?? "");
  } else if (process.argv.includes("--score-d")) {
    const receipt = scoreD();
    await writeFormattedJson(D_QUALIFICATION_RECEIPT_PATH, receipt);
    if (receipt.passed) await updateDQualificationStatus(receipt);
    console.log(
      `${D_RATER}: ${receipt.passed ? "QUALIFIED" : "NOT QUALIFIED"}; ${receipt.counts.correct}/24; obvious ${receipt.counts.obviousStructuralStateFailuresCorrect}/12`,
    );
  } else {
    validateCommittedReplacementV3();
    const dQualified = existsSync(absolute(D_QUALIFICATION_RECEIPT_PATH));
    const finalAdjudicated = existsSync(
      absolute(`${ROOT}/final-adjudication.json`),
    );
    console.log(
      finalAdjudicated
        ? "Replacement v3 valid; B/C/D reliability failed; performance identity remains sealed/ungraded"
        : dQualified
          ? "Replacement v3 valid; B/C/D qualified; performance authorized and remains sealed/ungraded"
          : `Replacement v3 valid; B/C imported; D ungraded; performance sealed sha256=${fileHash(PERFORMANCE_PACKET_PATH)}`,
    );
  }
}
