#!/usr/bin/env node
/**
 * REFERENCE AUDIT — is the OTHER half of the pair the right picture?
 *
 *   node scripts/console-loop-reference-audit.mjs <lane> [stem ...]
 *   node scripts/console-loop-reference-audit.mjs carbon --json
 *
 * WHY THIS EXISTS
 * ---------------
 * scripts/console-loop-capture-framing-check.mjs pins the CANVAS half (C1) and
 * asks two yes/no questions about the reference: is it comparable in size (C2),
 * and does it live under this lane's roots (C3). Neither question can see the
 * failure class that dominates these lanes: a reference that is correctly
 * sized, correctly located, and DEPICTS THE WRONG PICTURE — a different variant
 * of the right component (carbon/button's canvas cell is Kind=Primary Size=Xs;
 * its reference was danger--ghost.2xl), or a copy that has silently drifted
 * from the artifact its own referenceSource names.
 *
 * This script answers "which developed render does the committed canvas shot
 * actually look like?" by scoring the shot against EVERY sibling gate-shot of
 * the same component and ranking them. If the current reference is not at or
 * near the top, the reference — not the canvas — is what is wrong, and the
 * winner names the retarget.
 *
 * It reports three independent facts per stem:
 *
 *   PROVENANCE   referenceSource resolved to a repo path? does the committed
 *                refs/ copy still byte-match that source? A copy that has
 *                drifted is FC-REF-STALE-COPY: the receipt's provenance claim
 *                is false and the number was scored against an artifact no
 *                longer in the tree.
 *   SWEEP        best-scoring sibling gate-shot vs the one currently pinned.
 *                A large gap is FC-REF-WRONG-VARIANT.
 *   GEOMETRY     shot / reference pixel + ink boxes, so a stage-clipped or
 *                hand-cropped reference is visible as a number.
 *
 * This is a REPORTING instrument, not a gate: it writes nothing and never
 * fails CI. The gate remains console-loop-capture-framing-check.mjs, and the
 * only thing that may flip a pass claim is console-loop-developed-score.mjs.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CL = path.join(ROOT, "parity/receipts/console-loop");

const argv = process.argv.slice(2).filter((a) => a !== "--json");
const asJson = process.argv.includes("--json");
const lane = argv[0];
if (!lane) {
  console.error("usage: console-loop-reference-audit.mjs <lane> [stem ...] [--json]");
  process.exit(2);
}
const onlyStems = argv.slice(1);

const scorer = await import(
  pathToFileURL(path.join(ROOT, "extract/figma/canvas-gate/score.ts")).href
);
const { PNG } = await import("pngjs");

const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

const WHITE_TRIM = 250;
function contentBox(png) {
  let minX = png.width, minY = png.height, maxX = -1, maxY = -1;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const i = (y * png.width + x) * 4;
      if (
        png.data[i + 3] > 16 &&
        (png.data[i] < WHITE_TRIM || png.data[i + 1] < WHITE_TRIM || png.data[i + 2] < WHITE_TRIM)
      ) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, width: png.width, height: png.height, blank: true };
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, blank: false };
}

const downscale2x = (src) => {
  const w = Math.max(1, Math.floor(src.width / 2));
  const h = Math.max(1, Math.floor(src.height / 2));
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const si = (y * 2 * src.width + x * 2) * 4;
      const di = (y * w + x) * 4;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = src.data[si + 3];
    }
  }
  return out;
};

/**
 * Ranking score. Deliberately SIMPLER than console-loop-developed-score.mjs:
 * DPR normalisation + align + scoreCell, with no size-normalisation rescue.
 * Its job is to order candidates, never to decide a pass — the winner is always
 * re-measured by the real scorer before any receipt changes.
 */
function rank(canvasPng, refPathAbs) {
  let a = canvasPng;
  let b = scorer.readPngBuffer(readFileSync(refPathAbs));
  const rough = Math.max(a.width / b.width, b.width / a.width, a.height / b.height, b.height / a.height);
  if (rough >= 1.7 && rough <= 2.4) {
    if (a.width * a.height > b.width * b.height) a = downscale2x(a);
    else b = downscale2x(b);
  }
  const aligned = scorer.alignPair(a, b);
  const cell = scorer.scoreCell(aligned, [], []);
  const aW = aligned.aPlace?.content?.width ?? a.width;
  const aH = aligned.aPlace?.content?.height ?? a.height;
  const bW = aligned.bPlace?.content?.width ?? b.width;
  const bH = aligned.bPlace?.content?.height ?? b.height;
  const scaleRatio = Math.max(aW / bW, bW / aW, aH / bH, bH / aH);
  const aspect = Math.max((aW / aH) / (bW / bH), (bW / bH) / (aW / aH));
  return {
    aa: cell.pctAAMasked,
    scaleRatio,
    aspect,
    inkCanvasPct: cell.inkCanvasPct,
    inkRealPct: cell.inkRealPct,
  };
}

function resolveShot(laneName, stem, receipt) {
  for (const c of [`${stem}-cell.png`, `${stem}.png`]) {
    const p = path.join(CL, laneName, "shots", c);
    if (existsSync(p)) return p;
  }
  const fromReceipt = receipt?.visual?.canvasShot;
  if (typeof fromReceipt === "string") {
    const abs = path.isAbsolute(fromReceipt) ? fromReceipt : path.join(ROOT, fromReceipt);
    if (existsSync(abs)) return abs;
  }
  return null;
}

/**
 * referenceSource is a provenance DESCRIPTOR. Three shapes occur in-tree:
 *   "extract/computed/out/mui/button/gate-shots/x.png"   full repo path
 *   "emit-html:examples/astryx/contracts/x.json#frag"    scheme + path
 *   "pair--unset.lg__default.png#package-left-pill"      BARE FILENAME
 * The bare form names a file with no directory; it is only resolvable if you
 * already know the component directory. `hint` supplies that directory so the
 * audit can still check the copy — but the descriptor itself is unverifiable
 * provenance and is reported as such.
 */
function resolveSource(src, hintDirs) {
  if (typeof src !== "string" || !src.trim()) return { kind: "absent" };
  let s = src.split("#")[0].trim();
  const scheme = s.match(/^([a-z][a-z0-9-]*):(?!\/)/i);
  if (scheme) s = s.slice(scheme[0].length);
  if (s.includes("/")) {
    return { kind: "path", rel: s, exists: existsSync(path.join(ROOT, s)) };
  }
  for (const dir of hintDirs) {
    const rel = path.join(dir, s);
    if (existsSync(path.join(ROOT, rel))) return { kind: "bare", rel, exists: true, bare: s };
  }
  return { kind: "bare", rel: null, exists: false, bare: s };
}

/** Component directory under extract/computed/out/<lane> for this stem. */
function computedDir(laneName, stem, refSourceRel) {
  if (refSourceRel) {
    const m = refSourceRel.match(new RegExp(`extract/computed/out/${laneName}/([^/]+)/`));
    if (m) return path.join("extract/computed/out", laneName, m[1]);
  }
  const squashed = stem.replace(/-/g, "");
  for (const cand of [stem, squashed]) {
    if (existsSync(path.join(ROOT, "extract/computed/out", laneName, cand))) {
      return path.join("extract/computed/out", laneName, cand);
    }
  }
  return null;
}

const stems = (() => {
  const dir = path.join(CL, lane, "components");
  const all = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -5));
  return onlyStems.length ? all.filter((s) => onlyStems.includes(s)) : all;
})();

const report = [];
for (const stem of stems) {
  const receipt = JSON.parse(readFileSync(path.join(CL, lane, "components", `${stem}.json`), "utf8"));
  const v = receipt.visual ?? {};
  const refRel = typeof v.reference === "string" ? v.reference.split(";")[0].trim() : null;
  const shotPath = resolveShot(lane, stem, receipt);
  const row = { lane, stem, claimsPass: v.ok === true || v.matchDeveloped === true };

  if (!shotPath) {
    row.error = "no committed canvas shot";
    report.push(row);
    continue;
  }
  const canvasPng = scorer.readPngBuffer(readFileSync(shotPath));
  const sBox = contentBox(canvasPng);
  row.shot = { rel: path.relative(ROOT, shotPath), px: `${canvasPng.width}x${canvasPng.height}`, ink: `${sBox.width}x${sBox.height}` };

  const refAbs = refRel && refRel !== "none" ? path.join(ROOT, refRel) : null;
  if (refAbs && existsSync(refAbs)) {
    const refPng = scorer.readPngBuffer(readFileSync(refAbs));
    const rBox = contentBox(refPng);
    row.reference = { rel: refRel, px: `${refPng.width}x${refPng.height}`, ink: `${rBox.width}x${rBox.height}` };
    row.current = rank(canvasPng, refAbs);
  } else {
    row.reference = { rel: refRel, missing: true };
  }

  // ---- PROVENANCE -------------------------------------------------------
  const compDirGuess = computedDir(lane, stem, null);
  const hints = compDirGuess
    ? [path.join(compDirGuess, "receipts"), path.join(compDirGuess, "gate-shots")]
    : [];
  const src = resolveSource(v.referenceSource, hints);
  row.provenance = { descriptor: v.referenceSource ?? null, ...src };
  if (src.exists && src.rel && refAbs && existsSync(refAbs)) {
    const srcAbs = path.join(ROOT, src.rel);
    const srcPng = scorer.readPngBuffer(readFileSync(srcAbs));
    const sameDims = srcPng.width === (row.reference.px ?? "").split("x").map(Number)[0]
      && srcPng.height === (row.reference.px ?? "").split("x").map(Number)[1];
    const sameBytes = sha(srcAbs) === sha(refAbs);
    // A descriptor carrying a #fragment CLAIMS to be a crop, so differing
    // bytes are expected and honest. A fragment-less descriptor at IDENTICAL
    // dimensions claims to BE that file: differing bytes mean the source was
    // re-rendered underneath the committed copy and the provenance line now
    // points at a picture nobody scored — FC-REF-STALE-COPY.
    const claimsWholeFile = !String(v.referenceSource).includes("#");
    row.provenance.copyMatchesSource = sameBytes;
    row.provenance.staleCopy = claimsWholeFile && sameDims && !sameBytes;
    row.provenance.croppedFromSource = !sameBytes && !sameDims;
    row.provenance.sourcePx = `${srcPng.width}x${srcPng.height}`;
  }

  // ---- SWEEP ------------------------------------------------------------
  const compDir = computedDir(lane, stem, src.rel);
  if (compDir && existsSync(path.join(ROOT, compDir, "gate-shots"))) {
    const shotsDir = path.join(ROOT, compDir, "gate-shots");
    const cands = readdirSync(shotsDir).filter((f) => f.endsWith("__default.png"));
    const scored = [];
    for (const f of cands) {
      try {
        scored.push({ ref: path.join(compDir, "gate-shots", f), ...rank(canvasPng, path.join(shotsDir, f)) });
      } catch {
        /* unreadable candidate is not evidence */
      }
    }
    scored.sort((a, b) => a.aa - b.aa);
    row.sweep = { candidates: scored.length, top: scored.slice(0, 4) };
  } else {
    row.sweep = { candidates: 0, note: `no gate-shots dir under ${compDir ?? "extract/computed/out/" + lane}` };
  }
  report.push(row);
}

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  for (const r of report) {
    const fmt = (n) => (typeof n === "number" ? n.toFixed(2) : String(n));
    console.log(`\n── ${r.lane}/${r.stem}${r.claimsPass ? "  [claims pass]" : ""}`);
    if (r.error) { console.log(`   ${r.error}`); continue; }
    console.log(`   shot      ${r.shot.px} ink ${r.shot.ink}  ${r.shot.rel}`);
    if (r.reference.missing) console.log(`   reference MISSING ON DISK: ${r.reference.rel}`);
    else console.log(`   reference ${r.reference.px} ink ${r.reference.ink}  ${r.reference.rel}`);
    if (r.current) console.log(`   current   AA=${fmt(r.current.aa)}%  scale=${fmt(r.current.scaleRatio)} aspect=${fmt(r.current.aspect)} ink ${fmt(r.current.inkCanvasPct)}/${fmt(r.current.inkRealPct)}`);
    const p = r.provenance;
    console.log(
      `   provenance ${p.kind}${p.kind === "bare" ? ` (BARE FILENAME — unverifiable descriptor "${p.bare}")` : ""}` +
        `${p.rel ? ` -> ${p.rel}` : ""}${p.kind !== "absent" && !p.exists ? " [DOES NOT RESOLVE]" : ""}` +
        `${p.staleCopy ? `  ** SAME ${p.sourcePx} DIMS, DIFFERENT BYTES — FC-REF-STALE-COPY **` : ""}` +
        `${p.croppedFromSource ? `  (committed copy is a crop/re-render of a ${p.sourcePx} source)` : ""}`,
    );
    if (r.sweep.candidates) {
      console.log(`   sweep     ${r.sweep.candidates} sibling __default gate-shot(s); best:`);
      for (const t of r.sweep.top) {
        const isCurrent = r.reference.rel && (t.ref === r.reference.rel || (p.rel && t.ref === p.rel));
        console.log(`      AA=${String(fmt(t.aa)).padStart(6)}%  scale=${fmt(t.scaleRatio)}  ${t.ref}${isCurrent ? "   <== CURRENTLY PINNED" : ""}`);
      }
    } else {
      console.log(`   sweep     ${r.sweep.note}`);
    }
  }
}
