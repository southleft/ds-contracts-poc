# Astryx tokens — wrap receipt

Mechanical wrap of `@astryxdesign/core@0.1.6` `src/theme/tokens.stylex.ts`
(the npm-shipped source) through `core/stylex-tokens.ts` — values VERBATIM,
`light-dark()` split into light/dark mode trees. Regenerate:
`npx tsx examples/astryx/scripts/build-tokens.ts` (refuses on any drift from
the numbers below).

- **186 tokens wrapped** from 13 defineVars tables (colorDefaults, spacingDefaults, sizeDefaults, borderDefaults, radiusDefaults, shadowDefaults, durationDefaults, easeDefaults, transitionDefaults, typographyDefaults, textSizeDefaults, fontWeightDefaults, typeScaleDefaults)
- **79 mode-varying** (`light-dark()`) entries → `tokens/modes/astryx.{light,dark}.dtcg.json`; 107 mode-invariant entries live in the base tree only
- **0 skipped** — nothing was dropped.


## Mode spot checks (corpus-resolved, both modes)

| token | light | dark |
|---|---|---|
| `color-accent` | `#0064E0` | `#2694FE` |
| `color-background-surface` | `#FFFFFF` | `#1F1F22` |
| `color-text-primary` | `#0A1317` | `#DFE2E5` |

Corpus note: `TokenCorpusInput` still hard-codes the repo 4-tree layout
(gauntlet named-limit #1) — the wrap loads with the base tree shoehorned into
`semantic` and each mode tree into `light`, which is how the spot checks
above resolve. Freeing the input shape stays a named limit, not this wrap's.
