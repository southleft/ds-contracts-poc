import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { EvidenceDrift, publishEvidence } from "./live-proof-evidence.js";

const owned = { artifactVersion: "x-v1-prepare", runIdentity: "abc-x-v1", writerSha256: "deadbeef" };

test("prepare writes files and a receipt with defaults; a second prepare preserves recorded mint fields", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "evidence-"));
  publishEvidence(dir, { "writer.js": "return 1;" }, owned, { check: false });
  const first = JSON.parse(readFileSync(path.join(dir, "receipt.json"), "utf8"));
  assert.equal(first.liveFigma, false);
  assert.equal(first.humanGrade, "queued-for-TJ");
  // a mint is recorded by hand / record-live-mint.mjs
  writeFileSync(path.join(dir, "receipt.json"), JSON.stringify({ ...first, liveFigma: true, pageId: "1:2", url: "u" }));
  publishEvidence(dir, { "writer.js": "return 1;" }, { ...owned, writerSha256: "cafe" }, { check: false });
  const second = JSON.parse(readFileSync(path.join(dir, "receipt.json"), "utf8"));
  assert.equal(second.liveFigma, true, "prepare never downgrades a recorded mint");
  assert.equal(second.pageId, "1:2");
  assert.equal(second.writerSha256, "cafe", "owned fields are rewritten");
});

test("--check compares and never writes: byte drift and owned-field drift are named; recorded fields are ignored", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "evidence-"));
  publishEvidence(dir, { "writer.js": "return 1;" }, owned, { check: false });
  writeFileSync(path.join(dir, "receipt.json"), JSON.stringify({ ...owned, liveFigma: true, pageId: "9:9" }));
  // recorded fields differ from defaults but are not owned → still ok
  assert.doesNotThrow(() => publishEvidence(dir, { "writer.js": "return 1;" }, owned, { check: true }));
  const before = readFileSync(path.join(dir, "writer.js"), "utf8");
  assert.throws(
    () => publishEvidence(dir, { "writer.js": "return 2;" }, owned, { check: true }),
    (e: Error) => e instanceof EvidenceDrift && /writer\.js: committed bytes differ/.test(e.message),
  );
  assert.throws(
    () => publishEvidence(dir, { "writer.js": "return 1;" }, { ...owned, writerSha256: "other" }, { check: true }),
    (e: Error) => e instanceof EvidenceDrift && /receipt\.json writerSha256/.test(e.message),
  );
  assert.equal(readFileSync(path.join(dir, "writer.js"), "utf8"), before, "a failing check wrote nothing");
});
