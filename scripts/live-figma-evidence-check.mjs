/**
 * V1-EVID-04 live half — fail-closed machine receipt gate.
 *
 * Requires parity/receipts/live-figma-variant-drift.json status:completed with
 * baseline → afterEdit (drifted + unbound) → restored (clean, fingerprint match).
 * Offline half remains npm run variant-drift:check.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RECEIPT = path.join(ROOT, "parity/receipts/live-figma-variant-drift.json");
const NARRATIVE = path.join(ROOT, "parity/receipts/live-figma-variant-drift.md");

const errors = [];

if (!existsSync(RECEIPT)) {
  console.error("✖ live-figma-evidence-check: missing live-figma-variant-drift.json");
  process.exit(1);
}
if (!existsSync(NARRATIVE)) {
  errors.push("narrative markdown missing (live-figma-variant-drift.md)");
}

/** @type {Record<string, any>} */
let receipt;
try {
  receipt = JSON.parse(readFileSync(RECEIPT, "utf8"));
} catch (e) {
  console.error(`✖ live-figma-evidence-check: receipt JSON invalid — ${e.message}`);
  process.exit(1);
}

if (receipt.version !== 1) errors.push("version must be 1");
if (receipt.kind !== "live-figma-variant-drift") {
  errors.push('kind must be "live-figma-variant-drift"');
}
if (receipt.status !== "completed") {
  errors.push(`status must be completed (got ${JSON.stringify(receipt.status)})`);
}

const session = receipt.session;
if (!session?.fileKey || !session?.componentId || !session?.labelId) {
  errors.push("session.fileKey, componentId, labelId required");
}

const phases = receipt.phases;
if (!phases?.baseline || !phases?.afterEdit || !phases?.restored) {
  errors.push("phases.baseline, afterEdit, restored required");
} else {
  const { baseline, afterEdit, restored } = phases;
  if (typeof baseline.fingerprint !== "string" || !baseline.fingerprint.startsWith("v6:")) {
    errors.push("baseline.fingerprint must be a v6: stamp");
  }
  if (baseline.paddingLeft !== 8) errors.push("baseline.paddingLeft must be 8");
  if (!baseline.bound) errors.push("baseline.bound required");

  if (afterEdit.drifted !== true) errors.push("afterEdit.drifted must be true");
  if (afterEdit.fingerprint === baseline.fingerprint) {
    errors.push("afterEdit.fingerprint must differ from baseline");
  }
  if (afterEdit.paddingLeft !== 12) errors.push("afterEdit.paddingLeft must be 12");
  if (afterEdit.bound != null) errors.push("afterEdit.bound must be null (detached)");

  if (restored.clean !== true) errors.push("restored.clean must be true");
  if (restored.fingerprint !== baseline.fingerprint) {
    errors.push("restored.fingerprint must equal baseline.fingerprint");
  }
  if (restored.paddingLeft !== 8) errors.push("restored.paddingLeft must be 8");
  if (!restored.bound) errors.push("restored.bound required after rebind");
}

const acceptance = receipt.acceptance;
if (!acceptance?.editDetachedBinding || !acceptance?.editChangedFingerprint || !acceptance?.restoreMatchedBaseline) {
  errors.push("acceptance flags editDetachedBinding, editChangedFingerprint, restoreMatchedBaseline must be true");
}

const md = existsSync(NARRATIVE) ? readFileSync(NARRATIVE, "utf8") : "";
if (md && session?.fileKey && !md.includes(session.fileKey)) {
  errors.push("narrative markdown must mention session.fileKey");
}
if (md && phases?.baseline?.fingerprint && !md.includes(phases.baseline.fingerprint)) {
  errors.push("narrative markdown must mention baseline fingerprint");
}

if (errors.length) {
  console.error(
    "✖ live-figma-evidence-check:\n" + errors.map((e) => `  - ${e}`).join("\n"),
  );
  process.exit(1);
}

console.log(
  `✔ live-figma-evidence-check: completed receipt on ${session.fileKey} — baseline ${phases.baseline.fingerprint} → edit ${phases.afterEdit.fingerprint} → restore ${phases.restored.fingerprint}`,
);
