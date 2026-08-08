/**
 * Generic Console MCP loop gate for a foreign library corpus — STRICT
 * scorecard lane.
 *
 * Usage:
 *   node scripts/console-loop-lib-evidence-check.mjs <libId>
 *
 * Expects:
 *   parity/receipts/console-loop/<libId>/manifest.json
 *   {
 *     "fileKey": "...",
 *     "kind": "console-loop-<libId>-component",
 *     "required": ["stem", ...]
 *   }
 *   parity/receipts/console-loop/<libId>/components/<stem>.json + .md
 *   parity/receipts/console-loop/<libId>/scores/<stem>.json  (pixel scorecards)
 *
 * EVIDENCE SEMANTICS (foreign lanes are STRICT — contrast with the
 * first-party/MUI gates, which allow "attested-only" pass-claims because
 * those corpora have no pixel scorecards yet):
 *
 *   1. The gate reads scorecards, never receipt booleans. A receipt may claim
 *      a visual pass (visual.ok:true or visual.matchDeveloped:true) ONLY if
 *      scores/<stem>.json passes the one bar: status "pass" AND
 *      metrics.pctAAMasked <= 5 AND compositionOk. Any pass-claim without a
 *      passing scorecard fails the gate, naming the stem.
 *   2. Honest fail-closed is legal and does NOT fail CI: no pass-claims,
 *      non-empty visual.defects (named), visual.status "fail-closed" when
 *      present. Counted and printed.
 *   3. Scorecard sha256 pins (referenceSha256 / canvasShotSha256) are
 *      verified against the PNGs on disk for every pass-claim.
 *   4. Passes that relied on the scorer's framingTolerant relaxation are
 *      surfaced loudly (scorecard.reliedOnFramingTolerant).
 *   5. RATCHET.json floors: the lane fails if its scorecard-passed count
 *      drops below the committed per-lib floor (honesty cannot decay).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PASS_AA_MASKED,
  countScorecardPasses,
  ratchetErrors,
  readScorecard,
  scorecardPasses,
  verifyScorecardPins,
  visualClaimsPass,
} from "./console-loop-scorecard-lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const libId = process.argv[2];
if (!libId) {
  console.error("usage: console-loop-lib-evidence-check.mjs <libId>");
  process.exit(2);
}

const base = path.join(ROOT, "parity/receipts/console-loop", libId);
const manifestPath = path.join(base, "manifest.json");
const dir = path.join(base, "components");
const scoresDir = path.join(base, "scores");

if (!existsSync(manifestPath)) {
  console.error(`✖ console-loop-${libId}: missing manifest.json`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const FILE_KEY = manifest.fileKey;
const KIND = manifest.kind ?? `console-loop-${libId}-component`;
const REQUIRED = (
  process.env.CONSOLE_LOOP_LIB_REQUIRED ?? (manifest.required ?? []).join(",")
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!FILE_KEY || !REQUIRED.length) {
  console.error(`✖ console-loop-${libId}: manifest needs fileKey + required[]`);
  process.exit(1);
}

const errors = [];
if (!existsSync(dir)) {
  console.error(`✖ console-loop-${libId}: missing components/`);
  process.exit(1);
}

const scoredPass = [];
const failClosed = [];
const framingTolerantPasses = [];

for (const stem of REQUIRED) {
  const jsonPath = path.join(dir, `${stem}.json`);
  const mdPath = path.join(dir, `${stem}.md`);
  if (!existsSync(jsonPath)) {
    errors.push(`required receipt missing: ${stem}.json`);
    continue;
  }
  /** @type {Record<string, any>} */
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(jsonPath, "utf8"));
  } catch (e) {
    errors.push(`${stem}: invalid JSON — ${e.message}`);
    continue;
  }
  if (receipt.version !== 1) errors.push(`${stem}: version must be 1`);
  if (receipt.kind !== KIND) errors.push(`${stem}: kind must be ${KIND}`);
  if (receipt.status !== "completed") errors.push(`${stem}: status must be completed`);
  if (receipt.fileKey !== FILE_KEY) errors.push(`${stem}: fileKey must be ${FILE_KEY}`);
  if (receipt.component !== stem) errors.push(`${stem}: component must match stem`);

  // --- visual evidence: the scorecard is the only source of truth ---
  const claims = visualClaimsPass(receipt);
  const defects = Array.isArray(receipt.visual?.defects) ? receipt.visual.defects : [];
  const sc = readScorecard(scoresDir, stem);
  if (claims) {
    if (!sc) {
      errors.push(
        `${stem}: visual pass-claim without pixel scorecard (scores/${stem}.json missing) — foreign lanes are strict`,
      );
    } else if (!sc.data) {
      errors.push(`${stem}: scorecard unreadable — ${sc.error}`);
    } else if (!scorecardPasses(sc.data)) {
      const aa = sc.data.metrics?.pctAAMasked;
      errors.push(
        `${stem}: pass-claim contradicts its scorecard (status=${sc.data.status}, pctAAMasked=${typeof aa === "number" ? aa.toFixed(2) : aa}, compositionOk=${sc.data.compositionOk}; bar is pctAAMasked<=${PASS_AA_MASKED} AND compositionOk)`,
      );
    } else {
      for (const e of verifyScorecardPins(ROOT, sc.data)) errors.push(`${stem}: ${e}`);
      if (defects.length) {
        errors.push(`${stem}: pass-claim with non-empty visual.defects — contradiction`);
      }
      if (receipt.visual?.status && receipt.visual.status !== "scored-pass") {
        errors.push(`${stem}: pass-claim but visual.status=${receipt.visual.status}`);
      }
      if (receipt.acceptance?.visualMatchDeveloped !== true) {
        errors.push(`${stem}: scored pass requires acceptance.visualMatchDeveloped:true`);
      }
      scoredPass.push(stem);
      if (sc.data.reliedOnFramingTolerant === true) framingTolerantPasses.push(stem);
    }
  } else {
    // Honest fail-closed: legal, counted, printed — never a gate failure.
    if (!defects.length) {
      errors.push(`${stem}: fail-closed receipt must name defects (visual.defects non-empty)`);
    }
    if (receipt.visual?.status && receipt.visual.status !== "fail-closed") {
      errors.push(`${stem}: no pass-claim but visual.status=${receipt.visual.status}`);
    }
    if (receipt.acceptance?.visualMatchDeveloped === true) {
      errors.push(`${stem}: fail-closed receipt claims acceptance.visualMatchDeveloped`);
    }
    failClosed.push(stem);
  }

  const fp = receipt.fingerprint?.v6;
  if (typeof fp !== "string" || !fp.startsWith("v6:")) {
    errors.push(`${stem}: fingerprint.v6 required`);
  }
  if (!Array.isArray(receipt.roundtrip?.mismatches)) {
    errors.push(`${stem}: roundtrip.mismatches required`);
  } else if (receipt.roundtrip.mismatches.length) {
    errors.push(`${stem}: mismatches: ${receipt.roundtrip.mismatches.join("; ")}`);
  }
  if (!receipt.acceptance?.screenshotReviewed || !receipt.acceptance?.zeroMismatch) {
    errors.push(`${stem}: acceptance flags required (screenshotReviewed, zeroMismatch)`);
  }
  if (!existsSync(mdPath)) {
    errors.push(`${stem}: markdown missing`);
  } else {
    const md = readFileSync(mdPath, "utf8");
    if (!md.includes(FILE_KEY)) errors.push(`${stem}: markdown must mention fileKey`);
    if (fp && !md.includes(fp)) errors.push(`${stem}: markdown must mention fingerprint`);
  }
}

// --- pass-count ratchet: honesty cannot decay ---
const { passed: genuinePasses } = countScorecardPasses(scoresDir);
errors.push(...ratchetErrors(ROOT, libId, genuinePasses.length));

if (errors.length) {
  console.error(
    `✖ console-loop-${libId}-evidence-check:\n` + errors.map((e) => `  - ${e}`).join("\n"),
  );
  process.exit(1);
}

for (const stem of failClosed) {
  console.log(`  fail-closed ${libId}/${stem} (named defects; visual hill-climb open)`);
}
for (const stem of framingTolerantPasses) {
  console.log(`  ⚠ ${libId}/${stem}: pass relied on framingTolerant relaxation (see scorecard)`);
}
console.log(
  `✔ console-loop-${libId}-evidence-check: ${REQUIRED.length}/${REQUIRED.length} stems ok on ${FILE_KEY} — ${scoredPass.length} scored-pass${scoredPass.length ? ` (${scoredPass.join(", ")})` : ""}, ${failClosed.length} fail-closed; scorecard passes ${genuinePasses.length} hold ratchet floor`,
);
