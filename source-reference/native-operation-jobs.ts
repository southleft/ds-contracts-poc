import {nativeDefaultFillRepairBaseline} from '../core/native-contract-default-fill-update.js';
import {rebaseComparisonCreation} from '../core/native-comparison-main-migration.js';
import {prepareNativeComparisonMigrationRepair} from '../core/native-comparison-migration-repair.js';
import {assertOutsideEvidenceSnapshot} from './evidence-read-snapshot.js';
import {refreshedComparisonPlan,type ReactComparisonRefresh} from './react-comparison-refresh.js';
import { prepareNativeComparisonFrameRepair, prepareNativeComparisonRepair, emitNativeComparisonRepairScript, nativeComparisonRepairMatches, type NativeComparisonRepairPlan } from '../core/native-comparison-repair.js';
import { emitNativeComparisonRecoveryReadbackScript, prepareNativeComparisonRecovery, type PreparedNativeComparisonRecovery } from '../core/native-comparison-recovery.js';
import { isReactInitialNativeRequest, reactInitialNativeReservation, type ReactInitialNativeRequest } from './react-initial-native-request.js';
import type { prepareReactInitialNativePlan } from './react-initial-native-plan.js';
import { isReactComparisonRequest, reactComparisonReservation, type ReactComparisonRequest } from './react-comparison-request.js';
import type { prepareReactComparisonPlan } from './react-comparison-plan.js';
import { emitNativeContractComparisonReadbackScript, verifyNativeContractComparisonReadback, type NativeContractComparisonObservationInput } from '../core/native-contract-comparison-observation.js';
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
  unlinkSync,
} from "node:fs";
import path from "node:path";
import {
  collectNativeImages,
  collectExpectedNativeImages,
  type NativeImageObservation,
} from "./native-operation-images.js";
import { canonicalJson, revisionOf } from "../core/contract-provenance.js";
import {
  verifyNativeTokenContextReceipt,
  type NativeTokenIdentity,
} from "../core/native-token-context.js";
import {
  emitNativeInspectionReadbackScript,
  verifyNativeInspectionReadback,
  type NativeSourceObservationInput,
  type NativeInspectionInput,
} from "../core/native-source-observation.js";
import type { NativeSourceWriteContext } from "../core/native-source-write.js";
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
import {
  prepareNativeSourceInspectionPlan,
  buildNativeSourceComponentWrite,
} from "./native-source-plan.js";
import { readVerifiedRuntimeArtifact } from "./runtime-artifact.js";
import type { prepareReactNativePlan } from './react-native-plan.js';
import { isReactNativeRequest, reactNativeReservation, type ReactNativeRequest } from './react-native-request.js';
import type { prepareReactCallerNativePlan } from './react-caller-native-plan.js';
import { isReactCallerNativeRequest, reactCallerNativeReservation, type ReactCallerNativeRequest } from './react-caller-native-request.js';

/** The current owner-approved writable target. A request/plan cannot override it. */
export const SOURCE_NATIVE_FILE_KEY = "byMp6lt0Ij9b2QbkDGFwBh";
/** Owner-supplied evaluation file, only for new React operation identities. */
export const REACT_NATIVE_FILE_KEY = 'T56aKuRnoay1L7CKAjSWRO';
const POLICY = {
  version: 1,
  fileKey: SOURCE_NATIVE_FILE_KEY,
  ownership: "new-operation-only",
} as const;
type SourcePlan = ReturnType<typeof prepareNativeSourceInspectionPlan>;
type ReactPlan = ReturnType<typeof prepareReactNativePlan>;
type CallerGraphPlan = ReturnType<typeof prepareReactCallerNativePlan>;
type ComparisonPlan = ReturnType<typeof prepareReactComparisonPlan>;
type InitialPlan = ReturnType<typeof prepareReactInitialNativePlan>;
type Plan = SourcePlan | ReactPlan | CallerGraphPlan | ComparisonPlan | InitialPlan;
const isInitialPlan = (p: Plan): p is InitialPlan => 'kind' in p.plan && p.plan.kind === 'react-initial-draft-inspection';
const isComparisonPlan = (p: Plan): p is ComparisonPlan => 'kind' in p.plan && p.plan.kind === 'react-content-comparison';
type OperationRequest = BindingEvidenceRequest | ReactNativeRequest | ReactCallerNativeRequest | ReactComparisonRequest | ReactInitialNativeRequest;
const validRequest = (v: unknown): v is OperationRequest => isBindingEvidenceRequest(v) || isReactNativeRequest(v) || isReactCallerNativeRequest(v) || isReactComparisonRequest(v) || isReactInitialNativeRequest(v);
const reservation = (r: OperationRequest) => isReactInitialNativeRequest(r) ? reactInitialNativeReservation(r) : isReactComparisonRequest(r) ? reactComparisonReservation(r) : isReactCallerNativeRequest(r) ? reactCallerNativeReservation(r) : isReactNativeRequest(r) ? reactNativeReservation(r) : r.baseline.id;
const policyFor = (r: OperationRequest) => ({ ...POLICY, fileKey: isReactNativeRequest(r) || isReactCallerNativeRequest(r) || isReactComparisonRequest(r) || isReactInitialNativeRequest(r) ? REACT_NATIVE_FILE_KEY : SOURCE_NATIVE_FILE_KEY });
const isReactPlan = (p: Plan): p is ReactPlan | CallerGraphPlan | InitialPlan => 'kind' in p.plan && (p.plan.kind === 'react-root-draft-inspection' || p.plan.kind === 'react-caller-graph-draft-inspection' || p.plan.kind === 'react-initial-draft-inspection');
type Pin = { id: string; reportSha256: string };
export interface NativeOperationPreparation<P extends Plan = SourcePlan> {
  visual: Pin;
  preparation: Pin;
  plan: P;
  sourceCompatibility?: 'identity-opacity-omission';
}
export type NativeOperationPhase =
  "token-create" | "token-readback" | "component-create" | "component-readback"
  | "update-preflight-readback" | "update-apply" | "update-readback" | "comparison-recovery-readback" | "comparison-recovery-apply" | "comparison-repair-preflight-readback" | "comparison-repair-apply";
export interface NativeOperationComponentContext {
  operation: NativeSourceWriteContext["operation"];
  tokens: NativeSourceWriteContext["tokens"];
  planRevision: string;
  journalRevision: string;
  comparisonRecovery?: PreparedNativeComparisonRecovery;
}
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
  result:
    | NativeTokenCreationResult
    | NativeTokenReadbackResult
    | Record<string, unknown>;
}
export interface NativeOperationSnapshot {
  comparisonBaselineRefreshed?: boolean;
  id: string;
  componentName?: string;
  sourceOwnedContent?: boolean;
  comparisonWidth?: number;
  canResumeComparison?: boolean;
  comparisonRepair?: {changes: NativeComparisonRepairPlan["changes"]};
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
    | "components-created"
    | "component-structure-observed"
    | "component-observation-refused"
    | "component-creation-refused"
    | "component-creation-invalid"
    | "comparison-recovery-observed"
    | "comparison-recovery-refused"
    | "comparison-repair-observed"
    | "comparison-repair-refused"
    | "component-partial-allocation"
    | "evidence-unavailable";
  structuralObservation?: {
    scope: "supported-structure";
    status: "supported-structure-observed" | "supported-comparison-structure-observed" | "refused";
    limitations: string[];
  };
  imageObservation?: NativeImageObservation & { attemptId: string };
  pendingPhase?: NativeOperationPhase;
  nativeOutcome?: "unknown";
  sourceCurrent: boolean;
  sourceCompilerRecompiled?: boolean;
  sourceCompatibility?: 'identity-opacity-omission';
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
  request: OperationRequest;
  policy: ReturnType<typeof policyFor>;
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
  | { kind: "dispatch"; command: Dispatch; comparisonRepair?: NativeComparisonRepairPlan; comparisonRefresh?: ReactComparisonRefresh }
  | { kind: "result"; envelope: NativeOperationResult }
  | { kind: "abandon-observation"; attemptId: string }
  | { kind: "retry-refused-creation" }
);
interface State {
  phase: NativeOperationSnapshot["phase"];
  identity?: NativeTokenIdentity;
  componentCreation?: Record<string, any>;
  allocationAnchor?: NativeSourceObservationInput["allocationAnchor"];
  componentObservation?: ReturnType<typeof verifyNativeInspectionReadback> | ReturnType<typeof verifyNativeContractComparisonReadback>;
  imageReadback?: NativeOperationResult;
  pending?: NativeOperationCommand;
  problems: string[];
  dispatchedCreate: boolean;
  dispatchedComponent: boolean;
  partialCreation?: Record<string, any>;
  recovery?: PreparedNativeComparisonRecovery;
  recoveryWritten?: boolean;
  comparisonRepair?: NativeComparisonRepairPlan;
  comparisonMigration?:NativeComparisonRepairPlan;
  repairWritten?: boolean;
  repairRevisionsWritten?: string[];
  comparisonRefresh?: ReactComparisonRefresh;
}
export interface NativeOperationJobsOptions {
  reactInitial?: {
    prepare(request: ReactInitialNativeRequest, operation: { id: string; fileKey: string }): NativeOperationPreparation<InitialPlan>;
    buildComponent(request: ReactInitialNativeRequest, context: NativeOperationComponentContext): { planRevision: string; script: string };
  };
  reactComparison?: {
    refresh?(request: ReactComparisonRequest, operation: { id: string; fileKey: string }): ReactComparisonRefresh;
    prepare(request: ReactComparisonRequest, operation: { id: string; fileKey: string }): NativeOperationPreparation<ComparisonPlan>;
    buildComponent(request: ReactComparisonRequest, context: NativeOperationComponentContext): { planRevision: string; script: string };
  };
  react?: {
    updatedObservation?(id: string): { input: import('../core/native-source-observation.js').NativeContractObservationInput;
      receipt: import('../core/native-source-observation.js').NativeSourceReadback } | undefined;
    prepare(request: ReactNativeRequest, operation: { id: string; fileKey: string }): NativeOperationPreparation<ReactPlan>;
    buildComponent(request: ReactNativeRequest, context: NativeOperationComponentContext): { planRevision: string; script: string };
  };
  reactCaller?: {
    prepare(request: ReactCallerNativeRequest, operation: { id: string; fileKey: string }): NativeOperationPreparation<CallerGraphPlan>;
    buildComponent(request: ReactCallerNativeRequest, context: NativeOperationComponentContext): { planRevision: string; script: string };
  };
  /** Trusted in-process preparer. Reopens latest visual/source/runtime evidence
   * and compiles it for this exact host-allocated operation. Never an HTTP input. */
  prepare(
    request: BindingEvidenceRequest,
    operation: { id: string; fileKey: string },
  ): NativeOperationPreparation;
  /** Host-authenticated source rederivation and existing shared renderer. */
  buildComponent?(
    request: BindingEvidenceRequest,
    context: NativeOperationComponentContext,
  ): { planRevision: string; script: string };
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
  const source = readVerifiedNativeSource(repoRoot, selected);
  return {
    visual: { id: selected.id, reportSha256: selected.reportSha256 },
    preparation: {
      id: selected.preparation.id,
      reportSha256: selected.preparation.reportSha256,
    },
    plan: prepareNativeSourceInspectionPlan({ operation, source }),
  };
}

export function prepareVerifiedNativeComponentWrite(
  repoRoot: string,
  selected: VerifiedCandidateVisual,
  context: NativeOperationComponentContext,
) {
  if (context.operation.fileKey !== SOURCE_NATIVE_FILE_KEY)
    fail("write-policy-refused");
  return buildNativeSourceComponentWrite({
    source: readVerifiedNativeSource(repoRoot, selected),
    operation: context.operation,
    tokens: context.tokens,
    expectedPlanRevision: context.planRevision,
  });
}

function readVerifiedNativeSource(
  repoRoot: string,
  selected: VerifiedCandidateVisual,
) {
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
  };
}

export function createNativeOperationJobs(
  repoRoot: string,
  options: NativeOperationJobsOptions,
) {
  const prepareInput = (request: OperationRequest, operation: {id: string; fileKey: string}): NativeOperationPreparation<Plan> => {
    if (isReactInitialNativeRequest(request)) {
      if (!options.reactInitial) fail('react-initial-adapter-unavailable');
      return options.reactInitial.prepare(request, operation);
    }
    if (isReactComparisonRequest(request)) {
      if (!options.reactComparison) fail('react-comparison-adapter-unavailable');
      return options.reactComparison.prepare(request, operation);
    }
    if (isReactCallerNativeRequest(request)) {
      if (!options.reactCaller) fail('react-caller-adapter-unavailable');
      return options.reactCaller.prepare(request, operation);
    }
    if (isReactNativeRequest(request)) {
      if (!options.react) fail('react-adapter-unavailable');
      return options.react.prepare(request, operation);
    }
    return options.prepare(request, operation);
  };
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
  const write = (file: string, value: string | Buffer) => {
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
      if (!validRequest(header.request))
        fail("history-unavailable");
      if (reservation(header.request) === baseline) return true;
    }
    return false;
  };
  const validatePlan = (prepared: NativeOperationPreparation<Plan>, id: string, request: OperationRequest) => {
    const plan = prepared.plan;
    const fileKey = policyFor(request).fileKey;
    if (
      !pin(prepared.visual) ||
      !pin(prepared.preparation) ||
      !plan ||
      plan.plan.version !== 1 ||
      plan.revision !== revisionOf(plan.plan) ||
      plan.plan.acceptedContract !== null ||
      plan.plan.nativeQualification !== "unqualified" ||
      plan.plan.purpose !== "source-candidate-inspection" ||
      isReactPlan(plan) !== (isReactNativeRequest(request) || isReactCallerNativeRequest(request) || isReactInitialNativeRequest(request)) ||
      isInitialPlan(plan) !== isReactInitialNativeRequest(request) ||
      isComparisonPlan(plan) !== isReactComparisonRequest(request) ||
      !same(plan.plan.operation, { id, fileKey }) ||
      plan.plan.tokenInput.fileKey !== fileKey ||
      plan.plan.tokenInput.scopeId !== `source-${id}`
    )
      fail("preparation-invalid");
  };
  const validatePreparation = (
    prepared: NativeOperationPreparation<Plan>,
    id: string,
    request: OperationRequest,
  ) => {
    validatePlan(prepared, id, request);
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
  /** A creation acknowledgement is allocation evidence, not readback. Check
   * its references and coverage before reporting components-created; never
   * qualify appearance/editability from this self-report. Raw invalid/partial
   * acknowledgements are still preserved in the immutable result event. */
  const acceptComponentCreation = (
    value: unknown,
    plan: Plan,
    id: string,
  ): Pick<State, "phase" | "problems"> => {
    const invalid = {
      phase: "component-creation-invalid" as const,
      problems: ["native-operation-component-result-invalid"],
    };
    if (
      !object(value) ||
      value.version !== 1 ||
      value.operationId !== id ||
      value.fileKey !== plan.plan.operation.fileKey ||
      value.acceptedContract !== null ||
      value.nativeQualification !== "unqualified" ||
      !Array.isArray(value.nodes) ||
      !Array.isArray(value.problems)
    )
      return invalid;
    if (
      value.status === "refused" &&
      value.allocationAttempted === false &&
      value.pageId === null &&
      value.target === null &&
      !value.nodes.length &&
      value.problems.length
    ) {
      return {
        phase: "component-creation-refused",
        problems: ["native-operation-component-write-refused"],
      };
    }
    if (
      value.status === "partial-or-unknown-allocation" &&
      value.allocationAttempted === true
    ) {
      return {
        phase: "component-partial-allocation",
        problems: ["native-operation-component-partial-allocation"],
      };
    }
    const textId = (x: unknown): x is string =>
      typeof x === "string" && x.length > 0 && x.length <= 512;
    if (isComparisonPlan(plan)) {
      const c = value.comparisons?.[0];
      if (value.status !== 'created-candidate' || value.allocationAttempted !== true || value.problems.length || value.target !== null ||
          value.variants !== undefined || !textId(value.pageId) || !textId(value.comparisonBoardId) ||
          value.nodes.some((n: unknown) => !object(n) || !textId(n.id) || !textId(n.type)) ||
          new Set(value.nodes.map((n: any) => n.id)).size !== value.nodes.length ||
          !Array.isArray(value.comparisons) || value.comparisons.length !== 1 || !object(c) || c.id !== plan.plan.comparison.caseId ||
          c.status !== 'created-comparison' || c.mainId !== plan.plan.comparison.mainId || !textId(c.instanceId) || c.slots?.length !== 1 ||
          !same(c.slots[0].specPath, plan.plan.comparison.slotSpecPath)) return invalid;
      const nodes = new Map(value.nodes.map((n: any) => [n.id, n.type]));
      if (nodes.get(value.pageId) !== 'PAGE' || nodes.get(value.comparisonBoardId) !== 'FRAME' ||
          nodes.get(c.instanceId) !== 'INSTANCE' || nodes.get(c.slots[0].nodeId) !== 'SLOT' ||
          !textId(c.slots[0].propertyKey) || !Array.isArray(c.slots[0].contentNodeIds) ||
          c.slots[0].contentNodeIds.length !== plan.plan.comparison.specs.length ||
          c.slots[0].contentNodeIds.some((id: string) => !nodes.has(id))) return invalid;
      return { phase: 'components-created', problems: [] };
    }
    if (
      value.status !== "created-candidate" ||
      value.allocationAttempted !== true ||
      value.problems.length ||
      !textId(value.pageId) ||
      !object(value.target) ||
      !textId(value.target.id) ||
      !textId(value.target.key) ||
      !Array.isArray(value.variants) ||
      value.variants.length !== plan.plan.component.variants.length ||
      !object(value.propertyDefinitions) ||
      (isReactPlan(plan) ? value.comparisons !== undefined || value.comparisonBoardId !== undefined :
        !Array.isArray(value.comparisons) || value.comparisons.length !== plan.plan.samples.cases.length || !textId(value.comparisonBoardId))
    )
      return invalid;
    if (
      value.nodes.some(
        (n: unknown) => !object(n) || !textId(n.id) || !textId(n.type),
      ) ||
      new Set(value.nodes.map((n: any) => n.id)).size !== value.nodes.length
    )
      return invalid;
    const nodes = new Map(value.nodes.map((n: any) => [n.id, n.type]));
    if (
      nodes.get(value.pageId) !== "PAGE" ||
      (!isReactPlan(plan) && nodes.get(value.comparisonBoardId) !== "FRAME") ||
      nodes.get(value.target.id) !== value.target.type ||
      !["COMPONENT", "COMPONENT_SET"].includes(value.target.type) ||
      value.variants.some(
        (v: any) =>
          !object(v) || nodes.get(v.id) !== "COMPONENT" || !textId(v.key),
      )
    )
      return invalid;
    if (isReactPlan(plan)) return { phase: 'components-created', problems: [] };
    const instanceIds: string[] = [];
    for (const [index, c] of value.comparisons.entries()) {
      const expected = plan.plan.samples.cases[index];
      if (!object(c) || c.id !== expected.id) return invalid;
      if (expected.status === "refused") {
        if (c.status !== "refused" || c.instanceId !== undefined)
          return invalid;
      } else {
        if (
          c.status !== "created-comparison" ||
          nodes.get(c.instanceId) !== "INSTANCE" ||
          !value.variants.some((v: any) => v.id === c.mainId) ||
          !Array.isArray(c.sourceParts) ||
          !Array.isArray(c.slots) ||
          c.sourceParts.some(
            (p: any) =>
              !object(p) || !nodes.has(p.nodeId) || !Array.isArray(p.partPath),
          ) ||
          c.slots.some(
            (s: any) =>
              !object(s) ||
              nodes.get(s.nodeId) !== "SLOT" ||
              !textId(s.propertyKey) ||
              !Array.isArray(s.contentNodeIds) ||
              s.contentNodeIds.some((n: unknown) => !nodes.has(n)),
          )
        )
          return invalid;
        instanceIds.push(c.instanceId);
      }
    }
    if (new Set(instanceIds).size !== instanceIds.length) return invalid;
    return { phase: "components-created", problems: [] };
  };
  const componentObservationInput = (
    state: State,
    plan: Plan,
  ): NativeInspectionInput => {
    if (isComparisonPlan(plan)) fail('root-observation-required');
    if (!state.identity || !state.componentCreation)
      fail("component-allocation-identity-unavailable");
    return {
      operation: plan.plan.operation,
      planRevision: plan.revision,
      component: plan.plan.component,
      ...(isReactPlan(plan) ? { projection: plan.plan.projection } : {
        projection: plan.plan.sourceProjection, samples: plan.plan.samples,
      }),
      ...('graphComponents' in plan.plan ? { graphComponents: plan.plan.graphComponents } : {}),
      tokenInput: plan.plan.tokenInput,
      tokenIdentity: state.identity,
      creation: state.componentCreation,
      allocationAnchor: state.allocationAnchor,
    };
  };
  const comparisonObservationInput = (state: State, plan: ComparisonPlan): NativeContractComparisonObservationInput => {
    const refreshed:ReturnType<typeof refreshedComparisonPlan>=state.comparisonRefresh?refreshedComparisonPlan(plan,state.comparisonRefresh.request,state.comparisonRefresh):plan;
    if (!state.identity || !state.componentCreation) fail('component-allocation-identity-unavailable');
    const mainMigrations=refreshed.mainMigrations;
    const migrated=state.comparisonMigration&&state.repairRevisionsWritten?.includes(state.comparisonMigration.revision);
    const creation=migrated?state.comparisonMigration!.input.creation:mainMigrations?rebaseComparisonCreation(state.componentCreation,mainMigrations):state.componentCreation;
    return { operation: refreshed.plan.operation, planRevision: refreshed.revision, comparison: refreshed.plan.comparison,
      tokenInput: refreshed.plan.tokenInput, tokenIdentity: state.identity, creation,...(mainMigrations?{mainMigrations}:{}) };
  };
  const recoveryInput = (state: State, plan: Plan) => {
    if (!isComparisonPlan(plan) || !state.identity || !state.partialCreation) fail('comparison-partial-required');
    return comparisonObservationInput({...state,componentCreation:state.partialCreation},plan);
  };
  const canRecover = (state: State, plan: Plan) => {
    if (state.pending || state.recoveryWritten || !['component-partial-allocation','comparison-recovery-refused'].includes(state.phase)) return false;
    try { emitNativeComparisonRecoveryReadbackScript(recoveryInput(state,plan)); return true; } catch { return false; }
  };
  const repairWasWritten=(state:State,repair:NativeComparisonRepairPlan)=>repair.version===1
    ? state.repairWritten===true : state.repairRevisionsWritten?.includes(repair.revision)===true;
  const repairPlan = (state: State, plan: Plan) => {
    if(!isComparisonPlan(plan)) fail('comparison-repair-unavailable');
    if(state.phase==='comparison-repair-refused'&&state.comparisonRepair&&!repairWasWritten(state,state.comparisonRepair))return state.comparisonRepair;
    if(!['component-structure-observed','component-observation-refused'].includes(state.phase)||!state.imageReadback)fail('comparison-repair-observation-required');
    const input=comparisonObservationInput(state,plan);
    if(input.mainMigrations?.length&&!(state.comparisonMigration&&repairWasWritten(state,state.comparisonMigration))){
      const migration=prepareNativeComparisonMigrationRepair(input,state.imageReadback.result);
      if(!repairWasWritten(state,migration))return migration;
    }
    // A fresh supported observation can expose a diagnostic-frame defect even
    // after a previous, separately claimed correction of linked instances.
    try {
      const frame=prepareNativeComparisonFrameRepair(input,state.imageReadback.result);
      if(!repairWasWritten(state,frame))return frame;
    } catch { /* Other differences must pass the existing bounded planner. */ }
    if(state.repairWritten||state.comparisonRefresh)fail('comparison-repair-unavailable');
    return prepareNativeComparisonRepair(input,state.imageReadback.result);
  };
  const availableRepair = (state: State,plan: Plan) => {
    if(state.pending || !['component-structure-observed','component-observation-refused','comparison-repair-refused'].includes(state.phase)) return undefined;
    try{return repairPlan(state,plan);}catch{return undefined;}
  };
  const observeComponent = (
    result: unknown,
    state: State,
    plan: Plan,
  ): Pick<State, "phase" | "problems" | "componentObservation"> => {
    const checked = isComparisonPlan(plan) ? verifyNativeContractComparisonReadback(comparisonObservationInput(state, plan), result) : verifyNativeInspectionReadback(
      componentObservationInput(state, plan), result,
    );
    return {
      phase:
        checked.status !== "refused"
          ? "component-structure-observed"
          : "component-observation-refused",
      // Keep exact node diagnostics in the private readback. Public snapshots
      // identify the boundary without exposing native IDs or plugin metadata.
      problems:
        checked.status !== "refused"
          ? []
          : ["native-operation-component-readback-refused"],
      componentObservation: checked,
    };
  };
  // A display response can visit the same dependency many times. Reuse its
  // checked observation only within this synchronous, non-authorizing scope.
  // Nothing survives into another request or a native command's authorization.
  let readSnapshot: Map<string, unknown> | undefined;
  const assertWriteScope = () => { assertOutsideEvidenceSnapshot(); if (readSnapshot) fail('write-during-read-snapshot'); };
  function withReadSnapshot<T>(read: () => T): T {
    const outer = readSnapshot;
    readSnapshot ??= new Map();
    try {
      const result = read();
      if (result && typeof (result as any).then === 'function') fail('async-read-snapshot');
      return result;
    } finally { readSnapshot = outer; }
  }
  function readOnce<T>(key: string, read: () => T): T {
    if (!readSnapshot) return read();
    if (readSnapshot.has(key)) return structuredClone(readSnapshot.get(key)) as T;
    const value = read();
    readSnapshot.set(key, structuredClone(value));
    return value;
  }
  const loadFresh = (id: string) => {
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
      !validRequest(header.request) ||
      !same(header.policy, policyFor(header.request)) ||
      !pin(header.visual) ||
      !pin(header.preparation) ||
      !REVISION.test(header.planRevision) ||
      !HASH.test(header.planSha256) ||
      !HASH.test(header.tokenScriptSha256)
    )
      fail("header-invalid");
    // Atomic publication reserves exactly one operation for a source baseline.
    // Unpublished partial preparations can never dispatch. They remain on disk.
    if (!bytes(pointer(reservation(header.request))).equals(headerBytes))
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
      header.request,
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
    const componentClaimPath = path.join(dir(id), "component-creation.json");
    const componentClaimBytes = present(componentClaimPath)
      ? bytes(componentClaimPath)
      : null;
    const componentClaim = componentClaimBytes
      ? JSON.parse(componentClaimBytes.toString())
      : null;
    const recoveryClaimPath=path.join(dir(id),"comparison-recovery.json");
    const recoveryClaim=present(recoveryClaimPath)?JSON.parse(bytes(recoveryClaimPath).toString()):null;
    const repairClaimPath=path.join(dir(id),"comparison-repair.json");
    const repairClaim=present(repairClaimPath)?JSON.parse(bytes(repairClaimPath).toString()):null;
    const revisionRepairClaims=Object.fromEntries(readdirSync(dir(id)).filter(name=>/^comparison-repair-[a-f0-9]{64}\.json$/.test(name)).sort()
      .map(name=>['sha256:'+name.slice(18,-5),JSON.parse(bytes(path.join(dir(id),name)).toString())]));
    const events: Event[] = [];
    const digests: string[] = [];
    let previous = sha(headerBytes);
    const state: State = {
      phase: "prepared",
      problems: [],
      dispatchedCreate: false,
      dispatchedComponent: false,
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
        if (event.comparisonRefresh) {
          if (c.phase !== "component-readback" || !c.readOnly || !isComparisonPlan(plan) || !isReactComparisonRequest(header.request)) fail("comparison-refresh-read-only");
          refreshedComparisonPlan(plan,header.request,event.comparisonRefresh);
          state.comparisonRefresh=structuredClone(event.comparisonRefresh);
          // Preserve the issued reader across compiler upgrades. Its bytes are
          // hash-bound below; the independent verifier uses the pinned input.
        }
        if (sequence === 0 && (!same(c, claim) || c.phase !== "token-create"))
          fail("creation-claim-mismatch");
        if (
          state.pending ||
          !object(c) ||
          c.version !== 1 ||
          c.kind !== "SOURCE-NATIVE-OPERATION" ||
          c.operationId !== id ||
          c.fileKey !== header.policy.fileKey ||
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
          if (
            !state.identity ||
            c.readOnly !== true ||
            state.dispatchedComponent
          )
            fail("observation-precondition-invalid");
        } else if (c.phase === "component-create") {
          if (
            !state.identity ||
            state.phase !== "tokens-observed" ||
            state.dispatchedComponent ||
            c.readOnly !== false ||
            !componentClaim ||
            !same(c, componentClaim)
          )
            fail("component-creation-precondition-invalid");
          state.dispatchedComponent = true;
        } else if(c.phase==='comparison-repair-preflight-readback'){
          if(!availableRepair(state,plan)||c.readOnly!==true||!event.comparisonRepair||!same(event.comparisonRepair,repairPlan(state,plan)))fail('repair-read-precondition-invalid');
          state.comparisonRepair=structuredClone(event.comparisonRepair);
          if(event.comparisonRepair.version===3)state.comparisonMigration=structuredClone(event.comparisonRepair);
        } else if(c.phase==='comparison-repair-apply'){
          if(state.phase!=='comparison-repair-observed'||!state.comparisonRepair||repairWasWritten(state,state.comparisonRepair)||c.readOnly!==false||!same(c,state.comparisonRepair.version===1?repairClaim:revisionRepairClaims[state.comparisonRepair.revision]))fail('repair-write-precondition-invalid');
          if(state.comparisonRepair.version===1)state.repairWritten=true;
          else (state.repairRevisionsWritten??=[]).push(state.comparisonRepair.revision);
        } else if (c.phase === 'comparison-recovery-readback') {
          // Stored reader bytes are hash-bound above. Compiler upgrades can
          // change the reader; its result still must pass the independent
          // recovery planner below against the unchanged pinned input.
          if (!canRecover(state,plan) || c.readOnly!==true) fail('recovery-read-precondition-invalid');
        } else if (c.phase === 'comparison-recovery-apply') {
          if (state.phase!=='comparison-recovery-observed' || !state.recovery || state.recoveryWritten || c.readOnly!==false || !same(c,recoveryClaim)) fail('recovery-write-precondition-invalid');
          state.recoveryWritten=true;
        } else if (c.phase === "component-readback") {
          if (
            !state.identity ||
            !state.componentCreation ||
            !state.dispatchedComponent ||
            c.readOnly !== true
          )
            fail("component-observation-precondition-invalid");
        } else fail("phase-invalid");
        attempts.add(c.attemptId);
        nonces.add(c.nonce);
        delete state.componentObservation;
        delete state.imageReadback;
        state.pending = c;
        state.phase = "awaiting-native-result";
        state.problems = [];
      } else if (event.kind === "result") {
        if (!state.pending) fail("unsolicited-result");
        correlate(event.envelope, state.pending);
        let recoveryOutcome: Pick<State,'phase'|'problems'> | undefined;
        if(state.pending.phase==='comparison-recovery-readback') {
          try {state.recovery=prepareNativeComparisonRecovery(recoveryInput(state,plan),event.envelope.result);recoveryOutcome={phase:'comparison-recovery-observed',problems:[]};}
          catch {delete state.recovery;recoveryOutcome={phase:'comparison-recovery-refused',problems:['native-operation-recovery-preflight-refused']};}
        }
        if(state.pending.phase==='comparison-repair-preflight-readback'){
          const r=event.envelope.result as any;
          recoveryOutcome=r?.status==='preflight-observed'&&nativeComparisonRepairMatches(state.comparisonRepair!,r.observation)
            ?{phase:'comparison-repair-observed',problems:[]}:{phase:'comparison-repair-refused',problems:['native-operation-comparison-repair-preflight-refused']};
        }
        if(state.pending.phase==='comparison-repair-apply'){
          const r=event.envelope.result as any;
          recoveryOutcome={phase:'components-created',problems:['updated','no-op'].includes(r?.status)?[]:['native-operation-comparison-repair-'+String(r?.status??'unknown')]};
        }
        const outcome = recoveryOutcome ?? (
          state.pending.phase === "token-create"
            ? acceptCreation(
                event.envelope.result as NativeTokenCreationResult,
                plan,
              )
            : ["component-create","comparison-recovery-apply"].includes(state.pending.phase)
              ? acceptComponentCreation(event.envelope.result, plan, id)
              : state.pending.phase === "component-readback"
                ? observeComponent(event.envelope.result, state, plan)
                : observe(
                    event.envelope.result as NativeTokenReadbackResult,
                    state.identity!,
                    plan,
                  ));
        if(state.pending.phase==='component-create' && outcome.phase==='component-partial-allocation') state.partialCreation=structuredClone(event.envelope.result);
        if (
          ["component-create","comparison-recovery-apply"].includes(state.pending.phase) &&
          outcome.phase === "components-created"
        )
          state.componentCreation = structuredClone(event.envelope.result);
        if (state.pending.phase === "component-readback") {
          state.imageReadback = event.envelope;
          // Preserve a legacy anchor only when its node inventory still exactly
          // matches creation. The verifier rechecks its complete semantics before
          // using it; newer writers carry durable allocation stamps themselves.
          const r = event.envelope.result as any;
          if (
            !isComparisonPlan(plan) && !state.allocationAnchor &&
            outcome.phase === "component-structure-observed" &&
            same(
              r.nodes.map((n: any) => n.id).sort(),
              state.componentCreation!.nodes.map((n: any) => n.id).sort(),
            )
          )
            state.allocationAnchor = structuredClone(r);
        }
        Object.assign(state, outcome);
        delete state.pending;
      } else if (event.kind === "abandon-observation") {
        if (
          !["token-readback", "component-readback", "comparison-recovery-readback", "comparison-repair-preflight-readback"].includes(
            state.pending?.phase ?? "",
          ) ||
          state.pending?.attemptId !== event.attemptId
        )
          fail("observation-abandon-refused");
        const phase = state.pending!.phase;
        delete state.pending;
        delete state.componentObservation;
        delete state.imageReadback;
        state.phase =
          phase === "comparison-repair-preflight-readback" ? "comparison-repair-refused" : phase === "comparison-recovery-readback" ? "comparison-recovery-refused" : phase === "component-readback"
            ? "component-observation-refused"
            : "observation-refused";
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
    if (!!componentClaim !== state.dispatchedComponent)
      fail("component-creation-journal-incomplete");
    if (!!repairClaim !== !!state.repairWritten) fail("repair-write-journal-incomplete");
    if (!!recoveryClaim !== !!state.recoveryWritten) fail("recovery-write-journal-incomplete");
    const fingerprint = sha(
      encode({
        header: sha(headerBytes),
        plan: sha(planBytes),
        script: sha(scriptBytes),
        claim: claimBytes ? sha(claimBytes) : null,
        componentClaim: componentClaimBytes ? sha(componentClaimBytes) : null,
        ...(repairClaim ? {repairClaim:sha(encode(repairClaim))} : {}),
        ...(Object.keys(revisionRepairClaims).length?{revisionRepairClaims:sha(encode(revisionRepairClaims))}:{}),
        ...(recoveryClaim ? {recoveryClaim:sha(encode(recoveryClaim))} : {}),
        digests,
      }),
    );
    return { header, plan, script, state, events, previous, fingerprint };
  };
  type Loaded = ReturnType<typeof loadFresh>;
  const load = (id: string): Loaded => readOnce('journal:'+id, () => loadFresh(id));
  const authenticate = (loaded: Loaded) => readOnce('source:'+loaded.header.id+':'+loaded.fingerprint, () => {
    const current = prepareInput(structuredClone(loaded.state.comparisonRefresh?.request ?? loaded.header.request), {
      id: loaded.header.id,
      fileKey: loaded.header.policy.fileKey,
    });
    if (validatePreparation(current, loaded.header.id, loaded.header.request) !== loaded.script)
      fail("compiled-script-changed");
    if (
      !same(current.visual, loaded.header.visual) ||
      !same(current.preparation, loaded.header.preparation) ||
      !same(current.plan, loaded.state.comparisonRefresh?.plan ?? loaded.plan)
    )
      fail("source-plan-stale");
    if (loadFresh(loaded.header.id).fingerprint !== loaded.fingerprint)
      fail("evidence-changed-during-validation");
    return current.sourceCompatibility;
  });
  // The journal is authoritative. Re-derive exports from its current readback;
  // old exports remain private history and cannot survive a retry as current.
  const imageArtifacts = (loaded: Loaded) => {
    const envelope = loaded.state.imageReadback;
    if (!envelope) return null;
    const collected = isComparisonPlan(loaded.plan) ? collectExpectedNativeImages(
      { operation: loaded.plan.plan.operation, planRevision: loaded.plan.revision },
      [{ id: loaded.plan.plan.comparison.caseId, instanceId: loaded.state.componentCreation!.comparisons[0].instanceId }],
      (envelope.result as Record<string, any>).content,
    ) : collectNativeImages(componentObservationInput(loaded.state, loaded.plan), envelope.result);
    if (collected.bytes.size) {
      const directory = path.join(dir(loaded.header.id), "images");
      ensure(directory, true);
      for (const [hash, png] of collected.bytes) {
        const file = path.join(directory, `${hash}.png`);
        if (!present(file)) {
          // Publish a complete fsynced export atomically. A crash may leave
          // a private temporary file; it cannot poison the canonical hash path.
          const temporary = path.join(
            directory,
            `${hash}-${randomUUID()}.pending`,
          );
          write(temporary, png);
          try {
            linkSync(temporary, file);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
          } finally {
            unlinkSync(temporary);
            syncDir(directory);
          }
        }
        if (!bytes(file).equals(png)) fail("image-artifact-changed");
      }
    }
    return { ...collected, attemptId: envelope.attemptId };
  };
  const snapshot = (
    loaded: Loaded,
    sourceCurrent: boolean,
    sourceCompatibility?: 'identity-opacity-omission',
  ): NativeOperationSnapshot => {
    const images = imageArtifacts(loaded);
    return {
      id: loaded.header.id,
      operation: "source-native-inspection",
      ...(loaded.state.comparisonRefresh ? {comparisonBaselineRefreshed:true}:{}),
      canResumeComparison: sourceCurrent && canRecover(loaded.state,loaded.plan),
      ...(sourceCurrent && availableRepair(loaded.state,loaded.plan) ? {comparisonRepair:{changes:structuredClone(availableRepair(loaded.state,loaded.plan)!.changes)}} : {}),
      ...(isComparisonPlan(loaded.plan) && loaded.plan.plan.comparison.instanceWidth !== undefined
        ? {comparisonWidth:loaded.plan.plan.comparison.instanceWidth} : {}),
      phase: loaded.state.phase,
      ...(isReactPlan(loaded.plan) ? { componentName: loaded.plan.plan.component.setName,
        ...(!loaded.plan.plan.component.rootSlot ? {sourceOwnedContent:true} : {}) } : {}),
      ...(loaded.state.pending
        ? {
            pendingPhase: loaded.state.pending.phase,
            nativeOutcome: "unknown" as const,
          }
        : {}),
      ...([
        "creation-invalid",
        "component-creation-invalid",
        "component-partial-allocation",
      ].includes(loaded.state.phase)
        ? { nativeOutcome: "unknown" as const }
        : {}),
      ...(loaded.state.componentObservation
        ? {
            structuralObservation: {
              scope: "supported-structure" as const,
              status: loaded.state.componentObservation.status,
              limitations: [...loaded.state.componentObservation.limitations],
            },
          }
        : {}),
      ...(images
        ? {
            imageObservation: {
              ...images.observation,
              attemptId: images.attemptId,
            },
          }
        : {}),
      sourceCurrent,
      ...(isReactNativeRequest(loaded.header.request) && loaded.header.request.compilation === 'current' ? { sourceCompilerRecompiled: true } : {}),
      ...(sourceCurrent && sourceCompatibility ? {sourceCompatibility} : {}),
      acceptedContract: null,
      nativeQualification: "unqualified",
      counters: {
        variants: isComparisonPlan(loaded.plan) ? 0 : loaded.plan.plan.component.variants.length,
        sourceCases: isReactPlan(loaded.plan) || isComparisonPlan(loaded.plan) ? 1 : loaded.plan.plan.samples.cases.length,
        loweredCases: isComparisonPlan(loaded.plan) ? 1 : isReactPlan(loaded.plan) ? 0 : loaded.plan.plan.samples.cases.filter(
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
    };
  };
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
      | { kind: "dispatch"; command: Dispatch; comparisonRepair?: NativeComparisonRepairPlan; comparisonRefresh?: ReactComparisonRefresh }
      | { kind: "result"; envelope: NativeOperationResult }
      | { kind: "abandon-observation"; attemptId: string }
      | { kind: "retry-refused-creation" },
  ) => {
    assertWriteScope();
    if (load(loaded.header.id).fingerprint !== loaded.fingerprint)
      fail("journal-changed");
    const sequence = loaded.events.length;
    if (
      event.kind === "dispatch" &&
      event.command.phase === "component-create"
    ) {
      // Separate claim survives deletion of only the later component events.
      // A crash between this durable claim and event publication fails closed.
      write(
        path.join(dir(loaded.header.id), "component-creation.json"),
        encode(event.command),
      );
    }
    if(event.kind==='dispatch' && event.command.phase==='comparison-repair-apply')
      write(path.join(dir(loaded.header.id),loaded.state.comparisonRepair!.version===1?'comparison-repair.json':`comparison-repair-${loaded.state.comparisonRepair!.revision.slice(7)}.json`),encode(event.command));
    if(event.kind==='dispatch' && event.command.phase==='comparison-recovery-apply')
      write(path.join(dir(loaded.header.id),'comparison-recovery.json'),encode(event.command));
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
    request: OperationRequest,
  ): NativeOperationSnapshot => {
    assertWriteScope();
    if (!validRequest(request)) fail("request-invalid");
    directories(true);
    const target = pointer(reservation(request));
    if (present(target)) {
      const header = JSON.parse(bytes(target).toString()) as Header;
      if (!same(header.request, request)) fail("baseline-already-reserved");
      const loaded = load(header.id);
      authenticate(loaded);
      return snapshot(loaded, true);
    }
    // A missing index is not permission to create a replacement scope. An
    // earlier prepared/dispatched operation may still own native objects.
    if (priorBaseline(reservation(request)))
      fail("baseline-reservation-missing");
    const id = randomUUID();
    const prepared = prepareInput(structuredClone(request), {
      id,
      fileKey: policyFor(request).fileKey,
    });
    const script = validatePreparation(prepared, id, request),
      planBytes = encode(prepared.plan);
    const header: Header = {
      version: 1,
      id,
      startedAt: new Date().toISOString(),
      request: structuredClone(request),
      policy: policyFor(request),
      visual: prepared.visual,
      preparation: prepared.preparation,
      planRevision: prepared.plan.revision,
      planSha256: sha(planBytes),
      tokenScriptSha256: sha(script),
    };
    // Recheck source before publishing any executable operation identity.
    if (
      !same(
        prepareInput(structuredClone(request), {
          id,
          fileKey: policyFor(request).fileKey,
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
  const get = (id: string): NativeOperationSnapshot => readOnce('snapshot:'+id, () => {
    const loaded = load(id);
    let compatibility;
    try { compatibility = authenticate(loaded); }
    catch { return snapshot(loaded, false); }
    return snapshot(loaded, true, compatibility);
  });
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
    assertWriteScope();
    const loaded = load(id);
    if (loaded.state.pending) fail("native-outcome-unknown");
    let script: string;
    let comparisonRepair: NativeComparisonRepairPlan | undefined;
    let comparisonRefresh: ReactComparisonRefresh | undefined;
    if (loaded.state.comparisonRefresh && !phase.endsWith("readback") && !(phase==='comparison-repair-apply'&&[2,3].includes(loaded.state.comparisonRepair?.version??0))) fail("comparison-refresh-read-only");
    if (phase === "token-create") {
      if (loaded.state.dispatchedCreate) fail("creation-already-dispatched");
      authenticate(loaded);
      script = loaded.script;
    } else if (phase === "token-readback") {
      if (loaded.state.dispatchedComponent)
        fail("component-phase-already-started");
      if (!loaded.state.identity) fail("allocation-identity-unavailable");
      // Readback remains available for known allocations after source changes.
      // It cannot authorize a write or advance a source/component baseline.
      script = emitNativeTokenContextReadbackScript(
        loaded.plan.plan.tokenInput,
        loaded.state.identity,
      );
    } else if(phase==='comparison-repair-preflight-readback'){
      comparisonRepair=availableRepair(loaded.state,loaded.plan);if(!comparisonRepair)fail('comparison-repair-unavailable');
      authenticate(loaded);script=emitNativeComparisonRepairScript(comparisonRepair,true);
    } else if(phase==='comparison-repair-apply'){
      if(loaded.state.phase!=='comparison-repair-observed'||!loaded.state.comparisonRepair||repairWasWritten(loaded.state,loaded.state.comparisonRepair))fail('comparison-repair-unavailable');
      authenticate(loaded);script=emitNativeComparisonRepairScript(loaded.state.comparisonRepair);
    } else if (phase === 'comparison-recovery-readback') {
      if(!canRecover(loaded.state,loaded.plan)) fail('comparison-recovery-refused');
      authenticate(loaded);
      script=emitNativeComparisonRecoveryReadbackScript(recoveryInput(loaded.state,loaded.plan));
    } else if (phase === 'comparison-recovery-apply') {
      if(loaded.state.phase!=='comparison-recovery-observed' || loaded.state.recoveryWritten || !loaded.state.recovery || !isReactComparisonRequest(loaded.header.request) || !options.reactComparison) fail('comparison-recovery-refused');
      authenticate(loaded);
      const recovery=loaded.state.recovery;
      const built=options.reactComparison.buildComponent(loaded.header.request,{
        operation:loaded.plan.plan.operation,planRevision:loaded.plan.revision,journalRevision:loaded.fingerprint,
        tokens:{input:loaded.plan.plan.tokenInput,identity:loaded.state.identity!,receipt:(recovery.observation as any).content.tokens.receipt},comparisonRecovery:recovery,
      });
      if(built.planRevision!==loaded.plan.revision || typeof built.script!=='string' || !built.script.trim() || Buffer.byteLength(built.script)>4*1024*1024) fail('component-script-invalid');
      authenticate(loaded);script=built.script;
    } else if (phase === "component-create") {
      if (loaded.state.dispatchedComponent)
        fail("component-creation-already-dispatched");
      if (isReactInitialNativeRequest(loaded.header.request) ? !options.reactInitial : isReactComparisonRequest(loaded.header.request) ? !options.reactComparison : isReactCallerNativeRequest(loaded.header.request) ? !options.reactCaller : isReactNativeRequest(loaded.header.request) ? !options.react : !options.buildComponent) fail("component-writer-unavailable");
      const context = verifiedTokenContext(id);
      if (context.journalRevision !== loaded.fingerprint)
        fail("journal-changed");
      const request = structuredClone(loaded.header.request);
      const built = isReactInitialNativeRequest(request) ? options.reactInitial!.buildComponent(request, context) : isReactComparisonRequest(request) ? options.reactComparison!.buildComponent(request, context) : isReactCallerNativeRequest(request) ? options.reactCaller!.buildComponent(request, context) : isReactNativeRequest(request) ? options.react!.buildComponent(request, context)
        : options.buildComponent!(request, context);
      if (
        built.planRevision !== loaded.plan.revision ||
        typeof built.script !== "string" ||
        !built.script.trim() ||
        Buffer.byteLength(built.script) > 4 * 1024 * 1024
      )
        fail("component-script-invalid");
      // Compilation may reenter the manager or race another host process.
      authenticate(loaded);
      script = built.script;
    } else if (phase === "component-readback") {
      // Known allocations remain inspectable when the source changes. This
      // observes the saved plan only; sourceCurrent is checked separately and
      // observation never authorizes admission, allocation or baseline changes.
      if(isComparisonPlan(loaded.plan) && isReactComparisonRequest(loaded.header.request) && options.reactComparison?.refresh) {
        try {
          const fresh=options.reactComparison.refresh(structuredClone(loaded.header.request),loaded.plan.plan.operation);
          refreshedComparisonPlan(loaded.plan,loaded.header.request,fresh);
          if(loadFresh(id).fingerprint!==loaded.fingerprint) fail('evidence-changed-during-validation');
          if (!same(fresh.plan,loaded.plan)) comparisonRefresh=fresh;
        } catch { /* Historical reads remain possible; freshness still refuses. */ }
      }
      script = isComparisonPlan(loaded.plan) ? emitNativeContractComparisonReadbackScript(comparisonObservationInput({...loaded.state,...(comparisonRefresh?{comparisonRefresh}:{})}, loaded.plan), true) : emitNativeInspectionReadbackScript(
        componentObservationInput(loaded.state, loaded.plan), true,
        isReactCallerNativeRequest(loaded.header.request),
      );
    } else fail("phase-invalid");
    const command: NativeOperationCommand = {
      version: 1,
      kind: "SOURCE-NATIVE-OPERATION",
      operationId: id,
      phase,
      attemptId: randomUUID(),
      nonce: randomBytes(32).toString("hex"),
      fileKey: loaded.header.policy.fileKey,
      planRevision: loaded.plan.revision,
      scriptSha256: sha(script),
      readOnly: phase.endsWith("-readback"),
      script,
    };
    append(loaded, { kind: "dispatch", command, ...(comparisonRepair?{comparisonRepair}:{}),...(comparisonRefresh?{comparisonRefresh}:{}) });
    return structuredClone(command);
  };
  const accept = (
    id: string,
    envelope: NativeOperationResult,
  ): NativeOperationSnapshot => {
    assertWriteScope();
    const serialized = encode(envelope);
    if (Buffer.byteLength(serialized) > 4 * 1024 * 1024)
      fail("result-too-large");
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
    assertWriteScope();
    const loaded = load(id);
    const phase =
      loaded.state.pending?.phase ??
      (loaded.state.phase === "observation-refused"
        ? "token-readback"
        : loaded.state.phase === "component-observation-refused" ||
            loaded.state.phase === "component-structure-observed"
          ? "component-readback"
          : undefined);
    if (phase !== "token-readback" && phase !== "component-readback" && phase !== "comparison-recovery-readback" && phase !== "comparison-repair-preflight-readback")
      fail("observation-retry-refused");
    if (loaded.state.pending) {
      append(loaded, {
        kind: "abandon-observation",
        attemptId: loaded.state.pending.attemptId,
      });
    }
    return dispatch(id, phase);
  };
  const retryCreation = (id: string) => {
    assertWriteScope();
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
  /** Private host accessor for the next component phase. Reopens and validates
   * the entire journal and fresh source before returning native identities.
   * This is never included in public snapshots or returned by an HTTP route. */
  const verifiedTokenContext = (id: string) => {
    const loaded = load(id);
    if (
      loaded.state.phase !== "tokens-observed" ||
      loaded.state.pending ||
      !loaded.state.identity
    )
      fail("verified-token-observation-required");
    authenticate(loaded);
    const event = [...loaded.events]
      .reverse()
      .find(
        (e) => e.kind === "result" && e.envelope.phase === "token-readback",
      );
    if (event?.kind !== "result") fail("verified-token-observation-required");
    const result = event.envelope.result as NativeTokenReadbackResult;
    if (
      observe(result, loaded.state.identity, loaded.plan).phase !==
        "tokens-observed" ||
      !result.receipt
    )
      fail("verified-token-observation-required");
    return structuredClone({
      operation: { id, fileKey: loaded.header.policy.fileKey },
      planRevision: loaded.plan.revision,
      journalRevision: loaded.fingerprint,
      tokens: {
        input: loaded.plan.plan.tokenInput,
        identity: loaded.state.identity,
        receipt: result.receipt,
      },
    });
  };
  return {
    withReadSnapshot,
    prepare,
    get,
    forBaseline,
    dispatch,
    accept,
    retryObservation,
    retryCreation,
    verifiedTokenContext,
    reactInitialRequest(id: string): ReactInitialNativeRequest {
      const { header } = load(id);
      if (!isReactInitialNativeRequest(header.request)) fail('react-initial-operation-required');
      return structuredClone(header.request);
    },
    reactUpdateBaseline(id: string) {
      const loaded = load(id);
      if ((!isReactNativeRequest(loaded.header.request) && !isReactInitialNativeRequest(loaded.header.request)) ||
          !isReactPlan(loaded.plan) || !['component-structure-observed','component-observation-refused'].includes(loaded.state.phase) ||
          loaded.state.pending || !loaded.state.imageReadback)
        fail('react-update-verified-baseline-required');
      // The old compiler plan is historical evidence, not write authority.
      // An update must separately authenticate and pin its current desired input.
      const input = componentObservationInput(loaded.state, loaded.plan) as import('../core/native-source-observation.js').NativeContractObservationInput;
      delete input.allocationAnchor;
      const receipt = structuredClone(loaded.state.imageReadback.result) as unknown as import('../core/native-source-observation.js').NativeSourceReadback;
      delete receipt.images;
      if (loaded.state.phase !== 'component-structure-observed' && !nativeDefaultFillRepairBaseline(input, receipt))
        fail('react-update-verified-baseline-required');
      return structuredClone({ input, receipt, request: loaded.header.request, journalRevision: loaded.fingerprint });
    },
    reactRequest(id: string): ReactNativeRequest {
      const { header } = load(id);
      if (!isReactNativeRequest(header.request)) fail('react-operation-required');
      return structuredClone(header.request);
    },
    reactSourceRequest(id: string): ReactNativeRequest {
      const { header } = load(id);
      const request = isReactComparisonRequest(header.request) ? header.request.root : header.request;
      if (!isReactNativeRequest(request)) fail('react-operation-required');
      return structuredClone(request);
    },
    verifiedReactObservation(id: string) {
      const loaded = load(id);
      if (!isReactNativeRequest(loaded.header.request) || !isReactPlan(loaded.plan) ||
          !['component-structure-observed','component-observation-refused'].includes(loaded.state.phase) || loaded.state.pending || !loaded.state.imageReadback)
        fail('react-parent-observation-required');
      const updated = options.react?.updatedObservation?.(id);
      if (updated) return structuredClone({ ...updated, request: loaded.header.request });
      if (loaded.state.phase !== 'component-structure-observed') fail('react-parent-observation-required');
      authenticate(loaded);
      const input = componentObservationInput(loaded.state, loaded.plan) as import('../core/native-source-observation.js').NativeContractObservationInput;
      delete input.allocationAnchor;
      const receipt = structuredClone(loaded.state.imageReadback.result) as unknown as import('../core/native-source-observation.js').NativeSourceReadback;
      delete receipt.images;
      return structuredClone({ input, receipt, request: loaded.header.request });
    },
    verifiedReactInitialObservation(id: string) {
      const loaded = load(id);
      if (!isReactInitialNativeRequest(loaded.header.request) || !isReactPlan(loaded.plan) ||
          !['component-structure-observed','component-observation-refused'].includes(loaded.state.phase) || loaded.state.pending || !loaded.state.imageReadback)
        fail('react-parent-observation-required');
      const updated = options.react?.updatedObservation?.(id);
      if (updated) return structuredClone({ ...updated, request: loaded.header.request });
      if (loaded.state.phase !== 'component-structure-observed') fail('react-parent-observation-required');
      authenticate(loaded);
      const input = componentObservationInput(loaded.state, loaded.plan) as import('../core/native-source-observation.js').NativeContractObservationInput;
      delete input.allocationAnchor;
      const receipt = structuredClone(loaded.state.imageReadback.result) as unknown as import('../core/native-source-observation.js').NativeSourceReadback;
      delete receipt.images;
      return structuredClone({ input, receipt, request: loaded.header.request });
    },
    reactIdentity(id: string) {
      const { header } = load(id);
      if (isReactCallerNativeRequest(header.request)) return {
        referenceId: header.request.referenceId, caseId: header.request.caseId,
        ownershipId: header.request.ownership.id, fileKey: header.policy.fileKey,
      };
      const request = isReactInitialNativeRequest(header.request) ? { ...header.request.anchor, caseId: header.request.caseId } : isReactComparisonRequest(header.request) ? header.request.root : header.request;
      if (!isReactNativeRequest(request)) fail('react-operation-required');
      return { referenceId: request.referenceId, caseId: request.caseId,
        ownershipId: request.ownership.id, fileKey: header.policy.fileKey };
    },
    listReact(referenceId: string, kind?: 'root' | 'mains') {
      return withReadSnapshot(() => {
      if (!HASH.test(referenceId)) fail('request-invalid');
      if (!present(root)) return [];
      directories();
      return readdirSync(operations).filter(id => UUID.test(id)).flatMap(id => {
        const header = JSON.parse(bytes(path.join(dir(id), 'operation.json')).toString()) as Header;
        if (kind === 'root' && !isReactNativeRequest(header.request)) return [];
        if (kind === 'mains' && !isReactNativeRequest(header.request) && !isReactInitialNativeRequest(header.request)) return [];
        const comparison = isReactComparisonRequest(header.request) ? header.request : undefined;
        const initial = isReactInitialNativeRequest(header.request) ? header.request : undefined;
        const request = initial ? { ...initial.anchor, caseId: initial.caseId } : comparison?.root ?? header.request;
        if (!isReactNativeRequest(request) || request.referenceId !== referenceId) return [];
        // get() verifies the saved journal and separately reports source freshness.
        return [{ caseId: request.caseId, ownershipId: request.ownership.id, kind: initial ? 'initial' as const : comparison ? 'comparison' as const : request.version !== 1 ? 'nested' as const : 'root' as const,
          ...(request.version !== 1 ? { nestedInstanceId: request.selection!.instanceId } : {}),
          ...(initial ? { initialObservation: structuredClone(initial.observation) } : {}),
          ...(comparison ? { parentOperationId: comparison.parentOperationId, sourceOperationId: comparison.version === 3 ? id : comparison.parentOperationId } : {}),
          fileKey: header.policy.fileKey, operation: get(id) }];
      });
      });
    },
    /** Transport scheduling only. Freshness is intentionally absent; writes
     * still authenticate their source during dispatch and first delivery. */
    deliveryState(id: string) {
      const { state, header } = load(id);
      return { phase: state.phase, pendingPhase: state.pending?.phase, fileKey: header.policy.fileKey };
    },
    abandonedObservationPhase(id: string, attemptId: string) {
      const loaded = load(id);
      if (
        !loaded.events.some(
          (event) =>
            event.kind === "abandon-observation" &&
            event.attemptId === attemptId,
        )
      )
        return null;
      const event = loaded.events.find(
        (event) =>
          event.kind === "dispatch" && event.command.attemptId === attemptId,
      );
      if (event?.kind !== "dispatch" || !event.command.readOnly) return null;
      return event.command.phase;
    },
    image(id: string, attemptId: string, hash: string) {
      if (!UUID.test(attemptId) || !HASH.test(hash))
        fail("image-request-invalid");
      const artifacts = imageArtifacts(load(id));
      if (
        !artifacts ||
        artifacts.attemptId !== attemptId ||
        !artifacts.bytes.has(hash)
      )
        fail("image-unavailable");
      return Buffer.from(artifacts.bytes.get(hash)!);
    },
    /** Trusted transport only. Never include executable bytes in a public
     * snapshot. Reauthenticate write inputs immediately before first delivery. */
    pendingCommand(id: string): NativeOperationCommand | null {
      assertWriteScope();
      const loaded = load(id);
      if (!loaded.state.pending) return null;
      if (!loaded.state.pending.readOnly) authenticate(loaded);
      return structuredClone(loaded.state.pending);
    },
  };
}
