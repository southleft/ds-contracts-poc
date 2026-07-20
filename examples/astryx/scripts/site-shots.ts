/**
 * Astryx docs-site screenshot fixtures —
 *   `npx tsx examples/astryx/scripts/site-shots.ts`
 *
 * Captures the official component pages (astryx.atmeta.com) for 9 flagship
 * census components into `receipts/site/` — the reference imagery for the
 * FUTURE visual gates (Phase A-2 floor round compares our contract-rendered
 * surfaces against these). Fixtures, not gates: nothing is diffed here.
 *
 * Polite by construction: sequential navigation, 1.5 s between pages, an
 * identifying user agent, one viewport. Re-running overwrites in place —
 * receipts/RECEIPTS.md records the capture date + commit context.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { chromiumExecutable } from '../../../extract/figma/visual-parity/render.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(HERE, '..', 'receipts', 'site');
mkdirSync(OUT, { recursive: true });

const BASE = 'https://astryx.atmeta.com/components';
/** slug (PascalCase — the site's real routes) → census component
 *  (9 flagships across the interaction spectrum). */
const PAGES: Record<string, string> = {
  Button: 'Button',
  Badge: 'Badge',
  Card: 'Card',
  Dialog: 'Dialog',
  Slider: 'Slider',
  Switch: 'Switch',
  TextInput: 'TextInput',
  Tooltip: 'Tooltip',
  Banner: 'Banner',
};
const VIEWPORT = { width: 1440, height: 2200 };
const DELAY_MS = 1500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });
const context = await browser.newContext({
  viewport: VIEWPORT,
  userAgent:
    'ds-contracts-poc docs-fixture capture (open-source research; polite sequential fetch; contact: repo issues)',
});
const page = await context.newPage();

const captured: { slug: string; component: string; url: string; file: string }[] = [];
const failed: { slug: string; reason: string }[] = [];
for (const [slug, component] of Object.entries(PAGES)) {
  const url = `${BASE}/${slug}`;
  try {
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 });
    if (!resp || resp.status() !== 200) {
      failed.push({ slug, reason: `HTTP ${resp?.status() ?? 'no response'}` });
      continue;
    }
    await sleep(500); // fonts/hydration settle
    const file = `${slug}.png`;
    await page.screenshot({ path: path.join(OUT, file), fullPage: false });
    captured.push({ slug, component, url, file });
    console.log(`✔ ${slug} → receipts/site/${file}`);
  } catch (err) {
    failed.push({ slug, reason: String(err).slice(0, 120) });
    console.log(`✘ ${slug}: ${String(err).slice(0, 120)}`);
  }
  await sleep(DELAY_MS);
}
await browser.close();

const manifest = `# Astryx docs-site fixtures

Captured from the OFFICIAL docs (https://astryx.atmeta.com/components) as
reference imagery for the future visual gates (Phase A-2 computed-floor
round). **Fixtures only — nothing is diffed or gated here.** Subject pinned
at \`@astryxdesign/core@0.1.6\`; the live site may drift ahead of the pinned
package — treat these as dated evidence, not ground truth.

- Captured: ${new Date().toISOString().slice(0, 10)} · viewport ${VIEWPORT.width}×${VIEWPORT.height} · sequential with ${DELAY_MS} ms politeness delay
- Regenerate: \`npx tsx examples/astryx/scripts/site-shots.ts\`

| component | page | file |
|---|---|---|
${captured.map((c) => `| ${c.component} | ${c.url} | \`${c.file}\` |`).join('\n')}
${failed.length > 0 ? `\n## Not captured (named)\n\n${failed.map((f) => `- \`${f.slug}\` — ${f.reason}`).join('\n')}\n` : ''}`;
writeFileSync(path.join(OUT, 'RECEIPTS.md'), manifest);
console.log(`\n${captured.length}/${Object.keys(PAGES).length} pages captured → examples/astryx/receipts/site/`);
if (failed.length > 0) process.exit(1);
