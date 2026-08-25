/**
 * Radix Themes token wrap — `node examples/radix-themes/scripts/build-tokens.mjs`
 *
 * BLINDNESS RULE: authored from the library's own shipped stylesheet and prop
 * definitions only. No stage of this repo's capture/promote/emit chain was run
 * against Radix Themes, and nothing here was tuned in response to our
 * pipeline's behaviour. See parity/receipts/v1/HELD-OUT-MANIFEST.md.
 *
 * Radix Themes is CSS-variable-first: `node_modules/@radix-ui/themes/styles.css`
 * (the one stylesheet the capture mounts) declares the whole vocabulary UNPREFIXED (`--accent-9`, `--gray-a3`,
 * `--space-3`, `--radius-3`, `--shadow-2`), and every component rule references
 * it with var(). The DTCG names here are the var names verbatim minus the `--`,
 * which is the spelling the CSS-vars reader binds against.
 *
 * WHICH DECLARATIONS COUNT (all three rules are library facts, not tuning):
 *
 *   1. `@media` blocks are SKIPPED; `@supports` blocks are DESCENDED INTO.
 *      styles.css ships every colour twice — once as sRGB hex and once as
 *      `color(display-p3 …)` inside
 *      `@supports (color: color(display-p3 1 1 1)) { @media (color-gamut: p3) { … } }`.
 *      Chromium SUPPORTS the display-p3 function, so skipping `@supports`
 *      wholesale would be wrong for the wrong reason; what actually gates the
 *      P3 values is the inner `@media (color-gamut: p3)`, which a standard
 *      sRGB render does not match. Skipping @media therefore drops exactly the
 *      P3 duplicates while KEEPING the `@supports (color: color-mix(in oklab,
 *      white, black))` overrides, which Chromium does apply — and a custom
 *      property is substituted, not computed, so `color-mix(...)` is literally
 *      the string the browser reports back for those names.
 *   2. Only the scopes a DEFAULT `<Theme>` activates are collected, in
 *      stylesheet order (later wins, as the cascade would at equal
 *      specificity). The list is SCOPES below; every entry corresponds to an
 *      attribute Radix's own Theme renders with no props set. `.dark` /
 *      `.dark-theme` are a MODE, not a second capture — same posture as the
 *      shadcn round's `.dark` scope — and a non-default attribute value
 *      (data-radius='full', data-scaling='90%', another accent) is a different
 *      configuration of the library, not part of what it ships by default.
 *   3. `var(--x)` aliases are resolved to a fixpoint against the collected map,
 *      because that is what the browser reports as the computed value of the
 *      alias (`--accent-9` computes to indigo-9's hex, not to the var() text).
 *      A reference that cannot be resolved is kept verbatim and counted.
 *
 * Value policy (deterministic):
 *   #hex / rgb() / rgba()  → type color, verbatim
 *   rem/px/em              → type dimension, verbatim
 *   bare number            → type number
 *   anything else          → type string, verbatim (calc(), shadows, font
 *                            stacks, transition timings — the reader's calc
 *                            exclusion means these never bind anyway)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EX = path.join(HERE, '..');
const SANDBOX = path.join(EX, '.radix-themes-sandbox');
const CSS = path.join(SANDBOX, 'node_modules', '@radix-ui', 'themes', 'styles.css');

/** The scopes a DEFAULT `<Theme>` (no props) actually activates. Every entry is
 *  justified by an attribute Radix's own Theme renders — measured in the
 *  sandbox, and matching dist/esm/components/theme.props.js's declared
 *  defaults: class="radix-themes" data-accent-color="indigo"
 *  data-gray-color="slate" (grayColor "auto" resolves to slate under an indigo
 *  accent) data-panel-background="translucent" data-radius="medium"
 *  data-scaling="100%" data-has-background="true". Anything scoped to a
 *  NON-default attribute value, to .dark/.dark-theme, or to a component class
 *  is not part of the shipped default vocabulary and is skipped. */
const SCOPES = [
  ':root, .light, .light-theme',
  ':root',
  '.radix-themes',
  ':where(.radix-themes)',
  "[data-accent-color]:where(:not([data-accent-color=''], [data-accent-color='gray']))",
  "[data-accent-color='indigo']",
  ".radix-themes:where([data-gray-color='slate'])",
  '[data-radius]',
  "[data-radius='medium']",
  ".radix-themes:where([data-scaling='100%'])",
  ".radix-themes:where([data-panel-background='translucent'])",
  ".radix-themes:where([data-has-background='true'])",
];

/** Style-rule walk in stylesheet order. Descends through `@supports` (Chromium
 *  satisfies every condition these stylesheets test) and never enters `@media`
 *  (the only @media here is `(color-gamut: p3)`, which an sRGB render does not
 *  match). */
function topLevelRules(css, out = []) {
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open === -1) break;
    // Everything after the last at-STATEMENT terminator is the selector: a
    // stylesheet opening with `@charset "UTF-8";` otherwise glues that
    // statement onto the first rule's prelude, the prelude then starts with
    // `@`, and the whole global token block is skipped as an at-rule.
    const raw = css.slice(i, open);
    const prelude = raw.slice(raw.lastIndexOf(';') + 1).trim();
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    const body = css.slice(open + 1, j - 1);
    if (prelude.startsWith('@supports')) topLevelRules(body, out);
    else if (!prelude.startsWith('@')) out.push({ prelude, body });
    i = j;
  }
  return out;
}

// Comments are stripped BEFORE the brace walk: a rule's prelude is everything
// between the previous rule's `}` and its own `{`, so a stray /* … */ (the
// licence banner, react-day-picker's per-declaration notes) lands inside the
// selector text and every scope match silently fails.
const css = readFileSync(CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const vars = new Map();
let blocks = 0;
for (const { prelude, body } of topLevelRules(css)) {
  const sel = prelude.replace(/\s+/g, ' ').trim();
  if (!SCOPES.includes(sel)) continue;
  blocks++;
  for (const m of body.matchAll(/--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g)) vars.set(m[1], m[2].trim());
}
if (vars.size === 0) throw new Error(`radix-themes wrap REFUSED: no declarations found in ${SCOPES.length} declared scopes of ${CSS}`);

// var() alias resolution to a fixpoint
let unresolved = 0;
const resolve = (raw, depth = 0) => {
  if (depth > 12 || !raw.includes('var(')) return raw;
  let changed = false;
  const out = raw.replace(/var\(\s*--([a-zA-Z0-9-]+)\s*(?:,[^)]*)?\)/g, (whole, name) => {
    if (!vars.has(name)) return whole;
    changed = true;
    return vars.get(name);
  });
  if (!changed) return out;
  return resolve(out, depth + 1);
};

const base = {};
let colors = 0, dims = 0, nums = 0, strings = 0;
for (const [name, raw0] of [...vars.entries()].sort()) {
  const raw = resolve(raw0);
  if (raw.includes('var(')) unresolved++;
  if (/^#[0-9a-fA-F]{3,8}$/.test(raw) || /^rgba?\(/.test(raw) || /^color-mix\(/.test(raw) || raw === 'white' || raw === 'black') {
    // NO NORMALISATION: `white` stays `white`. A custom property is
    // substituted, not computed — the browser reports the declared token
    // stream back verbatim, so a "helpful" rewrite to #ffffff would make every
    // one of these names un-bindable.
    base[name] = { $type: 'color', $value: raw };
    colors++;
  } else if (/^-?[\d.]+(rem|px|em)$/.test(raw)) {
    base[name] = { $type: 'dimension', $value: raw };
    dims++;
  } else if (/^-?[\d.]+$/.test(raw)) {
    base[name] = { $type: 'number', $value: raw };
    nums++;
  } else {
    base[name] = { $type: 'string', $value: raw };
    strings++;
  }
  if (raw !== raw0) base[name].$extensions = { 'dev.ds-contracts.source': { declared: raw0 } };
}

mkdirSync(path.join(EX, 'tokens'), { recursive: true });
writeFileSync(path.join(EX, 'tokens', 'radix-themes.dtcg.json'), JSON.stringify(base, null, 2) + '\n');
const flat = Object.keys(base).sort().map((k) => `  --${k}: ${base[k].$value};`);
writeFileSync(path.join(EX, 'tokens', 'radix-themes.vars.css'), `:root {\n${flat.join('\n')}\n}\n`);
console.log(
  `✔ ${vars.size} declarations from ${blocks} unconditional light-theme block(s) → ` +
    `${colors} color, ${dims} dimension, ${nums} number, ${strings} string` +
    `${unresolved ? ` · ${unresolved} still carry an unresolved var()` : ''} → examples/radix-themes/tokens/`,
);
console.log(`  spot: accent-9=${base['accent-9']?.$value} · gray-1=${base['gray-1']?.$value} · space-3=${base['space-3']?.$value} · radius-3=${base['radius-3']?.$value}`);
