import { spawn } from "node:child_process";
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
export interface CandidatePreparedReport {
  version: 1;
  request: BindingEvidenceRequest;
  binding: CandidateJobRecord["binding"];
  sourceProgramSha256: string;
  status: "prepared";
  acceptedContract: null;
  [key: string]: unknown;
}
export interface CandidateJobSnapshot {
  id: string;
  state: CandidateState;
  phase: "preparing" | "prepared" | "failed" | "interrupted";
  counters: Record<string, number>;
  problems: string[];
}
export interface CandidateValidationContext {
  /** Server-only fixed private job directory. Never included in snapshots. */
  directory: string;
  selection: VerifiedBindingSelection;
  readArtifact(relativePath: string): Buffer;
}
export interface CandidateValidatedSummary {
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
    const kill = () => {
      if (!child.pid) return false;
      try {
        process.kill(-child.pid, "SIGKILL");
        return true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
        throw error;
      }
    };
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
  const jobs = new Map<string, CandidateJobRecord>();
  const invalid = new Map<string, string | undefined>();
  let closed = false;
  let active:
    { job: CandidateJobRecord; child: ReturnType<CandidateRun> } | undefined;
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
  const save = (job: CandidateJobRecord) => {
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
  ): value is CandidateJobRecord =>
    object(value) &&
    value.version === 1 &&
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
    job: CandidateJobRecord,
    value: VerifiedBindingSelection,
  ) =>
    same(job.binding, { id: value.id, reportSha256: value.reportSha256 }) &&
    job.sourceProgramSha256 === value.evidence.sourceProgramSha256 &&
    job.sourceRevision === value.evidence.sourceRevision;
  const validate = (job: CandidateJobRecord) => {
    if (!same(JSON.parse(read(job.id, "job.json").toString()), job))
      fail("metadata-changed");
    const selection = selected(job.request);
    if (!selectionMatches(job, selection)) fail("source-changed");
    const bytes = read(job.id, "report.json"),
      digest = sha(bytes);
    if (job.reportSha256 && digest !== job.reportSha256) fail("report-changed");
    const report = JSON.parse(bytes.toString()) as CandidatePreparedReport;
    if (
      !object(report) ||
      report.version !== 1 ||
      !same(report.request, job.request) ||
      !same(report.binding, job.binding) ||
      report.sourceProgramSha256 !== job.sourceProgramSha256 ||
      report.status !== "prepared" ||
      report.acceptedContract !== null
    )
      fail("report-invalid");
    const summary = options.validateReport(report, {
      directory: directory(job.id),
      selection,
      readArtifact: (name) => read(job.id, name),
    });
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
    if (
      !selectionMatches(job, selected(job.request)) ||
      sha(read(job.id, "report.json")) !== digest ||
      !same(JSON.parse(read(job.id, "job.json").toString()), job)
    )
      fail("evidence-changed-during-validation");
    return {
      digest,
      counters: { ...summary.counters },
      problems: [...(summary.problems ?? [])],
    };
  };
  const snapshot = (job: CandidateJobRecord): CandidateJobSnapshot => {
    const result: CandidateJobSnapshot = {
      id: job.id,
      state: job.state,
      phase:
        job.state === "running"
          ? "preparing"
          : job.state === "complete"
            ? "prepared"
            : job.state,
      counters: {},
      problems: job.problem ? [job.problem] : [],
    };
    if (job.state === "complete") {
      try {
        const value = validate(job);
        result.counters = value.counters;
        result.problems = value.problems;
      } catch {
        result.state = "failed";
        result.phase = "failed";
        result.problems = ["candidate-evidence-unavailable-or-changed"];
      }
    }
    return result;
  };
  const ordered = () =>
    [...jobs.values()].sort(
      (a, b) =>
        a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id),
    );
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
    start(
      request: BindingEvidenceRequest,
      retry = false,
    ): CandidateJobSnapshot {
      if (closed) fail("closed");
      if (!isBindingEvidenceRequest(request) || typeof retry !== "boolean")
        fail("request-invalid");
      if (
        [...invalid.values()].some(
          (parent) => !parent || parent === request.baseline.id,
        )
      )
        fail("history-invalid");
      const existing = ordered()
        .filter((job) => same(job.request, request))
        .at(-1);
      if (existing && (existing.state === "running" || !retry))
        return snapshot(existing);
      if (active) fail("already-running");
      const selection = selected(request);
      directories(true);
      // Strict monotonic job ordering survives same-millisecond retries.
      const previous = ordered().at(-1);
      const startedAt = new Date(
        Math.max(Date.now(), previous ? Date.parse(previous.startedAt) + 1 : 0),
      ).toISOString();
      const job: CandidateJobRecord = {
        version: 1,
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
                job.problem = "candidate-preparation-failed";
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
    },
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
