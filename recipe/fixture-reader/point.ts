/**
 * POINT THE RECIPE PATH AT A LIBRARY — one command from a capture to a
 * paste-ready Figma program.
 *
 *   npx tsx recipe/fixture-reader/point.ts --archetype checkbox --library chakra \
 *     --glyph-file glyph.json [--roles-file roles.json] [--set … --why …]… \
 *     [--display-name Chakra] [--export-name Checkbox]
 *
 * Steps, each of which refuses by name instead of continuing on a guess:
 *   1. the capture ledger must exist (extract/computed/out/<lib>/<archetype>);
 *   2. the ROLE MAP is taken from --roles-file, or DRAFTED from the ledger with
 *      evidence (draft-roles.ts) — an unresolved role stops here with the draft
 *      written for review;
 *   3. the fixture is PROPOSED (propose-fixture.ts) — 0 invented leaves;
 *   4. it is adapted, compiled, and collapse → compile must be a fixed point;
 *   5. two programs are emitted through the shared writer runtime: the plugin
 *      target (paste into the shipped plugin in any file) and the scratch
 *      target (the developer protocol).
 *
 * Output: recipe/evidence/pointed/<archetype>-<library>/ with roles.json,
 * proposal.json, writer.plugin.js, writer.scratch.js and a README naming
 * what was read, what was reviewed, and what to do next.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Ledger } from "./ledger.js";
import { draftAvatarRoles, draftCheckboxRoles, draftSwitchRoles } from "./draft-roles.js";
import { proposeCheckboxFixture, type GlyphSpec } from "./propose-fixture.js";
import { proposeSwitchFixture } from "./propose-switch.js";
import { proposeAvatarFixture } from "./propose-avatar.js";
import type { AvatarRoles } from "./schema-avatar.js";
import { adaptReviewedAvatar } from "../adapters/avatar.js";
import { avatarRecipe, collapseAvatarRecipe, compileAvatarRecipe } from "../recipes/avatar.js";
import { emitAvatarFigmaWriter } from "../avatar-figma-writer.js";
import type { CheckboxRoles } from "./schema-checkbox.js";
import type { SwitchComboMap, SwitchRoles } from "./schema-switch.js";
import { adaptReviewedCheckbox } from "../adapters/checkbox.js";
import { adaptReviewedSwitch } from "../adapters/switch.js";
import { checkboxRecipe, collapseCheckboxRecipe, compileCheckboxRecipe } from "../recipes/checkbox.js";
import { collapseSwitchRecipe, compileSwitchRecipe, switchRecipe } from "../recipes/switch.js";
import { emitCheckboxFigmaWriter } from "../checkbox-figma-writer.js";
import { emitSwitchFigmaWriter } from "../switch-figma-writer.js";
import { hashRecipeInstance } from "../recipe.js";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const arg = (name: string): string | undefined => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : undefined; };
const args = (name: string): string[] => { const out: string[] = []; for (let i = 0; i < process.argv.length; i++) if (process.argv[i] === `--${name}` && process.argv[i + 1]) out.push(process.argv[i + 1]!); return out; };

const archetype = arg("archetype");
const library = arg("library");
const ARCHETYPES = ["checkbox", "switch", "avatar"] as const;
if (!ARCHETYPES.includes(archetype as (typeof ARCHETYPES)[number]) || !library) throw new Error("usage: --archetype checkbox|switch|avatar --library <slug> [--glyph-file <json> (checkbox)] [--roles-file <json>] [--set path=v --why 'path=evidence']…");
const ledgerRel = `extract/computed/out/${library}/${archetype}/captured-truth.json`;
const outDir = path.join(REPO, "recipe/evidence/pointed", `${archetype}-${library}`);
mkdirSync(outDir, { recursive: true });
const log: string[] = [];
const say = (line: string): void => { console.log(line); log.push(line); };

// 1. capture
if (!existsSync(path.join(REPO, ledgerRel))) {
  console.error(`✖ no capture ledger at ${ledgerRel}\n  capture first: npm run extract:computed -- --harness <sandbox> --config extract/computed/configs/${library}.json --component ${archetype[0]!.toUpperCase() + archetype.slice(1)} --out extract/computed/out/${library} --keep-originals`);
  process.exit(1);
}
const ledger = new Ledger(REPO, ledgerRel);
say(`1. capture   ${ledgerRel} (${ledger.keys().length} captures)`);

// 2. roles
type Roles = CheckboxRoles | (SwitchRoles & { combos: SwitchComboMap }) | (AvatarRoles & { combo: string });
let roles: Roles;
const rolesFile = arg("roles-file");
if (rolesFile) {
  roles = JSON.parse(readFileSync(path.resolve(rolesFile), "utf8")) as Roles;
  say(`2. roles     from ${rolesFile} (reviewed)`);
} else {
  const draft = archetype === "checkbox" ? draftCheckboxRoles(ledger) : archetype === "switch" ? draftSwitchRoles(ledger) : draftAvatarRoles(ledger);
  writeFileSync(path.join(outDir, "roles.draft.json"), `${JSON.stringify(draft, null, 2)}\n`);
  if (draft.unresolved.length > 0) {
    console.error(`✖ the role map cannot be drafted from the ledger alone:\n  - ${draft.unresolved.join("\n  - ")}\n  Review ${path.relative(REPO, path.join(outDir, "roles.draft.json"))}, write roles.json, and pass --roles-file.`);
    process.exit(2);
  }
  roles = (archetype === "checkbox" ? draft.roles : archetype === "switch" ? { ...(draft as { roles: SwitchRoles }).roles, combos: (draft as { combos: SwitchComboMap }).combos } : { ...(draft as { roles: AvatarRoles }).roles, combo: (draft as { combo: string }).combo }) as Roles;
  say(`2. roles     DRAFTED from the ledger — ${Object.entries(draft.evidence).map(([k, v]) => `${k}:${(v as { confidence: string }).confidence}`).join(" ")} (review ${path.relative(REPO, path.join(outDir, "roles.draft.json"))})`);
}
writeFileSync(path.join(outDir, "roles.json"), `${JSON.stringify(roles, null, 2)}\n`);

// 3. propose
const sets: Record<string, { value: string; why: string }> = {};
const whys = new Map(args("why").map((w) => { const i = w.indexOf("="); return [w.slice(0, i), w.slice(i + 1)] as const; }));
for (const s of args("set")) { const i = s.indexOf("="); const p = s.slice(0, i); const why = whys.get(p); if (!why) throw new Error(`--set ${p} needs --why '${p}=<evidence>'`); sets[p] = { value: s.slice(i + 1), why }; }
const modulePath = `recipe/fixtures/generated/${archetype}.${library}.ts`;
const common = { library, ledger: ledgerRel, sets, displayName: arg("display-name"), exportName: arg("export-name"), sourceRoot: arg("source-root"), unsupported: (arg("unsupported") ?? "").split(",").filter(Boolean), out: modulePath };
let glyph: GlyphSpec | null = null;
let proposed: { refused: string[]; proposal: { leaves: Record<string, { from: "ledger" | "set" | "spelling" }> } };
if (archetype === "checkbox") {
  const glyphFile = arg("glyph-file");
  if (!glyphFile) throw new Error("--glyph-file <json> is required for checkbox: the glyph's geometry is cited from the package source ({path, viewBox, paint, strokeWidth, cap, join, source})");
  glyph = JSON.parse(readFileSync(path.resolve(glyphFile), "utf8")) as GlyphSpec;
  proposed = proposeCheckboxFixture({ ...common, roles: roles as CheckboxRoles, glyph });
} else if (archetype === "switch") {
  const { combos, ...switchRoles } = roles as SwitchRoles & { combos: SwitchComboMap };
  proposed = proposeSwitchFixture({ ...common, roles: switchRoles, combos });
} else {
  const { combo, ...avatarRoles } = roles as AvatarRoles & { combo: string };
  proposed = proposeAvatarFixture({ ...common, roles: avatarRoles, combo });
}
if (proposed.refused.length > 0) {
  console.error(`✖ ${proposed.refused.length} leaf/leaves cannot be proposed — give each with evidence:\n  - ${proposed.refused.join("\n  - ")}`);
  process.exit(3);
}
const p = proposed.proposal;
const counts = { ledger: 0, set: 0, spelling: 0 };
for (const l of Object.values(p.leaves)) counts[l.from] += 1;
writeFileSync(path.join(outDir, "proposal.json"), `${JSON.stringify(p, null, 2)}\n`);
say(`3. propose   ${counts.ledger} leaves read from the ledger · ${counts.set} reviewed (named) · ${counts.spelling} archetype spellings · 0 invented → ${modulePath}`);

// 4. compile + fixed point
const mod = (await import(pathToFileURL(path.join(REPO, modulePath)).href)) as Record<string, unknown>;
const Arch = archetype[0]!.toUpperCase() + archetype.slice(1);
const slug = library.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
const source = mod[`${slug}${Arch}Source`];
const config = mod[`${slug}${Arch}AdapterConfig`];
const adapt = (archetype === "checkbox" ? adaptReviewedCheckbox : archetype === "switch" ? adaptReviewedSwitch : adaptReviewedAvatar) as (s: unknown, c: unknown) => unknown;
const instance = adapt(source, config);
const compile = (archetype === "checkbox" ? compileCheckboxRecipe : archetype === "switch" ? compileSwitchRecipe : compileAvatarRecipe) as (i: unknown) => ReturnType<typeof compileCheckboxRecipe>;
const collapse = (archetype === "checkbox" ? collapseCheckboxRecipe : archetype === "switch" ? collapseSwitchRecipe : collapseAvatarRecipe) as (e: ReturnType<typeof compileCheckboxRecipe>, s: unknown) => unknown;
const envelope = compile(instance);
const again = compile(collapse(envelope, (instance as { provenance: { selection: unknown } }).provenance.selection));
if (envelope.integrity.canonicalHash !== again.integrity.canonicalHash) throw new Error("compile → collapse → compile is not a fixed point for the proposed fixture");
const recipeHash = (hashRecipeInstance as (r: unknown, i: unknown) => string)(archetype === "checkbox" ? checkboxRecipe : archetype === "switch" ? switchRecipe : avatarRecipe, instance);
say(`4. compile   fixed point ✔ · ${(envelope.ir as { children: unknown[] }).children.length} variants · ${envelope.accounting.carried.length} carried · ${envelope.receipts.length} receipts · recipe ${recipeHash.slice(0, 8)}`);

// 5. emit
const src = { adapterIdentity: `${library}-${archetype}-proposed-v1`, displayName: arg("display-name") ?? library, recipeHash, envelope };
const emit = (archetype === "checkbox" ? emitCheckboxFigmaWriter : archetype === "switch" ? emitSwitchFigmaWriter : emitAvatarFigmaWriter) as (inputs: Array<typeof src>, o: { target: "plugin" | "scratch" }) => { code: string; pageName: string };
const plugin = emit([src], { target: "plugin" });
const scratch = emit([src], { target: "scratch" });
writeFileSync(path.join(outDir, "writer.plugin.js"), plugin.code);
writeFileSync(path.join(outDir, "writer.scratch.js"), scratch.code);
say(`5. emit      writer.plugin.js (${(plugin.code.length / 1024).toFixed(0)} KB, page "${plugin.pageName}") and writer.scratch.js`);

writeFileSync(path.join(outDir, "README.md"), `# ${archetype}@1 pointed at ${library}

${log.map((l) => `- ${l}`).join("\n")}

## What a person did
- reviewed the role map (${rolesFile ? "supplied" : "drafted with evidence, see roles.draft.json"})
${glyph ? `- cited the glyph geometry from the package (glyph-file): ${glyph.source}` : "- (switch@1 has no glyph)"}
${Object.entries(sets).map(([k, v]) => `- reviewed ${k} = ${v.value}: ${v.why}`).join("\n")}

## What to do next
1. In Figma desktop, open the file the set should live in, open the development plugin, choose **Paste a script**, paste \`writer.plugin.js\`, run. It creates its own page named "${plugin.pageName}" and never touches an existing page.
2. To score it: export the unchecked variant's control and run \`npx tsx recipe/fidelity-score.ts --canvas <png> --reference extract/computed/out/${library}/${archetype}/orig-shots/<off-state>__default.png --label ${archetype}/${library} --out <json> --reference-control-only\`.
3. To keep it: add the generated module to the ${archetype} live proof's sources and to the reader's subjects (see checkbox v6 for the pattern).
`);
say(`✔ ${path.relative(REPO, outDir)}/ — paste writer.plugin.js into the plugin; see README.md`);
