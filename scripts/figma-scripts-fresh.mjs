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
import { mkdtempSync, readFileSync, readdirSync, existsSync, rmSync, writeFileSync } from 'node:fs';
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
  // altitude is NOT here — it is a CUSTOM_REBUILD below. It is the one lane
  // whose committed scripts are emitted with a preferred variable collection,
  // which the CLI `figma` verb cannot express. See that row for the full why.
  // Exact-conversion wave: alert grew real icon-asset parts (status glyphs +
  // dismiss, examples/tailwind/assets/icons) — same reason as astryx below.
  tailwind: ['--icons', 'examples/tailwind/assets/icons', '--tokens', 'examples/tailwind/tokens/tailwind.dtcg.json,examples/tailwind/tokens/tailwind-minted.dtcg.json'],
  // Exact-conversion wave: banner promoted its four status icons as real
  // assets (examples/astryx/assets/icons), so the emit command now needs
  // --icons — without it the CLI refuses the banner contract by name.
  astryx: ['--icons', 'examples/astryx/assets/icons', '--tokens', 'examples/astryx/tokens/astryx.dtcg.json,examples/astryx/tokens/astryx-minted.dtcg.json'],
  // SHADCN round (library #8): checkbox/select carry floor-reconstructed
  // lucide glyph assets (examples/shadcn/assets/icons), so the emit command
  // needs --icons — same reason as tailwind/astryx above.
  shadcn: ['--icons', 'examples/shadcn/assets/icons', '--tokens', 'examples/shadcn/tokens/shadcn.dtcg.json,examples/shadcn/tokens/shadcn-minted.dtcg.json'],
  // FLUENT round (library #10): MessageBar's four intent glyphs, the Switch
  // indicator and the Dialog close button promote as real assets
  // (examples/fluent/assets/icons), so the emit command needs --icons — same
  // reason as tailwind/astryx/shadcn above. NOTE the freshness comparison
  // covers all TWELVE emitted scripts including message-bar.figma.js: it is
  // CANVAS-STOPPED for the genesis batch and the compile receipt (it cannot
  // BUILD — grid-placement-cycle-no-spare), but it is still EMITTED and still
  // committed, so it must still be held still. A stopped script that nobody
  // re-derives is exactly the ungated surface this gate exists to refuse.
  fluent: ['--icons', 'examples/fluent/assets/icons', '--tokens', 'examples/fluent/tokens/fluent.dtcg.json,examples/fluent/tokens/fluent-minted.dtcg.json'],
};

/** Libraries whose scripts are rebuilt by a DIFFERENT recorded command than
 *  the CLI `figma` verb — checked here with that command, not skipped.
 *
 *  polaris (task #26 closed the former NAMED hole): its `figma/*.figma.js`
 *  come from `examples/polaris/generate.ts`, whose `--check` mode re-emits
 *  EVERY generated surface (react, html, figma scripts, receipts) in memory
 *  and fails on any byte drift from the committed artifacts. That is a
 *  STRICTER bar than the CLI-rebuild rows above (it covers 76 files, not just
 *  the figma dir), and the `polaris-showcase-reproducible` eval runs the same
 *  command — this row exists so "there is a figma directory" and "there is a
 *  freshness row" stay the same fact in THIS gate's own output. The old hole
 *  text ("the exact invocation is not recorded anywhere") had rotted: the
 *  invocation is generate.ts's own header, and the byte-compare proves it. */
const CUSTOM_REBUILDS = {
  polaris: {
    cmd: ['examples/polaris/generate.ts', '--check'],
    mustInclude: 'byte-stable',
    note: 'via generate.ts --check — all generated surfaces incl. figma/*.figma.js byte-compared',
  },
  /** altitude — THE ROW THAT WAS ASKING THE WRONG QUESTION.
   *
   *  Until now altitude sat in LIBRARIES and was re-derived with the CLI
   *  `figma` verb like every other lane. It reported STALE, and the verdict
   *  was this gate's defect rather than the artifact's: all eight committed
   *  altitude scripts are emitted by `scripts/reemit-altitude-figma.ts` with
   *  `variableCollection: 'Altitude'`, and the CLI has no option that can say
   *  that — `variableCollection` appears nowhere under packages/cli/src, so
   *  there is no flag to add to the args array. The CLI rebuild therefore
   *  omitted the `_prefCol` preamble block that all nine altitude artifacts
   *  carry (grep `_prefCol examples/altitude/figma` → 9 files; every other
   *  lane → 0) and then called the difference staleness.
   *
   *  What makes this worth a comment rather than a one-line move: the obvious
   *  way to make the row green was to re-emit altitude with the gate's own
   *  command and commit the result. That would have DELETED the preferred-
   *  collection resolution from the whole lane — i.e. destroyed FC-THEME-ISO,
   *  since without `_prefCol` the runtime binds whichever same-named variable
   *  it meets first across ALL collections in the file, and an altitude paste
   *  into a file that already holds another library's variables silently
   *  binds the wrong theme. A gate that is wrong in the direction of "delete
   *  the thing the artifact exists to carry" is worse than no gate.
   *
   *  So the rebuild command is now the one that actually built the artifacts,
   *  in a `--check` mode that emits in memory and byte-compares. */
  altitude: {
    cmd: ['scripts/reemit-altitude-figma.ts', '--check'],
    mustInclude: 'byte-stable vs a fresh emission',
    note: 'via reemit-altitude-figma.ts --check — CLI figma verb cannot express the "Altitude" preferred collection',
  },
};

const failures = [];
const rows = [];
const genesisRows = [];

/** GENESIS-BATCH.figma.js — THE PASTE ARTIFACT, and until 2026-08-04 the one
 *  emitted surface no gate compared.
 *
 *  It is the script a designer actually pastes into a blank file, and it
 *  inlines core/canvas-fingerprint.ts's FINGERPRINT_SRC verbatim like every
 *  other emitted script. It was excluded from this file's byte-compare by name
 *  — the same `f !== 'GENESIS-BATCH.figma.js'` clause that (correctly) keeps it
 *  out of the SET comparison, because the CLI `figma` verb does not emit it.
 *  Conflating "not emitted by this command" with "not checked" left five
 *  artifacts (altitude, astryx, carbon, mui, tailwind) carrying a stale v5
 *  fingerprint while `figma:fresh` reported 6/6 green.
 *
 *  Its builder is deterministic — verified by re-running it twice and
 *  comparing sha256 — so the same rebuild-and-byte-compare that guards every
 *  other script works here. Rebuilt into a temp copy so a check never mutates
 *  the tree it is checking. */
function checkGenesis(lib, committedDir) {
  const name = 'GENESIS-BATCH.figma.js';
  const committedPath = path.join(committedDir, name);
  const builder = path.join(ROOT, 'examples', lib, 'scripts', 'build-genesis-batch.mjs');
  if (!existsSync(committedPath) && !existsSync(builder)) return [];
  if (existsSync(committedPath) !== existsSync(builder)) {
    failures.push(`${lib}: ${existsSync(builder) ? 'has a genesis builder but no committed GENESIS-BATCH.figma.js' : 'commits GENESIS-BATCH.figma.js but has no builder to rebuild it from — an ungated paste artifact'}`);
    return [[lib, 'UNPAIRED', name]];
  }
  const before = readFileSync(committedPath);
  execFileSync(process.execPath, [builder], { cwd: ROOT, stdio: 'pipe' });
  const after = readFileSync(committedPath);
  if (before.compare(after) !== 0) {
    // Restore, so a red gate never leaves the tree dirty.
    writeFileSync(committedPath, before);
    failures.push(
      `${lib}: GENESIS-BATCH.figma.js is STALE vs a fresh build — re-run examples/${lib}/scripts/build-genesis-batch.mjs and commit it. ` +
        `This is the artifact a designer PASTES, and it inlines the fingerprint source like every other emitted script.`,
    );
    return [[lib, 'STALE', name]];
  }
  return [[lib, 'fresh', name]];
}

const figmaDirs = readdirSync(path.join(ROOT, 'examples'), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .filter((n) => existsSync(path.join(ROOT, 'examples', n, 'figma')))
  .filter((n) => readdirSync(path.join(ROOT, 'examples', n, 'figma')).some((f) => f.endsWith('.figma.js') && f !== '00-tokens.figma.js' && f !== 'GENESIS-BATCH.figma.js'))
  .sort();

for (const lib of figmaDirs) {
  if (CUSTOM_REBUILDS[lib]) {
    const { cmd, mustInclude, note } = CUSTOM_REBUILDS[lib];
    // The GENESIS check runs for custom-rebuild libraries TOO. It used to sit
    // only on the CLI path below, so moving altitude up here would have
    // silently dropped its GENESIS-BATCH.figma.js — the artifact a designer
    // actually pastes — out of the gate, which is precisely the "excluded from
    // the set comparison, therefore excluded from freshness" conflation that
    // checkGenesis was written to end. polaris has neither builder nor
    // committed batch, so this is a no-op there.
    genesisRows.push(...checkGenesis(lib, path.join(ROOT, 'examples', lib, 'figma')));
    try {
      const out = execFileSync(TSX, cmd, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
      if (!out.includes(mustInclude)) {
        failures.push(`${lib}: rebuild check ran but did not report "${mustInclude}":\n${out.slice(0, 800)}`);
        rows.push([lib, 'STALE?', note]);
      } else {
        rows.push([lib, 'fresh', note]);
      }
    } catch (err) {
      failures.push(`${lib}: rebuild check failed (${cmd.join(' ')}) — committed scripts are STALE vs a fresh emission:\n${String(err.stdout ?? err.message).slice(0, 1200)}`);
      rows.push([lib, 'STALE', note]);
    }
    continue;
  }
  const args = LIBRARIES[lib];
  if (!args) {
    failures.push(`${lib}: committed figma scripts with NO freshness row and no named hole — an ungated surface (add it to LIBRARIES, or name why it cannot be rebuilt)`);
    continue;
  }
  const tmp = mkdtempSync(path.join(os.tmpdir(), `figma-fresh-${lib}-`));
  try {
    // An emit REFUSAL is a freshness verdict, not an instrument crash: catch
    // it and report the library red BY NAME. Before this catch, one refused
    // contract aborted the whole gate mid-run and every later library went
    // unmeasured (found when flowbite.alert's icon parts made the tailwind
    // emit refuse and the polaris/… rows never printed).
    try {
      execFileSync(TSX, [CLI, 'figma', `examples/${lib}/contracts`, '--out', tmp, ...args], { cwd: ROOT, stdio: 'pipe' });
    } catch (err) {
      failures.push(`${lib}: fresh emission REFUSED — the committed scripts cannot be freshness-checked until the emit runs:\n${String(err.stderr ?? err.message).slice(0, 1200)}`);
      rows.push([lib, 'EMIT-REFUSED', 'fresh emission failed']);
      continue;
    }
    const committedDir = path.join(ROOT, 'examples', lib, 'figma');
    const emitted = readdirSync(tmp).filter((f) => f.endsWith('.figma.js')).sort();
    const committed = readdirSync(committedDir).filter((f) => f.endsWith('.figma.js') && f !== '00-tokens.figma.js' && f !== 'GENESIS-BATCH.figma.js').sort();
    // GENESIS-BATCH.figma.js is excluded from the SET comparison above because
    // the CLI `figma` verb does not emit it — a separate
    // examples/<lib>/scripts/build-genesis-batch.mjs does. It is NOT excluded
    // from freshness: see the block below. The two exclusions used to be one,
    // and that is how five committed artifacts carrying an inlined copy of
    // core/canvas-fingerprint.ts went stale with every gate green.
    genesisRows.push(...checkGenesis(lib, committedDir));
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

for (const [lib, status, note] of [...rows, ...genesisRows]) console.log(`  ${lib.padEnd(10)} ${status.padEnd(10)} ${note}`);
if (failures.length > 0) {
  console.error(`\n✖ figma-scripts-fresh: ${failures.length} failure(s)\n`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`\n✔ figma-scripts-fresh: ${rows.filter((r) => r[1] === 'fresh').length}/${rows.length} libraries byte-fresh vs a rebuild (0 named holes — task #26 closed polaris, the last one)`);
