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
