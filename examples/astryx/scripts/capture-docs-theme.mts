/**
 * Astryx DOCS-SITE theme capture — `npx tsx examples/astryx/scripts/capture-docs-theme.mts`
 *
 * Loads https://astryx.atmeta.com (the docs site whose theme was never
 * published to npm — @astryxdesign/core@0.1.6 ships only theme-neutral) and
 * records, for every one of the 186 wrapped token names in
 * tokens/astryx.dtcg.json, the COMPUTED value of the matching `--<name>` CSS
 * custom property at the document root (the site's StyleX vars are SEMANTIC,
 * not hashed — `[data-astryx-theme="astryx"]` on <html> carries the docs
 * override; `light-dark(A, B)` stays unresolved in the computed custom
 * property, so ONE read yields both modes).
 *
 * Output: tokens/docs-theme.capture.json — the PINNED snapshot of an
 * external mutable site. This file is the input boundary (like a sandbox npm
 * install); build-docs-tokens.ts is a pure function of it. Verification
 * captured here, not guessed:
 *   - both pages (home + /components/Button) must agree per name (root scope)
 *   - a data-theme=dark + prefers-color-scheme:dark re-read must agree with
 *     the light read (light-dark() carries the delta); any diff is recorded
 *   - names the site does not define come back '' and are recorded verbatim
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { chromiumExecutable } from '../../../extract/figma/visual-parity/render.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const EX = path.join(HERE, '..');
const OUT = path.join(EX, 'tokens/docs-theme.capture.json');

const tokenNames = Object.keys(
  JSON.parse(readFileSync(path.join(EX, 'tokens/astryx.dtcg.json'), 'utf8')) as Record<string, unknown>,
);

const PAGES = ['https://astryx.atmeta.com/', 'https://astryx.atmeta.com/components/Button'];

const readVars = (names: string[]) => {
  const cs = getComputedStyle(document.documentElement);
  const out: Record<string, string> = {};
  for (const n of names) out[n] = cs.getPropertyValue('--' + n).trim();
  return out;
};

const browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    userAgent:
      'ds-contracts-poc docs-theme capture (open-source research; polite sequential fetch; contact: repo issues)',
  });
  const page = await context.newPage();

  const perPage: Record<string, Record<string, string>> = {};
  let htmlAttrs: string[] = [];
  for (const url of PAGES) {
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 });
    if (!resp || resp.status() !== 200) throw new Error(`capture: ${url} returned HTTP ${resp?.status()}`);
    await page.waitForTimeout(1500);
    perPage[url] = await page.evaluate(readVars, tokenNames);
    htmlAttrs = await page.evaluate(() =>
      [...document.documentElement.attributes].map((a) => `${a.name}=${a.value}`),
    );
  }

  // cross-page agreement (root-scoped theme ⇒ must be identical)
  const pageDisagreements: string[] = [];
  for (const n of tokenNames) {
    const vals = new Set(PAGES.map((u) => perPage[u][n]));
    if (vals.size > 1) pageDisagreements.push(n);
  }

  // dark re-read on the last page: flip the site's own theme attribute AND the
  // media feature; light-dark() should stay unresolved, so values must agree.
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  });
  await page.waitForTimeout(500);
  const darkRead = await page.evaluate(readVars, tokenNames);
  const darkDisagreements: Record<string, { light: string; dark: string }> = {};
  const last = perPage[PAGES[PAGES.length - 1]];
  for (const n of tokenNames) {
    if (darkRead[n] !== last[n]) darkDisagreements[n] = { light: last[n], dark: darkRead[n] };
  }

  const missing = tokenNames.filter((n) => last[n] === '');

  const capture = {
    meta: {
      capturedAt: new Date().toISOString(),
      pages: PAGES,
      browser: `chromium ${browser.version()} (playwright-core)`,
      htmlAttrs,
      tokenSource: 'tokens/astryx.dtcg.json (186 names from @astryxdesign/core@0.1.6 wrap)',
      note:
        'External mutable site — this file pins the snapshot; build-docs-tokens.ts is a pure function of it. ' +
        'Values are computed custom properties at document root; light-dark(A, B) carries both modes.',
    },
    verification: { pageDisagreements, darkDisagreements, missing },
    values: Object.fromEntries(tokenNames.map((n) => [n, last[n]])),
  };
  writeFileSync(OUT, JSON.stringify(capture, null, 2) + '\n');
  console.log(
    `✔ ${OUT}: ${tokenNames.length} names read, ${missing.length} missing on site, ` +
      `${pageDisagreements.length} cross-page disagreements, ${Object.keys(darkDisagreements).length} dark-read disagreements`,
  );
  if (pageDisagreements.length) console.log('  cross-page:', pageDisagreements.join(', '));
  if (Object.keys(darkDisagreements).length)
    console.log('  dark-read:', Object.keys(darkDisagreements).join(', '));
  if (missing.length) console.log('  missing:', missing.join(', '));
} finally {
  await browser.close();
}
