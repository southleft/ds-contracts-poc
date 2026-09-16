import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { VerifiedBindingSelection } from "./binding-jobs.js";
import {
  createCandidateJobs,
  type AnyCandidateJobRecord,
  type CandidateJobRecord,
  type CandidateJobsOptions,
  type CandidateVisualJobRecord,
} from "./candidate-jobs.js";

const sha = (bytes: string | Buffer) =>
  createHash("sha256").update(bytes).digest("hex");

/** Synthetic trusted validators test the read-only orchestration boundary.
 * They authenticate complete reports and exact artifact/token values; these
 * fixtures do not claim source, runtime or native qualification. */
function fixture() {
  const repo = realpathSync(
    mkdtempSync(path.join(tmpdir(), "candidate-native-selection-")),
  );
  const root = path.join(repo, "private/source-candidate-app");
  mkdirSync(root, { recursive: true });
  const request = {
    version: 1 as const,
    baseline: {
      id: "00000000-0000-4000-8000-000000000001",
      sha256: "a".repeat(64),
    },
  };
  const selection = {
    id: "00000000-0000-4000-8000-000000000002",
    request,
    reportSha256: "b".repeat(64),
    report: { sourceProgramSha256: "c".repeat(64) },
    evidence: {
      sourceProgramSha256: "c".repeat(64),
      sourceRevision: "d".repeat(40),
      source: { source: "PRIVATE SOURCE" },
    },
  } as VerifiedBindingSelection;
  const tokens = {
    mode: "dark",
    brand: "default",
    revision: "original-token-revision",
  };
  let serial = 10,
    sourceUnavailable = false;
  let onPrepare: (() => void) | undefined, onVisual: (() => void) | undefined;
  const validations = { preparation: 0, visual: 0, runs: 0 };
  const write = (id: string, name: string, bytes: string | Buffer) => {
    const file = path.join(root, id, name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, bytes);
  };
  const readJob = (id: string): AnyCandidateJobRecord =>
    JSON.parse(readFileSync(path.join(root, id, "job.json"), "utf8"));
  const readReport = (id: string): Record<string, unknown> =>
    JSON.parse(readFileSync(path.join(root, id, "report.json"), "utf8"));
  const saveJob = (job: AnyCandidateJobRecord) =>
    write(job.id, "job.json", JSON.stringify(job));
  const saveReport = (
    id: string,
    report: Record<string, unknown>,
    reseal = true,
  ) => {
    const bytes = JSON.stringify(report);
    write(id, "report.json", bytes);
    if (reseal) saveJob({ ...readJob(id), reportSha256: sha(bytes) });
  };
  const add = (
    version: 1 | 2 | 3,
    preparation?: CandidateJobRecord,
    state: AnyCandidateJobRecord["state"] = "complete",
    status = version === 1 ? "prepared" : "measured-candidate",
  ) => {
    const sequence = serial++;
    const job = {
      version,
      id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
      request: structuredClone(request),
      binding: { id: selection.id, reportSha256: selection.reportSha256 },
      sourceProgramSha256: selection.evidence.sourceProgramSha256,
      sourceRevision: selection.evidence.sourceRevision,
      state,
      startedAt: new Date(Date.UTC(2026, 0, 1) + sequence).toISOString(),
      ...(version === 1
        ? {}
        : {
            operation: "source-visual-assembly",
            preparation: {
              id: preparation!.id,
              reportSha256: preparation!.reportSha256,
            },
          }),
    } as AnyCandidateJobRecord;
    const artifact =
      version === 1 ? "retained-runtime-bytes" : "measured-source-samples";
    write(job.id, "runtime/artifact.js", artifact);
    const report = {
      version,
      request: job.request,
      binding: job.binding,
      sourceProgramSha256: job.sourceProgramSha256,
      ...(job.version === 1 ? {} : { preparation: job.preparation }),
      status,
      acceptedContract: null,
      artifactSha256: sha(artifact),
      tokenContext: structuredClone(tokens),
    };
    const bytes = JSON.stringify(report);
    write(job.id, "report.json", bytes);
    if (state === "complete") job.reportSha256 = sha(bytes);
    saveJob(job);
    return job;
  };
  const check = (
    report: Record<string, unknown>,
    version: number,
    directory: string,
    readArtifact: (name: string) => Buffer,
    preparation?: { id: string; reportSha256: string },
  ) => {
    const artifact =
      version === 1 ? "retained-runtime-bytes" : "measured-source-samples";
    // The preparation validator's production equivalent reads retained runtime
    // through its fixed directory. Exercise that route, not only readArtifact.
    const bytes =
      version === 1
        ? readFileSync(path.join(directory, "runtime/artifact.js"))
        : readArtifact("runtime/artifact.js");
    assert.equal(bytes.toString(), artifact);
    assert.deepEqual(report, {
      version,
      request,
      binding: { id: selection.id, reportSha256: selection.reportSha256 },
      sourceProgramSha256: selection.evidence.sourceProgramSha256,
      ...(preparation ? { preparation } : {}),
      status: report.status,
      acceptedContract: null,
      artifactSha256: sha(bytes),
      tokenContext: tokens,
    });
  };
  const options: CandidateJobsOptions = {
    visualJobVersion: 3,
    selectLatestVerified: () => {
      if (sourceUnavailable) throw Error("binding-latest-unavailable");
      return structuredClone(selection);
    },
    validateReport: (report, context) => {
      validations.preparation++;
      check(report, 1, context.directory, context.readArtifact);
      onPrepare?.();
      return { counters: { prepared: 1 } };
    },
    validateVisualReport: (report, context) => {
      validations.visual++;
      check(report, report.version, context.directory, context.readArtifact, {
        id: context.preparation.id,
        reportSha256: context.preparation.reportSha256,
      });
      onVisual?.();
      return {
        counters: { plannedCases: 7, projectedCases: 6, refusedCases: 1 },
      };
    },
    run: () => {
      validations.runs++;
      throw Error("selector-must-not-run-workers");
    },
  };
  const open = (overrides: Partial<CandidateJobsOptions> = {}) =>
    createCandidateJobs(repo, { ...options, ...overrides });
  const preparation = () => add(1) as CandidateJobRecord;
  const visual = (
    parent: CandidateJobRecord,
    version: 2 | 3 = 3,
    state: AnyCandidateJobRecord["state"] = "complete",
    status = "measured-candidate",
  ) => add(version, parent, state, status) as CandidateVisualJobRecord;
  const snapshot = () => {
    const files: Record<string, string> = {};
    const visit = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(file);
        else
          files[path.relative(root, file)] =
            readFileSync(file).toString("base64");
      }
    };
    visit(root);
    return files;
  };
  return {
    repo,
    root,
    request,
    selection,
    tokens,
    options,
    validations,
    write,
    readJob,
    readReport,
    saveJob,
    saveReport,
    open,
    preparation,
    visual,
    snapshot,
    setSourceUnavailable: () => {
      sourceUnavailable = true;
    },
    onPrepare: (callback: () => void) => {
      onPrepare = callback;
    },
    onVisual: (callback: () => void) => {
      onVisual = callback;
    },
    close: () => rmSync(repo, { recursive: true, force: true }),
  };
}

test("native selector reopens and verifies complete current evidence without writing, replaying or leaking into snapshots", () => {
  const f = fixture();
  try {
    const parent = f.preparation(),
      v2 = f.visual(parent, 2),
      v3 = f.visual(parent),
      manager = f.open();
    const bytes = f.snapshot();
    const selected = manager.selectLatestVisualVerified(f.request);
    assert.equal(selected.id, v3.id);
    assert.equal(selected.reportSha256, v3.reportSha256);
    assert.equal(selected.directory, path.join(f.root, v3.id));
    assert.deepEqual(selected.report, f.readReport(v3.id));
    assert.equal(selected.preparation.id, parent.id);
    assert.deepEqual(selected.preparation.report, f.readReport(parent.id));
    assert.deepEqual(selected.selection, f.selection);
    assert.deepEqual(selected.preparation.selection, f.selection);
    const counts = { ...f.validations };
    assert.deepEqual(manager.selectLatestVisualVerified(f.request), selected);
    assert.ok(
      f.validations.preparation > counts.preparation &&
        f.validations.visual > counts.visual,
    );
    selected.report.acceptedContract = "forged" as never;
    selected.selection.evidence.sourceRevision = "f".repeat(40);
    assert.equal(
      manager.selectLatestVisualVerified(f.request).report.acceptedContract,
      null,
    );
    assert.equal(
      manager.selectLatestVisualVerified(f.request).selection.evidence
        .sourceRevision,
      "d".repeat(40),
    );
    assert.equal(f.open().selectLatestVisualVerified(f.request).id, v3.id);
    assert.deepEqual(f.snapshot(), bytes);
    assert.equal(f.validations.runs, 0);
    assert.doesNotMatch(
      JSON.stringify(manager.list(f.request.baseline.id)),
      /PRIVATE SOURCE|reportSha256|artifactSha256|sourceProgramSha256/,
    );
    assert.equal(
      manager.list(f.request.baseline.id).find((row) => row.id === v2.id)!
        .phase,
      "measured-candidate",
    );
  } finally {
    f.close();
  }
});

test("missing, incomplete and refused latest attempts never select an older success", async (t) => {
  for (const state of [
    "missing",
    "running",
    "failed",
    "interrupted",
    "visual-refused",
  ] as const)
    await t.test(state, () => {
      const f = fixture();
      try {
        const parent = f.preparation(),
          manager = f.open();
        if (state !== "missing") {
          f.visual(parent);
          f.visual(
            parent,
            3,
            state === "visual-refused" ? "complete" : state,
            state === "visual-refused" ? state : "measured-candidate",
          );
        }
        assert.throws(
          () => manager.selectLatestVisualVerified(f.request),
          /candidate-job-latest-visual-unavailable/,
        );
        assert.equal(f.validations.runs, 0);
      } finally {
        f.close();
      }
    });
});

test("configured version is server-owned and newest other-version attempts block native selection", async (t) => {
  for (const scenario of [
    "only-v2",
    "newer-v2-complete",
    "newer-v2-failed",
    "v2-to-v3",
    "manager-v2",
    "bad-version",
    "null-version",
  ] as const)
    await t.test(scenario, () => {
      const f = fixture();
      try {
        const parent = f.preparation();
        let expected: string | undefined;
        if (scenario === "v2-to-v3") {
          f.visual(parent, 2);
          expected = f.visual(parent).id;
        } else if (scenario.startsWith("newer")) {
          f.visual(parent);
          f.visual(
            parent,
            2,
            scenario.endsWith("failed") ? "failed" : "complete",
          );
        } else if (scenario === "manager-v2") expected = f.visual(parent, 2).id;
        else f.visual(parent, 2);
        const manager = f.open({
          visualJobVersion:
            scenario === "manager-v2"
              ? 2
              : scenario === "bad-version"
                ? (4 as never)
                : scenario === "null-version"
                  ? (null as never)
                  : 3,
        });
        if (expected)
          assert.equal(
            manager.selectLatestVisualVerified(f.request).id,
            expected,
          );
        else
          assert.throws(
            () => manager.selectLatestVisualVerified(f.request),
            /candidate-job-(?:latest-visual-unavailable|visual-version-invalid)/,
          );
      } finally {
        f.close();
      }
    });
});

test("complete status and resealed hashes do not authenticate forged source, artifact, token or report facts", async (t) => {
  for (const mutation of [
    "report-bytes",
    "report-hash",
    "forged-report",
    "artifact",
    "forged-artifact-hash",
    "preparation-artifact",
    "token-context",
    "binding",
    "source-program",
    "source-revision",
    "source-unavailable",
    "request",
    "visual-symlink",
  ] as const)
    await t.test(mutation, () => {
      const f = fixture();
      try {
        const parent = f.preparation(),
          job = f.visual(parent),
          manager = f.open();
        if (mutation === "report-bytes")
          f.write(
            job.id,
            "report.json",
            JSON.stringify({
              ...f.readReport(job.id),
              acceptedContract: "forged",
            }),
          );
        if (mutation === "report-hash")
          f.saveJob({ ...job, reportSha256: "e".repeat(64) });
        if (mutation === "forged-report")
          f.saveReport(job.id, { ...f.readReport(job.id), forged: true });
        if (mutation === "artifact" || mutation === "forged-artifact-hash") {
          f.write(job.id, "runtime/artifact.js", "forged");
          if (mutation === "forged-artifact-hash")
            f.saveReport(job.id, {
              ...f.readReport(job.id),
              artifactSha256: sha("forged"),
            });
        }
        if (mutation === "preparation-artifact")
          f.write(parent.id, "runtime/artifact.js", "forged");
        if (mutation === "token-context")
          f.tokens.revision = "new-token-revision";
        if (mutation === "binding") f.selection.reportSha256 = "e".repeat(64);
        if (mutation === "source-program") {
          f.selection.evidence.sourceProgramSha256 = "e".repeat(64);
          f.selection.report.sourceProgramSha256 = "e".repeat(64);
        }
        if (mutation === "source-revision")
          f.selection.evidence.sourceRevision = "e".repeat(40);
        if (mutation === "source-unavailable") f.setSourceUnavailable();
        if (mutation === "request")
          f.saveJob({
            ...job,
            request: {
              ...f.request,
              baseline: { ...f.request.baseline, sha256: "e".repeat(64) },
            },
          });
        if (mutation === "visual-symlink") {
          rmSync(path.join(f.root, job.id, "runtime/artifact.js"));
          symlinkSync(
            path.join(f.root, parent.id, "runtime/artifact.js"),
            path.join(f.root, job.id, "runtime/artifact.js"),
          );
        }
        assert.throws(() => manager.selectLatestVisualVerified(f.request));
        assert.equal(f.validations.runs, 0);
      } finally {
        f.close();
      }
    });
});

test("latest preparation controls selection even when an older visual remains valid", async (t) => {
  for (const state of ["complete", "failed", "running", "interrupted"] as const)
    await t.test(state, () => {
      const f = fixture();
      try {
        const parent = f.preparation();
        f.visual(parent);
        const manager = f.open();
        const newer = f.preparation();
        f.saveJob({ ...newer, state });
        assert.throws(
          () => manager.selectLatestVisualVerified(f.request),
          /candidate-job-(?:latest-preparation-unavailable|preparation-changed)/,
        );
      } finally {
        f.close();
      }
    });
});

test("metadata appearing or retargeted during verification blocks fallback, including other-version jobs", async (t) => {
  for (const mutation of [
    "visual-v3",
    "visual-v2",
    "preparation",
    "retargeted",
    "unknown-version",
    "malformed",
  ] as const)
    await t.test(mutation, () => {
      const f = fixture();
      try {
        const parent = f.preparation();
        f.visual(parent);
        const manager = f.open();
        const unrelated =
          mutation === "retargeted" ? f.visual(parent) : undefined;
        if (unrelated)
          f.saveJob({
            ...unrelated,
            request: {
              ...f.request,
              baseline: {
                ...f.request.baseline,
                id: "00000000-0000-4000-8000-000000000099",
              },
            },
          });
        let fired = false;
        f.onVisual(() => {
          if (fired) return;
          fired = true;
          if (mutation === "preparation") f.preparation();
          else if (mutation === "retargeted") f.saveJob(unrelated!);
          else {
            const newJob = f.visual(
              parent,
              mutation === "visual-v2" ? 2 : 3,
              "failed",
            );
            if (mutation === "unknown-version")
              f.write(
                newJob.id,
                "job.json",
                JSON.stringify({ ...newJob, version: 4 }),
              );
            if (mutation === "malformed") f.write(newJob.id, "job.json", "{");
          }
        });
        assert.throws(
          () => manager.selectLatestVisualVerified(f.request),
          /candidate-job-(?:visual-history-changed|preparation-history-changed|preparation-changed-during-validation|history-invalid)/,
        );
      } finally {
        f.close();
      }
    });
});

test("report and artifact byte changes or additions during validation cannot escape directory fingerprints", async (t) => {
  for (const mutation of [
    "visual-report",
    "preparation-report",
    "visual-artifact",
    "preparation-artifact",
    "visual-added-file",
    "preparation-added-file",
    "visual-report-after-preparation",
  ] as const)
    await t.test(mutation, () => {
      const f = fixture();
      try {
        const parent = f.preparation(),
          visual = f.visual(parent),
          manager = f.open();
        let preparationChecks = 0;
        const change = () => {
          if (
            mutation === "visual-report" ||
            mutation === "visual-report-after-preparation"
          )
            f.write(
              visual.id,
              "report.json",
              JSON.stringify(f.readReport(visual.id)) + " ",
            );
          if (mutation === "preparation-report")
            f.write(
              parent.id,
              "report.json",
              JSON.stringify(f.readReport(parent.id)) + " ",
            );
          if (mutation === "visual-artifact")
            f.write(visual.id, "runtime/artifact.js", "changed-after-read");
          if (mutation === "preparation-artifact")
            f.write(parent.id, "runtime/artifact.js", "changed-after-read");
          if (mutation === "visual-added-file")
            f.write(visual.id, "new-report.json", "{}");
          if (mutation === "preparation-added-file")
            f.write(parent.id, "runtime/new-artifact.js", "new");
        };
        if (mutation === "visual-report-after-preparation")
          f.onPrepare(() => {
            if (++preparationChecks === 2) change();
          });
        else if (mutation === "preparation-artifact")
          f.onPrepare(() => {
            if (++preparationChecks === 2) change();
          });
        else f.onVisual(change);
        assert.throws(
          () => manager.selectLatestVisualVerified(f.request),
          /candidate-job-(?:evidence-changed-during-validation|report-changed)/,
        );
      } finally {
        f.close();
      }
    });
});
