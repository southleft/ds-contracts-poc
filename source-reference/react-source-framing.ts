/** Source-only framing: remeasure the unchanged original, crop its archived
 * pixels, and keep the full original and native evidence untouched. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright-core';
import { revisionOf } from '../core/contract-provenance.js';
import { reactReferenceHtml, type ReactReference } from './react-reference.js';
import { readReactNativeContentEvidence } from './react-native-evidence.js';
import { reactReferenceProfile } from './react-reference-profiles.js';
import type { ReactNativeRequest } from './react-native-request.js';
import { captureValidatedTree } from './capture.js';
import { watchSourceFailures } from './observe.js';
import { createPinnedSourceFramingStore, sourceBounds } from './source-framing.js';
import { observeTextFonts } from './text-fonts.js';

export interface SourceTypography {
  sourceSha256: string;
  treeSha256: string;
  qualification: 'unqualified';
  rows: Array<{ text: string; path: number[]; width: number; lines: number; family: string; face: string; size: string; weight: string }>;
}

export function loadReactFrameInput(repoRoot: string, reference: ReactReference, request: ReactNativeRequest) {
  const { captured } = readReactNativeContentEvidence(repoRoot, reference, request);
  return { reference, request, captured, sourceSha256: captured.sourcePngSha256,
    source: readFileSync(path.join(repoRoot, 'private/react-source-ownership', request.referenceId, request.ownership.id, request.caseId, 'source.png')) };
}
export async function measureReactSourceFrame(input: ReturnType<typeof loadReactFrameInput>) {
  return inspectOriginal(input, page => sourceBounds(page, reactReferenceProfile(input.request.caseId)));
}
/** Read glyph advances from the unchanged original. Family-name equality is
 * not proof of matching font binaries or glyph metrics across renderers. */
export async function measureReactSourceTypography(input: ReturnType<typeof loadReactFrameInput>): Promise<SourceTypography> {
  const rows = await inspectOriginal(input, async page => {
    const profile = reactReferenceProfile(input.request.caseId);
    const fonts = await observeTextFonts(page, profile.path, input.captured.tree);
    if (fonts.status !== 'observed' || fonts.problems.length) throw Error('react-source-typography-fonts-unavailable');
    return page.evaluate(({ selectors, rows }) => rows.map(row => {
      let scope: Document | ShadowRoot | null = document, element: Element | null = null;
      for (const selector of selectors) { element = scope?.querySelector(selector) ?? null; scope = element?.shadowRoot ?? null; }
      for (const index of row.path) element = element?.children[index] ?? null;
      if (!element || element.children.length) throw Error('react-source-typography-mixed-content');
      const range = document.createRange(); range.selectNodeContents(element);
      const style = getComputedStyle(element), box = range.getBoundingClientRect();
      if (element.textContent !== row.text || !Number.isFinite(box.width) || box.width <= 0)
        throw Error('react-source-typography-text-unavailable');
      return { text: row.text, path: row.path, width: box.width, lines: range.getClientRects().length,
        family: [...new Set(row.fonts.map(f => f.familyName))].join(', '),
        face: row.fonts.map(f => f.postScriptName).join(', '), size: style.fontSize, weight: style.fontWeight };
    }), { selectors: profile.path, rows: fonts.rows });
  });
  return { sourceSha256: input.sourceSha256, treeSha256: input.captured.treeSha256!, qualification: 'unqualified', rows };
}
async function inspectOriginal<T>(input: ReturnType<typeof loadReactFrameInput>, inspect: (page: Page) => Promise<T>): Promise<T> {
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
      if (before.status !== 'captured' || before.treeSha256 !== input.captured.treeSha256 || before.sourcePngSha256 !== input.sourceSha256)
        throw Error('react-source-framing-original-changed');
      const bounds = await inspect(page);
      const after = await captureValidatedTree(page, profile, failures, '#root', '--');
      if ([before, after].some(c => c.status !== 'captured' || c.treeSha256 !== input.captured.treeSha256 || c.sourcePngSha256 !== input.sourceSha256) ||
          revisionOf(bounds) !== revisionOf(await inspect(page)))
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
