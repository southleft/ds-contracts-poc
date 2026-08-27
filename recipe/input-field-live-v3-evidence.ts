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

export interface InputLiveV3Artifact {
  path: string;
  bytes: number;
  sha256: string;
}

export interface InputLiveV3AttemptEvidence {
  attempt: number;
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
      input.attempts.length
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
