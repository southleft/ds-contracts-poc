import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import {
  buildInputLiveV6CaptureProgram,
  buildInputLiveV6ExtractProgram,
  buildInputLiveV6ProbeProgram,
  INPUT_LIVE_V6_CAPTURE_COUNT,
  INPUT_LIVE_V6_RESPONSE_CONTRACTS,
  inputLiveV6CaptureManifestSha256,
  type InputLiveV6CaptureCell,
  type InputLiveV6SourceIdentity,
  type InputLiveV6WriterOwnership,
} from "./input-field-live-v6-contract.js";
import {
  INPUT_LIVE_V6_DYNAMIC_TOOL,
  INPUT_LIVE_V6_TARGET,
  inputLiveV6RequestSequence,
  inputLiveV6Sha256,
} from "./input-field-live-v6-broker.js";

export const INPUT_LIVE_V6_EVIDENCE_ROOT =
  "recipe/evidence/input-field-live-pivot-v6";
export const INPUT_LIVE_V6_PROTOCOL_PATH = `${INPUT_LIVE_V6_EVIDENCE_ROOT}/protocol.json`;
export const INPUT_LIVE_V6_PLAN_PATH = `${INPUT_LIVE_V6_EVIDENCE_ROOT}/proof-plan.json`;
export const INPUT_LIVE_V6_CAPTURE_MANIFEST_PATH = `${INPUT_LIVE_V6_EVIDENCE_ROOT}/capture-manifest.json`;
export const INPUT_LIVE_V6_REQUEST_MANIFEST_PATH = `${INPUT_LIVE_V6_EVIDENCE_ROOT}/request-manifest.json`;
export const INPUT_LIVE_V6_INDEX_PATH = `${INPUT_LIVE_V6_EVIDENCE_ROOT}/index.json`;
export const INPUT_LIVE_V6_AUTHORIZATION_TEMPLATE_PATH = `${INPUT_LIVE_V6_EVIDENCE_ROOT}/authorization-template.json`;
export const INPUT_LIVE_V6_AUTHORIZATION_PATH = `${INPUT_LIVE_V6_EVIDENCE_ROOT}/capture-authorization.json`;
export const INPUT_LIVE_V6_SECURITY_ATTESTATION_TEMPLATE_PATH = `${INPUT_LIVE_V6_EVIDENCE_ROOT}/operator-security-attestation-template.json`;
export const INPUT_LIVE_V5_SUPERSEDING_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v5-superseding-status.json";

const V5_ROOT = "recipe/evidence/input-field-live-pivot-v5";
const V3_PLAN = "recipe/evidence/input-field-live-pivot-v3/writer-plan.json";
const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");
const json = <T>(file: string): T =>
  JSON.parse(readFileSync(file, "utf8")) as T;
const jsonBytes = (value: unknown): Buffer =>
  Buffer.from(`${JSON.stringify(value, null, 2)}\n`);

export interface InputLiveV6ProofPlan {
  artifactVersion: "input-live-v6-proof-plan-v1";
  status: "draft uncommitted; pending separate authorization; capture forbidden";
  target: typeof INPUT_LIVE_V6_TARGET;
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
  outcomes: null;
  humanSignoff: "pending";
  overallInputSuccess: false;
}

const captureCells = (): InputLiveV6CaptureCell[] => {
  const objective = json<Record<string, any>>(V3_PLAN).objective.cells as Array<
    Record<string, any>
  >;
  const cells = objective.map((entry, index) => ({
    index,
    cellKey: entry.cell.key,
    source: entry.cell.library,
    adapterIdentity: entry.adapterIdentity,
    axes: {
      size: entry.cell.size,
      state: entry.cell.state,
      content: entry.cell.content,
      required: entry.cell.required,
      adornments: entry.cell.adornments,
    },
    strata: {
      source: entry.cell.library,
      state: entry.cell.state,
      adornment: entry.cell.adornments,
    },
    reference: {
      path: entry.reference.path,
      sha256: entry.reference.sha256,
      width: entry.reference.width,
      height: entry.reference.height,
      contentBox: entry.reference.contentBox,
    },
    legacy: entry.legacy,
  })) as InputLiveV6CaptureCell[];
  inputLiveV6CaptureManifestSha256(cells);
  return cells;
};

interface GeneratedV6Source {
  source: "mui" | "polaris";
  adapterIdentity: string;
  recipeHash: string;
  envelopeHash: string;
  expectedScenePlan: InputLiveV6SourceIdentity["expectedScenePlan"];
  outputPath: string;
  compressed: Buffer;
  metadata: {
    path: string;
    bytes: number;
    sha256: string;
    uncompressedBytes: number;
    uncompressedSha256: string;
    facts: number;
    generatedDescendants: number;
  };
}

const sourcePlans = (): GeneratedV6Source[] => {
  const v5 = json<Record<string, any>>(`${V5_ROOT}/writer-plan.json`);
  return v5.sources.map((source: Record<string, any>) => {
    const sourceId = source.library as "mui" | "polaris";
    const inputPath = source.expectedScenePlanArtifact.path;
    const bytes = readFileSync(inputPath);
    const uncompressed = gunzipSync(bytes);
    if (
      sha256(bytes) !== source.expectedScenePlanArtifact.sha256 ||
      sha256(uncompressed) !==
        source.expectedScenePlanArtifact.uncompressedSha256
    )
      throw new Error(`Input live v6 source plan drift: ${inputPath}`);
    return {
      source: sourceId,
      adapterIdentity: source.adapterIdentity,
      recipeHash: source.recipeHash,
      envelopeHash: source.envelopeHash,
      expectedScenePlan: JSON.parse(uncompressed.toString("utf8")),
      outputPath: `${INPUT_LIVE_V6_EVIDENCE_ROOT}/expected-scene-plan-${sourceId}.json.gz`,
      compressed: bytes,
      metadata: {
        path: `${INPUT_LIVE_V6_EVIDENCE_ROOT}/expected-scene-plan-${sourceId}.json.gz`,
        bytes: bytes.byteLength,
        sha256: sha256(bytes),
        uncompressedBytes: uncompressed.byteLength,
        uncompressedSha256: sha256(uncompressed),
        facts: source.expectedScenePlanArtifact.facts,
        generatedDescendants:
          source.expectedScenePlanArtifact.generatedDescendants,
      },
    };
  });
};

const requestManifest = (
  captures: readonly InputLiveV6CaptureCell[],
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
      sequence: inputLiveV6RequestSequence("writer"),
      phase: "writer",
      predecessorRequestId: null,
      programSha256: programs.writerSha256,
      response: INPUT_LIVE_V6_RESPONSE_CONTRACTS.writer,
    },
    {
      requestId: "cleanup",
      sequence: inputLiveV6RequestSequence("cleanup"),
      phase: "cleanup",
      predecessorRequestId: "writer",
      programBuilderSha256: programs.cleanupBuilderSha256,
      response: INPUT_LIVE_V6_RESPONSE_CONTRACTS.cleanup,
      availability: "persisted immediately after writer acceptance",
    },
    {
      requestId: "extract",
      sequence: inputLiveV6RequestSequence("extract"),
      phase: "extract",
      predecessorRequestId: "writer",
      programSha256: programs.extractBlueprintSha256,
      response: INPUT_LIVE_V6_RESPONSE_CONTRACTS.extract,
    },
    {
      requestId: "probe",
      sequence: inputLiveV6RequestSequence("probe"),
      phase: "probe",
      predecessorRequestId: "extract",
      programSha256: programs.probeBlueprintSha256,
      response: INPUT_LIVE_V6_RESPONSE_CONTRACTS.probe,
    },
    ...captures.map((cell) => ({
      requestId: `capture-${String(cell.index).padStart(3, "0")}`,
      sequence: inputLiveV6RequestSequence("capture", cell.index),
      phase: "capture",
      captureIndex: cell.index,
      cellKey: cell.cellKey,
      predecessorRequestId:
        cell.index === 0
          ? "probe"
          : `capture-${String(cell.index - 1).padStart(3, "0")}`,
      programBuilderSha256: programs.captureBlueprintSha256,
      response: INPUT_LIVE_V6_RESPONSE_CONTRACTS.capture,
    })),
  ];
  return {
    artifactVersion: "input-live-v6-request-manifest-v1",
    expectedDynamicTool: INPUT_LIVE_V6_DYNAMIC_TOOL,
    target: INPUT_LIVE_V6_TARGET,
    signedAtRuntime: true,
    runtimePins: [
      "transactionId",
      "attempt",
      "sequence",
      "predecessorRequestSha256",
      "previousAcceptedReceiptSha256",
      "expectedDynamicTool",
      "target",
      "programBytes",
      "programSha256",
      "arguments",
      "argumentsSha256",
      "expectedResponse",
      "protocolCommit",
      "runnerCommit",
      "codeCommit",
      "authorizationCommit",
      "authorizationSha256",
      "proofPlanSha256",
      "captureManifestSha256",
      "cleanup availability",
    ],
    requestCount: requests.length,
    requests,
    outcomes: null,
  };
};

export async function buildInputLiveV6Proof(
  check = process.argv.includes("--check"),
): Promise<InputLiveV6ProofPlan> {
  const captures = captureCells();
  const sources = sourcePlans();
  const v5Plan = json<Record<string, any>>(`${V5_ROOT}/writer-plan.json`);
  const writerProgram = readFileSync(`${V5_ROOT}/writer-wrapper.txt`);
  const writerPayload = readFileSync(`${V5_ROOT}/writer.js`);
  if (
    sha256(writerProgram) !== v5Plan.transport.wrapperSha256 ||
    sha256(writerPayload) !== v5Plan.writer.sha256
  )
    throw new Error("Input live v6 exact committed writer bytes drifted");
  const writerOwnershipBlueprint: InputLiveV6WriterOwnership = {
    pageId: "__WRITER_PAGE_ID__",
    pageName: v5Plan.pageName,
    runIdentity: v5Plan.runIdentity,
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
  const sourceIdentities = sources.map(
    (source) =>
      ({
        source: source.source,
        adapterIdentity: source.adapterIdentity,
        recipeHash: source.recipeHash,
        envelopeHash: source.envelopeHash,
        expectedScenePlan: source.expectedScenePlan,
      }) satisfies InputLiveV6SourceIdentity,
  );
  const extractBlueprint = Buffer.from(
    buildInputLiveV6ExtractProgram(writerOwnershipBlueprint, sourceIdentities),
  );
  const probeBlueprint = Buffer.from(
    buildInputLiveV6ProbeProgram(writerOwnershipBlueprint, sourceIdentities),
  );
  const captureBlueprint = Buffer.from(
    buildInputLiveV6CaptureProgram(writerOwnershipBlueprint, captures[0]!),
  );
  const outputs = new Map<string, Buffer>();
  outputs.set(
    `${INPUT_LIVE_V6_EVIDENCE_ROOT}/programs/writer.txt`,
    writerProgram,
  );
  outputs.set(
    `${INPUT_LIVE_V6_EVIDENCE_ROOT}/programs/writer-payload.js`,
    writerPayload,
  );
  outputs.set(
    `${INPUT_LIVE_V6_EVIDENCE_ROOT}/programs/extract-blueprint.js`,
    extractBlueprint,
  );
  outputs.set(
    `${INPUT_LIVE_V6_EVIDENCE_ROOT}/programs/probe-blueprint.js`,
    probeBlueprint,
  );
  outputs.set(
    `${INPUT_LIVE_V6_EVIDENCE_ROOT}/programs/capture-blueprint.js`,
    captureBlueprint,
  );
  for (const source of sources)
    outputs.set(source.outputPath, source.compressed);
  const captureManifest = {
    artifactVersion: "input-live-v6-capture-manifest-v1",
    status: "planned only; capture forbidden",
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
    cellsSha256: inputLiveV6CaptureManifestSha256(captures),
    outcomes: null,
  };
  const captureManifestBytes = jsonBytes(captureManifest);
  outputs.set(INPUT_LIVE_V6_CAPTURE_MANIFEST_PATH, captureManifestBytes);
  const proofPlan: InputLiveV6ProofPlan = {
    artifactVersion: "input-live-v6-proof-plan-v1",
    status:
      "draft uncommitted; pending separate authorization; capture forbidden",
    target: INPUT_LIVE_V6_TARGET,
    namespace: "ds.contracts.input.recipe.v5",
    writer: {
      programPath: `${INPUT_LIVE_V6_EVIDENCE_ROOT}/programs/writer.txt`,
      programBytes: writerProgram.byteLength,
      programSha256: sha256(writerProgram),
      payloadPath: `${INPUT_LIVE_V6_EVIDENCE_ROOT}/programs/writer-payload.js`,
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
      path: INPUT_LIVE_V6_CAPTURE_MANIFEST_PATH,
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
    outcomes: null,
    humanSignoff: "pending",
    overallInputSuccess: false,
  };
  const proofPlanBytes = jsonBytes(proofPlan);
  outputs.set(INPUT_LIVE_V6_PLAN_PATH, proofPlanBytes);
  const requests = requestManifest(captures, {
    writerSha256: sha256(writerProgram),
    extractBlueprintSha256: sha256(extractBlueprint),
    probeBlueprintSha256: sha256(probeBlueprint),
    captureBlueprintSha256: sha256(captureBlueprint),
    cleanupBuilderSha256: sha256(
      readFileSync("recipe/input-field-live-v3-cleanup.ts"),
    ),
  });
  outputs.set(INPUT_LIVE_V6_REQUEST_MANIFEST_PATH, jsonBytes(requests));
  outputs.set(
    INPUT_LIVE_V6_AUTHORIZATION_TEMPLATE_PATH,
    jsonBytes({
      artifactVersion: "input-live-v6-authorization-draft-v1",
      status:
        "draft uncommitted; pending separate authorization; live execution and capture forbidden",
      authorized: false,
      target: INPUT_LIVE_V6_TARGET,
      antecedentCommit: null,
      protocolCommit: null,
      runnerCommit: null,
      authorizationCommit: null,
      codeCommit: null,
      upstreamCommit: null,
      maximumAttempts: 3,
      exactProofPlanSha256: sha256(proofPlanBytes),
      exactCaptureManifestSha256: sha256(captureManifestBytes),
      humanSignoff: {
        mandatory: true,
        status: "pending",
        attributableReviewerRequired: true,
      },
      outcomes: null,
    }),
  );
  outputs.set(
    INPUT_LIVE_V5_SUPERSEDING_STATUS_PATH,
    jsonBytes({
      artifactVersion: "input-live-v5-superseding-status-v1",
      status:
        "semantically retired; authorization bytes preserved; no v5 attempt authorized",
      protocol: {
        path: `${V5_ROOT}/protocol.json`,
        sha256: sha256(readFileSync(`${V5_ROOT}/protocol.json`)),
        bytesChanged: false,
      },
      authorization: {
        path: `${V5_ROOT}/capture-authorization.json`,
        sha256: sha256(readFileSync(`${V5_ROOT}/capture-authorization.json`)),
        present: true,
        bytesChanged: false,
        authorizesAttemptNow: false,
      },
      blockers: [
        {
          id: "one-scene-denominator",
          detail:
            "one raw scene cannot verify the two independently generated MUI and Polaris roots",
        },
        {
          id: "self-comparison-fixed-point",
          detail:
            "normalizing and hashing one observed object against itself does not compare either pinned expected-scene plan",
        },
        {
          id: "absent-objective-manifest",
          detail:
            "v5 has no exact 128-cell objective/reference capture manifest",
        },
        {
          id: "in-process-cleanup-only",
          detail:
            "cleanup exists only inside one process and is unavailable from a persisted signed request after host crash",
        },
      ],
      attemptsExecuted: 0,
      nextAttempt: null,
      outcomes: null,
      supersededBy: "input-live-v6",
    }),
  );
  const protocolBytes = readFileSync(INPUT_LIVE_V6_PROTOCOL_PATH);
  const indexArtifacts = [
    INPUT_LIVE_V6_PROTOCOL_PATH,
    ...outputs.keys(),
    INPUT_LIVE_V6_AUTHORIZATION_PATH,
    INPUT_LIVE_V6_SECURITY_ATTESTATION_TEMPLATE_PATH,
    "recipe/input-field-live-v6-broker.ts",
    "recipe/input-field-live-v6-contract.ts",
    "recipe/run-input-field-live-v6.ts",
    "recipe/build-input-field-live-proof-v6.ts",
    "recipe/input-field-live-v6-broker.test.ts",
    "recipe/input-field-live-v6-authorization.ts",
    "recipe/input-field-live-v6-preflight.ts",
    "recipe/input-field-live-v6-authorization.test.ts",
  ];
  const index = {
    artifactVersion: "input-live-v6-evidence-index-v1",
    status:
      "authorization-prepared-uncommitted; security-blocked; live execution forbidden; no live outcomes",
    artifacts: Object.fromEntries(
      indexArtifacts.map((artifactPath) => {
        const value =
          artifactPath === INPUT_LIVE_V6_PROTOCOL_PATH
            ? protocolBytes
            : (outputs.get(artifactPath) ?? readFileSync(artifactPath));
        return [
          artifactPath,
          { bytes: value.byteLength, sha256: sha256(value) },
        ];
      }),
    ),
    counts: {
      sources: 2,
      variants: 256,
      expectedSceneFacts: sources.reduce(
        (sum, source) => sum + source.metadata.facts,
        0,
      ),
      captureCells: INPUT_LIVE_V6_CAPTURE_COUNT,
      remoteRequests: 132,
      hostPhases: 3,
    },
    generatedDeterministically: true,
    authorizationPresent: true,
    authorizationCommitted: false,
    authorizationEffective: false,
    authorizationPath: INPUT_LIVE_V6_AUTHORIZATION_PATH,
    authorizationSha256: sha256(readFileSync(INPUT_LIVE_V6_AUTHORIZATION_PATH)),
    security: {
      status: "blocked-pending-Figma-PAT-rotation-and-MCP-restart",
      rotationCompleted: false,
      mcpRestartCompleted: false,
      liveExecutionForbidden: true,
      attestationTemplatePath: INPUT_LIVE_V6_SECURITY_ATTESTATION_TEMPLATE_PATH,
      runtimeAttestationPath: "private/input-live-v6-security-attestation.json",
      currentRepositorySecretScanMatches: 0,
      tokenValuesStored: false,
    },
    attemptsExecuted: 0,
    liveExecutionOccurred: false,
    figmaWrites: 0,
    figmaCaptures: 0,
    outcomes: null,
    humanSignoff: "pending",
    overallInputSuccess: false,
  };
  outputs.set(INPUT_LIVE_V6_INDEX_PATH, jsonBytes(index));

  if (check) {
    const drift = [...outputs].flatMap(([outputPath, expected]) =>
      !existsSync(outputPath) || !readFileSync(outputPath).equals(expected)
        ? [outputPath]
        : [],
    );
    if (drift.length)
      throw new Error(
        `Input live v6 generated artifact drift:\n${drift.join("\n")}`,
      );
  } else {
    for (const [outputPath, value] of outputs) {
      mkdirSync(path.dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, value);
    }
  }
  if (
    inputLiveV6Sha256(proofPlanBytes) !== sha256(proofPlanBytes) ||
    requests.requestCount !== 132
  )
    throw new Error("Input live v6 deterministic hash/count invariant failed");
  return proofPlan;
}

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? "")}`)
  process.stdout.write(
    `${JSON.stringify(await buildInputLiveV6Proof(), null, 2)}\n`,
  );
