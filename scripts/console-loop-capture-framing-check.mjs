#!/usr/bin/env node
/**
 * CAPTURE-FRAMING PIN — the gate that makes a mis-framed shot fail BY NAME.
 *
 *   node scripts/console-loop-capture-framing-check.mjs [lane ...]
 *   node scripts/console-loop-capture-framing-check.mjs --red-test astryx/slider=parity/receipts/console-loop/astryx/shots/slider.png
 *
 * WHY THIS EXISTS
 * ---------------
 * scripts/console-loop-developed-score.mjs only discovers a wrongly-framed
 * canvas shot AFTER the fact, and only as a symptom: compositionOk goes false
 * and the receipt inherits an unexplained low score ("use 1x VARIANT cell vs
 * gate-shot"). Nothing prevented the wrong PNG being committed in the first
 * place, and nothing told you WHICH half of the pair was wrong — the canvas
 * shot or the reference. This pin answers both, at check time, offline.
 *
 * WHAT IT ASSERTS (per stem in <lane>/framing.json)
 * -------------------------------------------------
 *  C1  CELL FRAMING (hard error, always).
 *      The committed canvas shot must be the pinned 1x VARIANT cell plus ONE
 *      uniform margin: (shotW - cellW) and (shotH - cellH) must agree within
 *      guard.marginSkewMaxPx, and the implied margin must sit inside
 *      [marginMinPx, marginMaxPx]. cellW/cellH come from the LIVE canvas via
 *      the Desktop Bridge (see framing.json.mintedFrom), so this is an
 *      independent fact, not a restatement of the PNG on disk.
 *      A whole-set screenshot, a hand crop, or a shot of a DIFFERENT component
 *      set fails here, naming the lane/stem and printing both boxes.
 *
 *  C2  REFERENCE COMPARABILITY (see severity below).
 *      Content boxes of the shot and of the reference the scorer resolves must
 *      sit inside the scorer's own composition guard (scaleRatio /
 *      aspectRatio, after the same DPR normalisation the scorer applies).
 *      This is the check that catches a whole-page site screenshot standing in
 *      for a single-cell developed reference.
 *
 *  C3  REFERENCE PROVENANCE (see severity below).
 *      visual.reference AND visual.referenceSource must live under one of the
 *      lane's refAllow prefixes. A reference sourced from another library's
 *      computed output (e.g. an astryx stem pinned to
 *      extract/computed/out/banner/ — the POLARIS lane) is scored against the
 *      wrong design system and its number means nothing.
 *
 * SEVERITY
 * --------
 * C1 is always an error: a capture is either that cell or it is not.
 * C2/C3 are errors when the receipt CLAIMS a visual pass. On an honest
 * fail-closed receipt they are errors only if the receipt does not NAME the
 * cause the pin raised in visual.defects — the same "honest fail-closed is
 * legal, but it must be named" grammar the console-loop evidence gates use.
 * Named-open findings are printed, counted, and do not fail CI.
 *
 * Cause codes raised:
 *   FC-CELL-FRAMING          C1 — shot is not the pinned VARIANT cell (never waivable)
 *   FC-REF-FRAMING           C2 — reference is not comparable to the cell
 *   FC-REF-CROSS-LIBRARY     C3 — reference belongs to another lane's library
 *
 * C2 is waived by naming ANY code from guard.framingCauses in visual.defects,
 * not only the generic FC-REF-FRAMING. A stem whose reference has already been
 * retargeted to a correct like-for-like gate-shot and STILL sits outside the
 * guard has a real emit defect (FC-ABS-SIZE, FC-WIDTH-TOKEN, …); naming that is
 * strictly more honest than restating "framing". C3 requires the exact code —
 * a reference from the wrong design system has no honest alternative reading.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CL = path.join(ROOT, "parity/receipts/console-loop");

const argv = process.argv.slice(2);
/** @type {Map<string,string>} `${lane}/${stem}` -> shot path override (red-test) */
const redTest = new Map();
const lanes = [];
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (a === "--red-test") {
    const spec = argv[i + 1];
    i += 1;
    const eq = spec ? spec.indexOf("=") : -1;
    if (eq < 0) {
      console.error("usage: --red-test <lane>/<stem>=<path-to-png>");
      process.exit(2);
    }
    redTest.set(spec.slice(0, eq), spec.slice(eq + 1));
  } else if (!a.startsWith("--")) {
    lanes.push(a);
  }
}
if (!lanes.length) {
  for (const lane of ["altitude", "astryx", "carbon", "mui", "polaris", "tailwind"]) {
    if (existsSync(path.join(CL, lane, "framing.json"))) lanes.push(lane);
  }
}

const CAUSE_CELL = "FC-CELL-FRAMING";
const CAUSE_REF_FRAMING = "FC-REF-FRAMING";
const CAUSE_REF_CROSS = "FC-REF-CROSS-LIBRARY";

const WHITE_TRIM = 250;
/** Ink content box — same rule as console-loop-developed-score.mjs. */
function contentBox(png) {
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const i = (y * png.width + x) * 4;
      const ink =
        png.data[i + 3] > 16 &&
        (png.data[i] < WHITE_TRIM ||
          png.data[i + 1] < WHITE_TRIM ||
          png.data[i + 2] < WHITE_TRIM);
      if (ink) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { width: png.width, height: png.height, blank: true };
  return { width: maxX - minX + 1, height: maxY - minY + 1, blank: false };
}

const readBox = (p) => contentBox(PNG.sync.read(readFileSync(p)));

/** Mirror of console-loop-developed-score.mjs resolveCanvasShot (lane form). */
function resolveShot(lane, stem, receipt) {
  const cell = path.join(CL, lane, "shots", `${stem}-cell.png`);
  if (existsSync(cell)) return cell;
  const set = path.join(CL, lane, "shots", `${stem}.png`);
  if (existsSync(set)) return set;
  const fromReceipt = receipt?.visual?.canvasShot;
  if (typeof fromReceipt === "string") {
    const abs = path.isAbsolute(fromReceipt) ? fromReceipt : path.join(ROOT, fromReceipt);
    if (existsSync(abs)) return abs;
  }
  return null;
}

/** Mirror of the scorer's reference resolution: receipt.visual.reference wins. */
function resolveReference(receipt) {
  const ref = receipt?.visual?.reference;
  if (typeof ref !== "string" || !ref.trim()) return null;
  const first = ref.split(";")[0].trim();
  // Receipts spell "no developed reference exists" as the literal "none".
  return first && first !== "none" ? first : null;
}

/**
 * referenceSource is a provenance DESCRIPTOR, not always a bare path:
 * "emit-html:examples/astryx/contracts/x.contract.json#first-item",
 * "examples/polaris/generated/html/text-field.html#first-item-inline-css".
 * Strip the generator scheme and the fragment before the allow-list test;
 * a descriptor that carries no repo path at all is not provenance we can judge.
 */
function referenceSourcePath(src) {
  if (typeof src !== "string") return null;
  let s = src.split("#")[0].trim();
  const scheme = s.match(/^([a-z][a-z0-9-]*):(?!\/)/i);
  if (scheme) s = s.slice(scheme[0].length);
  return s.includes("/") ? s : null;
}

const visualClaimsPass = (r) =>
  r?.visual?.ok === true || r?.visual?.matchDeveloped === true;

const errors = [];
const open = [];
let checked = 0;

for (const lane of lanes) {
  const pinPath = path.join(CL, lane, "framing.json");
  if (!existsSync(pinPath)) {
    errors.push(`${lane}: missing framing.json capture-framing pin`);
    continue;
  }
  /** @type {any} */
  let pin;
  try {
    pin = JSON.parse(readFileSync(pinPath, "utf8"));
  } catch (e) {
    errors.push(`${lane}: unparseable framing.json — ${e.message}`);
    continue;
  }
  if (pin.kind !== "console-loop-capture-framing-pin") {
    errors.push(`${lane}: framing.json kind must be console-loop-capture-framing-pin`);
    continue;
  }
  const g = pin.guard ?? {};
  const marginMin = g.marginMinPx ?? -1;
  const marginMax = g.marginMaxPx ?? 17;
  const skewMax = g.marginSkewMaxPx ?? 2;
  const scaleMax = g.scaleRatioMax ?? 1.35;
  const aspectMax = g.aspectRatioMax ?? 1.35;
  const [dprLo, dprHi] = g.dprBand ?? [1.7, 2.4];
  const refAllow = Array.isArray(pin.refAllow) ? pin.refAllow : [];
  const framingCauses = Array.isArray(g.framingCauses) && g.framingCauses.length
    ? g.framingCauses
    : [CAUSE_REF_FRAMING];

  // The pin must cover every stem the lane's evidence gate requires.
  const manifestPath = path.join(CL, lane, "manifest.json");
  if (existsSync(manifestPath)) {
    try {
      const required = JSON.parse(readFileSync(manifestPath, "utf8")).required ?? [];
      for (const stem of required) {
        if (!pin.stems?.[stem]) {
          errors.push(
            `${lane}/${stem}: required by manifest but absent from framing.json — every committed shot must be pinned to a VARIANT cell`,
          );
        }
      }
    } catch {
      /* manifest problems are the evidence gate's business */
    }
  }

  for (const [stem, s] of Object.entries(pin.stems ?? {})) {
    const tag = `${lane}/${stem}`;
    checked += 1;
    const receiptPath = path.join(CL, lane, "components", `${stem}.json`);
    /** @type {any} */
    let receipt = null;
    if (existsSync(receiptPath)) {
      try {
        receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
      } catch (e) {
        errors.push(`${tag}: unreadable receipt — ${e.message}`);
        continue;
      }
    }
    const defects = (receipt?.visual?.defects ?? []).join(" | ");
    const claimsPass = visualClaimsPass(receipt);
    const raise = (cause, msg) => {
      const line = `${tag}: ${cause} — ${msg}`;
      // C1 is a fact about the capture; it is never waivable by narration.
      if (cause === CAUSE_CELL) {
        errors.push(line);
        return;
      }
      if (claimsPass) {
        errors.push(`${line} (receipt CLAIMS a visual pass)`);
        return;
      }
      const accepted = cause === CAUSE_REF_FRAMING ? framingCauses : [cause];
      const named = accepted.find((c) => defects.includes(c));
      if (named) open.push(named === cause ? line : `${line} [named as ${named}]`);
      else errors.push(`${line} — and visual.defects names none of: ${accepted.join(", ")}`);
    };

    const shotPath = redTest.has(tag)
      ? path.isAbsolute(redTest.get(tag))
        ? redTest.get(tag)
        : path.join(ROOT, redTest.get(tag))
      : resolveShot(lane, stem, receipt);
    if (!shotPath || !existsSync(shotPath)) {
      errors.push(`${tag}: no committed canvas shot resolvable (shots/${stem}-cell.png | shots/${stem}.png)`);
      continue;
    }
    const shotPng = PNG.sync.read(readFileSync(shotPath));
    const rel = (p) => path.relative(ROOT, p);

    // ---- C1: shot is the pinned VARIANT cell plus ONE uniform margin -------
    const dW = shotPng.width - s.cellW;
    const dH = shotPng.height - s.cellH;
    const skew = Math.abs(dW - dH);
    const margin = (dW + dH) / 4;
    if (skew > skewMax || margin < marginMin || margin > marginMax) {
      raise(
        CAUSE_CELL,
        `committed shot ${rel(shotPath)} is ${shotPng.width}x${shotPng.height} but the pinned 1x VARIANT cell ${s.cellNodeId} "${s.cellName}" is ${s.cellW}x${s.cellH} ` +
          `(deltaW=${dW}, deltaH=${dH}, skew=${skew}px > ${skewMax}, implied margin=${margin.toFixed(1)}px) — the shot is not that cell (whole-set shot / crop / wrong set)`,
      );
      continue; // a shot that is not the cell makes C2 meaningless
    }

    // ---- C3: reference provenance ----------------------------------------
    const refRel = resolveReference(receipt);
    const refSource = referenceSourcePath(receipt?.visual?.referenceSource);
    const allowed = (p) => !p || refAllow.some((pre) => p.startsWith(pre));
    if (refRel && !allowed(refRel)) {
      raise(
        CAUSE_REF_CROSS,
        `visual.reference "${refRel}" is outside this lane's allowed reference roots (${refAllow.join(", ")}) — it is another library's artifact`,
      );
    }
    if (refSource && !allowed(refSource)) {
      raise(
        CAUSE_REF_CROSS,
        `visual.referenceSource "${receipt.visual.referenceSource}" is outside this lane's allowed reference roots (${refAllow.join(", ")}) — the reference PNG was cut from another library's computed output`,
      );
    }

    // ---- C2: reference comparability --------------------------------------
    if (!refRel) {
      raise(CAUSE_REF_FRAMING, "receipt has no visual.reference — nothing to frame against");
      continue;
    }
    const refPath = path.join(ROOT, refRel);
    if (!existsSync(refPath)) {
      raise(CAUSE_REF_FRAMING, `visual.reference "${refRel}" does not exist on disk`);
      continue;
    }
    let a = contentBox(shotPng);
    let b = readBox(refPath);
    // Same DPR normalisation the scorer applies before judging composition.
    const rough = Math.max(a.width / b.width, b.width / a.width, a.height / b.height, b.height / a.height);
    if (rough >= dprLo && rough <= dprHi) {
      if (a.width * a.height > b.width * b.height) a = { ...a, width: a.width / 2, height: a.height / 2 };
      else b = { ...b, width: b.width / 2, height: b.height / 2 };
    }
    const scaleRatio = Math.max(a.width / b.width, b.width / a.width, a.height / b.height, b.height / a.height);
    const aspectA = a.width / Math.max(1, a.height);
    const aspectB = b.width / Math.max(1, b.height);
    const aspectRatio = Math.max(aspectA / aspectB, aspectB / aspectA);
    if (scaleRatio > scaleMax || aspectRatio > aspectMax || a.blank || b.blank) {
      raise(
        CAUSE_REF_FRAMING,
        `shot content box ${Math.round(a.width)}x${Math.round(a.height)} vs reference "${refRel}" content box ${Math.round(b.width)}x${Math.round(b.height)} ` +
          `(scaleRatio=${scaleRatio.toFixed(2)} > ${scaleMax} or aspectRatio=${aspectRatio.toFixed(2)} > ${aspectMax}${a.blank ? "; SHOT BLANK" : ""}${b.blank ? "; REFERENCE BLANK" : ""}) — ` +
          "the reference is not a like-for-like 1x single-cell developed render",
      );
    }
  }
}

for (const line of open) console.log(`  open (named) ${line}`);
if (errors.length) {
  console.error(
    `\n✖ console-loop:capture-framing — ${errors.length} unnamed/hard framing violation(s) across ${checked} pinned stem(s):\n` +
      errors.map((e) => `  - ${e}`).join("\n"),
  );
  process.exit(1);
}
console.log(
  `✔ console-loop:capture-framing — ${checked} pinned stem(s) across ${lanes.length} lane(s): every committed shot is its 1x VARIANT cell; ${open.length} named-open reference finding(s)`,
);
