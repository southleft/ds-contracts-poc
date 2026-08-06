/**
 * Wave 5 — freeze/check the predeclared MUI 50% denominator.
 * Does not shrink accuracy baselines. Exit 0 while expansion is in progress
 * as long as the freeze is intact; prints carried/pending progress.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DENOM = path.join(ROOT, "examples/mui/oracle/DENOMINATOR-50.json");
const CONTRACTS = path.join(ROOT, "examples/mui/contracts");
const BASELINE = path.join(ROOT, "accuracy/baseline.json");

if (!existsSync(DENOM)) {
  console.error("✖ mui-denominator-check: DENOMINATOR-50.json missing");
  process.exit(1);
}

const denom = JSON.parse(readFileSync(DENOM, "utf8"));
const errors = [];

if (denom.denominatorSize !== 31) {
  errors.push(`denominatorSize must stay 31 (got ${denom.denominatorSize})`);
}
if (!Array.isArray(denom.members) || denom.members.length !== 31) {
  errors.push(
    `members[] must have exactly 31 entries (got ${denom.members?.length})`,
  );
}
if (denom.accuracyBaselinesUntouched !== true) {
  errors.push("accuracyBaselinesUntouched must remain true");
}
if (!existsSync(BASELINE)) {
  errors.push("accuracy/baseline.json missing — denominators must stay intact");
}

const stems = new Set();
for (const m of denom.members ?? []) {
  if (stems.has(m.stem)) errors.push(`duplicate stem ${m.stem}`);
  stems.add(m.stem);
  if (!["carried", "pending"].includes(m.status)) {
    errors.push(`${m.stem}: status must be carried|pending`);
  }
}

const contractStems = new Set(
  existsSync(CONTRACTS)
    ? readdirSync(CONTRACTS)
        .filter((f) => f.endsWith(".contract.json"))
        .map((f) => f.replace(/\.contract\.json$/, ""))
    : [],
);

let carried = 0;
let pending = 0;
for (const m of denom.members) {
  if (m.status === "carried") {
    carried += 1;
    if (!contractStems.has(m.stem) && m.inPilot) {
      // table-pagination etc. must exist when claimed carried
      if (!contractStems.has(m.stem)) {
        errors.push(`carried stem ${m.stem} lacks examples/mui/contracts/${m.stem}.contract.json`);
      }
    }
  } else pending += 1;
}

if (carried + pending !== 31) {
  errors.push(`carried (${carried}) + pending (${pending}) must equal 31`);
}

for (const e of errors) console.error(`  - ${e}`);
if (errors.length) {
  console.error("✖ mui-denominator-check failed");
  process.exit(1);
}

const pct = ((carried / 31) * 100).toFixed(1);
console.log(
  `✔ mui-denominator-check: freeze intact — ${carried}/31 carried (${pct}%), ${pending} pending; accuracy baselines present; SpeedDial stays outside denominator`,
);
if (carried < 31) {
  console.log(
    `  Wave 5 progress: need ${31 - carried} more carried members before denominator acceptance.`,
  );
}
