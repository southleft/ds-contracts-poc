/**
 * Altitude token wrap — `node examples/altitude/scripts/build-tokens.mjs`
 *
 * Parses the PRECOMPILED Style-Dictionary output shipped in the package
 * (`altitude-web-components/dist/css/tokens-light.css` and `tokens-dark.css`)
 * and commits the mechanical DTCG wrap.
 *
 * WHY THE EMITTED CSS AND NOT THE TOKENS-STUDIO JSON. Altitude's tokens are
 * authored in Tokens Studio and compiled by Style Dictionary, and the JSON is
 * NOT in the published package at all (`files: ["dist", …]`). The emitted CSS
 * is therefore both the only shipped source and the one that names the
 * properties the way the components reference them — the same reason the
 * Carbon wrap reads the compiled stylesheet instead of `@carbon/themes`.
 *
 * NAMING — WHY `--al-` AND NOT `--al-theme-`. The reader's `tokenName()`
 * strips `library.varPrefix` from a custom-property name to get the DTCG leaf
 * path, so the prefix decides the whole naming scheme. Altitude has TWO tiers
 * in one namespace:
 *   · 208 PRIMITIVES — `--al-color-blue-500`, `--al-space-2`, literal values
 *   · 115 SEMANTIC   — `--al-theme-color-background-brand-primary`, each one
 *                      `var(--al-<primitive>)` (exactly one hop, twice two)
 * Prefixing at `--al-theme-` would name only the semantic tier and make every
 * component that references a primitive DIRECTLY unbindable. The recon's
 * argument for the narrower prefix — that the ~40 UNDEFINED per-component
 * escape hatches (`--al-button-padding`, …) would "crowd the candidates" — is
 * wrong and was measured: an undefined custom property computes to the EMPTY
 * STRING, the reader's `push()` drops empty candidates before they are ever
 * scored, and they are not DTCG leaves so `dtcgNames.has()` would drop them
 * again. So the prefix is `--al-`, leaf names are the property minus `--al-`
 * (`theme-color-background-brand-primary`, `color-blue-500`), and both tiers
 * bind.
 *
 * Value policy (deterministic, same shape as the Carbon wrap):
 *   #hex / rgba()             → color
 *   rem / px / em             → dimension
 *   bare number               → number
 *   var(--al-X)               → RESOLVED to X's value IN THE SAME MODE BLOCK.
 *                               Resolving inside the block (never against a
 *                               literal fallback — Altitude's aliases carry
 *                               none) is what keeps Dark honest. Altitude has
 *                               TWO two-hop aliases; the wrap follows the
 *                               chain to a literal and refuses a cycle by name.
 *                               Original spelling kept in $extensions.
 *   anything else             → string (durations, easings, shadows, the
 *                               `font` shorthands, `50%`)
 *
 * MODES. Light = tokens-light.css `:root` (323), Dark = tokens-dark.css
 * `:root` (322). The one light-only name is printed. `main.css` also carries a
 * `:root` block — it is the DARK set (322 names, dark values), which is why the
 * capture harness appends tokens-light.css AFTER main.css; the wrap does not
 * read main.css at all.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EX = path.join(HERE, '..');
const CSSDIR = path.join(EX, '.altitude-sandbox', 'node_modules', 'altitude-web-components', 'dist', 'css');

const PREFIX = '--al-';

/** The `:root` declarations of one shipped token stylesheet. Counts are
 *  re-asserted so an Altitude bump that moves the inventory REFUSES instead of
 *  silently shrinking it. */
function declsOf(file, expect) {
  const css = readFileSync(path.join(CSSDIR, file), 'utf8');
  const m = /:root\s*\{([\s\S]*?)\}/.exec(css);
  if (!m) throw new Error(`altitude wrap REFUSED: no :root block in ${file}`);
  const out = new Map();
  for (const d of m[1].matchAll(/(--al-[a-zA-Z0-9-]+)\s*:\s*([^;]+)/g)) out.set(d[1].slice(PREFIX.length), d[2].trim());
  if (out.size !== expect) {
    throw new Error(
      `altitude wrap REFUSED: ${file} :root has ${out.size} ${PREFIX} declarations, the pinned recon says ${expect} — ` +
        `an Altitude bump moved the inventory; re-verify before re-pinning`,
    );
  }
  return out;
}

const light = declsOf('tokens-light.css', 323);
const dark = declsOf('tokens-dark.css', 322);

/** var(--al-X) → X's value in the SAME block, following the alias chain to a
 *  literal. Altitude's semantic tier is one hop deep except for exactly two
 *  names (theme-color-header-background, theme-color-body-background) which are
 *  two. Bounded and cycle-refusing rather than "one hop or give up". */
const ALIAS = /^var\(\s*--al-([a-zA-Z0-9-]+)\s*(?:,\s*([^)]*))?\)$/;
function resolveIn(block, name, raw, label) {
  let cur = raw;
  const chain = [];
  for (let i = 0; i < 8; i++) {
    const m = ALIAS.exec(cur);
    if (!m) return chain.length ? { value: cur, source: raw, alias: chain[0], hops: chain.length } : { value: cur };
    const target = m[1];
    if (chain.includes(target)) {
      throw new Error(`altitude wrap REFUSED: ${label} --al-${name} alias chain CYCLES at --al-${target}`);
    }
    chain.push(target);
    const hit = block.get(target);
    if (hit === undefined) {
      throw new Error(
        `altitude wrap REFUSED: ${label} --al-${name} = ${cur} references --al-${target}, which that mode block does not declare`,
      );
    }
    cur = hit;
  }
  throw new Error(`altitude wrap REFUSED: ${label} --al-${name} alias chain exceeds 8 hops`);
}

const isColor = (v) => /^#[0-9a-fA-F]{3,8}$/.test(v) || /^rgba?\(/.test(v);
const isDim = (v) => /^-?[\d.]+(rem|px|em)$/.test(v);
const isNum = (v) => /^-?[\d.]+$/.test(v);

const typed = (value, extra) => ({
  $type: isColor(value) ? 'color' : isDim(value) ? 'dimension' : isNum(value) ? 'number' : 'string',
  $value: value,
  ...(extra ? { $extensions: { 'dev.ds-contracts.source': extra } } : {}),
});

const wrap = (block, label) => {
  const out = {};
  const counts = { color: 0, dimension: 0, number: 0, string: 0 };
  let aliased = 0;
  let multiHop = 0;
  for (const [name, raw] of [...block].sort((a, b) => a[0].localeCompare(b[0]))) {
    const r = resolveIn(block, name, raw, label);
    if (r.alias) { aliased++; if (r.hops > 1) multiHop++; }
    out[name] = typed(r.value, r.alias ? { css: r.source, aliasOf: r.alias, hops: r.hops } : undefined);
    counts[out[name].$type]++;
  }
  return { out, counts, aliased, multiHop };
};

// base = the LIGHT mode (the capture harness's pinned colorScheme)
const b = wrap(light, 'tokens-light.css');
const l = wrap(light, 'tokens-light.css');
const d = wrap(dark, 'tokens-dark.css');
// mode files carry resolved literals only (no $extensions) — the genesis token
// sync reads them per name and an $extensions block is not part of that read.
const strip = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { $type: v.$type, $value: v.$value }]));

const onlyLight = Object.keys(l.out).filter((k) => !(k in d.out));
const onlyDark = Object.keys(d.out).filter((k) => !(k in l.out));
const differing = Object.keys(l.out).filter((k) => k in d.out && l.out[k].$value !== d.out[k].$value);

mkdirSync(path.join(EX, 'tokens', 'modes'), { recursive: true });
writeFileSync(path.join(EX, 'tokens', 'altitude.dtcg.json'), JSON.stringify(b.out, null, 2) + '\n');
writeFileSync(path.join(EX, 'tokens', 'modes', 'altitude.light.dtcg.json'), JSON.stringify(strip(l.out), null, 2) + '\n');
writeFileSync(path.join(EX, 'tokens', 'modes', 'altitude.dark.dtcg.json'), JSON.stringify(strip(d.out), null, 2) + '\n');
const flat = Object.keys(b.out).sort().map((k) => `  --${k}: ${b.out[k].$value};`);
writeFileSync(path.join(EX, 'tokens', 'altitude.vars.css'), `:root {\n${flat.join('\n')}\n}\n`);

console.log(
  `✔ ${Object.keys(b.out).length} Altitude tokens wrapped (${b.counts.color} color, ${b.counts.dimension} dimension, ` +
    `${b.counts.number} number, ${b.counts.string} string; ${b.aliased} semantic aliases resolved within their mode block, ` +
    `${b.multiHop} of them multi-hop) → examples/altitude/tokens/`,
);
console.log(
  `  modes: Light=tokens-light.css (${Object.keys(l.out).length}) · Dark=tokens-dark.css (${Object.keys(d.out).length}) · ` +
    `${differing.length} names differ by value` +
    (onlyLight.length ? ` · light-only: ${onlyLight.join(', ')}` : '') +
    (onlyDark.length ? ` · dark-only: ${onlyDark.join(', ')}` : ''),
);
console.log(
  `  spot: theme-color-background-brand-primary=${b.out['theme-color-background-brand-primary']?.$value}` +
    ` (dark ${d.out['theme-color-background-brand-primary']?.$value})` +
    ` · theme-color-content-default=${b.out['theme-color-content-default']?.$value}` +
    ` · color-blue-500=${b.out['color-blue-500']?.$value}`,
);
