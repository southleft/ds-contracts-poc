/**
 * REGATE DRIFT CHECK — the pin that keeps offline-re-fuse drift from going
 * unnoticed between rounds.
 *
 *   npm run extract:computed:drift              # check against the baseline
 *   npm run extract:computed:drift -- --write   # re-record the baseline
 *   npm run extract:computed:drift -- --config extract/computed/configs/mui.json
 *
 * WHY IT IS NOT AN EVAL. The check re-runs `extract/computed/regate.ts`, which
 * renders the gate page in a real headless Chromium — measured at 8-20s per
 * component, ~6 minutes for all 36. The eval suite is already ~10 minutes, so
 * this is an on-demand script (the same call CI can make), not a 157th eval.
 * What IS cheap enough for the suite is the invariant this check makes
 * legible, and that pin lives in evals/run.ts (`computed-contract-refs`):
 * every SHIPPED contract resolves every token ref against its library
 * inventory. This script covers what that pin cannot — the number itself.
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
 *
 * The baseline also carries each component's committed harness pctEqual and
 * the NAMED reason it differs, so the gap is documented where it is measured
 * rather than rediscovered every round (docs/20-regate-drift.md).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const REPO = path.resolve(HERE, '..', '..');
const BASELINE = path.join(HERE, 'regate-baseline.json');

const arg = (n: string): string | null => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : null;
};
const WRITE = process.argv.includes('--write');
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

function discoverLibraries(): { libraries: Array<{ name: string; config: string; out: string }>; skipped: string[] } {
  const libraries: Array<{ name: string; config: string; out: string }> = [];
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
}

const componentsOf = (configPath: string): string[] => {
  const cfg = JSON.parse(readFileSync(path.join(REPO, configPath), 'utf8')) as { components: Array<{ name: string }> };
  return cfg.components.map((c) => c.name);
};

const rows: BaselineRow[] = [];
const failures: string[] = [];
const prior: BaselineRow[] = existsSync(BASELINE)
  ? (JSON.parse(readFileSync(BASELINE, 'utf8')) as { rows: BaselineRow[] }).rows
  : [];
const priorBy = new Map<string, BaselineRow>(prior.map((r) => [`${r.library}/${r.component}`, r]));

for (const s of SKIPPED_CONFIGS) process.stdout.write(`  … config SKIPPED: ${s}\n`);

for (const lib of LIBRARIES) {
  if (ONLY_CONFIG && path.resolve(REPO, ONLY_CONFIG) !== path.resolve(REPO, lib.config)) continue;
  process.stdout.write(`\n── ${lib.name} ──\n`);
  try {
    execFileSync('npx', ['tsx', 'extract/computed/regate.ts', '--config', lib.config, '--out', lib.out], {
      cwd: REPO,
      stdio: ['ignore', 'ignore', 'pipe'],
      encoding: 'utf8',
    });
  } catch (e) {
    // A refusal mid-sweep is itself the finding — the remaining components
    // simply have no fresh scorecard and are reported as NOT RE-FUSED below.
    const err = e as { stderr?: string };
    process.stdout.write(`  ⚠ sweep did not complete: ${(err.stderr ?? '').split('\n').filter(Boolean).slice(-3).join(' | ').slice(0, 300)}\n`);
  }
  for (const comp of componentsOf(lib.config)) {
    const dir = path.join(REPO, lib.out, comp.toLowerCase());
    const key = `${lib.name}/${comp}`;
    const rgPath = path.join(dir, 'regate.scorecard.json');
    const scPath = path.join(dir, 'scorecard.json');
    if (!existsSync(scPath)) continue; // never harness-run — nothing to drift from
    if (!existsSync(rgPath)) {
      failures.push(`${key}: NOT RE-FUSED — regate produced no scorecard (the component no longer fuses through the current engine)`);
      continue;
    }
    const rg = JSON.parse(readFileSync(rgPath, 'utf8')) as {
      scorecard: { computed: { pctEqual: number; cellsCompared: number }; unresolvedTokenRefs?: { count: number } };
    };
    const sc = JSON.parse(readFileSync(scPath, 'utf8')) as { computed: { pctEqual: number } };
    const p = priorBy.get(key);
    const row: BaselineRow = {
      library: lib.name,
      component: comp,
      rerunPctEqual: rg.scorecard.computed.pctEqual,
      cellsCompared: rg.scorecard.computed.cellsCompared,
      unresolvedTokenRefs: rg.scorecard.unresolvedTokenRefs?.count ?? 0,
      committedPctEqual: sc.computed.pctEqual,
      gapCause: p?.gapCause ?? '',
      ...(p?.tolerance !== undefined ? { tolerance: p.tolerance } : {}),
    };
    rows.push(row);
    if (WRITE || !p) continue;
    // A row may widen its OWN tolerance (BaselineRow.tolerance) when the
    // offline instrument is measurably not reproducible on it; the widening is
    // carried in the committed baseline next to the reason, never passed on the
    // command line, so it cannot be applied silently to a row that never asked
    // for it.
    const rowTol = p.tolerance ?? TOLERANCE;
    if (Math.abs(row.rerunPctEqual - p.rerunPctEqual) > rowTol) {
      failures.push(`${key}: offline pctEqual ${p.rerunPctEqual.toFixed(3)} → ${row.rerunPctEqual.toFixed(3)} (tolerance ${rowTol}${p.tolerance !== undefined ? ' — this row\'s OWN widened tolerance' : ''})`);
    }
    if (row.cellsCompared !== p.cellsCompared) {
      failures.push(`${key}: cellsCompared ${p.cellsCompared} → ${row.cellsCompared} — the compared VOCABULARY moved; a percentage cannot absorb this`);
    }
    if (row.unresolvedTokenRefs !== p.unresolvedTokenRefs) {
      failures.push(`${key}: unresolved token refs ${p.unresolvedTokenRefs} → ${row.unresolvedTokenRefs} — refs the gate renders as EMPTY custom properties`);
    }
  }
}

rows.sort((a, b) => a.library.localeCompare(b.library) || a.component.localeCompare(b.component));

if (WRITE) {
  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        _marker:
          'REGATE DRIFT BASELINE — what extract/computed/regate.ts (OFFLINE re-fuse of the committed captured truth through the CURRENT engine) produces, per component. NOT a copy of the harness scorecards: where the two differ, `gapCause` names why (docs/20-regate-drift.md). Re-record deliberately with `npm run extract:computed:drift -- --write` and say what moved.',
        recordedAt: new Date().toISOString().slice(0, 10),
        rows,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`\n✔ baseline re-recorded: ${rows.length} components → ${path.relative(REPO, BASELINE)}`);
  process.exit(0);
}

console.log('');
for (const r of rows) {
  const same = Math.abs(r.rerunPctEqual - r.committedPctEqual) < 0.0005;
  // An EXACT row still prints its cause when it has one — a 'repaired:' note,
  // or the reason it carries unresolved refs despite agreeing. Suppressing it
  // is how a closed finding becomes invisible and gets rediscovered.
  const note = same
    ? r.gapCause
      ? `EXACT — ${r.gapCause.split(/(?<=\.)\s/)[0]}`
      : 'EXACT'
    : `gap ${(r.rerunPctEqual - r.committedPctEqual).toFixed(3)} — ${r.gapCause || 'UNNAMED (name it in the baseline)'}`;
  console.log(
    `  ${(r.library + '/' + r.component).padEnd(24)} offline ${r.rerunPctEqual.toFixed(3).padStart(7)}%  committed ${r.committedPctEqual.toFixed(3).padStart(7)}%  ${note}${r.tolerance !== undefined ? `  [tolerance ±${r.tolerance}]` : ''}${r.unresolvedTokenRefs ? `  [${r.unresolvedTokenRefs} unresolved refs]` : ''}`,
  );
}

if (failures.length > 0) {
  console.error(`\n✗ regate drift: ${failures.length} finding(s)`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\n✔ regate drift: ${rows.length} components match the recorded offline baseline (tolerance ${TOLERANCE})`);
