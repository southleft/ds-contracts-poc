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
| `switch/antd` | 44×22 | 44×24 | 6.82% | FAIL — instrument, not design |
| `switch/mui` (v3, after fix) | 35×19 ink | 38×19 ink | **4.57%** | PASS |
| `switch/mui` (v2, before fix) | 17×14 ink | 38×19 ink | 35.04% | FAIL |

**5 of 6 current subjects pass, three of them pixel-identical.** That is a real
answer to the owner's question, and it is better news than the impression that
prompted it: the mints are mostly faithful, and where they are not, the defect
is now a number rather than a feeling.

Two failures are open and named:

- **`switch/antd` is NOT a design defect** — I said it was, and re-measured.
  The canvas-gate trim treats anything below 250/255 as ink, and Chromium's
  render carries two rows of sub-threshold AA fringe (241–248) that Figma's
  export does not. At any threshold of 240 or stricter **both sides measure
  44×22 exactly**. The 6.82% is the union-pad misalignment that 2px causes.
  A trim threshold is a tuning choice, and here it manufactured a defect.
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

## 6. CI — was dead, now finishes

`fast.yml` had produced **no verdict in 300 consecutive runs**, all cancelled,
since 2026-08-29. It was not flaky: it invoked 86 SUPERSEDED per-version `:check`
composites for ~21 minutes against a 15-minute timeout, so it could not finish.
At HEAD it died at step 100 of 523 with five steps already red — including
`recipe:table:live:v32:check`, `recipe:combobox:live:v42:check` and
`recipe:calendar:live:v50:check`, the exact lineages the signed archetypes were
signed on. All three pass now that the lane reaches them.

  package.json  2,718 scripts → 436     2,283 superseded lanes removed
  fast.yml      258 steps → 190         86 superseded dropped, 15 added
  ci:lanes      72 defects → 0 (GREEN)   (see below — the metric moved twice first)

The 86 removed steps are replaced by ONE lane, `recipe:live:history:test`, which
runs the per-version test FILES directly: **705 files, 5,080 assertions, 70
seconds**, exit 0.

**It immediately found 30 red tests nobody knew about, and the cause is
structural.**

29 are `recipe/calendar-live-v19..v47-extract.test.ts`. Each asserts — by regex,
against the SOURCE of `recipe/scene-readback-calendar-v1.ts` — that the
day-variant stroke omit reads `(default|selected|outside)` and keeps `today`.
Commit `6c2d00011`, *"PREPARE CALENDAR LIVE V48 — today cell joins the
day-variant strokes omit"*, deliberately changed it to
`(default|today|selected|outside)` when the ring moved to the button at v47.
**v48, v49 and v50 assert the new spelling and pass.** So this is not a
regression; it is 29 historical receipts that a later teaching superseded.

The structural point matters more than the symptom: these per-version tests are
treated as **byte-frozen receipts, but they assert against a file that is not
versioned**. Any later teaching retroactively falsifies every earlier version's
test, and nothing notices while the lane cannot reach them. That is a design
question about the whole per-version scheme, not a calendar bug.

The 30th, `input-field-live-v6-authorization.test.ts`, can only pass in a DIRTY
tree — its last assertion reads the live repository and requires an artifact to
be uncommitted. The repo already knew: a now-deleted `EXCLUDED` reason described
that composite as *"intentionally red after its published authorization."*

Both exclusions are named in the workflow beside the lane.

`ci:lanes` went 72 → 313 the moment the scripts were removed (every per-version
test file was suddenly named by nothing), → 90 with the aggregate lane, and then
to **0 — green for the first time on this branch**:

    ✔ every gate-shaped script is either wired into a lane or excluded with a
      reason; every present test is CI-reachable; every fast/full executable
      step reports independently.

The last 90 closed by adding the 117 `scene-readback-vN` test files my first glob
missed (the lane now runs **822 files, 15,551 assertions, 85 seconds**), laning
my own two new lowering tests, laning the 13 boilerplate archetypes' current
versions, and retiring 4 stale EXCLUDED reasons that named scripts which no
longer exist. **V1-CI-01 is no longer red for this reason.**

**Not done: the source deletion.** Removing the 3,476 superseded
`recipe/*-live-v*` sources (59 MB) would take typecheck from 9,168 errors to
about 47. It is not a mechanical delete — `recipe/pivot-status.ts` hash-pins
historical artifacts by READING those files at runtime with template-built
paths, so the closure is not statically enumerable. Attempted and reverted; it
means rewriting a 20,000-line ledger, which should be a deliberate reviewed
change.

## 6b. The readiness bar could not finish either

A full `v1:readiness` run sat for 62 minutes on `npm run dagger:census` having
used **0.09 seconds of CPU**. dagger:census finishes standalone in under 45
seconds. `runShell` resolved on the child's `'close'` event, which waits for
every stdio stream to end — and a leaked grandchild from an earlier heavy row
(eval spawns Chromium) held the pipe open forever. Fixed to resolve on `'exit'`
with a 2-second drain. That is why no current readiness receipt existed: the bar
could not complete, so its verdict was frozen at whatever last finished.

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
