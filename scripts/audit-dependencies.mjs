#!/usr/bin/env node
/**
 * NPM AUDIT, WITH THE UPSTREAM ERROR TOLD APART FROM A FINDING.
 *
 *   node scripts/audit-dependencies.mjs              every dependency
 *   node scripts/audit-dependencies.mjs --production  --omit=dev
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
 */
import { spawnSync } from 'node:child_process';
import { classifyAudit } from './audit-classify.mjs';

const PRODUCTION = process.argv.includes('--production');
const LABEL = PRODUCTION ? 'production dependencies' : 'all dependencies';
const ARGS = ['audit', '--json', '--audit-level=high', ...(PRODUCTION ? ['--omit=dev'] : [])];
const TRIES = 3;

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

let last = 'never attempted';
for (let attempt = 1; attempt <= TRIES; attempt++) {
  const run = spawnSync('npm', ARGS, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  let parsed = null;
  try {
    parsed = JSON.parse(run.stdout);
  } catch {
    parsed = null;
  }
  const verdict = classifyAudit(parsed, run.status, run.stderr);

  if (verdict.kind === 'clean') {
    console.log(
      `✔ audit (${LABEL}): 0 high or critical advisories ` +
        `(${verdict.total} at all severities, ${verdict.dependencies ?? '?'} dependencies)`,
    );
    process.exit(0);
  }
  if (verdict.kind === 'vulnerable') {
    console.error(`✖ audit (${LABEL}): ${verdict.count} high/critical advisory(ies) — ${verdict.names.join(', ')}`);
    process.exit(1);
  }
  last = verdict.reason;
  console.error(`  attempt ${attempt}/${TRIES}: the npm advisory endpoint failed — ${String(last).slice(0, 200)}`);
  if (attempt < TRIES) sleep(5000 * attempt);
}

console.error(
  `✖ audit (${LABEL}): the npm advisory endpoint failed on all ${TRIES} attempts — last error: ${String(last).slice(0, 300)}\n` +
    `  THIS IS NOT A VULNERABILITY FINDING. Nothing was audited, and nothing audited is not a pass, so the lane is red on purpose.\n` +
    `  Re-run the lane; if it persists, the quick-audit endpoint npm warns is being retired has probably gone.`,
);
process.exit(1);
