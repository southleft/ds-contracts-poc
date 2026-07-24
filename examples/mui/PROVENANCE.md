# MUI round — provenance

**Subject:** `@mui/material@9.2.0` (Material UI, the most-installed React component
library), pinned in `.mui-sandbox/` with `@emotion/react@11.14.x`,
`@emotion/styled@11.14.x`, `react@19.2.x`, `esbuild@0.28.x`. The sandbox is the
only network-touching step; everything downstream is deterministic over it.
Recreate (git-ignored, like `.astryx-sandbox`):

```bash
mkdir -p examples/mui/.mui-sandbox && cd examples/mui/.mui-sandbox && npm init -y \
  && npm i @mui/material@9.2.0 @emotion/react@11 @emotion/styled@11 react@19 react-dom@19 esbuild@0.28
```

**Why MUI:** the fourth library through the pipeline (repo tokens → Polaris →
Astryx → MUI) and the first with **Emotion runtime styling** — no static CSS
to read. It exercises the styling-method seam TJ named: the extraction is
proven styling-agnostic (the computed floor) *and* the token semantics come
from a new reader (below), not from hand-mapping.

## The Emotion / CSS-variables reader (new this round)

MUI mounts inside `ThemeProvider` with `createTheme({ cssVariables: true })` —
the library's OWN emitted rules then reference its tokens by name
(`background-color: var(--variant-containedBg)` where the same rule sets
`--variant-containedBg: var(--mui-palette-primary-main)`). The capture walks
CSSOM for matching rules, follows ONE indirection hop, and records every
candidate `(customProperty, resolvedValue)` per channel. The Node side keeps a
candidate only when its resolved value **equals the captured computed value**
(specificity is never guessed from document order) and the kebab-cased name
(`--mui-palette-primary-main` → `palette-primary-main`) exists as a DTCG leaf.
Result: `source-bindings.json` per component — SOURCE facts, the library's own
stylesheet naming the token each channel binds.

At promotion, minted leaves whose covering combos all agree become **DTCG
aliases** (`imported.button.root.background-color.contained.primary` →
`{palette-primary-main}`), value-verified twice; the Figma token sync emits
those as **native variable aliases** so they inherit Light/Dark from the
palette targets. 61 leaves aliased, 0 refusals; everything else stays a
literal minted leaf (named).

## Pipeline (all commands from repo root)

```bash
node examples/mui/scripts/build-tokens.mjs          # theme → 150 DTCG tokens (kebab, Light/Dark modes) + vars css
npm run extract:computed -- --harness examples/mui/.mui-sandbox \
  --config extract/computed/configs/mui.json --component <C> --out extract/computed/out/mui
                                                    # capture (double-run byte-identity REQUIRED) + fidelity gate
node examples/mui/scripts/promote-floor.mjs         # contracts v0.2.0 + minted tree + source-alias pass + resolution guard
npx tsx packages/cli/src/cli.ts figma examples/mui/contracts --out examples/mui/figma \
  --tokens examples/mui/tokens/mui.dtcg.json,examples/mui/tokens/mui-minted.dtcg.json
node examples/mui/scripts/build-figma-tokens.mjs    # 00-tokens.figma.js (912 vars, 61 native aliases)
node examples/mui/scripts/figma-compile-receipt.mjs # referee + headless execute per script
node examples/mui/scripts/build-genesis-batch.mjs   # GENESIS-BATCH.figma.js (refuses unless mock-proven)
```

**Seeds vs promoted:** capture reads `contracts-seed/` (props/axes only, empty
anatomy); promotion writes `contracts/`. The two directories are separate
because a capture that reads its own promoted output stops minting the leaves
the promoted bindings reference (the dangling-ref trap — now also caught by
the promote-floor resolution guard).

## Gates (default-state fidelity floor, pre-state rounds)

| component | combos | computed equality | pixel rows |
|---|---|---|---|
| Button | 126 | 86.199% | AA perfect 0/504 |
| Chip | 28 | 87.705% | AA perfect 0/112 |
| Card | 4 | **100.000%** | AA perfect 0/16 |
| Switch | 56 | 73.649% | AA perfect 0/224 |
| Slider | 12 | 89.448% | AA perfect 0/48 |

Genesis: 5 component sets, 121 variants, 912 variables — the exact
`GENESIS-BATCH.figma.js` byte stream is executed against the mocked Figma
before it is written (builder refuses otherwise).

## Named residuals (defect-first)

- **Pixel AA 0 everywhere**: the anti-aliased-pixel-perfect metric is 0 across
  all rows (same class as Astryx — hover/active state carrying and font
  rasterization differences; the computed-equality gate is the floor metric
  this round).
- **Switch 73.6%**: the lowest floor — MUI's Switch is a stacked
  absolute-position anatomy (track/thumb/input) where geometry channels
  dominate; state rounds and layout enrichment are the named next class.
- **box-shadow source refs skipped**: `var(--mui-shadows-2)` raw values
  serialize differently from computed box-shadow (comma/space form) — value
  verification refuses, so shadows stay minted literals (named skip in
  `source-bindings.json`).
- **`--mui-spacing` calc() refs skipped**: padding channels use
  `calc(var(--mui-spacing) * N)` — calc is excluded from the reader by name;
  spacing binds stay literal minted leaves.
- **Modifier classes are config, not code**: the anatomy-union explosion
  (42 branches on Switch) is prevented by the `classAllow` negative-lookahead
  grammar in `extract/computed/configs/mui.json` — declarative, but it names
  MUI's modifier conventions (`Mui-*` state classes, `-colorX/-sizeX/-textX`
  value classes). A new library needs its own grammar line.
- **Ripple pinned off**: `disableRipple` fixed on Button/Switch — the
  touch-ripple animation never settles (determinism refusal otherwise).
