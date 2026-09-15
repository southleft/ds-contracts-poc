import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  rmSync,
  realpathSync,
  symlinkSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createCandidateJobs,
  type CandidateJobsOptions,
  type CandidateJobRecord,
} from "./candidate-jobs.js";
import type { VerifiedBindingSelection } from "./binding-jobs.js";

const sha = (bytes: string | Buffer) =>
  createHash("sha256").update(bytes).digest("hex");

/** Synthetic host/validator fixture: tests scheduling and evidence integrity,
 * never runtime preparation, source qualification or candidate acceptance. */
function fixture() {
  const directory = realpathSync(
    mkdtempSync(path.join(tmpdir(), "candidate-jobs-test-")),
  );
  const repo = path.join(directory, "repo");
  mkdirSync(repo);
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
      source: { source: "PRIVATE SOURCE MUST NOT REACH SNAPSHOTS" },
    },
  } as VerifiedBindingSelection;
  let calls = 0,
    kills = 0,
    validations = 0;
  let done: (error: unknown) => void = () => {};
  const root = path.join(repo, "private/source-candidate-app");
  const options: CandidateJobsOptions = {
    selectLatestVerified: () => structuredClone(selection),
    validateReport: (report, context) => {
      validations++;
      assert.equal(context.selection.reportSha256, selection.reportSha256);
      assert.equal(path.dirname(context.directory), root);
      const bytes = context.readArtifact("candidate.json");
      assert.equal(sha(bytes), report.candidateSha256);
      assert.deepEqual(JSON.parse(bytes.toString()), { fixture: "validated" });
      return { counters: { expected: 1, prepared: 1 }, problems: [] };
    },
    run: (args, cb) => {
      calls++;
      assert.deepEqual(args.slice(0, 3), [
        "--import",
        "tsx",
        "source-reference/candidate-run.ts",
      ]);
      assert.match(args[3], /^[a-f0-9-]{36}$/);
      assert.equal(args.length, 4);
      done = cb;
      return {
        kill: () => {
          kills++;
          return true;
        },
      };
    },
  };
  const readJob = (id: string): CandidateJobRecord =>
    JSON.parse(readFileSync(path.join(root, id, "job.json"), "utf8"));
  const report = (id: string) => {
    const job = readJob(id),
      bytes = Buffer.from(JSON.stringify({ fixture: "validated" }));
    writeFileSync(path.join(root, id, "candidate.json"), bytes);
    const value = {
      version: 1,
      request: job.request,
      binding: job.binding,
      sourceProgramSha256: job.sourceProgramSha256,
      status: "prepared",
      acceptedContract: null,
      candidateSha256: sha(bytes),
    };
    writeFileSync(path.join(root, id, "report.json"), JSON.stringify(value));
    return value;
  };
  return {
    directory,
    repo,
    root,
    request,
    selection,
    options,
    readJob,
    report,
    done: (error: unknown = null) => done(error),
    counts: () => ({ calls, kills, validations }),
    close: () => rmSync(directory, { recursive: true, force: true }),
  };
}

test("candidate jobs validate before sealing, deduplicate, and reopen read-only with safe summaries", () => {
  const f = fixture(),
    jobs = createCandidateJobs(f.repo, f.options);
  try {
    const job = jobs.start(f.request);
    assert.equal(job.state, "running");
    assert.equal(jobs.running, true);
    assert.equal(jobs.start(f.request, true).id, job.id);
    assert.equal(f.counts().calls, 1);
    f.report(job.id);
    f.done();
    assert.equal(jobs.running, false);
    const ready = jobs.list(f.request.baseline.id)[0];
    assert.equal(ready.state, "complete");
    assert.equal(ready.phase, "prepared");
    assert.deepEqual(ready.counters, { expected: 1, prepared: 1 });
    assert.ok(f.counts().validations >= 2);
    const bytes = readFileSync(path.join(f.root, job.id, "job.json"));
    assert.equal(jobs.start(f.request).id, job.id);
    const recovered = createCandidateJobs(f.repo, {
      ...f.options,
      run: () => {
        throw Error("must not execute");
      },
    });
    assert.deepEqual(recovered.list(f.request.baseline.id), [ready]);
    assert.equal(recovered.start(f.request).id, job.id);
    assert.deepEqual(
      readFileSync(path.join(f.root, job.id, "job.json")),
      bytes,
    );
    const json = JSON.stringify(ready);
    for (const privateValue of [
      f.root,
      "PRIVATE SOURCE",
      "sourceProgramSha256",
      "artifactRevision",
      "request",
      "reportSha256",
    ])
      assert.equal(json.includes(privateValue), false);
    assert.equal(f.counts().calls, 1);
    recovered.close();
  } finally {
    jobs.close();
    f.close();
  }
});

test("failed and interrupted latest candidates require explicit retry and never fall back to an older pass", () => {
  const f = fixture(),
    jobs = createCandidateJobs(f.repo, f.options);
  try {
    const first = jobs.start(f.request);
    f.report(first.id);
    f.done();
    const second = jobs.start(f.request, true);
    assert.notEqual(second.id, first.id);
    f.done(Error("private source path must not leak"));
    assert.equal(jobs.list(f.request.baseline.id).at(-1)!.state, "failed");
    assert.equal(jobs.start(f.request).id, second.id);
    assert.equal(f.counts().calls, 2);
    const third = jobs.start(f.request, true);
    jobs.close();
    f.report(third.id);
    f.done();
    assert.equal(f.counts().kills, 1);
    const recovered = createCandidateJobs(f.repo, {
      ...f.options,
      run: () => {
        throw Error("must not run");
      },
    });
    assert.equal(
      recovered.list(f.request.baseline.id).at(-1)!.state,
      "interrupted",
    );
    assert.equal(recovered.start(f.request).id, third.id);
    assert.equal(recovered.running, false);
    assert.ok(
      jobs
        .list(f.request.baseline.id)
        .some((row) => row.id === first.id && row.state === "complete"),
    );
    assert.equal(
      JSON.stringify(recovered.list(f.request.baseline.id)).includes(
        "private source path",
      ),
      false,
    );
  } finally {
    jobs.close();
    f.close();
  }
});

test("report status/hash alone cannot complete a job; changed selected inputs or output bytes refuse", async (t) => {
  for (const mutation of [
    "report",
    "artifact",
    "binding",
    "source",
    "validator",
    "accepted",
    "counter",
    "problem",
    "job",
  ] as const)
    await t.test(mutation, () => {
      const f = fixture();
      const options = { ...f.options };
      const jobs = createCandidateJobs(f.repo, options);
      try {
        const job = jobs.start(f.request);
        const value = f.report(job.id);
        if (mutation === "validator")
          options.validateReport = () => {
            throw Error("private implementation failure");
          };
        if (mutation === "accepted") {
          value.acceptedContract = {} as never;
          writeFileSync(
            path.join(f.root, job.id, "report.json"),
            JSON.stringify(value),
          );
        }
        if (mutation === "counter")
          options.validateReport = () => ({
            counters: { prepared: Number.NaN },
          });
        if (mutation === "problem")
          options.validateReport = () => ({
            counters: {},
            problems: ["/private/owner/source.ts"],
          });
        f.done();
        if (
          ["validator", "accepted", "counter", "problem"].includes(mutation)
        ) {
          assert.equal(jobs.list(f.request.baseline.id)[0].state, "failed");
          return;
        }
        assert.equal(jobs.list(f.request.baseline.id)[0].state, "complete");
        if (mutation === "report")
          writeFileSync(
            path.join(f.root, job.id, "report.json"),
            JSON.stringify(value) + " ",
          );
        if (mutation === "artifact")
          writeFileSync(path.join(f.root, job.id, "candidate.json"), "changed");
        if (mutation === "binding") f.selection.reportSha256 = "e".repeat(64);
        if (mutation === "source")
          f.selection.evidence.sourceRevision = "f".repeat(40);
        if (mutation === "job")
          writeFileSync(path.join(f.root, job.id, "job.json"), "invalid job");
        const rows = jobs.list(f.request.baseline.id);
        assert.equal(rows.at(-1)!.state, "failed");
        assert.equal(jobs.start(f.request).state, "failed");
        assert.equal(f.counts().calls, 1);
      } finally {
        jobs.close();
        f.close();
      }
    });
});

test("wrong source selection, traversal and symlinks cannot launch or expose another file", () => {
  const f = fixture();
  try {
    const mismatch = createCandidateJobs(f.repo, {
      ...f.options,
      selectLatestVerified: () => ({
        ...f.selection,
        request: {
          ...f.request,
          baseline: {
            ...f.request.baseline,
            id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
          },
        },
      }),
    });
    assert.throws(() => mismatch.start(f.request), /candidate-/);
    assert.throws(
      () =>
        mismatch.start({
          ...f.request,
          baseline: { ...f.request.baseline, id: "../outside" },
        }),
      /candidate-/,
    );
    assert.equal(f.counts().calls, 0);
    const outside = path.join(f.directory, "outside");
    mkdirSync(outside);
    mkdirSync(path.join(f.repo, "private"));
    symlinkSync(outside, f.root, "dir");
    assert.throws(
      () => createCandidateJobs(f.repo, f.options).start(f.request),
      /candidate-/,
    );
    assert.deepEqual(readdirSync(outside), []);
    rmSync(f.root);
    for (const name of [
      "../outside/secret",
      "/absolute",
      "nested/../../secret",
      "linked.txt",
    ]) {
      const jobs = createCandidateJobs(f.repo, {
        ...f.options,
        validateReport: (_report, context) => {
          if (name === "linked.txt") {
            const secret = path.join(outside, "secret");
            writeFileSync(secret, "owner bytes");
            symlinkSync(secret, path.join(context.directory, name));
          }
          context.readArtifact(name);
          return { counters: { prepared: 1 } };
        },
      });
      const job = jobs.start(f.request, true);
      f.report(job.id);
      f.done();
      assert.equal(jobs.list(f.request.baseline.id).at(-1)!.state, "failed");
      jobs.close();
    }
  } finally {
    f.close();
  }
});

test("launch throws/synchronous callbacks and running recovery cannot strand work or execute recovered jobs", () => {
  const f = fixture();
  try {
    const failed = createCandidateJobs(f.repo, {
      ...f.options,
      run: () => {
        throw Error("launch failed");
      },
    });
    assert.throws(() => failed.start(f.request), /candidate-/);
    assert.equal(failed.running, false);
    const immediate = createCandidateJobs(f.repo, {
      ...f.options,
      run: (args, done) => {
        f.report(args[3]);
        done(null);
        return { kill: () => true };
      },
    });
    assert.equal(immediate.start(f.request, true).state, "complete");
    assert.equal(immediate.running, false);
    const live = createCandidateJobs(f.repo, f.options),
      pending = live.start(f.request, true);
    const recovered = createCandidateJobs(f.repo, {
      ...f.options,
      run: () => {
        throw Error("must not execute");
      },
    });
    assert.equal(recovered.list(f.request.baseline.id).at(-1)!.id, pending.id);
    assert.equal(
      recovered.list(f.request.baseline.id).at(-1)!.state,
      "interrupted",
    );
    recovered.close();
    assert.equal(f.counts().kills, 0, "recovery owns no process to kill");
    live.close();
    assert.equal(f.counts().kills, 1);
  } finally {
    f.close();
  }
});

test("incomplete or malformed latest metadata reopens as failure, never an older successful candidate", () => {
  const f = fixture(),
    jobs = createCandidateJobs(f.repo, f.options);
  try {
    const first = jobs.start(f.request);
    f.report(first.id);
    f.done();
    const second = jobs.start(f.request, true);
    f.report(second.id);
    f.done();
    const file = path.join(f.root, second.id, "job.json"),
      original = f.readJob(second.id);
    for (const value of [
      "invalid JSON",
      JSON.stringify({ ...original, reportSha256: undefined }),
      JSON.stringify({ ...original, startedAt: 42 }),
    ]) {
      writeFileSync(file, value);
      const recovered = createCandidateJobs(f.repo, {
        ...f.options,
        run: () => {
          throw Error("must not run");
        },
      });
      assert.equal(recovered.list(f.request.baseline.id).at(-1)!.id, second.id);
      assert.equal(
        recovered.list(f.request.baseline.id).at(-1)!.state,
        "failed",
      );
      assert.throws(
        () => recovered.start(f.request),
        /candidate-job-history-invalid/,
      );
      recovered.close();
    }
    writeFileSync(file, JSON.stringify(original));
    const partialId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    mkdirSync(path.join(f.root, partialId));
    const recovered = createCandidateJobs(f.repo, f.options);
    assert.equal(recovered.list(f.request.baseline.id).at(-1)!.id, partialId);
    assert.equal(recovered.list(f.request.baseline.id).at(-1)!.state, "failed");
    assert.equal(f.counts().calls, 2);
  } finally {
    jobs.close();
    f.close();
  }
});

test("inputs changed during validation refuse, and cancellation cannot overwrite linked metadata", () => {
  const f = fixture();
  try {
    const validator = f.options.validateReport;
    const changed = createCandidateJobs(f.repo, {
      ...f.options,
      validateReport: (report, context) => {
        const summary = validator(report, context);
        f.selection.reportSha256 = "e".repeat(64);
        return summary;
      },
    });
    const first = changed.start(f.request);
    f.report(first.id);
    f.done();
    assert.equal(changed.list(f.request.baseline.id)[0].state, "failed");
    changed.close();
    const live = createCandidateJobs(f.repo, f.options),
      job = live.start(f.request, true);
    const outside = path.join(f.directory, "owner.json");
    writeFileSync(outside, "owner bytes");
    const metadata = path.join(f.root, job.id, "job.json");
    rmSync(metadata);
    symlinkSync(outside, metadata);
    live.close();
    f.done();
    assert.equal(readFileSync(outside, "utf8"), "owner bytes");
    assert.equal(f.counts().kills, 1);
    assert.equal(live.running, false);
  } finally {
    f.close();
  }
});

test(
  "default launcher stops its owned process group including a preparer grandchild",
  { skip: process.platform === "win32" },
  async () => {
    const f = fixture();
    let jobs: ReturnType<typeof createCandidateJobs> | undefined;
    try {
      mkdirSync(path.join(f.repo, "source-reference"));
      symlinkSync(
        path.resolve("node_modules"),
        path.join(f.repo, "node_modules"),
        "dir",
      );
      writeFileSync(
        path.join(f.repo, "source-reference/candidate-run.ts"),
        `
      import { spawn } from 'node:child_process';
      import { writeFileSync } from 'node:fs';
      const child = spawn(process.execPath, ['-e', "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"], { stdio:'ignore' });
      writeFileSync('private/source-candidate-app/'+process.argv[2]+'/process.json', JSON.stringify({pid:process.pid,child:child.pid}));
      process.on('SIGTERM',()=>{});setInterval(()=>{},1000);
    `,
      );
      jobs = createCandidateJobs(f.repo, { ...f.options, run: undefined });
      const job = jobs.start(f.request),
        info = path.join(f.root, job.id, "process.json");
      const until = async (predicate: () => boolean) => {
        for (let i = 0; i < 200; i++) {
          if (predicate()) return;
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        assert.fail("owned process did not reach bounded expected state");
      };
      await until(() => existsSync(info));
      const pids = JSON.parse(readFileSync(info, "utf8"));
      const running = (pid: number) => {
        try {
          return !/^\s*Z/.test(
            execFileSync("ps", ["-p", String(pid), "-o", "stat="], {
              encoding: "utf8",
              stdio: ["ignore", "pipe", "ignore"],
            }),
          );
        } catch {
          return false;
        }
      };
      assert.ok(running(pids.pid));
      assert.ok(running(pids.child));
      jobs.close();
      await until(() => !running(pids.pid) && !running(pids.child));
      assert.equal(f.readJob(job.id).state, "interrupted");
      assert.equal("pid" in f.readJob(job.id), false);
    } finally {
      jobs?.close();
      f.close();
    }
  },
);
