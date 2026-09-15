import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'playwright-core';
import type { SourceProfile } from './check.js';
import { watchSourceFailures } from './observe.js';
import { archiveInventory, captureReference, replayReference } from './replay.js';

// Explicit local-only first integration. No credentials, remote URL ingestion,
// arbitrary command execution, source changes or Figma writes.
const [url, checkout, output] = process.argv.slice(2);
if (!url || !checkout || !output) throw new Error('Usage: tsx source-reference/run.ts <local-button-story-url> <altitude-checkout> <new-output-directory>');
const parsed = new URL(url);
if (parsed.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname) || parsed.username || parsed.password) {
  throw new Error('Only an unauthenticated local Storybook is supported');
}
if (parsed.pathname !== '/iframe.html' || parsed.searchParams.get('id') !== 'atoms-button--default') throw new Error('Expected the original Altitude default Button story');
const git = (...args: string[]) => execFileSync('git', ['-C', checkout, ...args], {encoding:'utf8'}).trim();
const sourceRevision = git('rev-parse', 'HEAD');
if (sourceRevision !== '0639eccd15bfedc4fa9713d9545a64cef2c0f0a5') throw new Error('Source revision moved: requalify the reference, do not silently reuse its witnesses');
if (git('diff', 'HEAD', '--name-only').length) throw new Error('Tracked source edits need their own pinned provenance');
const profile: SourceProfile = JSON.parse(readFileSync('source-reference/altitude-button.json','utf8'));
const hash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const sourceFiles = [
  'libs/al-web-components/.storybook/preview.ts', 'libs/al-web-components/.storybook/main.ts',
  'libs/al-web-components/components/button/button.stories.ts', 'libs/al-web-components/components/button/button.ts',
  'libs/al-web-components/components/button/button.scss', 'libs/al-web-components/components/ALElement.ts',
  'libs/al-web-components/styles/main.scss', 'libs/al-web-components/styles/dist/tokens.json', 'pnpm-lock.yaml',
];
const sourceHashes = Object.fromEntries(sourceFiles.map(f => [f, hash(readFileSync(path.join(checkout, f)))]));
mkdirSync(output, {recursive:false}); // Existing evidence must never be overwritten.
const browser = await chromium.launch({headless:true});
const rows = [];
const harPath = path.join(output,'original.har');
let replayVerified = false;
let replayRecord;
try {
  for (const scenario of ['original', 'no-theme', 'no-component-css', 'no-font', 'empty'] as const) {
    const context = await browser.newContext({viewport:{width:900,height:600}, deviceScaleFactor:1, colorScheme:'dark', serviceWorkers:'block',
      ...(scenario === 'original' ? {recordHar:{path:harPath,content:'embed' as const,mode:'full' as const}} : {})});
    const page = await context.newPage();
    const failures = watchSourceFailures(page);
    if (scenario === 'no-font') await page.route('https://fonts.gstatic.com/**', r => r.abort());
    await page.goto(url, {waitUntil:'load', timeout:30000});
    await page.waitForFunction(() => !!document.querySelector('al-button')?.shadowRoot?.querySelector('button'), undefined, {timeout:15000});
    await page.evaluate(() => document.fonts.ready);
    if (scenario === 'no-theme') await page.evaluate(() => document.getElementById('al-theme-sheet')?.remove());
    if (scenario === 'no-component-css') await page.evaluate(() => {
      const root = document.querySelector('al-button')!.shadowRoot!;
      root.adoptedStyleSheets = []; root.querySelectorAll('style').forEach(s => s.remove());
    });
    if (scenario === 'empty') await page.evaluate(() => document.querySelector('al-button')?.remove());
    const observed = await captureReference(page, profile, failures);
    const observation = observed.after;
    const result = {status:observed.status,problems:observed.problems};
    const screenshot = `${scenario}.png`;
    writeFileSync(path.join(output, screenshot), observed.screenshot);
    rows.push({scenario, ...result, observation, screenshot, sha256:observed.secondSha256, firstSha256:observed.firstSha256});
    failures.dispose(); await context.close();
  }
  const replay = await replayReference(browser,harPath,url,profile);
  writeFileSync(path.join(output,'replay.png'), replay.screenshot);
  replayVerified = replay.status === 'valid' && replay.secondSha256 === rows[0]?.sha256;
  replayRecord = {status:replay.status,problems:replay.problems,sha256:replay.secondSha256,firstSha256:replay.firstSha256,
    observation:replay.after, matchesOriginal:replayVerified, archive:archiveInventory(harPath)};
} finally { await browser.close(); }
const stableSource = sourceFiles.every(f => hash(readFileSync(path.join(checkout,f))) === sourceHashes[f]) && git('rev-parse','HEAD') === sourceRevision && !git('diff','HEAD','--name-only');
const qualified = !!stableSource && replayVerified && rows[0]?.status === 'valid' && rows.slice(1).every(r => r.status === 'invalid');
const record = {sourceRevision, sourceHashes, profileHash:hash(readFileSync('source-reference/altitude-button.json')), recordedAt:new Date().toISOString(),
  engineRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  engineDirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),
  browser:browser.version(), sourceStable:!!stableSource, qualified, rows, replay:replayRecord,
  scope:'One original local Storybook story with source-derived witnesses, recorded HTTP resources, fresh-context no-fallback replay and browser corruptions; not Figma parity, cohort completion, or owner approval. This reproduces actual loaded bytes, not an independent package build. Source checkout has owner untracked material.'};
writeFileSync(path.join(output,'measurement.json'), JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify({qualified, rows:rows.map(({scenario,status,problems})=>({scenario,status,problems}))},null,2));
if (!qualified) process.exitCode = 1;
