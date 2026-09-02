/**
 * PROPOSE AN alert@1 FIXTURE FROM A CAPTURE LEDGER — the contract of every
 * other proposer: each leaf is read from the ledger, set by a person with
 * evidence, or an archetype spelling; anything else refuses by name. The
 * four status glyphs are the capture's own path data; the package's viewBox
 * is the one reviewed leaf (`--set icon.viewBox=… --why …`).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { Ledger } from "./ledger.js";
import { evaluate, interactionRefusals, shadowRefusal, type Proposal } from "./propose-fixture.js";
import { ALERT_SPELLINGS, ALERT_STATUSES, alertSchemaMappings, parseViewBox, type AlertComboMap, type AlertRoles } from "./schema-alert.js";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const q = (s: unknown): string => JSON.stringify(s);

export interface AlertProposal {
  archetype: "alert";
  library: string;
  ledger: string;
  provenance: { package: string; version: string; browser: string };
  roles: AlertRoles;
  combos: AlertComboMap;
  leaves: Proposal["leaves"];
  receipts: Proposal["receipts"];
  refused: string[];
  content: { title: string };
  viewBox: { x: number; y: number; width: number; height: number; citation: string };
  typography: { family: string; style: string; stack: string };
}

export interface ProposeAlertInput {
  library: string;
  ledger: string;
  roles: AlertRoles;
  combos: AlertComboMap;
  sets?: Record<string, { value: string; why: string }>;
  displayName?: string;
  exportName?: string;
  sourceRoot?: string;
  unsupported?: string[];
  out: string;
}

const selectorMatches = (part: { idxPath: string; tag: string; classes: string[] }, selector: string): boolean =>
  selector === "root" ? part.idxPath === "" : selector.startsWith("idx:") ? part.idxPath === selector.slice(4) : selector.startsWith("cls:") ? part.classes.includes(selector.slice(4)) : selector.startsWith("tag:") ? part.tag === selector.slice(4) : false;

export function proposeAlertFixture(input: ProposeAlertInput): { proposal: AlertProposal; modulePath: string; proposalPath: string; refused: string[] } {
  const { library, roles, combos } = input;
  const sets = new Map<string, { value: string; why: string }>(Object.entries(input.sets ?? {}));
  const ledger = new Ledger(REPO, input.ledger);
  const truth = JSON.parse(readFileSync(path.join(REPO, input.ledger), "utf8")) as { _provenance: { library: string; browser: string } };
  const [pkg, version] = truth._provenance.library.split(/@(?=[^@]+$)/);
  const mappings = alertSchemaMappings(roles, { combos });
  const evaluated = evaluate(ledger, mappings, sets, ALERT_SPELLINGS);
  const resolvedSet = sets.get("typography.title.resolved");
  if (resolvedSet) {
    if (!/^[^/]+\/[^/]+$/.test(resolvedSet.value)) evaluated.refused.push(`typography.title.resolved: give "Family/Style" (got ${JSON.stringify(resolvedSet.value)})`);
    else { evaluated.leaves["typography.title.resolved"] = { value: resolvedSet.value, from: "set", why: resolvedSet.why }; evaluated.receipts.push({ path: "typography.title.resolved", why: "the requested face is not on the minting machine", evidence: resolvedSet.why, value: resolvedSet.value }); }
  }
  const proposalPath = path.join(REPO, "recipe/fixture-reader/out/proposals", `alert.${library}.json`);
  const modulePath = path.join(REPO, input.out);
  let viewBox: AlertProposal["viewBox"] | null = null;
  const vbLeaf = evaluated.leaves["icon.viewBox"];
  if (vbLeaf) {
    try { viewBox = { ...parseViewBox(String(vbLeaf.value)), citation: vbLeaf.why ?? "" }; }
    catch (e) { evaluated.refused.push(`icon.viewBox: ${(e as Error).message}`); }
  }
  if (evaluated.refused.length > 0 || !viewBox) return { proposal: null as unknown as AlertProposal, modulePath, proposalPath, refused: evaluated.refused };
  const key = `${combos.info}__default`;
  const titlePart = ledger.capture(key).parts.find((p) => selectorMatches(p, roles.title));
  const title = (titlePart?.text ?? []).map((t) => t.trim()).find((t) => t.length > 0);
  if (!title) return { proposal: null as unknown as AlertProposal, modulePath, proposalPath, refused: [`content.title: the title part ${roles.title} carries no text at ${key}`] };
  const family = String(evaluated.leaves["typography.title.family"]?.value ?? "");
  const style = String(evaluated.leaves["typography.title.style"]?.value ?? "");
  const stack = ledger.raw(key, roles.title, "font-family");
  const proposal: AlertProposal = {
    archetype: "alert",
    library,
    ledger: input.ledger,
    provenance: { package: pkg!, version: version!, browser: truth._provenance.browser },
    roles,
    combos,
    ...evaluated,
    content: { title },
    viewBox,
    typography: { family, style, stack },
  };
  const module = renderAlertModule(proposal, {
    slug: library,
    displayName: input.displayName ?? library,
    exportName: input.exportName ?? "Alert",
    sourceRoot: input.sourceRoot ?? `extract/computed/out/${library}`,
    unsupported: input.unsupported ?? [],
  });
  mkdirSync(path.dirname(modulePath), { recursive: true });
  writeFileSync(modulePath, module);
  mkdirSync(path.dirname(proposalPath), { recursive: true });
  writeFileSync(proposalPath, `${JSON.stringify(proposal, null, 2)}\n`);
  return { proposal, modulePath, proposalPath, refused: [] };
}

function typographyBlock(p: AlertProposal, style: string): string {
  const resolved = p.leaves["typography.title.resolved"];
  const [rf, rs] = resolved ? String(resolved.value).split("/") : [p.typography.family, style];
  return `{
  title: {
    requestedFamily: ${q(p.typography.family)},
    requestedStyle: ${q(style)},
    requestSource: ${q(`${p.ledger} title font-family/font-weight: ${p.typography.stack.slice(0, 80)} / ${style}${resolved ? `; reviewed fallback: ${resolved.why}` : ""}`)},
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

const STRING_LEAVES = new Set(["strokeAlign", "icon.viewBox", "typography.title.resolved"]);

export function renderAlertModule(p: AlertProposal, opts: { slug: string; displayName: string; exportName: string; sourceRoot: string; unsupported: string[] }): string {
  const tokenLines = Object.entries(p.leaves)
    .filter(([k]) => !k.startsWith("typography.") && !k.startsWith("icon.glyphs.") && !STRING_LEAVES.has(k))
    .map(([k, v]) => `  ${q(k)}: ${q(v.value)}, // ${v.from === "ledger" ? `ledger ${v.key}` : v.from === "spelling" ? `archetype spelling: ${v.why}` : `reviewed: ${v.why}`}${v.formula ? ` — ${v.formula}` : ""}`)
    .join("\n");
  const glyphLines = ALERT_STATUSES.map((s) => {
    const d = p.leaves[`icon.glyphs.${s}.path`]!, w = p.leaves[`icon.glyphs.${s}.winding`]!;
    return `  ${s}: {\n    path: ${q(d.value)}, // ledger ${d.key}\n    viewBox: ${q({ x: p.viewBox.x, y: p.viewBox.y, width: p.viewBox.width, height: p.viewBox.height })},\n    winding: ${q(w.value)} as "nonzero" | "evenodd", // ledger ${w.key}\n    source: { asset: ${q(`${p.ledger}#${p.combos[s]}__default ${p.roles.iconPath}.d`)}, viewBoxCitation: ${q(p.viewBox.citation)} },\n  },`;
  }).join("\n");
  const ledger = new Ledger(REPO, p.ledger);
  const receiptRows = [
    ...p.receipts.map((r) => `  { id: ${q(`receipt-${r.path.replace(/\./g, "-")}`)}, evidence: ${q(`${r.why} — ${r.evidence}`)}, target: ${q(`${opts.displayName} ${r.path}`)}, reason: "refused-by-recipe" },`),
    ...shadowRefusal(ledger, p.combos.info, p.roles.box, p.archetype).map((r) => `  { id: ${q(r.id)}, evidence: ${q(r.evidence)}, target: ${q(`${opts.displayName} ${r.target}`)}, reason: ${q(r.reason)} },`),
    ...interactionRefusals(ledger, p.archetype).map((r) => `  { id: ${q(r.id)}, evidence: ${q(r.evidence)}, target: ${q(`${opts.displayName} ${r.target}`)}, reason: ${q(r.reason)} },`),
  ].join("\n");
  const style = p.typography.style;
  const slug = opts.slug.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  return `// GENERATED by recipe/fixture-reader/propose-alert.ts — do not edit by hand.
// Source of every value: the capture ledger ${p.ledger} (${p.provenance.package}@${p.provenance.version},
// ${p.provenance.browser}) read through the alert@1 role schema; every leaf
// names its ledger key or its reviewed evidence. The four glyphs are the
// capture's own path data; the viewBox is reviewed: ${p.viewBox.citation}
// Re-run the proposer to regenerate.
import type { ReviewedAlertSource } from "../../adapters/alert.js";
import { anatomyFacts, buildConfig, cloneTokens, makeRefusals, statusAxis } from "../library-alerts.js";
import { alertSchemaMappings, type AlertComboMap, type AlertRoles } from "../../fixture-reader/schema-alert.js";

export const ${slug.toUpperCase()}_ALERT_LEDGER = ${q(p.ledger)};
export const ${slug}AlertCombos: AlertComboMap = ${JSON.stringify(p.combos, null, 2)};

export const ${slug}AlertRoles: AlertRoles = ${JSON.stringify(p.roles, null, 2)};

const VALUES: Record<string, number | string> = {
${tokenLines}
};

const ${slug}Tokens = cloneTokens(${q(`${opts.slug}.alert`)}, (path) => {
  if (!(path in VALUES)) throw new Error(${q(`${opts.slug} alert fixture: no proposed value for `)} + path);
  return VALUES[path]!;
});
${slug}Tokens.icon.glyphs = {
${glyphLines}
};
${slug}Tokens.strokeAlign = ${q(String(p.leaves["strokeAlign"]!.value))} as "inside" | "outside";
${slug}Tokens.typography = ${typographyBlock(p, style)};

export const ${slug}AlertSource: ReviewedAlertSource = {
  packageName: ${q(p.provenance.package)},
  version: ${q(p.provenance.version)},
  exportName: ${q(opts.exportName)},
  framework: "react",
  sourceRoot: ${q(opts.sourceRoot)},
  anatomy: {
    root: ${q(`ledger part ${p.roles.box}: ${p.leaves["box.height"]?.value}px, padding ${p.leaves["box.paddingY"]?.value}/${p.leaves["box.paddingX"]?.value}, radius ${p.leaves["box.radius"]?.value}, gap ${p.leaves["box.gap"]?.value}`)},
    control: ${q(`ledger part ${p.roles.box} — one box per status, four statuses captured`)},
    icon: ${q(`ledger part ${p.roles.icon} (${p.leaves["icon.size"]?.value}px svg) with one filled path ${p.roles.iconPath}; viewBox ${p.viewBox.width}×${p.viewBox.height} at ${p.viewBox.x},${p.viewBox.y} — ${p.viewBox.citation}`)},
    title: ${q(`ledger part ${p.roles.title}: ${p.typography.family} ${style} ${p.leaves["titleFontSize"]?.value}px / ${p.leaves["titleLineHeight"]?.value}px, text ${JSON.stringify(p.content.title)}`)},
  },
  api: { generated: "proposed from the capture ledger; no API review" },
  styleSources: [${q(p.ledger)}],
  fontSources: [${q(`${p.ledger} title`)}],
};

const ${slug}Refusals = makeRefusals(${q(opts.slug)}, [
${receiptRows}
]);

export const ${slug}AlertAdapterConfig = buildConfig(
  ${q(opts.slug)},
  ${slug}AlertSource,
  ${slug}Tokens,
  { id: ${q(`${opts.slug}.alert`)}, name: ${q(`${opts.displayName} Alert`)} },
  statusAxis("info"),
  ${slug}Refusals,
  anatomyFacts(${q(opts.slug)}, ${slug}AlertSource),
  ${q(opts.unsupported)},
  ${q(p.content)},
);

/** The same schema the proposer evaluated, for the drift gate (the reviewed viewBox is a fixture citation, not a leaf). */
export const ${slug}AlertMappings = alertSchemaMappings(${slug}AlertRoles, { combos: ${slug}AlertCombos, receipts: ${q(Object.fromEntries(p.receipts.filter((r) => r.path !== "icon.viewBox").map((r) => [r.path, { why: r.why, evidence: r.evidence }])))} }).filter((m) => m.path !== "icon.viewBox");
`;
}
