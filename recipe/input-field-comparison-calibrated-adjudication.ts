import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { format } from "prettier";

import {
  CALIBRATION_GRADE_PATHS,
  CALIBRATION_INDEX_PATH,
  CALIBRATION_KEY_PATH,
  CALIBRATION_PACKET_PATH,
  CALIBRATION_PROTOCOL_PATH,
  CALIBRATION_RECEIPT_PATH,
  validateCalibratedGradeBatch,
  validateCalibratedPacketDocument,
  validatePredeclaredCalibrationProtocol,
  type BlindPacket,
  type CalibratedGradeBatch,
} from "./input-field-comparison-calibrated.js";

const REPO = path.resolve(new URL(".", import.meta.url).pathname, "..");
const V1_ROOT = "recipe/evidence/input-field-comparison";
const V2_ROOT = "recipe/evidence/input-field-comparison-v2";
const ROOT = "recipe/evidence/input-field-comparison-calibrated";
const BLIND_ROOT = `${ROOT}/blind-packet`;

export const CALIBRATED_ADJUDICATION_PATH = `${ROOT}/adjudication.json`;

const RATERS = ["BATCH-CAL-A", "BATCH-CAL-B", "BATCH-CAL-C"] as const;
const CATEGORIES = [
  "structural-completeness-state-correctness",
  "geometry-proportions",
  "label-helper-adornments",
  "typography",
  "border-fill-focus-error-treatment",
] as const;
const IMPLEMENTATION_LEAK =
  /\blegacy\b|\brecipe\b|\bcorrected\b|\bduplicate\b|\bcopy[- _]?[ab]\b|\bimplementation\b|\bexpected[- _]?winner\b|\bmui\b|\bpolaris\b|@shopify|@mui/i;

type Rater = (typeof RATERS)[number];
type Category = (typeof CATEGORIES)[number];
type Confidence = "low" | "medium" | "high";

interface SubmittedGrade {
  taskId: string;
  referenceId: string;
  specimenId: string;
  recognisable: boolean;
  confidence: Confidence;
  criteria: Record<Category, "match" | "fail" | "minor" | "material">;
  defects: string[];
}

interface SubmittedBatch {
  protocol?: unknown;
  version?: unknown;
  rater?: unknown;
  raterId?: unknown;
  independentBlindGrade?: unknown;
  packetHash?: unknown;
  randomizedBatchHash?: unknown;
  calibrationCommitment?: unknown;
  calibrationCommitmentHash?: unknown;
  rubricHash?: unknown;
  counts?: unknown;
  packetValidation?: unknown;
  grades: SubmittedGrade[];
}

interface Artifact {
  cellKey: string;
  file: string;
  hash: string;
}

interface EvidenceReceipt {
  matrix: {
    sampleMatrixHash: string;
    cells: Array<{ key: string }>;
  };
  provenance: {
    sourceCommit: string;
    fixtureHash?: string;
    comparisonFixtureHash?: string;
    environmentHash: string;
  };
  references: Artifact[];
  outputs: {
    legacy: Artifact[];
    recipeReact?: Artifact[];
  };
}

interface DuplicateProof {
  cellKey: string;
  copyASpecimenId: string;
  copyAPath: string;
  copyBSpecimenId: string;
  copyBPath: string;
  sha256: string;
  byteIdentical: boolean;
}

interface CalibrationReceipt {
  status: {
    packetBuild: string;
    independentBlindGrades: string;
    reliability: string;
    recognisability: string;
    architectureProgress: string;
    liveInputMayProceed: boolean;
    inputOverall: boolean;
  };
  preservation: {
    priorArtifactsModified: boolean;
    historicalArtifactHashes: Record<string, string>;
  };
  continuity: {
    exactMatrix: boolean;
    sampleMatrixHash: string;
    sourceCommit: string;
    fixtureHash: string;
    environmentHash: string;
    referenceBytesEqualV1ToV2: number;
    sourceReferenceProvenanceEqualV1ToV2: number;
    sourceReferenceProvenanceHash: string;
    legacyBytesEqualV1ToV2: number;
    cells: Array<{
      cellKey: string;
      referenceHash: string;
      legacyHash: string;
      correctedV2Hash: string;
    }>;
  };
  calibratedBatch: {
    sourceCells: number;
    uniqueOriginalSourceReferences: number;
    referencePresentations: number;
    correctedV2Specimens: number;
    unchangedControlCopyA: number;
    unchangedControlCopyB: number;
    totalSpecimens: number;
    duplicateProof: DuplicateProof[];
    nonAdjacentSameCellPresentations: boolean;
    packetContainsIdentityOrDuplicateMetadata: boolean;
  };
  commitment: {
    protocol: string;
    protocolHash: string;
    commitmentHash: string;
    rubricHash: string;
    packet: string;
    packetHash: string;
    randomizedBatchHash: string;
    sealedAnswerKey: string;
    sealedAnswerKeyHash: string;
    lockedBeforeGrading: boolean;
    recognisabilityVerdictsAuthoredByBuilder: boolean;
  };
  predeclaredAcceptance: {
    allThreeRatersValidAndComplete: true;
    hiddenDuplicateAgreementPerRaterMinimum: 0.95;
    majorityConsensusDuplicateAgreementMinimum: 127;
    majorityConsensusDuplicateAgreementDenominator: 128;
    duplicateMismatchBlocksAffectedCell: true;
    everyPairwiseAgreementMinimum: 0.75;
    fleissKappaMinimum: 0.6;
    maximumIdenticalCopyPassRateDifference: 0.05;
    majorityFailNeedsConcreteDefectsFromRaters: 2;
    failureConsequence: string;
  };
  progressArithmetic: {
    availableOnlyAfterReliabilityPasses: true;
    legacyCopiesCollapseToOneConsensusPerCell: true;
    legacyMayNeverBeDoubleWeighted: true;
    exactComparisonCells: 128;
    recipeConsensusPerCell: string;
    legacyConsensusPerCell: string;
    affectedDuplicateMismatchCell: "blocked";
    historicalResultsRemainHistory: true;
    calibratedConsensusSupersedesHistoryForProgressionOnlyIfThresholdsPass: true;
  };
  independentRaters: Array<{
    rater: Rater;
    status: string;
    allowedOutputPath: string;
    prompt: string;
  }>;
}

interface CalibrationIndex {
  status: string;
  overall: boolean;
  gradeWritten: boolean;
  liveInputMayProceed: boolean;
  protocol: string;
  protocolHash: string;
  packet: string;
  packetHash: string;
  sealedAnswerKey: string;
  sealedAnswerKeyHash: string;
  receipt: string;
  receiptHash: string;
  allowedGradeOutputs: string[];
}

export interface CalibrationAdjudicationSources {
  protocol: string;
  packet: string;
  receipt: string;
  index: string;
  grades: Record<Rater, string>;
  sealedAnswerKeyBytes: Buffer;
}

interface GradeValidation {
  rater: Rater;
  path: string;
  sha256: string;
  submittedRecognisable: number;
  submittedUnrecognisable: number;
  gradeCount: 384;
  uniqueTaskIds: 384;
  exactPacketOrderAndIds: true;
  verdictsAndPassRuleValid: true;
  failureDefectsComplete: true;
  categoryDefectCoverageComplete: true;
  implementationOrDuplicateGuessesAbsent: true;
  submittedBindingFields: {
    randomizedBatchHashMatches: boolean;
    calibrationCommitmentMatches: boolean;
  };
  declaredEnvelope: {
    valid: false;
    missingFields: string[];
    unexpectedFields: string[];
    criterionObjectsPresent: false;
    strictReaderError: string;
  };
  validAndCompleteRater: false;
}

interface PairwiseMetric {
  raters: string;
  agreements: number;
  denominator: 384;
  ratio: number;
  cohensKappa: number;
  threshold: 0.75;
  passed: boolean;
}

interface DuplicateRaterMetric {
  agreements: number;
  denominator: 128;
  ratio: number;
  threshold: 0.95;
  agreementPassed: boolean;
  copyAPasses: number;
  copyBPasses: number;
  percentagePointDifference: number;
  maximumDifference: 0.05;
  passRateDifferencePassed: boolean;
}

export interface InputFieldCalibratedAdjudication {
  artifactVersion: "input-field-calibrated-adjudication-v1";
  sequence: {
    opaqueGradeValidationCompletedBeforeDuplicatePairing: true;
    pairwiseAndFleissComputedOnOpaquePacketOrder: true;
    duplicatePairingCheckedInSeparateIntegrityPhase: true;
    duplicatePhaseUsedImplementationIdentity: false;
    answerKeyHashCheckedWithoutParsing: true;
    answerKeyParsed: false;
    performanceIdentityUnsealed: false;
  };
  inputHashes: {
    protocol: string;
    packet: string;
    receipt: string;
    index: string;
    grades: Record<Rater, string>;
    sealedAnswerKeyCommitment: string;
  };
  integrity: {
    protocolCommitment: "passed";
    receiptAndIndexPins: "passed";
    sourceReferenceProvenance: {
      status: "passed";
      exactRecords: 128;
      provenanceHash: string;
    };
    historicalContinuity: {
      status: "passed";
      historicalArtifactsUnchanged: number;
      exactMatrixCells: 128;
      v1V2ReferenceBytesEqual: 128;
      v1V2LegacyBytesEqual: 128;
    };
    packet: {
      status: "passed";
      tasks: 384;
      uniqueTaskIds: 384;
      uniqueReferenceIds: 384;
      uniqueSpecimenIds: 384;
      containedRegularImagePaths: 768;
      pathBoundaryEscapes: 0;
      packetHashMatchesCommitment: true;
      randomizedBatchHashMatchesCommitment: true;
    };
    sealedAnswerKey: {
      sha256: string;
      hashMatchesCommitment: true;
      parsed: false;
      validationDeferredUntilReliabilityPasses: true;
    };
  };
  gradeValidations: GradeValidation[];
  opaqueAgreement: {
    perRaterPasses: Record<
      Rater,
      { recognisable: number; denominator: 384; ratio: number }
    >;
    unanimous: {
      count: number;
      ratio: number;
      unanimousPass: number;
      unanimousFail: number;
    };
    split: { count: number; ratio: number };
    votePatterns: Record<string, number>;
    pairwise: PairwiseMetric[];
    overallPairwiseAgreement: number;
    fleissKappa: number;
    majorityFailureRows: number;
    majorityFailuresWithTwoConcreteRaterDefectSets: number;
  };
  duplicateIntegrity: {
    status: "passed";
    pairs: 128;
    uniquePairedSpecimens: 256;
    byteIdenticalPairs: 128;
    containedRegularPaths: 256;
    implementationIdentityUsed: false;
    byRater: Record<Rater, DuplicateRaterMetric>;
    majorityConsensus: {
      agreements: number;
      denominator: 128;
      ratio: number;
      mismatchedPairCount: number;
      thresholdAgreements: 127;
      passed: boolean;
    };
  };
  thresholds: {
    source: "calibration-receipt-predeclared-acceptance";
    unchanged: true;
    allThreeRatersValidAndComplete: {
      required: 3;
      actual: number;
      passed: false;
    };
    hiddenDuplicateAgreementPerRaterMinimum: {
      threshold: 0.95;
      passed: boolean;
    };
    majorityConsensusDuplicateAgreementMinimum: {
      threshold: { agreements: 127; denominator: 128 };
      actual: { agreements: number; denominator: 128 };
      passed: boolean;
    };
    everyPairwiseAgreementMinimum: {
      threshold: 0.75;
      passed: boolean;
    };
    fleissKappaMinimum: {
      threshold: 0.6;
      actual: number;
      passed: boolean;
    };
    maximumIdenticalCopyPassRateDifference: {
      threshold: 0.05;
      passed: boolean;
    };
    majorityFailNeedsConcreteDefectsFromRaters: {
      threshold: 2;
      majorityFailures: number;
      supported: number;
      passed: boolean;
    };
  };
  reliability: {
    status: "failed";
    measurementUsable: false;
    blockers: string[];
  };
  answerKey: {
    unsealingAllowed: false;
    validated: false;
    parsed: false;
  };
  consensus: null;
  performance: null;
  instability: {
    historicalSwing: "88/128-to-0/128";
    resolvedByCalibratedRound: false;
    reason: string;
  };
  evidenceStatus: {
    measurementReliability: "failed";
    architecturePerformance: "not-unsealed";
    humanRecognisabilityReleaseGate: "blocked";
    liveInputMayProceed: false;
    inputOverall: false;
  };
  blockers: string[];
  nextAction: string;
}

const absolute = (file: string): string => path.join(REPO, file);
const sha256 = (bytes: string | Buffer): string =>
  createHash("sha256").update(bytes).digest("hex");
const fileHash = (file: string): string => sha256(readFileSync(absolute(file)));
const parse = <T>(label: string, bytes: string): T => {
  try {
    return JSON.parse(bytes) as T;
  } catch (error) {
    throw new Error(`CALIBRATION REFUSED: ${label} is invalid JSON: ${error}`);
  }
};
const refuse = (message: string): never => {
  throw new Error(`CALIBRATION REFUSED: ${message}`);
};
const check: (condition: unknown, message: string) => asserts condition = (
  condition,
  message,
) => {
  if (!condition) refuse(message);
};
const exactKeys = (
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean =>
  JSON.stringify(Object.keys(value).sort()) ===
  JSON.stringify([...expected].sort());
const concreteDefect = (defect: unknown): defect is string =>
  typeof defect === "string" &&
  defect.trim().length >= 20 &&
  !IMPLEMENTATION_LEAK.test(defect);

const containedRegularFile = (relativeFile: string, root: string): string => {
  check(!path.isAbsolute(relativeFile), `${relativeFile} must be relative`);
  const absoluteRoot = absolute(root);
  const candidate = path.resolve(absoluteRoot, relativeFile);
  const lexical = path.relative(absoluteRoot, candidate);
  check(
    lexical !== "" && !lexical.startsWith("..") && !path.isAbsolute(lexical),
    `${relativeFile} escapes ${root}`,
  );
  const stat = lstatSync(candidate);
  check(
    stat.isFile() && !stat.isSymbolicLink(),
    `${relativeFile} is not a regular file`,
  );
  const resolved = path.relative(
    realpathSync(absoluteRoot),
    realpathSync(candidate),
  );
  check(
    resolved !== "" && !resolved.startsWith("..") && !path.isAbsolute(resolved),
    `${relativeFile} resolves outside ${root}`,
  );
  return candidate;
};

const validateHistoricalContinuity = (
  receipt: CalibrationReceipt,
): InputFieldCalibratedAdjudication["integrity"]["historicalContinuity"] => {
  const historicalEntries = Object.entries(
    receipt.preservation.historicalArtifactHashes,
  );
  for (const [file, expectedHash] of historicalEntries) {
    containedRegularFile(file, ".");
    check(fileHash(file) === expectedHash, `${file} historical bytes differ`);
  }
  const v1 = parse<EvidenceReceipt>(
    "v1 receipt",
    readFileSync(absolute(`${V1_ROOT}/receipt.json`), "utf8"),
  );
  const v2 = parse<EvidenceReceipt>(
    "v2 receipt",
    readFileSync(absolute(`${V2_ROOT}/receipt.json`), "utf8"),
  );
  check(
    v1.matrix.sampleMatrixHash === v2.matrix.sampleMatrixHash &&
      v1.matrix.sampleMatrixHash === receipt.continuity.sampleMatrixHash &&
      JSON.stringify(v1.matrix.cells) === JSON.stringify(v2.matrix.cells) &&
      v1.matrix.cells.length === 128,
    "v1/v2 calibrated matrix continuity differs",
  );
  check(
    v1.provenance.sourceCommit === v2.provenance.sourceCommit &&
      v1.provenance.sourceCommit === receipt.continuity.sourceCommit &&
      (v1.provenance.fixtureHash ?? v1.provenance.comparisonFixtureHash) ===
        (v2.provenance.fixtureHash ?? v2.provenance.comparisonFixtureHash) &&
      v1.provenance.environmentHash === v2.provenance.environmentHash &&
      v1.provenance.environmentHash === receipt.continuity.environmentHash,
    "v1/v2 source, fixture, or environment continuity differs",
  );
  const byCell = (artifacts: Artifact[]) =>
    new Map(artifacts.map((artifact) => [artifact.cellKey, artifact]));
  const v1References = byCell(v1.references);
  const v2References = byCell(v2.references);
  const v1Legacy = byCell(v1.outputs.legacy);
  const v2Legacy = byCell(v2.outputs.legacy);
  let referenceEqual = 0;
  let legacyEqual = 0;
  for (const { key } of v1.matrix.cells) {
    const references = [v1References.get(key), v2References.get(key)];
    const legacy = [v1Legacy.get(key), v2Legacy.get(key)];
    check(
      references.every(Boolean) && legacy.every(Boolean),
      `${key} historical continuity row is incomplete`,
    );
    for (const artifact of [...references, ...legacy]) {
      check(
        artifact && fileHash(artifact.file) === artifact.hash,
        `${key} historical artifact hash differs`,
      );
    }
    if (references[0]!.hash === references[1]!.hash) referenceEqual += 1;
    if (legacy[0]!.hash === legacy[1]!.hash) legacyEqual += 1;
  }
  check(
    referenceEqual === 128 &&
      legacyEqual === 128 &&
      receipt.continuity.referenceBytesEqualV1ToV2 === 128 &&
      receipt.continuity.legacyBytesEqualV1ToV2 === 128 &&
      receipt.continuity.cells.length === 128,
    "v1/v2 unchanged reference or legacy bytes differ",
  );
  return {
    status: "passed",
    historicalArtifactsUnchanged: historicalEntries.length,
    exactMatrixCells: 128,
    v1V2ReferenceBytesEqual: 128,
    v1V2LegacyBytesEqual: 128,
  };
};

const validateSourceReferenceProvenance = (
  receipt: CalibrationReceipt,
): InputFieldCalibratedAdjudication["integrity"]["sourceReferenceProvenance"] => {
  const sourceReferences = (root: string): { sourceReferences: unknown[] } =>
    parse(
      `${root} adjudication`,
      readFileSync(absolute(`${root}/comparison-result.json`), "utf8"),
    );
  const v1 = sourceReferences(V1_ROOT).sourceReferences;
  const v2 = sourceReferences(V2_ROOT).sourceReferences;
  const provenanceHash = sha256(JSON.stringify(v1));
  check(
    v1.length === 128 &&
      JSON.stringify(v1) === JSON.stringify(v2) &&
      receipt.continuity.sourceReferenceProvenanceEqualV1ToV2 === 128 &&
      receipt.continuity.sourceReferenceProvenanceHash === provenanceHash,
    "source-reference provenance differs",
  );
  return { status: "passed", exactRecords: 128, provenanceHash };
};

const validatePacketPaths = (
  packet: BlindPacket,
): InputFieldCalibratedAdjudication["integrity"]["packet"] => {
  const taskIds = new Set<string>();
  const referenceIds = new Set<string>();
  const specimenIds = new Set<string>();
  let paths = 0;
  for (const task of packet.tasks) {
    taskIds.add(task.taskId);
    referenceIds.add(task.reference.referenceId);
    specimenIds.add(task.specimen.specimenId);
    containedRegularFile(task.reference.image, BLIND_ROOT);
    containedRegularFile(task.specimen.image, BLIND_ROOT);
    paths += 2;
  }
  check(
    taskIds.size === 384 &&
      referenceIds.size === 384 &&
      specimenIds.size === 384 &&
      paths === 768,
    "packet identifiers or image paths are incomplete",
  );
  return {
    status: "passed",
    tasks: 384,
    uniqueTaskIds: 384,
    uniqueReferenceIds: 384,
    uniqueSpecimenIds: 384,
    containedRegularImagePaths: 768,
    pathBoundaryEscapes: 0,
    packetHashMatchesCommitment: true,
    randomizedBatchHashMatchesCommitment: true,
  };
};

const validateGradeRows = (
  rater: Rater,
  file: string,
  bytes: string,
  batch: SubmittedBatch,
  packet: BlindPacket,
  packetHash: string,
): GradeValidation => {
  check(Array.isArray(batch.grades), `${rater} grades array is missing`);
  check(batch.grades.length === 384, `${rater} grade count differs`);
  const taskIds = new Set<string>();
  for (const [index, grade] of batch.grades.entries()) {
    const task = packet.tasks[index]!;
    check(
      exactKeys(grade as unknown as Record<string, unknown>, [
        "taskId",
        "referenceId",
        "specimenId",
        "recognisable",
        "confidence",
        "criteria",
        "defects",
      ]),
      `${rater} ${grade.taskId} grade fields differ`,
    );
    check(
      grade.taskId === task.taskId &&
        grade.referenceId === task.reference.referenceId &&
        grade.specimenId === task.specimen.specimenId,
      `${rater} grade order or identifiers differ`,
    );
    check(!taskIds.has(grade.taskId), `${rater} repeats ${grade.taskId}`);
    taskIds.add(grade.taskId);
    check(
      ["low", "medium", "high"].includes(grade.confidence) &&
        exactKeys(grade.criteria, CATEGORIES),
      `${rater} ${grade.taskId} confidence or criteria differ`,
    );
    for (const category of CATEGORIES) {
      const allowed =
        category === CATEGORIES[0]
          ? ["match", "fail"]
          : ["match", "minor", "material"];
      const verdict = grade.criteria[category];
      check(
        allowed.includes(verdict),
        `${rater} ${grade.taskId} ${category} verdict differs`,
      );
      if (verdict === "fail" || verdict === "material") {
        check(
          grade.defects.some((defect) => defect.startsWith(`${category}:`)),
          `${rater} ${grade.taskId} ${category} lacks a concrete defect`,
        );
      }
    }
    check(
      grade.defects.every(concreteDefect) &&
        grade.defects.every((defect) =>
          CATEGORIES.some((category) => defect.startsWith(`${category}:`)),
        ),
      `${rater} ${grade.taskId} failure defects or provenance differ`,
    );
    const expectedRecognisable =
      grade.criteria[CATEGORIES[0]] === "match" &&
      CATEGORIES.slice(1).every(
        (category) => grade.criteria[category] !== "material",
      );
    check(
      grade.recognisable === expectedRecognisable &&
        (grade.recognisable || grade.defects.length > 0),
      `${rater} ${grade.taskId} pass rule or failure defects differ`,
    );
  }

  const expectedFields = [
    "version",
    "rater",
    "independentBlindGrade",
    "packetHash",
    "randomizedBatchHash",
    "calibrationCommitmentHash",
    "rubricHash",
    "counts",
    "grades",
  ];
  const actualFields = Object.keys(batch);
  const missingFields = expectedFields.filter(
    (field) => !actualFields.includes(field),
  );
  const unexpectedFields = actualFields.filter(
    (field) => !expectedFields.includes(field),
  );
  let strictReaderError = "strict reader unexpectedly accepted submission";
  try {
    validateCalibratedGradeBatch(
      packet,
      batch as unknown as CalibratedGradeBatch,
      rater,
      packetHash,
    );
  } catch (error) {
    strictReaderError = error instanceof Error ? error.message : String(error);
  }
  check(
    strictReaderError !== "strict reader unexpectedly accepted submission",
    `${rater} strict schema unexpectedly passed`,
  );
  const submittedRecognisable = batch.grades.filter(
    (grade) => grade.recognisable,
  ).length;
  return {
    rater,
    path: file,
    sha256: sha256(bytes),
    submittedRecognisable,
    submittedUnrecognisable: 384 - submittedRecognisable,
    gradeCount: 384,
    uniqueTaskIds: 384,
    exactPacketOrderAndIds: true,
    verdictsAndPassRuleValid: true,
    failureDefectsComplete: true,
    categoryDefectCoverageComplete: true,
    implementationOrDuplicateGuessesAbsent: true,
    submittedBindingFields: {
      randomizedBatchHashMatches:
        batch.randomizedBatchHash === packet.randomizedBatchHash,
      calibrationCommitmentMatches:
        batch.calibrationCommitment === packet.calibrationCommitmentHash,
    },
    declaredEnvelope: {
      valid: false,
      missingFields,
      unexpectedFields,
      criterionObjectsPresent: false,
      strictReaderError,
    },
    validAndCompleteRater: false,
  };
};

const kappa = (
  left: readonly boolean[],
  right: readonly boolean[],
): {
  agreements: number;
  ratio: number;
  cohensKappa: number;
} => {
  check(
    left.length === right.length && left.length > 0,
    "pairwise vectors differ",
  );
  const agreements = left.filter(
    (value, index) => value === right[index],
  ).length;
  const ratio = agreements / left.length;
  const leftPass = left.filter(Boolean).length / left.length;
  const rightPass = right.filter(Boolean).length / right.length;
  const expected = leftPass * rightPass + (1 - leftPass) * (1 - rightPass);
  return {
    agreements,
    ratio,
    cohensKappa:
      expected === 1
        ? ratio === 1
          ? 1
          : 0
        : (ratio - expected) / (1 - expected),
  };
};

const computeOpaqueAgreement = (
  packet: BlindPacket,
  batches: Record<Rater, SubmittedBatch>,
): InputFieldCalibratedAdjudication["opaqueAgreement"] => {
  const rows = packet.tasks.map((_, index) => {
    const votes = RATERS.map(
      (rater) => batches[rater].grades[index]!.recognisable,
    );
    const passes = votes.filter(Boolean).length;
    return {
      votes,
      passes,
      pattern: votes.map((vote) => (vote ? "P" : "F")).join(""),
      majority: passes >= 2,
    };
  });
  const pairwise = (
    [
      ["BATCH-CAL-A", "BATCH-CAL-B"],
      ["BATCH-CAL-A", "BATCH-CAL-C"],
      ["BATCH-CAL-B", "BATCH-CAL-C"],
    ] as const
  ).map(([left, right]): PairwiseMetric => {
    const metric = kappa(
      batches[left].grades.map((grade) => grade.recognisable),
      batches[right].grades.map((grade) => grade.recognisable),
    );
    return {
      raters: `${left}/${right}`,
      agreements: metric.agreements,
      denominator: 384,
      ratio: metric.ratio,
      cohensKappa: metric.cohensKappa,
      threshold: 0.75,
      passed: metric.ratio >= 0.75,
    };
  });
  const unanimousRows = rows.filter(
    (row) => row.passes === 0 || row.passes === 3,
  );
  const observedPairwiseAgreement =
    rows.reduce((total, row) => {
      const failures = 3 - row.passes;
      return (
        total + (row.passes * (row.passes - 1) + failures * (failures - 1)) / 6
      );
    }, 0) / 384;
  const passPrevalence =
    RATERS.reduce(
      (total, rater) =>
        total +
        batches[rater].grades.filter((grade) => grade.recognisable).length,
      0,
    ) / 1152;
  const expectedPairwiseAgreement =
    passPrevalence ** 2 + (1 - passPrevalence) ** 2;
  const fleissKappa =
    expectedPairwiseAgreement === 1
      ? observedPairwiseAgreement === 1
        ? 1
        : 0
      : (observedPairwiseAgreement - expectedPairwiseAgreement) /
        (1 - expectedPairwiseAgreement);
  const majorityFailureIndexes = rows.flatMap((row, index) =>
    row.majority ? [] : [index],
  );
  const supportedFailures = majorityFailureIndexes.filter(
    (index) =>
      RATERS.filter((rater) => {
        const grade = batches[rater].grades[index]!;
        return !grade.recognisable && grade.defects.every(concreteDefect);
      }).length >= 2,
  ).length;
  const patterns = [...new Set(rows.map((row) => row.pattern))].sort();
  return {
    perRaterPasses: Object.fromEntries(
      RATERS.map((rater) => {
        const recognisable = batches[rater].grades.filter(
          (grade) => grade.recognisable,
        ).length;
        return [
          rater,
          {
            recognisable,
            denominator: 384 as const,
            ratio: recognisable / 384,
          },
        ];
      }),
    ) as InputFieldCalibratedAdjudication["opaqueAgreement"]["perRaterPasses"],
    unanimous: {
      count: unanimousRows.length,
      ratio: unanimousRows.length / 384,
      unanimousPass: unanimousRows.filter((row) => row.passes === 3).length,
      unanimousFail: unanimousRows.filter((row) => row.passes === 0).length,
    },
    split: {
      count: 384 - unanimousRows.length,
      ratio: (384 - unanimousRows.length) / 384,
    },
    votePatterns: Object.fromEntries(
      patterns.map((pattern) => [
        pattern,
        rows.filter((row) => row.pattern === pattern).length,
      ]),
    ),
    pairwise,
    overallPairwiseAgreement: observedPairwiseAgreement,
    fleissKappa,
    majorityFailureRows: majorityFailureIndexes.length,
    majorityFailuresWithTwoConcreteRaterDefectSets: supportedFailures,
  };
};

const validateDuplicateIntegrity = (
  receipt: CalibrationReceipt,
  packet: BlindPacket,
  batches: Record<Rater, SubmittedBatch>,
): InputFieldCalibratedAdjudication["duplicateIntegrity"] => {
  const specimenTasks = new Map(
    packet.tasks.map((task) => [task.specimen.specimenId, task]),
  );
  const grades = Object.fromEntries(
    RATERS.map((rater) => [
      rater,
      new Map(
        batches[rater].grades.map(
          (grade) => [grade.specimenId, grade] as const,
        ),
      ),
    ]),
  ) as Record<Rater, Map<string, SubmittedGrade>>;
  const proofs = receipt.calibratedBatch.duplicateProof;
  check(proofs.length === 128, "duplicate proof cardinality differs");
  const pairedSpecimens = new Set<string>();
  const pairedCells = new Set<string>();
  for (const proof of proofs) {
    check(
      exactKeys(proof as unknown as Record<string, unknown>, [
        "cellKey",
        "copyASpecimenId",
        "copyAPath",
        "copyBSpecimenId",
        "copyBPath",
        "sha256",
        "byteIdentical",
      ]) &&
        proof.byteIdentical &&
        !pairedCells.has(proof.cellKey) &&
        proof.copyASpecimenId !== proof.copyBSpecimenId &&
        !pairedSpecimens.has(proof.copyASpecimenId) &&
        !pairedSpecimens.has(proof.copyBSpecimenId),
      `${proof.cellKey} duplicate proof is repeated or malformed`,
    );
    pairedCells.add(proof.cellKey);
    pairedSpecimens.add(proof.copyASpecimenId);
    pairedSpecimens.add(proof.copyBSpecimenId);
    const copyATask = specimenTasks.get(proof.copyASpecimenId);
    const copyBTask = specimenTasks.get(proof.copyBSpecimenId);
    check(
      copyATask &&
        copyBTask &&
        proof.copyAPath === `blind-packet/${copyATask.specimen.image}` &&
        proof.copyBPath === `blind-packet/${copyBTask.specimen.image}`,
      `${proof.cellKey} duplicate proof does not bind packet specimens`,
    );
    const copyA = readFileSync(containedRegularFile(proof.copyAPath, ROOT));
    const copyB = readFileSync(containedRegularFile(proof.copyBPath, ROOT));
    check(
      sha256(copyA) === proof.sha256 &&
        sha256(copyB) === proof.sha256 &&
        copyA.equals(copyB),
      `${proof.cellKey} duplicate bytes differ`,
    );
  }
  check(
    pairedSpecimens.size === 256 && pairedCells.size === 128,
    "duplicate proof is not bijective",
  );

  const byRater = Object.fromEntries(
    RATERS.map((rater) => {
      let agreements = 0;
      let copyAPasses = 0;
      let copyBPasses = 0;
      for (const proof of proofs) {
        const copyA = grades[rater].get(proof.copyASpecimenId);
        const copyB = grades[rater].get(proof.copyBSpecimenId);
        check(copyA && copyB, `${rater} duplicate grades are incomplete`);
        if (copyA.recognisable === copyB.recognisable) agreements += 1;
        if (copyA.recognisable) copyAPasses += 1;
        if (copyB.recognisable) copyBPasses += 1;
      }
      const percentagePointDifference =
        Math.abs(copyAPasses - copyBPasses) / 128;
      return [
        rater,
        {
          agreements,
          denominator: 128 as const,
          ratio: agreements / 128,
          threshold: 0.95 as const,
          agreementPassed: agreements / 128 >= 0.95,
          copyAPasses,
          copyBPasses,
          percentagePointDifference,
          maximumDifference: 0.05 as const,
          passRateDifferencePassed: percentagePointDifference <= 0.05,
        },
      ];
    }),
  ) as Record<Rater, DuplicateRaterMetric>;
  let majorityAgreements = 0;
  for (const proof of proofs) {
    const copyAPasses = RATERS.filter(
      (rater) => grades[rater].get(proof.copyASpecimenId)!.recognisable,
    ).length;
    const copyBPasses = RATERS.filter(
      (rater) => grades[rater].get(proof.copyBSpecimenId)!.recognisable,
    ).length;
    if (copyAPasses >= 2 === copyBPasses >= 2) majorityAgreements += 1;
  }
  return {
    status: "passed",
    pairs: 128,
    uniquePairedSpecimens: 256,
    byteIdenticalPairs: 128,
    containedRegularPaths: 256,
    implementationIdentityUsed: false,
    byRater,
    majorityConsensus: {
      agreements: majorityAgreements,
      denominator: 128,
      ratio: majorityAgreements / 128,
      mismatchedPairCount: 128 - majorityAgreements,
      thresholdAgreements: 127,
      passed: majorityAgreements >= 127,
    },
  };
};

export const readInputFieldCalibratedAdjudicationSources =
  (): CalibrationAdjudicationSources => ({
    protocol: readFileSync(absolute(CALIBRATION_PROTOCOL_PATH), "utf8"),
    packet: readFileSync(absolute(CALIBRATION_PACKET_PATH), "utf8"),
    receipt: readFileSync(absolute(CALIBRATION_RECEIPT_PATH), "utf8"),
    index: readFileSync(absolute(CALIBRATION_INDEX_PATH), "utf8"),
    grades: Object.fromEntries(
      RATERS.map((rater, index) => [
        rater,
        readFileSync(absolute(CALIBRATION_GRADE_PATHS[index]!), "utf8"),
      ]),
    ) as Record<Rater, string>,
    sealedAnswerKeyBytes: readFileSync(absolute(CALIBRATION_KEY_PATH)),
  });

export function adjudicateInputFieldCalibrated(
  sources: CalibrationAdjudicationSources,
): InputFieldCalibratedAdjudication {
  const protocol = parse<
    Parameters<typeof validatePredeclaredCalibrationProtocol>[0]
  >("calibration protocol", sources.protocol);
  validatePredeclaredCalibrationProtocol(protocol);
  const packet = parse<BlindPacket>("blind packet", sources.packet);
  validateCalibratedPacketDocument(packet, protocol);
  const receipt = parse<CalibrationReceipt>(
    "calibration receipt",
    sources.receipt,
  );
  const index = parse<CalibrationIndex>("calibration index", sources.index);
  const protocolHash = sha256(sources.protocol);
  const packetHash = sha256(sources.packet);
  const receiptHash = sha256(sources.receipt);
  const sealedAnswerKeyHash = sha256(sources.sealedAnswerKeyBytes);
  check(
    index.protocol === CALIBRATION_PROTOCOL_PATH &&
      index.protocolHash === protocolHash &&
      index.packet === CALIBRATION_PACKET_PATH &&
      index.packetHash === packetHash &&
      index.receipt === CALIBRATION_RECEIPT_PATH &&
      index.receiptHash === receiptHash &&
      index.sealedAnswerKey === CALIBRATION_KEY_PATH &&
      index.sealedAnswerKeyHash === sealedAnswerKeyHash &&
      JSON.stringify(index.allowedGradeOutputs) ===
        JSON.stringify(CALIBRATION_GRADE_PATHS),
    "index path or hash pins differ",
  );
  check(
    receipt.commitment.protocol === CALIBRATION_PROTOCOL_PATH &&
      receipt.commitment.protocolHash === protocolHash &&
      receipt.commitment.packet === CALIBRATION_PACKET_PATH &&
      receipt.commitment.packetHash === packetHash &&
      receipt.commitment.randomizedBatchHash === packet.randomizedBatchHash &&
      receipt.commitment.commitmentHash === packet.calibrationCommitmentHash &&
      receipt.commitment.rubricHash === packet.rubricHash &&
      receipt.commitment.sealedAnswerKey === CALIBRATION_KEY_PATH &&
      receipt.commitment.sealedAnswerKeyHash === sealedAnswerKeyHash &&
      receipt.commitment.lockedBeforeGrading &&
      !receipt.commitment.recognisabilityVerdictsAuthoredByBuilder,
    "receipt commitment or hash pins differ",
  );
  check(
    JSON.stringify(receipt.predeclaredAcceptance) ===
      JSON.stringify(protocol.acceptance) &&
      JSON.stringify(receipt.progressArithmetic) ===
        JSON.stringify(protocol.progressArithmetic),
    "receipt thresholds or progress arithmetic changed",
  );
  check(
    !index.overall &&
      !index.gradeWritten &&
      !index.liveInputMayProceed &&
      !receipt.status.liveInputMayProceed &&
      !receipt.status.inputOverall &&
      receipt.status.architectureProgress === "blocked",
    "pre-grade evidence status was rewritten",
  );

  const historicalContinuity = validateHistoricalContinuity(receipt);
  const sourceReferenceProvenance = validateSourceReferenceProvenance(receipt);
  const packetIntegrity = validatePacketPaths(packet);
  const batches = Object.fromEntries(
    RATERS.map((rater) => [
      rater,
      parse<SubmittedBatch>(`${rater} grade batch`, sources.grades[rater]),
    ]),
  ) as Record<Rater, SubmittedBatch>;
  const gradeValidations = RATERS.map((rater, index) =>
    validateGradeRows(
      rater,
      CALIBRATION_GRADE_PATHS[index]!,
      sources.grades[rater],
      batches[rater],
      packet,
      packetHash,
    ),
  );

  // This phase uses packet-order IDs and rater verdicts only.
  const opaqueAgreement = computeOpaqueAgreement(packet, batches);

  // Duplicate membership is opened separately from implementation identity.
  const duplicateIntegrity = validateDuplicateIntegrity(
    receipt,
    packet,
    batches,
  );
  const validRaters = gradeValidations.filter(
    (validation) => validation.validAndCompleteRater,
  ).length;
  const hiddenDuplicatePassed = Object.values(duplicateIntegrity.byRater).every(
    (metric) => metric.agreementPassed,
  );
  const pairwisePassed = opaqueAgreement.pairwise.every(
    (metric) => metric.passed,
  );
  const passRateDifferencePassed = Object.values(
    duplicateIntegrity.byRater,
  ).every((metric) => metric.passRateDifferencePassed);
  const defectSupportPassed =
    opaqueAgreement.majorityFailureRows ===
    opaqueAgreement.majorityFailuresWithTwoConcreteRaterDefectSets;
  const blockers = [
    "All three submitted grade files violate the predeclared grade envelope: required packet/rubric hash fields, counts, independent-blind declaration, canonical rater field, and criterion defect objects are absent or differently named.",
    `Fleiss kappa ${opaqueAgreement.fleissKappa} is below the locked 0.60 minimum.`,
  ];
  const nextAction =
    "Preserve these refused submissions, calibrate raters on separate opaque examples, then commission three fresh complete blind grade files under a newly versioned packet whose serialized grade envelope is explicit; do not transform or reuse these rows.";
  return {
    artifactVersion: "input-field-calibrated-adjudication-v1",
    sequence: {
      opaqueGradeValidationCompletedBeforeDuplicatePairing: true,
      pairwiseAndFleissComputedOnOpaquePacketOrder: true,
      duplicatePairingCheckedInSeparateIntegrityPhase: true,
      duplicatePhaseUsedImplementationIdentity: false,
      answerKeyHashCheckedWithoutParsing: true,
      answerKeyParsed: false,
      performanceIdentityUnsealed: false,
    },
    inputHashes: {
      protocol: protocolHash,
      packet: packetHash,
      receipt: receiptHash,
      index: sha256(sources.index),
      grades: Object.fromEntries(
        RATERS.map((rater) => [rater, sha256(sources.grades[rater])]),
      ) as Record<Rater, string>,
      sealedAnswerKeyCommitment: sealedAnswerKeyHash,
    },
    integrity: {
      protocolCommitment: "passed",
      receiptAndIndexPins: "passed",
      sourceReferenceProvenance,
      historicalContinuity,
      packet: packetIntegrity,
      sealedAnswerKey: {
        sha256: sealedAnswerKeyHash,
        hashMatchesCommitment: true,
        parsed: false,
        validationDeferredUntilReliabilityPasses: true,
      },
    },
    gradeValidations,
    opaqueAgreement,
    duplicateIntegrity,
    thresholds: {
      source: "calibration-receipt-predeclared-acceptance",
      unchanged: true,
      allThreeRatersValidAndComplete: {
        required: 3,
        actual: validRaters,
        passed: false,
      },
      hiddenDuplicateAgreementPerRaterMinimum: {
        threshold: 0.95,
        passed: hiddenDuplicatePassed,
      },
      majorityConsensusDuplicateAgreementMinimum: {
        threshold: { agreements: 127, denominator: 128 },
        actual: {
          agreements: duplicateIntegrity.majorityConsensus.agreements,
          denominator: 128,
        },
        passed: duplicateIntegrity.majorityConsensus.passed,
      },
      everyPairwiseAgreementMinimum: {
        threshold: 0.75,
        passed: pairwisePassed,
      },
      fleissKappaMinimum: {
        threshold: 0.6,
        actual: opaqueAgreement.fleissKappa,
        passed: opaqueAgreement.fleissKappa >= 0.6,
      },
      maximumIdenticalCopyPassRateDifference: {
        threshold: 0.05,
        passed: passRateDifferencePassed,
      },
      majorityFailNeedsConcreteDefectsFromRaters: {
        threshold: 2,
        majorityFailures: opaqueAgreement.majorityFailureRows,
        supported:
          opaqueAgreement.majorityFailuresWithTwoConcreteRaterDefectSets,
        passed: defectSupportPassed,
      },
    },
    reliability: {
      status: "failed",
      measurementUsable: false,
      blockers,
    },
    answerKey: {
      unsealingAllowed: false,
      validated: false,
      parsed: false,
    },
    consensus: null,
    performance: null,
    instability: {
      historicalSwing: "88/128-to-0/128",
      resolvedByCalibratedRound: false,
      reason:
        "The calibrated round failed pre-unseal reliability, so no implementation-labelled consensus can be computed and the historical unchanged-control instability remains unresolved.",
    },
    evidenceStatus: {
      measurementReliability: "failed",
      architecturePerformance: "not-unsealed",
      humanRecognisabilityReleaseGate: "blocked",
      liveInputMayProceed: false,
      inputOverall: false,
    },
    blockers,
    nextAction,
  };
}

export function validateCommittedInputFieldCalibratedAdjudication(
  artifact: InputFieldCalibratedAdjudication,
  sources: CalibrationAdjudicationSources = readInputFieldCalibratedAdjudicationSources(),
): InputFieldCalibratedAdjudication {
  const recomputed = adjudicateInputFieldCalibrated(sources);
  check(
    JSON.stringify(artifact) === JSON.stringify(recomputed),
    "calibrated adjudication hashes, thresholds, arithmetic, or verdict differ",
  );
  return recomputed;
}

const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const result = adjudicateInputFieldCalibrated(
    readInputFieldCalibratedAdjudicationSources(),
  );
  if (process.argv.includes("--write")) {
    const bytes = await format(JSON.stringify(result), { parser: "json" });
    writeFileSync(absolute(CALIBRATED_ADJUDICATION_PATH), bytes);
    console.log(
      `WROTE ${CALIBRATED_ADJUDICATION_PATH} sha256=${sha256(bytes)}`,
    );
  } else {
    const committed = parse<InputFieldCalibratedAdjudication>(
      "committed calibrated adjudication",
      readFileSync(absolute(CALIBRATED_ADJUDICATION_PATH), "utf8"),
    );
    validateCommittedInputFieldCalibratedAdjudication(committed);
    console.log(
      `Input/Field calibrated reliability ${result.reliability.status}; answer key unsealed=${result.answerKey.unsealingAllowed}; sha256=${fileHash(
        CALIBRATED_ADJUDICATION_PATH,
      )}`,
    );
  }
}
