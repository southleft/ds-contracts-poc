/**
 * storybook/src/tokens.css — the kit's token stylesheet, rebuilt from the two
 * COMMITTED DTCG trees. This is the step between editing a token and seeing it
 * in a render, and it was the one link in the fidelity loop with no committed
 * script (gap-closing round 8 needed to add minted glyph-ink leaves and had to
 * reconstruct it); it is byte-identical to the committed file over unchanged
 * inputs, which is how it was verified before being trusted.
 *
 *   flatten(captured) + flatten(minted) → `--<dot.path with dots→dashes>: <value>`
 *   DTCG alias ({other.token})          → `var(--other-token)` (mintedTokenCss's rule)
 *   url('./assets/…')                   → inlined as a data: URI, mime read from
 *                                         the file's own magic bytes (the kit's
 *                                         avatar photos are committed as .png
 *                                         names holding JPEG bytes, so the
 *                                         extension is NOT the authority)
 *   lines are SORTED, under one `:root`, after the box-sizing reset.
 *
 *   npx tsx examples/untitled-ui/tokens-css.mts            # verify only
 *   npx tsx examples/untitled-ui/tokens-css.mts --write    # rewrite tokens.css
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { aliasTarget, flattenTokens } from '../../core/tokens.js';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const SB = path.join(HERE, 'storybook');
const OUT = path.join(SB, 'src', 'tokens.css');

const dashed = (p: string): string => p.split('.').join('-');

/** A committed image reference becomes a data: URI so the stylesheet is
 *  self-contained wherever it is loaded (render-one inlines it into a
 *  file:// page with no asset server). */
const inlineImage = (value: string): string => {
  const m = value.match(/^url\('\.\/(.+)'\)$/);
  if (!m) return value;
  const bytes = readFileSync(path.join(HERE, m[1]));
  const mime = bytes[0] === 0xff && bytes[1] === 0xd8 ? 'image/jpeg' : 'image/png';
  return `url('data:${mime};base64,${bytes.toString('base64')}')`;
};

const lines: string[] = [];
for (const file of ['captured.dtcg.json', 'minted.dtcg.json']) {
  const tree = JSON.parse(readFileSync(path.join(SB, 'tokens', file), 'utf8')) as Record<string, unknown>;
  for (const [tokenPath, entry] of flattenTokens(tree)) {
    const target = aliasTarget(entry.value);
    const value = target ? `var(--${dashed(target)})` : inlineImage(String(entry.value));
    lines.push(`  --${dashed(tokenPath)}: ${value};`);
  }
}
lines.sort();

const css = `*, *::before, *::after { box-sizing: border-box; }\n:root {\n${lines.join('\n')}\n}\n`;
const current = readFileSync(OUT, 'utf8');

if (process.argv.includes('--write')) {
  if (css === current) console.log(`= tokens.css unchanged (${lines.length} custom properties)`);
  else {
    writeFileSync(OUT, css);
    console.log(`✎ tokens.css rewritten — ${lines.length} custom properties`);
  }
} else if (css === current) {
  console.log(`✔ tokens.css byte-identical to a rebuild (${lines.length} custom properties)`);
} else {
  console.error(`✘ tokens.css DIVERGES from a rebuild of the committed DTCG trees (${lines.length} custom properties) — run with --write`);
  process.exit(1);
}
