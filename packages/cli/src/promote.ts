/**
 * FLOOR PROMOTION — the shared pipeline, extracted from six near-identical
 * copies of `examples/<lib>/scripts/promote-floor.{mjs,ts}`.
 *
 * Promotion is step 6 of the bring-your-own-design-system recipe (docs/21 §2.6)
 * and it was the ONE step with no CLI verb: every library carried its own
 * ~450-line script, and a fix landed in one of them (the class-stem join
 * defect, task #25) stayed latent in the other five. This module is that
 * pipeline once, driven by a per-library JSON config:
 *
 *   ds-contracts promote --config examples/carbon/promote.config.json
 *   (and, inside `ds-contracts onboard --continue`, the promote stage)
 *
 * What it does, per component:
 *   · pick the RESOLVED contract when a decisions ledger produced one, else
 *     the enriched contract; bump the version; append promotion provenance;
 *   · copy floor-reconstructed svg assets into the example's icon dir (a
 *     contract referencing an uncopied asset refuses by name at emit);
 *   · probe `bindings.figma.statePreviews` against the REAL referee (core/emit-react
 *     validateContract) — the referee decides, and its refusals are printed;
 *   · SOURCE-ALIAS the minted tree: a minted leaf whose covering combos all
 *     agree on ONE source token, and whose minted value equals that token's
 *     DTCG value, becomes a DTCG alias to it. Value equality is checked twice
 *     (capture + here), so aliasing can never move a pixel — it only changes
 *     SEMANTICS: Figma variables and emitted code reference the library's own
 *     token names instead of anonymous imported literals;
 *   · write provenance-anchor sidecars for every aliased leaf;
 *   · REFUSE the whole promotion if any contract `{imported.*}` ref (axis-
 *     expanded) or any alias fails to resolve.
 *
 * NOT GENERALIZED, BY NAME: `examples/astryx/scripts/promote-floor.ts` (the
 * re-anchor decisions ledger must be re-applied after the mint merge — task
 * #43 closed the staleness, the ledger mechanism remains astryx's own). It
 * keeps its script. A partial generalization that says which one it left
 * alone beats a total one that moves artifacts silently. Polaris joined this
 * pipeline in the task-#26 recapture round (2026-07-29): its bespoke v0.3.2
 * promoter had no source-alias pass, and the recapture — the round where the
 * artifacts were moving anyway, with receipts — was the honest moment to
 * migrate rather than port a sixth copy of the alias pass. Its un-namespaced
 * capture out dirs ride `captureOut: "extract/computed/out"` + `contractStem`.
 *
 * BYTE DISCIPLINE: every per-library string that reaches a committed artifact
 * (the promoter path in the contract description, the possessive in the
 * receipt, the MINTED.md title) is a CONFIG FIELD, not a derivation — the
 * four generalized libraries reproduce their committed bytes exactly, quirks
 * included (see `examples/tailwind/promote.config.json`).
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  assertContractProvenance,
  revisionOf,
  validateContract,
  type ProvenancedContract,
} from "@ds-contracts/core";
import { promoteStaticArtifact } from "../../../extract/static-promotion.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface PromoteConfig {
  /** Library slug — used only in log lines. */
  library: string;
  /** Repo-relative example dir (`examples/carbon`). */
  exampleDir: string;
  /** Repo-relative capture out dir (`extract/computed/out/carbon`). */
  captureOut: string;
  /** Repo-relative base DTCG file — aliases are value-verified against it. */
  dtcg: string;
  /** Repo-relative minted tree written by this run. */
  mintedOut: string;
  /** Repo-relative MINTED.md receipt written by this run. */
  mintedDoc: string;
  /** Capture out-dir names, in promotion order. */
  components: string[];
  /** Components whose minted trees merge in (defaults to `components` —
   *  Astryx-style shared minting can list more). */
  mintSources?: string[];
  /** capture-dir name → contract file stem, where the two spellings differ. */
  contractStem?: Record<string, string>;
  /** Version stamped on every promoted contract. */
  contractVersion: string;
  /** Path named inside each promoted contract's description — the thing a
   *  reader runs to reproduce it. */
  promoterPath: string;
  /** Possessive used in the description and receipt ("Carbon's", "MUI's",
   *  "the library's"). A CONFIG field because it is committed bytes. */
  possessive: string;
  /** First line of MINTED.md, minus the "— promotion receipt" suffix. */
  mintedDocTitle: string;
  /** Receipt every source fact that reached no minted leaf (a silent alias
   *  loss). Carbon ships these; turning it on elsewhere ADDS receipt lines to
   *  that library's MINTED.md, so it stays opt-in per library. */
  unjoinedFactReceipts?: boolean;
  /** Repo-relative AUTHORED-FACTS ledger (see the authored-facts door below):
   *  reviewed hand-authored facts the capture cannot carry, applied here so
   *  the committed artifacts stay re-derivable. Optional; no field, no path. */
  authored?: string;
}

const REQUIRED: Array<keyof PromoteConfig> = [
  "library",
  "exampleDir",
  "captureOut",
  "dtcg",
  "mintedOut",
  "mintedDoc",
  "components",
  "contractVersion",
  "promoterPath",
  "possessive",
  "mintedDocTitle",
];

/** PURE referee: unknown JSON → PromoteConfig, refusing every missing field BY
 *  NAME (`__`-prefixed keys are notes and are ignored, the capture-config
 *  convention). */
export function parsePromoteConfig(raw: unknown, from: string): PromoteConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`${from}: promote config must be a JSON object`);
  }
  const obj = raw as Record<string, unknown>;
  const missing = REQUIRED.filter((k) => obj[k] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `${from}: promote config is missing required field(s): ${missing.join(", ")}`,
    );
  }
  if (!Array.isArray(obj.components) || obj.components.length === 0) {
    throw new Error(
      `${from}: "components" must be a non-empty array of capture out-dir names`,
    );
  }
  return obj as unknown as PromoteConfig;
}

// ---------------------------------------------------------------------------
// Pure core — value comparison, minted merge, join-key normalization
// ---------------------------------------------------------------------------

type Leaf = { $value: unknown; [k: string]: unknown };
type Tree = Record<string, unknown>;
const isLeaf = (v: unknown): v is Leaf =>
  !!v && typeof v === "object" && "$value" in (v as object);
const isTree = (v: unknown): v is Tree =>
  !!v && typeof v === "object" && !("$value" in (v as object));

/** PURE: colour literal → comparable `r,g,b,a` tuple, or null when the value is
 *  not a colour (lengths compare as strings). */
export const colorTuple = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  let s = v.trim();
  const h3 = /^#([0-9a-f]{3,4})$/i.exec(s);
  if (h3) s = "#" + [...h3[1]].map((c) => c + c).join("");
  let m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s);
  if (m) {
    const n = parseInt(m[1], 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${m[2] ? Math.round((parseInt(m[2], 16) / 255) * 10000) / 10000 : 1}`;
  }
  m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(s);
  if (m) return `${m[1]},${m[2]},${m[3]},${Number(m[4] ?? 1)}`;
  return null;
};

/** PURE: two token values are the same value (string-equal, or the same colour
 *  spelled differently). */
export const valueEq = (a: unknown, b: unknown): boolean => {
  if (String(a) === String(b)) return true;
  const ta = colorTuple(String(a));
  return ta !== null && ta === colorTuple(String(b));
};

/**
 * JOIN-KEY NORMALIZATION (class-stem prefix round, task #25).
 *
 * The alias pass joins a MINTED TOKEN PATH segment against a SOURCE FACT's
 * `part` name, and those two spellings are not the same string: the minted
 * path runs every segment through `core/mint-tokens.ts` `sanitizeSegment`
 * ([a-z0-9-] only, camel split, runs collapsed) while `source-bindings.json`
 * carries the RAW promoted part name.
 *
 * With positional part names (`part-1-1-0`) the sanitized form equalled the
 * raw form and the join worked BY COINCIDENCE. Carbon's BEM element stems
 * carry `__` — `toggle__switch` mints as `toggle-switch` — and the join
 * silently missed, costing four verified aliases. Carbon's script fixed it
 * locally and its comment said the same latent join lived in the other five
 * scripts; generalizing makes the fix unconditional for every library that
 * goes through this module. It is byte-neutral for MUI/Tailwind/Altitude
 * (proven by re-promotion, not assumed).
 *
 * MIRRORED, NOT IMPORTED: `sanitizeSegment` is module-private in
 * `core/mint-tokens.ts`, and exporting it would change the plugin ENGINE
 * BUNDLE to serve promotion. The rule is copied here verbatim; the
 * unjoined-fact receipt makes a future divergence LOUD instead of silent.
 */
export const mintSegment = (s: string): string =>
  s
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

/** PURE: merge one component's minted tree into the accumulator; two
 *  components minting different values under one path is a hard refusal. */
export function mergeInto(target: Tree, src: Tree, prefix = ""): void {
  for (const [k, v] of Object.entries(src)) {
    if (isTree(v)) {
      if (!(k in target)) target[k] = {};
      mergeInto(target[k] as Tree, v, `${prefix}${k}.`);
    } else if (k in target && JSON.stringify(target[k]) !== JSON.stringify(v)) {
      throw new Error(
        `minted-token collision at "${prefix}${k}" — two components minted different values under one path`,
      );
    } else {
      target[k] = v;
    }
  }
}

export interface SourceFact {
  part: string;
  channel: string;
  token: string;
  axisValues: Record<string, string>;
  varName?: string;
  anchor?: { selector?: string };
}

export interface Anchor {
  leaf: string;
  token: string;
  part: string;
  cssProperty: string;
  varName: string;
  selector: string;
}

export interface AliasOutcome {
  aliased: number;
  literalKept: number;
  receipts: string[];
  anchors: Anchor[];
  /** `${part}|${channel}` keys that reached a leaf. */
  joined: Set<string>;
}

/**
 * PURE (mutates the passed tree, returns the receipts): the SOURCE-ALIAS pass.
 * Walks one component's `imported.*` minted subtree; a leaf whose covering
 * combos all name ONE token — with matching value — is rewritten to `{token}`.
 * Everything else stays literal, and every non-obvious refusal is receipted.
 */
export function aliasPass(
  node: Tree,
  segs: string[],
  facts: SourceFact[],
  tokenValue: (name: string) => unknown,
  out: AliasOutcome,
): void {
  for (const [k, v] of Object.entries(node)) {
    if (isLeaf(v)) {
      const leafPath = [...segs, k];
      // leaf: imported.<comp>.<part...>.<channel>[.axisVal...] — find the
      // channel segment (the one matching a fact's channel); trailing segments
      // are the axis values the leaf is conditioned on. Join on the MINTED
      // spelling of the fact's part (see mintSegment).
      const byChannel = new Set<string>();
      for (const f of facts)
        byChannel.add(`${mintSegment(f.part)}|${f.channel}`);
      let matched: {
        token: string;
        part: string;
        channel: string;
        varName: string;
        selector: string;
      } | null = null;
      for (let ci = leafPath.length - 1; ci >= 2; ci--) {
        // a state-plane leaf spells the channel with a -state-<x> suffix
        // (background-color-state-disabled) — same source channel.
        const channel = leafPath[ci].replace(/-state-[a-z-]+$/, "");
        const part = leafPath.slice(2, ci).join(".") || "root";
        if (!byChannel.has(`${part}|${channel}`)) continue;
        const axisVals = leafPath.slice(ci + 1);
        // VALUE AGREEMENT is the plane selector: state facts and base facts
        // share (part, channel, axis values) — the minted value picks which
        // plane this leaf belongs to (equality was verified at capture, so
        // this drops only other-plane facts, never the leaf's own).
        const covering = facts.filter(
          (f) =>
            mintSegment(f.part) === part &&
            f.channel === channel &&
            axisVals.every((av) => Object.values(f.axisValues).includes(av)) &&
            valueEq(v.$value, tokenValue(f.token)),
        );
        if (covering.length === 0) break;
        const toks = new Set(covering.map((f) => f.token));
        if (toks.size !== 1) {
          out.receipts.push(
            `kept literal ${leafPath.join(".")}: covering combos disagree (${[...toks].sort().join(", ")})`,
          );
          break;
        }
        const tok = [...toks][0];
        if (!valueEq(v.$value, tokenValue(tok))) {
          out.receipts.push(
            `kept literal ${leafPath.join(".")}: minted value ${v.$value} ≠ ${tok} value ${tokenValue(tok)}`,
          );
          break;
        }
        const witness = covering[0];
        matched = {
          token: tok,
          part,
          channel,
          varName: witness.varName ?? "",
          selector: witness.anchor?.selector ?? "",
        };
        out.joined.add(`${part}|${channel}`);
        break;
      }
      if (matched) {
        v.$value = `{${matched.token}}`;
        out.aliased++;
        out.anchors.push({
          leaf: leafPath.join("."),
          token: matched.token,
          part: matched.part,
          cssProperty: matched.channel,
          varName: matched.varName,
          selector: matched.selector,
        });
      } else out.literalKept++;
    } else if (isTree(v)) {
      aliasPass(v as Tree, [...segs, k], facts, tokenValue, out);
    }
  }
}

/** PURE: every `$value` path in a token tree, dot-joined. */
export function leafPaths(tree: Tree): Set<string> {
  const set = new Set<string>();
  (function walk(n: Tree, p: string[]) {
    for (const [k, v] of Object.entries(n)) {
      if (isLeaf(v)) set.add([...p, k].join("."));
      else if (isTree(v)) walk(v as Tree, [...p, k]);
    }
  })(tree, []);
  return set;
}

/**
 * PURE: the RESOLUTION GUARD. Every `{imported.*}` ref in every promoted
 * contract (axis placeholders expanded over that contract's enum values) must
 * resolve in the merged tree, and every alias in the tree must resolve in the
 * base DTCG. A promoted set that cannot resolve is not a promotion.
 */
export function resolutionGuard(
  minted: Tree,
  contracts: Array<{ name: string; contract: Record<string, unknown> }>,
  tokenValue: (name: string) => unknown,
): { dangling: string[]; badAliases: string[] } {
  const leafSet = leafPaths(minted);
  const dangling: string[] = [];
  for (const { name, contract } of contracts) {
    for (const { ref, from } of expandedImportedRefs(contract)) {
      if (!leafSet.has(ref)) dangling.push(`${name}: {${ref}} (from {${from}})`);
    }
  }
  const badAliases: string[] = [];
  (function walk(n: Tree, p: string[]) {
    for (const [k, v] of Object.entries(n)) {
      if (isLeaf(v)) {
        const mm = /^\{(.+)\}$/.exec(String(v.$value));
        if (mm && tokenValue(mm[1]) === undefined)
          badAliases.push([...p, k].join(".") + " -> " + String(v.$value));
      } else if (isTree(v)) walk(v as Tree, [...p, k]);
    }
  })(minted, []);
  return { dangling, badAliases };
}

// ---------------------------------------------------------------------------
// AUTHORED FACTS — the reviewed hand-authoring door (2026-08-22)
//
// WHY. Commit 16889547 (2026-08-17) authored the Fab/Avatar boxes, clipped
// Accordion's collapse-root and dropped Link's glyph-hugging width by editing
// the PROMOTED contracts and the minted tree directly — facts the capture
// cannot carry (the geometry exclusion refuses a flex root's width/height by
// design; the 30.22px Link width is a capture-font fact, not the library's).
// The canvas got better and the artifacts stopped being re-derivable: the
// next promotion would have silently reverted all four, and one minted leaf
// (`imported.link.root.width`) shipped as a Figma variable nothing bound.
//
// The door: a per-library ledger (`authored` in ds-library.json), applied by
// THIS module after the computed contract is read and before the resolution
// guard, so re-promotion reproduces the committed bytes and every authored
// fact names its cause. Strict by construction — every row REFUSES BY NAME
// when the capture already carries what it sets, when its target part/prop/
// value/leaf does not exist, or when a pruned leaf is still referenced — so a
// ledger row cannot outlive the capture gap it papers over: the day the
// capture learns to carry the fact, the promotion refuses and the row is
// deleted. Authored keys APPEND after the capture's keys, in ledger order
// (the capture's own convention for plane groups); nothing is re-sorted.
// Libraries without a ledger are byte-neutral (no field, no code path).
// ---------------------------------------------------------------------------

export interface AuthoredRow {
  /** Capture out-dir name (`components` spelling, not the contract stem). */
  component: string;
  /** Anatomy part name — the target for `declared`/`tokens`/`tokensByProp`/
   *  `unset`, and for `fields`/`edit` when the fact lives on a part. */
  part?: string;
  /** A `props[]` entry by name — the target for `fields`/`edit` on a prop
   *  (tailwind Alert's `dismissable` rebinding). Exclusive with `part`. */
  prop?: string;
  /** Dotted descent INSIDE the target (root / part / prop) to the object
   *  `fields`/`edit` act on (`semantics`, `layout`). Every segment must be an
   *  existing plain object — a missing group is a named refusal. */
  path?: string;
  set?: {
    declared?: Record<string, string>;
    tokens?: Record<string, string>;
    /** prop → enum value → channel → token ref. */
    tokensByProp?: Record<string, Record<string, Record<string, string>>>;
    /** New keys on the target object (any JSON value: `events`, `element`,
     *  `attrs`, `role`…). A key the capture already carries refuses. */
    fields?: Record<string, unknown>;
    /** Place the new `fields` keys immediately after this existing key
     *  instead of appending — committed byte order is a fact too (Alert's
     *  `element`/`attrs` sit after `description`, `events` after `anatomy`).
     *  Names a key the target lacks → refusal. */
    after?: string;
  };
  unset?: { tokens?: string[] };
  /** Existing scalar/JSON fields of the target (dotted inside it:
   *  `bindings.code.prop`) rewritten from → to. The current value must equal
   *  `from` exactly, so a capture that moves under the row refuses by name
   *  instead of being overwritten. */
  edit?: Record<string, { from: unknown; to: unknown }>;
  /** Dotted `imported.<component>.<part>…` leaf → DTCG leaf. */
  mint?: Record<string, Leaf>;
  /** Dotted leaf paths to REMOVE from the merged minted tree. */
  prune?: string[];
  /** The reviewed reason; committed bytes, quoted in MINTED.md. */
  cause: string;
}

/** PURE referee: unknown JSON → rows, refusing every malformed row BY NAME. */
export function parseAuthoredLedger(raw: unknown, from: string): AuthoredRow[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`${from}: authored ledger must be a JSON object with a "rows" array`);
  }
  const rows = (raw as { rows?: unknown }).rows;
  if (!Array.isArray(rows)) throw new Error(`${from}: authored ledger is missing the "rows" array`);
  rows.forEach((r, i) => {
    const row = r as Record<string, unknown>;
    const at = `${from} row ${i}`;
    if (!row || typeof row !== "object") throw new Error(`${at}: must be an object`);
    if (typeof row.component !== "string" || !row.component) throw new Error(`${at}: "component" must name a capture out-dir`);
    if (typeof row.cause !== "string" || !row.cause.trim()) throw new Error(`${at}: "cause" must say why this fact is authored by hand`);
    const ops = ["set", "unset", "edit", "mint", "prune"].filter((k) => row[k] !== undefined);
    if (ops.length === 0) throw new Error(`${at}: names no operation (set / unset / edit / mint / prune)`);
    if (row.part !== undefined && row.prop !== undefined) throw new Error(`${at}: "part" and "prop" are exclusive targets`);
    const set = (row.set ?? {}) as Record<string, unknown>;
    const partOnly = ["declared", "tokens", "tokensByProp"].filter((k) => set[k] !== undefined);
    if ((partOnly.length > 0 || row.unset !== undefined) && typeof row.part !== "string") {
      throw new Error(`${at}: ${[...partOnly, ...(row.unset !== undefined ? ["unset"] : [])].join("/")} need a "part" (anatomy part name)`);
    }
    if ((partOnly.length > 0 || row.unset !== undefined) && row.path !== undefined) {
      throw new Error(`${at}: declared/tokens/tokensByProp/unset act on the part itself — "path" is for fields/edit`);
    }
    if (set.after !== undefined && (typeof set.after !== "string" || !set.fields)) {
      throw new Error(`${at}: "after" must be a key name and needs "fields" to place`);
    }
    for (const [k, e] of Object.entries((row.edit as Record<string, unknown>) ?? {})) {
      if (!e || typeof e !== "object" || !("from" in e) || !("to" in e)) {
        throw new Error(`${at}: edit "${k}" must carry both "from" (the captured value) and "to"`);
      }
    }
    for (const [leaf, v] of Object.entries((row.mint as Record<string, unknown>) ?? {})) {
      if (!isLeaf(v) || typeof v.$value !== "string" || typeof v.$type !== "string") {
        throw new Error(`${at}: mint "${leaf}" must be a DTCG leaf with string $value and $type`);
      }
      if (!leaf.startsWith(`imported.${row.component}.`)) {
        throw new Error(`${at}: mint "${leaf}" must live under imported.${row.component}. — authored leaves mint in the component's own namespace`);
      }
    }
  });
  return rows as AuthoredRow[];
}

type AnatomyPart = Record<string, unknown> & { parts?: Record<string, AnatomyPart> };

/** PURE: the ONE part of that name in the anatomy tree (0 or 2+ → null). */
function findPart(contract: Record<string, unknown>, name: string): AnatomyPart | null {
  const hits: AnatomyPart[] = [];
  const visit = (parts: Record<string, AnatomyPart> | undefined): void => {
    for (const [n, p] of Object.entries(parts ?? {})) {
      if (n === name) hits.push(p);
      visit(p.parts);
    }
  };
  visit(contract.anatomy as Record<string, AnatomyPart> | undefined);
  return hits.length === 1 ? hits[0] : null;
}

/** PURE (mutates the contract): apply one row's set/unset; returns the receipt
 *  fragments. Every impossible or already-carried edit REFUSES BY NAME. */
export function applyAuthoredContractRow(
  contract: Record<string, unknown>,
  row: AuthoredRow,
): string[] {
  const done: string[] = [];
  if (!row.set && !row.unset && !row.edit) return done;
  const label = `authored ${row.component}${row.part ? `.${row.part}` : row.prop ? ` prop ${row.prop}` : ""}${row.path ? ` @${row.path}` : ""}`;
  const isObj = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object" && !Array.isArray(v);
  // The target: the part, the prop, or the contract root — then `path`.
  let part: AnatomyPart | null = null;
  let target: Record<string, unknown> = contract;
  if (row.part !== undefined) {
    part = findPart(contract, row.part);
    if (!part) {
      throw new Error(`${label}: part "${row.part}" is not exactly one part of the promoted anatomy — NAMED refusal (the anatomy promotion no longer carries it, or the name is ambiguous)`);
    }
    target = part;
  } else if (row.prop !== undefined) {
    const hits = ((contract.props ?? []) as Array<Record<string, unknown>>).filter((p) => p.name === row.prop);
    if (hits.length !== 1) throw new Error(`${label}: prop "${row.prop}" is not exactly one entry of props[] — NAMED refusal`);
    target = hits[0];
  }
  for (const seg of row.path ? row.path.split(".") : []) {
    const next = target[seg];
    if (!isObj(next)) throw new Error(`${label}: path segment "${seg}" is not an existing object on the target — NAMED refusal (the capture does not carry that group)`);
    target = next;
  }
  const descend = (root: Record<string, unknown>, dotted: string): [Record<string, unknown>, string] => {
    const segs = dotted.split(".");
    let node = root;
    for (const seg of segs.slice(0, -1)) {
      const next = node[seg];
      if (!isObj(next)) throw new Error(`${label}: "${dotted}" — segment "${seg}" is not an existing object — NAMED refusal`);
      node = next;
    }
    return [node, segs[segs.length - 1]];
  };
  if (row.set?.fields) {
    const fields = row.set.fields;
    for (const k of Object.keys(fields)) {
      if (k in target) {
        throw new Error(`${label}: field "${k}" is ALREADY carried by the capture (${JSON.stringify(target[k]).slice(0, 80)}) — the authored row is stale; delete it rather than let two sources disagree`);
      }
    }
    const after = row.set.after;
    if (after !== undefined && !(after in target)) {
      throw new Error(`${label}: "after" names "${after}", which the target does not carry — NAMED refusal`);
    }
    // Placement is a byte fact: rebuild the key order in place (same object
    // reference — the part/prop stays wired into the contract).
    const entries = Object.entries(target);
    const at = after === undefined ? entries.length : entries.findIndex(([k]) => k === after) + 1;
    entries.splice(at, 0, ...Object.entries(fields));
    for (const k of Object.keys(target)) delete target[k];
    for (const [k, v] of entries) target[k] = v;
    done.push(`set fields ${Object.keys(fields).join(", ")}${after !== undefined ? ` (after ${after})` : ""}`);
  }
  if (row.edit) {
    for (const [dotted, { from, to }] of Object.entries(row.edit)) {
      const [node, key] = descend(target, dotted);
      if (!(key in node)) throw new Error(`${label}: edit "${dotted}" — the capture no longer carries it; the authored row is stale, delete it`);
      if (JSON.stringify(node[key]) !== JSON.stringify(from)) {
        throw new Error(`${label}: edit "${dotted}" — the captured value moved (now ${JSON.stringify(node[key]).slice(0, 80)}, row expected ${JSON.stringify(from).slice(0, 80)}); re-review the row`);
      }
      node[key] = to;
    }
    done.push(`edit ${Object.keys(row.edit).join(", ")}`);
  }
  if (!part) return done;
  const setMap = (field: "declared" | "tokens", values: Record<string, string>): void => {
    const target = ((part[field] as Record<string, string> | undefined) ??= {});
    for (const [k, v] of Object.entries(values)) {
      if (k in target) {
        throw new Error(`${label}: ${field}.${k} is ALREADY carried by the capture (${JSON.stringify(target[k])}) — the authored row is stale; delete it rather than let two sources disagree`);
      }
      target[k] = v;
    }
    done.push(`set ${field} ${Object.keys(values).join(", ")}`);
  };
  if (row.set?.declared) setMap("declared", row.set.declared);
  if (row.set?.tokens) setMap("tokens", row.set.tokens);
  if (row.set?.tokensByProp) {
    const props = (contract.props ?? []) as Array<{ name: string; type?: { enum?: string[] } }>;
    const raw = part.tokensByProp as Array<{ prop: string; map: Record<string, Record<string, string>> }> | { prop: string; map: Record<string, Record<string, string>> } | undefined;
    const entries = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
    for (const [prop, byValue] of Object.entries(row.set.tokensByProp)) {
      const enumValues = props.find((p) => p.name === prop)?.type?.enum;
      if (!enumValues) throw new Error(`${label}: tokensByProp prop "${prop}" is not an enum prop of this contract`);
      const matching = entries.filter((e) => e.prop === prop);
      if (matching.length > 1) throw new Error(`${label}: tokensByProp has ${matching.length} entries for prop "${prop}" — ambiguous target`);
      let entry = matching[0];
      if (!entry) {
        entry = { prop, map: {} };
        entries.push(entry);
      }
      for (const [value, channels] of Object.entries(byValue)) {
        if (!enumValues.includes(value)) throw new Error(`${label}: "${value}" is not a value of enum prop "${prop}" (${enumValues.join(", ")})`);
        const cell = (entry.map[value] ??= {});
        for (const [k, v] of Object.entries(channels)) {
          if (k in cell) throw new Error(`${label}: tokensByProp ${prop}=${value}.${k} is ALREADY carried by the capture (${JSON.stringify(cell[k])}) — stale authored row`);
          cell[k] = v;
        }
      }
      done.push(`set tokensByProp ${prop}=${Object.keys(byValue).join("|")} ${[...new Set(Object.values(byValue).flatMap((c) => Object.keys(c)))].join(", ")}`);
    }
    part.tokensByProp = Array.isArray(raw) || raw === undefined ? entries : entries[0];
  }
  if (row.unset?.tokens) {
    const tokens = part.tokens as Record<string, string> | undefined;
    for (const k of row.unset.tokens) {
      if (!tokens || !(k in tokens)) throw new Error(`${label}: unset tokens.${k} — the capture no longer binds it; the authored row is stale, delete it`);
      delete tokens[k];
    }
    if (tokens && Object.keys(tokens).length === 0) delete part.tokens;
    done.push(`unset tokens ${row.unset.tokens.join(", ")}`);
  }
  return done;
}

/** PURE (mutates the tree): add authored leaves; an existing node at the path
 *  (leaf OR group) is a NAMED refusal — the capture already mints it. */
export function applyAuthoredMint(tree: Tree, row: AuthoredRow): string[] {
  if (!row.mint) return [];
  for (const [leaf, value] of Object.entries(row.mint)) {
    const segs = leaf.split(".");
    let node: Tree = tree;
    for (const s of segs.slice(0, -1)) {
      const next = node[s];
      if (next === undefined) node[s] = {};
      else if (!isTree(next)) throw new Error(`authored mint ${leaf}: "${s}" is a leaf in the capture's minted tree, not a group`);
      node = node[s] as Tree;
    }
    const last = segs[segs.length - 1];
    if (last in node) {
      throw new Error(`authored mint ${leaf}: the capture ALREADY mints this path — the authored row is stale; delete it rather than let two sources disagree`);
    }
    node[last] = { $value: value.$value, $type: value.$type };
  }
  return [`mint ${Object.keys(row.mint).join(", ")}`];
}

/** PURE (mutates the tree): remove named leaves, then any group they emptied.
 *  A leaf that does not exist, or that some contract still references
 *  (axis-expanded), is a NAMED refusal. */
export function applyAuthoredPrune(tree: Tree, row: AuthoredRow, referenced: Set<string>): string[] {
  if (!row.prune) return [];
  for (const leaf of row.prune) {
    if (referenced.has(leaf)) {
      throw new Error(`authored prune ${leaf}: a promoted contract still references this leaf — prune refused; unset the binding in the same row first`);
    }
    const segs = leaf.split(".");
    const chain: Array<[Tree, string]> = [];
    let node: Tree = tree;
    for (const s of segs.slice(0, -1)) {
      const next = node[s];
      if (!isTree(next)) throw new Error(`authored prune ${leaf}: not in the minted tree (no group "${s}") — the capture no longer mints it; the authored row is stale, delete it`);
      chain.push([node, s]);
      node = next;
    }
    const last = segs[segs.length - 1];
    if (!isLeaf(node[last])) throw new Error(`authored prune ${leaf}: not a leaf of the minted tree — the capture no longer mints it; the authored row is stale, delete it`);
    delete node[last];
    for (let i = chain.length - 1; i >= 0; i--) {
      const [parent, key] = chain[i];
      if (Object.keys(parent[key] as Tree).length === 0) delete parent[key];
      else break;
    }
  }
  return [`prune ${row.prune.join(", ")}`];
}

/** PURE: every `{imported.*}` ref a contract makes, with its enum axis
 *  placeholders expanded over that contract's prop values. */
export function expandedImportedRefs(contract: Record<string, unknown>): Array<{ ref: string; from: string }> {
  const enums: Record<string, string[]> = {};
  for (const pr of (contract.props ?? []) as Array<{ name: string; type?: { enum?: string[] } }>) {
    if (pr.type?.enum) enums[pr.name] = pr.type.enum;
  }
  const out: Array<{ ref: string; from: string }> = [];
  for (const m of JSON.stringify(contract).matchAll(/"\{(imported\.[^"]+)\}"/g)) {
    let refs = [m[1]];
    for (const [prop, vals] of Object.entries(enums)) {
      if (!m[1].includes(`{${prop}}`)) continue;
      refs = refs.flatMap((r) => vals.map((v) => r.replaceAll(`{${prop}}`, v)));
    }
    for (const r of refs) out.push({ ref: r, from: m[1] });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Shell — the promotion run
// ---------------------------------------------------------------------------

export interface PromoteResult {
  promoted: string[];
  promotedAssets: string[];
  aliased: number;
  literalKept: number;
  receipts: string[];
  statePreviewsOn: string[];
  stateRefusals: string[];
  /** One receipt per authored-facts row applied (empty without a ledger). */
  authoredReceipts: string[];
}

export interface PromotionCommitOptions {
  /** Deterministic fault-injection seam for rollback falsification. Called
   * after an existing destination has moved to its backup and immediately
   * before the staged replacement is installed. */
  beforeInstall?: (index: number, destination: string) => void;
  /** Deterministic fault-injection seam for recovery-path tests. Called
   * immediately before an original backup is restored. */
  beforeRestore?: (index: number, destination: string, backup: string) => void;
}

interface CommitRecord {
  destination: string;
  temporary: string;
  backup: string;
  commitIndex: number;
  originalMoved: boolean;
  replacementInstalled: boolean;
}

function commitPlannedWrites(
  plannedWrites: Map<string, string>,
  options: PromotionCommitOptions,
): void {
  const records: CommitRecord[] = [];
  let index = 0;
  try {
    for (const [destination, body] of plannedWrites) {
      mkdirSync(path.dirname(destination), { recursive: true });
      const suffix = `.promotion-${process.pid}-${index}`;
      const record: CommitRecord = {
        destination,
        temporary: `${destination}${suffix}.tmp`,
        backup: `${destination}${suffix}.bak`,
        commitIndex: index,
        originalMoved: false,
        replacementInstalled: false,
      };
      writeFileSync(record.temporary, body);
      records.push(record);
      index++;
    }

    for (const [commitIndex, record] of records.entries()) {
      if (existsSync(record.destination)) {
        renameSync(record.destination, record.backup);
        record.originalMoved = true;
      }
      options.beforeInstall?.(commitIndex, record.destination);
      renameSync(record.temporary, record.destination);
      record.replacementInstalled = true;
    }
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    for (const record of [...records].reverse()) {
      try {
        if (record.replacementInstalled && existsSync(record.destination)) {
          unlinkSync(record.destination);
        }
        if (record.originalMoved && existsSync(record.backup)) {
          options.beforeRestore?.(
            record.commitIndex,
            record.destination,
            record.backup,
          );
          renameSync(record.backup, record.destination);
        }
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length > 0) {
      // An incomplete rollback is a recovery event, not a cleanup event.
      // Preserve every surviving staged file and backup: deleting any of
      // them could destroy the only remaining copy of an original artifact.
      const recoveryPaths = records.flatMap((record) =>
        [record.backup, record.temporary].filter((artifact) =>
          existsSync(artifact),
        ),
      );
      throw new AggregateError(
        [error, ...rollbackErrors],
        "promotion commit failed and rollback was incomplete; manual recovery artifacts preserved at:\n" +
          recoveryPaths.map((artifact) => `  ${artifact}`).join("\n"),
      );
    }
    for (const record of records) {
      if (existsSync(record.temporary)) unlinkSync(record.temporary);
      if (existsSync(record.backup)) unlinkSync(record.backup);
    }
    throw error;
  }

  // The destination set is fully committed. Backups are no longer part of
  // rollback state; remove them after every replacement has landed.
  for (const record of records) {
    if (existsSync(record.backup)) unlinkSync(record.backup);
  }
}

/** The full promotion, against a repo root. Writes contracts, extension
 *  sidecars, anchors, the minted tree and MINTED.md; THROWS on an unresolvable
 *  ref (the resolution guard) or a minted collision. */
export function promote(
  repoRoot: string,
  cfg: PromoteConfig,
  log: (line: string) => void = console.log,
  commitOptions: PromotionCommitOptions = {},
): PromoteResult {
  const EX = path.resolve(repoRoot, cfg.exampleDir);
  const OUT = path.resolve(repoRoot, cfg.captureOut);
  const stemOf = (n: string): string => cfg.contractStem?.[n] ?? n;

  // task #26: the DTCG base is flattened by WALKING, not read as a flat
  // top-level map. The four original libraries ship flat files (top-level key
  // IS the token name — walking reproduces those keys byte-identically), but
  // polaris nests every leaf under a `p` wrapper group, and the flat read made
  // `tokenValue("p.font-weight-medium")` undefined — which silently zeroed the
  // ENTIRE alias pass (covering-set empty is a pre-receipt break, so 5,201
  // captured source facts produced "0 source-aliased" with no refusal line).
  const dtcgPath = path.resolve(repoRoot, cfg.dtcg);
  if (!existsSync(dtcgPath)) {
    // Named refusal, not a bare ENOENT: onboard names this file in
    // ds-library.json and (since 2026-08-03) writes a skeleton — but example
    // shims and hand-edited manifests reach promote directly.
    throw new Error(
      `promote REFUSED: the base DTCG token file the manifest names does not exist (${cfg.dtcg}, resolved ${dtcgPath}). Author it — leaf names must equal the CSS custom property minus the "--" prefix (flat, not nested; nested trees verify 0 facts) — or re-run onboard, which writes a skeleton to start from.`,
    );
  }
  const dtcgTree = JSON.parse(readFileSync(dtcgPath, "utf8")) as Tree;
  const dtcgFlat = new Map<string, unknown>();
  (function walkDtcg(n: Tree, p: string[]): void {
    for (const [k, v] of Object.entries(n)) {
      if (k.startsWith("$") || k.startsWith("__")) continue;
      if (isLeaf(v)) dtcgFlat.set([...p, k].join("."), v.$value);
      else if (isTree(v)) walkDtcg(v, [...p, k]);
    }
  })(dtcgTree, []);
  const tokenValue = (name: string): unknown => dtcgFlat.get(name);

  // Icon map — the referee needs it to validate `icon.asset` refs, and floor-
  // reconstructed assets promoted below are added to it as they land.
  const ICON_DIR = path.join(EX, "assets", "icons");
  const icons = new Map<string, string>(
    existsSync(ICON_DIR)
      ? readdirSync(ICON_DIR)
          .filter((f) => f.endsWith(".svg"))
          .sort()
          .map(
            (f) =>
              [
                f.replace(/\.svg$/, ""),
                readFileSync(path.join(ICON_DIR, f), "utf8").trim(),
              ] as [string, string],
          )
      : [],
  );
  const plannedAssets = new Map<string, string>();
  const promotedAssets: string[] = [];
  for (const name of cfg.components) {
    const floorAssets = path.join(OUT, name, "assets");
    if (!existsSync(floorAssets)) continue;
    for (const file of readdirSync(floorAssets).sort()) {
      if (!file.endsWith(".svg")) continue;
      const body = readFileSync(path.join(floorAssets, file), "utf8");
      plannedAssets.set(file, body);
      icons.set(file.replace(/\.svg$/, ""), body.trim());
      promotedAssets.push(file);
    }
  }

  // AUTHORED FACTS (the reviewed hand-authoring door, above): loaded and
  // refereed before any contract is read, so a malformed ledger refuses the
  // whole promotion rather than half of it.
  const authoredRows: AuthoredRow[] = [];
  if (cfg.authored) {
    const ledgerPath = path.resolve(repoRoot, cfg.authored);
    if (!existsSync(ledgerPath)) {
      throw new Error(
        `promote REFUSED: the authored-facts ledger the manifest names does not exist (${cfg.authored}, resolved ${ledgerPath})`,
      );
    }
    authoredRows.push(
      ...parseAuthoredLedger(JSON.parse(readFileSync(ledgerPath, "utf8")), cfg.authored),
    );
    for (const row of authoredRows) {
      if (!cfg.components.includes(row.component)) {
        throw new Error(
          `${cfg.authored}: row names component "${row.component}", which is not in this manifest's components — NAMED refusal`,
        );
      }
    }
  }
  const authoredDone = new Map<AuthoredRow, string[]>();
  const noteAuthored = (row: AuthoredRow, done: string[]): void => {
    if (done.length === 0) return;
    authoredDone.set(row, [...(authoredDone.get(row) ?? []), ...done]);
  };

  const stateRefusals: string[] = [];
  const statePreviewsOn: string[] = [];
  /** The Polaris probe: opt into `bindings.figma.statePreviews` wherever the REFEREE
   *  accepts it, so the canvas draws a State cell per declared interaction
   *  state instead of pretending the component has only a default plane. The
   *  referee — not this module — decides: a state with no token overrides
   *  would render identically to Default, and that refusal is PRINTED, never
   *  worked around. A refused contract ships unpreviewed (its declared states
   *  still drive the code surface and declaredStates). */
  const statePreviewProbe = (contract: Record<string, unknown>): void => {
    const states = (contract.states ?? []) as string[];
    // An EXPLICIT `bindings.figma.statePreviews` in the source artifact —
    // true or false — is a reviewed decision and passes through untouched.
    // The probe only fills the ABSENT case; without the `in` check an
    // explicit reviewed `false` (altitude chip, exact-conversion wave) was
    // silently flipped back to true on every re-promotion.
    type Bindings = { figma: Record<string, unknown>; code: Record<string, unknown> };
    const own = contract.bindings as Bindings;
    if (states.length === 0 || "statePreviews" in own.figma) return;
    const probe = structuredClone(contract) as Record<string, unknown>;
    // Spelled BEFORE anchors — the schema's (and the codemod's) key order.
    (probe.bindings as Bindings).figma = { statePreviews: true, ...own.figma };
    const probeErrors: string[] = [];
    validateContract(
      probe as never,
      new Map([[probe.id as string, probe as never]]),
      probeErrors,
      icons,
    );
    if (probeErrors.length === 0) {
      own.figma = { statePreviews: true, ...own.figma };
      statePreviewsOn.push(`${contract.id} (${states.join(", ")})`);
      log(`  · ${contract.id}: bindings.figma.statePreviews ON (${states.join(", ")})`);
    } else {
      stateRefusals.push(`${contract.id}: ${probeErrors[0]}`);
      log(
        `  · ${contract.id}: bindings.figma.statePreviews REFUSED by the referee (named): ${probeErrors[0]}`,
      );
    }
  };

  // ---- promotion ----
  const promoted: string[] = [];
  const prepared = new Map<
    string,
    {
      contract: Record<string, unknown>;
      extension: unknown;
    }
  >();
  // Plan and provenance-referee the whole set before copying an asset or
  // writing a contract. Existing unprovenanced floor artifacts retain their
  // legacy behavior; once provenance exists, the stale-source guard applies.
  for (const name of cfg.components) {
    const dir = path.join(OUT, name);
    const resolvedPath = path.join(dir, "resolved.contract.json");
    const enrichedPath = path.join(dir, "enriched.contract.json");
    const src = existsSync(resolvedPath) ? resolvedPath : enrichedPath;
    if (!existsSync(src))
      throw new Error(`${name}: no computed artifact (${src})`);
    const sourceContract = JSON.parse(readFileSync(src, "utf8")) as Record<
      string,
      unknown
    >;
    let contract = structuredClone(sourceContract) as ProvenancedContract;
    const extension = JSON.parse(
      readFileSync(path.join(dir, "enriched.extension.json"), "utf8"),
    ) as unknown;
    contract.version = cfg.contractVersion;
    contract.description =
      `${contract.description} FLOOR-PROMOTED (${cfg.promoterPath}): ` +
      `${path.basename(src)} — computed-capture truth; minted leaves source-aliased to ${cfg.possessive} ` +
      `own CSS-variable references where verified (source-bindings.json); extension sidecar ` +
      `carries the named overflow.`;
    // Authored set/unset rows land BEFORE the state-preview probe so the
    // referee judges the contract that will actually be written.
    for (const row of authoredRows) {
      if (row.component === name) noteAuthored(row, applyAuthoredContractRow(contract, row));
    }
    statePreviewProbe(contract);
    const destination = path.join(
      EX,
      "contracts",
      `${stemOf(name)}.contract.json`,
    );
    if (existsSync(destination)) {
      const canonical = JSON.parse(
        readFileSync(destination, "utf8"),
      ) as ProvenancedContract;
      assertContractProvenance(canonical, String(canonical.id ?? name));
      if (canonical.provenance) {
        contract = promoteStaticArtifact(canonical, contract, {
          adapter: "computed-capture",
          revision: revisionOf(sourceContract),
        });
      }
    }
    assertContractProvenance(contract, String(contract.id ?? name));
    prepared.set(name, { contract, extension });
    promoted.push(name);
  }

  // ---- minted merge + source-alias pass ----
  const mintedMerged: Tree = {};
  let aliased = 0;
  let literalKept = 0;
  const aliasReceipts: string[] = [];
  const anchorsByComponent = new Map<string, Anchor[]>();
  for (const name of cfg.mintSources ?? cfg.components) {
    const extPath = path.join(OUT, name, "enriched.extension.json");
    if (!existsSync(extPath)) continue;
    const extension = JSON.parse(readFileSync(extPath, "utf8")) as {
      mintedTokens?: Tree;
    };
    const minted = extension.mintedTokens ?? {};
    const sbPath = path.join(OUT, name, "source-bindings.json");
    const facts: SourceFact[] = existsSync(sbPath)
      ? ((JSON.parse(readFileSync(sbPath, "utf8")) as { facts?: SourceFact[] })
          .facts ?? [])
      : [];
    if (facts.length > 0 && minted.imported) {
      const out: AliasOutcome = {
        aliased: 0,
        literalKept: 0,
        receipts: [],
        anchors: [],
        joined: new Set(),
      };
      aliasPass(minted.imported as Tree, ["imported"], facts, tokenValue, out);
      aliased += out.aliased;
      literalKept += out.literalKept;
      aliasReceipts.push(...out.receipts);
      if (out.anchors.length > 0) anchorsByComponent.set(name, out.anchors);
      // UNJOINED-FACT RECEIPT (class-stem prefix round). A verified source fact
      // that reaches NO minted leaf is a silent alias loss — exactly how the
      // part-name/mint-path spelling mismatch cost four aliases without a word.
      // Naming it here means the next spelling divergence is loud.
      if (cfg.unjoinedFactReceipts) {
        for (const key of new Set(
          facts.map((f) => `${mintSegment(f.part)}|${f.channel}`),
        )) {
          if (!out.joined.has(key)) {
            aliasReceipts.push(
              `fact NOT JOINED ${name}: (part "${key.split("|")[0]}", channel "${key.split("|")[1]}") verified at capture but reached no minted leaf — either the leaf's value disagrees with the token (a plane split) or the part spelling diverged from the minted path`,
            );
          }
        }
      }
    }
    mergeInto(mintedMerged, minted);
  }

  // ---- authored mint + prune (after the capture's merge, before the guard) ----
  const authoredReceipts: string[] = [];
  if (authoredRows.length > 0) {
    const referenced = new Set<string>();
    for (const name of cfg.components) {
      for (const { ref } of expandedImportedRefs(prepared.get(name)!.contract)) referenced.add(ref);
    }
    for (const row of authoredRows) noteAuthored(row, applyAuthoredMint(mintedMerged, row));
    for (const row of authoredRows) noteAuthored(row, applyAuthoredPrune(mintedMerged, row, referenced));
    for (const row of authoredRows) {
      authoredReceipts.push(
        `${row.component}${row.part ? `.${row.part}` : row.prop ? ` prop ${row.prop}` : ""}${row.path ? ` @${row.path}` : ""}: ${(authoredDone.get(row) ?? []).join("; ")} — ${row.cause}`,
      );
    }
    log(
      `✔ authored facts: ${authoredRows.length} reviewed row(s) applied from ${cfg.authored} (each names its cause; a row the capture has since learned to carry refuses by name)`,
    );
    for (const r of authoredReceipts) log(`  · ${r}`);
  }

  // ---- resolution guard ----
  {
    const contracts = cfg.components.map((name) => ({
      name,
      contract: prepared.get(name)!.contract,
    }));
    const { dangling, badAliases } = resolutionGuard(
      mintedMerged,
      contracts,
      tokenValue,
    );
    if (dangling.length > 0 || badAliases.length > 0) {
      const lines = [
        "✘ promotion REFUSED — unresolvable refs:",
        ...dangling.slice(0, 20).map((d) => "  dangling: " + d),
        ...badAliases.slice(0, 20).map((b) => "  bad alias: " + b),
      ];
      throw new Error(lines.join("\n"));
    }
    log(
      "✔ resolution guard: every contract {imported.*} ref (axis-expanded) resolves; every alias resolves in the DTCG base",
    );
  }

  // Every destination byte is planned only after the full logical referee
  // succeeds. Temporary siblings are then written before any destination is
  // replaced, preventing a late dangling ref/alias refusal (or a temp-write
  // failure) from changing committed artifacts.
  const plannedWrites = new Map<string, string>();
  const planWrite = (destination: string, body: string): void => {
    if (plannedWrites.has(destination)) {
      throw new Error(
        `promotion REFUSED — two planned artifacts target ${destination}`,
      );
    }
    plannedWrites.set(destination, body);
  };
  for (const name of cfg.components) {
    const { contract, extension } = prepared.get(name)!;
    planWrite(
      path.join(EX, "contracts", `${stemOf(name)}.contract.json`),
      JSON.stringify(contract, null, 2) + "\n",
    );
    planWrite(
      path.join(EX, "contracts", `${stemOf(name)}.extension.json`),
      JSON.stringify(extension, null, 2) + "\n",
    );
  }
  for (const [file, body] of plannedAssets) {
    planWrite(path.join(ICON_DIR, file), body);
  }
  for (const [name, anchors] of [...anchorsByComponent].sort()) {
    planWrite(
      path.join(EX, "contracts", `${name}.anchors.json`),
      JSON.stringify(
        {
          _marker:
            "PROVENANCE ANCHORS — write-back through-lines for source-aliased leaves. Sidecar, never contract vocabulary. selector = the CSSOM rule declaring the channel (render-level anchor for Emotion-runtime libraries; static readers will carry file:line anchors).",
          component: name,
          anchors: anchors.sort((a, b) => a.leaf.localeCompare(b.leaf)),
        },
        null,
        2,
      ) + "\n",
    );
  }
  planWrite(
    path.resolve(repoRoot, cfg.mintedOut),
    JSON.stringify(mintedMerged, null, 2) + "\n",
  );
  planWrite(
    path.resolve(repoRoot, cfg.mintedDoc),
    `# ${cfg.mintedDocTitle} — promotion receipt\n\nGenerated by \`${cfg.promoterPath}\`.\n\n` +
      `- **${aliased} leaves source-aliased** to ${cfg.possessive} own CSS-variable-named tokens (value-verified twice: capture + promotion)\n` +
      `- **${literalKept} leaves kept literal** (no verified source reference)\n` +
      `- **${aliasReceipts.length} named alias refusals**${aliasReceipts.length ? ":" : ""}\n` +
      aliasReceipts.map((r) => `  - ${r}`).join("\n") +
      "\n" +
      (cfg.authored
        ? `- **${authoredReceipts.length} authored fact(s) applied** from \`${cfg.authored}\` — reviewed hand-authoring the capture cannot carry; every row names its cause, and a row the capture has since learned to carry REFUSES the promotion by name${authoredReceipts.length ? ":" : ""}\n` +
          authoredReceipts.map((r) => `  - ${r}`).join("\n") +
          "\n"
        : ""),
  );

  commitPlannedWrites(plannedWrites, commitOptions);
  log(
    `✔ floor-promoted ${promoted.length} contract(s) → ${cfg.exampleDir}/contracts (v${cfg.contractVersion}): ${promoted.join(", ")}`,
  );
  if (promotedAssets.length > 0)
    log(
      `✔ ${promotedAssets.length} floor-reconstructed icon asset(s) → ${cfg.exampleDir}/assets/icons/: ${promotedAssets.join(", ")}`,
    );
  log(
    `✔ minted tree → ${cfg.mintedOut} (${aliased} source-aliased, ${literalKept} literal, ${aliasReceipts.length} named refusals)`,
  );
  log(
    `✔ bindings.figma.statePreviews: ${statePreviewsOn.length} accepted by the referee` +
      (statePreviewsOn.length ? ` (${statePreviewsOn.join("; ")})` : "") +
      `, ${stateRefusals.length} REFUSED BY NAME` +
      (stateRefusals.length
        ? `:\n${stateRefusals.map((r) => `    - ${r}`).join("\n")}`
        : ""),
  );

  return {
    promoted,
    promotedAssets,
    aliased,
    literalKept,
    receipts: aliasReceipts,
    statePreviewsOn,
    stateRefusals,
    authoredReceipts,
  };
}

/** Shell entry used by the example shims and the `promote` verb. */
export function promoteFromConfigFile(
  configPath: string,
  repoRoot?: string,
): PromoteResult {
  const abs = path.resolve(configPath);
  if (!existsSync(abs))
    throw new Error(`promote config not found: ${configPath}`);
  const cfg = parsePromoteConfig(
    JSON.parse(readFileSync(abs, "utf8")),
    configPath,
  );
  // Config paths are repo-relative; the repo root defaults to the directory
  // two levels above the example dir the config names.
  const root =
    repoRoot ??
    path.resolve(
      path.dirname(abs),
      ...cfg.exampleDir.split("/").map(() => ".."),
    );
  return promote(root, cfg);
}
