# Archetype cases — SEALED EXPECTATIONS vs. MEASURED OUTCOME

*Hand-authored. Not generated — `EXPECTATIONS.md` is the generated capability
matrix; this file is the adjudication of a set of predictions that were written
down before the cases were run, and it is the only place the misses are counted.*

The owner named three complex archetypes for v1: **calendar, data table,
combobox.** The calendar is covered by the sealed held-out `day-picker` subject.
The other two were, across the entire corpus, one contract each — `table /
data-grid` and `select / combobox`, both **ATTEMPTED — BOUNDED** in
[docs/23 §C.1.1](../docs/23-known-limitations.md), which is the project's own way
of saying *not proven*. These 13 cases exist to make the two measurable.

---

## THE HEADLINE: I WAS WRONG SEVEN TIMES OUT OF THIRTEEN, AND WRONG IN THE OPTIMISTIC DIRECTION ONLY ONCE

| | |
|---|---|
| cases authored | **13** |
| predictions correct | **5** |
| predictions **wrong** | **7** |
| partially correct | **1** |
| `expected-wall` predictions that did NOT materialise | **6 of 7** |
| the one case I called `easy` that came back red | **`combobox-closed-trigger`** |

Six of the seven walls I predicted did not exist. The engine handled repetition,
grid month layout, `:nth-child` zebra striping, per-column alignment, an
out-of-flow popover and a selected option among five siblings — all of which I
predicted, on the basis of the project's own registers, that it would not.

**That is the finding.** My model of this engine was pessimistic and it was
wrong, and a corpus assembled by someone with that model would have been
assembled around the wrong risks. The two reds are both in places nobody was
looking, and neither is where the archetype literature said the danger was.

---

## The two reds

### 1 · `combobox-closed-trigger` — SILENT-LOSS. **This is a defect in the FIXTURE, not in the engine.** ⚠

The gate reports `justify-content` as *"observed but neither carried nor named
anywhere"* — a never-waivable silent loss. It is not one. The engine carried it
correctly:

```
extract/computed/out/conformance/casecomboboxclosedtrigger/enriched.contract.json
  anatomy.root.layout = { "display": "flex", "align": "center", "justify": "space-between" }
```

The contract spells the fact `layout.justify`. The fixture's own reader,
`carriageOfContract` in `conformance/run.ts:220`, mirrors the contract's
**grid** spellings (`layout.rows`, `layout.columns`, `layout.gap`, `layout.flow`,
`layout.areas`, `placement.alignX`) and mirrors **no flex layout spelling at
all**. There is no `layout.justify → justify-content`, no
`layout.align → align-items`, no `layout.display → display` mapping. So any case
whose observable channel is a flex-layout fact reports a false SILENT-LOSS.

**Consequence beyond this case:** the fixture has 107 cases and, until now, not
one of them observed `justify-content` or `align-items`. The frontier has
therefore never measured flex alignment in either direction, and the capability
matrix's silence about it was mistaken for coverage. `spec/channel-table.json`
classes `justify-content` as **CARRIED** with the projection *"auto-layout
primaryAxisAlignItems (space-between included)"* — a claim that, before this
case, no measurement stood behind.

**The fix is one mapping** in `carriageOfContract`, next to the existing
`eatGrid`. I have deliberately **not** applied it. Repairing the instrument in
the same commit that discovered the defect is how a measurement stops being
trustworthy; the red is recorded in `BASELINE.json` so it cannot drift, and the
remedy is a decision for the owner. Whoever takes it must re-measure every case,
because a new mapping can change verdicts fixture-wide.

### 2 · `combobox-listbox-stacking-order` — UNDECLARED-CARRY, flagged HARMFUL

I declared `expect: REFUSED` / `canvas.expect: ABSENT`. The engine **carried it**:

```
anatomy.root.parts.b.tokens["z-index"] = "{imported.case-combobox-listbox-stacking-order.b.z-index}"
```

My declaration was wrong twice over. `spec/channel-table.json` classes `z-index`
as **LEDGERED**, not refused, with the note *"canvas stacking is child order;
reversed z ledgered on read (`layout-item-reverse-z-index`)"* — so the construct
is both modelled and drawable, and `canvas.expect` should have been `PRESENT`.

The documented remedy for UNDECLARED-CARRY is *"update the manifest — this is how
the capability matrix stays true."* **I have deliberately not applied it**, for
the same reason as above: the flip would turn my own red green in the commit that
found it, and it would newly admit the case to the round-trip half, which would
tell us whether the emitter actually honours a numeric `z-index` by reordering
children. That is worth knowing and it should be a decision taken on purpose, not
a side effect of my tidying up after myself.

---

## The sealed table

`expect` is NORMATIVE (what a correct engine does). `predicted` is PREDICTIVE
(what I thought THIS engine would do), sealed in commit `f2b644cf` before any
case ran and amended once in `7924f7b0` — still before any run — after a survey
of the project's wall vocabulary falsified two of my claims. Nothing below was
edited after a result was read.

| case | predicted | capture half | canvas half | verdict on my prediction |
|---|---|---|---|---|
| `repeat-siblings-three` | easy | PASS | ROUND-TRIPPED | ✅ right |
| `repeat-siblings-seven` | hard | PASS | ROUND-TRIPPED | ✅ right (no boundary found) |
| `repeat-siblings-thirtyone` | **expected-wall** `FC-REPEAT-FORWARD-ABSENT` | PASS | ROUND-TRIPPED | ❌ **wrong** |
| `repeat-grid-month` | **expected-wall** `FC-GRID-ROOT-VSIZE` | PASS | ROUND-TRIPPED | ❌ **wrong** — I cited a code that G8 had already closed |
| `table-semantic-row-group` | hard, refused by `table-lowering` | PASS (refused by name) | n/a | ✅ right *after* amendment; the sealed version was wrong |
| `table-header-row-distinct` | easy | PASS | ROUND-TRIPPED | ✅ right |
| `table-zebra-nth-child` | **expected-wall** `FC-NTH-CHILD-STRIPE-UNREAD` | PASS | ROUND-TRIPPED | ❌ **wrong** |
| `table-column-numeric-alignment` | hard, `FC-TEXT-FILL-ALIGNMENT` should fire | PASS | ROUND-TRIPPED | ✅ right |
| `combobox-closed-trigger` | **easy** | 🔴 SILENT-LOSS | SEED-ABSENT | ❌ **wrong — the only miss in the optimistic direction** |
| `combobox-popover-overlay-inset` | **expected-wall** two-inset silent hole | PASS | ROUND-TRIPPED | ❌ **wrong** |
| `combobox-listbox-stacking-order` | hard, refused by name | 🔴 UNDECLARED-CARRY | n/a | ❌ **wrong** |
| `combobox-option-selected` | **expected-wall** P10 | PASS | ROUND-TRIPPED | ❌ **wrong** |
| `combobox-option-highlighted` | **expected-wall** `FC-BORDER-STYLE-NOT-SYNTHESISED` | PASS | **NAMED** (dropped, named) | 🟡 partly right — it did not round-trip, and the drop was named rather than silent |

### The two proposed codes, adjudicated

- **`FC-REPEAT-FORWARD-ABSENT`** — proposed, and **not needed for what these
  cases measure**. There is still no forward repetition rule (P9 exists only on
  the canvas→contract leg; the sole capture-side implementation is the unwired
  spike `extract/depth-spike/run.ts`), but its absence did not cost the odd cell
  in a 31-sibling run. Withdrawn as a *wall*; the structural gap is real and is
  discussed under "what these cases do NOT prove" below.
- **`FC-NTH-CHILD-STRIPE-UNREAD`** — proposed, and **withdrawn**. `:nth-child`
  striping has no code, door or lowering rule, and it round-tripped anyway.

Two further codes were withdrawn *before* the run, in `7924f7b0`, when the
survey showed I had claimed "no name exists" against names that do:
`FC-STACKING-ORDER-UNREAD` (z-index is LEDGERED) and
`FC-TABLE-ROW-GROUP-FLATTENED` (`lowerTableDisplay` names row groups).

---

## WHAT THESE CASES DO **NOT** PROVE — read this before quoting any of it

1. **They do not lift `table / data-grid` or `select / combobox` out of
   ATTEMPTED — BOUNDED.** This fixture measures *constructs*, one channel at a
   time, on synthetic markup of 2–35 simple children. A real library's data grid
   is not thirteen green rows; docs/23 §C.1.1's sentence still stands verbatim:
   *"if the component you most want on the canvas is your data grid, this tool
   has never done it."*

2. **The ~200-flat-nodes problem is UNMEASURED here, and it is still real.**
   `repeat-siblings-thirtyone` and `repeat-grid-month` measure whether the ODD
   cell survives — deliberately, because a month that draws 31 identical cells
   and loses the one that differs is recognisably wrong and invisible to any
   instrument that counts nodes. Neither case measures node count, and neither
   asks whether the month became a cell component with 31 instances. It did not.
   Nothing in the capture direction does that.

3. **`combobox-option-selected` passing does not mean selection is expressible.**
   The case spells selection as a *static fill on a sibling*, which is the
   friendly spelling. `selected` is in neither the driven state-plane list nor
   the `FC-STATE-PLANE-UNDRIVEN` list in `spec/channel-table.json`, and
   PATTERN-TAXONOMY.md still marks P10 "Selected-item state inside a collection"
   NOT EXPRESSIBLE. A combobox whose selection is a *state* rather than a
   different element remains untested.

4. **`combobox-popover-overlay-inset` passing is a two-inset result only.**
   `spec/lowering.json emit.position-inset-overlay-four-sides` still fires only
   on all four insets, and its sibling `emit.position-no-inset-falls-in-flow`
   still carries `receipt: {channel: "none"}`. This case took the two-inset path
   and survived; the un-receipted branches those rules describe were not
   exercised and are not cleared.

5. **Flex alignment is measured by nothing.** See red #1. Until
   `carriageOfContract` mirrors the flex spellings, `justify-content` and
   `align-items` cannot pass or fail here, and `spec/channel-table.json`'s
   CARRIED claim for them rests on no measurement.

---

## Reproducing

```bash
npm run conformance:build
npm run conformance:capture -- --case <id>   # one case per invocation; needs Chromium
npm run conformance                          # the gate, against BASELINE.json
npx tsx conformance/canvas.ts                # the round-trip half
```

Denominators moved with this change and were re-pinned in the same commit:
`conformance/MANIFEST.json` 94 → **107** (CARRIED 52→63, REFUSED 19→21, LOWERED
5, UNSUPPORTED **18, unchanged — the decrease-only ratchet is untouched**);
`accuracy/grammar.json` `independentDenominators[css-dom]`; and
`docs/24-what-works.md`, regenerated by `npm run capability:report`.
