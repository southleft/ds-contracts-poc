/**
 * Carbon token wrap — `node examples/carbon/scripts/build-tokens.mjs`
 *
 * Parses the PRECOMPILED stylesheet `@carbon/styles/css/styles.css` (shipped
 * in the package; no Sass build) and commits the mechanical DTCG wrap.
 *
 * WHY THE COMPILED CSS AND NOT `@carbon/themes` (the JS package):
 * `@carbon/themes` exposes camelCase keys (`layer01`, `textPrimary`) while the
 * custom properties the components actually reference are kebab-and-numbered
 * (`--cds-layer-01`, `--cds-text-primary`). A camelCase→kebab guess is exactly
 * where a numbered token silently mismatches (`layer01` → `layer01`, not
 * `layer-01`), and a token that does not match by NAME binds nothing. The
 * compiled CSS names the properties the way the components reference them, so
 * it is the only non-guessing source.
 *
 * WHAT IS PARSED (recon-verified counts, re-asserted here so a Carbon bump
 * that moves them REFUSES rather than silently shrinking the inventory):
 *   · `.cds--white`  → 327 declarations — the base + the Light mode
 *   · `.cds--g100`   → 326 declarations — the Dark mode
 *   · the `:root` LAYOUT block → 12 declarations (`--cds-layout-size-height-*`,
 *     `--cds-layout-density-padding-inline-*`). These are theme-INDEPENDENT
 *     (they live at :root, not in a theme class) and are the only :root
 *     `--cds-` declarations that are real design values — the other :root
 *     blocks are the responsive GRID cascade (`--cds-grid-columns` redeclared
 *     per breakpoint), which is a media-query-varying value with no single
 *     truth and is EXCLUDED BY NAME.
 *
 * FAMILY SPLIT (the load-bearing Carbon finding, PROVENANCE.md):
 *   colors/borders/focus  → custom properties → these tokens, and they BIND.
 *   TYPE (heading/body/label/code/helper)  → REFERENCED by the components
 *                                            (`var(--cds-body-01-font-size)`)
 *                                            but NEVER DEFINED — Carbon's type
 *                                            custom properties are a Sass
 *                                            opt-in the compiled CSS does not
 *                                            emit. 80 such references.
 *   SPACING / MOTION      → not custom properties at all (0 defined) — the
 *                           compiled utilities carry literal rem/ms.
 *   So an alias is almost always a COLOR. That is the library's own shape,
 *   not a reader gap.
 *
 * Value policy (deterministic):
 *   #hex / rgba()                 → type color, verbatim
 *   rem / px                      → type dimension (genesis converts rem×16)
 *   bare number                   → type number
 *   var(--cds-X, fallback)        → RESOLVED to X's value IN THE SAME THEME
 *                                   BLOCK (the 15 contextual aliases:
 *                                   `--cds-layer: var(--cds-layer-01,#f4f4f4)`).
 *                                   Resolving against the block — not against
 *                                   the literal fallback — is what makes the
 *                                   Dark mode correct: the fallback is frozen
 *                                   at the light value in EVERY theme block.
 *                                   Original spelling kept in $extensions.
 *   anything else (`light`/`g100` → type string (named; the reader's own
 *   for --cds-color-scheme)          verification never binds these anyway)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EX = path.join(HERE, '..');
const CSS = path.join(EX, '.carbon-sandbox', 'node_modules', '@carbon', 'styles', 'css', 'styles.css');
const css = readFileSync(CSS, 'utf8');

/** Every `--name: value;` declaration of the first block matching `re`. */
function declsOf(re, label, expect) {
  const m = re.exec(css);
  if (!m) throw new Error(`carbon wrap REFUSED: no ${label} block in styles.css`);
  const out = new Map();
  for (const d of m[1].matchAll(/(--cds-[a-zA-Z0-9-]+)\s*:\s*([^;]+)/g)) out.set(d[1].slice('--cds-'.length), d[2].trim());
  if (out.size !== expect) {
    throw new Error(
      `carbon wrap REFUSED: ${label} has ${out.size} --cds- declarations, the pinned recon says ${expect} — ` +
        `a Carbon bump moved the inventory; re-verify the family split before re-pinning`,
    );
  }
  return out;
}

const white = declsOf(/\.cds--white\s*\{([^}]*)\}/, '.cds--white', 327);
const g100 = declsOf(/\.cds--g100\s*\{([^}]*)\}/, '.cds--g100', 326);
// the :root LAYOUT block — identified BY CONTENT (it declares
// --cds-layout-size-height-xs), never by ordinal position in the file.
const layoutBlock = [...css.matchAll(/:root\s*\{([^}]*)\}/g)].find((m) => m[1].includes('--cds-layout-size-height-xs'));
if (!layoutBlock) throw new Error('carbon wrap REFUSED: no :root block declaring --cds-layout-size-height-xs');
const layout = new Map();
for (const d of layoutBlock[1].matchAll(/(--cds-[a-zA-Z0-9-]+)\s*:\s*([^;]+)/g)) layout.set(d[1].slice('--cds-'.length), d[2].trim());
if (layout.size !== 12) throw new Error(`carbon wrap REFUSED: :root layout block has ${layout.size} declarations, pinned 12`);

/** var(--cds-X, fallback) → X's value in the SAME block (one hop; Carbon's
 *  contextual aliases are exactly one level). Refuses an unresolvable hop by
 *  name rather than silently keeping the frozen light fallback. */
const CONTEXTUAL = /^var\(\s*--cds-([a-zA-Z0-9-]+)\s*,\s*([^)]*)\)$/;
function resolveIn(block, name, raw, blockLabel) {
  const m = CONTEXTUAL.exec(raw);
  if (!m) return { value: raw };
  const target = m[1];
  const hit = block.get(target);
  if (hit === undefined) {
    throw new Error(
      `carbon wrap REFUSED: ${blockLabel} --cds-${name} = ${raw} references --cds-${target}, which that theme block does not declare ` +
        `(keeping the frozen fallback ${m[2].trim()} would bake the LIGHT value into every mode)`,
    );
  }
  if (CONTEXTUAL.test(hit)) throw new Error(`carbon wrap REFUSED: ${blockLabel} --cds-${name} → --cds-${target} is a MULTI-HOP alias; the wrap follows exactly one hop`);
  return { value: hit, source: raw, alias: target };
}

const isColor = (v) => /^#[0-9a-fA-F]{3,8}$/.test(v) || /^rgba?\(/.test(v);
const isDim = (v) => /^-?[\d.]+(rem|px|em)$/.test(v);
const isNum = (v) => /^-?[\d.]+$/.test(v);

function typed(value, extra) {
  const $type = isColor(value) ? 'color' : isDim(value) ? 'dimension' : isNum(value) ? 'number' : 'string';
  return { $type, $value: value, ...(extra ? { $extensions: { 'dev.ds-contracts.source': extra } } : {}) };
}

// ---- base = .cds--white (the default theme) + the :root layout block ----
const base = {};
const counts = { color: 0, dimension: 0, number: 0, string: 0 };
let contextual = 0;
for (const [name, raw] of [...white, ...layout].sort((a, b) => a[0].localeCompare(b[0]))) {
  const r = resolveIn(white, name, raw, '.cds--white');
  if (r.alias) contextual++;
  base[name] = typed(r.value, r.alias ? { css: r.source, aliasOf: r.alias } : undefined);
  counts[base[name].$type]++;
}

// ---- modes: Light = .cds--white, Dark = .cds--g100 ----
const modeOf = (block, label) => {
  const out = {};
  for (const [name, raw] of [...block].sort((a, b) => a[0].localeCompare(b[0]))) {
    const r = resolveIn(block, name, raw, label);
    out[name] = typed(r.value);
  }
  // the :root layout block is theme-INDEPENDENT: it rides both modes verbatim
  // so a mode file is a complete inventory (the genesis token sync reads
  // light[name] ?? base[name] per token; an absent name silently falls back,
  // which is exactly how a mode gap goes unnoticed).
  for (const [name, raw] of [...layout].sort((a, b) => a[0].localeCompare(b[0]))) out[name] = typed(raw);
  return out;
};
const light = modeOf(white, '.cds--white');
const dark = modeOf(g100, '.cds--g100');

// The Dark block declares ONE fewer property than the light one; naming which
// is the difference between a receipt and a shrug.
const onlyLight = Object.keys(light).filter((k) => !(k in dark));
const onlyDark = Object.keys(dark).filter((k) => !(k in light));

mkdirSync(path.join(EX, 'tokens', 'modes'), { recursive: true });
writeFileSync(path.join(EX, 'tokens', 'carbon.dtcg.json'), JSON.stringify(base, null, 2) + '\n');
writeFileSync(path.join(EX, 'tokens', 'modes', 'carbon.light.dtcg.json'), JSON.stringify(light, null, 2) + '\n');
writeFileSync(path.join(EX, 'tokens', 'modes', 'carbon.dark.dtcg.json'), JSON.stringify(dark, null, 2) + '\n');
const flat = Object.keys(base).sort().map((k) => `  --${k}: ${base[k].$value};`);
writeFileSync(path.join(EX, 'tokens', 'carbon.vars.css'), `:root {\n${flat.join('\n')}\n}\n`);

console.log(
  `✔ ${Object.keys(base).length} Carbon tokens wrapped (${counts.color} color, ${counts.dimension} dimension, ` +
    `${counts.number} number, ${counts.string} string; ${contextual} contextual aliases resolved one hop within their theme block) → examples/carbon/tokens/`,
);
console.log(`  modes: Light=.cds--white (${Object.keys(light).length}) · Dark=.cds--g100 (${Object.keys(dark).length})` +
  (onlyLight.length ? ` · light-only: ${onlyLight.join(', ')}` : '') + (onlyDark.length ? ` · dark-only: ${onlyDark.join(', ')}` : ''));
console.log(`  spot: button-primary=${base['button-primary']?.$value} · layer-01=${base['layer-01']?.$value} · layer=${base['layer']?.$value} (dark ${dark['layer']?.$value}) · layout-size-height-md=${base['layout-size-height-md']?.$value}`);
