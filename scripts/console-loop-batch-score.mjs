#!/usr/bin/env node
/**
 * Score all foreign stems that have a cell/set shot + resolvable reference.
 *
 * Batch scoring ONLY — the flip semantics ("near-pass ≤6.5 AA may flip
 * receipt.visual.matchDeveloped") are DELETED. There is one bar
 * (pctAAMasked ≤ 5 AND compositionOk, enforced by the evidence gates directly
 * from the scorecards); receipts never get their booleans flipped by this
 * script, and near-pass is a fail.
 *
 *   node scripts/console-loop-batch-score.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (process.argv.includes("--flip")) {
  console.error(
    "✖ --flip is dead: the gate reads scorecards, never receipt booleans. Near-pass is a fail.",
  );
  process.exit(2);
}
const libs = ["altitude", "astryx", "carbon", "polaris", "tailwind"];

function findNodeId(obj, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 6) return null;
  if (typeof obj.nodeId === "string" && /^\d+:\d+$/.test(obj.nodeId)) return obj.nodeId;
  for (const v of Object.values(obj)) {
    const hit = findNodeId(v, depth + 1);
    if (hit) return hit;
  }
  return null;
}

const rows = [];
for (const lib of libs) {
  const dir = path.join(ROOT, "parity/receipts/console-loop", lib, "components");
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const stem = f.replace(/\.json$/, "");
    const receiptPath = path.join(dir, f);
    const r = JSON.parse(readFileSync(receiptPath, "utf8"));
    const cell = path.join(ROOT, "parity/receipts/console-loop", lib, "shots", `${stem}-cell.png`);
    const set = path.join(ROOT, "parity/receipts/console-loop", lib, "shots", `${stem}.png`);
    if (!existsSync(cell) && !existsSync(set)) continue;
    rows.push({ lib, stem, receiptPath, r, nodeId: findNodeId(r) });
  }
}

const summary = [];
for (const row of rows) {
  const res = spawnSync(
    "npx",
    ["tsx", "scripts/console-loop-developed-score.mjs", "--lib", row.lib, "--stem", row.stem],
    { cwd: ROOT, encoding: "utf8" },
  );
  const scorePath = path.join(
    ROOT,
    "parity/receipts/console-loop",
    row.lib,
    "scores",
    `${row.stem}.json`,
  );
  let score = null;
  if (existsSync(scorePath)) score = JSON.parse(readFileSync(scorePath, "utf8"));
  const aa = score?.metrics?.pctAAMasked;
  const compositionOk = score?.compositionOk === true;
  const pass = score?.status === "pass" && compositionOk && aa != null && aa <= 5;
  summary.push({
    id: `${row.lib}/${row.stem}`,
    pass,
    aa: aa != null ? +Number(aa).toFixed(2) : null,
    compositionOk,
    reliedOnFramingTolerant: score?.reliedOnFramingTolerant === true,
    note: score?.note,
  });
  process.stdout.write(res.stdout || "");
  if (res.stderr) process.stderr.write(res.stderr);
}

const passed = summary.filter((s) => s.pass).length;
console.log(
  JSON.stringify({ scored: summary.length, passed, summary }, null, 2),
);
