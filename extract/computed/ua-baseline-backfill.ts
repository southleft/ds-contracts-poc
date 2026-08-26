/**
 * UA BASELINE BACKFILL — measure the library-free control baseline and write
 * it into captures taken before the baseline was fixed.
 *
 *   npm run extract:computed:ua-baseline:backfill            # write
 *   npm run extract:computed:ua-baseline:backfill -- --check # refuse if any
 *                                                            # committed truth
 *                                                            # has no baseline
 *
 * WHY A BACKFILL IS A MEASUREMENT AND NOT AN ESTIMATE. The door
 * `capture.control-baseline-mint` mounted its four control elements INSIDE
 * `mount.wrapperOpen`, in the same document as the component, so every
 * page-global rule the library ships styled the control too and
 * `fuse.control-element-delta` subtracted library-authored facts as if they
 * were user-agent defaults. The fix (capture.captureUaControls) measures the
 * same four elements on a page carrying the browser, the colour-scheme and the
 * stage box and NOTHING the library ships. That page is a function of
 * (browser, colour-scheme, stage) ONLY — it is library-independent BY
 * CONSTRUCTION. So the baseline for an already-committed capture can be
 * measured exactly, in the same Chromium, without the library's harness being
 * installed at all; nothing here is inferred from the capture it is written
 * into.
 *
 * WHAT IS AND IS NOT HONEST ABOUT IT. The one thing a backfill cannot
 * reproduce is the BROWSER BUILD that took the original capture. So the
 * measuring browser is written into `_provenance.uaBaselineBrowser` and every
 * component whose capture browser differs is PRINTED, per component, with both
 * versions — a UA default measured by a different Chromium than the component
 * is a visible fact here rather than a silent one.
 *
 * The control stage is `cfg.stage` — the config's DEFAULT stage, which is what
 * the harness page renders its control boxes in — never `_provenance.stage`,
 * which is `stageFor(cfg, comp)` and carries a component's own override.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright-core';
import { chromiumExecutable } from '../figma/visual-parity/render.js';
import { captureUaControls, loadConfig, type CaptureConfig, type ComponentConfig } from './capture.js';
import type { CapturedTruthFile } from './replay.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CFG_DIR = path.join(REPO, 'extract/computed/configs');
/** Same map as ua-baseline-check.ts / drift-check.ts: which out/ root a config's
 *  components were written to (polaris predates the namespacing). */
const OUT_FOR: Record<string, string> = {
  'polaris.json': 'extract/computed/out', 'polaris-depth.json': 'extract/computed/out',
  'mui.json': 'extract/computed/out/mui', 'carbon.json': 'extract/computed/out/carbon',
  'altitude.json': 'extract/computed/out/altitude', 'astryx.json': 'extract/computed/out/astryx',
  'tailwind.json': 'extract/computed/out/tailwind',
  'fluent.json': 'extract/computed/out/fluent', 'shadcn.json': 'extract/computed/out/shadcn',
  'antd.json': 'extract/computed/out/antd',
};

const CHECK = process.argv.includes('--check');

interface Job {
  cfgFile: string;
  cfg: CaptureConfig;
  comp: ComponentConfig;
  truthPath: string;
}

const jobs: Job[] = [];
for (const cfgFile of readdirSync(CFG_DIR).filter((f) => f.endsWith('.json')).sort()) {
  const cfg: CaptureConfig = loadConfig(REPO, path.join(CFG_DIR, cfgFile));
  const outRoot = path.join(REPO, OUT_FOR[cfgFile] ?? 'extract/computed/out');
  for (const comp of cfg.components as ComponentConfig[]) {
    const truthPath = path.join(outRoot, comp.name.toLowerCase(), 'captured-truth.json');
    if (existsSync(truthPath)) jobs.push({ cfgFile, cfg, comp, truthPath });
  }
}

if (CHECK) {
  const missing = jobs.filter((j) => {
    const t = JSON.parse(readFileSync(j.truthPath, 'utf8')) as CapturedTruthFile;
    return t.uaControls === undefined;
  });
  console.log(`\nUA BASELINE PRESENCE — ${jobs.length - missing.length}/${jobs.length} committed captures carry \`uaControls\``);
  if (missing.length > 0) {
    console.error(
      `\n✖ ${missing.length} committed capture(s) carry NO UA baseline, so \`fuse.control-element-delta\` would subtract the IN-PAGE control and cancel library-authored facts:\n  ` +
        missing.map((m) => path.relative(REPO, m.truthPath)).join('\n  ') +
        `\n\nRemedy: npm run extract:computed:ua-baseline:backfill`,
    );
    process.exit(1);
  }
  console.log('  ✔ every committed capture carries a library-free UA baseline');
  process.exit(0);
}

const browser: Browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });
const measuring = `Chromium ${browser.version()} (playwright-core, headless)`;
let written = 0;
let unchanged = 0;
const versionGaps: string[] = [];
try {
  // One baseline page per DISTINCT (colour-scheme, stage, channel list) — the
  // three inputs the page is a function of. Components sharing a config share
  // a measurement; nothing is copied across a differing input.
  const cache = new Map<string, Record<string, unknown>>();
  for (const job of jobs) {
    const truth = JSON.parse(readFileSync(job.truthPath, 'utf8')) as CapturedTruthFile & Record<string, unknown>;
    const channels = truth._provenance.channels;
    const colorScheme = String((truth._provenance as Record<string, unknown>)['colorScheme'] ?? job.cfg.browser.colorScheme);
    const stage = job.cfg.stage;
    const key = JSON.stringify([colorScheme, stage, channels]);
    let ua = cache.get(key);
    if (!ua) {
      const context = await browser.newContext({
        viewport: job.cfg.browser.viewport,
        deviceScaleFactor: job.cfg.browser.deviceScaleFactor,
        colorScheme: colorScheme as 'light' | 'dark',
      });
      ua = (await captureUaControls(context, {
        stage,
        colorScheme,
        channels,
        classAllow: job.cfg.library.classAllow,
      })) as unknown as Record<string, unknown>;
      await context.close();
      cache.set(key, ua);
    }
    const before = JSON.stringify(truth.uaControls ?? null);
    if (before === JSON.stringify(ua)) { unchanged++; continue; }
    const captureBrowser = String((truth._provenance as Record<string, unknown>)['browser'] ?? '');
    if (captureBrowser !== '' && captureBrowser !== measuring) {
      versionGaps.push(`${job.cfgFile} ${job.comp.name}: capture ${captureBrowser} vs baseline ${measuring}`);
    }
    // Rebuild in the SAME key order run.ts writes, so a backfilled file and a
    // freshly captured one are byte-comparable.
    const prov: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(truth._provenance)) {
      prov[k] = v;
      if (k === 'browser') prov['uaBaselineBrowser'] = measuring;
    }
    if (prov['uaBaselineBrowser'] === undefined) prov['uaBaselineBrowser'] = measuring;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(truth)) {
      out[k] = k === '_provenance' ? prov : v;
      if (k === 'controls') out['uaControls'] = ua;
    }
    writeFileSync(job.truthPath, JSON.stringify(out) + '\n');
    written++;
    console.log(`  ✔ ${path.relative(REPO, job.truthPath)}`);
  }
} finally {
  await browser.close();
}
console.log(`\nUA BASELINE BACKFILL — ${written} capture(s) written, ${unchanged} already current, measured by ${measuring}`);
if (versionGaps.length > 0) {
  console.log(
    `\nBROWSER GAP — ${versionGaps.length} capture(s) were taken by a DIFFERENT Chromium than the baseline that is now subtracted from them.\n  ` +
      versionGaps.join('\n  ') +
      `\nThe version is recorded in each file's \`_provenance.uaBaselineBrowser\`; re-capturing the component closes the gap.`,
  );
}
