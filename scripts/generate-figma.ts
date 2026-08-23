/**
 * Contract → Figma sync-script generator — the CLI SHELL. (v2 — composition)
 *
 * All script-text building lives in core/emit-figma-script.ts (pure,
 * browser-importable); this script owns only the file system: read tokens/,
 * contracts/, assets/icons/, run the core engine, and write into figma-sync/:
 *
 *   figma-sync/01-tokens.js   variables (collections, modes, aliases, scopes,
 *                             codeSyntax) — unchanged from v1
 *   figma-sync/NN-<name>.js   one component (set) per contract, emitted in
 *                             dependency order
 *   figma-sync/batch-NN.js    several components per script (minified specs)
 *
 * Output is byte-guarded by evals/golden.json (golden covers figma-sync/*.js).
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, sortByDependencies } from './contract-schema.js';
import { createFigmaEngine, type ComponentData } from '../core/emit-figma-script.js';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'figma-sync');

const read = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8'));

// Brand dimension file discovery (mirrors scripts/build-tokens.mjs): every
// tokens/modes/brand.<name>.tokens.json is a brand mode.
const brandNames = readdirSync(path.join(ROOT, 'tokens', 'modes'))
  .filter((f) => /^brand\.[a-z][a-z0-9-]*\.tokens\.json$/.test(f))
  .map((f) => f.replace(/^brand\.|\.tokens\.json$/g, ''));

// Icon assets (assets/icons/*.svg) — same source the code generator inlines.
const iconAssets = new Map<string, string>();
{
  const dir = path.join(ROOT, 'assets', 'icons');
  try {
    for (const f of readdirSync(dir)) {
      if (f.endsWith('.svg')) {
        iconAssets.set(f.replace(/\.svg$/, ''), readFileSync(path.join(dir, f), 'utf8').trim());
      }
    }
  } catch {
    /* no icons dir — contracts without icon parts */
  }
}

const engine = createFigmaEngine({
  tokens: {
    primitives: read('tokens/primitives.tokens.json'),
    semantic: read('tokens/semantic.tokens.json'),
    light: read('tokens/modes/semantic.light.tokens.json'),
    dark: read('tokens/modes/semantic.dark.tokens.json'),
    brands: Object.fromEntries(brandNames.map((n) => [n, read(`tokens/modes/brand.${n}.tokens.json`)])),
  },
  icons: iconAssets,
});

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

mkdirSync(OUT, { recursive: true });

const contracts = readdirSync(path.join(ROOT, 'contracts'))
  .filter((f) => f.endsWith('.contract.json'))
  .map((f) => ContractSchema.parse(read(path.join('contracts', f))));
// FIGMA_FILE_KEY: rebuild-into-a-fresh-file support — overrides the anchor
// file key baked into every script's WRONG FILE guard. FIGMA_BATCH_LIMIT:
// transport cap per batch script (the desktop bridge accepts ~50k chars).
const targetFileKey = process.env.FIGMA_FILE_KEY ?? contracts[0]?.bindings.figma.anchors.fileKey ?? null;
writeFileSync(path.join(OUT, '01-tokens.js'), engine.buildTokensScript(targetFileKey));
const ordered = sortByDependencies(contracts); // dependency order + cycle/ref gate
const byId = new Map(contracts.map((c) => [c.id, c]));

let index = 2;
const emitted = ['01-tokens.js'];
for (const contract of ordered) {
  if (contract.bindings.figma.representation === 'native') continue; // maps to native canvas capability
  const outName = `${String(index).padStart(2, '0')}-${contract.name.toLowerCase()}.js`;
  writeFileSync(path.join(OUT, outName), engine.buildComponentScript(contract, byId, process.env.FIGMA_FILE_KEY));
  emitted.push(outName);
  index++;
}

// Batch scripts: all components in dependency order, chunked so each script
// stays transport-friendly. Existing components skip, so batches are safe to re-run.
const BATCH_LIMIT = Number(process.env.FIGMA_BATCH_LIMIT ?? 60_000);
const batchable = ordered.filter((c) => c.bindings.figma.representation !== 'native');
const fileKey = targetFileKey;
const batches: ComponentData[][] = [[]];
for (const contract of batchable) {
  const data = engine.compileComponentData(contract, byId);
  const current = batches[batches.length - 1];
  const projected = JSON.stringify([...current, data]).length;
  if (current.length > 0 && projected > BATCH_LIMIT) batches.push([data]);
  else current.push(data);
}
batches.forEach((batch, i) => {
  const name = `batch-${String(i + 1).padStart(2, '0')}.js`;
  writeFileSync(path.join(OUT, name), engine.buildBatchScript(batch, fileKey));
  emitted.push(name);
});

// PRUNE stale emissions. The file names carry a dependency-order INDEX, so
// adding or removing one contract renumbers every script after it. Without a
// prune the previous numbering survives as orphan duplicates of the same
// components (a 5-contract composition round left 43 of them), and those
// orphans are real: scripts/update-golden.mjs walks this directory, so a
// stale script silently becomes part of the golden it is supposed to guard.
// `arrange.js` is hand-maintained (README + update-golden both name it) and
// the plugin/ subdirectory is not ours — everything else here is emitted by
// this script and nothing else, so "not emitted this run" means "stale".
const kept = new Set([...emitted, 'arrange.js']);
const pruned = readdirSync(OUT, { withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith('.js') && !kept.has(e.name))
  .map((e) => e.name)
  .sort();
for (const name of pruned) rmSync(path.join(OUT, name));

console.log(`✔ Emitted figma-sync scripts (dependency order): ${emitted.join(', ')}`);
if (pruned.length > 0) {
  console.log(`✔ Pruned ${pruned.length} stale script(s) left by a previous numbering: ${pruned.join(', ')}`);
}
