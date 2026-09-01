/**
 * PROPOSE A FIXTURE FROM A CAPTURE — the reader writing instead of checking.
 *
 * Until 2026-09-01 the reader only verified hand-typed fixture tables against
 * capture ledgers; a new library meant a person transcribing ~50 leaves per
 * archetype. This evaluates the archetype's role-based schema
 * (schema-checkbox.ts) against a ledger and emits a complete fixture module,
 * so the human act shrinks to two reviewable things: the ROLE MAP (which
 * captured part plays which role) and any leaf the ledger cannot carry, which
 * must be given explicitly with its evidence or the proposer refuses.
 *
 *   npx tsx recipe/fixture-reader/propose-fixture.ts \
 *     --archetype checkbox --library chakra \
 *     --ledger extract/computed/out/chakra/checkbox/captured-truth.json \
 *     --roles '{"hit":"cls:chakra-checkbox__control", ...}' \
 *     --glyph '{"path":"M20 6 L9 17 L4 12","viewBox":24,"paint":"stroke","strokeWidth":3,"cap":"round","join":"round","source":"..."}' \
 *     --set 'dash.width=9.917' --why 'dash.width=…' … \
 *     --out recipe/fixtures/generated/checkbox.chakra.ts
 *
 * Nothing here invents a value. A leaf is one of: READ from the ledger (its
 * ledger key is recorded), SET with a --why (recorded as a reviewed receipt),
 * or absent — and an absent leaf refuses the whole proposal by name.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { Ledger, hex8, num, px } from "./ledger.js";
import { isReceipt, type FactMapping, type LedgerMapping } from "./reader.js";
import { CHECKBOX_SPELLINGS, checkboxSchemaMappings, type CheckboxRoles, type CheckboxSchemaOptions } from "./schema-checkbox.js";
import { toFigmaVectorPath, transformVectorPath, vectorPathHullBounds } from "../figma-vector-path.js";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const args = (name: string): string[] => {
  const out: string[] = [];
  for (let i = 0; i < process.argv.length; i++) if (process.argv[i] === `--${name}` && process.argv[i + 1]) out.push(process.argv[i + 1]!);
  return out;
};

export interface GlyphSpec {
  /** SVG path data in the package's viewBox space (a polyline is given as M/L). */
  path: string;
  /** Square viewBox side in the package's space. */
  viewBox: number;
  paint: "stroke" | "fill";
  /** Stroke width in viewBox units (stroke paint only). */
  strokeWidth?: number;
  cap?: "none" | "round" | "square";
  join?: "miter" | "bevel" | "round";
  winding?: "nonzero" | "evenodd";
  /** Where the geometry was read from — the package file, never a guess. */
  source: string;
}

export interface Proposal {
  archetype: string;
  library: string;
  ledger: string;
  provenance: { package: string; version: string; browser: string };
  roles: CheckboxRoles;
  leaves: Record<string, { value: number | string; from: "ledger" | "set" | "spelling"; key?: string; formula?: string; why?: string }>;
  receipts: Array<{ path: string; why: string; evidence: string; value: number | string }>;
  refused: string[];
  content: { label: string };
  typography: { family: string; style: string; stack: string };
  glyph: { asIs: GlyphSpec; scaled: { path: string; width: number; height: number; strokeWidth: number } };
}

const normalize = (kind: LedgerMapping["kind"], raw: string): number | string =>
  kind === "px" ? px(raw) : kind === "number" ? num(raw) : kind === "color" ? hex8(raw) : raw;

function evaluate(ledger: Ledger, mappings: FactMapping[], sets: Map<string, { value: string; why: string }>): Pick<Proposal, "leaves" | "receipts" | "refused"> {
  const leaves: Proposal["leaves"] = {};
  const receipts: Proposal["receipts"] = [];
  const refused: string[] = [];
  const deferred: Array<{ m: FactMapping & { receipt: string; evidence: string }; spelling: (l: Record<string, number | string>) => number | string }> = [];
  for (const m of mappings) {
    const set = sets.get(m.path);
    if (isReceipt(m)) {
      const spelling = CHECKBOX_SPELLINGS[m.path];
      if (!set && spelling !== undefined) {
        if (typeof spelling === "function") { deferred.push({ m, spelling }); continue; }
        leaves[m.path] = { value: spelling, from: "spelling", why: m.receipt };
        continue;
      }
      if (!set) {
        refused.push(`${m.path}: the ledger cannot carry it (${m.receipt}) and no --set ${m.path}=… --why was given`);
        continue;
      }
      leaves[m.path] = { value: coerce(set.value), from: "set", why: set.why };
      receipts.push({ path: m.path, why: m.receipt, evidence: set.why, value: coerce(set.value) });
      continue;
    }
    const raw: Record<string, string> = {};
    const keys: string[] = [];
    let error: string | null = null;
    for (const [name, read] of Object.entries(m.reads)) {
      const comboKey = `${read.combo}__${read.interaction ?? "default"}`;
      keys.push(`${ledger.file}#${comboKey} ${read.part}${read.pseudo ?? ""}.${read.channel}`);
      try {
        raw[name] = ledger.raw(comboKey, read.part, read.channel, read.pseudo);
      } catch (e) {
        error = (e as Error).message;
        break;
      }
    }
    if (error) {
      if (set) {
        leaves[m.path] = { value: coerce(set.value), from: "set", why: set.why };
        receipts.push({ path: m.path, why: `ledger read refused: ${error}`, evidence: set.why, value: coerce(set.value) });
      } else refused.push(`${m.path}: ${error} — give --set ${m.path}=… --why`);
      continue;
    }
    let value: number | string;
    try {
      value = m.combine ? m.combine(raw) : normalize(m.kind, raw.v!);
    } catch (e) {
      // A read that resolved to something the kind cannot carry ("auto",
      // "none") is as unreadable as a missing part: --set or refuse.
      const msg = (e as Error).message;
      if (set) {
        leaves[m.path] = { value: coerce(set.value), from: "set", why: set.why };
        receipts.push({ path: m.path, why: `ledger value unusable: ${msg}`, evidence: set.why, value: coerce(set.value) });
      } else refused.push(`${m.path}: ${msg} — give --set ${m.path}=… --why`);
      continue;
    }
    leaves[m.path] = { value, from: "ledger", key: keys.join(" | "), formula: m.formula };
  }
  for (const { m, spelling } of deferred) {
    const flat: Record<string, number | string> = {};
    for (const [k, v] of Object.entries(leaves)) flat[k] = v.value;
    try {
      leaves[m.path] = { value: spelling(flat), from: "spelling", why: m.receipt };
    } catch (e) {
      refused.push(`${m.path}: ${(e as Error).message}`);
    }
  }
  return { leaves, receipts, refused };
}

const coerce = (v: string): number | string => (/^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v);

/** Scale the package-space glyph onto the rendered svg box (check.width). */
function scaleGlyph(glyph: GlyphSpec, renderedWidth: number): Proposal["glyph"]["scaled"] {
  const scale = renderedWidth / glyph.viewBox;
  const lowered = toFigmaVectorPath(glyph.path, { arcs: "lower" });
  const scaled = transformVectorPath(lowered, { scale });
  const hull = vectorPathHullBounds(scaled);
  return {
    path: scaled,
    width: Math.round((hull.maxX - hull.minX) * 1e4) / 1e4,
    height: Math.round((hull.maxY - hull.minY) * 1e4) / 1e4,
    strokeWidth: glyph.paint === "stroke" ? Math.round((glyph.strokeWidth ?? 0) * scale * 1e4) / 1e4 : 0,
  };
}

const q = (s: unknown): string => JSON.stringify(s);

function renderModule(p: Proposal, opts: { slug: string; displayName: string; exportName: string; sourceRoot: string; unsupported: string[] }): string {
  const tokenLines = Object.entries(p.leaves)
    .filter(([k]) => !k.startsWith("typography.") && k !== "rowAlign" && k !== "check.path")
    .map(([k, v]) => `  ${q(k)}: ${q(v.value)}, // ${v.from === "ledger" ? `ledger ${v.key}` : v.from === "spelling" ? `archetype spelling: ${v.why}` : `reviewed: ${v.why}`}`)
    .join("\n");
  const receiptRows = p.receipts
    .map((r) => `  { id: ${q(`receipt-${r.path.replace(/\./g, "-")}`)}, evidence: ${q(`${r.why} — ${r.evidence}`)}, target: ${q(`${opts.displayName} ${r.path}`)}, reason: "lowered" as const },`)
    .join("\n");
  const style = p.typography.style;
  return `// GENERATED by recipe/fixture-reader/propose-fixture.ts — do not edit by hand.
// Source of every value: the capture ledger ${p.ledger} (${p.provenance.package}@${p.provenance.version},
// ${p.provenance.browser}) read through the checkbox@1 role schema; every leaf
// names its ledger key or its reviewed evidence. Re-run the proposer to regenerate.
import type { ReviewedCheckboxSource } from "../../adapters/checkbox.js";
import { anatomyFacts, buildConfig, cloneTokens, makeRefusals } from "../library-checkboxes.js";
import { checkboxSchemaMappings, type CheckboxRoles } from "../../fixture-reader/schema-checkbox.js";

export const ${opts.slug.toUpperCase()}_CHECKBOX_LEDGER = ${q(p.ledger)};

export const ${opts.slug}CheckboxRoles: CheckboxRoles = ${JSON.stringify(p.roles, null, 2)};

const VALUES: Record<string, number | string> = {
${tokenLines}
};

const ${opts.slug}Tokens = cloneTokens(${q(`${opts.slug}.checkbox`)}, (path) => {
  if (!(path in VALUES)) throw new Error(${q(`${opts.slug} checkbox fixture: no proposed value for `)} + path);
  return VALUES[path]!;
});
${opts.slug}Tokens.rowAlign = ${q(String(p.leaves["rowAlign"]?.value ?? "center"))} as "center" | "start";
${opts.slug}Tokens.check = {
  ...${opts.slug}Tokens.check,
  // ${p.glyph.asIs.source}; package-space path scaled onto the rendered ${p.leaves["check.width"]?.value}px svg box
  path: ${q(p.glyph.scaled.path)},
  winding: ${q(p.glyph.asIs.winding ?? "nonzero")},
  paint: ${q(p.glyph.asIs.paint)},
  strokeCap: ${q(p.glyph.asIs.cap ?? "none")},
  strokeJoin: ${q(p.glyph.asIs.join ?? "miter")},
  rotation: 0,
  placement: "center",
};
${opts.slug}Tokens.typography = {
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
};

export const ${opts.slug}CheckboxSource: ReviewedCheckboxSource = {
  packageName: ${q(p.provenance.package)},
  version: ${q(p.provenance.version)},
  exportName: ${q(opts.exportName)},
  framework: "react",
  sourceRoot: ${q(opts.sourceRoot)},
  anatomy: {
    root: ${q(`ledger part ${p.roles.hit} (hit) / ${p.roles.row} (row)`)},
    control: ${q(`ledger part ${p.roles.box}: ${p.leaves["box.size"]?.value}px, border ${p.leaves["box.borderWidth"]?.value}, radius ${p.leaves["box.radius"]?.value}`)},
    glyph: ${q(`${p.glyph.asIs.source}; rendered ${p.leaves["check.width"]?.value}x${p.leaves["check.height"]?.value}`)},
    label: ${q(`ledger part ${p.roles.label}: ${p.typography.family} ${style} ${p.leaves["labelFontSize"]?.value}px; text ${JSON.stringify(p.content.label)}`)},
  },
  api: { generated: "proposed from the capture ledger; no API review" },
  styleSources: [${q(p.ledger)}],
  fontSources: [${q(`${p.ledger} label`)}],
};

const ${opts.slug}Refusals = makeRefusals(${q(opts.slug)}, [
${receiptRows}
]);

export const ${opts.slug}CheckboxAdapterConfig = buildConfig(
  ${q(opts.slug)},
  ${opts.slug}CheckboxSource,
  ${opts.slug}Tokens,
  { id: ${q(`${opts.slug}.checkbox`)}, name: ${q(`${opts.displayName} Checkbox`)} },
  ${opts.slug}Refusals,
  anatomyFacts(${q(opts.slug)}, ${opts.slug}CheckboxSource),
  ${q(opts.unsupported)},
  ${q(p.content)},
);

/** The same schema the proposer evaluated, for the drift gate. */
export const ${opts.slug}CheckboxMappings = checkboxSchemaMappings(${opts.slug}CheckboxRoles, ${q(schemaOptionsFor(p))});
`;
}

function schemaOptionsFor(p: Proposal): CheckboxSchemaOptions {
  const receipts: NonNullable<CheckboxSchemaOptions["receipts"]> = {};
  for (const r of p.receipts) receipts[r.path] = { why: r.why, evidence: r.evidence };
  return { glyphPaint: p.glyph.asIs.paint, glyphViewBox: p.glyph.asIs.viewBox, receipts };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const archetype = arg("archetype");
  const library = arg("library");
  const ledgerRel = arg("ledger");
  const rolesJson = arg("roles");
  const glyphJson = arg("glyph");
  const out = arg("out");
  if (archetype !== "checkbox") throw new Error("only checkbox@1 has a reader schema today (--archetype checkbox)");
  if (!library || !ledgerRel || !rolesJson || !glyphJson || !out) throw new Error("usage: --archetype checkbox --library <slug> --ledger <captured-truth.json> --roles <json> --glyph <json> --out <file> [--set path=value --why 'path=evidence']… [--display-name] [--export-name] [--source-root] [--unsupported a,b]");
  const roles = JSON.parse(rolesJson) as CheckboxRoles;
  const glyph = JSON.parse(glyphJson) as GlyphSpec;
  const sets = new Map<string, { value: string; why: string }>();
  const whys = new Map(args("why").map((w) => { const i = w.indexOf("="); return [w.slice(0, i), w.slice(i + 1)] as const; }));
  for (const s of args("set")) {
    const i = s.indexOf("=");
    const p = s.slice(0, i);
    const why = whys.get(p);
    if (!why) throw new Error(`--set ${p} needs a matching --why '${p}=<evidence>'`);
    sets.set(p, { value: s.slice(i + 1), why });
  }
  const ledger = new Ledger(REPO, ledgerRel);
  const truth = JSON.parse(readFileSync(path.join(REPO, ledgerRel), "utf8")) as { _provenance: { library: string; browser: string } };
  const [pkg, version] = truth._provenance.library.split(/@(?=[^@]+$)/);
  const receiptsForSchema: NonNullable<CheckboxSchemaOptions["receipts"]> = {};
  // check.path is cited from the package (--glyph), never read from the DOM.
  receiptsForSchema["check.path"] = { why: "glyph geometry is cited from the package source (--glyph), not a computed channel", evidence: glyph.source };
  const mappings = checkboxSchemaMappings(roles, { glyphPaint: glyph.paint, glyphViewBox: glyph.viewBox, receipts: receiptsForSchema });
  sets.set("check.path", { value: "(see glyph)", why: glyph.source });
  const evaluated = evaluate(ledger, mappings, sets);
  if (evaluated.refused.length > 0) {
    console.error(`✖ ${library}/${archetype}: ${evaluated.refused.length} leaf/leaves cannot be proposed:\n  - ${evaluated.refused.join("\n  - ")}`);
    process.exit(1);
  }
  const labelPart = ledger.capture("unchecked.enabled__default").parts.find((p) => selectorMatches(p, roles.label));
  const labelText = (labelPart?.text ?? [])[0] ?? "";
  const family = String(evaluated.leaves["typography.label.family"]?.value ?? "");
  const style = String(evaluated.leaves["typography.label.style"]?.value ?? "");
  const stack = ledger.raw("unchecked.enabled__default", roles.label, "font-family");
  const renderedWidth = Number(evaluated.leaves["check.width"]?.value);
  const scaled = scaleGlyph(glyph, renderedWidth);
  // check.strokeWidth: the ledger read is in rendered px already; the cited
  // glyph's stroke scaled onto the rendered box must agree, or say so.
  const readStroke = Number(evaluated.leaves["check.strokeWidth"]?.value ?? 0);
  if (glyph.paint === "stroke" && Math.abs(readStroke - scaled.strokeWidth) > 0.05)
    console.warn(`  note: ledger stroke-width ${readStroke} vs cited glyph stroke ${glyph.strokeWidth} scaled ${scaled.strokeWidth} — the ledger value is kept`);
  const proposal: Proposal = {
    archetype,
    library,
    ledger: ledgerRel,
    provenance: { package: pkg!, version: version!, browser: truth._provenance.browser },
    roles,
    ...evaluated,
    content: { label: labelText },
    typography: { family, style, stack },
    glyph: { asIs: glyph, scaled },
  };
  const slug = library;
  const module = renderModule(proposal, {
    slug,
    displayName: arg("display-name") ?? library,
    exportName: arg("export-name") ?? "Checkbox",
    sourceRoot: arg("source-root") ?? `extract/computed/out/${library}`,
    unsupported: (arg("unsupported") ?? "").split(",").filter(Boolean),
  });
  mkdirSync(path.dirname(path.join(REPO, out)), { recursive: true });
  writeFileSync(path.join(REPO, out), module);
  const proposalPath = path.join(REPO, "recipe/fixture-reader/out/proposals", `${archetype}.${library}.json`);
  mkdirSync(path.dirname(proposalPath), { recursive: true });
  writeFileSync(proposalPath, `${JSON.stringify(proposal, null, 2)}\n`);
  const fromLedger = Object.values(proposal.leaves).filter((l) => l.from === "ledger").length;
  const fromSet = Object.values(proposal.leaves).filter((l) => l.from === "set").length;
  const fromSpelling = Object.values(proposal.leaves).filter((l) => l.from === "spelling").length;
  console.log(`✔ ${library}/${archetype}: ${fromLedger} leaves read from the ledger, ${fromSet} reviewed (named), ${fromSpelling} archetype spellings, 0 invented → ${out}`);
  console.log(`  proposal: ${path.relative(REPO, proposalPath)}; label ${JSON.stringify(labelText)}; ${family} ${style}; glyph ${scaled.width}x${scaled.height} stroke ${scaled.strokeWidth}`);
}

function selectorMatches(part: { tag: string; classes: string[]; idxPath: string }, selector: string): boolean {
  if (selector.startsWith("cls:")) return part.classes.includes(selector.slice(4).split("#")[0]!);
  if (selector.startsWith("tag:")) return part.tag === selector.slice(4).split("#")[0];
  if (selector.startsWith("idx:")) return part.idxPath === selector.slice(4);
  return selector === "root" ? part.idxPath === "" : false;
}
