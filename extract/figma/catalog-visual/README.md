# The cross-surface catalog gate — `npm run catalog:visual:check`

Every variant cell of every contract in `contracts/`, drawn by **both** of our
emitters in one browser, diffed against the other, and scored against a
committed table of numbers.

```
npm run catalog:visual:check                       # the gate
npx tsx extract/figma/catalog-visual/run.ts --contract ds.button
npx tsx extract/figma/catalog-visual/run.ts --write-baseline [--worst 6]
```

---

## 1. Why this is not "screenshot regression"

`docs/12-roadmap.md`, Phase 1, asks for a *"visual regression baseline —
screenshot-per-variant-grid comparison, so the class of defect found in the
July 2026 visual audit is caught mechanically"*. The referent is commit
`c6e909e`, *"three defects found by visual canvas audit"*. Read against those
three, the literal instrument **would have caught none of them** — and this
gate, measured by re-injecting each one, catches **one**:

| July 2026 defect | what a stored screenshot of our own output does | what THIS gate does, re-injected and measured |
| --- | --- | --- |
| `kbd` renders an empty key badge | blesses it and reports green forever | **CAUGHT**, by the invariant, not the pixels: `content-declared-but-empty`. Both surfaces agree to 0.00% on identical 36×12 boxes. |
| `avatar-group` clips its initials | blesses it — wrong on **both** surfaces from birth | **NOT CAUGHT.** Re-injecting it (revert to `c6e909e^`) goes red on a baseline DELTA only; no invariant fires. `text-overflows-root-*` does **not** detect it, despite an earlier version of this file labelling that invariant "the avatar-group class". |
| `chat-message` body column lacked `align: stretch` | blesses it | **NOT RE-INJECTABLE at HEAD** — `emit-figma-script.ts` now models CSS's flex `stretch` default. Its *class* is alive though: `ds.chat-message` carries a 1155-device-px cross-surface box divergence in the committed baseline. |

**One of three.** That is the honest score and it is worth stating plainly,
because two of the three were wrong on BOTH surfaces from their contract's
birth commit — `git log --follow` confirms each was present from birth and
removed only by `c6e909e`. A baseline written at any earlier commit records the
DEFECTIVE numbers, so every delta channel compares equal. **Only a
baseline-independent invariant can catch a both-surfaces-wrong defect**, and
this gate ships three of them. `kbd`'s class has one; `avatar-group`'s does
not, and inventing one would need a notion of "these initials should be legible
at this size" that nothing in the contract expresses. That gap is real and is
not closed here.

An earlier version of this table asserted the `kbd` defect was un-catchable and
credited `text-overflows-root-*` with the `avatar-group` class. Both were wrong,
and both were corrected by re-injecting the real defects rather than reasoning
about them.

So this directory builds the instrument that *would* have caught them, which is
two instruments:

1. **A cross-surface diff.** Side A is `core/emit-html.ts`; side B is the
   canvas renderer over `core/emit-figma-script.ts`'s compiled
   `ComponentData`. Neither is a reference — they are two emitters that have to
   agree, so a defect must be present in **both, identically**, to pass. That
   is what the July `chat-message` class was.
2. **An invariant pixels cannot express** (§5), which is what catches the
   both-surfaces-wrong class the diff is structurally blind to.

---

## 2. The denominator, measured

Not inherited. Counted by producing both surfaces for every cell of every
contract on disk:

```
contracts on disk: 51
BOTH SURFACES OK: 51/51 contracts
cells total: 195  (base 183 + state-preview 12)
state-preview cells by contract: {"ds.button":12}
REFUSALS (0):
```

The 12 state-preview cells are `ds.button` × 3 states × 4 variants. Cells come
from `canvas-gate/compile.ts` `deriveCells`, which re-runs the engine's own
enumeration and **throws** if its derivation disagrees with the compiled
variant names — the denominator cannot drift away from the engine without the
gate refusing. `baseline.json` records the denominator, and a run whose cell
count differs from the recorded one fails before any score is compared.

A contract state with no CSS-surface driver (`world.ts` `CSS_STATE_DRIVER`)
produces a **refusal row**, not a silent omission. There are none at HEAD.

---

## 3. The two surfaces, and the frame they share

|  | side A — CSS | side B — canvas |
| --- | --- | --- |
| producer | `emitHtml(contract)` with the cell's enum values written in as defaults (`withOverridesAsDefaults`, the trick vendored from `visual-parity/render.ts:98-109`) | `buildCanvasGateDoc` over `engine.compileComponentData` |
| states | driven: hover / focus-visible via `shots.ts`, `disabled` via the boolean prop | baked: the state-preview variant's own spec |
| tokens | `src/styles/tokens.css` | `src/styles/tokens.css` — the *same* file |
| capture | `shots.ts` `captureCell`, deviceScaleFactor 2 | same page, same context, same call |
| scoring | `canvas-gate/score.ts` `alignPair` + `scoreCell` | same |

The token layer is provably not the variable under test: the canvas renderer
spells the engine's figma var name `a/b/c` as `--a-b-c`, and the CSS emitter
binds the same custom properties, so one stylesheet resolves both sides.

Alignment and diff are `visual-parity/img.ts`'s policy, taken through
`canvas-gate/score.ts` — which is that policy already adapted for
**white-background** captures. `img.ts` `contentBox` trims on *alpha*, and
`shots.ts` deliberately keeps the white surface in the shot (translucent fills
sit below the alpha floor); using `img.ts` directly here would trim nothing and
silently reduce the diff to a comparison of clip rectangles. `img.ts`'s
`writeTriptych` **is** used, for the receipts.

Three frame decisions, each measured rather than assumed:

**The viewport is 1400×1200, not `newGatePage`'s 600×800.** `shots.ts`
`measureJs` clamps a cell's clip to the viewport; a component wider than the
viewport would be truncated, and truncated *differently* per surface whenever
the two disagree on width — manufacturing the divergence the gate is measuring.
`@media` appears in neither the emitted CSS nor the token stylesheet, so width
is otherwise inert.

**The CSS side does not get a `box-sizing: border-box` reset**, though
`canvas-doc.ts`'s `GATE_CSS` gives one to the canvas side. Border-box is a
Figma fact (a frame's size includes its padding). The emitted stylesheet is an
artifact we ship into other people's pages, where the UA default content-box
applies unless the contract says otherwise — and the schema has a real
`box-sizing` channel for saying so. Handing the CSS side border-box for free
would hide exactly the class of divergence the gate exists to find.

**The canvas renderer's preview affordances are neutralised** (`run.ts`
`CANVAS_AFFORDANCE_RESET`). `GATE_CSS` draws a dashed `◇ <name> slot` chip
wherever a slot has no `defaultContent`, and puts a 24×24 minimum on the slot
wrapper, so a human can see the slot on the playground canvas. `emit-html.ts`
states the opposite policy in its own header: *"an empty slot renders its
wrapper empty (absent content is absent)"*. Measured: **90 of 195 cells** carry
a chip. Leaving them in made 46% of the denominator a triage row about a dashed
rectangle and the mean masked score 8.30%; neutralising them compares the paint
both emitters actually derive from the contract and the mean is 2.76% (§7). Nothing
the compiled `NodeSpec` carries is touched — that all lives in inline `style`
attributes. `.cv-missing` (the red *contract not found* chip) is deliberately
**not** suppressed; an unresolvable dependency is a defect, not chrome. Zero
cells carry one at HEAD.

---

## 4. Scores, not images, are the gate

`baseline.json` reuses `visual-parity/baseline.json`'s proven shape, one row
per cell:

```json
"ds.button :: Variant=Primary, Size=Medium": {
  "status": "diffed", "masked": 4.37, "unmasked": 2.62,
  "sizeCss": "164x72", "sizeCanvas": "164x70",
  "causeClass": null, "invariant": []
}
```

`--write-baseline` is the only thing that moves it. **This is what makes the
reference regeneratable by a stranger's clone at any commit** — the single
property `visual-parity`'s live-Figma reference can never have. Only the
worst-N triptychs are committed as PNGs (`receipts/`, six of them), and a
receipt with no row behind it is deleted on the next write.

A run fails when any of these moves:

* **either operating point** drifts more than **ε = 0.1pp**, in **either
  direction** — an improvement is a change and has to be recorded, not absorbed.
  Both `masked` and `unmasked` are compared. Unlike `visual-parity`, where the
  other side is Figma's rasteriser and the unmasked point carries a font
  difference nobody can close, both sides here are DOM text in the same
  Chromium with the same family, so an unmasked-only move is real. Measured
  necessity: the falsification fixture in §6 leaves the masked point at 0.00%
  on all five cells and moves only the unmasked point and the box.
* the **painted box** changes (integer device px, reproduces exactly);
* the row's **status**, **causeClass** or **invariant verdict** changes;
* a row **vanishes** or a **new** row appears;
* the **denominator** differs from the recorded one;
* the denominator is **zero** → the run refuses with exit 2 rather than
  printing a green 0/0.

---

## 5. The invariant — what pixels cannot express

Lifted from `canvas-gate/README.md:82-86` (`inkCanvasPct` / `inkRealPct` /
`acceptance.noBlankCanvasCells`). A cell is flagged **by name** when:

| verdict | rule |
| --- | --- |
| `content-declared-but-empty` | the contract declares `content: { prop }` and every declared slot resolves to no text at all — **the kbd class**, contract-level, fires on both surfaces at once |
| `text-missing-css` / `-canvas` | a declared content prop renders on one surface and not the other |
| `both-surfaces-blank` | both sides under 0.5% ink |
| `one-surface-blank` | one side under 15% of the other's ink |
| `text-overflows-root-{css,canvas}` | rendered text escapes its own root's border box by more than 1 device px — a text-escapes-its-box invariant (NOT the avatar-group class — see §1) |

Ink is measured **within each side's own painted box**, not over the shared
union canvas. `canvas-gate` divides by the union because its two sides are the
same component at nearly the same size; here a legitimate size delta drags the
smaller side's union-relative ink toward zero. Measured: with the union
denominator, 61 cells were flagged blank and every one but `ds.blockquote` was
a size delta wearing a blankness label; with the own-box denominator, 12.

`text-missing` is a **cross-surface disagreement**, not "no text rendered".
Measured: `ds.pagination`'s `compactText` part carries a non-empty `pageLabel`
but is not shown in the `Dots` or `Pages` variants, so an absolute rule flagged
both surfaces for agreeing correctly. The kbd class is carried by the
contract-level rule above, which does not depend on what rendered.

**Known limit, stated rather than hidden**: a part hidden by its own variant
renders no text on both surfaces and is not flagged. That case is covered only
if the whole cell goes ink-blank.

---

## 6. Falsification — run, both directions, output quoted

### (a) A real cross-surface divergence → red, naming the cells

The fixture is planted in a **copy** of `contracts/` (`--contracts-dir`, the
discipline `scripts/child-wider.mjs:119-122` uses for its baseline); the
repository's own contracts are never touched, and `--write-baseline` refuses
`--contracts-dir` outright.

*Choosing it by measurement, not by expectation.* The first candidate was
`translate-x`, which `packages/schema/src/contract-schema.ts:673` declares
`{ canvas: 'draw', css: 'canvas-only' }`. Planted on `ds.badge`'s root it moved
**neither** surface (it folds into absolute placement, and the badge root is
not absolutely positioned) — the gate correctly stayed green, and the candidate
was discarded. The channel that does move exactly one surface is `max-height`,
which the schema annotates *"Figma has no maxHeight field"*: the CSS emitter
writes it, the canvas has nowhere to put it.

Control first — an **unmodified** copy of `contracts/`, full run:

```
✔ 195 cell(s) compared across BOTH emitters, every score within ±0.1pp of the
  committed baseline, every invariant verdict unchanged, denominator intact
  (51 contracts / 195 cells).
```

Then `"max-height": "{size.dot}"` added to `ds.badge`'s root tokens:

```
     0.00%m   1.25%u     122x24 vs 122x46    text-raster           ds.badge :: Variant=Danger
            ⚑ text-overflows-root-css: text escapes the root border box by 3.5px (root 61x8)
     …
✖ 20 cross-surface failure(s):
    INVARIANT ds.badge :: Variant=Danger: text-overflows-root-css: text escapes the root border box by 3.5px (root 61x8)
    …
    ds.badge :: Variant=Danger: unmasked 4.44% → 1.25% (Δ-3.19pp, ε 0.1) · 122x46 vs 122x46 → 122x24 vs 122x46 — an IMPROVEMENT is still a change: re-run with --write-baseline to lock it in
    ds.badge :: Variant=Danger: painted box moved — css 122x46 → 122x24, canvas 122x46 → 122x46 (device px)
    ds.badge :: Variant=Danger: invariant verdict changed
      was: []
      now: ["text-overflows-root-css: text escapes the root border box by 3.5px (root 61x8)"]
    ds.badge :: Variant=Error: unmasked 1.23% → 4.68% (Δ+3.45pp, ε 0.1) · …
```

Exactly the five affected cells, on three independent channels, and the canvas
box is unchanged in every row — the plant moved one surface. Note both signs of
Δ appear: the gate is red for the "improvement" direction too.

### (a2) The July `kbd` defect, replanted — the case the pixel diff cannot see

`keys` default set to `""` in the planted copy:

```
     0.00%m   0.00%u      36x12 vs 36x12     -                     ds.kbd :: Kbd
            ⚑ content-declared-but-empty: ds.kbd declares content for keysText←keys and this cell supplies no text for any of them
```

**Both surfaces agree perfectly** — 0.00% masked, 0.00% unmasked, identical
36×12 boxes. A blessed-screenshot baseline written in this state would report
green forever. The invariant names it. (Removing the default outright instead
of emptying it is refused earlier still: `emitHtml` rejects a required text
prop with no default, and the row goes `status diffed → refused`, which is also
a gate failure.)

### (b) Denominator forced to zero → refuses, never a green 0/0

```
$ npx tsx extract/figma/catalog-visual/run.ts --contracts-dir …/empty-contracts
CROSS-SURFACE CATALOG GATE — 0 contract(s), 0 cell(s) (0 base + 0 state-preview)

✖ REFUSED: the gate's denominator is ZERO (0 contract(s), 0 cell(s)).
  A cross-surface gate with nothing to compare cannot pass — it has measured nothing.
  Source: …/empty-contracts.
exit=2
```

### (c) The lane wiring

Replacing the gate step's command in `.github/workflows/catalog-visual.yml`
turns `npm run ci:lanes` red:

```
✖ 1 lane defect(s):
    `npm run catalog:visual:check` is gate-shaped but no workflow runs it and
    EXCLUDED gives no reason — wire it into a lane, or add it to EXCLUDED in
    .github/scripts/lane-coverage.ts with why
```

---

## 7. What the numbers are at HEAD, and what is triaged

195 cells, 0 refusals. The masked point exists for 164 cells; 31 crops are
fully covered by the text mask and quote their unmasked point instead (marked
`*` in the row list). Mean masked over the 164 is **2.76%** — the number the
summary line prints; **3.01%** over all 195 with the fully-masked cells' 
unmasked fallback folded in. Median **0.00%**, max **87.05%**. 144 cells at or
under 0.1%; 156 at or under 1%; 181 at or under 10%. 31 cells are exactly
0.00% on both operating points. 80 cells agree on the painted box to the
device pixel.

| causeClass | cells | what it absorbs |
| --- | --- | --- |
| `text-raster` | 89 | masked ≤ ε while unmasked is not: the residue is glyph rasterisation between two DOM text runs that do not share a box — precisely what the mask exists to price out |
| `size-delta` | 40 | the surfaces disagree on the painted box by >4 device px; the size receipt is the finding, the percentage is downstream of it |
| `empty-slot-geometry` | 20 | a slot with no `defaultContent`: both sides draw an empty wrapper, sized by different rules |
| *(none)* | 46 | no rule matched — the residue is unnamed and open |

Wall clock: **20.8s** for the full 195-cell sweep (`npm run ci:lane
catalog-visual`, node v20.19.4, macOS arm64).

**A gate whose baseline absorbs every difference measures nothing, so read this
honestly.** `causeClass` is a *label on a recorded score*, not a waiver: every
one of the 195 rows is pinned at ε 0.1pp in both directions plus its painted
box, triaged or not. What a class buys is a name, and a change of class is
itself a failure. `size-delta` in particular is not a dismissal — it is where
the largest open findings live.

### The 12 standing invariant verdicts

These are real, open, cross-surface defects. They are named in
`run.ts` `INVARIANT_TRIAGE` so the gate can be wired into a lane while they are
open; a 13th verdict, or any change to these twelve, fails immediately.

* **`ds.blockquote`** (1 cell) — the CSS surface paints **nothing** (0% ink of
  its own box). An empty `<blockquote>` collapses to zero height so its
  `border-left` has no run to draw; the canvas frame keeps the contract's inset
  padding and draws the rule.
* **`ds.inline`, `ds.stack`** (6 cells) — the CSS emitter writes the **contract
  name** as the root's text for a root with no parts and no content prop
  (`<div class="inline">Inline</div>`); the canvas draws the empty auto-layout
  frame the contract describes.
* **`ds.status-dot`** (5 cells) — **text escaping its own box, alive at HEAD** (a RELATED shape to the July avatar-group defect, not the same one — the invariant does NOT fire on avatar-group; see §1):
  the CSS surface renders the literal string `StatusDot` inside an 8×8 pill and
  the glyphs escape the root border box by 31.14 device px; the canvas draws
  the dot and no text. A pixel diff alone prices this at 26% and files it under
  "size delta"; the invariant names it.

### The largest open finding: `max-width` becomes a FIXED width on canvas

**21 of the 51 contracts declare `max-width` on their root.** The schema says
so plainly — `max-width` is *"a root/text part bakes it as a fixed width"*
(`contract-schema.ts:645`) — and the canvas emitter does exactly that:
`ds.toast`'s `max-width: {size.card.width}` compiles to
`width: var(--size-card-width, 320px)`. The CSS emitter keeps it a ceiling, so
a hugging component collapses to its content. **38 of the 49 cells belonging to
those contracts have a canvas box wider than the CSS box by more than 4 device
px**, up to **+1164 px** (`ds.toolbar`, 116×56 vs 1280×56).

This is also the sharpest argument for comparing the painted box directly:
most of those 38 rows score **0.00% masked**, because once the two crops are
centre-padded onto the union canvas and the text regions are masked out, what
remains on both sides is white. The percentage is silent; the box is not.

### The other open score findings

* **`ds.toast`** (2 cells, 87.05% masked) — the `max-width` class above, with
  a saturated fill that survives masking.
* **`ds.button` focus-visible** (4 cells, 28.7–33.3%) — the two surfaces
  disagree on focus-ring geometry (CSS 180×88 vs canvas 172×78); see
  `receipts/ds-button--Variant-Primary-Size-Medium-State-Focus-Visible.png`.
* **`ds.pagination :: Variant=Pages`** (26.4%), **`ds.divider :: Variant=Strong`**
  (11.3%), **`ds.slider`** (9.9%, unclassified).

---

## 8. Re-baselining

Run `--write-baseline` **after reviewing the diff**, and say in the commit
message what moved and why. The baseline records `headCommit`, so a stale
reference is visible in the run header. `--write-baseline` refuses both
`--contract` (a partial write would delete every other row) and
`--contracts-dir` (a baseline over a planted corpus describes a tree that does
not exist).
