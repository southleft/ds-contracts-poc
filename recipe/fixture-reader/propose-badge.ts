/**
 * PROPOSE A badge@1 FIXTURE FROM A CAPTURE LEDGER — the contract of every
 * other proposer: each leaf is read from the ledger, set by a person with
 * evidence, or an archetype spelling; anything else refuses by name. The
 * count is the label part's text.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { Ledger } from "./ledger.js";
import { evaluate, interactionRefusals, shadowRefusal, type Proposal } from "./propose-fixture.js";
import { BADGE_SPELLINGS, badgeSchemaMappings, outsetRing, type BadgeRoles } from "./schema-badge.js";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const q = (s: unknown): string => JSON.stringify(s);

export interface BadgeProposal {
  archetype: "badge";
  library: string;
  ledger: string;
  provenance: { package: string; version: string; browser: string };
  roles: BadgeRoles;
  combo: string;
  leaves: Proposal["leaves"];
  receipts: Proposal["receipts"];
  refused: string[];
  content: { count: string };
  typography: { family: string; style: string; stack: string };
}

export interface ProposeBadgeInput {
  library: string;
  ledger: string;
  roles: BadgeRoles;
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

export function proposeBadgeFixture(input: ProposeBadgeInput): { proposal: BadgeProposal; modulePath: string; proposalPath: string; refused: string[] } {
  const { library, roles, combo } = input;
  const sets = new Map<string, { value: string; why: string }>(Object.entries(input.sets ?? {}));
  const ledger = new Ledger(REPO, input.ledger);
  const truth = JSON.parse(readFileSync(path.join(REPO, input.ledger), "utf8")) as { _provenance: { library: string; browser: string } };
  const [pkg, version] = truth._provenance.library.split(/@(?=[^@]+$)/);
  const evaluated = evaluate(ledger, badgeSchemaMappings(roles, { combo }), sets, BADGE_SPELLINGS);
  const resolvedSet = sets.get("typography.label.resolved");
  if (resolvedSet) {
    if (!/^[^/]+\/[^/]+$/.test(resolvedSet.value)) evaluated.refused.push(`typography.label.resolved: give "Family/Style" (got ${JSON.stringify(resolvedSet.value)})`);
    else { evaluated.leaves["typography.label.resolved"] = { value: resolvedSet.value, from: "set", why: resolvedSet.why }; evaluated.receipts.push({ path: "typography.label.resolved", why: "the requested face is not on the minting machine", evidence: resolvedSet.why, value: resolvedSet.value }); }
  }
  const proposalPath = path.join(REPO, "recipe/fixture-reader/out/proposals", `badge.${library}.json`);
  const modulePath = path.join(REPO, input.out);
  if (evaluated.refused.length > 0) return { proposal: null as unknown as BadgeProposal, modulePath, proposalPath, refused: evaluated.refused };
  const key = `${combo}__default`;
  const labelSel = roles.label ?? roles.indicator;
  const parts = ledger.capture(key).parts;
  const labelPart = parts.find((p) => selectorMatches(p, labelSel));
  // the count may sit on a descendant of the label part (AntD nests it three deep)
  const text = [labelPart, ...parts.filter((p) => labelPart && p.idxPath.startsWith(labelPart.idxPath + "."))]
    .flatMap((p) => p?.text ?? []).map((t) => t.trim()).find((t) => t.length > 0);
  if (!text) return { proposal: null as unknown as BadgeProposal, modulePath, proposalPath, refused: [`content.count: the pip ${labelSel} carries no text at ${key}`] };
  const family = String(evaluated.leaves["typography.label.family"]?.value ?? "");
  const style = String(evaluated.leaves["typography.label.style"]?.value ?? "");
  const stack = ledger.raw(key, labelSel, "font-family");
  const proposal: BadgeProposal = {
    archetype: "badge",
    library,
    ledger: input.ledger,
    provenance: { package: pkg!, version: version!, browser: truth._provenance.browser },
    roles,
    combo,
    ...evaluated,
    content: { count: text },
    typography: { family, style, stack },
  };
  const module = renderBadgeModule(proposal, {
    slug: library,
    displayName: input.displayName ?? library,
    exportName: input.exportName ?? "Badge",
    sourceRoot: input.sourceRoot ?? `extract/computed/out/${library}`,
    unsupported: input.unsupported ?? [],
  });
  mkdirSync(path.dirname(modulePath), { recursive: true });
  writeFileSync(modulePath, module);
  mkdirSync(path.dirname(proposalPath), { recursive: true });
  writeFileSync(proposalPath, `${JSON.stringify(proposal, null, 2)}\n`);
  return { proposal, modulePath, proposalPath, refused: [] };
}

function typographyBlock(p: BadgeProposal, style: string): string {
  const resolved = p.leaves["typography.label.resolved"];
  const [rf, rs] = resolved ? String(resolved.value).split("/") : [p.typography.family, style];
  return `{
  label: {
    requestedFamily: ${q(p.typography.family)},
    requestedStyle: ${q(style)},
    requestSource: ${q(`${p.ledger} count font-family/font-weight: ${p.typography.stack.slice(0, 80)} / ${style}${resolved ? `; reviewed fallback: ${resolved.why}` : ""}`)},
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

const STRING_LEAVES = new Set(["strokeAlign", "typography.label.resolved"]);

export function renderBadgeModule(p: BadgeProposal, opts: { slug: string; displayName: string; exportName: string; sourceRoot: string; unsupported: string[] }): string {
  const tokenLines = Object.entries(p.leaves)
    .filter(([k]) => !k.startsWith("typography.") && !STRING_LEAVES.has(k))
    .map(([k, v]) => `  ${q(k)}: ${q(v.value)}, // ${v.from === "ledger" ? `ledger ${v.key}` : v.from === "spelling" ? `archetype spelling: ${v.why}` : `reviewed: ${v.why}`}${v.formula ? ` — ${v.formula}` : ""}`)
    .join("\n");
  const ledger = new Ledger(REPO, p.ledger);
  const extra: string[] = [];
  try {
    const sh = ledger.raw(`${p.combo}__default`, p.roles.indicator, "box-shadow");
    if (outsetRing(sh)) extra.push(`  { id: "refusal-ring-shadow", evidence: ${q(`the pip's ring is a zero-offset zero-blur outset box-shadow (${sh}; ${p.ledger}#${p.combo}__default ${p.roles.indicator}.box-shadow) — no IR shadow-ring primitive; lowered to a ${p.leaves["indicator.borderWidth"]?.value}px border with the stroke outside`)}, target: ${q(`${opts.displayName} shadow ring`)}, reason: "lowered" },`);
  } catch { /* not enumerated */ }
  const receiptRows = [
    ...p.receipts.map((r) => `  { id: ${q(`receipt-${r.path.replace(/\./g, "-")}`)}, evidence: ${q(`${r.why} — ${r.evidence}`)}, target: ${q(`${opts.displayName} ${r.path}`)}, reason: "refused-by-recipe" },`),
    ...extra,
    ...shadowRefusal(ledger, p.combo, p.roles.host, p.archetype).map((r) => `  { id: ${q(r.id)}, evidence: ${q(r.evidence)}, target: ${q(`${opts.displayName} ${r.target}`)}, reason: ${q(r.reason)} },`),
    ...interactionRefusals(ledger, p.archetype).map((r) => `  { id: ${q(r.id)}, evidence: ${q(r.evidence)}, target: ${q(`${opts.displayName} ${r.target}`)}, reason: ${q(r.reason)} },`),
  ].join("\n");
  const style = p.typography.style;
  const slug = opts.slug.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  return `// GENERATED by recipe/fixture-reader/propose-badge.ts — do not edit by hand.
// Source of every value: the capture ledger ${p.ledger} (${p.provenance.package}@${p.provenance.version},
// ${p.provenance.browser}) read through the badge@1 role schema; every leaf
// names its ledger key or its reviewed evidence. Re-run the proposer to regenerate.
import type { ReviewedBadgeSource } from "../../adapters/badge.js";
import { anatomyFacts, buildConfig, cloneTokens, makeRefusals } from "../library-badges.js";
import { badgeSchemaMappings, type BadgeRoles } from "../../fixture-reader/schema-badge.js";

export const ${slug.toUpperCase()}_BADGE_LEDGER = ${q(p.ledger)};
export const ${slug}BadgeCombo = ${q(p.combo)};

export const ${slug}BadgeRoles: BadgeRoles = ${JSON.stringify(p.roles, null, 2)};

const VALUES: Record<string, number | string> = {
${tokenLines}
};

const ${slug}Tokens = cloneTokens(${q(`${opts.slug}.badge`)}, (path) => {
  if (!(path in VALUES)) throw new Error(${q(`${opts.slug} badge fixture: no proposed value for `)} + path);
  return VALUES[path]!;
});
${slug}Tokens.strokeAlign = ${q(String(p.leaves["strokeAlign"]!.value))} as "inside" | "outside";
${slug}Tokens.typography = ${typographyBlock(p, style)};

export const ${slug}BadgeSource: ReviewedBadgeSource = {
  packageName: ${q(p.provenance.package)},
  version: ${q(p.provenance.version)},
  exportName: ${q(opts.exportName)},
  framework: "react",
  sourceRoot: ${q(opts.sourceRoot)},
  anatomy: {
    root: ${q(`ledger cell ${p.combo}: a host (${p.roles.host}) with a pip (${p.roles.indicator}) docked at its top-right`)},
    host: ${q(`ledger part ${p.roles.host}: ${p.leaves["host.size"]?.value}px, radius ${p.leaves["host.radius"]?.value}`)},
    indicator: ${q(`ledger part ${p.roles.indicator}: ${p.leaves["indicator.height"]?.value}px high, min ${p.leaves["indicator.minWidth"]?.value}, offset ${p.leaves["indicator.translateX"]?.value}/${p.leaves["indicator.translateY"]?.value}, ring ${p.leaves["indicator.borderWidth"]?.value}`)},
    label: ${q(`ledger part ${p.roles.label ?? p.roles.indicator}: ${p.typography.family} ${style} ${p.leaves["labelFontSize"]?.value}px / ${p.leaves["labelLineHeight"]?.value}px, count ${JSON.stringify(p.content.count)}`)},
  },
  api: { generated: "proposed from the capture ledger; no API review" },
  styleSources: [${q(p.ledger)}],
  fontSources: [${q(`${p.ledger} count`)}],
};

const ${slug}Refusals = makeRefusals(${q(opts.slug)}, [
${receiptRows}
]);

export const ${slug}BadgeAdapterConfig = buildConfig(
  ${q(opts.slug)},
  ${slug}BadgeSource,
  ${slug}Tokens,
  { id: ${q(`${opts.slug}.badge`)}, name: ${q(`${opts.displayName} Badge`)} },
  ${slug}Refusals,
  anatomyFacts(${q(opts.slug)}, ${slug}BadgeSource),
  ${q(opts.unsupported)},
  ${q(p.content)},
);

/** The same schema the proposer evaluated, for the drift gate. */
export const ${slug}BadgeMappings = badgeSchemaMappings(${slug}BadgeRoles, { combo: ${slug}BadgeCombo, receipts: ${q(Object.fromEntries(p.receipts.map((r) => [r.path, { why: r.why, evidence: r.evidence }])))} });
`;
}
