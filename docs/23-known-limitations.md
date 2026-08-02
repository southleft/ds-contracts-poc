# 23 — Known Limitations

*Written for someone deciding whether to adopt this. It is the complete
inventory of what this tool does **not** do.*

Every other document here argues for the thing. This one is the other half of
the same evidence standard: a release that claims a clean sheet is inviting you
to find the twelfth problem yourself, on your own canvas, in front of your own
design team. Everything below is sourced from a measurement or a file in this
repository, and each item cites where.

**How to read an entry.** Each one states *what it is*, *what you would
observe* (the symptom you'd actually hit), and *status* — whether there is a
named plan, a tracked task, or nothing. "Named" in this repo means the tool
prints the limitation by name rather than degrading silently; it does **not**
mean the limitation is fixed.

**The single most important number is in [§1](#1-coverage--how-much-of-a-library-is-actually-captured).**
Fidelity per captured component is high; coverage per library is not. Both are
true, and the second is the one usually left out.

Companion reading: [docs/22 §8 — the honest ledger](22-generality.md) (the
evidence behind the generality claim, and where it leaks) ·
[conformance/EXPECTATIONS.md](../conformance/EXPECTATIONS.md) (the measured
CSS/DOM frontier) · [docs/18 — User Flows](18-user-flows.md) (the ranked gap
list with a verified status column) · [docs/16 — The Sync Boundary](16-sync-boundary.md)
(what is out of scope by decision rather than by unfinished work).

---

## 1. Coverage — how much of a library is actually captured

### 1.1 The engine generalizes. A library does not capture in one pass.

Seven distinct libraries across eight rounds, five styling architectures, one
pipeline, with engine-change cost per library trending toward zero
([docs/22 §1–§5](22-generality.md)). That claim is about the *engine* and the
evidence supports it.

It is not a claim that your library can be captured. Here is the measured
fraction, from [docs/22 §8.3](22-generality.md#83-the-coverage-fraction--how-much-of-each-library-is-actually-captured):

| library | contracts committed | pinned by the drift instrument | library size | **coverage** |
|---|---|---|---|---|
| Carbon (`@carbon/react@1.112.0`) | 10 | 10 | 243 | **4.1%** |
| Astryx (`@astryxdesign/core@0.1.6`) | 13 | **5** | 222 | **5.9%** |
| Polaris (`@shopify/polaris@13.9.5`) | 12 | 12 | 180 | **6.7%** |
| MUI (`@mui/material@9.2.0`) | 14 | 14 | 135 | **10.4%** |
| Flowbite / Tailwind (`flowbite-react@0.12.17`) | 5 | 5 | 46 | **10.9%** |
| Altitude (`altitude-web-components@1.0.2`) | 8 | 8 | 67 | **11.9%** |
| **total** | **62** | **54** | **893** | **6.9%** |

**What you'd observe** — you run a round on your library and finish with a
dozen components under contract, not a hundred. Nobody has taken a library past
11.9%, so nobody has met the long tail: the twenty-fourth component of a real
system.

**Status** — [docs/22 §8.3](22-generality.md) names the next honest step and it
is not a seventh library: *one library taken to 50%*. Not started.

**Note on the denominators.** They lean against us on purpose. MUI's 135 counts
every capitalised directory including utilities (`NoSsr`, `ClickAwayListener`);
Carbon's 243, Polaris's 180 and Astryx's 222 are whatever this repo's own
extractor could see, helpers included. The true component denominators are
smaller and the true percentages a little higher. The order of magnitude is the
finding.

### 1.2 Whole component classes are captured nowhere

Data grid, tree, virtualized list, date picker, rich text and charts appear in
**zero** committed contracts across all six foreign libraries
([docs/22 §8.3](22-generality.md)).

The nearest thing in the corpus is MUI's `Table`, captured as an organism at a
**deliberately bounded scope** with every cut greppable in
`examples/mui/PROVENANCE.md`: `stickyHeader` excluded by name (`position: sticky`
has no carried spelling), the row overflow menu captured **closed**,
`TableSortLabel` carrying `direction="asc"` only, the active sort arrow's 180°
rotation not carried, two body rows rather than three, `TablePagination`'s
rows-per-page Select pinned controlled-closed and its paging arrows
force-disabled (so the *enabled* arrow colours are unobservable and absent from
the captured truth). Carbon's own `DataTable` is listed as deferred — "the
organism, a round of its own".

This repo's own 51 contracts do include a `table` / `table-row` / `table-cell`
family ([docs/09](09-advanced-components.md)) — but those are hand-authored
here, not captured from a foreign library, and they are not evidence that a
foreign data grid can be captured.

**What you'd observe** — if the component you most want on the canvas is your
data grid, this tool has never done it.

**Status** — no plan. Named as the untested long tail.

### 1.3 The captured slice is not random, and that biases every average upward

Components were chosen because they were tractable. The 54 drift rows are
Button, Badge, Chip, Card, Checkbox, Tag, Avatar, Divider and their siblings.
**Read every floor percentage in this repository as "on the easy 6.9%."**
([docs/22 §8.3](22-generality.md).)

### 1.4 At depth, the pipeline can fail *and say it succeeded*

`examples/polaris/ADVANCED-PROBE.md` ran four advanced Polaris components
through the floor. Its own bottom line:

> "On the current pipeline, none of these four advanced components produces a
> contract a designer would accept — and two (Modal, Popover) produce a
> *misleading* one (an aborted sweep, or a button's styles labeled as a
> Popover)."

| component | verdict |
|---|---|
| `Modal` | **does not mount** — the capture throws, so the floor sweep aborts and can never enumerate its combos; anatomy carried: zero token bindings |
| `Popover` | **mounts the wrong element (silent false-success)** — the floor captures the *activator's* computed styles, believes it succeeded, and mints a "Popover contract" that actually describes a button |
| `ResourceList` / `ResourceItem` | **mounts empty** — the recipe grammar cannot supply items, so the floor can only ever see the empty state |
| `IndexTable` | **mounts a loading/measuring skeleton**, never the settled table (the captured text still reads `"Loading orders…Loading orders…Select all orders…"`); the public export carries no API — 0 props |

The Popover row is the one worth reading twice: **nothing errors.** That is the
most dangerous outcome in the document, and it is named there rather than
discovered by you.

**Status** — seven failure classes ranked N1–N7 with fix difficulty in
`examples/polaris/ADVANCED-PROBE.md` (N1 portal/overlay *hard*, N2
structure-creating props *hard*, N5 component-family fragmentation *hard*).
None started.

#### What now catches the Popover row — and what still does not

Two checks were added because "nothing errors" is not something to ship:

1. **Mount sanity — a hard stop, at run level.** Two different components
   cannot render the same DOM with the same styles. When two do, one of them
   mounted the other: the run prints `mount-collision`, names both components,
   and exits non-zero. Nothing is published.
   (`extract/computed/mount-sanity.ts`, eval `mount-sanity`.)

2. **The trigger advisory — a warning, at the review gate.** A queued
   component whose own prop surface declares `open` / `active` / `activator`
   and whose config drives none of them is flagged before the browser starts,
   where `onboard` already stops for a human.

**The gap that remains, stated plainly.** The collision only fires when the
thing mounted *instead* is **also a configured component**. Capture a Popover
whose activator is a plain `<button>` that no config entry names, and neither
check fires. The advisory is the net under that case, and an advisory is not a
guarantee — **look at the review screenshot for anything with a closed state.**

The obvious check — "does the captured root carry a class the component's own
name predicts?" — was measured against the committed corpus and **rejected**: it
refuses real components (Carbon's `Button` stems to `btn`, Tailwind's
`classAllow` is `^$` so all five have no stems, seven of Altitude's eight are
shadow hosts with no `:host` rules, and eight of Polaris's twelve carry only
generic stems like `icon` / `label` / `box`). A check that refuses two-thirds of
a shipped library to catch one absent component is a check people learn to skip.

---

## 2. Fidelity — what a captured component reproduces, and what it does not

### 2.1 Overlays and portals lose their source token *names*, in every library

`portalSweep()` takes no `varPrefix`; `run.ts` calls it with `{ screenshots,
classAllow }` and nothing else. The consequence, verified from committed
artifacts ([docs/22 §8.1](22-generality.md)):

| component | facts in `source-bindings.json` |
|---|---|
| `mui/dialog`, `mui/menu`, `mui/tooltip`, `carbon/modal` | **0** each |
| `mui/button` | 156 |
| `carbon/button` | 126 |

**What you'd observe** — your Dialog lands on the canvas with correct colours
that are **anonymous literal values**, not bound to `--your-color-surface`.
Correct pixels, no token names. Every other captured component in the same
library binds its names normally.

**Status** — tracked as **task #23**. Not fixed, because threading `varPrefix`
changes MUI's Dialog / Menu / Tooltip captured truth and their promoted
contracts — an MUI re-capture round. Named first in
`examples/carbon/PROVENANCE.md` as "THE HEADLINE DEFECT", re-confirmed unfixed
in `examples/altitude/PROVENANCE.md`.

### 2.2 Overlay components have no state planes at all

`portalSweep` mounts and unmounts per combo, so hover / focus-visible / active
planes for Dialog, Menu and Tooltip **do not exist in the captured truth**.
Fusion skips them by name and those contracts declare `states: []` — pinned by
the contract, not by luck ([docs/22 §8.2](22-generality.md)).

**What you'd observe** — an overlay component set on canvas with a Default
variant and no interactive states, where a sibling Button has four.

**Status** — named as a future round. Not started.

### 2.3 Text wrapping is not implemented — a corpus-wide gap

A hugging text node inside a narrower fixed-width ancestor **clips**. MUI's
`AccordionDetails` body copy measures 426px inside a 288px ancestor.

The Carbon live-defect round measured a *second* mechanism in the same class: a
shrink-to-fit box is measured in the harness's fallback font and baked as a
FIXED width, then drawn in Inter. Carbon's `tabs__nav-item-label-wrapper`
carries `width: 62.3125px` — which is the word "Overview" in a font the canvas
does not have. Complete Carbon inventory (8 instances, all in Accordion, plus
Checkbox/Modal/Tabs/TextInput label widths) in `examples/carbon/PROVENANCE.md` §D4.

**What you'd observe** — long labels truncated or overflowing on canvas;
button and tab widths that are subtly wrong in a way that tracks word length.

**Status** — "fixing this changes every hugging text node in the corpus," so it
is its own round, deliberately not attempted mid-round twice now. Named, not
started.

### 2.4 Two-axis geometry and paint products have no spelling

A decor whose offset is a function of **size AND state** cannot be expressed.
`stylesWhen` conditions are single-prop; `literals` and `shape` are scalars.

Concretely: Flowbite's toggle knob x-offset is a function of `Sizing × Checked`
(2, 18 / 2, 22 / 2, 28). Carbon's Toggle pins `size: md` for the same reason,
rather than minting a product nothing can render.

**What you'd observe** — **a checked toggle draws its track and no knob.**
`examples/tailwind/PROVENANCE.md`: "On canvas the toggle still draws its track
only."

The same hole exists for paint: the disabled-plane paint of a decor is an
enum × state product with no spelling, refused by name
(`pseudo-decor-state-paint-uncarried`, with the measured values printed per
combo).

**Status** — the named path forward is synthesizing the pseudo-element into the
sweep as a real aligned part, exactly as MUI Switch's thumb offset now is. Named
as "the next round"; not started. Refused with its own message
(`pseudo-decor-geometry-multiaxis`) rather than silently dropped.

### 2.5 Pseudo-elements: some refused, two never read at all

Measured by the conformance fixture
([conformance/EXPECTATIONS.md](../conformance/EXPECTATIONS.md)):

| construct | disposition |
|---|---|
| `::before { content: "\2715"; font-family: icons }` — an **icon-font glyph** | **refused, by name** |
| `::after` painted **only** by a linear-gradient | refused, by name |
| `li::marker`, `input::placeholder` | refused, by name |
| **`::selection`** | **never read** |
| **`dialog::backdrop`** | **never read** |

"Refused by name" and "never read" are different facts and the fixture counts
them separately on purpose. A refusal appears in a receipt you can grep; a
channel that is never read produces no artifact at all.

**What you'd observe** — a close "×" drawn with an icon font simply is not on
the canvas, and a `<dialog>`'s scrim colour is not carried.

Carbon's checkbox **checkmark** is refused for a related reason: it is a rotated
two-border L, outside the decor grammar (`pseudo-decor-outside-grammar`).

**Status** — each is a named, closed-vocabulary refusal. No plan to open them.

### 2.6 Shadow DOM: open roots only, and one blind signature

Open shadow roots are tier-1 supported (Altitude, library #8). **Closed shadow
roots are unreachable from script by definition** (`el.shadowRoot === null`), so
nothing about a closed host's interior is captured or carried.

The reader names the two signatures of that absence it can see — a custom-element
leaf that paints a box; a non-replaced `display:inline` leaf with a non-zero
content box — and **names as UNDETECTABLE the third**: a closed root on a plain
element blockified by a flex/grid parent, which no computed style distinguishes
from an empty item (`extract/computed/run.ts`, `closed-shadow-root-limit`).

The decisive probe (calling `attachShadow` and catching `NotSupportedError`)
mutates the page on its negative path and would break the double-run
byte-identity self-check. It is **refused, not forgotten**.

Also: **depth-2 shadow nesting is exercised; depth-3 is not**
([docs/16](16-sync-boundary.md)). Altitude's `al-alert` family was dropped from
the round for exactly that reason.

**What you'd observe** — a component with a closed shadow root produces an empty
part, and in one of three DOM arrangements you get no warning that it happened.

### 2.7 The shorthand ceiling — a reader gap, measured

The CSS-variables source reader carries **longhand facts only**. A `var()`
reference inside a shorthand (`font`, `background`, `border-radius`, `padding`,
`gap`, `transition`, `border`, `outline`) is not read.

Measured per library — the number of `var()`-carrying shorthand declarations
dropped:

| library | shorthand references dropped |
|---|---|
| Altitude | **16** (heading 6, badge 4, chip 3, link 3) |
| Tailwind / Flowbite | **16** (alert 4, badge 4, card 4, button 3, toggle-switch 1) |
| Carbon | **14** (accordion 5, inline-notification 5, button 1, icon-button 1, tabs 1, tag 1) |
| MUI | **2** (button 1, accordion 1) |
| Polaris | **21** (banner 6, avatar 3, button 2, badge 2, checkbox 2, progress-bar 2, tag 1, radio-button 1, spinner 1, thumbnail 1) — measured by the task-#26 recapture (§3.2) |
| Astryx | **not measured** — no `varPrefix` declared, so the reader never runs and no `source-bindings.json` is written at all. *Not measured is not the same as zero.* |

Altitude's round-1 stylesheets carried 95 `var()`-bearing shorthand declarations
against 136 longhand ones (`font` ×36, `background` ×19, `border-radius` ×14…),
which is why Button shows 15 facts over 3 channels while its CSS names eight
tokens.

**What you'd observe** — fewer bound token names than your stylesheet obviously
contains, with no error.

**Status** — named, not fixed, "and the reason is byte-safety." A second,
smaller defect in the same place *was* closed: the skip used to be **silent**
(`"skips": []` read as "nothing was lost" while 95 references were dropped);
the instrument now counts it.

### 2.8 No webfonts are loaded in any harness

The capture harness is network-free. Carbon's `styles.css` carries 105
`@font-face` blocks whose every `src` is an Akamai CDN URL; Altitude's published
dist contains zero `@font-face` blocks at all. IBM Plex is not loaded and the
metrics come from the fallback stack.

(`document.fonts.check` returns `true` for fonts that are certainly not
installed — it reports "can this be rendered", which fallback always satisfies.
It proves nothing.)

**What you'd observe** — **pixel anti-aliasing scores are 0 essentially
everywhere** in the receipts, and absolute text widths in the contracts are
fallback-font widths. Both sides of the fidelity gate degrade identically, so
the *percentages* are unaffected; the *absolute widths* are not (see §2.3).

### 2.9 The fidelity gate samples mid-transition

`extract/computed/gate.ts:380` waits a flat **30 ms** after driving an
interaction, while the capture sweep polls to two consecutive stable samples for
up to 1.5 s. Carbon's buttons transition at **70 ms**, so **58 of Button's 448**
gate rows read an intermediate frame.

The consequence is measurable: four consecutive runs of the offline instrument
produced **77.528 / 77.552 / 77.567 / 77.577** against a 0.001 global tolerance.
`carbon/Button` is the only baseline row carrying its own tolerance (widened to
0.20 with the measurement written next to it, never re-pinned silently). Every
engine-sized move that baseline has recorded (+1.042, +2.459, +20.155, −3.296)
is an order of magnitude larger, so a real regression still fails the row.

Altitude transitions everything at 200 ms, which is why its worst two rows are
Link (63.889%) and Button (74.766%) and nothing else explains them.

**What you'd observe** — an interactive-state fidelity number that wobbles in
the third decimal place between identical runs on a library with slow
transitions.

**Status** — "fixing `gate.ts` moves the number for every library and every
committed scorecard — its own round." Named in three PROVENANCE files. Not
started.

### 2.10 Channels with no canvas spelling at all

Refused by name and unlikely to change:

- **A genuine 2-D grid** (>1 column AND >1 row) — `grid-two-dimensional`. CSS
  Grid *does* lower to the flex vocabulary from measured track counts when it is
  effectively 1-D.
- **`position: fixed`, `position: sticky`** — refused.
- **`transform`, and the independent `rotate` property** — refused. This is why
  MUI's active sort arrow draws in its authored orientation instead of rotated
  180°.
- **`filter`, `backdrop-filter`, `clip-path`, `mask-image`, `mix-blend-mode`** —
  refused.
- **`writing-mode`, `direction: rtl`** — refused. There is no RTL story.
- **`content-visibility`, `-webkit-line-clamp`, `accent-color`** — refused.
- **`flex-basis` is not a carried channel anywhere in the pipeline** — absent
  from `CHANNEL_TO_COMPUTED`. Observable: Carbon's Modal footer buttons measure
  128 and 112 on canvas where Carbon's captured truth is 377 and 377 (an
  equal-width flush-right pair). Named precisely in
  `examples/carbon/PROVENANCE.md`; not fixed.
- **A run of ≥2 adjacent inline children** in a block container — one anonymous
  line box, no flat-frame spelling; keeps the row default.

### 2.11 Two constructs the engine carries that it should not

The conformance fixture's three open reds are all **UNDECLARED-CARRY**, and two
of them are the harmful kind — the engine carried something with no canvas
spelling:

- **`@container` queries** — the rule matches at the pinned viewport and its
  value is carried as if unconditional. A size-conditional rendering is a MODE,
  not a single canvas variant. Container queries are how 2026-era libraries do
  responsive components.
- **A non-matching `@media` branch** — a capture at one viewport measures one
  branch and cannot know the others exist; the matching branch's value is
  carried with no indication that a whole alternative rendering is missing.
- **`stage-box-equal`** — a captured box exactly equal to the harness stage box
  (100% × 100%) is carried as a component fact. This is the general form of the
  100vh-scrim defect: a measurement artefact promoted into a contract.

**What you'd observe** — a responsive component's desktop values baked into a
canvas variant with no note that a mobile branch exists.

**Status** — recorded in `conformance/BASELINE.json` so they cannot drift in
either direction. Open, named defects; fixing them means changing the engine,
not the manifest.

### 2.12 Named residuals that produce visible canvas differences

Collected from the PROVENANCE files, because a designer will spot these:

- **MUI's Accordion has no expand chevron** — `expandIcon` takes a React
  element, the marker grammar resolves package *exports* only, and the pinned
  sandbox has no `@mui/icons-material`. A hand-drawn chevron would be a
  fabricated canvas fact, so there is none.
- **Polaris RadioButton's selected dot** (`::before` decor) — not carried.
- **Polaris ProgressBar's runtime-% indicator width** — a zero-width track is
  the visible result.
- **MUI Menu's paper width is a Roboto measurement** (115px) drawn in Inter.
- **MUI's five Dialog `maxWidth` variants render identically** — correctly so;
  the ceiling is a bound variable nothing currently exercises.
- **Astryx's ProgressBar `fill`** renders 100px inside a 48px `track` in all
  five variant cells — a percent width baked as a px literal. These are the only
  5 real child-wider-than-parent overflows in the whole corpus.
- **Value-derived styling is inexpressible** — Polaris Avatar hashes the
  name/initials into one of seven palette classes. No contract channel can be a
  function of a text prop's *value*.
- **Breakpoint-conditional styling** (`@media (--p-breakpoints-*)`) — no
  contract channel; verification renders sub-breakpoint.

---

## 3. Per-library status — which examples are fresh, and which are frozen

Not every example in this repository is equally alive — but as of 2026-07-29,
**all six are fresh**. Polaris, frozen since library #2's original round, was
the last: its recapture ran (§3.2).

| library | status | what that means |
|---|---|---|
| **Carbon** | **fresh** | all 10 recaptured; floors byte-identical |
| **MUI** | **fresh** | all 14 recaptured; one floor moved |
| **Tailwind / Flowbite** | **fresh** | all 5 recaptured; scorecards byte-identical |
| **Altitude** | **fresh** | all 8 recaptured; all scorecards byte-identical |
| **Astryx** | **fresh** | all 5 recaptured, 4 promoted; re-anchoring re-reviewed — §3.1 |
| **Polaris** | **fresh** | all 12 recaptured 2026-07-29 with the CSS-vars reader ON — §3.2 |

### 3.1 Astryx: CLOSED — the capture, the promote and the re-anchoring are all live again

Astryx was the one library that could not complete a capture→promote round. Both
causes are fixed, the recapture is landed, and the re-anchoring review was re-run
against it.

**1. The capture read its own promote output.**
`extract/computed/configs/astryx.json` pointed all five components at
`examples/astryx/contracts/` — the directory `promote` *writes* — where every
other library points at a frozen seed. The damage was already shipped: the
`FLOOR-PROMOTED` and `COMPUTED-ENRICHED` provenance sentences appear **twice** in
button/badge/slider, **once** in card, and **zero** times in switch, which had
never promoted at all. Five components in three states. Seeds now live in
`examples/astryx/contracts-seed/`, derived from the last *curated* contracts —
**not** from the raw static extraction, which carries HTML passthrough props
(`type`, `name`, `form`, `href`) and would have made `type` a third variant axis,
compiling Button at 36 variants instead of 12. The rule is now enforced for
**every** library by the eval `capture-seeds-are-not-promote-output`, verified to
fire on all five astryx entries at the pre-fix state.

**2. The re-anchoring ledger acked leaves the engine no longer mints.** 31 leaves
across 16 of 19 rows, and **every one a `row-rule-color`** — the currentColor
mirror the mint-cleanup round folds away corpus-wide. Astryx could not be
recaptured at the time, so it kept them, and its ledger had been hand-anchoring a
channel the engine now removes by itself. Pruned mechanically (12 rows retired, 4
pruned), with the prune **refusing** if any vanished leaf were not a
row-rule-color.

**The review was then re-run against the fresh mint**, and the honest scoreboard
is the anchorable denominator rather than the raw total:

| | colour leaves | aliased | share |
|---|---|---|---|
| before (frozen capture) | 113 | 54 | 47.8% |
| after (recapture + review) | 134 | **68** | **50.7%** |

Measured against the *whole* tree the share appears to fall (22.8% → 16.7%), and
that reading is wrong: the recapture adds 150 dimension leaves that no colour
token can ever name. Reading more of a library inflates the denominator without
being a regression.

The hard calls were decided **by role, never by hue**, using the library's own
axis vocabulary as evidence: badge exposes both `warning` and `yellow` and both
`error` and `red`, and card exposes a distinct `gray` — so a colour-named axis
takes the colour-named token and a role-named axis takes the role token. `#FFFFFF`
splits four ways (`color-on-accent`, `color-on-error`, `color-background-card` as
a surface, `color-on-dark`), and that last arm closes a debt the previous round
recorded by name: it declined the slider tooltip's white text as undecidable and
wrote its own unblocking condition — *"name the tooltip surface first … then this
leaf becomes decidable"* — which this round satisfies.

**Proven:** capture exit 0 on all 5, promote exit 0 with the resolution guard
green, **promote twice byte-identical**, provenance back to one sentence each,
13/13 Figma scripts through their compile receipt, and `figma-scripts-fresh` at
**5 of 6** libraries byte-fresh.

**Still open, named:** Switch captures cleanly but is excluded from promotion by a
hardcoded list in `examples/astryx/scripts/promote-floor.ts`, so astryx promotes 4
of its 5 captured components. Astryx is also the last library not on the shared
`packages/cli/src/promote.ts` path.

### 3.2 Polaris: CLOSED — recaptured 2026-07-29 with the CSS-vars reader on (task #26)

This section used to say Polaris could never be recaptured, then that the
harness existed but the recapture had not been run. Both are history: **all 12
components were recaptured on 2026-07-29** through the committed sandbox
(`examples/polaris/.polaris-sandbox/` — recipe committed as `package.json` +
`package-lock.json` pinning `@shopify/polaris@13.9.5`; the install is
git-ignored, the lockfile is what makes it reproducible), each with the
double-run byte-identity self-check. The full round record is
`examples/polaris/PROVENANCE.md` — the file this library never had.

**The predicted source-alias gain is real, and it took two general engine
fixes to land.** The measurement stood (2,727 `var(--p-*)` at point of use, 328
distinct, in the published 13.9.5 `styles.css`), and the recapture read **5,201
verified source facts** across the 12 components — but the first pass produced
*zero* bound facts and then *zero* aliases, for two reasons now fixed for any
library shaped like Polaris rather than patched for Polaris:

- the reader's mechanical var→leaf mapping (`--p-font-weight-medium` →
  `font-weight-medium`) missed a DTCG tree that nests its leaves under a
  wrapper group (`p.font-weight-medium` — the spelling every committed `{p.*}`
  ref uses). The capture config now declares `tokenGroup` next to `varPrefix`
  (`extract/computed/configs/polaris.json`); absent = no prepend, byte-unchanged
  for the five flat-tree libraries;
- the shared promote read the DTCG base as a *flat top-level map*, so
  `tokenValue("p.…")` was `undefined` and the whole alias pass zeroed out with
  no receipt (covering-set-empty is a pre-receipt break). It now flattens by
  walking — proven byte-neutral for MUI/Carbon/Tailwind/Altitude by
  re-promotion, not assumed.

**Result: 179 minted leaves are now DTCG aliases to Polaris's own tokens**
(`imported.button.root.color.plain.none → {p.color-text-link}`), 1,174 stay
literal (no verified source reference), 1 named refusal (two tokens share the
covering value — `p.color-checkbox-icon-disabled` vs
`p.color-text-brand-on-bg-fill` — kept literal rather than guessed). Polaris
also moved off its bespoke v0.3.2 promoter onto the shared
`packages/cli/src/promote.ts` (`examples/polaris/ds-library.json`;
`promote-floor.ts` is now a shim), making astryx genuinely the last library
with its own promote script (§3.1).

**Two engine crash classes the aliases exposed, both fixed generally:** the
provisional-minting preamble (`generate.ts`'s path — the only path that emits
one) ran `px()` on a raw `{p.font-weight-medium}` ref; an aliased minted leaf
now upserts a **native Figma variable alias** to the real token variable when
the origin file carries it, with the resolved literal embedded as the named
fallback for empty files (the headless compile receipt exercises exactly that).
And `compileTokenSetRows` spelled alias *targets* by dot-path while the sync
runtime resolves them through a map keyed by variable *name* (slash form) —
the exact sibling of the `7b02b42` base-name fix, reachable only by a
nested-wrap library with minted aliases, i.e. by Polaris first.

**The freshness-gate hole is closed.** `scripts/figma-scripts-fresh.mjs` no
longer names polaris as un-gated: its row runs `generate.ts --check` (a
byte-compare over all 76 generated surfaces, strictly wider than the CLI
rebuild rows), and the eval that used to *require* the `NOT GATED` line now
fails if one ever reappears. 6/6 libraries byte-fresh, zero named holes.

**Still true, and still named.** The other five libraries' sandbox recipes
remain PROVENANCE prose, not committed bytes — Polaris set that bar (first
library reproducible from committed bytes) and bringing the other five to it
is follow-up work. Refusal still cannot lower a fidelity score (§5.1), and the
recapture does not change the coverage fraction: 12 of 180 extractable Polaris
components (6.7%, §1.1) is still a hand-picked slice.

### 3.3 A stale published number in the Polaris showcase

`examples/polaris/SHOWCASE.md` publishes a Round-4 canvas-gate table in which
**all 10 scored components FAIL** their ≤5% masked acceptance. The committed
scorecards under `examples/polaris/receipts/canvas-gate/` are from the later
Round 5a/5c/5d work against contract v0.3.2 and measure **7 of 10 PASS** (Avatar,
RadioButton and Spinner at exactly 0.00; Button 6.46, ProgressBar 26.22 and Tag
27.04 still over the bar). The table is now marked superseded in place
(2026-07-29), with the receipts named beside it. Note the committed scorecards
themselves now trail the contracts: the task-#26 recapture moved every Polaris
contract to v0.4.0 (§3.2), and the canvas gate is a live instrument — re-running
it against the fresh contracts requires the plugin on a real canvas (owner
work), so the v0.3.2 receipts stand as the last live measurement, named here
rather than silently presented as current.

Re-derive it yourself:

```bash
node -e "for (const f of require('fs').readdirSync('examples/polaris/receipts/canvas-gate').filter(f=>f.endsWith('.scorecard.json'))) { const d=require('./examples/polaris/receipts/canvas-gate/'+f); console.log(d.component, d.summary.meanAAMasked, JSON.stringify(d.acceptance)); }"
```

---

## 4. Journeys — the things the product cannot do

### 4.1 You cannot point the plugin at a GitHub URL or an npm package

**Not a missing feature — a structural one.** The capture must *run* your
components in a real browser to read their computed styles; that is what makes
the result true instead of guessed. A Figma plugin is a sandboxed iframe with no
Node, no npm, no bundler and no browser engine of its own. It cannot install your
package and it cannot render it.

The browser step therefore happens on a machine you control — a laptop or CI —
and what travels to Figma is a finished JSON bundle.

**Status** — permanent, by architecture. Stated in the README as well, on
purpose.

### 4.2 Adopting a hand-built Figma set is not a verb this tool has

*Stamping* an existing, hand-drawn Figma component set as contract-backed so
future syncs amend it in place **does not exist**.

What is proven: coexistence inside a foreign kit, and amending a set *this tool
created* inside a foreign kit. Amending a hand-built set is not.

**What you'd observe** — Journey C gives you a disagreement report and a CI
referee, but the only way to get a contract-backed set on the canvas is to let
the tool generate one alongside your existing one.

**Status** — no plan.

### 4.3 Reconciliation compares API surfaces only

`ds-contracts extract --reconcile` classifies every *property* as agree /
options-differ / code-only / design-only. It cannot adjudicate a token
disagreement, a spacing disagreement, or any anatomy difference:
`extract/reconcile.ts` contains no reference to tokens, spacing or anatomy —
verifiable with `grep -c 'tokens\|spacing\|anatomy' extract/reconcile.ts`, which
returns 0.

Matching is deliberately transparent v0: names normalize by lowercase-alphanumeric,
enum options match on normalized sets with a small abbreviation table
(`sm ⇄ small`). Everything else is reported, not guessed.

**What you'd observe** — the report tells you your Button's `size` enum differs.
It will not tell you your Button's padding differs.

**Status** — no plan for a token/anatomy reconciler.

### 4.4 The concurrent-change story is not built

From the ranked gap list in [docs/18](18-user-flows.md), with its status column
verified against the shipped surfaces:

| gap | status | what is missing |
|---|---|---|
| **G3 — three-way merge** (genesis × incoming × canvas, per-channel resolution) | **OPEN** | there is no screen for "two writers touched the same component this week." Named by all three personas as the decisive moment. |
| **G4 — silent-revert guard** | **OPEN** | after a design-led merge, the next code-led extract reads unchanged source and re-commits the old value — reverting the approved change **with drift green**. The lead's stated trust-killer. |
| **G7 — brownfield write-back suggested diffs** | **OPEN** | design-led merges leave hand-written components stale; there is no anchor-derived suggested patch on the PR. |
| **G5 — org-level GitHub App** | OPEN | designers still paste a fine-grained PAT into a plugin field. |
| **G10 — PR-first CI defaults** | OPEN | the code-led recipe commits contracts to main rather than opening a PR. |
| **G11 — contract-diff English summarizer** | OPEN | no `diff --summarize` for PR comments. |
| **G13 — audit trail & loop closure** | OPEN (record shape exists) | no viewer tab, no "resolved by PR #N". |

**G2 (drift-aware update warning), G8 (plain-words style diffs), G9 (sample-library
cold start) and G14 (refusal triage + `init --detect`) are SHIPPED**; G1, G6 and
G12 are **PARTIAL** — read the row in docs/18 for which sub-items.

**What you'd observe for G4 specifically** — you merge a designer's approved
change, the next CI run reverts it, and every gate stays green.

### 4.5 The standing CI↔Figma channel is half a channel

G1's **deliver** half shipped: a standing channel on the assist worker with a
write-key/read-key split (`readKey = sha256(writeKey)`, so a leaked Figma-side
key reads and can never inject), monotonic `seq` on deliveries, a freshness guard
that names out-of-order deliveries and starts every Apply box unchecked.

Two named holes remain:

- **Deliveries are not signed.** Anyone with the write key can publish any
  provenance, so there is no "verified" badge. Excluded by name: the plugin
  sandbox has no WebCrypto for an end-to-end in-plugin signature.
- **The read half does not exist.** A headless fingerprint-drift recompute off a
  REST file dump, so CI can referee drift without a human clicking a tab, is not
  started.

Also: the plugin **has no timer and cannot have one** — a Figma plugin has no
background execution. It peeks on open and on a "Check for updates" button.

### 4.6 The static (no-browser) path silently produces empty canvas sets

`ds-contracts extract` without `--computed` always proposes schema-valid
contracts carrying your **API surface**. Whether it also gives you **anatomy**
depends entirely on how your library is styled:

| your library | what static extraction produces |
|---|---|
| React + co-located `*.module.css` | API surface **and** anatomy — best-effort. Polaris's whole library yielded anatomy for 109 of 182 components; the rest came back as stubs. |
| React + StyleX | API surface and **structure only** — no styling |
| React + Tailwind, Emotion, styled-components, any runtime styling | **API surface only.** Anatomy is the stub `{"root": {}}`. |
| Web Components via CEM | **API surface only** — a manifest has no styling channel |

**What you'd observe** — and this is the quiet failure: a stub anatomy is
schema-valid, so nothing refuses it, and the Figma emitter builds the component
set anyway. What lands is a correctly *named* component with the right variant
axes and **blank frames inside** — no fills, no padding, no bound variables.
That is the tool faithfully rendering a contract that says nothing about
appearance.

**Status** — the fix is the computed capture, which needs a reviewed capture
config (see §4.7).

### 4.7 Capture configs are expert work, and the drafter has a known trap

`classAllow` is per-library regex craft and is the one place where onboarding
cost is genuinely proportional to your naming conventions: Carbon's is one rule,
MUI's is eleven negative lookaheads. `extract/draft-capture-config.ts` marks
`classAllow`, `varPrefix`, `mount` and `fixedProps` as `__review:*` explicitly
because they are "NOT inferable from static source." This is gap **G6** in
[docs/18](18-user-flows.md) — the Emotion capture-config cliff — and it is
**PARTIAL**: the CLI halves shipped, the playground routing is open.

**The defaultless-axis trap is named, not closed.** The drafter still writes
`"__unset"` as a default pseudo-value. That string becomes a segment of every
minted token path, and the contract's token-ref regex forbids underscores — so
fusion dies with roughly forty "must be brace-wrapped" errors, **not one of which
mentions an underscore**. The fix is `"unsetLabel": "unset"` in config. The next
library with a defaultless enum axis hits the identical wall with the identical
unhelpful error.

### 4.8 The published CLI was not this repository's CLI — CLOSED

**Status — fixed 2026-07-29.** Kept here because it is the failure mode most
worth recognising: a version number that says two different artifacts are the
same thing.

`@ds-contracts/cli@0.2.0` contained **no `onboard` at all** — verified against
the tarball, zero matching files — while Journey A in the README is written
around it. Anyone following the docs against the published package got an
unknown-command error on their very first step. Worse, `@ds-contracts/schema`
was published at `15.0.0` while the repo's copy had advanced to spec v16
(`Part.hugsBelowMaxWidth`): `npm pack @ds-contracts/schema@15.0.0` plus a grep
for the field returns nothing, so **two different schema documents were sharing
one version string** — exactly the drift semver exists to prevent.

Published, and now matching the tree:

| package | was | now | why |
|---|---|---|---|
| `@ds-contracts/cli` | 0.2.0 | **0.3.0** | adds `onboard` and `promote` |
| `@ds-contracts/schema` | 15.0.0 | **16.0.0** | spec v16 — `Part.hugsBelowMaxWidth` |
| `@ds-contracts/emitter-web-components` | 0.2.0 | **0.3.0** | it now refuses an undefined token (§4.9), so it accepts strictly less than 0.2.0 did |

Check it yourself:

```bash
npm pack @ds-contracts/cli@0.3.0 && tar -xzf ds-contracts-cli-0.3.0.tgz
grep -c onboard package/dist/cli.js   # → non-zero (was 0 at 0.2.0)
```

The `examples/ci/` recipes are pinned to `0.3.0` and their receipt
([VALIDATION.md](../examples/ci/VALIDATION.md)) is a real execution against it,
regenerated after the publish — not hand-edited. The pins were deliberately
held at 0.2.0 until the publish was real, because a workflow pinned to a
version that does not exist is the defect those files had just been repaired
for.

### 4.9 One emitter target used to ship dangling token references

Three of the four registered targets refused a token that was not in the
inventory. The web-components target had **no inventory in its emit context at
all**, so a contract referencing a token that does not exist compiled cleanly
and emitted `var(--p-does-not-exist)` — a custom property that renders as
nothing, at runtime, with no error, on one target only.

**Status — fixed.** It validates through `generateCss`'s own checker rather
than a second implementation, so the two targets cannot drift into disagreeing
about whether a contract is valid. Omitting the inventory is itself a named
refusal, so the check cannot be bypassed by leaving a field undefined. Pinned
by the eval `emitters-refuse-undefined-tokens`, which poisons one root channel
of a real contract and requires the refusal to name the offending token, with
the unpoisoned contract emitting as a control.

---

## 5. Instruments — what the gates do and do not measure

A green gate is a claim about a denominator. These are the denominators.

### 5.1 Refusing something cannot lower a score

This is the structural property that makes every fidelity number in this
repository read higher than a naive reader expects
([conformance/README.md](../conformance/README.md)):

- The fidelity gate scores channels that passed `isFusable`. **A channel the
  filter never opened is not in the denominator and scores 100%.**
- **Parts that promotion refused are removed from scoring, so refusing a part
  cannot lower a score.**
- The canvas checker verifies a **hardcoded** 15-channel table.

The clearest illustration is Carbon's IconButton at **100.000%**, and its own
PROVENANCE says how to read it:

> "Read that 100% correctly: refusing the inert wrapper takes 8160 of 9280
> compared cells out of the denominator. A 100% on 1120 cells is a *smaller*
> claim than 91.810% on 9280, not a bigger one."

Polaris's Spinner is 100.000% on **0 compared cells** — all its styling rides
committed glyph assets.

**What this means for you** — never compare two fidelity percentages without
comparing their `cellsCompared`. The drift instrument pins `cellsCompared`
*exactly* for this reason: a moved denominator is a vocabulary change and must be
acknowledged.

### 5.2 The conformance fixture measures the contract, not the canvas

The fixture ([conformance/EXPECTATIONS.md](../conformance/EXPECTATIONS.md)) is
the one instrument here whose denominator is **hand-authored independently** of
the engine, so a construct that is neither carried nor named-refused is a hard
failure rather than an absence. It currently stands at **53 cases — 50 green,
3 red, 0 yellow**, with 18 UNSUPPORTED declarations under a decrease-only
ratchet.

Its own list of what it cannot yet test, quoted rather than paraphrased:

- **The canvas half.** "Every `canvas:` field in the manifest is a DECLARATION,
  not a measurement: nothing in this round runs the emitted Figma script and
  checks that a construct declared PRESENT actually reaches a node. Until it
  does, **'carried' means 'reached the contract', not 'reached the canvas'**."
- **State planes and axes.** "Every case is one combo with no variant axes, so
  per-state and per-axis correlation — **where the MUI and Carbon rounds found
  most of their defects** — is untested here."
- **Animation.** An infinite `@keyframes` animation is the most common motion
  construct in any design system (spinners) and cannot enter the fixture without
  risking the double-run byte-identity self-check for the whole round.
- **Multi-viewport.** The fixture pins one viewport, so it cannot prove what a
  second capture at a second viewport would do.

**A green gate here would mean the cases are too easy.** The three reds are §2.11.

### 5.3 The drift instrument is not part of the eval suite

54 rows across 6 libraries pin `pctEqual` within tolerance, `cellsCompared`
exactly, `unresolvedTokenRefs` exactly, and hard-fail if a component stops
fusing. It renders a real headless Chromium per component (~8–20s each, ~5–6
minutes total), so it is an **on-demand script**, not one of the 181 evals. CI
can call it; `npm run eval` does not.

It also skips any capture config with no committed scorecard — currently
`polaris-depth.json` — and **prints that it did**.

### 5.4 Headless green does not mean live correct

`scripts/plugin-engine-mock-figma.mjs` executes the real engine bundle in a VM
and is faithful for structure. It has let real bugs through: a stroke-based icon
got a second `fill` attribute injected onto the `<svg>` tag — invalid XML that
real Figma refuses — and 146 headless gates missed it because the mock was
lenient about `createNodeFromSvg`.

Two named blind spots (auto-layout sizing, instance-property reflection) are now
modeled. **Remaining known looseness**: per-mode variable resolution (only the
default mode resolves), no font-load enforcement, text measurement is an
estimate, and vector geometry is out of scope.

The discipline the repo adopted from this — *every bug found live must also teach
the mock to catch it headlessly* — is a discipline, not a guarantee.

### 5.5 The canvas gate is a per-library harness, not a frontier detector

The only canvas-truth gates are hand-written per-library scripts that encode
defects a human already found by looking at a canvas. They are a regression net.
That is precisely the gap the conformance fixture was built to close, and the
fixture's canvas half (§5.2) is the part still missing.

### 5.6 Pixel numbers carry conventions you need to know

- Portal/overlay pixel rows are **pinned at 100 ("fully different"), not scored**
   — the size-mismatch convention scores 100 pessimistically, so no pixel number
   is quoted for Dialog, Menu or Tooltip.
- Masked scores mask text, because cross-renderer font rasterization never
  flatters a result — but see §2.8: with no webfonts loaded, "masked" is doing
  more work than usual.
- A low percentage against a blank canvas is not a pass; the canvas gate carries
  an explicit blank-canvas guard for that reason.

---

## 6. Out of scope by decision — not gaps

These will not be fixed, and saying so is the point
([docs/16](16-sync-boundary.md)):

- **Web DOM only.** Every capture is a browser-computed fact from a headless
  Chromium page. Non-DOM renderers — React Native, Flutter, native toolkits —
  are outside the computed floor entirely. Not "not yet"; not on this path.
- **The supported set is React and Web Components (CEM)** with five styling
  methods: CSS Modules, Emotion in CSS-variables mode, StyleX, Tailwind, and
  **open** shadow DOM. Everything outside runs through graceful degradation —
  correct pixels, literal token names — and graduates via a community *reader
  plugin*, never as an engine branch.
- **Behavior, motion, and a11y semantics beyond states** belong to the code that
  owns them. A contract carries only canvas-expressible facts. Your code stays as
  rich as you like; the contract never claims to describe that part.
- **The plugin is not on the Figma Community** and that is an owner decision
  (2026-07-26), not a pending task. Distribution is the manifest-upload
  developer-plugin path, which means someone with repo access imports the
  manifest once per file owner, in the Figma **desktop** app.
- **No AI is in the conversion path.** Generation is deterministic; assist may
  propose, only an explicit acknowledgement writes a contract. This bounds what
  the tool can do as much as it bounds what it can get wrong.

---

## 6b. THE SCALE WALL — intake cost is linear in component count, and human

*Found 2026-08-02, while starting a full-breadth Carbon ingest. The ingest did
not start; the recon answered the question first.*

Every code-side number this repo publishes is a **slice** number: MUI 14 of
~100+ components, Polaris 12 of ~80, Carbon 10 of ~40, Tailwind 5, Astryx 5.
That is not an accident of effort, and it is not the engine — the gauntlet
census has already run **1,618 sets** through the receive pipeline in one go.
It is the INTAKE.

Adoption is the nine-step path in [docs/21](21-bring-your-own-design-system.md),
and **step 4 is a seed contract per component** — described there as *"the prop
space, **never re-derived from the library**"*. Carbon's ten seeds total 654
lines, roughly 65 each, hand-authored: props, enum values, and per-value Figma
`VARIANT` display names. So the cost of onboarding a design system is linear in
its component count and paid by a human, before the tool does anything.

**What that means for size.** A small or medium system is affordable. A large
or extra-large one is not: an adopter with 100 components hand-writes 100 seeds
plus a capture config first. The engine's ability to handle a big system and a
team's ability to GET a big system into it are different questions, and only
the first one has been measured.

**The unlock, now BUILT and MEASURED — `npm run seed:gen`.** Generate seeds
from the library's own type information into a seed a human REVIEWS, turning
O(n) authoring into O(1) tooling plus n reviews. Measured against the ten
hand-authored Carbon seeds as ground truth (`-- --verify`):

| | |
|---|---|
| enum axes reproduced EXACTLY | **11 of 14** |
| axes proposed that DIFFER from the human | **0** |
| axes not proposed, MECHANICAL (a resolver gap) | **0** |
| axes not proposed, JUDGMENT (unreachable by construction) | **3** |
| axes proposed that the human seed OMITS | **9** |

Read the zero first. The generator never once proposed an enum, or a value,
that the human did not write. It is silent wherever it cannot resolve, and that
silence is the whole property that makes the output *reviewable* rather than a
second thing to fact-check.

**The ceiling is 11/14, not 14/14, and that is a finding rather than a
shortfall.** The three it misses are not resolver gaps — the tool now proves
this by reading the library's own declaration for each missed prop. Carbon
declares `toggled?: boolean`; a human named the two states `untoggled|toggled`.
Carbon declares `checked` and `indeterminate` as two separate booleans; a human
collapsed them into one three-value axis. Carbon declares `lowContrast?:
boolean`; a human renamed it to `contrast` with values `high|low` and inverted
the polarity. **That half of a seed is design modelling, not code reading.** A
generator that produced it would be inventing the design space.

**The review is not free, and the honest ratio says so.** Nine further axes are
proposed that the human omitted — `IconButton.align` really is a 20-value union
in Carbon's types, and a human declined to make it a Figma variant plane. Those
are read correctly and are still work. So the reviewer **prunes 9 and authors
3**, against **authoring all 23**. Pruning is much cheaper than authoring, but
it is not nothing, and a cost model that quoted only 11/14 would be overstating
the tool.

**At Carbon's full breadth** (`-- --all`, all 122 shipped components): **61
components carry at least one readable enum axis, 112 axes in total.** 52
declare no readable enum axis — many genuinely have none, since a `Layer` or a
`Grid` has no variant plane — and 9 have no locatable props declaration and
still cost a full hand-author.

**Every proposal is run through the real referee**, not just eyeballed:
`validateContract` — the same one the pipeline runs — on all 61 sweep
proposals and all 9 config components. All pass. That check earned its keep
immediately: the first version of the generator emitted `id`/`name`/
`semantics`/`props` and nothing else, which agreed with the human on every
value and **would not have parsed**, because a contract also carries
`$schema`, `version`, `status`, `anatomy`, `anchors` and `states`. Agreement on
values and a file the pipeline can read are two different claims.

The referee was falsified rather than trusted — of seven deliberate mutations
it refuses five, including each envelope field above and any unknown top-level
key. It *accepts* a `VARIANT` values map that names only some of an enum's
values; that is caught one layer later, and precisely — the emitter refuses
with `prop "size" figma values map is missing enum value "md"` for each missing
value, verified by probe against an all-values-named control.

**The prune rate is MEASURED, not estimated.** The ten seeds record what a
human actually did with each proposable axis — kept it or left it out — so the
ratio is observed behaviour rather than a guess about what a reviewer would
want. Of **20 axes proposed, a human kept 11 and dropped 9: a 45% prune rate**,
plus **0.3 axes per component** still authored by hand. The denominator is ten
components and that number should never be quoted without it.

Extrapolating to Carbon's full breadth — explicitly an extrapolation from n=10
— the 112 sweep axes would yield roughly 60 kept, 50 pruned, and about 18 axes
authored from scratch. Against hand-authoring all ~130, that is a real
reduction and not an elimination.

**What this still does not buy.** Those are the ENUM half of a seed. Every
component continues to need its parts, its semantics, and any axis a human
models out of booleans. Tier L is now *reachable*, not *reached*: the
authoring-hours estimate has dropped by roughly half, and no full-breadth
capture has yet been run.

**Why the existing rule deserves respect on the way past it.** "Never
re-derived from the library" is not laziness: a prop space inferred at capture
time silently admits props that are not design-relevant, and makes the captured
output depend on the library's internals rather than on a declared contract. A
GENERATED, human-reviewed seed is a different object from inference-at-capture.
That distinction should be argued in the open before the rule changes.

Until then: tier L (51–200 sets) is **unmeasured** on the code side, tier XL is
measured only on our own kit, and the honest word for both is *unmeasured* —
not *passing*. See `npm run gauntlet:intake`.

## 7. How to check this document yourself

```bash
npm install

# the coverage fraction (§1.1) — committed contracts, and how many are pinned
ls examples/*/contracts/*.contract.json | wc -l            # → 62
node -e "console.log(require('./extract/computed/regate-baseline.json').rows.length)"   # → 54

# overlays carry zero source facts (§2.1)
node -e "for (const c of ['mui/dialog','mui/menu','mui/tooltip','carbon/modal','mui/button','carbon/button']) { \
  const p='extract/computed/out/'+c+'/source-bindings.json'; \
  try { console.log(c, require('./'+p).facts.length) } catch { console.log(c,'—') } }"

# reconciliation touches no token or anatomy channel (§4.3)
grep -c 'tokens\|spacing\|anatomy' extract/reconcile.ts     # → 0

# the conformance frontier (§5.2) — reads committed artifacts, no browser
npm run conformance

# the published CLI carries the verb the docs open with (§4.8)
npm pack @ds-contracts/cli@0.3.0 && tar -xzf ds-contracts-cli-0.3.0.tgz \
  && grep -c onboard package/dist/cli.js         # → non-zero (0 at 0.2.0)

# every gated number in every doc, re-derived from the repo
npm run docs:check
```

The offline drift instrument (`npm run extract:computed:drift`) and the fidelity
regate (`npm run extract:computed:regate`) each launch a real Chromium and take
five to six minutes; they are the number-level pins behind §2 and §3.

---

*If you find something this document does not name, that is a bug in this
document, and it is the kind worth reporting.*
