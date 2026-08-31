import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  BUTTON_ADJUDICATION_PATH,
  BUTTON_V2_ADJUDICATION_PATH,
  readCommittedButtonV2Adjudication,
} from "./comparison-adjudication.js";
import {
  altitudeButtonAdapterConfig,
  fluentButtonAdapterConfig,
} from "./fixtures/library-buttons.js";
import { validateLivePacketV4 } from "./live-packet-v4.js";
import { validateLiveReceiptV4 } from "./live-receipt-v4.js";

const ROOT = "recipe/evidence/button-live-pivot-v4";
export const BUTTON_LIVE_V4_ADJUDICATION_PATH = `${ROOT}/final-adjudication.json`;
const PROTOCOL = "button-live-canvas-v4";
const ADAPTERS = [
  "altitude-button-reviewed-v2",
  "fluent-button-reviewed-v2",
] as const;
const VARIANTS = ["primary", "secondary"] as const;
const STATES = ["default", "hover", "focus-visible"] as const;
const CONFIDENCES = ["low", "medium", "high"] as const;
const IMPLEMENTATION_GUESS =
  /\b(?:altitude|fluent|legacy|recipe|react|web[ -]?component|figma|implementation(?: path| guess)?|expected[ -]?winner)\b/i;

type Confidence = (typeof CONFIDENCES)[number];

interface LiveV4SourceBytes {
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

interface UnsealedLiveGrade {
  anonymousCell: string;
  specimenId: string;
  recognisable: boolean;
  confidence: Confidence;
  defects: string[];
  sourceLibrary: "altitude" | "fluent";
  adapterIdentity: (typeof ADAPTERS)[number];
  variant: (typeof VARIANTS)[number];
  state: (typeof STATES)[number];
  liveNodeId: string;
  sourceReferencePath: string;
  liveEvidencePath: string;
  sourceReferenceSha256: string;
  liveEvidenceSha256: string;
}

interface EvidenceColumn {
  status: "passed";
  evidence: Record<string, unknown>;
}

export interface ButtonLiveV4Adjudication {
  artifactVersion: "button-live-final-adjudication-v4";
  inputHashes: Record<string, string>;
  integrity: {
    status: "passed";
    checks: Record<string, true>;
  };
  unsealedMapping: UnsealedLiveGrade[];
  aggregates: {
    overall: Score;
    bySourceLibrary: Record<string, Score>;
    byVariant: Record<string, Score>;
    byState: Record<string, Score>;
    confidence: {
      overall: ConfidenceDistribution;
      bySourceLibrary: Record<string, ConfidenceDistribution>;
      byVariant: Record<string, ConfidenceDistribution>;
      byState: Record<string, ConfidenceDistribution>;
    };
  };
  evidenceColumns: {
    explicitRecipeSelection: EvidenceColumn;
    unrelatedAdaptersNoSourceBranches: EvidenceColumn;
    offlineReactPairedGrade: EvidenceColumn;
    webComponentParity: EvidenceColumn;
    liveFigmaMint: EvidenceColumn;
    liveUsability: EvidenceColumn;
    exactProbeRestoration: EvidenceColumn;
    liveReadbackFixedPoint: EvidenceColumn;
    zeroSilentAccounting: EvidenceColumn;
    independentLiveCanvasGrade: EvidenceColumn;
    independentSourceReferences: EvidenceColumn;
  };
  retainedScratchArtifacts: {
    fileKey: string;
    pageId: string;
    pageName: string;
    proofSectionId: string;
    pairedSectionId: string;
    componentSetIds: string[];
    representativeInstanceIds: string[];
    pairedCellNodeIds: string[];
  };
  history: {
    offlineV1: { result: string; sha256: string };
    offlineV2: { result: string; sha256: string };
    liveV1: { result: string; sha256: string };
    liveV2: { result: string; sha256: string };
    liveV3: { result: string; sha256: string };
    liveV4PreGradeReceipt: { result: string; sha256: string };
  };
  proofBoundary: {
    proves: string;
    doesNotProve: string[];
  };
  verdict: {
    buttonSuccess: true;
    completedColumns: number;
    requiredColumns: number;
    blockers: [];
    nextTask: string;
  };
}

const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const hashPath = (file: string): string => sha256(readFileSync(file));
const parse = <T>(label: string, bytes: string): T => {
  try {
    return JSON.parse(bytes) as T;
  } catch (error) {
    throw new Error(`REFUSED: ${label} is not valid JSON: ${String(error)}`);
  }
};
const refuse = (message: string): never => {
  throw new Error(`REFUSED: ${message}`);
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
    `${label} required fields differ: expected ${wanted.join(",")}; received ${actual.join(",")}`,
  );
};
const score = (grades: readonly UnsealedLiveGrade[]): Score => {
  assert(grades.length > 0, "aggregate denominator is zero");
  const numerator = grades.filter((grade) => grade.recognisable).length;
  return {
    numerator,
    denominator: grades.length,
    ratio: numerator / grades.length,
  };
};
const confidence = (
  grades: readonly UnsealedLiveGrade[],
): ConfidenceDistribution => ({
  low: grades.filter((grade) => grade.confidence === "low").length,
  medium: grades.filter((grade) => grade.confidence === "medium").length,
  high: grades.filter((grade) => grade.confidence === "high").length,
  total: grades.length,
});
const grouped = <Value>(
  values: readonly Value[],
  grades: readonly UnsealedLiveGrade[],
  predicate: (grade: UnsealedLiveGrade, value: Value) => boolean,
  aggregate: (
    selected: readonly UnsealedLiveGrade[],
  ) => Score | ConfidenceDistribution,
): Record<string, Score | ConfidenceDistribution> =>
  Object.fromEntries(
    values.map((value) => [
      String(value),
      aggregate(grades.filter((grade) => predicate(grade, value))),
    ]),
  );

export const readButtonLiveV4AdjudicationSources = (): LiveV4SourceBytes => ({
  packet: readFileSync(`${ROOT}/blind-packet/packet.json`, "utf8"),
  grades: readFileSync(`${ROOT}/blind-packet/grades.json`, "utf8"),
  key: readFileSync(`${ROOT}/sealed-answer-key.json`, "utf8"),
  receipt: readFileSync(`${ROOT}/receipt.json`, "utf8"),
});

const supportingPaths = {
  liveVerification: `${ROOT}/live-verification.json`,
  normalizedReadback: `${ROOT}/normalized-live-readback.json`,
  writerPlan: `${ROOT}/writer-plan.json`,
  transportEnvelope: `${ROOT}/transport-envelope.json`,
  writer: `${ROOT}/writer.js`,
  wrapper: `${ROOT}/writer-wrapper-attempt-2.txt`,
  conformance: `${ROOT}/conformance-report.json`,
  liveAttempt2: `${ROOT}/live-attempt-2.json`,
  offlineV1Adjudication: BUTTON_ADJUDICATION_PATH,
  offlineV2Adjudication: BUTTON_V2_ADJUDICATION_PATH,
  liveV1Receipt: "recipe/evidence/button-live-pivot/receipt.json",
  liveV2Receipt: "recipe/evidence/button-live-pivot-v2/receipt.json",
  liveV3Receipt: "recipe/evidence/button-live-pivot-v3/receipt.json",
  genericAdapter: "recipe/adapters/button.ts",
  genericRecipe: "recipe/recipes/button.ts",
  genericOutput: "recipe/output/button.ts",
  reviewedFixtures: "recipe/fixtures/library-buttons.ts",
} as const;

const inputHashes = (
  sourceBytes: LiveV4SourceBytes,
): Record<string, string> => ({
  packet: sha256(sourceBytes.packet),
  grades: sha256(sourceBytes.grades),
  sealedAnswerKey: sha256(sourceBytes.key),
  preGradeReceipt: sha256(sourceBytes.receipt),
  ...Object.fromEntries(
    Object.entries(supportingPaths).map(([name, file]) => [
      name,
      hashPath(file),
    ]),
  ),
});

const assertSelectionAndArchitecture = (): {
  selectionEvidence: Record<string, unknown>;
  adapterEvidence: Record<string, unknown>;
} => {
  const configs = [
    ["altitude", altitudeButtonAdapterConfig],
    ["fluent", fluentButtonAdapterConfig],
  ] as const;
  const selections = configs.map(([library, config]) => {
    const selection = config.selection;
    assert(
      selection.candidates.length === 1 &&
        selection.candidates[0]?.id === "button" &&
        selection.candidates[0]?.version === 1,
      `${library} recipe selection is not exact button@1`,
    );
    assert(
      selection.mechanism === "reviewed-config" &&
        selection.selectedBy.length > 0 &&
        selection.source.length > 0 &&
        !Number.isNaN(Date.parse(selection.reviewedAt)),
      `${library} recipe selection provenance is incomplete`,
    );
    assert(
      selection.manualCost.unit === "reviewed-mapping" &&
        selection.manualCost.value > 0 &&
        selection.manualCost.value >= config.manualMappings.length,
      `${library} recipe selection cost is absent or under-priced`,
    );
    return {
      library,
      recipe: "button@1",
      selectedBy: selection.selectedBy,
      mechanism: selection.mechanism,
      source: selection.source,
      reviewedAt: selection.reviewedAt,
      manualCost: selection.manualCost,
      mappings: config.manualMappings.length,
    };
  });
  const genericPaths = [
    supportingPaths.genericAdapter,
    supportingPaths.genericRecipe,
    supportingPaths.genericOutput,
  ];
  for (const file of genericPaths) {
    assert(
      !/\b(?:altitude|fluent|al-button)\b/i.test(readFileSync(file, "utf8")),
      `${file} contains a source-library branch or identity`,
    );
  }
  assert(
    altitudeButtonAdapterConfig.sourcePath !==
      fluentButtonAdapterConfig.sourcePath,
    "the two reviewed adapters do not use unrelated source contracts",
  );
  return {
    selectionEvidence: {
      selections,
      totalReviewedMappingCost: selections.reduce(
        (total, item) => total + item.manualCost.value,
        0,
      ),
      inferenceUsed: false,
    },
    adapterEvidence: {
      adapters: configs.map(([library, config]) => ({
        library,
        sourcePath: config.sourcePath,
        selectedFacts: config.sourceFacts.length,
      })),
      genericFilesScanned: genericPaths,
      forbiddenSourceIdentityMatches: 0,
    },
  };
};

export function adjudicateButtonLiveV4(
  sourceBytes: LiveV4SourceBytes,
): ButtonLiveV4Adjudication {
  const packet = parse<Record<string, any>>("blind packet", sourceBytes.packet);
  const gradeBatch = parse<Record<string, any>>(
    "blind grades",
    sourceBytes.grades,
  );
  const key = parse<Record<string, any>>("sealed answer key", sourceBytes.key);
  const receipt = parse<Record<string, any>>(
    "pre-grade live receipt",
    sourceBytes.receipt,
  );
  const verification = parse<Record<string, any>>(
    "live verification",
    readFileSync(supportingPaths.liveVerification, "utf8"),
  );
  const plan = parse<Record<string, any>>(
    "writer plan",
    readFileSync(supportingPaths.writerPlan, "utf8"),
  );
  const attempt2 = parse<Record<string, any>>(
    "live attempt 2",
    readFileSync(supportingPaths.liveAttempt2, "utf8"),
  );

  // Phase 1: validate every opaque/pre-grade input before reading sealed
  // implementation identities into the final mapping.
  exactKeys(
    packet,
    [
      "version",
      "status",
      "instructions",
      "protocol",
      "randomizedBatchSha256",
      "cells",
    ],
    "packet",
  );
  exactKeys(gradeBatch, ["protocolVersion", "counts", "grades"], "grade batch");
  exactKeys(
    key,
    ["version", "status", "packetPath", "packetSha256", "mappings"],
    "sealed answer key",
  );
  assert(
    packet.version === PROTOCOL &&
      packet.status === "awaiting-independent-blind-grade" &&
      packet.protocol?.version === PROTOCOL &&
      packet.protocol?.cellCount === 12 &&
      packet.protocol?.specimenCount === 12,
    "packet protocol/status/cardinality differs",
  );
  assert(
    key.version === `${PROTOCOL}-sealed-key` &&
      key.status === "sealed-until-independent-grade" &&
      key.packetPath === `${ROOT}/blind-packet/packet.json`,
    "sealed key protocol/status/path differs",
  );
  assert(
    sha256(sourceBytes.packet) === key.packetSha256 &&
      key.packetSha256 === receipt.grading?.packetSha256 &&
      sha256(sourceBytes.key) === receipt.grading?.sealedAnswerKeySha256,
    "packet/key/receipt hashes differ",
  );
  assert(
    sha256(sourceBytes.receipt) ===
      "7832103cf07d369d151c2d701c543a15a4120c236e31fe3feb999e0731d5186a" &&
      hashPath(supportingPaths.liveV1Receipt) ===
        "863fe1af6b38fc12237b47e4deb0e5db1c298d462666e4921bd28d8bf964b652" &&
      hashPath(supportingPaths.liveV2Receipt) ===
        "7668e12fd95b017ad7093a279dcae2817a518c6e1a324ef800f906b9e8fc8a81" &&
      hashPath(supportingPaths.liveV3Receipt) ===
        "dc4c1fbd3d8de6374f2b5f4703dfe02d0d3291f6fc56544cec33f451d8a48d3c",
    "immutable v1-v4 live receipt history differs",
  );
  const receiptFailures = validateLiveReceiptV4(receipt);
  assert(
    receiptFailures.length === 0,
    `pre-grade live receipt failed: ${receiptFailures.join("; ")}`,
  );
  const packetFailures = validateLivePacketV4(packet, key);
  assert(
    packetFailures.length === 0,
    `blind packet failed: ${packetFailures.join("; ")}`,
  );
  assert(
    !IMPLEMENTATION_GUESS.test(sourceBytes.grades),
    "blind grader included an implementation guess",
  );
  assert(
    gradeBatch.protocolVersion === PROTOCOL &&
      Array.isArray(gradeBatch.grades) &&
      gradeBatch.grades.length === 12,
    "grade protocol/cardinality differs",
  );
  const packetOrder = packet.cells.map(
    (cell: Record<string, any>) => cell.specimen.anonymousLabel,
  );
  const cellOrder = packet.cells.map(
    (cell: Record<string, any>) => cell.anonymousCell,
  );
  assert(
    gradeBatch.grades
      .map((grade: Record<string, any>) => grade.specimenId)
      .join("\0") === packetOrder.join("\0") &&
      gradeBatch.grades
        .map((grade: Record<string, any>) => grade.referenceId)
        .join("\0") === cellOrder.join("\0"),
    "grade cardinality/order differs from the packet",
  );
  assert(
    new Set(packetOrder).size === 12 &&
      new Set(cellOrder).size === 12 &&
      new Set(
        gradeBatch.grades.map((grade: Record<string, any>) => grade.specimenId),
      ).size === 12,
    "packet or grades contain duplicate identifiers",
  );
  for (const grade of gradeBatch.grades) {
    exactKeys(
      grade,
      ["specimenId", "referenceId", "recognisable", "confidence", "defects"],
      `grade ${grade.specimenId}`,
    );
    assert(
      typeof grade.recognisable === "boolean" &&
        CONFIDENCES.includes(grade.confidence) &&
        Array.isArray(grade.defects) &&
        grade.defects.every(
          (defect: unknown) =>
            typeof defect === "string" &&
            defect.length > 0 &&
            !IMPLEMENTATION_GUESS.test(defect),
        ),
      `${grade.specimenId} required grade fields are invalid`,
    );
    assert(
      grade.recognisable || grade.defects.length > 0,
      `${grade.specimenId} failure has no defects`,
    );
  }
  const recognisable = gradeBatch.grades.filter(
    (grade: Record<string, any>) => grade.recognisable,
  ).length;
  assert(
    exactGradeArithmetic(gradeBatch.counts, recognisable),
    "grade count arithmetic is impossible",
  );
  assert(
    Array.isArray(key.mappings) &&
      key.mappings.length === 12 &&
      key.mappings
        .map((mapping: Record<string, any>) => mapping.anonymousCell)
        .join("\0") === cellOrder.join("\0") &&
      key.mappings
        .map((mapping: Record<string, any>) => mapping.anonymousSpecimen)
        .join("\0") === packetOrder.join("\0"),
    "sealed key cardinality/order differs from packet",
  );
  assert(
    new Set(
      key.mappings.map((mapping: Record<string, any>) => mapping.anonymousCell),
    ).size === 12 &&
      new Set(
        key.mappings.map(
          (mapping: Record<string, any>) => mapping.anonymousSpecimen,
        ),
      ).size === 12,
    "sealed mapping is not bijective",
  );
  for (const [index, mapping] of key.mappings.entries()) {
    exactKeys(
      mapping,
      [
        "anonymousCell",
        "anonymousSpecimen",
        "adapterIdentity",
        "variant",
        "state",
        "liveNodeId",
        "sourceReferencePath",
        "liveEvidencePath",
      ],
      `sealed mapping ${index}`,
    );
    const packetCell = packet.cells[index];
    assert(
      readFileSync(mapping.sourceReferencePath).equals(
        readFileSync(
          path.join(`${ROOT}/blind-packet`, packetCell.reference.image),
        ),
      ) &&
        readFileSync(mapping.liveEvidencePath).equals(
          readFileSync(
            path.join(`${ROOT}/blind-packet`, packetCell.specimen.image),
          ),
        ),
      `${mapping.anonymousCell} copied evidence bytes differ`,
    );
  }
  assert(
    verification.fileKey === "byMp6lt0Ij9b2QbkDGFwBh" &&
      verification.pageId === "85:6781" &&
      verification.proofSectionId === "85:8089" &&
      verification.pairedSectionId === "85:8090" &&
      verification.sets.map((set: Record<string, any>) => set.id).join("\0") ===
        ["85:7406", "85:8054"].join("\0") &&
      verification.instances
        .map((instance: Record<string, any>) => instance.id)
        .join("\0") === ["85:8091", "85:8107"].join("\0") &&
      verification.mutatedPreExistingNodeIds.length === 0,
    "retained Scratch target IDs or mutation census differ",
  );
  assert(
    plan.writer?.sha256 ===
      "2cab582e5b9a7329ec6e316d9981dc13e74532ed9b4b6bd64afff56408547cd8" &&
      plan.transport?.wrapperSha256 ===
        "11abf92e7049b42ba6023efa5e5c2e2ede489f108b8e10aed0aa1da3d736909a" &&
      hashPath(supportingPaths.liveVerification) ===
        "17a2d9327cd9c75171e4fca8f5c68bfe41f3010bb2ca818c6c195fbed4475aca" &&
      hashPath(supportingPaths.normalizedReadback) ===
        "d077fcc8fb1c8933da5ecd2ac2ea33a4a2c33fb75c7afe12d376fdfbb494904a" &&
      plan.writer?.sha256 === attempt2.decodedSha256 &&
      plan.writer?.bytes === attempt2.decodedBytes &&
      attempt2.evalBegan === true &&
      attempt2.evalCompleted === true &&
      attempt2.bridgeResult?.result?.transport?.evalCompleted === true,
    "writer/transport execution proof differs",
  );
  assert(
    receipt.writer.counts.variants === 288 &&
      receipt.writer.counts.variables === 57 &&
      receipt.writer.counts.bindings === 4296 &&
      verification.sets.length === 2 &&
      verification.sets.every(
        (set: Record<string, any>) => set.variants === 144,
      ),
    "live mint cardinality differs",
  );
  assert(
    verification.images.length === 14 &&
      verification.images.filter(
        (image: Record<string, any>) => image.kind === "paired-cell",
      ).length === 12 &&
      verification.setImages.length === 2 &&
      verification.cellRecords.length === 12 &&
      [...verification.images, ...verification.setImages].every(
        (image: Record<string, any>) =>
          image.bytes > 0 && hashPath(image.path) === image.sha256,
      ),
    "live screenshot cardinality/hash/nonzero checks failed",
  );
  assert(
    verification.probes.length === 2 &&
      verification.probes.every(
        (probe: Record<string, any>) =>
          probe.resize?.passed === true &&
          probe.variantSwitching?.passed === true &&
          probe.tokenBinding?.passed === true &&
          probe.tokenBinding?.bindingFacts > 0 &&
          probe.noFakeLayout?.passed === true &&
          probe.noFakeLayout?.layoutChildren > 0 &&
          probe.noFakeLayout?.layoutChildren ===
            probe.noFakeLayout?.nonAbsoluteChildren &&
          probe.labelValidation?.denominator === 144 &&
          probe.labelValidation?.passed === 144 &&
          probe.restored === true &&
          probe.resize?.restorationBeforeSha256 ===
            probe.resize?.restorationAfterSha256,
      ),
    "live usability or exact restoration proof failed",
  );
  assert(
    verification.readback?.comparedFacts === 7956 &&
      verification.readback?.observedFacts === 13248 &&
      verification.readback?.twoCompleteCyclesStable === true &&
      verification.readback?.canonicalCycle1Sha256 ===
        verification.readback?.canonicalCycle2Sha256 &&
      verification.zeroSilentAccounting?.denominator === 13248 &&
      verification.zeroSilentAccounting?.carried === 13248 &&
      verification.zeroSilentAccounting?.codeOnly === 0 &&
      verification.zeroSilentAccounting?.namedRefused === 0 &&
      verification.zeroSilentAccounting?.silent === 0,
    "live fixed-point or 13,248-fact accounting proof failed",
  );
  const { selectionEvidence, adapterEvidence } =
    assertSelectionAndArchitecture();
  const offline = readCommittedButtonV2Adjudication();
  assert(
    offline.aggregates.byImplementation.legacy.cellWeighted.numerator === 7 &&
      offline.aggregates.byImplementation.legacy.cellWeighted.denominator ===
        12 &&
      offline.aggregates.byImplementation.recipeReact.cellWeighted.numerator ===
        12 &&
      offline.aggregates.byImplementation.recipeReact.cellWeighted
        .denominator === 12 &&
      offline.webComponentParity.cells === 12 &&
      offline.webComponentParity.nonZeroMeasurements === true &&
      offline.comparisonHistory?.immutableV1.recipeReactCellWeighted
        .numerator === 0,
    "offline v1/v2 comparison or Web Component parity differs",
  );

  // Phase 2: all sealed-input and supporting-evidence integrity has passed.
  // The mapping may now be unsealed and aggregated without changing grades.
  const gradeBySpecimen = new Map(
    gradeBatch.grades.map((grade: Record<string, any>) => [
      grade.specimenId,
      grade,
    ]),
  );
  const v2References = new Map(
    offline.sourceReferences.map((reference) => [reference.cellKey, reference]),
  );
  const verificationByNode = new Map<string, Record<string, any>>(
    verification.cellRecords.map((record: Record<string, any>) => [
      record.nodeId,
      record,
    ]),
  );
  const cells = new Set<string>();
  const unsealedMapping: UnsealedLiveGrade[] = key.mappings.map(
    (mapping: Record<string, any>) => {
      assert(
        ADAPTERS.includes(mapping.adapterIdentity) &&
          VARIANTS.includes(mapping.variant) &&
          STATES.includes(mapping.state),
        `${mapping.anonymousCell} has an unsupported unsealed identity`,
      );
      const sourceLibrary = mapping.adapterIdentity.startsWith("altitude")
        ? "altitude"
        : "fluent";
      const cellKey = `${sourceLibrary}/variant=${mapping.variant}/state=${mapping.state}`;
      assert(!cells.has(cellKey), `${cellKey} is mapped more than once`);
      cells.add(cellKey);
      const grade = gradeBySpecimen.get(mapping.anonymousSpecimen);
      const reference = v2References.get(cellKey);
      const liveRecord = verificationByNode.get(mapping.liveNodeId);
      assert(
        grade &&
          reference &&
          liveRecord &&
          grade.referenceId === mapping.anonymousCell,
        `${cellKey} mapping is incomplete across grade/key/live evidence`,
      );
      assert(
        reference.independentHarness === true &&
          reference.screenshotHash === hashPath(mapping.sourceReferencePath) &&
          !mapping.sourceReferencePath.startsWith(ROOT) &&
          mapping.sourceReferencePath.startsWith(
            "recipe/evidence/button-comparison-v2/source-reference/",
          ),
        `${cellKey} source reference provenance is stale or self-referential`,
      );
      assert(
        liveRecord.adapterIdentity === mapping.adapterIdentity &&
          liveRecord.variant === mapping.variant &&
          liveRecord.state === mapping.state &&
          hashPath(mapping.liveEvidencePath) > "" &&
          readFileSync(mapping.sourceReferencePath).byteLength > 0 &&
          readFileSync(mapping.liveEvidencePath).byteLength > 0,
        `${cellKey} live evidence is stale, zero-byte, or mismapped`,
      );
      return {
        anonymousCell: mapping.anonymousCell,
        specimenId: mapping.anonymousSpecimen,
        recognisable: grade.recognisable,
        confidence: grade.confidence,
        defects: [...grade.defects],
        sourceLibrary,
        adapterIdentity: mapping.adapterIdentity,
        variant: mapping.variant,
        state: mapping.state,
        liveNodeId: mapping.liveNodeId,
        sourceReferencePath: mapping.sourceReferencePath,
        liveEvidencePath: mapping.liveEvidencePath,
        sourceReferenceSha256: hashPath(mapping.sourceReferencePath),
        liveEvidenceSha256: hashPath(mapping.liveEvidencePath),
      };
    },
  );
  assert(
    cells.size === 12 &&
      ADAPTERS.every(
        (adapter) =>
          unsealedMapping.filter((grade) => grade.adapterIdentity === adapter)
            .length === 6,
      ),
    "unsealed source-library×variant×state mapping is incomplete",
  );
  const expectedBatchHash = sha256(
    unsealedMapping
      .map((grade) =>
        sha256(
          `v4-order:${grade.sourceLibrary}/${grade.variant}/${grade.state}`,
        ),
      )
      .join("\n"),
  );
  assert(
    packet.randomizedBatchSha256 === expectedBatchHash,
    "randomized batch hash differs from the unique unsealed mapping",
  );
  const overall = score(unsealedMapping);
  assert(
    overall.numerator === 12 &&
      overall.denominator === 12 &&
      unsealedMapping.every(
        (grade) => grade.confidence === "high" && grade.defects.length === 0,
      ),
    "independent live canvas grade did not pass 12/12 at high confidence",
  );

  const bySourceLibrary = grouped(
    ["altitude", "fluent"],
    unsealedMapping,
    (grade, value) => grade.sourceLibrary === value,
    score,
  ) as Record<string, Score>;
  const byVariant = grouped(
    VARIANTS,
    unsealedMapping,
    (grade, value) => grade.variant === value,
    score,
  ) as Record<string, Score>;
  const byState = grouped(
    STATES,
    unsealedMapping,
    (grade, value) => grade.state === value,
    score,
  ) as Record<string, Score>;
  const columns: ButtonLiveV4Adjudication["evidenceColumns"] = {
    explicitRecipeSelection: {
      status: "passed",
      evidence: selectionEvidence,
    },
    unrelatedAdaptersNoSourceBranches: {
      status: "passed",
      evidence: adapterEvidence,
    },
    offlineReactPairedGrade: {
      status: "passed",
      evidence: {
        correctedRecipeReact: "12/12",
        unchangedLegacy: "7/12",
        immutableV1RecipeReact: "0/12",
      },
    },
    webComponentParity: {
      status: "passed",
      evidence: {
        cells: 12,
        nonzeroCells: 12,
        recognisability: "not-blind-graded",
      },
    },
    liveFigmaMint: {
      status: "passed",
      evidence: {
        componentSets: 2,
        variants: 288,
        variables: 57,
        bindings: 4296,
      },
    },
    liveUsability: {
      status: "passed",
      evidence: {
        sources: 2,
        reflow: "2/2",
        variantSwitching: "2/2",
        tokenBinding: "2/2",
        noFakeLayout: "2/2",
        labels: "288/288",
        inFlowChildren: "600/600",
        bindingFacts: 5160,
      },
    },
    exactProbeRestoration: {
      status: "passed",
      evidence: {
        sources: "2/2",
        altitudeHash: verification.probes[0].resize.restorationBeforeSha256,
        fluentHash: verification.probes[1].resize.restorationBeforeSha256,
      },
    },
    liveReadbackFixedPoint: {
      status: "passed",
      evidence: {
        comparedFacts: 7956,
        observedFacts: 13248,
        cycles: 2,
        canonicalSha256: verification.readback.canonicalCycle1Sha256,
      },
    },
    zeroSilentAccounting: {
      status: "passed",
      evidence: {
        denominator: 13248,
        carried: 13248,
        codeOnly: 0,
        namedRefused: 0,
        silent: 0,
      },
    },
    independentLiveCanvasGrade: {
      status: "passed",
      evidence: {
        recognisable: "12/12",
        confidence: { high: 12, medium: 0, low: 0 },
        gradeBytesUnchanged: true,
      },
    },
    independentSourceReferences: {
      status: "passed",
      evidence: {
        references: 12,
        independentHarnessReferences: 12,
        originalSourceFamily:
          "button-comparison-v2 original external-library source renders",
        underTestPathsUsedAsReferences: 0,
      },
    },
  };
  const completedColumns = Object.values(columns).filter(
    (column) => column.status === "passed",
  ).length;
  assert(
    completedColumns === Object.keys(columns).length,
    "one or more required Button evidence columns are missing",
  );

  return {
    artifactVersion: "button-live-final-adjudication-v4",
    inputHashes: inputHashes(sourceBytes),
    integrity: {
      status: "passed",
      checks: {
        packetGradeKeyReceiptHashesMatch: true,
        packetAndKeySeparated: true,
        packetOpaqueAndUngraded: true,
        noImplementationGuesses: true,
        requiredFieldsComplete: true,
        cardinalityAndOrderMatch: true,
        gradeArithmeticValid: true,
        answerMappingBijective: true,
        twelveNonzeroPairs: true,
        originalReferenceProvenanceIndependent: true,
        writerAndTransportHashesMatch: true,
        scratchFilePageSetIdsMatch: true,
        screenshotsMatch: true,
        usabilityAndRestorationMatch: true,
        readbackAndFixedPointMatch: true,
        zeroSilentAccountingMatches: true,
        immutableFailureHistoryRetained: true,
      },
    },
    unsealedMapping,
    aggregates: {
      overall,
      bySourceLibrary,
      byVariant,
      byState,
      confidence: {
        overall: confidence(unsealedMapping),
        bySourceLibrary: grouped(
          ["altitude", "fluent"],
          unsealedMapping,
          (grade, value) => grade.sourceLibrary === value,
          confidence,
        ) as Record<string, ConfidenceDistribution>,
        byVariant: grouped(
          VARIANTS,
          unsealedMapping,
          (grade, value) => grade.variant === value,
          confidence,
        ) as Record<string, ConfidenceDistribution>,
        byState: grouped(
          STATES,
          unsealedMapping,
          (grade, value) => grade.state === value,
          confidence,
        ) as Record<string, ConfidenceDistribution>,
      },
    },
    evidenceColumns: columns,
    retainedScratchArtifacts: {
      fileKey: verification.fileKey,
      pageId: verification.pageId,
      pageName: verification.pageName,
      proofSectionId: verification.proofSectionId,
      pairedSectionId: verification.pairedSectionId,
      componentSetIds: verification.sets.map(
        (set: Record<string, any>) => set.id,
      ),
      representativeInstanceIds: verification.instances.map(
        (instance: Record<string, any>) => instance.id,
      ),
      pairedCellNodeIds: verification.cellRecords.map(
        (record: Record<string, any>) => record.nodeId,
      ),
    },
    history: {
      offlineV1: {
        result: "recipe React 0/12; legacy 9/12; retained failure",
        sha256: hashPath(BUTTON_ADJUDICATION_PATH),
      },
      offlineV2: {
        result: "recipe React 12/12; unchanged legacy 7/12",
        sha256: hashPath(BUTTON_V2_ADJUDICATION_PATH),
      },
      liveV1: {
        result: "failed after three capped writer attempts",
        sha256: hashPath(supportingPaths.liveV1Receipt),
      },
      liveV2: {
        result: "failed closed before execution",
        sha256: hashPath(supportingPaths.liveV2Receipt),
      },
      liveV3: {
        result: "failed Fluent reflow/zero-width label; cleaned",
        sha256: hashPath(supportingPaths.liveV3Receipt),
      },
      liveV4PreGradeReceipt: {
        result: "complete live proof pending independent grade",
        sha256: sha256(sourceBytes.receipt),
      },
    },
    proofBoundary: {
      proves:
        "The button@1 recipe protocol passes one Button archetype over two unrelated real libraries on one matched 12-cell slice, including offline outputs and a retained live Scratch mint.",
      doesNotProve: [
        "Input/Field",
        "Combobox",
        "Data Table",
        "Calendar",
        "any library beyond Altitude and Fluent",
        "any Button cell outside the fixed medium/no-icons default-hover-focus-visible matched slice",
      ],
    },
    verdict: {
      buttonSuccess: true,
      completedColumns,
      requiredColumns: Object.keys(columns).length,
      blockers: [],
      nextTask:
        "Design the Input/Field recipe as the difficult control, starting offline and reusing the proven protocol.",
    },
  };
}

function exactGradeArithmetic(
  counts: Record<string, unknown>,
  recognisable: number,
): boolean {
  return (
    counts.expectedCells === 12 &&
    counts.packetCells === 12 &&
    counts.packetSpecimens === 12 &&
    counts.referenceImages === 12 &&
    counts.specimenImages === 12 &&
    counts.nonzeroImages === 24 &&
    counts.gradedSpecimens === 12 &&
    counts.recognisable === recognisable &&
    counts.notRecognisable === 12 - recognisable
  );
}

export function validateCommittedButtonLiveV4Adjudication(
  artifact: ButtonLiveV4Adjudication,
  sourceBytes: LiveV4SourceBytes = readButtonLiveV4AdjudicationSources(),
): ButtonLiveV4Adjudication {
  const hashes = inputHashes(sourceBytes);
  assert(
    JSON.stringify(artifact.inputHashes) === JSON.stringify(hashes),
    "final adjudication is stale: packet/grade/key/receipt/supporting evidence changed",
  );
  const recomputed = adjudicateButtonLiveV4(sourceBytes);
  assert(
    JSON.stringify(artifact) === JSON.stringify(recomputed),
    "final adjudication mapping, aggregate arithmetic, or evidence columns differ from recomputation",
  );
  return recomputed;
}

export const readCommittedButtonLiveV4Adjudication =
  (): ButtonLiveV4Adjudication =>
    validateCommittedButtonLiveV4Adjudication(
      parse<ButtonLiveV4Adjudication>(
        "committed final adjudication",
        readFileSync(BUTTON_LIVE_V4_ADJUDICATION_PATH, "utf8"),
      ),
    );

const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const result = adjudicateButtonLiveV4(readButtonLiveV4AdjudicationSources());
  if (process.argv.includes("--write")) {
    writeFileSync(
      BUTTON_LIVE_V4_ADJUDICATION_PATH,
      `${JSON.stringify(result, null, 2)}\n`,
    );
    console.log(`WROTE ${BUTTON_LIVE_V4_ADJUDICATION_PATH}`);
  } else {
    validateCommittedButtonLiveV4Adjudication(
      parse<ButtonLiveV4Adjudication>(
        "committed final adjudication",
        readFileSync(BUTTON_LIVE_V4_ADJUDICATION_PATH, "utf8"),
      ),
    );
    console.log(
      `Button live v4 final adjudication: ${result.aggregates.overall.numerator}/${result.aggregates.overall.denominator}; Button success ${result.verdict.buttonSuccess}`,
    );
  }
}
