#!/usr/bin/env node
/**
 * EVAL RECORD — the committed suite result must be MEASURED, not asserted.
 *
 *   node scripts/eval-record-check.mjs                 freshness of evals/results.json
 *   node scripts/eval-record-check.mjs <measured.json> CI: compare a fresh full-run
 *                                                      record against the committed one
 *
 * WHY THIS EXISTS. On 2026-08-22 evals/results.json said 225/225 (committed
 * 2026-08-16) while the five most recent CI full-lane runs on main said
 * 222, 217, 218, 217 and 214 of 225 — no CI run had ever reproduced the
 * committed number. docs:check and eval:registry:check read that file and
 * printed green. A result file a gate trusts, that CI never produced or
 * compared, is a self-attestation.
 *
 * Two jobs, one per invocation shape:
 *
 *   FRESHNESS (no argument) — refuses when the committed record
 *     · carries no provenance (predates the stamp; run the full suite),
 *     · was measured on a DIRTY tree (a dirty-tree run cannot be the
 *       committed truth — it measured something nobody can check out),
 *     · names a commit that is not an ancestor of HEAD (a record from another
 *       branch or a rewritten history),
 *     and always PRINTS how many commits behind HEAD the record is, so the
 *     age is visible even when it is legal.
 *
 *   COMPARE (one argument) — the full lane runs
 *     `npm run eval -- --record evals/.ci/results.json` and then this script
 *     with that path. Every registered case must have the same pass/fail in
 *     both files; any difference is listed by id and the lane fails. Only the
 *     rows are compared — provenance fields differ by construction.
 *
 * It cannot make the record fresh, only refuse a stale or foreign one; the
 * only way to turn it green is to run the suite on a clean tree and commit
 * what it wrote. That is the point.
 */
import { execFileSync } from 'node:child_process';
import { evalRedFailures } from './eval-red-ledger.mjs';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RECORD = path.join(ROOT, 'evals', 'results.json');

const git = (args) => {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};

const readRecord = (file) => {
  const rec = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(rec.results) || typeof rec.passed !== 'number' || typeof rec.total !== 'number') {
    throw new Error(`${path.relative(ROOT, file)}: not a suite record (passed/total/results missing)`);
  }
  return rec;
};

/** Freshness of the committed record. Returns a list of failure strings. */
export function recordFreshnessFailures(rec = readRecord(RECORD)) {
  const failures = [];
  if (typeof rec.commit !== 'string' || !rec.commit || rec.commit === 'unknown') {
    failures.push('evals/results.json carries no `commit` provenance — it predates the stamp. Run `npm run eval` on a clean tree and commit the record.');
    return failures;
  }
  if (rec.dirty === true) {
    failures.push(`evals/results.json was measured on a DIRTY tree at ${rec.commit.slice(0, 8)} — a dirty-tree run measures something nobody can check out. Commit first, then run \`npm run eval\`.`);
  }
  const head = git(['rev-parse', 'HEAD']);
  if (head) {
    const isAncestor = (() => {
      try {
        execFileSync('git', ['merge-base', '--is-ancestor', rec.commit, head], { cwd: ROOT, stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    })();
    if (!isAncestor) {
      // A SHALLOW clone cannot answer this question, and the answer it gives is
      // wrong in the accusing direction. Measured 2026-09-04: on a
      // `git clone --depth 1` of origin/main — the clone a stranger makes when
      // they do not want 537 MB of history — `git merge-base --is-ancestor`
      // fails because the record's commit is simply not in the shallow history,
      // and this check told them their committed record came "from another
      // branch or a rewritten history". Naming the depth is the honest answer;
      // pretending to have verified ancestry would be worse.
      const shallow = git(['rev-parse', '--is-shallow-repository']) === 'true';
      if (shallow) {
        failures.push(
          `evals/results.json was measured at ${rec.commit.slice(0, 8)}, which is not in this SHALLOW clone's history — ancestry cannot be checked here at all. Run \`git fetch --unshallow\` (or clone without --depth) and re-run; this is the clone's depth, not a foreign record.`,
        );
      } else {
        failures.push(`evals/results.json was measured at ${rec.commit.slice(0, 8)}, which is not an ancestor of HEAD ${head.slice(0, 8)} — a record from another branch or a rewritten history.`);
      }
    } else {
      const behind = git(['rev-list', '--count', `${rec.commit}..${head}`]);
      const touched = git(['diff', '--stat', '--name-only', rec.commit, head]);
      const n = touched ? touched.split('\n').filter(Boolean).length : 0;
      console.log(
        `  evals/results.json: ${rec.passed}/${rec.total} measured at ${rec.commit.slice(0, 8)} (${rec.recordedAt ?? 'undated'}), ` +
          `${behind ?? '?'} commit(s) behind HEAD, ${n} file(s) changed since — the full CI lane re-measures and compares (eval-record-check <measured>)`,
      );
    }
  }
  return failures;
}

/** CI compare: measured record vs committed record, row by row. */
export function compareFailures(measuredFile) {
  const measured = readRecord(measuredFile);
  const committed = readRecord(RECORD);
  const failures = [];
  const m = new Map(measured.results.map((r) => [r.id, r.pass]));
  const c = new Map(committed.results.map((r) => [r.id, r.pass]));
  for (const [id, pass] of m) {
    if (!c.has(id)) failures.push(`${id}: measured by CI but absent from the committed record`);
    else if (c.get(id) !== pass) failures.push(`${id}: CI measured ${pass ? 'PASS' : 'FAIL'}, committed record says ${c.get(id) ? 'PASS' : 'FAIL'}`);
  }
  for (const id of c.keys()) if (!m.has(id)) failures.push(`${id}: in the committed record but CI did not run it`);
  // A RED SUITE IS PERMITTED ONLY IF EVERY RED IS NAMED — the same single rule
  // docs:check consults, deliberately not a second copy of it. This used to be
  // an unconditional refusal, which deadlocked the census stack: none of its
  // three reds could close until the branch carrying their fix had landed.
  //
  // Note WHICH reds are checked: CI's own measurement, not the committed
  // record. That is stricter than naming the committed reds — the row-by-row
  // compare above already proves the two agree, and reading the measured set
  // here means a ledger cannot name a comfortable red while CI fails a
  // different one.
  const ledgerPath = path.join(ROOT, 'parity/receipts/v1/eval-reds.json');
  const ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : null;
  for (const f of evalRedFailures(measured, ledger, path.relative(ROOT, ledgerPath))) {
    failures.push(`${f.where}: ${f.msg}`);
  }
  console.log(`  measured ${measured.passed}/${measured.total} at ${String(measured.commit ?? '?').slice(0, 8)} vs committed ${committed.passed}/${committed.total} at ${String(committed.commit ?? '?').slice(0, 8)}`);
  return failures;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = process.argv[2];
  let failures;
  if (arg) {
    const file = path.resolve(arg);
    if (!existsSync(file)) {
      console.error(`✖ eval:record:check — measured record ${arg} does not exist (did \`npm run eval -- --record ${arg}\` run?)`);
      process.exit(1);
    }
    failures = compareFailures(file);
  } else {
    failures = recordFreshnessFailures();
  }
  if (failures.length) {
    console.error(`✖ eval:record:check — ${failures.length} failure(s):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`✔ eval:record:check — ${arg ? 'CI measurement matches the committed record row for row' : 'the committed record is clean-tree, on this history'}`);
}
