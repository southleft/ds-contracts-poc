/**
 * Aggregates adherence-judge results for the A/B eval:
 *   arm-a: generated WITH the catalog + rules in context
 *   arm-b: generated with only the package + component names (no APIs)
 *
 * Generation is the (documented) agent step; judging and aggregation are
 * deterministic and re-runnable: `tsx evals/adherence/aggregate.ts`.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIR = path.join(ROOT, 'evals', 'adherence');
const TSX = path.join(ROOT, 'node_modules', '.bin', 'tsx');

interface Report {
  file: string;
  elements: number;
  checks: number;
  violations: Array<{ rule: string; detail: string }>;
  score: number;
  adherent: boolean;
}

function judgeArm(arm: string): Report[] {
  const files = readdirSync(path.join(DIR, arm))
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => path.join(DIR, arm, f));
  const out = path.join(DIR, `${arm}-reports.json`);
  try {
    execFileSync(TSX, ['parity/judge.ts', ...files, '--json', out], { cwd: ROOT, stdio: 'pipe' });
  } catch {
    /* non-zero exit = violations found; reports still written */
  }
  return JSON.parse(readFileSync(out, 'utf8')).reports;
}

const arms = { 'arm-a': judgeArm('arm-a'), 'arm-b': judgeArm('arm-b') };

const summary = Object.fromEntries(
  Object.entries(arms).map(([arm, reports]) => {
    const violationsByRule: Record<string, number> = {};
    for (const r of reports) {
      for (const v of r.violations) violationsByRule[v.rule] = (violationsByRule[v.rule] ?? 0) + 1;
    }
    return [
      arm,
      {
        screens: reports.length,
        adherentScreens: reports.filter((r) => r.adherent).length,
        meanScore: Math.round(reports.reduce((s, r) => s + r.score, 0) / reports.length),
        totalViolations: reports.reduce((s, r) => s + r.violations.length, 0),
        totalChecks: reports.reduce((s, r) => s + r.checks, 0),
        violationsByRule,
        perScreen: reports.map((r) => ({
          file: path.basename(r.file),
          score: r.score,
          violations: r.violations.length,
          adherent: r.adherent,
        })),
      },
    ];
  }),
);

writeFileSync(path.join(DIR, 'results.json'), JSON.stringify({ summary, arms }, null, 2) + '\n');

console.log('Adherence A/B results');
for (const [arm, s] of Object.entries(summary) as Array<[string, any]>) {
  console.log(
    `  ${arm}: mean score ${s.meanScore} · ${s.adherentScreens}/${s.screens} screens fully adherent · ${s.totalViolations} violations across ${s.totalChecks} checks`,
  );
  for (const p of s.perScreen) {
    console.log(`      ${p.adherent ? '✔' : '✖'} ${p.file} — ${p.score} (${p.violations} violations)`);
  }
}
