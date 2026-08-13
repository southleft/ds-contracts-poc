# CONTINUE — freeze-board fidelity, feat/freeze-board-wave2

## PHASE CLOSED — FREEZE WAVE 2 (2026-08-13)

**The freeze-board climb is PAUSED, not abandoned.** This branch is a closeout,
not a checkpoint mid-climb: every number below is re-derived from the committed
artifacts, every gate is green or NAMED, and the live canvas has been verified
against its pins. The next track is public-beta-prep, and it starts only AFTER
this merges to main.

### THE BOARD, re-counted from artifacts at closeout (not from memory)

    lane           bridge    headless   claimed
    first-party    11/20     10/54      11
    mui             8/31      7/31       7
    tailwind         4/5       4/5        4
    altitude         4/8       4/8        4
    astryx          1/11      0/13        0
    carbon          3/10      2/10        3
    polaris         4/12      4/12        4
    TOTAL          35/97    31/133       33      (133 receipts carry a visual block)

    RATCHET floors: first-party 10 · mui 7 · tailwind 4 · altitude 4 ·
                    astryx 1 · carbon 2 · polaris 3

The three numbers mean different things and the difference is the point.
**bridge/headless are SCORECARD passes** — recomputed from each scorecard's own
metrics (`status pass && compositionOk && pctAAMasked <= 5`), never from a
receipt boolean. **claimed is RECEIPT claims**, and it is 33 rather than 35
because mui/autocomplete was UNCLAIMED this phase (3.87 bridge / 8.93 headless
— a one-instrument pass is not a claim) and astryx/badge is HELD unclaimed for
the same reason (4.88 / 5.36).

**WHAT THIS PHASE EARNED: exactly one pass**, mui/slider 7.96 → 0.57 bridge /
0.56 headless, by a contract + emitter fix (the coincident shadow-only pseudo
fold). Everything else that moved was a correction, a repair, or a guard.

### DECISIONS THAT ARE SETTLED — DO NOT REOPEN WITHOUT THE OWNER

  · **OPTION B IS LOCKED.** `FC-GEOMETRY-EXCLUDED` (extract/computed/fuse.ts)
    stays. Width/height carriage is NOT relaxed. Relaxing it is the change that
    previously minted the capture WINDOW as tokens in four of six libraries.
    The obligation it carries is to LEDGER the drop, never to fix it.
  · **THE ASTRYX FLOOR IS HELD.** `visual-truth:check` reports
    `astryx: headless pass-count 0 < RATCHET floor 1`. That red is EXPECTED,
    pre-existing, and deliberately not cleared: clearing it means claiming
    astryx/badge on one instrument, which is exactly the discipline
    mui/autocomplete was just unclaimed under. **Do not make this green.**
  · **The ONE bar is unchanged:** `pctAAMasked <= 5 && compositionOk`. No
    scorer, ratchet or tolerance was relaxed in this phase.

### DEFERRED — NAMED, MEASURED, AND NOT TO BE REOPENED WITHOUT THE OWNER

  1. **blockStage reference re-capture** (`FC-REF-STAGE-WIDTH`). mui/alert and
     astryx/banner are scored against a reference whose width IS the harness
     stage content box (mui: stage 320 − 2×16 = 288, exactly the reference's
     ink width; Alert is `blockStage: true`). The canvas hugs and is faithful
     to its contract render to 1px. Closing it needs references re-rendered at
     the hug width, i.e. turning `blockStage` off and RE-CAPTURING — which
     changes what captured truth measures corpus-wide (mui 13 components,
     carbon 4, astryx 4, altitude 2, fluent 1).
  2. **Emit carrying the composition fill spec.** The real closure for
     `FC-SLOT-FILL-OUTSIDE-EMIT`; the guard below is the cheap half.
  3. **`FC-GEOMETRY-EXCLUDED` ledger silence.** 14 of its 15 census entries are
     still silent (only mui/fab's receipt names it). Emitting a codeOnly entry
     per drop changes no geometry and moves no number.
  4. **Glyph-AA residue** (`FC-GLYPH-RASTER-PHASE`). Ten near-bar stems have
     **0.00% flat-fill failing mass** — every failing pixel is an antialias
     boundary, and the residual survives a radius-1 colour search at 2.5–4.3%
     where a real 1px shift collapses to 0.09%. Two rasterizers disagreeing
     about identical geometry. **No bar change. No tolerance. Not a climb.**

### OPERATING RULE (the one that bit this phase)

> **Never re-run a first-party COMPOSITION script without re-applying its
> `docs/composition-corpus` fill pin immediately afterwards** — one `ds.badge`,
> Variant=Info, per slot; the per-stem pin lives in each receipt's
> `visual.notes`.

The emitter builds slots EMPTY by design (no contract declares
`defaultContent`), so a bare rebuild blanks the scored surface. This is not
hypothetical: it happened in wave 4, out of scope, and blanked all five stems.
It is repaired and re-verified. **Forgetting is now CAUGHT** — first-party is
pinned (C1 box + C1b `FC-CELL-INK-LOST`), red-tested in both failure shapes,
and both are fixtures in the framing test suite.

Note the shape of the hole, because the same five stems sat in both halves of
it: the composition stems are the ones whose contracts anchor `fileKey: null`
(so their scripts carry NO file guard and will run anywhere) AND the ones whose
scored surface is applied outside emit. Nothing pinned them; now something does.

### SUITE AND GATES AT CLOSEOUT — what was run, and what is red on purpose

**The FULL suite ran to completion; no `--only` matrix was needed.**
`npx tsx evals/run.ts` → **222/225**. Three reds, all named:

    mui-figma-genesis                     PRE-EXISTING at branch HEAD. switch.figma.js
                                          headless execute: switch-track(medium) pin
                                          expected 34x14, found 1x1. Untouched by this
                                          branch.
    child-wider-ratchet-and-script-freshness
                                          PRE-EXISTING at branch HEAD. astryx/fluent
                                          text-wrapping overflow ratchet (docs/22).
                                          Untouched by this branch.
    capability-report-is-fresh            CIRCULAR-BY-CONSTRUCTION and CLOSED. The report
                                          reads evals/results.json, and a full run
                                          rewrites it. Regenerated after the final run
                                          (`npm run capability:report`) and re-verified
                                          green; docs/24-what-works.md now reads 222/225.

**A FULL-SUITE RUN IS WHAT CAUGHT THE ONE REAL REGRESSION THIS BRANCH HAD**, and it
is worth recording why it hid for two waves: the anchor re-point landed in wave 4,
but wave 4 only ran a four-eval `--only` subset. The last full run before this
closeout predated the re-point. **A subset cannot find a cross-cutting regression.**

    baseline-parity-clean · detect-stale-snapshot · promotion-converges ·
    pending-first-sync-not-drift          RED after the anchor re-point, FIXED here.

**THE CAUSE: `anchors.figma.fileKey` HAS TWO CONSUMERS THAT WANT DIFFERENT ANSWERS.**

  · `parity/diff.ts:203` reads **`contracts[0]`** — one key, taken as "the Figma file
    this design system is synced to" — and compares it against
    `parity/snapshots/figma-components.json` / `figma-tokens.json`, which were
    extracted from `8nim1d0IPnehMxA7B7SYxC` ("DS Contracts POC": 49 component sets,
    3 variable collections, 282 variables).
  · `scripts/generate-figma.ts` gives **each contract its own** anchor as the emitted
    script's `EXPECTED_FILE_KEY` guard — which is what the console-loop rebuild needs.

Wave 4 moved 48 contracts to the playground to satisfy the second consumer, which
silently orphaned the first: `contracts[0]` (accordion-item, alphabetically first and
NOT a console-loop stem) moved with them, so the parity spine started reporting that
its snapshots describe a different file.

**THE FIX WAS TO EXECUTE DECISION A AS WRITTEN RATHER THAN MORE BROADLY.** The
decision named the stems with LIVE-SNAPSHOT evidence; the other 38 were my own
declaration and are what broke parity. Anchors now:

    8nim1d0IPnehMxA7B7SYxC   38  the DS file — parity spine, tokens + batch scripts
    BMjUA2ue5CaZXU4kufxL0z   10  avatar badge banner button card checkbox divider
                                 switch text-field token   (LIVE-SNAPSHOT evidence)
    GnQnjSNBXtgtd2Ht0Hs1C8    3  progress-bar slider spinner  (LIVE-SNAPSHOT evidence)
    (null)                    5  the composition stems, untouched

Re-extracting the snapshots from the playground was considered and REJECTED: BMjUA
is a scratch file with a fraction of the DS file's sets, so it would have degraded
the parity baseline rather than fixed it. Both consumers are now green, and the
per-stem console-loop guards are unchanged where they matter (16-checkbox,
49-textfield, 06-button → BMjUA; 34/38/39 → GnQnj).

**GATE BATTERY — all green or named:**

    console-loop:all:evidence:check    8/8 lanes green
    capture-framing                    87 pinned stems / 7 lanes, 0 new open findings
    capture-framing test suite         20/20 (incl. both FC-SLOT-FILL red-tests)
    canvas-drift probe                 all 7 lanes; first-party 18 in-sync / 0 drift
    figma-scripts-fresh                8/8 byte-fresh
    plugin-engine-check                all flows green (receipt re-recorded)
    alpha-composite probe              green, legacy ink-box collapse still pinned
    golden manifest                    291 files, re-recorded after the re-emit
    visual-truth:check                 ✖ astryx floor — EXPECTED, see decisions above

**LIVE CANVAS VERIFIED (read-only)** on `BMjUA2ue5CaZXU4kufxL0z`: all eight pinned
stems PIN-OK against their committed cell dimensions, and every composition slot is
FILLED (5/6/4/2/2). No blank slots. The pin was extended this round from the five
composition stems to eight, adding checkbox/text-field/button — cheap precisely
because their byte-identical rebuild is already measured, so the pin records a fact
rather than a hope.

### MERGE PREP

    branch      feat/freeze-board-wave2
    base        main
    status      SAFE TO MERGE — tree clean, full suite 222/225 with all three reds
                named above (two pre-existing at branch HEAD, one closed).
    HEAD        (stamped in the closeout commit; `git rev-parse HEAD` after it lands)

**WHAT A HUMAN MUST DO — none of it is required to merge, all of it is required to
CONTINUE the console-loop:**

  1. **Open the right Figma files on the Desktop Bridge before any rebuild round.**
     `BMjUA2ue5CaZXU4kufxL0z` ("Latest DS Contracts Tests") — the first-party
     playground, where the composition stems and the pinned first-party cells live.
     `GnQnjSNBXtgtd2Ht0Hs1C8` ("DS Contracts Testing") — altitude/astryx/carbon/
     polaris/tailwind, plus first-party progress-bar/slider/spinner.
     `59mLQlOMiD5w5za6SUcoO5` ("MUI Test 1") — the mui lane.
     `8nim1d0IPnehMxA7B7SYxC` ("DS Contracts POC") is the PARITY file: it is what the
     committed snapshots describe and what the tokens/batch scripts guard. It does
     NOT need to be open for console-loop work, and it was not reachable from the
     bridge during this phase.
  2. **Push.** Nothing was pushed in this phase and no PR was opened (by instruction).
  3. **The stem-serve helper** (`node scripts/console-loop-stem-serve.mjs 9224`) is a
     local dev process, not part of the branch; it must be running for any bridge
     rebuild round.

**THE ONE OPERATING RULE THAT SURVIVES THIS BRANCH** — repeated here because it is
the thing most likely to be forgotten by whoever picks this up: never re-run a
first-party COMPOSITION script without re-applying its `docs/composition-corpus`
fill pin immediately afterwards. C1/C1b now refuses a forgotten fill by name, so the
failure mode is a named check error rather than a silently blanked canvas.

**NOTHING IN THIS PHASE OPENED A NEW CLIMB.** No BETA.md, no public-journey work, no
new FC taxonomy round, no scorer or ratchet relaxed, no claimed pass hunted. The next
track is public-beta-prep, after this merges.

### NEXT TRACK

**public-beta-prep — AFTER this branch merges to main.** Not started here, by
instruction. No BETA.md, no public-journey work, no new climb was opened in
this phase.


## DECIDED — OPTION B IS LOCKED. THE GEOMETRY EXCLUSION STAYS.

**`FC-GEOMETRY-EXCLUDED` (extract/computed/fuse.ts:555-565) is KEPT. Do not
relax width/height carriage. This is settled, not open.**

fuse excludes geometry channels (width/height/insets) from fusion as
environment-dependent, admitting them only for absolute-cluster parts, table
cells and the block-root/overlay doors. That exclusion is DELIBERATE and it
stays. The rejected alternative is on the record: relaxing it is the change that
previously minted the capture WINDOW as tokens in four of six libraries, and no
board movement is worth re-opening that regression class.

WHAT THIS DECISION OBLIGES. The exclusion must be LEDGERED, NOT FIXED. It is
currently SILENT for 14 of its 15 census entries — only `mui/fab`'s component
receipt names it. The remaining honest work is to emit a codeOnly/ledger entry
naming each drop. That changes NO geometry, moves NO board number, and closes
the honesty gap. Anyone who "fixes" this by touching the fuse exclusion is
undoing a decision, not finishing one.

TAXONOMY: `FC-BASE-EQUAL-GEOMETRY-DROPPED` is SUPERSEDED and stays superseded.
One cause, one name, and the 2026-08-09 name wins. The census lives in
`BASE-EQUAL-GEOMETRY-SWEEP.json` (15 findings / 10 stems / 6 libraries) and now
carries `FC-GEOMETRY-EXCLUDED` throughout. Its original base-equal-delta
explanation was killed by measurement (replay.ts:148 seeds each combo from base,
so an absent delta keeps the base value) — keep the findings, not that story.

## WAVE 3 STEP 1 — polaris/badge ROOT-CAUSED. IT WAS NEVER A REBUILD REGRESSION.

**The rebuild did not break this stem; it stopped hiding a pre-existing colour
defect.** Measured, in order:

1. The live cell is unchanged in geometry: 61x20, label "Fulfilled" 45x16.
2. Its background is `rgba(0,0,0,0.0588)` bound to
   `imported/badge/root/background-color/enabled`, and the CAPTURE agrees:
   `extract/computed/out/badge/captured-truth.json` base root
   `background-color: rgba(0, 0, 0, 0.06)`. **The emitter is faithful.**
3. That ~6% alpha is below the scorer's ink threshold, so the ink box collapses
   to the TEXT alone (43x11). The pre-rebuild canvas had an opaque-ish
   background giving a 61x20 ink box, which diluted the comparison. Restoring
   the correct alpha made the measurement honest and the score went 7.21 ->
   32.98. **The number got worse because the instrument got honest** — the same
   pattern as the divider and table passes removed earlier.
4. What the honest box then exposed is a REAL colour defect:
       canvas label fill  rgb(48,48,48)  = #303030
       library capture    rgba(97,97,97) = #616161
   The cell is `Tone=enabled`; the contract maps tone.enabled ->
   `{imported.badge.root.color.enabled}`, which the mint aliased to
   `{p.color-text}` (#303030). But the capture has **NO `enabled` delta at all**
   — deltas exist only for info/success/warning/critical/attention/magic — so
   `enabled` IS the base, and the base colour is #616161. Note
   `imported.badge.label.color.none` is already the correct **#616161**, and
   `imported.badge.root.color.none` is `{p.color-text-secondary}`.

## WAVE 4 (2026-08-12) — THE THREE FORKS ARE DECIDED AND EXECUTED. CLAIMED 33 → 32.
##   (amended same day: the fifth section's FC name was WRONG and is withdrawn
##    below; the live-canvas damage it describes is REPAIRED and re-verified.)

The owner took all three forks recorded at the end of wave 3. This section is
what executing them measured.

### A. FIRST-PARTY ANCHORS RE-POINTED — `FC-SCRIPT-FILEKEY-PIN` IS CLOSED

**SUPERSEDED IN PART BY THE CLOSEOUT — read the "SUITE AND GATES" section at the
top first.** The 48-contract move described below was TOO BROAD: it orphaned the
parity snapshots (`anchors.figma.fileKey` has two consumers), reddened four
parity evals, and was narrowed at closeout to the 13 stems decision A actually
named. The paragraph below is kept as the record of what was done and why; the
final anchor split is the one in the closeout section.

51 first-party contracts anchored `8nim1d0IPnehMxA7B7SYxC`, a file nobody
builds into. They now anchor where the lane actually lives:

    progress-bar · slider · spinner   → GnQnjSNBXtgtd2Ht0Hs1C8   (snapshot evidence)
    the other 48                      → BMjUA2ue5CaZXU4kufxL0z   (10 with snapshot
                                        evidence, 38 as the lane's declared build target)
                                        ← THE 38 WERE REVERTED AT CLOSEOUT
    bento-grid · grid-gallery · page-shell · sidebar-layout · two-column
                                      → UNTOUCHED, anchor was already null

Only 18 of those moves are backed by a measured canvas
(`canvas-drift/LIVE-SNAPSHOT.json`); the remaining 33 are a DECLARATION of
where the lane is built, not a measurement, and are recorded as such. **That
distinction turned out to be the whole defect: the declared 33 are exactly what
broke the parity spine, and the measured 18 are exactly what survived the
closeout.** The per-component scripts each take their own contract's anchor, so
`16-checkbox.js`, `49-textfield.js` and `06-button.js` guard
`BMjUA2ue5CaZXU4kufxL0z` and `34/38/39` guard `GnQnj…` — unchanged by the
narrowing. `01-tokens.js` and the five `batch-*.js` take `contracts[0]`, which
is BACK to the DS file, which is what the parity snapshots describe.

**THE GUARD PASSED AND THE CANVAS REPRODUCED EXACTLY.** checkbox (6 variants),
text-field (3) and button (24) rebuilt from their own committed scripts on the
file their scorecards were shot on — the thing that was impossible last wave —
and their reshot PNGs came back **byte-identical to the committed ones**
(`git status` clean on all three shots). Rescored on both instruments:

    first-party/checkbox     5.16 bridge · 5.14 headless   unchanged
    first-party/text-field   5.84 bridge · 5.84 headless   unchanged
    first-party/button       7.30 bridge · 7.13 headless   unchanged

No flips, correctly — the bar is 5 and none reached it. What changed is
PROVENANCE, not the board: these three are now demonstrably what their
committed scripts build, and wave 3's `FC-GLYPH-RASTER-PHASE` naming for them
survives its first real test.

### B. mui/autocomplete UNCLAIMED — CLAIMED BOARD 33 → 32

Lane scorer 3.87 (pass), headless REST 8.93 (FAIL), compositionOk true on both.
The receipt claimed `scored-pass` on the bridge number alone. It is now
`fail-closed` with `acceptance.visualMatchDeveloped: false`.

Nothing about that canvas is known to be wrong — **this is a claim-discipline
correction, not a newly measured defect, and it LOWERS the board by one.** The
claim was made in the 2026-08-10 rebuild-then-pin wave when the bridge number
moved 8.93 → 3.87; the headless card did not move and was not re-read. The
discipline is the one astryx/badge is HELD under (4.88 bridge / 5.36 headless),
and it now applies to both stems or neither.

The RATCHET is unaffected: it counts scorecard passes, not receipt claims, and
autocomplete's bridge scorecard still passes. mui floor 7 holds against 8
bridge / 7 headless.

### C. blockStage REFERENCE RE-CAPTURE — DEFERRED BY DECISION

`FC-REF-STAGE-WIDTH` stays named on mui/alert and astryx/banner. No recapture
this wave.

### AND A FIFTH THING THAT WAS NOT ASKED FOR, WHICH I BROKE AND HAVE NOW REPAIRED

**I rebuilt the five first-party LAYOUT stems — bento-grid, grid-gallery,
page-shell, sidebar-layout, two-column — which are neither near-bar nor
failing, and it emptied every slot on the live canvas.** They are slot
components; the emitted script builds slots EMPTY, and on the hugging stems an
empty slot collapses the box:

    sidebar-layout   640x23 → 640x1     two-column   640x23 → 640x1
    grid-gallery     640x62 → 640x18    bento-grid / page-shell: box held (FIXED
                                        tracks), but every slot emptied

Rescored at that point all five read `inkCanvasPct 0.0` — blank — and failed
compositionOk, exactly as that guard is meant to.

**REPAIRED 2026-08-12, and the repair is proven rather than asserted.** Each
slot was re-filled with the child the corpus PINS for it, then reshot and
rescored on both instruments:

    two-column      640x23 · Start 312x23 · End 312x23      0.63  bridge · 0.63 headless
    sidebar-layout  640x23 · Sidebar 240x23 · Main 376x23   0.75  · 0.75
    grid-gallery    640x62 · six 203x23                     0.34  · 0.34
    bento-grid      640x480                                 0.10  · 0.10
    page-shell      640x480                                 0.08  · 0.08

Every reshot PNG came back **byte-identical to the committed one** (`git
status` clean on all five shots) and every scorecard metric is unchanged — the
only diff in the five scorecards is `recordedAt`, and in the five headless
cards `fileVersion`. The live file is back to exactly where it was.

**MY `FC-SLOT-PLACEHOLDER-NOT-SCRIPTED` CLAIM WAS WRONG AND IS WITHDRAWN.** I
wrote that the Badge placeholders in the committed shots "were never
script-produced" and that three passing stems were therefore scored against a
canvas their contract does not describe. That was a conclusion drawn from the
contract alone, and the contract is not where this convention lives. It is
documented, pinned and committed:

  · `docs/composition-corpus/README.md` §"THE SCORING CONVENTION (pinned before
    the first contract was authored)" defines TWO surfaces — **(a) EMPTY,
    scored structurally, never by pixels**, and **(b) FILLED, both surfaces
    populated with the SAME pinned child components, scored under the standard
    bar**. "A slot filled on one surface and empty on the other is a DIFF,
    never a normalization."
  · The pin is recorded per stem in its own receipt: "FILLED pins the SAME
    child on both surfaces (one ds.badge, Variant=Info)".
  · `scripts/console-loop-render-composition-ref.mts` takes that fill spec as
    an argument and renders the CODE side with it — which is why the reference
    PNG has Badges in it too.

So the Badges are a committed convention applied identically to both surfaces,
not an unscripted hand-fill, and those three passes were never resting on an
invented canvas. Restoring them was reproducing a pin, not inventing one.

**WHAT IS ACTUALLY TRUE, AND IT IS NARROWER — `FC-SLOT-FILL-OUTSIDE-EMIT`.**
The emitter builds slots empty by design (no contract declares
`defaultContent`; only page-shell declares `accepts`, which is a type
constraint, not content). The FILLED surface is applied as a SEPARATE step
outside the emitter. The consequence is real and it is what bit me:

> **Re-running a composition stem's own committed script silently EMPTIES its
> filled surface, and nothing in the loop warns.** (STATE AS FOUND — the guard
> below has since closed the "nothing warns" half.) No first-party
> `framing.json` existed, so the capture-framing C1 pin — which is exactly what
> caught the astryx/banner geometry change — did not cover this lane at all.
> The only signal was the score failing afterwards, by which time the canvas
> was already gone.

THE FORK WAS TAKEN — **OPTION 2 (THE GUARD) IS LANDED**; option 1 (emit carries
the fill) is still open and is still the actual closure.

### THE GUARD: first-party is pinned, and C1 grew the half it was missing

`parity/receipts/console-loop/framing.json` now exists — the lane's first
capture-framing pin. Cell dimensions are minted from the Desktop Bridge with
every slot FILLED, immediately after the repair, and verified against the
committed evidence: every reshot PNG was byte-identical and every scorecard
metric unchanged, so the pin describes the same canvas the board was scored on.
The checker learned two things:

  · `laneRoot()` — the SAME rule the scorer uses. Every path in the checker was
    `path.join(CL, lane, …)` and the lane list was six hard-coded FOREIGN
    lanes, so first-party could not be pinned even in principle. That is the
    mechanical reason this lane went unguarded while carrying the largest
    ratchet floor.
  · **C1b, `FC-CELL-INK-LOST`** — because C1 alone only half-closes this. C1 is
    a BOX check, and the damage has TWO shapes:

        HUG tracks    the cell COLLAPSES — sidebar-layout 640x23 → 640x1 —
                      and C1's box comparison bites.
        FIXED tracks  bento-grid and page-shell hold a perfectly correct
                      640x480 and lose ONLY their content. C1 sees nothing.

    Measured 2026-08-12: all five read `inkCanvasPct 0.0`, two of them at the
    right box. C1b pins a per-stem ink floor well under the measured ink
    (`inkMeasuredPct` is recorded beside it), counted with contentBox's own
    composite-over-white rule so it agrees with the scorer. It cannot fire on
    antialiasing; it fires on a surface that went blank.

**RED-TESTED IN BOTH SHAPES, and both are now fixtures** in
`console-loop-capture-framing-check.test.mjs` (18 → 20 tests, all green) so
neither half can regress into silence again:

    blank at the right box   first-party/page-shell     → FC-CELL-INK-LOST
    collapsed cell           first-party/sidebar-layout → FC-CELL-FRAMING

The committed tree is green: 84 pinned stems across 7 lanes (was 79 across 6),
5 newly cell-pinned, 0 new open findings.

**SCOPE, stated rather than silent.** The pin covers the five COMPOSITION stems
only. The other ten first-party stems are not slot components, carry no filled
surface, and checkbox/text-field/button each rebuilt byte-identically on
2026-08-12 — so the hazard does not apply to them. Extending the pin to them is
a separate cheap round.

### WHAT THE GUARD DOES NOT DO

It refuses a bad capture; it does not stop the canvas being emptied. Option 1
remains the closure: teach the rebuild path to read a committed fill spec so
`rebuild → reshoot → rescore` is closed for compositions the way it is for
every other lane. Until that lands the operating rule is unchanged —

**do not re-run a composition stem's script without re-applying its
`docs/composition-corpus` fill pin immediately afterwards** (one `ds.badge`,
Variant=Info, per slot; the per-stem pin is in each receipt's `visual.notes`).

The difference is that forgetting is now caught at check time, by name, instead
of surfacing as a blank score after the canvas is already gone.


## WHERE WAVE 3 STOPPED, AND THE FORK IT LEAVES

**+1 EARNED, NOT +2, AND THE SECOND ONE IS NOT AVAILABLE WITHOUT AN OWNER
DECISION.** mui/slider is the wave's only new pass. Two real defects were
closed (`pseudo-decor-outside-grammar` for a coincident shadow-only pseudo, and
`FC-AMEND-CANNOT-CLEAR`); only the first produced a pass, and the second made
its stem's number worse while making its canvas correct.

**EVERY NEAR-BAR STEM IS NOW REBUILT, RESCORED AND NAMED.** Eleven stems were
rebuilt from their own committed scripts. Not one number moved on a rebuild
alone. Each residual carries a cause:

    FC-GLYPH-RASTER-PHASE   first-party/checkbox · first-party/text-field ·
                            first-party/button · tailwind/toggle-switch ·
                            carbon/toggle · carbon/accordion · mui/text-field ·
                            mui/table-pagination · mui/tabs · polaris/badge
    FC-REF-STAGE-WIDTH      mui/alert · astryx/banner
    FC-SCRIPT-FILEKEY-PIN   first-party/checkbox · text-field · button
                            (cannot be rebuilt at all)

None of the three is closeable by an emitter or contract change, and each is
unclosable for a DIFFERENT reason, which is why no further wave of the same
shape will move them:

  · glyph-raster phase is two rasterizers disagreeing about the same geometry.
    Verified by a radius-1 colour search: these hold 2.5–4.3% where a real
    1px shift collapses to 0.09%. Closing it needs the instrument, not the
    canvas — and relaxing the instrument is forbidden.
  · stage width is the harness window in the reference. Closing it needs a
    reference RE-RENDERED at the hug width, which means turning `blockStage`
    off for those components and RE-CAPTURING — a corpus-wide change to what
    the captured truth measures. Widening the canvas instead would mint the
    capture window as a component fact: the exact regression Option B settled.
  · the fileKey pin needs the anchored file opened on the bridge, or the
    first-party anchors re-pointed at the playground files.

**THE FORK, MEASURED.** Three decisions are the owner's, and all three are
blocked on something this loop must not do unilaterally:

  1. **first-party anchors.** `contracts/*.contract.json` anchor
     `8nim1d0IPnehMxA7B7SYxC`; every first-party scorecard was shot on
     `BMjUA2ue5CaZXU4kufxL0z` / `GnQnjSNBXtgtd2Ht0Hs1C8`. Open the anchored
     file, or re-point the anchors. Until then the lane with the LARGEST
     ratchet floor (10) has no script-level reproducibility, and the three
     stems closest to the bar anywhere on the board sit inside it.
  2. **blockStage references.** mui 13 components, carbon 4, astryx 4,
     altitude 2, fluent 1 render their reference at the stage content box. Two
     near-bar stems are already known to be scored against a window rather
     than a component. Re-capturing changes numbers corpus-wide.
  3. **mui/autocomplete's one-instrument claim.** `scored-pass` on a 3.87 lane
     scorer and 8.93 headless. Identical in shape to astryx/badge, which is
     correctly HELD unclaimed. Either the both-instruments discipline applies
     to both or to neither; un-claiming lowers the board, so it is named here
     rather than done.

**WHAT A NEXT WAVE SHOULD NOT DO.** Not another rebuild round — that question
is now answered with eleven measurements. Not a scorer tolerance for glyph AA;
that is the instrument rewarding itself. The remaining honest moves are all
upstream of the canvas: re-render references at the hug width, or re-point the
first-party anchors, or accept the tier as named and go after stems that are
NOT in it.

## WAVE 3b — FC-AMEND-CANNOT-CLEAR: THE AMEND PATH COULD NEVER REMOVE A FACT THE CONTRACT DROPPED, AND A WRONG CANVAS WAS SCORING BETTER THAN A RIGHT ONE

astryx/banner's cell was **331x88 against a reference and a contract render
that both measure 64 tall.** Its ROOT carried a bound 12/16 padding + gap 8
that its committed spec does not declare — the header part's padding applied
TWICE (header 299x64 → root 331x88).

**THE CAUSE IS STRUCTURAL AND IT WAS INVISIBLE BY CONSTRUCTION.**
`applyFrameSpec` only ever SET what the spec declares. On the CREATE path that
is correct — a fresh `createComponent` starts at 0. On the AMEND path a
spacing fact the contract had since DROPPED survived on the node forever, and
the two paths silently disagreed. `specHash` matching then reported
`skipped: unchanged` over the top of it, which is exactly what the wave-3
rebuild sweep saw: astryx/banner rebuilt under rt12, all 8 variants, and came
back byte-identically wrong at 8.13. **A rebuild cannot fix a value a rebuild
cannot clear.**

The fix resets undeclared `paddingTop/Right/Bottom/Left/itemSpacing` (and their
bound variables) before applying the declared ones —
`RUNTIME_EMIT_REV rt12-birthbox-declared-layout-only → rt13-amend-clears-undeclared-spacing`.
Only the ROOT needs it: amend removes and rebuilds every child, so no
descendant can hold stale state.

**BLAST RADIUS MEASURED BEFORE THE CHANGE WAS WRITTEN, not after.** Every one
of the 77 scored cells on both connected files was read live and compared
against its own committed spec's root bindings/lits. 34 roots carry padding;
33 of them DECLARE it. astryx/banner was the only root in the corpus carrying
spacing its spec does not claim, so the reset changes exactly one scored cell.

    astryx/banner   331x88 → 299x64,  root padding 12/16/12/16 → 0/0/0/0
    height          88 vs ref 64      →  64 vs ref 64, EXACT

**AND THE SCORE GOT WORSE: 8.60 → 14.94 bridge, 9.90 → 10.43 headless.** That
is the finding worth keeping, not a regression. At the wrong 331x88 the scorer
dpr-halved and size-normalized the pair into 160x32 and read 8.60; at the
correct 299x64 it does neither — heights are identical — and the residual is
now the honest one: **`FC-REF-STAGE-WIDTH`, the same cause as mui/alert.** 320
is astryx's stage content box for this stem (352 file − 2×16 padding) and
Banner is `blockStage: true`, so a block element FILLS it; 320 is a fact about
the harness. The canvas hugs at 299, the contract render hugs at 284, and the
scorer rescales 299→320 (1.07×). **A SIZE-NORMALIZED AA NUMBER CAN REWARD A
WRONG BOX** — the normalization that makes two differently-sized boxes
comparable also hid a 24px height error and punished its removal.

The framing pin was re-recorded (astryx/framing.json, 331x88 → 299x64) with
that reason attached; it is the pin that caught the change, correctly, as a
hard C1 violation before anything else did.

TWO THINGS THIS COSTS, both stated rather than absorbed:
  · Every emitted script's `specHash` changed with the rev bump, so the
    wave-3 sweep's `skipped: unchanged` results are historical facts about
    rt12, not predictions about the next rebuild. They were true when measured.
  · All 8 libraries were re-emitted and their GENESIS batches rebuilt; the
    plugin engine receipt was re-recorded twice this session (once for the
    shadow fold, once for this).

## WAVE 3 — ONE PASS EARNED (mui/slider), AND THE REST OF THE NEAR-BAR TIER IS NOT A REBUILD PROBLEM

**mui/slider 7.96 -> 0.57 bridge / 7.96 -> 0.56 headless, both instruments,
compositionOk true.** Earned by a contract + emitter fix, not by re-reading a
receipt. It is the wave's only earn and the rest of this section says why.

### THE FIX: A COINCIDENT SHADOW-ONLY PSEUDO NOW FOLDS ONTO ITS HOST

`.MuiSlider-thumb` is a 20x20 circle with `box-shadow: none`. Its `::before` is
a COINCIDENT 20x20 transparent circle (position absolute, top/left 0, same
`border-radius: 50%`, no background, no border) whose only paint is Material
elevation-2. The pseudo-decor grammar refused it by name —
`pseudo-decor-outside-grammar: … painted by a mechanism the grammar cannot
read` — so the shadow never reached the canvas.

**PROMOTING IT AS ITS OWN DECOR PART WOULD HAVE BEEN A SILENT LOSS, AND THAT
WAS MEASURED BEFORE THE FIX WAS WRITTEN.** A Figma node casts a shadow from its
OWN alpha. Probed live on the canvas with three real DROP_SHADOW effects on
three 20x20 ellipses: solid drew a shadow, `opacity: 0` fill drew nothing,
`fills: []` drew nothing. A transparent decor part would have carried the fact
into the contract and rendered zero pixels. The only honest carriage is to fold
the shadow onto the HOST, which is legitimate *because* the box is coincident.

Where it lives: `pseudoDecorParts` in `extract/computed/anatomy.ts` (fold +
named receipt), `applyLiterals` in `core/emit-figma-script.ts` (the literal
path now projects a shadow through the same `parseBoxShadow` /
`parseShadowStack` grammars the token path already used), and `box-shadow`
joins `LITERAL_CHANNELS` with a channel-aware value grammar in
`packages/schema/src/contract-schema.ts` (`SHADOW_LITERAL_VALUE_RE`, admitted
on the shadow channels ONLY — the scalar bound is unchanged everywhere else).

**IT FACTORS PER AXIS, AND THE FIRST CUT WAS WRONG ABOUT THAT.** The first
version required one uniform value across the domain and did not fire. The
reason is a real MUI fact: `size=small`'s thumb::before is `box-shadow: none`
and only `medium` carries the elevation. The fold now uses the SAME
one-enum-axis rule the paint/size/geometry factoring already uses, so the
contract carries `literalsByProp` on `size` (`small: none`, `medium: <stack>`)
and `none` compiles to an empty effect stack that CLEARS the node's effects.

**THE BOUND IS WHAT KEEPS IT FROM ADDING WRONG INK, and it was sized from a
census, not a guess.** The corpus holds 8 shadow-only pseudo refusals. Seven
draw nothing — six are focus rings spelled `0 0 0 -1px` / `-2px` / `-3px`
(negative spread never escapes the box) and one is a 4-layer `inset` hairline.
Requiring a NON-INSET layer that actually draws (blur, positive spread, or an
offset) leaves exactly ONE fold corpus-wide, which is what happened: only
`examples/mui/figma/slider.figma.js` changed out of 31 re-emitted MUI scripts.

**NO OTHER LANE MOVED, VERIFIED BY A/B.** A regate sweep re-ran every lane and
every lane's re-run number differs from its committed number — but the SAME
drift appears with the change stashed (carbon/Toggle: 84.302 committed /
85.119 re-run, byte-identical with and without). That drift is pre-existing
re-run drift and none of those scorecards were committed with this wave.
mui/slider's own gate is unmoved at 89.448% computed-equal before and after.

Gates re-run green: `console-loop:all:evidence:check` 8/8 lanes,
`figma-scripts-fresh` 8/8, `plugin-engine-check` all flows, engine receipt
re-recorded (core changed), MUI GENESIS-BATCH rebuilt.
**RATCHET: mui 5 -> 7**, pinned at the HEADLESS count (the binding instrument),
matching every other lane. The bridge count is 8 because mui/autocomplete
passes the lane scorer at 3.87 and FAILS headlessly at 8.93 — see the open item
at the end of this section.

### WHY THE OTHER SIX NEAR-BAR STEMS DID NOT FLIP: THE REBUILD THEORY IS DEAD

Every stem on the near-bar list was rebuilt from its OWN committed script on
its connected file, and the sweep went wider than the list:

    skipped / "unchanged"   tailwind/toggle-switch · carbon/toggle ·
                            polaris/badge · mui/alert · mui/text-field ·
                            mui/tabs · carbon/accordion · mui/slider (pre-fix)
    amended, rescored       astryx/banner   8 variants → 8.13, IDENTICAL
                            mui/table-pagination  → 11.62, IDENTICAL

**The canvas was never stale.** Not one rebuild moved a number. Anything that
says "rebuild it and it will flip" has now been measured and refuted — the one
stem that DID move needed a contract change first, and then the rebuild carried
it. (mui/text-field is worth a line of its own: CONTINUE previously recorded it
as un-rebuildable, "REFUSES BY NAME … duplicate ds_contracts/contractId
mui.text-field on 3 component targets". It rebuilt cleanly this round as
`skipped: unchanged`, so that blocker is gone and its 7.74 is not a canvas
question. astryx/text-input was NOT rebuilt — its script times out the 30s
bridge ceiling — and at 11.2/11.4 it sits outside this tier anyway.)

**WHAT THE RESIDUAL ACTUALLY IS — a decomposition, not an impression.** Every
failing pixel was classified by the reference's local gradient (edge vs flat
fill) and then re-tested with a radius-1 colour search:

    stem                     AA      flat-fill   survives r=1
    first-party/checkbox     5.16%   0.00%       2.60%
    first-party/text-field   5.84%   0.00%       2.96%
    tailwind/toggle-switch   6.15%   0.00%       2.64%
    carbon/toggle            6.73%   0.00%       2.91%
    first-party/button       7.30%   0.00%       3.31%
    mui/text-field           7.74%   0.00%       4.30%
    mui/slider               7.96%   0.00%       0.09%   <- THE OUTLIER
    mui/table-pagination     5.74%   0.00%       3.36%
    carbon/accordion         7.47%   0.00%       4.01%
    mui/tabs                 5.04%   0.00%       2.50%

`flat = 0.00%` on all of them: **not one fill, paint, border or colour is
wrong on any of these stems.** Every failing pixel sits on an antialias
boundary. And mui/slider is the one stem whose failures all find their own
colour ONE PIXEL away — a pure shift, which is what a missing 4px of shadow ink
plus the scorer's compensating 1.2x rescale produces. The other nine hold
2.5–4.3% under the same search, which is a genuine raster disagreement: the
same glyph, drawn by two rasterizers that place stems at different subpixel
phases. polaris/badge is the clean specimen — 61x20 both sides, text #303030
both sides, background #f0f0f0 both sides, total ink within 1.1%, and the
column profile shows the reference smearing a stem across two columns
(136,139) where Figma snaps it to one (198,72).

**NAMED, with why each cannot flip by rebuild or emit:**

  · `FC-GLYPH-RASTER-PHASE` — first-party/checkbox, first-party/text-field,
    first-party/button, tailwind/toggle-switch, carbon/toggle, carbon/accordion,
    mui/text-field, mui/table-pagination, mui/tabs, polaris/badge. Edge-only
    residual that survives a 1px search. No contract, token or emitter change
    can move it; the two rasterizers are the cause.
  · `FC-REF-STAGE-WIDTH` — mui/alert. **The reference's width IS THE CAPTURE
    WINDOW, and the arithmetic is exact.** mui's config declares
    `stage: {width: 320, padding: 16}` and Alert carries `blockStage: true`;
    320 − 2×16 = **288**, which is the pinned reference's ink width to the
    pixel. A block element fills its stage, so 288 is a fact about the harness,
    not about Alert. The contract render made by the SAME harness in the same
    run hugs at 257x48 and the canvas cell hugs at 258x49 — agreement to 1px.
    **The text is PIXEL-IDENTICAL in all three**: 25 glyph clusters, the first
    at x=[50,57], the last ending at x=239, a 190px span. The only difference
    is the empty red gap after the text — 48px in the reference, 17px in the
    contract render, 18px on canvas. Every one of the 7.20% failing pixels is
    the scorer stretching 258→288 to align two boxes that differ ONLY in
    trailing background, which throws the glyphs 12% out of register.
    IT CANNOT BE FLIPPED HONESTLY. Widening the canvas to 288 would mint the
    capture window as a component fact — the exact regression class Option B
    settled and `FC-GEOMETRY-EXCLUDED` exists to prevent — and teaching the
    scorer to ignore trailing background is an instrument relaxation. The
    only clean close is a reference re-rendered at the hug width, and none is
    on disk.
    A FIRST READ OF THIS STEM WAS WRONG AND IS WITHDRAWN: measuring to the box
    edge (which includes the rounded-corner antialias) made the reference's
    text look 222px wide against the canvas's 192px, and suggested a lost
    `font-weight: 500`. Measuring the glyph clusters instead killed it — the
    weight is carried, the advance widths match exactly, and 25 clusters land
    on the same columns on both sides.
    The `blockStage` census, since this cause is structural: mui 13 components,
    carbon 4, astryx 4, altitude 2, fluent 1. Of the near-bar tier only
    mui/alert's reference actually sits at its stage's content width; the rest
    hug well inside it.
  · astryx/banner — rebuilt, rescored, unchanged at 8.13. Its residual is 27%
    flat-fill mass, which is a DIFFERENT and larger problem than the near-bar
    tier; it does not belong on this list and needs its own round.

### THE FIRST-PARTY LANE CANNOT BE REBUILT FROM ITS OWN COMMITTED SCRIPTS

Three near-bar first-party stems — checkbox (5.16), text-field (5.84) and
button (7.30) — were the closest to the bar on the whole board and are the one
part of the sweep that could NOT be executed. Their committed scripts refuse,
by name, on the file their scorecards were measured on:

    WRONG FILE: expected 8nim1d0IPnehMxA7B7SYxC, got BMjUA2ue5CaZXU4kufxL0z

`FC-SCRIPT-FILEKEY-PIN`. All 55 `figma-sync/*.js` scripts carry
`EXPECTED_FILE_KEY = "8nim1d0IPnehMxA7B7SYxC"`, which comes from
`anchors.figma.fileKey` in the first-party contracts. Every first-party
scorecard, though, was shot on the playground files —
`BMjUA2ue5CaZXU4kufxL0z` (15 stems) and `GnQnjSNBXtgtd2Ht0Hs1C8` (3), per
`canvas-drift/LIVE-SNAPSHOT.json`'s own `fileKeys` block. The anchored file is
not open on the bridge. The example lanes do not hit this because their
contracts anchor `fileKey: null`, which leaves the guard inert — that is why
mui, polaris, carbon, tailwind and astryx all rebuilt without complaint.

Neither side is wrong on its own: the scripts pin the file the contracts
declare, and the canvases are real. They are simply NOT CONNECTED, so
"rebuild it from its own committed script" — the move this whole wave rests on
— is unavailable for the lane carrying the largest ratchet floor (10). The
guard was NOT bypassed and must not be: overriding it would build a canvas the
contract does not claim and then score it, which is the hand-patched-canvas
failure mode. Closing this needs either the anchored file opened on the bridge
or the first-party anchors re-pointed at the playground — an owner call, not a
side effect.

Note the drift probe does NOT cover this: it reports first-party 18/0 in-sync,
but it compares live canvas facts against committed PNGs and framing, never
against what the scripts would build. In-sync there does not mean reproducible.

### OPEN, AND NOT CLOSED HERE

**mui/autocomplete is claimed on ONE instrument.** Its receipt says
`scored-pass`; the lane scorer says 3.87 and the headless REST card says 8.93.
That is the SAME shape as astryx/badge, which is correctly HELD unclaimed for
exactly this reason. Either the both-instruments discipline applies to both
stems or to neither. It is named here rather than silently resolved, because
un-claiming it lowers the board and that is the owner's call, not a side effect
of a wave that was chasing the opposite direction.

## CLAIMED BOARD 19/79 -> 22/79 (2026-08-11, wave 2 step 2) — THREE UNDER-CLAIMS CLOSED, NOTHING NEW EARNED

The composite-over-white round left FOUR stems with a PASSING scorecard and no
claim on their receipt. Three of them pass on BOTH instruments and are now
claimed; the fourth is held. **No canvas, contract, token or reference was
edited to produce this — the receipts had simply not been re-read since the
instrument was fixed.**

    tailwind/card         1.22 bridge · 3.38 headless   claimed
    mui/input-adornment   0.69 bridge · 0.69 headless   claimed
    mui/switch            2.50 bridge · 0.28 headless   claimed
    astryx/badge          4.88 bridge · 5.36 headless   HELD — bridge only

astryx/badge is NOT claimed and must not be: it fails headlessly, and claiming
it would contradict the same both-instruments discipline the held astryx ratchet
floor rests on. Claiming it is also exactly how that red would disappear without
being earned.

**WHAT THE FLIPS COST, because a flip is not free.** The evidence gate requires
`visual.defects` EMPTY for a pass-claim, so every named defect on those three had
to be either RETIRED WITH ITS MEASUREMENT or MOVED to `visual.unmeasured` as a
live scope limit. Nothing was deleted. Retired: five entries whose numbers no
longer exist (6.05 / 20.83 twice / 10.89 / 8.01). Kept as scope limits:
mui/switch's **FC-STATE-PLANE-ABSENT** — the pass covers the BASE state plane
only, because the contract binds `disabled` as a Figma BOOLEAN so no cell in the
set is disabled; same cause and same evidence as mui/checkbox's entry — and
tailwind/card's **FC-FONT-SUBSTRATE**, since flowbite ships no webfont and its
glyph raster is therefore compared across two different faces, so the pass
covers box, fills, border and shadow but NOT typography; plus the fact that its
node is a COMPONENT, one cell, no variant axis exercised.

**FOUR CLAIMS THE OLD NUMBERS MADE WERE REFUTED, NOT MERELY SUPERSEDED:**

  · tailwind/card's "border/shadow aesthetic not match to Flowbite card pairs" —
    measurement says they match, at 1.22 against the real Flowbite render with
    capture-framing's colour histogram clean. That claim was written while
    scoring against a CONTRACT render at 8.01.
  · tailwind/card's FC-FONT-SUBSTRATE predicted that glyph-dominated diffs
    "cannot converge below the 5% bar". They converged, to 1.22.
  · mui/switch's "the residual is track/thumb geometry and paint inside a
    correctly-identified variant". It was neither — the canvas measured 37x22
    against the library's 38x19 because the track's translucent edge was cropped
    away on the transparent-backed export and kept on the opaque reference.
    Composited: 38x20 v 38x19, 2.50. The CROSS-PLANE half of that entry STANDS
    and was not withdrawn.
  · mui/input-adornment's residual was "not the harness font substrate; per-stem
    geometry/color/raster causes stay open", and its stated support was that
    both instruments agreed at 20.83/20.83. They were not corroborating a real
    residual — they were sharing one crop defect. **INSTRUMENT AGREEMENT IS NOT
    INDEPENDENCE WHEN BOTH INSTRUMENTS RUN THE SAME CODE.** The bridge scorer
    and the headless REST lane deliberately duplicate one pipeline, so they
    agree on its bugs by construction. Two-instrument agreement is evidence
    about the CANVAS, never about the SCORER.

**NEXT, AND NOT DONE HERE.** Composition-clean fails nearest the bar, bridge |
headless: tailwind/toggle-switch 6.15|6.19 · carbon/toggle 6.73|6.51 · mui/alert
7.20|8.25 · polaris/badge 7.21|5.74 · mui/text-field 7.74|7.61 · mui/slider
7.96|7.96 · astryx/banner 8.13|9.90. NONE of these is an under-claim; each needs
a real fix, and by the lesson directly above their two-instrument agreement is
weak evidence rather than strong.

## RESOLVED 2026-08-11 — THE FORK IS CLOSED. OPTION 1 WAS TAKEN: BOTH SIDES ARE COMPOSITED OVER WHITE.

The fork recorded below ("composite the canvas before ink-cropping and re-number
every lane" vs "leave the scorer alone and keep a known blind spot") was decided
by the owner in favour of compositing. It is DONE, measured board-wide, and this
section is the result. Everything under the old STOP heading is kept as the
record of how the defect was found; it is no longer a blocker.

**THE FIX.** Both sides are flattened onto an OPAQUE WHITE substrate before any
ink crop, DPR halve or size-normalize. Canonical implementation and rationale:
`compositeOverWhite` in `extract/figma/canvas-gate/score.ts`, applied inside
`alignPair` so every consumer gets it, and duplicated into the three files that
already duplicate this pipeline by policy — `visual-truth/score-policy.mjs`,
`scripts/console-loop-developed-score.mjs`, and
`scripts/console-loop-capture-framing-check.mjs` (whose C2 framing test and
C5/C6 histogram read the same box). White, not cream: `blitOnWhite` and
`whiteCanvas` already pad with 255, so any other substrate would introduce a
second, disagreeing background.

**IT IS NOT A RELAXATION AND THE BAR DID NOT MOVE.** Red-tested in BOTH
directions in `scripts/console-loop-alpha-composite-probe.mts`
(eval `console-loop-alpha-composite`), on a synthetic 61x20 badge carrying
exactly the polaris fact:

    same design fact, two encodings   70.32% AA, FAIL  ->  0.00% AA, PASS
    different fact (alpha .06 vs .30) FAIL            ->  73.85% AA, still FAIL
    the legacy raw-byte rule          43x11 vs 61x20  ->  still collapses (pinned)

The third line matters: the probe recomputes the OLD rule in-process and asserts
it still collapses, so the defect keeps its name and cannot silently return.

**BOARD EFFECT — 97 bridge scorecards and 133 headless cards re-measured.**

    ZERO passes lost on either instrument.

That contradicts this round's own stated expectation. Going in, the prediction
was that some claimed passes were trim artifacts and would correctly fall. None
did. THREE were gained, each on BOTH instruments, and each because the crop now
lands on the true painted extent rather than a shadow-blind or edge-clipped one:

    tailwind/card         6.05 -> 1.22 bridge · 5.64 -> 3.38 headless
    mui/input-adornment  20.83 -> 0.69 bridge · 20.83 -> 0.69 headless
    mui/switch           13.04 -> 2.50 bridge · 10.89 -> 0.28 headless

Ten more stems moved without flipping. The only one that got materially WORSE is
mui/snackbar, 17.45 -> 72.64, and that is the correct loss of a FALSE number:
its previously recorded "same 148x29 content box" was size-normalize squashing a
320x49 OPAQUE reference down to match a canvas crop that had discarded 9,928
semi-transparent shadow pixels. The two are simply framed differently (304x68 vs
320x49); the receipt now says so under FC-REF-FRAMING and the dead "the residual
is surface paint, not geometry" claim is withdrawn. It was a fail before and it
is a fail after.

**POLARIS/BADGE — HONESTLY SCORED, AND IT DOES NOT FLIP.**

    bridge    32.98 -> 7.21     px 43x11 v 43x11 -> 61x20 v 61x20
    headless  33.19 -> 5.74     compositionOk true · scaleRatio 1.00

It is measured at its TRUE 61x20 geometry against a 61x20 reference on both
instruments, and it still misses the 5 bar. It stays fail-closed. The receipt's
`FC-REBUILD-REGRESSION` and `FC-ABS-SIZE` entries are RETRACTED: they blamed a
rebuild for shrinking the ink box 61x20 -> 43x11 when the rebuild had RESTORED
the correct `rgba(0,0,0,0.0588)` background and the SCORER could not see it. The
`scaleRatio 3.64` that FC-ABS-SIZE named was the gap between two CROPS, not
between two components. The 7.21 the "regression" was said to have replaced is
the same 7.21 that returns once the instrument is honest, because it was always
the score of the correct region.

Its residual is now carried as `FC-PAINT-RESIDUAL` — open and undiagnosed. It is
NOT FC-WHITE-ON-WHITE: that caveat covered this stem only while the two sides
were cropped differently, and capture-framing now reports the stem clean at a
7.2% colour-histogram distance against a 25% bar. NO new FC name was minted for
a residual white-on-white class, because after the fix no stem needs one — the
condition the name described was the instrument.

**A SECOND INSTRUMENT DEFECT WAS SURFACED AND FIXED IN THE SAME PASS.**
capture-framing's C5/C6 tone-swap detector quantised colour into hard 32-wide
bins, so mui/switch — shot `#7f7f7f` against reference `#808080`, the SAME grey
one byte apart, straddling the 128 boundary — measured a 25.9% histogram
distance against a 25% bar and was reported as a whole-component
FC-REF-TONE-SWAP while the two agree to 0.6 per channel on the mean. It was
latent until compositing brought mui/switch's AA into the <=10 band where C5/C6
looks. Fixed by soft (trilinear) assignment across the two nearest bin centres,
WITHOUT touching the 25% bar. Controls, hard -> soft:

    #F0F0F0 vs #D5EBFF  (the real swap it was tuned for)  100% -> 86.8%  caught
    #7f7f7f vs #808080  (one byte apart)                  100% ->  4.7%  correctly not
    mui/switch shot vs reference                         25.9% ->  4.2%  correctly not

A bin-offset-shift alternative was tried FIRST and DISCARDED because its control
collapsed to 0.0% — it would have destroyed the detection the detector exists
for. Recorded because the wrong fix looked convincing until it was measured.

**THE white-trim-reach PROBE WAS MEASURING ITSELF.** Its `contentBoxOf` mirrored
the scorer's raw-byte rule while its `paintOutsideBox` judged visibility
COMPOSITED — so it compared a crop taken under one rule against paint judged
under another. Both now composite. Board sweep: **10 lossy crops -> 0**, and the
`mui/accordion` 282px allowlist entry is moot. The repair its comment asked for
("a shadow-aware content box, which re-crops and re-scores all 92 cells") is
what landed, arriving as a side effect of the alpha fix rather than as a shadow
rule — a drop shadow IS translucent paint, so once alpha stopped being a
visibility gate the shadow fell inside the box on both sides. The probe's
ORIGINAL question survives untouched and still measures: an OPAQUE pale surface
at rgb(252) is still cropped as background.

**RATCHET RE-DERIVED** (reasoning lives in `RATCHET.json`; floors, not prose,
are what the gates read):

    tailwind     3 -> 4   card, agreeing on BOTH instruments — a RAISE
    first-party  5 -> 10  NOT this fix. The five composition stems finally have
                          headless cards at all and all five pass, so the exact
                          condition RATCHET.json recorded for this raise is met.
    mui          HELD 5   bridge reads 7 and headless 6, but the BOTH-instrument
                          set is only 4 — the instruments pass different
                          memberships, and a floor moves only where both agree.
    polaris      HELD 3   both read 4; the fourth is `tag`, already excluded as
                          unverifiable because run.ts quarantines it.
    altitude     HELD 4 · carbon HELD 2 (the documented text-input split)

**DECIDED 2026-08-11 BY THE OWNER — HOLD THE ASTRYX FLOOR AT 1. DO NOT LOWER IT
TO GO GREEN.** `visual-truth:check` reports exactly ONE error, the astryx floor,
and that red is DELIBERATE and stays. Lowering the floor to 0 would make the
gate green by moving the bar to wherever the board already is, which is the one
thing a ratchet exists to prevent. astryx/badge reads 4.88 on the bridge and
5.36 headless; the lane earns its floor back when badge clears 5 on BOTH. If you
find this gate red, read this paragraph and `RATCHET.json → decided` — do not
"fix" it. The measurement the decision rests on is the section immediately
below, kept verbatim.

**~~ONE OPEN DECISION~~ [RESOLVED — SEE ABOVE] — ASTRYX FLOOR 1, AND
`visual-truth:check` IS RED ON IT (1 error).** The astryx headless pass-count is
0 and the BOTH-instrument set is 0; only the bridge reads 1 (badge, 4.88). The
0->1 raise of 2026-08-09 was taken from the bridge alone, in violation of the
both-instruments rule RATCHET.json states, so this floor has never been backed
by its own rule. THIS IS NOT NEW AND NOT CAUSED BY THE COMPOSITE FIX:
`visual-truth:check` was already red on the committed tree with THREE errors
before this round (astryx 0<1, mui 4<5, and a stale-reference error naming nine
astryx stems whose receipts had been repointed at real library renders while
their headless cards still scored the old `refs/` copies). Re-running the
headless lane took it to ONE. The composite fix moved astryx/badge headless
12.62 -> 5.36 — closer to the bar, still over it. Options: (a) lower astryx to 0
and record that the lane has no both-instrument pass, or (b) hold at 1 and leave
the gate red until badge clears 5 headlessly. Lowering needs sign-off; holding
keeps a gate red. That trade is the owner's, not a measurement's.

**GATES AFTER THE ROUND.** `console-loop:all:evidence:check` all 8 lanes green ·
`console-loop:capture-framing` green (79 pinned stems, 31 named-open findings) ·
`visual-truth:check` 1 error, the astryx floor above · touched evals 7/7
(`console-loop-alpha-composite`, `-white-trim-reach`, `-score-monotonicity`,
`-capture-framing-pin`, `-canvas-drift-probe`, `visual-truth-report-is-fresh`,
`canvas-pixel-gate-receipts`). Option B remains LOCKED — no fuse geometry was
touched, and no contract, token or canvas was hand-edited for any of this.

**WHAT THIS ROUND DID NOT DO.** It did not diagnose polaris/badge's remaining
7.21/5.74. It did not probe the two newly-passing mui stems for canvas drift —
input-adornment and switch passed because the INSTRUMENT changed under an
unchanged canvas, so the question "is that canvas what its emit script would
build today" is genuinely open for them in a way it is not for the rebuilt
stems; both are pinned by name in the canvas-drift eval.

---

## HOW THE DEFECT WAS FOUND (superseded by the section above; kept as record)

### [CLOSED 2026-08-11 — NOT A BLOCKER ANY MORE] THE MEASURED FORK: THE SCORER COMPARED TWO DIFFERENT ENCODINGS

polaris/badge is root-caused, and the cause is the INSTRUMENT. Measured with a
per-pixel alpha read of the two PNGs the scorer actually compares:

    canvas shot   61x20    1141 of 1220 px SEMI-TRANSPARENT
                           corner alpha 0 · mid-left rgba(0,0,0,15)
    reference    640x192   FULLY OPAQUE · corner rgb(255,255,255)

The canvas export carries the badge's `rgba(0,0,0,0.06)` background as ALPHA
(15/255 over nothing). The reference render carries the SAME fact COMPOSITED
OVER WHITE — 6% black over white is rgb(240), which is INK under the scorer's
WHITE_TRIM=250. So one identical design fact is ink on one side and trimmed on
the other, and the ink-box crop then compares two different regions. That is
FC-WHITE-ON-WHITE, already an allowed code for this lane and already on the
caveated-pass list below. (The reference is also 640x192 for a 61x20 cell — a
DPR/stage-scaled render the scorer normalises separately.)

**THE FORK — OWNER'S CALL, because it re-numbers every lane.**
  Option 1: COMPOSITE the canvas export over white before ink-cropping, so both
    sides encode translucency the same way. Correct in principle and it is a
    CROSS-LANE class — every stem with a translucent background is mis-scored
    today, not just this one.
    RISK: it changes the number for EVERY stem in EVERY lane, including the 19
    currently-claimed passes. It cannot be landed without a full re-score and a
    re-derived ratchet, and a stem that passes today could fail tomorrow.
  Option 2: leave the scorer alone and mark the affected stems FC-WHITE-ON-WHITE
    (as this lane already does). Costs nothing, moves no board number, and keeps
    a known blind spot.

I am not choosing between "re-number the whole board" and "keep a known blind
spot" unasked. Nothing here is blocked on more measurement — it is blocked on
that decision.

WHAT IS SETTLED: the polaris badge CONTRACT, TOKEN and EMITTER are all faithful
(background matches the capture at rgba(0,0,0,0.06); `enabled`'s colour matches
its own captured delta #303030). Do not change them.

**RETRACTED — THERE IS NO COLOUR DEFECT. THE TOKEN IS FAITHFUL.** I claimed
above that the mint mis-aliased tone.enabled. That was wrong, and the check that
killed it is one line: group the captures by tone and print each colour delta.

    base                rgba(97, 97, 97)   <- what I mistook for `enabled`
    none / new / read-only   NO-DELTA (= base)
    enabled             rgba(48, 48, 48)   <- enabled HAS its own delta

`enabled` is NOT the base. It carries its own captured colour #303030, which is
exactly what `{p.color-text}` resolves to and exactly what the canvas paints.
The mint, the token and the emitter are all correct. I inferred "enabled must be
the base" from the base colour matching `label.color.none`, and never printed
the per-tone deltas that would have shown `enabled` among them — the same
reason-from-a-neighbour error that produced the TOKEN_CHANNELS false positive.

SO polaris/badge's 32.98 is STILL UNEXPLAINED, and the remaining candidate is
the INSTRUMENT, not the canvas: the canvas export is transparent-backed while
the reference render is composited over white, so a 6%-alpha background is ink
on one side and trimmed on the other. That is FC-WHITE-ON-WHITE, already an
allowed code for this lane and already on the caveated list in this file.
NEXT: print the two PNGs' actual ink boxes and alpha channels side by side
before touching anything. Do NOT change the token — it matches the capture.

**THE SUPERSEDED (WRONG) FIX PROPOSAL, kept as a record:**
`imported.badge.root.color.enabled` should resolve to the BASE capture colour
#616161 / `{p.color-text-secondary}`, not `{p.color-text}`. This is a MINT
aliasing defect on the default tone, not a geometry issue, so it is fully
inside Option B — no fuse change, no width/height relax.
VERIFY FIRST whether other lanes' "enabled"/default tones were aliased the same
way; if so this is a CROSS-LANE class (the goal's stated preference) rather than
a one-off stem patch. Then re-mint -> re-emit -> rebuild -> rescore, and flip
only if <=bar with compositionOk.
DO NOT hand-patch the canvas fill; the canvas is currently a faithful render of
a wrong token.

## WAVE 2 (feat/freeze-board-wave2, 2026-08-11) — HYGIENE DONE, ZERO FLIPS, ONE REGRESSION FOUND

**Board UNCHANGED at claimed 19/77 · scorecard 20/77.** No stem earned a flip
this wave, and that is the result rather than a shortfall: seven stems were
rebuilt from their own committed scripts and every one is honestly still short
of the bar.

**CANVAS HYGIENE — DONE, and it was real.** MUI Test 1 held FIVE redundant
COMPONENT_SETs: mui.alert x2, mui.badge x3, mui.text-field x3. All had identical
specHash, identical child counts, identical position, and ZERO instance uses;
the pinned keepers (84:2264 / 84:2376 / 84:2480) were retained and the other
five removed. The emitter's "duplicate ds_contracts/contractId — refusing
ambiguous identity" refusal is GONE and all three stems now rebuild.
Rescored after the unblock: alert 7.03 -> 7.20, badge -> 57.38,
text-field 7.61 -> 7.74. Hygiene bought MEASURABILITY, not passes.
mui/alert's C1 pin was re-pinned 255x49 -> 258x49 from the live canvas (the cell
only got its true size once the emitter could run); mui/text-field's overhang
entry was rewritten from the now-obsolete FC-AMBIGUOUS-IDENTITY to
FC-OVERFLOW-NOT-DECLARED with re-measured render bounds.

**FOREIGN LANES: ALL FIVE ARE CONNECTED — none are blocked.** carbon, altitude,
polaris, tailwind and astryx all live on fileKey GnQnjSNBXtgtd2Ht0Hs1C8
("DS Contracts Testing"). Four best candidates rebuilt: tailwind/card 6.05
(unchanged), tailwind/toggle-switch 6.15 (unchanged), carbon/toggle 6.38 -> 6.73,
polaris/badge 7.21 -> 32.98.

**NEW FINDING — FC-REBUILD-REGRESSION on polaris/badge, named not chased.**
Rebuilding it from its OWN byte-fresh committed script SHRANK the ink box from
61x20 to 43x11 and moved the score 7.21 -> 32.98 against an unchanged reference.
The canvas that scored 7.21 was built by an EARLIER emitter generation, so the
current emitter draws materially less ink for this stem. The shot is kept
CURRENT rather than reverted — a flattering stale capture is the exact class
this lane has already removed twice — so 32.98 is the honest number and the
regression is visible instead of hidden behind an old PNG. Also named
FC-ABS-SIZE so the framing gate recognises it. NOT DIAGNOSED: which emitter
change between the two generations caused it. That is the single highest-value
lead for wave 3, and it needs no fuse geometry relax.

**WHAT THIS WAVE PROVES ABOUT THE REBUILD LEVER.** It is now exhausted as a
cheap source of flips: 13 stems rebuilt across two waves, 2 flipped (both in
wave 1, both mui). Stems still under the bar are under it for real reasons —
tone swaps, composition mismatches from FC-GEOMETRY-EXCLUDED, and genuine ink
divergence — not stale captures. Wave 3 should target CAUSES, starting with the
polaris regression above.

TOUCHED EVALS 7/7 GREEN (--only): golden-generated-output,
capability-report-is-fresh, capture-framing-pin, reference-content-checks,
canvas-drift-probe, mui-evidence-receipt, tailwind-evidence-receipt.

## HANDOFF FOR THE NEXT BRANCH

**BOARD (from the artifacts, this wave): claimed 19/77 · scorecard 20/77.**
    mui 5/31 · carbon 3/10 · tailwind 3/5 · astryx 0/11 · polaris 4/12 · altitude 4/8
Claimed moved 17 -> 19: `mui/checkbox` (withdrawn pass re-earned, 0.00) and
`mui/autocomplete` (8.93 -> 3.87), both by rebuild-then-pin from the stem's own
committed rt12 script, both flipped ON THE SCORECARD.
The 1-stem claimed/scorecard gap is `astryx/badge` and it is CORRECT: its
scorecard passes at 4.88 while its own defects name FC-REF-SWEEP-DECOY and
FC-REF-TONE-SWAP — the cell is 83.8% colour-distant from the library's
Variant=Blue badge and 6.9% from its NEUTRAL one, a whole-component tone swap
sitting under pixelmatch's YIQ cutoff. DO NOT FLIP IT.

**SUITE STEADY STATE: expect 222/224.** Two reds remain, both PRE-EXISTING:
  · `mui-figma-genesis` — switch-track pin expects 34x14, gets 1x1. PROVEN
    pre-existing by checking out this session's own start commit (db4c90ae) and
    reproducing it there.
  · `child-wider-ratchet-and-script-freshness` — astryx textCaused 33, the
    corpus-wide text-wrapping gap (docs/22).
Everything else measured green this wave (--only): golden-generated-output,
capability-report-is-fresh, console-loop-capture-framing-pin,
console-loop-reference-content-checks, console-loop-canvas-drift-probe,
console-loop-mui-evidence-receipt. capture-framing is at ZERO unnamed/hard
violations across all 79 pinned stems.

**REAL BOARD MOVERS THAT DO NOT TOUCH THE FUSE GEOMETRY EXCLUSION:**
 1. **De-duplicate contractIds in MUI Test 1 (59mLQlOMiD5w5za6SUcoO5).** Three
    mui stems CANNOT BE REBUILT AT ALL — the emitter refuses by name:
        mui/alert       "duplicate ds_contracts/contractId mui.alert on 2 component targets"
        mui/badge       "... mui.badge on 3 component targets"
        mui/text-field  "... mui.text-field on 3 component targets"
    This is CANVAS HYGIENE, not an emitter defect, and the refusal is correct —
    an ambiguous identity must not be guessed. Removing the stray duplicate
    components makes three stems measurable, and alert was 7.03 (boxes already
    identical at 144x24) so it is a live candidate. HIGHEST VALUE, LOWEST RISK.
 2. **Rebuild-then-pin the OTHER lanes.** Only mui was rebuilt this wave, and it
    yielded 2 flips from stems whose canvases predated the rt10-rt12 emitter
    fixes. carbon/tailwind/polaris/altitude/astryx scorecards are mostly dated
    2026-08-08/09 — same staleness class, untested. Their canvases live on other
    fileKeys; check bridge connectivity first.
 3. **Ledger the FC-GEOMETRY-EXCLUDED silence** (14 of 15 entries). Honesty, not
    board movement — but it is the obligation Option B creates.
 4. **mui snapshot round.** `checkbox` and `autocomplete` were rebuilt from
    their own committed scripts, so a LIVE-SNAPSHOT entry would read in-sync BY
    CONSTRUCTION, exactly as radio did. That is a snapshot round, not a
    re-measurement. It moves `wantUnmeasured` in evals/run.ts, not the board.

**MERGE NOTES.** RUNTIME_EMIT_REV is `rt12-birthbox-declared-layout-only`; all
figma artifacts re-emitted at it, figma-scripts-fresh 8/8, 7/7 genesis batches
mock-proven, plugin-engine-check green, golden manifest current. RATCHET floors
moved this session: mui 4 -> 3 -> 4 -> 5 (each move justified in RATCHET.json's
own note). Three C1 mechanisms are new and load-bearing: `cellOverhang` (a named
overhang must carry an FC code, a reason, and match independently-measured
render bounds; it reports "open (named)", never a pass), the mui C1 mint (31/31
cells pinned live), and `DeclaredChannelSpec.drawExcept` (per-VALUE canvas
verdicts, which is what keeps overflow `auto`/`scroll` off a canvas that has no
scroll container).

BOARD — RE-DERIVED FROM THE ARTIFACTS, AND "18/77" WAS NEITHER OF THE TWO REAL
NUMBERS. It was inherited, I repeated it, and counting the files says:

  SCORECARD passes (scores/<stem>.json status=pass):   19/77
    alt 4/8  astryx 1/11  carbon 3/10  mui 4/31  polaris 4/12  tailwind 3/5
  CLAIMED passes (components/<stem>.json visual.ok):   17/77
    alt 4    astryx 0     carbon 3     mui 3     polaris 4     tailwind 3

The per-lane figures the old header listed sum to 19, while its headline said
18 — the arithmetic never matched its own row. The 2-stem gap between the two
columns is REAL and is the honest state, not an error: mui/checkbox and
astryx's one scorecard-pass have PASSING scorecards whose receipts still stand
fail-closed. A scorecard is permission to claim a pass; it is not the claim.
Quote which number you mean. first-party 11/54 (unre-derived this session).

Every one of the 19 is now backed by an emitter-built node and a CURRENT
capture — the fake divider pass and the stale-shot table pass are both gone,
and divider + linear-progress replaced them honestly.

HEAD: d4dbc91b. RUNTIME_EMIT_REV rt12-birthbox-declared-layout-only.
Gates: plugin-engine-check GREEN, figma-scripts-fresh 8/8, 7/7 genesis batches
mock-proven, console-loop-mui-evidence-check GREEN (31/31, ratchet 4).
FULL SUITE: 218/224 measured this session. `npm run golden:update` and
`npm run capability:report` already applied.

THE 6 SUITE FAILURES, triaged — MOST ARE NOT FROM THIS SESSION:
- `mui-figma-genesis` (switch-track expected 34x14, found 1x1) — **PRE-EXISTING.
  Proven**: stashed everything, checked out db4c90ae's (this session's OWN start
  commit) mock + switch.figma.js, and the pin fails there identically. The old
  CONTINUE named only capture-framing as red; that was incomplete.
- `child-wider-ratchet-and-script-freshness` — pre-existing (astryx textCaused
  33, the corpus-wide text-wrapping gap, docs/22).
- `console-loop-capture-framing-pin` + `console-loop-reference-content-checks` —
  pre-existing astryx FC-REF-FRAMING, PLUS the 6 new mui C1 violations below.
  C1 is never waivable; these must be fixed, not narrated.
- `capability-report-is-fresh` — was mine (I edited the capability matrix);
  FIXED by `npm run capability:report`.
- `console-loop-canvas-drift-probe` — was mine; FIXED. It asserted "mui: 30
  cell-pending", which encoded the blindness C1 just ended. The 30 did not
  become clean, they moved to SNAPSHOT-pending (cell pinned, no LIVE-SNAPSHOT
  entry). Expectation re-derived to 0 with that written down.
- `golden-generated-output` — was mine each time core changed; FIXED by
  `npm run golden:update` (run it after ANY re-emission).
EXPECTED STEADY STATE: 4 failures, all pre-existing and named
(mui-figma-genesis, child-wider-ratchet, capture-framing-pin,
reference-content-checks). If anything OTHER than those 4 is red, it is new and
belongs to this handoff.

VERIFIED BY TARGETED RUN (`npx tsx evals/run.ts --only <ids>` — use this; the
full suite cannot finish inside one turn in this environment and every
background attempt was killed at a turn boundary):
  ✔ capability-report-is-fresh
  ✔ console-loop-canvas-drift-probe
  ✖ console-loop-capture-framing-pin       1 unnamed/hard violation — mui/fab
  ✖ console-loop-reference-content-checks  same single cause
capture-framing hard violations went 8 -> 1 this session. THE ONLY ONE LEFT IS
mui/fab, and it is hard ON PURPOSE (see the residual status above). Every other
framing residual on all 79 pinned stems is now an "open (named)" FC-* refusal.

VERIFICATION STATUS, STATED PLAINLY. The last COMPLETE `npx tsx evals/run.ts`
was 218/224, taken BEFORE the last two eval-expectation fixes. Three attempts to
re-run it to completion afterwards were each killed by the environment at 139,
82 and 20 evals — with ZERO failures in the completed portion of the last two.
So the clean 220/224 is NOT yet observed end-to-end. The two fixes were instead
verified DIRECTLY against reality, which is stronger evidence than the eval
restating them:
  · capability-report-is-fresh — `npm run capability:report` now regenerates
    docs/24-what-works.md with NO diff. (It hashes evals/golden.json and
    evals/results.json, so it goes stale whenever eval OUTCOMES move and
    settles once they stop. Run it AFTER the suite, then commit.)
  · console-loop-canvas-drift-probe — the probe itself now reports
    "1 in-sync, 30 snapshot-pending, 0 cell-pending", matching the re-derived
    expectation of 0. And mui's scorecard passes are exactly
    checkbox/divider/linear-progress/radio, of which radio is the probed
    in-sync one — so the un-probed three ARE `wantUnmeasured`.
RUN THE FULL SUITE FIRST and confirm 220/224.
CAVEAT ON THAT RUN: the suite in flight at handoff STARTED BEFORE the C1
named-overhang change, so its capture-framing result will not reflect it.
Expect `console-loop-capture-framing-pin` and
`console-loop-reference-content-checks` to STILL be red afterwards regardless —
they are red on pre-existing astryx FC-REF-FRAMING entries, which this change
does not touch. Re-run once more to see the mui half settle.

## CLOSED THIS SESSION

- **FC-SLOT-BIRTH-BOX reaches COMPONENT roots.** buildNode was never the only
  call site; amendSet and amendComponent preserve the variant COMPONENT and
  rebuild only its interior, so the root kept Figma's 100px box forever. Three
  call sites now (one `birthBoxCall` helper). Proven on canvas: MUI Divider
  Inset 216x100 -> 216x1, Middle 256x100 -> 256x1, FullWidth now emitter-built
  rather than the hand-probe it was. `node.children` is an explicit container
  test — relaxing the guard first reached TEXT leaves and took down four
  genesis batches.

  **WHAT I ASSERTED WITHOUT MEASURING, and reverted (rt12).** Two claims in the
  rt10/rt11 commits were speculation stated as findings. Both are now reverted
  and the canvas is the reason:
   · The birth-box guard was relaxed from `spec.layout &&` to applyFrameSpec's
     default, described as closing "a latent hole". No such hole was measured —
     every divider root declares layout. MUI Switch's `switch-track` is a
     childless FRAME with NO declared layout measuring 34x14 FIXED live
     (21:612); a node the contract gave no layout is not one this repair
     understands. Guard restored.
   · The mock was taught the birth box for FRAME as well as COMPONENT. The
     evidence only ever covered a childless COMPONENT (Divider) and a SLOT;
     Switch's childless FRAME children measure 34x14 and 20x20 live, not
     100x100. Scoped back to COMPONENT. §8 still goes red-then-green, because
     the case it models is a COMPONENT root.
  I found both while hunting a "regression" (switch-track 1x1) that turned out
  to be RED AT db4c90ae, this session's own starting commit.
- **THE MOCK MODELED THE BIRTH BOX ONLY ON SLOT NODES** and was therefore
  structurally unable to see the divider defect (a plain COMPONENT). FRAME and
  COMPONENT now carry it, honored only while the axis reports HUG and dissolved
  by the first relayout. native-slots-check §8 red-tests both directions.
  CORRECTED LATER THE SAME SESSION: COMPONENT only, NOT plain FRAME — see
  "WHAT I ASSERTED WITHOUT MEASURING" below.
- **capture-framing C1 minted for the mui lane** (31/31, 0 cellPending). The
  open question in the old cellPending reason is MEASURED: `exportAsync` at
  scale 1 returns EXACTLY `absoluteRenderBounds`, five for five. C1 stays
  pinned to the LAYOUT box deliberately — pinning render bounds would make it
  compare the export to itself.
- **FC-OVERFLOW-CLIP-LOST.** 102 parts / 34 stems (162 hidden, 20 clip, 22
  auto) reached the contract and emit-react and died at applyDeclared's
  `default: break`. Now drawn as clipsContent.
  `DeclaredChannelSpec.drawExcept` + `channelDraws()` carry the per-VALUE split
  (auto/scroll stay off-canvas — Figma has no scroll container) and absorbed
  the overline carve-out that was hardcoded at the consumer.
  native-slots-check §9 red-tests it.
  **CARRIAGE VERIFIED COMPLETE, counted from the emitted artifacts:** 206
  overflow declarations across 52 stems now produce 1,289 `clipsContent` facts
  in 46 emitted scripts. The handoff's "103 parts / 52 stems" understated the
  declarations and named the stem count exactly; this step is CLOSED, not
  partial. The remaining overflow-adjacent residual is a SCHEMA gap, not
  carriage: MUI Accordion's overflow varies on the `expanded` enum and there is
  no `declaredByProp` vocabulary (FC-DECLARED-BY-PROP-MISSING, named in the
  gate).

## RESIDUAL STATUS vs THE FREEZE-BOARD BAR

The bar is: foreign board green, OR every residual is a named FC-* refusal with
probe+pin. Where each residual stands as of this handoff:

  NAMED with probe+pin (done, see details below):
   · the 6 capture-framing C1 violations — each carries an FC code, a probe
     (what was read on the live canvas) and a pin (both boxes). FIVE of the six
     are C1's OWN semantics, not canvas defects.
   · FC-GEOMETRY-EXCLUDED — 15 findings, probe is
     `node scripts/base-equal-geometry-sweep.mjs`, pin is the committed
     BASE-EQUAL-GEOMETRY-SWEEP.json.
   · the 4 pre-existing suite failures — named above, one PROVEN pre-existing
     by checking out this session's own start commit.

   · C1's named-overhang vocabulary — DONE. `cellOverhang: {fc, renderW,
     renderH, why}` is accepted ONLY when the shot equals that
     independently-measured render box AND carries an FC code and a reason; it
     reports "open (named)", never a clean pass, and cannot launder a
     wrong-cell/whole-set shot (those match neither the box+margin nor the
     render box). mui C1 violations 6 -> 1.

  NOT YET NAMED — the one honest gap left:
   · **mui/fab.** It deliberately has NO cellOverhang entry and stays a HARD
     FC-CELL-FRAMING violation, because its 8x36 box for a Size=LARGE FAB is a
     genuine silent geometry loss and an allowance there would hide the very
     defect the gate should find. It is DIAGNOSED (below) but the fact is still
     neither carried nor ledgered, so it is not yet a named refusal. Fixing
     FC-GEOMETRY-EXCLUDED would close this AND the 15 — but ONLY by ledgering the
     silence; Option B forbids relaxing the fuse exclusion (see the top of this file).

## NEXT 3 STEPS

1. **Verify the full suite** (`npx tsx evals/run.ts`) — see VERIFICATION STATUS
   above. Expect 220/224 with the 4 named pre-existing failures; anything else
   red is new. Everything else in this file is gate-verified; this is not.
2. **The 6 remaining C1 violations, which are the honest next FC.** All are
   "content RENDERS OUTSIDE its layout box":
     accordion  354x114 from 288x48   fab       44x72 from 8x36
     select     75x61 from 73.94x56   snackbar  324x85 from 288x49
     table-pagination 431x52 from 428x52        text-field 253x93 from 252.97x78.91
   **EACH RESIDUAL, PROBED AND NAMED (2026-08-10).** Every one of the six is a
   case where the SHOT (which is always absoluteRenderBounds — measured, five
   for five) legitimately exceeds the CELL BOX. None is a newly-found emitter
   bug; C1's margin guard already tolerates a UNIFORM overhang <=17px, and these
   six fail it on skew or magnitude:
     · mui/select — FC-OVERFLOW-NOT-DECLARED. PROBE: the contract ROOT declares
       NO overflow; only label / select-nativeinput / icon /
       outlinedinput-notchedoutline do. PIN: root 73.94x56, render 75x61, and
       the child `outlinedinput-notchedoutline` is 74x61. The notched outline
       renders ABOVE the box in real MUI too (inset:-5px). The canvas is right;
       nothing was dropped.
     · mui/table-pagination — FC-SCROLL-UNSUPPORTED. PROBE: the ROOT declares
       `overflow: auto/auto`. PIN: `auto` is held OFF canvas ON PURPOSE by
       DeclaredChannelSpec.drawExcept — Figma has no scroll container — so the
       root correctly does not clip. box 428x52, render 431.03x52 (3px).
       CARRY-CODE-ONLY, matrix row `overflow: scroll/auto`.
     · mui/snackbar — FC-EFFECT-BLEED. PROBE: root declares no overflow; the
       cell carries a drop shadow. PIN: box 288x49, render 324x85, a UNIFORM
       18px margin — 1px over C1's 17px allowance. This is the guard's own
       tolerance being marginally too tight for a shadow, not a geometry fault.
     · mui/fab — SILENT GEOMETRY LOSS (the real defect of the six). See the
       diagnosis below: box 8x36 for a Size=Large FAB because width/height were
       captured (56x56) and carried nowhere.
     · mui/accordion — FC-DECLARED-BY-PROP-MISSING. PROBE: overflow VARIES on
       the `expanded` enum, so fuse sent it to the sidecar as non-uniform. PIN:
       no `declaredByProp` vocabulary exists in the schema. Named schema gap.
     · mui/text-field — FC-AMBIGUOUS-IDENTITY. PROBE: rebuilding it REFUSES BY
       NAME on canvas — "duplicate ds_contracts/contractId mui.text-field on 3
       component targets". PIN: pre-existing canvas condition; the duplicates
       must be cleaned up in MUI Test 1 before the stem can be rebuilt at all.
   CONSEQUENCE FOR C1: five of six are the CHECK's semantics, not the canvas —
   C1 compares a render-bounds shot to a layout box and has no vocabulary for a
   legitimate, named overhang. It is documented "never waivable", which is right
   for "this shot is not that cell" and wrong for "this cell legitimately
   renders outside its box". THE NEXT DECISION IS C1's DESIGN, not six canvas
   fixes: give it a probed+named overhang allowance (per-stem, with the FC code
   above), keeping the never-waivable bite for wrong-cell/whole-set shots.
   Do NOT "fix" this by forcing clipsContent onto roots the contract never
   clipped — that would make the canvas lie to satisfy a gate.

   Split, measured, not guessed:
   - **accordion / fab / snackbar / table declare NO overflow**, so the clip was
     never going to reach them. accordion's overflow VARIES on the `expanded`
     enum, so fuse.ts:1842 sent it to the sidecar as non-uniform; carrying it
     needs `declaredByProp` vocabulary that the schema does not have. That is a
     schema addition, scoped OUT here.
   - **fab: DIAGNOSED — a SILENT geometry loss, and it is the real find of the
     session.** The cell box is 8x36 for a Size=Large FAB (render 44x72). The
     root hugs its label because the contract carries NO width and NO height at
     all — only `min-width: {imported.shared.size-0}` (zero) and a uniform
     `min-height: 36px`. The `size` tokensByProp map carries ONLY the four
     border-radii.
     The capture SAW the geometry: `extract/computed/out/mui/fab/
     captured-truth.json` holds `/base/root/style` = **56px x 56px** and
     per-variant deltas of 40x40. The radii that DID carry prove it too —
     small 20 / medium 24 / large 28 are the radii of 40 / 48 / 56 circles.
     So the fact was captured, was dropped between capture and contract, and
     NOTHING NAMED THE LOSS: `fab.extension.json` mentions width/height ZERO
     times and the lane LEDGER.md has no entry.
     It is not a general fuse limitation — `width`/`height` are in
     LITERAL_CHANNELS and 12+ sibling mui contracts carry them (accordion 20
     occurrences, autocomplete 31). FAB is the outlier.
     **ROOT CAUSE FOUND (mechanism, not yet fixed).** Grouped the 71 captures
     by size (`captured-truth.json` capture `key` prefix):
         small  -> 40px x 40px
         medium -> 48px x 48px
         large  -> ABSENT
         base   -> 56px x 56px
     `large` has NO delta because the deltas record only what differs from
     BASE, and the base capture IS the large FAB. So the per-size map for
     width/height never completes and the channel is dropped, while
     border-radius — which has the SAME base-equal-large shape (20/24/28, and
     28 is the base) — carried all three. Both channels are in
     BASE_FALLBACK_CHANNELS *and* LITERAL_CHANNELS (fuse.ts:1435), so the
     base-fallback machinery exists and radius reaches it. Find why
     width/height do not take that path (start at fuse.ts:1828 `skipFolds &&
     BASE_FALLBACK_CHANNELS.has(channel) && LITERAL_CHANNELS.has(channel)` and
     the tokensByProp mint that radius went down instead).
     CONFIRMED SILENT: fab.extension.json `codeOnlyChannels` has exactly TWO
     entries (transition-behavior, vertical-align); the only minted geometry
     keys are line-height and min-height. width/height appear in no ledger, no
     codeOnly, no receipt. Must end CARRIED or LEDGERED — silent is the one
     outcome that is not allowed.
     **FC-GEOMETRY-EXCLUDED (was: FC-BASE-EQUAL-GEOMETRY-DROPPED, superseded) — 15 losses across
     10 stems in 6 libraries; fab is the exemplar, not the exception.**
     PROBE: `node scripts/base-equal-geometry-sweep.mjs`. PIN: the committed
     receipt BASE-EQUAL-GEOMETRY-SWEEP.json carries, per finding, the observed
     per-axis values and the base value they were measured against, plus the
     locus (INSIDE fuse) and the stated caveat. `node scripts/base-equal-geometry-sweep.mjs`
     (receipt committed at BASE-EQUAL-GEOMETRY-SWEEP.json). It reports a
     geometry channel that is observed on SOME axis values, absent on at least
     one other, and present in NEITHER the contract NOR the extension ledger:
         altitude/button  width,height    altitude/chip     width,height
         altitude/heading height          altitude/iconclose height
         altitude/link    width,height    astryx/token      height
         carbon/button    width           fluent/dialog     width,height
         mui/fab          width,height    shadcn/card       height
     altitude/iconclose is the least deniable: height is observed as
     8/12/20/24/32/36/40 across xs..xxxl and carried NOWHERE.
     NOTE altitude/heading and altitude/link are already on the caveated-pass
     list below — a silent height loss is a candidate explanation for both, so
     fix this before re-examining them.
     **THE WHOLE INVESTIGATION WAS A REDISCOVERY. IT WAS LOCALISED ON
     2026-08-09 AND THE ANSWER WAS IN fab's OWN RECEIPT ALL ALONG.**
     `parity/receipts/console-loop/mui/components/fab.json` carries:
       "LOCALISED 2026-08-09 — FC-GEOMETRY-EXCLUDED (shared cause with
        mui/chip, mui/fab, mui/avatar, mui/icon-button; capture/promote side,
        and a DELIBERATE refusal rather than a leak) ... fuse.ts:555-565
        excludes geometry channels (width/height/insets) from fusion as
        environment-dependent, admitting them only for absolute-cluster parts,
        table cells and the block-root/overlay doors; this root is none of
        those. THE FIX IS NOT A PER-STEM PATCH — relaxing the geometry
        exclusion is the change that previously minted the capture WINDOW as
        tokens in four of six libraries."
     So: the cause is fuse.ts:555-565, it is DELIBERATE, and the fix is a
     dedicated round with viewportDerivedRefusals held — not a mint diff, not
     TOKEN_CHANNELS, not base-equality.
     MY "NOTHING NAMED THE LOSS" WAS FALSE. I checked the extension sidecar and
     the lane LEDGER.md and concluded silence; the naming was in the COMPONENT
     RECEIPT, which I did not read until the end. Check receipts before
     declaring a loss unreceipted.
     WHAT SURVIVES AND IS STILL NEW: the sweep extends the known class from 4
     mui stems to 15 findings across 10 stems in 6 libraries
     (BASE-EQUAL-GEOMETRY-SWEEP.json). Treat the retired name as
     an ALIAS of FC-GEOMETRY-EXCLUDED — same cause, wider census — and prefer
     the older name.

     **SUPERSEDED — that "cause" was a bad test, not a finding. width AND
     height ARE IN TOKEN_CHANNELS.** The registry writes them as BARE
     IDENTIFIERS under a `// -- box --` heading:
         width: drawn("a fixed width.")
         height: drawn("a fixed height.")
         "min-width": drawn("minWidth.")
     My membership test searched for the QUOTED key `"width"` and reported
     absent. The quoted neighbours ("min-width", the radii) matched, which made
     the false negative look like a clean signal. Read the block, do not probe
     it with a string match.
     SO THE MINT *CAN* CARRY width/height, AND THE CAUSE IS STILL OPEN. What is
     still true and still measured: replay delivers 56x56 / 40x40 / 48x48 to the
     fuse mint loop, border-radius carries per-size from the same part on the
     same axis, and width/height reach neither contract nor ledger. The control
     stands; only my explanation of it was wrong.
     NEXT: instrument the mint for fab root width vs border-radius side by side
     and find where they diverge. That means an actual log line inside fuse, not
     another registry inspection.

     **SUPERSEDED (kept as the record of a dead hypothesis) — width/height and
     TOKEN_CHANNELS:** Checked the registry directly
     (packages/schema/src/contract-schema.ts):
         "width"       absent        "border-radius"           PRESENT
         "height"      absent        "border-top-left-radius"  PRESENT
         "min-width"   PRESENT       "min-height"              PRESENT
     That is EXACTLY the contract fab ships: min-height and the four radii
     carried per size, width and height carried nowhere. The capture never lost
     them (replay proves 56/40/48 reach the mint loop); the mint simply has no
     channel to put them in, so they cannot become tokens or a tokensByProp
     map. border-radius was the perfect control because it IS in the set.
     THE 15 FINDINGS ARE ONE DESIGN DECISION, NOT A BUG PER STEM. Before
     "fixing" it, answer the question the registry is implicitly asserting:
     is a raw `width`/`height` deliberately excluded because canvas geometry is
     meant to derive from layout + min/max constraints rather than be pinned?
     If YES, the defect is that the exclusion is SILENT — it must produce a
     codeOnly/ledger entry naming the drop, which today it does not, and that
     alone would close FC-GEOMETRY-EXCLUDED honestly — and it is the ONLY sanctioned
     route under Option B.
     If NO, adding width/height to TOKEN_CHANNELS is the fix — and then the
     PRECEDENCE POST-PASS recorded below is required, because that is exactly
     what starts producing binding+literal collisions (polaris.tag "link").
     Check git history / docs for why they were excluded before changing it.
     DO NOT read the dead hypotheses below as guidance — they are kept only as
     a record of what measurement killed.

     **SUPERSEDED — THE BASE-EQUAL-DELTA THEORY IS DEAD. CONFIRMED BY REPLAY, NOT
     INFERRED.** Ran `reconstructCaptures()` over fab's captured-truth and
     printed the RESOLVED root style. It carries all three sizes:
         56px x 56px  |  40px x 40px  |  48px x 48px
     So width/height ARE present, with three distinct values on the size axis,
     at the exact point the fuse mint loop reads them. Nothing is missing at
     observation. `replay.ts:148` seeds each combo from
     `structuredClone(truth.base.root)` and applies deltas on top (`:156`), so
     a channel absent from a delta simply KEEPS THE BASE VALUE.
     THEREFORE THE DROP IS AT THE MINT/CARRY DECISION. width/height are
     observed exactly as border-radius is — same part, same size axis, three
     values each — and border-radius CARRIES (as tokensByProp small 20 /
     medium 24 / large 28) while width/height carry nowhere and are named
     nowhere. That contrast, on one part in one contract, is the whole lever:
     diff the two channels' path through the mint and find what declines
     width/height. Probe: `npx tsx` a script importing `reconstructCaptures`
     (see the commit for the exact 15-line version).
     The old reasoning is kept below ONLY as a record of three dead
     hypotheses; do not act on any of it.
     `extract/computed/replay.ts:148` starts each combo from
     `structuredClone(truth.base.root)` and then applies that combo's deltas on
     top (`:156`, `node.style[k] = v`). So a channel ABSENT from a delta
     RETAINS THE BASE VALUE — it is not undefined. For MUI Fab that means
     `el.node.style.width` is "56px" on the large combos, and the channel is
     fully observed as small 40 / medium 48 / large 56.
     If that is right (INSTRUMENT IT — one log line in the fuse mint loop for
     the fab root across the three sizes), then:
       · the value-level fallback I wrote could never have helped, which is
         exactly what was observed — it changed nothing;
       · the drop happens DOWNSTREAM, at the MINT/CARRY decision, not at
         observation. Something declines width/height for this part while
         accepting border-radius on the identical axis;
       · `scripts/base-equal-geometry-sweep.mjs` detects a real SYMPTOM (15
         channels carried nowhere and named nowhere — that part is verified
         from the shipped artifacts) but its stated CAUSE ("absent because it
         equals base") is a hypothesis that this reading contradicts. Keep the
         findings, distrust the explanation, and re-derive the cause at the
         mint.
     Three hypotheses about this bug have already died on measurement (value
     door, element level, and now most likely base-equal itself). Do not write
     another line of fix before the log line above prints.

     **SECOND ATTEMPT — THE PRECEDENCE OBSTACLE IS SOLVED, AND THE REAL GATE
     IS ONE LINE EARLIER THAN I THOUGHT.** Two findings, both reverted only
     because the third step is unfinished, not because they are wrong:
      1. PRECEDENCE IS SOLVED. Guarding at the literal's write site does NOT
         work — the token binding is minted AFTER the literal, so at write time
         there is nothing to detect. It must be a POST-PASS over
         `walkAnatomy(enriched)` just before fuse returns: for each part, drop
         `literals[ch]` when the same channel is carried in `tokens` or any
         `tokensByProp` map, and receipt the yield. The BINDING wins (named,
         themeable, per-variant); the literal is a base-plane fallback.
         With that, `npx tsx extract/computed/regate.ts` runs CLEAN across every
         library — polaris.tag no longer refuses — and computed-equal goes UP
         81.969% -> 82.189% (33968/41440 -> 34480/41952). More facts carried,
         nothing refused. This part is ready to re-apply.
      2. THE BASE FALLBACK STILL DOES NOT REACH FAB, and the reason is exact:
         `fuse.ts:1719` does `const el = a.getAligned(...)[pi]; if (!el)
         continue;` BEFORE any value inspection. For the axis value that equals
         base there is no aligned ELEMENT at all — not merely a missing value —
         so the loop skips the combo entirely and never reaches the
         `v === undefined` guard where a value-level fallback would live.
         Re-measured after the change: fab's enriched contract still has ZERO
         width/height and the sweep still reports 15.
      3. **CORRECTION TO (2) — MEASURED, DO NOT ACT ON THE "ELEMENT LEVEL"
         CONCLUSION.** I checked whether the large combos lack the ELEMENT or
         only the VALUE. They lack only the value:
             small  24 captures · elements[0] present · delta.width present
             medium 24 captures · elements[0] present · delta.width present
             large  23 captures · elements[0] present · delta.width UNDEFINED (23/23)
         So `if (!el) continue;` is NOT the gate and the fallback does NOT
         belong at the element level. The value-level fallback I wrote should
         have fired — and did not.
         THE REMAINING UNKNOWN, and the exact next question: the loop reads
         `el.node.style[channel]`, NOT `delta`. Raw captured-truth elements
         carry `delta` and no `style` at all (styleHasW is 0 for EVERY size,
         including the ones that carry a delta), so `a.getAligned()` is
         synthesising `.node.style` somewhere. FIND THAT RESOLUTION STEP and
         determine what it does with a channel absent from the delta — whether
         it merges base, or leaves the key unset. That is where the fact is
         lost, and it is one level below anything measured so far.
         NARROWED TO THE LAST UNKNOWN: `buildUnion` (anatomy.ts:922) sets
         `rep: node` — the captured node itself — and `alignedByKey` holds one
         FlatEl per union entry per capture, whose `.node` is THAT CAPTURE's
         node. So `el.node.style` is the aligned capture's own style object.
         But raw captured-truth elements carry `delta` and NO `style` at all
         (measured: styleHasW is 0 for every size). Therefore something in the
         CAPTURE LOADER expands `delta` into `style` before buildUnion ever
         sees it. THAT loader is the last unexamined layer and the only place
         left where fab's 56x56 can be going missing. Find where a Capture is
         read off disk and how it materialises `style` from `delta` + base.
         The decisive experiment is one log line: for the fab root, print
         `el.node.style.width` for a small, a medium and a large combo.

         NARROWED ONE MORE LEVEL: `getAligned` (fuse.ts:128) does nothing but
         return `union.alignedByKey.get(key)` — no resolution of its own. The
         aligned elements come from `buildUnion(captures, base, classPrefix)`
         (fuse.ts:101), and each carries `node: e.rep`. So `.node.style` is
         whatever buildUnion puts in `rep`, and THAT is the last unexamined
         layer between a capture that holds 56x56 and a loop that reads
         undefined. START THERE.
         INSTRUMENT IT (log the resolved style for the fab root across the
         three sizes). Do not reason from the call site — this is the third
         hypothesis in a row about this bug that measurement has overturned,
         and the pattern IS the finding: every layer here synthesises something
         for the layer above, so the altitude a fact dies at is never where
         reading the code suggests.

     **THE FIRST ATTEMPT AND ITS REVERT — and the attempt found the next
     obstacle, which is worth more than the hypothesis below.** The one-line
     change is exactly what you would expect: at fuse.ts ~1784, before
     `if (v === undefined) { unk ??= ...; continue; }`, fall back to the BASE
     capture's value when the channel is in BASE_FALLBACK_CHANNELS —
     `a.getAligned(space.baseComboKey + '__default')[pi]` — because an absent
     delta MEANS "same as base". It typechecks and it is the right semantic
     (scoped to the NON-INHERITED box-geometry channels only; an inherited
     channel must never do this).
     IT DOES NOT SURVIVE `npx tsx extract/computed/regate.ts`:
       polaris.tag: part "link" carries channel "width" as BOTH a token
       binding and a literal — ambiguous, refused by name
     So filling the gap creates a SECOND fact for a part that already had one,
     and the mint path has no precedence rule between a base-derived value and
     an existing binding/literal. THAT is the real work: decide precedence
     (existing binding wins? base fallback only when the channel is otherwise
     absent for that part?) and re-run regate across ALL libraries, not just
     mui. Reverted rather than shipped half-exercised.

     **HYPOTHESIS FOR THE FIX, NOT YET VERIFIED — instrument fuse before
     trusting it.** There are two doors and width appears to fall between them.
     fuse.ts:2390 (`b.ref === null`, UNCORRELATED) carries a BASE-PLANE LITERAL
     for exactly `BASE_FALLBACK_CHANNELS ∩ LITERAL_CHANNELS` — which width and
     height are in — but it is guarded on
     `baseOcc = obs.occurrences.find(o => o.variant === space.baseComboKey)`
     being defined. If the observation stream is built from DELTAS, the base
     combo contributes no occurrence and `baseOcc` is undefined, so that door
     never opens. Meanwhile the CORRELATED door sees only {small:40, medium:48}
     — large is missing for the same delta reason — so a 3-value size axis
     looks partial and is refused. Result: neither door, and no receipt.
     Border-radius reaching tokensByProp with all three values (incl. the
     base-equal large=28) is the counter-example that should tell you which
     door actually works and why.
     **THE LOSS IS INSIDE FUSE — promote/curation is ELIMINATED.** Checked
     fuse's own output: `extract/computed/out/mui/fab/enriched.contract.json`
     already mentions width and height ZERO times (min-height once), root
     `literals` is null, and its size map holds only the four radii. So the
     fact never leaves fuse; nothing downstream dropped it. Search fuse only.
     One more lead worth checking first: fuse.ts:1784 turns an absent value in
     ANY combo into `unk` ("unmintable"), which would explain a channel that is
     observed on two of three sizes vanishing wholesale — but fab's
     `codeOnlyChannels` has only 2 entries and width/height are not among them,
     so if that IS the path, the codeOnly receipt is ALSO not being written,
     which is a second defect on top of the first.
     CONFIRM BY INSTRUMENTING, not by reading —
     this exact style of reasoning-from-the-comment is what produced a wrong
     conflict measurement earlier this session.
   - **select / table-pagination DO declare overflow** and the clip landed on
     inner parts, not the cell ROOT, so render is unchanged. Find why the root
     part does not carry it.
   - **text-field REFUSES BY NAME** on canvas: "duplicate ds_contracts/
     contractId mui.text-field on 3 component targets — refusing ambiguous
     identity". Pre-existing canvas condition; clean up the duplicates in
     MUI Test 1 before it can be rebuilt at all.
3. Then the other lanes' C1 — only mui was minted this session; astryx (1/11)
   and carbon (3/10) are the weakest boards.

## STANDING FACTS / HAZARDS

- **MEASURE THE TRIGGER, NOT THE COMMENT.** I measured the corpus for
  clip-vs-overhang conflicts, got ZERO, and the refusal fired on the first
  build. The comment said "overhanging children"; the code triggered on
  `childNode.clipsContent === false`, which is true of nearly every frame. The
  propagate walk now keys off `dsOverhangUnclip` (ancestors an overhang
  actually unclipped). Do not model a trigger from its docstring.
- The unclip heuristic is BROADER THAN CSS: it read "is out of flow" as "hangs
  outside the box". `position: absolute` inside `overflow: hidden` is clipped,
  normally. A DECLARED clip now STOPS the walk (`dsDeclaredClipStops`) — a
  captured fact outranks an inference about one. Fluent Spinner is the
  counter-example that made it visible.
- INSTRUMENT (scorer) is ink-box blind: extract/figma/canvas-gate/score.ts crops
  BOTH sides to their own ink box (WHITE_TRIM=250), so white-on-white chrome and
  frame-footprint deltas are invisible. Still open. Caveated passes to
  re-examine: altitude/heading, mui/radio, polaris/banner, polaris/text-field,
  polaris/tag, carbon/tag (+2.3px), tailwind/alert (+3.5px).
- mui/divider's scorecard covers ONE of three variants. Inset and Middle — the
  two that were actually broken — have references on disk
  (extract/computed/out/mui/divider/orig-shots/{inset,middle}__default.png) and
  no scorecard cell.
- 25 of 54 first-party receipts point at a SUPERSEDED emitted script (emitted/
  keeps 62 orphaned older-generation files). 10 of that lane's 11 scorecard
  passes were built from superseded scripts; only `card` is verified current.
- Carbon/checkbox indent: capture faithful (20+10). Do NOT "fix" contract to 24.

## RE-EMIT RECIPE (verified twice this session)

`npx tsx scripts/generate-figma.ts`; then per-lib `npx tsx
packages/cli/src/cli.ts figma examples/<lib>/contracts --out examples/<lib>/figma
--icons examples/<lib>/assets/icons --tokens
examples/<lib>/tokens/<lib>.dtcg.json,examples/<lib>/tokens/<lib>-minted.dtcg.json`
(mui carbon tailwind astryx shadcn fluent); altitude via
`npx tsx scripts/reemit-altitude-figma.ts`; polaris via
`npx tsx examples/polaris/generate.ts`; then every
`examples/<lib>/scripts/build-genesis-batch.mjs`; then
`node scripts/build-plugin-zip.mjs --update-engine-receipt`; verify with
`node scripts/figma-scripts-fresh.mjs` (must be 8/8) and
`node scripts/plugin-engine-check.mjs`. Bump RUNTIME_EMIT_REV on any runtime
template change or amend skips as "unchanged".

## CANVAS LOOP

MUI lane lives on fileKey 59mLQlOMiD5w5za6SUcoO5 ("MUI Test 1") and it IS
Desktop-Bridge connected — that is what unblocked C1. stem-serve on :9224
(dir /tmp/ds-stem-serve); route is `/file?name=<f>` (NOT `/<f>`), shots POST to
`/shot/<lib>/<stem>-cell`. Rebuild a stem by copying its emitted script into
/tmp/ds-stem-serve and `fetch`ing it from figma_execute — the plugin CAN fetch
localhost (not 127.0.0.1). Cell ids live in
parity/receipts/console-loop/visual-truth/mui/<stem>.json.

RULES: never relax compositionOk; flip only on scorecard; NEVER score a
hand-probed node.
