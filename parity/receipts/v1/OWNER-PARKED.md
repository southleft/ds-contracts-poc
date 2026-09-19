# Parked — things that need the owner, recorded so the queue keeps moving

Each entry is measured, not guessed. Work continued past every one of these
rather than stopping on it.

---

## P1 — CLOSED 2026-09-13: the canvas→code exam ran on a designer's file

**Closed.** The owner opened the Altitude Design System file
(`y83n4o9LOGs74oAoguFcGS`) and the CBDS UI Kit (`WofZT8xaxXuc2Q6Je9S4XE`) in
Figma Desktop with the Desktop Bridge; twenty-four published component sets were
observed read-only (zero writes, REST version pinned before and after, two
identical observes per set) and put through the canvas→code path. **6
accounting-clean, 18 refused by name, nothing silent** (6 and 18 since 2026-09-19: CBDS Alert, 30 of 40 cells, was the one ragged-matrix refusal and is accounting-clean now that its 10 undrawn cells are declared — docs/23 §D.40; the dated receipt records the 5 / 19 measured on 2026-09-13). Receipt: [`CANVAS-TO-CODE-DESIGNER-EXAM.md`](CANVAS-TO-CODE-DESIGNER-EXAM.md);
gate `npm run recipe:canvas-to-code:held-out:v2:check`.

One thing I recorded below was **wrong**, left visible: "point me at such a
file" — the owner already had two (Altitude, CBDS) and their keys were in this
repo's own sync ledger and memory. The blocker was never access; it was that
nobody had asked.

What was originally parked:

**Parked 2026-09-05, during queue item 1.**

The canvas→code held-out exam is green
(`npm run recipe:canvas-to-code:held-out:check`, 6/6). Its own evidence says
what it is, and the repo wrote this against itself before I got here —
`recipe/evidence/canvas-to-code-held-out-v1/named-blockers.json`, severity
`product-incomplete`:

> "The exam substrate (page 33:2, Card 33:5093) was minted by THIS
> repository's code→canvas engine on 2026-08-23 … So this is a round trip on
> our own output: held out from the RECIPE path, not from the project. **A
> canvas→code exam on a file drawn by a designer who never used this tool is
> still owed**, and nothing here should be read as having passed one."

That is still true today and I cannot close it myself. Every page in the only
Figma file I may write — Scratch `byMp6lt0Ij9b2QbkDGFwBh` — was minted by this
repository. A genuine canvas→code measurement needs **a component set drawn by
a person who never used this tool**, in a file I can read.

**What unblocks it:** point me at such a file (read access is enough — the
canvas→code direction only reads), or draw one set by hand on Scratch and say
so. Either turns this from an untested claim into a measured one.

**Why it matters for handing this to colleagues:** the direction they are most
likely to try first — "I have a Figma library, give me code" — has never been
measured on artwork this project did not itself draw.

---

## P2 — CLOSED 2026-09-05: F1 is minted and scored

**Closed the same day it was parked.** The owner opened Scratch with the
Desktop Bridge plugin, and the rest was mechanical. F1 was minted onto
`byMp6lt0Ij9b2QbkDGFwBh` and scored against react-day-picker's own Chromium
render: **pctAAMasked 3.735% against a 5% bar — pass**, with the ink-box
difference (280x247 vs 296x265) named rather than hidden; re-minted
2026-09-13 at **3.048%** (294x263 vs 296x265) once the 16px was measured to
three missing leaves and closed to 2px. See
[`F1-COMPILE-ROUND.md`](F1-COMPILE-ROUND.md).

Two things I recorded here while it was blocked were **wrong**, and I am
leaving the correction visible rather than deleting the claims:

- I wrote that opening Scratch was "the only thing still needed." It was not —
  three further blockers were real, and I found them only by trying.
- I wrote that a live calendar mint was **external-operator-only by design**
  and could not be delivered at any level of effort. That was too strong. The
  `externalOperatorOnly` flag belongs to the v50 lineage's signed
  authorization round; the generic `scripts/run-figma-writer.mjs` path — the
  one the boilerplate archetypes use — minted this calendar without it. I
  reasoned from a template's flags to a capability limit, and I should have
  tried the runner before concluding.

What was genuinely required was fixing four real defects the live mint exposed
(auto-layout primary-axis resize, blank template label, font-load cost, absent
font family) — engineering, not permission.

**Addendum 2026-09-13.** The scope question this park raised — is a calendar
the right F1 exam when a stranger cannot reach it — was answered by the owner:
keep the calendar row **and** add Radix Themes through `recipe:point`. That
second row now exists: avatar 1.88%, switch's four states pass, checkbox
compiles and its mint is refused by name on a shared-runtime defect. See
[`F1-RADIX-ROUND.md`](F1-RADIX-ROUND.md).

**P1 and P2 are closed as measurements.** The owner still grades both F1 rows
and the designer-file exam and signs the amendment. Neither closure supplies
that grade or signature.
