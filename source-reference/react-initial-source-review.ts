/** Supplemental source review of one pinned initial mount. Native exports and
 * qualification records are never changed or scored by this capture. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { revisionOf } from '../core/contract-provenance.js';
import { reactReferenceHtml, reactReferenceUnchanged, type ReactReference } from './react-reference.js';
import { buildReactOwnershipReference, reactOwnershipHook, reactOwnershipRead } from './react-ownership.js';
import { reactSourceProgramUnchanged } from './react-source-program.js';
import { watchSourceFailures } from './observe.js';
import { captureMatchedInitialTree } from './react-initial-capture.js';
import { probeReactInitialProperties } from './react-property-probe.js';
import { captureTransparentSourceFrame } from './transparent-source-frame-v2.js';
import { evidenceSha, inventoryEvidence } from './react-validation-evidence.js';
import type { createReactInitialInspectionStore } from './react-initial-inspection.js';
import type { ReactInitialNativeRequest } from './react-initial-native-request.js';
import type { SourceFrame } from './source-framing.js';

type Recorded = ReturnType<ReturnType<typeof createReactInitialInspectionStore>['repairEvidence']>;
export interface ReactInitialSourceReview {
  id: string; rowId: string; requestRevision: string; sourceImageSha256: string; treeSha256: string;
  frame: SourceFrame; image: string; qualification: 'unqualified';
}

/** Browser diagnostics carry named refusals, never host paths or tool logs. */
export function initialSourceReviewReason(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  return /^(?:react-|transparent-source-frame-)[a-z0-9-]{1,160}(?::[a-z0-9-]{1,80})?$/.test(message)
    ? message : 'react-initial-source-review-unavailable';
}

export async function captureReactInitialSourceReview(repo: string, sourceRoot: string, reference: ReactReference,
  request: ReactInitialNativeRequest, rowId: string, load: () => Recorded): Promise<ReactInitialSourceReview> {
  if (request.version !== 1 || !/^\d+$/.test(rowId)) throw Error('react-initial-source-review-root-required');
  const recorded = load(), pin = revisionOf(recorded), original = recorded.original;
  const row = recorded.observation.rows.find(r => r.id === rowId && r.status === 'observed' && r.restored);
  if (!row?.image || !row.treeSha256 || !recorded.nativeVariants.some(v => v.observation === rowId))
    throw Error('react-initial-source-review-row-unavailable');
  const assertCurrent = () => {
    if (!reactReferenceUnchanged(reference) || !reactSourceProgramUnchanged(original.program) || revisionOf(load()) !== pin)
      throw Error('react-initial-source-review-input-changed');
  };
  assertCurrent();
  const observed = await buildReactOwnershipReference(sourceRoot, reference, original.program);
  const browser = await chromium.launch();
  let capture: Awaited<ReturnType<typeof captureTransparentSourceFrame>> | undefined;
  try {
    const context = await browser.newContext({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1, colorScheme: 'light' });
    await context.addInitScript(reactOwnershipHook);
    const url = 'http://127.0.0.1/react-ownership?case=' + request.caseId;
    await context.route('**/*', r => r.request().url() === url ? r.fulfill({ status: 200, contentType: 'text/html',
      headers: { 'Content-Security-Policy': "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'" },
      body: reactReferenceHtml(observed) }) : r.abort());
    const page = await context.newPage(), failures = watchSourceFailures(page);
    const selector = reference.cohort.profile(request.caseId).path[0];
    try {
      await page.goto(url); await page.locator(selector).waitFor({ state: 'attached', timeout: 15000 });
      const baseline = { treeSha256: original.captured.treeSha256, image: original.captured.sourcePngSha256 };
      await captureMatchedInitialTree(page, [selector], baseline, failures);
      const ownership = await page.evaluate(reactOwnershipRead(selector));
      if (revisionOf(ownership) !== revisionOf(original.ownership)) throw Error('react-initial-source-review-ownership-changed');
      const result = await probeReactInitialProperties(page, selector, original.program, recorded.observation.instanceId, row.changes,
        async phase => {
          assertCurrent();
          const expected = phase === 'changed' ? { treeSha256: row.treeSha256!, image: row.image! } : baseline;
          await captureMatchedInitialTree(page, [selector], expected, failures);
          if (phase === 'changed') {
            capture = await captureTransparentSourceFrame(page, selector, row.image!);
            await captureMatchedInitialTree(page, [selector], expected, failures);
          }
          return expected;
        });
      if (!result.ownershipRestored || !capture) throw Error('react-initial-source-review-not-restored');
      await captureMatchedInitialTree(page, [selector], baseline, failures);
      assertCurrent();
    } finally { failures.dispose(); }
  } finally { await browser.close(); }
  assertCurrent();
  const id = randomUUID(), dir = path.join(repo, 'private/react-initial-source-reviews', id), receipt = capture!.receipt;
  const frame: SourceFrame = { version: 1, sourceSha256: row.image, inputSha256: revisionOf({ request, rowId }).slice(7),
    imageSha256: receipt.imageSha256, bounds: receipt.bounds, crop: receipt.crop, sourceSize: receipt.sourceSize, qualification: 'unqualified' };
  const review: ReactInitialSourceReview = { id, rowId, requestRevision: revisionOf(request), sourceImageSha256: row.image,
    treeSha256: row.treeSha256, frame, image: 'data:image/png;base64,' + capture!.bytes.toString('base64'), qualification: 'unqualified' };
  mkdirSync(dir, { recursive: true });
  for (const [name, bytes] of Object.entries({ 'original.png': capture!.original, 'context.png': capture!.withContext,
    'transparent.png': capture!.transparent, 'source.png': capture!.bytes })) writeFileSync(path.join(dir, name), bytes, { flag: 'wx' });
  writeFileSync(path.join(dir, 'receipt.json'), JSON.stringify({ request, rowId, pin, receipt, frame, sourceSha256: evidenceSha(capture!.bytes) }, null, 2) + '\n', { flag: 'wx' });
  writeFileSync(path.join(dir, 'integrity.json'), JSON.stringify({ version: 1, files: inventoryEvidence(dir) }, null, 2) + '\n', { flag: 'wx' });
  return review;
}
