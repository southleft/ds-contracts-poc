/**
 * Fail-closed gate for Console MCP contract→Figma loop receipts.
 *
 * Requires parity/receipts/console-loop/components/<stem>.json with
 * status:completed, generate.ok, visual.ok, zero roundtrip mismatches,
 * and a sibling .md that mentions the fileKey + v6 fingerprint.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "parity/receipts/console-loop/components");
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
  if (receipt.visual?.ok !== true) {
    errors.push(`${stem}: visual.ok must be true`);
  }
  if (Array.isArray(receipt.visual?.defects) && receipt.visual.defects.length) {
    errors.push(`${stem}: visual.defects must be empty`);
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

if (errors.length) {
  console.error(
    "✖ console-loop-evidence-check:\n" + errors.map((e) => `  - ${e}`).join("\n"),
  );
  process.exit(1);
}

console.log(
  `✔ console-loop-evidence-check: ${REQUIRED.length} required ok (${REQUIRED.join(", ")}); ${completed.length} completed receipt(s) on ${FILE_KEY}`,
);
