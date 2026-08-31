import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import {
  buildInputLiveV10CaptureProgram,
  buildInputLiveV10ExtractProgram,
  buildInputLiveV10ProbeProgram,
  INPUT_LIVE_V10_CAPTURE_COUNT,
  INPUT_LIVE_V10_RESPONSE_CONTRACTS,
  inputLiveV10CaptureManifestSha256,
  type InputLiveV10CaptureCell,
  type InputLiveV10SourceIdentity,
  type InputLiveV10WriterOwnership,
} from "./input-field-live-v10-contract.js";
import {
  INPUT_LIVE_V10_DYNAMIC_TOOL,
  INPUT_LIVE_V10_TARGET,
  inputLiveV10RequestSequence,
} from "./input-field-live-v10-broker.js";

export const INPUT_LIVE_V10_EVIDENCE_ROOT =
  "recipe/evidence/input-field-live-pivot-v10";
export const INPUT_LIVE_V10_PROTOCOL_PATH = `${INPUT_LIVE_V10_EVIDENCE_ROOT}/protocol.json`;
export const INPUT_LIVE_V10_PLAN_PATH = `${INPUT_LIVE_V10_EVIDENCE_ROOT}/proof-plan.json`;
export const INPUT_LIVE_V10_CAPTURE_MANIFEST_PATH = `${INPUT_LIVE_V10_EVIDENCE_ROOT}/capture-manifest.json`;
export const INPUT_LIVE_V10_REQUEST_MANIFEST_PATH = `${INPUT_LIVE_V10_EVIDENCE_ROOT}/request-manifest.json`;
export const INPUT_LIVE_V10_INDEX_PATH = `${INPUT_LIVE_V10_EVIDENCE_ROOT}/antecedent-index.json`;
export const INPUT_LIVE_V10_AUTHORIZATION_TEMPLATE_PATH = `${INPUT_LIVE_V10_EVIDENCE_ROOT}/authorization-template.json`;
export const INPUT_LIVE_V10_AUTHORIZATION_PATH = `${INPUT_LIVE_V10_EVIDENCE_ROOT}/capture-authorization.json`;

const V9_PROOF_ROOT = "recipe/evidence/input-field-live-pivot-v9";
const V8_PLAN = `${V9_PROOF_ROOT}/proof-plan.json`;
const V8_CAPTURE_MANIFEST = `${V9_PROOF_ROOT}/capture-manifest.json`;
const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");
const json = <T>(file: string): T =>
  JSON.parse(readFileSync(file, "utf8")) as T;
const jsonBytes = (value: unknown): Buffer =>
  Buffer.from(`${JSON.stringify(value, null, 2)}\n`);

export interface InputLiveV10ProofPlan {
  artifactVersion: "input-live-v10-proof-plan-v1";
  status: "draft antecedent; pending separate authorization; live execution forbidden";
  target: typeof INPUT_LIVE_V10_TARGET;
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
    remote: 132;
    mainLane: 131;
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
  expectedScenePlan: InputLiveV10SourceIdentity["expectedScenePlan"];
  outputPath: string;
  compressed: Buffer;
  metadata: InputLiveV10ProofPlan["sources"][number]["expectedScenePlan"];
}

const sourcePlans = (): GeneratedSource[] => {
  const prior = json<Record<string, any>>(V8_PLAN);
  return prior.sources.map((source: Record<string, any>) => {
    const sourceId = source.source as "mui" | "polaris";
    const inputPath = source.expectedScenePlan.path as string;
    const compressed = readFileSync(inputPath);
    const uncompressed = gunzipSync(compressed);
    if (
      sha256(compressed) !== source.expectedScenePlan.sha256 ||
      sha256(uncompressed) !== source.expectedScenePlan.uncompressedSha256
    )
      throw new Error(`Input live v10 source plan drift: ${inputPath}`);
    return {
      source: sourceId,
      adapterIdentity: source.adapterIdentity,
      recipeHash: source.recipeHash,
      envelopeHash: source.envelopeHash,
      expectedScenePlan: JSON.parse(uncompressed.toString("utf8")),
      outputPath: `${INPUT_LIVE_V10_EVIDENCE_ROOT}/expected-scene-plan-${sourceId}.json.gz`,
      compressed,
      metadata: {
        path: `${INPUT_LIVE_V10_EVIDENCE_ROOT}/expected-scene-plan-${sourceId}.json.gz`,
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

const captureCells = (): InputLiveV10CaptureCell[] => {
  const cells = json<Record<string, any>>(V8_CAPTURE_MANIFEST)
    .cells as InputLiveV10CaptureCell[];
  inputLiveV10CaptureManifestSha256(cells);
  return cells;
};

const protocol = () => ({
  artifactVersion: "input-live-v10-external-operator-protocol-v1",
  protocolId: "input-live-v10",
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
    v8AntecedentBytesUnchanged: true,
    v9AntecedentBytesUnchanged: true,
    sceneReadbackCarried: true,
    carriedV3Verifier: true,
  },
  operatorBoundary: {
    expectedDynamicTool: INPUT_LIVE_V10_DYNAMIC_TOOL,
    target: INPUT_LIVE_V10_TARGET,
    externalOperatorRequired: true,
    oneCallPerSignedRequest: true,
    requestSignature: "Ed25519",
    rawResponsePersistedBeforeAcceptance: true,
  },
  execution: {
    remoteRequests: 132,
    mainLaneRequests: 131,
    recoveryCleanupRequests: 1,
    hostPhases: 3,
    requestOrder: [
      "writer",
      "persist signed cleanup recovery request",
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
    carriedSceneReadback: "recipe/scene-readback-v10.ts",
    carriedSceneReadbackRuntime: "recipe/scene-readback-runtime-v10.ts",
    carriedV3Verifier: "recipe/input-field-live-v3-verifier-v10.ts",
    liveHostDoesNotImportSceneReadbackTs: true,
    v8SceneReadbackUnchanged: true,
    v9AntecedentBytesUnchanged: true,
  },
});

const requestManifest = (
  captures: readonly InputLiveV10CaptureCell[],
  programs: {
    writerSha256: string;
    extractBlueprintSha256: string;
    probeBlueprintSha256: string;
    captureBlueprintSha256: string;
    cleanupBuilderSha256: string;
  },
) => {
  const requests = [
    {
      requestId: "writer",
      sequence: inputLiveV10RequestSequence("writer"),
      phase: "writer",
      predecessorRequestId: null,
      programSha256: programs.writerSha256,
      response: INPUT_LIVE_V10_RESPONSE_CONTRACTS.writer,
    },
    {
      requestId: "cleanup",
      sequence: inputLiveV10RequestSequence("cleanup"),
      phase: "cleanup",
      predecessorRequestId: "writer",
      programBuilderSha256: programs.cleanupBuilderSha256,
      response: INPUT_LIVE_V10_RESPONSE_CONTRACTS.cleanup,
      availability: "persisted immediately after writer acceptance",
    },
    {
      requestId: "extract",
      sequence: inputLiveV10RequestSequence("extract"),
      phase: "extract",
      predecessorRequestId: "writer",
      programSha256: programs.extractBlueprintSha256,
      response: INPUT_LIVE_V10_RESPONSE_CONTRACTS.extract,
    },
    {
      requestId: "probe",
      sequence: inputLiveV10RequestSequence("probe"),
      phase: "probe",
      predecessorRequestId: "extract",
      programSha256: programs.probeBlueprintSha256,
      response: INPUT_LIVE_V10_RESPONSE_CONTRACTS.probe,
    },
    ...captures.map((cell) => ({
      requestId: `capture-${String(cell.index).padStart(3, "0")}`,
      sequence: inputLiveV10RequestSequence("capture", cell.index),
      phase: "capture",
      captureIndex: cell.index,
      cellKey: cell.cellKey,
      predecessorRequestId:
        cell.index === 0
          ? "probe"
          : `capture-${String(cell.index - 1).padStart(3, "0")}`,
      programBuilderSha256: programs.captureBlueprintSha256,
      response: INPUT_LIVE_V10_RESPONSE_CONTRACTS.capture,
    })),
  ];
  return {
    artifactVersion: "input-live-v10-request-manifest-v1",
    expectedDynamicTool: INPUT_LIVE_V10_DYNAMIC_TOOL,
    target: INPUT_LIVE_V10_TARGET,
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
  INPUT_LIVE_V10_AUTHORIZATION_TEMPLATE_PATH,
  INPUT_LIVE_V10_AUTHORIZATION_PATH,
  "recipe/input-field-live-v10-authorization.ts",
  "recipe/input-field-live-v10-authorization.test.ts",
  "recipe/input-field-live-v10-preflight.ts",
  "recipe/input-field-live-v10-authorized.ts",
  "recipe/evidence/input-field-live-pivot-v10/operator-security-attestation-template.json",
  "recipe/evidence/input-field-live-pivot-v10-status.json",
  "recipe/evidence/status-index.json",
] as const;

const sourceNeutralDependencies = [
  "recipe/input-field-live-v3-cleanup.ts",
  "recipe/input-field-live-v3-verifier-v10.ts",
  "recipe/input-field-live-v10-verifier.ts",
  "recipe/figma-property-normalizer-v8.ts",
  "recipe/figma-runtime-portability.ts",
  "recipe/input-field-objective-comparison-v1.ts",
  "recipe/normalize.ts",
  "recipe/scene-readback-runtime-v10.ts",
  "recipe/scene-readback-v10.ts",
] as const;

export async function buildInputLiveV10Proof(
  check = process.argv.includes("--check"),
): Promise<InputLiveV10ProofPlan> {
  const captures = captureCells();
  const sources = sourcePlans();
  const priorPlan = json<Record<string, any>>(V8_PLAN);
  const writerProgram = readFileSync(priorPlan.writer.programPath);
  const writerPayload = readFileSync(priorPlan.writer.payloadPath);
  if (
    sha256(writerProgram) !== priorPlan.writer.programSha256 ||
    sha256(writerPayload) !== priorPlan.writer.payloadSha256
  )
    throw new Error("Input live v10 exact committed writer bytes drifted");

  const writerOwnershipBlueprint: InputLiveV10WriterOwnership = {
    pageId: "__WRITER_PAGE_ID__",
    pageName: "Recipe Pivot / Input Field / v9",
    runIdentity: "input-live-v10",
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
      }) satisfies InputLiveV10SourceIdentity,
  );
  const extractBlueprint = Buffer.from(
    buildInputLiveV10ExtractProgram(writerOwnershipBlueprint, identities),
  );
  const probeBlueprint = Buffer.from(
    buildInputLiveV10ProbeProgram(writerOwnershipBlueprint, identities),
  );
  const captureBlueprint = Buffer.from(
    buildInputLiveV10CaptureProgram(writerOwnershipBlueprint, captures[0]!),
  );

  const antecedentOutputs = new Map<string, Buffer>();
  antecedentOutputs.set(INPUT_LIVE_V10_PROTOCOL_PATH, jsonBytes(protocol()));
  antecedentOutputs.set(
    `${INPUT_LIVE_V10_EVIDENCE_ROOT}/programs/writer.txt`,
    writerProgram,
  );
  antecedentOutputs.set(
    `${INPUT_LIVE_V10_EVIDENCE_ROOT}/programs/writer-payload.js`,
    writerPayload,
  );
  antecedentOutputs.set(
    `${INPUT_LIVE_V10_EVIDENCE_ROOT}/programs/extract-blueprint.js`,
    extractBlueprint,
  );
  antecedentOutputs.set(
    `${INPUT_LIVE_V10_EVIDENCE_ROOT}/programs/probe-blueprint.js`,
    probeBlueprint,
  );
  antecedentOutputs.set(
    `${INPUT_LIVE_V10_EVIDENCE_ROOT}/programs/capture-blueprint.js`,
    captureBlueprint,
  );
  for (const source of sources)
    antecedentOutputs.set(source.outputPath, source.compressed);

  const captureManifest = {
    artifactVersion: "input-live-v10-capture-manifest-v1",
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
    cellsSha256: inputLiveV10CaptureManifestSha256(captures),
  };
  const captureManifestBytes = jsonBytes(captureManifest);
  antecedentOutputs.set(
    INPUT_LIVE_V10_CAPTURE_MANIFEST_PATH,
    captureManifestBytes,
  );

  const proofPlan: InputLiveV10ProofPlan = {
    artifactVersion: "input-live-v10-proof-plan-v1",
    status:
      "draft antecedent; pending separate authorization; live execution forbidden",
    target: INPUT_LIVE_V10_TARGET,
    namespace: "ds.contracts.input.recipe.v5",
    writer: {
      programPath: `${INPUT_LIVE_V10_EVIDENCE_ROOT}/programs/writer.txt`,
      programBytes: writerProgram.byteLength,
      programSha256: sha256(writerProgram),
      payloadPath: `${INPUT_LIVE_V10_EVIDENCE_ROOT}/programs/writer-payload.js`,
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
      path: INPUT_LIVE_V10_CAPTURE_MANIFEST_PATH,
      cells: 128,
      requests: 128,
      cellsPerRequest: 1,
      sha256: sha256(captureManifestBytes),
      maximumPngBytesPerResponse: 1_500_000,
      maximumRawResponseBytes: 2_100_000,
    },
    requests: {
      remote: 132,
      mainLane: 131,
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
  antecedentOutputs.set(INPUT_LIVE_V10_PLAN_PATH, proofPlanBytes);
  const requests = requestManifest(captures, {
    writerSha256: sha256(writerProgram),
    extractBlueprintSha256: sha256(extractBlueprint),
    probeBlueprintSha256: sha256(probeBlueprint),
    captureBlueprintSha256: sha256(captureBlueprint),
    cleanupBuilderSha256: sha256(
      readFileSync("recipe/input-field-live-v3-cleanup.ts"),
    ),
  });
  antecedentOutputs.set(
    INPUT_LIVE_V10_REQUEST_MANIFEST_PATH,
    jsonBytes(requests),
  );

  const indexedPaths = [
    ...antecedentOutputs.keys(),
    "recipe/input-field-live-v10-broker.ts",
    "recipe/input-field-live-v10-contract.ts",
    "recipe/run-input-field-live-v10.ts",
    "recipe/build-input-field-live-proof-v10.ts",
    "recipe/input-field-live-v10-broker.test.ts",
    "recipe/figma-property-normalizer-v8.test.ts",
    "recipe/scene-readback-v10.test.ts",
    "recipe/input-field-live-v10-lifecycle-simulation.ts",
    ...sourceNeutralDependencies,
  ].filter((artifactPath) => artifactPath !== INPUT_LIVE_V10_INDEX_PATH);
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
    artifactVersion: "input-live-v10-antecedent-index-v1",
    status:
      "draft antecedent; pending separate authorization; live execution forbidden",
    artifacts: indexedArtifacts,
    hashSetSha256,
    counts: {
      sources: 2,
      variants: 256,
      expectedSceneFacts: 43_726,
      captureCells: INPUT_LIVE_V10_CAPTURE_COUNT,
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
  antecedentOutputs.set(INPUT_LIVE_V10_INDEX_PATH, jsonBytes(index));

  const authorizationTemplate = {
    artifactVersion: "input-live-v10-authorization-template-v1",
    authorizationId: "input-live-v10",
    status: "template only; no authorization",
    authorizationIntent: false,
    antecedent: {
      commit: null,
      indexPath: INPUT_LIVE_V10_INDEX_PATH,
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
      target: INPUT_LIVE_V10_TARGET,
      expectedDynamicTool: INPUT_LIVE_V10_DYNAMIC_TOOL,
      externalOperatorOnly: true,
      oneMcpCallPerSignedRequest: true,
    },
    denominator: {
      remoteRequests: 132,
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
        `Input live v10 antecedent generated artifact drift:\n${drift.join("\n")}`,
      );
  } else {
    for (const [outputPath, value] of antecedentOutputs) {
      mkdirSync(path.dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, value);
    }
    mkdirSync(path.dirname(INPUT_LIVE_V10_AUTHORIZATION_TEMPLATE_PATH), {
      recursive: true,
    });
    writeFileSync(INPUT_LIVE_V10_AUTHORIZATION_TEMPLATE_PATH, templateBytes);
  }
  if (process.argv.includes("--check-authorization-template")) {
    if (
      !existsSync(INPUT_LIVE_V10_AUTHORIZATION_TEMPLATE_PATH) ||
      !readFileSync(INPUT_LIVE_V10_AUTHORIZATION_TEMPLATE_PATH).equals(
        templateBytes,
      )
    )
      throw new Error("Input live v10 authorization template drift");
  }
  if (
    requests.requestCount !== 132 ||
    proofPlan.sources.reduce(
      (sum, source) => sum + source.expectedScenePlan.facts,
      0,
    ) !== 43_726
  )
    throw new Error("Input live v10 deterministic hash/count invariant failed");
  return proofPlan;
}

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? "")}`)
  process.stdout.write(
    `${JSON.stringify(await buildInputLiveV10Proof(), null, 2)}\n`,
  );
