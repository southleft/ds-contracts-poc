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

import { adaptReviewedInputField } from "./adapters/input-field.js";
import {
  acceptInputLiveV29Response,
  createInputLiveV29Transaction,
  inputLiveV29ReceiptPath,
  inputLiveV29RequestPath,
  inputLiveV29ResponsePath,
  inputLiveV29Sha256,
  issueInputLiveV29Request,
  persistInputLiveV29RawResponse,
  persistInputLiveV29TechnicalGates,
  readInputLiveV29AcceptedRawPayload,
  type InputLiveV29Request,
  type InputLiveV29TransactionAuthorization,
} from "./input-field-live-v29-broker.js";
import {
  INPUT_LIVE_V29_CAPTURE_COUNT,
  assertInputLiveV29CaptureResponses,
  assertInputLiveV29RootProofs,
  buildInputLiveV29CaptureProgram,
  buildInputLiveV29CleanupProgram,
  buildInputLiveV29ExtractProgram,
  buildInputLiveV29ProbeProgram,
  buildInputLiveV29RestoreProgram,
  validateInputLiveV29RestorePayload,
  evaluateInputLiveV29Objective,
  inputLiveV29CaptureManifestSha256,
  proveInputLiveV29Roots,
  validateInputLiveV29CaptureManifest,
  validateInputLiveV29CapturePayload,
  validateInputLiveV29CleanupPayload,
  validateInputLiveV29ExtractPayload,
  validateInputLiveV29ProbePayload,
  validateInputLiveV29WriterPayload,
  type InputLiveV29CaptureCell,
  type InputLiveV29CapturePayload,
  type InputLiveV29RootProof,
  type InputLiveV29SourceIdentity,
  type InputLiveV29WriterOwnership,
} from "./input-field-live-v29-contract.js";
import {
  INPUT_LIVE_V29_CAPTURE_MANIFEST_PATH,
  INPUT_LIVE_V29_PLAN_PATH,
  type InputLiveV29ProofPlan,
} from "./build-input-field-live-proof-v29.js";
import {
  muiInputFieldAdapterConfig,
  polarisInputFieldAdapterConfig,
} from "./fixtures/library-input-fields.js";
import { canonicalJson } from "./normalize.js";
import {
  collapseInputFieldRecipe,
  compileInputFieldRecipe,
} from "./recipes/input-field.js";
import type { ExpectedScenePlan } from "./scene-readback-v29.js";

export const INPUT_LIVE_V29_RUNNER_VERSION = "input-live-v29-runner-v1";

interface InputLiveV29JournalEntry {
  index: number;
  event: string;
  requestId: string | null;
  previousEntrySha256: string | null;
  payloadSha256: string;
  entrySha256: string;
}

interface InputLiveV29OrchestratorState {
  artifactVersion: "input-live-v29-orchestrator-state-v1";
  transactionDirectory: string;
  activeRequest: string | null;
  cleanupRequest: string | null;
  cleanupAccepted: boolean;
  mainComplete: boolean;
  nextCaptureIndex: number;
  journal: InputLiveV29JournalEntry[];
}

interface LoadedProofInputs {
  plan: InputLiveV29ProofPlan;
  planSha256: string;
  captures: InputLiveV29CaptureCell[];
  captureManifestSha256: string;
  sources: Array<
    InputLiveV29SourceIdentity & {
      envelope: ReturnType<typeof compileInputFieldRecipe>;
      selection: unknown;
    }
  >;
  writerProgram: string;
}

export interface InputLiveV29NextAction {
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
  state: InputLiveV29OrchestratorState,
): void => {
  const file = path.join(directory, STATE_FILE);
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, {
    flag: "wx",
  });
  renameSync(temporary, file);
};

const loadProofInputs = (root: string): LoadedProofInputs => {
  const planPath = path.join(root, INPUT_LIVE_V29_PLAN_PATH);
  const capturePath = path.join(root, INPUT_LIVE_V29_CAPTURE_MANIFEST_PATH);
  const planBytes = readFileSync(planPath);
  const captureBytes = readFileSync(capturePath);
  const plan = JSON.parse(planBytes.toString("utf8")) as InputLiveV29ProofPlan;
  const captureArtifact = JSON.parse(captureBytes.toString("utf8")) as Record<
    string,
    any
  >;
  const captures = captureArtifact.cells as InputLiveV29CaptureCell[];
  validateInputLiveV29CaptureManifest(captures);
  if (
    plan.captureManifest.sha256 !== inputLiveV29Sha256(captureBytes) ||
    captureArtifact.cellsSha256 !== inputLiveV29CaptureManifestSha256(captures)
  )
    throw new TypeError("Input live v12 capture manifest hash drift");
  const descriptors = [
    {
      source: "mui" as const,
      contractPath: "examples/mui/contracts/text-field.contract.json",
      config: muiInputFieldAdapterConfig,
    },
    {
      source: "polaris" as const,
      contractPath: "examples/polaris/contracts/text-field.contract.json",
      config: polarisInputFieldAdapterConfig,
    },
  ];
  const sources = plan.sources.map((source) => {
    const descriptor = descriptors.find(
      (candidate) => candidate.source === source.source,
    );
    if (!descriptor)
      throw new TypeError(`Input live v12 unknown source ${source.source}`);
    const expectedBytes = readFileSync(
      path.join(root, source.expectedScenePlan.path),
    );
    const uncompressed = gunzipSync(expectedBytes);
    if (
      inputLiveV29Sha256(expectedBytes) !== source.expectedScenePlan.sha256 ||
      inputLiveV29Sha256(uncompressed) !==
        source.expectedScenePlan.uncompressedSha256
    )
      throw new TypeError(
        `Input live v12 expected plan drift: ${source.source}`,
      );
    const instance = adaptReviewedInputField(
      readJson(path.join(root, descriptor.contractPath)),
      descriptor.config,
    );
    const envelope = compileInputFieldRecipe(instance);
    return {
      source: source.source,
      adapterIdentity: source.adapterIdentity,
      recipeHash: source.recipeHash,
      envelopeHash: source.envelopeHash,
      expectedScenePlan: JSON.parse(
        uncompressed.toString("utf8"),
      ) as ExpectedScenePlan,
      envelope,
      selection: instance.provenance.selection,
    };
  });
  return {
    plan,
    planSha256: inputLiveV29Sha256(planBytes),
    captures,
    captureManifestSha256: inputLiveV29Sha256(captureBytes),
    sources,
    writerProgram: readFileSync(
      path.join(root, plan.writer.programPath),
      "utf8",
    ),
  };
};

const appendJournal = (
  directory: string,
  state: InputLiveV29OrchestratorState,
  event: string,
  requestId: string | null,
  payload: unknown,
): void => {
  const payloadSha256 = inputLiveV29Sha256(canonicalJson(payload));
  const body = {
    index: state.journal.length,
    event,
    requestId,
    previousEntrySha256: state.journal.at(-1)?.entrySha256 ?? null,
    payloadSha256,
  };
  const entry = {
    ...body,
    entrySha256: inputLiveV29Sha256(canonicalJson(body)),
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

const writerOwnership = (directory: string): InputLiveV29WriterOwnership =>
  readJson(path.join(directory, OWNERSHIP_FILE));

const rootProofs = (directory: string): InputLiveV29RootProof[] =>
  readJson<Record<string, any>>(path.join(directory, ROOT_PROOFS_FILE)).proofs;

const requestFromPath = (file: string): InputLiveV29Request =>
  readJson<InputLiveV29Request>(file);

export class InputLiveV29Orchestrator {
  readonly #root: string;
  readonly #directory: string;
  readonly #privateKey: KeyObject;
  readonly #inputs: LoadedProofInputs;
  #state: InputLiveV29OrchestratorState;

  private constructor(
    root: string,
    directory: string,
    privateKey: KeyObject,
    inputs: LoadedProofInputs,
    state: InputLiveV29OrchestratorState,
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
    authorization: InputLiveV29TransactionAuthorization;
    attempt: number;
    transactionId?: string;
    now?: string;
  }): InputLiveV29Orchestrator {
    const inputs = loadProofInputs(options.root);
    createInputLiveV29Transaction(
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
    const writer = issueInputLiveV29Request(
      options.transactionDirectory,
      options.privateKey,
      "writer",
      inputs.writerProgram,
      { now: options.now },
    );
    const state: InputLiveV29OrchestratorState = {
      artifactVersion: "input-live-v29-orchestrator-state-v1",
      transactionDirectory: options.transactionDirectory,
      activeRequest: inputLiveV29RequestPath(
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
    return new InputLiveV29Orchestrator(
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
  }): InputLiveV29Orchestrator {
    const state = readJson<InputLiveV29OrchestratorState>(
      path.join(options.transactionDirectory, STATE_FILE),
    );
    const orchestrator = new InputLiveV29Orchestrator(
      options.root,
      options.transactionDirectory,
      options.privateKey,
      loadProofInputs(options.root),
      state,
    );
    orchestrator.recover();
    return orchestrator;
  }

  nextAction(): InputLiveV29NextAction {
    const cleanup =
      this.#state.cleanupRequest &&
      !this.#state.cleanupAccepted &&
      !existsSync(inputLiveV29ReceiptPath(this.#directory, "cleanup"))
        ? this.#state.cleanupRequest
        : null;
    if (this.#state.cleanupAccepted)
      return {
        status: "cleanup-complete",
        activeRequestPath: null,
        cleanupRequestPath: null,
        expectedDynamicTool: null,
        instructions: "Owned page and collections are removed.",
      };
    if (this.#state.mainComplete)
      return {
        status: "main-complete",
        activeRequestPath: null,
        cleanupRequestPath: cleanup,
        expectedDynamicTool: cleanup
          ? { namespace: "user-Figma Console", tool: "figma_execute" }
          : null,
        instructions:
          "All 128 capture responses are accepted. Execute the persisted cleanup request.",
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

  ingestAndAdvance(rawResponse: string): InputLiveV29NextAction {
    if (!this.#state.activeRequest)
      throw new Error("Input live v12 has no active main request");
    const request = requestFromPath(this.#state.activeRequest);
    persistInputLiveV29RawResponse(
      this.#directory,
      request.phase,
      rawResponse,
      request.captureIndex ?? undefined,
    );
    this.#acceptActive(request);
    this.#persist();
    return this.nextAction();
  }

  ingestCleanup(rawResponse: string): InputLiveV29NextAction {
    if (!this.#state.cleanupRequest)
      throw new Error("Input live v12 cleanup is not available");
    const request = requestFromPath(this.#state.cleanupRequest);
    persistInputLiveV29RawResponse(this.#directory, "cleanup", rawResponse);
    const ownership = writerOwnership(this.#directory);
    const accepted = acceptInputLiveV29Response(this.#directory, "cleanup", {
      validate: (payload) =>
        validateInputLiveV29CleanupPayload(payload, ownership),
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
      existsSync(inputLiveV29ReceiptPath(this.#directory, "writer")) &&
      !existsSync(path.join(this.#directory, OWNERSHIP_FILE))
    ) {
      const raw = readInputLiveV29AcceptedRawPayload(this.#directory, "writer");
      writeNew(
        path.join(this.#directory, OWNERSHIP_FILE),
        validateInputLiveV29WriterPayload(raw),
      );
    }
    if (existsSync(inputLiveV29RequestPath(this.#directory, "cleanup")))
      this.#state.cleanupRequest = inputLiveV29RequestPath(
        this.#directory,
        "cleanup",
      );
    if (
      existsSync(path.join(this.#directory, OWNERSHIP_FILE)) &&
      !existsSync(inputLiveV29RequestPath(this.#directory, "cleanup"))
    )
      this.#issueCleanupAndRestore(false);
    else if (
      existsSync(inputLiveV29RequestPath(this.#directory, "cleanup")) &&
      !existsSync(inputLiveV29RequestPath(this.#directory, "restore"))
    )
      this.#issueRestore(false);
    if (
      existsSync(inputLiveV29RequestPath(this.#directory, "restore")) &&
      !existsSync(inputLiveV29ReceiptPath(this.#directory, "restore"))
    )
      this.#state.activeRequest = inputLiveV29RequestPath(
        this.#directory,
        "restore",
      );
    if (
      existsSync(inputLiveV29ReceiptPath(this.#directory, "restore")) &&
      !existsSync(inputLiveV29RequestPath(this.#directory, "extract"))
    ) {
      const ownership = writerOwnership(this.#directory);
      const extract = issueInputLiveV29Request(
        this.#directory,
        this.#privateKey,
        "extract",
        buildInputLiveV29ExtractProgram(ownership, this.#inputs.sources),
      );
      this.#state.activeRequest = inputLiveV29RequestPath(
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
    if (existsSync(inputLiveV29ReceiptPath(this.#directory, "cleanup")))
      this.#state.cleanupAccepted = true;
    this.#persist();
  }

  #acceptActive(request: InputLiveV29Request): void {
    if (request.phase === "writer") {
      const accepted = acceptInputLiveV29Response(this.#directory, "writer", {
        validate: validateInputLiveV29WriterPayload,
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
      const accepted = acceptInputLiveV29Response(this.#directory, "restore", {
        validate: (payload) =>
          validateInputLiveV29RestorePayload(payload, ownership),
      });
      appendJournal(
        this.#directory,
        this.#state,
        "response-accepted",
        request.requestId,
        { receiptSha256: accepted.receipt.receiptSha256 },
      );
      const extract = issueInputLiveV29Request(
        this.#directory,
        this.#privateKey,
        "extract",
        buildInputLiveV29ExtractProgram(ownership, this.#inputs.sources),
      );
      this.#state.activeRequest = inputLiveV29RequestPath(
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
      const accepted = acceptInputLiveV29Response(this.#directory, "extract", {
        validate: (payload) =>
          validateInputLiveV29ExtractPayload(payload, ownership),
      });
      const proofs = proveInputLiveV29Roots(
        accepted.payload,
        this.#inputs.sources,
        collapseInputFieldRecipe,
        compileInputFieldRecipe,
      );
      assertInputLiveV29RootProofs(proofs);
      writeNew(path.join(this.#directory, ROOT_PROOFS_FILE), {
        artifactVersion: "input-live-v29-host-root-proofs-v1",
        extractReceiptSha256: accepted.receipt.receiptSha256,
        proofs,
      });
      appendJournal(
        this.#directory,
        this.#state,
        "host-normalize-account",
        request.requestId,
        { proofsSha256: inputLiveV29Sha256(canonicalJson(proofs)) },
      );
      const next = issueInputLiveV29Request(
        this.#directory,
        this.#privateKey,
        "probe",
        buildInputLiveV29ProbeProgram(ownership, this.#inputs.sources),
      );
      this.#state.activeRequest = inputLiveV29RequestPath(
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
      const accepted = acceptInputLiveV29Response(this.#directory, "probe", {
        validate: (payload) =>
          validateInputLiveV29ProbePayload(payload, ownership),
      });
      persistInputLiveV29TechnicalGates(
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
      if (!cell) throw new TypeError("Input live v12 capture cell missing");
      const accepted = acceptInputLiveV29Response(this.#directory, "capture", {
        captureIndex: cell.index,
        validate: (payload, rawBytes) =>
          validateInputLiveV29CapturePayload(payload, cell, rawBytes),
      });
      const png = Buffer.from(accepted.payload.pngBase64, "base64");
      const capturePath = path.join(
        this.#directory,
        "captures",
        `${String(cell.index).padStart(3, "0")}-${inputLiveV29Sha256(cell.cellKey).slice(0, 20)}.png`,
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
      if (next < INPUT_LIVE_V29_CAPTURE_COUNT) this.#issueCapture(next);
      else {
        const responses = this.#readCaptureResponseIndex().map((response) => ({
          ...response,
          pngBase64: Buffer.from(
            readFileSync(
              path.join(
                this.#directory,
                "captures",
                `${String(response.index).padStart(3, "0")}-${inputLiveV29Sha256(response.cellKey).slice(0, 20)}.png`,
              ),
            ),
          ).toString("base64"),
        }));
        assertInputLiveV29CaptureResponses(this.#inputs.captures, responses);
        const objective = evaluateInputLiveV29Objective(
          this.#inputs.captures,
          responses,
          (cell) => readFileSync(path.join(this.#root, cell.reference.path)),
          (cell) =>
            readFileSync(
              path.join(
                this.#directory,
                "captures",
                `${String(cell.index).padStart(3, "0")}-${inputLiveV29Sha256(cell.cellKey).slice(0, 20)}.png`,
              ),
            ),
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
            reportSha256: inputLiveV29Sha256(canonicalJson(objective)),
            technicalPassed: objective.technicalPassed,
            overallInputSuccess: false,
            humanSignoff: "pending",
          },
        );
        this.#state.mainComplete = true;
        this.#state.activeRequest = null;
      }
      return;
    }
    throw new Error(`Input live v12 cleanup is not a main-lane request`);
  }

  #issueCleanupAndRestore(journal: boolean): void {
    const ownership = writerOwnership(this.#directory);
    const cleanup = issueInputLiveV29Request(
      this.#directory,
      this.#privateKey,
      "cleanup",
      buildInputLiveV29CleanupProgram(ownership),
    );
    this.#state.cleanupRequest = inputLiveV29RequestPath(
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
    const restore = issueInputLiveV29Request(
      this.#directory,
      this.#privateKey,
      "restore",
      buildInputLiveV29RestoreProgram(ownership),
    );
    this.#state.activeRequest = inputLiveV29RequestPath(
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
    const request = issueInputLiveV29Request(
      this.#directory,
      this.#privateKey,
      "capture",
      buildInputLiveV29CaptureProgram(
        writerOwnership(this.#directory),
        this.#inputs.captures[index]!,
      ),
      { captureIndex: index },
    );
    this.#state.activeRequest = inputLiveV29RequestPath(
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

  #readCaptureResponseIndex(): InputLiveV29CapturePayload[] {
    const file = path.join(this.#directory, CAPTURE_RESPONSES_FILE);
    return existsSync(file) ? readJson(file) : [];
  }

  #writeCaptureResponseIndex(value: InputLiveV29CapturePayload[]): void {
    const file = path.join(this.#directory, CAPTURE_RESPONSES_FILE);
    writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  }

  #persist(): void {
    writeState(this.#directory, this.#state);
  }
}

export const simulatedInputLiveV29Authorization = (
  privateKey: KeyObject,
): InputLiveV29TransactionAuthorization => ({
  mode: "simulated",
  protocolCommit: "1".repeat(40),
  runnerCommit: "2".repeat(40),
  authorizationCommit: "3".repeat(40),
  codeCommit: "4".repeat(40),
  authorizationSha256: "5".repeat(64),
  protocolSha256: "6".repeat(64),
  runnerSha256: "7".repeat(64),
  codeTreeSha256: "8".repeat(64),
  signingPublicKeySha256: inputLiveV29Sha256(
    createPublicKey(privateKey.export({ type: "pkcs8", format: "pem" })).export(
      { type: "spki", format: "der" },
    ),
  ),
});

// Used only by offline tests that need a valid key without writing a credential.
export const generateInputLiveV29SimulationKey = (): KeyObject =>
  generateKeyPairSync("ed25519").privateKey;
