import assert from "node:assert/strict";
import {
  mkdtempSync,
  realpathSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { VerifiedBindingSelection } from "./binding-jobs.js";
import { runCandidateJob } from "./candidate-run.js";

test("fixed candidate runner rejects invalid paths, stale jobs and changed selection before source execution", async (t) => {
  for (const mutation of [
    "id",
    "symlink",
    "job-state",
    "extra-job",
    "binding",
    "source",
    "program",
    "request",
    "existing-report",
  ])
    await t.test(mutation, () => {
      const root = realpathSync(
        mkdtempSync(path.join(tmpdir(), "candidate-run-test-")),
      );
      try {
        const repo = path.join(root, "repo"),
          id = "00000000-0000-4000-8000-000000000001";
        const directory = path.join(repo, "private/source-candidate-app", id);
        mkdirSync(directory, { recursive: true });
        const job = {
          version: 1,
          id,
          request: {
            version: 1,
            baseline: {
              id: "00000000-0000-4000-8000-000000000002",
              sha256: "a".repeat(64),
            },
          },
          binding: {
            id: "00000000-0000-4000-8000-000000000003",
            reportSha256: "b".repeat(64),
          },
          sourceProgramSha256: "c".repeat(64),
          sourceRevision: "d".repeat(40),
          state: "running",
          startedAt: new Date().toISOString(),
        };
        const selection = {
          id: job.binding.id,
          request: structuredClone(job.request),
          reportSha256: job.binding.reportSha256,
          report: { sourceProgramSha256: job.sourceProgramSha256 },
          evidence: {
            sourceRevision: job.sourceRevision,
            sourceProgramSha256: job.sourceProgramSha256,
          },
        } as VerifiedBindingSelection;
        if (mutation === "job-state") job.state = "complete";
        if (mutation === "extra-job")
          Object.assign(job, { checkout: "/owner/unrelated" });
        if (mutation === "binding") selection.reportSha256 = "e".repeat(64);
        if (mutation === "source")
          selection.evidence.sourceRevision = "e".repeat(40);
        if (mutation === "program")
          selection.evidence.sourceProgramSha256 = "e".repeat(64);
        if (mutation === "request")
          selection.request.baseline.sha256 = "e".repeat(64);
        if (mutation === "existing-report")
          writeFileSync(
            path.join(directory, "report.json"),
            "preserve owner bytes",
          );
        const file = path.join(directory, "job.json");
        if (mutation === "symlink") {
          writeFileSync(path.join(root, "job.json"), JSON.stringify(job));
          symlinkSync(path.join(root, "job.json"), file);
        } else writeFileSync(file, JSON.stringify(job));
        let inspected = 0,
          prepared = 0;
        assert.throws(
          () =>
            runCandidateJob(repo, mutation === "id" ? "../outside" : id, {
              selectLatestVerified: () => selection,
              inspectInputs: () => {
                inspected++;
                throw Error("must not inspect invalid request");
              },
              prepare: () => {
                prepared++;
                throw Error("must not execute invalid request");
              },
            }),
          /candidate-/,
        );
        assert.equal(inspected, 0);
        assert.equal(prepared, 0);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
});
