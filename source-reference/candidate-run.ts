/** Fixed local worker for an application-created candidate-preparation job.
 * No arbitrary CLI paths, recipe strings, source imports or report adoption. */
import { createHash } from "node:crypto";
import {
  lstatSync,
  readFileSync,
  mkdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { canonicalJson } from "../core/contract-provenance.js";
import {
  createBindingJobs,
  type VerifiedBindingSelection,
} from "./binding-jobs.js";
import {
  isBindingEvidenceRequest,
  type BindingEvidenceRequest,
} from "./binding-evidence.js";
import type { CandidateJobRecord } from "./candidate-jobs.js";
import {
  buildCandidatePreparationReport,
  type CandidatePreparationReport,
} from "./candidate-report.js";
import {
  inspectAltitudeButtonRuntimeInputs,
  prepareAltitudeButtonRuntime,
} from "./runtime-artifact.js";

export interface CandidateRunnerServices {
  selectLatestVerified?(
    request: BindingEvidenceRequest,
  ): VerifiedBindingSelection;
  inspectInputs?: typeof inspectAltitudeButtonRuntimeInputs;
  prepare?: typeof prepareAltitudeButtonRuntime;
}
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const fail = (code: string): never => {
  throw Error(`candidate-run-${code}`);
};

/** Injection is for host tests only; CLI and HTTP cannot choose these services.
 * The parent owns the process group and 180s deadline. The existing preparer
 * has its own 120s build bound, no source writes, and before/after inventory. */
export function runCandidateJob(
  repoRoot: string,
  id: string,
  services: CandidateRunnerServices = {},
): CandidatePreparationReport {
  const repository = path.resolve(repoRoot);
  if (!UUID.test(id)) fail("id-invalid");
  const directory = path.join(repository, "private/source-candidate-app", id);
  const directories = () => {
    const allowed =
      process.platform === "darwin"
        ? repository
            .replace(/^\/var(?=\/|$)/, "/private/var")
            .replace(/^\/tmp(?=\/|$)/, "/private/tmp")
        : repository;
    if (realpathSync(repository) !== allowed) fail("repository-refused");
    for (const dir of [
      repository,
      path.join(repository, "private"),
      path.dirname(directory),
      directory,
    ]) {
      if (!lstatSync(dir).isDirectory()) fail("directory-refused");
    }
  };
  const readJob = () => {
    directories();
    const file = path.join(directory, "job.json"),
      stat = lstatSync(file);
    if (!stat.isFile() || stat.size > 1024 * 1024) fail("metadata-refused");
    return readFileSync(file);
  };
  const jobBytes = readJob(),
    jobHash = sha(jobBytes);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jobBytes.toString());
  } catch {
    fail("metadata-invalid");
  }
  const job = parsed as CandidateJobRecord;
  if (
    !job ||
    job.version !== 1 ||
    job.id !== id ||
    job.state !== "running" ||
    Object.keys(job).some(
      (key) =>
        ![
          "version",
          "id",
          "request",
          "binding",
          "sourceProgramSha256",
          "sourceRevision",
          "state",
          "startedAt",
        ].includes(key),
    ) ||
    !isBindingEvidenceRequest(job.request) ||
    !job.binding ||
    Object.keys(job.binding).some(
      (key) => !["id", "reportSha256"].includes(key),
    ) ||
    !UUID.test(job.binding.id) ||
    !HASH.test(job.binding.reportSha256) ||
    !HASH.test(job.sourceProgramSha256) ||
    !/^[a-f0-9]{40}$/.test(job.sourceRevision) ||
    typeof job.startedAt !== "string" ||
    !Number.isFinite(Date.parse(job.startedAt)) ||
    new Date(job.startedAt).toISOString() !== job.startedAt
  )
    fail("metadata-invalid");
  for (const name of ["runtime", "report.json"]) {
    try {
      lstatSync(path.join(directory, name));
      fail("artifact-exists");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  const bindings = services.selectLatestVerified
    ? undefined
    : createBindingJobs(repository, () => {
        throw Error("candidate-run-binding-execution-forbidden");
      });
  const select =
    services.selectLatestVerified ?? bindings!.selectLatestVerified;
  const pinnedSelection = () => {
    const value = select(structuredClone(job.request));
    if (
      !value ||
      !same(value.request, job.request) ||
      value.id !== job.binding.id ||
      value.reportSha256 !== job.binding.reportSha256 ||
      value.evidence?.sourceRevision !== job.sourceRevision ||
      value.evidence.sourceProgramSha256 !== job.sourceProgramSha256 ||
      value.report?.sourceProgramSha256 !== job.sourceProgramSha256
    )
      fail("selected-evidence-changed");
    return value;
  };
  try {
    const selection = pinnedSelection();
    const checkout = path.resolve(repository, "../altitude");
    const inspect =
      services.inspectInputs ?? inspectAltitudeButtonRuntimeInputs;
    const inputs = inspect(checkout);
    if (inputs.sourceRevision !== selection.evidence.sourceRevision)
      fail("source-changed");
    directories();
    const outputRoot = path.join(directory, "runtime");
    mkdirSync(outputRoot, { mode: 0o700 });
    const artifact = (services.prepare ?? prepareAltitudeButtonRuntime)({
      checkout,
      expectedInputManifest: inputs,
      outputRoot,
      sourceApproval: {
        kind: "local-source-build",
        checkout,
        sourceRevision: inputs.sourceRevision,
        inputRevision: inputs.inputRevision,
        baseline: {
          path: path.join(
            repository,
            "private/source-reference-app",
            job.request.baseline.id,
            "measurement.json",
          ),
          sha256: job.request.baseline.sha256,
        },
      },
    });
    const current = pinnedSelection(),
      after = inspect(checkout);
    if (!same(inputs, after) || sha(readJob()) !== jobHash)
      fail("inputs-changed-during-preparation");
    const report = buildCandidatePreparationReport(current, artifact, after);
    directories();
    writeFileSync(
      path.join(directory, "report.json"),
      JSON.stringify(report, null, 2) + "\n",
      { flag: "wx", mode: 0o600 },
    );
    return report;
  } finally {
    bindings?.close();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  if (process.argv.length !== 3) {
    process.stderr.write("candidate-run-arguments-invalid\n");
    process.exitCode = 1;
  } else {
    try {
      const report = runCandidateJob(
        fileURLToPath(new URL("..", import.meta.url)),
        process.argv[2],
      );
      process.stdout.write(
        JSON.stringify({
          status: report.status,
          acceptedContract: null,
          qualification: report.qualification,
        }) + "\n",
      );
    } catch (error) {
      // Never print build logs, arbitrary error text, source paths or env data.
      const code =
        error instanceof Error &&
        /^(?:candidate|runtime-artifact|binding)-[a-z-]+$/.test(error.message)
          ? error.message
          : "candidate-run-operation-failed";
      process.stderr.write(code + "\n");
      process.exitCode = 1;
    }
  }
}
