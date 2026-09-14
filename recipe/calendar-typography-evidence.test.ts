import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { scoreFidelity } from "./fidelity-score.js";
import { proposeCalendarInstanceFromLedger } from "./fixture-reader/propose-calendar-instance.js";
import { compileCalendarRecipe } from "./recipes/calendar.js";

const dir = "recipe/evidence/f1-calendar-typography-v1";
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const record = read(`${dir}/receipt.json`);
const hash = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
function verify(r: typeof record) {
  assert.match(r.sourceRevision, /^[0-9a-f]{40}$/);
  assert.equal(r.source.ledgerSha256, hash(r.source.ledger), "source ledger hash");
  assert.equal(r.writer.sha256, hash(r.writer.path), "current writer hash");
  const meta = read("recipe/evidence/f1-held-out-v1/writer.meta.json");
  assert.equal(r.writer.recipeHash, meta.recipeHash);
  assert.equal(r.writer.envelopeHash, meta.envelopeHash);
  assert.equal(r.mint.fileKey, "byMp6lt0Ij9b2QbkDGFwBh");
  assert.equal(r.figma.fileKey, r.mint.fileKey);
  assert.equal(r.figma.pageId, r.mint.pageId);
  assert.equal(r.figma.nodeId, r.mint.sources[0].calendarSetId);
  assert.equal(r.mint.pageName, meta.pageName);
  assert.equal(r.mint.sources[0].recipeHash, meta.recipeHash);
  assert.equal(r.mint.sources[0].envelopeHash, meta.envelopeHash);
  const proposal = proposeCalendarInstanceFromLedger();
  assert.ok(proposal.instanceParse.success);
  const envelope = compileCalendarRecipe(proposal.instance);
  assert.equal(envelope.integrity.canonicalHash, meta.envelopeHash);
  assert.ok(envelope.ir.kind === "frame");
  const selected = (envelope.ir.children.find((n: any) => n.role === "calendar/day-set") as any)
    .children.find((n: any) => n.variantProperties.State === "selected")
    .children[0].children.find((n: any) => n.role === "calendar/day/label");
  assert.equal(r.source.selected.text, proposal.content.selectedDayLabel);
  assert.equal(r.source.selected.fontSize, `${selected.type.fontSize}px`, "source size witness");
  assert.equal(r.source.selected.fontWeight, "700", "source weight witness");
  assert.equal(r.figma.selected.length, 1);
  assert.equal(r.figma.selected[0].fontSize, selected.type.fontSize, "Figma size witness");
  assert.deepEqual(r.figma.selected[0].fontName, { family: "Times New Roman", style: "Bold" }, "Figma face witness");
  for (const key of ["canvas", "reference", "repeat"]) {
    assert.ok(r.images[key].startsWith(dir + "/"));
    assert.equal(hash(r.images[key]), r.hashes[key], "image hash");
  }
  assert.equal(r.hashes.reference, r.hashes.repeat, "independent repeat");
  const current = read("recipe/evidence/f1-held-out-v1/score/scorecard.json");
  assert.equal(r.hashes.canvas, hash(current.canvas.path), "current canonical canvas");
  assert.equal(r.hashes.reference, hash(current.reference.path), "current canonical reference");
  const history = read(r.previous.manifest);
  const old = history.rows.find((row: any) => row.label === "calendar/day-picker");
  assert.equal(r.previous.sourceRevision, history.sourceRevision);
  assert.deepEqual(r.previous.figma, old.figma, "predecessor identity");
  assert.equal(r.previous.canvas, old.images.canvas);
  assert.equal(r.previous.canvasSha256, hash(old.images.canvas), "predecessor image");
  assert.notEqual(r.previous.canvasSha256, r.hashes.canvas);
  const temp = mkdtempSync(path.join(os.tmpdir(), "calendar-type-"));
  try {
    const score = scoreFidelity(r.images.canvas, r.images.reference, "calendar/day-picker", path.join(temp, "new.png"));
    const prior = scoreFidelity(old.images.canvas, old.images.reference, "calendar/day-picker", path.join(temp, "old.png"));
    assert.equal(score.status, "pass");
    assert.equal(score.status, r.expected.status);
    assert.deepEqual(score.metrics, r.expected.metrics, "measured metrics");
    assert.deepEqual(score.metrics, current.metrics, "canonical metrics");
    assert.deepEqual(score.thresholdSweep, r.expected.thresholdSweep, "ink bounds");
    assert.deepEqual(prior.metrics, r.previous.metrics, "predecessor metrics");
    return score;
  } finally { rmSync(temp, {recursive:true, force:true}); }
}

test("new calendar mint reproduces current measurements while preserving its historical predecessor", () => {
  console.log(JSON.stringify(verify(record).metrics));
});
test("planted state typography, source hash, pixels, predecessor, and metric edits refuse", () => {
  for (const [mutate, reason] of [
    [(r: any) => { r.figma.selected[0].fontSize = 16; }, /Figma size witness/],
    [(r: any) => { r.figma.selected[0].fontName.style = "Regular"; }, /Figma face witness/],
    [(r: any) => { r.source.ledgerSha256 = "tampered"; }, /source ledger hash/],
    [(r: any) => { r.hashes.canvas = "tampered"; }, /image hash/],
    [(r: any) => { r.previous.figma.pageId = r.figma.pageId; }, /predecessor identity/],
    [(r: any) => { r.expected.metrics.pctAAMasked += 1; }, /measured metrics/],
  ] as const) {
    const planted = structuredClone(record);
    mutate(planted);
    assert.throws(() => verify(planted), reason);
  }
});
