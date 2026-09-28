#!/usr/bin/env node
/**
 * NPM AUDIT, WITH THE UPSTREAM ERROR TOLD APART FROM A FINDING.
 *
 *   node scripts/audit-dependencies.mjs              every dependency, every tracked lockfile
 *   node scripts/audit-dependencies.mjs --production  --omit=dev, the root lockfile only
 *
 * WHY THIS EXISTS. Measured 2026-09-04: the security lane's last THREE failures
 * were all the npm advisory endpoint erroring — one HTTP 500 and two "Bad
 * Request" — and not one was a vulnerability. `npm audit` exits 1 for both
 * cases, so the lane could not say which had happened, and a gate that has only
 * ever gone red for a reason unrelated to security is a gate people learn to
 * scroll past. npm also prints on every run that the quick-audit endpoint "is
 * being retired", so this was going to stop being occasional.
 *
 * The posture does not change: this still FAILS CLOSED. An endpoint that cannot
 * be reached means nothing was audited, and nothing audited is not a pass. What
 * changes is that the failure says which of the two it is, and that a transient
 * error gets three tries before the lane goes red on it.
 *
 * The verdict itself is a pure function in scripts/audit-classify.mjs, tested
 * against the exact shapes the real failures produced.
 *
 * WHICH LOCKFILES. Measured 2026-09-27: all eight open Dependabot alerts (five
 * high) were in benchmark/react-family/package-lock.json, which benchmark.yml
 * installs with `npm ci --prefix`, and this script audited only the root
 * lockfile, so no lane noticed. Dependabot reads every lockfile in the tree, so
 * the full audit now takes its list from `git ls-files` rather than a hand-kept
 * one, and a lockfile added later is audited without anyone remembering to add
 * it. `--production` stays on the root lockfile: the nested workspaces are
 * private and ship in no published package, and their production findings are a
 * subset of what the full audit already reports.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyAudit } from './audit-classify.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRODUCTION = process.argv.includes('--production');
const LABEL = PRODUCTION ? 'production dependencies' : 'all dependencies';
const ARGS = ['audit', '--json', '--audit-level=high', ...(PRODUCTION ? ['--omit=dev'] : [])];
const TRIES = 3;

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function lockfileDirs() {
  if (PRODUCTION) return ['.'];
  const ls = spawnSync('git', ['ls-files', '-z', '--', ':(glob)**/package-lock.json'], { cwd: ROOT, encoding: 'utf8' });
  const dirs = ls.status === 0 ? ls.stdout.split('\0').filter(Boolean).map((f) => path.posix.dirname(f)) : [];
  // The root lockfile missing from the list means the listing is wrong, not that
  // there is less to audit. Refuse rather than pass on a shorter list.
  if (!dirs.includes('.')) {
    console.error(
      `✖ audit (${LABEL}): could not list the tracked lockfiles (git exited ${ls.status}` +
        `${ls.stderr ? ` — ${String(ls.stderr).trim().slice(0, 200)}` : ''}). Nothing was audited.`,
    );
    process.exit(1);
  }
  return ['.', ...dirs.filter((d) => d !== '.').sort()];
}

function audit(dir) {
  const label = dir === '.' ? LABEL : `${LABEL} in ${dir}`;
  let last = 'never attempted';
  for (let attempt = 1; attempt <= TRIES; attempt++) {
    const run = spawnSync('npm', ARGS, { cwd: path.join(ROOT, dir), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    let parsed = null;
    try {
      parsed = JSON.parse(run.stdout);
    } catch {
      parsed = null;
    }
    const verdict = classifyAudit(parsed, run.status, run.stderr);

    if (verdict.kind === 'clean') {
      console.log(
        `✔ audit (${label}): 0 high or critical advisories ` +
          `(${verdict.total} at all severities, ${verdict.dependencies ?? '?'} dependencies)`,
      );
      return true;
    }
    if (verdict.kind === 'vulnerable') {
      console.error(`✖ audit (${label}): ${verdict.count} high/critical advisory(ies) — ${verdict.names.join(', ')}`);
      return false;
    }
    last = verdict.reason;
    console.error(`  attempt ${attempt}/${TRIES} (${dir}): the npm advisory endpoint failed — ${String(last).slice(0, 200)}`);
    if (attempt < TRIES) sleep(5000 * attempt);
  }

  console.error(
    `✖ audit (${label}): the npm advisory endpoint failed on all ${TRIES} attempts — last error: ${String(last).slice(0, 300)}\n` +
      `  THIS IS NOT A VULNERABILITY FINDING. Nothing was audited, and nothing audited is not a pass, so the lane is red on purpose.\n` +
      `  Re-run the lane; if it persists, the quick-audit endpoint npm warns is being retired has probably gone.`,
  );
  return false;
}

// Every lockfile is audited even after one fails, so a red lane names all of them.
const results = lockfileDirs().map(audit);
process.exit(results.every(Boolean) ? 0 : 1);
