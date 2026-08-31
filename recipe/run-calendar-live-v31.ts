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

import { adaptReviewedCalendar } from "./adapters/calendar.js";
import {
  acceptCalendarLiveV31Response,
  createCalendarLiveV31Transaction,
  calendarLiveV1ReceiptPath,
  calendarLiveV1RequestPath,
  calendarLiveV1Sha256,
  issueCalendarLiveV31Request,
  persistCalendarLiveV31RawResponse,
  persistCalendarLiveV31TechnicalGates,
  readCalendarLiveV31AcceptedRawPayload,
  type CalendarLiveV31Request,
  type CalendarLiveV31TransactionAuthorization,
} from "./calendar-live-v31-broker.js";
import {
  CALENDAR_LIVE_V31_CAPTURE_COUNT,
  assertCalendarLiveV31CaptureResponses,
  assertCalendarLiveV31RootProofs,
  buildCalendarLiveV31CaptureProgram,
  buildCalendarLiveV31CleanupProgram,
  buildCalendarLiveV31ExtractProgram,
  buildCalendarLiveV31ProbeProgram,
  buildCalendarLiveV31RestoreProgram,
  validateCalendarLiveV31RestorePayload,
  evaluateCalendarLiveV31Objective,
  calendarLiveV1CaptureManifestSha256,
  proveCalendarLiveV31Roots,
  validateCalendarLiveV31CaptureManifest,
  validateCalendarLiveV31CapturePayload,
  validateCalendarLiveV31CleanupPayload,
  validateCalendarLiveV31ExtractPayload,
  validateCalendarLiveV31ProbePayload,
  validateCalendarLiveV31WriterPayload,
  type CalendarLiveV31CaptureCell,
  type CalendarLiveV31CapturePayload,
  type CalendarLiveV31RootProof,
  type CalendarLiveV31SourceIdentity,
  type CalendarLiveV31WriterOwnership,
} from "./calendar-live-v31-contract.js";
import {
  CALENDAR_LIVE_V31_CAPTURE_MANIFEST_PATH,
  CALENDAR_LIVE_V31_PLAN_PATH,
  type CalendarLiveV31ProofPlan,
} from "./build-calendar-live-proof-v31.js";
import {
  astryxCalendarAdapterConfig,
  astryxCalendarSource,
} from "./fixtures/library-calendars.js";
import { canonicalJson } from "./normalize.js";
import {
  collapseCalendarRecipe,
  compileCalendarRecipe,
} from "./recipes/calendar.js";
import type { ExpectedScenePlan } from "./scene-readback-calendar-v1.js";

export const CALENDAR_LIVE_V31_RUNNER_VERSION = "calendar-live-v31-runner-v1";

interface CalendarLiveV31JournalEntry {
  index: number;
  event: string;
  requestId: string | null;
  previousEntrySha256: string | null;
  payloadSha256: string;
  entrySha256: string;
}

interface CalendarLiveV31OrchestratorState {
  artifactVersion: "calendar-live-v31-orchestrator-state-v1";
  transactionDirectory: string;
  activeRequest: string | null;
  cleanupRequest: string | null;
  cleanupAccepted: boolean;
  mainComplete: boolean;
  nextCaptureIndex: number;
  journal: CalendarLiveV31JournalEntry[];
}

interface LoadedProofInputs {
  plan: CalendarLiveV31ProofPlan;
  planSha256: string;
  captures: CalendarLiveV31CaptureCell[];
  captureManifestSha256: string;
  sources: Array<
    CalendarLiveV31SourceIdentity & {
      envelope: ReturnType<typeof compileCalendarRecipe>;
      selection: unknown;
    }
  >;
  writerProgram: string;
}

export interface CalendarLiveV31NextAction {
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
  state: CalendarLiveV31OrchestratorState,
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
    calendarLiveV1Sha256(expectedBytes) !== descriptor.sha256 ||
    calendarLiveV1Sha256(uncompressed) !== descriptor.uncompressedSha256
  )
    throw new TypeError(`Calendar live v31 expected plan drift: ${label}`);
  return JSON.parse(uncompressed.toString("utf8")) as ExpectedScenePlan;
};

const loadProofInputs = (root: string): LoadedProofInputs => {
  const planPath = path.join(root, CALENDAR_LIVE_V31_PLAN_PATH);
  const capturePath = path.join(root, CALENDAR_LIVE_V31_CAPTURE_MANIFEST_PATH);
  const planBytes = readFileSync(planPath);
  const captureBytes = readFileSync(capturePath);
  const plan = JSON.parse(planBytes.toString("utf8")) as CalendarLiveV31ProofPlan;
  const captureArtifact = JSON.parse(captureBytes.toString("utf8")) as Record<
    string,
    any
  >;
  const captures = captureArtifact.cells as CalendarLiveV31CaptureCell[];
  validateCalendarLiveV31CaptureManifest(captures);
  if (
    plan.captureManifest.sha256 !== calendarLiveV1Sha256(captureBytes) ||
    captureArtifact.cellsSha256 !==
      calendarLiveV1CaptureManifestSha256(captures)
  )
    throw new TypeError("Calendar live v31 capture manifest hash drift");
  const descriptors = [
    {
      source: "astryx" as const,
      reviewed: astryxCalendarSource,
      config: astryxCalendarAdapterConfig,
    },
  ];
  const sources = plan.sources.map((source) => {
    const descriptor = descriptors.find(
      (candidate) => candidate.source === source.source,
    );
    if (!descriptor)
      throw new TypeError(`Calendar live v31 unknown source ${source.source}`);
    const instance = adaptReviewedCalendar(
      descriptor.reviewed,
      descriptor.config,
    );
    const envelope = compileCalendarRecipe(instance);
    return {
      source: source.source,
      adapterIdentity: source.adapterIdentity,
      recipeHash: source.recipeHash,
      envelopeHash: source.envelopeHash,
      calendarExpectedScenePlan: loadExpectedPlan(
        root,
        source.calendarExpectedScenePlan,
        `${source.source}/table`,
      ),
      weekExpectedScenePlan: loadExpectedPlan(
        root,
        source.weekExpectedScenePlan,
        `${source.source}/row`,
      ),
      dayExpectedScenePlan: loadExpectedPlan(
        root,
        source.dayExpectedScenePlan,
        `${source.source}/cell`,
      ),
      envelope,
      selection: instance.provenance.selection,
    };
  });
  return {
    plan,
    planSha256: calendarLiveV1Sha256(planBytes),
    captures,
    captureManifestSha256: calendarLiveV1Sha256(captureBytes),
    sources,
    writerProgram: readFileSync(
      path.join(root, plan.writer.programPath),
      "utf8",
    ),
  };
};

const appendJournal = (
  directory: string,
  state: CalendarLiveV31OrchestratorState,
  event: string,
  requestId: string | null,
  payload: unknown,
): void => {
  const payloadSha256 = calendarLiveV1Sha256(canonicalJson(payload));
  const body = {
    index: state.journal.length,
    event,
    requestId,
    previousEntrySha256: state.journal.at(-1)?.entrySha256 ?? null,
    payloadSha256,
  };
  const entry = {
    ...body,
    entrySha256: calendarLiveV1Sha256(canonicalJson(body)),
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

const writerOwnership = (directory: string): CalendarLiveV31WriterOwnership =>
  readJson(path.join(directory, OWNERSHIP_FILE));

const rootProofs = (directory: string): CalendarLiveV31RootProof[] =>
  readJson<Record<string, any>>(path.join(directory, ROOT_PROOFS_FILE)).proofs;

const requestFromPath = (file: string): CalendarLiveV31Request =>
  readJson<CalendarLiveV31Request>(file);

export class CalendarLiveV31Orchestrator {
  readonly #root: string;
  readonly #directory: string;
  readonly #privateKey: KeyObject;
  readonly #inputs: LoadedProofInputs;
  #state: CalendarLiveV31OrchestratorState;

  private constructor(
    root: string,
    directory: string,
    privateKey: KeyObject,
    inputs: LoadedProofInputs,
    state: CalendarLiveV31OrchestratorState,
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
    authorization: CalendarLiveV31TransactionAuthorization;
    attempt: number;
    transactionId?: string;
    now?: string;
  }): CalendarLiveV31Orchestrator {
    const inputs = loadProofInputs(options.root);
    createCalendarLiveV31Transaction(
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
    const writer = issueCalendarLiveV31Request(
      options.transactionDirectory,
      options.privateKey,
      "writer",
      inputs.writerProgram,
      { now: options.now },
    );
    const state: CalendarLiveV31OrchestratorState = {
      artifactVersion: "calendar-live-v31-orchestrator-state-v1",
      transactionDirectory: options.transactionDirectory,
      activeRequest: calendarLiveV1RequestPath(
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
    return new CalendarLiveV31Orchestrator(
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
  }): CalendarLiveV31Orchestrator {
    const state = readJson<CalendarLiveV31OrchestratorState>(
      path.join(options.transactionDirectory, STATE_FILE),
    );
    const orchestrator = new CalendarLiveV31Orchestrator(
      options.root,
      options.transactionDirectory,
      options.privateKey,
      loadProofInputs(options.root),
      state,
    );
    orchestrator.recover();
    return orchestrator;
  }

  nextAction(): CalendarLiveV31NextAction {
    const cleanup =
      this.#state.cleanupRequest &&
      !this.#state.cleanupAccepted &&
      !existsSync(calendarLiveV1ReceiptPath(this.#directory, "cleanup"))
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

  ingestAndAdvance(rawResponse: string): CalendarLiveV31NextAction {
    if (!this.#state.activeRequest)
      throw new Error("Calendar live v31 has no active main request");
    const request = requestFromPath(this.#state.activeRequest);
    persistCalendarLiveV31RawResponse(
      this.#directory,
      request.phase,
      rawResponse,
      request.captureIndex ?? undefined,
    );
    this.#acceptActive(request);
    this.#persist();
    return this.nextAction();
  }

  ingestCleanup(rawResponse: string): CalendarLiveV31NextAction {
    if (!this.#state.cleanupRequest)
      throw new Error("Calendar live v31 cleanup is not available");
    const request = requestFromPath(this.#state.cleanupRequest);
    persistCalendarLiveV31RawResponse(this.#directory, "cleanup", rawResponse);
    const ownership = writerOwnership(this.#directory);
    const accepted = acceptCalendarLiveV31Response(this.#directory, "cleanup", {
      validate: (payload) =>
        validateCalendarLiveV31CleanupPayload(payload, ownership),
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
      existsSync(calendarLiveV1ReceiptPath(this.#directory, "writer")) &&
      !existsSync(path.join(this.#directory, OWNERSHIP_FILE))
    ) {
      const raw = readCalendarLiveV31AcceptedRawPayload(this.#directory, "writer");
      writeNew(
        path.join(this.#directory, OWNERSHIP_FILE),
        validateCalendarLiveV31WriterPayload(raw),
      );
    }
    if (existsSync(calendarLiveV1RequestPath(this.#directory, "cleanup")))
      this.#state.cleanupRequest = calendarLiveV1RequestPath(
        this.#directory,
        "cleanup",
      );
    if (
      existsSync(path.join(this.#directory, OWNERSHIP_FILE)) &&
      !existsSync(calendarLiveV1RequestPath(this.#directory, "cleanup"))
    )
      this.#issueCleanupAndRestore(false);
    else if (
      existsSync(calendarLiveV1RequestPath(this.#directory, "cleanup")) &&
      !existsSync(calendarLiveV1RequestPath(this.#directory, "restore"))
    )
      this.#issueRestore(false);
    if (
      existsSync(calendarLiveV1RequestPath(this.#directory, "restore")) &&
      !existsSync(calendarLiveV1ReceiptPath(this.#directory, "restore"))
    )
      this.#state.activeRequest = calendarLiveV1RequestPath(
        this.#directory,
        "restore",
      );
    if (
      existsSync(calendarLiveV1ReceiptPath(this.#directory, "restore")) &&
      !existsSync(calendarLiveV1RequestPath(this.#directory, "extract"))
    ) {
      const ownership = writerOwnership(this.#directory);
      const extract = issueCalendarLiveV31Request(
        this.#directory,
        this.#privateKey,
        "extract",
        buildCalendarLiveV31ExtractProgram(ownership, this.#inputs.sources),
      );
      this.#state.activeRequest = calendarLiveV1RequestPath(
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
    if (existsSync(calendarLiveV1ReceiptPath(this.#directory, "cleanup")))
      this.#state.cleanupAccepted = true;
    this.#persist();
  }

  #acceptActive(request: CalendarLiveV31Request): void {
    if (request.phase === "writer") {
      const accepted = acceptCalendarLiveV31Response(this.#directory, "writer", {
        validate: validateCalendarLiveV31WriterPayload,
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
      const accepted = acceptCalendarLiveV31Response(this.#directory, "restore", {
        validate: (payload) =>
          validateCalendarLiveV31RestorePayload(payload, ownership),
      });
      appendJournal(
        this.#directory,
        this.#state,
        "response-accepted",
        request.requestId,
        { receiptSha256: accepted.receipt.receiptSha256 },
      );
      const extract = issueCalendarLiveV31Request(
        this.#directory,
        this.#privateKey,
        "extract",
        buildCalendarLiveV31ExtractProgram(ownership, this.#inputs.sources),
      );
      this.#state.activeRequest = calendarLiveV1RequestPath(
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
      const accepted = acceptCalendarLiveV31Response(this.#directory, "extract", {
        validate: (payload) =>
          validateCalendarLiveV31ExtractPayload(payload, ownership),
      });
      const proofs = proveCalendarLiveV31Roots(
        accepted.payload,
        this.#inputs.sources,
        collapseCalendarRecipe,
        compileCalendarRecipe,
      );
      assertCalendarLiveV31RootProofs(proofs);
      writeNew(path.join(this.#directory, ROOT_PROOFS_FILE), {
        artifactVersion: "calendar-live-v31-host-root-proofs-v1",
        extractReceiptSha256: accepted.receipt.receiptSha256,
        proofs,
      });
      appendJournal(
        this.#directory,
        this.#state,
        "host-normalize-account",
        request.requestId,
        { proofsSha256: calendarLiveV1Sha256(canonicalJson(proofs)) },
      );
      const next = issueCalendarLiveV31Request(
        this.#directory,
        this.#privateKey,
        "probe",
        buildCalendarLiveV31ProbeProgram(ownership, this.#inputs.sources),
      );
      this.#state.activeRequest = calendarLiveV1RequestPath(
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
      const accepted = acceptCalendarLiveV31Response(this.#directory, "probe", {
        validate: (payload) =>
          validateCalendarLiveV31ProbePayload(payload, ownership),
      });
      persistCalendarLiveV31TechnicalGates(
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
      if (!cell) throw new TypeError("Calendar live v31 capture cell missing");
      const accepted = acceptCalendarLiveV31Response(this.#directory, "capture", {
        captureIndex: cell.index,
        validate: (payload, rawBytes) =>
          validateCalendarLiveV31CapturePayload(payload, cell, rawBytes),
      });
      const png = Buffer.from(accepted.payload.pngBase64, "base64");
      const capturePath = path.join(
        this.#directory,
        "captures",
        `${String(cell.index).padStart(3, "0")}-${calendarLiveV1Sha256(cell.cellKey).slice(0, 20)}.png`,
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
      if (next < CALENDAR_LIVE_V31_CAPTURE_COUNT) this.#issueCapture(next);
      else {
        const responses = this.#readCaptureResponseIndex().map((response) => ({
          ...response,
          pngBase64: Buffer.from(
            readFileSync(
              path.join(
                this.#directory,
                "captures",
                `${String(response.index).padStart(3, "0")}-${calendarLiveV1Sha256(response.cellKey).slice(0, 20)}.png`,
              ),
            ),
          ).toString("base64"),
        }));
        assertCalendarLiveV31CaptureResponses(this.#inputs.captures, responses);
        const objective = evaluateCalendarLiveV31Objective(
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
            reportSha256: calendarLiveV1Sha256(canonicalJson(objective)),
            technicalPassed: objective.technicalPassed,
            overallCalendarSuccess: false,
            humanSignoff: "pending",
          },
        );
        this.#state.mainComplete = true;
        this.#state.activeRequest = null;
      }
      return;
    }
    throw new Error(`Calendar live v31 cleanup is not a main-lane request`);
  }

  #issueCleanupAndRestore(journal: boolean): void {
    const ownership = writerOwnership(this.#directory);
    const cleanup = issueCalendarLiveV31Request(
      this.#directory,
      this.#privateKey,
      "cleanup",
      buildCalendarLiveV31CleanupProgram(ownership),
    );
    this.#state.cleanupRequest = calendarLiveV1RequestPath(
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
    const restore = issueCalendarLiveV31Request(
      this.#directory,
      this.#privateKey,
      "restore",
      buildCalendarLiveV31RestoreProgram(ownership),
    );
    this.#state.activeRequest = calendarLiveV1RequestPath(
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
    const request = issueCalendarLiveV31Request(
      this.#directory,
      this.#privateKey,
      "capture",
      buildCalendarLiveV31CaptureProgram(
        writerOwnership(this.#directory),
        this.#inputs.captures[index]!,
      ),
      { captureIndex: index },
    );
    this.#state.activeRequest = calendarLiveV1RequestPath(
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

  #readCaptureResponseIndex(): CalendarLiveV31CapturePayload[] {
    const file = path.join(this.#directory, CAPTURE_RESPONSES_FILE);
    return existsSync(file) ? readJson(file) : [];
  }

  #writeCaptureResponseIndex(value: CalendarLiveV31CapturePayload[]): void {
    const file = path.join(this.#directory, CAPTURE_RESPONSES_FILE);
    writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  }

  #persist(): void {
    writeState(this.#directory, this.#state);
  }
}

export const simulatedCalendarLiveV31Authorization = (
  privateKey: KeyObject,
): CalendarLiveV31TransactionAuthorization => ({
  mode: "simulated",
  protocolCommit: "1".repeat(40),
  runnerCommit: "2".repeat(40),
  authorizationCommit: "3".repeat(40),
  codeCommit: "4".repeat(40),
  authorizationSha256: "5".repeat(64),
  protocolSha256: "6".repeat(64),
  runnerSha256: "7".repeat(64),
  codeTreeSha256: "8".repeat(64),
  signingPublicKeySha256: calendarLiveV1Sha256(
    createPublicKey(privateKey.export({ type: "pkcs8", format: "pem" })).export(
      { type: "spki", format: "der" },
    ),
  ),
});

export const generateCalendarLiveV31SimulationKey = (): KeyObject =>
  generateKeyPairSync("ed25519").privateKey;
