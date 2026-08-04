/**
 * CI BROWSER RESOLUTION RECEIPT — run by .github/workflows/full.yml before any
 * browser-dependent gate.
 *
 * WHY THIS EXISTS. Three of the 33 gates need a browser, and they need TWO
 * DIFFERENT ONES:
 *
 *   · `npm run eval` (4 launches) and `npm run extract:computed:ceiling:check`
 *     go through `chromiumExecutable()` in
 *     extract/figma/visual-parity/render.ts — PLAYWRIGHT_CHROMIUM_PATH, else
 *     the ms-playwright cache, else a system Chrome. It throws by name when
 *     nothing resolves.
 *   · `npm run plugin:ui-check` calls `chromium.launch({ channel: 'chrome' })`
 *     (scripts/plugin-ui-check.mjs:77). A CHANNEL is not the playwright
 *     Chromium build — it is a real Google Chrome install that playwright-core
 *     resolves from its own registry (/opt/google/chrome/chrome on Linux).
 *     Installing playwright's chromium does NOT satisfy it.
 *
 * A missing browser must fail HERE, loudly, naming which of the two is absent
 * and which gates it takes down — not fifteen minutes later inside an eval
 * case, where the error reads like an engine defect.
 *
 * This file imports the REAL `chromiumExecutable` rather than reimplementing
 * the search order: a receipt that names a different binary than the gate
 * actually launches is worse than no receipt.
 */
import { appendFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumExecutable } from '../../extract/figma/visual-parity/render.js';

let failed = false;
const fail = (what: string) => {
  console.error(`✖ ${what}`);
  failed = true;
};

// --- 1. the chromiumExecutable() path (eval, ceiling:check) ---------------
let resolved = '';
try {
  resolved = chromiumExecutable();
  console.log(`  ✔ chromiumExecutable() → ${resolved}`);
} catch (e) {
  fail(
    `chromiumExecutable() found NO browser — this takes down: npm run eval, ` +
      `npm run extract:computed:ceiling:check.\n    ${(e as Error).message}`,
  );
}

// It must actually LAUNCH. An executable that exists but cannot start (missing
// shared libraries — the classic `--with-deps` miss) is the failure this step
// is here to catch.
if (resolved) {
  try {
    const b = await chromium.launch({ executablePath: resolved, headless: true });
    console.log(`  ✔ it launches headless (${b.version()})`);
    await b.close();
  } catch (e) {
    fail(`the resolved Chromium exists but will not launch: ${(e as Error).message}`);
  }
}

// --- 2. the channel:'chrome' path (plugin:ui-check) -----------------------
try {
  const b = await chromium.launch({ channel: 'chrome' });
  console.log(`  ✔ channel:'chrome' launches (${b.version()}) — plugin:ui-check can run`);
  await b.close();
} catch (e) {
  fail(
    `channel:'chrome' will not launch — this takes down: npm run plugin:ui-check.\n` +
      `    GitHub's ubuntu runner images ship Google Chrome at /opt/google/chrome/chrome;\n` +
      `    if that changed, add \`npx playwright-core install --with-deps chrome\` to the workflow.\n` +
      `    ${(e as Error).message}`,
  );
}

// --- 3. hand the resolved path to the rest of the job --------------------
// Explicit beats implicit: every later gate reads the SAME binary this step
// proved, instead of re-running the cache search and possibly picking another.
if (!failed && resolved && process.env.GITHUB_ENV) {
  appendFileSync(process.env.GITHUB_ENV, `PLAYWRIGHT_CHROMIUM_PATH=${resolved}\n`);
  console.log(`  ✔ PLAYWRIGHT_CHROMIUM_PATH pinned for the rest of the job`);
}

if (failed) process.exit(1);
console.log('✔ browsers resolved — every browser-dependent gate in this lane can run');
