/**
 * Benchmark instrument (React → native): score one app-created native Figma
 * node against a guarded transparent capture of the original React render, on
 * white and black, with the unchanged scorer (diffPair, 5% limit). The native
 * PNG and bounds are read-only REST GETs.
 *
 * Framing (owner decisions, 2026-09-27; recorded in comparison.json):
 * - A fractional source root box is SNAPPED OUTWARD to the smallest whole-pixel
 *   box containing it.
 * - Effects that paint past the root box (shadows, outlines) are INCLUDED: the
 *   source is cropped to the union of its snapped root box and all its paint,
 *   Figma is exported with its render (effect) bounds, and the two are placed
 *   with their snapped root origins together.
 * An integer, effect-free pair takes exactly the previous path (the recorded
 * aligner, alignRecordedFrames, over the root box).
 *
 * Text residual (owner rule, 2026-09-25: text-only overages are partials,
 * never passes): when the source receipt lists where the React render drew
 * text (`textRects`, CSS px from the root's layout box), a score over the
 * limit gets a SECOND number, never the verdict — the same diff with those
 * boxes painted out on both sides, classified exactly as the Figma → React
 * consumer check classifies it (`residualClass`). A root size difference is
 * attributed to text only when it equals the measured difference between the
 * two texts' extents (`text.sizeDifferenceFromText`).
 *
 * Usage: FIGMA_TOKEN=… tsx scripts/benchmark-source-native-compare.ts <sourceDir> <nativeNodeId> <outDir> [--file-key <key>]
 * <sourceDir> holds 0.source.png and source-receipt.json (imageSha256,
 * rootOffset, bounds, optional textRects) from a source capture. The comparison.json it writes is
 * what `npm run benchmark:check -- --attach … --receipt` binds to a pin.
 */
import fs from 'node:fs';
import path from 'node:path';
import {alignRecordedFrames, figmaFramesFromSnapshots, imageSha256, FIGMA_REST_FULL_BOUNDS} from './design-consumer-framing.js';
import {diffPair, writeTriptych} from '../extract/figma/visual-parity/img.js';
import {PNG} from 'pngjs';
import {alignAtOffsets, paintBox, sizeDifferenceFromText, snapOutward, textExtent, unionBox} from './benchmark-source-framing.js';
import {residualClass} from './design-consumer-check.js';

const [sourceDir, nodeId, outDir] = process.argv.slice(2);
const token = process.env.FIGMA_TOKEN!;
const keyFlag = process.argv.indexOf('--file-key');
const fileKey = keyFlag > -1 ? process.argv[keyFlag + 1] : 'T56aKuRnoay1L7CKAjSWRO';
if (!token) throw Error('FIGMA_TOKEN is required (read from the environment only)');
fs.mkdirSync(outDir, {recursive: false});
const receipt = JSON.parse(fs.readFileSync(path.join(sourceDir, 'source-receipt.json'), 'utf8'));
const sourceBytes = fs.readFileSync(path.join(sourceDir, '0.source.png'));
if (imageSha256(sourceBytes) !== receipt.imageSha256) throw Error('source image does not match its receipt');

// Source: the snapped root box, grown to cover every painted pixel.
const full = PNG.sync.read(sourceBytes), off = receipt.rootOffset, box = receipt.bounds;
const snapped = snapOutward(off, box);
const painted = paintBox(full);
if (!painted) throw Error('source capture has no paint');
const crop = unionBox(snapped, painted);
const sourceEffects = crop.x !== snapped.x || crop.y !== snapped.y || crop.width !== snapped.width || crop.height !== snapped.height;
const cropPng = new PNG({width: crop.width, height: crop.height});
PNG.bitblt(full, cropPng, crop.x, crop.y, crop.width, crop.height, 0, 0);
const cropBytes = PNG.sync.write(cropPng);
fs.writeFileSync(path.join(outDir, 'source-root.png'), cropBytes);

// Native: bounds before and after, and the export that covers what Figma paints.
const get = async (url: string) => { const r = await fetch(url, {headers: {'X-Figma-Token': token}}); if (!r.ok) throw Error(`GET ${r.status}`); return r; };
const boundsUrl = `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${nodeId}&depth=1`;
const before = await (await get(boundsUrl)).json();
const doc = before.nodes?.[nodeId]?.document;
const layout = doc?.absoluteBoundingBox, render = doc?.absoluteRenderBounds;
if (!layout || !render) throw Error('native bounds not recorded');
const nativeEffects = render.x < layout.x || render.y < layout.y ||
  render.x + render.width > layout.x + layout.width || render.y + render.height > layout.y + layout.height;
const effects = sourceEffects || nativeEffects;
const exportUrl = `https://api.figma.com/v1/images/${fileKey}?ids=${nodeId}&format=png&scale=1&contents_only=true${effects ? '' : '&use_absolute_bounds=true'}`;
const exp = await (await get(exportUrl)).json() as any;
const nativeBytes = Buffer.from(await (await fetch(exp.images[nodeId])).arrayBuffer());
const after = await (await get(boundsUrl)).json();
fs.writeFileSync(path.join(outDir, 'native.png'), nativeBytes);
fs.writeFileSync(path.join(outDir, 'native-bounds.json'), JSON.stringify({before, after}));

let align: (background: 0 | 255) => ReturnType<typeof alignRecordedFrames> | ReturnType<typeof alignAtOffsets>;
let nativeSize: [number, number], nativeFraming: Record<string, unknown> | undefined;
if (!effects) {
  // The previous path: root box against Figma's layout-bounds export.
  const frameBox = snapped.fractional ? {x: 0, y: 0, width: snapped.width, height: snapped.height} : box;
  const sourceFrame = {layout: frameBox, capture: frameBox, deviceScaleFactor: 1, pngSha256: imageSha256(cropBytes)};
  const framed = figmaFramesFromSnapshots(before, after, {[nodeId]: nativeBytes}, FIGMA_REST_FULL_BOUNDS);
  if (framed.refused) throw Error('native framing refused: ' + framed.refused);
  const nativeFrame = framed.frames[nodeId];
  nativeSize = [nativeFrame.layout.width, nativeFrame.layout.height];
  align = background => alignRecordedFrames(cropBytes, nativeBytes, sourceFrame as any, nativeFrame, background);
} else {
  // Effects included: render-bounds export, snapped root origins placed together.
  if (before.version !== after.version || before.lastModified !== after.lastModified) throw Error('native framing refused: figma-file-changed-during-export');
  const theirs = PNG.sync.read(nativeBytes);
  if (theirs.width !== Math.ceil(render.width) || theirs.height !== Math.ceil(render.height)) throw Error('native framing refused: figma-render-export-span-mismatch');
  const sourceRoot = {x: snapped.x - crop.x, y: snapped.y - crop.y};
  const nativeRoot = {x: Math.floor(layout.x - render.x), y: Math.floor(layout.y - render.y)};
  const origin = {x: Math.max(sourceRoot.x, nativeRoot.x), y: Math.max(sourceRoot.y, nativeRoot.y)};
  const at = {x: origin.x - sourceRoot.x, y: origin.y - sourceRoot.y}, bt = {x: origin.x - nativeRoot.x, y: origin.y - nativeRoot.y};
  nativeSize = [layout.width, layout.height];
  nativeFraming = {rule: 'render-bounds-v1', layout, render, rootInExport: nativeRoot};
  align = background => alignAtOffsets(cropPng, theirs, at, bt, background);
}

// Source text boxes in the cropped source image's own pixels.
const textRects = Array.isArray(receipt.textRects)
  ? receipt.textRects.map((r: {x: number; y: number; width: number; height: number}) => ({x: off.x + r.x - crop.x, y: off.y + r.y - crop.y, width: r.width, height: r.height}))
  : null;
const scores: any[] = [];
for (const background of [255, 0] as const) {
  const aligned = align(background);
  if ('refused' in aligned) { scores.push({background, refused: aligned.refused}); continue; }
  const diff = diffPair(aligned.aligned, []);
  const name = `source-native-${background === 255 ? 'white' : 'black'}.png`;
  writeTriptych(path.join(outDir, name), aligned.aligned, diff.diff);
  const withinLimit = diff.unmaskedPct <= 5;
  const masked = !withinLimit && textRects ? diffPair(aligned.aligned, textRects) : null;
  scores.push({background: background === 255 ? 'white' : 'black', mismatchPercent: diff.unmaskedPct, withinLimit, triptych: name,
    ...(masked ? {textMaskedPercent: masked.maskedPct, textMaskCoveragePercent: masked.maskCoveragePct, residual: residualClass(masked.maskedPct, masked.maskCoveragePct)} : {})});
}
const sourceSize: [number, number] = [receipt.bounds.width, receipt.bounds.height];
const layoutExact = sourceSize[0] === nativeSize[0] && sourceSize[1] === nativeSize[1];
// A size difference is attributed to text only by measuring both texts: the
// native text boxes are one more read-only GET of the node's descendants.
let text: Record<string, unknown> | undefined;
if (!layoutExact && Array.isArray(receipt.textRects)) {
  const full = await (await get(`https://api.figma.com/v1/files/${fileKey}/nodes?ids=${nodeId}`)).json() as any;
  const nativeRects: {x: number; y: number; width: number; height: number}[] = [];
  const walk = (n: any) => { if (n.type === 'TEXT' && n.visible !== false && n.absoluteBoundingBox) nativeRects.push({...n.absoluteBoundingBox, x: n.absoluteBoundingBox.x - layout.x, y: n.absoluteBoundingBox.y - layout.y}); (n.children ?? []).forEach(walk); };
  walk(full.nodes?.[nodeId]?.document ?? {});
  const extents = {source: textExtent(receipt.textRects), native: textExtent(nativeRects)};
  text = {...extents, nativeRects, sizeDifferenceFromText: sizeDifferenceFromText(sourceSize, nativeSize, extents.source, extents.native)};
}
const result = {nodeId, fileKey, limitPercent: 5, sourceSize,
  nativeSize,
  layoutExact,
  ...(text ? {text} : {}),
  ...(snapped.fractional || effects ? {sourceFraming: {rule: effects ? 'snap-outward-effects-included-v1' : 'snap-outward-v1', rootOffset: off,
    layoutBox: {width: box.width, height: box.height}, crop, rootInCrop: {x: snapped.x - crop.x, y: snapped.y - crop.y}}} : {}),
  ...(nativeFraming ? {nativeFraming} : {}),
  scores, pass: scores.every(s => s.withinLimit === true)};
fs.writeFileSync(path.join(outDir, 'comparison.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
