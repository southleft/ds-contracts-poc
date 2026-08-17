# Visual review — the seven MUI sets posted 2026-08-17

These are **MUI Test 1** (`59mLQlOMiD5w5za6SUcoO5`), not the eight Flowbite
North Star stems. A single-cell 5% AA score never looked at the variant
grid you photographed. Six of seven were already fail-closed. Switch
"passed" a 38×20 crop of one default cell.

Live sizes read 2026-08-17 from the Desktop Bridge.

| Stem | What you see | Live box | Library orig-shot | Gate status | Cause | Climb |
|---|---|---|---|---|---|---|
| Fab | Tall thin capsules, + near the top | **8×36 HUG** (two sets on the page) | 56×56 circle | fail-closed `FC-GEOMETRY-EXCLUDED` | Contract had no width/height; hug is the "+" glyph. Radius 28 on an 8×36 box is a capsule. | Path B: author 40/48/56 boxes. Not a fuse relaxation. |
| Link | "Lin" / "k" wrap in every cell | **30×38 FIXED** | "Link" on one line | fail-closed `FC-TEXT-WRAP` | Bound capture-font width 30.22px; Inter 16px is wider. | Drop the width token so the label hugs. |
| Badge | Gray "A" squares + floating "4"; default row has no circle | **40×40 FIXED**, children side-by-side | Avatar circle with overlay "4" | fail-closed 54% AA | Children slot is a placeholder "A". Badge is HORIZONTAL not overlay. Default color has no chip fill (matches MUI default). | Overlay is still open (`FC-ABS-SIZE` class). Not claimed this round. |
| Accordion | Body copy leaks past the card; collapsed still shows details | Layout 288×48, **clipsContent false**, collapse-root **h=0** with visible text | Collapsed header only, 290×50 | fail-closed `FC-ABS-SIZE` | 0-height frame does not clip. Text also does not wrap. | Author `overflow: hidden` on collapse-root (existing emit path). |
| Autocomplete | Chip heights / padding uneven | Box **288×56 / 288×40** is correct | Even Alpha/Beta chips | fail-closed (instruments disagree 3.87 vs 8.93) | Chip internals, not the field box. | Still open. |
| Switch | Overlapping colored thumbs; empty Warning cells | Variants themselves **58×38 / 40×24**, 2 children each | One switch | **scored-pass 2.50%** on one cell | Stale BOOLEAN **Is enabled** (not in the authored contract) plus **Disabled**. Figma's property grid invents extra cells and stacks ghosts. | Delete the stale boolean. The one-cell pass never scored the grid. |
| Avatar | Tall oval "A", then squircle, then square | **14×20 HUG** | 40×40 circle | fail-closed `FC-GEOMETRY-EXCLUDED` | Same as Fab: no box, hug the glyph, radius 20. | Path B: author 40×40. |

## Why a "pass" can look like this

The scorer crops **one default variant cell** and compares it to one
orig-shot. It does not walk the property grid, does not score BOOLEAN
axes, and does not fail a set for a duplicate sibling. Structure notes
on these receipts even say "slot placeholders OK."

## This round (authored contract, not fuse)

- Fab / Avatar: write the captured boxes into the contract + minted tokens.
- Link: stop pinning a 30px width.
- Accordion: declare overflow hidden on `collapse-root`.
- Switch: delete canvas-only `Is enabled`.
- Fab page: delete the duplicate set `84:1954`.

`FC-GEOMETRY-EXCLUDED` stays closed. These boxes are Path B authoring,
the same way `mui.radio` already carries `size-42`.

## After this climb (live, 2026-08-17)

Read from the same file after authoring the boxes, deleting the stale
boolean, clipping collapse-root, and reflowing the Fab grid.

| Stem | After |
|---|---|
| Fab | Circles at 56 / 48 / 40. Duplicate set `84:1954` gone. Grid reflowed so Large no longer overlaps. |
| Avatar | Circle / rounded / square, all 40×40. The tall oval is gone. |
| Link | "Link" on one line (31×19). Inherit row is black ink — visible on the cream page, invisible in a black export. |
| Accordion | Collapsed is header-only (0-height collapse-root now clips). Expanded body wraps at 256px. Still no chevron (not in the contract). |
| Switch | `Is enabled` deleted. Property grid no longer stacks ghosts. One-cell 2.50% pass was never a set pass. |
| Badge | Unchanged. Overlay still open. |
| Autocomplete | Unchanged. Chip internals still open. |

Do not record a MUI demo until Badge overlay and Autocomplete chips are
climbed the same way. Flowbite's eight stems are a different file.
