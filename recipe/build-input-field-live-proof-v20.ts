import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import {
  buildInputLiveV20CaptureProgram,
  buildInputLiveV20ExtractProgram,
  buildInputLiveV20ProbeProgram,
  buildInputLiveV20RestoreProgram,
  INPUT_LIVE_V20_CAPTURE_COUNT,
  INPUT_LIVE_V20_RESPONSE_CONTRACTS,
  inputLiveV20CaptureManifestSha256,
  type InputLiveV20CaptureCell,
  type InputLiveV20SourceIdentity,
  type InputLiveV20WriterOwnership,
} from "./input-field-live-v20-contract.js";
import {
  INPUT_LIVE_V20_DYNAMIC_TOOL,
  INPUT_LIVE_V20_TARGET,
  inputLiveV20RequestSequence,
} from "./input-field-live-v20-broker.js";
import {
  V12_WRITER_PAYLOAD_SHA256,
  V12_WRITER_PROGRAM_SHA256,
  V16_EXTRACT_BLUEPRINT_SHA256,
  V16_RESTORE_BLUEPRINT_SHA256,
  V16_RUNTIME_SOURCE_SHA256,
  V17_SCENE_READBACK_SHA256,
  V18_SCENE_READBACK_SHA256,
  V19_SCENE_READBACK_SHA256,
} from "./input-field-live-v20-restore.js";

export const INPUT_LIVE_V20_EVIDENCE_ROOT =
  "recipe/evidence/input-field-live-pivot-v20";
export const INPUT_LIVE_V20_PROTOCOL_PATH = `${INPUT_LIVE_V20_EVIDENCE_ROOT}/protocol.json`;
export const INPUT_LIVE_V20_PLAN_PATH = `${INPUT_LIVE_V20_EVIDENCE_ROOT}/proof-plan.json`;
export const INPUT_LIVE_V20_CAPTURE_MANIFEST_PATH = `${INPUT_LIVE_V20_EVIDENCE_ROOT}/capture-manifest.json`;
export const INPUT_LIVE_V20_REQUEST_MANIFEST_PATH = `${INPUT_LIVE_V20_EVIDENCE_ROOT}/request-manifest.json`;
export const INPUT_LIVE_V20_INDEX_PATH = `${INPUT_LIVE_V20_EVIDENCE_ROOT}/antecedent-index.json`;
export const INPUT_LIVE_V20_AUTHORIZATION_TEMPLATE_PATH = `${INPUT_LIVE_V20_EVIDENCE_ROOT}/authorization-template.json`;
export const INPUT_LIVE_V20_AUTHORIZATION_PATH = `${INPUT_LIVE_V20_EVIDENCE_ROOT}/capture-authorization.json`;

const V16_PROOF_ROOT = "recipe/evidence/input-field-live-pivot-v16";
const V16_PLAN = `${V16_PROOF_ROOT}/proof-plan.json`;
const V16_CAPTURE_MANIFEST = `${V16_PROOF_ROOT}/capture-manifest.json`;
const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");
const json = <T>(file: string): T =>
  JSON.parse(readFileSync(file, "utf8")) as T;
const jsonBytes = (value: unknown): Buffer =>
  Buffer.from(`${JSON.stringify(value, null, 2)}\n`);

export interface InputLiveV20ProofPlan {
  artifactVersion: "input-live-v20-proof-plan-v1";
  status: "draft antecedent; pending separate authorization; live execution forbidden";
  target: typeof INPUT_LIVE_V20_TARGET;
  namespace: "ds.contracts.input.recipe.v5";
  writer: {
    programPath: string;
    programBytes: number;
    programSha256: string;
    payloadPath: string;
    payloadBytes: number;
    payloadSha256: string;
  };
  sources: Array<{
    source: "mui" | "polaris";
    adapterIdentity: string;
    recipeHash: string;
    envelopeHash: string;
    expectedScenePlan: {
      path: string;
      bytes: number;
      sha256: string;
      uncompressedBytes: number;
      uncompressedSha256: string;
      facts: number;
      generatedDescendants: number;
    };
  }>;
  captureManifest: {
    path: string;
    cells: 128;
    requests: 128;
    cellsPerRequest: 1;
    sha256: string;
    maximumPngBytesPerResponse: 1_500_000;
    maximumRawResponseBytes: 2_100_000;
  };
  requests: {
    remote: 133;
    mainLane: 132;
    recoveryCleanup: 1;
    hostPhases: 3;
  };
  attempts: {
    executed: 0;
    next: 1;
    maximum: 3;
    cleanPublishedDescendantsOnly: true;
  };
  humanSignoff: "pending";
  overallInputSuccess: false;
}

interface GeneratedSource {
  source: "mui" | "polaris";
  adapterIdentity: string;
  recipeHash: string;
  envelopeHash: string;
  expectedScenePlan: InputLiveV20SourceIdentity["expectedScenePlan"];
  outputPath: string;
  compressed: Buffer;
  metadata: InputLiveV20ProofPlan["sources"][number]["expectedScenePlan"];
}

const sourcePlans = (): GeneratedSource[] => {
  const prior = json<Record<string, any>>(V16_PLAN);
  return prior.sources.map((source: Record<string, any>) => {
    const sourceId = source.source as "mui" | "polaris";
    const inputPath = source.expectedScenePlan.path as string;
    const compressed = readFileSync(inputPath);
    const uncompressed = gunzipSync(compressed);
    if (
      sha256(compressed) !== source.expectedScenePlan.sha256 ||
      sha256(uncompressed) !== source.expectedScenePlan.uncompressedSha256
    )
      throw new Error(`Input live v12 source plan drift: ${inputPath}`);
    return {
      source: sourceId,
      adapterIdentity: source.adapterIdentity,
      recipeHash: source.recipeHash,
      envelopeHash: source.envelopeHash,
      expectedScenePlan: JSON.parse(uncompressed.toString("utf8")),
      outputPath: `${INPUT_LIVE_V20_EVIDENCE_ROOT}/expected-scene-plan-${sourceId}.json.gz`,
      compressed,
      metadata: {
        path: `${INPUT_LIVE_V20_EVIDENCE_ROOT}/expected-scene-plan-${sourceId}.json.gz`,
        bytes: compressed.byteLength,
        sha256: sha256(compressed),
        uncompressedBytes: uncompressed.byteLength,
        uncompressedSha256: sha256(uncompressed),
        facts: source.expectedScenePlan.facts,
        generatedDescendants: source.expectedScenePlan.generatedDescendants,
      },
    };
  });
};

const captureCells = (): InputLiveV20CaptureCell[] => {
  const cells = json<Record<string, any>>(V16_CAPTURE_MANIFEST)
    .cells as InputLiveV20CaptureCell[];
  inputLiveV20CaptureManifestSha256(cells);
  return cells;
};

const protocol = () => ({
  artifactVersion: "input-live-v20-external-operator-protocol-v1",
  protocolId: "input-live-v20",
  status:
    "draft antecedent; pending separate authorization; live execution forbidden",
  lifecycle: {
    executionAntecedentImmutable: true,
    authorizationAddedOnlyAfterAntecedentCommit: true,
    authorizationExcludedFromAntecedentFreshness: true,
    laterAuthorizationDoesNotRecomputeAntecedent: true,
    v7AuthorizationReusable: false,
    v8AuthorizationReusable: false,
    v9AuthorizationReusable: false,
    v10AuthorizationReusable: false,
    v11AuthorizationReusable: false,
    v12AuthorizationReusable: false,
    v13AuthorizationReusable: false,
    v14AuthorizationReusable: false,
    v15AuthorizationReusable: false,
    v16AuthorizationReusable: false,
    v17AuthorizationReusable: false,
    v18AuthorizationReusable: false,
    v19AuthorizationReusable: false,
    v8AntecedentBytesUnchanged: true,
    v9AntecedentBytesUnchanged: true,
    v10AntecedentBytesUnchanged: true,
    v11AntecedentBytesUnchanged: true,
    sceneReadbackCarried: true,
    carriedV3Verifier: true,
    taughtPostSettleContentFillRestore: true,
    taughtPostWriterContentFillRestore: true,
    taughtTwoPassParentThenContentFillRestore: true,
    taughtHiddenTextFillReveal: true,
    taughtMeasureFillWhileVisible: true,
    taughtExtractMeasureHiddenContentFillWhileVisible: true,
    v12AntecedentBytesUnchanged: true,
    v12WriterBytesUnchanged: true,
    v13AntecedentBytesUnchanged: true,
    v13RestoreBytesUnchanged: true,
    v13WriterBytesUnchanged: true,
    v14AntecedentBytesUnchanged: true,
    v14RestoreBytesUnchanged: true,
    v14WriterBytesUnchanged: true,
    v15AntecedentBytesUnchanged: true,
    v15RestoreBytesUnchanged: true,
    v15WriterBytesUnchanged: true,
    v15RuntimeBytesUnchanged: true,
    v16AntecedentBytesUnchanged: true,
    v16WriterBytesUnchanged: true,
    v16RestoreBytesUnchanged: true,
    v16RuntimeBytesUnchanged: true,
    v16ExtractBytesUnchanged: true,
    v17AntecedentBytesUnchanged: true,
    v17SceneReadbackUnchanged: true,
    v18AntecedentBytesUnchanged: true,
    v18SceneReadbackUnchanged: true,
    v19AntecedentBytesUnchanged: true,
    v19SceneReadbackUnchanged: true,
    taughtLeadingSlotSolidPaintFromPayloadOrChild: true,
    taughtLeadingSlotColorBindingFromChild: true,
    taughtUniformPerSideStrokeWeightAsStrokes0Weight: true,
    taughtVariantLayoutWidthFromWidthValue: true,
  },
  operatorBoundary: {
    expectedDynamicTool: INPUT_LIVE_V20_DYNAMIC_TOOL,
    target: INPUT_LIVE_V20_TARGET,
    externalOperatorRequired: true,
    oneCallPerSignedRequest: true,
    requestSignature: "Ed25519",
    rawResponsePersistedBeforeAcceptance: true,
  },
  execution: {
    remoteRequests: 133,
    mainLaneRequests: 132,
    recoveryCleanupRequests: 1,
    hostPhases: 3,
    requestOrder: [
      "writer",
      "persist signed cleanup recovery request",
      "restore",
      "extract",
      "host normalize and account both roots",
      "probe",
      "host bind technical gates",
      "capture-000 through capture-127",
      "cleanup",
    ],
    maximumFutureAttempts: 3,
    attemptsExecuted: 0,
  },
  proof: {
    roots: 2,
    sources: {
      mui: { expectedFacts: 22_811, generatedDescendants: 128 },
      polaris: { expectedFacts: 20_915, generatedDescendants: 128 },
    },
    expectedFacts: 43_726,
    variants: 256,
    captures: 128,
    cellsPerCaptureRequest: 1,
    sampleReduction: false,
    captureBeforeHashBoundTechnicalGates: false,
    durableCleanupAfterHostFailure: true,
    humanSignoffMandatory: true,
  },
  futureAuthorizationPrerequisites: {
    separateCommittedPublishedAuthorization: true,
    cleanPublishedDescendant: true,
    figmaPatRevokedOrReplaced: true,
    mcpRestartedAfterRotation: true,
    ownerOnlyEnvironmentFileMode0600: true,
    repositorySecretScanZero: true,
    exactScratchReadOnlyProbe: true,
    tokenValuesForbidden: true,
  },
  transportFacts: {
    oneCallDiskOperatorRequired: true,
    honorSignedTimeoutRequired: true,
    signedWriterTimeoutMs: 300_000,
    fileContextEditorTypeReconstructedFromExactScratchTarget: true,
    emptyCodeEnvelopeRefused: true,
    cursorReadMustNotIngestSignedWriter: true,
  },
  hostNormalization: {
    perSideStrokeWeightFields: [
      "strokeTopWeight",
      "strokeRightWeight",
      "strokeBottomWeight",
      "strokeLeftWeight",
    ],
    uniformStrokeWeightSibling: "strokeWeight",
    taughtLiveFillKinds: ["VARIABLE_ALIAS", "boundVariablesOnly"],
    carriedSceneReadback: "recipe/scene-readback-v20.ts",
    carriedSceneReadbackRuntime: "recipe/scene-readback-runtime-v20.ts",
    carriedV3Verifier: "recipe/input-field-live-v3-verifier-v20.ts",
    liveHostDoesNotImportSceneReadbackTs: true,
    v8SceneReadbackUnchanged: true,
    v9AntecedentBytesUnchanged: true,
    v10AntecedentBytesUnchanged: true,
    v11AntecedentBytesUnchanged: true,
    taughtPostSettleContentFillRestore: true,
    taughtPostWriterContentFillRestore: true,
    taughtTwoPassParentThenContentFillRestore: true,
    taughtHiddenTextFillReveal: true,
    taughtMeasureFillWhileVisible: true,
    taughtExtractMeasureHiddenContentFillWhileVisible: true,
    v11WriterBytesUnchanged: false,
    v12WriterBytesUnchanged: true,
    v12AntecedentBytesUnchanged: true,
    v13WriterBytesUnchanged: true,
    v13RestoreBytesUnchanged: true,
    v13AntecedentBytesUnchanged: true,
    v14WriterBytesUnchanged: true,
    v14RestoreBytesUnchanged: true,
    v14AntecedentBytesUnchanged: true,
    v15WriterBytesUnchanged: true,
    v15RestoreBytesUnchanged: true,
    v15RuntimeBytesUnchanged: true,
    v15AntecedentBytesUnchanged: true,
    v16WriterBytesUnchanged: true,
    v16RestoreBytesUnchanged: true,
    v16RuntimeBytesUnchanged: true,
    v16ExtractBytesUnchanged: true,
    v16AntecedentBytesUnchanged: true,
    v17AntecedentBytesUnchanged: true,
    v17SceneReadbackUnchanged: true,
    v18AntecedentBytesUnchanged: true,
    v18SceneReadbackUnchanged: true,
    v19AntecedentBytesUnchanged: true,
    v19SceneReadbackUnchanged: true,
    taughtLeadingSlotSolidPaintFromPayloadOrChild: true,
    taughtLeadingSlotColorBindingFromChild: true,
    taughtUniformPerSideStrokeWeightAsStrokes0Weight: true,
    taughtVariantLayoutWidthFromWidthValue: true,
  },
});

const requestManifest = (
  captures: readonly InputLiveV20CaptureCell[],
  programs: {
    writerSha256: string;
    restoreBlueprintSha256: string;
    extractBlueprintSha256: string;
    probeBlueprintSha256: string;
    captureBlueprintSha256: string;
    cleanupBuilderSha256: string;
  },
) => {
  const requests = [
    {
      requestId: "writer",
      sequence: inputLiveV20RequestSequence("writer"),
      phase: "writer",
      predecessorRequestId: null,
      programSha256: programs.writerSha256,
      response: INPUT_LIVE_V20_RESPONSE_CONTRACTS.writer,
    },
    {
      requestId: "cleanup",
      sequence: inputLiveV20RequestSequence("cleanup"),
      phase: "cleanup",
      predecessorRequestId: "writer",
      programBuilderSha256: programs.cleanupBuilderSha256,
      response: INPUT_LIVE_V20_RESPONSE_CONTRACTS.cleanup,
      availability: "persisted immediately after writer acceptance",
    },
    {
      requestId: "restore",
      sequence: inputLiveV20RequestSequence("restore"),
      phase: "restore",
      predecessorRequestId: "writer",
      programSha256: programs.restoreBlueprintSha256,
      response: INPUT_LIVE_V20_RESPONSE_CONTRACTS.restore,
      availability:
        "issued immediately after writer acceptance; before extract",
    },
    {
      requestId: "extract",
      sequence: inputLiveV20RequestSequence("extract"),
      phase: "extract",
      predecessorRequestId: "restore",
      programSha256: programs.extractBlueprintSha256,
      response: INPUT_LIVE_V20_RESPONSE_CONTRACTS.extract,
    },
    {
      requestId: "probe",
      sequence: inputLiveV20RequestSequence("probe"),
      phase: "probe",
      predecessorRequestId: "extract",
      programSha256: programs.probeBlueprintSha256,
      response: INPUT_LIVE_V20_RESPONSE_CONTRACTS.probe,
    },
    ...captures.map((cell) => ({
      requestId: `capture-${String(cell.index).padStart(3, "0")}`,
      sequence: inputLiveV20RequestSequence("capture", cell.index),
      phase: "capture",
      captureIndex: cell.index,
      cellKey: cell.cellKey,
      predecessorRequestId:
        cell.index === 0
          ? "probe"
          : `capture-${String(cell.index - 1).padStart(3, "0")}`,
      programBuilderSha256: programs.captureBlueprintSha256,
      response: INPUT_LIVE_V20_RESPONSE_CONTRACTS.capture,
    })),
  ];
  return {
    artifactVersion: "input-live-v20-request-manifest-v1",
    expectedDynamicTool: INPUT_LIVE_V20_DYNAMIC_TOOL,
    target: INPUT_LIVE_V20_TARGET,
    signedAtRuntime: true,
    runtimePins: [
      "transaction and attempt",
      "sequence and predecessor request",
      "previous accepted receipt",
      "dynamic tool and exact target",
      "program and arguments",
      "response schema, cardinality, and maximum bytes",
      "antecedent and authorization commits",
      "proof and capture manifests",
      "cleanup availability",
    ],
    requestCount: requests.length,
    requests,
  };
};

const lifecycleExcludedPaths = [
  INPUT_LIVE_V20_AUTHORIZATION_TEMPLATE_PATH,
  INPUT_LIVE_V20_AUTHORIZATION_PATH,
  "recipe/input-field-live-v20-authorization.ts",
  "recipe/input-field-live-v20-authorization.test.ts",
  "recipe/input-field-live-v20-preflight.ts",
  "recipe/input-field-live-v20-authorized.ts",
  "recipe/evidence/input-field-live-pivot-v20/operator-security-attestation-template.json",
  "recipe/evidence/input-field-live-pivot-v20-status.json",
  "recipe/evidence/status-index.json",
] as const;

const sourceNeutralDependencies = [
  "recipe/input-field-live-v3-cleanup.ts",
  "recipe/input-field-live-v3-verifier-v20.ts",
  "recipe/input-field-live-v20-verifier.ts",
  "recipe/figma-property-normalizer-v8.ts",
  "recipe/figma-runtime-portability.ts",
  "recipe/input-field-objective-comparison-v1.ts",
  "recipe/normalize.ts",
  "recipe/scene-readback-runtime-v20.ts",
  "recipe/scene-readback-v20.ts",
  "recipe/input-field-live-v20-restore.ts",
] as const;

export async function buildInputLiveV20Proof(
  check = process.argv.includes("--check"),
): Promise<InputLiveV20ProofPlan> {
  const captures = captureCells();
  const sources = sourcePlans();
  const priorPlan = json<Record<string, any>>(V16_PLAN);
  const writerProgram = readFileSync(priorPlan.writer.programPath);
  const writerPayload = readFileSync(priorPlan.writer.payloadPath);
  const priorRestore = readFileSync(
    `${V16_PROOF_ROOT}/programs/restore-blueprint.js`,
  );
  const priorRuntime = readFileSync("recipe/scene-readback-runtime-v16.ts");
  const priorExtract = readFileSync(
    `${V16_PROOF_ROOT}/programs/extract-blueprint.js`,
  );
  const priorV17SceneReadback = readFileSync("recipe/scene-readback-v17.ts");
  const priorV18SceneReadback = readFileSync("recipe/scene-readback-v18.ts");
  const priorV19SceneReadback = readFileSync("recipe/scene-readback-v19.ts");
  if (
    sha256(writerProgram) !== priorPlan.writer.programSha256 ||
    sha256(writerPayload) !== priorPlan.writer.payloadSha256 ||
    sha256(writerProgram) !== V12_WRITER_PROGRAM_SHA256 ||
    sha256(writerPayload) !== V12_WRITER_PAYLOAD_SHA256 ||
    sha256(priorRestore) !== V16_RESTORE_BLUEPRINT_SHA256 ||
    sha256(priorRuntime) !== V16_RUNTIME_SOURCE_SHA256 ||
    sha256(priorExtract) !== V16_EXTRACT_BLUEPRINT_SHA256 ||
    sha256(priorV17SceneReadback) !== V17_SCENE_READBACK_SHA256 ||
    sha256(priorV18SceneReadback) !== V18_SCENE_READBACK_SHA256 ||
    sha256(priorV19SceneReadback) !== V19_SCENE_READBACK_SHA256
  )
    throw new Error(
      "Input live v20 exact committed v16 writer/restore/runtime/extract or hashed v17/v18/v19 scene-readback bytes drifted",
    );

  const writerOwnershipBlueprint: InputLiveV20WriterOwnership = {
    pageId: "__WRITER_PAGE_ID__",
    pageName: "Recipe Pivot / Input Field / v9",
    runIdentity: "input-live-v20",
    setIds: ["__MUI_SET_ID__", "__POLARIS_SET_ID__"],
    sectionIds: ["__MUI_SECTION_ID__", "__POLARIS_SECTION_ID__"],
    collectionIds: ["__MUI_COLLECTION_ID__", "__POLARIS_COLLECTION_ID__"],
    createdNodeIds: ["__WRITER_CREATED_NODE_IDS__"],
    sources: sources.map((source, index) => ({
      adapterIdentity: source.adapterIdentity,
      setId: index === 0 ? "__MUI_SET_ID__" : "__POLARIS_SET_ID__",
      sectionId: index === 0 ? "__MUI_SECTION_ID__" : "__POLARIS_SECTION_ID__",
      collectionId:
        index === 0 ? "__MUI_COLLECTION_ID__" : "__POLARIS_COLLECTION_ID__",
      variableCount: index === 0 ? 75 : 77,
      variantCount: 128,
      cellCount: 128,
      recipeHash: source.recipeHash,
      envelopeHash: source.envelopeHash,
    })),
    counts: { sources: 2, variants: 256, collections: 2, nodes: 1 },
  };
  const identities = sources.map(
    (source) =>
      ({
        source: source.source,
        adapterIdentity: source.adapterIdentity,
        recipeHash: source.recipeHash,
        envelopeHash: source.envelopeHash,
        expectedScenePlan: source.expectedScenePlan,
      }) satisfies InputLiveV20SourceIdentity,
  );
  const restoreBlueprint = Buffer.from(
    buildInputLiveV20RestoreProgram(writerOwnershipBlueprint),
  );
  const extractBlueprint = Buffer.from(
    buildInputLiveV20ExtractProgram(writerOwnershipBlueprint, identities),
  );
  const probeBlueprint = Buffer.from(
    buildInputLiveV20ProbeProgram(writerOwnershipBlueprint, identities),
  );
  const captureBlueprint = Buffer.from(
    buildInputLiveV20CaptureProgram(writerOwnershipBlueprint, captures[0]!),
  );

  const antecedentOutputs = new Map<string, Buffer>();
  antecedentOutputs.set(INPUT_LIVE_V20_PROTOCOL_PATH, jsonBytes(protocol()));
  antecedentOutputs.set(
    `${INPUT_LIVE_V20_EVIDENCE_ROOT}/programs/writer.txt`,
    writerProgram,
  );
  antecedentOutputs.set(
    `${INPUT_LIVE_V20_EVIDENCE_ROOT}/programs/writer-payload.js`,
    writerPayload,
  );
  antecedentOutputs.set(
    `${INPUT_LIVE_V20_EVIDENCE_ROOT}/programs/restore-blueprint.js`,
    restoreBlueprint,
  );
  antecedentOutputs.set(
    `${INPUT_LIVE_V20_EVIDENCE_ROOT}/programs/extract-blueprint.js`,
    extractBlueprint,
  );
  antecedentOutputs.set(
    `${INPUT_LIVE_V20_EVIDENCE_ROOT}/programs/probe-blueprint.js`,
    probeBlueprint,
  );
  antecedentOutputs.set(
    `${INPUT_LIVE_V20_EVIDENCE_ROOT}/programs/capture-blueprint.js`,
    captureBlueprint,
  );
  for (const source of sources)
    antecedentOutputs.set(source.outputPath, source.compressed);

  const captureManifest = {
    artifactVersion: "input-live-v20-capture-manifest-v1",
    status: "planned only; authorization and capture pending",
    transport: {
      encoding: "one PNG base64 payload per signed response",
      cellsPerRequest: 1,
      requests: 128,
      maximumPngBytesPerResponse: 1_500_000,
      maximumRawResponseBytes: 2_100_000,
      rejectTruncationDuplicatesMissing: true,
      sampleReduction: false,
    },
    cells: captures,
    cellsSha256: inputLiveV20CaptureManifestSha256(captures),
  };
  const captureManifestBytes = jsonBytes(captureManifest);
  antecedentOutputs.set(
    INPUT_LIVE_V20_CAPTURE_MANIFEST_PATH,
    captureManifestBytes,
  );

  const proofPlan: InputLiveV20ProofPlan = {
    artifactVersion: "input-live-v20-proof-plan-v1",
    status:
      "draft antecedent; pending separate authorization; live execution forbidden",
    target: INPUT_LIVE_V20_TARGET,
    namespace: "ds.contracts.input.recipe.v5",
    writer: {
      programPath: `${INPUT_LIVE_V20_EVIDENCE_ROOT}/programs/writer.txt`,
      programBytes: writerProgram.byteLength,
      programSha256: sha256(writerProgram),
      payloadPath: `${INPUT_LIVE_V20_EVIDENCE_ROOT}/programs/writer-payload.js`,
      payloadBytes: writerPayload.byteLength,
      payloadSha256: sha256(writerPayload),
    },
    sources: sources.map((source) => ({
      source: source.source,
      adapterIdentity: source.adapterIdentity,
      recipeHash: source.recipeHash,
      envelopeHash: source.envelopeHash,
      expectedScenePlan: source.metadata,
    })),
    captureManifest: {
      path: INPUT_LIVE_V20_CAPTURE_MANIFEST_PATH,
      cells: 128,
      requests: 128,
      cellsPerRequest: 1,
      sha256: sha256(captureManifestBytes),
      maximumPngBytesPerResponse: 1_500_000,
      maximumRawResponseBytes: 2_100_000,
    },
    requests: {
      remote: 133,
      mainLane: 132,
      recoveryCleanup: 1,
      hostPhases: 3,
    },
    attempts: {
      executed: 0,
      next: 1,
      maximum: 3,
      cleanPublishedDescendantsOnly: true,
    },
    humanSignoff: "pending",
    overallInputSuccess: false,
  };
  const proofPlanBytes = jsonBytes(proofPlan);
  antecedentOutputs.set(INPUT_LIVE_V20_PLAN_PATH, proofPlanBytes);
  const requests = requestManifest(captures, {
    writerSha256: sha256(writerProgram),
    restoreBlueprintSha256: sha256(restoreBlueprint),
    extractBlueprintSha256: sha256(extractBlueprint),
    probeBlueprintSha256: sha256(probeBlueprint),
    captureBlueprintSha256: sha256(captureBlueprint),
    cleanupBuilderSha256: sha256(
      readFileSync("recipe/input-field-live-v3-cleanup.ts"),
    ),
  });
  antecedentOutputs.set(
    INPUT_LIVE_V20_REQUEST_MANIFEST_PATH,
    jsonBytes(requests),
  );

  const indexedPaths = [
    ...antecedentOutputs.keys(),
    "recipe/input-field-live-v20-broker.ts",
    "recipe/input-field-live-v20-contract.ts",
    "recipe/run-input-field-live-v20.ts",
    "recipe/build-input-field-live-proof-v20.ts",
    "recipe/input-field-live-v20-broker.test.ts",
    "recipe/figma-property-normalizer-v8.test.ts",
    "recipe/scene-readback-v20.test.ts",
    "recipe/input-field-live-v20-restore.ts",
    "recipe/input-field-live-v20-restore.test.ts",
    "recipe/input-field-live-v20-lifecycle-simulation.ts",
    ...sourceNeutralDependencies,
  ].filter((artifactPath) => artifactPath !== INPUT_LIVE_V20_INDEX_PATH);
  const indexedArtifacts = Object.fromEntries(
    indexedPaths.map((artifactPath) => {
      const value =
        antecedentOutputs.get(artifactPath) ?? readFileSync(artifactPath);
      return [artifactPath, { bytes: value.byteLength, sha256: sha256(value) }];
    }),
  );
  const hashSetSha256 = sha256(
    JSON.stringify(
      Object.entries(indexedArtifacts).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  );
  const index = {
    artifactVersion: "input-live-v20-antecedent-index-v1",
    status:
      "draft antecedent; pending separate authorization; live execution forbidden",
    artifacts: indexedArtifacts,
    hashSetSha256,
    counts: {
      sources: 2,
      variants: 256,
      expectedSceneFacts: 43_726,
      captureCells: INPUT_LIVE_V20_CAPTURE_COUNT,
      remoteRequests: requests.requestCount,
      hostPhases: 3,
    },
    generatedDeterministically: true,
    authorizationLifecycleExcluded: [...lifecycleExcludedPaths],
    authorizationCanBeAddedWithoutAntecedentRebuild: true,
    attemptsExecuted: 0,
    maximumFutureAttempts: 3,
    liveExecutionOccurred: false,
    figmaWrites: 0,
    figmaCaptures: 0,
    humanSignoff: "pending",
    overallInputSuccess: false,
  };
  antecedentOutputs.set(INPUT_LIVE_V20_INDEX_PATH, jsonBytes(index));

  const authorizationTemplate = {
    artifactVersion: "input-live-v20-authorization-template-v1",
    authorizationId: "input-live-v20",
    status: "template only; no authorization",
    authorizationIntent: false,
    antecedent: {
      commit: null,
      indexPath: INPUT_LIVE_V20_INDEX_PATH,
      indexSha256: null,
      hashSetSha256,
    },
    signingPublicKey: {
      algorithm: "Ed25519",
      encoding: "SPKI-PEM",
      publicKeyPem: null,
      spkiSha256: null,
      privateKeyStoredInRepository: false,
    },
    operatorBoundary: {
      target: INPUT_LIVE_V20_TARGET,
      expectedDynamicTool: INPUT_LIVE_V20_DYNAMIC_TOOL,
      externalOperatorOnly: true,
      oneMcpCallPerSignedRequest: true,
    },
    denominator: {
      remoteRequests: 133,
      hostPhases: 3,
      captures: 128,
      sourceRoots: 2,
      expectedFacts: 43_726,
    },
    execution: {
      maximumAttempts: 3,
      attemptsExecuted: 0,
      captureBeforeHashBoundTechnicalGates: false,
      durableCleanupRequestPersistedImmediatelyAfterWriterAcceptance: true,
      cleanupMustRemainExecutableAfterHostFailure: true,
      v7AuthorizationReusable: false,
      v8AuthorizationReusable: false,
      v9AuthorizationReusable: false,
      v10AuthorizationReusable: false,
      v11AuthorizationReusable: false,
      v12AuthorizationReusable: false,
      v13AuthorizationReusable: false,
      v14AuthorizationReusable: false,
      v15AuthorizationReusable: false,
      v16AuthorizationReusable: false,
      v17AuthorizationReusable: false,
      v18AuthorizationReusable: false,
      v19AuthorizationReusable: false,
    },
    securityPrerequisite: {
      figmaPatRevokedOrReplacedRequired: true,
      mcpRestartAfterRotationRequired: true,
      ownerOnlyEnvironmentFileMode0600Required: true,
      repositorySecretScanZeroRequired: true,
      exactScratchReadOnlyProbeRequired: true,
      tokenValuesForbidden: true,
    },
    humanSignoff: { mandatory: true, status: "pending" },
  };
  const templateBytes = jsonBytes(authorizationTemplate);

  if (check) {
    const drift = [...antecedentOutputs].flatMap(([outputPath, expected]) =>
      !existsSync(outputPath) || !readFileSync(outputPath).equals(expected)
        ? [outputPath]
        : [],
    );
    if (drift.length)
      throw new Error(
        `Input live v12 antecedent generated artifact drift:\n${drift.join("\n")}`,
      );
  } else {
    for (const [outputPath, value] of antecedentOutputs) {
      mkdirSync(path.dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, value);
    }
    mkdirSync(path.dirname(INPUT_LIVE_V20_AUTHORIZATION_TEMPLATE_PATH), {
      recursive: true,
    });
    writeFileSync(INPUT_LIVE_V20_AUTHORIZATION_TEMPLATE_PATH, templateBytes);
  }
  if (process.argv.includes("--check-authorization-template")) {
    if (
      !existsSync(INPUT_LIVE_V20_AUTHORIZATION_TEMPLATE_PATH) ||
      !readFileSync(INPUT_LIVE_V20_AUTHORIZATION_TEMPLATE_PATH).equals(
        templateBytes,
      )
    )
      throw new Error("Input live v12 authorization template drift");
  }
  if (
    requests.requestCount !== 133 ||
    proofPlan.sources.reduce(
      (sum, source) => sum + source.expectedScenePlan.facts,
      0,
    ) !== 43_726
  )
    throw new Error("Input live v12 deterministic hash/count invariant failed");
  return proofPlan;
}

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? "")}`)
  process.stdout.write(
    `${JSON.stringify(await buildInputLiveV20Proof(), null, 2)}\n`,
  );
