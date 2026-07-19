/**
 * `ds-contracts diff [config]` — the parity referee over surfaces this CLI
 * did NOT generate (parity/diagnose.ts, one code path with `npm run
 * diagnose`): contracts ⟷ code (react-tsx | cem adapter) and, when a design
 * dump is configured, contracts ⟷ design.
 *
 * CI exit codes: 0 clean · 1 drift (findings named on stderr, report JSON
 * written) · 2 configuration/input error.
 */
import { existsSync } from 'node:fs';
import { runDiagnose } from '../../../../parity/diagnose.js';
import { flagString, parseFlags } from '../lib.js';
import { CONFIG_FILENAME } from './init.js';

export function diffCommand(argv: string[]): number {
  const parsed = parseFlags(argv, { value: ['config'] });
  const configArg =
    parsed.positionals[0] ??
    flagString(parsed, 'config') ??
    (existsSync(CONFIG_FILENAME) ? CONFIG_FILENAME : undefined);
  return runDiagnose(configArg);
}
