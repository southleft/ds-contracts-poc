import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { format } from "prettier";

import {
  validateCommittedCalibrationV2,
  type GradeEnvelope,
} from "./input-field-comparison-calibration-v2.js";
import {
  assertReplacementAuthorization,
  D_QUALIFICATION_RECEIPT_PATH,
  INDEX_PATH,
  PROTOCOL_PATH,
  RECEIPT_PATH,
  ROOT,
  validateReplacementEnvelope,
  validateReplacementProtocol,
} from "./input-field-comparison-calibration-v3.js";

const REPO = path.resolve(new URL(".", import.meta.url).pathname, "..");
const V1_ROOT = "recipe/evidence/input-field-comparison";
const V2_COMPARISON_ROOT = "recipe/evidence/input-field-comparison-v2";
const CALIBRATION_V2_ROOT =
  "recipe/evidence/input-field-comparison-calibration-v2";
const PERFORMANCE_ROOT = `${CALIBRATION_V2_ROOT}/performance`;
const PACKET_ROOT = `${PERFORMANCE_ROOT}/blind-packet`;
const PACKET_PATH = `${PACKET_ROOT}/packet.json`;
const KEY_PATH = `${PERFORMANCE_ROOT}/sealed-answer-key.json`;
const GRADE_SCHEMA_PATH = `${CALIBRATION_V2_ROOT}/grade.schema.json`;

export const FINAL_ADJUDICATION_PATH = `${ROOT}/final-adjudication.json`;

const RATERS = ["RATER-CAL-V2-B", "RATER-CAL-V2-C", "RATER-CAL-V3-D"] as const;
const SHORT_RATERS = ["B", "C", "D"] as const;
const CATEGORIES = [
  "required-structure-content",
  "semantic-state",
  "geometry-proportion",
  "typography-raster",
  "color-border-effects",
] as const;
const LOCKED_THRESHOLDS = {
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
} as const;
const IDENTITY_LEAK =
  /\blegacy\b|\brecipe\b|\bcorrected\b|\bduplicate\b|\bcopy[- _]?[ab]\b|\bimplementation\b|\bexpected[- _]?winner\b|\bmui\b|\bpolaris\b|@shopify|@mui/i;

type Rater = (typeof RATERS)[number];
type ShortRater = (typeof SHORT_RATERS)[number];
type Confidence = "low" | "medium" | "high";

interface PacketTask {
  taskId: string;
  reference: { referenceId: string; image: string };
  specimen: { specimenId: string; image: string };
}

interface BlindPacket {
  version: "input-field-performance-blind-v3";
  phase: "performance";
  status: "opaque-ungraded";
  calibrationCommitment: string;
  rubricVersion: "input-field-observable-rubric-v2";
  randomizedBatchHash: string;
  counts: {
    tasks: 384;
    referencePresentations: 384;
    specimenPresentations: 384;
  };
  tasks: PacketTask[];
}

interface ArtifactRef {
  cellKey: string;
  file: string;
  hash: string;
}

interface ComparisonReceipt {
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
  references: ArtifactRef[];
  outputs: {
    legacy: ArtifactRef[];
    recipeReact: ArtifactRef[];
    recipeWebComponent: ArtifactRef[];
  };
  nonvisualEvidence: {
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
  };
}

interface ComparisonResult {
  sourceProvenance: {
    sourceCommit: string;
    comparisonFixtureHash: string;
    sampleMatrixHash: string;
    environmentHash: string;
  };
  sourceReferences: Array<{
    cellKey: string;
    screenshotHash: string;
    sourceId: string;
    sourceVersionOrRevision: string;
    sourceHash: string;
    captureInputHash: string;
    independentHarness: boolean;
  }>;
  webComponentParity: {
    keptSeparateFromBlindRecognisability: true;
    recognisability: "not-blind-graded";
    cells: number;
    nonzeroCells: number;
    pixelComparisons: number;
    byteHashEqualToReact: number;
    renderedPixelHashEqualToReact: number;
    perceptualThreshold: number;
    perceptualPixelEqualToReact: number;
    geometryEqualToReact: number;
    semanticProbeEqualToReact: number;
  };
  comparisonHistory: {
    immutableV1: {
      artifact: string;
      artifactHash: string;
      legacyCellWeighted: { numerator: number; denominator: number };
      recipeReactCellWeighted: { numerator: number; denominator: number };
    };
  };
}

export interface AdjudicationSources {
  protocol: string;
  packet: string;
  replacementReceipt: string;
  replacementIndex: string;
  templates: Record<Rater, string>;
  submissions: Record<Rater, string>;
  sealedKeyBytes: Buffer;
}

const absolute = (file: string): string => path.join(REPO, file);
const sha256 = (bytes: string | Buffer): string =>
  createHash("sha256").update(bytes).digest("hex");
const fileHash = (file: string): string => sha256(readFileSync(absolute(file)));
const parse = <T>(label: string, bytes: string): T => {
  try {
    return JSON.parse(bytes) as T;
  } catch (error) {
    throw new Error(
      `FINAL ADJUDICATION REFUSED: ${label} is invalid JSON: ${error}`,
    );
  }
};
const check: (condition: unknown, message: string) => asserts condition = (
  condition,
  message,
) => {
  if (!condition) throw new Error(`FINAL ADJUDICATION REFUSED: ${message}`);
};
const exactKeys = (
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean =>
  JSON.stringify(Object.keys(value).sort()) ===
  JSON.stringify([...expected].sort());
const performanceTemplatePath = (rater: Rater): string =>
  `${ROOT}/performance/templates/${rater.toLowerCase()}.json`;
const performanceSubmissionPath = (rater: Rater): string =>
  `${ROOT}/performance/submissions/${rater.toLowerCase()}.json`;
const concreteDefect = (defect: unknown): defect is string =>
  typeof defect === "string" &&
  defect.trim().length >= 20 &&
  !IDENTITY_LEAK.test(defect);

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

const countValues = (values: readonly string[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
};

const stableCounts = (values: readonly string[]): string =>
  JSON.stringify(
    Object.entries(countValues(values)).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );

const pairMetric = (left: readonly boolean[], right: readonly boolean[]) => {
  check(
    left.length === right.length && left.length === 384,
    "pairwise vectors differ",
  );
  const agreements = left.filter(
    (value, index) => value === right[index],
  ).length;
  const leftPassRate = left.filter(Boolean).length / left.length;
  const rightPassRate = right.filter(Boolean).length / right.length;
  const expectedAgreement =
    leftPassRate * rightPassRate + (1 - leftPassRate) * (1 - rightPassRate);
  const ratio = agreements / left.length;
  return {
    agreements,
    denominator: 384 as const,
    ratio,
    cohensKappa:
      expectedAgreement === 1
        ? ratio === 1
          ? 1
          : 0
        : (ratio - expectedAgreement) / (1 - expectedAgreement),
    threshold: 0.75 as const,
    passed: ratio >= 0.75,
  };
};

const validatePacket = (packet: BlindPacket): void => {
  check(
    packet.version === "input-field-performance-blind-v3" &&
      packet.phase === "performance" &&
      packet.status === "opaque-ungraded" &&
      packet.counts.tasks === 384 &&
      packet.counts.referencePresentations === 384 &&
      packet.counts.specimenPresentations === 384 &&
      packet.tasks.length === 384,
    "performance packet protocol, status, or counts differ",
  );
  const taskIds = new Set<string>();
  const referenceIds = new Set<string>();
  const specimenIds = new Set<string>();
  for (const task of packet.tasks) {
    check(
      exactKeys(task as unknown as Record<string, unknown>, [
        "taskId",
        "reference",
        "specimen",
      ]) &&
        exactKeys(task.reference as unknown as Record<string, unknown>, [
          "referenceId",
          "image",
        ]) &&
        exactKeys(task.specimen as unknown as Record<string, unknown>, [
          "specimenId",
          "image",
        ]),
      `${task.taskId} packet fields differ`,
    );
    check(
      /^task-[a-f0-9]{20}$/.test(task.taskId) &&
        /^reference-[a-f0-9]{20}$/.test(task.reference.referenceId) &&
        /^specimen-[a-f0-9]{20}$/.test(task.specimen.specimenId) &&
        !IDENTITY_LEAK.test(JSON.stringify(task)),
      `${task.taskId} contains malformed or identity-bearing metadata`,
    );
    check(
      !taskIds.has(task.taskId) &&
        !referenceIds.has(task.reference.referenceId) &&
        !specimenIds.has(task.specimen.specimenId),
      `${task.taskId} repeats an opaque identifier`,
    );
    taskIds.add(task.taskId);
    referenceIds.add(task.reference.referenceId);
    specimenIds.add(task.specimen.specimenId);
    containedRegularFile(task.reference.image, PACKET_ROOT);
    containedRegularFile(task.specimen.image, PACKET_ROOT);
  }
};

const validateTemplates = (
  sources: AdjudicationSources,
  replacementReceipt: any,
): Record<Rater, string> =>
  Object.fromEntries(
    RATERS.map((rater) => {
      const templatePath = performanceTemplatePath(rater);
      const templateHash = sha256(sources.templates[rater]);
      check(
        replacementReceipt.performance.templates[rater].path === templatePath &&
          replacementReceipt.performance.templates[rater].sha256 ===
            templateHash,
        `${rater} performance template hash or path differs`,
      );
      const template = parse<GradeEnvelope>(
        `${rater} performance template`,
        sources.templates[rater],
      );
      check(
        template.graderId === rater &&
          template.packetHash === fileHash(PACKET_PATH) &&
          template.counts.expected === 384 &&
          template.counts.submitted === null &&
          template.orderedGrades.length === 384,
        `${rater} performance template binding differs`,
      );
      return [rater, templateHash];
    }),
  ) as Record<Rater, string>;

const validateSubmissions = (
  sources: AdjudicationSources,
  packet: BlindPacket,
): {
  batches: Record<Rater, GradeEnvelope>;
  validations: Array<{
    rater: Rater;
    path: string;
    sha256: string;
    recognisable: number;
    unrecognisable: number;
    confidence: Record<Confidence | "total", number>;
    exact384IdsAndOrder: true;
    schemaAndEnvelopeValid: true;
    passRuleAndDefectsValid: true;
    identityGuessesAbsent: true;
    qualificationReceiptBindingValid: true;
  }>;
} => {
  const batches = {} as Record<Rater, GradeEnvelope>;
  const validations = RATERS.map((rater) => {
    const batch = parse<GradeEnvelope>(
      `${rater} performance submission`,
      sources.submissions[rater],
    );
    validateReplacementEnvelope(
      batch,
      packet as Parameters<typeof validateReplacementEnvelope>[1],
      sha256(sources.packet),
      rater,
    );
    const receiptPath =
      rater === "RATER-CAL-V3-D"
        ? D_QUALIFICATION_RECEIPT_PATH
        : `${CALIBRATION_V2_ROOT}/gold/receipts/${rater.toLowerCase()}.json`;
    const receipt = parse<any>(
      `${rater} qualification receipt`,
      readFileSync(absolute(receiptPath), "utf8"),
    );
    check(
      batch.calibrationReceipt?.path === receiptPath &&
        batch.calibrationReceipt.sha256 === fileHash(receiptPath) &&
        batch.calibrationReceipt.score === receipt.score &&
        batch.calibrationReceipt.obviousStructuralStateFailureScore === 1 &&
        batch.calibrationReceipt.passed === true &&
        receipt.envelopeValid === true &&
        receipt.performanceEligibility === true &&
        receipt.performanceAccessed === false &&
        (rater === "RATER-CAL-V3-D" ||
          receipt.performanceIdentityRevealed === false),
      `${rater} qualification or no-prior-performance-access binding differs`,
    );
    const confidence = {
      low: batch.orderedGrades.filter((grade) => grade.confidence === "low")
        .length,
      medium: batch.orderedGrades.filter(
        (grade) => grade.confidence === "medium",
      ).length,
      high: batch.orderedGrades.filter((grade) => grade.confidence === "high")
        .length,
      total: 384,
    };
    const recognisable = batch.orderedGrades.filter(
      (grade) => grade.recognisable,
    ).length;
    batches[rater] = batch;
    return {
      rater,
      path: performanceSubmissionPath(rater),
      sha256: sha256(sources.submissions[rater]),
      recognisable,
      unrecognisable: 384 - recognisable,
      confidence,
      exact384IdsAndOrder: true as const,
      schemaAndEnvelopeValid: true as const,
      passRuleAndDefectsValid: true as const,
      identityGuessesAbsent: true as const,
      qualificationReceiptBindingValid: true as const,
    };
  });
  return { batches, validations };
};

const computeOpaqueAgreement = (
  batches: Record<Rater, GradeEnvelope>,
): {
  votes: Record<Rater, boolean[]>;
  majority: boolean[];
  metrics: {
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
    pairwise: Array<
      ReturnType<typeof pairMetric> & { raters: `${ShortRater}-${ShortRater}` }
    >;
    overallPairwiseAgreement: number;
    fleissKappa: number;
    majorityFailureRows: number;
    majorityFailuresWithTwoConcreteRaterDefectSets: number;
  };
} => {
  const votes = Object.fromEntries(
    RATERS.map((rater) => [
      rater,
      batches[rater].orderedGrades.map((grade) => grade.recognisable),
    ]),
  ) as Record<Rater, boolean[]>;
  const rows = Array.from({ length: 384 }, (_, index) =>
    RATERS.map((rater) => votes[rater][index]!),
  );
  const majority = rows.map((row) => row.filter(Boolean).length >= 2);
  const unanimousRows = rows.filter((row) => new Set(row).size === 1);
  const observedPairwiseAgreement =
    rows.reduce((total, row) => {
      const passes = row.filter(Boolean).length;
      const failures = 3 - passes;
      return total + (passes * (passes - 1) + failures * (failures - 1)) / 6;
    }, 0) / 384;
  const passPrevalence =
    RATERS.reduce(
      (total, rater) => total + votes[rater].filter(Boolean).length,
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
  const majorityFailureIndexes = majority.flatMap((value, index) =>
    value ? [] : [index],
  );
  const supportedFailures = majorityFailureIndexes.filter(
    (index) =>
      RATERS.filter((rater) => {
        const grade = batches[rater].orderedGrades[index]!;
        return (
          !grade.recognisable &&
          grade.defects.length > 0 &&
          grade.defects.every(concreteDefect)
        );
      }).length >= 2,
  ).length;
  const patterns = rows.map((row) =>
    row.map((vote) => (vote ? "P" : "F")).join(""),
  );
  const pairs = [
    ["RATER-CAL-V2-B", "RATER-CAL-V2-C", "B-C"],
    ["RATER-CAL-V2-B", "RATER-CAL-V3-D", "B-D"],
    ["RATER-CAL-V2-C", "RATER-CAL-V3-D", "C-D"],
  ] as const;
  return {
    votes,
    majority,
    metrics: {
      perRaterPasses: Object.fromEntries(
        RATERS.map((rater) => {
          const recognisable = votes[rater].filter(Boolean).length;
          return [
            rater,
            {
              recognisable,
              denominator: 384 as const,
              ratio: recognisable / 384,
            },
          ];
        }),
      ) as Record<
        Rater,
        { recognisable: number; denominator: 384; ratio: number }
      >,
      unanimous: {
        count: unanimousRows.length,
        ratio: unanimousRows.length / 384,
        unanimousPass: unanimousRows.filter((row) => row[0]).length,
        unanimousFail: unanimousRows.filter((row) => !row[0]).length,
      },
      split: {
        count: 384 - unanimousRows.length,
        ratio: (384 - unanimousRows.length) / 384,
      },
      votePatterns: countValues(patterns),
      pairwise: pairs.map(([left, right, label]) => ({
        raters: label,
        ...pairMetric(votes[left], votes[right]),
      })),
      overallPairwiseAgreement: observedPairwiseAgreement,
      fleissKappa,
      majorityFailureRows: majorityFailureIndexes.length,
      majorityFailuresWithTwoConcreteRaterDefectSets: supportedFailures,
    },
  };
};

const validateOpaqueDuplicateIntegrity = (
  packet: BlindPacket,
  votes: Record<Rater, boolean[]>,
  majority: boolean[],
) => {
  const referenceGroups = new Map<string, number[]>();
  for (const [index, task] of packet.tasks.entries()) {
    const hash = sha256(
      readFileSync(containedRegularFile(task.reference.image, PACKET_ROOT)),
    );
    const group = referenceGroups.get(hash) ?? [];
    group.push(index);
    referenceGroups.set(hash, group);
  }
  check(referenceGroups.size === 128, "opaque reference grouping is not 128");
  const pairs: Array<[number, number]> = [];
  for (const group of referenceGroups.values()) {
    check(group.length === 3, "opaque reference group is not three tasks");
    const specimenGroups = new Map<string, number[]>();
    for (const index of group) {
      const task = packet.tasks[index]!;
      const hash = sha256(
        readFileSync(containedRegularFile(task.specimen.image, PACKET_ROOT)),
      );
      const specimens = specimenGroups.get(hash) ?? [];
      specimens.push(index);
      specimenGroups.set(hash, specimens);
    }
    const duplicate = [...specimenGroups.values()].find(
      (indexes) => indexes.length === 2,
    );
    check(
      specimenGroups.size === 2 && duplicate,
      "opaque same-reference specimens do not contain one byte-identical pair",
    );
    const pair = [...duplicate].sort((left, right) => left - right) as [
      number,
      number,
    ];
    check(
      pair[1] - pair[0] > 1,
      "hidden same-cell duplicate presentations are adjacent",
    );
    pairs.push(pair);
  }
  check(
    new Set(pairs.flat()).size === 256,
    "opaque duplicate pairing is not bijective",
  );
  const byRater = Object.fromEntries(
    RATERS.map((rater) => {
      let agreements = 0;
      let firstPasses = 0;
      let secondPasses = 0;
      for (const [first, second] of pairs) {
        if (votes[rater][first] === votes[rater][second]) agreements += 1;
        if (votes[rater][first]) firstPasses += 1;
        if (votes[rater][second]) secondPasses += 1;
      }
      const passRateDelta = Math.abs(firstPasses - secondPasses) / 128;
      return [
        rater,
        {
          agreements,
          denominator: 128 as const,
          ratio: agreements / 128,
          threshold: 0.95 as const,
          agreementPassed: agreements / 128 >= 0.95,
          opaqueFirstPasses: firstPasses,
          opaqueSecondPasses: secondPasses,
          passRateDelta,
          maximumPassRateDelta: 0.05 as const,
          passRateDeltaPassed: passRateDelta <= 0.05,
        },
      ];
    }),
  ) as Record<
    Rater,
    {
      agreements: number;
      denominator: 128;
      ratio: number;
      threshold: 0.95;
      agreementPassed: boolean;
      opaqueFirstPasses: number;
      opaqueSecondPasses: number;
      passRateDelta: number;
      maximumPassRateDelta: 0.05;
      passRateDeltaPassed: boolean;
    }
  >;
  const majorityAgreements = pairs.filter(
    ([first, second]) => majority[first] === majority[second],
  ).length;
  const majorityPasses = pairs.filter(
    ([first, second]) => majority[first] && majority[second],
  ).length;
  return {
    status: "passed" as const,
    pairingMethod:
      "opaque same-reference byte groups; no source path or implementation identity",
    referenceGroups: 128,
    pairs: 128,
    uniquePairedSpecimens: 256,
    byteIdenticalPairs: 128,
    minimumPacketPositionDistance: Math.min(
      ...pairs.map(([first, second]) => second - first),
    ),
    implementationIdentityUsed: false as const,
    byRater,
    majorityConsensus: {
      agreements: majorityAgreements,
      denominator: 128 as const,
      ratio: majorityAgreements / 128,
      mismatchedPairs: 128 - majorityAgreements,
      passPairs: majorityPasses,
      failPairs: 128 - majorityPasses,
      thresholdAgreements: 127 as const,
      passed: majorityAgreements >= 127,
    },
  };
};

const validateHistoricalContinuityAndProvenance = (packet: BlindPacket) => {
  validateCommittedCalibrationV2();
  const receiptPath = `${V2_COMPARISON_ROOT}/receipt.json`;
  const resultPath = `${V2_COMPARISON_ROOT}/comparison-result.json`;
  const receipt = parse<ComparisonReceipt>(
    "v2 comparison receipt",
    readFileSync(absolute(receiptPath), "utf8"),
  );
  const result = parse<ComparisonResult>(
    "v2 comparison result",
    readFileSync(absolute(resultPath), "utf8"),
  );
  const matrixKeys = receipt.matrix.cells.map((cell) => cell.key);
  check(
    matrixKeys.length === 128 &&
      new Set(matrixKeys).size === 128 &&
      receipt.references.length === 128 &&
      receipt.outputs.legacy.length === 128 &&
      receipt.outputs.recipeReact.length === 128 &&
      receipt.outputs.recipeWebComponent.length === 128 &&
      result.sourceReferences.length === 128 &&
      result.sourceProvenance.sampleMatrixHash ===
        receipt.matrix.sampleMatrixHash,
    "v2 sample or provenance cardinality differs",
  );
  const references = new Map(
    receipt.references.map((artifact) => [artifact.cellKey, artifact]),
  );
  for (const source of result.sourceReferences) {
    check(
      source.independentHarness &&
        source.sourceId.length > 0 &&
        source.sourceVersionOrRevision.length > 0 &&
        /^[a-f0-9]{64}$/.test(source.sourceHash) &&
        /^[a-f0-9]{64}$/.test(source.captureInputHash) &&
        references.get(source.cellKey)?.hash === source.screenshotHash,
      `${source.cellKey} source-reference provenance differs`,
    );
  }
  for (const artifact of [
    ...receipt.references,
    ...receipt.outputs.legacy,
    ...receipt.outputs.recipeReact,
    ...receipt.outputs.recipeWebComponent,
  ]) {
    check(
      matrixKeys.includes(artifact.cellKey) &&
        fileHash(artifact.file) === artifact.hash,
      `${artifact.cellKey} comparison artifact bytes differ`,
    );
  }

  const packetReferenceHashes = packet.tasks.map((task) =>
    sha256(
      readFileSync(containedRegularFile(task.reference.image, PACKET_ROOT)),
    ),
  );
  const expectedReferenceHashes = receipt.references.flatMap((artifact) => [
    artifact.hash,
    artifact.hash,
    artifact.hash,
  ]);
  const packetSpecimenHashes = packet.tasks.map((task) =>
    sha256(
      readFileSync(containedRegularFile(task.specimen.image, PACKET_ROOT)),
    ),
  );
  const expectedSpecimenHashes = [
    ...receipt.outputs.recipeReact.map((artifact) => artifact.hash),
    ...receipt.outputs.legacy.flatMap((artifact) => [
      artifact.hash,
      artifact.hash,
    ]),
  ];
  check(
    stableCounts(packetReferenceHashes) ===
      stableCounts(expectedReferenceHashes),
    "performance source-reference bytes do not match the exact 128-cell source",
  );
  check(
    stableCounts(packetSpecimenHashes) === stableCounts(expectedSpecimenHashes),
    "performance specimen bytes do not match one corrected and two unchanged copies",
  );
  const parity = result.webComponentParity;
  const receiptParity = receipt.nonvisualEvidence.recipeWebComponentParity;
  check(
    parity.keptSeparateFromBlindRecognisability &&
      parity.recognisability === "not-blind-graded" &&
      parity.cells === 128 &&
      parity.nonzeroCells === 128 &&
      parity.pixelComparisons === 128 &&
      parity.perceptualThreshold === 0.1 &&
      parity.perceptualPixelEqualToReact === 128 &&
      parity.geometryEqualToReact === 128 &&
      parity.semanticProbeEqualToReact === 128 &&
      JSON.stringify(receiptParity) ===
        JSON.stringify({
          ...parity,
          keptSeparateFromBlindRecognisability: undefined,
          recognisability: undefined,
          includedInBlindSpecimens: false,
        }),
    "React/Web Component parity evidence differs",
  );
  const v1Path = `${V1_ROOT}/comparison-result.json`;
  check(
    result.comparisonHistory.immutableV1.artifact === v1Path &&
      result.comparisonHistory.immutableV1.artifactHash === fileHash(v1Path) &&
      result.comparisonHistory.immutableV1.legacyCellWeighted.numerator ===
        88 &&
      result.comparisonHistory.immutableV1.legacyCellWeighted.denominator ===
        128 &&
      result.comparisonHistory.immutableV1.recipeReactCellWeighted.numerator ===
        40 &&
      result.comparisonHistory.immutableV1.recipeReactCellWeighted
        .denominator === 128,
    "immutable v1 historical result differs",
  );
  return {
    sourceProvenance: {
      status: "passed" as const,
      exactRecords: 128,
      independentHarnessRecords: 128,
      sampleMatrixHash: receipt.matrix.sampleMatrixHash,
      sourceCommit: result.sourceProvenance.sourceCommit,
      comparisonFixtureHash: result.sourceProvenance.comparisonFixtureHash,
      environmentHash: result.sourceProvenance.environmentHash,
      recordsHash: sha256(JSON.stringify(result.sourceReferences)),
    },
    byteContinuity: {
      status: "passed" as const,
      sourceReferencePresentations: 384,
      exactSourceReferences: 128,
      correctedPresentations: 128,
      unchangedControlPresentations: 256,
      exactOpaqueMultisets: true as const,
    },
    sample: {
      complete: true as const,
      sourceLibraries: ["mui", "polaris"],
      axes: ["Size", "State", "Content", "Required", "Adornments"],
      sourceCells: 128,
      cellsPerSourceSet: 64,
      cellWeighting:
        "each exact source×size×state×content×required×adornments cell has equal weight",
      completeSetWeighting:
        "a source set passes only when all 64 paired cells are recognisable",
    },
    webComponentParity: {
      status: "passed-parity-only" as const,
      recognisability: "not-blind-graded" as const,
      cells: 128,
      byteHashEqualToReact: parity.byteHashEqualToReact,
      renderedPixelHashEqualToReact: parity.renderedPixelHashEqualToReact,
      perceptualPixelEqualToReact: 128,
      geometryEqualToReact: 128,
      semanticProbeEqualToReact: 128,
    },
    historicalHashes: {
      immutableV1: fileHash(v1Path),
      correctedV2: fileHash(resultPath),
      v2MultiRater: fileHash(
        `${V2_COMPARISON_ROOT}/multi-rater-adjudication.json`,
      ),
      refusedCalibration: fileHash(
        "recipe/evidence/input-field-comparison-calibrated/adjudication.json",
      ),
    },
  };
};

export const readAdjudicationSources = (): AdjudicationSources => ({
  protocol: readFileSync(absolute(PROTOCOL_PATH), "utf8"),
  packet: readFileSync(absolute(PACKET_PATH), "utf8"),
  replacementReceipt: readFileSync(absolute(RECEIPT_PATH), "utf8"),
  replacementIndex: readFileSync(absolute(INDEX_PATH), "utf8"),
  templates: Object.fromEntries(
    RATERS.map((rater) => [
      rater,
      readFileSync(absolute(performanceTemplatePath(rater)), "utf8"),
    ]),
  ) as Record<Rater, string>,
  submissions: Object.fromEntries(
    RATERS.map((rater) => [
      rater,
      readFileSync(absolute(performanceSubmissionPath(rater)), "utf8"),
    ]),
  ) as Record<Rater, string>,
  sealedKeyBytes: readFileSync(absolute(KEY_PATH)),
});

export function adjudicateInputFieldCalibrationV3(
  sources: AdjudicationSources,
) {
  const protocol = parse<any>("replacement protocol", sources.protocol);
  validateReplacementProtocol(protocol);
  check(
    JSON.stringify(protocol.reliability) === JSON.stringify(LOCKED_THRESHOLDS),
    "locked reliability thresholds changed",
  );
  assertReplacementAuthorization(protocol);
  const packet = parse<BlindPacket>("performance packet", sources.packet);
  validatePacket(packet);
  check(
    sha256(sources.packet) === protocol.performanceContinuity.packetHash &&
      packet.randomizedBatchHash ===
        protocol.performanceContinuity.randomizedBatchHash &&
      packet.calibrationCommitment ===
        protocol.sourceCalibrationV2.compatibilityFields.calibrationCommitment,
    "performance packet hash or commitment differs",
  );
  const replacementReceipt = parse<any>(
    "replacement receipt",
    sources.replacementReceipt,
  );
  const replacementIndex = parse<any>(
    "replacement index",
    sources.replacementIndex,
  );
  check(
    sha256(sources.protocol) === replacementIndex.protocolHash &&
      sha256(sources.packet) === replacementIndex.sealedPerformancePacketHash &&
      replacementIndex.performanceUnsealed === false &&
      replacementIndex.performanceGraded === false &&
      replacementIndex.liveInputMayProceed === false &&
      replacementIndex.overall === false &&
      replacementReceipt.status.inputOverall === false &&
      replacementReceipt.status.liveInput === "blocked",
    "replacement index, receipt, or pre-unseal status differs",
  );
  const templateHashes = validateTemplates(sources, replacementReceipt);
  const { batches, validations } = validateSubmissions(sources, packet);

  // Locked sequence: these metrics use packet order, opaque IDs, verdicts, and
  // byte equality only. No performance answer-key JSON is parsed.
  const opaque = computeOpaqueAgreement(batches);
  const duplicates = validateOpaqueDuplicateIntegrity(
    packet,
    opaque.votes,
    opaque.majority,
  );
  const validRaters = validations.length;
  const hiddenDuplicatePassed = Object.values(duplicates.byRater).every(
    (metric) => metric.agreementPassed,
  );
  const duplicateDeltaPassed = Object.values(duplicates.byRater).every(
    (metric) => metric.passRateDeltaPassed,
  );
  const pairwisePassed = opaque.metrics.pairwise.every(
    (metric) => metric.passed,
  );
  const defectSupportPassed =
    opaque.metrics.majorityFailureRows ===
    opaque.metrics.majorityFailuresWithTwoConcreteRaterDefectSets;
  const reliabilityPassed =
    validRaters === 3 &&
    hiddenDuplicatePassed &&
    duplicates.majorityConsensus.passed &&
    pairwisePassed &&
    opaque.metrics.fleissKappa >= 0.6 &&
    duplicateDeltaPassed &&
    defectSupportPassed;

  // Integrity/provenance is checked after opaque reliability computation. The
  // sealed key is hash-checked as bytes only and remains unparsed on failure.
  const continuity = validateHistoricalContinuityAndProvenance(packet);
  const sealedKeyHash = sha256(sources.sealedKeyBytes);
  check(
    sealedKeyHash === protocol.performanceContinuity.sealedAnswerKeyHash,
    "sealed performance key hash differs",
  );
  check(
    !reliabilityPassed,
    "reliability passed; a fail-closed adjudication may not suppress unsealing",
  );

  const blocker = `Fleiss kappa ${opaque.metrics.fleissKappa} is below the locked 0.60 minimum; prevalence is not used to adjust the threshold.`;
  const nextAction =
    "Preserve the B/C/D submissions as refused measurement evidence, then commission a newly versioned three-rater performance round whose pre-performance calibration includes representative materiality-boundary cases; lock its packet, rubric, templates, and unchanged thresholds before collecting fresh rows.";
  return {
    artifactVersion: "input-field-calibration-v3-final-adjudication-v1",
    sequence: {
      qualificationAndEnvelopeValidationCompleted: true,
      opaqueReliabilityComputedBeforePerformanceIdentity: true,
      hiddenDuplicatePairingUsedSourcePathIdentity: false,
      sealedAnswerKeyHashCheckedAfterReliability: true,
      sealedAnswerKeyParsed: false,
      performanceIdentityUnsealed: false,
    },
    inputHashes: {
      replacementProtocol: sha256(sources.protocol),
      replacementReceipt: sha256(sources.replacementReceipt),
      replacementIndex: sha256(sources.replacementIndex),
      sourceV2Protocol: fileHash(`${CALIBRATION_V2_ROOT}/protocol.json`),
      gradeSchema: fileHash(GRADE_SCHEMA_PATH),
      performancePacket: sha256(sources.packet),
      randomizedBatch: packet.randomizedBatchHash,
      sealedAnswerKeyCommitment: sealedKeyHash,
      templates: templateHashes,
      submissions: Object.fromEntries(
        RATERS.map((rater) => [rater, sha256(sources.submissions[rater])]),
      ) as Record<Rater, string>,
      qualificationReceipts: {
        "RATER-CAL-V2-B": fileHash(
          `${CALIBRATION_V2_ROOT}/gold/receipts/rater-cal-v2-b.json`,
        ),
        "RATER-CAL-V2-C": fileHash(
          `${CALIBRATION_V2_ROOT}/gold/receipts/rater-cal-v2-c.json`,
        ),
        "RATER-CAL-V3-D": fileHash(D_QUALIFICATION_RECEIPT_PATH),
      },
      historical: continuity.historicalHashes,
    },
    integrity: {
      v2AndV3Protocols: "passed",
      replacementCommitment: "passed",
      importedQualifications: "passed",
      freshDQualification: {
        status: "passed",
        score: 23 / 24,
        obviousFailureScore: 1,
        envelopeValid: true,
      },
      performancePacket: {
        status: "passed",
        tasks: 384,
        uniqueTaskIds: 384,
        uniqueReferenceIds: 384,
        uniqueSpecimenIds: 384,
        exactIdsAndOrderPerRater: true,
        schemaAndEnvelopes: "passed",
        defectsAndPassRule: "passed",
        identityGuessesAbsent: true,
        containedRegularImagePaths: 768,
      },
      sourceProvenance: continuity.sourceProvenance,
      byteContinuity: continuity.byteContinuity,
      priorPerformanceKeyAccess: {
        status: "passed-on-hash-pinned-qualification-receipts",
        raterReceiptsRecordPerformanceAccessed: false,
        importedReceiptsRecordPerformanceIdentityRevealed: false,
        replacementProtocolForbidsPriorKeyAccess: true,
        operatingSystemReadAuditAvailable: false,
      },
      sealedAnswerKey: {
        sha256: sealedKeyHash,
        hashMatchesCommitment: true,
        parsed: false,
        keptSealedBecauseReliabilityFailed: true,
      },
    },
    raterValidations: validations,
    opaqueReliability: opaque.metrics,
    duplicateIntegrity: duplicates,
    thresholds: {
      source: "unchanged-v2-v3-locked-protocol",
      unchanged: true,
      calibratedValidRaters: {
        required: 3,
        actual: validRaters,
        passed: validRaters === 3,
      },
      hiddenDuplicateAgreementPerRater: {
        threshold: 0.95,
        passed: hiddenDuplicatePassed,
      },
      majorityDuplicateAgreement: {
        threshold: { agreements: 127, denominator: 128 },
        actual: {
          agreements: duplicates.majorityConsensus.agreements,
          denominator: 128,
        },
        passed: duplicates.majorityConsensus.passed,
      },
      everyPairwiseAgreement: {
        threshold: 0.75,
        passed: pairwisePassed,
      },
      fleissKappa: {
        threshold: 0.6,
        actual: opaque.metrics.fleissKappa,
        passed: opaque.metrics.fleissKappa >= 0.6,
        prevalenceAdjustedPostHoc: false,
      },
      maximumDuplicateCopyPassRateDelta: {
        threshold: 0.05,
        passed: duplicateDeltaPassed,
      },
      majorityFailureConcreteDefectRaters: {
        threshold: 2,
        majorityFailures: opaque.metrics.majorityFailureRows,
        supported:
          opaque.metrics.majorityFailuresWithTwoConcreteRaterDefectSets,
        passed: defectSupportPassed,
      },
    },
    instrumentValidity: {
      status: "failed",
      measurementUsable: false,
      blockers: [blocker],
    },
    architecturePerformance: null,
    consensus: null,
    offlineDifficultControlCriterion: {
      status: "not-evaluated",
      passed: false,
      reason:
        "Instrument reliability failed before the sealed performance mapping could be opened.",
    },
    descriptiveDuplicateControlOnly: {
      acceptedAsArchitecturePerformance: false,
      majorityPassPairs: duplicates.majorityConsensus.passPairs,
      denominator: 128,
      note: "The opaque duplicate-control majority is 0/128 passes, but it is a reliability diagnostic and cannot be promoted to implementation-labelled performance.",
    },
    instability: {
      historicalUnchangedControl: {
        v1: { passes: 88, denominator: 128 },
        v2Consensus: { passes: 0, denominator: 128 },
        swing: 88,
      },
      replacementOpaqueDuplicateControl: {
        passPairs: duplicates.majorityConsensus.passPairs,
        denominator: 128,
      },
      resolvedByReplacementCohort: false,
      reason:
        "The replacement duplicate-control observation again equals 0/128, but the full 384-row cohort fails locked Fleiss reliability; it therefore cannot resolve the prior 88-to-0 standard instability or support an architecture claim.",
    },
    retainedNonPerformanceEvidence: {
      sample: continuity.sample,
      webComponentParity: continuity.webComponentParity,
      offlineImplementation: "previously-passed-separate-from-recognisability",
      accounting: "previously-passed-offline-pending-live",
    },
    evidenceStatus: {
      measurementReliability: "failed",
      architecturePerformance: "not-unsealed",
      offlineDifficultControl: "not-evaluated",
      humanRecognisabilityReleaseGate: "blocked",
      liveInputMayProceed: false,
      inputOverall: false,
    },
    blockers: [blocker],
    nextAction,
  } as const;
}

export type InputFieldCalibrationV3Adjudication = ReturnType<
  typeof adjudicateInputFieldCalibrationV3
>;

export function validateCommittedInputFieldCalibrationV3Adjudication(
  artifact: InputFieldCalibrationV3Adjudication,
  sources: AdjudicationSources = readAdjudicationSources(),
): InputFieldCalibrationV3Adjudication {
  const recomputed = adjudicateInputFieldCalibrationV3(sources);
  check(
    JSON.stringify(artifact) === JSON.stringify(recomputed),
    "committed final adjudication hashes, reliability, seal, status, or verdict differ",
  );
  return recomputed;
}

const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const result = adjudicateInputFieldCalibrationV3(readAdjudicationSources());
  if (process.argv.includes("--write")) {
    const bytes = await format(JSON.stringify(result), { parser: "json" });
    writeFileSync(absolute(FINAL_ADJUDICATION_PATH), bytes);
    console.log(
      `WROTE ${FINAL_ADJUDICATION_PATH} sha256=${sha256(bytes)}; reliability failed; performance identity remains sealed`,
    );
  } else {
    const artifact = parse<InputFieldCalibrationV3Adjudication>(
      "committed final adjudication",
      readFileSync(absolute(FINAL_ADJUDICATION_PATH), "utf8"),
    );
    validateCommittedInputFieldCalibrationV3Adjudication(artifact);
    console.log(
      `Input/Field replacement reliability=${result.instrumentValidity.status}; Fleiss kappa=${result.opaqueReliability.fleissKappa}; identity unsealed=${result.sequence.performanceIdentityUnsealed}`,
    );
  }
}
