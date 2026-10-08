/** REST consumer framing v2: quantize Figma float32 bounds to browser layout
 * units when qualifying REST exports. The original design-consumer-framing.ts
 * remains byte-identical because recorded native evidence authenticates it.
 * Thresholds, image scoring, and historical native measurements are unchanged. */
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
import type {RenderExportProof} from "./design-consumer-render-export.js";

export interface ConsumerFrame {
  raster?: {kind:"browser-paint-extent-v1";paint:FrameBox};
  layout: FrameBox;
  capture: FrameBox;
  deviceScaleFactor: number;
  pngSha256: string;
}
export interface FigmaFrame {
  refused?: string;
  layout: FrameBox;
  render: FrameBox;
  pngSha256: string;
  /** Only attached by a producer that explicitly requested full node bounds.
   * Earlier receipts retain their original absolute-span interpretation. */
  raster?: { kind: "figma-rest-full-bounds-v1"; scale: 1 } | {kind:"figma-rest-paired-render-v1";scale:1;proof:RenderExportProof};
}
export const FIGMA_REST_FULL_BOUNDS = {
  kind: "figma-rest-full-bounds-v1",
  scale: 1,
} as const;
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
/** The unit Figma REST bounds are compared in: 1/64 px.
 *
 * Figma computes and stores geometry as float32 (core/native-float32.ts), so a
 * REST absoluteBoundingBox / absoluteRenderBounds carries float32 arithmetic
 * error of a few units in the last place: HeroUI `lock` (2217:920) reports a
 * 16 px icon as 16.000003814697266 (16 + 2^-18) wide, and `paper-plane`
 * (2217:5233) a layout of 15.999999046325684 (16 - 2^-20) around a render of
 * exactly 16. Taken literally, the first asks for a 17 px export beside
 * Figma's own 16 px PNG and the second draws "outside" its own layout, so
 * both came out `image-framing-unqualified` (first real-kit scoreboard,
 * 2026-09-28) without anything being wrong.
 *
 * 1/64 px is the layout unit of the browser this check captures with:
 * Chromium lays out in 1/64 px units (docs/23-known-limitations.md §D.61,
 * source-reference/layout-unit.ts), so the consumer side of this comparison
 * cannot express a difference finer than 1/64 px, and core/native-fixed-cross-size.ts
 * keeps native layout arithmetic to that same dyadic domain because float32
 * is exact on it. Rounding each Figma edge to the nearest 1/64 px therefore
 * removes only differences neither instrument can express (float32 noise at
 * these magnitudes is ~4,000 times smaller); a render that genuinely reaches
 * past its layout, or a layout that genuinely needs another export pixel,
 * differs by at least 1/64 px and is still refused. The recorded receipt keeps
 * Figma's raw numbers; only the comparison reads them rounded.
 *
 * Figma's own exporter is not consistent below that unit: it drew the 16 px
 * HeroUI icon above in 16 px, ignoring 3.8e-6, yet exported a Carbon text
 * input whose REST width is 399.0010070800781 (15784:271032) in 400 px,
 * counting 0.001. So the export span is qualified when the PNG is the ceiling
 * of EITHER reading, raw or 1/64 px: the two differ by less than 1/64 px, and
 * the extra column then holds less than 1/64 px of layout. A PNG that fits
 * neither reading is still refused. */
export const FIGMA_BOUNDS_UNIT_PX = 1 / 64;
const toBoundsUnit = (v: number) => Math.round(v / FIGMA_BOUNDS_UNIT_PX) * FIGMA_BOUNDS_UNIT_PX;
/** A Figma REST box with each EDGE rounded to 1/64 px (width and height follow
 *  from the rounded edges, so containment is judged on the same edges). */
export const figmaBoundsInLayoutUnits = (box: FrameBox): FrameBox => {
  const x = toBoundsUnit(box.x), y = toBoundsUnit(box.y);
  return { x, y, width: toBoundsUnit(box.x + box.width) - x, height: toBoundsUnit(box.y + box.height) - y };
};
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
  if(figma.refused)return {refused:figma.refused};
  const expanded=consumer.raster?.kind==="browser-paint-extent-v1";
  if(consumer.raster&&(!expanded||!validBox(consumer.raster.paint)))return {refused:"consumer-raster-model-unsupported"};
  const paired=figma.raster?.kind==="figma-rest-paired-render-v1";
  if(paired){const proof=figma.raster!.kind==="figma-rest-paired-render-v1"?figma.raster!.proof:null;
    if(!proof||!proof.version||!proof.nodeId||!validBox(proof.layout)||!validBox(proof.render)||!proof.layoutInRender||!sameBox(proof.layout,figma.layout)||!sameBox(proof.render,figma.render)||proof.renderSha256!==figma.pngSha256||!/^([a-f0-9]{64})$/.test(proof.layoutSha256)||proof.layoutInRender.x!==figma.layout.x-figma.render.x||proof.layoutInRender.y!==figma.layout.y-figma.render.y||!Number.isInteger(proof.paintedOverlapPixels)||proof.paintedOverlapPixels<=0||!Number.isInteger(proof.overlapPixels)||proof.overlapPixels<proof.paintedOverlapPixels)
      return {refused:"figma-render-origin-proof-mismatch"};
  }
  if (consumer.deviceScaleFactor !== 1)
    return { refused: "consumer-scale-not-one" };
  if (
    imageSha256(consumerBytes) !== consumer.pngSha256 ||
    imageSha256(figmaBytes) !== figma.pngSha256
  )
    return { refused: "image-frame-hash-mismatch" };
  const ours = PNG.sync.read(consumerBytes),
    theirs = PNG.sync.read(figmaBytes);
  if (
    figma.raster &&
    ((figma.raster.kind !== FIGMA_REST_FULL_BOUNDS.kind && !paired) ||
      figma.raster.scale !== 1)
  )
    return { refused: "figma-raster-model-unsupported" };
  // Figma's REST bounds, read in 1/64 px units (FIGMA_BOUNDS_UNIT_PX above).
  const figmaLayout = figmaBoundsInLayoutUnits(figma.layout),
    figmaRender = figmaBoundsInLayoutUnits(figma.render);
  // A full-bounds export spans the layout box from its local origin: its pixel
  // span is the ceiling of the raw or the 1/64 px reading (see above). Legacy
  // receipts (no raster model) keep their original raw render-span reading.
  const spans = (pixels: number, raw: number, unit: number) =>
    pixels === Math.ceil(raw) || pixels === Math.ceil(unit);
  const capture = enclosingFrame(expanded ? consumer.raster!.paint : consumer.layout),
    exported = figma.raster ? null : enclosingFrame(figma.render);
  if(expanded&&(capture.x>consumer.layout.x||capture.y>consumer.layout.y||capture.x+capture.width<consumer.layout.x+consumer.layout.width||capture.y+capture.height<consumer.layout.y+consumer.layout.height))return {refused:"consumer-layout-outside-capture"};
  if (!sameBox(consumer.capture, capture))
    return { refused: "consumer-capture-span-mismatch" };
  if (ours.width !== capture.width || ours.height !== capture.height)
    return { refused: "consumer-image-span-mismatch" };
  if (
    exported
      ? theirs.width !== exported.width || theirs.height !== exported.height
      : !spans(theirs.width, paired?figma.render.width:figma.layout.width, paired?figmaRender.width:figmaLayout.width) ||
        !spans(theirs.height, paired?figma.render.height:figma.layout.height, paired?figmaRender.height:figmaLayout.height)
  )
    return { refused: "figma-image-span-mismatch" };
  // The browser instrument captures the root layout box. It cannot qualify a
  // Figma export with shadows/outlines beyond that box by clipping them away.
  if (
    !(paired && expanded) && (figmaRender.x < figmaLayout.x ||
    figmaRender.y < figmaLayout.y ||
    figmaRender.x + figmaRender.width > figmaLayout.x + figmaLayout.width ||
    figmaRender.y + figmaRender.height > figmaLayout.y + figmaLayout.height)
  )
    return { refused: "render-outside-layout-capture-unqualified" };
  const ca = {
    x: consumer.layout.x - capture.x,
    y: consumer.layout.y - capture.y,
  };
  const fa = exported
    ? { x: figma.layout.x - exported.x, y: figma.layout.y - exported.y }
    : paired ? {x:figma.layout.x-figma.render.x,y:figma.layout.y-figma.render.y} : { x: 0, y: 0 };
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
  raster?: FigmaFrame["raster"],
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
      ...(raster ? { raster: { ...raster } } : {}),
    };
  }
  return { frames };
}
