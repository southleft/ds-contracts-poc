/**
 * ALPHA-COMPOSITE PROBE — the scorer must encode translucency the same way on
 * both sides before it crops to ink.
 *
 * THE DEFECT THIS PINS. A canvas export is a TRANSPARENT-backed PNG: a
 * `rgba(0,0,0,0.06)` surface arrives as `(0,0,0,15)`. A library reference is
 * rendered over the page and arrives OPAQUE: the same fact is `rgb(240)`. The
 * ink test used to read RAW bytes — `alpha > 16 && any channel < WHITE_TRIM`.
 * On the canvas side alpha 15 is not > 16, so the surface is NOT ink and the
 * content box collapses to the label alone; on the reference side 240 < 250, so
 * the surface IS ink and the box is the whole cell. One identical design fact,
 * two different crops, and every downstream number (scaleRatio, the DPR
 * downscale window, inkDelta, pctAAMasked) is then computed across two
 * different regions. That is an INSTRUMENT artifact, not a contract defect —
 * see parity/receipts/console-loop/CONTINUE.md, polaris/badge.
 *
 * THE FIX THIS VERIFIES. Both sides are composited over an opaque white
 * substrate BEFORE any ink crop, so the ink test always runs on what a viewer
 * would actually see. `compositeOverWhite` (extract/figma/canvas-gate/score.ts)
 * is idempotent on already-opaque images, so the reference side is untouched.
 *
 * BOTH DIRECTIONS ARE RED-TESTED, because a fix that only makes things pass is
 * indistinguishable from deleting the bar:
 *   A. SAME FACT, TWO ENCODINGS  → must agree (box + score under the bar).
 *   B. DIFFERENT FACT, SAME ENCODING → must still FAIL (0.06 vs 0.30 alpha is a
 *      real paint difference and compositing must not launder it).
 *   C. THE LEGACY RULE           → recomputed in-probe and asserted to STILL
 *      collapse, so the defect stays named and cannot silently return.
 *
 * Usage: tsx scripts/console-loop-alpha-composite-probe.mts --check
 */
import { PNG } from 'pngjs';
import { alignPair, scoreCell, compositeOverWhite } from '../extract/figma/canvas-gate/score.js';
// @ts-expect-error TS7016 — score-policy is a frozen .mjs duplicate of developed-score; no types shipped
import { scoreStemPair } from '../extract/figma/visual-truth/score-policy.mjs';

const CELL_W = 61;
const CELL_H = 20;
const LABEL_W = 43;
const LABEL_H = 11;
const LABEL_RGB = 48; // #303030 — the polaris badge label colour
const STAGE_PAD = 8;

type Px = [number, number, number, number];

/**
 * One 61x20 badge on a stage. `surfaceAlpha` is the badge background's alpha
 * (the design fact). `opaque` picks the ENCODING: false = transparent-backed
 * canvas export (straight alpha), true = the same thing already composited
 * over white the way a library render arrives.
 */
function badge(surfaceAlpha: number, opaque: boolean): PNG {
  const w = CELL_W + STAGE_PAD * 2;
  const h = CELL_H + STAGE_PAD * 2;
  const png = new PNG({ width: w, height: h });
  const put = (x: number, y: number, [r, g, b, a]: Px) => {
    const i = (y * w + x) * 4;
    png.data[i] = r;
    png.data[i + 1] = g;
    png.data[i + 2] = b;
    png.data[i + 3] = a;
  };
  const over = (v: number, a: number) => Math.round(v * a + 255 * (1 - a));
  const lx = STAGE_PAD + Math.floor((CELL_W - LABEL_W) / 2);
  const ly = STAGE_PAD + Math.floor((CELL_H - LABEL_H) / 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inCell =
        x >= STAGE_PAD && x < STAGE_PAD + CELL_W && y >= STAGE_PAD && y < STAGE_PAD + CELL_H;
      const inLabel = x >= lx && x < lx + LABEL_W && y >= ly && y < ly + LABEL_H;
      // Stripe the label so it is a glyph run, not a solid block — a solid
      // label would let a pure-geometry match hide a paint difference.
      const glyph = inLabel && (x - lx) % 3 !== 2;
      if (glyph) put(x, y, [LABEL_RGB, LABEL_RGB, LABEL_RGB, 255]);
      else if (inCell) {
        put(
          x,
          y,
          opaque
            ? [over(0, surfaceAlpha), over(0, surfaceAlpha), over(0, surfaceAlpha), 255]
            : [0, 0, 0, Math.round(surfaceAlpha * 255)],
        );
      } else put(x, y, opaque ? [255, 255, 255, 255] : [0, 0, 0, 0]);
    }
  }
  return png;
}

const WHITE_TRIM = 250;

/** The rule as it stood before the fix: RAW bytes, alpha as a visibility gate. */
function legacyContentBox(png: PNG) {
  let minX = png.width,
    minY = png.height,
    maxX = -1,
    maxY = -1;
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
  if (maxX < 0) return { width: png.width, height: png.height };
  return { width: maxX - minX + 1, height: maxY - minY + 1 };
}

const failures: string[] = [];
const fail = (m: string) => failures.push(m);
const box = (b: { width: number; height: number }) => `${b.width}x${b.height}`;

const ALPHA = 0.06; // rgba(0,0,0,0.06) — the measured polaris badge background

const canvasSide = badge(ALPHA, false); // transparent-backed export
const refSide = badge(ALPHA, true); // composited-over-white reference

console.log('ALPHA-COMPOSITE PROBE — one design fact, two encodings');
console.log(
  `  fact: rgba(0,0,0,${ALPHA}) surface on a ${CELL_W}x${CELL_H} cell, ${LABEL_W}x${LABEL_H} label rgb(${LABEL_RGB})`,
);

// ---------------------------------------------------------------------------
// C. THE LEGACY RULE MUST STILL COLLAPSE — the defect stays named.
// ---------------------------------------------------------------------------
const legacyCanvas = legacyContentBox(canvasSide);
const legacyRef = legacyContentBox(refSide);
console.log(`\nC. legacy raw-byte ink rule (the defect):`);
console.log(`     canvas ${box(legacyCanvas)}   reference ${box(legacyRef)}`);
if (legacyCanvas.width !== LABEL_W || legacyCanvas.height !== LABEL_H)
  fail(
    `legacy rule no longer collapses the canvas box to the label — got ${box(legacyCanvas)}, expected ${LABEL_W}x${LABEL_H}. Re-derive this probe rather than deleting it.`,
  );
if (legacyRef.width !== CELL_W || legacyRef.height !== CELL_H)
  fail(`legacy rule on the opaque reference should see the whole cell — got ${box(legacyRef)}`);
if (legacyCanvas.width === legacyRef.width && legacyCanvas.height === legacyRef.height)
  fail('legacy rule agreed on both sides — this probe would prove nothing');
console.log(
  `     → the same fact is ink on one side and trimmed on the other (ink-box collapse REPRODUCED)`,
);

// ---------------------------------------------------------------------------
// A. SAME FACT, TWO ENCODINGS — must agree after compositing.
// ---------------------------------------------------------------------------
const fixedCanvas = legacyContentBox(compositeOverWhite(canvasSide));
const fixedRef = legacyContentBox(compositeOverWhite(refSide));
console.log(`\nA. composited-over-white ink rule (the fix):`);
console.log(`     canvas ${box(fixedCanvas)}   reference ${box(fixedRef)}`);
if (fixedCanvas.width !== fixedRef.width || fixedCanvas.height !== fixedRef.height)
  fail(`compositing did not make the two encodings agree: ${box(fixedCanvas)} vs ${box(fixedRef)}`);
if (fixedCanvas.width !== CELL_W || fixedCanvas.height !== CELL_H)
  fail(`composited canvas box should be the whole cell — got ${box(fixedCanvas)}`);

const same = scoreStemPair(canvasSide, refSide, { alignPair, scoreCell });
console.log(
  `     scoreStemPair: pctAAMasked=${Number(same.aaMasked).toFixed(2)}% scaleRatio=${same.scaleRatio.toFixed(2)} inkDelta=${same.inkDelta.toFixed(2)} compositionOk=${same.compositionOk} pass=${same.pass}`,
);
if (!same.pass)
  fail(
    `same fact in two encodings must score as matching — pctAAMasked=${same.aaMasked}, compositionOk=${same.compositionOk}`,
  );
if (same.scaleRatio !== 1)
  fail(`same fact must align 1:1 after compositing — scaleRatio=${same.scaleRatio}`);

// ---------------------------------------------------------------------------
// B. DIFFERENT FACT, SAME ENCODING — must STILL fail.
// ---------------------------------------------------------------------------
const heavier = badge(0.3, true); // rgb(179) surface — a real paint difference
const diff = scoreStemPair(canvasSide, heavier, { alignPair, scoreCell });
console.log(`\nB. different fact (alpha 0.06 vs 0.30), both composited:`);
console.log(
  `     scoreStemPair: pctAAMasked=${Number(diff.aaMasked).toFixed(2)}% compositionOk=${diff.compositionOk} pass=${diff.pass}`,
);
if (diff.pass)
  fail(
    'a 0.06-vs-0.30 surface difference PASSED — compositing must not launder a real paint difference',
  );

// ---------------------------------------------------------------------------
if (failures.length) {
  console.error(`\n✖ alpha-composite probe: ${failures.length} failure(s)`);
  for (const f of failures) console.error(`   · ${f}`);
  process.exit(1);
}
console.log(
  `\n✔ alpha-composite probe: both encodings agree after compositing, a real paint difference still fails, and the legacy ink-box collapse is pinned`,
);
process.exit(0);
