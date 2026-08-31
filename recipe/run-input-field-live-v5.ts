import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { canonicalJson } from "./normalize.js";
import {
  INPUT_LIVE_V5_EVIDENCE_ROOT,
  INPUT_LIVE_V5_TARGET,
  verifyInputLiveV5Authorization,
  type InputLiveV5AuthorizationProof,
} from "./input-field-live-v5-authorization.js";
import {
  authorizationJournalPayload,
  InputLiveV5PhaseJournal,
  assertInputLiveV5WriterOwnership,
  type InputLiveV5WriterOwnership,
} from "./input-field-live-v5-journal.js";
import { runInputLiveV5Preflight } from "./input-field-live-v5-preflight.js";
import {
  assertInputLiveV4PreCaptureGates as assertInputLiveV5PreCaptureGates,
  normalizeInputLiveV4Scene,
  normalizedSceneIr,
  type InputLiveV4RawNode,
} from "./input-field-live-v4-verifier.js";
import type { LocalVariableRecord } from "./figma-property-normalizer.js";
import type { WriterTransportEnvelope } from "./writer-transport.js";

export const INPUT_LIVE_V5_RUNNER_VERSION = "input-live-v5-runner-v1";
const WRAPPER_ARTIFACT = `${INPUT_LIVE_V5_EVIDENCE_ROOT}/writer-wrapper.txt`;
const ENVELOPE_ARTIFACT = `${INPUT_LIVE_V5_EVIDENCE_ROOT}/transport-envelope.json`;
const PLAN_ARTIFACT = `${INPUT_LIVE_V5_EVIDENCE_ROOT}/writer-plan.json`;

export interface InputLiveV5RawScene {
  scene: InputLiveV4RawNode;
  variableTable: LocalVariableRecord[];
}

export interface InputLiveV5Usability {
  usability: boolean;
  restoration: boolean;
  clipping: boolean;
  overlap: boolean;
  adornmentContent: boolean;
  stateSemantics: boolean;
  visitedVariants: number;
  restoredVariants: number;
}

export interface InputLiveV5Transaction {
  evaluateGeneratedWriter(input: {
    wrapper: string;
    envelope: WriterTransportEnvelope;
    wrapperSha256: string;
  }): Promise<InputLiveV5WriterOwnership>;
  extractRawScene(
    writer: InputLiveV5WriterOwnership,
  ): Promise<InputLiveV5RawScene>;
  probeUsability(
    normalized: ReturnType<typeof normalizeInputLiveV4Scene>,
  ): Promise<InputLiveV5Usability>;
  capture(
    normalized: ReturnType<typeof normalizeInputLiveV4Scene>,
  ): Promise<Record<string, unknown>>;
  cleanup(writer: InputLiveV5WriterOwnership): Promise<{
    complete: boolean;
    requestedNodeIds: string[];
    removedNodeIds: string[];
    requestedCollectionIds: string[];
    removedCollectionIds: string[];
    remainingOwnedNodes: number;
    remainingOwnedCollections: number;
  }>;
}

export interface InputLiveV5Bridge {
  kind: "live" | "fake";
  invoke<T>(
    operation: (transaction: InputLiveV5Transaction) => Promise<T>,
  ): Promise<T>;
}

export interface InputLiveV5RunOptions {
  root: string;
  mode: "live" | "offline";
  attempt: number;
  completedAttempts: number[];
  journalDirectory: string;
  authorize(): InputLiveV5AuthorizationProof;
  bridge: InputLiveV5Bridge;
}

export interface InputLiveV5RunResult {
  completed: boolean;
  bridgeInvocations: number;
  error?: string;
  cleanupError?: string;
  journal: InputLiveV5PhaseJournal;
}

const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");
const errorMessage = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

const sceneFactCount = (value: unknown): number => {
  if (Array.isArray(value))
    return value.reduce(
      (sum, child) => sum + sceneFactCount(child),
      value.length,
    );
  if (!value || typeof value !== "object") return 1;
  return Object.values(value).reduce(
    (sum, child) => sum + sceneFactCount(child),
    Object.keys(value).length,
  );
};

const assertCleanup = (
  cleanup: Awaited<ReturnType<InputLiveV5Transaction["cleanup"]>>,
  writer: InputLiveV5WriterOwnership,
): void => {
  if (
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
    throw new TypeError("v5 cleanup incomplete");
};

export async function runInputLiveV5(
  options: InputLiveV5RunOptions,
): Promise<InputLiveV5RunResult> {
  const proof = options.authorize();
  if (
    (options.mode === "live" &&
      (proof.mode !== "live" || options.bridge.kind !== "live")) ||
    (options.mode === "offline" &&
      (proof.mode !== "simulated" || options.bridge.kind !== "fake"))
  )
    throw new Error("Input live v5 authorization/bridge mode mismatch");
  const preflight = runInputLiveV5Preflight(
    options.root,
    proof,
    options.attempt,
    options.completedAttempts,
  );
  const plan = JSON.parse(
    readFileSync(path.join(options.root, PLAN_ARTIFACT), "utf8"),
  ) as Record<string, any>;
  const wrapper = readFileSync(
    path.join(options.root, WRAPPER_ARTIFACT),
    "utf8",
  );
  const envelope = JSON.parse(
    readFileSync(path.join(options.root, ENVELOPE_ARTIFACT), "utf8"),
  ) as WriterTransportEnvelope;
  const journal = new InputLiveV5PhaseJournal(
    options.journalDirectory,
    options.attempt,
  );
  let bridgeInvocations = 0;
  const result = await options.bridge.invoke(async (transaction) => {
    bridgeInvocations += 1;
    let writer: InputLiveV5WriterOwnership | undefined;
    let runError: unknown;
    let cleanupError: unknown;
    try {
      journal.append("preflight", {
        ...authorizationJournalPayload(proof),
        generated: preflight,
      });
      writer = await transaction.evaluateGeneratedWriter({
        wrapper,
        envelope,
        wrapperSha256: plan.transport.wrapperSha256,
      });
      assertInputLiveV5WriterOwnership(writer);
      journal.append("writer-result", writer);
      const raw = await transaction.extractRawScene(writer);
      if (!raw.scene || raw.variableTable.length === 0)
        throw new TypeError(
          "v5 raw scene or variable table denominator is zero",
        );
      journal.append("raw-scene-and-variable-table", raw);
      const normalized = normalizeInputLiveV4Scene(
        raw.scene,
        raw.variableTable,
      );
      journal.append("host-normalization", normalized);
      const inverted = normalizedSceneIr(normalized);
      const cycle1 = sha256(canonicalJson(inverted));
      const cycle2 = sha256(canonicalJson(normalizedSceneIr(normalized)));
      const facts = sceneFactCount(inverted);
      const accounting = {
        accounting: facts > 0,
        sceneFacts: facts,
        occurrenceKeys: new Set(
          normalized.canonicalBindings.map((binding) => binding.ownershipKey),
        ).size,
        silentDerived: true,
        fixedPoint: cycle1 === cycle2,
        fixedPointCycles: 2,
        cycle1Sha256: cycle1,
        cycle2Sha256: cycle2,
      };
      journal.append("accounting-and-fixed-point", accounting);
      const usability = await transaction.probeUsability(normalized);
      journal.append("usability-and-restoration", usability);
      assertInputLiveV5PreCaptureGates({
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
      const captures = await transaction.capture(normalized);
      journal.append("captures-and-objective", captures);
    } catch (error) {
      runError = error;
    } finally {
      if (writer !== undefined) {
        try {
          const persistedWriter = journal.writerOwnership();
          const cleanup = await transaction.cleanup(persistedWriter);
          assertCleanup(cleanup, persistedWriter);
          journal.append("retention-and-cleanup", {
            recoveryAfterFailure: runError !== undefined,
            retained: false,
            cleanup,
          });
        } catch (error) {
          cleanupError = error;
        }
      }
    }
    return {
      completed: runError === undefined && cleanupError === undefined,
      ...(runError === undefined ? {} : { error: errorMessage(runError) }),
      ...(cleanupError === undefined
        ? {}
        : { cleanupError: errorMessage(cleanupError) }),
    };
  });
  if (bridgeInvocations !== 1)
    throw new Error(
      `Input live v5 bridge invocation count ${bridgeInvocations}`,
    );
  return { ...result, bridgeInvocations, journal };
}

const argument = (name: string, fallback = ""): string => {
  const exact = process.argv.indexOf(name);
  if (exact >= 0) return process.argv[exact + 1] ?? fallback;
  return (
    process.argv
      .find((value) => value.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? fallback
  );
};

async function loadLiveBridge(): Promise<InputLiveV5Bridge> {
  const modulePath = process.env.INPUT_LIVE_V5_BRIDGE_MODULE;
  if (!modulePath)
    throw new Error(
      "INPUT_LIVE_V5_BRIDGE_MODULE must name the authorized live bridge adapter",
    );
  const module = (await import(
    pathToFileURL(path.resolve(modulePath)).href
  )) as {
    createInputLiveV5Bridge?: () => InputLiveV5Bridge;
  };
  if (!module.createInputLiveV5Bridge)
    throw new Error("live bridge module omits createInputLiveV5Bridge");
  return module.createInputLiveV5Bridge();
}

async function main(): Promise<void> {
  const root = process.cwd();
  const proof = verifyInputLiveV5Authorization(INPUT_LIVE_V5_TARGET);
  const bridge = await loadLiveBridge();
  const result = await runInputLiveV5({
    root,
    mode: "live",
    attempt: Number(argument("--attempt", "1")),
    completedAttempts: argument("--completed-attempts")
      .split(",")
      .filter(Boolean)
      .map(Number),
    journalDirectory: path.join(
      root,
      INPUT_LIVE_V5_EVIDENCE_ROOT,
      `attempt-${argument("--attempt", "1")}-journal`,
    ),
    authorize: () => proof,
    bridge,
  });
  if (!result.completed)
    throw new Error(result.error ?? result.cleanupError ?? "v5 run incomplete");
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) await main();
