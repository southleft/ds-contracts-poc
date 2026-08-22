#!/usr/bin/env node
/**
 * MINT THE FIRST-PARTY EMIT-SPEC RECEIPT — the committed half of what the
 * canvas-drift probe compares.
 *
 *   node scripts/console-loop-canvas-drift-mint-specs.mjs [--check]
 *
 * WHY THIS EXISTS (2026-08-22)
 * ----------------------------
 * The first-party lane's emit scripts live under
 * parity/receipts/console-loop/emitted/NN-<stem>.js, which .gitignore names a
 * rebuild target. Each `components/<stem>.json` receipt records the script
 * that built its cell by that path — and 12 of the 13 pinned stems name a
 * wave number that `npm run console-loop:emit` no longer produces (the receipt
 * says 04-button.js; today's manifest says 06-button.js). So the probe's
 * EXPECTED side for those 13 stems was readable only on the one machine that
 * still had the leftover files: 18 in-sync there, 5 on a clean clone. The
 * eval `console-loop-canvas-drift-probe` was red on every CI run from
 * 2026-08-13 for exactly that reason.
 *
 * This tool reads each receipt's named script ONCE, on the machine that has
 * it, and commits the handful of facts the probe compares — variant names,
 * bindings, fixed width/height, declared font families, created collections —
 * to canvas-drift/EMIT-SPECS.json, with the script's sha256 so a later
 * re-mint can be told apart from a rot. The probe then reads the receipt and
 * never the gitignored directory, on every machine alike.
 *
 * REFUSES BY NAME when a receipt's script is absent locally: an entry minted
 * from nothing would be exactly the silent guess this lane forbids.
 * `--check` re-distils and diffs against the committed receipt without writing.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EMITTED_DIR, collectionsCreatedBy, distillScript, sha256 } from "./console-loop-emit-spec.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CL = path.join(ROOT, "parity/receipts/console-loop");
const OUT = path.join(CL, "canvas-drift/EMIT-SPECS.json");
const check = process.argv.includes("--check");

const missing = [];
const stems = {};
for (const f of readdirSync(path.join(CL, "components")).filter((x) => x.endsWith(".json")).sort()) {
  const stem = f.replace(/\.json$/, "");
  const receipt = JSON.parse(readFileSync(path.join(CL, "components", f), "utf8"));
  const rel = receipt.script;
  // Tracked scripts (figma-sync/NN-*.js for the five compositions) are read by
  // the probe directly; only the gitignored rebuild target needs a receipt.
  if (!rel || !rel.startsWith(EMITTED_DIR)) continue;
  const abs = path.join(ROOT, rel);
  if (!existsSync(abs)) {
    missing.push(`${stem} -> ${rel}`);
    continue;
  }
  const src = readFileSync(abs, "utf8");
  const distilled = distillScript(src);
  stems[stem] = {
    script: rel,
    sha256: sha256(src),
    bytes: Buffer.byteLength(src),
    ...(distilled ?? { unparseable: true }),
  };
}
const tokensRel = `${EMITTED_DIR}01-tokens.js`;
const tokensAbs = path.join(ROOT, tokensRel);
if (!existsSync(tokensAbs)) missing.push(`(lane tokens) -> ${tokensRel}`);
if (missing.length) {
  console.error(
    `✖ refusing to mint: ${missing.length} receipt(s) name an emit script that is not on this machine — run \`npm run console-loop:emit\` on the machine that built the cells, or re-pin the receipts to the scripts that exist:\n  ${missing.join("\n  ")}`,
  );
  process.exit(1);
}
const tokensSrc = readFileSync(tokensAbs, "utf8");
const tokens = {
  script: tokensRel,
  sha256: sha256(tokensSrc),
  bytes: Buffer.byteLength(tokensSrc),
  collections: collectionsCreatedBy(tokensSrc),
};

const stable = (o) => JSON.stringify({ tokens: o.tokens, stems: o.stems });
const next = {
  version: 1,
  kind: "console-loop-canvas-drift-emit-specs",
  lane: "first-party",
  mintedAt: new Date().toISOString().slice(0, 10),
  mintedFrom: {
    generator: "scripts/console-loop-canvas-drift-mint-specs.mjs",
    source:
      "each components/<stem>.json receipt's own `script` path under the gitignored parity/receipts/console-loop/emitted/ — read once on the machine that has the files, distilled by scripts/console-loop-emit-spec.mjs",
    carries:
      "per stem: variant names, spec.bindings, spec.fixedWidth/fixedHeight, declared fontFamily set, collections the script creates; the lane's 01-tokens.js collections; sha256 + bytes of every script read",
  },
  why:
    "parity/receipts/console-loop/emitted/*.js is a gitignored rebuild target, so the probe's EXPECTED side for the first-party stems was readable only on a machine that kept the leftover wave-numbered files (18 in-sync locally, 5 on a clean clone — CI red from 2026-08-13). This receipt is the committed input; the probe reads it and never the directory.",
  tokens,
  stems,
};

if (check) {
  if (!existsSync(OUT)) {
    console.error(`✖ ${path.relative(ROOT, OUT)} is absent — nothing to check against`);
    process.exit(1);
  }
  const cur = JSON.parse(readFileSync(OUT, "utf8"));
  const stale = [];
  for (const stem of new Set([...Object.keys(cur.stems ?? {}), ...Object.keys(stems)])) {
    if (JSON.stringify(cur.stems?.[stem] ?? null) !== JSON.stringify(stems[stem] ?? null)) stale.push(stem);
  }
  if (JSON.stringify(cur.tokens ?? null) !== JSON.stringify(tokens)) stale.push("(lane tokens)");
  if (stale.length) {
    console.error(
      `✖ ${path.relative(ROOT, OUT)} differs from the local emit scripts for ${stale.length} entr(ies): ${stale.join(", ")} — re-mint if the scripts are the ones that built the cells`,
    );
    process.exit(1);
  }
  console.log(`✔ ${path.relative(ROOT, OUT)} matches the local emit scripts (${Object.keys(stems).length} stems)`);
  process.exit(0);
}

if (existsSync(OUT) && stable(JSON.parse(readFileSync(OUT, "utf8"))) === stable(next)) {
  console.log(`✔ ${path.relative(ROOT, OUT)} unchanged (${Object.keys(stems).length} stems)`);
  process.exit(0);
}
mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(next, null, 2) + "\n");
console.log(`✔ wrote ${path.relative(ROOT, OUT)} — ${Object.keys(stems).length} stems, tokens collections: ${tokens.collections.join(", ") || "(none)"}`);
