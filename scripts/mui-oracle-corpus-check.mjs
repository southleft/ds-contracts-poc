/**
 * Wave 2 — freeze gate for the MUI golden corpus.
 *
 * Ensures corpus.json is well-formed, disposition sidecars exist for every
 * member, negative-control SpeedDial is UNSUPPORTED, and any pending-seed
 * member cannot be treated as a silent green pass.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORACLE = path.join(ROOT, "examples", "mui", "oracle");
const ALLOWED = new Set([
  "CARRIED",
  "LOWERED",
  "REFUSED",
  "UNSUPPORTED",
  "LEDGERED",
]);

const corpus = JSON.parse(
  readFileSync(path.join(ORACLE, "corpus.json"), "utf8"),
);
const errors = [];

if (corpus.authoredBeforeOracle !== true) {
  errors.push("corpus.authoredBeforeOracle must be true");
}
if (!Array.isArray(corpus.components) || corpus.components.length < 12) {
  errors.push("corpus must list at least 12 stratified components");
}

const stems = new Set();
for (const c of corpus.components) {
  if (!c.id || !c.stem || !Array.isArray(c.stratum)) {
    errors.push(`component missing id/stem/stratum: ${JSON.stringify(c)}`);
    continue;
  }
  if (stems.has(c.stem)) errors.push(`duplicate stem ${c.stem}`);
  stems.add(c.stem);
  const dispPath = path.join(ORACLE, "dispositions", `${c.stem}.json`);
  if (!existsSync(dispPath)) {
    errors.push(`missing disposition sidecar for ${c.stem}`);
    continue;
  }
  const disp = JSON.parse(readFileSync(dispPath, "utf8"));
  if (disp.componentId !== c.id) {
    errors.push(`${c.stem}: disposition componentId mismatch`);
  }
  if (!Array.isArray(disp.facts) || disp.facts.length === 0) {
    errors.push(`${c.stem}: disposition facts[] required`);
  }
  for (const fact of disp.facts ?? []) {
    if (!ALLOWED.has(fact.expect)) {
      errors.push(`${c.stem}: illegal expect ${fact.expect}`);
    }
  }
  if (c.status === "negative-control") {
    const unsupported = (disp.facts ?? []).some((f) => f.expect === "UNSUPPORTED");
    if (!unsupported) {
      errors.push(`${c.stem}: negative-control must declare UNSUPPORTED`);
    }
  }
  if (c.status === "pending-seed") {
    const blocker = (disp.facts ?? []).some(
      (f) =>
        f.expect === "UNSUPPORTED" &&
        String(f.expectName ?? "").includes("pending-seed"),
    );
    if (!blocker) {
      errors.push(
        `${c.stem}: pending-seed must UNSUPPORTED with pending-seed expectName (no silent green)`,
      );
    }
  }
}

if (!stems.has("speed-dial") || !stems.has("text-field")) {
  errors.push("corpus must include speed-dial (negative) and text-field (nested gap)");
}

const dispFiles = existsSync(path.join(ORACLE, "dispositions"))
  ? readdirSync(path.join(ORACLE, "dispositions")).filter((f) =>
      f.endsWith(".json"),
    )
  : [];
for (const f of dispFiles) {
  const stem = f.replace(/\.json$/, "");
  if (!stems.has(stem)) {
    errors.push(`orphan disposition ${f} not listed in corpus`);
  }
}

if (!existsSync(path.join(ORACLE, "EXPECTED.md"))) {
  errors.push("EXPECTED.md missing");
}

if (errors.length) {
  console.error("✖ mui-oracle-corpus-check:\n" + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log(
  `✔ mui-oracle-corpus-check: ${corpus.components.length} components, ${dispFiles.length} disposition sidecars, negative-control pinned`,
);
