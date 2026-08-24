import { chromium } from 'playwright-core';
import { chromiumExecutable } from './extract/figma/visual-parity/render.js';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({ executablePath: chromiumExecutable() });
const page = await browser.newPage({ viewport: { width: 1200, height: 1100 }, colorScheme: 'light' });
await page.goto('file://' + process.cwd() + '/examples/antd/.antd-sandbox/probe/index.html?mode=cssvarfont'); await page.waitForSelector('[data-probe="table"]');
const out = await page.evaluate(`(() => {
  const defs = {}; const order = [];
  const walk = (rules) => { for (const r of rules) { if (r.cssRules && !(r instanceof CSSStyleRule)) { walk(r.cssRules); continue; } if (!(r instanceof CSSStyleRule)) continue;
    const sel = r.selectorText; if (!/^\\.antd(\\.|$)/.test(sel)) continue;
    for (let i = 0; i < r.style.length; i++) { const p = r.style[i]; if (!p.startsWith('--')) continue; const v = r.style.getPropertyValue(p).trim(); if (!defs[sel]) { defs[sel] = {}; order.push(sel); } defs[sel][p] = v; } } };
  for (const ss of document.styleSheets) walk(ss.cssRules);
  // also: computed resolution of a few vars on the button root and on a descendant
  const b = document.querySelector('[data-probe="btn-primary"]'); const cs = getComputedStyle(b);
  const sw = document.querySelector('[data-probe="switch-on"] .ant-switch-handle'); const scs = getComputedStyle(sw);
  return { defs, order, probe: { rootColorPrimary: cs.getPropertyValue('--ant-color-primary'), rootBtnVar: cs.getPropertyValue('--ant-button-primary-shadow'), descSwitchHandleBg: scs.getPropertyValue('--ant-switch-handle-bg'), descColorPrimary: scs.getPropertyValue('--ant-color-primary') } };
})()`);
writeFileSync(process.env.OUT!, JSON.stringify(out, null, 1));
const counts = out.order.map((s: string) => [s, Object.keys(out.defs[s]).length]);
console.log(JSON.stringify(counts)); console.log(JSON.stringify(out.probe));
const g = out.defs['.antd']; const keys = Object.keys(g); console.log('global', keys.length, keys.slice(0, 12), keys.filter((k: string) => /font|motion|line-height|size-|padding|margin|control-height|border-radius/.test(k)).length);
console.log('btn', JSON.stringify(out.defs['.antd.ant-btn']).slice(0, 900));
console.log('switch', JSON.stringify(out.defs['.antd.ant-switch']).slice(0, 500));
// non-color value kinds in global
const kinds: Record<string, number> = {}; for (const k of keys) { const v = g[k]; const kind = /^#|^rgb/.test(v) ? 'color' : /px$/.test(v) ? 'px' : /^\d+(\.\d+)?$/.test(v) ? 'number' : /ms$|s$/.test(v) ? 'time' : /,/.test(v) ? 'list' : /cubic|ease/.test(v) ? 'easing' : 'other'; kinds[kind] = (kinds[kind] || 0) + 1; }
console.log(kinds, keys.filter((k: string) => !/^#|^rgb|px$|^\d|ms$|,|cubic/.test(g[k])).slice(0, 20).map((k: string) => k + '=' + g[k]));
await browser.close();
