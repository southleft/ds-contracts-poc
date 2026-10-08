/**
 * RUN A CI LANE LOCALLY — `npm run ci:lane fast` / `npm run ci:lane full`.
 *
 * WHY IT READS THE WORKFLOW instead of listing the gates itself: a second copy
 * of the lane in package.json is a receipt that can name a destination the CI
 * no longer has. This reads .github/workflows/<lane>.yml and executes exactly
 * the gate steps that file declares — if they drift, they drift together.
 *
 * IT RUNS THE GATE STEPS ONLY. A step is a gate when it carries the
 * `steps.setup.outcome == 'success'` guard AND is not marked
 * `env: { CI_LANE_STEP: prep }`. The preparation steps — npm ci, the browser
 * install, the three artifact builds — are PRINTED, not run: on a
 * contributor's machine `npx playwright-core install --with-deps` wants sudo
 * and apt, and `npm ci` would blow away a working node_modules. They are
 * listed so nothing is hidden.
 *
 * Preparation steps carry the guard IN CI on purpose (a broken `plugin:zip`
 * should take down `plugin:ui-check`, not blank all 28 results), which is why
 * the marker exists rather than the guard alone deciding.
 *
 * Like the lane itself, one red gate does not stop the others: every gate runs,
 * each prints its own verdict and wall time, and the process exits 1 at the end
 * if any failed.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

const ROOT = process.cwd();
const WF_DIR = path.join(ROOT, '.github', 'workflows');
const GUARD = "steps.setup.outcome == 'success'";

const lane = process.argv[2];
const available = readdirSync(WF_DIR).map((f) => f.replace(/\.ya?ml$/, ''));
if (!lane || !available.includes(lane)) {
  console.error(
    `usage: npm run ci:lane <lane>\n  lanes: ${available.join(', ')}` +
      (lane ? `\n  "${lane}" is not one of them` : ''),
  );
  process.exit(2);
}

interface Step {
  name?: string;
  run?: string;
  uses?: string;
  if?: string;
  env?: Record<string, string>;
}
const doc = parseYaml(readFileSync(path.join(WF_DIR, `${lane}.yml`), 'utf8')) as {
  jobs: Record<string, { steps?: Step[] }>;
};
const steps = Object.values(doc.jobs).flatMap((j) => j.steps ?? []);
const isGateStep = (s: Step) =>
  Boolean(s.run) && (s.if ?? '').includes(GUARD) && s.env?.CI_LANE_STEP !== 'prep';
const gates = steps.filter(isGateStep);
const prereqs = steps.filter((s) => s.run && !isGateStep(s));

console.log(`LANE "${lane}" — ${gates.length} gate step(s)\n`);

// "0/0 gates green" is a false receipt. deploy-check.yml is a straight chain
// with no guarded steps by design (it asserts against live surfaces and has
// nothing to report independently), so say that instead of printing a win.
if (gates.length === 0) {
  console.error(
    `✖ "${lane}" declares no guarded gate steps, so there is nothing for this runner to execute.\n` +
      `  Its steps run as one chain — read .github/workflows/${lane}.yml and run them yourself.`,
  );
  process.exit(2);
}
if (prereqs.length) {
  console.log('PREREQUISITES this runner does NOT execute (run them yourself if the tree is cold):');
  for (const s of prereqs) {
    for (const line of (s.run ?? '').trim().split('\n')) console.log(`    ${line.trim()}`);
  }
  console.log('');
}

// Support the file-presence guards used by these workflows. Unknown syntax
// fails explicitly rather than silently running or skipping a gated command.
function guardAllows(expression: string): boolean {
  const terms = expression.replace(/^\s*\$\{\{/, '').replace(/\}\}\s*$/, '').trim().split(/\s*&&\s*/);
  let allowed = true;
  for (const term of terms) {
    if (term === GUARD || term === '!cancelled()') continue;
    const match = /^hashFiles\('([^']+)'\) != ''$/.exec(term);
    if (!match) throw new Error(`Unsupported local gate condition: ${term}`);
    const segments = match[1]!.split('/');
    if (segments.some(s => !s || s === '.' || s === '..' || /[^a-zA-Z0-9_@.*-]/.test(s) || s.includes('**')))
      throw new Error(`Unsupported hashFiles pattern: ${match[1]}`);
    let candidates = [ROOT];
    for (const segment of segments) {
      const pattern = new RegExp('^' + segment.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
      candidates = candidates.flatMap(dir => {
        if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
        return segment.includes('*')
          ? readdirSync(dir).filter(name => pattern.test(name)).map(name => path.join(dir, name))
          : [path.join(dir, segment)].filter(existsSync);
      });
    }
    allowed = candidates.some(file => statSync(file).isFile()) && allowed;
  }
  return allowed;
}

let skipped = 0;
let failed = 0;
const rows: string[] = [];
for (const step of gates) {
  const cmd = (step.run ?? '').trim();
  try {
    if (!guardAllows(step.if ?? '')) {
      skipped += 1;
      rows.push(`  - SKIP ${cmd} (workflow file-presence condition is false)`);
      console.log(rows[rows.length - 1]);
      continue;
    }
  } catch (error) {
    failed += 1;
    rows.push(`  ✖ ${cmd}: ${String(error)}`);
    console.error(rows[rows.length - 1]);
    continue;
  }
  const started = Date.now();
  // A multi-line `run:` block reports only its LAST command's status under a
  // plain shell, so a failure on line 1 would be reported green. GitHub runs
  // these with `bash -e`; match it.
  const script = cmd.includes('\n') ? `set -e\n${cmd}` : cmd;
  const r = spawnSync(script, { shell: true, stdio: 'inherit', cwd: ROOT });
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  const ok = r.status === 0;
  if (!ok) failed += 1;
  rows.push(`  ${ok ? '✔' : '✖'} ${String(secs).padStart(6)}s  ${cmd}`);
  console.log(`${ok ? '✔' : '✖'} ${cmd}  (${secs}s)\n`);
}

console.log(`\nLANE "${lane}" SUMMARY`);
for (const row of rows) console.log(row);
console.log(`\n${skipped} gate(s) skipped by workflow conditions.`);
if (failed) {
  console.error(`\n✖ ${failed}/${gates.length} gate(s) failed in lane "${lane}".`);
  process.exit(1);
}
console.log(`\n✔ ${gates.length - skipped}/${gates.length} gates passed in lane "${lane}".`);
