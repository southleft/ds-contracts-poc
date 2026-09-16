/** Source-only framing: remeasure the unchanged original, crop its archived
 * pixels, and keep the full original and native evidence untouched. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { revisionOf } from '../core/contract-provenance.js';
import { reactReferenceHtml, type ReactReference } from './react-reference.js';
import { readReactNativeContentEvidence } from './react-native-evidence.js';
import { reactReferenceProfile } from './react-reference-profiles.js';
import type { ReactNativeRequest } from './react-native-request.js';
import { captureValidatedTree } from './capture.js';
import { watchSourceFailures } from './observe.js';
import { createPinnedSourceFramingStore, sourceBounds } from './source-framing.js';

export function loadReactFrameInput(repoRoot: string, reference: ReactReference, request: ReactNativeRequest) {
  const { captured } = readReactNativeContentEvidence(repoRoot, reference, request);
  return { reference, request, captured, sourceSha256: captured.sourcePngSha256,
    source: readFileSync(path.join(repoRoot, 'private/react-source-ownership', request.referenceId, request.ownership.id, request.caseId, 'source.png')) };
}
export async function measureReactSourceFrame(input: ReturnType<typeof loadReactFrameInput>) {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1, colorScheme: 'light' });
    const url = 'http://127.0.0.1/react-ownership?case=' + input.request.caseId;
    await context.route('**/*', route => route.request().url() === url ? route.fulfill({ status: 200, contentType: 'text/html',
      headers: { 'Content-Security-Policy': "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'" },
      body: reactReferenceHtml(input.reference),
    }) : route.abort());
    const page = await context.newPage(), failures = watchSourceFailures(page), profile = reactReferenceProfile(input.request.caseId);
    try {
      await page.goto(url);
      await page.locator(profile.path[0]).waitFor({ state: 'attached', timeout: 15000 });
      const before = await captureValidatedTree(page, profile, failures, '#root', '--');
      const bounds = await sourceBounds(page, profile);
      const after = await captureValidatedTree(page, profile, failures, '#root', '--');
      if ([before, after].some(c => c.status !== 'captured' || c.treeSha256 !== input.captured.treeSha256 || c.sourcePngSha256 !== input.sourceSha256) ||
          revisionOf(bounds) !== revisionOf(await sourceBounds(page, profile)))
        throw Error('react-source-framing-original-changed');
      return bounds;
    } finally { failures.dispose(); }
  } finally { await browser.close(); }
}
export function createReactSourceFramingStore(repoRoot: string,
  load: (referenceId: string, operationId: string) => { reference: ReactReference; request: ReactNativeRequest },
) {
  return createPinnedSourceFramingStore(repoRoot, (referenceId, operationId) => {
    const { reference, request } = load(referenceId, operationId);
    if (reference.id !== referenceId || request.referenceId !== referenceId) throw Error('react-source-framing-reference-changed');
    return loadReactFrameInput(repoRoot, reference, request);
  }, measureReactSourceFrame, input => revisionOf({ version: 1, kind: 'react-source-framing', request: input.request,
    sourceSha256: input.sourceSha256, treeSha256: input.captured.treeSha256 }).slice(7));
}
