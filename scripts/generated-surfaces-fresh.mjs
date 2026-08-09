/**
 * GENERATED STORYBOOK TREES — FRESHNESS GATE.
 *
 *   node scripts/generated-surfaces-fresh.mjs
 *
 * WHY THIS EXISTS. `scripts/figma-scripts-fresh.mjs` closed exactly this hole
 * for `examples/<lib>/figma/*.figma.js`, and its header explains the cost of
 * not having it: MUI's committed sync scripts once sat THREE engine fixes
 * stale while the suite stayed 167/167 green, because nothing in this repo
 * compared a committed artifact to a fresh emission.
 *
 * The same hole was open on a second surface. Three libraries commit a
 * generated React tree under `examples/<lib>/storybook/src/generated`, and
 * ALL THREE had rotted:
 *
 *   eventz-vars   17 of 69 files stale — every one missing the box-sizing reset
 *   untitled-ui   30 of 128 stale, PLUS 2 directories the generator no longer
 *                 emits, PLUS two token names that resolve nowhere
 *   astryx        24 of 41 stale and 3 whole components missing — its committed
 *                 tree was emitted from v0.1.0 contracts against today's
 *                 v0.2.0–v0.4.0
 *
 * The reason no gate saw it is worth writing down, because it is a near-miss
 * of the kind this repo keeps finding. `astryx-dev-journey` (evals/run.ts)
 * DOES run the generator — twice — and hashes the two outputs against each
 * other to prove determinism. Both runs are FRESH. It never compares either to
 * the committed tree, so a byte-stable generator and a rotted committed
 * artifact are indistinguishable to it. "The generator is deterministic" and
 * "the committed bytes are what the generator produces" are different claims.
 *
 * Three failure classes, reported separately and never lumped as "differs":
 *   · STALE    — present both sides, bytes differ
 *   · MISSING  — the generator emits it, the committed tree does not carry it
 *   · ORPHANED — the committed tree carries it, the generator no longer emits it
 * The last is the one that needs a human: it means DELETE, and a gate that
 * says only "differs" would let a reviewer regenerate over the top and leave
 * dead directories behind forever.
 *
 * A library with a committed generated tree and no row here is reported BY
 * NAME as an ungated surface — "there is a generated tree" and "there is a
 * freshness row" must be the same fact, or this gate rots the way the
 * artifacts did.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, existsSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TSX = path.join(ROOT, 'node_modules', '.bin', 'tsx');
const CLI = 'packages/cli/src/cli.ts';

/** `.gitkeep` is committed scaffold for an otherwise-empty directory. The
 *  generator never emits it, so without this allowlist the gate would be
 *  permanently red on a file that is correct. */
const NOT_GENERATOR_OUTPUT = new Set(['.gitkeep']);

/** The emit command each tree is actually built by. `contracts` is per-row on
 *  purpose: untitled-ui's contracts live under `storybook/contracts`, not
 *  `examples/untitled-ui/contracts` (which does not exist).
 *
 *  `--icons` is load-bearing where present — without it the CLI REFUSES the
 *  contracts by name ("needs icon asset … which does not exist") rather than
 *  emitting something subtly different, so a wrong row reads as REBUILD-REFUSED
 *  (loud) and never as a false "fresh". */
const SURFACES = {
  'eventz-vars': {
    contracts: 'examples/eventz-vars/contracts',
    // No --icons: this kit's icons ARE contracts (icons-*.contract.json), not
    // SVG assets, so there is no assets/icons dir to point at.
    args: ['--tokens', 'examples/eventz-vars/tokens/captured.dtcg.json,examples/eventz-vars/tokens/minted.dtcg.json'],
  },
  'untitled-ui': {
    contracts: 'examples/untitled-ui/storybook/contracts',
    args: [
      '--icons', 'examples/untitled-ui/assets/icons',
      '--tokens', 'examples/untitled-ui/storybook/tokens/captured.dtcg.json,examples/untitled-ui/storybook/tokens/minted.dtcg.json',
    ],
  },
};

/** NAMED HOLES — a tree that cannot be rebuilt today, with the reason and the
 *  work that would close it. This is the same shape `figma-scripts-fresh.mjs`
 *  carried for polaris until task #26 closed it. A named hole is not a pass:
 *  it prints as HOLE and is listed in the summary line, so the count of gated
 *  trees can never be read as the count of trees.
 *
 *  It is emphatically NOT a baseline. Recording astryx's current byte-state as
 *  "expected" would freeze a fixture that is already broken. */
const NAMED_HOLES = {
  astryx:
    'REBUILD WOULD SHIP IT WORSE. `examples/astryx/scripts/build-storybook-tokens.ts:28-29` reads only ' +
    '`tokens/astryx.dtcg.json` + `tokens/modes/astryx.dark.dtcg.json` and NEVER `tokens/astryx-minted.dtcg.json`, ' +
    'so it emits ZERO `--imported-*` variables. Measured: the committed storybook CSS already references 34 ' +
    'distinct `--imported-*` vars and `storybook/src/tokens.css` defines 0 of them — those declarations are ' +
    'invalid at computed-value time and fall back TODAY — and a regen raises that to 312. Regenerating ' +
    'tokens.css is not the way out either: the same script does not resolve `{ref}` aliases, leaking ~35 ' +
    'literals like `--text-body-size: {font-size-base};`. CLOSE BY: teaching build-storybook-tokens.ts the ' +
    'minted tree and `{ref}` resolution, THEN regenerating the components (24 stale + 3 missing components, ' +
    'a v0.1.0→v0.4.0 review) and re-shooting RENDER-PROOF.md, whose asserted colours are themselves dead.',
};

const failures = [];
const rows = [];

/** Every file under a tree, relative to it, sorted — recursive, and NOT
 *  dependent on filesystem order. */
function walk(dir, base = dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const abs = path.join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs, base, out);
    else out.push(path.relative(base, abs));
  }
  return out.sort();
}

const treeOf = (lib) => path.join(ROOT, 'examples', lib, 'storybook', 'src', 'generated');

/** A committed generated tree = one holding at least one entry that is not
 *  scaffold. An empty skeleton (only `.gitkeep`) is not a surface. */
const libs = readdirSync(path.join(ROOT, 'examples'), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .filter((n) => existsSync(treeOf(n)))
  .filter((n) => walk(treeOf(n)).some((f) => !NOT_GENERATOR_OUTPUT.has(path.basename(f))))
  .sort();

for (const lib of libs) {
  if (NAMED_HOLES[lib]) {
    rows.push([lib, 'HOLE', NAMED_HOLES[lib].slice(0, 96) + '…']);
    continue;
  }
  const surface = SURFACES[lib];
  if (!surface) {
    failures.push(
      `${lib}: a committed storybook/src/generated tree with NO freshness row and no named hole — an ungated surface ` +
        `(add it to SURFACES, or name in NAMED_HOLES why it cannot be rebuilt)`,
    );
    rows.push([lib, 'NOT GATED', 'no row']);
    continue;
  }
  const committedDir = treeOf(lib);
  const tmp = mkdtempSync(path.join(os.tmpdir(), `gen-fresh-${lib}-`));
  try {
    // A rebuild REFUSAL is a freshness verdict, not an instrument crash —
    // catch it and report the library red BY NAME, the same way
    // figma-scripts-fresh.mjs learned to after one refused contract aborted
    // the whole gate mid-run and every later library went unmeasured.
    try {
      execFileSync(
        TSX,
        [CLI, 'generate', surface.contracts, '--out', tmp, '--target', 'react', ...surface.args, '--stories'],
        { cwd: ROOT, stdio: 'pipe' },
      );
    } catch (err) {
      failures.push(
        `${lib}: fresh generation REFUSED — the committed tree cannot be freshness-checked until it runs:\n${String(err.stderr ?? err.message).slice(0, 1200)}`,
      );
      rows.push([lib, 'REBUILD-REFUSED', 'fresh generation failed']);
      continue;
    }

    const fresh = walk(tmp);
    const committed = walk(committedDir).filter((f) => !NOT_GENERATOR_OUTPUT.has(path.basename(f)));
    const freshSet = new Set(fresh);
    const committedSet = new Set(committed);

    const missing = fresh.filter((f) => !committedSet.has(f));
    const orphaned = committed.filter((f) => !freshSet.has(f));
    const stale = fresh.filter(
      (f) => committedSet.has(f) && readFileSync(path.join(tmp, f)).compare(readFileSync(path.join(committedDir, f))) !== 0,
    );

    if (missing.length > 0) {
      failures.push(
        `${lib}: the generator emits ${missing.length} file(s) the committed tree does NOT carry — regenerate and commit them (${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ', …' : ''})`,
      );
    }
    if (orphaned.length > 0) {
      failures.push(
        `${lib}: the committed tree carries ${orphaned.length} file(s) the generator NO LONGER emits — delete them, or name why they must stay (${orphaned.slice(0, 8).join(', ')}${orphaned.length > 8 ? ', …' : ''})`,
      );
    }
    if (stale.length > 0) {
      failures.push(
        `${lib}: ${stale.length} committed file(s) are STALE vs a fresh generation (${stale.slice(0, 8).join(', ')}${stale.length > 8 ? ', …' : ''}) — ` +
          `re-generate and commit them. This is the exact class the MUI regen round opened on: the engine moved, the artifacts did not, and every other gate stayed green.` +
          (lib === 'untitled-ui'
            ? ` NOTE: after regenerating, re-run \`npm run ledger:uui\` — examples/untitled-ui/LEDGER.md pins this tree's hash, byte count and its "(N dirs)" label.`
            : ''),
      );
    }
    const clean = missing.length === 0 && orphaned.length === 0 && stale.length === 0;
    rows.push([
      lib,
      clean ? 'fresh' : `${stale.length} STALE`,
      `${fresh.length} files${missing.length ? `, ${missing.length} missing` : ''}${orphaned.length ? `, ${orphaned.length} orphaned` : ''}`,
    ]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

for (const [lib, status, note] of rows) console.log(`  ${lib.padEnd(12)} ${status.padEnd(16)} ${note}`);

if (failures.length > 0) {
  console.error(`\n✖ generated-surfaces-fresh: ${failures.length} failure(s)\n`);
  for (const f of failures) console.error(`  ${f}\n`);
  process.exit(1);
}

const holes = rows.filter((r) => r[1] === 'HOLE');
console.log(
  `\n✔ generated-surfaces-fresh: ${rows.length - holes.length}/${rows.length} committed storybook trees byte-fresh vs a rebuild` +
    (holes.length > 0
      ? ` — ${holes.length} NAMED HOLE(S), not passes: ${holes.map((h) => h[0]).join(', ')}\n\n  ${holes.map((h) => `${h[0]}: ${NAMED_HOLES[h[0]]}`).join('\n\n  ')}`
      : ' (0 named holes)'),
);
