/**
 * THE PASTE VERB, PROVEN PER ROW — every proposed fixture's PLUGIN-TARGET
 * program (no file pin, no page list: what the shipped plugin's Paste-a-script
 * verb executes) is emitted from the current generated module, run in Scratch
 * through the same execution shape the plugin uses, exported, and scored
 * against the SAME real-package reference as the fidelity manifest's row.
 * The claim this measures: the program a stranger pastes is the program the
 * gate scored — not a developer-protocol cousin of it.
 *
 *   npx tsx recipe/plugin-target-proof.ts                # every proposed row: mint + capture + score
 *   npx tsx recipe/plugin-target-proof.ts --label menu/chakra
 *   npx tsx recipe/plugin-target-proof.ts --check        # OFFLINE: re-score the committed -plugin shots, no Figma
 *
 * Writes recipe/evidence/fidelity-v1/plugin-target/<label>.json and RUN.json.
 * --check exits 1 when a plugin-target score differs from the manifest row's
 * by more than PARITY_TOLERANCE points or crosses the bar the other way.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { hashRecipeInstance } from "./recipe.js";
import { archetypeToolkit, generatedExportNames } from "./fixture-reader/toolkit.js";
import { referenceCropBox, type Subject } from "./fidelity-check.js";
import { FIDELITY_BAR, scoreFidelity } from "./fidelity-score.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = path.join(REPO, "recipe/fidelity-manifest.json");
const OUT = path.join(REPO, "recipe/evidence/fidelity-v1/plugin-target");
const PRIVATE = path.join(REPO, "private/plugin-target");
const PARITY_TOLERANCE = 0.5;
const SCRATCH_KEY = "byMp6lt0Ij9b2QbkDGFwBh"; // the ONLY file the sweep may touch

const argument = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const check = process.argv.includes("--check");
const only = argument("label");

interface Row {
  label: string;
  archetype: string;
  slug: string;
  page: string | null;
  pageName: string | null;
  pluginShot: string;
  manifestShot: string;
  reference: string;
  pluginPct: number;
  manifestPct: number;
  pluginStatus: "pass" | "fail";
  manifestStatus: "pass" | "fail";
  parity: "same" | "drift";
}

const isProposed = (s: Subject & { _proposedWhy?: string; component?: string }): boolean =>
  typeof s._proposedWhy === "string" || /\(proposed\)/.test(s.component ?? "");

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as { subjects: Array<Subject & { _proposedWhy?: string; component?: string }> };
const subjects = manifest.subjects.filter((s) => isProposed(s) && (!only || s.label === only));
if (subjects.length === 0) throw new Error(`no proposed subject matches ${only ?? "(all)"}`);
mkdirSync(OUT, { recursive: true });

const score = (s: Subject, shot: string, label: string, diff: string): number => {
  const card = scoreFidelity(
    path.join(REPO, shot),
    path.join(REPO, s.reference),
    label,
    diff,
    s.referenceControlOnly === true,
    s.canvasControlOnly === true,
    s.canvasBox ?? null,
    { widthNormalised: s.widthNormalised === true, ...(s.referenceCrop ? { referenceBox: referenceCropBox(path.join(REPO, s.reference), s.referenceCrop, s.label) } : {}) },
  );
  return Math.round((card.metrics.pctAAMasked ?? card.metrics.pctAAUnmasked) * 100) / 100;
};

const run = (cmd: string, args: string[], label: string): string => {
  const r = spawnSync(cmd, args, { cwd: REPO, encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${label}: ${cmd} ${args.slice(0, 3).join(" ")} … exited ${r.status}\n${(r.stderr || r.stdout).slice(-1500)}`);
  return r.stdout;
};

const rows: Row[] = [];
for (const s of subjects) {
  const [archetype, lib] = s.label.split("/") as [string, string];
  const slug = lib.replace(/-proposed$/, "");
  const pluginShot = s.shot.replace(/\.png$/, "-plugin.png");
  let page: string | null = null;
  let pageName: string | null = null;
  const cardPath = path.join(OUT, `${s.label.replace("/", "-")}.json`);

  if (!check) {
    // 1. the plugin-target program, from the CURRENT generated module
    const modulePath = path.join(REPO, "recipe/fixtures/generated", `${archetype}.${slug}.ts`);
    if (!existsSync(modulePath)) throw new Error(`${s.label}: no generated module at ${path.relative(REPO, modulePath)}`);
    const mod = (await import(pathToFileURL(modulePath).href)) as Record<string, unknown>;
    const names = generatedExportNames(archetype, slug);
    const source = mod[names.source];
    const config = mod[names.config] as { identity?: { name?: string } } | undefined;
    if (!source || !config) throw new Error(`${s.label}: ${path.relative(REPO, modulePath)} exports no ${names.source}/${names.config}`);
    const kit = archetypeToolkit(archetype);
    const instance = kit.adapt(source, config);
    const envelope = kit.compile(instance);
    const Arch = archetype[0]!.toUpperCase() + archetype.slice(1);
    const displayName = (config.identity?.name ?? slug).replace(new RegExp(` ${Arch}$`), "");
    const recipeHash = (hashRecipeInstance as (r: unknown, i: unknown) => string)(kit.recipe, instance);
    const program = kit.emit([{ adapterIdentity: `${slug}-${archetype}-proposed-v1`, displayName, recipeHash, envelope }], { target: "plugin" });
    mkdirSync(PRIVATE, { recursive: true });
    const stamp = Date.now().toString(36);
    const programPath = path.join(PRIVATE, `${s.label.replace("/", "-")}-${stamp}.js`);
    const rawPath = path.join(PRIVATE, `${s.label.replace("/", "-")}-${stamp}.raw.json`);
    writeFileSync(programPath, program.code);
    pageName = program.pageName;

    // 1b. make the run idempotent ON SCRATCH ONLY: a plugin-target program refuses
    // by name when its page/section/collection already exists (a prior attempt),
    // so a scratch-pinned sweep removes exactly that page and those collections
    // first. It refuses any file that is not Scratch.
    const runIdentity = program.pageName.split(" / ").pop() ?? "";
    const sweep = `if (figma.root.name !== ${JSON.stringify("Scratch Project")} || figma.fileKey !== ${JSON.stringify(SCRATCH_KEY)}) throw new Error("plugin-target sweep runs only in Scratch (" + figma.root.name + ")");
await figma.loadAllPagesAsync();
const gone = [];
for (const pg of figma.root.children.filter((x) => x.name === ${JSON.stringify(program.pageName)})) { if (figma.currentPage.id === pg.id) await figma.setCurrentPageAsync(figma.root.children.find((x) => x.name === "Page 1")); gone.push(pg.id); pg.remove(); }
const cols = await figma.variables.getLocalVariableCollectionsAsync();
const prefix = ${JSON.stringify(`Recipe ${Arch} / ${runIdentity} /`)};
const gc = []; for (const c of cols) if (c.name.startsWith(prefix)) { gc.push(c.name); c.remove(); }
return { pages: gone, collections: gc };`;
    const sweepPath = path.join(PRIVATE, `${s.label.replace("/", "-")}-${stamp}.sweep.js`);
    writeFileSync(sweepPath, sweep);
    run("node", ["scripts/run-figma-writer.mjs", "--writer", sweepPath, "--output", `${sweepPath}.raw.json`, "--from-page", "Page 1"], `${s.label} sweep`);

    // 2. run it the way the plugin does (no pin — the runner insists on --plugin-target)
    run("node", ["scripts/run-figma-writer.mjs", "--writer", programPath, "--plugin-target", "--output", rawPath, "--from-page", "Page 1"], s.label);
    const raw = JSON.parse(readFileSync(rawPath, "utf8")) as { result?: { pageId?: string }; summary?: { pageId?: string } };
    page = raw.result?.pageId ?? raw.summary?.pageId ?? null;
    if (!page) throw new Error(`${s.label}: the runner's summary carries no pageId`);

    // 3. export the same cell the manifest row exports, from the plugin's page
    run("npm", ["run", "-s", "recipe:fidelity:capture", "--", "--label", s.label, "--page", page, "--shot-suffix", "plugin"], s.label);
  } else {
    const prior = existsSync(cardPath) ? (JSON.parse(readFileSync(cardPath, "utf8")) as Row) : null;
    page = prior?.page ?? null;
    pageName = prior?.pageName ?? null;
  }
  if (!existsSync(path.join(REPO, pluginShot))) throw new Error(`${s.label}: no plugin shot at ${pluginShot} — run without --check first`);

  // 4. score both shots against the same reference, the same way
  const pluginPct = score(s, pluginShot, `${s.label} (plugin)`, path.join(OUT, `${s.label.replace("/", "-")}.diff.png`));
  const manifestPct = score(s, s.shot, s.label, path.join(PRIVATE, `${s.label.replace("/", "-")}.manifest.diff.png`));
  const status = (pct: number): "pass" | "fail" => (pct <= FIDELITY_BAR.pctAAMaskedMax ? "pass" : "fail");
  const row: Row = {
    label: s.label, archetype, slug, page, pageName, pluginShot, manifestShot: s.shot, reference: s.reference,
    pluginPct, manifestPct, pluginStatus: status(pluginPct), manifestStatus: status(manifestPct),
    parity: Math.abs(pluginPct - manifestPct) <= PARITY_TOLERANCE && status(pluginPct) === status(manifestPct) ? "same" : "drift",
  };
  rows.push(row);
  writeFileSync(cardPath, `${JSON.stringify(row, null, 2)}\n`);
  console.log(`${row.parity === "same" ? "✔" : "✖"} ${s.label.padEnd(26)} plugin ${String(pluginPct).padStart(6)}%  manifest ${String(manifestPct).padStart(6)}%  ${row.parity}${page ? `  page ${page}` : ""}`);
}

const drift = rows.filter((r) => r.parity === "drift");
const summary = {
  artifactVersion: "plugin-target-proof-v1",
  recordedAt: check ? undefined : new Date().toISOString(),
  bar: FIDELITY_BAR.pctAAMaskedMax,
  parityTolerance: PARITY_TOLERANCE,
  rows: rows.length,
  same: rows.length - drift.length,
  drift: drift.map((r) => r.label),
};
if (!only) writeFileSync(path.join(OUT, "RUN.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(`plugin-target proof — ${rows.length} row(s), ${summary.same} same, ${drift.length} drift${check ? " (offline check)" : ""}`);
if (drift.length > 0) process.exit(1);
