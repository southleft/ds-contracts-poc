import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { format } from "prettier";

import {
  INPUT_FIELD_COMPARISON_ADORNMENTS,
  INPUT_FIELD_COMPARISON_CELLS,
  INPUT_FIELD_COMPARISON_CONTENT,
  INPUT_FIELD_COMPARISON_LIBRARIES,
  INPUT_FIELD_COMPARISON_REQUIRED,
  INPUT_FIELD_COMPARISON_SIZES,
  INPUT_FIELD_COMPARISON_STATES,
  REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS,
  validateInputFieldComparisonMatrix,
  type InputFieldComparisonCell,
} from "./input-field-comparison-fixture.js";
import {
  readInputFieldAdjudicationSources,
  validateCommittedInputFieldAdjudication,
  type InputFieldComparisonAdjudication,
} from "./input-field-comparison-adjudication.js";
import { canonicalInputFieldRecipeInstance } from "./fixtures/input-field.js";
import type { IRNode } from "./figma-ir.js";
import { compileInputFieldRecipe } from "./recipes/input-field.js";

const V1_ROOT = "recipe/evidence/input-field-comparison";
const V2_ROOT = "recipe/evidence/input-field-comparison-v2";
const BLIND_ROOT = `${V2_ROOT}/blind-packet`;
export const INPUT_FIELD_V2_ADJUDICATION_PATH = `${V2_ROOT}/comparison-result.json`;
const IMPLEMENTATIONS = ["legacy", "recipe-react"] as const;
const CONFIDENCES = ["low", "medium", "high"] as const;
const IMPLEMENTATION_IDENTITY =
  /\blegacy\b|\brecipe(?:[- /]?react)?\b|\bweb[ -]?component\b|\bmui\b|\bpolaris\b|@shopify|@mui/i;
const IMPLEMENTATION_GUESS =
  /\blegacy\b|\brecipe(?:[- /]?react)?\b|\bweb[ -]?component\b|\bimplementation(?: path| guess)?\b|\bexpected[ -]?winner\b|\bmui\b|\bpolaris\b|@shopify|@mui/i;

type Implementation = (typeof IMPLEMENTATIONS)[number];
type Confidence = (typeof CONFIDENCES)[number];

interface DomProbe {
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
}

interface CapturedArtifact {
  cellKey: string;
  file: string;
  hash: string;
  width: number;
  height: number;
  paintedPixels: number;
  contentBox: { width: number; height: number };
  dom: DomProbe;
}

interface ManifestCell {
  cellKey: string;
  outputHash: string;
  referenceHash: string;
  comparedPixels: number;
}

interface Manifest {
  fixtureHash: string;
  sampleMatrixHash: string;
  cells: ManifestCell[];
}

interface Environment {
  platform: string;
  arch: string;
  node: string;
  browser: string;
  browserRevision: string;
  browserExecutableHash: string;
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
  colorScheme: string;
  background: string;
  locale: string;
  timezone: string;
  fonts: Array<{ file: string; hash: string }>;
  fontsHash: string;
}

interface Receipt {
  version: number;
  status: {
    evidenceGeneration: string;
    independentBlindGrade: string;
    legacyRecognisability: string;
    recipeReactRecognisability: string;
    recipeWebComponentRecognisability: string;
    inputFieldOverall: boolean;
  };
  v1Failure: {
    immutable: boolean;
    evidenceRoot: string;
    score: { legacy: string; recipeReact: string };
    recipeFailures: number;
    defectStatements: number;
    diagnosis: string;
  };
  matrix: {
    frozenBeforeRender: boolean;
    sampleMatrixHash: string;
    cells: InputFieldComparisonCell[];
    totalSourceCells: number;
    exactV1Matrix: boolean;
  };
  immutableInputs: {
    referencesByteIdenticalToV1: number;
    legacyByteIdenticalToV1: number;
    referenceHashes: Record<string, string>;
    legacyHashes: Record<string, string>;
  };
  provenance: {
    sourceCommit: string;
    comparisonFixtureHash: string;
    environment: Environment;
    environmentHash: string;
  };
  references: CapturedArtifact[];
  outputs: {
    legacy: CapturedArtifact[];
    recipeReact: CapturedArtifact[];
    recipeWebComponent: CapturedArtifact[];
  };
  manifests: {
    legacy: Manifest;
    recipeReact: Manifest;
    recipeWebComponentParity: Manifest;
  };
  nonvisualEvidence: {
    zeroPixelComparisons: number;
    acquisitionAccounting: Record<
      string,
      {
        factsSelected: number;
        byCategory: Record<string, number>;
        byField: Record<string, number>;
        parameterFields: number;
        mappingCount: number;
        setupSeconds: number;
        unsupportedCells: number;
        failures: string[];
      }
    >;
    twoCycleCanonicalFixedPoint: Record<string, boolean>;
    deterministicEmission: Record<
      string,
      {
        byteIdenticalTwoRun: boolean;
        reactHash: string;
        webComponentHash: string;
      }
    >;
    semanticApiAriaEvents: string;
    recipeWebComponentParity: {
      cells: number;
      nonzeroCells: number;
      pixelComparisons: number;
      byteHashEqualToReact: number;
      renderedPixelHashEqualToReact: number;
      perceptualThreshold: number;
      perceptualPixelEqualToReact: number;
      geometryEqualToReact: number;
      semanticProbeEqualToReact: number;
      includedInBlindSpecimens: boolean;
    };
    noLibraryBranchChecks: {
      staticGenericFiles: string[];
      forbiddenIdentities: string;
      dynamicParameterCounterexample: string;
      hardStopRequired: boolean;
      controlFailed: boolean;
    };
  };
  counts: {
    sourceReferences: number;
    legacyOutputs: number;
    recipeReactOutputs: number;
    recipeWebComponentOutputs: number;
    blindReferences: number;
    blindSpecimens: number;
  };
  blindPacket: {
    path: string;
    sealedAnswerKey: string;
    packetHash: string;
    randomizedBatchHash: string;
    recognisabilityVerdictsAuthoredByBuilder: boolean;
    exactIndependentGradingPrompt: string;
  };
}

interface V1Receipt {
  version: number;
  matrix: {
    sampleMatrixHash: string;
    axesCompared: string[];
    values: Record<string, string[]>;
    recipeVariantsPerSource: number;
    pairedCellsPerSource: number;
    cells: InputFieldComparisonCell[];
  };
  provenance: {
    sourceCommit: string;
    fixtureHash: string;
    environment: Environment;
    environmentHash: string;
  };
  references: CapturedArtifact[];
  outputs: { legacy: CapturedArtifact[] };
  comparisonPin: {
    protocol: BlindProtocol;
    referenceHashes: Record<string, string>;
    referenceProvenance: Record<
      string,
      {
        sourceId: string;
        sourceVersionOrRevision: string;
        sourceHash: string;
        captureInputHash: string;
        independentHarness: boolean;
      }
    >;
  };
}

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
  instructions: string[];
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

interface GradeBatch {
  grader: { identity: string; role: string };
  packetProtocol: BlindProtocol;
  randomizedBatchHash: string;
  counts: {
    references: number;
    specimens: number;
    grades: number;
    recognisable: number;
    unrecognisable: number;
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

export interface InputFieldV2AdjudicationSourceBytes {
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

interface AggregatePair {
  legacy: Score;
  recipeReact: Score;
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
  size: string;
  state: string;
  contentMode: string;
  required: string;
  adornments: string;
  outputHash: string;
  referenceHash: string;
}

interface DefectAggregate {
  failedSpecimens: number;
  statements: number;
  classes: Record<string, { failedSpecimens: number; statements: number }>;
}

export interface InputFieldV2ComparisonAdjudication {
  artifactVersion: "input-field-comparison-adjudication-v2";
  protocolVersions: {
    packet: string;
    grade: string;
    answerKey: string;
    evidenceReceipt: number;
    randomizedBatchHash: string;
    rubricHash: string;
    environmentHash: string;
    fontsHash: string;
  };
  inputHashes: {
    packet: string;
    grades: string;
    sealedAnswerKey: string;
    evidenceReceipt: string;
    immutableV1Adjudication: string;
    immutableV1Receipt: string;
  };
  integrity: {
    status: "passed";
    checks: Record<string, true>;
  };
  sample: {
    complete: true;
    sourceLibraries: string[];
    axes: string[];
    pairedValues: Record<string, string[]>;
    fullRecipeValues: { Adornments: string[] };
    sourceCells: 128;
    references: 128;
    specimens: 256;
    cellsPerImplementation: 128;
    completeSetsPerImplementation: 2;
    cellsPerSourceSet: 64;
    cellWeighting: string;
    completeSetWeighting: string;
  };
  structuralSemanticEvidence: {
    rolesCovered: string[];
    fullRecipeVariants: number;
    pairedCellsPerSource: number;
    semanticReactAndWebComponentOutputs: number;
    acquisitionFactsSelected: Record<string, number>;
    acquisitionParameterFields: Record<string, number>;
    twoCycleCanonicalFixedPoint: Record<string, true>;
    deterministicEmission: Record<string, true>;
    noLibraryBranches: true;
    accounting: "passed-offline";
  };
  sourceProvenance: {
    sourceCommit: string;
    comparisonFixtureHash: string;
    sampleMatrixHash: string;
    environmentHash: string;
    browser: string;
    browserRevision: string;
    browserExecutableHash: string;
    fontsHash: string;
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
      { cellWeighted: Score; completeSetWeighted: Score }
    >;
    bySource: Record<string, AggregatePair>;
    bySize: Record<string, AggregatePair>;
    byState: Record<string, AggregatePair>;
    byContentMode: Record<string, AggregatePair>;
    byRequired: Record<string, AggregatePair>;
    byAdornments: Record<string, AggregatePair>;
    byConfidence: Record<string, AggregatePair>;
    pairedOutcomes: {
      recipeBeatLegacy: number;
      tiedPass: number;
      tiedFail: number;
      legacyBeatRecipe: number;
      total: 128;
    };
  };
  confidence: {
    overall: ConfidenceDistribution;
    byImplementation: Record<"legacy" | "recipeReact", ConfidenceDistribution>;
  };
  defects: {
    byImplementation: Record<"legacy" | "recipeReact", DefectAggregate>;
  };
  webComponentParity: {
    keptSeparateFromBlindRecognisability: true;
    recognisability: "not-blind-graded";
    cells: 128;
    nonzeroCells: 128;
    pixelComparisons: 128;
    byteHashEqualToReact: number;
    renderedPixelHashEqualToReact: number;
    perceptualThreshold: 0.1;
    perceptualPixelEqualToReact: 128;
    geometryEqualToReact: 128;
    semanticProbeEqualToReact: 128;
  };
  comparisonHistory: {
    immutableV1: {
      artifact: string;
      artifactHash: string;
      referencesAndLegacyBytesRetained: true;
      legacyCellWeighted: Score;
      recipeReactCellWeighted: Score;
      legacyCompleteSetWeighted: Score;
      recipeReactCompleteSetWeighted: Score;
    };
    correctedV2: {
      legacyCellWeighted: Score;
      recipeReactCellWeighted: Score;
      legacyCompleteSetWeighted: Score;
      recipeReactCompleteSetWeighted: Score;
    };
  };
  evidenceColumns: {
    offlineImplementation: "passed";
    pairedBlindRecognisability: "passed" | "failed";
    webComponentParity: "passed-parity-only";
    liveFigma: "pending";
    reflow: "pending";
    variantSwitching: "pending";
    tokenBinding: "pending";
    noFakeLayout: "pending";
    liveTwoCycleFixedPoint: "pending";
    accounting: "passed-offline-pending-live";
    liveCanvasGrade: "pending";
    overallInputSuccess: false;
  };
  verdict: {
    offlineDifficultControlCriterion: "passed" | "failed";
    comparison: "recipe-beat" | "recipe-matched" | "recipe-underperformed";
    recipeMatchedOrBeatLegacy: boolean;
    noHiddenDenominatorReduction: true;
    strictStructuralSemanticWcEvidence: true;
    cellDelta: number;
    completeSetDelta: number;
    inputSuccess: false;
    diagnosis: string[];
    blockers: string[];
    nextTask: string;
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
  expected: readonly string[],
  label: string,
): void => {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  assert(
    JSON.stringify(actual) === JSON.stringify(wanted),
    `${label} fields differ: ${actual.join(", ")}`,
  );
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

const fileHash = (file: string): string => sha256(readFileSync(file));

const assertContainedFile = (file: string, directory: string): string => {
  assert(!path.isAbsolute(file), `${file} must be repository-relative`);
  const absoluteDirectory = path.resolve(directory);
  const absoluteFile = path.resolve(file);
  const lexical = path.relative(absoluteDirectory, absoluteFile);
  assert(
    lexical !== "" && !lexical.startsWith("..") && !path.isAbsolute(lexical),
    `${file} escapes ${directory}`,
  );
  const stat = lstatSync(absoluteFile);
  assert(
    stat.isFile() && !stat.isSymbolicLink(),
    `${file} is not a regular file`,
  );
  const realDirectory = realpathSync(absoluteDirectory);
  const realFile = realpathSync(absoluteFile);
  const resolved = path.relative(realDirectory, realFile);
  assert(
    resolved !== "" && !resolved.startsWith("..") && !path.isAbsolute(resolved),
    `${file} resolves outside ${directory}`,
  );
  return realFile;
};

const assertArtifacts = (
  artifacts: readonly CapturedArtifact[],
  expectedDirectory: string,
  cellKeys: readonly string[],
): void => {
  assert(
    artifacts.length === 128 &&
      artifacts.map((artifact) => artifact.cellKey).join("\0") ===
        cellKeys.join("\0") &&
      new Set(artifacts.map((artifact) => artifact.cellKey)).size === 128 &&
      new Set(artifacts.map((artifact) => artifact.file)).size === 128,
    `${expectedDirectory} cardinality, order, or uniqueness differs`,
  );
  for (const artifact of artifacts) {
    const file = assertContainedFile(artifact.file, expectedDirectory);
    assert(fileHash(file) === artifact.hash, `${artifact.file} hash differs`);
    assert(
      artifact.width > 0 &&
        artifact.height > 0 &&
        Number.isSafeInteger(artifact.paintedPixels) &&
        artifact.paintedPixels > 0 &&
        artifact.contentBox.width > 0 &&
        artifact.contentBox.height > 0,
      `${artifact.file} has empty geometry or pixels`,
    );
  }
};

const confidenceDistribution = (
  grades: readonly UnsealedGrade[],
): ConfidenceDistribution => ({
  low: grades.filter((grade) => grade.confidence === "low").length,
  medium: grades.filter((grade) => grade.confidence === "medium").length,
  high: grades.filter((grade) => grade.confidence === "high").length,
  total: grades.length,
});

const defectClass = (defect: string): string => {
  if (/clipped red amount\/currency error field/i.test(defect)) {
    return "wrong-clipped-error-field";
  }
  if (/compressed generic text-field layout/i.test(defect)) {
    return "compressed-generic-layout-omissions";
  }
  if (/outline around the entire label\/field\/helper group/i.test(defect)) {
    return "group-level-focus-outline";
  }
  if (/omits the leading error icon/i.test(defect)) {
    return "error-icon-and-label-treatment";
  }
  return "other";
};

const defectAggregate = (grades: readonly UnsealedGrade[]): DefectAggregate => {
  const failures = grades.filter((grade) => !grade.recognisable);
  const classes = new Map<
    string,
    { specimens: Set<string>; statements: number }
  >();
  for (const grade of failures) {
    for (const defect of grade.defects) {
      const name = defectClass(defect);
      const entry = classes.get(name) ?? {
        specimens: new Set<string>(),
        statements: 0,
      };
      entry.specimens.add(grade.specimenId);
      entry.statements += 1;
      classes.set(name, entry);
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
  field:
    | "sourceLibrary"
    | "size"
    | "state"
    | "contentMode"
    | "required"
    | "adornments"
    | "confidence",
): Record<string, AggregatePair> =>
  Object.fromEntries(
    values.map((value) => [
      value,
      pairAggregate(grades, (grade) => grade[field] === value),
    ]),
  );

const collectRoles = (node: IRNode, roles = new Set<string>()): Set<string> => {
  if (
    node.role &&
    !node.role.startsWith("input-field/variant/") &&
    node.role !== "input-field/message-container" &&
    node.role !== "input-field/content-row"
  ) {
    roles.add(node.role);
  }
  if ("children" in node) {
    for (const child of node.children) collectRoles(child, roles);
  }
  return roles;
};

const assertManifest = (
  manifest: Manifest,
  fixtureHash: string,
  matrixHash: string,
  cellKeys: readonly string[],
  references: ReadonlyMap<string, CapturedArtifact>,
  outputs: ReadonlyMap<string, CapturedArtifact>,
): void => {
  assert(
    manifest.fixtureHash === fixtureHash &&
      manifest.sampleMatrixHash === matrixHash &&
      manifest.cells.length === 128 &&
      manifest.cells.map((cell) => cell.cellKey).join("\0") ===
        cellKeys.join("\0"),
    "manifest pin, denominator, or order differs",
  );
  for (const cell of manifest.cells) {
    assert(
      Number.isSafeInteger(cell.comparedPixels) &&
        cell.comparedPixels > 0 &&
        cell.referenceHash === references.get(cell.cellKey)?.hash &&
        cell.outputHash === outputs.get(cell.cellKey)?.hash,
      `${cell.cellKey} manifest hash or nonzero pixel evidence differs`,
    );
  }
};

const assertSemanticOutput = (
  artifact: CapturedArtifact,
  cell: InputFieldComparisonCell,
): void => {
  const text = REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS[cell.library].text;
  assert(
    artifact.dom.inputFound &&
      artifact.dom.labelFound &&
      artifact.dom.labelForMatches &&
      artifact.dom.accessibleNameMatched &&
      artifact.dom.value === (cell.content === "value" ? text.value : "") &&
      artifact.dom.placeholder === text.placeholder &&
      artifact.dom.required === (cell.required === "true") &&
      artifact.dom.disabled === (cell.state === "disabled") &&
      (artifact.dom.ariaInvalid === "true") === (cell.state === "error") &&
      artifact.dom.ariaDescribedBy !== null &&
      artifact.dom.structure.labels === 1 &&
      artifact.dom.structure.inputs === 1 &&
      artifact.dom.structure.messages === 1 &&
      artifact.dom.structure.adornments ===
        (cell.adornments === "both" ? 2 : 0),
    `${artifact.cellKey} semantic/API/ARIA evidence differs`,
  );
};

export const readInputFieldV2AdjudicationSources =
  (): InputFieldV2AdjudicationSourceBytes => ({
    packet: readFileSync(`${BLIND_ROOT}/packet.json`, "utf8"),
    grades: readFileSync(`${BLIND_ROOT}/grades.json`, "utf8"),
    key: readFileSync(`${V2_ROOT}/sealed-answer-key.json`, "utf8"),
    receipt: readFileSync(`${V2_ROOT}/receipt.json`, "utf8"),
  });

export function adjudicateInputFieldV2Comparison(
  sourceBytes: InputFieldV2AdjudicationSourceBytes,
): InputFieldV2ComparisonAdjudication {
  const packet = parse<BlindPacket>("v2 blind packet", sourceBytes.packet);
  const gradeBatch = parse<GradeBatch>("v2 grade batch", sourceBytes.grades);
  const answerKey = parse<AnswerKey>("v2 sealed answer key", sourceBytes.key);
  const receipt = parse<Receipt>("v2 comparison receipt", sourceBytes.receipt);
  const v1ReceiptBytes = readFileSync(`${V1_ROOT}/receipt.json`, "utf8");
  const v1Receipt = parse<V1Receipt>("immutable v1 receipt", v1ReceiptBytes);
  const v1ArtifactBytes = readFileSync(
    `${V1_ROOT}/comparison-result.json`,
    "utf8",
  );
  const v1Artifact = validateCommittedInputFieldAdjudication(
    parse<InputFieldComparisonAdjudication>(
      "immutable v1 adjudication",
      v1ArtifactBytes,
    ),
    readInputFieldAdjudicationSources(),
  );

  assert(
    receipt.blindPacket.path === `${BLIND_ROOT}/packet.json` &&
      receipt.blindPacket.sealedAnswerKey ===
        `${V2_ROOT}/sealed-answer-key.json` &&
      path.dirname(receipt.blindPacket.path) !==
        path.dirname(receipt.blindPacket.sealedAnswerKey),
    "packet/key separation is not intact",
  );
  assertContainedFile(receipt.blindPacket.path, BLIND_ROOT);
  assertContainedFile(receipt.blindPacket.sealedAnswerKey, V2_ROOT);
  assert(
    !IMPLEMENTATION_IDENTITY.test(sourceBytes.packet),
    "blind packet discloses implementation identity",
  );
  assert(
    !IMPLEMENTATION_GUESS.test(sourceBytes.grades),
    "grades contain an implementation identity guess",
  );
  assert(
    sha256(sourceBytes.packet) === receipt.blindPacket.packetHash,
    "packet bytes differ from the sealed receipt hash",
  );

  const expectedProtocol = {
    ...v1Receipt.comparisonPin.protocol,
    version: "input-field-paired-source-v2",
  };
  assert(
    packet.version === expectedProtocol.version &&
      packet.version === answerKey.version &&
      packet.protocol.version === packet.version &&
      JSON.stringify(packet.protocol) === JSON.stringify(expectedProtocol) &&
      JSON.stringify(gradeBatch.packetProtocol) ===
        JSON.stringify(packet.protocol),
    "packet, grade, key, v1 pin, or receipt protocol differs",
  );
  const recomputedBatchHash = sha256(
    JSON.stringify(
      packet.cells.map((cell) => ({
        anonymousCell: cell.anonymousCell,
        referenceHash: cell.reference.screenshotHash,
        specimens: cell.specimens.map((specimen) => ({
          anonymousLabel: specimen.anonymousLabel,
          outputHash: specimen.outputHash,
        })),
      })),
    ),
  );
  assert(
    recomputedBatchHash === packet.randomizedBatchHash &&
      recomputedBatchHash === gradeBatch.randomizedBatchHash &&
      recomputedBatchHash === answerKey.randomizedBatchHash &&
      recomputedBatchHash === receipt.blindPacket.randomizedBatchHash,
    "randomizedBatchHash differs from packet contents or sealed inputs",
  );
  assert(
    answerKey.sealedFromBlindGrader === true &&
      /^[a-f0-9]{64}$/.test(answerKey.randomizationSeedHash),
    "answer key was not sealed from the blind grader",
  );
  assert(
    packet.status === "awaiting-independent-blind-grade" &&
      receipt.status.evidenceGeneration === "complete" &&
      receipt.status.independentBlindGrade === "pending" &&
      receipt.status.inputFieldOverall === false &&
      receipt.blindPacket.recognisabilityVerdictsAuthoredByBuilder === false,
    "pre-grade packet/receipt state is not frozen and false",
  );
  exactKeys(
    gradeBatch as unknown as Record<string, unknown>,
    ["grader", "packetProtocol", "randomizedBatchHash", "counts", "grades"],
    "grade batch",
  );
  exactKeys(
    gradeBatch.grader as unknown as Record<string, unknown>,
    ["identity", "role"],
    "grader",
  );
  assert(
    gradeBatch.grader.identity.length > 0 &&
      gradeBatch.grader.role === "independent-visual-grader",
    "independent grader identity or role is absent",
  );

  validateInputFieldComparisonMatrix(receipt.matrix.cells);
  const cellKeys = receipt.matrix.cells.map((cell) => cell.key);
  assert(
    receipt.version === 2 &&
      receipt.matrix.frozenBeforeRender === true &&
      receipt.matrix.exactV1Matrix === true &&
      receipt.matrix.totalSourceCells === 128 &&
      JSON.stringify(receipt.matrix.cells) ===
        JSON.stringify(INPUT_FIELD_COMPARISON_CELLS) &&
      receipt.matrix.sampleMatrixHash ===
        sha256(JSON.stringify(INPUT_FIELD_COMPARISON_CELLS)) &&
      receipt.matrix.sampleMatrixHash === v1Receipt.matrix.sampleMatrixHash &&
      JSON.stringify(receipt.matrix.cells) ===
        JSON.stringify(v1Receipt.matrix.cells),
    "v2 matrix is not the exact immutable 128-cell v1 matrix",
  );
  assert(
    JSON.stringify(receipt.counts) ===
      JSON.stringify({
        sourceReferences: 128,
        legacyOutputs: 128,
        recipeReactOutputs: 128,
        recipeWebComponentOutputs: 128,
        blindReferences: 128,
        blindSpecimens: 256,
      }) &&
      packet.counts.references === 128 &&
      packet.counts.specimens === 256 &&
      packet.counts.specimensPerReference === 2 &&
      packet.cells.length === 128,
    "packet or receipt cardinality differs",
  );

  assertArtifacts(receipt.references, `${V2_ROOT}/source-reference`, cellKeys);
  assertArtifacts(receipt.outputs.legacy, `${V2_ROOT}/legacy`, cellKeys);
  assertArtifacts(
    receipt.outputs.recipeReact,
    `${V2_ROOT}/recipe-react`,
    cellKeys,
  );
  assertArtifacts(
    receipt.outputs.recipeWebComponent,
    `${V2_ROOT}/recipe-wc`,
    cellKeys,
  );
  const references = new Map(
    receipt.references.map((artifact) => [artifact.cellKey, artifact]),
  );
  const legacyOutputs = new Map(
    receipt.outputs.legacy.map((artifact) => [artifact.cellKey, artifact]),
  );
  const recipeOutputs = new Map(
    receipt.outputs.recipeReact.map((artifact) => [artifact.cellKey, artifact]),
  );
  const wcOutputs = new Map(
    receipt.outputs.recipeWebComponent.map((artifact) => [
      artifact.cellKey,
      artifact,
    ]),
  );
  assertManifest(
    receipt.manifests.legacy,
    receipt.provenance.comparisonFixtureHash,
    receipt.matrix.sampleMatrixHash,
    cellKeys,
    references,
    legacyOutputs,
  );
  assertManifest(
    receipt.manifests.recipeReact,
    receipt.provenance.comparisonFixtureHash,
    receipt.matrix.sampleMatrixHash,
    cellKeys,
    references,
    recipeOutputs,
  );
  assertManifest(
    receipt.manifests.recipeWebComponentParity,
    receipt.provenance.comparisonFixtureHash,
    receipt.matrix.sampleMatrixHash,
    cellKeys,
    references,
    wcOutputs,
  );
  assert(receipt.nonvisualEvidence.zeroPixelComparisons === 0, "zero pixels");

  assert(
    receipt.provenance.sourceCommit === v1Receipt.provenance.sourceCommit &&
      receipt.provenance.comparisonFixtureHash ===
        v1Receipt.provenance.fixtureHash &&
      receipt.provenance.environmentHash ===
        v1Receipt.provenance.environmentHash &&
      JSON.stringify(receipt.provenance.environment) ===
        JSON.stringify(v1Receipt.provenance.environment) &&
      receipt.provenance.environmentHash ===
        sha256(JSON.stringify(receipt.provenance.environment)) &&
      receipt.provenance.environmentHash === packet.protocol.environmentHash &&
      receipt.provenance.environment.fontsHash === packet.protocol.fontsHash &&
      `${receipt.provenance.environment.browser} (playwright chromium-${receipt.provenance.environment.browserRevision})` ===
        packet.protocol.browser,
    "source provenance or environment differs from immutable v1",
  );
  for (const font of receipt.provenance.environment.fonts) {
    const file = assertContainedFile(font.file, "extract/computed/fonts");
    assert(fileHash(file) === font.hash, `${font.file} font hash differs`);
  }

  assert(
    receipt.immutableInputs.referencesByteIdenticalToV1 === 128 &&
      receipt.immutableInputs.legacyByteIdenticalToV1 === 128 &&
      receipt.references.length === v1Receipt.references.length &&
      receipt.outputs.legacy.length === v1Receipt.outputs.legacy.length,
    "immutable v1 reference/legacy cardinality differs",
  );
  for (let index = 0; index < 128; index += 1) {
    const v1Reference = v1Receipt.references[index]!;
    const v2Reference = receipt.references[index]!;
    const v1Legacy = v1Receipt.outputs.legacy[index]!;
    const v2Legacy = receipt.outputs.legacy[index]!;
    assert(
      v2Reference.cellKey === v1Reference.cellKey &&
        v2Reference.hash === v1Reference.hash &&
        fileHash(v2Reference.file) === fileHash(v1Reference.file) &&
        receipt.immutableInputs.referenceHashes[v2Reference.cellKey] ===
          v1Reference.hash,
      `${v2Reference.cellKey} v1 reference bytes differ`,
    );
    assert(
      v2Legacy.cellKey === v1Legacy.cellKey &&
        v2Legacy.hash === v1Legacy.hash &&
        fileHash(v2Legacy.file) === fileHash(v1Legacy.file) &&
        receipt.immutableInputs.legacyHashes[v2Legacy.cellKey] ===
          v1Legacy.hash,
      `${v2Legacy.cellKey} v1 legacy bytes differ`,
    );
  }
  assert(
    receipt.v1Failure.immutable === true &&
      receipt.v1Failure.evidenceRoot === V1_ROOT &&
      receipt.v1Failure.score.legacy === "88/128" &&
      receipt.v1Failure.score.recipeReact === "40/128" &&
      receipt.v1Failure.recipeFailures === 88 &&
      receipt.v1Failure.defectStatements === 271 &&
      v1Artifact.aggregates.byImplementation.legacy.cellWeighted.numerator ===
        88 &&
      v1Artifact.aggregates.byImplementation.recipeReact.cellWeighted
        .numerator === 40,
    "immutable v1 adjudication history differs",
  );

  const envelope = compileInputFieldRecipe(canonicalInputFieldRecipeInstance);
  assert(envelope.ir.kind === "component-set", "Input/Field IR is not a set");
  const roles = [...collectRoles(envelope.ir)].sort();
  const requiredRoles = [
    "input-field/content/placeholder",
    "input-field/content/value",
    "input-field/label",
    "input-field/label-row",
    "input-field/message/error",
    "input-field/message/helper",
    "input-field/required-indicator",
    "input-field/set",
    "input-field/slot/leading",
    "input-field/slot/trailing",
    "input-field/surface",
  ];
  assert(
    envelope.ir.children.length === 128 &&
      JSON.stringify(roles) === JSON.stringify(requiredRoles),
    "strict structural roles or full recipe denominator differ",
  );
  for (const library of INPUT_FIELD_COMPARISON_LIBRARIES) {
    const accounting =
      receipt.nonvisualEvidence.acquisitionAccounting[library]!;
    assert(
      accounting.factsSelected === 101 &&
        accounting.parameterFields === 89 &&
        accounting.mappingCount === 109 &&
        accounting.setupSeconds > 0 &&
        accounting.unsupportedCells > 0 &&
        accounting.failures.length === 0 &&
        Object.values(accounting.byField).every((count) => count > 0) &&
        ["geometry", "typography", "fill", "state", "semantics"].every(
          (category) => accounting.byCategory[category]! > 0,
        ) &&
        receipt.nonvisualEvidence.twoCycleCanonicalFixedPoint[library] ===
          true &&
        receipt.nonvisualEvidence.deterministicEmission[library]!
          .byteIdenticalTwoRun === true,
      `${library} structural/accounting/fixed-point evidence is incomplete`,
    );
  }
  assert(
    receipt.nonvisualEvidence.semanticApiAriaEvents ===
      "256/256 corrected recipe outputs validated" &&
      receipt.nonvisualEvidence.noLibraryBranchChecks.forbiddenIdentities ===
        "0 matches" &&
      receipt.nonvisualEvidence.noLibraryBranchChecks.hardStopRequired ===
        true &&
      receipt.nonvisualEvidence.noLibraryBranchChecks.controlFailed === false,
    "semantic evidence or no-library-branch control differs",
  );
  for (const artifact of receipt.outputs.recipeReact) {
    const cell = receipt.matrix.cells.find(
      (candidate) => candidate.key === artifact.cellKey,
    )!;
    const wc = wcOutputs.get(artifact.cellKey)!;
    assertSemanticOutput(artifact, cell);
    assertSemanticOutput(wc, cell);
    assert(
      JSON.stringify(artifact.contentBox) === JSON.stringify(wc.contentBox) &&
        JSON.stringify(artifact.dom) === JSON.stringify(wc.dom),
      `${artifact.cellKey} React/WC geometry or semantics differ`,
    );
  }

  let byteHashEqualToReact = 0;
  let renderedPixelHashEqualToReact = 0;
  let perceptualPixelEqualToReact = 0;
  for (const react of receipt.outputs.recipeReact) {
    const wc = wcOutputs.get(react.cellKey)!;
    if (react.hash === wc.hash) byteHashEqualToReact += 1;
    const reactPng = PNG.sync.read(readFileSync(react.file));
    const wcPng = PNG.sync.read(readFileSync(wc.file));
    assert(
      reactPng.width === wcPng.width && reactPng.height === wcPng.height,
      `${react.cellKey} React/WC raster dimensions differ`,
    );
    const pixelHash = (png: PNG): string =>
      sha256(
        Buffer.concat([
          Buffer.from(`${png.width}x${png.height}\0`),
          Buffer.from(png.data),
        ]),
      );
    if (pixelHash(reactPng) === pixelHash(wcPng)) {
      renderedPixelHashEqualToReact += 1;
    }
    if (
      pixelmatch(
        reactPng.data,
        wcPng.data,
        undefined,
        reactPng.width,
        reactPng.height,
        { threshold: 0.1 },
      ) === 0
    ) {
      perceptualPixelEqualToReact += 1;
    }
  }
  const wcParity = receipt.nonvisualEvidence.recipeWebComponentParity;
  assert(
    wcParity.cells === 128 &&
      wcParity.nonzeroCells === 128 &&
      wcParity.pixelComparisons === 128 &&
      wcParity.byteHashEqualToReact === byteHashEqualToReact &&
      wcParity.renderedPixelHashEqualToReact ===
        renderedPixelHashEqualToReact &&
      wcParity.perceptualThreshold === 0.1 &&
      wcParity.perceptualPixelEqualToReact === perceptualPixelEqualToReact &&
      perceptualPixelEqualToReact === 128 &&
      wcParity.geometryEqualToReact === 128 &&
      wcParity.semanticProbeEqualToReact === 128 &&
      wcParity.includedInBlindSpecimens === false,
    "React/Web Component parity evidence differs",
  );

  const packetEntries = packet.cells.flatMap((cell) => {
    assert(
      /^cell-[a-f0-9]{12}$/.test(cell.anonymousCell) &&
        cell.specimens.length === 2,
      `${cell.anonymousCell} is not a two-specimen opaque cell`,
    );
    const referenceFile = assertContainedFile(
      path.join(BLIND_ROOT, cell.reference.image),
      `${BLIND_ROOT}/references`,
    );
    assert(
      fileHash(referenceFile) === cell.reference.screenshotHash,
      `${cell.anonymousCell} blind reference hash differs`,
    );
    return cell.specimens.map((specimen) => {
      assert(
        /^specimen-[a-f0-9]{12}$/.test(specimen.anonymousLabel) &&
          specimen.grade.recognisable === null &&
          specimen.grade.confidence === null &&
          specimen.grade.defects.length === 0,
        `${specimen.anonymousLabel} packet specimen is not opaque and ungraded`,
      );
      const specimenFile = assertContainedFile(
        path.join(BLIND_ROOT, specimen.image),
        `${BLIND_ROOT}/specimens`,
      );
      assert(
        fileHash(specimenFile) === specimen.outputHash,
        `${specimen.anonymousLabel} blind specimen hash differs`,
      );
      return {
        anonymousCell: cell.anonymousCell,
        referenceHash: cell.reference.screenshotHash,
        specimen,
      };
    });
  });
  const packetIds = new Set(
    packetEntries.map((entry) => entry.specimen.anonymousLabel),
  );
  assert(
    new Set(packet.cells.map((cell) => cell.anonymousCell)).size === 128 &&
      packetEntries.length === 256 &&
      packetIds.size === 256,
    "packet cell/specimen mapping is not unique and complete",
  );

  const gradeIds = gradeBatch.grades.map((grade) => grade.specimenId);
  assert(
    gradeBatch.grades.length === 256 &&
      new Set(gradeIds).size === 256 &&
      gradeIds.every((id) => packetIds.has(id)),
    "grades do not contain exactly one grade per packet specimen",
  );
  for (const grade of gradeBatch.grades) {
    exactKeys(
      grade as unknown as Record<string, unknown>,
      ["specimenId", "referenceId", "recognisable", "confidence", "defects"],
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
        ) &&
        (grade.recognisable || grade.defects.length > 0),
      `${grade.specimenId} grade fields or failure defects are invalid`,
    );
  }
  const recognisable = gradeBatch.grades.filter(
    (grade) => grade.recognisable,
  ).length;
  assert(
    JSON.stringify(gradeBatch.counts) ===
      JSON.stringify({
        references: 128,
        specimens: 256,
        grades: 256,
        recognisable,
        unrecognisable: 256 - recognisable,
      }),
    "grade count arithmetic is impossible",
  );

  assert(answerKey.answers.length === 256, "answer key cardinality differs");
  const answerLabels = answerKey.answers.map((answer) => answer.anonymousLabel);
  assert(
    new Set(answerLabels).size === 256 &&
      answerLabels.every((label) => packetIds.has(label)),
    "answer key has a duplicate, missing, or foreign mapping",
  );
  for (const answer of answerKey.answers) {
    exactKeys(
      answer as unknown as Record<string, unknown>,
      [
        "anonymousCell",
        "anonymousLabel",
        "implementationPath",
        "cellKey",
        "outputHash",
      ],
      answer.anonymousLabel,
    );
    assert(
      IMPLEMENTATIONS.includes(answer.implementationPath) &&
        cellKeys.includes(answer.cellKey),
      `${answer.anonymousLabel} key mapping is invalid`,
    );
  }

  // The answer key is not joined to grades until every integrity, provenance,
  // denominator, image, semantic, and WC check above has passed.
  const packetBySpecimen = new Map(
    packetEntries.map((entry) => [entry.specimen.anonymousLabel, entry]),
  );
  const gradeBySpecimen = new Map(
    gradeBatch.grades.map((grade) => [grade.specimenId, grade]),
  );
  const matrixByCell = new Map(
    receipt.matrix.cells.map((cell) => [cell.key, cell]),
  );
  const artifactsByImplementation = {
    legacy: legacyOutputs,
    "recipe-react": recipeOutputs,
  };
  const pathsByCell = new Map<string, Set<Implementation>>();
  const mapping: UnsealedGrade[] = answerKey.answers.map((answer) => {
    const packetEntry = packetBySpecimen.get(answer.anonymousLabel);
    const grade = gradeBySpecimen.get(answer.anonymousLabel);
    const cell = matrixByCell.get(answer.cellKey);
    const artifact = artifactsByImplementation[answer.implementationPath].get(
      answer.cellKey,
    );
    const reference = references.get(answer.cellKey);
    assert(
      packetEntry && grade && cell && artifact && reference,
      `${answer.anonymousLabel} unsealed mapping is incomplete`,
    );
    assert(
      packetEntry.anonymousCell === answer.anonymousCell &&
        grade.referenceId === answer.anonymousCell &&
        packetEntry.specimen.outputHash === answer.outputHash &&
        artifact.hash === answer.outputHash &&
        packetEntry.referenceHash === reference.hash &&
        receipt.immutableInputs.referenceHashes[answer.cellKey] ===
          reference.hash,
      `${answer.anonymousLabel} differs across packet/grade/key/receipt`,
    );
    const paths = pathsByCell.get(answer.cellKey) ?? new Set<Implementation>();
    paths.add(answer.implementationPath);
    pathsByCell.set(answer.cellKey, paths);
    return {
      ...grade,
      anonymousCell: answer.anonymousCell,
      implementation: answer.implementationPath,
      cellKey: answer.cellKey,
      sourceLibrary: cell.library,
      size: cell.size,
      state: cell.state,
      contentMode: cell.content,
      required: cell.required,
      adornments: cell.adornments,
      outputHash: answer.outputHash,
      referenceHash: reference.hash,
    };
  });
  assert(
    pathsByCell.size === 128 &&
      [...pathsByCell.values()].every(
        (paths) =>
          paths.size === 2 &&
          IMPLEMENTATIONS.every((implementation) => paths.has(implementation)),
      ),
    "each paired cell must map exactly once to legacy and recipe React",
  );

  const legacy = mapping.filter((grade) => grade.implementation === "legacy");
  const recipeReact = mapping.filter(
    (grade) => grade.implementation === "recipe-react",
  );
  assert(
    legacy.length === 128 && recipeReact.length === 128,
    "implementation denominators differ",
  );
  const completeSetScore = (grades: readonly UnsealedGrade[]): Score =>
    score(
      INPUT_FIELD_COMPARISON_LIBRARIES.map((library) => {
        const set = grades.filter((grade) => grade.sourceLibrary === library);
        assert(
          set.length === 64,
          `${library} complete-set denominator differs`,
        );
        return set.every((grade) => grade.recognisable);
      }),
    );
  const legacyCellScore = score(legacy.map((grade) => grade.recognisable));
  const recipeCellScore = score(recipeReact.map((grade) => grade.recognisable));
  const legacySetScore = completeSetScore(legacy);
  const recipeSetScore = completeSetScore(recipeReact);
  const pairedOutcomes = {
    recipeBeatLegacy: 0,
    tiedPass: 0,
    tiedFail: 0,
    legacyBeatRecipe: 0,
    total: 128 as const,
  };
  for (const cellKey of cellKeys) {
    const legacyGrade = legacy.find((grade) => grade.cellKey === cellKey)!;
    const recipeGrade = recipeReact.find((grade) => grade.cellKey === cellKey)!;
    if (recipeGrade.recognisable && !legacyGrade.recognisable) {
      pairedOutcomes.recipeBeatLegacy += 1;
    } else if (recipeGrade.recognisable && legacyGrade.recognisable) {
      pairedOutcomes.tiedPass += 1;
    } else if (!recipeGrade.recognisable && !legacyGrade.recognisable) {
      pairedOutcomes.tiedFail += 1;
    } else {
      pairedOutcomes.legacyBeatRecipe += 1;
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
  const offlineCriterion =
    recipeMatchedOrBeatLegacy &&
    legacyCellScore.denominator === recipeCellScore.denominator &&
    legacySetScore.denominator === recipeSetScore.denominator
      ? "passed"
      : "failed";
  const bySource = groupedPairs(
    INPUT_FIELD_COMPARISON_LIBRARIES,
    mapping,
    "sourceLibrary",
  );
  const legacyDefects = defectAggregate(legacy);
  const recipeDefects = defectAggregate(recipeReact);
  const blockers = [
    ...(offlineCriterion === "passed"
      ? []
      : [
          `corrected recipe React paired recognisability ${recipeCellScore.numerator}/128 is below unchanged legacy ${legacyCellScore.numerator}/128`,
        ]),
    "versioned page-scoped live Figma mint/readback on Scratch is pending",
    "live reflow assertion is pending",
    "live variant-switching assertion is pending",
    "live token-binding assertion is pending",
    "live no-fake-layout assertion is pending",
    "live two-cycle fixed-point evidence is pending",
    "live zero-silent accounting is pending",
    "independent live canvas grade is pending",
  ];

  return {
    artifactVersion: "input-field-comparison-adjudication-v2",
    protocolVersions: {
      packet: packet.version,
      grade: gradeBatch.packetProtocol.version,
      answerKey: answerKey.version,
      evidenceReceipt: receipt.version,
      randomizedBatchHash: recomputedBatchHash,
      rubricHash: packet.protocol.rubricHash,
      environmentHash: packet.protocol.environmentHash,
      fontsHash: packet.protocol.fontsHash,
    },
    inputHashes: {
      packet: sha256(sourceBytes.packet),
      grades: sha256(sourceBytes.grades),
      sealedAnswerKey: sha256(sourceBytes.key),
      evidenceReceipt: sha256(sourceBytes.receipt),
      immutableV1Adjudication: sha256(v1ArtifactBytes),
      immutableV1Receipt: sha256(v1ReceiptBytes),
    },
    integrity: {
      status: "passed",
      checks: {
        packetReceiptAndKeyHashes: true,
        randomizedBatchHashRecomputed: true,
        packetAndKeySeparated: true,
        packetOpaque: true,
        graderImplementationGuessesAbsent: true,
        mappingBijective: true,
        pathContainment: true,
        sourceReferencesComplete: true,
        specimensComplete: true,
        allImageAndReferenceHashes: true,
        exactlyOneGradePerSpecimen: true,
        everyFailureHasDefects: true,
        denominatorParity: true,
        nonzeroPixels: true,
        immutableV1ReferencesAndLegacyBytes: true,
        immutableV1AdjudicationRevalidated: true,
        sourceProvenanceComplete: true,
        environmentComplete: true,
        structuralSemanticEvidenceComplete: true,
        webComponentParityRecomputed: true,
        packetKeyMappedOnlyAfterIntegrity: true,
      },
    },
    sample: {
      complete: true,
      sourceLibraries: [...INPUT_FIELD_COMPARISON_LIBRARIES],
      axes: v1Receipt.matrix.axesCompared,
      pairedValues: v1Receipt.matrix.values,
      fullRecipeValues: {
        Adornments: ["none", "leading", "trailing", "both"],
      },
      sourceCells: 128,
      references: 128,
      specimens: 256,
      cellsPerImplementation: 128,
      completeSetsPerImplementation: 2,
      cellsPerSourceSet: 64,
      cellWeighting:
        "each exact source×size×state×content×required×adornments cell has equal weight",
      completeSetWeighting:
        "a source set passes only when all 64 paired cells are recognisable",
    },
    structuralSemanticEvidence: {
      rolesCovered: roles,
      fullRecipeVariants: envelope.ir.children.length,
      pairedCellsPerSource: 64,
      semanticReactAndWebComponentOutputs: 256,
      acquisitionFactsSelected: Object.fromEntries(
        INPUT_FIELD_COMPARISON_LIBRARIES.map((library) => [
          library,
          receipt.nonvisualEvidence.acquisitionAccounting[library]!
            .factsSelected,
        ]),
      ),
      acquisitionParameterFields: Object.fromEntries(
        INPUT_FIELD_COMPARISON_LIBRARIES.map((library) => [
          library,
          receipt.nonvisualEvidence.acquisitionAccounting[library]!
            .parameterFields,
        ]),
      ),
      twoCycleCanonicalFixedPoint: Object.fromEntries(
        INPUT_FIELD_COMPARISON_LIBRARIES.map((library) => [library, true]),
      ),
      deterministicEmission: Object.fromEntries(
        INPUT_FIELD_COMPARISON_LIBRARIES.map((library) => [library, true]),
      ),
      noLibraryBranches: true,
      accounting: "passed-offline",
    },
    sourceProvenance: {
      sourceCommit: receipt.provenance.sourceCommit,
      comparisonFixtureHash: receipt.provenance.comparisonFixtureHash,
      sampleMatrixHash: receipt.matrix.sampleMatrixHash,
      environmentHash: receipt.provenance.environmentHash,
      browser: receipt.provenance.environment.browser,
      browserRevision: receipt.provenance.environment.browserRevision,
      browserExecutableHash:
        receipt.provenance.environment.browserExecutableHash,
      fontsHash: receipt.provenance.environment.fontsHash,
    },
    sourceReferences: cellKeys.map((cellKey) => {
      const provenance = v1Receipt.comparisonPin.referenceProvenance[cellKey]!;
      return {
        cellKey,
        screenshotHash: receipt.immutableInputs.referenceHashes[cellKey]!,
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
          completeSetWeighted: legacySetScore,
        },
        recipeReact: {
          cellWeighted: recipeCellScore,
          completeSetWeighted: recipeSetScore,
        },
      },
      bySource,
      bySize: groupedPairs(INPUT_FIELD_COMPARISON_SIZES, mapping, "size"),
      byState: groupedPairs(INPUT_FIELD_COMPARISON_STATES, mapping, "state"),
      byContentMode: groupedPairs(
        INPUT_FIELD_COMPARISON_CONTENT,
        mapping,
        "contentMode",
      ),
      byRequired: groupedPairs(
        INPUT_FIELD_COMPARISON_REQUIRED,
        mapping,
        "required",
      ),
      byAdornments: groupedPairs(
        INPUT_FIELD_COMPARISON_ADORNMENTS,
        mapping,
        "adornments",
      ),
      byConfidence: groupedPairs(
        CONFIDENCES.filter((confidence) =>
          mapping.some((grade) => grade.confidence === confidence),
        ),
        mapping,
        "confidence",
      ),
      pairedOutcomes,
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
        legacy: legacyDefects,
        recipeReact: recipeDefects,
      },
    },
    webComponentParity: {
      keptSeparateFromBlindRecognisability: true,
      recognisability: "not-blind-graded",
      cells: 128,
      nonzeroCells: 128,
      pixelComparisons: 128,
      byteHashEqualToReact,
      renderedPixelHashEqualToReact,
      perceptualThreshold: 0.1,
      perceptualPixelEqualToReact: 128,
      geometryEqualToReact: 128,
      semanticProbeEqualToReact: 128,
    },
    comparisonHistory: {
      immutableV1: {
        artifact: `${V1_ROOT}/comparison-result.json`,
        artifactHash: sha256(v1ArtifactBytes),
        referencesAndLegacyBytesRetained: true,
        legacyCellWeighted:
          v1Artifact.aggregates.byImplementation.legacy.cellWeighted,
        recipeReactCellWeighted:
          v1Artifact.aggregates.byImplementation.recipeReact.cellWeighted,
        legacyCompleteSetWeighted:
          v1Artifact.aggregates.byImplementation.legacy.completeSetWeighted,
        recipeReactCompleteSetWeighted:
          v1Artifact.aggregates.byImplementation.recipeReact
            .completeSetWeighted,
      },
      correctedV2: {
        legacyCellWeighted: legacyCellScore,
        recipeReactCellWeighted: recipeCellScore,
        legacyCompleteSetWeighted: legacySetScore,
        recipeReactCompleteSetWeighted: recipeSetScore,
      },
    },
    evidenceColumns: {
      offlineImplementation: "passed",
      pairedBlindRecognisability:
        offlineCriterion === "passed" ? "passed" : "failed",
      webComponentParity: "passed-parity-only",
      liveFigma: "pending",
      reflow: "pending",
      variantSwitching: "pending",
      tokenBinding: "pending",
      noFakeLayout: "pending",
      liveTwoCycleFixedPoint: "pending",
      accounting: "passed-offline-pending-live",
      liveCanvasGrade: "pending",
      overallInputSuccess: false,
    },
    verdict: {
      offlineDifficultControlCriterion: offlineCriterion,
      comparison,
      recipeMatchedOrBeatLegacy,
      noHiddenDenominatorReduction: true,
      strictStructuralSemanticWcEvidence: true,
      cellDelta: recipeCellScore.numerator - legacyCellScore.numerator,
      completeSetDelta: recipeSetScore.numerator - legacySetScore.numerator,
      inputSuccess: false,
      diagnosis: [
        `corrected recipe React passed ${recipeCellScore.numerator}/128 cells versus unchanged legacy ${legacyCellScore.numerator}/128`,
        `MUI corrected recipe React ${bySource.mui!.recipeReact.numerator}/64 versus unchanged legacy ${bySource.mui!.legacy.numerator}/64`,
        `Polaris corrected recipe React ${bySource.polaris!.recipeReact.numerator}/64 versus unchanged legacy ${bySource.polaris!.legacy.numerator}/64`,
        `corrected recipe React has ${recipeDefects.failedSpecimens} failed specimens and ${recipeDefects.statements} defect statements; unchanged legacy has ${legacyDefects.failedSpecimens} and ${legacyDefects.statements}`,
      ],
      blockers,
      nextTask:
        offlineCriterion === "passed"
          ? "Run the versioned page-scoped Input/Field live mint/readback on Scratch, then obtain an independent live canvas grade."
          : "Diagnose the retained v2 defect classes without changing grades or silently creating v3.",
    },
  };
}

export function validateCommittedInputFieldV2Adjudication(
  artifact: InputFieldV2ComparisonAdjudication,
  sourceBytes: InputFieldV2AdjudicationSourceBytes = readInputFieldV2AdjudicationSources(),
): InputFieldV2ComparisonAdjudication {
  const hashes = {
    packet: sha256(sourceBytes.packet),
    grades: sha256(sourceBytes.grades),
    sealedAnswerKey: sha256(sourceBytes.key),
    evidenceReceipt: sha256(sourceBytes.receipt),
    immutableV1Adjudication: fileHash(`${V1_ROOT}/comparison-result.json`),
    immutableV1Receipt: fileHash(`${V1_ROOT}/receipt.json`),
  };
  assert(
    JSON.stringify(artifact.inputHashes) === JSON.stringify(hashes),
    "adjudication is stale: packet/grade/key/receipt/v1 bytes changed",
  );
  const recomputed = adjudicateInputFieldV2Comparison(sourceBytes);
  assert(
    JSON.stringify(artifact) === JSON.stringify(recomputed),
    "adjudication mapping, aggregate arithmetic, or verdict differs from recomputation",
  );
  return recomputed;
}

export const readCommittedInputFieldV2Adjudication =
  (): InputFieldV2ComparisonAdjudication =>
    validateCommittedInputFieldV2Adjudication(
      parse<InputFieldV2ComparisonAdjudication>(
        "committed Input/Field v2 adjudication",
        readFileSync(INPUT_FIELD_V2_ADJUDICATION_PATH, "utf8"),
      ),
    );

const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const result = adjudicateInputFieldV2Comparison(
    readInputFieldV2AdjudicationSources(),
  );
  if (process.argv.includes("--write")) {
    const bytes = await format(JSON.stringify(result), { parser: "json" });
    writeFileSync(INPUT_FIELD_V2_ADJUDICATION_PATH, bytes);
    console.log(
      `WROTE ${INPUT_FIELD_V2_ADJUDICATION_PATH} sha256=${sha256(bytes)}`,
    );
  } else {
    const committedBytes = readFileSync(
      INPUT_FIELD_V2_ADJUDICATION_PATH,
      "utf8",
    );
    validateCommittedInputFieldV2Adjudication(
      parse<InputFieldV2ComparisonAdjudication>(
        "committed Input/Field v2 adjudication",
        committedBytes,
      ),
    );
    console.log(
      `Input/Field v2 adjudication: ${result.aggregates.byImplementation.legacy.cellWeighted.numerator}/128 unchanged legacy vs ${result.aggregates.byImplementation.recipeReact.cellWeighted.numerator}/128 corrected recipe React; offline criterion ${result.verdict.offlineDifficultControlCriterion}; sha256=${sha256(committedBytes)}`,
    );
  }
}
