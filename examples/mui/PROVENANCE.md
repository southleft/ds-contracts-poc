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
palette targets. 73 leaves aliased (organism round; 70 at the molecule round,
61 over the first five components), 0 refusals; everything else stays a
literal minted leaf (named).

## Pipeline (all commands from repo root)

```bash
node examples/mui/scripts/build-tokens.mjs          # theme → 150 DTCG tokens (kebab, Light/Dark modes) + vars css
npm run extract:computed -- --harness examples/mui/.mui-sandbox \
  --config extract/computed/configs/mui.json --component <C> --out extract/computed/out/mui
                                                    # capture (double-run byte-identity REQUIRED) + fidelity gate
npx tsx examples/mui/scripts/promote-floor.mjs      # contracts v0.2.0 + minted tree + source-alias pass + resolution guard
                                                    # + figmaStatePreviews probe (the REFEREE decides; refusals printed)
                                                    # + floor-reconstructed svg assets → assets/icons (molecule round)
npx tsx packages/cli/src/cli.ts figma examples/mui/contracts --out examples/mui/figma \
  --icons examples/mui/assets/icons \
  --tokens examples/mui/tokens/mui.dtcg.json,examples/mui/tokens/mui-minted.dtcg.json
node examples/mui/scripts/build-figma-tokens.mjs    # 00-tokens.figma.js (1514 vars, 73 native aliases)
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

## Gates (default-state fidelity floor)

The "pre-state rounds" caveat this heading used to carry is CLOSED for the
prop-selected plane: `checked` is a variant axis and its facts ride the base
plane (see the state-plane projection round below). It is NOT closed for the
pseudo-class planes — hover/active/focus-visible remain rendered on both
sides of the gate but carried into the contract only where the v13 rules
allow (root refs, plain color-kind refs on nested parts).

| component | combos | computed equality | pixel rows |
|---|---|---|---|
| Button | 126 | 86.199% | AA perfect 0/504 |
| Chip | 28 | 87.705% | AA perfect 0/112 |
| Card | 4 | **100.000%** | AA perfect 0/16 |
| Switch | 56 | **77.679%** | AA perfect **56/224** (state-plane projection round; was 73.649% / 0/224) |
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

### Organism round (2026-07-25 — Checkbox, TablePagination, and TABLE: the first ORGANISM)

| component | combos | computed equality | pixel rows |
|---|---|---|---|
| Checkbox | 6 | 72.464% | AA perfect 12/24 |
| TablePagination | 1 | 93.970% | AA perfect 0/4 (mean AA 12.0% masked) |
| **Table** (composed DataTable) | 2 | **85.201%** | AA perfect 0/8 (mean AA 27.5% masked — sort-arrow rotation + text metrics, named below) |

All three double-swept in one session — byte-identity REQUIRED and held. The
Table's 38 captured elements per combo promote to **34 parts**: head row +
5 columns (checkbox cell → Checkbox, sort-label cell → TableSortLabel, three
text columns, a right-aligned action cell) and two body rows, one of them
`selected` with a checked box.

Genesis: **11 component sets + 3 standalone** (Menu, Tooltip, TablePagination
— no variant axes), **160 variants, 1649 variables** (73 Figma-native source
aliases), 14 embedded icon assets — the exact `GENESIS-BATCH.figma.js` byte
stream is executed against the mocked Figma before it is written (builder
refuses otherwise), and `mui.bundle.json` is built twice byte-identically.

## The organism: what the composed DataTable needed (new this round)

Four engine classes, each pinned so it can never regress headlessly
(`evals/run.ts` → `organism-table-lowering`, plus the structural pins in
`examples/mui/scripts/figma-compile-receipt.mjs`):

1. **`childrenSpec` RECURSES.** The molecule round's canonical-children
   vocabulary was strictly ONE level (`<Tabs><Tab/><Tab/></Tabs>`); an
   organism is a TREE. Child entries take an optional `children` array;
   imports and the `$callback/$import/$render` marker grammar are resolved at
   EVERY depth, on both the census page and the portal page. A node that is
   BOTH a text leaf and a composition is a NAMED load refusal. (The census
   page also never collected marker imports from `childrenSpec` props at all —
   a latent one-level gap, fixed with the same walk.)
2. **The CSS table box model is LOWERED, not admitted.** `display:table*` is
   outside every vocabulary the schema speaks (`LayoutSchema.display` =
   flex|inline-flex; the declared registry = inline|inline-block|block|
   contents|none), so before this round a `display:table-row` part fell
   through to a `display-outside-vocabulary` receipt and then took the
   emitter's default `HORIZONTAL/CENTER/CENTER` — structurally wrong and
   SILENT. Rather than grow the bounded grammar with keywords no target
   renders, promotion lowers (`table-lowering:` receipt per part):
   `table`/`*-group` → flex column with stretched children, `table-row` →
   flex row with stretched children (the table box model's own "every cell
   takes the row height" rule), `table-cell` → flex row whose counter axis
   comes from its computed `vertical-align` and whose main axis comes from
   its computed `text-align` (this is what makes `align="right"` columns
   right-align). The ELEMENT lowers too — a promoted `<tr>`/`<thead>` outside
   a `<table>` is DELETED by the HTML parser, which scored the first Table
   capture at 33.5% — so each lowered part becomes a `<div>` carrying the
   matching ARIA role (`table`/`rowgroup`/`row`/`columnheader`/`cell`).
   `border-collapse`, `border-spacing`, `table-layout` and the sort-arrow
   `transform` stay named `codeOnly` residue.
3. **TABLE-CELL COLUMN WIDTH re-admits geometry.** Geometry is excluded from
   fusion BY NAME (environment-dependent); the absolute round found the first
   class where that is wrong (overlay anatomy), and this is the second. A
   cell's width is not the cell's own choice — the table's column algorithm
   assigns ONE width to the whole column, and the browser proves it: header
   and body cells of a column measure identical OUTER widths (box-sizing
   baked; MUI's cells are content-box, so 48px content + 4px padding is a
   52px canvas frame). Agreement across every row in every enabled combo
   admits the channel; disagreement is a `table-column-width-disagreement`
   refusal that admits NOTHING (hugging cells is the honest fallback). HEIGHT
   rides the ROW, not the cell: Chromium reports a cell's CONTENT height
   (30px inside a 63px row), and carrying that would step the per-cell
   dividers. Table-display parts are also excluded from the absolute-cluster
   geometry admission (a table contains absolute descendants — MUI's Checkbox
   input — which would otherwise admit those lying heights).
   Admitted at the pinned 720×360/16 stage (688px content width):
   `52 / 240.125 / 132.969 / 142.484 / 120.422` — five columns summing
   exactly to 688.
4. **Two emitters were dropping facts, both found by the organism.**
   `core/emit-html.ts` silently DROPPED the children of a text part — the
   same class the Figma emitter learned in the molecule round (Tooltip's
   label → arrow), never taught to the static emitter; the MUI
   TableSortLabel rendered "Name" with no sort arrow, and Polaris's Avatar
   had been dropping its person glyph in `generated/html/avatar.html` all
   along. And the Figma emitter's box-padded text lowering hardcoded
   `HORIZONTAL/MIN/MIN` on the wrapper frame, ignoring the part's own
   layout — every text table cell drew its glyphs at the top-left of a
   57.8px-tall cell. Both fixed; childless / layout-less parts stay
   byte-identical.

**No new emitter channel was needed for the table itself**: the minted `width`
and `height` reach `spec.fixedWidth` / `spec.fixedHeight` through the existing
token path, the lowering reaches `layoutSpec` through `Part.layout`, the
dividers ride the existing `border-bottom-*` channels, and the selected-row
tint rides the TR part's `background-color`. The compile receipt pins the REAL
canvas numbers headlessly: rows HORIZONTAL, five cells per row, one width per
column shared by header and body, a 1px bottom divider on every cell, equal
cell heights within a row, and a fill on the selected row only.

## The portal sweep (molecule round)

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
  never pass silently again. Checked-state thumb POSITION is STILL a
  residual, but it is now a PRECISELY LOCATED one — see the state-plane
  projection round below.
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

### Organism-round residuals and NAMED EXCLUSIONS (defect-first)

The composed DataTable is captured at a deliberately bounded scope. Every cut
below is greppable — in this file, in the `__note` fields of
`extract/computed/configs/mui.json`, in the seed contract descriptions, or as
an engine receipt in `enriched.extension.json`.

- **`stickyHeader` EXCLUDED BY NAME.** `position: sticky` has no carried
  spelling (`contract-schema` position = relative|static|absolute) and the
  sticky header additionally flips the table's `border-collapse` to
  `separate` and paints a background the non-sticky header does not have.
  Belt and braces: `-stickyHeader$` is also excluded from `classAllow`, so a
  stray sticky capture can never branch the anatomy union.
- **The row overflow MENU is captured CLOSED.** An open `Menu` portals a root
  to `document.body`, and the single-portaled-root policy
  (`capture.ts` portalSweep) receipts and DROPS in-stage roots — i.e. it
  would drop the entire table. Open-menu-in-organism needs multi-root fusion
  (the machinery exists but is exhibit-only, `anatomy.buildMultiRootUnion`).
- **`TableSortLabel` carries `direction="asc"` only** — the direction axis is
  excluded by name, and `-directionAsc`/`-directionDesc` are excluded from
  `classAllow` (axis-valued classes would union-branch).
- **The active sort arrow's 180° ROTATION is not carried.** MUI rotates the
  glyph with `transform: matrix(-1, 0, 0, -1, 0, 0)`; `transform` has no
  carried spelling beyond the absolute round's identity-translate
  decomposition, so it lands as `declared-channel value outside the bounded
  grammar` in `codeOnly` and the canvas draws the glyph in its AUTHORED
  orientation (pointing down). Visible in the gate pair image — the single
  remaining visual difference.
- **TableContainer / Paper is NOT the captured root.** Enumerated axes ride
  the ROOT mount and `size` is a `Table` prop, so the organism IS the
  `<Table>`; the Paper elevation wrapper is a separate concern (and `Card`
  already carries MUI's Paper elevations this round).
- **NO composition refs (v1).** Promotion never emits `component`/`repeat`/
  `slot` refs, so the rows are INLINED, not instances of the standalone
  Checkbox contract. This is not only a machinery limit — it is the RIGHT
  answer here: MUI's `size="small"` DESCENDANT rule zeroes the nested
  Checkbox's own padding (42×42 → 24×24) with UNCHANGED child classes, so a
  composed Checkbox instance would be wrong in small tables.
- **TWO body rows, not three.** Repeated siblings are separate parts under a
  GLOBAL naming counter (`label`, `label-2`, … `label-12`), so each extra row
  multiplies the part count. Two rows is the minimum that proves both the
  plain and the `selected`/checked row; the third row of the recon adds parts
  and no new fact.
- **The row-action control carries a TEXT glyph (`⋮`), not an icon asset.**
  The `childrenSpec` grammar mounts imported COMPONENTS and
  `@mui/icons-material` is not in the pinned sandbox; raw SVG markup in
  config (an `$svg` marker) is deliberately NOT invented this round.
- **Column widths are deterministic AT THE PINNED STAGE WIDTH.**
  `table-layout: auto` reflows with the available width, so the admitted
  widths are a fact of the 720×360/16 stage (688px content), not of the
  component in the abstract. Same determinism class as every other
  computed-capture fact; recorded in the admission receipt itself.
- **The schema has no table ELEMENTS.** `semantics.element` is
  `div` + `role: "table"` (the repo's own `ds.table` precedent) and the
  lowered parts carry ARIA roles — the generated code emits divs, not a real
  `<table>`.
- **TablePagination's rows-per-page Select is pinned CONTROLLED-CLOSED**
  (`slotProps.select.open = false`). The census active-driver's `mouse.down`
  lands on the Select, opens the MUI menu, and the select icon's 180° open
  rotation PERSISTED into the next sweep — a witnessed double-run
  byte-identity refusal. Same determinism-pin class as Menu/Dialog
  `transitionDuration: 0`. (The determinism refusal now NAMES its witness —
  capture key, element path + signature, both values — instead of only
  listing the unstable channel.)
- **TablePagination's arrows are FORCED-DISABLED at the pinned combo.** At
  `count=3 / rowsPerPage=10 / page=0` the component itself marks both arrow
  IconButtons `Mui-disabled`, so the ENABLED arrow colors are unobservable
  and absent from the captured truth. A paging axis would need a second fixed
  combo — deliberately out of v1.
- **Checkbox's tri-state is ONE axis by necessity, not preference.** The
  svg-content promotion carries per-value glyph assets only when the markup
  is a function of exactly ONE axis (`svg-content-multi-axis` refusal
  otherwise), so a `checked` × `indeterminate` two-axis spelling would have
  lost ALL THREE glyphs. The capture config expands one contract value into
  several library props through the new `{"$props": {…}}` grammar. NAMED
  RESIDUE: the CODE lowering back to MUI's two-boolean API is not spelled by
  the contract's code binding.
- **Checkbox 72.5% computed floor** — the same geometry-blind class as Switch
  (73.6%): the 42×42 control box, its 9px padding and the absolute
  full-cover input dominate the misses. 12/24 pixel rows are AA-perfect,
  which is the strongest pixel result of any MUI component so far.
- **Table 85.2% / mean AA 27.5% masked** — the sort-arrow rotation above plus
  text metrics: the emit-html side renders the same strings at the same
  bound sizes but the browser lays out the contract's flex cells with
  marginally different glyph origins than the real table's cells. The
  structural pins (per-column widths shared header↔body, per-cell dividers,
  equal cell heights, selected-row fill) cover what the percentage cannot.
- **Sibling-example changes this round were REVIEWED, not blind-repinned.**
  The two emitter fixes changed three committed artifacts outside MUI:
  `examples/polaris/generated/html/avatar.html` (the dropped glyph now
  renders), and `examples/polaris/figma/{radio-button,tag}.figma.js` +
  `examples/tailwind/figma/card.figma.js` + MUI's own
  `{autocomplete,menu,tabs}.figma.js`. The Polaris script diffs were verified
  to be PURE REORDERINGS (node multisets byte-equal) caused by the third
  emitter correction below; the rest are the text-part layout landing.
- **`position: relative` no longer partitions in the Figma emitter.** The
  Switch live finding partitioned "positioned" (absolute OR relative) parts
  after in-flow siblings so out-of-flow overlays paint on top. But a relative
  box stays IN FLOW — CSS paints it above overlapping siblings and never
  moves it — and in an auto-layout row there is nothing to overlap, so the
  partition only REORDERED the row: MUI's TablePagination select jumped to
  the end of its toolbar and Autocomplete's relative chips fell behind their
  input. Only `absolute` partitions now; the Switch/Slider overlay pins are
  unchanged and still green.

### STATE-PLANE PROJECTION round (2026-07-25) — one class CLOSED, one class located

**The defect this round fixes.** `checked` was declared a `stateProp` with
`state: "checked"`, a value OUTSIDE the closed contract state vocabulary
(`hover|active|focus-visible|disabled`). Nothing checked it: `StateAxisSpec.state`
is a TypeScript annotation over JSON that is cast, never validated. So MUI
Switch's checked colours minted as `background-color-state-checked` /
`color-state-checked` — names the mint-property parser could not re-read
(`stateOfMintProperty` returns null), which therefore landed as INERT channel
names in `tokens`/`tokensByProp`. The Figma emitter's `applyTokens` dropped
them silently; the CSS emitters wrote a literally invalid
`background-color-state-checked:` declaration. The values were captured,
minted into the DTCG tree, and rendered by NOBODY.

**What changed.**

1. **`checked` is a VARIANT AXIS** (the Checkbox/Accordion precedent):
   `axes: ["color","size","checked"]` + `axisValueMap {unchecked:false,
   checked:true}` in `extract/computed/configs/mui.json`; the seed contract's
   `checked` prop is an enum `unchecked|checked` bound `VARIANT`/`Checked`.
   `disabled` stays a stateProp — it IS a pseudo-class plane. The deltas are
   now ordinary base-plane per-axis facts.
2. **A load-time REFEREE for config states** (`extract/computed/capture.ts`
   `loadConfig`): a `stateProps[].state` outside `CONTRACT_STATES` refuses BY
   NAME, quoting the vocabulary and pointing at `axes`/`axisValueMap`. The
   vocabulary now has exactly ONE spelling — `CONTRACT_STATES` in
   `packages/schema/src/contract-schema.ts`, read by the contract `states`
   enum, by `fuse.ts` STATE_SUFFIXES and by the new referee. Before, it was
   three independent copies, which is why the hole existed.
3. **NESTED TWO-AXIS TOKEN CARRIAGE** (the reclassification's honest
   consequence, found by shipping it). MUI's checked colours are
   f(color, checked) — a two-axis fact on a NESTED part. `classify()` in
   `core/mint-tokens.ts` refused EVERY nested two-axis value outright
   (`if (obs.part !== '') return none`), so the first pass of this round
   *lost* the unchecked track colour the canvas used to draw: the gate fell
   73.6% → 68.3%. The pair FIT was always sound; only the carriage was
   missing, and it already existed one layer down — `validateContract` has
   allowed a per-value `tokensByProp` map ref carrying at most ONE
   placeholder naming a DIFFERENT enum prop since the computed-capture floor
   (the "S2 capability lift"), and every emitter substitutes over the full
   prop `subst` at any depth. So a nested pair is now spelled as a per-value
   map on the SECOND placeholder's axis (leaf-path = mint discovery order —
   deterministic, no tie-break invented) whose refs keep the other
   placeholder:
   `switch-track.tokensByProp[checked].checked["background-color"] =
   "{imported.switch.switch-track.background-color.{color}.checked}"`.
   A nested TRIPLE stays a named refusal (it would leave two placeholders).
   Result: **gate 68.3% → 77.679%** (73.649% before the round) and **pixel AA
   perfect 0/224 → 56/224** — the first non-zero pixel-perfect rows any MUI
   component has produced.

   The lift is **OPT-IN** (`mintTokens(…, { nestedPairs: true })`), and the
   suite is why. `mintTokens` has TWO consumers: `extract/computed`'s
   `applyMintToContract`, whose binding placer can spell a per-value map, and
   the DESIGN path (`core/propose-figma.ts`), which binds `part.tokens`
   directly. Enabling nested pairs globally made the design path emit a
   two-placeholder ref onto a nested part — refused by name by the referee,
   caught by `fill-matrix-depth-mint` and
   `design-rest-degraded-minting-binds-styles`. Handing a consumer a ref it
   cannot carry IS the bug this round is about, so the classifier now only
   offers a nested pair to a caller that declares it can place one. The
   design path's "uncorrelated nested fill mints NOTHING" invariant is
   unchanged, and the committed capture artifacts are byte-identical under
   the refactor (re-verified by recapture).
4. **State previews probed at promotion.** The Polaris probe is ported into
   `examples/mui/scripts/promote-floor.mjs` (which therefore runs under
   `npx tsx`, so it asks the REAL referee instead of re-implementing it).
   **mui.button accepted** — State = Default|Hover|Focus Visible|Active|
   Disabled, Button 63 → 75 canvas cells. Seven contracts **REFUSED BY NAME**
   and stay unpreviewd (switch, slider, checkbox, table on `focus-visible`;
   tabs, accordion, autocomplete on `hover` — "declares no token overrides
   … so its preview variant would render identically to Default"). The rule
   was NOT loosened and the undeclared states were NOT pruned: they still
   drive the code surface and `declaredStates`.

**Counts.** MUI Switch **14 → 28 variants**; genesis **146 → 160 variants**,
**1514 → 1649 variables**; `mui.bundle.json` 528,354 B, built twice
byte-identically, genesis batch likewise.

#### NAMED RESIDUAL — the checked thumb POSITION, now precisely located

MUI translates the checked thumb (`matrix(1, 0, 0, 1, 20, 0)` at Size=Medium,
`…16, 0` at Small). It is STILL not carried, and the reason is exact rather
than vague: the overlay-cluster synthetic-translate door decomposes an
identity-translate matrix into `translate-x`/`translate-y`
(`extract/computed/lib.ts` `SYNTHETIC_CHANNELS` / `IDENTITY_MATRIX`), but
`fuse.ts` admits those channels into the observation set only when the **BASE
combo's** element already carries one:

```
if (a.baseFlat[pi].node.style['translate-x'] !== undefined) set.add(p);
```

Switch's base combo is `primary.medium.unchecked.enabled`, whose
`buttonbase-root` computes `transform: none` — PROVEN from the committed
capture: the identity matrix appears in exactly **112 of 223** captures and
in **zero** unchecked ones. So the channel is never observed, and
`buttonbase-root.transform` stays in `codeOnlyChannels` ("declared-channel
value varies across combos"). Reclassifying `checked` was NECESSARY but not
SUFFICIENT — the door is keyed to the base plane, not to the axis.

The fix is a one-rule generalisation ("admit if ANY enabled combo carries a
translate; a missing value is 0px, which is exactly what `transform: none`
means"), and it is DELIBERATELY NOT TAKEN here: it re-opens fusion for every
captured component with an absolute cluster — 10 MUI components plus
ToggleSwitch — and four of them (`slider`, `autocomplete`, `tooltip`, plus
Switch) carry identity matrices in committed truth, so it is a full recapture
wave, not a patch. The compile receipt PINS the residual as an expectation
(`switch thumb-position residual pin`), so the day the door is generalised the
pin fails loudly and this paragraph gets rewritten with it.

#### Other named residuals from this round

- **Nested-part `states` still carry plain color-kind refs only** (v13). With
  `checked` an axis, Switch's hover/active background deltas are now
  correlated pairs rather than uncorrelated noise — but they resolve to refs
  with a `{color}` placeholder, and `Part.states` on a nested part refuses
  placeholders. 21 named `overflowBindings`, all of that one class. The
  pseudo-class planes are not projected for Switch; only the prop-selected
  plane is.
- **Portal components gained NO State axis, by name.** Dialog, Menu and
  Tooltip declare `states: []` (the portal sweep captures no interaction
  planes — see the molecule-round residuals), so the probe never ran on them
  and no preview axis exists. That absence is intended and pinned by the
  contract, not by luck.
- **STAYS EXCLUDED BY NAME** (unchanged this round): live hover behaviour
  (prototype wiring); overlay/portal state planes; geometry deltas on
  pseudo-class planes (`isFusable` still excludes GEOMETRY_CHANNELS there);
  outline outside-stroke approximation.
