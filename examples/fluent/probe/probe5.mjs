import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const url = 'file://' + path.resolve('examples/fluent/.fluent-sandbox/probe/index.html');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1400 }, deviceScaleFactor: 1, colorScheme: 'light' });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);

const out = await page.evaluate(() => {
  const R = {};
  // (1) custom-property DECLARATIONS carrying var() — the one-hop indirection sites
  const hops = [];
  const walk = (list, fn) => { for (const r of list) { if (r.style) fn(r); if (r.cssRules && r.cssRules.length) walk(r.cssRules, fn); } };
  for (const s of [...document.styleSheets]) {
    let rules; try { rules = s.cssRules; } catch { continue; }
    walk(rules, (r) => {
      for (let i = 0; i < r.style.length; i++) {
        const p = r.style[i];
        if (!p.startsWith('--')) continue;
        const v = r.style.getPropertyValue(p);
        if (v && v.includes('var(')) hops.push({ sel: r.selectorText, prop: p, val: v.trim().slice(0, 70) });
      }
      // pending-substitution custom props do not enumerate; scan cssText too
      const t = r.style.cssText;
      const re = /(^|;)\s*(--[a-zA-Z0-9_-]+)\s*:\s*([^;]*var\([^;]*)/g;
      let m; while ((m = re.exec(t)) !== null) {
        if (!hops.some((h) => h.sel === r.selectorText && h.prop === m[2])) hops.push({ sel: r.selectorText, prop: m[2], val: m[3].trim().slice(0, 70) });
      }
    });
  }
  R.hops = hops;

  // (2) per-component measured boxes (stage sizing)
  R.boxes = {};
  document.querySelectorAll('[data-probe]').forEach((h) => {
    const el = h.firstElementChild; if (!el) return;
    const b = el.getBoundingClientRect();
    R.boxes[h.dataset.probe] = [Math.round(b.width), Math.round(b.height)];
  });
  const portalBoxes = {};
  [...document.body.children].filter((c) => c.hasAttribute('data-portal-node')).forEach((c, i) => {
    const kid = [...c.children].find((k) => [...k.classList].some((x) => /^fui-/.test(x)));
    if (kid) { const b = kid.getBoundingClientRect(); portalBoxes[[...kid.classList].find((x) => /^fui-/.test(x))] = [Math.round(b.width), Math.round(b.height)]; }
  });
  R.portalBoxes = portalBoxes;

  // (3) pseudo-element decor per component root/part
  R.pseudo = {};
  document.querySelectorAll('[data-probe]').forEach((h) => {
    const rows = [];
    h.querySelectorAll('*').forEach((el) => {
      for (const pe of ['::before', '::after']) {
        const cs = getComputedStyle(el, pe);
        if (cs.content && cs.content !== 'none') {
          rows.push({ el: [...el.classList].filter((c) => /^fui-/.test(c)).join('.') || el.tagName.toLowerCase(), pe,
            content: cs.content, pos: cs.position, bg: cs.backgroundColor, border: cs.borderTopWidth + ' ' + cs.borderTopColor,
            radius: cs.borderTopLeftRadius, inset: [cs.top, cs.right, cs.bottom, cs.left].join(' ') });
        }
      }
    });
    if (rows.length) R.pseudo[h.dataset.probe] = rows;
  });
  return R;
});

fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2));
await browser.close();
console.log('hop sites:', out.hops.length);
for (const h of out.hops) console.log(' ', h.sel, '→', h.prop, '=', h.val);
console.log('boxes:', JSON.stringify(out.boxes));
console.log('portal boxes:', JSON.stringify(out.portalBoxes));
console.log('pseudo decor:', JSON.stringify(Object.fromEntries(Object.entries(out.pseudo).map(([k, v]) => [k, v.map((r) => r.el + r.pe)])), null, 0));
