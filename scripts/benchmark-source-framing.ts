import { PNG } from "pngjs";

/**
 * Source framing for the React → Figma image comparison
 * (scripts/benchmark-source-native-compare.ts). Owner decision, 2026-09-27: a
 * fractional source root box is SNAPPED OUTWARD to the smallest whole-pixel box
 * that contains it, then scored under the unchanged 5% rule; the snap is
 * recorded in the comparison as `sourceFraming`. An integer box is its own
 * snap, so its crop is exactly the previous one.
 */
export function snapOutward(off: {x: number; y: number}, box: {width: number; height: number}) {
  if (![off.x, off.y, box.width, box.height].every(Number.isFinite) || box.width <= 0 || box.height <= 0) throw Error('source root box invalid');
  const x = Math.floor(off.x), y = Math.floor(off.y);
  const width = Math.ceil(off.x + box.width) - x, height = Math.ceil(off.y + box.height) - y;
  return {x, y, width, height, fractional: ![off.x, off.y, box.width, box.height].every(Number.isInteger)};
}

type Box = {x: number; y: number; width: number; height: number};

/** Every pixel with any alpha: the extent of what the source paints. */
export function paintBox(png: {width: number; height: number; data: Uint8Array | Buffer}): Box | null {
  let x0 = png.width, y0 = png.height, x1 = -1, y1 = -1;
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++)
    if (png.data[(y * png.width + x) * 4 + 3] !== 0) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return x1 < 0 ? null : {x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1};
}

/** The smallest box containing both (effects included: owner decision, 2026-09-27). */
export function unionBox(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return {x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y};
}

/** Effects included (owner decision, 2026-09-27): place both rasters at the
 *  given integer offsets, crop to the union of their painted pixels and
 *  composite each over the shared background. A copy of the compositing in
 *  scripts/design-consumer-framing.ts alignRecordedFrames, whose bytes are
 *  pinned by recorded matched-capture evidence and so are not refactored. */
export function alignAtOffsets(ours: PNG, theirs: PNG, at: {x: number; y: number}, bt: {x: number; y: number}, background: 0 | 255) {
  if (![at.x, at.y, bt.x, bt.y].every(Number.isInteger)) return { refused: 'fractional-layout-translation' } as const;
  const aInk = paintBox(ours),
    bInk = paintBox(theirs);
  const extents = [
    aInk && { ...aInk, x: aInk.x + at.x, y: aInk.y + at.y },
    bInk && { ...bInk, x: bInk.x + bt.x, y: bInk.y + bt.y },
  ].filter((b): b is Box => b !== null);
  if (!extents.length) return { refused: "comparison-has-no-paint" };
  const left = Math.min(...extents.map((b) => b.x)),
    top = Math.min(...extents.map((b) => b.y));
  const width = Math.max(...extents.map((b) => b.x + b.width)) - left,
    height = Math.max(...extents.map((b) => b.y + b.height)) - top;
  const render = (src: PNG, offset: { x: number; y: number }) => {
    const out = new PNG({ width, height });
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const sx = x + left - offset.x,
          sy = y + top - offset.y,
          di = (y * width + x) * 4;
        const inside = sx >= 0 && sy >= 0 && sx < src.width && sy < src.height;
        const si = (sy * src.width + sx) * 4,
          alpha = inside ? src.data[si + 3] / 255 : 0;
        for (let channel = 0; channel < 3; channel++)
          out.data[di + channel] = Math.round(
            (inside ? src.data[si + channel] : 0) * alpha +
              background * (1 - alpha),
          );
        out.data[di + 3] = 255;
      }
    return out;
  };
  return {
    aligned: {
      a: render(ours, at),
      b: render(theirs, bt),
      width,
      height,
      aContent: { width: aInk?.width ?? 0, height: aInk?.height ?? 0 },
      bContent: { width: bInk?.width ?? 0, height: bInk?.height ?? 0 },
      aOffset: at,
      aTrimOrigin: { x: left, y: top },
    },
    placement: {
      consumer: at,
      figma: bt,
      commonCrop: { x: left, y: top, width, height },
    },
  };
}

type Rect = { x: number; y: number; width: number; height: number };
/** Width and height of the union of text boxes, or null when there is no text. */
export function textExtent(rects: Rect[]): { width: number; height: number } | null {
  if (!rects.length) return null;
  const left = Math.min(...rects.map(r => r.x)), top = Math.min(...rects.map(r => r.y));
  return { width: Math.max(...rects.map(r => r.x + r.width)) - left, height: Math.max(...rects.map(r => r.y + r.height)) - top };
}

/** A root size difference is the text's own when, on every axis where the two
 *  root boxes differ, they differ by exactly what the two texts' extents
 *  differ by (Figma and the browser setting the same glyphs with different
 *  advances). Any other size difference is not attributed to text. */
export function sizeDifferenceFromText(sourceSize: [number, number], nativeSize: [number, number],
  sourceText: { width: number; height: number } | null, nativeText: { width: number; height: number } | null): boolean {
  if (!sourceText || !nativeText) return false;
  const text = [nativeText.width - sourceText.width, nativeText.height - sourceText.height];
  return [0, 1].every(i => {
    const root = nativeSize[i] - sourceSize[i];
    return root === 0 || Math.abs(root - text[i]) < 1 / 64;
  });
}
