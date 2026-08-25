/**
 * EXAMPLE BUNDLES — FRESHNESS GATE.
 *
 *   node scripts/bundles-fresh.mjs
 *
 * WHY THIS EXISTS. `examples/<lib>/figma/<lib>.bundle.json` is the ONE JSON a
 * designer pastes into the plugin. Until 2026-08-24 only FOUR of the eleven
 * committed bundles were rebuilt and byte-compared anywhere (mui, tailwind,
 * carbon and altitude, inside their genesis evals) and the first-party corpus
 * had its own separate check. The rest — antd, fluent, shadcn, polaris and
 * astryx's three — were executed by `plugin-engine-check` and never
 * re-derived, and executing a stale bundle succeeds: two of them WERE stale,
 * missing ~300 lines of `codeOnlyFacts` receipts a real rebuild produces.
 *
 * This is the same defect class as the corpus-reproducibility gate next door
 * (`npm run corpus:reproducible:check`): a committed artifact nobody can
 * reproduce from committed inputs. The cure is the same — rebuild it with the
 * command its own PROVENANCE documents and compare the bytes.
 *
 * DISCIPLINE (borrowed verbatim from scripts/figma-scripts-fresh.mjs): a
 * committed `*.bundle.json` with NO row here is reported BY NAME as an ungated
 * surface. "There is a bundle" and "there is a freshness row" must be the same
 * fact, or this gate rots the way the artifacts did.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TSX = path.join(ROOT, 'node_modules', '.bin', 'tsx');
const CLI = 'packages/cli/src/cli.ts';

/** Rows keyed by the committed bundle path. `args` is the `figma bundle`
 *  invocation MINUS `--out`, exactly as the named document spells it. */
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

/** The frozen artifact's reviewed sha256 — see its row below. */
const FROZEN_ASTRYX_GENESIS_SHA = 'ecdb5bacae214ff801f9679b8b5038f18b38a54272755249beb85f69cccb078a';

const ROWS = {};

/** Seven libraries declare the whole recipe in their own ds-library.json —
 *  the same manifest `ds-contracts promote --config` and `onboard` read, so
 *  the row cannot drift from the pipeline. */
for (const lib of readdirSync(path.join(ROOT, 'examples')).sort()) {
  const mf = path.join(ROOT, 'examples', lib, 'ds-library.json');
  if (!existsSync(mf)) continue;
  const m = JSON.parse(readFileSync(mf, 'utf8'));
  if (!m.bundle) continue;
  // A library with no committed contracts/ directory has never been promoted,
  // so the bundle its manifest declares does not exist and no command in this
  // repo would produce one. Held-out exam material (examples/{bootstrap5,
  // radix-themes,day-picker} — prepared blind, deliberately never captured)
  // ships a manifest with a bundle block precisely so the day it IS captured
  // the recipe is already written. Rowing it today would name a file nothing
  // measures, which is the failure the ROWS/committed cross-check below
  // exists to catch. Same rule as scripts/corpus-reproducible-check.ts and
  // the canvas census manifest ("not a contract library").
  if (!existsSync(path.join(ROOT, 'examples', lib, 'contracts'))) continue;
  const args = [
    'figma',
    'bundle',
    `${m.exampleDir}/contracts`,
    '--tokens',
    [m.dtcg, m.mintedOut].join(','),
    ...(m.bundle.modes ? ['--modes', m.bundle.modes.join(',')] : []),
    '--name',
    m.bundle.name,
    ...(m.emit?.icons ? ['--icons', m.emit.icons] : []),
  ];
  ROWS[m.bundle.out] = { args, doc: `examples/${lib}/ds-library.json (bundle block)` };
}

/** …and four do not, because they predate the manifest. Each row quotes the
 *  document that carries the command. */
Object.assign(ROWS, {
  // examples/polaris/PROVENANCE.md — "the ONE JSON a user pastes".
  'examples/polaris/figma/polaris.bundle.json': {
    args: [
      'figma', 'bundle', 'examples/polaris/contracts',
      '--tokens', 'examples/polaris/tokens/polaris-light.dtcg.json,examples/polaris/tokens/polaris-minted.dtcg.json',
      '--name', 'Polaris',
      '--icons', 'examples/polaris/assets/icons',
    ],
    doc: 'examples/polaris/PROVENANCE.md (Pipeline)',
  },
  // examples/astryx/DOCS-THEME.md — "Files + regeneration".
  'examples/astryx/figma/astryx-docs.bundle.json': {
    args: [
      'figma', 'bundle', 'examples/astryx/contracts',
      '--tokens', 'examples/astryx/tokens/astryx-docs.dtcg.json,examples/astryx/tokens/astryx-minted.dtcg.json',
      '--modes', 'examples/astryx/tokens/modes/astryx-docs.light.dtcg.json,examples/astryx/tokens/modes/astryx-docs.dark.dtcg.json',
      '--name', 'Astryx (docs theme)',
      '--icons', 'examples/astryx/assets/icons',
    ],
    doc: 'examples/astryx/DOCS-THEME.md (Files + regeneration)',
  },
  // The neutral twin of the row above — same contracts, the neutral wrap.
  'examples/astryx/figma/astryx.bundle.json': {
    args: [
      'figma', 'bundle', 'examples/astryx/contracts',
      '--tokens', 'examples/astryx/tokens/astryx.dtcg.json,examples/astryx/tokens/astryx-minted.dtcg.json',
      '--modes', 'examples/astryx/tokens/modes/astryx.light.dtcg.json,examples/astryx/tokens/modes/astryx.dark.dtcg.json',
      '--name', 'Astryx',
      '--icons', 'examples/astryx/assets/icons',
    ],
    doc: 'examples/astryx/DOCS-THEME.md (the neutral twin of the docs bundle)',
  },
  // FROZEN, BY NAME. examples/astryx/figma/GENESIS.md describes this as "the
  // 13 contracts as a CONTRACTS-BUNDLE … the artifact a future foreign-token-
  // aware Generate/Receive flow will consume directly" — envelope VERSION 1,
  // contracts only, no tokenSet and no icons. The CLI cannot emit that shape
  // any more: `figma bundle` REFUSES without `--tokens` by name, and what it
  // writes today is a version-2 envelope carrying a token set. So there is no
  // documented command to re-derive it with, and inventing one would be a lie
  // in the other direction. It is frozen on its sha256 instead: it cannot go
  // stale (nothing rebuilds it) and it cannot change silently (this hash). The
  // row dies the day the flow that consumes it exists and can rebuild it.
  'examples/astryx/figma/astryx-genesis.bundle.json': {
    frozen: {
      sha256: FROZEN_ASTRYX_GENESIS_SHA,
      reason:
        'a VERSION 1 contracts-only CONTRACTS-BUNDLE for a flow that does not exist yet (examples/astryx/figma/GENESIS.md); ' +
        '`figma bundle` refuses without --tokens and emits a version-2 envelope, so no documented command re-derives this shape',
    },
    doc: 'examples/astryx/figma/GENESIS.md (FROZEN — no rebuild command exists)',
  },
});

const committed = [];
for (const lib of readdirSync(path.join(ROOT, 'examples')).sort()) {
  const dir = path.join(ROOT, 'examples', lib, 'figma');
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).sort()) {
    if (f.endsWith('.bundle.json')) committed.push(path.posix.join('examples', lib, 'figma', f));
  }
}

const failures = [];
const rows = [];
for (const rel of committed) {
  const row = ROWS[rel];
  if (row?.frozen) {
    const have = sha256(path.join(ROOT, rel));
    if (have !== row.frozen.sha256) {
      failures.push(
        `${rel}: FROZEN on sha256 ${row.frozen.sha256.slice(0, 16)}… and the committed bytes now hash ${have.slice(0, 16)}… — ` +
          `a frozen artifact changed. Either the freeze is over (give it a rebuild row) or the change is unintended. Reason on file: ${row.frozen.reason}`,
      );
      rows.push([rel, 'FROZEN-MOVED', row.doc]);
      continue;
    }
    rows.push([rel, 'frozen', row.doc]);
    continue;
  }
  if (!row) {
    failures.push(
      `${rel}: a committed bundle with NO freshness row — an UNGATED PASTE ARTIFACT. ` +
        `Add it to scripts/bundles-fresh.mjs ROWS with the document that carries its rebuild command, or name why it cannot be rebuilt.`,
    );
    rows.push([rel, 'UNGATED', '—']);
    continue;
  }
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'bundle-fresh-'));
  const out = path.join(tmp, path.basename(rel));
  try {
    try {
      execFileSync(TSX, [CLI, ...row.args, '--out', out], { cwd: ROOT, stdio: 'pipe' });
    } catch (err) {
      failures.push(`${rel}: the documented rebuild REFUSED — the committed bundle cannot be freshness-checked until it runs:\n${String(err.stderr ?? err.message).slice(0, 1200)}`);
      rows.push([rel, 'BUILD-REFUSED', row.doc]);
      continue;
    }
    const fresh = readFileSync(out);
    const have = readFileSync(path.join(ROOT, rel));
    if (fresh.compare(have) !== 0) {
      failures.push(
        `${rel}: STALE vs a fresh build (committed ${have.length} bytes, fresh ${fresh.length} bytes) — ` +
          `re-run the command in ${row.doc} and commit it. This is the JSON a designer PASTES; executing a stale one succeeds, which is why nothing noticed.`,
      );
      rows.push([rel, 'STALE', row.doc]);
      continue;
    }
    rows.push([rel, 'fresh', row.doc]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
for (const key of Object.keys(ROWS)) {
  if (!committed.includes(key)) failures.push(`scripts/bundles-fresh.mjs ROWS names ${key}, which the repo does not carry — a row nothing measures`);
}

for (const [rel, status, doc] of rows) console.log(`  ${status.padEnd(14)} ${rel.padEnd(48)} ${doc}`);
if (failures.length > 0) {
  console.error(`\n✖ bundles-fresh: ${failures.length} failure(s)\n`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
const rebuilt = rows.filter((r) => r[1] === 'fresh').length;
const frozen = rows.filter((r) => r[1] === 'frozen').length;
console.log(
  `\n✔ bundles-fresh: ${rebuilt}/${rows.length} committed example bundle(s) byte-identical to a rebuild from their committed contracts + token layers` +
    (frozen > 0 ? `; ${frozen} frozen on a recorded sha256 with the reason on file` : ''),
);
