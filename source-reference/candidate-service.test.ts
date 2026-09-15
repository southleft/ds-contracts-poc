import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { createServer, request as httpRequest, type Server } from "node:http";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import {
  altitudeCohort,
  altitudeButtonVariants,
  altitudeRevision,
} from "./altitude-cohort.js";
import { createReferenceService } from "./service.js";
import { createBindingJobs, type BindingTraceReport } from "./binding-jobs.js";
import {
  loadBindingEvidence,
  type BindingEvidenceRequest,
} from "./binding-evidence.js";
import { planBindingInterventions } from "./binding-plan.js";
import type {
  CandidateJobsOptions,
  CandidatePreparedReport,
} from "./candidate-jobs.js";

const sha = (bytes: Buffer | string) =>
  createHash("sha256").update(bytes).digest("hex");
const closeServer = (server: Server) =>
  new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
const listen = (server: Server) =>
  new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const originOf = (server: Server) =>
  `http://127.0.0.1:${(server.address() as { port: number }).port}`;

/** Real recorded source bytes with explicitly refused observation rows. This
 * fixture proves HTTP/job isolation, never a qualified source candidate. */
function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "candidate-service-"));
  const repo = path.join(directory, "repo");
  const put = (file: string, bytes: string | Buffer) => {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, bytes);
  };
  const captured = JSON.parse(
    readFileSync(
      new URL("./fixtures/contract-plan-button-recorded.json", import.meta.url),
      "utf8",
    ),
  );
  const files = JSON.parse(
    gunzipSync(Buffer.from(captured.payload, "base64")).toString(),
  );
  const manifestRecord = files["manifest.json"];
  const manifest =
    manifestRecord.utf8 === undefined
      ? Buffer.from(manifestRecord.base64, "base64")
      : Buffer.from(manifestRecord.utf8);
  assert.equal(sha(manifest), manifestRecord.sha256);
  const program = JSON.parse(
    readFileSync(
      new URL(
        "./fixtures/source-program-button-recorded.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const sourceHashes: Record<string, string> = {
    [program.manifestPath]: sha(manifest),
  };
  put(path.join(directory, "altitude", program.manifestPath), manifest);
  for (const [file, record] of Object.entries(program.files) as [
    string,
    { text: string; sha256: string },
  ][]) {
    assert.equal(sha(record.text), record.sha256);
    put(path.join(directory, "altitude", file), record.text);
    sourceHashes[file] = record.sha256;
  }
  const persist = (
    id: string,
    supplemental: boolean,
    parent?: BindingEvidenceRequest["baseline"],
  ) => {
    const entries = supplemental ? altitudeButtonVariants : altitudeCohort;
    const rows = entries.map(({ story, profile }) => ({
      story,
      profile,
      qualified: false,
      error: "Transport fixture: source state deliberately unqualified.",
    }));
    const output = path.join(repo, "private/source-reference-app", id);
    for (const row of rows)
      put(
        path.join(output, row.story, "measurement.json"),
        JSON.stringify(row),
      );
    const final = JSON.stringify({
      cohortId: supplemental ? "button-variants" : "baseline",
      ...(parent
        ? { parent: { id: parent.id, measurementSha256: parent.sha256 } }
        : {}),
      sourceRevision: altitudeRevision,
      sourceStable: true,
      sourceHashes,
      recordedAt: supplemental
        ? "2026-09-15T16:00:00.000Z"
        : "2026-09-15T15:00:00.000Z",
      denominator: entries.length,
      qualified: 0,
      rows,
    });
    put(path.join(output, "measurement.json"), final);
    return { id, sha256: sha(final) };
  };
  const baseline = persist("00000000-0000-4000-8000-000000000001", false);
  const supplement = persist(
    "00000000-0000-4000-8000-000000000002",
    true,
    baseline,
  );
  const request: BindingEvidenceRequest = { version: 1, baseline, supplement };
  const evidence = loadBindingEvidence(repo, request);
  const report: BindingTraceReport = {
    version: 1,
    request,
    sourceProgramSha256: evidence.sourceProgramSha256,
    sourceStable: true,
    scope: "Transport fixture; no replay or source qualification claimed.",
    rows: evidence.rows.map((row) => ({
      story: row.story,
      status: "refused",
      problems: ["fixture-not-replayed"],
      matchedElements: 0,
      mappedSlots: 0,
      observedDependencies: 0,
      plannedDependencies: planBindingInterventions(row.story).length,
      differentials: planBindingInterventions(row.story).map((plan) => ({
        key: plan.key,
        problems: ["fixture-not-replayed"],
      })),
    })),
  };
  let bindingDone: (error: unknown) => void = () => {};
  let bindingOutput = "";
  const binding = createBindingJobs(repo, (args, done) => {
    bindingDone = done;
    bindingOutput = args.at(-1)!;
    return { kill: () => true };
  });
  binding.start(request);
  put(path.join(bindingOutput, "report.json"), JSON.stringify(report));
  bindingDone(null);
  const selection = binding.selectLatestVerified(request);
  binding.close();
  return {
    directory,
    repo,
    request,
    selection,
    put,
    close: () => rmSync(directory, { recursive: true, force: true }),
  };
}

function candidateStub(f: ReturnType<typeof fixture>) {
  const calls: { args: string[]; done: (error: unknown) => void }[] = [];
  let killed = 0;
  const options: Pick<CandidateJobsOptions, "run" | "validateReport"> = {
    run: (args, done) => {
      calls.push({ args, done });
      return {
        kill: () => {
          killed++;
          return true;
        },
      };
    },
    validateReport: (report, context) => {
      assert.equal(report.status, "prepared");
      assert.equal(report.acceptedContract, null);
      assert.deepEqual(context.selection.request, f.request);
      return {
        counters: {
          plannedCases: 7,
          structurallyMatchedCases: 0,
          refusedCases: 7,
          variantStates: 0,
          slots: 0,
          writableProperties: 0,
        },
      };
    },
  };
  const finish = () => {
    const call = calls.at(-1)!;
    const report: CandidatePreparedReport = {
      version: 1,
      request: f.request,
      binding: { id: f.selection.id, reportSha256: f.selection.reportSha256 },
      sourceProgramSha256: f.selection.evidence.sourceProgramSha256,
      status: "prepared",
      acceptedContract: null,
      fixture:
        "Injected validator tests lifecycle only, not source/runtime preparation.",
    };
    f.put(
      path.join(
        f.repo,
        "private/source-candidate-app",
        call.args.at(-1)!,
        "report.json",
      ),
      JSON.stringify(report),
    );
    call.done(null);
  };
  return { calls, options, finish, killed: () => killed };
}

test("candidate endpoint fixes evidence selection, rejects caller authority, preserves attempts and keeps snapshots read-only", async () => {
  const f = fixture(),
    runner = candidateStub(f);
  let captures = 0,
    replays = 0;
  const service = createReferenceService(
    f.repo,
    () => {
      captures++;
      return { kill: () => true };
    },
    () => {
      replays++;
      return { kill: () => true };
    },
    runner.options,
  );
  const server = createServer((req, res) => {
    void service.handle(req, res);
  });
  await listen(server);
  const base = originOf(server) + "/api/source-reference";
  const post = (body: unknown = {}, headers: Record<string, string> = {}) =>
    fetch(`${base}/${f.request.baseline.id}/button-candidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  try {
    assert.equal(
      (await post({}, { Origin: "https://attacker.invalid" })).status,
      403,
    );
    const rebindingStatus = await new Promise<number | undefined>(
      (resolve, reject) => {
        const request = httpRequest(
          `${base}/${f.request.baseline.id}/button-candidate`,
          {
            method: "POST",
            headers: {
              Host: "attacker.invalid",
              "Content-Type": "application/json",
            },
          },
          (response) => {
            response.resume();
            response.on("end", () => resolve(response.statusCode));
          },
        );
        request.on("error", reject);
        request.end("{}");
      },
    );
    assert.equal(rebindingStatus, 403);
    assert.equal(
      (await post({}, { "Content-Type": "text/plain" })).status,
      415,
    );
    for (const body of [
      null,
      [],
      { retry: false },
      { retry: 1 },
      { source: "/tmp" },
      { revision: "chosen" },
      { script: "echo" },
      { baseline: f.request.baseline },
      { supplement: null },
    ])
      assert.equal((await post(body)).status, 400);
    assert.equal(runner.calls.length, 0);
    assert.equal((await post()).status, 202);
    assert.equal(runner.calls.length, 1);
    assert.deepEqual(runner.calls[0].args.slice(0, -1), [
      "--import",
      "tsx",
      "source-reference/candidate-run.ts",
    ]);
    let job = await (await fetch(`${base}/${f.request.baseline.id}`)).json();
    assert.equal(job.candidatePreparations[0].phase, "preparing");
    assert.equal(job.contractAdmission.acceptedContract, null);
    assert.equal(job.denominator, 10);
    assert.equal(job.supplements[0].denominator, 3);
    assert.equal(
      JSON.stringify(job.candidatePreparations).includes(f.repo),
      false,
    );
    await post();
    assert.equal(
      runner.calls.length,
      1,
      "no duplicate or read-triggered process",
    );
    for (const endpoint of [
      base,
      `${base}/${f.request.baseline.id}/button-variants`,
      `${base}/${f.request.baseline.id}/button-bindings`,
    ]) {
      const body = endpoint.endsWith("button-bindings")
        ? {}
        : { origin: "http://127.0.0.1:6017" };
      assert.equal(
        (
          await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        ).status,
        409,
      );
    }
    assert.equal(captures + replays, 0);
    runner.finish();
    job = await (await fetch(`${base}/${f.request.baseline.id}`)).json();
    assert.equal(job.candidatePreparations[0].phase, "prepared");
    assert.equal(job.contractAdmission.acceptedContract, null);
    await post();
    assert.equal(
      runner.calls.length,
      1,
      "prepared results do not implicitly rerun",
    );
    assert.equal((await post({ retry: true })).status, 202);
    assert.equal(runner.calls.length, 2);
    job = await (await fetch(base)).json();
    assert.equal(job.latest.candidatePreparations.length, 2);
    assert.equal(job.latest.candidatePreparations[0].phase, "prepared");
    assert.equal(job.latest.candidatePreparations[1].phase, "preparing");
  } finally {
    service.close();
    await closeServer(server);
    f.close();
  }
  assert.equal(runner.killed(), 1);
});

test("candidate preparation refuses active captures or binding replays without launching", async () => {
  for (const activity of ["capture", "binding"] as const) {
    const f = fixture(),
      runner = candidateStub(f);
    const service = createReferenceService(
      f.repo,
      () => ({ kill: () => true }),
      () => ({ kill: () => true }),
      runner.options,
    );
    const server = createServer((req, res) => {
      void service.handle(req, res);
    });
    const source = createServer((_req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          entries: Object.fromEntries(
            altitudeCohort.map(({ story }) => [story, {}]),
          ),
        }),
      );
    });
    await Promise.all([listen(server), listen(source)]);
    const base = originOf(server) + "/api/source-reference";
    try {
      const response = await fetch(
        activity === "capture"
          ? base
          : `${base}/${f.request.baseline.id}/button-bindings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            activity === "capture"
              ? { origin: originOf(source) }
              : { retry: true },
          ),
        },
      );
      assert.equal(response.status, 202);
      assert.equal(
        (
          await fetch(`${base}/${f.request.baseline.id}/button-candidate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          })
        ).status,
        409,
      );
      assert.equal(runner.calls.length, 0);
    } finally {
      service.close();
      await Promise.all([closeServer(server), closeServer(source)]);
      f.close();
    }
  }
});

test("capture preflight cannot race an admitted candidate job into overlapping execution", async () => {
  const f = fixture(),
    runner = candidateStub(f);
  let captures = 0;
  const service = createReferenceService(
    f.repo,
    () => {
      captures++;
      return { kill: () => true };
    },
    undefined,
    runner.options,
  );
  const server = createServer((req, res) => {
    void service.handle(req, res);
  });
  let release: () => void = () => {};
  let received: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    received = resolve;
  });
  const source = createServer((_req, res) => {
    release = () => {
      if (res.writableEnded) return;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          entries: Object.fromEntries(
            altitudeCohort.map(({ story }) => [story, {}]),
          ),
        }),
      );
    };
    received();
  });
  await Promise.all([listen(server), listen(source)]);
  const base = originOf(server) + "/api/source-reference";
  try {
    const capture = fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin: originOf(source) }),
    });
    await pending;
    assert.equal(
      (
        await fetch(`${base}/${f.request.baseline.id}/button-candidate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
      202,
    );
    release();
    assert.equal((await capture).status, 409);
    assert.equal(captures, 0);
    assert.equal(runner.calls.length, 1);
  } finally {
    release();
    service.close();
    await Promise.all([closeServer(server), closeServer(source)]);
    f.close();
  }
});

test("candidate preparation never omits a changed latest supplement or accepts a non-baseline id", async () => {
  const f = fixture(),
    runner = candidateStub(f);
  const service = createReferenceService(
    f.repo,
    undefined,
    undefined,
    runner.options,
  );
  const server = createServer((req, res) => {
    void service.handle(req, res);
  });
  await listen(server);
  const base = originOf(server) + "/api/source-reference";
  const post = (id: string) =>
    fetch(`${base}/${id}/button-candidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  try {
    assert.equal((await post(f.request.supplement!.id)).status, 409);
    const target = path.join(
      f.repo,
      "private/source-reference-app",
      f.request.supplement!.id,
      "measurement.json",
    );
    f.put(target, "{ broken record");
    assert.equal((await post(f.request.baseline.id)).status, 409);
    assert.equal(runner.calls.length, 0);
  } finally {
    service.close();
    await closeServer(server);
    f.close();
  }
});
