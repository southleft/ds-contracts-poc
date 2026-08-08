# Pinned grammar proposal — `layout.mode: "grid"` (A1 deliverable 2)

*Draft, propose-only. No engine change ships with this document. Every row
below cites the probe fact that makes it expressible (see
`docs/research/grid-recon-probes.md`; probe IDs P1–P14). The grammar is pinned
in the G-row style so A2 implements against fixed spellings rather than
re-deciding them.*

## Scope claim

The grid grammar covers **declared-track grids**: a fixed list of row and
column tracks, explicit (or order-deterministic) child placement, spans, two
gaps, per-child alignment. It deliberately does NOT cover the solver half of
CSS grid (minmax, auto-fit/fill, dense, column flow, subgrid, implicit
tracks) — each is REFUSED by name (G7). This is the same shape as the flex
grammar: canvas-expressible facts carried exactly, everything else named.

## G1 — the layout block

```jsonc
"layout": {
  "display": "grid",                  // joins "flex" | "inline-flex"
  "rows":    [ {"px": 80}, {"fr": 1}, {"fr": 2} ],
  "columns": [ {"px": 160}, {"fr": 1}, {"fr": 1}, {"px": 120} ],
  "gap":     { "row": 12, "column": 16 }   // px numbers or token refs
}
```

- A **track** is exactly one of `{"px": number}`, `{"fr": number}`, or
  `{"fit": true}` — the three spellings the API round-trips (P2/P2b:
  `FIXED` | `FLEX` | `HUG`; HUG's code spelling is `fit-content(100%)`, P14).
  `px`/`fr` values may be fractional (P2b: 33.5px, 2.5fr carried exactly).
  **Zero is invalid** in both (P2b: the API silently normalizes 0px/0fr —
  the schema refuses it so the emitter can never trigger the rewrite).
- Percent tracks, `minmax`, `auto`, and `repeat()` are NOT track spellings —
  refusals, G7.
- `rows`/`columns` are REQUIRED when `display: "grid"` — the declared track
  list IS the contract fact; counts are derived (`rows.length`), never stored
  separately (the API's count-before-sizes ordering, P2, is an emitter
  obligation, not a schema concern).
- `gap.row` / `gap.column` are independent facts (P2: `gridRowGap` /
  `gridColumnGap` are separate) — no single-`gap` shorthand in the contract;
  proposers normalize CSS `gap: 12px 16px` (and one-value `gap: 12px`) into
  the pair.
- `direction` / `justify` / `align` / `wrap` are flex-only fields and are
  schema-invalid together with `display: "grid"`.

## G2 — child placement

On any part whose PARENT declares `display: "grid"`:

```jsonc
"placement": {
  "row": 1, "column": 0,              // 0-based anchor cell
  "rowSpan": 2, "columnSpan": 1,      // default 1
  "alignX": "center", "alignY": "end" // optional; default "auto"
}
```

- Anchors map to `child.setGridChildPosition(row, column)` — the child-side
  setter, the only one that exists (P3). Readback is
  `gridRowAnchorIndex` / `gridColumnAnchorIndex` (read-only getters, P3).
- Spans map to `gridRowSpan` / `gridColumnSpan`. Two hard validations are
  contract-side too: a span may not exceed the declared track count (P3:
  `Column span exceeds grid column count`) and placements+spans may not
  overlap another placed part (P3: occupancy error). The compiler checks both
  BEFORE emitting so the canvas write cannot throw mid-script.
- `alignX`/`alignY` vocabulary: `auto | start | center | end` →
  `AUTO | MIN | CENTER | MAX` (P3/P4: exactly those four; STRETCH/BASELINE
  rejected). CSS side: `justify-self` / `align-self` with `stretch` spelled
  as the ABSENCE of alignment + fill sizing (G3), matching the canvas.
- **Every direct child of a grid part MUST carry `placement`** (manual mode),
  OR none may (auto-flow mode, G5). Mixing is schema-invalid.
- Overlay parts (`Part.overlay`) keep the existing out-of-flow grammar —
  `layoutPositioning: 'ABSOLUTE'` works inside grid parents (P13). A part
  with `overlay` MUST NOT carry `placement`; readers gate anchor reads on
  `layoutPositioning !== 'ABSOLUTE'` (P13 quirk: absolute children still
  report anchors 0,0).

## G3 — sizing inside cells

- Default for a placed part: **fill both axes of its cell area** — canvas
  `layoutSizingHorizontal/Vertical = 'FILL'` (P4), CSS: nothing (stretch is
  the CSS grid default). This is the deliberate common case; the bento
  receipt (P8) uses it throughout.
- A part with fixed `width`/`height` channels keeps them (canvas FIXED +
  `alignX`/`alignY` position it in the cell — P4 geometry verified).
- `hug` sizing only where the existing grammar already allows it: text parts
  and parts that themselves declare a layout (P4: the API enforces exactly
  this).
- `grow` is MEANINGLESS inside a grid parent and schema-invalid there (P4:
  `layoutGrow` is silently accepted by the API with no effect — the schema
  refuses what the platform would silently swallow).
- The grid part itself composes as an ordinary child of a flex parent,
  including `grow`/FILL (P11), and may hug its own content via sizing modes
  (P6).

## G4 — named areas ARE slot anchors

```jsonc
"layout": {
  "display": "grid",
  "rows": [ {"px": 64}, {"fr": 1} ],
  "columns": [ {"px": 240}, {"fr": 1} ],
  "areas": {
    "header":  { "row": 0, "column": 0, "columnSpan": 2 },
    "nav":     { "row": 1, "column": 0 },
    "content": { "row": 1, "column": 1 }
  }
}
```

- Each key of `areas` is simultaneously a **slot name** and a **placement
  rect**: the area name IS the slot anchor. A part (or slot) named `header`
  under this parent takes the area's placement; declaring both an area and an
  explicit `placement` for the same name is schema-invalid (one source of
  truth).
- Area rects use the same fields as G2 placements (row/column/spans) and the
  same validations (bounds, non-overlap).
- CSS side: emitted as `grid-template-areas` + `grid-area: header` when all
  areas tile a rectangle per CSS rules; otherwise lowered to explicit
  `grid-row`/`grid-column` longhands (grid-template-areas cannot express
  non-rectangular or gapped occupancy — a LOWERED disposition, named).
  Canvas side: areas compile to `setGridChildPosition` + spans exactly like
  G2 — Figma has no native area names; the CONTRACT carries the name, both
  surfaces carry the rect. Round trip through canvas preserves names because
  the contract, not the canvas, owns them (same rule as anatomy part names).
- **Slot-scoring convention** (compositions gate on this, so it is part of
  the grammar, not tooling etiquette). **REVISED 2026-08-08 by the native-slots
  round** ([native-slots-proposal.md](./native-slots-proposal.md) §2): the old
  rule scored an empty area by a SHARED PLACEHOLDER on both surfaces — canvas
  dashed frame ↔ code placeholder element. A native Figma slot renders as
  Figma's own thing: an ordinary frame with the contract's part styling, zero
  chrome, and exports carry no slot affordance at all (live probe: an empty
  slot exports as a blank frame). Placeholder-pixel parity is therefore
  impossible BY DESIGN, and the convention becomes **structural, not visual**:
  - An **empty** area/slot scores on PRESENCE + NAME + PLACEMENT BOX — the
    canvas carries a SLOT node named for the area, placed/spanned per the
    contract with the contract's own styling (usually no fill); the code
    carries the placeholder element with the slot class, unchanged. Never
    compare placeholder pixels: there are none on canvas to compare.
  - A **filled** area/slot pins its children on BOTH sides: the same child
    set, same order, contract-identified where they are component instances
    (P12: instances place, span and fill in cells natively). A slot filled on
    one surface and empty on the other is a DIFF, never a normalization.

## G5 — auto-flow (the bounded concession)

```jsonc
"layout": { "display": "grid", "columns": [ {"fr":1},{"fr":1},{"fr":1} ], "flow": "row" }
```

- `flow: "row"` maps to `gridItemsPositioning: 'ROW_AUTO_FLOW'`; placement
  fact = CHILD ORDER (P5: position setters are refused under auto-flow;
  anchors are computed row-major from order — deterministic).
- Allowed ONLY when `rows` is omitted and children fit the declared columns ×
  declared/derived rows... **no**: rows must be derivable as
  `ceil(children / columns.length)` and the emitter declares that many
  explicit row tracks itself, because the API under-reports `gridRowCount`
  for implicitly created rows (P9 — the lossy edge). The contract never
  relies on implicit tracks.
- `flow: "column"` and `flow: "dense"` do not exist (P5 enum) — REFUSED by
  name (G7).

## G6 — obligations per emitter / proposer / differ

| surface | obligation |
|---|---|
| `core/emit-figma-script.ts` | Extend `LayoutSpec` with mode `'GRID'` + tracks/gaps/flow; runtime order is pinned by the API: `layoutMode='GRID'` → `gridRowCount`/`gridColumnCount` (from track list lengths) → `gridRowSizes`/`gridColumnSizes` → gaps → padding → append children → `setGridChildPosition` per child (skip under flow) → spans (place ALL children before ANY span, avoiding the occupancy throw, P3) → `layoutSizingHorizontal/Vertical='FILL'` after append (existing FILL rule) → per-child aligns. Never write 0px/0fr (P2b normalization). Variants: components take GRID directly (P12). |
| `core/emit-html.ts` | `display:grid; grid-template-rows/columns` from tracks (`px`→`Npx`, `fr`→`Nfr`, `fit`→`fit-content(100%)` — P14 exact spelling); `row-gap`/`column-gap`; children get `grid-row: r+1 / span n` / `grid-column` (CSS is 1-based — the +1 is an emitter fact, contracts stay 0-based); areas → `grid-template-areas`+`grid-area` when rectangular, longhands otherwise; `justify-self`/`align-self` for alignX/Y; `grid-auto-flow: row` for G5. |
| `core/emit-react.ts` / `core/emit-react-inline.ts` | Same CSS facts through the module/inline style paths; placeholder slot elements for empty areas per G4's dual convention. |
| `core/propose-figma.ts` (canvas→contract) | Read `layoutMode==='GRID'`: tracks from structured `gridRowSizes`/`gridColumnSizes`, gaps, per-child anchors/spans/aligns (gated on `layoutPositioning!=='ABSOLUTE'`, P13); `ROW_AUTO_FLOW` → `flow:"row"` with placement-from-order; REFUSE by name any grid whose occupied cells exceed declared tracks (P9 detection: max anchor+span vs track count). Area names cannot be read from canvas — propose slots by existing name-matching, placement from rects. |
| `core/propose-code.ts` (code→contract) | Parse `grid-template-columns/rows` into the three track spellings; `repeat(N, X)` expands when N is an integer literal; `minmax`, `auto-fit/fill`, `%`, `auto`, `subgrid`, `dense`, column flow → REFUSED with the construct name in the refusal (never a silent drop). `gap` shorthand → the pair. `grid-template-areas` → G4 `areas` (names carried INTO the contract — this is where names enter). |
| `extract/figma/dump.plugin.js` | dump v1.next: when `mode:'GRID'`, the flex-era fields (`primary`, `counter`, `spacing`) are NOT emitted (they read as defaults on GRID frames and would be invented facts); emit `grid: { rows, columns, rowGap, columnGap, flow }` + per-child `cell: { row, column, rowSpan, columnSpan, alignX, alignY }`; named degrade `grid-implicit-tracks-lossy` when anchors exceed declared tracks (P9); keep the ABSOLUTE gate for overlays. |
| differ / round-trip (`core/channel-diff.ts`, `core/anatomy-diff.ts`) | New fact classes: `grid-track-list` (ordered, typed — a track edit is ONE fact, a reorder is a different fact), `grid-gap` (×2), `grid-placement` (per part: anchor+span), `grid-align` (per part), `grid-area-map` (name→rect), `grid-flow`. `layout.mode` change (grid↔flex) is a STRUCTURAL diff that invalidates all track/placement facts explicitly (P10: the canvas physically destroys tracks on mode switch — the differ must surface that as loss, never absorb it). |

## G7 — refusals by name (the fence)

Each refusal cites its probe dead-end; these become conformance cases
(deliverable 3):

| name | construct | probe fact |
|---|---|---|
| `grid-track-percent` | `50%` track | P2b enum: FLEX/FIXED/HUG only |
| `grid-track-minmax` | `minmax(100px, 300px)` | P6: `Unrecognized key(s) 'min','max'` |
| `grid-auto-fit-minmax` | `repeat(auto-fit, minmax(...))` | no API surface; a responsive track COUNT is a reflow family one frame cannot carry |
| `grid-flow-column` | `grid-auto-flow: column` | P5: `COLUMN_AUTO_FLOW` rejected |
| `grid-flow-dense` | `grid-auto-flow: dense` | P5: `DENSE` rejected; solver output, not declared fact |
| `grid-subgrid` | `grid-template-columns: subgrid` | no property in the reflected inventory (P1) |
| `grid-implicit-tracks` | placement beyond declared tracks / `grid-auto-rows` reliance | P9: readback lossy (anchors exceed rowCount) |
| `grid-align-stretch-keyword` | explicit `justify-self: stretch` as an ALIGN fact | P3: STRETCH rejected — stretch is spelled as fill sizing (G3), the keyword itself is normalized, and the normalization is named LOWERED, not silent |
| `grid-baseline-align` | `align-self: baseline` in grid | P3: BASELINE rejected |
| `grid-negative-line` | `grid-column: -1` etc. | no negative-index concept in anchor API; proposer lowers resolvable negatives to absolute indexes (LOWERED), refuses unresolvable ones |

## Disposition summary

CARRIED: declared px/fr/fit tracks (fractional ok), row+column gaps, explicit
anchors, row/column spans, per-child align (4-value), fill/fixed/text-hug cell
sizing, named areas (as contract-owned slot anchors), row auto-flow with
derivable rows, grid-on-component/variant, instance children, absolute
overlays, grid-in-flex composition, padding on grid frames.
LOWERED: `gap` shorthand → pair; non-rectangular areas → longhands; stretch
keyword → fill sizing; resolvable negative lines → absolute indexes;
integer-literal `repeat()` → expanded list.
REFUSED by name: G7 table.
