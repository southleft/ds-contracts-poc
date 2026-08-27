import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  INPUT_LIVE_V3_ANTECEDENT_COMMIT,
  INPUT_LIVE_V3_AUTHORIZATION_PATH,
  INPUT_LIVE_V3_PROTOCOL_PATH,
  INPUT_LIVE_V3_RECEIPT_PATH,
} from "./input-field-live-v3-authorization.js";
import { resolveRepositoryEvidencePath } from "./evidence-path.js";
import type {
  InputLiveV3HardGateReport,
  InputLiveV3SceneProof,
  InputLiveV3VisualRow,
} from "./input-field-live-v3-verifier.js";

export const INPUT_LIVE_V3_RECEIPT_VERSION = "input-live-v3-receipt-v1";
export const INPUT_LIVE_V3_ATTEMPT_1_CODE_COMMIT =
  "5e95105b16f3e30e0fb67a53a6eda7a86c105c61";
export const INPUT_LIVE_V3_ATTEMPT_1_WRITER_SHA256 =
  "e831b450b450a0b9fc0d086bc33a428ca473fed12616d3cf0b82ada8f4f16f24";
export const INPUT_LIVE_V3_ATTEMPT_1_WRAPPER_SHA256 =
  "8de5c99cf89b060c3b9a8c28c2345f56e2673d79e98fb55ab02d7fc24d681d6b";
export const INPUT_LIVE_V3_ATTEMPT_1_FINGERPRINT = "10ba6b57da3cfa97";
export const INPUT_LIVE_V3_INDEX_PATH =
  "recipe/evidence/input-field-live-pivot-v3/index.json";

export interface InputLiveV3Artifact {
  path: string;
  bytes: number;
  sha256: string;
}

export interface InputLiveV3AttemptEvidence {
  attempt: number;
  outcome?: "hard-failure" | "technical-complete";
  codeCommit?: string;
  writerSha256: string;
  wrapperSha256: string;
  decodedBytes: number;
  decodedSha256: string;
  evalBegan: boolean;
  evalCompleted: boolean;
  createdNodeIds: string[];
  mutatedNodeIds: string[];
  resultArtifact: InputLiveV3Artifact;
  cleanup: {
    method?: "runner" | "manual-after-runner-failure";
    requestedNodeIds: string[];
    removedNodeIds: string[];
    requestedCollectionIds: string[];
    removedCollectionIds: string[];
    remainingOwnedNodes: number;
    remainingOwnedCollections: number;
    complete: boolean;
    artifact: InputLiveV3Artifact;
  };
}

export interface InputLiveV3EvidenceInput {
  chronology: {
    codeCommit: string;
    authorizationCommit: string;
  };
  hashes: {
    protocolSha256: string;
    authorizationSha256: string;
    writerSha256: string;
    transportEnvelopeSha256: string;
    transportWrapperSha256: string;
    verifierSha256: string;
    runnerSha256: string;
  };
  target: {
    fileKey: string;
    fileName: "Scratch Project";
    pageId: string;
    pageName: string;
    retained: boolean;
    retentionReason: string;
  };
  attempts: InputLiveV3AttemptEvidence[];
  report: InputLiveV3HardGateReport;
  sceneProofs: InputLiveV3SceneProof[];
  sceneFactsArtifact: InputLiveV3Artifact;
  objectiveRows: InputLiveV3VisualRow[];
  objectiveArtifact: InputLiveV3Artifact;
  humanPacket: {
    status: "pending" | "passed" | "failed";
    reviewer?: string;
    artifact: InputLiveV3Artifact;
  };
  historicalEvidenceUnchanged: boolean;
}

export interface InputLiveV3HardFailureEvidence {
  attempt: Record<string, any>;
  cleanup: Record<string, any>;
  attemptArtifact: InputLiveV3Artifact;
  cleanupArtifact: InputLiveV3Artifact;
}

const sha256 = (value: Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

export function inputLiveV3Artifact(artifactPath: string): InputLiveV3Artifact {
  const absolute = resolveRepositoryEvidencePath(artifactPath);
  const value = readFileSync(absolute);
  return { path: artifactPath, bytes: value.byteLength, sha256: sha256(value) };
}

const artifactFailures = (
  artifact: InputLiveV3Artifact | undefined,
  label: string,
): string[] => {
  if (!artifact) return [`${label}: missing artifact`];
  let absolute: string;
  try {
    absolute = resolveRepositoryEvidencePath(artifact.path);
  } catch {
    return [`${label}: unsafe artifact path`];
  }
  if (!existsSync(absolute)) return [`${label}: missing artifact bytes`];
  const value = readFileSync(absolute);
  return [
    ...(value.byteLength === artifact.bytes ? [] : [`${label}: byte mismatch`]),
    ...(sha256(value) === artifact.sha256 ? [] : [`${label}: hash mismatch`]),
  ];
};

export function validateInputLiveV3Attempt1HardFailure(
  attempt: Record<string, any>,
  cleanup: Record<string, any>,
): string[] {
  const failures: string[] = [];
  const runnerCleanup = {
    requestedNodeIds: [],
    removedNodeIds: [],
    requestedCollectionIds: [],
    removedCollectionIds: [],
    remainingOwnedNodes: -1,
    remainingOwnedCollections: -1,
    complete: false,
  };
  if (
    attempt.artifactVersion !== "input-live-v3-attempt-v1" ||
    attempt.attempt !== 1 ||
    attempt.outcome !== "hard-failure" ||
    attempt.secondAttemptExecuted !== false
  )
    failures.push("attempt 1 hard-failure identity");
  if (
    attempt.chronology?.codeCommit !== INPUT_LIVE_V3_ATTEMPT_1_CODE_COMMIT ||
    attempt.chronology?.authorizationCommit !==
      "ad7e02d3bfaf79f757ff63085c0a24a64a5c4c7b" ||
    attempt.chronology?.antecedentCommit !== INPUT_LIVE_V3_ANTECEDENT_COMMIT
  )
    failures.push("attempt 1 exact chronology");
  if (
    attempt.transport?.protocol !==
      "ds-contracts/figma-writer-utf8-base64/v1" ||
    attempt.transport?.payloadBytes !== 2_440_411 ||
    attempt.transport?.decodedBytes !== 2_440_411 ||
    attempt.transport?.expectedSha256 !==
      INPUT_LIVE_V3_ATTEMPT_1_WRITER_SHA256 ||
    attempt.transport?.decodedSha256 !==
      INPUT_LIVE_V3_ATTEMPT_1_WRITER_SHA256 ||
    attempt.transport?.evalBegan !== true ||
    attempt.transport?.evalCompleted !== true
  )
    failures.push("attempt 1 exact committed writer execution");
  if (
    attempt.writerResult?.pageId !== "86:34550" ||
    attempt.writerResult?.sources?.length !== 2 ||
    attempt.writerResult?.sources?.some(
      (source: Record<string, any>) =>
        source.variantCount !== 128 || source.cellCount !== 128,
    ) ||
    attempt.writerResult?.createdNodeIds?.length !== 2_317
  )
    failures.push("attempt 1 exact minted denominator");
  if (
    attempt.error !== "TypeError: TextDecoder is not a constructor" ||
    attempt.verification?.status !== "hard-failure" ||
    attempt.verification?.completed !== false ||
    attempt.verification?.failureStage !==
      "scene-variable-identity-decode-before-extraction" ||
    attempt.verification?.sourceLocation !==
      "recipe/scene-readback-runtime.ts:35" ||
    attempt.verification?.expectedSceneFacts !== 43_726 ||
    attempt.verification?.measuredSceneFacts !== 0 ||
    attempt.verification?.measuredObjectiveRows !== 0 ||
    attempt.verification?.capturedCells !== 0 ||
    attempt.verification?.fixedPointCyclesMeasured !== 0
  )
    failures.push("attempt 1 verifier hard failure/zero measurements");
  if (
    attempt.artifacts?.successReceipt !== null ||
    attempt.artifacts?.sceneDerivedFacts !== null ||
    attempt.artifacts?.objectiveResult !== null ||
    attempt.artifacts?.humanReviewPacket !== null ||
    !Array.isArray(attempt.artifacts?.captures) ||
    attempt.artifacts.captures.length !== 0
  )
    failures.push("attempt 1 absent success/result artifacts");
  if (JSON.stringify(attempt.runnerCleanup) !== JSON.stringify(runnerCleanup))
    failures.push("attempt 1 runner cleanup record");
  if (
    cleanup.artifactVersion !== "input-live-v3-cleanup-v1" ||
    cleanup.attempt !== 1 ||
    cleanup.runIdentity !== "4a074b24-e8503dd5-input-v2" ||
    JSON.stringify(cleanup.runnerCleanup) !== JSON.stringify(runnerCleanup)
  )
    failures.push("attempt 1 separate runner cleanup");
  const manual = cleanup.manualCleanup;
  if (
    manual?.ownershipVerified !== true ||
    JSON.stringify(manual?.requestedNodeIds) !== JSON.stringify(["86:34550"]) ||
    JSON.stringify(manual?.removedNodeIds) !== JSON.stringify(["86:34550"]) ||
    JSON.stringify(manual?.requestedCollectionIds) !==
      JSON.stringify([
        "VariableCollectionId:86:34552",
        "VariableCollectionId:86:35979",
      ]) ||
    JSON.stringify(manual?.removedCollectionIds) !==
      JSON.stringify([
        "VariableCollectionId:86:34552",
        "VariableCollectionId:86:35979",
      ]) ||
    manual?.remainingOwnedNodes !== 0 ||
    manual?.remainingOwnedCollections !== 0 ||
    manual?.complete !== true
  )
    failures.push("attempt 1 manual owned cleanup");
  const fingerprint = manual?.unrelatedScratchFingerprint;
  if (
    fingerprint?.algorithm !== "cyrb64" ||
    fingerprint?.before !== INPUT_LIVE_V3_ATTEMPT_1_FINGERPRINT ||
    fingerprint?.after !== INPUT_LIVE_V3_ATTEMPT_1_FINGERPRINT ||
    fingerprint?.exact !== true ||
    fingerprint?.pageCount !== 13 ||
    fingerprint?.collectionCount !== 14 ||
    fingerprint?.variableCount !== 11_163 ||
    fingerprint?.censusPagesUnchanged !== true ||
    fingerprint?.retainedButtonProofUnchanged !== true
  )
    failures.push("attempt 1 manual cleanup fingerprint");
  return failures;
}

export function readInputLiveV3Attempt1HardFailure(): InputLiveV3HardFailureEvidence {
  const index = JSON.parse(
    readFileSync(
      resolveRepositoryEvidencePath(INPUT_LIVE_V3_INDEX_PATH),
      "utf8",
    ),
  ) as Record<string, any>;
  const history = index.attemptHistory;
  if (!Array.isArray(history) || history.length !== 1)
    throw new Error(
      "Input live v3 attempt history must contain attempt 1 only",
    );
  const entry = history[0];
  const attemptArtifact = entry?.artifacts?.attempt as
    InputLiveV3Artifact | undefined;
  const cleanupArtifact = entry?.artifacts?.cleanup as
    InputLiveV3Artifact | undefined;
  const artifactValidation = [
    ...artifactFailures(attemptArtifact, "attempt 1 result"),
    ...artifactFailures(cleanupArtifact, "attempt 1 cleanup"),
  ];
  if (!attemptArtifact || !cleanupArtifact || artifactValidation.length > 0)
    throw new Error(
      `Input live v3 attempt 1 artifact invalid:\n${artifactValidation.join("\n")}`,
    );
  const attempt = JSON.parse(
    readFileSync(resolveRepositoryEvidencePath(attemptArtifact.path), "utf8"),
  ) as Record<string, any>;
  const cleanup = JSON.parse(
    readFileSync(resolveRepositoryEvidencePath(cleanupArtifact.path), "utf8"),
  ) as Record<string, any>;
  const failures = validateInputLiveV3Attempt1HardFailure(attempt, cleanup);
  if (failures.length > 0)
    throw new Error(
      `Input live v3 attempt 1 hard-failure evidence invalid:\n${failures.join("\n")}`,
    );
  if (existsSync(resolveRepositoryEvidencePath(INPUT_LIVE_V3_RECEIPT_PATH)))
    throw new Error("Input live v3 attempt 1 must not have a success receipt");
  return { attempt, cleanup, attemptArtifact, cleanupArtifact };
}

export function buildInputLiveV3Attempt1ReceiptEvidence(): InputLiveV3AttemptEvidence {
  const evidence = readInputLiveV3Attempt1HardFailure();
  const manual = evidence.cleanup.manualCleanup;
  return {
    attempt: 1,
    outcome: "hard-failure",
    codeCommit: INPUT_LIVE_V3_ATTEMPT_1_CODE_COMMIT,
    writerSha256: INPUT_LIVE_V3_ATTEMPT_1_WRITER_SHA256,
    wrapperSha256: INPUT_LIVE_V3_ATTEMPT_1_WRAPPER_SHA256,
    decodedBytes: evidence.attempt.transport.decodedBytes,
    decodedSha256: evidence.attempt.transport.decodedSha256,
    evalBegan: evidence.attempt.transport.evalBegan,
    evalCompleted: evidence.attempt.transport.evalCompleted,
    createdNodeIds: evidence.attempt.writerResult.createdNodeIds,
    mutatedNodeIds: evidence.attempt.writerResult.mutatedNodeIds,
    resultArtifact: evidence.attemptArtifact,
    cleanup: {
      method: "manual-after-runner-failure",
      requestedNodeIds: manual.requestedNodeIds,
      removedNodeIds: manual.removedNodeIds,
      requestedCollectionIds: manual.requestedCollectionIds,
      removedCollectionIds: manual.removedCollectionIds,
      remainingOwnedNodes: manual.remainingOwnedNodes,
      remainingOwnedCollections: manual.remainingOwnedCollections,
      complete: manual.complete,
      artifact: evidence.cleanupArtifact,
    },
  };
}

export function validateInputLiveV3Evidence(
  input: InputLiveV3EvidenceInput,
): string[] {
  const failures: string[] = [];
  if (
    input.chronology.authorizationCommit.length !== 40 ||
    input.chronology.codeCommit.length !== 40
  )
    failures.push("chronology commits");
  for (const [name, value] of Object.entries(input.hashes))
    if (!/^[a-f0-9]{64}$/.test(value)) failures.push(`${name}: hash`);
  if (
    input.target.fileKey !== "byMp6lt0Ij9b2QbkDGFwBh" ||
    input.target.fileName !== "Scratch Project" ||
    !input.target.pageId ||
    !input.target.pageName ||
    !input.target.retentionReason
  )
    failures.push("target/file/page/retention");
  if (
    input.attempts.length === 0 ||
    input.attempts.length > 3 ||
    new Set(input.attempts.map((attempt) => attempt.attempt)).size !==
      input.attempts.length ||
    input.attempts.some((attempt, index) => attempt.attempt !== index + 1)
  )
    failures.push("attempt history");
  for (const attempt of input.attempts) {
    if (
      attempt.decodedBytes <= 0 ||
      attempt.decodedSha256 !== attempt.writerSha256 ||
      !attempt.evalBegan ||
      !attempt.evalCompleted ||
      attempt.createdNodeIds.length === 0
    )
      failures.push(`attempt ${attempt.attempt}: exact execution/IDs`);
    if (
      attempt.cleanup.requestedNodeIds.length !==
        attempt.cleanup.removedNodeIds.length ||
      attempt.cleanup.requestedCollectionIds.length !==
        attempt.cleanup.removedCollectionIds.length ||
      attempt.cleanup.remainingOwnedNodes !== 0 ||
      attempt.cleanup.remainingOwnedCollections !== 0 ||
      !attempt.cleanup.complete
    )
      failures.push(`attempt ${attempt.attempt}: partial cleanup`);
    failures.push(
      ...artifactFailures(
        attempt.resultArtifact,
        `attempt ${attempt.attempt} result`,
      ),
      ...artifactFailures(
        attempt.cleanup.artifact,
        `attempt ${attempt.attempt} cleanup`,
      ),
    );
  }
  if (
    input.report.counts.sources !== 2 ||
    input.report.counts.variants !== 256 ||
    input.report.counts.switchedVariants !== 256 ||
    input.report.counts.cells !== 256 ||
    input.report.counts.objectiveCells !== 128 ||
    input.report.counts.sceneFacts <= 0 ||
    input.report.counts.matchedSceneFacts <= 0 ||
    input.report.counts.silentSceneFacts !== 0
  )
    failures.push("hard counts");
  if (
    input.sceneProofs.length !== 2 ||
    input.sceneProofs.some(
      (proof) =>
        !proof.accounting.ok ||
        proof.accounting.denominator <= 0 ||
        proof.accounting.silent !== 0 ||
        !proof.fixedPoint.stable ||
        proof.fixedPoint.sourceIrRead !== false,
    )
  )
    failures.push("scene-derived facts/fixed point");
  if (
    input.objectiveRows.length !== 128 ||
    new Set(input.objectiveRows.map((row) => row.cellKey)).size !== 128
  )
    failures.push("objective rows");
  failures.push(
    ...artifactFailures(input.sceneFactsArtifact, "scene facts"),
    ...artifactFailures(input.objectiveArtifact, "objective"),
    ...artifactFailures(input.humanPacket.artifact, "human packet"),
  );
  if (!input.historicalEvidenceUnchanged)
    failures.push("historical evidence changed");
  if (
    input.humanPacket.status === "passed" &&
    !input.humanPacket.reviewer?.trim()
  )
    failures.push("human reviewer attribution");
  if (
    input.report.overallInputSuccess &&
    (!input.report.technicalPassed ||
      input.report.failures.length > 0 ||
      input.humanPacket.status !== "passed" ||
      !input.humanPacket.reviewer?.trim())
  )
    failures.push("success receipt missing a hard column");
  return failures;
}

export function buildInputLiveV3Receipt(
  input: InputLiveV3EvidenceInput,
): Record<string, any> {
  const failures = validateInputLiveV3Evidence(input);
  if (input.report.overallInputSuccess && failures.length > 0)
    throw new Error(
      `Input live v3 success receipt refused:\n${failures.join("\n")}`,
    );
  if (failures.length > 0)
    throw new Error(
      `Input live v3 evidence incomplete:\n${failures.join("\n")}`,
    );
  return {
    artifactVersion: INPUT_LIVE_V3_RECEIPT_VERSION,
    chronology: {
      antecedentCommit: INPUT_LIVE_V3_ANTECEDENT_COMMIT,
      authorizationCommit: input.chronology.authorizationCommit,
      codeCommit: input.chronology.codeCommit,
    },
    lockedArtifacts: {
      protocol: {
        path: INPUT_LIVE_V3_PROTOCOL_PATH,
        sha256: input.hashes.protocolSha256,
      },
      authorization: {
        path: INPUT_LIVE_V3_AUTHORIZATION_PATH,
        sha256: input.hashes.authorizationSha256,
      },
    },
    executionHashes: input.hashes,
    target: input.target,
    attempts: {
      maximum: 3,
      executed: input.attempts.length,
      history: input.attempts,
    },
    exactCounts: input.report.counts,
    exactMetrics: input.report.objective,
    sceneDerived: {
      sourceIrRead: false,
      proofs: input.sceneProofs,
      artifact: input.sceneFactsArtifact,
    },
    cleanupAndRetention: {
      retained: input.target.retained,
      reason: input.target.retentionReason,
      attempts: input.attempts.map(({ attempt, cleanup }) => ({
        attempt,
        cleanup,
      })),
    },
    objective: {
      denominator: input.objectiveRows.length,
      rows: input.objectiveRows,
      artifact: input.objectiveArtifact,
    },
    humanPacket: input.humanPacket,
    historicalEvidenceUnchanged: input.historicalEvidenceUnchanged,
    hardGateReport: input.report,
    overallInputSuccess: input.report.overallInputSuccess,
  };
}

export function writeInputLiveV3Receipt(
  input: InputLiveV3EvidenceInput,
  receiptPath = INPUT_LIVE_V3_RECEIPT_PATH,
): void {
  const receipt = buildInputLiveV3Receipt(input);
  writeFileSync(
    resolveRepositoryEvidencePath(receiptPath),
    `${JSON.stringify(receipt, null, 2)}\n`,
  );
}

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? "")}`)
  throw new Error(
    "Input live v3 evidence writer requires an explicit typed evidence input",
  );
