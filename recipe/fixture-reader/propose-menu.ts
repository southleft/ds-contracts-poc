/**
 * PROPOSE A menu@1 FIXTURE FROM A CAPTURE LEDGER — the contract of every
 * other proposer: each leaf is read from the ledger, set by a person with
 * evidence, or an archetype spelling; anything else refuses by name. The two
 * items' texts are the first two text-carrying siblings' texts.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { Ledger } from "./ledger.js";
import { evaluate, interactionRefusals, shadowRefusal, type Proposal } from "./propose-fixture.js";
import { MENU_SPELLINGS, menuSchemaMappings, type MenuRoles } from "./schema-menu.js";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const q = (s: unknown): string => JSON.stringify(s);

export interface MenuProposal {
  archetype: "menu";
  library: string;
  ledger: string;
  provenance: { package: string; version: string; browser: string };
  roles: MenuRoles;
  combo: string;
  leaves: Proposal["leaves"];
  receipts: Proposal["receipts"];
  refused: string[];
  content: { first: string; second: string };
  typography: { family: string; style: string; stack: string };
}

export interface ProposeMenuInput {
  library: string;
  ledger: string;
  roles: MenuRoles;
  combo: string;
  sets?: Record<string, { value: string; why: string }>;
  displayName?: string;
  exportName?: string;
  sourceRoot?: string;
  unsupported?: string[];
  out: string;
}

const selectorMatches = (part: { idxPath: string; tag: string; classes: string[] }, selector: string): boolean =>
  selector === "root" ? part.idxPath === "" : selector.startsWith("idx:") ? part.idxPath === selector.slice(4) : selector.startsWith("cls:") ? part.classes.includes(selector.slice(4)) : selector.startsWith("tag:") ? part.tag === selector.slice(4) : false;
const parentOf = (idx: string): string | null => (idx === "" ? null : idx.includes(".") ? idx.slice(0, idx.lastIndexOf(".")) : "");

export function proposeMenuFixture(input: ProposeMenuInput): { proposal: MenuProposal; modulePath: string; proposalPath: string; refused: string[] } {
  const { library, roles, combo } = input;
  const sets = new Map<string, { value: string; why: string }>(Object.entries(input.sets ?? {}));
  const ledger = new Ledger(REPO, input.ledger);
  const truth = JSON.parse(readFileSync(path.join(REPO, input.ledger), "utf8")) as { _provenance: { library: string; browser: string } };
  const [pkg, version] = truth._provenance.library.split(/@(?=[^@]+$)/);
  const evaluated = evaluate(ledger, menuSchemaMappings(roles, { combo }), sets, MENU_SPELLINGS);
  const resolvedSet = sets.get("typography.label.resolved");
  if (resolvedSet) {
    if (!/^[^/]+\/[^/]+$/.test(resolvedSet.value)) evaluated.refused.push(`typography.label.resolved: give "Family/Style" (got ${JSON.stringify(resolvedSet.value)})`);
    else { evaluated.leaves["typography.label.resolved"] = { value: resolvedSet.value, from: "set", why: resolvedSet.why }; evaluated.receipts.push({ path: "typography.label.resolved", why: "the requested face is not on the minting machine", evidence: resolvedSet.why, value: resolvedSet.value }); }
  }
  const proposalPath = path.join(REPO, "recipe/fixture-reader/out/proposals", `menu.${library}.json`);
  const modulePath = path.join(REPO, input.out);
  if (evaluated.refused.length > 0) return { proposal: null as unknown as MenuProposal, modulePath, proposalPath, refused: evaluated.refused };
  // content: the first item and its next text-carrying sibling
  const key = `${combo}__default`;
  const parts = ledger.capture(key).parts;
  const first = parts.find((p) => selectorMatches(p, roles.item));
  if (!first) return { proposal: null as unknown as MenuProposal, modulePath, proposalPath, refused: [`content: the item ${roles.item} is not in the capture at ${key}`] };
  const textOf = (p: { idxPath: string; text: string[] }): string | undefined =>
    [p, ...parts.filter((c) => c.idxPath.startsWith(p.idxPath + "."))].flatMap((c) => c.text).map((t) => t.trim()).find((t) => t.length > 0);
  const siblings = parts.filter((p) => parentOf(p.idxPath) === parentOf(first.idxPath) && textOf(p) !== undefined);
  const texts = siblings.map((p) => textOf(p)!);
  if (texts.length < 2) return { proposal: null as unknown as MenuProposal, modulePath, proposalPath, refused: [`content: menu@1 draws two items; the capture carries ${texts.length} text-carrying item(s) under ${parentOf(first.idxPath) || "root"}`] };
  const family = String(evaluated.leaves["typography.label.family"]?.value ?? "");
  const style = String(evaluated.leaves["typography.label.style"]?.value ?? "");
  const stack = ledger.raw(key, roles.label ?? roles.item, "font-family");
  const proposal: MenuProposal = {
    archetype: "menu",
    library,
    ledger: input.ledger,
    provenance: { package: pkg!, version: version!, browser: truth._provenance.browser },
    roles,
    combo,
    ...evaluated,
    content: { first: texts[0]!, second: texts[1]! },
    typography: { family, style, stack },
  };
  const module = renderMenuModule(proposal, {
    slug: library,
    displayName: input.displayName ?? library,
    exportName: input.exportName ?? "Menu",
    sourceRoot: input.sourceRoot ?? `extract/computed/out/${library}`,
    unsupported: input.unsupported ?? [],
    itemsCaptured: texts.length,
  });
  mkdirSync(path.dirname(modulePath), { recursive: true });
  writeFileSync(modulePath, module);
  mkdirSync(path.dirname(proposalPath), { recursive: true });
  writeFileSync(proposalPath, `${JSON.stringify(proposal, null, 2)}\n`);
  return { proposal, modulePath, proposalPath, refused: [] };
}

function typographyBlock(p: MenuProposal, style: string): string {
  const resolved = p.leaves["typography.label.resolved"];
  const [rf, rs] = resolved ? String(resolved.value).split("/") : [p.typography.family, style];
  return `{
  label: {
    requestedFamily: ${q(p.typography.family)},
    requestedStyle: ${q(style)},
    requestSource: ${q(`${p.ledger} item font-family/font-weight: ${p.typography.stack.slice(0, 80)} / ${style}${resolved ? `; reviewed fallback: ${resolved.why}` : ""}`)},
    fallbackChain: [
      { family: ${q(p.typography.family)}, style: ${q(style)} },
      { family: ${q(rf)}, style: ${q(rs)} },
    ],
    resolvedFamily: ${q(rf)},
    resolvedStyle: ${q(rs)},
    resolution: ${q(resolved ? "fallback" : "requested")},${resolved ? `\n    degradation: ${q(`the requested face ${p.typography.family} ${style} is not on the minting machine; minted with ${rf} ${rs} — ${resolved.why}`)},` : ""}
  },
}`;
}

const STRING_LEAVES = new Set(["lineHeightUnit", "typography.label.resolved"]);

export function renderMenuModule(p: MenuProposal, opts: { slug: string; displayName: string; exportName: string; sourceRoot: string; unsupported: string[]; itemsCaptured: number }): string {
  const tokenLines = Object.entries(p.leaves)
    .filter(([k]) => !k.startsWith("typography.") && !STRING_LEAVES.has(k))
    .map(([k, v]) => `  ${q(k)}: ${q(v.value)}, // ${v.from === "ledger" ? `ledger ${v.key}` : v.from === "spelling" ? `archetype spelling: ${v.why}` : `reviewed: ${v.why}`}${v.formula ? ` — ${v.formula}` : ""}`)
    .join("\n");
  const ledger = new Ledger(REPO, p.ledger);
  const extra: string[] = [];
  if (opts.itemsCaptured > 2) extra.push(`  { id: "refusal-extra-items", evidence: ${q(`the capture mounts ${opts.itemsCaptured} items; menu@1 draws two (first, second) and the rest are not carried`)}, target: ${q(`${opts.displayName} items beyond the second`)}, reason: "refused-by-recipe" },`);
  const receiptRows = [
    ...p.receipts.map((r) => `  { id: ${q(`receipt-${r.path.replace(/\./g, "-")}`)}, evidence: ${q(`${r.why} — ${r.evidence}`)}, target: ${q(`${opts.displayName} ${r.path}`)}, reason: "refused-by-recipe" },`),
    ...extra,
    ...shadowRefusal(ledger, p.combo, p.roles.panel, p.archetype).map((r) => `  { id: ${q(r.id)}, evidence: ${q(r.evidence)}, target: ${q(`${opts.displayName} ${r.target}`)}, reason: ${q(r.reason)} },`),
    ...interactionRefusals(ledger, p.archetype).map((r) => `  { id: ${q(r.id)}, evidence: ${q(r.evidence)}, target: ${q(`${opts.displayName} ${r.target}`)}, reason: ${q(r.reason)} },`),
  ].join("\n");
  const style = p.typography.style;
  const slug = opts.slug.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  return `// GENERATED by recipe/fixture-reader/propose-menu.ts — do not edit by hand.
// Source of every value: the capture ledger ${p.ledger} (${p.provenance.package}@${p.provenance.version},
// ${p.provenance.browser}) read through the menu@1 role schema; every leaf
// names its ledger key or its reviewed evidence. Re-run the proposer to regenerate.
import type { ReviewedMenuSource } from "../../adapters/menu.js";
import { anatomyFacts, buildConfig, cloneTokens, makeRefusals } from "../library-menus.js";
import { menuSchemaMappings, type MenuRoles } from "../../fixture-reader/schema-menu.js";

export const ${slug.toUpperCase()}_MENU_LEDGER = ${q(p.ledger)};
export const ${slug}MenuCombo = ${q(p.combo)};

export const ${slug}MenuRoles: MenuRoles = ${JSON.stringify(p.roles, null, 2)};

const VALUES: Record<string, number | string> = {
${tokenLines}
};

const ${slug}Tokens = cloneTokens(${q(`${opts.slug}.menu`)}, (path) => {
  if (!(path in VALUES)) throw new Error(${q(`${opts.slug} menu fixture: no proposed value for `)} + path);
  return VALUES[path]!;
});
${slug}Tokens.lineHeightUnit = ${q(String(p.leaves["lineHeightUnit"]!.value))} as "px" | "auto";
${slug}Tokens.typography = ${typographyBlock(p, style)};

export const ${slug}MenuSource: ReviewedMenuSource = {
  packageName: ${q(p.provenance.package)},
  version: ${q(p.provenance.version)},
  exportName: ${q(opts.exportName)},
  framework: "react",
  sourceRoot: ${q(opts.sourceRoot)},
  anatomy: {
    root: ${q(`ledger part ${p.roles.panel} (panel): radius ${p.leaves["panel.radius"]?.value}, padding ${p.leaves["panel.padding"]?.value}${p.roles.list ? ` (list ${p.roles.list})` : ""}`)},
    control: ${q(`ledger part ${p.roles.item} (item): padding ${p.leaves["item.paddingY"]?.value}/${p.leaves["item.paddingX"]?.value}, min-height ${p.leaves["item.minHeight"]?.value}; ${opts.itemsCaptured} captured`)},
    label: ${q(`ledger part ${p.roles.label ?? p.roles.item}: ${p.typography.family} ${style} ${p.leaves["labelFontSize"]?.value}px / ${p.leaves["labelLineHeight"]?.value}px; items ${JSON.stringify(p.content.first)}, ${JSON.stringify(p.content.second)}`)},
  },
  api: { generated: "proposed from the capture ledger; no API review" },
  styleSources: [${q(p.ledger)}],
  fontSources: [${q(`${p.ledger} item`)}],
};

const ${slug}Refusals = makeRefusals(${q(opts.slug)}, [
${receiptRows}
]);

export const ${slug}MenuAdapterConfig = buildConfig(
  ${q(opts.slug)},
  ${slug}MenuSource,
  ${slug}Tokens,
  { id: ${q(`${opts.slug}.menu`)}, name: ${q(`${opts.displayName} Menu`)} },
  ${slug}Refusals,
  anatomyFacts(${q(opts.slug)}, ${slug}MenuSource),
  ${q(opts.unsupported)},
  ${q(p.content)},
);

/** The same schema the proposer evaluated, for the drift gate. */
export const ${slug}MenuMappings = menuSchemaMappings(${slug}MenuRoles, { combo: ${slug}MenuCombo, receipts: ${q(Object.fromEntries(p.receipts.map((r) => [r.path, { why: r.why, evidence: r.evidence }])))} });
`;
}
