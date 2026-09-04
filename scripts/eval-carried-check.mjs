#!/usr/bin/env node
/**
 * EVAL, CARRIED BY NAME — the suite is run FRESH, and a red is permitted only
 * where the named-red ledger already names it, causes it and says what closes it.
 *
 *   node scripts/eval-carried-check.mjs              run the suite, then apply the rule
 *   node scripts/eval-carried-check.mjs --record <f> run it, recording where CI wants it
 *   node scripts/eval-carried-check.mjs --from <f>   apply the rule to an existing record
 *
 * WHY THIS EXISTS. The owner decided on 2026-09-03 that the five remaining eval
 * reds are CARRIED: each is named in parity/receipts/v1/eval-reds.json with a
 * measured cause and a stated closing condition, and four of the five are stale
 * artifacts or a live canvas, not the engine. `docs:check` already honours that
 * ledger. But the two v1-definition rows that cite the suite ran bare
 * `npm run eval`, which exits non-zero on any red at all — so a decision the
 * owner had made could not be read anywhere in the readiness tally, and two rows
 * stayed red for a reason the ledger says is carried.
 *
 * This is the same doctrine the census (`--allow-red-verdicts`), the usable
 * baseline and the corpus ledger already use: a red that is named, caused and
 * has a way to close is CARRIED and visible; a red that is not is a silent
 * failure, which is the one thing this project does not permit.
 *
 * WHAT IT DOES NOT DO. It does not weaken the suite. It runs every case (no
 * `--only`, no skips) and re-applies the rule to what THIS run measured, so a
 * ledger row that has gone green is refused as stale and a new red that nobody
 * named fails the gate. `eval:record:check` still compares the committed record
 * against a fresh full-lane run row by row, so a lie about which evals fail is
 * caught there, not here.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evalRedFailures } from './eval-red-ledger.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER_REL = 'parity/receipts/v1/eval-reds.json';
const LEDGER = path.join(ROOT, LEDGER_REL);

const fromIdx = process.argv.indexOf('--from');
let record;
let where;

if (fromIdx > -1 && process.argv[fromIdx + 1]) {
  where = path.resolve(process.argv[fromIdx + 1]);
  if (!existsSync(where)) {
    console.error(`✖ eval:carried:check — no record at ${path.relative(ROOT, where)}`);
    process.exit(1);
  }
} else {
  const recIdx = process.argv.indexOf('--record');
  where =
    recIdx > -1 && process.argv[recIdx + 1]
      ? path.resolve(process.argv[recIdx + 1])
      : path.join(ROOT, 'evals', '.carried', 'results.json');
  mkdirSync(path.dirname(where), { recursive: true });
  console.log('eval:carried:check — running the full suite (this is a measurement, not a read)…');
  const run = spawnSync('npx', ['tsx', 'evals/run.ts', '--record', where], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  if (run.error) {
    console.error(`✖ eval:carried:check — the suite could not be started: ${run.error.message}`);
    process.exit(1);
  }
  if (!existsSync(where)) {
    console.error(`✖ eval:carried:check — the suite exited ${run.status} and wrote no record; nothing was measured`);
    process.exit(1);
  }
}

const results = JSON.parse(readFileSync(where, 'utf8'));
if (!Array.isArray(results.results) || typeof results.passed !== 'number' || typeof results.total !== 'number') {
  console.error(`✖ eval:carried:check — ${path.relative(ROOT, where)} is not a suite record (passed/total/results missing)`);
  process.exit(1);
}

const ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : null;
const problems = evalRedFailures(results, ledger, LEDGER_REL);
const failing = results.results.filter((r) => r.pass === false).map((r) => r.id);

if (problems.length > 0) {
  for (const p of problems) console.error(`  ✖ ${p.where}: ${p.msg}`);
  console.error(`✖ eval:carried:check — ${results.passed}/${results.total}; the reds above are NOT carried`);
  process.exit(1);
}

if (failing.length === 0) {
  console.log(`✔ eval:carried:check — ${results.passed}/${results.total}, the suite is GREEN and the ledger is empty of stale rows`);
  process.exit(0);
}

const rows = new Map((ledger.reds || []).map((r) => [r.id, r]));
for (const id of failing) {
  const row = rows.get(id);
  console.log(`  carried  ${id}`);
  console.log(`           cause      ${String(row.cause).replace(/\s+/g, ' ').slice(0, 150)}`);
  console.log(`           closesWhen ${String(row.closesWhen).replace(/\s+/g, ' ').slice(0, 150)}`);
}
console.log(
  `✔ eval:carried:check — ${results.passed}/${results.total}; ${failing.length} red(s), every one named, caused and with a stated close in ${LEDGER_REL}`,
);
