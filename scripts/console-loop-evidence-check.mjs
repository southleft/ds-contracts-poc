/**
 * Fail-closed gate for Console MCP contract→Figma loop receipts (FIRST-PARTY
 * lane — attested-only allowed).
 *
 * Requires parity/receipts/console-loop/components/<stem>.json with
 * status:completed, generate.ok, zero roundtrip mismatches, and a sibling .md
 * that mentions the fileKey + v6 fingerprint.
 *
 * EVIDENCE SEMANTICS (first-party lane — contrast with the foreign-lib gate
 * console-loop-lib-evidence-check.mjs, which is STRICT):
 *
 *   - First-party receipts have NO pixel scorecards yet. A visual pass-claim
 *     (visual.ok:true / visual.matchDeveloped:true) WITHOUT a scorecard is
 *     "attested-only": legal for now, but counted and printed loudly. The
 *     owner will pixel-score these in a later job; once a scorecard exists at
 *     parity/receipts/console-loop/scores/<stem>.json the claim is enforced
 *     strictly against the one bar (pctAAMasked <= 5 AND compositionOk) plus
 *     sha256 pins, exactly like foreign lanes.
 *   - Honest fail-closed (no pass-claims + non-empty named visual.defects)
 *     is legal and does not fail CI.
 *   - RATCHET.json floor for lane "first-party" must hold.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
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
const DIR = path.join(ROOT, "parity/receipts/console-loop/components");
const SCORES_DIR = path.join(ROOT, "parity/receipts/console-loop/scores");
const FILE_KEY = "GnQnjSNBXtgtd2Ht0Hs1C8";

/**
 * Required completed receipts — every first-party contract except
 * figmaRepresentation:native (inline, stack). Override with
 * CONSOLE_LOOP_REQUIRED=a,b,c.
 */
const DEFAULT_REQUIRED = [
  "accordion-item",
  "avatar",
  "avatar-group",
  "badge",
  "banner",
  "blockquote",
  "breadcrumb-item",
  "breadcrumbs",
  "button",
  "card",
  "chat-message",
  "chat-message-metadata",
  "chat-system-message",
  "checkbox",
  "citation",
  "code",
  "divider",
  "empty-state",
  "field",
  "heading",
  "icon-button",
  "kbd",
  "list",
  "list-item",
  "metadata-list",
  "metadata-list-item",
  "pagination",
  "progress-bar",
  "section",
  "side-nav-item",
  "skeleton",
  "slider",
  "spinner",
  "status-dot",
  "switch",
  "tab",
  "tab-list",
  "table",
  "table-cell",
  "table-header-cell",
  "table-row",
  "text-area",
  "text-field",
  "toast",
  "token",
  "toolbar",
  "top-nav",
  "top-nav-item",
  "typeahead-item",
];
const REQUIRED = (process.env.CONSOLE_LOOP_REQUIRED ?? DEFAULT_REQUIRED.join(","))
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const errors = [];
const attestedOnly = [];
const scoredPass = [];
const failClosed = [];

if (!existsSync(DIR)) {
  console.error("✖ console-loop-evidence-check: missing components/ directory");
  process.exit(1);
}

const present = new Set(
  readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, "")),
);

for (const stem of REQUIRED) {
  if (!present.has(stem)) {
    errors.push(`required receipt missing: ${stem}.json`);
    continue;
  }
  const jsonPath = path.join(DIR, `${stem}.json`);
  const mdPath = path.join(DIR, `${stem}.md`);
  /** @type {Record<string, any>} */
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(jsonPath, "utf8"));
  } catch (e) {
    errors.push(`${stem}: invalid JSON — ${e.message}`);
    continue;
  }
  if (receipt.version !== 1) errors.push(`${stem}: version must be 1`);
  if (receipt.kind !== "console-loop-component") {
    errors.push(`${stem}: kind must be console-loop-component`);
  }
  if (receipt.status !== "completed") {
    errors.push(`${stem}: status must be completed (got ${JSON.stringify(receipt.status)})`);
  }
  if (receipt.fileKey !== FILE_KEY) {
    errors.push(`${stem}: fileKey must be ${FILE_KEY}`);
  }
  if (receipt.component !== stem) {
    errors.push(`${stem}: component field must match filename stem`);
  }
  if (!receipt.generate?.ok || !receipt.generate?.nodeId) {
    errors.push(`${stem}: generate.ok + nodeId required`);
  }
  // --- visual evidence: scorecard-enforced when present, attested-only otherwise ---
  const claims = visualClaimsPass(receipt);
  const defects = Array.isArray(receipt.visual?.defects) ? receipt.visual.defects : [];
  const sc = readScorecard(SCORES_DIR, stem);
  if (claims) {
    if (defects.length) {
      errors.push(`${stem}: visual pass-claim with non-empty visual.defects — contradiction`);
    }
    if (sc && sc.data) {
      // Scorecard exists → enforce strictly, exactly like foreign lanes.
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
    // Honest fail-closed: legal, counted, printed — not a gate failure.
    if (!defects.length) {
      errors.push(`${stem}: fail-closed receipt must name defects (visual.defects non-empty)`);
    }
    failClosed.push(stem);
  }
  const fp = receipt.fingerprint?.v6;
  if (typeof fp !== "string" || !fp.startsWith("v6:")) {
    errors.push(`${stem}: fingerprint.v6 must be a v6: stamp`);
  }
  if (!Array.isArray(receipt.roundtrip?.mismatches)) {
    errors.push(`${stem}: roundtrip.mismatches array required`);
  } else if (receipt.roundtrip.mismatches.length) {
    errors.push(
      `${stem}: roundtrip mismatches: ${receipt.roundtrip.mismatches.join("; ")}`,
    );
  }
  if (
    !receipt.acceptance?.generated ||
    !receipt.acceptance?.screenshotReviewed ||
    !receipt.acceptance?.zeroMismatch
  ) {
    errors.push(`${stem}: acceptance flags generated/screenshotReviewed/zeroMismatch must be true`);
  }
  if (!existsSync(mdPath)) {
    errors.push(`${stem}: narrative markdown missing`);
  } else {
    const md = readFileSync(mdPath, "utf8");
    if (!md.includes(FILE_KEY)) errors.push(`${stem}: markdown must mention fileKey`);
    if (fp && !md.includes(fp)) errors.push(`${stem}: markdown must mention fingerprint`);
  }
}

const completed = [...present].filter((stem) => {
  try {
    const r = JSON.parse(readFileSync(path.join(DIR, `${stem}.json`), "utf8"));
    return r.status === "completed" && r.acceptance?.zeroMismatch;
  } catch {
    return false;
  }
});

// --- pass-count ratchet (lane "first-party") ---
const { passed: genuinePasses } = countScorecardPasses(SCORES_DIR);
errors.push(...ratchetErrors(ROOT, "first-party", genuinePasses.length));

if (errors.length) {
  console.error(
    "✖ console-loop-evidence-check:\n" + errors.map((e) => `  - ${e}`).join("\n"),
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
  console.log(`  fail-closed first-party/${stem} (named defects; visual hill-climb open)`);
}
console.log(
  `✔ console-loop-evidence-check: ${REQUIRED.length} required ok; ${completed.length} completed receipt(s) on ${FILE_KEY} — ${scoredPass.length} scored-pass, ${attestedOnly.length} attested-only, ${failClosed.length} fail-closed; scorecard passes ${genuinePasses.length} hold ratchet floor`,
);
