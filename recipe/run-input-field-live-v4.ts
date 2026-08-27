import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  InputLiveV4PhaseJournal,
  type InputLiveV4WriterOwnership,
} from "./input-field-live-v4-journal.js";
import { assertInputLiveV4PreCaptureGates } from "./input-field-live-v4-verifier.js";
import {
  assertInputLiveV4WriterResult,
  INPUT_LIVE_V4_TARGET,
} from "./input-field-live-v4-writer.js";

export const INPUT_LIVE_V4_RUNNER_VERSION = "input-live-v4-runner-v1";

export interface InputLiveV4Pipeline {
  preflight(): Promise<unknown>;
  write(): Promise<InputLiveV4WriterOwnership>;
  extractRawScene(writer: InputLiveV4WriterOwnership): Promise<unknown>;
  normalizeHost(raw: unknown): Promise<unknown>;
  accountAndInvert(normalized: unknown): Promise<Record<string, unknown>>;
  probeUsability(normalized: unknown): Promise<Record<string, unknown>>;
  captureAndScore(normalized: unknown): Promise<unknown>;
  cleanup(writer: InputLiveV4WriterOwnership): Promise<unknown>;
}

export interface InputLiveV4RunResult {
  completed: boolean;
  error?: string;
  cleanupError?: string;
  journal: InputLiveV4PhaseJournal;
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

const assertCleanup = (
  value: unknown,
  writer: InputLiveV4WriterOwnership,
): void => {
  const cleanup = value as Record<string, unknown>;
  if (
    value === null ||
    typeof value !== "object" ||
    cleanup.complete !== true ||
    cleanup.remainingOwnedNodes !== 0 ||
    cleanup.remainingOwnedCollections !== 0 ||
    JSON.stringify(cleanup.requestedNodeIds) !==
      JSON.stringify([writer.pageId]) ||
    JSON.stringify(cleanup.removedNodeIds) !==
      JSON.stringify([writer.pageId]) ||
    JSON.stringify(cleanup.requestedCollectionIds) !==
      JSON.stringify(writer.collectionIds) ||
    JSON.stringify(cleanup.removedCollectionIds) !==
      JSON.stringify(writer.collectionIds)
  )
    throw new TypeError("v4 cleanup incomplete");
};

const assertRawScenePhase = (value: unknown): void => {
  if (
    value === null ||
    typeof value !== "object" ||
    !("scene" in value) ||
    !Array.isArray((value as Record<string, unknown>).variableTable) ||
    ((value as Record<string, unknown>).variableTable as unknown[]).length === 0
  )
    throw new TypeError("v4 raw scene or local-variable denominator is zero");
};

export async function executeInputLiveV4Pipeline(
  attempt: number,
  journalDirectory: string,
  pipeline: InputLiveV4Pipeline,
): Promise<InputLiveV4RunResult> {
  const journal = new InputLiveV4PhaseJournal(journalDirectory, attempt);
  let normalized: unknown;
  let runError: unknown;
  let cleanupError: unknown;
  try {
    const preflight = await pipeline.preflight();
    journal.append("preflight", preflight);

    const writer = await pipeline.write();
    assertInputLiveV4WriterResult(writer);
    journal.append("writer-result", writer);

    const raw = await pipeline.extractRawScene(writer);
    assertRawScenePhase(raw);
    journal.append("raw-scene-and-variable-table", raw);

    normalized = await pipeline.normalizeHost(raw);
    journal.append("host-normalization", normalized);

    const accounting = await pipeline.accountAndInvert(normalized);
    journal.append("accounting-and-fixed-point", accounting);

    const usability = await pipeline.probeUsability(normalized);
    journal.append("usability-and-restoration", usability);

    assertInputLiveV4PreCaptureGates({
      sceneExtraction: true,
      hostNormalization: true,
      accounting: accounting.accounting,
      fixedPoint: accounting.fixedPoint,
      usability: usability.usability,
      restoration: usability.restoration,
      clipping: usability.clipping,
      overlap: usability.overlap,
      adornmentContent: usability.adornmentContent,
      stateSemantics: usability.stateSemantics,
    });
    const captures = await pipeline.captureAndScore(normalized);
    journal.append("captures-and-objective", captures);
  } catch (error) {
    runError = error;
  } finally {
    try {
      const writer = journal.writerOwnership();
      const cleanup = await pipeline.cleanup(writer);
      assertCleanup(cleanup, writer);
      journal.append("retention-and-cleanup", {
        recoveryAfterFailure: runError !== undefined,
        cleanup,
      });
    } catch (error) {
      cleanupError = error;
    }
  }
  return {
    completed: runError === undefined && cleanupError === undefined,
    ...(runError === undefined ? {} : { error: errorMessage(runError) }),
    ...(cleanupError === undefined
      ? {}
      : { cleanupError: errorMessage(cleanupError) }),
    journal,
  };
}

function refuseDraftExecution(): never {
  throw new Error(
    [
      "Input live v4 is draft committed antecedent pending authorization.",
      `No live execution is authorized for ${INPUT_LIVE_V4_TARGET.fileKey}.`,
      "A separate authorization commit must precede any clean published descendant run.",
    ].join(" "),
  );
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) refuseDraftExecution();
