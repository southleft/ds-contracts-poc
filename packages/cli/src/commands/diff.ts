/**
 * `ds-contracts diff [config]` — the parity referee over surfaces this CLI
 * did NOT generate (parity/diagnose.ts, one code path with `npm run
 * diagnose`): contracts ⟷ code (react-tsx | cem adapter) and, when a design
 * dump is configured, contracts ⟷ design.
 *
 * `ds-contracts diff --summarize --base <file> <file>` — English per-channel
 * contract diff (docs/18 G11 precursor) using `core/contract-summarize`.
 *
 * CI exit codes: 0 clean · 1 drift (findings named on stderr, report JSON
 * written) · 2 configuration/input error.
 */
import { existsSync, readFileSync } from 'node:fs';
import { runDiagnose } from '../../../../parity/diagnose.js';
import { summarizeContractDiff } from '../../../../core/contract-summarize.js';
import { CliUsageError, flagString, parseFlags } from '../lib.js';
import { CONFIG_FILENAME } from './init.js';

export function diffCommand(argv: string[]): number {
  const parsed = parseFlags(argv, { value: ['config', 'base'], bool: ['summarize'] });
  if (parsed.flags.get('summarize') === true) {
    const basePath = flagString(parsed, 'base');
    const other = parsed.positionals[0];
    if (!basePath || !other) {
      throw new CliUsageError(
        'diff --summarize needs --base <before.json> and a second contract JSON path',
      );
    }
    if (!existsSync(basePath)) throw new CliUsageError(`diff: base file not found: ${basePath}`);
    if (!existsSync(other)) throw new CliUsageError(`diff: file not found: ${other}`);
    let before: unknown;
    let after: unknown;
    try {
      before = JSON.parse(readFileSync(basePath, 'utf8'));
      after = JSON.parse(readFileSync(other, 'utf8'));
    } catch (e) {
      throw new CliUsageError(`diff: invalid JSON — ${(e as Error).message}`);
    }
    const lines = summarizeContractDiff(before, after);
    if (lines.length === 0) {
      console.log('No channel changes.');
      return 0;
    }
    for (const line of lines) console.log(line);
    return 1;
  }

  const configArg =
    parsed.positionals[0] ??
    flagString(parsed, 'config') ??
    (existsSync(CONFIG_FILENAME) ? CONFIG_FILENAME : undefined);
  // The header above (and three docs, and examples/ci/design-led.yml) promise
  // exit 2 for a configuration/input error — but diagnose throws plain Errors,
  // which the shell maps to 1, so a malformed config and REAL drift were
  // indistinguishable to CI (verified by execution, 2026-08-03). Config-shaped
  // failures become usage errors here; genuine drift/runtime keeps exit 1.
  if (configArg !== undefined) {
    if (!existsSync(configArg)) throw new CliUsageError(`diff: config file not found: ${configArg}`);
    try {
      JSON.parse(readFileSync(configArg, 'utf8'));
    } catch (e) {
      throw new CliUsageError(`diff: config file is not valid JSON (${configArg}): ${(e as Error).message}`);
    }
  }
  try {
    return runDiagnose(configArg);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err?.code === 'ENOENT') {
      throw new CliUsageError(`diff: a path the config names does not exist — ${err.message}`);
    }
    throw e;
  }
}
