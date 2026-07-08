/**
 * Golden-output manifest — `npm run golden:update`.
 *
 * Records a SHA-256 per generated file (src/ + figma-sync scripts). The
 * `golden-generated-output` eval regenerates everything in a scratch copy
 * and compares against this manifest, so a generator mutation that changes
 * OUTPUT (mirrored alignment, a dropped focus ring, reordered variants)
 * fails even though regeneration is still self-consistent. This exists
 * because determinism-vs-self proves nothing about correctness (red-team
 * finding, 2026-07-08): run-2-equals-run-1 is true of every broken
 * generator too.
 *
 * Update ONLY as part of a reviewed change to contracts/tokens/generators —
 * the manifest diff in the PR is the reviewable blast radius of the change.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const manifest = {};

function walk(dir, filter) {
  for (const entry of readdirSync(dir).sort()) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, filter);
    else if (filter(full)) {
      manifest[path.relative(ROOT, full)] = createHash('sha256')
        .update(readFileSync(full))
        .digest('hex');
    }
  }
}

walk(path.join(ROOT, 'src'), () => true);
walk(path.join(ROOT, 'figma-sync'), (f) => f.endsWith('.js') && !f.includes('plugin') && !f.endsWith('arrange.js'));

writeFileSync(
  path.join(ROOT, 'evals', 'golden.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);
console.log(`✔ Golden manifest: ${Object.keys(manifest).length} files → evals/golden.json`);
