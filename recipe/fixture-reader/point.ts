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
import { draftAvatarRoles, draftCheckboxRoles, draftChipRoles, draftLinkRoles, draftSwitchRoles, draftTabsRoles, draftTooltipRoles, draftAlertRoles, draftBadgeRoles, draftDialogRoles, draftMenuRoles, draftRadioRoles, draftTextareaRoles } from "./draft-roles.js";
import { proposeCheckboxFixture, type GlyphSpec } from "./propose-fixture.js";
import { proposeSwitchFixture } from "./propose-switch.js";
import { proposeAvatarFixture } from "./propose-avatar.js";
import { proposeTooltipFixture } from "./propose-tooltip.js";
import type { TooltipRoles } from "./schema-tooltip.js";
import { proposeChipFixture } from "./propose-chip.js";
import { proposeLinkFixture } from "./propose-link.js";
import type { ChipRoles } from "./schema-chip.js";
import type { LinkRoles } from "./schema-link.js";
import { proposeTabsFixture } from "./propose-tabs.js";
import type { TabsRoles } from "./schema-tabs.js";
import { proposeRadioFixture } from "./propose-radio.js";
import type { RadioComboMap, RadioRoles } from "./schema-radio.js";
import { proposeTextareaFixture } from "./propose-textarea.js";
import type { TextareaComboMap, TextareaRoles } from "./schema-textarea.js";
import { proposeAlertFixture } from "./propose-alert.js";
import type { AlertComboMap, AlertRoles } from "./schema-alert.js";
import { proposeBadgeFixture } from "./propose-badge.js";
import type { BadgeRoles } from "./schema-badge.js";
import { proposeMenuFixture } from "./propose-menu.js";
import type { MenuRoles } from "./schema-menu.js";
import { proposeDialogFixture } from "./propose-dialog.js";
import type { DialogRoles } from "./schema-dialog.js";
import type { AvatarRoles } from "./schema-avatar.js";
import type { CheckboxRoles } from "./schema-checkbox.js";
import type { SwitchComboMap, SwitchRoles } from "./schema-switch.js";
import { hashRecipeInstance } from "../recipe.js";
import { archetypeToolkit } from "./toolkit.js";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const arg = (name: string): string | undefined => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : undefined; };
const args = (name: string): string[] => { const out: string[] = []; for (let i = 0; i < process.argv.length; i++) if (process.argv[i] === `--${name}` && process.argv[i + 1]) out.push(process.argv[i + 1]!); return out; };

const archetype = arg("archetype") as string;
const library = arg("library");
const ARCHETYPES = ["checkbox", "switch", "avatar", "tooltip", "chip", "link", "tabs", "radio", "textarea", "alert", "badge", "menu", "dialog"] as const;
if (!ARCHETYPES.includes(archetype as (typeof ARCHETYPES)[number]) || !library) throw new Error("usage: --archetype checkbox|switch|avatar|tooltip|chip|link|tabs|radio|textarea|alert|badge|menu|dialog --library <slug> [--glyph-file <json> (checkbox)] [--roles-file <json>] [--set path=v --why 'path=evidence']…");
// --capture <name>: the captured component directory when the library names
// the archetype differently (AntD and Carbon capture a Tag; chip@1 reads it).
const captureName = arg("capture") ?? archetype as string;
// --slug <name>: the fixture's own name when one library contributes two
// captures of an archetype (Chakra's bare Textarea and its Field + Label +
// Textarea composition): the ledger stays under --library, everything the
// proposal writes is named by the slug.
const slugName = arg("slug") ?? library;
// --unsupported is REQUIRED, and it is checked HERE — before the run writes a
// single byte. Every archetype adapter refuses a fixture that names no
// unsupported cell ("unsupported source cells must be named"), but it refuses
// at step 4, AFTER step 3 has already overwritten
// recipe/fixtures/generated/<archetype>.<slug>.ts. Run without the flag against
// a library this repo already ships and the committed fixture is replaced by
// one with an empty refusal list, the run dies on an uncaught TypeError with a
// stack trace, and the tree is left holding a fixture that no longer compiles.
// Measured 2026-09-04 on a clean clone of origin/main, on all six pairs tried
// (avatar/shadcn, tabs/mui, link/mui, badge/mui, radio/antd, tooltip/antd) and
// on docs/36's own headline example, `--archetype switch --library shadcn`,
// which omits the flag. A page whose promise is "everything it cannot do
// refuses by name" may not hand a stranger a stack trace and a damaged tree.
const unsupportedCells = (arg("unsupported") ?? "")
  .split(",")
  .map((c) => c.trim())
  .filter(Boolean);
if (unsupportedCells.length === 0) {
  const existing = path.join(REPO, `recipe/fixtures/generated/${archetype}.${slugName}.ts`);
  let hint = "";
  if (existsSync(existing)) {
    const m = /buildConfig\([\s\S]*?\n\s*(\[[^\]]*\]),\n/.exec(readFileSync(existing, "utf8"));
    if (m) hint = `\n  ${path.relative(REPO, existing)} already names ${m[1]} — pass those to keep it, or different ones to change it.`;
  }
  console.error(
    `\u2716 --unsupported is required: every adapter refuses a fixture that names no unsupported cell.\n` +
      `  Name the cells this capture cannot express, comma-separated, e.g. --unsupported hover,focus-visible,active.${hint}\n` +
      `  Nothing was written.`,
  );
  process.exit(2);
}
const ledgerRel = `extract/computed/out/${library}/${captureName}/captured-truth.json`;
const outDir = path.join(REPO, "recipe/evidence/pointed", `${archetype}-${slugName}`);
mkdirSync(outDir, { recursive: true });
const log: string[] = [];
const say = (line: string): void => { console.log(line); log.push(line); };

// 1. capture
if (!existsSync(path.join(REPO, ledgerRel))) {
  console.error(`✖ no capture ledger at ${ledgerRel}\n  capture first: npm run extract:computed -- --harness <sandbox> --config extract/computed/configs/${library}.json --component ${captureName[0]!.toUpperCase() + captureName.slice(1)} --out extract/computed/out/${library} --keep-originals\n  (or pass --capture <dir> when the library names this archetype differently)`);
  process.exit(1);
}
const ledger = new Ledger(REPO, ledgerRel);
say(`1. capture   ${ledgerRel} (${ledger.keys().length} captures)`);

// 2. roles
type Roles = CheckboxRoles | (SwitchRoles & { combos: SwitchComboMap }) | (AvatarRoles & { combo: string }) | (TooltipRoles & { combo: string }) | (ChipRoles & { combo: string }) | (LinkRoles & { combo: string }) | (TabsRoles & { combo: string }) | (RadioRoles & { combos: RadioComboMap }) | (TextareaRoles & { combos: TextareaComboMap }) | (AlertRoles & { combos: AlertComboMap }) | (BadgeRoles & { combo: string }) | (MenuRoles & { combo: string }) | (DialogRoles & { combo: string });
let roles: Roles;
const rolesFile = arg("roles-file");
if (rolesFile) {
  roles = JSON.parse(readFileSync(path.resolve(rolesFile), "utf8")) as Roles;
  say(`2. roles     from ${rolesFile} (reviewed)`);
} else {
  const draft = archetype === "checkbox" ? draftCheckboxRoles(ledger) : archetype === "switch" ? draftSwitchRoles(ledger) : archetype === "avatar" ? draftAvatarRoles(ledger) : archetype === "tooltip" ? draftTooltipRoles(ledger) : archetype === "chip" ? draftChipRoles(ledger) : archetype === "link" ? draftLinkRoles(ledger) : archetype === "radio" ? draftRadioRoles(ledger) : archetype === "textarea" ? draftTextareaRoles(ledger) : archetype === "alert" ? draftAlertRoles(ledger) : archetype === "badge" ? draftBadgeRoles(ledger) : archetype === "menu" ? draftMenuRoles(ledger) : archetype === "dialog" ? draftDialogRoles(ledger) : draftTabsRoles(ledger);
  writeFileSync(path.join(outDir, "roles.draft.json"), `${JSON.stringify(draft, null, 2)}\n`);
  if (draft.unresolved.length > 0) {
    console.error(`✖ the role map cannot be drafted from the ledger alone:\n  - ${draft.unresolved.join("\n  - ")}\n  Review ${path.relative(REPO, path.join(outDir, "roles.draft.json"))}, write roles.json, and pass --roles-file.`);
    process.exit(2);
  }
  roles = (archetype === "checkbox" ? draft.roles : archetype === "switch" || archetype === "radio" || archetype === "textarea" || archetype === "alert" ? { ...(draft as { roles: SwitchRoles }).roles, combos: (draft as { combos: SwitchComboMap }).combos } : { ...(draft as { roles: AvatarRoles | TooltipRoles | ChipRoles | LinkRoles | TabsRoles }).roles, combo: (draft as { combo: string }).combo }) as Roles;
  say(`2. roles     DRAFTED from the ledger — ${Object.entries(draft.evidence).map(([k, v]) => `${k}:${(v as { confidence: string }).confidence}`).join(" ")} (review ${path.relative(REPO, path.join(outDir, "roles.draft.json"))})`);
}
writeFileSync(path.join(outDir, "roles.json"), `${JSON.stringify(roles, null, 2)}\n`);

// 3. propose
const sets: Record<string, { value: string; why: string }> = {};
const whys = new Map(args("why").map((w) => { const i = w.indexOf("="); return [w.slice(0, i), w.slice(i + 1)] as const; }));
for (const s of args("set")) { const i = s.indexOf("="); const p = s.slice(0, i); const why = whys.get(p); if (!why) throw new Error(`--set ${p} needs --why '${p}=<evidence>'`); sets[p] = { value: s.slice(i + 1), why }; }
const modulePath = `recipe/fixtures/generated/${archetype}.${slugName}.ts`;
const common = { library: slugName, ledger: ledgerRel, sets, displayName: arg("display-name"), exportName: arg("export-name"), sourceRoot: arg("source-root"), unsupported: unsupportedCells, out: modulePath };
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
} else if (archetype === "avatar") {
  const { combo, ...avatarRoles } = roles as AvatarRoles & { combo: string };
  proposed = proposeAvatarFixture({ ...common, roles: avatarRoles, combo });
} else if (archetype === "tooltip") {
  const { combo, ...tooltipRoles } = roles as TooltipRoles & { combo: string };
  proposed = proposeTooltipFixture({ ...common, roles: tooltipRoles, combo });
} else if (archetype === "chip") {
  const { combo, ...chipRoles } = roles as ChipRoles & { combo: string };
  proposed = proposeChipFixture({ ...common, roles: chipRoles, combo });
} else if (archetype === "link") {
  const { combo, ...linkRoles } = roles as LinkRoles & { combo: string };
  proposed = proposeLinkFixture({ ...common, roles: linkRoles, combo });
} else if (archetype === "radio") {
  const { combos, ...radioRoles } = roles as RadioRoles & { combos: RadioComboMap };
  proposed = proposeRadioFixture({ ...common, roles: radioRoles, combos });
} else if (archetype === "textarea") {
  const { combos, ...textareaRoles } = roles as TextareaRoles & { combos: TextareaComboMap };
  proposed = proposeTextareaFixture({ ...common, roles: textareaRoles, combos });
} else if (archetype === "alert") {
  const { combos, ...alertRoles } = roles as AlertRoles & { combos: AlertComboMap };
  proposed = proposeAlertFixture({ ...common, roles: alertRoles, combos });
} else if (archetype === "badge") {
  const { combo, ...badgeRoles } = roles as BadgeRoles & { combo: string };
  proposed = proposeBadgeFixture({ ...common, roles: badgeRoles, combo });
} else if (archetype === "menu") {
  const { combo, ...menuRoles } = roles as MenuRoles & { combo: string };
  proposed = proposeMenuFixture({ ...common, roles: menuRoles, combo });
} else if (archetype === "dialog") {
  const { combo, ...dialogRoles } = roles as DialogRoles & { combo: string };
  proposed = proposeDialogFixture({ ...common, roles: dialogRoles, combo });
} else {
  const { combo, ...tabsRoles } = roles as TabsRoles & { combo: string };
  proposed = proposeTabsFixture({ ...common, roles: tabsRoles, combo });
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
const slug = slugName.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
const source = mod[`${slug}${Arch}Source`];
const config = mod[`${slug}${Arch}AdapterConfig`];
const kit = archetypeToolkit(archetype);
const adapt = kit.adapt;
const instance = adapt(source, config);
const compile = kit.compile;
const collapse = kit.collapse;
const envelope = compile(instance);
const again = compile(collapse(envelope, (instance as { provenance: { selection: unknown } }).provenance.selection));
if (envelope.integrity.canonicalHash !== again.integrity.canonicalHash) throw new Error("compile → collapse → compile is not a fixed point for the proposed fixture");
const recipeHash = (hashRecipeInstance as (r: unknown, i: unknown) => string)(kit.recipe, instance);
say(`4. compile   fixed point ✔ · ${(envelope.ir as { children: unknown[] }).children.length} variants · ${envelope.accounting.carried.length} carried · ${envelope.receipts.length} receipts · recipe ${recipeHash.slice(0, 8)}`);

// 5. emit
const src = { adapterIdentity: `${slugName}-${archetype}-proposed-v1`, displayName: arg("display-name") ?? slugName, recipeHash, envelope };
const emit = kit.emit as (inputs: Array<typeof src>, o: { target: "plugin" | "scratch" }) => { code: string; pageName: string };
const plugin = emit([src], { target: "plugin" });
const scratch = emit([src], { target: "scratch" });
writeFileSync(path.join(outDir, "writer.plugin.js"), plugin.code);
writeFileSync(path.join(outDir, "writer.scratch.js"), scratch.code);
say(`5. emit      writer.plugin.js (${(plugin.code.length / 1024).toFixed(0)} KB, page "${plugin.pageName}") and writer.scratch.js`);

writeFileSync(path.join(outDir, "README.md"), `# ${archetype}@1 pointed at ${slugName}

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
