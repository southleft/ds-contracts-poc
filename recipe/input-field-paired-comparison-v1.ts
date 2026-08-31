import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { PNG } from "pngjs";
import { format } from "prettier";

const REPO = path.resolve(new URL(".", import.meta.url).pathname, "..");
const EVIDENCE = "recipe/evidence";
const SOURCE_ROOT = `${EVIDENCE}/input-field-comparison-v2`;
export const ROOT = `${EVIDENCE}/input-field-paired-comparison-v1`;
const NEXT_ROOT = `${EVIDENCE}/.input-field-paired-comparison-v1-next`;
export const PROTOCOL_PATH = `${ROOT}/protocol.json`;
export const SCHEMA_PATH = `${ROOT}/grade.schema.json`;
export const RECEIPT_PATH = `${ROOT}/receipt.json`;
export const INDEX_PATH = `${ROOT}/index.json`;
export const GOLD_PACKET_PATH = `${ROOT}/gold/blind-packet/packet.json`;
export const GOLD_KEY_PATH = `${ROOT}/gold/sealed-answer-key.json`;
export const PERFORMANCE_PACKET_PATH = `${ROOT}/performance/blind-packet/packet.json`;
export const PERFORMANCE_KEY_PATH = `${ROOT}/performance/sealed-answer-key.json`;
export const ABSOLUTE_GATE_PATH = `${ROOT}/objective-absolute-gate.json`;

const VERSION = "input-field-paired-comparison-instrument-v1";
const PROTOCOL_VERSION = "input-field-relative-fidelity-v1";
const GRADE_VERSION = "paired-comparison-grade-envelope-v1";
const RUBRIC_VERSION = "input-field-paired-observable-rubric-v1";
const GOLD_VERSION = "paired-comparison-gold-v1";
const PERFORMANCE_VERSION = "input-field-paired-performance-v1";
const BUILD_SEED = "input-field-paired-comparison-v1-locked-2026-08-27";
const RATERS = [
  "RATER-PAIR-V1-A",
  "RATER-PAIR-V1-B",
  "RATER-PAIR-V1-C",
] as const;
const CHOICES = ["left", "right", "tie"] as const;
const CONFIDENCE = ["low", "medium", "high"] as const;
const IDENTITY_LEAK =
  /\blegacy\b|\brecipe\b|\bcorrected\b|\bduplicate\b|\bcopy[- _]?[ab]\b|\bimplementation\b|\bexpected[- _]?(winner|choice)\b|\bmui\b|\bpolaris\b|@shopify|@mui/i;

type Rater = (typeof RATERS)[number];
type Choice = (typeof CHOICES)[number];
type Confidence = (typeof CONFIDENCE)[number];
type Phase = "gold" | "performance";
type CandidateIdentity = "legacy" | "recipe";

interface Artifact {
  cellKey: string;
  file: string;
  hash: string;
  width: number;
  height: number;
  paintedPixels: number;
  contentBox: { width: number; height: number };
  dom: {
    inputFound: boolean;
    labelFound: boolean;
    labelForMatches: boolean;
    accessibleNameMatched: boolean;
    value: string;
    placeholder: string;
    required: boolean;
    disabled: boolean;
    ariaInvalid: string | null;
    ariaDescribedBy: string | null;
    structure: {
      labels: number;
      inputs: number;
      messages: number;
      adornments: number;
    };
  };
}

interface SourceReceipt {
  matrix: {
    sampleMatrixHash: string;
    cells: Array<{
      key: string;
      library: string;
      size: string;
      state: string;
      content: string;
      required: string;
      adornments: string;
    }>;
  };
  immutableInputs: {
    referencesByteIdenticalToV1: number;
    legacyByteIdenticalToV1: number;
  };
  references: Artifact[];
  outputs: {
    legacy: Artifact[];
    recipeReact: Artifact[];
    recipeWebComponent: Artifact[];
  };
  nonvisualEvidence: {
    zeroPixelComparisons: number;
    acquisitionAccounting: Record<
      string,
      { factsSelected: number; parameterFields: number; failures: string[] }
    >;
    twoCycleCanonicalFixedPoint: Record<string, boolean>;
    deterministicEmission: Record<string, { byteIdenticalTwoRun: boolean }>;
    semanticApiAriaEvents: string;
    recipeWebComponentParity: {
      cells: number;
      nonzeroCells: number;
      pixelComparisons: number;
      perceptualPixelEqualToReact: number;
      geometryEqualToReact: number;
      semanticProbeEqualToReact: number;
      includedInBlindSpecimens: boolean;
    };
    noLibraryBranchChecks: {
      forbiddenIdentities: string;
      hardStopRequired: boolean;
      controlFailed: boolean;
    };
  };
}

export interface CandidateRef {
  candidateId: string;
  image: string;
}

export interface PairedTask {
  taskId: string;
  reference: { referenceId: string; image: string };
  left: CandidateRef;
  right: CandidateRef;
}

export interface PairedPacket {
  version: string;
  protocolVersion: typeof PROTOCOL_VERSION;
  phase: Phase;
  status: "opaque-ungraded";
  protocolCommitment: string;
  rubricVersion: typeof RUBRIC_VERSION;
  rubric: ReturnType<typeof comparisonRubric>;
  instructions: string[];
  gradeSchema: string;
  preflight: string;
  counts: {
    tasks: number;
    primaryTasks: number;
    sideSwappedHiddenDuplicates: number;
  };
  randomizedBatchHash: string;
  tasks: PairedTask[];
}

export interface GradeRow {
  taskId: string;
  referenceId: string;
  leftCandidateId: string;
  rightCandidateId: string;
  choice: Choice;
  confidence: Confidence;
  rationale: {
    decisiveDifferences: string[];
    leftDefects: string[];
    rightDefects: string[];
    tieBasis: string | null;
  };
}

export interface GradeEnvelope {
  version: typeof GRADE_VERSION;
  phase: Phase;
  raterId: Rater;
  packetHash: string;
  randomizedBatchHash: string;
  protocolCommitment: string;
  rubricVersion: typeof RUBRIC_VERSION;
  calibrationReceipt: null | {
    path: string;
    sha256: string;
    score: number;
    allClearWinnersCorrect: true;
    passed: true;
  };
  counts: { expected: number; submitted: number | null };
  grades: GradeRow[];
}

interface GoldKeyRow {
  taskId: string;
  referenceId: string;
  leftCandidateId: string;
  rightCandidateId: string;
  primaryPairId: string;
  presentation: "primary" | "side-swapped";
  expectedChoice: Choice;
  class: "clear-winner" | "true-tie" | "materiality-boundary";
  decisiveRule: string;
}

interface GoldKey {
  version: "paired-comparison-gold-key-v1";
  lockedBeforeRaterAccess: true;
  separateFromTargetPerformance: true;
  randomizedBatchHash: string;
  counts: {
    tasks: 48;
    primaryCases: 24;
    clearWinnerPresentations: 24;
    trueTiePresentations: 12;
    materialityBoundaryPresentations: 12;
  };
  answers: GoldKeyRow[];
}

interface PerformanceKeyRow {
  taskId: string;
  primaryPairId: string;
  presentation: "primary" | "side-swapped";
  cellKey: string;
  source: string;
  axes: Record<string, string>;
  left: { candidateId: string; identity: CandidateIdentity };
  right: { candidateId: string; identity: CandidateIdentity };
}

interface PerformanceKey {
  version: "input-field-paired-performance-key-v1";
  revealOnlyAfterReliabilityPasses: true;
  randomizedBatchHash: string;
  rows: PerformanceKeyRow[];
}

interface TreeSnapshot {
  root: string;
  files: number;
  bytes: number;
  aggregateSha256: string;
}

export interface QualificationReceipt {
  version: "paired-comparison-qualification-receipt-v1";
  raterId: Rater;
  packetHash: string;
  randomizedBatchHash: string;
  protocolCommitment: string;
  gradeHash: string;
  correct: number;
  denominator: 48;
  score: number;
  clearWinnersCorrect: number;
  clearWinnersDenominator: 24;
  allClearWinnersCorrect: boolean;
  envelopeValid: true;
  passed: boolean;
  thresholds?: {
    goldAccuracyMinimum: 0.95;
    allClearWinnersRequired: true;
    validEnvelopeRequired: true;
  };
  waiversApplied?: false;
  hashes?: {
    protocol: string;
    instrumentReceipt: string;
    goldPacket: string;
    goldAnswerKey: string;
    gradeSchema: string;
    goldTemplate: string;
    goldSubmission: string;
  };
  scoreBreakdown?: {
    clearWinner: QualificationMetric;
    trueTie: QualificationMetric;
    materialityBoundary: QualificationMetric;
  };
  sideSwapCalibration?: {
    accuracy: QualificationMetric;
    consistency: QualificationMetric;
  };
  performanceBinding?: {
    packetPath: string;
    packetHash: string;
    templatePath: string;
    qualificationReceiptPath: string;
    outputPath: string;
    cohortGatePassed: boolean;
    commissioned: boolean;
  };
  accessControl?: {
    goldAnswerKeyOpened: true;
    performancePacketOpened: false;
    performanceAnswerKeyOpened: false;
    performanceResultsOpened: false;
    performanceIdentityRevealed: false;
  };
}

interface QualificationMetric {
  correct: number;
  denominator: number;
  ratio: number;
}

const absolute = (file: string): string => path.join(REPO, file);
const sha256 = (value: string | Buffer): string =>
  createHash("sha256").update(value).digest("hex");
const fileHash = (file: string): string => sha256(readFileSync(absolute(file)));
const parse = <T>(file: string): T =>
  JSON.parse(readFileSync(absolute(file), "utf8")) as T;
const check: (condition: unknown, message: string) => asserts condition = (
  condition,
  message,
) => {
  if (!condition) throw new Error(`PAIRED COMPARISON REFUSED: ${message}`);
};
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

const walk = (root: string): string[] => {
  const output: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(absolute(directory), {
      withFileTypes: true,
    }).sort((left, right) => left.name.localeCompare(right.name))) {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) visit(file);
      else {
        check(entry.isFile(), `${file} is not a regular file`);
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

const snapshot = (root: string): TreeSnapshot => {
  const rows = walk(root).map((file) => ({
    file,
    bytes: statSync(absolute(file)).size,
    sha256: fileHash(file),
  }));
  return {
    root,
    files: rows.length,
    bytes: rows.reduce((sum, row) => sum + row.bytes, 0),
    aggregateSha256: sha256(JSON.stringify(rows)),
  };
};

const historicalRoots = (): string[] =>
  readdirSync(absolute(EVIDENCE), { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name.startsWith("input-field-comparison") &&
        // Versioned evidence created after this instrument was sealed is not
        // part of its historical commitment denominator.
        entry.name !== "input-field-comparison-v3" &&
        `${EVIDENCE}/${entry.name}` !== ROOT,
    )
    .map((entry) => `${EVIDENCE}/${entry.name}`)
    .sort();

const historicalSnapshots = (): TreeSnapshot[] =>
  historicalRoots().map(snapshot);

const comparisonRubric = () => ({
  version: RUBRIC_VERSION,
  claim:
    "Choose which opaque candidate is closer to the independent original-source reference for this exact cell; this is relative fidelity, not absolute recognisability.",
  decisionOrder: [
    {
      rank: 1,
      category: "structure-and-state",
      rule: "Required roles, visible content, adornments, and semantic state dominate every lower-ranked difference.",
    },
    {
      rank: 2,
      category: "geometry-and-proportions",
      rule: "Compare silhouette, dimensions, padding, gaps, alignment, scale, clipping, and overlap.",
    },
    {
      rank: 3,
      category: "labels-helpers-adornments",
      rule: "Compare wording, role placement, required marker, helper/error message, and leading/trailing adornments.",
    },
    {
      rank: 4,
      category: "typography",
      rule: "Compare hierarchy, line count, wrapping, baseline, size, and weight; raster-only shifts may be tolerated.",
    },
    {
      rank: 5,
      category: "border-fill-focus-error",
      rule: "Compare border/fill classes and focus, error, and disabled treatments after all higher ranks.",
    },
  ],
  materialityTolerances: {
    overallWidthOrHeight:
      "material only when deviation exceeds both 4 px and 8% of the reference dimension",
    localSpacing:
      "material only when deviation exceeds both 4 px and 20% of the reference spacing",
    roleDefiningScale: "material above 10%",
    clipping: "material above 5% of a required part's visible area",
    overlap: "material above 2 px between required parts",
    glyphEdgeShift:
      "within 1 px is immaterial when hierarchy and wrapping stay unchanged",
    color:
      "immaterial only within both 12 per-channel sRGB and 20 Euclidean sRGB, with semantic state and contrast role unchanged",
  },
  choiceRule:
    "At the first ranked category that distinguishes candidates, choose the candidate with fewer or smaller material defects relative to the reference. A candidate can be closer even when neither would pass an absolute gate. 'Both fail' is not a valid reason to avoid choosing.",
  tieRule:
    "Choose tie only when neither candidate is distinguished at any ranked category and their residual difference magnitudes are equivalent within 1 px geometry, 1% role scale, 1 px glyph shift, and 2 per-channel/3 Euclidean sRGB. The tie basis must name the measured tolerance or exact equality.",
  rationaleRule:
    "Every non-tie names the decisive ranked difference and at least one concrete defect in the losing candidate. Never infer candidate provenance or compare tasks.",
});

const reliabilityThresholds = () => ({
  calibratedValidRatersRequired: 3,
  goldAccuracyMinimum: 0.95,
  allClearGoldWinnersRequired: true,
  validEnvelopeRequired: true,
  sideSwapConsistencyPerRaterMinimum: 0.95,
  majoritySideSwapConsistency: { numerator: 127, denominator: 128 },
  everyPairwiseCategoricalAgreementMinimum: 0.75,
  fleissKappaMinimum: 0.6,
  statistic:
    "Fleiss kappa over left/right/tie is predeclared and reported with raw pairwise agreement. Side-swapped duplicates symmetrise left/right category prevalence; tie remains an explicit third category.",
  majorityDecisionSupportRatersMinimum: 2,
  finalDenominator: 128,
  noDenominatorReduction: true,
  failureConsequence:
    "Any failed qualification, envelope, side-swap, pairwise, kappa, or majority-support threshold keeps the performance key sealed and yields no relative result.",
});

const protocolBody = (preservation: TreeSnapshot[]) => ({
  version: VERSION,
  protocolVersion: PROTOCOL_VERSION,
  lockedBeforeRaterAccess: true,
  purpose:
    "Measure relative fidelity between two opaque candidates on each exact Input/Field source cell without treating preference as proof of absolute recognisability.",
  measurementFailureDiagnosis: {
    immutableFailedRounds: [
      {
        root: `${EVIDENCE}/input-field-comparison-calibrated`,
        hiddenDuplicateConsistency: "100%",
        fleissKappa: 0.4725274725274726,
      },
      {
        root: `${EVIDENCE}/input-field-comparison-calibration-v3-replacement`,
        hiddenDuplicateConsistency: "100%",
        overallRawPairwiseAgreement: 0.956597222222222,
        fleissKappa: 0.40925500492287054,
      },
    ],
    diagnosis:
      "Binary absolute pass/fail mixed recognisability with materiality threshold selection. Extreme fail prevalence raised chance agreement, depressing kappa despite high raw agreement, while each rater's perfect duplicate repeatability showed stable individual thresholds rather than a shared threshold.",
    consequence:
      "Do not commission another equivalent absolute pass/fail round and do not change the locked historical criteria. Use paired relative choice for architecture-progress evidence and retain absolute recognisability as a separate gate.",
  },
  claims: {
    relativeFidelity:
      "Which opaque candidate is closer to the independent original-source reference on the exact same cell.",
    absoluteRecognisability:
      "A separate human/design-review decision plus objective structural, state, geometry, semantic, Web Component, zero-silent, and usability checks; never inferred from relative preference.",
  },
  gold: {
    independentFromTargetPerformance: true,
    syntheticObjectivePixelFixtures: true,
    primaryCases: 24,
    sideSwappedHiddenDuplicates: 24,
    classes: {
      clearWinners: 12,
      trueTies: 6,
      materialityBoundaries: 6,
    },
    expectedOutcomesLockedBeforeRaterAccess: true,
    ambiguousOpinionCasesForbidden: true,
  },
  performance: {
    independentReferences: 128,
    primaryTasks: 128,
    sideSwappedHiddenDuplicates: 128,
    totalTasks: 256,
    exactUnchangedReferenceLegacyAndRecipeBytesRequired: true,
    opaqueCandidatesOnly: true,
    independentlyRandomizedCandidateOrderPerCell: true,
    duplicateIdsUnrelated: true,
    duplicateIdentityHidden: true,
    keyRevealOnlyAfterReliability: true,
    duplicateVotesExcludedFromFinalArithmetic: true,
  },
  rubric: comparisonRubric(),
  reliability: reliabilityThresholds(),
  relativeResultRule: {
    onlyAfterReliabilityAndUnsealing: true,
    categories: ["recipe-wins", "legacy-wins", "ties"],
    reportBy: [
      "all-128-cells",
      "source",
      "Size",
      "State",
      "Content",
      "Required",
      "Adornments",
    ],
    pass: "recipe wins > legacy wins over exactly 128 primary cells, with no denominator reduction and no hidden source branch",
    doesNotAuthorize:
      "Input success, live work, or bypass of objective and later absolute human gates",
  },
  preservation,
});

const makeProtocol = (preservation: TreeSnapshot[]) => {
  const body = protocolBody(preservation);
  return { ...body, commitment: sha256(JSON.stringify(body)) };
};

const gradeSchema = () => ({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://ds-contracts.local/paired-comparison-grade-envelope-v1.schema.json",
  title: GRADE_VERSION,
  type: "object",
  additionalProperties: false,
  required: [
    "version",
    "phase",
    "raterId",
    "packetHash",
    "randomizedBatchHash",
    "protocolCommitment",
    "rubricVersion",
    "calibrationReceipt",
    "counts",
    "grades",
  ],
  properties: {
    version: { const: GRADE_VERSION },
    phase: { enum: ["gold", "performance"] },
    raterId: { enum: RATERS },
    packetHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
    randomizedBatchHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
    protocolCommitment: { type: "string", pattern: "^[a-f0-9]{64}$" },
    rubricVersion: { const: RUBRIC_VERSION },
    calibrationReceipt: {
      oneOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: [
            "path",
            "sha256",
            "score",
            "allClearWinnersCorrect",
            "passed",
          ],
          properties: {
            path: { type: "string", minLength: 1 },
            sha256: { type: "string", pattern: "^[a-f0-9]{64}$" },
            score: { type: "number", minimum: 0.95, maximum: 1 },
            allClearWinnersCorrect: { const: true },
            passed: { const: true },
          },
        },
      ],
      description:
        "Must be null for GOLD and a hash-pinned passing qualification receipt for performance.",
    },
    counts: {
      type: "object",
      additionalProperties: false,
      required: ["expected", "submitted"],
      properties: {
        expected: { type: "integer", minimum: 1 },
        submitted: { type: ["integer", "null"], minimum: 1 },
      },
    },
    grades: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "taskId",
          "referenceId",
          "leftCandidateId",
          "rightCandidateId",
          "choice",
          "confidence",
          "rationale",
        ],
        properties: {
          taskId: { type: "string", pattern: "^task-[a-f0-9]{24}$" },
          referenceId: {
            type: "string",
            pattern: "^reference-[a-f0-9]{24}$",
          },
          leftCandidateId: {
            type: "string",
            pattern: "^candidate-[a-f0-9]{24}$",
          },
          rightCandidateId: {
            type: "string",
            pattern: "^candidate-[a-f0-9]{24}$",
          },
          choice: { enum: CHOICES },
          confidence: { enum: CONFIDENCE },
          rationale: {
            type: "object",
            additionalProperties: false,
            required: [
              "decisiveDifferences",
              "leftDefects",
              "rightDefects",
              "tieBasis",
            ],
            properties: {
              decisiveDifferences: {
                type: "array",
                items: { type: "string", minLength: 20 },
              },
              leftDefects: {
                type: "array",
                items: { type: "string", minLength: 20 },
              },
              rightDefects: {
                type: "array",
                items: { type: "string", minLength: 20 },
              },
              tieBasis: { type: ["string", "null"] },
            },
          },
        },
        allOf: [
          {
            if: { properties: { choice: { const: "tie" } } },
            // oxlint-disable-next-line unicorn/no-thenable -- JSON Schema keyword.
            then: {
              properties: {
                rationale: {
                  properties: {
                    decisiveDifferences: { maxItems: 0 },
                    tieBasis: {
                      type: "string",
                      minLength: 20,
                      pattern: "(exact|within|px|%|sRGB|Euclidean)",
                    },
                  },
                },
              },
            },
            else: {
              properties: {
                rationale: {
                  properties: {
                    decisiveDifferences: { minItems: 1 },
                    tieBasis: { type: "null" },
                  },
                },
              },
            },
          },
          {
            if: { properties: { choice: { const: "left" } } },
            // oxlint-disable-next-line unicorn/no-thenable -- JSON Schema keyword.
            then: {
              properties: {
                rationale: {
                  properties: { rightDefects: { minItems: 1 } },
                },
              },
            },
          },
          {
            if: { properties: { choice: { const: "right" } } },
            // oxlint-disable-next-line unicorn/no-thenable -- JSON Schema keyword.
            then: {
              properties: {
                rationale: {
                  properties: { leftDefects: { minItems: 1 } },
                },
              },
            },
          },
        ],
      },
    },
  },
});

const opaqueId = (kind: string, value: string): string =>
  `${kind}-${sha256(`${BUILD_SEED}\0${kind}\0${value}`).slice(0, 24)}`;
const batchHash = (tasks: PairedTask[]): string =>
  sha256(
    JSON.stringify(
      tasks.map((task) => [
        task.taskId,
        task.reference.referenceId,
        task.left.candidateId,
        task.right.candidateId,
      ]),
    ),
  );
const byCell = (artifacts: Artifact[]): Map<string, Artifact> =>
  new Map(artifacts.map((artifact) => [artifact.cellKey, artifact]));
const copyOpaque = (source: string, targetRelative: string): void => {
  const target = absolute(targetRelative);
  mkdirSync(path.dirname(target), { recursive: true });
  copyFileSync(absolute(source), target);
};

type GoldMutation =
  | "exact"
  | "missing-label"
  | "missing-helper"
  | "missing-content"
  | "wrong-state"
  | "overlap"
  | "width-minus-18"
  | "width-minus-16"
  | "spacing-plus-5"
  | "spacing-plus-4"
  | "scale-minus-12"
  | "scale-minus-10"
  | "glyph-plus-1"
  | "color-plus-6";

interface GoldCase {
  id: string;
  class: GoldKeyRow["class"];
  first: GoldMutation;
  second: GoldMutation;
  winner: "first" | "second" | "tie";
  decisiveRule: string;
}

const GOLD_CASES: GoldCase[] = [
  [
    "structure-label",
    "clear-winner",
    "exact",
    "missing-label",
    "first",
    "The second candidate omits a required label role.",
  ],
  [
    "structure-helper",
    "clear-winner",
    "missing-helper",
    "exact",
    "second",
    "The first candidate omits a required helper role.",
  ],
  [
    "structure-content",
    "clear-winner",
    "exact",
    "missing-content",
    "first",
    "The second candidate omits required visible content.",
  ],
  [
    "state-focus",
    "clear-winner",
    "wrong-state",
    "exact",
    "second",
    "The first candidate substitutes the semantic focus state.",
  ],
  [
    "structure-overlap",
    "clear-winner",
    "exact",
    "overlap",
    "first",
    "The second candidate overlaps required helper and surface content by more than 2 px.",
  ],
  [
    "geometry-severe",
    "clear-winner",
    "width-minus-18",
    "exact",
    "second",
    "The first candidate exceeds both 4 px and 8% width tolerances.",
  ],
  [
    "structure-label-2",
    "clear-winner",
    "missing-label",
    "exact",
    "second",
    "The first candidate omits a required label role.",
  ],
  [
    "structure-helper-2",
    "clear-winner",
    "exact",
    "missing-helper",
    "first",
    "The second candidate omits a required helper role.",
  ],
  [
    "structure-content-2",
    "clear-winner",
    "missing-content",
    "exact",
    "second",
    "The first candidate omits required visible content.",
  ],
  [
    "state-focus-2",
    "clear-winner",
    "exact",
    "wrong-state",
    "first",
    "The second candidate substitutes the semantic focus state.",
  ],
  [
    "structure-overlap-2",
    "clear-winner",
    "overlap",
    "exact",
    "second",
    "The first candidate overlaps required helper and surface content by more than 2 px.",
  ],
  [
    "geometry-severe-2",
    "clear-winner",
    "exact",
    "width-minus-18",
    "first",
    "The second candidate exceeds both 4 px and 8% width tolerances.",
  ],
  [
    "tie-exact-1",
    "true-tie",
    "exact",
    "exact",
    "tie",
    "Both candidates are pixel-identical to the reference.",
  ],
  [
    "tie-exact-2",
    "true-tie",
    "exact",
    "exact",
    "tie",
    "Both candidates are pixel-identical to the reference.",
  ],
  [
    "tie-glyph",
    "true-tie",
    "glyph-plus-1",
    "glyph-plus-1",
    "tie",
    "Both candidates have the same 1 px glyph shift within tolerance.",
  ],
  [
    "tie-color",
    "true-tie",
    "color-plus-6",
    "color-plus-6",
    "tie",
    "Both candidates have the same +6 sRGB border delta within tolerance.",
  ],
  [
    "tie-width",
    "true-tie",
    "width-minus-16",
    "width-minus-16",
    "tie",
    "Both candidates sit at the same 8% width boundary.",
  ],
  [
    "tie-spacing",
    "true-tie",
    "spacing-plus-4",
    "spacing-plus-4",
    "tie",
    "Both candidates have the same 4 px local-spacing delta within tolerance.",
  ],
  [
    "boundary-width",
    "materiality-boundary",
    "width-minus-16",
    "width-minus-18",
    "first",
    "The first is at 8%; the second exceeds both 4 px and 8%.",
  ],
  [
    "boundary-width-swap",
    "materiality-boundary",
    "width-minus-18",
    "width-minus-16",
    "second",
    "The second is at 8%; the first exceeds both 4 px and 8%.",
  ],
  [
    "boundary-spacing",
    "materiality-boundary",
    "spacing-plus-4",
    "spacing-plus-5",
    "first",
    "The first is at 4 px; the second exceeds the local-spacing limit.",
  ],
  [
    "boundary-spacing-swap",
    "materiality-boundary",
    "spacing-plus-5",
    "spacing-plus-4",
    "second",
    "The second is at 4 px; the first exceeds the local-spacing limit.",
  ],
  [
    "boundary-scale",
    "materiality-boundary",
    "scale-minus-10",
    "scale-minus-12",
    "first",
    "The first is at 10%; the second exceeds the role-scale limit.",
  ],
  [
    "boundary-scale-swap",
    "materiality-boundary",
    "scale-minus-12",
    "scale-minus-10",
    "second",
    "The second is at 10%; the first exceeds the role-scale limit.",
  ],
].map(([id, klass, first, second, winner, decisiveRule]) => ({
  id,
  class: klass,
  first,
  second,
  winner,
  decisiveRule,
})) as GoldCase[];

const setPixel = (
  image: PNG,
  x: number,
  y: number,
  rgba: readonly [number, number, number, number],
): void => {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  const offset = (image.width * y + x) << 2;
  image.data[offset] = rgba[0];
  image.data[offset + 1] = rgba[1];
  image.data[offset + 2] = rgba[2];
  image.data[offset + 3] = rgba[3];
};
const rect = (
  image: PNG,
  x: number,
  y: number,
  width: number,
  height: number,
  color: readonly [number, number, number, number],
): void => {
  for (let iy = y; iy < y + height; iy += 1)
    for (let ix = x; ix < x + width; ix += 1) setPixel(image, ix, iy, color);
};
const outline = (
  image: PNG,
  x: number,
  y: number,
  width: number,
  height: number,
  color: readonly [number, number, number, number],
): void => {
  rect(image, x, y, width, 2, color);
  rect(image, x, y + height - 2, width, 2, color);
  rect(image, x, y, 2, height, color);
  rect(image, x + width - 2, y, 2, height, color);
};

const goldImage = (mutation: GoldMutation): Buffer => {
  const image = new PNG({ width: 260, height: 132 });
  rect(image, 0, 0, image.width, image.height, [255, 255, 255, 255]);
  let surfaceWidth = 200;
  if (mutation === "width-minus-18") surfaceWidth -= 18;
  if (mutation === "width-minus-16") surfaceWidth -= 16;
  const border =
    mutation === "wrong-state"
      ? ([196, 46, 62, 255] as const)
      : mutation === "color-plus-6"
        ? ([46, 96, 206, 255] as const)
        : ([40, 90, 200, 255] as const);
  const contentWidth =
    mutation === "scale-minus-12"
      ? 88
      : mutation === "scale-minus-10"
        ? 90
        : 100;
  const contentX = mutation === "glyph-plus-1" ? 37 : 36;
  const surfaceY =
    mutation === "spacing-plus-5"
      ? 50
      : mutation === "spacing-plus-4"
        ? 49
        : 45;
  if (mutation !== "missing-label")
    rect(image, 20, 24, 60, 6, [30, 35, 42, 255]);
  outline(image, 20, surfaceY, surfaceWidth, 48, border);
  if (mutation !== "missing-content")
    rect(image, contentX, surfaceY + 19, contentWidth, 6, [65, 70, 78, 255]);
  rect(image, 28, surfaceY + 17, 5, 10, [95, 100, 108, 255]);
  rect(
    image,
    202 - (200 - surfaceWidth),
    surfaceY + 17,
    8,
    10,
    [95, 100, 108, 255],
  );
  if (mutation !== "missing-helper") {
    const helperY = mutation === "overlap" ? surfaceY + 32 : surfaceY + 59;
    rect(image, 20, helperY, 110, 5, [90, 95, 104, 255]);
  }
  return PNG.sync.write(image);
};

const writeGoldImage = (
  relativeRoot: string,
  identity: string,
  mutation: GoldMutation,
): string => {
  const imageId = opaqueId("image", `gold\0${identity}`);
  const file = `${relativeRoot}/gold/blind-packet/images/${imageId}.png`;
  mkdirSync(path.dirname(absolute(file)), { recursive: true });
  writeFileSync(absolute(file), goldImage(mutation));
  return file.replace(`${relativeRoot}/gold/blind-packet/`, "");
};

const orderedTasks = <T extends { task: PairedTask }>(rows: T[]): T[] =>
  [...rows].sort((left, right) =>
    sha256(`${BUILD_SEED}\0order\0${left.task.taskId}`).localeCompare(
      sha256(`${BUILD_SEED}\0order\0${right.task.taskId}`),
    ),
  );

const buildGold = (
  root: string,
  protocolCommitment: string,
): { packet: PairedPacket; key: GoldKey } => {
  const rows: Array<{ task: PairedTask; answer: GoldKeyRow }> = [];
  for (const goldCase of GOLD_CASES) {
    const primaryPairId = opaqueId("pair", `gold\0${goldCase.id}`);
    const referenceSourceHash = sha256(goldImage("exact"));
    const firstSourceHash = sha256(goldImage(goldCase.first));
    const secondSourceHash = sha256(goldImage(goldCase.second));
    const primaryFirstOnLeft =
      Number.parseInt(
        sha256(`${BUILD_SEED}\0gold-side\0${goldCase.id}`).slice(0, 2),
        16,
      ) %
        2 ===
      0;
    for (const presentation of ["primary", "side-swapped"] as const) {
      const firstOnLeft =
        presentation === "primary" ? primaryFirstOnLeft : !primaryFirstOnLeft;
      const token = `${goldCase.id}\0${presentation}`;
      const taskId = opaqueId("task", `gold\0${token}`);
      const referenceId = opaqueId("reference", `gold\0${token}`);
      const leftCandidateId = opaqueId("candidate", `gold\0${token}\0left`);
      const rightCandidateId = opaqueId("candidate", `gold\0${token}\0right`);
      const referenceImage = writeGoldImage(
        root,
        `${token}\0ref-copy`,
        "exact",
      );
      const leftMutation = firstOnLeft ? goldCase.first : goldCase.second;
      const rightMutation = firstOnLeft ? goldCase.second : goldCase.first;
      const leftImage = writeGoldImage(
        root,
        `${token}\0left-copy`,
        leftMutation,
      );
      const rightImage = writeGoldImage(
        root,
        `${token}\0right-copy`,
        rightMutation,
      );
      check(
        fileHash(`${root}/gold/blind-packet/${referenceImage}`) ===
          referenceSourceHash &&
          fileHash(`${root}/gold/blind-packet/${leftImage}`) ===
            (firstOnLeft ? firstSourceHash : secondSourceHash) &&
          fileHash(`${root}/gold/blind-packet/${rightImage}`) ===
            (firstOnLeft ? secondSourceHash : firstSourceHash),
        `${goldCase.id} generated fixture bytes differ`,
      );
      const expectedChoice: Choice =
        goldCase.winner === "tie"
          ? "tie"
          : (goldCase.winner === "first") === firstOnLeft
            ? "left"
            : "right";
      const task: PairedTask = {
        taskId,
        reference: { referenceId, image: referenceImage },
        left: { candidateId: leftCandidateId, image: leftImage },
        right: { candidateId: rightCandidateId, image: rightImage },
      };
      rows.push({
        task,
        answer: {
          taskId,
          referenceId,
          leftCandidateId,
          rightCandidateId,
          primaryPairId,
          presentation,
          expectedChoice,
          class: goldCase.class,
          decisiveRule: goldCase.decisiveRule,
        },
      });
    }
  }
  const ordered = orderedTasks(rows);
  const tasks = ordered.map((row) => row.task);
  const randomizedBatchHash = batchHash(tasks);
  const packet: PairedPacket = {
    version: GOLD_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    phase: "gold",
    status: "opaque-ungraded",
    protocolCommitment,
    rubricVersion: RUBRIC_VERSION,
    rubric: comparisonRubric(),
    instructions: [
      "For each task compare the independent reference with opaque Candidate Left and Candidate Right.",
      "Use the locked decision order and materiality tolerances. Choose left, right, or tie; never infer provenance.",
      "A non-tie requires decisive differences and concrete defects in the losing candidate. A tie requires a measured tolerance or exact-equality basis.",
      "Do not compare tasks, search parent directories, inspect keys, or infer hidden controls.",
    ],
    gradeSchema: SCHEMA_PATH,
    preflight:
      "npx tsx recipe/input-field-paired-comparison-v1.ts --preflight <grade-file>",
    counts: {
      tasks: 48,
      primaryTasks: 24,
      sideSwappedHiddenDuplicates: 24,
    },
    randomizedBatchHash,
    tasks,
  };
  return {
    packet,
    key: {
      version: "paired-comparison-gold-key-v1",
      lockedBeforeRaterAccess: true,
      separateFromTargetPerformance: true,
      randomizedBatchHash,
      counts: {
        tasks: 48,
        primaryCases: 24,
        clearWinnerPresentations: 24,
        trueTiePresentations: 12,
        materialityBoundaryPresentations: 12,
      },
      answers: ordered.map((row) => row.answer),
    },
  };
};

const buildPerformance = (
  root: string,
  protocolCommitment: string,
  source: SourceReceipt,
): { packet: PairedPacket; key: PerformanceKey } => {
  const references = byCell(source.references);
  const legacy = byCell(source.outputs.legacy);
  const recipe = byCell(source.outputs.recipeReact);
  const rows: Array<{ task: PairedTask; key: PerformanceKeyRow }> = [];
  for (const cell of source.matrix.cells) {
    const reference = references.get(cell.key);
    const candidates: Record<CandidateIdentity, Artifact | undefined> = {
      legacy: legacy.get(cell.key),
      recipe: recipe.get(cell.key),
    };
    check(
      reference && candidates.legacy && candidates.recipe,
      `${cell.key} is incomplete`,
    );
    check(
      fileHash(reference.file) === reference.hash &&
        fileHash(candidates.legacy.file) === candidates.legacy.hash &&
        fileHash(candidates.recipe.file) === candidates.recipe.hash,
      `${cell.key} source bytes differ`,
    );
    const primaryPairId = opaqueId("pair", `performance\0${cell.key}`);
    const primaryRecipeOnLeft =
      Number.parseInt(
        sha256(`${BUILD_SEED}\0performance-side\0${cell.key}`).slice(0, 2),
        16,
      ) %
        2 ===
      0;
    for (const presentation of ["primary", "side-swapped"] as const) {
      const recipeOnLeft =
        presentation === "primary" ? primaryRecipeOnLeft : !primaryRecipeOnLeft;
      const token = `${cell.key}\0${presentation}`;
      const taskId = opaqueId("task", `performance\0${token}`);
      const referenceId = opaqueId("reference", `performance\0${token}`);
      const leftCandidateId = opaqueId(
        "candidate",
        `performance\0${token}\0left`,
      );
      const rightCandidateId = opaqueId(
        "candidate",
        `performance\0${token}\0right`,
      );
      const referenceImage = `images/${opaqueId("image", `${token}\0reference`)}.png`;
      const leftImage = `images/${opaqueId("image", `${token}\0left`)}.png`;
      const rightImage = `images/${opaqueId("image", `${token}\0right`)}.png`;
      const packetRoot = `${root}/performance/blind-packet`;
      copyOpaque(reference.file, `${packetRoot}/${referenceImage}`);
      copyOpaque(
        recipeOnLeft ? candidates.recipe.file : candidates.legacy.file,
        `${packetRoot}/${leftImage}`,
      );
      copyOpaque(
        recipeOnLeft ? candidates.legacy.file : candidates.recipe.file,
        `${packetRoot}/${rightImage}`,
      );
      const task: PairedTask = {
        taskId,
        reference: { referenceId, image: referenceImage },
        left: { candidateId: leftCandidateId, image: leftImage },
        right: { candidateId: rightCandidateId, image: rightImage },
      };
      rows.push({
        task,
        key: {
          taskId,
          primaryPairId,
          presentation,
          cellKey: cell.key,
          source: cell.library,
          axes: {
            Size: cell.size,
            State: cell.state,
            Content: cell.content,
            Required: cell.required,
            Adornments: cell.adornments,
          },
          left: {
            candidateId: leftCandidateId,
            identity: recipeOnLeft ? "recipe" : "legacy",
          },
          right: {
            candidateId: rightCandidateId,
            identity: recipeOnLeft ? "legacy" : "recipe",
          },
        },
      });
    }
  }
  const ordered = orderedTasks(rows);
  const tasks = ordered.map((row) => row.task);
  const randomizedBatchHash = batchHash(tasks);
  const packet: PairedPacket = {
    version: PERFORMANCE_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    phase: "performance",
    status: "opaque-ungraded",
    protocolCommitment,
    rubricVersion: RUBRIC_VERSION,
    rubric: comparisonRubric(),
    instructions: [
      "For each exact cell choose which opaque candidate is closer to the independent reference.",
      "Apply the ranked rubric and locked v2-compatible tolerances; structure and state dominate.",
      "Neither candidate being absolutely acceptable is not a tie reason: still choose the closer candidate unless their material differences are equivalent within the explicit tie tolerance.",
      "Do not compare tasks, infer provenance or hidden controls, inspect keys or parent evidence, or communicate with another rater.",
    ],
    gradeSchema: SCHEMA_PATH,
    preflight:
      "npx tsx recipe/input-field-paired-comparison-v1.ts --preflight <grade-file>",
    counts: {
      tasks: 256,
      primaryTasks: 128,
      sideSwappedHiddenDuplicates: 128,
    },
    randomizedBatchHash,
    tasks,
  };
  return {
    packet,
    key: {
      version: "input-field-paired-performance-key-v1",
      revealOnlyAfterReliabilityPasses: true,
      randomizedBatchHash,
      rows: ordered.map((row) => row.key),
    },
  };
};

const qualificationReceiptPath = (rater: Rater): string =>
  `${ROOT}/gold/receipts/${rater.toLowerCase()}.json`;
const templatePath = (phase: Phase, rater: Rater): string =>
  `${ROOT}/${phase}/templates/${rater.toLowerCase()}.json`;
export const outputPath = (phase: Phase, rater: Rater): string =>
  `${ROOT}/${phase}/submissions/${rater.toLowerCase()}.json`;

const makeTemplate = (
  packet: PairedPacket,
  packetPath: string,
  rater: Rater,
): GradeEnvelope => ({
  version: GRADE_VERSION,
  phase: packet.phase,
  raterId: rater,
  packetHash: fileHash(packetPath),
  randomizedBatchHash: packet.randomizedBatchHash,
  protocolCommitment: packet.protocolCommitment,
  rubricVersion: RUBRIC_VERSION,
  calibrationReceipt: null,
  counts: { expected: packet.tasks.length, submitted: null },
  grades: packet.tasks.map((task) => ({
    taskId: task.taskId,
    referenceId: task.reference.referenceId,
    leftCandidateId: task.left.candidateId,
    rightCandidateId: task.right.candidateId,
    choice: null as unknown as Choice,
    confidence: null as unknown as Confidence,
    rationale: {
      decisiveDifferences: [],
      leftDefects: [],
      rightDefects: [],
      tieBasis: null,
    },
  })),
});

const concrete = (value: unknown): value is string =>
  typeof value === "string" &&
  value.trim().length >= 20 &&
  !IDENTITY_LEAK.test(value);

export function validateGradeEnvelope(
  envelope: GradeEnvelope,
  packet: PairedPacket,
  packetHash: string,
  expectedRater: Rater = envelope.raterId,
  qualificationOverride?: QualificationReceipt,
): void {
  exactKeys(
    envelope as unknown as Record<string, unknown>,
    [
      "version",
      "phase",
      "raterId",
      "packetHash",
      "randomizedBatchHash",
      "protocolCommitment",
      "rubricVersion",
      "calibrationReceipt",
      "counts",
      "grades",
    ],
    "grade envelope",
  );
  check(
    envelope.version === GRADE_VERSION &&
      envelope.phase === packet.phase &&
      envelope.raterId === expectedRater &&
      RATERS.includes(envelope.raterId) &&
      envelope.packetHash === packetHash &&
      envelope.randomizedBatchHash === packet.randomizedBatchHash &&
      envelope.protocolCommitment === packet.protocolCommitment &&
      envelope.rubricVersion === RUBRIC_VERSION &&
      envelope.counts.expected === packet.tasks.length &&
      envelope.counts.submitted === packet.tasks.length &&
      envelope.grades.length === packet.tasks.length,
    "grade binding, rater, counts, or ordered rows differ",
  );
  if (packet.phase === "gold")
    check(
      envelope.calibrationReceipt === null,
      "gold may not bind a calibration receipt",
    );
  else {
    const receipt = envelope.calibrationReceipt;
    const qualification =
      qualificationOverride ??
      (receipt !== null && existsSync(absolute(receipt.path))
        ? parse<QualificationReceipt>(receipt.path)
        : undefined);
    const qualificationHash =
      qualificationOverride !== undefined
        ? sha256(jsonBytes(qualificationOverride))
        : receipt !== null && existsSync(absolute(receipt.path))
          ? fileHash(receipt.path)
          : "";
    check(
      receipt !== null &&
        receipt.path === qualificationReceiptPath(envelope.raterId) &&
        qualification !== undefined &&
        qualification.raterId === envelope.raterId &&
        qualification.packetHash === fileHash(GOLD_PACKET_PATH) &&
        qualification.randomizedBatchHash ===
          parse<PairedPacket>(GOLD_PACKET_PATH).randomizedBatchHash &&
        qualification.protocolCommitment === packet.protocolCommitment &&
        qualification.envelopeValid &&
        qualification.passed &&
        qualification.score >= 0.95 &&
        qualification.allClearWinnersCorrect &&
        receipt.sha256 === qualificationHash &&
        receipt.score >= 0.95 &&
        receipt.allClearWinnersCorrect &&
        receipt.passed,
      "performance grade lacks a passing hash-pinned qualification",
    );
  }
  for (const [index, grade] of envelope.grades.entries()) {
    const task = packet.tasks[index]!;
    exactKeys(
      grade as unknown as Record<string, unknown>,
      [
        "taskId",
        "referenceId",
        "leftCandidateId",
        "rightCandidateId",
        "choice",
        "confidence",
        "rationale",
      ],
      `grade ${index}`,
    );
    exactKeys(
      grade.rationale as unknown as Record<string, unknown>,
      ["decisiveDifferences", "leftDefects", "rightDefects", "tieBasis"],
      `grade ${index} rationale`,
    );
    check(
      grade.taskId === task.taskId &&
        grade.referenceId === task.reference.referenceId &&
        grade.leftCandidateId === task.left.candidateId &&
        grade.rightCandidateId === task.right.candidateId &&
        CHOICES.includes(grade.choice) &&
        CONFIDENCE.includes(grade.confidence) &&
        grade.rationale.decisiveDifferences.every(concrete) &&
        grade.rationale.leftDefects.every(concrete) &&
        grade.rationale.rightDefects.every(concrete),
      `grade ${index} IDs, choice, confidence, or rationale differ`,
    );
    if (grade.choice === "tie") {
      check(
        grade.rationale.decisiveDifferences.length === 0 &&
          concrete(grade.rationale.tieBasis) &&
          /\b(exact|within|px|%|srgb|euclidean)\b/i.test(
            grade.rationale.tieBasis,
          ),
        `grade ${index} has an invalid tie`,
      );
    } else {
      const losingDefects =
        grade.choice === "left"
          ? grade.rationale.rightDefects
          : grade.rationale.leftDefects;
      check(
        grade.rationale.tieBasis === null &&
          grade.rationale.decisiveDifferences.length > 0 &&
          losingDefects.length > 0,
        `grade ${index} non-tie lacks a decisive difference or losing defect`,
      );
    }
  }
}

const validatePacket = (
  packet: PairedPacket,
  expectedPhase: Phase,
  expectedTasks: number,
): void => {
  check(
    packet.protocolVersion === PROTOCOL_VERSION &&
      packet.phase === expectedPhase &&
      packet.status === "opaque-ungraded" &&
      packet.rubricVersion === RUBRIC_VERSION &&
      packet.counts.tasks === expectedTasks &&
      packet.tasks.length === expectedTasks &&
      packet.randomizedBatchHash === batchHash(packet.tasks),
    `${expectedPhase} packet metadata, count, or batch hash differs`,
  );
  const ids = new Set<string>();
  const packetRoot = `${ROOT}/${expectedPhase}/blind-packet`;
  for (const task of packet.tasks) {
    check(
      /^task-[a-f0-9]{24}$/.test(task.taskId) &&
        /^reference-[a-f0-9]{24}$/.test(task.reference.referenceId) &&
        /^candidate-[a-f0-9]{24}$/.test(task.left.candidateId) &&
        /^candidate-[a-f0-9]{24}$/.test(task.right.candidateId) &&
        !IDENTITY_LEAK.test(JSON.stringify(task)),
      `${task.taskId} leaks identity or has malformed IDs`,
    );
    for (const id of [
      task.taskId,
      task.reference.referenceId,
      task.left.candidateId,
      task.right.candidateId,
    ]) {
      check(!ids.has(id), `${id} is reused`);
      ids.add(id);
    }
    for (const image of [
      task.reference.image,
      task.left.image,
      task.right.image,
    ])
      containedRegularFile(image, packetRoot);
  }
};

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
    `${relativeFile} is not regular`,
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

const imageHash = (root: string, image: string): string =>
  sha256(readFileSync(containedRegularFile(image, root)));

interface DuplicatePair {
  primary: number;
  swapped: number;
}

const discoverSideSwaps = (
  packet: PairedPacket,
  expectedPairs: number,
): DuplicatePair[] => {
  const packetRoot = `${ROOT}/${packet.phase}/blind-packet`;
  const groups = new Map<string, number[]>();
  for (const [index, task] of packet.tasks.entries()) {
    const reference = imageHash(packetRoot, task.reference.image);
    const candidates = [
      imageHash(packetRoot, task.left.image),
      imageHash(packetRoot, task.right.image),
    ].sort();
    const signature = `${reference}\0${candidates.join("\0")}`;
    const indexes = groups.get(signature) ?? [];
    indexes.push(index);
    groups.set(signature, indexes);
  }
  check(groups.size === expectedPairs, "hidden pair cardinality differs");
  const pairs: DuplicatePair[] = [];
  for (const indexes of groups.values()) {
    check(indexes.length === 2, "hidden pair does not have two presentations");
    const [first, second] = indexes;
    check(
      first !== undefined && second !== undefined,
      "hidden pair is incomplete",
    );
    const firstTask = packet.tasks[first]!;
    const secondTask = packet.tasks[second]!;
    check(
      imageHash(packetRoot, firstTask.left.image) ===
        imageHash(packetRoot, secondTask.right.image) &&
        imageHash(packetRoot, firstTask.right.image) ===
          imageHash(packetRoot, secondTask.left.image),
      "hidden pair is not side-swapped",
    );
    pairs.push({
      primary: Math.min(first, second),
      swapped: Math.max(first, second),
    });
  }
  return pairs;
};

const qualificationMetric = (
  correct: number,
  denominator: number,
): QualificationMetric => ({
  correct,
  denominator,
  ratio: correct / denominator,
});

const validateGoldQualificationBindings = (
  packet: PairedPacket,
  key: GoldKey,
): void => {
  validatePacket(packet, "gold", 48);
  check(
    key.version === "paired-comparison-gold-key-v1" &&
      key.lockedBeforeRaterAccess &&
      key.separateFromTargetPerformance &&
      key.randomizedBatchHash === packet.randomizedBatchHash &&
      JSON.stringify(key.counts) ===
        JSON.stringify({
          tasks: 48,
          primaryCases: 24,
          clearWinnerPresentations: 24,
          trueTiePresentations: 12,
          materialityBoundaryPresentations: 12,
        }) &&
      key.answers.length === 48,
    "gold key binding or counts differ",
  );
  const groups = new Map<string, GoldKeyRow[]>();
  for (const [index, answer] of key.answers.entries()) {
    const task = packet.tasks[index]!;
    exactKeys(
      answer as unknown as Record<string, unknown>,
      [
        "taskId",
        "referenceId",
        "leftCandidateId",
        "rightCandidateId",
        "primaryPairId",
        "presentation",
        "expectedChoice",
        "class",
        "decisiveRule",
      ],
      `gold answer ${index}`,
    );
    check(
      answer.taskId === task.taskId &&
        answer.referenceId === task.reference.referenceId &&
        answer.leftCandidateId === task.left.candidateId &&
        answer.rightCandidateId === task.right.candidateId &&
        CHOICES.includes(answer.expectedChoice) &&
        ["clear-winner", "true-tie", "materiality-boundary"].includes(
          answer.class,
        ) &&
        answer.decisiveRule.length >= 20 &&
        !IDENTITY_LEAK.test(answer.decisiveRule),
      `gold answer ${index} IDs, choice, class, or identity differ`,
    );
    const rows = groups.get(answer.primaryPairId) ?? [];
    rows.push(answer);
    groups.set(answer.primaryPairId, rows);
  }
  check(groups.size === 24, "gold primary-pair cardinality differs");
  const packetByTask = new Map(packet.tasks.map((task) => [task.taskId, task]));
  const packetRoot = `${ROOT}/gold/blind-packet`;
  for (const rows of groups.values()) {
    const primary = rows.find((row) => row.presentation === "primary");
    const swapped = rows.find((row) => row.presentation === "side-swapped");
    check(
      rows.length === 2 && primary !== undefined && swapped !== undefined,
      "gold pair lacks exactly one primary and one side-swapped presentation",
    );
    const primaryTask = packetByTask.get(primary.taskId)!;
    const swappedTask = packetByTask.get(swapped.taskId)!;
    check(
      primary.taskId !== swapped.taskId &&
        primary.referenceId !== swapped.referenceId &&
        primary.leftCandidateId !== swapped.rightCandidateId &&
        primary.rightCandidateId !== swapped.leftCandidateId &&
        imageHash(packetRoot, primaryTask.reference.image) ===
          imageHash(packetRoot, swappedTask.reference.image) &&
        imageHash(packetRoot, primaryTask.left.image) ===
          imageHash(packetRoot, swappedTask.right.image) &&
        imageHash(packetRoot, primaryTask.right.image) ===
          imageHash(packetRoot, swappedTask.left.image) &&
        (primary.expectedChoice === "tie"
          ? swapped.expectedChoice === "tie"
          : primary.expectedChoice === "left"
            ? swapped.expectedChoice === "right"
            : swapped.expectedChoice === "left"),
      "gold pair is not an opaque, answer-symmetric side swap",
    );
  }
};

export function scoreGoldEnvelope(
  envelope: GradeEnvelope,
  packet: PairedPacket,
  key: GoldKey,
  packetHash: string,
  gradeHash: string,
  cohortGatePassed = false,
): QualificationReceipt {
  validateGradeEnvelope(envelope, packet, packetHash);
  validateGoldQualificationBindings(packet, key);
  const expected = new Map(
    key.answers.map((answer) => [answer.taskId, answer]),
  );
  let correct = 0;
  let clearWinnersCorrect = 0;
  const classCorrect = {
    "clear-winner": 0,
    "true-tie": 0,
    "materiality-boundary": 0,
  };
  for (const grade of envelope.grades) {
    const answer = expected.get(grade.taskId);
    check(answer, `${grade.taskId} has no gold answer`);
    if (grade.choice === answer.expectedChoice) {
      correct += 1;
      classCorrect[answer.class] += 1;
      if (answer.class === "clear-winner") clearWinnersCorrect += 1;
    }
  }
  const score = correct / 48;
  const allClearWinnersCorrect = clearWinnersCorrect === 24;
  const sideSwapped = key.answers.filter(
    (answer) => answer.presentation === "side-swapped",
  );
  const sideSwapCorrect = sideSwapped.filter((answer) => {
    const index = packet.tasks.findIndex(
      (task) => task.taskId === answer.taskId,
    );
    return envelope.grades[index]!.choice === answer.expectedChoice;
  }).length;
  const normalized = envelope.grades.map((grade, index) =>
    normalizeChoice(packet, index, grade.choice),
  );
  const pairIndexes = new Map<string, number[]>();
  for (const [index, answer] of key.answers.entries()) {
    const indexes = pairIndexes.get(answer.primaryPairId) ?? [];
    indexes.push(index);
    pairIndexes.set(answer.primaryPairId, indexes);
  }
  const sideSwapConsistent = [...pairIndexes.values()].filter(
    ([first, second]) =>
      first !== undefined &&
      second !== undefined &&
      normalized[first] === normalized[second],
  ).length;
  const instrument = parse<any>(RECEIPT_PATH);
  return {
    version: "paired-comparison-qualification-receipt-v1",
    raterId: envelope.raterId,
    packetHash,
    randomizedBatchHash: packet.randomizedBatchHash,
    protocolCommitment: packet.protocolCommitment,
    gradeHash,
    correct,
    denominator: 48,
    score,
    clearWinnersCorrect,
    clearWinnersDenominator: 24,
    allClearWinnersCorrect,
    envelopeValid: true,
    passed: score >= 0.95 && allClearWinnersCorrect,
    thresholds: {
      goldAccuracyMinimum: 0.95,
      allClearWinnersRequired: true,
      validEnvelopeRequired: true,
    },
    waiversApplied: false,
    hashes: {
      protocol: fileHash(PROTOCOL_PATH),
      instrumentReceipt: fileHash(RECEIPT_PATH),
      goldPacket: packetHash,
      goldAnswerKey: fileHash(GOLD_KEY_PATH),
      gradeSchema: fileHash(SCHEMA_PATH),
      goldTemplate: fileHash(templatePath("gold", envelope.raterId)),
      goldSubmission: gradeHash,
    },
    scoreBreakdown: {
      clearWinner: qualificationMetric(classCorrect["clear-winner"], 24),
      trueTie: qualificationMetric(classCorrect["true-tie"], 12),
      materialityBoundary: qualificationMetric(
        classCorrect["materiality-boundary"],
        12,
      ),
    },
    sideSwapCalibration: {
      accuracy: qualificationMetric(sideSwapCorrect, 24),
      consistency: qualificationMetric(sideSwapConsistent, 24),
    },
    performanceBinding: {
      packetPath: instrument.performance.packet.path,
      packetHash: instrument.performance.packet.sha256,
      templatePath: templatePath("performance", envelope.raterId),
      qualificationReceiptPath: qualificationReceiptPath(envelope.raterId),
      outputPath: outputPath("performance", envelope.raterId),
      cohortGatePassed,
      commissioned: cohortGatePassed && score >= 0.95 && allClearWinnersCorrect,
    },
    accessControl: {
      goldAnswerKeyOpened: true,
      performancePacketOpened: false,
      performanceAnswerKeyOpened: false,
      performanceResultsOpened: false,
      performanceIdentityRevealed: false,
    },
  };
}

const normalizeChoice = (
  packet: PairedPacket,
  index: number,
  choice: Choice,
): "candidate-0" | "candidate-1" | "tie" => {
  if (choice === "tie") return "tie";
  const task = packet.tasks[index]!;
  const packetRoot = `${ROOT}/${packet.phase}/blind-packet`;
  const chosen = imageHash(
    packetRoot,
    choice === "left" ? task.left.image : task.right.image,
  );
  const sorted = [
    imageHash(packetRoot, task.left.image),
    imageHash(packetRoot, task.right.image),
  ].sort();
  return chosen === sorted[0] ? "candidate-0" : "candidate-1";
};

const pairwiseAgreement = (
  left: readonly string[],
  right: readonly string[],
): number =>
  left.filter((value, index) => value === right[index]).length / left.length;

export function evaluatePerformanceReliability(
  packet: PairedPacket,
  envelopes: readonly GradeEnvelope[],
  qualificationOverrides?: Partial<Record<Rater, QualificationReceipt>>,
) {
  check(envelopes.length === 3, "exactly three calibrated raters are required");
  const packetHash = fileHash(PERFORMANCE_PACKET_PATH);
  const byRater = new Map<Rater, GradeEnvelope>();
  for (const envelope of envelopes) {
    validateGradeEnvelope(
      envelope,
      packet,
      packetHash,
      envelope.raterId,
      qualificationOverrides?.[envelope.raterId],
    );
    check(!byRater.has(envelope.raterId), `${envelope.raterId} is duplicated`);
    byRater.set(envelope.raterId, envelope);
  }
  check(
    RATERS.every((rater) => byRater.has(rater)),
    "rater roster is incomplete",
  );
  const vectors = Object.fromEntries(
    RATERS.map((rater) => [
      rater,
      byRater
        .get(rater)!
        .grades.map((grade, index) =>
          normalizeChoice(packet, index, grade.choice),
        ),
    ]),
  ) as Record<Rater, Array<"candidate-0" | "candidate-1" | "tie">>;
  const duplicatePairs = discoverSideSwaps(packet, 128);
  const sideSwap = Object.fromEntries(
    RATERS.map((rater) => {
      const consistent = duplicatePairs.filter(
        (pair) => vectors[rater][pair.primary] === vectors[rater][pair.swapped],
      ).length;
      return [
        rater,
        {
          consistent,
          denominator: 128,
          ratio: consistent / 128,
          passed: consistent / 128 >= 0.95,
        },
      ];
    }),
  ) as unknown as Record<
    Rater,
    { consistent: number; denominator: 128; ratio: number; passed: boolean }
  >;
  const majorityCategory = (index: number): string | null => {
    const values = RATERS.map((rater) => vectors[rater][index]!);
    return (
      values.find(
        (value) =>
          values.filter((candidate) => candidate === value).length >= 2,
      ) ?? null
    );
  };
  const majoritySideSwapConsistent = duplicatePairs.filter(
    (pair) =>
      majorityCategory(pair.primary) !== null &&
      majorityCategory(pair.primary) === majorityCategory(pair.swapped),
  ).length;
  const pairs = [
    ["RATER-PAIR-V1-A", "RATER-PAIR-V1-B"],
    ["RATER-PAIR-V1-A", "RATER-PAIR-V1-C"],
    ["RATER-PAIR-V1-B", "RATER-PAIR-V1-C"],
  ] as const;
  const pairwise = pairs.map(([left, right]) => ({
    raters: `${left}/${right}`,
    agreement: pairwiseAgreement(vectors[left], vectors[right]),
  }));
  const categories = ["candidate-0", "candidate-1", "tie"] as const;
  const observed =
    packet.tasks.reduce((sum, _task, index) => {
      const counts = categories.map(
        (category) =>
          RATERS.filter((rater) => vectors[rater][index] === category).length,
      );
      return (
        sum + counts.reduce((row, count) => row + count * (count - 1), 0) / 6
      );
    }, 0) / packet.tasks.length;
  const proportions = categories.map(
    (category) =>
      RATERS.reduce(
        (sum, rater) =>
          sum + vectors[rater].filter((value) => value === category).length,
        0,
      ) /
      (packet.tasks.length * RATERS.length),
  );
  const expected = proportions.reduce(
    (sum, proportion) => sum + proportion ** 2,
    0,
  );
  const fleissKappa =
    expected === 1
      ? observed === 1
        ? 1
        : 0
      : (observed - expected) / (1 - expected);
  const tasksWithMajoritySupport = packet.tasks.filter(
    (_task, index) => majorityCategory(index) !== null,
  ).length;
  const diagnosticPrimaryIndexes = duplicatePairs.map((pair) => pair.primary);
  const diagnosticPrimaryWithMajoritySupport = diagnosticPrimaryIndexes.filter(
    (index) => majorityCategory(index) !== null,
  ).length;
  const passed =
    Object.values(sideSwap).every((metric) => metric.passed) &&
    majoritySideSwapConsistent >= 127 &&
    pairwise.every((metric) => metric.agreement >= 0.75) &&
    fleissKappa >= 0.6 &&
    tasksWithMajoritySupport === 256;
  return {
    passed,
    validCalibratedRaters: 3,
    sideSwap,
    majoritySideSwap: {
      consistent: majoritySideSwapConsistent,
      denominator: 128,
      passed: majoritySideSwapConsistent >= 127,
    },
    pairwise,
    overallRawPairwiseAgreement:
      pairwise.reduce((sum, metric) => sum + metric.agreement, 0) / 3,
    fleissKappa,
    tasksWithMajoritySupport,
    diagnosticPrimaryWithMajoritySupport,
    primaryDenominator: 128,
    thresholds: reliabilityThresholds(),
    vectors,
    duplicatePairs,
  };
}

export function adjudicateRelativePerformance(
  packet: PairedPacket,
  envelopes: readonly GradeEnvelope[],
  unsealKey: () => PerformanceKey,
  qualificationOverrides?: Partial<Record<Rater, QualificationReceipt>>,
) {
  const reliability = evaluatePerformanceReliability(
    packet,
    envelopes,
    qualificationOverrides,
  );
  if (!reliability.passed)
    return {
      reliability,
      performanceKeyUnsealed: false as const,
      relativeResult: null,
    };
  const key = unsealKey();
  check(
    key.version === "input-field-paired-performance-key-v1" &&
      key.revealOnlyAfterReliabilityPasses &&
      key.randomizedBatchHash === packet.randomizedBatchHash &&
      key.rows.length === 256,
    "performance key binding differs",
  );
  const outcomes: Array<{
    cellKey: string;
    source: string;
    axes: Record<string, string>;
    outcome: "recipe-wins" | "legacy-wins" | "ties";
    supportingRaters: number;
  }> = [];
  const primaryMappings = key.rows.filter(
    (mapping) => mapping.presentation === "primary",
  );
  check(
    primaryMappings.length === 128,
    "performance key has no 128-row primary set",
  );
  for (const mapping of primaryMappings) {
    const taskIndex = packet.tasks.findIndex(
      (task) => task.taskId === mapping.taskId,
    );
    check(taskIndex >= 0, `${mapping.taskId} is absent from the packet`);
    const votes = RATERS.map((rater) => {
      const choice = envelopes.find((envelope) => envelope.raterId === rater)!
        .grades[taskIndex]!.choice;
      if (choice === "tie") return "ties" as const;
      return (choice === "left"
        ? mapping.left.identity
        : mapping.right.identity) === "recipe"
        ? ("recipe-wins" as const)
        : ("legacy-wins" as const);
    });
    const outcome = votes.find(
      (value) => votes.filter((candidate) => candidate === value).length >= 2,
    );
    check(outcome, `${mapping.cellKey} lacks two-rater majority support`);
    outcomes.push({
      cellKey: mapping.cellKey,
      source: mapping.source,
      axes: mapping.axes,
      outcome,
      supportingRaters: votes.filter((vote) => vote === outcome).length,
    });
  }
  check(
    outcomes.length === 128 &&
      new Set(outcomes.map((outcome) => outcome.cellKey)).size === 128,
    "final denominator is not exactly 128 unique cells",
  );
  const aggregate = (rows: typeof outcomes) => ({
    recipeWins: rows.filter((row) => row.outcome === "recipe-wins").length,
    legacyWins: rows.filter((row) => row.outcome === "legacy-wins").length,
    ties: rows.filter((row) => row.outcome === "ties").length,
    denominator: rows.length,
  });
  const by = (field: "source" | keyof PerformanceKeyRow["axes"]) => {
    const values = new Set(
      outcomes.map((row) =>
        field === "source" ? row.source : row.axes[field]!,
      ),
    );
    return Object.fromEntries(
      [...values]
        .sort()
        .map((value) => [
          value,
          aggregate(
            outcomes.filter((row) =>
              field === "source"
                ? row.source === value
                : row.axes[field] === value,
            ),
          ),
        ]),
    );
  };
  const total = aggregate(outcomes);
  return {
    reliability,
    performanceKeyUnsealed: true as const,
    relativeResult: {
      total,
      bySource: by("source"),
      byAxes: {
        Size: by("Size"),
        State: by("State"),
        Content: by("Content"),
        Required: by("Required"),
        Adornments: by("Adornments"),
      },
      primaryCellsOnly: true,
      duplicateVotesExcludedFromFinalArithmetic: true,
      noDenominatorReduction: total.denominator === 128,
      noHiddenSourceBranch: true,
      relativePass:
        total.denominator === 128 && total.recipeWins > total.legacyWins,
      absoluteRecognisabilityInferred: false,
      inputSuccessAuthorized: false,
      liveWorkAuthorized: false,
      outcomes,
    },
  };
}

const objectiveAbsoluteGate = (source: SourceReceipt) => {
  const cells = new Map(source.matrix.cells.map((cell) => [cell.key, cell]));
  const semanticRows = source.outputs.recipeReact.filter((artifact) => {
    const cell = cells.get(artifact.cellKey);
    if (!cell) return false;
    return (
      artifact.paintedPixels > 0 &&
      artifact.contentBox.width > 0 &&
      artifact.contentBox.height > 0 &&
      artifact.contentBox.width <= artifact.width &&
      artifact.contentBox.height <= artifact.height &&
      artifact.dom.inputFound &&
      artifact.dom.labelFound &&
      artifact.dom.labelForMatches &&
      artifact.dom.accessibleNameMatched &&
      artifact.dom.structure.labels === 1 &&
      artifact.dom.structure.inputs === 1 &&
      artifact.dom.structure.messages === 1 &&
      artifact.dom.structure.adornments ===
        (cell.adornments === "both" ? 2 : 0) &&
      artifact.dom.required === (cell.required === "true") &&
      artifact.dom.disabled === (cell.state === "disabled") &&
      (artifact.dom.ariaInvalid === "true") === (cell.state === "error") &&
      artifact.dom.ariaDescribedBy !== null
    );
  }).length;
  const states = new Set(source.matrix.cells.map((cell) => cell.state));
  const acquisitionPassed = Object.values(
    source.nonvisualEvidence.acquisitionAccounting,
  ).every(
    (entry) =>
      entry.factsSelected > 0 &&
      entry.parameterFields > 0 &&
      entry.failures.length === 0,
  );
  const parity = source.nonvisualEvidence.recipeWebComponentParity;
  return {
    version: "input-field-objective-absolute-gate-v1",
    claim:
      "Objective prerequisites for absolute Input/Field acceptance; independent of paired preference.",
    status: "blocked-existing-evidence-incomplete",
    passed: false,
    checks: {
      requiredRolesAndStates: {
        status:
          semanticRows === 128 &&
          ["default", "focus-visible", "error", "disabled"].every((state) =>
            states.has(state),
          )
            ? "passed"
            : "failed",
        semanticRows,
        denominator: 128,
      },
      geometryAndToleranceToIndependentReference: {
        status: "not-evidenced",
        reason:
          "Existing receipts retain screenshots and content-box dimensions but no locked per-role source-relative geometry measurement under the v2 tolerances.",
      },
      noClippingOrOverlap: {
        status: "not-evidenced",
        reason:
          "Existing non-subjective probes do not record required-part boxes or pixel-visible-area intersections needed to prove clipping <=5% and overlap <=2 px.",
      },
      semanticAndAria: {
        status: semanticRows === 128 ? "passed" : "failed",
        evidence:
          "128/128 React rows plus the retained 256/256 API/ARIA event assertion",
      },
      webComponentParity: {
        status:
          parity.cells === 128 &&
          parity.nonzeroCells === 128 &&
          parity.pixelComparisons === 128 &&
          parity.perceptualPixelEqualToReact === 128 &&
          parity.geometryEqualToReact === 128 &&
          parity.semanticProbeEqualToReact === 128 &&
          !parity.includedInBlindSpecimens
            ? "passed-parity-only"
            : "failed",
        cells: parity.cells,
      },
      zeroSilentAccounting: {
        status:
          acquisitionPassed &&
          source.nonvisualEvidence.zeroPixelComparisons === 0
            ? "passed-offline"
            : "failed",
        liveCanvasAccounting: "pending",
      },
      usability: {
        status: "pending-live-canvas",
        required:
          "reflow, variant switching, token binding, no fake layout, and live two-cycle fixed point",
      },
      noHiddenSourceBranch: {
        status:
          source.nonvisualEvidence.noLibraryBranchChecks.forbiddenIdentities ===
            "0 matches" &&
          source.nonvisualEvidence.noLibraryBranchChecks.hardStopRequired &&
          !source.nonvisualEvidence.noLibraryBranchChecks.controlFailed
            ? "passed"
            : "failed",
      },
    },
    remainingHumanVisualDecision:
      "An independent design reviewer must decide whether each rendered Input/Field is absolutely recognisable as the original-source component under the locked absolute rubric; relative preference cannot answer that question.",
    relativePreferenceCanSatisfyThisGate: false,
    inputSuccess: false,
    liveWorkAuthorized: false,
  };
};

const prompts = (packetHash: string) =>
  Object.fromEntries(
    RATERS.map((rater) => [
      rater,
      {
        gold: [
          `Act as independent calibrated rater ${rater}.`,
          `Open only ${GOLD_PACKET_PATH}, ${templatePath("gold", rater)}, ${SCHEMA_PATH}, and images referenced by the packet.`,
          "Grade all 48 rows in exact order using left|right|tie, confidence, and concrete rationale; never inspect keys, parent directories, prior grades, or other raters.",
          `Write only ${outputPath("gold", rater)} and run npx tsx recipe/input-field-paired-comparison-v1.ts --preflight ${outputPath("gold", rater)}.`,
          "Stop after GOLD until a passing qualification receipt is issued.",
        ].join(" "),
        performance: [
          `Only after ${qualificationReceiptPath(rater)} proves >=95% GOLD and all clear winners correct, open ${PERFORMANCE_PACKET_PATH}, ${templatePath("performance", rater)}, ${SCHEMA_PATH}, that receipt, and packet-referenced images.`,
          "Grade all 256 tasks independently in exact order. Choose which candidate is closer even if both fail absolutely; tie only within the explicit tolerances.",
          `Write only ${outputPath("performance", rater)} and run npx tsx recipe/input-field-paired-comparison-v1.ts --preflight ${outputPath("performance", rater)}.`,
          `Never inspect ${PERFORMANCE_KEY_PATH}, compare tasks, infer candidate or hidden-control identity, access prior rounds, or communicate with another rater.`,
        ].join(" "),
        outputPaths: {
          gold: outputPath("gold", rater),
          qualificationReceipt: qualificationReceiptPath(rater),
          performance: outputPath("performance", rater),
        },
        performancePacketHash: packetHash,
      },
    ]),
  ) as unknown as Record<
    Rater,
    {
      gold: string;
      performance: string;
      outputPaths: Record<string, string>;
      performancePacketHash: string;
    }
  >;

export async function buildPairedComparisonInstrument(): Promise<void> {
  const before = historicalSnapshots();
  const source = parse<SourceReceipt>(`${SOURCE_ROOT}/receipt.json`);
  check(
    source.matrix.cells.length === 128 &&
      source.references.length === 128 &&
      source.outputs.legacy.length === 128 &&
      source.outputs.recipeReact.length === 128 &&
      source.immutableInputs.referencesByteIdenticalToV1 === 128 &&
      source.immutableInputs.legacyByteIdenticalToV1 === 128,
    "source denominator or immutable-byte continuity differs",
  );
  const protocol = makeProtocol(before);
  rmSync(absolute(NEXT_ROOT), { recursive: true, force: true });
  mkdirSync(absolute(NEXT_ROOT), { recursive: true });
  await writeFormattedJson(`${NEXT_ROOT}/protocol.json`, protocol);
  await writeFormattedJson(`${NEXT_ROOT}/grade.schema.json`, gradeSchema());
  const gold = buildGold(NEXT_ROOT, protocol.commitment);
  writeJson(`${NEXT_ROOT}/gold/blind-packet/packet.json`, gold.packet);
  writeJson(`${NEXT_ROOT}/gold/sealed-answer-key.json`, gold.key);
  const performance = buildPerformance(NEXT_ROOT, protocol.commitment, source);
  writeJson(
    `${NEXT_ROOT}/performance/blind-packet/packet.json`,
    performance.packet,
  );
  writeJson(`${NEXT_ROOT}/performance/sealed-answer-key.json`, performance.key);
  for (const rater of RATERS) {
    writeJson(
      `${NEXT_ROOT}/gold/templates/${rater.toLowerCase()}.json`,
      makeTemplate(
        gold.packet,
        `${NEXT_ROOT}/gold/blind-packet/packet.json`,
        rater,
      ),
    );
    writeJson(
      `${NEXT_ROOT}/performance/templates/${rater.toLowerCase()}.json`,
      makeTemplate(
        performance.packet,
        `${NEXT_ROOT}/performance/blind-packet/packet.json`,
        rater,
      ),
    );
  }
  const absoluteGate = objectiveAbsoluteGate(source);
  await writeFormattedJson(
    `${NEXT_ROOT}/objective-absolute-gate.json`,
    absoluteGate,
  );
  const treePath = (file: string): string => file.replace(NEXT_ROOT, ROOT);
  const nextHash = (file: string): string =>
    fileHash(file.replace(ROOT, NEXT_ROOT));
  const receipt = {
    version: VERSION,
    status: "locked-ungraded-performance-key-sealed",
    protocol: { path: PROTOCOL_PATH, sha256: nextHash(PROTOCOL_PATH) },
    gradeSchema: { path: SCHEMA_PATH, sha256: nextHash(SCHEMA_PATH) },
    gold: {
      packet: { path: GOLD_PACKET_PATH, sha256: nextHash(GOLD_PACKET_PATH) },
      key: {
        path: GOLD_KEY_PATH,
        sha256: nextHash(GOLD_KEY_PATH),
        sealed: true,
      },
      counts: gold.packet.counts,
      randomizedBatchHash: gold.packet.randomizedBatchHash,
    },
    performance: {
      packet: {
        path: PERFORMANCE_PACKET_PATH,
        sha256: nextHash(PERFORMANCE_PACKET_PATH),
      },
      key: {
        path: PERFORMANCE_KEY_PATH,
        sha256: nextHash(PERFORMANCE_KEY_PATH),
        sealed: true,
        parsedForResult: false,
      },
      counts: performance.packet.counts,
      randomizedBatchHash: performance.packet.randomizedBatchHash,
      sourceByteContinuity: {
        exactIndependentReferences: 128,
        exactLegacyCandidates: 128,
        exactRecipeCandidates: 128,
        presentationsPerCell: 2,
      },
    },
    thresholds: reliabilityThresholds(),
    objectiveAbsoluteGate: {
      path: ABSOLUTE_GATE_PATH,
      sha256: nextHash(ABSOLUTE_GATE_PATH),
      status: absoluteGate.status,
      passed: false,
    },
    raterPrompts: prompts(nextHash(PERFORMANCE_PACKET_PATH)),
    preservation: {
      historicalRootsModified: false,
      snapshots: before,
    },
    claims: {
      canProveAfterReliableGrades:
        "relative fidelity preference between unchanged recipe and legacy candidates over all 128 exact cells",
      cannotProve:
        "absolute recognisability, Input success, live canvas usability, generality beyond this denominator, or permission to begin live work",
    },
  };
  await writeFormattedJson(`${NEXT_ROOT}/receipt.json`, receipt);
  await writeFormattedJson(`${NEXT_ROOT}/index.json`, {
    version: VERSION,
    overallInputSuccess: false,
    graded: false,
    reliabilityEvaluated: false,
    performanceKeyUnsealed: false,
    relativeResult: null,
    objectiveAbsoluteGate: "blocked-existing-evidence-incomplete",
    liveWorkAuthorized: false,
    protocol: PROTOCOL_PATH,
    protocolHash: nextHash(PROTOCOL_PATH),
    receipt: RECEIPT_PATH,
    receiptHash: nextHash(RECEIPT_PATH),
    goldPacket: GOLD_PACKET_PATH,
    goldPacketHash: nextHash(GOLD_PACKET_PATH),
    performancePacket: PERFORMANCE_PACKET_PATH,
    performancePacketHash: nextHash(PERFORMANCE_PACKET_PATH),
  });
  check(
    JSON.stringify(historicalSnapshots()) === JSON.stringify(before),
    "building changed a historical grading artifact",
  );
  rmSync(absolute(ROOT), { recursive: true, force: true });
  renameSync(absolute(NEXT_ROOT), absolute(ROOT));
  validateCommittedPairedComparisonInstrument();
  check(
    JSON.stringify(historicalSnapshots()) === JSON.stringify(before),
    "publishing changed a historical grading artifact",
  );
  void treePath;
}

export function validateCommittedPairedComparisonInstrument(): void {
  const protocol = parse<any>(PROTOCOL_PATH);
  const receipt = parse<any>(RECEIPT_PATH);
  const index = parse<any>(INDEX_PATH);
  const goldPacket = parse<PairedPacket>(GOLD_PACKET_PATH);
  const goldKey = parse<GoldKey>(GOLD_KEY_PATH);
  const performancePacket = parse<PairedPacket>(PERFORMANCE_PACKET_PATH);
  check(
    JSON.stringify(protocol) ===
      JSON.stringify(makeProtocol(protocol.preservation)) &&
      protocol.commitment ===
        sha256(JSON.stringify(protocolBody(protocol.preservation))),
    "protocol or commitment differs",
  );
  check(
    JSON.stringify(historicalSnapshots()) ===
      JSON.stringify(protocol.preservation),
    "historical packets, keys, grades, or adjudications changed",
  );
  validatePacket(goldPacket, "gold", 48);
  validatePacket(performancePacket, "performance", 256);
  const performancePairs = discoverSideSwaps(performancePacket, 128);
  const goldKeyGroups = new Map<string, GoldKeyRow[]>();
  for (const answer of goldKey.answers) {
    const rows = goldKeyGroups.get(answer.primaryPairId) ?? [];
    rows.push(answer);
    goldKeyGroups.set(answer.primaryPairId, rows);
  }
  const goldPacketByTask = new Map(
    goldPacket.tasks.map((task) => [task.taskId, task]),
  );
  const goldPacketRoot = `${ROOT}/gold/blind-packet`;
  for (const rows of goldKeyGroups.values()) {
    check(
      rows.length === 2 &&
        rows.some((row) => row.presentation === "primary") &&
        rows.some((row) => row.presentation === "side-swapped"),
      "gold hidden pair does not contain primary and side-swapped rows",
    );
    const first = goldPacketByTask.get(rows[0]!.taskId)!;
    const second = goldPacketByTask.get(rows[1]!.taskId)!;
    check(
      imageHash(goldPacketRoot, first.left.image) ===
        imageHash(goldPacketRoot, second.right.image) &&
        imageHash(goldPacketRoot, first.right.image) ===
          imageHash(goldPacketRoot, second.left.image),
      "gold hidden pair is not side-swapped",
    );
  }
  check(
    goldKey.version === "paired-comparison-gold-key-v1" &&
      goldKey.lockedBeforeRaterAccess &&
      goldKey.separateFromTargetPerformance &&
      goldKey.answers.length === 48 &&
      goldKeyGroups.size === 24 &&
      performancePairs.length === 128 &&
      fileHash(PROTOCOL_PATH) === receipt.protocol.sha256 &&
      fileHash(SCHEMA_PATH) === receipt.gradeSchema.sha256 &&
      fileHash(GOLD_PACKET_PATH) === receipt.gold.packet.sha256 &&
      fileHash(GOLD_KEY_PATH) === receipt.gold.key.sha256 &&
      receipt.gold.key.sealed === true &&
      fileHash(PERFORMANCE_PACKET_PATH) === receipt.performance.packet.sha256 &&
      fileHash(PERFORMANCE_KEY_PATH) === receipt.performance.key.sha256 &&
      receipt.performance.key.sealed === true &&
      receipt.performance.key.parsedForResult === false &&
      fileHash(ABSOLUTE_GATE_PATH) === receipt.objectiveAbsoluteGate.sha256 &&
      index.performanceKeyUnsealed === false &&
      index.relativeResult === null &&
      index.overallInputSuccess === false &&
      index.liveWorkAuthorized === false,
    "receipt, seal, packet, absolute gate, or index differs",
  );
  const source = parse<SourceReceipt>(`${SOURCE_ROOT}/receipt.json`);
  const packetRoot = `${ROOT}/performance/blind-packet`;
  const referenceHashes = performancePacket.tasks.map((task) =>
    imageHash(packetRoot, task.reference.image),
  );
  const candidateHashes = performancePacket.tasks.flatMap((task) => [
    imageHash(packetRoot, task.left.image),
    imageHash(packetRoot, task.right.image),
  ]);
  const count = (values: string[]): string =>
    JSON.stringify(
      [...new Set(values)]
        .sort()
        .map((value) => [
          value,
          values.filter((candidate) => candidate === value).length,
        ]),
    );
  check(
    count(referenceHashes) ===
      count(
        source.references.flatMap((artifact) => [artifact.hash, artifact.hash]),
      ) &&
      count(candidateHashes) ===
        count(
          [...source.outputs.legacy, ...source.outputs.recipeReact].flatMap(
            (artifact) => [artifact.hash, artifact.hash],
          ),
        ),
    "performance packet does not preserve exact source candidate byte multisets",
  );
  for (const rater of RATERS) {
    for (const [phase, packet, packetPath] of [
      ["gold", goldPacket, GOLD_PACKET_PATH],
      ["performance", performancePacket, PERFORMANCE_PACKET_PATH],
    ] as const) {
      const template = parse<GradeEnvelope>(templatePath(phase, rater));
      check(
        template.phase === phase &&
          template.raterId === rater &&
          template.packetHash === fileHash(packetPath) &&
          template.counts.expected === packet.tasks.length &&
          template.counts.submitted === null &&
          template.grades.length === packet.tasks.length,
        `${phase} ${rater} template binding differs`,
      );
    }
    const raterPrompt = receipt.raterPrompts[rater];
    check(
      raterPrompt.outputPaths.gold === outputPath("gold", rater) &&
        raterPrompt.outputPaths.performance ===
          outputPath("performance", rater) &&
        raterPrompt.performancePacketHash ===
          fileHash(PERFORMANCE_PACKET_PATH) &&
        !raterPrompt.gold.includes(GOLD_KEY_PATH) &&
        raterPrompt.performance.includes(PERFORMANCE_KEY_PATH),
      `${rater} prompt or output path differs`,
    );
  }
}

const runPreflight = (file: string): void => {
  check(file.length > 0 && existsSync(absolute(file)), "grade file is absent");
  const envelope = parse<GradeEnvelope>(file);
  const packetPath =
    envelope.phase === "gold" ? GOLD_PACKET_PATH : PERFORMANCE_PACKET_PATH;
  const packet = parse<PairedPacket>(packetPath);
  validateGradeEnvelope(envelope, packet, fileHash(packetPath));
  console.log(
    `PASS ${envelope.phase} preflight: ${envelope.raterId} ${envelope.grades.length}/${packet.tasks.length} ordered rows; no answer key read`,
  );
};

const replacementProtocol = (failedRaters: readonly Rater[]) => ({
  required: failedRaters.length > 0,
  preserveOriginalSubmissionsAndReceipts: true,
  round: 1,
  replaceOnlyFailedSlots: failedRaters,
  replacementRaterIds: failedRaters.map((rater) => `${rater}-R1`),
  requirements: [
    "Recruit fresh independent raters with no access to prior submissions, receipts, GOLD keys, or performance artifacts.",
    "Create a qualification-only replacement packet with fresh opaque task, reference, candidate, pair, and randomized-order bindings; lock its sealed GOLD key before rater access.",
    "Use the unchanged rubric, 48-row denominator, >=95% GOLD threshold, every clear winner correct requirement, exact envelope validation, and no waivers.",
    "Write replacement templates, submissions, and receipts under gold/replacements/round-1 without overwriting any original artifact.",
    "Commission performance only after the retained qualifiers plus all replacement slots form a three-rater passing cohort with hash-bound performance templates.",
  ],
  root: `${ROOT}/gold/replacements/round-1`,
});

const validateGoldTemplate = (
  template: GradeEnvelope,
  packet: PairedPacket,
  rater: Rater,
  packetHash: string,
): void => {
  check(
    template.version === GRADE_VERSION &&
      template.phase === "gold" &&
      template.raterId === rater &&
      template.packetHash === packetHash &&
      template.randomizedBatchHash === packet.randomizedBatchHash &&
      template.protocolCommitment === packet.protocolCommitment &&
      template.rubricVersion === RUBRIC_VERSION &&
      template.calibrationReceipt === null &&
      template.counts.expected === 48 &&
      template.counts.submitted === null &&
      template.grades.length === 48,
    `${rater} GOLD template envelope differs`,
  );
  for (const [index, row] of template.grades.entries()) {
    const task = packet.tasks[index]!;
    check(
      row.taskId === task.taskId &&
        row.referenceId === task.reference.referenceId &&
        row.leftCandidateId === task.left.candidateId &&
        row.rightCandidateId === task.right.candidateId &&
        row.choice === null &&
        row.confidence === null &&
        row.rationale.decisiveDifferences.length === 0 &&
        row.rationale.leftDefects.length === 0 &&
        row.rationale.rightDefects.length === 0 &&
        row.rationale.tieBasis === null,
      `${rater} GOLD template row ${index} differs`,
    );
  }
};

const qualificationInputs = () => {
  const protocol = parse<any>(PROTOCOL_PATH);
  const instrument = parse<any>(RECEIPT_PATH);
  const packet = parse<PairedPacket>(GOLD_PACKET_PATH);
  const key = parse<GoldKey>(GOLD_KEY_PATH);
  const packetHash = fileHash(GOLD_PACKET_PATH);
  check(
    protocol.commitment ===
      sha256(JSON.stringify(protocolBody(protocol.preservation))) &&
      fileHash(PROTOCOL_PATH) === instrument.protocol.sha256 &&
      fileHash(SCHEMA_PATH) === instrument.gradeSchema.sha256 &&
      packetHash === instrument.gold.packet.sha256 &&
      fileHash(GOLD_KEY_PATH) === instrument.gold.key.sha256 &&
      instrument.gold.key.sealed === true &&
      instrument.performance.key.sealed === true &&
      instrument.performance.key.parsedForResult === false,
    "qualification protocol, receipt, schema, packet, key, or seal hash differs",
  );
  validateGoldQualificationBindings(packet, key);
  const envelopes = {} as Record<Rater, GradeEnvelope>;
  for (const rater of RATERS) {
    validateGoldTemplate(
      parse<GradeEnvelope>(templatePath("gold", rater)),
      packet,
      rater,
      packetHash,
    );
    const submission = outputPath("gold", rater);
    const envelope = parse<GradeEnvelope>(submission);
    validateGradeEnvelope(envelope, packet, packetHash, rater);
    check(
      !IDENTITY_LEAK.test(JSON.stringify(envelope)),
      `${rater} GOLD submission leaks identity`,
    );
    envelopes[rater] = envelope;
  }
  return { instrument, packet, key, packetHash, envelopes };
};

export async function adjudicateQualification(): Promise<
  Record<Rater, QualificationReceipt>
> {
  const { instrument, packet, key, packetHash, envelopes } =
    qualificationInputs();
  const provisional = Object.fromEntries(
    RATERS.map((rater) => [
      rater,
      scoreGoldEnvelope(
        envelopes[rater],
        packet,
        key,
        packetHash,
        fileHash(outputPath("gold", rater)),
      ),
    ]),
  ) as Record<Rater, QualificationReceipt>;
  const qualifiedRaters = RATERS.filter((rater) => provisional[rater].passed);
  const failedRaters = RATERS.filter((rater) => !provisional[rater].passed);
  const cohortGatePassed = qualifiedRaters.length === RATERS.length;
  const updatedInstrument = {
    ...instrument,
    status: cohortGatePassed
      ? "qualification-passed-performance-commissioned-key-sealed"
      : "qualification-incomplete-performance-not-commissioned-key-sealed",
    qualification: {
      evaluated: true,
      validEnvelopes: RATERS.length,
      requiredQualifiers: RATERS.length,
      qualifiedRaters,
      failedRaters,
      allPassed: cohortGatePassed,
      performanceCommissioned: cohortGatePassed,
      performancePromptsIssued: cohortGatePassed,
      performanceGraded: false,
      performanceKeyUnsealed: false,
      receipts: Object.fromEntries(
        RATERS.map((rater) => [rater, qualificationReceiptPath(rater)]),
      ),
      replacementProtocol: cohortGatePassed
        ? null
        : replacementProtocol(failedRaters),
    },
  };
  await writeFormattedJson(RECEIPT_PATH, updatedInstrument);
  const receipts = Object.fromEntries(
    RATERS.map((rater) => [
      rater,
      scoreGoldEnvelope(
        envelopes[rater],
        packet,
        key,
        packetHash,
        fileHash(outputPath("gold", rater)),
        cohortGatePassed,
      ),
    ]),
  ) as Record<Rater, QualificationReceipt>;
  for (const rater of RATERS)
    await writeFormattedJson(qualificationReceiptPath(rater), receipts[rater]);
  const index = parse<any>(INDEX_PATH);
  await writeFormattedJson(INDEX_PATH, {
    ...index,
    graded: false,
    qualificationEvaluated: true,
    qualifiedRaters,
    qualificationPassed: cohortGatePassed,
    performanceCommissioned: cohortGatePassed,
    performancePromptsIssued: cohortGatePassed,
    replacementRequired: !cohortGatePassed,
    reliabilityEvaluated: false,
    performanceKeyUnsealed: false,
    relativeResult: null,
    receiptHash: fileHash(RECEIPT_PATH),
  });
  validateQualificationAdjudication();
  return receipts;
}

export function validateQualificationAdjudication(
  receiptOverrides: Partial<Record<Rater, QualificationReceipt>> = {},
): void {
  const { instrument, packet, key, packetHash, envelopes } =
    qualificationInputs();
  const index = parse<any>(INDEX_PATH);
  const receipts = Object.fromEntries(
    RATERS.map((rater) => [
      rater,
      receiptOverrides[rater] ??
        parse<QualificationReceipt>(qualificationReceiptPath(rater)),
    ]),
  ) as Record<Rater, QualificationReceipt>;
  const qualifiedRaters = RATERS.filter((rater) => receipts[rater].passed);
  const failedRaters = RATERS.filter((rater) => !receipts[rater].passed);
  const cohortGatePassed = qualifiedRaters.length === RATERS.length;
  for (const rater of RATERS) {
    const expected = scoreGoldEnvelope(
      envelopes[rater],
      packet,
      key,
      packetHash,
      fileHash(outputPath("gold", rater)),
      cohortGatePassed,
    );
    check(
      JSON.stringify(receipts[rater]) === JSON.stringify(expected),
      `${rater} qualification receipt is stale or tampered`,
    );
  }
  check(
    instrument.qualification.evaluated === true &&
      instrument.qualification.validEnvelopes === 3 &&
      instrument.qualification.requiredQualifiers === 3 &&
      JSON.stringify(instrument.qualification.qualifiedRaters) ===
        JSON.stringify(qualifiedRaters) &&
      JSON.stringify(instrument.qualification.failedRaters) ===
        JSON.stringify(failedRaters) &&
      instrument.qualification.allPassed === cohortGatePassed &&
      instrument.qualification.performanceCommissioned === cohortGatePassed &&
      instrument.qualification.performancePromptsIssued === cohortGatePassed &&
      instrument.qualification.performanceGraded === false &&
      instrument.qualification.performanceKeyUnsealed === false &&
      instrument.performance.key.sealed === true &&
      instrument.performance.key.parsedForResult === false &&
      index.graded === false &&
      index.qualificationEvaluated === true &&
      JSON.stringify(index.qualifiedRaters) ===
        JSON.stringify(qualifiedRaters) &&
      index.qualificationPassed === cohortGatePassed &&
      index.performanceCommissioned === cohortGatePassed &&
      index.performancePromptsIssued === cohortGatePassed &&
      index.replacementRequired === !cohortGatePassed &&
      index.reliabilityEvaluated === false &&
      index.performanceKeyUnsealed === false &&
      index.relativeResult === null &&
      index.receiptHash === fileHash(RECEIPT_PATH) &&
      (cohortGatePassed
        ? instrument.qualification.replacementProtocol === null
        : JSON.stringify(instrument.qualification.replacementProtocol) ===
          JSON.stringify(replacementProtocol(failedRaters))),
    "qualification status, replacement, performance seal, or index gate differs",
  );
}

const runGoldScore = async (file: string): Promise<void> => {
  check(
    file.length > 0 && existsSync(absolute(file)),
    "gold grade file is absent",
  );
  const packet = parse<PairedPacket>(GOLD_PACKET_PATH);
  const envelope = parse<GradeEnvelope>(file);
  check(envelope.phase === "gold", "only a gold envelope can qualify a rater");
  const receipt = scoreGoldEnvelope(
    envelope,
    packet,
    parse<GoldKey>(GOLD_KEY_PATH),
    fileHash(GOLD_PACKET_PATH),
    fileHash(file),
  );
  const target = qualificationReceiptPath(envelope.raterId);
  await writeFormattedJson(target, receipt);
  console.log(
    `${envelope.raterId}: ${receipt.passed ? "QUALIFIED" : "NOT QUALIFIED"}; ${receipt.correct}/48; clear winners ${receipt.clearWinnersCorrect}/24; wrote ${target}`,
  );
};

const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  if (process.argv.includes("--build")) {
    await buildPairedComparisonInstrument();
    console.log(
      `BUILT paired comparison GOLD=${fileHash(GOLD_PACKET_PATH)} performance=${fileHash(PERFORMANCE_PACKET_PATH)}; ungraded and sealed`,
    );
  } else if (process.argv.includes("--preflight")) {
    runPreflight(process.argv[process.argv.indexOf("--preflight") + 1] ?? "");
  } else if (process.argv.includes("--score-gold")) {
    await runGoldScore(
      process.argv[process.argv.indexOf("--score-gold") + 1] ?? "",
    );
  } else if (process.argv.includes("--adjudicate-qualification")) {
    const receipts = await adjudicateQualification();
    for (const rater of RATERS) {
      const receipt = receipts[rater];
      console.log(
        `${rater}: ${receipt.passed ? "QUALIFIED" : "NOT QUALIFIED"}; ${receipt.correct}/48; clear winners ${receipt.clearWinnersCorrect}/24; ties ${receipt.scoreBreakdown?.trueTie.correct}/12; materiality ${receipt.scoreBreakdown?.materialityBoundary.correct}/12; side-swap accuracy ${receipt.sideSwapCalibration?.accuracy.correct}/24`,
      );
    }
  } else if (process.argv.includes("--verify-qualification")) {
    validateQualificationAdjudication();
    console.log(
      "Qualification adjudication valid: 3/3 envelopes scored; performance remains uncommissioned, ungraded, and sealed",
    );
  } else {
    validateCommittedPairedComparisonInstrument();
    console.log(
      `Paired comparison valid: GOLD 48, performance 256, key sealed=${parse<any>(INDEX_PATH).performanceKeyUnsealed === false}`,
    );
  }
}
