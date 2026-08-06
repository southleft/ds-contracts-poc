/**
 * Wave 2 — validate MUI oracle live-Figma session receipts when present.
 *
 * - No completed receipts (missing or status: "template") → exit 0 with
 *   "no live receipts yet" (do not fail the suite empty).
 * - Completed / in-progress receipts → schema checks.
 * - FAIL if agreement is claimed while a liveOnlyDefect lacks
 *   headlessReproduction (fixes require a headless repro path first).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIVE = path.join(ROOT, "examples", "mui", "oracle", "live");
const CORPUS = path.join(ROOT, "examples", "mui", "oracle", "corpus.json");

const REQUIRED_STEPS = [
  "emit-apply",
  "dump-readback",
  "controlled-edit",
  "detect-drift",
  "restore",
  "compare-offline",
];

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

const errors = [];
const warnings = [];

if (!existsSync(CORPUS)) {
  console.error("✖ mui-oracle-live-receipt-check: corpus.json missing");
  process.exit(1);
}

const corpus = readJson(CORPUS);
const minimum = Array.isArray(corpus.liveSessionMinimum)
  ? corpus.liveSessionMinimum
  : [];
if (minimum.length === 0) {
  errors.push("corpus.liveSessionMinimum must list stems");
}

const expected = new Set(minimum.length ? minimum : ["button", "switch", "table"]);

/** @type {{ stem: string, path: string, receipt: Record<string, unknown> }[]} */
const loaded = [];

for (const stem of expected) {
  const receiptPath = path.join(LIVE, stem, "receipt.json");
  if (!existsSync(receiptPath)) {
    // Scaffold may omit machine receipt; treat as empty for this stem.
    continue;
  }
  let receipt;
  try {
    receipt = readJson(receiptPath);
  } catch (e) {
    errors.push(`${stem}: receipt.json is not valid JSON — ${e.message}`);
    continue;
  }
  loaded.push({ stem, path: receiptPath, receipt });
}

const actionable = loaded.filter((row) => row.receipt.status !== "template");

if (actionable.length === 0) {
  const scaffoldNote =
    loaded.length > 0
      ? ` (${loaded.length} template scaffold(s) under examples/mui/oracle/live/)`
      : "";
  console.log(
    `✔ mui-oracle-live-receipt-check: no live receipts yet${scaffoldNote}`,
  );
  process.exit(0);
}

for (const { stem, receipt } of actionable) {
  const label = stem;

  if (receipt.version !== 1) {
    errors.push(`${label}: version must be 1`);
  }
  if (receipt.stem !== stem) {
    errors.push(`${label}: stem field must equal directory name (${stem})`);
  }
  if (!expected.has(stem)) {
    errors.push(`${label}: stem not in corpus.liveSessionMinimum`);
  }
  if (!["in-progress", "completed"].includes(receipt.status)) {
    errors.push(
      `${label}: status must be in-progress|completed (got ${JSON.stringify(receipt.status)})`,
    );
  }

  const session = receipt.session;
  if (!session || typeof session !== "object") {
    errors.push(`${label}: session object required when status ≠ template`);
  } else if (
    typeof session.fileKey !== "string" ||
    session.fileKey.trim() === ""
  ) {
    errors.push(`${label}: session.fileKey required (REDACTED ok)`);
  }

  const steps = Array.isArray(receipt.stepsCompleted)
    ? receipt.stepsCompleted
    : null;
  if (!steps) {
    errors.push(`${label}: stepsCompleted[] required`);
  } else {
    for (const step of steps) {
      if (!REQUIRED_STEPS.includes(step)) {
        errors.push(`${label}: unknown step ${JSON.stringify(step)}`);
      }
    }
    if (receipt.status === "completed") {
      for (const need of REQUIRED_STEPS) {
        if (!steps.includes(need)) {
          errors.push(`${label}: completed receipt missing step ${need}`);
        }
      }
    }
  }

  const ovl = receipt.offlineVsLive;
  if (!ovl || typeof ovl !== "object") {
    errors.push(`${label}: offlineVsLive object required`);
  } else if (receipt.status === "completed") {
    if (typeof ovl.agreement !== "boolean") {
      errors.push(
        `${label}: completed receipt requires offlineVsLive.agreement boolean`,
      );
    }
  }

  const defects = Array.isArray(receipt.liveOnlyDefects)
    ? receipt.liveOnlyDefects
    : null;
  if (defects === null) {
    errors.push(`${label}: liveOnlyDefects[] required (may be empty)`);
  } else {
    for (const [i, defect] of defects.entries()) {
      if (!defect || typeof defect !== "object") {
        errors.push(`${label}: liveOnlyDefects[${i}] must be an object`);
        continue;
      }
      if (!defect.id || !defect.summary) {
        errors.push(`${label}: liveOnlyDefects[${i}] needs id + summary`);
      }
      const hasRepro =
        typeof defect.headlessReproduction === "string" &&
        defect.headlessReproduction.trim().length > 0;
      if (!hasRepro) {
        // Always warn; hard-fail when agreement is claimed.
        warnings.push(
          `${label}: liveOnlyDefects[${i}] (${defect.id ?? "?"}) missing headlessReproduction`,
        );
        if (ovl && ovl.agreement === true) {
          errors.push(
            `${label}: claims offlineVsLive.agreement=true while liveOnlyDefects[${i}] (${defect.id ?? "?"}) lacks headlessReproduction — live-only bugs need a failing headless path before a fix is accepted`,
          );
        }
      }
    }
  }

  const mdPath = path.join(LIVE, stem, "RECEIPT.md");
  if (!existsSync(mdPath)) {
    warnings.push(`${label}: RECEIPT.md missing (human narrative recommended)`);
  }
}

// Orphan completed receipts outside liveSessionMinimum
if (existsSync(LIVE)) {
  for (const name of readdirSync(LIVE, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    const stem = name.name;
    if (expected.has(stem)) continue;
    const orphan = path.join(LIVE, stem, "receipt.json");
    if (!existsSync(orphan)) continue;
    try {
      const r = readJson(orphan);
      if (r.status && r.status !== "template") {
        errors.push(
          `${stem}: receipt present but stem not in corpus.liveSessionMinimum`,
        );
      }
    } catch {
      errors.push(`${stem}: orphan receipt.json unreadable`);
    }
  }
}

for (const w of warnings) {
  console.warn(`⚠ ${w}`);
}

if (errors.length) {
  console.error(
    "✖ mui-oracle-live-receipt-check:\n" +
      errors.map((e) => `  - ${e}`).join("\n"),
  );
  process.exit(1);
}

console.log(
  `✔ mui-oracle-live-receipt-check: ${actionable.length} live receipt(s) validated (${loaded.length - actionable.length} template(s) ignored)`,
);
