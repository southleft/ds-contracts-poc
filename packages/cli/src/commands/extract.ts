/**
 * `ds-contracts extract` — brownfield extraction over the SAME code path as
 * the reference repo's `npm run extract:code` (extract/run.ts, react-tsx +
 * cem adapters), config-driven (ds-contracts.config.json or an explicit
 * path).
 *
 *   ds-contracts extract [config.json]            code → proposed contracts
 *   ds-contracts extract --reconcile [config]     + design dump → disagreement report
 *   ds-contracts extract --computed --config <capture.json> [--harness <dir>] [--out <dir>] [--root <dir>]
 *
 * The computed path (real-browser computed-style capture) is the one
 * browser-dependent verb: it lives in a separately bundled chunk that is
 * imported LAZILY, and playwright-core is an optionalDependency — when the
 * package or its Chromium is absent the verb degrades with a named message
 * (exit 3) instead of an unnamed module crash.
 */
import { existsSync } from 'node:fs';
import { runExtractCommand } from '../../../../extract/run.js';
import { CliUsageError, flagString, parseFlags } from '../lib.js';
import { CONFIG_FILENAME } from './init.js';

export const COMPUTED_DEGRADE_MESSAGE =
  '✘ extract --computed needs the real-browser capture harness, which is not available here:\n' +
  '  playwright-core (an optional dependency) or its Chromium binary is missing.\n' +
  '  Install them:  npm i playwright-core && npx playwright-core install chromium\n' +
  '  (or set PLAYWRIGHT_CHROMIUM_PATH to an existing Chromium).\n' +
  '  Every other verb works without a browser — only computed-style capture degrades.';

export async function extractCommand(argv: string[]): Promise<number> {
  const parsed = parseFlags(argv, {
    value: ['config', 'harness', 'out', 'root', 'component'],
    bool: ['computed', 'reconcile'],
  });

  if (parsed.flags.get('computed') === true) {
    const config = flagString(parsed, 'config');
    if (!config) {
      throw new CliUsageError(
        'extract --computed needs --config <capture-config.json> (the CaptureConfig shape — see extract/computed/configs/polaris.json in the reference repo)',
      );
    }
    if (!existsSync(config)) throw new CliUsageError(`--config not found: ${config}`);
    // process.argv already carries --config/--harness/--out/--root/--component;
    // the computed runner reads them itself (one arg surface, two shells).
    // Non-literal specifier: dist/computed.js is a SEPARATE esbuild chunk
    // (playwright-core external) resolved beside dist/cli.js at runtime — the
    // lazy boundary that keeps the CLI itself browser-free.
    const computedChunk = new URL('./computed.js', import.meta.url).href;
    try {
      await import(computedChunk);
    } catch (err) {
      const msg = String(err instanceof Error ? err.message : err);
      if (/playwright-core|Chromium|browser cache|ERR_MODULE_NOT_FOUND|Cannot find (module|package)/i.test(msg)) {
        console.error(COMPUTED_DEGRADE_MESSAGE);
        console.error(`  (underlying: ${msg.split('\n')[0]})`);
        return 3;
      }
      throw err;
    }
    return 0;
  }

  const configArg =
    parsed.positionals[0] ??
    flagString(parsed, 'config') ??
    (existsSync(CONFIG_FILENAME) ? CONFIG_FILENAME : undefined);
  runExtractCommand(parsed.flags.get('reconcile') === true ? 'reconcile' : 'code', configArg);
  return 0;
}
