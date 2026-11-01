/**
 * Reference images from the plugin capture (extract/figma/capture.plugin.js,
 * the Sync Runner's "Capture reference images") instead of Figma's REST image
 * API: docs/GOAL.md Step 2, shared by both directions. It builds the same
 * result fetchFigmaImages builds, through the same proofs: the capture's own
 * before and after bounds stand in for the two REST node reads, so
 * figmaFramesFromSnapshots refuses a node that moved during the export, and
 * qualifyRenderBoundsExport proves a painted extent against its layout box
 * exactly as it does for REST. Raster kinds name the plugin as the source.
 * Not here (named, not guessed): the REST-only source-anchor rescue for an
 * overlap mismatch, which needs the node's full document.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { figmaFramesFromSnapshots, imageSha256, FIGMA_PLUGIN_LAYOUT_BOX, type FigmaFrame, type FrameBox } from './design-consumer-framing-v2.js';
import { qualifyRenderBoundsExport } from './design-consumer-render-export.js';

interface CaptureVariant {
  nodeId: string;
  box: { bounds: FrameBox; png: string };
  paint?: { bounds: FrameBox; png: string };
  after: { layout: FrameBox; render: FrameBox };
}
export interface PluginCapture { kind: string; version: number; fileKey: string | null; set: string; nodeId: string; variants: CaptureVariant[] }

const unavailable = (reason: string) =>
  ({ status: 'figma-images-unavailable' as const, reason, files: {} as Record<string, string>, frames: {} as Record<string, FigmaFrame>, framingRefusal: reason });

export function figmaImagesFromCapture(capture: PluginCapture, expected: { fileKey?: string | null; setNodeId?: string }, ids: string[], out: string) {
  if (capture?.kind !== 'ds-contracts-plugin-capture' || capture.version !== 2) return unavailable('capture-kind-unsupported');
  if (expected.setNodeId && capture.nodeId !== expected.setNodeId) return unavailable(`capture-set-mismatch:${capture.nodeId}`);
  if (expected.fileKey && capture.fileKey && capture.fileKey !== expected.fileKey) return unavailable(`capture-file-mismatch:${capture.fileKey}`);
  const version = `plugin-capture:${capture.fileKey ?? 'unknown'}:${capture.nodeId}`;
  const before: any = { version, nodes: {} }, after: any = { version, nodes: {} };
  const files: Record<string, string> = {}, layouts: Record<string, Buffer> = {}, paints: Record<string, Buffer> = {};
  for (const id of ids) {
    const v = capture.variants.find((variant) => variant.nodeId === id);
    if (!v) continue;
    before.nodes[id] = { document: { id, absoluteBoundingBox: v.box.bounds, absoluteRenderBounds: v.paint?.bounds ?? v.box.bounds } };
    after.nodes[id] = { document: { id, absoluteBoundingBox: v.after.layout, absoluteRenderBounds: v.after.render } };
    layouts[id] = Buffer.from(v.box.png, 'base64');
    if (v.paint) paints[id] = Buffer.from(v.paint.png, 'base64');
    files[id] = path.join(out, `figma-${id.replace(/[^a-z0-9]/gi, '_')}.png`);
    writeFileSync(files[id], layouts[id]);
  }
  const verified = figmaFramesFromSnapshots(before, after, layouts, FIGMA_PLUGIN_LAYOUT_BOX);
  if (!verified.refused) for (const id of Object.keys(paints)) {
    const frame = verified.frames[id]!;
    const result = qualifyRenderBoundsExport(before, after, id, layouts[id]!, paints[id]!);
    if ('refused' in result) { frame.refused = result.refused; continue; }
    writeFileSync(files[id]!, paints[id]!);
    frame.pngSha256 = imageSha256(paints[id]!);
    frame.raster = { kind: 'figma-plugin-paired-render-v1', scale: 1, proof: result.proof };
  }
  return { status: 'figma-images-collected' as const, reason: null, files, frames: verified.frames, framingRefusal: verified.refused,
    frameEvidence: { source: 'plugin-capture', set: capture.set, nodeId: capture.nodeId, fileKey: capture.fileKey, version,
      export: { format: 'png', scale: 1, useAbsoluteBounds: true }, raster: FIGMA_PLUGIN_LAYOUT_BOX } };
}
