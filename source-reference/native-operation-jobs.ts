/** Durable, server-owned source-native operations. Transport executes the
 * returned command; it cannot choose its target, scope, script or expectations.
 * A native acknowledgement is retained before a separate observation is issued.
 * This first stage qualifies tokens only, never component fidelity or a Contract.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  closeSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { canonicalJson, revisionOf } from "../core/contract-provenance.js";
import {
  verifyNativeTokenContextReceipt,
  type NativeTokenIdentity,
} from "../core/native-token-context.js";
import {
  emitNativeTokenContextReadbackScript,
  emitNativeTokenContextScript,
  type NativeTokenCreationResult,
  type NativeTokenReadbackResult,
} from "../core/token-set.js";
import {
  isBindingEvidenceRequest,
  type BindingEvidenceRequest,
} from "./binding-evidence.js";
import type { VerifiedCandidateVisual } from "./candidate-jobs.js";
import type { CandidatePreparationReport } from "./candidate-report.js";
import { readCandidateVisualTokens } from "./candidate-visual-report.js";
import { prepareNativeSourceInspectionPlan } from "./native-source-plan.js";
import { readVerifiedRuntimeArtifact } from "./runtime-artifact.js";

/** The current owner-approved writable target. A request/plan cannot override it. */
export const SOURCE_NATIVE_FILE_KEY = "byMp6lt0Ij9b2QbkDGFwBh";
const POLICY = {
  version: 1,
  fileKey: SOURCE_NATIVE_FILE_KEY,
  ownership: "new-operation-only",
} as const;
type Plan = ReturnType<typeof prepareNativeSourceInspectionPlan>;
type Pin = { id: string; reportSha256: string };
export interface NativeOperationPreparation {
  visual: Pin;
  preparation: Pin;
  plan: Plan;
}
export type NativeOperationPhase = "token-create" | "token-readback";
export interface NativeOperationCommand {
  version: 1;
  kind: "SOURCE-NATIVE-OPERATION";
  operationId: string;
  phase: NativeOperationPhase;
  attemptId: string;
  nonce: string;
  fileKey: string;
  planRevision: string;
  scriptSha256: string;
  readOnly: boolean;
  script: string;
}
export interface NativeOperationResult {
  version: 1;
  operationId: string;
  phase: NativeOperationPhase;
  attemptId: string;
  nonce: string;
  fileKey: string;
  planRevision: string;
  scriptSha256: string;
  result: NativeTokenCreationResult | NativeTokenReadbackResult;
}
export interface NativeOperationSnapshot {
  id: string;
  operation: "source-native-inspection";
  phase:
    | "prepared"
    | "awaiting-native-result"
    | "tokens-created"
    | "partial-allocation"
    | "creation-refused"
    | "creation-invalid"
    | "tokens-observed"
    | "observation-refused"
    | "evidence-unavailable";
  pendingPhase?: NativeOperationPhase;
  nativeOutcome?: "unknown";
  sourceCurrent: boolean;
  acceptedContract: null;
  nativeQualification: "unqualified";
  counters: {
    variants: number;
    sourceCases: number;
    loweredCases: number;
    variables: number;
  };
  problems: string[];
}
interface Header {
  version: 1;
  id: string;
  startedAt: string;
  request: BindingEvidenceRequest;
  policy: typeof POLICY;
  visual: Pin;
  preparation: Pin;
  planRevision: string;
  planSha256: string;
  tokenScriptSha256: string;
}
type Dispatch = Omit<NativeOperationCommand, "script"> & { script: string };
type Event = {
  version: 1;
  sequence: number;
  previousSha256: string;
  recordedAt: string;
} & (
  | { kind: "dispatch"; command: Dispatch }
  | { kind: "result"; envelope: NativeOperationResult }
  | { kind: "abandon-observation"; attemptId: string }
  | { kind: "retry-refused-creation" }
);
interface State {
  phase: NativeOperationSnapshot["phase"];
  identity?: NativeTokenIdentity;
  pending?: NativeOperationCommand;
  problems: string[];
  dispatchedCreate: boolean;
}
export interface NativeOperationJobsOptions {
  /** Trusted in-process preparer. Reopens latest visual/source/runtime evidence
   * and compiles it for this exact host-allocated operation. Never an HTTP input. */
  prepare(
    request: BindingEvidenceRequest,
    operation: { id: string; fileKey: string },
  ): NativeOperationPreparation;
}

const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const HASH = /^[a-f0-9]{64}$/;
const REVISION = /^sha256:[a-f0-9]{64}$/;
// These are named branches before the first native allocation in the shared
// writer. A generic API exception may have happened during creation and is
// not proof of zero side effects, even when no allocated ID was returned.
const PREALLOCATION_REFUSALS = new Set([
  "native-token-write-file-mismatch",
  "native-token-write-api-unavailable",
  "native-token-write-inventory-unreadable",
  "native-token-write-collection-name-collision",
  "native-token-write-scope-collision",
  "native-token-write-ownership-unreadable",
]);
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const sha = (bytes: string | Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const encode = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
const object = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === "object" && !Array.isArray(value);
function fail(code: string): never {
  throw Error(`native-operation-${code}`);
}
const pin = (value: unknown): value is Pin =>
  object(value) &&
  UUID.test(value.id) &&
  HASH.test(value.reportSha256) &&
  Object.keys(value).length === 2;
const date = (value: unknown): value is string =>
  typeof value === "string" && new Date(value).toISOString() === value;

/** Production preparer: it only reads the manager's already verified private
 * artifact. The retained source runtime is never imported or executed here. */
export function prepareVerifiedNativeOperation(
  repoRoot: string,
  selected: VerifiedCandidateVisual,
  operation: { id: string; fileKey: string },
): NativeOperationPreparation {
  if (
    selected.report.version !== 3 ||
    selected.report.status !== "measured-candidate"
  )
    fail("visual-unavailable");
  const preparation = selected.preparation;
  const report = preparation.report as CandidatePreparationReport;
  const revision = report.runtime.artifactRevision;
  if (!REVISION.test(revision)) fail("runtime-unavailable");
  const artifact = readVerifiedRuntimeArtifact(
    path.join(preparation.directory, "runtime", revision.slice(7)),
    revision,
  );
  return {
    visual: { id: selected.id, reportSha256: selected.reportSha256 },
    preparation: { id: preparation.id, reportSha256: preparation.reportSha256 },
    plan: prepareNativeSourceInspectionPlan({
      operation,
      source: {
        preparation: { ...preparation, report },
        selection: selected.selection,
        expectedReportRevision: revisionOf(selected.report),
        tokens: readCandidateVisualTokens(repoRoot),
        artifact: {
          artifactRevision: artifact.artifactRevision,
          interfaceRevision: artifact.interfaceRevision,
          registrationTag: artifact.registrationTag,
          interface: artifact.manifest.interface,
          stylesheets: artifact.manifest.files
            .filter((f) => f.kind === "stylesheet")
            .map((f) => f.path),
        },
      },
    }),
  };
}

export function createNativeOperationJobs(
  repoRoot: string,
  options: NativeOperationJobsOptions,
) {
  const privateRoot = path.join(repoRoot, "private");
  const root = path.join(privateRoot, "source-native-app");
  const operations = path.join(root, "operations"),
    baselines = path.join(root, "baselines");
  const present = (target: string) => {
    try {
      lstatSync(target);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  };
  const dir = (id: string) => {
    if (!UUID.test(id)) fail("id-invalid");
    return path.join(operations, id);
  };
  const ensure = (target: string, create = false) => {
    if (create && !present(target)) {
      mkdirSync(target, { mode: 0o700 });
      syncDir(path.dirname(target));
    }
    if (!lstatSync(target).isDirectory()) fail("directory-refused");
  };
  const directories = (create = false) => {
    for (const target of [privateRoot, root, operations, baselines])
      ensure(target, create);
  };
  const bytes = (file: string) => {
    // Every parent is one of our fixed directories, never supplied by a request.
    if (!lstatSync(file).isFile()) fail("artifact-refused");
    const data = readFileSync(file);
    if (data.length > 8 * 1024 * 1024) fail("artifact-too-large");
    return data;
  };
  const syncDir = (target: string) => {
    const fd = openSync(target, "r");
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  };
  const write = (file: string, value: string) => {
    const fd = openSync(file, "wx", 0o600);
    try {
      writeFileSync(fd, value);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    syncDir(path.dirname(file));
  };
  const pointer = (baseline: string) => {
    if (!UUID.test(baseline)) fail("request-invalid");
    return path.join(baselines, `${baseline}.json`);
  };
  const priorBaseline = (baseline: string) => {
    for (const id of readdirSync(operations)) {
      if (!UUID.test(id)) continue;
      ensure(dir(id));
      const header = JSON.parse(
        bytes(path.join(dir(id), "operation.json")).toString(),
      ) as Header;
      if (!isBindingEvidenceRequest(header.request))
        fail("history-unavailable");
      if (header.request.baseline.id === baseline) return true;
    }
    return false;
  };
  const validatePlan = (prepared: NativeOperationPreparation, id: string) => {
    const plan = prepared.plan;
    if (
      !pin(prepared.visual) ||
      !pin(prepared.preparation) ||
      !plan ||
      plan.plan.version !== 1 ||
      plan.revision !== revisionOf(plan.plan) ||
      plan.plan.acceptedContract !== null ||
      plan.plan.nativeQualification !== "unqualified" ||
      plan.plan.purpose !== "source-candidate-inspection" ||
      !same(plan.plan.operation, { id, fileKey: SOURCE_NATIVE_FILE_KEY }) ||
      plan.plan.tokenInput.fileKey !== SOURCE_NATIVE_FILE_KEY ||
      plan.plan.tokenInput.scopeId !== `source-${id}`
    )
      fail("preparation-invalid");
  };
  const validatePreparation = (
    prepared: NativeOperationPreparation,
    id: string,
  ) => {
    validatePlan(prepared, id);
    const plan = prepared.plan;
    const compiled = emitNativeTokenContextScript(plan.plan.tokenInput);
    if (!same(compiled.preparation, plan.plan.tokenPreparation))
      fail("token-preparation-changed");
    return compiled.script;
  };
  const correlate = (
    envelope: NativeOperationResult,
    command: NativeOperationCommand,
  ) => {
    if (
      !object(envelope) ||
      !object(envelope.result) ||
      !same(
        Object.keys(envelope).sort(),
        [
          "version",
          "operationId",
          "phase",
          "attemptId",
          "nonce",
          "fileKey",
          "planRevision",
          "scriptSha256",
          "result",
        ].sort(),
      )
    )
      fail("result-envelope-invalid");
    for (const key of [
      "version",
      "operationId",
      "phase",
      "attemptId",
      "nonce",
      "fileKey",
      "planRevision",
      "scriptSha256",
    ] as const)
      if (envelope[key] !== command[key]) fail("result-correlation-mismatch");
  };
  const acceptCreation = (
    result: NativeTokenCreationResult,
    plan: Plan,
  ): Pick<State, "phase" | "identity" | "problems"> => {
    const invalid = {
      phase: "creation-invalid" as const,
      problems: ["native-operation-creation-result-invalid"],
    };
    if (
      !object(result) ||
      result.version !== 1 ||
      result.acceptedContract !== null ||
      result.nativeQualification !== "unqualified" ||
      result.preparationRevision !== plan.plan.tokenPreparation.revision ||
      result.receiptKind !== "creation-objects-only" ||
      !Array.isArray(result.problems) ||
      !["created-candidate", "partial-allocation", "refused"].includes(
        result.status,
      ) ||
      !object(result.allocation) ||
      !Array.isArray(result.allocation.variables) ||
      !Array.isArray(result.allocation.modes)
    )
      return invalid;
    if (result.status === "refused")
      return result.allocation.collection === null &&
        !result.creationIdentity &&
        !result.allocation.variables.length &&
        !result.allocation.modes.length &&
        result.problems.length === 1 &&
        PREALLOCATION_REFUSALS.has(result.problems[0])
        ? {
            phase: "creation-refused",
            problems: ["native-operation-native-creation-refused"],
          }
        : invalid;
    if (!object(result.allocation.collection)) return invalid;
    const identity = result.creationIdentity;
    if (identity) {
      if (
        identity.origin !== "created" ||
        !same(identity.collection, result.allocation.collection) ||
        !same(identity.modes, result.allocation.modes) ||
        !same(identity.variables, result.allocation.variables)
      )
        return invalid;
      try {
        emitNativeTokenContextReadbackScript(plan.plan.tokenInput, identity);
      } catch {
        return invalid;
      }
    }
    if (
      result.status === "created-candidate" &&
      (!identity ||
        result.created !== plan.plan.tokenPreparation.variables.length ||
        result.problems.length)
    )
      return invalid;
    return {
      phase:
        result.status === "created-candidate"
          ? "tokens-created"
          : "partial-allocation",
      ...(identity ? { identity: structuredClone(identity) } : {}),
      problems:
        result.status === "partial-allocation"
          ? ["native-operation-partial-allocation-retained"]
          : [],
    };
  };
  const observe = (
    result: NativeTokenReadbackResult,
    identity: NativeTokenIdentity,
    plan: Plan,
  ): Pick<State, "phase" | "problems"> => {
    if (
      !object(result) ||
      result.version !== 1 ||
      result.status !== "readback-collected" ||
      result.acceptedContract !== null ||
      result.nativeQualification !== "unqualified" ||
      result.receiptKind !== "independent-native-readback" ||
      result.preparationRevision !== plan.plan.tokenPreparation.revision ||
      !result.receipt ||
      !Array.isArray(result.problems) ||
      result.problems.length
    )
      return {
        phase: "observation-refused",
        problems: ["native-operation-readback-refused"],
      };
    const checked = verifyNativeTokenContextReceipt({
      input: plan.plan.tokenInput,
      expectedIdentity: identity,
      receipt: result.receipt,
    });
    return checked.status === "native-token-context-observed"
      ? { phase: "tokens-observed", problems: [] }
      : {
          phase: "observation-refused",
          problems: ["native-operation-native-token-drift"],
        };
  };
  const load = (id: string) => {
    directories();
    ensure(dir(id));
    ensure(path.join(dir(id), "events"));
    const headerBytes = bytes(path.join(dir(id), "operation.json"));
    const header = JSON.parse(headerBytes.toString()) as Header;
    if (
      !object(header) ||
      header.version !== 1 ||
      header.id !== id ||
      !date(header.startedAt) ||
      !isBindingEvidenceRequest(header.request) ||
      !same(header.policy, POLICY) ||
      !pin(header.visual) ||
      !pin(header.preparation) ||
      !REVISION.test(header.planRevision) ||
      !HASH.test(header.planSha256) ||
      !HASH.test(header.tokenScriptSha256)
    )
      fail("header-invalid");
    // Atomic publication reserves exactly one operation for a source baseline.
    // Unpublished partial preparations can never dispatch. They remain on disk.
    if (!bytes(pointer(header.request.baseline.id)).equals(headerBytes))
      fail("baseline-reservation-mismatch");
    const planBytes = bytes(path.join(dir(id), "plan.json"));
    const scriptBytes = bytes(path.join(dir(id), "token-create.js"));
    if (
      sha(planBytes) !== header.planSha256 ||
      sha(scriptBytes) !== header.tokenScriptSha256
    )
      fail("artifact-changed");
    const plan = JSON.parse(planBytes.toString()) as Plan;
    validatePlan(
      { visual: header.visual, preparation: header.preparation, plan },
      id,
    );
    if (plan.revision !== header.planRevision) fail("compiled-plan-changed");
    // Historical commands are immutable evidence. Recompiling them with a new
    // writer must not prevent retention of a delayed native acknowledgement.
    // Fresh compilation is mandatory before any new creation is dispatched.
    const script = scriptBytes.toString();
    const entries = readdirSync(path.join(dir(id), "events")).sort();
    const claimPath = path.join(dir(id), "creation.json");
    const claimBytes = present(claimPath) ? bytes(claimPath) : null;
    if (!!claimBytes !== !!entries.length) fail("creation-journal-incomplete");
    const claim = claimBytes ? JSON.parse(claimBytes.toString()) : null;
    const events: Event[] = [];
    const digests: string[] = [];
    let previous = sha(headerBytes);
    const state: State = {
      phase: "prepared",
      problems: [],
      dispatchedCreate: false,
    };
    const attempts = new Set<string>(),
      nonces = new Set<string>();
    for (const [sequence, file] of entries.entries()) {
      if (file !== `${String(sequence).padStart(8, "0")}.json`)
        fail("journal-sequence-invalid");
      const data = bytes(path.join(dir(id), "events", file));
      const event = JSON.parse(data.toString()) as Event;
      if (
        !object(event) ||
        event.version !== 1 ||
        event.sequence !== sequence ||
        event.previousSha256 !== previous ||
        !date(event.recordedAt)
      )
        fail("journal-chain-invalid");
      if (event.kind === "dispatch") {
        const c = event.command;
        if (sequence === 0 && (!same(c, claim) || c.phase !== "token-create"))
          fail("creation-claim-mismatch");
        if (
          state.pending ||
          !object(c) ||
          c.version !== 1 ||
          c.kind !== "SOURCE-NATIVE-OPERATION" ||
          c.operationId !== id ||
          c.fileKey !== SOURCE_NATIVE_FILE_KEY ||
          c.planRevision !== plan.revision ||
          !UUID.test(c.attemptId) ||
          !HASH.test(c.nonce) ||
          attempts.has(c.attemptId) ||
          nonces.has(c.nonce) ||
          typeof c.script !== "string" ||
          sha(c.script) !== c.scriptSha256
        )
          fail("dispatch-invalid");
        if (c.phase === "token-create") {
          if (
            state.dispatchedCreate ||
            c.readOnly !== false ||
            c.script !== script
          )
            fail("creation-replay-refused");
          state.dispatchedCreate = true;
        } else if (c.phase === "token-readback") {
          if (!state.identity || c.readOnly !== true)
            fail("observation-precondition-invalid");
        } else fail("phase-invalid");
        attempts.add(c.attemptId);
        nonces.add(c.nonce);
        state.pending = c;
        state.phase = "awaiting-native-result";
        state.problems = [];
      } else if (event.kind === "result") {
        if (!state.pending) fail("unsolicited-result");
        correlate(event.envelope, state.pending);
        const outcome =
          state.pending.phase === "token-create"
            ? acceptCreation(
                event.envelope.result as NativeTokenCreationResult,
                plan,
              )
            : observe(
                event.envelope.result as NativeTokenReadbackResult,
                state.identity!,
                plan,
              );
        Object.assign(state, outcome);
        delete state.pending;
      } else if (event.kind === "abandon-observation") {
        if (
          state.pending?.phase !== "token-readback" ||
          state.pending.attemptId !== event.attemptId
        )
          fail("observation-abandon-refused");
        delete state.pending;
        state.phase = "observation-refused";
        state.problems = ["native-operation-observation-interrupted"];
      } else if (event.kind === "retry-refused-creation") {
        if (
          state.pending ||
          state.identity ||
          state.phase !== "creation-refused"
        )
          fail("creation-retry-refused");
        state.dispatchedCreate = false;
        state.phase = "prepared";
        state.problems = [];
      } else fail("journal-event-invalid");
      previous = sha(data);
      digests.push(previous);
      events.push(event);
    }
    const fingerprint = sha(
      encode({
        header: sha(headerBytes),
        plan: sha(planBytes),
        script: sha(scriptBytes),
        claim: claimBytes ? sha(claimBytes) : null,
        digests,
      }),
    );
    return { header, plan, script, state, events, previous, fingerprint };
  };
  type Loaded = ReturnType<typeof load>;
  const authenticate = (loaded: Loaded) => {
    const current = options.prepare(structuredClone(loaded.header.request), {
      id: loaded.header.id,
      fileKey: SOURCE_NATIVE_FILE_KEY,
    });
    if (validatePreparation(current, loaded.header.id) !== loaded.script)
      fail("compiled-script-changed");
    if (
      !same(current.visual, loaded.header.visual) ||
      !same(current.preparation, loaded.header.preparation) ||
      !same(current.plan, loaded.plan)
    )
      fail("source-plan-stale");
    if (load(loaded.header.id).fingerprint !== loaded.fingerprint)
      fail("evidence-changed-during-validation");
  };
  const snapshot = (
    loaded: Loaded,
    sourceCurrent: boolean,
  ): NativeOperationSnapshot => ({
    id: loaded.header.id,
    operation: "source-native-inspection",
    phase: loaded.state.phase,
    ...(loaded.state.pending
      ? {
          pendingPhase: loaded.state.pending.phase,
          nativeOutcome: "unknown" as const,
        }
      : {}),
    ...(loaded.state.phase === "creation-invalid"
      ? { nativeOutcome: "unknown" as const }
      : {}),
    sourceCurrent,
    acceptedContract: null,
    nativeQualification: "unqualified",
    counters: {
      variants: loaded.plan.plan.component.variants.length,
      sourceCases: loaded.plan.plan.samples.cases.length,
      loweredCases: loaded.plan.plan.samples.cases.filter(
        (c) => c.status === "lowered",
      ).length,
      variables: loaded.plan.plan.tokenPreparation.variables.length,
    },
    problems: [
      ...loaded.state.problems,
      ...(!sourceCurrent
        ? ["native-operation-source-evidence-unavailable"]
        : []),
    ],
  });
  const current = (loaded: Loaded) => {
    try {
      authenticate(loaded);
      return true;
    } catch {
      return false;
    }
  };
  const append = (
    loaded: Loaded,
    event:
      | { kind: "dispatch"; command: Dispatch }
      | { kind: "result"; envelope: NativeOperationResult }
      | { kind: "abandon-observation"; attemptId: string }
      | { kind: "retry-refused-creation" },
  ) => {
    if (load(loaded.header.id).fingerprint !== loaded.fingerprint)
      fail("journal-changed");
    const sequence = loaded.events.length;
    if (sequence === 0) {
      if (event.kind !== "dispatch" || event.command.phase !== "token-create")
        fail("first-dispatch-invalid");
      // This marker lives outside the event directory. Deleting/truncating a
      // history cannot turn an already-dispatched operation back into prepared.
      write(
        path.join(dir(loaded.header.id), "creation.json"),
        encode(event.command),
      );
    }
    // Exclusive creation makes concurrent dispatch/result appends compete for
    // one sequence. No command is returned until its event is durable.
    write(
      path.join(
        dir(loaded.header.id),
        "events",
        `${String(sequence).padStart(8, "0")}.json`,
      ),
      encode({
        version: 1,
        sequence,
        previousSha256: loaded.previous,
        recordedAt: new Date().toISOString(),
        ...event,
      }),
    );
  };
  const prepare = (
    request: BindingEvidenceRequest,
  ): NativeOperationSnapshot => {
    if (!isBindingEvidenceRequest(request)) fail("request-invalid");
    directories(true);
    const target = pointer(request.baseline.id);
    if (present(target)) {
      const header = JSON.parse(bytes(target).toString()) as Header;
      if (!same(header.request, request)) fail("baseline-already-reserved");
      const loaded = load(header.id);
      authenticate(loaded);
      return snapshot(loaded, true);
    }
    // A missing index is not permission to create a replacement scope. An
    // earlier prepared/dispatched operation may still own native objects.
    if (priorBaseline(request.baseline.id))
      fail("baseline-reservation-missing");
    const id = randomUUID();
    const prepared = options.prepare(structuredClone(request), {
      id,
      fileKey: SOURCE_NATIVE_FILE_KEY,
    });
    const script = validatePreparation(prepared, id),
      planBytes = encode(prepared.plan);
    const header: Header = {
      version: 1,
      id,
      startedAt: new Date().toISOString(),
      request: structuredClone(request),
      policy: POLICY,
      visual: prepared.visual,
      preparation: prepared.preparation,
      planRevision: prepared.plan.revision,
      planSha256: sha(planBytes),
      tokenScriptSha256: sha(script),
    };
    // Recheck source before publishing any executable operation identity.
    if (
      !same(
        options.prepare(structuredClone(request), {
          id,
          fileKey: SOURCE_NATIVE_FILE_KEY,
        }),
        prepared,
      )
    )
      fail("source-changed-during-preparation");
    mkdirSync(dir(id), { mode: 0o700 });
    syncDir(operations);
    mkdirSync(path.join(dir(id), "events"), { mode: 0o700 });
    write(path.join(dir(id), "plan.json"), planBytes);
    write(path.join(dir(id), "token-create.js"), script);
    write(path.join(dir(id), "operation.json"), encode(header));
    // Hard-link publication is atomic and exclusive, including across server
    // processes. A competing unpublished directory is retained, never applied.
    try {
      linkSync(path.join(dir(id), "operation.json"), target);
      syncDir(baselines);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST")
        return prepare(request);
      throw error;
    }
    return snapshot(load(id), true);
  };
  const get = (id: string): NativeOperationSnapshot => {
    const loaded = load(id);
    return snapshot(loaded, current(loaded));
  };
  const forBaseline = (baseline: string): NativeOperationSnapshot | null => {
    if (!present(root)) return null;
    try {
      directories();
      const target = pointer(baseline);
      if (!present(target)) {
        if (priorBaseline(baseline)) fail("baseline-reservation-missing");
        return null;
      }
      const header = JSON.parse(bytes(target).toString());
      return get(header.id);
    } catch {
      return {
        id: baseline,
        operation: "source-native-inspection",
        phase: "evidence-unavailable",
        sourceCurrent: false,
        acceptedContract: null,
        nativeQualification: "unqualified",
        counters: {
          variants: 0,
          sourceCases: 0,
          loweredCases: 0,
          variables: 0,
        },
        problems: ["native-operation-journal-unavailable"],
      };
    }
  };
  const dispatch = (
    id: string,
    phase: NativeOperationPhase,
  ): NativeOperationCommand => {
    const loaded = load(id);
    if (loaded.state.pending) fail("native-outcome-unknown");
    let script: string;
    if (phase === "token-create") {
      if (loaded.state.dispatchedCreate) fail("creation-already-dispatched");
      authenticate(loaded);
      script = loaded.script;
    } else if (phase === "token-readback") {
      if (!loaded.state.identity) fail("allocation-identity-unavailable");
      // Readback remains available for known allocations after source changes.
      // It cannot authorize a write or advance a source/component baseline.
      script = emitNativeTokenContextReadbackScript(
        loaded.plan.plan.tokenInput,
        loaded.state.identity,
      );
    } else fail("phase-invalid");
    const command: NativeOperationCommand = {
      version: 1,
      kind: "SOURCE-NATIVE-OPERATION",
      operationId: id,
      phase,
      attemptId: randomUUID(),
      nonce: randomBytes(32).toString("hex"),
      fileKey: SOURCE_NATIVE_FILE_KEY,
      planRevision: loaded.plan.revision,
      scriptSha256: sha(script),
      readOnly: phase === "token-readback",
      script,
    };
    append(loaded, { kind: "dispatch", command });
    return structuredClone(command);
  };
  const accept = (
    id: string,
    envelope: NativeOperationResult,
  ): NativeOperationSnapshot => {
    const serialized = encode(envelope);
    if (serialized.length > 4 * 1024 * 1024) fail("result-too-large");
    // Validate the bytes that will actually persist, including omission of
    // undefined fields in an in-process transport's malformed response.
    envelope = JSON.parse(serialized) as NativeOperationResult;
    const loaded = load(id);
    const prior = loaded.events.find(
      (e) =>
        e.kind === "result" && e.envelope.attemptId === envelope?.attemptId,
    );
    if (prior?.kind === "result") {
      if (!same(prior.envelope, envelope)) fail("result-replay-conflict");
      return snapshot(loaded, current(loaded));
    }
    if (!loaded.state.pending) fail("unsolicited-result");
    correlate(envelope, loaded.state.pending);
    // Preserve the native acknowledgement even when fresh source validation
    // fails: allocated IDs must never be lost because the source moved meanwhile.
    append(loaded, { kind: "result", envelope: structuredClone(envelope) });
    const next = load(id);
    return snapshot(next, current(next));
  };
  const retryObservation = (id: string) => {
    const loaded = load(id);
    if (loaded.state.pending?.phase !== "token-readback")
      fail("observation-retry-refused");
    append(loaded, {
      kind: "abandon-observation",
      attemptId: loaded.state.pending.attemptId,
    });
    return dispatch(id, "token-readback");
  };
  const retryCreation = (id: string) => {
    const loaded = load(id);
    if (
      loaded.state.pending ||
      loaded.state.identity ||
      loaded.state.phase !== "creation-refused"
    )
      fail("creation-retry-refused");
    authenticate(loaded);
    append(loaded, { kind: "retry-refused-creation" });
    return dispatch(id, "token-create");
  };
  return {
    prepare,
    get,
    forBaseline,
    dispatch,
    accept,
    retryObservation,
    retryCreation,
  };
}
