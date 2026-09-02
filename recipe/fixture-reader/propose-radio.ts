/**
 * PROPOSE A radio@1 FIXTURE FROM A CAPTURE LEDGER — the same contract as the
 * checkbox, switch, avatar, tooltip, chip, link and tabs proposers: every leaf
 * is read from the ledger, set by a person with evidence, or an archetype
 * spelling; anything else refuses by name. Both list items carry the captured
 * label's text — the capture mounts one radio and nothing is invented.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { Ledger } from "./ledger.js";
import { evaluate, interactionRefusals, shadowRefusal, type Proposal } from "./propose-fixture.js";
import { RADIO_SPELLINGS, radioSchemaMappings, type RadioComboMap, type RadioRoles } from "./schema-radio.js";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const q = (s: unknown): string => JSON.stringify(s);

export interface RadioProposal {
  archetype: "radio";
  library: string;
  ledger: string;
  provenance: { package: string; version: string; browser: string };
  roles: RadioRoles;
  combos: RadioComboMap;
  leaves: Proposal["leaves"];
  receipts: Proposal["receipts"];
  refused: string[];
  content: { items: Array<{ id: "a" | "b"; label: string }> };
  typography: { family: string; style: string; stack: string };
}

export interface ProposeRadioInput {
  library: string;
  ledger: string;
  roles: RadioRoles;
  combos: RadioComboMap;
  sets?: Record<string, { value: string; why: string }>;
  displayName?: string;
  exportName?: string;
  sourceRoot?: string;
  unsupported?: string[];
  out: string;
}

const selectorMatches = (part: { idxPath: string; tag: string; classes: string[] }, selector: string): boolean =>
  selector === "root" ? part.idxPath === "" : selector.startsWith("idx:") ? part.idxPath === selector.slice(4) : selector.startsWith("cls:") ? part.classes.includes(selector.slice(4)) : selector.startsWith("tag:") ? part.tag === selector.slice(4) : false;

export function proposeRadioFixture(input: ProposeRadioInput): { proposal: RadioProposal; modulePath: string; proposalPath: string; refused: string[] } {
  const { library, roles, combos } = input;
  const sets = new Map<string, { value: string; why: string }>(Object.entries(input.sets ?? {}));
  const ledger = new Ledger(REPO, input.ledger);
  const truth = JSON.parse(readFileSync(path.join(REPO, input.ledger), "utf8")) as { _provenance: { library: string; browser: string } };
  const [pkg, version] = truth._provenance.library.split(/@(?=[^@]+$)/);
  const mappings = radioSchemaMappings(roles, { combos });
  const evaluated = evaluate(ledger, mappings, sets, RADIO_SPELLINGS);
  const resolvedSet = sets.get("typography.label.resolved");
  if (resolvedSet) {
    if (!/^[^/]+\/[^/]+$/.test(resolvedSet.value)) evaluated.refused.push(`typography.label.resolved: give "Family/Style" (got ${JSON.stringify(resolvedSet.value)})`);
    else { evaluated.leaves["typography.label.resolved"] = { value: resolvedSet.value, from: "set", why: resolvedSet.why }; evaluated.receipts.push({ path: "typography.label.resolved", why: "the requested face is not on the minting machine", evidence: resolvedSet.why, value: resolvedSet.value }); }
  }
  const proposalPath = path.join(REPO, "recipe/fixture-reader/out/proposals", `radio.${library}.json`);
  const modulePath = path.join(REPO, input.out);
  if (evaluated.refused.length > 0) return { proposal: null as unknown as RadioProposal, modulePath, proposalPath, refused: evaluated.refused };
  const key = `${combos["unselected.enabled"]}__default`;
  const labelPart = ledger.capture(key).parts.find((p) => selectorMatches(p, roles.label));
  const text = (labelPart?.text ?? []).map((t) => t.trim()).find((t) => t.length > 0);
  if (!text) return { proposal: null as unknown as RadioProposal, modulePath, proposalPath, refused: [`content.items: the label part ${roles.label} carries no text at ${key} — radio@1 has no bare cell; give a mount with a label`] };
  const family = String(evaluated.leaves["typography.label.family"]?.value ?? "");
  const style = String(evaluated.leaves["typography.label.style"]?.value ?? "");
  const stack = ledger.raw(key, roles.label, "font-family");
  const proposal: RadioProposal = {
    archetype: "radio",
    library,
    ledger: input.ledger,
    provenance: { package: pkg!, version: version!, browser: truth._provenance.browser },
    roles,
    combos,
    ...evaluated,
    // Both items carry the captured label — the capture mounts one radio.
    content: { items: [{ id: "a", label: text }, { id: "b", label: text }] },
    typography: { family, style, stack },
  };
  const module = renderRadioModule(proposal, {
    slug: library,
    displayName: input.displayName ?? library,
    exportName: input.exportName ?? "Radio",
    sourceRoot: input.sourceRoot ?? `extract/computed/out/${library}`,
    unsupported: input.unsupported ?? [],
  });
  mkdirSync(path.dirname(modulePath), { recursive: true });
  writeFileSync(modulePath, module);
  mkdirSync(path.dirname(proposalPath), { recursive: true });
  writeFileSync(proposalPath, `${JSON.stringify(proposal, null, 2)}\n`);
  return { proposal, modulePath, proposalPath, refused: [] };
}

function typographyBlock(p: RadioProposal, style: string): string {
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

const STRING_LEAVES = new Set(["listMode", "itemAlign", "labelLineHeightUnit", "typography.label.resolved"]);

export function renderRadioModule(p: RadioProposal, opts: { slug: string; displayName: string; exportName: string; sourceRoot: string; unsupported: string[] }): string {
  const tokenLines = Object.entries(p.leaves)
    .filter(([k]) => !k.startsWith("typography.") && !STRING_LEAVES.has(k))
    .map(([k, v]) => `  ${q(k)}: ${q(v.value)}, // ${v.from === "ledger" ? `ledger ${v.key}` : v.from === "spelling" ? `archetype spelling: ${v.why}` : `reviewed: ${v.why}`}${v.formula ? ` — ${v.formula}` : ""}`)
    .join("\n");
  const ledger = new Ledger(REPO, p.ledger);
  const dotLowering = p.roles.dot?.pseudo
    ? [`  { id: "refusal-dot-pseudo", evidence: ${q(`the inner disc is the ring's ${p.roles.dot.pseudo} pseudo-element (${p.ledger}#${p.combos["selected.enabled"]}__default ${p.roles.dot.part}${p.roles.dot.pseudo}) — no IR pseudo primitive; lowered to a real circle of its painted size`)}, target: ${q(`${opts.displayName} ${p.roles.dot.pseudo} disc`)}, reason: "no-figma-primitive" },`]
    : [];
  const receiptRows = [
    ...p.receipts.map((r) => `  { id: ${q(`receipt-${r.path.replace(/\./g, "-")}`)}, evidence: ${q(`${r.why} — ${r.evidence}`)}, target: ${q(`${opts.displayName} ${r.path}`)}, reason: "refused-by-recipe" },`),
    ...dotLowering,
    ...shadowRefusal(ledger, p.combos["unselected.enabled"], p.roles.circle, p.archetype).map((r) => `  { id: ${q(r.id)}, evidence: ${q(r.evidence)}, target: ${q(`${opts.displayName} ${r.target}`)}, reason: ${q(r.reason)} },`),
    ...interactionRefusals(ledger, p.archetype).map((r) => `  { id: ${q(r.id)}, evidence: ${q(r.evidence)}, target: ${q(`${opts.displayName} ${r.target}`)}, reason: ${q(r.reason)} },`),
  ].join("\n");
  const style = p.typography.style;
  const slug = opts.slug.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  const s = (k: string): string => q(String(p.leaves[k]!.value));
  return `// GENERATED by recipe/fixture-reader/propose-radio.ts — do not edit by hand.
// Source of every value: the capture ledger ${p.ledger} (${p.provenance.package}@${p.provenance.version},
// ${p.provenance.browser}) read through the radio@1 role schema; every leaf
// names its ledger key or its reviewed evidence. Re-run the proposer to regenerate.
import type { ReviewedRadioSource } from "../../adapters/radio.js";
import { anatomyFacts, buildConfig, cloneTokens, makeRefusals } from "../library-radios.js";
import { radioSchemaMappings, type RadioComboMap, type RadioRoles } from "../../fixture-reader/schema-radio.js";

export const ${slug.toUpperCase()}_RADIO_LEDGER = ${q(p.ledger)};
export const ${slug}RadioCombos: RadioComboMap = ${JSON.stringify(p.combos, null, 2)};

export const ${slug}RadioRoles: RadioRoles = ${JSON.stringify(p.roles, null, 2)};

const VALUES: Record<string, number | string> = {
${tokenLines}
};

const ${slug}Tokens = cloneTokens(${q(`${opts.slug}.radio`)}, (path) => {
  if (!(path in VALUES)) throw new Error(${q(`${opts.slug} radio fixture: no proposed value for `)} + path);
  return VALUES[path]!;
});
${slug}Tokens.listMode = ${s("listMode")} as "vertical" | "horizontal";
${slug}Tokens.itemAlign = ${s("itemAlign")} as "center" | "baseline";
${slug}Tokens.labelLineHeightUnit = ${s("labelLineHeightUnit")} as "auto" | "px";
${slug}Tokens.typography = ${typographyBlock(p, style)};

export const ${slug}RadioSource: ReviewedRadioSource = {
  packageName: ${q(p.provenance.package)},
  version: ${q(p.provenance.version)},
  exportName: ${q(opts.exportName)},
  framework: "react",
  sourceRoot: ${q(opts.sourceRoot)},
  anatomy: {
    root: ${q(`ledger part ${p.roles.hit} (hit) — the capture mounts one radio; the two-item list is the recipe's shape`)},
    control: ${q(`ledger part ${p.roles.circle}: ${p.leaves["circle.size"]?.value}px ring, border ${p.leaves["circle.borderWidth"]?.value}, radius ${p.leaves["circle.radius"]?.value}`)},
    glyph: ${q(p.roles.dot ? `ledger ${p.roles.dot.part}${p.roles.dot.pseudo ?? ""}: ${p.leaves["dot.size"]?.value}px disc` : "no inner disc part")},
    label: ${q(`ledger part ${p.roles.label}: ${p.typography.family} ${style} ${p.leaves["labelFontSize"]?.value}px, text ${JSON.stringify(p.content.items[0]!.label)}`)},
  },
  api: { generated: "proposed from the capture ledger; no API review" },
  styleSources: [${q(p.ledger)}],
  fontSources: [${q(`${p.ledger} label`)}],
};

const ${slug}Refusals = makeRefusals(${q(opts.slug)}, [
${receiptRows}
]);

export const ${slug}RadioAdapterConfig = buildConfig(
  ${q(opts.slug)},
  ${slug}RadioSource,
  ${slug}Tokens,
  { id: ${q(`${opts.slug}.radio`)}, name: ${q(`${opts.displayName} Radio`)} },
  ${slug}Refusals,
  anatomyFacts(${q(opts.slug)}, ${slug}RadioSource),
  ${q(opts.unsupported)},
  ${q(p.content)},
);

/** The same schema the proposer evaluated, for the drift gate. */
export const ${slug}RadioMappings = radioSchemaMappings(${slug}RadioRoles, { combos: ${slug}RadioCombos, receipts: ${q(Object.fromEntries(p.receipts.map((r) => [r.path, { why: r.why, evidence: r.evidence }])))} });
`;
}
