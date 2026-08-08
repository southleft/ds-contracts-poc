import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const url = 'file://' + path.resolve('examples/fluent/.fluent-sandbox/probe/index.html');
const browser = await chromium.launch();

async function run() {
  const page = await browser.newPage({ viewport: { width: 1100, height: 1400 }, deviceScaleFactor: 1, colorScheme: 'light' });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    const R = {};
    const sheets = [...document.styleSheets];
    // theme rule
    const themeRules = [];
    for (const s of sheets) {
      let rules; try { rules = s.cssRules; } catch { continue; }
      for (const rule of rules) {
        if (rule.style && rule.style.length > 100) {
          const props = [];
          for (let i = 0; i < rule.style.length; i++) props.push(rule.style[i]);
          themeRules.push({ sel: rule.selectorText, n: rule.style.length,
            ownerId: s.ownerNode && s.ownerNode.id,
            customCount: props.filter((p) => p.startsWith('--')).length,
            sample: props.slice(0, 8), tail: props.slice(-4) });
        }
      }
    }
    R.themeRules = themeRules;
    // all class names in the document (for determinism diffing)
    const all = new Set();
    document.querySelectorAll('*').forEach((el) => el.classList.forEach((c) => all.add(c)));
    R.allClasses = [...all].sort();
    // portal internals
    const portalTree = (root) => {
      const walk = (n, d) => (d > 5 ? null : ({
        tag: n.tagName.toLowerCase(), classes: [...n.classList],
        attrs: [...n.attributes].filter((a) => a.name !== 'class' && a.name !== 'style').map((a) => a.name + '=' + a.value.slice(0, 40)),
        pos: getComputedStyle(n).position, box: (() => { const b = n.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; })(),
        bg: getComputedStyle(n).backgroundColor,
        kids: [...n.children].map((c) => walk(c, d + 1)).filter(Boolean),
      }));
      return walk(root, 0);
    };
    R.portals = [...document.body.children]
      .filter((c) => c.hasAttribute('data-portal-node') || c.hasAttribute('data-tabster-dummy'))
      .map((c) => portalTree(c));
    // Griffel rule families
    let resetLike = 0, atomicLike = 0, other = 0;
    const selKinds = {};
    for (const s of sheets) {
      let rules; try { rules = s.cssRules; } catch { continue; }
      for (const rule of rules) {
        if (!rule.style) continue;
        const sel = rule.selectorText || '';
        const m = sel.match(/^\.([a-z0-9_]+)/i);
        const first = m ? m[1] : '?';
        const kind = /^r[a-z0-9]+$/.test(first) ? 'reset(r*)' : /^f[a-z0-9]+$/.test(first) ? 'atomic(f*)' : /^___/.test(first) ? 'seq(___*)' : 'other';
        selKinds[kind] = selKinds[kind] || { count: 0, declTotal: 0, maxDecl: 0 };
        selKinds[kind].count++;
        selKinds[kind].declTotal += rule.style.length;
        selKinds[kind].maxDecl = Math.max(selKinds[kind].maxDecl, rule.style.length);
        if (rule.style.length === 1) atomicLike++; else if (rule.style.length > 3) resetLike++; else other++;
      }
    }
    R.selKinds = selKinds;
    R.ruleShape = { atomicLike, resetLike, other };
    // pseudo-element rules count
    let pseudoEl = 0, pseudoClass = 0, attrSel = 0, dataFuiFocus = 0;
    for (const s of sheets) {
      let rules; try { rules = s.cssRules; } catch { continue; }
      for (const rule of rules) {
        const sel = rule.selectorText || '';
        if (/::(before|after)/.test(sel)) pseudoEl++;
        if (/:(hover|active|focus|checked|disabled|enabled)/.test(sel)) pseudoClass++;
        if (/\[data-/.test(sel)) attrSel++;
        if (/data-fui-focus-visible/.test(sel)) dataFuiFocus++;
      }
    }
    R.selectorStats = { pseudoEl, pseudoClass, attrSel, dataFuiFocus };
    // does :focus-visible appear at all?
    let realFocusVisible = 0;
    for (const s of sheets) {
      let rules; try { rules = s.cssRules; } catch { continue; }
      for (const rule of rules) if ((rule.selectorText || '').includes(':focus-visible')) realFocusVisible++;
    }
    R.realFocusVisibleRules = realFocusVisible;
    return R;
  });
  await page.close();
  return r;
}

const a = await run();
const b = await run();
await browser.close();

const diff = {
  classCountA: a.allClasses.length, classCountB: b.allClasses.length,
  identical: JSON.stringify(a.allClasses) === JSON.stringify(b.allClasses),
  onlyA: a.allClasses.filter((c) => !b.allClasses.includes(c)),
  onlyB: b.allClasses.filter((c) => !a.allClasses.includes(c)),
};
fs.writeFileSync(process.argv[2], JSON.stringify({ diff, ...a }, null, 2));
console.log('determinism identical:', diff.identical, diff.onlyA, diff.onlyB);
