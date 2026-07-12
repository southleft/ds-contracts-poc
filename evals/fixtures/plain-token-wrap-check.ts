/**
 * plain-token-wrap eval body — exercises core/wrap-plain-tokens.ts against
 * four fixtures mirroring the SHAPES the enterprise gauntlet found published
 * (extract/pilots/ENTERPRISE-GAUNTLET.md §4 — none of the four systems
 * publishes DTCG; a mechanical $value wrap loads 100%):
 *
 *   carbon-shape   — flat name→scalar map (a serialized @carbon/themes theme)
 *   fluent-shape   — flat map incl. numeric weights + one array (skip case)
 *                    (a serialized @fluentui/tokens webLightTheme)
 *   polaris-shape  — Style-Dictionary `{ value }` maps (polaris-tokens src)
 *   spectrum-shape — @adobe/spectrum-tokens `sets`/`value` shape
 *
 * LICENSE NOTE: the upstream token sets are Apache-2.0 (Carbon, Spectrum)
 * and MIT (Fluent UI, Polaris). These fixtures are SYNTHESIZED minimal
 * equivalents — a handful of representative name/value pairs mirroring each
 * format, not vendored token corpora — so no upstream file is redistributed.
 *
 * Exits non-zero with a named failure on any violated expectation.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { tokenInventoryFromJson } from '../../core/tokens.js';
import { wrapPlainTokensAsDtcg } from '../../core/wrap-plain-tokens.js';

const dir = path.join(process.cwd(), 'extract', 'fixtures', 'tokens-plain');
const load = (name: string) => JSON.parse(readFileSync(path.join(dir, name), 'utf8')) as unknown;
const fail = (msg: string): never => {
  console.error(`✘ plain-token-wrap: ${msg}`);
  process.exit(1);
};

// ---- carbon shape: flat scalars, all wrapped, shape-inferred types --------
const carbon = wrapPlainTokensAsDtcg(load('carbon-shape.tokens.json')) ?? fail('carbon: not offered a wrap');
if (carbon.count !== 9 || carbon.skipped.length !== 0) fail(`carbon: expected 9 wrapped / 0 skipped, got ${carbon.count}/${carbon.skipped.length}`);
const carbonFlat = carbon.tree as Record<string, { $value: unknown; $type?: string }>;
if (carbonFlat['background']?.$type !== 'color' || carbonFlat['background']?.$value !== '#ffffff') fail('carbon: hex not inferred as color / value not verbatim');
if (carbonFlat['spacing-05']?.$type !== 'dimension') fail('carbon: rem not inferred as dimension');
if (carbonFlat['productive-heading-01-font-weight']?.$type !== 'number') fail('carbon: numeric weight not inferred as number');

// ---- fluent shape: array entry is SKIPPED BY NAME, rest wrap --------------
const fluent = wrapPlainTokensAsDtcg(load('fluent-shape.tokens.json')) ?? fail('fluent: not offered a wrap');
if (fluent.count !== 8) fail(`fluent: expected 8 wrapped, got ${fluent.count}`);
if (fluent.skipped.length !== 1 || fluent.skipped[0].path !== 'gradientStops' || !/array/.test(fluent.skipped[0].reason)) {
  fail(`fluent: array entry not named-skipped: ${JSON.stringify(fluent.skipped)}`);
}
const fluentFlat = fluent.tree as Record<string, { $value: unknown; $type?: string }>;
if (fluentFlat['durationFast']?.$type !== 'duration') fail('fluent: ms not inferred as duration');
if (fluentFlat['curveAccelerateMax']?.$type !== undefined) fail('fluent: cubic-bezier must carry NO invented $type');

// ---- polaris shape: { value } maps become tokens; null named-skipped ------
const polaris = wrapPlainTokensAsDtcg(load('polaris-shape.tokens.json')) ?? fail('polaris: not offered a wrap');
if (polaris.count !== 7) fail(`polaris: expected 7 wrapped, got ${polaris.count}`);
const polarisTree = polaris.tree as Record<string, Record<string, { $value: unknown; $type?: string }>>;
if (polarisTree.color?.['bg-surface']?.$value !== 'rgba(255, 255, 255, 1)') fail('polaris: {value} map not wrapped verbatim');
if (polarisTree.color?.['bg-surface']?.$type !== 'color') fail('polaris: rgba() not inferred as color');
if (polarisTree.font?.['size-325']?.$type !== 'fontSize') fail('polaris: explicit `type` not carried as $type');
if (!polaris.skipped.some((s) => s.path.startsWith('motion.keyframes-spin') && /null/.test(s.reason))) {
  fail(`polaris: null value not named-skipped: ${JSON.stringify(polaris.skipped)}`);
}

// ---- spectrum shape: sets/value nodes load; metadata dropped, not guessed -
const spectrum = wrapPlainTokensAsDtcg(load('spectrum-shape.tokens.json')) ?? fail('spectrum: not offered a wrap');
if (spectrum.count !== 7) fail(`spectrum: expected 7 wrapped, got ${spectrum.count}`);
const spectrumInv = tokenInventoryFromJson([spectrum.tree]);
if (!spectrumInv.has('accent-color-100.sets.light') || !spectrumInv.has('focus-indicator-thickness')) {
  fail(`spectrum: expected paths missing from the wrapped inventory: ${[...spectrumInv].join(', ')}`);
}
if ((spectrum.tree as any)['drop-shadow-blur-100']?.$value !== '8px') fail('spectrum: value-keyed leaf with extra metadata not wrapped');

// ---- every wrapped tree round-trips through the DTCG inventory ------------
for (const [name, r] of [['carbon', carbon], ['fluent', fluent], ['polaris', polaris], ['spectrum', spectrum]] as const) {
  const inv = tokenInventoryFromJson([r.tree]);
  if (inv.size !== r.count) fail(`${name}: wrapped count ${r.count} ≠ DTCG inventory size ${inv.size}`);
}

// ---- refusals: already-DTCG and non-plain inputs are NOT offered a wrap ---
if (wrapPlainTokensAsDtcg({ color: { $value: '#fff' } }) !== null) fail('already-DTCG input must return null (nothing to wrap)');
if (wrapPlainTokensAsDtcg([1, 2, 3]) !== null) fail('array input must return null');
if (wrapPlainTokensAsDtcg('nope') !== null) fail('string input must return null');
if (wrapPlainTokensAsDtcg({ a: { b: [1] } }) !== null) fail('zero-wrappable input must return null');

console.log('✔ plain-token-wrap: all shapes load, all refusals named');
