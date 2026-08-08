import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const SHORTHANDS = new Set(['all','animation','background','border','border-block','border-block-end','border-block-start','border-bottom','border-color','border-image','border-inline','border-inline-end','border-inline-start','border-left','border-radius','border-right','border-style','border-top','border-width','column-rule','columns','container','flex','flex-flow','font','gap','grid','grid-area','grid-column','grid-row','grid-template','inset','inset-block','inset-inline','list-style','margin','margin-block','margin-inline','mask','offset','outline','overflow','padding','padding-block','padding-inline','place-content','place-items','place-self','scroll-margin','scroll-padding','text-decoration','text-emphasis','transition']);

const url = 'file://' + path.resolve('examples/fluent/.fluent-sandbox/probe/index.html');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1400 }, deviceScaleFactor: 1, colorScheme: 'light' });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);

const out = await page.evaluate((shorthandArr) => {
  const SH = new Set(shorthandArr);
  const declRe = /(^|;)\s*(-{0,2}[a-zA-Z][a-zA-Z0-9-]*)\s*:\s*([^;]*)/g;
  const varRe = /var\(\s*(--[a-zA-Z0-9_-]+)/g;
  const stats = { rulesSeen: 0, sheets: document.styleSheets.length, decls: 0, varDecls: 0, longhandVar: 0, shorthandVar: 0, calcVar: 0, customPropDecl: 0 };
  const referenced = new Set();
  const shorthandProps = {};
  const longhandProps = {};
  for (const s of [...document.styleSheets]) {
    let rules; try { rules = s.cssRules; } catch { continue; }
    const walk = (list) => {
      for (const r of list) {
        if (!r.style) { if (r.cssRules) walk(r.cssRules); continue; }
        stats.rulesSeen++;
        if (r.cssRules && r.cssRules.length) walk(r.cssRules);
        const txt = r.style.cssText;
        let m; declRe.lastIndex = 0;
        while ((m = declRe.exec(txt)) !== null) {
          const prop = m[2], val = m[3];
          stats.decls++;
          if (!val.includes('var(')) continue;
          stats.varDecls++;
          varRe.lastIndex = 0; let v;
          while ((v = varRe.exec(val)) !== null) referenced.add(v[1]);
          if (prop.startsWith('--')) { stats.customPropDecl++; continue; }
          if (/calc\(/.test(val)) stats.calcVar++;
          if (SH.has(prop)) { stats.shorthandVar++; shorthandProps[prop] = (shorthandProps[prop] || 0) + 1; }
          else { stats.longhandVar++; longhandProps[prop] = (longhandProps[prop] || 0) + 1; }
        }
      }
    };
    walk(rules);
  }
  return { stats, referenced: [...referenced].sort(), shorthandProps, longhandProps };
}, [...SHORTHANDS]);

fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2));
await browser.close();
console.log(JSON.stringify(out.stats));
console.log('referenced distinct vars:', out.referenced.length);
console.log('shorthand props carrying var():', JSON.stringify(out.shorthandProps));
console.log('top longhand props:', JSON.stringify(Object.fromEntries(Object.entries(out.longhandProps).sort((a,b)=>b[1]-a[1]).slice(0, 18))));
