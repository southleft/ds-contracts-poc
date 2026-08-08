/**
 * Shared scorecard-evidence helpers for the console-loop gates.
 *
 * THE ONE BAR (hillclimb §4): a stem's visual pass is real iff its pixel
 * scorecard (parity/receipts/console-loop/<lane>/scores/<stem>.json, written
 * by console-loop-developed-score.mjs) has status "pass" AND
 * metrics.pctAAMasked <= 5 AND compositionOk === true.
 *
 * Gates NEVER trust receipt booleans (visual.ok / visual.matchDeveloped) —
 * those are claims that must be backed by a passing scorecard. A receipt with
 * no pass-claim, non-empty visual.defects, and visual.status "fail-closed"
 * (when present) is HONEST FAIL-CLOSED: legal, counted, printed — not a CI
 * failure.
 *
 * RATCHET: parity/receipts/console-loop/RATCHET.json pins per-lane minimum
 * scorecard-passed counts so honesty cannot decay — a lane fails when its
 * genuine scorecard-pass count drops below its committed floor.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export const PASS_AA_MASKED = 5;

export function sha256File(p) {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

/** Read <scoresDir>/<stem>.json; null when absent. */
export function readScorecard(scoresDir, stem) {
  const p = path.join(scoresDir, `${stem}.json`);
  if (!existsSync(p)) return null;
  try {
    return { path: p, data: JSON.parse(readFileSync(p, "utf8")) };
  } catch (e) {
    return { path: p, data: null, error: e.message };
  }
}

/** The one bar, recomputed from the scorecard's own metrics — never from receipt booleans. */
export function scorecardPasses(sc) {
  if (!sc) return false;
  const aa = sc.metrics?.pctAAMasked;
  return (
    sc.status === "pass" &&
    sc.compositionOk === true &&
    typeof aa === "number" &&
    aa <= PASS_AA_MASKED
  );
}

/** True when the receipt claims a visual pass in any form. */
export function visualClaimsPass(receipt) {
  return receipt?.visual?.ok === true || receipt?.visual?.matchDeveloped === true;
}

/**
 * Verify the scorecard's recorded sha256 pins (referenceSha256 /
 * canvasShotSha256) against the PNGs on disk. Only files that still exist are
 * verified; a pin that is missing while the file exists is an error (re-run
 * the scorer to pin it).
 */
export function verifyScorecardPins(root, sc) {
  const errs = [];
  for (const [fileField, hashField] of [
    ["reference", "referenceSha256"],
    ["canvasShot", "canvasShotSha256"],
  ]) {
    const rel = sc[fileField];
    if (typeof rel !== "string" || !rel) continue;
    const abs = path.isAbsolute(rel) ? rel : path.join(root, rel);
    if (!existsSync(abs)) continue; // file gone: nothing on disk to verify against
    const recorded = sc[hashField];
    if (typeof recorded !== "string" || !recorded) {
      errs.push(
        `${hashField} missing — re-run console-loop-developed-score to pin ${fileField}`,
      );
      continue;
    }
    const actual = sha256File(abs);
    if (actual !== recorded) {
      errs.push(
        `${hashField} mismatch: recorded ${recorded.slice(0, 12)}… but ${rel} on disk hashes ${actual.slice(0, 12)}…`,
      );
    }
  }
  return errs;
}

/** Count scorecards under scoresDir that genuinely pass the one bar. */
export function countScorecardPasses(scoresDir) {
  if (!existsSync(scoresDir)) return { passed: [], total: 0 };
  const passed = [];
  let total = 0;
  for (const f of readdirSync(scoresDir)) {
    if (!f.endsWith(".json")) continue;
    total += 1;
    try {
      const sc = JSON.parse(readFileSync(path.join(scoresDir, f), "utf8"));
      if (scorecardPasses(sc)) passed.push(f.replace(/\.json$/, ""));
    } catch {
      /* unparseable scorecard never counts as a pass */
    }
  }
  return { passed: passed.sort(), total };
}

export function loadRatchet(root) {
  const p = path.join(root, "parity/receipts/console-loop/RATCHET.json");
  if (!existsSync(p)) return { path: p, data: null };
  try {
    return { path: p, data: JSON.parse(readFileSync(p, "utf8")) };
  } catch {
    return { path: p, data: null };
  }
}

/** Ratchet: fail when the lane's scorecard-passed count drops below its committed floor. */
export function ratchetErrors(root, laneKey, passedCount) {
  const { path: p, data } = loadRatchet(root);
  if (!data) {
    return [
      `missing/invalid ${path.relative(root, p)} — the pass-count ratchet file is required`,
    ];
  }
  const floor = data.floors?.[laneKey];
  if (typeof floor !== "number") {
    return [`RATCHET.json has no floor for lane "${laneKey}"`];
  }
  if (passedCount < floor) {
    return [
      `ratchet violated: ${laneKey} scorecard-passed count ${passedCount} < committed floor ${floor}`,
    ];
  }
  return [];
}
