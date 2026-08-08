/**
 * Fail-closed gate for MUI Console MCP loop receipts on MUI Test 1.
 * Requires one completed receipt per DENOMINATOR-50 member (31 stems).
 *
 * EVIDENCE SEMANTICS (MUI lane — attested-only allowed; contrast with the
 * foreign-lib gate console-loop-lib-evidence-check.mjs, which is STRICT):
 *
 *   - MUI receipts have NO pixel scorecards yet. A visual pass-claim
 *     (visual.ok:true / visual.matchDeveloped:true) WITHOUT a scorecard is
 *     "attested-only": legal for now, but counted and printed loudly. The
 *     owner will pixel-score these in a later job; once a scorecard exists at
 *     parity/receipts/console-loop/mui/scores/<stem>.json the claim is
 *     enforced strictly against the one bar (pctAAMasked <= 5 AND
 *     compositionOk) plus sha256 pins, exactly like foreign lanes.
 *   - Honest fail-closed (no pass-claims + non-empty named visual.defects)
 *     is legal and does not fail CI.
 *   - RATCHET.json floor for lane "mui" must hold.
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
const attestedOnly = [];
const scoredPass = [];
const failClosed = [];
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
  // --- visual evidence: scorecard-enforced when present, attested-only otherwise ---
  const claims = visualClaimsPass(receipt);
  const defects = Array.isArray(receipt.visual?.defects) ? receipt.visual.defects : [];
  const sc = readScorecard(SCORES_DIR, stem);
  if (claims) {
    if (defects.length) {
      errors.push(`${stem}: visual pass-claim with non-empty visual.defects — contradiction`);
    }
    if (sc && sc.data) {
      if (!scorecardPasses(sc.data)) {
        const aa = sc.data.metrics?.pctAAMasked;
        errors.push(
          `${stem}: pass-claim contradicts its scorecard (status=${sc.data.status}, pctAAMasked=${typeof aa === "number" ? aa.toFixed(2) : aa}, compositionOk=${sc.data.compositionOk}; bar is pctAAMasked<=${PASS_AA_MASKED} AND compositionOk)`,
        );
      } else {
        for (const e of verifyScorecardPins(ROOT, sc.data)) errors.push(`${stem}: ${e}`);
        scoredPass.push(stem);
      }
    } else if (sc && !sc.data) {
      errors.push(`${stem}: scorecard unreadable — ${sc.error}`);
    } else {
      attestedOnly.push(stem);
    }
  } else {
    if (!defects.length) {
      errors.push(`${stem}: fail-closed receipt must name defects (visual.defects non-empty)`);
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

if (attestedOnly.length) {
  console.log(
    `⚠ ATTESTED-ONLY visual claims (NO pixel scorecard — pending pixel-score job): ${attestedOnly.length}/${REQUIRED.length} stems\n` +
      `  ${attestedOnly.join(", ")}`,
  );
}
for (const stem of failClosed) {
  console.log(`  fail-closed mui/${stem} (named defects; visual hill-climb open)`);
}
console.log(
  `✔ console-loop-mui-evidence-check: ${REQUIRED.length}/${REQUIRED.length} denominator stems ok on ${FILE_KEY} — ${scoredPass.length} scored-pass, ${attestedOnly.length} attested-only, ${failClosed.length} fail-closed; scorecard passes ${genuinePasses.length} hold ratchet floor`,
);
