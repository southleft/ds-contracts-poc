/**
 * Benchmark instrument (React → native): score one app-created native Figma
 * node against a guarded transparent capture of the original React render, on
 * white and black, with the unchanged aligner (alignRecordedFrames) and scorer
 * (diffPair, 5% limit). The native PNG and bounds are read-only REST GETs with
 * the design-consumer checker's own export options and framing rules.
 *
 * Usage: FIGMA_TOKEN=… tsx scripts/benchmark-source-native-compare.ts <sourceDir> <nativeNodeId> <outDir> [--file-key <key>]
 * <sourceDir> holds 0.source.png and source-receipt.json (imageSha256,
 * rootOffset, bounds) from a source capture. The comparison.json it writes is
 * what `npm run benchmark:check -- --attach … --receipt` binds to a pin.
 */
import fs from 'node:fs';
import path from 'node:path';
import {alignRecordedFrames, figmaFramesFromSnapshots, imageSha256, FIGMA_REST_FULL_BOUNDS} from './design-consumer-framing.js';
import {diffPair, writeTriptych} from '../extract/figma/visual-parity/img.js';
import {PNG} from 'pngjs';

const [sourceDir, nodeId, outDir] = process.argv.slice(2);
const token = process.env.FIGMA_TOKEN!;
const keyFlag = process.argv.indexOf('--file-key');
const fileKey = keyFlag > -1 ? process.argv[keyFlag + 1] : 'T56aKuRnoay1L7CKAjSWRO';
if (!token) throw Error('FIGMA_TOKEN is required (read from the environment only)');
fs.mkdirSync(outDir, {recursive: false});
const receipt = JSON.parse(fs.readFileSync(path.join(sourceDir, 'source-receipt.json'), 'utf8'));
const sourceBytes = fs.readFileSync(path.join(sourceDir, '0.source.png'));
if (imageSha256(sourceBytes) !== receipt.imageSha256) throw Error('source image does not match its receipt');
// The consumer aligner compares root layout boxes; crop the guarded capture to
// its exact root box (rootOffset inside the crop). Refuse if any paint lies in
// the discarded context margin, so nothing outside the box is silently dropped.
const full = PNG.sync.read(sourceBytes), off = receipt.rootOffset, box = receipt.bounds;
if (!Number.isInteger(off.x) || !Number.isInteger(off.y) || !Number.isInteger(box.width) || !Number.isInteger(box.height)) throw Error('fractional source root box');
for (let y = 0; y < full.height; y++) for (let x = 0; x < full.width; x++) {
  const inside = x >= off.x && x < off.x + box.width && y >= off.y && y < off.y + box.height;
  if (!inside && full.data[(y * full.width + x) * 4 + 3] !== 0) throw Error('source paints outside its root box');
}
const rootPng = new PNG({width: box.width, height: box.height});
PNG.bitblt(full, rootPng, off.x, off.y, box.width, box.height, 0, 0);
const rootBytes = PNG.sync.write(rootPng);
fs.writeFileSync(path.join(outDir, 'source-root.png'), rootBytes);
const sourceFrame = {layout: box, capture: box, deviceScaleFactor: 1, pngSha256: imageSha256(rootBytes)};
const get = async (url: string) => { const r = await fetch(url, {headers: {'X-Figma-Token': token}}); if (!r.ok) throw Error(`GET ${r.status}`); return r; };
const boundsUrl = `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${nodeId}&depth=1`;
const before = await (await get(boundsUrl)).json();
const exp = await (await get(`https://api.figma.com/v1/images/${fileKey}?ids=${nodeId}&format=png&scale=1&contents_only=true&use_absolute_bounds=true`)).json() as any;
const nativeBytes = Buffer.from(await (await fetch(exp.images[nodeId])).arrayBuffer());
const after = await (await get(boundsUrl)).json();
fs.writeFileSync(path.join(outDir, 'native.png'), nativeBytes);
fs.writeFileSync(path.join(outDir, 'native-bounds.json'), JSON.stringify({before, after}));
const framed = figmaFramesFromSnapshots(before, after, {[nodeId]: nativeBytes}, FIGMA_REST_FULL_BOUNDS);
if (framed.refused) throw Error('native framing refused: ' + framed.refused);
const nativeFrame = framed.frames[nodeId];
const scores: any[] = [];
for (const background of [255, 0] as const) {
  const aligned = alignRecordedFrames(rootBytes, nativeBytes, sourceFrame as any, nativeFrame, background);
  if ('refused' in aligned) { scores.push({background, refused: aligned.refused}); continue; }
  const diff = diffPair(aligned.aligned, []);
  const name = `source-native-${background === 255 ? 'white' : 'black'}.png`;
  writeTriptych(path.join(outDir, name), aligned.aligned, diff.diff);
  scores.push({background: background === 255 ? 'white' : 'black', mismatchPercent: diff.unmaskedPct, withinLimit: diff.unmaskedPct <= 5, triptych: name});
}
const result = {nodeId, fileKey, limitPercent: 5, sourceSize: [receipt.bounds.width, receipt.bounds.height],
  nativeSize: [nativeFrame.layout.width, nativeFrame.layout.height],
  layoutExact: receipt.bounds.width === nativeFrame.layout.width && receipt.bounds.height === nativeFrame.layout.height,
  scores, pass: scores.every(s => s.withinLimit === true)};
fs.writeFileSync(path.join(outDir, 'comparison.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
