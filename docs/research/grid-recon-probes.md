# Grid recon probes — empirical Plugin API findings (A1)

*Run 2026-08-08 against the live playground file via figma-console Desktop Bridge
(`figma_execute`, fileKey passed explicitly on every call).*

- **File**: `Latest DS Contracts Tests` — fileKey `BMjUA2ue5CaZXU4kufxL0z` (verified
  via `figma_list_open_files` before the first write)
- **Where**: everything lives inside section **"Grid Recon Probes"** (`4:1107`,
  page `Avatar`, placed at y=500 below existing content)
- **Receipts**: `docs/research/assets/grid-recon/*.png` (REST image export of each
  probe frame; `p8-bento-roundtrip.png` is the headline receipt)
- **Editor**: `figma.editorType = "figma"`, `figma.apiVersion = "1.0.0"`

## Verdict

**`layoutMode: "GRID"` EXISTS on FrameNode and is round-trip readable. Grid is
carriageable: PARTIAL — declared-track grids with explicit placement, spans,
gaps, per-child alignment and fill sizing read back EXACTLY; the responsive/solver
half of CSS grid (minmax, auto-fit/auto-fill, percent tracks, dense flow, column
flow, subgrid) has no API surface and each dead end is named below with its exact
error.**

The `grid-2d` REFUSED disposition in `spec/conformance/subset-v0.1.json` was
recorded against a Figma that had no grid. That Figma no longer exists. Opening
the channel is now an engine question, not a platform question.

## Property inventory (discovered by reflection, then exercised)

Frame (parent) properties:

| property | type / values | probed |
|---|---|---|
| `layoutMode` | accepts `'GRID'`, reads back `'GRID'` | P1 |
| `gridRowCount` / `gridColumnCount` | number, settable; growing count appends `{FLEX,1}` tracks | P2c |
| `gridRowSizes` / `gridColumnSizes` | `Array<{type:'FIXED'|'FLEX'|'HUG', value:number}>` — **only** those three types | P2, P2b |
| `gridRowGap` / `gridColumnGap` | number px, independent | P2 |
| `gridRowSizingCSS` / `gridColumnSizingCSS` | read-only CSS string (e.g. `"200px minmax(0,1fr) minmax(0,2fr)"`) | P2 |
| `gridAutoTracks` | `'NONE' | 'ROWS'` only | P5 |
| `gridItemsPositioning` | `'MANUAL' | 'ROW_AUTO_FLOW'` only | P5, P5b |
| `paddingTop/Right/Bottom/Left` | work on GRID frames | P7 |
| `primaryAxisSizingMode` / `counterAxisSizingMode` | `AUTO` (hug) accepted on GRID frames | P6 |
| `gridStyleId` / `setGridStyleIdAsync` / `layoutGrids` | legacy layout-grid *overlay* styles — unrelated to GRID layout mode; not probed further | — |

Child properties (on any child of a GRID frame):

| property | type / values | probed |
|---|---|---|
| `gridRowAnchorIndex` / `gridColumnAnchorIndex` | number, **read-only getters** (direct set throws `TypeError: ... which has only a getter`) | P3 |
| `child.setGridChildPosition(rowIndex, columnIndex)` | the ONE placement setter — a method **on the child**, not the parent (calling it on the parent throws `Node is not a grid child`) | P3, P3b |
| `gridRowSpan` / `gridColumnSpan` | number, settable, **validated against occupancy and track count** | P3 |
| `gridChildHorizontalAlign` / `gridChildVerticalAlign` | `'AUTO' | 'MIN' | 'CENTER' | 'MAX'` (no STRETCH — AUTO is the stretch-ish default; alignment has real geometric effect, verified by x/y readback) | P3, P4 |
| `layoutSizingHorizontal/Vertical` | `FILL` works (fills the cell); `HUG` only on auto-layout frames or TEXT children (same rule as flex) | P4 |
| `minWidth` / `maxWidth` | settable on children inside grid | P6 |

## Probes, executed code, read-back verbatim

### P1 — existence + defaults (`4:1108`)

```js
const f = figma.createFrame();
f.layoutMode = 'GRID';           // no throw
f.layoutMode;                    // → 'GRID'
```

Fresh-grid defaults read back:

```json
{"rowCount":2,"colCount":2,"rowGap":0,"colGap":0,
 "rowSizes":[{"type":"FLEX","value":1},{"type":"FLEX","value":1}],
 "colSizes":[{"type":"FLEX","value":1},{"type":"FLEX","value":1}],
 "rowSizingCSS":"repeat(2,minmax(0,1fr))","colSizingCSS":"repeat(2,minmax(0,1fr))",
 "autoTracks":"NONE","itemsPositioning":"MANUAL",
 "primaryAxisSizing":"FIXED","counterAxisSizing":"FIXED"}
```

Grid-named properties found by prototype reflection: `gridAutoTracks,
gridChildHorizontalAlign, gridChildVerticalAlign, gridColumnAnchorIndex,
gridColumnCount, gridColumnGap, gridColumnSizes, gridColumnSizingCSS,
gridColumnSpan, gridItemsPositioning, gridRowAnchorIndex, gridRowCount,
gridRowGap, gridRowSizes, gridRowSizingCSS, gridRowSpan, gridStyleId,
layoutGrids, setGridChildPosition, setGridStyleIdAsync`.

### P2 — mixed fixed + flexible tracks (`4:1109`)

**Ordering invariant (a real trap):** `gridColumnSizes` must match the CURRENT
count — setting a 3-element array while `gridColumnCount` is 2 throws:

> `Error: in set_gridColumnSizes: Grid track sizes must be the same length as the grid column count`

Count first, then sizes:

```js
p2.gridColumnCount = 3;
p2.gridColumnSizes = [{type:'FIXED',value:200},{type:'FLEX',value:1},{type:'FLEX',value:2}];
p2.gridRowSizes    = [{type:'FIXED',value:48},{type:'FLEX',value:1}];
p2.gridColumnGap = 16; p2.gridRowGap = 8;
```

Read-back: cols `[{FIXED,200},{FLEX,1},{FLEX,2}]`, CSS `"200px minmax(0,1fr)
minmax(0,2fr)"`; rows `[{FIXED,48},{FLEX,1}]`, CSS `"48px minmax(0,1fr)"`;
gaps `16 / 8`. **Exact.** Mixed px+fr is native.

### P2b — track-type frontier (`4:1110`)

| tried | result |
|---|---|
| `{type:'HUG'}` | ok — reads back `{type:'HUG',value:1}` (value is noise) |
| `{type:'AUTO'}` | **REFUSED**: `Invalid enum value. Expected 'FLEX' | 'FIXED' | 'HUG', received 'AUTO'` |
| `{type:'PERCENT',value:50}` | **REFUSED**: same enum error, `received 'PERCENT'` |
| `{type:'FIXED',value:0}` | accepted but **NORMALIZED** — read back as `{FIXED,200}` (snapped to the track's current rendered px). Silent rewrite; an emitter must never write FIXED 0. |
| `{type:'FLEX',value:0}` | accepted but **NORMALIZED** to `{FLEX,1}` (clamped). Same rule: never write 0fr. |
| `{type:'FLEX',value:2.5}` | ok, exact — fractional fr carried |
| `{type:'FIXED',value:33.5}` | ok, exact — subpixel px carried |

### P2c — counts drive sizes (`4:1111`)

`gridColumnCount = 4` on a default 2×2 grid → `gridColumnSizes` becomes four
`{FLEX,1}` tracks; CSS `repeat(4,minmax(0,1fr))`. Growing the count appends
1fr tracks; it never invents FIXED ones.

### P3 — placement + spans (`4:1118`)

- Children appended to a MANUAL grid auto-slot into the first free cell in
  row-major order (a→(0,0), b→(0,1)) — deterministic.
- Anchors are **read-only**; the setter is on the **child**:
  `b.setGridChildPosition(2, 1)` → `row=2 col=1` reads back exactly.
  (`p3.setGridChildPosition(b,2,1)` throws `Node is not a grid child` —
  first arg is rowIndex; the parent is not a grid child.)
- `a.gridRowSpan = 2` → ok, reads 2.
- **Span occupancy is validated**: `a.gridColumnSpan = 2` with a child in the
  adjacent cell throws
  `Cannot set child to specified column span due to existing children in adjacent columns`.
  An emitter must place-then-span in dependency order (or place spanning
  children first).
- **Span > track count is refused**: `b.gridColumnSpan = 5` on a 3-col grid
  throws `Column span exceeds grid column count`.
- Align enums: MIN/CENTER/MAX/AUTO ok; `STRETCH` and `BASELINE` **refused**
  (`Invalid enum value`).

### P4 — child sizing inside a grid cell (`4:1121`)

- `layoutSizingHorizontal = 'FILL'` and `Vertical = 'FILL'` — ok; child fills
  its cell (500×240 grid, 2×2, gap 10 → child reads 245×115: exactly
  (500−10)/2 × (240−10)/2).
- `HUG` on a plain (non-auto-layout) frame child throws
  `HUG can only be set on auto-layout frames or text children of auto-layout frames`
  — same rule as flex; note the error message says "auto-layout" but applies
  inside GRID parents too.
- `HUG` on a TEXT child — ok (`w=43` hugging "hug me").
- `layoutGrow = 1` on a grid child is **silently accepted** (no throw, no
  layout effect observed) — a silent-accept hazard: the differ must not read
  `layoutGrow` as a grid fact.
- Alignment has real geometry: FIXED child at cell (0,1), `hAlign CENTER` +
  `vAlign MAX` moved x 255→327.5, y 0→15 — and both enums read back.

### P5/P5b — auto placement (`4:1126`)

- `gridItemsPositioning`: exactly `'MANUAL' | 'ROW_AUTO_FLOW'`.
  `COLUMN_AUTO_FLOW`, `AUTO_FLOW`, `AUTO`, `DENSE` all throw the enum error.
  **There is no column flow and no dense packing.**
- Under `ROW_AUTO_FLOW`, children still REPORT anchors (computed row-major
  from child order) but `setGridChildPosition` throws:
  `cannot set grid child position directly inside of a grid with automatically positioned items, use parent.insertChild() instead`.
  Placement fact = child order, not coordinates.
- `gridAutoTracks`: exactly `'NONE' | 'ROWS'`.

### P8 — canonical bento round-trip (`4:1134`) — THE carriage receipt

Wrote a 3×4 grid, rows `[80px,1fr,2fr]`, cols `[160px,1fr,1fr,120px]`, gaps
12/16, five FILL children: header (0,0 span 1×4), sidebar (1,0 span 2×1),
main (1,1 span 1×2), rail (1,3 span 2×1), footer (2,1 span 1×2).

**Read-back: every track type/value, both gaps, every anchor, every span,
every sizing mode came back EXACTLY as written (`p8Match: true`).** Resolved
geometry confirms the math (sidebar 160×328 at x=0,y=92; main 408 wide =
2·1fr + 16 gap; footer h 210.67 = 2fr of the free space). Screenshot receipt:
`assets/grid-recon/p8-bento-roundtrip.png` — renders as specced.

### P9 — implicit-track overflow (`4:1140`) — the lossy edge

- MANUAL + `gridAutoTracks NONE`, 2×2, append a 5th child: Figma **grows the
  explicit `gridRowCount` to 3** and materializes a real `{FLEX,1}` track.
  Overflow is absorbed by rewriting the declaration — a write your contract
  did not make.
- ROW_AUTO_FLOW with 8 children over 2 columns: children read anchors up to
  **row 3** while `gridRowCount` still reads **3** (rows 0..2) and
  `gridRowSizes` has 3 entries. **The declared track list and the occupied
  cells disagree — implicit auto-placement readback is LOSSY.** This is the
  probe fact behind refusing implicit-track auto-placement.

### P10 — mode-switch destruction (`4:1149`)

`GRID` (3 cols `[60px,1fr,2fr]`) → `layoutMode='HORIZONTAL'`:
`gridColumnSizes` reads `[]`. → back to `'GRID'`: count resets to 2, sizes
`[{FIXED,60},{FLEX,1}]` — **the third track is gone**. Round-tripping through
a mode switch is destructive; the differ must treat `layout.mode` change as
loss of all track facts, never silent.

### P11 — grid inside auto-layout (`4:1150`)

A GRID frame nested in a VERTICAL auto-layout parent takes
`layoutSizingHorizontal='FILL'` (w 100→400 = parent width). Grid frames
compose into the existing flex grammar as ordinary children.

### P12 — components and instances (`4:1151` area)

- `figma.createComponent()` + `layoutMode='GRID'` + tracks — **ok** (canvas
  variants can BE grids).
- An INSTANCE appended as a grid child takes `setGridChildPosition(0,1)` and
  `FILL` — **ok** (contract-identity children slot into cells).

### P13 — absolute overlay inside grid

`layoutPositioning='ABSOLUTE'` on a grid child — ok, x/y honored (existing
overlay grammar survives). **Quirk:** the absolute child still *reports*
`gridRowAnchorIndex 0 / gridColumnAnchorIndex 0`; readers must gate anchor
reads on `layoutPositioning !== 'ABSOLUTE'` exactly as the dump already gates
the `abs` channel.

### P14 — HUG track semantics

`gridColumnSizes = [{type:'HUG'},{type:'FLEX',value:1}]` → CSS reads
`"fit-content(100%) minmax(0,1fr)"`. **A HUG track is CSS
`fit-content(100%)`** — that is its exact code spelling.

## What the two readers see today

**REST file endpoint** (`GET /v1/files/:key/nodes?ids=4:1134`, verified live):
carries the FULL grid grammar — `layoutMode:"GRID"`, `gridColumnCount`,
`gridRowCount`, `gridRowGap`, `gridColumnGap`, `gridAutoTracks`,
`gridItemsPositioning`, and per-child `gridRowAnchorIndex`,
`gridColumnAnchorIndex`, `gridRowSpan`, `gridColumnSpan`,
`gridChildHorizontalAlign`, `gridChildVerticalAlign`, `layoutSizingHorizontal/
Vertical`. **One REST divergence:** track sizes come ONLY as CSS strings named
`gridColumnsSizing` / `gridRowsSizing` (note the different spelling from the
plugin's `gridColumnSizingCSS`) — there is no structured sizes array over
REST; a REST reader must parse `"160px minmax(0,1fr) 120px"`.

**`extract/figma/dump.plugin.js`** (layout branch, line ~569): a GRID frame
passes the `layoutMode !== 'NONE'` guard and dumps `mode:'GRID'` with the
FLEX-era fields — `primaryAxisAlignItems:'MIN'`, `itemSpacing:0`, paddings,
sizing modes (all read without throwing on a GRID frame; verified) — and
**captures zero grid facts**. The dump grammar needs a `grid` extension:
tracks (structured, from `gridRowSizes`/`gridColumnSizes`), both gaps,
`gridItemsPositioning`, and a per-child placement channel
(anchor/span/align, gated on `layoutPositioning !== 'ABSOLUTE'`), plus a
named degrade for `ROW_AUTO_FLOW` grids whose occupied rows exceed the
declared track list (P9).

## Dead ends (each with its exact refusal)

| construct | API result |
|---|---|
| percent tracks | enum error: `Expected 'FLEX' | 'FIXED' | 'HUG', received 'PERCENT'` |
| `minmax(min, max)` per track | `Unrecognized key(s) in object: 'min', 'max'` on `gridColumnSizes` |
| `auto-fit` / `auto-fill` | no API surface at all (track count is a fixed number; no repeat-to-fit concept) — a viewport-responsive track COUNT cannot exist in one frame |
| `grid-auto-flow: column` | enum error on `gridItemsPositioning` (`COLUMN_AUTO_FLOW` rejected) |
| `grid-auto-flow: dense` | enum error (`DENSE` rejected) |
| subgrid | no property anywhere in the reflected inventory |
| `justify-items: stretch` per child | `STRETCH` rejected on `gridChildHorizontalAlign` (stretch is expressed as child `FILL`, not parent align) |
| baseline alignment in grid | `BASELINE` rejected |
| track write of `0px` / `0fr` | silently NORMALIZED (200px snap / 1fr clamp) — a write hazard, not a carry |
| implicit tracks under auto flow | anchors exceed declared `gridRowCount` — lossy readback (P9) |
| mode switch preserving tracks | destructive (P10) |

## Honest fallback frontier (for pre-GRID surfaces or refused cases)

Where grid is refused or unavailable, auto-layout composition still expresses
deterministically: two-column via HORIZONTAL parent + `[FIXED sidebar, FILL
main]` siblings; stacked rows via VERTICAL parent of HORIZONTAL rows (each row
a track, but NO cross-row track alignment — column edges in different rows are
independent, which is exactly why grid-2d was refused before GRID existed);
equal-cell galleries via `layoutWrap: 'WRAP'` with fixed-size children (no
per-cell spans). Anything needing cross-row column alignment or spans has no
faithful flex fallback and stays REFUSED on such surfaces.
