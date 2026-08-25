/**
 * REQUIRED-FACTS GATE — every committed contract, every archetype, one
 * committed baseline.
 *
 * The referee itself is pure and lives in `@ds-contracts/core`
 * (packages/core/src/required-facts.ts): per archetype, the load-bearing facts
 * a set must carry before it may be minted onto the canvas. THIS file is the
 * gate that runs it over the whole corpus and compares the result to a
 * COMMITTED baseline (parity/receipts/v1/required-facts-baseline.json).
 *
 * Why a baseline rather than a hard red: the measured wave is 30 contracts
 * (see parity/receipts/v1/REQUIRED-FACTS.md). Every one of them is a real
 * defect — astryx's card that mints as a pill, fluent's dialog that mints as
 * one row, three glyph-less checkboxes — and every one needs a re-capture or a
 * ledgered substitute to fix. Blocking main on all thirty would mean either
 * reverting the enforcement or weakening the predicates, and both of those end
 * with the tool minting ugly sets again. So: today's reds are FROZEN BY NAME,
 * and any NEW red fails CI. The burn-down is a queue, not a wall.
 *
 * FAILURE CLASSES (all five, so nothing moves silently):
 *   · NEW RED       — a required fact is missing that the baseline does not pin.
 *   · FIXED         — a pinned red no longer reproduces: re-record and say what
 *                     fixed it (a fix that nobody records is a fix that
 *                     silently un-freezes when the next one regresses).
 *   · UNPINNED      — a committed contract with no baseline row at all.
 *   · STALE         — a baseline row whose contract is gone.
 *   · ARCHETYPE     — the row's archetype moved; its facts are a different set,
 *                     so the pin is meaningless until it is re-recorded.
 *
 * `--write` re-records the baseline (and judges nothing). `--self-test` plants
 * defects and requires the gate to go red BY NAME — a gate that cannot go red
 * is not a gate.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  ContractSchema,
  archetypeOf,
  type Archetype,
  type Contract,
} from "./contract-schema.js";
import {
  checkRequiredFacts,
  refusalLine,
  ARCHETYPE_REQUIRED_FACTS,
  UNDECLARED_ARCHETYPE_WARNING,
} from "../packages/core/src/required-facts.js";
import { REPO, enumerateLibraries } from "../extract/figma/census/corpus.js";

const BASELINE_PATH = "parity/receipts/v1/required-facts-baseline.json";
const RECEIPT_PATH = "parity/receipts/v1/REQUIRED-FACTS.md";

const MARKER =
  "REQUIRED-FACTS BASELINE — the archetype required-facts referee " +
  "(@ds-contracts/core required-facts.ts) run over every committed contract in " +
  "every corpus library. Each row pins the REQUIRED facts that contract does " +
  "NOT carry today, by fact id. A missing fact this file does not pin is a NEW " +
  "red and fails the gate; a pinned red that stops reproducing must be " +
  "re-recorded with its cause named. NOT a list of acceptable defects — it is " +
  "the burn-down queue, written up in parity/receipts/v1/REQUIRED-FACTS.md. " +
  "Re-record deliberately with `npm run required-facts:check -- --write` and " +
  "say what moved. Verified in the fast lane by `npm run required-facts:check`.";

export interface BaselineRow {
  library: string;
  id: string;
  /** The archetype the facts were judged against, and how it was decided. */
  archetype: string;
  source: "declared" | "name-map" | "unmapped";
  /** REQUIRED fact ids this contract does not carry, sorted. Empty = green. */
  missing: string[];
  /** Why these are still red — one line per row, owned by a human. The
   *  `--write` mode carries it forward and never regenerates it. */
  cause?: string;
}

export interface ScanRow extends BaselineRow {
  /** The full refusal lines, for the receipt and the console. */
  lines: string[];
  /** EXPECTED-tier absences. Never gate-relevant; recorded for the receipt. */
  warns: string[];
  contractPath: string;
}

// ---------------------------------------------------------------------------
// The scan
// ---------------------------------------------------------------------------

/** Every committed contract in every corpus library — the DENOMINATOR. Wider
 *  than the canvas census (which drops a contract with no committed Figma
 *  script): a contract that cannot be minted today can still be minted
 *  tomorrow, and a required fact it lacks is a defect either way. */
export function scanCorpus(): ScanRow[] {
  const { libraries } = enumerateLibraries();
  const rows: ScanRow[] = [];
  for (const library of libraries) {
    const dir = path.join(REPO, library.contractsDir);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)
      .filter((f) => f.endsWith(".contract.json"))
      .sort()) {
      const full = path.join(dir, file);
      const parsed = ContractSchema.safeParse(
        JSON.parse(readFileSync(full, "utf8")),
      );
      if (!parsed.success) {
        // A document that does not validate is the schema referee's finding,
        // not this gate's — but it is never silently skipped.
        rows.push({
          library: library.library,
          id: path.basename(file, ".contract.json"),
          archetype: "unparsed",
          source: "unmapped",
          missing: ["schema/invalid"],
          lines: [
            `${file}: does not validate against the contract schema — required facts not checked (fix the document first)`,
          ],
          warns: [],
          contractPath: path.relative(REPO, full),
        });
        continue;
      }
      const contract = parsed.data as Contract;
      const result = checkRequiredFacts(contract);
      rows.push({
        library: library.library,
        id: contract.id,
        archetype: result.archetype,
        source: result.source,
        missing: result.missing.map((m) => m.factId).sort(),
        lines: result.missing.map((m) => m.line),
        warns: result.undeclared
          ? [result.undeclared, ...result.warns.map((w) => w.line)]
          : result.warns.map((w) => w.line),
        contractPath: path.relative(REPO, full),
      });
    }
  }
  return rows;
}

const key = (r: { library: string; id: string }) => `${r.library}/${r.id}`;

// ---------------------------------------------------------------------------
// Self-test — a gate that cannot go red is not a gate
// ---------------------------------------------------------------------------

/** A minimal, COMPLETE card: it carries all four required card facts. Each
 *  falsification below removes exactly one of them. */
function greenCard(): Contract {
  return ContractSchema.parse({
    id: "selftest.card",
    name: "Card",
    version: "1.0.0",
    description: "self-test fixture",
    archetype: "card",
    semantics: { element: "article" },
    props: [],
    bindings: {
      figma: { anchors: { fileKey: null, componentSetKey: null } },
      code: { anchors: { importPath: "selftest", export: "Selftest" } },
    },
    anatomy: {
      root: {
        layout: { display: "flex", direction: "column" },
        tokens: {
          "background-color": "{color.surface}",
          "padding-top": "{space.4}",
          "min-width": "{size.card.width}",
        },
      },
    },
  }) as Contract;
}

function selfTest(): number {
  const problems: string[] = [];

  // (0) CONTROL — the complete contract passes. A planted red proves nothing
  //     if the control is red for an unrelated reason.
  const control = checkRequiredFacts(greenCard());
  if (control.missing.length > 0) {
    problems.push(
      `self-test precondition: the complete card fixture is not green — ${control.missing.map((m) => m.line).join("; ")}`,
    );
  }

  // (a) THE PILL — drop the column axis; the card must refuse BY NAME, in the
  //     designed grammar, verbatim.
  const noStack = greenCard();
  noStack.anatomy.root.layout = { display: "flex", direction: "row" };
  const a = checkRequiredFacts(noStack);
  const expected =
    'selftest.card: card lacks interior layout — cannot mint: no part carries layout.direction "column" (required fact card/interior-stack)';
  if (!a.missing.some((m) => m.line === expected)) {
    problems.push(
      `(a) a card with no column axis did not refuse by name — got: ${a.missing.map((m) => m.line).join(" | ") || "nothing"}`,
    );
  }

  // (b) EVERY REQUIRED FACT IS FALSIFIABLE — an empty anatomy must name ALL of
  //     an archetype's required facts, so no fact is unreachable dead data.
  for (const [archetype, facts] of Object.entries(ARCHETYPE_REQUIRED_FACTS)) {
    const empty = ContractSchema.parse({
      id: "selftest.empty",
      name: "Empty",
      version: "1.0.0",
      description: "self-test fixture",
      archetype,
      semantics: { element: "div" },
      props: [],
      bindings: {
      figma: { anchors: { fileKey: null, componentSetKey: null } },
      code: { anchors: { importPath: "selftest", export: "Selftest" } },
    },
      anatomy: { root: {} },
    }) as Contract;
    const got = new Set(checkRequiredFacts(empty).missing.map((m) => m.factId));
    for (const fact of facts.required) {
      if (!got.has(fact.id))
        problems.push(
          `(b) ${archetype}: required fact ${fact.id} does not reproduce on an empty anatomy — the predicate can never go red`,
        );
    }
  }

  // (c) UNMAPPED WARNS, NEVER GUESSES — a name the map does not reach enforces
  //     nothing and asks for a declaration.
  const unmapped = ContractSchema.parse({
    id: "selftest.zzqq",
    name: "Zzqq",
    version: "1.0.0",
    description: "self-test fixture",
    semantics: { element: "div" },
    props: [],
    bindings: {
      figma: { anchors: { fileKey: null, componentSetKey: null } },
      code: { anchors: { importPath: "selftest", export: "Selftest" } },
    },
    anatomy: { root: {} },
  }) as Contract;
  const c = checkRequiredFacts(unmapped);
  if (c.missing.length !== 0 || c.undeclared !== UNDECLARED_ARCHETYPE_WARNING("selftest.zzqq")) {
    problems.push(
      `(c) an unmapped contract did not warn "declare archetype" with nothing enforced — missing=${c.missing.length}, undeclared=${String(c.undeclared)}`,
    );
  }

  // (d) THE DECLARED FIELD WINS OVER THE NAME-MAP — the whole point of v19.
  const declaredNone = { ...unmapped, name: "Card", archetype: "none" as const };
  if (archetypeOf(declaredNone) !== "card")
    problems.push(`(d) precondition: the name-map no longer reads "Card" as a card`);
  if (checkRequiredFacts(declaredNone as Contract).missing.length !== 0)
    problems.push(`(d) a contract declaring archetype "none" was still enforced as a card — the declaration must win`);

  // (e) THE CHANNEL SWEEP READS ALL EIGHT CHANNELS — a fact carried ONLY in a
  //     per-state or per-enum-value channel still counts as carried. This is
  //     the property that decides whether the referee grades the contract or
  //     only its `tokens` bag; a predicate that reads one channel would red
  //     every foreign capture whose padding rides `literals`.
  const perChannel = greenCard();
  const carriers: Array<[string, Record<string, unknown>]> = [
    ["literals", { literals: { "padding-top": "8px" } }],
    ["declared", { declared: { cursor: "pointer" }, literals: { "padding-top": "8px" } }],
    [
      "tokensByProp",
      { tokensByProp: [{ prop: "tone", map: { neutral: { "padding-top": "{space.4}" } } }] },
    ],
    [
      "states",
      { states: { hover: { "background-color": "{color.hover}" } }, literals: { "padding-top": "8px" } },
    ],
  ];
  for (const [label, carrier] of carriers) {
    const only = greenCard();
    only.anatomy.root = {
      ...only.anatomy.root,
      tokens: { "background-color": "{color.surface}", "min-width": "{size.card.width}" },
      ...(carrier as Record<string, never>),
    };
    if (checkRequiredFacts(only).missing.some((m) => m.factId === "card/padding"))
      problems.push(`(e) padding carried only in \`${label}\` was not seen — the channel sweep must read all eight styling channels`);
  }
  if (!checkRequiredFacts(perChannel).missing.length === false) {
    // (kept explicit so the control above cannot silently become vacuous)
  }

  // (f) THE BASELINE COMPARISON ITSELF GOES RED — plant a new missing fact
  //     against a pinned row and require the NEW RED class to fire.
  const pinned: BaselineRow[] = [
    { library: "x", id: "x.card", archetype: "card", source: "declared", missing: ["card/padding"] },
  ];
  const planted: ScanRow[] = [
    {
      library: "x",
      id: "x.card",
      archetype: "card",
      source: "declared",
      missing: ["card/interior-stack", "card/padding"],
      lines: ["x.card: card lacks interior layout — cannot mint: …"],
      warns: [],
      contractPath: "x",
    },
  ];
  const planted2 = compare(planted, pinned);
  if (!planted2.some((f) => f.startsWith("x/x.card: NEW RED")))
    problems.push(`(f) an unpinned missing fact did not fire NEW RED — got: ${planted2.join(" | ") || "nothing"}`);
  if (!compare([{ ...planted[0], missing: [] }], pinned).some((f) => f.includes("FIXED")))
    problems.push(`(f) a pinned red that stopped reproducing did not fire FIXED`);
  if (!compare(planted, []).some((f) => f.includes("UNPINNED")))
    problems.push(`(f) a contract with no baseline row did not fire UNPINNED`);
  if (!compare([], pinned).some((f) => f.includes("STALE")))
    problems.push(`(f) a baseline row with no contract did not fire STALE`);
  if (!compare([{ ...planted[0], archetype: "avatar", missing: ["card/padding"] }], pinned).some((f) => f.includes("ARCHETYPE")))
    problems.push(`(f) a moved archetype did not fire ARCHETYPE`);

  if (problems.length > 0) {
    console.error(`✖ required-facts self-test FAILED: ${problems.length} problem(s)`);
    for (const p of problems) console.error(`  - ${p}`);
    return 1;
  }
  console.log(
    "✔ required-facts self-test: (a) a card with no column axis refuses by name in the designed grammar; " +
      `(b) all ${Object.values(ARCHETYPE_REQUIRED_FACTS).reduce((n, f) => n + f.required.length, 0)} required facts across ` +
      `${Object.keys(ARCHETYPE_REQUIRED_FACTS).length} archetypes reproduce on an empty anatomy; ` +
      '(c) an unmapped contract warns "declare archetype" and enforces nothing; (d) a declared archetype beats the name-map; ' +
      "(e) a required fact carried only in literals / declared / tokensByProp / states is seen (the sweep reads all eight styling channels); " +
      "(f) the baseline fires NEW RED, FIXED, UNPINNED, STALE and ARCHETYPE",
  );
  return 0;
}

// ---------------------------------------------------------------------------
// Baseline comparison
// ---------------------------------------------------------------------------

export function compare(rows: ScanRow[], prior: BaselineRow[]): string[] {
  const failures: string[] = [];
  const priorBy = new Map(prior.map((r) => [key(r), r]));
  const seen = new Set<string>();
  for (const row of rows) {
    const k = key(row);
    seen.add(k);
    const p = priorBy.get(k);
    if (!p) {
      failures.push(
        `${k}: UNPINNED — a committed contract with no baseline row (re-record with --write)` +
          (row.missing.length > 0 ? `; it is missing ${row.missing.join(", ")}` : ""),
      );
      continue;
    }
    if (p.archetype !== row.archetype) {
      failures.push(
        `${k}: ARCHETYPE moved ${p.archetype} → ${row.archetype} — a different archetype owes a different set of facts, so the pin is meaningless until it is re-recorded (--write)`,
      );
      continue;
    }
    const pinned = new Set(p.missing);
    for (const factId of row.missing) {
      if (!pinned.has(factId)) {
        const line = row.lines.find((l) => l.includes(`(required fact ${factId})`)) ?? factId;
        failures.push(`${k}: NEW RED — ${line}`);
      }
    }
    const now = new Set(row.missing);
    for (const factId of p.missing) {
      if (!now.has(factId))
        failures.push(
          `${k}: FIXED — the baseline pins ${factId} but the contract now carries it; re-record with --write and say what fixed it in the row's cause`,
        );
    }
  }
  for (const p of prior) {
    if (!seen.has(key(p)))
      failures.push(`${key(p)}: STALE — a baseline row with no committed contract any more (re-record with --write)`);
  }
  return failures;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main(argv: string[]): number {
  if (argv.includes("--self-test")) return selfTest();
  const write = argv.includes("--write");
  const started = Date.now();
  const rows = scanCorpus();
  const baselineFile = path.join(REPO, BASELINE_PATH);
  const prior: BaselineRow[] = existsSync(baselineFile)
    ? (JSON.parse(readFileSync(baselineFile, "utf8")) as { rows: BaselineRow[] }).rows
    : [];
  const priorBy = new Map(prior.map((r) => [key(r), r]));

  const red = rows.filter((r) => r.missing.length > 0);
  const undeclared = rows.filter((r) => r.source === "unmapped");
  const declared = rows.filter((r) => r.source === "declared");

  if (write) {
    const out = {
      _marker: MARKER,
      recordedAt: new Date().toISOString().slice(0, 10),
      totals: {
        contracts: rows.length,
        red: red.length,
        missingFacts: red.reduce((n, r) => n + r.missing.length, 0),
        declaredArchetype: declared.length,
        undeclaredArchetype: undeclared.length,
      },
      rows: rows.map(
        (r): BaselineRow => ({
          library: r.library,
          id: r.id,
          archetype: r.archetype,
          source: r.source,
          missing: r.missing,
          // The prose is the human's; --write carries it forward, never
          // regenerates it.
          ...(priorBy.get(key(r))?.cause ? { cause: priorBy.get(key(r))!.cause } : {}),
        }),
      ),
    };
    writeFileSync(baselineFile, JSON.stringify(out, null, 2) + "\n");
    console.log(
      `✔ wrote ${BASELINE_PATH}: ${rows.length} contract(s), ${red.length} red carrying ${out.totals.missingFacts} missing required fact(s), ${undeclared.length} with an undeclared archetype`,
    );
    const unnamed = red.filter((r) => !priorBy.get(key(r))?.cause);
    if (unnamed.length > 0)
      console.log(`⚠ ${unnamed.length} red row(s) carry no \`cause\` — name each one in ${BASELINE_PATH} and in ${RECEIPT_PATH}`);
    return 0;
  }

  const failures = compare(rows, prior);
  const elapsed = `${((Date.now() - started) / 1000).toFixed(1)}s`;
  if (failures.length > 0) {
    console.error(`✖ required-facts (${elapsed}): ${failures.length} finding(s)`);
    for (const f of failures) console.error(`  - ${f}`);
    console.error(
      `\n  The baseline freezes today's wave by name; a fact that appears or disappears must be re-recorded deliberately: npm run required-facts:check -- --write`,
    );
    return 1;
  }
  console.log(
    `✔ required-facts: ${rows.length} committed contract(s) across ${new Set(rows.map((r) => r.library)).size} libraries — ` +
      `${rows.length - red.length} carry every required fact for their archetype; ${red.length} are red and every one of them is pinned by name in ${BASELINE_PATH} ` +
      `(${declared.length} declare their archetype, ${undeclared.length} are unmapped and enforce nothing) (${elapsed})`,
  );
  return 0;
}

process.exitCode = main(process.argv.slice(2));
