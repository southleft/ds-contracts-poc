/**
 * stylex-token-wrap eval body — exercises core/stylex-tokens.ts against a
 * SYNTHESIZED minimal `.stylex.ts` source mirroring the published shape
 * (Astryx `theme/tokens.stylex.ts`: exported `*Defaults` object literals fed
 * to `stylex.defineVars`, values using CSS `light-dark()`). No vendored
 * source — the foreign-sibling fixture rule.
 *
 * Pins:
 *   · defineVars read via identifier AND inline literal
 *   · light-dark() splits into light/dark modes, paren-aware (rgba commas)
 *   · base tree carries the light branch; mode trees carry ONLY varying entries
 *   · $type inferred from value shape; conflicting branch types → no $type
 *   · non-scalar values, duplicates, expression values → NAMED skips
 *
 * Exits non-zero with a named failure on any violated expectation.
 */
import { splitLightDark, stylexTokensFromSource } from '../../core/stylex-tokens.js';

const fail = (msg: string): never => {
  console.error(`✘ stylex-token-wrap: ${msg}`);
  process.exit(1);
};

const SRC = `
import * as stylex from '@stylexjs/stylex';

export const paintDefaults = {
  '--paint-accent': 'light-dark(#0A64E0, #2694FE)',
  '--paint-muted': 'light-dark(rgba(5, 54, 89, 0.1), rgba(223, 226, 229, 0.2))',
  '--paint-static': '#FFFFFF',
  '--paint-shape-shift': 'light-dark(#123456, 4px)',
  '--paint-computed': someImportedValue,
};
export const paintVars = stylex.defineVars(paintDefaults);

export const gapVars = stylex.defineVars({
  '--gap-1': '4px',
  '--gap-2': '8px',
  '--gap-count': 3,
  '--gap-1': '5px',
});
`;

const layer = stylexTokensFromSource(SRC, 'fixture.stylex.ts');

// 4 paint (accent, muted, static, shape-shift) + 3 gap (gap-1, gap-2, gap-count)
if (layer.count !== 7) fail(`expected 7 wrapped tokens, got ${layer.count} (${layer.entries.map((e) => e.path).join(', ')})`);

const accent = layer.entries.find((e) => e.path === 'paint-accent');
if (accent?.modes?.light !== '#0A64E0' || accent.modes.dark !== '#2694FE' || accent.type !== 'color') {
  fail(`paint-accent not split into modes with $type color: ${JSON.stringify(accent)}`);
}
if (accent.value !== '#0A64E0') fail('base tree must carry the LIGHT branch');

const muted = layer.entries.find((e) => e.path === 'paint-muted');
if (muted?.modes?.light !== 'rgba(5, 54, 89, 0.1)' || muted.modes.dark !== 'rgba(223, 226, 229, 0.2)') {
  fail(`nested rgba commas broke the light-dark split: ${JSON.stringify(muted?.modes)}`);
}

const shapeShift = layer.entries.find((e) => e.path === 'paint-shape-shift');
if (!shapeShift?.modes || shapeShift.type !== undefined) {
  fail(`conflicting branch shapes must split but invent NO $type: ${JSON.stringify(shapeShift)}`);
}

const stat = layer.entries.find((e) => e.path === 'paint-static');
if (!stat || stat.modes) fail('mode-invariant value must not grow modes');
if (layer.modes?.light.count !== 3 || layer.modes?.dark.count !== 3) {
  fail(`mode trees must carry ONLY the 3 varying entries, got ${layer.modes?.light.count}/${layer.modes?.dark.count}`);
}
if ((layer.modes.light.tree as Record<string, unknown>)['paint-static'] !== undefined) {
  fail('invariant entry leaked into a mode tree');
}

const inline = layer.entries.find((e) => e.path === 'gap-1');
if (inline?.value !== '4px' || inline.type !== 'dimension') fail('inline defineVars literal not read');
if (layer.entries.find((e) => e.path === 'gap-count')?.type !== 'number') fail('numeric value not typed number');

const skipNames = layer.skipped.map((s) => s.name);
if (!skipNames.includes('--paint-computed')) fail(`expression value not skipped BY NAME: ${JSON.stringify(layer.skipped)}`);
const dup = layer.skipped.find((s) => s.name === '--gap-1');
if (!dup || !dup.reason.includes('duplicate')) fail('duplicate key not skipped by name with a duplicate reason');

// splitLightDark refusals: partial embeddings must NOT split
if (splitLightDark('0 1px light-dark(#000, #fff)') !== null) fail('embedded light-dark() must not split');
if (splitLightDark('light-dark(#000)') !== null) fail('single-argument light-dark() must not split');

console.log('stylex-token-wrap ok: 7 wrapped (3 light-dark-varying, paren-aware), 2 named skips, base=light, mode trees varying-only');
