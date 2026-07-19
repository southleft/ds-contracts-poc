/**
 * Pixel scoring — pngjs + pixelmatch, adapted from the visual-parity img.ts
 * discipline (content-box trim on transparent PNGs, center-pad onto a shared
 * UNION canvas — never resampled, never cropped-to-match: a size delta stays
 * in the diff), extended with:
 *   · THREE operating points per cell:
 *       pctExactUnmasked — pixelmatch threshold 0, includeAA true (every
 *         differing pixel counts, antialiasing included);
 *       pctAAUnmasked    — threshold 0.1, includeAA false (pixelmatch's
 *         antialiasing classifier excludes AA pixels — a principled
 *         per-pixel test, not a fudge factor);
 *       pctAAMasked      — the AA point with text regions excluded from
 *         numerator AND denominator (both sides' DOM text client rects,
 *         inflated 4 device px — the img.ts masking policy; the canvas
 *         engine draws Inter while real Polaris resolves its own stack, a
 *         NAMED runtime difference).
 *   · mask rects from BOTH sides (fonts differ → glyph boxes differ).
 *   · labeled side-by-side receipt PNGs: "CANVAS ENGINE" / "REAL POLARIS"
 *     drawn into the image margin with a 5×7 bitmap font.
 */
import { writeFileSync } from 'node:fs';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import type { Rect } from './shots.js';

/** Content = any pixel meaningfully below white (both sides screenshot over
 *  the same white surface; translucent fills — Polaris disabled washes at 5%
 *  black ≈ rgb(242) — must survive the trim, so the floor sits at 250). */
const WHITE_TRIM = 250;
const MASK_INFLATE = 4;

export const readPngBuffer = (buf: Buffer): PNG => PNG.sync.read(buf);

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function contentBox(png: PNG): Box {
  let minX = png.width, minY = png.height, maxX = -1, maxY = -1;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4;
      const ink =
        png.data[i + 3] > 16 &&
        (png.data[i] < WHITE_TRIM || png.data[i + 1] < WHITE_TRIM || png.data[i + 2] < WHITE_TRIM);
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

interface SidePlacement {
  /** Trimmed content size (device px). */
  content: { width: number; height: number };
  /** Where the content landed on the union canvas. */
  offset: { x: number; y: number };
  /** Trim origin in the ORIGINAL image (mask-rect transform). */
  trimOrigin: { x: number; y: number };
}

export interface Aligned {
  a: PNG;
  b: PNG;
  width: number;
  height: number;
  aPlace: SidePlacement;
  bPlace: SidePlacement;
}

function blitOnWhite(dst: PNG, src: PNG, box: Box, dx: number, dy: number): void {
  for (let y = 0; y < box.height; y++) {
    for (let x = 0; x < box.width; x++) {
      const si = ((box.y + y) * src.width + (box.x + x)) * 4;
      const di = ((dy + y) * dst.width + (dx + x)) * 4;
      const alpha = src.data[si + 3] / 255;
      dst.data[di] = Math.round(src.data[si] * alpha + 255 * (1 - alpha));
      dst.data[di + 1] = Math.round(src.data[si + 1] * alpha + 255 * (1 - alpha));
      dst.data[di + 2] = Math.round(src.data[si + 2] * alpha + 255 * (1 - alpha));
      dst.data[di + 3] = 255;
    }
  }
}

const whiteCanvas = (width: number, height: number): PNG => {
  const png = new PNG({ width, height });
  png.data.fill(255);
  return png;
};

export function alignPair(canvasPng: PNG, realPng: PNG): Aligned {
  const boxA = contentBox(canvasPng);
  const boxB = contentBox(realPng);
  const width = Math.max(boxA.width, boxB.width);
  const height = Math.max(boxA.height, boxB.height);
  const a = whiteCanvas(width, height);
  const b = whiteCanvas(width, height);
  const aOffset = { x: Math.floor((width - boxA.width) / 2), y: Math.floor((height - boxA.height) / 2) };
  const bOffset = { x: Math.floor((width - boxB.width) / 2), y: Math.floor((height - boxB.height) / 2) };
  blitOnWhite(a, canvasPng, boxA, aOffset.x, aOffset.y);
  blitOnWhite(b, realPng, boxB, bOffset.x, bOffset.y);
  return {
    a,
    b,
    width,
    height,
    aPlace: { content: { width: boxA.width, height: boxA.height }, offset: aOffset, trimOrigin: { x: boxA.x, y: boxA.y } },
    bPlace: { content: { width: boxB.width, height: boxB.height }, offset: bOffset, trimOrigin: { x: boxB.x, y: boxB.y } },
  };
}

/** Union text mask from both sides' rects, each transformed through its own
 *  side's trim origin + union-canvas offset, inflated MASK_INFLATE. */
function buildMask(aligned: Aligned, aRects: Rect[], bRects: Rect[]): Uint8Array {
  const mask = new Uint8Array(aligned.width * aligned.height);
  const paint = (rects: Rect[], place: SidePlacement) => {
    for (const r of rects) {
      const x0 = Math.max(0, Math.floor(r.x - place.trimOrigin.x + place.offset.x - MASK_INFLATE));
      const y0 = Math.max(0, Math.floor(r.y - place.trimOrigin.y + place.offset.y - MASK_INFLATE));
      const x1 = Math.min(aligned.width, Math.ceil(r.x - place.trimOrigin.x + place.offset.x + r.width + MASK_INFLATE));
      const y1 = Math.min(aligned.height, Math.ceil(r.y - place.trimOrigin.y + place.offset.y + r.height + MASK_INFLATE));
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) mask[y * aligned.width + x] = 1;
    }
  };
  paint(aRects, aligned.aPlace);
  paint(bRects, aligned.bPlace);
  return mask;
}

export interface CellScore {
  pctExactUnmasked: number;
  pctAAUnmasked: number;
  /** null when the mask covers the whole union canvas. */
  pctAAMasked: number | null;
  maskCoveragePct: number;
  /** Content sizes, device px — the size-delta receipt. */
  canvasPx: string;
  realPx: string;
  /** Share of each side's union canvas that is INK (non-near-white) — a
   *  blank canvas side can score a deceptively low diff %, so the ink
   *  fractions are quoted alongside every score. */
  inkCanvasPct: number;
  inkRealPct: number;
  diff: PNG;
}

function inkPct(png: PNG): number {
  let n = 0;
  const total = png.width * png.height;
  for (let p = 0; p < total; p++) {
    const i = p * 4;
    if (png.data[i] < WHITE_TRIM || png.data[i + 1] < WHITE_TRIM || png.data[i + 2] < WHITE_TRIM) n++;
  }
  return (n / total) * 100;
}

export function scoreCell(aligned: Aligned, aRects: Rect[], bRects: Rect[]): CellScore {
  const { a, b, width, height } = aligned;
  const total = width * height;

  const diff = new PNG({ width, height });
  const exactCount = pixelmatch(a.data, b.data, undefined, width, height, { threshold: 0, includeAA: true });
  const aaCount = pixelmatch(a.data, b.data, diff.data, width, height, { threshold: 0.1, includeAA: false });

  const mask = buildMask(aligned, aRects, bRects);
  let maskPixels = 0;
  const am = new PNG({ width, height });
  const bm = new PNG({ width, height });
  a.data.copy(am.data);
  b.data.copy(bm.data);
  for (let p = 0; p < total; p++) {
    if (mask[p] === 0) continue;
    maskPixels++;
    const i = p * 4;
    am.data[i] = bm.data[i] = 127;
    am.data[i + 1] = bm.data[i + 1] = 127;
    am.data[i + 2] = bm.data[i + 2] = 127;
    am.data[i + 3] = bm.data[i + 3] = 255;
  }
  const maskedDenom = total - maskPixels;
  const maskedCount =
    maskPixels === 0 ? aaCount : pixelmatch(am.data, bm.data, undefined, width, height, { threshold: 0.1, includeAA: false });

  return {
    pctExactUnmasked: (exactCount / total) * 100,
    pctAAUnmasked: (aaCount / total) * 100,
    pctAAMasked: maskedDenom > 0 ? (maskedCount / maskedDenom) * 100 : null,
    maskCoveragePct: (maskPixels / total) * 100,
    canvasPx: `${aligned.aPlace.content.width}x${aligned.aPlace.content.height}`,
    realPx: `${aligned.bPlace.content.width}x${aligned.bPlace.content.height}`,
    inkCanvasPct: inkPct(a),
    inkRealPct: inkPct(b),
    diff,
  };
}

// ---------------------------------------------------------------------------
// Labeled receipt PNG — labels drawn INTO the image margin (5×7 bitmap font)
// ---------------------------------------------------------------------------

/** Minimal 5×7 bitmap font (uppercase + digits + a few marks). Each glyph is
 *  7 rows of 5 chars; '#' = ink. */
const FONT: Record<string, string[]> = {
  A: [' ### ', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'],
  B: ['#### ', '#   #', '#   #', '#### ', '#   #', '#   #', '#### '],
  C: [' ####', '#    ', '#    ', '#    ', '#    ', '#    ', ' ####'],
  D: ['#### ', '#   #', '#   #', '#   #', '#   #', '#   #', '#### '],
  E: ['#####', '#    ', '#    ', '#### ', '#    ', '#    ', '#####'],
  F: ['#####', '#    ', '#    ', '#### ', '#    ', '#    ', '#    '],
  G: [' ####', '#    ', '#    ', '#  ##', '#   #', '#   #', ' ### '],
  H: ['#   #', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'],
  I: ['#####', '  #  ', '  #  ', '  #  ', '  #  ', '  #  ', '#####'],
  K: ['#   #', '#  # ', '# #  ', '##   ', '# #  ', '#  # ', '#   #'],
  L: ['#    ', '#    ', '#    ', '#    ', '#    ', '#    ', '#####'],
  M: ['#   #', '## ##', '# # #', '#   #', '#   #', '#   #', '#   #'],
  N: ['#   #', '##  #', '# # #', '#  ##', '#   #', '#   #', '#   #'],
  O: [' ### ', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '],
  P: ['#### ', '#   #', '#   #', '#### ', '#    ', '#    ', '#    '],
  R: ['#### ', '#   #', '#   #', '#### ', '# #  ', '#  # ', '#   #'],
  S: [' ####', '#    ', '#    ', ' ### ', '    #', '    #', '#### '],
  T: ['#####', '  #  ', '  #  ', '  #  ', '  #  ', '  #  ', '  #  '],
  U: ['#   #', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '],
  V: ['#   #', '#   #', '#   #', '#   #', '#   #', ' # # ', '  #  '],
  W: ['#   #', '#   #', '#   #', '#   #', '# # #', '## ##', '#   #'],
  X: ['#   #', '#   #', ' # # ', '  #  ', ' # # ', '#   #', '#   #'],
  Y: ['#   #', '#   #', ' # # ', '  #  ', '  #  ', '  #  ', '  #  '],
  ' ': ['     ', '     ', '     ', '     ', '     ', '     ', '     '],
  '=': ['     ', '     ', '#####', '     ', '#####', '     ', '     '],
  '-': ['     ', '     ', '     ', '#####', '     ', '     ', '     '],
  '.': ['     ', '     ', '     ', '     ', '     ', '  ## ', '  ## '],
  '0': [' ### ', '#   #', '#  ##', '# # #', '##  #', '#   #', ' ### '],
  '1': ['  #  ', ' ##  ', '  #  ', '  #  ', '  #  ', '  #  ', '#####'],
  '2': [' ### ', '#   #', '    #', '   # ', '  #  ', ' #   ', '#####'],
  '3': [' ### ', '#   #', '    #', '  ## ', '    #', '#   #', ' ### '],
  '4': ['   # ', '  ## ', ' # # ', '#  # ', '#####', '   # ', '   # '],
  '5': ['#####', '#    ', '#### ', '    #', '    #', '#   #', ' ### '],
  '6': [' ### ', '#    ', '#### ', '#   #', '#   #', '#   #', ' ### '],
  '7': ['#####', '    #', '   # ', '  #  ', '  #  ', '  #  ', '  #  '],
  '8': [' ### ', '#   #', '#   #', ' ### ', '#   #', '#   #', ' ### '],
  '9': [' ### ', '#   #', '#   #', ' ####', '    #', '    #', ' ### '],
};

function drawText(png: PNG, text: string, x0: number, y0: number, scale: number, rgb: [number, number, number]): void {
  let cx = x0;
  for (const raw of text.toUpperCase()) {
    const glyph = FONT[raw] ?? FONT[' '];
    for (let gy = 0; gy < 7; gy++) {
      for (let gx = 0; gx < 5; gx++) {
        if (glyph[gy][gx] !== '#') continue;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const px = cx + gx * scale + sx;
            const py = y0 + gy * scale + sy;
            if (px < 0 || py < 0 || px >= png.width || py >= png.height) continue;
            const i = (py * png.width + px) * 4;
            png.data[i] = rgb[0];
            png.data[i + 1] = rgb[1];
            png.data[i + 2] = rgb[2];
            png.data[i + 3] = 255;
          }
        }
      }
    }
    cx += 6 * scale;
  }
}

/** canvas | real (| diff) side by side, labels in the top margin. */
export function writeReceipt(outPath: string, aligned: Aligned, diff: PNG, cellName: string): void {
  const gutter = 16;
  const header = 40;
  const footer = 26;
  const { width, height } = aligned;
  const canvas = whiteCanvas(width * 3 + gutter * 2, height + header + footer);
  const blit = (src: PNG, dx: number) => {
    for (let y = 0; y < height; y++) {
      const si = y * width * 4;
      src.data.copy(canvas.data, ((y + header) * canvas.width + dx) * 4, si, si + width * 4);
    }
  };
  blit(aligned.a, 0);
  blit(aligned.b, width + gutter);
  blit(diff, (width + gutter) * 2);
  // gutter separators
  for (let y = header; y < header + height; y++) {
    for (const gx of [width + Math.floor(gutter / 2), width * 2 + gutter + Math.floor(gutter / 2)]) {
      const i = (y * canvas.width + gx) * 4;
      canvas.data[i] = canvas.data[i + 1] = canvas.data[i + 2] = 220;
    }
  }
  const scale = 2;
  drawText(canvas, 'CANVAS ENGINE', 2, 8, scale, [30, 30, 30]);
  drawText(canvas, 'REAL POLARIS', width + gutter + 2, 8, scale, [30, 30, 30]);
  drawText(canvas, 'DIFF', (width + gutter) * 2 + 2, 8, scale, [30, 30, 30]);
  drawText(canvas, cellName.replace(/[^a-z0-9= .-]/gi, '').slice(0, Math.floor((canvas.width - 4) / (6 * 1))), 2, height + header + 8, 1, [90, 90, 90]);
  writeFileSync(outPath, PNG.sync.write(canvas));
}
