/**
 * FIGMA SYNC SCRIPTS — FRESHNESS GATE.
 *
 *   node scripts/figma-scripts-fresh.mjs
 *
 * WHY THIS EXISTS, precisely. The MUI regen round (task #31) opened with a
 * known fact: MUI's committed `examples/mui/figma/*.figma.js` were STALE by
 * three engine fixes the Carbon round had already landed. The suite was
 * 167/167 green the whole time. That is not a near miss — it is a
 * demonstration that nothing in this repo compared a committed sync script to
 * a fresh emission.
 *
 * The reason the existing gates could not see it is worth writing down:
 *   · the per-library compile receipts EXECUTE the committed scripts against
 *     the mocked Figma and assert structure. A stale script executes fine.
 *   · `mui-figma-genesis` DOES byte-compare a rebuild — but of
 *     `mui.bundle.json`, which is contracts + tokens. The engine's OUTPUT is
 *     not in it, so the bundle stayed byte-fresh while the compiled scripts
 *     rotted.
 *   · `plugin-engine-check`'s bundle≡script equivalence pins compare SET
 *     SHAPES, variant counts and the variable name inventory. All three fixes
 *     changed geometry and node kind, and moved none of those numbers.
 *
 * So: re-emit each library's scripts into a temp dir with the same command its
 * own compile receipt documents, and byte-compare. A library with committed
 * figma scripts and no row here is reported BY NAME as an ungated surface —
 * "there is a figma directory" and "there is a freshness row" must be the
 * same fact, or this gate rots the way the artifacts did.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TSX = path.join(ROOT, 'node_modules', '.bin', 'tsx');
const CLI = 'packages/cli/src/cli.ts';

/** The emit command each library's own COMPILE-RECEIPT.md header documents. */
const LIBRARIES = {
  mui: ['--icons', 'examples/mui/assets/icons', '--tokens', 'examples/mui/tokens/mui.dtcg.json,examples/mui/tokens/mui-minted.dtcg.json'],
  carbon: ['--icons', 'examples/carbon/assets/icons', '--tokens', 'examples/carbon/tokens/carbon.dtcg.json,examples/carbon/tokens/carbon-minted.dtcg.json'],
  altitude: ['--icons', 'examples/altitude/assets/icons', '--tokens', 'examples/altitude/tokens/altitude.dtcg.json,examples/altitude/tokens/altitude-minted.dtcg.json'],
  tailwind: ['--tokens', 'examples/tailwind/tokens/tailwind.dtcg.json,examples/tailwind/tokens/tailwind-minted.dtcg.json'],
  astryx: ['--tokens', 'examples/astryx/tokens/astryx.dtcg.json,examples/astryx/tokens/astryx-minted.dtcg.json'],
};

/** NOT a silent omission — a NAMED hole, printed on every run.
 *  Polaris's committed scripts were emitted by `scripts/generate-figma.ts`
 *  (the repo's own emitter, through the PROVISIONAL-minting path), not by the
 *  CLI `figma` command the other five use, and that command has never been
 *  written down anywhere in the repo. Reproducing it is its own task; until
 *  then polaris's scripts are the one un-freshness-gated surface, and this
 *  gate says so out loud rather than quietly skipping the directory. */
const NAMED_HOLES = {
  polaris: 'emitted by scripts/generate-figma.ts through the provisional-minting path, not the CLI `figma` command — the exact invocation is not recorded anywhere in the repo, so a fresh rebuild cannot be reproduced yet',
};

const failures = [];
const rows = [];

const figmaDirs = readdirSync(path.join(ROOT, 'examples'), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .filter((n) => existsSync(path.join(ROOT, 'examples', n, 'figma')))
  .filter((n) => readdirSync(path.join(ROOT, 'examples', n, 'figma')).some((f) => f.endsWith('.figma.js') && f !== '00-tokens.figma.js' && f !== 'GENESIS-BATCH.figma.js'))
  .sort();

for (const lib of figmaDirs) {
  if (NAMED_HOLES[lib]) {
    rows.push([lib, 'NOT GATED', NAMED_HOLES[lib]]);
    continue;
  }
  const args = LIBRARIES[lib];
  if (!args) {
    failures.push(`${lib}: committed figma scripts with NO freshness row and no named hole — an ungated surface (add it to LIBRARIES, or name why it cannot be rebuilt)`);
    continue;
  }
  const tmp = mkdtempSync(path.join(os.tmpdir(), `figma-fresh-${lib}-`));
  try {
    execFileSync(TSX, [CLI, 'figma', `examples/${lib}/contracts`, '--out', tmp, ...args], { cwd: ROOT, stdio: 'pipe' });
    const committedDir = path.join(ROOT, 'examples', lib, 'figma');
    const emitted = readdirSync(tmp).filter((f) => f.endsWith('.figma.js')).sort();
    const committed = readdirSync(committedDir).filter((f) => f.endsWith('.figma.js') && f !== '00-tokens.figma.js' && f !== 'GENESIS-BATCH.figma.js').sort();
    if (emitted.join(',') !== committed.join(',')) {
      failures.push(`${lib}: the committed script SET differs from a fresh emission (committed: ${committed.join(', ')} | fresh: ${emitted.join(', ')})`);
    }
    const stale = emitted.filter((f) => !existsSync(path.join(committedDir, f)) || readFileSync(path.join(tmp, f)).compare(readFileSync(path.join(committedDir, f))) !== 0);
    if (stale.length > 0) {
      failures.push(
        `${lib}: ${stale.length} committed sync script(s) are STALE vs a fresh emission (${stale.join(', ')}) — ` +
          `re-emit and commit them. This is the exact class the MUI regen round opened on: the engine moved, the artifacts did not, and every other gate stayed green.`,
      );
    }
    rows.push([lib, stale.length === 0 ? 'fresh' : `${stale.length} STALE`, `${emitted.length} scripts`]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

for (const [lib, status, note] of rows) console.log(`  ${lib.padEnd(10)} ${status.padEnd(10)} ${note}`);
if (failures.length > 0) {
  console.error(`\n✖ figma-scripts-fresh: ${failures.length} failure(s)\n`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`\n✔ figma-scripts-fresh: ${rows.filter((r) => r[1] === 'fresh').length}/${rows.length} libraries byte-fresh vs a rebuild (${Object.keys(NAMED_HOLES).length} named hole: ${Object.keys(NAMED_HOLES).join(', ')})`);
