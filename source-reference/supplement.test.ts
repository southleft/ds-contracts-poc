import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createReferenceService } from "./service.js";
import {
  altitudeCohort,
  altitudeButtonVariants,
  altitudeRevision,
} from "./altitude-cohort.js";

test("supplement preserves the ten-state baseline, captures only three missing stories, and binds recovery to parent bytes", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "source-supplement-"));
  const root = path.join(dir, "private/source-reference-app");
  const parentId = "00000000-0000-4000-8000-000000000001";
  const png = Buffer.from(
    "synthetic source image bytes, not a visual qualification",
  );
  const sha = (b: Buffer | string) =>
    createHash("sha256").update(b).digest("hex");
  const sourceHashes = {
    "libs/al-web-components/custom-elements.json": "a".repeat(64),
  };
  const persist = (
    id: string,
    cohortId: "baseline" | "button-variants",
    parent?: { id: string; measurementSha256: string },
  ) => {
    const entries =
      cohortId === "baseline" ? altitudeCohort : altitudeButtonVariants;
    const rows = entries.map(({ story }, i) => ({
      story,
      qualified: cohortId !== "baseline" || i !== 2,
      source: {
        status: cohortId === "baseline" && i === 2 ? "invalid" : "valid",
        sha256: sha(png),
        problems: cohortId === "baseline" && i === 2 ? ["source-refused"] : [],
      },
      replay: { status: "valid", sha256: sha(png), problems: [] },
      compilerInput: { status: "verified-capture", problems: [] },
      semanticIntake: { status: "observed", problems: [], limitations: [] },
    }));
    const out = path.join(root, id);
    mkdirSync(out, { recursive: true });
    for (const row of rows) {
      const storyDir = path.join(out, row.story);
      mkdirSync(storyDir, { recursive: true });
      writeFileSync(
        path.join(storyDir, "measurement.json"),
        JSON.stringify(row),
      );
      for (const asset of ["source.png", "replay.png"])
        writeFileSync(path.join(storyDir, asset), png);
    }
    writeFileSync(
      path.join(out, "measurement.json"),
      JSON.stringify({
        cohortId,
        ...(parent ? { parent } : {}),
        sourceRevision: altitudeRevision,
        sourceStable: true,
        sourceHashes,
        recordedAt: "2026-09-15T15:00:00.000Z",
        denominator: entries.length,
        qualified: rows.filter((r) => r.qualified).length,
        rows,
      }),
    );
    return out;
  };
  const parentDir = persist(parentId, "baseline");
  const parentBytes = readFileSync(path.join(parentDir, "measurement.json"));
  let calls = 0;
  let args: string[] = [];
  let done: (e: unknown) => void = () => {};
  let service = createReferenceService(dir, (argv, cb) => {
    calls++;
    args = argv;
    done = cb;
    return { kill: () => true };
  });
  const server = createServer((req, res) => {
    void service.handle(req, res);
  });
  const source = createServer((_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        entries: Object.fromEntries(
          [...altitudeCohort, ...altitudeButtonVariants].map((e) => [
            e.story,
            {},
          ]),
        ),
      }),
    );
  });
  await Promise.all([
    new Promise<void>((r) => server.listen(0, "127.0.0.1", r)),
    new Promise<void>((r) => source.listen(0, "127.0.0.1", r)),
  ]);
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/source-reference`;
  const origin = `http://127.0.0.1:${(source.address() as { port: number }).port}`;
  const post = (id = parentId, retry = false) =>
    fetch(`${base}/${id}/button-variants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin, retry }),
    });
  try {
    assert.equal(
      (await post("00000000-0000-4000-8000-000000000999")).status,
      409,
    );
    const baseline = await (await fetch(base)).json();
    assert.equal(baseline.latest.denominator, 10);
    assert.equal(baseline.latest.qualified, 9);
    assert.deepEqual(baseline.latest.supplements, []);
    const response = await post();
    assert.equal(response.status, 202);
    const started = await response.json();
    const child = started.supplements[0];
    assert.equal(child.state, "running");
    assert.equal(child.denominator, 3);
    assert.deepEqual(
      child.rows.map((r: { story: string }) => r.story),
      ["atoms-button--tertiary", "atoms-button--bare", "atoms-button--danger"],
    );
    assert.equal(started.denominator, 10);
    assert.equal(started.qualified, 9);
    assert.equal(args[6], "button-variants");
    assert.equal(args[7], parentId);
    assert.equal(args[8], sha(parentBytes));
    assert.equal((await post()).status, 200);
    assert.equal(calls, 1, "duplicate capture must not relaunch");
    assert.equal(
      (await post(child.id)).status,
      409,
      "no chain of supplemental baselines",
    );
    persist(child.id, "button-variants", {
      id: parentId,
      measurementSha256: sha(parentBytes),
    });
    done(null);
    const finished = await (await fetch(`${base}/${parentId}`)).json();
    assert.equal(finished.supplements[0].state, "complete");
    assert.equal(finished.supplements[0].qualified, 3);
    assert.equal(finished.denominator, 10);
    assert.equal(finished.rows[2].status, "invalid");
    assert.deepEqual(
      readFileSync(path.join(parentDir, "measurement.json")),
      parentBytes,
    );
    assert.equal(
      (await fetch(`${base}/${child.id}/atoms-button--tertiary/source.png`))
        .status,
      200,
    );
    assert.equal(
      (await fetch(`${base}/${parentId}/atoms-button--tertiary/source.png`))
        .status,
      404,
    );
    const retryPngPath = path.join(
      root,
      child.id,
      "atoms-button--tertiary/source.png",
    );
    writeFileSync(retryPngPath, "unavailable source image");
    assert.equal((await post()).status, 200);
    assert.equal(calls, 1, "no implicit retry of a completed refusal");
    const retryResponse = await post(parentId, true);
    assert.equal(retryResponse.status, 202);
    const retryJob = await retryResponse.json();
    assert.equal(calls, 2);
    assert.equal(retryJob.supplements.length, 2);
    assert.notEqual(retryJob.supplements[1].id, child.id);
    assert.equal(
      retryJob.supplements[0].qualified,
      2,
      "previous failed attempt retained",
    );
    done(new Error("test interrupted before output"));
    writeFileSync(retryPngPath, png);
    service.close();
    service = createReferenceService(dir, () => {
      throw new Error("recovery must not capture");
    });
    const recovered = await (await fetch(base)).json();
    assert.equal(recovered.latest.id, parentId);
    assert.equal(recovered.latest.supplements[0].id, child.id);
    assert.equal(recovered.latest.supplements[0].recovered, true);
    const childPngPath = path.join(
      root,
      child.id,
      "atoms-button--tertiary/source.png",
    );
    writeFileSync(childPngPath, "changed image after recovery");
    const changedImage = await (await fetch(`${base}/${parentId}`)).json();
    assert.equal(changedImage.supplements[0].qualified, 2);
    assert.equal(
      changedImage.supplements[0].rows[0].semanticIntake.status,
      "source-invalid",
    );
    writeFileSync(childPngPath, png);
    const childRecordPath = path.join(root, child.id, "measurement.json");
    const childBytes = readFileSync(childRecordPath);
    const missingHashes = JSON.parse(childBytes.toString());
    delete missingHashes.sourceHashes;
    writeFileSync(childRecordPath, JSON.stringify(missingHashes));
    assert.equal(
      (await (await fetch(`${base}/${parentId}`)).json()).supplements[0]
        .qualified,
      0,
    );
    service.close();
    service = createReferenceService(dir, () => {
      throw new Error("recovery must not capture");
    });
    assert.deepEqual(
      (await (await fetch(base)).json()).latest.supplements,
      [],
      "child source hashes cannot be omitted to bypass parent binding",
    );
    writeFileSync(childRecordPath, childBytes);
    service.close();
    service = createReferenceService(dir, () => {
      throw new Error("recovery must not capture");
    });
    writeFileSync(
      path.join(parentDir, "measurement.json"),
      Buffer.concat([parentBytes, Buffer.from("\n")]),
    );
    const tampered = await (await fetch(`${base}/${parentId}`)).json();
    assert.equal(tampered.supplements[0].qualified, 0);
    assert.ok(
      tampered.supplements[0].rows.every(
        (r: { status: string }) => r.status === "invalid",
      ),
    );
    assert.ok(
      tampered.supplements[0].rows.every(
        (r: { semanticIntake: { status: string } }) =>
          r.semanticIntake.status === "source-invalid",
      ),
      "parent identity invalidates semantic admission as well as images",
    );
    service.close();
    service = createReferenceService(dir, () => {
      throw new Error("recovery must not capture");
    });
    assert.deepEqual((await (await fetch(base)).json()).latest.supplements, []);
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
