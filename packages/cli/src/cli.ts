/**
 * ds-contracts — the CLI entry. Thin dispatch over command modules; every
 * verb is a shell around the SAME engine the reference repo's npm scripts
 * run (core barrel + extraction + diagnose + generator), esbuild-bundled so
 * an install carries zero required runtime dependencies (playwright-core is
 * optional, loaded lazily by `extract --computed`).
 */
import { CliUsageError } from './lib.js';
import { ContractViolationError } from '../../../scripts/generate-components.js';
import { initCommand } from './commands/init.js';
import { extractCommand } from './commands/extract.js';
import { generateCommand } from './commands/generate.js';
import { figmaCommand } from './commands/figma.js';
import { diffCommand } from './commands/diff.js';
import { proposePrCommand } from './commands/propose-pr.js';

declare const __DS_CONTRACTS_CLI_VERSION__: string;
const VERSION = typeof __DS_CONTRACTS_CLI_VERSION__ === 'string' ? __DS_CONTRACTS_CLI_VERSION__ : 'dev';

const USAGE = `ds-contracts ${VERSION} — contracts as the deterministic bridge between design and code

Usage: ds-contracts <command> [options]

Commands:
  init                                        write ds-contracts.config.json here
  extract [config] [--reconcile]              code → proposed contracts (react-tsx | cem adapter)
  extract --computed --config <capture.json>  real-browser computed-style capture
          [--harness <dir>] [--out <dir>]     (needs playwright-core + Chromium; degrades by name)
  generate <contracts..> --out <dir>          contract → code
          [--target react|html|react-inline|figma-script|<registered>]
          [--tokens f,f] [--icons dir] [--stories] [--emitter <module>]
  figma <contracts..> --out <dir>             contract → Figma sync scripts
          [--tokens f,f] [--icons dir] [--file-key KEY]
  figma push <file> --code <CODE>             send a CONTRACTS-BUNDLE to the plugin bridge
          [--bridge <url>]                    (pairing-code flow, deliver-once, 15-min TTL)
  diff [config]                               parity referee: contracts vs code/design
                                              exit 0 clean · 1 drift · 2 error
  propose-pr <file> --repo owner/name         open the contract change as a reviewable PR
          [--token t] [--base b] [--path p] [--dry-run]

ds-contracts <command> --help shows nothing extra yet — this block is the reference.
`;

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2);
  switch (command) {
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      console.log(USAGE);
      return command === undefined ? 2 : 0;
    case '--version':
    case '-v':
      console.log(VERSION);
      return 0;
    case 'init':
      return initCommand(rest);
    case 'extract':
      return extractCommand(rest);
    case 'generate':
      return generateCommand(rest);
    case 'figma':
      return figmaCommand(rest);
    case 'diff':
      return diffCommand(rest);
    case 'propose-pr':
      return proposePrCommand(rest);
    default:
      console.error(`Unknown command "${command}"\n\n${USAGE}`);
      return 2;
  }
}

try {
  process.exit(await main());
} catch (err) {
  if (err instanceof CliUsageError) {
    console.error(`✘ ${err.message}`);
    process.exit(2);
  }
  if (err instanceof ContractViolationError) {
    // Same wording as the repo generator shell — named refusals, exit 1.
    console.error(err.header);
    for (const e of err.violations) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.error(`✘ ${String(err instanceof Error ? err.message : err)}`);
  process.exit(1);
}
