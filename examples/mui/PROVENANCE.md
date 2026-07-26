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
palette targets. 70 leaves aliased (molecule round; was 61 over the first
five components), 0 refusals; everything else stays a literal minted leaf
(named).

## Pipeline (all commands from repo root)

```bash
node examples/mui/scripts/build-tokens.mjs          # theme → 150 DTCG tokens (kebab, Light/Dark modes) + vars css
npm run extract:computed -- --harness examples/mui/.mui-sandbox \
  --config extract/computed/configs/mui.json --component <C> --out extract/computed/out/mui
                                                    # capture (double-run byte-identity REQUIRED) + fidelity gate
node examples/mui/scripts/promote-floor.mjs         # contracts v0.2.0 + minted tree + source-alias pass + resolution guard
                                                    # + floor-reconstructed svg assets → assets/icons (molecule round)
npx tsx packages/cli/src/cli.ts figma examples/mui/contracts --out examples/mui/figma \
  --icons examples/mui/assets/icons \
  --tokens examples/mui/tokens/mui.dtcg.json,examples/mui/tokens/mui-minted.dtcg.json
node examples/mui/scripts/build-figma-tokens.mjs    # 00-tokens.figma.js (1270 vars, 70 native aliases)
node examples/mui/scripts/figma-compile-receipt.mjs # referee + headless execute per script
node examples/mui/scripts/build-genesis-batch.mjs   # GENESIS-BATCH.figma.js (refuses unless mock-proven)
npx tsx packages/cli/src/cli.ts figma bundle examples/mui/contracts \
  --tokens examples/mui/tokens/mui.dtcg.json,examples/mui/tokens/mui-minted.dtcg.json \
  --modes examples/mui/tokens/modes/mui.light.dtcg.json,examples/mui/tokens/modes/mui.dark.dtcg.json \
  --name MUI --icons examples/mui/assets/icons --out examples/mui/figma/mui.bundle.json
                                                    # mui.bundle.json — the ONE JSON a user pastes
                                                    # (contracts + tokenSet + embedded icon SVGs;
                                                    # byte-deterministic, freshness-pinned by the
                                                    # mui-figma-genesis eval)
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

### Molecule round (2026-07-25 — Tabs, Accordion, Autocomplete census; Dialog, Menu, Tooltip portal-swept)

| component | combos | computed equality | pixel rows |
|---|---|---|---|
| Tabs | 6 | 93.750% | AA perfect 18/24 |
| Accordion | 8 | 91.813% | AA perfect 3/32 (mean AA 20.9% — expansion geometry, named below) |
| Autocomplete | 2 | 95.110% | AA perfect 0/8 |
| Dialog | 5 | 95.604% | pixel not comparable (portal, named below) |
| Menu | 1 | 93.434% | pixel not comparable (portal, named below) |
| Tooltip | 2 | 70.543% | pixel not comparable (portal, named below) |

Every capture double-swept in one session — byte-identity REQUIRED and held
for all six (the three census components additionally re-run against the
final shared capture code: `captured-truth.json` byte-identical to the first
pass).

Genesis: 9 component sets + 2 standalone components (Menu, Tooltip — no
variant axes), 140 variants, 1270 variables — the exact
`GENESIS-BATCH.figma.js` byte stream is executed against the mocked Figma
before it is written (builder refuses otherwise).

## The portal sweep (new this round)

Dialog, Menu and Tooltip render their real DOM through React portals into
`document.body` — they cannot share the census page (a fixed, viewport-
covering overlay would paint over every other stage and swallow the
interaction drivers). `extract/computed/capture.ts` gains `portalSweep`: a
two-phase driver page per component (`window.__setSpec(i)` mounts combo *i*,
`false` empties the stage), baseline-diff reader over `document.body`, one
combo mounted/reset at a time, the SETTLED overlay captured wherever React
put it. Root policy: exactly ONE portaled root is carried (Dialog's modal
root, Menu's popover, Tooltip's popper); in-stage anchor children (Tooltip's
Button anchor) are receipted, never carried; anything else is a named
MULTI-ROOT-CAPTURE refusal. Open-drivers are recorded in provenance
(`open:true`; Menu adds `anchorReference='anchorPosition'` +
`transitionDuration:0`; Dialog pins `transitionDuration:0`).

Canonical-children vocabulary (census + portal pages alike):
`childrenSpec` mounts N imported children in order
(`<Tabs><Tab/><Tab/><Tab/></Tabs>`, Accordion's Summary/Details, Menu's
MenuItems) — mutually exclusive with `childWrap`, refused at load; and the
`$render` marker (`{"$render":"pkg#Export"}`) admits the ONE function shape
the config vocabulary allows — the identity render-prop
(`(params) => <Export {...params}/>`, Autocomplete's required `renderInput`).
Any richer function body is a named refusal, never config.

## Provenance anchors (write-back v1)

Every source-aliased leaf also lands in `contracts/<name>.anchors.json` — the
write-back through-line: `{leaf, token, part, cssProperty, varName, selector}`
where `selector` is the CSSOM rule that declares the channel (state planes
anchor to their state rule, e.g. `.Mui-…-switchBase.Mui-checked`). A canvas
edit to an anchored fact becomes an anchor LOOKUP, not a file scan. Named
limitation: for Emotion-runtime libraries the anchor is RENDER-level (hashed
class selectors); FILE-level (`path:line`) anchors are the static readers'
job and are not built yet.

## Named residuals (defect-first)

- **Pixel AA 0 everywhere**: the anti-aliased-pixel-perfect metric is 0 across
  all rows (same class as Astryx — hover/active state carrying and font
  rasterization differences; the computed-equality gate is the floor metric
  this round).
- **Switch 73.6% computed floor** (unchanged): the % is geometry-blind by
  design — but the ABSOLUTE-POSITIONING ROUND (2026-07-25, after the first
  live paste exposed Slider/Switch as stacked blocks) now carries the
  overlay-anatomy geometry: uniformly-absolute parts and their cluster admit
  width/height/offset channels into fusion (outer-size baked per box-sizing;
  identity-translate matrices decompose into synthetic per-axis channels),
  and the emitter lowers them to real absolute placement (STRETCH insets,
  measured sizes beat flex-grow). The compile receipt pins the REAL numbers
  headlessly: thumb 20×20, rail h4 stretched, track 34×14 — the class can
  never pass silently again. Checked-state thumb POSITION stays a named
  state-round residual (default-state placement only this round).
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

### Molecule-round residuals (defect-first)

- **Portal components capture DEFAULT interaction only**: the census state
  drivers (hover/focus-visible/active) assume an in-stage, persistent mount;
  `portalSweep` mounts/unmounts per combo. Overlay hover/focus/active planes
  for Dialog, Menu and Tooltip DO NOT EXIST in the captured truth (fusion
  skips the absent planes by name — `extract/computed/fuse.ts`). The gate
  still renders its own 4 interaction planes on both sides (it re-renders
  original AND contract), so the computed % stands; state-plane BINDINGS for
  overlays are a future round.
- **Portal pixel rows are pinned 100 ("fully different"), not scored**: the
  original-side screenshot is the OVERLAY as portaled (Dialog's 900×1000
  modal-in-viewport), the replay/gate side renders the contract in a bare
  stage — sizes can never match, and the size-mismatch convention scores 100
  (pessimistic) with the reason in `pixel-rows.json`. The computed-equality
  gate is the floor metric for these three; no pixel number is quoted.
- **Tooltip 70.5% computed floor**: the popper is a positioned bubble —
  placement transforms and popper-owned geometry channels dominate the misses
  (same geometry-blind class as Switch 73.6%). The structural pin (bubble
  text + arrow part) covers what the % cannot see.
- **Accordion pixel mean AA 20.9%**: expansion geometry — the Collapse
  wrapper's height animation is captured settled, but the gate's emit-html
  render reflows the details region differently mid-plane. Computed floor
  91.8% stands; 3/32 rows AA-perfect. Transitions were NOT theme-disabled
  this round (capture settles deterministically without it — double-run
  byte-identity held); the harness-theme
  `createTheme({transitions:{create:()=>'none'}})` escape stays available if
  a future component fails settle.
- **Autocomplete captured CLOSED**: `open:true` would portal the listbox and
  force the portal path, losing the 4 interaction planes over the input/chips
  — the round chose the richer in-stage capture. The chips, input and both
  end-adornment indicators are carried (4 floor-reconstructed SVG assets);
  the OPEN listbox/popup is a NAMED EXCLUSION, deliberately pinned absent in
  the compile receipt. A listbox round needs portalSweep + census on one
  component.
- **Tooltip anchor receipted, not carried**: the `childWrap` Button anchor is
  an in-stage root the single-root fusion does not carry
  (`portal-anchor-receipt` in the extension) — the contract is the bubble,
  not the anchor.
- **Emitter class fixed, was silent**: a text-holder part CONTAINING parts
  (Tooltip's label → arrow) previously compiled its text and silently DROPPED
  the children (`core/emit-figma-script.ts`); the molecule round's structural
  pin caught it. Child-bearing text parts now take the frame lowering and
  compile their children; childless text parts are byte-identical (proven:
  tailwind bundle unchanged).
- **Bundle-carried icons (envelope extension)**: contracts referencing icon
  assets made the JSON-only rule and the engine path collide — the bundle now
  embeds exactly the referenced SVGs (`figma bundle --icons`, refuses missing
  assets BY NAME), the engine merges them over baked icons
  (planGenerate/updatePlan/updateApplySteps + `figma push` re-wrap all carry
  them). Icon-less bundles byte-identical under the change. The committed
  Polaris bundle predates this and still lacks its icon SVGs — its
  engine-path equivalence pin remains the noted follow-up from 72b5075.
