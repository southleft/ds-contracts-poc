/**
 * The react:native:fidelity:check gate must go red BY NAME on every planted
 * edit, and must be deterministic. Every tamper runs on a temp COPY; the
 * committed evidence is never mutated.
 */
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { PNG } from "pngjs";

import {
  EVIDENCE,
  REPO,
  assertScorerPins,
  framingCrop,
  placeByLayoutOrigin,
  sha256,
  verdictFor,
  verifyEvidence,
  type KnownFile,
  type Manifest,
  type Pair,
  type Row,
  type Scorecard,
} from "./react-native-fidelity-check.js";

const committed = path.join(REPO, EVIDENCE);
const TEXT_ONLY = "button-initial/disabled=false, variant=ghost";
const TRIM = "button-initial/disabled=true, variant=secondary";
const PASSING = "button-initial/disabled=false, variant=default";

function withCopy<T>(run: (dir: string) => T): T {
  const dir = mkdtempSync(path.join(os.tmpdir(), "react-native-fidelity-test-"));
  try {
    cpSync(committed, dir, { recursive: true });
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const edit = <T>(dir: string, file: string, change: (value: T) => void): void => {
  const target = path.join(dir, file), value = JSON.parse(readFileSync(target, "utf8")) as T;
  change(value);
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
};
const pairOf = (manifest: Manifest, id: string): Pair => manifest.cohorts.flatMap((c) => c.pairs).find((p) => p.id === id)!;

test("the committed evidence verifies, and nothing in it is a grade", () => {
  const { manifest, known, scorecard } = verifyEvidence(committed);
  assert.equal(manifest.qualification, "measured-not-graded");
  assert.equal(manifest.acceptedContract, null);
  assert.equal(scorecard.qualification, "measured-not-graded");
  assert.equal(scorecard.acceptedContract, null);
  assert.equal(known.qualification, "measured-not-graded");
  assert.equal(scorecard.rows.filter((r) => r.verdict === "fail").length, 0);
  // every non-pass is named, and every named row still prints its historical failure
  for (const row of scorecard.rows.filter((r) => r.verdict !== "pass")) {
    assert.ok(known.failures[row.id], row.id);
    assert.ok(row.historical.pct > 5, row.id);
  }
  const trim = scorecard.rows.find((r) => r.id === TRIM)!;
  assert.equal(trim.verdict, "named-other");
  assert.equal(trim.class, "alignment-trim-threshold");
  assert.ok(Math.abs(trim.historical.pct - 6.166) < 0.001, "the historical 6.166 % stays in the record");
});

test("a changed PNG byte is red by name", () =>
  withCopy((dir) => {
    const file = path.join(dir, "button-initial/0.native.png"), bytes = readFileSync(file);
    bytes[bytes.length - 20] ^= 1;
    writeFileSync(file, bytes);
    assert.throws(() => verifyEvidence(dir), /evidence-hash-mismatch: .*button-initial\/0\.native\.png/);
  }));

test("a changed manifest hash is red by name", () =>
  withCopy((dir) => {
    edit<Manifest>(dir, "manifest.json", (m) => { m.cohorts[0]!.pairs[0]!.files.source.sha256 = "0".repeat(64); });
    assert.throws(() => verifyEvidence(dir), /evidence-hash-mismatch: .*source/);
  }));

test("a re-encoded image with a matching new hash still fails: the numbers are recomputed from bytes", () =>
  withCopy((dir) => {
    const manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8")) as Manifest, pair = pairOf(manifest, PASSING);
    const file = path.join(dir, pair.files.native.path), png = PNG.sync.read(readFileSync(file));
    for (let y = 2; y < 5; y++) for (let x = 2; x < 5; x++) png.data[(y * png.width + x) * 4] = 255; // nine red pixels: too few to fail the bar, enough to move the numbers
    const bytes = PNG.sync.write(png);
    writeFileSync(file, bytes);
    edit<Manifest>(dir, "manifest.json", (m) => { pairOf(m, PASSING).files.native.sha256 = sha256(bytes); });
    assert.throws(() => verifyEvidence(dir), /scorecard-mismatch: .*variant=default/);
  }));

test("a changed scorecard number is red by name", () =>
  withCopy((dir) => {
    edit<Scorecard>(dir, "SCORECARD.json", (s) => { s.rows.find((r) => r.id === TRIM)!.historical.pct = 4.9; });
    assert.throws(() => verifyEvidence(dir), /scorecard-mismatch: .*variant=secondary field "historical"/);
  }));
for (const field of ["aligned", "glyphMasked"] as const)
  test(`a changed ${field} number is red by name`, () =>
    withCopy((dir) => {
      edit<Scorecard>(dir, "SCORECARD.json", (s) => { (s.rows.find((r) => r.id === PASSING)![field] as { pct: number }).pct = 0.001; });
      assert.throws(() => verifyEvidence(dir), new RegExp(`scorecard-mismatch: .*field "${field}"`));
    }));

test("a moved text rect is red by name", () =>
  withCopy((dir) => {
    // the mask no longer covers the label, so the glyph-masked number changes
    edit<Manifest>(dir, "manifest.json", (m) => { pairOf(m, PASSING).native.textRects[0]!.y += 40; });
    assert.throws(() => verifyEvidence(dir), /scorecard-mismatch: .*variant=default field "(aligned|glyphMasked)"/);
  }));

test("a shrunk text rect un-proves a named text-only row", () =>
  withCopy((dir) => {
    edit<Manifest>(dir, "manifest.json", (m) => { Object.assign(pairOf(m, TEXT_ONLY).native.textRects[0]!, { width: 4, height: 4 }); });
    assert.throws(() => verifyEvidence(dir), /ratchet-red:[\s\S]*named-row-fails-the-rule: .*variant=ghost[\s\S]*glyph-masked pass is not green/);
  }));

test("a changed layout origin is red by name, on either side", () => {
  withCopy((dir) => {
    edit<Manifest>(dir, "manifest.json", (m) => { pairOf(m, PASSING).native.layoutOffset.x += 1; });
    assert.throws(() => verifyEvidence(dir), /layout-origin-mismatch/);
  });
  withCopy((dir) => {
    // a self-consistent but different origin moves the placement, so the aligned number no longer reproduces
    edit<Manifest>(dir, "manifest.json", (m) => { const p = pairOf(m, PASSING); p.native.exportBounds.render.x -= 3; p.native.layoutOffset.x += 3; });
    assert.throws(() => verifyEvidence(dir), /scorecard-mismatch: .*variant=default field "aligned"/);
  });
  withCopy((dir) => {
    edit<Manifest>(dir, "manifest.json", (m) => { pairOf(m, PASSING).native.exportBounds.render.width += 4; });
    assert.throws(() => verifyEvidence(dir), /scale-mismatch: native export/);
  });
  withCopy((dir) => {
    edit<Manifest>(dir, "manifest.json", (m) => { pairOf(m, PASSING).source.bounds.x += 1; });
    assert.throws(() => verifyEvidence(dir), /scorecard-mismatch: .*field "aligned"/);
  });
  withCopy((dir) => {
    edit<Manifest>(dir, "manifest.json", (m) => { pairOf(m, PASSING).source.bounds.x += 40; });
    assert.throws(() => verifyEvidence(dir), /source-crop-mismatch/);
  });
  // a named row whose origin can no longer be trusted loses its verdict, not just its number
  withCopy((dir) => {
    edit<Manifest>(dir, "manifest.json", (m) => { pairOf(m, TEXT_ONLY).native.layoutOffset.y += 1; });
    assert.throws(() => verifyEvidence(dir), /ratchet-red:[\s\S]*variant=ghost[\s\S]*layout-aligned score refused: layout-origin-mismatch/);
  });
});

test("the ratchet only tightens", () => {
  withCopy((dir) => {
    edit<KnownFile>(dir, "KNOWN-FAILURES.json", (k) => { k.failures[PASSING] = { class: "font-substrate", cause: "planted" }; });
    assert.throws(() => verifyEvidence(dir), /stale-ratchet: .*variant=default, which no longer fails/);
  });
  withCopy((dir) => {
    edit<KnownFile>(dir, "KNOWN-FAILURES.json", (k) => { delete k.failures[TEXT_ONLY]; });
    assert.throws(() => verifyEvidence(dir), /unnamed-failure: .*variant=ghost fails \(9\.195%\)/);
  });
  withCopy((dir) => {
    edit<KnownFile>(dir, "KNOWN-FAILURES.json", (k) => { k.failures["button-initial/no-such-variant"] = { class: "font-substrate", cause: "planted" }; });
    assert.throws(() => verifyEvidence(dir), /stale-ratchet: .*no-such-variant, which the manifest does not measure/);
  });
});

test("the trim-threshold row cannot be relabelled to pass, and no generic class exists", () => {
  withCopy((dir) => {
    edit<KnownFile>(dir, "KNOWN-FAILURES.json", (k) => { k.failures[TRIM]!.class = "font-substrate"; });
    assert.throws(() => verifyEvidence(dir), /named-row-fails-the-rule: .*variant=secondary \[font-substrate\][\s\S]*the residual is not the font/);
  });
  withCopy((dir) => {
    edit<KnownFile>(dir, "KNOWN-FAILURES.json", (k) => { k.failures[TEXT_ONLY]!.class = "real-defect"; });
    assert.throws(() => verifyEvidence(dir), /named-row-fails-the-rule: .*this lane admits only font-substrate, font-metrics and a proven alignment-trim-threshold/);
  });
  withCopy((dir) => {
    // a text-only row is not a trim artefact: both sides are white there
    edit<KnownFile>(dir, "KNOWN-FAILURES.json", (k) => { k.failures[TEXT_ONLY]!.class = "alignment-trim-threshold"; });
    assert.throws(() => verifyEvidence(dir), /named-row-fails-the-rule: .*variant=ghost \[alignment-trim-threshold\]/);
  });
});

test("the trim-threshold proof is checked term by term", () => {
  const { scorecard } = verifyEvidence(committed);
  const { verdict: _v, class: _c, reasons: _r, ...measured } = scorecard.rows.find((r) => r.id === TRIM)!;
  const known = { class: "alignment-trim-threshold", cause: "test" };
  assert.equal(verdictFor(measured, known).verdict, "named-other");
  const vary = (change: (m: Omit<Row, "verdict" | "class" | "reasons">) => void) => { const copy = structuredClone(measured); change(copy); return verdictFor(copy, known); };
  assert.match(vary((m) => { m.interior!.native = [249, 249, 249]; }).reasons.join(), /not >= the trim threshold/);
  assert.match(vary((m) => { m.interior!.native = [255, 255, 255]; m.interior!.maxChannelDelta = 6; }).reasons.join(), /pure white[\s\S]*8-bit steps/);
  assert.match(vary((m) => { m.interior!.source = [250, 250, 250]; }).reasons.join(), /both sides trim alike/);
  assert.match(vary((m) => { m.historical.nativePx = m.historical.sourcePx; }).reasons.join(), /did not diverge/);
  assert.match(vary((m) => { (m.aligned as { pct: number }).pct = 5.01; }).reasons.join(), /layout-aligned 5\.010% > 5%/);
  assert.match(vary((m) => { m.glyphMasked.pct = 5.01; }).reasons.join(), /glyph-masked pass is not green/);
  for (const change of [(m: typeof measured) => { m.glyphMasked.pct = 5.01; }, (m: typeof measured) => { (m.aligned as { pct: number }).pct = 5.01; }]) assert.equal(vary(change).verdict, "fail");
});

test("fractional translation and mismatched scale are refused by name, never resampled", () => {
  const blank = (width: number, height: number) => { const png = new PNG({ width, height }); png.data.fill(255); return png; };
  const make = (boundsX: number): Pair => {
    const bounds = { x: boundsX, y: 32, width: 100, height: 36 }, originalSize = { width: 900, height: 600 };
    return { id: "t", variant: "t", observation: "0", pairedBy: "test", files: { native: { path: "", sha256: "", width: 0, height: 0 }, source: { path: "", sha256: "", width: 0, height: 0 } }, native: { nodeId: "1:1", caseId: "t", exportBounds: { layout: { x: 40, y: 40, width: 100, height: 36 }, render: { x: 40, y: 40, width: 100, height: 36 } }, layoutOffset: { x: 0, y: 0 }, layoutSize: { width: 100, height: 36 }, textRects: [], typography: [] }, source: { originalSha256: "", originalSize, bounds, crop: framingCrop(bounds, originalSize), boundsRecord: "test", typography: [] } };
  };
  const whole = make(32), fractional = make(32.5);
  assert.ok(!("refused" in placeByLayoutOrigin(whole, blank(100, 36), blank(whole.source.crop.width, whole.source.crop.height))));
  const refusedFraction = placeByLayoutOrigin(fractional, blank(100, 36), blank(fractional.source.crop.width, fractional.source.crop.height));
  assert.ok("refused" in refusedFraction && /^fractional-translation: /.test(refusedFraction.refused), JSON.stringify(refusedFraction));
  const refusedScale = placeByLayoutOrigin(whole, blank(200, 72), blank(whole.source.crop.width, whole.source.crop.height));
  assert.ok("refused" in refusedScale && /^scale-mismatch: native export is 200x72/.test(refusedScale.refused));
  const retina = structuredClone(whole);
  retina.source.originalSize = { width: 1800, height: 1200 };
  retina.source.crop = framingCrop(retina.source.bounds, retina.source.originalSize);
  const refusedSource = placeByLayoutOrigin(retina, blank(100, 36), blank(retina.source.crop.width, retina.source.crop.height));
  assert.ok("refused" in refusedSource && /^scale-mismatch: source screenshot is 1800px wide/.test(refusedSource.refused));
  // and a refused alignment can never carry a named row
  const { scorecard } = verifyEvidence(committed);
  const { verdict: _v, class: _c, reasons: _r, ...measured } = scorecard.rows.find((r) => r.id === TEXT_ONLY)!;
  const refused = verdictFor({ ...measured, aligned: { pct: null, refused: (refusedFraction as { refused: string }).refused } }, { class: "font-substrate", cause: "test" });
  assert.equal(refused.verdict, "fail");
  assert.match(refused.reasons.join(), /layout-aligned score refused: fractional-translation/);
});

test("coverage, qualification, the report and the scorer pins are all held", () => {
  withCopy((dir) => {
    edit<Manifest>(dir, "manifest.json", (m) => { m.cohorts[0]!.pairs.pop(); });
    assert.throws(() => verifyEvidence(dir), /coverage-changed/);
  });
  withCopy((dir) => {
    edit<Manifest>(dir, "manifest.json", (m) => { const moved = m.cohorts[0]!.pairs.pop()!; m.cohorts[0]!.notMeasured.push({ variant: moved.variant, reason: "planted" }); });
    assert.throws(() => verifyEvidence(dir), /coverage-changed/);
  });
  withCopy((dir) => {
    edit<Manifest>(dir, "manifest.json", (m) => { (m as { qualification: string }).qualification = "release-grade"; });
    assert.throws(() => verifyEvidence(dir), /manifest-qualification-invalid/);
  });
  withCopy((dir) => {
    edit<KnownFile>(dir, "KNOWN-FAILURES.json", (k) => { (k as { qualification: string }).qualification = "accepted"; });
    assert.throws(() => verifyEvidence(dir), /ratchet-qualification-invalid/);
  });
  withCopy((dir) => {
    writeFileSync(path.join(dir, "REPORT.md"), readFileSync(path.join(dir, "REPORT.md"), "utf8").replace("9.195", "4.195"));
    assert.throws(() => verifyEvidence(dir), /report-stale/);
  });
  const fakeRepo = mkdtempSync(path.join(os.tmpdir(), "react-native-fidelity-pins-"));
  try {
    const scorer = "extract/figma/canvas-gate/score.ts";
    mkdirSync(path.dirname(path.join(fakeRepo, scorer)), { recursive: true });
    writeFileSync(path.join(fakeRepo, scorer), readFileSync(path.join(REPO, scorer), "utf8").replace("const WHITE_TRIM = 250;", "const WHITE_TRIM = 251;"));
    assert.throws(() => assertScorerPins(fakeRepo), /scorer-pin-moved: .*WHITE_TRIM = 250/);
    assert.doesNotThrow(() => assertScorerPins(REPO));
  } finally {
    rmSync(fakeRepo, { recursive: true, force: true });
  }
});

test("deterministic: two runs render byte-identical reports, equal to the committed one", () => {
  const first = verifyEvidence(committed), second = verifyEvidence(committed);
  assert.equal(first.report, second.report);
  assert.equal(JSON.stringify(first.scorecard), JSON.stringify(second.scorecard));
  assert.equal(first.report, readFileSync(path.join(committed, "REPORT.md"), "utf8"));
});

test("no committed evidence file carries a local path, a token or journal bytes", () => {
  for (const file of ["manifest.json", "SCORECARD.json", "KNOWN-FAILURES.json", "REPORT.md"])
    assert.doesNotMatch(readFileSync(path.join(committed, file), "utf8"), /\/Users\/|\/home\/|figd_|FIGMA_TOKEN|pngBase64/, file);
});
