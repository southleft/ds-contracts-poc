/**
 * Polaris published tokens → DTCG, via the repo's mechanical wrap helper.
 *
 *   npx tsx examples/polaris/scripts/build-tokens.ts
 *
 * Reads the DEFAULT (light) theme from the Polaris clone pinned at the
 * gauntlet SHA (examples/polaris/.polaris-clone — see the README for the
 * clone command), flattens the theme's token groups to the same flat
 * `<token-name> → value` map Polaris itself turns into `--p-<token-name>`
 * custom properties, roots the map under `p` (so the DTCG path
 * `p.space-100` hyphen-joins to the CSS var name `p-space-100`, exactly
 * matching Polaris's own `var(--p-space-100)` references), and wraps it
 * with core/wrap-plain-tokens.ts — the BYO-token on-ramp, values VERBATIM,
 * nothing invented. Skipped entries (non-scalar values) are written by name
 * into tokens/polaris-light.dtcg.skips.json.
 *
 * Output is deterministic: keys sorted, stable JSON.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { wrapPlainTokensAsDtcg } from '../../../core/wrap-plain-tokens.js';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const EXAMPLE = path.dirname(HERE);

// The clone's BASE theme (TypeScript, relative imports only — tsx runs it).
// The default ("light") theme is createMetaTheme(metaThemeLightPartial) and
// the light partial is EMPTY at this SHA (themes/light.ts), so the default
// theme's token values ARE metaThemeBase — importing the base directly also
// avoids the clone's deepmerge dependency (not installed here).
const { metaThemeBase: metaThemeDefault } = await import(
  path.join(EXAMPLE, '.polaris-clone', 'polaris-tokens', 'src', 'themes', 'base', 'index.ts')
);

// metaThemeDefault: { border: { 'border-radius-100': {value}, … }, color: …}
// Token names already carry their group prefix — flatten groups away, keep
// the full token name, exactly what `--p-<name>` is minted from upstream.
const flat: Record<string, unknown> = {};
for (const group of Object.keys(metaThemeDefault as Record<string, unknown>).sort()) {
  const entries = (metaThemeDefault as Record<string, Record<string, unknown>>)[group];
  for (const name of Object.keys(entries).sort()) {
    if (name in flat) throw new Error(`duplicate token name across groups: ${name}`);
    flat[name] = entries[name];
  }
}

const wrapped = wrapPlainTokensAsDtcg({ p: flat });
if (!wrapped) throw new Error('Polaris theme did not wrap — shape changed upstream?');

// Polaris expresses token→token aliases as CSS var() references
// (`space-card-gap: var(--p-space-400)`). DTCG spells the same fact as a
// brace alias — the mapping is 1:1 mechanical (`var(--p-X)` → `{p.X}`),
// and the target must exist in the same set or the wrap refuses.
let aliasCount = 0;
const pTree = wrapped.tree.p as Record<string, { $value: unknown; $type?: string }>;
for (const [name, leaf] of Object.entries(pTree)) {
  const m = String(leaf.$value).match(/^var\(--p-([A-Za-z0-9-]+)\)$/);
  if (!m) continue;
  if (!(m[1] in pTree)) throw new Error(`alias target missing: ${name} → ${m[1]}`);
  leaf.$value = `{p.${m[1]}}`;
  delete leaf.$type; // an alias inherits its target's type
  aliasCount++;
}
console.log(`  ${aliasCount} var(--p-*) reference(s) rewritten as DTCG aliases (1:1 mechanical)`);

const sortDeep = (node: unknown): unknown => {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return node;
  return Object.fromEntries(
    Object.entries(node as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => [k, sortDeep(v)]),
  );
};

writeFileSync(
  path.join(EXAMPLE, 'tokens', 'polaris-light.dtcg.json'),
  JSON.stringify(sortDeep(wrapped.tree), null, 2) + '\n',
);
writeFileSync(
  path.join(EXAMPLE, 'tokens', 'polaris-light.dtcg.skips.json'),
  JSON.stringify(wrapped.skipped, null, 2) + '\n',
);
console.log(`✔ ${wrapped.count} tokens wrapped → tokens/polaris-light.dtcg.json`);
console.log(`  ${wrapped.skipped.length} entries skipped by name → tokens/polaris-light.dtcg.skips.json`);
