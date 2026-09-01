#!/usr/bin/env node
/**
 * Scaffold the next live-proof version of a boilerplate archetype:
 *   - copies build-<a>-live-proof-v<N>.ts → v<N+1> with the evidence path bumped
 *   - swaps the package.json prepare/generated:check scripts and the composite
 *   - bumps <A>_FIGMA_RUN_SUFFIX, forbids the previous stay page (read from
 *     the previous receipt's pageId) and pins the writer test's version regex
 *
 *   node scripts/scaffold-live-version.mjs --archetype badge
 *   node scripts/scaffold-live-version.mjs --archetype badge --why "shared runtime proof"
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : undefined; };
const a = arg("archetype"); if (!a) throw new Error("--archetype required");
const why = arg("why") ?? "superseded";
const A = a.toUpperCase();
const pkgPath = "package.json"; let pkg = readFileSync(pkgPath, "utf8");
const m = pkg.match(new RegExp(`"recipe:${a}:live:v(\\d+):prepare"`)); if (!m) throw new Error(`no current prepare script for ${a}`);
const v = Number(m[1]), nv = v + 1;
const from = `recipe/build-${a}-live-proof-v${v}.ts`, to = `recipe/build-${a}-live-proof-v${nv}.ts`;
if (existsSync(to)) throw new Error(`${to} already exists`);
writeFileSync(to, readFileSync(from, "utf8").replaceAll(`${a}-live-pivot-v${v}`, `${a}-live-pivot-v${nv}`));
pkg = pkg
  .replace(`"recipe:${a}:live:v${v}:prepare": "tsx recipe/build-${a}-live-proof-v${v}.ts",\n    "recipe:${a}:live:v${v}:generated:check": "tsx recipe/build-${a}-live-proof-v${v}.ts --check",`,
           `"recipe:${a}:live:v${nv}:prepare": "tsx recipe/build-${a}-live-proof-v${nv}.ts",\n    "recipe:${a}:live:v${nv}:generated:check": "tsx recipe/build-${a}-live-proof-v${nv}.ts --check",`)
  .replaceAll(`npm run recipe:${a}:live:v${v}:generated:check`, `npm run recipe:${a}:live:v${nv}:generated:check`);
if (pkg.includes(`recipe:${a}:live:v${v}:`)) throw new Error(`package.json still references v${v}`);
writeFileSync(pkgPath, pkg);
const receiptPath = `recipe/evidence/${a}-live-pivot-v${v}/receipt.json`;
const prev = existsSync(receiptPath) ? JSON.parse(readFileSync(receiptPath, "utf8")) : {};
const wPath = `recipe/${a}-figma-writer.ts`; let w = readFileSync(wPath, "utf8");
const suffixLine = `export const ${A}_FIGMA_RUN_SUFFIX = "${a}-v${v}";`;
if (!w.includes(suffixLine)) throw new Error(`${wPath}: expected ${suffixLine}`);
let replacement = `export const ${A}_FIGMA_RUN_SUFFIX = "${a}-v${nv}";`;
if (prev.liveFigma && prev.pageId) {
  replacement += `\n/** v${v} stay (${why}) is preserved as evidence and never written again. */\nexport const FORBIDDEN_${A}_V${v}_PAGE_ID = "${prev.pageId}";`;
  // shared-runtime writers keep their forbidden pages in WRITER_RUNTIME_SPEC
  const specMarker = `"forbiddenPages": [`;
  if (!w.includes(specMarker)) throw new Error(`${wPath}: no WRITER_RUNTIME_SPEC.forbiddenPages — migrate the writer to the shared runtime first`);
  w = w.replace(specMarker, `${specMarker}\n    { "id": "${prev.pageId}", "marker": "${A}-V${v}-PAGE" },`);
}
w = w.replace(suffixLine, replacement);
writeFileSync(wPath, w);
const tPath = `recipe/${a}-figma-writer.test.ts`;
if (existsSync(tPath)) writeFileSync(tPath, readFileSync(tPath, "utf8").replaceAll(`${a}-v${v}$`, `${a}-v${nv}$`));
console.log(JSON.stringify({ archetype: a, from: v, to: nv, forbade: prev.liveFigma ? prev.pageId : null, build: to }));
