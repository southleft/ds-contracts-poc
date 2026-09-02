/**
 * PROPOSE A dialog@1 FIXTURE FROM A CAPTURE LEDGER — the contract of every
 * other proposer: each leaf is read from the ledger, set by a person with
 * evidence, or an archetype spelling; anything else refuses by name. The
 * title and body texts are the capture's.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { Ledger } from "./ledger.js";
import { evaluate, interactionRefusals, shadowRefusal, type Proposal } from "./propose-fixture.js";
import { DIALOG_SPELLINGS, dialogSchemaMappings, type DialogRoles } from "./schema-dialog.js";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const q = (s: unknown): string => JSON.stringify(s);

export interface DialogProposal {
  archetype: "dialog";
  library: string;
  ledger: string;
  provenance: { package: string; version: string; browser: string };
  roles: DialogRoles;
  combo: string;
  leaves: Proposal["leaves"];
  receipts: Proposal["receipts"];
  refused: string[];
  content: { title: string; body: string };
  typography: { title: { family: string; style: string; stack: string }; body: { family: string; style: string; stack: string } };
}

export interface ProposeDialogInput {
  library: string;
  ledger: string;
  roles: DialogRoles;
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

export function proposeDialogFixture(input: ProposeDialogInput): { proposal: DialogProposal; modulePath: string; proposalPath: string; refused: string[] } {
  const { library, roles, combo } = input;
  const sets = new Map<string, { value: string; why: string }>(Object.entries(input.sets ?? {}));
  const ledger = new Ledger(REPO, input.ledger);
  const truth = JSON.parse(readFileSync(path.join(REPO, input.ledger), "utf8")) as { _provenance: { library: string; browser: string } };
  const [pkg, version] = truth._provenance.library.split(/@(?=[^@]+$)/);
  const evaluated = evaluate(ledger, dialogSchemaMappings(roles, { combo }), sets, DIALOG_SPELLINGS);
  for (const which of ["title", "body"] as const) {
    const resolvedSet = sets.get(`typography.${which}.resolved`);
    if (!resolvedSet) continue;
    if (!/^[^/]+\/[^/]+$/.test(resolvedSet.value)) evaluated.refused.push(`typography.${which}.resolved: give "Family/Style" (got ${JSON.stringify(resolvedSet.value)})`);
    else { evaluated.leaves[`typography.${which}.resolved`] = { value: resolvedSet.value, from: "set", why: resolvedSet.why }; evaluated.receipts.push({ path: `typography.${which}.resolved`, why: "the requested face is not on the minting machine", evidence: resolvedSet.why, value: resolvedSet.value }); }
  }
  const proposalPath = path.join(REPO, "recipe/fixture-reader/out/proposals", `dialog.${library}.json`);
  const modulePath = path.join(REPO, input.out);
  if (evaluated.refused.length > 0) return { proposal: null as unknown as DialogProposal, modulePath, proposalPath, refused: evaluated.refused };
  const key = `${combo}__default`;
  const parts = ledger.capture(key).parts;
  const textOf = (sel: string): string | undefined => {
    const p = parts.find((x) => selectorMatches(x, sel));
    return p ? [p, ...parts.filter((c) => c.idxPath.startsWith(p.idxPath + "."))].flatMap((c) => c.text).map((t) => t.trim()).find((t) => t.length > 0) : undefined;
  };
  const title = textOf(roles.title), body = textOf(roles.body);
  if (!title || !body) return { proposal: null as unknown as DialogProposal, modulePath, proposalPath, refused: [`content: the ${!title ? "title" : "body"} part carries no text at ${key}`] };
  const font = (prefix: "title" | "body", sel: string) => ({
    family: String(evaluated.leaves[`typography.${prefix}.family`]?.value ?? ""),
    style: String(evaluated.leaves[`typography.${prefix}.style`]?.value ?? ""),
    stack: ledger.raw(key, sel, "font-family"),
  });
  const proposal: DialogProposal = {
    archetype: "dialog",
    library,
    ledger: input.ledger,
    provenance: { package: pkg!, version: version!, browser: truth._provenance.browser },
    roles,
    combo,
    ...evaluated,
    content: { title, body },
    typography: { title: font("title", roles.title), body: font("body", roles.body) },
  };
  const module = renderDialogModule(proposal, {
    slug: library,
    displayName: input.displayName ?? library,
    exportName: input.exportName ?? "Dialog",
    sourceRoot: input.sourceRoot ?? `extract/computed/out/${library}`,
    unsupported: input.unsupported ?? [],
  });
  mkdirSync(path.dirname(modulePath), { recursive: true });
  writeFileSync(modulePath, module);
  mkdirSync(path.dirname(proposalPath), { recursive: true });
  writeFileSync(proposalPath, `${JSON.stringify(proposal, null, 2)}\n`);
  return { proposal, modulePath, proposalPath, refused: [] };
}

function fontBlock(p: DialogProposal, which: "title" | "body"): string {
  const t = p.typography[which];
  const resolved = p.leaves[`typography.${which}.resolved`];
  const [rf, rs] = resolved ? String(resolved.value).split("/") : [t.family, t.style];
  return `{
    requestedFamily: ${q(t.family)},
    requestedStyle: ${q(t.style)},
    requestSource: ${q(`${p.ledger} ${which} font-family/font-weight: ${t.stack.slice(0, 80)} / ${t.style}${resolved ? `; reviewed fallback: ${resolved.why}` : ""}`)},
    fallbackChain: [
      { family: ${q(t.family)}, style: ${q(t.style)} },
      { family: ${q(rf)}, style: ${q(rs)} },
    ],
    resolvedFamily: ${q(rf)},
    resolvedStyle: ${q(rs)},
    resolution: ${q(resolved ? "fallback" : "requested")},${resolved ? `\n    degradation: ${q(`the requested face ${t.family} ${t.style} is not on the minting machine; minted with ${rf} ${rs} — ${resolved.why}`)},` : ""}
  }`;
}

const STRING_LEAVES = new Set(["lineHeightUnit", "typography.title.resolved", "typography.body.resolved"]);

export function renderDialogModule(p: DialogProposal, opts: { slug: string; displayName: string; exportName: string; sourceRoot: string; unsupported: string[] }): string {
  const tokenLines = Object.entries(p.leaves)
    .filter(([k]) => !k.startsWith("typography.") && !STRING_LEAVES.has(k))
    .map(([k, v]) => `  ${q(k)}: ${q(v.value)}, // ${v.from === "ledger" ? `ledger ${v.key}` : v.from === "spelling" ? `archetype spelling: ${v.why}` : `reviewed: ${v.why}`}${v.formula ? ` — ${v.formula}` : ""}`)
    .join("\n");
  const ledger = new Ledger(REPO, p.ledger);
  const receiptRows = [
    ...p.receipts.map((r) => `  { id: ${q(`receipt-${r.path.replace(/\./g, "-")}`)}, evidence: ${q(`${r.why} — ${r.evidence}`)}, target: ${q(`${opts.displayName} ${r.path}`)}, reason: "refused-by-recipe" },`),
    ...shadowRefusal(ledger, p.combo, p.roles.paper, p.archetype).map((r) => `  { id: ${q(r.id)}, evidence: ${q(r.evidence)}, target: ${q(`${opts.displayName} ${r.target}`)}, reason: ${q(r.reason)} },`),
    ...interactionRefusals(ledger, p.archetype).map((r) => `  { id: ${q(r.id)}, evidence: ${q(r.evidence)}, target: ${q(`${opts.displayName} ${r.target}`)}, reason: ${q(r.reason)} },`),
  ].join("\n");
  const slug = opts.slug.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  return `// GENERATED by recipe/fixture-reader/propose-dialog.ts — do not edit by hand.
// Source of every value: the capture ledger ${p.ledger} (${p.provenance.package}@${p.provenance.version},
// ${p.provenance.browser}) read through the dialog@1 role schema; every leaf
// names its ledger key or its reviewed evidence. Re-run the proposer to regenerate.
import type { ReviewedDialogSource } from "../../adapters/dialog.js";
import { anatomyFacts, buildConfig, cloneTokens, makeRefusals } from "../library-dialogs.js";
import { dialogSchemaMappings, type DialogRoles } from "../../fixture-reader/schema-dialog.js";

export const ${slug.toUpperCase()}_DIALOG_LEDGER = ${q(p.ledger)};
export const ${slug}DialogCombo = ${q(p.combo)};

export const ${slug}DialogRoles: DialogRoles = ${JSON.stringify(p.roles, null, 2)};

const VALUES: Record<string, number | string> = {
${tokenLines}
};

const ${slug}Tokens = cloneTokens(${q(`${opts.slug}.dialog`)}, (path) => {
  if (!(path in VALUES)) throw new Error(${q(`${opts.slug} dialog fixture: no proposed value for `)} + path);
  return VALUES[path]!;
});
${slug}Tokens.lineHeightUnit = ${q(String(p.leaves["lineHeightUnit"]!.value))} as "px" | "auto";
${slug}Tokens.typography = {
  title: ${fontBlock(p, "title")},
  body: ${fontBlock(p, "body")},
};

export const ${slug}DialogSource: ReviewedDialogSource = {
  packageName: ${q(p.provenance.package)},
  version: ${q(p.provenance.version)},
  exportName: ${q(opts.exportName)},
  framework: "react",
  sourceRoot: ${q(opts.sourceRoot)},
  anatomy: {
    root: ${q(`ledger part ${p.roles.paper} (paper): radius ${p.leaves["paper.radius"]?.value}, inset ${p.leaves["paper.paddingY"]?.value}/${p.leaves["paper.paddingX"]?.value}, gap ${p.leaves["paper.itemSpacing"]?.value}, min-width ${p.leaves["paper.minWidth"]?.value}`)},
    control: ${q(`ledger parts ${p.roles.titleBlock ?? p.roles.title} (title block) and ${p.roles.bodyBlock ?? p.roles.body} (body block)`)},
    title: ${q(`ledger part ${p.roles.title}: ${p.typography.title.family} ${p.typography.title.style} ${p.leaves["titleFontSize"]?.value}px / ${p.leaves["titleLineHeight"]?.value}px, text ${JSON.stringify(p.content.title)}; body ${p.roles.body}: ${p.typography.body.family} ${p.typography.body.style} ${p.leaves["bodyFontSize"]?.value}px, text ${JSON.stringify(p.content.body)}`)},
  },
  api: { generated: "proposed from the capture ledger; no API review" },
  styleSources: [${q(p.ledger)}],
  fontSources: [${q(`${p.ledger} title + body`)}],
};

const ${slug}Refusals = makeRefusals(${q(opts.slug)}, [
${receiptRows}
]);

export const ${slug}DialogAdapterConfig = buildConfig(
  ${q(opts.slug)},
  ${slug}DialogSource,
  ${slug}Tokens,
  { id: ${q(`${opts.slug}.dialog`)}, name: ${q(`${opts.displayName} Dialog`)} },
  ${slug}Refusals,
  anatomyFacts(${q(opts.slug)}, ${slug}DialogSource),
  ${q(opts.unsupported)},
  ${q(p.content)},
);

/** The same schema the proposer evaluated, for the drift gate. */
export const ${slug}DialogMappings = dialogSchemaMappings(${slug}DialogRoles, { combo: ${slug}DialogCombo, receipts: ${q(Object.fromEntries(p.receipts.map((r) => [r.path, { why: r.why, evidence: r.evidence }])))} });
`;
}
