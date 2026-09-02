/**
 * PROPOSE AN tooltip@1 FIXTURE FROM A CAPTURE LEDGER — same contract as the
 * checkbox and switch proposers: every leaf is read from the ledger, set by a
 * person with evidence, or an archetype spelling; anything else refuses by
 * name. The text are the label part's text.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { Ledger } from "./ledger.js";
import { evaluate, floatingRefusals, interactionRefusals, shadowRefusal, type Proposal } from "./propose-fixture.js";
import { TOOLTIP_SPELLINGS, tooltipSchemaMappings, type TooltipRoles } from "./schema-tooltip.js";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const q = (s: unknown): string => JSON.stringify(s);

export interface TooltipProposal {
  archetype: "tooltip";
  library: string;
  ledger: string;
  provenance: { package: string; version: string; browser: string };
  roles: TooltipRoles;
  combo: string;
  leaves: Proposal["leaves"];
  receipts: Proposal["receipts"];
  refused: string[];
  content: { label: string };
  typography: { family: string; style: string; stack: string };
}

export interface ProposeTooltipInput {
  library: string;
  ledger: string;
  roles: TooltipRoles;
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

export function proposeTooltipFixture(input: ProposeTooltipInput): { proposal: TooltipProposal; modulePath: string; proposalPath: string; refused: string[] } {
  const { library, roles, combo } = input;
  const sets = new Map<string, { value: string; why: string }>(Object.entries(input.sets ?? {}));
  const ledger = new Ledger(REPO, input.ledger);
  const truth = JSON.parse(readFileSync(path.join(REPO, input.ledger), "utf8")) as { _provenance: { library: string; browser: string } };
  const [pkg, version] = truth._provenance.library.split(/@(?=[^@]+$)/);
  const mappings = tooltipSchemaMappings(roles, { combo });
  const evaluated = evaluate(ledger, mappings, sets, TOOLTIP_SPELLINGS);
  // An optional reviewed leaf outside the schema: the font this machine resolves to.
  const resolvedSet = sets.get("typography.label.resolved");
  if (resolvedSet) {
    if (!/^[^/]+\/[^/]+$/.test(resolvedSet.value)) evaluated.refused.push(`typography.label.resolved: give "Family/Style" (got ${JSON.stringify(resolvedSet.value)})`);
    else { evaluated.leaves["typography.label.resolved"] = { value: resolvedSet.value, from: "set", why: resolvedSet.why }; evaluated.receipts.push({ path: "typography.label.resolved", why: "the requested face is not on the minting machine", evidence: resolvedSet.why, value: resolvedSet.value }); }
  }
  const proposalPath = path.join(REPO, "recipe/fixture-reader/out/proposals", `tooltip.${library}.json`);
  if (evaluated.refused.length > 0) {
    return { proposal: null as unknown as TooltipProposal, modulePath: path.join(REPO, input.out), proposalPath, refused: evaluated.refused };
  }
  const key = `${combo}__default`;
  const labelSel = roles.label ?? roles.box;
  const labelPart = ledger.capture(key).parts.find((p) => selectorMatches(p, labelSel));
  const text = (labelPart?.text ?? []).map((t) => t.trim()).find((t) => t.length > 0);
  if (!text) {
    return { proposal: null as unknown as TooltipProposal, modulePath: path.join(REPO, input.out), proposalPath, refused: [`content.label: the label part ${labelSel} carries no text in ${key} — tooltip@1 needs text`] };
  }
  const family = String(evaluated.leaves["typography.label.family"]?.value ?? "");
  const style = String(evaluated.leaves["typography.label.style"]?.value ?? "");
  const stack = ledger.raw(key, labelSel, "font-family");
  const proposal: TooltipProposal = {
    archetype: "tooltip",
    library,
    ledger: input.ledger,
    provenance: { package: pkg!, version: version!, browser: truth._provenance.browser },
    roles,
    combo,
    ...evaluated,
    content: { label: text },
    typography: { family, style, stack },
  };
  const module = renderTooltipModule(proposal, {
    slug: library,
    displayName: input.displayName ?? library,
    exportName: input.exportName ?? "Tooltip",
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
function typographyBlock(p: TooltipProposal, style: string): string {
  const resolved = p.leaves["typography.label.resolved"];
  const [rf, rs] = resolved ? String(resolved.value).split("/") : [p.typography.family, style];
  const fallback = resolved ? "fallback" : "requested";
  return `{
  label: {
    requestedFamily: ${q(p.typography.family)},
    requestedStyle: ${q(style)},
    requestSource: ${q(`${p.ledger} label font-family/font-weight: ${p.typography.stack.slice(0, 80)} / ${style}${resolved ? `; reviewed fallback: ${resolved.why}` : ""}`)},
    fallbackChain: [
      { family: ${q(p.typography.family)}, style: ${q(style)} },
      { family: ${q(rf)}, style: ${q(rs)} },
    ],
    resolvedFamily: ${q(rf)},
    resolvedStyle: ${q(rs)},
    resolution: ${q(fallback)},${resolved ? `\n    degradation: ${q(`the requested face ${p.typography.family} ${style} is not on the minting machine; minted with ${rf} ${rs} — ${resolved.why}`)},` : ""}
  },
}`;
}

const STRING_LEAVES = new Set(["strokeAlign", "lineHeightUnit", "decoration", "typography.label.resolved"]);

export function renderTooltipModule(p: TooltipProposal, opts: { slug: string; displayName: string; exportName: string; sourceRoot: string; unsupported: string[] }): string {
  const tokenLines = Object.entries(p.leaves)
    .filter(([k]) => !k.startsWith("typography.") && !STRING_LEAVES.has(k))
    .map(([k, v]) => `  ${q(k)}: ${q(v.value)}, // ${v.from === "ledger" ? `ledger ${v.key}` : v.from === "spelling" ? `archetype spelling: ${v.why}` : `reviewed: ${v.why}`}`)
    .join("\n");
  const receiptRows = [
    ...p.receipts.map((r) => `  { id: ${q(`receipt-${r.path.replace(/\./g, "-")}`)}, evidence: ${q(`${r.why} — ${r.evidence}`)}, target: ${q(`${opts.displayName} ${r.path}`)}, reason: "lowered" as const },`),
    ...floatingRefusals(new Ledger(REPO, p.ledger), p.combo, p.roles.box, p.archetype).map((r) => `  { id: ${q(r.id)}, evidence: ${q(r.evidence)}, target: ${q(`${opts.displayName} ${r.target}`)}, reason: ${q(r.reason)} as const },`),
    ...shadowRefusal(new Ledger(REPO, p.ledger), p.combo, p.roles.box, p.archetype).map((r) => `  { id: ${q(r.id)}, evidence: ${q(r.evidence)}, target: ${q(`${opts.displayName} ${r.target}`)}, reason: ${q(r.reason)} as const },`),
    ...interactionRefusals(new Ledger(REPO, p.ledger), p.archetype).map((r) => `  { id: ${q(r.id)}, evidence: ${q(r.evidence)}, target: ${q(`${opts.displayName} ${r.target}`)}, reason: ${q(r.reason)} as const },`),
  ].join("\n");
  const style = p.typography.style;
  const slug = opts.slug.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  return `// GENERATED by recipe/fixture-reader/propose-tooltip.ts — do not edit by hand.
// Source of every value: the capture ledger ${p.ledger} (${p.provenance.package}@${p.provenance.version},
// ${p.provenance.browser}) read through the tooltip@1 role schema; every leaf
// names its ledger key or its reviewed evidence. Re-run the proposer to regenerate.
import type { ReviewedTooltipSource } from "../../adapters/tooltip.js";
import { anatomyFacts, buildConfig, cloneTokens, makeRefusals } from "../library-tooltips.js";
import { tooltipSchemaMappings, type TooltipRoles } from "../../fixture-reader/schema-tooltip.js";

export const ${slug.toUpperCase()}_TOOLTIP_LEDGER = ${q(p.ledger)};
export const ${slug}TooltipCombo = ${q(p.combo)};

export const ${slug}TooltipRoles: TooltipRoles = ${JSON.stringify(p.roles, null, 2)};

const VALUES: Record<string, number | string> = {
${tokenLines}
};

const ${slug}Tokens = cloneTokens(${q(`${opts.slug}.tooltip`)}, (path) => {
  if (!(path in VALUES)) throw new Error(${q(`${opts.slug} avatar fixture: no proposed value for `)} + path);
  return VALUES[path]!;
});
${slug}Tokens.strokeAlign = ${q(String(p.leaves["strokeAlign"]!.value))} as "inside" | "outside";
${slug}Tokens.lineHeightUnit = ${q(String(p.leaves["lineHeightUnit"]!.value))} as "px" | "auto";
${slug}Tokens.decoration = ${q(String(p.leaves["decoration"]!.value))} as "none" | "underline";
${slug}Tokens.typography = ${typographyBlock(p, style)};

export const ${slug}TooltipSource: ReviewedTooltipSource = {
  packageName: ${q(p.provenance.package)},
  version: ${q(p.provenance.version)},
  exportName: ${q(opts.exportName)},
  framework: "react",
  sourceRoot: ${q(opts.sourceRoot)},
  anatomy: {
    root: ${q(`ledger part ${p.roles.box} (box)`)},
    control: ${q(`ledger part ${p.roles.box}: ${p.leaves["box.height"]?.value}px, radius ${p.leaves["box.radius"]?.value}, border ${p.leaves["box.borderWidth"]?.value}`)},
    label: ${q(`ledger part ${p.roles.label ?? p.roles.box}: ${p.typography.family} ${style} ${p.leaves["labelFontSize"]?.value}px / ${p.leaves["labelLineHeight"]?.value}px; text ${JSON.stringify(p.content.label)}`)},
  },
  api: { generated: "proposed from the capture ledger; no API review" },
  styleSources: [${q(p.ledger)}],
  fontSources: [${q(`${p.ledger} label`)}],
};

const ${slug}Refusals = makeRefusals(${q(opts.slug)}, [
${receiptRows}
]);

export const ${slug}TooltipAdapterConfig = buildConfig(
  ${q(opts.slug)},
  ${slug}TooltipSource,
  ${slug}Tokens,
  { id: ${q(`${opts.slug}.tooltip`)}, name: ${q(`${opts.displayName} Tooltip`)} },
  ${slug}Refusals,
  anatomyFacts(${q(opts.slug)}, ${slug}TooltipSource),
  ${q(opts.unsupported)},
  ${q(p.content)},
);

/** The same schema the proposer evaluated, for the drift gate. */
export const ${slug}TooltipMappings = tooltipSchemaMappings(${slug}TooltipRoles, { combo: ${slug}TooltipCombo, receipts: ${q(Object.fromEntries(p.receipts.map((r) => [r.path, { why: r.why, evidence: r.evidence }])))} });
`;
}
