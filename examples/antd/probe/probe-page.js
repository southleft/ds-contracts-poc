(() => {
  const out = { modes: {}, sheets: [], selectors: {}, keyframes: [], media: [], vars: {}, layers: [] };
  // --- stylesheets
  const styles = Array.from(document.querySelectorAll('style'));
  for (const st of styles) {
    const sheet = st.sheet ;
    out.sheets.push({ attrs: Object.fromEntries(Array.from(st.attributes).map(a => [a.name, a.value.slice(0, 60)])), textLen: st.textContent?.length ?? 0, rules: sheet ? sheet.cssRules.length : -1 });
  }
  const allRules = [];
  const walk = (rules, parent) => {
    for (const r of Array.from(rules)) {
      if (r instanceof CSSStyleRule) allRules.push({ sel: r.selectorText, css: r.style.cssText, parent });
      else if (r instanceof CSSKeyframesRule) out.keyframes.push(r.name);
      else if (r instanceof CSSMediaRule) { out.media.push(r.conditionText); walk(r.cssRules, '@media ' + r.conditionText); }
      else if ((r).cssRules) { if (r.constructor.name === 'CSSLayerBlockRule') out.layers.push((r).name); walk((r).cssRules, r.constructor.name + ':' + ((r).name ?? '')); }
    }
  };
  for (const ss of Array.from(document.styleSheets)) { try { walk(ss.cssRules, ''); } catch (e) { out.sheetErr = String(e); } }
  out.ruleCount = allRules.length;
  const count = (re) => allRules.filter(r => re.test(r.sel)).length;
  out.selectors = {
    where: count(/:where\(/), hover: count(/:hover/), active: count(/:active/), focusVisible: count(/:focus-visible/), focus: count(/:focus(?!-)/),
    disabled: count(/:disabled|-disabled/), before: count(/::before/), after: count(/::after/), hashed: count(/css-dev-only-do-not-override/), cssVarClass: count(/css-var-r\d/),
    anyHoverMedia: out.media.filter((m) => /hover/.test(m)).length, mediaSamples: Array.from(new Set(out.media)).slice(0, 12),
  };
  out.btnSelectorSamples = allRules.filter(r => /\.ant-btn/.test(r.sel)).slice(0, 14).map(r => r.sel.slice(0, 220));
  out.btnPrimaryRule = allRules.filter(r => /ant-btn-color-primary|ant-btn-primary/.test(r.sel) && /background/.test(r.css)).slice(0, 3).map(r => ({ sel: r.sel.slice(0, 200), css: r.css.slice(0, 400) }));
  out.btnHoverRule = allRules.filter(r => /\.ant-btn/.test(r.sel) && /:hover/.test(r.sel) && /background|color/.test(r.css)).slice(0, 3).map(r => ({ sel: r.sel.slice(0, 220), css: r.css.slice(0, 300) }));
  out.waveRules = allRules.filter(r => /ant-wave|wave-motion/.test(r.sel)).slice(0, 4).map(r => ({ sel: r.sel.slice(0, 160), css: r.css.slice(0, 240) }));
  out.pseudoSamples = allRules.filter(r => /::(before|after)/.test(r.sel) && /content/.test(r.css)).slice(0, 12).map(r => ({ sel: r.sel.slice(0, 140), css: r.css.slice(0, 160) }));
  // var usage
  const varDecl = {}; let varUse = 0; let literalColorDecls = 0; const varDefSelectors = new Set();
  for (const r of allRules) {
    const uses = r.css.match(/var\(--[a-zA-Z0-9-]+/g) || []; varUse += uses.length;
    for (const u of uses) { const k = u.replace('var(', '').replace(/-[a-f0-9]{6,}$/, ''); varDecl[k.split('-').slice(0, 3).join('-')] = (varDecl[k.split('-').slice(0, 3).join('-')] || 0) + 1; }
    if (/--ant-[a-z]/i.test(r.css) && /:\s*(#|rgb|\d)/.test(r.css) && r.css.includes('--ant-')) varDefSelectors.add(r.sel.slice(0, 120));
    if (/(background-color|color|border-color):\s*(#|rgb)/.test(r.css)) literalColorDecls++;
  }
  out.vars = { varUse, literalColorDecls, varDefSelectors: Array.from(varDefSelectors).slice(0, 8), prefixes: Object.entries(varDecl).sort((a, b) => b[1] - a[1]).slice(0, 12) };
  // which rule defines --ant-color-primary
  const def = allRules.filter(r => /--ant-color-primary:/.test(r.css)).slice(0, 3).map(r => ({ sel: r.sel.slice(0, 120), cssSample: r.css.slice(0, 300), declCount: r.css.split('--ant-').length - 1 }));
  out.antVarDefinitions = def;
  // --- per-mode elements
  for (const mode of ['mode-default', 'mode-unhashed', 'mode-cssvar']) {
    const m = {};
    const root = document.getElementById(mode);
    const cs = getComputedStyle(root);
    m.containerClass = root.className; m.parentClass = root.parentElement?.className;
    for (const el of Array.from(root.querySelectorAll('[data-probe]')) ) {
      const key = el.dataset.probe;
      const tree = [];
      const rec = (e, d) => { if (d > 4 || tree.length > 14) return; tree.push('  '.repeat(d) + e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '') + (e.tagName === 'svg' ? `[viewBox=${e.getAttribute('viewBox')} paths=${e.querySelectorAll('path').length} fill=${e.getAttribute('fill')}]` : '')); for (const c of Array.from(e.children)) rec(c, d + 1); };
      rec(el, 0);
      const c = getComputedStyle(el);
      const pseudo = [];
      for (const e of [el, ...Array.from(el.querySelectorAll('*'))]) for (const p of ['::before', '::after']) { const pc = getComputedStyle(e, p); if (pc.content !== 'none' && pc.content !== 'normal') pseudo.push(`${e.tagName.toLowerCase()}.${(e.className).baseVal ?? String(e.className).split(' ')[0]}${p} content=${pc.content} pos=${pc.position} bg=${pc.backgroundColor} size=${pc.width}x${pc.height} border=${pc.borderWidth} anim=${pc.animationName}`); }
      const anim = [];
      for (const e of [el, ...Array.from(el.querySelectorAll('*'))]) { const ec = getComputedStyle(e); if (ec.animationName !== 'none') anim.push(`${e.tagName.toLowerCase()}.${String((e.className).baseVal ?? e.className).split(' ')[0]} ${ec.animationName} ${ec.animationDuration}`); }
      m[key] = { tag: el.tagName.toLowerCase(), tree, computed: { bg: c.backgroundColor, color: c.color, border: `${c.borderWidth} ${c.borderStyle} ${c.borderColor}`, radius: c.borderRadius, font: `${c.fontFamily.slice(0, 60)} ${c.fontSize}/${c.lineHeight} ${c.fontWeight}`, h: c.height, pad: c.padding, shadow: c.boxShadow.slice(0, 80), transition: c.transition.slice(0, 80), display: c.display }, pseudo, anim };
    }
    out.modes[mode] = m;
  }
  return out;
})()