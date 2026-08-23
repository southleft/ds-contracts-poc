import { chromium } from 'playwright-core';
import { chromiumExecutable } from './extract/figma/visual-parity/render.js';
import { writeFileSync, readFileSync } from 'node:fs';
const BASE = 'file://' + process.cwd() + '/examples/antd/.antd-sandbox/probe/index.html';
const PAGE_JS = readFileSync('probe-page.js', 'utf8');
const browser = await chromium.launch({ executablePath: chromiumExecutable() });
const all: any = {};
for (const mode of ['default', 'unhashed', 'cssvar', 'cssvarkey', 'cssvarfont']) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1100 }, colorScheme: 'light' });
  await page.goto(BASE + '?mode=' + mode); await page.waitForSelector(`#mode-${mode} [data-probe="table"]`); await page.waitForTimeout(400);
  const r = await page.evaluate(PAGE_JS.replace("['mode-default', 'mode-unhashed', 'mode-cssvar']", `['mode-${mode}']`));
  const q = `document.querySelector('#mode-${mode} [data-probe="btn-primary"]')`;
  const read = `(() => { const c = getComputedStyle(${q}); return { bg: c.backgroundColor, color: c.color, border: c.borderColor, shadow: c.boxShadow }; })()`;
  await page.hover(`#mode-${mode} [data-probe="btn-primary"]`); await page.waitForTimeout(400);
  r.hoverPrimary = await page.evaluate(read);
  await page.mouse.down(); await page.waitForTimeout(300);
  r.activePrimary = await page.evaluate(read);
  r.waveDuringPress = await page.evaluate("Array.from(document.querySelectorAll('.ant-wave')).map(w => ({ cls: w.className, style: w.getAttribute('style')?.slice(0, 200), inside: w.closest('[data-probe]')?.getAttribute('data-probe'), transition: getComputedStyle(w).transition.slice(0,80), boxShadow: getComputedStyle(w).boxShadow.slice(0,80), opacity: getComputedStyle(w).opacity }))");
  await page.mouse.up(); await page.waitForTimeout(120);
  r.waveAfterClick = await page.evaluate("Array.from(document.querySelectorAll('.ant-wave')).map(w => ({ cls: w.className, inside: w.closest('[data-probe]')?.getAttribute('data-probe'), transition: getComputedStyle(w).transition.slice(0,80), boxShadow: getComputedStyle(w).boxShadow.slice(0,80), opacity: getComputedStyle(w).opacity }))");
  await page.waitForTimeout(1200);
  r.waveAfter1300ms = await page.evaluate("document.querySelectorAll('.ant-wave').length");
  await page.mouse.move(5, 5); await page.waitForTimeout(300);
  r.restPrimaryAfterHover = await page.evaluate(read);
  await page.keyboard.press('Tab');
  r.focusVisible = await page.evaluate("(() => { const a = document.activeElement; const c = getComputedStyle(a); return { probe: a?.closest('[data-probe]')?.getAttribute('data-probe'), outline: c.outline, outlineOffset: c.outlineOffset, shadow: c.boxShadow.slice(0, 120), matches: a.matches(':focus-visible') }; })()");
  // switch hover/active (antd Switch :active elongates handle)
  await page.hover(`#mode-${mode} [data-probe="switch-on"]`); await page.mouse.down(); await page.waitForTimeout(250);
  r.switchActive = await page.evaluate(`(() => { const s = document.querySelector('#mode-${mode} [data-probe="switch-on"]'); const h = s.querySelector('.ant-switch-handle'); const hc = getComputedStyle(h, '::before'); return { handleW: getComputedStyle(h).width, handleInsetInlineStart: getComputedStyle(h).insetInlineStart, beforeInsetEnd: hc.insetInlineEnd, beforeBg: hc.backgroundColor, bg: getComputedStyle(s).backgroundColor }; })()`);
  await page.mouse.up();
  await page.screenshot({ path: `${process.env.OUTDIR}/probe-${mode}.png`, fullPage: true });
  all[mode] = r;
  await page.close();
}
// double run: reload default and compare the class string
const page = await browser.newPage({ viewport: { width: 1200, height: 1100 }, colorScheme: 'light' });
await page.goto(BASE + '?mode=default'); await page.waitForSelector('#mode-default [data-probe="table"]');
all.doubleRun = { default: await page.evaluate(`document.querySelector('#mode-default [data-probe="btn-primary"]').className`) };
await page.goto(BASE + '?mode=cssvarkey'); await page.waitForSelector('#mode-cssvarkey [data-probe="table"]');
all.doubleRun.cssvarkey = await page.evaluate(`document.querySelector('#mode-cssvarkey [data-probe="btn-primary"]').className`);
all.doubleRun.cssvarkeyVarRule = await page.evaluate(`(() => { for (const ss of document.styleSheets) for (const r of ss.cssRules) if (r.style && r.style.cssText.includes('--ant-color-primary:')) return { sel: r.selectorText, n: r.style.length }; })()`);
writeFileSync(process.env.OUT!, JSON.stringify(all, null, 1));
await browser.close();
