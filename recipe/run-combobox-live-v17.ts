import {
  generateKeyPairSync,
  createPublicKey,
  type KeyObject,
} from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import { adaptReviewedCombobox } from "./adapters/combobox.js";
import {
  acceptComboboxLiveV17Response,
  createComboboxLiveV17Transaction,
  comboboxLiveV5ReceiptPath,
  comboboxLiveV5RequestPath,
  comboboxLiveV5Sha256,
  issueComboboxLiveV17Request,
  persistComboboxLiveV17RawResponse,
  persistComboboxLiveV17TechnicalGates,
  readComboboxLiveV17AcceptedRawPayload,
  type ComboboxLiveV17Request,
  type ComboboxLiveV17TransactionAuthorization,
} from "./combobox-live-v17-broker.js";
import {
  COMBOBOX_LIVE_V17_CAPTURE_COUNT,
  assertComboboxLiveV17CaptureResponses,
  assertComboboxLiveV17RootProofs,
  buildComboboxLiveV17CaptureProgram,
  buildComboboxLiveV17CleanupProgram,
  buildComboboxLiveV17ExtractProgram,
  buildComboboxLiveV17ProbeProgram,
  buildComboboxLiveV17RestoreProgram,
  validateComboboxLiveV17RestorePayload,
  evaluateComboboxLiveV17Objective,
  comboboxLiveV5CaptureManifestSha256,
  proveComboboxLiveV17Roots,
  validateComboboxLiveV17CaptureManifest,
  validateComboboxLiveV17CapturePayload,
  validateComboboxLiveV17CleanupPayload,
  validateComboboxLiveV17ExtractPayload,
  validateComboboxLiveV17ProbePayload,
  validateComboboxLiveV17WriterPayload,
  type ComboboxLiveV17CaptureCell,
  type ComboboxLiveV17CapturePayload,
  type ComboboxLiveV17RootProof,
  type ComboboxLiveV17SourceIdentity,
  type ComboboxLiveV17WriterOwnership,
} from "./combobox-live-v17-contract.js";
import {
  COMBOBOX_LIVE_V17_CAPTURE_MANIFEST_PATH,
  COMBOBOX_LIVE_V17_PLAN_PATH,
  type ComboboxLiveV17ProofPlan,
} from "./build-combobox-live-proof-v17.js";
import {
  antdComboboxAdapterConfig,
  antdComboboxSource,
  muiComboboxAdapterConfig,
  muiComboboxSource,
} from "./fixtures/library-comboboxes.js";
import { canonicalJson } from "./normalize.js";
import {
  collapseComboboxRecipe,
  compileComboboxRecipe,
} from "./recipes/combobox.js";
import type { ExpectedScenePlan } from "./scene-readback-combobox-v17.js";

export const COMBOBOX_LIVE_V17_RUNNER_VERSION = "combobox-live-v17-runner-v1";

interface ComboboxLiveV17JournalEntry {
  index: number;
  event: string;
  requestId: string | null;
  previousEntrySha256: string | null;
  payloadSha256: string;
  entrySha256: string;
}

interface ComboboxLiveV17OrchestratorState {
  artifactVersion: "combobox-live-v17-orchestrator-state-v1";
  transactionDirectory: string;
  activeRequest: string | null;
  cleanupRequest: string | null;
  cleanupAccepted: boolean;
  mainComplete: boolean;
  nextCaptureIndex: number;
  journal: ComboboxLiveV17JournalEntry[];
}

interface LoadedProofInputs {
  plan: ComboboxLiveV17ProofPlan;
  planSha256: string;
  captures: ComboboxLiveV17CaptureCell[];
  captureManifestSha256: string;
  sources: Array<
    ComboboxLiveV17SourceIdentity & {
      envelope: ReturnType<typeof compileComboboxRecipe>;
      selection: unknown;
    }
  >;
  writerProgram: string;
}

export interface ComboboxLiveV17NextAction {
  status: "awaiting-external-response" | "main-complete" | "cleanup-complete";
  activeRequestPath: string | null;
  cleanupRequestPath: string | null;
  expectedDynamicTool: {
    namespace: "user-Figma Console";
    tool: "figma_execute";
  } | null;
  instructions: string;
}

const STATE_FILE = "orchestrator-state.json";
const OWNERSHIP_FILE = "writer-ownership.json";
const ROOT_PROOFS_FILE = "host-root-proofs.json";
const CAPTURE_RESPONSES_FILE = "capture-responses.json";

const readJson = <T>(file: string): T =>
  JSON.parse(readFileSync(file, "utf8")) as T;
const writeNew = (file: string, value: unknown): void => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
};
const writeState = (
  directory: string,
  state: ComboboxLiveV17OrchestratorState,
): void => {
  const file = path.join(directory, STATE_FILE);
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, {
    flag: "wx",
  });
  renameSync(temporary, file);
};

const loadExpectedPlan = (
  root: string,
  descriptor: {
    path: string;
    sha256: string;
    uncompressedSha256: string;
  },
  label: string,
): ExpectedScenePlan => {
  const expectedBytes = readFileSync(path.join(root, descriptor.path));
  const uncompressed = gunzipSync(expectedBytes);
  if (
    comboboxLiveV5Sha256(expectedBytes) !== descriptor.sha256 ||
    comboboxLiveV5Sha256(uncompressed) !== descriptor.uncompressedSha256
  )
    throw new TypeError(`Combobox live v17 expected plan drift: ${label}`);
  return JSON.parse(uncompressed.toString("utf8")) as ExpectedScenePlan;
};

const loadProofInputs = (root: string): LoadedProofInputs => {
  const planPath = path.join(root, COMBOBOX_LIVE_V17_PLAN_PATH);
  const capturePath = path.join(root, COMBOBOX_LIVE_V17_CAPTURE_MANIFEST_PATH);
  const planBytes = readFileSync(planPath);
  const captureBytes = readFileSync(capturePath);
  const plan = JSON.parse(planBytes.toString("utf8")) as ComboboxLiveV17ProofPlan;
  const captureArtifact = JSON.parse(captureBytes.toString("utf8")) as Record<
    string,
    any
  >;
  const captures = captureArtifact.cells as ComboboxLiveV17CaptureCell[];
  validateComboboxLiveV17CaptureManifest(captures);
  if (
    plan.captureManifest.sha256 !== comboboxLiveV5Sha256(captureBytes) ||
    captureArtifact.cellsSha256 !==
      comboboxLiveV5CaptureManifestSha256(captures)
  )
    throw new TypeError("Combobox live v17 capture manifest hash drift");
  const descriptors = [
    {
      source: "mui" as const,
      reviewed: muiComboboxSource,
      config: muiComboboxAdapterConfig,
    },
    {
      source: "antd" as const,
      reviewed: antdComboboxSource,
      config: antdComboboxAdapterConfig,
    },
  ];
  const sources = plan.sources.map((source) => {
    const descriptor = descriptors.find(
      (candidate) => candidate.source === source.source,
    );
    if (!descriptor)
      throw new TypeError(`Combobox live v17 unknown source ${source.source}`);
    const instance = adaptReviewedCombobox(
      descriptor.reviewed,
      descriptor.config,
    );
    const envelope = compileComboboxRecipe(instance);
    return {
      source: source.source,
      adapterIdentity: source.adapterIdentity,
      recipeHash: source.recipeHash,
      envelopeHash: source.envelopeHash,
      comboboxExpectedScenePlan: loadExpectedPlan(
        root,
        source.comboboxExpectedScenePlan,
        `${source.source}/combobox`,
      ),
      optionExpectedScenePlan: loadExpectedPlan(
        root,
        source.optionExpectedScenePlan,
        `${source.source}/option`,
      ),
      envelope,
      selection: instance.provenance.selection,
    };
  });
  return {
    plan,
    planSha256: comboboxLiveV5Sha256(planBytes),
    captures,
    captureManifestSha256: comboboxLiveV5Sha256(captureBytes),
    sources,
    writerProgram: readFileSync(
      path.join(root, plan.writer.programPath),
      "utf8",
    ),
  };
};

const appendJournal = (
  directory: string,
  state: ComboboxLiveV17OrchestratorState,
  event: string,
  requestId: string | null,
  payload: unknown,
): void => {
  const payloadSha256 = comboboxLiveV5Sha256(canonicalJson(payload));
  const body = {
    index: state.journal.length,
    event,
    requestId,
    previousEntrySha256: state.journal.at(-1)?.entrySha256 ?? null,
    payloadSha256,
  };
  const entry = {
    ...body,
    entrySha256: comboboxLiveV5Sha256(canonicalJson(body)),
  };
  writeNew(
    path.join(
      directory,
      "journal",
      `${String(entry.index).padStart(3, "0")}-${event}.json`,
    ),
    { ...entry, payload },
  );
  state.journal.push(entry);
};

const writerOwnership = (directory: string): ComboboxLiveV17WriterOwnership =>
  readJson(path.join(directory, OWNERSHIP_FILE));

const rootProofs = (directory: string): ComboboxLiveV17RootProof[] =>
  readJson<Record<string, any>>(path.join(directory, ROOT_PROOFS_FILE)).proofs;

const requestFromPath = (file: string): ComboboxLiveV17Request =>
  readJson<ComboboxLiveV17Request>(file);

export class ComboboxLiveV17Orchestrator {
  readonly #root: string;
  readonly #directory: string;
  readonly #privateKey: KeyObject;
  readonly #inputs: LoadedProofInputs;
  #state: ComboboxLiveV17OrchestratorState;

  private constructor(
    root: string,
    directory: string,
    privateKey: KeyObject,
    inputs: LoadedProofInputs,
    state: ComboboxLiveV17OrchestratorState,
  ) {
    this.#root = root;
    this.#directory = directory;
    this.#privateKey = privateKey;
    this.#inputs = inputs;
    this.#state = state;
  }

  static initialize(options: {
    root: string;
    transactionDirectory: string;
    privateKey: KeyObject;
    authorization: ComboboxLiveV17TransactionAuthorization;
    attempt: number;
    transactionId?: string;
    now?: string;
  }): ComboboxLiveV17Orchestrator {
    const inputs = loadProofInputs(options.root);
    createComboboxLiveV17Transaction(
      options.transactionDirectory,
      options.privateKey,
      {
        authorization: options.authorization,
        proofPlanSha256: inputs.planSha256,
        captureManifestSha256: inputs.captureManifestSha256,
        attempt: options.attempt,
        transactionId: options.transactionId,
        now: options.now,
      },
    );
    const writer = issueComboboxLiveV17Request(
      options.transactionDirectory,
      options.privateKey,
      "writer",
      inputs.writerProgram,
      { now: options.now },
    );
    const state: ComboboxLiveV17OrchestratorState = {
      artifactVersion: "combobox-live-v17-orchestrator-state-v1",
      transactionDirectory: options.transactionDirectory,
      activeRequest: comboboxLiveV5RequestPath(
        options.transactionDirectory,
        "writer",
      ),
      cleanupRequest: null,
      cleanupAccepted: false,
      mainComplete: false,
      nextCaptureIndex: 0,
      journal: [],
    };
    appendJournal(
      options.transactionDirectory,
      state,
      "request-issued",
      writer.requestId,
      { requestSha256: writer.requestSha256, capture: false },
    );
    writeState(options.transactionDirectory, state);
    return new ComboboxLiveV17Orchestrator(
      options.root,
      options.transactionDirectory,
      options.privateKey,
      inputs,
      state,
    );
  }

  static resume(options: {
    root: string;
    transactionDirectory: string;
    privateKey: KeyObject;
  }): ComboboxLiveV17Orchestrator {
    const state = readJson<ComboboxLiveV17OrchestratorState>(
      path.join(options.transactionDirectory, STATE_FILE),
    );
    const orchestrator = new ComboboxLiveV17Orchestrator(
      options.root,
      options.transactionDirectory,
      options.privateKey,
      loadProofInputs(options.root),
      state,
    );
    orchestrator.recover();
    return orchestrator;
  }

  nextAction(): ComboboxLiveV17NextAction {
    const cleanup =
      this.#state.cleanupRequest &&
      !this.#state.cleanupAccepted &&
      !existsSync(comboboxLiveV5ReceiptPath(this.#directory, "cleanup"))
        ? this.#state.cleanupRequest
        : null;
    if (this.#state.cleanupAccepted)
      return {
        status: "cleanup-complete",
        activeRequestPath: null,
        cleanupRequestPath: null,
        expectedDynamicTool: null,
        instructions: "Owned Combobox page and collections are removed.",
      };
    if (this.#state.mainComplete)
      return {
        status: "main-complete",
        activeRequestPath: null,
        cleanupRequestPath: cleanup,
        expectedDynamicTool: null,
        instructions:
          "All 72 capture responses are accepted. Cleanup remains persisted for failure/abort recovery only; do not execute it on this green path.",
      };
    return {
      status: "awaiting-external-response",
      activeRequestPath: this.#state.activeRequest,
      cleanupRequestPath: cleanup,
      expectedDynamicTool: {
        namespace: "user-Figma Console",
        tool: "figma_execute",
      },
      instructions:
        "Invoke exactly the request's pinned dynamic namespace/tool with its arguments, persist the complete raw response, then run accept. The cleanup request is independently available after writer acceptance.",
    };
  }

  ingestAndAdvance(rawResponse: string): ComboboxLiveV17NextAction {
    if (!this.#state.activeRequest)
      throw new Error("Combobox live v17 has no active main request");
    const request = requestFromPath(this.#state.activeRequest);
    persistComboboxLiveV17RawResponse(
      this.#directory,
      request.phase,
      rawResponse,
      request.captureIndex ?? undefined,
    );
    this.#acceptActive(request);
    this.#persist();
    return this.nextAction();
  }

  ingestCleanup(rawResponse: string): ComboboxLiveV17NextAction {
    if (!this.#state.cleanupRequest)
      throw new Error("Combobox live v17 cleanup is not available");
    const request = requestFromPath(this.#state.cleanupRequest);
    persistComboboxLiveV17RawResponse(this.#directory, "cleanup", rawResponse);
    const ownership = writerOwnership(this.#directory);
    const accepted = acceptComboboxLiveV17Response(this.#directory, "cleanup", {
      validate: (payload) =>
        validateComboboxLiveV17CleanupPayload(payload, ownership),
    });
    appendJournal(
      this.#directory,
      this.#state,
      "response-accepted",
      accepted.request.requestId,
      { receiptSha256: accepted.receipt.receiptSha256 },
    );
    this.#state.cleanupAccepted = true;
    this.#state.activeRequest = null;
    this.#persist();
    return this.nextAction();
  }

  recover(): void {
    if (
      existsSync(comboboxLiveV5ReceiptPath(this.#directory, "writer")) &&
      !existsSync(path.join(this.#directory, OWNERSHIP_FILE))
    ) {
      const raw = readComboboxLiveV17AcceptedRawPayload(this.#directory, "writer");
      writeNew(
        path.join(this.#directory, OWNERSHIP_FILE),
        validateComboboxLiveV17WriterPayload(raw),
      );
    }
    if (existsSync(comboboxLiveV5RequestPath(this.#directory, "cleanup")))
      this.#state.cleanupRequest = comboboxLiveV5RequestPath(
        this.#directory,
        "cleanup",
      );
    if (
      existsSync(path.join(this.#directory, OWNERSHIP_FILE)) &&
      !existsSync(comboboxLiveV5RequestPath(this.#directory, "cleanup"))
    )
      this.#issueCleanupAndRestore(false);
    else if (
      existsSync(comboboxLiveV5RequestPath(this.#directory, "cleanup")) &&
      !existsSync(comboboxLiveV5RequestPath(this.#directory, "restore"))
    )
      this.#issueRestore(false);
    if (
      existsSync(comboboxLiveV5RequestPath(this.#directory, "restore")) &&
      !existsSync(comboboxLiveV5ReceiptPath(this.#directory, "restore"))
    )
      this.#state.activeRequest = comboboxLiveV5RequestPath(
        this.#directory,
        "restore",
      );
    if (
      existsSync(comboboxLiveV5ReceiptPath(this.#directory, "restore")) &&
      !existsSync(comboboxLiveV5RequestPath(this.#directory, "extract"))
    ) {
      const ownership = writerOwnership(this.#directory);
      const extract = issueComboboxLiveV17Request(
        this.#directory,
        this.#privateKey,
        "extract",
        buildComboboxLiveV17ExtractProgram(ownership, this.#inputs.sources),
      );
      this.#state.activeRequest = comboboxLiveV5RequestPath(
        this.#directory,
        "extract",
      );
      appendJournal(
        this.#directory,
        this.#state,
        "request-issued",
        extract.requestId,
        { requestSha256: extract.requestSha256 },
      );
    }
    if (existsSync(comboboxLiveV5ReceiptPath(this.#directory, "cleanup")))
      this.#state.cleanupAccepted = true;
    this.#persist();
  }

  #acceptActive(request: ComboboxLiveV17Request): void {
    if (request.phase === "writer") {
      const accepted = acceptComboboxLiveV17Response(this.#directory, "writer", {
        validate: validateComboboxLiveV17WriterPayload,
      });
      writeNew(path.join(this.#directory, OWNERSHIP_FILE), accepted.payload);
      appendJournal(
        this.#directory,
        this.#state,
        "response-accepted",
        request.requestId,
        { receiptSha256: accepted.receipt.receiptSha256 },
      );
      this.#issueCleanupAndRestore(true);
      return;
    }
    const ownership = writerOwnership(this.#directory);
    if (request.phase === "restore") {
      const accepted = acceptComboboxLiveV17Response(this.#directory, "restore", {
        validate: (payload) =>
          validateComboboxLiveV17RestorePayload(payload, ownership),
      });
      appendJournal(
        this.#directory,
        this.#state,
        "response-accepted",
        request.requestId,
        { receiptSha256: accepted.receipt.receiptSha256 },
      );
      const extract = issueComboboxLiveV17Request(
        this.#directory,
        this.#privateKey,
        "extract",
        buildComboboxLiveV17ExtractProgram(ownership, this.#inputs.sources),
      );
      this.#state.activeRequest = comboboxLiveV5RequestPath(
        this.#directory,
        "extract",
      );
      appendJournal(
        this.#directory,
        this.#state,
        "request-issued",
        extract.requestId,
        { requestSha256: extract.requestSha256 },
      );
      return;
    }
    if (request.phase === "extract") {
      const accepted = acceptComboboxLiveV17Response(this.#directory, "extract", {
        validate: (payload) =>
          validateComboboxLiveV17ExtractPayload(payload, ownership),
      });
      const proofs = proveComboboxLiveV17Roots(
        accepted.payload,
        this.#inputs.sources,
        collapseComboboxRecipe,
        compileComboboxRecipe,
      );
      assertComboboxLiveV17RootProofs(proofs);
      writeNew(path.join(this.#directory, ROOT_PROOFS_FILE), {
        artifactVersion: "combobox-live-v17-host-root-proofs-v1",
        extractReceiptSha256: accepted.receipt.receiptSha256,
        proofs,
      });
      appendJournal(
        this.#directory,
        this.#state,
        "host-normalize-account",
        request.requestId,
        { proofsSha256: comboboxLiveV5Sha256(canonicalJson(proofs)) },
      );
      const next = issueComboboxLiveV17Request(
        this.#directory,
        this.#privateKey,
        "probe",
        buildComboboxLiveV17ProbeProgram(ownership, this.#inputs.sources),
      );
      this.#state.activeRequest = comboboxLiveV5RequestPath(
        this.#directory,
        "probe",
      );
      appendJournal(
        this.#directory,
        this.#state,
        "request-issued",
        next.requestId,
        { requestSha256: next.requestSha256 },
      );
      return;
    }
    if (request.phase === "probe") {
      const accepted = acceptComboboxLiveV17Response(this.#directory, "probe", {
        validate: (payload) =>
          validateComboboxLiveV17ProbePayload(payload, ownership),
      });
      persistComboboxLiveV17TechnicalGates(
        this.#directory,
        rootProofs(this.#directory),
        accepted.receipt.payloadSha256,
      );
      appendJournal(
        this.#directory,
        this.#state,
        "technical-gates-bound",
        request.requestId,
        { probeReceiptSha256: accepted.receipt.receiptSha256 },
      );
      this.#issueCapture(0);
      return;
    }
    if (request.phase === "capture") {
      const cell = this.#inputs.captures[request.captureIndex!];
      if (!cell) throw new TypeError("Combobox live v17 capture cell missing");
      const accepted = acceptComboboxLiveV17Response(this.#directory, "capture", {
        captureIndex: cell.index,
        validate: (payload, rawBytes) =>
          validateComboboxLiveV17CapturePayload(payload, cell, rawBytes),
      });
      const png = Buffer.from(accepted.payload.pngBase64, "base64");
      const capturePath = path.join(
        this.#directory,
        "captures",
        `${String(cell.index).padStart(3, "0")}-${comboboxLiveV5Sha256(cell.cellKey).slice(0, 20)}.png`,
      );
      mkdirSync(path.dirname(capturePath), { recursive: true });
      writeFileSync(capturePath, png, { flag: "wx" });
      const responseIndex = this.#readCaptureResponseIndex();
      responseIndex.push({
        ...accepted.payload,
        pngBase64: "",
      });
      this.#writeCaptureResponseIndex(responseIndex);
      appendJournal(
        this.#directory,
        this.#state,
        "capture-accepted",
        request.requestId,
        {
          cellKey: cell.cellKey,
          pngSha256: accepted.payload.pngSha256,
          capturePath,
        },
      );
      const next = cell.index + 1;
      this.#state.nextCaptureIndex = next;
      if (next < COMBOBOX_LIVE_V17_CAPTURE_COUNT) this.#issueCapture(next);
      else {
        const responses = this.#readCaptureResponseIndex().map((response) => ({
          ...response,
          pngBase64: Buffer.from(
            readFileSync(
              path.join(
                this.#directory,
                "captures",
                `${String(response.index).padStart(3, "0")}-${comboboxLiveV5Sha256(response.cellKey).slice(0, 20)}.png`,
              ),
            ),
          ).toString("base64"),
        }));
        assertComboboxLiveV17CaptureResponses(this.#inputs.captures, responses);
        const objective = evaluateComboboxLiveV17Objective(
          this.#inputs.captures,
          responses,
        );
        writeNew(
          path.join(this.#directory, "objective-report.json"),
          objective,
        );
        appendJournal(
          this.#directory,
          this.#state,
          "objective-evaluated",
          request.requestId,
          {
            reportSha256: comboboxLiveV5Sha256(canonicalJson(objective)),
            technicalPassed: objective.technicalPassed,
            overallComboboxSuccess: false,
            humanSignoff: "pending",
          },
        );
        this.#state.mainComplete = true;
        this.#state.activeRequest = null;
      }
      return;
    }
    throw new Error(`Combobox live v17 cleanup is not a main-lane request`);
  }

  #issueCleanupAndRestore(journal: boolean): void {
    const ownership = writerOwnership(this.#directory);
    const cleanup = issueComboboxLiveV17Request(
      this.#directory,
      this.#privateKey,
      "cleanup",
      buildComboboxLiveV17CleanupProgram(ownership),
    );
    this.#state.cleanupRequest = comboboxLiveV5RequestPath(
      this.#directory,
      "cleanup",
    );
    if (journal) {
      appendJournal(
        this.#directory,
        this.#state,
        "cleanup-available",
        cleanup.requestId,
        { requestSha256: cleanup.requestSha256 },
      );
    }
    this.#issueRestore(journal);
  }

  #issueRestore(journal: boolean): void {
    const ownership = writerOwnership(this.#directory);
    const restore = issueComboboxLiveV17Request(
      this.#directory,
      this.#privateKey,
      "restore",
      buildComboboxLiveV17RestoreProgram(ownership),
    );
    this.#state.activeRequest = comboboxLiveV5RequestPath(
      this.#directory,
      "restore",
    );
    if (journal) {
      appendJournal(
        this.#directory,
        this.#state,
        "request-issued",
        restore.requestId,
        { requestSha256: restore.requestSha256 },
      );
    }
  }

  #issueCapture(index: number): void {
    const request = issueComboboxLiveV17Request(
      this.#directory,
      this.#privateKey,
      "capture",
      buildComboboxLiveV17CaptureProgram(
        writerOwnership(this.#directory),
        this.#inputs.captures[index]!,
      ),
      { captureIndex: index },
    );
    this.#state.activeRequest = comboboxLiveV5RequestPath(
      this.#directory,
      "capture",
      index,
    );
    appendJournal(
      this.#directory,
      this.#state,
      "request-issued",
      request.requestId,
      { requestSha256: request.requestSha256, cellIndex: index },
    );
  }

  #readCaptureResponseIndex(): ComboboxLiveV17CapturePayload[] {
    const file = path.join(this.#directory, CAPTURE_RESPONSES_FILE);
    return existsSync(file) ? readJson(file) : [];
  }

  #writeCaptureResponseIndex(value: ComboboxLiveV17CapturePayload[]): void {
    const file = path.join(this.#directory, CAPTURE_RESPONSES_FILE);
    writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  }

  #persist(): void {
    writeState(this.#directory, this.#state);
  }
}

export const simulatedComboboxLiveV17Authorization = (
  privateKey: KeyObject,
): ComboboxLiveV17TransactionAuthorization => ({
  mode: "simulated",
  protocolCommit: "1".repeat(40),
  runnerCommit: "2".repeat(40),
  authorizationCommit: "3".repeat(40),
  codeCommit: "4".repeat(40),
  authorizationSha256: "5".repeat(64),
  protocolSha256: "6".repeat(64),
  runnerSha256: "7".repeat(64),
  codeTreeSha256: "8".repeat(64),
  signingPublicKeySha256: comboboxLiveV5Sha256(
    createPublicKey(privateKey.export({ type: "pkcs8", format: "pem" })).export(
      { type: "spki", format: "der" },
    ),
  ),
});

export const generateComboboxLiveV17SimulationKey = (): KeyObject =>
  generateKeyPairSync("ed25519").privateKey;
