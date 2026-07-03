/**
 * Token build — DTCG token files → CSS custom properties. Zero dependencies.
 *
 * The token dialect in this repo is deliberately tiny (hex-string colors,
 * unit-string dimensions, single-level `{path.to.token}` aliases — see
 * docs/03-token-pipeline.md), so no token-build framework is needed.
 *
 * Two outputs, mirroring the DTCG Resolver Module mental model:
 *   src/styles/tokens.css        :root               (primitives + semantic + light)
 *   src/styles/tokens.dark.css   [data-theme="dark"]  (mode-varying tokens only)
 *
 * Aliases are preserved as var() references so the CSS reads like the token
 * architecture. Unresolvable aliases fail the build.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));

/** Flatten a DTCG tree to Map<"dot.path", $value>. */
function flatten(tree, prefix = [], out = new Map()) {
  for (const [key, value] of Object.entries(tree)) {
    if (key.startsWith('$')) continue;
    if (value && typeof value === 'object') {
      if ('$value' in value) out.set([...prefix, key].join('.'), value.$value);
      else flatten(value, [...prefix, key], out);
    }
  }
  return out;
}

const cssName = (path) => `--${path.split('.').join('-')}`;
const ALIAS = /^\{([^}]+)\}$/;

function cssValue(tokenPath, value, resolvable) {
  if (typeof value === 'string') {
    const alias = value.match(ALIAS);
    if (alias) {
      if (!resolvable.has(alias[1])) {
        throw new Error(`Token "${tokenPath}" references "{${alias[1]}}" which does not exist`);
      }
      return `var(${cssName(alias[1])})`;
    }
    return value;
  }
  return String(value);
}

function emit(selector, tokens, resolvable) {
  const lines = [
    '/**',
    ' * GENERATED FILE — DO NOT EDIT.',
    ' * Source of truth: tokens/*.tokens.json — regenerate with: npm run tokens',
    ' */',
    '',
    `${selector} {`,
  ];
  for (const [path, value] of tokens) {
    lines.push(`  ${cssName(path)}: ${cssValue(path, value, resolvable)};`);
  }
  lines.push('}', '');
  return lines.join('\n');
}

const primitives = flatten(read('tokens/primitives.tokens.json'));
const semantic = flatten(read('tokens/semantic.tokens.json'));
const light = flatten(read('tokens/modes/semantic.light.tokens.json'));
const dark = flatten(read('tokens/modes/semantic.dark.tokens.json'));

// Light and dark mode files must define the same token set — a token defined
// in one mode but not the other is drift inside the source of truth itself.
for (const path of light.keys()) {
  if (!dark.has(path)) throw new Error(`Token "${path}" exists in light mode but not dark`);
}
for (const path of dark.keys()) {
  if (!light.has(path)) throw new Error(`Token "${path}" exists in dark mode but not light`);
}

const base = new Map([...primitives, ...semantic, ...light]);

mkdirSync('src/styles', { recursive: true });
writeFileSync('src/styles/tokens.css', emit(':root', base, base));
writeFileSync(
  'src/styles/tokens.dark.css',
  emit('[data-theme="dark"]', dark, new Map([...base, ...dark])),
);

console.log(
  `✔ Tokens built: ${base.size} custom properties (:root), ${dark.size} dark-mode overrides`,
);
