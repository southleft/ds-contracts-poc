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

## LIVE-FILE FINDING — **FC-APPLY-TOKENS-NOT-PRUNED**

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
    held: NEW WALL . Blockquote — FC-FONT-SLANT-NOT-CARRIED. Captured clean,
                     gate pixel AA 0/4, because `font-style: italic` never
                     reaches the contract. Systemic: 0 contracts in the repo
                     carry that channel. THIS STOPPED THE LOOP.
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
