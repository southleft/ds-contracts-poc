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
      ['/', 'home-light.png', 'light', 1280],
      ['/', 'home-dark.png', 'dark', 1280],
      ['/spec/composition/', 'spec-composition-light.png', 'light', 1280],
      ['/spec/', 'spec-index-dark.png', 'dark', 1280],
      ['/', 'home-mobile-light.png', 'light', 360],
    ];

const browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });
for (const [route, name, scheme, width] of shots) {
  const ctx = await browser.newContext({
    viewport: { width, height: 900 },
    colorScheme: scheme,
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(OUT, name), fullPage: true });
  await ctx.close();
  console.log(`✔ ${name} (${route}, ${scheme}, ${width}px)`);
}
await browser.close();
server.close();
