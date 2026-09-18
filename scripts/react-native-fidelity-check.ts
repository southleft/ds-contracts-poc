/**
 * REACT -> NATIVE FIGMA FIDELITY — the offline qualification lane for the
 * code-led cohort (`npm run react:native:fidelity:check`).
 *
 * MEASURED, NOT GRADED. Nothing here is a release grade, an accepted contract
 * or an owner sign-off. Every artifact carries `qualification:
 * "measured-not-graded"` and `acceptedContract: null`; the owner grades.
 *
 * From COMMITTED bytes only (recipe/evidence/react-native-fidelity-v1/) this
 * recomputes THREE numbers for every measured pair, with the existing scorers
 * unchanged:
 *
 *   (i)   historical  — the ink-trim unmasked score exactly as
 *                       recipe/fidelity-score.ts `scoreFidelity` computes it
 *                       (composite over white, trim to ink at 250, centre-pad
 *                       to the union, pixelmatch threshold 0.1 includeAA false).
 *   (ii)  aligned     — the same pixelmatch options, but the two rasters are
 *                       placed by their RECORDED LAYOUT ORIGINS (the native
 *                       export's layout offset and the source element's bounds
 *                       inside its crop) instead of by ink. Integer translation
 *                       only: a fractional translation, or a raster that is not
 *                       one image pixel per layout pixel, is REFUSED BY NAME —
 *                       nothing is resampled.
 *   (iii) glyph-masked — `scoreFidelity`'s second pass with the native text
 *                       rects as `glyphRects` (masked on both sides, inflated
 *                       by the scorer's own MASK_INFLATE).
 *
 * VERDICT RULE — the existing F1 row policy (recipe/f1-row-policy.ts), not a
 * softer one:
 *
 *   pass                 historical <= FIDELITY_BAR.pctAAMaskedMax (5).
 *   named-font-residual  historical > 5 AND the row is named in
 *                        KNOWN-FAILURES.json with class `font-substrate` or
 *                        `font-metrics` AND (glyph-masked <= 5 — asserted with
 *                        `assertF1Score` itself — OR the text rects cover the
 *                        whole cell, the "text-only row" branch
 *                        recipe/fidelity-check.ts already accepts) AND
 *                        aligned <= 5.
 *   named-other          class `alignment-trim-threshold` ONLY, and only with
 *                        the proof recomputed here from committed bytes: the
 *                        native interior composites to a painted value >= the
 *                        scorer's trim threshold (so `contentBox` trims it)
 *                        while the source interior composites below it (so it
 *                        is kept), the two interiors differ by at most one
 *                        8-bit step, aligned <= 5 and glyph-masked <= 5.
 *   fail                 anything else. A `fail` is RED: there is no generic
 *                        known-failure class in this lane.
 *
 * The ratchet only tightens: a failing row not named in KNOWN-FAILURES.json is
 * red; a named row that now passes is red until it is removed; a named row the
 * manifest does not contain is red. Naming never changes a number — the
 * historical score is printed for every row whatever its verdict.
 *
 * The gate is also red when any committed byte's sha256 differs from the
 * manifest, when any recomputed number differs from SCORECARD.json, or when
 * REPORT.md is not the byte-fresh render of what was just measured.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

import { compositeOverWhite, readPngBuffer } from "../extract/figma/canvas-gate/score.js";
import { assertF1Score } from "../recipe/f1-row-policy.js";
import { FIDELITY_BAR, scoreFidelity } from "../recipe/fidelity-score.js";

export const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
export const EVIDENCE = "recipe/evidence/react-native-fidelity-v1";
export const QUALIFICATION = "measured-not-graded" as const;
const BAR = FIDELITY_BAR.pctAAMaskedMax;

/**
 * The scorer's private constants this lane's proof depends on. They are not
 * exported, and this lane may not edit the scorer, so they are PINNED: the
 * check reads the scorer's source and refuses if any of them moved.
 */
export const SCORER_PINS = { whiteTrim: 250, maskInflate: 4 } as const;
const SCORER_PIN_PATTERNS: Array<[string, RegExp]> = [
  ["WHITE_TRIM = 250", /const WHITE_TRIM = 250;/],
  ["MASK_INFLATE = 4", /const MASK_INFLATE = 4;/],
  ["contentBox trims with strict <", /png\.data\[i\] < WHITE_TRIM \|\| png\.data\[i \+ 1\] < WHITE_TRIM \|\| png\.data\[i \+ 2\] < WHITE_TRIM\);/],
  ["AA operating point", /pixelmatch\(a\.data, b\.data, diff\.data, width, height, \{ threshold: 0\.1, includeAA: false \}\)/],
];
const AA_OPTIONS = { threshold: 0.1, includeAA: false } as const;

/** One image pixel per CSS pixel: the committed source harness. */
export const SOURCE_HARNESS = {
  viewport: { width: 900, height: 600 },
  deviceScaleFactor: 1,
  cite: "source-reference/react-initial-inspection.ts (browser.newContext viewport 900x600, deviceScaleFactor 1) and source-reference/replay.ts",
} as const;

export interface Box { x: number; y: number; width: number; height: number }
export interface FileRef { path: string; sha256: string; width: number; height: number }
export interface TextRect extends Box { nodeId: string; characters: string }

export interface Pair {
  id: string;
  variant: string;
  observation: string;
  pairedBy: string;
  files: { native: FileRef; source: FileRef };
  native: {
    nodeId: string;
    caseId: string;
    exportBounds: { layout: Box; render: Box };
    /** layout origin inside the export PNG: layout - floor(render) */
    layoutOffset: { x: number; y: number };
    layoutSize: { width: number; height: number };
    /** native TEXT nodes, in the native PNG's own pixel coordinates */
    textRects: TextRect[];
    typography: Array<{ characters: string; family: string; style: string; fontSize: number; lineHeight: unknown; letterSpacing: unknown }>;
  };
  source: {
    originalSha256: string;
    originalSize: { width: number; height: number };
    /** the element's recorded bounds in the original screenshot (CSS px) */
    bounds: Box;
    /** the app's framing crop (source-reference/source-framing.ts cropSourceFrame) */
    crop: Box;
    boundsRecord: string;
    /** every text node of the recorded source tree with its element's computed typography; `family` is the font Chromium actually used (CDP), null when that was not recorded */
    typography: Array<{ text: string; family: string | null; postScriptName: string | null; cssFamily: string; cssWeight: string; fontSize: string; lineHeight: string; letterSpacing: string }> | null;
  };
}

export interface NotMeasured { variant: string; reason: string }
export interface Cohort {
  id: string;
  component: string;
  description: string;
  native: Record<string, unknown>;
  source: Record<string, unknown>;
  pairs: Pair[];
  notMeasured: NotMeasured[];
  notMeasuredReason?: string;
}
export interface Manifest {
  artifactVersion: "react-native-fidelity-manifest-v1";
  qualification: typeof QUALIFICATION;
  acceptedContract: null;
  note: string;
  sourceReferenceId: string;
  harness: typeof SOURCE_HARNESS;
  cohorts: Cohort[];
}

export interface Known { class: string; cause: string; measured?: string }
export interface KnownFile { _marker: string; qualification: typeof QUALIFICATION; failures: Record<string, Known> }

export type Verdict = "pass" | "named-font-residual" | "named-other" | "fail";

export interface Row {
  id: string;
  cohort: string;
  variant: string;
  /** `exactPct` is the scorer's threshold-0 point (every differing pixel, antialiasing included): read it beside a 0.000 */
  historical: { pct: number; exactPct: number; nativePx: string; sourcePx: string; inkNativePct: number; inkSourcePct: number };
  aligned:
    | { pct: number; mismatchedPixels: number; pixelsCompared: number; outsideNativeTextBoxes: number; translation: { native: { x: number; y: number }; source: { x: number; y: number } } }
    | { pct: null; refused: string };
  glyphMasked: { pct: number | null; maskCoveragePct: number; textBoxes: number; textOnlyCell: boolean };
  /** supplementary, never part of the verdict */
  layoutSizeDelta: { width: number; height: number };
  inkMass: { native: number; source: number; sourceOverNative: number | null } | null;
  interior: { native: [number, number, number]; source: [number, number, number]; maxChannelDelta: number } | null;
  typography: "identical" | "identical-family-not-resolved" | "differs" | "no-text" | "source-not-recorded";
  verdict: Verdict;
  class: string | null;
  reasons: string[];
}

export interface Scorecard {
  artifactVersion: "react-native-fidelity-scorecard-v1";
  qualification: typeof QUALIFICATION;
  acceptedContract: null;
  bar: typeof FIDELITY_BAR;
  scorerPins: typeof SCORER_PINS;
  rows: Row[];
  totals: Record<string, { measured: number; pass: number; "named-font-residual": number; "named-other": number; fail: number; "not-measured": number }>;
}

export const sha256 = (buf: Buffer | string): string => createHash("sha256").update(buf).digest("hex");
const round = (n: number, places = 3): number => Math.round(n * 10 ** places) / 10 ** places;

export function assertScorerPins(repo: string = REPO): void {
  const source = readFileSync(path.join(repo, "extract/figma/canvas-gate/score.ts"), "utf8");
  for (const [name, pattern] of SCORER_PIN_PATTERNS)
    if (!pattern.test(source)) throw new Error(`scorer-pin-moved: extract/figma/canvas-gate/score.ts no longer carries "${name}" — this lane's trim-threshold proof and alignment port must be re-derived before it may run`);
}

/** Exactly source-reference/source-framing.ts cropSourceFrame's box arithmetic. */
export function framingCrop(bounds: Box, size: { width: number; height: number }): Box {
  const x = Math.max(0, Math.floor(bounds.x) - 8), y = Math.max(0, Math.floor(bounds.y) - 8);
  const right = Math.min(size.width, Math.ceil(bounds.x + bounds.width) + 8), bottom = Math.min(size.height, Math.ceil(bounds.y + bounds.height) + 8);
  return { x, y, width: right - x, height: bottom - y };
}

const FIGMA_STYLE_WEIGHT: Record<string, string> = { Thin: "100", ExtraLight: "200", "Extra Light": "200", Light: "300", Regular: "400", Medium: "500", SemiBold: "600", "Semi Bold": "600", Bold: "700", ExtraBold: "800", "Extra Bold": "800", Black: "900" };
const px = (v: unknown): string | null => {
  if (v && typeof v === "object" && (v as { unit?: string }).unit === "PIXELS") return `${(v as { value: number }).value}px`;
  return null;
};
function typographyVerdict(pair: Pair): Row["typography"] {
  const native = pair.native.typography, source = pair.source.typography;
  if (source === null) return native.length === 0 ? "no-text" : "source-not-recorded";
  if (native.length === 0 && source.length === 0) return "no-text";
  if (native.length !== source.length) return "differs";
  let resolved = true;
  for (const s of source) {
    const n = native.find((row) => row.characters === s.text);
    if (!n || FIGMA_STYLE_WEIGHT[n.style] !== s.cssWeight) return "differs";
    if (s.family === null) resolved = false;
    else if (n.family !== s.family) return "differs";
    const spacing = n.letterSpacing as { unit?: string; value?: number } | null;
    const spacingZero = spacing !== null && typeof spacing === "object" && spacing.value === 0;
    if (`${n.fontSize}px` !== s.fontSize || px(n.lineHeight) !== s.lineHeight || !(s.letterSpacing === "normal" ? spacingZero : px(spacing) === s.letterSpacing)) return "differs";
  }
  return resolved ? "identical" : "identical-family-not-resolved";
}

interface Placement { native: PNG; source: PNG; width: number; height: number; nativeAt: { x: number; y: number }; sourceAt: { x: number; y: number } }

/**
 * Place both rasters by their recorded layout origins. Port of the private
 * framing diagnostic: integer translation only, no search, no resampling.
 */
export function placeByLayoutOrigin(pair: Pair, nativePng: PNG, sourcePng: PNG): Placement | { refused: string } {
  const { layout, render } = pair.native.exportBounds;
  const renderWidth = Math.ceil(render.x + render.width) - Math.floor(render.x);
  const renderHeight = Math.ceil(render.y + render.height) - Math.floor(render.y);
  if (nativePng.width !== renderWidth || nativePng.height !== renderHeight)
    return { refused: `scale-mismatch: native export is ${nativePng.width}x${nativePng.height} but its recorded render bounds span ${renderWidth}x${renderHeight} layout px` };
  if (Math.abs(layout.width - pair.native.layoutSize.width) > 1e-6 || Math.abs(layout.height - pair.native.layoutSize.height) > 1e-6)
    return { refused: "scale-mismatch: native export layout bounds disagree with the node's layout size" };
  if (pair.source.originalSize.width !== SOURCE_HARNESS.viewport.width * SOURCE_HARNESS.deviceScaleFactor)
    return { refused: `scale-mismatch: source screenshot is ${pair.source.originalSize.width}px wide, the harness viewport is ${SOURCE_HARNESS.viewport.width} CSS px at deviceScaleFactor ${SOURCE_HARNESS.deviceScaleFactor}` };
  const crop = framingCrop(pair.source.bounds, pair.source.originalSize);
  if (JSON.stringify(crop) !== JSON.stringify(pair.source.crop)) return { refused: "source-crop-mismatch: the recorded crop is not the app's framing of the recorded bounds" };
  if (sourcePng.width !== crop.width || sourcePng.height !== crop.height)
    return { refused: `scale-mismatch: source crop is ${sourcePng.width}x${sourcePng.height} but the framing box is ${crop.width}x${crop.height}` };
  const expectedOffset = { x: layout.x - Math.floor(render.x), y: layout.y - Math.floor(render.y) };
  if (expectedOffset.x !== pair.native.layoutOffset.x || expectedOffset.y !== pair.native.layoutOffset.y)
    return { refused: "layout-origin-mismatch: the recorded native layout offset is not layout - floor(render)" };
  const na = pair.native.layoutOffset;
  const sa = { x: pair.source.bounds.x - crop.x, y: pair.source.bounds.y - crop.y };
  const origin = { x: Math.max(sa.x, na.x), y: Math.max(sa.y, na.y) };
  const nativeAt = { x: origin.x - na.x, y: origin.y - na.y }, sourceAt = { x: origin.x - sa.x, y: origin.y - sa.y };
  if ([nativeAt.x, nativeAt.y, sourceAt.x, sourceAt.y].some((n) => !Number.isInteger(n)))
    return { refused: `fractional-translation: native layout origin (${na.x},${na.y}) and source layout origin (${sa.x},${sa.y}) need a sub-pixel shift; rasters are never resampled` };
  const width = Math.max(nativeAt.x + nativePng.width, sourceAt.x + sourcePng.width);
  const height = Math.max(nativeAt.y + nativePng.height, sourceAt.y + sourcePng.height);
  const native = new PNG({ width, height }), source = new PNG({ width, height });
  native.data.fill(255);
  source.data.fill(255);
  PNG.bitblt(compositeOverWhite(nativePng), native, 0, 0, nativePng.width, nativePng.height, nativeAt.x, nativeAt.y);
  PNG.bitblt(compositeOverWhite(sourcePng), source, 0, 0, sourcePng.width, sourcePng.height, sourceAt.x, sourceAt.y);
  return { native, source, width, height, nativeAt, sourceAt };
}

const modal = (png: PNG, region: Box, exclude: Box[]): [number, number, number] | null => {
  const counts = new Map<number, number>();
  for (let y = Math.max(0, region.y); y < Math.min(png.height, region.y + region.height); y++)
    for (let x = Math.max(0, region.x); x < Math.min(png.width, region.x + region.width); x++) {
      if (exclude.some((r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height)) continue;
      const i = (y * png.width + x) * 4;
      const key = (png.data[i]! << 16) | (png.data[i + 1]! << 8) | png.data[i + 2]!;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  let best = -1, bestCount = 0;
  // ties resolve to the smaller key so the answer never depends on scan order
  for (const [key, count] of counts) if (count > bestCount || (count === bestCount && key < best)) { best = key; bestCount = count; }
  return best < 0 ? null : [(best >> 16) & 255, (best >> 8) & 255, best & 255];
};

/** Σ |pixel − local background| / 255 inside the text boxes: how much ink each renderer laid down for the same glyphs. */
const inkMassIn = (png: PNG, rects: Box[]): number => {
  let mass = 0;
  for (const r of rects) {
    const bg = modal(png, r, []);
    if (!bg) continue;
    for (let y = Math.max(0, r.y); y < Math.min(png.height, r.y + r.height); y++)
      for (let x = Math.max(0, r.x); x < Math.min(png.width, r.x + r.width); x++) {
        const i = (y * png.width + x) * 4;
        mass += (Math.abs(png.data[i]! - bg[0]) + Math.abs(png.data[i + 1]! - bg[1]) + Math.abs(png.data[i + 2]! - bg[2])) / 3 / 255;
      }
  }
  return mass;
};

export function measurePair(dir: string, cohort: string, pair: Pair, tmp: string, index: number): Omit<Row, "verdict" | "class" | "reasons"> {
  const nativePath = path.join(dir, pair.files.native.path), sourcePath = path.join(dir, pair.files.source.path);
  const glyphRects = pair.native.textRects.map(({ x, y, width, height }) => ({ x, y, width, height }));
  // (i) + (iii): the existing scorer, unchanged. The native export is the canvas, the React render the reference.
  const card = scoreFidelity(nativePath, sourcePath, pair.id, path.join(tmp, `${index}.diff.png`), false, false, null, { glyphRects });
  const historicalPct = card.metrics.pctAAMasked ?? card.metrics.pctAAUnmasked;
  const glyph = card.glyphMasked!;

  // (ii): recorded layout origins, same pixelmatch operating point.
  const nativePng = readPngBuffer(readFileSync(nativePath)), sourcePng = readPngBuffer(readFileSync(sourcePath));
  const placed = placeByLayoutOrigin(pair, nativePng, sourcePng);
  let aligned: Row["aligned"], inkMass: Row["inkMass"] = null, interior: Row["interior"] = null;
  if ("refused" in placed) aligned = { pct: null, refused: placed.refused };
  else {
    const diff = new PNG({ width: placed.width, height: placed.height });
    const mismatched = pixelmatch(placed.native.data, placed.source.data, diff.data, placed.width, placed.height, AA_OPTIONS);
    const boxes = pair.native.textRects.map((r) => ({ x: r.x + placed.nativeAt.x, y: r.y + placed.nativeAt.y, width: r.width, height: r.height }));
    let outside = 0;
    for (let y = 0; y < placed.height; y++)
      for (let x = 0; x < placed.width; x++) {
        const i = (y * placed.width + x) * 4;
        if (diff.data[i] === 255 && diff.data[i + 1] === 0 && diff.data[i + 2] === 0 && !boxes.some((r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height)) outside++;
      }
    aligned = { pct: (100 * mismatched) / (placed.width * placed.height), mismatchedPixels: mismatched, pixelsCompared: placed.width * placed.height, outsideNativeTextBoxes: outside, translation: { native: placed.nativeAt, source: placed.sourceAt } };
    if (boxes.length > 0) {
      const n = inkMassIn(placed.native, boxes), s = inkMassIn(placed.source, boxes);
      inkMass = { native: round(n), source: round(s), sourceOverNative: n > 0 ? round(s / n, 4) : null };
    }
    // interior = the layout box both sides share, minus the text boxes inflated by the scorer's MASK_INFLATE
    const layoutBox = { x: placed.nativeAt.x + pair.native.layoutOffset.x, y: placed.nativeAt.y + pair.native.layoutOffset.y, width: Math.floor(Math.min(pair.native.layoutSize.width, pair.source.bounds.width)), height: Math.floor(Math.min(pair.native.layoutSize.height, pair.source.bounds.height)) };
    const inflated = boxes.map((r) => ({ x: r.x - SCORER_PINS.maskInflate, y: r.y - SCORER_PINS.maskInflate, width: r.width + 2 * SCORER_PINS.maskInflate, height: r.height + 2 * SCORER_PINS.maskInflate }));
    const a = modal(placed.native, layoutBox, inflated), b = modal(placed.source, layoutBox, inflated);
    if (a && b) interior = { native: a, source: b, maxChannelDelta: Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])) };
  }
  return {
    id: pair.id,
    cohort,
    variant: pair.variant,
    historical: { pct: historicalPct, exactPct: card.metrics.pctExactUnmasked, nativePx: card.metrics.canvasPx, sourcePx: card.metrics.realPx, inkNativePct: card.metrics.inkCanvasPct, inkSourcePct: card.metrics.inkRealPct },
    aligned,
    glyphMasked: { pct: glyph.pctAAMasked, maskCoveragePct: glyph.maskCoveragePct, textBoxes: glyph.textBoxes, textOnlyCell: glyph.pctAAMasked === null && glyph.textBoxes > 0 },
    layoutSizeDelta: { width: round(pair.native.layoutSize.width - pair.source.bounds.width, 4), height: round(pair.native.layoutSize.height - pair.source.bounds.height, 4) },
    inkMass,
    interior,
    typography: typographyVerdict(pair),
  };
}

const FONT_CLASSES = new Set(["font-substrate", "font-metrics"]);
export const TRIM_CLASS = "alignment-trim-threshold";

/** Why the trim-threshold proof does NOT hold for these measurements (empty = it holds). */
function trimThresholdGaps(m: Omit<Row, "verdict" | "class" | "reasons">): string[] {
  const gaps: string[] = [], t = SCORER_PINS.whiteTrim;
  if (m.historical.nativePx === m.historical.sourcePx) gaps.push(`both sides trim to ${m.historical.nativePx}: the ink trim did not diverge, so the threshold is not the cause`);
  if (!m.interior) return [...gaps, "no interior could be sampled"];
  const { native, source, maxChannelDelta } = m.interior;
  if (!native.every((c) => c >= t)) gaps.push(`native interior rgb(${native.join(",")}) is not >= the trim threshold ${t} on every channel, so the scorer does not trim it`);
  if (native.every((c) => c === 255)) gaps.push("native interior is pure white: no background is painted, which is a defect, not a threshold artefact");
  if (!source.some((c) => c < t)) gaps.push(`source interior rgb(${source.join(",")}) is not below the trim threshold ${t}, so both sides trim alike`);
  if (maxChannelDelta > 1) gaps.push(`the interiors differ by ${maxChannelDelta} 8-bit steps; only a one-step rounding difference is a threshold artefact`);
  return gaps;
}

export function verdictFor(m: Omit<Row, "verdict" | "class" | "reasons">, known: Known | undefined): Pick<Row, "verdict" | "class" | "reasons"> {
  if (m.historical.pct <= BAR) return { verdict: "pass", class: null, reasons: [] };
  const reasons: string[] = [];
  if (!known) return { verdict: "fail", class: null, reasons: [`historical ${m.historical.pct.toFixed(3)}% > ${BAR}% and the row is not named in KNOWN-FAILURES.json`] };
  const alignedOk = m.aligned.pct !== null && m.aligned.pct <= BAR;
  if (!alignedOk) reasons.push(m.aligned.pct === null ? `layout-aligned score refused: ${m.aligned.refused}` : `layout-aligned ${m.aligned.pct.toFixed(3)}% > ${BAR}%`);
  if (FONT_CLASSES.has(known.class)) {
    if (m.glyphMasked.textBoxes === 0) reasons.push(`named ${known.class} but the native side has no text box`);
    else if (m.glyphMasked.textOnlyCell) {
      /* the text rects cover the whole cell: the font is the whole residual (recipe/fidelity-check.ts's text-only branch) */
    } else {
      try {
        assertF1Score({ label: m.id, status: "fail", pctAAMasked: m.historical.pct, glyphMasked: m.glyphMasked.pct }, known);
      } catch (e) {
        reasons.push((e as Error).message);
      }
    }
    if (known.class === "font-metrics" && !known.measured) reasons.push("named font-metrics without a `measured` field");
    // A font naming is a claim that the font is the residual. Where the trim-threshold proof holds, the measured cause is the trim, and the font label is a misclassification.
    if (trimThresholdGaps(m).length === 0) reasons.push(`named ${known.class}, but the measurements prove an ${TRIM_CLASS} (native interior rgb(${m.interior!.native.join(",")}) is trimmed, source rgb(${m.interior!.source.join(",")}) is not): the residual is not the font`);
    return reasons.length === 0 ? { verdict: "named-font-residual", class: known.class, reasons } : { verdict: "fail", class: known.class, reasons };
  }
  if (known.class === TRIM_CLASS) {
    reasons.push(...trimThresholdGaps(m));
    if (!(typeof m.glyphMasked.pct === "number" && m.glyphMasked.pct <= BAR)) reasons.push(`glyph-masked pass is not green (${String(m.glyphMasked.pct)})`);
    return reasons.length === 0 ? { verdict: "named-other", class: known.class, reasons } : { verdict: "fail", class: known.class, reasons };
  }
  reasons.push(`named with class "${known.class}": this lane admits only font-substrate, font-metrics and a proven ${TRIM_CLASS}`);
  return { verdict: "fail", class: known.class, reasons };
}

export function readJson<T>(file: string): T {
  if (!existsSync(file)) throw new Error(`evidence-file-missing: ${file}`);
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

/**
 * THE DENOMINATOR. The manifest cannot shrink its own coverage: every cohort
 * member and its measured / not-measured split is pinned here, so dropping a
 * pair (or quietly re-filing it as not-measured) is a reviewed code change.
 */
export const EXPECTED_COVERAGE: Record<string, { measured: number; notMeasured: number }> = {
  "button-initial": { measured: 24, notMeasured: 0 },
  "checkbox-initial": { measured: 12, notMeasured: 0 },
  "card-composed-variants": { measured: 6, notMeasured: 0 },
  "card-composed-frame": { measured: 1, notMeasured: 0 },
  "card-content-frame": { measured: 1, notMeasured: 0 },
  "button-root-matrix": { measured: 0, notMeasured: 63 },
};

export function verifyBytes(dir: string, manifest: Manifest): void {
  const got = Object.fromEntries(manifest.cohorts.map((c) => [c.id, { measured: c.pairs.length, notMeasured: c.notMeasured.length }]));
  if (JSON.stringify(got) !== JSON.stringify(EXPECTED_COVERAGE)) throw new Error(`coverage-changed: the manifest measures ${JSON.stringify(got)}, the lane pins ${JSON.stringify(EXPECTED_COVERAGE)}`);
  for (const cohort of manifest.cohorts) {
    if (new Set(cohort.pairs.map((p) => p.id)).size !== cohort.pairs.length || new Set(cohort.notMeasured.map((n) => n.variant)).size !== cohort.notMeasured.length) throw new Error(`coverage-changed: ${cohort.id} names a variant twice`);
    if (cohort.notMeasured.some((n) => !n.reason) || (cohort.notMeasured.length > 0 && !cohort.notMeasuredReason)) throw new Error(`not-measured-without-reason: ${cohort.id}`);
  }
  const seen = new Set<string>();
  for (const cohort of manifest.cohorts)
    for (const pair of cohort.pairs)
      for (const side of ["native", "source"] as const) {
        const ref = pair.files[side];
        if (path.isAbsolute(ref.path) || ref.path.includes("..")) throw new Error(`evidence-path-invalid: ${pair.id} ${side} ${ref.path}`);
        if (seen.has(ref.path)) throw new Error(`evidence-path-duplicated: ${ref.path}`);
        seen.add(ref.path);
        const file = path.join(dir, ref.path);
        if (!existsSync(file)) throw new Error(`evidence-image-missing: ${pair.id} ${side} ${ref.path}`);
        const bytes = readFileSync(file);
        if (sha256(bytes) !== ref.sha256) throw new Error(`evidence-hash-mismatch: ${pair.id} ${side} ${ref.path} is not the recorded sha256`);
        const png = PNG.sync.read(bytes, { checkCRC: true });
        if (png.width !== ref.width || png.height !== ref.height) throw new Error(`evidence-size-mismatch: ${pair.id} ${side} ${ref.path}`);
      }
}

export function buildScorecard(dir: string, manifest: Manifest, known: KnownFile): Scorecard {
  if (manifest.qualification !== QUALIFICATION || manifest.acceptedContract !== null) throw new Error("manifest-qualification-invalid: the manifest must stay measured-not-graded with acceptedContract null");
  if (known.qualification !== QUALIFICATION) throw new Error("ratchet-qualification-invalid: KNOWN-FAILURES.json must stay measured-not-graded");
  const tmp = mkdtempSync(path.join(os.tmpdir(), "react-native-fidelity-"));
  const rows: Row[] = [], totals: Scorecard["totals"] = {};
  try {
    let index = 0;
    for (const cohort of manifest.cohorts) {
      const total = (totals[cohort.id] = { measured: cohort.pairs.length, pass: 0, "named-font-residual": 0, "named-other": 0, fail: 0, "not-measured": cohort.notMeasured.length });
      for (const pair of cohort.pairs) {
        const measured = measurePair(dir, cohort.id, pair, tmp, index++);
        const row = { ...measured, ...verdictFor(measured, known.failures[pair.id]) };
        total[row.verdict]++;
        rows.push(row);
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return { artifactVersion: "react-native-fidelity-scorecard-v1", qualification: QUALIFICATION, acceptedContract: null, bar: FIDELITY_BAR, scorerPins: SCORER_PINS, rows, totals };
}

/** The ratchet, mirrored from recipe/fidelity-check.ts: it only tightens. */
export function ratchetProblems(scorecard: Scorecard, known: KnownFile): string[] {
  const problems: string[] = [];
  const byId = new Map(scorecard.rows.map((r) => [r.id, r]));
  for (const row of scorecard.rows) {
    if (row.verdict !== "fail") continue;
    problems.push(known.failures[row.id] === undefined ? `unnamed-failure: ${row.id} fails (${row.historical.pct.toFixed(3)}%) and is NOT named in KNOWN-FAILURES.json` : `named-row-fails-the-rule: ${row.id} [${row.class}] — ${row.reasons.join("; ")}`);
  }
  for (const id of Object.keys(known.failures)) {
    const row = byId.get(id);
    if (!row) problems.push(`stale-ratchet: KNOWN-FAILURES.json names ${id}, which the manifest does not measure`);
    else if (row.historical.pct <= BAR) problems.push(`stale-ratchet: KNOWN-FAILURES.json names ${id}, which no longer fails (${row.historical.pct.toFixed(3)}%) — the ratchet only shrinks: remove the row`);
  }
  return problems;
}

const range = (values: number[]): string => (values.length === 0 ? "—" : `${Math.min(...values).toFixed(3)}–${Math.max(...values).toFixed(3)}`);
const pct = (n: number | null): string => (n === null ? "—" : n.toFixed(3));

export function renderReport(manifest: Manifest, scorecard: Scorecard, known: KnownFile): string {
  const out: string[] = [];
  out.push("# React → native Figma fidelity — measured, not graded", "");
  out.push("GENERATED by `npm run react:native:fidelity:check` from the committed bytes in this directory. Do not edit: the gate verifies this file is the byte-fresh render of what it just measured.", "");
  out.push(`**Qualification: \`${QUALIFICATION}\`.** Nothing here is a release grade, an accepted contract or an owner sign-off (\`acceptedContract: null\` throughout). The numbers are measurements; the owner grades.`, "");
  out.push("## The three numbers", "");
  out.push("| | what it is |", "| --- | --- |");
  out.push("| **historical** | the ink-trim unmasked score exactly as `recipe/fidelity-score.ts` `scoreFidelity` computes it — the number every earlier private run reported |");
  out.push("| **aligned** | the same pixelmatch operating point (threshold 0.1, antialiased pixels excluded) with the two rasters placed by their RECORDED layout origins instead of by ink; integer translation only, refused by name otherwise |");
  out.push("| **glyph-masked** | `scoreFidelity`'s second pass with the native text rects masked on both sides (inflated by the scorer's own 4 px) |", "");
  out.push("All three are the scorer's antialias-TOLERANT operating point, the one the 5 % bar is defined on. The per-row `exact %` column is the scorer's threshold-0 point on the same ink-trimmed pair (every differing pixel counts, antialiasing included); it is printed so a 0.000 is never read as pixel identity — a one-step colour difference across a whole fill is invisible to the tolerant point and total at the exact one.", "");
  out.push("## Verdict rule (the existing F1 row policy)", "");
  out.push(`- \`pass\` — historical ≤ ${BAR} %.`);
  out.push(`- \`named-font-residual\` — historical > ${BAR} % AND named in \`KNOWN-FAILURES.json\` with class \`font-substrate\` or \`font-metrics\` AND (glyph-masked ≤ ${BAR} % OR the text rects cover the whole cell) AND aligned ≤ ${BAR} %.`);
  out.push(`- \`named-other\` — class \`${TRIM_CLASS}\` only, with the proof recomputed from committed bytes: native interior ≥ the scorer's trim threshold (${SCORER_PINS.whiteTrim}) on every channel yet painted, source interior below it, the two within one 8-bit step, aligned ≤ ${BAR} % and glyph-masked ≤ ${BAR} %.`);
  out.push("- `fail` — anything else. A `fail` is red; the ratchet only tightens (an unnamed failure is red, a named row that passes is red until removed).", "");
  out.push("## Cohort totals", "");
  out.push("| cohort | measured | pass | named-font-residual | named-other | fail | not-measured | historical % | aligned % | glyph-masked % |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |");
  for (const cohort of manifest.cohorts) {
    const t = scorecard.totals[cohort.id]!;
    const rows = scorecard.rows.filter((r) => r.cohort === cohort.id);
    out.push(`| ${cohort.id} | ${t.measured} | ${t.pass} | ${t["named-font-residual"]} | ${t["named-other"]} | ${t.fail} | ${t["not-measured"]} | ${range(rows.map((r) => r.historical.pct))} | ${range(rows.flatMap((r) => (r.aligned.pct === null ? [] : [r.aligned.pct])))} | ${range(rows.flatMap((r) => (r.glyphMasked.pct === null ? [] : [r.glyphMasked.pct])))} |`);
  }
  out.push("");
  for (const cohort of manifest.cohorts) {
    out.push(`## ${cohort.id}`, "", cohort.description, "");
    const rows = scorecard.rows.filter((r) => r.cohort === cohort.id);
    if (rows.length > 0) {
      out.push("| variant | verdict | historical % | exact % | trimmed native / source | aligned % | diff px outside text | glyph-masked % | text boxes | layout Δ (w,h) | interior native / source | ink mass source÷native | typography |", "| --- | --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- | --- | ---: | --- |");
      for (const r of rows)
        out.push(`| ${r.variant} | ${r.verdict}${r.class ? ` [${r.class}]` : ""} | ${pct(r.historical.pct)} | ${pct(r.historical.exactPct)} | ${r.historical.nativePx} / ${r.historical.sourcePx} | ${r.aligned.pct === null ? `refused: ${r.aligned.refused}` : pct(r.aligned.pct)} | ${r.aligned.pct === null ? "—" : r.aligned.outsideNativeTextBoxes} | ${r.glyphMasked.textOnlyCell ? "text-only cell" : pct(r.glyphMasked.pct)} | ${r.glyphMasked.textBoxes} | ${r.layoutSizeDelta.width}, ${r.layoutSizeDelta.height} | ${r.interior ? `${r.interior.native.join(",")} / ${r.interior.source.join(",")}` : "—"} | ${r.inkMass?.sourceOverNative ?? "—"} | ${r.typography} |`);
      out.push("");
    }
    if (cohort.notMeasured.length > 0) {
      out.push(`**Not measured (${cohort.notMeasured.length}).** ${cohort.notMeasuredReason ?? ""}`.trim(), "");
      out.push(cohort.notMeasured.map((n) => `\`${n.variant}\``).join(", "), "");
    }
  }
  const named = scorecard.rows.filter((r) => r.class !== null);
  if (named.length > 0) {
    out.push("## Named rows (KNOWN-FAILURES.json)", "");
    for (const r of named) out.push(`- \`${r.id}\` — **${r.verdict}** [${r.class}] historical ${pct(r.historical.pct)} %: ${known.failures[r.id]?.cause ?? ""}${r.reasons.length ? ` — RULE NOT MET: ${r.reasons.join("; ")}` : ""}`);
    out.push("");
  }
  const masses = scorecard.rows.flatMap((r) => (r.inkMass?.sourceOverNative ? [r.inkMass.sourceOverNative] : []));
  if (masses.length > 0) {
    const sorted = [...masses].sort((a, b) => a - b);
    out.push("## Text antialiasing: ink mass", "", `Inside the native text boxes (placed by layout origin) Chromium lays down ${sorted[0]!.toFixed(3)}×–${sorted.at(-1)!.toFixed(3)}× the ink Figma does for the same glyphs (median ${sorted[Math.floor(sorted.length / 2)]!.toFixed(3)}×, ${masses.length} rows with text). Ink mass = Σ |pixel − the box's modal background| / 255. It is supplementary and never part of a verdict.`, "");
  }
  out.push("## What this does not measure", "");
  out.push("- One mount, one initial state per variant, light scheme, one image pixel per CSS pixel. No interaction, hover, focus, responsive or dark-mode state.");
  out.push("- The native side is a dated readback export, not a claim about the live file today.");
  out.push("- Variants listed as not-measured above have no honest like-for-like pair; nothing was substituted for them.");
  out.push("- Appearance only: structure, bindings and editability are qualified elsewhere.", "");
  return out.join("\n");
}

export interface Verified { manifest: Manifest; known: KnownFile; scorecard: Scorecard; report: string }

/** Everything the gate asserts, against any directory (the tests pass temp copies). Throws by name. */
export function verifyEvidence(dir: string, repo: string = REPO): Verified {
  assertScorerPins(repo);
  const manifest = readJson<Manifest>(path.join(dir, "manifest.json"));
  const known = readJson<KnownFile>(path.join(dir, "KNOWN-FAILURES.json"));
  const committed = readJson<Scorecard>(path.join(dir, "SCORECARD.json"));
  verifyBytes(dir, manifest);
  const scorecard = buildScorecard(dir, manifest, known);
  const problems = ratchetProblems(scorecard, known);
  if (problems.length > 0) throw new Error(`ratchet-red:\n  ${problems.join("\n  ")}`);
  for (const row of scorecard.rows) {
    const recorded = committed.rows.find((r) => r.id === row.id);
    if (!recorded) throw new Error(`scorecard-row-missing: SCORECARD.json has no row ${row.id}`);
    if (JSON.stringify(recorded) !== JSON.stringify(row)) {
      const field = (Object.keys(row) as Array<keyof Row>).find((k) => JSON.stringify(recorded[k]) !== JSON.stringify(row[k]));
      throw new Error(`scorecard-mismatch: ${row.id} field "${String(field)}" — committed ${JSON.stringify(recorded[field!])}, recomputed ${JSON.stringify(row[field!])}`);
    }
  }
  if (JSON.stringify(committed) !== JSON.stringify(scorecard)) throw new Error("scorecard-mismatch: SCORECARD.json differs from the recomputed scorecard outside its rows (totals, bar, pins or extra rows)");
  const report = renderReport(manifest, scorecard, known);
  const reportPath = path.join(dir, "REPORT.md");
  if (!existsSync(reportPath) || readFileSync(reportPath, "utf8") !== report) throw new Error("report-stale: REPORT.md is not the byte-fresh render of the measured scorecard — run npm run react:native:fidelity:check -- --write-derived");
  return { manifest, known, scorecard, report };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const dir = path.join(REPO, EVIDENCE);
  try {
    if (process.argv.includes("--write-derived")) {
      // Regenerates the two DERIVED files from committed bytes. It never touches an image, the manifest or the ratchet.
      const manifest = readJson<Manifest>(path.join(dir, "manifest.json")), known = readJson<KnownFile>(path.join(dir, "KNOWN-FAILURES.json"));
      assertScorerPins();
      verifyBytes(dir, manifest);
      const scorecard = buildScorecard(dir, manifest, known);
      writeFileSync(path.join(dir, "SCORECARD.json"), `${JSON.stringify(scorecard, null, 2)}\n`);
      writeFileSync(path.join(dir, "REPORT.md"), renderReport(manifest, scorecard, known));
    }
    const { manifest, scorecard } = verifyEvidence(dir);
    for (const cohort of manifest.cohorts) {
      const t = scorecard.totals[cohort.id]!;
      console.log(`${cohort.id.padEnd(26)} measured ${String(t.measured).padStart(2)} · pass ${t.pass} · named-font-residual ${t["named-font-residual"]} · named-other ${t["named-other"]} · fail ${t.fail} · not-measured ${t["not-measured"]}`);
    }
    for (const r of scorecard.rows.filter((row) => row.verdict !== "pass")) console.log(`  ${r.verdict.padEnd(20)} ${r.id} [${r.class}] historical ${pct(r.historical.pct)}% aligned ${pct(r.aligned.pct)}% glyph-masked ${r.glyphMasked.textOnlyCell ? "text-only cell" : `${pct(r.glyphMasked.pct)}%`}`);
    console.log(`\n✔ react:native:fidelity:check — ${scorecard.rows.length} pairs recomputed from committed bytes; ${QUALIFICATION} (the owner grades)`);
  } catch (e) {
    console.error(`\n✖ react:native:fidelity:check — ${(e as Error).message}`);
    process.exit(1);
  }
}
