# F1 held-out: from capture-only to a compiled calendar

**Measured 2026-09-05 on `main`.** react-day-picker 10.0.1 `DayPicker`, the
held-out subject. Every number below re-derives from
`npm run recipe:f1-held-out:check` plus the commands at the foot of this page.

## What changed

F1 was **capture-only**: the ledger was captured, a mechanical propose ran, and
the `calendar@1` compile refused. It now **compiles** — the ledger assembles
into a real `calendar@1` instance and `compileCalendarRecipe` accepts it, with
no hand-authored fixture and no content borrowed from Astryx.

    f1Status   capture-only  ->  compiled
    compile    refused       ->  compiled
    envelope   (none)        ->  sha256 e555940bdc590ec6…

**Compiling is not passing.** The docs/26 F1 bar is *live zero-silent on an
unseen library*, which also needs a live mint and a render scored against the
real package. Neither has happened, so `overallSuccess` stays `false` and
`productV1` stays `INCOMPLETE`. The live half is parked as **P2** in
`OWNER-PARKED.md`.

## The refusal was a strawman, twice

The headline claim "compile attempted and refused" rested on this, inside
`propose-calendar-instance.ts`:

```ts
const parsed = CalendarRecipeInstanceSchema.safeParse({
  note: "deliberately incomplete — mechanical propose only",
});
```

The refusal was evidenced by parsing **an object with one string field**, not
by anything react-day-picker does. `f1-held-out.ts` carried a comment
explaining that an earlier strawman had been removed and that the REAL proposed
instance was now parsed next door — and that comment was false; the strawman
had simply moved one layer down. `instanceParse.success` was additionally
hardcoded `false`, so no run could ever contradict it.

The compile input is now assembled from the ledger, and `success` is whatever
the parse returns.

## The eleven gaps

All eleven are **closed** — not by supplying values, but by making `calendar@1`
able to spell what the capture already measured. Each records `closedBy` in
`compile-gaps.json`.

| gap | ledger carries | how it closed |
| --- | --- | --- |
| `week-count-not-six` | 5 week rows | `.length(6)` → `.min(4).max(6)`. The 6 was **Astryx's `hasVariableRowCount` default** written down as a property of calendars. |
| `blank-outside-labels` / `outside-cell-has-no-label` | 4 blank cells | `label` dropped `.min(1)`; a refinement permits an empty label for the `outside` state only. |
| `day-button-radius-percent` | `100%` | carried **as a percentage**; `resolveRadius()` is the one declared lowering to px. |
| `selected-is-border-not-fill` | 2px `#0000ffff` border | mapped onto the existing optional `ring`/`ringWidth` pair; the measured transparent fill stays the background. |
| `grid-gap-normal` | `normal` | `itemSpacing 0` + a `lowered` receipt naming the discarded keyword. |
| `root-min-width-auto` | `auto` | `minWidth 0` + a `lowered` receipt. `root.width` 308 is **not** borrowed as a minimum. |
| `week-number-text-absent` | no such part | `weekNumberText` and `weekNumber` became optional, gated so both are required whenever the axis offers `on`. |
| `weekday-fontsize-not-day` | 13.3333px vs 16px | new optional `weekdayFontSize`; neither size is collapsed onto the other. |
| `zero-source-bindings` | 0 bindings | tokens accept `variable: null`. **All 35 leaves are unbound**; no `rdp.*` name is minted. |
| `axes-mismatch` | `showWeekNumber` pinned | a dimension with one value emits a **component, not a set** — `figma-ir.ts` rightly refuses a one-valued axis. |

A twelfth gap, `capture-axes-outside-calendar-grammar`, is **named and left
open**: the capture's own `captionLayout × numberOfMonths` axes are not
`calendar@1` axes, and closing that would need either a second archetype or a
multi-month grammar. It is recorded so the closures above are not read as
covering more than they do.

## What the compiled envelope carries

    proposed leaves      35
    carried facts        29
    loss receipts         6   (2 inert, 4 lowered)
    tokens with a binding 0
    weeks                 5   (35 cells, 4 blank outside)
    caption               "January 2026"
    selected / today      "20" / "15"
    day button            42px, radius 100% -> 21px
    weekday / day size    13.3333px / 16px
    axes                  WeekNumbers ["off"], State [default, today, selected, outside]

The carried/receipted split is load-bearing. Six leaves are measured but **not**
placed on a token, and each says why — `root.width`/`root.height` (`inert`: the
auto-layout produces them), `selected.td.background` (`inert`: a transparent
surface paints nothing), `dayButton.height` (`lowered`: the button is square),
`gridGap` and `rootMinWidth` (`lowered`: keywords, not lengths). Calling a fact
carried because it was measured — rather than because a token holds it — is the
disclosure defect that split prevents.

## The round trip closes

    compile -> collapse -> compile     IR byte-identical, same sha256
    second iteration                   stable

Two real defects surfaced only because the scene was raised and compared:

- **`border-radius: 100%` was lowering to 42px on a 42px button.** CSS scales
  overlapping corner radii down (Backgrounds 3 §5.5), so a uniform `p%` past 50
  lands at exactly half the side. The correct answer is **21px** — a circle.
  A naive `p × S / 100` returns a radius twice the real one.
- **The selected ring vanished on the way back.** `hasRing` detected the ring by
  looking for a *variable binding*, and an unbound token emits none — so a
  stroke drawn on the canvas was silently dropped on readback for every subject
  without a token file. It now reads the paint.

## Gates

    typecheck:recipe          0 errors in current files (10 named, 4 frozen lineage)
    test:recipe               380 pass / 0 fail
    recipe:calendar:check      38 pass / 0 fail
    recipe:f1-held-out:check    3 pass / 0 fail
    curated-facts:self-test    15 planted cases, all behave

## Re-derive

```
npm run recipe:f1-held-out:check
npm run recipe:calendar:check
npm run test:recipe
npm run curated-facts:self-test
```
