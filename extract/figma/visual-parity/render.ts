/**
 * Headless render of ONE variant — the playground preview pipeline made
 * screenshotable. The contract is emitted by core/emit-html.ts with the
 * chosen prop values written in as defaults (the playground's
 * withOverridesAsDefaults trick), the showcase narrowed to its first item by
 * CSS, and the component element screenshotted at deviceScaleFactor 2 on a
 * TRANSPARENT body (so content-box cropping is honest on both sides of the
 * diff).
 *
 * Font honesty: when the Figma set names a font family, the harness checks
 * availability in-page (document.fonts.check) and — if the family resolves
 * locally — sets it as the showcase's inherited family so both renderers
 * rasterize the same face. Availability is REPORTED either way; text-region
 * masking (see img.ts) covers the miss, never a fatter threshold.
 *
 * Browser: playwright-core over an already-installed Chromium (ms-playwright
 * cache at the revision `playwright-core` PINS, or PLAYWRIGHT_CHROMIUM_PATH) —
 * no download step, and NO substitution: see chromiumExecutable().
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import path from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { emitHtml, type Contract } from '../../../core/index.js';
import type { Interaction } from './match.js';
import type { RenderablePackage } from './compose.js';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RenderedVariant {
  ok: true;
  /** PNG at 2x, clipped to the component's painted union box (+ margin). */
  png: Buffer;
  /** Text-node client rects, DEVICE px, relative to the clip origin. */
  textRects: Rect[];
  /** font family → available in this browser/OS. */
  fontChecks: Record<string, boolean>;
}
export interface RenderRefusal {
  ok: false;
  error: string;
}

const CLIP_MARGIN = 48; // px around the painted union box (shadows, outlines)

/** The chromium revision `playwright-core` PINS, from its own browsers.json. */
export function pinnedChromiumRevision(): string {
  // `playwright-core/package.json` IS in the package's exports map; `browsers.json`
  // is NOT — so resolve the manifest and read its sibling rather than guessing a path.
  const req = createRequire(import.meta.url);
  const dir = path.dirname(req.resolve('playwright-core/package.json'));
  const manifest = JSON.parse(readFileSync(path.join(dir, 'browsers.json'), 'utf8')) as {
    browsers: Array<{ name: string; revision: string | number }>;
  };
  const entry = manifest.browsers.find((b) => b.name === 'chromium');
  if (!entry) {
    throw new Error(
      `playwright-core/browsers.json (${path.join(dir, 'browsers.json')}) names no \`chromium\` entry — ` +
        'the pinned revision cannot be determined, and this resolver will not guess one.',
    );
  }
  return String(entry.revision);
}

/** ms-playwright cache roots: macOS and Linux (Windows untested — use the env var). */
export function chromiumCacheRoots(): string[] {
  return [
    path.join(homedir(), 'Library', 'Caches', 'ms-playwright'),
    process.env.XDG_CACHE_HOME
      ? path.join(process.env.XDG_CACHE_HOME, 'ms-playwright')
      : path.join(homedir(), '.cache', 'ms-playwright'),
  ];
}

const BROWSER_RELPATHS = [
  'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  'chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
  'chrome-linux/chrome',
  'chrome-linux64/chrome',
];

/** The binary for ONE revision under the given cache roots, or null. Exported for the guard. */
export function chromiumExecutableIn(caches: string[], revision: string): string | null {
  for (const cache of caches) {
    for (const rel of BROWSER_RELPATHS) {
      const p = path.join(cache, `chromium-${revision}`, rel);
      if (existsSync(p)) return p;
    }
  }
  return null;
}

/** Every chromium revision present under the given cache roots, newest first. */
export function chromiumRevisionsPresent(caches: string[]): string[] {
  const seen = new Set<string>();
  for (const cache of caches) {
    if (!existsSync(cache)) continue;
    for (const d of readdirSync(cache)) {
      const m = /^chromium-(\d+)$/.exec(d);
      if (m) seen.add(m[1]);
    }
  }
  return [...seen].sort((a, b) => Number(b) - Number(a));
}

/**
 * THE PINNED REVISION, OR A REFUSAL — never "whatever is newest on disk".
 *
 * WHY (measured 2026-08-25, v1-integration-2). This function used to sort the
 * ms-playwright cache by revision number and take the HIGHEST present. A dev
 * machine had a stray `chromium-1234` (Chromium 151.0.7922.34) installed for an
 * unrelated tool, while `playwright-core` pins `chromium-1228`
 * (Chromium 149.0.7827.55) — which is what CI installs and what every committed
 * capture was taken on. So every local recording silently rendered on a browser
 * CI never runs. The cost: 37 drift rows moved, 88 CI findings, and a `darwin`
 * platform baseline in evals/fixtures/computed-floor-platform-baseline.json
 * recorded on the wrong binary. A different Chromium computes different styles
 * (`position-anchor` alone flipped `none` -> `normal` between those two), so a
 * receipt recorded on it disagrees with CI while looking perfectly green.
 *
 * This is NOT only a dev-machine hazard: the workflows cache
 * `~/.cache/ms-playwright` with `restore-keys`, so a CI cache accumulates
 * revisions across lockfile bumps and "highest present" is wrong there too the
 * moment playwright is downgraded.
 *
 * PLAYWRIGHT_CHROMIUM_PATH still wins — that is an operator saying which binary
 * they mean, on the record, and CI uses it. What is gone is the SILENT
 * substitution: no highest-revision sort, and no system-Chrome fallback.
 */
export function chromiumExecutable(): string {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  const revision = pinnedChromiumRevision();
  const caches = chromiumCacheRoots();
  const found = chromiumExecutableIn(caches, revision);
  if (found) return found;
  const present = chromiumRevisionsPresent(caches);
  throw new Error(
    `No Chromium at the revision playwright-core pins (chromium-${revision}). ` +
      (present.length > 0
        ? `The ms-playwright cache holds ${present.map((r) => `chromium-${r}`).join(', ')} — none is the pinned ` +
          'revision, and this resolver will NOT substitute one: a different Chromium computes different styles, ' +
          'so anything recorded on it disagrees with CI while looking green. '
        : 'The ms-playwright cache holds no chromium at all. ') +
      'Install it with `npx playwright install chromium` (or `npx playwright-core install chromium`), ' +
      'or set PLAYWRIGHT_CHROMIUM_PATH deliberately to say which binary you mean.',
  );
}

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({ executablePath: chromiumExecutable(), headless: true });
}

/** The playground's withOverridesAsDefaults: the chosen values become the
 *  clone's prop defaults, so the emitter's first showcase item IS the
 *  requested state. core/ stays untouched. */
function withOverridesAsDefaults(
  contract: Contract,
  subst: Record<string, string>,
  bools: Record<string, boolean>,
): Contract {
  const clone = structuredClone(contract);
  for (const prop of clone.props) {
    if (prop.name in subst) prop.default = subst[prop.name];
    if (prop.name in bools) prop.default = bools[prop.name];
  }
  return clone;
}

/** Frame CSS: transparent body (content-box crop needs it), single-item
 *  showcase, animations frozen (a spinner must not smear the diff). */
const FRAME_CSS = `
  body { margin: 0; padding: 32px; background: transparent; color: #1a1a1a;
         font-family: var(--font-family-sans, system-ui, sans-serif); }
  .showcase > .showcase__item:nth-child(n + 2) { display: none; }
  .showcase__label { display: none; }
  *, *::before, *::after { animation-play-state: paused !important; transition: none !important; }
`;

export function previewDoc(
  pkg: RenderablePackage,
  contract: Contract,
  figmaFontFamily: string | null,
): string {
  const emitted = emitHtml(contract, { tokens: pkg.inventory, icons: pkg.icons, contracts: pkg.contracts });
  const fontOverride = figmaFontFamily
    ? `<style>.showcase { font-family: "${figmaFontFamily}", var(--font-family-sans, system-ui, sans-serif); }</style>`
    : '';
  return [
    '<!doctype html>',
    '<html><head><meta charset="utf-8">',
    `<style>${pkg.tokensCss}</style>`,
    `<style>${FRAME_CSS}</style>`,
    `<style>${emitted.css}</style>`,
    fontOverride,
    '</head><body>',
    emitted.html,
    '</body></html>',
  ]
    .filter(Boolean)
    .join('\n');
}

const ROOT_SELECTOR = '.showcase > .showcase__item:first-child > :nth-child(2)';

interface PageMeasurement {
  clip: Rect;
  textRects: Rect[];
  fontChecks: Record<string, boolean>;
  found: boolean;
}

export async function renderVariant(
  page: Page,
  pkg: RenderablePackage,
  subst: Record<string, string>,
  bools: Record<string, boolean>,
  interaction: Interaction,
  figmaFonts: string[],
): Promise<RenderedVariant | RenderRefusal> {
  let doc: string;
  const contract = withOverridesAsDefaults(pkg.contract, subst, bools);
  const family = figmaFonts[0] ?? null;
  try {
    doc = previewDoc(pkg, contract, family);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  await page.setContent(doc, { waitUntil: 'load' });
  // NOTE: in-page callbacks are STRINGS, not closures — tsx/esbuild injects a
  // `__name` keep-names helper into serialized functions that does not exist
  // in the page context (ReferenceError on every evaluate).
  // BOUNDED font settle (heal-round harness fix): page.evaluate has NO
  // default timeout, and document.fonts.ready occasionally never resolves in
  // headless Chromium — the run hung INDEFINITELY mid-suite (observed three
  // times on the 1,106-render live replay, different subjects each time).
  // 5s covers every local-font settle; a hung ready-promise now proceeds
  // after the bound instead of stalling the whole harness. Pixels are
  // unchanged whenever fonts settle (they settle in milliseconds locally).
  await page.evaluate('Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 5000))])');

  // Neutralize residual pointer state: the page's virtual mouse KEEPS its
  // position across setContent, so a prior hover/active row leaves :hover
  // matching on the NEXT row's element (field failure: every CBDS/Eventz
  // focus row screenshotted the HOVER fill under the focus ring — 68-70%
  // masked — because the hover row ran just before on the same page).
  // (0,0) is inside the body's 32px padding, off every component.
  await page.mouse.move(0, 0);

  // Interaction BEFORE measuring (a hover style could move descendants).
  const root = page.locator(ROOT_SELECTOR);
  if ((await root.count()) === 0) return { ok: false, error: `preview markup has no ${ROOT_SELECTOR}` };
  if (interaction === 'hover') {
    // POINTER hover, not locator.hover: the locator's actionability check
    // refuses a zero-size target with a 30s timeout — a root projected off
    // its void/raw-text element (content-model honesty) can carry no
    // intrinsic box when its children's geometry lives in zero-mint stubs
    // (the 197dd02 limit; heal-round field case: Checkbox-icon/Toggle-icon
    // hover rows). CSS :hover matches every ancestor of the hovered point,
    // so moving the mouse to the box center (or just inside the origin when
    // the box is empty — flex children paint from there) applies the same
    // hover styling locator.hover would; bounded, never a 30s stall.
    const box = await root.boundingBox();
    if (!box) return { ok: false, error: 'hover target has no layout box' };
    await page.mouse.move(
      box.x + (box.width > 0 ? box.width / 2 : 2),
      box.y + (box.height > 0 ? box.height / 2 : 2),
    );
  }
  if (interaction === 'focus-visible') await page.keyboard.press('Tab');
  if (interaction === 'active') {
    const box = await root.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
    }
  }

  // String-bodied evaluate (see the __name note above).
  const MEASURE_JS = `(() => {
    const args = ${JSON.stringify({ selector: ROOT_SELECTOR, margin: CLIP_MARGIN, fonts: figmaFonts })};
    const el = document.querySelector(args.selector);
    if (!el) return { found: false, clip: { x: 0, y: 0, width: 0, height: 0 }, textRects: [], fontChecks: {} };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const union = (r) => {
      if (r.width === 0 && r.height === 0) return;
      if (r.left < minX) minX = r.left;
      if (r.top < minY) minY = r.top;
      if (r.right > maxX) maxX = r.right;
      if (r.bottom > maxY) maxY = r.bottom;
    };
    union(el.getBoundingClientRect());
    for (const d of el.querySelectorAll('*')) union(d.getBoundingClientRect());
    const clip = {
      x: Math.max(0, minX - args.margin),
      y: Math.max(0, minY - args.margin),
      width: maxX - minX + 2 * args.margin,
      height: maxY - minY + 2 * args.margin,
    };
    const textRects = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent || n.textContent.trim().length === 0) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        if (r.width === 0 || r.height === 0) continue;
        textRects.push({ x: r.left - clip.x, y: r.top - clip.y, width: r.width, height: r.height });
      }
    }
    const fontChecks = {};
    for (const f of args.fonts) fontChecks[f] = document.fonts.check('16px "' + f + '"');
    return { found: true, clip, textRects, fontChecks };
  })()`;
  const m = (await page.evaluate(MEASURE_JS)) as PageMeasurement;
  if (!m.found) return { ok: false, error: 'component root not found for measurement' };

  // FC-VISUAL-SCREENSHOT-TIMEOUT: Playwright's default 30s screenshot can
  // flake when overlapping maintain ticks starve Chromium. One retry keeps
  // a Timeout from flipping a baseline `diffed` row to `refused`.
  let png: Buffer;
  try {
    png = await page.screenshot({ clip: m.clip, omitBackground: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/Timeout \d+ms exceeded/.test(msg)) throw e;
    png = await page.screenshot({ clip: m.clip, omitBackground: true });
  }
  if (interaction === 'active') await page.mouse.up();

  const dpr = 2;
  return {
    ok: true,
    png: Buffer.from(png),
    textRects: m.textRects.map((r) => ({
      x: r.x * dpr,
      y: r.y * dpr,
      width: r.width * dpr,
      height: r.height * dpr,
    })),
    fontChecks: m.fontChecks,
  };
}
