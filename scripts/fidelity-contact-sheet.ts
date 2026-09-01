/**
 * Side-by-side review sheet for fidelity subjects: per row, the minted canvas
 * export (ink-trimmed), the real-package reference (ink-trimmed) and the
 * scorer diff. Read-only; writes one PNG.
 *
 *   npx tsx scripts/fidelity-contact-sheet.ts "chip/mui,badge/mui" out.png [scale]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import { trimToInk, cropBox } from "../recipe/fidelity-score.js";
import { readPngBuffer } from "../extract/figma/canvas-gate/score.js";
const REPO = new URL("../", import.meta.url).pathname;
const m = JSON.parse(readFileSync(REPO + "recipe/fidelity-manifest.json", "utf8"));
const labels = process.argv[2].split(",");
const out = process.argv[3];
const SCALE = Number(process.argv[4] ?? 2);
const rows: PNG[][] = [];
for (const l of labels) {
  const s = m.subjects.find((x: any) => x.label === l);
  const c = trimToInk(readPngBuffer(readFileSync(REPO + s.shot)));
  const r = trimToInk(readPngBuffer(readFileSync(REPO + s.reference)));
  const dpath = REPO + "recipe/evidence/fidelity-v1/" + l.replace("/", "-") + ".diff.png";
  const d = readPngBuffer(readFileSync(dpath));
  rows.push([c, r, d]);
}
const pad = 8, colW = [0, 0, 0], rowH: number[] = [];
for (const row of rows) { rowH.push(Math.max(...row.map((p) => p.height)) * SCALE + pad); row.forEach((p, i) => (colW[i] = Math.max(colW[i]!, p.width * SCALE + pad))); }
const W = colW.reduce((a, b) => a + b, pad), H = rowH.reduce((a, b) => a + b, pad);
const sheet = new PNG({ width: W, height: H });
sheet.data.fill(200); for (let i = 3; i < sheet.data.length; i += 4) sheet.data[i] = 255;
let y = pad;
for (const [ri, row] of rows.entries()) {
  let x = pad;
  for (const [ci, p] of row.entries()) {
    for (let yy = 0; yy < p.height * SCALE; yy++) for (let xx = 0; xx < p.width * SCALE; xx++) {
      const si = ((Math.floor(yy / SCALE)) * p.width + Math.floor(xx / SCALE)) * 4, di = ((y + yy) * W + x + xx) * 4;
      const a = p.data[si + 3]! / 255;
      sheet.data[di] = Math.round(p.data[si]! * a + 255 * (1 - a)); sheet.data[di + 1] = Math.round(p.data[si + 1]! * a + 255 * (1 - a)); sheet.data[di + 2] = Math.round(p.data[si + 2]! * a + 255 * (1 - a)); sheet.data[di + 3] = 255;
    }
    x += colW[ci]!;
  }
  y += rowH[ri]!;
}
writeFileSync(out, PNG.sync.write(sheet));
console.log(out, W + "x" + H, "rows:", labels.join(" | "));
