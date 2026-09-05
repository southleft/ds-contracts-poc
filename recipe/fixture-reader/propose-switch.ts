/**
 * PROPOSE A switch@1 FIXTURE FROM A CAPTURE LEDGER — the switch half of
 * propose-fixture.ts. Same contract: every leaf is read from the ledger, set
 * by a person with evidence, or an archetype spelling; anything else refuses
 * the whole proposal by name. The role map and the combo map come from
 * draft-roles.ts (or a reviewed file); the label-less cell is proposed when
 * the mount has no label part.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { Ledger } from "./ledger.js";
import { evaluate, interactionRefusals, type Proposal } from "./propose-fixture.js";
import { switchSchemaMappings, switchSpellingsFor, type SwitchComboMap, type SwitchRoles } from "./schema-switch.js";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const q = (s: unknown): string => JSON.stringify(s);

export interface SwitchProposal {
  archetype: "switch";
  library: string;
  ledger: string;
  provenance: { package: string; version: string; browser: string };
  roles: SwitchRoles;
  combos: SwitchComboMap;
  leaves: Proposal["leaves"];
  receipts: Proposal["receipts"];
  refused: string[];
  content: { label: string | null };
  typography: { family: string; style: string; stack: string };
}

export interface ProposeSwitchInput {
  library: string;
  ledger: string;
  roles: SwitchRoles;
  combos: SwitchComboMap;
  sets?: Record<string, { value: string; why: string }>;
  displayName?: string;
  exportName?: string;
  sourceRoot?: string;
  unsupported?: string[];
  out: string;
}

const selectorMatches = (part: { idxPath: string; tag: string; classes: string[] }, selector: string): boolean =>
  selector === "root" ? part.idxPath === "" : selector.startsWith("idx:") ? part.idxPath === selector.slice(4) : selector.startsWith("cls:") ? part.classes.includes(selector.slice(4)) : selector.startsWith("tag:") ? part.tag === selector.slice(4) : false;

export function proposeSwitchFixture(input: ProposeSwitchInput): { proposal: SwitchProposal; modulePath: string; proposalPath: string; refused: string[] } {
  const { library, roles, combos } = input;
  const sets = new Map<string, { value: string; why: string }>(Object.entries(input.sets ?? {}));
  const ledger = new Ledger(REPO, input.ledger);
  const truth = JSON.parse(readFileSync(path.join(REPO, input.ledger), "utf8")) as { _provenance: { library: string; browser: string } };
  const [pkg, version] = truth._provenance.library.split(/@(?=[^@]+$)/);
  const mappings = switchSchemaMappings(roles, { combos });
  const evaluated = evaluate(ledger, mappings, sets, switchSpellingsFor(roles));
  const proposalPath = path.join(REPO, "recipe/fixture-reader/out/proposals", `switch.${library}.json`);
  if (evaluated.refused.length > 0) {
    return { proposal: null as unknown as SwitchProposal, modulePath: path.join(REPO, input.out), proposalPath, refused: evaluated.refused };
  }
  const offKey = `${combos["false.enabled"]}__default`;
  const labelPart = roles.label ? ledger.capture(offKey).parts.find((p) => selectorMatches(p, roles.label!)) : undefined;
  const labelText: string | null = roles.label ? ((labelPart?.text ?? []).find((t) => t.trim().length > 0) ?? "") : null;
  const family = String(evaluated.leaves["typography.label.family"]?.value ?? "");
  const style = String(evaluated.leaves["typography.label.style"]?.value ?? "");
  const stack = roles.label ? ledger.raw(offKey, roles.label, "font-family") : "(bare cell — no label part)";
  const proposal: SwitchProposal = {
    archetype: "switch",
    library,
    ledger: input.ledger,
    provenance: { package: pkg!, version: version!, browser: truth._provenance.browser },
    roles,
    combos,
    ...evaluated,
    content: { label: labelText },
    typography: { family, style, stack },
  };
  const module = renderSwitchModule(proposal, {
    slug: library,
    displayName: input.displayName ?? library,
    exportName: input.exportName ?? "Switch",
    sourceRoot: input.sourceRoot ?? `extract/computed/out/${library}`,
    unsupported: input.unsupported ?? [],
  });
  mkdirSync(path.dirname(path.join(REPO, input.out)), { recursive: true });
  writeFileSync(path.join(REPO, input.out), module);
  mkdirSync(path.dirname(proposalPath), { recursive: true });
  writeFileSync(proposalPath, `${JSON.stringify(proposal, null, 2)}\n`);
  return { proposal, modulePath: path.join(REPO, input.out), proposalPath, refused: [] };
}

const STRING_LEAVES = new Set(["rowAlign", "thumbShadow", "hitClips", "trackClips"]);

function typographyBlock(p: SwitchProposal, style: string): string {
  if (p.content.label === null) return "{ label: bareLabelFont() }";
  return `{
  label: {
    requestedFamily: ${q(p.typography.family)},
    requestedStyle: ${q(style)},
    requestSource: ${q(`${p.ledger} label font-family/font-weight: ${p.typography.stack.slice(0, 80)} / ${style}`)},
    fallbackChain: [
      { family: ${q(p.typography.family)}, style: ${q(style)} },
      { family: "Arial", style: ${q(style === "Regular" ? "Regular" : "Bold")} },
    ],
    resolvedFamily: ${q(p.typography.family)},
    resolvedStyle: ${q(style)},
    resolution: "requested",
  },
}`;
}

export function renderSwitchModule(p: SwitchProposal, opts: { slug: string; displayName: string; exportName: string; sourceRoot: string; unsupported: string[] }): string {
  const tokenLines = Object.entries(p.leaves)
    .filter(([k]) => !k.startsWith("typography.") && !STRING_LEAVES.has(k))
    .map(([k, v]) => `  ${q(k)}: ${q(v.value)}, // ${v.from === "ledger" ? `ledger ${v.key}` : v.from === "spelling" ? `archetype spelling: ${v.why}` : `reviewed: ${v.why}`}`)
    .join("\n");
  const receiptRows = [
    ...p.receipts.map((r) => `  { id: ${q(`receipt-${r.path.replace(/\./g, "-")}`)}, evidence: ${q(`${r.why} — ${r.evidence}`)}, target: ${q(`${opts.displayName} ${r.path}`)}, reason: "lowered" as const },`),
    ...interactionRefusals(new Ledger(REPO, p.ledger), p.archetype).map((r) => `  { id: ${q(r.id)}, evidence: ${q(r.evidence)}, target: ${q(`${opts.displayName} ${r.target}`)}, reason: ${q(r.reason)} as const },`),
  ].join("\n");
  const style = p.typography.style;
  const str = (k: string): string => String(p.leaves[k]!.value);
  // IDENTIFIER-SAFE SLUG. A library slug may contain a hyphen (radix-themes,
  // day-picker) and a hyphen is not legal in a JavaScript identifier, so
  // emitting it raw produced `export const RADIX-THEMES_SWITCH_LEDGER` and the
  // generated fixture did not parse — esbuild threw a TransformError with a
  // stack trace instead of a named refusal. Found 2026-09-05 by following
  // docs/36 as a reader on radix-themes, the first hyphenated library the path
  // was pointed at; every library captured before it (mui, chakra, shadcn,
  // carbon, fluent, altitude, tailwind, astryx, polaris, antd) is hyphen-free,
  // which is why this survived. Ten of the twelve proposers already did this;
  // these two did not.
  const slug = opts.slug.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  return `// GENERATED by recipe/fixture-reader/propose-switch.ts — do not edit by hand.
// Source of every value: the capture ledger ${p.ledger} (${p.provenance.package}@${p.provenance.version},
// ${p.provenance.browser}) read through the switch@1 role schema; every leaf
// names its ledger key or its reviewed evidence. Re-run the proposer to regenerate.
import type { ReviewedSwitchSource } from "../../adapters/switch.js";
import { anatomyFacts, buildConfig, cloneTokens, makeRefusals } from "../library-switches.js";
${p.content.label === null ? 'import { bareLabelFont } from "../../recipes/switch.js";' : ""}
import { switchSchemaMappings, type SwitchComboMap, type SwitchRoles } from "../../fixture-reader/schema-switch.js";

export const ${slug.toUpperCase()}_SWITCH_LEDGER = ${q(p.ledger)};

export const ${slug}SwitchRoles: SwitchRoles = ${JSON.stringify(p.roles, null, 2)};
export const ${slug}SwitchCombos: SwitchComboMap = ${JSON.stringify(p.combos, null, 2)};

const VALUES: Record<string, number | string> = {
${tokenLines}
};

const ${slug}Tokens = cloneTokens(${q(`${opts.slug}.switch`)}, (path) => {
  if (!(path in VALUES)) throw new Error(${q(`${opts.slug} switch fixture: no proposed value for `)} + path);
  return VALUES[path]!;
});
${slug}Tokens.rowAlign = ${q(str("rowAlign"))} as "center" | "baseline";
${slug}Tokens.thumbShadow = ${q(str("thumbShadow"))};
${slug}Tokens.hitClips = ${str("hitClips") === "true"};
${slug}Tokens.trackClips = ${str("trackClips") === "true"};
${slug}Tokens.typography = ${typographyBlock(p, style)};

export const ${slug}SwitchSource: ReviewedSwitchSource = {
  packageName: ${q(p.provenance.package)},
  version: ${q(p.provenance.version)},
  exportName: ${q(opts.exportName)},
  framework: "react",
  sourceRoot: ${q(opts.sourceRoot)},
  anatomy: {
    root: ${q(`ledger part ${p.roles.hit} (hit)${p.roles.row ? ` / ${p.roles.row} (row)` : ""}`)},
    control: ${q(`ledger part ${p.roles.track} (track ${p.leaves["track.width"]?.value}×${p.leaves["track.height"]?.value}, radius ${p.leaves["track.radius"]?.value}); thumb ${p.roles.thumb}${p.roles.thumbPseudo ?? ""} ${p.leaves["thumb.offSize"]?.value}→${p.leaves["thumb.onSize"]?.value}, travel ${p.leaves["thumb.travel"]?.value}`)},
    glyph: "none — switch@1 has no glyph",
    label: ${q(p.content.label === null ? "no label part in the mount (bare control): the recipe compiles no label node" : `ledger part ${p.roles.label}: ${p.typography.family} ${style} ${p.leaves["labelFontSize"]?.value}px; text ${JSON.stringify(p.content.label)}`)},
  },
  api: { generated: "proposed from the capture ledger; no API review" },
  styleSources: [${q(p.ledger)}],
  fontSources: [${q(p.content.label === null ? "no label — the bare cell's font spec is inert (recipes/switch.ts bareLabelFont)" : `${p.ledger} label`)}],
};

const ${slug}Refusals = makeRefusals(${q(slug)}, [
${receiptRows}
]);

export const ${slug}SwitchAdapterConfig = buildConfig(
  ${q(slug)},
  ${slug}SwitchSource,
  ${slug}Tokens,
  { id: ${q(`${opts.slug}.switch`)}, name: ${q(`${opts.displayName} Switch`)} },
  ${slug}Refusals,
  anatomyFacts(${q(slug)}, ${slug}SwitchSource),
  ${q(opts.unsupported)},
  ${q(p.content)},
);

/** The same schema the proposer evaluated, for the drift gate. */
export const ${slug}SwitchMappings = switchSchemaMappings(${slug}SwitchRoles, { combos: ${slug}SwitchCombos, receipts: ${q(Object.fromEntries(p.receipts.map((r) => [r.path, { why: r.why, evidence: r.evidence }])))} });
`;
}
