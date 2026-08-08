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
    if (scorecardPasses(sc)) passed += 1;
  }

  const floor = floors[lane];
  if (scored === 0) {
    const reasons = [...skipReasons.entries()].map(([r, n]) => `${r}×${n}`).join(", ");
    warns.push(`${lane}: all ${files.length} cards are named skips (${reasons}) — lane unreachable headlessly, floor not enforced`);
  } else if (typeof floor === "number" && passed < floor) {
    errors.push(`${lane}: headless pass-count ${passed} < RATCHET floor ${floor}`);
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
