/**
 * react-day-picker token wrap — `node examples/day-picker/scripts/build-tokens.mjs`
 *
 * BLINDNESS RULE: authored from the library's own shipped stylesheet only. No
 * stage of this repo's capture/promote/emit chain was run against
 * react-day-picker, and nothing here was tuned in response to our pipeline's
 * behaviour. See parity/receipts/v1/HELD-OUT-MANIFEST.md.
 *
 * This is the SMALLEST token vocabulary in the corpus and that is the point of
 * the probe: `src/style.css` declares its entire theming surface as 38
 * `--rdp-*` custom properties on `.rdp-root`, most of them carrying an inline
 * comment that names them. Everything else the calendar renders — the month
 * grid's track sizes, the caption's flex layout, the nav button geometry — is
 * hard-coded CSS with no token behind it. A first pass against this subject is
 * therefore expected to mint far more than it binds, and that ratio is a real
 * measurement, not a defect: a complex component ships mostly LAYOUT, and
 * layout is not tokenised.
 *
 * `@media` is skipped; `@supports` is descended into. `var(--x)` aliases are
 * resolved to a fixpoint. Nothing is normalised — a custom property is
 * substituted rather than computed, so `blue` stays `blue`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EX = path.join(HERE, '..');
const CSS = path.join(EX, '.day-picker-sandbox', 'node_modules', 'react-day-picker', 'src', 'style.css');
const SCOPES = ['.rdp-root'];

function styleRules(css, out = []) {
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
    if (prelude.startsWith('@supports')) styleRules(body, out);
    else if (!prelude.startsWith('@')) out.push({ prelude, body });
    i = j;
  }
  return out;
}

// the declarations carry trailing `/* … */` comments; strip them per value
const stripComment = (v) => v.replace(/\/\*[\s\S]*?\*\//g, '').trim();

// Comments are stripped BEFORE the brace walk: a rule's prelude is everything
// between the previous rule's `}` and its own `{`, so a stray /* … */ (the
// licence banner, react-day-picker's per-declaration notes) lands inside the
// selector text and every scope match silently fails.
const css = readFileSync(CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const vars = new Map();
let blocks = 0;
for (const { prelude, body } of styleRules(css)) {
  const sel = prelude.replace(/\s+/g, ' ').trim();
  if (!SCOPES.includes(sel)) continue;
  blocks++;
  for (const m of body.matchAll(/--rdp-([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g)) vars.set(`rdp-${m[1]}`, stripComment(m[2]));
}
if (vars.size === 0) throw new Error(`day-picker wrap REFUSED: no --rdp-* declarations on ${SCOPES.join(' / ')} of ${CSS}`);

let unresolved = 0;
const resolve = (raw, depth = 0) => {
  if (depth > 12 || !raw.includes('var(')) return raw;
  let changed = false;
  const out = raw.replace(/var\(\s*--([a-zA-Z0-9_-]+)\s*(?:,[^)]*)?\)/g, (whole, name) => {
    if (!vars.has(name)) return whole;
    changed = true;
    return vars.get(name);
  });
  return changed ? resolve(out, depth + 1) : out;
};

const base = {};
let colors = 0, dims = 0, nums = 0, strings = 0;
for (const [name, raw0] of [...vars.entries()].sort()) {
  const raw = resolve(raw0);
  if (raw.includes('var(')) unresolved++;
  if (/^#[0-9a-fA-F]{3,8}$/.test(raw) || /^rgba?\(/.test(raw) || /^(?:blue|white|black|red|green)$/.test(raw)) {
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
writeFileSync(path.join(EX, 'tokens', 'day-picker.dtcg.json'), JSON.stringify(base, null, 2) + '\n');
const flat = Object.keys(base).sort().map((k) => `  --${k}: ${base[k].$value};`);
writeFileSync(path.join(EX, 'tokens', 'day-picker.vars.css'), `:root {\n${flat.join('\n')}\n}\n`);
console.log(
  `✔ ${vars.size} --rdp-* declarations from ${blocks} .rdp-root block(s) → ` +
    `${colors} color, ${dims} dimension, ${nums} number, ${strings} string` +
    `${unresolved ? ` · ${unresolved} still carry an unresolved var()` : ''} → examples/day-picker/tokens/`,
);
console.log(`  spot: rdp-accent-color=${base['rdp-accent-color']?.$value} · rdp-day-width=${base['rdp-day-width']?.$value} · rdp-today-color=${base['rdp-today-color']?.$value}`);
