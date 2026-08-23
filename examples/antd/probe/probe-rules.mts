import { chromium } from 'playwright-core';
import { chromiumExecutable } from './extract/figma/visual-parity/render.js';
const browser = await chromium.launch({ executablePath: chromiumExecutable() });
const page = await browser.newPage({ viewport: { width: 1200, height: 1100 }, colorScheme: 'light' });
await page.goto('file://' + process.cwd() + '/examples/antd/.antd-sandbox/probe/index.html?mode=cssvarfont'); await page.waitForSelector('[data-probe="table"]');
const out = await page.evaluate(`(() => {
  const hits = { media: [], pseudo: [], focus: [], inlineStyles: [], outlineRules: [], nested: 0, important: 0, rem: 0, calcRules: 0, transforms: [] };
  const walk = (rules, ctx) => { for (const r of rules) { if (r.cssRules && !(r instanceof CSSStyleRule)) { if (r instanceof CSSMediaRule) for (const s of r.cssRules) hits.media.push(r.conditionText + ' { ' + s.selectorText + ' { ' + s.style.cssText.slice(0,160) + ' } }'); walk(r.cssRules, ctx); continue; }
    if (!(r instanceof CSSStyleRule)) continue; const s = r.selectorText, c = r.style.cssText;
    if (r.cssRules && r.cssRules.length) hits.nested++;
    if (/!important/.test(c)) hits.important++; if (/\\drem\\b/.test(c)) hits.rem++; if (/calc\\(/.test(c)) hits.calcRules++;
    if (/(checkbox-inner|radio-inner|switch-handle|switch-inner|badge-status-dot|tooltip-arrow|btn-loading|ant-btn-variant-dashed|progress-bg|scroll-number|card-head|alert-icon|avatar-string|btn-background-ghost)/.test(s) && /::(before|after)/.test(s)) hits.pseudo.push(s.slice(0,140) + ' => ' + c.slice(0, 260));
    if (/focus-visible/.test(s) && /(btn|switch|checkbox|radio|tag|input)/.test(s)) hits.focus.push(s.slice(0,140) + ' => ' + c.slice(0, 200));
    if (/outline/.test(c) && !/outline: none|outline: 0/.test(c)) hits.outlineRules.push(s.slice(0,100) + ' => ' + c.match(/outline[^;]*;/g).join(' '));
    if (/transform:/.test(c) && /(checkbox|radio|switch|badge|btn)/.test(s)) hits.transforms.push(s.slice(0,120) + ' => ' + c.match(/transform[^;]*;/)[0]);
  } };
  for (const ss of document.styleSheets) walk(ss.cssRules, '');
  for (const el of document.querySelectorAll('[data-probe] [style], [data-probe][style]')) { const p = el.closest('[data-probe]').dataset.probe; if (!/^(tooltip|select|table|card|input|alert|progress)/.test(p) || !/width: (280|240|160|120)px/.test(el.getAttribute('style'))) hits.inlineStyles.push(p + ' ' + el.tagName.toLowerCase() + '.' + String(el.className.baseVal ?? el.className).split(' ')[0] + ' style=' + el.getAttribute('style').slice(0, 140)); }
  return hits; })()`);
console.log(JSON.stringify(out, null, 1));
await browser.close();
