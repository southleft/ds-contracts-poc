#!/usr/bin/env node
/**
 * Scaffold the next `table@1` live-protocol version from the previous one.
 *
 * Every live version needs its own transaction, its own signer and its own
 * generated proof plan, so each one carries a full set of version-tokened
 * files. The semantic delta between two versions is the teaching -- a handful
 * of lines in the recipe or the shared writer. The other ~9,500 lines are this:
 * the same scaffolding with one number changed.
 *
 * Doing that by hand invites a missed token, which fails late and confusingly
 * inside a live run. This does the rename mechanically and refuses if the
 * source version is incomplete or the target already exists.
 *
 *   node scripts/scaffold-table-live-version.mjs 29 30
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

const [from, to] = process.argv.slice(2);
if (!/^\d+$/.test(from ?? "") || !/^\d+$/.test(to ?? ""))
  throw new Error("usage: scaffold-table-live-version.mjs <fromVersion> <toVersion>");

const rename = (text) =>
  text
    .replaceAll(`v${from}`, `v${to}`)
    .replaceAll(`V${from}`, `V${to}`)
    .replaceAll(`table-v${from}`, `table-v${to}`);

const sources = readdirSync("recipe").filter(
  (name) => name.includes(`v${from}`) && name.endsWith(".ts") && name.includes("table"),
);
if (sources.length === 0) throw new Error(`no recipe/*v${from}*.ts sources found`);

const written = [];
for (const name of sources) {
  const target = rename(name);
  if (existsSync(`recipe/${target}`))
    throw new Error(`recipe/${target} already exists -- refusing to overwrite a prepared version`);
  writeFileSync(`recipe/${target}`, rename(readFileSync(`recipe/${name}`, "utf8")));
  written.push(target);
}

// The npm scripts are the lane surface; a version with no lanes cannot be run
// or gated, so they are part of the scaffold rather than a follow-up edit.
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const scripts = {};
let added = 0;
for (const [key, value] of Object.entries(pkg.scripts)) {
  scripts[key] = value;
  if (key.includes(`:v${from}:`) && key.startsWith("recipe:table:live:")) {
    const next = rename(key);
    if (!(next in pkg.scripts)) {
      scripts[next] = rename(value);
      added += 1;
    }
  }
}
pkg.scripts = scripts;
writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);

console.log(`scaffolded v${from} -> v${to}: ${written.length} files, ${added} npm scripts`);
for (const name of written) console.log(`  recipe/${name}`);
