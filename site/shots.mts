/**
 * Screenshot harness for review — serves site/dist/ on an ephemeral port and
 * captures pages into site/docs-shots/. Dev tool, not part of site:build.
 * Usage: npx tsx site/shots.mts [route=name.png ...]
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { chromiumExecutable } from '../extract/figma/visual-parity/render.js';

const DIST = path.join(process.cwd(), 'site/dist');
const OUT = path.join(process.cwd(), 'site/docs-shots');
mkdirSync(OUT, { recursive: true });

const MIME: Record<string, string> = {
  '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json',
};

const server = createServer((req, res) => {
  let p = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(DIST, p);
  if (!existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/html' });
    res.end(readFileSync(path.join(DIST, '404.html')));
    return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});

await new Promise<void>((r) => server.listen(0, r));
const port = (server.address() as { port: number }).port;

const args = process.argv.slice(2);
const shots: Array<[string, string, 'light' | 'dark', number]> = args.length
  ? args.map((a) => {
      const [route, name] = a.split('=');
      const dark = name.includes('dark');
      return [route, name, dark ? 'dark' : 'light', name.includes('mobile') ? 360 : 1280] as [string, string, 'light' | 'dark', number];
    })
  : [
      // The canonical review set — rerunning with no args REPLACES it wholesale.
      ['/', 'home-light.png', 'light', 1280],
      ['/', 'home-dark.png', 'dark', 1280],
      ['/', 'home-mobile-light.png', 'light', 360],
      ['/get-started/', 'get-started-light.png', 'light', 1280],
      ['/get-started/', 'get-started-dark.png', 'dark', 1280],
      ['/cli/', 'cli-light.png', 'light', 1280],
      ['/cli/', 'cli-dark.png', 'dark', 1280],
      ['/emitters/', 'emitters-light.png', 'light', 1280],
      ['/emitters/', 'emitters-dark.png', 'dark', 1280],
      ['/how-it-works/protocol/', 'how-protocol-light.png', 'light', 1280],
      ['/how-it-works/protocol/', 'how-protocol-dark.png', 'dark', 1280],
      ['/how-it-works/styles/', 'how-styles-light.png', 'light', 1280],
      ['/how-it-works/styles/', 'how-styles-dark.png', 'dark', 1280],
      ['/how-it-works/', 'how-index-light.png', 'light', 1280],
      ['/how-it-works/flow/', 'how-flow-light.png', 'light', 1280],
      ['/how-it-works/flow/', 'how-flow-dark.png', 'dark', 1280],
      ['/how-it-works/flow/', 'how-flow-mobile-light.png', 'light', 360],
      ['/how-it-works/model/', 'how-model-light.png', 'light', 1280],
      ['/how-it-works/adding-a-prop/', 'how-adding-a-prop-light.png', 'light', 1280],
      ['/how-it-works/nested-components/', 'how-nested-components-dark.png', 'dark', 1280],
      ['/how-it-works/at-scale/', 'how-at-scale-light.png', 'light', 1280],
      ['/how-it-works/instruments/', 'how-instruments-light.png', 'light', 1280],
      ['/spec/', 'spec-index-dark.png', 'dark', 1280],
      ['/spec/props/', 'spec-props-light.png', 'light', 1280],
      ['/spec/composition/', 'spec-composition-light.png', 'light', 1280],
      ['/spec/versioning/', 'spec-versioning-dark.png', 'dark', 1280],
      ['/spec/states/', 'spec-states-mobile-light.png', 'light', 360],
      ['/contribute/', 'contribute-light.png', 'light', 1280],
    ];

/** Device-pixel ceiling under which a Chromium full-page raster still paints text. */
const MAX_DEVICE_PX = 16000;
const DPR = 2;
const browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });
for (const [route, name, scheme, width] of shots) {
  const ctx = await browser.newContext({
    viewport: { width, height: 900 },
    colorScheme: scheme,
    deviceScaleFactor: DPR,
  });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: 'networkidle' });
  // Chromium rasters a full-page capture as one texture and silently
  // returns a BLANK image past ~16384 device pixels (found 2026-08-23: the
  // /how-it-works/flow/ frames came back as white pages with borders and no
  // text). Clip tall pages to the ceiling and say so, rather than commit a
  // blank review frame.
  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const ceiling = Math.floor(MAX_DEVICE_PX / DPR);
  if (scrollHeight > ceiling) {
    // A viewport-sized capture, not fullPage+clip: Playwright clips within
    // the viewport unless the whole page is rastered first.
    await page.setViewportSize({ width, height: ceiling });
    await page.screenshot({ path: path.join(OUT, name) });
    console.log(`✔ ${name} (${route}, ${scheme}, ${width}px) — CLIPPED to ${ceiling}px of ${scrollHeight}px; a full-page raster above ${MAX_DEVICE_PX} device px comes back blank`);
  } else {
    await page.screenshot({ path: path.join(OUT, name), fullPage: true });
    console.log(`✔ ${name} (${route}, ${scheme}, ${width}px)`);
  }
}
await browser.close();
server.close();
