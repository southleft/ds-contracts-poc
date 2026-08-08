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

---

# AMENDMENTS — the composition round (2026-08-08)

*The five-stem composition corpus
([docs/composition-corpus/README.md](../composition-corpus/README.md)) measured
seven things the pinned grammar above could not express. This section decides
each one, in the same propose-then-implement order G1–G7 followed: every row
carries the probe that makes it expressible or the probe that kills it. New
probes are **GP1–GP15**, run 2026-08-08 against the live playground file
`BMjUA2ue5CaZXU4kufxL0z` ("Latest DS Contracts Tests") via the Desktop Bridge
`figma_execute` with `fileKey` passed explicitly. GP1–GP13 are synthetic frames
built in a scratch section **Grammar Probes** (removed after measurement);
GP14–GP15 are the REAL emitted corpus components, rebuilt fresh in the
**Composition Corpus** section — the difference matters, because GP14 is a
defect no synthetic frame exposed. The read-back tables below ARE the receipt.*

## GP — the amendment probes, read-back verbatim

GP1–GP13 are `layoutMode:'GRID'` frames with zero gaps. `lsV` /`lsH` are
`layoutSizingVertical` / `Horizontal`.

| probe | setup | write | read-back |
|---|---|---|---|
| **GP1** | rows `[80px,1fr,2fr]`, cols `[160px,1fr,1fr,120px]`, 640×480 | `lsV='HUG'` | rows → **`[FIXED:80, HUG:1, HUG:1]`**, rowCSS `80px 200.00px 200.00px`; cols UNTOUCHED; h stays 480. **The `fr` ratio is destroyed, silently, no throw.** |
| **GP1b** | same | `primaryAxisSizingMode='AUTO'` then `counterAxisSizingMode='AUTO'` | rows SURVIVE `[FIXED:80, FLEX:1, FLEX:2]`; `lsH`/`lsV` both read `'HUG'`; **w/h stay 640×480 — the frame does not hug.** The sizing-mode properties are INERT on GRID: the node reports HUG and behaves FIXED. |
| **GP2** | rows `[HUG]`, cols `[1fr,1fr]`, 640×100, two 23px children | `lsV='HUG'` | **h 100 → 23**; rows `[HUG:1]` intact; cols `[FLEX:1,FLEX:1]` intact. |
| **GP3** | rows `[24px]`, cols `[1fr,1fr]`, 640×100 | `lsV='HUG'` | **h 100 → 24**; rows `[FIXED:24]` intact; cols intact. |
| **GP4a** | fresh grid, `lsV='HUG'` FIRST, then write tracks | tracks after hug | tracks written after the hug stick (`[HUG:1]`), and the frame hugs once children land (h → 23). Order is not the problem. |
| **GP4b** | rows `[HUG]`, children, `lsV='HUG'` (h → 23), **then `resize(640,400)`** | resize after hug | **`lsV` → `FIXED`, rows → `[FLEX:1]`.** A later `resize()` of a hugged axis silently reverts BOTH the sizing mode and the track list. |
| **GP4c** | same, then `resize(800, f.height)` | width-only resize | hug SURVIVES (`h` 23, rows `[HUG:1]`). Only a resize that changes the hugged axis clobbers it. |
| **GP5** | rows `[HUG, 1fr]` (MIXED) | `lsV='HUG'` | rows → **`[HUG:1, HUG:1]`** — the single `fr` row destroyed. One `fr` track on the axis is enough. |
| **GP8** | 640×480, `lsV='HUG'` FIRST, then write rows `[80px,1fr,2fr]` | tracks after hug | rows SURVIVE `[FIXED:80,FLEX:1,FLEX:2]`, `lsV` reads `'HUG'`, **h stays 480 and never hugs** — the same lying state as GP1b. |
| **GP9** | rows `[HUG]`, children set `layoutSizing{H,V}='FILL'` (the G3 default) | `lsV='HUG'` | **h → 23, children stay 23 and stay `FILL`.** A FILL child inside a HUG track does NOT collapse — G3's default and an intrinsic axis compose. |
| **GP10** | flow `ROW_AUTO_FLOW`, cols `[1fr,1fr]`, rows `[16px,16px]`, **5** children | append | anchors `0,0 / 0,1 / 1,0 / 1,1 / **2,0**` while `gridRowCount` stays **2** and `gridRowSizes` stays 2 entries. **P9 lossy overflow, reproduced under declared rows.** |
| **GP11** | `figma.createComponent()` + GRID, rows `[HUG]` | `lsV='HUG'` | h → 23, tracks intact. Hug works on COMPONENT roots, not just frames (P12's sibling). |
| **GP12** | rows `[24px]`, cols `[1fr,1fr]` | `lsH='HUG'` | cols → **`[HUG:1,HUG:1]`**, w 640 → 40. The destruction is symmetric across axes. |
| **GP13** | rows `[HUG]`, cols `[100px,HUG]` — no `fr` anywhere | `lsH='HUG'; lsV='HUG'` | w → 120, h → 40, **both track lists intact**. Both axes may hug when neither carries `fr`. |
| **GP6** | flow `ROW_AUTO_FLOW`, cols `[1fr,1fr]`, rows **`[16px,16px]` declared**, 3 children | — | rows read back **`[FIXED:16, FIXED:16]`** exactly; `gridItemsPositioning` `ROW_AUTO_FLOW`; anchors `0,0 / 0,1 / 1,0`. **Declared row sizes and row auto-flow COEXIST natively.** |
| **GP6b** | same, rows written AFTER `gridItemsPositioning` | — | identical read-back. Order-insensitive. |
| **GP7** | flow, cols `[1fr,1fr,1fr]`, rows `[HUG,HUG]`, 6 children | `lsV='HUG'` | h 200 → 60, rows `[HUG:1,HUG:1]` intact, cols intact, anchors row-major over both rows. **Flow + declared rows + an intrinsic axis compose.** |
| **GP14** | the REAL emitted `ds.two-column`: hugging root, two native SLOT children left at G3's `FILL` default | build + read back | root reports `lsV: 'HUG'` and rows `[HUG:1]` — **and stays 640×100.** The instant the children stopped filling, the root collapsed to the true content height; restoring `FILL` did not undo it. **FILL on a hugged axis is CIRCULAR — the track sizes from the child and the child sizes from the track — and Figma resolves the loop by FREEZING the stale box.** |
| **GP15** | same root, children switched to `HUG`, slots then filled with the pinned `ds.badge` | build + fill | empty: 640×100 (an empty auto-layout SLOT has no content to hug and keeps Figma's own minimum). **Filled: 640×23 — the CSS box exactly.** Sidebar-layout 640×23 with `[FIXED:240, FLEX:1]` intact; gallery 640×62 (23 + 16 gap + 23) with `[HUG,HUG]` rows under flow. Bento and page-shell unchanged at 640×480 with `[FIXED:80, FLEX:1, FLEX:2]` intact. |

---

## G8 — an intrinsically-sized axis IS a contract fact, and it is `fit-content`

**The gap** (corpus finding 1, defect **FC-GRID-ROOT-VSIZE**): `{fit:true}`
sizes a TRACK; nothing said "this component's height hugs its content".
Absence resolved as FIXED 100 on canvas and content-height in CSS — two
answers, no fact to arbitrate. It cost `ds.two-column`, `ds.sidebar-layout`
and `ds.grid-gallery` their structural pass.

**The decision: no new field.** The grammar already owns this fact —
`literals.height: "fit-content"` is a legal Part literal today
(`LITERAL_CHANNELS` carries `width`/`height`; `LITERAL_VALUE_RE` admits
`fit-content`), it is already the CSS truth, and the canvas→contract reader
already MINTS it: `invertRootFixedSize` writes `root.literals[dim] =
'fit-content'` for an all-HUG root, calling it "the CSS twin of Figma HUG". A
new `layout.hug` field would be a SECOND spelling for a fact the grammar has,
and two spellings for one fact is the disease this round exists to cure. What
was missing was never the spelling; it was that **the canvas emitter dropped
it on the grid path** — `isHugKeyword` deliberately carries nothing, which is
right for flex (where `primary/counterAxisSizingMode='AUTO'` already means
hug) and wrong for grid (where those two properties are INERT, GP1b/GP8, and
`createFrame`'s FIXED 100 stands).

```jsonc
"root": {
  "layout": { "display": "grid", "rows": [{"fit": true}], "columns": [{"fr":1},{"fr":1}] },
  "literals": { "width": "640px", "height": "fit-content" }
}
```

### G8.1 — every axis of a grid part MUST be definite

Absence is what made the two surfaces disagree, so absence stops being legal.
On a part declaring `display: "grid"`, each axis carries exactly one of:

| spelling | canvas | CSS |
|---|---|---|
| `literals.width/height: "<n>px"` (or a `tokens.width/height` ref) | `resize()` + `FIXED` | `width`/`height: <n>px` |
| `literals.width/height: "fit-content"` | `layoutSizing{Horizontal,Vertical} = 'HUG'` (GP2/GP3/GP13) | `width`/`height: fit-content` |
| `layout.grow` (width only, flex parent) | `layoutSizingHorizontal = 'FILL'` (P11) | `flex: 1 1 auto` |

An axis with none of these is schema-invalid, refused by the name
**`grid-axis-indefinite`** — the refusal text names FC-GRID-ROOT-VSIZE so the
message is greppable back to the corpus receipt that found it.

### G8.2 — `fit-content` on an axis carrying an `fr` track is REFUSED, permanently

This is the finding the round was told to look for, and the answer is **no
write order preserves both**:

- hug AFTER tracks → the `fr` tracks normalize to HUG and the ratio is gone
  (GP1, GP5, GP12) — silently, with no throw;
- hug BEFORE tracks → the `fr` tracks survive, `layoutSizing*` reports `'HUG'`,
  and the frame **does not hug**: 640×480 stays 640×480 (GP8). Setting
  `primary/counterAxisSizingMode = 'AUTO'` directly is the same lying state
  (GP1b). A node that reports HUG and behaves FIXED is worse than the defect,
  because the readback lies to the differ.

The two are contradictory by construction, and **CSS agrees**: `1fr` resolves
against a definite size; under `height: auto` the `fr` rows are content-sized
and the ratio does not hold either. So this is not a platform gap to route
around — it is a fact that does not exist on either surface.

**REFUSED by name: `grid-hug-flex-axis`** (G7 row added below). The refusal
fires contract-side, before emission, so the silent rewrite can never be
triggered — the same rule as `grid-track-zero`.

### G8.3 — the write-order obligation (GP4b)

`resize()` on a hugged axis silently reverts BOTH the sizing mode and the
track list (GP4b: `lsV` HUG → FIXED and `[HUG:1]` → `[FLEX:1]`). A width-only
resize leaves a hugged height alone (GP4c). Therefore the emitter's pinned
order gains one step at the very END:

> `layoutMode='GRID'` → counts → sizes → gaps → flow → **`resize()`** →
> append children → placements → spans → FILL → aligns → **hug**

The hug write is the LAST thing that touches a grid frame. `applyGridHug` runs
after `applyGridChildren` for exactly this reason.

### G8.4 — G3 survives it

A grid child set to `FILL` on both axes inside a HUG track does **not**
collapse: the track takes the child's own measure and the child keeps `FILL`
(GP9, GP9b). The G3 default and an intrinsic axis compose without a special
case. (The headless mock modelled a FILL child as contributing ZERO to an
intrinsic measure — true for flex, false here; the mock is corrected to the
canvas.)

---

## G3′ — a child never FILLS an axis its grid parent HUGS

**Found by building the real thing** (GP14). G8's emitter half looked right and
read back right — `layoutSizingVertical: 'HUG'`, row track `HUG` — and the
component still measured 640×100. G3's default is that a placed part fills both
axes of its cell; on a hugged axis that makes the track's size a function of the
child and the child's size a function of the track. **Figma resolves the loop by
freezing whatever box the node already had**, so the readback reports a hug that
never happened. A frozen box is worse than a wrong one: it is a stale number
that reads as a measurement, and every headless instrument would have believed
it.

**Amended G3:** on an axis the grid part declares intrinsic, in-flow children
take **HUG**, never `FILL`. Their content is precisely what the track has to
measure. A non-auto-layout frame refuses HUG (P4) and keeps its drawn box —
which is the correct contribution, not a failure. The other axis is untouched:
a two-column root hugging its height still FILLs its children horizontally.

**CSS agrees, and this is why the rule is not a canvas workaround:** against a
`fit-content` track, `align-self: stretch` resolves to the content size — the
track is sized from content FIRST and the child stretches into the result. CSS
simply has no circularity to resolve because it orders the two steps; the canvas
has one property doing both jobs, so the contract must order them.

## G8.5 — an EMPTY intrinsic axis has no measure on either surface

The same build (GP15) settles what an empty composition means. With the pinned
child in every slot, the hugging root measures **640×23 on canvas and 640×23 in
CSS** — the same number, which is the whole point of G8. With every slot EMPTY,
the canvas reports 640×100 and CSS reports 640×0: an empty auto-layout SLOT
keeps Figma's own minimum for an empty frame, an empty `<div>` in a
`fit-content` row is zero. Neither is a contract fact; both are each surface's
convention for "there is nothing here".

So the corpus's structural convention gains one line, and it makes the
instrument **stronger**, not more forgiving:

> On an axis the contract declares intrinsic, the resulting GEOMETRY is scored
> on the FILLED surface, where content exists to measure. The EMPTY score keeps
> presence, name, and the cell RECT (anchor + span), which are contract facts
> and are surface-independent, and drops only the hugged axis's pixel height —
> a comparison of two emptiness conventions, which is what the convention
> already refuses to do for placeholder pixels (G4).

Making the empty canvas box match by explicitly resizing empty slots to zero was
considered and refused: it is the emitter inventing a size to satisfy a scorer,
which is the class of repair this project exists to catch.

## G5′ — auto-flow MAY declare its rows (amends G5)

**The gap** (corpus finding 2, and the declared-red conformance case
`grid-auto-flow-row`): G5 required `rows` OMITTED under `flow: "row"`, so a
flow grid whose author declared row sizes had nowhere to put them. The reader
therefore admitted flow ONLY when the drawn rows already equalled the
emitter's derivation (`ceil(children/columns) × {fr:1}`), and refused
everything else rather than silently redraw the tracks. That restriction was
**over-conservative, and the probe says so**.

**GP6/GP6b: `gridItemsPositioning = 'ROW_AUTO_FLOW'` and declared
`gridRowSizes` coexist natively.** Two 16px FIXED rows under flow read back
exactly, in either write order, with anchors computed row-major from child
order exactly as P5 describes. Nothing in the API couples the flow enum to the
track list; G5's rule was inferred from P9 (which is about OVERFLOW) and
over-applied.

**Amended G5:**

```jsonc
"layout": { "display": "grid", "columns": [{"fr":1},{"fr":1},{"fr":1}],
            "flow": "row", "rows": [ {"fit":true}, {"fit":true} ] }
```

- `rows` MAY be declared under `flow: "row"`. When declared they are the
  contract fact and are written verbatim; the emitter derives nothing.
- When `rows` is OMITTED the emitter derives `ceil(inFlowChildren /
  columns.length) × {fr:1}` and declares them explicitly, exactly as before —
  the old behaviour is the default, so no existing flow contract moves.
- **Bound:** `rows.length >= ceil(inFlowChildren / columns.length)`. Below
  that, children flow past the declared list — GP10 measured anchors reaching
  row 2 while `gridRowCount` stayed 2 and `gridRowSizes` stayed two entries,
  which is P9's lossy readback reproduced under declared rows. Under-declared
  rows are refused by the existing name **`grid-implicit-tracks`**.
- `areas` stays refused under flow (unchanged): an area IS an explicit
  placement, and placement under flow is child order.

**Consequence for the corpus:** `ds.grid-gallery` can now state its row sizing
(`[{fit:true},{fit:true}]` — two content rows), which is also what lets it take
G8's `height: fit-content`: derived `{fr:1}` rows would have hit
`grid-hug-flex-axis`. The grammar's own rule was the thing creating corpus
finding 2's ambiguity ("`fr` requires a definite size and the grammar cannot
demand one"); with G5′ the contract simply declares rows that need none.

**Conformance:** `grid-auto-flow-row` moves from declared-red to **CARRIED**,
with its `observedCheck` pin removed on both sides.

---

## G9 — `abs` → `Part.overlay` is REFUSED BY NAME, PERMANENTLY; the grid is not

**The gap** (declared-red conformance case `grid-absolute-overlay`): an
absolutely-placed child in a grid cell refused **the whole grid**. The dump
gate is correct — P13's absolute child carries `abs` and NO `cell`, so no 0,0
placement is invented — but the proposer then dropped `display:"grid"`, every
track, and every SIBLING's placement, because it has no `abs`→`overlay`
inversion.

Two separable questions were tangled together. They get separate answers.

### G9.1 — the edge inversion: REFUSED, permanently, on arity

`OverlaySchema` is `{ placement: "top" | "bottom" | "start" | "end" }` — four
values, **no offsets**, and its documented meaning is "attached to one edge of
the ROOT". The canvas fact is a point in ℝ² inside a CELL (`abs.x`, `abs.y`,
plus `right`/`bottom`/`width`/`height`), optionally qualified by a 3×3
constraints lattice. Every total map from that source to that target either

- **drops both offsets** — an overlay at (4,4) in a 24px cell is redrawn flush
  against an edge, a silent geometry rewrite of exactly the kind G7 exists to
  prevent; or
- **invents an offset channel** the schema does not have.

This is not a platform dead end that a future API could open — it is a
vocabulary that cannot represent the fact. **REFUSED by name:
`grid-overlay-edge-inversion`, recorded as PERMANENT.** It is the first G7 row
whose cause is the contract's own vocabulary rather than the Plugin API's, and
it is labelled as such so nobody re-probes Figma looking for a door.

### G9.2 — but the grid is carried: the overlay child rides the EXISTING door

The whole-grid refusal was disproportionate, and it was reaching for the wrong
inversion. `Part.overlay` is not the only out-of-flow spelling the grammar
has: `carryAbsPlacement` already inverts dump `abs` into `position: absolute`
plus minted `top`/`left`/`width`/`height` literals, and that is how absolute
children are carried under EVERY other parent kind. It needs no edge enum, and
it loses no coordinate.

So: an ABSOLUTE child of a grid parent is carried through `carryAbsPlacement`,
the grid and every sibling placement are carried normally, and
`grid-overlay-edge-inversion` is recorded as the reason the child is NOT an
`overlay` part. G2's all-or-none placement rule already excluded `overlay`
parts; it is extended to exclude **out-of-flow parts generally** (overlay OR
absolute), which is what P13's dump gate already does on the capture side —
the referee now matches the instrument.

When `carryAbsPlacement` itself refuses (partial `abs` capture, or minting
off), the grid refusal stands, with that named cause rather than the missing
edge inversion. Refusing is conditional on the evidence, and the condition is
stated.

**Conformance:** `grid-absolute-overlay` moves from declared-red to
**CARRIED** — `"display":"grid"` and the sibling's
`"placement":{"row":0,"column":0}` are both present — with the edge inversion
refused by name in G7 rather than pinned as a red case.

---

## G10 — `accepts` is a HARD emission-order dependency

**The gap** (corpus finding 3): the proposal calls `accepts` soft
(`preferredValues`; off-list content is never blocked), and as a RUNTIME
constraint it is. **Emitting** it is not: a slot whose `accepts` names a
contract absent from the target file throws at compile —
`Slot "Header" preferred value: component not found for contractId "ds.top-nav" … (sync it first)`.
An `accepts` list therefore silently defines a BUILD ORDER, and a partial
emission cannot carry a slot constraint pointing outside the emitted subset.
This is what forced `ds.page-shell` to accept only the other four corpus
layouts.

**Decision: document it as a property, with its ordering rule, and make the
emission order derive from it rather than from authoring order.**

> **The `accepts` ordering property.** `slot.accepts` induces a directed edge
> `referenced → referencing` over the emitted set. The emitter emits in
> topological order of that graph. A cycle is refused by name
> (`slot-accepts-cycle`) — it cannot be satisfied in one pass, and silently
> dropping one edge to break it would make the constraint depend on iteration
> order. An `accepts` entry naming a contract OUTSIDE the emitted subset is a
> named DEFERRAL (`slot-accepts-deferred`), not a throw: the slot emits without
> that preferred value and the receipt says which one and why, so a partial
> emission is legal and its loss is visible.

Authoring order stops being load-bearing; the two failure modes that remain —
a cycle and an off-subset reference — each have a name.

---

## G11 — the grid-cell cross-axis default gets ONE spelling on ALL surfaces

**The gap** (corpus finding 4, defect FC-SLOT-CROSS-AXIS-STRETCH): "unspecified"
is not the same fact on the two surfaces. CSS `display:flex` means
`align-items: stretch`; the canvas frame carries `counterAxisAlignItems:'MIN'`.
Invisible across all 51 lower-order components — a hugging parent is exactly as
tall as its child — and very visible inside a grid cell, where CSS stretched a
23px badge down a 392px sidebar.

**Decision: give it a neutral spelling where it is visible, and NAME the
asymmetry where it is provably not.**

- **Where it is visible — a child of a grid parent, i.e. a box with a definite
  cross-axis size:** absence means **`start`** on every surface, and every CSS
  surface spells it out (`align-items: flex-start`). The contract's own spec
  says MIN, so CSS is the side that spells its default. This was already
  implemented for the CSS-Module surface only; `emit-html` and
  `emit-react-inline` were still stretching. Both now carry it — the fix was
  half-shipped, which is why the corpus's filled scores could pass on one
  surface and not another.
- **Where it is not — a flex parent with an INDEFINITE cross-axis box:**
  absence continues to mean each surface's default, and the two draw the same
  box. This is not hand-waving: `core/stretch-default-check.ts` asserts the
  invariant (`align` UNSET ≡ `align: 'stretch'` on every surface, and
  `align: 'start'` ≢ either) as whole-spec equality on the canvas side and as
  an exactly-one-declaration diff on the CSS side. The asymmetry is bounded by
  a running gate, not by an assurance.

Corpus finding 5 ("a slot cannot say how its content sits in the cell") is the
same defect seen from inside, and G11 answers it the same way: a slot's
children take `start` on both surfaces unless the slot declares `layout.align`.

---

## G7′ — refusals added by this round

| name | construct | evidence |
|---|---|---|
| `grid-hug-flex-axis` | `literals.width/height: "fit-content"` on an axis whose track list contains an `{fr}` track | GP1/GP5/GP12 (hug-after-tracks destroys the ratio, silently) + GP8/GP1b (hug-before-tracks preserves the ratio but never hugs — the node reports HUG and behaves FIXED). No write order satisfies both, and CSS agrees: `fr` needs a definite size. |
| `grid-axis-indefinite` | a grid part leaving an axis with no definite size, no `fit-content` and no `grow` | FC-GRID-ROOT-VSIZE: `primary/counterAxisSizingMode` are inert on GRID (GP1b/GP8), so absence resolves as `createFrame`'s FIXED 100 on canvas and content-height in CSS. |
| `grid-overlay-edge-inversion` | inverting dump `abs` (x/y in a cell) into `Part.overlay` (4-value edge enum, no offsets) | **PERMANENT.** Arity, not a platform gap: the target vocabulary has four values and no offset channel; the source is ℝ² plus a 3×3 constraint lattice. Every total map drops the offsets or invents a channel. G9.1. |
| `slot-accepts-cycle` | a cycle in the `accepts` dependency graph | G10 — unsatisfiable in one emission pass; breaking it silently makes the constraint iteration-order-dependent. |

Named DEFERRAL (carried, loss visible): `slot-accepts-deferred` — an `accepts`
entry naming a contract outside the emitted subset (G10).

## Disposition summary — after this round

CARRIED, newly: an intrinsically-sized axis on a grid part
(`literals.*: "fit-content"` → canvas HUG, G8/G3′ — measured 640×23 on both
surfaces, GP15); declared row tracks under `flow: "row"` (G5′); a grid whose
child is an absolute overlay — the grid, the tracks and every sibling placement
(G9.2); `accepts` across an emission-ordered set (G10).
LOWERED, newly: an absolute grid child → `position:absolute` + minted insets
instead of `Part.overlay` (G9.2), named `grid-overlay-edge-inversion`.
REFUSED by name, newly: the G7′ table. `grid-overlay-edge-inversion` is the
first refusal recorded as PERMANENT on vocabulary grounds rather than on a
Plugin API dead end.
