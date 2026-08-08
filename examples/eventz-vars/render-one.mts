/** Standalone component render for the Eventz kit — the untitled-ui
 *  render-one.mts harness (CLIP v2.0, union of root + visible descendants,
 *  8px margin) with only the kit paths changed: components come from
 *  examples/eventz-vars/storybook/src/generated, the stylesheet from
 *  examples/eventz-vars/storybook/src/tokens.css, and PNGs land in
 *  examples/eventz-vars/renders (FIDELITY_RENDERS_DIR redirects).
 *
 *  FONT SUBSTRATE — deliberately unchanged from the uui harness: the page
 *  loads NO webfonts (font-family: Inter, -apple-system, system-ui,
 *  sans-serif with whatever the OS resolves). The kit's typography tokens
 *  name families this page may not have; the fidelity table tags the cost as
 *  FC-FONT-SUBSTRATE rather than hiding it.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { build } = await import(ROOT + '/node_modules/esbuild/lib/main.js');
const { chromium } = await import(ROOT + '/node_modules/playwright-core/index.mjs');
const { chromiumExecutable } = await import(ROOT + '/extract/figma/visual-parity/render.js');
const [comp, propsJson, outName] = process.argv.slice(2);
const props = JSON.parse(propsJson || '{}');
const CLIP = process.env.FIDELITY_CLIP === 'root' ? 'root' : 'union';
const PAD = CLIP === 'root' ? 16 : 96;
const VW = CLIP === 'root' ? 900 : 1000;
const VH = CLIP === 'root' ? 700 : 800;
const GEN = `${ROOT}/examples/eventz-vars/storybook/src/generated`;
const entry = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ${comp} } from '${GEN}/${comp}/index.ts';
const el = React.createElement(${comp}, ${JSON.stringify(props)});
createRoot(document.getElementById('root')).render(el);
`;
const tmp = `${process.env.SCRATCH || '/tmp'}/entry-ev-${comp}.tsx`;
writeFileSync(tmp, entry);
const r = await build({ entryPoints: [tmp], bundle: true, write: false, format: 'iife', jsx: 'automatic', loader: { '.css': 'local-css' }, absWorkingDir: ROOT, nodePaths: [ROOT + '/node_modules'], outdir: `${process.env.SCRATCH || '/tmp'}/out` });
const js = r.outputFiles.find(f => f.path.endsWith('.js')).text;
const css = r.outputFiles.filter(f => f.path.endsWith('.css')).map(f => f.text).join('\n');
const tokens = readFileSync(`${ROOT}/examples/eventz-vars/storybook/src/tokens.css`, 'utf8');
const html = `<!doctype html><meta charset="utf-8"><style>${tokens}
body{margin:0;padding:${PAD}px;background:#fff;font-family:Inter,-apple-system,system-ui,sans-serif;-webkit-font-smoothing:antialiased;display:inline-block}</style>
<style>${css}</style><div id="root" style="display:inline-block"></div><script>${js}</script>`;
const page_path = `${process.env.SCRATCH || '/tmp'}/render-ev-${comp}.html`;
writeFileSync(page_path, html);
const b = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });
const p = await b.newPage();
await p.setViewportSize({ width: VW, height: VH });
await p.goto('file://' + page_path);
await p.waitForTimeout(400);
const box = CLIP === 'root'
  ? await p.evaluate(`(() => { const c = document.querySelector('#root').firstElementChild; if (!c) return null; const r = c.getBoundingClientRect(); return { x: Math.max(0, r.x - 8), y: Math.max(0, r.y - 8), width: Math.min(${VW - 16}, r.width + 16), height: Math.min(${VH - 16}, r.height + 16) }; })()`)
  : await p.evaluate(`(() => {
      const c = document.querySelector('#root').firstElementChild; if (!c) return null;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      const add = (el) => {
        const cs = getComputedStyle(el);
        // display:none / visibility:hidden / opacity:0 draw nothing — and
        // neither does their subtree, so the whole branch is skipped.
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
// FIDELITY_RENDERS_DIR redirects the PNG (fresh-check runs score into a temp
// dir instead of mutating the committed renders); default is the committed dir.
const RENDERS = process.env.FIDELITY_RENDERS_DIR || `${ROOT}/examples/eventz-vars/renders`;
mkdirSync(RENDERS, { recursive: true });
const out = `${RENDERS}/${outName || comp}.png`;
if (box && box.width > 4 && box.height > 4) await p.screenshot({ path: out, clip: box });
else await p.screenshot({ path: out });
const errs = [];
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
// SCORER v2.1 — the ROOT's own border box in the same page coordinates as the
// clip box, so a scorer can place the component's box inside the PNG. Reported
// on STDOUT ONLY: the PNG bytes are untouched by this addition.
const root = await p.evaluate(`(() => { const c = document.querySelector('#root').firstElementChild; if (!c) return null;
  const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`);
console.log(JSON.stringify({ out: path.basename(out), clip: CLIP, box, root }));
await b.close();
