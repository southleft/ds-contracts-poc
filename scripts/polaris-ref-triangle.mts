/** POLARIS REF TRIANGLE — localise a console-loop pixel miss to reader, contract, emitter or REFERENCE.
 *
 *  The polaris console-loop lane scores a Figma VARIANT-cell screenshot against a
 *  committed "developed reference" PNG. Those references were rendered from
 *  `examples/polaris/generated/html/<stem>.html#first-item-inline-css` — the CODE
 *  side of the same contract the canvas was emitted from. A reference rendered at
 *  an older contract/emitter revision and never re-rendered reads on the scorecard
 *  exactly like a canvas defect.
 *
 *  This probe renders the CURRENT emit-html first showcase item at scale 1 and
 *  measures the three legs of the triangle:
 *
 *      fresh emit-html  ─── legRefFresh ───  committed ref
 *            │                                    │
 *      legCanvasFresh                       legCanvasRef (the scorecard number)
 *            └────────── canvas cell ────────────┘
 *
 *  Reading:
 *    legCanvasFresh ≈ 0 and legRefFresh large  → the committed ref is STALE; the
 *                                                canvas agrees with today's code.
 *    legRefFresh ≈ 0 and legCanvasFresh large  → the reference is current; the
 *                                                canvas genuinely differs (emitter).
 *    both large                                → independent defects on both sides.
 *
 *  Usage:  npx tsx scripts/polaris-ref-triangle.mts [stem ...]
 *  Writes: fresh renders to parity/receipts/console-loop/polaris/refs-fresh/<stem>.png
 *          and a machine-readable summary to .../refs-fresh/TRIANGLE.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = await import(ROOT + '/node_modules/playwright-core/index.mjs');
const { chromiumExecutable } = await import(ROOT + '/extract/figma/visual-parity/render.js');
const { PNG } = await import(ROOT + '/node_modules/pngjs/lib/png.js');
const pixelmatch = (await import(ROOT + '/node_modules/pixelmatch/index.js')).default;

const LANE = path.join(ROOT, 'parity/receipts/console-loop/polaris');
const HTML_DIR = path.join(ROOT, 'examples/polaris/generated/html');
const OUT = path.join(LANE, 'refs-fresh');
mkdirSync(OUT, { recursive: true });

const stems = process.argv.slice(2).filter((a) => !a.startsWith('-'));
/** FC-WHITE-ON-WHITE: a component whose root fill IS the review surface (Polaris
 *  Button secondary is #ffffff) has no content box on white — the scorer's crop
 *  finds only the border and the comparison collapses to a 63x21 sliver. Render
 *  BOTH sides on the lane's declared review surface instead. */
const BG = process.env.REF_BG || '#ffffff';
const manifest = JSON.parse(readFileSync(path.join(LANE, 'manifest.json'), 'utf8'));
const framing = JSON.parse(readFileSync(path.join(LANE, 'framing.json'), 'utf8'));
const allStems: string[] = stems.length ? stems : manifest.required ?? manifest.components ?? [];

const tokensCss =
  readFileSync(path.join(HTML_DIR, 'polaris-tokens.css'), 'utf8') +
  '\n' +
  (existsSync(path.join(HTML_DIR, 'polaris-minted-tokens.css'))
    ? readFileSync(path.join(HTML_DIR, 'polaris-minted-tokens.css'), 'utf8')
    : '');

/** FC-FONT-SUBSTRATE: the canvas cells are typeset in real Inter. A reference
 *  rendered on the CSS fallback stack disagrees on every glyph edge, which reads
 *  as a canvas defect. Load the same face the capture harness carries. */
const interPath = path.join(ROOT, 'extract/computed/fonts/inter/inter-latin-variable.woff2');
const fontCss = existsSync(interPath)
  ? `@font-face{font-family:'Inter';font-style:normal;font-weight:100 900;font-display:block;src:url(data:font/woff2;base64,${readFileSync(interPath).toString('base64')}) format('woff2');}`
  : '';

const BGRGB = [parseInt(BG.slice(1,3),16), parseInt(BG.slice(3,5),16), parseInt(BG.slice(5,7),16)];

/** Flatten onto the review surface — Figma exports carry alpha, HTML renders do not. */
function flatten(png: any) {
  const out = new PNG({ width: png.width, height: png.height });
  for (let i = 0; i < png.data.length; i += 4) {
    const a = png.data[i + 3] / 255;
    out.data[i] = Math.round(png.data[i] * a + BGRGB[0] * (1 - a));
    out.data[i + 1] = Math.round(png.data[i + 1] * a + BGRGB[1] * (1 - a));
    out.data[i + 2] = Math.round(png.data[i + 2] * a + BGRGB[2] * (1 - a));
    out.data[i + 3] = 255;
  }
  return out;
}

/** Centre-crop to the pinned VARIANT-cell box (committed shots carry a uniform margin). */
function cropTo(png: any, w: number, h: number) {
  if (png.width === w && png.height === h) return png;
  if (png.width < w || png.height < h) return png;
  const x0 = Math.round((png.width - w) / 2);
  const y0 = Math.round((png.height - h) / 2);
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = ((y + y0) * png.width + (x + x0)) * 4;
      const d = (y * w + x) * 4;
      out.data[d] = png.data[s]; out.data[d + 1] = png.data[s + 1];
      out.data[d + 2] = png.data[s + 2]; out.data[d + 3] = png.data[s + 3];
    }
  return out;
}

/** Trim fully-transparent / uniform-white margin so two renders compare content-box to content-box. */
function contentBox(png: any) {
  const { width: w, height: h, data } = png;
  const isBg = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    if (data[i + 3] < 8) return true;
    return data[i] === BGRGB[0] && data[i + 1] === BGRGB[1] && data[i + 2] === BGRGB[2];
  };
  let x0 = 0, y0 = 0, x1 = w - 1, y1 = h - 1;
  const rowBg = (y: number) => { for (let x = 0; x < w; x++) if (!isBg(x, y)) return false; return true; };
  const colBg = (x: number) => { for (let y = 0; y < h; y++) if (!isBg(x, y)) return false; return true; };
  while (y0 < y1 && rowBg(y0)) y0++;
  while (y1 > y0 && rowBg(y1)) y1--;
  while (x0 < x1 && colBg(x0)) x0++;
  while (x1 > x0 && colBg(x1)) x1--;
  return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function crop(png: any) {
  const b = contentBox(png);
  const out = new PNG({ width: b.w, height: b.h });
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const s = ((y + b.y0) * png.width + (x + b.x0)) * 4;
      const d = (y * b.w + x) * 4;
      // flatten onto white so alpha-edged Figma exports and opaque HTML renders agree
      const a = png.data[s + 3] / 255;
      out.data[d] = Math.round(png.data[s] * a + BGRGB[0] * (1 - a));
      out.data[d + 1] = Math.round(png.data[s + 1] * a + BGRGB[1] * (1 - a));
      out.data[d + 2] = Math.round(png.data[s + 2] * a + BGRGB[2] * (1 - a));
      out.data[d + 3] = 255;
    }
  }
  return out;
}

/** Compare two PNGs at the pinned cell box. Reports BOTH the scorer's tolerant
 *  pctAA (pixelmatch threshold 0.1 — blind to a #F0F0F0→#D5EBFF tone swap, which
 *  is under its YIQ delta) and a strict per-channel pctExact that is not. */
function compare(aPath: string, bPath: string, box?: { w: number; h: number }) {
  if (!existsSync(aPath) || !existsSync(bPath)) return { pctAA: null, pctExact: null, note: 'missing' };
  let a = flatten(PNG.sync.read(readFileSync(aPath)));
  let b = flatten(PNG.sync.read(readFileSync(bPath)));
  if (box) { a = cropTo(a, box.w, box.h); b = cropTo(b, box.w, box.h); }
  if (a.width !== b.width || a.height !== b.height) {
    a = crop(a); b = crop(b);
  }
  if (a.width !== b.width || a.height !== b.height) {
    return { pctAA: null, pctExact: null, note: `size ${a.width}x${a.height} vs ${b.width}x${b.height}` };
  }
  const diff = new PNG({ width: a.width, height: a.height });
  const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1, includeAA: false });
  let exact = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    if (Math.abs(a.data[i] - b.data[i]) > 2 || Math.abs(a.data[i + 1] - b.data[i + 1]) > 2 || Math.abs(a.data[i + 2] - b.data[i + 2]) > 2) exact++;
  }
  const px = a.width * a.height;
  return { pctAA: (100 * n) / px, pctExact: (100 * exact) / px, note: `${a.width}x${a.height}` };
}

const browser = await chromium.launch({ executablePath: chromiumExecutable() });
const results: any[] = [];

for (const stem of allStems) {
  const htmlPath = path.join(HTML_DIR, `${stem}.html`);
  const cssPath = path.join(HTML_DIR, `${stem}.css`);
  if (!existsSync(htmlPath)) { results.push({ stem, error: 'no generated html' }); continue; }
  const body = readFileSync(htmlPath, 'utf8');
  const css = readFileSync(cssPath, 'utf8');
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 1 });
  await page.setContent(
    `<!doctype html><meta charset="utf-8"><style>${fontCss}\n${tokensCss}\n${css}\nhtml,body{margin:0;padding:24px;background:${BG};font-family:var(--p-font-family-sans)}\n.showcase{font-family:var(--p-font-family-sans)!important}</style>${body}`,
    { waitUntil: 'load' },
  );
  await page.evaluate(() => (document as any).fonts.ready);
  // the component element = the first showcase item's non-label child
  const handle = await page.$('.showcase__item > :not(.showcase__label)');
  if (!handle) { results.push({ stem, error: 'no first item' }); await page.close(); continue; }
  const freshPath = path.join(OUT, `${stem}.png`);
  await handle.screenshot({ path: freshPath, omitBackground: false });
  await page.close();

  const refPath = path.join(LANE, 'refs', `${stem}.png`);
  const shotPath = path.join(LANE, 'shots', `${stem}-cell.png`);
  const livePath = path.join(LANE, 'shots', `${stem}-cell-live.png`);
  const pin = framing.stems?.[stem];
  const box = pin ? { w: Math.round(pin.cellW), h: Math.round(pin.cellH) } : undefined;
  results.push({
    stem,
    box,
    // the scorecard's number: committed shot vs committed ref
    legCommittedShotVsRef: compare(shotPath, refPath),
    // is the committed shot still the live cell?
    legCommittedVsLive: compare(shotPath, livePath, box),
    // the honest number: live canvas cell vs today's code render
    legLiveVsFresh: compare(livePath, freshPath, box),
    // is the committed reference still today's code render?
    legRefVsFresh: compare(refPath, freshPath),
  });
}
await browser.close();

writeFileSync(path.join(OUT, 'TRIANGLE.json'), JSON.stringify({ recordedAt: new Date().toISOString(), results }, null, 2) + '\n');

/** --adopt: install the regenerated render as the lane's developed reference and
 *  re-point the receipt at it. The reference's OWN definition in this lane is "the
 *  code-side render of the same contract at the pinned cell's variant"; a PNG
 *  rendered from an older contract revision does not meet that definition, and its
 *  staleness is measured above as legRefVsFresh. Adoption never touches a receipt's
 *  visual.ok / matchDeveloped claim — only the scorer may move those. */
if (process.argv.includes('--adopt')) {
  const { copyFileSync } = await import('node:fs');
  for (const r of results) {
    if (r.error) continue;
    const src = path.join(OUT, `${r.stem}.png`);
    const dst = path.join(LANE, 'refs', `${r.stem}.png`);
    if (!existsSync(src)) continue;
    copyFileSync(src, dst);
    const receiptPath = path.join(LANE, 'components', `${r.stem}.json`);
    if (!existsSync(receiptPath)) continue;
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
    receipt.visual = receipt.visual ?? {};
    receipt.visual.reference = `parity/receipts/console-loop/polaris/refs/${r.stem}.png`;
    receipt.visual.referenceSource =
      `examples/polaris/generated/html/${r.stem}.html#first-item — REGENERATED by scripts/polaris-ref-triangle.mts --adopt ` +
      `(current contract, polaris-tokens.css + polaris-minted-tokens.css, real Inter face, scale 1)`;
    writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
    console.log(`  adopted ref for ${r.stem}`);
  }
}
const f = (r: any) => (r?.pctAA === null || r?.pctAA === undefined ? `— ${r?.note ?? 'n/a'}` : `AA ${r.pctAA.toFixed(2)}/ex ${r.pctExact.toFixed(2)}`);
for (const r of results) {
  if (r.error) { console.log(`${r.stem.padEnd(14)} ERROR ${r.error}`); continue; }
  console.log(
    `${r.stem.padEnd(13)} scorecard(shot↔ref) ${f(r.legCommittedShotVsRef).padEnd(22)} shot↔LIVE ${f(r.legCommittedVsLive).padEnd(22)} LIVE↔fresh ${f(r.legLiveVsFresh).padEnd(22)} ref↔fresh ${f(r.legRefVsFresh)}`,
  );
}
