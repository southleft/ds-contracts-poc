/**
 * EVAL REGISTRY COVERAGE — `npm run eval:registry:check`.
 *
 * WHY THIS EXISTS. `evals/results.json` is the committed record of the suite,
 * and `docs:check` gates every "N/N pass" claim in the documentation against
 * it. The runner writes one row per case it runs, so the record cannot lose a
 * case to a bug — but it CAN go stale: a case registered after the last full
 * run is simply absent from the file, and every consumer then reasons about a
 * smaller denominator than the suite actually has.
 *
 * That is not hypothetical. On 2026-08-08 `console-loop-reference-content-checks`
 * was registered, was ALREADY RED, and sat invisible in the record for hours —
 * 216 rows against 217 registered cases — while this session repeatedly
 * reported "213/216, three named reds". The denominator was wrong and nothing
 * said so.
 *
 * WHAT IT REFUSES, by name:
 *   1. a registered case with no row in results.json (the stale-record defect)
 *   2. a row whose id is no longer registered (a deleted case still counted)
 *
 * It never runs the suite. It asks the runner to enumerate its own registry
 * (`--list-ids`) rather than parsing source, because some cases are registered
 * programmatically and a regex over `id:` lines undercounts them — that
 * miscount is itself how this defect first looked smaller than it was.
 *
 * FALSIFICATION: register a case and do not re-run the suite → (1) fires.
 * Delete a case without re-running → (2) fires.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const listed = spawnSync('npx', ['tsx', 'evals/run.ts', '--list-ids'], {
  cwd: ROOT,
  encoding: 'utf8',
});
if ((listed.status ?? -1) !== 0) {
  console.error('eval:registry:check — could not enumerate the registry:');
  console.error(`${listed.stdout ?? ''}${listed.stderr ?? ''}`);
  process.exit(2);
}
const registered = listed.stdout.split('\n').map((s) => s.trim()).filter(Boolean);

const record = JSON.parse(readFileSync(path.join(ROOT, 'evals/results.json'), 'utf8'));
const rows = record.results.map((r) => r.id);
const rowSet = new Set(rows);
const regSet = new Set(registered);

const missing = registered.filter((id) => !rowSet.has(id));
const orphaned = rows.filter((id) => !regSet.has(id));

if (missing.length || orphaned.length) {
  console.error(
    `✖ eval:registry:check — evals/results.json does not cover the registry ` +
      `(${rows.length} row(s) vs ${registered.length} registered case(s)).`,
  );
  for (const id of missing) {
    console.error(
      `  - REGISTERED BUT UNRECORDED: ${id} — the committed result predates this case, so every ` +
        `"N/N" claim gated against results.json is counting a smaller denominator than the suite has. ` +
        `Run the full suite (npm run eval) and commit the record.`,
    );
  }
  for (const id of orphaned) {
    console.error(
      `  - RECORDED BUT UNREGISTERED: ${id} — the record still counts a case that no longer exists. ` +
        `Run the full suite and commit the record.`,
    );
  }
  process.exit(1);
}

const failing = record.results.filter((r) => !r.pass).map((r) => r.id);
console.log(
  `✔ eval:registry:check — evals/results.json covers the registry exactly: ${rows.length} row(s), ` +
    `${registered.length} registered case(s)` +
    (failing.length
      ? `; ${failing.length} recorded as failing (${failing.join(', ')}) — the record is honest, not green`
      : '; all recorded as passing'),
);
