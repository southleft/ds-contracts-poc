/**
 * Tailwind token wrap — `node examples/tailwind/scripts/build-tokens.mjs`
 *
 * Parses the THEME VARIABLES Tailwind v4 emitted into the sandbox-built
 * stylesheet (`.tw-sandbox/tailwind.css` — generated deterministically by
 * `npx @tailwindcss/cli` over the pinned flowbite-react dist; see
 * PROVENANCE.md) and commits the mechanical DTCG wrap. Tailwind v4 is
 * CSS-first: the theme IS a set of custom properties (`--color-cyan-700`,
 * `--radius-lg`, `--text-sm`), and every utility references them with
 * var() — which is exactly the seam the CSS-vars reader binds against, so
 * the DTCG names here are the var names verbatim minus the `--` prefix.
 *
 * Value policy (deterministic):
 *   oklch(...)      → converted to hex via the shared OKLab math (Chromium
 *                     keeps oklch in computed values; hex here keeps every
 *                     downstream consumer — genesis converters, valueEq —
 *                     in one space). Original oklch kept in $extensions.
 *   #hex / rgb()    → verbatim, type color
 *   rem/px          → verbatim, type dimension (genesis converts rem×16)
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
const css = readFileSync(path.join(EX, '.tw-sandbox', 'tailwind.css'), 'utf8');

// the :root/:host theme block(s) — every `--name: value;` declaration
const vars = new Map();
const rootBlocks = css.match(/:root[^{]*\{[^}]*\}/g) ?? [];
for (const block of rootBlocks) {
  for (const m of block.matchAll(/--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g)) {
    vars.set(m[1], m[2].trim());
  }
}
if (vars.size === 0) throw new Error('tailwind wrap REFUSED: no :root theme variables found in tailwind.css');

const hex2 = (x) => x.toString(16).padStart(2, '0');
const base = {};
let colors = 0, dims = 0, nums = 0, strings = 0, oklchConverted = 0;
for (const [name, raw] of [...vars.entries()].sort()) {
  const ok = oklchToRgba(raw);
  if (ok) {
    const hex = `#${hex2(ok.r)}${hex2(ok.g)}${hex2(ok.b)}${ok.a < 1 ? hex2(Math.round(ok.a * 255)) : ''}`;
    base[name] = { $type: 'color', $value: hex, $extensions: { 'dev.ds-contracts.source': { oklch: raw } } };
    colors++; oklchConverted++;
    continue;
  }
  if (/^#[0-9a-fA-F]{3,8}$/.test(raw) || /^rgba?\(/.test(raw) || raw === 'white' || raw === 'black') {
    base[name] = { $type: 'color', $value: raw === 'white' ? '#ffffff' : raw === 'black' ? '#000000' : raw };
    colors++;
    continue;
  }
  if (/^-?[\d.]+(rem|px|em)$/.test(raw)) { base[name] = { $type: 'dimension', $value: raw }; dims++; continue; }
  if (/^-?[\d.]+$/.test(raw)) { base[name] = { $type: 'number', $value: raw }; nums++; continue; }
  base[name] = { $type: 'string', $value: raw }; strings++;
}

mkdirSync(path.join(EX, 'tokens'), { recursive: true });
writeFileSync(path.join(EX, 'tokens', 'tailwind.dtcg.json'), JSON.stringify(base, null, 2) + '\n');
const flat = Object.keys(base).sort().map((k) => `  --${k}: ${base[k].$value};`);
writeFileSync(path.join(EX, 'tokens', 'tailwind.vars.css'), `:root {\n${flat.join('\n')}\n}\n`);
console.log(`✔ ${vars.size} theme variables wrapped (${colors} color [${oklchConverted} oklch→hex], ${dims} dimension, ${nums} number, ${strings} string) → examples/tailwind/tokens/`);
console.log(`  spot: color-cyan-700=${base['color-cyan-700']?.$value} · radius-lg=${base['radius-lg']?.$value} · text-sm=${base['text-sm']?.$value}`);
