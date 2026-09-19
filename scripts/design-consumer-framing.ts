/** A consumer comparison with recorded layout origins, never an ink alignment
 * search. Historical alpha-trim comparisons remain a separate measurement. */
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { PNG } from "pngjs";
import type { Aligned } from "../extract/figma/visual-parity/img.js";

export interface FrameBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface ConsumerFrame {
  layout: FrameBox;
  capture: FrameBox;
  deviceScaleFactor: number;
  pngSha256: string;
}
export interface FigmaFrame {
  layout: FrameBox;
  render: FrameBox;
  pngSha256: string;
}
export interface FramePlacement {
  consumer: { x: number; y: number };
  figma: { x: number; y: number };
  commonCrop: FrameBox;
}
export type FramedPair =
  { aligned: Aligned; placement: FramePlacement } | { refused: string };
export const imageSha256 = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
export const enclosingFrame = (box: FrameBox): FrameBox => ({
  x: Math.floor(box.x),
  y: Math.floor(box.y),
  width: Math.ceil(box.x + box.width) - Math.floor(box.x),
  height: Math.ceil(box.y + box.height) - Math.floor(box.y),
});
const validBox = (box: FrameBox | undefined): box is FrameBox =>
  !!box &&
  [box.x, box.y, box.width, box.height].every(Number.isFinite) &&
  box.width > 0 &&
  box.height > 0;
const sameBox = (a: FrameBox, b: FrameBox) =>
  ["x", "y", "width", "height"].every(
    (k) => a[k as keyof FrameBox] === b[k as keyof FrameBox],
  );

/** Unlike historical alpha>16 trimming, retain every nonzero-alpha pixel.
 * Pale paint and missing outlines must not disappear from the common crop. */
function inkBox(png: PNG): FrameBox | null {
  let x0 = png.width,
    y0 = png.height,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < png.height; y++)
    for (let x = 0; x < png.width; x++) {
      if (png.data[(y * png.width + x) * 4 + 3] === 0) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  return x1 < 0
    ? null
    : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/** At scale one, map PNG pixels to the two observed layout coordinate systems.
 * Refuse unsupported capture spans and fractional translations. Then crop one
 * shared union of painted pixels. No resizing, independent trimming, searching,
 * glyph masking, extra transparent padding or tolerance occurs here. */
export function alignRecordedFrames(
  consumerBytes: Buffer,
  figmaBytes: Buffer,
  consumer: ConsumerFrame | undefined,
  figma: FigmaFrame | undefined,
  background: 0 | 255,
): FramedPair {
  if (
    !consumer ||
    !figma ||
    !validBox(consumer.layout) ||
    !validBox(consumer.capture) ||
    !validBox(figma.layout) ||
    !validBox(figma.render)
  )
    return { refused: "layout-origin-not-recorded" };
  if (consumer.deviceScaleFactor !== 1)
    return { refused: "consumer-scale-not-one" };
  if (
    imageSha256(consumerBytes) !== consumer.pngSha256 ||
    imageSha256(figmaBytes) !== figma.pngSha256
  )
    return { refused: "image-frame-hash-mismatch" };
  const ours = PNG.sync.read(consumerBytes),
    theirs = PNG.sync.read(figmaBytes);
  const capture = enclosingFrame(consumer.layout),
    exported = enclosingFrame(figma.render);
  if (!sameBox(consumer.capture, capture))
    return { refused: "consumer-capture-span-mismatch" };
  if (ours.width !== capture.width || ours.height !== capture.height)
    return { refused: "consumer-image-span-mismatch" };
  if (theirs.width !== exported.width || theirs.height !== exported.height)
    return { refused: "figma-image-span-mismatch" };
  // The browser instrument captures the root layout box. It cannot qualify a
  // Figma export with shadows/outlines beyond that box by clipping them away.
  if (
    figma.render.x < figma.layout.x ||
    figma.render.y < figma.layout.y ||
    figma.render.x + figma.render.width > figma.layout.x + figma.layout.width ||
    figma.render.y + figma.render.height > figma.layout.y + figma.layout.height
  )
    return { refused: "render-outside-layout-capture-unqualified" };
  const ca = {
    x: consumer.layout.x - capture.x,
    y: consumer.layout.y - capture.y,
  };
  const fa = { x: figma.layout.x - exported.x, y: figma.layout.y - exported.y };
  const origin = { x: Math.max(ca.x, fa.x), y: Math.max(ca.y, fa.y) };
  const at = { x: origin.x - ca.x, y: origin.y - ca.y },
    bt = { x: origin.x - fa.x, y: origin.y - fa.y };
  if (![at.x, at.y, bt.x, bt.y].every(Number.isInteger))
    return { refused: "fractional-layout-translation" };
  const aInk = inkBox(ours),
    bInk = inkBox(theirs);
  const extents = [
    aInk && { ...aInk, x: aInk.x + at.x, y: aInk.y + at.y },
    bInk && { ...bInk, x: bInk.x + bt.x, y: bInk.y + bt.y },
  ].filter((b): b is FrameBox => b !== null);
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

export function figmaFramesFromSnapshots(
  before: any,
  after: any,
  images: Record<string, Buffer>,
): { frames: Record<string, FigmaFrame>; refused?: string } {
  if (
    typeof before?.version !== "string" ||
    !before.version ||
    typeof after?.version !== "string"
  )
    return { frames: {}, refused: "figma-file-version-not-recorded" };
  if (
    before.version !== after.version ||
    before.lastModified !== after.lastModified
  )
    return { frames: {}, refused: "figma-file-changed-during-export" };
  const frames: Record<string, FigmaFrame> = {};
  for (const [id, bytes] of Object.entries(images)) {
    const a = before.nodes?.[id]?.document,
      b = after.nodes?.[id]?.document;
    if (
      a?.id !== id ||
      b?.id !== id ||
      !validBox(a.absoluteBoundingBox) ||
      !validBox(a.absoluteRenderBounds) ||
      !validBox(b.absoluteBoundingBox) ||
      !validBox(b.absoluteRenderBounds)
    )
      return { frames: {}, refused: "figma-export-bounds-not-recorded:" + id };
    if (
      !sameBox(a.absoluteBoundingBox, b.absoluteBoundingBox) ||
      !sameBox(a.absoluteRenderBounds, b.absoluteRenderBounds)
    )
      return {
        frames: {},
        refused: "figma-bounds-changed-during-export:" + id,
      };
    if (!isDeepStrictEqual(a, b))
      return { frames: {}, refused: "figma-node-changed-during-export:" + id };
    frames[id] = {
      layout: a.absoluteBoundingBox,
      render: a.absoluteRenderBounds,
      pngSha256: imageSha256(bytes),
    };
  }
  return { frames };
}
