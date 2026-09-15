import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright-core";
import {
  isBindingEvidenceRequest,
  loadBindingEvidence,
  type BindingEvidenceRequest,
} from "./binding-evidence.js";
import {
  planBindingInterventions,
  type BindingProbeKey,
} from "./binding-plan.js";
import {
  captureBoundSourceTopology,
  type BoundTopologyResult,
} from "./bound-topology.js";
import { matchLitRender, type LitRenderMatch } from "./lit-render-match.js";
import {
  probeBindingDifferential,
  type BindingDifferentialResult,
} from "./binding-differential.js";
import { replayReference } from "./replay.js";

export interface BindingRunDifferential {
  key: BindingProbeKey;
  problems: string[];
  result?: BindingDifferentialResult;
}
export interface BindingRunRow {
  story: string;
  status: "structure-matched" | "refused";
  problems: string[];
  matchedElements: number;
  mappedSlots: number;
  observedDependencies: number;
  plannedDependencies: number;
  boundTopology?: BoundTopologyResult;
  correspondence?: LitRenderMatch;
  differentials: BindingRunDifferential[];
}
export interface BindingRunReport {
  version: 1;
  request: BindingEvidenceRequest;
  sourceProgramSha256: string;
  sourceStable: boolean;
  rows: BindingRunRow[];
  scope: string;
}
const sha = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
const same = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const hash = /^[a-f0-9]{64}$/;
const codeOf = (error: unknown) =>
  error instanceof Error &&
  /^(?:binding|bound|render|differential)-[a-z-]+$/.test(error.message)
    ? error.message
    : "binding-replay-operation-failed";
function fail(code: string): never {
  throw new Error(code);
}

/** Run only an application-created job directory. Fresh exclusive artifacts
 * never overwrite a previous run, source reference, archive or owner history.
 * The app owns scheduling/timeout/recovery; this process also stops its browser
 * at 220 seconds so the parent's 240-second deadline has cleanup headroom.
 */
export async function runBindingJob(
  repoRoot: string,
  jobDirectory: string,
): Promise<BindingRunReport> {
  const repository = path.resolve(repoRoot),
    privateRoot = path.join(repository, "private"),
    jobsRoot = path.join(privateRoot, "source-binding-app"),
    directory = path.resolve(jobDirectory),
    id = path.basename(directory);
  const assertDirectory = () => {
    if (!uuid.test(id) || directory !== path.join(jobsRoot, id))
      fail("binding-run-job-directory-invalid");
    for (const dir of [repository, privateRoot, jobsRoot, directory]) {
      const stat = lstatSync(dir);
      if (stat.isSymbolicLink() || !stat.isDirectory())
        fail("binding-run-directory-refused");
    }
  };
  const readJob = () => {
    assertDirectory();
    const file = path.join(directory, "job.json"),
      stat = lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile())
      fail("binding-run-job-file-refused");
    return readFileSync(file);
  };
  const jobBytes = readJob(),
    jobSha256 = sha(jobBytes);
  const job = JSON.parse(jobBytes.toString());
  if (
    job.version !== 1 ||
    job.id !== id ||
    job.state !== "running" ||
    !isBindingEvidenceRequest(job.request) ||
    !hash.test(job.sourceProgramSha256) ||
    !Array.isArray(job.stories) ||
    !job.stories.every(
      (story: unknown) =>
        typeof story === "string" && /^[a-z0-9-]+$/.test(story),
    ) ||
    new Set(job.stories).size !== job.stories.length ||
    !Number.isFinite(Date.parse(job.startedAt))
  )
    fail("binding-run-job-invalid");
  const evidence = loadBindingEvidence(repository, job.request);
  if (
    job.sourceProgramSha256 !== evidence.sourceProgramSha256 ||
    !same(
      job.stories,
      evidence.rows.map((row) => row.story),
    ) ||
    evidence.rows.length !== (job.request.supplement ? 7 : 4)
  )
    fail("binding-run-job-evidence-mismatch");
  const report: BindingRunReport = {
    version: 1,
    request: evidence.request,
    sourceProgramSha256: evidence.sourceProgramSha256,
    sourceStable: false,
    rows: evidence.rows.map((row) => ({
      story: row.story,
      status: "refused",
      problems: ["binding-row-not-run"],
      matchedElements: 0,
      mappedSlots: 0,
      observedDependencies: 0,
      plannedDependencies: planBindingInterventions(row.story).length,
      differentials: planBindingInterventions(row.story).map((plan) => ({
        key: plan.key,
        problems: [...plan.problems],
      })),
    })),
    scope:
      "Recorded Altitude Button evidence only: four original rows and, when requested, three separately recorded variant rows retain their original source refusals. Eligible originals are replayed in fresh HAR-only contexts and joined to exact source AST/DOM identities. Only the default story receives three finite dependency probes; changed images are probe artifacts, never replacement answer keys. Structure-matched is not behavior acceptance, an accepted Contract, Figma output, fresh Altitude, a complete API/variant proof or a release grade. sourceStable records revalidated input identity before/after this run, not a continuous source mutation monitor.",
  };
  const write = (relative: string, bytes: string | Uint8Array) => {
    assertDirectory();
    const parts = relative.split("/");
    if (
      parts.length > 2 ||
      parts.some(
        (part) =>
          !/^[a-z0-9][a-z0-9.-]*$/.test(part) || part === "." || part === "..",
      )
    )
      fail("binding-run-artifact-name-invalid");
    if (parts.length === 2) {
      if (!job.stories.includes(parts[0]))
        fail("binding-run-story-directory-invalid");
      const stat = lstatSync(path.join(directory, parts[0]));
      if (stat.isSymbolicLink() || !stat.isDirectory())
        fail("binding-run-story-directory-refused");
    }
    writeFileSync(path.join(directory, ...parts), bytes, {
      flag: "wx",
      mode: 0o600,
    });
  };
  const json = (relative: string, value: unknown) =>
    write(relative, JSON.stringify(value, null, 2) + "\n");
  // Claim every row directory before launching a browser. A retry must get a
  // new job UUID; existing artifacts are never silently adopted or overwritten.
  for (const name of ["report.json", ...report.rows.map((row) => row.story)]) {
    try {
      lstatSync(path.join(directory, name));
      fail("binding-run-artifact-exists");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  for (const row of report.rows) {
    assertDirectory();
    mkdirSync(path.join(directory, row.story), { mode: 0o700 });
  }
  let browser: Browser | undefined;
  let stopReason: string | undefined;
  let browserProblem: string | undefined;
  const stop = (reason: string) => {
    stopReason ??= reason;
    void browser?.close().catch(() => undefined);
  };
  const onTerminate = () => stop("binding-run-interrupted");
  const timeout = setTimeout(
    () => stop("binding-run-deadline-exceeded"),
    220000,
  );
  timeout.unref();
  process.once("SIGTERM", onTerminate);
  process.once("SIGINT", onTerminate);
  try {
    try {
      browser = await chromium.launch({ headless: true, timeout: 30000 });
    } catch {
      browserProblem = "binding-browser-unavailable";
    }
    if (stopReason) await browser?.close().catch(() => undefined);
    for (const [index, original] of evidence.rows.entries()) {
      const row = report.rows[index];
      row.problems = [...original.problems];
      try {
        if (
          !original.eligible ||
          !original.replay ||
          !original.semantics ||
          !original.topology
        ) {
          row.problems.push("binding-original-source-refused");
        } else if (stopReason || browserProblem || !browser) {
          row.problems.push(
            stopReason ?? browserProblem ?? "binding-browser-unavailable",
          );
        } else {
          if (
            sha(readFileSync(original.replay.harPath)) !==
            original.replay.harSha256
          )
            fail("binding-run-archive-changed");
          const reference = await replayReference(
            browser,
            original.replay.harPath,
            original.replay.url,
            original.profile,
            undefined,
            (page) =>
              captureBoundSourceTopology(page, {
                topology: original.topology!,
                semantics: original.semantics!,
              }),
          );
          write(`${row.story}/replay.png`, reference.screenshot);
          const {
            screenshot: _screenshot,
            inspection,
            ...rawReference
          } = reference;
          json(`${row.story}/reference.json`, rawReference);
          if (
            reference.status !== "valid" ||
            reference.secondSha256 !== original.semantics.sourcePngSha256
          ) {
            row.problems.push(
              "binding-run-original-reference-mismatch",
              ...reference.problems,
            );
          }
          if (
            sha(readFileSync(original.replay.harPath)) !==
            original.replay.harSha256
          )
            row.problems.push("binding-run-archive-changed");
          if (inspection) row.boundTopology = inspection;
          if (!row.problems.length && inspection) {
            row.correspondence = matchLitRender({
              source: evidence.source,
              semantics: original.semantics,
              boundTopology: inspection,
            });
            row.problems.push(
              ...inspection.problems,
              ...row.correspondence.problems,
            );
            if (row.correspondence.status === "structure-matched") {
              row.status = "structure-matched";
              row.matchedElements = row.correspondence.nodes.length;
              row.mappedSlots = row.correspondence.slots.length;
            }
          } else if (!inspection)
            row.problems.push("binding-run-topology-unavailable");
        }
      } catch (error) {
        row.problems.push(codeOf(error));
      }
      const plans = planBindingInterventions(
        row.story,
        row.correspondence,
        row.boundTopology,
      );
      row.plannedDependencies = plans.length;
      row.differentials = [];
      for (const [probeIndex, plan] of plans.entries()) {
        const differential: BindingRunDifferential = {
          key: plan.key,
          problems: [...plan.problems],
        };
        row.differentials.push(differential);
        if (plan.intervention && !plan.problems.length) {
          if (
            stopReason ||
            !browser ||
            !original.replay ||
            !original.semantics ||
            row.status !== "structure-matched"
          )
            differential.problems.push(
              stopReason ?? "binding-probe-evidence-unavailable",
            );
          else
            try {
              differential.result = await probeBindingDifferential(
                browser,
                {
                  replay: { ...original.replay, profile: original.profile },
                  source: evidence.source,
                  semantics: original.semantics,
                  intervention: plan.intervention,
                },
                {
                  onImages: (caseIndex, before, after) => {
                    write(
                      `${row.story}/probe-${probeIndex}-case-${caseIndex}-before.png`,
                      before,
                    );
                    write(
                      `${row.story}/probe-${probeIndex}-case-${caseIndex}-after.png`,
                      after,
                    );
                  },
                },
              );
              differential.problems.push(...differential.result.problems);
            } catch (error) {
              differential.problems.push(codeOf(error));
            }
        }
        differential.problems = [...new Set(differential.problems)];
        if (
          !differential.problems.length &&
          differential.result?.status === "dependency-observed"
        )
          row.observedDependencies++;
        row.problems.push(...differential.problems);
      }
      row.problems = [...new Set(row.problems)];
      json(`${row.story}/bound-topology.json`, row.boundTopology ?? null);
      json(`${row.story}/correspondence.json`, row.correspondence ?? null);
      json(`${row.story}/differentials.json`, row.differentials);
    }
  } finally {
    clearTimeout(timeout);
    process.removeListener("SIGTERM", onTerminate);
    process.removeListener("SIGINT", onTerminate);
    try {
      await browser?.close();
    } catch {
      for (const row of report.rows)
        row.problems.push("binding-browser-close-failed");
    }
  }
  try {
    // The loader rechecks source program, original measurements, PNGs/trees,
    // semantic evidence and HAR digests without changing any recorded source.
    const current = loadBindingEvidence(repository, evidence.request);
    report.sourceStable = same(current, evidence);
  } catch {
    report.sourceStable = false;
  }
  if (!report.sourceStable)
    for (const row of report.rows) {
      row.status = "refused";
      row.problems.push("binding-run-source-changed");
    }
  // Parent cancellation/restart changes job metadata. Preserve partial private
  // row evidence, but never publish a completed report for that stale process.
  if (sha(readJob()) !== jobSha256) fail("binding-run-job-changed");
  for (const row of report.rows) json(`${row.story}/row.json`, row);
  json("report.json", report);
  return report;
}

// Importing the pure plan or runner types must not execute a CLI or launch a
// browser. The executable accepts exactly the application-owned job directory.
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv.length !== 3) {
    process.stderr.write("binding-run-arguments-invalid\n");
    process.exitCode = 1;
  } else {
    const repository = fileURLToPath(new URL("..", import.meta.url));
    runBindingJob(repository, process.argv[2])
      .then((report) => {
        process.stdout.write(
          JSON.stringify({
            version: report.version,
            rows: report.rows.length,
            matched: report.rows.filter(
              (row) => row.status === "structure-matched",
            ).length,
            plannedDependencies: report.rows.reduce(
              (sum, row) => sum + row.plannedDependencies,
              0,
            ),
            observedDependencies: report.rows.reduce(
              (sum, row) => sum + row.observedDependencies,
              0,
            ),
            sourceStable: report.sourceStable,
          }) + "\n",
        );
      })
      .catch((error) => {
        process.stderr.write(codeOf(error) + "\n");
        process.exitCode = 1;
      });
  }
}
