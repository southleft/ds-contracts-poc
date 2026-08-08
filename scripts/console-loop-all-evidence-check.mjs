#!/usr/bin/env node
/**
 * Run EVERY console-loop evidence lane and aggregate — never short-circuit.
 *
 * The old npm chain (`a && b && c…`) hid every lane after the first failure;
 * this runner executes all seven lanes, streams their output, and exits
 * non-zero listing every failed lane.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const lanes = [
  // Runs FIRST: a wrongly-framed canvas shot poisons every number downstream,
  // so the capture-framing pin refuses it by name before any lane is scored.
  ["capture-framing", ["scripts/console-loop-capture-framing-check.mjs"]],
  ["first-party", ["scripts/console-loop-evidence-check.mjs"]],
  ["mui", ["scripts/console-loop-mui-evidence-check.mjs"]],
  ...["tailwind", "altitude", "astryx", "carbon", "polaris"].map((lib) => [
    lib,
    ["scripts/console-loop-lib-evidence-check.mjs", lib],
  ]),
];

const failed = [];
for (const [name, args] of lanes) {
  console.log(`\n── console-loop lane: ${name} ──`);
  const r = spawnSync(process.execPath, args, { cwd: ROOT, stdio: "inherit" });
  if ((r.status ?? 1) !== 0) failed.push(name);
}

if (failed.length) {
  console.error(
    `\n✖ console-loop:all:evidence:check — ${failed.length}/${lanes.length} lane(s) failed: ${failed.join(", ")}`,
  );
  process.exit(1);
}
console.log(`\n✔ console-loop:all:evidence:check — all ${lanes.length} lanes green`);
