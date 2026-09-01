# The honest scorecard

Written 2026-08-31 on `main`. Every number here was measured in the session that
wrote it, not copied from an older receipt. Where a number is worse than the one
this repo has been advertising, the advertised one is named too.

The reason this page exists: the owner looked at three libraries' minted
checkboxes, said they all looked the same, and doubted the source was real. He
was right to. Nothing in the repo could answer him, because every gate measured
**accounting** or **usability** and none measured **appearance**.

---

## 1. Does the mint look like the real library?

`npx tsx recipe/fidelity-score.ts` — Figma export vs the real package's own
Chromium render, canvas-gate scorer, bar `pctAAMasked ≤ 5%`.

| subject | canvas | real | AA masked | verdict |
| --- | --- | --- | --- | --- |
| `checkbox/astryx` | 22×22 | 22×22 | **0.00%** | PASS |
| `checkbox/antd` | 16×16 | 16×16 | **0.00%** | PASS |
| `checkbox/mui` (v4) | 18×18 | 18×18 | **0.00%** | PASS |
| `checkbox/mui` (v3, before fix) | 24×24 | 18×18 | 49.31% | FAIL |
| `switch/astryx` | 40×24 | 40×24 | **0.00%** | PASS |
| `switch/antd` | 44×22 | 44×24 | 6.82% | FAIL |
| `switch/mui` | 17×14 ink | 38×19 ink | 35.04% | FAIL |

**4 of 6 current subjects pass, three of them pixel-identical.** That is a real
answer to the owner's question, and it is better news than the impression that
prompted it: the mints are mostly faithful, and where they are not, the defect
is now a number rather than a feeling.

Two failures are open and named:

- **`switch/antd`** is 2px short in height (22 against 24).
- **`switch/mui`** does not paint the thumb's elevation shadow, so a white thumb
  on a white ground is invisible and the control reads as a grey blob. This is
  already a **named refusal** (`refusal-thumb-shadow`, "SwitchThumb boxShadow
  theme.shadows[1] — not this teaching"). The receipt made the loss honest; what
  nobody had done was measure what it costs. It costs recognizability. A named
  refusal is not automatically an acceptable one.

## 2. Are the fixtures backed by anything?

`npm run recipe:fixture-drift:check`, 13 archetypes × 3 libraries.

| | before tonight | now |
| --- | --- | --- |
| mechanically matched | 477 | **531** |
| drifted | 57 | **1** |
| receipt (prose, no capture) | 441 | 443 |

The 56 recovered facts were not re-excused — they were **verified**. Every one
was excused under a single `capture-theme-unavailable` cause, which was correct
but described a comparison that could never succeed: `astryx.json` mounts
`<Theme theme={neutralTheme}>` (the library's README quick start) while the
fixtures transcribe un-themed `@astryxdesign/core` defaults. Two real mounts of
one library, compared against each other. `astryx-core.json` captures the mount
the fixtures actually describe, and the drifts became matches.

The single survivor is the deliberate, documented AntD indeterminate-dash
lowering.

**Still true and not fixed: 443 of 975 facts (45%) are prose receipts** — a
written reason why the capture cannot confirm the value. That is the honest
remaining gap in fixture backing.

## 3. Canvas → code

The number the receipts report is `silent: 0`. That number **cannot fail**:
every fact passes through a `switch` whose `default:` arm emits a `receipted`
row, so `silent` counts facts that were bucketed, not facts that were verified.

The number that means something is in the same receipt and is quoted nowhere:

| exam | facts | matched | share |
| --- | --- | --- | --- |
| held-out AntD Card | 495 | 46 | **9.3%** |
| Button | 8,733 | 2,404 | **27.5%** |

All 2,295 token `binding` facts are carried, never compared. And the "held-out"
Card was minted by **this repo's own engine** eight days earlier — held out from
the recipe path, not from the project. That is now disclosed in the receipt as
the named blocker `substrate-is-our-own-mint`.

## 4. The oldest measured mint-vs-library number

`parity/receipts/console-loop/mui/scores/` compares canvas cells to real MUI
`orig-shots` at the same ≤5% bar: **8 pass, 23 fail** (dialog 94.9%, menu 78.9%,
snackbar 72.6%). That is a different, pre-pivot pipeline — but it is the only
other place in the repo where a mint was scored against a real library, and it
should be read beside §1 rather than quietly superseded by it.

## 5. Typecheck

`npm run typecheck` exits **0** — because commit `47a14aae5` removed `recipe`
from `tsconfig.json`'s `include` on 2026-08-30, one day after the last real
measurement. Checked directly over `recipe/*.ts`:

**9,168 errors across 792 files. 9,121 of them (99.49%) are in version-tokened
copies; 47 are in 17 real source files.**

Two of those are genuine defects the duplication is hiding: **21 × TS1117**
(duplicate object keys in `build-input-field-live-proof-v*.ts`, where the first
value is silently discarded — a dropped fact with no receipt) and 2 × TS2300
duplicate identifiers.

Audit rows **AUD-V06 (P0)** and **AUD-U37 (P1)** are satisfied today by
exclusion, not by fix.

## 6. CI

`fast.yml` has produced **no verdict in 300 consecutive runs**, all cancelled,
since 2026-08-29. Last success: 2026-08-27. The lane spends ~21 minutes on 81
`recipe:input-field:live:vN:check` steps against a 15-minute timeout, so it
cannot finish. At HEAD it died at step 100 of 523 with five steps already red —
including `recipe:table:live:v32:check`, `recipe:combobox:live:v42:check` and
`recipe:calendar:live:v50:check`, the exact lineages the signed archetypes were
signed on.

`ci:lanes` reports 72 defects: 33 gate-shaped scripts no workflow runs, and 39
test files no CI-invoked script names.

## 7. Scale

2,712 npm scripts, of which **2,389 (88%) are per-version live lanes**
(input-field 823, calendar 600, combobox 504, table 384). 12,468 tracked files
and 1,217 MB under `recipe/` carry a version token — 95% of that directory and
~55% of the whole tracked tree. The salvageable recipe-IR core is roughly 280
files and 5 MB.

---

## What this adds up to

The architecture is real and the mints are mostly faithful. What is not real is
the **reporting**: the headline numbers this repo advertises (`silent: 0`,
typecheck green, "13×3 boilerplate corpus") are each true in a narrow sense that
does not mean what a reader would take them to mean, and the numbers that do
mean something were sitting unquoted in the same files.

Product **v1 is incomplete**. Nothing on this page flips `overallSuccess`, and
no grade is invented here.
