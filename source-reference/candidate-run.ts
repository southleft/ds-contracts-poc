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
import {
  createCandidateJobs,
  type AnyCandidateJobRecord,
  type VerifiedCandidatePreparation,
} from "./candidate-jobs.js";
import {
  buildCandidatePreparationReport,
  createCandidatePreparationValidator,
  type CandidatePreparationReport,
} from "./candidate-report.js";
import {
  buildCandidateVisualReport,
  readCandidateVisualTokens,
  type CandidateVisualReport,
} from "./candidate-visual-report.js";
import {
  inspectAltitudeButtonRuntimeInputs,
  prepareAltitudeButtonRuntime,
  readVerifiedRuntimeArtifact,
} from "./runtime-artifact.js";

export interface CandidateRunnerServices {
  selectLatestVerified?(
    request: BindingEvidenceRequest,
  ): VerifiedBindingSelection;
  inspectInputs?: typeof inspectAltitudeButtonRuntimeInputs;
  prepare?: typeof prepareAltitudeButtonRuntime;
  selectLatestPreparedVerified?(
    request: BindingEvidenceRequest,
  ): VerifiedCandidatePreparation;
  readVisualTokens?: typeof readCandidateVisualTokens;
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
): CandidatePreparationReport | CandidateVisualReport {
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
  const job = parsed as AnyCandidateJobRecord;
  if (
    !job ||
    ![1, 2].includes(job.version) ||
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
          ...(job.version === 2 ? ["operation", "preparation"] : []),
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
  if (
    job.version === 2 &&
    (job.operation !== "source-visual-assembly" ||
      !job.preparation ||
      Object.keys(job.preparation).some(
        (key) => !["id", "reportSha256"].includes(key),
      ) ||
      typeof job.preparation.id !== "string" ||
      !UUID.test(job.preparation.id) ||
      job.preparation.id === id ||
      typeof job.preparation.reportSha256 !== "string" ||
      !HASH.test(job.preparation.reportSha256))
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
    if (job.version === 2) {
      // A fresh manager per observation sees newer preparation attempts added
      // during assembly. Its recovery is in-memory only; no worker is launched.
      const selectPreparation =
        services.selectLatestPreparedVerified ??
        ((request: BindingEvidenceRequest) => {
          const candidates = createCandidateJobs(repository, {
            selectLatestVerified: select,
            validateReport: createCandidatePreparationValidator(inspect),
            run: () => fail("preparation-execution-forbidden"),
          });
          try {
            return candidates.selectLatestPreparedVerified(request);
          } finally {
            candidates.close();
          }
        });
      const pinnedPreparation = (current: VerifiedBindingSelection) => {
        const parent = selectPreparation(structuredClone(job.request));
        const parentDirectory = path.join(
          repository,
          "private/source-candidate-app",
          job.preparation.id,
        );
        if (
          !parent ||
          parent.id !== job.preparation.id ||
          parent.reportSha256 !== job.preparation.reportSha256 ||
          parent.directory !== parentDirectory ||
          !same(parent.selection, current)
        )
          fail("selected-preparation-changed");
        directories();
        if (!lstatSync(parentDirectory).isDirectory())
          fail("preparation-directory-refused");
        const readParent = (name: string) => {
          const file = path.join(parentDirectory, name),
            stat = lstatSync(file);
          if (!stat.isFile() || stat.size > 64 * 1024 * 1024)
            fail("preparation-file-refused");
          return readFileSync(file);
        };
        const reportBytes = readParent("report.json"),
          metadataBytes = readParent("job.json"),
          metadata = JSON.parse(metadataBytes.toString());
        if (
          sha(reportBytes) !== job.preparation.reportSha256 ||
          !same(JSON.parse(reportBytes.toString()), parent.report) ||
          metadata.version !== 1 ||
          metadata.id !== parent.id ||
          metadata.state !== "complete" ||
          metadata.reportSha256 !== parent.reportSha256 ||
          !same(metadata.request, job.request) ||
          !same(metadata.binding, job.binding) ||
          metadata.sourceRevision !== job.sourceRevision ||
          metadata.sourceProgramSha256 !== job.sourceProgramSha256
        )
          fail("selected-preparation-changed");
        const report = parent.report as CandidatePreparationReport;
        if (
          !report.runtime ||
          typeof report.runtime.artifactRevision !== "string" ||
          !/^sha256:[a-f0-9]{64}$/.test(report.runtime.artifactRevision)
        )
          fail("preparation-runtime-invalid");
        return {
          parent,
          report,
          metadataHash: sha(metadataBytes),
          artifactDirectory: path.join(
            parentDirectory,
            "runtime",
            report.runtime.artifactRevision.slice(7),
          ),
        };
      };
      const prepared = pinnedPreparation(selection),
        inputs = inspect(checkout),
        artifact = readVerifiedRuntimeArtifact(
          prepared.artifactDirectory,
          prepared.report.runtime.artifactRevision,
        );
      const expectedPreparation = buildCandidatePreparationReport(
        selection,
        artifact,
        inputs,
      );
      if (!same(expectedPreparation, prepared.report))
        fail("preparation-report-changed");
      const readTokens = services.readVisualTokens ?? readCandidateVisualTokens,
        tokens = readTokens(repository);
      const report = buildCandidateVisualReport(
        {
          id: prepared.parent.id,
          reportSha256: prepared.parent.reportSha256,
          report: expectedPreparation,
        },
        selection,
        tokens,
      );
      const current = pinnedSelection(),
        currentPreparation = pinnedPreparation(current),
        after = inspect(checkout);
      // Opening again verifies every runtime byte without importing its module.
      // The immutable manifest digest pins the complete file inventory.
      const afterArtifact = readVerifiedRuntimeArtifact(
        currentPreparation.artifactDirectory,
        currentPreparation.report.runtime.artifactRevision,
      );
      if (
        !same(selection, current) ||
        !same(inputs, after) ||
        prepared.metadataHash !== currentPreparation.metadataHash ||
        !same(prepared.report, currentPreparation.report) ||
        !same(artifact.manifest, afterArtifact.manifest) ||
        !same(tokens, readTokens(repository)) ||
        sha(readJob()) !== jobHash
      )
        fail("inputs-changed-during-assembly");
      directories();
      writeFileSync(
        path.join(directory, "report.json"),
        JSON.stringify(report, null, 2) + "\n",
        { flag: "wx", mode: 0o600 },
      );
      return report;
    }
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
