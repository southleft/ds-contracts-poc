/**
 * REGATE DRIFT CHECK — the pin that keeps offline-re-fuse drift from going
 * unnoticed between rounds. Two instruments, one baseline:
 *
 *   npm run extract:computed:drift                  # VERIFY  (fast lane, no browser, <1s)
 *   npm run extract:computed:drift:remeasure        # RE-MEASURE (full lane, Chromium, ~37 min)
 *   npm run extract:computed:drift -- --write       # RE-RECORD: re-measure, then update the
 *                                                   #   baseline AND the tracked regate.scorecard.json
 *   … -- --config extract/computed/configs/mui.json # one library
 *
 * VERIFY reads three committed things per component and refuses when they
 * disagree: the baseline row (regate-baseline.json), the committed offline
 * scorecard (out/<lib>/<comp>/regate.scorecard.json) and the committed
 * harness scorecard (scorecard.json). It is the answer to "do the numbers the
 * docs quote still match the artifacts in the tree" — and it is what a PR
 * lane can run, because it launches nothing and writes nothing.
 *
 * RE-MEASURE re-runs `extract/computed/regate.ts` — the committed captured
 * truth replayed through the CURRENT fusion + emitters in a real headless
 * Chromium — and compares the fresh numbers to the baseline. It writes every
 * artifact into `extract/computed/.drift-remeasure/<lib>/` (gitignored) via
 * regate's `--scorecard-out`; the tracked out/** paths are read only.
 *
 * WHY TWO (docs/23 §D.32). Before 2026-08-23 there was one mode — the
 * re-measure — and it (a) overwrote eleven TRACKED regate.scorecard.json files
 * while running as a "check", (b) was refused outright on a clean clone
 * because one library's font face pointed into a gitignored sandbox, which
 * the check printed as "sweep did not complete", and (c) ran in no CI lane
 * at all, excluded by name. Measured on the recording machine the re-measure
 * is 7–24 s per component (Chromium render of the gate page per variant ×
 * interaction; carbon's Button alone is 21,056 cells), so it is a full-lane
 * step; the verify is the fast-lane twin that holds the committed numbers to
 * the committed artifacts in the meantime.
 *
 * WHAT IT PINS, per component:
 *   · pctEqual within `--tolerance` (default 0.001) of the recorded re-run
 *     value — NOT of the committed harness scorecard. The two are different
 *     instruments (see regate.ts's header) and the honest baseline is the one
 *     this instrument actually produces.
 *   · cellsCompared exactly — a moved denominator is a vocabulary change and
 *     must be acknowledged, never averaged away by a percentage tolerance.
 *   · unresolvedTokenRefs.count exactly — a frozen promoted contract whose
 *     refs the current mint no longer produces renders EMPTY custom
 *     properties; the count is the receipt (gate.ts Scorecard).
 *   · fusion refusals: a component that stops fusing at all is a hard FAIL.
 *   · EVERY component with a committed harness scorecard has a baseline row.
 *     A component that REFUSES to re-fuse is pinned as such (`refused`).
 *     The old check silently skipped components the baseline had never seen
 *     (`if (!prior) continue`) — 39 components (17 mui, 11 fluent, 6 tailwind,
 *     5 astryx) were unpinned that way while the summary said "65 components
 *     match". UNPINNED is a failure.
 *
 * The baseline also carries each component's committed harness pctEqual and
 * the NAMED reason it differs, so the gap is documented where it is measured
 * rather than rediscovered every round (docs/20-regate-drift.md).
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const REPO = path.resolve(HERE, '..', '..');
const BASELINE = path.join(HERE, 'regate-baseline.json');
const SCRATCH = path.join(HERE, '.drift-remeasure');

const arg = (n: string): string | null => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : null;
};
const WRITE = process.argv.includes('--write');
const REMEASURE = WRITE || process.argv.includes('--remeasure');
const TOLERANCE = Number(arg('tolerance') ?? '0.001');
const ONLY_CONFIG = arg('config');

/**
 * The library registry is DERIVED from `extract/computed/configs/*.json`, not
 * listed here. It used to be a hand-written array, which meant adding a config
 * left the instrument silently stale — a library could ship with no drift pin
 * at all and nothing would say so. Deriving it makes "there is a config" and
 * "there is a drift row" the same fact.
 *
 * Two derivations, both from the config itself:
 *   · `name` = the config's own `library.name`, falling back to the file stem.
 *   · `out`  = `extract/computed/out/<name>` when that directory exists; else
 *     the un-namespaced `extract/computed/out` IF that root actually holds
 *     this config's own components (polaris, for the historical reason
 *     regate.ts's `--out` defect note records) — never by name-matching.
 *
 * A config whose components have NO committed harness scorecard anywhere is
 * SKIPPED, and the skip is PRINTED with the config named — never dropped in
 * silence. `polaris-depth.json` is the standing case: a single-component
 * depth receipt sharing polaris's package that writes to
 * `extract/computed/depth/receipts`, so it has no capture output of its own
 * and must not be mapped onto polaris's.
 */
const CONFIG_DIR = path.join(HERE, 'configs');
const OUT_ROOT = path.join(HERE, 'out');

interface Library {
  name: string;
  config: string;
  out: string;
}

function discoverLibraries(): { libraries: Library[]; skipped: string[] } {
  const libraries: Library[] = [];
  const skipped: string[] = [];
  for (const file of readdirSync(CONFIG_DIR).filter((f) => f.endsWith('.json')).sort()) {
    const abs = path.join(CONFIG_DIR, file);
    const cfg = JSON.parse(readFileSync(abs, 'utf8')) as { library?: { name?: string }; components: Array<{ name: string }> };
    const name = cfg.library?.name ?? file.replace(/\.json$/, '');
    const holdsComponents = (dir: string): boolean =>
      cfg.components.some((c) => existsSync(path.join(dir, c.name.toLowerCase(), 'scorecard.json')));
    const namespaced = path.join(OUT_ROOT, name);
    const out = existsSync(namespaced) && holdsComponents(namespaced)
      ? namespaced
      : holdsComponents(OUT_ROOT)
        ? OUT_ROOT
        : null;
    if (out === null) {
      skipped.push(`${file} (library "${name}") — no committed harness scorecard for any of its ${cfg.components.length} component(s), under ${path.relative(REPO, namespaced)} or ${path.relative(REPO, OUT_ROOT)}; nothing to drift from`);
      continue;
    }
    libraries.push({ name, config: path.relative(REPO, abs), out: path.relative(REPO, out) });
  }
  return { libraries, skipped };
}

const { libraries: LIBRARIES, skipped: SKIPPED_CONFIGS } = discoverLibraries();

interface BaselineRow {
  library: string;
  component: string;
  /** the offline instrument's number — what this check pins. */
  rerunPctEqual: number;
  cellsCompared: number;
  unresolvedTokenRefs: number;
  /** the committed harness scorecard's number — context, never the pin. */
  committedPctEqual: number;
  /** CARBON ROUND: per-row tolerance override, in percentage points. Present
   *  ONLY where the offline instrument is measurably not reproducible to the
   *  global 0.001 on that row, and the `gapCause` must say why and quote the
   *  measured spread. This is a widened pin, never a disabled one — the value
   *  is sized to the measured noise, and every engine-change-sized move this
   *  baseline has ever recorded (+1.042, +2.459, +20.155, -3.296) is an order
   *  of magnitude above it, so a real regression still fails. */
  tolerance?: number;
  /** why the two differ, by name. Three forms, all deliberate:
   *   · ''                — they agree, and there is nothing to explain.
   *   · '<CAUSE> …'       — they differ; this names why.
   *   · 'repaired: …'     — they AGREE NOW because a later round closed a gap
   *                         this baseline used to carry. Kept so the history
   *                         is not silently erased by the fix.
   *  A row may also agree on pctEqual while carrying unresolvedTokenRefs > 0;
   *  that is a different defect on the same row and the cause names it (the
   *  astryx rows). Both are printed. */
  gapCause: string;
  /** The component does NOT re-fuse through the current engine: regate.ts
   *  refused it BY NAME (the message, verbatim) and produced no scorecard.
   *  The numeric fields are the LAST successful re-fuse (the committed
   *  regate.scorecard.json), kept so the row still says what the number was.
   *  A recorded refusal is a pinned state: RE-MEASURE fails if the refusal
   *  changes or the component fuses again without a re-record — silence in
   *  either direction is what this field exists to prevent. */
  refused?: string;
}

interface RegateScorecard {
  scorecard: { computed: { pctEqual: number; cellsCompared: number }; unresolvedTokenRefs?: { count: number } };
}

const componentsOf = (configPath: string): string[] => {
  const cfg = JSON.parse(readFileSync(path.join(REPO, configPath), 'utf8')) as { components: Array<{ name: string }> };
  return cfg.components.map((c) => c.name);
};

const readRegate = (file: string) => {
  const rg = JSON.parse(readFileSync(file, 'utf8')) as RegateScorecard;
  return {
    pctEqual: rg.scorecard.computed.pctEqual,
    cellsCompared: rg.scorecard.computed.cellsCompared,
    unresolvedTokenRefs: rg.scorecard.unresolvedTokenRefs?.count ?? 0,
  };
};
const readCommitted = (file: string): number =>
  (JSON.parse(readFileSync(file, 'utf8')) as { computed: { pctEqual: number } }).computed.pctEqual;

const prior: BaselineRow[] = existsSync(BASELINE)
  ? (JSON.parse(readFileSync(BASELINE, 'utf8')) as { rows: BaselineRow[] }).rows
  : [];
const priorBy = new Map<string, BaselineRow>(prior.map((r) => [`${r.library}/${r.component}`, r]));
const selected = LIBRARIES.filter((lib) => !ONLY_CONFIG || path.resolve(REPO, ONLY_CONFIG) === path.resolve(REPO, lib.config));
const fmt = (n: number) => n.toFixed(3);
const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

const rows: BaselineRow[] = [];
const failures: string[] = [];
const seen = new Set<string>();
const started = Date.now();

for (const s of SKIPPED_CONFIGS) process.stdout.write(`  … config SKIPPED: ${s}\n`);
console.log(`\n${REMEASURE ? (WRITE ? 'RE-RECORD' : 'RE-MEASURE') : 'VERIFY'} — ${selected.length} librar${selected.length === 1 ? 'y' : 'ies'} (${selected.map((l) => l.name).join(', ')})`);

if (REMEASURE) rmSync(SCRATCH, { recursive: true, force: true });

for (const lib of selected) {
  const t0 = Date.now();
  /** where this library's fresh offline scorecards are read from: the
   *  re-measure scratch, or (verify) the tracked artifacts themselves. */
  let freshRoot = path.join(REPO, lib.out);
  /** per-component refusals regate printed BY NAME (`REFUSED <Comp>: <why>`) */
  const refusedNow = new Map<string, string>();
  if (REMEASURE) {
    freshRoot = path.join(SCRATCH, lib.name);
    const r = spawnSync('npx', ['tsx', 'extract/computed/regate.ts', '--config', lib.config, '--out', lib.out, '--scorecard-out', path.relative(REPO, freshRoot)], {
      cwd: REPO,
      stdio: ['ignore', 'ignore', 'pipe'],
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    const stderr = r.stderr ?? '';
    for (const m of stderr.matchAll(/^REFUSED ([^:]+): (.+)$/gm)) refusedNow.set(m[1], m[2]);
    // regate exits 1 when any component refused — those are accounted for
    // per component below. Anything else non-zero is the sweep itself dying
    // (browser, fonts, a crash outside the per-component guard), and the
    // refusal's own words are kept so "did not complete" never stands in for
    // the cause.
    if (r.status !== 0 && refusedNow.size === 0) {
      const tail = stderr.split('\n').filter(Boolean).slice(-4).join(' | ').slice(0, 600);
      failures.push(`${lib.name}: regate exited ${r.status ?? r.signal ?? '?'} mid-sweep — ${tail}`);
    }
  }
  const comps = componentsOf(lib.config);
  let counted = 0;
  for (const comp of comps) {
    const dir = path.join(REPO, lib.out, comp.toLowerCase());
    const key = `${lib.name}/${comp}`;
    const scPath = path.join(dir, 'scorecard.json');
    if (!existsSync(scPath)) continue; // never harness-run — nothing to drift from
    seen.add(key);
    counted++;
    const freshPath = path.join(freshRoot, comp.toLowerCase(), 'regate.scorecard.json');
    const trackedPath = path.join(dir, 'regate.scorecard.json');
    const p = priorBy.get(key);
    const committedPctEqual = readCommitted(scPath);
    const refusal = REMEASURE ? refusedNow.get(comp) : p?.refused;
    if (refusal !== undefined) {
      // A refusal BY NAME. The numbers carried are the last successful
      // re-fuse — the committed offline scorecard — never a fabricated zero.
      const last = existsSync(trackedPath) ? readRegate(trackedPath) : p ?? { pctEqual: 0, cellsCompared: 0, unresolvedTokenRefs: 0 };
      const row: BaselineRow = {
        library: lib.name,
        component: comp,
        rerunPctEqual: 'pctEqual' in last ? last.pctEqual : last.rerunPctEqual,
        cellsCompared: last.cellsCompared,
        unresolvedTokenRefs: last.unresolvedTokenRefs,
        committedPctEqual,
        gapCause: p?.gapCause ?? '',
        ...(p?.tolerance !== undefined ? { tolerance: p.tolerance } : {}),
        refused: refusal,
      };
      rows.push(row);
      if (WRITE) continue;
      if (!p) failures.push(`${key}: UNPINNED and REFUSED — ${refusal} (re-record with --write to pin the refusal by name)`);
      else if (!p.refused) failures.push(`${key}: NOT RE-FUSED — the component no longer fuses through the current engine: ${refusal}`);
      else if (p.refused.slice(0, 120) !== refusal.slice(0, 120)) failures.push(`${key}: the recorded refusal CHANGED — was "${p.refused.slice(0, 160)}", now "${refusal.slice(0, 160)}"`);
      continue;
    }
    if (!existsSync(freshPath)) {
      failures.push(
        REMEASURE
          ? `${key}: NOT RE-FUSED — regate produced no scorecard and printed no refusal for it (the library sweep died before this component; see the sweep finding above)`
          : `${key}: no committed offline scorecard at ${path.relative(REPO, trackedPath)} — re-record with --write`,
      );
      continue;
    }
    if (REMEASURE && p?.refused) {
      // A pinned refusal that fuses again is a finding for the RE-MEASURE,
      // and exactly what the RE-RECORD exists to absorb. Until 2026-08-23
      // (docs/23 §D.33) it was pushed as a failure in both modes, and the
      // re-record refuses to write on any failure — so the door the message
      // named ("re-record with --write") could never be opened: a refused
      // row stayed pinned forever. The re-record now prints the move and
      // un-pins the row; what fixed it belongs in the row's gapCause.
      const moved = `${key}: FUSES AGAIN — the baseline pins a refusal ("${p.refused.slice(0, 120)}") but the current engine produced a scorecard (${fmt(readRegate(freshPath).pctEqual)})`;
      if (WRITE) console.log(`  ↺ ${moved} — un-pinned by this re-record; say what fixed it in the row's gapCause`);
      else failures.push(`${moved}; re-record with --write and say what fixed it`);
    }
    const fresh = readRegate(freshPath);
    const row: BaselineRow = {
      library: lib.name,
      component: comp,
      rerunPctEqual: fresh.pctEqual,
      cellsCompared: fresh.cellsCompared,
      unresolvedTokenRefs: fresh.unresolvedTokenRefs,
      committedPctEqual,
      gapCause: p?.gapCause ?? '',
      ...(p?.tolerance !== undefined ? { tolerance: p.tolerance } : {}),
    };
    rows.push(row);
    if (WRITE) continue;
    if (!p) {
      failures.push(`${key}: UNPINNED — a committed harness scorecard with no baseline row (re-record with --write and name any gap)`);
      continue;
    }
    // A row may widen its OWN tolerance (BaselineRow.tolerance) when the
    // offline instrument is measurably not reproducible on it; the widening is
    // carried in the committed baseline next to the reason, never passed on the
    // command line, so it cannot be applied silently to a row that never asked
    // for it. VERIFY compares committed bytes to committed bytes and owes no
    // tolerance at all — the artifact IS what the baseline was recorded from.
    const rowTol = REMEASURE ? (p.tolerance ?? TOLERANCE) : 1e-9;
    if (Math.abs(row.rerunPctEqual - p.rerunPctEqual) > rowTol) {
      failures.push(
        REMEASURE
          ? `${key}: offline pctEqual ${fmt(p.rerunPctEqual)} → ${fmt(row.rerunPctEqual)} (tolerance ${rowTol}${p.tolerance !== undefined ? " — this row's OWN widened tolerance" : ''})`
          : `${key}: baseline says ${fmt(p.rerunPctEqual)} but the committed ${path.relative(REPO, trackedPath)} says ${fmt(row.rerunPctEqual)} — the two committed facts disagree (re-record with --write)`,
      );
    }
    if (row.cellsCompared !== p.cellsCompared) {
      failures.push(`${key}: cellsCompared ${p.cellsCompared} → ${row.cellsCompared} — the compared VOCABULARY moved; a percentage cannot absorb this`);
    }
    if (row.unresolvedTokenRefs !== p.unresolvedTokenRefs) {
      failures.push(`${key}: unresolved token refs ${p.unresolvedTokenRefs} → ${row.unresolvedTokenRefs} — refs the gate renders as EMPTY custom properties`);
    }
    if (Math.abs(committedPctEqual - p.committedPctEqual) > 1e-9) {
      failures.push(`${key}: the committed harness scorecard moved ${fmt(p.committedPctEqual)} → ${fmt(committedPctEqual)} without a baseline re-record`);
    }
    if (REMEASURE && existsSync(trackedPath)) {
      const tracked = readRegate(trackedPath);
      if (Math.abs(tracked.pctEqual - fresh.pctEqual) > 1e-9 || tracked.cellsCompared !== fresh.cellsCompared) {
        failures.push(`${key}: the TRACKED ${path.relative(REPO, trackedPath)} (${fmt(tracked.pctEqual)}, ${tracked.cellsCompared} cells) is not what the current engine produces (${fmt(fresh.pctEqual)}, ${fresh.cellsCompared} cells) — re-record with --write`);
      }
    }
    const gap = Math.abs(row.rerunPctEqual - row.committedPctEqual);
    if (gap >= 0.0005 && row.gapCause === '') {
      failures.push(`${key}: offline ${fmt(row.rerunPctEqual)} vs committed harness ${fmt(row.committedPctEqual)} — UNNAMED gap (name it in the baseline's gapCause)`);
    }
  }
  console.log(`  ${lib.name.padEnd(10)} ${String(counted).padStart(2)} component(s)  ${secs(Date.now() - t0)}`);
}

// Rows the baseline still carries for components that no longer have a
// committed harness scorecard: a stale pin says nothing about the tree.
if (!ONLY_CONFIG && !WRITE) {
  for (const r of prior) {
    const key = `${r.library}/${r.component}`;
    if (!seen.has(key)) failures.push(`${key}: baseline row with no committed harness scorecard any more — a stale pin (re-record with --write)`);
  }
}

rows.sort((a, b) => a.library.localeCompare(b.library) || a.component.localeCompare(b.component));

if (WRITE) {
  // A re-record that lost a library mid-sweep would silently DROP that
  // library's rows from the baseline and un-pin it (measured 2026-08-23:
  // polaris died after two components and eleven rows vanished). Refuse.
  if (failures.length > 0) {
    console.error(`\n✗ re-record REFUSED — the re-measure did not complete, nothing written (${failures.length} finding(s)):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  // 1. the tracked offline scorecards become what the current engine produces
  let copied = 0;
  for (const lib of selected) {
    for (const comp of componentsOf(lib.config)) {
      const fresh = path.join(SCRATCH, lib.name, comp.toLowerCase(), 'regate.scorecard.json');
      const dir = path.join(REPO, lib.out, comp.toLowerCase());
      if (!existsSync(fresh) || !existsSync(path.join(dir, 'scorecard.json'))) continue;
      mkdirSync(dir, { recursive: true });
      copyFileSync(fresh, path.join(dir, 'regate.scorecard.json'));
      copied++;
    }
  }
  // 2. the baseline — rows outside --config are carried forward untouched
  const kept = ONLY_CONFIG ? prior.filter((r) => !selected.some((l) => l.name === r.library)) : [];
  const all = [...kept, ...rows].sort((a, b) => a.library.localeCompare(b.library) || a.component.localeCompare(b.component));
  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        _marker:
          'REGATE DRIFT BASELINE — what extract/computed/regate.ts (OFFLINE re-fuse of the committed captured truth through the CURRENT engine) produces, per component. NOT a copy of the harness scorecards: where the two differ, `gapCause` names why (docs/20-regate-drift.md). Re-record deliberately with `npm run extract:computed:drift -- --write` and say what moved. Every row is also the committed out/<lib>/<comp>/regate.scorecard.json — `npm run extract:computed:drift` (VERIFY, fast lane) holds the two together without a browser; `extract:computed:drift:remeasure` (full lane) re-fuses and compares.',
        recordedAt: new Date().toISOString().slice(0, 10),
        rows: all,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`\n✔ baseline re-recorded: ${rows.length} row(s) → ${path.relative(REPO, BASELINE)}; ${copied} tracked regate.scorecard.json file(s) updated from the re-measure (${secs(Date.now() - started)})`);
  const unnamed = rows.filter((r) => Math.abs(r.rerunPctEqual - r.committedPctEqual) >= 0.0005 && r.gapCause === '');
  if (unnamed.length > 0) {
    console.log(`  ⚠ ${unnamed.length} row(s) differ from their harness scorecard with NO gapCause — VERIFY will refuse until they are named: ${unnamed.map((r) => `${r.library}/${r.component}`).join(', ')}`);
  }
  process.exit(0);
}

console.log('');
for (const r of rows) {
  const same = Math.abs(r.rerunPctEqual - r.committedPctEqual) < 0.0005;
  // An EXACT row still prints its cause when it has one — a 'repaired:' note,
  // or the reason it carries unresolved refs despite agreeing. Suppressing it
  // is how a closed finding becomes invisible and gets rediscovered.
  const note = r.refused
    ? `REFUSED — ${r.refused.slice(0, 140)}`
    : same
    ? r.gapCause
      ? `EXACT — ${r.gapCause.split(/(?<=\.)\s/)[0]}`
      : 'EXACT'
    : `gap ${(r.rerunPctEqual - r.committedPctEqual).toFixed(3)} — ${r.gapCause ? r.gapCause.split(/(?<=\.)\s/)[0] : 'UNNAMED (name it in the baseline)'}`;
  console.log(
    `  ${(r.library + '/' + r.component).padEnd(24)} offline ${fmt(r.rerunPctEqual).padStart(7)}%  committed ${fmt(r.committedPctEqual).padStart(7)}%  ${note}${r.tolerance !== undefined ? `  [tolerance ±${r.tolerance}]` : ''}${r.unresolvedTokenRefs ? `  [${r.unresolvedTokenRefs} unresolved refs]` : ''}`,
  );
}

const elapsed = secs(Date.now() - started);
if (failures.length > 0) {
  console.error(`\n✗ regate drift (${REMEASURE ? 're-measure' : 'verify'}, ${elapsed}): ${failures.length} finding(s)`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  REMEASURE
    ? `\n✔ regate drift re-measure: ${rows.length} components match the recorded offline baseline (tolerance ${TOLERANCE}) in ${elapsed}; nothing tracked was written`
    : `\n✔ regate drift verify: ${rows.length} components — baseline, committed offline scorecard and committed harness scorecard agree (${elapsed}; run extract:computed:drift:remeasure to re-fuse)`,
);
