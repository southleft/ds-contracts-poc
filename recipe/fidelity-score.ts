/**
 * RECIPE FIDELITY SCORE — does the minted Figma component look like the real
 * library component?
 *
 * The recipe path has never answered that question with a number. Its gates
 * measure accounting (is every fact carried, named or receipted) and usability
 * (is every cell inside its box, correctly roled, non-overlapping). A mint can
 * pass all of them and still not look like the library it claims to describe —
 * which is exactly the doubt the owner raised after eyeballing three libraries'
 * checkboxes and finding them near-identical.
 *
 * This scores a Figma export against the REAL library's own Chromium render,
 * reusing the canvas-gate scorer that already backs the console-loop lane
 * (extract/figma/canvas-gate/score.ts): composite both sides over white, trim
 * to content box, pad to a common union, then pixelmatch with AA tolerance.
 *
 * Two things it deliberately does NOT do:
 *
 *   - It does not invent a grade. It emits a number and a bar; a human still
 *     decides what an acceptable number is for a given archetype.
 *   - It does not fetch from Figma. Export the node with the Figma Console MCP
 *     and pass the PNG path. Keeping the network out means the score is
 *     reproducible from committed bytes.
 *
 * The reference MUST be the real package's render — `orig-shots/` from
 * extract/computed, never a gate-shot (the pipeline's own re-render) and never
 * another mint. Comparing a mint to a mint measures nothing.
 *
 *   npx tsx recipe/fidelity-score.ts \
 *     --canvas    shots/astryx-checkbox.png \
 *     --reference extract/computed/out/astryx-core/checkboxinput/orig-shots/unchecked.md.no-isDisabled__default.png \
 *     --label     checkbox/astryx \
 *     --out       recipe/evidence/fidelity-v1/checkbox-astryx.json
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { PNG } from "pngjs";

import { alignPair, readPngBuffer, scoreCell } from "../extract/figma/canvas-gate/score.js";

/** The console-loop bar, reused so two lanes cannot drift apart. */
export const FIDELITY_BAR = { pctAAMaskedMax: 5 } as const;

export interface FidelityScorecard {
  artifactVersion: "recipe-fidelity-v1";
  label: string;
  status: "pass" | "fail";
  bar: typeof FIDELITY_BAR;
  metrics: {
    pctExactUnmasked: number;
    pctAAUnmasked: number;
    pctAAMasked: number | null;
    canvasPx: string;
    realPx: string;
    inkCanvasPct: number;
    inkRealPct: number;
  };
  canvas: { path: string; sha256: string };
  reference: { path: string; sha256: string };
  diff: string;
  /** True when the reference was cropped to the leading control (label dropped). */
  referenceCroppedToControl: boolean;
  /** True when the canvas export was cropped the same way. */
  canvasCroppedToControl: boolean;
  /**
   * Ink box at tightening thresholds. If the two sides AGREE as the threshold
   * tightens, the failure is anti-aliasing fringe, not geometry.
   */
  thresholdSweep: Array<{ threshold: number; canvas: string; reference: string; agree: boolean }>;
  /** Why a reader should not over-read this number. */
  caveats: string[];
}

const sha256 = (buf: Buffer): string =>
  createHash("sha256").update(buf).digest("hex");

const arg = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? (process.argv[i + 1] ?? null) : null;
};

const NEAR_WHITE = 250;

/**
 * Crop a labelled control's reference render down to the CONTROL, dropping the
 * text label.
 *
 * Why this exists. Figma and Chromium rasterize text with different hinting and
 * subpixel rules, so a labelled component's diff is dominated by glyph edges
 * rather than by anything the recipe decided. Scoring "Accept terms" measures
 * two renderers, not two designs. The console-loop lane already scores the
 * control alone — its MUI checkbox scorecard is an 18x18 cell — and this makes
 * that convention explicit and reusable instead of implicit in how a shot was
 * cropped by hand.
 *
 * The rule is deterministic: take the ink bounding box, then walk right from
 * its left edge and stop at the first run of `gapPx` fully-blank columns. For a
 * leading control followed by a gap and a label, that is the control. If there
 * is no such gap the image is returned unchanged, so an unlabelled component is
 * never silently cropped.
 */
export function cropLeadingControl(src: PNG, gapPx = 6): PNG {
  const colHasInk = (x: number): boolean => {
    for (let y = 0; y < src.height; y++) {
      const i = (y * src.width + x) * 4;
      const a = src.data[i + 3]! / 255;
      const r = src.data[i]! * a + 255 * (1 - a);
      const g = src.data[i + 1]! * a + 255 * (1 - a);
      const b = src.data[i + 2]! * a + 255 * (1 - a);
      if (r < NEAR_WHITE || g < NEAR_WHITE || b < NEAR_WHITE) return true;
    }
    return false;
  };

  let left = -1;
  for (let x = 0; x < src.width; x++) {
    if (colHasInk(x)) { left = x; break; }
  }
  if (left < 0) return src;

  let right = src.width - 1;
  let blank = 0;
  for (let x = left; x < src.width; x++) {
    if (colHasInk(x)) blank = 0;
    else if (++blank >= gapPx) { right = x - blank; break; }
  }
  if (right >= src.width - 1) return src; // no gap found — not a labelled control

  const width = right - left + 1;
  const out = new PNG({ width, height: src.height });
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < width; x++) {
      const si = (y * src.width + (left + x)) * 4;
      const di = (y * width + x) * 4;
      out.data[di] = src.data[si]!;
      out.data[di + 1] = src.data[si + 1]!;
      out.data[di + 2] = src.data[si + 2]!;
      out.data[di + 3] = src.data[si + 3]!;
    }
  }
  return out;
}


/**
 * Crop to an explicit box. Some controls are not visually contiguous — MUI's
 * unchecked Switch is a thumb at the left of a wider track, so the
 * whitespace-gap rule in cropLeadingControl splits it and measures the thumb
 * alone. Where the control's bounds are known from the scene rather than
 * guessable from ink, pass them instead of tuning the heuristic per subject.
 */
export function cropBox(src: PNG, x: number, y: number, w: number, h: number): PNG {
  const width = Math.min(w, src.width - x);
  const height = Math.min(h, src.height - y);
  if (width <= 0 || height <= 0) throw new Error(`crop box outside image: ${x},${y},${w},${h}`);
  const out = new PNG({ width, height });
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const si = ((y + row) * src.width + (x + col)) * 4;
      const di = (row * width + col) * 4;
      out.data[di] = src.data[si]!;
      out.data[di + 1] = src.data[si + 1]!;
      out.data[di + 2] = src.data[si + 2]!;
      out.data[di + 3] = src.data[si + 3]!;
    }
  }
  return out;
}


/**
 * Ink bounding box at a given near-white threshold.
 *
 * The scorer trims to content at 250/255, and that choice is load-bearing in a
 * way it does not look. Chromium's renders carry anti-aliasing fringe rows in
 * the 241-248 band that Figma's exports do not produce, so a reference can trim
 * two pixels taller than an identical canvas and the union pad then misaligns
 * the whole comparison. That manufactured a "2px defect" in switch/antd which
 * did not exist: at 240 or stricter both sides measure 44x22 exactly.
 *
 * So every scorecard now carries the sweep. A failure whose box CONVERGES as the
 * threshold tightens is the instrument; one that stays apart is the design.
 */
const inkBox = (png: PNG, threshold: number): string => {
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4;
      const a = png.data[i + 3]! / 255;
      const r = png.data[i]! * a + 255 * (1 - a);
      const g = png.data[i + 1]! * a + 255 * (1 - a);
      const b = png.data[i + 2]! * a + 255 * (1 - a);
      if (r < threshold || g < threshold || b < threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? "empty" : `${maxX - minX + 1}x${maxY - minY + 1}`;
};

export function scoreFidelity(
  canvasPath: string,
  referencePath: string,
  label: string,
  diffPath: string,
  cropReferenceControl = false,
  cropCanvasControl = false,
  canvasBox: [number, number, number, number] | null = null,
): FidelityScorecard {
  if (/gate-shots/.test(referencePath)) {
    throw new Error(
      `reference must be the real library render (orig-shots), not the pipeline's own re-render: ${referencePath}`,
    );
  }
  const canvasBuf = readFileSync(canvasPath);
  const refBuf = readFileSync(referencePath);
  const refPng = readPngBuffer(refBuf);
  const canvasRaw = readPngBuffer(canvasBuf);
  const canvasPng = canvasBox ? cropBox(canvasRaw, ...canvasBox) : canvasRaw;
  const aligned = alignPair(
    cropCanvasControl ? cropLeadingControl(canvasPng) : canvasPng,
    cropReferenceControl ? cropLeadingControl(refPng) : refPng,
  );
  const score = scoreCell(aligned, [], []);

  mkdirSync(path.dirname(diffPath), { recursive: true });
  writeFileSync(diffPath, PNG.sync.write(score.diff as unknown as PNG));

  const masked = score.pctAAMasked ?? score.pctAAUnmasked;
  const canvasForSweep = cropCanvasControl ? cropLeadingControl(canvasPng) : canvasPng;
  const refForSweep = cropReferenceControl ? cropLeadingControl(refPng) : refPng;
  const thresholdSweep = [250, 245, 240, 230].map((t) => ({
    threshold: t,
    canvas: inkBox(canvasForSweep, t),
    reference: inkBox(refForSweep, t),
    agree: inkBox(canvasForSweep, t) === inkBox(refForSweep, t),
  }));
  return {
    artifactVersion: "recipe-fidelity-v1",
    label,
    status: masked <= FIDELITY_BAR.pctAAMaskedMax ? "pass" : "fail",
    bar: FIDELITY_BAR,
    metrics: {
      pctExactUnmasked: score.pctExactUnmasked,
      pctAAUnmasked: score.pctAAUnmasked,
      pctAAMasked: score.pctAAMasked,
      canvasPx: score.canvasPx,
      realPx: score.realPx,
      inkCanvasPct: score.inkCanvasPct,
      inkRealPct: score.inkRealPct,
    },
    canvas: { path: canvasPath, sha256: sha256(canvasBuf) },
    reference: { path: referencePath, sha256: sha256(refBuf) },
    diff: diffPath,
    referenceCroppedToControl: cropReferenceControl,
    canvasCroppedToControl: cropCanvasControl,
    thresholdSweep,
    caveats: [
      "One state of one component. A pass here is not a pass for the archetype.",
      "A near-blank canvas side scores a deceptively low diff — read inkCanvasPct and inkRealPct beside every number.",
      "The reference is one MOUNT of the library. Astryx renders differently under @astryxdesign/core alone than under <Theme theme={neutralTheme}>; score against the mount the fixture actually transcribes.",
      "This measures appearance only. It says nothing about token binding, variant axes or usability, which the recipe gates cover.",
    ],
  };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const canvas = arg("canvas");
  const reference = arg("reference");
  const label = arg("label") ?? "unlabelled";
  const out = arg("out");
  if (!canvas || !reference || !out) {
    throw new Error("usage: --canvas <png> --reference <png> --label <name> --out <json>");
  }
  for (const p of [canvas, reference]) {
    if (!existsSync(p)) throw new Error(`missing: ${p}`);
  }
  const card = scoreFidelity(
    canvas,
    reference,
    label,
    out.replace(/\.json$/, ".diff.png"),
    process.argv.includes("--reference-control-only"),
    process.argv.includes("--canvas-control-only"),
    (() => {
      const raw = arg("canvas-box");
      if (!raw) return null;
      const n = raw.split(",").map(Number);
      if (n.length !== 4 || n.some(Number.isNaN)) throw new Error("--canvas-box wants x,y,w,h");
      return [n[0]!, n[1]!, n[2]!, n[3]!] as [number, number, number, number];
    })(),
  );
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(card, null, 2)}\n`);
  const m = card.metrics;
  const converges = card.thresholdSweep.some((r) => r.agree);
  if (card.status === "fail" && converges) {
    const at = card.thresholdSweep.find((r) => r.agree)!;
    console.log(
      `  note: ink boxes AGREE at threshold ${at.threshold} (${at.canvas}) — this failure is anti-aliasing fringe, not geometry`,
    );
  }
  console.log(
    `${card.status.toUpperCase()} ${card.label} — AA masked ${(m.pctAAMasked ?? m.pctAAUnmasked).toFixed(2)}% (bar ${FIDELITY_BAR.pctAAMaskedMax}%) · canvas ${m.canvasPx} ink ${m.inkCanvasPct.toFixed(1)}% · real ${m.realPx} ink ${m.inkRealPct.toFixed(1)}%`,
  );
}
