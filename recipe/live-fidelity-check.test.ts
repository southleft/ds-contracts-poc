import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { scoreFidelity } from "./fidelity-score.js";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const evidence = "recipe/evidence/live-fidelity-2026-09-14";
const receipt = JSON.parse(
  readFileSync(path.join(root, evidence, "manifest.json"), "utf8"),
);
const canonical = JSON.parse(
  readFileSync(path.join(root, "recipe/fidelity-manifest.json"), "utf8"),
).subjects.filter(
  (s: { label: string; heldOut?: string }) => s.heldOut === "radix-themes",
);
const calendar = JSON.parse(
  readFileSync(
    path.join(root, "recipe/evidence/f1-held-out-v1/score/scorecard.json"),
    "utf8",
  ),
);
// This file verifies the dated morning event, not today's canonical mint.
// The successor gate verifies the current writer/canvas and the exact link back
// to this archived event. Never overwrite old screenshots to make history green.
const calendarSuccessor = JSON.parse(readFileSync(path.join(root,
  "recipe/evidence/f1-calendar-typography-v1/receipt.json"), "utf8"));
canonical.push({
  label: "calendar/day-picker",
  page: calendarSuccessor.previous.figma.pageId,
  shot: calendarSuccessor.previous.canvas,
  committedShot: calendar.canvas.path,
  reference: calendar.reference.path,
});
const hash = (p: string) =>
  createHash("sha256")
    .update(readFileSync(path.join(root, p)))
    .digest("hex");

function verify(record: typeof receipt) {
  assert.deepEqual(
    record.rows.map((r: { label: string }) => r.label).sort(),
    canonical.map((s: { label: string }) => s.label).sort(),
    "held-out coverage",
  );
  const temp = mkdtempSync(path.join(os.tmpdir(), "ds-live-fidelity-"));
  try {
    return record.rows.map((row: (typeof receipt.rows)[number], i: number) => {
      const source = canonical.find(
        (s: { label: string }) => s.label === row.label,
      )!;
      assert.equal(row.figma.fileKey, "byMp6lt0Ij9b2QbkDGFwBh", "Scratch only");
      assert.equal(row.figma.pageId, source.page);
      assert.deepEqual(row.committed, {
        canvas: source.committedShot ?? source.shot,
        reference: source.reference,
      });
      assert.equal(
        row.referenceControlOnly,
        source.referenceControlOnly === true,
      );
      for (const key of ["canvas", "reference", "repeat"]) {
        assert.ok(row.images[key].startsWith(evidence + "/"));
        assert.equal(hash(row.images[key]), row.hashes[key], "image hash");
      }
      assert.equal(
        row.hashes.reference,
        row.hashes.repeat,
        "independent source renders must agree",
      );
      assert.equal(
        row.expected.canvasMatchesCommitted,
        hash(source.shot) === row.hashes.canvas,
      );
      assert.equal(
        row.expected.sourceMatchesCommitted,
        hash(source.reference) === row.hashes.reference,
      );
      const card = scoreFidelity(
        path.join(root, row.images.canvas),
        path.join(root, row.images.reference),
        row.label,
        path.join(temp, `${i}.diff.png`),
        row.referenceControlOnly,
        false,
        null,
        { glyphRects: row.glyphRects },
      );
      assert.equal(card.status, row.expected.status, "status");
      assert.deepEqual(card.metrics, row.expected.metrics, "metrics");
      assert.deepEqual(
        card.thresholdSweep,
        row.expected.thresholdSweep,
        "ink geometry",
      );
      assert.deepEqual(
        card.glyphMasked,
        row.expected.glyphMasked,
        "glyph measurement",
      );
      return {
        label: row.label,
        status: card.status,
        pct: card.metrics.pctAAMasked,
      };
    });
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

test("fresh held-out screenshots reproduce every published measurement offline", () => {
  const scores = verify(receipt);
  console.log(
    JSON.stringify({
      measured: scores.length,
      passed: scores.filter((s: { status: string }) => s.status === "pass")
        .length,
      scores,
    }),
  );
});
test("planted metric, image hash, and missing-state edits fail closed", () => {
  const metric = structuredClone(receipt);
  metric.rows[0].expected.metrics.pctAAMasked += 1;
  assert.throws(() => verify(metric), /metrics/);
  const bytes = structuredClone(receipt);
  bytes.rows[0].hashes.canvas = "tampered";
  assert.throws(() => verify(bytes), /image hash/);
  const missing = structuredClone(receipt);
  missing.rows.pop();
  assert.throws(() => verify(missing), /held-out coverage/);
});
