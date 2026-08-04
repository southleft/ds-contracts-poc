/**
 * A GATE ON THE GATES — `npm run ci:lanes`.
 *
 * WHY THIS EXISTS. The defect this whole .github/ directory answers is "33 gate
 * scripts, none of them automated". The obvious way for that defect to come
 * back is quieter: someone adds gate #34, never adds it to a lane, and the
 * checks list stays green while the new surface is unwatched — precisely the
 * `skips: []` shape this repo keeps finding. So the lanes get a receipt of
 * their own.
 *
 * WHAT IT REFUSES, by name:
 *   1. a gate-shaped script in package.json that no workflow invokes and that
 *      is not on the EXCLUDED list below
 *   2. a workflow step invoking `npm run <x>` where <x> is not a script
 *      (a lane pointing at a destination that does not exist)
 *   3. an EXCLUDED entry that no longer names a real script (a stale reason)
 *      or that a lane DOES run (a reason contradicting the wiring)
 *   4. a gate step in fast.yml / full.yml missing the
 *      `steps.setup.outcome == 'success'` guard — without it, GitHub stops the
 *      job at the first red gate and hides every gate behind it, which is the
 *      failure mode the lanes were explicitly shaped to avoid
 *
 * FALSIFICATION. Delete any gate step from a workflow → (1) fires. Rename a
 * step's script → (2) fires. Drop an `if:` guard → (4) fires. There is no way
 * to weaken a lane and keep this green.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

const ROOT = process.cwd();
const WF_DIR = path.join(ROOT, '.github', 'workflows');

/** Gate-shaped by suffix, plus the ones whose names do not carry one. */
const NAMED_GATES = new Set([
  'typecheck',
  'eval',
  'dagger:census',
  'site:build',
  'parity',
]);
// `check` unanchored to a separator on purpose: the 33 spell it three ways —
// `mint:check`, `plugin:ui-check`, `core:browser-check`. An earlier cut of this
// file used /(:check|:fresh)$/ and silently dropped the last two from the
// coverage census while still printing a confident "33".
const isGate = (name: string) => /(check|:fresh)$/.test(name) || NAMED_GATES.has(name);

/**
 * Gate-shaped scripts NO lane runs — each with the reason, so that "not in CI"
 * is a decision on the record and never an oversight. Adding a name here is a
 * deliberate act; the checks in this file make sure the entry stays true.
 */
const EXCLUDED: Record<string, string> = {
  parity:
    'RED at 8a5c455 for a wall-clock reason: parity/figma-{components,tokens}.json are 27.0 days ' +
    'old and the differ refuses snapshots older than 14 (MAX_SNAPSHOT_AGE_DAYS). Refreshing them ' +
    'needs a human running parity/extract-figma.plugin.js inside the live Figma file. It also ' +
    'rewrites parity/report.json on every run, so it would dirty the checkout. The differ logic is ' +
    'covered by the C3-detection eval family in the full lane.',
  'seed:verify':
    'Regenerates library seeds from committed capture configs; it is an authoring instrument, not a ' +
    'drift gate — figma:fresh and dagger:census are what hold the committed artifacts still.',
  'extract:computed:drift':
    'Needs a banked capture directory under extract/computed/out/** whose transient surfaces are ' +
    'gitignored; it replays a capture rather than asserting an invariant. The stylesheet-ceiling ' +
    'gate is the part of that pipeline with a fixture, and it runs in the full lane.',
  'mint:code:check':
    'Superseded surface kept for the code-side mint path; core/mint-check.ts (mint:check, full lane) ' +
    'is the gate the minting invariants are pinned in. Listed here so its absence is visible.',
};

const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};
const scripts = Object.keys(pkg.scripts);

interface Step {
  name?: string;
  run?: string;
  if?: string;
}
const invocations = new Map<string, Set<string>>(); // script → lanes
const problems: string[] = [];
const RUN_RE = /npm(?:\s+--prefix\s+(\S+))?\s+run\s+([A-Za-z0-9:_-]+)/g;

const workflows = readdirSync(WF_DIR).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
if (workflows.length === 0) problems.push('.github/workflows contains no workflow at all');

for (const file of workflows) {
  const lane = file.replace(/\.ya?ml$/, '');
  const raw = readFileSync(path.join(WF_DIR, file), 'utf8');
  let doc: { jobs?: Record<string, { steps?: Step[] }> };
  try {
    doc = parseYaml(raw);
  } catch (e) {
    problems.push(`${file} does not parse as YAML: ${(e as Error).message}`);
    continue;
  }
  for (const job of Object.values(doc.jobs ?? {})) {
    for (const step of job.steps ?? []) {
      const run = step.run ?? '';
      RUN_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = RUN_RE.exec(run)) !== null) {
        const [, prefix, name] = m;
        // packages/cli has its own script table; only root scripts are gates here.
        if (prefix) continue;
        if (!scripts.includes(name)) {
          problems.push(
            `${file} step "${step.name ?? run.trim()}" runs \`npm run ${name}\` — no such script in package.json`,
          );
          continue;
        }
        invocations.set(name, (invocations.get(name) ?? new Set()).add(lane));

        // (4) the independent-reporting guard.
        if ((lane === 'fast' || lane === 'full') && isGate(name)) {
          if (!(step.if ?? '').includes("steps.setup.outcome == 'success'")) {
            problems.push(
              `${file} gate step "${step.name ?? name}" has no \`steps.setup.outcome == 'success'\` guard — ` +
                `a red gate before it would stop the job and hide this one`,
            );
          }
        }
      }
    }
  }
}

// (1) every gate-shaped script is in a lane or named as excluded.
const gates = scripts.filter(isGate).sort();
const uncovered: string[] = [];
console.log(`GATE COVERAGE — ${gates.length} gate-shaped script(s) in package.json\n`);
for (const g of gates) {
  const lanes = invocations.get(g);
  if (lanes) console.log(`  ✔ ${g.padEnd(34)} ${[...lanes].sort().join(' + ')}`);
  else if (g in EXCLUDED) console.log(`  – ${g.padEnd(34)} EXCLUDED BY NAME`);
  else {
    console.log(`  ✖ ${g.padEnd(34)} NO LANE, NO REASON`);
    uncovered.push(g);
  }
}
for (const g of uncovered) {
  problems.push(
    `\`npm run ${g}\` is gate-shaped but no workflow runs it and EXCLUDED gives no reason — ` +
      `wire it into a lane, or add it to EXCLUDED in .github/scripts/lane-coverage.ts with why`,
  );
}

// (3) the exclusion list stays true.
for (const [name, reason] of Object.entries(EXCLUDED)) {
  if (!scripts.includes(name)) {
    problems.push(`EXCLUDED names "${name}", which is no longer a script — delete the stale reason`);
  }
  if (invocations.has(name)) {
    problems.push(
      `EXCLUDED says "${name}" does not run in CI, but ${[...invocations.get(name)!].join(', ')} runs it — ` +
        `one of the two is a lie. Reason on file: ${reason.slice(0, 80)}…`,
    );
  }
}

console.log(`\nEXCLUDED BY NAME (${Object.keys(EXCLUDED).length}):`);
for (const [name, reason] of Object.entries(EXCLUDED)) console.log(`  · ${name} — ${reason}`);

if (problems.length) {
  console.error(`\n✖ ${problems.length} lane defect(s):`);
  for (const p of problems) console.error(`    ${p}`);
  process.exit(1);
}
console.log(
  `\n✔ every gate-shaped script is either wired into a lane or excluded with a reason; ` +
    `every lane invocation resolves to a real script; every gate step reports independently.`,
);
