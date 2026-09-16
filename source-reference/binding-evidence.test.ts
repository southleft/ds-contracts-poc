import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  symlinkSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import {
  loadBindingEvidence,
  isBindingEvidenceRequest,
  bindingStories,
  recordedStoryUrl,
  type BindingEvidenceRequest,
} from "./binding-evidence.js";
import { altitudeCohort, altitudeRevision } from "./altitude-cohort.js";
import { createBindingJobs, type BindingTraceReport } from "./binding-jobs.js";
import { planBindingInterventions } from "./binding-plan.js";
import { matchLitRender } from "./lit-render-match.js";
import { createReferenceService } from "./service.js";
import { createServer } from "node:http";
const sha = (bytes: string | Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const archive = (url: string) =>
  Buffer.from(
    JSON.stringify({ log: { entries: [{ request: { method: "GET", url } }] } }),
  );
function fixture() {
  const dir = mkdtempSync(path.join(tmpdir(), "binding-evidence-")),
    repo = path.join(dir, "repo"),
    id = "00000000-0000-4000-8000-000000000001";
  const output = path.join(repo, "private/source-reference-app", id);
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
  const bytes = (name: string) => {
    const file = files[name],
      value =
        file.utf8 === undefined
          ? Buffer.from(file.base64, "base64")
          : Buffer.from(file.utf8);
    assert.equal(sha(value), file.sha256);
    return value;
  };
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
    [program.manifestPath]: program.manifestSha256,
  };
  put(path.join(dir, "altitude", program.manifestPath), bytes("manifest.json"));
  for (const [file, record] of Object.entries(program.files) as [
    string,
    { text: string; sha256: string },
  ][]) {
    assert.equal(sha(record.text), record.sha256);
    put(path.join(dir, "altitude", file), record.text);
    sourceHashes[file] = record.sha256;
  }
  const rows = altitudeCohort.map(({ story }) => {
    if (!captured.selectedStories.includes(story)) {
      const missing = {
        story,
        qualified: false,
        error: "Missing state in bounded fixture, never a source pass",
      };
      put(
        path.join(output, story, "measurement.json"),
        JSON.stringify(missing),
      );
      return missing;
    }
    for (const name of [
      "source-semantics.json",
      "replay-semantics.json",
      "source-tree.json",
      "replay-tree.json",
      "source.png",
      "replay.png",
    ])
      put(path.join(output, story, name), bytes(`${story}/${name}`));
    // Synthetic archive only tests transport/path admission. No runtime or
    // original-HAR outcome is claimed by these fixtures.
    const har = archive(
      `http://127.0.0.1:6017/iframe.html?id=${story}&viewMode=story`,
    );
    put(path.join(output, story, "source.har"), har);
    const row = JSON.parse(bytes(`${story}/measurement.json`).toString());
    row.archive.sha256 = sha(har);
    put(path.join(output, story, "measurement.json"), JSON.stringify(row));
    return row;
  });
  const final = JSON.stringify({
    sourceRevision: altitudeRevision,
    sourceStable: true,
    recordedAt: "2026-09-15T15:00:00.000Z",
    sourceHashes,
    denominator: 10,
    qualified: 2,
    rows,
  });
  put(path.join(output, "measurement.json"), final);
  const request: BindingEvidenceRequest = {
    version: 1,
    baseline: { id, sha256: sha(final) },
  };
  return {
    dir,
    repo,
    output,
    request,
    close: () => rmSync(dir, { recursive: true, force: true }),
  };
}

function refusedReport(f: ReturnType<typeof fixture>): BindingTraceReport {
  const evidence = loadBindingEvidence(f.repo, f.request);
  return {
    version: 1,
    request: f.request,
    sourceProgramSha256: evidence.sourceProgramSha256,
    sourceStable: true,
    scope: "Fixture tests job lifecycle, not runtime qualification.",
    rows: evidence.rows.map((row) => ({
      story: row.story,
      status: "refused",
      problems: ["fixture-replay-not-run"],
      matchedElements: 0,
      mappedSlots: 0,
      observedDependencies: 0,
      plannedDependencies: planBindingInterventions(row.story).length,
      differentials: planBindingInterventions(row.story).map((plan) => ({
        key: plan.key,
        problems: ["fixture-not-run"],
      })),
    })),
  };
}

/** Stored original topology, with no fabricated successful dependency probes.
 * The archive remains synthetic: this is a selector/reader consistency fixture. */
function structuralReport(f: ReturnType<typeof fixture>): BindingTraceReport {
  const evidence = loadBindingEvidence(f.repo, f.request);
  const recorded = JSON.parse(
    readFileSync(
      new URL(
        "./fixtures/lit-render-match/altitude-button.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const original = recorded.records.find(
    (row: { story: string }) => row.story === "atoms-button--default",
  );
  assert.equal(sha(original.measurement.json), original.measurement.sha256);
  const bound = JSON.parse(original.measurement.json).bound;
  const correspondence = matchLitRender({
    source: evidence.source,
    semantics: evidence.rows[0].semantics!,
    boundTopology: bound,
  });
  assert.equal(correspondence.status, "structure-matched");
  const report = refusedReport(f);
  report.rows[0] = {
    ...report.rows[0],
    status: "structure-matched",
    matchedElements: correspondence.nodes.length,
    mappedSlots: correspondence.slots.length,
    boundTopology: bound,
    correspondence,
    differentials: planBindingInterventions(
      "atoms-button--default",
      correspondence,
      bound,
    ).map((plan) => ({ key: plan.key, problems: ["fixture-not-run"] })),
  };
  return report;
}

test("server-only binding selection verifies sealed evidence and reopens without executing or exposing source in snapshots", () => {
  const f = fixture();
  let calls = 0,
    output = "";
  const jobs = createBindingJobs(f.repo, (args, done) => {
    calls++;
    output = args.at(-1)!;
    mkdirSync(path.join(output, "atoms-button--default"));
    writeFileSync(
      path.join(output, "atoms-button--default/replay.png"),
      readFileSync(path.join(f.output, "atoms-button--default/source.png")),
    );
    writeFileSync(
      path.join(output, "report.json"),
      JSON.stringify(structuralReport(f)),
    );
    done(null);
    return { kill: () => true };
  });
  try {
    const job = jobs.start(f.request);
    assert.equal(job.state, "complete");
    const before = readFileSync(path.join(output, "job.json"));
    const selected = jobs.selectLatestVerified(f.request);
    assert.equal(selected.id, job.id);
    assert.deepEqual(selected.request, f.request);
    assert.equal(
      selected.reportSha256,
      sha(readFileSync(path.join(output, "report.json"))),
    );
    assert.deepEqual(selected.report, structuralReport(f));
    assert.deepEqual(selected.evidence, loadBindingEvidence(f.repo, f.request));
    assert.equal(
      selected.report.rows.filter((row) => row.status === "structure-matched")
        .length,
      1,
    );
    assert.equal(
      selected.evidence.rows.length,
      4,
      "refused source states remain in the denominator",
    );
    assert.equal(selected.report.rows[0].observedDependencies, 0);
    const recovered = createBindingJobs(f.repo, () => {
      throw Error("must not launch");
    });
    assert.deepEqual(recovered.selectLatestVerified(f.request), selected);
    assert.deepEqual(jobs.selectLatestVerified(f.request), selected);
    selected.request.baseline.sha256 = "a".repeat(64);
    selected.evidence.request.baseline.sha256 = "b".repeat(64);
    assert.deepEqual(
      jobs.selectLatestVerified(f.request).request,
      f.request,
      "callers cannot mutate the manager's request through the returned handle",
    );
    assert.equal(calls, 1);
    assert.deepEqual(readFileSync(path.join(output, "job.json")), before);
    for (const snapshot of jobs.list(f.request.baseline.id)) {
      assert.equal("evidence" in snapshot, false);
      assert.equal("request" in snapshot, false);
      assert.equal("reportSha256" in snapshot, false);
      assert.equal(JSON.stringify(snapshot).includes("harPath"), false);
      assert.equal(
        JSON.stringify(snapshot).includes("export class ALButton"),
        false,
      );
    }
  } finally {
    jobs.close();
    f.close();
  }
});

test("verified selection refuses wrong parents and a newer running, failed or interrupted attempt instead of older evidence", () => {
  const f = fixture();
  let done: (error: unknown) => void = () => {},
    output = "";
  const jobs = createBindingJobs(f.repo, (args, cb) => {
    output = args.at(-1)!;
    done = cb;
    return { kill: () => true };
  });
  try {
    assert.throws(
      () => jobs.selectLatestVerified(f.request),
      /binding-selection-unavailable/,
    );
    jobs.start(f.request);
    writeFileSync(
      path.join(output, "report.json"),
      JSON.stringify(refusedReport(f)),
    );
    done(null);
    assert.doesNotThrow(() => jobs.selectLatestVerified(f.request));
    assert.throws(
      () =>
        jobs.selectLatestVerified({
          ...f.request,
          baseline: {
            ...f.request.baseline,
            id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
          },
        }),
      /binding-selection-unavailable/,
    );
    assert.throws(
      () =>
        jobs.selectLatestVerified({
          ...f.request,
          baseline: { ...f.request.baseline, sha256: "a".repeat(64) },
        }),
      /binding-selection-request-mismatch/,
    );
    assert.throws(
      () =>
        jobs.selectLatestVerified({
          ...f.request,
          baseline: { ...f.request.baseline, id: "../outside" },
        }),
      /binding-request-invalid/,
    );
    jobs.start(f.request, true);
    assert.throws(
      () => jobs.selectLatestVerified(f.request),
      /binding-selection-(?:not-complete|order-ambiguous)/,
    );
    done(Error("fixture stopped"));
    assert.throws(
      () => jobs.selectLatestVerified(f.request),
      /binding-selection-(?:not-complete|order-ambiguous)/,
    );
    jobs.start(f.request, true);
    jobs.close();
    const recovered = createBindingJobs(f.repo, () => {
      throw Error("must not launch");
    });
    assert.throws(
      () => recovered.selectLatestVerified(f.request),
      /binding-selection-(?:not-complete|order-ambiguous)/,
    );
    assert.ok(
      recovered
        .list(f.request.baseline.id)
        .some((job) => job.state === "complete"),
      "the old completed attempt remains visible but cannot win selection",
    );
  } finally {
    jobs.close();
    f.close();
  }
});

test("verified selection rechecks report, source, original/replay image and sealed job bytes", async (t) => {
  for (const changed of [
    "report",
    "source",
    "original-image",
    "replay-image",
    "job",
  ] as const)
    await t.test(changed, () => {
      const f = fixture();
      let output = "";
      const jobs = createBindingJobs(f.repo, (args, done) => {
        output = args.at(-1)!;
        mkdirSync(path.join(output, "atoms-button--default"));
        writeFileSync(
          path.join(output, "atoms-button--default/replay.png"),
          readFileSync(path.join(f.output, "atoms-button--default/source.png")),
        );
        writeFileSync(
          path.join(output, "report.json"),
          JSON.stringify(structuralReport(f)),
        );
        done(null);
        return { kill: () => true };
      });
      try {
        jobs.start(f.request);
        assert.doesNotThrow(() => jobs.selectLatestVerified(f.request));
        const file =
          changed === "report"
            ? path.join(output, "report.json")
            : changed === "source"
              ? path.join(
                  f.dir,
                  "altitude/libs/al-web-components/components/button/button.ts",
                )
              : changed === "original-image"
                ? path.join(f.output, "atoms-button--default/source.png")
                : changed === "replay-image"
                  ? path.join(output, "atoms-button--default/replay.png")
                  : path.join(output, "job.json");
        const bytes = readFileSync(file);
        writeFileSync(
          file,
          changed === "report"
            ? Buffer.concat([bytes, Buffer.from(" ")])
            : "changed fixture bytes",
        );
        assert.throws(
          () => jobs.selectLatestVerified(f.request),
          /binding-|Unexpected token/,
        );
        writeFileSync(file, bytes);
        assert.doesNotThrow(
          () => jobs.selectLatestVerified(f.request),
          "exact byte restoration restores selection",
        );
      } finally {
        jobs.close();
        f.close();
      }
    });
});

test("latest selection cannot fall back across supplemental requests or ambiguous recorded timestamps", () => {
  const f = fixture();
  let output = "";
  const jobs = createBindingJobs(f.repo, (args, done) => {
    output = args.at(-1)!;
    writeFileSync(
      path.join(output, "report.json"),
      JSON.stringify(refusedReport(f)),
    );
    done(null);
    return { kill: () => true };
  });
  try {
    jobs.start(f.request);
    const earlierFile = path.join(output, "job.json");
    const earlier = JSON.parse(readFileSync(earlierFile, "utf8"));
    jobs.start(f.request, true);
    const latestFile = path.join(output, "job.json");
    const latest = JSON.parse(readFileSync(latestFile, "utf8"));
    earlier.startedAt = "2026-09-15T10:00:00.000Z";
    latest.startedAt = "2026-09-15T10:00:01.000Z";
    writeFileSync(earlierFile, JSON.stringify(earlier));
    writeFileSync(latestFile, JSON.stringify(latest));
    const recovered = createBindingJobs(f.repo);
    assert.equal(recovered.selectLatestVerified(f.request).id, latest.id);
    const reportFile = path.join(output, "report.json"),
      reportBytes = readFileSync(reportFile);
    writeFileSync(reportFile, Buffer.concat([reportBytes, Buffer.from(" ")]));
    assert.throws(
      () => recovered.selectLatestVerified(f.request),
      /binding-report-changed/,
    );
    writeFileSync(reportFile, reportBytes);
    latest.request.supplement = {
      id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      sha256: "a".repeat(64),
    };
    writeFileSync(latestFile, JSON.stringify(latest));
    assert.throws(
      () => createBindingJobs(f.repo).selectLatestVerified(f.request),
      /binding-selection-request-mismatch/,
    );
    latest.request = f.request;
    latest.startedAt = earlier.startedAt;
    writeFileSync(latestFile, JSON.stringify(latest));
    assert.throws(
      () => createBindingJobs(f.repo).selectLatestVerified(f.request),
      /binding-selection-order-ambiguous/,
    );
    writeFileSync(latestFile, "malformed latest attempt");
    assert.throws(
      () => createBindingJobs(f.repo).selectLatestVerified(f.request),
      /binding-selection-history-invalid/,
    );
    for (const startedAt of [42, "September 15, 2026 10:00:01 UTC"]) {
      writeFileSync(latestFile, JSON.stringify({ ...latest, startedAt }));
      assert.throws(
        () => createBindingJobs(f.repo).selectLatestVerified(f.request),
        /binding-selection-history-invalid/,
      );
    }
    latest.startedAt = "2026-09-15T10:00:01.000Z";
    writeFileSync(latestFile, JSON.stringify(latest));
    const unknown = path.join(
      path.dirname(output),
      "ffffffff-ffff-4fff-8fff-ffffffffffff",
    );
    mkdirSync(unknown);
    assert.throws(
      () => recovered.selectLatestVerified(f.request),
      /binding-selection-history-changed/,
    );
    assert.throws(
      () => createBindingJobs(f.repo).selectLatestVerified(f.request),
      /binding-selection-history-invalid/,
    );
    rmSync(unknown, { recursive: true });
    symlinkSync(output, unknown, "dir");
    assert.throws(
      () => recovered.selectLatestVerified(f.request),
      /binding-selection-history-changed/,
    );
    assert.throws(
      () => createBindingJobs(f.repo).selectLatestVerified(f.request),
      /binding-selection-history-invalid/,
    );
  } finally {
    jobs.close();
    f.close();
  }
});

test("selection scopes unrelated history but refuses an attempt retargeted into its parent after recovery", () => {
  const f = fixture();
  let output = "";
  const jobs = createBindingJobs(f.repo, (args, done) => {
    output = args.at(-1)!;
    writeFileSync(
      path.join(output, "report.json"),
      JSON.stringify(refusedReport(f)),
    );
    done(null);
    return { kill: () => true };
  });
  try {
    const selected = jobs.start(f.request);
    const otherId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const otherDir = path.join(path.dirname(output), otherId);
    mkdirSync(otherDir);
    const other = {
      ...JSON.parse(readFileSync(path.join(output, "job.json"), "utf8")),
      id: otherId,
      startedAt: "2099-01-01T00:00:00.000Z",
      state: "failed",
      request: {
        ...f.request,
        baseline: {
          ...f.request.baseline,
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        },
      },
    };
    const otherFile = path.join(otherDir, "job.json");
    writeFileSync(otherFile, JSON.stringify(other));
    const recovered = createBindingJobs(f.repo);
    assert.equal(recovered.selectLatestVerified(f.request).id, selected.id);
    writeFileSync(otherFile, JSON.stringify({ ...other, request: f.request }));
    assert.throws(
      () => recovered.selectLatestVerified(f.request),
      /binding-selection-(?:history-changed|job-changed)/,
      "a cached unrelated identity must not hide a newer now-relevant failure",
    );
    writeFileSync(
      otherFile,
      JSON.stringify({ ...other, startedAt: "invalid unrelated timestamp" }),
    );
    assert.equal(
      createBindingJobs(f.repo).selectLatestVerified(f.request).id,
      selected.id,
      "malformed ordering in explicitly unrelated parent history cannot block this baseline",
    );
    assert.equal(recovered.selectLatestVerified(f.request).id, selected.id);
  } finally {
    jobs.close();
    f.close();
  }
});
test("binding jobs retain denominator, deduplicate, recover, and reject altered counters/report bytes", () => {
  const f = fixture();
  let done: (error: unknown) => void = () => {};
  let calls = 0,
    killed = 0,
    out = "";
  const jobs = createBindingJobs(f.repo, (args, cb) => {
    calls++;
    done = cb;
    out = args.at(-1)!;
    assert.equal(args[2], "source-reference/binding-run.ts");
    return {
      kill: () => {
        killed++;
        return true;
      },
    };
  });
  try {
    const job = jobs.start(f.request);
    assert.equal(job.state, "running");
    assert.equal(job.denominator, 4);
    assert.equal(jobs.start(f.request).id, job.id);
    assert.equal(calls, 1);
    const report = refusedReport(f);
    writeFileSync(path.join(out, "report.json"), JSON.stringify(report));
    done(null);
    assert.equal(jobs.running, false);
    assert.equal(jobs.list(f.request.baseline.id)[0].state, "complete");
    assert.equal(jobs.start(f.request).matched, 0);
    assert.equal(calls, 1);
    const recovered = createBindingJobs(f.repo, () => {
      throw Error("must not launch");
    });
    assert.equal(recovered.list(f.request.baseline.id)[0].state, "complete");
    report.rows[0].observedDependencies = 3;
    writeFileSync(path.join(out, "report.json"), JSON.stringify(report));
    assert.equal(recovered.list(f.request.baseline.id)[0].state, "failed");
    const retry = jobs.start(f.request, true);
    assert.notEqual(retry.id, job.id);
    writeFileSync(path.join(out, "report.json"), JSON.stringify(report));
    done(null);
    assert.equal(
      jobs.list(f.request.baseline.id).at(-1)!.state,
      "failed",
      "counters cannot fabricate an observation even before report hash is sealed",
    );
    jobs.start(f.request, true);
    jobs.close();
    assert.equal(killed, 1);
    assert.equal(jobs.running, false);
    assert.equal(
      createBindingJobs(f.repo).list(f.request.baseline.id).at(-1)!.state,
      "interrupted",
    );
  } finally {
    jobs.close();
    f.close();
  }
});
test("binding job synchronous completion/throw and symlink failures do not strand or overwrite", () => {
  const f = fixture();
  try {
    const immediate = createBindingJobs(f.repo, (args, done) => {
      writeFileSync(
        path.join(args.at(-1)!, "report.json"),
        JSON.stringify(refusedReport(f)),
      );
      done(null);
      return { kill: () => true };
    });
    assert.equal(immediate.start(f.request).state, "complete");
    assert.equal(immediate.running, false);
    const thrown = createBindingJobs(f.repo, () => {
      throw Error("sync failure");
    });
    assert.throws(() => thrown.start(f.request, true), /could not start/);
    assert.equal(thrown.running, false);
    let done: (error: unknown) => void = () => {},
      killed = false,
      output = "";
    const links = createBindingJobs(f.repo, (args, cb) => {
      output = args.at(-1)!;
      done = cb;
      return {
        kill: () => {
          killed = true;
          return true;
        },
      };
    });
    links.start(f.request, true);
    const outside = path.join(f.dir, "owner-file");
    writeFileSync(outside, "must remain unchanged");
    rmSync(path.join(output, "job.json"));
    symlinkSync(outside, path.join(output, "job.json"));
    links.close();
    done(null);
    assert.equal(killed, true);
    assert.equal(links.running, false);
    assert.equal(readFileSync(outside, "utf8"), "must remain unchanged");
    // Malformed metadata must not be adopted and later crash list().
    const invalid = path.join(
      f.repo,
      "private/source-binding-app/ffffffff-ffff-4fff-8fff-ffffffffffff",
    );
    mkdirSync(invalid);
    writeFileSync(
      path.join(invalid, "job.json"),
      JSON.stringify({
        version: 1,
        id: path.basename(invalid),
        request: {},
        stories: ["atoms-button--default"],
        state: "running",
        startedAt: new Date().toISOString(),
        sourceProgramSha256: "a".repeat(64),
      }),
    );
    assert.doesNotThrow(() =>
      createBindingJobs(f.repo).list(f.request.baseline.id),
    );
    assert.ok(
      readdirSync(path.dirname(invalid)).includes(path.basename(invalid)),
      "invalid history is preserved",
    );
  } finally {
    f.close();
  }
});
test("binding jobs refuse a linked evidence root without writing to its destination", () => {
  const f = fixture();
  try {
    const outside = path.join(f.dir, "outside");
    mkdirSync(outside);
    symlinkSync(outside, path.join(f.repo, "private/source-binding-app"));
    const jobs = createBindingJobs(f.repo);
    assert.throws(() => jobs.start(f.request), /directory-refused/);
    assert.deepEqual(readdirSync(outside), []);
  } finally {
    f.close();
  }
});
test("app launches fixed binding replay from recorded originals, retains refusals and rejects arbitrary input/cross-origin access", async () => {
  const f = fixture();
  let calls = 0,
    done: (error: unknown) => void = () => {},
    output = "";
  const service = createReferenceService(
    f.repo,
    () => {
      throw Error("must not recapture originals");
    },
    (args, cb) => {
      calls++;
      done = cb;
      output = args.at(-1)!;
      return { kill: () => true };
    },
  );
  const server = createServer((req, res) => {
    void service.handle(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/source-reference`;
  const post = (body: unknown = {}, extra: Record<string, string> = {}) =>
    fetch(`${base}/${f.request.baseline.id}/button-bindings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...extra },
      body: JSON.stringify(body),
    });
  try {
    assert.equal(
      (await post({}, { Origin: "https://attacker.invalid" })).status,
      403,
    );
    for (const body of [
      { source: "other" },
      { url: "http://attacker.invalid" },
      { script: "echo" },
      { retry: 1 },
      null,
    ])
      assert.equal((await post(body)).status, 400);
    assert.equal(calls, 0);
    let response = await post();
    assert.equal(response.status, 202);
    let job = await response.json();
    assert.equal(job.bindingTraces.length, 1);
    assert.equal(job.bindingTraces[0].denominator, 4);
    assert.equal(job.bindingTraces[0].state, "running");
    await post();
    assert.equal(calls, 1);
    assert.equal(
      (
        await fetch(base, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ origin: "http://127.0.0.1:6017" }),
        })
      ).status,
      409,
    );
    writeFileSync(
      path.join(output, "report.json"),
      JSON.stringify(refusedReport(f)),
    );
    done(null);
    job = await (await fetch(`${base}/${f.request.baseline.id}`)).json();
    assert.equal(job.bindingTraces[0].state, "complete");
    assert.equal(job.bindingTraces[0].matched, 0);
    assert.equal(job.bindingTraces[0].rows.length, 4);
    assert.equal(job.bindingTraces[0].rows[0].plannedDependencies, 3);
    assert.equal(job.contractAdmission.acceptedContract, null);
    assert.equal(
      (
        await fetch(
          `${base}/bindings/${job.bindingTraces[0].id}/atoms-button--default/source.har`,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await fetch(
          `${base}/bindings/${job.bindingTraces[0].id}/atoms-button--default/replay.png`,
        )
      ).status,
      404,
    );
    assert.equal(JSON.stringify(job.bindingTraces).includes(f.repo), false);
  } finally {
    service.close();
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
    f.close();
  }
});
test("archive selection uses exact unauthenticated loopback story identity, never source-supplied arbitrary URLs", () => {
  const story = "atoms-button--default",
    url = `http://127.0.0.1:6017/iframe.html?id=${story}&viewMode=story`;
  assert.equal(recordedStoryUrl(archive(url), story), url);
  for (const candidate of [
    url.replace("127.0.0.1", "example.com"),
    url.replace("http:", "https:"),
    url.replace("127.0.0.1", "user:secret@127.0.0.1"),
    url + "&token=secret",
    url + "#fragment",
    url + "&id=second",
  ])
    assert.throws(
      () => recordedStoryUrl(archive(candidate), story),
      /binding-archive-origin-refused/,
    );
  assert.throws(
    () => recordedStoryUrl(archive(url), "different-story"),
    /story-not-unique/,
  );
  const two = Buffer.from(
    JSON.stringify({
      log: {
        entries: [
          { request: { method: "GET", url } },
          { request: { method: "GET", url: url.replace(":6017", ":6018") } },
        ],
      },
    }),
  );
  assert.throws(() => recordedStoryUrl(two, story), /story-not-unique/);
});
test("recorded evidence reuses the existing planner, retains refused states and refuses modified transport/source identity", () => {
  const f = fixture();
  try {
    const initial = loadBindingEvidence(f.repo, f.request);
    assert.equal(initial.rows.length, 4);
    assert.equal(initial.rows.filter((row) => row.eligible).length, 2);
    assert.equal(initial.rows[2].eligible, false);
    assert.equal(initial.source.className, "ALButton");
    assert.ok(initial.rows.every((row) => row.eligible || row.problems.length));
    assert.deepEqual(loadBindingEvidence(f.repo, f.request), initial);
    const har = path.join(f.output, "atoms-button--default/source.har"),
      original = readFileSync(har);
    writeFileSync(har, "corrupt");
    let changed = loadBindingEvidence(f.repo, f.request);
    assert.equal(changed.rows.filter((row) => row.eligible).length, 1);
    assert.ok(
      changed.rows[0].problems.includes("binding-archive-hash-mismatch"),
    );
    writeFileSync(har, original);
    const rowFile = path.join(
        f.output,
        "atoms-button--default/measurement.json",
      ),
      rowBytes = readFileSync(rowFile);
    const bad = JSON.parse(rowBytes.toString());
    bad.profile.fontFamily = "Different";
    writeFileSync(rowFile, JSON.stringify(bad));
    changed = loadBindingEvidence(f.repo, f.request);
    assert.equal(changed.rows[0].eligible, false);
    assert.equal(changed.rows[1].eligible, true);
    writeFileSync(rowFile, rowBytes);
    const elsewhere = path.join(f.dir, "elsewhere.har");
    writeFileSync(elsewhere, original);
    rmSync(har);
    symlinkSync(elsewhere, har);
    changed = loadBindingEvidence(f.repo, f.request);
    assert.equal(changed.rows[0].eligible, false);
    assert.ok(
      changed.rows[0].problems.includes("binding-evidence-kind-refused"),
    );
    assert.throws(
      () =>
        loadBindingEvidence(f.repo, {
          ...f.request,
          baseline: { ...f.request.baseline, sha256: "a".repeat(64) },
        }),
      /binding-parent-hash-mismatch/,
    );
    assert.throws(
      () =>
        loadBindingEvidence(f.repo, {
          ...f.request,
          baseline: { ...f.request.baseline, id: "../outside" },
        }),
      /binding-request-invalid/,
    );
    writeFileSync(
      path.join(
        f.dir,
        "altitude/libs/al-web-components/components/button/button.ts",
      ),
      "changed source",
    );
    assert.throws(
      () => loadBindingEvidence(f.repo, f.request),
      /binding-source-program-refused/,
    );
  } finally {
    f.close();
  }
});

test("versioned Checkbox requests preserve the four-state cohort and reject cross-component or supplemental overrides", () => {
  const baseline = {
    id: "00000000-0000-4000-8000-000000000001",
    sha256: "a".repeat(64),
  };
  const request: BindingEvidenceRequest = {
    version: 2,
    component: "al-checkbox",
    baseline,
  };
  assert.equal(isBindingEvidenceRequest(request), true);
  assert.deepEqual(bindingStories(request), [
    "atoms-checkbox--default",
    "atoms-checkbox--checked",
    "atoms-checkbox--indeterminate",
    "atoms-checkbox--disabled",
  ]);
  for (const changed of [
    { ...request, version: 1 },
    { ...request, component: "al-button" },
    { ...request, component: undefined },
    { ...request, supplement: baseline },
    { ...request, script: "arbitrary" },
  ])
    assert.equal(isBindingEvidenceRequest(changed), false);
  assert.equal(isBindingEvidenceRequest({ version: 1, baseline }), true);
});

test("newer Checkbox history does not replace the verified Button selection for the same baseline", () => {
  const f = fixture();
  let output = "";
  const jobs = createBindingJobs(f.repo, (args, done) => {
    output = args.at(-1)!;
    writeFileSync(
      path.join(output, "report.json"),
      JSON.stringify(refusedReport(f)),
    );
    done(null);
    return { kill: () => true };
  });
  try {
    const selected = jobs.start(f.request),
      id = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const directory = path.join(path.dirname(output), id);
    mkdirSync(directory);
    const request: BindingEvidenceRequest = {
      version: 2,
      component: "al-checkbox",
      baseline: f.request.baseline,
    };
    const job = {
      ...JSON.parse(readFileSync(path.join(output, "job.json"), "utf8")),
      id,
      request,
      stories: bindingStories(request),
      state: "failed",
      startedAt: "2099-01-01T00:00:00.000Z",
    };
    writeFileSync(path.join(directory, "job.json"), JSON.stringify(job));
    const recovered = createBindingJobs(f.repo);
    assert.equal(recovered.selectLatestVerified(f.request).id, selected.id);
    assert.equal(
      recovered.list(f.request.baseline.id).find((item) => item.id === id)
        ?.component,
      "al-checkbox",
    );
    assert.throws(
      () => recovered.selectLatestVerified(request),
      /binding-selection-not-complete/,
    );
    writeFileSync(
      path.join(directory, "job.json"),
      JSON.stringify({ ...job, request: f.request }),
    );
    assert.throws(
      () => recovered.selectLatestVerified(f.request),
      /binding-selection-job-changed/,
    );
    recovered.close();
  } finally {
    jobs.close();
    f.close();
  }
});
