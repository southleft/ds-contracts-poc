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
import { onboardCommand, promoteCommand } from './commands/onboard.js';
import { extractCommand } from './commands/extract.js';
import { generateCommand } from './commands/generate.js';
import { figmaCommand } from './commands/figma.js';
import { diffCommand } from './commands/diff.js';
import { proposePrCommand } from './commands/propose-pr.js';
import { migrateCommand } from './commands/migrate.js';

declare const __DS_CONTRACTS_CLI_VERSION__: string;
const VERSION = typeof __DS_CONTRACTS_CLI_VERSION__ === 'string' ? __DS_CONTRACTS_CLI_VERSION__ : 'dev';

const USAGE = `ds-contracts ${VERSION} — contracts as the deterministic bridge between design and code

Usage: ds-contracts <command> [options]

Commands:
  onboard <package-or-path>                   PHASE 1 of the code → canvas pipeline: detect the
          [--components a,b,c]                adapter/styling, create or reuse a sandbox (a PATH
          [--workspace <dir>] [--force]       is npm-packed to a tarball so its deps really
                                              install; an npm PACKAGE is extracted from its
                                              INSTALLED copy — a dist-only package is refused by
                                              name, the cwd's own repo is never extracted), seed
                                              contracts from the static pass, DRAFT the capture
                                              config — then STOP at the review gate and print
                                              what a human must decide and why. A target with no
                                              token file gets a SKELETON DTCG (author it before
                                              phase 2's promote; flat leaf names = css var minus
                                              "--"). A directory that already carries a
                                              ds-library.json is ADOPTED. (--force starts a NEW
                                              onboarding over a workspace that already has one
                                              in flight; it does NOT skip the phase-2 review
                                              gate — nothing does.)
  onboard --continue                          PHASE 2: capture → promote → emit → bundle →
          [--channel-key K] [--dry-run]       publish to the standing channel. The designer
          [--bridge <url>]                    clicks "Check for updates" — NO JSON ON A CLIPBOARD.
          [--from capture|promote|emit|       REFUSES an unreviewed capture config by name; there
                bundle|publish]               is no flag that skips the gate (--from resumes a
                                              run over artifacts that already exist; the gate
                                              still runs first, whatever stage you resume from)
  promote --config <ds-library.json>          computed-capture artifacts → promoted contracts +
                                              minted token tree (source-alias pass, provenance
                                              anchors, statePreviews probe, resolution
                                              guard). Also runs as onboard's promote stage.
  init [--detect] [--force]                   write ds-contracts.config.json here (--detect
                                              prefills adapter/root/tokens + styling hints from
                                              the repo — marked detected, NOT confirmed;
                                              --force overwrites an existing config)
  extract [config] [--reconcile]              code → proposed contracts (react-tsx | cem adapter)
          [--draft-capture-config]            + DRAFT computed-capture config with "__review:*"
                                              markers (the capture runner refuses it unreviewed)
          [--accept-candidates exact|<file>]  + bulk raw-value → token acceptance: unique
                                              exact-value candidates only, every acceptance
                                              ledgered, ambiguity refused by name
  extract --computed --config <capture.json>  real-browser computed-style capture
          [--harness <dir>] [--out <dir>]     (needs playwright-core + Chromium; degrades by name)
  generate <contracts..> --out <dir>          contract → code
          [--target react|html|react-inline|figma-script|code-connect|<registered>]
          [--tokens f,f] [--icons dir] [--stories] [--emitter <module>]
  figma <contracts..> --out <dir>             contract → Figma sync scripts
          [--tokens f,f] [--icons dir] [--file-key KEY]
  figma bundle <contracts..> --out <file>     contracts + tokens → ONE self-contained
          --tokens <base[,minted]>            CONTRACTS-BUNDLE JSON (the only thing a user
                 | <dir> | <slot>=<file>,…    pastes into the plugin — it syncs the tokenSet
          [--modes <light[,dark]>]            as a named collection, or a LAYERED set as
          [--name <collection>]               Primitives / Brand / Semantic, and builds the
          [--icons dir]                       components; every contract is COMPILED here
                                              and a refusal lists every contract by name;
                                              icon assets referenced by the contracts embed
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
                                              local diff (writes NOTHING without --apply). With
                                              --apply it ALSO generates the component code that
                                              contract produces — same as propose-pr, from the
                                              generate section of ds-contracts.config.json; with
                                              no recorded target it says so and writes no code.
  diff [config]                               parity referee: contracts vs code/design
                                              exit 0 clean · 1 drift · 2 error
  migrate <paths..> [--check]                 schema 17 codemod: rewrite every JSON document
                                              under <paths> from the v16 spellings
                                              (figmaRepresentation, figmaStatePreviews,
                                              anchors.*, slot.figmaProperty) to bindings.<surface>.*;
                                              --check writes nothing, exit 1 if any remain
  propose-pr <file> --repo owner/name         open the contract change + generated code as one PR
          [--token t] [--base b] [--path p] [--title t] [--target t]
          [--code-path d] [--tokens f,f] [--icons d] [--stories]
          [--no-code] [--dry-run]             (targets are never guessed: --target wins, else the
                                              "generate" block of ds-contracts.config.json, else
                                              the contract alone AND the body says so)

--tokens on generate / figma / propose-pr takes any mix of:
  path/to/file.dtcg.json    a DTCG file
  path/to/dir               a DIRECTORY — every *.tokens.json / *.dtcg.json
                            inside it, recursive and sorted
  slot=path/to/file.json    an explicit SLOT: primitives | semantic | light |
                            dark | brand | brand.<name>
Each file is routed to one slot. Unnamed files follow the *.tokens.json layer
convention (brand.<n>.tokens.json, *.light.*, *.dark.*, *semantic*,
*primitives*); anything else is a flat foreign set and lands in primitives.
Two files that define the SAME token differently inside ONE slot are refused
by name — a light tree merged over a dark one emits a dark component whose
own header says light, so the merge that would hide it is not allowed.

On "figma bundle", --tokens is the same FLAG (never positional) and takes
ONE of two shapes — a FLAT set: <base[,minted]> (one flat DTCG base file,
optionally the minted tree second; base=/minted= name them; --modes adds
light/dark overrides of base) — or a LAYERED set: a directory, or slot=file
entries (primitives, semantic, light, dark, brand, brand.<name>; bare
*.tokens.json files follow the layer convention; --modes fills light/dark).
Mixing the two is refused by name. A layered set lands in the plugin as the
Primitives / Brand / Semantic collections, and contract refs resolve through
primitives → brand.default → semantic → light, as the repo's own CSS does.

ds-contracts <command> --help prints that command's section from this reference.
`;

const COMMAND_HELP: Record<string, string> = {
  onboard: `ds-contracts onboard — code → canvas pipeline (two phases)

Phase 1:
  ds-contracts onboard <package-or-path>
    [--components a,b,c] [--workspace <dir>] [--force]

  Detect adapter/styling, seed contracts, DRAFT capture config, then STOP at
  the human review gate. --force restarts phase 1 over an in-flight workspace;
  it does NOT skip the phase-2 review gate.

Phase 2:
  ds-contracts onboard --continue
    [--channel-key K] [--dry-run] [--bridge <url>]
    [--from capture|promote|emit|bundle|publish]

  Capture → promote → emit → bundle → publish. Refuses an unreviewed capture
  config by name. --from resumes a stage; the review gate still runs first.

Also:
  ds-contracts promote --config <ds-library.json>
`,
  promote: `ds-contracts promote --config <ds-library.json>

Computed-capture artifacts → promoted contracts + minted token tree
(source-alias pass, provenance anchors, bindings.figma.statePreviews, resolution guard).
Also runs as onboard's promote stage.
`,
  init: `ds-contracts init [--detect] [--force]

Write ds-contracts.config.json here.
  --detect  prefills adapter/root/tokens + styling hints (detected, not confirmed)
  --force   overwrite an existing config
`,
  extract: `ds-contracts extract — code → proposed contracts

  extract [config] [--reconcile]
  extract [--draft-capture-config]
  extract [--accept-candidates exact|<file>]
  extract --computed --config <capture.json>
           [--harness <dir>] [--out <dir>]

Static adapters: react-tsx | cem.
--draft-capture-config writes a capture config with __review:* markers (refused
until reviewed). --computed needs playwright-core + Chromium.
`,
  generate: `ds-contracts generate <contracts..> --out <dir>
  [--target react|html|react-inline|figma-script|code-connect|<registered>]
  [--tokens f,f] [--icons dir] [--stories] [--emitter <module>]

Contract → code. See top-level --help for --tokens slot routing.
`,
  figma: `ds-contracts figma — contract ↔ Figma surfaces

  figma <contracts..> --out <dir> [--tokens f,f] [--icons dir] [--file-key KEY]
  figma bundle <contracts..> --out <file> --tokens <base[,minted]> | <dir> | <slot>=<file>,…
       [--modes <light[,dark]>] [--name <collection>] [--icons dir]
  figma push <file> --code <CODE> [--bridge <url>]
  figma claim-channel [--bridge <url>]
  figma publish <file> [--channel-key K] [--bridge <url>] [--dry-run]
       [--repo o/n] [--run-id] [--commit] [--ref] [--run-url] [--no-provenance]
  figma receive --out <contracts-dir> [--bridge <url>] [--apply]

Bundle is the one-paste CONTRACTS-BUNDLE. receive writes nothing without --apply.
`,
  diff: `ds-contracts diff — parity referee / English summarizer

  diff [config]
    Contracts vs code/design. Exit 0 clean · 1 drift · 2 config error.

  diff --summarize --base <before.json> <after.json>
    English per-channel contract diff (docs/18 G11). Exit 0 if identical,
    1 if channels changed, 2 on usage/config errors.
`,
  migrate: `ds-contracts migrate <paths..> [--check] [--quiet]

The schema 17 codemod. Rewrites every *.json under <paths> (files or
directories; node_modules/.git/dist skipped) from the v16 contract spellings
to v17 — the ONE rename table @ds-contracts/schema ships:
  figmaRepresentation        → bindings.figma.representation
  figmaStatePreviews         → bindings.figma.statePreviews
  anchors.figma              → bindings.figma.anchors
  anchors.code               → bindings.code.anchors
  <part>.slot.figmaProperty  → <part>.slot.bindings.figma.property
Files without a v16 spelling are untouched. Each rewritten file keeps its own
indentation and trailing newline; a file that cannot round-trip byte-for-byte
is REFUSED by name (exit 1), never reformatted. --check: write nothing, exit 1
while any file still carries a v16 spelling.
`,
  'propose-pr': `ds-contracts propose-pr <file> --repo owner/name
  [--token t] [--base b] [--path p] [--title t] [--target t]
  [--code-path d] [--tokens f,f] [--icons d] [--stories]
  [--no-code] [--dry-run]

Open the contract change + generated code as one PR. Token:
--token, DS_CONTRACTS_GITHUB_TOKEN, or GITHUB_TOKEN (in memory only).
`,
};

function wantsHelp(argv: string[]): boolean {
  return argv.some((a) => a === '--help' || a === '-h' || a === 'help');
}

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
    case 'onboard':
    case 'promote':
    case 'init':
    case 'extract':
    case 'generate':
    case 'figma':
    case 'diff':
    case 'propose-pr':
    case 'migrate':
      if (wantsHelp(rest)) {
        console.log(COMMAND_HELP[command] ?? USAGE);
        return 0;
      }
      break;
    default:
      break;
  }
  switch (command) {
    case 'onboard':
      return onboardCommand(rest);
    case 'promote':
      return promoteCommand(rest);
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
    case 'migrate':
      return migrateCommand(rest);
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
  // An unexpected throw is a defect in this tool, not a refusal: the stack is
  // the receipt. Opt in with DS_CONTRACTS_STACK=1 so the default output stays
  // one line for adopters.
  if (process.env.DS_CONTRACTS_STACK && err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
}
