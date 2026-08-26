/**
 * IS THE MINTED SET USABLE — the third column.
 *
 * THE BAR (owner, 2026-08-25, choosing between "usable" and "looks right"):
 * *"a screenshot-perfect set of frozen rectangles is useless to a DS team."*
 * The census measures RECOGNISABILITY (does the canvas look like the
 * component) and ROUND-TRIP (does the set propose back to its contract).
 * Both can be green on a set a designer cannot actually work with. This
 * module is the third claim: does the set BEHAVE like a Figma component.
 *
 * FOUR ASSERTIONS, every one measured through the Plugin API, none eyeballed:
 *
 *   1. REFLOW          the variant COMPONENT is resized +40×+40 and every
 *                      child's box is re-measured. At least one child must
 *                      move or resize consistently with the declared
 *                      `layoutMode`. Children that do not move are a pile of
 *                      frozen rectangles and the set fails, naming them. The
 *                      probe restores the exact original size AND sizing
 *                      modes, and hashes the whole page before and after so
 *                      "the canvas is byte-identical" is a measured fact.
 *   2. VARIANT AXES    the set must expose `variantGroupProperties`, must be
 *                      instantiable, must carry every axis the contract
 *                      declares, and every value of every axis must render
 *                      DIFFERENTLY (geometry, fills or text). Two values with
 *                      the same fingerprint are a dead axis value and are
 *                      named `DEAD-AXIS-VALUE:<axis>=<a>≡<b>`.
 *   3. TOKEN BINDING   every fill, stroke, spacing, sizing and corner-radius
 *                      channel that actually CARRIES a value must be bound to
 *                      a variable (`boundVariables`) or inferred
 *                      (`inferredVariables`). Literals are named. The
 *                      bound-vs-literal ratio is reported per set. Variables
 *                      are read through the Plugin API — the Variables REST
 *                      API needs the Enterprise-only `file_variables:read`
 *                      scope, which this project does not have.
 *   4. NO FAKE LAYOUT  no child may use `layoutPositioning: 'ABSOLUTE'`, and
 *                      no container of two or more children may sit in
 *                      `layoutMode: 'NONE'`, UNLESS the source CSS was itself
 *                      out of flow. That is adjudicated against the CONTRACT,
 *                      not guessed: the node's part is resolved in
 *                      `anatomy` and its `position` is read from `declared` /
 *                      `literals` / `tokens`. A genuine `position:absolute`
 *                      passes; an absolutely-positioned rectangle faking a
 *                      flex row fails. A node whose part cannot be resolved
 *                      is `UNRESOLVED-PART` — never a silent pass.
 *
 * WHY THE GATE IS A READER. docs/31 §6: the figma-console bridge speaks MCP
 * over stdio to its own client and WebSocket to plugin clients, and a Node
 * process is neither. So the measurement is taken by an agent running
 * `extract/figma/census/usable-probe.plugin.js` through `figma_execute`, and
 * committed as `parity/receipts/v1/usable/<library>/<id>.json`. This module
 * turns those observations into verdicts. A row with no observation is
 * `PENDING` — and at `--phase full` PENDING is a REFUSAL BY NAME, never a
 * blank cell and never a silent pass. Likewise an observation taken against
 * any file but the scratch project is refused by name.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { REPO, type CensusManifest, type ManifestRow } from "./corpus.js";

export const USABLE_DIR = "parity/receipts/v1/usable";
export const USABLE_RECEIPT_PATH = "parity/receipts/v1/CANVAS-USABLE.md";
/** The ONLY writable Figma file. An observation from anywhere else is void. */
export const SCRATCH_FILE_KEY = "byMp6lt0Ij9b2QbkDGFwBh";
export const PROBE_VERSION = 1;

// ---------------------------------------------------------------------------
// The observation (written by the probe; this module never writes one)
// ---------------------------------------------------------------------------

export interface ChildBox {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
}

export interface ReflowObservation {
  target: string | null;
  targetName?: string;
  layoutMode?: string;
  childCount?: number;
  sizing?: Record<string, string | null>;
  before?: { w: number; h: number; children: ChildBox[] };
  resizedBy?: { dw: number; dh: number };
  resizeError?: string | null;
  after?: { w: number; h: number; children: ChildBox[] };
  responded?: {
    name: string;
    dx: number;
    dy: number;
    dw: number;
    dh: number;
  }[];
  frozen?: string[];
  restoreError?: string | null;
  restoredTo?: { w: number; h: number };
  restoredExact?: boolean;
  error?: string;
}

export interface Fingerprint {
  geometry: string;
  fills: string;
  text: string;
}

export interface AxisObservation {
  axis: string;
  values: (Fingerprint & { value: string })[];
  errors: { value: string; error: string }[];
}

export interface VariantsObservation {
  attempted: boolean;
  instantiable?: boolean;
  instanceId?: string;
  instanceRemoved?: boolean;
  baseline?: Fingerprint;
  axes?: AxisObservation[];
  error?: string;
  cleanupError?: string;
}

export interface BindingObservation {
  total: number;
  bound: number;
  inferred: number;
  literal: number;
  byGroup: Record<string, { bound: number; inferred: number; literal: number }>;
  literalSites: string[];
  literalSitesTruncated: number;
}

export interface LayoutFact {
  path: string;
  name: string;
  type: string;
  layoutPositioning: string | null;
  layoutMode: string | null;
  childCount: number;
  w: number;
  h: number;
  visible: boolean;
  parentLayoutMode: string | null;
  parentType: string | null;
}

export interface UsableObservation {
  probeVersion: number;
  fileKey: string;
  page: string;
  setNodeId: string;
  setName: string;
  setType: string;
  variantNodeId: string | null;
  variantNodeName: string | null;
  axes: { axis: string; values: string[] }[] | null;
  axesError: string | null;
  variantChildCount: number;
  variantChildNames: string[];
  reflow: ReflowObservation;
  variants: VariantsObservation;
  binding: BindingObservation;
  layoutFacts: LayoutFact[];
  /** Batch-level restoration proof, copied onto every row by usable-record. */
  canvasBefore?: { nodes: number; sig: string };
  canvasAfter?: { nodes: number; sig: string };
  canvasRestored?: boolean;
}

// ---------------------------------------------------------------------------
// The contract side of assertion 4
// ---------------------------------------------------------------------------

interface AnatomyPart {
  declared?: Record<string, string>;
  literals?: Record<string, string>;
  tokens?: Record<string, string>;
  layout?: Record<string, unknown>;
  shape?: Record<string, unknown>;
  parts?: Record<string, AnatomyPart>;
}

/** partName → merged CSS, flattened over the whole nested anatomy. */
export function flattenAnatomy(
  contract: Record<string, unknown>,
): Map<string, Record<string, string>> {
  const out = new Map<string, Record<string, string>>();
  const anatomy = contract.anatomy as
    | { root?: AnatomyPart & { parts?: Record<string, AnatomyPart> } }
    | undefined;
  const visit = (name: string, part: AnatomyPart) => {
    const css: Record<string, string> = {
      ...(part.declared ?? {}),
      ...(part.literals ?? {}),
      ...(part.tokens ?? {}),
    };
    const layout = part.layout as Record<string, string> | undefined;
    if (layout?.display) css.display = layout.display;
    // A name can appear twice in a deep anatomy; first writer wins, and the
    // duplicate is recorded so the gate can say so rather than guess.
    if (!out.has(name)) out.set(name, css);
    for (const [k, v] of Object.entries(part.parts ?? {})) visit(k, v);
  };
  if (anatomy?.root) visit("root", anatomy.root);
  return out;
}

const OUT_OF_FLOW = new Set(["absolute", "fixed"]);

/** Did the SOURCE put this part out of flow? null = the part is unknown. */
export function sourceOutOfFlow(
  css: Record<string, string> | undefined,
): boolean | null {
  if (!css) return null;
  const pos = css.position;
  if (typeof pos !== "string") return false;
  return OUT_OF_FLOW.has(pos.trim().toLowerCase());
}

/** A layoutFact path ends in `/name[i]`; the bare part name is what matters. */
export function partNameOf(fact: LayoutFact): string {
  return fact.name;
}

// ---------------------------------------------------------------------------
// The four verdicts
// ---------------------------------------------------------------------------

export type Verdict = "pass" | "fail" | "n/a" | "PENDING";

export interface AssertionResult {
  verdict: Verdict;
  /** One line for the receipt cell. */
  summary: string;
  /** Named failures — every one becomes a gate refusal. */
  reds: string[];
}

export interface RowUsable {
  row: ManifestRow;
  observation: UsableObservation | null;
  reflow: AssertionResult;
  variants: AssertionResult;
  binding: AssertionResult;
  fakeLayout: AssertionResult;
  bindingRatio: string;
  restored: string;
  failures: string[];
}

const PENDING = (why: string): AssertionResult => ({
  verdict: "PENDING",
  summary: why,
  reds: [],
});

/** 1 — REFLOW. */
export function judgeReflow(o: UsableObservation): AssertionResult {
  const r = o.reflow;
  const reds: string[] = [];
  const who = o.variantNodeName ?? o.setName;
  if (r.error) {
    reds.push(`REFLOW-UNMEASURED:${who} — ${r.error}`);
    return { verdict: "fail", summary: `unmeasured (${r.error})`, reds };
  }
  if (r.resizeError) {
    reds.push(`REFLOW-RESIZE-REFUSED:${who} — ${r.resizeError}`);
    return {
      verdict: "fail",
      summary: `resize refused (${r.resizeError})`,
      reds,
    };
  }
  const childCount = r.childCount ?? 0;
  const mode = r.layoutMode ?? "NONE";
  if (mode === "NONE" && childCount >= 2) {
    reds.push(
      `NO-AUTOLAYOUT:${who} — layoutMode NONE with ${childCount} children; the set is a pile of frozen rectangles`,
    );
    return {
      verdict: "fail",
      summary: `NO AUTO-LAYOUT (${childCount} children)`,
      reds,
    };
  }
  if (r.restoreError || r.restoredExact === false) {
    reds.push(
      `REFLOW-NOT-RESTORED:${who} — ${r.restoreError ?? `restored to ${r.restoredTo?.w}×${r.restoredTo?.h}, wanted ${r.before?.w}×${r.before?.h}`}`,
    );
  }
  if (childCount === 0) {
    return {
      verdict: "n/a",
      summary: `${mode}, no children to re-lay`,
      reds,
    };
  }
  const responded = r.responded ?? [];
  const frozen = r.frozen ?? [];
  if (responded.length === 0) {
    reds.push(
      `FROZEN-CHILDREN:${who} — 0/${childCount} children moved or resized when the container grew 40×40 (${frozen.join(", ")})`,
    );
    return {
      verdict: "fail",
      summary: `FROZEN 0/${childCount} (${frozen.join(", ")})`,
      reds,
    };
  }
  // Consistency with the declared layoutMode: a child may only move or grow
  // along an axis the container actually grew. (Both axes grew by 40 here, so
  // a delta larger than the growth is inconsistent and is named.)
  const grew = (r.resizedBy?.dw ?? 0) + 1;
  for (const c of responded) {
    if (
      Math.abs(c.dx) > grew ||
      Math.abs(c.dy) > grew ||
      Math.abs(c.dw) > grew ||
      Math.abs(c.dh) > grew
    ) {
      reds.push(
        `REFLOW-INCONSISTENT:${who}/${c.name} — moved (${c.dx},${c.dy}) resized (${c.dw},${c.dh}) for a +${r.resizedBy?.dw}×+${r.resizedBy?.dh} container growth`,
      );
    }
  }
  const detail = responded
    .map(
      (c) =>
        `${c.name}${c.dx || c.dy ? ` +${c.dx},${c.dy}` : ""}${c.dw || c.dh ? ` ⤢${c.dw},${c.dh}` : ""}`,
    )
    .join("; ");
  const summary =
    frozen.length > 0
      ? `${responded.length}/${childCount} re-laid (${detail}); frozen: ${frozen.join(", ")}`
      : `${responded.length}/${childCount} re-laid (${detail})`;
  if (frozen.length > 0) {
    reds.push(
      `FROZEN-CHILDREN:${who} — ${frozen.length}/${childCount} did not move or resize (${frozen.join(", ")})`,
    );
    return { verdict: "fail", summary, reds };
  }
  return { verdict: reds.length > 0 ? "fail" : "pass", summary, reds };
}

/** 2 — VARIANT SWITCHING. */
export function judgeVariants(
  o: UsableObservation,
  row: ManifestRow,
): AssertionResult {
  const reds: string[] = [];
  const who = o.setName;
  if (o.axesError) {
    reds.push(
      `SET-ERRORS:${who} — variantGroupProperties refused: ${o.axesError}; the set carries ${o.variantChildCount} children whose variant property sets disagree (${o.variantChildNames.slice(0, 3).join(" / ")}…), so no axis can be switched at all`,
    );
    return {
      verdict: "fail",
      summary: `SET HAS ERRORS — no axes readable`,
      reds,
    };
  }
  const v = o.variants;
  if (v.error || v.instantiable !== true) {
    reds.push(
      `NOT-INSTANTIABLE:${who} — ${v.error ?? "createInstance produced nothing"}`,
    );
    return { verdict: "fail", summary: `NOT INSTANTIABLE`, reds };
  }
  if (v.instanceRemoved !== true) {
    reds.push(
      `PROBE-LEFT-INSTANCE:${who} — the throwaway instance ${v.instanceId} was not removed`,
    );
  }
  const canvasAxes = new Map((o.axes ?? []).map((a) => [a.axis, a.values]));
  // Every axis the contract declares must exist on the canvas.
  const named: string[] = [];
  for (const declared of row.axes ?? []) {
    if (!canvasAxes.has(declared.figmaProperty)) {
      if ((declared.values ?? []).length <= 1) {
        // Figma cannot express a one-value axis as a variant property. Named,
        // not silently dropped, and not counted as a defect.
        named.push(
          `SINGLE-VALUE-AXIS-NOT-MINTED:${declared.figmaProperty}=${(declared.values ?? []).join("|")}`,
        );
      } else {
        reds.push(
          `AXIS-NOT-MINTED:${who}/${declared.figmaProperty} — the contract declares ${declared.values.length} values (${declared.values.join(", ")}) and the canvas set carries no such axis`,
        );
      }
    }
  }
  const axisSummaries: string[] = [];
  for (const a of v.axes ?? []) {
    for (const e of a.errors)
      reds.push(`AXIS-SWITCH-REFUSED:${who}/${a.axis}=${e.value} — ${e.error}`);
    const seen = new Map<string, string>();
    const dead: string[] = [];
    for (const val of a.values) {
      const key = `${val.geometry}|${val.fills}|${val.text}`;
      const prior = seen.get(key);
      if (prior !== undefined) dead.push(`${prior}≡${val.value}`);
      else seen.set(key, val.value);
    }
    if (dead.length > 0) {
      const allDead = seen.size === 1 && a.values.length > 1;
      reds.push(
        `${allDead ? "DEAD-AXIS" : "DEAD-AXIS-VALUE"}:${who}/${a.axis}=${dead.join(", ")} — the instance renders identically (geometry, fills and text all equal)`,
      );
      axisSummaries.push(
        `${a.axis} ${seen.size}/${a.values.length} distinct — DEAD ${dead.join(", ")}`,
      );
    } else {
      axisSummaries.push(
        `${a.axis} ${a.values.length}/${a.values.length} distinct`,
      );
    }
  }
  if ((v.axes ?? []).length === 0 && reds.length === 0) {
    return {
      verdict: named.length > 0 ? "n/a" : "n/a",
      summary: `no axes on canvas${named.length > 0 ? ` — ${named.join("; ")}` : " (single-variant component)"}`,
      reds,
    };
  }
  const summary =
    axisSummaries.join("; ") +
    (named.length > 0 ? `; ${named.join("; ")}` : "");
  return { verdict: reds.length > 0 ? "fail" : "pass", summary, reds };
}

/** 3 — TOKEN BINDING. */
export function judgeBinding(o: UsableObservation): AssertionResult {
  const b = o.binding;
  const reds: string[] = [];
  const who = o.variantNodeName ?? o.setName;
  if (b.total === 0)
    return { verdict: "n/a", summary: "no carrying channels", reds };
  const held = b.bound + b.inferred;
  if (held === 0) {
    reds.push(
      `ALL-LITERAL:${who} — ${b.literal}/${b.total} carrying channels are literals, not one is bound to a variable`,
    );
    return {
      verdict: "fail",
      summary: `0/${b.total} bound — ALL LITERAL`,
      reds,
    };
  }
  if (b.literal > 0) {
    reds.push(
      `LITERAL-CHANNELS:${who} — ${b.literal}/${b.total} carrying channels are literals: ${b.literalSites.join(", ")}${b.literalSitesTruncated > 0 ? ` (+${b.literalSitesTruncated} more)` : ""}`,
    );
    return {
      verdict: "fail",
      summary: `${held}/${b.total} bound — ${b.literal} literal`,
      reds,
    };
  }
  return {
    verdict: "pass",
    summary: `${held}/${b.total} bound (${b.bound} bound, ${b.inferred} inferred)`,
    reds,
  };
}

/** 4 — NO FAKE LAYOUT. */
export function judgeFakeLayout(
  o: UsableObservation,
  contract: Record<string, unknown> | null,
): AssertionResult {
  const reds: string[] = [];
  const who = o.variantNodeName ?? o.setName;
  if (!contract) {
    reds.push(
      `CONTRACT-UNREADABLE:${who} — assertion 4 cannot tell a genuine position:absolute from a faked layout without the contract`,
    );
    return { verdict: "fail", summary: "contract unreadable", reds };
  }
  const css = flattenAnatomy(contract);
  const absolute = o.layoutFacts.filter(
    (f) => f.layoutPositioning === "ABSOLUTE",
  );
  const stacks = o.layoutFacts.filter(
    (f) =>
      f.layoutMode === "NONE" &&
      f.childCount >= 2 &&
      f.path !== `/${o.variantNodeName}`,
  );
  const legit: string[] = [];
  for (const f of absolute) {
    const src = sourceOutOfFlow(css.get(partNameOf(f)));
    if (src === true) legit.push(`${f.path} (source position:absolute)`);
    else if (src === null)
      reds.push(
        `UNRESOLVED-PART:${who}${f.path} — layoutPositioning ABSOLUTE and no part named \`${f.name}\` in the contract anatomy, so the gate cannot prove the source was out of flow`,
      );
    else
      reds.push(
        `FAKE-ABSOLUTE:${who}${f.path} — layoutPositioning ABSOLUTE but the source part \`${f.name}\` is in flow`,
      );
  }
  for (const f of stacks) {
    const src = sourceOutOfFlow(css.get(partNameOf(f)));
    const kidsOutOfFlow = o.layoutFacts
      .filter((k) => k.path.startsWith(`${f.path}/`))
      .filter((k) => k.path.split("/").length === f.path.split("/").length + 1);
    const allKidsAbsolute =
      kidsOutOfFlow.length > 0 &&
      kidsOutOfFlow.every(
        (k) => sourceOutOfFlow(css.get(partNameOf(k))) === true,
      );
    if (src === true || allKidsAbsolute)
      legit.push(`${f.path} (${f.childCount} out-of-flow children)`);
    else if (src === null)
      reds.push(
        `UNRESOLVED-PART:${who}${f.path} — layoutMode NONE over ${f.childCount} children and no part named \`${f.name}\` in the contract anatomy`,
      );
    else
      reds.push(
        `FAKE-STACK:${who}${f.path} — layoutMode NONE over ${f.childCount} children whose source is in flow; the row is faked with coordinates`,
      );
  }
  const summary =
    reds.length > 0
      ? `${reds.length} offender(s)`
      : legit.length > 0
        ? `${legit.length} genuine out-of-flow: ${legit.join(", ")}`
        : "every node in flow";
  return { verdict: reds.length > 0 ? "fail" : "pass", summary, reds };
}

// ---------------------------------------------------------------------------
// A row
// ---------------------------------------------------------------------------

export function packetPath(row: ManifestRow, usableDir: string): string {
  return path.join(usableDir, row.library, `${row.id}.json`);
}

export function judgeRow(row: ManifestRow, usableDir: string): RowUsable {
  const p = packetPath(row, usableDir);
  const base: RowUsable = {
    row,
    observation: null,
    reflow: PENDING("PENDING"),
    variants: PENDING("PENDING"),
    binding: PENDING("PENDING"),
    fakeLayout: PENDING("PENDING"),
    bindingRatio: "—",
    restored: "—",
    failures: [],
  };
  if (!existsSync(p)) return base;

  let o: UsableObservation;
  try {
    o = JSON.parse(readFileSync(p, "utf8")) as UsableObservation;
  } catch (e) {
    base.failures.push(
      `${row.library}/${row.id}: usable observation ${path.relative(REPO, p)} is not readable JSON — ${String(e)}`,
    );
    return base;
  }
  base.observation = o;
  const who = `${row.library}/${row.id}`;

  // The observation must have been taken against the scratch file, at this
  // probe version. Anything else is refused BY NAME, never quietly used.
  if (o.fileKey !== SCRATCH_FILE_KEY) {
    base.failures.push(
      `${who}: usable observation was taken against file ${o.fileKey}, not the scratch project ${SCRATCH_FILE_KEY} — void`,
    );
    return base;
  }
  if (o.probeVersion !== PROBE_VERSION) {
    base.failures.push(
      `${who}: usable observation carries probeVersion ${o.probeVersion}, the gate reads ${PROBE_VERSION} — re-probe`,
    );
    return base;
  }
  if (o.canvasRestored !== true) {
    base.failures.push(
      `${who}: the probe did NOT leave the canvas byte-identical (before ${o.canvasBefore?.nodes} nodes / ${o.canvasBefore?.sig}, after ${o.canvasAfter?.nodes} / ${o.canvasAfter?.sig})`,
    );
  }
  base.restored =
    o.canvasRestored === true ? `yes (${o.canvasBefore?.sig})` : "NO";

  const contractPath = path.join(REPO, row.contractPath);
  let contract: Record<string, unknown> | null = null;
  try {
    contract = JSON.parse(readFileSync(contractPath, "utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    contract = null;
  }

  base.reflow = judgeReflow(o);
  base.variants = judgeVariants(o, row);
  base.binding = judgeBinding(o);
  base.fakeLayout = judgeFakeLayout(o, contract);
  const held = o.binding.bound + o.binding.inferred;
  base.bindingRatio =
    o.binding.total === 0
      ? "n/a"
      : `${held}/${o.binding.total} (${Math.round((held / o.binding.total) * 100)}%)`;
  for (const a of [base.reflow, base.variants, base.binding, base.fakeLayout])
    for (const r of a.reds) base.failures.push(`${who}: ${r}`);
  return base;
}

// ---------------------------------------------------------------------------
// The receipt
// ---------------------------------------------------------------------------

const esc = (s: string) => s.replace(/\|/g, "\\|");

const cell = (a: AssertionResult): string =>
  a.verdict === "pass"
    ? `pass — ${a.summary}`
    : a.verdict === "PENDING"
      ? "PENDING"
      : a.verdict === "n/a"
        ? `n/a — ${a.summary}`
        : `**FAIL** — ${a.summary}`;

export function renderUsableReceipt(
  manifest: CensusManifest,
  rows: RowUsable[],
  phase: string,
  failures: string[],
): string {
  const lines: string[] = [];
  const measured = rows.filter((r) => r.observation !== null);
  lines.push(
    "# Is the minted set usable — reflow, variant switching, token binding, no faked layout",
  );
  lines.push("");
  lines.push(
    "GENERATED by `npm run canvas:usable:check` (scripts/canvas-usable-check.ts) — do not edit. Byte-stable: rows in manifest order, no dates.",
  );
  lines.push("");
  lines.push(
    `**Phase: \`${phase}\`.** ${phase === "probed" ? "Rows with no committed observation read PENDING; every row that HAS one is fully held." : "Every row must carry an observation; PENDING is a refusal."}`,
  );
  lines.push("");
  lines.push("## The bar");
  lines.push("");
  lines.push(
    'Owner, 2026-08-25, asked whether a minted Figma set must be *usable* as a design-system component or merely *look right*, and chose usable: *"a screenshot-perfect set of frozen rectangles is useless to a DS team."* ' +
      "The census already measures recognisability (does the canvas look like the component) and round-trip (does the set propose back to its contract). Both can be green on a set a designer cannot work with. " +
      "This is the third column, and nothing in this repo had ever tested it.",
  );
  lines.push("");
  lines.push("## The four assertions");
  lines.push("");
  lines.push("| # | assertion | how it is measured | what fails |");
  lines.push("|---|---|---|---|");
  lines.push(
    "| 1 | **reflow** | the variant `COMPONENT` is resized +40×+40 through the Plugin API and every child's box is re-measured | 0 children move or resize (`FROZEN-CHILDREN`); `layoutMode: NONE` over ≥2 children (`NO-AUTOLAYOUT`); a delta larger than the growth (`REFLOW-INCONSISTENT`); the original size not restored (`REFLOW-NOT-RESTORED`) |",
  );
  lines.push(
    "| 2 | **variant switching** | one instance is created off-canvas and driven across every value of every axis in `variantGroupProperties`; each render is fingerprinted on geometry, fills and text separately | the set cannot report its axes (`SET-ERRORS`); it cannot be instantiated (`NOT-INSTANTIABLE`); a contract axis was never minted (`AXIS-NOT-MINTED`); two values render identically (`DEAD-AXIS-VALUE`, or `DEAD-AXIS` when every value collapses) |",
  );
  lines.push(
    "| 3 | **token binding** | every fill, stroke, spacing, sizing and corner-radius channel that actually carries a value is classified from `boundVariables` / `inferredVariables` — Plugin API, because `file_variables:read` is Enterprise-gated and unavailable here | any literal (`LITERAL-CHANNELS`, sites named); nothing bound at all (`ALL-LITERAL`) |",
  );
  lines.push(
    "| 4 | **no fake layout** | every `layoutPositioning: ABSOLUTE` node and every `layoutMode: NONE` container of ≥2 children is cross-examined against the CONTRACT's `anatomy` (`declared`/`literals`/`tokens` `position`) | out of flow on the canvas, in flow in the source (`FAKE-ABSOLUTE`, `FAKE-STACK`); no part of that name in the anatomy, so legitimacy cannot be proven (`UNRESOLVED-PART`). A genuine `position:absolute` PASSES |",
  );
  lines.push("");
  lines.push(
    "## How the measurement is taken, and why the gate cannot take it",
  );
  lines.push("");
  lines.push(
    "docs/31 §6: the figma-console bridge speaks MCP over stdio to its own client and WebSocket to plugin clients, and a Node process is neither — so this gate can never drive the canvas itself. " +
      "An agent holding the MCP tools runs `extract/figma/census/usable-probe.plugin.js` through `figma_execute` against the scratch project `byMp6lt0Ij9b2QbkDGFwBh` (the only writable file; the probe refuses to run anywhere else), " +
      "and commits each returned observation as `parity/receipts/v1/usable/<library>/<id>.json` via `npx tsx extract/figma/census/usable-record.ts`. The gate is a pure READER of those observations. " +
      "A row with no observation is `PENDING` and at `--phase full` that is a refusal by name; an observation from any other file, or at the wrong probe version, is void and refused by name. The gate never passes for want of a bridge.",
  );
  lines.push("");
  lines.push(
    "**The canvas is left byte-identical.** The probe makes exactly two writes and unmakes both: one resize (restored to the original width, height and sizing modes) and one throwaway instance (removed). " +
      "It hashes every node on the page — id, name, type, x, y, width, height, layoutMode, itemSpacing, characters — before and after the whole batch, and the `restored` column carries that proof.",
  );
  lines.push("");
  lines.push("## Tally");
  lines.push("");
  const tally = (pick: (r: RowUsable) => AssertionResult, v: Verdict) =>
    measured.filter((r) => pick(r).verdict === v).length;
  lines.push("| assertion | pass | FAIL | n/a | measured | pending |");
  lines.push("|---|---|---|---|---|---|");
  for (const [name, pick] of [
    ["reflow", (r: RowUsable) => r.reflow],
    ["variant switching", (r: RowUsable) => r.variants],
    ["token binding", (r: RowUsable) => r.binding],
    ["no fake layout", (r: RowUsable) => r.fakeLayout],
  ] as [string, (r: RowUsable) => AssertionResult][]) {
    lines.push(
      `| ${name} | ${tally(pick, "pass")} | ${tally(pick, "fail")} | ${tally(pick, "n/a")} | ${measured.length} | ${rows.length - measured.length} |`,
    );
  }
  lines.push("");
  const clean = measured.filter(
    (r) =>
      r.failures.length === 0 &&
      [r.reflow, r.variants, r.binding, r.fakeLayout].every(
        (a) => a.verdict !== "fail",
      ),
  );
  lines.push(
    `**${clean.length}/${measured.length} measured sets are usable on all four assertions** (${rows.length - measured.length} of ${rows.length} census rows not yet probed).`,
  );
  lines.push("");
  lines.push(
    `Gate: **${failures.length === 0 ? "GREEN" : `RED — ${failures.length} failure(s)`}** at phase \`${phase}\`.`,
  );
  if (failures.length > 0) {
    lines.push("");
    for (const f of failures) lines.push(`- ${esc(f)}`);
  }
  lines.push("");
  lines.push("## Rows");
  lines.push("");
  lines.push(
    "| library | id | set | reflow | variant switching | token binding | bound ratio | no fake layout | canvas restored |",
  );
  lines.push("|---|---|---|---|---|---|---|---|---|");
  for (const r of rows) {
    lines.push(
      `| ${r.row.library} | \`${r.row.id}\` | ${r.observation ? esc(r.observation.setName) : "—"} | ${esc(cell(r.reflow))} | ${esc(cell(r.variants))} | ${esc(cell(r.binding))} | ${r.bindingRatio} | ${esc(cell(r.fakeLayout))} | ${r.restored} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

/** The compact third-column cell the canvas census renders. */
export function censusCell(r: RowUsable): string {
  if (!r.observation) return "PENDING";
  const g = (a: AssertionResult) =>
    a.verdict === "pass" ? "✓" : a.verdict === "n/a" ? "·" : "✘";
  return `R${g(r.reflow)} V${g(r.variants)} B${g(r.binding)} ${r.bindingRatio} L${g(r.fakeLayout)}`;
}
