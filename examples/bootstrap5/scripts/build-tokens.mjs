/**
 * Bootstrap 5 token wrap — `node examples/bootstrap5/scripts/build-tokens.mjs`
 *
 * BLINDNESS RULE: authored from the library's own shipped stylesheet only. No
 * stage of this repo's capture/promote/emit chain was run against Bootstrap,
 * and nothing here was tuned in response to our pipeline's behaviour. See
 * parity/receipts/v1/HELD-OUT-MANIFEST.md.
 *
 * Bootstrap 5.3 is the first Bootstrap with a real CSS-variable layer: the
 * global palette and type scale are declared as `--bs-*` on
 * `:root, [data-bs-theme=light]` in `dist/css/bootstrap.css`, and the
 * component rules reference them with var(). Those are the ONLY declarations
 * wrapped here. Deliberately NOT wrapped:
 *
 *   · `[data-bs-theme=dark]` — a MODE, not a second capture (the shadcn
 *     `.dark` posture).
 *   · the per-component local sets (`--bs-btn-bg` on `.btn`, `--bs-alert-color`
 *     on `.alert`, …). Bootstrap declares roughly forty of these ON THE
 *     COMPONENT'S OWN ROOT, not globally: they are the component's private
 *     plumbing, they are what the CSS-vars reader will actually observe at the
 *     element, and their VALUES come from the globals wrapped here. A global
 *     token file that also claimed `.btn`'s locals would be asserting a
 *     vocabulary Bootstrap does not publish. Whether the reader can bind
 *     through that one extra hop is a question this exam asks, not one the
 *     token file should pre-answer.
 *
 * `@media` blocks are skipped (breakpoints and prefers-reduced-motion);
 * `@supports` is descended into, matching what Chromium applies. `var(--x)`
 * aliases are resolved to a fixpoint, because that is what the browser reports
 * as the computed value of an alias.
 *
 * Value policy: #hex / rgb() / rgba() → color · rem/px/em → dimension ·
 * bare number → number · anything else (font stacks, `0.375rem 0.375rem 0 0`
 * shorthands, transitions) → string, verbatim. Nothing is normalised: a custom
 * property is substituted rather than computed, so `white` must stay `white`
 * or the name stops binding.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EX = path.join(HERE, '..');
const CSS = path.join(EX, '.bootstrap5-sandbox', 'node_modules', 'bootstrap', 'dist', 'css', 'bootstrap.css');
const SCOPES = [':root, [data-bs-theme=light]', ':root'];

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
  for (const m of body.matchAll(/--bs-([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g)) vars.set(`bs-${m[1]}`, m[2].trim());
}
if (vars.size === 0) throw new Error(`bootstrap5 wrap REFUSED: no --bs-* declarations in ${SCOPES.join(' / ')} of ${CSS}`);

let unresolved = 0;
const resolve = (raw, depth = 0) => {
  if (depth > 12 || !raw.includes('var(')) return raw;
  let changed = false;
  const out = raw.replace(/var\(\s*--([a-zA-Z0-9-]+)\s*(?:,[^)]*)?\)/g, (whole, name) => {
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
  if (/^#[0-9a-fA-F]{3,8}$/.test(raw) || /^rgba?\(/.test(raw) || raw === 'white' || raw === 'black') {
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
writeFileSync(path.join(EX, 'tokens', 'bootstrap5.dtcg.json'), JSON.stringify(base, null, 2) + '\n');
const flat = Object.keys(base).sort().map((k) => `  --${k}: ${base[k].$value};`);
writeFileSync(path.join(EX, 'tokens', 'bootstrap5.vars.css'), `:root {\n${flat.join('\n')}\n}\n`);
console.log(
  `✔ ${vars.size} --bs-* declarations from ${blocks} global block(s) → ` +
    `${colors} color, ${dims} dimension, ${nums} number, ${strings} string` +
    `${unresolved ? ` · ${unresolved} still carry an unresolved var()` : ''} → examples/bootstrap5/tokens/`,
);
console.log(`  spot: bs-primary=${base['bs-primary']?.$value} · bs-body-color=${base['bs-body-color']?.$value} · bs-border-radius=${base['bs-border-radius']?.$value}`);
