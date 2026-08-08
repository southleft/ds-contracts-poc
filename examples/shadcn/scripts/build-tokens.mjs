/**
 * shadcn token wrap — `npx tsx examples/shadcn/scripts/build-tokens.mjs`
 * (tsx, not bare node: the oklch math is shared from extract/computed/lib.ts.)
 *
 * Parses the theme variables Tailwind v4 emitted into the sandbox-built
 * stylesheet (`.shadcn-sandbox/tailwind.css` — generated deterministically by
 * `npx @tailwindcss/cli -i capture-input.css -o tailwind.css`; RECON §1
 * recreate block) and commits the mechanical DTCG wrap. shadcn's `@theme
 * inline` makes every utility reference the SEMANTIC variable directly
 * (`.bg-primary { background-color: var(--primary) }`), so the DTCG names
 * here are shadcn's own semantic vocabulary verbatim minus the `--` prefix —
 * exactly the seam the CSS-vars reader binds against (RECON §4.1).
 *
 * Emits (per RECON §4.2's token recipe):
 *   tokens/shadcn.dtcg.json             base = every `:root`-scoped var, light values
 *   tokens/shadcn.vars.css              the same inventory as flat custom properties
 *   tokens/modes/shadcn.light.dtcg.json COMPLETE inventory (the Carbon mode-gap lesson)
 *   tokens/modes/shadcn.dark.dtcg.json  COMPLETE inventory, `.dark` block overrides applied
 *
 * Value policy (deterministic, same as the tailwind round):
 *   oklch(...)      → hex via the shared OKLab math; original kept in $extensions
 *   #hex / rgb()    → verbatim, type color
 *   rem/px          → verbatim, type dimension
 *   bare number     → type number
 *   calc()/other    → verbatim STRING (named; the reader's calc exclusion
 *                     means these never bind anyway)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { oklchToRgba } from '../../../extract/computed/lib.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EX = path.join(HERE, '..');
const css = readFileSync(path.join(EX, '.shadcn-sandbox', 'tailwind.css'), 'utf8');

/** Every `--name: value;` declaration inside blocks whose selector matches `re`. */
function declsOf(re) {
  const out = new Map();
  for (const block of css.match(re) ?? []) {
    for (const m of block.matchAll(/--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g)) {
      out.set(m[1], m[2].trim().replace(/\s+/g, ' '));
    }
  }
  return out;
}

// `:root`-scoped blocks: the Tailwind theme block (`:root, :host`), the shadcn
// semantic block (`:root`), and the @supports shimmer block — every variable a
// bare page resolves at the documentElement (the RECON §4.1 bind proof scope).
const rootVars = declsOf(/:root[^{]*\{[^}]*\}/g);
if (rootVars.size === 0) throw new Error('shadcn wrap REFUSED: no :root theme variables found in tailwind.css');
// the `.dark` class-scope block (RECON H5: a MODE at bundle time, never a
// second capture — one mode is the floor's contract).
const darkVars = declsOf(/\.dark\s*\{[^}]*\}/g);
if (darkVars.size === 0) throw new Error('shadcn wrap REFUSED: no .dark block found in tailwind.css');
for (const name of darkVars.keys()) {
  if (!rootVars.has(name)) throw new Error(`shadcn wrap REFUSED: .dark declares --${name} which :root does not — the mode pair would be ragged`);
}

const hex2 = (x) => x.toString(16).padStart(2, '0');
function typed(raw, counts) {
  const ok = oklchToRgba(raw);
  if (ok) {
    const hex = `#${hex2(ok.r)}${hex2(ok.g)}${hex2(ok.b)}${ok.a < 1 ? hex2(Math.round(ok.a * 255)) : ''}`;
    counts.color++; counts.oklch++;
    return { $type: 'color', $value: hex, $extensions: { 'dev.ds-contracts.source': { oklch: raw } } };
  }
  if (/^#[0-9a-fA-F]{3,8}$/.test(raw) || /^rgba?\(/.test(raw) || raw === 'white' || raw === 'black') {
    counts.color++;
    return { $type: 'color', $value: raw === 'white' ? '#ffffff' : raw === 'black' ? '#000000' : raw };
  }
  if (/^-?[\d.]+(rem|px|em)$/.test(raw)) { counts.dimension++; return { $type: 'dimension', $value: raw }; }
  if (/^-?[\d.]+$/.test(raw)) { counts.number++; return { $type: 'number', $value: raw }; }
  counts.string++;
  return { $type: 'string', $value: raw };
}

function wrap(vars) {
  const counts = { color: 0, dimension: 0, number: 0, string: 0, oklch: 0 };
  const out = {};
  for (const [name, raw] of [...vars.entries()].sort()) out[name] = typed(raw, counts);
  return { out, counts };
}

const base = wrap(rootVars);
const darkFull = new Map(rootVars);
for (const [name, raw] of darkVars) darkFull.set(name, raw);
const light = wrap(rootVars);
const dark = wrap(darkFull);

mkdirSync(path.join(EX, 'tokens', 'modes'), { recursive: true });
writeFileSync(path.join(EX, 'tokens', 'shadcn.dtcg.json'), JSON.stringify(base.out, null, 2) + '\n');
writeFileSync(path.join(EX, 'tokens', 'modes', 'shadcn.light.dtcg.json'), JSON.stringify(light.out, null, 2) + '\n');
writeFileSync(path.join(EX, 'tokens', 'modes', 'shadcn.dark.dtcg.json'), JSON.stringify(dark.out, null, 2) + '\n');
const flat = Object.keys(base.out).sort().map((k) => `  --${k}: ${base.out[k].$value};`);
writeFileSync(path.join(EX, 'tokens', 'shadcn.vars.css'), `:root {\n${flat.join('\n')}\n}\n`);

console.log(
  `✔ ${rootVars.size} :root variables wrapped (${base.counts.color} color [${base.counts.oklch} oklch→hex], ` +
    `${base.counts.dimension} dimension, ${base.counts.number} number, ${base.counts.string} string) → examples/shadcn/tokens/`,
);
console.log(`  modes: light=${Object.keys(light.out).length} dark=${Object.keys(dark.out).length} (${darkVars.size} .dark overrides)`);
console.log(`  spot: primary=${base.out['primary']?.$value} · destructive=${base.out['destructive']?.$value} · radius=${base.out['radius']?.$value} · text-sm=${base.out['text-sm']?.$value}`);
