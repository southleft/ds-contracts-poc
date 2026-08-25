/**
 * CORPUS REPRODUCIBILITY GATE — `npm run corpus:reproducible:check`
 *
 *   npm run corpus:reproducible:check                    # the PROMOTE half (fast, no browser)
 *   npm run corpus:reproducible:check -- --capture       # + the CAPTURE half (Chromium, full lane)
 *   npm run corpus:reproducible:check -- --library mui   # one library
 *   npm run corpus:reproducible:check -- --write-receipt # record the rendering
 *   npm run corpus:reproducible:check -- --self-test     # the gate must go red on planted reds
 *
 * THE QUESTION. Every contract in `examples/<lib>/contracts` claims to be the
 * output of a documented chain: a committed SEED plus a committed capture
 * CONFIG, captured against the sandbox its PROVENANCE.md recreates, then
 * promoted through `packages/cli/src/promote.ts` with the library's authored
 * facts. Until 2026-08-24 nothing checked that claim, and it was false in
 * places: `ac5e6181` ("five records catch up to committed truth") back-ported
 * hand-edited CONTRACTS into the committed CAPTURE RECORDS, so those records
 * carried facts no run produced — and the first-pass exam found the wall the
 * day it ran the documented chain untouched (`parity/receipts/v1/FIRST-PASS.md`,
 * selftest-tailwind: 0/8, every set stopped at `promote`).
 *
 * TWO HALVES, because there are two derivations and they fail differently:
 *
 *   A · PROMOTE — committed capture record + authored facts → committed
 *       contracts, byte for byte. Pure, fast, no browser, deterministic
 *       everywhere. This is the half a PR lane can always run.
 *
 *   B · CAPTURE — committed seed + config + sandbox → the committed capture
 *       record. Needs Chromium and the git-ignored sandbox, so it is a
 *       full-lane step, and it compares STRUCTURE, not bytes: the anatomy's
 *       part paths, the props (name/type/default) and the state names. Values
 *       (`declared`, `tokensByProp`, `codeOnly`) move with the engine and the
 *       Chromium build and are the drift-check's instrument
 *       (`npm run extract:computed:drift`), not this one. STRUCTURE is what
 *       carries provenance: a part or a prop the capture cannot produce is a
 *       fact from nowhere, and that is exactly what broke the chain.
 *
 * EVERY DIVERGENCE MUST BE NAMED. `parity/receipts/v1/corpus-reproducible.json`
 * is the ledger of the ones that are known and why. An UNNAMED divergence
 * refuses. A named divergence that has since been FIXED also refuses — a stale
 * row is as dead as a missing one. A library whose sandbox is absent is
 * recorded PENDING by name and is never counted as reproducing.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promote, type PromoteConfig } from "../packages/cli/src/promote.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const LEDGER_PATH = "parity/receipts/v1/corpus-reproducible.json";
export const MEASURED_PATH =
  "parity/receipts/v1/corpus-reproducible.measured.json";
export const RECEIPT_PATH = "parity/receipts/v1/CORPUS-REPRODUCIBLE.md";

// ---------------------------------------------------------------------------
// The registry — every library that ships a ds-library.json, in name order
// ---------------------------------------------------------------------------

export interface LibraryDef {
  library: string;
  manifestPath: string;
  manifest: PromoteConfig & {
    seeds?: string;
    authored?: string;
    capture?: { config: string; harness: string };
  };
}

export function libraries(root = REPO): LibraryDef[] {
  const dir = path.join(root, "examples");
  const out: LibraryDef[] = [];
  for (const name of readdirSync(dir).sort()) {
    const mf = path.join(dir, name, "ds-library.json");
    if (!existsSync(mf)) continue;
    out.push({
      library: name,
      manifestPath: path.relative(root, mf),
      manifest: JSON.parse(readFileSync(mf, "utf8")) as LibraryDef["manifest"],
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// The ledger
// ---------------------------------------------------------------------------

export interface LedgerRow {
  /** The artifacts (promote half) or facts (capture half) that diverge. */
  diverging: string[];
  /** WHY — reviewed, and quoted verbatim into the receipt. */
  cause: string;
}
export interface Ledger {
  _marker: string;
  promote: Record<string, LedgerRow>;
  capture: Record<string, LedgerRow>;
}

export function loadLedger(root = REPO): Ledger {
  const p = path.join(root, LEDGER_PATH);
  if (!existsSync(p)) return { _marker: "", promote: {}, capture: {} };
  const raw = JSON.parse(readFileSync(p, "utf8")) as Partial<Ledger>;
  return {
    _marker: raw._marker ?? "",
    promote: raw.promote ?? {},
    capture: raw.capture ?? {},
  };
}

// ---------------------------------------------------------------------------
// The capture MEASUREMENT — recorded once, read forever
// ---------------------------------------------------------------------------

/**
 * Half B needs Chromium and a git-ignored sandbox, so it cannot run in every
 * lane — and a gate whose verdict depends on which machine ran it is not a
 * gate. So the capture half RECORDS what it measured
 * (`corpus-reproducible.measured.json`) and the referee reads that record.
 * `--capture` (or `--capture-from <dir>`) re-measures and rewrites it; every
 * other invocation judges the committed measurement against the committed
 * ledger, deterministically, with no browser.
 */
export interface Measurement {
  _marker: string;
  /** The day the capture half last ran. Rendered, never read from the clock. */
  measuredAt: string;
  /** The Chromium build the measuring run used — a divergence is only
   *  comparable against the browser that produced it. */
  browser: string;
  libraries: Record<
    string,
    { pending: string | null; components: Record<string, string[]> }
  >;
}

export function loadMeasurement(root = REPO): Measurement | null {
  const p = path.join(root, MEASURED_PATH);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as Measurement;
}

export function measurementToRows(m: Measurement | null): CaptureResultRow[] {
  if (!m) return [];
  return Object.entries(m.libraries)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([library, row]) => ({
      library,
      pending: row.pending,
      byComponent: new Map(Object.entries(row.components)),
    }));
}

// ---------------------------------------------------------------------------
// Half A — promote
// ---------------------------------------------------------------------------

export interface PromoteResultRow {
  library: string;
  identical: number;
  diverging: string[];
  threw: string | null;
}

/** Re-promote ONE library from its committed capture record into a throwaway
 *  example dir and diff every produced artifact against the committed one.
 *  Nothing in the repo is written. */
export function repromote(
  def: LibraryDef,
  work: string,
  root = REPO,
): PromoteResultRow {
  const committedDir = path.join(root, "examples", def.library);
  const workDir = path.join(work, def.library);
  mkdirSync(path.join(workDir, "contracts"), { recursive: true });
  mkdirSync(path.join(workDir, "tokens"), { recursive: true });
  // The icon map is an INPUT to the statePreviews probe — seed it.
  if (existsSync(path.join(committedDir, "assets"))) {
    cpSync(path.join(committedDir, "assets"), path.join(workDir, "assets"), {
      recursive: true,
    });
  }
  const rel = path.relative(root, workDir);
  try {
    promote(
      root,
      {
        ...def.manifest,
        exampleDir: rel,
        mintedOut: path.join(
          rel,
          "tokens",
          path.basename(def.manifest.mintedOut),
        ),
        mintedDoc: path.join(
          rel,
          "tokens",
          path.basename(def.manifest.mintedDoc),
        ),
      },
      () => {},
    );
  } catch (e) {
    return {
      library: def.library,
      identical: 0,
      diverging: [],
      threw: String((e as Error).message ?? e),
    };
  }
  let identical = 0;
  const diverging: string[] = [];
  for (const sub of ["contracts", "tokens", "assets"]) {
    const producedDir = path.join(workDir, sub);
    if (!existsSync(producedDir)) continue;
    for (const f of readdirSync(producedDir).sort()) {
      const produced = path.join(producedDir, f);
      if (statSync(produced).isDirectory()) continue;
      const committed = path.join(committedDir, sub, f);
      if (!existsSync(committed)) {
        diverging.push(
          `${sub}/${f} (produced, but the repo does not carry it)`,
        );
        continue;
      }
      if (readFileSync(produced).equals(readFileSync(committed))) identical++;
      else diverging.push(`${sub}/${f}`);
    }
  }
  for (const f of readdirSync(path.join(committedDir, "contracts")).sort()) {
    if (!/\.(contract|extension|anchors)\.json$/.test(f)) continue;
    if (!existsSync(path.join(workDir, "contracts", f))) {
      diverging.push(
        `contracts/${f} (committed, but promote produced nothing)`,
      );
    }
  }
  return {
    library: def.library,
    identical,
    diverging: diverging.sort(),
    threw: null,
  };
}

// ---------------------------------------------------------------------------
// Half B — capture (structure only)
// ---------------------------------------------------------------------------

interface AnatomyPart {
  parts?: Record<string, AnatomyPart>;
}

/** The provenance-carrying SHAPE of a capture record: which parts exist, which
 *  props exist with which type and default, which state planes exist. */
export function structuralSignature(contract: Record<string, unknown>): {
  parts: string[];
  props: string[];
  states: string[];
} {
  const parts: string[] = [];
  const walk = (
    node: Record<string, AnatomyPart> | undefined,
    prefix: string,
  ): void => {
    for (const [name, part] of Object.entries(node ?? {})) {
      parts.push(prefix + name);
      walk(part.parts, `${prefix}${name}/`);
    }
  };
  walk(contract.anatomy as Record<string, AnatomyPart> | undefined, "");
  const props = ((contract.props ?? []) as Array<Record<string, unknown>>).map(
    (p) =>
      `${String(p.name)}=${JSON.stringify(p.type ?? null)}/${JSON.stringify(p.default ?? null)}`,
  );
  const states = ((contract.states ?? []) as Array<unknown>).map((s) =>
    typeof s === "string"
      ? s
      : String((s as { name?: unknown }).name ?? JSON.stringify(s)),
  );
  return { parts, props, states };
}

export function structuralDivergence(
  fresh: Record<string, unknown>,
  committed: Record<string, unknown>,
): string[] {
  const A = structuralSignature(fresh);
  const B = structuralSignature(committed);
  const out: string[] = [];
  for (const kind of ["parts", "props", "states"] as const) {
    const onlyFresh = A[kind].filter((x) => !B[kind].includes(x));
    const onlyCommitted = B[kind].filter((x) => !A[kind].includes(x));
    if (onlyFresh.length === 0 && onlyCommitted.length === 0) continue;
    const bits: string[] = [];
    if (onlyCommitted.length > 0)
      bits.push(`only in the committed record: ${onlyCommitted.join(" ; ")}`);
    if (onlyFresh.length > 0)
      bits.push(`only in the fresh capture: ${onlyFresh.join(" ; ")}`);
    out.push(`${kind} — ${bits.join(" | ")}`);
  }
  return out;
}

export interface CaptureResultRow {
  library: string;
  /** The Chromium build the FRESH sweep ran on, read from its own
   *  `captured-truth.json` `_provenance.browser`. Recorded because a
   *  structural divergence is only comparable against the browser that
   *  produced it — and because reading it from the COMMITTED record instead
   *  would name the browser of the run being CHECKED, which is the one fact
   *  this file must never confuse. */
  browser?: string;
  /** component → divergence lines (empty = reproduces). */
  byComponent: Map<string, string[]>;
  pending: string | null;
}

/** Compare an ALREADY-RUN capture tree (`<dir>/<library>/<component>/`) against
 *  the committed records. The tree must have been produced by the documented
 *  command — `npx tsx extract/computed/run.ts --harness <sandbox> --config
 *  <config> --component <C> --out <dir>/<library>` — which is what `--capture`
 *  runs itself; this path exists because a full corpus sweep is hours long and
 *  is often run out of band. It is the SAME comparison against the SAME
 *  artifacts, never a repair. */
export function compareCaptureTree(
  def: LibraryDef,
  from: string,
  root = REPO,
): CaptureResultRow {
  const byComponent = new Map<string, string[]>();
  const dir = path.join(from, def.library);
  if (!existsSync(dir)) {
    return {
      library: def.library,
      byComponent,
      pending: `the measuring run captured nothing for ${def.library}${def.manifest.capture ? ` — ${def.manifest.capture.harness} is git-ignored and this machine does not carry it (examples/${def.library}/PROVENANCE.md has the recreate block)` : " — its ds-library.json names no capture block"}. NOT measured, never counted as reproducing.`,
    };
  }
  const committedOut = path.join(root, def.manifest.captureOut);
  for (const comp of readdirSync(dir).sort()) {
    const fresh = path.join(dir, comp, "enriched.contract.json");
    const committed = path.join(committedOut, comp, "enriched.contract.json");
    if (!existsSync(fresh)) continue;
    if (!existsSync(committed)) {
      byComponent.set(comp, [
        `the capture produced ${comp}, which ${def.manifest.captureOut} does not carry`,
      ]);
      continue;
    }
    byComponent.set(
      comp,
      structuralDivergence(
        JSON.parse(readFileSync(fresh, "utf8")) as Record<string, unknown>,
        JSON.parse(readFileSync(committed, "utf8")) as Record<string, unknown>,
      ),
    );
  }
  // THE DENOMINATOR IS THE COMMITTED CORPUS, not the config: a config may
  // declare a component the corpus deliberately does not carry (tailwind
  // holds Blockquote/Spinner/TextInput — docs/22 §8.3), and those are not
  // this gate's business. Every component the corpus DOES carry must have a
  // fresh twin; one that does not means the documented capture command
  // produced nothing for it, and THAT is a divergence, not a silence.
  const declared = def.manifest.capture
    ? (
        JSON.parse(
          readFileSync(path.join(root, def.manifest.capture.config), "utf8"),
        ) as { components: Array<{ name: string }> }
      ).components.map((c) => c.name.toLowerCase())
    : [...byComponent.keys()];
  const expected = declared.filter((c) =>
    existsSync(path.join(committedOut, c, "enriched.contract.json")),
  );
  // A component with no fresh record is one of two very different things, and
  // the difference is not guessable — so it is RECORDED. A run that captured
  // it and was REFUSED leaves `<component>.REFUSED.txt` beside the tree (the
  // live `recapture` path writes one); that is a divergence, and a sharp one:
  // the documented command cannot re-derive the record at all. A component
  // with neither a record nor a refusal was simply not swept, and a partial
  // sweep is not a measurement — the whole library goes PENDING by name.
  const missing = expected.filter((c) => !byComponent.has(c));
  const refusalFor = (c: string): string | null => {
    const f = path.join(from, def.library, `${c}.REFUSED.txt`);
    if (!existsSync(f)) return null;
    // A REFUSAL WITH NO MESSAGE IS NOT A REFUSAL. An empty marker would render
    // as "the documented capture REFUSED and produced no record: " — a blank
    // where the engine's own words belong, which is exactly the blank cell
    // this repo refuses everywhere else. Treat it as unmeasured instead, so
    // the library goes PENDING and someone re-runs the sweep.
    const text = readFileSync(f, "utf8").trim();
    return text.length > 0 ? text : null;
  };
  const unmeasured = missing.filter((c) => refusalFor(c) === null);
  if (unmeasured.length > 0) {
    return {
      library: def.library,
      byComponent: new Map<string, string[]>(),
      pending: `${unmeasured.length} of the ${expected.length} component(s) the corpus carries were not swept (${unmeasured.join(", ")}) — a PARTIAL sweep is not a measurement; NOT measured, never counted as reproducing`,
    };
  }
  for (const c of missing) {
    byComponent.set(c, [
      `the documented capture REFUSED and produced no record: ${refusalFor(c)}`,
    ]);
  }
  return {
    library: def.library,
    byComponent,
    pending: null,
    browser: freshBrowser(dir, [...byComponent.keys()]),
  };
}

/** The Chromium build a FRESH capture tree ran on. */
function freshBrowser(dir: string, comps: string[]): string | undefined {
  for (const c of comps) {
    const p = path.join(dir, c, "captured-truth.json");
    if (!existsSync(p)) continue;
    const b = (
      JSON.parse(readFileSync(p, "utf8")) as {
        _provenance?: { browser?: string };
      }
    )._provenance?.browser;
    if (b) return b;
  }
  return undefined;
}

export function recapture(
  def: LibraryDef,
  work: string,
  root = REPO,
): CaptureResultRow {
  const cap = def.manifest.capture;
  const byComponent = new Map<string, string[]>();
  if (!cap) {
    return {
      library: def.library,
      byComponent,
      pending: `${def.manifest.library}: ds-library.json names no \`capture\` block — there is no documented capture command to re-run`,
    };
  }
  const harness = path.join(root, cap.harness);
  const cfg = JSON.parse(readFileSync(path.join(root, cap.config), "utf8")) as {
    library: { package: string; version: string };
    components: Array<{ name: string }>;
  };
  const pkg = path.join(
    harness,
    "node_modules",
    ...cfg.library.package.split("/"),
  );
  if (!existsSync(pkg)) {
    return {
      library: def.library,
      byComponent,
      pending:
        `${cap.harness} does not carry ${cfg.library.package}@${cfg.library.version} — the sandbox is git-ignored and this machine has not built it ` +
        `(examples/${def.library}/PROVENANCE.md carries the recreate block). NOT measured, never counted as reproducing.`,
    };
  }
  const out = path.join(work, "capture", def.library);
  mkdirSync(out, { recursive: true });
  const committedOut = path.join(root, def.manifest.captureOut);
  for (const comp of cfg.components) {
    try {
      execFileSync(
        "npx",
        [
          "tsx",
          "extract/computed/run.ts",
          "--harness",
          cap.harness,
          "--config",
          cap.config,
          "--component",
          comp.name,
          "--out",
          out,
        ],
        { cwd: root, stdio: "pipe" },
      );
    } catch (e) {
      // A capture that REFUSES is a measurement, not a crash — record it the
      // way the out-of-band path does and carry on. (mui/Tooltip is the live
      // case: the Popper's x offset differs between the two sweeps of the
      // engine's own determinism self-check.)
      writeFileSync(
        path.join(out, `${comp.name.toLowerCase()}.REFUSED.txt`),
        String(
          (e as { stderr?: Buffer }).stderr?.toString() ??
            (e as Error).message ??
            e,
        )
          .split("\n")
          .filter((l) => l.trim().startsWith("Error:"))
          .join(" ")
          .slice(0, 600) || String((e as Error).message ?? e).slice(0, 600),
      );
      continue;
    }
    for (const dir of readdirSync(out).sort()) {
      const fresh = path.join(out, dir, "enriched.contract.json");
      const committed = path.join(committedOut, dir, "enriched.contract.json");
      if (!existsSync(fresh) || byComponent.has(dir)) continue;
      if (!existsSync(committed)) {
        byComponent.set(dir, [
          `the capture produced ${dir}, which ${def.manifest.captureOut} does not carry`,
        ]);
        continue;
      }
      byComponent.set(
        dir,
        structuralDivergence(
          JSON.parse(readFileSync(fresh, "utf8")) as Record<string, unknown>,
          JSON.parse(readFileSync(committed, "utf8")) as Record<
            string,
            unknown
          >,
        ),
      );
    }
  }
  return {
    library: def.library,
    byComponent,
    pending: null,
    browser: freshBrowser(out, [...byComponent.keys()]),
  };
}

// ---------------------------------------------------------------------------
// The referee
// ---------------------------------------------------------------------------

export interface Verdict {
  failures: string[];
  promote: PromoteResultRow[];
  capture: CaptureResultRow[];
}

export function judge(
  promoteRows: PromoteResultRow[],
  captureRows: CaptureResultRow[],
  ledger: Ledger,
): string[] {
  const failures: string[] = [];
  const seenPromote = new Set<string>();
  for (const row of promoteRows) {
    if (row.threw !== null) {
      failures.push(
        `${row.library}: promote THREW — ${row.threw.slice(0, 400)}`,
      );
      continue;
    }
    const named = ledger.promote[row.library];
    if (row.diverging.length === 0) {
      if (named)
        failures.push(
          `${row.library}: the ledger names ${named.diverging.length} promote divergence(s) that no longer happen — a stale row is as dead as a missing one; delete parity/receipts/v1/corpus-reproducible.json → promote.${row.library}`,
        );
      continue;
    }
    seenPromote.add(row.library);
    if (!named) {
      failures.push(
        `${row.library}: ${row.diverging.length} artifact(s) do NOT re-promote from the committed capture record — ${row.diverging.join(", ")}. Fix the derivation, or name the cause in ${LEDGER_PATH} → promote.${row.library}`,
      );
      continue;
    }
    const extra = row.diverging.filter((d) => !named.diverging.includes(d));
    const gone = named.diverging.filter((d) => !row.diverging.includes(d));
    if (extra.length > 0)
      failures.push(
        `${row.library}: ${extra.length} promote divergence(s) the ledger does not name — ${extra.join(", ")}`,
      );
    if (gone.length > 0)
      failures.push(
        `${row.library}: the ledger names ${gone.length} promote divergence(s) that no longer happen — ${gone.join(", ")}; delete those rows`,
      );
  }
  for (const lib of Object.keys(ledger.promote)) {
    if (!promoteRows.some((r) => r.library === lib)) {
      failures.push(
        `${LEDGER_PATH} → promote.${lib}: no such library in examples/ — the ledger names a row nothing measures`,
      );
    }
  }
  for (const row of captureRows) {
    if (row.pending !== null) continue;
    for (const [comp, lines] of [...row.byComponent].sort((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      const key = `${row.library}/${comp}`;
      const named = ledger.capture[key];
      if (lines.length === 0) {
        if (named)
          failures.push(
            `${key}: the ledger names a capture divergence that no longer happens — delete ${LEDGER_PATH} → capture["${key}"]`,
          );
        continue;
      }
      if (!named) {
        failures.push(
          `${key}: the committed capture record is NOT re-derivable from the committed seed + config + sandbox — ${lines.join(" || ")}. Route the fact through the library's authored-facts ledger, or name the cause in ${LEDGER_PATH} → capture["${key}"]`,
        );
        continue;
      }
      const extra = lines.filter((d) => !named.diverging.includes(d));
      const gone = named.diverging.filter((d) => !lines.includes(d));
      if (extra.length > 0)
        failures.push(
          `${key}: ${extra.length} capture divergence(s) the ledger does not name — ${extra.join(" || ")}`,
        );
      if (gone.length > 0)
        failures.push(
          `${key}: the ledger names ${gone.length} capture divergence(s) that no longer happen — ${gone.join(" || ")}; delete those rows`,
        );
    }
  }
  const measured = new Set(
    captureRows.flatMap((r) =>
      r.pending
        ? []
        : [...r.byComponent.keys()].map((c) => `${r.library}/${c}`),
    ),
  );
  if (captureRows.some((r) => r.pending === null)) {
    for (const key of Object.keys(ledger.capture)) {
      const lib = key.split("/")[0];
      if (!captureRows.some((r) => r.library === lib && r.pending === null))
        continue;
      if (!measured.has(key))
        failures.push(
          `${LEDGER_PATH} → capture["${key}"]: the capture measured ${lib} and produced no such component — the ledger names a row nothing measures`,
        );
    }
  }
  return failures;
}

// ---------------------------------------------------------------------------
// The receipt
// ---------------------------------------------------------------------------

export function renderReceipt(
  promoteRows: PromoteResultRow[],
  captureRows: CaptureResultRow[],
  ledger: Ledger,
): string {
  const L: string[] = [];
  L.push(
    "# Corpus reproducibility — does the documented chain re-derive its own corpus?",
  );
  L.push("");
  L.push(
    "GENERATED by `npm run corpus:reproducible:check -- --capture --write-receipt` (scripts/corpus-reproducible-check.ts) — do not edit. " +
      "Libraries in name order; the CAPTURE column is blank-free by construction (a library whose sandbox this machine does not carry is PENDING with the reason).",
  );
  L.push("");
  L.push("## The question");
  L.push("");
  L.push(
    "Every contract in `examples/<lib>/contracts` claims to be the output of the documented chain: a committed SEED plus a committed capture CONFIG, " +
      "captured against the sandbox its `PROVENANCE.md` recreates, then promoted with the library's authored facts. Nothing checked that claim until " +
      "2026-08-24, and the first-pass exam found it false where it mattered most — `selftest-tailwind` stopped every one of its eight sets at `promote` " +
      "because the committed capture record carried props no committed input produces (see [FIRST-PASS.md](FIRST-PASS.md)).",
  );
  L.push("");
  L.push(
    "## A · PROMOTE — committed capture record + authored facts → committed contracts, byte for byte",
  );
  L.push("");
  L.push("| library | byte-identical | diverging | named cause |");
  L.push("|---|---|---|---|");
  for (const row of promoteRows) {
    const named = ledger.promote[row.library];
    L.push(
      `| ${row.library} | ${row.identical} | ${row.threw ? "THREW" : row.diverging.length} | ${
        row.threw
          ? row.threw.slice(0, 160)
          : row.diverging.length === 0
            ? "—"
            : (named?.cause ?? "**UNNAMED**")
      } |`,
    );
  }
  L.push("");
  L.push(
    "## B · CAPTURE — committed seed + config + sandbox → the committed capture record (STRUCTURE)",
  );
  L.push("");
  const measured = loadMeasurement();
  if (measured) {
    L.push(
      `Last measured **${measured.measuredAt}** on **${measured.browser}**, recorded in \`${MEASURED_PATH}\` — the capture half needs Chromium and the ` +
        "git-ignored sandboxes, so it runs out of band and the fast lane judges its committed record. That is what makes this verdict the same on every machine.",
    );
    L.push("");
  }
  L.push(
    "Compared: the anatomy's part paths, the props (name / type / default) and the state names. Values — `declared`, `tokensByProp`, `codeOnly` — move " +
      "with the engine and with the Chromium build; they are `npm run extract:computed:drift`'s instrument, not this one. STRUCTURE is what carries " +
      "provenance: a part or a prop the capture cannot produce is a fact from nowhere.",
  );
  L.push("");
  L.push("| library | components measured | reproduce | diverge | status |");
  L.push("|---|---|---|---|---|");
  for (const row of captureRows) {
    if (row.pending) {
      L.push(`| ${row.library} | 0 | — | — | PENDING — ${row.pending} |`);
      continue;
    }
    const total = row.byComponent.size;
    const ok = [...row.byComponent.values()].filter(
      (v) => v.length === 0,
    ).length;
    L.push(
      `| ${row.library} | ${total} | ${ok} | ${total - ok} | ${total === ok ? "re-derives" : "named below"} |`,
    );
  }
  const named = captureRows.flatMap((r) =>
    r.pending
      ? []
      : [...r.byComponent]
          .filter(([, v]) => v.length > 0)
          .map(([c]) => `${r.library}/${c}`),
  );
  if (named.length > 0) {
    L.push("");
    L.push("### The named capture divergences");
    L.push("");
    for (const key of named.sort()) {
      const row = ledger.capture[key];
      L.push(`- **${key}** — ${row?.cause ?? "**UNNAMED**"}`);
    }
  }
  L.push("");
  L.push("## Where this sits");
  L.push("");
  L.push(
    "- [FIRST-PASS.md](FIRST-PASS.md) — the exam that made this measurable, and the metric it feeds.",
  );
  L.push(
    "- [docs/31 — First-pass](../../../docs/31-first-pass.md) — the no-retry rule this gate exists to protect.",
  );
  L.push(
    "- `npm run extract:computed:drift` — the VALUE instrument; this gate is the STRUCTURE one.",
  );
  L.push("");
  return L.join("\n");
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function run(
  root: string,
  opts: { capture: boolean; captureFrom: string | null; only: string | null },
): Verdict & { remeasured: boolean } {
  const defs = libraries(root).filter((d) =>
    opts.only ? d.library === opts.only : true,
  );
  const work = mkdtempSync(path.join(tmpdir(), "corpus-repro-"));
  try {
    const promoteRows = defs.map((d) => repromote(d, work, root));
    const remeasured = opts.capture || opts.captureFrom !== null;
    const captureRows = remeasured
      ? defs.map((d) =>
          opts.captureFrom
            ? compareCaptureTree(d, opts.captureFrom, root)
            : recapture(d, work, root),
        )
      : measurementToRows(loadMeasurement(root)).filter((r) =>
          opts.only ? r.library === opts.only : true,
        );
    return {
      failures: judge(promoteRows, captureRows, loadLedger(root)),
      promote: promoteRows,
      capture: captureRows,
      remeasured,
    };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** The Chromium build the measuring run used, taken from the sweep's OWN
 *  records — never from the committed corpus, which would name the browser of
 *  the run being CHECKED rather than the run doing the checking. */
function browserBuild(rows: CaptureResultRow[]): string {
  for (const row of rows) if (!row.pending && row.browser) return row.browser;
  return "(not recorded — the measuring sweep named no browser)";
}

/** The capture half's own record — written only by a run that MEASURED. */
function writeMeasurement(rows: CaptureResultRow[], browser: string): void {
  const m: Measurement = {
    _marker:
      "THE CAPTURE HALF'S MEASUREMENT — written by `npm run corpus:reproducible:check -- --capture` (or --capture-from). " +
      "Half B needs Chromium and the git-ignored sandboxes, so it cannot run in every lane; the referee reads THIS record " +
      "instead, which makes the verdict the same on every machine. Re-measure to move it. A library with no sandbox on the " +
      "measuring machine is PENDING by name and is never counted as reproducing.",
    measuredAt: new Date().toISOString().slice(0, 10),
    browser,
    libraries: Object.fromEntries(
      [...rows]
        .sort((a, b) => a.library.localeCompare(b.library))
        .map((r) => [
          r.library,
          {
            pending: r.pending,
            components: Object.fromEntries(
              [...r.byComponent].sort((a, b) => a[0].localeCompare(b[0])),
            ),
          },
        ]),
    ),
  };
  writeFileSync(
    path.join(REPO, MEASURED_PATH),
    JSON.stringify(m, null, 2) + "\n",
  );
}

function selfTest(): void {
  // A gate that cannot be shown going red is not a gate. Three planted reds,
  // each on a PURE referee — no capture, no promote, no clock.
  const base: Ledger = { _marker: "", promote: {}, capture: {} };
  const planted: Array<[string, string[], string]> = [
    [
      "an unnamed promote divergence",
      judge(
        [
          {
            library: "x",
            identical: 3,
            diverging: ["contracts/a.json"],
            threw: null,
          },
        ],
        [],
        base,
      ),
      "do NOT re-promote",
    ],
    [
      "a stale promote row",
      judge([{ library: "x", identical: 3, diverging: [], threw: null }], [], {
        ...base,
        promote: { x: { diverging: ["contracts/a.json"], cause: "reviewed" } },
      }),
      "no longer happen",
    ],
    [
      "an unnamed capture divergence",
      judge(
        [],
        [
          {
            library: "x",
            byComponent: new Map([
              ["c", ["props — only in the committed record: z"]],
            ]),
            pending: null,
          },
        ],
        base,
      ),
      "NOT re-derivable",
    ],
  ];
  for (const [what, failures, needle] of planted) {
    if (!failures.some((f) => f.includes(needle))) {
      console.error(`✘ self-test: ${what} did not go red naming "${needle}"`);
      process.exit(1);
    }
  }
  // …and green stays green.
  if (
    judge(
      [{ library: "x", identical: 3, diverging: [], threw: null }],
      [],
      base,
    ).length !== 0
  ) {
    console.error("✘ self-test: a clean corpus was refused");
    process.exit(1);
  }
  console.log(
    `✔ corpus:reproducible self-test — ${planted.length} planted red(s) each refused BY NAME, and a clean corpus passes`,
  );
}

function main(): void {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) {
    selfTest();
    return;
  }
  const only = argv.includes("--library")
    ? argv[argv.indexOf("--library") + 1]
    : null;
  const capture = argv.includes("--capture");
  const captureFrom = argv.includes("--capture-from")
    ? path.resolve(argv[argv.indexOf("--capture-from") + 1])
    : null;
  const verdict = run(REPO, { capture, captureFrom, only });

  for (const row of verdict.promote) {
    console.log(
      row.threw
        ? `  ✘ ${row.library}: promote THREW — ${row.threw.slice(0, 200)}`
        : `  ${row.diverging.length === 0 ? "✔" : "•"} ${row.library}: ${row.identical} artifact(s) byte-identical${row.diverging.length ? `, ${row.diverging.length} named divergence(s)` : ""}`,
    );
  }
  if (verdict.capture.length > 0) {
    for (const row of verdict.capture) {
      if (row.pending) {
        console.log(`  · ${row.library}: capture PENDING — ${row.pending}`);
        continue;
      }
      const total = row.byComponent.size;
      const ok = [...row.byComponent.values()].filter(
        (v) => v.length === 0,
      ).length;
      console.log(
        `  ${ok === total ? "✔" : "•"} ${row.library}: ${ok}/${total} component(s) re-derive structurally`,
      );
    }
  }

  if (verdict.remeasured && only === null) {
    writeMeasurement(verdict.capture, browserBuild(verdict.capture));
    console.log(`✔ measurement → ${MEASURED_PATH}`);
  } else if (verdict.remeasured) {
    console.log(
      `· measurement NOT rewritten: --library narrows the run, and a partial sweep may not overwrite the corpus-wide record`,
    );
  }

  if (argv.includes("--write-receipt")) {
    const out = path.join(REPO, RECEIPT_PATH);
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(
      out,
      renderReceipt(verdict.promote, verdict.capture, loadLedger(REPO)),
    );
    console.log(`✔ receipt → ${RECEIPT_PATH}`);
  }

  if (verdict.failures.length > 0) {
    console.error(
      `\n✘ corpus:reproducible:check — ${verdict.failures.length} refusal(s):`,
    );
    for (const f of verdict.failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(
    `✔ corpus:reproducible:check — ${verdict.promote.length} library/libraries re-promote from their committed capture records; ` +
      `every divergence is named in ${LEDGER_PATH}`,
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]).includes("corpus-reproducible-check")
)
  main();
