/** SVG AUTHORED-VIEWBOX PROBE — is the reconstructed user space the package's?
 *
 *  `extract/computed/anatomy.ts::reconstructSvg` cannot read a viewBox: the
 *  attribute is not a computed style. It reconstructs `0 0 W W` from the svg's
 *  COMPUTED SIZE, then round 5c's unification pass groups captures with
 *  IDENTICAL path data and lets the BUMPED members adopt
 *
 *      cand = Math.max(...anchors.map((g) => g.r.vb))          // anatomy.ts
 *
 *  where `anchors` are the members whose computed box already bounded the path
 *  extent. The receipt it writes calls that "the package's own viewBox".
 *
 *  For a one-glyph-many-sizes icon that claim is BACKWARDS, and altitude's
 *  IconClose is the counter-example sitting in the tree:
 *
 *    · every size draws the SAME path, extent 2.4 … 17.6 (15.2 user units)
 *    · unset/xs/sm computed 16/8/12 < 17.6 → bumped to 18, then unified to 40
 *    · md/lg/xl/xxl/xxxl are unbumped and keep their OWN computed size
 *      (20/24/32/36/40) as the viewBox — only md is right
 *    · altitude-web-components' own dist/icons/close.svg is `0 0 20 20`
 *
 *  The authored space is a SINGLE number V with V >= extent. Every rendered
 *  size is an upper bound candidate; the MINIMUM unbumped computed size is the
 *  tightest one, and all members — bumped or not — must adopt it. Taking the
 *  max instead scales the glyph down by V_authored / V_max: at `unset` the
 *  close icon draws 6px of ink in a 16px box where the library draws 12.
 *
 *  This probe is DIAGNOSTIC. It writes nothing, changes nothing, and states
 *  the prediction as a falsifiable number: ink = round(cssSize * extent / vb)
 *  for each size, against the ink measured in the committed LIBRARY render
 *  (`orig-shots/<key>__default.png`). If the min rule is right the predicted
 *  column matches the library column; if the max rule were right it would not.
 *
 *    npx tsx scripts/altitude-svg-viewbox-probe.mts
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { PNG } = await import(`${ROOT}/node_modules/pngjs/lib/png.js`);

const COMP = path.join(ROOT, 'extract/computed/out/altitude/iconclose');
const PKG_ICON = path.join(
  ROOT,
  'examples/altitude/.altitude-sandbox/node_modules/altitude-web-components/dist/icons/close.svg',
);

/** Tight ink box of a render, background = the pixel at (0,0). */
function inkBox(file: string): { w: number; h: number } | null {
  const g = PNG.sync.read(readFileSync(file));
  const bg = [g.data[0], g.data[1], g.data[2]];
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      const i = (g.width * y + x) << 2;
      if (g.data[i + 3] < 8) continue;
      if (
        Math.abs(g.data[i] - bg[0]) < 6 &&
        Math.abs(g.data[i + 1] - bg[1]) < 6 &&
        Math.abs(g.data[i + 2] - bg[2]) < 6
      ) continue;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Coordinate extent of an svg's path data (the same quantity anatomy.ts
 *  computes as `maxCoord`), plus the min so the drawn span is exact. */
function pathExtent(markup: string): { min: number; max: number } {
  const nums = (markup.match(/ d="([^"]*)"/g) ?? [])
    .join(' ')
    .match(/-?\d+(?:\.\d+)?/g);
  if (!nums) return { min: 0, max: 0 };
  const v = nums.map(Number);
  return { min: Math.min(...v), max: Math.max(...v) };
}

const vbOf = (m: string) => {
  const g = /viewBox="0 0 ([\d.]+) [\d.]+"/.exec(m);
  return g ? Number(g[1]) : NaN;
};

/** The contract's CSS size per asset — the minted width channel. */
const MINTED = JSON.parse(
  readFileSync(path.join(ROOT, 'examples/altitude/tokens/altitude-minted.dtcg.json'), 'utf8'),
);
function mintedWidth(size: string): number {
  const leaf = MINTED?.imported?.['icon-close']?.root?.width?.[size];
  return leaf ? Number.parseFloat(String(leaf.$value)) : NaN;
}

const pkg = existsSync(PKG_ICON) ? readFileSync(PKG_ICON, 'utf8') : null;
const pkgVb = pkg ? Number(/viewBox="0 0 ([\d.]+)/.exec(pkg)?.[1] ?? NaN) : NaN;

const assets = readdirSync(path.join(COMP, 'assets')).filter((f) => f.endsWith('.svg')).sort();
const rows: Array<Record<string, unknown>> = [];
let span = 0;
for (const f of assets) {
  const size = f.replace(/^icon-close-root-|\.svg$/g, '');
  const markup = readFileSync(path.join(COMP, 'assets', f), 'utf8');
  const ext = pathExtent(markup);
  span = ext.max - ext.min;
  const css = mintedWidth(size);
  const committedVb = vbOf(markup);
  const lib = inkBox(path.join(COMP, 'orig-shots', `${size}__default.png`));
  rows.push({
    size,
    cssPx: css,
    committedVb,
    committedInkPredicted: Math.round((css * span) / committedVb),
    authoredVb: pkgVb,
    authoredInkPredicted: Math.round((css * span) / pkgVb),
    libraryInk: lib ? lib.w : null,
  });
}

console.log(`package authored viewBox : 0 0 ${pkgVb} ${pkgVb}   (${path.relative(ROOT, PKG_ICON)})`);
console.log(`path coordinate span     : ${span.toFixed(1)} user units\n`);
console.log(
  'size    cssPx  committedVb  ink@committed  authoredVb  ink@authored  libraryInk  verdict',
);
let authoredHits = 0;
let committedHits = 0;
for (const r of rows) {
  const okA = r.authoredInkPredicted === r.libraryInk;
  const okC = r.committedInkPredicted === r.libraryInk;
  if (okA) authoredHits++;
  if (okC) committedHits++;
  console.log(
    `${String(r.size).padEnd(7)}${String(r.cssPx).padStart(5)}${String(r.committedVb).padStart(13)}` +
      `${String(r.committedInkPredicted).padStart(15)}${String(r.authoredVb).padStart(12)}` +
      `${String(r.authoredInkPredicted).padStart(14)}${String(r.libraryInk).padStart(12)}   ` +
      `${okA ? 'authored MATCHES' : 'authored misses'}${okC ? ' / committed matches' : ' / committed MISSES'}`,
  );
}
console.log(
  `\nauthored viewBox reproduces the library ink in ${authoredHits}/${rows.length} sizes; ` +
    `the committed per-size viewBoxes reproduce it in ${committedHits}/${rows.length}.`,
);
console.log(
  'FIX (out of this round\'s territory — extract/computed/anatomy.ts, round 5c unification):\n' +
    '  cand = Math.min(...anchors.map((g) => g.r.vb))   // tightest bound, not the loosest\n' +
    '  and let EVERY member of the group adopt cand (today only `bumped` members do,\n' +
    '  so the unbumped captures keep their own computed size as a viewBox).\n' +
    '  Landing it requires re-running extract/computed for every lane, so it is named here\n' +
    '  rather than taken: only altitude currently emits svg-viewbox-unified receipts\n' +
    '  (6 of them, all IconClose) — mui/carbon/astryx emit svg-viewbox-bumped with no\n' +
    '  multi-member group, polaris/tailwind emit neither.',
);
