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
const V1_ROOT = "recipe/evidence/input-field-comparison";
const V2_ROOT = "recipe/evidence/input-field-comparison-v2";
const FAILED_ROOT = "recipe/evidence/input-field-comparison-calibrated";
export const ROOT = "recipe/evidence/input-field-comparison-calibration-v2";
const NEXT_ROOT = "recipe/evidence/.input-field-comparison-calibration-v2-next";
export const PROTOCOL_PATH = `${ROOT}/protocol.json`;
export const GRADE_SCHEMA_PATH = `${ROOT}/grade.schema.json`;
export const RECEIPT_PATH = `${ROOT}/receipt.json`;
export const INDEX_PATH = `${ROOT}/index.json`;
export const GOLD_PACKET_PATH = `${ROOT}/gold/blind-packet/packet.json`;
export const GOLD_KEY_PATH = `${ROOT}/gold/sealed-answer-key.json`;
export const PERFORMANCE_PACKET_PATH = `${ROOT}/performance/blind-packet/packet.json`;
export const PERFORMANCE_KEY_PATH = `${ROOT}/performance/sealed-answer-key.json`;

const VERSION = "input-field-recognisability-calibration-v2";
const GOLD_PROTOCOL = "recognisability-gold-calibration-v1";
const PERFORMANCE_PROTOCOL = "input-field-performance-blind-v3";
const SCHEMA_VERSION = "recognisability-grade-envelope-v2";
const RUBRIC_VERSION = "input-field-observable-rubric-v2";
const RATERS = ["RATER-CAL-V2-A", "RATER-CAL-V2-B", "RATER-CAL-V2-C"] as const;
const RATER_SLUGS = [
  "rater-cal-v2-a",
  "rater-cal-v2-b",
  "rater-cal-v2-c",
] as const;
const CATEGORIES = [
  "required-structure-content",
  "semantic-state",
  "geometry-proportion",
  "typography-raster",
  "color-border-effects",
] as const;
const IDENTITY_LEAK =
  /\blegacy\b|\brecipe\b|\bcorrected\b|\bduplicate\b|\bcopy[- _]?[ab]\b|\bimplementation\b|\bexpected[- _]?winner\b|\bmui\b|\bpolaris\b|@shopify|@mui/i;

type Rater = (typeof RATERS)[number];
type Category = (typeof CATEGORIES)[number];
type Phase = "gold-calibration" | "performance";
type Confidence = "low" | "medium" | "high";
type Verdict = "match" | "minor" | "fail";
type ImplementationPath = "corrected-v2" | "legacy-copy-a" | "legacy-copy-b";
type Rgba = readonly [number, number, number, number];

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

interface FailedCalibrationReceipt {
  continuity: {
    cells: Array<{
      cellKey: string;
      referenceHash: string;
      legacyHash: string;
      correctedV2Hash: string;
    }>;
  };
}

interface Rubric {
  version: typeof RUBRIC_VERSION;
  decisionOrder: Array<{
    category: Category;
    requiredObservations: string[];
    failWhen: string;
  }>;
  quantitativeGuardrails: {
    geometry: {
      overallWidthOrHeightRelativeTolerance: number;
      overallWidthOrHeightAbsoluteTolerancePx: number;
      localSpacingAbsoluteTolerancePx: number;
      localSpacingRelativeTolerance: number;
      materialScaleDelta: number;
      severeRequiredPartClippingArea: number;
      requiredPartOverlapTolerancePx: number;
    };
    rasterAndTypography: {
      permittedGlyphEdgeShiftPx: number;
      wrappingOrLineCountChange: "fail";
      hierarchyOrSemanticEmphasisChange: "fail";
    };
    color: {
      minorPerChannelSrgbDeltaMaximum: number;
      minorEuclideanSrgbDeltaMaximum: number;
      semanticStateCueChange: "fail-regardless-of-delta";
    };
  };
  precedence: string[];
  passRule: string;
  rationale: string;
}

interface ProtocolBody {
  version: typeof VERSION;
  lockedBeforeAnyFreshGrade: true;
  purpose: string;
  failedRoundDiagnosis: {
    immutableEvidenceRoot: typeof FAILED_ROOT;
    validGradeEnvelopes: "0/3";
    fleissKappa: 0.4725274725274726;
    hiddenDuplicateConsistency: "128/128 per rater and 128/128 majority";
    protocolDefectsOnly: string[];
    excludedInferences: string[];
  };
  phases: {
    goldCalibration: {
      protocol: typeof GOLD_PROTOCOL;
      separateFromPerformanceSpecimens: true;
      opaqueUntilSubmission: true;
      expectedCases: 24;
      exactOrSemanticPasses: 8;
      controlledMinorPasses: 4;
      obviousStructuralOrStateFailures: 12;
      minimumScore: 0.95;
      obviousFailureScoreRequired: 1;
      failureConsequence: string;
      feedbackBoundary: string;
    };
    performance: {
      protocol: typeof PERFORMANCE_PROTOCOL;
      requiresPassingCalibrationReceipt: true;
      sourceReferences: 128;
      correctedV2Specimens: 128;
      hiddenLegacyCopyA: 128;
      hiddenLegacyCopyB: 128;
      specimens: 384;
      neverRevealPerformanceIdentitiesToRaters: true;
      remainsSealedAndUngraded: true;
    };
  };
  gradeEnvelope: {
    schemaVersion: typeof SCHEMA_VERSION;
    schemaPath: typeof GRADE_SCHEMA_PATH;
    requiredTopLevelFields: string[];
    exactOrderedGradesRequired: true;
    preflightReadsAnswerKeys: false;
  };
  rubric: Rubric;
  reliability: {
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
  };
}

interface Protocol extends ProtocolBody {
  commitment: string;
  rubricHash: string;
}

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
  rubric: Rubric;
  instructions: string[];
  gradeSchema: string;
  preflight: string;
  assignedTemplates: Record<Rater, string>;
  counts: {
    tasks: number;
    referencePresentations: number;
    specimenPresentations: number;
  };
  randomizedBatchHash: string;
  tasks: PacketTask[];
}

interface CriterionGrade {
  verdict: Verdict;
  defects: string[];
}

export interface OrderedGrade {
  taskId: string;
  referenceId: string;
  specimenId: string;
  recognisable: boolean;
  confidence: Confidence;
  criteria: Record<Category, CriterionGrade>;
  defects: string[];
}

export interface GradeEnvelope {
  phase: Phase;
  schemaVersion: typeof SCHEMA_VERSION;
  graderId: string;
  packetProtocol: string;
  packetHash: string;
  randomizedBatchHash: string;
  calibrationCommitment: string;
  rubricVersion: typeof RUBRIC_VERSION;
  counts: { expected: number; submitted: number };
  calibrationReceipt?: {
    path: string;
    sha256: string;
    score: number;
    obviousStructuralStateFailureScore: number;
    passed: true;
  };
  orderedGrades: OrderedGrade[];
}

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

interface PerformanceAnswer {
  taskId: string;
  referenceId: string;
  specimenId: string;
  implementationPath: ImplementationPath;
  cellKey: string;
  referenceHash: string;
  specimenHash: string;
}

export interface CalibrationReceipt {
  version: "rater-calibration-receipt-v1";
  graderId: string;
  calibrationCommitment: string;
  packetHash: string;
  randomizedBatchHash: string;
  gradeHash: string;
  score: number;
  correct: number;
  denominator: 24;
  obviousStructuralStateFailuresCorrect: number;
  obviousStructuralStateFailuresDenominator: 12;
  obviousStructuralStateFailureScore: number;
  envelopeValid: true;
  passed: boolean;
  performanceEligibility: boolean;
  feedback: Array<{
    taskId: string;
    submittedRecognisable: boolean;
    expectedRecognisable: boolean;
    rationale: string;
  }>;
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
  if (!condition) throw new Error(`CALIBRATION V2 REFUSED: ${message}`);
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

export function assertArtifactHash(
  bytes: Buffer,
  expectedHash: string,
  label: string,
): void {
  check(sha256(bytes) === expectedHash, `${label} bytes or hash differ`);
}
const byCell = (artifacts: Artifact[]): Map<string, Artifact> =>
  new Map(artifacts.map((artifact) => [artifact.cellKey, artifact]));

const rubric = (): Rubric => ({
  version: RUBRIC_VERSION,
  decisionOrder: [
    {
      category: "required-structure-content",
      requiredObservations: [
        "The input surface, label, visible value or placeholder, required marker when shown, helper or error message, and expected leading/trailing adornments occupy the same semantic roles as the reference.",
        "Missing, substituted, extra, role-swapped, or unreadable required parts fail.",
      ],
      failWhen:
        "Any role-defining part or supplied visible content is missing, substituted, extra, or no longer recognisable.",
    },
    {
      category: "semantic-state",
      requiredObservations: [
        "Default, focus, error, and disabled cues are compared as semantic states, not merely as colors.",
        "The specimen may not omit, add, or substitute the reference state.",
      ],
      failWhen:
        "Any wrong or missing semantic state cue fails regardless of raster or color distance.",
    },
    {
      category: "geometry-proportion",
      requiredObservations: [
        "Compare overall silhouette, field surface dimensions, padding, alignment, gaps, adornment scale, label/message position, clipping, and overlap.",
        "Use the locked quantitative guardrails when coordinates can be read; obvious clipping or overlap remains a failure without measurement tooling.",
      ],
      failWhen:
        "A dimension, spacing, scale, clipping, or overlap guardrail is exceeded and materially changes the visible component.",
    },
    {
      category: "typography-raster",
      requiredObservations: [
        "Compare visible hierarchy, line count, wrapping, baseline, weight class, size class, and emphasis.",
        "Antialiasing, subpixel rasterization, and glyph-edge shifts within the locked allowance are minor.",
      ],
      failWhen:
        "Typography changes hierarchy, semantic emphasis, wrapping, line count, alignment, or exceeds the minor raster allowance.",
    },
    {
      category: "color-border-effects",
      requiredObservations: [
        "Compare fill, ink, border width/style, focus effect, error treatment, and disabled opacity.",
        "Small color deltas may be minor only when structure, hierarchy, contrast role, and semantic state stay recognisable.",
      ],
      failWhen:
        "A treatment changes semantic state, contrast role, border/effect class, or exceeds minor tolerance in a visibly material way.",
    },
  ],
  quantitativeGuardrails: {
    geometry: {
      overallWidthOrHeightRelativeTolerance: 0.08,
      overallWidthOrHeightAbsoluteTolerancePx: 4,
      localSpacingAbsoluteTolerancePx: 4,
      localSpacingRelativeTolerance: 0.2,
      materialScaleDelta: 0.1,
      severeRequiredPartClippingArea: 0.05,
      requiredPartOverlapTolerancePx: 2,
    },
    rasterAndTypography: {
      permittedGlyphEdgeShiftPx: 1,
      wrappingOrLineCountChange: "fail",
      hierarchyOrSemanticEmphasisChange: "fail",
    },
    color: {
      minorPerChannelSrgbDeltaMaximum: 12,
      minorEuclideanSrgbDeltaMaximum: 20,
      semanticStateCueChange: "fail-regardless-of-delta",
    },
  },
  precedence: [
    "Required structure/content and semantic state rules override all numeric minor tolerances.",
    "For overall width/height, a deviation is material only when it exceeds both 4 px and 8% of the reference dimension.",
    "For local spacing, a deviation is material when it exceeds both 4 px and 20% of the reference spacing.",
    "Any required-part clipping above 5% of that part's visible area, or required-part overlap above 2 px, fails.",
    "A scale change above 10% for a role-defining part fails.",
    "A color delta within both stated sRGB limits is minor only when state, structure, hierarchy, and contrast role are unchanged.",
  ],
  passRule:
    "recognisable=true only when required structure/content and semantic state match, no geometry/proportion failure exists, and all typography/raster and color/border/effect differences are match or minor. Every fail verdict requires a concrete observable defect; top-level defects are the ordered concatenation of criterion defects.",
  rationale:
    "The first round showed perfect exact-duplicate consistency but insufficient common-standard agreement under high failure prevalence. These limits turn role/state failures into categorical decisions while allowing known non-semantic raster variation.",
});

const protocolBody = (): ProtocolBody => ({
  version: VERSION,
  lockedBeforeAnyFreshGrade: true,
  purpose:
    "Qualify fresh raters on an independent objective gold set before any separately sealed Input/Field performance grading; this artifact neither grades nor unseals performance.",
  failedRoundDiagnosis: {
    immutableEvidenceRoot: FAILED_ROOT,
    validGradeEnvelopes: "0/3",
    fleissKappa: 0.4725274725274726,
    hiddenDuplicateConsistency: "128/128 per rater and 128/128 majority",
    protocolDefectsOnly: [
      "The blind packet described a strict envelope but did not provide a serialized fillable output template or rater-runnable preflight; all three submissions omitted or renamed required envelope fields and used a different criterion shape.",
      "The observable rubric lacked enough quantitative anchors to force a common pass/fail standard; under high failure prevalence, raters were individually repeatable on exact duplicates while diverging on which specimens crossed the subjective materiality boundary.",
    ],
    excludedInferences: [
      "No prior grade outcome is reused, repaired, transformed, or treated as performance evidence.",
      "No performance identity, winner, consensus, axis aggregate, or implementation-labelled result is opened.",
      "Thresholds are locked from the protocol defect analysis and objective gold construction, not tuned to a performance result.",
    ],
  },
  phases: {
    goldCalibration: {
      protocol: GOLD_PROTOCOL,
      separateFromPerformanceSpecimens: true,
      opaqueUntilSubmission: true,
      expectedCases: 24,
      exactOrSemanticPasses: 8,
      controlledMinorPasses: 4,
      obviousStructuralOrStateFailures: 12,
      minimumScore: 0.95,
      obviousFailureScoreRequired: 1,
      failureConsequence:
        "A rater below 95%, below 100% on obvious structural/state failures, or without a valid envelope is invalid and may not grade the performance packet.",
      feedbackBoundary:
        "Gold identities, expected outcomes, and rationales may be revealed only after that rater submits a valid gold envelope, solely as calibration feedback and before a separate performance phase.",
    },
    performance: {
      protocol: PERFORMANCE_PROTOCOL,
      requiresPassingCalibrationReceipt: true,
      sourceReferences: 128,
      correctedV2Specimens: 128,
      hiddenLegacyCopyA: 128,
      hiddenLegacyCopyB: 128,
      specimens: 384,
      neverRevealPerformanceIdentitiesToRaters: true,
      remainsSealedAndUngraded: true,
    },
  },
  gradeEnvelope: {
    schemaVersion: SCHEMA_VERSION,
    schemaPath: GRADE_SCHEMA_PATH,
    requiredTopLevelFields: [
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
    ],
    exactOrderedGradesRequired: true,
    preflightReadsAnswerKeys: false,
  },
  rubric: rubric(),
  reliability: {
    calibratedValidRatersRequired: 3,
    calibrationScoreMinimum: 0.95,
    obviousFailureScoreRequired: 1,
    validEnvelopeRequired: true,
    hiddenDuplicateAgreementPerRaterMinimum: 0.95,
    majorityDuplicateAgreementMinimum: 127,
    majorityDuplicateAgreementDenominator: 128,
    everyPairwiseAgreementMinimum: 0.75,
    fleissKappaMinimum: 0.6,
    maximumDuplicateCopyPassRateDelta: 0.05,
    majorityFailureConcreteDefectRatersMinimum: 2,
    failureConsequence:
      "Any failed prerequisite or reliability threshold keeps recognisability unusable, performance sealed, architecture progression blocked, and live Input blocked.",
  },
});

const makeProtocol = (): Protocol => {
  const body = protocolBody();
  return {
    ...body,
    commitment: sha256(JSON.stringify(body)),
    rubricHash: sha256(JSON.stringify(body.rubric)),
  };
};

const criterionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["verdict", "defects"],
  properties: {
    verdict: { enum: ["match", "minor", "fail"] },
    defects: { type: "array", items: { type: "string", minLength: 20 } },
  },
};

const phaseSchemaBranch = (): Record<string, unknown> =>
  JSON.parse(
    '{"if":{"properties":{"phase":{"const":"performance"}}},"then":{"required":["calibrationReceipt"]},"else":{"not":{"required":["calibrationReceipt"]}}}',
  ) as Record<string, unknown>;

const gradeSchema = () => ({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://ds-contracts.local/schema/recognisability-grade-envelope-v2.json",
  title: "Recognisability grade envelope v2",
  type: "object",
  additionalProperties: false,
  required: [
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
  ],
  properties: {
    phase: { enum: ["gold-calibration", "performance"] },
    schemaVersion: { const: SCHEMA_VERSION },
    graderId: { type: "string", pattern: "^RATER-CAL-V2-[ABC]$" },
    packetProtocol: { enum: [GOLD_PROTOCOL, PERFORMANCE_PROTOCOL] },
    packetHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
    randomizedBatchHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
    calibrationCommitment: { type: "string", pattern: "^[a-f0-9]{64}$" },
    rubricVersion: { const: RUBRIC_VERSION },
    counts: {
      type: "object",
      additionalProperties: false,
      required: ["expected", "submitted"],
      properties: {
        expected: { type: "integer", enum: [24, 384] },
        submitted: { type: "integer", enum: [24, 384] },
      },
    },
    calibrationReceipt: {
      type: "object",
      additionalProperties: false,
      required: [
        "path",
        "sha256",
        "score",
        "obviousStructuralStateFailureScore",
        "passed",
      ],
      properties: {
        path: { type: "string" },
        sha256: { type: "string", pattern: "^[a-f0-9]{64}$" },
        score: { type: "number", minimum: 0.95, maximum: 1 },
        obviousStructuralStateFailureScore: { const: 1 },
        passed: { const: true },
      },
    },
    orderedGrades: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "taskId",
          "referenceId",
          "specimenId",
          "recognisable",
          "confidence",
          "criteria",
          "defects",
        ],
        properties: {
          taskId: { type: "string", pattern: "^task-[a-f0-9]{20}$" },
          referenceId: {
            type: "string",
            pattern: "^reference-[a-f0-9]{20}$",
          },
          specimenId: {
            type: "string",
            pattern: "^specimen-[a-f0-9]{20}$",
          },
          recognisable: { type: "boolean" },
          confidence: { enum: ["low", "medium", "high"] },
          criteria: {
            type: "object",
            additionalProperties: false,
            required: [...CATEGORIES],
            properties: Object.fromEntries(
              CATEGORIES.map((category) => [category, criterionSchema]),
            ),
          },
          defects: {
            type: "array",
            items: { type: "string", minLength: 20 },
          },
        },
      },
    },
  },
  allOf: [phaseSchemaBranch()],
});

const batchHash = (packet: Omit<BlindPacket, "randomizedBatchHash">): string =>
  sha256(
    JSON.stringify({
      version: packet.version,
      phase: packet.phase,
      calibrationCommitment: packet.calibrationCommitment,
      rubricVersion: packet.rubricVersion,
      tasks: packet.tasks,
    }),
  );

const templateGrade = (task: PacketTask): Record<string, unknown> => ({
  taskId: task.taskId,
  referenceId: task.reference.referenceId,
  specimenId: task.specimen.specimenId,
  recognisable: null,
  confidence: null,
  criteria: Object.fromEntries(
    CATEGORIES.map((category) => [category, { verdict: null, defects: [] }]),
  ),
  defects: [],
});

const calibrationReceiptPath = (rater: Rater): string =>
  `${ROOT}/gold/receipts/${RATER_SLUGS[RATERS.indexOf(rater)]}.json`;
const goldOutputPath = (rater: Rater): string =>
  `${ROOT}/gold/submissions/${RATER_SLUGS[RATERS.indexOf(rater)]}.json`;
const performanceOutputPath = (rater: Rater): string =>
  `${ROOT}/performance/submissions/${RATER_SLUGS[RATERS.indexOf(rater)]}.json`;
const templatePath = (phase: Phase, rater: Rater): string =>
  `${ROOT}/${phase === "gold-calibration" ? "gold" : "performance"}/blind-packet/templates/${RATER_SLUGS[RATERS.indexOf(rater)]}.json`;

const makeTemplate = (
  phase: Phase,
  rater: Rater,
  packet: BlindPacket,
  packetHash: string,
): Record<string, unknown> => ({
  phase,
  schemaVersion: SCHEMA_VERSION,
  graderId: rater,
  packetProtocol:
    phase === "gold-calibration" ? GOLD_PROTOCOL : PERFORMANCE_PROTOCOL,
  packetHash,
  randomizedBatchHash: packet.randomizedBatchHash,
  calibrationCommitment: packet.calibrationCommitment,
  rubricVersion: RUBRIC_VERSION,
  counts: { expected: packet.tasks.length, submitted: null },
  ...(phase === "performance"
    ? {
        calibrationReceipt: {
          path: calibrationReceiptPath(rater),
          sha256: null,
          score: null,
          obviousStructuralStateFailureScore: null,
          passed: null,
        },
      }
    : {}),
  orderedGrades: packet.tasks.map(templateGrade),
});

const walkFiles = (root: string): string[] => {
  const output: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(absolute(directory), {
      withFileTypes: true,
    }).sort((left, right) => left.name.localeCompare(right.name))) {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) output.push(file);
      else check(false, `${file} is not a regular historical artifact`);
    }
  };
  visit(root);
  return output;
};

const treeSnapshot = (root: string) => {
  const files = walkFiles(root).map((file) => ({
    file,
    bytes: statSync(absolute(file)).size,
    sha256: fileHash(file),
  }));
  return {
    root,
    files: files.length,
    bytes: files.reduce((sum, file) => sum + file.bytes, 0),
    aggregateSha256: sha256(JSON.stringify(files)),
  };
};

const historicalSnapshots = () =>
  [V1_ROOT, V2_ROOT, FAILED_ROOT].map(treeSnapshot);

const assertSnapshots = (
  expected: ReturnType<typeof historicalSnapshots>,
): void =>
  check(
    JSON.stringify(historicalSnapshots()) === JSON.stringify(expected),
    "a previous Input packet, grade, adjudication, image, or receipt changed",
  );

const FONT: Record<string, readonly string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
};

const pixel = (png: PNG, x: number, y: number, color: Rgba): void => {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const index = (png.width * y + x) << 2;
  [
    png.data[index],
    png.data[index + 1],
    png.data[index + 2],
    png.data[index + 3],
  ] = color;
};

const rect = (
  png: PNG,
  x: number,
  y: number,
  width: number,
  height: number,
  color: Rgba,
): void => {
  for (let yy = y; yy < y + height; yy += 1)
    for (let xx = x; xx < x + width; xx += 1) pixel(png, xx, yy, color);
};

const text = (
  png: PNG,
  value: string,
  x: number,
  y: number,
  color: Rgba,
  scale = 2,
): void => {
  let cursor = x;
  for (const character of value) {
    const glyph = FONT[character] ?? FONT.E!;
    for (const [row, bits] of glyph.entries())
      for (const [column, bit] of [...bits].entries())
        if (bit === "1")
          rect(
            png,
            cursor + column * scale,
            y + row * scale,
            scale,
            scale,
            color,
          );
    cursor += 6 * scale;
  }
};

interface FieldConfig {
  state: "default" | "focus" | "error" | "disabled";
  surface?: boolean;
  label?: boolean;
  helper?: boolean;
  leading?: boolean;
  trailing?: boolean;
  blank?: boolean;
  clipRight?: boolean;
  compact?: boolean;
  overlap?: boolean;
  textShift?: number;
  colorDelta?: number;
}

const renderField = (configuration: FieldConfig): Buffer => {
  const config = {
    surface: true,
    label: true,
    helper: true,
    leading: true,
    trailing: true,
    textShift: 0,
    colorDelta: 0,
    ...configuration,
  };
  const png = new PNG({ width: 320, height: 160 });
  rect(png, 0, 0, 320, 160, [250, 250, 248, 255]);
  if (config.blank) return PNG.sync.write(png, { colorType: 6 });
  const width = config.compact ? 148 : 260;
  const borderBase: Rgba =
    config.state === "error"
      ? [196, 35, 47, 255]
      : config.state === "focus"
        ? [34, 92, 220, 255]
        : config.state === "disabled"
          ? [148, 151, 158, 255]
          : [68, 72, 80, 255];
  const border: Rgba = [
    Math.min(255, borderBase[0] + config.colorDelta),
    Math.min(255, borderBase[1] + config.colorDelta),
    Math.min(255, borderBase[2] + config.colorDelta),
    255,
  ];
  if (config.label)
    text(
      png,
      "LABEL",
      30 + config.textShift,
      20,
      config.state === "disabled" ? [132, 135, 142, 255] : [28, 30, 34, 255],
    );
  if (config.state === "focus" && config.surface) {
    rect(png, 27, 47, width + 6, 58, [164, 191, 255, 255]);
    rect(png, 29, 49, width + 2, 54, [250, 250, 248, 255]);
  }
  if (config.surface) {
    rect(png, 30, 50, width, 52, border);
    rect(
      png,
      32,
      52,
      width - 4,
      48,
      config.state === "disabled" ? [231, 232, 234, 255] : [255, 255, 255, 255],
    );
  }
  if (config.leading) rect(png, 44, 68, 16, 16, border);
  text(
    png,
    "VALUE",
    70 + config.textShift,
    69,
    config.state === "disabled" ? [132, 135, 142, 255] : [38, 41, 47, 255],
  );
  if (config.trailing) {
    rect(png, config.compact ? 148 : 258, 68, 16, 16, border);
    rect(png, config.compact ? 152 : 262, 72, 8, 8, [255, 255, 255, 255]);
  }
  if (config.helper)
    text(
      png,
      config.state === "error" ? "ERROR" : "HELP",
      30 + config.textShift,
      config.overlap ? 78 : 116,
      config.state === "error" ? [196, 35, 47, 255] : [78, 82, 90, 255],
    );
  if (config.clipRight) rect(png, 178, 0, 142, 160, [250, 250, 248, 255]);
  return PNG.sync.write(png, { colorType: 6 });
};

interface GoldCase {
  name: string;
  expected: boolean;
  obvious: boolean;
  class: GoldAnswer["class"];
  rationale: string;
  reference: FieldConfig;
  specimen: FieldConfig;
}

const goldCases = (): GoldCase[] => {
  const exact = (
    name: string,
    state: FieldConfig["state"],
    options: Partial<FieldConfig> = {},
  ): GoldCase => ({
    name,
    expected: true,
    obvious: false,
    class: "exact-pass",
    rationale:
      "Reference and specimen are byte-identical deterministic renderings.",
    reference: { state, ...options },
    specimen: { state, ...options },
  });
  const minor = (
    name: string,
    mutation: Partial<FieldConfig>,
    rationale: string,
  ): GoldCase => ({
    name,
    expected: true,
    obvious: false,
    class: "controlled-minor-pass",
    rationale,
    reference: { state: "default" },
    specimen: { state: "default", ...mutation },
  });
  const fail = (
    name: string,
    specimen: FieldConfig,
    rationale: string,
    reference: FieldConfig = { state: "default" },
  ): GoldCase => ({
    name,
    expected: false,
    obvious: true,
    class: "obvious-fail",
    rationale,
    reference,
    specimen,
  });
  return [
    exact("exact-default", "default"),
    exact("exact-focus", "focus"),
    exact("exact-error", "error"),
    exact("exact-disabled", "disabled"),
    exact("exact-no-leading", "default", { leading: false }),
    exact("exact-no-trailing", "default", { trailing: false }),
    exact("exact-no-helper", "default", { helper: false }),
    exact("exact-compact", "default", { compact: true }),
    minor(
      "minor-glyph-subpixel",
      { textShift: 1 },
      "A one-pixel glyph-edge/position shift preserves line metrics, hierarchy, roles, state, and geometry within the locked tolerance.",
    ),
    minor(
      "minor-color-six",
      { colorDelta: 6 },
      "A six-level per-channel sRGB border delta is inside both color limits and does not alter semantic state.",
    ),
    minor(
      "minor-color-eleven",
      { colorDelta: 11 },
      "An eleven-level per-channel sRGB border delta is inside both declared limits while preserving structure and state.",
    ),
    minor(
      "minor-helper-glyph-shift",
      { textShift: -1 },
      "A one-pixel text raster/position shift preserves wrapping, line count, hierarchy, and semantic roles.",
    ),
    fail(
      "blank",
      { state: "default", blank: true },
      "The entire required rendering is blank.",
    ),
    fail(
      "missing-surface",
      { state: "default", surface: false },
      "The role-defining input surface is absent.",
    ),
    fail(
      "missing-label",
      { state: "default", label: false },
      "The supplied visible label is absent.",
    ),
    fail(
      "wrong-focus",
      { state: "default" },
      "The reference focus ring/state is missing.",
      { state: "focus" },
    ),
    fail(
      "wrong-error",
      { state: "default" },
      "The reference error border and error message state are replaced by default.",
      { state: "error" },
    ),
    fail(
      "wrong-disabled",
      { state: "default" },
      "The reference disabled fill/ink/border state is replaced by default.",
      { state: "disabled" },
    ),
    fail(
      "missing-leading",
      { state: "default", leading: false },
      "The required leading adornment is absent.",
    ),
    fail(
      "missing-trailing",
      { state: "default", trailing: false },
      "The required trailing adornment is absent.",
    ),
    fail(
      "severe-clipping",
      { state: "default", clipRight: true },
      "More than five percent of required surface, content, and trailing adornment area is clipped.",
    ),
    fail(
      "severe-scale",
      { state: "default", compact: true },
      "The surface width and role layout shrink far beyond the 8%/4px geometry and 10% scale limits.",
    ),
    fail(
      "severe-overlap",
      { state: "default", overlap: true },
      "The helper text overlaps required input content by more than two pixels.",
    ),
    fail(
      "missing-helper",
      { state: "default", helper: false },
      "The supplied helper-message role is absent.",
    ),
  ];
};

const packetBase = (
  phase: Phase,
  version: string,
  protocol: Protocol,
  tasks: PacketTask[],
): Omit<BlindPacket, "randomizedBatchHash"> => ({
  version,
  phase,
  status: "opaque-ungraded",
  calibrationCommitment: protocol.commitment,
  rubricVersion: RUBRIC_VERSION,
  rubric: protocol.rubric,
  instructions:
    phase === "gold-calibration"
      ? [
          "Use only this blind-packet directory. Do not inspect the parent directory or any sealed answer key before submitting.",
          "Grade all 24 opaque pairs independently in packet order with the locked rubric. Pixel identity is not required.",
          "Copy your assigned template, replace every null, preserve exact fields/order/IDs, and run the printed preflight command before submission.",
          "Write only the assigned gold submission path. Gold feedback may be opened only after submission.",
        ]
      : [
          "Begin only after receiving a passing calibration receipt for your same graderId.",
          "Use only this performance blind-packet directory, your calibration receipt, and the locked rubric. Never inspect parent evidence, prior grades, source code, or any sealed performance key.",
          "Grade all 384 opaque pairs independently in packet order. Do not compare tasks, search for repetitions, infer identities, rank implementations, or change thresholds.",
          "Copy your assigned template, fill the calibration receipt fields and every grade, preserve exact fields/order/IDs, then run preflight before writing only the assigned performance submission path.",
        ],
  gradeSchema: GRADE_SCHEMA_PATH,
  preflight:
    "npx tsx recipe/input-field-comparison-calibration-v2.ts --preflight <gold|performance> <completed-grade.json>",
  assignedTemplates: Object.fromEntries(
    RATERS.map((rater) => [rater, templatePath(phase, rater)]),
  ) as Record<Rater, string>,
  counts: {
    tasks: tasks.length,
    referencePresentations: tasks.length,
    specimenPresentations: tasks.length,
  },
  tasks,
});

const copyIntoNext = (source: string, destination: string): void => {
  mkdirSync(path.dirname(absolute(destination)), { recursive: true });
  copyFileSync(absolute(source), absolute(destination));
};

const containedRegular = (relativeFile: string, blindRoot: string): string => {
  check(!path.isAbsolute(relativeFile), `${relativeFile} must be relative`);
  const root = absolute(blindRoot);
  const candidate = path.resolve(root, relativeFile);
  const lexical = path.relative(root, candidate);
  check(
    lexical !== "" && !lexical.startsWith("..") && !path.isAbsolute(lexical),
    `${relativeFile} escapes ${blindRoot}`,
  );
  const stat = lstatSync(candidate);
  check(
    stat.isFile() && !stat.isSymbolicLink(),
    `${relativeFile} is not regular`,
  );
  const resolved = path.relative(realpathSync(root), realpathSync(candidate));
  check(
    resolved !== "" && !resolved.startsWith("..") && !path.isAbsolute(resolved),
    `${relativeFile} resolves outside ${blindRoot}`,
  );
  return candidate;
};

const freshIds = (
  seed: string,
  identity: string,
): { taskId: string; referenceId: string; specimenId: string } => ({
  taskId: `task-${sha256(`${seed}\0task\0${identity}`).slice(0, 20)}`,
  referenceId: `reference-${sha256(`${seed}\0reference\0${identity}`).slice(0, 20)}`,
  specimenId: `specimen-${sha256(`${seed}\0specimen\0${identity}`).slice(0, 20)}`,
});

const buildGold = async (
  protocol: Protocol,
): Promise<{
  packetHash: string;
  randomizedBatchHash: string;
  keyHash: string;
  templateHashes: Record<Rater, string>;
  imageManifestHash: string;
}> => {
  const seed = sha256(`${VERSION}\0gold\0${protocol.commitment}`);
  const rows = goldCases()
    .map((goldCase) => ({ goldCase, ids: freshIds(seed, goldCase.name) }))
    .sort((left, right) =>
      sha256(`${seed}\0order\0${left.goldCase.name}`).localeCompare(
        sha256(`${seed}\0order\0${right.goldCase.name}`),
      ),
    );
  const answers: GoldAnswer[] = [];
  const tasks: PacketTask[] = [];
  for (const { goldCase, ids } of rows) {
    const referenceBytes = renderField(goldCase.reference);
    const specimenBytes = renderField(goldCase.specimen);
    const referenceImage = `references/${ids.referenceId}.png`;
    const specimenImage = `specimens/${ids.specimenId}.png`;
    const referencePath = `${NEXT_ROOT}/gold/blind-packet/${referenceImage}`;
    const specimenPath = `${NEXT_ROOT}/gold/blind-packet/${specimenImage}`;
    mkdirSync(path.dirname(absolute(referencePath)), { recursive: true });
    mkdirSync(path.dirname(absolute(specimenPath)), { recursive: true });
    writeFileSync(absolute(referencePath), referenceBytes);
    writeFileSync(absolute(specimenPath), specimenBytes);
    tasks.push({
      taskId: ids.taskId,
      reference: { referenceId: ids.referenceId, image: referenceImage },
      specimen: { specimenId: ids.specimenId, image: specimenImage },
    });
    answers.push({
      ...ids,
      expectedRecognisable: goldCase.expected,
      obviousStructuralOrStateFailure: goldCase.obvious,
      class: goldCase.class,
      rationale: goldCase.rationale,
      referenceHash: sha256(referenceBytes),
      specimenHash: sha256(specimenBytes),
    });
  }
  const base = packetBase("gold-calibration", GOLD_PROTOCOL, protocol, tasks);
  const packet: BlindPacket = {
    ...base,
    randomizedBatchHash: batchHash(base),
  };
  const packetPath = `${NEXT_ROOT}/gold/blind-packet/packet.json`;
  writeFileSync(
    absolute(packetPath),
    await format(JSON.stringify(packet), { parser: "json" }),
  );
  const packetHash = fileHash(packetPath);
  const templateHashes = {} as Record<Rater, string>;
  for (const rater of RATERS) {
    const target = templatePath("gold-calibration", rater).replace(
      ROOT,
      NEXT_ROOT,
    );
    writeJson(
      target,
      makeTemplate("gold-calibration", rater, packet, packetHash),
    );
    templateHashes[rater] = fileHash(target);
  }
  const keyPath = `${NEXT_ROOT}/gold/sealed-answer-key.json`;
  writeJson(keyPath, {
    version: "opaque-gold-answer-key-v1",
    revealOnlyAfterValidGoldSubmission: true,
    neverUsedForPerformanceScoring: true,
    calibrationCommitment: protocol.commitment,
    randomizedBatchHash: packet.randomizedBatchHash,
    generation: {
      kind: "deterministic-synthetic-non-target",
      generatorSource: "recipe/input-field-comparison-calibration-v2.ts",
      generatorSourceHash: fileHash(
        "recipe/input-field-comparison-calibration-v2.ts",
      ),
      seedHash: sha256(`${seed}\0gold-generation`),
      pngEncoder: "pngjs-sync-colorType-6",
      canvas: { width: 320, height: 160 },
    },
    counts: {
      cases: 24,
      exactOrSemanticPasses: 8,
      controlledMinorPasses: 4,
      obviousStructuralOrStateFailures: 12,
    },
    answers,
  });
  return {
    packetHash,
    randomizedBatchHash: packet.randomizedBatchHash,
    keyHash: fileHash(keyPath),
    templateHashes,
    imageManifestHash: sha256(
      JSON.stringify(
        answers.map((answer) => ({
          taskId: answer.taskId,
          referenceHash: answer.referenceHash,
          specimenHash: answer.specimenHash,
        })),
      ),
    ),
  };
};

const verifyContinuity = () => {
  const v2 = parse<EvidenceReceipt>(`${V2_ROOT}/receipt.json`);
  const failed = parse<FailedCalibrationReceipt>(`${FAILED_ROOT}/receipt.json`);
  check(
    v2.matrix.cells.length === 128 &&
      v2.references.length === 128 &&
      v2.outputs.legacy.length === 128 &&
      v2.outputs.recipeReact?.length === 128 &&
      failed.continuity.cells.length === 128,
    "prior 128-cell evidence cardinality differs",
  );
  const references = byCell(v2.references);
  const legacy = byCell(v2.outputs.legacy);
  const corrected = byCell(v2.outputs.recipeReact ?? []);
  const failedByCell = new Map(
    failed.continuity.cells.map((cell) => [cell.cellKey, cell]),
  );
  const cells = v2.matrix.cells.map(({ key: cellKey }) => {
    const reference = references.get(cellKey);
    const legacyArtifact = legacy.get(cellKey);
    const correctedArtifact = corrected.get(cellKey);
    const prior = failedByCell.get(cellKey);
    check(
      reference && legacyArtifact && correctedArtifact && prior,
      `${cellKey} continuity row is incomplete`,
    );
    for (const artifact of [reference, legacyArtifact, correctedArtifact])
      check(
        fileHash(artifact.file) === artifact.hash,
        `${cellKey} prior artifact bytes changed`,
      );
    check(
      reference.hash === prior.referenceHash &&
        legacyArtifact.hash === prior.legacyHash &&
        correctedArtifact.hash === prior.correctedV2Hash,
      `${cellKey} differs from the prior calibrated continuity proof`,
    );
    return {
      cellKey,
      reference,
      legacy: legacyArtifact,
      corrected: correctedArtifact,
    };
  });
  return { v2, cells };
};

const buildPerformance = async (
  protocol: Protocol,
  continuity: ReturnType<typeof verifyContinuity>,
): Promise<{
  packetHash: string;
  randomizedBatchHash: string;
  keyHash: string;
  templateHashes: Record<Rater, string>;
  continuityHash: string;
  duplicateManifestHash: string;
}> => {
  const seed = sha256(
    [
      VERSION,
      "performance",
      protocol.commitment,
      continuity.v2.matrix.sampleMatrixHash,
      ...continuity.cells.flatMap((cell) => [
        cell.reference.hash,
        cell.legacy.hash,
        cell.corrected.hash,
      ]),
    ].join("\0"),
  );
  const baseRows = continuity.cells.flatMap((cell) =>
    (
      [
        ["corrected-v2", cell.corrected],
        ["legacy-copy-a", cell.legacy],
        ["legacy-copy-b", cell.legacy],
      ] as const
    ).map(([implementationPath, artifact]) => ({
      cell,
      implementationPath,
      artifact,
      ids: freshIds(seed, `${cell.cellKey}\0${implementationPath}`),
    })),
  );
  let rows = baseRows;
  let nonce = 0;
  for (; nonce < 10_000; nonce += 1) {
    rows = [...baseRows].sort((left, right) =>
      sha256(
        `${seed}\0order\0${nonce}\0${left.cell.cellKey}\0${left.implementationPath}`,
      ).localeCompare(
        sha256(
          `${seed}\0order\0${nonce}\0${right.cell.cellKey}\0${right.implementationPath}`,
        ),
      ),
    );
    if (
      rows.every(
        (row, index) =>
          index === 0 || rows[index - 1]!.cell.cellKey !== row.cell.cellKey,
      )
    )
      break;
  }
  check(nonce < 10_000, "could not produce non-adjacent performance order");
  const tasks: PacketTask[] = [];
  const answers: PerformanceAnswer[] = [];
  for (const row of rows) {
    const referenceImage = `references/${row.ids.referenceId}.png`;
    const specimenImage = `specimens/${row.ids.specimenId}.png`;
    copyIntoNext(
      row.cell.reference.file,
      `${NEXT_ROOT}/performance/blind-packet/${referenceImage}`,
    );
    copyIntoNext(
      row.artifact.file,
      `${NEXT_ROOT}/performance/blind-packet/${specimenImage}`,
    );
    tasks.push({
      taskId: row.ids.taskId,
      reference: {
        referenceId: row.ids.referenceId,
        image: referenceImage,
      },
      specimen: { specimenId: row.ids.specimenId, image: specimenImage },
    });
    answers.push({
      ...row.ids,
      implementationPath: row.implementationPath,
      cellKey: row.cell.cellKey,
      referenceHash: row.cell.reference.hash,
      specimenHash: row.artifact.hash,
    });
  }
  const base = packetBase("performance", PERFORMANCE_PROTOCOL, protocol, tasks);
  const packet: BlindPacket = {
    ...base,
    randomizedBatchHash: batchHash(base),
  };
  const packetPath = `${NEXT_ROOT}/performance/blind-packet/packet.json`;
  writeFileSync(
    absolute(packetPath),
    await format(JSON.stringify(packet), { parser: "json" }),
  );
  const packetHash = fileHash(packetPath);
  const templateHashes = {} as Record<Rater, string>;
  for (const rater of RATERS) {
    const target = templatePath("performance", rater).replace(ROOT, NEXT_ROOT);
    writeJson(target, makeTemplate("performance", rater, packet, packetHash));
    templateHashes[rater] = fileHash(target);
  }
  const keyPath = `${NEXT_ROOT}/performance/sealed-answer-key.json`;
  writeJson(keyPath, {
    version: "input-field-performance-sealed-key-v3",
    sealedFromRaters: true,
    neverRevealPerformanceIdentities: true,
    parseOnlyAfterAllReliabilityPrerequisitesPass: true,
    calibrationCommitment: protocol.commitment,
    randomizedBatchHash: packet.randomizedBatchHash,
    randomizationSeedHash: sha256(`${seed}\0${nonce}`),
    answers,
  });
  const duplicateRows = new Map<
    string,
    Partial<Record<ImplementationPath, PerformanceAnswer>>
  >();
  for (const answer of answers) {
    const row = duplicateRows.get(answer.cellKey) ?? {};
    row[answer.implementationPath] = answer;
    duplicateRows.set(answer.cellKey, row);
  }
  const duplicateProof = [...duplicateRows.entries()].map(([cellKey, row]) => {
    const left = row["legacy-copy-a"];
    const right = row["legacy-copy-b"];
    check(
      left &&
        right &&
        left.specimenHash === right.specimenHash &&
        left.specimenHash ===
          continuity.cells.find((cell) => cell.cellKey === cellKey)!.legacy
            .hash,
      `${cellKey} hidden copies are not byte-identical`,
    );
    return {
      cellKey,
      copyASpecimenId: left.specimenId,
      copyBSpecimenId: right.specimenId,
      sha256: left.specimenHash,
    };
  });
  return {
    packetHash,
    randomizedBatchHash: packet.randomizedBatchHash,
    keyHash: fileHash(keyPath),
    templateHashes,
    continuityHash: sha256(
      JSON.stringify(
        continuity.cells.map((cell) => ({
          cellKey: cell.cellKey,
          referenceHash: cell.reference.hash,
          legacyHash: cell.legacy.hash,
          correctedV2Hash: cell.corrected.hash,
        })),
      ),
    ),
    duplicateManifestHash: sha256(JSON.stringify(duplicateProof)),
  };
};

const promptFor = (rater: Rater): { gold: string; performance: string } => ({
  gold: [
    `Act as fresh independent rater ${rater}.`,
    `Phase 1 only: open ${GOLD_PACKET_PATH}, your template ${templatePath("gold-calibration", rater)}, and images beneath ${ROOT}/gold/blind-packet; do not inspect parent directories or ${GOLD_KEY_PATH}.`,
    "Apply the locked rubric to all 24 tasks in exact order, replace every null, and preserve every field and ID.",
    `Run npx tsx recipe/input-field-comparison-calibration-v2.ts --preflight gold ${goldOutputPath(rater)} and write only ${goldOutputPath(rater)}.`,
    "Stop after submission. You may receive gold feedback and a signed calibration receipt; do not open the performance packet unless that receipt passes.",
  ].join(" "),
  performance: [
    `Phase 2 for ${rater} begins only after ${calibrationReceiptPath(rater)} says passed=true, score>=0.95, obviousStructuralStateFailureScore=1, and envelopeValid=true.`,
    `Then open only ${PERFORMANCE_PACKET_PATH}, ${templatePath("performance", rater)}, that calibration receipt, and images beneath ${ROOT}/performance/blind-packet; never inspect ${PERFORMANCE_KEY_PATH}, parent evidence, source code, prior grades, or another rater's work.`,
    "Grade all 384 tasks independently in exact packet order with the unchanged locked rubric; do not compare tasks, seek repeats, infer identity, rank paths, or change thresholds.",
    `Fill the receipt binding and every grade, run npx tsx recipe/input-field-comparison-calibration-v2.ts --preflight performance ${performanceOutputPath(rater)}, and write only ${performanceOutputPath(rater)}.`,
    "Do not adjudicate or reveal any performance identity.",
  ].join(" "),
});

export async function buildCalibrationV2(): Promise<void> {
  const snapshots = historicalSnapshots();
  const continuity = verifyContinuity();
  const protocol = makeProtocol();
  rmSync(absolute(NEXT_ROOT), { recursive: true, force: true });
  mkdirSync(absolute(NEXT_ROOT), { recursive: true });
  writeJson(`${NEXT_ROOT}/protocol.json`, protocol);
  writeFileSync(
    absolute(`${NEXT_ROOT}/grade.schema.json`),
    await format(JSON.stringify(gradeSchema()), { parser: "json" }),
  );
  const gold = await buildGold(protocol);
  const performance = await buildPerformance(protocol, continuity);
  assertSnapshots(snapshots);
  const prompts = Object.fromEntries(
    RATERS.map((rater) => [rater, promptFor(rater)]),
  ) as Record<Rater, ReturnType<typeof promptFor>>;
  const receipt = {
    version: VERSION,
    status: {
      protocol: "locked",
      goldPacket: "opaque-ungraded",
      performancePacket: "sealed-ungraded",
      recognisabilityInstrument:
        "blocked-pending-three-calibrated-valid-raters",
      architecturePerformance: "not-unsealed",
      liveInput: "blocked",
      inputOverall: false,
    },
    failedRoundDiagnosis: protocol.failedRoundDiagnosis,
    preservation: {
      previousInputEvidenceModified: false,
      protectedTreeSnapshots: snapshots,
    },
    commitment: {
      protocol: PROTOCOL_PATH,
      protocolHash: fileHash(`${NEXT_ROOT}/protocol.json`),
      calibrationCommitment: protocol.commitment,
      rubricVersion: RUBRIC_VERSION,
      rubricHash: protocol.rubricHash,
      gradeSchema: GRADE_SCHEMA_PATH,
      gradeSchemaHash: fileHash(`${NEXT_ROOT}/grade.schema.json`),
      lockedBeforeAnyFreshGrade: true,
    },
    gold: {
      packet: GOLD_PACKET_PATH,
      packetHash: gold.packetHash,
      randomizedBatchHash: gold.randomizedBatchHash,
      sealedAnswerKey: GOLD_KEY_PATH,
      sealedAnswerKeyHash: gold.keyHash,
      syntheticGeneratorSource:
        "recipe/input-field-comparison-calibration-v2.ts",
      syntheticGeneratorSourceHash: fileHash(
        "recipe/input-field-comparison-calibration-v2.ts",
      ),
      imageManifestHash: gold.imageManifestHash,
      counts: {
        cases: 24,
        exactOrSemanticPasses: 8,
        controlledMinorPasses: 4,
        obviousStructuralOrStateFailures: 12,
        expectedPass: 12,
        expectedFail: 12,
      },
      templateHashes: gold.templateHashes,
      outcomeDisclosure:
        "Only after a valid gold submission, for calibration feedback before performance.",
    },
    performance: {
      packet: PERFORMANCE_PACKET_PATH,
      packetHash: performance.packetHash,
      randomizedBatchHash: performance.randomizedBatchHash,
      sealedAnswerKey: PERFORMANCE_KEY_PATH,
      sealedAnswerKeyHash: performance.keyHash,
      answerKeyParsedForPerformanceResult: false,
      performanceIdentitiesRevealed: false,
      gradeWritten: false,
      counts: {
        uniqueSourceReferences: 128,
        referencePresentations: 384,
        correctedV2: 128,
        hiddenLegacyCopyA: 128,
        hiddenLegacyCopyB: 128,
        specimens: 384,
      },
      byteContinuity: {
        sourceReferencesMatchingPriorRound: 128,
        correctedV2MatchingPriorRound: 128,
        legacyCopyAMatchingPriorRound: 128,
        legacyCopyBMatchingPriorRound: 128,
        hiddenByteIdenticalPairs: 128,
        continuityHash: performance.continuityHash,
        duplicateManifestHash: performance.duplicateManifestHash,
      },
      freshOpacity: {
        priorPacketReused: false,
        taskIdsReused: 0,
        referenceIdsReused: 0,
        specimenIdsReused: 0,
        pathsReused: 0,
        freshOrder: true,
        packetContainsIdentityOrDuplicateLabels: false,
      },
      templateHashes: performance.templateHashes,
    },
    thresholds: protocol.reliability,
    raters: RATERS.map((rater) => ({
      graderId: rater,
      status: "awaiting-gold-calibration",
      goldTemplate: templatePath("gold-calibration", rater),
      goldOutput: goldOutputPath(rater),
      calibrationReceipt: calibrationReceiptPath(rater),
      performanceTemplate: templatePath("performance", rater),
      performanceOutput: performanceOutputPath(rater),
      prompts: prompts[rater],
    })),
  };
  writeJson(`${NEXT_ROOT}/receipt.json`, receipt);
  writeJson(`${NEXT_ROOT}/index.json`, {
    version: VERSION,
    status: "calibration-required-performance-sealed-live-input-blocked",
    overall: false,
    recognisabilityInstrumentUsable: false,
    performanceGraded: false,
    performanceUnsealed: false,
    liveInputMayProceed: false,
    protocol: PROTOCOL_PATH,
    protocolHash: fileHash(`${NEXT_ROOT}/protocol.json`),
    gradeSchema: GRADE_SCHEMA_PATH,
    gradeSchemaHash: fileHash(`${NEXT_ROOT}/grade.schema.json`),
    goldPacket: GOLD_PACKET_PATH,
    goldPacketHash: gold.packetHash,
    performancePacket: PERFORMANCE_PACKET_PATH,
    performancePacketHash: performance.packetHash,
    receipt: RECEIPT_PATH,
    receiptHash: fileHash(`${NEXT_ROOT}/receipt.json`),
  });
  rmSync(absolute(ROOT), { recursive: true, force: true });
  renameSync(absolute(NEXT_ROOT), absolute(ROOT));
  validateCommittedCalibrationV2();
}

export const validateProtocol = (protocol: Protocol): void => {
  const expected = makeProtocol();
  check(
    JSON.stringify(protocol) === JSON.stringify(expected) &&
      protocol.commitment === sha256(JSON.stringify(protocolBody())) &&
      protocol.rubricHash === sha256(JSON.stringify(protocol.rubric)),
    "protocol, rubric, thresholds, or commitment changed after lock",
  );
};

export function validatePacketDocument(
  packet: BlindPacket,
  phase: Phase,
  expectedTasks: number,
  protocol: Protocol = makeProtocol(),
): void {
  exactKeys(
    packet as unknown as Record<string, unknown>,
    [
      "version",
      "phase",
      "status",
      "calibrationCommitment",
      "rubricVersion",
      "rubric",
      "instructions",
      "gradeSchema",
      "preflight",
      "assignedTemplates",
      "counts",
      "randomizedBatchHash",
      "tasks",
    ],
    "packet",
  );
  check(
    packet.phase === phase &&
      packet.version ===
        (phase === "gold-calibration" ? GOLD_PROTOCOL : PERFORMANCE_PROTOCOL) &&
      packet.status === "opaque-ungraded" &&
      packet.calibrationCommitment === protocol.commitment &&
      packet.rubricVersion === RUBRIC_VERSION &&
      JSON.stringify(packet.rubric) === JSON.stringify(protocol.rubric) &&
      packet.gradeSchema === GRADE_SCHEMA_PATH &&
      packet.tasks.length === expectedTasks &&
      packet.counts.tasks === expectedTasks &&
      packet.counts.referencePresentations === expectedTasks &&
      packet.counts.specimenPresentations === expectedTasks,
    `${phase} packet protocol or cardinality differs`,
  );
  const taskIds = new Set<string>();
  const referenceIds = new Set<string>();
  const specimenIds = new Set<string>();
  for (const [index, task] of packet.tasks.entries()) {
    exactKeys(
      task as unknown as Record<string, unknown>,
      ["taskId", "reference", "specimen"],
      `${phase} task ${index}`,
    );
    exactKeys(
      task.reference as unknown as Record<string, unknown>,
      ["referenceId", "image"],
      `${phase} task ${index} reference`,
    );
    exactKeys(
      task.specimen as unknown as Record<string, unknown>,
      ["specimenId", "image"],
      `${phase} task ${index} specimen`,
    );
    const metadata = JSON.stringify(task);
    check(
      !IDENTITY_LEAK.test(metadata),
      `${phase} task ${index} label leakage`,
    );
    check(
      /^task-[a-f0-9]{20}$/.test(task.taskId) &&
        /^reference-[a-f0-9]{20}$/.test(task.reference.referenceId) &&
        /^references\/reference-[a-f0-9]{20}\.png$/.test(
          task.reference.image,
        ) &&
        /^specimen-[a-f0-9]{20}$/.test(task.specimen.specimenId) &&
        /^specimens\/specimen-[a-f0-9]{20}\.png$/.test(task.specimen.image),
      `${phase} task ${index} metadata is not opaque`,
    );
    check(
      !taskIds.has(task.taskId) &&
        !referenceIds.has(task.reference.referenceId) &&
        !specimenIds.has(task.specimen.specimenId),
      `${phase} packet IDs are not unique`,
    );
    taskIds.add(task.taskId);
    referenceIds.add(task.reference.referenceId);
    specimenIds.add(task.specimen.specimenId);
  }
  const withoutHash = { ...packet };
  delete (withoutHash as Partial<BlindPacket>).randomizedBatchHash;
  check(
    packet.randomizedBatchHash ===
      batchHash(withoutHash as Omit<BlindPacket, "randomizedBatchHash">),
    `${phase} randomized batch hash differs`,
  );
}

const concreteDefect = (defect: unknown): defect is string =>
  typeof defect === "string" &&
  defect.trim().length >= 20 &&
  !IDENTITY_LEAK.test(defect);

export const validateCalibrationPrerequisite = (
  binding: NonNullable<GradeEnvelope["calibrationReceipt"]>,
  receipt: CalibrationReceipt,
  envelope: Pick<GradeEnvelope, "graderId" | "calibrationCommitment">,
): void => {
  check(
    receipt.graderId === envelope.graderId &&
      receipt.calibrationCommitment === envelope.calibrationCommitment &&
      receipt.envelopeValid &&
      receipt.passed &&
      receipt.performanceEligibility &&
      receipt.score >= 0.95 &&
      receipt.obviousStructuralStateFailureScore === 1 &&
      binding.score === receipt.score &&
      binding.obviousStructuralStateFailureScore === 1 &&
      binding.passed,
    "rater failed calibration or receipt prerequisites",
  );
};

const receiptForPerformance = (
  envelope: GradeEnvelope,
  expectedPath: string,
): void => {
  const binding = envelope.calibrationReceipt;
  check(binding, "performance calibration receipt binding is missing");
  check(
    binding.path === expectedPath,
    "performance calibration receipt path differs",
  );
  check(
    existsSync(absolute(binding.path)),
    "performance calibration receipt is absent",
  );
  check(
    fileHash(binding.path) === binding.sha256,
    "performance calibration receipt hash differs",
  );
  const receipt = parse<CalibrationReceipt>(binding.path);
  validateCalibrationPrerequisite(binding, receipt, envelope);
};

export function validateGradeEnvelope(
  envelope: GradeEnvelope,
  packet: BlindPacket,
  packetHash: string,
  expectedRater?: Rater,
  checkCalibrationReceipt = true,
): void {
  const phase = packet.phase;
  const expectedTop = [
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
  ];
  exactKeys(
    envelope as unknown as Record<string, unknown>,
    expectedTop,
    "grade envelope",
  );
  check(
    envelope.phase === phase &&
      envelope.schemaVersion === SCHEMA_VERSION &&
      RATERS.includes(envelope.graderId as Rater) &&
      (!expectedRater || envelope.graderId === expectedRater) &&
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
    const expectedRecognisable = CATEGORIES.every(
      (category) => grade.criteria[category].verdict !== "fail",
    );
    const defects = CATEGORIES.flatMap(
      (category) => grade.criteria[category].defects,
    );
    check(
      grade.recognisable === expectedRecognisable &&
        grade.defects.every(concreteDefect) &&
        JSON.stringify(grade.defects) === JSON.stringify(defects),
      `grade ${index} pass rule or ordered defect rollup differs`,
    );
  }
  if (phase === "performance" && checkCalibrationReceipt)
    receiptForPerformance(
      envelope,
      calibrationReceiptPath(envelope.graderId as Rater),
    );
}

export function scoreGoldCalibration(
  gradeFile: string,
  receiptFile: string,
): CalibrationReceipt {
  const packet = parse<BlindPacket>(GOLD_PACKET_PATH);
  const envelope = parse<GradeEnvelope>(gradeFile);
  validateGradeEnvelope(envelope, packet, fileHash(GOLD_PACKET_PATH));
  const key = parse<{ answers: GoldAnswer[] }>(GOLD_KEY_PATH);
  const expected = new Map(
    key.answers.map((answer) => [answer.taskId, answer]),
  );
  const rows = envelope.orderedGrades.map((grade) => {
    const answer = expected.get(grade.taskId);
    check(answer, `${grade.taskId} has no gold answer`);
    return { grade, answer };
  });
  const correct = rows.filter(
    ({ grade, answer }) => grade.recognisable === answer.expectedRecognisable,
  ).length;
  const obvious = rows.filter(
    ({ grade, answer }) =>
      answer.obviousStructuralOrStateFailure && !grade.recognisable,
  ).length;
  const score = correct / 24;
  const obviousScore = obvious / 12;
  const passed = score >= 0.95 && obviousScore === 1;
  const receipt: CalibrationReceipt = {
    version: "rater-calibration-receipt-v1",
    graderId: envelope.graderId,
    calibrationCommitment: envelope.calibrationCommitment,
    packetHash: envelope.packetHash,
    randomizedBatchHash: envelope.randomizedBatchHash,
    gradeHash: fileHash(gradeFile),
    score,
    correct,
    denominator: 24,
    obviousStructuralStateFailuresCorrect: obvious,
    obviousStructuralStateFailuresDenominator: 12,
    obviousStructuralStateFailureScore: obviousScore,
    envelopeValid: true,
    passed,
    performanceEligibility: passed,
    feedback: rows
      .filter(
        ({ grade, answer }) =>
          grade.recognisable !== answer.expectedRecognisable,
      )
      .map(({ grade, answer }) => ({
        taskId: grade.taskId,
        submittedRecognisable: grade.recognisable,
        expectedRecognisable: answer.expectedRecognisable,
        rationale: answer.rationale,
      })),
  };
  check(
    receiptFile === calibrationReceiptPath(envelope.graderId as Rater),
    "calibration receipt output path differs from assigned path",
  );
  writeJson(receiptFile, receipt);
  return receipt;
}

const validateGold = (
  packet: BlindPacket,
  receipt: any,
  protocol: Protocol,
): void => {
  validatePacketDocument(packet, "gold-calibration", 24, protocol);
  const blindRoot = `${ROOT}/gold/blind-packet`;
  const key = parse<{
    generation: { generatorSourceHash: string };
    counts: Record<string, number>;
    answers: GoldAnswer[];
  }>(GOLD_KEY_PATH);
  check(
    key.answers.length === 24 &&
      key.answers.filter((answer) => answer.expectedRecognisable).length ===
        12 &&
      key.answers.filter((answer) => answer.obviousStructuralOrStateFailure)
        .length === 12 &&
      key.generation.generatorSourceHash ===
        fileHash("recipe/input-field-comparison-calibration-v2.ts") &&
      receipt.gold.syntheticGeneratorSourceHash ===
        key.generation.generatorSourceHash,
    "gold generation, outcome classes, or source pin differs",
  );
  const taskById = new Map(packet.tasks.map((task) => [task.taskId, task]));
  for (const answer of key.answers) {
    const task = taskById.get(answer.taskId);
    check(
      task &&
        task.reference.referenceId === answer.referenceId &&
        task.specimen.specimenId === answer.specimenId,
      `${answer.taskId} gold key mapping differs`,
    );
    check(
      sha256(
        readFileSync(containedRegular(task.reference.image, blindRoot)),
      ) === answer.referenceHash &&
        sha256(
          readFileSync(containedRegular(task.specimen.image, blindRoot)),
        ) === answer.specimenHash,
      `${answer.taskId} gold image bytes differ`,
    );
    if (answer.class === "exact-pass")
      check(
        answer.referenceHash === answer.specimenHash,
        `${answer.taskId} exact pass is not byte-identical`,
      );
    if (answer.class === "controlled-minor-pass")
      check(
        answer.referenceHash !== answer.specimenHash,
        `${answer.taskId} controlled minor case lacks a raster difference`,
      );
  }
};

const validatePerformance = (
  packet: BlindPacket,
  receipt: any,
  protocol: Protocol,
): void => {
  validatePacketDocument(packet, "performance", 384, protocol);
  const continuity = verifyContinuity();
  const key = parse<{ answers: PerformanceAnswer[] }>(PERFORMANCE_KEY_PATH);
  check(key.answers.length === 384, "performance key cardinality differs");
  const priorPacket = parse<BlindPacket>(
    `${FAILED_ROOT}/blind-packet/packet.json`,
  );
  const priorIds = new Set(
    priorPacket.tasks.flatMap((task) => [
      task.taskId,
      task.reference.referenceId,
      task.specimen.specimenId,
      task.reference.image,
      task.specimen.image,
    ]),
  );
  const taskById = new Map(packet.tasks.map((task) => [task.taskId, task]));
  const cellById = new Map(
    continuity.cells.map((cell) => [cell.cellKey, cell]),
  );
  const counts: Record<ImplementationPath, number> = {
    "corrected-v2": 0,
    "legacy-copy-a": 0,
    "legacy-copy-b": 0,
  };
  const byCellMap = new Map<
    string,
    Partial<Record<ImplementationPath, PerformanceAnswer>>
  >();
  const blindRoot = `${ROOT}/performance/blind-packet`;
  for (const answer of key.answers) {
    const task = taskById.get(answer.taskId);
    const cell = cellById.get(answer.cellKey);
    check(task && cell, `${answer.taskId} performance key mapping is foreign`);
    check(
      !priorIds.has(answer.taskId) &&
        !priorIds.has(answer.referenceId) &&
        !priorIds.has(answer.specimenId) &&
        !priorIds.has(task.reference.image) &&
        !priorIds.has(task.specimen.image),
      `${answer.taskId} reuses a prior opaque identity or path`,
    );
    const expectedSpecimen =
      answer.implementationPath === "corrected-v2"
        ? cell.corrected.hash
        : cell.legacy.hash;
    check(
      task.reference.referenceId === answer.referenceId &&
        task.specimen.specimenId === answer.specimenId &&
        answer.referenceHash === cell.reference.hash &&
        answer.specimenHash === expectedSpecimen &&
        sha256(
          readFileSync(containedRegular(task.reference.image, blindRoot)),
        ) === cell.reference.hash &&
        sha256(
          readFileSync(containedRegular(task.specimen.image, blindRoot)),
        ) === expectedSpecimen,
      `${answer.taskId} performance continuity or image bytes differ`,
    );
    counts[answer.implementationPath] += 1;
    const row = byCellMap.get(answer.cellKey) ?? {};
    check(!row[answer.implementationPath], `${answer.cellKey} repeats a path`);
    row[answer.implementationPath] = answer;
    byCellMap.set(answer.cellKey, row);
  }
  check(
    Object.values(counts).every((count) => count === 128) &&
      byCellMap.size === 128,
    "performance path cardinality differs",
  );
  for (const [cellKey, row] of byCellMap) {
    const corrected = row["corrected-v2"];
    const copyA = row["legacy-copy-a"];
    const copyB = row["legacy-copy-b"];
    check(corrected && copyA && copyB, `${cellKey} path mapping is incomplete`);
    check(
      copyA.specimenHash === copyB.specimenHash &&
        copyA.specimenHash === cellById.get(cellKey)!.legacy.hash,
      `${cellKey} revealed duplicate bytes differ`,
    );
    const positions = [corrected, copyA, copyB]
      .map((answer) =>
        packet.tasks.findIndex((task) => task.taskId === answer.taskId),
      )
      .sort((left, right) => left - right);
    check(
      positions[1]! - positions[0]! > 1 && positions[2]! - positions[1]! > 1,
      `${cellKey} same-cell presentations are adjacent`,
    );
  }
  check(
    receipt.performance.answerKeyParsedForPerformanceResult === false &&
      receipt.performance.performanceIdentitiesRevealed === false &&
      receipt.performance.gradeWritten === false,
    "performance was graded or unsealed",
  );
};

export function validateCommittedCalibrationV2(): void {
  const protocol = parse<Protocol>(PROTOCOL_PATH);
  validateProtocol(protocol);
  check(
    JSON.stringify(parse(GRADE_SCHEMA_PATH)) === JSON.stringify(gradeSchema()),
    "grade JSON Schema changed",
  );
  const receipt = parse<any>(RECEIPT_PATH);
  const index = parse<any>(INDEX_PATH);
  check(
    fileHash(index.protocol) === index.protocolHash &&
      fileHash(index.gradeSchema) === index.gradeSchemaHash &&
      fileHash(index.goldPacket) === index.goldPacketHash &&
      fileHash(index.performancePacket) === index.performancePacketHash &&
      fileHash(index.receipt) === index.receiptHash,
    "index schema, packet, protocol, or receipt pin differs",
  );
  check(
    !index.overall &&
      !index.recognisabilityInstrumentUsable &&
      !index.performanceGraded &&
      !index.performanceUnsealed &&
      !index.liveInputMayProceed &&
      receipt.status.performancePacket === "sealed-ungraded" &&
      receipt.status.architecturePerformance === "not-unsealed" &&
      receipt.status.liveInput === "blocked" &&
      !receipt.status.inputOverall,
    "blocked, sealed, or ungraded status differs",
  );
  check(
    fileHash(receipt.commitment.protocol) === receipt.commitment.protocolHash &&
      fileHash(receipt.commitment.gradeSchema) ===
        receipt.commitment.gradeSchemaHash &&
      receipt.commitment.calibrationCommitment === protocol.commitment &&
      receipt.commitment.rubricHash === protocol.rubricHash &&
      JSON.stringify(receipt.thresholds) ===
        JSON.stringify(protocol.reliability),
    "receipt commitment, schema, rubric, or thresholds differ",
  );
  assertSnapshots(receipt.preservation.protectedTreeSnapshots);
  const goldPacket = parse<BlindPacket>(GOLD_PACKET_PATH);
  const performancePacket = parse<BlindPacket>(PERFORMANCE_PACKET_PATH);
  check(
    fileHash(GOLD_PACKET_PATH) === receipt.gold.packetHash &&
      fileHash(GOLD_KEY_PATH) === receipt.gold.sealedAnswerKeyHash &&
      fileHash(PERFORMANCE_PACKET_PATH) === receipt.performance.packetHash &&
      fileHash(PERFORMANCE_KEY_PATH) ===
        receipt.performance.sealedAnswerKeyHash,
    "packet or key receipt hash differs",
  );
  validateGold(goldPacket, receipt, protocol);
  validatePerformance(performancePacket, receipt, protocol);
  for (const rater of RATERS) {
    for (const phase of ["gold-calibration", "performance"] as const) {
      const file = templatePath(phase, rater);
      const packet =
        phase === "gold-calibration" ? goldPacket : performancePacket;
      const expected = makeTemplate(
        phase,
        rater,
        packet,
        fileHash(
          phase === "gold-calibration"
            ? GOLD_PACKET_PATH
            : PERFORMANCE_PACKET_PATH,
        ),
      );
      check(
        JSON.stringify(parse(file)) === JSON.stringify(expected),
        `${phase} ${rater} template differs`,
      );
    }
  }
}

const runPreflight = (phaseArgument: string, gradeFile: string): void => {
  const phase: Phase =
    phaseArgument === "gold"
      ? "gold-calibration"
      : phaseArgument === "performance"
        ? "performance"
        : (() => {
            throw new Error("phase must be gold or performance");
          })();
  const packetPath =
    phase === "gold-calibration" ? GOLD_PACKET_PATH : PERFORMANCE_PACKET_PATH;
  const packet = parse<BlindPacket>(packetPath);
  validateGradeEnvelope(
    parse<GradeEnvelope>(gradeFile),
    packet,
    fileHash(packetPath),
  );
  console.log(
    `PASS ${phase} preflight: valid envelope and ${packet.tasks.length} ordered grades; no answer key accessed`,
  );
};

const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  if (process.argv.includes("--build")) {
    await buildCalibrationV2();
  } else if (process.argv.includes("--preflight")) {
    const index = process.argv.indexOf("--preflight");
    runPreflight(process.argv[index + 1] ?? "", process.argv[index + 2] ?? "");
  } else if (process.argv.includes("--score-gold")) {
    const index = process.argv.indexOf("--score-gold");
    const receipt = scoreGoldCalibration(
      process.argv[index + 1] ?? "",
      process.argv[index + 2] ?? "",
    );
    console.log(
      `Gold calibration ${receipt.passed ? "PASSED" : "FAILED"}: ${receipt.correct}/24; obvious failures ${receipt.obviousStructuralStateFailuresCorrect}/12`,
    );
  } else {
    validateCommittedCalibrationV2();
    console.log(
      `Calibration v2 valid; gold=24 opaque cases; performance=384 sealed tasks; packet sha256=${fileHash(PERFORMANCE_PACKET_PATH)}`,
    );
  }
}
