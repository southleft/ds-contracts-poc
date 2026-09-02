/**
 * PROPOSE A textarea@1 FIXTURE FROM A CAPTURE LEDGER — the contract of every
 * other proposer: each leaf is read from the ledger, set by a person with
 * evidence, or an archetype spelling; anything else refuses by name.
 *
 * Content: the label is the label part's text (null for the bare cell), the
 * value is the inner textarea's text in the value combo, and the placeholder
 * is the capture config's `fixedProps.placeholder` — the person's own entry,
 * followed from the ledger's provenance and cited — or a reviewed
 * `--set content.placeholder=… --why`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { Ledger } from "./ledger.js";
import { evaluate, interactionRefusals, shadowRefusal, type Proposal } from "./propose-fixture.js";
import { textareaSchemaMappings, textareaSpellingsFor, type TextareaComboMap, type TextareaRoles } from "./schema-textarea.js";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const q = (s: unknown): string => JSON.stringify(s);

export interface TextareaProposal {
  archetype: "textarea";
  library: string;
  ledger: string;
  provenance: { package: string; version: string; browser: string };
  roles: TextareaRoles;
  combos: TextareaComboMap;
  leaves: Proposal["leaves"];
  receipts: Proposal["receipts"];
  refused: string[];
  /** `label: null` is the bare cell. */
  content: { label: string | null; placeholder: string; value: string; placeholderSource: string };
  typography: { label: { family: string; style: string; stack: string }; value: { family: string; style: string; stack: string } };
}

export interface ProposeTextareaInput {
  library: string;
  ledger: string;
  roles: TextareaRoles;
  combos: TextareaComboMap;
  sets?: Record<string, { value: string; why: string }>;
  displayName?: string;
  exportName?: string;
  sourceRoot?: string;
  unsupported?: string[];
  out: string;
}

const selectorMatches = (part: { idxPath: string; tag: string; classes: string[] }, selector: string): boolean =>
  selector === "root" ? part.idxPath === "" : selector.startsWith("idx:") ? part.idxPath === selector.slice(4) : selector.startsWith("cls:") ? part.classes.includes(selector.slice(4)) : selector.startsWith("tag:") ? part.tag === selector.slice(4) : false;

/** The capture config's pinned placeholder for this component, cited by file and entry. */
function placeholderFromConfig(truth: { _provenance: { config?: string; component?: string } }): { value: string; source: string } | null {
  const cfg = truth._provenance.config, name = truth._provenance.component;
  if (!cfg || !name || !existsSync(path.join(REPO, cfg))) return null;
  const json = JSON.parse(readFileSync(path.join(REPO, cfg), "utf8")) as { components?: Array<{ name: string; fixedProps?: Record<string, unknown> }> };
  const entry = (json.components ?? []).find((c) => c.name === name);
  const ph = entry?.fixedProps?.placeholder;
  return typeof ph === "string" && ph.length > 0 ? { value: ph, source: `${cfg}#${name} fixedProps.placeholder` } : null;
}

export function proposeTextareaFixture(input: ProposeTextareaInput): { proposal: TextareaProposal; modulePath: string; proposalPath: string; refused: string[] } {
  const { library, roles, combos } = input;
  const sets = new Map<string, { value: string; why: string }>(Object.entries(input.sets ?? {}));
  const ledger = new Ledger(REPO, input.ledger);
  const truth = JSON.parse(readFileSync(path.join(REPO, input.ledger), "utf8")) as { _provenance: { library: string; browser: string; config?: string; component?: string } };
  const [pkg, version] = truth._provenance.library.split(/@(?=[^@]+$)/);
  const mappings = textareaSchemaMappings(roles, { combos });
  const evaluated = evaluate(ledger, mappings, sets, textareaSpellingsFor(roles));
  for (const which of ["label", "value"] as const) {
    const resolvedSet = sets.get(`typography.${which}.resolved`);
    if (!resolvedSet) continue;
    if (!/^[^/]+\/[^/]+$/.test(resolvedSet.value)) evaluated.refused.push(`typography.${which}.resolved: give "Family/Style" (got ${JSON.stringify(resolvedSet.value)})`);
    else { evaluated.leaves[`typography.${which}.resolved`] = { value: resolvedSet.value, from: "set", why: resolvedSet.why }; evaluated.receipts.push({ path: `typography.${which}.resolved`, why: "the requested face is not on the minting machine", evidence: resolvedSet.why, value: resolvedSet.value }); }
  }
  const proposalPath = path.join(REPO, "recipe/fixture-reader/out/proposals", `textarea.${library}.json`);
  const modulePath = path.join(REPO, input.out);
  const refuse = (why: string) => ({ proposal: null as unknown as TextareaProposal, modulePath, proposalPath, refused: [...evaluated.refused, why] });
  // content
  const baseKey = `${combos["empty.enabled"]}__default`, filledKey = `${combos["value.enabled"]}__default`;
  let labelText: string | null = null;
  if (roles.label) {
    const part = ledger.capture(baseKey).parts.find((p) => selectorMatches(p, roles.label!));
    labelText = (part?.text ?? []).map((t) => t.trim()).find((t) => t.length > 0) ?? null;
    if (labelText === null) return refuse(`content.label: the label part ${roles.label} carries no text at ${baseKey}`);
  }
  const innerFilled = ledger.capture(filledKey).parts.find((p) => selectorMatches(p, roles.inner));
  const valueText = (innerFilled?.text ?? []).map((t) => t.trim()).find((t) => t.length > 0);
  if (!valueText) return refuse(`content.value: the inner part ${roles.inner} carries no text at ${filledKey} — the value combo did not render a value`);
  const phSet = sets.get("content.placeholder");
  const phCfg = placeholderFromConfig(truth);
  const placeholder = phSet ? { value: phSet.value, source: `reviewed: ${phSet.why}` } : phCfg;
  if (!placeholder) return refuse("content.placeholder: the ledger carries no attributes and the capture config pins no fixedProps.placeholder — give --set content.placeholder=… --why");
  if (phSet) evaluated.receipts.push({ path: "content.placeholder", why: "the placeholder is an attribute the ledger does not carry", evidence: phSet.why, value: phSet.value });
  if (evaluated.refused.length > 0) return { proposal: null as unknown as TextareaProposal, modulePath, proposalPath, refused: evaluated.refused };
  const font = (prefix: "label" | "value", sel: string) => ({
    family: String(evaluated.leaves[`typography.${prefix}.family`]?.value ?? ""),
    style: String(evaluated.leaves[`typography.${prefix}.style`]?.value ?? ""),
    stack: roles.label || prefix === "value" ? ledger.raw(baseKey, sel, "font-family") : "(bare cell — inert)",
  });
  const proposal: TextareaProposal = {
    archetype: "textarea",
    library,
    ledger: input.ledger,
    provenance: { package: pkg!, version: version!, browser: truth._provenance.browser },
    roles,
    combos,
    ...evaluated,
    content: { label: labelText, placeholder: placeholder.value, value: valueText, placeholderSource: placeholder.source },
    typography: { label: font("label", roles.label ?? roles.inner), value: font("value", roles.inner) },
  };
  const module = renderTextareaModule(proposal, {
    slug: library,
    displayName: input.displayName ?? library,
    exportName: input.exportName ?? "Textarea",
    sourceRoot: input.sourceRoot ?? `extract/computed/out/${library}`,
    unsupported: input.unsupported ?? [],
  });
  mkdirSync(path.dirname(modulePath), { recursive: true });
  writeFileSync(modulePath, module);
  mkdirSync(path.dirname(proposalPath), { recursive: true });
  writeFileSync(proposalPath, `${JSON.stringify(proposal, null, 2)}\n`);
  return { proposal, modulePath, proposalPath, refused: [] };
}

function fontBlock(p: TextareaProposal, which: "label" | "value"): string {
  if (which === "label" && p.content.label === null) return "bareTextareaLabelFont()";
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

const STRING_LEAVES = new Set(["labelPlacement", "outlineTreatment", "strokeAlign", "boxClips", "typography.label.resolved", "typography.value.resolved"]);

export function renderTextareaModule(p: TextareaProposal, opts: { slug: string; displayName: string; exportName: string; sourceRoot: string; unsupported: string[] }): string {
  const tokenLines = Object.entries(p.leaves)
    .filter(([k]) => !k.startsWith("typography.") && !STRING_LEAVES.has(k))
    .map(([k, v]) => `  ${q(k)}: ${q(v.value)}, // ${v.from === "ledger" ? `ledger ${v.key}` : v.from === "spelling" ? `archetype spelling: ${v.why}` : `reviewed: ${v.why}`}${v.formula ? ` — ${v.formula}` : ""}`)
    .join("\n");
  const ledger = new Ledger(REPO, p.ledger);
  const base = p.combos["empty.enabled"];
  const extra: string[] = [];
  if (p.roles.legend) extra.push(`  { id: "refusal-legend", evidence: ${q(`the outline is a fieldset whose legend (${p.roles.legend}) cuts the notch; no IR fieldset/legend primitive — lowered to a label row filled with the notch colour`)}, target: ${q(`${opts.displayName} fieldset legend`)}, reason: "lowered" },`);
  try {
    const resize = ledger.raw(`${base}__default`, p.roles.inner, "resize");
    if (resize && resize !== "none") extra.push(`  { id: "refusal-resize", evidence: ${q(`the inner textarea is resizable (resize: ${resize}, ${p.ledger}#${base}__default ${p.roles.inner}); the archetype draws no resize grip`)}, target: ${q(`${opts.displayName} resize grip`)}, reason: "no-figma-primitive" },`);
  } catch { /* channel not enumerated: nothing to refuse */ }
  if (p.content.label === null) extra.push(`  { id: "refusal-bare-label", evidence: ${q(`the mount has no label part (${p.ledger}); textarea@1 compiles the bare cell — no label node`)}, target: ${q(`${opts.displayName} label`)}, reason: "refused-by-recipe" },`);
  const receiptRows = [
    ...p.receipts.map((r) => `  { id: ${q(`receipt-${r.path.replace(/\./g, "-")}`)}, evidence: ${q(`${r.why} — ${r.evidence}`)}, target: ${q(`${opts.displayName} ${r.path}`)}, reason: "refused-by-recipe" },`),
    ...extra,
    ...shadowRefusal(ledger, base, p.roles.box, p.archetype).map((r) => `  { id: ${q(r.id)}, evidence: ${q(r.evidence)}, target: ${q(`${opts.displayName} ${r.target}`)}, reason: ${q(r.reason)} },`),
    ...interactionRefusals(ledger, p.archetype).map((r) => `  { id: ${q(r.id)}, evidence: ${q(r.evidence)}, target: ${q(`${opts.displayName} ${r.target}`)}, reason: ${q(r.reason)} },`),
  ].join("\n");
  const slug = opts.slug.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  const s = (k: string): string => q(String(p.leaves[k]!.value));
  const content = { label: p.content.label, placeholder: p.content.placeholder, value: p.content.value };
  return `// GENERATED by recipe/fixture-reader/propose-textarea.ts — do not edit by hand.
// Source of every value: the capture ledger ${p.ledger} (${p.provenance.package}@${p.provenance.version},
// ${p.provenance.browser}) read through the textarea@1 role schema; every leaf
// names its ledger key or its reviewed evidence. The placeholder: ${p.content.placeholderSource}.
// Re-run the proposer to regenerate.
import type { ReviewedTextareaSource } from "../../adapters/textarea.js";
import { anatomyFacts, buildConfig, cloneTokens, makeRefusals } from "../library-textareas.js";
import { bareLabelFont as bareTextareaLabelFont } from "../../recipes/textarea.js";
import { textareaSchemaMappings, type TextareaComboMap, type TextareaRoles } from "../../fixture-reader/schema-textarea.js";

export const ${slug.toUpperCase()}_TEXTAREA_LEDGER = ${q(p.ledger)};
export const ${slug}TextareaCombos: TextareaComboMap = ${JSON.stringify(p.combos, null, 2)};

export const ${slug}TextareaRoles: TextareaRoles = ${JSON.stringify(p.roles, null, 2)};

const VALUES: Record<string, number | string> = {
${tokenLines}
};

const ${slug}Tokens = cloneTokens(${q(`${opts.slug}.textarea`)}, (path) => {
  if (!(path in VALUES)) throw new Error(${q(`${opts.slug} textarea fixture: no proposed value for `)} + path);
  return VALUES[path]!;
});
${slug}Tokens.labelPlacement = ${s("labelPlacement")} as "stacked" | "floating";
${slug}Tokens.outlineTreatment = ${s("outlineTreatment")} as "plain" | "notched";
${slug}Tokens.strokeAlign = ${s("strokeAlign")} as "inside" | "outside";
${slug}Tokens.boxClips = ${String(p.leaves["boxClips"]!.value) === "true"};
${slug}Tokens.typography = {
  label: ${fontBlock(p, "label")},
  value: ${fontBlock(p, "value")},
};
void bareTextareaLabelFont;

export const ${slug}TextareaSource: ReviewedTextareaSource = {
  packageName: ${q(p.provenance.package)},
  version: ${q(p.provenance.version)},
  exportName: ${q(opts.exportName)},
  framework: "react",
  sourceRoot: ${q(opts.sourceRoot)},
  anatomy: {
    root: ${q(`ledger part ${p.roles.container ?? p.roles.box} — ${p.content.label === null ? "the bare cell (no label part)" : `a ${p.leaves["labelPlacement"]?.value} label + box`}`)},
    control: ${q(`ledger part ${p.roles.box}: ${p.leaves["box.height"]?.value}px, radius ${p.leaves["box.radius"]?.value}, border ${p.leaves["box.borderWidth"]?.value}${p.roles.outline ? ` on ${p.roles.outline}` : ""}`)},
    value: ${q(`ledger part ${p.roles.inner}: ${p.typography.value.family} ${p.typography.value.style} ${p.leaves["valueFontSize"]?.value}px / ${p.leaves["box.lineHeight"]?.value}px, ${p.leaves["box.rows"]?.value} rows`)},
    label: ${q(p.content.label === null ? "no label part — the bare cell" : `ledger part ${p.roles.label}: ${p.typography.label.family} ${p.typography.label.style} ${p.leaves["labelFontSize"]?.value}px, text ${JSON.stringify(p.content.label)}`)},
  },
  api: { generated: "proposed from the capture ledger; no API review" },
  styleSources: [${q(p.ledger)}],
  fontSources: [${q(`${p.ledger} value${p.content.label === null ? "" : " + label"}`)}],
};

const ${slug}Refusals = makeRefusals(${q(opts.slug)}, [
${receiptRows}
]);

export const ${slug}TextareaAdapterConfig = buildConfig(
  ${q(opts.slug)},
  ${slug}TextareaSource,
  ${slug}Tokens,
  { id: ${q(`${opts.slug}.textarea`)}, name: ${q(`${opts.displayName} Textarea`)} },
  ${slug}Refusals,
  anatomyFacts(${q(opts.slug)}, ${slug}TextareaSource),
  ${q(opts.unsupported)},
  ${q(content)},
);

/** The same schema the proposer evaluated, for the drift gate. */
export const ${slug}TextareaMappings = textareaSchemaMappings(${slug}TextareaRoles, { combos: ${slug}TextareaCombos, receipts: ${q(Object.fromEntries(p.receipts.filter((r) => r.path !== "content.placeholder").map((r) => [r.path, { why: r.why, evidence: r.evidence }])))} });
`;
}
