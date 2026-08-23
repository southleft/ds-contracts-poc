/**
 * ALTITUDE-ONLY re-emit of the canvas sync scripts.
 *
 * `scripts/reemit-visual-fixes.ts` re-emits EVERY lane in one pass, which is
 * the wrong blast radius for a single-lane hill-climb round: a runtime-template
 * change (RUNTIME_EMIT_REV) would rewrite five other lanes' committed
 * `examples/<lane>/figma/*.figma.js` in a round that never re-ran their
 * canvases, leaving their scripts ahead of their receipts. This script emits
 * ONLY `examples/altitude/figma/*.figma.js`, using exactly the same engine
 * configuration reemit-visual-fixes.ts uses for altitude (same token files,
 * same icon dir, same variable collection, same stem list), so the two agree
 * byte-for-byte on this lane.
 *
 *   npx tsx scripts/reemit-altitude-figma.ts            # write
 *   npx tsx scripts/reemit-altitude-figma.ts --check    # byte-compare only
 *
 * WHY `--check` EXISTS. `scripts/figma-scripts-fresh.mjs` re-derives every
 * lane by running the CLI `figma` verb — and the CLI has NO variable-collection
 * option at all (there is no flag to pass; `variableCollection` appears
 * nowhere under packages/cli/src). So the CLI's altitude emission omits the
 * `_prefCol` preamble block that this script's `variableCollection: 'Altitude'`
 * puts into all eight committed scripts, and the gate called altitude STALE
 * against a rebuild that could not have reproduced it. The verdict was the
 * GATE's defect, not the artifact's, and "fixing" it the obvious way — re-emit
 * altitude with the gate's own command and commit — would have DELETED the
 * preferred-collection resolution from every altitude script, which is the
 * whole of FC-THEME-ISO: without `_prefCol` the runtime binds whichever
 * same-named variable it finds first across ALL collections in the file, so an
 * altitude paste into a file that already holds another library's variables
 * silently binds to the wrong theme.
 *
 * `--check` is therefore the honest rebuild command for this lane: it runs the
 * SAME engine configuration as the write path (one `engine` const, no second
 * copy to drift), byte-compares in memory, and never touches the tree it is
 * checking. It prints `byte-stable` on success — the marker
 * figma-scripts-fresh.mjs greps for, the same contract polaris's
 * `generate.ts --check` row already uses.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, sortByDependencies } from './contract-schema.js';
import { createFigmaEngine } from '../core/emit-figma-script.js';

const CONTRACTS_DIR = 'examples/altitude/contracts';
const OUT_DIR = 'examples/altitude/figma';
const TOKEN_FILES = [
  'examples/altitude/tokens/altitude.dtcg.json',
  'examples/altitude/tokens/altitude-minted.dtcg.json',
];
const ONLY = ['badge', 'chip', 'button', 'avatar', 'divider', 'heading', 'icon-close', 'link'];

const loadJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

function loadIcons(exampleDir: string): Map<string, string> {
  const iconsDir = path.join(exampleDir, 'assets', 'icons');
  const icons = new Map<string, string>();
  if (!existsSync(iconsDir)) return icons;
  for (const f of readdirSync(iconsDir)) {
    if (!f.endsWith('.svg')) continue;
    icons.set(f.replace(/\.svg$/, ''), readFileSync(path.join(iconsDir, f), 'utf8').trim());
  }
  return icons;
}

const [base, minted] = TOKEN_FILES;
const engine = createFigmaEngine({
  tokens: {
    primitives: loadJson(base),
    semantic: minted ? loadJson(minted) : {},
    light: {},
    dark: {},
    brands: { default: {} },
  },
  icons: loadIcons(path.dirname(CONTRACTS_DIR)),
  variableCollection: 'Altitude',
});

const contracts = readdirSync(CONTRACTS_DIR)
  .filter((f) => f.endsWith('.contract.json'))
  .map((f) => ContractSchema.parse(loadJson(path.join(CONTRACTS_DIR, f))));
const byId = new Map(contracts.map((c) => [c.id, c]));

const CHECK = process.argv.includes('--check');

/** Every script this lane emits, built in memory. One code path, so the
 *  `--check` verdict is about the SAME bytes the write path would land. */
const emitted = new Map<string, string>();
for (const c of sortByDependencies(contracts)) {
  if (c.bindings.figma.representation === 'native') continue;
  const nameStem = c.name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .toLowerCase();
  const idStem = c.id.split('.').slice(1).join('-');
  const stem = ONLY.includes(nameStem) ? nameStem : ONLY.includes(idStem) ? idStem : null;
  if (!stem) continue;
  emitted.set(`${stem}.figma.js`, engine.buildComponentScript(c, byId, undefined));
}

if (!CHECK) {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const [file, script] of emitted) {
    writeFileSync(path.join(OUT_DIR, file), script);
    console.log('wrote', path.join(OUT_DIR, file));
  }
  process.exit(0);
}

// --check. The SET is compared as well as the bytes: a committed script this
// emitter no longer produces (a stem dropped from ONLY, say) is exactly as
// unchecked as a stale one, and silence about it is how an artifact rots with
// a green gate. 00-tokens.figma.js and GENESIS-BATCH.figma.js are excluded
// because a different builder emits each — figma-scripts-fresh.mjs holds
// GENESIS-BATCH still via examples/altitude/scripts/build-genesis-batch.mjs.
const committed = readdirSync(OUT_DIR)
  .filter((f) => f.endsWith('.figma.js') && f !== '00-tokens.figma.js' && f !== 'GENESIS-BATCH.figma.js')
  .sort();
const fresh = [...emitted.keys()].sort();
const problems: string[] = [];
if (committed.join(',') !== fresh.join(',')) {
  problems.push(`script SET differs (committed: ${committed.join(', ')} | fresh: ${fresh.join(', ')})`);
}
for (const file of fresh) {
  const p = path.join(OUT_DIR, file);
  if (!existsSync(p)) continue; // already named by the SET diff above
  if (readFileSync(p, 'utf8') !== emitted.get(file)) problems.push(`${file} is STALE vs a fresh emission`);
}
if (problems.length > 0) {
  console.error(`✖ altitude figma scripts are NOT byte-stable (${problems.length}):`);
  for (const p of problems) console.error(`  ${p}`);
  console.error(`\n  Re-emit with:  npx tsx scripts/reemit-altitude-figma.ts`);
  console.error(`  Do NOT re-emit this lane with the CLI \`figma\` verb — it has no`);
  console.error(`  variable-collection option and would strip the "Altitude" _prefCol block.`);
  process.exit(1);
}
console.log(`✔ altitude: ${fresh.length} figma scripts byte-stable vs a fresh emission (preferred collection "Altitude" preserved)`);
