import {
  generateKeyPairSync,
  createPrivateKey,
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
  acceptInputLiveV6Response,
  createInputLiveV6Transaction,
  inputLiveV6ReceiptPath,
  inputLiveV6RequestPath,
  inputLiveV6ResponsePath,
  inputLiveV6Sha256,
  issueInputLiveV6Request,
  persistInputLiveV6RawResponse,
  persistInputLiveV6TechnicalGates,
  readInputLiveV6AcceptedRawPayload,
  type InputLiveV6Request,
  type InputLiveV6TransactionAuthorization,
} from "./input-field-live-v6-broker.js";
import {
  INPUT_LIVE_V6_CAPTURE_COUNT,
  assertInputLiveV6CaptureResponses,
  assertInputLiveV6RootProofs,
  buildInputLiveV6CaptureProgram,
  buildInputLiveV6CleanupProgram,
  buildInputLiveV6ExtractProgram,
  buildInputLiveV6ProbeProgram,
  evaluateInputLiveV6Objective,
  inputLiveV6CaptureManifestSha256,
  proveInputLiveV6Roots,
  validateInputLiveV6CaptureManifest,
  validateInputLiveV6CapturePayload,
  validateInputLiveV6CleanupPayload,
  validateInputLiveV6ExtractPayload,
  validateInputLiveV6ProbePayload,
  validateInputLiveV6WriterPayload,
  type InputLiveV6CaptureCell,
  type InputLiveV6CapturePayload,
  type InputLiveV6RootProof,
  type InputLiveV6SourceIdentity,
  type InputLiveV6WriterOwnership,
} from "./input-field-live-v6-contract.js";
import {
  INPUT_LIVE_V6_CAPTURE_MANIFEST_PATH,
  INPUT_LIVE_V6_PLAN_PATH,
  type InputLiveV6ProofPlan,
} from "./build-input-field-live-proof-v6.js";
import {
  muiInputFieldAdapterConfig,
  polarisInputFieldAdapterConfig,
} from "./fixtures/library-input-fields.js";
import { canonicalJson } from "./normalize.js";
import {
  INPUT_LIVE_V6_AUTHORIZATION_PATH,
  verifyInputLiveV6Authorization,
} from "./input-field-live-v6-authorization.js";
import { runInputLiveV6Preflight } from "./input-field-live-v6-preflight.js";
import {
  collapseInputFieldRecipe,
  compileInputFieldRecipe,
} from "./recipes/input-field.js";
import type { ExpectedScenePlan } from "./scene-readback.js";

export const INPUT_LIVE_V6_RUNNER_VERSION = "input-live-v6-runner-v1";

interface InputLiveV6JournalEntry {
  index: number;
  event: string;
  requestId: string | null;
  previousEntrySha256: string | null;
  payloadSha256: string;
  entrySha256: string;
}

interface InputLiveV6OrchestratorState {
  artifactVersion: "input-live-v6-orchestrator-state-v1";
  transactionDirectory: string;
  activeRequest: string | null;
  cleanupRequest: string | null;
  cleanupAccepted: boolean;
  mainComplete: boolean;
  nextCaptureIndex: number;
  journal: InputLiveV6JournalEntry[];
}

interface LoadedProofInputs {
  plan: InputLiveV6ProofPlan;
  planSha256: string;
  captures: InputLiveV6CaptureCell[];
  captureManifestSha256: string;
  sources: Array<
    InputLiveV6SourceIdentity & {
      envelope: ReturnType<typeof compileInputFieldRecipe>;
      selection: unknown;
    }
  >;
  writerProgram: string;
}

export interface InputLiveV6NextAction {
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
  state: InputLiveV6OrchestratorState,
): void => {
  const file = path.join(directory, STATE_FILE);
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, {
    flag: "wx",
  });
  renameSync(temporary, file);
};

const loadProofInputs = (root: string): LoadedProofInputs => {
  const planPath = path.join(root, INPUT_LIVE_V6_PLAN_PATH);
  const capturePath = path.join(root, INPUT_LIVE_V6_CAPTURE_MANIFEST_PATH);
  const planBytes = readFileSync(planPath);
  const captureBytes = readFileSync(capturePath);
  const plan = JSON.parse(planBytes.toString("utf8")) as InputLiveV6ProofPlan;
  const captureArtifact = JSON.parse(captureBytes.toString("utf8")) as Record<
    string,
    any
  >;
  const captures = captureArtifact.cells as InputLiveV6CaptureCell[];
  validateInputLiveV6CaptureManifest(captures);
  if (
    plan.captureManifest.sha256 !== inputLiveV6Sha256(captureBytes) ||
    captureArtifact.cellsSha256 !== inputLiveV6CaptureManifestSha256(captures)
  )
    throw new TypeError("Input live v6 capture manifest hash drift");
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
      throw new TypeError(`Input live v6 unknown source ${source.source}`);
    const expectedBytes = readFileSync(
      path.join(root, source.expectedScenePlan.path),
    );
    const uncompressed = gunzipSync(expectedBytes);
    if (
      inputLiveV6Sha256(expectedBytes) !== source.expectedScenePlan.sha256 ||
      inputLiveV6Sha256(uncompressed) !==
        source.expectedScenePlan.uncompressedSha256
    )
      throw new TypeError(
        `Input live v6 expected plan drift: ${source.source}`,
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
    planSha256: inputLiveV6Sha256(planBytes),
    captures,
    captureManifestSha256: inputLiveV6Sha256(captureBytes),
    sources,
    writerProgram: readFileSync(
      path.join(root, plan.writer.programPath),
      "utf8",
    ),
  };
};

const appendJournal = (
  directory: string,
  state: InputLiveV6OrchestratorState,
  event: string,
  requestId: string | null,
  payload: unknown,
): void => {
  const payloadSha256 = inputLiveV6Sha256(canonicalJson(payload));
  const body = {
    index: state.journal.length,
    event,
    requestId,
    previousEntrySha256: state.journal.at(-1)?.entrySha256 ?? null,
    payloadSha256,
  };
  const entry = {
    ...body,
    entrySha256: inputLiveV6Sha256(canonicalJson(body)),
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

const writerOwnership = (directory: string): InputLiveV6WriterOwnership =>
  readJson(path.join(directory, OWNERSHIP_FILE));

const rootProofs = (directory: string): InputLiveV6RootProof[] =>
  readJson<Record<string, any>>(path.join(directory, ROOT_PROOFS_FILE)).proofs;

const requestFromPath = (file: string): InputLiveV6Request =>
  readJson<InputLiveV6Request>(file);

export class InputLiveV6Orchestrator {
  readonly #root: string;
  readonly #directory: string;
  readonly #privateKey: KeyObject;
  readonly #inputs: LoadedProofInputs;
  #state: InputLiveV6OrchestratorState;

  private constructor(
    root: string,
    directory: string,
    privateKey: KeyObject,
    inputs: LoadedProofInputs,
    state: InputLiveV6OrchestratorState,
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
    authorization: InputLiveV6TransactionAuthorization;
    attempt: number;
    transactionId?: string;
    now?: string;
  }): InputLiveV6Orchestrator {
    const inputs = loadProofInputs(options.root);
    createInputLiveV6Transaction(
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
    const writer = issueInputLiveV6Request(
      options.transactionDirectory,
      options.privateKey,
      "writer",
      inputs.writerProgram,
      { now: options.now },
    );
    const state: InputLiveV6OrchestratorState = {
      artifactVersion: "input-live-v6-orchestrator-state-v1",
      transactionDirectory: options.transactionDirectory,
      activeRequest: inputLiveV6RequestPath(
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
    return new InputLiveV6Orchestrator(
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
  }): InputLiveV6Orchestrator {
    const state = readJson<InputLiveV6OrchestratorState>(
      path.join(options.transactionDirectory, STATE_FILE),
    );
    const orchestrator = new InputLiveV6Orchestrator(
      options.root,
      options.transactionDirectory,
      options.privateKey,
      loadProofInputs(options.root),
      state,
    );
    orchestrator.recover();
    return orchestrator;
  }

  nextAction(): InputLiveV6NextAction {
    const cleanup =
      this.#state.cleanupRequest &&
      !this.#state.cleanupAccepted &&
      !existsSync(inputLiveV6ReceiptPath(this.#directory, "cleanup"))
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

  ingestAndAdvance(rawResponse: string): InputLiveV6NextAction {
    if (!this.#state.activeRequest)
      throw new Error("Input live v6 has no active main request");
    const request = requestFromPath(this.#state.activeRequest);
    persistInputLiveV6RawResponse(
      this.#directory,
      request.phase,
      rawResponse,
      request.captureIndex ?? undefined,
    );
    this.#acceptActive(request);
    this.#persist();
    return this.nextAction();
  }

  ingestCleanup(rawResponse: string): InputLiveV6NextAction {
    if (!this.#state.cleanupRequest)
      throw new Error("Input live v6 cleanup is not available");
    const request = requestFromPath(this.#state.cleanupRequest);
    persistInputLiveV6RawResponse(this.#directory, "cleanup", rawResponse);
    const ownership = writerOwnership(this.#directory);
    const accepted = acceptInputLiveV6Response(this.#directory, "cleanup", {
      validate: (payload) =>
        validateInputLiveV6CleanupPayload(payload, ownership),
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
      existsSync(inputLiveV6ReceiptPath(this.#directory, "writer")) &&
      !existsSync(path.join(this.#directory, OWNERSHIP_FILE))
    ) {
      const raw = readInputLiveV6AcceptedRawPayload(this.#directory, "writer");
      writeNew(
        path.join(this.#directory, OWNERSHIP_FILE),
        validateInputLiveV6WriterPayload(raw),
      );
    }
    if (
      existsSync(path.join(this.#directory, OWNERSHIP_FILE)) &&
      !existsSync(inputLiveV6RequestPath(this.#directory, "cleanup"))
    )
      this.#issueCleanupAndExtract(false);
    if (existsSync(inputLiveV6ReceiptPath(this.#directory, "cleanup")))
      this.#state.cleanupAccepted = true;
    this.#persist();
  }

  #acceptActive(request: InputLiveV6Request): void {
    if (request.phase === "writer") {
      const accepted = acceptInputLiveV6Response(this.#directory, "writer", {
        validate: validateInputLiveV6WriterPayload,
      });
      writeNew(path.join(this.#directory, OWNERSHIP_FILE), accepted.payload);
      appendJournal(
        this.#directory,
        this.#state,
        "response-accepted",
        request.requestId,
        { receiptSha256: accepted.receipt.receiptSha256 },
      );
      this.#issueCleanupAndExtract(true);
      return;
    }
    const ownership = writerOwnership(this.#directory);
    if (request.phase === "extract") {
      const accepted = acceptInputLiveV6Response(this.#directory, "extract", {
        validate: (payload) =>
          validateInputLiveV6ExtractPayload(payload, ownership),
      });
      const proofs = proveInputLiveV6Roots(
        accepted.payload,
        this.#inputs.sources,
        collapseInputFieldRecipe,
        compileInputFieldRecipe,
      );
      assertInputLiveV6RootProofs(proofs);
      writeNew(path.join(this.#directory, ROOT_PROOFS_FILE), {
        artifactVersion: "input-live-v6-host-root-proofs-v1",
        extractReceiptSha256: accepted.receipt.receiptSha256,
        proofs,
      });
      appendJournal(
        this.#directory,
        this.#state,
        "host-normalize-account",
        request.requestId,
        { proofsSha256: inputLiveV6Sha256(canonicalJson(proofs)) },
      );
      const next = issueInputLiveV6Request(
        this.#directory,
        this.#privateKey,
        "probe",
        buildInputLiveV6ProbeProgram(ownership, this.#inputs.sources),
      );
      this.#state.activeRequest = inputLiveV6RequestPath(
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
      const accepted = acceptInputLiveV6Response(this.#directory, "probe", {
        validate: (payload) =>
          validateInputLiveV6ProbePayload(payload, ownership),
      });
      persistInputLiveV6TechnicalGates(
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
      if (!cell) throw new TypeError("Input live v6 capture cell missing");
      const accepted = acceptInputLiveV6Response(this.#directory, "capture", {
        captureIndex: cell.index,
        validate: (payload, rawBytes) =>
          validateInputLiveV6CapturePayload(payload, cell, rawBytes),
      });
      const png = Buffer.from(accepted.payload.pngBase64, "base64");
      const capturePath = path.join(
        this.#directory,
        "captures",
        `${String(cell.index).padStart(3, "0")}-${inputLiveV6Sha256(cell.cellKey).slice(0, 20)}.png`,
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
      if (next < INPUT_LIVE_V6_CAPTURE_COUNT) this.#issueCapture(next);
      else {
        const responses = this.#readCaptureResponseIndex().map((response) => ({
          ...response,
          pngBase64: Buffer.from(
            readFileSync(
              path.join(
                this.#directory,
                "captures",
                `${String(response.index).padStart(3, "0")}-${inputLiveV6Sha256(response.cellKey).slice(0, 20)}.png`,
              ),
            ),
          ).toString("base64"),
        }));
        assertInputLiveV6CaptureResponses(this.#inputs.captures, responses);
        const objective = evaluateInputLiveV6Objective(
          this.#inputs.captures,
          responses,
          (cell) => readFileSync(path.join(this.#root, cell.reference.path)),
          (cell) =>
            readFileSync(
              path.join(
                this.#directory,
                "captures",
                `${String(cell.index).padStart(3, "0")}-${inputLiveV6Sha256(cell.cellKey).slice(0, 20)}.png`,
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
            reportSha256: inputLiveV6Sha256(canonicalJson(objective)),
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
    throw new Error(`Input live v6 cleanup is not a main-lane request`);
  }

  #issueCleanupAndExtract(journal: boolean): void {
    const ownership = writerOwnership(this.#directory);
    const cleanup = issueInputLiveV6Request(
      this.#directory,
      this.#privateKey,
      "cleanup",
      buildInputLiveV6CleanupProgram(ownership),
    );
    this.#state.cleanupRequest = inputLiveV6RequestPath(
      this.#directory,
      "cleanup",
    );
    const extract = issueInputLiveV6Request(
      this.#directory,
      this.#privateKey,
      "extract",
      buildInputLiveV6ExtractProgram(ownership, this.#inputs.sources),
    );
    this.#state.activeRequest = inputLiveV6RequestPath(
      this.#directory,
      "extract",
    );
    if (journal) {
      appendJournal(
        this.#directory,
        this.#state,
        "cleanup-available",
        cleanup.requestId,
        { requestSha256: cleanup.requestSha256 },
      );
      appendJournal(
        this.#directory,
        this.#state,
        "request-issued",
        extract.requestId,
        { requestSha256: extract.requestSha256 },
      );
    }
  }

  #issueCapture(index: number): void {
    const request = issueInputLiveV6Request(
      this.#directory,
      this.#privateKey,
      "capture",
      buildInputLiveV6CaptureProgram(
        writerOwnership(this.#directory),
        this.#inputs.captures[index]!,
      ),
      { captureIndex: index },
    );
    this.#state.activeRequest = inputLiveV6RequestPath(
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

  #readCaptureResponseIndex(): InputLiveV6CapturePayload[] {
    const file = path.join(this.#directory, CAPTURE_RESPONSES_FILE);
    return existsSync(file) ? readJson(file) : [];
  }

  #writeCaptureResponseIndex(value: InputLiveV6CapturePayload[]): void {
    const file = path.join(this.#directory, CAPTURE_RESPONSES_FILE);
    writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  }

  #persist(): void {
    writeState(this.#directory, this.#state);
  }
}

export const simulatedInputLiveV6Authorization = (
  privateKey: KeyObject,
): InputLiveV6TransactionAuthorization => ({
  mode: "simulated",
  protocolCommit: "1".repeat(40),
  runnerCommit: "2".repeat(40),
  authorizationCommit: "3".repeat(40),
  codeCommit: "4".repeat(40),
  authorizationSha256: "5".repeat(64),
  protocolSha256: "6".repeat(64),
  runnerSha256: "7".repeat(64),
  codeTreeSha256: "8".repeat(64),
  signingPublicKeySha256: inputLiveV6Sha256(
    createPublicKey(privateKey.export({ type: "pkcs8", format: "pem" })).export(
      { type: "spki", format: "der" },
    ),
  ),
});

const argument = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1];
  return process.argv
    .find((value) => value.startsWith(`${name}=`))
    ?.slice(name.length + 1);
};

const loadLiveAuthorization = (
  file: string,
): InputLiveV6TransactionAuthorization => {
  const expected = path.resolve(
    process.cwd(),
    INPUT_LIVE_V6_AUTHORIZATION_PATH,
  );
  if (path.resolve(file) !== expected)
    throw new Error(
      `Input live v6 requires exact authorization artifact ${INPUT_LIVE_V6_AUTHORIZATION_PATH}`,
    );
  return verifyInputLiveV6Authorization();
};

async function main(): Promise<void> {
  const command = process.argv[2];
  const root = process.cwd();
  const directory = path.resolve(
    argument("--transaction") ??
      path.join(root, "private/input-live-v6-transaction"),
  );
  const keyPath = argument("--private-key");
  if (!keyPath)
    throw new Error(
      "--private-key must point to an external Ed25519 PKCS8 PEM; keys are never stored in repository artifacts",
    );
  const privateKey = createPrivateKey(readFileSync(keyPath));
  if (command === "init") {
    const authorizationPath = argument("--authorization");
    if (!authorizationPath)
      throw new Error("--authorization is required for live initialization");
    const securityAttestationPath = argument("--security-attestation");
    if (!securityAttestationPath)
      throw new Error(
        "--security-attestation is required after Figma PAT rotation and MCP restart",
      );
    const attempt = Number(argument("--attempt") ?? "1");
    const authorization = loadLiveAuthorization(authorizationPath);
    const completedAttempts = (argument("--completed-attempts") ?? "")
      .split(",")
      .filter(Boolean)
      .map(Number);
    runInputLiveV6Preflight(
      root,
      authorization as ReturnType<typeof verifyInputLiveV6Authorization>,
      securityAttestationPath,
      attempt,
      completedAttempts,
    );
    const orchestrator = InputLiveV6Orchestrator.initialize({
      root,
      transactionDirectory: directory,
      privateKey,
      authorization,
      attempt,
    });
    process.stdout.write(
      `${JSON.stringify(orchestrator.nextAction(), null, 2)}\n`,
    );
    return;
  }
  const orchestrator = InputLiveV6Orchestrator.resume({
    root,
    transactionDirectory: directory,
    privateKey,
  });
  if (command === "status") {
    process.stdout.write(
      `${JSON.stringify(orchestrator.nextAction(), null, 2)}\n`,
    );
    return;
  }
  const responsePath = argument("--response");
  if (!responsePath)
    throw new Error(
      `${command} requires --response with complete raw MCP JSON`,
    );
  const raw = readFileSync(responsePath, "utf8");
  const action =
    command === "cleanup"
      ? orchestrator.ingestCleanup(raw)
      : orchestrator.ingestAndAdvance(raw);
  process.stdout.write(`${JSON.stringify(action, null, 2)}\n`);
}

if (
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === new URL(import.meta.url).pathname
)
  await main();

// Used only by offline tests that need a valid key without writing a credential.
export const generateInputLiveV6SimulationKey = (): KeyObject =>
  generateKeyPairSync("ed25519").privateKey;
