/**
 * WHAT THE WHITE TRIM THROWS AWAY — `npx tsx scripts/console-loop-white-trim-reach-probe.mts [--check]`
 *
 * THE DEFECT, already named for ONE stem and never generalised. Before scoring,
 * both images are cropped to their "content box": the bounding box of pixels
 * whose alpha exceeds 16 AND at least one channel is under 250. Anything
 * lighter than 250 on every channel is treated as page background and cropped
 * away. A component whose design IS a light surface — a pale pill, a tinted
 * banner, a hairline border, a subtle fill — has that surface classified as
 * background, and the pixel bar then measures whatever ink survives.
 *
 * The first-party `token` receipt says so in its own words: the trim "reduces
 * BOTH images to the bare 26x10 glyph run ('Token') because pill background and
 * border are lighter than the 250 trim threshold", so its 11.15 is rasteriser
 * AA over a four-letter word while pill size, radius, padding and fills are not
 * measured at all. That was recorded as one stem's FC note. This probe asks how
 * far it reaches.
 *
 * THE TEST IS `discarded !== blank`. Cropping is only free when the region
 * removed is genuinely empty. For every committed pair this measures the
 * fraction of the frame the trim removes AND how many NON-WHITE pixels sit
 * inside the removed region — pixels that carry paint the score never sees.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const WHITE_TRIM = 250; // must track extract's contentBoxOf / developed-score

type Box = { x: number; y: number; width: number; height: number };

/** The scorer's own rule, restated here so a change there shows up as a diff. */
function contentBoxOf(png: PNG): Box {
  let minX = png.width, minY = png.height, maxX = -1, maxY = -1;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4;
      const ink =
        png.data[i + 3] > 16 &&
        (png.data[i] < WHITE_TRIM || png.data[i + 1] < WHITE_TRIM || png.data[i + 2] < WHITE_TRIM);
      if (ink) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, width: png.width, height: png.height };
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Paint OUTSIDE the content box, composited over the white page the capture
 *  harness uses, and graded by how far off white it lands.
 *
 *  THE FIRST DRAFT OF THIS PROBE WAS WRONG and it is worth keeping the reason.
 *  It counted any pixel that was not exactly opaque white, which made two
 *  PASSING cells look like they had been scored on a mutilated crop: mui's
 *  accordion "discarded 1336px" and polaris's banner "1206px". Reading the
 *  actual samples killed it — the accordion's ring is rgba(254,254,254,255)
 *  and the canvas side's edge pixels are rgba(0,0,0,ALPHA 1), i.e. one level
 *  off white and effectively invisible. Both are the outer falloff of a drop
 *  shadow whose visible part sits INSIDE the box. A test that cannot tell a
 *  shadow's tail from a discarded component is not measuring the defect.
 *
 *  So paint is graded: `faint` is any deviation at all, `visible` is a
 *  deviation of at least 8 levels on some channel — the point where the crop
 *  is dropping something a person could see. Only `visible` gates. */
function paintOutsideBox(png: PNG, box: Box): { outside: number; faint: number; visible: number } {
  let outside = 0, faint = 0, visible = 0;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      if (x >= box.x && x < box.x + box.width && y >= box.y && y < box.y + box.height) continue;
      outside++;
      const i = (y * png.width + x) * 4;
      const a = png.data[i + 3] / 255;
      // Composite over the harness's white page.
      const r = png.data[i] * a + 255 * (1 - a);
      const g = png.data[i + 1] * a + 255 * (1 - a);
      const b = png.data[i + 2] * a + 255 * (1 - a);
      const dev = Math.max(255 - r, 255 - g, 255 - b);
      if (dev >= 0.5) faint++;
      if (dev >= 8) visible++;
    }
  }
  return { outside, faint, visible };
}

type Row = {
  lane: string;
  stem: string;
  status: string;
  side: 'canvas' | 'reference';
  file: string;
  frame: string;
  box: string;
  keptPct: number;
  discardedFaint: number;
  discardedVisible: number;
};

const rows: Row[] = [];
const CL = path.join(ROOT, 'parity/receipts/console-loop');

function scoreFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) scoreFiles(full, out);
    else if (e.name.endsWith('.json') && path.basename(dir) === 'scores') out.push(full);
  }
  return out;
}

for (const f of scoreFiles(CL).sort()) {
  const d = JSON.parse(readFileSync(f, 'utf8')) as {
    status?: string;
    reference?: string;
    canvasShot?: string;
  };
  const lane = path.relative(CL, path.dirname(path.dirname(f))) || 'first-party';
  const stem = path.basename(f, '.json');
  for (const [side, rel] of [
    ['canvas', d.canvasShot],
    ['reference', d.reference],
  ] as const) {
    if (!rel) continue;
    const abs = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
    if (!existsSync(abs)) continue;
    let png: PNG;
    try { png = PNG.sync.read(readFileSync(abs)); } catch { continue; }
    const box = contentBoxOf(png);
    const { faint, visible } = paintOutsideBox(png, box);
    rows.push({
      lane,
      stem,
      status: d.status ?? '?',
      side,
      file: path.relative(ROOT, abs),
      frame: `${png.width}x${png.height}`,
      box: `${box.width}x${box.height}`,
      keptPct: (100 * box.width * box.height) / (png.width * png.height),
      discardedFaint: faint,
      discardedVisible: visible,
    });
  }
}

const lossy = rows.filter((r) => r.discardedVisible > 0).sort((a, b) => b.discardedVisible - a.discardedVisible);

if (!process.argv.includes('--check')) {
  console.log(`inspected ${rows.length} image(s) across ${new Set(rows.map((r) => `${r.lane}/${r.stem}`)).size} scored cell(s)`);
  console.log(`images whose crop discards VISIBLE paint: ${lossy.length}\n`);
  for (const r of lossy.slice(0, 40)) {
    console.log(
      `${(r.lane + '/' + r.stem).padEnd(26)} ${r.side.padEnd(9)} ${r.status.padEnd(4)} ` +
        `frame ${r.frame.padEnd(9)} box ${r.box.padEnd(9)} kept ${r.keptPct.toFixed(1).padStart(5)}%  ` +
        `discarded VISIBLE ${String(r.discardedVisible).padStart(6)}px (faint ${String(r.discardedFaint).padStart(6)})  ${r.file}`,
    );
  }
}

// --- --check ---------------------------------------------------------------
// The board-facing refusal: a cell may not PASS while the crop that produced its
// number threw away painted pixels, because those pixels are design surface the
// pixel bar never compared. Named exceptions carry the measurement.
if (process.argv.includes('--check')) {
  const NAMED: Record<string, string> = {
    // MEASURED 2026-08-09. The only passing cell whose crop drops visible paint.
    // Both sides agree on a 290x50 content box — the accordion header, scored
    // whole — and what falls outside on the CANVAS side is the 2px bleed of the
    // Figma drop shadow, 282 pixels at 8+ levels off white. The reference's own
    // shadow tail is discarded too but sits almost entirely under 8 levels, so
    // the two sides are not losing the same thing. That shadow is MUI's
    // `elevation` axis, i.e. the axis this variant is named for, and it is
    // partly outside the compared region on one side only. Carried rather than
    // fixed: the repair is a shadow-aware content box, which re-crops and
    // re-scores all 92 cells. Pinned at 282 so it cannot grow silently.
    'mui/accordion[canvas] discards 282px of VISIBLE paint (frame 294x54 → box 290x50)':
      'FC-TRIM-DROPS-SHADOW — elevation bleed, both boxes 290x50, pinned',
  };
  const offenders = lossy
    .filter((r) => r.status === 'pass')
    .map((r) => `${r.lane}/${r.stem}[${r.side}] discards ${r.discardedVisible}px of VISIBLE paint (frame ${r.frame} → box ${r.box})`)
    .filter((k) => !(k in NAMED));
  if (offenders.length > 0) {
    console.error(`✘ console-loop-white-trim-reach: ${offenders.length} passing cell(s) scored on a crop that discarded VISIBLE paint`);
    for (const o of offenders) console.error(`  - ${o}`);
    process.exit(1);
  }
  console.log(
    `console-loop-white-trim-reach: ${rows.length} image(s) across ${new Set(rows.map((r) => `${r.lane}/${r.stem}`)).size} scored cell(s); ` +
      `${lossy.length} crop(s) discard VISIBLE paint, NONE of them under a passing cell.`,
  );
}
