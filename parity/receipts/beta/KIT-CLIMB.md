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
