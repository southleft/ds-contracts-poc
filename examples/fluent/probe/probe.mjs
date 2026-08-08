import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const url = 'file://' + path.resolve('examples/fluent/.fluent-sandbox/probe/index.html');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1400 }, deviceScaleFactor: 1, colorScheme: 'light' });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

const out = await page.evaluate(() => {
  const R = {};
  // --- 1. Where are the theme custom properties declared? ---
  const rulesWithVar = [];
  let totalRules = 0;
  const sheets = [...document.styleSheets];
  R.sheetCount = sheets.length;
  R.sheetMeta = sheets.map((s) => ({
    href: s.href, ownerTag: s.ownerNode && s.ownerNode.nodeName,
    ownerId: s.ownerNode && s.ownerNode.id, media: s.media && s.media.mediaText,
    ruleCount: (() => { try { return s.cssRules.length; } catch { return 'CORS'; } })(),
  }));
  for (const s of sheets) {
    let rules;
    try { rules = s.cssRules; } catch { continue; }
    for (const r of rules) {
      totalRules++;
      if (r.cssText && r.cssText.includes('--colorNeutralForeground1')) {
        rulesWithVar.push({ selector: r.selectorText || r.cssText.slice(0, 80), len: r.cssText.length,
          declCount: r.style ? r.style.length : null });
      }
    }
  }
  R.totalRules = totalRules;
  R.tokenDeclRules = rulesWithVar.slice(0, 6);

  // --- 2. Does the var resolve at :root? at the provider? ---
  const provider = document.querySelector('.fui-FluentProvider');
  R.providerTag = provider ? provider.tagName : null;
  R.providerClasses = provider ? [...provider.classList] : null;
  R.providerIsBodyChild = provider ? provider.parentElement.id : null;
  const probe = (el, name) => el ? getComputedStyle(el).getPropertyValue(name).trim() : 'NO-EL';
  R.varAtRoot = {
    colorNeutralForeground1: probe(document.documentElement, '--colorNeutralForeground1'),
    borderRadiusMedium: probe(document.documentElement, '--borderRadiusMedium'),
    fontSizeBase300: probe(document.documentElement, '--fontSizeBase300'),
  };
  R.varAtBody = { colorNeutralForeground1: probe(document.body, '--colorNeutralForeground1') };
  R.varAtProvider = {
    colorNeutralForeground1: probe(provider, '--colorNeutralForeground1'),
    colorBrandBackground: probe(provider, '--colorBrandBackground'),
    borderRadiusMedium: probe(provider, '--borderRadiusMedium'),
    fontSizeBase300: probe(provider, '--fontSizeBase300'),
    spacingHorizontalM: probe(provider, '--spacingHorizontalM'),
    strokeWidthThin: probe(provider, '--strokeWidthThin'),
    shadow4: probe(provider, '--shadow4'),
    fontFamilyBase: probe(provider, '--fontFamilyBase'),
  };
  const btn = document.querySelector('[data-probe="Button"] button');
  R.varAtButton = { colorNeutralForeground1: probe(btn, '--colorNeutralForeground1') };

  // --- 3. Griffel emission shape ---
  // Count declarations per rule across all Griffel sheets, and sample.
  const declHist = {};
  const sampleRules = [];
  const varUseRules = [];
  let atomicRuleCount = 0;
  for (const s of sheets) {
    let rules; try { rules = s.cssRules; } catch { continue; }
    for (const r of rules) {
      if (!r.style) continue;
      const n = r.style.length;
      declHist[n] = (declHist[n] || 0) + 1;
      atomicRuleCount++;
      if (sampleRules.length < 12) sampleRules.push({ sel: r.selectorText, n, css: r.cssText.slice(0, 160) });
      if (r.cssText.includes('var(--') && varUseRules.length < 8) varUseRules.push(r.cssText.slice(0, 160));
    }
  }
  R.declHist = declHist;
  R.rulesWithStyle = atomicRuleCount;
  R.sampleRules = sampleRules;
  R.varUseRules = varUseRules;

  // How many rules reference var( at point of use?
  let varRefRules = 0, totalStyleRules = 0;
  for (const s of sheets) {
    let rules; try { rules = s.cssRules; } catch { continue; }
    for (const r of rules) { if (r.style) { totalStyleRules++; if (r.cssText.includes('var(--')) varRefRules++; } }
  }
  R.varRefRules = varRefRules; R.totalStyleRules = totalStyleRules;

  // --- 4. Class shape on real elements ---
  const dump = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const walk = (n, depth) => {
      if (depth > 4) return null;
      return {
        tag: n.tagName.toLowerCase(),
        classes: [...n.classList],
        data: [...n.attributes].filter((a) => a.name.startsWith('data-') || a.name.startsWith('aria-') || a.name === 'role').map((a) => a.name + '=' + a.value),
        kids: [...n.children].map((c) => walk(c, depth + 1)).filter(Boolean),
      };
    };
    return walk(el, 0);
  };
  R.trees = {};
  for (const p of ['Button', 'Badge', 'Avatar', 'Card', 'MessageBar', 'Checkbox', 'Switch', 'Input', 'TabList', 'Spinner']) {
    const host = document.querySelector(`[data-probe="${p}"]`);
    R.trees[p] = host && host.firstElementChild ? dump(`[data-probe="${p}"] > *`) : null;
  }

  // --- 5. Portals: what is a direct child of body? ---
  R.bodyChildren = [...document.body.children].map((c) => ({
    tag: c.tagName.toLowerCase(), classes: [...c.classList], id: c.id,
    attrs: [...c.attributes].map((a) => a.name).join(','),
    childTags: [...c.children].map((k) => k.tagName.toLowerCase() + '.' + [...k.classList].join('.')).slice(0, 6),
    text: (c.textContent || '').slice(0, 40),
  }));

  // --- 6. Stable identity classes: do fui-* classes vary per variant? ---
  const b1 = document.querySelector('[data-probe="Button"] button');
  const b2 = document.querySelector('[data-probe="Button-subtle"] button');
  R.buttonVariantClasses = {
    primaryMedium: b1 ? [...b1.classList] : null,
    subtleSmall: b2 ? [...b2.classList] : null,
    shared: b1 && b2 ? [...b1.classList].filter((c) => b2.classList.contains(c)) : null,
  };

  // --- 7. Icon shape ---
  const icon = document.querySelector('[data-probe="Button"] svg');
  R.icon = icon ? { classes: [...icon.classList], viewBox: icon.getAttribute('viewBox'),
    childTags: [...icon.children].map((c) => c.tagName), fill: getComputedStyle(icon).fill,
    outer: icon.outerHTML.slice(0, 220) } : null;

  // --- 8. any-hover / media probes ---
  R.media = {
    anyHover: matchMedia('(any-hover: hover)').matches,
    hover: matchMedia('(hover: hover)').matches,
    prefersReducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    forcedColors: matchMedia('(forced-colors: active)').matches,
  };
  R.fonts = {
    segoe: document.fonts.check('16px "Segoe UI"'),
    resolvedButtonFont: btn ? getComputedStyle(btn).fontFamily : null,
  };

  // --- 9. Transition durations on button ---
  R.transitions = btn ? { dur: getComputedStyle(btn).transitionDuration, prop: getComputedStyle(btn).transitionProperty } : null;

  // --- 10. computed sample of button ---
  if (btn) {
    const cs = getComputedStyle(btn);
    R.buttonComputed = { bg: cs.backgroundColor, color: cs.color, radius: cs.borderRadius,
      padding: cs.paddingLeft + ' ' + cs.paddingTop, font: cs.font, w: btn.getBoundingClientRect().width };
  }
  return R;
});

fs.writeFileSync(process.argv[2] || 'probe-out.json', JSON.stringify({ errs, ...out }, null, 2));
await page.screenshot({ path: (process.argv[3] || 'probe.png'), fullPage: true });
await browser.close();
console.log('errors:', errs.length);
