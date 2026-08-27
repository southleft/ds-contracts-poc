import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  validatePinnedComparisonEvidence,
  type ComparisonOutputManifest,
  type PinnedComparisonFixture,
} from "./comparison.js";

const V1_ROOT = "recipe/evidence/button-comparison";
const V2_ROOT = "recipe/evidence/button-comparison-v2";
export const BUTTON_ADJUDICATION_PATH = `${V1_ROOT}/comparison-result.json`;
export const BUTTON_V2_ADJUDICATION_PATH = `${V2_ROOT}/comparison-result.json`;
const IMPLEMENTATIONS = ["legacy", "recipe-react"] as const;
const CONFIDENCES = ["low", "medium", "high"] as const;
const IMPLEMENTATION_IDENTITY =
  /\blegacy\b|\brecipe(?:[- /]?react)?\b|\bweb[ -]?component\b/i;
const IMPLEMENTATION_GUESS =
  /\blegacy\b|\brecipe(?:[- /]?react)?\b|\bweb[ -]?component\b|\bimplementation(?: path| guess)?\b|\bexpected[ -]?winner\b/i;

type Implementation = (typeof IMPLEMENTATIONS)[number];
type Confidence = (typeof CONFIDENCES)[number];

interface PacketSpecimen {
  anonymousLabel: string;
  image: string;
  outputHash: string;
  grade: {
    recognisable: null;
    defects: unknown[];
    confidence: null;
  };
}

interface BlindPacket {
  version: string;
  status: string;
  instructions: string[];
  protocol: PinnedComparisonFixture["protocol"];
  randomizedBatchHash: string;
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
  minorDifferences?: string[];
}

interface GradeBatch {
  protocolVersion: string;
  packetVersion?: string;
  counts: {
    references: number;
    specimens: number;
    graded: number;
    recognisable: number;
    notRecognisable: number;
  };
  grades: Grade[];
}

interface Answer {
  anonymousCell: string;
  anonymousLabel: string;
  implementationPath: Implementation;
  cellKey: string;
  outputHash: string;
}

interface AnswerKey {
  version: string;
  sealedFromBlindGrader: boolean;
  randomizationSeedHash: string;
  randomizedBatchHash: string;
  answers: Answer[];
}

interface ReceiptArtifact {
  cellKey: string;
  file: string;
  hash: string;
}

interface Receipt {
  version: number;
  status: {
    evidenceGeneration: string;
    independentBlindGrade: string;
    legacyRecognisability: string;
    recipeRecognisability: string;
    buttonSuccess: boolean;
  };
  matrix: {
    frozenBeforeRender: boolean;
    axesCompared: string[];
    variants: string[];
    states: string[];
    fixed: Record<string, string>;
    sharedCellsPerLibrary: number;
    libraries: number;
    totalSourceCells: number;
    cells: Array<{
      key: string;
      library: string;
      variant: string;
      state: string;
    }>;
    excludedByName: string[];
  };
  references: ReceiptArtifact[];
  outputs: {
    legacy: ReceiptArtifact[];
    recipeReact: ReceiptArtifact[];
    recipeWebComponent: ReceiptArtifact[];
  };
  comparisonPin: PinnedComparisonFixture;
  manifests: {
    legacy: ComparisonOutputManifest;
    recipeReact: ComparisonOutputManifest;
    recipeWebComponentParity: ComparisonOutputManifest;
  };
  counts: {
    sourceReferences: number;
    legacyOutputs: number;
    recipeReactOutputs: number;
    recipeWebComponentOutputs: number;
    blindSpecimens: number;
  };
  nonvisualEvidence: {
    setsCompared: number;
    cellsPerPath: number;
    variantsCompared: number;
    axesCompared: number;
    statesCompared: number;
    zeroPixelComparisons: number;
    provenanceFieldsComplete: boolean;
    usabilityFactsAvailableOffline: {
      legacy: Record<string, string>;
      recipe: Record<string, string>;
      finalUsabilityVerdict: string;
    };
  };
  blindPacket: {
    path: string;
    sealedAnswerKey: string;
    randomizedBatchHash: string;
    packetHash: string;
    recognisabilityVerdictsAuthoredByBuilder: boolean;
  };
}

export interface AdjudicationSourceBytes {
  packet: string;
  grades: string;
  key: string;
  receipt: string;
}

interface Score {
  numerator: number;
  denominator: number;
  ratio: number;
}

interface ConfidenceDistribution {
  low: number;
  medium: number;
  high: number;
  total: number;
}

interface UnsealedGrade extends Grade {
  anonymousCell: string;
  implementation: Implementation;
  cellKey: string;
  sourceLibrary: string;
  variant: string;
  state: string;
  outputHash: string;
  referenceHash: string;
}

interface AggregatePair {
  legacy: Score;
  recipeReact: Score;
}

export interface ButtonComparisonAdjudication {
  artifactVersion:
    "button-comparison-adjudication-v1" | "button-comparison-adjudication-v2";
  protocolVersions: {
    packet: string;
    grade: string;
    answerKey: string;
    evidenceReceipt: number;
  };
  inputHashes: {
    packet: string;
    grades: string;
    sealedAnswerKey: string;
    evidenceReceipt: string;
  };
  integrity: {
    status: "passed";
    checks: {
      packetAndKeySeparated: true;
      packetOpaque: true;
      graderImplementationGuessesAbsent: true;
      fileHashesMatch: true;
      cardinalityAndOrderMatch: true;
      exactlyOneGradePerSpecimen: true;
      everyFailureHasDefects: true;
      answerMappingBijective: true;
      referenceProvenanceIndependent: true;
      denominatorParity: true;
      zeroCountMeasurementsAbsent: true;
      webComponentSurfaceSeparated: true;
    };
  };
  sample: {
    complete: true;
    sourceLibraries: string[];
    axes: string[];
    variants: string[];
    states: string[];
    fixed: Record<string, string>;
    sourceCells: number;
    specimens: number;
    cellsPerImplementation: number;
    setsPerImplementation: number;
    setWeighting: string;
    cellWeighting: string;
    excludedByName: string[];
  };
  sourceReferences: Array<{
    cellKey: string;
    screenshotHash: string;
    sourceId: string;
    sourceVersionOrRevision: string;
    sourceHash: string;
    captureInputHash: string;
    independentHarness: true;
  }>;
  mapping: UnsealedGrade[];
  aggregates: {
    byImplementation: Record<
      "legacy" | "recipeReact",
      { cellWeighted: Score; setWeighted: Score }
    >;
    bySourceLibrary: Record<string, AggregatePair>;
    byVariant: Record<string, AggregatePair>;
    byState: Record<string, AggregatePair>;
    pairedCellOutcomes: {
      recipeBeatLegacy: number;
      tiedPass: number;
      tiedFail: number;
      legacyBeatRecipe: number;
      total: number;
    };
  };
  confidence: {
    overall: ConfidenceDistribution;
    byImplementation: Record<"legacy" | "recipeReact", ConfidenceDistribution>;
  };
  defects: {
    byImplementation: Record<
      "legacy" | "recipeReact",
      {
        failedSpecimens: number;
        statements: number;
        classes: Record<
          string,
          { failedSpecimens: number; statements: number }
        >;
      }
    >;
  };
  webComponentParity: {
    includedInBlindBatch: false;
    recognisability: "not-blind-graded";
    cells: number;
    nonZeroMeasurements: true;
  };
  structuralUsability: {
    offlineAssertions: {
      legacy: { passed: number; denominator: number };
      recipeReact: { passed: number; denominator: number };
    };
    usabilityImprovement: "not-established";
    structuralImprovement: "not-comparable-on-a-symmetric-denominator";
    recipeStructuralEvidence: {
      axesInFullRecipe: number;
      roles: string[];
      emittedCells: number;
    };
    pendingColumns: {
      liveFigma: "pending";
      fullUsability: "pending";
      fullFixedPoint: "pending";
    };
  };
  comparisonHistory?: {
    immutableV1: {
      adjudicationArtifact: string;
      adjudicationHash: string;
      referencesAndLegacyBytesRetained: true;
      legacyCellWeighted: Score;
      recipeReactCellWeighted: Score;
      recipeReactSetWeighted: Score;
    };
    correctedV2: {
      legacyCellWeighted: Score;
      recipeReactCellWeighted: Score;
      recipeReactSetWeighted: Score;
    };
  };
  evidenceColumns?: {
    offlineImplementation: "passed";
    pairedRecognisability: "passed";
    webComponentParity: "passed-ungraded-recognisability";
    liveFigma: "pending";
    usability: "pending";
    twoCycleLiveFixedPoint: "pending";
    overallSuccess: false;
  };
  verdict: {
    comparison: "recipe-underperformed" | "recipe-matched" | "recipe-beat";
    recipeMatchedOrBeatLegacy: boolean;
    cellDelta: number;
    setDelta: number;
    allCurrentlyApplicableOfflineCriteriaPass: boolean;
    offlineRecognisabilityCriterionMet?: boolean;
    buttonSuccess: false;
    blockers: string[];
    nextImplementationTask: string;
  };
}

const sha256 = (bytes: string | Buffer): string =>
  createHash("sha256").update(bytes).digest("hex");

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
  allowed: readonly string[],
  label: string,
): void => {
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  assert(extras.length === 0, `${label} contains forbidden fields ${extras}`);
};

const score = (values: readonly boolean[]): Score => {
  assert(values.length > 0, "aggregate denominator is zero");
  const numerator = values.filter(Boolean).length;
  return {
    numerator,
    denominator: values.length,
    ratio: numerator / values.length,
  };
};

const confidenceDistribution = (
  grades: readonly UnsealedGrade[],
): ConfidenceDistribution => ({
  low: grades.filter((grade) => grade.confidence === "low").length,
  medium: grades.filter((grade) => grade.confidence === "medium").length,
  high: grades.filter((grade) => grade.confidence === "high").length,
  total: grades.length,
});

const defectClasses = (defect: string): string[] => {
  const classes = new Set<string>();
  if (/focus|outline|ring|inset|state treatment|state-specific/i.test(defect)) {
    classes.add("focus-or-state-treatment");
  }
  if (/fill|colour|color|ink|blue|beige|white|navy/i.test(defect)) {
    classes.add("fill-or-color");
  }
  if (/label|weight|bold|font|text/i.test(defect)) {
    classes.add("typography");
  }
  if (
    /narrow|tall|round|corner|proportion|padding|silhouette|spacing/i.test(
      defect,
    )
  ) {
    classes.add("geometry");
  }
  if (/border/i.test(defect)) classes.add("border");
  if (classes.size === 0) classes.add("other");
  return [...classes].sort();
};

const v2DefectClasses = (defect: string): string[] => {
  const classes = new Set<string>();
  if (/focus|ring|inset|state treatment|state-specific/i.test(defect)) {
    classes.add("focus-or-state-treatment");
  }
  if (
    /fill|colour|color|ink|blue|beige|white|navy|black|gr[ae]y/i.test(defect)
  ) {
    classes.add("fill-or-color");
  }
  if (/label|bold|font|text/i.test(defect)) classes.add("typography");
  if (
    /narrow|tall|round|corner|proportion|padding|silhouette|spacing/i.test(
      defect,
    )
  ) {
    classes.add("geometry");
  }
  if (/border|stroke/i.test(defect)) classes.add("border");
  if (classes.size === 0) classes.add("other");
  return [...classes].sort();
};

const defectAggregate = (
  grades: readonly UnsealedGrade[],
  classify: (defect: string) => string[] = defectClasses,
): {
  failedSpecimens: number;
  statements: number;
  classes: Record<string, { failedSpecimens: number; statements: number }>;
} => {
  const failures = grades.filter((grade) => !grade.recognisable);
  const classes = new Map<
    string,
    { specimens: Set<string>; statements: number }
  >();
  for (const grade of failures) {
    for (const defect of grade.defects) {
      for (const defectClass of classify(defect)) {
        const entry = classes.get(defectClass) ?? {
          specimens: new Set<string>(),
          statements: 0,
        };
        entry.specimens.add(grade.specimenId);
        entry.statements += 1;
        classes.set(defectClass, entry);
      }
    }
  }
  return {
    failedSpecimens: failures.length,
    statements: failures.reduce(
      (total, grade) => total + grade.defects.length,
      0,
    ),
    classes: Object.fromEntries(
      [...classes.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, entry]) => [
          name,
          {
            failedSpecimens: entry.specimens.size,
            statements: entry.statements,
          },
        ]),
    ),
  };
};

const pairAggregate = (
  grades: readonly UnsealedGrade[],
  predicate: (grade: UnsealedGrade) => boolean,
): AggregatePair => ({
  legacy: score(
    grades
      .filter((grade) => grade.implementation === "legacy" && predicate(grade))
      .map((grade) => grade.recognisable),
  ),
  recipeReact: score(
    grades
      .filter(
        (grade) => grade.implementation === "recipe-react" && predicate(grade),
      )
      .map((grade) => grade.recognisable),
  ),
});

const groupedPairs = (
  values: readonly string[],
  grades: readonly UnsealedGrade[],
  field: "sourceLibrary" | "variant" | "state",
): Record<string, AggregatePair> =>
  Object.fromEntries(
    values.map((value) => [
      value,
      pairAggregate(grades, (grade) => grade[field] === value),
    ]),
  );

const assertArtifactHashes = (
  artifacts: readonly ReceiptArtifact[],
  expectedCount: number,
): void => {
  assert(artifacts.length === expectedCount, "artifact cardinality differs");
  for (const artifact of artifacts) {
    assert(
      sha256(readFileSync(artifact.file)) === artifact.hash,
      `${artifact.file} bytes differ from its receipt hash`,
    );
  }
};

export const readButtonAdjudicationSources = (): AdjudicationSourceBytes => ({
  packet: readFileSync(`${V1_ROOT}/blind-packet/packet.json`, "utf8"),
  grades: readFileSync(`${V1_ROOT}/blind-packet/grades.json`, "utf8"),
  key: readFileSync(`${V1_ROOT}/sealed-answer-key.json`, "utf8"),
  receipt: readFileSync(`${V1_ROOT}/receipt.json`, "utf8"),
});

export const readButtonV2AdjudicationSources = (): AdjudicationSourceBytes => ({
  packet: readFileSync(`${V2_ROOT}/blind-packet/packet.json`, "utf8"),
  grades: readFileSync(`${V2_ROOT}/blind-packet/grades.json`, "utf8"),
  key: readFileSync(`${V2_ROOT}/sealed-answer-key.json`, "utf8"),
  receipt: readFileSync(`${V2_ROOT}/receipt.json`, "utf8"),
});

interface AdjudicationConfiguration {
  root: typeof V1_ROOT | typeof V2_ROOT;
  artifactVersion: ButtonComparisonAdjudication["artifactVersion"];
  gradeProtocol: "independent-extension" | "packet-version";
}

function adjudicateConfiguredButtonComparison(
  sourceBytes: AdjudicationSourceBytes,
  configuration: AdjudicationConfiguration,
): ButtonComparisonAdjudication {
  const { root } = configuration;
  const packet = parse<BlindPacket>("blind packet", sourceBytes.packet);
  const gradeBatch = parse<GradeBatch>("grade batch", sourceBytes.grades);
  const answerKey = parse<AnswerKey>("sealed answer key", sourceBytes.key);
  const receipt = parse<Receipt>("comparison receipt", sourceBytes.receipt);

  assert(
    receipt.blindPacket.path !== receipt.blindPacket.sealedAnswerKey &&
      path.dirname(receipt.blindPacket.sealedAnswerKey) !==
        path.dirname(receipt.blindPacket.path),
    "packet/key separation is not structurally intact",
  );
  assert(
    receipt.blindPacket.path === `${root}/blind-packet/packet.json` &&
      receipt.blindPacket.sealedAnswerKey === `${root}/sealed-answer-key.json`,
    "packet/key paths differ from the sealed protocol",
  );
  assert(
    !IMPLEMENTATION_IDENTITY.test(sourceBytes.packet),
    "blind packet discloses implementation identity",
  );
  assert(
    !IMPLEMENTATION_GUESS.test(sourceBytes.grades),
    "grader included an implementation guess",
  );
  assert(
    sha256(sourceBytes.packet) === receipt.blindPacket.packetHash,
    "packet bytes differ from the receipt hash",
  );
  assert(
    packet.version === receipt.comparisonPin.protocol.version &&
      (gradeBatch.packetVersion === undefined ||
        gradeBatch.packetVersion === packet.version) &&
      answerKey.version === packet.version,
    "packet, grade, key, and pin protocol versions differ",
  );
  if (configuration.gradeProtocol === "independent-extension") {
    assert(
      gradeBatch.packetVersion === packet.version &&
        gradeBatch.protocolVersion.startsWith(`${packet.version}-`) &&
        gradeBatch.protocolVersion.endsWith("-independent-grade-v1"),
      "grade protocol version is not an independent extension of the packet",
    );
  } else {
    assert(
      gradeBatch.protocolVersion === packet.version,
      "grade protocol version differs from the packet protocol",
    );
  }
  assert(
    packet.randomizedBatchHash === answerKey.randomizedBatchHash &&
      packet.randomizedBatchHash === receipt.blindPacket.randomizedBatchHash,
    "randomized batch hashes differ",
  );
  assert(
    answerKey.sealedFromBlindGrader === true,
    "answer key was not sealed from the blind grader",
  );
  assert(
    packet.status === "awaiting-independent-blind-grade" &&
      packet.cells.length === 12,
    "packet status or cell cardinality differs",
  );
  assert(
    receipt.status.evidenceGeneration === "complete" &&
      receipt.status.buttonSuccess === false &&
      receipt.matrix.frozenBeforeRender === true,
    "evidence receipt is not a frozen unsuccessful pre-grade record",
  );
  assert(
    receipt.blindPacket.recognisabilityVerdictsAuthoredByBuilder === false,
    "builder-authored recognisability is forbidden",
  );

  validatePinnedComparisonEvidence(
    receipt.comparisonPin,
    receipt.manifests.legacy,
    receipt.manifests.recipeReact,
  );
  validatePinnedComparisonEvidence(
    receipt.comparisonPin,
    receipt.manifests.legacy,
    receipt.manifests.recipeWebComponentParity,
  );

  const cellKeys = receipt.comparisonPin.cellKeys;
  assert(
    cellKeys.length === 12 &&
      receipt.matrix.totalSourceCells === cellKeys.length &&
      receipt.matrix.cells.map((cell) => cell.key).join("\0") ===
        cellKeys.join("\0"),
    "matrix cardinality or order differs from the pin",
  );
  assert(
    receipt.counts.sourceReferences === 12 &&
      receipt.counts.legacyOutputs === 12 &&
      receipt.counts.recipeReactOutputs === 12 &&
      receipt.counts.recipeWebComponentOutputs === 12 &&
      receipt.counts.blindSpecimens === 24,
    "receipt cardinality differs from the 12×2 blind protocol",
  );
  assert(
    receipt.nonvisualEvidence.zeroPixelComparisons === 0 &&
      receipt.nonvisualEvidence.provenanceFieldsComplete === true,
    "zero-count measurement or incomplete provenance is present",
  );
  for (const manifest of Object.values(receipt.manifests)) {
    assert(
      manifest.cells.length === 12 &&
        manifest.cells.every(
          (cell) =>
            Number.isSafeInteger(cell.comparedPixels) &&
            cell.comparedPixels > 0,
        ),
      "manifest has denominator drift or a zero-count measurement",
    );
  }

  assertArtifactHashes(receipt.references, 12);
  assertArtifactHashes(receipt.outputs.legacy, 12);
  assertArtifactHashes(receipt.outputs.recipeReact, 12);
  assertArtifactHashes(receipt.outputs.recipeWebComponent, 12);

  const packetSpecimens = packet.cells.flatMap((cell) =>
    cell.specimens.map((specimen) => ({
      anonymousCell: cell.anonymousCell,
      referenceHash: cell.reference.screenshotHash,
      referenceImage: cell.reference.image,
      specimen,
    })),
  );
  const packetOrder = packetSpecimens.map(
    ({ specimen }) => specimen.anonymousLabel,
  );
  assert(
    new Set(packet.cells.map((cell) => cell.anonymousCell)).size === 12 &&
      new Set(packetOrder).size === 24,
    "packet contains duplicate cell or specimen identifiers",
  );
  for (const cell of packet.cells) {
    assert(
      cell.specimens.length === 2 &&
        cell.specimens.every(
          (specimen) =>
            specimen.grade.recognisable === null &&
            specimen.grade.confidence === null &&
            specimen.grade.defects.length === 0,
        ),
      `${cell.anonymousCell} is not an ungraded two-specimen cell`,
    );
    assert(
      sha256(
        readFileSync(path.join(`${root}/blind-packet`, cell.reference.image)),
      ) === cell.reference.screenshotHash,
      `${cell.anonymousCell} reference bytes differ`,
    );
    for (const specimen of cell.specimens) {
      assert(
        sha256(
          readFileSync(path.join(`${root}/blind-packet`, specimen.image)),
        ) === specimen.outputHash,
        `${specimen.anonymousLabel} bytes differ`,
      );
    }
  }

  assert(
    answerKey.answers.length === 24 &&
      answerKey.answers.map((answer) => answer.anonymousLabel).join("\0") ===
        packetOrder.join("\0"),
    "answer key cardinality/order differs from the packet",
  );
  assert(
    gradeBatch.grades.length === 24 &&
      gradeBatch.grades.map((grade) => grade.specimenId).join("\0") ===
        packetOrder.join("\0"),
    "grade cardinality/order differs from the packet",
  );
  assert(
    new Set(answerKey.answers.map((answer) => answer.anonymousLabel)).size ===
      24,
    "answer key has duplicate or missing mapping",
  );
  assert(
    new Set(gradeBatch.grades.map((grade) => grade.specimenId)).size === 24,
    "grades do not contain exactly one grade per specimen",
  );

  const gradeAllowed = [
    "specimenId",
    "referenceId",
    "recognisable",
    "confidence",
    "defects",
    "minorDifferences",
  ];
  for (const grade of gradeBatch.grades) {
    exactKeys(
      grade as unknown as Record<string, unknown>,
      gradeAllowed,
      grade.specimenId,
    );
    assert(
      typeof grade.recognisable === "boolean" &&
        CONFIDENCES.includes(grade.confidence) &&
        Array.isArray(grade.defects) &&
        grade.defects.every(
          (defect) =>
            typeof defect === "string" &&
            defect.length > 0 &&
            !IMPLEMENTATION_GUESS.test(defect),
        ),
      `${grade.specimenId} grade fields are invalid`,
    );
    assert(
      grade.recognisable || grade.defects.length > 0,
      `${grade.specimenId} failure has no defects`,
    );
    assert(
      !grade.minorDifferences ||
        grade.minorDifferences.every(
          (difference) =>
            typeof difference === "string" &&
            difference.length > 0 &&
            !IMPLEMENTATION_GUESS.test(difference),
        ),
      `${grade.specimenId} minor differences contain an implementation guess`,
    );
  }

  const calculatedRecognisable = gradeBatch.grades.filter(
    (grade) => grade.recognisable,
  ).length;
  assert(
    gradeBatch.counts.references === 12 &&
      gradeBatch.counts.specimens === 24 &&
      gradeBatch.counts.graded === 24 &&
      gradeBatch.counts.recognisable === calculatedRecognisable &&
      gradeBatch.counts.notRecognisable === 24 - calculatedRecognisable,
    "grade count arithmetic is impossible",
  );

  const packetBySpecimen = new Map(
    packetSpecimens.map((entry) => [entry.specimen.anonymousLabel, entry]),
  );
  const gradeBySpecimen = new Map(
    gradeBatch.grades.map((grade) => [grade.specimenId, grade]),
  );
  const matrixByCell = new Map(
    receipt.matrix.cells.map((cell) => [cell.key, cell]),
  );
  const manifestByImplementation = {
    legacy: new Map(
      receipt.manifests.legacy.cells.map((cell) => [cell.cellKey, cell]),
    ),
    "recipe-react": new Map(
      receipt.manifests.recipeReact.cells.map((cell) => [cell.cellKey, cell]),
    ),
  };

  const pathCountsByCell = new Map<string, Set<Implementation>>();
  const mapping: UnsealedGrade[] = answerKey.answers.map((answer) => {
    const packetEntry = packetBySpecimen.get(answer.anonymousLabel);
    const grade = gradeBySpecimen.get(answer.anonymousLabel);
    const matrixCell = matrixByCell.get(answer.cellKey);
    const manifestCell = manifestByImplementation[
      answer.implementationPath
    ].get(answer.cellKey);
    assert(
      packetEntry && grade && matrixCell && manifestCell,
      "answer mapping is incomplete",
    );
    assert(
      packetEntry.anonymousCell === answer.anonymousCell &&
        grade.referenceId === answer.anonymousCell &&
        packetEntry.specimen.outputHash === answer.outputHash &&
        manifestCell.outputHash === answer.outputHash &&
        manifestCell.referenceHash === packetEntry.referenceHash &&
        receipt.comparisonPin.referenceHashes[answer.cellKey] ===
          packetEntry.referenceHash,
      `${answer.anonymousLabel} mapping differs across packet/key/receipt/grade`,
    );
    const paths = pathCountsByCell.get(answer.cellKey) ?? new Set();
    paths.add(answer.implementationPath);
    pathCountsByCell.set(answer.cellKey, paths);
    return {
      ...grade,
      anonymousCell: answer.anonymousCell,
      implementation: answer.implementationPath,
      cellKey: answer.cellKey,
      sourceLibrary: matrixCell.library,
      variant: matrixCell.variant,
      state: matrixCell.state,
      outputHash: answer.outputHash,
      referenceHash: packetEntry.referenceHash,
    };
  });
  assert(
    pathCountsByCell.size === 12 &&
      [...pathCountsByCell.values()].every(
        (paths) =>
          paths.size === 2 &&
          IMPLEMENTATIONS.every((implementation) => paths.has(implementation)),
      ),
    "duplicate/missing implementation mapping in a paired cell",
  );

  const legacy = mapping.filter((grade) => grade.implementation === "legacy");
  const recipeReact = mapping.filter(
    (grade) => grade.implementation === "recipe-react",
  );
  assert(
    legacy.length === 12 && recipeReact.length === 12,
    "implementation denominators differ",
  );
  const libraries = [
    ...new Set(receipt.matrix.cells.map((cell) => cell.library)),
  ];
  const setScore = (grades: readonly UnsealedGrade[]): Score =>
    score(
      libraries.map((library) => {
        const setGrades = grades.filter(
          (grade) => grade.sourceLibrary === library,
        );
        assert(
          setGrades.length === receipt.matrix.sharedCellsPerLibrary,
          `${library} set denominator differs`,
        );
        return setGrades.every((grade) => grade.recognisable);
      }),
    );
  const legacyCellScore = score(legacy.map((grade) => grade.recognisable));
  const recipeCellScore = score(recipeReact.map((grade) => grade.recognisable));
  const legacySetScore = setScore(legacy);
  const recipeSetScore = setScore(recipeReact);

  const pairedCellOutcomes = {
    recipeBeatLegacy: 0,
    tiedPass: 0,
    tiedFail: 0,
    legacyBeatRecipe: 0,
    total: 12,
  };
  for (const cellKey of cellKeys) {
    const legacyGrade = legacy.find((grade) => grade.cellKey === cellKey)!;
    const recipeGrade = recipeReact.find((grade) => grade.cellKey === cellKey)!;
    if (recipeGrade.recognisable && !legacyGrade.recognisable) {
      pairedCellOutcomes.recipeBeatLegacy += 1;
    } else if (recipeGrade.recognisable && legacyGrade.recognisable) {
      pairedCellOutcomes.tiedPass += 1;
    } else if (!recipeGrade.recognisable && !legacyGrade.recognisable) {
      pairedCellOutcomes.tiedFail += 1;
    } else {
      pairedCellOutcomes.legacyBeatRecipe += 1;
    }
  }

  const recipeMatchedOrBeatLegacy =
    recipeCellScore.ratio >= legacyCellScore.ratio &&
    recipeSetScore.ratio >= legacySetScore.ratio;
  const comparison =
    recipeCellScore.ratio > legacyCellScore.ratio
      ? "recipe-beat"
      : recipeCellScore.ratio === legacyCellScore.ratio
        ? "recipe-matched"
        : "recipe-underperformed";
  const isV2 = configuration.root === V2_ROOT;
  const blockers = isV2
    ? [
        "page-scoped live Figma mint/readback is pending",
        "full usability grading is pending",
        "two-cycle live fixed-point evidence is pending",
      ]
    : [
        ...(recipeMatchedOrBeatLegacy
          ? []
          : [
              `recipe React recognisability ${recipeCellScore.numerator}/${recipeCellScore.denominator} is below legacy ${legacyCellScore.numerator}/${legacyCellScore.denominator}`,
            ]),
        "strict structural/usability improvement is not established on a symmetric denominator",
      ];

  let comparisonHistory:
    NonNullable<ButtonComparisonAdjudication["comparisonHistory"]> | undefined;
  if (isV2) {
    const v1SourceBytes = readButtonAdjudicationSources();
    const v1ArtifactBytes = readFileSync(BUTTON_ADJUDICATION_PATH, "utf8");
    const v1Artifact = validateCommittedButtonAdjudication(
      parse<ButtonComparisonAdjudication>(
        "immutable v1 adjudication",
        v1ArtifactBytes,
      ),
      v1SourceBytes,
    );
    const v1Receipt = parse<Receipt>(
      "immutable v1 comparison receipt",
      v1SourceBytes.receipt,
    );
    const sameArtifactHashes = (
      left: readonly ReceiptArtifact[],
      right: readonly ReceiptArtifact[],
    ): boolean =>
      left.length === right.length &&
      left.every(
        (artifact, index) =>
          artifact.cellKey === right[index]?.cellKey &&
          artifact.hash === right[index]?.hash,
      );
    assert(
      receipt.matrix.cells.map((cell) => cell.key).join("\0") ===
        v1Receipt.matrix.cells.map((cell) => cell.key).join("\0") &&
        receipt.comparisonPin.sampleMatrixHash ===
          v1Receipt.comparisonPin.sampleMatrixHash &&
        sameArtifactHashes(receipt.references, v1Receipt.references) &&
        sameArtifactHashes(receipt.outputs.legacy, v1Receipt.outputs.legacy),
      "v2 matrix, source references, or legacy bytes differ from immutable v1",
    );
    assert(
      v1Artifact.aggregates.byImplementation.legacy.cellWeighted.numerator ===
        9 &&
        v1Artifact.aggregates.byImplementation.recipeReact.cellWeighted
          .numerator === 0,
      "immutable v1 adjudication no longer records legacy 9/12 and recipe React 0/12",
    );
    comparisonHistory = {
      immutableV1: {
        adjudicationArtifact: BUTTON_ADJUDICATION_PATH,
        adjudicationHash: sha256(v1ArtifactBytes),
        referencesAndLegacyBytesRetained: true,
        legacyCellWeighted:
          v1Artifact.aggregates.byImplementation.legacy.cellWeighted,
        recipeReactCellWeighted:
          v1Artifact.aggregates.byImplementation.recipeReact.cellWeighted,
        recipeReactSetWeighted:
          v1Artifact.aggregates.byImplementation.recipeReact.setWeighted,
      },
      correctedV2: {
        legacyCellWeighted: legacyCellScore,
        recipeReactCellWeighted: recipeCellScore,
        recipeReactSetWeighted: recipeSetScore,
      },
    };
  }

  return {
    artifactVersion: configuration.artifactVersion,
    protocolVersions: {
      packet: packet.version,
      grade: gradeBatch.protocolVersion,
      answerKey: answerKey.version,
      evidenceReceipt: receipt.version,
    },
    inputHashes: {
      packet: sha256(sourceBytes.packet),
      grades: sha256(sourceBytes.grades),
      sealedAnswerKey: sha256(sourceBytes.key),
      evidenceReceipt: sha256(sourceBytes.receipt),
    },
    integrity: {
      status: "passed",
      checks: {
        packetAndKeySeparated: true,
        packetOpaque: true,
        graderImplementationGuessesAbsent: true,
        fileHashesMatch: true,
        cardinalityAndOrderMatch: true,
        exactlyOneGradePerSpecimen: true,
        everyFailureHasDefects: true,
        answerMappingBijective: true,
        referenceProvenanceIndependent: true,
        denominatorParity: true,
        zeroCountMeasurementsAbsent: true,
        webComponentSurfaceSeparated: true,
      },
    },
    sample: {
      complete: true,
      sourceLibraries: libraries,
      axes: receipt.matrix.axesCompared,
      variants: receipt.matrix.variants,
      states: receipt.matrix.states,
      fixed: receipt.matrix.fixed,
      sourceCells: 12,
      specimens: 24,
      cellsPerImplementation: 12,
      setsPerImplementation: libraries.length,
      setWeighting:
        "a source-library set passes only when all 6 sampled cells are recognisable",
      cellWeighting:
        "each of the 12 exact source-library×variant×state cells has equal weight",
      excludedByName: receipt.matrix.excludedByName,
    },
    sourceReferences: cellKeys.map((cellKey) => {
      const provenance = receipt.comparisonPin.referenceProvenance[cellKey]!;
      return {
        cellKey,
        screenshotHash: receipt.comparisonPin.referenceHashes[cellKey]!,
        sourceId: provenance.sourceId,
        sourceVersionOrRevision: provenance.sourceVersionOrRevision,
        sourceHash: provenance.sourceHash,
        captureInputHash: provenance.captureInputHash,
        independentHarness: true,
      };
    }),
    mapping,
    aggregates: {
      byImplementation: {
        legacy: {
          cellWeighted: legacyCellScore,
          setWeighted: legacySetScore,
        },
        recipeReact: {
          cellWeighted: recipeCellScore,
          setWeighted: recipeSetScore,
        },
      },
      bySourceLibrary: groupedPairs(libraries, mapping, "sourceLibrary"),
      byVariant: groupedPairs(receipt.matrix.variants, mapping, "variant"),
      byState: groupedPairs(receipt.matrix.states, mapping, "state"),
      pairedCellOutcomes,
    },
    confidence: {
      overall: confidenceDistribution(mapping),
      byImplementation: {
        legacy: confidenceDistribution(legacy),
        recipeReact: confidenceDistribution(recipeReact),
      },
    },
    defects: {
      byImplementation: {
        legacy: defectAggregate(legacy, isV2 ? v2DefectClasses : defectClasses),
        recipeReact: defectAggregate(
          recipeReact,
          isV2 ? v2DefectClasses : defectClasses,
        ),
      },
    },
    webComponentParity: {
      includedInBlindBatch: false,
      recognisability: "not-blind-graded",
      cells: receipt.manifests.recipeWebComponentParity.cells.length,
      nonZeroMeasurements: true,
    },
    structuralUsability: {
      offlineAssertions: {
        legacy: {
          passed: Object.keys(
            receipt.nonvisualEvidence.usabilityFactsAvailableOffline.legacy,
          ).length,
          denominator: 4,
        },
        recipeReact: {
          passed: Object.keys(
            receipt.nonvisualEvidence.usabilityFactsAvailableOffline.recipe,
          ).length,
          denominator: 4,
        },
      },
      usabilityImprovement: "not-established",
      structuralImprovement: "not-comparable-on-a-symmetric-denominator",
      recipeStructuralEvidence: {
        axesInFullRecipe: 4,
        roles: [
          "button/root",
          "button/label",
          "button/slot/leading",
          "button/slot/trailing",
          "button/loading-indicator",
        ],
        emittedCells: 288,
      },
      pendingColumns: {
        liveFigma: "pending",
        fullUsability: "pending",
        fullFixedPoint: "pending",
      },
    },
    ...(comparisonHistory ? { comparisonHistory } : {}),
    ...(isV2
      ? {
          evidenceColumns: {
            offlineImplementation: "passed" as const,
            pairedRecognisability: "passed" as const,
            webComponentParity: "passed-ungraded-recognisability" as const,
            liveFigma: "pending" as const,
            usability: "pending" as const,
            twoCycleLiveFixedPoint: "pending" as const,
            overallSuccess: false as const,
          },
        }
      : {}),
    verdict: {
      comparison,
      recipeMatchedOrBeatLegacy,
      cellDelta: recipeCellScore.numerator - legacyCellScore.numerator,
      setDelta: recipeSetScore.numerator - legacySetScore.numerator,
      allCurrentlyApplicableOfflineCriteriaPass:
        recipeMatchedOrBeatLegacy && (isV2 || blockers.length === 0),
      ...(isV2
        ? { offlineRecognisabilityCriterionMet: recipeMatchedOrBeatLegacy }
        : {}),
      buttonSuccess: false,
      blockers,
      nextImplementationTask: isV2
        ? "Run page-scoped live Figma mint/readback/usability using only Scratch Project."
        : "Correct recipe Button source-adapter token/geometry/state mapping (especially library-specific visual tokens without branching the archetype recipe), then regenerate a new sealed batch and obtain a fresh independent blind grade.",
    },
  };
}

export function adjudicateButtonComparison(
  sourceBytes: AdjudicationSourceBytes,
): ButtonComparisonAdjudication {
  return adjudicateConfiguredButtonComparison(sourceBytes, {
    root: V1_ROOT,
    artifactVersion: "button-comparison-adjudication-v1",
    gradeProtocol: "independent-extension",
  });
}

export function adjudicateButtonV2Comparison(
  sourceBytes: AdjudicationSourceBytes,
): ButtonComparisonAdjudication {
  return adjudicateConfiguredButtonComparison(sourceBytes, {
    root: V2_ROOT,
    artifactVersion: "button-comparison-adjudication-v2",
    gradeProtocol: "packet-version",
  });
}

export function validateCommittedButtonAdjudication(
  artifact: ButtonComparisonAdjudication,
  sourceBytes: AdjudicationSourceBytes = readButtonAdjudicationSources(),
): ButtonComparisonAdjudication {
  const hashes = {
    packet: sha256(sourceBytes.packet),
    grades: sha256(sourceBytes.grades),
    sealedAnswerKey: sha256(sourceBytes.key),
    evidenceReceipt: sha256(sourceBytes.receipt),
  };
  assert(
    JSON.stringify(artifact.inputHashes) === JSON.stringify(hashes),
    "adjudication is stale: packet/grade/key/receipt bytes changed",
  );
  const recomputed = adjudicateButtonComparison(sourceBytes);
  assert(
    JSON.stringify(artifact) === JSON.stringify(recomputed),
    "adjudication mapping or aggregate arithmetic differs from recomputation",
  );
  return recomputed;
}

export const readCommittedButtonAdjudication =
  (): ButtonComparisonAdjudication =>
    validateCommittedButtonAdjudication(
      parse<ButtonComparisonAdjudication>(
        "committed adjudication",
        readFileSync(BUTTON_ADJUDICATION_PATH, "utf8"),
      ),
    );

export function validateCommittedButtonV2Adjudication(
  artifact: ButtonComparisonAdjudication,
  sourceBytes: AdjudicationSourceBytes = readButtonV2AdjudicationSources(),
): ButtonComparisonAdjudication {
  const hashes = {
    packet: sha256(sourceBytes.packet),
    grades: sha256(sourceBytes.grades),
    sealedAnswerKey: sha256(sourceBytes.key),
    evidenceReceipt: sha256(sourceBytes.receipt),
  };
  assert(
    JSON.stringify(artifact.inputHashes) === JSON.stringify(hashes),
    "adjudication is stale: packet/grade/key/receipt bytes changed",
  );
  const recomputed = adjudicateButtonV2Comparison(sourceBytes);
  assert(
    JSON.stringify(artifact) === JSON.stringify(recomputed),
    "adjudication mapping or aggregate arithmetic differs from recomputation",
  );
  return recomputed;
}

export const readCommittedButtonV2Adjudication =
  (): ButtonComparisonAdjudication =>
    validateCommittedButtonV2Adjudication(
      parse<ButtonComparisonAdjudication>(
        "committed v2 adjudication",
        readFileSync(BUTTON_V2_ADJUDICATION_PATH, "utf8"),
      ),
    );

const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const v2 = process.argv.includes("--v2");
  const result = v2
    ? adjudicateButtonV2Comparison(readButtonV2AdjudicationSources())
    : adjudicateButtonComparison(readButtonAdjudicationSources());
  const adjudicationPath = v2
    ? BUTTON_V2_ADJUDICATION_PATH
    : BUTTON_ADJUDICATION_PATH;
  if (process.argv.includes("--write")) {
    writeFileSync(adjudicationPath, `${JSON.stringify(result, null, 2)}\n`);
    console.log(`WROTE ${adjudicationPath}`);
  } else {
    const committed = parse<ButtonComparisonAdjudication>(
      "committed adjudication",
      readFileSync(adjudicationPath, "utf8"),
    );
    if (v2) {
      validateCommittedButtonV2Adjudication(committed);
    } else {
      validateCommittedButtonAdjudication(committed);
    }
    console.log(
      `Button comparison adjudication: ${result.aggregates.byImplementation.legacy.cellWeighted.numerator}/12 legacy vs ${result.aggregates.byImplementation.recipeReact.cellWeighted.numerator}/12 recipe React; ${result.verdict.comparison}`,
    );
  }
}
