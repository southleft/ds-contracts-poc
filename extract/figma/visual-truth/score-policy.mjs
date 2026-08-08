/**
 * Visual-truth scoring policy — the SAME bar and the SAME normalization /
 * composition-guard pipeline as scripts/console-loop-developed-score.mjs.
 *
 * Duplicated (not imported) because developed-score is a frozen top-level
 * script with no exports and may not be edited; the pixel core (alignPair /
 * scoreCell) is still the shared canvas-gate implementation, injected by the
 * caller. Any behavioral drift from developed-score's constants or guard
 * arithmetic is a bug — keep the two in lockstep:
 *   PASS_AA_MASKED 5 · WHITE_TRIM 250 · DPR window 1.7–2.4 · strict
 *   scaleRatio ≤ 1.35 · inkDelta ≤ 25 · framingTolerant inkDelta ≤ 10,
 *   scaleRatio ≤ 2.5, aspect ≤ 1.5, both inks ≥ 1 · blankRef < 1 ·
 *   blankCanvas < 0.25 · size-normalize when scaleRatio > 1.35 & aspect ≤ 1.35.
 */
import { PNG } from "pngjs";

export const PASS_AA_MASKED = 5;
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
function normalizeContentSize(png, tw, th) {
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

/**
 * True half downsample: pad odd dimensions to even (edge-replicate), then
 * 2×2 box-average. The previous floor-decimation dropped the final odd
 * row/column (a 31px 2× content box became 15px vs a 16px reference) and
 * discarded anti-aliasing entirely, so honest canvas matches failed on
 * instrument noise (altitude heading/icon-close). Round-half-up dimensions +
 * averaging are applied identically to whichever side of the pair is
 * downscaled — the bar itself is unchanged.
 */
function downscale2x(src) {
  const w = Math.max(1, Math.ceil(src.width / 2));
  const h = Math.max(1, Math.ceil(src.height / 2));
  const out = new PNG({ width: w, height: h });
  const clampX = (x) => Math.min(src.width - 1, x);
  const clampY = (y) => Math.min(src.height - 1, y);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const di = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const si = (clampY(y * 2 + dy) * src.width + clampX(x * 2 + dx)) * 4;
          sum += src.data[si + c];
        }
        out.data[di + c] = Math.round(sum / 4);
      }
    }
  }
  return out;
}

/**
 * Score one canvas-vs-reference pair under the one bar. alignPair/scoreCell
 * are the canvas-gate implementations (extract/figma/canvas-gate/score.ts),
 * injected so this module stays plain-node loadable.
 */
export function scoreStemPair(canvasIn, refIn, { alignPair, scoreCell }) {
  let canvasPng = canvasIn;
  let refPng = refIn;

  // Whole-image DPR guard: normally both sides are @1× (REST scale=1 like the
  // bridge exports); a genuine 2×-vs-1× pair still gets halved here.
  const roughScale = Math.max(
    canvasPng.width / refPng.width,
    refPng.width / canvasPng.width,
    canvasPng.height / refPng.height,
    refPng.height / canvasPng.height,
  );
  let dprNormalized = false;
  if (roughScale >= 1.7 && roughScale <= 2.4) {
    if (canvasPng.width * canvasPng.height > refPng.width * refPng.height) {
      canvasPng = downscale2x(canvasPng);
    } else {
      refPng = downscale2x(refPng);
    }
    dprNormalized = true;
  }

  let aligned = alignPair(canvasPng, refPng);
  let cell = scoreCell(aligned, [], []);
  let aW = aligned.aPlace?.content?.width ?? canvasPng.width;
  let aH = aligned.aPlace?.content?.height ?? canvasPng.height;
  let bW = aligned.bPlace?.content?.width ?? refPng.width;
  let bH = aligned.bPlace?.content?.height ?? refPng.height;
  let scaleRatio = Math.max(aW / bW, bW / aW, aH / bH, bH / aH);

  // Content-box DPR re-check (whole-image sizes can hide a 2× content delta).
  if (scaleRatio >= 1.7 && scaleRatio <= 2.4 && !dprNormalized) {
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

  // Same-aspect stage-size mismatch: scale both content boxes to the smaller
  // footprint so AA measures shape/paint, not stage size.
  let sizeNormalized = false;
  const aspectA = aW / Math.max(1, aH);
  const aspectB = bW / Math.max(1, bH);
  const aspectRatio = Math.max(aspectA / aspectB, aspectB / aspectA);
  if (scaleRatio > 1.35 && aspectRatio <= 1.35) {
    const tw = Math.min(aW, bW);
    const th = Math.min(aH, bH);
    canvasPng = normalizeContentSize(canvasPng, tw, th);
    refPng = normalizeContentSize(refPng, tw, th);
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
  const blankRef = (cell.inkRealPct ?? 0) < 1;
  const blankCanvas = (cell.inkCanvasPct ?? 0) < 0.25;
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
  const reliedOnFramingTolerant = pass && framingTolerant && !strictCompositionOk;

  return {
    cell,
    pass,
    compositionOk,
    strictCompositionOk,
    framingTolerant,
    reliedOnFramingTolerant,
    scaleRatio,
    aspectRatio,
    inkDelta,
    dprNormalized,
    sizeNormalized,
    aaMasked,
  };
}
