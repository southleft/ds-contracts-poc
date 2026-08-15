# FLOWBITE KIT CLIMB — +1 stem, and two walls located precisely

    date      2026-08-14
    branch    feat/public-beta-prep
    coverage  5/46 (10.9%)  →  6/46 (13.0%)
    canvas    Y8Jhw6R49wTLuXZ0is2GmV — TextInput added as a NEW page; the
              original five pages were never rebuilt (verified before/after)

**Stopped on the wave's own STOP condition: a wall that needs an engine
change.** Three stems were attempted. One shipped. The other two are blocked by
two DIFFERENT causes, both measured and neither hand-waved.

## DELIVERED — TextInput

    seed        PROPOSED by extract/computed/seed-gen.ts from flowbite's .d.ts
                color(5) · sizing(3); defaults READ from TextInput.js
                (color="gray", sizing="md") — not chosen, not authored
    extract     ✔ replay computed equality 100.000%
                  gate computed 92.381% · pixel AA perfect 30/60
    promote     ✔ CLEAN — 6 contracts, 0 named refusals in the minted tree
    emit        ✔ root carries a real child (the Spinner failure mode checked
                  for explicitly, and absent)
    canvas      ✔ 15 variants (5 colours × 3 sizes), 234x530, correct per-colour
                  borders and three distinct heights

## WALL 1 — `FC-ROOT-ICON-NOT-EMITTED` (engine). Spinner.

Spinner is the best capture of the round and still cannot ship:

    extract     ✔ gate computed 100.000% · 160 pixel pairs
    promote     ✔ CLEAN — icon asset reconstructed (spinner-root.svg)
    emit        ✘ EMPTY. The emitted variant spec is
                  `{ type: 'root', layout, fixedWidth: 32, children: [] }`
    canvas      ✘ 40 variants, each a 32x1 white box with NO children

**Cause, located:** the contract promotes the icon onto the ROOT
(`anatomy.root.icon = { asset: "spinner-root", size: 12 }`, `parts: {}`). The
single-root emit path in `core/emit-figma-script.ts` builds
`rootSpec.children` **only from `root.parts`** — it never consults
`root.icon`. A contract whose ROOT *is* an icon therefore emits an empty box,
and the height collapses to 1px because nothing is inside it.

This is not a capture problem, a seed problem or a config problem: every
upstream stage is green and the fact is present in the committed contract. It
needs an emitter change, which this wave is not allowed to make — so Spinner
was backed out of `ds-library.json`, its promoted contract and emitted script
removed, and its blank page deleted from the canvas. **Its seed, config entry
and captured truth are KEPT**: they are correct, they cost 102s of capture, and
the next round should not pay for them again.

## WALL 2 — the library's DECLARED enums are a SUBSET of its THEMED enums

Checkbox refused at capture, by name:

    Error: Checkbox: base combo not in enumeration

`Checkbox.js` destructures `color = "default"`. The declared type is
`DynamicStringEnumKeysOf<FlowbiteColors>`, and **`FlowbiteColors` has 17 keys
and `default` is not among them** — while `checkboxTheme.color` has **18,
including `default`**. The library's own runtime default is a value its own
published type forbids.

This is the same class as the `Button.size` finding in
`FLOWBITE-COVERAGE-WALL.md` (`ButtonSizes` omits `md`; `buttonTheme.size` ships
it). Two independent instances make it systematic rather than a typo:

| stem | runtime default | in declared enum? | in theme? |
|---|---|---|---|
| Checkbox | `color="default"` | ✘ FlowbiteColors (17) | ✔ 18 keys |
| Radio | `color="default"` | ✘ same | ✔ 18 keys |
| Button | `size` incl. `md` | ✘ ButtonSizes (4) | ✔ 5 keys |
| TextInput | `color="gray"`, `sizing="md"` | ✔ **both** | ✔ |
| Spinner | `color="default"`, `size="lg"` | ✔ SpinnerColors has `default` | ✔ |

**TextInput shipped precisely because it is the one stem whose runtime defaults
are inside its declared enums.** That is the discriminator, and it is
checkable ahead of time — the next round can screen candidates on it in
seconds instead of discovering it at capture.

Getting Checkbox/Radio through would mean either sourcing the enum from the
THEME rather than the type (a `seed-gen` change — engine), or picking a default
the type happens to allow (inventing a base combo the library does not use).
Neither is in scope, so neither was done.

## WHAT WAS NOT DONE

No hand-authored prop space — every enum came from `seed-gen` reading the
library's declarations, and every default was READ from the library's runtime
source. No engine or FC change. No second library. No recapture of the original
five. No scorer or ratchet touched. The playground files were never opened; the
only canvas written was `Y8Jhw6R49wTLuXZ0is2GmV`.

## DOCS SYNCED

`docs/BETA.md` now says six sets and names TextInput. The golden-path command is
UNCHANGED and still runs verbatim — only its output moved, from `bb96f43e…`
(five) to `22d50bf1…` (six). Both earlier receipts are annotated SHA SUPERSEDED
rather than edited, because what they pin is the reproducibility, not the
constant. `examples/tailwind/PROVENANCE.md` coverage row: **5/46 → 6/46
(13.0%)**, with Spinner explicitly excluded and the reason linked here.

## THE PIPELINE STEPS I SKIPPED, AND THE GATE THAT CAUGHT IT

Emitting the scripts is not the whole lane. `tailwind-figma-genesis` failed
with `text-input.figma.js: headless execute FAILED — Missing variable:
imported/text-input/part-0-0/padding-bottom/md`, because three committed
artifacts still described a five-component lane:

    build-figma-tokens.mjs      304 -> 411 variables
    figma-compile-receipt.mjs   5 scripts, 48 variants -> 6 scripts, 63 variants
    build-genesis-batch.mjs     ORDER was a HARDCODED five-script list —
                                TextInput was absent from the one-paste batch
                                entirely (`grep -c flowbite.textinput` = 0)

The genesis batch is the "one deterministic paste" a designer uses, so a stem
missing from it is a stem that does not ship no matter how well it captured.
`ORDER` now includes `text-input.figma.js` and the batch is mock-proven at
**6 sets / TextInput(15) / 411 variables**. The eval's pinned counts were
updated to match the lane's new shape — the numbers moved because the lane
grew, which is the pin working, not being worked around.

`seed:verify` for tailwind also moved **2/7 → 6/11 exact**: the Spinner and
TextInput seeds are now committed, and both reproduce their own proposals
exactly (they ARE the proposals). carbon 11/14 and mui 28/43 unchanged.


---

# RESUME WAVE (2026-08-14) — WALL 1 IS CLOSED; SPINNER HIT A SECOND, DEEPER ONE

    coverage  UNCHANGED at 6/46 (13.0%) — TextInput still the only new stem
    canvas    Y8Jhw6R49wTLuXZ0is2GmV — six pages, unchanged from the last wave

## PHASE 0 — `FC-ROOT-ICON-NOT-EMITTED` IS FIXED

Red-tested, fixed, and proven byte-neutral:

    RED    spinner root spec = { type:'root', layout, fixedWidth:32, children: [] }
    FIX    core/emit-figma-script.ts — the single-root path now projects
           `root.icon` through partToSpecs when the root declares no parts
    GREEN  children: 1 · type=svg · iconSize=12 · svgPaintVar bound · svg 1107ch

**The first cut of the fix did nothing, and the reason is worth keeping:** the
guard was `root.icon && !root.parts`, but promotion writes `parts: {}` on a
part-less root and **`{}` is truthy**, so the branch never ran and the emit was
byte-identical to the red. The guard now counts KEYS.

**BYTE-NEUTRAL, verified by re-emitting every lane** (mui, carbon, tailwind,
astryx, shadcn, fluent, altitude, polaris, first-party): the only script that
changed was the NEW `spinner.figma.js`. No existing emission moved.

On canvas the fix is visible — 40 variants that were 32x1 empty boxes now draw
glyphs.

## AND SPINNER STILL CANNOT SHIP — `FC-ICON-ROOT-PAINT-AXIS` (new)

With the icon emitted, two residuals remain, and only one of them is allowed
to be fixed:

**1. The colour axis is DEAD.** Measured on canvas: `Color=Default`,
`Color=Failure` and `Color=Success` all render `Vector fill 0,0,0` — identical
black. The contract's root carries ONE `color` token and no per-value
`tokensByProp`, so 40 variants differ by NAME only across 8 colours. The
capture is not at fault: it holds **280 elements carrying a colour/fill delta**.
They live on the svg's INNER paths (`part-0-0`, `part-0-1` — Flowbite's spinner
is a light track plus a coloured arc), and promoting the root to a single icon
asset folds those paths into one glyph with one paint variable. **An
icon-rooted component cannot express a per-variant paint axis** through the
current icon projection: one asset, one `svgPaintVar`.

**2. The box is 32x12 where the library renders 32x32** — and this one is NOT a
defect to fix. The captured truth says the root is 32px x 32px; the contract
carries `width` per size and no height, because **Option B
(`FC-GEOMETRY-EXCLUDED`) deliberately excludes height as environment-dependent**.
That is a settled, locked decision. The squashed ellipse is that decision made
visible, and anyone "fixing" it is reopening Option B.

Shipping a Spinner whose eight colours are one colour would be a worse lie than
shipping nothing, so it is **held out again**: removed from `ds-library.json`,
the genesis ORDER, the bundles and the canvas. **Its seed, capture and the
Phase 0 engine fix are all KEPT** — the fix is correct and byte-neutral, and it
will pay off for the next icon-rooted stem whose paint is uniform.

## STOP

The wave stopped on its own condition — **a NEW engine/FC wall**
(`FC-ICON-ROOT-PAINT-AXIS`) — after closing the previous one. Progress and the
rest of the screened shortlist were not attempted: the honest thing after
finding a wall one layer beneath the one just fixed is to report it, not to
keep drilling in the same wave.

**Unblocking it** needs the icon projection to carry a per-variant paint —
either a paint variable per svg path, or promoting an icon-rooted component's
inner paths as real parts instead of folding them into one asset. Both are
emitter changes.


---

# SHIP-BAR WAVE (2026-08-15) — THE CLIMB'S TWO "WINS" WERE NOT WINS. HONEST COVERAGE IS 5/46.

A ship bar was introduced: promote clean · variants have ink · the axis is
VISIBLE not name-only · **and it looks like its class on a screenshot**. Applied
to what the climb had already banked, **both stems fail it**, so both are HELD
and the coverage row goes back to where it started.

    coverage   6/46 (13.0%)  →  **5/46 (10.9%)**  — a CORRECTION, not a regression
    shipped    button · badge · card · alert · toggleswitch
    held       TextInput (this wave) · Spinner (previous wave)

## PHASE 0 — TextInput: the cheap fix was tried and it CANNOT work

TextInput rendered as 15 empty pills. The proposed fix was to give it sample
text via `placeholder`. Done, measured, reverted:

    fixedProps: { placeholder: "name@flowbite.com" }  → re-captured

    occurrences of "name@flowbite.com" in captured-truth.json ....... 0
    ::placeholder STYLE rows captured ............................. 60
    promoted contract mentions placeholder ................... false
    contract render (gate-shot) .................. still an empty field

**A placeholder is an ATTRIBUTE, not DOM content.** The browser paints it
through the `::placeholder` pseudo-element, so the capture records sixty rows of
its STYLE and not one character of its TEXT. There is no text part for the
contract to carry, therefore none for the emitter to project, therefore no
canvas can ever show it by this route. The gate's own pixel agreement got WORSE
under the change (30/60 → 0/60 perfect pairs) because the real render gained
text the contract render could not reproduce — the number moving the wrong way
is the same finding stated numerically.

The config change was reverted and the capture restored to its prior numbers
(replay 100.000%, gate 30/60). **TextInput stays HELD.** Its pill shape has a
second cause that is PARKED, not fixed: the root is a block element whose width
is environment-dependent, so Option B (`FC-GEOMETRY-EXCLUDED`) excludes it and
the canvas hugs to empty content. Reopening that is out of bounds.

## WHAT THE HOLD COST — nothing, and that is itself the proof

Backing TextInput out returned the lane **byte-identical to its pre-climb
state**, verified file by file against the pre-climb commit:

    00-tokens.figma.js · GENESIS-BATCH.figma.js · tailwind.bundle.json
    COMPILE-RECEIPT.md · tailwind-minted.dtcg.json ......... ALL IDENTICAL
    golden-path bundle sha ....... back to bb96f43e… (was 22d50bf1… at six)

Add-then-remove producing the same bytes is a stronger determinism result than
the original single build, and both beta receipts were corrected to say so
rather than left claiming a superseded sha.

## THE LOOP DID NOT RUN — the Figma bridge disconnected mid-wave

The figma-console MCP dropped during Phase 0. **Every clause of the ship bar
after "promote clean" requires a canvas screenshot**, so no new stem —
Progress included — could have been judged, only applied blind. Screening
Progress and capturing it would have produced artifacts nobody could accept or
reject, which is the exact failure mode the ship bar exists to stop.

**One thing is outstanding and cannot be done from here:** the TextInput PAGE
is still present in `Y8Jhw6R49wTLuXZ0is2GmV`. The bundle no longer contains it
and the repo no longer ships it, but the page was applied before the bar
existed and the bridge went down before it could be removed. Whoever reconnects
should delete that page; nothing else on that file changed this wave.

## STATUS OF THE TWO HELD STEMS

| stem | promote | ink | axis visible | looks like its class | cause |
|---|---|---|---|---|---|
| TextInput | ✔ clean | ✔ | ✔ colour borders differ | ✘ empty pills, no text | placeholder is an attribute (this wave) + Option B width (PARKED) |
| Spinner | ✔ clean | ✔ (after the icon fix) | ✘ 8 colours all black | ✘ 32x12 ellipse | `FC-ICON-ROOT-PAINT-AXIS` (PARKED) + Option B height (PARKED) |

Both keep their seeds, their captures and the engine fix that made Spinner draw
at all. Neither counts. **The honest number is 5/46**, and it is the same number
the beta shipped with.


## THE LOOP RAN AS FAR AS THE BRIDGE ALLOWED — Progress refuses at CAPTURE

With the Figma bridge still down, steps 1-2 (screen, seed, extract) need no
canvas and were run; step 3 (apply + screenshot) does and was not.

**SCREEN — Progress passes every criterion, in seconds:**

    js files 3 · subs 1 · portal/Floating 0
    runtime defaults: color="default", size="md"
    ProgressColor  extends Pick<FlowbiteColors, 12 keys> + `default: string`   ✔ contains "default"
    ProgressSizes  extends Pick<FlowbiteSizes, "sm"|"md"|"lg"|"xl">            ✔ contains "md"
    not icon-root · not Checkbox/Radio

This is the first stem to clear the `runtime default ⊆ declared enum` screen
since TextInput, and it clears it on BOTH axes — `ProgressColor` declares
`default` outright, which is exactly what `FlowbiteColors` does not do and why
Checkbox and Radio are still parked.

**SEED — accepted faithfully:** `color(13)`, `size(4)`, proposed by seed-gen
from the library's `.d.ts`, defaults READ from `Progress.js`. `progress: 50`
rides `fixedProps` as a REQUIRED numeric render value, the same role
`label: "Toggle"` plays for ToggleSwitch — it is not an axis.

**CAPTURE — REFUSED, and it is a NEW wall:**

    Progress: 52 combos × 4 interactions
    phase 1 — capture sweep…
    locator.hover: Timeout 30000ms exceeded.
      waiting for locator('[data-combo="Progress:blue.sm"] > *')
        .filter({ visible: true }).first()

It fails on the FIRST hover of the sweep, not part-way through. Progress's
outermost element is an **unstyled `<div role="progressbar">`** whose children
are a label row that renders `false` when no labels are set, and the track. So
the element the harness reaches for — the combo's first visible child — is a
wrapper with no styling of its own.

**THE HARNESS IS NOT AT FAULT, and that was checked rather than assumed:** Card
was re-captured through the same config and exited 0 (`gate computed 88.235%`,
4/4 pixel pairs). The failure is Progress-specific. (That sanity run rewrote
Card's committed capture artifacts, which the wave forbids — they were reverted
immediately and the tree confirmed clean.)

This is **NOT on the parked list**, so by the wave's own stop rule it ends here.
It is also not yet root-caused beyond the measurement above — whether the wrapper
is genuinely zero-box, or the interaction targeting needs a visible-root rule
like the one the Tailwind round already added for Flowbite's sr-only input
(PROVENANCE, "VISIBLE-ROOT capture"), is the next round's first question.

**KEPT:** the Progress config entry and its seed. Both are correct and cost
nothing to keep; the next round should start at capture, not at screening.

## WAVE RESULT

    stems shipped this wave ...... 0
    honest coverage .............. 5/46 (10.9%), unchanged
    holds ........................ TextInput (ship bar), Spinner (ship bar)
    refusals ..................... Progress (capture)
    blocked ...................... every step-3 apply/screenshot, bridge down


---

# BRIDGE WAVE (2026-08-15) — A DIFFERENT FIGMA TRANSPORT CAME BACK, NOT THE ONE THE APPLY PATH NEEDS

    coverage      5/46 (10.9%) — unchanged
    canvas        Y8Jhw6R49wTLuXZ0is2GmV — stale TextInput page REMOVED; file now
                  matches the repo exactly (Page 1 + the five shipped sets)

## WHAT CAME BACK, AND WHAT DID NOT

`figma-console` — the Desktop Bridge with `figma_execute`, which the console-loop
apply path is built on — is **still gone**. What is available is the **claude.ai
Figma MCP** (`use_figma`, `get_screenshot`). It is a genuinely different
transport and it closed two things:

  · **TextInput's hold was re-verified from the canvas, not from memory.**
    `get_screenshot` on the live node returned 234x530 and the picture is
    fifteen vertical lozenges with no text — the ship bar's "text input" clause
    fails on all three counts. The hold stands on fresh evidence.
  · **The stale TextInput page is gone.** It was applied before the bar existed
    and the repo had already stopped shipping it. Removed with a guarded
    script (refuses unless page `19:158` is actually named `TextInput`), and the
    file now holds exactly `Page 1 · Alert · Badge · Button · Card ·
    ToggleSwitch`. The outstanding item from the previous wave is closed.

**IT CANNOT RUN THE APPLY, and the reason is concrete rather than a guess:**

    fetch inside use_figma ............ 'fetch' is not defined  (probed)
    use_figma code cap ................ 50,000 chars
    engine step sizes ................. tokens 52,982ch · component 72,113ch

Both steps exceed the cap and there is no way to stream them in, so the engine's
own generated scripts cannot reach the canvas through this transport. Writing a
smaller bespoke apply instead was refused for the same reason it was refused in
the LIVE-APPLY wave: it would not be the engine's output, so proving it proves
nothing.

## HelperText — PASSES EVERY OFFLINE GATE, HELD PENDING CANVAS

The loop advanced to a new stem. TextInput taught the screen that found it:
**its content is an ATTRIBUTE, so it can never show text — pick stems whose
content is DOM CHILDREN.**

    screen     js 3 · subs 1 · portal 0 · content = children
               runtime default color="gray" ⊆ HelperColors
               (Pick<FlowbiteColors, "gray"|"info"|"failure"|"warning"|"success">)
    seed       PROPOSED by seed-gen — color(5); default READ from HelperText.js
    extract    ✔ replay computed equality 100.000%
                 gate computed 87.059% · pixel AA perfect 20/20 on BOTH
    promote    ✔ CLEAN — 0 named refusals in the minted tree
    emit       ✔ root child is `{ type: 'text', characters: 'Helper text' }`
    contract render ✔ shows READABLE TEXT — the failure mode TextInput has
    genesis    ✔ mock-proven, HelperText(5), 314 variables

**It is still HELD.** The bar says a stem ships only if it looks like its class
**on canvas, by screenshot** — and unverified is not the same as passed. Every
offline signal is green and the only missing one is the one this transport
cannot produce. It is first in line the moment `figma-console` returns:
capture, promote and emit are all done and committed.

Backing it out returned the lane byte-identical AGAIN — bundle sha back to
`bb96f43e…`, compile receipt back to 5 scripts / 48 variants, genesis back to
5 sets / 304 variables. That is the third add-then-remove round trip this climb
has produced, and each one is a determinism result.

## WHERE THE LOOP ACTUALLY STANDS

    shipped ......... 5  (button, badge, card, alert, toggleswitch)
    held on the bar . TextInput (empty pills) · Spinner (dead colour axis)
    held on transport HelperText (everything green except the canvas screenshot)
    refused ......... Progress (capture: first hover times out on an unstyled
                      <div role="progressbar"> wrapper — a NEW wall, not root-caused)
    parked .......... FC-ICON-ROOT-PAINT-AXIS · Option B height/width

Three of the four blockers are now distinct and named, and none of them is
"the tool does not work" — they are one upstream type bug class, one emitter
projection gap, one capture-harness wrapper case, and one transport limit.
