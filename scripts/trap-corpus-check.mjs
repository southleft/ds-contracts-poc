/**
 * Trap corpus structural / compile-marker gate (code→canvas hill-climb).
 *
 * Validates parity/receipts/console-loop/trap-corpus/manifest.json:
 *   - schema (version, kind, 10 stems with lib/stem/fc/contract/script/reference)
 *   - each stem: contract + figma script exist
 *   - reference PNG exists OR pendingRef: true (warn, not fail)
 *   - committed astryx toast/slider scripts carry Wave A emit markers
 *     (PERCENT lineHeight runtime, fw != null inset fixed-size guard)
 *
 * Does NOT require visual.matchDeveloped or pixel scores.
 *
 * Usage: node scripts/trap-corpus-check.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = path.join(
  ROOT,
  "parity/receipts/console-loop/trap-corpus/manifest.json",
);

const EXPECTED_STEM_COUNT = 10;
const FC_RE = /^FC-[A-Z0-9-]+$/;

/** @type {{ ok: string[], warn: string[], fail: string[] }} */
const summary = { ok: [], warn: [], fail: [] };

function fail(msg) {
  summary.fail.push(msg);
  console.error(`✖ ${msg}`);
}
function warn(msg) {
  summary.warn.push(msg);
  console.warn(`⚠ ${msg}`);
}
function ok(msg) {
  summary.ok.push(msg);
  console.log(`✔ ${msg}`);
}

if (!existsSync(MANIFEST)) {
  console.error(`✖ trap-corpus-check: missing ${path.relative(ROOT, MANIFEST)}`);
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
} catch (e) {
  console.error(`✖ trap-corpus-check: invalid JSON — ${e.message}`);
  process.exit(1);
}

if (manifest.version !== 1) fail(`manifest.version must be 1 (got ${manifest.version})`);
if (manifest.kind !== "code-to-canvas-trap-corpus") {
  fail(`manifest.kind must be code-to-canvas-trap-corpus (got ${manifest.kind})`);
}
if (!Array.isArray(manifest.stems)) {
  fail("manifest.stems must be an array");
  console.error(`\n✖ trap-corpus-check: ${summary.fail.length} hard failure(s)`);
  process.exit(1);
}
if (manifest.stems.length !== EXPECTED_STEM_COUNT) {
  fail(
    `manifest.stems must list ${EXPECTED_STEM_COUNT} stems (got ${manifest.stems.length})`,
  );
}

for (const [i, row] of manifest.stems.entries()) {
  const tag = row?.lib && row?.stem ? `${row.lib}/${row.stem}` : `stems[${i}]`;
  if (!row || typeof row !== "object") {
    fail(`${tag}: row must be an object`);
    continue;
  }
  for (const key of ["lib", "stem", "contract", "script", "reference"]) {
    if (typeof row[key] !== "string" || !row[key].trim()) {
      fail(`${tag}: missing string field "${key}"`);
    }
  }
  if (!Array.isArray(row.fc) || row.fc.length === 0) {
    fail(`${tag}: fc must be a non-empty array of FC-* ids`);
  } else if (!row.fc.every((id) => typeof id === "string" && FC_RE.test(id))) {
    fail(`${tag}: fc ids must match FC-* (${row.fc.join(", ")})`);
  }
  if (typeof row.pendingRef !== "boolean") {
    fail(`${tag}: pendingRef must be boolean`);
  }

  const contractPath = path.join(ROOT, row.contract ?? "");
  const scriptPath = path.join(ROOT, row.script ?? "");
  const refPath = path.join(ROOT, row.reference ?? "");

  if (row.contract && !existsSync(contractPath)) {
    fail(`${tag}: contract missing — ${row.contract}`);
  } else if (row.contract) {
    ok(`${tag}: contract`);
  }

  if (row.script && !existsSync(scriptPath)) {
    fail(`${tag}: figma script missing — ${row.script}`);
  } else if (row.script) {
    ok(`${tag}: script`);
  }

  if (row.reference) {
    if (existsSync(refPath)) {
      if (row.pendingRef) {
        warn(`${tag}: reference exists but pendingRef:true — clear pendingRef`);
      } else {
        ok(`${tag}: reference`);
      }
    } else if (row.pendingRef) {
      warn(`${tag}: pendingRef — ${row.reference}`);
    } else {
      fail(`${tag}: reference missing — ${row.reference}`);
    }
  }
}

// COMPILE-level smoke: committed scripts must carry Wave A engine markers
// (avoid spawning tsx — grepping emitted runtime is enough for CI structure).
const sliderPath = path.join(ROOT, "examples/astryx/figma/slider.figma.js");
const toastPath = path.join(ROOT, "examples/astryx/figma/toast.figma.js");

if (!existsSync(sliderPath)) {
  fail("astryx slider.figma.js missing (FC-ABS-SIZE marker target)");
} else {
  const sliderSrc = readFileSync(sliderPath, "utf8");
  if (!sliderSrc.includes("fw != null")) {
    fail("astryx slider.figma.js missing out-of-flow fixed-size guard (fw != null)");
  } else {
    ok("marker FC-ABS-SIZE fw!=null @ astryx/slider.figma.js");
  }
  // Exact-conversion wave (FC-ABS-SIZE): the slider contract moved its
  // out-of-flow children (rail/track/thumb/tooltip bubble) from inset-0
  // overlay tokens to `position: absolute` facts, so the emitter's
  // conditional-emission discipline now carries applyShapeAbsolute +
  // resizeOutOfFlow instead of applyInsetOverlay (which no slider spec uses
  // any more — forcing it back in would violate the golden discipline).
  // Same structural bar, aimed at the runtime the payload actually calls.
  if (!sliderSrc.includes("function applyShapeAbsolute")) {
    fail("astryx slider.figma.js missing applyShapeAbsolute runtime (FC-ABS-SIZE absolute placement)");
  }
  if (!sliderSrc.includes("function resizeOutOfFlow")) {
    fail("astryx slider.figma.js missing resizeOutOfFlow runtime (out-of-flow sizing pass)");
  }
}

if (!existsSync(toastPath)) {
  fail("astryx toast.figma.js missing (FC-LH-RATIO marker target)");
} else {
  const toastSrc = readFileSync(toastPath, "utf8");
  if (!toastSrc.includes("PERCENT")) {
    fail("astryx toast.figma.js missing PERCENT lineHeight runtime");
  } else if (
    !toastSrc.includes("unit === 'PERCENT'") &&
    !toastSrc.includes('"PERCENT"') &&
    !toastSrc.includes("'PERCENT'")
  ) {
    fail("astryx toast.figma.js PERCENT marker is not a lineHeight unit assignment");
  } else {
    ok("marker FC-LH-RATIO PERCENT @ astryx/toast.figma.js");
  }
  // Optional slot Show=false is the FC-SLOT-DEFAULT emit shape on toast.
  if (
    !toastSrc.includes("'BOOLEAN', false") &&
    !toastSrc.includes('"BOOLEAN", false')
  ) {
    fail("astryx toast.figma.js missing optional-slot Show BOOLEAN false default");
  } else {
    ok("marker FC-SLOT-DEFAULT BOOLEAN false @ astryx/toast.figma.js");
  }
}

console.log("");
console.log(
  `trap-corpus-check: ${summary.ok.length} ok, ${summary.warn.length} warn, ${summary.fail.length} fail`,
);

if (summary.fail.length) {
  console.error(
    `✖ trap-corpus-check:\n` + summary.fail.map((e) => `  - ${e}`).join("\n"),
  );
  process.exit(1);
}

console.log(
  `✔ trap-corpus-check: ${EXPECTED_STEM_COUNT}/${EXPECTED_STEM_COUNT} stems structural ok` +
    (summary.warn.length ? ` (${summary.warn.length} pendingRef/warn)` : ""),
);
process.exit(0);
