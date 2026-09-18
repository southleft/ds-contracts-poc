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
  EXPECTED_ROOT_GEOMETRY,
  REPO,
  ROOT_GEOMETRY_FACTS,
  ROOT_GEOMETRY_VERDICTS,
  assertNumericPolicyPin,
  assertScorerPins,
  framingCrop,
  placeByLayoutOrigin,
  sha256,
  verdictFor,
  verifyEvidence,
  type KnownFile,
  type Manifest,
  type Pair,
  type RootGeometryFacts,
  type RootGeometryVerdicts,
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

test("no committed evidence file carries a local path, a token, a file key or journal bytes", () => {
  for (const file of ["manifest.json", "SCORECARD.json", "KNOWN-FAILURES.json", "REPORT.md", ROOT_GEOMETRY_FACTS, ROOT_GEOMETRY_VERDICTS])
    assert.doesNotMatch(readFileSync(path.join(committed, file), "utf8"), /\/Users\/|\/home\/|figd_|FIGMA_TOKEN|pngBase64|fileKey|figma\.com/, file);
});

// ---------------------------------------------------------------------------
// ROOT GEOMETRY — every planted edit is red by name
// ---------------------------------------------------------------------------
const COHORT = "button-root-matrix";
const DECLARED = "size=default, variant=outline"; // height authored (fixed) on the source, FIXED + plan-declared on the canvas
const DERIVED = "size=null, variant=outline"; // height `auto` on the source, HUG on the canvas
const rowOf = (facts: RootGeometryFacts, variant: string) => facts.rows.find((r) => r.variant === variant)!;

/** Edit the facts, and (unless told not to) re-pin their hash — a tamperer who also fixes the manifest must still be caught. */
function geometryEdit(dir: string, change: (facts: RootGeometryFacts) => void, repin = true): void {
  const file = path.join(dir, ROOT_GEOMETRY_FACTS), facts = JSON.parse(readFileSync(file, "utf8")) as RootGeometryFacts;
  change(facts);
  const bytes = `${JSON.stringify(facts)}\n`;
  writeFileSync(file, bytes);
  if (repin) edit<Manifest>(dir, "manifest.json", (m) => { m.rootGeometry.facts.sha256 = sha256(bytes); });
}
const geometryRed = (pattern: RegExp, change: (facts: RootGeometryFacts) => void, repin = true): void =>
  withCopy((dir) => { geometryEdit(dir, change, repin); assert.throws(() => verifyEvidence(dir), pattern); });

test("root geometry: the committed table verifies, measures every fact of every main, and grades nothing", () => {
  const { geometry, known, manifest } = verifyEvidence(committed);
  const pins = EXPECTED_ROOT_GEOMETRY[COHORT]!;
  assert.equal(geometry.facts.qualification, "measured-not-graded");
  assert.equal(geometry.facts.acceptedContract, null);
  assert.equal(geometry.rows.length, pins.variants);
  assert.equal(geometry.facts.collapsed.length, pins.collapsed);
  assert.equal(geometry.rows.length + geometry.facts.collapsed.length, geometry.facts.provenance.source.matrixObservations);
  // the same 63 mains stay NOT-MEASURED for pixels
  assert.deepEqual(geometry.rows.map((r) => r.variant).sort(), manifest.cohorts.find((c) => c.id === COHORT)!.notMeasured.map((n) => n.variant).sort());
  assert.equal(manifest.cohorts.find((c) => c.id === COHORT)!.pairs.length, 0);
  for (const row of geometry.rows) assert.equal(row.verdicts.length, 19, row.variant);
  // every mismatch is named, and nothing else is
  const mismatches = geometry.rows.flatMap((r) => r.verdicts.filter((v) => v.verdict === "mismatch").map((v) => `${COHORT}/${r.variant}#${v.kind}`));
  assert.deepEqual(mismatches.sort(), Object.keys(known.rootGeometry ?? {}).sort());
  // THE KNOWN EXAMPLE: an unset size is 22 px tall in React (content-derived) and 3 px in Figma (empty hug) — not-comparable, both numbers printed, never a mismatch and never skipped
  const height = geometry.rows.find((r) => r.variant === DERIVED)!.verdicts.find((v) => v.kind === "height")!;
  assert.equal(height.verdict, "not-comparable:content-derived-height-empty-slot");
  assert.deepEqual([height.source, height.native], ["22", "3"]);
  assert.match(height.evidence!, /source height origin auto; native sizing HUG, plan declares no fixed size; native content empty-slot/);
  const declared = geometry.rows.find((r) => r.variant === DECLARED)!.verdicts.find((v) => v.kind === "height")!;
  assert.equal(declared.verdict, "match");
  assert.match(declared.evidence!, /source height origin fixed \(.* from \.h-9\); native sizing FIXED, plan fixedHeight 36/);
  const report = readFileSync(path.join(committed, "REPORT.md"), "utf8");
  assert.match(report, /## Root geometry \(no pixels\)/);
  assert.match(report, /This proves non-content box facts only — NOT the width of a content-sized box, NOT text, fonts, antialiasing or any pixel/);
  assert.match(report, /\| size=null, variant=outline \| 2 \| 95\.8125 ∥ 3 \| 22 ∥ 3 \|/);
});

test("root geometry: a changed facts byte, a missing pin and a lost qualification are red by name", () => {
  geometryRed(/root-geometry-facts-hash-mismatch: root-geometry\/facts\.json/, (f) => { rowOf(f, DECLARED).provenance.source.sha256 = "0".repeat(64); }, false);
  withCopy((dir) => { edit<Manifest>(dir, "manifest.json", (m) => { delete (m as Partial<Manifest>).rootGeometry; }); assert.throws(() => verifyEvidence(dir), /root-geometry-missing/); });
  withCopy((dir) => { rmSync(path.join(dir, ROOT_GEOMETRY_FACTS)); assert.throws(() => verifyEvidence(dir), /root-geometry-missing: root-geometry\/facts\.json/); });
  geometryRed(/root-geometry-qualification-invalid/, (f) => { (f as { qualification: string }).qualification = "accepted"; });
  geometryRed(/root-geometry-qualification-invalid/, (f) => { (f as { acceptedContract: unknown }).acceptedContract = "signed"; });
});

test("root geometry: a tampered SOURCE fact is red by name", () => {
  // a declared height moved by one pixel: a mismatch nobody named
  geometryRed(/root-geometry-ratchet-red:[\s\S]*unnamed-mismatch: button-root-matrix\/size=default, variant=outline#height — source 37, native 36/, (f) => { rowOf(f, DECLARED).source.height.px = 37; });
  geometryRed(/unnamed-mismatch: .*variant=outline#padding-left — source 12, native 10/, (f) => { rowOf(f, DECLARED).source.padding.left = 12; });
  geometryRed(/unnamed-mismatch: .*variant=outline#radius-top-right — source 6, native 8/, (f) => { rowOf(f, DECLARED).source.radius["top-right"] = 6; });
  // a colour whose bytes no longer follow from the raw value recorded beside them
  geometryRed(/root-geometry-fact-underived: size=default, variant=outline source background records \[255,255,254,255\], but its raw value "oklch\(1 0 0\)" lowers to \[255,255,255,255\]/, (f) => { (rowOf(f, DECLARED).source.background as { rgba8: number[] }).rgba8[2] = 254; });
  // ...and one tampered consistently (raw and bytes) still fails, as an unnamed mismatch
  geometryRed(/unnamed-mismatch: .*variant=outline#background — source #fafafaff, native #ffffffff/, (f) => { Object.assign(rowOf(f, DECLARED).source.background, { raw: "rgb(250, 250, 250)", rgba8: [250, 250, 250, 255] }); });
  // a fact edited into a not-comparable one moves a pinned count
  geometryRed(/root-geometry-coverage-changed: 1 opacity facts are not-comparable \{"source-not-a-number":1\}; the lane pins 0/, (f) => { rowOf(f, DECLARED).source.opacity = { unresolved: "not-a-number", raw: "inherit" }; });
});

test("root geometry: a tampered NATIVE fact is red by name", () => {
  geometryRed(/unnamed-mismatch: .*variant=outline#height — source 36, native 35/, (f) => { rowOf(f, DECLARED).native.height.px = 35; });
  geometryRed(/unnamed-mismatch: .*variant=outline#border-width-bottom — source 1, native 2/, (f) => { rowOf(f, DECLARED).native.borderWidth.bottom = 2; });
  geometryRed(/unnamed-mismatch: .*variant=outline#gap — source 6, native 8/, (f) => { rowOf(f, DECLARED).native.gap.px = 8; });
  geometryRed(/unnamed-mismatch: .*variant=outline#shadow/, (f) => { (rowOf(f, DECLARED).native.shadow as { layers: Array<{ blur: number }> }).layers[4]!.blur = 3; });
  geometryRed(/root-geometry-fact-underived: size=default, variant=outline native borderPaint records \[229,229,228,255\]/, (f) => { (rowOf(f, DECLARED).native.borderPaint as { rgba8: number[] }).rgba8[2] = 228; });
  geometryRed(/unnamed-mismatch: .*variant=outline#border-paint — source #e5e5e5ff, native #e5e5e4ff/, (f) => { const p = rowOf(f, DECLARED).native.borderPaint as { rgba8: number[]; raw: number[] }; p.rgba8[2] = 228; p.raw[2] = 228 / 255; });
  // an unresolved native paint is named, and moves the pinned count — it can never pass as a match
  geometryRed(/root-geometry-coverage-changed: 1 background facts are not-comparable \{"native-bound-variable-not-in-the-readback":1\}/, (f) => { rowOf(f, DECLARED).native.background = { kind: "unresolved", reason: "native-bound-variable-not-in-the-readback" }; });
});

test("root geometry: tampered PROVENANCE is red by name", () => {
  geometryRed(/root-geometry-provenance-mismatch: native\.journalEventSha256 is "0{64}", the manifest cohort records "81e24136/, (f) => { f.provenance.native.journalEventSha256 = "0".repeat(64); });
  geometryRed(/root-geometry-provenance-mismatch: native\.operationId/, (f) => { f.provenance.native.operationId = "00000000-0000-0000-0000-000000000000"; });
  geometryRed(/root-geometry-provenance-mismatch: source\.inventorySha256/, (f) => { f.provenance.source.inventorySha256 = "f".repeat(64); });
  geometryRed(/root-geometry-provenance-mismatch: cohort/, (f) => { f.cohort = "button-initial"; });
  geometryRed(/root-geometry-provenance-invalid: "not-a-hash" is not a sha256/, (f) => { rowOf(f, DECLARED).provenance.source.sha256 = "not-a-hash"; });
  geometryRed(/root-geometry-provenance-invalid: "\/tmp\/9\.json" is not an archive-relative path/, (f) => { rowOf(f, DECLARED).provenance.source.file = "/tmp/9.json"; });
  // one sealed observation cannot stand in for two variants
  geometryRed(/root-geometry-provenance-duplicated: two observations cite the same archive sha256/, (f) => { rowOf(f, DECLARED).provenance.source.sha256 = rowOf(f, DERIVED).provenance.source.sha256; });
  geometryRed(/root-geometry-provenance-duplicated: two variants cite the same native node/, (f) => { rowOf(f, DECLARED).provenance.native.nodeId = rowOf(f, DERIVED).provenance.native.nodeId; });
  // a well-formed but different hash changes no verdict — the derived verdict file still names the facts it was computed from
  geometryRed(/root-geometry-verdict-mismatch: root-geometry\/VERDICTS\.json differs from the recomputed verdicts outside its rows/, (f) => { rowOf(f, DECLARED).provenance.source.sha256 = "ab".repeat(32); });
});

test("root geometry: tampered JOIN evidence is red by name", () => {
  // the recorded property changes no longer spell the variant the facts were paired with
  geometryRed(/root-geometry-join-mismatch: root-geometry-(join-ambiguous|native-variant-without-source-row)/, (f) => { rowOf(f, DECLARED).join.changes.variant = { kind: "set", value: "ghost" }; });
  geometryRed(/root-geometry-join-mismatch: size=default, variant=outline: recorded row 10 \{"size":"default","variant":"ghost"\}, recomputed row 10 \{"size":"default","variant":"outline"\}/, (f) => { rowOf(f, DECLARED).join.assignment.variant = "ghost"; });
  geometryRed(/root-geometry-join-mismatch: root-geometry-native-variant-without-source-row/, (f) => { rowOf(f, DECLARED).join.nativeVariantProperties.variant = "no-such-value"; });
  // two rows swap their facts but keep their names: the name no longer spells the variant properties
  geometryRed(/root-geometry-join-mismatch: .*the variant's name does not spell its recorded variant properties/, (f) => { const a = rowOf(f, DECLARED), b = rowOf(f, DERIVED); [a.variant, b.variant] = [b.variant, a.variant]; });
  geometryRed(/root-geometry-join-mismatch: root-geometry-join-value-unmapped:size=default/, (f) => { f.axes[0]!.values = f.axes[0]!.values.filter((v) => v.value !== "default"); });
  // an omission is only a duplicate while it renders the default's tree, and only of the variant its default names
  geometryRed(/root-geometry-join-mismatch: root-geometry-collapse-unproven:row 79 does not render the tree of row 9/, (f) => { f.collapsed.find((c) => c.sourceRow === "79")!.treeSha256 = "c".repeat(64); });
  geometryRed(/root-geometry-join-mismatch: collapsed row 79: recorded onto size=default, variant=ghost/, (f) => { f.collapsed.find((c) => c.sourceRow === "79")!.collapsedOnto = "size=default, variant=ghost"; });
  geometryRed(/root-geometry-join-mismatch: root-geometry-join-omitted-without-default:variant/, (f) => { f.axes[1]!.default = null; });
  // no observation may disappear: 63 paired + 17 collapsed = the 80 the matrix planned
  geometryRed(/root-geometry-coverage-changed: 63 variants \+ 16 collapsed observations/, (f) => { f.collapsed.pop(); });
  geometryRed(/root-geometry-coverage-changed: 62 variants \+ 17 collapsed observations/, (f) => { f.rows.pop(); });
});

test("root geometry: the DIMENSION CLASSIFICATION cannot be flipped either way", () => {
  // content-derived -> declared, on one side: the 22 px / 3 px pair becomes a mismatch nobody named
  geometryRed(/unnamed-mismatch: .*size=null, variant=outline#height — source 22, native 3/, (f) => { rowOf(f, DERIVED).source.height.origin = "fixed"; });
  geometryRed(/unnamed-mismatch: .*size=null, variant=outline#height — source 22, native 3/, (f) => { Object.assign(rowOf(f, DERIVED).native.height, { sizing: "FIXED", planDeclared: { field: "fixedHeight", px: 3 } }); });
  // ...on both sides: still 22 against 3
  geometryRed(/unnamed-mismatch: .*size=null, variant=outline#height — source 22, native 3/, (f) => { const r = rowOf(f, DERIVED); r.source.height.origin = "fixed"; Object.assign(r.native.height, { sizing: "FIXED", planDeclared: { field: "fixedHeight", px: 3 } }); });
  // the canvas sizing and the plan must agree that a size is declared
  geometryRed(/root-geometry-verdict-mismatch: size=null, variant=outline height — committed "not-comparable:content-derived-height-empty-slot", recomputed "not-comparable:native-sizing-evidence-disagrees"/, (f) => { rowOf(f, DERIVED).native.height.sizing = "FIXED"; });
  // declared -> content-derived, on one side: a declaration the other side does not make is a mismatch
  geometryRed(/unnamed-mismatch: .*size=default, variant=outline#height — source 36, native 36/, (f) => { rowOf(f, DECLARED).source.height.origin = "auto"; });
  // ...on both sides it would quietly leave the comparison: the pinned not-comparable count refuses
  geometryRed(/root-geometry-coverage-changed: 8 height facts are not-comparable \{"content-derived-height-empty-slot":8\}; the lane pins 7/, (f) => { const r = rowOf(f, DECLARED); r.source.height.origin = "auto"; Object.assign(r.native.height, { sizing: "HUG", planDeclared: null }); });
  // the empty slot is evidence too: with content in it the reason changes, and so does the committed verdict
  geometryRed(/root-geometry-verdict-mismatch: size=null, variant=outline width — committed "not-comparable:content-derived-width-empty-slot", recomputed "not-comparable:content-derived-width"/, (f) => { rowOf(f, DERIVED).native.content = "has-content"; });
});

test("root geometry: the ratchet is a closed class set and only tightens", () => {
  const id = `${COHORT}/${DECLARED}#height`;
  // a named row that matches
  withCopy((dir) => {
    edit<KnownFile>(dir, "KNOWN-FAILURES.json", (k) => { k.rootGeometry![id] = { class: "declared-dimension-differs", cause: "planted" }; });
    assert.throws(() => verifyEvidence(dir), /root-geometry-ratchet-red:[\s\S]*stale-ratchet: .*variant=outline#height, which no longer mismatches \(match\)/);
  });
  // a not-comparable fact can never be parked in the ratchet
  withCopy((dir) => {
    edit<KnownFile>(dir, "KNOWN-FAILURES.json", (k) => { k.rootGeometry![`${COHORT}/${DERIVED}#height`] = { class: "declared-dimension-differs", cause: "planted" }; });
    assert.throws(() => verifyEvidence(dir), /stale-ratchet: .*size=null, variant=outline#height, which no longer mismatches \(not-comparable:content-derived-height-empty-slot\)/);
  });
  withCopy((dir) => {
    edit<KnownFile>(dir, "KNOWN-FAILURES.json", (k) => { k.rootGeometry![`${COHORT}/no-such-variant#height`] = { class: "declared-dimension-differs", cause: "planted" }; });
    assert.throws(() => verifyEvidence(dir), /stale-ratchet: .*no-such-variant#height, which the table does not measure/);
  });
  // a real mismatch: named with a fitting class it is carried (and printed); un-named, mis-classed or unknown-classed it is red
  const mismatch = (known: (k: KnownFile) => void) => (dir: string) => {
    geometryEdit(dir, (f) => { rowOf(f, DECLARED).native.height.px = 35; });
    edit<KnownFile>(dir, "KNOWN-FAILURES.json", known);
  };
  withCopy((dir) => {
    mismatch((k) => { k.rootGeometry![id] = { class: "declared-dimension-differs", cause: "planted: the canvas is one pixel short" }; })(dir);
    // the ratchet accepts it; the committed verdict and report are now stale, by name — naming never hides the number
    assert.throws(() => verifyEvidence(dir), /root-geometry-verdict-mismatch: size=default, variant=outline height — committed "match", recomputed "mismatch"/);
  });
  withCopy((dir) => {
    mismatch(() => {})(dir);
    assert.throws(() => verifyEvidence(dir), /unnamed-mismatch: .*variant=outline#height — source 36, native 35/);
  });
  withCopy((dir) => {
    mismatch((k) => { k.rootGeometry![id] = { class: "rounding", cause: "planted" }; })(dir);
    assert.throws(() => verifyEvidence(dir), /unknown-class: .*variant=outline#height is named with class "rounding"; the closed set is declared-dimension-differs, padding-differs, border-width-differs, radius-differs, paint-differs, opacity-differs, gap-differs, shadow-differs/);
  });
  withCopy((dir) => {
    mismatch((k) => { k.rootGeometry![id] = { class: "paint-differs", cause: "planted" }; })(dir);
    assert.throws(() => verifyEvidence(dir), /class-does-not-fit: .*variant=outline#height is a height fact; class "paint-differs" does not name that kind/);
  });
  withCopy((dir) => {
    mismatch((k) => { k.rootGeometry![id] = { class: "declared-dimension-differs", cause: "" }; })(dir);
    assert.throws(() => verifyEvidence(dir), /named-without-cause: .*variant=outline#height/);
  });
});

test("root geometry: the derived verdicts, the report and the numeric-policy pin are held", () => {
  withCopy((dir) => {
    const file = path.join(dir, ROOT_GEOMETRY_VERDICTS), verdicts = JSON.parse(readFileSync(file, "utf8")) as RootGeometryVerdicts;
    verdicts.rows.find((r) => r.variant === DERIVED)!.verdicts.height = "match";
    writeFileSync(file, JSON.stringify(verdicts));
    assert.throws(() => verifyEvidence(dir), /root-geometry-verdict-mismatch: size=null, variant=outline height — committed "match", recomputed "not-comparable:content-derived-height-empty-slot"/);
  });
  withCopy((dir) => {
    const file = path.join(dir, ROOT_GEOMETRY_VERDICTS), verdicts = JSON.parse(readFileSync(file, "utf8")) as RootGeometryVerdicts;
    verdicts.totals.height!.match += 7;
    writeFileSync(file, JSON.stringify(verdicts));
    assert.throws(() => verifyEvidence(dir), /root-geometry-verdict-mismatch: .*outside its rows/);
  });
  withCopy((dir) => {
    writeFileSync(path.join(dir, "REPORT.md"), readFileSync(path.join(dir, "REPORT.md"), "utf8").replace("| height | 56 | 0 | 7 |", "| height | 63 | 0 | 0 |"));
    assert.throws(() => verifyEvidence(dir), /report-stale/);
  });
  const fakeRepo = mkdtempSync(path.join(os.tmpdir(), "react-native-fidelity-numeric-"));
  try {
    const verifier = "core/native-source-observation.ts";
    mkdirSync(path.dirname(path.join(fakeRepo, verifier)), { recursive: true });
    writeFileSync(path.join(fakeRepo, verifier), readFileSync(path.join(REPO, verifier), "utf8").replace("actual === expected || actual === Math.fround(expected);", "Math.abs(Number(actual) - expected) < 0.5;"));
    assert.throws(() => assertNumericPolicyPin(fakeRepo), /numeric-policy-pin-moved/);
    assert.doesNotThrow(() => assertNumericPolicyPin(REPO));
  } finally {
    rmSync(fakeRepo, { recursive: true, force: true });
  }
});
