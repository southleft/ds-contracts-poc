/** FIRST-PARTY code-side reference render for the console-loop lane.
 *
 *  Renders a generated component from src/components/** (the contract truth)
 *  at its contract-default props and screenshots the drawn content, producing
 *  parity/receipts/console-loop/refs/<out>.png — the committed developed
 *  reference the lane scorer (console-loop-developed-score --lib first-party)
 *  and the headless visual-truth run compare canvas cells against.
 *
 *  Pattern: examples/untitled-ui/render-one.mts (CLIP v2.0 union-of-visible
 *  -descendants clip, 8px margin, content on white). Differences:
 *    - components come from src/components/<Comp>/index.ts;
 *    - tokens come from src/styles/tokens.css (light mode — the emitted
 *      Figma variants bind the same light-mode semantic tokens);
 *    - WRAP_WIDTH=<px> mounts the component inside a fixed-width block so
 *      width-fill components (divider, banner, text-field, card) render at
 *      the same logical width as their canvas VARIANT cell (scale-1
 *      like-for-like discipline);
 *    - the font substrate is PROBED and printed (document.fonts.check for
 *      the token-declared "Inter") so the receipt can record honestly
 *      whether the ref carries real Inter glyphs or the fallback stack.
 *
 *  Usage:
 *    npx tsx scripts/console-loop-render-ref.mts <Comp> '<propsJson>' <outName> [wrapWidth]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { build } = await import(ROOT + '/node_modules/esbuild/lib/main.js');
const { chromium } = await import(ROOT + '/node_modules/playwright-core/index.mjs');
const { chromiumExecutable } = await import(ROOT + '/extract/figma/visual-parity/render.js');
const [comp, propsJson, outName, wrapWidthArg] = process.argv.slice(2);
if (!comp) {
  console.error('usage: console-loop-render-ref.mts <Comp> <propsJson> [outName] [wrapWidth]');
  process.exit(2);
}
const props = JSON.parse(propsJson || '{}');
const WRAP = wrapWidthArg ? Number(wrapWidthArg) : Number(process.env.WRAP_WIDTH || 0);
const PAD = 96;
const VW = 1000;
const VH = 800;
const SCRATCH = process.env.SCRATCH || '/tmp';
const GEN = `${ROOT}/src/components`;
const children = props.children;
delete props.children;
const entry = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ${comp} } from '${GEN}/${comp}/index.ts';
const el = React.createElement(${comp}, ${JSON.stringify(props)}${children !== undefined ? `, ${JSON.stringify(children)}` : ''});
createRoot(document.getElementById('root')).render(el);
`;
const tmp = `${SCRATCH}/fp-entry-${comp}.tsx`;
writeFileSync(tmp, entry);
const r = await build({
  entryPoints: [tmp],
  bundle: true,
  write: false,
  format: 'iife',
  jsx: 'automatic',
  loader: { '.css': 'local-css' },
  absWorkingDir: ROOT,
  nodePaths: [ROOT + '/node_modules'],
  outdir: `${SCRATCH}/fp-out`,
});
const js = r.outputFiles.find((f: any) => f.path.endsWith('.js'))!.text;
const css = r.outputFiles.filter((f: any) => f.path.endsWith('.css')).map((f: any) => f.text).join('\n');
const tokens = readFileSync(`${ROOT}/src/styles/tokens.css`, 'utf8');
// FC-FONT-SUBSTRATE: pin the EXACT face Figma's font service serves for
// "Inter" (Google Fonts Inter v20, latin variable slice; committed at
// extract/computed/fonts/inter/). A locally-installed Inter cut (e.g. the
// "18pt" optical statics) has different per-glyph advances — measured as
// cumulative tail drift on long 14px lines (text-field helper line doubled
// glyph outlines by the sentence end). @font-face beats installed families,
// so the ref render and the canvas rasterize the same outlines.
const interFace = `${ROOT}/extract/computed/fonts/inter/inter-latin-variable.woff2`;
const fontFace = `@font-face{font-family:'Inter';font-style:normal;font-weight:100 900;src:url('file://${interFace}') format('woff2');}`;
const mount = WRAP > 0 ? `<div id="root" style="display:block;width:${WRAP}px"></div>` : `<div id="root" style="display:inline-block"></div>`;
const html = `<!doctype html><meta charset="utf-8"><style>${fontFace}</style><style>${tokens}
body{margin:0;padding:${PAD}px;background:#fff;font-family:var(--font-family-sans,Inter,system-ui,sans-serif);-webkit-font-smoothing:antialiased;display:inline-block}</style>
<style>${css}</style>${mount}<script>${js}</script>`;
const page_path = `${SCRATCH}/fp-render-${comp}.html`;
writeFileSync(page_path, html);
const b = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });
const p = await b.newPage();
await p.setViewportSize({ width: VW, height: VH });
await p.goto('file://' + page_path);
await p.waitForTimeout(400);
const box = await p.evaluate(`(() => {
  const c = document.querySelector('#root').firstElementChild; if (!c) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      if (r.left < x0) x0 = r.left; if (r.top < y0) y0 = r.top;
      if (r.right > x1) x1 = r.right; if (r.bottom > y1) y1 = r.bottom;
    }
    for (const ch of el.children) add(ch);
  };
  add(c);
  if (!isFinite(x0)) { const r = c.getBoundingClientRect(); x0 = r.left; y0 = r.top; x1 = r.right; y1 = r.bottom; }
  const M = 8;
  x0 = Math.max(0, x0 - M); y0 = Math.max(0, y0 - M);
  x1 = Math.min(${VW}, x1 + M); y1 = Math.min(${VH}, y1 + M);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
})()`);
const RENDERS = process.env.FIRST_PARTY_REFS_DIR || `${ROOT}/parity/receipts/console-loop/refs`;
mkdirSync(RENDERS, { recursive: true });
const out = `${RENDERS}/${outName || comp}.png`;
if (box && (box as any).width > 4 && (box as any).height > 4) await p.screenshot({ path: out, clip: box as any });
else await p.screenshot({ path: out });
// Font substrate probe — honest record of what the PNG's glyphs are made of.
const fontProbe = await p.evaluate(`(() => {
  const c = document.querySelector('#root').firstElementChild;
  return {
    interLoaded: document.fonts.check('16px Inter'),
    computedStack: c ? getComputedStyle(c).fontFamily : null,
  };
})()`);
const root = await p.evaluate(`(() => { const c = document.querySelector('#root').firstElementChild; if (!c) return null;
  const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`);
console.log(JSON.stringify({ out: path.basename(out), box, root, wrapWidth: WRAP || null, fontProbe }));
await b.close();
