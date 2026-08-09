# Astryx tokens — wrap receipt

Mechanical wrap of `@astryxdesign/core@0.1.6` `src/theme/tokens.stylex.ts`
(the npm-shipped source) through `core/stylex-tokens.ts` — names and
structure VERBATIM, `light-dark()` split into light/dark mode trees — with
the **theme-neutral value overlay** applied (below). Regenerate:
`npx tsx examples/astryx/scripts/build-tokens.ts` (refuses on any drift from
the numbers below).

- **186 tokens wrapped** from 13 defineVars tables (colorDefaults, spacingDefaults, sizeDefaults, borderDefaults, radiusDefaults, shadowDefaults, durationDefaults, easeDefaults, transitionDefaults, typographyDefaults, textSizeDefaults, fontWeightDefaults, typeScaleDefaults)
- **76 mode-varying** (`light-dark()`) entries → `tokens/modes/astryx.{light,dark}.dtcg.json`; 110 mode-invariant entries live in the base tree only
- **0 skipped** — nothing was dropped.


## Theme-neutral overlay (the render substrate, not the library default)

The capture harness mounts `<Theme theme={neutralTheme}>` and injects
`@astryxdesign/theme-neutral/dist/theme.css` (`extract/computed/configs/astryx.json`),
so every committed reference render is THEME-NEUTRAL. Core's `defineVars`
tables are the library's UNTHEMED defaults. This wrap therefore overlays the
theme's `:scope` token plane onto core's name plane.

- **103 of 186 values overlaid** from `theme-neutral@0.1.6 dist/theme.css`
- **30 core names the theme does not override** — they keep the core value, which is exactly what the browser resolves (theme.css only overrides)
- **1 overlaid value(s) with a bare `var()` mode branch**: `color-background-gray (color)` — a pure-reference branch inherits its sibling branch's inferred `$type` (a DTCG ref carries its target's type). Without that rule the leaf loses `$type: color`, drops out of the re-anchor join's colour candidate set, and one landed alias silently degrades back to a literal.
- **14 theme-only names NOT added**, by name: `--color-syntax-keyword`, `--color-syntax-string`, `--color-syntax-comment`, `--color-syntax-number`, `--color-syntax-function`, `--color-syntax-type`, `--color-syntax-variable`, `--color-syntax-operator`, `--color-syntax-constant`, `--color-syntax-tag`, `--color-syntax-attribute`, `--color-syntax-property`, `--color-syntax-punctuation`, `--color-syntax-background`
  — they are outside core's `defineVars` tables, no astryx contract binds one
  (0 occurrences across `examples/astryx/contracts/*.json`), and adding them
  would inject 14 site-missing fallbacks into the docs plane
  (`build-docs-tokens.ts` derives its name set from this file).

The overlay carries a **refusal**: if `--font-family-body` or
`--font-family-heading` starts with a CSS system/generic-font KEYWORD
(`-apple-system`, `system-ui`, `sans-serif`, …) the wrap exits non-zero.
The core plane starts both stacks with `-apple-system`; the Figma emitter takes
the FIRST stack entry, which is how `fontFamily": "-apple-system"` reached 148
declarations across 10 astryx scripts — a string Figma can never resolve.

## Mode spot checks (corpus-resolved, both modes)

| token | light | dark |
|---|---|---|
| `color-accent` | `#262626` | `#ebebeb` |
| `color-background-surface` | `#ffffff` | `#262626` |
| `color-text-primary` | `#171717` | `#fafafa` |

Corpus note: `TokenCorpusInput` still hard-codes the repo 4-tree layout
(gauntlet named-limit #1) — the wrap loads with the base tree shoehorned into
`semantic` and each mode tree into `light`, which is how the spot checks
above resolve. Freeing the input shape stays a named limit, not this wrap's.
