/**
 * Astryx dev-journey token CSS —
 * `npx tsx examples/astryx/scripts/build-storybook-tokens.ts`
 *
 * Emits the Storybook fixture's `src/tokens.css` from the committed DTCG
 * wrap (examples/astryx/tokens/*.dtcg.json — the StyleX reader output, see
 * ../tokens/TOKENS.md). Token dot-paths become CSS custom properties with
 * the SAME hyphen rule the code generator's `cssVar` uses (`{a.b}` →
 * `var(--a-b)`), so every `var(--…)` the generated components reference
 * resolves. The astryx wrap is already flat/hyphenated, so a path is its own
 * variable name.
 *
 *   :root                 { … }   the light mode (base tree = light branch)
 *   :root[data-theme=dark]{ … }   the mode-varying light-dark() entries, dark
 *   @media (prefers-color-scheme: dark):root:not([data-theme=light]) { … }
 *
 * Deterministic: keys are emitted in sorted order, so rebuilds are byte-stable.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { flattenTokens } from '../../../core/tokens.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const EX = path.join(HERE, '..');

const read = (rel: string) => JSON.parse(readFileSync(path.join(EX, rel), 'utf8')) as Record<string, unknown>;

const base = read('tokens/astryx.dtcg.json');
const dark = read('tokens/modes/astryx.dark.dtcg.json');

const cssVarName = (dotPath: string) => `--${dotPath.split('.').join('-')}`;

function block(tree: Record<string, unknown>): string[] {
  const entries = [...flattenTokens(tree).entries()].sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([p, e]) => `  ${cssVarName(p)}: ${String(e.value)};`);
}

const lightDecls = block(base);
const darkDecls = block(dark);

const css = `/* GENERATED — do not edit.
 * Astryx StyleX tokens as CSS custom properties.
 * Rebuild: npx tsx examples/astryx/scripts/build-storybook-tokens.ts
 * Source: examples/astryx/tokens/{astryx,modes/astryx.dark}.dtcg.json
 * (${lightDecls.length} light tokens · ${darkDecls.length} dark overrides)
 */
:root {
${lightDecls.join('\n')}
}

/* Explicit dark opt-in (Storybook toolbar / [data-theme=dark]). */
:root[data-theme='dark'] {
${darkDecls.join('\n')}
}

/* System dark, unless the light theme is explicitly pinned. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
${darkDecls.map((d) => `  ${d}`).join('\n')}
  }
}
`;

mkdirSync(path.join(EX, 'storybook', 'src'), { recursive: true });
writeFileSync(path.join(EX, 'storybook', 'src', 'tokens.css'), css);
console.log(
  `✔ tokens.css written → examples/astryx/storybook/src/tokens.css (${lightDecls.length} light + ${darkDecls.length} dark overrides)`,
);
