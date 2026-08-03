/**
 * RE-EMBED extract/figma/dump.plugin.js INTO figma-sync/plugin/ui.html.
 *
 * The Send tab runs the dump script inside Figma, so ui.html carries a VERBATIM
 * copy in its `#dump-source` block, and scripts/build-plugin-zip.mjs refuses to
 * package a drifted copy. That guard is right and it caught a real thing: a
 * polygon fix landed in the canonical file and would never have reached the
 * actual plugin.
 *
 * But the guard's message said "re-embed the canonical file" and there was NO
 * COMMAND THAT DID IT — the only documented remedy was a hand edit of a
 * generated block inside a 4-space-indented HTML file. An instruction with no
 * mechanism is how drift becomes normal: the next person edits the copy instead
 * of the source, and then the two disagree in the direction the guard cannot
 * see. This is that mechanism.
 *
 *   node scripts/embed-dump-source.mjs           # re-embed
 *   node scripts/embed-dump-source.mjs --check   # verify only, non-zero on drift
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const UI = join(ROOT, 'figma-sync', 'plugin', 'ui.html');
const SRC = join(ROOT, 'extract', 'figma', 'dump.plugin.js');
const OPEN = '<script type="text/plain" id="dump-source">';

const ui = await readFile(UI, 'utf8');
const canonical = (await readFile(SRC, 'utf8')).trim();

const start = ui.indexOf(OPEN);
if (start < 0) {
  console.error('REFUSED: figma-sync/plugin/ui.html has no #dump-source block.');
  process.exit(1);
}
const end = ui.indexOf('</script>', start);
if (end < 0) {
  console.error('REFUSED: the #dump-source block is not closed.');
  process.exit(1);
}

const embedded = ui.slice(start + OPEN.length, end).trim();
if (embedded === canonical) {
  console.log('✔ ui.html #dump-source is byte-identical to extract/figma/dump.plugin.js — nothing to do.');
  process.exit(0);
}

if (process.argv.includes('--check')) {
  console.error(
    `✘ DRIFT: ui.html #dump-source (${embedded.length} chars) differs from extract/figma/dump.plugin.js ` +
      `(${canonical.length} chars). Run: node scripts/embed-dump-source.mjs`,
  );
  process.exit(1);
}

await writeFile(UI, `${ui.slice(0, start + OPEN.length)}\n${canonical}\n${ui.slice(end)}`, 'utf8');
console.log(
  `✔ re-embedded extract/figma/dump.plugin.js into ui.html #dump-source (${embedded.length} → ${canonical.length} chars).`,
);
