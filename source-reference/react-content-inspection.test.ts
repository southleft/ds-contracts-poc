import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright-core';
import { captureValidatedTree } from './capture.js';
import { watchSourceFailures } from './observe.js';
import { reactReferenceHtml } from './react-reference.js';
import { reactReferenceProfile } from './react-reference-profiles.js';
import { evidenceSha, inventoryEvidence } from './react-validation-evidence.js';
import { selectReactNativeRequest } from './react-native-evidence.js';
import { startReactContentInspection, readReactContentInspection } from './react-content-inspection.js';
import type { ReactOwnershipReport } from './react-ownership-run.js';

test('targeted content preparation matches sealed rendering, survives reopening and refuses changed evidence', async t => {
  const repo = mkdtempSync(path.join(tmpdir(), 'react-content-'));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const source = path.join(repo, 'original.tsx'); writeFileSync(source, 'original source fixture');
  const font = readFileSync('extract/computed/fonts/inter/inter-latin-variable.woff2').toString('base64');
  const reference = { id: 'a'.repeat(64), files: { [source]: evidenceSha(readFileSync(source)) },
    css: `@font-face{font-family:'Alias';src:url(data:font/woff2;base64,${font});font-weight:100 900}:root{--primary:oklch(0.205 0 0);--input:oklch(0.922 0 0);--card:oklch(1 0 0);--radius:0.625rem}button{display:inline-flex;height:36px;border-radius:8px;font:500 14px/20px 'Alias';background-color:oklch(0.205 0 0);color:white;opacity:1}`,
    javascript: `document.querySelector('#root').innerHTML='<button data-slot="button">Fixture label</button>';`,
  };
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1, colorScheme: 'light' });
  const page = await context.newPage(), failures = watchSourceFailures(page);
  let captured;
  try {
    await page.setContent(reactReferenceHtml(reference));
    captured = await captureValidatedTree(page, reactReferenceProfile('button-default'), failures, '#root', '--');
    assert.equal(captured.status, 'captured', JSON.stringify(captured));
  } finally { failures.dispose(); await browser.close(); }
  if (captured.status !== 'captured') throw Error('capture required');
  const operationId = '11111111-1111-4111-8111-111111111111';
  const report: ReactOwnershipReport = { id: '22222222-2222-4222-8222-222222222222', referenceId: reference.id,
    state: 'complete', acceptedContract: null, denominator: 1, matched: 1, sourceUnchanged: true, rows: [{
      id: 'button-default', matched: true, problems: [], treeSha256: captured.treeSha256,
      rootMatrix: { version: 1, qualification: 'combined-property-root-draft', acceptedContract: null, problems: [],
        draft: { status: 'native-compiled', problems: [], properties: [], observations: [], lowerings: [], limitations: [], sizing: [] } } as ReactOwnershipReport['rows'][number]['rootMatrix'],
    }] };
  const dir = path.join(repo, 'private/react-source-ownership', reference.id, report.id);
  mkdirSync(path.join(dir, 'button-default'), { recursive: true });
  writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report));
  writeFileSync(path.join(dir, 'program.json'), JSON.stringify({ files: reference.files }));
  writeFileSync(path.join(dir, 'button-default/source-tree.json'), JSON.stringify(captured));
  writeFileSync(path.join(dir, 'integrity.json'), JSON.stringify({ version: 1, files: inventoryEvidence(dir) }));
  const request = selectReactNativeRequest(repo, report, 'button-default');
  const job = startReactContentInspection(repo, reference, request, operationId);
  await job.promise;
  assert.equal(job.state.phase, 'complete', job.state.problems.join('\n'));
  assert.equal(job.state.sourceUnchanged, true);
  assert.equal(job.state.content?.status, 'compiled-comparison-draft');
  assert.deepEqual(job.state.fontFamilies, ['Inter']);
  assert.deepEqual(readReactContentInspection(repo, reference, request, operationId), job.report());
  const fonts = path.join(job.dir, 'text-fonts.json'), bytes = readFileSync(fonts);
  writeFileSync(fonts, '{}');
  assert.throws(() => readReactContentInspection(repo, reference, request, operationId), /evidence-changed/);
  assert.equal(job.report().phase, 'failed', 'the in-memory UI view must also recheck saved evidence');
  writeFileSync(fonts, bytes);
  writeFileSync(source, 'changed source');
  assert.throws(() => readReactContentInspection(repo, reference, request, operationId), /evidence-unavailable/);
  assert.equal(job.report().sourceUnchanged, false);
  assert.throws(() => startReactContentInspection(repo, reference, request, '../outside'), /operation-invalid/);
});
