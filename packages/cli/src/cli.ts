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
  init [--detect]                             write ds-contracts.config.json here (--detect
                                              prefills adapter/root/tokens + styling hints from
                                              the repo — marked detected, NOT confirmed)
  extract [config] [--reconcile]              code → proposed contracts (react-tsx | cem adapter)
          [--draft-capture-config]            + DRAFT computed-capture config with "__review:*"
                                              markers (the capture runner refuses it unreviewed)
          [--accept-candidates exact|<file>]  + bulk raw-value → token acceptance: unique
                                              exact-value candidates only, every acceptance
                                              ledgered, ambiguity refused by name
  extract --computed --config <capture.json>  real-browser computed-style capture
          [--harness <dir>] [--out <dir>]     (needs playwright-core + Chromium; degrades by name)
  generate <contracts..> --out <dir>          contract → code
          [--target react|html|react-inline|figma-script|<registered>]
          [--tokens f,f] [--icons dir] [--stories] [--emitter <module>]
  figma <contracts..> --out <dir>             contract → Figma sync scripts
          [--tokens f,f] [--icons dir] [--file-key KEY]
  figma bundle <contracts..> --out <file>     contracts + tokens → ONE self-contained
          --tokens <base[,minted]>            CONTRACTS-BUNDLE JSON (the only thing a user
          [--modes <light[,dark]>]            pastes into the plugin — it syncs the tokenSet
          [--name <collection>]               as a named collection and builds the components;
          [--icons dir]                       icon assets referenced by the contracts embed
                                              as SVG text — required when refs exist;
                                              deterministic: same inputs → identical bytes)
  figma push <file> --code <CODE>             send a CONTRACTS-BUNDLE to the plugin bridge
          [--bridge <url>]                    (pairing-code flow, deliver-once, 15-min TTL —
                                              the ad-hoc path: both people, same minute)
  figma claim-channel [--bridge <url>]        mint a STANDING CI↔Figma channel: a write key
                                              (a CI secret — it publishes) + a read key
                                              (sha256 of it — the half the designer pastes
                                              into the plugin; it can never publish)
  figma publish <file> [--channel-key K]      publish a CONTRACTS-BUNDLE to that channel —
          [--bridge <url>] [--dry-run]        CI pushes whenever, the designer checks
          [--repo o/n] [--run-id] [--commit]  whenever, neither waits. GitHub Actions
          [--ref] [--run-url]                 context auto-detects into a provenance
          [--no-provenance]                   SIBLING (never inside the bundle bytes).
                                              Key: --channel-key or DS_CONTRACTS_CHANNEL_KEY,
                                              in memory only, never persisted or logged.
  figma receive --out <contracts-dir>         the dev door: print a pairing code, wait for the
          [--bridge <url>] [--apply]          plugin's proposed contract, land it as a reviewed
                                              local diff (writes NOTHING without --apply)
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
