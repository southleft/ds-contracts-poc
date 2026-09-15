import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createReferenceService, loopbackOrigin } from "./service.js";
import { altitudeCohort } from "./altitude-cohort.js";

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
    for (const [i, { story }] of altitudeCohort.entries()) {
      mkdirSync(path.join(out, story));
      writeFileSync(
        path.join(out, story, "measurement.json"),
        JSON.stringify({
          qualified: i !== 2,
          compilerInput: { status: "verified-capture", problems: [] },
          source: { problems: i === 2 ? ["native-disabled-missing"] : [] },
          replay: { problems: [] },
        }),
      );
      writeFileSync(path.join(out, story, "source.png"), "png");
      writeFileSync(path.join(out, story, "source.har"), "DO NOT EXPOSE");
    }
    const provisional = await (await fetch(`${base}/${job.id}`)).json();
    assert.equal(provisional.qualified, 0, "must await final source integrity");
    assert.equal(
      provisional.rows[0].compilerInput.status,
      "awaiting-source-integrity",
    );
    writeFileSync(
      path.join(out, "measurement.json"),
      JSON.stringify({ sourceStable: true, rows: altitudeCohort }),
    );
    done(new Error("Exit 1: expected refusals"));
    const final = await (await fetch(`${base}/${job.id}`)).json();
    assert.equal(final.state, "complete");
    assert.equal(final.qualified, 9);
    assert.equal(final.rows[0].compilerInput.status, "verified-capture");
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
      JSON.stringify({ sourceStable: false, rows: altitudeCohort }),
    );
    const changed = await (await fetch(`${base}/${job.id}`)).json();
    assert.equal(changed.qualified, 0);
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
