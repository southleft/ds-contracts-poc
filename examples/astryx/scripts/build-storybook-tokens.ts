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
 *   :root                 { … }   the light mode (base + minted trees)
 *   :root[data-theme=dark]{ … }   the mode-varying light-dark() entries, dark
 *   @media (prefers-color-scheme: dark):root:not([data-theme=light]) { … }
 *
 * Deterministic: keys are emitted in sorted order, so rebuilds are byte-stable.
 *
 * TWO DEFECTS THIS SCRIPT CARRIED, both of which made the FIXTURE INVALID while
 * every gate stayed green.
 *
 * 1. IT READ ONLY THE BASE AND DARK TREES. `tokens/astryx-minted.dtcg.json` —
 *    the whole `imported.*` subtree the computed-capture round mints — was
 *    never read, so not one `--imported-*` custom property was ever emitted.
 *    Meanwhile the generated components reference them: the committed
 *    `storybook/src/generated/**` names 34 distinct `--imported-*` variables
 *    that this file defined ZERO of (e.g. `Badge.module.css` binds
 *    `var(--imported-badge-root-background-color-info)` with no fallback). Those
 *    declarations are invalid at computed-value time and the browser falls back
 *    to the initial value — a silently wrong render, not an error. Regenerating
 *    the components against today's contracts raises the count to 312, which is
 *    why the storybook freshness gate held astryx as a NAMED HOLE until this
 *    landed.
 *
 * 2. IT STRINGIFIED ALIASES VERBATIM. `String(e.value)` on a DTCG alias emits
 *    the literal `{font-size-base}` as a CSS value. This was ACCIDENTALLY
 *    CORRECT until the DTCG alias pass landed in build-tokens.ts (`var(--x)` →
 *    `{x}`, "28 → 0 var strings"): that change re-spelled the source and
 *    orphaned this reader, which nothing re-derived and so nothing noticed.
 *
 * An alias resolves to `var(--target)`, NOT to the target's literal value, and
 * that distinction is load-bearing: 77 of the 80 minted aliases point at
 * dark-varying tokens, so flattening them to literals here would silently kill
 * dark mode for every one of them. `core/tokens.ts`'s `makeResolveLiteral` is
 * therefore the WRONG tool; the model is `scripts/build-tokens.mjs:31-45`,
 * which the figma and docs token builders already follow.
 *
 * A missing alias target REFUSES BY NAME rather than emitting a dangling
 * `var()` — the same door `build-figma-tokens.ts` keeps.
 *
 * NAMED ASYMMETRY: the minted tree has no dark counterpart, so minted LITERAL
 * leaves are mode-frozen in `:root`; minted ALIAS leaves inherit dark through
 * the `var()` indirection. That is a property of the mint, not of this script.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { aliasTarget, flattenTokens } from '../../../core/tokens.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const EX = path.join(HERE, '..');

const read = (rel: string) => JSON.parse(readFileSync(path.join(EX, rel), 'utf8')) as Record<string, unknown>;

const base = read('tokens/astryx.dtcg.json');
const minted = read('tokens/astryx-minted.dtcg.json');
const dark = read('tokens/modes/astryx.dark.dtcg.json');

const cssVarName = (dotPath: string) => `--${dotPath.split('.').join('-')}`;

const flat = (tree: Record<string, unknown>) =>
  [...flattenTokens(tree).entries()].sort(([a], [b]) => a.localeCompare(b));

/** Every name a `{ref}` may point at. Built from the LIGHT plane (base +
 *  minted): the dark tree only re-states names that already exist there. */
const resolvable = new Set<string>([...flat(base).map(([p]) => p), ...flat(minted).map(([p]) => p)]);

function decls(tree: Record<string, unknown>, where: string): string[] {
  return flat(tree).map(([p, e]) => {
    const target = aliasTarget(e.value);
    if (target === null) return `  ${cssVarName(p)}: ${String(e.value)};`;
    if (!resolvable.has(target)) {
      throw new Error(
        `${where}: token "${p}" references "{${target}}", which no committed astryx token tree defines. ` +
          `Emitting it would write a dangling var() that falls back silently — the exact failure this script ` +
          `was fixed to stop. Add the token, or drop the reference.`,
      );
    }
    return `  ${cssVarName(p)}: var(${cssVarName(target)});`;
  });
}

const lightDecls = [...decls(base, 'astryx.dtcg.json'), ...decls(minted, 'astryx-minted.dtcg.json')].sort();
const darkDecls = decls(dark, 'modes/astryx.dark.dtcg.json');

const css = `/* GENERATED — do not edit.
 * Astryx StyleX tokens as CSS custom properties.
 * Rebuild: npx tsx examples/astryx/scripts/build-storybook-tokens.ts
 * Source: examples/astryx/tokens/{astryx,astryx-minted,modes/astryx.dark}.dtcg.json
 * (${lightDecls.length} light tokens · ${darkDecls.length} dark overrides)
 * Aliases resolve to var(--target), never to a literal, so mode-varying
 * targets keep following the theme.
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
