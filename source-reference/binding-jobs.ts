import { execFile, type ChildProcess } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
} from "node:fs";
import path from "node:path";
import {
  loadBindingEvidence,
  isBindingEvidenceRequest,
  type BindingEvidenceRequest,
} from "./binding-evidence.js";
import type { BoundTopologyResult } from "./bound-topology.js";
import type { LitRenderMatch } from "./lit-render-match.js";
import type { BindingDifferentialResult } from "./binding-differential.js";
import { validateBindingReport } from "./binding-report.js";

export interface BindingTraceRow {
  story: string;
  status: "structure-matched" | "refused";
  problems: string[];
  matchedElements: number;
  mappedSlots: number;
  observedDependencies: number;
  plannedDependencies: number;
  boundTopology?: BoundTopologyResult;
  correspondence?: LitRenderMatch;
  differentials: Array<{
    key: string;
    problems: string[];
    result?: BindingDifferentialResult;
  }>;
}
export interface BindingTraceReport {
  version: 1;
  request: BindingEvidenceRequest;
  sourceProgramSha256: string;
  sourceStable: boolean;
  rows: BindingTraceRow[];
  scope: string;
}
interface BindingJobRecord {
  version: 1;
  id: string;
  request: BindingEvidenceRequest;
  sourceProgramSha256: string;
  stories: string[];
  state: "running" | "complete" | "failed" | "interrupted";
  startedAt: string;
  reportSha256?: string;
}
export interface BindingJobSnapshot {
  id: string;
  state: BindingJobRecord["state"];
  denominator: number;
  matched: number;
  rows: BindingTraceRow[];
  problems: string[];
}
type Launch = (
  args: string[],
  done: (error: unknown) => void,
) => Pick<ChildProcess, "kill">;
const sha = (bytes: string | Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

/** Local bounded replay jobs. No source/Figma writes, network target selection,
 * script paths or arbitrary CLI arguments are exposed to HTTP callers. */
export function createBindingJobs(repoRoot: string, launch?: Launch) {
  const root = path.join(repoRoot, "private/source-binding-app");
  const jobs = new Map<string, BindingJobRecord>();
  let active:
    { job: BindingJobRecord; child: Pick<ChildProcess, "kill"> } | undefined;
  const execute: Launch =
    launch ??
    ((args, done) =>
      execFile(
        process.execPath,
        args,
        { cwd: repoRoot, timeout: 240000, maxBuffer: 1024 * 1024 },
        (error) => done(error),
      ));
  const directories = (create = false) => {
    if (!lstatSync(repoRoot).isDirectory())
      throw Error("binding-job-repository-refused");
    for (const dir of [path.join(repoRoot, "private"), root]) {
      try {
        if (!lstatSync(dir).isDirectory())
          throw Error("binding-job-directory-refused");
      } catch (error) {
        if (create && (error as NodeJS.ErrnoException).code === "ENOENT")
          mkdirSync(dir);
        else throw error;
      }
    }
  };
  const jobDirectory = (id: string) => {
    directories();
    if (!UUID.test(id) || !lstatSync(path.join(root, id)).isDirectory())
      throw Error("binding-job-directory-refused");
    return path.join(root, id);
  };
  const safeFile = (id: string, name: string) => {
    if (!UUID.test(id)) throw Error("binding-job-id-invalid");
    const dir = jobDirectory(id),
      file = path.join(dir, name);
    if (
      !lstatSync(root).isDirectory() ||
      !lstatSync(dir).isDirectory() ||
      !lstatSync(file).isFile()
    )
      throw Error("binding-job-file-unavailable");
    return file;
  };
  const save = (job: BindingJobRecord) => {
    const dir = jobDirectory(job.id),
      target = path.join(dir, "job.json");
    try {
      if (!lstatSync(target).isFile())
        throw Error("binding-job-metadata-refused");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    // A fresh exclusive file + rename never truncates a linked existing inode.
    const temporary = path.join(dir, `job-${randomUUID()}.tmp`);
    writeFileSync(temporary, JSON.stringify(job, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    jobDirectory(job.id);
    renameSync(temporary, target);
  };
  const report = (job: BindingJobRecord): BindingTraceReport => {
    const bytes = readFileSync(safeFile(job.id, "report.json"));
    if (job.reportSha256 && sha(bytes) !== job.reportSha256)
      throw Error("binding-report-changed");
    const parsed = JSON.parse(bytes.toString()) as BindingTraceReport;
    if (
      parsed.version !== 1 ||
      !same(parsed.request, job.request) ||
      parsed.sourceProgramSha256 !== job.sourceProgramSha256 ||
      parsed.sourceStable !== true ||
      !Array.isArray(parsed.rows) ||
      parsed.rows.length !== job.stories.length ||
      !job.stories.every(
        (story) =>
          parsed.rows.filter((row) => row.story === story).length === 1,
      ) ||
      parsed.rows.some(
        (row) =>
          !["structure-matched", "refused"].includes(row.status) ||
          !Array.isArray(row.problems) ||
          row.problems.some((p) => typeof p !== "string") ||
          ![
            row.matchedElements,
            row.mappedSlots,
            row.observedDependencies,
            row.plannedDependencies,
          ].every((n) => Number.isSafeInteger(n) && n >= 0) ||
          row.observedDependencies > row.plannedDependencies,
      )
    )
      throw Error("binding-report-incomplete-or-invalid");
    validateBindingReport(
      parsed,
      loadBindingEvidence(repoRoot, job.request),
      (story, name) => {
        if (
          !job.stories.includes(story) ||
          !/^(?:replay|probe-[0-2]-case-[0-2]-(?:before|after))\.png$/.test(
            name,
          )
        )
          throw Error("binding-image-path-refused");
        const dir = path.join(jobDirectory(job.id), story);
        if (!lstatSync(dir).isDirectory())
          throw Error("binding-image-directory-refused");
        return readFileSync(safeFile(job.id, `${story}/${name}`));
      },
    );
    return parsed;
  };
  try {
    directories();
    for (const dir of readdirSync(root, { withFileTypes: true })) {
      if (!dir.isDirectory() || !UUID.test(dir.name)) continue;
      try {
        const job = JSON.parse(
          readFileSync(safeFile(dir.name, "job.json"), "utf8"),
        ) as BindingJobRecord;
        if (
          job.version !== 1 ||
          job.id !== dir.name ||
          !isBindingEvidenceRequest(job.request) ||
          !Array.isArray(job.stories) ||
          !job.stories.length ||
          job.stories.some(
            (story) =>
              typeof story !== "string" ||
              !/^atoms-button--[a-z-]+$/.test(story),
          ) ||
          new Set(job.stories).size !== job.stories.length ||
          !/^[a-f0-9]{64}$/.test(job.sourceProgramSha256) ||
          (job.reportSha256 !== undefined &&
            !/^[a-f0-9]{64}$/.test(job.reportSha256)) ||
          (job.state === "complete" && !job.reportSha256) ||
          !Number.isFinite(Date.parse(job.startedAt)) ||
          !["running", "complete", "failed", "interrupted"].includes(job.state)
        )
          continue;
        if (job.state === "running") job.state = "interrupted";
        jobs.set(job.id, job);
      } catch {
        /* Incompatible/corrupt private evidence is preserved, not adopted. */
      }
    }
  } catch {
    /* No prior local binding jobs. */
  }
  function snapshot(job: BindingJobRecord): BindingJobSnapshot {
    const result: BindingJobSnapshot = {
      id: job.id,
      state: job.state,
      denominator: job.stories.length,
      matched: 0,
      rows: [],
      problems: [],
    };
    if (job.state !== "complete") return result;
    try {
      // Recheck actual original artifacts and source bytes when reopening;
      // an old completed job is never permission to use changed inputs.
      const current = loadBindingEvidence(repoRoot, job.request);
      if (
        current.sourceProgramSha256 !== job.sourceProgramSha256 ||
        !same(
          current.rows.map((row) => row.story),
          job.stories,
        )
      )
        throw Error("binding-job-source-changed");
      const value = report(job);
      for (const row of value.rows)
        if (
          row.status === "structure-matched" &&
          !current.rows.find((input) => input.story === row.story)?.eligible
        )
          throw Error("binding-job-evidence-changed");
      result.rows = value.rows;
      result.matched = value.rows.filter(
        (row) => row.status === "structure-matched",
      ).length;
    } catch {
      result.state = "failed";
      result.problems.push(
        "Recorded binding evidence is incomplete, changed or no longer matches its source.",
      );
    }
    return result;
  }
  return {
    list(baselineId: string) {
      return [...jobs.values()]
        .filter((job) => job.request.baseline.id === baselineId)
        .sort(
          (a, b) =>
            a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id),
        )
        .map(snapshot);
    },
    image(id: string, story: string, name: string): Buffer | undefined {
      try {
        const job = jobs.get(id);
        if (
          !job ||
          job.state !== "complete" ||
          !job.stories.includes(story) ||
          !/^(?:replay|probe-[0-2]-case-[0-2]-(?:before|after))\.png$/.test(
            name,
          )
        )
          return;
        // Re-derive the report and image digests before displaying evidence.
        const value = report(job),
          row = value.rows.find((row) => row.story === story)!;
        const probe = /^probe-([0-2])-case-([0-2])-(before|after)\.png$/.exec(
          name,
        );
        const expected = probe
          ? row.differentials[Number(probe[1])]?.result?.cases[
              Number(probe[2])
            ]?.[probe[3] === "before" ? "beforePngSha256" : "afterPngSha256"]
          : row.correspondence?.sourcePngSha256;
        if (!expected) return;
        const dir = path.join(jobDirectory(id), story);
        if (!lstatSync(dir).isDirectory()) return;
        const bytes = readFileSync(safeFile(id, `${story}/${name}`));
        return sha(bytes) === expected ? bytes : undefined;
      } catch {
        return;
      }
    },
    get running() {
      return !!active;
    },
    start(request: BindingEvidenceRequest, retry = false): BindingJobSnapshot {
      const existing = [...jobs.values()]
        .filter((job) => same(job.request, request))
        .sort(
          (a, b) =>
            a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id),
        )
        .at(-1);
      if (
        existing &&
        (existing.state === "running" ||
          (existing.state === "complete" && !retry))
      )
        return snapshot(existing);
      if (active) throw Error("A recorded-source replay is already running.");
      const evidence = loadBindingEvidence(repoRoot, request);
      directories(true);
      const job: BindingJobRecord = {
        version: 1,
        id: randomUUID(),
        request,
        sourceProgramSha256: evidence.sourceProgramSha256,
        stories: evidence.rows.map((row) => row.story),
        state: "running",
        startedAt: new Date().toISOString(),
      };
      mkdirSync(path.join(root, job.id));
      save(job);
      jobs.set(job.id, job);
      const pending = {
        job,
        child: { kill: () => true } as Pick<ChildProcess, "kill">,
      };
      active = pending;
      try {
        const child = execute(
          [
            "--import",
            "tsx",
            "source-reference/binding-run.ts",
            path.join(root, job.id),
          ],
          () => {
            if (job.state !== "interrupted") {
              try {
                report(job);
                job.reportSha256 = sha(
                  readFileSync(safeFile(job.id, "report.json")),
                );
                job.state = "complete";
              } catch {
                job.state = "failed";
              }
              try {
                save(job);
              } catch {
                job.state = "failed";
              }
            }
            if (active?.job.id === job.id) active = undefined;
          },
        );
        if (active === pending) pending.child = child;
        else if (job.state === "interrupted") child.kill("SIGTERM");
      } catch {
        if (active === pending) active = undefined;
        job.state = "failed";
        try {
          save(job);
        } catch {}
        throw Error("Recorded-source replay could not start.");
      }
      return snapshot(job);
    },
    close() {
      if (active) {
        active.job.state = "interrupted";
        try {
          save(active.job);
        } catch {
        } finally {
          active.child.kill("SIGTERM");
          active = undefined;
        }
      }
    },
  };
}
