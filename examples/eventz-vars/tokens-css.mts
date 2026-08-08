/**
 * storybook/src/tokens.css — the Eventz kit's token stylesheet, rebuilt from
 * the two COMMITTED DTCG trees (the untitled-ui tokens-css.mts pattern,
 * applied to this kit's layout: contracts and tokens live at the kit root,
 * not under storybook/).
 *
 *   flatten(captured) + flatten(minted) → `--<dot.path with dots→dashes>: <value>`
 *   DTCG alias ({other.token})          → `var(--other-token)`
 *
 * MODE NOTE — captured.dtcg.json is the BASE (default-mode) tree; the kit's
 * light.dtcg.json / dark.dtcg.json per-mode trees are NOT flattened in.
 * Renders and fidelity therefore score the default (Light) plane, which is
 * the plane the canvas variants were drawn on. 43 variables genuinely differ
 * between the two modes (eventz-pipeline.mts) — the dark plane is carried in
 * the committed trees but is not exercised by this stylesheet.
 *
 *   npx tsx examples/eventz-vars/tokens-css.mts            # verify only
 *   npx tsx examples/eventz-vars/tokens-css.mts --write    # rewrite tokens.css
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { aliasTarget, flattenTokens } from '../../core/tokens.js';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const OUT = path.join(HERE, 'storybook', 'src', 'tokens.css');

const dashed = (p: string): string => p.split('.').join('-');

const lines: string[] = [];
for (const file of ['captured.dtcg.json', 'minted.dtcg.json']) {
  const tree = JSON.parse(readFileSync(path.join(HERE, 'tokens', file), 'utf8')) as Record<string, unknown>;
  for (const [tokenPath, entry] of flattenTokens(tree)) {
    const target = aliasTarget(entry.value);
    const value = target ? `var(--${dashed(target)})` : String(entry.value);
    lines.push(`  --${dashed(tokenPath)}: ${value};`);
  }
}
lines.sort();

const css = `*, *::before, *::after { box-sizing: border-box; }\n:root {\n${lines.join('\n')}\n}\n`;
let current: string | null = null;
try {
  current = readFileSync(OUT, 'utf8');
} catch {
  current = null;
}

if (process.argv.includes('--write')) {
  if (css === current) console.log(`= tokens.css unchanged (${lines.length} custom properties)`);
  else {
    mkdirSync(path.dirname(OUT), { recursive: true });
    writeFileSync(OUT, css);
    console.log(`✎ tokens.css rewritten — ${lines.length} custom properties`);
  }
} else if (css === current) {
  console.log(`✔ tokens.css byte-identical to a rebuild (${lines.length} custom properties)`);
} else {
  console.error(`✘ tokens.css DIVERGES from a rebuild of the committed DTCG trees (${lines.length} custom properties) — run with --write`);
  process.exit(1);
}
