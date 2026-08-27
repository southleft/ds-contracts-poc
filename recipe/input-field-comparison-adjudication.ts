import { createHash } from "node:crypto";
import {
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

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
  validatePinnedComparisonEvidence,
  type BlindGradeProtocol,
  type ComparisonOutputManifest,
  type PinnedComparisonFixture,
  type SourceReferenceProvenance,
} from "./comparison.js";
import { canonicalInputFieldRecipeInstance } from "./fixtures/input-field.js";
import type { IRNode } from "./figma-ir.js";
import { compileInputFieldRecipe } from "./recipes/input-field.js";

const ROOT = "recipe/evidence/input-field-comparison";
const BLIND_ROOT = `${ROOT}/blind-packet`;
export const INPUT_FIELD_ADJUDICATION_PATH = `${ROOT}/comparison-result.json`;
const IMPLEMENTATIONS = ["legacy", "recipe-react"] as const;
const CONFIDENCES = ["low", "medium", "high"] as const;
const IMPLEMENTATION_IDENTITY =
  /\blegacy\b|\brecipe(?:[- /]?react)?\b|\bweb[ -]?component\b|\bmui\b|\bpolaris\b|@shopify|@mui/i;
const IMPLEMENTATION_GUESS =
  /\blegacy\b|\brecipe(?:[- /]?react)?\b|\bweb[ -]?component\b|\bimplementation(?: path| guess)?\b|\bexpected[ -]?winner\b/i;

type Implementation = (typeof IMPLEMENTATIONS)[number];
type Confidence = (typeof CONFIDENCES)[number];

interface CapturedArtifact {
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
    required: boolean;
    disabled: boolean;
    ariaInvalid: string | null;
  };
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
  historicalInputFieldContext: {
    sets: number;
    recognisableSets: number;
    totalVariants: number;
    variantWeightedSetVerdict: string;
    changed: boolean;
    whyNotPairedBaseline: string;
  };
  matrix: {
    frozenBeforeRender: boolean;
    sampleMatrixHash: string;
    axesCompared: string[];
    values: Record<string, string[]>;
    recipeVariantsPerSource: number;
    pairedCellsPerSource: number;
    libraries: number;
    totalSourceCells: number;
    cells: InputFieldComparisonCell[];
    everyAxisValueCovered: boolean;
    everyCellMapsExactlyOncePerSource: boolean;
  };
  provenance: {
    sourceCommit: string;
    fixtureHash: string;
    harnessHash: string;
    captureCommand: string;
    captureCommandHash: string;
    sourceAdapterHashes: Record<string, string>;
    packages: Record<
      string,
      {
        packageName: string;
        exactVersion: string;
        sandboxPackageJsonHash: string;
        packageJsonHash: string;
        packageLockHash: string;
        packageIntegrity: string;
        installedSourceTreeHash: string;
        sourceHash: string;
      }
    >;
    environment: {
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
    };
    environmentHash: string;
  };
  references: CapturedArtifact[];
  outputs: {
    legacy: CapturedArtifact[];
    recipeReact: CapturedArtifact[];
    recipeWebComponent: CapturedArtifact[];
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
    blindReferences: number;
    blindSpecimens: number;
  };
  comparisonCompleteness: {
    sourceCells: string;
    legacyCells: string;
    recipeReactCells: string;
    recipeWebComponentCells: string;
    packetReferences: string;
    packetSpecimens: string;
    exactDenominatorParity: boolean;
    claimsRestrictedToFrozenMatrix: boolean;
    legacyCellSupport: Array<{
      cellKey: string;
      outputPresent: boolean;
      unsupportedMappings: string[];
    }>;
    nonComparableBlockers: string[];
  };
  nonvisualEvidence: {
    zeroPixelComparisons: number;
    sourceReferenceIndependence: boolean;
    sourceReferenceProvenanceComplete: boolean;
    acquisitionAccounting: Record<
      string,
      {
        factsSelected: number;
        byCategory: Record<string, number>;
        mappingCount: number;
        setupSeconds: number;
        unsupportedCells: number;
        failures: string[];
      }
    >;
    deterministicEmission: Record<
      string,
      {
        byteIdenticalTwoRun: boolean;
        reactHash: string;
        webComponentHash: string;
      }
    >;
    semanticApiAria: {
      labelInputAssociation: string;
      nativeRequired: string;
      nativeDisabled: string;
      ariaInvalid: string;
      ariaDescribedBy: string;
      contentPolicy: string;
      adornments: string;
      events: Record<
        string,
        Record<"react" | "webComponent", Record<string, boolean>>
      >;
    };
    recipeWebComponentParity: {
      cells: number;
      nonzeroCells: number;
      pixelHashEqualToReact: number;
      geometryEqualToReact: number;
      semanticProbeEqualToReact: number;
      includedInBlindSpecimens: boolean;
    };
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
  protocol: BlindGradeProtocol;
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
  grader: { identity: string; mode: string };
  packetVersion: string;
  packetProtocol: BlindGradeProtocol;
  randomizedBatchHash: string;
  counts: {
    references: number;
    specimens: number;
    grades: number;
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

export interface InputFieldAdjudicationSourceBytes {
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

export interface InputFieldComparisonAdjudication {
  artifactVersion: "input-field-comparison-adjudication-v1";
  protocol: {
    packet: string;
    gradePacket: string;
    answerKey: string;
    evidenceReceipt: number;
    randomizedBatchHash: string;
    rubricHash: string;
    environmentHash: string;
  };
  inputHashes: {
    packet: string;
    grades: string;
    sealedAnswerKey: string;
    evidenceReceipt: string;
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
    historicalContext: {
      setWeighted: "3/11";
      variantWeightedSetVerdict: "1349/1415";
      pairedBaseline: false;
    };
  };
  structuralSemanticEvidence: {
    rolesCovered: string[];
    fullRecipeVariants: number;
    pairedCellsPerSource: number;
    semanticReactAndWebComponentOutputs: number;
    requiredFactsMeasured: string;
    acquisitionFactsSelected: Record<string, number>;
    accounting: "passed-offline";
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
    keptSeparateFromBlindRecognisability: true;
    recognisability: "not-blind-graded";
    cells: 128;
    nonzeroCells: 128;
    pixelHashEqualToReact: 128;
    geometryEqualToReact: 128;
    semanticProbeEqualToReact: 128;
  };
  evidenceColumns: {
    offlineImplementation: "passed";
    pairedBlindRecognisability: "failed";
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
    offlineDifficultControlCriterion: "failed";
    comparison: "recipe-underperformed";
    recipeMatchedOrBeatLegacy: false;
    noHiddenDenominatorReduction: true;
    strictStructuralSemanticWcEvidence: true;
    suspiciousSplitVerified: string;
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
  allowed: readonly string[],
  label: string,
): void => {
  const actual = Object.keys(value).sort();
  const expected = [...allowed].sort();
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
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

const cachedFileHashes = new Map<string, string>();
const fileHash = (file: string): string => {
  const absolute = path.resolve(file);
  const existing = cachedFileHashes.get(absolute);
  if (existing) return existing;
  const hash = sha256(readFileSync(absolute));
  cachedFileHashes.set(absolute, hash);
  return hash;
};

const relative = (file: string): string =>
  path.relative(process.cwd(), file).split(path.sep).join("/");

const hashFiles = (files: string[]): string => {
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(`${relative(path.resolve(file))}\0`);
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  return hash.digest("hex");
};

const cachedTreeHashes = new Map<string, string>();
const treeHash = (root: string): string => {
  const absoluteRoot = path.resolve(root);
  const existing = cachedTreeHashes.get(absoluteRoot);
  if (existing) return existing;
  const hash = createHash("sha256");
  const walk = (directory: string): void => {
    for (const name of readdirSync(directory).sort()) {
      const full = path.join(directory, name);
      const rel = path.relative(absoluteRoot, full).split(path.sep).join("/");
      const stat = lstatSync(full);
      if (stat.isDirectory()) {
        hash.update(`d\0${rel}\0`);
        walk(full);
      } else if (stat.isSymbolicLink()) {
        hash.update(`l\0${rel}\0${stat.size}\0`);
      } else {
        hash.update(`f\0${rel}\0${stat.size}\0`);
        hash.update(readFileSync(full));
      }
    }
  };
  walk(absoluteRoot);
  const result = hash.digest("hex");
  cachedTreeHashes.set(absoluteRoot, result);
  return result;
};

const assertContainedFile = (file: string, directory: string): string => {
  assert(!path.isAbsolute(file), `${file} must be repository-relative`);
  const absoluteDirectory = path.resolve(directory);
  const absoluteFile = path.resolve(file);
  const lexical = path.relative(absoluteDirectory, absoluteFile);
  assert(
    lexical !== "" && !lexical.startsWith("..") && !path.isAbsolute(lexical),
    `${file} escapes ${directory}`,
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

const assertCapturedArtifacts = (
  artifacts: readonly CapturedArtifact[],
  expectedDirectory: string,
  expectedCells: readonly string[],
): void => {
  assert(artifacts.length === 128, `${expectedDirectory} cardinality differs`);
  assert(
    new Set(artifacts.map((artifact) => artifact.cellKey)).size === 128 &&
      artifacts.map((artifact) => artifact.cellKey).join("\0") ===
        expectedCells.join("\0"),
    `${expectedDirectory} cell mapping differs`,
  );
  assert(
    new Set(artifacts.map((artifact) => artifact.file)).size === 128,
    `${expectedDirectory} contains duplicate artifact paths`,
  );
  for (const artifact of artifacts) {
    const realFile = assertContainedFile(artifact.file, expectedDirectory);
    assert(
      fileHash(realFile) === artifact.hash,
      `${artifact.file} hash differs`,
    );
    assert(
      Number.isFinite(artifact.width) &&
        artifact.width > 0 &&
        Number.isFinite(artifact.height) &&
        artifact.height > 0 &&
        Number.isSafeInteger(artifact.paintedPixels) &&
        artifact.paintedPixels > 0,
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
  if (/width-to-height proportions/i.test(defect)) return "field-proportions";
  if (/border, fill, or ink state treatment/i.test(defect)) {
    return "border-fill-or-state-treatment";
  }
  if (/label\/helper text structure or vertical spacing/i.test(defect)) {
    return "label-helper-structure-or-spacing";
  }
  if (/input outline, internal padding, and element alignment/i.test(defect)) {
    return "input-outline-padding-or-alignment";
  }
  return "other";
};

const defectAggregate = (
  grades: readonly UnsealedGrade[],
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
    node.role !== "input-field/message-container"
  ) {
    roles.add(node.role);
  }
  if ("children" in node) {
    for (const child of node.children) collectRoles(child, roles);
  }
  return roles;
};

const validateProvenance = (receipt: Receipt): void => {
  // V1 is a sealed historical batch. Its source/configuration files may evolve
  // for a separately versioned correction, so v1 validates the fixture hash
  // frozen into both sealed structures instead of reinterpreting current files.
  assert(
    /^[a-f0-9]{64}$/.test(receipt.provenance.fixtureHash) &&
      receipt.comparisonPin.fixtureHash === receipt.provenance.fixtureHash &&
      receipt.manifests.legacy.fixtureHash === receipt.provenance.fixtureHash &&
      receipt.manifests.recipeReact.fixtureHash ===
        receipt.provenance.fixtureHash &&
      receipt.manifests.recipeWebComponentParity.fixtureHash ===
        receipt.provenance.fixtureHash,
    "sealed v1 fixture hash differs across receipt, pin, or manifests",
  );
  assert(
    receipt.provenance.harnessHash ===
      fileHash("recipe/capture-input-field-comparison.ts"),
    "capture harness hash differs",
  );
  assert(
    receipt.provenance.captureCommandHash ===
      sha256(receipt.provenance.captureCommand),
    "capture command hash differs",
  );
  assert(
    receipt.provenance.sourceCommit === receipt.comparisonPin.sourceCommit &&
      /^[a-f0-9]{40}$/.test(receipt.provenance.sourceCommit),
    "source commit provenance differs",
  );
  assert(
    receipt.provenance.environmentHash ===
      sha256(JSON.stringify(receipt.provenance.environment)),
    "environment hash differs",
  );
  const fontFiles = receipt.provenance.environment.fonts.map((font) => {
    assertContainedFile(font.file, "extract/computed/fonts");
    assert(fileHash(font.file) === font.hash, `${font.file} hash differs`);
    return font.file;
  });
  assert(
    receipt.provenance.environment.fontsHash === hashFiles(fontFiles) &&
      receipt.comparisonPin.protocol.fontsHash ===
        receipt.provenance.environment.fontsHash,
    "font-set hash differs",
  );
  assert(
    receipt.comparisonPin.protocol.environmentHash ===
      receipt.provenance.environmentHash,
    "protocol environment differs",
  );

  for (const library of INPUT_FIELD_COMPARISON_LIBRARIES) {
    const adapter = REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS[library];
    const pin = receipt.provenance.packages[library]!;
    const sandbox = adapter.sandbox;
    const packageRoot = path.join(
      sandbox,
      "node_modules",
      ...adapter.packageName.split("/"),
    );
    const packageJson = `${packageRoot}/package.json`;
    const lockFile = `${sandbox}/package-lock.json`;
    const installedTreeHash = treeHash(packageRoot);
    const adapterHash = sha256(JSON.stringify(adapter));
    const packageData = parse<{ version: string }>(
      `${library} package.json`,
      readFileSync(packageJson, "utf8"),
    );
    const lock = parse<{
      packages: Record<string, { version?: string; integrity?: string }>;
    }>(`${library} package-lock`, readFileSync(lockFile, "utf8"));
    const lockEntry = lock.packages[`node_modules/${adapter.packageName}`];
    assert(
      pin.packageName === adapter.packageName &&
        pin.exactVersion === adapter.exactVersion &&
        packageData.version === adapter.exactVersion &&
        lockEntry?.version === adapter.exactVersion &&
        lockEntry.integrity === pin.packageIntegrity,
      `${library} package identity or lock integrity differs`,
    );
    assert(
      pin.sandboxPackageJsonHash === fileHash(`${sandbox}/package.json`) &&
        pin.packageJsonHash === fileHash(packageJson) &&
        pin.packageLockHash === fileHash(lockFile) &&
        pin.installedSourceTreeHash === installedTreeHash &&
        pin.sourceHash ===
          sha256(
            `${adapter.packageName}\0${adapter.exactVersion}\0${installedTreeHash}`,
          ),
      `${library} package provenance hash differs`,
    );
    assert(
      receipt.provenance.sourceAdapterHashes[library] === adapterHash,
      `${library} reviewed source-adapter hash differs`,
    );
  }

  const cellKeys = receipt.comparisonPin.cellKeys;
  assert(
    Object.keys(receipt.comparisonPin.referenceHashes).length === 128 &&
      Object.keys(receipt.comparisonPin.referenceProvenance).length === 128,
    "source-reference provenance cardinality differs",
  );
  for (const cellKey of cellKeys) {
    const cell = receipt.matrix.cells.find(
      (candidate) => candidate.key === cellKey,
    );
    const provenance = receipt.comparisonPin.referenceProvenance[cellKey];
    assert(cell && provenance, `${cellKey} provenance is absent`);
    const library = cell.library;
    const adapter = REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS[library];
    const pin = receipt.provenance.packages[library]!;
    const expectedCaptureInputHash = sha256(
      [
        pin.sourceHash,
        receipt.provenance.sourceAdapterHashes[library],
        receipt.provenance.harnessHash,
        receipt.provenance.environmentHash,
        cellKey,
        receipt.provenance.captureCommand,
      ].join("\0"),
    );
    assert(
      provenance.sourceKind === "external-library-package" &&
        provenance.externalOwner === adapter.externalOwner &&
        provenance.sourceId === adapter.packageName &&
        provenance.sourceVersionOrRevision === adapter.exactVersion &&
        provenance.sourceHash === pin.sourceHash &&
        provenance.packageLockHash === pin.packageLockHash &&
        provenance.packageIntegrity === pin.packageIntegrity &&
        provenance.componentOrNodeId === adapter.component &&
        provenance.sourceAdapterHash ===
          receipt.provenance.sourceAdapterHashes[library] &&
        provenance.renderHarnessHash === receipt.provenance.harnessHash &&
        provenance.captureInputHash === expectedCaptureInputHash &&
        provenance.environmentHash === receipt.provenance.environmentHash &&
        provenance.browser === receipt.comparisonPin.protocol.browser &&
        provenance.browserRevision ===
          receipt.provenance.environment.browserRevision &&
        provenance.browserExecutableHash ===
          receipt.provenance.environment.browserExecutableHash &&
        provenance.fontsHash === receipt.provenance.environment.fontsHash &&
        provenance.cellKey === cellKey &&
        provenance.screenshotHash ===
          receipt.comparisonPin.referenceHashes[cellKey] &&
        provenance.captureCommand === receipt.provenance.captureCommand &&
        provenance.producedBy ===
          "independent-original-package-component-harness" &&
        provenance.independentHarness === true,
      `${cellKey} source provenance is incomplete or inconsistent`,
    );
  }
};

const validateStructuralSemanticEvidence = (
  receipt: Receipt,
): { roles: string[]; fullRecipeVariants: number } => {
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
    JSON.stringify(roles) === JSON.stringify(requiredRoles),
    "strict Input/Field structural roles differ",
  );
  assert(
    envelope.ir.children.length === 128 &&
      receipt.matrix.recipeVariantsPerSource === 128,
    "full recipe structural denominator differs",
  );
  assert(
    receipt.nonvisualEvidence.sourceReferenceIndependence === true &&
      receipt.nonvisualEvidence.sourceReferenceProvenanceComplete === true &&
      receipt.nonvisualEvidence.zeroPixelComparisons === 0,
    "source, provenance, or pixel evidence is incomplete",
  );
  const semantics = receipt.nonvisualEvidence.semanticApiAria;
  assert(
    semantics.labelInputAssociation === "256/256 recipe outputs" &&
      semantics.nativeRequired === "256/256 recipe outputs match cells" &&
      semantics.nativeDisabled === "256/256 recipe outputs match cells" &&
      semantics.ariaInvalid === "256/256 recipe outputs match cells" &&
      semantics.contentPolicy ===
        "256/256 recipe outputs match value/placeholder cells" &&
      semantics.adornments === "256/256 recipe outputs match none/both cells" &&
      semantics.ariaDescribedBy.length > 0 &&
      Object.values(semantics.events).every((surfaces) =>
        Object.values(surfaces).every((events) =>
          Object.values(events).every(Boolean),
        ),
      ),
    "semantic/API/ARIA evidence is incomplete",
  );
  for (const library of INPUT_FIELD_COMPARISON_LIBRARIES) {
    const accounting =
      receipt.nonvisualEvidence.acquisitionAccounting[library]!;
    assert(
      accounting.factsSelected === 12 &&
        accounting.mappingCount === 20 &&
        accounting.setupSeconds > 0 &&
        accounting.unsupportedCells > 0 &&
        accounting.failures.length === 0 &&
        ["geometry", "typography", "fill", "state", "semantics"].every(
          (category) => accounting.byCategory[category]! > 0,
        ),
      `${library} acquisition accounting is incomplete`,
    );
    assert(
      receipt.nonvisualEvidence.deterministicEmission[library]!
        .byteIdenticalTwoRun === true,
      `${library} emission is nondeterministic`,
    );
  }
  return { roles, fullRecipeVariants: envelope.ir.children.length };
};

export const readInputFieldAdjudicationSources =
  (): InputFieldAdjudicationSourceBytes => ({
    packet: readFileSync(`${BLIND_ROOT}/packet.json`, "utf8"),
    grades: readFileSync(`${BLIND_ROOT}/grades.json`, "utf8"),
    key: readFileSync(`${ROOT}/sealed-answer-key.json`, "utf8"),
    receipt: readFileSync(`${ROOT}/receipt.json`, "utf8"),
  });

export function adjudicateInputFieldComparison(
  sourceBytes: InputFieldAdjudicationSourceBytes,
): InputFieldComparisonAdjudication {
  const packet = parse<BlindPacket>("blind packet", sourceBytes.packet);
  const gradeBatch = parse<GradeBatch>("grade batch", sourceBytes.grades);
  const answerKey = parse<AnswerKey>("sealed answer key", sourceBytes.key);
  const receipt = parse<Receipt>("comparison receipt", sourceBytes.receipt);

  assert(
    receipt.blindPacket.path === `${BLIND_ROOT}/packet.json` &&
      receipt.blindPacket.sealedAnswerKey ===
        `${ROOT}/sealed-answer-key.json` &&
      path.dirname(receipt.blindPacket.path) !==
        path.dirname(receipt.blindPacket.sealedAnswerKey),
    "packet/key separation is not intact",
  );
  assertContainedFile(receipt.blindPacket.path, BLIND_ROOT);
  assertContainedFile(receipt.blindPacket.sealedAnswerKey, ROOT);
  assert(
    !IMPLEMENTATION_IDENTITY.test(sourceBytes.packet),
    "blind packet discloses implementation identity",
  );
  assert(
    !IMPLEMENTATION_GUESS.test(sourceBytes.grades),
    "grades contain an implementation guess",
  );
  assert(
    sha256(sourceBytes.packet) === receipt.blindPacket.packetHash,
    "packet bytes differ from the sealed receipt hash",
  );
  assert(
    packet.version === gradeBatch.packetVersion &&
      packet.version === answerKey.version &&
      packet.version === receipt.comparisonPin.protocol.version,
    "packet, grades, key, and receipt protocol versions differ",
  );
  assert(
    JSON.stringify(packet.protocol) ===
      JSON.stringify(gradeBatch.packetProtocol) &&
      JSON.stringify(packet.protocol) ===
        JSON.stringify(receipt.comparisonPin.protocol),
    "packet, grades, and receipt protocols differ",
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
  assert(
    gradeBatch.grader.identity.length > 0 &&
      gradeBatch.grader.mode === "independent-blind-visual",
    "independent grader identity/mode is absent",
  );

  validateInputFieldComparisonMatrix(receipt.matrix.cells);
  const cellKeys = receipt.matrix.cells.map((cell) => cell.key);
  assert(
    receipt.matrix.frozenBeforeRender === true &&
      receipt.matrix.sampleMatrixHash ===
        sha256(JSON.stringify(INPUT_FIELD_COMPARISON_CELLS)) &&
      receipt.matrix.sampleMatrixHash ===
        receipt.comparisonPin.sampleMatrixHash &&
      JSON.stringify(receipt.matrix.cells) ===
        JSON.stringify(INPUT_FIELD_COMPARISON_CELLS) &&
      cellKeys.join("\0") === receipt.comparisonPin.cellKeys.join("\0") &&
      receipt.matrix.everyAxisValueCovered === true &&
      receipt.matrix.everyCellMapsExactlyOncePerSource === true,
    "frozen matrix hash, order, uniqueness, or coverage differs",
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
  assert(
    receipt.comparisonCompleteness.sourceCells === "128/128" &&
      receipt.comparisonCompleteness.legacyCells === "128/128" &&
      receipt.comparisonCompleteness.recipeReactCells === "128/128" &&
      receipt.comparisonCompleteness.recipeWebComponentCells === "128/128" &&
      receipt.comparisonCompleteness.packetReferences === "128/128" &&
      receipt.comparisonCompleteness.packetSpecimens === "256/256" &&
      receipt.comparisonCompleteness.exactDenominatorParity === true &&
      receipt.comparisonCompleteness.claimsRestrictedToFrozenMatrix === true &&
      receipt.comparisonCompleteness.nonComparableBlockers.length === 0 &&
      receipt.comparisonCompleteness.legacyCellSupport.length === 128 &&
      receipt.comparisonCompleteness.legacyCellSupport.every(
        (cell) => cell.outputPresent,
      ),
    "comparison completeness or denominator parity differs",
  );

  validatePinnedComparisonEvidence(
    receipt.comparisonPin,
    receipt.manifests.legacy,
    receipt.manifests.recipeReact,
  );
  validatePinnedComparisonEvidence(
    receipt.comparisonPin,
    receipt.manifests.recipeReact,
    receipt.manifests.recipeWebComponentParity,
  );
  for (const manifest of Object.values(receipt.manifests)) {
    assert(
      manifest.cells.length === 128 &&
        manifest.cells.map((cell) => cell.cellKey).join("\0") ===
          cellKeys.join("\0") &&
        manifest.cells.every(
          (cell) =>
            Number.isSafeInteger(cell.comparedPixels) &&
            cell.comparedPixels > 0,
        ),
      "manifest denominator, order, or nonzero pixel evidence differs",
    );
  }

  assertCapturedArtifacts(
    receipt.references,
    `${ROOT}/source-reference`,
    cellKeys,
  );
  assertCapturedArtifacts(receipt.outputs.legacy, `${ROOT}/legacy`, cellKeys);
  assertCapturedArtifacts(
    receipt.outputs.recipeReact,
    `${ROOT}/recipe-react`,
    cellKeys,
  );
  assertCapturedArtifacts(
    receipt.outputs.recipeWebComponent,
    `${ROOT}/recipe-wc`,
    cellKeys,
  );
  validateProvenance(receipt);
  const structural = validateStructuralSemanticEvidence(receipt);

  const referenceByCell = new Map(
    receipt.references.map((reference) => [reference.cellKey, reference]),
  );
  const artifactByImplementation = {
    legacy: new Map(
      receipt.outputs.legacy.map((artifact) => [artifact.cellKey, artifact]),
    ),
    "recipe-react": new Map(
      receipt.outputs.recipeReact.map((artifact) => [
        artifact.cellKey,
        artifact,
      ]),
    ),
  };
  const wcByCell = new Map(
    receipt.outputs.recipeWebComponent.map((artifact) => [
      artifact.cellKey,
      artifact,
    ]),
  );
  for (const artifact of receipt.outputs.recipeReact) {
    const wc = wcByCell.get(artifact.cellKey);
    const manifestReact = receipt.manifests.recipeReact.cells.find(
      (cell) => cell.cellKey === artifact.cellKey,
    );
    const manifestWc = receipt.manifests.recipeWebComponentParity.cells.find(
      (cell) => cell.cellKey === artifact.cellKey,
    );
    assert(
      wc &&
        manifestReact &&
        manifestWc &&
        wc.hash === artifact.hash &&
        JSON.stringify(wc.contentBox) === JSON.stringify(artifact.contentBox) &&
        JSON.stringify(wc.dom) === JSON.stringify(artifact.dom) &&
        manifestReact.outputHash === manifestWc.outputHash,
      `${artifact.cellKey} React/Web Component parity differs`,
    );
    const matrixCell = receipt.matrix.cells.find(
      (cell) => cell.key === artifact.cellKey,
    )!;
    assert(
      artifact.dom.inputFound &&
        artifact.dom.labelFound &&
        artifact.dom.labelForMatches &&
        artifact.dom.accessibleNameMatched &&
        artifact.dom.required === (matrixCell.required === "true") &&
        artifact.dom.disabled === (matrixCell.state === "disabled") &&
        artifact.dom.ariaInvalid ===
          (matrixCell.state === "error" ? "true" : null),
      `${artifact.cellKey} semantic DOM evidence differs`,
    );
  }
  assert(
    JSON.stringify(receipt.nonvisualEvidence.recipeWebComponentParity) ===
      JSON.stringify({
        cells: 128,
        nonzeroCells: 128,
        pixelHashEqualToReact: 128,
        geometryEqualToReact: 128,
        semanticProbeEqualToReact: 128,
        includedInBlindSpecimens: false,
      }),
    "Web Component parity evidence differs",
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
  assert(
    new Set(packet.cells.map((cell) => cell.anonymousCell)).size === 128 &&
      packetEntries.length === 256 &&
      new Set(packetEntries.map((entry) => entry.specimen.anonymousLabel))
        .size === 256,
    "packet cell/specimen mapping is not unique",
  );

  exactKeys(
    gradeBatch as unknown as Record<string, unknown>,
    [
      "grader",
      "packetVersion",
      "packetProtocol",
      "randomizedBatchHash",
      "counts",
      "grades",
    ],
    "grade batch",
  );
  const gradeIds = gradeBatch.grades.map((grade) => grade.specimenId);
  assert(
    gradeBatch.grades.length === 256 && new Set(gradeIds).size === 256,
    "grades do not contain exactly one grade per specimen",
  );
  const packetIds = new Set(
    packetEntries.map((entry) => entry.specimen.anonymousLabel),
  );
  assert(
    gradeIds.every((id) => packetIds.has(id)),
    "grade references a specimen outside the packet",
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
        ),
      `${grade.specimenId} grade fields are invalid`,
    );
    assert(
      grade.recognisable || grade.defects.length > 0,
      `${grade.specimenId} failure has no defects`,
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
        notRecognisable: 256 - recognisable,
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

  // All packet, grade, provenance, denominator, pixel, path, and sealed-key
  // checks above must pass before opaque identifiers are unsealed here.
  const packetBySpecimen = new Map(
    packetEntries.map((entry) => [entry.specimen.anonymousLabel, entry]),
  );
  const gradeBySpecimen = new Map(
    gradeBatch.grades.map((grade) => [grade.specimenId, grade]),
  );
  const matrixByCell = new Map(
    receipt.matrix.cells.map((cell) => [cell.key, cell]),
  );
  const pathsByCell = new Map<string, Set<Implementation>>();
  const mapping: UnsealedGrade[] = answerKey.answers.map((answer) => {
    const packetEntry = packetBySpecimen.get(answer.anonymousLabel);
    const grade = gradeBySpecimen.get(answer.anonymousLabel);
    const cell = matrixByCell.get(answer.cellKey);
    const artifact = artifactByImplementation[answer.implementationPath].get(
      answer.cellKey,
    );
    const reference = referenceByCell.get(answer.cellKey);
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
        receipt.comparisonPin.referenceHashes[answer.cellKey] ===
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

  const bySource = groupedPairs(
    INPUT_FIELD_COMPARISON_LIBRARIES,
    mapping,
    "sourceLibrary",
  );
  assert(
    pairedOutcomes.tiedPass === 0 &&
      pairedOutcomes.tiedFail === 0 &&
      pairedOutcomes.recipeBeatLegacy + pairedOutcomes.legacyBeatRecipe ===
        128 &&
      recognisable === 128,
    "the 128/128 grade split is not exactly one recognisable path per paired cell",
  );
  const recipeMatchedOrBeatLegacy =
    recipeCellScore.ratio >= legacyCellScore.ratio &&
    recipeSetScore.ratio >= legacySetScore.ratio;
  assert(
    recipeMatchedOrBeatLegacy === false &&
      legacyCellScore.numerator === 88 &&
      recipeCellScore.numerator === 40,
    "unsealed implementation totals differ from the verified 88/128 legacy and 40/128 recipe result",
  );
  const legacyDefects = defectAggregate(legacy);
  const recipeDefects = defectAggregate(recipeReact);

  return {
    artifactVersion: "input-field-comparison-adjudication-v1",
    protocol: {
      packet: packet.version,
      gradePacket: gradeBatch.packetVersion,
      answerKey: answerKey.version,
      evidenceReceipt: receipt.version,
      randomizedBatchHash: recomputedBatchHash,
      rubricHash: packet.protocol.rubricHash,
      environmentHash: packet.protocol.environmentHash,
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
        sourceProvenanceComplete: true,
        environmentComplete: true,
        packetKeyMappedOnlyAfterIntegrity: true,
      },
    },
    sample: {
      complete: true,
      sourceLibraries: [...INPUT_FIELD_COMPARISON_LIBRARIES],
      axes: receipt.matrix.axesCompared,
      pairedValues: receipt.matrix.values,
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
      historicalContext: {
        setWeighted: "3/11",
        variantWeightedSetVerdict: "1349/1415",
        pairedBaseline: false,
      },
    },
    structuralSemanticEvidence: {
      rolesCovered: structural.roles,
      fullRecipeVariants: structural.fullRecipeVariants,
      pairedCellsPerSource: receipt.matrix.pairedCellsPerSource,
      semanticReactAndWebComponentOutputs: 256,
      requiredFactsMeasured: "5/5",
      acquisitionFactsSelected: Object.fromEntries(
        INPUT_FIELD_COMPARISON_LIBRARIES.map((library) => [
          library,
          receipt.nonvisualEvidence.acquisitionAccounting[library]!
            .factsSelected,
        ]),
      ),
      accounting: "passed-offline",
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
      pixelHashEqualToReact: 128,
      geometryEqualToReact: 128,
      semanticProbeEqualToReact: 128,
    },
    evidenceColumns: {
      offlineImplementation: "passed",
      pairedBlindRecognisability: "failed",
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
      offlineDifficultControlCriterion: "failed",
      comparison: "recipe-underperformed",
      recipeMatchedOrBeatLegacy: false,
      noHiddenDenominatorReduction: true,
      strictStructuralSemanticWcEvidence: true,
      suspiciousSplitVerified:
        "not one implementation path: exactly one path passed in every cell; legacy won 88 cells and recipe React won 40, with zero tied passes or tied failures",
      cellDelta: recipeCellScore.numerator - legacyCellScore.numerator,
      completeSetDelta: recipeSetScore.numerator - legacySetScore.numerator,
      inputSuccess: false,
      diagnosis: [
        `recipe React failed ${recipeDefects.failedSpecimens}/128 cells versus ${legacyDefects.failedSpecimens}/128 legacy cells`,
        `MUI is the largest gap: recipe React ${bySource.mui!.recipeReact.numerator}/64 versus legacy ${bySource.mui!.legacy.numerator}/64`,
        "graded failures consistently identify field proportions, input outline/padding/alignment, label/helper structure/spacing, and border/fill/state treatment",
      ],
      blockers: [
        `recipe React paired recognisability ${recipeCellScore.numerator}/128 is below legacy ${legacyCellScore.numerator}/128`,
        "versioned page-scoped live Figma mint/readback on Scratch is pending",
        "live reflow assertion is pending",
        "live variant-switching assertion is pending",
        "live token-binding assertion is pending",
        "live no-fake-layout assertion is pending",
        "live two-cycle fixed-point evidence is pending",
        "live zero-silent accounting is pending",
        "independent live canvas grade is pending",
      ],
      nextTask:
        "Diagnose and correct the generic Input/Field visual acquisition/configuration against the retained MUI and Polaris references; do not regenerate or regrade until a versioned correction is explicitly authorized.",
    },
  };
}

export function validateCommittedInputFieldAdjudication(
  artifact: InputFieldComparisonAdjudication,
  sourceBytes: InputFieldAdjudicationSourceBytes = readInputFieldAdjudicationSources(),
): InputFieldComparisonAdjudication {
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
  const recomputed = adjudicateInputFieldComparison(sourceBytes);
  assert(
    JSON.stringify(artifact) === JSON.stringify(recomputed),
    "adjudication mapping or aggregate arithmetic differs from recomputation",
  );
  return recomputed;
}

export const readCommittedInputFieldAdjudication =
  (): InputFieldComparisonAdjudication =>
    validateCommittedInputFieldAdjudication(
      parse<InputFieldComparisonAdjudication>(
        "committed Input/Field adjudication",
        readFileSync(INPUT_FIELD_ADJUDICATION_PATH, "utf8"),
      ),
    );

const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const result = adjudicateInputFieldComparison(
    readInputFieldAdjudicationSources(),
  );
  if (process.argv.includes("--write")) {
    const bytes = `${JSON.stringify(result, null, 2)}\n`;
    writeFileSync(INPUT_FIELD_ADJUDICATION_PATH, bytes);
    console.log(
      `WROTE ${INPUT_FIELD_ADJUDICATION_PATH} sha256=${sha256(bytes)}`,
    );
  } else {
    const committedBytes = readFileSync(INPUT_FIELD_ADJUDICATION_PATH, "utf8");
    validateCommittedInputFieldAdjudication(
      parse<InputFieldComparisonAdjudication>(
        "committed Input/Field adjudication",
        committedBytes,
      ),
    );
    console.log(
      `Input/Field adjudication: ${result.aggregates.byImplementation.legacy.cellWeighted.numerator}/128 legacy vs ${result.aggregates.byImplementation.recipeReact.cellWeighted.numerator}/128 recipe React; offline criterion ${result.verdict.offlineDifficultControlCriterion}; sha256=${sha256(committedBytes)}`,
    );
  }
}
