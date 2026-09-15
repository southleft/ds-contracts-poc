import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { createReferenceService } from "./service.js";
import { altitudeCohort, altitudeRevision } from "./altitude-cohort.js";

test("application admission rechecks real recorded artifacts and preserves component/state inventory when one row is corrupt", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "admission-service-"));
  const repo = path.join(dir, "repo");
  const id = "00000000-0000-4000-8000-000000000001";
  const output = path.join(repo, "private/source-reference-app", id);
  const fixture = JSON.parse(
    readFileSync(
      new URL("./fixtures/contract-plan-button-recorded.json", import.meta.url),
      "utf8",
    ),
  );
  const files = JSON.parse(
    gunzipSync(Buffer.from(fixture.payload, "base64")).toString(),
  );
  const bytes = (name: string) => {
    const file = files[name];
    const buffer =
      file.utf8 === undefined
        ? Buffer.from(file.base64, "base64")
        : Buffer.from(file.utf8);
    assert.equal(
      createHash("sha256").update(buffer).digest("hex"),
      file.sha256,
    );
    return buffer;
  };
  const manifestFile = path.join(dir, "altitude", fixture.manifestPath);
  mkdirSync(path.dirname(manifestFile), { recursive: true });
  writeFileSync(manifestFile, bytes("manifest.json"));
  const rows = altitudeCohort.map(({ story }) => {
    const storyDir = path.join(output, story);
    mkdirSync(storyDir, { recursive: true });
    if (fixture.selectedStories.includes(story)) {
      for (const asset of [
        "measurement.json",
        "source-semantics.json",
        "replay-semantics.json",
        "source-tree.json",
        "replay-tree.json",
        "source.png",
        "replay.png",
      ])
        writeFileSync(path.join(storyDir, asset), bytes(`${story}/${asset}`));
      return JSON.parse(bytes(`${story}/measurement.json`).toString());
    }
    const row = {
      story,
      qualified: false,
      error: "synthetic missing story in service fixture; not a live outcome",
    };
    writeFileSync(path.join(storyDir, "measurement.json"), JSON.stringify(row));
    return row;
  });
  writeFileSync(
    path.join(output, "measurement.json"),
    JSON.stringify({
      sourceRevision: altitudeRevision,
      sourceStable: true,
      sourceHashes: { [fixture.manifestPath]: fixture.manifestSha256 },
      recordedAt: "2026-09-15T15:00:00.000Z",
      denominator: 10,
      qualified: 2,
      rows,
    }),
  );
  const service = createReferenceService(repo, () => {
    throw new Error("Recorded admission must not recapture");
  });
  const server = createServer((req, res) => {
    void service.handle(req, res);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/source-reference`;
  const get = async () => (await (await fetch(url)).json()).latest;
  try {
    let job = await get();
    assert.equal(job.contractAdmission.plans.length, 3);
    const variant = (job: any) =>
      job.contractAdmission.plans
        .find((p: any) => p.component.tagName === "al-button")
        .enumDomains.find((d: any) => d.property === "variant");
    assert.equal(variant(job).observed, 2);
    assert.equal(variant(job).total, 5);
    const target = path.join(output, "atoms-button--default/measurement.json");
    const original = readFileSync(target);
    writeFileSync(target, "{ corrupt JSON");
    job = await get();
    assert.equal(
      job.contractAdmission.plans.length,
      3,
      "a corrupt story must not erase other component plans",
    );
    assert.equal(variant(job).observed, 1);
    assert.equal(variant(job).total, 5);
    assert.ok(
      job.contractAdmission.plans[0].evidence.rejectedStories.includes(
        "atoms-button--default",
      ),
    );
    assert.equal(job.rows[0].status, "invalid");
    writeFileSync(target, original);
    assert.equal(variant(await get()).observed, 2);
    writeFileSync(manifestFile, "{}");
    job = await get();
    assert.equal(job.contractAdmission.plans.length, 0);
    assert.ok(
      job.contractAdmission.problems.length > 0,
      "a different manifest cannot authorize the recorded component facts",
    );
  } finally {
    service.close();
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    rmSync(dir, { recursive: true, force: true });
  }
});
