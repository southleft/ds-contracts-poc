# Recipe fidelity v1 — does the mint look like the real library?

Written 2026-08-31. Gate: `npx tsx recipe/fidelity-score.ts`.

The recipe path had no answer to this question. Every existing gate measures
**accounting** (is each fact carried, named or receipted) or **usability** (is
each cell inside its box, correctly roled, non-overlapping). A mint can pass all
of them and still not look like the library it claims to describe — which is
exactly the doubt the owner raised after eyeballing three libraries' checkboxes
and finding them near-identical.

This scores a Figma export against the **real library's own Chromium render**
(`extract/computed/out/<lib>/<component>/orig-shots/`), reusing the canvas-gate
scorer that already backs the console-loop lane. Bar: `pctAAMasked ≤ 5%`.

## Result — the loop closed

| subject | v3 mint | v4 mint (after fix) |
| --- | --- | --- |
| `checkbox/astryx` | 0.00% PASS | **0.00% PASS** |
| `checkbox/antd` | 0.00% PASS | **0.00% PASS** |
| `checkbox/mui` | 49.31% FAIL (24×24 vs 18×18) | **0.00% PASS (18×18 vs 18×18)** |

The gate found a defect no other instrument could see, the fix was made, the
archetype was reminted (page `199:78556`), and the gate now passes at 0.00% on
all three. MUI's ink coverage matches the real render exactly: 39.5% / 39.5%.

Fixing it also surfaced a **latent break**: the checkbox archetype could not
mint at all. `check.path` carried MUI's shipped compact spelling
(`M19 3H5c-1.11…`) and Figma's `vectorPaths` parser refuses it —
`Invalid command at H5c-1.11`. The live v3 page predates that path and still
carried an older hand-flattened square, so nothing had caught it. See
`recipe/figma-vector-path.ts` for the probed grammar and the lowering.

## First results — checkbox, unchecked/enabled (v3 mint, before the fix)

| subject | canvas | real | AA masked | verdict |
| --- | --- | --- | --- | --- |
| `checkbox/astryx` | 22×22 | 22×22 | **0.00%** | **PASS** |
| `checkbox/antd` | 16×16 | 16×16 | **0.00%** | **PASS** |
| `checkbox/mui` | 24×24 | 18×18 | **49.31%** | **FAIL** |

Two of three minted checkboxes are **pixel-identical** to the real package
render, verified down to raw pixel values (differences of 1–3/255, pure
anti-aliasing). The owner's "they all look the same" impression came from a
low-zoom page screenshot where three correctly-different controls
(24px, 42px wrapper, 16px) sit beside labels in the same fallback font.

## The MUI defect, and why only a pixel gate could find it

The MUI row is a real defect, and the interesting part is that **every other
instrument says it is fine**:

```
wrapper.size   fixture=42  captured=42  match
box.size       fixture=24  captured=24  match
```

The fixture says 24, and the capture *agrees* — because 24 is the size of MUI's
`MuiSvgIcon-root`, the icon **container**. MUI does not paint that container. It
paints an 18×18 rounded rect **inside** it, as an SVG path with its own padding.

So the mint draws the icon's bounding box where MUI draws the icon's path. The
reader cannot see this: it compares a declared number to a computed number and
both are 24. Only rasterising both sides catches it.

That is the class of defect this gate exists for, and it is the answer to "why
did accounting-green mints still look wrong".

## Switch — three more subjects, two more real defects

| subject | canvas | real | AA masked | verdict |
| --- | --- | --- | --- | --- |
| `switch/astryx` | 40×24 | 40×24 | **0.00%** | **PASS** |
| `switch/antd` | 44×22 | 44×24 | 6.82% | FAIL |
| `switch/mui` | 17×14 ink | 38×19 ink | 35.04% | FAIL |

**`switch/antd` is not a defect, and I recorded it as one before re-measuring.**
The trim counts anything below 250/255 as ink. Chromium's render carries two
rows of AA fringe at 241–248 that Figma's export does not produce, so the
reference measures 44×24 and the canvas 44×22. At a threshold of 240 or stricter
**both are 44×22 exactly**. The 6.82% is the misalignment those 2px cause in the
union pad, not a difference in the design.

| threshold | reference | canvas |
| --- | --- | --- |
| 250 (scorer default) | 44×24 | 44×22 |
| 245 | 44×23 | 44×22 |
| **240** | **44×22** | **44×22** |
| 230 | 44×22 | 44×22 |

Worth stating plainly: a trim threshold is a tuning choice, and this one
manufactured a defect out of two renderers' anti-aliasing.

**`switch/mui`** is the more serious one, and it is visible at a glance. MUI's
unchecked switch is a **white circular thumb sitting on a grey track**. The mint
renders a single grey blob: the thumb is not white and does not read as separate
from the track. Ink extent gives it away — 17×14 painted against the real 38×19.

Neither is fixed here. They are named, measured, and reproducible.

## Two instrument limits found while measuring

- **`cropLeadingControl` assumes the control is visually contiguous.** It is,
  for a checkbox and for the Astryx/AntD switches. MUI's unchecked switch has
  internal whitespace between thumb and track, so the 6px gap rule splits it and
  measures the thumb alone. `--canvas-box x,y,w,h` takes explicit bounds from the
  scene instead; tuning the heuristic per subject would have been fitting the
  instrument to the answer.
- **pngjs cannot decode one particular Figma export.** The 58×38
  `switch/hit` PNG is structurally valid (identical chunk layout to exports that
  read fine, IEND terminated, no trailing bytes) and pngjs still refuses it with
  "unrecognised content at end of stream". Worked around by exporting the parent
  variant instead. Named, not silently skipped.

## What these numbers do NOT mean

- **One state of one component.** A pass here is not a pass for the archetype.
  Nothing here flips `overallSuccess`, and no grade is invented.
- **Ink coverage is quoted beside every score** because a near-blank canvas
  scores a deceptively low diff. Read `inkCanvasPct` / `inkRealPct`.
- **The reference is one MOUNT.** Astryx renders differently under
  `@astryxdesign/core` alone than under `<Theme theme={neutralTheme}>`. These
  Astryx scores use the **core-only** capture
  (`extract/computed/out/astryx-core/`, config `astryx-core.json`), because that
  is the surface `recipe/fixtures/library-*.ts` actually transcribes. Scoring
  against the themed capture would fail on the theme, not on the mint.
- **Labels are cropped out** by `cropLeadingControl`. Figma and Chromium
  rasterize text with different hinting; scoring "Accept terms" measures two
  renderers, not two designs. Scored whole, the Astryx checkbox reads 16.08% —
  and the diff image is almost entirely label glyph edges. The console-loop lane
  already used control-only crops; this makes that convention explicit.

## Reproduce

```bash
npx tsx recipe/fidelity-score.ts \
  --canvas    recipe/evidence/fidelity-v1/shots/checkbox-astryx-glyph.png \
  --reference extract/computed/out/astryx-core/checkboxinput/orig-shots/unchecked.md.no-isDisabled__default.png \
  --reference-control-only \
  --label     checkbox/astryx \
  --out       recipe/evidence/fidelity-v1/checkbox-astryx.json
```

Canvas shots are read-only exports of signed Scratch page `198:77718`
(`checkbox/hit` frames `198:77942`, `198:77822`, `198:78063`). Zero Figma writes.

## 2026-09-01 — every existing reference scored

The manifest went from 8 subjects to 24. Two additions to the instrument:

- `component` resolver — the boilerplate v1 stays are single components inside
  wrap frames, not sets (`scripts/capture-fidelity-shots.mjs`).
- `widthNormalised` — fill-width controls (textarea) are scored as two equal
  edge windows after an ink trim, so corners, border, radius and every vertical
  metric count and the container-owned interior width does not
  (`recipe/fidelity-score.ts` `scoreEdgeWindows`). The three textareas the
  previous manifest excluded by prose are now measured rows.

Result: **10 pass · 1 fringe · 13 fail.** The 13 are named in
`KNOWN-FAILURES.json`, a shrink-only ratchet the gate reads: a failing subject
not named there is red, a named subject that passes is red (stale), and no row
changes a score. Classes: 7 real-defect, 4 content-mismatch, 2 font-substrate.
The headline real defect is the alert archetype: all three libraries ship the
status glyph as an SVG asset in the capture output and the mint paints a
filled disc. See `scripts/fidelity-contact-sheet.ts` for the side-by-side.

Still excluded, with the reason in the manifest: dialog/menu (the only
references are full-viewport overlay captures) and the four signed legs whose
pages carry two identically named sets (name resolution cannot pick a leg).

## 2026-09-01 (later) — the alert glyphs, closed by remint

The headline real defect above is fixed at the source. `alert@1` now carries
each library's status glyph as a vector read from the capture's own SVG asset
(`recipe/fixtures/capture-glyph.ts`), lowered through
`recipe/figma-vector-path.ts` — which gained arc lowering with a reported
bound and SVG-style closing of open filled subpaths — and placed in a centred
host that refuses an off-centre source. Two more defects surfaced on the way
and were fixed in the same remint: AntD's height omitted its 1px border
(38 → 40, border-box), and the Astryx title provenance recorded SF Pro Medium
because Semibold was not installed when v1 minted (the writer's tamper check
caught it). Title text now comes from each capture's sample, and the Astryx
reference is captured title-only to match the recipe's declared scope, with
`description` a named refusal.

    subject        v1 (disc)   v3 (glyph)
    alert/astryx   64.6% FAIL   7.57% known (font-substrate)
    alert/mui       6.98% FAIL   3.95% PASS
    alert/antd     15.86% FAIL   3.35% PASS

Two attempts before v3 were refused by the writer's own guards (the glyph
bounds guard at 0.15px on the Astryx warning icon; the font tamper check)
and their partial pages and collections were removed before the next attempt.
The gate is now **12 pass · 1 fringe · 11 known**.

## 2026-09-01 (night) — one runtime, and the product-path program scores the same

Every boilerplate archetype is now minted by `recipe/figma-writer-runtime.ts`,
one IR → canvas program with a `scratch` target (developer pins) and a
`plugin` target (no file pin, no page list — what the shipped plugin's
Paste-a-script verb executes). All thirteen were reminted through it and
re-scored: **16 pass · 1 fringe · 7 known, subject by subject identical.**
The runtime's bounds guard refused the first checkbox remint — the old copy
had scaled the Astryx check's 9.8×7 ink to fill its 14×14 viewport, invisible
in the scored unchecked variant — and checkbox@1 now carries the glyph
ink-sized in a viewport host, still at 0.00%.

The plugin-target program was then run in Scratch through the same execution
shape the plugin uses (`scripts/run-figma-writer.mjs --plugin-target`,
page `212:81964`) and scored **0.00% / 0.00% / 0.00%** on checkbox against
the same references (`shots/checkbox-*-shared-v5-plugin.png`). What is not
exercised here is the plugin's UI itself: a person pasting `writer.plugin.js`
into the development plugin in Figma desktop. Every current evidence
directory now carries that file beside `writer.js`.

## 2026-09-01 (late) — a library the recipe path was pointed at, not taught

`recipe/fixture-reader/propose-fixture.ts` writes a fixture module from a
capture ledger through a role-based archetype schema
(`schema-checkbox.ts`). Pointed at Chakra UI's checkbox — never transcribed
by anyone — it read 42 leaves from the ledger, took 3 reviewed values (the
indeterminate stroke lowered to a rounded rect, with the arithmetic) and 10
archetype spellings, and invented nothing; the drift gate reads the
proposal back with zero drift. Minted as the fourth source of checkbox v6
(page `212:82228`) and scored against the real package:

    unchecked      0.00%   checked        0.00%
    indeterminate  3.75%   unchecked.disabled 0.00%   checked.disabled 0.00%

The human inputs were a seven-line role map and the glyph's points cited
from `checkmark.js`. Per-state canvas shots and scorecards are in
`f1-chakra-checkbox/`. This is F1 for one archetype, measured; docs/26's F1
clause still needs the owner's grade and every archetype.

## 2026-09-01 (late) — the switch schema found a shadow the hand table missed

`recipe/fixture-reader/schema-switch.ts` + `rederive.ts` re-derive each
hand-written switch fixture from its own ledger through drafted roles. MUI:
21 agree · 0 differ (the 8 refusals are the label a bare mount has none of).
AntD: 24 agree · 1 differ — the schema read the knob's `::before` box-shadow,
`0 2px 4px 0 rgba(0,35,11,.2)` (antd `handleShadow`), where the fixture
said `none`. That shadow is exactly the 44×24-vs-44×22 band the manifest
had excused as anti-aliasing fringe. The excuse is retired, the shadow is
carried, and switch v5 (page `214:82669`) scores **0.00% at 44×24**.

    18 pass · 0 fringe · 7 known

## 2026-09-02 — the bare cell: shadcn, no label, oklch, and a gap named

checkbox@1 and switch@1 now have a **label-less cell** (`content.label:
null` compiles no label node; the label tokens are the recipe's inert
spellings; a mix of labelled and bare variants refuses). The reader treats a
missing label as evidence, not a refusal, so shadcn's bare
`<button role=checkbox>` could be **proposed** from its capture: 28 leaves
read, 6 reviewed, 0 invented. Its colours are `oklch()`; `ledger.ts hex8`
converts by CSS Color 4 and the conversion is pinned to the render's pixels
(`oklch(0.205 0 0)` → 23, `oklch(0.922 0 0)` → 229). Minted as the fifth
source of checkbox v7 (page `217:82808`):

    unchecked      0.00%   unchecked.disabled 0.00%   checked.disabled 3.13%
    checked        5.15% FAIL (by 0.15: the glyph's 1.17px stroke rasterised
                   softer by Chromium than by Figma — not a missing fact)
    indeterminate  NOT EXPRESSIBLE — shadcn draws the check glyph there; the
                   dash is a zero-size reviewed receipt. The scorer says 2.94%
                   and 3.13%; those are the AA mask excusing a whole 1.17px
                   stroke (ink 22 vs 39), and are not reported as passes.

Per-state shots, scorecards and the instrument note are in
`f1-shadcn-checkbox/`. checkbox@1 then gained a `boxShadow` leaf (shadcn's
`shadow-xs`; every other capture reads `none`), which exposed two Figma
defaults the runtime had been inheriting — effects showing behind their
node and frames clipping by default — neither of which CSS has. Both are
runtime rules now — a shadow shows behind its node only when the node is
opaque; a frame clips when the IR says so or when it carries a drop shadow,
since Figma renders a frame's own shadow like Chromium only when it clips
(measured on the MUI thumb, see `f1-shadcn-checkbox/README.md`) — and all
thirteen archetypes were reminted through them (checkbox v11 `218:86637`)
with every score unchanged.

    19 pass · 0 fringe · 7 known

## 2026-09-02 — the one command covers a second archetype: switch

`recipe/fixture-reader/propose-switch.ts` + `point.ts --archetype switch`.
Pointed at shadcn's bare Switch it proposed a fixture with **no `--set` at
all** (25 read, 0 invented) after the reader learned three general CSS
facts — a pill radius Chromium reports as `3.35544e+07px`, a
`calc(100% - 2px)` translate of the thumb's own width, and a transparent
border as a 1px thumb inset (v9 missed the inset: checked 6.74%; v10 reads
it: every state under the bar). Pointed at MUI's own capture it proposed the
bare-mount fixture that scores exactly what the hand table scores. Both are
minted as the fourth and fifth sources of switch v10 (page `218:88332`) and
verified by the drift reader (mui-proposed 21 match, shadcn 25 match, 0
drift). A proposal now also names its refusals from the capture itself —
every interaction the harness captured that the archetype has no plane for.

    switch/shadcn        0.00%   (checked 4.44 · unchecked.disabled 0.00 · checked.disabled 2.96)
    switch/mui-proposed  4.57%   = switch/mui, the same capture read by a person

    21 pass · 0 fringe · 7 known

## 2026-09-02 (later) — the held-out capture: Chakra Switch, captured today, 0.00% ×4

Chakra's Switch had never been captured. A person wrote the seed contract
and the config entry (the composition from the package's own exports), the
harness captured 16 combos with real screenshots, and `recipe:point`
proposed the fixture with **no `--set`** (33 read, 0 invented). The first
mint scored 9.35%: the thumb is a 20px box drawn at CSS `scale: 0.8`. The
schema now lowers a scaled thumb — size × scale, inset from the scaled
margin, shadow lengths × scale — and every state of switch v12 (page
`218:88804`) is **pixel-identical**. Also read on the way: CSS Color 4
`color(srgb …)` in shadow layers. See `f1-chakra-switch/README.md`.

    switch/chakra  0.00%   (checked 0.00 · unchecked.disabled 0.00 · checked.disabled 0.00)

    22 pass · 0 fringe · 7 known

## 2026-09-02 (later) — a third archetype: avatar, five captures, one held out at 0.38%

`propose-avatar.ts` + `point.ts --archetype avatar`. Five captures pointed
at, each 13 leaves read and 0 invented. MUI and AntD from their own captures
score **0.00%** beside hand rows of 4% and 2.73% — the hand tables pin
initials and a font the capture does not render. Altitude, never hand-tabled,
scores **0.38%**. shadcn and Fluent, re-captured with `--keep-originals`
and proposed with a reviewed, named font fallback each, score **0.29%** and
**0.00%** (Fluent's reference was rendered on this same Segoe-UI-less
machine, so both sides show a fallback face). The writer's font-provenance check now compares style
names without case ("SemiBold" ≡ "Semibold"), a runtime rule all thirteen
archetypes were reminted through with scores unchanged. See
`f1-avatar-proposed/README.md`.

    avatar/mui-proposed 0.00% · avatar/antd-proposed 0.00% · avatar/altitude 0.38%
    avatar/shadcn 0.29% · avatar/fluent 0.00%

    27 pass · 0 fringe · 7 known

## 2026-09-02 (later) — a fourth archetype: tooltip

`propose-tooltip.ts` + `point.ts --archetype tooltip`. A proposal now names
what a floating component's capture always holds and the archetype does not
carry — the placement wrapper, the arrow, a box-shadow — as refusals read
from the ledger. AntD from its own capture scores **3.01%**, the hand row's
number. shadcn's tooltip, re-captured with real screenshots after the
portal re-capture's second sweep was fixed (`window.__ALL_PROPS` lost on
reload), scores **4.73%**. MUI's tooltip proposes but cannot be re-captured:
its closed popper's transform is unstable across the determinism sweeps,
which the harness correctly refuses. See `f1-tooltip-proposed/README.md`.

    tooltip/antd-proposed 3.01% · tooltip/shadcn 4.73%

    29 pass · 0 fringe · 7 known

## 2026-09-02 (later) — fifth and sixth archetypes: chip and link

`propose-chip.ts` and `propose-link.ts`, shape-twins of avatar and tooltip.
Six captures pointed at (Altitude chip and link held out; Carbon's Tag held
out via `--capture tag`; MUI's and AntD's own captures beside their hand
rows). Altitude's chip scores **0.07%**; the MUI and AntD proposals score
exactly their hand rows. Three rows fail on text rasterisation alone and
are **named** in the ratchet as font-substrate — Carbon's "Tag" glyphs
(8.56%), Altitude's underlined "Link" (5.56%), and MUI's serif link
(20.22%, where the hand row's Roboto pin scores 49%). See
`f1-chip-link-proposed/README.md`.

    chip/altitude 0.07% · chip/mui-proposed 0.61% · chip/antd-proposed 1.89%
    chip/carbon 8.56% (named) · link/altitude 5.56% (named) · link/mui-proposed 20.22% (named)

    32 pass · 0 fringe · 10 known

## 2026-09-02 (later) — a seventh archetype: tabs

`propose-tabs.ts` + `point.ts --archetype tabs`. The indicator is read as a
part (MUI) or as the selected tab's bottom border (Carbon); a fixed tab
height is read as its minimum height. MUI from its own capture scores the
hand row's 7.73% to the hundredth (named font-substrate). Carbon, held out,
scores 9.57% and is named as a content mismatch: three tabs and a panel in
the capture, two tabs in the archetype. shadcn refuses by name — a filled
selected tab is not an indicator. See `f1-tabs-proposed/README.md`.

    tabs/mui-proposed 7.73% (named) · tabs/carbon 9.57% (named)

    32 pass · 0 fringe · 12 known

## 2026-09-02 (later) — three more held-outs captured today: Chakra avatar, tag and link

The person's step again (three seed contracts and three config entries in
`extract/computed/configs/chakra.json`), then three captures and three
`recipe:point` runs, every one 13–14 leaves read and 0 invented. Chakra's
Avatar scores **0.38%** held out. Chakra's Tag (read as chip@1 via
`--capture tag`) draws its 1px ring as a zero-offset zero-blur INSET
box-shadow; the chip schema now lowers that as an inside border whose
spread comes out of the padding (a shadow takes no layout space, the
recipe's border does) — the ring paints and the geometry agrees to the
half-pixel; the 8.09% that remains is the "Tag" glyphs, named
font-substrate like Carbon's and Astryx's. Chakra's Link proposes (14 read,
0 invented) but has no real render: the legacy contract path quarantined
the capture on an unregistered `text-underline-offset` channel before its
screenshots were kept, so it is a proposal without a score, said so.

    avatar/chakra 0.38% · chip/chakra 8.09% (named) · link/chakra proposed, unscored

    33 pass · 0 fringe · 13 known

### 2026-09-02 — the fourth Chakra held-out: a tooltip through the portal

Chakra's Tooltip, captured the same day from a config entry a person wrote.
The in-stage form refused by name as multi-root (the Positioner has to sit
in a `Portal`); the portal capture kept one real screenshot and the command
proposed 14 leaves, invented none, and refused placement, arrow and open
delay from the capture. Minted as tooltip v9's seventh source. Inter Medium
12px resolved *exact* in Figma and the box is still two columns narrower
than Chromium's (216 vs 218) — advance widths, not a misread; padding,
fill, radius and height agree. Named `font-substrate`, the ratchet's 14th
row. See `f1-tooltip-proposed/`.

    tooltip/chakra 8.83% (named)

    33 pass · 0 fringe · 14 known

### 2026-09-02 — the quarantined link gets its render

Chakra's Link was a proposal with nothing to score: the legacy contract path
quarantines the capture on `text-underline-offset` (not a token channel),
and the quarantine path deleted the real-package screenshots with the
scratch dir. `extract/computed/run.ts` now keeps `--keep-originals` on the
quarantine path too — the pixels are a measurement, not the contract's to
refuse — and the refusal record says how many it kept. No remint: link v8
already carried the Chakra source. Inter Regular 16px resolved exact; the
glyph masks agree in width and differ by one row in height (Chromium 13,
Figma 12), the same class as MUI's proposed link. Named `font-substrate`.

    link/chakra 10.26% (named)

    33 pass · 0 fringe · 15 known

### 2026-09-02 — radio@1 gets a proposer; two pixel-identical rows

The eighth archetype with a proposer. AntD from its own capture (the ring's
`::after` disc read at 16 × 0.375 = 6, its 16px radius clamped to 3 as CSS
clamps it) scores its hand row's 0.00%. Chakra's RadioGroup, captured the
same day from a config entry a person wrote — the package's `ItemIndicator`
is the control-with-dot; a first entry with the bare `ItemControl` captured
a solid disc and the real render agreed — reads the `.dot` span at 18 ×
`scale: 0.4` = 7.2 and is pixel-identical held out. Minted as radio v9 with
five sources. See `f1-radio-proposed/`.

    radio/antd-proposed 0.00% · radio/chakra 0.00%

    35 pass · 0 fringe · 15 known

### 2026-09-02 — textarea@1 gets a proposer and a bare cell

The ninth archetype with a proposer, and the first whose honesty needed a
recipe change: textarea@1 now has a bare (label-less) cell for the lone
`<textarea>` most libraries ship. MUI's proposal reads the floating notched
label from the label's transform and scores exactly its hand row (9.52%,
the named real-defect). AntD's proposal is the bare cell and scores 1.25%
where the hand row is a named 7.42% content mismatch. Chakra's Textarea,
re-captured today with real screenshots (the legacy contract path
quarantines it; the quarantine path keeps the originals), is held out at
1.64%. Minted as textarea v9 with six sources. See `f1-textarea-proposed/`.

    textarea/mui-proposed 9.52% (named, = hand) · textarea/antd-proposed 1.25% · textarea/chakra 1.64%

    37 pass · 0 fringe · 16 known

### 2026-09-02 — alert@1 gets a proposer; the glyphs are read, the viewBox reviewed

The tenth archetype with a proposer. The four status glyphs are the
capture's own path data (computed `d` + `fill-rule`); the package's
viewBox, which no computed channel carries, is the one reviewed leaf with a
citation. MUI from its own capture scores 3.99% (hand 3.95%), AntD 3.35%
(= hand; the drafter took the icon-bearing cell over the showIcon=false
base by asking which svg's paint changes across statuses), and Chakra's
Alert — captured the same day from a config entry a person wrote — is held
out at 3.03%. Minted as alert v9 with six sources. See `f1-alert-proposed/`.

    alert/mui-proposed 3.99% · alert/antd-proposed 3.35% · alert/chakra 3.03%

    40 pass · 0 fringe · 16 known

### 2026-09-02 — a label line-height leaf, and a labelled held-out through the child

Chakra's Field + Label + Textarea was captured with a new axis-value form,
`$childProps`, that mounts the content value on the Textarea child (the
capture harness had reached the root only). Its first score, 5.9%, was two
rows short at the label: textarea@1's label text had no line-height leaf.
It has one now (`labelLineHeightUnit` / `labelLineHeight`, scaled with a
shrunk floating label), read from the captures (Astryx 20, MUI 23, Chakra
20) — and it closed Astryx's named row (6.16% → 3.20%), scored the labelled
Chakra field at 2.02%, and brought MUI from 9.52% to 8.28% (still named:
the resize grip and a 2px offset). textarea v11, seven sources.

    textarea/astryx 3.20% (closed) · textarea/chakra-field 2.02% · textarea/mui 8.28% (named)

    42 pass · 0 fringe · 15 known

### 2026-09-02 — badge@1 gets a proposer (no held-out exists for it)

The eleventh archetype with a proposer. The pip's offset is read as its
transform minus the anchor inset (MUI's 14% circular overlap → 4.406, the
number the hand table had reviewed), AntD's white ring from its outset
box-shadow as a border with the stroke outside, and the host's radius as it
renders. MUI's proposal takes the library's default cell (a transparent
pip) and scores 3.11%; AntD's scores its hand row's 1.98%. No foreign
anchored badge exists in the corpus to hold out. badge v11, four sources.
See `f1-badge-proposed/`.

    badge/mui-proposed 3.11% · badge/antd-proposed 1.98%

    44 pass · 0 fringe · 15 known

### 2026-09-02 — dialog and menu are scored for the first time

Their only references are full-viewport overlay screenshots with a
backdrop. The portal capture now records every part's rendered rect beside
its screenshot (`orig-shots/<key>.rects.json`) and the manifest crops the
reference to the paper (`referenceCrop: "cls:MuiDialog-paper"`), a box the
capture measured. Both first scores are named content mismatches, not
geometry: the hand tables carry a title line and two menu items where the
capture renders one body line and three items. Neither archetype has a
proposer yet; one would read the content from the capture as the other
eleven do. The rows stay in the gate so the miss is measured, not excused.

    dialog/mui 6.73% (named) · menu/mui 5.46% (named)

    44 pass · 0 fringe · 17 known

### 2026-09-02 — menu@1 gets a proposer

The twelfth archetype with a proposer. MUI's config now mounts two items,
the archetype's shape; the proposal reads the panel inset as paper plus
list padding (8, where the hand table spelled 0) and scores 4.73%, passing
where the hand row is a named 6.79% content mismatch. Chakra's Menu,
captured the same day through a Portal composition, is held out at 5.64%:
a named real defect — menu@1 has no panel minimum-width leaf (Chakra's
content is 8rem wide) and refuses the panel shadow by name. Minted as menu
v7 with five sources. See `f1-menu-proposed/`.

    menu/mui-proposed 4.73% · menu/chakra 5.64% (named) · menu/mui 6.79% (named)

### 2026-09-02 (late) — the hand AntD textarea becomes the bare cell; its row closes

textarea/antd had been named since the gate first saw it: the hand table
paired a "Notes" label with a package (`Input.TextArea`) that renders no
label, and the mint stacked one above the box (75px against 54). textarea@1
gained a bare cell for the proposed AntD and Chakra rows earlier today, so
the hand table now spells the same cell (every label leaf the bare
spelling, `bareLabelFont`, `content.label` null) and cites the correction.
Minted as textarea v12 (235:95777): textarea/antd 1.25% — identical to the
proposed row — and the ratchet shrinks. **49 pass · 0 fringe · 16 known.**
The two MUI textarea rows remain (resize grip, a 2px floating-label offset).

### 2026-09-02 (late) — the paste verb, proven per row

`recipe/plugin-target-proof.ts` emits every proposed row's plugin-target
program (no pin, no page list — what Paste-a-script executes) from the
current generated module, runs it in Scratch the way the plugin does,
exports the same cell and scores it against the same reference as the gate
row. 39 rows · 39 same · 0 drift — every score identical to the hundredth.
`recipe:fidelity:plugin:check` re-scores the committed `-plugin` shots
offline and is a fast-lane step. See `plugin-target/README.md`.

### 2026-09-02 (later) — menu@1 reads the panel's minimum width; the Chakra residual is named as font

menu@1 gained a `panel.minWidth` leaf (Chakra reads 128px, MUI's Popover
paper 16px; AntD cites none; Astryx's `anchor-size(width)` is receipted).
Minted as menu v8 (229:94381): the Chakra panel exports 128×76 like the
render and the glyph ink sits at the same pixels. The score stays 5.64%
because the residual is Inter rasterisation (measured with the refused
shadow ring simulated, boxes aligned, diff glyph-shaped at 6.67%); the row
is reclassified font-substrate. Tally unchanged: 49 pass · 0 fringe · 16 known.

    45 pass · 0 fringe · 18 known

### 2026-09-02 — dialog@1 gets a proposer: every archetype has one

The thirteenth and last. MUI's config now composes DialogTitle +
DialogContent, the archetype's shape; the proposal reads the paper's
asymmetric inset as sums along the edges the recipe draws and scores 4.92%,
and the hand row, against the same reference, passes at 4.81% — its named
content mismatch closes. Chakra's Dialog, captured the same day through a
Portal composition (the backdrop left out: two portaled roots refuse by
name), is held out at 2.57%. On the way: the shared runtime's font-style
matcher had lost its whitespace escape inside the emitted template, so
Figma's "Semi Bold" never matched a CSS "Semibold" — fixed at the source.
Minted as dialog v7 with five sources. See `f1-dialog-proposed/`.

    dialog/mui-proposed 4.92% · dialog/chakra 2.57% · dialog/mui 4.81% (closed)

    49 pass · 0 fringe · 16 known
