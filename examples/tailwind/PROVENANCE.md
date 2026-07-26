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
npx tsx examples/tailwind/scripts/promote-floor.mjs   # + figmaStatePreviews probe (referee decides; refusals printed)
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
| ToggleSwitch | 6 | 88.889% | 0/24 |

Genesis: 48 variants, 344 variables (21 source-aliased), batch mock-proven.
Source facts bound: `text-sm`/`text-base`/`text-xs`, `font-weight-medium`,
`color-white`, radius tokens — the library's own utility vocabulary.

## Named residuals (defect-first)

- **Flowbite's `primary` palette is INLINE-themed** (`@theme inline` in their
  plugin): utilities compile to literal hex (`#1A56DB`), not var refs — those
  channels stay gracefully-degraded minted literals *by the library's own
  choice*. This is the designed degradation path working, not a gap in the
  reader.
- **Toggle thumb (::after decor) not promoted** — STILL OPEN, now located to
  the exact blocker. Drawn in every combo with per-sizing geometry: outside
  the v1 pseudo-decor grammar on the two counts already named (unconditional
  placement; non-uniform box) **and on a third, discovered in the pseudo-decor
  v2 round and decisive**: the knob's x offset is a **two-axis product**.
  Captured truth (`out/tailwind/toggleswitch/captured-truth.json`,
  `part-0::after`) is `left: 2px` uniform with `translate: none | 100%`, and
  the `100%` bakes against the knob's OWN border box — which is
  `16|20|24px` by Sizing. So the resolved offset is a function of
  `Sizing × Checked` (2, 18 / 2, 22 / 2, 28). `stylesWhen` conditions are
  **single-prop**, and `literals`/`shape` are scalars: no spelling in the
  decor grammar can express a product. Carrying it needs the pseudo
  SYNTHESIZED INTO THE SWEEP as a real aligned part, so `prepareMint` planes
  it and mints `{Sizing}×{Checked}` tokens — exactly how MUI Switch's thumb
  offset is now carried (`translate-x.{size}.checked`). That is a capture/
  alignment change, not a grammar tweak, and it is the named next round.
  - Two prerequisites DID land this round: the `translate` longhand is now
    decomposed into the synthetic `translate-x/y` channels with the `%`
    baked against the element's own border box (Tailwind's `translate-x-full`
    never touches `transform`, so it was previously invisible), and the pill
    sentinel is shared with the decor fold — without which a promoted knob
    would have shipped as a **square** (`rounded-full` computes to
    `3.35544e+07px`, which the decor fold's local px regex silently read as
    radius `0`).
  - A cheaper alternative exists and is recorded for the next round: the
    checked knob is exactly right-anchored (`left + translate + w ==
    trackW - 2`), so an anchor-selection rule could spell the offset as
    `Checked=checked → right: 2px` / `Checked=unchecked → left: 2px` —
    single-axis, expressible today — leaving only per-axis width/height
    (which needs the emitter's shape scalars to resolve per combo).
  - On canvas the toggle still draws its track only.
- **Card floor 72.4%**: lowest of the set — flowbite Card is a bordered flex
  column whose spacing channels partially fold; un-triaged residue, named.
- **ToggleSwitch source facts sparse** (12): its colors ride the inline
  primary palette (see above).
### STATE-PLANE PROJECTION round (2026-07-25) — CLOSED and newly named

- **CLOSED — checked track color is projected.** `checked` was declared a
  `stateProp` with `state: "checked"` — a value OUTSIDE the closed contract
  state vocabulary (hover|active|focus-visible|disabled). Its captured delta
  therefore minted `background-color-state-checked`, a channel name the
  mint-property parser could not re-read and that NO emitter rendered: the
  fact was captured, minted into the DTCG tree, and dropped on the floor
  silently. `checked` is now a real VARIANT AXIS
  (`axes: ["sizing", "checked"]` + `axisValueMap {unchecked:false,
  checked:true}`, `Checked` VARIANT prop in the seed contract), so the delta
  is an ordinary base-plane per-axis fact:
  `part-0.tokensByProp[checked].{checked,unchecked}.background-color`.
  ToggleSwitch **3 → 6 variants**; the compile receipt pins that the two
  Checked cells bind DIFFERENT track fill variables (`figma-compile-receipt.mjs`).
  A capture config can never make this mistake again — `loadConfig` refuses an
  out-of-vocabulary `stateProps[].state` BY NAME
  (`extract/computed/capture.ts`).
- **State previews ON where the referee accepts.** `figmaStatePreviews` is
  now probed at promotion for every contract: **Button and Badge accepted**
  (State = Default|Hover|Focus Visible|Active|Disabled cells on canvas).
  **ToggleSwitch REFUSED BY NAME** — `state "disabled" declares no token
  overrides on anatomy.root.states (or any part's states), so its preview
  variant would render identically to Default`. The refusal is printed by
  the promotion, not worked around; the rule was not loosened and the
  declared state was not pruned (it still drives the code surface).
- **The thumb still draws nothing (unchanged, re-named).** This round colors
  the TRACK only. Flowbite's toggle thumb is an `::after` pseudo-element with
  unconditional placement and a per-sizing box — outside the v1 pseudo-decor
  grammar on two counts (above), and on a THIRD count located in the
  pseudo-decor v2 round: its x offset is a `Sizing × Checked` **product**,
  which no single-prop `stylesWhen` or scalar literal can spell. See the
  named-residual entry above for the full analysis, the two prerequisites
  that did land (translate-longhand decomposition, shared pill sentinel),
  and the two candidate paths for closing it. A checked toggle on canvas is
  still a colored track with no knob; the knob is a separate round.
