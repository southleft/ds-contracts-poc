/**
 * Fail-closed gate for MUI Console MCP loop receipts on MUI Test 1.
 * Requires one completed receipt per DENOMINATOR-50 member (31 stems).
 *
 * EVIDENCE SEMANTICS (MUI lane — STRICT, same bar as the foreign-lib gate
 * console-loop-lib-evidence-check.mjs):
 *
 *   TRANSITION 2026-08-08 — this lane was "attested-only" while MUI had no
 *   pixel scorecards: a visual pass-claim (visual.ok / visual.matchDeveloped)
 *   without a scorecard was legal, counted, and printed loudly. That grace
 *   period is OVER: every DENOMINATOR stem now carries a pixel scorecard at
 *   parity/receipts/console-loop/mui/scores/<stem>.json (headless REST cell
 *   render at scale 1 vs the committed developed reference under mui/refs/,
 *   scored by console-loop-developed-score under the ONE bar), so the gate
 *   enforces scorecards unconditionally:
 *
 *   1. The gate reads scorecards, never receipt booleans. A receipt may claim
 *      a visual pass ONLY if scores/<stem>.json passes the one bar: status
 *      "pass" AND metrics.pctAAMasked <= 5 AND compositionOk. A pass-claim
 *      without a passing scorecard fails the gate, naming the stem.
 *   2. Honest fail-closed is legal and does NOT fail CI: no pass-claims,
 *      non-empty visual.defects (named, FC-classified), visual.status
 *      "fail-closed" when present. Counted and printed.
 *   3. Scorecard sha256 pins (referenceSha256 / canvasShotSha256) are
 *      verified against the PNGs on disk for every pass-claim.
 *   4. Passes that relied on the scorer's framingTolerant relaxation are
 *      surfaced loudly (scorecard.reliedOnFramingTolerant).
 *   5. RATCHET.json floor for lane "mui" must hold (seeded from the genuine
 *      scorecard passes the day the lane went strict).
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
const DIR = path.join(ROOT, "parity/receipts/console-loop/mui/components");
const SCORES_DIR = path.join(ROOT, "parity/receipts/console-loop/mui/scores");
const DENOM = path.join(ROOT, "examples/mui/oracle/DENOMINATOR-50.json");
const FILE_KEY = "59mLQlOMiD5w5za6SUcoO5";

const denom = JSON.parse(readFileSync(DENOM, "utf8"));
const REQUIRED = (
  process.env.CONSOLE_LOOP_MUI_REQUIRED ??
  denom.members.map((m) => m.stem).join(",")
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const errors = [];
const scoredPass = [];
const failClosed = [];
const framingTolerantPasses = [];
if (!existsSync(DIR)) {
  console.error("✖ console-loop-mui-evidence-check: missing mui/components/");
  process.exit(1);
}

for (const stem of REQUIRED) {
  const jsonPath = path.join(DIR, `${stem}.json`);
  const mdPath = path.join(DIR, `${stem}.md`);
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
  if (receipt.kind !== "console-loop-mui-component") {
    errors.push(`${stem}: kind must be console-loop-mui-component`);
  }
  if (receipt.status !== "completed") {
    errors.push(`${stem}: status must be completed`);
  }
  if (receipt.fileKey !== FILE_KEY) {
    errors.push(`${stem}: fileKey must be ${FILE_KEY}`);
  }
  if (receipt.component !== stem) {
    errors.push(`${stem}: component field must match stem`);
  }
  if (!receipt.generate?.ok) errors.push(`${stem}: generate.ok required`);
  // Present-on-canvas receipting may set generated=false but ok=true via inspect
  // --- visual evidence: the scorecard is the only source of truth (STRICT) ---
  const claims = visualClaimsPass(receipt);
  const defects = Array.isArray(receipt.visual?.defects) ? receipt.visual.defects : [];
  const sc = readScorecard(SCORES_DIR, stem);
  if (claims) {
    if (!sc) {
      errors.push(
        `${stem}: visual pass-claim without pixel scorecard (scores/${stem}.json missing) — the MUI lane is strict since 2026-08-08`,
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
    errors.push(`${stem}: roundtrip.mismatches array required`);
  } else if (receipt.roundtrip.mismatches.length) {
    errors.push(`${stem}: mismatches: ${receipt.roundtrip.mismatches.join("; ")}`);
  }
  if (
    !receipt.acceptance?.screenshotReviewed ||
    !receipt.acceptance?.zeroMismatch
  ) {
    errors.push(`${stem}: acceptance screenshotReviewed/zeroMismatch must be true`);
  }
  if (!existsSync(mdPath)) {
    errors.push(`${stem}: narrative markdown missing`);
  } else {
    const md = readFileSync(mdPath, "utf8");
    if (!md.includes(FILE_KEY)) errors.push(`${stem}: markdown must mention fileKey`);
    if (fp && !md.includes(fp)) errors.push(`${stem}: markdown must mention fingerprint`);
  }
}

// --- pass-count ratchet (lane "mui") ---
const { passed: genuinePasses } = countScorecardPasses(SCORES_DIR);
errors.push(...ratchetErrors(ROOT, "mui", genuinePasses.length));

if (errors.length) {
  console.error(
    "✖ console-loop-mui-evidence-check:\n" + errors.map((e) => `  - ${e}`).join("\n"),
  );
  process.exit(1);
}

for (const stem of failClosed) {
  console.log(`  fail-closed mui/${stem} (named defects; visual hill-climb open)`);
}
for (const stem of framingTolerantPasses) {
  console.log(`  ⚠ mui/${stem}: pass relied on framingTolerant relaxation (see scorecard)`);
}
console.log(
  `✔ console-loop-mui-evidence-check: ${REQUIRED.length}/${REQUIRED.length} denominator stems ok on ${FILE_KEY} — ${scoredPass.length} scored-pass${scoredPass.length ? ` (${scoredPass.join(", ")})` : ""}, ${failClosed.length} fail-closed; scorecard passes ${genuinePasses.length} hold ratchet floor`,
);
