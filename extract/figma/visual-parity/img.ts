/**
 * Pixel plumbing — pngjs + pixelmatch, no engine code.
 *
 * Normalization is CONTENT-BOX cropping: both PNGs arrive with transparent
 * backgrounds (our screenshot omits the body background; Figma's component
 * export is transparent outside the node), so trimming alpha≤16 edges aligns
 * both images on their painted content, DPR already matched at 2x. The pair
 * is then CENTER-padded onto a shared white canvas — never resampled, so a
 * size delta stays visible as a real mismatch and is reported in device px.
 *
 * Two scores per pair, both printed, no silent tolerance:
 *   · unmasked — every pixel counts (pixelmatch threshold 0.1, its
 *     antialiasing detector ON — a principled per-pixel classifier, not a
 *     fudge factor).
 *   · masked   — the SAME diff with text-node regions (DOM client rects,
 *     inflated 4 device px) excluded from numerator AND denominator: the
 *     honest "everything but text rasterization" number for families the
 *     local renderer cannot reproduce.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import type { Rect } from './render.js';

const ALPHA_TRIM = 16;
const MASK_INFLATE = 4; // device px around each text rect

export const readPng = (source: string | Buffer): PNG =>
  PNG.sync.read(typeof source === 'string' ? readFileSync(source) : source);

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Bounding box of pixels with alpha > ALPHA_TRIM (full image when none). */
export function contentBox(png: PNG): Box {
  let minX = png.width, minY = png.height, maxX = -1, maxY = -1;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      if (png.data[(y * png.width + x) * 4 + 3] > ALPHA_TRIM) {
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

export interface Aligned {
  a: PNG;
  b: PNG;
  width: number;
  height: number;
  /** Content size of each side BEFORE padding (device px) — the size-delta receipt. */
  aContent: { width: number; height: number };
  bContent: { width: number; height: number };
  /** Where a's trimmed content landed on the shared canvas. */
  aOffset: { x: number; y: number };
  /** a's trim origin in its ORIGINAL image (for mask-rect transforms). */
  aTrimOrigin: { x: number; y: number };
}

/** Copy src's box onto a white canvas at (dx, dy), alpha-flattened. */
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

export function alignPair(ours: PNG, figma: PNG): Aligned {
  const boxA = contentBox(ours);
  const boxB = contentBox(figma);
  const width = Math.max(boxA.width, boxB.width);
  const height = Math.max(boxA.height, boxB.height);
  const a = whiteCanvas(width, height);
  const b = whiteCanvas(width, height);
  const aOffset = { x: Math.floor((width - boxA.width) / 2), y: Math.floor((height - boxA.height) / 2) };
  const bOffset = { x: Math.floor((width - boxB.width) / 2), y: Math.floor((height - boxB.height) / 2) };
  blitOnWhite(a, ours, boxA, aOffset.x, aOffset.y);
  blitOnWhite(b, figma, boxB, bOffset.x, bOffset.y);
  return {
    a,
    b,
    width,
    height,
    aContent: { width: boxA.width, height: boxA.height },
    bContent: { width: boxB.width, height: boxB.height },
    aOffset,
    aTrimOrigin: { x: boxA.x, y: boxA.y },
  };
}

export interface DiffResult {
  /** Mismatched pixels / all pixels, percent. */
  unmaskedPct: number;
  /** Mismatched non-text pixels / non-text pixels, percent (null when the
   *  mask covers everything). */
  maskedPct: number | null;
  /** Share of the canvas the text mask covers, percent. */
  maskCoveragePct: number;
  diff: PNG;
  diffCount: number;
  /** Bounding box of mismatched pixels (unmasked run), null when clean. */
  diffBox: Box | null;
}

/** Boolean mask (width×height) from text rects in OUR image's original
 *  coordinates, transformed onto the aligned canvas and inflated. */
function buildMask(aligned: Aligned, textRects: Rect[]): Uint8Array {
  const mask = new Uint8Array(aligned.width * aligned.height);
  for (const r of textRects) {
    const x0 = Math.max(0, Math.floor(r.x - aligned.aTrimOrigin.x + aligned.aOffset.x - MASK_INFLATE));
    const y0 = Math.max(0, Math.floor(r.y - aligned.aTrimOrigin.y + aligned.aOffset.y - MASK_INFLATE));
    const x1 = Math.min(aligned.width, Math.ceil(x0 + r.width + 2 * MASK_INFLATE));
    const y1 = Math.min(aligned.height, Math.ceil(y0 + r.height + 2 * MASK_INFLATE));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) mask[y * aligned.width + x] = 1;
  }
  return mask;
}

export function diffPair(aligned: Aligned, textRects: Rect[]): DiffResult {
  const { a, b, width, height } = aligned;
  const total = width * height;

  const diff = new PNG({ width, height });
  const diffCount = pixelmatch(a.data, b.data, diff.data, width, height, { threshold: 0.1 });

  // Diff bounding box from the diff bitmap (pixelmatch paints mismatches red
  // #ff0000; anti-aliased detections yellow — excluded from the box).
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (diff.data[i] === 255 && diff.data[i + 1] === 0 && diff.data[i + 2] === 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const diffBox: Box | null =
    maxX >= 0 ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } : null;

  // Masked run: paint text regions identical mid-gray on COPIES, re-diff,
  // and take masked pixels out of the denominator too.
  const mask = buildMask(aligned, textRects);
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
    maskPixels === 0
      ? diffCount
      : pixelmatch(am.data, bm.data, undefined, width, height, { threshold: 0.1 });

  return {
    unmaskedPct: (diffCount / total) * 100,
    maskedPct: maskedDenom > 0 ? (maskedCount / maskedDenom) * 100 : null,
    maskCoveragePct: (maskPixels / total) * 100,
    diff,
    diffCount,
    diffBox,
  };
}

/** ours | figma | diff on one white canvas, 12px gutters, no resampling. */
export function writeTriptych(outPath: string, aligned: Aligned, diff: PNG): void {
  const gutter = 12;
  const { width, height } = aligned;
  const canvas = whiteCanvas(width * 3 + gutter * 2, height);
  const blit = (src: PNG, dx: number) => {
    for (let y = 0; y < height; y++) {
      const si = y * width * 4;
      src.data.copy(canvas.data, (y * canvas.width + dx) * 4, si, si + width * 4);
    }
  };
  blit(aligned.a, 0);
  blit(aligned.b, width + gutter);
  blit(diff, (width + gutter) * 2);
  writeFileSync(outPath, PNG.sync.write(canvas));
}

/** Mean RGB of non-white-ish pixels — the "overall ink" heuristic input. */
export function meanInk(png: PNG): { r: number; g: number; b: number; n: number } {
  let r = 0, g = 0, b = 0, n = 0;
  for (let p = 0; p < png.width * png.height; p++) {
    const i = p * 4;
    if (png.data[i] > 245 && png.data[i + 1] > 245 && png.data[i + 2] > 245) continue;
    r += png.data[i];
    g += png.data[i + 1];
    b += png.data[i + 2];
    n++;
  }
  return n === 0 ? { r: 255, g: 255, b: 255, n } : { r: r / n, g: g / n, b: b / n, n };
}
