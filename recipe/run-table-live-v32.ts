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

import { adaptReviewedTable } from "./adapters/table.js";
import {
  acceptTableLiveV32Response,
  createTableLiveV32Transaction,
  tableLiveV2ReceiptPath,
  tableLiveV2RequestPath,
  tableLiveV2Sha256,
  issueTableLiveV32Request,
  persistTableLiveV32RawResponse,
  persistTableLiveV32TechnicalGates,
  readTableLiveV32AcceptedRawPayload,
  type TableLiveV32Request,
  type TableLiveV32TransactionAuthorization,
} from "./table-live-v32-broker.js";
import {
  TABLE_LIVE_V32_CAPTURE_COUNT,
  assertTableLiveV32CaptureResponses,
  assertTableLiveV32RootProofs,
  buildTableLiveV32CaptureProgram,
  buildTableLiveV32CleanupProgram,
  buildTableLiveV32ExtractProgram,
  buildTableLiveV32ProbeProgram,
  buildTableLiveV32RestoreProgram,
  validateTableLiveV32RestorePayload,
  evaluateTableLiveV32Objective,
  tableLiveV2CaptureManifestSha256,
  proveTableLiveV32Roots,
  validateTableLiveV32CaptureManifest,
  validateTableLiveV32CapturePayload,
  validateTableLiveV32CleanupPayload,
  validateTableLiveV32ExtractPayload,
  validateTableLiveV32ProbePayload,
  validateTableLiveV32WriterPayload,
  type TableLiveV32CaptureCell,
  type TableLiveV32CapturePayload,
  type TableLiveV32RootProof,
  type TableLiveV32SourceIdentity,
  type TableLiveV32WriterOwnership,
} from "./table-live-v32-contract.js";
import {
  TABLE_LIVE_V32_CAPTURE_MANIFEST_PATH,
  TABLE_LIVE_V32_PLAN_PATH,
  type TableLiveV32ProofPlan,
} from "./build-table-live-proof-v32.js";
import {
  muiTableAdapterConfig,
  muiTableSource,
  firstPartyTableAdapterConfig,
  firstPartyTableSource,
} from "./fixtures/library-tables.js";
import { canonicalJson } from "./normalize.js";
import {
  collapseTableRecipe,
  compileTableRecipe,
} from "./recipes/table.js";
import type { ExpectedScenePlan } from "./scene-readback-table-v1.js";

export const TABLE_LIVE_V32_RUNNER_VERSION = "table-live-v32-runner-v1";

interface TableLiveV32JournalEntry {
  index: number;
  event: string;
  requestId: string | null;
  previousEntrySha256: string | null;
  payloadSha256: string;
  entrySha256: string;
}

interface TableLiveV32OrchestratorState {
  artifactVersion: "table-live-v32-orchestrator-state-v1";
  transactionDirectory: string;
  activeRequest: string | null;
  cleanupRequest: string | null;
  cleanupAccepted: boolean;
  mainComplete: boolean;
  nextCaptureIndex: number;
  journal: TableLiveV32JournalEntry[];
}

interface LoadedProofInputs {
  plan: TableLiveV32ProofPlan;
  planSha256: string;
  captures: TableLiveV32CaptureCell[];
  captureManifestSha256: string;
  sources: Array<
    TableLiveV32SourceIdentity & {
      envelope: ReturnType<typeof compileTableRecipe>;
      selection: unknown;
    }
  >;
  writerProgram: string;
}

export interface TableLiveV32NextAction {
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
  state: TableLiveV32OrchestratorState,
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
    tableLiveV2Sha256(expectedBytes) !== descriptor.sha256 ||
    tableLiveV2Sha256(uncompressed) !== descriptor.uncompressedSha256
  )
    throw new TypeError(`Table live v32 expected plan drift: ${label}`);
  return JSON.parse(uncompressed.toString("utf8")) as ExpectedScenePlan;
};

const loadProofInputs = (root: string): LoadedProofInputs => {
  const planPath = path.join(root, TABLE_LIVE_V32_PLAN_PATH);
  const capturePath = path.join(root, TABLE_LIVE_V32_CAPTURE_MANIFEST_PATH);
  const planBytes = readFileSync(planPath);
  const captureBytes = readFileSync(capturePath);
  const plan = JSON.parse(planBytes.toString("utf8")) as TableLiveV32ProofPlan;
  const captureArtifact = JSON.parse(captureBytes.toString("utf8")) as Record<
    string,
    any
  >;
  const captures = captureArtifact.cells as TableLiveV32CaptureCell[];
  validateTableLiveV32CaptureManifest(captures);
  if (
    plan.captureManifest.sha256 !== tableLiveV2Sha256(captureBytes) ||
    captureArtifact.cellsSha256 !==
      tableLiveV2CaptureManifestSha256(captures)
  )
    throw new TypeError("Table live v32 capture manifest hash drift");
  const descriptors = [
    {
      source: "first-party" as const,
      reviewed: firstPartyTableSource,
      config: firstPartyTableAdapterConfig,
    },
    {
      source: "mui" as const,
      reviewed: muiTableSource,
      config: muiTableAdapterConfig,
    },
  ];
  const sources = plan.sources.map((source) => {
    const descriptor = descriptors.find(
      (candidate) => candidate.source === source.source,
    );
    if (!descriptor)
      throw new TypeError(`Table live v32 unknown source ${source.source}`);
    const instance = adaptReviewedTable(
      descriptor.reviewed,
      descriptor.config,
    );
    const envelope = compileTableRecipe(instance);
    return {
      source: source.source,
      adapterIdentity: source.adapterIdentity,
      recipeHash: source.recipeHash,
      envelopeHash: source.envelopeHash,
      tableExpectedScenePlan: loadExpectedPlan(
        root,
        source.tableExpectedScenePlan,
        `${source.source}/table`,
      ),
      rowExpectedScenePlan: loadExpectedPlan(
        root,
        source.rowExpectedScenePlan,
        `${source.source}/row`,
      ),
      cellExpectedScenePlan: loadExpectedPlan(
        root,
        source.cellExpectedScenePlan,
        `${source.source}/cell`,
      ),
      envelope,
      selection: instance.provenance.selection,
    };
  });
  return {
    plan,
    planSha256: tableLiveV2Sha256(planBytes),
    captures,
    captureManifestSha256: tableLiveV2Sha256(captureBytes),
    sources,
    writerProgram: readFileSync(
      path.join(root, plan.writer.programPath),
      "utf8",
    ),
  };
};

const appendJournal = (
  directory: string,
  state: TableLiveV32OrchestratorState,
  event: string,
  requestId: string | null,
  payload: unknown,
): void => {
  const payloadSha256 = tableLiveV2Sha256(canonicalJson(payload));
  const body = {
    index: state.journal.length,
    event,
    requestId,
    previousEntrySha256: state.journal.at(-1)?.entrySha256 ?? null,
    payloadSha256,
  };
  const entry = {
    ...body,
    entrySha256: tableLiveV2Sha256(canonicalJson(body)),
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

const writerOwnership = (directory: string): TableLiveV32WriterOwnership =>
  readJson(path.join(directory, OWNERSHIP_FILE));

const rootProofs = (directory: string): TableLiveV32RootProof[] =>
  readJson<Record<string, any>>(path.join(directory, ROOT_PROOFS_FILE)).proofs;

const requestFromPath = (file: string): TableLiveV32Request =>
  readJson<TableLiveV32Request>(file);

export class TableLiveV32Orchestrator {
  readonly #root: string;
  readonly #directory: string;
  readonly #privateKey: KeyObject;
  readonly #inputs: LoadedProofInputs;
  #state: TableLiveV32OrchestratorState;

  private constructor(
    root: string,
    directory: string,
    privateKey: KeyObject,
    inputs: LoadedProofInputs,
    state: TableLiveV32OrchestratorState,
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
    authorization: TableLiveV32TransactionAuthorization;
    attempt: number;
    transactionId?: string;
    now?: string;
  }): TableLiveV32Orchestrator {
    const inputs = loadProofInputs(options.root);
    createTableLiveV32Transaction(
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
    const writer = issueTableLiveV32Request(
      options.transactionDirectory,
      options.privateKey,
      "writer",
      inputs.writerProgram,
      { now: options.now },
    );
    const state: TableLiveV32OrchestratorState = {
      artifactVersion: "table-live-v32-orchestrator-state-v1",
      transactionDirectory: options.transactionDirectory,
      activeRequest: tableLiveV2RequestPath(
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
    return new TableLiveV32Orchestrator(
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
  }): TableLiveV32Orchestrator {
    const state = readJson<TableLiveV32OrchestratorState>(
      path.join(options.transactionDirectory, STATE_FILE),
    );
    const orchestrator = new TableLiveV32Orchestrator(
      options.root,
      options.transactionDirectory,
      options.privateKey,
      loadProofInputs(options.root),
      state,
    );
    orchestrator.recover();
    return orchestrator;
  }

  nextAction(): TableLiveV32NextAction {
    const cleanup =
      this.#state.cleanupRequest &&
      !this.#state.cleanupAccepted &&
      !existsSync(tableLiveV2ReceiptPath(this.#directory, "cleanup"))
        ? this.#state.cleanupRequest
        : null;
    if (this.#state.cleanupAccepted)
      return {
        status: "cleanup-complete",
        activeRequestPath: null,
        cleanupRequestPath: null,
        expectedDynamicTool: null,
        instructions: "Owned Table page and collections are removed.",
      };
    if (this.#state.mainComplete)
      return {
        status: "main-complete",
        activeRequestPath: null,
        cleanupRequestPath: cleanup,
        expectedDynamicTool: null,
        instructions:
          "All 20 capture responses are accepted. Cleanup remains persisted for failure/abort recovery only; do not execute it on this green path.",
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

  ingestAndAdvance(rawResponse: string): TableLiveV32NextAction {
    if (!this.#state.activeRequest)
      throw new Error("Table live v32 has no active main request");
    const request = requestFromPath(this.#state.activeRequest);
    persistTableLiveV32RawResponse(
      this.#directory,
      request.phase,
      rawResponse,
      request.captureIndex ?? undefined,
    );
    this.#acceptActive(request);
    this.#persist();
    return this.nextAction();
  }

  ingestCleanup(rawResponse: string): TableLiveV32NextAction {
    if (!this.#state.cleanupRequest)
      throw new Error("Table live v32 cleanup is not available");
    const request = requestFromPath(this.#state.cleanupRequest);
    persistTableLiveV32RawResponse(this.#directory, "cleanup", rawResponse);
    const ownership = writerOwnership(this.#directory);
    const accepted = acceptTableLiveV32Response(this.#directory, "cleanup", {
      validate: (payload) =>
        validateTableLiveV32CleanupPayload(payload, ownership),
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
      existsSync(tableLiveV2ReceiptPath(this.#directory, "writer")) &&
      !existsSync(path.join(this.#directory, OWNERSHIP_FILE))
    ) {
      const raw = readTableLiveV32AcceptedRawPayload(this.#directory, "writer");
      writeNew(
        path.join(this.#directory, OWNERSHIP_FILE),
        validateTableLiveV32WriterPayload(raw),
      );
    }
    if (existsSync(tableLiveV2RequestPath(this.#directory, "cleanup")))
      this.#state.cleanupRequest = tableLiveV2RequestPath(
        this.#directory,
        "cleanup",
      );
    if (
      existsSync(path.join(this.#directory, OWNERSHIP_FILE)) &&
      !existsSync(tableLiveV2RequestPath(this.#directory, "cleanup"))
    )
      this.#issueCleanupAndRestore(false);
    else if (
      existsSync(tableLiveV2RequestPath(this.#directory, "cleanup")) &&
      !existsSync(tableLiveV2RequestPath(this.#directory, "restore"))
    )
      this.#issueRestore(false);
    if (
      existsSync(tableLiveV2RequestPath(this.#directory, "restore")) &&
      !existsSync(tableLiveV2ReceiptPath(this.#directory, "restore"))
    )
      this.#state.activeRequest = tableLiveV2RequestPath(
        this.#directory,
        "restore",
      );
    if (
      existsSync(tableLiveV2ReceiptPath(this.#directory, "restore")) &&
      !existsSync(tableLiveV2RequestPath(this.#directory, "extract"))
    ) {
      const ownership = writerOwnership(this.#directory);
      const extract = issueTableLiveV32Request(
        this.#directory,
        this.#privateKey,
        "extract",
        buildTableLiveV32ExtractProgram(ownership, this.#inputs.sources),
      );
      this.#state.activeRequest = tableLiveV2RequestPath(
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
    if (existsSync(tableLiveV2ReceiptPath(this.#directory, "cleanup")))
      this.#state.cleanupAccepted = true;
    this.#persist();
  }

  #acceptActive(request: TableLiveV32Request): void {
    if (request.phase === "writer") {
      const accepted = acceptTableLiveV32Response(this.#directory, "writer", {
        validate: validateTableLiveV32WriterPayload,
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
      const accepted = acceptTableLiveV32Response(this.#directory, "restore", {
        validate: (payload) =>
          validateTableLiveV32RestorePayload(payload, ownership),
      });
      appendJournal(
        this.#directory,
        this.#state,
        "response-accepted",
        request.requestId,
        { receiptSha256: accepted.receipt.receiptSha256 },
      );
      const extract = issueTableLiveV32Request(
        this.#directory,
        this.#privateKey,
        "extract",
        buildTableLiveV32ExtractProgram(ownership, this.#inputs.sources),
      );
      this.#state.activeRequest = tableLiveV2RequestPath(
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
      const accepted = acceptTableLiveV32Response(this.#directory, "extract", {
        validate: (payload) =>
          validateTableLiveV32ExtractPayload(payload, ownership),
      });
      const proofs = proveTableLiveV32Roots(
        accepted.payload,
        this.#inputs.sources,
        collapseTableRecipe,
        compileTableRecipe,
      );
      assertTableLiveV32RootProofs(proofs);
      writeNew(path.join(this.#directory, ROOT_PROOFS_FILE), {
        artifactVersion: "table-live-v32-host-root-proofs-v1",
        extractReceiptSha256: accepted.receipt.receiptSha256,
        proofs,
      });
      appendJournal(
        this.#directory,
        this.#state,
        "host-normalize-account",
        request.requestId,
        { proofsSha256: tableLiveV2Sha256(canonicalJson(proofs)) },
      );
      const next = issueTableLiveV32Request(
        this.#directory,
        this.#privateKey,
        "probe",
        buildTableLiveV32ProbeProgram(ownership, this.#inputs.sources),
      );
      this.#state.activeRequest = tableLiveV2RequestPath(
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
      const accepted = acceptTableLiveV32Response(this.#directory, "probe", {
        validate: (payload) =>
          validateTableLiveV32ProbePayload(payload, ownership),
      });
      persistTableLiveV32TechnicalGates(
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
      if (!cell) throw new TypeError("Table live v32 capture cell missing");
      const accepted = acceptTableLiveV32Response(this.#directory, "capture", {
        captureIndex: cell.index,
        validate: (payload, rawBytes) =>
          validateTableLiveV32CapturePayload(payload, cell, rawBytes),
      });
      const png = Buffer.from(accepted.payload.pngBase64, "base64");
      const capturePath = path.join(
        this.#directory,
        "captures",
        `${String(cell.index).padStart(3, "0")}-${tableLiveV2Sha256(cell.cellKey).slice(0, 20)}.png`,
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
      if (next < TABLE_LIVE_V32_CAPTURE_COUNT) this.#issueCapture(next);
      else {
        const responses = this.#readCaptureResponseIndex().map((response) => ({
          ...response,
          pngBase64: Buffer.from(
            readFileSync(
              path.join(
                this.#directory,
                "captures",
                `${String(response.index).padStart(3, "0")}-${tableLiveV2Sha256(response.cellKey).slice(0, 20)}.png`,
              ),
            ),
          ).toString("base64"),
        }));
        assertTableLiveV32CaptureResponses(this.#inputs.captures, responses);
        const objective = evaluateTableLiveV32Objective(
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
            reportSha256: tableLiveV2Sha256(canonicalJson(objective)),
            technicalPassed: objective.technicalPassed,
            overallTableSuccess: false,
            humanSignoff: "pending",
          },
        );
        this.#state.mainComplete = true;
        this.#state.activeRequest = null;
      }
      return;
    }
    throw new Error(`Table live v32 cleanup is not a main-lane request`);
  }

  #issueCleanupAndRestore(journal: boolean): void {
    const ownership = writerOwnership(this.#directory);
    const cleanup = issueTableLiveV32Request(
      this.#directory,
      this.#privateKey,
      "cleanup",
      buildTableLiveV32CleanupProgram(ownership),
    );
    this.#state.cleanupRequest = tableLiveV2RequestPath(
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
    const restore = issueTableLiveV32Request(
      this.#directory,
      this.#privateKey,
      "restore",
      buildTableLiveV32RestoreProgram(ownership),
    );
    this.#state.activeRequest = tableLiveV2RequestPath(
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
    const request = issueTableLiveV32Request(
      this.#directory,
      this.#privateKey,
      "capture",
      buildTableLiveV32CaptureProgram(
        writerOwnership(this.#directory),
        this.#inputs.captures[index]!,
      ),
      { captureIndex: index },
    );
    this.#state.activeRequest = tableLiveV2RequestPath(
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

  #readCaptureResponseIndex(): TableLiveV32CapturePayload[] {
    const file = path.join(this.#directory, CAPTURE_RESPONSES_FILE);
    return existsSync(file) ? readJson(file) : [];
  }

  #writeCaptureResponseIndex(value: TableLiveV32CapturePayload[]): void {
    const file = path.join(this.#directory, CAPTURE_RESPONSES_FILE);
    writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  }

  #persist(): void {
    writeState(this.#directory, this.#state);
  }
}

export const simulatedTableLiveV32Authorization = (
  privateKey: KeyObject,
): TableLiveV32TransactionAuthorization => ({
  mode: "simulated",
  protocolCommit: "1".repeat(40),
  runnerCommit: "2".repeat(40),
  authorizationCommit: "3".repeat(40),
  codeCommit: "4".repeat(40),
  authorizationSha256: "5".repeat(64),
  protocolSha256: "6".repeat(64),
  runnerSha256: "7".repeat(64),
  codeTreeSha256: "8".repeat(64),
  signingPublicKeySha256: tableLiveV2Sha256(
    createPublicKey(privateKey.export({ type: "pkcs8", format: "pem" })).export(
      { type: "spki", format: "der" },
    ),
  ),
});

export const generateTableLiveV32SimulationKey = (): KeyObject =>
  generateKeyPairSync("ed25519").privateKey;
