import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { format } from "prettier";

import {
  adjudicateInputFieldV2Comparison,
  readInputFieldV2AdjudicationSources,
  type InputFieldV2ComparisonAdjudication,
} from "./input-field-comparison-v2-adjudication.js";

const V1_ROOT = "recipe/evidence/input-field-comparison";
const V2_ROOT = "recipe/evidence/input-field-comparison-v2";
const BLIND_ROOT = `${V2_ROOT}/blind-packet`;

export const INPUT_FIELD_V2_MULTI_RATER_ADJUDICATION_PATH = `${V2_ROOT}/multi-rater-adjudication.json`;

const RATERS = ["A", "B", "C"] as const;
const CONFIDENCES = ["low", "medium", "high"] as const;
const MINIMUM_PAIRWISE_AGREEMENT = 0.75;
const MINIMUM_FLEISS_KAPPA = 0.6;
const IMPLEMENTATION_GUESS =
  /\blegacy\b|\brecipe(?:[- /]?react)?\b|\bweb[ -]?component\b|\bimplementation(?: path| guess)?\b|\bexpected[ -]?winner\b|\bmui\b|\bpolaris\b|@shopify|@mui/i;

type Rater = (typeof RATERS)[number];
type Confidence = (typeof CONFIDENCES)[number];

interface BlindProtocol {
  version: string;
  rubricHash: string;
  environmentHash: string;
  crop: string;
  scale: number;
  browser: string;
  fontsHash: string;
  passThreshold: string;
}

interface PacketSpecimen {
  anonymousLabel: string;
  image: string;
  outputHash: string;
  grade: { recognisable: null; defects: unknown[]; confidence: null };
}

interface BlindPacket {
  version: string;
  status: string;
  protocol: BlindProtocol;
  randomizedBatchHash: string;
  counts: {
    references: number;
    specimens: number;
    specimensPerReference: number;
  };
  cells: Array<{
    anonymousCell: string;
    reference: { image: string; screenshotHash: string };
    specimens: PacketSpecimen[];
  }>;
}

interface Grade {
  specimenId: string;
  referenceId: string;
  recognisable: boolean;
  confidence: Confidence;
  defects: string[];
}

interface FlatGradeBatch {
  protocol?: BlindProtocol;
  packetProtocol?: BlindProtocol;
  randomizedBatchHash: string;
  counts?: {
    references: number;
    specimens: number;
    grades: number;
    recognisable?: number;
    unrecognisable?: number;
  };
  grades: Grade[];
}

interface NestedGradeBatch {
  version: string;
  rater: string;
  protocol: BlindProtocol;
  randomizedBatchHash: string;
  counts: { references: number; specimens: number; grades: number };
  cells: Array<{
    anonymousCell: string;
    reference: { image: string; screenshotHash: string };
    specimens: Array<{
      anonymousLabel: string;
      image: string;
      outputHash: string;
      grade: {
        recognisable: boolean;
        confidence: Confidence;
        defects: string[];
      };
    }>;
  }>;
}

export interface InputFieldV2MultiRaterSourceBytes {
  packet: string;
  raterA: string;
  raterB: string;
  raterC: string;
  key: string;
  receipt: string;
}

interface RaterValidation {
  rater: Rater;
  hash: string;
  protocolMatches: true;
  randomizedBatchHashMatches: true;
  exactPacketOrder: true;
  exactReferenceOrder: true;
  uniqueSpecimenIds: 256;
  gradeCount: 256;
  countsValid: true;
  failureDefectsComplete: true;
  implementationGuessesAbsent: true;
  pathMetadataMatchesPacket: true | "not-applicable";
  recognisable: number;
  unrecognisable: number;
}

interface PairwiseAgreement {
  raters: `${Rater}-${Rater}`;
  agreements: number;
  total: 256;
  percentAgreement: number;
  cohensKappa: number;
}

interface ConfidenceDistribution {
  low: number;
  medium: number;
  high: number;
  total: number;
}

interface Disagreement {
  anonymousCell: string;
  specimenId: string;
  votePattern: string;
  confidences: Record<Rater, Confidence>;
}

interface AgreementAssessment {
  sequence: {
    computedBeforeAnswerKeyRead: true;
    identityFieldsUsed: false;
  };
  threshold: {
    recordedBeforeUnseal: true;
    minimumPairwiseAgreement: 0.75;
    minimumFleissKappa: 0.6;
    requireAllThreeValidRaters: true;
    requireTwoConcreteDefectRecordsForEveryMajorityFailure: true;
  };
  unanimousCount: number;
  unanimousPercent: number;
  twoOfThreeCount: number;
  twoOfThreePercent: number;
  perRaterPrevalence: Record<
    Rater,
    { recognisable: number; total: 256; ratio: number }
  >;
  pairwise: PairwiseAgreement[];
  overallPairwisePercentAgreement: number;
  allThreeExactPercentAgreement: number;
  fleissKappa: number;
  confidenceByRater: Record<Rater, ConfidenceDistribution>;
  votePatterns: Record<string, number>;
  disagreements: Disagreement[];
  majorityFailureRows: number;
  majorityFailuresWithTwoConcreteDefectRecords: number;
}

interface ReliabilityVerdict {
  status: "passed" | "failed";
  allRatersPresentAndValid: boolean;
  everyPairAtLeast75Percent: boolean;
  fleissKappaAtLeastPoint60: boolean;
  everyMajorityFailureHasTwoConcreteDefectRecords: boolean;
}

interface OpaqueConsensus {
  specimenId: string;
  referenceId: string;
  recognisable: boolean;
  decisionStrength: "unanimous" | "majority";
  passVotes: number;
  majorityConfidence: Confidence;
  raterVotes: Record<Rater, boolean>;
  raterConfidences: Record<Rater, Confidence>;
  failureDefectsByRater: Partial<Record<Rater, string[]>>;
}

interface ConsensusMapping extends Omit<
  InputFieldV2ComparisonAdjudication["mapping"][number],
  "recognisable" | "confidence" | "defects"
> {
  recognisable: boolean;
  confidence: Confidence;
  defects: string[];
  decisionStrength: "unanimous" | "majority";
  passVotes: number;
  raterVotes: Record<Rater, boolean>;
  raterConfidences: Record<Rater, Confidence>;
  failureDefectsByRater: Partial<Record<Rater, string[]>>;
}

interface DecisionStrengthDistribution {
  unanimousPass: number;
  majorityPass: number;
  unanimousFail: number;
  majorityFail: number;
}

type ConsensusAggregates = Omit<
  InputFieldV2ComparisonAdjudication["aggregates"],
  "byConfidence"
>;

interface InstabilityRow {
  cellKey: string;
  referenceHash: string;
  legacyOutputHash: string;
  v1: {
    anonymousCell: string;
    specimenId: string;
    recognisable: boolean;
  };
  v2RaterA: {
    anonymousCell: string;
    specimenId: string;
    recognisable: boolean;
  };
  v2Consensus: {
    recognisable: boolean;
    decisionStrength: "unanimous" | "majority";
  };
}

interface InterBatchInstability {
  unchangedInputs: {
    exactReferenceHashes: number;
    exactLegacyOutputHashes: number;
    total: 128;
  };
  passCounts: {
    immutableV1: 88;
    v2RaterA: 0;
    v2Consensus: number;
  };
  v1VersusV2RaterA: {
    agreements: number;
    percentAgreement: number;
    cohensKappa: number;
    passToFail: number;
    failToPass: number;
    exactMcNemarTwoSidedP: number;
  };
  v1VersusV2Consensus: {
    agreements: number;
    percentAgreement: number;
    cohensKappa: number;
    passToFail: number;
    failToPass: number;
    exactMcNemarTwoSidedP: number;
  };
  rows: InstabilityRow[];
  resolvedByMultiRaterConsensus: false;
  interpretation: string;
}

export interface InputFieldV2MultiRaterAdjudication {
  artifactVersion: "input-field-v2-multi-rater-adjudication-v1";
  inputHashes: {
    packet: string;
    raterA: string;
    raterB: string;
    raterC: string;
    sealedAnswerKey: string;
    evidenceReceipt: string;
    immutableV1Adjudication: string;
    preservedSingleRaterAdjudication: string;
  };
  raterValidations: RaterValidation[];
  packetValidation: {
    protocolHash: string;
    randomizedBatchHash: string;
    references: 128;
    specimens: 256;
    pathMetadataEntries: 384;
    pathBoundaryEscapes: 0;
    missingFiles: 0;
    imageHashMismatches: 0;
  };
  agreement: AgreementAssessment;
  reliability: ReliabilityVerdict;
  keyIntegrity: null | {
    validatedOnlyAfterReliabilityPassed: true;
    sealedAnswerKeyHash: string;
    consensusSyntheticGradeHash: string;
    baseIntegrityChecks: Record<string, true>;
  };
  consensus: null | {
    rule: "two-of-three-majority-per-specimen";
    mapping: ConsensusMapping[];
    aggregates: ConsensusAggregates;
    confidence: InputFieldV2ComparisonAdjudication["confidence"];
    byDecisionStrength: Record<
      "legacy" | "recipeReact",
      DecisionStrengthDistribution
    >;
    defects: InputFieldV2ComparisonAdjudication["defects"];
    webComponentParity: InputFieldV2ComparisonAdjudication["webComponentParity"];
    withinBatchOfflineCriterion: "passed" | "failed";
  };
  interBatchInstability: null | InterBatchInstability;
  supersession: {
    preservedSingleRaterArtifact: string;
    preservedSingleRaterArtifactHash: string;
    supersedesSingleRaterForProgressDecisions: true;
  };
  evidenceColumns: {
    measurementReliability: "passed" | "failed";
    withinV2ConsensusCriterion: "passed" | "failed" | "not-unsealed";
    interBatchLegacyStability: "failed" | "not-evaluated";
    architecturePerformance: "blocked" | "not-evaluated";
    webComponentParity: "passed-parity-only" | "not-evaluated";
    liveFigma: "pending";
    overallInputSuccess: false;
  };
  productVerdict: {
    status:
      | "blocked-inter-batch-measurement-instability"
      | "blocked-pre-unseal-reliability";
    pairedWinAccepted: false;
    recipeProgressClaimed: false;
    liveInputMayProceed: false;
    inputOverall: false;
    blockers: string[];
    nextTask: string;
  };
}

interface InternalAssessment {
  packet: BlindPacket;
  grades: Record<Rater, Grade[]>;
  validations: RaterValidation[];
  packetValidation: InputFieldV2MultiRaterAdjudication["packetValidation"];
  agreement: AgreementAssessment;
  reliability: ReliabilityVerdict;
  opaqueConsensus: OpaqueConsensus[];
}

const sha256 = (bytes: string | Buffer): string =>
  createHash("sha256").update(bytes).digest("hex");

const fileHash = (file: string): string => sha256(readFileSync(file));

const parse = <T>(name: string, bytes: string): T => {
  try {
    return JSON.parse(bytes) as T;
  } catch (error) {
    throw new Error(
      `NOT-COMPARABLE: ${name} is not valid JSON: ${String(error)}`,
    );
  }
};

const refuse = (message: string): never => {
  throw new Error(`NOT-COMPARABLE: ${message}`);
};

const assert: (condition: unknown, message: string) => asserts condition = (
  condition,
  message,
) => {
  if (!condition) refuse(message);
};

const exactKeys = (
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void => {
  assert(
    JSON.stringify(Object.keys(value).sort()) ===
      JSON.stringify([...expected].sort()),
    `${label} fields differ`,
  );
};

const assertContainedPacketFile = (
  relativeFile: string,
  expectedSubdirectory: "references" | "specimens",
): string => {
  assert(!path.isAbsolute(relativeFile), `${relativeFile} must be relative`);
  const directory = path.resolve(BLIND_ROOT, expectedSubdirectory);
  const absolute = path.resolve(BLIND_ROOT, relativeFile);
  const lexical = path.relative(directory, absolute);
  assert(
    lexical !== "" && !lexical.startsWith("..") && !path.isAbsolute(lexical),
    `${relativeFile} escapes ${expectedSubdirectory}`,
  );
  const stat = lstatSync(absolute);
  assert(
    stat.isFile() && !stat.isSymbolicLink(),
    `${relativeFile} is not a regular packet file`,
  );
  const resolved = path.relative(
    realpathSync(directory),
    realpathSync(absolute),
  );
  assert(
    resolved !== "" && !resolved.startsWith("..") && !path.isAbsolute(resolved),
    `${relativeFile} resolves outside ${expectedSubdirectory}`,
  );
  return absolute;
};

const confidenceDistribution = (
  grades: readonly Grade[],
): ConfidenceDistribution => ({
  low: grades.filter((grade) => grade.confidence === "low").length,
  medium: grades.filter((grade) => grade.confidence === "medium").length,
  high: grades.filter((grade) => grade.confidence === "high").length,
  total: grades.length,
});

const kappa = (
  left: readonly boolean[],
  right: readonly boolean[],
): { agreements: number; percentAgreement: number; kappa: number } => {
  assert(
    left.length === right.length && left.length > 0,
    "kappa inputs differ",
  );
  const agreements = left.filter(
    (value, index) => value === right[index],
  ).length;
  const observed = agreements / left.length;
  const leftPass = left.filter(Boolean).length / left.length;
  const rightPass = right.filter(Boolean).length / right.length;
  const expected = leftPass * rightPass + (1 - leftPass) * (1 - rightPass);
  return {
    agreements,
    percentAgreement: observed,
    kappa:
      expected === 1
        ? observed === 1
          ? 1
          : 0
        : (observed - expected) / (1 - expected),
  };
};

const confidenceMinimum = (values: readonly Confidence[]): Confidence => {
  const rank: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
  return [...values].sort((left, right) => rank[left] - rank[right])[0]!;
};

const normalizeNestedGrades = (
  batch: NestedGradeBatch,
  packet: BlindPacket,
): Grade[] =>
  batch.cells.flatMap((cell, cellIndex) => {
    const packetCell = packet.cells[cellIndex];
    assert(packetCell, `rater C has foreign cell ${cell.anonymousCell}`);
    assert(
      cell.anonymousCell === packetCell.anonymousCell &&
        JSON.stringify(cell.reference) ===
          JSON.stringify(packetCell.reference) &&
        cell.specimens.length === packetCell.specimens.length,
      `rater C path/reference metadata differs at ${cell.anonymousCell}`,
    );
    return cell.specimens.map((specimen, specimenIndex) => {
      const packetSpecimen = packetCell.specimens[specimenIndex];
      assert(
        packetSpecimen &&
          specimen.anonymousLabel === packetSpecimen.anonymousLabel &&
          specimen.image === packetSpecimen.image &&
          specimen.outputHash === packetSpecimen.outputHash,
        `rater C specimen metadata differs at ${specimen.anonymousLabel}`,
      );
      return {
        specimenId: specimen.anonymousLabel,
        referenceId: cell.anonymousCell,
        ...specimen.grade,
      };
    });
  });

const validateGradeBatch = (
  rater: Rater,
  batch: FlatGradeBatch,
  bytes: string,
  packet: BlindPacket,
  expectedIds: readonly string[],
  expectedReferences: readonly string[],
  pathMetadataMatchesPacket: true | "not-applicable",
): RaterValidation => {
  const protocol = batch.packetProtocol ?? batch.protocol;
  assert(
    JSON.stringify(protocol) === JSON.stringify(packet.protocol),
    `rater ${rater} protocol differs from packet`,
  );
  assert(
    batch.randomizedBatchHash === packet.randomizedBatchHash,
    `rater ${rater} randomized batch hash differs`,
  );
  const ids = batch.grades.map((grade) => grade.specimenId);
  const references = batch.grades.map((grade) => grade.referenceId);
  assert(
    batch.grades.length === 256 &&
      new Set(ids).size === 256 &&
      JSON.stringify(ids) === JSON.stringify(expectedIds),
    `rater ${rater} grade cardinality, uniqueness, or packet order differs`,
  );
  assert(
    JSON.stringify(references) === JSON.stringify(expectedReferences),
    `rater ${rater} reference order differs`,
  );
  for (const grade of batch.grades) {
    exactKeys(
      grade as unknown as Record<string, unknown>,
      ["specimenId", "referenceId", "recognisable", "confidence", "defects"],
      `rater ${rater} ${grade.specimenId}`,
    );
    assert(
      typeof grade.recognisable === "boolean" &&
        CONFIDENCES.includes(grade.confidence) &&
        Array.isArray(grade.defects) &&
        grade.defects.every(
          (defect) =>
            typeof defect === "string" &&
            defect.trim().length >= 20 &&
            !IMPLEMENTATION_GUESS.test(defect),
        ) &&
        (grade.recognisable || grade.defects.length > 0),
      `rater ${rater} grade fields or failure defects are invalid`,
    );
  }
  const recognisable = batch.grades.filter(
    (grade) => grade.recognisable,
  ).length;
  const counts = batch.counts;
  assert(
    !counts ||
      (counts.references === 128 &&
        counts.specimens === 256 &&
        counts.grades === 256 &&
        (counts.recognisable === undefined ||
          counts.recognisable === recognisable) &&
        (counts.unrecognisable === undefined ||
          counts.unrecognisable === 256 - recognisable)),
    `rater ${rater} count arithmetic differs`,
  );
  return {
    rater,
    hash: sha256(bytes),
    protocolMatches: true,
    randomizedBatchHashMatches: true,
    exactPacketOrder: true,
    exactReferenceOrder: true,
    uniqueSpecimenIds: 256,
    gradeCount: 256,
    countsValid: true,
    failureDefectsComplete: true,
    implementationGuessesAbsent: true,
    pathMetadataMatchesPacket,
    recognisable,
    unrecognisable: 256 - recognisable,
  };
};

const validateAndAssess = (
  sourceBytes: InputFieldV2MultiRaterSourceBytes,
): InternalAssessment => {
  // This phase intentionally has no answer-key parse or identity-bearing input.
  const packet = parse<BlindPacket>("blind packet", sourceBytes.packet);
  assert(
    packet.version === packet.protocol.version &&
      packet.status === "awaiting-independent-blind-grade" &&
      packet.counts.references === 128 &&
      packet.counts.specimens === 256 &&
      packet.counts.specimensPerReference === 2 &&
      packet.cells.length === 128,
    "packet protocol, status, or cardinality differs",
  );

  const packetRows = packet.cells.flatMap((cell) => {
    assert(
      /^cell-[a-f0-9]{12}$/.test(cell.anonymousCell) &&
        cell.specimens.length === 2,
      `${cell.anonymousCell} is not an opaque two-specimen cell`,
    );
    const referenceFile = assertContainedPacketFile(
      cell.reference.image,
      "references",
    );
    assert(
      fileHash(referenceFile) === cell.reference.screenshotHash,
      `${cell.anonymousCell} reference hash differs`,
    );
    return cell.specimens.map((specimen) => {
      assert(
        /^specimen-[a-f0-9]{12}$/.test(specimen.anonymousLabel) &&
          specimen.grade.recognisable === null &&
          specimen.grade.confidence === null &&
          specimen.grade.defects.length === 0,
        `${specimen.anonymousLabel} packet grade is not sealed`,
      );
      const specimenFile = assertContainedPacketFile(
        specimen.image,
        "specimens",
      );
      assert(
        fileHash(specimenFile) === specimen.outputHash,
        `${specimen.anonymousLabel} output hash differs`,
      );
      return {
        referenceId: cell.anonymousCell,
        specimenId: specimen.anonymousLabel,
      };
    });
  });
  assert(
    packetRows.length === 256 &&
      new Set(packetRows.map((row) => row.specimenId)).size === 256 &&
      new Set(packet.cells.map((cell) => cell.anonymousCell)).size === 128,
    "packet IDs are not unique and complete",
  );

  const raterA = parse<FlatGradeBatch>("rater A grades", sourceBytes.raterA);
  const raterB = parse<FlatGradeBatch>("rater B grades", sourceBytes.raterB);
  const raterCDocument = parse<NestedGradeBatch>(
    "rater C grades",
    sourceBytes.raterC,
  );
  assert(
    Array.isArray(raterA.grades) &&
      Array.isArray(raterB.grades) &&
      Array.isArray(raterCDocument.cells),
    "all three raters are required",
  );
  const raterCGrades = normalizeNestedGrades(raterCDocument, packet);
  const raterC: FlatGradeBatch = {
    protocol: raterCDocument.protocol,
    randomizedBatchHash: raterCDocument.randomizedBatchHash,
    counts: raterCDocument.counts,
    grades: raterCGrades,
  };
  const expectedIds = packetRows.map((row) => row.specimenId);
  const expectedReferences = packetRows.map((row) => row.referenceId);
  const validations = [
    validateGradeBatch(
      "A",
      raterA,
      sourceBytes.raterA,
      packet,
      expectedIds,
      expectedReferences,
      "not-applicable",
    ),
    validateGradeBatch(
      "B",
      raterB,
      sourceBytes.raterB,
      packet,
      expectedIds,
      expectedReferences,
      "not-applicable",
    ),
    validateGradeBatch(
      "C",
      raterC,
      sourceBytes.raterC,
      packet,
      expectedIds,
      expectedReferences,
      true,
    ),
  ];
  const grades: Record<Rater, Grade[]> = {
    A: raterA.grades,
    B: raterB.grades,
    C: raterCGrades,
  };

  const opaqueConsensus: OpaqueConsensus[] = packetRows.map(
    (packetRow, index) => {
      const rowGrades = RATERS.map((rater) => grades[rater][index]!);
      const passVotes = rowGrades.filter((grade) => grade.recognisable).length;
      const recognisable = passVotes >= 2;
      const majority = rowGrades.filter(
        (grade) => grade.recognisable === recognisable,
      );
      const failureDefectsByRater = Object.fromEntries(
        RATERS.flatMap((rater, raterIndex) => {
          const grade = rowGrades[raterIndex]!;
          return !grade.recognisable
            ? ([[rater, [...grade.defects]]] as const)
            : [];
        }),
      );
      return {
        specimenId: packetRow.specimenId,
        referenceId: packetRow.referenceId,
        recognisable,
        decisionStrength:
          passVotes === 0 || passVotes === 3 ? "unanimous" : "majority",
        passVotes,
        majorityConfidence: confidenceMinimum(
          majority.map((grade) => grade.confidence),
        ),
        raterVotes: Object.fromEntries(
          RATERS.map((rater, raterIndex) => [
            rater,
            rowGrades[raterIndex]!.recognisable,
          ]),
        ) as Record<Rater, boolean>,
        raterConfidences: Object.fromEntries(
          RATERS.map((rater, raterIndex) => [
            rater,
            rowGrades[raterIndex]!.confidence,
          ]),
        ) as Record<Rater, Confidence>,
        failureDefectsByRater,
      };
    },
  );

  const pairwise = [
    ["A", "B"],
    ["A", "C"],
    ["B", "C"],
  ].map(([left, right]) => {
    const result = kappa(
      grades[left as Rater].map((grade) => grade.recognisable),
      grades[right as Rater].map((grade) => grade.recognisable),
    );
    return {
      raters: `${left}-${right}` as `${Rater}-${Rater}`,
      agreements: result.agreements,
      total: 256 as const,
      percentAgreement: result.percentAgreement,
      cohensKappa: result.kappa,
    };
  });
  const unanimousCount = opaqueConsensus.filter(
    (row) => row.decisionStrength === "unanimous",
  ).length;
  const overallPairwisePercentAgreement =
    opaqueConsensus.reduce((total, row) => {
      const passes = row.passVotes;
      const failures = 3 - passes;
      return total + (passes * (passes - 1) + failures * (failures - 1)) / 6;
    }, 0) / 256;
  const passPrevalence =
    RATERS.reduce(
      (total, rater) =>
        total + grades[rater].filter((grade) => grade.recognisable).length,
      0,
    ) / 768;
  const expectedPairAgreement = passPrevalence ** 2 + (1 - passPrevalence) ** 2;
  const fleissKappa =
    (overallPairwisePercentAgreement - expectedPairAgreement) /
    (1 - expectedPairAgreement);
  const majorityFailures = opaqueConsensus.filter((row) => !row.recognisable);
  const majorityFailuresWithTwoDefects = majorityFailures.filter(
    (row) =>
      Object.values(row.failureDefectsByRater).filter(
        (defects) => defects.length > 0,
      ).length >= 2,
  ).length;
  const votePatterns = Object.fromEntries(
    [
      ...new Set(
        opaqueConsensus.map((row) =>
          RATERS.map((rater) => (row.raterVotes[rater] ? "P" : "F")).join(""),
        ),
      ),
    ]
      .sort()
      .map((pattern) => [
        pattern,
        opaqueConsensus.filter(
          (row) =>
            RATERS.map((rater) => (row.raterVotes[rater] ? "P" : "F")).join(
              "",
            ) === pattern,
        ).length,
      ]),
  );
  const agreement: AgreementAssessment = {
    sequence: {
      computedBeforeAnswerKeyRead: true,
      identityFieldsUsed: false,
    },
    threshold: {
      recordedBeforeUnseal: true,
      minimumPairwiseAgreement: MINIMUM_PAIRWISE_AGREEMENT,
      minimumFleissKappa: MINIMUM_FLEISS_KAPPA,
      requireAllThreeValidRaters: true,
      requireTwoConcreteDefectRecordsForEveryMajorityFailure: true,
    },
    unanimousCount,
    unanimousPercent: unanimousCount / 256,
    twoOfThreeCount: 256 - unanimousCount,
    twoOfThreePercent: (256 - unanimousCount) / 256,
    perRaterPrevalence: Object.fromEntries(
      RATERS.map((rater) => {
        const recognisable = grades[rater].filter(
          (grade) => grade.recognisable,
        ).length;
        return [
          rater,
          { recognisable, total: 256 as const, ratio: recognisable / 256 },
        ];
      }),
    ) as AgreementAssessment["perRaterPrevalence"],
    pairwise,
    overallPairwisePercentAgreement,
    allThreeExactPercentAgreement: unanimousCount / 256,
    fleissKappa,
    confidenceByRater: Object.fromEntries(
      RATERS.map((rater) => [rater, confidenceDistribution(grades[rater])]),
    ) as Record<Rater, ConfidenceDistribution>,
    votePatterns,
    disagreements: opaqueConsensus
      .filter((row) => row.decisionStrength === "majority")
      .map((row) => ({
        anonymousCell: row.referenceId,
        specimenId: row.specimenId,
        votePattern: RATERS.map((rater) =>
          row.raterVotes[rater] ? "P" : "F",
        ).join(""),
        confidences: row.raterConfidences,
      })),
    majorityFailureRows: majorityFailures.length,
    majorityFailuresWithTwoConcreteDefectRecords:
      majorityFailuresWithTwoDefects,
  };
  const reliability: ReliabilityVerdict = {
    status: "failed",
    allRatersPresentAndValid: validations.length === 3,
    everyPairAtLeast75Percent: pairwise.every(
      (pair) => pair.percentAgreement >= MINIMUM_PAIRWISE_AGREEMENT,
    ),
    fleissKappaAtLeastPoint60: fleissKappa >= MINIMUM_FLEISS_KAPPA,
    everyMajorityFailureHasTwoConcreteDefectRecords:
      majorityFailuresWithTwoDefects === majorityFailures.length,
  };
  if (
    reliability.allRatersPresentAndValid &&
    reliability.everyPairAtLeast75Percent &&
    reliability.fleissKappaAtLeastPoint60 &&
    reliability.everyMajorityFailureHasTwoConcreteDefectRecords
  ) {
    reliability.status = "passed";
  }
  return {
    packet,
    grades,
    validations,
    packetValidation: {
      protocolHash: sha256(JSON.stringify(packet.protocol)),
      randomizedBatchHash: packet.randomizedBatchHash,
      references: 128,
      specimens: 256,
      pathMetadataEntries: 384,
      pathBoundaryEscapes: 0,
      missingFiles: 0,
      imageHashMismatches: 0,
    },
    agreement,
    reliability,
    opaqueConsensus,
  };
};

const makeConsensusGradeBatch = (assessment: InternalAssessment): string => {
  const grades = assessment.opaqueConsensus.map((row) => ({
    specimenId: row.specimenId,
    referenceId: row.referenceId,
    recognisable: row.recognisable,
    // The existing single-rater integrity engine groups confidence by
    // implementation and refuses an empty side. Consensus confidence is
    // recomputed from the augmented mapping below; this transport-only value
    // keeps the identity/integrity checks independent of that grouping.
    confidence: "high",
    defects: row.recognisable
      ? []
      : RATERS.flatMap((rater) =>
          (row.failureDefectsByRater[rater] ?? []).map(
            (defect) => `[rater ${rater}] ${defect}`,
          ),
        ),
  }));
  const recognisable = grades.filter((grade) => grade.recognisable).length;
  return `${JSON.stringify(
    {
      grader: {
        identity: "deterministic-2-of-3-consensus",
        role: "independent-visual-grader",
      },
      packetProtocol: assessment.packet.protocol,
      randomizedBatchHash: assessment.packet.randomizedBatchHash,
      counts: {
        references: 128,
        specimens: 256,
        grades: 256,
        recognisable,
        unrecognisable: 256 - recognisable,
      },
      grades,
    },
    null,
    2,
  )}\n`;
};

const exactMcNemarTwoSidedP = (
  passToFail: number,
  failToPass: number,
): number => {
  const discordant = passToFail + failToPass;
  if (discordant === 0) return 1;
  const lower = Math.min(passToFail, failToPass);
  let cumulative = 0;
  let combination = 1;
  for (let index = 0; index <= lower; index += 1) {
    if (index > 0) {
      combination = (combination * (discordant - index + 1)) / index;
    }
    cumulative += combination / 2 ** discordant;
  }
  return Math.min(1, 2 * cumulative);
};

const compareVerdicts = (
  oldValues: readonly boolean[],
  newValues: readonly boolean[],
) => {
  const result = kappa(oldValues, newValues);
  const passToFail = oldValues.filter(
    (value, index) => value && !newValues[index],
  ).length;
  const failToPass = oldValues.filter(
    (value, index) => !value && newValues[index],
  ).length;
  return {
    agreements: result.agreements,
    percentAgreement: result.percentAgreement,
    cohensKappa: result.kappa,
    passToFail,
    failToPass,
    exactMcNemarTwoSidedP: exactMcNemarTwoSidedP(passToFail, failToPass),
  };
};

const decisionStrengthDistribution = (
  mapping: readonly ConsensusMapping[],
): DecisionStrengthDistribution => ({
  unanimousPass: mapping.filter(
    (grade) => grade.recognisable && grade.decisionStrength === "unanimous",
  ).length,
  majorityPass: mapping.filter(
    (grade) => grade.recognisable && grade.decisionStrength === "majority",
  ).length,
  unanimousFail: mapping.filter(
    (grade) => !grade.recognisable && grade.decisionStrength === "unanimous",
  ).length,
  majorityFail: mapping.filter(
    (grade) => !grade.recognisable && grade.decisionStrength === "majority",
  ).length,
});

export const readInputFieldV2MultiRaterSources =
  (): InputFieldV2MultiRaterSourceBytes => {
    const base = readInputFieldV2AdjudicationSources();
    return {
      packet: base.packet,
      raterA: base.grades,
      raterB: readFileSync(`${BLIND_ROOT}/grades-rater-b.json`, "utf8"),
      raterC: readFileSync(`${BLIND_ROOT}/grades-rater-c.json`, "utf8"),
      key: base.key,
      receipt: base.receipt,
    };
  };

export function adjudicateInputFieldV2MultiRater(
  sourceBytes: InputFieldV2MultiRaterSourceBytes,
): InputFieldV2MultiRaterAdjudication {
  const assessment = validateAndAssess(sourceBytes);
  const singleRaterPath = `${V2_ROOT}/comparison-result.json`;
  const hashes: InputFieldV2MultiRaterAdjudication["inputHashes"] = {
    packet: sha256(sourceBytes.packet),
    raterA: sha256(sourceBytes.raterA),
    raterB: sha256(sourceBytes.raterB),
    raterC: sha256(sourceBytes.raterC),
    sealedAnswerKey: sha256(sourceBytes.key),
    evidenceReceipt: sha256(sourceBytes.receipt),
    immutableV1Adjudication: fileHash(`${V1_ROOT}/comparison-result.json`),
    preservedSingleRaterAdjudication: fileHash(singleRaterPath),
  };
  const common = {
    artifactVersion: "input-field-v2-multi-rater-adjudication-v1" as const,
    inputHashes: hashes,
    raterValidations: assessment.validations,
    packetValidation: assessment.packetValidation,
    agreement: assessment.agreement,
    reliability: assessment.reliability,
    supersession: {
      preservedSingleRaterArtifact: singleRaterPath,
      preservedSingleRaterArtifactHash: hashes.preservedSingleRaterAdjudication,
      supersedesSingleRaterForProgressDecisions: true as const,
    },
  };
  if (assessment.reliability.status === "failed") {
    return {
      ...common,
      keyIntegrity: null,
      consensus: null,
      interBatchInstability: null,
      evidenceColumns: {
        measurementReliability: "failed",
        withinV2ConsensusCriterion: "not-unsealed",
        interBatchLegacyStability: "not-evaluated",
        architecturePerformance: "not-evaluated",
        webComponentParity: "not-evaluated",
        liveFigma: "pending",
        overallInputSuccess: false,
      },
      productVerdict: {
        status: "blocked-pre-unseal-reliability",
        pairedWinAccepted: false,
        recipeProgressClaimed: false,
        liveInputMayProceed: false,
        inputOverall: false,
        blockers: [
          "The pre-unseal 75% pairwise-agreement and Fleiss-kappa 0.60 reliability rule did not pass.",
        ],
        nextTask:
          "Calibrate the three raters on opaque examples, then create three new complete grade files without opening the key.",
      },
    };
  }

  // Reliability has passed. Only now can the identity-bearing key be consumed.
  const consensusGradeBytes = makeConsensusGradeBatch(assessment);
  const base = adjudicateInputFieldV2Comparison({
    packet: sourceBytes.packet,
    grades: consensusGradeBytes,
    key: sourceBytes.key,
    receipt: sourceBytes.receipt,
  });
  const opaqueBySpecimen = new Map(
    assessment.opaqueConsensus.map((grade) => [grade.specimenId, grade]),
  );
  const mapping: ConsensusMapping[] = base.mapping.map((grade) => {
    const opaque = opaqueBySpecimen.get(grade.specimenId);
    assert(opaque, `${grade.specimenId} consensus metadata is missing`);
    return {
      ...grade,
      recognisable: opaque.recognisable,
      confidence: opaque.majorityConfidence,
      defects: opaque.recognisable
        ? []
        : RATERS.flatMap((rater) =>
            (opaque.failureDefectsByRater[rater] ?? []).map(
              (defect) => `[rater ${rater}] ${defect}`,
            ),
          ),
      decisionStrength: opaque.decisionStrength,
      passVotes: opaque.passVotes,
      raterVotes: opaque.raterVotes,
      raterConfidences: opaque.raterConfidences,
      failureDefectsByRater: opaque.failureDefectsByRater,
    };
  });

  const v1 = parse<InputFieldV2ComparisonAdjudication>(
    "immutable v1 adjudication",
    readFileSync(`${V1_ROOT}/comparison-result.json`, "utf8"),
  );
  const v1Legacy = new Map(
    v1.mapping
      .filter((grade) => grade.implementation === "legacy")
      .map((grade) => [grade.cellKey, grade]),
  );
  const consensusLegacy = mapping.filter(
    (grade) => grade.implementation === "legacy",
  );
  const raterABySpecimen = new Map(
    assessment.grades.A.map((grade) => [grade.specimenId, grade]),
  );
  const instabilityRows: InstabilityRow[] = consensusLegacy.map((grade) => {
    const previous = v1Legacy.get(grade.cellKey);
    const raterA = raterABySpecimen.get(grade.specimenId);
    assert(
      previous && raterA,
      `${grade.cellKey} instability row is incomplete`,
    );
    assert(
      previous.referenceHash === grade.referenceHash &&
        previous.outputHash === grade.outputHash,
      `${grade.cellKey} unchanged reference or legacy bytes differ`,
    );
    return {
      cellKey: grade.cellKey,
      referenceHash: grade.referenceHash,
      legacyOutputHash: grade.outputHash,
      v1: {
        anonymousCell: previous.anonymousCell,
        specimenId: previous.specimenId,
        recognisable: previous.recognisable,
      },
      v2RaterA: {
        anonymousCell: grade.anonymousCell,
        specimenId: grade.specimenId,
        recognisable: raterA.recognisable,
      },
      v2Consensus: {
        recognisable: grade.recognisable,
        decisionStrength: grade.decisionStrength,
      },
    };
  });
  const v1Values = instabilityRows.map((row) => row.v1.recognisable);
  const raterAValues = instabilityRows.map((row) => row.v2RaterA.recognisable);
  const consensusValues = instabilityRows.map(
    (row) => row.v2Consensus.recognisable,
  );
  const instability: InterBatchInstability = {
    unchangedInputs: {
      exactReferenceHashes: instabilityRows.filter(
        (row) => v1Legacy.get(row.cellKey)?.referenceHash === row.referenceHash,
      ).length,
      exactLegacyOutputHashes: instabilityRows.filter(
        (row) => v1Legacy.get(row.cellKey)?.outputHash === row.legacyOutputHash,
      ).length,
      total: 128,
    },
    passCounts: {
      immutableV1: 88,
      v2RaterA: 0,
      v2Consensus: consensusValues.filter(Boolean).length,
    },
    v1VersusV2RaterA: compareVerdicts(v1Values, raterAValues),
    v1VersusV2Consensus: compareVerdicts(v1Values, consensusValues),
    rows: instabilityRows,
    resolvedByMultiRaterConsensus: false,
    interpretation:
      "All 128 legacy output hashes and all 128 paired reference hashes are unchanged, yet 88 legacy passes reverse to failures. The v2 consensus is internally reliable but reproduces the 0/128 v2 legacy result, so it confirms the v2 standard rather than reconciling it with v1.",
  };
  const withinCriterion = base.verdict.offlineDifficultControlCriterion;
  const legacyMapping = mapping.filter(
    (grade) => grade.implementation === "legacy",
  );
  const recipeMapping = mapping.filter(
    (grade) => grade.implementation === "recipe-react",
  );
  const { byConfidence: _transportConfidence, ...consensusAggregates } =
    base.aggregates;
  return {
    ...common,
    keyIntegrity: {
      validatedOnlyAfterReliabilityPassed: true,
      sealedAnswerKeyHash: hashes.sealedAnswerKey,
      consensusSyntheticGradeHash: sha256(consensusGradeBytes),
      baseIntegrityChecks: base.integrity.checks,
    },
    consensus: {
      rule: "two-of-three-majority-per-specimen",
      mapping,
      aggregates: consensusAggregates,
      confidence: {
        overall: {
          ...confidenceDistribution(mapping),
        },
        byImplementation: {
          legacy: confidenceDistribution(legacyMapping),
          recipeReact: confidenceDistribution(recipeMapping),
        },
      },
      byDecisionStrength: {
        legacy: decisionStrengthDistribution(legacyMapping),
        recipeReact: decisionStrengthDistribution(recipeMapping),
      },
      defects: base.defects,
      webComponentParity: base.webComponentParity,
      withinBatchOfflineCriterion: withinCriterion,
    },
    interBatchInstability: instability,
    evidenceColumns: {
      measurementReliability: "passed",
      withinV2ConsensusCriterion: withinCriterion,
      interBatchLegacyStability: "failed",
      architecturePerformance: "blocked",
      webComponentParity: "passed-parity-only",
      liveFigma: "pending",
      overallInputSuccess: false,
    },
    productVerdict: {
      status: "blocked-inter-batch-measurement-instability",
      pairedWinAccepted: false,
      recipeProgressClaimed: false,
      liveInputMayProceed: false,
      inputOverall: false,
      blockers: [
        "The exact unchanged legacy/reference bytes moved from 88/128 in v1 to 0/128 for both v2 rater A and the v2 multi-rater consensus.",
        "Internal v2 reliability does not identify how much of the apparent paired improvement is architecture performance versus a changed grading standard.",
        "Live Input/Field evidence remains pending and must not start from a disputed offline progress claim.",
      ],
      nextTask:
        "Run a pre-key calibration round that embeds duplicated unchanged-legacy anchors from both batches under one rubric, then obtain three fresh complete blind grades before reconsidering architecture progress.",
    },
  };
}

export function validateCommittedInputFieldV2MultiRater(
  artifact: InputFieldV2MultiRaterAdjudication,
  sourceBytes: InputFieldV2MultiRaterSourceBytes = readInputFieldV2MultiRaterSources(),
): InputFieldV2MultiRaterAdjudication {
  const hashes = {
    packet: sha256(sourceBytes.packet),
    raterA: sha256(sourceBytes.raterA),
    raterB: sha256(sourceBytes.raterB),
    raterC: sha256(sourceBytes.raterC),
    sealedAnswerKey: sha256(sourceBytes.key),
    evidenceReceipt: sha256(sourceBytes.receipt),
    immutableV1Adjudication: fileHash(`${V1_ROOT}/comparison-result.json`),
    preservedSingleRaterAdjudication: fileHash(
      `${V2_ROOT}/comparison-result.json`,
    ),
  };
  assert(
    JSON.stringify(artifact.inputHashes) === JSON.stringify(hashes),
    "multi-rater adjudication is stale",
  );
  const recomputed = adjudicateInputFieldV2MultiRater(sourceBytes);
  assert(
    JSON.stringify(artifact) === JSON.stringify(recomputed),
    "multi-rater mapping, agreement, arithmetic, or verdict differs",
  );
  return recomputed;
}

const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const result = adjudicateInputFieldV2MultiRater(
    readInputFieldV2MultiRaterSources(),
  );
  if (process.argv.includes("--write")) {
    const bytes = await format(JSON.stringify(result), { parser: "json" });
    writeFileSync(INPUT_FIELD_V2_MULTI_RATER_ADJUDICATION_PATH, bytes);
    console.log(
      `WROTE ${INPUT_FIELD_V2_MULTI_RATER_ADJUDICATION_PATH} sha256=${sha256(bytes)}`,
    );
  } else {
    const committed = parse<InputFieldV2MultiRaterAdjudication>(
      "committed multi-rater adjudication",
      readFileSync(INPUT_FIELD_V2_MULTI_RATER_ADJUDICATION_PATH, "utf8"),
    );
    validateCommittedInputFieldV2MultiRater(committed);
    console.log(
      `Input/Field v2 multi-rater: reliability ${result.reliability.status}; product ${result.productVerdict.status}; sha256=${sha256(
        readFileSync(INPUT_FIELD_V2_MULTI_RATER_ADJUDICATION_PATH),
      )}`,
    );
  }
}
