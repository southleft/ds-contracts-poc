/** Supplemental matched-frame evidence; historical native measurements stay
 * untouched. No offset search, resampling, masking, or scorer modification. */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual as same } from 'node:util';
import { PNG } from 'pngjs';
import { cropSourceFrame } from '../source-reference/source-framing.js';
import type { captureTransparentSourceFrame } from '../source-reference/transparent-source-frame.js';
import type { captureTransparentSourceFrame as currentCapture } from '../source-reference/transparent-source-frame-v2.js';
import { alignRecordedFrames } from './design-consumer-framing.js';
import { diffPair } from '../extract/figma/visual-parity/img.js';
import { FIDELITY_BAR } from '../recipe/fidelity-score.js';
import { REPO, QUALIFICATION, sha256 } from './react-native-fidelity-check.js';
import type { Cohort } from './react-native-fidelity-check.js';

export const MATCHED_EVIDENCE = 'recipe/evidence/react-native-matched-capture';
export const MATCHED_EVIDENCE_DIRS = [MATCHED_EVIDENCE, 'recipe/evidence/react-native-matched-content', 'recipe/evidence/react-native-matched-state-api', 'recipe/evidence/react-native-matched-state-api-scope', 'recipe/evidence/react-native-matched-three-state-api'];
export const MATCHED_COVERAGE = { 'family-switch': 9, 'family-alert': 1, 'family-switch-state-api': 9, 'shadcn-checkbox-three-state-api': 12 };
export const MATCHED_INSTRUMENTS = ['source-reference/transparent-source-frame.ts', 'source-reference/source-framing.ts',
  'scripts/design-consumer-framing.ts', 'extract/figma/visual-parity/img.ts'] as const;
export const CURRENT_MATCHED_INSTRUMENTS = ['source-reference/transparent-source-frame-v2.ts', ...MATCHED_INSTRUMENTS.slice(1)] as const;
type CurrentReceipt = Awaited<ReturnType<typeof currentCapture>>['receipt'];
type Receipt = Awaited<ReturnType<typeof captureTransparentSourceFrame>>['receipt'] | CurrentReceipt;

/** New records cannot borrow the historical instrument's missing scope proof. */
export function assertCurrentMatchedCapture(receipt: unknown): asserts receipt is CurrentReceipt {
  const r = receipt as Partial<CurrentReceipt> | null | undefined, scope = r?.component?.opaqueScope;
  if (r?.version !== 2 || r.kind !== 'transparent-source-frame' || scope?.kind !== 'chromium-light-tree-v1' ||
      !Number.isSafeInteger(scope.targetNodes) || scope.targetNodes < 1 ||
      !Number.isSafeInteger(scope.ancestorNodes) || scope.ancestorNodes < 0 ||
      scope.targetNodes + scope.ancestorNodes > 10_000) throw Error('matched-capture-current-source-required');
}

export interface MatchedManifest {
  version: 1; kind: 'react-native-matched-capture'; qualification: typeof QUALIFICATION; acceptedContract: null;
  instruments: Record<string, string>;
  cohort: Pick<Cohort, 'id' | 'component' | 'source' | 'native'>;
  rows: Array<{
    id: string; variant: string; source: Receipt;
    files: Record<'original' | 'context' | 'transparent' | 'source' | 'native', string>;
    native: {
      originalId: string; frameId: string; cloneId: string;
      frameBounds: { x: number; y: number; width: number; height: number };
      renderBounds: { x: number; y: number; width: number; height: number };
      rootPosition: { x: number; y: number };
      rootSize: { width: number; height: number };
      originalSnapshotSha256: string; cloneSnapshotSha256: string;
      export: { kind: 'figma-plugin-frame-v1'; scale: 1; useAbsoluteBounds: true; contentsOnly: true };
    };
  }>;
}

export function scoreMatchedEvidence(dir: string, manifest: MatchedManifest) {
  const fail = (name: string): never => { throw Error('matched-capture-' + name); };
  if (manifest.version !== 1 || manifest.kind !== 'react-native-matched-capture' ||
      manifest.qualification !== QUALIFICATION || manifest.acceptedContract !== null ||
      FIDELITY_BAR.pctAAMaskedMax !== 5) fail('manifest-invalid');
  const expected = MATCHED_COVERAGE[manifest.cohort.id as keyof typeof MATCHED_COVERAGE];
  if (!expected || manifest.rows.length !== expected || new Set(manifest.rows.map(r => r.id)).size !== expected ||
      new Set(manifest.rows.map(r => r.variant)).size !== expected ||
      new Set(manifest.rows.map(r => r.native.originalId)).size !== expected ||
      manifest.rows.some(r => !/^[0-9]+$/.test(r.id))) fail('denominator-changed');
  const version = manifest.rows[0]!.source.version;
  if (![1, 2].includes(version) || manifest.rows.some(row => row.source.version !== version)) fail('capture-version');
  const instruments = version === 2 ? CURRENT_MATCHED_INSTRUMENTS : MATCHED_INSTRUMENTS;
  if (!same(Object.keys(manifest.instruments).sort(), [...instruments].sort()) ||
      instruments.some(file => sha256(readFileSync(path.join(REPO, file))) !== manifest.instruments[file])) fail('instrument-changed');
  return manifest.rows.map(row => {
    const data = Object.fromEntries(Object.entries(row.files).map(([name, hash]) => {
      if (!['original', 'context', 'transparent', 'source', 'native'].includes(name) || !/^[a-f0-9]{64}$/.test(hash)) fail('file-invalid');
      const bytes = readFileSync(path.join(dir, row.id + '.' + name + '.png'));
      if (sha256(bytes) !== hash) fail('image-changed:' + row.id + ':' + name);
      return [name, bytes];
    }));
    const s = row.source, n = row.native;
    if (s.version === 2) assertCurrentMatchedCapture(s);
    if (s.kind !== 'transparent-source-frame' || s.qualification !== 'unqualified' ||
        s.originalSha256 !== row.files.original || s.contextSha256 !== row.files.context ||
        s.transparentSha256 !== row.files.transparent || s.imageSha256 !== row.files.source ||
        !same(s.bounds, s.component.bounds) ||
        !same(n.rootSize, { width: s.bounds.width, height: s.bounds.height }) ||
        !same(s.rootOffset, { x: s.bounds.x - s.crop.x, y: s.bounds.y - s.crop.y }) ||
        !same(n.rootPosition, s.rootOffset) || n.originalSnapshotSha256 !== n.cloneSnapshotSha256 ||
        !/^[a-f0-9]{64}$/.test(n.originalSnapshotSha256)) fail('geometry-changed:' + row.id);
    if (!same(n.export, { kind: 'figma-plugin-frame-v1', scale: 1, useAbsoluteBounds: true, contentsOnly: true })) fail('native-export-model');
    const frame = n.frameBounds, render = n.renderBounds;
    if (![frame.x, frame.y, frame.width, frame.height].every(Number.isInteger) ||
        frame.width !== s.crop.width || frame.height !== s.crop.height ||
        ![render.x, render.y, render.width, render.height].every(Number.isFinite) ||
        render.width <= 0 || render.height <= 0 || render.x < frame.x || render.y < frame.y ||
        render.x + render.width > frame.x + frame.width || render.y + render.height > frame.y + frame.height) fail('native-frame-invalid');
    const crop = cropSourceFrame(data.transparent!, s.bounds);
    if (!same(crop.crop, s.crop) || !same(crop.sourceSize, s.sourceSize) || !crop.bytes.equals(data.source!) ||
        !cropSourceFrame(data.context!, s.bounds).bytes.equals(data.source!)) fail('source-context-changed');
    const original = PNG.sync.read(data.original!, { checkCRC: true });
    if (original.width !== s.sourceSize.width || original.height !== s.sourceSize.height) fail('original-span-changed');
    for (const name of ['transparent', 'native'] as const) {
      const png = PNG.sync.read(data[name]!, { checkCRC: true });
      const box = name === 'native' ? { x: 0, y: 0, width: frame.width, height: frame.height } : s.crop;
      for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++)
        if (png.data[(y * png.width + x) * 4 + 3] &&
            (x <= box.x || y <= box.y || x >= box.x + box.width - 1 || y >= box.y + box.height - 1)) fail('paint-outside-frame:' + name);
    }
    const local = { x: 0, y: 0, width: frame.width, height: frame.height };
    const scores = ([255, 0] as const).map(background => {
      const aligned = alignRecordedFrames(data.source!, data.native!,
        { layout: local, capture: local, deviceScaleFactor: 1, pngSha256: row.files.source },
        { layout: local, render: local, pngSha256: row.files.native }, background);
      if ('refused' in aligned) return fail(aligned.refused);
      const score = diffPair(aligned.aligned, []);
      return { background, mismatch: score.unmaskedPct, differingPixels: score.diffCount, placement: aligned.placement };
    });
    return { id: row.id, variant: row.variant, scores, pass: scores.every(s => s.mismatch <= 5) };
  });
}

export function checkMatchedEvidence(dir: string, writeDerived = false) {
  const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8')) as MatchedManifest;
  const rows = scoreMatchedEvidence(dir, manifest);
  const scorecard = { version: 1, qualification: QUALIFICATION, acceptedContract: null, rows };
  const report = ['# Native matched-frame measurements', '',
    'Supplemental evidence from fresh app-created native components. Earlier scores and refusals are preserved. Measured, not graded; no runtime interaction qualification.', '',
    'Source originals match their sealed observations. Transparent capture rejects dependent paint and ancestor clipping, proves exclusion of sibling paint leaves the crop byte-identical, and restores the original. Native clones retain the authenticated structure and bindings, exact root sizes and source-derived offsets. Exports use persistent integer-origin frames at scale one. No resampling, offset search, glyph mask or threshold change.', '',
    'The unchanged 5% scorer has limited sensitivity: a one-pixel shift can pass its pixel test. Exact geometry is therefore an independent precondition. This command recomputes committed evidence; it does not contact Figma or prove the current canvas.', '',
    '| variant | white % | black % | result |', '| --- | ---: | ---: | --- |',
    ...rows.map(r => `| ${r.variant} | ${r.scores[0]!.mismatch.toFixed(3)} | ${r.scores[1]!.mismatch.toFixed(3)} | ${r.pass ? 'pass' : 'fail'} |`), '',
    `Native operation: \`${manifest.cohort.native.operationId}\`. Source reference: \`${manifest.cohort.source.referenceId}\`.`, '',
    'The application exposes these paired images and recomputed scores under Review recorded matched frames for the authenticated operation. It labels them as the recorded baseline, not a current canvas inspection or interaction result. Capture preparation still requires the operator-run instrument. Bound height-variable updates also remain refused.', ''].join('\n');
  const outputs = { 'SCORECARD.json': JSON.stringify(scorecard, null, 2) + '\n', 'REPORT.md': report };
  for (const [name, content] of Object.entries(outputs)) {
    if (writeDerived) writeFileSync(path.join(dir, name), content);
    if (readFileSync(path.join(dir, name), 'utf8') !== content) throw Error('matched-capture-derived-stale:' + name);
  }
  if (rows.some(r => !r.pass)) throw Error('matched-capture-fidelity-red');
  return scorecard;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = MATCHED_EVIDENCE_DIRS.flatMap(dir => checkMatchedEvidence(path.join(REPO, dir), process.argv.includes('--write-derived')).rows);
  console.log(`Matched native frames: ${rows.length} pairs measured on both backgrounds; no owner grade.`);
}
