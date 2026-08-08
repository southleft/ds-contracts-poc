/**
 * Developed pixel score for console-loop foreign stems.
 *
 * Compares a canvas screenshot PNG against the developed reference PNG using
 * the canvas-gate scorer (content-box trim + union pad + pixelmatch AA).
 *
 * Usage:
 *   node scripts/console-loop-developed-score.mjs
 *   node scripts/console-loop-developed-score.mjs --lib carbon --stem checkbox
 *   node scripts/console-loop-developed-score.mjs --manifest
 *
 * Canvas shot path (optional, preferred when present):
 *   parity/receipts/console-loop/<lib>/shots/<stem>.png
 * Falls back to receipt.visual.canvasShot if set.
 *
 * Pass bar (hillclimb §4): masked mean AA ≤ 5% AND compositionOk. This is the
 * ONE bar — near-pass is a fail. The evidence gates
 * (console-loop-*evidence-check.mjs) read these scorecards directly; receipt
 * booleans are never trusted, so there is no "flip" step. A receipt may claim
 * a visual pass only when this scorecard passes.
 *
 * Scorecards pin sha256 of the reference + canvas PNGs they scored
 * (referenceSha256 / canvasShotSha256); gates verify the pins against disk.
 * Passes that relied on the framingTolerant relaxation are surfaced via
 * reliedOnFramingTolerant + the note.
 *
 * Like-for-like rules (compositionOk fails otherwise):
 *   - Canvas: VARIANT cell at export scale 1 → shots/<stem>-cell.png
 *   - Reference: gate-shots/*.png (or single-cell pair), NOT pair-- side-by-side receipts
 *   - Prefer solid-fill variants for outline/secondary chips (opacity-0 fills vanish on white refs)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const sha256File = (p) =>
  createHash("sha256").update(readFileSync(p)).digest("hex");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TRAP_MANIFEST = path.join(
  ROOT,
  "parity/receipts/console-loop/trap-corpus/manifest.json",
);
const PASS_AA_MASKED = 5;

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

const onlyLib = argValue("--lib");
const onlyStem = argValue("--stem");

/**
 * Lane root: the FIRST-PARTY lane lives at the console-loop root
 * (components/, shots/, refs/, scores/ directly under
 * parity/receipts/console-loop — the layout console-loop-evidence-check.mjs
 * reads); foreign lanes are nested one directory deeper under their lib name.
 */
const laneRoot = (lib) =>
  lib === "first-party"
    ? path.join(ROOT, "parity/receipts/console-loop")
    : path.join(ROOT, "parity/receipts/console-loop", lib);
const useManifest =
  process.argv.includes("--manifest") || (!onlyLib && !onlyStem);

/** @type {{ lib: string, stem: string, fc?: string[], reference?: string, pendingRef?: boolean }[]} */
let rows = [];

if (onlyLib && onlyStem) {
  const receiptPath = path.join(laneRoot(onlyLib), "components", `${onlyStem}.json`);
  let reference;
  let fc = [];
  // Prefer receipt.visual.reference (hill-climb may retarget to cropped /
  // package-left / emit-html first-item refs) over the trap-corpus snapshot.
  if (existsSync(receiptPath)) {
    try {
      const r = JSON.parse(readFileSync(receiptPath, "utf8"));
      const ref = r.visual?.reference;
      if (typeof ref === "string" && ref.trim()) {
        reference = ref.split(";")[0].trim();
      }
    } catch {
      /* ignore */
    }
  }
  if (existsSync(TRAP_MANIFEST)) {
    const m = JSON.parse(readFileSync(TRAP_MANIFEST, "utf8"));
    const hit = (m.stems ?? []).find(
      (s) => s.lib === onlyLib && s.stem === onlyStem,
    );
    if (hit) {
      fc = hit.fc ?? [];
      if (!reference) reference = hit.reference;
    }
  }
  rows = [{ lib: onlyLib, stem: onlyStem, fc, reference, pendingRef: !reference }];
} else if (useManifest) {
  if (!existsSync(TRAP_MANIFEST)) {
    console.error(
      `✖ console-loop:developed-score: missing ${path.relative(ROOT, TRAP_MANIFEST)}`,
    );
    process.exit(1);
  }
  const m = JSON.parse(readFileSync(TRAP_MANIFEST, "utf8"));
  rows = m.stems ?? [];
  if (onlyLib) rows = rows.filter((r) => r.lib === onlyLib);
  if (onlyStem) rows = rows.filter((r) => r.stem === onlyStem);
} else {
  console.error(
    "usage: console-loop-developed-score.mjs [--manifest] | --lib <lib> --stem <stem>",
  );
  process.exit(2);
}

const require = createRequire(import.meta.url);

async function loadScorer() {
  // Prefer canvas-gate score (TypeScript via tsx dynamic import path).
  try {
    const mod = await import(
      pathToFileURL(path.join(ROOT, "extract/figma/canvas-gate/score.ts")).href
    );
    return mod;
  } catch {
    // Fallback: visual-parity img helpers if canvas-gate import fails under plain node.
    const img = await import(
      pathToFileURL(path.join(ROOT, "extract/figma/visual-parity/img.ts")).href
    );
    return img;
  }
}

function resolveCanvasShot(lib, stem, receipt) {
  // Prefer like-for-like cell shot when present (set screenshots fail composition guard).
  const cellPreferred = path.join(laneRoot(lib), "shots", `${stem}-cell.png`);
  if (existsSync(cellPreferred)) return cellPreferred;
  // Carbon checkbox trap pairs against unchecked.enabled__default — use that cell.
  if (lib === "carbon" && stem === "checkbox") {
    const unchecked = path.join(
      ROOT,
      "parity/receipts/console-loop/carbon/shots/checkbox-unchecked.png",
    );
    if (existsSync(unchecked)) return unchecked;
  }
  const preferred = path.join(laneRoot(lib), "shots", `${stem}.png`);
  if (existsSync(preferred)) return preferred;
  const fromReceipt = receipt.visual?.canvasShot;
  if (typeof fromReceipt === "string") {
    const abs = path.isAbsolute(fromReceipt)
      ? fromReceipt
      : path.join(ROOT, fromReceipt);
    if (existsSync(abs)) return abs;
  }
  return null;
}

const scorer = await loadScorer();
const readPngBuffer = scorer.readPngBuffer;
const alignPair =
  scorer.alignPair ||
  scorer.alignPngs ||
  ((a, b) => {
    // Minimal align: require same size; otherwise center-pad via canvas-gate if present.
    if (scorer.alignToUnion) return scorer.alignToUnion(a, b);
    throw new Error("no alignPair export from score module");
  });
const scoreCell = scorer.scoreCell;

const WHITE_TRIM = 250;
function contentBoxOf(png) {
  let minX = png.width,
    minY = png.height,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4;
      const ink =
        png.data[i + 3] > 16 &&
        (png.data[i] < WHITE_TRIM ||
          png.data[i + 1] < WHITE_TRIM ||
          png.data[i + 2] < WHITE_TRIM);
      if (ink) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, width: png.width, height: png.height };
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Crop to content box then nearest-neighbor scale to tw×th (white canvas). */
async function normalizeContentSize(png, tw, th) {
  const { PNG } = await import("pngjs");
  const box = contentBoxOf(png);
  const out = new PNG({ width: tw, height: th });
  out.data.fill(255);
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const sx = box.x + Math.min(box.width - 1, Math.floor((x * box.width) / tw));
      const sy = box.y + Math.min(box.height - 1, Math.floor((y * box.height) / th));
      const si = (sy * png.width + sx) * 4;
      const di = (y * tw + x) * 4;
      const a = png.data[si + 3] / 255;
      out.data[di] = Math.round(png.data[si] * a + 255 * (1 - a));
      out.data[di + 1] = Math.round(png.data[si + 1] * a + 255 * (1 - a));
      out.data[di + 2] = Math.round(png.data[si + 2] * a + 255 * (1 - a));
      out.data[di + 3] = 255;
    }
  }
  return out;
}

let wrote = 0;
let skipped = 0;
let scored = 0;
const notes = [];

for (const row of rows) {
  const { lib, stem } = row;
  const tag = `${lib}/${stem}`;
  const receiptPath = path.join(laneRoot(lib), "components", `${stem}.json`);
  const refRel = row.reference;
  const refPath = refRel ? path.join(ROOT, refRel) : null;
  const hasRef = Boolean(refPath && existsSync(refPath));
  const hasReceipt = existsSync(receiptPath);

  if (!hasRef || !hasReceipt) {
    skipped += 1;
    notes.push(
      `skip ${tag}: ${!hasRef ? "no reference PNG" : ""}${!hasRef && !hasReceipt ? " + " : ""}${!hasReceipt ? "no console-loop receipt" : ""}`,
    );
    continue;
  }

  /** @type {Record<string, any>} */
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
  } catch (e) {
    notes.push(`skip ${tag}: invalid receipt JSON — ${e.message}`);
    skipped += 1;
    continue;
  }

  const canvasPath = resolveCanvasShot(lib, stem, receipt);
  const scoreDir = path.join(laneRoot(lib), "scores");
  mkdirSync(scoreDir, { recursive: true });
  const outPath = path.join(scoreDir, `${stem}.json`);
  const matchDevelopedReceipt = receipt.visual?.matchDeveloped === true;

  if (!canvasPath) {
    const scorecard = {
      version: 3,
      status: "awaiting-canvas-shot",
      matchDeveloped: matchDevelopedReceipt,
      passBar: { pctAAMaskedMax: PASS_AA_MASKED, compositionOk: true },
      reference: refRel,
      referenceSha256: sha256File(refPath),
      canvasShot: null,
      fc: Array.isArray(row.fc) ? row.fc : [],
      receipt: path.relative(ROOT, receiptPath),
      note: "place a COMPONENT_SET screenshot at parity/receipts/console-loop/<lib>/shots/<stem>.png then re-run",
      recordedAt: new Date().toISOString(),
    };
    writeFileSync(outPath, `${JSON.stringify(scorecard, null, 2)}\n`);
    wrote += 1;
    console.log(
      `⚠ ${tag}: no canvas shot — wrote awaiting-canvas-shot scorecard`,
    );
    continue;
  }

  try {
    let canvasPng = readPngBuffer(readFileSync(canvasPath));
    let refPng = readPngBuffer(readFileSync(refPath));
    // Figma exportAsync @2× vs gate-shots @1×: when content boxes are ~2×
    // apart, downscale the larger so compositionOk can measure real AA.
    const roughScale = Math.max(
      canvasPng.width / refPng.width,
      refPng.width / canvasPng.width,
      canvasPng.height / refPng.height,
      refPng.height / canvasPng.height,
    );
    let dprNormalized = false;
    if (roughScale >= 1.7 && roughScale <= 2.4) {
      const { PNG } = await import("pngjs");
      const downscale2x = (src) => {
        const w = Math.max(1, Math.floor(src.width / 2));
        const h = Math.max(1, Math.floor(src.height / 2));
        const out = new PNG({ width: w, height: h });
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const si = ((y * 2) * src.width + x * 2) * 4;
            const di = (y * w + x) * 4;
            out.data[di] = src.data[si];
            out.data[di + 1] = src.data[si + 1];
            out.data[di + 2] = src.data[si + 2];
            out.data[di + 3] = src.data[si + 3];
          }
        }
        return out;
      };
      if (canvasPng.width * canvasPng.height > refPng.width * refPng.height) {
        canvasPng = downscale2x(canvasPng);
      } else {
        refPng = downscale2x(refPng);
      }
      dprNormalized = true;
    }
    let aligned = alignPair(canvasPng, refPng);
    let cell = scoreCell(aligned, [], []);
    // Reject set-vs-cell / wildly mismatched crops — content-box union pad
    // can falsely land under the AA bar when compositions differ.
    let aW = aligned.aPlace?.content?.width ?? canvasPng.width;
    let aH = aligned.aPlace?.content?.height ?? canvasPng.height;
    let bW = aligned.bPlace?.content?.width ?? refPng.width;
    let bH = aligned.bPlace?.content?.height ?? refPng.height;
    let scaleRatio = Math.max(aW / bW, bW / aW, aH / bH, bH / aH);
    // Content-box DPR: gate-shots are often 1× while Figma exportAsync was 2×.
    // Re-align after downscaling the larger content side when ratio ≈ 2.
    if (scaleRatio >= 1.7 && scaleRatio <= 2.4 && !dprNormalized) {
      const { PNG } = await import("pngjs");
      const downscale2x = (src) => {
        const w = Math.max(1, Math.floor(src.width / 2));
        const h = Math.max(1, Math.floor(src.height / 2));
        const out = new PNG({ width: w, height: h });
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const si = (y * 2 * src.width + x * 2) * 4;
            const di = (y * w + x) * 4;
            out.data[di] = src.data[si];
            out.data[di + 1] = src.data[si + 1];
            out.data[di + 2] = src.data[si + 2];
            out.data[di + 3] = src.data[si + 3];
          }
        }
        return out;
      };
      if (aW * aH > bW * bH) canvasPng = downscale2x(canvasPng);
      else refPng = downscale2x(refPng);
      aligned = alignPair(canvasPng, refPng);
      cell = scoreCell(aligned, [], []);
      aW = aligned.aPlace?.content?.width ?? canvasPng.width;
      aH = aligned.aPlace?.content?.height ?? canvasPng.height;
      bW = aligned.bPlace?.content?.width ?? refPng.width;
      bH = aligned.bPlace?.content?.height ?? refPng.height;
      scaleRatio = Math.max(aW / bW, bW / aW, aH / bH, bH / aH);
      dprNormalized = true;
    }
    // Showcase / site-receipt size mismatch: if aspect ratios agree, scale both
    // content boxes to the smaller footprint so AA measures shape/paint, not stage size.
    let sizeNormalized = false;
    const aspectA = aW / Math.max(1, aH);
    const aspectB = bW / Math.max(1, bH);
    const aspectRatio = Math.max(aspectA / aspectB, aspectB / aspectA);
    if (scaleRatio > 1.35 && aspectRatio <= 1.35) {
      const tw = Math.min(aW, bW);
      const th = Math.min(aH, bH);
      canvasPng = await normalizeContentSize(canvasPng, tw, th);
      refPng = await normalizeContentSize(refPng, tw, th);
      aligned = alignPair(canvasPng, refPng);
      cell = scoreCell(aligned, [], []);
      aW = aligned.aPlace?.content?.width ?? canvasPng.width;
      aH = aligned.aPlace?.content?.height ?? canvasPng.height;
      bW = aligned.bPlace?.content?.width ?? refPng.width;
      bH = aligned.bPlace?.content?.height ?? refPng.height;
      scaleRatio = Math.max(aW / bW, bW / aW, aH / bH, bH / aH);
      sizeNormalized = true;
    }
    const aaMasked = cell.pctAAMasked;
    const inkDelta = Math.abs((cell.inkCanvasPct ?? 0) - (cell.inkRealPct ?? 0));
    // Blank / near-blank refs must never pass (altitude avatar sm.off was 0% ink).
    const blankRef = (cell.inkRealPct ?? 0) < 1;
    const blankCanvas = (cell.inkCanvasPct ?? 0) < 0.25;
    // Framing-tolerant pass: when AA is already under the bar and ink mass
    // agrees, allow compositionOk even if showcase stage sizes differ
    // (site receipts / multi-cell representatives vs single VARIANT cells).
    // Framing-tolerant only when content footprints are still in the same
    // ballpark — otherwise hairline-vs-block (altitude divider) can false-pass.
    const framingTolerant =
      !blankRef &&
      !blankCanvas &&
      aaMasked != null &&
      aaMasked <= PASS_AA_MASKED &&
      inkDelta <= 10 &&
      scaleRatio <= 2.5 &&
      aspectRatio <= 1.5 &&
      (cell.inkCanvasPct ?? 0) >= 1 &&
      (cell.inkRealPct ?? 0) >= 1;
    const strictCompositionOk =
      !blankRef &&
      !blankCanvas &&
      (scaleRatio <= 1.35 || sizeNormalized) &&
      inkDelta <= 25 &&
      aspectRatio <= 1.35;
    const compositionOk = strictCompositionOk || framingTolerant;
    const pass =
      compositionOk &&
      aaMasked !== null &&
      aaMasked !== undefined &&
      aaMasked <= PASS_AA_MASKED;
    // Surface (never silently accept) the framingTolerant relaxation: a pass
    // that only holds because of it must say so on the scorecard.
    const reliedOnFramingTolerant = pass && framingTolerant && !strictCompositionOk;
    const diffPath = path.join(scoreDir, `${stem}.diff.png`);
    if (cell.diff && scorer.PNG) {
      writeFileSync(diffPath, scorer.PNG.sync.write(cell.diff));
    } else if (cell.diff) {
      // pngjs PNG from score module
      const { PNG } = await import("pngjs");
      writeFileSync(diffPath, PNG.sync.write(cell.diff));
    }

    const scorecard = {
      version: 3,
      status: pass ? "pass" : "fail",
      matchDeveloped: matchDevelopedReceipt,
      recommendMatchDeveloped: pass,
      passBar: { pctAAMaskedMax: PASS_AA_MASKED, compositionOk: true },
      metrics: {
        pctExactUnmasked: cell.pctExactUnmasked,
        pctAAUnmasked: cell.pctAAUnmasked,
        pctAAMasked: cell.pctAAMasked,
        maskCoveragePct: cell.maskCoveragePct,
        canvasPx: cell.canvasPx,
        realPx: cell.realPx,
        inkCanvasPct: cell.inkCanvasPct,
        inkRealPct: cell.inkRealPct,
      },
      reference: refRel,
      referenceSha256: sha256File(refPath),
      canvasShot: path.relative(ROOT, canvasPath),
      canvasShotSha256: sha256File(canvasPath),
      diff: path.relative(ROOT, diffPath),
      fc: Array.isArray(row.fc) ? row.fc : [],
      receipt: path.relative(ROOT, receiptPath),
      compositionOk,
      strictCompositionOk,
      framingTolerant,
      reliedOnFramingTolerant,
      scaleRatio,
      inkDelta,
      dprNormalized,
      sizeNormalized,
      note: !compositionOk
        ? `composition mismatch (scaleRatio=${scaleRatio.toFixed(2)}, inkDelta=${inkDelta.toFixed(1)}) — use 1× VARIANT cell vs gate-shot (not set shot / not pair-- receipt)`
        : pass
          ? reliedOnFramingTolerant
            ? "pixel bar met — PASS RELIED ON framingTolerant relaxation (stage sizes differ; ink mass agrees) — gate surfaces this"
            : "pixel bar met — receipt may claim visual pass; the evidence gate verifies against this scorecard"
          : aaMasked <= PASS_AA_MASKED + 1.5
            ? `near-pass (pctAAMasked=${aaMasked?.toFixed?.(2) ?? aaMasked}; likely font-AA) — NOT a pass; tighten emit (near-pass flips are dead)`
            : `pixel bar missed (pctAAMasked=${aaMasked?.toFixed?.(2) ?? aaMasked} > ${PASS_AA_MASKED})`,
      recordedAt: new Date().toISOString(),
    };
    writeFileSync(outPath, `${JSON.stringify(scorecard, null, 2)}\n`);
    wrote += 1;
    scored += 1;
    console.log(
      `${pass ? "✔" : "✖"} ${tag}: pctAAMasked=${Number(aaMasked).toFixed(2)}% (${scorecard.status}) → ${path.relative(ROOT, outPath)}`,
    );
  } catch (e) {
    notes.push(`score ${tag} failed: ${e.message}`);
    const scorecard = {
      version: 3,
      status: "error",
      matchDeveloped: matchDevelopedReceipt,
      reference: refRel,
      referenceSha256: existsSync(refPath) ? sha256File(refPath) : null,
      canvasShot: path.relative(ROOT, canvasPath),
      canvasShotSha256: existsSync(canvasPath) ? sha256File(canvasPath) : null,
      error: String(e && e.message ? e.message : e),
      fc: Array.isArray(row.fc) ? row.fc : [],
      receipt: path.relative(ROOT, receiptPath),
      recordedAt: new Date().toISOString(),
    };
    writeFileSync(outPath, `${JSON.stringify(scorecard, null, 2)}\n`);
    wrote += 1;
    console.warn(`⚠ ${tag}: score error — ${e.message}`);
  }
}

for (const n of notes) console.warn(`⚠ ${n}`);

console.log(
  `console-loop:developed-score: wrote ${wrote}, scored ${scored}, skipped ${skipped}`,
);
process.exit(0);
