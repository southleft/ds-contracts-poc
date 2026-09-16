import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createReferenceService, loopbackOrigin } from "./service.js";
import { altitudeCohort, altitudeRevision } from "./altitude-cohort.js";

test("source API: all states retained, no premature success, isolated assets and safe retry", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "reference-api-"));
  let done: (error: unknown) => void = () => {};
  let calls = 0;
  let args: string[] = [];
  let killed = false;
  const service = createReferenceService(dir, (argv, cb) => {
    calls++;
    args = argv;
    done = cb;
    return {
      kill: () => {
        killed = true;
        return true;
      },
    };
  });
  const server = createServer((req, res) => {
    void service.handle(req, res);
  });
  const source = createServer((_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        entries: Object.fromEntries(altitudeCohort.map((e) => [e.story, {}])),
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  await new Promise<void>((resolve) => source.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/source-reference`;
  const origin = `http://127.0.0.1:${(source.address() as { port: number }).port}`;
  const post = () =>
    fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin }),
    });
  try {
    assert.equal(
      (await fetch(base, { headers: { Origin: "https://attacker.invalid" } }))
        .status,
      403,
    );
    assert.equal(
      (await fetch(base, { method: "POST", body: "origin=evil" })).status,
      415,
    );
    assert.equal(
      (
        await fetch(base, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ origin: "https://example.com" }),
        })
      ).status,
      400,
    );
    const response = await post();
    assert.equal(response.status, 202);
    const job = await response.json();
    assert.equal(job.rows.length, 10);
    assert.equal(job.qualified, 0);
    assert.ok(
      job.rows.every((r: { status: string }) => r.status === "pending"),
    );
    assert.equal((await (await post()).json()).id, job.id);
    assert.equal(
      calls,
      1,
      "double submission must not launch duplicate captures",
    );
    assert.equal(args[2], "source-reference/cohort-run.ts");
    assert.equal(args[3], origin);
    assert.equal(args[4], path.resolve(dir, "..", "altitude"));
    const out = args[5];
    mkdirSync(out, { recursive: true });
    const capturedRows: Record<string, unknown>[] = [];
    const pngSha256 = createHash("sha256").update("png").digest("hex");
    for (const [i, { story }] of altitudeCohort.entries()) {
      mkdirSync(path.join(out, story));
      const row = {
        story,
        qualified: i !== 2,
        compilerInput: { status: "verified-capture", problems: [] },
        semanticIntake: { status: "observed", problems: [], limitations: [] },
        source: {
          status: i === 2 ? "invalid" : "valid",
          sha256: pngSha256,
          problems: i === 2 ? ["native-disabled-missing"] : [],
        },
        replay: { status: "valid", sha256: pngSha256, problems: [] },
      };
      capturedRows.push(row);
      writeFileSync(
        path.join(out, story, "measurement.json"),
        JSON.stringify(row),
      );
      writeFileSync(path.join(out, story, "source.png"), "png");
      writeFileSync(path.join(out, story, "replay.png"), "png");
      writeFileSync(path.join(out, story, "source.har"), "DO NOT EXPOSE");
    }
    const provisional = await (await fetch(`${base}/${job.id}`)).json();
    assert.equal(provisional.qualified, 0, "must await final source integrity");
    assert.equal(
      provisional.rows[0].semanticIntake.status,
      "awaiting-source-integrity",
    );
    assert.equal(
      provisional.rows[0].compilerInput.status,
      "awaiting-source-integrity",
    );
    writeFileSync(
      path.join(out, "measurement.json"),
      JSON.stringify({ rows: capturedRows }),
    );
    const missingIntegrity = await (await fetch(`${base}/${job.id}`)).json();
    assert.equal(missingIntegrity.qualified, 0);
    for (const field of ["semanticIntake", "compilerInput"] as const) {
      assert.ok(
        missingIntegrity.rows.every(
          (row: Record<typeof field, { status: string }>) =>
            row[field].status === "awaiting-source-integrity",
        ),
        `${field}: absent integrity evidence is pending, not a confirmed invalid source`,
      );
    }
    writeFileSync(
      path.join(out, "measurement.json"),
      JSON.stringify({ sourceStable: true, rows: capturedRows }),
    );
    done(new Error("Exit 1: expected refusals"));
    const final = await (await fetch(`${base}/${job.id}`)).json();
    assert.equal(final.state, "complete");
    assert.equal(final.qualified, 9);
    assert.equal(final.rows[0].compilerInput.status, "verified-capture");
    assert.equal(final.rows[0].semanticIntake.status, "observed");
    assert.equal(
      final.rows[2].semanticIntake.status,
      "source-invalid",
      "semantic observations cannot override invalid source",
    );
    assert.equal(
      final.rows[2].compilerInput.status,
      "source-invalid",
      "a claimed capture never overrides a refused source",
    );
    assert.equal(final.denominator, 10);
    assert.equal(final.rows[2].status, "invalid");
    assert.equal(final.fidelity, "not measured");
    assert.equal(final.usability, "not qualified");
    assert.equal(
      (await fetch(`${base}/${job.id}/${altitudeCohort[0].story}/source.har`))
        .status,
      404,
    );
    assert.equal(
      (await fetch(`${base}/${job.id}/${altitudeCohort[0].story}/source.png`))
        .status,
      200,
    );
    assert.equal(
      (await fetch(`${base}/${job.id}/unknown/source.png`)).status,
      404,
    );
    writeFileSync(
      path.join(out, "measurement.json"),
      JSON.stringify({ sourceStable: false, rows: capturedRows }),
    );
    const changed = await (await fetch(`${base}/${job.id}`)).json();
    assert.equal(changed.state, "complete");
    assert.equal(changed.qualified, 0);
    for (const field of ["semanticIntake", "compilerInput"] as const) {
      assert.ok(
        changed.rows.every(
          (row: Record<typeof field, { status: string }>) =>
            row[field].status === "source-invalid",
        ),
        `${field}: failed final source integrity must invalidate every intake`,
      );
    }
    assert.ok(
      changed.rows.every((r: { status: string }) => r.status === "invalid"),
    );
    const retry = await (await post()).json();
    assert.notEqual(retry.id, job.id);
    assert.equal(calls, 2);
    done(new Error("timeout"));
    const failed = await (await fetch(`${base}/${retry.id}`)).json();
    assert.equal(failed.state, "failed");
    assert.equal(failed.qualified, 0);
    assert.equal(failed.rows.length, 10);
    await post();
    service.close();
    assert.equal(killed, true);
  } finally {
    service.close();
    server.closeAllConnections();
    source.closeAllConnections();
    await Promise.all([
      new Promise<void>((r) => server.close(() => r())),
      new Promise<void>((r) => source.close(() => r())),
    ]);
    rmSync(dir, { recursive: true, force: true });
  }
});

test("completed cohorts recover read-only after restart; invalid and escaping evidence stays unavailable", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "reference-recovery-"));
  const root = path.join(dir, "private", "source-reference-app");
  const id = (n: number) =>
    `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const imageBytes = "verified image bytes";
  const imageHash = createHash("sha256").update(imageBytes).digest("hex");
  const rows = altitudeCohort.map(({ story }, index) => ({
    story,
    qualified: index !== 2,
    source: {
      status: index === 2 ? "refused" : "valid",
      sha256: imageHash,
      problems: index === 2 ? ["source-refused"] : [],
    },
    replay: { status: "valid", sha256: imageHash, problems: [] },
    compilerInput: { status: "verified-capture", problems: [] },
    semanticIntake: { status: "observed", problems: [], limitations: [] },
  }));
  const record = (
    sourceStable = true,
    recordedAt = "2026-09-15T10:00:00.000Z",
  ) => ({
    recordedAt,
    sourceRevision: altitudeRevision,
    sourceStable,
    denominator: altitudeCohort.length,
    qualified: sourceStable ? 9 : 0,
    rows,
  });
  const persist = (
    name: string,
    final: unknown = record(),
    storedRows: unknown[] = rows,
  ) => {
    const out = path.join(root, name);
    mkdirSync(out, { recursive: true });
    for (const [index, { story }] of altitudeCohort.entries()) {
      const row = storedRows[index];
      mkdirSync(path.join(out, story));
      writeFileSync(
        path.join(out, story, "measurement.json"),
        JSON.stringify(row),
      );
      writeFileSync(path.join(out, story, "source.png"), imageBytes);
      writeFileSync(path.join(out, story, "replay.png"), imageBytes);
      writeFileSync(path.join(out, story, "source.har"), "private archive");
    }
    writeFileSync(path.join(out, "measurement.json"), JSON.stringify(final));
    return out;
  };
  const first = persist(id(1));
  persist(id(2), record(false, "2026-09-15T11:00:00.000Z"));
  const invalidIds = Array.from({ length: 18 }, (_, index) => id(index + 3));
  persist(id(3), { ...record(), rows: rows.slice(1) });
  persist(id(4), { ...record(), rows: rows.map(() => rows[0]) });
  persist(id(5), { ...record(), sourceRevision: "older-source" });
  persist(id(6), { ...record(), sourceStable: undefined });
  persist(id(7), { ...record(), recordedAt: "not-a-date" });
  persist(id(8), {
    ...record(),
    rows: [{ ...rows[0], story: "../outside" }, ...rows.slice(1)],
  });
  const malformed = persist(id(9));
  writeFileSync(path.join(malformed, "measurement.json"), "not json");
  const missingStory = persist(id(10));
  rmSync(path.join(missingStory, rows[0].story, "measurement.json"));
  const mismatched = persist(id(11));
  writeFileSync(
    path.join(mismatched, rows[0].story, "measurement.json"),
    JSON.stringify({ ...rows[0], qualified: false }),
  );
  const outside = persist("not-a-uuid");
  symlinkSync(outside, path.join(root, id(12)), "dir");
  const linkedMeasurement = persist(id(13));
  rmSync(path.join(linkedMeasurement, "measurement.json"));
  symlinkSync(
    path.join(outside, "measurement.json"),
    path.join(linkedMeasurement, "measurement.json"),
  );
  const invalidGreenRows = [
    rows.map(({ story }) => ({ story, qualified: true })),
    rows.map((row) => ({
      ...row,
      source: { ...row.source, status: "refused" },
    })),
    rows.map((row) => ({
      ...row,
      replay: { ...row.replay, sha256: "b".repeat(64) },
    })),
    rows.map((row) => ({
      ...row,
      source: { ...row.source, sha256: "not-a-hash" },
      replay: { ...row.replay, sha256: "not-a-hash" },
    })),
    rows.map((row) => ({ ...row, replay: undefined })),
  ];
  for (const [index, malformedRows] of invalidGreenRows.entries()) {
    persist(
      id(index + 14),
      {
        ...record(),
        qualified: malformedRows.filter((row) => row.qualified).length,
        rows: malformedRows,
      },
      malformedRows,
    );
  }
  const tamperedImage = persist(id(19));
  writeFileSync(
    path.join(tamperedImage, rows[0].story, "source.png"),
    "different image",
  );
  const missingImage = persist(id(20));
  rmSync(path.join(missingImage, rows[0].story, "replay.png"));
  // A refused row may have failed before screenshots existed. Its honest
  // failure remains recoverable; it cannot qualify the source as green.
  rmSync(path.join(first, rows[2].story, "source.png"));
  rmSync(path.join(first, rows[2].story, "replay.png"));
  const image = path.join(first, rows[0].story, "source.png");
  const before = readFileSync(path.join(first, "measurement.json"), "utf8");
  let launches = 0;
  const service = createReferenceService(dir, () => {
    launches++;
    throw new Error("Recovery must never launch capture");
  });
  const server = createServer((req, res) => {
    void service.handle(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/source-reference`;
  try {
    const latest = (await (await fetch(base)).json()).latest;
    assert.equal(latest.id, id(2));
    assert.equal(latest.state, "complete");
    assert.equal(latest.recovered, true);
    assert.equal(latest.completedAt, "2026-09-15T11:00:00.000Z");
    assert.equal(
      Object.hasOwn(latest, "origin"),
      false,
      "never invent the missing source origin",
    );
    assert.equal(
      Object.hasOwn(latest, "startedAt"),
      false,
      "completion is not a fabricated start time",
    );
    assert.equal(latest.qualified, 0);
    assert.ok(
      latest.rows.every(
        (row: {
          semanticIntake: { status: string };
          compilerInput: { status: string };
        }) =>
          row.semanticIntake.status === "source-invalid" &&
          row.compilerInput.status === "source-invalid",
      ),
    );
    const restored = await (await fetch(`${base}/${id(1)}`)).json();
    assert.equal(restored.qualified, 9);
    assert.equal(restored.rows[0].semanticIntake.status, "observed");
    assert.equal(
      await (
        await fetch(`${base}/${id(1)}/${rows[0].story}/source.png`)
      ).text(),
      imageBytes,
    );
    assert.equal(
      await (
        await fetch(`${base}/${id(1)}/${rows[0].story}/replay.png`)
      ).text(),
      imageBytes,
    );
    for (const invalid of [...invalidIds, "not-a-uuid", "%2e%2e%2fnot-a-uuid"])
      assert.equal((await fetch(`${base}/${invalid}`)).status, 404, invalid);
    for (const asset of [
      "source.har",
      "measurement.json",
      "%2e%2e%2fmeasurement.json",
    ])
      assert.equal(
        (await fetch(`${base}/${id(1)}/${rows[0].story}/${asset}`)).status,
        404,
        asset,
      );
    const pinnedImage = `${base}/${id(1)}/${rows[0].story}/source.png?sha256=${createHash("sha256").update(imageBytes).digest("hex")}`;
    assert.equal((await fetch(pinnedImage)).status, 200);
    assert.equal(
      (
        await fetch(
          `${base}/${id(1)}/${rows[0].story}/source.png?sha256=${"0".repeat(64)}`,
        )
      ).status,
      404,
    );
    rmSync(image);
    symlinkSync(path.join(outside, "measurement.json"), image);
    assert.equal(
      (await fetch(`${base}/${id(1)}/${rows[0].story}/source.png`)).status,
      404,
      "image symlinks cannot expose arbitrary files",
    );
    assert.equal(launches, 0);
    assert.equal(
      readFileSync(path.join(first, "measurement.json"), "utf8"),
      before,
      "recovery does not rewrite historical evidence",
    );
  } finally {
    service.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("only credential-free local origins are accepted", () => {
  // Deliberately fake userinfo, assembled as a URL object so history scanners
  // do not mistake a literal credential-bearing URI for an exposed secret.
  const credentialed = new URL("http://127.0.0.1");
  credentialed.username = "fixture-user";
  credentialed.password = "fixture-password";
  for (const value of [
    "https://localhost:6017",
    credentialed.href,
    "http://127.0.0.1/path",
    "http://127.0.0.1?token=x",
    "file:///etc/passwd",
    "http://example.com",
    null,
  ])
    assert.throws(() => loopbackOrigin(value));
  assert.equal(
    loopbackOrigin("http://localhost:6017/"),
    "http://localhost:6017",
  );
});
