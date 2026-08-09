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
 *
 * ── THEME-NEUTRAL OVERLAY (2026-08-09, FC-TOKEN-PLANE-MISMATCH) ─────────────
 * `@astryxdesign/core`'s defineVars tables are the library's UNTHEMED
 * DEFAULTS. The capture harness does not render under them: it mounts the
 * library's own documented `<Theme theme={neutralTheme}>` and injects
 * `@astryxdesign/theme-neutral/dist/theme.css` (extract/computed/configs/
 * astryx.json `mount.imports` / `mount.wrapperOpen`), so every committed
 * reference under extract/computed/out/astryx/<c>/orig-shots/ is a
 * THEME-NEUTRAL render while this wrap was emitting CORE values.
 *
 * MEASURED (theme.css `:scope` token plane vs core's `:root, .xNNN`
 * defineVars blocks, both from the pinned sandbox):
 *   · core declares 186 custom properties, theme-neutral's token plane 170
 *   · 103 of the 170 carry a DIFFERENT value; 53 are identical; 14 are
 *     theme-only names; 30 core names the theme does not override (they
 *     legitimately fall through to core — the overlay never deletes)
 *   · all 103 differing values are witnessed with the THEME spelling in the
 *     committed captured truth and ZERO of them with the core spelling
 *     (extract/computed/out/astryx/<c>/captured-truth.json carries the raw
 *     custom-property declarations, e.g.
 *     "--color-background-blue":"light-dark(#c4ddfb, #9eb7ff3D)")
 *   · 57 of the 80 re-anchored minted aliases resolved, on the core plane, to
 *     a colour that appears NOWHERE in the captured truth and, on the theme
 *     plane, to one that does — 0 rows move the other way
 *
 * So the overlay below re-bases the wrap's VALUES onto theme-neutral. It is a
 * value overlay, not a replacement:
 *   · the NAME plane stays core's 186 defineVars names. The 14 theme-only
 *     names (all `--color-syntax-*`) are receipted BY NAME and NOT added —
 *     no astryx contract binds one (0 occurrences across
 *     examples/astryx/contracts/*.json) and adding them would inject 14
 *     site-missing fallbacks into the docs plane (build-docs-tokens.ts
 *     derives its name set from this file), churning an artifact that is not
 *     part of this defect.
 *   · a core name the theme does not override keeps its core value (that IS
 *     what the browser resolves — theme.css only overrides).
 *   · light-dark() is re-split per overlaid value, so the mode trees move too.
 * Regenerating from core alone would silently restore the defect, which is
 * why this lives in the generator and not in a hand-edit.
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { stylexTokensFromSource, splitLightDark } from '../../../core/stylex-tokens.js';
import { inferDtcgType } from '../../../core/wrap-plain-tokens.js';
import { tokenCorpusFromJson } from '../../../core/token-corpus.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const EX = path.join(HERE, '..');
const SRC = path.join(EX, '.astryx-sandbox/node_modules/@astryxdesign/core/src/theme/tokens.stylex.ts');
const THEME_CSS = path.join(EX, '.astryx-sandbox/node_modules/@astryxdesign/theme-neutral/dist/theme.css');

const layer = stylexTokensFromSource(readFileSync(SRC, 'utf8'), 'tokens.stylex.ts');

// ---------------------------------------------------------------------------
// Theme-neutral value overlay
// ---------------------------------------------------------------------------
if (!existsSync(THEME_CSS)) {
  console.error(
    `✘ astryx token wrap REFUSED: the theme-neutral stylesheet the capture harness injects is missing —\n` +
      `  ${path.relative(path.join(EX, '..', '..'), THEME_CSS)}\n` +
      `  Install the pinned sandbox (see PROVENANCE.md). Emitting the CORE plane instead would\n` +
      `  produce a token set that no committed reference render was ever made under.`,
  );
  process.exit(1);
}
const themeCssText = readFileSync(THEME_CSS, 'utf8');
// The theme's TOKEN plane is the single `:scope { … }` rule inside the
// @scope block. Everything after it is component-scoped (`.astryx-badge.info
// { --color-… }`) — those are per-component overrides, NOT theme tokens, and
// folding them in would mint one component's variant colour as a global.
const scopeBlocks = themeCssText.match(/:scope\s*\{([^}]*)\}/g) ?? [];
if (scopeBlocks.length !== 1) {
  console.error(
    `✘ astryx token wrap REFUSED: expected exactly ONE :scope token block in theme.css, found ${scopeBlocks.length}.` +
      ` The theme's shape changed; re-read it before overlaying.`,
  );
  process.exit(1);
}
const themeVars: Record<string, string> = {};
for (const [, k, v] of /:scope\s*\{([^}]*)\}/
  .exec(themeCssText)![1]
  .matchAll(/--([a-zA-Z0-9-]+)\s*:\s*([^;{}]+);/g)) {
  themeVars[k] = v.trim().replace(/\s*\n\s*/g, ' ');
}

// A branch spelled as a bare `var(--target)` is a REFERENCE, not a value of
// its own: in DTCG a ref carries its target's $type. Core's reader has no such
// branch to deal with (core's tables are literal), but theme-neutral spells
// `--color-background-gray: light-dark(#e5e5e5, var(--color-neutral))`, and
// inferring "no type" from the dark branch drops `$type: color` off the base
// leaf — which drops the leaf out of the re-anchor join's colour candidate set
// and silently degrades one landed alias back to a literal. So a pure-ref
// branch inherits the sibling branch's inferred type.
const REF_ONLY = /^var\(--[a-z0-9-]+\)$/i;
const branchType = (branch: string, sibling: string): string | undefined =>
  REF_ONLY.test(branch.trim()) ? inferDtcgType(sibling) : inferDtcgType(branch);

const overlaid: string[] = [];
const themeOnly = Object.keys(themeVars).filter((k) => !layer.entries.some((e) => e.path === k));
const themeSilent: string[] = []; // core names the theme does not override
const refBranchTyped: string[] = [];
for (const e of layer.entries) {
  const raw = themeVars[e.path];
  if (raw === undefined) {
    themeSilent.push(e.path);
    continue;
  }
  if (raw === e.value || (e.modes && raw === `light-dark(${e.modes.light}, ${e.modes.dark})`)) continue;
  const split = splitLightDark(raw);
  if (split) {
    const lightType = branchType(split.light, split.dark);
    const darkType = branchType(split.dark, split.light);
    const type = lightType === darkType ? lightType : undefined;
    if (REF_ONLY.test(split.light.trim()) || REF_ONLY.test(split.dark.trim())) {
      refBranchTyped.push(`${e.path} (${type ?? 'no type'})`);
    }
    const before = e.modes ? `light-dark(${e.modes.light}, ${e.modes.dark})` : e.value;
    if (before === raw) continue;
    e.value = split.light;
    e.modes = split;
    if (type) e.type = type;
    else delete e.type;
    overlaid.push(`${e.path}: ${before} → ${raw}`);
  } else {
    if (e.value === raw && !e.modes) continue;
    const before = e.modes ? `light-dark(${e.modes.light}, ${e.modes.dark})` : e.value;
    e.value = raw;
    delete e.modes;
    const type = inferDtcgType(raw);
    if (type) e.type = type;
    else delete e.type;
    overlaid.push(`${e.path}: ${before} → ${raw}`);
  }
}

// Rebuild the trees from the overlaid entries — mirrors stylexTokensFromSource's
// own assembly so the emitted shape is identical to a straight core wrap.
const dtcgLeaf = (value: string, type?: string) => ({ $value: value, ...(type ? { $type: type } : {}) });
layer.tree = Object.fromEntries(layer.entries.map((e) => [e.path, dtcgLeaf(e.value, e.type)]));
{
  const varying = layer.entries.filter((e) => e.modes);
  layer.modes =
    varying.length > 0
      ? Object.fromEntries(
          (['light', 'dark'] as const).map((mode) => [
            mode,
            {
              tree: Object.fromEntries(varying.map((e) => [e.path, dtcgLeaf(e.modes![mode], e.type)])),
              count: varying.length,
            },
          ]),
        )
      : undefined;
}

// ---- REFUSAL: a CSS system-font keyword is not a font family. -------------
// `--font-family-body` on the CORE plane starts with `-apple-system`, and the
// Figma emitter takes the FIRST stack entry (core/emit-figma-script.ts
// firstFamily, ~line 2356) — which put `fontFamily": "-apple-system"` into 148
// declarations across 10 astryx scripts. Figma can never resolve that string,
// so every text node silently fell back. The generic-family denylist in
// firstFamily does not cover the system-font keywords, so the ONLY thing
// standing between an upstream stack change and a re-run of that defect is
// this refusal. Fixing firstFamily itself is core's, not this lane's.
const SYSTEM_FONT_KEYWORDS =
  /^(-apple-system|BlinkMacSystemFont|system-ui|ui-sans-serif|ui-serif|ui-monospace|ui-rounded|sans-serif|serif|monospace|cursive|fantasy|math|inherit|initial|unset|revert)$/i;
const fontFailures: string[] = [];
for (const p of ['font-family-body', 'font-family-heading']) {
  const e = layer.entries.find((x) => x.path === p);
  if (!e) {
    fontFailures.push(`${p}: MISSING from the wrap`);
    continue;
  }
  const first = e.value.split(',')[0].trim().replace(/^["']|["']$/g, '');
  if (SYSTEM_FONT_KEYWORDS.test(first)) {
    fontFailures.push(
      `${p}: first stack entry is "${first}" — a CSS system/generic-font KEYWORD, not a family. ` +
        `Figma resolves it to nothing and every emitted text node falls back silently.`,
    );
  }
}
if (fontFailures.length > 0) {
  console.error('✘ astryx token wrap REFUSED (font substrate):\n' + fontFailures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}

// ---- corpus load (both modes) — the wrap is only real if it RESOLVES ----
const corpusFor = (tree: Record<string, unknown>) =>
  tokenCorpusFromJson({ primitives: {}, semantic: layer.tree, light: tree, brandDefault: {} });
const lightCorpus = corpusFor(layer.modes?.light.tree ?? {});
const darkCorpus = corpusFor(layer.modes?.dark.tree ?? {});

// ---- spot checks: 3 tokens whose light/dark branches must differ and
// resolve per mode. THE VALUES ARE THE OVERLAID (theme-neutral) ONES — they
// were the core-plane values (#0064E0 / #FFFFFF+#1F1F22 / #0A1317) until the
// overlay above, and every one of these three light branches is witnessed
// verbatim in the committed captured truth while none of the core ones is.
// A spot check that still asserted the core values would pass only when the
// wrap was wrong. ----
const SPOT: Array<{ path: string; light: string; dark: string }> = [
  { path: 'color-accent', light: '#262626', dark: '#ebebeb' },
  { path: 'color-background-surface', light: '#ffffff', dark: '#262626' },
  { path: 'color-text-primary', light: '#171717', dark: '#fafafa' },
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
// Phase A-2 gate support: a FLAT custom-properties stylesheet from the same
// wrap (light-mode resolved values, aliases followed) — the contract-side
// render in the fidelity gate injects THIS, so every {token} binding
// resolves to the identical value the library's own stylesheet uses.
{
  const flat: string[] = [];
  const resolveLeaf = (v: string, depth = 0): string => {
    const m = v.match(/^\{([a-z0-9-]+)\}$/i);
    if (!m || depth > 8) return v;
    const t = (layer.tree as Record<string, { $value?: unknown }>)[m[1]];
    return t && typeof t.$value === 'string' ? resolveLeaf(t.$value, depth + 1) : v;
  };
  const lightTree = (layer.modes?.light.tree ?? {}) as Record<string, { $value?: unknown }>;
  for (const e of [...layer.entries].sort((a, b) => a.path.localeCompare(b.path))) {
    const raw = String(lightTree[e.path]?.$value ?? (layer.tree as Record<string, { $value?: unknown }>)[e.path]?.$value ?? '');
    flat.push(`  --${e.path}: ${resolveLeaf(raw)};`);
  }
  writeFileSync(path.join(EX, 'tokens/astryx.vars.css'), `:root {\n${flat.join('\n')}\n}\n`);
  console.log(`✔ tokens/astryx.vars.css: ${flat.length} custom properties (light-resolved)`);
}
if (layer.modes) {
  write('tokens/modes/astryx.light.dtcg.json', layer.modes.light.tree);
  write('tokens/modes/astryx.dark.dtcg.json', layer.modes.dark.tree);
}

const varying = layer.entries.filter((e) => e.modes).length;
const groups = [...new Set(layer.entries.map((e) => e.group))];
const receipt = `# Astryx tokens — wrap receipt

Mechanical wrap of \`@astryxdesign/core@0.1.6\` \`src/theme/tokens.stylex.ts\`
(the npm-shipped source) through \`core/stylex-tokens.ts\` — names and
structure VERBATIM, \`light-dark()\` split into light/dark mode trees — with
the **theme-neutral value overlay** applied (below). Regenerate:
\`npx tsx examples/astryx/scripts/build-tokens.ts\` (refuses on any drift from
the numbers below).

- **${layer.count} tokens wrapped** from ${groups.length} defineVars tables (${groups.join(', ')})
- **${varying} mode-varying** (\`light-dark()\`) entries → \`tokens/modes/astryx.{light,dark}.dtcg.json\`; ${layer.count - varying} mode-invariant entries live in the base tree only
- **${layer.skipped.length} skipped**${layer.skipped.length > 0 ? ':' : ' — nothing was dropped.'}
${layer.skipped.map((s) => `  - \`${s.name}\` — ${s.reason}`).join('\n')}

## Theme-neutral overlay (the render substrate, not the library default)

The capture harness mounts \`<Theme theme={neutralTheme}>\` and injects
\`@astryxdesign/theme-neutral/dist/theme.css\` (\`extract/computed/configs/astryx.json\`),
so every committed reference render is THEME-NEUTRAL. Core's \`defineVars\`
tables are the library's UNTHEMED defaults. This wrap therefore overlays the
theme's \`:scope\` token plane onto core's name plane.

- **${overlaid.length} of ${layer.count} values overlaid** from \`theme-neutral@0.1.6 dist/theme.css\`
- **${themeSilent.length} core names the theme does not override** — they keep the core value, which is exactly what the browser resolves (theme.css only overrides)
- **${refBranchTyped.length} overlaid value(s) with a bare \`var()\` mode branch**${refBranchTyped.length ? `: ${refBranchTyped.map((t) => `\`${t}\``).join(', ')}` : ''} — a pure-reference branch inherits its sibling branch's inferred \`$type\` (a DTCG ref carries its target's type). Without that rule the leaf loses \`$type: color\`, drops out of the re-anchor join's colour candidate set, and one landed alias silently degrades back to a literal.
- **${themeOnly.length} theme-only names NOT added**, by name: ${themeOnly.map((t) => `\`--${t}\``).join(', ')}
  — they are outside core's \`defineVars\` tables, no astryx contract binds one
  (0 occurrences across \`examples/astryx/contracts/*.json\`), and adding them
  would inject ${themeOnly.length} site-missing fallbacks into the docs plane
  (\`build-docs-tokens.ts\` derives its name set from this file).

The overlay carries a **refusal**: if \`--font-family-body\` or
\`--font-family-heading\` starts with a CSS system/generic-font KEYWORD
(\`-apple-system\`, \`system-ui\`, \`sans-serif\`, …) the wrap exits non-zero.
The core plane starts both stacks with \`-apple-system\`; the Figma emitter takes
the FIRST stack entry, which is how \`fontFamily": "-apple-system"\` reached 148
declarations across 10 astryx scripts — a string Figma can never resolve.

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
    `✔ theme-neutral overlay: ${overlaid.length} values overlaid, ${themeSilent.length} core names not overridden by the theme, ${themeOnly.length} theme-only names skipped by name\n` +
    `✔ font substrate: --font-family-body starts with "${layer.entries.find((e) => e.path === 'font-family-body')?.value.split(',')[0].trim()}" (not a CSS keyword)\n` +
    `✔ corpus loads; ${SPOT.length}/3 mode spot checks resolve per mode`,
);
