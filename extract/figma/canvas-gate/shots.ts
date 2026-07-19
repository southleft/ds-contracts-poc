/**
 * Shared screenshot plumbing — one measurement path for BOTH sides.
 *
 * Every cell (canvas or real) lives in a transparent, hugging stage marked
 * [data-cell]; the capture measures the painted union box of the stage's
 * first element child + descendants, clips with a fixed margin, and
 * screenshots with omitBackground at deviceScaleFactor 2. Text-node client
 * rects are collected per side (device px, clip-relative) — the mask inputs.
 *
 * Interaction driving mirrors extract/figma/visual-parity/render.ts and
 * extract/computed/capture.ts: residual-pointer neutralization, hover via
 * locator.hover({force}), :focus-visible via sentinel focus + Tab, active
 * via hover + mouse.down, infinite animations pinned at currentTime 0
 * before every shot, uncontrolled form state reset after active clicks.
 *
 * NOTE: all in-page callbacks are STRING evaluates — tsx serializes function
 * bodies with a __name helper that does not exist in the page (the
 * documented render.ts trap).
 */
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import { chromiumExecutable } from '../visual-parity/render.js';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CellShot {
  png: Buffer;
  /** Text-node client rects, DEVICE px, clip-relative. */
  textRects: Rect[];
  /** CSS-px size of the painted union box (pre-margin). */
  contentBox: { width: number; height: number };
  /** :focus-visible actually matched (focus-visible interaction only). */
  focusVisibleMatched?: boolean;
}

export type Interaction = 'default' | 'hover' | 'focus-visible' | 'active';

const CLIP_MARGIN = 24;
const DPR = 2;

export async function launchGateBrowser(): Promise<Browser> {
  return chromium.launch({ executablePath: chromiumExecutable(), headless: true });
}

export async function newGatePage(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    // STAGE PARITY (Round 5 finding): the floor capture ran at 600×800
    // (extract/computed/configs/polaris.json browser.viewport) and Polaris
    // sizes controls BY BREAKPOINT — at ≥768px (md) the Checkbox/RadioButton
    // backdrop is 16px, below it 20px. The gate's old 1000px viewport put
    // the REAL side in a different breakpoint bucket than the captured
    // truth the contracts carry (backdrop 20×20), so every control compared
    // against a smaller-than-captured render. Same bucket, same truth.
    viewport: { width: 600, height: 800 },
    deviceScaleFactor: DPR,
    colorScheme: 'light',
  });
  const page = await context.newPage();
  return { context, page };
}

/** capture.ts pinInfiniteAnimations + Round 5: FINITE animations settle to
 *  their END state. The page CSS pauses every animation for determinism,
 *  which froze finite ENTRANCE animations at t=0 — the real Checkbox's
 *  check draw-in (stroke-dashoffset keyframes) never rendered, so the real
 *  side compared as a glyph-less box against the contract's carried glyph.
 *  finish() renders the settled final frame; infinite animations stay
 *  pinned at t=0 (idempotent). */
const PIN_ANIMATIONS_JS = `(() => {
  const names = [];
  for (const a of document.getAnimations()) {
    let t = null;
    try { t = a.effect && a.effect.getTiming ? a.effect.getTiming() : null; } catch {}
    if (t && t.iterations === Infinity) {
      if (a.playState !== 'paused') { a.pause(); a.currentTime = 0; }
      names.push(a.animationName || a.id || '(unnamed)');
    } else {
      try { a.finish(); } catch {}
    }
  }
  return names.sort();
})()`;

const measureJs = (cellSel: string) => `(() => {
  const args = ${JSON.stringify({ margin: CLIP_MARGIN })};
  const stage = document.querySelector(${JSON.stringify(cellSel)});
  const el = stage && stage.firstElementChild;
  if (!el) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const union = (r) => {
    if (r.width === 0 && r.height === 0) return;
    if (r.left < minX) minX = r.left;
    if (r.top < minY) minY = r.top;
    if (r.right > maxX) maxX = r.right;
    if (r.bottom > maxY) maxY = r.bottom;
  };
  union(el.getBoundingClientRect());
  // Skip descendants that paint nothing: opacity-0 overlays (Polaris's
  // absolutely-positioned form inputs), visibility:hidden, the 1px
  // visually-hidden pattern, and off-screen a11y text (top:-9999px
  // positioning — Polaris labelHidden) — their layout rects would inflate
  // the union box far beyond the painted component. "Near" = within 300px
  // of the stage's own rect (overlays and shadows stay in).
  const sr = stage.getBoundingClientRect();
  const NEAR = 300;
  for (const d of el.querySelectorAll('*')) {
    const cs = getComputedStyle(d);
    if (cs.opacity === '0' || cs.visibility !== 'visible' || cs.display === 'none') continue;
    const r = d.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) continue;
    if (r.right < sr.left - NEAR || r.left > sr.right + NEAR || r.bottom < sr.top - NEAR || r.top > sr.bottom + NEAR) continue;
    union(r);
  }
  if (minX === Infinity) { const r = el.getBoundingClientRect(); minX = r.left; minY = r.top; maxX = r.right; maxY = r.bottom; }
  // Playwright's screenshot clip is VIEWPORT-relative — clamp the margin to
  // the viewport (the element itself is scrolled into view by the caller;
  // clipped margin is white and trimmed by the scorer anyway).
  const x0 = Math.max(0, minX - args.margin);
  const y0 = Math.max(0, minY - args.margin);
  const x1 = Math.min(window.innerWidth, maxX + args.margin);
  const y1 = Math.min(window.innerHeight, maxY + args.margin);
  const clip = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  const textRects = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent || n.textContent.trim().length === 0) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) {
      if (r.width === 0 || r.height === 0) continue;
      textRects.push({ x: r.left - x0, y: r.top - y0, width: r.width, height: r.height });
    }
  }
  return { clip, textRects, content: { width: maxX - minX, height: maxY - minY } };
})()`;

interface Measurement {
  clip: Rect;
  textRects: Rect[];
  content: { width: number; height: number };
}

export async function captureCell(
  page: Page,
  cellKey: string,
  interaction: Interaction,
): Promise<CellShot> {
  const cellSel = `[data-cell="${cellKey}"]`;
  const rootLoc = page.locator(`${cellSel} > *`).first();

  await page.evaluate(PIN_ANIMATIONS_JS);
  // Residual-pointer + focus neutralization (render.ts discipline).
  await page.mouse.move(0, 0);
  await page.evaluate(`document.activeElement && document.activeElement.blur && document.activeElement.blur()`);
  await page.locator(cellSel).scrollIntoViewIfNeeded();

  let focusVisibleMatched: boolean | undefined;
  if (interaction === 'hover') {
    await rootLoc.hover({ force: true });
  } else if (interaction === 'focus-visible') {
    await page.evaluate(`(() => { const s = document.querySelector('[data-sentinel="${cellKey}"]'); if (s) s.focus(); })()`);
    await page.keyboard.press('Tab');
    focusVisibleMatched = (await page.evaluate(
      `(() => { const el = document.querySelector('${cellSel} > *'); if (!el) return false; if (el.matches(':focus-visible')) return true; return !!el.querySelector(':focus-visible'); })()`,
    )) as boolean;
  } else if (interaction === 'active') {
    await rootLoc.hover({ force: true });
    await page.mouse.down();
  }

  await page.evaluate(PIN_ANIMATIONS_JS);
  const m = (await page.evaluate(measureJs(cellSel))) as Measurement | null;
  if (!m) throw new Error(`gate cell not found or empty: ${cellKey}`);

  // WHITE background kept in the shot (translucent Polaris fills — disabled
  // washes at 5% black — sit below the alpha-trim floor; the scorer trims
  // near-white margins instead).
  const png = await page.screenshot({ clip: m.clip });

  if (interaction === 'active') {
    await page.mouse.up();
    // Reset uncontrolled form state the click itself mutated (capture.ts
    // formStateReset — the RadioButton double-run trap).
    await page.evaluate(
      `(() => { const stage = document.querySelector('${cellSel}'); if (!stage) return; for (const inp of stage.querySelectorAll('input')) { if (inp.checked !== inp.defaultChecked) { inp.checked = inp.defaultChecked; inp.dispatchEvent(new Event('change', { bubbles: true })); } if (inp.value !== inp.defaultValue) inp.value = inp.defaultValue; } })()`,
    );
  }

  return {
    png: Buffer.from(png),
    textRects: m.textRects.map((r) => ({
      x: r.x * DPR,
      y: r.y * DPR,
      width: r.width * DPR,
      height: r.height * DPR,
    })),
    contentBox: m.content,
    ...(focusVisibleMatched !== undefined ? { focusVisibleMatched } : {}),
  };
}

export async function fontAvailable(page: Page, family: string): Promise<boolean> {
  return (await page.evaluate(`document.fonts.check('16px "${family}"')`)) as boolean;
}
