/**
 * Receipts for the CSS-VARS READER'S READ BOUNDARY —
 * `npm run extract:computed:ceiling:check`.
 *
 * THE HOLE THIS CLOSES. The reader walks `document.styleSheets` (plus adopted
 * sheets and shadow roots) and both of its reads used to swallow a throw:
 *
 *     else if (r.cssRules) { try { collectRules(r.cssRules); } catch {} }
 *     let rules; try { rules = sh.cssRules; } catch { continue; }
 *
 * A stylesheet the document cannot see into — a cross-origin `<link>`, which is
 * how a great many real design systems ship their CSS — exposes NO cssRules at
 * all and throws. The whole sheet then vanished from the reader while
 * `source-bindings.json` printed `skips: []` and the console printed `0 named
 * skip(s)`: the artifact ASSERTING COMPLETENESS over a read it never made.
 * "The library declared no token names" and "the reader could not look" are
 * different facts, and only one of them is the library's fault.
 *
 * This is the THIRD instance of the same class in this one file — the calc
 * blanket skip and the shorthand ceiling were the first two, and both of their
 * comments say `skips: []` was printed over a real loss. It now has a named
 * ceiling beside theirs (`stylesheetCeiling` / `stylesheetSkips`).
 *
 * WHAT MAKES THIS A GATE AND NOT A DEMO: it evaluates the REAL reader source
 * (the exported `captureJs`) against a page carrying a genuinely cross-origin
 * stylesheet, served through Playwright's router. It does not re-implement the
 * catch and assert on the copy — writing a fixture that contains what the real
 * path cannot produce is exactly the failure this round keeps finding.
 *
 * Node shell over the real capture source. Reads the repo; writes nothing.
 */
import { chromium } from 'playwright-core';
import { captureJs } from './capture.js';
import { chromiumExecutable } from '../figma/visual-parity/render.js';

const failures: string[] = [];
const check = (label: string, cond: boolean) => {
  if (!cond) failures.push(label);
  console.log(`  ${cond ? '✔' : '✖'} ${label}`);
};

const PAGE = (crossOrigin: boolean) =>
  `<!doctype html><html><head>` +
  (crossOrigin ? '<link rel="stylesheet" href="https://cdn.example.test/tokens.css">' : '') +
  `<style>#stage .btn { color: var(--x-fg); }</style></head>` +
  `<body><div id="stage"><button class="btn">Go</button></div></body></html>`;

const browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });
const skipsFor = async (crossOrigin: boolean): Promise<string[]> => {
  const page = await browser.newPage();
  // A stylesheet on a DIFFERENT origin: same bytes, but the CSSOM refuses
  // `.cssRules`. This is the real shape, not a simulated throw.
  await page.route('https://cdn.example.test/tokens.css', (r) =>
    r.fulfill({ status: 200, contentType: 'text/css', body: ':root{--x-fg:#111}' }));
  await page.route('http://ceiling.test/**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/html', body: PAGE(crossOrigin) }));
  await page.goto('http://ceiling.test/index.html');
  await page.waitForTimeout(200);
  // The same preamble the real sweep runs before the reader (captureJs reads
  // the channel list off `window.__ALL_PROPS`) — copied from capture.ts's own
  // first evaluate, so the reader runs in the state it actually runs in.
  await page.evaluate(
    `(() => { const l = [...getComputedStyle(document.documentElement)].sort(); window.__ALL_PROPS = l; return l; })()`,
  );
  // THE REAL READER, not a paraphrase of it.
  await page.evaluate(captureJs('#stage', undefined, '--x-'));
  const skips = (await page.evaluate(
    `(() => (window.__DSC_SHEET_SKIPS || []).map((s) => s.kind + (s.href ? ' ' + s.href : '') + ': ' + s.reason))()`,
  )) as string[];
  await page.close();
  return skips;
};

console.log('\nA cross-origin stylesheet the reader cannot open');
const crossed = await skipsFor(true);
check('the unreadable sheet is COUNTED, not swallowed', crossed.length >= 1);
check(
  'and the receipt NAMES the sheet by href (so a reader can tell WHICH CSS was missed)',
  crossed.some((s) => s.includes('cdn.example.test/tokens.css')),
);
check('the skip is classified as a whole SHEET (not a nested group)', crossed.some((s) => s.startsWith('sheet ')));

console.log('\nControl (every stylesheet same-origin)');
const clean = await skipsFor(false);
check(
  'a fully readable page records ZERO skips — the ceiling tracks the READ, not the page',
  clean.length === 0,
);

await browser.close();

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} read-boundary invariant(s) failed`);
  process.exit(1);
}
console.log(
  '\n✔ the reader names what it could not read (a cross-origin stylesheet is a counted, href-named ceiling — never a silent `skips: []`)',
);
