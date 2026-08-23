/**
 * CANVAS CONFORMANCE FIXTURE — the canvas-side twin of conformance/ (the
 * CSS/DOM fixture). Same principles, applied to the design→contract path:
 *
 *   - a synthetic library of labeled constructs (hand-authored dump v1 JSON,
 *     one small single-purpose case per document-model construct);
 *   - a HAND-AUTHORED manifest as the denominator, written from the Figma
 *     documentation model's semantics (extract/figma/types.ts) — never
 *     derived from what the engine currently does;
 *   - a two-sided ratchet: a green case that stops matching fails, and a
 *     FAIL-EXPECTED-RED case that unexpectedly goes green ALSO fails until
 *     re-recorded (exactly like the code fixture's pinned reds);
 *   - hard failure for any construct neither carried nor named-refused, and
 *     a hard REFUSAL to run a case the manifest does not list (denominator
 *     independence — the engine never gets to define its own denominator).
 *
 * Every case feeds the REAL shipping path: proposeBatchFromDump (the same
 * function the playground's receive paths run) with mintUnbound: true, the
 * standard token corpus (tokens/*.tokens.json via loadTokenCorpus's repo
 * fallback) and the repo's contracts/ as the in-scope contract corpus. No
 * engine code path special-cases the fixture.
 *
 * Classification per case (the manifest's `expect`):
 *   CARRIED  — the expected contract vocabulary appears in the proposal
 *              (contract JSON + minted-token tree + child stubs); probed by
 *              `check.carried` regexes.
 *   REFUSED  — the expected note class appears in the NAMING UNION (proposal
 *              notes, unbound entries, batch skips/notes, and the dump's own
 *              `_degradations` receipts); probed by `check.note`.
 *   LEDGERED — a degradation receipt / named note carries the construct while
 *              the contract stays honest; probed like REFUSED, usually with
 *              `check.absent` proving nothing was invented.
 *
 * `check.absent` regexes must match NOTHING in the contract text — the
 * "carried anyway" guard that turns an undeclared carriage into a failure.
 *
 * Two-sided verdicts:
 *   PASS              green case, check holds.
 *   RED-EXPECTED      red case (FAIL-EXPECTED-RED): the documentation-model
 *                     check still fails AND the pinned `observedCheck` (what
 *                     the engine does today) still holds. Counts as passing —
 *                     it is a pinned, named finding, not a silence.
 *   FAIL              green case whose check broke (regression), or red case
 *                     whose `observedCheck` drifted (the status quo moved —
 *                     re-pin it).
 *   UNEXPECTED-GREEN  red case whose doc-model check now PASSES — the engine
 *                     grew a capability the manifest still calls missing;
 *                     fails until the manifest is re-recorded green.
 *   UNLISTED          a cases/*.dump.json with no manifest entry — hard fail.
 *   MISSING           a manifest entry with no case file — hard fail.
 *
 * Usage:
 *   tsx extract/figma/conformance/run.ts              # the gate
 *   tsx extract/figma/conformance/run.ts --case <id>  # one case
 *   tsx extract/figma/conformance/run.ts --probe <id> # print naming union +
 *                                                     # contract (authoring aid)
 *
 * Headless forever: cases are committed dump JSON, no Figma read or write.
 * The live-file twin (drawing these constructs in a real Figma file and
 * capturing them with dump.plugin.js, so the CAPTURE stage is measured too)
 * is named future work — see README.md alongside this file.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  dumpCapturesHidden,
  proposeBatchFromDump,
} from "../../../core/propose-figma.js";
import { loadTokenCorpus } from "../tokens.js";
import { loadContracts } from "../propose.js";
import type { DumpDegradation, DumpFile } from "../types.js";
import { mapRestToDump, type RestNodesResponse, type RestVariablesResponse } from "../rest/map.js";
import { classifyVariablesRefusal } from "../rest/fetch.js";
import {
  capturedTokensDocument,
  capturedVariablesAbsentReceipt,
} from "../../../core/captured-tokens.js";

// ---------------------------------------------------------------------------
// Manifest shapes (hand-authored — see MANIFEST.json)
// ---------------------------------------------------------------------------

interface CaseCheck {
  /** Regexes that must ALL match the contract text (contract JSON + minted
   *  token tree + child stubs). The CARRIED probe. */
  carried?: string[];
  /** Regex that must match the naming union (notes/unbound/skips/receipts).
   *  The REFUSED / LEDGERED probe. */
  note?: string;
  /** Regexes that must match NOTHING in the contract text — proves the
   *  construct was not silently (or wrongly) carried. */
  absent?: string[];
  /** Regexes that must match NOTHING in the naming union — used by red
   *  cases' `observedCheck` to pin a SILENT loss as silent (the day the
   *  engine starts naming it, the pin breaks loudly and gets re-recorded). */
  noteAbsent?: string[];
}

interface ManifestCase {
  id: string;
  /** The document-model construct under test, in plain words. */
  construct: string;
  expect: "CARRIED" | "REFUSED" | "LEDGERED";
  /** One line: WHY the documentation model says this disposition. */
  why: string;
  /** The documentation-model check — what SHOULD happen. */
  check: CaseCheck;
  /** green: the engine meets the doc model today. red: FAIL-EXPECTED-RED —
   *  the doc-model check is known to fail; the status quo is pinned in
   *  `observedCheck` and described in `observed`. */
  status: "green" | "red";
  observed?: string;
  observedCheck?: CaseCheck;
}

interface Manifest {
  note: string;
  cases: ManifestCase[];
}

// ---------------------------------------------------------------------------
// Case execution — the real shipping path, nothing special-cased
// ---------------------------------------------------------------------------

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..");
const CASES_DIR = path.join(HERE, "cases");

interface CaseRun {
  /** Searched by `check.carried` / `check.absent`. */
  contractText: string;
  /** Searched by `check.note` — one entry per named fact. */
  namingUnion: string[];
}

/** A case may enter at EITHER boundary: `<id>.dump.json` (the plugin dump,
 *  dump v1 grammar) or `<id>.rest.json` (a GET /v1/files/:key/nodes
 *  response, mapped through the REAL extract/figma/rest/map.ts — the
 *  Journey A CLI's own transport). REST cases measure the mapper too: its
 *  MapReport degradations/notes join the naming union exactly as the CLI
 *  prints them to stderr, so a fact the mapper drops without a receipt is
 *  a SILENT loss here, not an absence (Phase 2 exam, 2026-08-22). */
function caseFileFor(id: string): string {
  const rest = path.join(CASES_DIR, `${id}.rest.json`);
  return existsSync(rest) ? rest : path.join(CASES_DIR, `${id}.dump.json`);
}

/** A REST case may carry, beside `nodes`, what the Journey A CLI would have
 *  learned from the variables endpoint (Phase 2 exam — "not fixtured: no
 *  manifest can exercise HTTP"; the HTTP is still not exercised, the
 *  classification → mapper → dump → propose plumbing IS):
 *    `_variablesResponse`  a GET /v1/files/:key/variables/local body (200)
 *    `_variablesRefusal`   `{ status, body }` — a recorded refusal, run
 *                          through the real classifyVariablesRefusal */
interface RestCaseFile extends RestNodesResponse {
  _variablesResponse?: RestVariablesResponse;
  _variablesRefusal?: { status: number; body: string };
}

function runCase(casePath: string, deps: ReturnType<typeof loadDeps>): CaseRun {
  const restReceipts: string[] = [];
  const dump = ((): DumpFile => {
    const json = JSON.parse(readFileSync(casePath, "utf8")) as unknown;
    if (!casePath.endsWith(".rest.json")) return json as DumpFile;
    const { _variablesResponse, _variablesRefusal, ...nodes } = json as RestCaseFile;
    const { dump: mapped, report } = mapRestToDump(nodes, {
      fileKey: null,
      ...(_variablesResponse ? { variables: _variablesResponse } : {}),
      ...(_variablesRefusal
        ? { variablesUnavailable: classifyVariablesRefusal(_variablesRefusal.status, _variablesRefusal.body) }
        : {}),
    });
    for (const n of report.notes) restReceipts.push(`rest note: ${n}`);
    // The mapper's degradations are deliberately NOT read off the MapReport
    // here: they must ride the DUMP as `_degradations` (joined below, the
    // same way a plugin dump's receipts join) — a mapper that names a loss
    // only on the report is measured as SILENT at this boundary.
    return mapped as unknown as DumpFile;
  })();
  const batch = proposeBatchFromDump(
    dump as unknown as Record<string, unknown>,
    {
      projectionMode: "reviewable-inversion",
      corpus: deps.corpus,
      contractIdByName: deps.contracts.byName,
      contractsById: deps.contracts.byId,
      contractIdByKey: deps.contracts.byKey,
      fileKey: dump._provenance?.fileKey ?? null,
      mintUnbound: true,
      hiddenCaptured: dumpCapturesHidden(dump._provenance),
    },
  );

  const contractPieces: unknown[] = [];
  const union: string[] = [];
  for (const p of batch.proposals) {
    contractPieces.push(p.contract);
    if (p.mintedTokens) contractPieces.push(p.mintedTokens.tree);
    if (p.childStubs) contractPieces.push(p.childStubs);
    union.push(...p.notes);
    for (const u of p.unbound) {
      union.push(
        `unbound ${u.nodePath} ${u.property} = ${String(u.value)}${u.suggestions.length > 0 ? ` (nearest: ${u.suggestions.join(", ")})` : ""}`,
      );
    }
  }
  for (const s of batch.skipped)
    union.push(`skip: ${s.reason}${s.detail ? ` — ${s.detail}` : ""}`);
  union.push(...batch.notes);
  // The dump's own capture-side receipts (dump v1.2 `_degradations`) join the
  // union: for capture-boundary constructs (no dump v1 field exists) the
  // receipt IS the ledger entry, authored in the vocabulary dump.plugin.js
  // itself emits — the contract-side `absent` probe is the measured half.
  for (const d of (dump._degradations ?? []) as DumpDegradation[]) {
    union.push(`degradation ${d.code} @ ${d.nodePath}: ${d.message}`);
  }
  union.push(...restReceipts);
  // The captured-variables receipt Journey A prints beside captured.dtcg.json
  // (or the cause-named line for its absence) — so a case can pin that the
  // `_variables` channel was written, and WHY it was not.
  const capturedDoc = capturedTokensDocument(dump as unknown as Record<string, unknown>);
  union.push(
    capturedDoc
      ? `captured variables: ${capturedDoc.receipt}`
      : capturedVariablesAbsentReceipt(dump as unknown as Record<string, unknown>),
  );
  return { contractText: JSON.stringify(contractPieces), namingUnion: union };
}

function loadDeps() {
  return {
    corpus: loadTokenCorpus(ROOT), // standard corpus: the repo tokens/ layout
    contracts: loadContracts(path.join(ROOT, "contracts")),
  };
}

// ---------------------------------------------------------------------------
// Check evaluation
// ---------------------------------------------------------------------------

interface CheckOutcome {
  pass: boolean;
  failures: string[];
}

function evaluate(check: CaseCheck, run: CaseRun): CheckOutcome {
  const failures: string[] = [];
  for (const c of check.carried ?? []) {
    if (!new RegExp(c).test(run.contractText))
      failures.push(`carried /${c}/ not in contract`);
  }
  if (check.note !== undefined) {
    const re = new RegExp(check.note);
    if (!run.namingUnion.some((n) => re.test(n)))
      failures.push(`note /${check.note}/ not in naming union`);
  }
  for (const a of check.absent ?? []) {
    if (new RegExp(a).test(run.contractText))
      failures.push(`absent /${a}/ FOUND in contract`);
  }
  for (const a of check.noteAbsent ?? []) {
    const re = new RegExp(a);
    if (run.namingUnion.some((n) => re.test(n)))
      failures.push(`noteAbsent /${a}/ FOUND in naming union`);
  }
  return { pass: failures.length === 0, failures };
}

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

type Verdict =
  | "PASS"
  | "RED-EXPECTED"
  | "FAIL"
  | "UNEXPECTED-GREEN"
  | "UNLISTED"
  | "MISSING";

function main() {
  const args = process.argv.slice(2);
  const readFlag = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args.splice(i, 2)[1] : undefined;
  };
  const only = readFlag("--case");
  const probe = readFlag("--probe");

  const manifest = JSON.parse(
    readFileSync(path.join(HERE, "MANIFEST.json"), "utf8"),
  ) as Manifest;
  const byId = new Map(manifest.cases.map((c) => [c.id, c]));
  if (byId.size !== manifest.cases.length) {
    console.error(
      "MANIFEST.json declares a duplicate case id — fix the manifest.",
    );
    process.exit(2);
  }
  const caseFiles = readdirSync(CASES_DIR).filter(
    (f) => f.endsWith(".dump.json") || f.endsWith(".rest.json"),
  );
  const fileIds = new Set(caseFiles.map((f) => f.replace(/\.(dump|rest)\.json$/, "")));

  const deps = loadDeps();

  if (probe !== undefined) {
    const run = runCase(caseFileFor(probe), deps);
    console.log("--- naming union ---");
    for (const n of run.namingUnion) console.log("  " + n);
    console.log("--- contract text ---");
    console.log(run.contractText);
    return;
  }

  const rows: Array<{
    id: string;
    expect: string;
    pin: string;
    verdict: Verdict;
    detail: string;
  }> = [];

  // Denominator independence, both directions.
  for (const id of [...fileIds].sort()) {
    if (!byId.has(id))
      rows.push({
        id,
        expect: "—",
        pin: "—",
        verdict: "UNLISTED",
        detail:
          "case file has no manifest entry — the manifest is the denominator; list it (with an expectation) or delete the file",
      });
  }
  for (const c of manifest.cases) {
    if (!fileIds.has(c.id))
      rows.push({
        id: c.id,
        expect: c.expect,
        pin: c.status,
        verdict: "MISSING",
        detail: "manifest entry has no cases/<id>.dump.json or cases/<id>.rest.json",
      });
  }

  for (const c of manifest.cases) {
    if (only !== undefined && c.id !== only) continue;
    if (!fileIds.has(c.id)) continue;
    let run: CaseRun;
    try {
      run = runCase(caseFileFor(c.id), deps);
    } catch (e) {
      rows.push({
        id: c.id,
        expect: c.expect,
        pin: c.status,
        verdict: "FAIL",
        detail: `runner threw: ${e instanceof Error ? e.message : String(e)}`,
      });
      continue;
    }
    const expected = evaluate(c.check, run);
    if (c.status === "green") {
      rows.push(
        expected.pass
          ? {
              id: c.id,
              expect: c.expect,
              pin: "green",
              verdict: "PASS",
              detail: "",
            }
          : {
              id: c.id,
              expect: c.expect,
              pin: "green",
              verdict: "FAIL",
              detail: expected.failures.join("; "),
            },
      );
      continue;
    }
    // FAIL-EXPECTED-RED: doc-model check must STILL fail; the pinned status
    // quo must STILL hold. Either side moving is a finding.
    if (expected.pass) {
      rows.push({
        id: c.id,
        expect: c.expect,
        pin: "red",
        verdict: "UNEXPECTED-GREEN",
        detail:
          "doc-model check now passes — re-record this case green (and celebrate)",
      });
      continue;
    }
    const observed = c.observedCheck
      ? evaluate(c.observedCheck, run)
      : { pass: true, failures: [] as string[] };
    rows.push(
      observed.pass
        ? {
            id: c.id,
            expect: c.expect,
            pin: "red",
            verdict: "RED-EXPECTED",
            detail: c.observed ?? "",
          }
        : {
            id: c.id,
            expect: c.expect,
            pin: "red",
            verdict: "FAIL",
            detail: `status-quo pin drifted: ${observed.failures.join("; ")}`,
          },
    );
  }

  // Table.
  const w = {
    id: Math.max(...rows.map((r) => r.id.length), 4),
    expect: 8,
    pin: 5,
    verdict: Math.max(...rows.map((r) => r.verdict.length), 7),
  };
  const pad = (s: string, n: number) => s.padEnd(n);
  console.log(
    `${pad("case", w.id)}  ${pad("expect", w.expect)}  ${pad("pin", w.pin)}  ${pad("verdict", w.verdict)}  detail`,
  );
  console.log("-".repeat(w.id + w.expect + w.pin + w.verdict + 14));
  for (const r of rows) {
    console.log(
      `${pad(r.id, w.id)}  ${pad(r.expect, w.expect)}  ${pad(r.pin, w.pin)}  ${pad(r.verdict, w.verdict)}  ${r.detail}`,
    );
  }
  const count = (v: Verdict) => rows.filter((r) => r.verdict === v).length;
  const bad =
    count("FAIL") +
    count("UNEXPECTED-GREEN") +
    count("UNLISTED") +
    count("MISSING");
  console.log("");
  console.log(
    `${rows.length} case(s): ${count("PASS")} PASS, ${count("RED-EXPECTED")} RED-EXPECTED (pinned findings), ${count("FAIL")} FAIL, ${count("UNEXPECTED-GREEN")} UNEXPECTED-GREEN, ${count("UNLISTED")} UNLISTED, ${count("MISSING")} MISSING`,
  );
  if (bad > 0) {
    console.error("CANVAS CONFORMANCE: RED");
    process.exit(1);
  }
  console.log(
    "CANVAS CONFORMANCE: GREEN (reds above are pinned, named findings — the next work order, not silence)",
  );
}

main();
