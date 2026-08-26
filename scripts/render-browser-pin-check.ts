/**
 * THE RENDER BROWSER IS PINNED, AND A RECEIPT SAYS WHICH ONE RENDERED IT.
 *
 *   npm run render-browser:check
 *
 * WHY THIS EXISTS (measured 2026-08-25, PR #49). `chromiumExecutable()` resolved
 * the ms-playwright cache by HIGHEST revision PRESENT. A dev machine carried a
 * stray `chromium-1234` (Chromium 151.0.7922.34) for an unrelated tool while
 * `playwright-core` pins `chromium-1228` (Chromium 149.0.7827.55) — what CI
 * installs and what every committed capture was taken on. Every local recording
 * therefore rendered on a browser CI never runs, and nothing could say so,
 * because the scorecard copied the CAPTURE's browser into its `browser` field
 * whatever binary did the rendering.
 *
 * Cost, all from that one silent substitution: 37 drift rows moved, 88 findings
 * in the full lane, and the `darwin` row of
 * evals/fixtures/computed-floor-platform-baseline.json recorded on the wrong
 * binary — with four channels excluded on `linux` under a note calling them
 * platform sensitivity when they are a capture-vs-replay browser delta.
 *
 * Both halves are falsified here. Browser-free: it plants fake caches on disk
 * and asks the real resolver, in a real subprocess with HOME redirected, so the
 * cache-walking code is the code under test rather than a re-implementation.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { browserMismatchNote } from '../extract/computed/gate.js';
import { pinnedChromiumRevision } from '../extract/figma/visual-parity/render.js';

const REPO = path.resolve(new URL('..', import.meta.url).pathname);
let failures = 0;
const ok = (label: string) => console.log(`  ✔ ${label}`);
const bad = (label: string, detail: string) => {
  console.error(`  ✖ ${label}\n      ${detail}`);
  failures++;
};

/** Build a fake ms-playwright cache holding exactly these revisions. */
function plantCache(root: string, revisions: string[]): void {
  rmSync(root, { recursive: true, force: true });
  for (const rev of revisions) {
    // both layouts, so the test does not depend on which platform runs it
    for (const rel of ['chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS', 'chrome-linux64']) {
      const dir = path.join(root, `chromium-${rev}`, rel);
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(path.join(root, `chromium-${rev}`, 'chrome-linux64', 'chrome'), '#!/bin/sh\nexit 0\n');
    writeFileSync(
      path.join(root, `chromium-${rev}`, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
      '#!/bin/sh\nexit 0\n',
    );
  }
}

/** Ask the REAL resolver, in a subprocess whose HOME is the sandbox. */
function resolveWith(home: string): { ok: true; value: string } | { ok: false; error: string } {
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, XDG_CACHE_HOME: path.join(home, '.cache') };
  delete env.PLAYWRIGHT_CHROMIUM_PATH;
  try {
    const out = execFileSync(
      'npx',
      ['tsx', '-e', "import { chromiumExecutable } from './extract/figma/visual-parity/render.ts'; process.stdout.write(chromiumExecutable());"],
      { cwd: REPO, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return { ok: true, value: out.trim() };
  } catch (e) {
    const err = e as { stderr?: string; message?: string };
    return { ok: false, error: String(err.stderr ?? err.message ?? e) };
  }
}

const PINNED = pinnedChromiumRevision();
const STRAY = String(Number(PINNED) + 1000); // unambiguously HIGHER than the pin
const sandbox = path.join(tmpdir(), `render-browser-pin-check-${process.pid}`);

console.log(`THE RENDER BROWSER IS PINNED — playwright-core pins chromium-${PINNED}\n`);

try {
  // 1. A stray HIGHER revision must NOT be selected, and the refusal must NAME the pin.
  {
    const home = path.join(sandbox, 'stray-only');
    plantCache(path.join(home, '.cache', 'ms-playwright'), [STRAY]);
    plantCache(path.join(home, 'Library', 'Caches', 'ms-playwright'), [STRAY]);
    const r = resolveWith(home);
    if (r.ok) {
      bad('a stray HIGHER revision is not selected', `resolver returned ${r.value} — the old highest-revision sort is back`);
    } else if (!r.error.includes(`chromium-${PINNED}`)) {
      bad('the refusal names the pinned revision', `refused, but without naming chromium-${PINNED}: ${r.error.slice(0, 300)}`);
    } else if (!r.error.includes(`chromium-${STRAY}`)) {
      bad('the refusal names what IS present', `refused without naming the stray chromium-${STRAY}: ${r.error.slice(0, 300)}`);
    } else if (!/playwright(-core)? install chromium/.test(r.error)) {
      bad('the refusal names the remedy', `no \`npx playwright install chromium\` in: ${r.error.slice(0, 300)}`);
    } else {
      ok(`a stray chromium-${STRAY} is REFUSED, not substituted — the refusal names the pin, what is present, and the remedy`);
    }
  }

  // 2. With the pinned revision present ALONGSIDE a higher stray, the PIN wins.
  {
    const home = path.join(sandbox, 'both');
    plantCache(path.join(home, '.cache', 'ms-playwright'), [PINNED, STRAY]);
    plantCache(path.join(home, 'Library', 'Caches', 'ms-playwright'), [PINNED, STRAY]);
    const r = resolveWith(home);
    if (!r.ok) bad('the pinned revision is selected when present', `refused instead: ${r.error.slice(0, 300)}`);
    else if (r.value.includes(`chromium-${STRAY}`)) bad('the pinned revision beats a higher stray', `picked the STRAY: ${r.value}`);
    else if (!r.value.includes(`chromium-${PINNED}`)) bad('the pinned revision is selected', `picked neither: ${r.value}`);
    else ok(`with chromium-${PINNED} and a higher chromium-${STRAY} both present, the PINNED one is chosen`);
  }

  // 3. An empty cache refuses by name rather than falling back to a system browser.
  {
    const home = path.join(sandbox, 'empty');
    plantCache(path.join(home, '.cache', 'ms-playwright'), []);
    plantCache(path.join(home, 'Library', 'Caches', 'ms-playwright'), []);
    const r = resolveWith(home);
    if (r.ok) bad('an empty cache refuses', `resolver returned ${r.value} — a silent system-browser fallback is back`);
    else if (!r.error.includes(`chromium-${PINNED}`)) bad('the empty-cache refusal names the pin', r.error.slice(0, 300));
    else ok('an empty cache REFUSES by name — no silent system-Chrome fallback');
  }

  // 4. A receipt whose renderer differs from its capture must SAY so.
  {
    const decorated = 'Chromium 149.0.7827.55 (playwright-core, headless)';
    const differs = browserMismatchNote(decorated, '151.0.7922.34');
    if (differs === undefined) bad('a cross-browser receipt says so', 'browserMismatchNote returned undefined for 149 vs 151');
    else if (!differs.includes('149.0.7827.55') || !differs.includes('151.0.7922.34')) {
      bad('the mismatch note names BOTH browsers', differs.slice(0, 200));
    } else ok('a scorecard rendered on 151 against a 149 capture carries a note naming both');

    // and must NOT cry wolf when the same browser is spelled two ways
    const same = browserMismatchNote(decorated, '149.0.7827.55');
    if (same !== undefined) {
      bad('no false mismatch across spellings', `decorated vs bare of the SAME version reported a mismatch: ${same.slice(0, 160)}`);
    } else ok('the decorated and bare spellings of one version are NOT reported as a mismatch');
  }

  // 5. The gate's own type carries the fact — a scorecard cannot omit it.
  {
    const gateSrc = readFileSync(path.join(REPO, 'extract/computed/gate.ts'), 'utf8');
    const missing = [
      ['Scorecard.renderedBy', /\n  renderedBy: string;/],
      ['Scorecard.browserMismatch', /\n  browserMismatch\?: string;/],
      ['runGate opts.renderBrowserVersion', /\n  renderBrowserVersion: string;/],
    ].filter(([, re]) => !(re as RegExp).test(gateSrc));
    if (missing.length > 0) {
      bad('gate.ts declares the rendering-browser fact', `absent: ${missing.map(([n]) => n).join(', ')}`);
    } else ok('gate.ts declares renderedBy, browserMismatch and the required renderBrowserVersion option');
  }

  // 6. Every offline replay that RENDERS must pass a live rendering browser.
  {
    const regateSrc = readFileSync(path.join(REPO, 'extract/computed/regate.ts'), 'utf8');
    if (!/const renderBrowserVersion = browser\.version\(\);/.test(regateSrc)) {
      bad('regate asks the LIVE browser for its version', 'no `browser.version()` call — it is copying a fact again');
    } else if (!/browserVersion: sweep\.browserVersion,/.test(regateSrc)) {
      bad("regate keeps the capture's browser for the contract description", 'browserVersion no longer comes from the sweep — the enriched contract description will churn');
    } else ok("regate records the LIVE renderer AND keeps the capture's browser for the contract description");
  }
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}

console.log('');
if (failures > 0) {
  console.error(`✖ render browser pin: ${failures} failure(s)`);
  process.exit(1);
}
console.log('✔ render browser pin: the pinned revision wins over a higher stray, an absent pin refuses by name with its remedy, and a receipt names the browser that actually rendered it.');
