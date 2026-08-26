/**
 * THE HARD CORPUS GATE — `npm run hard-corpus:check`
 *
 * A HARD CASE is a component this repo AUTHORS in order to be converted, aimed
 * at ONE mechanism a closed table already names, with its expected outcome
 * written down BEFORE the conversion runs.
 *
 * WHY IT EXISTS. Nine libraries x Button/Badge/Card/Checkbox is mostly
 * redundant: every root cause we chase was found on a handful of sets, and the
 * library route pays a tax — sandbox installs, version pins, mixed browsers,
 * hand-edited capture artifacts, captures that are not re-derivable from their
 * own inputs — that has nothing to do with the product. A corpus we AUTHOR is
 * reproducible by construction, which kills the not-re-derivable class outright.
 *
 * WHAT MAKES IT NON-ARBITRARY. The corpus is a FUNCTION of the closed tables,
 * never a list somebody felt like writing:
 *
 *   spec/channel-table.json              487 properties, CARRIED/LEDGERED/REFUSED/INERT
 *   spec/grammar-coverage.json           44 supported constructs, 10 unsupported
 *   packages/core/src/required-facts.ts  61 required facts across 20 archetypes
 *   docs/23-known-limitations.md         the named FC-* walls
 *   spec/hard-corpus.json rootCauses     the eight RC classes from the burn-down triage
 *
 * This gate RE-DERIVES each denominator from its own file and refuses when the
 * committed manifest disagrees, so a mechanism cannot leave the matrix
 * silently — the same discipline scripts/canvas-census-check.ts applies to the
 * census manifest.
 *
 * THE DISCIPLINE THAT MATTERS MOST — DECLARE FIRST. A case whose result is
 * written after the fact is worthless; that is precisely how a self-graded
 * 168/170 happens. So:
 *
 *   1. every case must declare `expect` (CARRIED | LEDGERED | REFUSED) and,
 *      for anything but CARRIED, the NAME the engine must produce;
 *   2. a result may not exist for a case the manifest does not declare;
 *   3. the commit that first declared a case must be a STRICT ANCESTOR of the
 *      commit that first recorded its result. Same commit = refused.
 *
 * Rule 3 is measured against git, not asserted. In a worktree where the
 * results file is not yet committed the rule still bites: the DECLARATION must
 * already be committed, so an uncommitted result can only ever land later.
 *
 *   npx tsx scripts/hard-corpus-check.ts
 *   npx tsx scripts/hard-corpus-check.ts --write       regenerate spec/HARD-CORPUS.md + pinned counts
 *   npx tsx scripts/hard-corpus-check.ts --record      record results from the measured baselines
 *   npx tsx scripts/hard-corpus-check.ts --self-test   the red cases
 *
 * WHAT THIS GATE MUST NOT DO: decide an outcome. It checks that an outcome was
 * DECLARED, that the declaration came first, and that the matrix still names
 * every mechanism the tables name. Measuring is conformance's job.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export const MANIFEST = path.join(REPO, "spec/hard-corpus.json");
export const RESULTS = path.join(REPO, "spec/hard-corpus-results.json");
export const DOC = path.join(REPO, "spec/HARD-CORPUS.md");
const CHANNEL_TABLE = path.join(REPO, "spec/channel-table.json");
const GRAMMAR = path.join(REPO, "spec/grammar-coverage.json");
const REQUIRED_FACTS = path.join(REPO, "packages/core/src/required-facts.ts");
const LIMITATIONS = path.join(REPO, "docs/23-known-limitations.md");
const CONFORMANCE_MANIFEST = path.join(REPO, "conformance/MANIFEST.json");
const CONFORMANCE_BASELINE = path.join(REPO, "conformance/BASELINE.json");
const CANVAS_BASELINE = path.join(REPO, "conformance/CANVAS-BASELINE.json");

/** The closed vocabulary. The channel table's own four classes minus INERT —
 *  an INERT row has provably no independent visual effect, so there is nothing
 *  for a case to expect. */
export const EXPECTATIONS = ["CARRIED", "LEDGERED", "REFUSED"] as const;
export type Expectation = (typeof EXPECTATIONS)[number];

export const DIRECTIONS = ["codeToCanvas", "canvasToCode", "both"] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** The five places a mechanism may come from. A case that names a mechanism
 *  from nowhere is a case somebody invented. */
export const MECHANISM_SOURCES = [
  "channel-table",
  "grammar-coverage",
  "required-facts",
  "root-cause",
  "wall",
] as const;
export type MechanismSource = (typeof MECHANISM_SOURCES)[number];

export interface HardCase {
  id: string;
  mechanism: { source: MechanismSource; ref: string };
  home: string;
  direction: Direction;
  expect: Expectation;
  expectName: string;
  why: string;
}

export interface RootCause {
  id: string;
  title: string;
  engine: string;
}

export interface HardCorpus {
  _marker: string;
  version: number;
  sources: Record<string, Record<string, number | string>>;
  rootCauses: RootCause[];
  walls: string[];
  cases: HardCase[];
  notCovered: Array<{ mechanism: string; why: string }>;
}

export interface Finding {
  ok: boolean;
  label: string;
}

const readJson = <T>(p: string): T | null =>
  existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : null;

// ---------------------------------------------------------------------------
// The denominators, RE-DERIVED
// ---------------------------------------------------------------------------

export interface Denominators {
  channelTable: {
    CARRIED: number;
    LEDGERED: number;
    REFUSED: number;
    INERT: number;
    properties: Map<string, string>;
  };
  grammar: { supported: number; unsupported: number; unsupportedIds: string[] };
  requiredFacts: { archetypes: number; required: number; ids: string[] };
  walls: string[];
  conformanceCases: Array<{
    id: string;
    channel: string;
    expect: string;
    dumpSnippet?: string | null;
  }>;
}

/** Fact ids are read from the SOURCE text, not from the built module: the gate
 *  must refuse when the table changes even in a tree whose dist/ is stale. */
export function readRequiredFacts(src: string): {
  archetypes: number;
  required: number;
  ids: string[];
} {
  const archetypes = new Set<string>();
  const ids: string[] = [];
  let inTable = false;
  let bucket: "required" | "expected" | null = null;
  for (const line of src.split("\n")) {
    if (line.startsWith("export const ARCHETYPE_REQUIRED_FACTS")) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    if (/^};\s*$/.test(line)) break;
    const arch = /^ {2}('[^']+'|[a-zA-Z]+): \{\s*$/.exec(line);
    if (arch) {
      archetypes.add(arch[1]);
      bucket = null;
      continue;
    }
    const b = /^ {4}(required|expected): \[\s*$/.exec(line);
    if (b) {
      bucket = b[1] as "required" | "expected";
      continue;
    }
    const id = /^ {8}id: '([^']+)',\s*$/.exec(line);
    if (id && bucket === "required") ids.push(id[1]);
  }
  return { archetypes: archetypes.size, required: ids.length, ids };
}

export function deriveDenominators(): Denominators {
  const ct = JSON.parse(readFileSync(CHANNEL_TABLE, "utf8")) as {
    properties: Array<{ property: string; class: string }>;
    totals: Record<string, number>;
  };
  const properties = new Map<string, string>();
  for (const p of ct.properties) properties.set(p.property, p.class);

  const gc = JSON.parse(readFileSync(GRAMMAR, "utf8")) as {
    totals: Record<string, number>;
    constructs: Array<{ id: string; status: string }>;
  };
  const unsupportedIds = gc.constructs
    .filter((c) => c.status !== "supported")
    .map((c) => c.id)
    .sort();

  const rf = readRequiredFacts(readFileSync(REQUIRED_FACTS, "utf8"));

  // A wall is an FC-* code named in docs/23. `FC-RT-` is a PREFIX the doc uses
  // for a family of round-trip codes and is not a code itself.
  const walls = [
    ...new Set(readFileSync(LIMITATIONS, "utf8").match(/FC-[A-Z0-9-]+/g) ?? []),
  ]
    .filter((w) => !w.endsWith("-"))
    .sort();

  const cm = readJson<{
    cases: Array<{
      id: string;
      expect: string;
      observable: { channel: string };
      dumpSnippet?: string | null;
    }>;
  }>(CONFORMANCE_MANIFEST);
  const conformanceCases = (cm?.cases ?? []).map((c) => ({
    id: c.id,
    channel: c.observable.channel,
    expect: c.expect,
    dumpSnippet: c.dumpSnippet,
  }));

  return {
    channelTable: {
      CARRIED: ct.totals.CARRIED,
      LEDGERED: ct.totals.LEDGERED,
      REFUSED: ct.totals.REFUSED,
      INERT: ct.totals.INERT,
      properties,
    },
    grammar: {
      supported: gc.totals.supported,
      unsupported: gc.totals.unsupported,
      unsupportedIds,
    },
    requiredFacts: rf,
    walls,
    conformanceCases,
  };
}

// ---------------------------------------------------------------------------
// The coverage matrix
// ---------------------------------------------------------------------------

export interface CoverageRow {
  source: string;
  denominator: number;
  covered: number;
  codeToCanvas: number;
  canvasToCode: number;
  both: number;
}

export interface Matrix {
  rows: CoverageRow[];
  /** Mechanisms with no case at all, by source — the half that makes the
   *  matrix honest. Truncated in the doc, complete here. */
  uncovered: Record<string, string[]>;
}

export function buildMatrix(m: HardCorpus, d: Denominators): Matrix {
  const byRef = new Map<string, HardCase[]>();
  for (const c of m.cases) {
    const key = `${c.mechanism.source}:${c.mechanism.ref}`;
    if (!byRef.has(key)) byRef.set(key, []);
    byRef.get(key)!.push(c);
  }

  /** A channel-table property is COVERED when some authored case observes it:
   *  a conformance case (code to canvas; `both` when it also ships a canvas
   *  dump snippet) or a hard-corpus case naming the property. */
  const channelDir = new Map<string, Set<Direction>>();
  for (const c of d.conformanceCases) {
    if (!d.channelTable.properties.has(c.channel)) continue;
    const set = channelDir.get(c.channel) ?? new Set<Direction>();
    set.add(c.dumpSnippet ? "both" : "codeToCanvas");
    channelDir.set(c.channel, set);
  }
  for (const c of m.cases) {
    if (c.mechanism.source !== "channel-table") continue;
    const set = channelDir.get(c.mechanism.ref) ?? new Set<Direction>();
    set.add(c.direction);
    channelDir.set(c.mechanism.ref, set);
  }

  const rows: CoverageRow[] = [];
  const uncovered: Record<string, string[]> = {};

  for (const cls of ["CARRIED", "LEDGERED", "REFUSED"] as const) {
    const props = [...d.channelTable.properties.entries()]
      .filter(([, k]) => k === cls)
      .map(([p]) => p);
    const covered = props.filter((p) => channelDir.has(p));
    rows.push({
      source: `channel-table ${cls}`,
      denominator: props.length,
      covered: covered.length,
      codeToCanvas: covered.filter((p) =>
        channelDir.get(p)!.has("codeToCanvas"),
      ).length,
      canvasToCode: covered.filter((p) =>
        channelDir.get(p)!.has("canvasToCode"),
      ).length,
      both: covered.filter((p) => channelDir.get(p)!.has("both")).length,
    });
    uncovered[`channel-table ${cls}`] = props
      .filter((p) => !channelDir.has(p))
      .sort();
  }

  const named: Array<[string, string, string[]]> = [
    [
      "grammar-coverage unsupported",
      "grammar-coverage",
      d.grammar.unsupportedIds,
    ],
    ["required-facts required", "required-facts", d.requiredFacts.ids],
    ["root causes", "root-cause", m.rootCauses.map((r) => r.id)],
    ["named walls (FC-*)", "wall", d.walls],
  ];
  for (const [label, source, refs] of named) {
    const hit = (ref: string): HardCase[] =>
      byRef.get(`${source}:${ref}`) ?? [];
    const covered = refs.filter((r) => hit(r).length > 0);
    rows.push({
      source: label,
      denominator: refs.length,
      covered: covered.length,
      codeToCanvas: covered.filter((r) =>
        hit(r).some((c) => c.direction === "codeToCanvas"),
      ).length,
      canvasToCode: covered.filter((r) =>
        hit(r).some((c) => c.direction === "canvasToCode"),
      ).length,
      both: covered.filter((r) => hit(r).some((c) => c.direction === "both"))
        .length,
    });
    uncovered[label] = refs.filter((r) => hit(r).length === 0).sort();
  }

  return { rows, uncovered };
}

// ---------------------------------------------------------------------------
// DECLARE FIRST — measured against git
// ---------------------------------------------------------------------------

const git = (args: string[]): string | null => {
  try {
    return execFileSync("git", args, {
      cwd: REPO,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
};

/** The oldest commit touching `file` whose blob contains `needle`, walking
 *  oldest-first. `null` when the file is untracked or the needle never
 *  appeared in a committed revision. */
export function firstCommitContaining(
  file: string,
  needle: string,
): string | null {
  const rel = path.relative(REPO, file);
  const log = git(["log", "--reverse", "--format=%H", "--", rel]);
  if (!log) return null;
  for (const sha of log.split("\n").filter(Boolean)) {
    const blob = git(["show", `${sha}:${rel}`]);
    if (blob && blob.includes(needle)) return sha;
  }
  return null;
}

const isAncestor = (a: string, b: string): boolean => {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", a, b], {
      cwd: REPO,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
};

export interface DeclareFirstInput {
  caseIds: string[];
  resultIds: string[];
  declaredAt: (id: string) => string | null;
  measuredAt: (id: string) => string | null;
  ancestor: (a: string, b: string) => boolean;
}

/** PURE, so the self-test can drive it with fabricated histories. */
export function declareFirstFindings(i: DeclareFirstInput): Finding[] {
  const out: Finding[] = [];
  const declared = new Set(i.caseIds);
  for (const id of i.resultIds) {
    if (!declared.has(id)) {
      out.push({
        ok: false,
        label: `result "${id}" has NO declared expectation in spec/hard-corpus.json — a result without a declaration is a self-grade`,
      });
      continue;
    }
    const d = i.declaredAt(id);
    const mAt = i.measuredAt(id);
    if (!d) {
      out.push({
        ok: false,
        label: `case "${id}" carries a result but its DECLARATION was never committed — declare the expectation in its own commit first`,
      });
      continue;
    }
    if (!mAt) {
      out.push({
        ok: true,
        label: `${id}: declared ${d.slice(0, 8)}, result not yet committed (it can only land later)`,
      });
      continue;
    }
    if (d === mAt) {
      out.push({
        ok: false,
        label: `case "${id}": the manifest and the result moved in the SAME commit ${d.slice(0, 8)} — an expectation written beside its own outcome is not a prediction`,
      });
      continue;
    }
    if (!i.ancestor(d, mAt)) {
      out.push({
        ok: false,
        label: `case "${id}": the declaration ${d.slice(0, 8)} is not an ancestor of the result ${mAt.slice(0, 8)} — the expectation did not come first`,
      });
      continue;
    }
    out.push({
      ok: true,
      label: `${id}: declared ${d.slice(0, 8)}, measured ${mAt.slice(0, 8)}`,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

export function shapeFindings(m: HardCorpus, d: Denominators): Finding[] {
  const f: Finding[] = [];
  const push = (ok: boolean, label: string): void => {
    f.push({ ok, label });
  };

  const ids = m.cases.map((c) => c.id);
  push(ids.join(" ") === [...ids].sort().join(" "), "cases are sorted by id");
  push(new Set(ids).size === ids.length, "case ids are unique");

  for (const c of m.cases) {
    push(
      /^hard-[a-z0-9-]+$/.test(c.id),
      `${c.id}: id is lowercase-kebab and hard- prefixed`,
    );
    push(
      (EXPECTATIONS as readonly string[]).includes(c.expect),
      `${c.id}: expect "${c.expect}" is inside the closed vocabulary (${EXPECTATIONS.join(" | ")})`,
    );
    push(
      (DIRECTIONS as readonly string[]).includes(c.direction),
      `${c.id}: direction "${c.direction}" is inside the closed vocabulary`,
    );
    push(
      c.expect === "CARRIED" ||
        (typeof c.expectName === "string" && c.expectName.trim().length > 0),
      `${c.id}: expect ${c.expect} names what the engine must produce (expectName is empty only for CARRIED — the carriage IS the receipt)`,
    );
    push(
      (MECHANISM_SOURCES as readonly string[]).includes(c.mechanism.source),
      `${c.id}: mechanism source "${c.mechanism.source}" is one of ${MECHANISM_SOURCES.join(", ")}`,
    );
    push(c.why.trim().length > 40, `${c.id}: carries a premise (why)`);
    push(
      existsSync(path.join(REPO, c.home)),
      `${c.id}: home "${c.home}" exists on disk`,
    );

    // THE DERIVATION CHECK — a mechanism nothing names is a case somebody invented.
    const ref = c.mechanism.ref;
    const known =
      c.mechanism.source === "channel-table"
        ? d.channelTable.properties.has(ref)
        : c.mechanism.source === "grammar-coverage"
          ? d.grammar.unsupportedIds.includes(ref)
          : c.mechanism.source === "required-facts"
            ? d.requiredFacts.ids.includes(ref)
            : c.mechanism.source === "root-cause"
              ? m.rootCauses.some((r) => r.id === ref)
              : d.walls.includes(ref);
    push(
      known,
      `${c.id}: mechanism ${c.mechanism.source}:${ref} is named by its own source table`,
    );

    // A case whose home is a conformance case must agree with that case's own
    // declaration — two files may not disagree about one expectation.
    const caseJson = path.join(REPO, c.home, "case.json");
    if (existsSync(caseJson)) {
      const cj = JSON.parse(readFileSync(caseJson, "utf8")) as {
        expect: string;
        expectName: string;
      };
      const allowed: Record<Expectation, string[]> = {
        CARRIED: ["CARRIED"],
        LEDGERED: ["CARRIED", "LOWERED"],
        REFUSED: ["REFUSED", "UNSUPPORTED"],
      };
      push(
        (allowed[c.expect] ?? []).includes(cj.expect),
        `${c.id}: hard-corpus expect ${c.expect} agrees with the case's own disposition ${cj.expect}`,
      );
    }
  }

  // The pinned denominators must still be the tables' own numbers.
  const s = m.sources;
  const pin = (group: string, key: string, actual: number): void => {
    push(
      Number(s[group]?.[key]) === actual,
      `sources.${group}.${key} is ${actual} (committed ${String(s[group]?.[key])})`,
    );
  };
  pin("channelTable", "CARRIED", d.channelTable.CARRIED);
  pin("channelTable", "LEDGERED", d.channelTable.LEDGERED);
  pin("channelTable", "REFUSED", d.channelTable.REFUSED);
  pin("channelTable", "INERT", d.channelTable.INERT);
  pin("grammarCoverage", "supported", d.grammar.supported);
  pin("grammarCoverage", "unsupported", d.grammar.unsupported);
  pin("requiredFacts", "archetypes", d.requiredFacts.archetypes);
  pin("requiredFacts", "required", d.requiredFacts.required);
  pin("conformance", "cases", d.conformanceCases.length);

  push(
    m.walls.join(" ") === d.walls.join(" "),
    `walls agree with docs/23-known-limitations.md (${d.walls.length} codes)`,
  );

  // Byte stability: the committed file must be what re-serialising produces.
  if (existsSync(MANIFEST)) {
    const bytes = readFileSync(MANIFEST, "utf8");
    push(
      bytes === JSON.stringify(m, null, 2) + "\n",
      "spec/hard-corpus.json is byte-stable (2-space JSON, trailing newline)",
    );
  }

  return f;
}

// ---------------------------------------------------------------------------
// The generated block in spec/HARD-CORPUS.md
// ---------------------------------------------------------------------------

const BEGIN = "<!-- BEGIN GENERATED: hard-corpus -->";
const END = "<!-- END GENERATED: hard-corpus -->";

export function renderBlock(
  m: HardCorpus,
  d: Denominators,
  matrix: Matrix,
  results: ResultsFile | null,
): string {
  const L: string[] = [BEGIN, ""];
  L.push("## The coverage matrix", "");
  L.push(
    "Every mechanism the closed tables name, and whether an authored hard case aims at it.",
  );
  L.push(
    "Re-derived by `npm run hard-corpus:check`; a source table that moves fails this gate.",
    "",
  );
  L.push(
    "| source | mechanisms | covered | code to canvas | canvas to code | both | NOT covered |",
  );
  L.push("|---|---:|---:|---:|---:|---:|---:|");
  for (const r of matrix.rows) {
    L.push(
      `| ${r.source} | ${r.denominator} | ${r.covered} | ${r.codeToCanvas} | ${r.canvasToCode} | ${r.both} | ${r.denominator - r.covered} |`,
    );
  }
  const tot = matrix.rows.reduce(
    (a, r) => ({ d: a.d + r.denominator, c: a.c + r.covered }),
    { d: 0, c: 0 },
  );
  L.push(
    `| **all** | **${tot.d}** | **${tot.c}** | | | | **${tot.d - tot.c}** |`,
  );
  L.push("");
  L.push(
    `INERT is deliberately outside the denominator: ${d.channelTable.INERT} channel-table rows are classed INERT — provably no independent visual effect at computed level — so there is no outcome for a case to expect.`,
  );
  L.push("");

  L.push("## The authored cases", "");
  L.push(
    "| case | mechanism | direction | declared | name the engine must produce |",
  );
  L.push("|---|---|---|---|---|");
  for (const c of m.cases) {
    L.push(
      `| \`${c.id}\` | ${c.mechanism.source}:\`${c.mechanism.ref}\` | ${c.direction} | **${c.expect}** | ${c.expectName ? `\`${c.expectName}\`` : "the carriage IS the receipt"} |`,
    );
  }
  L.push("");

  L.push("## Expectation vs outcome", "");
  if (!results) {
    L.push(
      "No results recorded yet. `npm run hard-corpus:record` reads the measured baselines; it may not run in the commit that declares a case.",
    );
  } else {
    L.push(`Measured from \`${results.measuredFrom}\`.`, "");
    L.push("| case | declared | measured verdict | agrees |");
    L.push("|---|---|---|---|");
    for (const r of results.results) {
      L.push(
        `| \`${r.id}\` | ${r.expect} | ${r.verdict} | ${r.agrees ? "yes" : "**NO**"} |`,
      );
    }
    const agree = results.results.filter((r) => r.agrees).length;
    L.push("");
    L.push(
      `**${agree} of ${results.results.length}** cases came out the way the closed table said they would.`,
    );
  }
  L.push("");

  L.push("## What this corpus does NOT cover", "");
  for (const [source, list] of Object.entries(matrix.uncovered)) {
    if (list.length === 0) {
      L.push(`- **${source}** — fully covered.`);
      continue;
    }
    const show = list.slice(0, 12);
    L.push(
      `- **${source}** — ${list.length} with no case: ${show.map((x) => `\`${x}\``).join(", ")}${list.length > show.length ? `, and ${list.length - show.length} more` : ""}.`,
    );
  }
  L.push("");
  for (const n of m.notCovered) L.push(`- **${n.mechanism}** — ${n.why}`);
  L.push("", END);
  return L.join("\n");
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export interface ResultsFile {
  _marker: string;
  measuredFrom: string;
  results: Array<{
    id: string;
    expect: Expectation;
    verdict: string;
    agrees: boolean;
  }>;
}

export function recordResults(m: HardCorpus): ResultsFile {
  const base = readJson<{ verdicts: Record<string, string> }>(
    CONFORMANCE_BASELINE,
  );
  const canvas = readJson<{ verdicts?: Record<string, string> }>(
    CANVAS_BASELINE,
  );
  const results = m.cases.map((c) => {
    const verdict =
      base?.verdicts?.[c.id] ?? canvas?.verdicts?.[c.id] ?? "UNRECORDED";
    return { id: c.id, expect: c.expect, verdict, agrees: verdict === "PASS" };
  });
  return {
    _marker:
      "THE MEASURED OUTCOMES of the hard corpus. Recorded from the conformance baselines, NEVER hand-edited, and never in the commit that declares a case — spec/hard-corpus.json is the prediction and this file is the result. `agrees` is true only for PASS: the case came out the way the closed table said it would.",
    measuredFrom:
      "conformance/BASELINE.json + conformance/CANVAS-BASELINE.json (npm run conformance:capture, then npm run conformance -- --write)",
    results,
  };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export function run(): Finding[] {
  const m = JSON.parse(readFileSync(MANIFEST, "utf8")) as HardCorpus;
  const d = deriveDenominators();
  const matrix = buildMatrix(m, d);
  const results = readJson<ResultsFile>(RESULTS);

  const findings = shapeFindings(m, d);

  findings.push(
    ...declareFirstFindings({
      caseIds: m.cases.map((c) => c.id),
      resultIds: (results?.results ?? []).map((r) => r.id),
      declaredAt: (id) => firstCommitContaining(MANIFEST, `"${id}"`),
      measuredAt: (id) => firstCommitContaining(RESULTS, `"${id}"`),
      ancestor: isAncestor,
    }),
  );

  const doc = existsSync(DOC) ? readFileSync(DOC, "utf8") : "";
  const want = renderBlock(m, d, matrix, results);
  const have =
    doc.includes(BEGIN) && doc.includes(END)
      ? doc.slice(doc.indexOf(BEGIN), doc.indexOf(END) + END.length)
      : "";
  findings.push({
    ok: have === want,
    label:
      "spec/HARD-CORPUS.md generated block is current (`--write` regenerates it)",
  });

  return findings;
}

function writeDoc(): void {
  const m = JSON.parse(readFileSync(MANIFEST, "utf8")) as HardCorpus;
  const d = deriveDenominators();
  const matrix = buildMatrix(m, d);
  const results = readJson<ResultsFile>(RESULTS);
  const doc = readFileSync(DOC, "utf8");
  const next =
    doc.slice(0, doc.indexOf(BEGIN)) +
    renderBlock(m, d, matrix, results) +
    doc.slice(doc.indexOf(END) + END.length);
  writeFileSync(DOC, next);
  console.log("spec/HARD-CORPUS.md regenerated.");
}

function selfTest(): void {
  const d = deriveDenominators();
  const base = JSON.parse(readFileSync(MANIFEST, "utf8")) as HardCorpus;
  const reds: Array<[string, () => Finding[]]> = [
    [
      "a case with no declared expectation",
      () =>
        shapeFindings(
          { ...base, cases: [{ ...base.cases[0], expect: "" as Expectation }] },
          d,
        ),
    ],
    [
      "a non-CARRIED case that names nothing",
      () =>
        shapeFindings(
          {
            ...base,
            cases: [{ ...base.cases[0], expect: "REFUSED", expectName: "" }],
          },
          d,
        ),
    ],
    [
      "a mechanism no source table names",
      () =>
        shapeFindings(
          {
            ...base,
            cases: [
              {
                ...base.cases[0],
                mechanism: {
                  source: "channel-table",
                  ref: "not-a-css-property",
                },
              },
            ],
          },
          d,
        ),
    ],
    [
      "a home that is not on disk",
      () =>
        shapeFindings(
          {
            ...base,
            cases: [
              { ...base.cases[0], home: "conformance/cases/never-authored" },
            ],
          },
          d,
        ),
    ],
    [
      "a moved denominator",
      () =>
        shapeFindings(
          {
            ...base,
            sources: {
              ...base.sources,
              channelTable: { ...base.sources.channelTable, REFUSED: 1 },
            },
          },
          d,
        ),
    ],
    [
      "an unsorted case list",
      () => shapeFindings({ ...base, cases: [...base.cases].reverse() }, d),
    ],
    [
      "a result for a case nobody declared",
      () =>
        declareFirstFindings({
          caseIds: ["hard-a"],
          resultIds: ["hard-b"],
          declaredAt: () => "aaaa",
          measuredAt: () => "bbbb",
          ancestor: () => true,
        }),
    ],
    [
      "a manifest edited in the SAME commit as its result",
      () =>
        declareFirstFindings({
          caseIds: ["hard-a"],
          resultIds: ["hard-a"],
          declaredAt: () => "cafe",
          measuredAt: () => "cafe",
          ancestor: () => true,
        }),
    ],
    [
      "a declaration that is not an ancestor of its result",
      () =>
        declareFirstFindings({
          caseIds: ["hard-a"],
          resultIds: ["hard-a"],
          declaredAt: () => "aaaa",
          measuredAt: () => "bbbb",
          ancestor: () => false,
        }),
    ],
    [
      "a result whose declaration was never committed",
      () =>
        declareFirstFindings({
          caseIds: ["hard-a"],
          resultIds: ["hard-a"],
          declaredAt: () => null,
          measuredAt: () => "bbbb",
          ancestor: () => true,
        }),
    ],
  ];
  let bad = 0;
  for (const [label, fn] of reds) {
    let red = false;
    try {
      red = fn().some((x) => !x.ok);
    } catch {
      red = true;
    }
    console.log(`  ${red ? "ok  " : "FAIL"} refuses: ${label}`);
    if (!red) bad++;
  }
  // And the green direction: the committed manifest must pass its own shape check.
  const green = shapeFindings(base, d).filter((x) => !x.ok);
  console.log(
    `  ${green.length === 0 ? "ok  " : "FAIL"} accepts: the committed manifest`,
  );
  if (green.length) {
    for (const g of green) console.log(`      ${g.label}`);
    bad++;
  }
  console.log(
    `\nhard-corpus self-test: ${reds.length + 1 - bad}/${reds.length + 1}`,
  );
  process.exit(bad === 0 ? 0 : 1);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]).includes("hard-corpus-check")
) {
  if (process.argv.includes("--self-test")) {
    selfTest();
  } else if (process.argv.includes("--write")) {
    writeDoc();
  } else if (process.argv.includes("--record")) {
    const m = JSON.parse(readFileSync(MANIFEST, "utf8")) as HardCorpus;
    writeFileSync(RESULTS, JSON.stringify(recordResults(m), null, 2) + "\n");
    console.log(
      `spec/hard-corpus-results.json written (${m.cases.length} cases). Commit it SEPARATELY from the manifest.`,
    );
  } else {
    const findings = run();
    const bad = findings.filter((f) => !f.ok);
    for (const f of bad) console.log(`  FAIL ${f.label}`);
    console.log(
      `\nhard corpus: ${findings.length - bad.length}/${findings.length} checks pass`,
    );
    if (bad.length) {
      console.log("HARD CORPUS: RED");
      process.exit(1);
    }
    console.log("hard corpus: green");
  }
}
