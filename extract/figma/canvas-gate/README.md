# The Canvas Pixel Gate

Measures, in pixels and in numbers, how closely the CANVAS-ENGINE renders of the
committed Polaris contracts match the REAL `@shopify/polaris@13.9.5` npm package —
per variant cell, with a committed scorecard per component. This is an acceptance
instrument: numbers are quoted exactly, misses are named, and a low percentage is
never allowed to masquerade (see the blank-canvas guard below).

## Run

```
npx tsx extract/figma/canvas-gate/run.ts              # all components
npx tsx extract/figma/canvas-gate/run.ts --component Tag
```

Re-runs from the CURRENT committed contracts (`examples/polaris/contracts/`) and
token wrap every time — nothing cached across runs. Requires the Polaris npm
sandbox (`POLARIS_HARNESS` env, default the session scratchpad's
`polaris-harness/`: `@shopify/polaris` 13.9.5 + react 18 + esbuild node_modules)
and a local Chromium (`extract/figma/visual-parity/render.ts` discovery:
ms-playwright cache / `PLAYWRIGHT_CHROMIUM_PATH` / system Chrome).

## The two sides

**A — canvas engine (`canvas-doc.ts`)**: `createFigmaEngine({tokens, icons})
.compileComponentData(contract, byId)` — the exact compile the Figma sync
scripts serialize — rendered by the playground's canvas renderer
(`playground/src/engine/canvas-preview.ts`, vendored verbatim minus the session
machinery). Token resolution: the wrapped Polaris tree pxified at 1rem=16px with
in-set aliases resolved (the `generate.ts` engine tree) plus the minted
`imported.*` layer, emitted as one `:root` custom-property stylesheet. One cell
per hugging stage, white surface, Inter, animations frozen, screenshot at
deviceScaleFactor 2. Text/TextField draw the SAME curated canvas projection as
the committed sync scripts (`generate.ts` CANVAS_PROJECTIONS, vendored) — they
join the channel tables only, not the pixel scoring.

**B — real Polaris (`real-page.ts`)**: the real npm package mounted per cell in
the SAME pinned Chromium with the extract/computed mount recipe (AppProvider +
en locale + styles.css, esbuild file:// bundle). Props per cell = the cell's
enum axis values mapped through the contract's code bindings + contract prop
defaults + a small per-component mount plan (`run.ts` MOUNT_PLAN) whose text
content is DERIVED from the compiled spec's own characters, so regenerated
contracts stay in sync. Interaction-state preview cells map to real browser
states, driven the visual-parity way: hover via `locator.hover`, focus-visible
via sentinel + Tab (matched state recorded), active via hover + `mouse.down`,
disabled via prop. Infinite animations pinned at `currentTime 0`; transitions
off; uncontrolled form state reset after active clicks.

Named mount alignments (quoted in the scorecards): Checkbox/RadioButton mount
`labelHidden` because the contract anatomy carries no label part; Thumbnail
mounts the capture harness's deterministic 1×1 gray SVG data-URI (`source` is
required with no contract default).

## Cells

Every compiled variant is a cell: the full enum cartesian (axis order and
default-first value order re-derived and ASSERTED against the compiled variant
names, `compile.ts deriveCells`) plus the `figmaStatePreviews` State-axis cells.

## Scoring (`score.ts`)

Both crops are near-white-trimmed (threshold 250 — Polaris's 5% disabled washes
survive) and center-padded onto the UNION canvas: never resampled, never cropped
to match — a size delta stays in the diff and is quoted (`canvasPx`/`realPx`,
device px). Three operating points per cell:

- `pctExactUnmasked` — pixelmatch threshold 0, `includeAA: true`: every
  differing pixel, antialiasing included.
- `pctAAUnmasked` — threshold 0.1, `includeAA: false`: pixelmatch's
  antialiasing classifier excludes AA pixels (a principled per-pixel test, not
  a fudge factor). NOTE: this point is blind to very-low-contrast differences
  (light gray vs white sits under the 0.1 YIQ threshold) — that is what the
  exact point is for.
- `pctAAMasked` — the AA point with text regions removed from numerator AND
  denominator. Mask = BOTH sides' DOM text client rects (the canvas draws
  Inter; real Polaris resolves its own stack — a named runtime difference),
  inflated 4 device px, each transformed through its own side's trim origin —
  the `extract/figma/visual-parity/img.ts` masking policy. `maskCoveragePct`
  is quoted: for text-dominated components (Tag, Badge) the masked denominator
  is mostly component edges.

**Blank-canvas guard**: `inkCanvasPct`/`inkRealPct` (non-near-white share of the
union canvas) are quoted per cell. A canvas side drawing (nearly) nothing scores
a deceptively LOW diff — such cells are flagged (`CANVAS SIDE (NEARLY) BLANK`,
or `BOTH SIDES BLANK … VOID`) and fail `acceptance.noBlankCanvasCells`. A ≤5%
mean earned against a blank canvas is not a pass.

Acceptance per component: `maskedMeanLE5` (masked mean ≤ 5%),
`allCellsOver10Named` (every cell over 10% carries a named cause — a mechanism,
never a tolerance), `noBlankCanvasCells`.

## Channel tables (`channels.ts`)

Numeric verification independent of pixels: for every canvas cell with a
matching computed-floor capture, the DRAWN node values are read directly off
the compiled spec (bindings resolved through the engine token trees, v14
literals as-is; a spec with `stroke` and no strokeWeight quotes the renderer's
1px default) and tabled against
`extract/computed/out/<component>/captured-truth.json` — the real package's own
computed styles (that one file is both reference columns). Channels: padding
T/R/B/L, four corner radii, background-color, border-width, gap, and
font-size / line-height / color on text nodes. Rows where canvas ≠ captured AND
the contract itself binds the captured value are flagged `EMITTER-DEFECT?` —
the pipeline had the number and dropped or misdrew it.

Capture keys are rebuilt from `extract/computed/configs/polaris.json` axes
(filtered against the CURRENT contract — the config can run ahead during
regeneration), presence segments (`off`), and state segments; both key vintages
are tried against the truth file's roster.

## Outputs (committed)

`examples/polaris/receipts/canvas-gate/`:
- `<component>.scorecard.json` — per-cell rows + summary + acceptance.
- `<component>.channels.md` — the channel tables.
- `<component>--worst.png`, `<component>--representative.png` (median masked
  cell) — side-by-side receipts, labels drawn INTO the image margin with a 5×7
  bitmap font: left `CANVAS ENGINE`, middle `REAL POLARIS`, right `DIFF`
  (pixelmatch bitmap: red = mismatch, yellow = antialiasing), cell name and
  masked % in the footer margin.

## Determinism

Fixed viewport (1000×900), deviceScaleFactor 2, colorScheme light, fonts
awaited (`document.fonts.ready`, Inter availability recorded), infinite
animations pinned at t=0 before every shot, transitions disabled, residual
pointer/focus neutralized per shot, cells captured in sorted order, pages
chunked (80 cells) below Chromium's screenshot ceiling. In-page callbacks are
string evaluates (the tsx `__name` serialization trap — see
visual-parity/render.ts).
