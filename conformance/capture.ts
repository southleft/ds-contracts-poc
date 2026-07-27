/**
 * CSS/DOM CONFORMANCE FIXTURE — capture driver.
 *
 *   npm run conformance:capture
 *
 * Runs the UNMODIFIED `extract/computed/run.ts` over the fixture, ONE CASE PER
 * INVOCATION, and records each run's stdout.
 *
 * Why per-case and not one sweep: the production runner THROWS on the first
 * component whose enriched contract fails generator validation, which aborts
 * the whole round. That is a real finding in its own right (a single
 * unregistered channel stops a whole library onboarding), and the fixture must
 * survive it to measure the other 52 cases. Per-case invocation costs a harness
 * rebuild each time and buys independence — no engine change.
 *
 * The stdout log is not a convenience: `the run's stdout` is one of the six
 * artifacts in the SILENT-LOSS union, so it has to be captured to be searched.
 *
 * Requires a local Chromium (playwright cache / system Chrome /
 * PLAYWRIGHT_CHROMIUM_PATH — the visual-parity discovery convention). The GATE
 * (`npm run conformance`) never launches a browser: it reads these artifacts.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { build, buildSandbox, exportNameFor, HERE, outDirFor, REPO } from './build.js';

export const OUT_ROOT = path.join(REPO, 'extract', 'computed', 'out', 'conformance');
export const LOG_DIR = path.join(OUT_ROOT, '_logs');

/** The only bytes in a run's stdout that are NOT a function of the fixture:
 *  elapsed time (the clock) and absolute paths (the machine). A committed
 *  artifact that encodes either is not evidence, it is churn — and the
 *  absolute path matters twice over, because these logs are one of the six
 *  sources the SILENT-LOSS naming union is searched over. */
const normalizeLog = (s: string): string =>
  s
    .split(REPO + '/').join('')
    .replace(/done in \d+s/g, 'done in <elapsed>')
    .replace(/\bbrowser \d+\.[\d.]+/g, 'browser <pinned>');

function main(): void {
  const only = (() => {
    const i = process.argv.indexOf('--case');
    return i > -1 ? process.argv[i + 1] : null;
  })();
  const { cases } = build();
  const harness = buildSandbox();
  if (!only) rmSync(OUT_ROOT, { recursive: true, force: true });
  mkdirSync(LOG_DIR, { recursive: true });

  const rows: Array<{ id: string; status: number; artifacts: boolean }> = [];
  const subject = only ? cases.filter((c) => c.id === only) : cases;
  if (subject.length === 0) throw new Error(`no case named "${only}"`);

  for (const c of subject) {
    const r = spawnSync(
      'npx',
      [
        'tsx', 'extract/computed/run.ts',
        '--harness', path.relative(REPO, harness),
        '--config', path.relative(REPO, path.join(HERE, 'conformance.config.json')),
        '--out', path.relative(REPO, OUT_ROOT),
        '--component', exportNameFor(c.id),
      ],
      { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );
    const log = normalizeLog(`${r.stdout ?? ''}${r.stderr ?? ''}`);
    writeFileSync(path.join(LOG_DIR, `${c.id}.log`), log);
    const artifacts = existsSync(path.join(OUT_ROOT, outDirFor(c.id), 'captured-truth.json'));
    rows.push({ id: c.id, status: r.status ?? -1, artifacts });
    console.log(
      `${r.status === 0 ? '✔' : '✖'} ${c.id.padEnd(38)} exit ${String(r.status).padStart(2)}  ${artifacts ? 'artifacts' : 'NO ARTIFACTS (run aborted before the write phase)'}`,
    );
  }

  const aborted = rows.filter((r) => !r.artifacts);
  console.log(
    `\nconformance:capture — ${rows.length} cases, ${rows.length - aborted.length} produced artifacts, ${aborted.length} aborted${aborted.length ? `: ${aborted.map((a) => a.id).join(', ')}` : ''}`,
  );
}

main();
