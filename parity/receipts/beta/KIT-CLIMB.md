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

## HelperText — SHIPPED. THE FIRST STEM TO PASS THE SHIP BAR ON CANVAS.

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

**It shipped.** The bridge came back, the apply ran through the engine path
(`DSC.parseIncomingText` -> `DSC.planGenerate` -> execute), and the screenshot
answered the only question the offline gates could not:

    apply      Y8Jhw6R49wTLuXZ0is2GmV, NEW page only — the five existing pages
               (Alert, Badge, Button, Card, ToggleSwitch) were untouched
    result     HelperText -> node 28:405, 5 variants, 151x340
               tokens 314 (created 10, updated 304, aliased 22)
    screenshot READ AGAINST THE BAR, NOT THE SCORECARD:
                 promote clean ................ yes, 0 named refusals
                 variants have ink ............ yes, all five
                 colour axis VISIBLE .......... yes — gray, blue, red, green,
                                                amber are five distinct paints,
                                                not five names on one colour
                 looks like its class ......... yes — "Helper text" is legible
                                                at 2x in every variant

That is every clause of the bar, met by the screenshot rather than argued from
a scorecard. **Honest coverage 5/46 -> 6/46 (13.0%).**

What made it the one that cleared: its content is DOM CHILDREN, so the emitter
had something real to project (`{ type: 'text', characters: 'Helper text' }`),
and its colour axis paints the ROOT's own text — no child part, no icon, none
of the projection that FC-ICON-ROOT-PAINT-AXIS parks. TextInput failed the
first condition (content is an attribute) and Spinner the second (the axis
paints an SVG stroke the root never carries).

One transport note worth keeping: the apply first failed `Failed to fetch`.
The plugin allowlist is `localhost:9223-9232`, `localhost` resolves to IPv6,
and stale `figma-console-mcp` instances were squatting `[::1]` on every port in
that range. The bundle was fine; the port was. Killing the 2-day-old orphan
(PID 16608) freed 9224 and the same script applied unchanged.

A fourth add-then-remove round trip preceded this one and again returned the
lane byte-identical (`bb96f43e...`). The lane now sits at `a3ff9bc0...` with
HelperText in it — 6 scripts / 53 variants / 314 variables.

## Label — SHIPPED. THE SHAPE HELD A SECOND TIME.

HelperText did not just add a stem, it produced a SCREEN: **content in DOM
children + an axis that paints the root itself.** Label was chosen by running
that screen over the remaining 40, not by picking the next familiar name.

    screen     content = children (a <label> wrapping text)
               color axis paints the ROOT's own text — no child part, no icon,
               so nothing depends on the projection FC-ICON-ROOT-PAINT-AXIS parks
    types      RemoveIndexSignature<LabelColors> = default + FlowbiteStateColors
               = {default, info, failure, success, warning} — EXACTLY the five
               keys in labelTheme.root.colors. Declared and themed AGREE, which
               is the trap that still blocks Checkbox and Radio.
    seed       PROPOSED by seed-gen — color(5); default READ from Label.js
               ("default"); root element READ from the same file (<label>)
    extract    ✔ 20 captures · double-run byte-identity IDENTICAL
                 replay computed equality 99.646% (HelperText was 100.000%)
                 pixel AA perfect 20/20 on BOTH instruments
                 gate computed 86.250% · gate pixel AA 20/20
    promote    ✔ CLEAN — 1 part carried, 0 named refusals
    emit       ✔ all five variants carry `"characters": "Label text"` + textFill
    genesis    ✔ mock-proven, Label(5), 323 variables, 7 sets / 58 variants

    apply      Y8Jhw6R49wTLuXZ0is2GmV, NEW page only — the six existing pages
               were untouched. Label -> node 28:427, 5 variants, 145x340.
    screenshot READ AGAINST THE BAR:
                 promote clean ................ yes, 0 named refusals
                 variants have ink ............ yes, all five
                 colour axis VISIBLE .......... yes — near-black, cyan, red,
                                                green, amber, and they match the
                                                theme's gray-900 / cyan-500 /
                                                red-700 / green-700 / yellow-500
                 looks like its class ......... yes — "Label text" legible at 2x

**Honest coverage 6/46 -> 7/46 (15.2%).**

One number is worth stating rather than burying: replay computed equality is
**99.646%, not 100%**. It is not a clause of the ship bar and every AA pair is
perfect on both instruments, so it did not gate — but it is a real 0.354%
difference from HelperText's clean 100.000% and it is recorded here rather than
rounded away.

## THE AXIS-BEARING FRONTIER IS EXHAUSTED — MEASURED, NOT ASSUMED

Before picking a third stem the screen was run over ALL 46, mechanically, off
the library's own `.js` + `.d.ts`. Result: **every remaining stem that declares
a colour/size enum fails one of the two shipped clauses, and every one of those
failures reduces to a blocker already named on this board.**

    Textarea, FileInput, Select, RangeSlider, Checkbox, Radio
        void / native root — content is an attribute .... the TextInput class
    Rating
        axis paints a child SVG star ................... the Spinner class
                                                         (FC-ICON-ROOT-PAINT-AXIS, parked)
    Modal ..... portal/overlay root
    Avatar .... content is an image, not text
    Progress .. capture refusal (hover timeout), still not root-caused

That is a real boundary and it is worth stating plainly: **no NEW wall was
found** — nothing here is outside the parked/named list — but the cheap
colour-axis stems are gone. What remains that can ship are AXIS-FREE text
stems, and Card has been proving since day one that those are legitimate.

## Kbd — SHIPPED. THE FIRST AXIS-FREE STEM SINCE CARD.

    screen     content = DOM children (a <span> wrapping text)
               entire appearance painted on the ROOT's own class string:
               rounded-lg + border + bg-gray-100 + text-gray-800
    seed       seed-gen RUN and SILENT — KbdProps declares no enum prop at all
               (only `icon?: FC`) and kbdTheme.root is a single `base` string.
               `props: []` is the same pure shell as the shipped Card seed, so
               NO prop space was invented. Root element READ from Kbd.js.
    extract    ✔ 4 captures · replay computed equality 99.823%
                 gate computed 100.000% · pixel AA perfect 4/4 on BOTH
    promote    ✔ CLEAN — 1 part carried, 0 named refusals
    emit       ✔ `"characters": "Ctrl"` + fill + stroke + textFill +
                 cornerRadius + per-side strokeWeight — the SAME binding shape
                 as the shipped Card, all token-bound rather than literal
    genesis    ✔ mock-proven, Kbd(1), 331 variables, 8 scripts / 59 variants

    apply      Y8Jhw6R49wTLuXZ0is2GmV, NEW page only — the eight existing pages
               untouched. Kbd -> node 29:438, COMPONENT (1 variant), 40x30.
    screenshot READ AGAINST THE BAR at 4x:
                 promote clean ................ yes, 0 named refusals
                 has ink ...................... yes
                 axis visible ................. VACUOUS — no axis exists to
                                                render, exactly as Card
                 looks like its class ......... yes, and this is the strongest
                                                one yet: "Ctrl" is legible
                                                INSIDE a real bordered, filled,
                                                rounded key cap. The box is the
                                                thing TextInput could not draw.

**Honest coverage 7/46 -> 8/46 (17.4%).**

## Blockquote — HELD. **FC-FONT-SLANT-NOT-CARRIED** — A NEW WALL.

This is the one that stopped the loop, and it stopped it for the right reason:
the stem passed every instrument except the one that was looking at the thing
that matters.

    screen     PASSED — content = DOM children, single `base` string on the root
    extract    ✔ 4 captures · double-run byte-identity IDENTICAL
               ✔ replay computed equality 100.000%
               ✔ replay pixel AA perfect 4/4
    promote    ✔ CLEAN — 1 part carried, 0 named refusals
    gate       ✖ **pixel AA perfect 0/4** — every capture differs
               ✖ gate computed 94.118% — exactly one channel short of 17

### The measured cause

`font-style: italic` is in `captured-truth.json`. It is NOT in the enriched
contract, which carries only:

    declared: display, font-family
    tokens  : color, font-size, font-weight, line-height, width

while the capture enumerated `font-style` alongside 19 other text channels.
`blockquoteTheme.root` is `text-xl font-semibold italic text-gray-900` — for a
Blockquote the **italic IS the component**. Drop the slant and what reaches the
canvas is upright text that is no longer the thing that was measured.

### Scope: this is systemic, not a Blockquote quirk

    grep -rl '"font-style"' examples/*/contracts/*.contract.json   ->  0 files

**No contract anywhere in this repo carries `font-style`.** The emitter does
have a `fontStyle`, but it is Figma's *weight name* ("Regular"/"Medium"), not
CSS slant — so there is currently no path from an italic in the DOM to an
italic on the canvas, for any library.

### Why it is a NEW wall and not FC-FONT-SUBSTRATE

It is the same CLASS as FC-FONT-SUBSTRATE — a text-identity channel that is
captured and then never reaches the contract, so the canvas draws a substitute.
It is a different CHANNEL (slant, not face), and the difference that matters is
this: FC-FONT-SUBSTRATE has only ever been a reporting-only note that never
fails CI, because for every stem shipped so far the face was incidental. Here
the dropped channel is load-bearing, and it is the first time this class has
actually BLOCKED a stem. That is a new wall, it is not on the parked list, and
under the standing rule it stops the climb rather than being worked around.

### What was NOT done

Blockquote was not promoted, not added to `ds-library.json`, not added to the
genesis ORDER, not bundled, and never applied to canvas. The lane still stands
at exactly 8. Its capture output and seed are kept as the evidence behind this
entry, the same way TextInput's and Spinner's are — a hold with receipts, not a
deletion.

**No workaround was attempted.** Declaring `font-style` by hand in the contract
would have shipped a stem whose italic came from me rather than from the
capture, which is the exact failure this board exists to prevent.

### CLOSED 2026-08-15 — `feat/font-slant-carry`

The wall was ONE registry miss, and the wall entry above named it correctly.

**Where it died.** `prepareMint` (`extract/computed/fuse.ts:1841`) classifies a
channel whose value has no mintable KIND by looking it up in
`DECLARED_CHANNELS`. Everything upstream had already done its job:
`styledChannels` admitted `root.font-style` (it differs from the control
baseline) and the mint loop found it UNIFORM across all combos at `italic`.
Then the registry lookup missed, so the last `else` fired and the slant went to
`codeOnly` with the receipt the ledger quotes —

    root.font-style — value shape outside mintable kinds (color/px/number/
    shadow/gradient) and outside the declared-channel registry — no schema
    channel today

— which is not a refusal on the merits. It is "there is no box for this."

**The fix.** `font-style` is now a `DECLARED_CHANNELS` entry with the grammar
`normal|italic|oblique`. `oblique <angle>` stays OUT: it is a synthesized slant
with no face behind it and no Figma spelling, so it refuses by name rather than
carrying a value nothing can draw.

The verdict is **`draw`, not `annotate`** — and that distinction was the only
real design decision in the slice. Figma does spell the slant, just not as a
field: it lives inside `fontName.style` ("Semi Bold Italic"). Recording a
drawable channel as `annotate` is the same lie the `overflow-x` `drawExcept`
split exists to prevent, so the canvas lowering shipped with the carriage:

  * `TextCtx.fontItalic` is a SEPARATE flag from `TextCtx.fontStyle` (which is
    Figma's WEIGHT name). Baking the slant into the weight name would have been
    erased silently by any descendant that binds its own `font-weight` token —
    `applyTokens` rewrites `fontStyle` wholesale.
  * `figmaFaceStyle(ctx)` composes the two halves once, at the spec boundary,
    and encodes Inter's spelling (weight 400 + italic is `Italic`, not
    `Regular Italic`). Non-italic contexts get back exactly the old value, so
    every slant-free contract emits byte-identically.

**Red → green, both halves independently:**

    npm run extract:computed:font-slant:check
      registry     font-style registered · canvas=draw; `oblique 40deg` refused
      carriage     tailwind/Blockquote root.declared['font-style'] = italic
                   (was: absent, and named in the code-only ledger)
      no invention carbon/Button carries no slant
      canvas       declared italic -> face "Semi Bold Italic", composed with
                   the weight, loaded via C.fontStyles, and READ BACK off a
                   built TEXT node through the plugin's own Figma mock —
                   `fontName.style = "Semi Bold Italic"`, not just a payload
                   string (was: "Semi Bold" — the contract carried the slant
                   and the canvas still drew upright)
      return leg   REST italic node -> "Semi Bold Italic"
                   (was: "Semi Bold" — the slant died on the way back)

    npm run prep:schema && npm run closure:check
      font-style   UNMAPPED -> READ (fontName / italic)
      still red    overflow-x, overflow-y — PRE-EXISTING, and reproduced on
                   clean `main` once the stale schema `dist/` is rebuilt

**The `draw` verdict pulled in a SECOND defect, and it was the interesting
one.** `closure:check` enumerates every `DECLARED_CHANNELS` entry with
`canvas: 'draw'` and refuses any that the readers cannot recover. Adding
`font-style` turned it `UNMAPPED` — and mapping it exposed a real asymmetry
between the two readers:

    dump.plugin.js  reads `node.fontName.style` VERBATIM  -> "Semi Bold Italic"
    rest/map.ts     derived the face from the weight NUMBER via
                    FONT_STYLE_BY_WEIGHT                  -> "Semi Bold"

REST does not report a face name for this at all: it reports `fontWeight: 600`
plus a separate `italic: true` boolean, and `mapText` read only the first. So
the REST leg would have read an italic node back as upright, with nothing
naming the loss — the exact silent-loss shape the closure gate exists to find,
found by the gate, on a channel added in the same commit. `RestTypeStyle.italic`
was already TYPED and simply never read. `mapText` now composes the two halves
in the emitter's own spelling, and check 4 pins both directions.

Note that this gate could only see the defect after `npm run prep:schema` —
it imports the BUILT `@ds-contracts/schema`, and a stale `dist/` reports on a
registry that no longer exists. Running it against source-only edits reports
green on channels it has never seen.

**The gate moved, measured on the identical committed capture:**

    npx tsx extract/computed/regate.ts --config .../tailwind.json \
      --component Blockquote --out extract/computed/out/tailwind

    committed (harness run) .... 94.118% computed-equal (64/68; 0/4 rows equal)
    re-run (current code) ...... 100.000% computed-equal (68/68; 4/4 rows equal)

**Byte-neutral where it should be.** `golden-generated-output` passes: the whole
generated corpus (`src/` + the `figma-sync` scripts) is unchanged, which is also
the proof that no COMMITTED contract carries a slant today. `npm run generate`
re-emits all 56 components with a zero diff. `npm run conformance` reports no
drift against `BASELINE.json`. Re-gating every other tailwind lane and both
fluent lanes that have italic in their capture (Dialog, TabList) shows no
regression — several improve slightly, and those deltas reproduce with this
branch stashed, so they are committed-scorecard drift and not this change.

**Scope of the lift, re-fused over the whole committed corpus:**

    104 components re-fused offline
    font-style CARRIED ......... 1   tailwind/Blockquote.root = italic
    font-style still dropped ... 0

One carry. The channel was systemically missing, but the corpus authors it
exactly once — which is what makes it a clean close rather than a wave.

### The residual, named and NOT fixed here

`font-style` rides the same control baseline as every other channel, and that
baseline is the pre-existing 4-tag one (`CONTROL_TAGS` = button/span/a/div,
already documented in `extract/computed/ua-baseline-check.ts` and queued in
`docs/HANDOFF.md`). `<blockquote>` has no control, so it was measured against
`<span>`. For Flowbite that verdict is right — `blockquoteTheme.root` really
does say `italic` — but the engine cannot yet DISTINGUISH an authored slant
from the user agent's own on `<i>`/`<em>`/`<cite>`. The two conformance cases
that hit this (`grid-subgrid`, `grid-in-flex-fill`) carry `<i className="cf-b" />`
— empty layout probes with no glyph to slant — and `conformance` reports no
drift, so nothing moves on it today. Widening `CONTROL_TAGS` is a CAPTURE
change and stays where it already was: named, queued, and not started here.

**Blockquote is unblocked on THIS wall, and is not promoted in this slice.**
The computed instrument is closed and reads 100% / 4-of-4 rows. The pixel half
is NOT re-measured: `regate` explicitly does not score pixel pairs (the
original package screenshots are session artifacts, not committed), so
`pixel AA 4/4` needs a harness run. That run is the next stem, and this slice
stops at the wall it was opened for. Blockquote remains out of
`ds-library.json`, out of the genesis ORDER, out of the bundle, and unapplied.

## FINDING — **FC-HOP4-GEOMETRY-REMINTS-ONLY** (closed 2026-08-22)

Hop-4's remaining MINTED set is only Button `root.height.{xs,sm,md,lg,xl}`
— live HORIZONTAL AUTO×FIXED on `59mLQ`, named `FC-GEOMETRY-EXCLUDED`.
A new dump-slug mint is a reopen of the remint class (shadow / padding /
opacity / hug-height), not a geometry climb. Pin: hop-4 allows only
those five names.

## FINDING — **FC-HOP4-SIZING-AXES-SWAPPED** (closed 2026-08-22)

`FC-HOP4-SIZING-HUG-INVENTED` replaced illegal `HUG` with `AUTO` but
kept primary/counter mapped to `layoutSizingHorizontal` /
`layoutSizingVertical`. dump.plugin writes `primaryAxisSizingMode`.
On a VERTICAL hug-height + fixed-width stack (Kbd, Label, HelperText
on `59mLQ`) live is AUTO×FIXED. The fixture was FIXED×AUTO, so hop-4
minted `imported.*.root.height` for a height the canvas hugs. Button
HORIZONTAL AUTO×FIXED (fixed height) is live and stays
`FC-GEOMETRY-EXCLUDED`. Pin: fixture roots, hop-4 refuses those three
height remints.

## FINDING — **FC-DUMP-PROPOSE-SHADOW-MINTED** (closed 2026-08-22)

Figma cannot bind effect stacks. Emit writes Card's 6-layer DROP_SHADOW
and Button Active / Focus Visible stacks as literals. Propose minted
dump-slugs (`imported.card-flowbite-card.root.box-shadow`,
`imported.button-flowbite-button.state-*.box-shadow.{color}`).
`FC-DUMP-PROPOSE-CARD-SHADOW` forbade inventing the authored name
without a value match — dump hex and authored rgba are different
spellings of the same layers (alpha 0.1 vs `#0000001a`). When the
stamped authored ref resolves to those layers, recover that ref. An
unstamped foreign stack still mints (Path A). Pin: hop-4 Card + Button,
`exact-proposal-check.ts` §29.

## FINDING — **FC-DUMP-PROPOSE-PADDING-LITERAL-MINTED** (closed 2026-08-22)

Emit writes Alert icon `padding-right: 12px` and dismiss `6px` on all
four sides as unbound layout literals — Figma has no padding variable
on those frames. Propose's mintPadding minted dump-slugs
(`imported.alert-flowbite-alert.part-0-alert-icon.padding-right`,
`…part-0-dismiss.padding-inline/block`). The stamped authored contract
already spells those px as literals. Recover the literals when they
match the drawn values. An unstamped foreign dump still mints (Path A).
Pin: hop-4 Alert, `exact-proposal-check.ts` §28.

## FINDING — **FC-DUMP-PROPOSE-DISABLED-OPACITY-MINTED** (closed 2026-08-22)

Emit writes Button `State=Disabled` `node.opacity` as an unbound 0–1
literal (unbind the OPACITY variable, then write 0.5) so re-apply
cannot wash the preview to 0.5%. Dump captures `opacity: 0.5` on the
five pinned Disabled cells. Propose's state numberChannel minted
`{imported.button-flowbite-button.state-disabled.opacity}` — a token
the canvas refused to bind. Nearest-corpus match is also wrong (0.5
hits `radius-lg`). When the set is stamped and the authored
`states.disabled.opacity` resolves to the drawn 0.5, recover that
ref. An unstamped foreign Disabled axis still mints (Path A). Pin:
hop-4 Button, `exact-proposal-check.ts` §27.

## FINDING — **FC-DUMP-PROPOSE-NAME-PARENTHETICAL** (closed 2026-08-22)

Emit disambiguates a foreign same-name set as `Name (contractId)`
(`Alert (flowbite.alert)` on `59mLQ`). Propose PascalCased the whole
drawn name and reminted `Alert` → `AlertFlowbiteAlert` (same for
Badge/Button/Card). The stamped `contractId` already names the suffix;
strip only that match and recover the authored name. An unstamped or
mismatched parenthetical stays sanitized as drawn. Pin: hop-4 (all
eight names), `exact-proposal-check.ts` §21.

## FINDING — **FC-DUMP-PROPOSE-DISABLED-INVENTED** (closed 2026-08-22)

Emit with `figmaStatePreviews` draws `State=Disabled` as a preview
VARIANT cell and stamps `statePreviewAxis`. Propose already refused to
invent `State` as an API prop from that stamp, then still promoted
`State=Disabled` to a `disabled` BOOLEAN bound to design property
`Disabled`. Live Button on `59mLQ` has no such BOOLEAN (Color / Size /
Content / State only). Authored `flowbite.button` has `disabled` as a
CSS state, not a prop. The BOOLEAN reminted API the canvas never
drew. When `statePreviewAxis` names Disabled as a preview cell, keep
the disabled STATE block and do not invent the BOOLEAN. An unstamped
foreign State=Disabled axis still promotes the BOOLEAN (Path A table).
Pin: hop-4 (all eight refuse `disabled` / `Disabled`),
`exact-proposal-check.ts` §6 + §26.

## FINDING — **FC-PLUGIN-STANDALONE-DRIFT-SNAPSHOT** (closed 2026-08-22)

Check Drift already fingerprints standalone Card/Kbd (`COMPONENT` roots)
and reports `canvas-edited`. The WHAT drill-down walked SET children
only, so a fill/layout/token edit came back with empty `editedVariants`
and empty `setChanges` (the set snapshot is description + propdef). The
node already carries `canvasSnapshot` — the same lines SET variants
use. Drill it. Pin: `plugin:check` stamps a standalone Kbd-shaped
COMPONENT, edits a fill, and asserts the handler calls
`pushEditedSnapshot(node)` on `node.type === 'COMPONENT'`.

## FINDING — **FC-HOP4-LAYOUT-TUPLE** (closed 2026-08-22)

Live default-variant auto-layout on `59mLQ` is Button `row`×CENTER×CENTER
(elides to the emit default), Badge/ToggleSwitch `row`×MIN×CENTER, and
Alert/Card/HelperText/Kbd/Label `column`×MIN×MIN. Propose already
recovers that: Button has no layout block; Badge/ToggleSwitch keep
`align: center` (omitted justify is MIN); column stems omit MIN/MIN.
An elision that swallowed Badge would re-apply as CENTER×CENTER and
pack-start would become centered. Pin: `flowbite-dump-propose:check`
asserts those eight root tuples.

## FINDING — **FC-HOP4-LIVE-EXTRAS-SAME-AS-ABSENT** (closed 2026-08-22)

A live `dump.plugin` pass on `59mLQ` writes fields the compact hop-4
fixture omits: PIXELS `lineHeight` beside `lineHeightVar`,
`strokeWeight: 0` beside bound side weights, `strokeAlign: INSIDE`,
`minWidth` beside `bound.minWidth`, and `cornerRadius` beside bound
radii. Injecting those extras does not grow the MINTED set and all
eight stems still `verified-exact`. Stamps / side binds already win;
the fixture omit is compact, not a remint hole. Do not inject VECTOR
`abs` / icon `fixedSize` (FC-GEOMETRY-EXCLUDED). Pin:
`flowbite-dump-propose:check` clones the fixture, injects the extras,
and refuses new `MINTED {…}` names.

## FINDING — **FC-VISUAL-SCREENSHOT-TIMEOUT** (closed 2026-08-21)

`extract:figma:visual:catalog` flipped Heading `Level=H4, Size=Large` from
baseline `diffed` to `refused` when `page.screenshot` hit Playwright's
30s timeout under overlapping maintain ticks. That is not a pixel
regression and not `FC-FONT-SUBSTRATE` (the H4 Large over-threshold
score is already locked). Render retries the screenshot once on a
Timeout so a starved Chromium cannot fail the team command. Pin: the
retry in `extract/figma/visual-parity/render.ts`.

## FINDING — **FC-HOP4-SIZING-HUG-INVENTED** (closed 2026-08-20)

The hop-4 fixture spelled `layout.primarySizing` / `counterSizing` as
`HUG` (the `layoutSizingHorizontal` word). dump.plugin and REST write
`primaryAxisSizingMode`, which is `AUTO` | `FIXED`. Propose treats both
non-FIXED spellings the same on stacks, so maintain stayed green while
the pin fixture was not a legal dump v1 document. Replaced `HUG` →
`AUTO` (83 primary + 49 counter). Pin: `flowbite-dump-propose:check`
refuses a `HUG` sizing field.

## FINDING — **FC-PLUGIN-SECTION-SELECTION** (closed 2026-08-20)

`selectionSetNames()` walked ancestors for COMPONENT_SET / COMPONENT /
INSTANCE only. Flowbite Card and Kbd are standalone COMPONENTs inside an
identity-marked Section; selecting the Section (the thing the designer
clicks) resolved nothing and the Send tab said "Nothing selected / type
its name". A selected Section now names its hosted COMPONENT /
COMPONENT_SET children. Pin: `plugin:check` lifts the real function and
asserts Section → `Kbd`, COMPONENT still → `Kbd`, empty Section → `[]`.

## FINDING — **FC-DUMP-MINMAX-ZERO-INVENTED** (closed 2026-08-20)

Dump v1.4 wrote `minWidth`/`minHeight`/`maxWidth`/`maxHeight` whenever
the field was a number. Figma's FrameNode default is `0`, so a live
eight-stem dump would invent a tap-target fact on every frame and
propose would mint `min-width: 0`. dump v1.30 omits 0 on both producers
(plugin dump and REST `map.ts`); propose ignores a literal 0 so a
pre-v1.30 dump cannot remint it. A drawn `minWidth 44` still carries.
Pin: `exact-proposal-check.ts` §25, `plugin:check` Badge dump omits 0
and keeps 44.

## FINDING — **FC-DUMP-PROPOSE-VERSION-INVENTED** (closed 2026-08-20)

Propose hardcoded `version: "0.1.0"`. Authored Flowbite contracts are
`0.2.0` and the SET caption already says `v0.2.0`, but genesis never
stamped `ds_contracts/version` (the plugin engine path did). Stamp it on
create/amend; dump v1.29 carries it; propose uses a semver stamp and keeps
inventing `0.1.0` for unstamped / malformed dumps. Adding `version` to
compiled C moves every eight-stem specHash — amend restamps. Pin: hop-4
(`0.2.0` on all eight), `exact-proposal-check.ts` §24, `plugin:check`
Badge dump ≡ stored version.

## FINDING — **FC-DUMP-SPECHASH-DROPPED** (closed 2026-08-20)

Emit stamps `ds_contracts/specHash` on every set this pipeline drew.
dump v1.27 already carried `contractId` / `semantics` / `propNames` /
`statePreviewAxis` from that namespace and dropped `specHash`, so a live
dump could not say whether the set matches the current engine. Carry the
stamp (dump v1.28); propose notes it and does not write it onto the
contract. Unstamped / malformed dumps stay silent. Pin: hop-4 +
`exact-proposal-check.ts` §23 + `plugin:check` Badge dump ≡ stored hash.

## FINDING — **FC-DUMP-REACTIONS-SILENT** (closed 2026-08-20)

Live Flowbite Button (5 Default/Md cells) and Badge (6 Default/Xs cells)
carry emit-written `ON_HOVER`/`ON_PRESS` → `CHANGE_TO` reactions. dump
v1.26 walked those nodes and named nothing, so the wiring vanished with
no receipt. dump v1.27 names `prototype-reactions-unsupported`. Propose
already attaches `_degradations`; it does not invent `onClick`. The State
axis + `statePreviewAxis` stamp recover the matrix. Pin: hop-4 (5 Button
+ 6 Badge notes), `exact-proposal-check.ts` §22, `plugin:check` dump of
the MUI Button Default-plane sources.

## FINDING — **FC-EMIT-ROOT-MARGIN-SILENT** (closed 2026-08-20)

HelperText compiles `margin-top` onto the variant ROOT (`margins: { top: 8 }`).
`applyMarginBox` only wraps children. A COMPONENT_SET cannot wrap its own
COMPONENT, so the field was a runtime no-op and the Tokens variable stayed
unbound. Name the drop (`channelMiss`) and strip root margins from the
emitted spec — do not invent a geometry wrapper. Child residual margins
(ToggleSwitch label) still wrap. Pin: hop-2 genesis has no HelperText
`"margins"`; ToggleSwitch label still has them. Demo HelperText
`120:2014` specHash `4248162942` → `148732658` (interiors unchanged —
root margins never drew).

## FINDING — **FC-DUMP-PROPOSE-CONTRACT-ID-DROPPED** (closed 2026-08-20)

Emit stamps `ds_contracts/contractId` on every set this pipeline drew.
dump v1.25 already carried `semantics` / `propNames` / `statePreviewAxis`
from that namespace and dropped `contractId`, so a live dump of
`Alert (flowbite.alert)` proposed `ds.alert-flowbite-alert`. Carry the
stamp (dump v1.26); propose uses it when it matches the contract-id
grammar. Unstamped / malformed dumps keep the name-derived slug. Pin:
hop-4 + `exact-proposal-check.ts` §21.

## FINDING — **FC-DUMP-PROPOSE-TEXT-PAINT** (closed 2026-08-20)

Live Card `label-text` fill is unbound `#000000`. dump.plugin writes
`fill.hex`; hop-4's compact fixture omitted it, so propose minted a
dump-slug on a live dump and maintain stayed green. Lift unbound TEXT
fills to `literals.color` (SHAPE-PAINT twin). Pin: hop-4 +
`exact-proposal-check.ts` §20.

## FINDING — **FC-DUMP-PROPOSE-DEGRADATIONS-DROPPED** (closed 2026-08-20)

dump.plugin writes `_degradations` (Alert VECTOR paths are
`vector-geometry-unsupported`). `proposeBatchFromDump` already surfaced
REST `captureGaps` and dropped the plugin array, so a live Alert dump's
eight vector receipts vanished on hop 4. Carry each receipt onto the set
its `nodePath` names. Pin: hop-4 (8 Alert notes) +
`exact-proposal-check.ts` §19.

## FINDING — **FC-DUMP-PROPOSE-FIXTURE-CENSUS** (closed 2026-08-20)

The stamp gate only sees names already in the hop-4 fixture. A live
census of demo `59mLQlOMiD5w5za6SUcoO5` matched the fixture 186/186 —
so the gate was not blind today — but deleting a fill from the fixture
would shrink the gate without failing it. Pin the census
(`extract/figma/fixtures/flowbite-eight.stamps.json`) and require
fixture stamps equal the live names per stem.

## FINDING — **FC-DUMP-PROPOSE-STAMP-GATE** (closed 2026-08-20)

Hop 4 only required a hand-picked `stamped` sample per stem. Live canvas
stamps that already recovered — Kbd `{imported.kbd.root.color}`, plugin-data
weight/line-height, ToggleSwitch `min-width`, Badge/Button Active fills —
could remint without failing maintain. The hole is the gate, not a new
inverter miss: `flowbite-dump-propose:check` now walks every dump
`bound` / `fill.var` / `stroke.var` / `fontSizeVar` / `fontWeightVar` /
`lineHeightVar` (186 names on the eight-stem fixture) and fails if one
drops. Pin: hop-4 + `exact-proposal-check.ts` §18.

## FINDING — **FC-DUMP-PROPOSE-ALERT-NESTED-PAINT** (closed 2026-08-20)

Live Alert Vectors bind `imported/alert/label/color/{color}`; dismiss
binds radius `imported/shared/size-8` and fill
`imported/alert/root/background-color/{color}`; both Icon and dismiss
are `hidden` in every Color variant (BOOLEAN defaults false). The hop-4
fixture omitted those nested stamps, so a Vector-fill drop would not
fail maintain. Engine already recovers the canvas names (plus
`visibleWhen` on icon/dismiss). Pin: hop-4 + `exact-proposal-check.ts`
§17.

## FINDING — **FC-DUMP-PROPOSE-CARD-SHADOW** (closed 2026-08-20)

Live Card (`120:1999`) draws a 6-layer unbound DROP_SHADOW stack (4
transparent + `0 4 6 -1` / `0 2 4 -2` at 10% black). Figma cannot bind
effect stacks; emit writes `effectStack` as literals. The hop-4 fixture
omitted `effects`, so a default-stack drop would not fail maintain.
Propose already mints all-variant DROP_SHADOW as `tokens.box-shadow`.
Do not invent `{imported.card.root.box-shadow}` — the canvas has no
EFFECT bind. Pin: hop-4 + `exact-proposal-check.ts` §16.

## FINDING — **FC-DUMP-PROPOSE-SHAPE-PAINT-AXIS** (closed 2026-08-20)

Live ToggleSwitch checked thumbs draw an unbound transparent stroke
(`hex 000000` + dump `alpha: 0`), unchecked `#d1d5db`. The first
SHAPE-PAINT fixture flattened every thumb to gray, so hop-4 could not
catch a first-variant freeze. Engine already lifts the axis onto
`literalsByProp.checked`. Pin: hop-4 + `exact-proposal-check.ts` §15.

## FINDING — **FC-DUMP-PROPOSE-SHAPE-PAINT** (closed 2026-08-20)

Unbound hex fill/stroke on a dump v1.3 decor shape minted dump-slug
tokens (`part-0-part-0-after.background-color`). Placement already rides
the shape-part literals grammar; paint belongs there too. Bound paints
stay tokens. Live thumb is `#ffffff` / `#d1d5db` / `1px`, no variable.
Pin: hop-4 literals + `exact-proposal-check.ts` §14.

## FINDING — **FC-DUMP-PROPOSE-STATE-SHADOW** (closed 2026-08-20)

Live Button Active / Focus Visible draw a 5-layer DROP_SHADOW stack
(default-bare). `invertNodeEffects` required the stack in every variant
and named the split "not proposed". State diffs already own fill /
stroke / opacity; they now mint `states.active.box-shadow` and
`states.focus-visible.box-shadow` from the observed CSS stack. Canvas
did not bind a variable — do not invent
`{imported.button.root.box-shadow-state-*}`. Pin: hop-4 structural +
`exact-proposal-check.ts` §13.

## FINDING — **FC-DUMP-PROPOSE-SHAPE-SIZE-AXIS** (closed 2026-08-20)

`invertNodeShape` froze the first variant's ellipse size and named the
rest (`16×16, 20×20, 24×24`). Placement already classified onto Checked
(`left:2` / `right:2`); size is a second observed function of Sizing and
belongs in the existing `literalsByProp` vocabulary. Uncorrelated size
still freezes + names. Not `FC-GEOMETRY-EXCLUDED` (Focus Visible bbox).
Pin: hop-4 sm/md/lg widths + `exact-proposal-check.ts` §12.

## FINDING — **FC-DUMP-PROPOSE-THUMB-SHAPE** (closed 2026-08-20)

Hop 4 fixture named ToggleSwitch `part-0-after` as a bare `ELLIPSE` with
no dump v1.3 `shape`. Propose then wrote an empty part `{}` — the live
thumb is an ABSOLUTE ellipse (sm 16 / md 20 / lg 24; unchecked `left:2`,
checked `right:2`). Dump plugin already writes `shape`; the compact
fixture had dropped it. Engine recovers `shape.kind: ellipse` plus
checked-axis `stylesWhen` when the dump has the field. Pin: hop-4
structural + `exact-proposal-check.ts` §11. First-variant size freeze
(20×20) is the existing shape grammar, not `FC-GEOMETRY-EXCLUDED`.

## FINDING — **FC-DUMP-PROPOSE-TOGGLE-PART-BOUND** (closed 2026-08-20)

Hop 4 fixture carried ToggleSwitch `part-0` fill only. Live `59mLQ`
already binds track width/height/min-width/`size-9999` radius. Propose
recovers those names when the dump has them; without nested `bound` they
dropped. Same class as Card `FC-DUMP-PROPOSE-NESTED-BOUND-UNPINNED`.
Pin: hop-4 `{imported.toggle-switch.part-0.width.{sizing}}` and
`{imported.shared.size-9999}`. Height bind is the canvas token, not
`FC-GEOMETRY-EXCLUDED`.

## FINDING — **FC-DUMP-PROPOSE-FOCUS-OUTLINE** (closed 2026-08-20)

Propose dropped Button Focus Visible outline width (bound number-channel
state inversion was unimplemented, and literal strokeWeight stayed 0) and
left the outline color on `states.focus-visible.border-color` because the
base already has an INSIDE border. Live `59mLQ` stamps
`outline-width-state-focus-visible` on all four sides with strokeAlign
OUTSIDE. Bound uniform width now inverts; OUTSIDE focus remaps to
`outline-color` / `outline-width`. Pin: `exact-proposal:check` §10 + hop-4
`{imported.button.root.outline-width-state-focus-visible}`. Do not climb
`FC-GEOMETRY-EXCLUDED` (Focus Visible 31% size delta).

## FINDING — **FC-DUMP-PROPOSE-STROKE-WEIGHT-SIDES** (closed 2026-08-20)

Propose treated four different side-weight variable names as "not
uniform" and dropped them. Padding already carries longhand when
left ≠ right. Live `59mLQ` Button Default binds
`border-top|right|bottom|left-width.{color}`. Those now recover as
per-side channels. Pin: `exact-proposal:check` §9 + hop-4
`{imported.button.root.border-top-width.{color}}`. Outline vocabulary
with mixed sides still names. Do not climb font/geometry.

## FINDING — **FC-DUMP-PROPOSE-STATE-TEXT** (closed 2026-08-20)

Propose hoisted the sole TEXT `label` to root tokens, then named-and-dropped
hover/active label fills (`no anatomy part maps`). Live `59mLQ` Button
already stamps `imported/button/root/color-state-hover|{color}` and
`color-state-active`. Those now ride `states.hover|active.color`. Pin:
`exact-proposal:check` §8 + hop-4 `{imported.button.root.color-state-hover.{color}}`.
Badge label ink is constant across states — no drop. Do not climb
font/geometry. Do not invent canvas-absent events.

## FINDING — **FC-PLUGIN-ENGINE-STALE** (closed 2026-08-20)

`plugin:check` failed: a fresh Apply bundle hashed `38dfc81f526c`
(721015 B) against receipt `cb747a67d3b4` (720756 B). Core changed
(propose type-stamps, token prune, emit) and the receipt was not
re-recorded, so a designer Apply would ship a stale engine.
Receipt re-recorded; `npm run plugin:check` is now on `maintain`.
Do not climb font/geometry. Do not claim v1.

## FINDING — **FC-DUMP-PROPOSE-NESTED-BOUND-UNPINNED** (closed 2026-08-20)

Hop 4 fixture carried `bound` on variant roots only. Card's inner
`label` frame on `59mLQ` already binds padding/gap to
`imported/shared/size-24` and `size-16`; propose reminted
`imported.card-flowbite-card.label.padding-*`. Nested binds now sit
on the fixture part and hop 4 requires `{imported.shared.size-24}`.
Alert icon/dismiss padding remints are literals (no canvas bind).
Button `root.height.{size}` remint is `FC-GEOMETRY-EXCLUDED` — do
not climb. Events stay canvas-absent.

## FINDING — **FC-DUMP-PROPOSE-TYPE-UNPINNED** (closed 2026-08-20)

Hop 4 fixture omitted dump `fontSizeVar` / `fontWeightVar` /
`lineHeightVar`. Live `59mLQ` already stamps them (`imported/button/root/font-size/md`,
`imported/label/root/font-size`, …). Propose then minted dump-slug
names (`imported.button-flowbite-button.label.font-size.{size}`)
because a Size axis with several numeric fontSizes short-circuited
to the px mint before reading the stamps. Unify stamped slash names
the same way bound layout paints unify. This is token identity, not
`FC-FONT-SUBSTRATE` (Inter vs system raster). Pin: exact-proposal
§7 + hop-4 type refs. Events stay canvas-absent.

## FINDING — **FC-DUMP-PROPOSE-STATE-PAINT-UNPINNED** (closed 2026-08-20)

Hop 4 pinned Default fills and strokes. Badge/Button State-preview
paints (`background-color-state-hover`, Button
`outline-color-state-focus-visible`) already recover and could remint
without failing `maintain` — the sparse matrix would still verify.
Those are the paints that keep Hover / Focus Visible from being
name-only. Pin the surviving refs. Events stay canvas-absent. Do not
add `State` to the authored contracts.

## FINDING — **FC-DUMP-PROPOSE-STROKE-UNPINNED** (closed 2026-08-20)

Hop 4 pinned layout + one fill per stem. Canvas stroke tokens
(`imported/button/root/border-top-color/…`, Card/Kbd
`imported/shared/color-e5e7eb`) already recover and could remint
without failing `maintain`. Alert / Badge / HelperText / Label /
ToggleSwitch have no stroke binds on `59mLQ`. Pin the surviving
stroke refs. Events stay canvas-absent.

## FINDING — **FC-DUMP-PROPOSE-PAINT-UNPINNED** (closed 2026-08-20)

Hop 4 pinned layout `bound` names but the fixture had no `fill`/`stroke`
maps, so canvas color tokens (`imported/button/root/background-color/…`,
`imported/alert/root/background-color/…`) could remint away without
failing `maintain`. Rebound paints from `59mLQ` and pin the surviving
refs. Events stay canvas-absent.

## FINDING — **FC-DUMP-PROPOSE-TOKENS-UNPINNED** (closed 2026-08-20)

Hop 4's bar is props + stamped tokens + host. The eight-stem pin
checked props/host only; the fixture had no `bound` maps, so propose
reminted `imported.<set-slug>.*` and maintain could not see a drop of
the canvas names (`imported/button/root/…`, `imported/shared/size-8`).
Rebound the fixture from `59mLQ` and pin the surviving refs. Events
stay canvas-absent. Do not write demo keys into authored contracts.

## FINDING — **FC-DUMP-PROPOSE-BUTTON-ONLY** (closed 2026-08-20)

Hop 4 was pinned on one pipeline-drawn Button dump. The other seven
Flowbite stems on `59mLQ` already proposed (Alert recovers
color/icon/dismissable/children and does not invent `onDismiss`;
ToggleSwitch recovers sizing/checked/label, host `button` +
`role=switch`, and does not invent `onToggle`). A refuse on those
stems would not have failed `maintain`. Fixture
`extract/figma/fixtures/flowbite-eight.dump.json`; pin now asserts
all eight. Events stay canvas-absent. Do not write demo keys into
authored contracts.

## FINDING — **FC-PROPOSE-SPARSE-STATE** (closed 2026-08-20; re-closed strictly 2026-08-22)

Hop 4 refused a pipeline-drawn Flowbite Button dump (`59mLQ` set
`120:2203`, 45-row State-preview matrix). Propose correctly promoted
`State` off the API (color / size / children recovered; host `button`;
no `onClick`), then exact projection demanded `State` on the returned
rows because the proposal had recovered only Disabled opacity — not
Hover / Active / Focus Visible paints. The CAUSE was a propose defect
(state paints / text / shadow / focus outline unpinned — closed the same
day as FC-DUMP-PROPOSE-STATE-PAINT-UNPINNED and siblings). The 08-20
close also relaxed the reader to reconstruct the set's DECLARED matrix
from the stamp alone, which made a proposal that recovered none of the
Hover cells report `verified-exact 45/45` while its re-emit drew 40 rows
(25 for a fully flat set). Re-closed 2026-08-22: the reader models the
rows the emitter WILL draw (`figmaStatePreviews` + `contract.states`);
a declared state the proposal did not recover is an `EXACT_ROWS_MISSING`
refusal naming those cells. The real fixture still reads 45/45. Pins:
`npm run flowbite-dump-propose:check` (eight stems) and
`exact-proposal-check.ts` (a Hover-flat sparse set is refused naming its
2 Hover cells). Do not add `State` to the authored Button contract.
Events stay canvas-absent.

## FINDING — **FC-DEMO-TOGGLESWITCH-SPEC-LAG** (closed 2026-08-20)

Demo file `59mLQlOMiD5w5za6SUcoO5` set `120:2047` stored specHash
`3674674594` against current engine `2132716802`. The other seven
Flowbite stems already matched. The compiled delta was root
`layout.align: center` (canvas `counterAxisAlignItems` was MIN) and
`semantics.role=switch` (canvas semantics was element-only). Amended
in place; six variants now CENTER. Pin: `flowbite-bundle-fresh:check`
requires the committed toggle script to carry `counter: CENTER` and
`role: switch`. Font score 6.19% is still `FC-FONT-SUBSTRATE`.

## FINDING — **FC-GENESIS-EMIT-STALE** (closed 2026-08-20)

The Disabled-opacity unbind landed in the emitter and the paste bundle,
but committed `examples/tailwind/figma/button.figma.js` still wrote
`node.opacity = spec.opacity` without `setBoundVariable('opacity', null)`.
A genesis paste would re-wash Disabled to 0.5%. Regenerated the button
script and `GENESIS-BATCH.figma.js`. The hop-2 freshness pin now also
requires the eight committed scripts to match a fresh emit.

## FINDING — **FC-BUNDLE-PASTE-STALE** (closed 2026-08-20)

The hop-2 paste artifact (`examples/tailwind/figma/tailwind.bundle.json`)
lagged the authored contracts. A fresh double-build was byte-identical
(109,841 bytes) and the committed file was not: Alert still named
`onDismiss` as a code prop, and ToggleSwitch was missing `events` /
`role=switch`. Those P0 functional closes lived only in source contracts
and `functional:flowbite` — not in the JSON a team pastes. Regenerated
the committed bundle. Pin: `npm run flowbite-bundle-fresh:check` (now in
`maintain`). Do not treat this as canvas amend; events never live on the
canvas.

## LIVE-FILE FINDING — **FC-APPLY-TOKENS-NOT-PRUNED** (named 2026-08-20; prune made opt-in 2026-08-22)

Named in `core/token-set.ts`: after the upsert, unreferenced leftovers in
the owned collection are LISTED by name in the apply result and the plugin
log; they are removed only when `DS_PRUNE_TOKENS = true` is set, and then
node-bound, style-bound (paint/text/effect/grid), foreign-alias-target and
other-collection variables stay. The 2026-08-20 version removed on every
apply and never read style bindings, so a designer's style-only or
library-consumed variable would have been deleted with no refusal
(docs/23 §B.23). Pin: `npm run token-set-prune:check` (both doors).
The measurement below is the receipt that named the hole.

The post-apply inventory of Y8Jhw6R49wTLuXZ0is2GmV did not match the bundle,
and the gap turned out to be exactly the held stems:

    bundle token leaves ....................... 331
    live `Tokens` collection .................. 444
    difference ................................ 113

    imported/text-input ....................... 107
    imported/spinner .......................... 6
                                                --- = 113

TextInput and Spinner were applied to this file BEFORE they were judged against
the ship bar and held. Holding them removed them from `ds-library.json`, the
genesis ORDER and the bundle — but **the apply is additive**: the tokens step
creates and updates, and never prunes. So their token subtrees are still in the
live collection with nothing pointing at them.

Verified dead rather than assumed dead:

    suspect variables ......................... 113
    referenced by any node on any page ........   0
    aliased by any surviving variable .........   0

So this is not a correctness bug in what shipped — every one of the 8 shipped
components binds only to variables the bundle wrote, and the file renders
correctly. It is a HYGIENE gap with a real consequence for a stranger: a file
that has seen an experiment carries that experiment's tokens forever, and the
variable picker shows 444 names for a 331-name library.

**Nothing was deleted.** Pruning 113 variables out of a live file the owner is
using is destructive and was not in scope; it is reported here with the exact
query that found them so the decision belongs to the owner.

## CLOSEOUT FINDING — **FC-COVERAGE-COUNTS-CAPTURES**

The closeout suite turned `capability-report-is-fresh` red, which is correct —
this round changed inputs that `docs/24-what-works.md` reads. The prescribed
fix is `npm run capability:report`. **It was run, its output was read, and it
was REVERTED**, because the rebuild does not tell the truth:

    | library | contracts committed | OF THOSE, pinned by the drift instrument | size | coverage |
    | Flowbite / Tailwind |  8  |  11  |  46  |  **23.9%**  |

Eleven "of those" eight. The column's own header says the second number is a
SUBSET of the first, and 11 > 8. The coverage percentage is then derived from
the second column, so the document would have published **23.9%** for a lane
whose honest, screenshot-verified figure is **17.4% (8/46)**.

Measured cause:

    extract/computed/out/tailwind/  ->  11 dirs
      alert badge blockquote button card helpertext kbd label
      spinner textinput toggleswitch
    examples/tailwind/contracts/*.contract.json  ->  8

The second column counts **capture output directories** (`scorecard.json`
walks), not committed contracts. `blockquote`, `spinner` and `textinput` are
HELD stems — captured with receipts, deliberately never promoted — and the
report counts each one as coverage.

This is invisible on every other library because captured == committed there.
This lane is the first to carry holds, so it is the first to expose it. The bug
is in the instrument, not in the lane: a stem that was measured and REFUSED is
being counted as a stem that shipped, which is the exact inversion this board
exists to prevent.

`docs/24-what-works.md` was therefore left at its committed state and
`capability-report-is-fresh` was left RED. That red was CAUSED BY THIS ROUND and
was NOT pre-existing — it was recorded rather than cleared, because the only
available way to clear it was to publish a number 6.5 points too high.

### CLOSED 2026-08-15 (housekeeping pass)

The instrument was fixed rather than the number. `scripts/build-capability-report.mjs`
now resolves each scorecard back to a COMMITTED contract before counting it:

    capture config (display name -> seed path) -> seed `id` -> committed contract `id`

The directory name could not do this — MUI captures TablePagination under the
display name "Pagination", so no filename or contract-name match reaches it, and
a naive basename join silently dropped 6 MUI, 3 astryx and 1 fluent component.
The id route resolves **all 8 libraries exactly**, and the only cards it excludes
are Flowbite's three HELD stems. A normalised contract-name match remains as a
fallback so a library with no capture config degrades to a weaker rule instead of
silently reading zero.

    Flowbite / Tailwind   8 committed | 8 measured AND committed | 46 | 17.4%

The report now also NAMES the excluded stems in §2 rather than merely omitting
them (`tailwind/Blockquote`, `tailwind/Spinner`, `tailwind/TextInput`), so a
reader sees that three measured components were deliberately not counted and
why. `docs/22-generality.md` §8.3 was reconciled to 8/8 in the same pass, which
returned all four cross-check disagreements to agreement (they were 0 at HEAD
and 4 after this round's contracts landed — every one of them ours).

Also closed here: the four `plugin-*` reds. The engine receipt was re-recorded
(`75b9d8e8196d…` -> `518bd5fbeea0…`, 705,091 -> 705,234 bytes), which is the
FC-ROOT-ICON-NOT-EMITTED emit revision landing in the bundle — not a surprise,
and it had been stale since `e7a851e1`.

## WHERE THE LOOP ACTUALLY STANDS

    shipped ......... 8  (button, badge, card, alert, toggleswitch,
                         helpertext, label, kbd)
                         +3 this round — HelperText, Label and Kbd, ALL
                         bar-passed on canvas by screenshot, not by scorecard
    held on the bar . TextInput (empty pills) · Spinner (dead colour axis)
    held, wall CLOSED . Blockquote — FC-FONT-SLANT-NOT-CARRIED is FIXED on
                     `feat/font-slant-carry`: `font-style` is a declared
                     channel, the canvas draws it as the italic FACE, and the
                     Blockquote gate goes 94.118% -> 100.000% computed-equal
                     (0/4 -> 4/4 rows) on the identical committed capture.
                     STILL HELD, for a different and smaller reason: the pixel
                     half is unmeasured (regate does not score pixels), so the
                     promotion needs a harness run. Not promoted here.
    refused ......... Progress (capture: first hover times out on an unstyled
                      <div role="progressbar"> wrapper — a NEW wall, not root-caused)
    parked .......... FC-ICON-ROOT-PAINT-AXIS · Option B height/width

The transport blocker is GONE — it was a port, not a limit, and the receipt
above says which one. What remains is three distinct named blockers, none of
them "the tool does not work": one upstream type bug class (declared enum is a
`Pick<>` subset of the themed keys), one emitter projection gap
(FC-ICON-ROOT-PAINT-AXIS, parked), and one capture-harness wrapper case
(Progress, not root-caused).

The stems that clear this bar have a shape, and it is now measured rather than
guessed: **content in DOM children + an axis that paints the root itself.**
HelperText produced that screen and Label CONFIRMED it — the screen picked
Label before any capture ran, and every stage came back clean in the order it
predicted. Two for two is not proof, but it is the first time this climb chose
a stem instead of discovering one.

The same screen also explains the holds without appeal to luck: TextInput fails
the first clause (content is an attribute), Spinner the second (the axis paints
an SVG stroke the root never carries).
