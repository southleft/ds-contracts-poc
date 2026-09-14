import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { scoreFidelity } from "./fidelity-score.js";
import type { Subject } from "./fidelity-check.js";

test("committed before/after checkbox exports reproduce the empty-host defect and its fix", () => {
  const manifest = JSON.parse(readFileSync("recipe/fidelity-manifest.json", "utf8")) as { subjects: Subject[] };
  const rows = manifest.subjects.filter(s => s.label.startsWith("checkbox/radix-themes-"));
  assert.equal(rows.length, 6);
  for (const s of rows) {
    assert.equal(s.heldOut, "radix-themes");
    const before = s.shot.replace("-glyph-host.png", ".png");
    assert.notEqual(before, s.shot);
    const old = scoreFidelity(before, s.reference, s.label, path.join(os.tmpdir(), "f1-checkbox-before.diff.png"), true);
    const current = scoreFidelity(s.shot, s.reference, s.label, path.join(os.tmpdir(), "f1-checkbox-after.diff.png"), true);
    assert.equal(old.status, s.label.includes("-indeterminate-") ? "fail" : "pass", `${s.label}: original measurement`);
    assert.equal(current.status, "pass", `${s.label}: corrected measurement`);
    if (!s.label.includes("-indeterminate-")) assert.deepEqual(readFileSync(before), readFileSync(s.shot), `${s.label}: non-dash pixels must not change`);
  }
});
