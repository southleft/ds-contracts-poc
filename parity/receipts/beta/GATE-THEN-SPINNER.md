# GATE HONESTY, THEN SPINNER

Branch `feat/font-slant-carry`. Two phases: make the suite stop lying, then
open the parked kit wall. Every number below was measured on this branch.

| row | verdict |
|---|---|
| G1 `mui-figma-genesis` | **RECOVERED** — the pin was right, the emit was wrong |
| G2 `child-wider-ratchet-and-script-freshness` | **RECOVERED** — both moves named, no real number loosened |
| K1 `FC-ICON-ROOT-PAINT-AXIS` | **NAMED**, and the receipt's stated cause is **FALSIFIED** |

---

## G1 · mui-figma-genesis — RECOVERED

`switch-track(medium) pin: expected 34x14, found 1x1`, red since before this
session. Measured before touching anything: identical failure at HEAD.

**The pin was right and the emit was wrong** — the opposite of the cheap read.
`switch-track` is a childless FRAME whose contract declares 34×14 (bound to
`imported/switch/switch-track/{width,height}/medium`). Tracing its resize
history showed the node reaching **34×14 correctly**, then being resized to
`34×1` and then `1×1` by `remeasureBirthBox`.

That repair exists to dissolve Figma's 100×100 birth box: it forces a HUG axis
to `FIXED`, resizes it to 1, and sets it back to HUG so the canvas re-measures.
That is right for a node whose size comes from its content, and destructive for
one the CONTRACT sized — a childless frame has nothing to re-measure against,
so the axis hugs to 1 and stays there.

A previous round already suspected this exact pin and guarded on
`spec.layout &&` — but `switch-track` *has* a declared layout, so the guard
never covered it. The guard is now the fact that actually matters: **a declared
size is not a birth box.** Per axis, `fixedWidth`/`fixedHeight` skips the
re-measure. `RUNTIME_EMIT_REV` bumped to `rt14-declared-size-is-not-a-birth-box`
so amend cannot skip the new runtime as unchanged.

Downstream, `examples/mui/figma/mui.bundle.json` was stale and regenerated.
The lane's shape is untouched: **31/31 scripts, 273 variants**, token sync 2136
variables, one-paste batch mock-proven.

## G2 · child-wider-ratchet-and-script-freshness — RECOVERED

Three failures, **all pre-existing** (identical with this branch's changes
stashed), and the ratchet is two-sided so both directions had to be explained
before re-recording:

- **fluent overflows 18 → 2 (tightened).** The defect was not fixed — it stopped
  *manifesting*. 16 of the 18 were one class: Checkbox's `indicator > icon` is
  an `element:"svg"` with no asset, so the mock handed it the 100px birth box
  inside a 16px indicator, +84 per variant. `c27e3fe0` (**2026-08-10**, after
  the **2026-08-09** baseline) stopped the mock modelling a birth box on plain
  FRAMEs. The missing glyph is unchanged and still named; only the instrument
  stopped inflating it.
- **tailwind textCaused 0 → 10 (exempt class).** New stems, not a regression:
  the baseline recorded FIVE scripts and the kit climb landed HelperText, Label
  and Kbd in `8afae937` (**2026-08-15**), so the row now measures EIGHT.
  Attribution **measured per script**, not inferred: helper-text 5 + label 5 =
  10, kbd 0, and all five original stems 0.

**No real-overflow number was loosened.** Diffed old vs new baseline: fluent
tightened 18→2, every other `overflows` unchanged, tailwind's stayed a hard
zero. The only increase is the separately-counted exempt class, which the
instrument never folds into the overflow number.

---

## K1 · FC-ICON-ROOT-PAINT-AXIS — NAMED, and the old cause is falsified

`KIT-CLIMB.md` says:

> An icon-rooted component cannot express a per-variant paint axis through the
> current icon projection: one asset, one `svgPaintVar`.

**That is not true.** Binding the paint to a substituted family and emitting
gives **eight distinct paint variables, one per colour**, with **no emitter
change at all**:

```
imported/spinner/root/color/default   <- Color=Default, Size=Lg
imported/spinner/root/color/info      <- Color=Info, Size=Lg
imported/spinner/root/color/failure   <- Color=Failure, Size=Lg
…8 total
```

Proven twice — through `color` and through the captured `fill` channel (`fill`
is a first-class token channel: `canvas: 'draw'`, "baked into the promoted
glyph markup"). `partToSpecInner` resolves an icon part's tokens with `subst`,
so the `{color}` substitution reaches the glyph paint like any other channel.

### The real wall is one layer down, in PROMOTION

The promoted contract binds a single flat token:

```
tokens: { "color": "{imported.spinner.root.color}" }   // = #000000
tokensByProp: [ { prop: "size", map: { …width only… } } ]
parts: []
```

Measured against the same capture that produced it:

- **`icon.fill` is AXIS-VARYING — 7 distinct values** across the colour axis
  (`info` oklch(0.609 0.126 221.723), `failure` rgba(224,36,36,1), …).
- **`icon.color` has no delta at all.** It is the inherited text colour, which
  is *not* what paints a Flowbite spinner (the arc is painted by `fill-*`
  utilities).

So promotion minted the **inert** channel as one black token and dropped the
**varying** one — and left no trace: `icon.fill` appears in **no fold entry, no
`codeOnlyChannels`, and no token**. An axis-varying channel with 7 captured
values left the promotion boundary with **no receipt**, which is the silent-drop
class this project keeps finding, this time on the write side of promotion.

`width` proves per-axis minting works on this very contract — it produced a
correct per-size map in the same run.

**Not closed here, deliberately.** The brief's rule is to name a second wall
rather than drill under it, and this is a different component from the one the
receipt blamed. Carrying the spinner's `fill` means changing how promotion
treats a channel in `INHERITED_CHANNELS` (`fuse.ts`), whose comment records a
real regression from getting it wrong before ("Button's primary label went
dark") — a corpus-wide promoter change that needs every library re-promoted to
validate.

**Spinner stays OFF the ship set.** `examples/tailwind/ds-library.json` remains
the 8 shipped stems; genesis ORDER, `docs/BETA.md` coverage and the golden path
are untouched. On canvas the colours are still identical, so the ship bar is
not met and nothing here claims it is. The 32×12 box was not touched — that is
Option B height and remains excluded.

---

## The suite receipt — 225/225

`evals/results.json` is a real full run, not a hand-edited pair of rows:

```
223/225  before this wave (the two named reds, red since before this session)
222/225  first full run — G1+G2 green, three NEW reds this branch caused
224/225  after fixing all three
225/225  after rebuilding docs/24 (it hashes results.json, which had moved)
```

**`docs:check` is GREEN** — "every gated doc number and link agrees with the
repo" — for the first time in this session. Its N/N guard fires while any eval
is red, so closing G1 and G2 is what released it. Four doc lines that quoted
"223 of 225" and named the two reds were reconciled to 225/225; that prose
carries no slash, so no regex would have caught it going stale.

## Reds this branch caused, and closed

The first full suite ran as the receipt and found three, all mine, all from
earlier waves' changes landing together. Each is named because each was a real
defect, not noise:

1. **`golden-generated-output`** — 59 `figma-sync/*.js` diverged. `figma:fresh`
   covers `examples/*/figma`; the FIRST-PARTY scripts are covered by
   `evals/golden.json` instead, and I had regenerated only the former. Ran
   `npm run figma:plan` + `npm run golden:update` (291 files).
2. **`native-slots-carriage`** — *"the red test could not strip
   remeasureBirthBox — the pin below is vacuous"*. The red test stripped the
   call by matching its exact argument text, so G1's added parameter silently
   stopped it matching. The eval refusing to claim a vacuous pass is the gate
   working. The strip is now argument-agnostic — it matches the CALL, not its
   arguments.
3. **`design-dialog-global-part-dedup`** — from **D2**, not this goal. Allowing
   hyphens in `partKey` over-reached: a part key also becomes a slot/property
   name, and on a FOREIGN set the drawn names are arbitrary layer labels
   ("swap-slot-item-1", a lorem-ipsum sentence) that must be sanitised — which
   the CBDS Dialog send pins exactly. The allowance is now gated on the set
   carrying this pipeline's own stamps (the fixture has none), so our sets keep
   `part-0` / `alert-icon` and a foreign set is sanitised exactly as before.

---

## Named, pre-existing, NOT caused here

- **`dagger:census`** — 73 across 9 corpora, unchanged through every commit and
  **not re-recorded**; its baseline predates the 8-stem kit.
- **`npm run typecheck`** — `console-loop-alpha-composite-probe.mts:34`.
- **`docs:check`** — its N/N guard fires on `evals/results.json`. G1+G2 remove
  the two long-standing reds that kept it firing.
