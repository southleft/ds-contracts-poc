import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import {
  INPUT_LIVE_V4_PHASES,
  validateInputLiveV4Journal,
  type InputLiveV4JournalEntry,
} from "./input-field-live-v4-journal.js";
import { INPUT_LIVE_V4_TARGET } from "./input-field-live-v4-writer.js";

export const INPUT_LIVE_V4_ROOT =
  "recipe/evidence/input-field-live-pivot-v4";
export const INPUT_LIVE_V4_PROTOCOL_PATH = `${INPUT_LIVE_V4_ROOT}/protocol.json`;
export const INPUT_LIVE_V4_PROTOCOL_SHA256 =
  "e65584d1d52178cd80dddbe42458a58b0a1ade4f24e41fb53fa4b9cdb97105d6";
export const INPUT_LIVE_V4_STATUS =
  "draft committed antecedent pending authorization";

export interface InputLiveV4PreflightState {
  clean: boolean;
  codeCommit: string;
  antecedentCommit: string;
  antecedentCommitted: boolean;
  antecedentIsAncestor: boolean;
  publishedDescendant: boolean;
  authorizationArtifactExists: boolean;
  authorizationCommit?: string;
  authorizationIsAncestor: boolean;
  target: {
    fileKey: string;
    fileName: string;
    editorType: string;
    connectedExactTargetCount: number;
  };
  attempt: {
    requested: number;
    completed: number[];
    maximum: number;
  };
  plan: {
    sources: number;
    variants: number;
    sceneFacts: number;
    variables: number;
    objectiveCells: number;
  };
}

const sha256 = (value: Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

const resultLeakPaths = (value: unknown, prefix = ""): string[] => {
  if (Array.isArray(value))
    return value.flatMap((child, index) =>
      resultLeakPaths(child, `${prefix}[${index}]`),
    );
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return [
        ...(/(?:outcome|result|measurement|observed|score|winner)/i.test(key)
          ? [path]
          : []),
        ...resultLeakPaths(child, path),
      ];
    },
  );
};

export function validateInputLiveV4Protocol(
  protocol: Record<string, any>,
): string[] {
  const failures: string[] = [];
  if (
    protocol.artifactVersion !== "input-live-v4-protocol-draft-v1" ||
    protocol.protocolId !== "input-live-v4" ||
    protocol.status !== INPUT_LIVE_V4_STATUS
  )
    failures.push("v4 protocol identity/status");
  if (
    protocol.authorization?.authorized !== false ||
    protocol.authorization?.artifactPath !== null ||
    protocol.authorization?.separateCommitRequired !== true
  )
    failures.push("v4 protocol authorization separation");
  if (
    protocol.target?.fileKey !== INPUT_LIVE_V4_TARGET.fileKey ||
    protocol.target?.fileName !== INPUT_LIVE_V4_TARGET.fileName ||
    protocol.target?.editorType !== INPUT_LIVE_V4_TARGET.editorType ||
    protocol.target?.pageScopedOwnership !== true
  )
    failures.push("v4 protocol exact Scratch-only target");
  if (
    protocol.attempts?.maximum !== 3 ||
    protocol.attempts?.cleanPublishedDescendantsOnly !== true
  )
    failures.push("v4 protocol attempt cap/lineage");
  if (
    JSON.stringify(protocol.execution?.phaseOrder) !==
      JSON.stringify(INPUT_LIVE_V4_PHASES) ||
    protocol.execution?.captureAfterAllTechnicalGatesOnly !== true ||
    protocol.execution?.transactionalHashChain !== true ||
    protocol.execution?.cleanupFromPersistedWriterJournal !== true
  )
    failures.push("v4 protocol phase order/journaling");
  const thresholds = protocol.criteria?.thresholds;
  if (
    thresholds?.dimensionError?.absolutePixels !== 4 ||
    thresholds?.dimensionError?.relative !== 0.08 ||
    thresholds?.spacingError?.absolutePixels !== 4 ||
    thresholds?.spacingError?.relative !== 0.2 ||
    thresholds?.roleScaleError?.relative !== 0.1 ||
    thresholds?.clipping?.maximumVisibleAreaLoss !== 0.05 ||
    thresholds?.overlap?.maximumPixels !== 2
  )
    failures.push("v4 retained v3 thresholds");
  const leaks = resultLeakPaths(protocol);
  if (leaks.length > 0)
    failures.push(`v4 protocol posthoc/result fields: ${leaks.join(",")}`);
  return failures;
}

export function validateInputLiveV4Preflight(
  state: InputLiveV4PreflightState,
): string[] {
  const failures: string[] = [];
  if (!state.clean) failures.push("dirty tree");
  if (
    !state.antecedentCommitted ||
    !state.antecedentIsAncestor ||
    !state.publishedDescendant
  )
    failures.push("code commit is old or not a clean published descendant");
  if (
    !state.authorizationArtifactExists ||
    !state.authorizationCommit ||
    !state.authorizationIsAncestor
  )
    failures.push("separate v4 authorization missing");
  if (
    state.target.fileKey !== INPUT_LIVE_V4_TARGET.fileKey ||
    state.target.fileName !== INPUT_LIVE_V4_TARGET.fileName ||
    state.target.editorType !== INPUT_LIVE_V4_TARGET.editorType
  )
    failures.push("wrong file key or target");
  if (state.target.connectedExactTargetCount !== 1)
    failures.push("exact Scratch bridge count");
  if (
    state.attempt.maximum !== 3 ||
    state.attempt.requested !== state.attempt.completed.length + 1 ||
    state.attempt.requested < 1 ||
    state.attempt.requested > 3 ||
    state.attempt.completed.some((attempt, index) => attempt !== index + 1)
  )
    failures.push("attempt chronology/cap");
  if (
    state.plan.sources !== 2 ||
    state.plan.variants !== 256 ||
    state.plan.sceneFacts <= 0 ||
    state.plan.variables <= 0 ||
    state.plan.objectiveCells !== 128
  )
    failures.push("zero-count or incomplete plan");
  return failures;
}

export function validateInputLiveV4CompletedJournal(
  entries: readonly InputLiveV4JournalEntry[],
): string[] {
  const failures = validateInputLiveV4Journal(entries);
  if (
    entries.length !== INPUT_LIVE_V4_PHASES.length ||
    entries.at(-1)?.phase !== "retention-and-cleanup"
  )
    failures.push("v4 journal incomplete");
  return failures;
}

export function readInputLiveV4Protocol(): {
  protocol: Record<string, any>;
  bytes: number;
  sha256: string;
} {
  if (!existsSync(INPUT_LIVE_V4_PROTOCOL_PATH))
    throw new Error("Input live v4 protocol missing");
  const bytes = readFileSync(INPUT_LIVE_V4_PROTOCOL_PATH);
  const protocol = JSON.parse(bytes.toString("utf8"));
  const failures = validateInputLiveV4Protocol(protocol);
  if (sha256(bytes) !== INPUT_LIVE_V4_PROTOCOL_SHA256)
    failures.push("Input live v4 protocol byte hash drift");
  if (failures.length > 0)
    throw new Error(`Input live v4 protocol invalid:\n${failures.join("\n")}`);
  return { protocol, bytes: bytes.byteLength, sha256: sha256(bytes) };
}
