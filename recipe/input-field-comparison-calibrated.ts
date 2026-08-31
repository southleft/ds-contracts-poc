import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { format } from "prettier";

const REPO = path.resolve(new URL(".", import.meta.url).pathname, "..");
const V1_ROOT = "recipe/evidence/input-field-comparison";
const V2_ROOT = "recipe/evidence/input-field-comparison-v2";
const ROOT = "recipe/evidence/input-field-comparison-calibrated";
const NEXT_ROOT = "recipe/evidence/.input-field-comparison-calibrated-next";
const BLIND_ROOT = `${ROOT}/blind-packet`;
const NEXT_BLIND_ROOT = `${NEXT_ROOT}/blind-packet`;

export const CALIBRATION_PROTOCOL_PATH = `${ROOT}/calibration-protocol.json`;
export const CALIBRATION_PACKET_PATH = `${BLIND_ROOT}/packet.json`;
export const CALIBRATION_KEY_PATH = `${ROOT}/sealed-answer-key.json`;
export const CALIBRATION_RECEIPT_PATH = `${ROOT}/receipt.json`;
export const CALIBRATION_INDEX_PATH = `${ROOT}/index.json`;
export const CALIBRATION_GRADE_PATHS = [
  `${BLIND_ROOT}/grades-batch-cal-a.json`,
  `${BLIND_ROOT}/grades-batch-cal-b.json`,
  `${BLIND_ROOT}/grades-batch-cal-c.json`,
] as const;

const VERSION = "input-field-calibrated-hidden-duplicate-v1";
const RATERS = ["BATCH-CAL-A", "BATCH-CAL-B", "BATCH-CAL-C"] as const;
const CATEGORIES = [
  "structural-completeness-state-correctness",
  "geometry-proportions",
  "label-helper-adornments",
  "typography",
  "border-fill-focus-error-treatment",
] as const;
const MATERIAL_CATEGORIES = CATEGORIES.slice(1);
const IMPLEMENTATION_LEAK =
  /\blegacy\b|\brecipe\b|\bcorrected\b|\bduplicate\b|\bcopy[- _]?[ab]\b|\bimplementation\b|\bexpected[- _]?winner\b|\bmui\b|\bpolaris\b|@shopify|@mui/i;

type Rater = (typeof RATERS)[number];
type Category = (typeof CATEGORIES)[number];
type Confidence = "low" | "medium" | "high";
type ImplementationPath = "corrected-v2" | "legacy-copy-a" | "legacy-copy-b";

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

interface CalibrationProtocolBody {
  version: typeof VERSION;
  lockedBeforeGrading: true;
  purpose: string;
  evidenceDesign: {
    exactSourceCells: 128;
    correctedSpecimens: 128;
    unchangedControlCopyA: 128;
    unchangedControlCopyB: 128;
    totalSpecimens: 384;
    hiddenCopiesAreByteIdenticalPerCell: true;
    randomization: string;
  };
  rubric: {
    version: "input-field-observable-rubric-v1";
    evaluationOrder: Array<{
      category: Category;
      observableCriteria: string[];
      failureRule: string;
    }>;
    passRule: string;
    gradeSchemaRule: string;
  };
  acceptance: {
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
    recipeConsensusPerCell: "two-of-three majority";
    legacyConsensusPerCell: string;
    affectedDuplicateMismatchCell: "blocked";
    historicalResultsRemainHistory: true;
    calibratedConsensusSupersedesHistoryForProgressionOnlyIfThresholdsPass: true;
  };
  gradeOutputs: Record<Rater, string>;
}

interface CalibrationProtocol extends CalibrationProtocolBody {
  commitmentHash: string;
  rubricHash: string;
}

interface PacketTask {
  taskId: string;
  reference: { referenceId: string; image: string };
  specimen: {
    specimenId: string;
    image: string;
    grade: {
      recognisable: null;
      confidence: null;
      criteria: Record<Category, null>;
      defects: [];
    };
  };
}

export interface BlindPacket {
  version: typeof VERSION;
  status: "awaiting-three-independent-blind-grades";
  calibrationCommitmentHash: string;
  rubricHash: string;
  instructions: string[];
  rubric: CalibrationProtocolBody["rubric"];
  gradeOutputSchema: {
    version: "input-field-calibrated-grade-v1";
    allowedConfidence: ["low", "medium", "high"];
    criterionVerdicts: {
      structural: ["match", "fail"];
      remaining: ["match", "minor", "material"];
    };
  };
  randomizedBatchHash: string;
  counts: {
    tasks: 384;
    referencePresentations: 384;
    specimenPresentations: 384;
  };
  tasks: PacketTask[];
}

interface KeyAnswer {
  taskId: string;
  referenceId: string;
  specimenId: string;
  implementationPath: ImplementationPath;
  cellKey: string;
  referenceHash: string;
  specimenHash: string;
}

export interface SealedKey {
  version: typeof VERSION;
  sealedFromBlindRaters: true;
  calibrationCommitmentHash: string;
  randomizationSeedHash: string;
  randomizedBatchHash: string;
  answers: KeyAnswer[];
}

interface CriterionGrade {
  verdict: "match" | "fail" | "minor" | "material";
  defects: string[];
}

export interface CalibratedGrade {
  taskId: string;
  referenceId: string;
  specimenId: string;
  recognisable: boolean;
  confidence: Confidence;
  criteria: Record<Category, CriterionGrade>;
  defects: string[];
}

export interface CalibratedGradeBatch {
  version: "input-field-calibrated-grade-v1";
  rater: Rater;
  independentBlindGrade: true;
  packetHash: string;
  randomizedBatchHash: string;
  calibrationCommitmentHash: string;
  rubricHash: string;
  counts: { tasks: 384; grades: 384 };
  grades: CalibratedGrade[];
}

export interface ProgressArithmetic {
  denominator: number;
  legacyConsensusRows: number;
  recipeConsensusRows: number;
  legacyVotesPerCell: number;
  blockedCells: number;
}

export interface CalibratedReliabilityAssessment {
  status: "passed" | "failed";
  allThreeRatersValidAndComplete: boolean;
  hiddenDuplicateAgreementByRater: Record<
    Rater,
    { agreements: number; denominator: 128; ratio: number; passed: boolean }
  >;
  duplicatePassRateDifferenceByRater: Record<
    Rater,
    {
      copyAPasses: number;
      copyBPasses: number;
      percentagePointDifference: number;
      passed: boolean;
    }
  >;
  majorityDuplicateAgreement: {
    agreements: number;
    denominator: 128;
    ratio: number;
    mismatchedCells: string[];
    passed: boolean;
  };
  pairwise: Array<{
    raters: string;
    agreements: number;
    denominator: 384;
    ratio: number;
    passed: boolean;
  }>;
  fleissKappa: number;
  fleissKappaPassed: boolean;
  majorityFailureRows: number;
  majorityFailuresWithTwoConcreteRaters: number;
  majorityFailureDefectsPassed: boolean;
  progress: null | {
    arithmetic: ProgressArithmetic;
    exact128CellScoresAvailable: boolean;
    legacyPasses: number | null;
    recipePasses: number | null;
  };
}

const sha256 = (bytes: string | Buffer): string =>
  createHash("sha256").update(bytes).digest("hex");
const absolute = (file: string): string => path.join(REPO, file);
const fileHash = (file: string): string => sha256(readFileSync(absolute(file)));
const json = <T>(file: string): T =>
  JSON.parse(readFileSync(absolute(file), "utf8")) as T;
const jsonBytes = (value: unknown): string =>
  `${JSON.stringify(value, null, 2)}\n`;
const writeJson = (file: string, value: unknown): void =>
  writeFileSync(absolute(file), jsonBytes(value));
const byCell = (artifacts: Artifact[]): Map<string, Artifact> =>
  new Map(artifacts.map((artifact) => [artifact.cellKey, artifact]));
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
  keys: readonly string[],
  label: string,
): void => {
  check(
    JSON.stringify(Object.keys(value).sort()) ===
      JSON.stringify([...keys].sort()),
    `${label} fields differ`,
  );
};

const protocolBody = (): CalibrationProtocolBody => ({
  version: VERSION,
  lockedBeforeGrading: true,
  purpose:
    "Resolve whether the Input/Field recognisability instrument is stable within one calibrated blind batch; this protocol does not grade the packet.",
  evidenceDesign: {
    exactSourceCells: 128,
    correctedSpecimens: 128,
    unchangedControlCopyA: 128,
    unchangedControlCopyB: 128,
    totalSpecimens: 384,
    hiddenCopiesAreByteIdenticalPerCell: true,
    randomization:
      "One deterministic global pseudorandom permutation; each presentation has an unrelated opaque task, reference, specimen, filename, and non-adjacent same-cell position.",
  },
  rubric: {
    version: "input-field-observable-rubric-v1",
    evaluationOrder: [
      {
        category: "structural-completeness-state-correctness",
        observableCriteria: [
          "Compare visible parts first: input surface, label, content, required indicator, helper or error message, and expected adornment positions.",
          "The visible state must match the reference: default, focus, error, or disabled cues may not be missing, substituted, or added.",
          "A missing, extra, relocated, clipped, or wrong load-bearing part is observable structural failure.",
        ],
        failureRule:
          "Any load-bearing structure or state mismatch is fail and makes recognisable false; continue the remaining categories to record defects.",
      },
      {
        category: "geometry-proportions",
        observableCriteria: [
          "Compare total field width and height, surface height, internal padding, alignment, spacing, corner geometry, and relative proportions.",
          "A difference is material when it changes the component silhouette, spacing hierarchy, alignment, wrapping, or clipping; subpixel antialiasing alone is not material.",
        ],
        failureRule:
          "A material geometry or proportion mismatch makes recognisable false.",
      },
      {
        category: "label-helper-adornments",
        observableCriteria: [
          "Compare label placement and activation, helper versus error text, required marker, leading and trailing adornment presence, order, size, and spacing.",
          "Text wording that is visibly supplied by the paired reference must appear in the same semantic visual role.",
        ],
        failureRule:
          "Any missing or wrong role is structural fail; other material placement, scale, or spacing mismatch makes recognisable false.",
      },
      {
        category: "typography",
        observableCriteria: [
          "Compare visible family character, weight, size, line height, letter spacing, alignment, and emphasis hierarchy.",
          "Raster antialiasing or a subpixel edge difference with unchanged metrics and hierarchy is minor.",
        ],
        failureRule:
          "A material typography mismatch that changes metrics, hierarchy, wrapping, or alignment makes recognisable false.",
      },
      {
        category: "border-fill-focus-error-treatment",
        observableCriteria: [
          "Compare border width and style, fill and ink colors, opacity, disabled treatment, focus ring or shadow, and error treatment.",
          "State cues must be present only where the paired reference shows them and must use the same visible treatment class.",
        ],
        failureRule:
          "A missing, extra, or materially different border, fill, focus, disabled, or error treatment makes recognisable false.",
      },
    ],
    passRule:
      "recognisable=true if and only if structural-completeness-state-correctness is match and every later category is match or minor; any structural fail or material later-category verdict requires recognisable=false.",
    gradeSchemaRule:
      "Grade categories in the declared order. Every fail or material verdict requires a concrete visible defect in that category; top-level defects are the exact ordered concatenation of category defects.",
  },
  acceptance: {
    allThreeRatersValidAndComplete: true,
    hiddenDuplicateAgreementPerRaterMinimum: 0.95,
    majorityConsensusDuplicateAgreementMinimum: 127,
    majorityConsensusDuplicateAgreementDenominator: 128,
    duplicateMismatchBlocksAffectedCell: true,
    everyPairwiseAgreementMinimum: 0.75,
    fleissKappaMinimum: 0.6,
    maximumIdenticalCopyPassRateDifference: 0.05,
    majorityFailNeedsConcreteDefectsFromRaters: 2,
    failureConsequence:
      "If any acceptance condition fails, recognisability remains unusable, architecture progression remains blocked, and live Input/Field work stays blocked.",
  },
  progressArithmetic: {
    availableOnlyAfterReliabilityPasses: true,
    legacyCopiesCollapseToOneConsensusPerCell: true,
    legacyMayNeverBeDoubleWeighted: true,
    exactComparisonCells: 128,
    recipeConsensusPerCell: "two-of-three majority",
    legacyConsensusPerCell:
      "one collapsed result only when copy A and copy B majority consensus are identical",
    affectedDuplicateMismatchCell: "blocked",
    historicalResultsRemainHistory: true,
    calibratedConsensusSupersedesHistoryForProgressionOnlyIfThresholdsPass: true,
  },
  gradeOutputs: {
    "BATCH-CAL-A": CALIBRATION_GRADE_PATHS[0],
    "BATCH-CAL-B": CALIBRATION_GRADE_PATHS[1],
    "BATCH-CAL-C": CALIBRATION_GRADE_PATHS[2],
  },
});

const makeProtocol = (): CalibrationProtocol => {
  const body = protocolBody();
  return {
    ...body,
    commitmentHash: sha256(JSON.stringify(body)),
    rubricHash: sha256(JSON.stringify(body.rubric)),
  };
};

export function validatePredeclaredCalibrationProtocol(
  protocol: CalibrationProtocol,
  recordedCommitmentHash = protocol.commitmentHash,
): void {
  const expected = makeProtocol();
  check(
    JSON.stringify(protocol) === JSON.stringify(expected) &&
      protocol.commitmentHash === sha256(JSON.stringify(protocolBody())) &&
      protocol.rubricHash === sha256(JSON.stringify(protocol.rubric)) &&
      recordedCommitmentHash === protocol.commitmentHash,
    "pre-grading protocol, rubric, thresholds, or recorded commitment changed",
  );
}

const HISTORICAL_ARTIFACTS = [
  `${V1_ROOT}/index.json`,
  `${V1_ROOT}/receipt.json`,
  `${V1_ROOT}/blind-packet/packet.json`,
  `${V1_ROOT}/blind-packet/grades.json`,
  `${V1_ROOT}/sealed-answer-key.json`,
  `${V1_ROOT}/comparison-result.json`,
  `${V2_ROOT}/index.json`,
  `${V2_ROOT}/receipt.json`,
  `${V2_ROOT}/blind-packet/packet.json`,
  `${V2_ROOT}/blind-packet/grades.json`,
  `${V2_ROOT}/blind-packet/grades-rater-b.json`,
  `${V2_ROOT}/blind-packet/grades-rater-c.json`,
  `${V2_ROOT}/sealed-answer-key.json`,
  `${V2_ROOT}/comparison-result.json`,
  `${V2_ROOT}/multi-rater-adjudication.json`,
  `${V2_ROOT}/v1-root-cause.json`,
] as const;

const verifyIndexPins = (root: string): void => {
  const index = json<Record<string, unknown>>(`${root}/index.json`);
  for (const [pathField, hashField] of [
    ["receipt", "receiptHash"],
    ["packet", "packetHash"],
    ["grades", "gradesHash"],
    ["gradesRaterB", "gradesRaterBHash"],
    ["gradesRaterC", "gradesRaterCHash"],
    ["sealedAnswerKey", "sealedAnswerKeyHash"],
    ["comparisonResult", "comparisonResultHash"],
    ["multiRaterAdjudication", "multiRaterAdjudicationHash"],
  ] as const) {
    if (typeof index[pathField] === "string") {
      check(
        fileHash(index[pathField] as string) === index[hashField],
        `${root} ${pathField} hash differs`,
      );
    }
  }
};

const verifyHistoricalContinuity = (): {
  v1: EvidenceReceipt;
  v2: EvidenceReceipt;
  cells: Array<{
    cellKey: string;
    referenceHash: string;
    legacyHash: string;
    correctedV2Hash: string;
  }>;
  historicalArtifactHashes: Record<string, string>;
  sourceReferenceProvenanceHash: string;
} => {
  verifyIndexPins(V1_ROOT);
  verifyIndexPins(V2_ROOT);
  for (const artifact of HISTORICAL_ARTIFACTS) {
    JSON.parse(readFileSync(absolute(artifact), "utf8"));
  }
  const v1 = json<EvidenceReceipt>(`${V1_ROOT}/receipt.json`);
  const v2 = json<EvidenceReceipt>(`${V2_ROOT}/receipt.json`);
  const v1Adjudication = json<{ sourceReferences: unknown[] }>(
    `${V1_ROOT}/comparison-result.json`,
  );
  const v2Adjudication = json<{ sourceReferences: unknown[] }>(
    `${V2_ROOT}/comparison-result.json`,
  );
  check(
    v1Adjudication.sourceReferences.length === 128 &&
      JSON.stringify(v1Adjudication.sourceReferences) ===
        JSON.stringify(v2Adjudication.sourceReferences),
    "v1/v2 adjudicated source-reference provenance differs",
  );
  check(
    v1.matrix.sampleMatrixHash === v2.matrix.sampleMatrixHash &&
      JSON.stringify(v1.matrix.cells) === JSON.stringify(v2.matrix.cells) &&
      v1.matrix.cells.length === 128,
    "v1/v2 exact 128-cell matrix differs",
  );
  check(
    v1.provenance.sourceCommit === v2.provenance.sourceCommit &&
      (v1.provenance.fixtureHash ?? v1.provenance.comparisonFixtureHash) ===
        (v2.provenance.fixtureHash ?? v2.provenance.comparisonFixtureHash) &&
      v1.provenance.environmentHash === v2.provenance.environmentHash,
    "v1/v2 source, fixture, or environment pin differs",
  );
  check(
    v1.references.length === 128 &&
      v2.references.length === 128 &&
      v1.outputs.legacy.length === 128 &&
      v2.outputs.legacy.length === 128 &&
      v2.outputs.recipeReact?.length === 128,
    "historical artifact cardinality differs",
  );
  const v1References = byCell(v1.references);
  const v1Legacy = byCell(v1.outputs.legacy);
  const v2References = byCell(v2.references);
  const v2Legacy = byCell(v2.outputs.legacy);
  const v2Recipe = byCell(v2.outputs.recipeReact ?? []);
  const cells = v1.matrix.cells.map(({ key: cellKey }) => {
    const references = [v1References.get(cellKey), v2References.get(cellKey)];
    const legacy = [v1Legacy.get(cellKey), v2Legacy.get(cellKey)];
    const corrected = v2Recipe.get(cellKey);
    check(
      references.every(Boolean) && legacy.every(Boolean) && corrected,
      `${cellKey} is missing from historical evidence`,
    );
    for (const artifact of [...references, ...legacy, corrected]) {
      check(
        artifact && fileHash(artifact.file) === artifact.hash,
        `${cellKey} source artifact bytes differ`,
      );
    }
    check(
      references[0]!.hash === references[1]!.hash &&
        legacy[0]!.hash === legacy[1]!.hash,
      `${cellKey} v1/v2 reference or unchanged control hash differs`,
    );
    return {
      cellKey,
      referenceHash: references[0]!.hash,
      legacyHash: legacy[0]!.hash,
      correctedV2Hash: corrected.hash,
    };
  });
  const multi = json<{
    reliability: { status: string };
    agreement: {
      overallPairwisePercentAgreement: number;
      fleissKappa: number;
    };
    interBatchInstability: {
      unchangedInputs: {
        exactReferenceHashes: number;
        exactLegacyOutputHashes: number;
      };
      passCounts: { immutableV1: number; v2Consensus: number };
    };
    productVerdict: {
      liveInputMayProceed: boolean;
      inputOverall: boolean;
    };
  }>(`${V2_ROOT}/multi-rater-adjudication.json`);
  check(
    multi.reliability.status === "passed" &&
      multi.agreement.overallPairwisePercentAgreement === 0.924479166666667 &&
      multi.agreement.fleissKappa === 0.8428006775832869 &&
      multi.interBatchInstability.unchangedInputs.exactReferenceHashes ===
        128 &&
      multi.interBatchInstability.unchangedInputs.exactLegacyOutputHashes ===
        128 &&
      multi.interBatchInstability.passCounts.immutableV1 === 88 &&
      multi.interBatchInstability.passCounts.v2Consensus === 0 &&
      !multi.productVerdict.liveInputMayProceed &&
      !multi.productVerdict.inputOverall,
    "multi-rater reliability blocker differs",
  );
  return {
    v1,
    v2,
    cells,
    historicalArtifactHashes: Object.fromEntries(
      HISTORICAL_ARTIFACTS.map((artifact) => [artifact, fileHash(artifact)]),
    ),
    sourceReferenceProvenanceHash: sha256(
      JSON.stringify(v1Adjudication.sourceReferences),
    ),
  };
};

const packetBatchHash = (packet: Omit<BlindPacket, "randomizedBatchHash">) =>
  sha256(
    JSON.stringify({
      version: packet.version,
      calibrationCommitmentHash: packet.calibrationCommitmentHash,
      rubricHash: packet.rubricHash,
      tasks: packet.tasks.map((task) => ({
        taskId: task.taskId,
        referenceId: task.reference.referenceId,
        referenceImage: task.reference.image,
        specimenId: task.specimen.specimenId,
        specimenImage: task.specimen.image,
      })),
    }),
  );

const blindPath = (nextPath: string, root = NEXT_BLIND_ROOT): string =>
  `${root}/${nextPath}`;

const gradeTemplate = (): PacketTask["specimen"]["grade"] => ({
  recognisable: null,
  confidence: null,
  criteria: Object.fromEntries(
    CATEGORIES.map((category) => [category, null]),
  ) as Record<Category, null>,
  defects: [],
});

export async function buildCalibratedPacket(): Promise<void> {
  const history = verifyHistoricalContinuity();
  const protocol = makeProtocol();
  const v2References = byCell(history.v2.references);
  const v2Legacy = byCell(history.v2.outputs.legacy);
  const v2Recipe = byCell(history.v2.outputs.recipeReact ?? []);
  const seed = sha256(
    [
      VERSION,
      protocol.commitmentHash,
      history.v1.matrix.sampleMatrixHash,
      ...history.cells.flatMap((cell) => [
        cell.referenceHash,
        cell.legacyHash,
        cell.correctedV2Hash,
      ]),
    ].join("\0"),
  );
  const baseRows = history.cells.flatMap((cell) =>
    (
      [
        ["corrected-v2", v2Recipe.get(cell.cellKey)!],
        ["legacy-copy-a", v2Legacy.get(cell.cellKey)!],
        ["legacy-copy-b", v2Legacy.get(cell.cellKey)!],
      ] as const
    ).map(([implementationPath, artifact]) => ({
      cell,
      implementationPath,
      artifact,
      reference: v2References.get(cell.cellKey)!,
      taskId: `task-${sha256(
        `${seed}\0task\0${cell.cellKey}\0${implementationPath}`,
      ).slice(0, 16)}`,
      referenceId: `reference-${sha256(
        `${seed}\0reference\0${cell.cellKey}\0${implementationPath}`,
      ).slice(0, 16)}`,
      specimenId: `specimen-${sha256(
        `${seed}\0specimen\0${cell.cellKey}\0${implementationPath}`,
      ).slice(0, 16)}`,
    })),
  );
  let ordered = baseRows;
  let nonce = 0;
  for (; nonce < 10_000; nonce += 1) {
    ordered = [...baseRows].sort((left, right) =>
      sha256(
        `${seed}\0position\0${nonce}\0${left.cell.cellKey}\0${left.implementationPath}`,
      ).localeCompare(
        sha256(
          `${seed}\0position\0${nonce}\0${right.cell.cellKey}\0${right.implementationPath}`,
        ),
      ),
    );
    if (
      ordered.every(
        (row, index) =>
          index === 0 || ordered[index - 1]!.cell.cellKey !== row.cell.cellKey,
      )
    ) {
      break;
    }
  }
  check(nonce < 10_000, "could not produce non-adjacent global permutation");

  rmSync(absolute(NEXT_ROOT), { recursive: true, force: true });
  mkdirSync(absolute(`${NEXT_BLIND_ROOT}/references`), { recursive: true });
  mkdirSync(absolute(`${NEXT_BLIND_ROOT}/specimens`), { recursive: true });
  const answers: KeyAnswer[] = [];
  const tasks = ordered.map((row) => {
    const referenceImage = `references/${row.referenceId}.png`;
    const specimenImage = `specimens/${row.specimenId}.png`;
    copyFileSync(
      absolute(row.reference.file),
      absolute(blindPath(referenceImage)),
    );
    copyFileSync(
      absolute(row.artifact.file),
      absolute(blindPath(specimenImage)),
    );
    answers.push({
      taskId: row.taskId,
      referenceId: row.referenceId,
      specimenId: row.specimenId,
      implementationPath: row.implementationPath,
      cellKey: row.cell.cellKey,
      referenceHash: row.reference.hash,
      specimenHash: row.artifact.hash,
    });
    return {
      taskId: row.taskId,
      reference: { referenceId: row.referenceId, image: referenceImage },
      specimen: {
        specimenId: row.specimenId,
        image: specimenImage,
        grade: gradeTemplate(),
      },
    };
  });
  const packetWithoutHash: Omit<BlindPacket, "randomizedBatchHash"> = {
    version: VERSION,
    status: "awaiting-three-independent-blind-grades",
    calibrationCommitmentHash: protocol.commitmentHash,
    rubricHash: protocol.rubricHash,
    instructions: [
      "Use only this blind-packet directory. Do not inspect parent directories, source code, prior grades, or any answer key.",
      "Grade every task independently in packet order. Compare only that task's opaque specimen with its opaque paired reference.",
      "Apply the five observable rubric categories in order. Do not compare tasks with one another, rank outputs, infer identities, or change scope.",
      "Write one complete grade file to the exact path assigned by the coordinator; do not edit packet.json or any image.",
    ],
    rubric: protocol.rubric,
    gradeOutputSchema: {
      version: "input-field-calibrated-grade-v1",
      allowedConfidence: ["low", "medium", "high"],
      criterionVerdicts: {
        structural: ["match", "fail"],
        remaining: ["match", "minor", "material"],
      },
    },
    counts: {
      tasks: 384,
      referencePresentations: 384,
      specimenPresentations: 384,
    },
    tasks,
  };
  const packet: BlindPacket = {
    ...packetWithoutHash,
    randomizedBatchHash: packetBatchHash(packetWithoutHash),
  };
  writeFileSync(
    absolute(`${NEXT_BLIND_ROOT}/packet.json`),
    await format(JSON.stringify(packet), { parser: "json" }),
  );
  writeJson(`${NEXT_ROOT}/calibration-protocol.json`, protocol);
  const key: SealedKey = {
    version: VERSION,
    sealedFromBlindRaters: true,
    calibrationCommitmentHash: protocol.commitmentHash,
    randomizationSeedHash: sha256(`${seed}\0${nonce}`),
    randomizedBatchHash: packet.randomizedBatchHash,
    answers,
  };
  writeJson(`${NEXT_ROOT}/sealed-answer-key.json`, key);

  const answerByCell = new Map<
    string,
    Partial<Record<ImplementationPath, KeyAnswer>>
  >();
  for (const answer of answers) {
    const row = answerByCell.get(answer.cellKey) ?? {};
    row[answer.implementationPath] = answer;
    answerByCell.set(answer.cellKey, row);
  }
  const duplicateProof = history.cells.map(({ cellKey, legacyHash }) => {
    const row = answerByCell.get(cellKey)!;
    const left = row["legacy-copy-a"]!;
    const right = row["legacy-copy-b"]!;
    check(
      left.specimenHash === legacyHash &&
        right.specimenHash === legacyHash &&
        fileHash(blindPath(`specimens/${left.specimenId}.png`)) ===
          legacyHash &&
        fileHash(blindPath(`specimens/${right.specimenId}.png`)) === legacyHash,
      `${cellKey} hidden copies are not byte-identical`,
    );
    return {
      cellKey,
      copyASpecimenId: left.specimenId,
      copyAPath: `blind-packet/specimens/${left.specimenId}.png`,
      copyBSpecimenId: right.specimenId,
      copyBPath: `blind-packet/specimens/${right.specimenId}.png`,
      sha256: legacyHash,
      byteIdentical: true,
    };
  });
  const packetPath = `${NEXT_BLIND_ROOT}/packet.json`;
  const protocolPath = `${NEXT_ROOT}/calibration-protocol.json`;
  const keyPath = `${NEXT_ROOT}/sealed-answer-key.json`;
  const prompts = Object.fromEntries(
    RATERS.map((rater, index) => [
      rater,
      [
        `Act as independent blind rater ${rater}.`,
        `Open only ${CALIBRATION_PACKET_PATH} and image files beneath ${BLIND_ROOT}; do not inspect parent directories, source code, prior grades, or ${CALIBRATION_KEY_PATH}.`,
        "Grade all 384 tasks independently in exact packet order using the packet's deterministic five-category rubric and pass rule.",
        "Do not compare tasks, search for repeated images, infer identities, rank outputs, omit tasks, or alter packet artifacts.",
        `Write only ${CALIBRATION_GRADE_PATHS[index]} using the declared grade schema, packet hash, randomized batch hash, calibration commitment hash, rubric hash, exact task/reference/specimen IDs, and one complete grade per task.`,
        "Do not adjudicate or unseal any key.",
      ].join(" "),
    ]),
  );
  const receipt = {
    version: VERSION,
    status: {
      packetBuild: "complete",
      independentBlindGrades: "pending",
      reliability: "unmeasured",
      recognisability: "unusable-until-reliability-passes",
      architectureProgress: "blocked",
      liveInputMayProceed: false,
      inputOverall: false,
    },
    preservation: {
      priorArtifactsModified: false,
      historicalArtifactHashes: history.historicalArtifactHashes,
    },
    continuity: {
      exactMatrix: true,
      sampleMatrixHash: history.v1.matrix.sampleMatrixHash,
      sourceCommit: history.v1.provenance.sourceCommit,
      fixtureHash:
        history.v1.provenance.fixtureHash ??
        history.v1.provenance.comparisonFixtureHash,
      environmentHash: history.v1.provenance.environmentHash,
      referenceBytesEqualV1ToV2: 128,
      sourceReferenceProvenanceEqualV1ToV2: 128,
      sourceReferenceProvenanceHash: history.sourceReferenceProvenanceHash,
      legacyBytesEqualV1ToV2: 128,
      cells: history.cells,
    },
    calibratedBatch: {
      sourceCells: 128,
      uniqueOriginalSourceReferences: 128,
      referencePresentations: 384,
      correctedV2Specimens: 128,
      unchangedControlCopyA: 128,
      unchangedControlCopyB: 128,
      totalSpecimens: 384,
      duplicateProof,
      nonAdjacentSameCellPresentations: true,
      packetContainsIdentityOrDuplicateMetadata: false,
    },
    commitment: {
      protocol: CALIBRATION_PROTOCOL_PATH,
      protocolHash: fileHash(protocolPath),
      commitmentHash: protocol.commitmentHash,
      rubricHash: protocol.rubricHash,
      packet: CALIBRATION_PACKET_PATH,
      packetHash: fileHash(packetPath),
      randomizedBatchHash: packet.randomizedBatchHash,
      sealedAnswerKey: CALIBRATION_KEY_PATH,
      sealedAnswerKeyHash: fileHash(keyPath),
      lockedBeforeGrading: true,
      recognisabilityVerdictsAuthoredByBuilder: false,
    },
    predeclaredAcceptance: protocol.acceptance,
    progressArithmetic: protocol.progressArithmetic,
    independentRaters: RATERS.map((rater, index) => ({
      rater,
      status: "pending",
      allowedOutputPath: CALIBRATION_GRADE_PATHS[index],
      prompt: prompts[rater],
    })),
  };
  writeJson(`${NEXT_ROOT}/receipt.json`, receipt);
  const receiptPath = `${NEXT_ROOT}/receipt.json`;
  writeJson(`${NEXT_ROOT}/index.json`, {
    version: VERSION,
    archetype: "input / field",
    status: "calibrated-packet-sealed-ungraded-progress-blocked",
    overall: false,
    gradeWritten: false,
    liveInputMayProceed: false,
    protocol: CALIBRATION_PROTOCOL_PATH,
    protocolHash: fileHash(protocolPath),
    packet: CALIBRATION_PACKET_PATH,
    packetHash: fileHash(packetPath),
    sealedAnswerKey: CALIBRATION_KEY_PATH,
    sealedAnswerKeyHash: fileHash(keyPath),
    receipt: CALIBRATION_RECEIPT_PATH,
    receiptHash: fileHash(receiptPath),
    counts: {
      sourceCells: 128,
      uniqueOriginalSourceReferences: 128,
      referencePresentations: 384,
      specimens: 384,
      correctedV2: 128,
      unchangedControlCopyA: 128,
      unchangedControlCopyB: 128,
    },
    allowedGradeOutputs: [...CALIBRATION_GRADE_PATHS],
  });
  rmSync(absolute(ROOT), { recursive: true, force: true });
  renameSync(absolute(NEXT_ROOT), absolute(ROOT));
  validateCommittedCalibratedPacket();
}

const containedRegularFile = (
  relativeFile: string,
  directory: "references" | "specimens",
): string => {
  check(!path.isAbsolute(relativeFile), `${relativeFile} must be relative`);
  const root = absolute(`${BLIND_ROOT}/${directory}`);
  const candidate = path.resolve(absolute(BLIND_ROOT), relativeFile);
  const lexical = path.relative(root, candidate);
  check(
    lexical !== "" && !lexical.startsWith("..") && !path.isAbsolute(lexical),
    `${relativeFile} escapes ${directory}`,
  );
  const stat = lstatSync(candidate);
  check(
    stat.isFile() && !stat.isSymbolicLink(),
    `${relativeFile} is not a regular file`,
  );
  const resolved = path.relative(realpathSync(root), realpathSync(candidate));
  check(
    resolved !== "" && !resolved.startsWith("..") && !path.isAbsolute(resolved),
    `${relativeFile} resolves outside ${directory}`,
  );
  return candidate;
};

const validatePacketShape = (
  packet: BlindPacket,
  protocol: CalibrationProtocol,
): void => {
  exactKeys(
    packet as unknown as Record<string, unknown>,
    [
      "version",
      "status",
      "calibrationCommitmentHash",
      "rubricHash",
      "instructions",
      "rubric",
      "gradeOutputSchema",
      "randomizedBatchHash",
      "counts",
      "tasks",
    ],
    "packet",
  );
  check(
    packet.version === VERSION &&
      packet.status === "awaiting-three-independent-blind-grades" &&
      packet.calibrationCommitmentHash === protocol.commitmentHash &&
      packet.rubricHash === protocol.rubricHash &&
      JSON.stringify(packet.rubric) === JSON.stringify(protocol.rubric) &&
      JSON.stringify(packet.counts) ===
        JSON.stringify({
          tasks: 384,
          referencePresentations: 384,
          specimenPresentations: 384,
        }) &&
      packet.tasks.length === 384,
    "packet protocol or cardinality differs",
  );
  const packetWithoutHash = { ...packet } as Omit<
    BlindPacket,
    "randomizedBatchHash"
  > &
    Partial<Pick<BlindPacket, "randomizedBatchHash">>;
  delete packetWithoutHash.randomizedBatchHash;
  const taskIds = new Set<string>();
  const referenceIds = new Set<string>();
  const specimenIds = new Set<string>();
  for (const [index, task] of packet.tasks.entries()) {
    exactKeys(
      task as unknown as Record<string, unknown>,
      ["taskId", "reference", "specimen"],
      `task ${index}`,
    );
    exactKeys(
      task.reference as unknown as Record<string, unknown>,
      ["referenceId", "image"],
      `${task.taskId} reference`,
    );
    exactKeys(
      task.specimen as unknown as Record<string, unknown>,
      ["specimenId", "image", "grade"],
      `${task.taskId} specimen`,
    );
    const metadata = [
      task.taskId,
      task.reference.referenceId,
      task.reference.image,
      task.specimen.specimenId,
      task.specimen.image,
    ].join("\0");
    check(!IMPLEMENTATION_LEAK.test(metadata), `${task.taskId} metadata leaks`);
    check(
      /^task-[a-f0-9]{16}$/.test(task.taskId) &&
        /^reference-[a-f0-9]{16}$/.test(task.reference.referenceId) &&
        /^references\/reference-[a-f0-9]{16}\.png$/.test(
          task.reference.image,
        ) &&
        /^specimen-[a-f0-9]{16}$/.test(task.specimen.specimenId) &&
        /^specimens\/specimen-[a-f0-9]{16}\.png$/.test(task.specimen.image),
      `${task.taskId} metadata is not opaque`,
    );
    check(
      !taskIds.has(task.taskId) &&
        !referenceIds.has(task.reference.referenceId) &&
        !specimenIds.has(task.specimen.specimenId),
      `${task.taskId} identifiers are not globally unrelated`,
    );
    taskIds.add(task.taskId);
    referenceIds.add(task.reference.referenceId);
    specimenIds.add(task.specimen.specimenId);
    check(
      JSON.stringify(task.specimen.grade) === JSON.stringify(gradeTemplate()),
      `${task.taskId} packet contains a grade`,
    );
  }
  check(
    packet.randomizedBatchHash ===
      packetBatchHash(
        packetWithoutHash as Omit<BlindPacket, "randomizedBatchHash">,
      ),
    "randomized batch hash differs",
  );
};

export function validateCalibratedPacketDocument(
  packet: BlindPacket,
  protocol: CalibrationProtocol,
): void {
  validatePacketShape(packet, protocol);
}

export function assertHiddenDuplicateBytes(
  copyA: Buffer,
  copyB: Buffer,
  expectedHash: string,
): void {
  check(
    sha256(copyA) === expectedHash &&
      sha256(copyB) === expectedHash &&
      copyA.equals(copyB),
    "hidden control copies are not byte-identical",
  );
}

export function assertCompleteRaterSet(present: readonly string[]): void {
  check(
    present.length === 0 ||
      (present.length === 3 &&
        CALIBRATION_GRADE_PATHS.every((file) => present.includes(file))),
    "all three rater files are required together",
  );
}

export function validateCommittedCalibratedPacket(): void {
  const history = verifyHistoricalContinuity();
  const protocol = json<CalibrationProtocol>(CALIBRATION_PROTOCOL_PATH);
  validatePredeclaredCalibrationProtocol(protocol);
  const packet = json<BlindPacket>(CALIBRATION_PACKET_PATH);
  const key = json<SealedKey>(CALIBRATION_KEY_PATH);
  const receipt = json<Record<string, any>>(CALIBRATION_RECEIPT_PATH);
  const index = json<Record<string, any>>(CALIBRATION_INDEX_PATH);
  check(
    fileHash(index.protocol) === index.protocolHash &&
      fileHash(index.packet) === index.packetHash &&
      fileHash(index.sealedAnswerKey) === index.sealedAnswerKeyHash &&
      fileHash(index.receipt) === index.receiptHash,
    "index hash pin differs",
  );
  check(
    !index.overall &&
      !index.gradeWritten &&
      !index.liveInputMayProceed &&
      receipt.status.packetBuild === "complete" &&
      receipt.status.independentBlindGrades === "pending" &&
      receipt.status.architectureProgress === "blocked" &&
      !receipt.status.liveInputMayProceed &&
      !receipt.status.inputOverall,
    "ungraded false/blocker status differs",
  );
  check(
    fileHash(CALIBRATION_PROTOCOL_PATH) === receipt.commitment.protocolHash &&
      fileHash(CALIBRATION_PACKET_PATH) === receipt.commitment.packetHash &&
      fileHash(CALIBRATION_KEY_PATH) ===
        receipt.commitment.sealedAnswerKeyHash &&
      receipt.commitment.commitmentHash === protocol.commitmentHash &&
      receipt.commitment.rubricHash === protocol.rubricHash &&
      receipt.commitment.lockedBeforeGrading &&
      !receipt.commitment.recognisabilityVerdictsAuthoredByBuilder,
    "receipt commitment or packet/key hash differs",
  );
  check(
    JSON.stringify(receipt.predeclaredAcceptance) ===
      JSON.stringify(protocol.acceptance) &&
      JSON.stringify(receipt.progressArithmetic) ===
        JSON.stringify(protocol.progressArithmetic),
    "receipt thresholds or progress arithmetic differ",
  );
  validatePacketShape(packet, protocol);
  check(
    key.version === VERSION &&
      key.sealedFromBlindRaters &&
      key.calibrationCommitmentHash === protocol.commitmentHash &&
      key.randomizedBatchHash === packet.randomizedBatchHash &&
      key.answers.length === 384,
    "sealed key protocol or cardinality differs",
  );
  const taskById = new Map(packet.tasks.map((task) => [task.taskId, task]));
  const continuity = new Map(history.cells.map((cell) => [cell.cellKey, cell]));
  const counts: Record<ImplementationPath, number> = {
    "corrected-v2": 0,
    "legacy-copy-a": 0,
    "legacy-copy-b": 0,
  };
  const answersByCell = new Map<
    string,
    Partial<Record<ImplementationPath, KeyAnswer>>
  >();
  for (const answer of key.answers) {
    const task = taskById.get(answer.taskId);
    const cell = continuity.get(answer.cellKey);
    check(task && cell, `${answer.taskId} key mapping is foreign`);
    check(
      task.reference.referenceId === answer.referenceId &&
        task.specimen.specimenId === answer.specimenId,
      `${answer.taskId} key identifiers differ`,
    );
    const referenceFile = containedRegularFile(
      task.reference.image,
      "references",
    );
    const specimenFile = containedRegularFile(task.specimen.image, "specimens");
    check(
      sha256(readFileSync(referenceFile)) === answer.referenceHash &&
        answer.referenceHash === cell.referenceHash &&
        sha256(readFileSync(specimenFile)) === answer.specimenHash &&
        answer.specimenHash ===
          (answer.implementationPath === "corrected-v2"
            ? cell.correctedV2Hash
            : cell.legacyHash),
      `${answer.taskId} reference/specimen bytes or continuity differ`,
    );
    counts[answer.implementationPath] += 1;
    const row = answersByCell.get(answer.cellKey) ?? {};
    check(
      !row[answer.implementationPath],
      `${answer.cellKey} has duplicate key mapping`,
    );
    row[answer.implementationPath] = answer;
    answersByCell.set(answer.cellKey, row);
  }
  check(
    Object.values(counts).every((count) => count === 128) &&
      answersByCell.size === 128,
    "sealed key implementation cardinality differs",
  );
  for (const [cellKey, row] of answersByCell) {
    check(
      row["corrected-v2"] && row["legacy-copy-a"] && row["legacy-copy-b"],
      `${cellKey} hidden duplicate proof differs`,
    );
    const copyA = packet.tasks.find(
      (task) => task.taskId === row["legacy-copy-a"]!.taskId,
    )!;
    const copyB = packet.tasks.find(
      (task) => task.taskId === row["legacy-copy-b"]!.taskId,
    )!;
    assertHiddenDuplicateBytes(
      readFileSync(containedRegularFile(copyA.specimen.image, "specimens")),
      readFileSync(containedRegularFile(copyB.specimen.image, "specimens")),
      row["legacy-copy-a"]!.specimenHash,
    );
    const positions = [
      packet.tasks.findIndex(
        (task) => task.taskId === row["corrected-v2"]!.taskId,
      ),
      packet.tasks.findIndex(
        (task) => task.taskId === row["legacy-copy-a"]!.taskId,
      ),
      packet.tasks.findIndex(
        (task) => task.taskId === row["legacy-copy-b"]!.taskId,
      ),
    ].sort((left, right) => left - right);
    check(
      positions[1]! - positions[0]! > 1 && positions[2]! - positions[1]! > 1,
      `${cellKey} same-cell presentations are adjacent`,
    );
  }
  check(
    JSON.stringify(receipt.continuity.cells) ===
      JSON.stringify(history.cells) &&
      receipt.continuity.referenceBytesEqualV1ToV2 === 128 &&
      receipt.continuity.sourceReferenceProvenanceEqualV1ToV2 === 128 &&
      receipt.continuity.sourceReferenceProvenanceHash ===
        history.sourceReferenceProvenanceHash &&
      receipt.continuity.legacyBytesEqualV1ToV2 === 128 &&
      JSON.stringify(receipt.preservation.historicalArtifactHashes) ===
        JSON.stringify(history.historicalArtifactHashes) &&
      receipt.calibratedBatch.duplicateProof.length === 128 &&
      receipt.calibratedBatch.duplicateProof.every(
        (proof: { byteIdentical: boolean }) => proof.byteIdentical,
      ),
    "receipt continuity, history, or duplicate proof differs",
  );
  const gradeFilesPresent = CALIBRATION_GRADE_PATHS.filter((file) =>
    existsSync(absolute(file)),
  );
  assertCompleteRaterSet(gradeFilesPresent);
  if (gradeFilesPresent.length === 3) {
    for (const [index, file] of CALIBRATION_GRADE_PATHS.entries()) {
      validateCalibratedGradeBatch(
        packet,
        json<CalibratedGradeBatch>(file),
        RATERS[index]!,
        fileHash(CALIBRATION_PACKET_PATH),
      );
    }
  }
}

const concreteDefect = (defect: string): boolean =>
  typeof defect === "string" &&
  defect.trim().length >= 20 &&
  !IMPLEMENTATION_LEAK.test(defect);

export function validateCalibratedGradeBatch(
  packet: BlindPacket,
  batch: CalibratedGradeBatch,
  expectedRater: Rater,
  packetHash: string,
): void {
  check(
    batch.version === "input-field-calibrated-grade-v1" &&
      batch.rater === expectedRater &&
      batch.independentBlindGrade &&
      batch.packetHash === packetHash &&
      batch.randomizedBatchHash === packet.randomizedBatchHash &&
      batch.calibrationCommitmentHash === packet.calibrationCommitmentHash &&
      batch.rubricHash === packet.rubricHash &&
      batch.counts.tasks === 384 &&
      batch.counts.grades === 384 &&
      batch.grades.length === 384,
    `${expectedRater} grade protocol or cardinality differs`,
  );
  for (const [index, grade] of batch.grades.entries()) {
    const task = packet.tasks[index]!;
    check(
      grade.taskId === task.taskId &&
        grade.referenceId === task.reference.referenceId &&
        grade.specimenId === task.specimen.specimenId,
      `${expectedRater} grade order or identifiers differ`,
    );
    check(
      ["low", "medium", "high"].includes(grade.confidence) &&
        JSON.stringify(Object.keys(grade.criteria)) ===
          JSON.stringify(CATEGORIES),
      `${expectedRater} ${grade.taskId} confidence or criteria differ`,
    );
    const structural = grade.criteria[CATEGORIES[0]];
    check(
      structural &&
        ["match", "fail"].includes(structural.verdict) &&
        structural.defects.every(concreteDefect) &&
        (structural.verdict === "match" || structural.defects.length > 0),
      `${expectedRater} ${grade.taskId} structural grade is invalid`,
    );
    for (const category of MATERIAL_CATEGORIES) {
      const criterion = grade.criteria[category]!;
      check(
        ["match", "minor", "material"].includes(criterion.verdict) &&
          criterion.defects.every(concreteDefect) &&
          (criterion.verdict !== "material" || criterion.defects.length > 0),
        `${expectedRater} ${grade.taskId} ${category} grade is invalid`,
      );
    }
    const expectedRecognisable =
      structural.verdict === "match" &&
      MATERIAL_CATEGORIES.every(
        (category) => grade.criteria[category]!.verdict !== "material",
      );
    const flattened = CATEGORIES.flatMap(
      (category) => grade.criteria[category].defects,
    );
    check(
      grade.recognisable === expectedRecognisable &&
        JSON.stringify(grade.defects) === JSON.stringify(flattened),
      `${expectedRater} ${grade.taskId} pass rule or defect rollup differs`,
    );
  }
}

export function assessCalibratedReliability(
  packet: BlindPacket,
  key: SealedKey,
  batches: readonly CalibratedGradeBatch[],
  packetHash: string,
): CalibratedReliabilityAssessment {
  check(
    batches.length === 3 &&
      new Set(batches.map((batch) => batch.rater)).size === 3,
    "all three valid independent raters are required",
  );
  const byRater = new Map<Rater, CalibratedGradeBatch>();
  for (const rater of RATERS) {
    const batch = batches.find((candidate) => candidate.rater === rater);
    check(batch, `${rater} grade batch is missing`);
    validateCalibratedGradeBatch(packet, batch, rater, packetHash);
    byRater.set(rater, batch);
  }
  check(
    key.answers.length === 384 &&
      key.randomizedBatchHash === packet.randomizedBatchHash &&
      key.calibrationCommitmentHash === packet.calibrationCommitmentHash,
    "sealed mapping does not belong to the validated grade packet",
  );
  const answerByTask = new Map(
    key.answers.map((answer) => [answer.taskId, answer]),
  );
  check(answerByTask.size === 384, "sealed mapping is not bijective");
  const gradesByRater = Object.fromEntries(
    RATERS.map((rater) => [
      rater,
      new Map(
        byRater
          .get(rater)!
          .grades.map((grade) => [grade.taskId, grade] as const),
      ),
    ]),
  ) as Record<Rater, Map<string, CalibratedGrade>>;
  const majorityByTask = new Map<
    string,
    { recognisable: boolean; failureRatersWithDefects: number }
  >();
  for (const task of packet.tasks) {
    const grades = RATERS.map((rater) =>
      gradesByRater[rater].get(task.taskId)!,
    );
    const recognisable =
      grades.filter((grade) => grade.recognisable).length >= 2;
    majorityByTask.set(task.taskId, {
      recognisable,
      failureRatersWithDefects: grades.filter(
        (grade) => !grade.recognisable && grade.defects.length > 0,
      ).length,
    });
  }
  const pairwise = (
    [
      ["BATCH-CAL-A", "BATCH-CAL-B"],
      ["BATCH-CAL-A", "BATCH-CAL-C"],
      ["BATCH-CAL-B", "BATCH-CAL-C"],
    ] as const
  ).map(([left, right]) => {
    const agreements = packet.tasks.filter(
      (task) =>
        gradesByRater[left].get(task.taskId)!.recognisable ===
        gradesByRater[right].get(task.taskId)!.recognisable,
    ).length;
    return {
      raters: `${left}/${right}`,
      agreements,
      denominator: 384 as const,
      ratio: agreements / 384,
      passed: agreements / 384 >= 0.75,
    };
  });
  const observedPairwiseAgreement =
    packet.tasks.reduce((total, task) => {
      const passes = RATERS.filter(
        (rater) => gradesByRater[rater].get(task.taskId)!.recognisable,
      ).length;
      const failures = 3 - passes;
      return total + (passes * (passes - 1) + failures * (failures - 1)) / 6;
    }, 0) / 384;
  const passPrevalence =
    RATERS.reduce(
      (total, rater) =>
        total +
        byRater.get(rater)!.grades.filter((grade) => grade.recognisable).length,
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
  const answersByCell = new Map<
    string,
    Partial<Record<ImplementationPath, KeyAnswer>>
  >();
  for (const answer of key.answers) {
    const task = packet.tasks.find(
      (candidate) => candidate.taskId === answer.taskId,
    );
    check(
      task &&
        task.reference.referenceId === answer.referenceId &&
        task.specimen.specimenId === answer.specimenId,
      `${answer.taskId} sealed mapping identifiers differ`,
    );
    const row = answersByCell.get(answer.cellKey) ?? {};
    check(
      !row[answer.implementationPath],
      `${answer.cellKey} sealed mapping repeats a path`,
    );
    row[answer.implementationPath] = answer;
    answersByCell.set(answer.cellKey, row);
  }
  check(answersByCell.size === 128, "sealed mapping does not cover 128 cells");
  const hiddenDuplicateAgreementByRater = Object.fromEntries(
    RATERS.map((rater) => {
      const agreements = [...answersByCell.values()].filter((row) => {
        const copyA = row["legacy-copy-a"];
        const copyB = row["legacy-copy-b"];
        check(copyA && copyB, "a hidden-copy mapping is missing");
        return (
          gradesByRater[rater].get(copyA.taskId)!.recognisable ===
          gradesByRater[rater].get(copyB.taskId)!.recognisable
        );
      }).length;
      return [
        rater,
        {
          agreements,
          denominator: 128 as const,
          ratio: agreements / 128,
          passed: agreements / 128 >= 0.95,
        },
      ];
    }),
  ) as CalibratedReliabilityAssessment["hiddenDuplicateAgreementByRater"];
  const duplicatePassRateDifferenceByRater = Object.fromEntries(
    RATERS.map((rater) => {
      const rows = [...answersByCell.values()];
      const copyAPasses = rows.filter(
        (row) =>
          gradesByRater[rater].get(row["legacy-copy-a"]!.taskId)!.recognisable,
      ).length;
      const copyBPasses = rows.filter(
        (row) =>
          gradesByRater[rater].get(row["legacy-copy-b"]!.taskId)!.recognisable,
      ).length;
      const percentagePointDifference =
        Math.abs(copyAPasses - copyBPasses) / 128;
      return [
        rater,
        {
          copyAPasses,
          copyBPasses,
          percentagePointDifference,
          passed: percentagePointDifference <= 0.05,
        },
      ];
    }),
  ) as CalibratedReliabilityAssessment["duplicatePassRateDifferenceByRater"];
  const mismatchedCells = [...answersByCell.entries()]
    .filter(([, row]) => {
      const copyA = row["legacy-copy-a"];
      const copyB = row["legacy-copy-b"];
      check(copyA && copyB, "a hidden-copy mapping is missing");
      return (
        majorityByTask.get(copyA.taskId)!.recognisable !==
        majorityByTask.get(copyB.taskId)!.recognisable
      );
    })
    .map(([cellKey]) => cellKey);
  const duplicateAgreements = 128 - mismatchedCells.length;
  const majorityFailures = [...majorityByTask.values()].filter(
    (grade) => !grade.recognisable,
  );
  const majorityFailuresWithTwoConcreteRaters = majorityFailures.filter(
    (grade) => grade.failureRatersWithDefects >= 2,
  ).length;
  const status =
    Object.values(hiddenDuplicateAgreementByRater).every(
      (result) => result.passed,
    ) &&
    Object.values(duplicatePassRateDifferenceByRater).every(
      (result) => result.passed,
    ) &&
    duplicateAgreements >= 127 &&
    pairwise.every((result) => result.passed) &&
    fleissKappa >= 0.6 &&
    majorityFailuresWithTwoConcreteRaters === majorityFailures.length
      ? "passed"
      : "failed";
  const progressArithmetic: ProgressArithmetic = {
    denominator: 128,
    legacyConsensusRows: 128,
    recipeConsensusRows: 128,
    legacyVotesPerCell: 1,
    blockedCells: mismatchedCells.length,
  };
  validateProgressArithmetic(progressArithmetic);
  const exact128CellScoresAvailable =
    status === "passed" && mismatchedCells.length === 0;
  return {
    status,
    allThreeRatersValidAndComplete: true,
    hiddenDuplicateAgreementByRater,
    duplicatePassRateDifferenceByRater,
    majorityDuplicateAgreement: {
      agreements: duplicateAgreements,
      denominator: 128,
      ratio: duplicateAgreements / 128,
      mismatchedCells,
      passed: duplicateAgreements >= 127,
    },
    pairwise,
    fleissKappa,
    fleissKappaPassed: fleissKappa >= 0.6,
    majorityFailureRows: majorityFailures.length,
    majorityFailuresWithTwoConcreteRaters,
    majorityFailureDefectsPassed:
      majorityFailuresWithTwoConcreteRaters === majorityFailures.length,
    progress:
      status === "failed"
        ? null
        : {
            arithmetic: progressArithmetic,
            exact128CellScoresAvailable,
            legacyPasses: exact128CellScoresAvailable
              ? [...answersByCell.values()].filter(
                  (row) =>
                    majorityByTask.get(row["legacy-copy-a"]!.taskId)!
                      .recognisable,
                ).length
              : null,
            recipePasses: exact128CellScoresAvailable
              ? [...answersByCell.values()].filter(
                  (row) =>
                    majorityByTask.get(row["corrected-v2"]!.taskId)!
                      .recognisable,
                ).length
              : null,
          },
  };
}

export function validateProgressArithmetic(
  arithmetic: ProgressArithmetic,
): void {
  check(
    arithmetic.denominator === 128 &&
      arithmetic.legacyConsensusRows === 128 &&
      arithmetic.recipeConsensusRows === 128 &&
      arithmetic.legacyVotesPerCell === 1 &&
      Number.isInteger(arithmetic.blockedCells) &&
      arithmetic.blockedCells >= 0 &&
      arithmetic.blockedCells <= 128,
    "progress arithmetic double-weights legacy or changes the exact denominator",
  );
}

const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  if (process.argv.includes("--build")) {
    await buildCalibratedPacket();
  } else {
    validateCommittedCalibratedPacket();
  }
  const packetHash = fileHash(CALIBRATION_PACKET_PATH);
  console.log(
    `Input/Field calibrated packet: 128 corrected + 128 hidden control A + 128 hidden control B; sealed, ungraded, progress blocked; packet sha256=${packetHash}`,
  );
}
