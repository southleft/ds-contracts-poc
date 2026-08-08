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

**Amended 2026-08-08** ([layout-grammar-proposal.md](../research/layout-grammar-proposal.md)
G8.5): on an axis the contract declares INTRINSIC (`literals.width/height:
"fit-content"`), fact 3's *resulting geometry* is scored on the FILLED surface,
where there is content to measure; the EMPTY score keeps presence, name and the
cell RECT, which are contract facts and identical on both surfaces. The reason
is measured, not stylistic: with every slot empty the two surfaces report
different numbers and NEITHER is a contract fact — the canvas keeps Figma's own
minimum for an empty auto-layout SLOT (`ds.two-column` 640×100) while CSS gives
0 plus any row gaps (640×0; `ds.grid-gallery` 640×16, the gap between two
zero-height rows). Making them agree would mean the emitter resizing empty slots
to zero to satisfy a scorer, which is refused for the same reason this
convention already refuses to compare placeholder pixels. An axis with a
definite size is unaffected and is still scored empty: `ds.bento-grid` and
`ds.page-shell` match exactly at 640×480, every cell box included.

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

## Results (2026-08-08, re-measured after the grammar round)

Playground file `BMjUA2ue5CaZXU4kufxL0z` ("Latest DS Contracts Tests"), page +
section **Composition Corpus**. Every stem below was **rebuilt fresh** (the
prior component removed first, so no number here is a stale amend), filled with
the same pinned child on both surfaces, and scored on both instruments.

| stem | empty (structural) | filled (pixels) | receipt |
|---|---|---|---|
| `ds.two-column` | **pass** | **pass 0.63%** | `scored-pass` |
| `ds.sidebar-layout` | **pass** | **pass 0.75%** | `scored-pass` |
| `ds.grid-gallery` | **pass** | **pass 0.34%** (was 3.41%) | `scored-pass` |
| `ds.bento-grid` | **pass** | **pass 0.10%** | `scored-pass` |
| `ds.page-shell` | **pass** | **pass 0.08%** | `scored-pass` |

**All three FC-GRID-ROOT-VSIZE failures converted.** The hugging stems now
measure the same box on both surfaces, with the same pinned child in every slot:

| stem | canvas (filled) | code (filled) | tracks after the hug |
|---|---|---|---|
| `ds.two-column` | 640×23 · Start 312×23 · End 312×23 | 640×23 · 312×23 · 312×23 | rows `[HUG]`, cols `[FLEX:1, FLEX:1]` |
| `ds.sidebar-layout` | 640×23 · Sidebar 240×23 · Main 376×23 | 640×23 · 240×23 · 376×23 | rows `[HUG]`, cols `[FIXED:240, FLEX:1]` |
| `ds.grid-gallery` | 640×62 · six 202.67×23 | 640×62 · six 202.66/202.67×23 | rows `[HUG, HUG]` under flow, cols 3×`FLEX:1` |
| `ds.bento-grid` | 640×480, unchanged | 640×480, unchanged | rows `[FIXED:80, FLEX:1, FLEX:2]` — **intact** |
| `ds.page-shell` | 640×480, unchanged | 640×480, unchanged | rows `[FIXED:64, FLEX:1, FIXED:56]` — **intact** |

The two stems that already passed moved **nothing**: their `fr` rows survive
because the schema refuses `fit-content` on an `fr`-bearing axis by name
(`grid-hug-flex-axis`), which is the constraint the previous round measured and
this round proved has no way around.

### How the defect closed — and the half that only building it could find

**FC-GRID-ROOT-VSIZE** is closed by two amendments, both in
[layout-grammar-proposal.md](../research/layout-grammar-proposal.md):

**G8 — the intrinsic axis is a contract fact, and it always was.** No new field:
`literals.height: "fit-content"` is already a legal Part literal, already the
CSS truth, and already what the canvas reader mints for an all-HUG root. The
grid emitter simply dropped it, because `primaryAxisSizingMode`/`counterAxisSizingMode`
are INERT on a GRID frame (GP1b/GP8: they read back `HUG` while the frame keeps
its FIXED size). The lowering that works is `layoutSizing{Horizontal,Vertical} =
'HUG'`, written **last** — after `resize()` and after every child, because a
later resize of a hugged axis silently reverts BOTH the sizing mode and the
track list (GP4b).

**G3′ — a child never FILLS an axis its parent HUGS.** This is the half that a
green headless suite would never have caught, and it was found by building the
real component and reading the canvas back. With G8 in place, `ds.two-column`
reported `layoutSizingVertical: 'HUG'` and row track `HUG` — **and still measured
640×100.** G3's default fills both axes of the cell; on a hugged axis that makes
the track size a function of the child and the child a function of the track,
and Figma resolves the circle by **freezing whatever box the node already had**.
The readback reports a hug that never happened. On a hugged axis the children now
HUG, and the box resolves to 640×23 (GP14/GP15).

### The empty half, and why it is scored differently now

With every slot EMPTY the two surfaces disagree, and neither number is a
contract fact: the canvas keeps Figma's own minimum for an empty auto-layout
SLOT (two-column 640×100, gallery 640×216) while CSS gives 0 plus any row gaps
(640×0 and 640×16). So the structural convention gains one line (G8.5): **on an
axis the contract declares intrinsic, the resulting geometry is scored on the
FILLED surface**, where content exists to measure; the EMPTY score keeps
presence, name and the cell RECT, which are contract facts and surface-
independent. Making the empty boxes agree would mean the emitter resizing empty
slots to zero to satisfy a scorer — refused, for the same reason the convention
already refuses to compare placeholder pixels.

`ds.bento-grid` and `ds.page-shell` need none of this: both axes are definite,
and their empty boxes already agree exactly (640×480, every cell box identical).

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
it moves **zero committed bytes** of the 51 — verified. **The grammar round
found this fix was half-shipped**: it was applied on the CSS-Module surface only,
while `emit-html` and `emit-react-inline` still stretched. All three surfaces
now spell it (G11).

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
