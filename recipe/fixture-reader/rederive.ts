/**
 * RE-DERIVE a hand-written fixture from its own ledger through the role
 * schema, and say leaf by leaf where the schema agrees with the humans.
 *
 * This is the proof that a schema generalises: the three switch tables were
 * typed by hand with three sets of class selectors; if the drafted roles and
 * the archetype schema read the same values, the schema can replace them and
 * a fourth library needs only a role map.
 *
 *   npx tsx recipe/fixture-reader/rederive.ts --archetype switch --library mui
 */
import path from "node:path";

import { Ledger } from "./ledger.js";
import { tokenLeaves } from "./reader.js";
import { draftSwitchRoles } from "./draft-roles.js";
import { evaluate } from "./propose-fixture.js";
import { SWITCH_SPELLINGS, switchSchemaMappings, type SwitchComboMap, type SwitchRoles } from "./schema-switch.js";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const arg = (n: string): string | undefined => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : undefined; };
const archetype = arg("archetype"), library = arg("library");
if (archetype !== "switch" || !library) throw new Error("usage: --archetype switch --library <mui|antd|astryx-core|shadcn>");

const ledgerRel = `extract/computed/out/${library}/switch/captured-truth.json`;
const ledger = new Ledger(REPO, ledgerRel);
const draft = draftSwitchRoles(ledger);
console.log(`roles:  ${JSON.stringify(draft.roles)}`);
console.log(`combos: ${JSON.stringify(draft.combos)}`);
if (draft.unresolved.length) console.log(`unresolved: ${draft.unresolved.join(" | ").slice(0, 300)}`);

const fixtures = await import("../fixtures/library-switches.js") as Record<string, unknown>;
const slug = library === "astryx-core" ? "astryx" : library;
const config = fixtures[`${slug}SwitchAdapterConfig`] as { tokens: Record<string, unknown> } | undefined;
if (!config) throw new Error(`no hand fixture for ${library} (looked for ${slug}SwitchAdapterConfig) — nothing to re-derive against`);
const hand = tokenLeaves(config.tokens);
for (const k of ["rowAlign", "thumbShadow", "hitClips", "trackClips"]) if (k in config.tokens) hand.set(k, String(config.tokens[k]));
const typo = (config.tokens.typography as { label?: { resolvedFamily: string; resolvedStyle: string } })?.label;
if (typo) { hand.set("typography.label.family", typo.resolvedFamily); hand.set("typography.label.style", typo.resolvedStyle); }

if (draft.unresolved.length && !draft.combos["false.enabled"]) { console.log("cannot evaluate without a base combo"); process.exit(2); }
const combos = draft.combos as SwitchComboMap;
const roles = draft.roles as SwitchRoles;
const mappings = switchSchemaMappings(roles, { combos });
const evaluated = evaluate(ledger, mappings, new Map(), SWITCH_SPELLINGS);
let agree = 0, differ = 0, receipts = 0, refused = evaluated.refused.length;
const rows: string[] = [];
for (const m of mappings) {
  const l = evaluated.leaves[m.path];
  const h = hand.get(m.path);
  if (!l) { rows.push(`  REFUSED  ${m.path}`); continue; }
  const eq = typeof h === "number" && typeof l.value === "number" ? Math.abs(h - l.value) <= 0.01 : String(h).toLowerCase() === String(l.value).toLowerCase();
  if (l.from !== "ledger") { receipts += 1; rows.push(`  ${l.from === "spelling" ? "SPELLING" : "REVIEWED"} ${m.path} = ${JSON.stringify(l.value)} (hand ${JSON.stringify(h)})`); continue; }
  if (eq) { agree += 1; rows.push(`  agree    ${m.path} = ${JSON.stringify(l.value)}`); }
  else { differ += 1; rows.push(`  DIFFER   ${m.path}: schema ${JSON.stringify(l.value)} vs hand ${JSON.stringify(h)}   [${l.key?.split("#")[1]?.slice(0, 70)}]`); }
}
console.log(rows.join("\n"));
console.log(`\n${library}/switch: ${agree} agree · ${differ} differ · ${receipts} receipt/spelling · ${refused} refused  (hand leaves ${hand.size})`);
if (evaluated.refused.length) console.log(`refused:\n  - ${evaluated.refused.join("\n  - ")}`);
