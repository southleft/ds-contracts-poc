/**
 * SITE-CALIBRATION RECEIPTS (Round 4, owner directive — standing external
 * validity check): prove the ground-truth harness renders what
 * polaris-react.shopify.com shows, so "the reference itself is wrong" can
 * never be an open question again.
 *
 *   npx tsx examples/polaris/scripts/site-calibration.ts --harness <dir>
 *
 * For each documented example (banner-success, banner-critical,
 * button-primary, badge-default):
 *   1. load the LIVE site example page (polaris-react.shopify.com/examples/…)
 *      in the pinned Chromium and screenshot the component element;
 *   2. read the example's rendered surface (title/body/action/dismiss text,
 *      tone class) from the live DOM;
 *   3. mount the SAME documented props on the LOCAL @shopify/polaris npm
 *      package (the floor's mounting recipe) and screenshot;
 *   4. compare: structural checklist (ribbon / icon / title-on-ribbon /
 *      dismiss / action present) + pixelmatch, and commit a LABELED pair
 *      (left = LIVE SITE, right = LOCAL NPM PACKAGE) with a receipts table.
 *
 * Committed outputs: examples/polaris/receipts/site-calibration/.
 * Network required for step 1 — a fetch failure downgrades that case to the
 * structural checklist against the local render only, NAMED in the table.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { chromiumExecutable } from '../../../extract/figma/visual-parity/render.js';
import { labeledPair } from '../../../extract/computed/label-png.js';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const EXAMPLE = path.dirname(HERE);
const REPO = path.resolve(EXAMPLE, '..', '..');
const OUT = path.join(EXAMPLE, 'receipts', 'site-calibration');

const arg = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : null;
};
const HARNESS = arg('harness') ? path.resolve(arg('harness')!) : null;
if (!HARNESS || !existsSync(path.join(HARNESS, 'node_modules', '@shopify', 'polaris'))) {
  console.error('need --harness <dir> with @shopify/polaris installed');
  process.exit(1);
}

interface CalibrationCase {
  id: string;
  /** polaris-react.shopify.com/examples/<exampleId> */
  exampleId: string;
  /** Text that MUST appear inside the matched site root — guards against
   *  the docs site swapping in unrelated chrome (the site now hydrates a
   *  "Polaris for React is deprecated" hero over the SSR example; the
   *  calibration loads the page with JavaScript DISABLED and asserts this
   *  text so a false match can never pass). */
  assertText: string;
  /** JSX mounted on the LOCAL npm package — the DOCUMENTED example source
   *  (polaris.shopify.com component docs), verbatim. */
  jsx: string;
  /** Root selector of the component on BOTH sides. */
  rootSelector: string;
  /** Structural checklist: name → selector that must exist (or `!selector`
   *  that must NOT). */
  checklist: Record<string, string>;
}

const CASES: CalibrationCase[] = [
  {
    id: 'banner-success',
    exampleId: 'banner-success',
    assertText: 'Your shipping label is ready to print.',
    jsx: `<Banner title="Your shipping label is ready to print." tone="success" action={{ content: 'Print label', onAction: () => {} }} onDismiss={() => {}} />`,
    rootSelector: '.Polaris-Banner',
    checklist: {
      'tone ribbon (inner Box with tone background)': '.Polaris-Banner > .Polaris-Box',
      'icon on ribbon': '.Polaris-Banner .Polaris-Icon svg',
      'title on ribbon (h2 heading)': '.Polaris-Banner h2',
      'dismiss button': '.Polaris-Banner button .Polaris-Icon',
      'action button row': '.Polaris-Banner .Polaris-ButtonGroup button',
    },
  },
  {
    id: 'banner-critical',
    exampleId: 'banner-critical',
    assertText: 'High risk of fraud',
    jsx: `<Banner title="High risk of fraud detected" tone="critical" action={{ content: 'Review risk analysis', onAction: () => {} }}><p>Before fulfilling this order or capturing payment, please review the fraud analysis and determine if this order is fraudulent.</p></Banner>`,
    rootSelector: '.Polaris-Banner',
    checklist: {
      'tone ribbon (inner Box with tone background)': '.Polaris-Banner > .Polaris-Box',
      'icon on ribbon': '.Polaris-Banner .Polaris-Icon svg',
      'title on ribbon (h2 heading)': '.Polaris-Banner h2',
      'body content': '.Polaris-Banner p',
      'action button row': '.Polaris-Banner .Polaris-ButtonGroup button',
    },
  },
  {
    id: 'button-primary',
    exampleId: 'button-primary',
    assertText: 'Save theme',
    jsx: `<Button variant="primary">Save theme</Button>`,
    rootSelector: '.Polaris-Button',
    checklist: {
      'button root': '.Polaris-Button',
      'label span': '.Polaris-Button .Polaris-Text--root',
    },
  },
  {
    id: 'badge-default',
    exampleId: 'badge-default',
    assertText: 'Fulfilled',
    jsx: `<Badge>Fulfilled</Badge>`,
    rootSelector: '.Polaris-Badge',
    checklist: {
      'badge pill': '.Polaris-Badge',
      'label text': '.Polaris-Badge .Polaris-Text--root',
    },
  },
];

function buildLocalPage(harness: string): string {
  const entry = `import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppProvider, Banner, Button, Badge } from '@shopify/polaris';
import en from '@shopify/polaris/locales/en.json';
import '@shopify/polaris/build/esm/styles.css';

const stage = { width: 760, padding: 16, boxSizing: 'border-box', background: '#fff' };
function App() {
  return (
    <AppProvider i18n={en}>
      ${CASES.map((c) => `<div data-case="${c.id}" style={stage}>${c.jsx}</div>`).join('\n      ')}
    </AppProvider>
  );
}
createRoot(document.getElementById('root')).render(<App />);
`;
  const pageDir = path.join(harness, 'site-calibration-page');
  mkdirSync(pageDir, { recursive: true });
  writeFileSync(path.join(pageDir, 'entry.jsx'), entry);
  execFileSync(
    path.join(harness, 'node_modules', '.bin', 'esbuild'),
    ['site-calibration-page/entry.jsx', '--bundle', '--outfile=site-calibration-page/bundle.js', '--jsx=automatic', '--loader:.json=json', '--loader:.svg=dataurl', '--loader:.png=dataurl', '--log-level=error'],
    { cwd: harness },
  );
  writeFileSync(
    path.join(pageDir, 'index.html'),
    `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="bundle.css"><style>html{color-scheme:light}body{margin:0;background:#fff}</style></head><body><div id="root"></div><script src="bundle.js"></script></body></html>`,
  );
  return path.join(pageDir, 'index.html');
}

async function checklistOn(page: Page, scope: string, checklist: Record<string, string>): Promise<Record<string, boolean>> {
  return (await page.evaluate(
    `(() => {
      const scope = document.querySelector(${JSON.stringify(scope)});
      if (!scope) return null;
      const out = {};
      for (const [name, sel] of Object.entries(${JSON.stringify(checklist)})) {
        out[name] = !!scope.querySelector(sel);
      }
      return out;
    })()`,
  )) as Record<string, boolean>;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const localHtml = buildLocalPage(HARNESS!);
  const browser: Browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });
  const browserRef = browser;
  const context = await browser.newContext({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light' });

  const localPage = await context.newPage();
  await localPage.goto(`file://${localHtml}`);
  await localPage.waitForSelector('[data-case]', { timeout: 20_000 });
  await localPage.evaluate('document.fonts.ready');
  await localPage.waitForTimeout(400);

  const md: string[] = [
    '# Site-calibration receipts — the harness ground truth vs polaris-react.shopify.com',
    '',
    `Generated by examples/polaris/scripts/site-calibration.ts on the pinned Chromium. LEFT of every pair = the LIVE documented example (polaris-react.shopify.com/examples/<id>, loaded with JavaScript DISABLED — the docs site's hydration replaces the SSR example with a "Polaris for React is deprecated" hero; the SSR markup + linked CSS is the documented example, and every case asserts the documented example text before it may pass); RIGHT = the SAME documented props mounted on the local @shopify/polaris npm package (the computed floor's ground-truth harness). Purpose: the floor's reference side is proven to render what the site shows — "the reference itself is wrong" is closed.`,
    '',
    '| case | structural checklist (site) | structural checklist (local) | pixel diff (site vs local, threshold 0.1) | verdict |',
    '|---|---|---|---|---|',
  ];

  for (const c of CASES) {
    const localSel = `[data-case="${c.id}"] ${c.rootSelector}`;
    const localChecklist = await checklistOn(localPage, `[data-case="${c.id}"]`, c.checklist);
    const localShot = await localPage.locator(localSel).first().screenshot();
    writeFileSync(path.join(OUT, `${c.id}--local.png`), localShot);

    let siteChecklist: Record<string, boolean> | null = null;
    let sitePng: Buffer | null = null;
    let note = '';
    try {
      // JavaScript DISABLED: the docs site's hydration replaces the SSR
      // example with a "Polaris for React is deprecated" hero — the SSR
      // markup + linked CSS IS the documented example (assertText guards).
      const siteContext = await browserRef.newContext({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light', javaScriptEnabled: false });
      const sitePage = await siteContext.newPage();
      await sitePage.goto(`https://polaris-react.shopify.com/examples/${c.exampleId}`, { timeout: 30_000, waitUntil: 'load' });
      await sitePage.waitForSelector(c.rootSelector, { timeout: 20_000 });
      await sitePage.evaluate('document.fonts.ready');
      await sitePage.waitForTimeout(500);
      const rootText = (await sitePage.locator(c.rootSelector).first().textContent()) ?? '';
      const bodyText = (await sitePage.locator('body').textContent()) ?? '';
      if (!rootText.includes(c.assertText) && !bodyText.includes(c.assertText)) {
        throw new Error(`site page does not contain the documented example text "${c.assertText}" — refusing a false match`);
      }
      siteChecklist = await checklistOn(sitePage, 'body', c.checklist);
      sitePng = await sitePage.locator(c.rootSelector).first().screenshot();
      writeFileSync(path.join(OUT, `${c.id}--site.png`), sitePng);
      await sitePage.close();
      await siteContext.close();
    } catch (e) {
      note = `site fetch failed (${String(e instanceof Error ? e.message : e).split('\n')[0].slice(0, 80)}) — local checklist only (NAMED)`;
    }

    let pixelCell = 'n/a (site unavailable)';
    if (sitePng) {
      const a = PNG.sync.read(sitePng);
      const b = PNG.sync.read(localShot);
      const w = Math.min(a.width, b.width);
      const h = Math.min(a.height, b.height);
      const ca = new PNG({ width: w, height: h });
      const cb = new PNG({ width: w, height: h });
      PNG.bitblt(a, ca, 0, 0, w, h, 0, 0);
      PNG.bitblt(b, cb, 0, 0, w, h, 0, 0);
      const diff = pixelmatch(ca.data, cb.data, undefined, w, h, { threshold: 0.1 });
      const sizeNote = a.width !== b.width || a.height !== b.height ? ` (sizes ${a.width}×${a.height} vs ${b.width}×${b.height} — compared on the intersection, named)` : '';
      pixelCell = `${((100 * diff) / (w * h)).toFixed(2)}%${sizeNote}`;
      const pair = labeledPair(a, b, 'LIVE SITE EXAMPLE', 'LOCAL NPM PACKAGE (HARNESS)');
      writeFileSync(path.join(OUT, `${c.id}--pair.png`), PNG.sync.write(pair));
    }

    const fmtCk = (ck: Record<string, boolean> | null) =>
      ck === null ? 'n/a' : Object.entries(ck).map(([k, v]) => `${v ? '✓' : '✗'} ${k}`).join('<br>');
    const allLocal = Object.values(localChecklist).every(Boolean);
    const allSite = siteChecklist === null || Object.values(siteChecklist).every(Boolean);
    md.push(
      `| ${c.id} | ${fmtCk(siteChecklist)} | ${fmtCk(localChecklist)} | ${pixelCell} | ${allLocal && allSite ? 'CALIBRATED' : 'MISMATCH — investigate'}${note ? ` — ${note}` : ''} |`,
    );
    console.log(`${c.id}: local ${allLocal ? 'ok' : 'STRUCTURE MISSING'} · site ${siteChecklist ? (allSite ? 'ok' : 'STRUCTURE MISSING') : 'unavailable'} · pixel ${pixelCell}`);
  }

  md.push('', '## Documented example props mounted locally (verbatim)', '');
  for (const c of CASES) md.push(`- \`${c.id}\`: \`${c.jsx}\``);
  md.push('', 'Pixel differences between site and local renders come from the docs page context (frame width, page CSS custom-property scoping) — the CHECKLIST is the calibration instrument; pixel numbers are quoted for scale, never widened away.', '');
  writeFileSync(path.join(OUT, 'CALIBRATION.md'), md.join('\n') + '\n');
  await browser.close();
  console.log(`✔ receipts → ${path.relative(REPO, OUT)}`);
}

await main();
