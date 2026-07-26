# Tailwind round — provenance

**Subject:** `flowbite-react@0.12.17` (the most-installed Tailwind-native React
component library shipping as a real npm package) on `tailwindcss@4.3.3`,
pinned in `.tw-sandbox/` with `react@19.2.x`, `esbuild`, `@tailwindcss/cli`.
The fifth library through the pipeline and the **fourth styling method** —
completing the tier-1 guarantee ([docs/16](../../docs/16-sync-boundary.md)).
Recreate (git-ignored):

```bash
mkdir -p examples/tailwind/.tw-sandbox && cd examples/tailwind/.tw-sandbox \
  && printf '{"name":"tw-sandbox","private":true}\n' > package.json \
  && npm i flowbite-react react@19 react-dom@19 esbuild tailwindcss @tailwindcss/cli
# deterministic CSS build (the Tailwind compiler is a pure function of
# sources + theme):
cat > input.css <<'CSS'
@import "tailwindcss" source(none);
@source "./node_modules/flowbite-react/dist";
@plugin "flowbite-react/plugin/tailwindcss";
CSS
npx @tailwindcss/cli -i input.css -o tailwind.css
```

## The Tailwind reader — mostly the CSS-vars reader

The load-bearing discovery: **Tailwind v4 is already a CSS-variables system.**
Utilities compile to `background-color: var(--color-cyan-700)`,
`border-radius: var(--radius-lg)`, `font-size: var(--text-sm)` — so the
Emotion/CSS-vars reader (config `varPrefix: "--"`) binds Tailwind token names
with NO new reader architecture. What the round DID need:

- **Grouping-rule recursion**: v4 nests all rules in `@layer` blocks — the
  CSSOM walk now recurses grouping rules (`@layer`/`@media`/`@supports`).
- **Inlined stylesheet**: `file://` pages treat *linked* sheets as opaque
  origins (`cssRules` throws) — the harness inlines the built CSS into a
  `<style>` tag (Emotion never hit this; it injects styles).
- **Fallback-chain candidates**: `var(--tw-leading, var(--text-sm--line-height))`
  carries the real token in the fallback — every referenced var is a
  candidate; value verification picks.
- **oklch**: v4 themes are oklch and Chromium KEEPS the space in computed
  values — a shared deterministic OKLab→sRGB conversion (extract/computed/
  lib.ts `oklchToRgba`) feeds minting, verification, and the token wrap.
- **Pill radius**: `rounded-full` computes to `3.35544e+07px` (Chromium's
  clamp of `calc(infinity*1px)`) — carried as the 9999px pill sentinel.
- **Visible-root capture**: Flowbite's ToggleSwitch renders a hidden sr-only
  `<input>` as the FIRST DOM child — capture and interaction drivers now
  target the first child that renders boxes.
- **Pseudo-absolute cluster**: an absolutely-positioned `::after` (the toggle
  thumb) marks its host as overlay anatomy — the track's geometry admits.

## Pipeline (repo root)

```bash
npx tsx examples/tailwind/scripts/build-tokens.mjs   # tailwind.css :root vars → 68-token DTCG (oklch→hex)
npm run extract:computed -- --harness examples/tailwind/.tw-sandbox \
  --config extract/computed/configs/tailwind.json --component <C> --out extract/computed/out/tailwind
node examples/tailwind/scripts/promote-floor.mjs
npx tsx packages/cli/src/cli.ts figma examples/tailwind/contracts --out examples/tailwind/figma \
  --tokens examples/tailwind/tokens/tailwind.dtcg.json,examples/tailwind/tokens/tailwind-minted.dtcg.json
node examples/tailwind/scripts/build-figma-tokens.mjs
node examples/tailwind/scripts/figma-compile-receipt.mjs
node examples/tailwind/scripts/build-genesis-batch.mjs
npx tsx packages/cli/src/cli.ts figma bundle examples/tailwind/contracts \
  --tokens examples/tailwind/tokens/tailwind.dtcg.json,examples/tailwind/tokens/tailwind-minted.dtcg.json \
  --name Tailwind --out examples/tailwind/figma/tailwind.bundle.json
                     # tailwind.bundle.json — the ONE JSON a user pastes (contracts +
                     # tokenSet, single-mode; freshness-pinned by tailwind-figma-genesis)
```

## Gates (default-state floor)

| component | combos | computed | pixel rows |
|---|---|---|---|
| Button | 50 | 97.576% | 0/200 |
| Badge | 12 | 90.650% | **48/48 perfect** |
| Card | 1 | 72.414% | 0/4 |
| Alert | 4 | 84.545% | **16/16 perfect** |
| ToggleSwitch | 6 | 87.500% | 0/24 |

Genesis: 45 variants, 344 variables (21 source-aliased), batch mock-proven.
Source facts bound: `text-sm`/`text-base`/`text-xs`, `font-weight-medium`,
`color-white`, radius tokens — the library's own utility vocabulary.

## Named residuals (defect-first)

- **Flowbite's `primary` palette is INLINE-themed** (`@theme inline` in their
  plugin): utilities compile to literal hex (`#1A56DB`), not var refs — those
  channels stay gracefully-degraded minted literals *by the library's own
  choice*. This is the designed degradation path working, not a gap in the
  reader.
- **Toggle thumb (::after decor) not promoted**: drawn in every combo with
  per-sizing geometry — outside the v1 pseudo-decor grammar on two counts
  (unconditional placement; non-uniform box). The named next grammar
  extension: per-axis decor geometry + unconditional absolute decor parts.
  On canvas the toggle currently draws its track only.
- **Card floor 72.4%**: lowest of the set — flowbite Card is a bordered flex
  column whose spacing channels partially fold; un-triaged residue, named.
- **ToggleSwitch source facts sparse** (12): its colors ride the inline
  primary palette (see above).
- **Checked-state track color** carried as a state plane
  (`background-color-state-checked`) but state planes are not yet projected
  into genesis — the same state-round class as MUI.
