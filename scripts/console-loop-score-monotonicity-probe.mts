/**
 * IS THE SCORER FLATTERED BY A WRONG-SIZED CANVAS? — `npx tsx scripts/console-loop-score-monotonicity-probe.mts`
 *
 * THE ANSWER IS YES, AND THE STATED MECHANISM WAS WRONG.
 *
 * The altitude round recorded that three numbers went UP while three canvases
 * got MORE correct, and attributed it to "the scorer normalises size before
 * comparing, so a wrong-sized canvas is resampled and smoothed". The committed
 * scorecard for the specimen (altitude icon-close) says scaleRatio 1 and
 * sizeNormalized false — so on the CURRENT pair no normalisation runs at all.
 *
 * This scores the same reference against (a) the real, correct 18x18 canvas
 * and (b) a synthetic shrunken canvas standing in for the pre-fix 16x16 one,
 * and reports which the instrument prefers and which branch (if any) fired.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..');
// The scorer is TypeScript loaded through tsx at runtime — same dynamic-import
// convention scripts/console-loop-developed-score.mjs uses, so this probe reads
// the SAME code the board is scored with rather than a copy of it.
const scorer = (await import(
  pathToFileURL(path.join(ROOT, 'extract/figma/canvas-gate/score.ts')).href
)) as {
  alignPair: (a: PNG, b: PNG) => { aPlace?: { content?: { width: number; height: number } }; bPlace?: { content?: { width: number; height: number } } };
  scoreCell: (aligned: unknown, x: unknown[], y: unknown[]) => { pctAAMasked: number | null; inkCanvasPct?: number; inkRealPct?: number };
};
const { alignPair, scoreCell } = scorer;

const REF = path.join(ROOT, 'extract/computed/out/altitude/iconclose/orig-shots/lg__default.png');
const CANVAS = path.join(ROOT, 'parity/receipts/console-loop/altitude/shots/icon-close-cell.png');

const read = (p: string): PNG => PNG.sync.read(readFileSync(p));

/** Nearest-neighbour redraw of `src`'s whole frame at `f`x, on a white page of
 *  the ORIGINAL frame size — i.e. exactly what a canvas that drew the glyph too
 *  small would have exported. */
function shrinkOnWhite(src: PNG, f: number): PNG {
  const out = new PNG({ width: src.width, height: src.height });
  out.data.fill(255);
  const w = Math.max(1, Math.round(src.width * f));
  const h = Math.max(1, Math.round(src.height * f));
  const ox = Math.floor((src.width - w) / 2);
  const oy = Math.floor((src.height - h) / 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.min(src.width - 1, Math.floor(x / f));
      const sy = Math.min(src.height - 1, Math.floor(y / f));
      const si = (sy * src.width + sx) * 4;
      const di = ((y + oy) * out.width + (x + ox)) * 4;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = src.data[si + 3];
    }
  }
  return out;
}

function report(label: string, a: PNG, b: PNG): void {
  const aligned = alignPair(a, b);
  const cell = scoreCell(aligned, [], []);
  const aW = aligned.aPlace?.content?.width ?? a.width;
  const aH = aligned.aPlace?.content?.height ?? a.height;
  const bW = aligned.bPlace?.content?.width ?? b.width;
  const bH = aligned.bPlace?.content?.height ?? b.height;
  const scaleRatio = Math.max(aW / bW, bW / aW, aH / bH, bH / aH);
  const aspectRatio = Math.max((aW / aH) / (bW / bH), (bW / bH) / (aW / aH));
  console.log(
    `${label.padEnd(34)} pctAAMasked=${(cell.pctAAMasked ?? NaN).toFixed(2).padStart(6)}  ` +
      `content ${aW}x${aH} vs ${bW}x${bH}  scaleRatio=${scaleRatio.toFixed(3)}  ` +
      `inkCanvas=${(cell.inkCanvasPct ?? 0).toFixed(2)} inkRef=${(cell.inkRealPct ?? 0).toFixed(2)}  ` +
      `dprBranch=${scaleRatio >= 1.7 && scaleRatio <= 2.4} sizeBranch=${scaleRatio > 1.35 && aspectRatio <= 1.35}`,
  );
}

const ref = read(REF);
console.log(`reference ${REF.replace(ROOT + '/', '')} = ${ref.width}x${ref.height}`);
report('CORRECT canvas (as committed)', read(CANVAS), ref);
for (const f of [0.889, 0.75, 0.5, 0.333]) {
  report(`SHRUNKEN canvas x${f}`, shrinkOnWhite(read(CANVAS), f), ref);
}

// The board-facing invariant this probe exists to keep measurable: the
// byte-correct canvas must score at least as well as any strictly-worse one.
// It DOES NOT HOLD TODAY. Measured on the committed altitude icon-close pair:
// the correct 18x18 canvas scores 19.75 while a 16x16 canvas — objectively
// wrong, and the very defect a previous round fixed — scores 15.12. No
// normalisation branch fires at that size (scaleRatio 1.125 is under the 1.35
// threshold), so the "pre-comparison resampling" story recorded for this
// defect is DEAD; the flattery is in the AA point itself, and this probe does
// not claim to have isolated which term of it.
//
// It costs the board nothing TODAY: swept across all 92 committed scorecards,
// zero of the 28 passing cells is SMALLER than its reference by more than 1px.
// Two are LARGER (carbon tag 46x32 vs 44x32, tailwind alert 128x52 vs 124x52)
// and are named here so they cannot grow silently.

// --- --check: the gating half -----------------------------------------------
// Two assertions, both board-facing:
//   1. THE PINNED COST. Across every committed scorecard, no PASSING cell may
//      be SMALLER than its reference by more than 1px in either axis — that is
//      the direction the flattery rewards, so a pass arriving there is a pass
//      bought with the defect. Cells that are LARGER are listed by name (they
//      are not flattered, but a size disagreement in a pass must stay visible).
//   2. THE MEASUREMENT ITSELF. The probe numbers are pinned, so a change to the
//      AA point that alters them has to be deliberate and re-recorded rather
//      than drifting the evidence out from under the refusal above.
if (process.argv.includes('--check')) {
  const { readdirSync, existsSync } = await import('node:fs');
  const failures: string[] = [];

  const correct = (() => {
    const aligned = alignPair(read(CANVAS), ref);
    return scoreCell(aligned, [], []).pctAAMasked ?? NaN;
  })();
  const shrunk = (() => {
    const aligned = alignPair(shrinkOnWhite(read(CANVAS), 0.889), ref);
    return scoreCell(aligned, [], []).pctAAMasked ?? NaN;
  })();
  const PINNED = { correct: 19.75, shrunk: 15.12 };
  if (Math.abs(correct - PINNED.correct) > 0.01 || Math.abs(shrunk - PINNED.shrunk) > 0.01) {
    failures.push(
      `the monotonicity measurement MOVED: correct=${correct.toFixed(2)} (pinned ${PINNED.correct}), ` +
        `shrunken=${shrunk.toFixed(2)} (pinned ${PINNED.shrunk}) — re-record this probe in the same change that moved the AA point`,
    );
  }

  const laneRoot = path.join(ROOT, 'parity/receipts/console-loop');
  const scoreFiles: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.json') && path.basename(dir) === 'scores') scoreFiles.push(full);
    }
  };
  if (existsSync(laneRoot)) walk(laneRoot);

  const larger: string[] = [];
  let passing = 0;
  for (const f of scoreFiles) {
    const d = JSON.parse(readFileSync(f, 'utf8')) as {
      status?: string;
      metrics?: { canvasPx?: string; realPx?: string };
    };
    if (d.status !== 'pass') continue;
    const cp = d.metrics?.canvasPx;
    const rp = d.metrics?.realPx;
    if (!cp || !rp) continue;
    passing++;
    const [cw, ch] = cp.split('x').map(Number);
    const [rw, rh] = rp.split('x').map(Number);
    const rel = path.relative(ROOT, f);
    if (cw < rw - 1 || ch < rh - 1)
      failures.push(
        `${rel}: a PASSING cell is SMALLER than its reference (${cp} vs ${rp}) — that is the direction the AA point rewards, so this pass may be bought with the defect above`,
      );
    else if (cw > rw + 1 || ch > rh + 1) larger.push(`${rel} (${cp} vs ${rp})`);
  }

  const NAMED_LARGER = [
    'parity/receipts/console-loop/carbon/scores/tag.json (46x32 vs 44x32)',
    'parity/receipts/console-loop/tailwind/scores/alert.json (128x52 vs 124x52)',
  ];
  const unexpected = larger.filter((l) => !NAMED_LARGER.includes(l));
  if (unexpected.length > 0)
    failures.push(
      `a PASSING cell disagrees with its reference on size and is not named: ${unexpected.join(', ')} — ` +
        'add it here with the measurement, or fix the size',
    );

  if (failures.length > 0) {
    console.error(`✘ console-loop-score-monotonicity: ${failures.length} failure(s)`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(
    `console-loop-score-monotonicity: the AA point PREFERS a 16x16 canvas (${shrunk.toFixed(2)}) over the byte-correct 18x18 one ` +
      `(${correct.toFixed(2)}) and no normalisation branch fires — the defect is pinned, not fixed. ` +
      `Cost to the board today: 0 of ${passing} passing cell(s) is smaller than its reference; ` +
      `${larger.length} named larger (${NAMED_LARGER.length} expected).`,
  );
}
