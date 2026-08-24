/**
 * CANVAS CENSUS GATE — `npm run census:check -- --phase code|full`
 *
 *   npx tsx scripts/canvas-census-check.ts --phase code        # this PR's phase
 *   npx tsx scripts/canvas-census-check.ts --phase full        # once the canvas half lands
 *   npx tsx scripts/canvas-census-check.ts --write-manifest    # regenerate the denominator
 *   npx tsx scripts/canvas-census-check.ts --self-test         # the gate must go red on a planted red
 *
 * THE BAR (owner, 2026-08-23): "generate canvas Figma designs from contracts;
 * the contract mediates and adjudicates the code and the canvas." v1 is done
 * when, for EVERY committed contract in the corpus, (1) contract → canvas
 * mints a recognisable set (screenshot beside the code render; differences
 * only named walls), (2) dump → propose round-trips to the same contract,
 * (3) code and canvas agree on every carried fact.
 *
 * WHAT THIS GATE HOLDS.
 *   · THE DENOMINATOR. parity/receipts/v1/census-manifest.json is regenerated
 *     in memory (extract/figma/census/corpus.ts) and compared to the
 *     committed file: a contract that exists on disk and is not a manifest
 *     row REFUSES by name; a row whose contract is gone refuses; any other
 *     drift refuses with `--write-manifest` as the remedy. No contract can
 *     leave the census silently.
 *   · THE CODE HALF. Every row has parity/receipts/v1/census/<lib>/<id>/
 *     code-render.json (extract/figma/census/render.ts) and every PNG it
 *     names exists. A row with no receipt is MISSING; a receipt whose
 *     contract would not render is UNAVAILABLE (<reason>). Both are RED in
 *     both phases — "no code render" is a failure, never a blank cell.
 *   · THE CANVAS HALF (phase full). Every sampled variant has its
 *     canvas-<slug>.png and the row has a verdict.json whose `recognisable`
 *     is true or false — `unscored` (or no verdict) is RED. A `false` verdict
 *     must name at least one wall; an unexplained difference is RED too.
 *     `--phase code` lets these columns read PENDING, so the fast lane holds
 *     the denominator and the code half now and flips to `--phase full` when
 *     the canvas half lands.
 *   · THE RECEIPT. parity/receipts/v1/CANVAS-CENSUS.md — byte-stable (no
 *     dates; rows in manifest order), one row per set: library, id,
 *     archetype, variants rendered, code-render state, canvas state, verdict,
 *     walls.
 *
 * FALSIFICATION (`--self-test`, run in CI right after the gate): the gate is
 * run against a temp copy of the census with (a) one row's code-render.json
 * deleted, (b) one manifest row deleted while its contract still exists,
 * (c) the real census in `--phase full` with the canvas half pending. All
 * three must go red naming the row; a gate that cannot go red is not a gate.
 *
 * ===========================================================================
 * THE CANVAS-HALF RECIPE — for the agent that owns the console bridge
 * ===========================================================================
 * File: the Scratch Project byMp6lt0Ij9b2QbkDGFwBh (the ONLY writable Figma
 * file). Both halves meet on the file names below; do not invent others.
 *
 *  0. `npm run census:check -- --phase code` must be green first (the
 *     denominator and the code PNGs you will sit beside are committed).
 *  1. PAGE PER LIBRARY — `Census / <library>` for every `libraries[].library`
 *     in census-manifest.json (first-party, altitude, astryx, carbon, fluent,
 *     mui, polaris, shadcn, tailwind). Check for the page before creating it
 *     (figma.root.children.find by name); never duplicate.
 *  2. TOKENS FIRST, PER LIBRARY — run the library's token script through the
 *     bridge on that page's file: figma-sync/01-tokens.js for first-party,
 *     examples/<lib>/figma/00-tokens.figma.js for each example library. The
 *     committed scripts carry a WRONG-FILE guard on the anchored fileKey; re-
 *     emit into a scratch directory with FIGMA_FILE_KEY=byMp6lt0Ij9b2QbkDGFwBh
 *     (`npm run figma:plan` for first-party; each library's documented
 *     `figma:fresh` rebuild recipe) and run THOSE bytes — never commit the
 *     re-emitted scripts, never edit the committed ones.
 *  3. SET PER CONTRACT — for every manifest row, in manifest order, run the
 *     row's `figmaScriptPath` (re-emitted as in step 2) with the library's
 *     page current. The set must carry the ds_contracts/contractId marker
 *     equal to the row id; record the set nodeId in verdict.json.
 *  4. SCREENSHOT PER SAMPLED VARIANT — open the row's code-render.json; for
 *     every `variants[]` entry with status "rendered", find the COMPONENT
 *     child of the set whose name equals `variant` (the compiled Figma
 *     variant name, e.g. "Variant=Primary, Size=Medium") and take
 *     `figma_take_screenshot` of that node at scale 2; save it as
 *     `canvas-<slug>.png` in the SAME directory as `code-<slug>.png`. If the
 *     drawn set has no such variant (a curated canvas projection — e.g.
 *     polaris.text draws 55 of 23,232 cells), write no PNG and name it in
 *     verdict.walls as `CANVAS-PROJECTION:<variant>`.
 *  5. ROUND TRIP — dump the set (extract/figma/dump.plugin.js through the
 *     bridge → extract/figma/fixtures/census-<lib>-<id>.dump.json), propose
 *     (`npm run extract:figma -- <dump>`), diff the proposal against the
 *     committed contract (`npm run channel-diff:check` machinery /
 *     `ds-contracts diff`), and record the outcome in verdict.json
 *     `roundTrip: { dumpPath, matched, diverged: [fact…], lost: [fact…] }`.
 *  6. VERDICT — write verdict.json per row:
 *       { "recognisable": true | false | "unscored",
 *         "walls": ["<CODE>", …],          // REQUIRED non-empty when false
 *         "notes": "<what differs, in words>",
 *         "reviewedAt": "<commit sha the PNGs were taken at>",
 *         "setNodeId": "<nodeId>", "roundTrip": { … } }
 *     "recognisable" is the owner's bar: "I can tell what this is" looking at
 *     canvas-<slug>.png beside code-<slug>.png. Every difference is either a
 *     named wall code (FC-FONT-SUBSTRATE, CANVAS-PROJECTION:<variant>,
 *     CODE-ONLY-FACT:<part>/<channel>, STATE-DRIVER:<state>, …) or a defect
 *     to fix before the verdict is written.
 *  7. `npm run census:check -- --phase full` green, then flip the fast-lane
 *     step in .github/workflows/fast.yml from `--phase code` to `--phase full`.
 */
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  CENSUS_DIR,
  MANIFEST_PATH,
  RECEIPT_PATH,
  REPO,
  enumerateCorpus,
  type CensusManifest,
  type ManifestRow,
} from "../extract/figma/census/corpus.js";
import type { CodeRenderReceipt } from "../extract/figma/census/render.js";
import {
  D2C_DIR,
  D2C_KITS,
  D2C_RECEIPT_PATH,
  rowJson,
  runKit,
  stableRow,
  type D2cKitRun,
} from "../extract/figma/census/design-to-code.js";
import type { D2cRenderReceipt } from "../extract/figma/census/d2c-render.js";

type Phase = "code" | "full" | "design-to-code";

interface Verdict {
  recognisable: true | false | "unscored";
  walls?: string[];
  notes?: string;
  reviewedAt?: string;
  setNodeId?: string;
  roundTrip?: Record<string, unknown>;
}

interface RowState {
  row: ManifestRow;
  codeState: string;
  canvasState: string;
  verdictState: string;
  walls: string;
  rendered: string;
  failures: string[];
}

interface RunOptions {
  phase: Phase;
  manifestPath: string;
  censusDir: string;
  /** null = do not write the receipt (self-test). */
  receiptPath: string | null;
  quiet?: boolean;
}

interface RunResult {
  ok: boolean;
  failures: string[];
  rows: RowState[];
  receipt: string;
}

const readJson = <T>(p: string): T => JSON.parse(readFileSync(p, "utf8")) as T;

const stable = (m: CensusManifest): string => JSON.stringify(m, null, 2) + "\n";

// ---------------------------------------------------------------------------
// The denominator
// ---------------------------------------------------------------------------

function checkManifest(
  fresh: CensusManifest,
  manifestPath: string,
): { failures: string[]; committed: CensusManifest | null } {
  const failures: string[] = [];
  if (!existsSync(manifestPath)) {
    failures.push(
      `${path.relative(REPO, manifestPath)} is missing — run \`npm run census:check -- --write-manifest\``,
    );
    return { failures, committed: null };
  }
  const committed = readJson<CensusManifest>(manifestPath);
  const committedIds = new Set(
    (committed.rows ?? []).map((r) => `${r.library}/${r.id}`),
  );
  const freshIds = new Set(fresh.rows.map((r) => `${r.library}/${r.id}`));
  for (const r of fresh.rows) {
    if (!committedIds.has(`${r.library}/${r.id}`)) {
      failures.push(
        `DENOMINATOR: ${r.contractPath} (${r.id}) exists but is not a manifest row — a contract cannot leave the census silently; run --write-manifest`,
      );
    }
  }
  for (const r of committed.rows ?? []) {
    if (!freshIds.has(`${r.library}/${r.id}`)) {
      failures.push(
        `DENOMINATOR: manifest row ${r.library}/${r.id} names ${r.contractPath}, which no longer qualifies (missing, or its Figma script is gone) — run --write-manifest`,
      );
    }
  }
  if (failures.length === 0 && stable(committed) !== stable(fresh)) {
    const changed = fresh.rows
      .filter(
        (r) =>
          JSON.stringify(r) !==
          JSON.stringify(
            (committed.rows ?? []).find(
              (c) => c.library === r.library && c.id === r.id,
            ),
          ),
      )
      .map((r) => `${r.library}/${r.id}`);
    failures.push(
      `DENOMINATOR: the committed manifest is stale (${changed.length > 0 ? `rows changed: ${changed.join(", ")}` : "header/libraries/excluded changed"}) — run --write-manifest and commit it`,
    );
  }
  return { failures, committed };
}

// ---------------------------------------------------------------------------
// The rows
// ---------------------------------------------------------------------------

function rowState(row: ManifestRow, phase: Phase, censusDir: string): RowState {
  const dir = path.join(censusDir, row.library, row.id);
  const who = `${row.library}/${row.id}`;
  const failures: string[] = [];
  const state: RowState = {
    row,
    codeState: "",
    canvasState: "PENDING",
    verdictState: "PENDING",
    walls: "—",
    rendered: "—",
    failures,
  };

  const receiptPath = path.join(dir, "code-render.json");
  if (!existsSync(receiptPath)) {
    state.codeState = "MISSING";
    failures.push(
      `${who}: no code render (${path.relative(REPO, receiptPath)} is missing — run \`npx tsx extract/figma/census/render.ts --library ${row.library} --id ${row.id}\`)`,
    );
    return state;
  }
  const receipt = readJson<CodeRenderReceipt>(receiptPath);
  if (receipt.id !== row.id)
    failures.push(`${who}: code-render.json carries id ${receipt.id}`);
  if (receipt.unavailable) {
    state.codeState = `UNAVAILABLE (${receipt.unavailable})`;
    failures.push(`${who}: code render UNAVAILABLE — ${receipt.unavailable}`);
    return state;
  }
  const renderedVariants = receipt.variants.filter(
    (v) => v.status === "rendered",
  );
  const missingPng = renderedVariants
    .filter((v) => !v.png || !existsSync(path.join(dir, v.png)))
    .map((v) => v.png ?? v.slug);
  if (missingPng.length > 0) {
    failures.push(
      `${who}: code-render.json names PNGs that are not on disk: ${missingPng.join(", ")}`,
    );
  }
  const capNote =
    receipt.sample.cap.dropped > 0
      ? `, cap ${receipt.sample.cap.limit} dropped ${receipt.sample.cap.dropped}`
      : "";
  const axisNote = receipt.sample.axisCoverageComplete
    ? ""
    : ", axis coverage INCOMPLETE";
  state.rendered = `${receipt.rendered}/${receipt.variants.length} of ${receipt.sample.cap.derived}${capNote}${axisNote}`;
  state.codeState =
    missingPng.length > 0
      ? `MISSING PNG (${missingPng.length})`
      : receipt.refused > 0
        ? `rendered, ${receipt.refused} refused${receipt.fontChecks.Inter === false ? ", Inter unavailable" : ""}`
        : `rendered${receipt.fontChecks.Inter === false ? ", Inter unavailable" : ""}`;

  // Canvas half.
  const canvasPresent = renderedVariants.filter((v) =>
    existsSync(path.join(dir, `canvas-${v.slug}.png`)),
  );
  const verdictPath = path.join(dir, "verdict.json");
  const verdict = existsSync(verdictPath)
    ? readJson<Verdict>(verdictPath)
    : null;
  const projected = new Set(
    (verdict?.walls ?? [])
      .filter((w) => w.startsWith("CANVAS-PROJECTION:"))
      .map((w) => w.slice("CANVAS-PROJECTION:".length)),
  );
  const canvasMissing = renderedVariants.filter(
    (v) =>
      !existsSync(path.join(dir, `canvas-${v.slug}.png`)) &&
      !projected.has(v.variant),
  );
  if (canvasPresent.length === 0 && projected.size === 0)
    state.canvasState = "PENDING";
  else if (canvasMissing.length === 0)
    state.canvasState = `${canvasPresent.length}/${renderedVariants.length}${projected.size ? ` (+${projected.size} projected out)` : ""}`;
  else
    state.canvasState = `${canvasPresent.length}/${renderedVariants.length} — ${canvasMissing.length} missing`;

  if (verdict) {
    const walls = verdict.walls ?? [];
    state.walls = walls.length > 0 ? walls.join("; ") : "—";
    if (verdict.recognisable === true) state.verdictState = "recognisable";
    else if (verdict.recognisable === false)
      state.verdictState = "NOT recognisable";
    else state.verdictState = "unscored";
    if (verdict.recognisable === false && walls.length === 0) {
      failures.push(
        `${who}: verdict says NOT recognisable but names no wall — every difference must be a named wall or a fixed defect`,
      );
    }
  }

  if (phase === "full") {
    if (canvasMissing.length > 0) {
      failures.push(
        `${who}: no canvas PNG for ${canvasMissing.length} sampled variant(s): ${canvasMissing.map((v) => `canvas-${v.slug}.png`).join(", ")}`,
      );
    }
    if (!verdict) failures.push(`${who}: no verdict.json`);
    else if (verdict.recognisable !== true && verdict.recognisable !== false)
      failures.push(`${who}: verdict is unscored`);
  }
  return state;
}

// ---------------------------------------------------------------------------
// The receipt
// ---------------------------------------------------------------------------

function renderReceipt(
  manifest: CensusManifest,
  rows: RowState[],
  phase: Phase,
  failures: string[],
): string {
  const esc = (s: string) => s.replace(/\|/g, "\\|");
  const byLib = new Map<string, RowState[]>();
  for (const r of rows)
    (
      byLib.get(r.row.library) ??
      byLib.set(r.row.library, []).get(r.row.library)!
    ).push(r);
  const lines: string[] = [];
  lines.push("# Canvas census — the denominator is every committed contract");
  lines.push("");
  lines.push(
    "GENERATED by `npm run census:check` (scripts/canvas-census-check.ts) — do not edit. Byte-stable: rows in manifest order, no dates.",
  );
  lines.push("");
  lines.push(
    `**Phase: \`${phase}\`.** ${phase === "code" ? "Canvas columns may read PENDING; the denominator and the code half are held." : "Every column is held."}`,
  );
  lines.push("");
  lines.push("## The bar");
  lines.push("");
  lines.push(
    'Owner, 2026-08-23: *"generate canvas Figma designs from contracts; the contract mediates and adjudicates the code and the canvas."* ' +
      "v1 is done when, for EVERY committed contract in the corpus, (1) contract → canvas mints a recognisable set (screenshot beside the code render; " +
      "differences only named walls), (2) dump → propose round-trips to the same contract, (3) code and canvas agree on every carried fact.",
  );
  lines.push("");
  lines.push("## The denominator");
  lines.push("");
  lines.push(
    `\`parity/receipts/v1/census-manifest.json\` — ${manifest.rows.length} sets across ${manifest.libraries.length} libraries. ` +
      `Rule: ${manifest.rule} The gate regenerates the manifest on every run and refuses when the committed file disagrees, so a contract cannot leave the census silently.`,
  );
  lines.push("");
  lines.push("| library | contracts dir | figma scripts | bundle | sets |");
  lines.push("|---|---|---|---|---|");
  for (const l of manifest.libraries)
    lines.push(
      `| ${l.library} | ${l.contractsDir} | ${l.figmaDir} | ${l.bundlePath ?? "— (built on demand: core/first-party-bundle-check.ts)"} | ${l.contracts} |`,
    );
  lines.push("");
  lines.push("Named exclusions (not in the denominator, and why):");
  lines.push("");
  for (const e of manifest.excluded)
    lines.push(`- \`${e.what}\` — ${e.reason}`);
  lines.push("");
  lines.push("## The sample");
  lines.push("");
  lines.push(`${manifest.sampleRule} Cap: ${manifest.sampleCap} per set.`);
  lines.push("");
  lines.push(
    "Code half: `parity/receipts/v1/census/<lib>/<id>/code-<slug>.png` + `code-render.json` (extract/figma/census/render.ts — core/emit-html.ts staged by the catalog gate's " +
      "buildCssCellDoc, captured by the canvas gate's captureCell at dpr 2; first-party over tokens/, example libraries over the committed `<lib>.bundle.json` tokenSet — the layer the plugin compiles a paste from).",
  );
  lines.push("");
  lines.push("## The canvas-half recipe");
  lines.push("");
  lines.push(
    "Scratch file `byMp6lt0Ij9b2QbkDGFwBh` (the only writable file). Page per library (`Census / <library>`); tokens script first, then the row's `figmaScriptPath` re-emitted with " +
      "`FIGMA_FILE_KEY=byMp6lt0Ij9b2QbkDGFwBh` through the console bridge; for every `variants[]` entry in the row's `code-render.json` with status `rendered`, " +
      "`figma_take_screenshot` of the COMPONENT child named `variant` at scale 2 → `canvas-<slug>.png` beside `code-<slug>.png`; a variant the drawn set does not carry is a " +
      "`CANVAS-PROJECTION:<variant>` wall, not a missing file; dump → propose → diff for the adjudication column; then `verdict.json` " +
      '`{ recognisable: true|false|"unscored", walls: [codes], notes, reviewedAt: <commit>, setNodeId, roundTrip }`. The full recipe with every step is the header of ' +
      "`scripts/canvas-census-check.ts`. Then `npm run census:check -- --phase full` and flip the fast-lane step to `--phase full`.",
  );
  lines.push("");
  lines.push("## Tally");
  lines.push("");
  const tally = (pred: (r: RowState) => boolean) => rows.filter(pred).length;
  lines.push(
    "| library | sets | code rendered | code UNAVAILABLE / MISSING | canvas complete | verdict recognisable | verdict NOT recognisable | verdict pending/unscored |",
  );
  lines.push("|---|---|---|---|---|---|---|---|");
  for (const [lib, rs] of byLib) {
    lines.push(
      `| ${lib} | ${rs.length} | ${rs.filter((r) => r.codeState.startsWith("rendered")).length} | ${rs.filter((r) => !r.codeState.startsWith("rendered")).length} | ` +
        `${rs.filter((r) => r.canvasState !== "PENDING" && !r.canvasState.includes("missing")).length} | ${rs.filter((r) => r.verdictState === "recognisable").length} | ` +
        `${rs.filter((r) => r.verdictState === "NOT recognisable").length} | ${rs.filter((r) => r.verdictState === "PENDING" || r.verdictState === "unscored").length} |`,
    );
  }
  lines.push(
    `| **all** | ${rows.length} | ${tally((r) => r.codeState.startsWith("rendered"))} | ${tally((r) => !r.codeState.startsWith("rendered"))} | ` +
      `${tally((r) => r.canvasState !== "PENDING" && !r.canvasState.includes("missing"))} | ${tally((r) => r.verdictState === "recognisable")} | ` +
      `${tally((r) => r.verdictState === "NOT recognisable")} | ${tally((r) => r.verdictState === "PENDING" || r.verdictState === "unscored")} |`,
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
    "| library | id | archetype | axes × variants (compiled; script rows) | variants rendered | code-render | canvas | verdict | walls |",
  );
  lines.push("|---|---|---|---|---|---|---|---|---|");
  for (const r of rows) {
    const m = r.row;
    const compiled =
      m.variantCount === null
        ? `compile refused`
        : `${m.variantAxes} × ${m.variantCount}${m.stateVariantCount ? ` + ${m.stateVariantCount} state` : ""}; ${m.scriptVariantRows}`;
    lines.push(
      `| ${m.library} | \`${m.id}\` | ${m.archetype} | ${compiled} | ${r.rendered} | ${esc(r.codeState)} | ${esc(r.canvasState)} | ${esc(r.verdictState)} | ${esc(r.walls)} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export function runCensus(opts: RunOptions, fresh?: CensusManifest): RunResult {
  const manifest = fresh ?? enumerateCorpus().manifest;
  const { failures: denominator, committed } = checkManifest(
    manifest,
    opts.manifestPath,
  );
  const failures = [...denominator];
  // Rows are held against the COMMITTED manifest when it exists (the reader's
  // denominator), else the fresh one — both are reported either way.
  const rowsSource = committed ?? manifest;
  const rows = (rowsSource.rows ?? []).map((r) =>
    rowState(r, opts.phase, opts.censusDir),
  );
  for (const r of rows) failures.push(...r.failures);
  const receipt = renderReceipt(rowsSource, rows, opts.phase, failures);
  if (opts.receiptPath) writeFileSync(opts.receiptPath, receipt);
  return { ok: failures.length === 0, failures, rows, receipt };
}

function selfTest(): number {
  const { manifest } = enumerateCorpus();
  const base = path.join(REPO, CENSUS_DIR);
  const manifestPath = path.join(REPO, MANIFEST_PATH);
  const tmp = mkdtempSync(path.join(tmpdir(), "census-self-test-"));
  const problems: string[] = [];
  try {
    // The real census must be green at --phase code before a planted red means anything.
    const real = runCensus(
      {
        phase: "code",
        manifestPath,
        censusDir: base,
        receiptPath: null,
        quiet: true,
      },
      manifest,
    );
    if (!real.ok) {
      problems.push(
        `self-test precondition: the real census is not green at --phase code (${real.failures[0]})`,
      );
    }
    const victim = manifest.rows[Math.floor(manifest.rows.length / 2)];

    // (a) one row's code-render.json deleted → red, naming the row.
    const censusA = path.join(tmp, "census-a");
    cpSync(base, censusA, { recursive: true });
    rmSync(path.join(censusA, victim.library, victim.id, "code-render.json"));
    const a = runCensus(
      {
        phase: "code",
        manifestPath,
        censusDir: censusA,
        receiptPath: null,
        quiet: true,
      },
      manifest,
    );
    if (
      a.ok ||
      !a.failures.some((f) =>
        f.startsWith(`${victim.library}/${victim.id}: no code render`),
      )
    ) {
      problems.push(
        `(a) deleting ${victim.library}/${victim.id}/code-render.json did not turn the gate red by name`,
      );
    }

    // (b) one manifest row deleted while its contract exists → denominator refusal, naming the contract.
    const manifestB = path.join(tmp, "census-manifest-b.json");
    writeFileSync(
      manifestB,
      stable({ ...manifest, rows: manifest.rows.filter((r) => r !== victim) }),
    );
    const b = runCensus(
      {
        phase: "code",
        manifestPath: manifestB,
        censusDir: base,
        receiptPath: null,
        quiet: true,
      },
      manifest,
    );
    if (
      b.ok ||
      !b.failures.some(
        (f) => f.startsWith("DENOMINATOR:") && f.includes(victim.contractPath),
      )
    ) {
      problems.push(
        `(b) removing the manifest row for ${victim.contractPath} did not refuse by name`,
      );
    }

    // (c) --phase full with the canvas half pending → red on the first pending row.
    const c = runCensus(
      {
        phase: "full",
        manifestPath,
        censusDir: base,
        receiptPath: null,
        quiet: true,
      },
      manifest,
    );
    const pendingRow = c.rows.find(
      (r) =>
        r.canvasState === "PENDING" ||
        r.verdictState === "PENDING" ||
        r.verdictState === "unscored",
    );
    if (
      pendingRow &&
      (c.ok ||
        !c.failures.some((f) =>
          f.startsWith(`${pendingRow.row.library}/${pendingRow.row.id}:`),
        ))
    ) {
      problems.push(
        `(c) --phase full with ${pendingRow.row.library}/${pendingRow.row.id} pending did not go red by name`,
      );
    }
    if (!pendingRow && !c.ok)
      problems.push(
        `(c) --phase full is red with nothing pending: ${c.failures[0]}`,
      );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  if (problems.length > 0) {
    console.error(
      `✘ census self-test FAILED:\n${problems.map((p) => `  - ${p}`).join("\n")}`,
    );
    return 1;
  }
  console.log(
    "✔ census self-test: (a) deleted code render → red by name; (b) contract outside the manifest → denominator refusal; (c) --phase full with canvas pending → red by name",
  );
  return 0;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const phaseArg = argv[argv.indexOf("--phase") + 1];
  const phase: Phase = argv.includes("--phase") ? (phaseArg as Phase) : "full";
  if (phase !== "code" && phase !== "full" && phase !== "design-to-code") {
    console.error(
      `✘ --phase must be code, full or design-to-code (got ${JSON.stringify(phaseArg)})`,
    );
    return 2;
  }
  if (argv.includes("--self-test")) return selfTest();
  if (phase === "design-to-code") return runDesignToCode();
  const manifestPath = path.join(REPO, MANIFEST_PATH);
  const { manifest } = enumerateCorpus();
  if (argv.includes("--write-manifest")) {
    writeFileSync(manifestPath, stable(manifest));
    console.log(
      `wrote ${MANIFEST_PATH}: ${manifest.rows.length} sets, ${manifest.libraries.length} libraries, ${manifest.excluded.length} named exclusions`,
    );
  }
  const result = runCensus(
    {
      phase,
      manifestPath,
      censusDir: path.join(REPO, CENSUS_DIR),
      receiptPath: path.join(REPO, RECEIPT_PATH),
    },
    manifest,
  );
  const libs = manifest.libraries
    .map((l) => `${l.library} ${l.contracts}`)
    .join(", ");
  console.log(`census (${phase}): ${manifest.rows.length} sets — ${libs}`);
  const rendered = result.rows.filter((r) =>
    r.codeState.startsWith("rendered"),
  ).length;
  const canvas = result.rows.filter((r) => r.canvasState !== "PENDING").length;
  const scored = result.rows.filter(
    (r) =>
      r.verdictState === "recognisable" ||
      r.verdictState === "NOT recognisable",
  ).length;
  console.log(
    `  code rendered ${rendered}/${result.rows.length}; canvas ${canvas}/${result.rows.length}; verdict scored ${scored}/${result.rows.length}; receipt ${RECEIPT_PATH}`,
  );
  if (!result.ok) {
    console.error(
      `✘ census gate RED — ${result.failures.length} failure(s):\n${result.failures.map((f) => `  - ${f}`).join("\n")}`,
    );
    return 1;
  }
  console.log("✔ census gate green");
  return 0;
}

// ---------------------------------------------------------------------------
// PHASE design-to-code — the reverse direction on the two designer kits.
// The pipeline (map → propose → validate → generate React + WC + stories) is
// RE-RUN in memory from the committed fixtures, twice, and the gate holds:
//   · the manifest designToCode section (denominator — checkManifest above);
//   · byte-idempotence (propose twice + generate twice, sha-identical);
//   · SILENT = 0 (every canvas fact carried or named — d2c-facts.ts);
//   · every committed d2c.json equals the recomputed row (engine drift is a
//     named refusal, the remedy `npx tsx extract/figma/census/design-to-code.ts --write`);
//   · every sampled render pair exists (canvas-<slug>.png beside
//     code-<slug>.png per d2c-render.ts render.json) with a scored verdict;
//   · the receipt parity/receipts/v1/DESIGN-TO-CODE-CENSUS.md is re-rendered
//     byte-stable.
// ---------------------------------------------------------------------------

interface D2cVerdict {
  recognisable: true | false | "unscored";
  walls?: string[];
  notes?: string;
}

async function runDesignToCode(): Promise<number> {
  const failures: string[] = [];
  const { manifest } = enumerateCorpus();
  const manifestPath = path.join(REPO, MANIFEST_PATH);
  failures.push(...checkManifest(manifest, manifestPath).failures);

  const runs: D2cKitRun[] = [];
  for (const def of D2C_KITS) {
    // The manifest mirror must agree with the pipeline's kit table.
    const mk = manifest.designToCode.kits.find((k) => k.kit === def.kit);
    if (!mk || mk.fileKey !== def.fileKey || mk.mode !== def.mode) {
      failures.push(
        `design-to-code: manifest kit "${def.kit}" disagrees with design-to-code.ts (corpus.ts D2C_MANIFEST_KITS is a mirror — keep them equal)`,
      );
    }
    let run: D2cKitRun;
    try {
      run = await runKit(def);
    } catch (e) {
      failures.push(
        `design-to-code ${def.kit}: pipeline refused — ${(e as Error).message.split("\n")[0]}`,
      );
      continue;
    }
    runs.push(run);
    if (!run.idempotent.propose)
      failures.push(
        `design-to-code ${def.kit}: propose is NOT byte-idempotent across two runs`,
      );
    if (!run.idempotent.generate)
      failures.push(
        `design-to-code ${def.kit}: generate is NOT byte-idempotent across two runs (${run.idempotent.detail})`,
      );
    for (const set of run.sets) {
      const who = `${def.kit}/${set.id}`;
      for (const r of set.account.rows) {
        if (r.disposition === "SILENT")
          failures.push(
            `${who}: SILENT canvas fact — ${r.path} · ${r.channel} · ${r.value} (no landing, no receipt; fix at the cause in map/propose/generate)`,
          );
      }
      const dir = path.join(REPO, D2C_DIR, def.kit, set.id);
      const rowPath = path.join(dir, "d2c.json");
      const fresh = stableRow(rowJson(run, set));
      if (!existsSync(rowPath)) {
        failures.push(
          `${who}: no committed row (${path.relative(REPO, rowPath)}) — run \`npx tsx extract/figma/census/design-to-code.ts --write\``,
        );
      } else if (readFileSync(rowPath, "utf8") !== fresh) {
        failures.push(
          `${who}: committed d2c.json is STALE vs the engine's recomputed row — run \`npx tsx extract/figma/census/design-to-code.ts --write\` and review the diff`,
        );
      }
      const renderPath = path.join(dir, "render.json");
      if (!existsSync(renderPath)) {
        failures.push(
          `${who}: no render receipt (${path.relative(REPO, renderPath)}) — run \`npx tsx extract/figma/census/d2c-render.ts\` (REST image export + Playwright)`,
        );
      } else {
        const render = readJson<D2cRenderReceipt>(renderPath);
        if (render.cells.length === 0)
          failures.push(
            `${who}: render.json samples ZERO cells — nothing paired; re-run d2c-render.ts`,
          );
        for (const cell of render.cells) {
          for (const side of ["canvas", "code"] as const) {
            const png = path.join(dir, `${side}-${cell.slug}.png`);
            if (!existsSync(png))
              failures.push(
                `${who}: missing ${side}-${cell.slug}.png for sampled cell "${cell.figmaVariant}"`,
              );
          }
        }
      }
      const verdictPath = path.join(dir, "verdict.json");
      if (!existsSync(verdictPath)) failures.push(`${who}: no verdict.json`);
      else {
        const v = readJson<D2cVerdict>(verdictPath);
        if (v.recognisable !== true && v.recognisable !== false)
          failures.push(`${who}: verdict is unscored`);
        if (v.recognisable === false && (v.walls ?? []).length === 0)
          failures.push(
            `${who}: verdict says NOT recognisable but names no wall`,
          );
      }
    }
  }

  const receipt = renderD2cReceipt(manifest, runs, failures);
  writeFileSync(path.join(REPO, D2C_RECEIPT_PATH), receipt);
  const sets = runs.reduce((n, r) => n + r.sets.length, 0);
  const carried = runs.reduce(
    (n, r) => n + r.sets.reduce((m, s) => m + s.account.carried, 0),
    0,
  );
  const named = runs.reduce(
    (n, r) => n + r.sets.reduce((m, s) => m + s.account.named, 0),
    0,
  );
  const silent = runs.reduce(
    (n, r) => n + r.sets.reduce((m, s) => m + s.account.silent, 0),
    0,
  );
  console.log(
    `census (design-to-code): ${sets} canvas sets — ${carried} facts carried · ${named} named · ${silent} SILENT; receipt ${D2C_RECEIPT_PATH}`,
  );
  if (failures.length > 0) {
    console.error(
      `✘ design-to-code census RED — ${failures.length} failure(s):\n${failures.map((f) => `  - ${f}`).join("\n")}`,
    );
    return 1;
  }
  console.log("✔ design-to-code census green");
  return 0;
}

function renderD2cReceipt(
  manifest: CensusManifest,
  runs: D2cKitRun[],
  failures: string[],
): string {
  const esc = (x: string) => x.replace(/\|/g, "\\|");
  const L: string[] = [];
  L.push(
    "# Design→code census — canvas sets → contracts → React/WC, deterministic",
  );
  L.push("");
  L.push(
    "GENERATED by `npm run census:check -- --phase design-to-code` (scripts/canvas-census-check.ts) — do not edit. Byte-stable: no dates; rows in kit/manifest order.",
  );
  L.push("");
  L.push("## The bar");
  L.push("");
  L.push(
    'Owner, verbatim: *"seamlessly transition a designed component, along with all its properties and metadata, to a coded component without using AI. A deterministic way of creating something from design to code."* ' +
      "Pass condition: every Figma-side fact on every set is CARRIED into the contract (and on into the generated code) or NAMED by a receipt — **SILENT = 0** — and the whole pipeline is byte-deterministic.",
  );
  L.push("");
  L.push("## The designer's CLI sequence (what these numbers measure)");
  L.push("");
  L.push("```");
  L.push("# 1. dump the canvas over REST (read-only; FIGMA_TOKEN)");
  L.push(
    "npm run extract:figma:rest -- https://www.figma.com/design/<fileKey> --out dump.json",
  );
  L.push("# 2. propose contracts from the dump (exact mode for a stamped kit;");
  L.push("#    add --reviewable-inversion for a foreign kit, with ITS tokens)");
  L.push(
    "npm run extract:figma -- dump.json --out proposed --tokens <kit dtcg files>",
  );
  L.push("# 3. generate the code — React + stories, then Web Components");
  L.push(
    "npx ds-contracts generate proposed/*.contract.proposed.json --out src \\",
  );
  L.push("  --stories --tokens <kit dtcg files>,proposed/minted.dtcg.json");
  L.push(
    "npx ds-contracts generate proposed/*.contract.proposed.json --out wc \\",
  );
  L.push(
    "  --target web-components --emitter @ds-contracts/emitter-web-components \\",
  );
  L.push("  --tokens <kit dtcg files>,proposed/minted.dtcg.json");
  L.push("```");
  L.push("");
  L.push(
    "The gate re-runs exactly this pipeline in memory from the committed fixtures (`extract/figma/fixtures/census-d2c/`, capture provenance in `<kit>.capture.json`) — no network, no hands.",
  );
  L.push("");
  L.push("## Kits");
  L.push("");
  L.push("| kit | file | mode | sets | fixture |");
  L.push("|---|---|---|---|---|");
  for (const k of manifest.designToCode.kits)
    L.push(
      `| ${k.kit} | \`${k.fileKey}\` | ${k.mode} | ${k.sets} | \`${k.fixture}\` |`,
    );
  L.push("");
  L.push("## Determinism — the idempotence proof");
  L.push("");
  for (const r of runs) {
    L.push(
      `- **${r.def.kit}**: propose twice → byte-identical: **${r.idempotent.propose}**; generate twice (React + stories + WC, every file sha256-compared) → identical: **${r.idempotent.generate}**. ` +
        `React ${r.generatedCount.react} component(s) + WC ${r.generatedCount.wc}; per-file sha256 pinned in each row's d2c.json — engine drift flips this gate red by name.` +
        (r.mintedPruned.length > 0
          ? ` Minted-tree prune: ${r.mintedPruned.length} freshly-minted leaf/leaves already defined by the kit corpus were dropped (the corpus value wins; REST rounds geometry to 2dp): ${r.mintedPruned.slice(0, 4).join(", ")}${r.mintedPruned.length > 4 ? ", …" : ""}.`
          : ""),
    );
  }
  L.push("");
  L.push("## Carriage — every Figma-side fact, accounted");
  L.push("");
  L.push(
    "Denominator: the raw REST node documents (variant axes + values, component properties, descriptions, documentation links, variable bindings, layout/auto-layout, text, paints, effects, prototype wiring, instance internals as one fact, the ds_contracts stamps). " +
      "Full per-row tables with landings ride each set's `d2c.json` (`channels`, `api`, `silentRows`).",
  );
  L.push("");
  L.push(
    "| kit | id | set | variants | carried | named | SILENT | verdict | walls |",
  );
  L.push("|---|---|---|---|---|---|---|---|---|");
  for (const r of runs) {
    for (const set of r.sets) {
      const dir = path.join(REPO, D2C_DIR, r.def.kit, set.id);
      const verdictPath = path.join(dir, "verdict.json");
      let verdict = "PENDING";
      let walls = "—";
      if (existsSync(verdictPath)) {
        const v = readJson<D2cVerdict>(verdictPath);
        verdict =
          v.recognisable === true
            ? "recognisable"
            : v.recognisable === false
              ? "NOT recognisable"
              : "unscored";
        walls = (v.walls ?? []).length > 0 ? (v.walls ?? []).join("; ") : "—";
      }
      L.push(
        `| ${r.def.kit} | \`${set.id}\` | ${esc(set.setName)} | ${set.variantCount} | ${set.account.carried} | ${set.account.named} | ${set.account.silent} | ${esc(verdict)} | ${esc(walls)} |`,
      );
    }
  }
  const carried = runs.reduce(
    (n, r) => n + r.sets.reduce((m, s) => m + s.account.carried, 0),
    0,
  );
  const named = runs.reduce(
    (n, r) => n + r.sets.reduce((m, s) => m + s.account.named, 0),
    0,
  );
  const silent = runs.reduce(
    (n, r) => n + r.sets.reduce((m, s) => m + s.account.silent, 0),
    0,
  );
  const sets = runs.reduce((n, r) => n + r.sets.length, 0);
  L.push(
    `| **all** | | ${sets} sets | | **${carried}** | **${named}** | **${silent}** | | |`,
  );
  L.push("");
  L.push("## Renders");
  L.push("");
  L.push(
    "Pairs under `parity/receipts/v1/census/design-to-code/<kit>/<id>/` — `canvas-<slug>.png` (Figma's own `/v1/images?scale=2` export, read-only) beside `code-<slug>.png` (the GENERATED React, esbuild-bundled and screenshotted at dpr 2 — extract/figma/census/d2c-render.ts). " +
      "Sample: the all-defaults cell plus every non-default axis value with the others at default; interaction-state planes are CSS pseudo-classes in code and are not sampled as cells (named in each render.json).",
  );
  L.push("");
  L.push(
    `Gate: **${failures.length === 0 ? "GREEN" : `RED — ${failures.length} failure(s)`}**.`,
  );
  if (failures.length > 0) {
    L.push("");
    for (const f of failures) L.push(`- ${esc(f)}`);
  }
  L.push("");
  return L.join("\n");
}

process.exitCode = await main();
