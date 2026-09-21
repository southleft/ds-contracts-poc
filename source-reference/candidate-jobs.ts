import { spawn, type ChildProcess } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  isBindingEvidenceRequest,
  bindingComponent,
  type BindingEvidenceRequest,
} from "./binding-evidence.js";
import type { VerifiedBindingSelection } from "./binding-jobs.js";

type CandidateState = "running" | "complete" | "failed" | "interrupted";
export interface CandidateJobRecord {
  version: 1;
  id: string;
  request: BindingEvidenceRequest;
  binding: { id: string; reportSha256: string };
  sourceProgramSha256: string;
  sourceRevision: string;
  state: CandidateState;
  startedAt: string;
  reportSha256?: string;
  problem?: string;
}
export interface CandidateVisualJobRecord extends Omit<
  CandidateJobRecord,
  "version"
> {
  version: 2 | 3;
  operation: "source-visual-assembly";
  preparation: { id: string; reportSha256: string };
}
export type AnyCandidateJobRecord =
  CandidateJobRecord | CandidateVisualJobRecord;
export interface CandidateVisualReportBase {
  version: 2 | 3;
  request: BindingEvidenceRequest;
  binding: CandidateJobRecord["binding"];
  preparation: CandidateVisualJobRecord["preparation"];
  sourceProgramSha256: string;
  status: "measured-candidate" | "visual-refused";
  acceptedContract: null;
  [key: string]: unknown;
}
export interface CandidatePreparedReport {
  version: 1;
  request: BindingEvidenceRequest;
  binding: CandidateJobRecord["binding"];
  sourceProgramSha256: string;
  status: "prepared";
  acceptedContract: null;
  [key: string]: unknown;
}
export interface StatefulPreparationInventory {
  booleanStates: Array<{
    property: string;
    omitted: number;
    explicitFalse: number;
    explicitTrue: number;
  }>;
  slots: Array<{ name: string; observedCases: number }>;
}
export interface CandidateJobSnapshot {
  stateful?: StatefulPreparationInventory;
  component?: "al-checkbox";
  id: string;
  state: CandidateState;
  operation?: "source-preparation" | "source-visual-assembly";
  phase:
    | "preparing"
    | "prepared"
    | "assembling"
    | "measured-candidate"
    | "visual-refused"
    | "failed"
    | "interrupted";
  counters: Record<string, number>;
  problems: string[];
}
export interface CandidateValidationContext {
  /** Server-only fixed private job directory. Never included in snapshots. */
  directory: string;
  selection: VerifiedBindingSelection;
  readArtifact(relativePath: string): Buffer;
}
export interface VerifiedCandidatePreparation {
  id: string;
  reportSha256: string;
  directory: string;
  report: CandidatePreparedReport;
  selection: VerifiedBindingSelection;
}
/** Server-only evidence for native planning. This contains private source and
 * artifact locations and must never be spread into HTTP snapshots. */
export interface VerifiedCandidateVisual {
  id: string;
  reportSha256: string;
  directory: string;
  report: CandidateVisualReportBase;
  preparation: VerifiedCandidatePreparation;
  selection: VerifiedBindingSelection;
}
export interface CandidateVisualValidationContext extends CandidateValidationContext {
  preparation: VerifiedCandidatePreparation;
}
export type CandidateVisualReportValidator = (
  report: CandidateVisualReportBase,
  context: CandidateVisualValidationContext,
) => CandidateValidatedSummary;
export interface CandidateValidatedSummary {
  stateful?: StatefulPreparationInventory;
  counters: Record<string, number>;
  problems?: string[];
}
export type CandidateReportValidator = (
  report: CandidatePreparedReport,
  context: CandidateValidationContext,
) => CandidateValidatedSummary;
export type CandidateRun = (
  args: string[],
  done: (error: unknown) => void,
) => { kill(): boolean };
export interface CandidateJobsOptions {
  selectLatestVerified(
    request: BindingEvidenceRequest,
  ): VerifiedBindingSelection;
  validateReport: CandidateReportValidator;
  validateVisualReport?: CandidateVisualReportValidator;
  /** Server-selected derivation version; historical versions remain readable. */
  visualJobVersion?: 2 | 3;
  run?: CandidateRun;
}
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;
const CODE = /^[a-z][a-z0-9-]*(?::[a-z0-9-]+)*$/;
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const fail = (code: string): never => {
  throw Error(`candidate-job-${code}`);
};

/** Internal stop handle for a child whose process group this launcher owns.
 * Once signalled or absent, the group is terminal. A close callback must not
 * signal it again: macOS can return EPERM while it exits, and a later reused
 * process-group ID would no longer identify our child. */
export function candidateProcessGroupStop(
  child: Pick<ChildProcess, "pid">,
  signal: typeof process.kill = process.kill,
): () => boolean {
  let stopped = false;
  return () => {
    if (stopped || !child.pid) return false;
    try {
      signal(-child.pid, "SIGKILL");
      stopped = true;
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ESRCH") {
        stopped = true;
        return false;
      }
      throw error;
    }
  };
}

/** The process group is created here, retained only in this closure and never
 * recovered from disk. SIGKILL deliberately leaves partial private evidence
 * for inspection; it cannot leave an unresponsive build grandchild running. */
function launchCandidate(repoRoot: string): CandidateRun {
  return (args, done) => {
    if (process.platform === "win32") fail("process-groups-unavailable");
    const child = spawn(process.execPath, args, {
      cwd: repoRoot,
      detached: true,
      stdio: "ignore",
      env: {
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        NODE_ENV: "production",
      },
    });
    let finished = false;
    const kill = candidateProcessGroupStop(child);
    const timer = setTimeout(
      () => settle(Error("candidate-job-timeout")),
      180000,
    );
    timer.unref();
    const settle = (error: unknown) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      // Also reap a background child left behind by an exiting runner.
      try {
        kill();
      } finally {
        done(error);
      }
    };
    child.once("error", () => settle(Error("candidate-job-launch-failed")));
    child.once("close", (code) =>
      settle(code === 0 ? null : Error("candidate-job-run-failed")),
    );
    return { kill };
  };
}

/** Private local orchestration only. The trusted validator rederives candidate
 * output; a report flag, digest or completed process is not acceptance. */
export function createCandidateJobs(
  repoRoot: string,
  options: CandidateJobsOptions,
) {
  const repository = path.resolve(repoRoot),
    root = path.join(repository, "private/source-candidate-app");
  const jobs = new Map<string, AnyCandidateJobRecord>();
  const invalid = new Map<string, string | undefined>();
  let closed = false;
  let active:
    { job: AnyCandidateJobRecord; child: ReturnType<CandidateRun> } | undefined;
  const execute = options.run ?? launchCandidate(repository);
  const directories = (create = false) => {
    const canonical = realpathSync(repository);
    const allowed =
      process.platform === "darwin"
        ? repository
            .replace(/^\/var(?=\/|$)/, "/private/var")
            .replace(/^\/tmp(?=\/|$)/, "/private/tmp")
        : repository;
    if (canonical !== allowed || !lstatSync(repository).isDirectory())
      fail("repository-refused");
    for (const dir of [path.join(repository, "private"), root]) {
      try {
        if (!lstatSync(dir).isDirectory()) fail("directory-refused");
      } catch (error) {
        if (create && (error as NodeJS.ErrnoException).code === "ENOENT")
          mkdirSync(dir, { mode: 0o700 });
        else throw error;
      }
    }
  };
  const directory = (id: string) => {
    directories();
    if (!UUID.test(id)) fail("id-invalid");
    const dir = path.join(root, id);
    if (!lstatSync(dir).isDirectory()) fail("directory-refused");
    return dir;
  };
  const read = (id: string, name: string): Buffer => {
    if (
      !name ||
      path.isAbsolute(name) ||
      /[\\\0:?#]/.test(name) ||
      name.split("/").some((part) => !part || part === "." || part === "..")
    )
      fail("artifact-path-refused");
    let file = directory(id);
    const parts = name.split("/");
    for (const [index, part] of parts.entries()) {
      file = path.join(file, part);
      const stat = lstatSync(file);
      if (
        index < parts.length - 1
          ? !stat.isDirectory()
          : !stat.isFile() || stat.size > 64 * 1024 * 1024
      )
        fail("artifact-file-refused");
    }
    return readFileSync(file);
  };
  const save = (job: AnyCandidateJobRecord) => {
    const dir = directory(job.id),
      target = path.join(dir, "job.json");
    try {
      if (!lstatSync(target).isFile()) fail("metadata-refused");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const temporary = path.join(dir, `job-${randomUUID()}.tmp`);
    writeFileSync(temporary, JSON.stringify(job, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    directory(job.id);
    renameSync(temporary, target);
  };
  const validRecord = (
    value: unknown,
    id: string,
  ): value is AnyCandidateJobRecord =>
    object(value) &&
    (value.version === 1 ||
      ((value.version === 2 || value.version === 3) &&
        value.operation === "source-visual-assembly" &&
        object(value.preparation) &&
        typeof value.preparation.id === "string" &&
        UUID.test(value.preparation.id) &&
        typeof value.preparation.reportSha256 === "string" &&
        HASH.test(value.preparation.reportSha256) &&
        Object.keys(value.preparation).every((key) =>
          ["id", "reportSha256"].includes(key),
        ))) &&
    Object.keys(value).every((key) =>
      [
        "version",
        "id",
        "request",
        "binding",
        "sourceProgramSha256",
        "sourceRevision",
        "state",
        "startedAt",
        "reportSha256",
        "problem",
        ...(value.version !== 1 ? ["operation", "preparation"] : []),
      ].includes(key),
    ) &&
    value.id === id &&
    UUID.test(id) &&
    isBindingEvidenceRequest(value.request) &&
    object(value.binding) &&
    typeof value.binding.id === "string" &&
    UUID.test(value.binding.id) &&
    typeof value.binding.reportSha256 === "string" &&
    HASH.test(value.binding.reportSha256) &&
    typeof value.sourceProgramSha256 === "string" &&
    HASH.test(value.sourceProgramSha256) &&
    typeof value.sourceRevision === "string" &&
    /^[a-f0-9]{40}$/.test(value.sourceRevision) &&
    typeof value.startedAt === "string" &&
    Number.isFinite(Date.parse(value.startedAt)) &&
    new Date(value.startedAt).toISOString() === value.startedAt &&
    ["running", "complete", "failed", "interrupted"].includes(
      String(value.state),
    ) &&
    (value.reportSha256 === undefined ||
      (typeof value.reportSha256 === "string" &&
        HASH.test(value.reportSha256))) &&
    (value.state !== "complete" || value.reportSha256 !== undefined) &&
    (value.problem === undefined ||
      (typeof value.problem === "string" && CODE.test(value.problem)));
  try {
    directories();
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!UUID.test(entry.name)) continue;
      invalid.set(entry.name, undefined);
      try {
        const value = JSON.parse(read(entry.name, "job.json").toString());
        if (isBindingEvidenceRequest(value?.request))
          invalid.set(entry.name, value.request.baseline.id);
        if (!validRecord(value, entry.name)) continue;
        if (value.state === "running") value.state = "interrupted";
        jobs.set(value.id, value);
        invalid.delete(value.id);
      } catch {
        /* Preserve incompatible or partial evidence without adopting it. */
      }
    }
  } catch {
    /* No compatible local candidate history. Start rechecks directories. */
  }
  const selected = (request: BindingEvidenceRequest) => {
    const value = options.selectLatestVerified(structuredClone(request));
    if (
      !value ||
      !UUID.test(value.id) ||
      !HASH.test(value.reportSha256) ||
      !same(value.request, request) ||
      !HASH.test(value.evidence?.sourceProgramSha256) ||
      !/^[a-f0-9]{40}$/.test(value.evidence?.sourceRevision) ||
      value.report?.sourceProgramSha256 !== value.evidence.sourceProgramSha256
    )
      fail("binding-selection-invalid");
    return value;
  };
  const selectionMatches = (
    job: AnyCandidateJobRecord,
    value: VerifiedBindingSelection,
  ) =>
    same(job.binding, { id: value.id, reportSha256: value.reportSha256 }) &&
    job.sourceProgramSha256 === value.evidence.sourceProgramSha256 &&
    job.sourceRevision === value.evidence.sourceRevision;
  const validate = (job: AnyCandidateJobRecord) => {
    if (!same(JSON.parse(read(job.id, "job.json").toString()), job))
      fail("metadata-changed");
    const selection = selected(job.request);
    if (!selectionMatches(job, selection)) fail("source-changed");
    const bytes = read(job.id, "report.json"),
      digest = sha(bytes);
    if (job.reportSha256 && digest !== job.reportSha256) fail("report-changed");
    const report = JSON.parse(bytes.toString()) as
      CandidatePreparedReport | CandidateVisualReportBase;
    if (
      !object(report) ||
      report.version !== job.version ||
      !same(report.request, job.request) ||
      !same(report.binding, job.binding) ||
      report.sourceProgramSha256 !== job.sourceProgramSha256 ||
      (job.version === 1
        ? report.status !== "prepared"
        : !["measured-candidate", "visual-refused"].includes(report.status) ||
          !same(report.preparation, job.preparation)) ||
      report.acceptedContract !== null
    )
      fail("report-invalid");
    const preparation =
      job.version !== 1 ? selectLatestPreparedVerified(job.request) : undefined;
    if (
      job.version !== 1 &&
      (!preparation ||
        !same(job.preparation, {
          id: preparation.id,
          reportSha256: preparation.reportSha256,
        }))
    )
      fail("preparation-changed");
    const artifactDigests = new Map<string, string>();
    const context: CandidateValidationContext = {
      directory: directory(job.id),
      selection,
      readArtifact: (name) => {
        const bytes = read(job.id, name),
          digest = sha(bytes);
        const prior = artifactDigests.get(name);
        if (prior !== undefined && prior !== digest)
          fail("evidence-changed-during-validation");
        artifactDigests.set(name, digest);
        return bytes;
      },
    };
    let summary: CandidateValidatedSummary;
    if (job.version !== 1) {
      if (!options.validateVisualReport) fail("visual-validator-unavailable");
      summary = options.validateVisualReport!(
        report as CandidateVisualReportBase,
        { ...context, preparation: preparation! },
      );
    } else
      summary = options.validateReport(
        report as CandidatePreparedReport,
        context,
      );
    if (
      !object(summary) ||
      !object(summary.counters) ||
      Object.entries(summary.counters).some(
        ([key, value]) =>
          !/^[a-z][a-zA-Z0-9-]*$/.test(key) ||
          !Number.isSafeInteger(value) ||
          value < 0,
      ) ||
      (summary.problems !== undefined &&
        (!Array.isArray(summary.problems) ||
          summary.problems.some(
            (value) =>
              typeof value !== "string" ||
              value.length > 160 ||
              !CODE.test(value),
          )))
    )
      fail("summary-invalid");
    if (summary.stateful !== undefined) {
      const inventory = summary.stateful;
      const count = (n: unknown) =>
        typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
      if (
        job.request.version !== 2 ||
        !object(inventory) ||
        Object.keys(inventory).some(
          (k) => !["booleanStates", "slots"].includes(k),
        ) ||
        !Array.isArray(inventory.booleanStates) ||
        inventory.booleanStates.length > 64 ||
        !Array.isArray(inventory.slots) ||
        inventory.slots.length > 64 ||
        inventory.booleanStates.some(
          (row) =>
            !object(row) ||
            Object.keys(row).some(
              (k) =>
                ![
                  "property",
                  "omitted",
                  "explicitFalse",
                  "explicitTrue",
                ].includes(k),
            ) ||
            typeof row.property !== "string" ||
            !/^[A-Za-z_$][\w$]*$/.test(row.property) ||
            row.property.length > 100 ||
            ![row.omitted, row.explicitFalse, row.explicitTrue].every(count),
        ) ||
        inventory.slots.some(
          (row) =>
            !object(row) ||
            Object.keys(row).some(
              (k) => !["name", "observedCases"].includes(k),
            ) ||
            typeof row.name !== "string" ||
            !/^[a-zA-Z0-9_-]{0,100}$/.test(row.name) ||
            !count(row.observedCases),
        )
      )
        fail("summary-invalid");
    }
    let verifiedPreparation = preparation;
    if (job.version !== 1) {
      const after = selectLatestPreparedVerified(job.request);
      if (
        !same(job.preparation, {
          id: after.id,
          reportSha256: after.reportSha256,
        })
      )
        fail("preparation-changed-during-validation");
      verifiedPreparation = after;
    }
    if (
      !selectionMatches(job, selected(job.request)) ||
      sha(read(job.id, "report.json")) !== digest ||
      !same(JSON.parse(read(job.id, "job.json").toString()), job)
    )
      fail("evidence-changed-during-validation");
    for (const [name, expected] of artifactDigests)
      if (sha(read(job.id, name)) !== expected)
        fail("evidence-changed-during-validation");
    return {
      digest,
      report,
      selection,
      preparation: verifiedPreparation,
      ...(summary.stateful
        ? { stateful: structuredClone(summary.stateful) }
        : {}),
      phase: report.status,
      counters: { ...summary.counters },
      problems: [...(summary.problems ?? [])],
    };
  };
  const snapshot = (job: AnyCandidateJobRecord): CandidateJobSnapshot => {
    const result: CandidateJobSnapshot = {
      id: job.id,
      ...(job.request.version === 2
        ? { component: "al-checkbox" as const }
        : {}),
      ...(job.version !== 1
        ? { operation: "source-visual-assembly" as const }
        : {}),
      state: job.state,
      phase:
        job.state === "running"
          ? job.version !== 1
            ? "assembling"
            : "preparing"
          : job.state === "complete"
            ? "prepared"
            : job.state,
      counters: {},
      problems: job.problem ? [job.problem] : [],
    };
    if (job.state === "complete") {
      try {
        const value = validate(job);
        result.phase = value.phase;
        result.counters = value.counters;
        if (value.stateful) result.stateful = value.stateful;
        result.problems = value.problems;
      } catch {
        result.state = "failed";
        result.phase = "failed";
        result.problems = ["candidate-evidence-unavailable-or-changed"];
      }
    }
    return result;
  };
  /** Reopen every record so a new attempt or a retargeted cached record cannot
   * make an older success look current. This is observation only, never replay. */
  const candidateHistory = (request: BindingEvidenceRequest) => {
    directories();
    const records: AnyCandidateJobRecord[] = [];
    const fingerprints: Array<[string, string]> = [];
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!UUID.test(entry.name)) continue;
      let value: unknown;
      let bytes: Buffer;
      try {
        bytes = read(entry.name, "job.json");
        value = JSON.parse(bytes.toString());
      } catch {
        fail("history-invalid");
      }
      if (!validRecord(value, entry.name)) {
        // Clearly attributed unrelated history is not evidence for this source.
        if (
          object(value) &&
          isBindingEvidenceRequest(value.request) &&
          value.request.baseline.id !== request.baseline.id
        )
          continue;
        fail("history-invalid");
      }
      const record = value as AnyCandidateJobRecord;
      // Fingerprint all records, including unrelated ones that could be retargeted.
      fingerprints.push([entry.name, sha(bytes!)]);
      if (
        record.request.baseline.id === request.baseline.id &&
        bindingComponent(record.request) === bindingComponent(request)
      )
        records.push(record);
    }
    records.sort(
      (a, b) =>
        a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id),
    );
    fingerprints.sort(([a], [b]) => a.localeCompare(b));
    return { records, fingerprint: JSON.stringify(fingerprints) };
  };
  const selectLatestPreparedVerified = (
    request: BindingEvidenceRequest,
  ): VerifiedCandidatePreparation => {
    if (!isBindingEvidenceRequest(request)) fail("request-invalid");
    const before = candidateHistory(request);
    const job = before.records.filter((record) => record.version === 1).at(-1);
    if (!job || job.state !== "complete" || !same(job.request, request))
      return fail("latest-preparation-unavailable");
    const checked = validate(job);
    if (candidateHistory(request).fingerprint !== before.fingerprint)
      fail("preparation-history-changed");
    return structuredClone({
      id: job.id,
      reportSha256: checked.digest,
      directory: directory(job.id),
      report: checked.report as CandidatePreparedReport,
      selection: checked.selection,
    });
  };
  const visualVersion = (): 2 | 3 => {
    const version =
      options.visualJobVersion === undefined ? 2 : options.visualJobVersion;
    if (version !== 2 && version !== 3) fail("visual-version-invalid");
    return version;
  };
  const evidenceFingerprint = (id: string): string => {
    const entries: Array<[string, string]> = [];
    const visit = (relative: string) => {
      const target = relative
        ? path.join(directory(id), relative)
        : directory(id);
      if (!lstatSync(target).isDirectory()) fail("artifact-file-refused");
      for (const child of readdirSync(target, { withFileTypes: true })) {
        const name = relative ? `${relative}/${child.name}` : child.name;
        if (child.isDirectory()) {
          entries.push([name, "directory"]);
          visit(name);
        } else entries.push([name, sha(read(id, name))]);
      }
    };
    visit("");
    return JSON.stringify(entries.sort(([a], [b]) => a.localeCompare(b)));
  };
  /** Select the latest visual attempt, never an earlier success or a previous
   * configured derivation version. Every call reopens and validates the
   * complete saved evidence; it cannot start or replay a worker. */
  const selectLatestVisualVerified = (
    request: BindingEvidenceRequest,
  ): VerifiedCandidateVisual => {
    if (!isBindingEvidenceRequest(request)) fail("request-invalid");
    const version = visualVersion();
    const before = candidateHistory(request);
    const job = before.records.filter((record) => record.version !== 1).at(-1);
    if (
      !job ||
      job.version !== version ||
      job.state !== "complete" ||
      !same(job.request, request)
    )
      return fail("latest-visual-unavailable");
    const preparationJob = before.records
      .filter((record) => record.version === 1)
      .at(-1);
    if (
      !preparationJob ||
      preparationJob.state !== "complete" ||
      !same(preparationJob.request, request)
    )
      return fail("latest-preparation-unavailable");
    const visualEvidence = evidenceFingerprint(job.id);
    const preparationEvidence = evidenceFingerprint(preparationJob.id);
    const checked = validate(job);
    if (checked.phase !== "measured-candidate" || !checked.preparation)
      fail("latest-visual-unavailable");
    if (candidateHistory(request).fingerprint !== before.fingerprint)
      fail("visual-history-changed");
    if (
      evidenceFingerprint(job.id) !== visualEvidence ||
      evidenceFingerprint(preparationJob.id) !== preparationEvidence
    )
      fail("evidence-changed-during-validation");
    return structuredClone({
      id: job.id,
      reportSha256: checked.digest,
      directory: directory(job.id),
      report: checked.report as CandidateVisualReportBase,
      preparation: checked.preparation!,
      selection: checked.selection,
    });
  };
  const ordered = () =>
    [...jobs.values()].sort(
      (a, b) =>
        a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id),
    );
  const start = (
    request: BindingEvidenceRequest,
    retry = false,
    visual = false,
  ): CandidateJobSnapshot => {
    if (closed) fail("closed");
    if (!isBindingEvidenceRequest(request) || typeof retry !== "boolean")
      fail("request-invalid");
    if (
      [...invalid.values()].some(
        (parent) => !parent || parent === request.baseline.id,
      )
    )
      fail("history-invalid");
    if (visual && request.version !== 1) fail("visual-component-unsupported");
    const version = visual ? visualVersion() : 1;
    const existing = ordered()
      .filter((job) => same(job.request, request) && job.version === version)
      .at(-1);
    if (existing && (existing.state === "running" || !retry))
      return snapshot(existing);
    if (active) fail("already-running");
    const preparation = visual
      ? selectLatestPreparedVerified(request)
      : undefined;
    if (visual && !options.validateVisualReport)
      fail("visual-validator-unavailable");
    const selection = selected(request);
    directories(true);
    // Strict monotonic job ordering survives same-millisecond retries.
    const previous = ordered().at(-1);
    const startedAt = new Date(
      Math.max(Date.now(), previous ? Date.parse(previous.startedAt) + 1 : 0),
    ).toISOString();
    const job: AnyCandidateJobRecord = {
      ...(visual
        ? {
            version: version as 2 | 3,
            operation: "source-visual-assembly" as const,
            preparation: {
              id: preparation!.id,
              reportSha256: preparation!.reportSha256,
            },
          }
        : { version: 1 as const }),
      id: randomUUID(),
      request: structuredClone(request),
      binding: { id: selection.id, reportSha256: selection.reportSha256 },
      sourceProgramSha256: selection.evidence.sourceProgramSha256,
      sourceRevision: selection.evidence.sourceRevision,
      state: "running",
      startedAt,
    };
    mkdirSync(path.join(root, job.id), { mode: 0o700 });
    save(job);
    jobs.set(job.id, job);
    const pending = { job, child: { kill: () => true } };
    active = pending;
    try {
      const child = execute(
        ["--import", "tsx", "source-reference/candidate-run.ts", job.id],
        (error) => {
          if (job.state !== "interrupted") {
            try {
              if (error) fail("run-failed");
              const checked = validate(job);
              job.reportSha256 = checked.digest;
              job.state = "complete";
            } catch {
              job.state = "failed";
              job.problem = visual
                ? "candidate-visual-assembly-failed"
                : "candidate-preparation-failed";
            }
            try {
              save(job);
            } catch {
              job.state = "failed";
              job.problem = "candidate-job-save-failed";
            }
          }
          if (active === pending) active = undefined;
        },
      );
      if (active === pending) pending.child = child;
      else if (job.state === "interrupted") child.kill();
    } catch {
      if (active === pending) active = undefined;
      job.state = "failed";
      job.problem = "candidate-launch-failed";
      try {
        save(job);
      } catch {
        /* Preserve partial evidence; never claim completion. */
      }
      fail("launch-failed");
    }
    return snapshot(job);
  };
  return {
    list(baselineId: string): CandidateJobSnapshot[] {
      if (!UUID.test(baselineId)) return [];
      return [
        ...ordered()
          .filter((job) => job.request.baseline.id === baselineId)
          .map(snapshot),
        ...[...invalid]
          .filter(([, parent]) => !parent || parent === baselineId)
          .map(([id]) => ({
            id,
            state: "failed" as const,
            phase: "failed" as const,
            counters: {},
            problems: ["candidate-job-history-invalid"],
          })),
      ];
    },
    get running() {
      return !!active;
    },
    start: (request: BindingEvidenceRequest, retry = false) =>
      start(request, retry),
    startVisual: (request: BindingEvidenceRequest, retry = false) =>
      start(request, retry, true),
    selectLatestPreparedVerified,
    selectLatestVisualVerified,
    close() {
      closed = true;
      if (active) {
        const pending = active;
        active = undefined;
        pending.job.state = "interrupted";
        try {
          save(pending.job);
        } catch {
          /* Recovery also interprets persisted running jobs as interrupted. */
        } finally {
          pending.child.kill();
        }
      }
    },
  };
}
