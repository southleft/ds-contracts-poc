/**
 * PROPOSE AN tabs@1 FIXTURE FROM A CAPTURE LEDGER — same contract as the
 * checkbox and switch proposers: every leaf is read from the ledger, set by a
 * person with evidence, or an archetype spelling; anything else refuses by
 * name. The text are the label part's text.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { Ledger } from "./ledger.js";
import { evaluate, interactionRefusals, shadowRefusal, type Proposal } from "./propose-fixture.js";
import { TABS_SPELLINGS, tabsSchemaMappings, type TabsRoles } from "./schema-tabs.js";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const q = (s: unknown): string => JSON.stringify(s);

export interface TabsProposal {
  archetype: "tabs";
  library: string;
  ledger: string;
  provenance: { package: string; version: string; browser: string };
  roles: TabsRoles;
  combo: string;
  leaves: Proposal["leaves"];
  receipts: Proposal["receipts"];
  refused: string[];
  content: { selected: string; rest: string };
  typography: { rest: { family: string; style: string; stack: string }; selected: { family: string; style: string; stack: string } };
}

export interface ProposeTabsInput {
  library: string;
  ledger: string;
  roles: TabsRoles;
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

export function proposeTabsFixture(input: ProposeTabsInput): { proposal: TabsProposal; modulePath: string; proposalPath: string; refused: string[] } {
  const { library, roles, combo } = input;
  const sets = new Map<string, { value: string; why: string }>(Object.entries(input.sets ?? {}));
  const ledger = new Ledger(REPO, input.ledger);
  const truth = JSON.parse(readFileSync(path.join(REPO, input.ledger), "utf8")) as { _provenance: { library: string; browser: string } };
  const [pkg, version] = truth._provenance.library.split(/@(?=[^@]+$)/);
  const mappings = tabsSchemaMappings(roles, { combo });
  const evaluated = evaluate(ledger, mappings, sets, TABS_SPELLINGS);
  // An optional reviewed leaf outside the schema: the font this machine resolves to.
  const resolvedSet = sets.get("typography.label.resolved");
  if (resolvedSet) {
    if (!/^[^/]+\/[^/]+$/.test(resolvedSet.value)) evaluated.refused.push(`typography.label.resolved: give "Family/Style" (got ${JSON.stringify(resolvedSet.value)})`);
    else { evaluated.leaves["typography.label.resolved"] = { value: resolvedSet.value, from: "set", why: resolvedSet.why }; evaluated.receipts.push({ path: "typography.label.resolved", why: "the requested face is not on the minting machine", evidence: resolvedSet.why, value: resolvedSet.value }); }
  }
  const proposalPath = path.join(REPO, "recipe/fixture-reader/out/proposals", `tabs.${library}.json`);
  if (evaluated.refused.length > 0) {
    return { proposal: null as unknown as TabsProposal, modulePath: path.join(REPO, input.out), proposalPath, refused: evaluated.refused };
  }
  const key = `${combo}__default`;
  const textOf = (selector: string): string | null => {
    const part = ledger.capture(key).parts.find((p) => selectorMatches(p, selector));
    return (part?.text ?? []).map((x) => x.trim()).find((x) => x.length > 0) ?? null;
  };
  const selText = textOf(roles.selectedLabel ?? roles.selectedTab), restText = textOf(roles.restLabel ?? roles.restTab);
  if (!selText || !restText) {
    return { proposal: null as unknown as TabsProposal, modulePath: path.join(REPO, input.out), proposalPath, refused: [`content: the selected/rest tab parts carry no text in ${key}`] };
  }
  const typo = (which: "rest" | "selected") => ({ family: String(evaluated.leaves[`typography.${which}.family`]?.value ?? ""), style: String(evaluated.leaves[`typography.${which}.style`]?.value ?? ""), stack: ledger.raw(key, which === "rest" ? (roles.restLabel ?? roles.restTab) : (roles.selectedLabel ?? roles.selectedTab), "font-family") });
  const proposal: TabsProposal = {
    archetype: "tabs",
    library,
    ledger: input.ledger,
    provenance: { package: pkg!, version: version!, browser: truth._provenance.browser },
    roles,
    combo,
    ...evaluated,
    content: { selected: selText, rest: restText },
    typography: { rest: typo("rest"), selected: typo("selected") },
  };
  const module = renderTabsModule(proposal, {
    slug: library,
    displayName: input.displayName ?? library,
    exportName: input.exportName ?? "Tabs",
    sourceRoot: input.sourceRoot ?? `extract/computed/out/${library}`,
    unsupported: input.unsupported ?? [],
  });
  mkdirSync(path.dirname(path.join(REPO, input.out)), { recursive: true });
  writeFileSync(path.join(REPO, input.out), module);
  mkdirSync(path.dirname(proposalPath), { recursive: true });
  writeFileSync(proposalPath, `${JSON.stringify(proposal, null, 2)}\n`);
  return { proposal, modulePath: path.join(REPO, input.out), proposalPath, refused: [] };
}


/**
 * The label's font spec. A reviewed `typography.label.resolved` = "Family/Style"
 * (given with --set … --why) declares that the requested face is NOT on the
 * minting machine and names the fallback the writer will find, so the
 * provenance the writer checks is declared, never guessed.
 */
function fontBlock(p: TabsProposal, which: "rest" | "selected"): string {
  const ty = p.typography[which];
  const resolved = p.leaves["typography.label.resolved"];
  const [rf, rs] = resolved ? String(resolved.value).split("/") : [ty.family, ty.style];
  return `{
    requestedFamily: ${q(ty.family)},
    requestedStyle: ${q(ty.style)},
    requestSource: ${q(`${p.ledger} ${which} tab font-family/font-weight: ${ty.stack.slice(0, 80)} / ${ty.style}${resolved ? `; reviewed fallback: ${resolved.why}` : ""}`)},
    fallbackChain: [
      { family: ${q(ty.family)}, style: ${q(ty.style)} },
      { family: ${q(rf)}, style: ${q(resolved ? rs : ty.style)} },
    ],
    resolvedFamily: ${q(rf)},
    resolvedStyle: ${q(resolved ? rs : ty.style)},
    resolution: ${q(resolved ? "fallback" : "requested")},${resolved ? `\n    degradation: ${q(`the requested face ${ty.family} ${ty.style} is not on the minting machine; minted with ${rf} ${rs} — ${resolved.why}`)},` : ""}
  }`;
}

/** Carbon draws a bottom border on REST tabs too; tabs@1 carries one indicator under the selected tab, so a rest-tab border is refused by name. */
function restBorderRefusal(ledger: Ledger, combo: string, roles: TabsRoles): Array<{ id: string; evidence: string; target: string; reason: "refused-by-recipe" }> {
  let w = "0px", c = "";
  try { w = ledger.raw(`${combo}__default`, roles.restTab, "border-bottom-width"); c = ledger.raw(`${combo}__default`, roles.restTab, "border-bottom-color"); } catch { return []; }
  if (!/^[1-9]/.test(w.trim())) return [];
  return [{ id: "refusal-rest-tab-border", evidence: `${ledger.file}#${combo}__default ${roles.restTab}.border-bottom = ${w} ${c}; tabs@1 draws one indicator under the selected tab and no border under a rest tab`, target: "rest tab bottom border", reason: "refused-by-recipe" as const }];
}

const STRING_LEAVES = new Set(["lineHeightUnit", "textCase", "tab.contentAlign", "typography.label.resolved"]);

export function renderTabsModule(p: TabsProposal, opts: { slug: string; displayName: string; exportName: string; sourceRoot: string; unsupported: string[] }): string {
  const tokenLines = Object.entries(p.leaves)
    .filter(([k]) => !k.startsWith("typography.") && !STRING_LEAVES.has(k))
    .map(([k, v]) => `  ${q(k)}: ${q(v.value)}, // ${v.from === "ledger" ? `ledger ${v.key}` : v.from === "spelling" ? `archetype spelling: ${v.why}` : `reviewed: ${v.why}`}`)
    .join("\n");
  const receiptRows = [
    ...p.receipts.map((r) => `  { id: ${q(`receipt-${r.path.replace(/\./g, "-")}`)}, evidence: ${q(`${r.why} — ${r.evidence}`)}, target: ${q(`${opts.displayName} ${r.path}`)}, reason: "lowered" as const },`),
    ...restBorderRefusal(new Ledger(REPO, p.ledger), p.combo, p.roles).map((r) => `  { id: ${q(r.id)}, evidence: ${q(r.evidence)}, target: ${q(`${opts.displayName} ${r.target}`)}, reason: ${q(r.reason)} as const },`),
    ...shadowRefusal(new Ledger(REPO, p.ledger), p.combo, p.roles.selectedTab, p.archetype).map((r) => `  { id: ${q(r.id)}, evidence: ${q(r.evidence)}, target: ${q(`${opts.displayName} ${r.target}`)}, reason: ${q(r.reason)} as const },`),
    ...interactionRefusals(new Ledger(REPO, p.ledger), p.archetype).map((r) => `  { id: ${q(r.id)}, evidence: ${q(r.evidence)}, target: ${q(`${opts.displayName} ${r.target}`)}, reason: ${q(r.reason)} as const },`),
  ].join("\n");
    const slug = opts.slug.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  return `// GENERATED by recipe/fixture-reader/propose-tabs.ts — do not edit by hand.
// Source of every value: the capture ledger ${p.ledger} (${p.provenance.package}@${p.provenance.version},
// ${p.provenance.browser}) read through the tabs@1 role schema; every leaf
// names its ledger key or its reviewed evidence. Re-run the proposer to regenerate.
import type { ReviewedTabsSource } from "../../adapters/tabs.js";
import { anatomyFacts, buildConfig, cloneTokens, makeRefusals } from "../library-tabs.js";
import { tabsSchemaMappings, type TabsRoles } from "../../fixture-reader/schema-tabs.js";

export const ${slug.toUpperCase()}_TABS_LEDGER = ${q(p.ledger)};
export const ${slug}TabsCombo = ${q(p.combo)};

export const ${slug}TabsRoles: TabsRoles = ${JSON.stringify(p.roles, null, 2)};

const VALUES: Record<string, number | string> = {
${tokenLines}
};

const ${slug}Tokens = cloneTokens(${q(`${opts.slug}.tabs`)}, (path) => {
  if (!(path in VALUES)) throw new Error(${q(`${opts.slug} avatar fixture: no proposed value for `)} + path);
  return VALUES[path]!;
});
${slug}Tokens.lineHeightUnit = ${q(String(p.leaves["lineHeightUnit"]!.value))} as "px" | "auto" | "percent";
${slug}Tokens.textCase = ${q(String(p.leaves["textCase"]!.value))} as "original" | "upper";
${slug}Tokens.tab.contentAlign = ${q(String(p.leaves["tab.contentAlign"]!.value))} as "start" | "center";
${slug}Tokens.typography = { rest: ${fontBlock(p, "rest")}, selected: ${fontBlock(p, "selected")} };

export const ${slug}TabsSource: ReviewedTabsSource = {
  packageName: ${q(p.provenance.package)},
  version: ${q(p.provenance.version)},
  exportName: ${q(opts.exportName)},
  framework: "react",
  sourceRoot: ${q(opts.sourceRoot)},
  anatomy: {
    root: ${q(`ledger part ${p.roles.list} (list)`)},
    control: ${q(`ledger parts ${p.roles.selectedTab} (selected) / ${p.roles.restTab} (rest); indicator ${p.roles.indicator ?? (p.roles.indicatorIsBorder ? "= the selected tab's bottom border" : "none")}`)},
    label: ${q(`${p.typography.selected.family} ${p.typography.selected.style} ${p.leaves["labelFontSize"]?.value}px; "${p.content.selected}" / "${p.content.rest}"`)},
  },
  api: { generated: "proposed from the capture ledger; no API review" },
  styleSources: [${q(p.ledger)}],
  fontSources: [${q(`${p.ledger} tab labels`)}],
};

const ${slug}Refusals = makeRefusals(${q(opts.slug)}, [
${receiptRows}
]);

export const ${slug}TabsAdapterConfig = buildConfig(
  ${q(opts.slug)},
  ${slug}TabsSource,
  ${slug}Tokens,
  { id: ${q(`${opts.slug}.tabs`)}, name: ${q(`${opts.displayName} Tabs`)} },
  ${slug}Refusals,
  anatomyFacts(${q(opts.slug)}, ${slug}TabsSource),
  ${q(opts.unsupported)},
  ${q(p.content)},
);

/** The same schema the proposer evaluated, for the drift gate. */
export const ${slug}TabsMappings = tabsSchemaMappings(${slug}TabsRoles, { combo: ${slug}TabsCombo, receipts: ${q(Object.fromEntries(p.receipts.map((r) => [r.path, { why: r.why, evidence: r.evidence }])))} });
`;
}
