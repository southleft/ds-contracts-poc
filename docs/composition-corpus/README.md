# A3 — the first-party COMPOSITION corpus

The 51 first-party contracts that preceded this round are **lower-order
components**: badges, avatars, checkboxes, dividers. They exercise tokens,
variants and text binding, and they say almost nothing about *layout*. This
corpus is the other half — real compositions with **slots**, authored in code
and tested through the contract:

| stem | grammar exercised |
|---|---|
| `ds.two-column` | G1 two `fr` tracks, G2 explicit placement, 2 slots |
| `ds.sidebar-layout` | G1 **mixed track kinds** — a stationary `px` column beside an `fr` main |
| `ds.grid-gallery` | G5 bounded row auto-flow (`flow: "row"`), placement-by-child-order, repeated slots |
| `ds.bento-grid` | G2 **span matrix** + G4 named areas as slot anchors (the P8 canonical case) |
| `ds.page-shell` | G4 named areas whose slots `accepts` the other four — composition **of** compositions |

Each stem carries: a contract under `contracts/`, generated React +
co-located CSS Module under `src/components/` (via `npm run generate` — the
sanctioned flow; generated files are never hand-edited), an emitted Figma
script under `figma-sync/`, and a console-loop receipt + scorecards under
`parity/receipts/console-loop/`.

---

## THE SCORING CONVENTION (pinned before the first contract was authored)

This is the trap that sank the card stem in an earlier round: the canvas
dashed slot placeholder was pixel-scored against an empty code body, and the
resulting number described the *placeholder chrome*, not the layout. Native
slots make that comparison not merely misleading but **impossible by design**
— [native-slots-proposal.md](../research/native-slots-proposal.md) §2: an
empty native slot renders as Figma's own ordinary frame carrying only the
contract's part styling, with **zero chrome**, and exports carry no slot
affordance at all. There are no placeholder pixels on canvas to compare.

So every layout in this corpus is scored **twice**, and the two scores answer
different questions.

### (a) EMPTY — structural, never pixels

Per the revised G4 convention
([layout-grammar-proposal.md](../research/layout-grammar-proposal.md) G4,
revised 2026-08-08), an empty area/slot scores on three facts and no others:

1. **presence** — the canvas carries a node for the slot, and the code
   carries the placeholder element with the slot class;
2. **name** — that node is named for the contract's slot/area name (the
   contract owns the name on both surfaces; Figma has no native area names);
3. **placement box** — the node's cell rect (anchor row/column + spans) and
   resulting geometry match the contract's declared rect.

An empty structural score is `pass` only when all three hold for **every**
slot in the stem. Pixel comparison of an empty layout is not performed and
its absence is not a gap — it is the convention.

### (b) FILLED — pixels, under the standard bar

Both surfaces are populated with the **SAME pinned child components**
(recorded per stem in its receipt as `filled.pins`), in the same order, then
scored under the lane's standard bar:

> `pctAAMasked <= 5` **AND** `compositionOk`

— the identical bar the other 7 console-loop lanes use, at scale 1,
like-for-like (canvas VARIANT cell export vs. the `src/components` render).

A slot filled on one surface and empty on the other is a **DIFF**, never a
normalization.

### What a receipt may claim

`visual.ok` / `visual.matchDeveloped` may be claimed only when **both**
scores exist and both pass. A stem with a passing structural score and a
failing filled score is `fail-closed` with the named FC cause — honest
fail-closed beats a flipped boolean, and the RATCHET floor is raised only
where **both instruments** agree.

---

---

## Results (2026-08-08)

Playground file `BMjUA2ue5CaZXU4kufxL0z` ("Latest DS Contracts Tests"), page +
section **Composition Corpus** (`4:1416`).

| stem | empty (structural) | filled (pixels) | receipt |
|---|---|---|---|
| `ds.two-column` | **FAIL** — FC-GRID-ROOT-VSIZE | pass 0.63% | `fail-closed` |
| `ds.sidebar-layout` | **FAIL** — FC-GRID-ROOT-VSIZE | pass 0.75% | `fail-closed` |
| `ds.grid-gallery` | **FAIL** — FC-GRID-ROOT-VSIZE | pass 3.41% | `fail-closed` |
| `ds.bento-grid` | **pass** | **pass 0.10%** | `scored-pass` |
| `ds.page-shell` | **pass** | **pass 0.08%** | `scored-pass` |

Every stem carried its **grammar** exactly — tracks (mixed `px`/`fr`/`fit`),
independent row/column gaps, anchors, spans, auto-flow, named areas, and one
native SLOT property per contract slot. The bento's geometry is exact on both
surfaces: header 640×80, sidebar 160×392, main 328×128, rail 120×392, footer
328×256.

### Defects found on the real canvas and fixed at cause

All three were invisible to the headless mock; two were invisible to a green
eval suite.

**FC-GRID-APPEND-AUTOPLACE — the canonical bento could not be built at all.**
`appendChild` does not park a grid child nowhere: the canvas auto-places it
row-major into the next free cell (five appends land 0,0 / 0,1 / 0,2 / 0,3 /
1,0). The emitter ran "place ALL children before ANY span" as a single ordered
loop, and its *second* placement (sidebar → 1,0) threw P3's occupancy error
because the fifth appended child already sat there. Placement is a
**permutation problem, not a loop**: `applyGridChildren` now repeatedly places
every child whose target is free, parks one child in a spare cell to break a
cycle, and refuses by name when no spare exists.
`evals/fixtures/grid-bento-check.ts` — the fixture whose docstring calls itself
"THE CANONICAL CASE, end to end" — was green against a canvas that could not
build it, because the mock modeled auto-placement on append but never checked
occupancy in `setGridChildPosition`. The mock now throws the canvas's verbatim
error, so the fixture is a real gate.

**FC-GRID-HUG-VALUE — read and write are not symmetric.** P2b observed a HUG
track *reading back* as `{type:'HUG', value:1}`, and the emitter mirrored that
shape into the *write*. Writing `{type:'HUG', value:1}` makes the API
reinterpret the entry as **FIXED**, unrecoverably:

| write | readback |
|---|---|
| `{type:'HUG'}` | `{type:'HUG', value:1}` ✓ |
| `{type:'HUG', value:1}` | `{type:'FIXED', value:1}` ✗ |

Every `fit` track was silently shipping a 1px fixed track. HUG is now written
as the bare type; the mock models the same asymmetry.

**FC-SLOT-CROSS-AXIS-STRETCH — the two surfaces' defaults are different facts.**
A part with no declared `layout.align` takes each surface's default, and they
disagree: CSS `display:flex` means `align-items: stretch`; the canvas frame
carries `counterAxisAlignItems: 'MIN'`. Invisible across all 51 lower-order
components, because a hugging parent is exactly as tall as its child. Inside a
grid cell it is not: CSS stretched a 23px badge to the full 392px sidebar while
the canvas left it 23px at the top. Fixing it took the bento from
`compositionOk: false` at 0.57% to a clean 0.10%. Scoped to grid children, so
it moves **zero committed bytes** of the 51 — verified.

### Defect named and deliberately left open

**FC-GRID-ROOT-VSIZE.** `primaryAxisSizingMode`/`counterAxisSizingMode = 'AUTO'`
are inert on a GRID frame, so a grid frame keeps `createFrame`'s FIXED 100 on
any axis the contract did not pin. `ds.two-column` renders 640×100 on canvas
with 77px of dead space under a 23px row, where CSS hugs to 640×23.

The obvious repair — writing `layoutSizing*='HUG'` — was tried and **measured**,
and is worse than the defect: a GRID frame set to hug normalizes its FLEX
tracks to HUG and **the `fr` ratio does not survive**. The bento's
`[80px, 1fr, 2fr]` came back `[FIXED:80, FLEX:1, FLEX:1]` with main/footer both
192px instead of 128/256. Trading honest dead space for a silently destroyed
span matrix is not a fix, so this stays named and open. A real fix must hug only
axes carrying no FLEX track, and must run after `resize()`.

This also exposes an **instrument weakness**: the three affected stems' filled
pixel scorecards all *pass*, because the lane scorer trims both images to their
ink bounding box and dead space carries no ink. The structural half is what
catches it — which is the whole reason the convention above scores twice.

## What the grammar could not express — the real output of this round

1. **A hugging axis is not a contract fact.** The grammar can say `{fit: true}`
   for a *track*, but a composition cannot say "my own height hugs my content".
   Width/height are `literals`; their absence means "unspecified", which the
   canvas resolves as FIXED 100 and CSS resolves as content-height. Two
   surfaces, two answers, no fact to arbitrate.
2. **`fr` requires a definite size, and the grammar cannot demand one.** G5
   forbids declaring `rows` under `flow: "row"`, so `ds.grid-gallery` cannot
   state its row sizing at all; the emitter derives 2 FLEX rows, and FLEX rows
   need a definite height the contract has no way to provide. The grammar's own
   rule creates the ambiguity.
3. **`accepts` is a hard emission-order dependency, not a soft preference.** The
   proposal calls it soft (`preferredValues`; off-list content is never
   blocked), but *emitting* it is not: a slot whose `accepts` names a component
   absent from the file throws at compile (`Slot "Header" preferred value:
   component not found for contractId "ds.top-nav" … (sync it first)`). An
   `accepts` list silently defines a build order, and a partial emission cannot
   carry any slot constraint pointing outside the emitted subset. This forced
   `ds.page-shell` to accept only the other four corpus layouts.
4. **Cross-axis alignment has no neutral spelling.** "Unspecified" is not the
   same fact on the two surfaces. The grammar needs either a mandatory align on
   parts with a definite box, or an explicit `auto` both emitters spell out.
5. **A slot cannot say how its content sits in the cell.** `placement.alignX/Y`
   positions the *slot* in its cell; nothing describes how the slot's
   *children* sit inside the slot — needed the moment a 23px badge lands in a
   392px region, and exactly the gap that let the defaults diverge.
6. **Repeated slots must be spelled one at a time.** A slot is a part and parts
   are named keys, so a 12-cell gallery is a 12-part contract. Slot names must
   also be valid JS identifiers, because a slot name becomes a React prop.
7. **Non-rectangular named areas remain unexercised.** Every corpus area tiled
   cleanly and emitted `grid-template-areas`; G4's LOWERED longhand fallback is
   still untouched by any real contract.

## Refusals re-confirmed

The G7 fence held — 14 constructs refuse at the schema, and no corpus contract
needed to cross it.

## Transport note for the lane

The stem-serve pattern documented at port **9223 no longer works**: the
figma-console MCP server itself binds `[::1]:9223` and the plugin's `localhost`
resolves to IPv6, so every fetch returns that server's 404. The Desktop Bridge
`networkAccess` allowlist covers **`localhost:9223`–`9232`**, so this loop ran
on **9224**. A port outside that range (9333) is blocked by the plugin CSP and
fails with an opaque error.
