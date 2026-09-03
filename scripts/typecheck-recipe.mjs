/**
 * STATIC TYPECHECK OF THE CURRENT RECIPE SURFACE — the post-merge work docs/32
 * named. tsconfig.recipe.json includes recipe/*.ts and the recipes, adapters,
 * fixtures, fixture-reader and output directories, and excludes the
 * per-version lineage files (byte-frozen receipts) and pivot-status.ts (its
 * ~11k-operand boolean chains crash the TypeScript binder).
 *
 * Versioned lineage files still reach the checker when a current file imports
 * one. Their errors are NAMED here and tolerated — a receipt is not edited to
 * track checker evolution — while an error in a current file fails the gate.
 *
 *   npm run typecheck:recipe
 */
import { spawnSync } from "node:child_process";

const FROZEN = /(?:^|\/)[^/]*-v\d+(?:[.-][^/]*)?\.ts\(/;
const r = spawnSync("npx", ["tsc", "-p", "tsconfig.recipe.json", "--noEmit", "--pretty", "false"], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const lines = `${r.stdout}\n${r.stderr}`.split("\n").filter((l) => /error TS\d+/.test(l));
if (r.status !== 0 && lines.length === 0) {
  console.error(`typecheck:recipe — tsc exited ${r.status} without diagnostics:\n${(r.stderr || r.stdout).slice(-1500)}`);
  process.exit(1);
}
const frozen = lines.filter((l) => FROZEN.test(l));
const current = lines.filter((l) => !FROZEN.test(l));
const byFile = (list) => {
  const m = new Map();
  for (const l of list) { const f = l.split("(")[0]; m.set(f, (m.get(f) ?? 0) + 1); }
  return [...m].sort((a, b) => b[1] - a[1]);
};
for (const [f, n] of byFile(frozen)) console.log(`  · ${f}: ${n} (frozen lineage file — named, not edited)`);
for (const l of current) console.log(`  ✖ ${l}`);
const surface = spawnSync("npx", ["tsc", "-p", "tsconfig.recipe.json", "--listFilesOnly"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).stdout.split("\n").filter((f) => f.includes("/recipe/")).length;
if (current.length > 0) {
  console.error(`✖ typecheck:recipe — ${current.length} error(s) in current recipe files (${frozen.length} tolerated in frozen lineage files; ${surface} files checked)`);
  process.exit(1);
}
console.log(`✔ typecheck:recipe — 0 errors in current recipe files; ${frozen.length} named in ${byFile(frozen).length} frozen lineage file(s); ${surface} files checked`);
