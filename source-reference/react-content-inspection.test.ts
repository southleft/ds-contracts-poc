import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright-core';
import { captureValidatedTree } from './capture.js';
import { watchSourceFailures } from './observe.js';
import { reactReferenceHtml } from './react-reference.js';
import { reactReferenceProfile } from './react-reference-profiles.js';
import { evidenceSha, inventoryEvidence } from './react-validation-evidence.js';
import { selectReactNativeRequest, readReactNativeContentEvidence } from './react-native-evidence.js';
import {withEvidenceReadSnapshot} from './evidence-read-snapshot.js';
import { startReactContentInspection, readReactContentInspection, readReactContentInspectionEvidence } from './react-content-inspection.js';
import type { ReactOwnershipReport } from './react-ownership-run.js';
import { createReactSourceFramingStore, loadReactFrameInput, measureReactSourceFrame, measureReactSourceTypography } from './react-source-framing.js';
import { PNG } from 'pngjs';
import { revisionOf } from '../core/contract-provenance.js';
import { createReactInitialInspectionStore, observerIdentityUnavailable, reactInitialObserverIdentity, reactInitialObserverModules, reactInitialReobservable } from './react-initial-inspection.js';
import { builtinReactCohort } from './react-cohort.js';

test('targeted content preparation matches sealed rendering, survives reopening and refuses changed evidence', async t => {
  const repo = mkdtempSync(path.join(tmpdir(), 'react-content-'));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const source = path.join(repo, 'original.tsx'); writeFileSync(source, 'original source fixture');
  const font = readFileSync('extract/computed/fonts/inter/inter-latin-variable.woff2').toString('base64');
  const reference = { id: 'a'.repeat(64), files: { [source]: evidenceSha(readFileSync(source)) },
    css: `@font-face{font-family:'Alias';src:url(data:font/woff2;base64,${font});font-weight:100 900}:root{--primary:oklch(0.205 0 0);--input:oklch(0.922 0 0);--card:oklch(1 0 0);--radius:0.625rem}button{display:inline-flex;height:36px;border-radius:8px;font:500 14px/20px 'Alias';background-color:oklch(0.205 0 0);color:white;opacity:1}`,
    javascript: `document.querySelector('#root').innerHTML='<button data-slot="button">Fixture label</button>';`,
    cohort: builtinReactCohort, sourceRoot: repo,
  };
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1, colorScheme: 'light' });
  const page = await context.newPage(), failures = watchSourceFailures(page);
  let captured, sourcePng: Buffer;
  try {
    await page.setContent(reactReferenceHtml(reference));
    captured = await captureValidatedTree(page, reactReferenceProfile('button-default'), failures, '#root', '--');
    assert.equal(captured.status, 'captured', JSON.stringify(captured));
    sourcePng = await page.screenshot({ fullPage: true, caret: 'initial' });
    assert.equal(evidenceSha(sourcePng), captured.sourcePngSha256);
  } finally { failures.dispose(); await browser.close(); }
  if (captured.status !== 'captured') throw Error('capture required');
  const operationId = '11111111-1111-4111-8111-111111111111';
  const report: ReactOwnershipReport = { id: '22222222-2222-4222-8222-222222222222', referenceId: reference.id,
    state: 'complete', acceptedContract: null, denominator: 1, matched: 1, sourceUnchanged: true, rows: [{
      id: 'button-default', matched: true, problems: [], treeSha256: captured.treeSha256, sourceImage: captured.sourcePngSha256,
      ownership: { version: 1, rendererVersions: [], components: [], nodes: [], problems: [] },
      rootMatrix: { version: 1, qualification: 'combined-property-root-draft', acceptedContract: null, problems: [],
        draft: { status: 'native-compiled', problems: [], properties: [], observations: [], lowerings: [], limitations: [], sizing: [] } } as ReactOwnershipReport['rows'][number]['rootMatrix'],
    }] };
  const dir = path.join(repo, 'private/react-source-ownership', reference.id, report.id);
  mkdirSync(path.join(dir, 'button-default'), { recursive: true });
  writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report));
  writeFileSync(path.join(dir, 'program.json'), JSON.stringify({ files: reference.files }));
  writeFileSync(path.join(dir, 'button-default/source-tree.json'), JSON.stringify(captured));
  writeFileSync(path.join(dir, 'button-default/source.png'), sourcePng!);
  writeFileSync(path.join(dir, 'integrity.json'), JSON.stringify({ version: 1, files: inventoryEvidence(dir) }));
  const request = selectReactNativeRequest(repo, report, 'button-default');
  const originalContent=readReactNativeContentEvidence(repo,reference,request);
  withEvidenceReadSnapshot(()=>{
    const first=readReactNativeContentEvidence(repo,reference,request);
    first.captured.treeSha256='changed caller copy';
    writeFileSync(source,'source changed after display snapshot');
    assert.deepEqual(readReactNativeContentEvidence(repo,reference,structuredClone(request)),originalContent);
    assert.throws(()=>readReactNativeContentEvidence(repo,reference,{...request,inventorySha256:'f'.repeat(64)}),/unavailable/);
  });
  assert.throws(()=>readReactNativeContentEvidence(repo,reference,request),/unavailable/);
  writeFileSync(source,'original source fixture');
  assert.deepEqual(readReactNativeContentEvidence(repo,reference,request),originalContent);
  const loadFrame = () => ({ reference, request });
  const frames = createReactSourceFramingStore(repo, loadFrame);
  const framed = await frames.create(reference.id, operationId);
  assert.equal(framed.qualification, 'unqualified');
  assert.equal(framed.bounds.height, 36);
  assert(framed.bounds.width > 0 && framed.crop.width < 900);
  const framedPixels = PNG.sync.read(frames.image(reference.id, operationId, framed.imageSha256));
  const originalPixels = PNG.sync.read(sourcePng!);
  for (let y = 0; y < framedPixels.height; y++) for (let x = 0; x < framedPixels.width; x++) {
    const from = ((y + framed.crop.y) * originalPixels.width + x + framed.crop.x) * 4;
    const to = (y * framedPixels.width + x) * 4;
    assert.deepEqual(framedPixels.data.subarray(to, to + 4), originalPixels.data.subarray(from, from + 4));
  }
  assert.deepEqual(createReactSourceFramingStore(repo, loadFrame).read(reference.id, operationId), framed);
  assert.deepEqual(await frames.create(reference.id, operationId), framed, 'repeat reuses the immutable source-only measurement');
  const frameInput = loadReactFrameInput(repo, reference, request);
  const typography = await measureReactSourceTypography(frameInput);
  assert.equal(typography.sourceSha256, captured.sourcePngSha256);
  assert.equal(typography.rows.length, 1);
  assert.equal(typography.rows[0].text, 'Fixture label');
  assert.equal(typography.rows[0].family, 'Inter');
  assert.equal(typography.rows[0].weight, '500');
  assert.equal(typography.rows[0].lines, 1);
  assert(typography.rows[0].width > 0);
  assert.deepEqual(await measureReactSourceTypography(frameInput), typography);
  await assert.rejects(measureReactSourceTypography({ ...frameInput, reference: { ...reference, css: reference.css + 'button{font-family:serif}' } }), /original-changed/);
  for (const css of ['button{margin-left:1px}', 'button{visibility:hidden}', 'button{font-family:serif}']) {
    await assert.rejects(measureReactSourceFrame({ ...frameInput, reference: { ...reference, css: reference.css + css } }), /original-changed/);
  }
  // Persistence and preview checks reuse a sealed source fixture. Actual fresh
  // mounts and restoration are exercised in react-property-probe.test.ts.
  const initialRequest = { version: 1, anchor: request, caseId: 'button-default' };
  const initialId = '33333333-3333-4333-8333-333333333333';
  const initialRoot = path.join(repo, 'private/react-initial-inspections', revisionOf(initialRequest).slice(7));
  const initialDir = path.join(initialRoot, initialId);
  mkdirSync(path.join(initialDir, 'states'), { recursive: true });
  const initialReport = { id: initialId, caseId: 'button-default', phase: 'complete', sourceUnchanged: true, problems: [],
    observation: { rows: [{ id: '0', status: 'observed', image: captured.sourcePngSha256, treeSha256: captured.treeSha256 }] } };
  writeFileSync(path.join(initialDir, 'request.json'), JSON.stringify(initialRequest));
  writeFileSync(path.join(initialDir, 'report.json'), JSON.stringify(initialReport));
  writeFileSync(path.join(initialDir, 'states/0.png'), sourcePng!);
  writeFileSync(path.join(initialDir, 'states/0.json'), JSON.stringify({ image: captured.sourcePngSha256, treeSha256: captured.treeSha256, bounds: framed.bounds }));
  const seal = JSON.stringify({ version: 1, files: inventoryEvidence(initialDir) });
  writeFileSync(path.join(initialDir, 'integrity.json'), seal);
  writeFileSync(path.join(initialRoot, 'latest.json'), JSON.stringify({ id: initialId, inventorySha256: evidenceSha(seal) }));
  const initialStore = () => createReactInitialInspectionStore(repo, repo, () => ({ reference, anchor: request }));
  assert.throws(() => initialStore().read(reference.id, 'button-default', 'instance-9'), /nested-instance-unavailable/,
    'a caller cannot select a child absent from the sealed ownership record');
  assert.throws(() => initialStore().read(reference.id, 'button-default', '../outside'), /instance-invalid/);
  const reopened = initialStore().read(reference.id, 'button-default')!;
  const { draft: diagnosticDraft, ...reopenedObservation } = reopened;
  assert.deepEqual(reopenedObservation, initialReport);
  const currentAnchor = { ...request, compilation: 'current' as const };
  const recovered = createReactInitialInspectionStore(repo, repo, () => ({ reference,
    anchor: currentAnchor, anchors: [request] }));
  assert.deepEqual(recovered.read(reference.id, 'button-default'), reopened,
    'a compiler anchor change reopens the same authenticated source observation');
  assert.equal(recovered.start(reference.id, 'button-default').state.id, initialId);
  assert.equal(createReactInitialInspectionStore(repo, repo, () => ({ reference,
    anchor: currentAnchor, anchors: [{ ...request, inventorySha256: '0'.repeat(64) }] }))
    .read(reference.id, 'button-default'), undefined, 'different source seals cannot supply the missing observation');
  assert.equal(diagnosticDraft?.status, 'refused', 'a persistence-only fixture does not qualify a source contract');
  const repeated = initialStore().start(reference.id, 'button-default'); await repeated.promise;
  assert.equal(repeated.state.id, initialId, 'a completed observation reopens without a new mount');
  // OBSERVER IDENTITY. The run above records no observer and refuses for reasons a new mount cannot answer: it stays final.
  assert.equal(reopened.reobservable, undefined, 'an unrecorded observer alone is not stale');
  const draftOf = (problems: string[]) => ({ problems }) as NonNullable<typeof reopened.draft>, was = { x: '1' }, now = { x: '2' };
  assert.deepEqual([
    reactInitialReobservable({ ...reopened, draft: draftOf([]) }, now), reactInitialReobservable({ ...reopened, draft: draftOf(['react-initial-contract-root-sizing-unqualified:height']) }, now),
    reactInitialReobservable({ ...reopened, draft: draftOf(['react-initial-contract-descendant-evidence-unobserved']) }, now),
    reactInitialReobservable({ ...reopened, observer: was, draft: draftOf([]) }, now), reactInitialReobservable({ ...reopened, observer: now, draft: draftOf(['react-initial-contract-descendant-evidence-unobserved']) }, now),
    reactInitialReobservable({ ...reopened, observer: now, draft: draftOf([]) }, now), reactInitialReobservable({ ...reopened, phase: 'failed', observer: was }, now),
    reactInitialReobservable({ ...reopened, observer: was, draft: draftOf([]) }, { [observerIdentityUnavailable]: 'x' }),
  ], [undefined, undefined, 'observer-unrecorded-and-evidence-unobserved', 'observer-changed', 'evidence-unobserved-by-recorded-observer', undefined, undefined, undefined],
    'evidence can come to be read from a reader outside the module list: an equal recorded observer must not strand the run; an unavailable identity calls nothing stale');
  const identity = reactInitialObserverIdentity();
  assert.deepEqual(Object.keys(identity), [...reactInitialObserverModules, 'playwright-core']);
  assert.match(identity['playwright-core'], /^\d+\.\d+\.\d+\S* chromium \d+(\.\d+)+ r\d+$/, 'the browser that renders the mounts is part of what an observation says');
  assert.ok(!reactInitialObserverModules.some(f => /initial-contract|descendant-geometry|observed-content|emit-figma|fuse/.test(f)), 'assembly re-runs on read: it is not the observer');
  // A run that RECORDS its observer: final under the same observer, observable again under another one.
  const recordedId = '44444444-4444-4444-8444-444444444444', recordedDir = path.join(initialRoot, recordedId);
  mkdirSync(path.join(recordedDir, 'states'), { recursive: true });
  for (const file of ['request.json', 'states/0.png', 'states/0.json']) writeFileSync(path.join(recordedDir, file), readFileSync(path.join(initialDir, file)));
  writeFileSync(path.join(recordedDir, 'report.json'), JSON.stringify({ ...initialReport, id: recordedId, observer: was }));
  const recordedSeal = JSON.stringify({ version: 1, files: inventoryEvidence(recordedDir) });
  writeFileSync(path.join(recordedDir, 'integrity.json'), recordedSeal);
  const latestBytes = JSON.stringify({ id: recordedId, inventorySha256: evidenceSha(recordedSeal) });
  writeFileSync(path.join(initialRoot, 'latest.json'), latestBytes);
  const observedBy = (observer: Record<string, string>) => createReactInitialInspectionStore(repo, repo, () => ({ reference, anchor: request }), observer);
  assert.equal(observedBy(was).read(reference.id, 'button-default')!.reobservable, undefined);
  assert.equal(observedBy(was).start(reference.id, 'button-default').state.id, recordedId, 'the same observer would say the same: final');
  const changed = observedBy(now), runs = () => readdirSync(initialRoot).filter(f => f !== 'latest.json').sort();
  assert.equal(changed.read(reference.id, 'button-default')!.reobservable, 'observer-changed');
  const kept = [initialDir, recordedDir].map(dir => JSON.stringify(inventoryEvidence(dir))), before = runs();
  const again = changed.start(reference.id, 'button-default');
  assert.deepEqual([again.state.phase, again.state.observer, again.state.id === recordedId], ['running', now, false], 'a NEW run under the same key');
  assert.equal(changed.start(reference.id, 'button-default'), again, 'a second request while it runs is the running one');
  assert.equal(changed.read(reference.id, 'button-default')!.id, again.state.id);
  assert.equal(changed.running({ version: 1, anchor: request, caseId: 'button-default' })!.id, again.state.id);
  await again.promise;
  // This fixture's source cannot be mounted, so the attempt FAILS: it is kept and reported, and it replaces nothing.
  assert.equal(again.state.phase, 'failed'); assert.ok(again.state.problems.length);
  assert.deepEqual(runs(), [...before, again.state.id].sort());
  assert.deepEqual([initialDir, recordedDir].map(dir => JSON.stringify(inventoryEvidence(dir))), kept, 'earlier runs are byte-for-byte untouched');
  assert.equal(readFileSync(path.join(initialRoot, 'latest.json'), 'utf8'), latestBytes, 'a failed attempt does not move latest');
  const sealedAttempt = JSON.parse(readFileSync(path.join(initialRoot, again.state.id, 'report.json'), 'utf8'));
  assert.deepEqual([sealedAttempt.phase, sealedAttempt.observer, sealedAttempt.reobservable], ['failed', now, undefined], 'the run records its observer; the derived fact is never saved');
  const after = changed.read(reference.id, 'button-default')!;
  assert.deepEqual([after.id, after.reobservable, after.lastAttempt], [recordedId, 'observer-changed', { id: again.state.id, problems: again.state.problems }]);
  writeFileSync(path.join(initialRoot, 'latest.json'), JSON.stringify({ id: initialId, inventorySha256: evidenceSha(seal) }));
  assert.deepEqual(PNG.sync.read(initialStore().image(reference.id, 'button-default', initialId, '0')).data, framedPixels.data);
  assert.throws(() => initialStore().image(reference.id, 'button-default', initialId, '../0'), /row-invalid/);
  const pinned = { version: 1 as const, kind: 'react-initial-draft' as const, anchor: request, caseId: 'button-default',
    observation: { id: initialId, inventorySha256: evidenceSha(seal), reportSha256: evidenceSha(readFileSync(path.join(initialDir, 'report.json'))) } };
  assert.throws(() => initialStore().nativeRequest(reference.id, 'button-default'), /observation-unavailable/, 'an incomplete derived contract cannot authorize delivery');
  writeFileSync(path.join(initialRoot, 'latest.json'), JSON.stringify({ id: '99999999-9999-4999-8999-999999999999', inventorySha256: '0'.repeat(64) }));
  assert.deepEqual(PNG.sync.read(initialStore().nativeImage(reference, pinned, '0')).data, framedPixels.data, 'pinned delivery never follows a changed latest pointer');
  assert.throws(() => initialStore().nativeImage(reference, { ...pinned, observation: { ...pinned.observation, reportSha256: '0'.repeat(64) } }, '0'), /report-changed/);
  assert.throws(() => initialStore().nativeImage(reference, { ...pinned, observation: { ...pinned.observation, inventorySha256: '0'.repeat(64) } }, '0'), /inventory-changed/);
  writeFileSync(path.join(initialRoot, 'latest.json'), JSON.stringify({ id: initialId, inventorySha256: evidenceSha(seal) }));
  writeFileSync(path.join(initialDir, 'states/0.png'), Buffer.from('changed'));
  assert.throws(() => recovered.read(reference.id, 'button-default'), /evidence-changed/);
  assert.throws(() => initialStore().read(reference.id, 'button-default'), /evidence-changed/);
  assert.throws(() => initialStore().image(reference.id, 'button-default', initialId, '0'), /evidence-changed/);
  writeFileSync(path.join(initialDir, 'states/0.png'), sourcePng!);
  const job = startReactContentInspection(repo, reference, request, operationId);
  await job.promise;
  assert.equal(job.state.phase, 'complete', job.state.problems.join('\n'));
  assert.equal(job.state.sourceUnchanged, true);
  assert.equal(job.state.content?.status, 'compiled-comparison-draft');
  assert.deepEqual(job.state.fontFamilies, ['Inter']);
  assert.equal(job.state.gridConstraints?.status, 'observed');
  assert.deepEqual(job.state.gridConstraints?.rows, []);
  assert.equal(job.state.labelAssociations?.status, 'observed');
  assert.deepEqual(job.state.labelAssociations?.rows, []);
  assert.deepEqual(readReactContentInspection(repo, reference, request, operationId), job.report());
  const paired = readReactContentInspectionEvidence(repo, reference, request, operationId)!;
  assert.deepEqual(paired.report, job.report());
  assert.deepEqual(paired.original.captured.tree, captured.tree);
  paired.original.captured.tree.nodes = [];
  paired.report.sourceUnchanged = false;
  const pairedReopened = readReactContentInspectionEvidence(repo, reference, request, operationId)!;
  assert.equal(pairedReopened.report.sourceUnchanged, true);
  assert.deepEqual(pairedReopened.original.captured.tree, captured.tree, 'paired reads return fresh isolated evidence');
  const fonts = path.join(job.dir, 'text-fonts.json'), bytes = readFileSync(fonts);
  writeFileSync(fonts, '{}');
  assert.throws(() => readReactContentInspection(repo, reference, request, operationId), /evidence-changed/);
  assert.equal(job.report().phase, 'failed', 'the in-memory UI view must also recheck saved evidence');
  writeFileSync(fonts, bytes);
  const grids = path.join(job.dir, 'grid-constraints.json'), gridBytes = readFileSync(grids);
  writeFileSync(grids, '{}');
  assert.throws(() => readReactContentInspection(repo, reference, request, operationId), /evidence-changed/);
  writeFileSync(grids, gridBytes);
  const labels = path.join(job.dir, 'label-associations.json'), labelBytes = readFileSync(labels);
  writeFileSync(labels, '{}');
  assert.throws(() => readReactContentInspection(repo, reference, request, operationId), /evidence-changed/);
  writeFileSync(labels, labelBytes);
  writeFileSync(source, 'changed source');
  assert.throws(() => initialStore().read(reference.id, 'button-default'), /evidence-unavailable/);
  assert.throws(() => frames.read(reference.id, operationId), /evidence-unavailable/);
  assert.throws(() => readReactContentInspection(repo, reference, request, operationId), /evidence-unavailable/);
  assert.equal(job.report().sourceUnchanged, false);
  assert.throws(() => startReactContentInspection(repo, reference, request, '../outside'), /operation-invalid/);
});
