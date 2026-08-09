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
 *  C3b RESOLVABLE PROVENANCE — opt-in via guard.requireResolvableProvenance.
 *      C3 can only judge a descriptor that carries a repo path. Four receipts
 *      in the carbon/tailwind lanes spelled referenceSource as a BARE FILENAME
 *      ("pair--unset.lg__default.png#package-left-pill"): no directory, so C3
 *      skipped them silently and a hand crop of an unknown artifact passed the
 *      provenance gate by being too vague to check. Lanes that opt in require
 *      every referenceSource to resolve to a repo path.
 *
 *  C4  REFERENCE STAGE EDGE — opt-in via guard.stageClipCheck.
 *      A developed gate-shot renders a component inside a fixed harness stage.
 *      When the component overflows that stage the render is CUT, and the
 *      committed reference silently depicts a truncated component (mui/menu
 *      loses its third item and the bottom of its second; mui/dialog loses its
 *      body's last line). The signature is an ink box flush against SOME but
 *      not ALL four PNG edges. Flush against ALL four is a deliberate tight
 *      crop and is exempt.
 *
 *  C5  REFERENCE SWEEP — opt-in via guard.referenceSweepCheck.
 *      C1-C4 are all GEOMETRY and PROVENANCE: they judge where a PNG sits and
 *      how big it is. None of them can see a reference that is correctly sized,
 *      correctly located, correctly sourced — and DEPICTS THE WRONG PICTURE.
 *      Measured cases: mui/button was scored against the DISABLED render of its
 *      own variant (88.31 -> 6.36 once retargeted to enabled); carbon/button
 *      against danger-ghost at 2xl while the cell is primary at xs;
 *      carbon/toggle against the toggled-ON render. All three passed C1-C4.
 *
 *      The signal is the CONTENT COLOUR HISTOGRAM (see contentHistogram): an
 *      8x8x8 RGB histogram of the ink content box, compared as a total-variation
 *      distance in percent (0 = identical palette mix, 100 = disjoint). It is
 *      position-, scale- and DPR-independent, which is what makes it usable as
 *      a RANKING key: the shot is scored against every sibling __default
 *      gate-shot in the directory the receipt's own referenceSource names, and
 *      if some sibling is dramatically closer than the pinned one, the pinned
 *      one is what is wrong and the winner NAMES the retarget.
 *
 *      This is a ranking, not a verdict, so it fires only on a decisive margin
 *      (guard.sweepPinnedMinPct / guard.sweepGapMinPct) and it CAN be fooled:
 *      when the canvas itself renders the wrong colour, a sibling of the right
 *      component will win for the wrong reason (astryx/badge's cell IS
 *      Variant=Blue and its blue__default reference is correct — the canvas
 *      paints it near-white). That decoy reading is why the waiver accepts
 *      FC-REF-SWEEP-DECOY as well as FC-REF-WRONG-VARIANT: a receipt that has
 *      examined the proposed retarget and REFUSED it says so, in the tree,
 *      instead of the finding being re-derived by hand every round.
 *
 *  C6  REFERENCE TONE — opt-in via guard.referenceToneCheck.
 *      pixelmatch at threshold 0.1 compares a YIQ distance against a cutoff of
 *      35215*t^2; a whole-component TONE SWAP can sit under it. Measured:
 *      polaris/badge's stale blue shot against the live neutral cell differed on
 *      94.43% of pixels per channel and still scored 7.13 pctAAMasked, because
 *      #F0F0F0 vs #D5EBFF is a YIQ delta of 158 against a 352 cutoff. So the one
 *      number the board is built on can read "nearly identical" for two pictures
 *      that share no colour.
 *      C6 is the second, independent colour metric: the same histogram distance
 *      as C5, applied directly to the pinned pair, and asserted ONLY in the band
 *      where the AA number is claiming closeness (receipt claims a pass, or the
 *      scorecard's pctAAMasked <= guard.toneAAMaxPct). Outside that band the
 *      stem is already failing loudly and the tone number adds nothing.
 *
 * CELL-PENDING LANES
 * ------------------
 * cellW/cellH are only trustworthy when minted from the live canvas, so a lane
 * whose Figma file is not reachable from the Desktop Bridge cannot be C1-pinned
 * without fabricating the very number C1 exists to check. Such a stem may
 * declare `"cellPending": { "reason": "..." }` instead of cellW/cellH: C1 is
 * then NOT asserted, the stem is counted and printed as cell-PENDING (never
 * silently green), and C2/C3/C3b/C4 — which need no bridge — still run. A
 * cellPending without a reason is an error: an unpinned capture must say why.
 *
 * SEVERITY
 * --------
 * C1 is always an error: a capture is either that cell or it is not.
 * C2/C3/C3b/C4 are errors when the receipt CLAIMS a visual pass. On an honest
 * fail-closed receipt they are errors only if the receipt does not NAME the
 * cause the pin raised in visual.defects — the same "honest fail-closed is
 * legal, but it must be named" grammar the console-loop evidence gates use.
 * Named-open findings are printed, counted, and do not fail CI.
 *
 * Cause codes raised:
 *   FC-CELL-FRAMING              C1  — shot is not the pinned VARIANT cell (never waivable)
 *   FC-REF-FRAMING               C2  — reference is not comparable to the cell
 *   FC-REF-CROSS-LIBRARY         C3  — reference belongs to another lane's library
 *   FC-REF-UNVERIFIABLE-PROVENANCE C3b — referenceSource names no repo path
 *   FC-REF-STAGE-EDGE            C4  — reference ink is flush to its stage edge (cut or anchored)
 *   FC-REF-WRONG-VARIANT         C5  — a sibling gate-shot depicts the cell far better
 *                                      (waivable also by FC-REF-SWEEP-DECOY — retarget examined and refused)
 *   FC-REF-TONE-SWAP             C6  — pinned pair share almost no colour while AA claims closeness
 *
 * C2 is waived by naming ANY code from guard.framingCauses in visual.defects,
 * not only the generic FC-REF-FRAMING. A stem whose reference has already been
 * retargeted to a correct like-for-like gate-shot and STILL sits outside the
 * guard has a real emit defect (FC-ABS-SIZE, FC-WIDTH-TOKEN, …); naming that is
 * strictly more honest than restating "framing". C3 requires the exact code —
 * a reference from the wrong design system has no honest alternative reading.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
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
const CAUSE_REF_PROVENANCE = "FC-REF-UNVERIFIABLE-PROVENANCE";
const CAUSE_REF_STAGE_EDGE = "FC-REF-STAGE-EDGE";
const CAUSE_REF_WRONG_VARIANT = "FC-REF-WRONG-VARIANT";
const CAUSE_REF_SWEEP_DECOY = "FC-REF-SWEEP-DECOY";
const CAUSE_REF_TONE_SWAP = "FC-REF-TONE-SWAP";

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
  if (maxX < 0) {
    return { x: 0, y: 0, width: png.width, height: png.height, blank: true, edges: "" };
  }
  // Which stage edges the ink is flush against. ALL FOUR means a deliberate
  // tight crop; SOME means the render was cut by, or anchored to, its stage.
  const edges =
    (minX <= 0 ? "L" : "") + (maxX >= png.width - 1 ? "R" : "") +
    (minY <= 0 ? "T" : "") + (maxY >= png.height - 1 ? "B" : "");
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, blank: false, edges };
}

/**
 * CONTENT COLOUR HISTOGRAM — the C5/C6 signal.
 *
 * 8x8x8 RGB histogram over the ink content box, alpha-composited over white and
 * normalised to a distribution. Deliberately NOT spatial: two renders of the
 * same component at different DPR, or with a shadow that extends the box by a
 * few pixels, produce nearly the same histogram, while a variant swap that
 * repaints the component (enabled->disabled, blue->neutral, ghost->primary)
 * moves most of the mass to different bins. That is exactly the axis pixelmatch
 * throws away: it asks "is THIS pixel's YIQ delta over the cutoff", never "do
 * these two pictures use the same colours at all".
 *
 * 32-wide bins are the coarsest quantisation that still separates the measured
 * tone swap: #F0F0F0 -> (7,7,7) and #D5EBFF -> (6,7,7) land in different bins.
 */
function contentHistogram(png, box) {
  const h = new Float64Array(512);
  let n = 0;
  for (let y = 0; y < box.height; y += 1) {
    for (let x = 0; x < box.width; x += 1) {
      const i = ((box.y + y) * png.width + (box.x + x)) * 4;
      const a = png.data[i + 3] / 255;
      const r = Math.round(png.data[i] * a + 255 * (1 - a));
      const g = Math.round(png.data[i + 1] * a + 255 * (1 - a));
      const b = Math.round(png.data[i + 2] * a + 255 * (1 - a));
      h[((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5)] += 1;
      n += 1;
    }
  }
  if (n) for (let i = 0; i < 512; i += 1) h[i] /= n;
  return h;
}

/** Total-variation distance between two normalised histograms, in percent. */
function tvDistancePct(p, q) {
  let s = 0;
  for (let i = 0; i < 512; i += 1) s += Math.abs(p[i] - q[i]);
  return (s / 2) * 100;
}

/** Histogram of a PNG on disk, memoised — a sweep re-reads the same siblings. */
const histCache = new Map();
function histogramOf(absPath) {
  if (histCache.has(absPath)) return histCache.get(absPath);
  const png = PNG.sync.read(readFileSync(absPath));
  const h = contentHistogram(png, contentBox(png));
  histCache.set(absPath, h);
  return h;
}

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
let cellPinned = 0;
let cellPending = 0;

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
  // Opt-in per lane so a lane that has not yet been audited this way is not
  // retroactively reddened by a check its receipts never had a chance to name.
  const requireResolvableProvenance = g.requireResolvableProvenance === true;
  const stageClipCheck = g.stageClipCheck === true;
  const referenceSweepCheck = g.referenceSweepCheck === true;
  const sweepPinnedMin = g.sweepPinnedMinPct ?? 15;
  const sweepGapMin = g.sweepGapMinPct ?? 12;
  const referenceToneCheck = g.referenceToneCheck === true;
  const toneTVMax = g.toneTVMaxPct ?? 25;
  const toneAAMax = g.toneAAMaxPct ?? 10;
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
      // C2 is waived by any lane-configured framing cause; C5 additionally by
      // FC-REF-SWEEP-DECOY, the honest reading when the proposed retarget was
      // examined and refused. Everything else needs its own exact code.
      const accepted =
        cause === CAUSE_REF_FRAMING
          ? framingCauses
          : cause === CAUSE_REF_WRONG_VARIANT
            ? [CAUSE_REF_WRONG_VARIANT, CAUSE_REF_SWEEP_DECOY]
            : [cause];
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
    // A red-test override supplies a deliberately wrong shot; it must be able
    // to prove C1 still bites, so it overrides cellPending too.
    if (s.cellPending && !redTest.has(tag)) {
      if (typeof s.cellPending.reason !== "string" || !s.cellPending.reason.trim()) {
        errors.push(
          `${tag}: cellPending without a reason — an unpinned capture must say why the live cell could not be minted`,
        );
        continue;
      }
      cellPending += 1;
      open.push(
        `${tag}: C1 NOT ASSERTED (cell-pending) — ${s.cellPending.reason} [shot ${rel(shotPath)} ${shotPng.width}x${shotPng.height}]`,
      );
    } else {
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
      cellPinned += 1;
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

    // ---- C3b: the provenance descriptor must be checkable at all ----------
    if (requireResolvableProvenance) {
      const descriptor = receipt?.visual?.referenceSource;
      if (typeof descriptor === "string" && descriptor.trim() && !refSource) {
        raise(
          CAUSE_REF_PROVENANCE,
          `visual.referenceSource "${descriptor}" carries no repo path, so C3 cannot judge which library or artifact it came from — spell it as a full repo path (a bare filename is a provenance claim nothing can verify)`,
        );
      }
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
    const refPng = PNG.sync.read(readFileSync(refPath));
    let a = contentBox(shotPng);
    let b = contentBox(refPng);

    // ---- C4: reference ink flush against its stage edge --------------------
    if (stageClipCheck && !b.blank && b.edges && b.edges.length < 4) {
      raise(
        CAUSE_REF_STAGE_EDGE,
        `reference "${refRel}" (${refPng.width}x${refPng.height}, content box ${b.width}x${b.height}) has ink flush against stage edge(s) [${b.edges.split("").join(",")}] — ` +
          "a developed reference is expected to sit INSIDE its harness stage with margin on every side, so this render was either cut by the stage or anchored to it; either way it does not depict the whole component. " +
          "(Flush on all four edges is a deliberate tight crop and is exempt.)",
      );
    }

    // ---- C5/C6: does the reference DEPICT this cell? ------------------------
    // Both read the same signal, from the content boxes BEFORE the DPR
    // rescaling C2 applies below (the histogram is already scale-independent).
    if (referenceSweepCheck || referenceToneCheck) {
      const shotHist = contentHistogram(shotPng, a);
      const pinnedTV = tvDistancePct(shotHist, contentHistogram(refPng, b));

      // C5 — rank the shot against every sibling __default render in the
      // directory the receipt's OWN referenceSource names. No referenceSource
      // resolving into a per-combo render dir means no siblings and no sweep:
      // this check never guesses where a reference "should" have come from.
      //
      // BOTH `gate-shots/` (the CONTRACT render) and `orig-shots/` (the REAL
      // LIBRARY render, written by `extract/computed/run.ts --keep-originals`)
      // are per-combo sibling sets keyed `<combo>__<interaction>.png`, so both
      // sweep. Accepting only `gate-shots` was a silent kill switch: the moment
      // a lane was re-pointed at the library render — which is the whole point
      // of the 2026-08-08 REFERENCE-TRUTH round — C5 went inert for that lane
      // while still reporting itself as enabled. astryx hit exactly that at
      // f26c1205 and the `console-loop-reference-content-checks` eval went red
      // on the committed tree naming it ("the sweep is enabled but inert").
      const SWEEPABLE_DIRS = new Set(["gate-shots", "orig-shots"]);
      if (referenceSweepCheck && refSource) {
        const srcDir = path.dirname(refSource);
        const siblingsDir = path.join(ROOT, srcDir);
        if (SWEEPABLE_DIRS.has(path.basename(srcDir)) && existsSync(siblingsDir)) {
          const siblings = readdirSync(siblingsDir).filter((f) => f.endsWith("__default.png"));
          if (siblings.length >= 2) {
            let best = null;
            for (const f of siblings) {
              let d;
              try {
                d = tvDistancePct(shotHist, histogramOf(path.join(siblingsDir, f)));
              } catch {
                continue; // an unreadable candidate is not evidence
              }
              if (!best || d < best.d) best = { f, d };
            }
            const gap = best ? pinnedTV - best.d : 0;
            if (best && pinnedTV >= sweepPinnedMin && gap >= sweepGapMin) {
              raise(
                CAUSE_REF_WRONG_VARIANT,
                `pinned reference "${refRel}" (from ${path.basename(refSource)}) is ${pinnedTV.toFixed(1)}% colour-histogram distance from the canvas cell, ` +
                  `but the sibling "${path.join(srcDir, best.f)}" is only ${best.d.toFixed(1)}% (gap ${gap.toFixed(1)}pt over ${siblings.length} siblings; ` +
                  `fires at pinned>=${sweepPinnedMin}% and gap>=${sweepGapMin}pt) — either the reference depicts the wrong variant and ${best.f} names the retarget, ` +
                  "or the CANVAS renders the wrong colour and a sibling wins for the wrong reason; " +
                  `whichever it is, say so (${CAUSE_REF_WRONG_VARIANT} to retarget, ${CAUSE_REF_SWEEP_DECOY} if the retarget was examined and refused)`,
              );
            }
          }
        }
      }

      // C6 — a tone swap that pixelmatch cannot see, asserted only where the AA
      // number is claiming closeness.
      if (referenceToneCheck) {
        let aa = null;
        const scorePath = path.join(CL, lane, "scores", `${stem}.json`);
        if (existsSync(scorePath)) {
          try {
            aa = JSON.parse(readFileSync(scorePath, "utf8"))?.metrics?.pctAAMasked ?? null;
          } catch {
            /* an unreadable scorecard is the evidence gate's business */
          }
        }
        const inBand = claimsPass || (typeof aa === "number" && aa <= toneAAMax);
        if (inBand && pinnedTV >= toneTVMax) {
          raise(
            CAUSE_REF_TONE_SWAP,
            `shot and reference "${refRel}" share almost no colour — ${pinnedTV.toFixed(1)}% colour-histogram distance (bar ${toneTVMax}%) — ` +
              `while pctAAMasked ${aa === null ? "is unrecorded and the receipt CLAIMS a pass" : `is ${aa.toFixed(2)} (band <=${toneAAMax})`}, ` +
              "i.e. the pixel score is reading these two pictures as near-identical. pixelmatch at threshold 0.1 compares a YIQ delta against a 352 cutoff, " +
              "so a whole-component tone swap (measured: #F0F0F0 cell vs #D5EBFF reference, YIQ delta 158, 94.43% of pixels differing per channel, AA 7.13) sits under the bar",
          );
        }
      }
    }
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
  `✔ console-loop:capture-framing — ${checked} pinned stem(s) across ${lanes.length} lane(s): ` +
    `every committed shot is its 1x VARIANT cell where one is pinned ` +
    `(${cellPinned} cell-pinned, ${cellPending} cell-PENDING with a named reason — C1 not asserted there); ` +
    `${open.length} named-open finding(s)`,
);
