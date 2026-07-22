/**
 * Astryx token wrap — `npx tsx examples/astryx/scripts/build-tokens.ts`
 *
 * Reads the PINNED package's `theme/tokens.stylex.ts` (the npm-shipped
 * source, sandbox install — see PROVENANCE.md) through the StyleX reader
 * (core/stylex-tokens.ts: defineVars tables, light-dark() mode splitting)
 * and commits the mechanical DTCG wrap:
 *
 *   tokens/astryx.dtcg.json             base tree (light branch), verbatim values
 *   tokens/modes/astryx.light.dtcg.json mode trees — only the light-dark()
 *   tokens/modes/astryx.dark.dtcg.json  (mode-varying) entries
 *   tokens/TOKENS.md                    the wrap receipt: counts, named skips,
 *                                       the 3 spot-check mode resolutions
 *
 * The script REFUSES to write when the corpus does not load or a spot check
 * fails — a committed token set that the pipeline cannot resolve would be
 * plausible, valid-looking, and wrong.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { stylexTokensFromSource } from '../../../core/stylex-tokens.js';
import { tokenCorpusFromJson } from '../../../core/token-corpus.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const EX = path.join(HERE, '..');
const SRC = path.join(EX, '.astryx-sandbox/node_modules/@astryxdesign/core/src/theme/tokens.stylex.ts');

const layer = stylexTokensFromSource(readFileSync(SRC, 'utf8'), 'tokens.stylex.ts');

// ---- corpus load (both modes) — the wrap is only real if it RESOLVES ----
const corpusFor = (tree: Record<string, unknown>) =>
  tokenCorpusFromJson({ primitives: {}, semantic: layer.tree, light: tree, brandDefault: {} });
const lightCorpus = corpusFor(layer.modes?.light.tree ?? {});
const darkCorpus = corpusFor(layer.modes?.dark.tree ?? {});

// ---- spot checks: 3 tokens whose light/dark branches must differ and
// resolve per mode (values from the pinned 0.1.6 publication) ----
const SPOT: Array<{ path: string; light: string; dark: string }> = [
  { path: 'color-accent', light: '#0064E0', dark: '#2694FE' },
  { path: 'color-background-surface', light: '#FFFFFF', dark: '#1F1F22' },
  { path: 'color-text-primary', light: '#0A1317', dark: '#DFE2E5' },
];
const failures: string[] = [];
for (const s of SPOT) {
  const entry = layer.entries.find((e) => e.path === s.path);
  if (!entry?.modes) {
    failures.push(`${s.path}: not read as a light-dark() token`);
    continue;
  }
  if (entry.modes.light !== s.light || entry.modes.dark !== s.dark) {
    failures.push(`${s.path}: expected ${s.light}/${s.dark}, read ${entry.modes.light}/${entry.modes.dark}`);
  }
  // Per-mode resolution through the corpus (light layer wins over base).
  if (lightCorpus.resolveLiteral(s.path) !== s.light) failures.push(`${s.path}: light corpus resolves ${String(lightCorpus.resolveLiteral(s.path))}`);
  if (darkCorpus.resolveLiteral(s.path) !== s.dark) failures.push(`${s.path}: dark corpus resolves ${String(darkCorpus.resolveLiteral(s.path))}`);
}
if (failures.length > 0) {
  console.error('✘ astryx token wrap REFUSED:\n' + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}

// ---- DTCG alias pass (Phase B, 2026-07-22): the StyleX source spells
// intra-tree references as `var(--x)` strings; DTCG's spelling for the same
// fact is the alias `{x}`. A literal var() string is opaque to every DTCG
// consumer (the figma emitter refused `{text-body-size}` → 'var(--font-
// size-base)' by name — that refusal is why this pass exists). Mechanical:
// only var() values whose target EXISTS as a tree leaf convert; anything
// else stays verbatim and is receipted. ----
const leafPaths = new Set(layer.entries.map((e) => e.path));
const unaliased: string[] = [];
const aliasPass = (node: Record<string, unknown>) => {
  for (const value of Object.values(node)) {
    if (!value || typeof value !== 'object') continue;
    const v = value as Record<string, unknown>;
    if (typeof v.$value === 'string') {
      const m = (v.$value as string).match(/^var\(--([a-z0-9-]+)\)$/i);
      if (m) {
        if (leafPaths.has(m[1])) v.$value = `{${m[1]}}`;
        else unaliased.push(`${v.$value} — target not a tree leaf, kept verbatim`);
      }
    } else if (!('$value' in v)) {
      aliasPass(v);
    }
  }
};
aliasPass(layer.tree as unknown as Record<string, unknown>);
if (layer.modes) {
  aliasPass(layer.modes.light.tree as unknown as Record<string, unknown>);
  aliasPass(layer.modes.dark.tree as unknown as Record<string, unknown>);
}
if (unaliased.length > 0) {
  console.log(`  var() values NOT aliased (target missing):\n${[...new Set(unaliased)].map((u) => `    - ${u}`).join('\n')}`);
}

// ---- write ----
mkdirSync(path.join(EX, 'tokens/modes'), { recursive: true });
const write = (rel: string, data: unknown) =>
  writeFileSync(path.join(EX, rel), JSON.stringify(data, null, 2) + '\n');
write('tokens/astryx.dtcg.json', layer.tree);
if (layer.modes) {
  write('tokens/modes/astryx.light.dtcg.json', layer.modes.light.tree);
  write('tokens/modes/astryx.dark.dtcg.json', layer.modes.dark.tree);
}

const varying = layer.entries.filter((e) => e.modes).length;
const groups = [...new Set(layer.entries.map((e) => e.group))];
const receipt = `# Astryx tokens — wrap receipt

Mechanical wrap of \`@astryxdesign/core@0.1.6\` \`src/theme/tokens.stylex.ts\`
(the npm-shipped source) through \`core/stylex-tokens.ts\` — values VERBATIM,
\`light-dark()\` split into light/dark mode trees. Regenerate:
\`npx tsx examples/astryx/scripts/build-tokens.ts\` (refuses on any drift from
the numbers below).

- **${layer.count} tokens wrapped** from ${groups.length} defineVars tables (${groups.join(', ')})
- **${varying} mode-varying** (\`light-dark()\`) entries → \`tokens/modes/astryx.{light,dark}.dtcg.json\`; ${layer.count - varying} mode-invariant entries live in the base tree only
- **${layer.skipped.length} skipped**${layer.skipped.length > 0 ? ':' : ' — nothing was dropped.'}
${layer.skipped.map((s) => `  - \`${s.name}\` — ${s.reason}`).join('\n')}

## Mode spot checks (corpus-resolved, both modes)

| token | light | dark |
|---|---|---|
${SPOT.map((s) => `| \`${s.path}\` | \`${s.light}\` | \`${s.dark}\` |`).join('\n')}

Corpus note: \`TokenCorpusInput\` still hard-codes the repo 4-tree layout
(gauntlet named-limit #1) — the wrap loads with the base tree shoehorned into
\`semantic\` and each mode tree into \`light\`, which is how the spot checks
above resolve. Freeing the input shape stays a named limit, not this wrap's.
`;
writeFileSync(path.join(EX, 'tokens/TOKENS.md'), receipt);

console.log(
  `✔ ${layer.count} tokens wrapped (${varying} light-dark mode-varying, ${layer.skipped.length} named skips) → examples/astryx/tokens/\n` +
    `✔ corpus loads; ${SPOT.length}/3 mode spot checks resolve per mode`,
);
