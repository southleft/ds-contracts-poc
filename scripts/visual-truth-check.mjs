/**
 * CI-able half of visual-truth: verify the COMMITTED headless scorecards —
 * no FIGMA_TOKEN, no network, plain node.
 *
 *   node scripts/visual-truth-check.mjs
 *
 * Fails (exit 1) when:
 *   - a scorecard's pinned sha256 (referenceSha256 / canvasShotSha256)
 *     mismatches the PNG on disk, or a pin is missing while the PNG exists;
 *   - a lane WITH scored headless cards has a pass-count below its
 *     RATCHET.json floor (the same floors the bridge lanes ratchet against);
 *   - RATCHET.json is missing/invalid.
 *
 * Lanes that were never run headlessly (no scorecards) or that the token
 * could not see (all cards are named skips, e.g. file-inaccessible-403) are
 * WARNED by name, not failed — a lane the instrument cannot reach must stay
 * visibly open, but it is not a regression.
 *
 * A lane listed under RATCHET.json `advisory` (a floor the owner holds ABOVE
 * the headless count, by recorded decision) is also WARNED by name rather than
 * failed — but only while it sits between its measured headless count and its
 * floor. Below the measured count it fails (regression); at or above the floor
 * it fails too, because the advisory is then stale and must be removed.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  scorecardPasses,
  verifyScorecardPins,
  loadRatchet,
} from "./console-loop-scorecard-lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VT = path.join(ROOT, "parity/receipts/console-loop/visual-truth");

const errors = [];
const warns = [];

const { data: ratchet, path: ratchetPath } = loadRatchet(ROOT);
if (!ratchet) {
  errors.push(`missing/invalid ${path.relative(ROOT, ratchetPath)} — the pass-count ratchet file is required`);
}

const floors = ratchet?.floors ?? {};
// ADVISORY LANES — a floor the owner has DECIDED to hold ABOVE the headless
// count (RATCHET.json `advisory.<lane>`, with the measurement and the
// decision written into the file). The floor is untouched and the bridge
// lanes still enforce it. Here, the below-floor verdict is printed as a named
// WARNING instead of an error: this script runs in the REQUIRED fast lane, and
// a gate that is red by standing decision is red forever, which hides every
// other regression behind the one everyone has learned to ignore.
//
// It is not a waiver. The lane still FAILS when its headless count drops
// below `headlessPassesMeasured` (a real regression), when `floorHeldAt` no
// longer matches the floor (moved without revisiting the entry), and the
// moment the lane MEETS its floor headlessly — then the entry is stale and is
// refused until it is deleted, so enforcement resumes on its own.
const advisory = ratchet?.advisory ?? {};
if (advisory && typeof advisory !== "object") {
  errors.push(`RATCHET.json advisory must be an object keyed by lane`);
}
const lanes = new Set(Object.keys(floors));
if (existsSync(VT)) {
  for (const d of readdirSync(VT, { withFileTypes: true })) {
    if (d.isDirectory()) lanes.add(d.name);
  }
}

let checkedCards = 0;
for (const lane of [...lanes].sort()) {
  const dir = path.join(VT, lane);
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).sort() : [];
  if (files.length === 0) {
    warns.push(`${lane}: no headless scorecards (lane not run headlessly yet)`);
    continue;
  }
  let passed = 0;
  let scored = 0;
  const skipReasons = new Map();
  const staleRefs = [];
  for (const f of files) {
    const p = path.join(dir, f);
    let sc;
    try {
      sc = JSON.parse(readFileSync(p, "utf8"));
    } catch (e) {
      errors.push(`${lane}/${f}: unparseable scorecard — ${e.message}`);
      continue;
    }
    checkedCards += 1;
    if (sc.source !== "rest-images-api") {
      errors.push(`${lane}/${f}: source is "${sc.source}" — visual-truth cards must be rest-images-api`);
    }
    if (sc.status === "skip") {
      const r = sc.skipReason ?? "?";
      skipReasons.set(r, (skipReasons.get(r) ?? 0) + 1);
      continue;
    }
    scored += 1;
    for (const err of verifyScorecardPins(ROOT, sc)) {
      errors.push(`${lane}/${f}: ${err}`);
    }
    // A CARD SCORED AGAINST A SUPERSEDED REFERENCE IS NOT EVIDENCE — for the
    // floor OR against it.
    //
    // The sha pins above prove a card still matches the PNG IT SCORED. They
    // cannot notice that the lane has since been repointed at a DIFFERENT
    // picture. The 2026-08-09 reference-truth round moved the lane receipts
    // from contract renders (emit-html output) to the real library renders
    // under `extract/computed/out/<lib>/<stem>/orig-shots/`, and the headless
    // cards were never re-run — so every pin stayed green while the whole
    // basis of comparison had moved underneath them.
    //
    // Measured across the corpus: 66 cards agree with their lane receipt, 11
    // disagree, and ALL ELEVEN are astryx — every astryx card, none anywhere
    // else. That is what put the lane below its floor: badge reads 12.62 here
    // against `console-loop/astryx/refs/badge.png` and 4.88 on the bridge
    // instrument against `orig-shots/blue__default.png`. Same stem, same bar,
    // different picture. The floor was then raised 0→1 from the BRIDGE
    // instrument while this gate enforces it against the HEADLESS count.
    //
    // Reported as a distinct error rather than folded into the pass-count, so
    // the output says "these cards are stale, re-run the lane" instead of
    // implying a fidelity regression that did not happen.
    const recPath = path.join(ROOT, "parity/receipts/console-loop", lane, "components", `${f.slice(0, -5)}.json`);
    if (sc.reference && existsSync(recPath)) {
      let rec;
      try {
        rec = JSON.parse(readFileSync(recPath, "utf8"));
      } catch {
        rec = null;
      }
      // `"none"` is the receipts' SENTINEL for "this stem records no
      // reference", not a path — astryx/toast carries it because Toast is
      // composition-tier with no single-component capture, so it keeps the
      // trap-corpus snapshot by name (trap-corpus/manifest.json). Treating the
      // sentinel as a replaced path made this check's first run flag toast as
      // stale, which is a false positive: nothing replaced anything. A receipt
      // that records no reference cannot contradict the card.
      const recRef = rec?.visual?.reference;
      if (recRef && recRef !== "none" && recRef !== sc.reference) {
        staleRefs.push(`${f.slice(0, -5)} (scored ${sc.reference}, receipt now says ${recRef})`);
      }
    }
    if (scorecardPasses(sc)) passed += 1;
  }

  // Named BEFORE the floor verdict, because it changes what that verdict
  // means: a lane whose cards no longer point at the lane's own reference
  // cannot be said to have regressed OR held.
  if (staleRefs.length > 0) {
    errors.push(
      `${lane}: ${staleRefs.length} of ${scored} scored card(s) were scored against a reference the lane receipt has since REPLACED — ` +
        `re-run the lane headlessly (\`visual-truth:run --lane ${lane}\`) before reading its pass-count as fidelity:\n      ${staleRefs.join("\n      ")}`,
    );
  }

  const floor = floors[lane];
  const adv = Object.prototype.hasOwnProperty.call(advisory, lane) ? advisory[lane] : null;
  if (adv !== null) {
    const bad = [];
    if (!adv || typeof adv !== "object") bad.push("entry is not an object");
    else {
      if (typeof floor !== "number") bad.push("lane has no floor to hold");
      if (adv.floorHeldAt !== floor) bad.push(`floorHeldAt ${adv.floorHeldAt} != floors.${lane} ${floor} — the floor moved without revisiting this entry`);
      if (typeof adv.headlessPassesMeasured !== "number") bad.push("headlessPassesMeasured must be a number");
      if (typeof adv.reason !== "string" || adv.reason.trim() === "") bad.push("reason must be a non-empty string");
      if (typeof adv.since !== "string") bad.push("since must be a date string");
    }
    if (bad.length > 0) {
      errors.push(`${lane}: RATCHET.json advisory.${lane} is invalid — ${bad.join("; ")}`);
    }
  }
  if (scored === 0) {
    const reasons = [...skipReasons.entries()].map(([r, n]) => `${r}×${n}`).join(", ");
    warns.push(`${lane}: all ${files.length} cards are named skips (${reasons}) — lane unreachable headlessly, floor not enforced`);
  } else if (typeof floor === "number" && passed < floor) {
    if (adv && typeof adv === "object" && typeof adv.headlessPassesMeasured === "number" && adv.floorHeldAt === floor) {
      if (passed < adv.headlessPassesMeasured) {
        errors.push(
          `${lane}: headless pass-count ${passed} < ${adv.headlessPassesMeasured} measured when RATCHET advisory.${lane} was recorded (${adv.since}) — a regression, not the held floor`,
        );
      } else {
        warns.push(
          `${lane}: headless pass-count ${passed} < RATCHET floor ${floor} — ADVISORY, not enforced here (RATCHET.json advisory.${lane}, since ${adv.since}; ` +
            `the floor is held by decision and is still enforced on the bridge instrument). ${adv.reason}`,
        );
      }
    } else {
      errors.push(`${lane}: headless pass-count ${passed} < RATCHET floor ${floor}`);
    }
  } else if (adv !== null) {
    // The lane meets its floor: the advisory has nothing left to excuse and
    // must not linger as a standing licence to fall back below it.
    errors.push(
      `${lane}: headless pass-count ${passed} >= RATCHET floor ${floor} but RATCHET.json still carries advisory.${lane} — the entry is STALE; delete it so the floor is enforced again`,
    );
  } else {
    console.log(`✔ ${lane}: ${passed} headless passes (floor ${typeof floor === "number" ? floor : "none"}, ${scored} scored / ${files.length} cards)`);
  }
}

for (const w of warns) console.warn(`⚠ ${w}`);
for (const e of errors) console.error(`✖ ${e}`);
console.log(
  `visual-truth:check — ${checkedCards} scorecards checked, ${errors.length} error(s), ${warns.length} warning(s)`,
);
process.exit(errors.length > 0 ? 1 : 0);
