/** FIRST-PARTY code-side reference render for the A3 COMPOSITION corpus.
 *
 *  Sibling of scripts/console-loop-render-ref.mts. That script renders a
 *  lower-order component at its contract-default props; a composition has no
 *  interesting default — its subject is the LAYOUT, and its slots are
 *  ReactNode props that cannot be expressed as a JSON prop bag. So this
 *  script takes a FILL SPEC instead: which component to mount into each slot,
 *  pinned identically on both surfaces (docs/composition-corpus/README.md,
 *  scoring convention (b) FILLED).
 *
 *  Differences from the lower-order renderer, all deliberate:
 *    - the clip is the composition ROOT's own border box, NOT the
 *      union-of-visible-descendants with an 8px margin. A layout's box IS its
 *      claim (640x480 for the bento), and the canvas side exports the VARIANT
 *      frame at exactly that box, so clipping to the root is what makes the
 *      two PNGs like-for-like at scale 1. An empty composition paints nothing,
 *      which is why EMPTY is scored structurally and never by these pixels.
 *    - no WRAP_WIDTH: every composition in the corpus carries its own width
 *      literal, so the box is contract-determined on both surfaces.
 *
 *  The Inter face is pinned exactly as the sibling pins it (FC-FONT-SUBSTRATE):
 *  the same Google Fonts Inter v20 latin variable slice Figma's font service
 *  serves, so ref and canvas rasterize the same outlines.
 *
 *  Usage:
 *    npx tsx scripts/console-loop-render-composition-ref.mts <Comp> '<fillJson>' <outName>
 *
 *  <fillJson> maps slot prop name -> { comp, props?, text? }, e.g.
 *    '{"start":{"comp":"Badge","text":"Badge"},"end":{"comp":"Badge","text":"Badge"}}'
 *  An empty object renders the EMPTY composition.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { build } = await import(ROOT + '/node_modules/esbuild/lib/main.js');
const { chromium } = await import(ROOT + '/node_modules/playwright-core/index.mjs');
const { chromiumExecutable } = await import(ROOT + '/extract/figma/visual-parity/render.js');

const [comp, fillJson, outName] = process.argv.slice(2);
if (!comp) {
  console.error('usage: console-loop-render-composition-ref.mts <Comp> <fillJson> [outName]');
  process.exit(2);
}
type Fill = { comp: string; props?: Record<string, unknown>; text?: string };
const fills: Record<string, Fill> = JSON.parse(fillJson || '{}');
const PAD = 96;
const VW = 1200;
const VH = 1400;
const SCRATCH = process.env.SCRATCH || '/tmp';
const GEN = `${ROOT}/src/components`;

const childComps = [...new Set(Object.values(fills).map((f) => f.comp))];
const imports = [comp, ...childComps]
  .filter((c, i, a) => a.indexOf(c) === i)
  .map((c) => `import { ${c} } from '${GEN}/${c}/index.ts';`)
  .join('\n');
const slotProps = Object.entries(fills)
  .map(
    ([slot, f]) =>
      `${JSON.stringify(slot)}: React.createElement(${f.comp}, ${JSON.stringify(f.props ?? {})}${
        f.text !== undefined ? `, ${JSON.stringify(f.text)}` : ''
      })`,
  )
  .join(', ');

const entry = `
import React from 'react';
import { createRoot } from 'react-dom/client';
${imports}
const el = React.createElement(${comp}, { ${slotProps} });
createRoot(document.getElementById('root')).render(el);
`;
const tmp = `${SCRATCH}/cc-entry-${comp}.tsx`;
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
  outdir: `${SCRATCH}/cc-out`,
});
const js = r.outputFiles.find((f: any) => f.path.endsWith('.js'))!.text;
const css = r.outputFiles.filter((f: any) => f.path.endsWith('.css')).map((f: any) => f.text).join('\n');
const tokens = readFileSync(`${ROOT}/src/styles/tokens.css`, 'utf8');
const interFace = `${ROOT}/extract/computed/fonts/inter/inter-latin-variable.woff2`;
const fontFace = `@font-face{font-family:'Inter';font-style:normal;font-weight:100 900;src:url('file://${interFace}') format('woff2');}`;
const html = `<!doctype html><meta charset="utf-8"><style>${fontFace}</style><style>${tokens}
body{margin:0;padding:${PAD}px;background:#fff;font-family:var(--font-family-sans,Inter,system-ui,sans-serif);-webkit-font-smoothing:antialiased}</style>
<style>${css}</style><div id="root"></div><script>${js}</script>`;
const pagePath = `${SCRATCH}/cc-render-${comp}.html`;
writeFileSync(pagePath, html);

const b = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });
const p = await b.newPage();
await p.setViewportSize({ width: VW, height: VH });
await p.goto('file://' + pagePath);
await p.waitForTimeout(400);
// Clip to the composition ROOT's own border box — the layout's box IS the claim.
const box = await p.evaluate(`(() => {
  const c = document.querySelector('#root').firstElementChild; if (!c) return null;
  const r = c.getBoundingClientRect();
  return { x: r.left, y: r.top, width: r.width, height: r.height };
})()`);
const RENDERS = process.env.FIRST_PARTY_REFS_DIR || `${ROOT}/parity/receipts/console-loop/refs`;
mkdirSync(RENDERS, { recursive: true });
const out = `${RENDERS}/${outName || comp}.png`;
if (box && (box as any).width > 4 && (box as any).height > 4) {
  await p.screenshot({ path: out, clip: box as any });
} else {
  await p.screenshot({ path: out });
}
const probe = await p.evaluate(`(() => {
  const c = document.querySelector('#root').firstElementChild;
  return {
    interLoaded: document.fonts.check('16px Inter'),
    computedStack: c ? getComputedStyle(c).fontFamily : null,
    slotBoxes: c ? [...c.children].map((k) => {
      const r = k.getBoundingClientRect();
      return { cls: k.className, w: Math.round(r.width), h: Math.round(r.height) };
    }) : [],
  };
})()`);
console.log(JSON.stringify({ out: path.basename(out), box, fills: Object.keys(fills), probe }));
await b.close();
