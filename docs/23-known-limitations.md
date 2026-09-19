# 23 — Known Limitations

> **Current state (2026-08-30).** This inventory is the **capture /
> universal-contract** cost sheet. It still applies to Journeys A–C,
> `extract --computed`, and the numbers in [docs/24](24-what-works.md).
> It is **not** a claim that Combobox, Table, or Calendar have no proof:
> those three (plus Button and Input) have stayed live recipe-IR mints and
> owner-signed grades. Product v1 is still incomplete (F1). See
> [docs/32](32-recipe-ir-pivot.md). §C.1.1 below remains the capture-path
> cut; do not silently reclassify those rows as recipe-IR evidence.

*Written for someone deciding whether to adopt this. It is the complete
inventory of what this tool does **not** do.*

**Read this with its companion: [24 — What Works](24-what-works.md).** That
document is generated from committed artifacts and holds the success side —
the measured fidelity, the reproducibility pins, the honesty instruments
counted as features. This one holds the cost. Neither is complete without the
other, and reading only one of them will mislead you in a predictable
direction.

**One thing to know before you start.** This document is long — longer than
docs/24 — and length here is a property of the disclosure discipline, not a
measurement of the defect rate. Most tools do not publish a document like
this at all, so there is nothing to compare its length against. That is an
explanation of why the list is long; it is **not** an argument that the
entries are small. Several of them are large, and the four-part cut below
exists so you can tell which is which without reading all of it.

---

## How this document is cut

The old version interleaved physics with unfinished work, so a permanent
property of the medium and a bug we have not fixed read identically. They are
now separated:

| part | what is in it | how to read it |
|---|---|---|
| **[§A — IRREDUCIBLE](#a--irreducible)** | The medium mismatch. Figma has no cascade; CSS has no component-property types; proportional resize has no CSS spelling. Plus what is out of scope by an explicit decision. | **These will never change.** No roadmap closes them. Saying so is the point. |
| **[§B — NOT BUILT YET](#b--not-built-yet)** | Real gaps with a real shape. Each carries **what it would take**: a round, an engine change, a schema addition, a re-capture, or nothing planned. | These are the honest backlog. Cost is stated so you can price them. |
| **[§C — THE MEASURED PRICE OF WHAT WORKS](#c--the-measured-price-of-what-works)** | Round-trip totals, named refusals, the three ceilings, the coverage fraction, and what each instrument's denominator actually covers. | These are **costs of a working thing**, not failures of a broken one. They are still costs. |
| **[§D — CLOSED](#d--closed--a-dated-register)** | A dated register. A limitation this repo closes is **not deleted** — it moves here with the date, the commit and the gate that now prevents regression. | Deleting a closed entry would make this document's own history unfalsifiable. Same principle as the repo's decrease-only ratchets. |

**How to read an entry.** Each one states *what it is*, *what you would
observe* (the symptom you'd actually hit), and — in §B — *what it would take*.
"Named" in this repo means the tool prints the limitation by name rather than
degrading silently; it does **not** mean the limitation is fixed.

**The single most important number is in [§C.1](#c1-coverage--how-much-of-a-library-is-actually-captured).**
Fidelity per captured component is high; coverage per library is not. Both are
true, and the second is the one usually left out.

Companion reading: [24 — What Works](24-what-works.md) (the success side) ·
[docs/22 §8 — the honest ledger](22-generality.md) (the evidence behind the
generality claim, and where it leaks) ·
[conformance/EXPECTATIONS.md](../conformance/EXPECTATIONS.md) (the measured
CSS/DOM frontier) · [docs/18 — User Flows](18-user-flows.md) (the ranked gap
list with a verified status column) · [docs/16 — The Sync Boundary](16-sync-boundary.md)
(what is out of scope by decision rather than by unfinished work).

Section numbers changed in this re-cut. The old §N → new §X.N crosswalk is
[§F](#f--section-crosswalk-old--new), for the many files that cite the old
numbering.

---

# §A — IRREDUCIBLE

*Two media that do not share a vocabulary, plus the decisions that will not be
revisited. Nothing here is a backlog item. If one of these blocks you, this
tool is the wrong tool and you should find that out on this page rather than
three weeks in.*

## A.1 CSS constructs with no canvas spelling

Refused **by name** — the engine says the word rather than dropping the fact
silently — and unlikely ever to change, because the target medium has no
equivalent:

- **CSS Grid — no longer irreducible; the declared-track half is landed.** The
  A1 recon (docs/research/grid-recon-probes.md) found the canvas grew
  `layoutMode: "GRID"` with byte-exact track readback, and the engine now
  CARRIES the declared-track subset: px/fr/`fit-content(100%)` tracks
  (fractional ok), the row/column gap pair, explicitly-placed children
  (0-based anchors, spans, per-cell align), **auto-placed children** (cells
  derived from child order exactly as CSS row flow resolves them, then
  DECLARED — as explicit anchors when the author declared row tracks, as
  `layout.flow: "row"` when they did not; G5, landed 2026-08-08), named areas
  as contract-owned slot anchors, absolute overlays inside grids, grids on
  component variants, instance children, and grid-in-flex composition
  (conformance: **all 31 `grid-*` cases green** — 20 CARRIED, 2 LOWERED,
  9 REFUSED-by-name — including `grid-2d`). One bounded class remains:
  - **REFUSED by name — the 9 solver-half constructs** (each with its probe
    dead-end, `GRID_REFUSALS` registry): `grid-track-percent` (track enum is
    FLEX|FIXED|HUG — no PERCENT, P2b), `grid-track-minmax` (`minmax()` has no
    canvas spelling — "Unrecognized key(s) 'min','max'", P6),
    `grid-track-zero` (0px/0fr tracks are SILENTLY REWRITTEN by the API —
    refused so the emitter can never trigger the rewrite, P2b),
    `grid-auto-fit-minmax` (no repeat-to-fit concept — a viewport-responsive
    track COUNT is a reflow family one frame cannot carry, P1),
    `grid-flow-column` (`COLUMN_AUTO_FLOW` rejected, P5),
    `grid-flow-dense` (dense packing is solver output, enum rejects it, P5),
    `grid-subgrid` (no track-inheritance property anywhere in the reflected
    API, P1), `grid-implicit-tracks` (the canvas absorbs overflow by
    REWRITING the declaration or under-reports it — lossy readback, P9), and
    `grid-child-grow` (`layoutGrow` inside a grid is silently accepted with
    no effect — refused so a dead fact is never minted, P4).
  - What auto-placement carries, and the two shapes it still refuses, is in
    [§B.22](#b22-auto-placed-grids-g5-placement-from-order-landed-with-two-named-fences).
- **`position: fixed`, `position: sticky`** — refused. Confirmed REFUSED in
  today's `npm run conformance`.
- **`transform`, and the independent `rotate` property** — refused. This is
  why MUI's active sort arrow draws in its authored orientation instead of
  rotated 180°.
- **`filter`, `backdrop-filter`, `clip-path`, `mask-image`, `mix-blend-mode`**.
- **`writing-mode`, `direction: rtl`** — there is no RTL story.
- **`content-visibility`, `-webkit-line-clamp`, `accent-color`.**
- **An icon-font glyph pseudo-element** — `::before { content: "\2715";
  font-family: icons }`, refused as `pseudo-content-not-canvas-ink`. A glyph
  from a font the canvas does not have is not ink the canvas can draw.
- **A `::after` painted only by a linear-gradient** — refused as
  `pseudo-decor`; the decor grammar carries solid paint.
- **A run of ≥2 adjacent inline children** in a block container — one
  anonymous line box, no flat-frame spelling; keeps the row default.
- **Value-derived styling.** Polaris's Avatar hashes the name/initials into one
  of seven palette classes. No contract channel can be a function of a text
  prop's *value*, because on the canvas the value is a variant, not an input.

**What you'd observe** — a close "×" drawn with an icon font simply is not on
the canvas; a rotated caret draws unrotated; a sticky header draws in flow.

## A.2 Canvas constructs with no CSS spelling

- **`ConstraintType.SCALE`** — proportional resize. **Refused by name** in
  `core/propose-figma.ts`; a refused SCALE part renders **in flow** rather
  than as a half-carried absolute box (pinned by
  `npx tsx extract/figma/constraints-check.ts`, 12 assertions).
- **An OBLIQUE `GRADIENT_LINEAR` fill** — dump v1.16 captures every linear
  gradient (handles + stops), and **axis-aligned ramps carry exactly**
  (background-image, normalized to the box's visible segment — pinned by
  `npm run extract:figma:gradient:check` and the `design-gradient-textcase-carriage`
  eval; Eventz Badge is the field case, 23.5 → 61.2). An oblique ramp is
  **refused by name**: Figma's handles live in normalized object space while
  a CSS gradient angle lives in pixel space, so the equivalent angle and stop
  scale are functions of the drawn box's **aspect ratio** — no
  size-independent exact spelling exists (Eventz Molecules/Alert is the field
  case; the refusal note carries the raw handles). **Unlock condition:** a
  per-variant carriage that bakes the DRAWN box's angle would be exact at
  that size and silently skewed at every other — carrying it would need a
  box-aware gradient channel (angle recomputed from the rendered box), which
  is an engine change on every emit surface, not a grammar extension.
  Radial/angular/diamond gradients stay `paint-unsupported` capture receipts.
- **Figma component-property types** have no CSS counterpart beyond the
  variant/enum lowering the contract already spells.

## A.3 The architecture: the plugin cannot run your code

**Not a missing feature — a structural one.** The capture must *run* your
components in a real browser to read their computed styles; that is what makes
the result true instead of guessed. A Figma plugin is a sandboxed iframe with
no Node, no npm, no bundler and no browser engine of its own. It cannot
install your package and it cannot render it.

The browser step therefore happens on a machine you control — a laptop or CI —
and what travels to Figma is a finished JSON bundle. **You cannot point the
plugin at a GitHub URL or an npm package.** Stated in the README as well, on
purpose.

The plugin also **has no timer and cannot have one** — a Figma plugin has no
background execution. It peeks on open and on a "Check for updates" button.
And the plugin sandbox has **no WebCrypto**, which is why channel deliveries
carry no end-to-end signature (§B.14).

## A.4 Out of scope by decision — not gaps

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
- **Closed shadow roots are unreachable from script by definition**
  (`el.shadowRoot === null`), so nothing about a closed host's interior is
  captured or carried. The reader names the two signatures of that absence it
  *can* see — a custom-element leaf that paints a box; a non-replaced
  `display:inline` leaf with a non-zero content box — and **names as
  UNDETECTABLE the third**: a closed root on a plain element blockified by a
  flex/grid parent, which no computed style distinguishes from an empty item
  (`extract/computed/run.ts`, `closed-shadow-root-limit`). The decisive probe
  (calling `attachShadow` and catching `NotSupportedError`) mutates the page on
  its negative path and would break the double-run byte-identity self-check —
  it is **refused, not forgotten**.
- **Behavior, motion, and a11y semantics beyond states** belong to the code
  that owns them. A contract carries only canvas-expressible facts. Your code
  stays as rich as you like; the contract never claims to describe that part.
- **The plugin is not on the Figma Community** and that is an owner decision
  (2026-07-26), not a pending task. Distribution is the manifest-upload
  developer-plugin path, which means someone with repo access imports the
  manifest once per file owner, in the Figma **desktop** app.
- **No AI is in the conversion path.** Generation is deterministic; assist may
  propose, only an explicit acknowledgement writes a contract. This bounds what
  the tool can do as much as it bounds what it can get wrong.

---

# §B — NOT BUILT YET

*Real gaps. Each carries its cost. The cost vocabulary is fixed:*

| cost | means |
|---|---|
| **a round** | a re-capture of one or more libraries, because the change moves committed floors |
| **an engine change** | code in `extract/computed/` or `core/`, no re-capture required |
| **a schema addition** | the contract has no field for the fact; the spec version moves |
| **a re-capture** | no code change — the instrument exists, the committed artifacts predate it |
| **no plan** | named, unscheduled, and not being worked on |

## B.1 Overlays and portals lose their source token *names*, in every library

`portalSweep()` takes no `varPrefix`. `extract/computed/run.ts:199-200` calls
it with `{ screenshots, classAllow, classPrefix }` — and the capture signature
at `extract/computed/capture.ts:2112` has no `varPrefix` parameter to pass.
The consequence, re-verified from committed artifacts today:

| component | facts in `source-bindings.json` |
|---|---|
| `mui/dialog`, `mui/menu`, `mui/tooltip`, `carbon/modal` | **0** each |
| `mui/button` | 156 |
| `carbon/button` | 126 |

**What you'd observe** — your Dialog lands on the canvas with correct colours
that are **anonymous literal values**, not bound to `--your-color-surface`.
Correct pixels, no token names. Every other captured component in the same
library binds its names normally.

**What it would take — a round** (tracked as **task #23**). Threading
`varPrefix` changes MUI's Dialog / Menu / Tooltip captured truth and their
promoted contracts. Named first in `examples/carbon/PROVENANCE.md` as "THE
HEADLINE DEFECT", re-confirmed unfixed in `examples/altitude/PROVENANCE.md`.

## B.2 Overlay components have no state planes at all

`portalSweep` mounts and unmounts per combo, so hover / focus-visible / active
planes for Dialog, Menu and Tooltip **do not exist in the captured truth**.
Fusion skips them by name and those contracts declare `states: []` — pinned by
the contract, not by luck. Verified today: `states` is `[]` in
`examples/mui/contracts/{dialog,menu,tooltip}.contract.json` and
`examples/carbon/contracts/modal.contract.json`.

**What you'd observe** — an overlay component set on canvas with a Default
variant and no interactive states, where a sibling Button has four.

**What it would take — a round.** Not started.

## B.3 Text wrapping is not implemented — a corpus-wide gap

A hugging text node inside a narrower fixed-width ancestor **clips**. MUI's
`AccordionDetails` body copy measures 426px inside a 288px ancestor.

The Carbon live-defect round measured a *second* mechanism in the same class: a
shrink-to-fit box is measured in the harness's fallback font and baked as a
FIXED width, then drawn in Inter. Carbon's `tabs__nav-item-label-wrapper`
carries `width: 62.3125px` — which is the word "Overview" in a font the canvas
does not have. Complete Carbon inventory (8 instances, all in Accordion, plus
Checkbox/Modal/Tabs/TextInput label widths) in `examples/carbon/PROVENANCE.md`
§D4.

**What you'd observe** — long labels truncated or overflowing on canvas;
button and tab widths that are subtly wrong in a way that tracks word length.

**What it would take — a round.** "Fixing this changes every hugging text node
in the corpus," so it is its own round, deliberately not attempted mid-round
twice now. Named, not started.

## B.4 Two-axis geometry and paint products have no spelling

A decor whose offset is a function of **size AND state** cannot be expressed.
`stylesWhen` conditions are single-prop; `literals` and `shape` are scalars.

Concretely: Flowbite's toggle knob x-offset is a function of `Sizing × Checked`
(2, 18 / 2, 22 / 2, 28). Carbon's Toggle pins `size: md` for the same reason,
rather than minting a product nothing can render.

**What you'd observe** — **a checked toggle draws its track and no knob.**
`examples/tailwind/PROVENANCE.md`: "On canvas the toggle still draws its track
only."

The same hole exists for paint: the disabled-plane paint of a decor is an
enum × state product with no spelling. Both halves refuse by name and both
fire today — `pseudo-decor-geometry-multiaxis` at
`extract/computed/anatomy.ts:1428` and `pseudo-decor-state-paint-uncarried` at
`:1459`, with the measured values printed per combo.

**What it would take — a schema addition plus an engine change.** The named
path forward is synthesizing the pseudo-element into the sweep as a real
aligned part, exactly as MUI Switch's thumb offset now is. Named as "the next
round"; not started.

## B.5 Four pseudo-element channels the reader has never opened

Measured by the conformance fixture
([conformance/EXPECTATIONS.md](../conformance/EXPECTATIONS.md)). **This table
was wrong in the previous version of this document** and is corrected here:
`li::marker` and `input::placeholder` were filed as named refusals. They are
not. They are UNSUPPORTED declarations — the reader has never looked.

| construct | disposition | canvas expectation |
|---|---|---|
| **`li::marker`** | **UNSUPPORTED** — never read | ABSENT ("a list marker would have to be drawn as a real text node") |
| **`input::placeholder`** | **UNSUPPORTED** — never read | **PRESENT** — "placeholder text is REAL INK on a canvas mock-up — the loss is visible" |
| **`::selection`** | **UNSUPPORTED** — never read | ABSENT (transient user state) |
| **`dialog::backdrop`** | **UNSUPPORTED** — never read | **PRESENT** — "a modal scrim is a real rectangle on the canvas" |

The manifest's own `why` for `pseudo-marker` is the distinction this section
exists to make: *"The reader has never looked at ::marker."* A refusal appears
in a receipt you can grep; a channel that is never read produces no artifact
at all. `npm run conformance` prints all four as `UNSUPPORTED` today.

**Two of the four lose visible ink**, which is worse than the previous
wording admitted: a `<dialog>`'s scrim colour and an input's placeholder text
are both things a designer expects to see on the canvas mock-up.

**Status of the label, precisely.** UNSUPPORTED is *not* a refusal. It is a
declaration under conformance's **decrease-only ratchet** — the count of
UNSUPPORTED cases may go down and may never silently go up. Eighteen such
declarations stand today.

**What it would take — an engine change per channel** (the reader must
enumerate the pseudo). No plan to open them.

The related refusals live in [§C.3](#c3-the-refusal-ledger): the icon-font
glyph and the gradient-only decor are genuine named refusals ([§A.1](#a1-css-constructs-with-no-canvas-spelling)),
and Carbon's checkbox **checkmark** is refused as `pseudo-decor-outside-grammar`
— it is a rotated two-border L.

## B.6 Shadow DOM: depth-3 nesting is not exercised

Open shadow roots are tier-1 supported (Altitude, library #8). **Depth-2
shadow nesting is exercised; depth-3 is not** ([docs/16](16-sync-boundary.md)).
Altitude's `al-alert` family was dropped from the round for exactly that
reason. (Closed roots are [§A.4](#a4-out-of-scope-by-decision--not-gaps) —
physics, not backlog.)

**What it would take — a round** on a library with depth-3 nesting.

## B.7 `flex-basis` is not a carried channel anywhere in the pipeline

Absent from `CHANNEL_TO_COMPUTED`. A python walk of every `.ts` / `.js` /
`.mjs` under `core/` and `extract/` finds **zero** occurrences of `flex-basis`
or `flexBasis`. Unlike everything in [§A.1](#a1-css-constructs-with-no-canvas-spelling),
this one has an obvious canvas spelling — it is simply not read.

**Observable:** Carbon's Modal footer buttons measure 128 and 112 on canvas
where Carbon's captured truth is 377 and 377 (an equal-width flush-right
pair). Named precisely in `examples/carbon/PROVENANCE.md`.

**What it would take — an engine change** (one channel). Not fixed.

## B.8 Two constructs the engine carries that it should not

The conformance fixture's three open reds are all **UNDECLARED-CARRY**, and two
of them are the harmful kind — the engine carried something with no canvas
spelling. `conformance/EXPECTATIONS.md` still shows exactly three 🔴 rows, and the
run on 2026-08-23 prints `82 cases · 79 pass · 3 red · 0 yellow` with
`no drift against conformance/BASELINE.json` (the fixture grew from 53 to 82
cases since this entry was written; the three reds are the same three):

- **`@container` queries** — the rule matches at the pinned viewport and its
  value is carried as if unconditional. A size-conditional rendering is a MODE,
  not a single canvas variant. Container queries are how 2026-era libraries do
  responsive components.
- **A non-matching `@media` branch** — a capture at one viewport measures one
  branch and cannot know the others exist; the matching branch's value is
  carried with no indication that a whole alternative rendering is missing.
  The same class covers Polaris's `@media (--p-breakpoints-*)`
  breakpoint-conditional styling: no contract channel, and verification renders
  sub-breakpoint.
- **`stage-box-equal`** — a captured box exactly equal to the harness stage box
  (100% × 100%) is carried as a component fact. This is the general form of the
  100vh-scrim defect: a measurement artefact promoted into a contract.
  **The VIEWPORT half of this is now closed (2026-08-04, `a2c4c19`), and
  closing it corrected this entry's own diagnosis.** The measured artefacts
  were not equal to the *stage* box (320×96) — they were equal to the
  *browser window* (900×1000), reached by two chains the stage never bounds:
  an out-of-flow box resolved against the initial containing block, and an
  in-flow block child of `<body>` (the capture page sets `body { margin: 0 }`,
  so the body content box **is** the window). Fusion is now told what the
  window and the stage were, and refuses a channel only when BOTH the
  structure (out of flow, no containing-block ancestor in the captured tree)
  and the CSS 2.1 over-constrained arithmetic say the box was laid out against
  the window — quoting that arithmetic in the receipt. That withdrew 39 minted
  leaves across 7 components in 4 of the 6 libraries, including `carbon`
  Toggle's hidden input at `top: 22656px`. A value-matching rule could not
  have done it: `mui/dialog` mints `root.width = 900px` (the window) and
  `dialog-paper.max-width.md = 900px` (MUI's real `md` breakpoint) in the
  **same file**. Still open in this class: a value resolved from a viewport
  *unit* rather than a containing block — Flowbite's `max-h-[90dvh]` computes
  to `max-height: 900px`, which no box identity can see and which needs a
  second capture at a different viewport height to distinguish from a real
  900px token.

**What you'd observe** — a responsive component's desktop values baked into a
canvas variant with no note that a mobile branch exists.

**What it would take — an engine change.** Recorded in
`conformance/BASELINE.json` so they cannot drift in either direction. Open,
named defects; fixing them means changing the engine, not the manifest.

## B.9 Named residuals that produce visible canvas differences

Collected from the PROVENANCE files, because a designer will spot these. *These
eight were not individually re-measured in this pass — they are
PROVENANCE-sourced and no commit since has touched those paths. Flagged as
such rather than presented as freshly verified.*

- **MUI's Accordion has no expand chevron** — `expandIcon` takes a React
  element, the marker grammar resolves package *exports* and pinned literals
  (`$date`, `$classTokens`) only, and the pinned
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

**What it would take — a mix**, mostly rounds. Not scheduled.

## B.10 At depth, the pipeline can fail *and say it succeeded*

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

**What it would take — seven failure classes ranked N1–N7** with fix
difficulty in `examples/polaris/ADVANCED-PROBE.md` (N1 portal/overlay *hard*,
N2 structure-creating props *hard*, N5 component-family fragmentation *hard*).
None started.

### What now catches the Popover row — and what still does not

Two checks exist because "nothing errors" is not something to ship. **One of
them was itself broken until 2026-08-03 and this document presented it as a
live net — see [§D.8](#d8-the-onboard-review-gate-had-never-printed--closed).**

1. **Mount sanity — a hard stop, at run level.** Two different components
   cannot render the same DOM with the same styles. When two do, one of them
   mounted the other: the run prints `mount-collision`, names both components,
   and exits non-zero. Nothing is published.
   (`extract/computed/mount-sanity.ts`, 4 references in `evals/run.ts`, eval
   `mount-sanity`.) **This half was always real.**

2. **The trigger advisory — a warning, at the review gate.** A queued
   component whose own prop surface declares `open` / `active` / `activator`
   and whose config drives none of them is flagged before the browser starts,
   where `onboard` already stops for a human. **This half threw a
   `ReferenceError` on every fresh onboard until 2026-08-03** and therefore
   printed nothing for any adopter. Fixed in `eae868c`; now covered by
   `npm run test:onboarding` (40/40, run today — case 40 is *"the review gate
   warns when a queued component can capture its trigger instead of itself"*).

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

**The EMIT-side variant of this class is now guarded** (Eventz field case,
2026-08: Atoms/Checkbox and Atoms/Input inferred `semantics.element: "input"`
over drawn children, React refused the void-element mount at runtime, and both
components rendered NOTHING while every build step stayed green).
`validateContract` (core/emit-react.ts) now refuses children mounted inside a
void element BY NAME on all four emit surfaces, and `proposeFromDump` demotes a
void-element inference over drawn children to a container root with a REVIEW
re-root note, so a proposal can never carry the shape the emitters refuse
(evals `refuse-void-element-children-mount`, `design-void-element-re-root`).
The CAPTURE-side net is unchanged and remains exactly what this section says:
mount-sanity plus the trigger advisory, with the plain-`<button>` gap above
still open.

## B.11 Adopting a hand-built Figma set is not a verb this tool has

*Stamping* an existing, hand-drawn Figma component set as contract-backed so
future syncs amend it in place **does not exist**. No such verb exists in
`packages/cli/src/commands/`.

What is proven: coexistence inside a foreign kit, and amending a set *this tool
created* inside a foreign kit. Amending a hand-built set is not.

**What you'd observe** — Journey C gives you a disagreement report and a CI
referee, but the only way to get a contract-backed set on the canvas is to let
the tool generate one alongside your existing one.

**What it would take — no plan.**

## B.12 Reconciliation compares API surfaces only

`ds-contracts extract --reconcile` classifies every *property* as agree /
options-differ / code-only / design-only. It cannot adjudicate a token
disagreement, a spacing disagreement, or any anatomy difference:
`extract/reconcile.ts` contains no reference to tokens, spacing or anatomy —
`grep -c 'tokens\|spacing\|anatomy' extract/reconcile.ts` returns **0**,
re-run today.

Matching is deliberately transparent v0: names normalize by
lowercase-alphanumeric, enum options match on normalized sets with a small
abbreviation table (`sm ⇄ small`). Everything else is reported, not guessed.

**What you'd observe** — the report tells you your Button's `size` enum differs.
It will not tell you your Button's padding differs.

**What it would take — no plan** for a token/anatomy reconciler. This is
reconciliation phase 2 and it has no design.

## B.13 The concurrent-change story is not built

From the ranked gap list in [docs/18](18-user-flows.md), with every status
re-verified against docs/18's own rows today:

| gap | status | what is missing |
|---|---|---|
| **G3 — three-way merge** (genesis × incoming × canvas, per-channel resolution) | **PARTIAL** | engine + checks shipped (`core/three-way-merge.ts`); designer/engineer **UI screen** still open |
| **G4 — silent-revert guard** | **PARTIAL** | `awaiting-adoption-check` pins refuse-on-silent-revert; full extract-path wiring coverage still expanding |
| **G7 — brownfield write-back suggested diffs** | **PARTIAL** | `core/suggested-diff.ts` propose-only stubs (file:line when anchor carries it); PR comment emitter + static `file:line` readers still open |
| **G5 — org-level GitHub App** | OPEN | designers still paste a fine-grained PAT into a plugin field. |
| **G10 — PR-first CI defaults** | **PARTIAL** | `examples/ci/code-led.yml` is PR-first; confirm every published recipe |
| **G11 — contract-diff English summarizer** | **PARTIAL** | `ds-contracts diff --summarize` + `contract-summarize:check` shipped |
| **G13 — audit trail & loop closure** | **PARTIAL** | the sync ledger now records the human decision per drifted row (`decision`: adopt / pending-*, with evidence and the exact resolving command) and renders it to `sync/PENDING.md`; still no viewer tab, no "resolved by PR #N". |

**G2 (drift-aware update warning), G8 (plain-words style diffs), G9 (sample-library
cold start) and G14 (refusal triage + `init --detect`) are SHIPPED**; G1, G6 and
G12 are **PARTIAL** — read the row in docs/18 for which sub-items.

**What you'd observe for G4 specifically** — you merge a designer's approved
change, the next CI run reverts it, and every gate stays green.

**What it would take — a round each**, and G3 needs a UI surface that does not
exist.

## B.14 The standing CI↔Figma channel is half a channel

G1's **deliver** half shipped: a standing channel on the assist worker with a
write-key/read-key split (`readKey = sha256(writeKey)`, so a leaked Figma-side
key reads and can never inject), monotonic `seq` on deliveries, a freshness guard
that names out-of-order deliveries and starts every Apply box unchecked.

Two named holes remain:

- **Deliveries are not signed.** Anyone with the write key can publish any
  provenance, so there is no "verified" badge. Excluded by name and the
  exclusion is [§A.3](#a3-the-architecture-the-plugin-cannot-run-your-code)
  physics: the plugin sandbox has no WebCrypto for an end-to-end in-plugin
  signature.
- **The read half does not exist.** A headless fingerprint-drift recompute off a
  REST file dump, so CI can referee drift without a human clicking a tab, is not
  started.
  - **The SIGNAL is now complete; the gap is transport (measured 2026-08-04).**
    The fingerprint could not see bindings — `boundVariables` appeared zero
    times in `core/canvas-fingerprint.ts`, so a designer who DETACHED a variable
    and typed the identical literal recomputed the same hash with no diff lines.
    v6 adds `|bound:<field>|<slash/name>` per field and stops the fill line
    leaking a run-scoped `VariableID:` into the hash. **Correction
    (2026-08-23):** the sentence this entry used to carry — that neither dump
    script calls `getSharedPluginData` — has been false since 2026-08-15: the
    dump script reads the stamp back (nine occurrences in
    `extract/figma/dump.plugin.js`, five in `parity/extract-figma.plugin.js`),
    and hop-4 dump→propose recovers the stamped names, `specHash` and
    `version` from it (`flowbite-dump-propose:check`). **Second correction
    (2026-08-23):** the read half DOES exist and runs on the scheduled
    `sync-spine` lane — `sync/observe.ts` reads the v6 stamp back over REST
    (`/nodes?plugin_data=shared`) and compares it to `sync/ledger.json`, and
    catches un-restamped edits through the dump-v1 observation baseline
    (`observed.dumpFingerprint`, tagged with the grammar that produced it).
    What is true is narrower: the v6 fingerprint is never RECOMPUTED
    headlessly (REST paint JSON cannot reproduce the plugin serialization),
    so the stamp is compared, not re-derived — and the first six live runs
    showed the baseline half is only as honest as its grammar tag
    (`sync/README.md`, "Two fingerprint domains").
  - **What the lane's red means (policy, 2026-08-23).** A red scheduled
    `sync-spine` run means exactly one thing: *a drifted row has no recorded
    human decision* (or its decision is stale because the contract hash,
    stamp or dump fingerprint moved after it was taken). Each ledger row can
    carry a `decision` — `adopt` (the canvas is the truth; `observe --adopt`),
    or `pending-reapply` / `pending-restamp` / `pending-reconcile` (`observe
    --decide`), the three outcomes that need a **Figma write to a non-scratch
    file** or a choice between two truths, which automation does not do.
    Decided drift is green with a `::warning`; the pending writes are listed,
    with the exact command and the file key they would write to, in
    `sync/PENDING.md` (generated from the ledger, byte-checked by
    `sync:ledger:check`); a spine crash is a distinct red. What remains a
    limitation: the **write** half of every pending row is a human at a Figma
    desktop (Sync Runner → *Paste a script*), and nothing records a plugin
    apply or console-loop rebuild into the ledger automatically — every
    unrecorded session write of 2026-08-09..21 became a row that needed this
    decision (`sync/receipts/2026-08-23-spine-reconciliation.md`).

**What it would take — an engine change** for the read half; the signing half
is not buildable in-plugin.

## B.14a Three limitations this repo measured about its own instruments

Recorded 2026-08-04. Each was found by measuring an instrument rather than a
component, and each is stated with the number that produced it.

- **The control baseline covers 4 tags of the 22 the corpus captures.** The
  styled-channel door admits a channel when it differs from a CONTROL element
  rendered inside the harness with the library's own CSS loaded — the right
  instrument, because it subtracts both the user agent's defaults and the
  library's reset. `capture.ts` renders controls for `button`, `span`, `a`,
  `div`; **147 of 403 captured parts (36.5%)** sit on one of 22 other tags and
  fall back to the `<span>` control. A `<td>` measured against a `<span>`
  reports `unicode-bidi: isolate`, `border-collapse: collapse` and
  `vertical-align: middle` — the UA's own table defaults, authored by no design
  system. **138 of the 351** `no schema channel today` refusals sit on such a
  part and now carry an explicit `UNRELIABLE BASELINE` qualifier naming the tag
  and the fallback. Nothing is carried differently; the refusal simply stops
  being presented as evidence the library declared something the browser did.
  Widening `CONTROL_TAGS` is a CAPTURE change — see
  [docs/HANDOFF.md](HANDOFF.md) §2 — and it cannot be priced offline, because
  `regate` replays committed truth and committed truth has no control for a tag
  that was never rendered.

- **A fact supplied by the library's GLOBAL CSS is lost on the round trip.**
  The control correctly subtracts the reset (it is not a component fact) and the
  emitted CSS does not reproduce it, so the value is absent at both ends.
  Measured instance: `tailwind/card` and `astryx/card` each draw a 1px border
  whose `border-style: solid` comes from Tailwind preflight's
  `* { border-style: solid }` — the width and colour shipped and the border
  painted nothing. Closed for this case by an admission gated on a non-zero
  width proving the style is load-bearing (`tailwind/Card 72.414 → 87.879`,
  `astryx/Card 98.601 → 100.000`). **The general form is open**: any channel
  whose value comes from the library's global CSS rather than the component's
  own rules is in this shape, and each would need its own load-bearing test
  before the same admission could be justified.

- **`max-width` becomes a FIXED WIDTH on canvas — 69 of 195 catalog cells
  disagree on the painted box, by up to 1,164 device pixels.** Found by the
  cross-surface catalog gate (`npm run catalog:visual:check`), which renders
  every catalog cell through both emitters and compares them. 21 of 51
  contracts declare `max-width` on their root;
  `packages/schema/src/contract-schema.ts` records the intent plainly — "a
  root/text part bakes it as a fixed width" — and the canvas emitter does
  exactly that, while `emit-html` keeps it a ceiling so a hugging component
  collapses to its content. Worst cells:

  | cell | CSS box | canvas box | Δ |
  |---|---|---|---|
  | `ds.toolbar :: Size=Small` | 116×56 | **1280×56** | 1164px |
  | `ds.chat-message :: Sender=Assistant` | 109×65 | **1264×65** | 1155px |
  | `ds.top-nav :: TopNav` | 132×36 | **1280×36** | 1148px |

  **A pixel diff alone cannot see this.** The pair is centre-padded onto a
  union canvas and text regions are masked, so what remains on both sides is
  white: 29 of the 69 score **0.00% masked** and carry no invariant. Until
  2026-08-04 the triage classifier tested `text-raster` before `size-delta`
  and filed 29 of them as glyph-rasterisation noise — a receipt naming the
  wrong cause for a divergence three orders of magnitude past the ε band. The
  order is now reversed and all 69 read `size-delta`, with the box receipt
  (`sizeCss` vs `sizeCanvas`) as the finding rather than the percentage.

  **What it would take — an engine decision, not a bug fix.** Either the canvas
  emitter learns a hug-with-ceiling (Figma auto-layout can express `HUG` plus a
  max, so this is expressible) or the contract stops overloading `max-width`
  for two different intents. The 69 are recorded in the gate's committed
  baseline and any growth fails the lane.

- **`slot.acceptsMode: 'restrict'` has no canvas spelling.** A native SLOT
  property carries `preferredValues`, a picker HINT that sorts entries and
  prevents nothing (an off-list append succeeds — live probe, 2026-08-08). So
  `prefer` maps exactly, `open` maps by carrying nothing, and the one tier with
  teeth cannot be enforced. Proven rather than asserted: `npm run
  slot-constraints:check` §4 drives the real engine over `ds.avatar-group` with
  only `acceptsMode` flipped; the emitted scripts carry **identical
  preferredValues** and differ in exactly **one line** — the SLOT property's
  `description`, where the emitter writes `REFUSED BY FIGMA: acceptsMode
  "restrict" has no canvas enforcement…` so the limit reaches the designer's
  property panel instead of being discovered by violating it. Off-list content
  on canvas is a **differ finding** (`parity/diff.ts`, subject `… (accepts
  violation)`), not a canvas impossibility. The restriction is enforced on the code surface by
  `validateContract` and is absent on canvas. No committed contract uses
  `restrict` today (all 38 `acceptsMode` declarations are `open` or `prefer`),
  so this constrains the first author who reaches for it.

## B.15 The static (no-browser) path silently produces empty canvas sets

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

**What it would take** — the fix is the computed capture, which needs a
reviewed capture config (§B.16).

## B.16 Capture configs are expert work, and the drafter has a known trap

`classAllow` is per-library regex craft and is the one place where onboarding
cost is genuinely proportional to your naming conventions: Carbon's is one rule,
MUI's is eleven negative lookaheads. `extract/draft-capture-config.ts` marks
`classAllow`, `varPrefix`, `mount` and `fixedProps` as `__review:*` explicitly
because they are "NOT inferable from static source." This is gap **G6** in
[docs/18](18-user-flows.md) — the Emotion capture-config cliff — and it is
**PARTIAL**: the CLI halves shipped, the playground routing is open.

**The defaultless-axis trap — CLOSED, with the mechanism** (2026-08-08; it was
"named, not closed" until then). The drafter used to write `"__unset"` as the
default pseudo-value; that string became a segment of every minted token path,
and the contract's token-ref regex forbids underscores — so fusion died with
roughly forty "must be brace-wrapped" errors, not one of which mentioned an
underscore. The named engine change (one default, one error message) landed as
both halves:

- **The sentinel never ships.** `extract/draft-capture-config.ts` now drafts
  `"unsetLabel": "unset"` (`DRAFT_UNSET_LABEL` — legal as a token-path
  segment), and every defaultless enum axis is additionally pinned in
  `baseCombo` to its **first enum value** under an explicit
  `__review:baseCombo` marker — the same ack discipline as its sibling
  non-inferable fields. Unit-pinned in
  `packages/cli/test/draft-capture-config.test.ts`.
- **The error names the rule.** `TokenRefSchema`
  (packages/schema/src/contract-schema.ts) adds, on any underscore-bearing
  ref, the actual rule alongside the brace-wrap message: *token refs may not
  contain underscores; if this is the `"__unset"` defaultless-axis sentinel,
  the axis needs a reviewed default in the capture config*. Fusion, the
  generator and every schema surface refuse with that sentence now.

Eval-gated: `refuse-underscore-ref-names-unset-sentinel` (the refusal must
name the rule, the sentinel and the fix; the drafter unit pins run inside it).

## B.17 The corpus has not been re-captured through the stylesheet-ceiling instrument

The instrument is real, live and gated ([§D.6](#d6-a-cross-origin-stylesheet-vanished-in-silence--closed)).
What is **not** true is that the corpus demonstrates it: a walk over
`extract/computed/out/**` finds **0 of the 102 committed `source-bindings.json`
files carrying a `stylesheetCeiling` key**. Every committed capture predates
the field.

**What you'd observe** — for the numbers in [§C.4](#c4-the-three-ceilings), you
still cannot tell "the library declared no token names" apart from "the reader
could not open a sheet". The counted ceiling is a property of *future*
captures.

**What it would take — a re-capture** of all six libraries. No code change.

## B.18 Pre-v1.13 dumps carry an unrepairable constraint guess

The closed half of this is [§D.7](#d7-the-engine-substituted-a-constraint-it-never-read--closed).
What remains open is the data: of **811** positioned boxes across the committed
dumps, **352 carry no `constraints` field**, and in a pre-v1.13 dump those 352
are **unrepairable** — nothing in the bytes distinguishes a genuine top-left pin
from a dropped STRETCH/SCALE. Re-processing the old dump cannot recover what
was never written.

**What it would take — a re-capture** with dump v1.13 or later. There is no
repair path for existing bytes.

## B.19 THE SCALE WALL — intake cost is linear in component count, and human

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

**The unlock, now BUILT and MEASURED on TWO libraries — `npm run seed:gen`.**
Generate seeds from the library's own type information into a seed a human
REVIEWS, turning O(n) authoring into O(1) tooling plus n reviews. Measured
against hand-authored seeds as ground truth (`-- --verify`):

| | Carbon (n=10) | MUI (n=14) |
|---|---|---|
| enum axes reproduced EXACTLY | **11 of 14** | **15 of 20** |
| axes proposed that DIFFER from the human | **0** | **0** |
| axes not proposed, MECHANICAL (a resolver gap) | **0** | **0** |
| axes not proposed, JUDGMENT (unreachable by construction) | **3** | **5** |
| axes proposed that the human seed OMITS | **9** | **12** |
| measured prune rate | **45%** | **44%** |

**The second library is in this table because the first one alone proved
nothing, and it very nearly proved the opposite.** The resolver was written by
reading Carbon's four spellings of an enum. Run unchanged against MUI it scored
**0 of 20** — a Carbon-shaped hack, not a general tool. What survived that run
is the reason it was recoverable: it still had **zero DIFFER**, because it stays
silent rather than guessing, and its own miss-classifier named the mechanism on
sight. MUI wraps nearly every enum in
`OverridableStringUnion<'a' | 'b', XPropsColorOverrides>`, declares `Breakpoint`
in the *sibling* `@mui/system` package, and trails `| undefined` — which my own
over-tightening ("decline unless every arm is a literal") had turned into a
refusal. Four fixes took it 0 → 15, with Carbon unmoved at 11/14.

Any agreement figure from a single library should be read as unvalidated. This
one replicated; the next library may not.

Read the zero first. The generator never once proposed an enum, or a value,
that the human did not write. It is silent wherever it cannot resolve, and that
silence is the whole property that makes the output *reviewable* rather than a
second thing to fact-check.

**The ceiling is 11/14 and 15/20, not 14/14 and 20/20, and that is a finding
rather than a shortfall.** Every remaining miss on both libraries is JUDGMENT,
and the tool proves it by reading the library's own declaration for each missed
prop rather than taking my word. Carbon declares `toggled?: boolean`; a human
named the two states. Carbon declares `checked` and `indeterminate` as two
separate booleans; a human collapsed them into one three-value axis. Carbon
declares `lowContrast?: boolean`; a human renamed it to `contrast: high|low`
and inverted the polarity. MUI declares `expanded?: boolean | undefined` and
`checked?: SwitchBaseProps['checked']` — a human named the states in both.
**That half of a seed is design modelling, not code reading.** A generator that
produced it would be inventing the design space.

That classifier had to be fixed before it could be believed: a bare
`/^boolean$/` test filed MUI's `boolean | undefined` and its indexed-access
`SwitchBaseProps['checked']` as *resolver gaps*, which understated the ceiling
by describing modelling decisions as bugs. It now strips nullish arms and
follows indexed access and aliases before deciding.

**The review is not free, and the honest ratio says so.** Nine further axes are
proposed that the human omitted — `IconButton.align` really is a 20-value union
in Carbon's types, and a human declined to make it a Figma variant plane. Those
are read correctly and are still work. So the reviewer **prunes 9 and authors
3**, against **authoring all 23**. Pruning is much cheaper than authoring, but
it is not nothing, and a cost model that quoted only 11/14 would be overstating
the tool.

**At full breadth across ALL SIX libraries** (`-- --all`). Only Carbon and MUI
have hand-authored seeds to check agreement against; the other four measure
whether the *reader* generalises:

| library | components swept | carry ≥1 readable axis | axes proposed |
|---|---|---|---|
| Carbon | 122 | **61** | **112** |
| MUI | 135 | **66** | **128** |
| Polaris | 121 | **52** | **125** |
| Astryx | 95 | **60** | **118** |
| flowbite-react | 46 | **0** | **0** |
| altitude | 65 | **0** | **0** |

Every proposal in every non-zero sweep passes `validateContract`. Components
with no readable axis are mostly not failures — a `Layer` or a `Grid` has no
variant plane.

**THE TWO ZEROS ARE REFUSALS, NOT COVERAGE, and the tool now says so in those
words.** A sweep that reads nothing across a whole library printed "All 0
proposals pass validateContract" — a vacuous truth that reads exactly like a
clean pass. It now prints the failure and names the idiom:

- **flowbite-react** — props live in a type alias over
  `PolymorphicComponentPropWithRef`, and each "enum" is an interface carrying
  `[key: string]: string`. The types say *any string is valid*, so proposing a
  closed enum would assert something the library explicitly denies. This one is
  declined on principle, not only on effort.
- **altitude** — Lit web components. Props are class `accessor` fields; there
  is no props interface to read at all.

Finding where a library keeps its components is also discovered rather than
listed: Carbon uses `es/components`, MUI the package root, Polaris
`build/ts/src/components`, flowbite `dist/components`. A hardcoded list is
always one library out of date, so the sweep picks the directory holding the
most `<Name>/<Name>.d.ts` declarations — and **refuses** if no directory holds
three, because a sweep that reported 0 would look identical to a library with
no components.

**Every proposal is run through the real referee**, not just eyeballed:
`validateContract` — the same one the pipeline runs — on **all 61 Carbon sweep
proposals and all 66 MUI ones**. All pass. That check earned its keep
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

**The prune rate is MEASURED, not estimated — and it REPLICATED.** The seeds
record what a human actually did with each proposable axis, kept it or left it
out, so the ratio is observed behaviour rather than a guess about what a
reviewer would want.

- Carbon: of 20 axes proposed, a human kept 11 and dropped 9 — **45%**
- MUI: of 27 axes proposed, a human kept 15 and dropped 12 — **44%**

Two libraries, different type idioms, different authors, one point apart. That
is the first thing here that looks like a general property rather than a
per-library accident — though n is still 24 components, and the denominator
travels with the number.

Extrapolating to full breadth — explicitly an extrapolation — Carbon's 112
sweep axes yield roughly 62 kept and 50 pruned; MUI's 128 yield roughly 72 and
56. Against hand-authoring all of them, that is a real reduction and not an
elimination.

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

**What it would take — a round.** Until then: tier L (51–200 sets) is
**unmeasured** on the code side, tier XL is measured only on our own kit, and
the honest word for both is *unmeasured* — not *passing*. See
`npm run gauntlet:intake`.

## B.20 Astryx promotes 4 of its 5 captured components

Switch captures cleanly but is excluded from promotion by a hardcoded list in
`examples/astryx/scripts/promote-floor.ts` — line 31 carries the by-name
exclusion and line 36 reads `const COMPONENTS = ['button','badge','card','slider']`
against `MINT_SOURCES` at line 42, which includes `switch`. Astryx is also the
last library not on the shared `packages/cli/src/promote.ts` path; Polaris's
`promote-floor.ts` is a 28-line shim whose own header says so.

**What it would take — an engine change** (a migration, not research).

## B.21 Five sandbox recipes are prose, not committed bytes

Polaris set the bar — first library reproducible from committed bytes
(`examples/polaris/.polaris-sandbox/package.json` + `package-lock.json`,
install git-ignored). The other five libraries' sandbox recipes remain
PROVENANCE prose.

**What it would take — five small rounds.** Named follow-up.

## B.22 Auto-placed grids: G5 placement-from-order landed, with two named fences

**CLOSED for the declared-track case (2026-08-08).** A grid whose children
carry no explicit `grid-row`/`grid-column` — the single most common way CSS
authors write a grid — used to abandon promotion (`grid-promotion-fallback: …
auto-placed … (G5) is not promoted from the computed floor this round`) and
fall back to the flex-era path: a 2-D grid refused `grid-two-dimensional`, a
1-D grid lowered to a flex row/column from measured track counts.
`promoteGridLayout` (`extract/computed/anatomy.ts`) now derives each child's
cell from DOM order exactly as CSS row flow resolves it — row-major, sparse
cursor, spans shifting every later item (CSS Grid §8.5) — and then **declares**
the result two ways, both pinned by G5:

| the author declared… | what the contract carries | receipt |
|---|---|---|
| row tracks (`grid-template-rows`) | the declared `layout.rows` + the derived cells as EXPLICIT `Part.placement` anchors — `flow: "row"` is unavailable here because G5 omits `rows` under flow, so declaring it would DROP the author's row list | `grid-order-placement` |
| no row tracks | `layout.flow: "row"`, `rows` omitted, no anchors — every row of such a grid is implicit in CSS, and carrying Chromium's resolved implicit row list would write a declaration the author never made (P9); the emitter declares `ceil(children / columns)` explicit tracks itself on the canvas | `grid-flow-order-placement` |

**Measured**, in `conformance/BASELINE.json` (the two-sided ratchet: the fix
had to be re-recorded, it could not be absorbed): `grid-two-column`,
`grid-sidebar-px-fr`, `grid-track-fit-content`, `grid-tracks-mixed-fractional`
and `grid-auto-flow-row` all moved **WRONG-NAME → PASS**, and `grid-2d`
measured CARRIED — which is what released the **staged widen**: the frozen
spec subset moved `grid-2d` REFUSED → CARRIED as revision
`spec-conformance-subset-v0.1.1`, recorded with its evidence in
`spec/conformance/subset-v0.1.json`'s `changeLog` per `spec/README.md`'s
no-silent-widen rule. All 31 `grid-*` conformance cases are green.

**What is still refused, by name.** The derivation is fenced, not universal:

- **`grid-implicit-tracks` (P9)** — occupancy that leaves the declared track
  rectangle. Three shapes reach it: a derived cell beyond the declared rows or
  columns; a no-declared-rows grid whose `grid-auto-rows` SIZES the implicit
  rows (that size has nowhere to land once the contract omits `rows`); and a
  derivation whose occupied-row count disagrees with the resolved
  `grid-template-rows` (the browser materialized tracks the derivation does
  not predict). The canvas absorbs such overflow by rewriting the declaration
  (P9) — the contract refuses instead.
- **Half-auto and mixed children** — a child auto on one axis and explicit on
  the other (its cell is a function of the solver's per-axis cursor, not a
  declared fact), and a grid where some children place explicitly and others
  do not (G2 pins all-or-none; mixing is schema-invalid). Both ABANDON the
  promotion with a named receipt and take the flex-era fallback, exactly as
  before.
- **A column span wider than the declared column list** — CSS clamps it
  silently, the canvas throws (`Column span exceeds grid column count`, P3),
  so the contract refuses rather than carrying a clamped guess.

**The CANVAS→contract half — corrected 2026-08-23.** This entry used to say
`core/propose-figma.ts` never reads `DumpNode.grid`. That has been false since
2026-08-08 (`0161ef9f`): propose reads the dump's `layout.grid` block and
proposes `layout.grid` back, and every grid it cannot carry is a NAMED note.
The second sentence is also stale: the conformance fixture's canvas half is
MEASURED now, not declared — `npm run conformance:roundtrip`
(`conformance/canvas.ts`, fast lane) drives every CARRIED/LOWERED case
through the plugin engine, the mock canvas, the dump script and propose, and
reads the case's own channel back; 46 cases, 0 SILENT on a decrease-only
ratchet (2026-08-22). What is still fenced is exactly the list above
(`grid-implicit-tracks`, half-auto/mixed children, over-wide spans) — on both
directions, by name.

## B.23 Token prune does not see style-bound or cross-file consumers

**OPT-IN, default OFF (2026-08-22).** Token apply upserts the owned
collection(s) — the bundle `Tokens` collection, or first-party
Primitives / Brand / Semantic — and then looks for *leftovers*: variables in
those collections the bundle no longer names. What the Plugin API can see of
a leftover's consumers is bounded: scene-node bindings in THIS file
(`boundVariables`, fills, strokes), local variable aliases, and — with the
readers present — local paint / text / effect / grid STYLE bindings. It
cannot see instances in OTHER files consuming a published library's
variable, and a runtime that lacks any of the four style readers cannot
protect a style-bound variable at all. An earlier close of
`FC-APPLY-TOKENS-NOT-PRUNED` deleted such variables with no refusal; the
repo mock reproduced four style-only losses.

So the prune is a door, not a default: without `globalThis.DS_PRUNE_TOKENS
=== true` nothing is removed, and the leftovers are **named** in the step
result (`leftovers`, with `pruned` staying 0) and in the plugin's Build log.
With the flag on, node-bound, alias-target and style-bound leftovers stay; a
runtime missing a style reader skips the prune entirely and says why
(`pruneSkipped`). Cross-file consumers remain unprotected either way — turn
the flag on only in a file whose published variables you know are not
consumed elsewhere. Pin: `npm run token-set-prune:check` (three doors).

The sibling door, same date: a designer's edit to a variable **value** used
to be overwritten on every re-paste with no receipt. It is now named as
`variableDrift` in the step result and the Build log and KEPT, unless
`globalThis.DS_OVERWRITE_TOKENS = true` is set before the run
(2026-08-22, `46029a88`; pinned in the same check). Composite `$value`s that
used to land as the STRING `[object Object]` are refused by name at bundle
and plan time, and a Dark mode is added only when the bundle carries one
(the Starter-plan `addMode` refusal is named, not swallowed).

## B.24 The exam SLOT's interior auto-layout is not inverted — CLOSED, moved

*Closed 2026-08-23 (r11) — moved to
[§D.31](#d31-the-exam-slots-interior-auto-layout--closed) with its gates.
The two silences this section held before that (the Card Inline Image SLOT's
FIXED 308px width and its `fillHeight` under mixed parent modes) closed in
[§D.29](#d29-the-held-out-kits-last-two-silences-and-the-slots-primary-axis-fill--closed).
The native-SLOT branch of `buildPart` now walks `invertNodeTokens`,
`invertLayout` and `invertLayoutByProp` like every FRAME part, so a slot
drawn as a padded COLUMN with item spacing carries `layout.direction /
justify / align` and minted `gap` / `padding-*` on the slot part beside the
r10 `grow`; `exact-proposal:check` §49 pins the full layout object and §50
the interior facts; conformance cases `slot-interior-auto-layout` and
`rest-slot-interior-auto-layout` are CARRIED.*

## B.25 The REST route cannot name a variable binding without `file_variables:read`

The no-plugin route (`npm run extract:figma:rest -- <figma-url>`) reads
variable names and modes from `/v1/files/:key/variables/local`, which answers
only to a personal access token minted with the **`file_variables:read`**
scope. Without it every binding degrades to its resolved literal: on the
held-out kit that is 1,746 `variable-unresolved` receipts and **102
effect-binding receipts** (77 on the 15 exam sets) behind one scope, the
kit's 1,025 variables / 11 collections / six-mode Appearance never reach
`captured.dtcg.json` (not written), and every literal is the **Default**
mode of its collection with no mode recorded anywhere — the other modes are
indistinguishable from never having existed.

**What is closed** (2026-08-22, `0dc0811c`, `cda65c2b`; §D.24): the CLI no
longer calls this "Enterprise" 1,595 times — the 403 is classified once, at
file level, as a missing scope with its one-line fix, on stderr, in
`_provenance.variables`, as a `variables-unavailable` row in `_degradations`,
and again in `figma-proposals.md`; a 403 naming no scope and a network failure
are named as exactly that.

**What you'd observe** — proposals whose every token is a minted `imported.*`
literal, and no dark/brand/density mode on the code side.

**What it would take — nothing in the engine; a user action**: regenerate
the token with the scope. The route is then the plugin route's equal
(`rest-variables-captured` pins it). Until a kit is re-read with the scope,
its mode story is unmeasured, not absent.

## B.26 Card on the held-out kit is not recognisable — and every loss is named

The exam's five-cell render comparison after fix rounds 1–2: Button
recognisable (its fill carries), Badge at both sizes the same as Figma's own
render, Toast recognisable, **Card not**. The receipt's own list of what is
off, all of it named and none of it carried:

- the surface is a GLASS + BACKGROUND_BLUR effect stack over a near-transparent
  fill (`#00000001` as REST resolves it) — `[DROP_SHADOW, GLASS,
  BACKGROUND_BLUR] … channel NAMED, not proposed` (only a DROP_SHADOW stack
  has a contract spelling, §A.1);
- the image placeholder's vector glyph — `vector-geometry-unsupported`;
- the Content slot's drawn FRAME children (Title → Kicker + Heading, Footer →
  Chip + Button Group) — `design-time content that is not a bare INSTANCE … a
  FRAME child has no carrier and is NAMED`, so the Default story passes no
  content;
- the two silences that were §B.24 — CLOSED 2026-08-23 (§D.29); the slot's own
  auto-layout — CLOSED 2026-08-23 (§D.31): the Content slot's padded column
  and its gap now carry on the slot part.

**What you'd observe** — a near-white box holding one grey square where the
designer drew a card.

**What it would take — a schema addition** (blur/glass effects have no
vocabulary; a slot default that is a FRAME rather than an instance has no
carrier) **plus an engine change** for the slot content. Not scheduled; the
recognisability bar ("I can tell what this is") is the reason this row exists
rather than a score.

## B.27 The Flowbite eight carry no canvas anchor in the contract — CLOSED, moved

*Closed 2026-08-23 (r9 exam round 2). The eight contracts under
`examples/tailwind/contracts/` now spell `bindings.figma.anchors` as
`{ fileKey, nodeId, componentSetKey }`, each verified read-only against the
live demo file. The entry, its specHash caveat and its gates are
[§D.30](#d30-the-flowbite-eight-carried-no-canvas-anchor-in-the-contract--closed).
The number is kept so the files that cite §B.27 still resolve.*

## B.28 Two release-evidence commands from the 2026-08-22 audit — CLOSED, see §D.32

Both were raised as P1 by the 21-agent audit that preceded Phase 0 and both
named a row in [docs/26](26-v1-definition.md). Both were closed on
2026-08-23; the register entry [§D.32](#d32-the-two-acceptance-rows-that-were-red-on-the-commit-itself--closed)
carries what was actually wrong (not quite what this row said), the fix, and
the lanes that now pin each.

## B.29 polaris Tag no longer re-fuses offline: an ambiguous `width` on the link part — CLOSED, see §D.33

*Closed 2026-08-23 (r12). The refusal was real; the diagnosis in this row
("the fix is in fusion — which of the two spellings the mint should keep")
was half right: the promotion had already chosen (`literals.width =
"fit-content"`, G8), and the mint re-minted the channel because the door
that makes a stated channel bound territory did not see `width` at all. The
register entry [§D.33](#d33-polaris-tag-refused-to-re-fuse-the-mint-re-minted-a-channel-the-promotion-had-already-stated--closed)
carries the cause, the rule, the receipt and the re-recorded row. The number
is kept so the files that cite §B.29 still resolve.*

## B.30 `promote-floor` does not reproduce the committed polaris contracts

Found 2026-08-23 while re-running the documented polaris recipe
([examples/polaris/PROVENANCE.md](../examples/polaris/PROVENANCE.md)) on
`537022b0` to prove it byte-neutral. `npx tsx examples/polaris/scripts/promote-floor.ts`
rewrites 8 of the 12 committed contracts (avatar, button, checkbox,
progress-bar, radio-button, spinner, text-field, thumbnail) and the minted
tree; the diffs are hand-curated facts that live only in the committed
files, not in the authored-facts ledger the promoter reads — avatar's
`initials` default `"TP"` and `withInitials` default `true` (with the
receipt-citing descriptions that explain them) are the clearest. The
regenerate step then re-emits 20 figma scripts and the bundle from the
rewritten contracts. `generate.ts --check` is green on the committed tree
because it re-emits from the committed contracts; the promote step before
it is the one that does not round-trip. Not fixed here — the fix is to move
the curation into `ds-library.json`'s authored rows (or a receipt that says
the committed contract is post-promotion curated), and it owes a gate that
runs the promote step, not just the emit step. The tree was restored from
git after the measurement; nothing from that run is in this round's patch.

## B.31 `anatomy.root.attrs` bindings are not named on the canvas

Found 2026-08-23 while writing [docs/29 — How It Flows](29-how-it-flows.md)
(worked example E3). A contract prop bound to a root attribute —
`contracts/top-nav-item.contract.json` `href` with
`anatomy.root.attrs = {href: "{href}"}` — reaches the canvas only as the
**value** of an unbound TEXT component property (`Href`, default `#`, via
`textOnlyProps` in `core/emit-figma-script.ts`). The **binding** — "this
property is the root element's `href`" — is not a canvas field, and it is not
a code-only fact either: `grep -an 'part.attrs' core/emit-figma-script.ts`
(the file carries NUL bytes; grep needs `-a`) hits only the `placeholder`
attribute (`:3386`, `:3400`). On hop 4 the binding is never re-proposed; the
round-trip comparator files `element/attrs` under CANVAS-ABSENT
(`extract/figma/roundtrip.ts`), so the shipping round trip sees it, but a set
built by the plugin carries no receipt of it. **What you would observe:** a
designer reading the set cannot tell that `Href` is an attribute rather than
visible text. **What it would take:** one more `codeOnlyFacts` kind
(`attr`) emitted per bound attribute, and the same row in the proposal
notes when a TEXT definition with no text-node reference is met on hop 4 —
the BOOLEAN twin already has that branch (`FC-DUMP-PROPOSE-UNBOUND-BOOLEAN`);
the TEXT case is unverified by execution and is not claimed either way.

## B.32 A native checkable part compiles to no node, and is not receipted per contract

Same date, same source. `input[type=checkbox|radio]` parts are code
semantics — the presentational box and glyphs are the visual — so the canvas
emitter draws nothing for them (`isNativeCheckablePart`,
`packages/schema/src/contract-schema.ts`; the filter in
`core/emit-figma-script.ts`). That is the right lowering, and it is documented
in the emitter, but it is not a `codeOnlyFacts` row: the bundle, the plugin run
report and the set's `ds_contracts/codeOnlyFacts` stamp are all silent about
the part. **What you would observe:** Checkbox's and Radio's receipts read as
if every part crossed. **What it would take:** one `declared`-kind fact per
native checkable part with the reason the emitter already states in its
comment, and a pin in `core/code-only-facts-check.ts`.

## B.33 `semantics.roleException` is not stamped on the canvas, so a hop-4 proposal of a role-excepted component is refused by the referee

Found 2026-08-23 by the Playground walkthrough (`?tour=figma-to-code`,
"Stamped set" step) and pinned by `npm run playground:flow-check`. The
`ds_contracts/semantics` stamp a generated set carries holds `element` and
`role` only (`extract/figma/dump.plugin.js`, the dump v1.24 comment block);
`core/propose-figma.ts` does not carry a `roleException` (`grep -a
roleException core/propose-figma.ts` is empty). The Flowbite ToggleSwitch
contract declares `semantics.roleException` — a `<button role="switch">`
with no native checkbox in the DOM
(`examples/tailwind/contracts/toggleswitch.contract.json`). Proposed back
from `extract/figma/fixtures/flowbite-eight.dump.json`, the contract carries
`role: "switch"` on `element: "button"` and no exception, so the native-role
rule in `packages/core/src/validate.ts` refuses it: `semantics.role claims
role "switch" on element "button" — native <input type="checkbox"> (role="switch"
on it is the modern switch pattern) exists; use it or declare the exception
(semantics.roleException: "<one-sentence reason>")`. **What you would
observe:** `ds-contracts generate` on that proposal refuses by name; the
walkthrough shows the refusal under the editor rather than hiding it.
**What it would take:** stamp `roleException` (root and per-part) beside
`element`/`role` in the dump, and carry it through `proposeFromDump`; the
flow-check pin then fails and the tour copy is rewritten. The count of
affected contracts is not measured here.

---

# §C — THE MEASURED PRICE OF WHAT WORKS

*Everything in this part is a cost of a working pipeline, not a symptom of a
broken one. It is still a cost, and the numbers are not flattering. The
companion figures — what the same measurements say went right — are in
[24 — What Works](24-what-works.md).*

<a id="1-coverage--how-much-of-a-library-is-actually-captured"></a>

## B.34 State previews are all-or-nothing per set — one override-less state hides every drawn plane

**Found by the Ant Design exam** ([ANTD-EXAM.md](../parity/receipts/phase-2/ANTD-EXAM.md) §5).
`bindings.figma.statePreviews` is probed per contract by the promote referee
(`packages/cli/src/promote.ts` → `validateContract`), and a state that
declares no token override on any part refuses the flag for the WHOLE set.
antd's Button declares hover/active/focus-visible/disabled; its hover and
active planes are a `type × danger` product (S3 residue, named), so the
referee refuses previews — and the focus-visible ring and the disabled
plane, which DO carry, get no preview cell either. Same on Tag and Alert
(hover lives on the close icon) and on Checkbox/Radio (the focus ring lives
on the inner part, v13). 5 of the 7 stateful antd sets ship with no State
axis.

**What you'd observe** — a Button set with thirty base cells and no
focus/disabled row, while the contract carries both.

**Status of the loss** — NAMED, not silent: every state binding the undrawn
plane holds is a `channel`-kind code-only fact on the set
(`FC-STATE-PLANE-UNDRAWN`, 19 on the antd sets; the same receipt surfaced on
18 committed contracts across 8 libraries when it landed).

**What it would take** — a per-state probe: draw the states that have
overrides and name the ones that do not. Referee + emitter
(`stateVariants`) + prototype-wiring pairs; not started.

## B.35 The pseudo-decor grammar drops a decor's `box-shadow`, and the placeholder plane's ink

Two named residues the exam's heal loop pinned with screenshot pairs
(`parity/receipts/phase-2/antd/switch.triptych.png`, `input.triptych.png`):

- antd's Switch knob is `.ant-switch-handle::before` with
  `box-shadow: var(--ant-switch-handle-shadow)`. The decor grammar carries
  background alpha + border rings; the box promotes, the shadow does not —
  now receipted as `pseudo-decor-shadow-uncarried` beside the carriage
  (before this round a painting decor's shadow vanished with no receipt at
  all; the shadow refusal fired only when nothing else painted).
- `::placeholder` is read and never carried (§B.5); antd's Input draws its
  placeholder on the canvas in the root's text colour (`rgba(0,0,0,.88)`),
  not antd's `.25`. The TEXT is carried (the first TEXT-kind prop hosts the
  label when a root has no `children`); the colour is the named loss.

**What it would take** — a shadow channel on shape parts (the schema has
`box-shadow` on frames, not on decor shapes); a registry channel for the
placeholder plane's colour. Neither started.

## B.36 The held-out exam rendered five cells, not fifteen sets

The Phase 2 exam ([FIGMA-DS-EXAM.md](../parity/receipts/phase-2/FIGMA-DS-EXAM.md))
read 3,556 canvas facts off fifteen component sets, but the render comparison —
Figma's own `/v1/images` export beside the generated React component in
Chromium — was taken for five cells (Button, Badge ×2, Card, Toast), and those
five pairs lived in a scratch directory the receipt described as "not in the
patch". The recognisability verdicts for the other eleven sets (Button (Icon),
Button (contract), Chip, Dek, Heading, Image, Kicker, Button Group, Section
Header, Section Footer, Section) were never taken: the accounting counted
their facts; nobody looked at them.

**What is true now.** The five pairs are in the tree beside the receipt
(`parity/receipts/phase-2/figma-ds/*.canvas.png` / `*.react.png`), and
`npm run exam:screenshots:check` (fast lane) refuses any `*-EXAM.md` that
lists a set without a screenshot pair — unless the row says, in one fixed
sentence, that the pair was not captured and points here. Eleven rows of
FIGMA-DS-EXAM.md say exactly that. A named absence is counted and printed on
every run; it is not a pass.

**What it would take.** A re-render pass on the kit: REST images for every
set's default cell, the generated React for the same cells through the
existing Playwright harness, and the recognisability read per set. The REST
PAT the exam used lacks `file_variables:read` (§B.25), so the canvas side
would render with the same resolved literals the exam measured. Not scheduled
until the code→canvas half of the exam (the library TJ picks) is run, so both
halves can be captured on one tree.

---

## B.37 The corpus re-derivation drops CURATED contract facts, and nothing re-derives them

**The shape.** A contract in `examples/<lib>/contracts/` is not purely
derived. Most of it comes from fusion, but some facts are **curated on top**:
geometry pins for a variant the capture cannot resolve, a `display` restore
that makes a conditional part visible, a `declared.transform` on an icon, a
`tokens.width` binding, and the hand-written `description` that says why. The
engine cannot produce these — and a regeneration of the contract silently
replaces the curated file with the fusion output, taking them with it.

**Proven, not inferred.** `extract/computed/out/astryx/slider/enriched.contract.json`
— the FUSION OUTPUT — is byte-identical on `origin/main` and on this branch,
and NEITHER carries the `valueDisplay=tooltip -> display:flex` restore for the
Slider's tooltip part. `origin/main`'s committed CONTRACT does carry it. So the
rule is curation layered on fusion, the engine never emitted it, and the
re-derivation that produced this corpus (`cb13a56f`) dropped it.

**Measured, on this branch AFTER the four carry-backs below, against
`origin/main`.** 15 contracts still DROP a fact main carries:

| kind | facts still lost |
|---|---:|
| `tokens` | 33 |
| parts (renamed by the re-derivation — not counted as loss) | 20 |
| `literalsByProp` | 9 |
| `declared` | 5 |
| `literals` | 4 |
| `stylesWhen` | 0 |

Across astryx (7 contracts), polaris (4), fluent (2), carbon (1), shadcn (1).
Every `stylesWhen` loss is closed; the geometry and token bindings are not.

**Four facts were carried back, and only four** — the ones a gate names:
astryx Slider's tooltip `display:flex` restore and label-3's vertical pin
(`FC-ASTRYX-SLIDER-TOOLTIP`), polaris Spinner's `rotate(90deg)`
(`FC-SVG-ROTATION`), and polaris TextField's `connected.width` binding
(`FC-WIDTH-TOKEN`). The rest are still lost.

**Why the rest were NOT carried back — measured both ways.** A first attempt
restored all 47 and made the tree WORSE, and the suite said so by name:

- `promote-generalization` went red. `carbon/textinput.contract.json` is
  PROMOTE-REPRODUCIBLE — the shared promote module is its source of truth, so
  any curated addition stops it reproducing its own committed bytes. Curation
  is not permitted on that contract at all.
- the child-wider ratchet went red: astryx overflows 0 -> 3, all three the
  Slider's VERTICAL variants, `slider` painting 240px inside a 56px parent.
  main's `literalsByProp` numbers are pinned to MAIN's anatomy; on this
  corpus's re-derived anatomy the same numbers are a real defect.

That is the general rule and the reason this stays open: **a curated fact is
only true against the anatomy it was measured on.** Restoring them wholesale
is not a merge operation.

**What it would take.** A curation round on the re-derived corpus: for each of
the 16 contracts, decide per fact whether it still applies to the new anatomy,
re-measure the geometry ones against the current capture, and re-write the
descriptions. It is reviewed work, not a script. Until then the corpus carries
fusion truth and less curation than main's does.

---

## B.38 Three eval reds this branch measured and did not re-record green

The suite is 230 cases. These three are red on the recorded run, and each one
is a gate working correctly on a fact nobody has closed.

**`astryx-reanchor-minted` — an owner-acked refusal whose premise is now false.**
`examples/astryx/tokens/reanchor-decisions.json` carries an acked no-match row
`RA-nomatch-0536591a` for `imported.badge.root.background-color.neutral`. The
ack's whole argument is an ALPHA-SERIALISATION near-miss: the source declares
`colorVars['--color-neutral']` = `rgba(5, 54, 89, 0.1)` and the capture
serialised `#0536591A`, so the value join refuses near-miss equality BY DESIGN
and no honest candidate row can be written. **That argument no longer
describes the leaf.** The value is now `#e5e5e5` — an opaque light grey, not a
translucent dark blue, and not an alpha near-miss of one. The guard refuses
rather than reusing the stale ack, which is correct. Re-acking it here would
launder a falsified premise, and the ack note already reads "flagged for owner
review".

Worth recording, because it inverts the obvious reading: the CAPTURE says
`rgba(229, 229, 229, 1)` on `origin/main` AND here — identical bytes. So
main's minted `#0536591a` is the stale value and this corpus's `#e5e5e5` is
faithful to what the browser rendered. The open question is a real one about
the library: astryx Badge's neutral background does not render as the token
its own source names.

**`minted-leaves-bind-to-something` — the decrease-only ratchet, refused.**
Two libraries grew variables that nothing binds:

| library | baseline | measured | leaves shipped |
|---|---:|---:|---:|
| astryx | 8 | **21** | 565 |
| carbon | 92 | **94** | 879 |

astryx's 21 are badge 10, text-input 3, card 2, checkbox-input 2, switch 2,
button 1, shared 1. carbon's 94 are icon-button 72, text-input 5, checkbox 4,
tabs 4, toggle 4, accordion 2, inline-notification 2, shared 1. The ratchet may
only DECREASE, and re-recording an increase is exactly the move this project
has spent the session refusing — the burn-down already declined to re-record
carbon 92 -> 94 and left it red. Nothing here changes that.

**`console-loop-canvas-drift-probe` — the LIVE canvas is stale, not the code.**
The probe reads `parity/receipts/console-loop/astryx/canvas-drift/LIVE-SNAPSHOT.json`
— a snapshot of the real Figma file, **minted 2026-08-09** — against each
stem's committed emit script. The scripts moved (this corpus re-derived them,
and this branch re-emitted them); the live canvas has not been re-applied
since. Measured: **3 in-sync, 10 DRIFT** of 13 stems, and the drift classes are
what a stale canvas looks like — BINDING-DRIFT on banner/button/progress-bar/
slider/text-input/token (the spec binds a variable, the live cell holds a
literal), VALUE-DRIFT on checkbox-input and switch, FC-FONT-STYLE-UNRESOLVED on
card and toast.

Closing it needs someone to run the emit scripts against the live Figma file
and re-mint the snapshot — a live-file operation with a PAT, not something a
branch can do. The probe is doing its job: it is the only instrument that asks
whether the live cell is the product of this lane's own committed script.

All three are now carried in `parity/receipts/v1/eval-reds.json` with a cause
and a **closing condition stated as a checkable event** — the ledger #68 added,
which lets a red suite ship only when every red is named. An unnamed red still
refuses, and a row whose eval has gone green refuses as stale.

---

## B.39 antd's STRUCTURAL re-derivation has never been verified, on any machine

`corpus:reproducible:check` has two halves. The **promote** half re-derives each
library's committed artifacts from its committed capture record; the
**structural** half re-derives the capture record itself from the library's seed
+ config + sandbox. For antd the second half has never run:

```
· antd: capture PENDING — the measuring run captured nothing for antd —
  examples/antd/.antd-sandbox is git-ignored and this machine does not carry it
  (examples/antd/PROVENANCE.md has the recreate block).
  NOT measured, never counted as reproducing.
```

**It is PENDING in CI and PENDING locally, for the same reason** — the sandbox
is git-ignored, so neither the runner nor a developer checkout has it. This is
not a red and not a pass: the gate refuses to count it either way, which is the
right behaviour and also why it is easy to stop seeing. Every other captured
library reports a real fraction (`altitude 5/8`, `carbon 8/10`, `mui 28/31`,
`fluent|polaris|shadcn|tailwind` all n/n).

**What is and is not known.** antd's promote half IS measured and green — its 37
committed artifacts re-derive from the committed capture record. What has never
been checked is whether that *capture record* can be regenerated from the
library at all. So antd's contracts are reproducible from a record whose own
provenance is unverified.

**What it would take.** Recreate the sandbox from
`examples/antd/PROVENANCE.md`'s block on a machine that then runs
`corpus:reproducible:check`, and either record the fraction or name what stops
it. Making it a CI-visible number means either committing the sandbox (large,
and the reason it is ignored) or a lane step that installs the pinned package
before the check — neither has been scheduled.

## C.1 Coverage — how much of a library is actually captured

Seven distinct libraries across eight rounds, five styling architectures, one
pipeline, with engine-change cost per library trending toward zero
([docs/22 §1–§5](22-generality.md)). That claim is about the *engine* and the
evidence supports it. **It is not a claim that your library can be captured.**

### C.1.1 Which component archetypes are proven — the actionable cut

> **This table is the capture path.** `ATTEMPTED — BOUNDED` for
> select/combobox and table/data-grid, and the “date picker appears in
> zero committed contracts” sentence later in this section, describe
> `extract --computed` / committed `contracts/`. On the **recipe-IR**
> path, Combobox (`163:35981`), Table (`173:48924`), and Calendar
> (`181:64873`) have stayed live mints and owner-signed grades. That
> does not move these rows, and it does not make product v1 complete
> (F1 unmet). See [docs/26 V1-CLASS-03](26-v1-definition.md) and
> [docs/32 §E4](32-recipe-ir-pivot.md#e4-applied-2026-08-30).

A single "6.9%" answers the wrong question. The question an adopter actually
has is *"has this tool ever done the kind of component I need?"* Every row
below maps to committed contract **files**, so each claim is greppable; every
fidelity figure is `committedPctEqual` read from
`extract/computed/regate-baseline.json`. **"Median" means the upper of the two
middle values on an even count** — the conservative choice, stated so the
number can be re-derived.

| archetype | status | libraries | contracts | pinned | median fidelity | range |
|---|---|---|---|---|---|---|
| **button** | **PROVEN** | 6 | 8 | 8 | **90.8%** | 79.0–100.0% |
| **badge / tag / chip** | **PROVEN** | 6 | 9 | 8 | **93.8%** | 80.5–100.0% |
| **checkbox / radio** | **PROVEN** | 4 | 5 | 4 | **81.3%** | 72.5–84.3% |
| **toggle / switch** | **PROVEN** | 4 | 4 | 4 | **84.3%** | 77.3–88.9% |
| **banner / alert / toast** | **PROVEN** | 4 | 5 | 3 | **97.0%** | 84.5–97.1% |
| **input / field** | **PROVEN** | 3 | 3 | 2 | **89.0%** | 82.0–89.0% |
| **card** | **PROVEN** | 3 | 3 | 3 | **98.6%** | 72.4–100.0% |
| **avatar** | **PROVEN** | 2 | 2 | 2 | **81.7%** | 69.8–81.7% |
| **tabs** | **PROVEN** | 2 | 2 | 2 | **93.8%** | 93.2–93.8% |
| **accordion** | **PROVEN** | 2 | 2 | 2 | **91.8%** | 77.6–91.8% |
| **progress / spinner** | **PROVEN** | 2 | 3 | 2 | **100.0%** | 92.1–100.0% |
| **slider** | **PROVEN** | 2 | 2 | 2 | **90.4%** | 89.4–90.4% |
| select / combobox | ATTEMPTED — BOUNDED | 1 | 1 | 1 | 95.1% | — |
| modal / dialog | ATTEMPTED — BOUNDED | 2 | 2 | 2 | 95.4% | 90.0–95.4% |
| tooltip / popover | ATTEMPTED — BOUNDED | 1 | 1 | 1 | 90.7% | — |
| menu / dropdown | ATTEMPTED — BOUNDED | 2 | 3 | 1 | 94.2% | — |
| pagination | ATTEMPTED — BOUNDED | 1 | 1 | 1 | 94.0% | — |
| table / data-grid | ATTEMPTED — BOUNDED | 1 | 1 | 1 | 85.2% | — |
| **breadcrumb** | **NEVER ATTEMPTED** | 0 | 0 | 0 | — | — |
| **nav (top / side)** | **NEVER ATTEMPTED** | 0 | 0 | 0 | — | — |

**Five of the 62 contracts map to no archetype above** and are not hidden:
`altitude/divider`, `altitude/heading`, `altitude/iconclose`, `polaris/text`,
`polaris/thumbnail` — typography, rules, glyphs and images rather than
component archetypes. 57 contracts and 49 of the 54 drift rows are in the
table.

**ATTEMPTED — BOUNDED means the scope of the capture was cut, by name, before
the number was taken.** The bounds, cited:

- **select / combobox** — MUI's Autocomplete is *captured CLOSED*: `open:true`
  would portal the listbox, so no option list is in the captured truth.
- **modal / dialog, tooltip / popover, menu / dropdown** — all four overlay
  contracts carry `states: []` (§B.2) and **zero** source-token facts (§B.1).
  The pixel rows for Dialog, Menu and Tooltip are pinned at 100 rather than
  scored (§C.6.6), so no pixel number is quoted for them anywhere.
- **table / data-grid** — MUI's `Table` is the hardest thing in the corpus and
  every cut is greppable in `examples/mui/PROVENANCE.md`: `stickyHeader`
  excluded by name (`position: sticky` has no carried spelling, §A.1), the row
  overflow menu captured **closed**, `TableSortLabel` carrying `direction="asc"`
  only, the active sort arrow's 180° rotation not carried, two body rows rather
  than three, `TablePagination`'s rows-per-page Select pinned controlled-closed
  and its paging arrows force-disabled (so the *enabled* arrow colours are
  unobservable and absent from the captured truth). Carbon's own `DataTable` is
  listed as deferred — "the organism, a round of its own".

**Whole component classes are captured nowhere.** Data grid, tree, virtualized
list, date picker, rich text and charts appear in **zero** committed contracts
across all six foreign libraries. This repo's own 51 contracts *do* include a
`table` / `table-row` / `table-cell` family
([docs/09](09-advanced-components.md)) — but those are hand-authored here, not
captured from a foreign library, and they are not evidence that a foreign data
grid can be captured.

**What you'd observe** — if the component you most want on the canvas is your
data grid, this tool has never done it.

### C.1.2 THE CAPTURED SLICE IS NOT RANDOM, AND THAT BIASES EVERY AVERAGE UPWARD

**Components were chosen because they were tractable.** The 54 drift rows are
Button, Badge, Chip, Card, Checkbox, Tag, Avatar, Divider and their siblings.
**Read every floor percentage in this repository as "on the easy slice."**

This is the most important sentence in the document and it survives every
denominator argument below. Whichever denominator you prefer — 6.9%, 11.7% or
12.6% — the slice behind the numerator is the same hand-picked, tractable one,
and the correction changes the *fraction*, never the *bias*.

### C.1.3 The per-library fraction, with both denominators

The published fraction, from
[docs/22 §8.3](22-generality.md#83-the-coverage-fraction--how-much-of-each-library-is-actually-captured),
re-derived byte-exact today with that section's own whitelisted command
(62 contracts / 54 drift rows; altitude 8, astryx 13, carbon 10, mui 14,
polaris 12, tailwind 5):

| library | contracts committed | pinned by the drift instrument | library size | **coverage** |
|---|---|---|---|---|
| Carbon (`@carbon/react@1.112.0`) | 10 | 10 | 243 | **4.1%** |
| Astryx (`@astryxdesign/core@0.1.6`) | 13 | **5** | 222 | **5.9%** |
| Polaris (`@shopify/polaris@13.9.5`) | 12 | 12 | 180 | **6.7%** |
| MUI (`@mui/material@9.2.0`) | 14 | 14 | 135 | **10.4%** |
| Flowbite / Tailwind (`flowbite-react@0.12.17`) | 5 | 5 | 46 | **10.9%** |
| Altitude (`altitude-web-components@1.0.2`) | 8 | 8 | 67 | **11.9%** |
| **total** | **62** | **54** | **893** | **6.9%** |

**That total is not conservative. It is incoherent, and the incoherence is a
defect in the table rather than a safety margin.** The numerator is
FAMILY-level everywhere — one contract per component family. Four of the six
denominators are PART-level: anatomy sub-parts counted as whole components.
Two of the six were measured against a **GitHub clone at a SHA, not the package
the capture actually ran against**, and those name lists are not in this repo,
so no exclusion rule can even be applied to them.

Mechanical proof of the unit defect, from a committed artifact. Astryx's 222
extracted names live in exactly **98 source directories, 97 of which are public
subpath exports**, and `Table` alone contributes **29 of the 222** — a component
captured in **zero** libraries inflates Astryx's denominator by more than twice
that library's entire numerator (13):

```bash
# examples/astryx/out/ and .astryx-sandbox/ are gitignored (not tracked): recreate the
# sandbox per examples/astryx/PROVENANCE.md, then `npm run extract:code -- examples/astryx/extract.config.json`
node -e "const ext=require('./examples/astryx/out/code-extraction.json');
const pkg=require('./examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/package.json');
const subs=new Set(Object.keys(pkg.exports).filter(k=>/^\.\/[A-Z][^/]*\$/.test(k)).map(k=>k.slice(2)));
const f=new Map();for(const e of ext){const d=e.source.match(/\/src\/([^/]+)\//)[1];f.set(d,(f.get(d)||0)+1)}
console.log(f.size,[...f.keys()].filter(d=>subs.has(d)).length,f.get('Table'))"   # → 98 97 29
```

#### The exclusion rule, stated precisely

A named export / component directory is EXCLUDED from the filtered denominator
if and only if it falls in one of seven clauses. Every excluded name is listed
below so you can disagree with any single one and re-add it:

| clause | rule |
|---|---|
| **X1** | BEHAVIOUR-ONLY wrapper — renders its children, paints nothing of its own |
| **X2** | PROVIDER / CONTEXT object / theme-config plumbing |
| **X3** | TRANSITION / ANIMATION primitive — applies motion to a child, has no appearance |
| **X4** | TYPE-ONLY or constant-only export — no runtime component |
| **X5** | ALTERNATE-BUILD-TARGET or DEPRECATED ALIAS of a component already counted |
| **X6** | UNSTYLED UTILITY — ships behaviour, carries no design-system appearance |
| **X7** | BARREL / BUNDLE aggregate — not a component |

Anatomy sub-parts (`AccordionSummary`, `CardContent`, `TableCell`,
`HelperText`, …) are **NOT excluded** — they stay in the part-level column.
Layout primitives (`Box`, `Stack`, `Grid`, `Container`) are **NOT excluded** —
this repo's own 51 contracts include `stack` and `section`, so calling them
non-components would be self-serving. The script **throws** if an exclusion
name is not present in the measured set, so the rule cannot drift away from the
data.

#### The table, both denominators side by side

| library | contracts | published denominator | unit | auditable from a clone? | **published coverage** | filtered denominator | **filtered coverage** | names removed |
|---|---|---|---|---|---|---|---|---|
| MUI (`@mui/material@9.2.0`) | 14 | 135 | PART | yes | **10.4%** | **116** | **12.1%** | 19 |
| Flowbite (`flowbite-react@0.12.17`) | 5 | 46 | FAMILY | yes | **10.9%** | **45** | **11.1%** | 1 |
| Altitude (`altitude-web-components@1.0.2`) | 8 | 67 | FAMILY | yes | **11.9%** | **64** | **12.5%** | 3 |
| Polaris (`@shopify/polaris@13.9.5`) | 12 | 180 | PART | **NO** — GitHub clone `Shopify/polaris@2b1ea88`, name list not in this repo | **6.7%** | **98** *(substitute set: the captured package's own `build/esm/components`, 121 dirs)* | **12.2%** | 23 |
| Carbon (`@carbon/react@1.112.0`) | 10 | 243 | PART | **NO** — GitHub clone `carbon-design-system/carbon@bc66fc71`, name list not in this repo | **4.1%** | **110** *(substitute set: the captured package's own `es/components`, 122 dirs)* | **9.1%** | 12 |
| Astryx (`@astryxdesign/core@0.1.6`) | 13 | 222 | PART | yes (`examples/astryx/out/code-extraction.json` — a gitignored extraction output, not tracked; regenerate it with `npm run extract:code -- examples/astryx/extract.config.json` over the sandbox in `examples/astryx/PROVENANCE.md`) | **5.9%** | **96** *(the package's own capitalised subpath exports, 99)* | **13.5%** | 3 |
| **total** | **62** | **893** | mixed | — | **6.9%** | **529** | **11.7%** |  |
| *unweighted mean of the six rows* |  |  |  |  | *8.3%* |  | *11.8%* |  |

**What changed and what did not.** The 4.1% that reads as "what a terrible job
that did" is **9.1%** once (a) the artifact measured is the package the capture
actually ran against rather than a GitHub clone of a different tree, and (b) 12
providers / behaviour-wrappers / deprecated aliases come out. Nothing was
rounded in our favour and **no number above replaces a published one** —
§8.3's column stays in the table, and in docs/22.

**The Polaris and Carbon rows are a substitution, not a filtering, and are
labelled that way.** Their published denominators come from a clone whose
extraction output is not committed, so the exclusion rule literally cannot be
applied to them. What is offered beside them is the same measurement taken
against the pinned sandbox — the artifact every capture, every scorecard and
every drift row in this repo was measured against. That is a *better*
denominator for exactly the reason the Altitude round proved (capturing the
published artifact is what made `al-toggle`'s purgecss defect visible), but it
is a different measurement and saying so is the point.

#### Every excluded name, by clause

```
MUI (19 of 135)
  X1 ClickAwayListener, NoSsr, Portal, Unstable_TrapFocus
  X2 CssBaseline, ScopedCssBaseline, GlobalStyles, DefaultPropsProvider, InitColorSchemeScript
  X3 Collapse, Fade, Grow, Slide, Zoom
  X4 OverridableComponent
  X5 PigmentContainer, PigmentGrid, PigmentStack
  X6 TextareaAutosize
Flowbite (1 of 46)
  X7 Floating            (the only dist/components directory index.js never exports)
Altitude (3 of 67)
  X1 focus-trap          X2 theme            X7 bundle
  (PROVENANCE already called bundle/focus-trap "not components"; `theme` is a 188-byte
   entry that registers no custom element — mechanically confirmed)
Carbon (12 of 122)
  X1 ErrorBoundary, Portal
  X2 ClassPrefix, FeatureFlags, IdPrefix, LayoutDirection, Theme
  X5 DangerButton, PrimaryButton, SecondaryButton, OverflowMenuV2, ToggleSmall
Polaris (23 of 121)
  X1 AfterInitialMount, EventListener, KeypressListener, Focus, TrapFocus, Portal,
     ScrollLock, Sticky, PositionedOverlay
  X2 AppProvider, MediaQueryProvider, ThemeProvider, PolarisTestProvider, IndexProvider,
     FilterActionsProvider, PortalsManager, EphemeralPresenceManager, FocusManager
  X3 Collapsible
  X5 LegacyCard, LegacyFilters, LegacyStack, LegacyTabs
Astryx (3 of 99)
  X2 SizeContext, InteractiveRoleContext, Layer
  (SizeContext and InteractiveRoleContext are the only two public subpaths from which the
   extractor found NO component at all — an independent confirmation of the same call)
```

#### Cross-check: an independent, library-native rule lands on the same MUI number

MUI emits a `<name>Classes` descriptor module only for components with styled
slots. Filtering on **that** signal alone — no judgement — also excludes exactly
**19** of 135, i.e. 116. The two sets differ by two names in each direction (the
classes rule keeps `Collapse` and `ScopedCssBaseline`, drops `MenuList` and
`SwipeableDrawer`, both of which reuse a sibling's classes). Two independent
rules, same count:

```bash
# examples/mui/.mui-sandbox is the gitignored install sandbox (not tracked): recreate it per examples/mui/PROVENANCE.md
node -e "const fs=require('fs');const d='examples/mui/.mui-sandbox/node_modules/@mui/material';
const dirs=fs.readdirSync(d,{withFileTypes:true}).filter(e=>e.isDirectory()&&/^[A-Z]/.test(e.name)).map(e=>e.name);
const no=dirs.filter(n=>!fs.readdirSync(d+'/'+n).includes(n[0].toLowerCase()+n.slice(1)+'Classes.js'));
console.log(dirs.length-no.length, no.length)"   # → 116 19
```

### C.1.4 The like-for-like view — the only column where numerator and denominator are the same kind of thing

The filtered column still mixes units: MUI's 116 counts anatomy sub-parts, the
other five count families. Since the numerator is family-level everywhere, this
is the corrected comparison.

MUI's 116 filtered parts collapse to **62 families** under a mechanical rule (a
name is a sub-part when another kept name is a prefix of it *and* the remainder
starts with an uppercase letter — the plain-prefix rule mis-folds `Table→Tab`
and `Tabs→Tab`; the boundary rule does not). 54 names fold. **One fold the rule
still gets wrong, named rather than patched: `IconButton→Icon`.** Counted
separately the denominator is 63 and the row is 14/63 = 22.2%; the table
publishes the conservative 21.0%.

| library | numerator (families) | denominator (families, filtered) | **coverage** |
|---|---|---|---|
| MUI | 13 *(table + table-pagination are both the Table family)* | 62 | **21.0%** |
| Flowbite | 5 | 45 | **11.1%** |
| Altitude | 8 *(iconclose is `al-icon-close`, defined at `components/icon/icons/close.js` — the `icon` family)* | 64 | **12.5%** |
| Polaris | 12 | 98 | **12.2%** |
| Carbon | 10 *(inlinenotification lives in the `Notification` directory)* | 110 | **9.1%** |
| Astryx | 12 *(dropdown-menu + dropdown-menu-item are both the DropdownMenu family)* | 96 | **12.5%** |
| **total** | **60** | **475** | **12.6%** |

**The finding.** Corrected for unit and for non-components, coverage is not a
4%-to-12% spread with an embarrassing floor. It is a **9%–21% band whose floor
is Carbon at 9.1%**, and it is remarkably uniform across six vendors and five
styling architectures. That uniformity is itself evidence for the
engine-generality claim: how much of a library one hand-configured round
reaches does not depend much on which library it is.

**Every statement that survives unchanged:** nobody has taken a library past
~21%; the slice was hand-picked for tractability (§C.1.2); the next honest step
is one library taken to 50%. None of those depend on which denominator you use.

### C.1.5 "A primitives-layer tool" is a HYPOTHESIS UNDER TEST, not a scope decision

It is tempting to read §C.1.1 — twelve proven primitives, two never-attempted
navigation archetypes, no data grid anywhere — and conclude that this is a
primitives-layer tool by design. **That conclusion is not supported by anything
measured here, and this document declines to make it.**

What is measured is that a hand-configured round reaches roughly a tenth to a
fifth of a library, and that the components inside that fraction were chosen
for tractability. Whether the remaining four-fifths are reachable at the same
cost, at a higher cost, or not at all, is **unknown** — nobody has run the
experiment. Declaring "primitives layer" now would convert an untested limit
into a product boundary, which is the most flattering possible reading of a gap.

**The experiment that would settle it is named and not started: one library
taken to 50%** ([docs/22 §8.3](22-generality.md)). It is the next honest step
precisely because it is the only thing that can distinguish "the tool stops at
primitives" from "we stopped at primitives." Until it runs, treat the scope of
this tool as *unmeasured past the fraction in §C.1.3*.

## C.2 The canvas→code round trip is measured, and it is not lossless

"The round trip closed" means the loop **ran to completion**, not that it was
faithful — the two claims were conflated once in this repo's own reporting,
so this section states the measured numbers plainly. On Untitled UI, a real
community kit this project does not own, all **15 sets that were run closed
the round trip** (canvas dump → contract → the plugin engine's Generate path
→ re-dump → set-level fact diff), and the totals across them are:

> **11400 matched, 1857 diverged, 7671 one-way loss, 15359 invented**

Quoted byte-exact from `extract/figma/roundtrip-uui/REPORT.md:25` — "loss" is
in the original and not the round trip; "invented" is in the round trip and
not the original. **No
preservation percentage is quoted here on purpose.** Depending on which
denominator you pick the same four numbers yield very different headlines, and
this repo has already published one number ("92.5%") that a later audit
replaced with another ("64.5%") for exactly that reason. The four counts are
the fact; a ratio over them is an argument.

Two qualifiers, one in each direction
([the full report](../extract/figma/roundtrip-uui/REPORT.md)):

- **934 of the 954 `layout.mode` divergences are `auto-layout-inert`** — a
  frame drawn with *no* auto-layout comes back *with* one, but every child is
  absolutely placed (or there are no children), and Figma auto-layout excludes
  absolutely-positioned children — so the tree differs while the drawing does
  not.
- **The remaining 20 are a REAL axis flip** — `VERTICAL → HORIZONTAL`, all on
  one part (`slider ▸ progress/leftcontrol/tooltip`), which the dump draws
  VERTICAL in the floating-label variants while the contract carries no layout
  for that part at all. Reported undifferentiated, the 934 inert rows buried
  these 20 real ones — which is why the classes are now separated
  (`auto-layout-inert` is its own tag in `report.json`; per-tag table in
  [docs/24 §6.3](24-what-works.md)).

The loss and invention columns are dominated by named structural classes
(`restructured`, `text-style-identity`), itemised per set in the report and
per tag in [docs/24 §6.3](24-what-works.md). Read the totals as the honest
price of "reviewable starting point" in path A.

## C.3 The refusal ledger

Refusing is a feature, and it has a price: a refused fact is a fact that is not
on your canvas. The counts are the honest way to see both halves at once.

| vocabulary | cases | disposition | source |
|---|---|---|---|
| CSS / DOM frontier | 82 | CARRIED 42 · LOWERED 4 · REFUSED 18 · UNSUPPORTED 18 (79 pass · 3 red) | `conformance/MANIFEST.json` (`npm run conformance`, 2026-08-23) |
| canvas round trip of the CARRIED/LOWERED cases | 46 | ROUND-TRIPPED 26 · NAMED 5 · REFUSED-BY-NAME 15 · **SILENT 0** | `conformance/CANVAS-EXPECTATIONS.md` (`npm run conformance:roundtrip`) |
| canvas constructs | 157 | CARRIED 110 · LEDGERED 38 · REFUSED 9 (157 PASS · 0 RED-EXPECTED — the last two exam silences closed 2026-08-23, §D.29; the slot's interior layout the same day, §D.31) | `extract/figma/conformance/MANIFEST.json` (`npm run conformance:canvas`) |
| dropped-fact receipts (`†`) and the facts they name | 104 receipts · 2,321 named facts | pinned exactly, in both directions; since 2026-08-22 every `†` carries its facts by part, channel, value and reason (`codeOnlyFacts`) | `extract/figma/dagger-census.json` (`npm run dagger:census`, `code-only-facts:check`) |

**REFUSED and UNSUPPORTED are different facts** and the fixture counts them
separately on purpose. A refusal appears in a receipt you can grep. An
UNSUPPORTED declaration means the reader **never looked** — no artifact is
produced at all, and the only thing standing between it and silent rot is
conformance's decrease-only ratchet (§B.5).

The named refusals with a visible canvas cost are enumerated in
[§A.1](#a1-css-constructs-with-no-canvas-spelling) (no canvas spelling exists)
and [§B.4](#b4-two-axis-geometry-and-paint-products-have-no-spelling) /
[§B.5](#b5-four-pseudo-element-channels-the-reader-has-never-opened) (a
spelling could exist and does not).

## C.4 The three ceilings

Three reader limits in one file, each discovered separately, each now counted.
The first two are open; the third's *instrument* is closed and its *corpus* is
not (§B.17).

### C.4.1 The shorthand ceiling

The CSS-variables source reader carries **longhand facts only**. A `var()`
reference inside a shorthand (`font`, `background`, `border-radius`, `padding`,
`gap`, `transition`, `border`, `outline`) is not read.

Re-derived today by summing `shorthandSkips` across the 102 committed
`source-bindings.json` artifacts:

| library | shorthand references dropped |
|---|---|
| Polaris | **21** (banner 6, avatar 3, button 2, badge 2, checkbox 2, progress-bar 2, tag 1, radio-button 1, spinner 1, thumbnail 1) |
| Altitude | **16** (heading 6, badge 4, chip 3, link 3) |
| Tailwind / Flowbite | **16** (alert 4, badge 4, card 4, button 3, toggle-switch 1) |
| Carbon | **14** (accordion 5, inline-notification 5, button 1, icon-button 1, tabs 1, tag 1) |
| MUI | **2** (button 1, accordion 1) |
| Astryx | **not measured** — `extract/computed/configs/astryx.json`'s `library` block declares `[package, version, framework, classPrefix, classAllow]` and **no `varPrefix`**, so the reader never runs and no `source-bindings.json` is written at all. *Not measured is not the same as zero.* |

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

### C.4.2 The calc ceiling

The earlier sibling of the same class, in the same file, with its own comment
saying so. A `var()` inside a `calc()` expression is not resolved to a leaf.

### C.4.3 The stylesheet ceiling

A cross-origin `<link>` stylesheet **throws on `.cssRules`**. This was the third
instance of the class in one file, and it is now a counted, href-named ceiling
(`stylesheetCeiling` / `stylesheetSkips`) — see
[§D.6](#d6-a-cross-origin-stylesheet-vanished-in-silence--closed) for the closure and
[§B.17](#b17-the-corpus-has-not-been-re-captured-through-the-stylesheet-ceiling-instrument)
for why the committed corpus does not yet demonstrate it.

## C.5 Webfonts load only where a library's capture config declares them

The capture harness is network-free, and **by default no webfonts load**:
Carbon's `styles.css` carries 105 `@font-face` blocks whose every `src` is an
Akamai CDN URL (`examples/carbon/PROVENANCE.md:168`); Altitude's published
dist contains zero `@font-face` blocks at all — its face arrives via a
Google-Fonts `@import` the harness strips for hermeticity.

Since 2026-08-08 a capture config may declare a **`fonts` field**
(`extract/computed/capture.ts`): each face names a font file from a
**committed or sandboxed source**, inlined into every render this config
drives (capture page, portal page, fidelity-gate page) as a base64 `data:`
URI — still zero network at render or check time, and a declared file that
does not exist is refused by name. Same font files + same pinned Chromium →
same rasters on the recording platform. A guessed face (a system-stack
library with no webfont of its own) must carry a `"__review:fonts"` marker
and never renders a reference until acked.

Configured today: **Altitude** loads IBM Plex Sans 400/600 (the library's own
Google-Fonts declaration; woff2 committed under `extract/computed/fonts/`
from `@ibm/plex-sans@1.1.0`) — that re-pin converted altitude chip and link
to genuine scored passes on both instruments. **MUI** loads Roboto 400/500/700
(its `createTypography` defaults; woff2 committed under
`extract/computed/fonts/roboto/` from `@fontsource/roboto@5.3.0`, exact-pinned
in its sandbox) — that re-pin converted mui chip (6.47 → 1.18 on both
instruments) and exposed an instrument subtlety: the recording machine's only
locally installed Roboto face is Roboto-**Thin**, so the unconfigured refs had
rendered Thin glyphs, not the Helvetica fallback — a wrong *local* face is the
same defect class as a wrong fallback, and only the committed `data:`-URI face
pins it. **Astryx** loads Figtree 400/500/600/700 (`@fontsource/figtree@5.3.0`
pinned in its sandbox, faces under `extract/computed/fonts/figtree/`) — but the
face alone was not its defect: theme-neutral scopes every token under
`@scope ([data-astryx-theme="neutral"])` and the old capture mount never
rendered the `<Theme>` provider, so no theme token resolved and Button's
captured font-family was literal `Times`; the mount now wraps
`<Theme theme={neutralTheme}>` (the library's documented setup) and the
recaptured truth carries Figtree. **Everywhere unconfigured the
fallback-font behavior below remains**: Tailwind/Flowbite ships no
library-true font file (its stack IS the platform system stack), Carbon's
Plex faces are obtainable (`@ibm/plex-sans` in its sandbox) but not yet
configured, so its references are unmoved.

(`document.fonts.check` returns `true` for fonts that are certainly not
installed — it reports "can this be rendered", which fallback always satisfies.
It proves nothing. The `fonts` field does not rely on it: the bytes ride the
page and `document.fonts.ready` is awaited.)

**What you'd observe where unconfigured** — **pixel anti-aliasing scores are 0
essentially everywhere** in the receipts, and absolute text widths in the
contracts are fallback-font widths. Both sides of the fidelity gate degrade
identically, so the *percentages* are unaffected; the *absolute widths* are
not (see §B.3).

## C.6 Instruments — what the gates do and do not measure

A green gate is a claim about a denominator. These are the denominators.

### C.6.1 Refusing something cannot lower a score

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

### C.6.2 The conformance fixture measures the contract, not the canvas

The fixture ([conformance/EXPECTATIONS.md](../conformance/EXPECTATIONS.md)) is
the one instrument here whose denominator is **hand-authored independently** of
the engine, so a construct that is neither carried nor named-refused is a hard
failure rather than an absence. It stands today at **53 cases — 50 green,
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

**A green gate here would mean the cases are too easy.** The three reds are
[§B.8](#b8-two-constructs-the-engine-carries-that-it-should-not).

### C.6.3 The drift instrument is not part of the eval suite

54 rows across 6 libraries pin `pctEqual` within tolerance, `cellsCompared`
exactly, `unresolvedTokenRefs` exactly, and hard-fail if a component stops
fusing. It renders a real headless Chromium per component (~8–20s each, ~5–6
minutes total), so it is an **on-demand script** rather than one of the
suite in `evals/results.json`. CI can call it; the eval runner does not.

It also skips any capture config with no committed scorecard — currently
`polaris-depth.json` — and **prints that it did**.

### C.6.4 Headless green does not mean live correct

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

### C.6.5 The canvas gate is a per-library harness, not a frontier detector

The only canvas-truth gates are hand-written per-library scripts that encode
defects a human already found by looking at a canvas. They are a regression net.
That is precisely the gap the conformance fixture was built to close, and the
fixture's canvas half (§C.6.2) is the part still missing.

### C.6.6 Pixel numbers carry conventions you need to know

- Portal/overlay pixel rows are **pinned at 100 ("fully different"), not scored**
  — the size-mismatch convention scores 100 pessimistically, so no pixel number
  is quoted for Dialog, Menu or Tooltip.
- Masked scores mask text, because cross-renderer font rasterization never
  flatters a result — but see §C.5: wherever a library's config declares no
  `fonts`, no webfonts load and "masked" is doing more work than usual.
- A low percentage against a blank canvas is not a pass; the canvas gate carries
  an explicit blank-canvas guard for that reason.

## C.7 Per-library freshness — and the two corpora this table omits

Not every example in this repository is equally alive — but as of 2026-07-29,
**all six foreign libraries are fresh**. Polaris, frozen since library #2's
original round, was the last (§D.3).

| library | status | what that means |
|---|---|---|
| **Carbon** | **fresh** | all 10 recaptured; floors byte-identical |
| **MUI** | **fresh** | all 14 recaptured; one floor moved |
| **Tailwind / Flowbite** | **fresh** | all 5 recaptured; scorecards byte-identical |
| **Altitude** | **fresh** | all 8 recaptured; all scorecards byte-identical |
| **Astryx** | **fresh** | all 5 recaptured, 4 promoted (§B.20); re-anchoring re-reviewed — §D.2 |
| **Polaris** | **fresh** | all 12 recaptured 2026-07-29 with the CSS-vars reader ON — §D.3 |

**Two contract-bearing corpora are invisible to that table, and one of them is
the only end-to-end real-kit proof this repo has.** Naming them here is the
point of this re-cut:

| corpus | contracts | why it is not in the table above |
|---|---|---|
| `examples/eventz-vars/contracts` | **17** | a designer's own Figma file with real variable names — proposed FROM a canvas, so it has no library-size denominator and no computed floor |
| `examples/untitled-ui` | **30** (`storybook/contracts/`) | a real Figma community kit taken canvas → code → Storybook. `examples/untitled-ui/RESIDUALS.md:11`: *"The scored table is **92.70%** over **537** variants."* |

Until this re-cut, Untitled UI appeared in this document **exactly once** — in
§C.2, and only for its loss columns. The success half of the same kit appeared
nowhere. That is the sharpest instance inside this document of the complaint
that produced [docs/24](24-what-works.md): every win existed as a number in a
JSON file nobody read.

`RESIDUALS.md` is also the honest counterweight to that 92.70%: of the 7.30
outstanding points it attributes **0.77–3.16 to the instrument's own noise
floor**, **−0.12 to named engine defects with measured probes**, and
**4.26–6.64 to engine-side causes it cannot yet attribute** — reported as
exactly that rather than folded into the instrument excuse.

## C.8 A stale published number in the Polaris showcase

`examples/polaris/SHOWCASE.md` publishes a Round-4 canvas-gate table in which
**all 10 scored components FAIL** their ≤5% masked acceptance. The committed
scorecards under `examples/polaris/receipts/canvas-gate/` are from the later
Round 5a/5c/5d work against contract v0.3.2 and measure **7 of 10 PASS**. Ran
today: Avatar 0, Badge 0.05, Banner 3.17, Button 6.46, Checkbox 3.22,
ProgressBar 26.22, RadioButton 0, Spinner 0, Tag 27.04, Thumbnail 2.16 —
Button, ProgressBar and Tag still over the bar. The table is marked superseded
in place (2026-07-29), with the receipts named beside it.

The committed scorecards themselves now trail the contracts: the task-#26
recapture moved every Polaris contract to v0.4.0 (§D.3), and the canvas gate is
a live instrument — re-running it against the fresh contracts requires the
plugin on a real canvas (owner work), so the v0.3.2 receipts stand as the last
live measurement, named here rather than silently presented as current.

Re-derive it yourself:

```bash
node -e "for (const f of require('fs').readdirSync('examples/polaris/receipts/canvas-gate').filter(f=>f.endsWith('.scorecard.json'))) { const d=require('./examples/polaris/receipts/canvas-gate/'+f); console.log(d.component, d.summary.meanAAMasked, JSON.stringify(d.acceptance)); }"
```

---

# §D — CLOSED — a dated register

*A limitation this repo closes moves here. It is not deleted. Each entry
carries the **date**, the **commit**, and the **gate that now prevents
regression** — because "we fixed it" with no gate is a claim about the past,
not a property of the present. Deleting these would make this document's own
history unfalsifiable, which is the failure mode the repo's decrease-only
ratchets exist to prevent.*

| # | what was closed | date | commit |
|---|---|---|---|
| D.1 | The fidelity gate sampled mid-transition | 2026-07-28 | `e880d80` |
| D.2 | Astryx's capture read its own promote output | 2026-07-29 | — |
| D.3 | Polaris was frozen and believed un-recapturable | 2026-07-29 | — |
| D.4 | The published CLI was not this repository's CLI | 2026-07-29 | — |
| D.5 | One emitter target shipped dangling token references | 2026-07-28 | `d19a433` |
| D.6 | A cross-origin stylesheet vanished in silence | 2026-08-03 | `a2632a8` |
| D.7 | The engine substituted a constraint it never read | 2026-08-03 | `3369a6b` |
| D.8 | The onboard review gate had never printed | 2026-08-03 | `eae868c` |
| D.9 | Both export doors shipped 1 of the engine's 3 payloads | 2026-08-03 | `1a483e0` |
| D.10 | The deployed surfaces served a two-month-old build | 2026-08-03 | `60bfe98` |
| D.11 | Two security holes in the design-first door | 2026-08-03 | `eae868c`, `1a483e0` |
| D.12 | `anatomy.root.attrs` dropped by the React and WC emitters | 2026-08-22 | `46029a88` |
| D.13 | WC emitted multi-placeholder part refs with the braces intact | 2026-08-22 | `46029a88`, `042abde5` |
| D.14 | Child-part state-only channels vanished under `verified-exact` | 2026-08-22 | `46029a88` |
| D.15 | The recovered ToggleSwitch drew its thumb outside the track | 2026-08-22 | `46029a88` |
| D.16 | Per-fact canvas receipts collapsed to a bare `†` | 2026-08-22 | `46029a88` |
| D.17 | The visual gate could not see geometry | 2026-08-22 | `46029a88`, `848f64bc` |
| D.18 | The token runtime wrote `[object Object]`, an unguarded Dark mode, and reverted designer values | 2026-08-22 | `46029a88` |
| D.19 | Generated code referenced custom properties nothing defined | 2026-08-22 | `46029a88` |
| D.20 | The first-party corpus could not ride the bundle | 2026-08-22 | `a14d9ba7` |
| D.21 | Root-level text never drew; literal ink and the emitter's last silent default; thirty runtime swallows | 2026-08-22 | `042abde5` |
| D.22 | The canvas round trip had SILENT rows | 2026-08-22 | `042abde5`, `6b6f8efb` |
| D.23 | The shipped dump script dumped the repo's fixtures, not your sets | 2026-08-22 | `6b6f8efb` |
| D.24 | The held-out kit: 295 silent facts, a wrong "Enterprise" reason, a batch-wide refusal, non-compiling Card | 2026-08-23 | `0dc0811c`, `cda65c2b` |
| D.25 | One truth: red lanes, a self-attested eval record, stale receipts, a clean clone that could not build the plugin | 2026-08-22 | `436abe7b`, `7066eb86`, `01f1c986`, `848f64bc` |
| D.26 | No published engine surface — a Vue emitter could not be built outside the monorepo | 2026-08-22 | `78b96e56`, `a3263f7c` |
| D.27 | Four Figma-only fields outside the vendor-neutral `bindings` namespace | 2026-08-22 | `dbeb3575` |
| D.28 | Path A regressed: hop-4 literal lifts ran on unstamped foreign dumps | 2026-08-22 | `996258af` |
| D.29 | The held-out kit's last two silences, and the SLOT's primary-axis FILL | 2026-08-23 | — |
| D.30 | The Flowbite eight carried no canvas anchor in the contract | 2026-08-23 | — |
| D.31 | The exam SLOT's interior auto-layout | 2026-08-23 | `8162d7c4` |
| D.32 | The two acceptance rows that were red on the commit itself: a drift "check" that wrote tracked files and a referee reading the wrong contracts | 2026-08-23 | `a46593b6` |

*D.12–D.28 were found by the 2026-08-22 audit and closed within the same
two days (PRs #18–#24); none of them ever had a §B row. They are registered
here anyway, with the gate that pins each, so the closure is a property of
the present and not a claim about the past.*

## D.1 The fidelity gate sampled mid-transition — CLOSED (task #34)

**This was the single most stale section of the previous version of this
document, and it was filed as a failure while being a win.**

What it used to say: `extract/computed/gate.ts` waited a flat **30 ms** after
driving an interaction while the capture sweep polled to two consecutive
stable samples for up to 1.5 s; Carbon's buttons transition at 70–110 ms, so
gate rows read an intermediate frame; four consecutive offline runs produced
**77.528 / 77.552 / 77.567 / 77.577**; `carbon/Button` carried the baseline's
only widened tolerance (0.20); Altitude's worst two rows were Link (63.889%)
and Button (74.766%). It closed with *"Named in three PROVENANCE files. Not
started."*

**Every one of those facts is now false.** `extract/computed/gate.ts:419-431`
is a comment reading *"TASK #34 — THE GATE NOW SETTLES, LIKE THE CAPTURE
ALWAYS HAS. This was `await page.waitForTimeout(30)`"*, followed by
`await settleStage(page, stageSel);`. Both sampling points share **one**
implementation — `capture.ts` `settleStage`.

Measured at the fixed engine, quoted from `regate-baseline.json`'s own
`gapCause` for `carbon/Button`:

> "three consecutive offline runs return 78.974% / 78.974% / 78.974% (16275 of
> 20608, byte-identical), the harness gate reports the same 78.9741847826087,
> so the gap is 0.000000 and the spread is 0. The tolerance is RETIRED to the
> global 0.001 rather than left widened over a defect that no longer exists."

The gains, every one on an **unchanged** `cellsCompared`:

| row | move | cells (unchanged) |
|---|---|---|
| `altitude/Link` | **+18.519** → 82.407% | 432 |
| `altitude/Button` | **+6.719** → 81.484% | 1280 |
| `carbon/Button` | **+1.480** offline (+1.698 vs the committed harness number) → 78.974% | 20608 |
| `polaris/Checkbox` | +0.492 | unchanged |
| `carbon/Tabs` | +0.484 | unchanged |
| `mui/Button` | +0.154 | unchanged |

**The gate that prevents regression.** The drift instrument pins
`cellsCompared` **exactly**, so a fidelity gain cannot be produced by shrinking
a denominator; and the **global 0.001 tolerance now applies to every row with
no exceptions** — the baseline carries no widened row at all.

## D.2 Astryx's capture read its own promote output — CLOSED

**2026-07-29.** `extract/computed/configs/astryx.json` pointed all five
components at `examples/astryx/contracts/` — the directory `promote` *writes* —
where every other library points at a frozen seed. The damage was already
shipped: the `FLOOR-PROMOTED` and `COMPUTED-ENRICHED` provenance sentences
appear **twice** in button/badge/slider, **once** in card, and **zero** times in
switch, which had never promoted at all. Five components in three states.

Seeds now live in `examples/astryx/contracts-seed/`, derived from the last
*curated* contracts — **not** from the raw static extraction, which carries HTML
passthrough props (`type`, `name`, `form`, `href`) and would have made `type` a
third variant axis, compiling Button at 36 variants instead of 12.

The re-anchoring ledger's 31 acked leaves across 16 of 19 rows were **every one
a `row-rule-color`** — the currentColor mirror the mint-cleanup round folds away
corpus-wide. Pruned mechanically (12 rows retired, 4 pruned), with the prune
**refusing** if any vanished leaf were not a row-rule-color. The review was then
re-run against the fresh mint:

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
takes the colour-named token and a role-named axis takes the role token.
`#FFFFFF` splits four ways (`color-on-accent`, `color-on-error`,
`color-background-card` as a surface, `color-on-dark`), and that last arm closes
a debt the previous round recorded by name: it declined the slider tooltip's
white text as undecidable and wrote its own unblocking condition — *"name the
tooltip surface first … then this leaf becomes decidable"* — which that round
satisfied.

**Proven:** capture exit 0 on all 5, promote exit 0 with the resolution guard
green, **promote twice byte-identical**, provenance back to one sentence each,
13/13 Figma scripts through their compile receipt.

**The gate that prevents regression.** The rule is enforced for **every**
library by the eval `capture-seeds-are-not-promote-output` (present in
`evals/run.ts`, 2 references), verified to fire on all five astryx entries at
the pre-fix state. Its own message: *"Six libraries obeyed this by convention;
nothing enforced it, which is why the seventh could drift for rounds without a
single gate noticing."*

**Still open:** [§B.20](#b20-astryx-promotes-4-of-its-5-captured-components).

## D.3 Polaris was frozen and believed un-recapturable — CLOSED (task #26)

**2026-07-29.** This section used to say Polaris could never be recaptured, then
that the harness existed but the recapture had not been run. Both are history:
**all 12 components were recaptured** through the committed sandbox
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
`packages/cli/src/promote.ts`.

**Two engine crash classes the aliases exposed, both fixed generally:** the
provisional-minting preamble (`generate.ts`'s path — the only path that emits
one) ran `px()` on a raw `{p.font-weight-medium}` ref; an aliased minted leaf
now upserts a **native Figma variable alias** to the real token variable when
the origin file carries it, with the resolved literal embedded as the named
fallback for empty files. And `compileTokenSetRows` spelled alias *targets* by
dot-path while the sync runtime resolves them through a map keyed by variable
*name* (slash form) — the exact sibling of the `7b02b42` base-name fix,
reachable only by a nested-wrap library with minted aliases, i.e. by Polaris
first.

**The gate that prevents regression.** `scripts/figma-scripts-fresh.mjs` no
longer names polaris as un-gated: its row runs `generate.ts --check` (a
byte-compare over all 76 generated surfaces, strictly wider than the CLI
rebuild rows), and **the eval that used to *require* the `NOT GATED` line now
fails if one ever reappears.** 6/6 libraries byte-fresh, zero named holes.

**Still open:** [§B.21](#b21-five-sandbox-recipes-are-prose-not-committed-bytes);
refusal still cannot lower a fidelity score (§C.6.1); and the recapture does not
change the coverage fraction — 12 of 180 extractable Polaris components is still
a hand-picked slice (§C.1.3).

## D.4 The published CLI was not this repository's CLI — CLOSED

**2026-07-29.** Kept here because it is the failure mode most worth
recognising: a version number that says two different artifacts are the same
thing.

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
| `@ds-contracts/emitter-web-components` | 0.2.0 | **0.3.0** | it now refuses an undefined token (§D.5), so it accepts strictly less than 0.2.0 did |

**The gate that prevents regression.** The `examples/ci/` recipes are pinned to
`0.3.0` and their receipt ([VALIDATION.md](../examples/ci/VALIDATION.md)) is a
real execution against it, regenerated after the publish — not hand-edited. The
pins were deliberately held at 0.2.0 until the publish was real, because a
workflow pinned to a version that does not exist is the defect those files had
just been repaired for.

## D.5 One emitter target shipped dangling token references — CLOSED

**2026-07-28, `d19a433`.** Three of the four registered targets refused a token
that was not in the inventory. The web-components target had **no inventory in
its emit context at all**, so a contract referencing a token that does not exist
compiled cleanly and emitted `var(--p-does-not-exist)` — a custom property that
renders as nothing, at runtime, with no error, on one target only.

It now validates through `generateCss`'s own checker rather than a second
implementation, so the two targets cannot drift into disagreeing about whether a
contract is valid. Omitting the inventory is itself a named refusal, so the
check cannot be bypassed by leaving a field undefined.

**The gate that prevents regression.** The eval
`emitters-refuse-undefined-tokens`, which poisons one root channel of a real
contract and requires the refusal to name the offending token, with the
unpoisoned contract emitting as a control.

## D.6 A cross-origin stylesheet vanished in silence — CLOSED

**2026-08-03, `a2632a8`.** A cross-origin `<link>` stylesheet **throws on
`.cssRules`**, and the CSS-vars reader swallowed that whole-sheet failure in
total silence: `source-bindings.json` printed `skips: []` and the console
printed "0 named skip(s)" over a stylesheet that was never opened. This was the
**third instance of exactly this class in one file** — the shorthand ceiling
(§C.4.1) and the calc ceiling (§C.4.2) are its earlier siblings, and their own
comments say so.

It is now a **counted, href-named ceiling** (`stylesheetCeiling` /
`stylesheetSkips`, `extract/computed/stylesheet-ceiling-check.ts`), threaded
through `capture.ts:1327/1610/1618` and `run.ts:738-741`, so "the library
declared no token names" and "the reader could not look" are different, visible
facts.

**The gate that prevents regression.** An eval (`evals/run.ts:3276-3286`) drives
the **real exported `captureJs`** at a genuinely cross-origin sheet, with the
receipt: *"restoring the silent catch fails three of the four pins while the
control still passes."*

**Still open:** the corpus has not been re-captured through it —
[§B.17](#b17-the-corpus-has-not-been-re-captured-through-the-stylesheet-ceiling-instrument).

## D.7 The engine substituted a constraint it never read — CLOSED

**2026-08-03, `3369a6b`.** Figma's `ConstraintType` is
`MIN | CENTER | MAX | STRETCH | SCALE`. Until dump v1.13, both capture sites
mapped only the first three, so a STRETCH or SCALE node **dropped the whole
`constraints` field** — and `core/propose-figma.ts` reads an absent field as
`LEFT`/`TOP`, so the engine *substituted* a confident top-left pin rather than
losing a fact.

Now, verified at HEAD: `extract/figma/dump.plugin.js:144-145` maps all five
(`{ MIN:'LEFT', MAX:'RIGHT', CENTER:'CENTER', STRETCH:'STRETCH', SCALE:'SCALE' }`)
with `dumpVersion '1.13'` at `:780`; `core/propose-figma.ts:2463-2500` carries
**STRETCH** as both edges pinned (CSS `left`+`right` / `top`+`bottom` with no
size), **refuses SCALE by name** ([§A.2](#a2-canvas-constructs-with-no-css-spelling)),
and `:2455` emits the absent-field ASSUMPTION note.

**The gate that prevents regression.** `npx tsx extract/figma/constraints-check.ts`
passes all 12 assertions, including *"a refused SCALE part renders IN FLOW (no
half-carried absolute box)"*.

**Still open:** the 352 unrepairable pre-v1.13 boxes —
[§B.18](#b18-pre-v113-dumps-carry-an-unrepairable-constraint-guess).

## D.8 The onboard review gate had never printed — CLOSED

**2026-08-03, `eae868c`.** This is the entry that most deserves to be in a
register rather than deleted, because **this document presented the broken
thing as a live safety net** (§B.10, mitigation 2).

`freshOnboard` never declared `root` and passed it to `printReviewGate` — a
`ReferenceError` on **every** fresh onboard, in 3 of 3 workspaces. The gate is
the phase's entire stated purpose, and it printed nothing. `npx tsc --noEmit`
reported it as `TS2304` the whole time; the commit adds
`const root = process.cwd();`.

The same commit closed five more defects on the same door, each falsified
before and after: phase 2's capture runner was unreachable from every install
layout; `onboard <npm-package>` silently extracted the **host repo** and
reported 51 wrong contracts as success; `onboard <path>` produced an
unbuildable sandbox (164 esbuild errors) and is now npm-pack'ed and installed
as a tarball; a tokens file was promised in `ds-library.json` and never
written; and `--components` silently dropped unknown names.

**The gate that prevents regression.** `npm run test:onboarding` — **40/40, run
today**, with case 40 being *"the review gate warns when a queued component can
capture its trigger instead of itself."* Plus `npm run typecheck`, which had
been reporting the original defect all along.

**Still open:** the advisory is still an advisory —
[§B.10](#b10-at-depth-the-pipeline-can-fail-and-say-it-succeeded).

## D.9 Both export doors shipped 1 of the engine's 3 payloads — CLOSED

**2026-08-03, `1a483e0`.** `proposeFromDump` returns
`{ contract, childStubs, mintedTokens, notes }`. The plugin's
CONTRACT-PROPOSAL envelope **and** the CLI's `extract:figma` door both dropped
`childStubs` and `mintedTokens` — while the engine's own note said the stubs
were "auto-proposed alongside", **a false receipt about what landed on disk**.
Every designer's export therefore ended at "references unknown contract",
naming one of seven dangling refs. Reassembling the three payloads by hand
produced components pixel-identical to the committed reference: the engine was
fine, the doors discarded the payload.

Both doors now carry all three, and the printed next command
(`generate … --tokens <minted>`) runs green with **zero**
unknown-contract / unknown-token refusals, on two dumps. Old envelopes parse as
the old shape, verified adversarially against absent / null / malformed /
dup-key / `__proto__` forms.

**The gate that prevents regression.** `plugin-engine-check` now **REQUIRES**
`childStubs` + `mintedTokens` in the export — *"this pin fails the build if
either payload is ever dropped again."*

**A named limit that came with it (as of that date):** the playground's
recommended REST import route was a v1.5 mapper against a v1.13 plugin dump —
eight revisions of channels it could not see (`strokeAlign`, wrap, constraints, imageFill, textOverrides,
fixedSize, multi-mode values, non-shape abs). Those were previously silent while
the UI said "values still come through exactly". The mapper now stamps
`_provenance.captureGaps` with 8 named entries and their consequences (*"an
OUTSIDE stroke (focus ring) will be read as an inward border"*), surfaced as one
note per set: **a READ limit of the route, not evidence about the design.** Six
committed REST fixtures predate the stamp.

## D.10 The deployed surfaces served a two-month-old build — CLOSED

**2026-08-03, `60bfe98`.** The live surfaces served a July build advertising six
tabs deleted on 2026-07-26, and the site **could not build at all**: its own
schema-coverage gate had been REFUSING on 13 branches added by recent engine
rounds (`statesByProp`, `textByProp`, `shape.arc`, `componentRef.overrides`,
`part.overridable`), and the answer had been to stop deploying rather than
document. All 13 are now documented from the schema's own comments and
committed usage — **154/154 branches, 0 missing, 0 stale**.

The same round fixed verified-false doc claims ("you do not need to clone
anything"; "npm run parity — see it report clean"; "correct-by-construction")
and rewrote the plugin README that **ships in the zip** against the real
Build / Changes / Send / Advanced surfaces.

**The gates that prevent regression.** `plugin-ui-check` sweeps the README and
source `ui.html` — and, since 2026-08-03, every `docs/*.md` — for labels the
2026-07-26 IA **deleted**; planting the removed "Generate tab" string turns it
red, run and verified. The site's journey-command drift guard now covers
claim-channel / publish / receive / propose-pr, not just the npx-prefixed lines.
And `npm run deploy:check` makes the deploy prove itself.

**Worth recording in both directions:** three of that audit's instructed fixes
were themselves **wrong**, and the docs track REFUSED them with artifact
evidence. The skepticism layer worked in both directions.

## D.11 Two security holes in the design-first door — CLOSED

**2026-08-03, `eae868c` + `1a483e0`.** Both were found by an adversarial
verifier executing the attack, not by reading code, and both are now permanent
tests (22/22).

1. **Path traversal in the export door.** A stub id of
   `ds.../../ESCAPED-STUB` wrote a file **outside `--out`**. The id-to-filename
   convention is now traversal-proof (envelope ids are outside the trust
   boundary), plus a belt at the write that refuses any resolved path escaping
   `--out`, by name.
2. **Symlink containment escape in `onboard`.** The containment guard used
   string containment, so a **symlinked `node_modules` entry** passed the check
   while every read went to the host repo. `within()` is now realpath-hardened
   and a symlinked package entry is refused by name. Falsified with the exact
   attack: the refusal quotes the symlink **and** its target, and the decoy host
   source appears nowhere in the output.

A third, adjacent robustness hole closed with them: a **500-deep minted tree**
blew the stack with a `RangeError` *after* deliver-once had burned the payload,
so the delivery just vanished. An iterative depth guard (64 levels, far past any
real DTCG) refuses by name at parse.


---

## D.12 `anatomy.root.attrs` dropped by the React and WC emitters — CLOSED

**2026-08-22, `46029a88` (#19).** `emit-react`'s `elementAttrs` never called
`partAttrString(root)` and `emit-wc` never read the field, so a contract's
root `attrs` — `aria-label`, `type`, `role`, `href` — reached only the static
HTML target. Shipped link components (`citation`, `side-nav-item`,
`top-nav-item`) rendered `<a>` with no `href`. Carried on all four code
targets now; one root role claim (attrs wins; a differing pair refuses by
name); WC emits `statesByProp`; HTML renders `aria-expanded` /
`aria-pressed`. Multi-root contracts with no `anatomy.root` are guarded.
**Gate:** `npm run root-attrs:check` (321 pins; `maintain`, fast lane).

## D.13 WC emitted multi-placeholder part refs with the braces intact — CLOSED

**2026-08-22, `46029a88` + `042abde5`.** A part token ref with two
placeholders (`{color.{variant}.{size}}`) reached the web-components
stylesheet unexpanded — invalid CSS, the part's colour lost (nine hits in
untitled-ui). One rule per value tuple now, byte-compared against React's
`generateCss`; `states` refs with two or more placeholders and boolean
placeholders expand as the cartesian on React, HTML and WC alike; a
placeholder naming no axis refuses by name in `validateContract`.
**Gate:** `npm run emitters:check` (WC section, `BRACED_VAR` scan; full lane).

## D.14 Child-part state-only channels vanished under `verified-exact` — CLOSED

**2026-08-22, `46029a88`.** A DROP_SHADOW, stroke weight, radius, opacity
or depth-2 ink that existed only in a child part's Hover/Focus cell was
dropped by propose while the proposal read `verified-exact`. Carried as the
part's `states.<state>` channels, or NAMED per part + state + channel
(`FC-DUMP-PROPOSE-PART-STATE-CHANNELS`) where the vocabulary has no slot.
**Gate:** `npm run exact-proposal:check` §30.

## D.15 The recovered ToggleSwitch drew its thumb outside the track — CLOSED

**2026-08-22, `46029a88`.** A `stylesWhen`-absolute child never made its
holder `position: relative`, and `emit-react` anchored it to the root.
The holder declares position now; rendered in Chromium, the thumb sits
68–88 px inside a 46–90 px track. (NORTH-STAR's ToggleSwitch row carried this
as a 2026-08-22 NOTE; the row's own wall, `FC-FONT-SUBSTRATE`, is unchanged.)
**Gate:** `npm run exact-proposal:check` §31.

## D.16 Per-fact canvas receipts collapsed to a bare `†` — CLOSED

**2026-08-22, `46029a88`.** `emit-figma-script` computed every code-only
fact's name, channel, value and reason — and discarded the strings, leaving
one dagger per contract. `codeOnlyFacts` `{part, kind, channel, value,
reason, variants}` now rides the compiled data, `bundle.codeOnlyFacts`, the
plugin data `ds_contracts/codeOnlyFacts`, the plugin run report and
`figma bundle` stdout: 54 on the Flowbite eight, 2,321 across the census
corpora. **Gate:** `npm run code-only-facts:check` (`maintain`, fast lane);
`npm run dagger:census` counts named facts beside daggers.

## D.17 The visual gate could not see geometry — CLOSED

**2026-08-22, `46029a88`, `848f64bc`.** `compareToBaseline` scored masked
pixels only; a Badge 39% wider passed green, and BETA.md said the hole
"cannot silently reopen". Every row now gates both content boxes — ours and
Figma's — at ±4 device px per axis, on per-platform baselines
(`baseline.darwin.json`, `baseline.linux.json` transcribed from CI's own
run), with `--self-test` red-testing nine refusals. First field catch: three
`cbds-dialog` cells that had moved 8/8/32 px under green scores.
**Gate:** `npm run maintain:visual` (catalog-visual lane, `FIGMA_TOKEN`).

## D.18 The token runtime wrote `[object Object]`, an unguarded Dark mode, and reverted designer values — CLOSED

**2026-08-22, `46029a88`.** A composite DTCG `$value` (object-form shadow)
became the STRING `[object Object]` on the canvas; `addMode('Dark')` ran
unguarded on plans that refuse it; a designer's edit to a variable value was
overwritten on every re-paste. Composite values are refused by name at bundle
and plan time; Dark is added only when the set carries it and the Starter
refusal is named; value edits are named as `variableDrift` and kept unless
`DS_OVERWRITE_TOKENS` (the prune's sibling door, §B.23).
**Gate:** `npm run token-set-prune:check` (`maintain`, fast lane).

## D.19 Generated code referenced custom properties nothing defined — CLOSED

**2026-08-22, `46029a88`.** Generated React/WC/HTML referenced roughly 261
`var(--…)` names no stylesheet defined, and dark mode never reached the code
side. `generate` now emits `tokens.css` (`:root` + `[data-theme="dark"]` +
`[data-brand=…]`) beside the components for every code target; `index.ts`
and the stories import it; referenced ⊆ defined or refuse by name (a
`var(--x, fallback)` override hook may stay undefined). Rendered Button =
`rgb(26,86,219)` from the sheet. **Gate:** `npm run css-vars:check`.

## D.20 The first-party corpus could not ride the bundle — CLOSED

**2026-08-22, `a14d9ba7`.** `figma bundle contracts --tokens
primitives,semantic --modes light,dark` printed ✔ and the plugin then refused
34 of the 51 contracts ONE PER PASTE (the brand layer unreachable, mode-only
tokens orphaned); a directory refused as `EISDIR`. `figma bundle` now takes
the layered grammar `generate` already had (a directory, `slot=file`,
`--modes light,dark`), carries `tokenSet.layers`, compiles every contract
before printing ✔, and refuses with ONE named list plus the slot layout.
**Gate:** `npm run first-party-bundle:check` (24 pins; `maintain`, fast lane).

## D.21 Root-level text never drew; literal ink and the emitter's last silent default; thirty runtime swallows — CLOSED

**2026-08-22, `042abde5`.** A root that IS the text node drew nothing
(Fluent Tooltip's copy had never been on the canvas); `literals.color` was
not carried as the text fill; `applyLiterals`' `default: break` dropped every
literal channel with no canvas field (untitled-ui Dot/Circle
`border-radius: 50%`); the emitted Figma runtime had 30 bare `catch {}`
sites. The root text draws (one TEXT child `label`, read back by propose);
literal ink is carried; every uncarried literal channel is a `codeOnlyFact`;
the runtime pushes named `FC-RT-*` degradations into the per-set result.
**Gates:** `npm run root-text:check` (33 pins), `npm run code-only-facts:check`.

## D.22 The canvas round trip had SILENT rows — CLOSED

**2026-08-22, `042abde5` (first measurement 22 / 3 / 15 / **6** SILENT →
26 / 4 / 15 / 1), `6b6f8efb` (#21: aspect-ratio lowered to a fixed height
when a bound width exists, named either way → **0**).** `conformance/canvas.ts`
drives every CARRIED/LOWERED CSS case → figma script → mock engine → dump →
propose and diffs the case's own channel: ROUND-TRIPPED / NAMED /
REFUSED-BY-NAME / SILENT. **Gate:** `npm run conformance:roundtrip`
(decrease-only ratchet, a new SILENT is red; fast lane).

## D.23 The shipped dump script dumped the repo's fixtures, not your sets — CLOSED

**2026-08-22, `6b6f8efb`.** `extract/figma/dump.plugin.js` shipped with
`TARGET_SETS = ['Badge','Switch','Card']`, so an unedited paste into a
Flowbite file dumped three MUI demo sets and never a Flowbite stem. The
default is `[]` — every local set, narrowed to the selection when one is
held — and a non-empty list refuses BY NAME on a missing set. Every dump
degradation names its CSS channel so the canvas gate and propose match
receipts by channel word. **Gate:** the verbatim `ui.html` embed is pinned by
`npm run plugin:check` (`scripts/plugin-engine-check.mjs`).

## D.24 The held-out kit: 295 silent facts, a wrong "Enterprise" reason, a batch-wide refusal, a non-compiling Card — CLOSED to two

**2026-08-22 → 23, `0dc0811c`, `cda65c2b` (#22 exam, #23 fix rounds).**
A hand-built "Figma Design System" kit this engine had never seen
(`aekVseUceg35tVn62knRrj`, 15 sets, zero stamps) went through the REST
Journey A path: 3,556 canvas facts, **1,502 carried · 1,759 named · 295
silent · 8 wrong-name · 25 should-carry**; Button and Card not
recognisable; the PAT's missing `file_variables:read` scope reported as
"Enterprise" 1,595 times; 1,748 map receipts only on stderr;
`captured.dtcg.json` never written on the REST path; `generate` refusing all
80 proposals on one contract's height clash; `CardProps.content` colliding
with `HTMLAttributes.content`. Re-measured after the rounds, same file, same
PAT: **1,594 · 1,960 · 2 · 0 · 0** (dump v1.31 carries `fillHeight`,
`text.fontFamily` / `textAlign`, `effectStyle`, `effects[].bound`,
`reactions`, `hostOverrides`, `fixedSwaps`, `itemReverseZIndex`,
`targetAspectRatio`; the 403 is named once with its fix; receipts ride the
dump; `generate` refuses per contract and writes the rest; a prop or slot
named like a DOM attribute is `Omit<>`-ed and named). Button is
recognisable; Card is not (§B.26); the two silences closed 2026-08-23 (§D.29).
**Gates:** `npm run conformance:canvas` (152 cases, 152 PASS — every exam case
pinned before any fix; the two pinned RED-EXPECTED here stayed red until §D.29), `npm run prop-collision:check`
(`maintain`, fast lane), `npm run generation:atomic:check`; receipt
[parity/receipts/phase-2/FIGMA-DS-EXAM.md](../parity/receipts/phase-2/FIGMA-DS-EXAM.md).

## D.25 One truth: red lanes, a self-attested eval record, stale receipts, a clean clone that could not build the plugin — CLOSED

**2026-08-22, `436abe7b`, `7066eb86`, `01f1c986`, `848f64bc` (#18, #19).**
Measured that morning: all three required lanes red on `main` since
mid-August; `evals/results.json` said 225/225 while the five most recent CI
runs said 222 → 214 and no CI run had ever reproduced the committed number;
`npm run maintain` existed only in an uncommitted tree; both
`contract.schema.json` copies were eleven days behind the Zod document; ten
`*.figma.js` scripts stale; `plugin:zip` refused on a clean clone because a
commit changed three nodeIds without re-recording the engine receipt; three
different plugin engines in circulation. Now: the record carries the commit
it measured and whether the tree was dirty, the full lane re-measures into
`evals/.ci/results.json` and fails row-by-row on disagreement
(`eval:record:check`; checkout is full-history so ancestry can be proven);
`schema:fresh` refuses a stale JSON Schema projection; every `maintain` leaf
runs in a lane and `ci:lanes` expands composites; `maintain:visual` runs in
the catalog-visual lane with the `FIGMA_TOKEN` secret; every receipt was
regenerated by its own recipe; the visual-truth astryx floor is a named
advisory rather than a standing red; the golden path was re-run on a fresh
clone at eight stems
([GOLDEN-PATH-RECEIPT](../parity/receipts/beta/GOLDEN-PATH-RECEIPT.md)).
**Gates:** `npm run eval:record:check`, `npm run schema:fresh`,
`npm run figma:fresh`, `npm run capability:fresh`, `npm run ci:lanes`.

## D.26 No published engine surface — CLOSED

**2026-08-22, `78b96e56`, `a3263f7c` (#20).** The CLI imported 22 root
modules via `../../../`; `Emitter` / `EmitterCtx` / `registerEmitter`, the
token resolver, provenance and `kebab` lived only in root `core/`, so
"Vue/Svelte/Angular as later plugins" was not a true sentence and the WC
README pointed at an unresolvable specifier. `@ds-contracts/core`
(`packages/core`, depends on the schema and nothing else) now carries the
emitter surface AND the analysis half of `emit-react` (`validateContract`,
`generateCss`, multi-root, grid, the prop classifiers, the fact tables);
root files are re-export shims; golden byte-identical. **Gate:**
`npm run verify:published` (full lane) packs the four tarballs into a temp
project and generates the Flowbite eight through a Vue emitter that depends
on the tarballs alone, refusing on the first CSS byte that differs from the
in-repo React emitter.

## D.27 Four Figma-only fields outside the vendor-neutral `bindings` namespace — CLOSED

**2026-08-22, `dbeb3575` (#24).** `figmaRepresentation`,
`figmaStatePreviews`, `anchors.figma` and `slot.figmaProperty` sat outside
`bindings`. Schema 17 hoists them (`bindings.figma.representation`,
`bindings.figma.statePreviews`, `bindings.figma.anchors`,
`bindings.code.anchors`, `slot.bindings.figma.property`) — a pure rename.
The v16 spellings stay as `z.never` tombstones so a v16 document fails at the
exact path with the new spelling and the codemod (`ds-contracts migrate
<paths..> [--check]`) in the message; 812 committed JSON files were
rewritten and every embedding artifact regenerated. BREAKING:
`@ds-contracts/schema` 17.0.0-rc.1. **Gates:**
`npm run contracts:migrate:check` (fast lane; walks what git sees),
`npm run schema:fresh`.

## D.28 Path A regressed: hop-4 literal lifts ran on unstamped foreign dumps — CLOSED

**2026-08-22, `996258af`.** The text/shape paint lifts written for sets THIS
pipeline drew (the stamped contract spells the literal) ran on every dump, so
an unstamped REST dump of CBDS turned a Button text fill into a literal that
stayed in the UNBOUND ledger and Tooltip stopped minting by usage site —
fourteen C5 replay evals red, and nothing had run the suite since 08-16.
Both lifts now start at the `drawnByThisPipeline` predicate; `paintCssHex`
no longer double-prefixes `#` (24 fixtures had been silently skipped whole);
a sibling stub resolved later rides the resolving proposal's envelope.
**Gates:** the C5 replay evals (full lane); `npm run flowbite-dump-propose:check`
and `npm run exact-proposal:check` pin the stamped side.

## D.29 The held-out kit's last two silences, and the SLOT's primary-axis FILL — CLOSED

**2026-08-23, `phase-2/exam-close` (r9 exam round 2, r10).** Both silences
were the Card's `Variant=Inline/Container/Image` native SLOT (§D.24 left
them pinned RED-EXPECTED in `extract/figma/conformance/MANIFEST.json`):

- `slot-fixed-width-by-variant` — `nameFixedChildGeometry` skipped an axis
  when ANY occurrence filled it, so the Inline occurrence's FIXED 308px got
  no receipt. It now accounts per variant: an occurrence that FILLS the axis
  is excluded from the FIXED set instead of silencing the axis, and the
  receipt names both sides (`FIXED in 1/2 variant occurrence(s) — FIXED on
  Variant=Inline; FILL on Variant=Default … FC-GEOMETRY-EXCLUDED (Option B)
  … NAMED`). Nothing is minted — no `imported.case.image.width`, no 308.
- `layout-fill-height-parent-mode-by-variant` — the native-SLOT branch
  returned before `crossAxisFillByProp` / `carryCrossAxisFill` (the FRAME
  branch walks both), and `carryCrossAxisFill` returned silent at its
  mixed-parent-modes door. The SLOT branch now walks the same two doors in
  the same order; `nameCrossAxisFillByVariant` reads each occurrence against
  its own parent mode and names the per-variant facts; `crossAxisFillByProp`
  gained the height twin (FILL-height in every occurrence under an
  axis-split parent carries `height: 100%` on the definite ROW planes, and
  is named when those parents hug). This case's fill is on a different axis
  per variant, so it is the named path and no `height: 100%` is written.

The same SLOT's FILL along its ROW parent's **primary** axis was the
finding r9 named and did not fix: the branch never called `invertLayout`,
so `Card:Variant=Default` Image's FILL-width reached neither the contract
nor a note. r10 extracted `primaryAxisGrow` — the ONE rule every FRAME,
spacer and slot-wrapper part inverts through — and the SLOT branch reads it,
so a SLOT that FILLS the primary axis in every occurrence carries
`layout.grow: true` on the slot part; `emit-figma-script`'s slot spec, the
one spec built without `grow`, now lowers it to `layoutSizingHorizontal
FILL` like every other part class, so the carried fact survives
regeneration. Two conformance cases were added for it
(`slot-primary-axis-fill`, `rest-slot-primary-axis-fill`, both CARRIED).
What the grow did **not** carry — the slot's interior auto-layout — was
§B.24 until r11 the same day; closed in §D.31.

**Gates:** `npm run conformance:canvas` (152 cases · CARRIED 105 ·
LEDGERED 38 · REFUSED 9 · 152 PASS · 0 RED-EXPECTED), `npx tsx
conformance/canvas.ts` (46 round-trip cases, 0 SILENT), `npm run
exact-proposal:check` §47–§49 (the per-variant FIXED receipt, the
per-variant cross-axis fill and its height twin, the slot grow in both the
every-occurrence and the split shapes), `npm run emitters:check` (the slot
spec's grow), `npm run accuracy:check` (`accuracy/grammar.json` pins 152 =
105 / 38 / 9). The exam receipt's own re-measure
([FIGMA-DS-EXAM.md](../parity/receipts/phase-2/FIGMA-DS-EXAM.md) — 1,594 ·
1,960 · 2 · 0 · 0) was taken before these rounds and is not re-run here; the
two cases it named are what the fixture now holds green.

## D.30 The Flowbite eight carried no canvas anchor in the contract — CLOSED

**2026-08-23, `phase-2/exam-close` (r9 exam round 2).** All eight
`examples/tailwind/contracts/*.contract.json` spelled
`bindings.figma.anchors` as `{ "fileKey": null, "componentSetKey": null }`
while their live sets existed on `59mLQlOMiD5w5za6SUcoO5` (the
`*.anchors.json` sidecars are token provenance, not identity), so nothing
could address a demo set by id and `contractIdByKey` could never hit. Now
`bindings.figma.anchors = { fileKey: "59mLQlOMiD5w5za6SUcoO5", nodeId,
componentSetKey }` on all eight — Alert `120:1979`, Badge `120:2098`, Button
`120:2203`, Card `120:1999` (a standalone COMPONENT; the key is its
component key), HelperText `120:2014`, Kbd `120:1982` (standalone
COMPONENT), Label `120:1996`, ToggleSwitch `120:2047` — each verified
READ-ONLY against the live file (REST `nodes?ids=…&plugin_data=shared`: the
node is that set, its `key` is the key written, and `ds_contracts/contractId`
equals the contract id); the keys also equal the `key` field of
`extract/figma/fixtures/flowbite-eight.dump.json`.

What moved with it: the eight `*.figma.js`, `GENESIS-BATCH.figma.js` and
`tailwind.bundle.json` were re-emitted by the hop-2 recipe — per script
exactly two lines, `anchorKey` (was `null`) and `EXPECTED_FILE_KEY` (was
`null`). **The specHash caveat:** `anchorKey` sits inside the compiled spec
the hash covers, so the specHash moves for all eight (Button 41443591 →
2941065026, ToggleSwitch 1041764168 → 612723347 through the mock engine).
Measured honestly, the engine at this tree already hashed all eight
differently from the live stamps before the anchors (`emit-figma-script`
changed on 2026-08-22 after the last live emit), so the demo canvas is
stale against HEAD either way; the next Apply re-reconciles all eight IN
PLACE — same node id and key, identity resolving by the
`ds_contracts/contractId` stamp first, then by `anchorKey` — and restamps
the hash: a redraw, not a fork. Two surfaces read `fileKey` differently:
the plugin plans against the OPEN file's key (`ui.html` →
`planGenerate({ fileKey: currentFileKey })` overrides the contract's), so
Journey A into a new file is unchanged; the standalone console scripts carry
`EXPECTED_FILE_KEY` as a hard guard and refuse any other file by name
(`WRONG FILE`). Not moved: `src/` and the golden (first-party contracts
only), `extract:figma:visual:anchors` (its subjects are `contracts/`), the
engine receipt's inputs (`scripts/build-plugin-zip.mjs` bakes `contracts/`,
not `examples/tailwind`). Nothing writes the anchor back after a recorded
apply yet — that door is still by hand; the anchors here were written and
verified by a person against the live file, and they ride the tailwind
authored-facts ledger (`examples/tailwind/authored-facts.json`, eight rows
on `bindings.figma.anchors`, each quoting the verification) so the committed
contracts stay re-derivable from the capture plus the ledger
(`promote-generalization`).

**Gates:** `npm run flowbite-bundle-fresh:check` (the committed scripts and
bundle equal a fresh emit with the anchors in them), the
`promote-generalization` eval (re-promotion reproduces the eight byte for
byte through the ledger), `npm run
flowbite-dump-propose:check` (all eight stems still verified-exact — the
anchors did not change recovery; the contract-side `componentSetKey` now
resolves the same id the dump's `key` resolved by name), `npm run
exact-proposal:check`, `npm run contracts:migrate:check` (the anchors are
the schema-17 spelling).

# §E — How to check this document yourself

```bash
npm install

# ── the coverage fraction (§C.1.3) ────────────────────────────────────────
# DO NOT use `ls examples/*/contracts/*.contract.json | wc -l` — it returns 79,
# because examples/eventz-vars/contracts holds 17 canvas-proposed contracts
# that have no library-size denominator (§C.7). Use the six-library command,
# which is docs/22 §10's own:
node -e "const fs=require('fs'),b=require('./extract/computed/regate-baseline.json');
const rows={};for(const r of b.rows)rows[r.library]=(rows[r.library]||0)+1;
let C=0,R=0;for(const l of ['mui','tailwind','altitude','polaris','carbon','astryx']){
 const c=fs.readdirSync('examples/'+l+'/contracts').filter(f=>f.endsWith('.contract.json')).length;
 C+=c;R+=rows[l];console.log(l.padEnd(9),'contracts',c,'drift rows',rows[l])}
console.log('total'.padEnd(9),'contracts',C,'drift rows',R)"
# → 62 contracts, 54 drift rows

# the unit defect in the published denominator (§C.1.3): 98 dirs, 97 public,
# and `Table` alone is 29 of Astryx's 222 (examples/astryx/out/ and .astryx-sandbox/ are
# gitignored: sandbox per examples/astryx/PROVENANCE.md, then `npm run extract:code -- examples/astryx/extract.config.json`)
node -e "const ext=require('./examples/astryx/out/code-extraction.json');
const pkg=require('./examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/package.json');
const subs=new Set(Object.keys(pkg.exports).filter(k=>/^\.\/[A-Z][^/]*\$/.test(k)).map(k=>k.slice(2)));
const f=new Map();for(const e of ext){const d=e.source.match(/\/src\/([^/]+)\//)[1];f.set(d,(f.get(d)||0)+1)}
console.log(f.size,[...f.keys()].filter(d=>subs.has(d)).length,f.get('Table'))"   # → 98 97 29

# the filtered MUI denominator, by a library-native rule (§C.1.3); examples/mui/.mui-sandbox is
# the gitignored install sandbox (not tracked) — recreate it per examples/mui/PROVENANCE.md
node -e "const fs=require('fs');const d='examples/mui/.mui-sandbox/node_modules/@mui/material';
const dirs=fs.readdirSync(d,{withFileTypes:true}).filter(e=>e.isDirectory()&&/^[A-Z]/.test(e.name)).map(e=>e.name);
const no=dirs.filter(n=>!fs.readdirSync(d+'/'+n).includes(n[0].toLowerCase()+n.slice(1)+'Classes.js'));
console.log(dirs.length-no.length, no.length)"   # → 116 19

# the archetype table's fidelity numbers (§C.1.1) — every one is
# committedPctEqual, read straight from the drift baseline
node -e "const b=require('./extract/computed/regate-baseline.json');
for(const r of b.rows)console.log(r.library.padEnd(9), r.component.padEnd(20),
 r.committedPctEqual.toFixed(3).padStart(8), r.cellsCompared)"

# the shorthand ceiling, summed across all 102 committed artifacts (§C.4.1).
# Polaris's captures predate the per-library directory level and live one level
# up, so the library is taken from varPrefix rather than from the path.
python3 -c "
import json,glob,collections
P={'altitude/':'altitude','astryx/':'astryx','carbon/':'carbon','mui/':'mui','tailwind/':'tailwind'}
t=collections.Counter(); n_files=0
for f in glob.glob('extract/computed/out/**/source-bindings.json',recursive=True):
    d=json.load(open(f)); n_files+=1
    rel=f.replace('extract/computed/out/','')
    lib=next((v for k,v in P.items() if rel.startswith(k)), 'polaris' if d.get('varPrefix')=='--p-' else 'other')
    t[lib]+=len(d.get('shorthandSkips') or [])
print(n_files,'files'); print(sorted(t.items())); print(sum(t.values()),'total')"
# → 102 files
# → [('altitude', 16), ('carbon', 14), ('mui', 2), ('other', 0), ('polaris', 21), ('tailwind', 16)]
# → 69 total   (astryx contributes nothing: it has no varPrefix, so no file exists;
#               'other' is the conformance fixture corpus, varPrefix --cf-)

# and the same walk shows the stylesheet-ceiling field on ZERO of them (§B.17)
python3 -c "
import json,glob
fs=glob.glob('extract/computed/out/**/source-bindings.json',recursive=True)
print(sum(1 for f in fs if 'stylesheetCeiling' in json.load(open(f))),'of',len(fs))"
# → 0 of 102

# overlays carry zero source facts (§B.1)
node -e "for (const c of ['mui/dialog','mui/menu','mui/tooltip','carbon/modal','mui/button','carbon/button']) { \
  const p='extract/computed/out/'+c+'/source-bindings.json'; \
  try { console.log(c, require('./'+p).facts.length) } catch { console.log(c,'—') } }"

# reconciliation touches no token or anatomy channel (§B.12)
grep -c 'tokens\|spacing\|anatomy' extract/reconcile.ts     # → 0

# the conformance frontier (§C.6.2) — reads committed artifacts, no browser
npm run conformance
# → 82 cases · 79 pass · 3 red · 0 yellow; CARRIED 42 · LOWERED 4 · REFUSED 18 · UNSUPPORTED 18

# its canvas half, MEASURED through the plugin engine + mock canvas + dump + propose (§C.3)
npm run conformance:roundtrip     # → 46 cases · 26 round-tripped · 5 named · 15 refused by name · 0 SILENT

# the canvas-construct fixture, incl. the held-out kit's cases (§D.24, §D.29, §D.31)
npm run conformance:canvas        # → 157 cases · 157 PASS · 0 RED-EXPECTED · 0 FAIL

# every dropped-fact receipt and the facts it names (§C.3)
npm run dagger:census             # → 104 receipts · 2,321 named facts, no drift
npm run code-only-facts:check     # → the per-fact receipts ride the bundle, the plugin data and the run report

# the onboard review gate now actually prints, and is pinned (§D.8)
npm run test:onboarding                          # → 40/40
npm run typecheck                                # → the check that caught D.8 all along

# constraints: all five values read, SCALE refused in flow (§D.7)
npx tsx extract/figma/constraints-check.ts       # → 12 assertions

# the published CLI carries the verb the docs open with (§D.4)
npm pack @ds-contracts/cli@0.3.0 && tar -xzf ds-contracts-cli-0.3.0.tgz \
  && grep -c onboard package/dist/cli.js         # → non-zero (0 at 0.2.0)

# every gated number in every doc, re-derived from the repo
npm run docs:check
```

The offline drift instrument (`npm run extract:computed:drift`) and the fidelity
regate (`npm run extract:computed:regate`) each launch a real Chromium and take
five to six minutes; they are the number-level pins behind §C.1.1 and §D.1.

---

# §F — Section crosswalk (old → new)

This document was re-cut on 2026-08-03. Many files cite the old numbering
(CHANGELOG, ROADMAP, docs/00, docs/22, several PROVENANCE files). The old
numbers are not reused; this is where they went.

| old | new |
|---|---|
| §1.1 coverage table | [§C.1.3](#c13-the-per-library-fraction-with-both-denominators) |
| §1.2 whole classes captured nowhere | [§C.1.1](#c11-which-component-archetypes-are-proven--the-actionable-cut) |
| §1.3 the slice is not random | [§C.1.2](#c12-the-captured-slice-is-not-random-and-that-biases-every-average-upward) |
| §1.4 the pipeline can fail and say it succeeded | [§B.10](#b10-at-depth-the-pipeline-can-fail-and-say-it-succeeded) |
| §2.1 overlays lose token names | [§B.1](#b1-overlays-and-portals-lose-their-source-token-names-in-every-library) |
| §2.2 overlays have no state planes | [§B.2](#b2-overlay-components-have-no-state-planes-at-all) |
| §2.3 text wrapping | [§B.3](#b3-text-wrapping-is-not-implemented--a-corpus-wide-gap) |
| §2.4 two-axis geometry / paint | [§B.4](#b4-two-axis-geometry-and-paint-products-have-no-spelling) |
| §2.5 pseudo-elements | [§B.5](#b5-four-pseudo-element-channels-the-reader-has-never-opened) *(two rows reclassified)* + [§A.1](#a1-css-constructs-with-no-canvas-spelling) |
| §2.6 shadow DOM | [§A.4](#a4-out-of-scope-by-decision--not-gaps) (closed roots) + [§B.6](#b6-shadow-dom-depth-3-nesting-is-not-exercised) (depth-3) |
| §2.7 shorthand ceiling | [§C.4.1](#c41-the-shorthand-ceiling) |
| §2.8 no webfonts | [§C.5](#c5-webfonts-load-only-where-a-librarys-capture-config-declares-them) *(now per-library configurable)* |
| §2.9 fidelity gate samples mid-transition | **[§D.1 — CLOSED](#d1-the-fidelity-gate-sampled-mid-transition--closed-task-34)** |
| §2.10 channels with no canvas spelling | [§A.1](#a1-css-constructs-with-no-canvas-spelling) + [§B.7](#b7-flex-basis-is-not-a-carried-channel-anywhere-in-the-pipeline) (`flex-basis`) |
| §2.11 constructs carried that should not be | [§B.8](#b8-two-constructs-the-engine-carries-that-it-should-not) |
| §2.12 named residuals | [§B.9](#b9-named-residuals-that-produce-visible-canvas-differences) |
| §2.13 the round trip | [§C.2](#c2-the-canvascode-round-trip-is-measured-and-it-is-not-lossless) |
| §2.14 constraints | **[§D.7 — CLOSED](#d7-the-engine-substituted-a-constraint-it-never-read--closed)** + [§B.18](#b18-pre-v113-dumps-carry-an-unrepairable-constraint-guess) |
| §2.15 stylesheet ceiling | **[§D.6 — CLOSED](#d6-a-cross-origin-stylesheet-vanished-in-silence--closed)** + [§B.17](#b17-the-corpus-has-not-been-re-captured-through-the-stylesheet-ceiling-instrument) |
| §3 per-library freshness | [§C.7](#c7-per-library-freshness--and-the-two-corpora-this-table-omits) |
| §3.1 Astryx | **[§D.2 — CLOSED](#d2-astryxs-capture-read-its-own-promote-output--closed)** + [§B.20](#b20-astryx-promotes-4-of-its-5-captured-components) |
| §3.2 Polaris | **[§D.3 — CLOSED](#d3-polaris-was-frozen-and-believed-un-recapturable--closed-task-26)** + [§B.21](#b21-five-sandbox-recipes-are-prose-not-committed-bytes) |
| §3.3 stale Polaris showcase number | [§C.8](#c8-a-stale-published-number-in-the-polaris-showcase) |
| §4.1 no GitHub URL / npm package | [§A.3](#a3-the-architecture-the-plugin-cannot-run-your-code) |
| §4.2 adopting a hand-built Figma set | [§B.11](#b11-adopting-a-hand-built-figma-set-is-not-a-verb-this-tool-has) |
| §4.3 reconciliation | [§B.12](#b12-reconciliation-compares-api-surfaces-only) |
| §4.4 concurrent change | [§B.13](#b13-the-concurrent-change-story-is-not-built) |
| §4.5 half a channel | [§B.14](#b14-the-standing-cifigma-channel-is-half-a-channel) |
| §4.6 static path, empty sets | [§B.15](#b15-the-static-no-browser-path-silently-produces-empty-canvas-sets) |
| §4.7 capture configs are expert work | [§B.16](#b16-capture-configs-are-expert-work-and-the-drafter-has-a-known-trap) |
| §4.8 published CLI | **[§D.4 — CLOSED](#d4-the-published-cli-was-not-this-repositorys-cli--closed)** |
| §4.9 dangling token refs | **[§D.5 — CLOSED](#d5-one-emitter-target-shipped-dangling-token-references--closed)** |
| §5.1 – §5.6 instruments | [§C.6.1](#c61-refusing-something-cannot-lower-a-score) – [§C.6.6](#c66-pixel-numbers-carry-conventions-you-need-to-know) |
| §6 out of scope by decision | [§A.4](#a4-out-of-scope-by-decision--not-gaps) |
| §6b the scale wall | [§B.19](#b19-the-scale-wall--intake-cost-is-linear-in-component-count-and-human) |
| §7 how to check this yourself | [§E](#e--how-to-check-this-document-yourself) |

## D.31 The exam SLOT's interior auto-layout — CLOSED

**2026-08-23, r11 (`core/propose-figma.ts`).** The last named slot gap
(§B.24): the native-SLOT branch of `buildPart` computed `primaryAxisGrow`
and returned, so a slot drawn as a padded COLUMN with item spacing — the
held-out kit's Card Content slot — came back as a bare flex item, and
nothing said so (`exact-proposal:check` §49 pinned the slot's `layout` as
exactly `{"grow":true}` so the silence had a shape).

**Disposition: CARRIED, not ledgered — decided by reading.** A SLOT node on
the canvas IS a frame with auto-layout (dump v1.31 captures its `layout`
like any frame's; the REST mapper serializes its layoutMode / alignment /
padding / itemSpacing), and its interior layout is the layout the
consumer's content renders in. The schema already hosts `layout` and
`tokens` on a slot part (42 first-party slot parts carry them —
`ds.empty-state` actions, `ds.accordion-item` contentArea, `ds.tab-list`
tabs); `emit-figma-script` builds the slot spec with `layoutSpec(part)` +
`applyStyling`, and its runtime's `applyFrameSpec` writes layoutMode /
alignment / padding / itemSpacing onto the created slot; `packages/core/
src/css.ts` writes flex-direction / justify-content / align-items / gap /
padding for any part that carries them. Every emitter re-draws what the
proposer now carries, so no receipt was the honest answer.

**The fix.** The SLOT branch walks the same three doors every FRAME and
swap-convention slot-wrapper part walks — `invertNodeTokens` (gap /
padding and the box channels, minted under `mintUnbound` or bound),
`invertLayout` (direction / justify / align / wrap, with r10's primary-axis
`grow` computed inside it by `primaryAxisGrow` — one rule, one
implementation) and `invertLayoutByProp` (the per-variant split) — then
the r9 cross-axis doors, opacity / effects, `nameFixedChildGeometry` and
`attachTokens`, in the FRAME branch's order. Two container rules read the
node class rather than the drawn child count, because a slot with no
design-time content is still a container (its children are the
consumer's): `invertLayout` carries an empty slot's justify / align, and
the itemSpacing mint no longer waits for two drawn children. Nothing is
invented — `accepts`, `defaultContent`, the FC-GEOMETRY-EXCLUDED receipt
and the 152 prior cases did not move.

**Gates:** conformance cases `slot-interior-auto-layout` +
`rest-slot-interior-auto-layout` (authored RED-EXPECTED with the silence
pinned in `observedCheck`, proven red, then re-recorded CARRIED); `npm run
conformance:canvas` (157 cases · CARRIED 110 · LEDGERED 38 · REFUSED 9 ·
157 PASS · 0 RED-EXPECTED — the census merge added the three REST identity
rows `rest-set-description-carried`, `rest-documentation-links-carried`,
`rest-stamped-identity-carried`, all CARRIED); `npm run exact-proposal:check` §49 (now pins
the FULL layout object `{direction, justify, align, grow}` on every shape)
and §50 (the interior facts on their own: the layout block, the three
minted channels, the layoutByProp split); `npm run accuracy:check`
(`accuracy/grammar.json` pins 157 = 110 / 38 / 9); `npm run
emitters:check`; `npx tsx conformance/canvas.ts` (46 cases, 0 SILENT);
`npm run flowbite-dump-propose:check` (8 stems). The Flowbite eight draw no
native SLOT and the first-party `figma/*.figma.js` are emitted from
contracts, not proposed from dumps, so no golden and no figma script
changed.

---

*If you find something this document does not name, that is a bug in this
document, and it is the kind worth reporting.*

## D.32 The two acceptance rows that were red on the commit itself — CLOSED

**Was §B.28.** Two [docs/26](26-v1-definition.md) acceptance commands failed
on the commit they were meant to certify. Each turned out to be the
instrument, not the thing measured (the 2026-08-04 lesson, again).

**V1-CLASS-01 — `npm run extract:computed:drift`.** What §B.28 said: it took
longer than four minutes and dirtied eleven tracked `regate.scorecard.json`
files. What re-measurement found:

- *"Did not complete" was a refusal, not a timeout.* shadcn's capture config
  pointed its Inter face at `examples/shadcn/.shadcn-sandbox/node_modules/…`,
  a gitignored npm sandbox, so on any tree without that sandbox the gate
  threw `fonts: … not found` two seconds in and the check printed only
  "sweep did not complete". The face is now committed under
  `extract/computed/fonts/inter/` (the byte-identical file, the way the
  altitude/mui/astryx faces already were) and the config names it.
- *The writes were the runner's, by design.* `extract/computed/regate.ts`
  wrote its scorecard, gate page and gate shots into the tracked
  `out/<lib>/<comp>/` directory. It now takes `--scorecard-out <dir>`; the
  drift instrument always passes `extract/computed/.drift-remeasure/`
  (gitignored), and the tracked paths are read only.
- *The committed numbers already disagreed with the committed artifacts.*
  Before any re-measure, 20 of the 65 baseline rows did not match the tracked
  `regate.scorecard.json` beside them (astryx ×5, carbon ×10, mui ×3,
  polaris ×2, tailwind ×1 — the baseline's own marker says foreign rows were
  "kept at their previously recorded value" on 2026-08-09 while a concurrent
  wave was to re-record them; it never did), and 39 components (17 mui, 11
  fluent, 6 tailwind, 5 astryx) had a harness scorecard and no baseline row
  at all — which
  the old check skipped in silence (`if (!prior) continue`) while printing
  "65 components match".
- *Where the time goes.* The runner now prints it per component: replay +
  fuse is sub-second (polaris Badge: 0.6 s); the rest is the gate page
  rendered per variant × interaction in Chromium and scored cell by cell
  (polaris Badge: 53.8 s for 240 gate rows / 22,708 cells) — 7–55 s per
  component, proportional to cells (fluent 134,660 cells → 472 s; carbon
  55,204 → 222 s; altitude 6,388 → 53 s; polaris 12 components 739 s, its
  Button alone 84,480 cells), 104 components, ~37 min total on the
  recording machine. There is nothing to cache: the gate IS the render. So
  the instrument was split rather than sped up.
- *One refusal silenced eleven.* An engine refusal inside one component's
  fusion threw out of regate's loop, so the rest of that library was never
  re-fused and the check reported every one of them NOT RE-FUSED. The loop
  now isolates each component (`REFUSED <Component>: <why>` on stderr,
  sweep continues, exit 1 at the end), and the drift baseline can PIN a
  refusal by name (`refused`) — the re-measure then fails if the refusal
  changes or the component fuses again without a re-record. The standing
  case is **polaris Tag**: through the engine at `d5b5b0b1` its re-fuse
  carries `width` on the `link` part as BOTH a token binding
  (`{imported.shared.size-59-9219}`) and a literal (`fit-content`), and the
  validator refuses the ambiguity by name. It fused on 2026-08-09 (the old
  baseline pinned it at 80.521 %). That is a real engine regression this
  PR surfaces and does not fix; it is registered as [§B.29](#b29-polaris-tag-no-longer-re-fuses-offline-an-ambiguous-width-on-the-link-part).

The split: `npm run extract:computed:drift` is now **VERIFY** — no browser,
no writes, ~0.1 s — and holds three committed facts to one another for every
component with a harness scorecard: the baseline row, the committed offline
`regate.scorecard.json`, and the committed `scorecard.json`. An unpinned
component, a stale row, an unnamed gap or two committed numbers that disagree
are each a failure by name. `npm run extract:computed:drift:remeasure` is the
old instrument done right — the full Chromium re-fuse, scored against the
baseline, writing nothing tracked. `--write` re-records both the baseline and
the tracked offline scorecards from one re-measure, so they cannot drift
apart again. The re-record on `d5b5b0b1` pinned 104 rows (was 65): 30 of
the 33 previously-unnamed gaps are the same post-capture vocabulary lift
(N more cells compared than the capture-time engine, every added cell
equal — named per row), three carry changed verdicts (shadcn Alert,
tailwind Blockquote, tailwind Card), none is bisected to a commit.

**V1-JOURNEY-03 — `npm run reconcile && npm run diagnose && npm run
docs:check`.** What §B.28 said: `diagnose` exits 1 with `design BEHIND` /
`design MISMATCH` findings — `Is Required` / `Is Disabled` booleans missing,
`Size` spelt `[Sm, Md, Lg]` vs `[Small, Medium, Large]` — and "whether the
snapshot is stale or the design set is behind is exactly the question the
command cannot answer offline". The 24 findings, each dispositioned:

- **18 — the referee read the wrong contracts.** The built-in default config
  refereed `extract/out/contracts/` — the code-extraction PROPOSALS, whose
  Figma spellings (`Sm`, `Is Disabled`, `Overflow Label`) are the proposer's
  defaults and were never adopted — against a canvas generated from
  `contracts/`, where the adopted bindings say `Small` and `Disabled`. Every
  one of the 18 disappears when the adopted contracts are the input; the
  default now names `contracts/` and says why.
- **2 — `Inline` / `Stack` "no design set".** Same cause: the adopted
  contracts declare `representation: native` (a layout primitive IS the
  canvas capability), which the proposals do not carry.
- **1 — `Button.State` "design AHEAD".** A diagnose-side misread: the
  contract opts into `bindings.figma.statePreviews`, which DECLARES the
  canvas `State` axis; `parity/diff.ts` has compared that axis since v8 and
  `diagnose` never learned the rule. It applies it now, with the same schema
  constants and the same option comparison.
- **1 — the snapshot's age.** Real by the gate's definition (45.6 days), and
  false as a statement about the canvas: read back over the REST API on
  2026-08-23, the live file is identical on every set-level fact the referee
  reads — 49/49 sets, every key, description, variant count and property
  definition; the only move is a `Slot` instance inside `AccordionItem`
  from the native-slots round. The refresh that used to need a human
  pasting a script into Figma is now `npm run parity:snapshot:rest`
  (`parity/snapshot-rest.ts`, read-only, `FIGMA_TOKEN` from `.env.local`);
  it prints what moved before it writes. What it does NOT carry is named in
  its header: variant fingerprints and slot content are plugin-only (the
  snapshot it replaced carried none either), and the variables endpoint is an
  Enterprise surface, so `figma-tokens.json` stays a plugin snapshot and
  `npm run parity` still reports that one file stale.
- **+5 — surfaced only once the above were fixed.** `BentoGrid`,
  `GridGallery`, `PageShell`, `SidebarLayout`, `TwoColumn`: draft contracts
  with null anchors and no set on the catalog file — never generated onto
  it. REAL, and not drift: `parity/diff.ts` routes exactly this case to its
  `pending` bucket, and `diagnose` now does the same, scoped to the
  `parity-snapshot` source (this repo's own canvas) so a foreign kit's
  missing set stays `[design BEHIND]` — the `shoelace-diagnose-prefix-match`
  eval still pins those 30.

The chain exits 0 on the commit. Nothing was weakened: `variant-drift:check`
and `canvas:binding:check` still catch the planted edits, and the eval
family `diagnose-*` is green.

**Lanes now.** fast: `extract:computed:drift` (verify) and `reconcile &&
diagnose`. full: `extract:computed:drift:remeasure`. The `diagnose` step goes
red by design when the snapshot passes 14 days; the fix is the one REST
command above. Commit `a46593b6`.

## D.33 polaris Tag refused to re-fuse: the mint re-minted a channel the promotion had already stated — CLOSED

**Was §B.29.** Found by the repaired drift instrument on 2026-08-23
([§D.32](#d32-the-two-acceptance-rows-that-were-red-on-the-commit-itself--closed)):
`extract/computed/regate.ts` replaying polaris Tag's committed captured truth
through the current engine produced a `link` part carrying `width` as BOTH
`tokens.width = {imported.shared.size-59-9219}` and `literals.width =
"fit-content"`, and `validateContract` refused the ambiguity by name. What
re-measurement found, against what §B.29 said:

- *Not the promoter, and not the committed artifacts.* `packages/cli/src/promote.ts`
  reads `resolved.contract.json`; neither it nor the committed
  `enriched.contract.json` (capture-time engine, 2026-07-29) nor the promoted
  `examples/polaris/contracts/tag.contract.json` ever carried the double
  spelling — the committed `link` carries `tokens.width` alone (and the grid
  tracks as a `grid-template-columns` token, the pre-G1–G5 spelling). The
  double spelling existed only in the OFFLINE re-fuse through the current
  engine.
- *Not fusion choosing between two spellings of one fact.* The promotion had
  already decided. `anatomy.ts gridDefiniteAxisLiterals` (G8, `e16b6f6c`,
  2026-08-08) runs BEFORE the mint and states `literals.width = "fit-content"`
  on a display:grid part whose used box equals its intrinsic track sum
  (59.9219 px = the one fixed column) — the box IS its content, the canvas
  hugs it. The mint then minted the same used box as a fixed token beside
  it.
- *The cause was a silent hole in the "already carried" door.*
  `extract/computed/fuse.ts carriedChannels` — "channels the contract
  carries for a part — BOUND territory; the mint pass never re-mints them"
  — mapped each token / per-prop / literal / state channel through
  `CHANNEL_TO_COMPUTED` with `?? []`. That registry spells shorthands and the
  lifted longhands, not every bounded channel: 45 token/literal channels
  (`width`, `height`, `top`/`right`/`bottom`/`left`, the four paddings and
  margins, `opacity`, `z-index`, `flex-grow`, the grid placement longhands,
  …) resolved to NOTHING, so a part that already stated one of them was
  re-minted as if it stated nothing. The `declared` branch of the same
  function already fell back to the channel's own name. Measured blast
  radius: no capture seed in any of the eight configs carries a token,
  literal, per-prop map or state on any of the 45 (0 hits); the only
  pre-mint writer on them is G8, and the 2026-08-23 full re-measure refused
  exactly one component. The polaris re-record then showed the one other
  effect, and it is a removal of dead weight: avatar, progressbar and
  thumbnail carry root `width`/`height` per size as a REVIEWED
  `literalsByProp` entry, and the old door still minted those per-size
  leaves into the minted tree (5 + 3 + 4 leaves) only for the
  `tokensByProp conflict avoided` merge rule to keep them out of the
  contract — orphan leaves. They are no longer minted; the re-fused
  contracts are deep-compared HEAD engine vs fixed — avatar and thumbnail
  identical, progressbar identical in every fact (its root `tokensByProp`
  keeps the seed's single-entry object spelling instead of being
  re-normalised to a one-element array, because no per-axis addition
  touches the root any more; both spellings read through
  `tokensByPropEntries`) — every percentage is unchanged, and the three
  tracked `regate.scorecard.json` files move only in
  `mintedLeaves`/`baseBindings`. No other library states
  a channel on the list before the mint, so the rest of the corpus is
  untouched.

**The rule (one).** A channel the promoted contract already states —
whichever field states it — is one carrier; the mint never re-mints it.
`carriedChannels` now falls back to the channel's own name in every branch.
For G8 this means the literal wins: `fit-content` is a sizing MODE (HUG)
that a fixed px token cannot spell, and a fixed token beside a hugging axis
would pin the canvas to the base plane's text width; the computed px is the
literal's base-plane consequence, not a second fact. This is the same
verdict the canvas→code proposer already gives (`core/exact-proposal-check.ts`
#41: "height carries as the G8 literal fit-content only — no minted root
height beside it"), so the two directions now agree. The not-minted value is
receipted by name in the extension (`carried-axis-not-reminted: link.width —
the promotion states it as literals.width "fit-content" (grid-axis-definite,
G8); the computed 59.9219px is that literal's base-plane used box, not a
second fact, and is NOT minted beside it`). Where a G8 px literal (used box
larger than the track sum) is stated and the used box varies along a
defaultless axis, the existing `carried-channel-reminted` door still re-mints
the set planes; variation along a defaulted axis stays with the literal, the
same as every other reviewed carriage — named, not hidden.

**Numbers.** polaris Tag re-fuses: offline 81.618 % (6145/7529 cells, 0
unresolved refs) against the committed harness 81.016 % (5996/7401); 128
cells added and 149 more equal, so 21 previously-compared cells changed
verdict to EQUAL — the hugging link, plus five `large.on` remove-button
`background-color` cells the integrated engine resolves to the library's own
fill, `rgba(227, 227, 227, 1)` (this section's 2026-08-23 re-record measured
81.551 %, 6140 equal; the INTEGRATED ENGINE ROUND re-record of 2026-08-24 on
v1-integration is the current pin). The baseline row drops `refused` and
names the gap; the tracked `out/tag/regate.scorecard.json` is the re-record.
The committed capture artifacts and the promoted Tag contract are
UNTOUCHED: the hugging link reaches the canvas at Tag's next recapture (or
a deliberate `regate --write-enriched` + resolve + promote round), which
this round did not run — the recipe's promote step has its own open row
([§B.30](#b30-promote-floor-does-not-reproduce-the-committed-polaris-contracts)).

**One instrument defect on the way.** The re-record could not un-pin a
refusal: `drift-check.ts` pushed "FUSES AGAIN … re-record with --write" as
a failure in BOTH modes, and `--write` refuses to write on any failure, so
the door the message named could never open (measured: the first polaris
re-record ran 762 s and wrote nothing). The re-record now prints the move
and un-pins the row; the re-measure still fails on it.

**Gates.** `npm run extract:computed:drift` (VERIFY) green with no refused
row; `npm run extract:computed:drift -- --write --config
extract/computed/configs/polaris.json` is the re-record; `npx tsx
examples/polaris/generate.ts --check`, `figma:fresh`, `generated:fresh`,
`evals --only polaris,promote-generalization`, tsc, lint, format, docs all
green on the patch. Round r12 (patch over `537022b0`).
## D.34 The Ant Design exam — 44 silent geometry drops, a silent outline width, a silent margin box, a silent state plane, a silent unset plane, a Tag with no label, an error input drawn grey — CLOSED

The held-out code→canvas exam on the hardest library by design
([ANTD-EXAM.md](../parity/receipts/phase-2/ANTD-EXAM.md)). Twelve subjects,
6,007 captured facts, **SILENT 44 → 0** on the capture side, and five heal
iterations on the scratch canvas until every set passed "I can tell what
this is" beside the library's own render. What it closed, each with its
case or screenshot pair:

- **FC-GEOMETRY-EXCLUDED never ledgered per part** — 46 width/height facts
  on Tag/Input/Avatar/Progress/Card refused by nothing anyone could grep.
  `styledChannels` writes one `geometry-excluded:` line per part (the
  Option B obligation, met).
- **Token-named geometry is a design value** — `height: var(--ant-control-height)`
  was refused as environment-dependent; buttons drew 18px tall. A dimension
  the library's stylesheet binds to a token now joins fusion with its name
  (`token-named-geometry-admitted`).
- **The outline PAIR** (case `antd-focus-outline-ring-ua-width`) — antd's
  3px focus width equals Chromium's `medium`, never differed between planes,
  and the canvas ring had no width. The plane's width rides the state
  whenever its style/colour changed.
- **The state plane's refusals ride the contract** (schema v18
  `Part.codeOnly`, W4) — a nested part's focus ring refused by v13 landed
  only in capture-side sidecars; `figma bundle` compiles its facts from the
  contract. 122 `capture`-kind facts on the antd sets.
- **The margin box's four silent exits** (case `antd-empty-margin-only-parts`)
  — FILL / grow / out-of-flow / the empty-frame #60 default returned without
  a word; `FC-EMIT-MARGIN-BOX-SKIPPED` names each side (5 committed
  contracts gained receipts).
- **The undrawn state plane** — with `statePreviews` off every state binding
  was unbuilt in silence; `FC-STATE-PLANE-UNDRAWN` (18 committed contracts
  across 8 libraries gained receipts; the wall itself is §B.34).
- **The undrawn unset plane** — a defaultless axis's library-default
  rendering (antd's red Badge) had no cell and the proposal called the first
  enum value the default; `FC-UNSET-PLANE-UNDRAWN`.
- **A root's prop-bound text beside parts** (Tag) drew no text node; the
  compile receipt's text pin was the only witness. `rootTextSpecs` hosts it.
- **Presence-driven channels dropped whole** — Alert's padding and icon gap
  vanished because `description` changes them; the presence-OFF plane is
  carried, the ON plane named.
- **`flex-grow` minted as an annotated token, never `layout.grow`** —
  Progress's track drew 0 wide; uniform `flex-grow ≥ 1` (and a child that
  measures a non-block root's content box) carries `layout.grow`, and the
  meter fraction is re-applied after layout.
- **A wrong fact on the canvas** — Input's `status × variant` border: the
  pair-with-unset carriage wrote the unset-plane map after the named-plane
  map and `resolveTokens` merges in order. Defaultless-axis maps sort last.
- **`border-style` that varies by an axis** drew SOLID (Button `dashed`);
  it carries as `stylesWhen` per value and lowers to a `dashPattern`.
- **Pseudo-decor `scale()` and margins** (W5, the scale half) — Radio's dot
  revealed by `scale(.375)` folds into a centred 6×6 ellipse; the pseudo's
  own margins fold into its offset.
- Instrument defects: `seed-gen`'s case-sensitive lookup (W1 — the recon
  blamed the tuple grammar; re-measurement blamed the lookup), the
  closed-shadow suspect on every svg `<path>`, the settle probe blind to
  `outline-width`, the unset materialization missing the VARIANT values map.

Gates: `npm run conformance` (91 cases), `npm run conformance:roundtrip`
(54, 0 SILENT), `code-only-facts:check`, `dagger:census`, `figma:fresh`,
`docs:check`, the drift baseline (12 antd rows).

## D.35 The built Playground shipped an EMPTY emitter registry — CLOSED

Found 2026-08-23 by the integrator walking the **built** Playground
(`npm run build:playground` + `vite preview`, Playwright over both guided
tours): the Code → Figma walkthrough's Script step refused `no emitter
registered as "figma-script"`, and the output tab strip (React / HTML + CSS /
React inline / Figma script) was empty. The dev server showed none of it.
Cause: the root `package.json` declares `"sideEffects": ["**/*.css"]`, so the
production bundler (Rolldown under Vite 8) treats `core/emitter.ts` as
side-effect free and drops its load-time registration loop whenever no
value export of that module is referenced — `playground/src/pages/Playground.tsx`
imported only `emitters` (the bare array in `packages/core/src/emitter.ts`).
Reproduced on `origin/main` at `e6225760` by building the playground from a
worktree with no other change: the bundle carried no `registerEmitter` and
no emitter label, so the limitation predates this round and was live in any
deploy built from that state (the 2026-08-17 deploy's bundle still carried
them). Closed by `playground/src/engine/emitters.ts`: the registry is the
value of a call that registers any missing built-in and refuses at load if
one is still absent; `playground:flow-check` (a `maintain` step) pins that
`Playground.tsx` reads the registry through that module. Marking
`core/emitter.ts` in `sideEffects` was tried and rejected: esbuild honours the
same field, and the plugin engine bundle grew past its committed 811,089
bytes (`figma-sync/plugin/engine.receipt.json` refused the grown bundle).

## D.36 The control baseline was POLLUTED — the harness mounted its controls inside the library's own page, so real facts were subtracted as user-agent defaults — CLOSED

Found 2026-08-24 by the door register (`spec/DOOR-REGISTER.md`, door
`capture.control-baseline-mint`). One `if` in `extract/computed/fuse.ts`
decides whether a computed value is a fact of the component:

```ts
if (a.baseFlat[pi].node.style[p] !== ctrl[p]) set.add(p);
```

`ctrl` is supposed to be the **user agent** — the only thing a generated
surface inherits, because `emit-html`, `emit-react` and the Figma mint ship
the component's own CSS and no page chrome at all. It was not. The harness
rendered its four control elements (`button` / `span` / `a` / `div`) **inside
`mount.wrapperOpen`, in the same document as the component**, so every
page-global rule a library ships styled the control too:

| library | the page-global rule | what the bare `<span>` control read |
|---|---|---|
| shadcn | `* { border-color: var(--border) }` | `border-*-color: oklch(0.922 0 0)` |
| shadcn / tailwind / astryx | preflight `* { border-style: solid; border-width: 0 }`, `html { tab-size: 4; -webkit-text-size-adjust: 100% }` | `border-style: solid`, `box-sizing: border-box` |
| polaris / fluent | the provider's body ink and family | `color`, `font-family`, `line-height` |

The component's real value then compared EQUAL to the control and was dropped
as "not a fact of this component" — while the channels the control did NOT
carry shipped. The shadcn Input shipped `border-top-width: 1px` with **no
colour** (a border that paints nothing) and Polaris/Fluent text shipped with
**no ink**. Both are the owner-rejected sets, and neither loss produced a line
anywhere.

Five patches in `styledChannels` had already been written against symptoms of
this one cause, each admitting one channel family by hand:
`reset-supplied-border-style-admitted`, round 5c's text-part
`font-size`/`line-height`/`font-weight`, the altitude round's `font-family`,
and `svg-host-color-carried`. They are now special cases of the rule rather
than the rule.

**What changed.** `extract/computed/capture.ts` gains `captureUaControls`: the
same four elements, in the same stage box, on a page carrying the browser and
`color-scheme` and **nothing the library ships** — no stylesheet, no
`@font-face`, no provider, no preScript. That page is a function of (browser,
colour-scheme, stage) only, so the baseline is **library-independent by
construction** — which is why it can be measured for an already-committed
capture without the library's harness existing
(`extract/computed/ua-baseline-backfill.ts`, gated by
`npm run ua-baseline:present:check`). `fuse.control-element-delta` subtracts
that baseline, and leaves a receipt when it does: `control-equal-drop` (how
many channels were subtracted, and against which baseline),
`page-global-baseline-corrected` (each channel the in-page control would have
cancelled, with both baselines quoted), `control-equal-drop-authored` (a
dropped channel the library's own stylesheet declares) and
`ua-baseline-missing` (a capture taken before the fix — the fallback names
itself rather than passing for a clean subtraction).

**Two narrowings, both deliberate.** Custom properties (`--*`) keep the
in-page baseline: a `:root` token block inherits onto every element, and
against a UA baseline all ~90 of a library's tokens would "differ" on every
part only to be refused downstream as "not a styled channel". And the in-page
probe is still recorded, because the DIFFERENCE between the two baselines is
the evidence that a value came from the library's page-global CSS.

**Measured, offline re-fuse of all 116 committed captures.**

| library | comps | parts | carried before | carried after | newly carried | of those, token-bound | dropped (proved equal to the UA default) |
|---|---:|---:|---:|---:|---:|---:|---:|
| altitude | 8 | 13 | 278 | 374 | +96 | 3 | 0 |
| antd | 12 | 68 | 1,866 | 1,866 | +0 | 0 | 0 |
| astryx | 10 | 64 | 1,182 | 2,133 | +979 | 0 | 28 |
| carbon | 10 | 102 | 2,108 | 2,846 | +946 | 3 | 208 |
| fluent | 11 | 57 | 1,261 | 1,651 | +431 | 5 | 41 |
| mui | 31 | 191 | 5,117 | 5,242 | +125 | 0 | 0 |
| polaris | 12 | 122 | 2,246 | 3,721 | +1,563 | 11 | 88 |
| shadcn | 11 | 34 | 787 | 1,243 | +456 | 27 | 0 |
| tailwind | 11 | 22 | 396 | 583 | +187 | 0 | 0 |
| **total** | **116** | **673** | **15,241** | **19,659** | **+4,783** | **49** | **365** |

antd moves by **zero** cells: it injects component CSS through cssinjs with
scoped class names and ships no page-global rule, so its in-page control and
its UA control already agreed. That is the no-noise half of the measurement —
the change carries what a library declared page-globally and nothing else.
The 365 drops are the mirror: a value that compared EQUAL to the polluted
control's `solid` while the component itself computed the UA's `none` was
being carried as a "fact"; it is dropped now because a generated surface
renders it identically without it.

**What that does to the offline re-fuse baseline** (`extract:computed:drift
-- --write`, the full 116-component re-measure). The scores fall, and they
fall for the right reason: the denominator stopped coming from the filter
that decides carriage. 193,716 (part, channel, combo) cells that the polluted
baseline had removed from comparison are now compared, and the ones the
emitters do not reproduce are counted as unequal instead of being absent.

| library | rows | rows moved | cells compared before | after | mean pctEqual delta |
|---|---:|---:|---:|---:|---:|
| altitude | 8 | 8 | 6,388 | 8,012 | −2.74 |
| antd | 12 | **0** | 134,068 | 134,068 | 0.00 |
| astryx | 10 | 10 | 34,616 | 54,768 | +1.33 |
| carbon | 10 | 10 | 55,204 | 77,108 | −0.86 |
| fluent | 11 | 10 | 134,660 | 158,226 | +1.74 |
| mui | 31 | 14 | 120,389 | 123,444 | −1.55 |
| polaris | 12 | 12 | 202,841 | 314,581 | −5.12 |
| shadcn | 11 | 11 | 23,001 | 28,836 | −9.06 |
| tailwind | 11 | 10 | 14,112 | 19,952 | −2.68 |
| **total** | **116** | **85** | **725,279** | **918,995** | **−2.04** |

18 rows rose, 67 fell, 31 did not move. Every moved row carries a named
`gapCause` in `extract/computed/regate-baseline.json`. The committed HARNESS
scorecards are unchanged and now sit above the offline numbers: they predate
this door, and only a re-capture closes that gap — a later wave owns the
library lanes.

**One channel the fix had to register.** `html { tab-size: 4 }` is the first
line of every Tailwind-preflight-shaped reset (shadcn, tailwind, astryx). Its
UA default is `8`, so the isolated baseline carries it — and it reaches the
mint as a plain NUMBER, which is a mintable kind, so it landed in `tokens` on
32 components' contracts and `validateContract` refused every one of them by
name (the mint decides by value SHAPE, the schema decides by channel
REGISTRY, and a channel that passes one and fails the other quarantines the
whole component). It is registered in `TOKEN_CHANNELS` as `annotate` /
`verbatim` — a real CSS property the library authored, with no Figma field.
Nothing else in the corpus needed registering: the other page-global channels
the isolated baseline carries (`color-scheme`, `text-size-adjust`,
`text-rendering`, `font-feature-settings`, `appearance`, `cursor`,
`scrollbar-color`, `position-anchor`) are keyword-valued, so they land in
`declared` or in `codeOnly` as NAMED facts. Two of those — `color-scheme` and
`text-size-adjust` — are now in the fidelity denominator and score UNEQUAL,
because the component has them and the generated surface does not. That is
the point: a channel the filter never opened used to score 100% by absence.

**The two cases the fixture never had.** `conformance/cases/page-global-star-rule`
ships `* { border-color: … }` with the width and style declared locally, and
`conformance/cases/page-inherited-ink` ships `body { color: … }` with a
text-bearing part that declares no colour. Before the fix they measure
**SILENT-LOSS** and **WRONG-NAME**; after it both are CARRIED. The fixture had
no page-global rule of any kind, which is why the whole defect class sat
outside its denominator.
## D.37 Thirty-seven captures with two browsers stapled into one evidence file — OPEN, counted, and gated

`extract/computed/capture.ts` stamps two browser facts into every
`captured-truth.json`, each asked of the live instance and each correct:
`_provenance.browser` (the browser the component was captured on) and
`_provenance.uaBaselineBrowser` (the browser the UA CONTROL was measured on).
**37 files disagree**: `altitude` 8, `carbon` 10, `mui` 14, `tailwind` 5 —
captured on Chromium 149.0.7827.55, UA control measured on 151.0.7922.34. The
class arrives with #45's UA-baseline backfill, which ran later, on the stray
browser; it landed on `main` with PR #49 (measured first on the branch that
became it, where `main` still carried zero).

The capture receipts are not lying — that honesty is what made the defect
findable. What is wrong is the COMBINATION. The styled-channel door
(`fuse.control-element-delta`) subtracts a control measured on browser B from a
component captured on browser A, so any channel whose computed value merely
CHANGED between the two is carried as though the library authored it.
`position-anchor` is the measured instance: `none` in 149, `normal` in 151, so
base and control disagree and the channel is carried on exactly these 37
components — which is why the pinned re-record moved exactly 37 rows and not one
more (PR #49).

**The numbers derived from them are correct.** #49 re-recorded the drift
baseline under the pinned browser, and all 51 rows CI had an opinion about
reproduce CI exactly. What remains suspect is the underlying EVIDENCE: those 37
captures still mix two browsers, so the set of channels they carry is slightly
wider than a single-browser capture would produce.

**Why it is still open.** Repairing it means re-running
`extract/computed/ua-baseline-backfill.ts` under the pinned resolver AND
re-recording the drift baseline in the SAME round — the two must move together,
because the backfill changes what the door subtracts and therefore every
`cellsCompared` on those rows. Doing either alone leaves the tree
self-contradictory. That round was deliberately not folded into the browser-pin
fix.

**It cannot grow silently while it waits.** `npm run mixed-browser:check`
(`scripts/mixed-browser-capture-check.ts`, fast lane) scans every committed
`captured-truth.json`, prints the per-library breakdown every run, and FAILS if
the count exceeds a committed allowance of 37. It deliberately does not fail
when the class shrinks — it prints that the allowance is stale, because the
honest end state is 0 and tightening it is a reviewed act. Raising the allowance
is not the fix and must never be the whole change.

## D.38 Generated code declared no font family when the design used Inter — CLOSED for React, React inline and web components; OPEN on static HTML

**2026-09-18. A product decision the owner delegated; recorded so it can be
reversed.** The proposer never carries Inter: door
`propose.font-family-inter-is-default` drops it as "the pipeline's own default —
absence already renders it", and carrying it would break the exact round trip of
every generated set. That premise held for the Figma writer and was **false for
every code emitter**: they declared no `font-family`, so text inherited the HOST
page's font — the browser's serif in a clean consumer. Measured with
`npm run design:consumer:check` on the 72-variant CBDS Badge: 0 of 72 variants
inside the 5 % limit (10.25–52.10 %).

**Decision.** "No declared family" MEANS the pipeline default family, and the
emitters say so. The proposer is unchanged. One definition of the default
(`DEFAULT_FONT_FAMILY` / `DEFAULT_FONT_STACK`, `@ds-contracts/schema`), read by
the proposer and all three emitters.

**Form.** `font-family: Inter, system-ui, sans-serif` — a literal stack, not a
token reference. A foreign corpus (design-led `imported.*` tokens) defines no
family token, a `var()` naming one would be an undefined custom property in a
clean consumer, and a corpus whose sans token is not Inter would make code
disagree with the canvas.

**Placement** (`defaultFontFamilyParts`, `packages/core/src/anatomy.ts`). A part
that DRAWS text — `content`, a non-empty `text`, the single root's `children`
text prop, a text-entry control — where neither it nor an ancestor part names
`font-family` in any holder. A family stated anywhere is kept; slots and
instances are not the contract's own text and gain nothing; a textless contract
keeps its bytes. It is pushed last in the base rule because the UA resets spell
`font: inherit`, a shorthand that erases a family written before it. The
first-party `src/components` regenerated byte-identical (every text part already
binds a family token); 30 example stylesheets and 7 held-out stylesheets gained
the line, additions only.

**Measured after.** Same check, same inputs, same unchanged limit: 18 of 72 pass
(1.91–51.54 %, median 9.01 %). The remaining failures are the causes already
named: a Figma stroke takes no layout space while a CSS border does (all 24
outline variants fail on size), and small-size text metrics.

**What this does not do.** It does not deliver the FACE. The consumer check ships
no font and only probes availability by width; both measurements above ran on a
machine with Inter installed system-wide. Without it the declaration resolves to
`system-ui` and the check names `font-unavailable-in-consumer`
(`FC-FONT-SUBSTRATE`, unchanged).

**Still open.** `core/emit-html.ts` declares no family either — and emits no
`declared` facts at all, so a carried family is lost there too. It is a preview
surface outside the React + WC core scope; named here, not fixed.

**To reverse.** Delete the `defaultFamily.has(…)` pushes (`css.ts` ×3,
`emit-react-inline.ts`, `emit-wc.ts` ×2) and regenerate; or make the proposer
carry Inter and accept the round-trip cost. **Gate:**
`core/react-default-font-family.test.ts` (`npm run react:conformance:check`).

## D.39 A designer's Figma stroke takes no layout space; the CSS border it lowered to did — CLOSED for React, React inline and web components; OPEN on static HTML

**2026-09-18. A lowering decision the owner delegated; recorded so it can be
reversed.** On an auto-layout frame a Figma stroke takes layout space only when
the frame says `strokesIncludedInLayout`; a designer-drawn frame defaults to
`false`, so the stroke paints over the padding and the box is content + padding.
Neither reader captured the field, the proposer lowered every stroke to
`border-width` / `border-color`, and a CSS border grows the box. Measured with
`npm run design:consumer:check` on the 72-variant CBDS Badge (after §D.38): all
24 outline variants failed on size — 4 px too wide, and the 16 px-high small one
20 px high, because 8 + 8 px padding plus a 2 px border cannot fit a 16 px border
box at all.

**Decision.** Keep the designer's numbers. Padding stays the contract's padding:
it is usually bound to a spacing variable, and rewriting it to "padding minus
border" destroys the binding (and still cannot fit the 16 px box). The contract
records the one fact that differs, under Figma's own name, and only its
non-default value: `Part.strokesIncludedInLayout: false`. The stroke keeps riding
`border-width` / `border-color` (and the per-side widths of dump v1.34), tokens
stay bound, and each surface draws it without taking space.

**What absent means, and why nothing already minted changes.** The Figma writer
has never set the field. Frames it creates read back `true`: measured on the
committed census responses (`extract/figma/fixtures/census-d2c/*.rest-nodes.json`),
160 of 160 auto-layout frames in pipeline-generated sets report `true` and 0 of
the designer-drawn ones do (REST omits `false`). `true` is also exactly what a
CSS border under `box-sizing: border-box` means. So ABSENT = in layout = every
existing contract's meaning; `true` is never written; a generated set proposes
back to its own contract; and the writer's script is byte-identical for every
contract without the flag (the runtime names the field only when a spec carries
it, and then writes it both ways so an amended root is put back). A designer can
also choose `true` — the Altitude Tabs header does, which is why its 1 px rules
occupying layout matched Figma's 176 px in §CURRENT row 2 — and that proposes no
flag.

**Readers (dump v1.35).** Both write `strokesIncludedInLayout` on an auto-layout
frame that draws a visible stroke, and then always, `false` included (REST: an
absent response key is the fact `false`; plugin: the node's boolean). An ABSENT
dump field still means "not captured" (dump ≤ v1.34, or a canvas that reports
nothing), never `false`: older dumps propose the bytes they always did. A node
drawn both ways across its variants is NAMED and keeps the border
(`propose.stroke-layout-mixed-refused`); a flag whose stroke channels were all
refused is withdrawn by name.

**Form.** An inset `box-shadow` ring: `inset 0 0 0 <w> <c>`, or one layer per side
(`inset 0 <t> 0 0`, `inset 0 -<b> 0 0`, `inset <l> 0 0 0`, `inset -<r> 0 0 0`) when
the part carries per-side widths. It paints inside the border box, under the
content, follows `border-radius`, and takes no space. Not `outline` with a
negative offset: that is the focus ring's property, and a `:focus-visible` rule
would erase the border. Because width, colour and a real shadow each vary on their
own axis and `box-shadow` is one property, the stylesheet surfaces rename the
channels to private custom properties wherever they sit (`--_stroke-width`,
`--_stroke-color`, `--_stroke-<side>-width`, `--_stroke-shadow` — an underscore is
refused in a token path, so no token can collide) and the part's base rule
composes them once, the ring BEFORE any real shadow so both survive in every
state (`lowerStrokeRings`, `packages/core/src/anatomy.ts`). Token-bound values stay
`var(--token)`. The base rule always states every variable it reads, so a nested
flagged part never inherits its ancestor's stroke. With the width gone from the
maps nothing synthesises `border-style: solid`, and a root falls to its ordinary
`border: 0` reset. The inline surface cannot use custom properties (not
`CSSProperties` keys; its claim is resolved literals), so it composes the same ring
at render time over the merged style record, the consumer's `style` included
(`strokeRing`). `outline-*` channels are untouched: an outline never takes
layout space. `generate`'s tokens.css gate no longer demands a `--_` variable the
sheet itself declares.

**Refused by name** (`validateContract`): the flag on a part with no stroke
channel; the flag together with a per-side border colour or a declared /
conditional `border-style` — the ring is one-colour and solid.

**Measured after.** Same check, fresh read-only REST read of the same set (the
dump differs from PR 124's only by the new field, on the 24 outline variants),
same unchanged 5 % limit: **28 of 72 pass** (was 18), 1.16–17.09 %, median 5.47 %
(was 1.91–51.54 %, median 9.01 %).

| style × size | pass before | pass after | before (min / median / max) | after (min / median / max) |
|---|---|---|---|---|
| fill × large | 6/12 | 6/12 | 3.42 / 4.84 / 8.27 % | unchanged to the digit |
| fill × small | 3/12 | 3/12 | 4.04 / 7.10 / 11.86 % | unchanged to the digit |
| tonal × large | 8/12 | 8/12 | 1.91 / 4.23 / 6.18 % | unchanged to the digit |
| tonal × small | 1/12 | 1/12 | 4.43 / 10.16 / 15.05 % | unchanged to the digit |
| outline × large | 0/12 | **7/12** | 9.17 / 10.83 / 13.40 % | 1.16 / 3.56 / 7.86 % |
| outline × small | 0/12 | **3/12** | 36.35 / 44.49 / 51.54 % | 2.21 / 11.07 / 17.09 % |

"Before" is the same contract with the flag removed, generated and scored in the
same session — it reproduces §D.38's 18 of 72 (1.91–51.54 %, median 9.01 %)
exactly. The 72 × 3 images are not committed here: the set's evidence directory
belongs to the change that introduced it (PR 124), and the receipts of both runs
were produced by the check itself.

Every outline variant now has the height Figma drew (24 / 16 px), and the outline
rows have exactly the size profile of the fill and tonal rows (13 of 24 equal, 11
one pixel wider): what is left is the shared small-text metric, not the stroke.
The design-to-code census now counts the fact (47 occurrences on the figma-ds
designer sets, all carried; 2,857 → 2,904 carried, 0 silent); the Flowbite sets —
generated by this pipeline — did not move.

**Hardened after an adversarial review (PR 128, same day).** Each was measured
in Chromium before and after:

- **Forced colors.** Windows High Contrast forces `box-shadow: none` while a
  border survives, so an outlined control lost its ONLY boundary. Every ring
  part now carries, directly after its base rule on the CSS-module and
  web-component sheets, `@media (forced-colors: active) { <part>:not(:focus-visible)
  { outline: <w> solid CanvasText; outline-offset: calc(-1 * <w>) } }` — an inward
  outline takes no layout space and is not forced away, and it exists inside
  that media query only, so everywhere else `outline` stays the focus ring's.
  `:not(:focus-visible)` makes focus win, including the USER AGENT's ring, which
  an author `outline` would otherwise outrank. Per-side strokes get a FULL
  outline at the widest side (`max(...)`): an outline has no sides, and in the
  one mode whose point is visible boundaries a too-complete edge is the smaller
  loss — **named, an approximation**.
- **Nested native elements.** Only the single root had a `border: 0` reset, so a
  flagged `<button>` / `<fieldset>` PART showed the UA's 2px outset / groove
  border again. Every ring part now states `border: 0` on all three surfaces.
- **A unitless `0` side** made `calc(-1 * 0)` a number, not a length, and voided
  the whole declaration; literal zero widths are composed as `0px` (both
  composition sites).
- **A shadow TOKEN that resolves to `none`** — 60+ in this repo's corpora,
  concentrated on outlined variants — voided `<ring>, none` and took the stroke
  with it. The emitters that are handed the token trees (every registered one)
  now settle it on the finished sheet: inside the ring's private variable ONLY,
  a reference to such a token becomes the no-op layer; tokens.css and ordinary
  `box-shadow: var(--x)` keep their bytes. A token that is `none` in one mode
  and a shadow in the other is REFUSED BY NAME, and so is a ring that binds a
  shadow token when no values were supplied (a bare `emitReact`): the deciding
  fact cannot be checked from paths, and the pipeline does not guess. The
  inline surface resolves values and drops `none` at render time, so the two
  agree.
- **Inline consumer `style`.** Spread after the ring, a caller's `boxShadow`
  silently deleted the stroke and a caller's `borderColor` did nothing. The
  caller's style now joins the merge BEFORE the ring is composed: `borderColor` /
  `borderWidth` / per-side widths restyle the ring (they are the same contract
  channels), `boxShadow` follows the ring, and a `border` shorthand is passed
  through untouched (the record's own is only ever the `0` reset).
- **The tokens.css gate's `--_` exemption** matched file text; it now requires a
  DECLARATION of that exact property (after `{` or `;`, comments removed), so a
  comment, a longer name or a bare token value no longer exempts anything.
- The lowering is registered (`css.stroke-outside-layout-inset-ring`,
  `spec/lowering.json`) with its declared inverse, `carryStrokeLayout`.

**Named limits.**

- **The contract cannot take the flag back OFF an existing set.** A script for a
  contract with no flagged part never names the field — that is what keeps
  every existing contract's script byte-identical — and amend reuses the variant
  nodes, so a canvas that once held `false` keeps it, and the next read proposes
  the flag back. It is a contract/canvas DIVERGENCE the contract cannot
  currently fix (a designer can, in Figma's auto-layout settings); not silent —
  the proposal shows it — and pinned by a test so it cannot become so. Inside one
  script that carries the fact, unflagged flex frames ARE written `true`. The
  amend path has no prior-canvas read to key a wider fix on, and none was
  invented. The plugin's drift snapshot does not list the field either.
- **Paint order, UNMEASURED.** The ring paints UNDER the part's children; a Figma
  frame stroke is believed to paint OVER them. It matters exactly where a child
  reaches the stroke: padding smaller than the stroke weight, or an edge-to-edge
  child (measured in Chromium: a full-bleed child covers the ring; the border it
  replaced pushed the child inward instead). Left as is until measured on a
  canvas; an `::after` overlay (inset 0, `pointer-events: none`) is the candidate
  fix, at the cost of a positioning context and no spelling on void elements.
- **Inline surface, forced colors.** Inline styles cannot carry a media query
  (the emitter's only media-dependent output is the `<style>` it injects for
  keyframes, a child a void root cannot hold), so a flagged part has NO boundary
  in Windows High Contrast there.
- A declared `transition: border-color` no longer animates the ring (the colour
  rides an unregistered custom property). Printing usually drops box-shadows
  with background graphics, where a border prints. The flag on a SHAPE part is
  accepted and meaningless (shapes are not auto-layout frames). The Playground's
  canvas preview (`playground/src/engine/canvas-preview.ts`) ignores the flag.
- A width TOKEN that resolves to a unitless `0` on a per-side part cannot be seen
  by the emitter. Per-side layers overlap at the corners, so a translucent stroke
  colour doubles there. The mock canvas does not model the field (it reports
  nothing, which reads as "not captured"). An OUTSIDE (outline) stroke records
  the flag for the canvas's sake; its frames born `true` are a pre-existing
  difference this change does not touch. An unflagged GRID frame inside a
  flagged script is deliberately not written (the Plugin API documents the
  field for HORIZONTAL / VERTICAL layout); a FLAGGED one is.
- **Exercised live.** The writer line ran on a real canvas on 2026-09-18, on
  COMPONENT, `createSlot()` SLOT and GRID nodes, with no throw, and a REST
  readback matched the predicted boxes exactly: a hugging root 60×37 → 56×33,
  a FILL slot 180×60 → 184×64, a root hugging a fixed grid 140×60 → 136×56.
  The unflagged controls read `true` on root, slot and grid — the premise
  "absent = in layout" holds on the canvas, not only in the committed census
  responses — and the flagged GRID frame's key is absent from REST, i.e. Figma
  honours the write on GRID. The evidence is private.

**Still open.** `core/emit-html.ts` ignores the flag and still draws a
space-taking border: a preview surface outside the React + WC core scope (and the
surface the computed gate scores through); named here, not fixed. The code-led
native path (`source-reference/`, `core/native-*`) is unchanged by design.

**To reverse.** Delete `carryStrokeLayout` / `settleStrokeLayout` and their three
doors in `core/propose-figma.ts` (no contract then carries the flag and every
surface emits what it did); or keep the capture and delete the
`lowerStrokeRings(input)` calls (`css.ts`, `emit-wc.ts`) and the `strokeRing` wrap
in `emit-react-inline.ts` to fall back to a space-taking border. The schema field
and the dump field are additive and can stay. **Gates:**
`extract/figma/stroke-outside-layout.test.ts` (`npm run exact-proposal:check` —
both readers, proposer, writer round trip through the real plugin reader) and
`core/react-stroke-outside-layout.test.ts` (`npm run react:conformance:check` —
all three surfaces, box and shadow MEASURED in Chromium).

## D.40 A designer's component set is rarely the full product of its axes; the exact projection refused every one — CLOSED for undeclared sparseness; the interaction-state wall and the code-side composition stay NAMED

**2026-09-19. A schema decision the owner delegated; recorded so it can be
reversed.** `core/exact-projection.ts` holds a structured Figma component set to
the full Cartesian product of its VARIANT axes and refuses anything else as
`EXACT_MATRIX_RAGGED`. That strictness was deliberate (commit 8f879e147) and is
kept. But designer-authored sets are often not a product. Measured read-only on
two designer files: CBDS `Checkbox-icon` 42 of 48 (no `state=disabled` with
`error=true`), CBDS `Alert` 30 of 40, and in Altitude 7 of 40 sets — `Menu Item`
16 of 18, `Breadcrumbs Item` 10/12, `Checkbox` 26/30, `Pagination Item` 12/16,
`Progress` 10/16 (a bar is drawn at one size, a circle at four), `Radio` 18/20,
`Toggle Button` 20/24. Every one refused, so a composed family could never
replace its auto-proposed child STUB with the real child set.

**Decision.** The contract DECLARES what is not drawn, as a Figma-only fact where
schema 17 puts Figma-only facts:

```jsonc
"bindings": { "figma": { "absentVariants": [
  { "state": "error", "checked": "on", "label": "shown" },
  { "state": "error", "checked": "on", "label": "hidden" }
], "anchors": { … } } }
```

Each entry is ONE COMPLETE tuple over the contract's variant axes — every enum
prop and every `VARIANT`-bound boolean, keyed by PROP NAME; an enum axis takes a
canonical value, a boolean axis a JSON boolean, an axis with `unsetValue` may take
`null` for that canvas-only option. **Why tuples and not patterns:** the measured
holes are slices (`state=disabled × error=true`), and a pattern would be shorter —
but a pattern list has many spellings for one set of cells and a tuple list has
exactly one. The list is canonical (tuples in the product's enumeration order,
first axis slowest, options as declared) and duplicate-free, so a round trip is a
fixed point. The order of KEYS inside a tuple is deliberately NOT part of validity
(review, PR 130): a JSON object is unordered, and any tool that sorts keys — `jq
-S`, this repo's own `canonicalJson` — must not turn a sound contract into a
refused one; every reader keys a tuple in axis order regardless
(`absentVariantKey`). **Why prop names and canonical values, not Figma labels:** the
referee can hold the list to the contract's own props without a second vocabulary,
and re-labelling a Figma option does not invalidate it; the writer, the proposer
and the exact projection translate through the props' `VARIANT` bindings. One
reader serves all three (`absentVariantAxes` / `absentVariantKey` /
`absentVariantIssues`, `packages/schema/src/contract-schema.ts`). Additive and
optional: no schema version bump, following `strokesIncludedInLayout` (§D.39).

**Nothing is weakened.** `validateExactVariantProjection(set, returned, {
absentVariants })` expects the product MINUS the declaration, exactly: a drawn
cell the list calls absent is an extra row, an undrawn cell it does not name is a
missing row, and a returned contract that would draw an undrawn cell is
`EXACT_ROWS_EXTRA`. The validator never infers a declaration — a ragged source
handed to it without one refuses with the same code AND the same message as
before. An unreadable or disagreeing declaration (not a list, empty, a partial
tuple, an unknown property or option, a duplicate, a list that leaves nothing) is
IGNORED and the full product is expected, which then refuses: a declaration can
only fall back to the stricter reading, never widen what counts as exact. A set
that declares a state-preview matrix keeps that expectation and the list is not
composed with it.

**Who may declare.** A DESIGNER's set declares by what it draws: when its rows are
a STRICT SUBSET of the product (every row valid, none duplicated, none outside the
product), the proposer reads the undrawn cells once (`deriveAbsentVariants`), writes
them into the proposed contract, and the source and the returned rows are both held
to the product minus that list. "A designer's set" means: no `ds_contracts/*` stamp
**and a reader that could have SEEN one.** The review (PR 130, H2) measured the hole
in the first cut: `mapRestToDump` is a public entry and stamps dump v1.35
identically whether or not the REST response carried `sharedPluginData`, so the
SAME pipeline-written set that lost a variant refused with the plane and proposed
`absentVariants` as `verified-exact` without it. "Unstamped" is evidence of a
designer only when a stamp was observable, and that is now a POSITIVE reader fact
(`dumpStampsObservable`, `opts.stampsObservable`, default false — fail closed):

- the plugin reader always reads the stamps; it is recognised by the provenance
  note it has always written plus dump ≥ v1.26 (the contract-id stamp);
- the REST mapper writes `_provenance.stampsObservable: true` ONLY when its caller
  says the request carried `plugin_data=shared` (`MapOptions.stampsObservable`). The
  request parameter is not echoed in the response, so only the fetch layer can
  know: `extract/figma/rest/fetch.ts` always requests the plane and says so;
- anything else — a bare `mapRestToDump(response)`, a hand-authored fixture, a
  bridge that never read plugin data — is not observable, and a strict-subset set
  refuses `EXACT_MATRIX_RAGGED … stamps-not-observable`.

**This is a provenance fact, not a grammar change: dump stays v1.35.** It is a
file-level `_provenance` key (the `captureGaps` precedent: additive provenance one
reader stamps and every other consumer ignores), not a node or set field; it is
written only on a fetched read, so every committed fixture mapped from a committed
response keeps its bytes (the committed `extract/figma/rest/fixtures/*.rest.json`
carry zero `sharedPluginData` and are mapped without the option); and
`dump.plugin.js` is untouched, so the embedded plugin dump source did not move.

A set THIS PIPELINE drew never declares by its rows. Its declaration is the stamped
contract's own `absentVariants`, read from the contract in scope
(`scopedAbsentVariants`) — and read ALWAYS, not only after the Cartesian check
refuses (review H1). A canvas that draws the FULL product while its contract
declares an absence is exactly the amend state below, and a full product passes the
Cartesian check: the first cut read that state back `verified-exact` and dropped
the declaration without a note. Held to the product minus the declaration, the
drawn cell the contract calls absent IS an extra row ("6 rows; Cartesian definitions
minus 1 declared absent variant(s) require 5"). So a generated set that lost a
variant, a sparse generated set whose contract is not in scope, a contract that
declares a different (or a MOVED) cell, and a full canvas under a declaring contract
all refuse `EXACT_MATRIX_RAGGED` — canvas damage is never laundered into a
declaration, and a declaration is never silently dropped. The round-trip comparer
(`extract/figma/roundtrip.ts`) treats a dropped, gained or moved
`bindings.figma.absentVariants` as a mismatch. A promoted mode or interaction-state
axis leaves the API, so an undrawn cell naming one of its values has no spelling:
the ragged refusal stands there too.

**Bounds that are about meaning (review M1).** The tuple encoding grows with the
PRODUCT, not with what is drawn: a "star" set — the default plus each axis varied
alone — on 7 axes × 5 proposed 78,096 tuples in a 6 MB contract, and the referee
walked the whole product to validate one tuple. Two rules, both by name:

- **more undrawn than drawn is refused** (`sparse-matrix-mostly-undrawn` at the
  proposer, `absent-variants-mostly-undrawn` at the referee). A declaration says
  "this set is the product of its axes, minus a few cells". When the undrawn cells
  outnumber the drawn ones the product is not the model of the set: most of what
  the code surfaces would render is a composition nobody drew, and every per-axis
  inference rests on a minority of the cells it claims to explain. Exactly half is
  still allowed (a 2-of-4 diagonal is the smallest set the fence is tested on).
  Every measured real set is on the allowed side, drawn / undrawn: Alert 30/10,
  Checkbox 26/4, Progress 10/6, Radio 18/2, Checkbox-icon 42/6, Menu Item 16/2.
- **a product above 4,096 combinations is refused**
  (`sparse-matrix-product-too-large` / `absent-variants-product-too-large`;
  `ABSENT_VARIANTS_MAX_PRODUCT`, one bound at both doors, pinned equal by a test).
  The largest product among the 984 tracked contracts is 216. Both doors multiply
  before they materialise anything, and `absentVariantIssues` no longer builds the
  product at all — each tuple is checked against the axes and ranked by mixed
  radix, O(tuples × axes): one tuple over 1.68 M cells went from 2.8 s / ~1 GB to
  under a millisecond.

**The ambiguity fence.** Every per-axis inversion rule ("this value is a function
of axis A") was written for full coverage, where the explanation is unique: if a
non-uniform observation were a function of A alone and of B alone then
v(a,b) = g(a) = h(b) over every (a,b) makes it constant. With undrawn cells two
axis sets can each explain every drawn variant, and "first axis that fits" becomes
a guess decided by axis order — which the code surfaces then render at the undrawn
combination. THE CONDITION, one rule (`fenceSparseInference`,
`core/propose-figma.ts`), applied wherever an axis-conditioned inference is
ACCEPTED: over the rows the inference was read from, take every MINIMAL set of
variant axes the observed value is a function of (no proper subset also fits) —
EVERY subset of the axes that vary over those rows, with no arity bound: the
product cap leaves at most twelve varying axes, so at most 4,096 subsets, and the
first cut's "up to three" let f(A) against parity(B,C,D,E) over five binary axes
propose `{a}` (review F4; now refused by name). If there is more than one, and two of them predict DIFFERENT values for some
declared-absent combination (or one predicts a value where the other has none),
the set is refused by name —
`sparse-matrix-inference-ambiguous:<channel>@<part>`
(`SparseMatrixInferenceError`; every ambiguous inference is listed, each with the
two explanations and the undrawn tuple they split on). Two explanations that agree
on every undrawn cell are not a guess: nothing observable depends on the choice.
A set with no undrawn cell never arms the fence, so every full-matrix proposal is
byte-identical. Fenced sites: bound-variable unification (name substitution,
per-value, boolean function), every carried mint binding (single axis, pair,
triple, root and nested), part presence (`visibleWhen` value and value-subset),
hidden visibility, text by axis, boolean opacity, shape size and shape placement,
literal-axis fits (unbound paints, per-side stroke widths, partial cross-axis and
primary-axis fills), cross-axis fill by parent mode, `layoutByProp` (enum and
boolean), threaded and per-value instance props, host text overrides. NOT fenced,
named: the base-slice projection of a refused channel (`projectRefusedOnAxis` — it
already ranks candidate axes by span, a pre-existing heuristic that full coverage
does not make unique either) and child-stub geometry (it correlates against the
STUB's own applied props, not the parent's axes). The state-plane diff sites are
unreachable on a sparse set (promotion + sparse refuses, above).

**Writer.** `core/emit-figma-script.ts` drops the declared combinations from the
compiled variant list; grid cells keep their Cartesian row/column (an undrawn cell
is a hole, never a reflow) and the default combination, which may not be declared
absent, is still emitted first. The runtime text is unchanged — only the compiled
data differs — so a contract with no declaration emits the script it always did.
An instance that selects a combination its child declares undrawn refuses at
compile, `FIGMA_COMPONENT_REF_ABSENT_VARIANT`, instead of throwing mid-paste.

**Refused by name** (`validateContract`, through `absentVariantIssues`):
`absent-variant-not-in-product`, `absent-variant-incomplete`,
`absent-variant-non-variant-axis`, `absent-variant-duplicate`,
`absent-variants-order` (TUPLE order only), `absent-variants-mostly-undrawn`,
`absent-variants-product-too-large`, `absent-variants-default-tuple` (Figma reads every axis
default from that variant, positionally), `absent-variants-erase-axis-value` (a
variant option exists on the canvas only while some variant carries it, so the
prop's binding could not round-trip), `absent-variants-cover-product`,
`absent-variants-no-axes`, `absent-variants-native-representation`, and
`absent-variants-with-state-previews`. **Why the last is refused rather than
composed:** the preview matrix is already sparse by its own rule — one row per
state per PRIMARY-axis value, every other axis PINNED to its first value — and the
preview axis is not a contract prop, so a tuple over the props cannot address a
preview row, and an absent base cell a preview row is pinned to would leave "is its
preview drawn?" undefined. No measured set needs both; it can be lifted when one
does.

**Differential (nothing already generated changes).** All 984 tracked
`*.contract.json`, base tree vs this change, six surfaces each — `validateContract`
errors, React (`tsx` + CSS module + stories), React inline, static HTML, web
components, the Figma script — hashed output or hashed error: byte-identical, every
file, every surface (835 / 465 / 834 / 833 / 471 emit, the rest refuse identically:
a foreign corpus is not in scope of a bare emit). `figma:fresh` and
`generated:fresh` are green on the committed scripts and surfaces.

**Measured on real designer sets** (read-only REST, exact mode, the product's own
`extract:figma`). Altitude `Checkbox` (26/30 → 4 declared), `Progress` (10/16 → 6)
and `Radio` (18/20 → 2) now propose, 0 ambiguous inferences; before, each refused
ragged and — because the CLI writes nothing when any set refuses — so did every
dump that contained one. Two real closures follow: `Checkbox Group` and
`Radio Group` now reference the REAL `ds.checkbox` / `ds.radio` contracts instead
of stubs. `npm run design:consumer:check` on `Checkbox Group` (12 variants, same
unchanged 5 % limit):

| children | images within 5 % | min / median / max |
|---|---|---|
| auto-proposed STUBS (the parent read alone) | 2 of 12 | 4.85 / 6.45 / 7.40 % |
| the REAL sparse child | **12 of 12** | 2.23 / 2.97 / 3.87 % |

**CBDS `Alert` (30 of 40) — the committed designer-file exam — still REFUSES, and
that is the fail-closed rule working.** The exam reads a canvas through a read-only
observe whose scene read-back ignores plugin data by design
(`recipe/canvas-to-code.ts`), so on that path a stamp was never observable and
"unstamped" proves nothing: the receipt stays `refused-by-name` at propose, its
message now carrying the reason (`… Cartesian definitions require 40.
stamps-not-observable: …`; one line in each of four evidence files, re-recorded with
the gate's own `--write --subject cbds-alert`), the tally stays **5 accounting-clean,
19 refused by name**, and the three derived status lines are unchanged. The first
cut of this change had re-recorded Alert as accounting-clean; the review's M2 found
that part of the old refusal had merely MOVED (next paragraph), and H2 removed the
ground it stood on. A fresh observe that reads the stamps — it needs the owner's
Figma Desktop — would let it declare.

**What Alert would still lack (review M2, measured on the committed observe).** Its
10 undrawn cells are every `action=false × inlineAction=true` combination. Its
`Actions` block is drawn in exactly the 10 variants where `action=true` AND
`inlineAction=false` — absent in the 10 `true × true` and the 10 `false × false`
ones — so its presence IS a function of the two axes whose combination is undrawn,
but of their CONJUNCTION with one side NEGATED. The proposer's presence vocabulary
is one axis (a value, a value subset, or a truthy boolean): `visibleWhen` has no
conjunction of two props and no negated boolean form (the latter already a named
door, `propose.visible-when-no-negated-form`). Neither single axis predicts it (10
present / 10 absent on each), so the part is a NAMED omission ("DEGRADATION part
omitted — present in only 10/30 variants"), and an accounting-clean row would still
render 10 of 30 variants without their action block. Closing it needs a
two-condition `visibleWhen` with a negated side in the schema, both code emitters
and the writer — not attempted here.

`Radio Group`: 10 of 12 (2.45 / 3.87 / 5.22 %). Neither PASSES the check: all 12
cells of each fail `content-size-mismatch` (Checkbox Group renders 148 px high
where Figma draws 142) and both carry `variant-axis-inert-ledgered:legend` and
`variant-prop-discarded:state`; the `Checkbox` child alone is 3 of 26 (its box and
glyph are an uncaptured nested instance). No evidence is committed.

**Still open, named.**
- **The interaction-state wall.** CBDS `Checkbox-icon` and Altitude `Menu Item` —
  the two sets this round was opened for — no longer refuse ragged, and still do
  not propose: both carry a pure interaction-state axis
  (`state[default|hover|focus|disabled]`), and exact mode refuses to promote one
  (`EXACT_SEMANTIC_PROJECTION_AMBIGUOUS`, a separate deliberate refusal this change
  does not touch). So the CBDS Checkbox and Altitude Menu families still cannot
  carry those children. In a scratch copy with that axis renamed so the wall does
  not fire, `Checkbox-icon` proposes with 6 declared absences and `Menu Item` with
  2, neither with an ambiguous inference — the sparse path itself is ready for
  them. **Closed for a designer's axis by §D.41** (both now propose in exact mode,
  without renaming anything; the sentence above "promotion + sparse refuses" now
  holds only for an axis this pipeline drew or one read without the designer fact).
- **`undrawn-combination-rendered-by-composition`.** The code surfaces are
  unchanged and do not read the field: they render any prop combination by
  composing the per-axis rules read from the drawn variants, so an undrawn
  combination renders as a composition nobody drew or measured. Named on the
  proposal (the `bindings.figma.absentVariants:` note) and in the emitted React
  component (a comment beside the `axis-inert` ledger); the web-component, inline
  and HTML files carry no such note.
- **Amend does not delete — and says so every time.** A set written BEFORE its
  contract declared an absence keeps the now-undrawn variant (the writer never
  removes a designer-visible variant). The amend report lists it under
  `extraVariants`; every LATER sync, which used to answer plain `unchanged`, answers
  `unchanged-with-extra-variants:[Tone=C, Size=L]` with the same list (runtime text
  emitted only into a script that carries a declaring contract, so every other
  script keeps its bytes); and the design → contract read-back of that canvas
  refuses `EXACT_MATRIX_RAGGED` instead of reading `verified-exact` (review H1).
  Someone has to delete the variant or the declaration. Pinned in the test.
- The note in the emitted React component is capped (the count, the first three
  tuples, "… N more in the contract") and its values are JSON-spelled, so an enum
  value holding a newline cannot end the comment. The reviewer's probe also shows
  such a value breaking the generated TYPE UNION (`size?: 's' | 'l⏎…'`) — that is the
  enum emitter's own, pre-existing, and not touched here.
- `validateExactVariantProjection` still materialises the full Cartesian of ANY set
  it is handed (8 axes × 5: ~0.5 s before the named refusal). Pre-existing, the same
  for a full matrix; not changed here.
- The design:consumer:check harness takes one `--component` for both the dump's set
  name and the generated directory, so a set whose name has a space
  (`Checkbox Group` → `CheckboxGroup`) needs an alias key in the dump. Not changed
  here. **Closed by §D.43** (the set is found by the contract's anchor node id,
  and the REST import now fetches the child sets itself).

**To reverse.** Make `absentVariants` in `proposeFromDumpFenced` always null (delete
the `pipelineDrew ? scopedAbsentVariants(…) : ragged && stampsObservable ?
deriveAbsentVariants(set) : null` expression): every ragged set refuses as before,
the fence never arms, and no contract gains the field. The writer filter, the
referee block and the schema field are inert without a declaration and can stay; so
can `_provenance.stampsObservable` (nothing but the proposer reads it).
`accuracy/grammar.json`'s `cartesian-fill` sentence was made true of a declaring
contract and reads correctly either way.
**Gates:** `extract/figma/absent-variants.test.ts` (`npm run exact-proposal:check`
— exact projection, referee, proposer on synthetic designer sets incl. the named
ambiguity, writer round trip through the real plugin reader on the mock canvas,
the pipeline-drawn refusals, the amend state end to end, the stamps-observable fact
at both readers, the meaning bounds, every fenced call-site category by its own
label, the code-surface note) and `core/exact-proposal-check.ts` (the two ORIGINAL
ragged-refusal rows hold again unchanged; the declared-absence rows run under the
observable fact).

## D.41 A designer's interaction-state variant axis was refused by exact mode — CLOSED for an axis named as state, read with the designer fact, whose every drawn state the contract CARRIES; a state that is not carried, write-back, the dead `:disabled` plane and the undeclared stub override stay NAMED

**2026-09-19, revised the same day after the PR 131 review (one CRITICAL, three
HIGH — each is marked below). A projection decision the owner delegated; recorded
so it can be reversed.** A canvas cannot run a pseudo-class, so a designer DRAWS
what the platform runs — `State = Default | Hover | Focus | Disabled`. Exact mode
refused every such set, `EXACT_SEMANTIC_PROJECTION_AMBIGUOUS` (commit 26399346a:
exact promises that the proposed contract's `VARIANT` rows ARE the source matrix, a
promoted axis is no longer a prop, and "it cannot tell a generator-emitted preview
axis from a real API enum"; the one exemption was a set that DECLARES the axis as
this pipeline's `statePreviewAxis`). Reviewable inversion has always promoted the
same axis by a closed table — the machinery existed; only exact refused. Measured
read-only through `extract/figma/rest/fetch.ts` (stamps observable), axis names and
values exactly as drawn — every one is named `state` / `State`, none draws `active`:

| set | axis | drawn | exact mode now |
|---|---|---|---|
| Altitude `Menu Item` `3543:47347` | `State[Default\|Disabled\|Focus]` | 16 / 18 | **`verified-exact`, 16 rows** — focus-visible and disabled carried |
| Altitude `Chip` `3540:43526` | `State[Default\|Focus]` | 40 / 40 | **`verified-exact`, 40 rows** — focus-visible carried |
| CBDS `Checkbox-icon` `271:2241` | `state[default\|hover\|focus\|disabled]` (+ `error[false\|true]`, a separate boolean axis) | 42 / 48 | **REFUSED** `state-axis-state-not-carried:hover, …:disabled` — 18 of 42 rows |
| Altitude `Link` `3543:47075` | `State[Default\|Focus\|Hover\|Disabled]` | 4 / 4 | **REFUSED** `…-not-carried:hover` — 1 of 4 |
| Altitude `Toggle` `3543:48094` | `State[Default\|Focus\|Hover\|Disabled]` | 8 / 8 | **REFUSED** `…-not-carried:hover` — 2 of 8 |
| CBDS `Toggle` `272:730` | `state[default\|disabled\|hover\|focus]` | 16 / 16 | **REFUSED** `…-not-carried:hover, …:focus-visible` — 8 of 16 |
| CBDS `Checkbox` `272:96` (the PARENT) | `state[default\|error\|disabled\|hover\|focus]` — **`error` is not an interaction state** | 20 / 20 | `verified-exact`, the axis stays its enum prop (unchanged) |

Both sparse sets lose cells ONLY in a non-rest state (`state=disabled × error=true`,
6; `State=Disabled × Role=Header`, 2): every combination of the other axes is drawn
at rest.

**Decision.** What made the axis ambiguous was never the value table — it was not
knowing WHOSE axis it is. §D.40 made "a designer drew this" a positive fact (no
`ds_contracts/*` stamp AND a reader that could have seen one). With that fact, a
variant axis **named `state`, `states` or `interaction`** whose EVERY value is in
the closed table is projected in EXACT mode, by table lookup, onto the state
vocabulary the contract already has:

| drawn value (case-, space-, underscore-insensitive; exact per token) | contract |
|---|---|
| `default` | the REST state — the base every state is read against |
| `hover` | `states: hover` → `:hover:not(:disabled)` |
| `pressed`; `active` ONLY with `hover` or `pressed` beside it | `states: active` → `:active:not(:disabled)` |
| `focus`, `focus-visible` | `states: focus-visible` → `:focus-visible` |
| `disabled` | the `disabled` BOOLEAN prop (Figma `BOOLEAN` "Disabled", the native attribute on elements that have one) + the `disabled` state block → `:disabled` |

The table is ONE module (`core/interaction-state-axis.ts`) — the proposer, the
visual-parity planner (it kept a hand mirror) and the consumer check all read it. It
is what `STATE_SELECTORS` renders; nothing was added. `rest`, `enabled`, `normal`,
`hovered`, `focused` are NOT in it. (The first cut argued this from Untitled UI's 12
committed `Focused` sets "proposing today"; they do so in reviewable mode only — in
exact mode they refuse `EXACT_DEFINITIONS_MISSING`, pre-v1.5 dumps. The reason that
stands: no measured set in scope draws a synonym, and each one is one table line
when a set does.) **How `disabled` is modelled** was found, not chosen: a boolean
PROP plus a `disabled` STATE block; both code emitters pass the prop as the native
attribute where `ELEMENT_META[element].supportsDisabled` and select the block with
`:disabled`.

**Two guards on the table (review H2).** The reviewer projected `Status[Default|
Active|Disabled]` on an account badge, `Type[Default|Active|Focus]` on a nav item,
and a Tab's `State[Default|Active]` (Active = SELECTED) into a mouse-held `:active`
flash with no `selected` API, all `verified-exact`; in this repo's own committed
CBDS dumps 8 of the 12 axes carrying `active` use it for editing / open and escaped
only because `filled` or `error` share the axis. So: (1) **the axis NAME is
required** — `state` / `states` / `interaction`, nothing else, however many states
are drawn (`state-axis-unnamed`); (2) **`active` is a press only with `hover` or
`pressed` on the same axis** — alone it is as likely selected / current / open
(`state-axis-value-ambiguous:active`). Both keep the axis as **the designer's own
enum prop with a note** — the faithful outcome, not a refusal. All six measured
sets are named `state` / `State` and none draws `active`. RESIDUAL, named: an axis
`state[default|hover|focus|active|disabled]` whose `active` means "editing" passes
guard (2) and is projected as a press — the canvas does not say otherwise; a
hand-authored enum prop is the way out.

**EXACT IS TRUE OR IT IS NOT CLAIMED (review C1 — the first cut was wrong here).**
`exactRowsFromProposedContract` rebuilt the STATE half of the matrix from the
decision — i.e. from the source — so it agreed with the source by construction:
`Checkbox-icon` read `verified-exact`, observed 42, while its contract carried only
`focus-visible`; 29 of the 126 rows of the six real sets (23 %) were counted as
reproduced while dropped. Now BOTH halves are read from the CONTRACT: the rows are
the contract's own `VARIANT` cells (minus its declared absences) × **the states
`contract.states` declares** (`disabled` additionally only while the contract has
the `disabled` boolean), minus the undrawn state cells. The decision supplies only
the designer's SPELLING of those states, which the contract vocabulary does not
carry. A drawn state the contract does not carry **refuses in exact mode**, same
code, slug `state-axis-state-not-carried:<state>[, …]`, with the row count and the
note that says why; `--reviewable-inversion` proposes the same contract as
`legacy-unverified` with `carried: false` on the decision. A refusal rather than a
new status: `parseProposal` (`ds-contracts figma receive`) accepts exactly
`verified-exact | legacy-unverified`, exact mode returns only the first, and a third
status would have to be taught to every reader of the envelope before it could be
trusted not to read as exact somewhere. WHY the four real sets drop a state: the
drawing lives where the vocabulary does not reach — `Checkbox-icon`'s hover and
disabled are fills INSIDE nested icon instances (host overrides on a child-owned
node; carrying them needs per-state `component.overrides`, which does not exist —
not cheap, not attempted); `Link`'s hover and the Toggles' hover / focus produce no
root or depth-1 override in any channel the reader captures (the refusal quotes the
first note the proposal wrote about that state, or says that nothing captured
differs). Each is named in the refusal; none is guessed at.

**What `verified-exact` attests for a projected axis, and what it does not (review
H3).** It attests source → contract: every DRAWN row is the contract's own cell × a
state the contract carries; nothing drawn is dropped. It does NOT attest contract →
canvas. The contract vocabulary carries neither the designer's state spelling nor
the state cells they left undrawn (`absentVariants` ranges over VARIANT props, and
state is not a prop), so **write-back draws the WRITER's matrix, not the
designer's**: its own `State = Default | Hover | Active | Focus Visible | Disabled`
axis, the rest grid + one preview row per carried state per value of ONE primary
axis, every other axis pinned. Carrying it would need a new `statePreviews`
shape (full product + declared-absent state cells) through the schema, the referee,
the writer, the plugin dump reader's `statePreviewAxis` stamp, the exact projection
and the round-trip comparer — not small, not attempted. Instead it is **NAMED,
every time, exactly**: the proposer computes the writer's matrix by the writer's own
rule, in the designer's spelling, and puts it on the decision
(`stateAxisProjection.writeBack = { draws, completes[], omits[] }`) and in a
`state-axis-write-back-diverges` note listing the cells write-back DRAWS that the
designer did not and the cells it does NOT draw that the designer did. Pinned by
tests against the real writer on the mock canvas: a 5-of-6 set writes 6 and the
completed cell is the one named; a two-axis set writes 6 of the designer's 8 and the
two omitted cells are the ones named. Real: `Menu Item` writes 10 of 16 (completes
0, omits 6), `Chip` 25 of 40 (omits 15). The designer's set is never edited — the
writer creates its own stamped set. (The writer's OWN report cannot list them: the
contract does not carry what the designer left undrawn, which is the point.)

**Refused by name — never a guess.** `EXACT_SEMANTIC_PROJECTION_AMBIGUOUS`, the old
sentence unchanged, then the slug:

- `state-axis-state-not-carried:<state>` — above.
- `state-axis-stamps-not-observable` — the reader could not have seen a stamp, so
  "unstamped" is not evidence of a designer (a pipeline preview axis with one API
  axis is a FULL matrix and reads the same; projecting it would invent a `disabled`
  boolean from a `State=Disabled` preview cell). **This is why no committed fixture
  moves, and why the designer exam — read through an observe that ignores plugin
  data — keeps every verdict.** The fact itself was too generous (review M2):
  `importFromUrl` recorded it even when the caller injected the transport, so a
  replay of this repo's own pipeline-written REST fixtures read observable. It is
  now recorded only for the real transport against the real API; an injected
  `fetchImpl` / `apiBase` must assert `transportCarriesPluginData` (default false).
  Still inherent, PR 130's boundary: a COPY of a pipeline set that lost its stamps,
  read observably, is an unstamped set.
- `state-axis-pipeline-drawn-undeclared` — a stamped set whose axis it does not
  declare as its `statePreviewAxis`; **and** (review M3) a pipeline-written set
  edited by hand — a Pressed plane added, Hover renamed — whose stale stamp no longer
  matches what is drawn (it used to surface as `EXACT_TUPLE_INVALID_VALUE`).
- `state-axis-duplicate-state` — `Pressed` and `Active` on one axis.
- `state-axis-multiple` — two axes that both project.
- `state-axis-disabled-prop-collision` — (review H1, widened) ANY prop that already
  spells disabled — a VARIANT axis or a BOOLEAN property whose name normalises to
  `disabled` / `isdisabled`. The first cut tested only a BOOLEAN literally named
  `disabled`; `State[Default|Disabled]` × a VARIANT `Disabled[False|True]` proposed
  two props named `disabled` and `emitReact` threw on a `verified-exact` contract.
- `state-axis-orphan-state-cell` — a state drawn where its rest cell is not.
- and one that is NOT a projection refusal: **`proposal-refused-by-referee`**
  (`ProposalRefereeError`, review H1). Exact mode never returns, on this path, a
  contract `validateContract` refuses: the referee runs on every exact proposal that
  projects a designer's axis and whose component refs resolve inside the proposal
  (linked children in scope are slices, not contracts). SCOPE, measured: armed for
  EVERY exact proposal it refuses 19 committed census sets that propose
  `verified-exact` today (17 carry a stamped `semantics.roleException` no root role
  claim needs; antd `Input` roots children on a void `<input>`) — real, pre-existing,
  a census re-record of its own, and named here rather than silently widened. It is
  one condition in `proposeFromDumpFenced`.

NOT refused: an axis with a value OUTSIDE the table (`error`, `selected`, `filled`,
`open`, `Focused`, …), with no rest value, not named as state, or with a lone
`active`, stays **the designer's own enum prop** — a faithful projection, and the
note names the value or the condition (`state-axis-value-outside-vocabulary`,
`-no-rest-value`, `-no-state-value`, `-unnamed`, `-value-ambiguous`). That is what
the CBDS `Checkbox` parent needs (`state=error` is API).

The mapping is a **named decision on the proposal**: `result.stateAxisProjection`
(`decision: 'designer-state-axis-projected'`, the property, the rest value, every
value → state with `carried`, `undrawnStateCells`, `writeBack`) and a
`state-axis-projected (DECISION …)` note.

**Sparse sets (§D.40) — the declaration vocabulary is untouched.** Undrawn at REST →
a contract absence over the REMAINING axes, `bindings.figma.absentVariants` exactly
as §D.40 defines it; every state must leave that cell undrawn too (else
`state-axis-orphan-state-cell`), and `statePreviews` is then NOT set, by name.
Undrawn ONLY in a non-rest state → no prop combination is missing, so nothing is
declared on the contract; the cells ride `undrawnStateCells` — and are what
write-back completes, above. **The fence is over ALL undrawn cells, spelled over the
remaining axes**: a plane that draws a cell fits it identically under every
explanation, so a cell another plane lacks can never refuse it, and a plane with a
hole is held to the same uniqueness rule (tested inside a state plane). **A
rest-plane hole + a states plane lose the states on the canvas round trip (review
M1)**: the writer draws the rest grid only (3 variants in the test), the read-back
is `verified-exact` OF THOSE 3 and recovers `states: []`. That status is true of
the canvas it read and says nothing about the states; the read-back now says so
first among its notes (`states-not-drawn-on-this-canvas`), and the first proposal's
`writeBack.omits` lists the state cells that will not be drawn.

**Round trip (full single-axis set).** The proposed contract opts into
`statePreviews` where its own rules allow; the writer draws its stamped, declared
axis, and that set proposes back to the same `states` / props / root overrides
through the DECLARED path — `stateAxisProjection` is absent on the way back (tested
through the real plugin reader; the same canvas with stamps stripped and no
observable fact refuses).

**Mounting a state-axis variant.** `scripts/design-consumer-check.ts` reported every
such variant as `State (no VARIANT prop)`. It reads the axis by the same table and
mounts a state cell the way a user reaches it — the mechanism
`extract/figma/visual-parity/render.ts` already used: a real pointer hover, a held
mouse button, keyboard-modality focus on the component's own focus target, or the
`disabled` prop. Nothing is forced that a user could not do. After review M4: reach
is the REAL pseudo-class (`:hover` / `:active` must match the root — a covered or
`pointer-events:none` root is `state-unreachable`, not `state-inert`); the paint
string carries every channel a state may change (all four borders, radii, text
decoration, transform, weight, filter, the box); and a pressed cell is released with
the pointer parked OFF the component, so no click is synthesised (the first cut
clicked every pressed cell — a navigation on `a[href]`). `state-unreachable`,
`state-inert` and `state-not-carried` are tested on a local page, no token.

**Differential (nothing already generated changes).** All 984 tracked
`*.contract.json`, six surfaces, base tree vs this change: byte-identical. Every
tracked dump-shaped JSON, every set, BOTH modes — 5,279 sets, 10,558 rows of verdict
+ contract hash + notes hash: **zero changed**, before and after the review fixes.

**Measured on the real closures** (read-only REST, unchanged 5 % limit; no evidence
committed; the contracts are byte-identical between the two modes):

| parent / set | exact | children | images within 5 % | min / median / max |
|---|---|---|---|---|
| Altitude `Menu` + `Menu Item` | both `verified-exact` | REAL `ds.menu-item`, no stub | 1 of 2 | 0.00 / 9.36 / 18.71 % |
| Altitude `Menu Item` (16 cells, all mounted) | `verified-exact` | — | 10 of 16 — rest 6/6, disabled 4/4, focus 0/6 | 0.00 / 1.30 / 14.16 % |
| Altitude `Chip` (40, all mounted; was "cannot mount") | `verified-exact` | 1 icon stub | 17 of 40 — rest 17/20, focus 0/20 | 0.00 / 9.19 / 26.61 % |
| CBDS `Checkbox` + `Checkbox-icon` + `Icon` | **refuses** (the child drops hover + disabled); `--reviewable-inversion` proposes all three, the child `legacy-unverified` | REAL `ds.checkbox-icon` and `ds.icon`; 4 icon-glyph stubs remain | 2 of 20 (reviewable + SCRATCH, below) | 4.76 / 10.43 / 20.24 % |
| Altitude `Link` (4) | **refuses** (hover); reviewable proposes | 1 icon stub | 2 of 4 | 0.66 / 4.93 / 19.55 % |

None PASSES the check. **So the CBDS Checkbox family still cannot carry its real
child in exact mode** — no longer because of the axis, but because two of the
child's four states are drawn where the vocabulary cannot carry them; the Altitude
Menu family can.

**Still open, named.**
- **`ds-contracts generate` refuses the CBDS `Checkbox-icon` proposal**, by name:
  `part "CheckSquare" overrides "size" but ds.check-square does not declare it
  overridable`. Pre-existing and independent of the state axis: the proposer's
  ROUND 10 self-claimed-stub size override is gated on `mintUnbound` alone, while the
  stub declares `overridable` only under the `instanceOverrides` opt-in no CLI
  passes. (In exact mode the referee would now refuse that proposal too, behind the
  state refusal.) The CBDS numbers above come from a SCRATCH copy whose three stubs
  were given `overridable: ["size"]`.
- **`states.disabled` on a root with no native `disabled`** (`a`, `div`, `label`, …)
  compiles to `.root:disabled`, which never matches; the boolean is delivered as
  `data-disabled`. Pre-existing on 64 tracked contracts, so not touched here (it
  would change their emitted CSS). **Three of the four real sets that carry a
  disabled block get this dead plane** (`Link` on `a`, both Toggles on `div`; only
  `Menu Item`, a `button`, is live) — the consumer check names it
  (`state-inert:disabled`), and `state-unreachable:focus-visible` names a root
  nothing can focus (`Link`'s `a` without `href`, `Checkbox-icon`'s `div`).
- **The designer exam's own mount** (`recipe/canvas-to-code.ts` `mountCells`) still
  says `variant axis State has no contract prop` for Chip and Link. Its observe
  cannot see stamps, its proposals are reviewable inversions, and its receipts are
  dated: not moved. The tally stays 5 accounting-clean, 19 refused by name.
- Reviewable inversion WITHOUT the designer fact is the legacy detector, unchanged
  (no name requirement, no `active` guard, first axis wins): changing it moves
  committed proposals, and it never claims `verified-exact` for a promoted axis.

**To reverse.** In `proposeFromDumpFenced` make `designerReadable` false: every set
takes the legacy detector, exact refuses every undeclared state axis again
(`semanticProjectionRefusal`), sparse + promoted refuses ragged in both modes, and
`exactRowsFromProposedContract` ignores its third argument. The shared table, the
fetch fact and the consumer check's mounting are independent and can stay.
**Gates:** `extract/figma/state-axis.test.ts` (`npm run exact-proposal:check`, 23
tests — the table and its guards, every refusal, carried / not carried, the three
sparse shapes and the fence inside a state plane, the round trips incl. write-back
held to the real writer, the hand-edited pipeline set, the transport fact, the
referee, the emitted React, the planner), four rows in
`core/exact-proposal-check.ts`, and `scripts/design-consumer-check.test.ts`
(`npm run design:consumer:test`, incl. the browser test of the three named state
problems).

## D.42 A Figma text box that sizes itself to its text is a whole number of pixels wide; the browser's is fractional — CLOSED for React, React inline and web components where `calc-size()` is supported; OPEN on static HTML and in browsers without it

**2026-09-19. A lowering decision taken by the agent under the owner's standing
delegation (never a grade, never a tolerance); recorded so it can be reversed.**
After §D.39 the design-led consumer check on the 72-variant CBDS Badge still
missed the unchanged 5 % limit on 26 variants — every `size=small` one, 48 × 16 px,
at 4.4–7.3 % — with every content size equal. Verified through Figma REST: the
TEXT node `Label` has `style.textAutoResize: "WIDTH_AND_HEIGHT"` and
`absoluteBoundingBox.width = 32.0`. Figma's auto-width text box is a WHOLE number
of pixels: the glyph advance rounded up. Chromium lays the same run (Inter Semi
Bold 14) out at 31.40625 px, so the hug root rendered 47.40625 px wide where
Figma's is 48 and the right border antialiased across two columns. Neither reader
captured how the box sizes itself, so the proposer could not lower it.

**Decision.** Keep the designer's numbers. The text part records the one captured
fact, under Figma's own name and only in the value that lowers:
`Part.textAutoResize: "WIDTH_AND_HEIGHT"`. `NONE`, `HEIGHT` and the deprecated
`TRUNCATE` are a fixed or filled box, which the width and fill vocabulary already
carries, and are never written. ABSENT is the meaning every contract already had —
the element as wide as its fractional browser advance — so no existing contract or
emitted byte changes; `figma:fresh` and `generated:fresh` are green.

**Form** (revised after the adversarial review — see below). The code surfaces
give the text element the same box Figma draws:

```
inline-size: calc-size(fit-content, round(up, size, 1px));
inline-size: calc-size(fit-content, round(up, size - <letter-spacing>, 1px));   /* a tracked label */
max-inline-size: 100%;        /* unless the part carries its own max-width */
align-self: flex-start;       /* only under a flex column that would stretch it */
```

`calc-size()` is the only CSS that can round an INTRINSIC size (a plain `round()`
cannot take `fit-content`). `fit-content` is `min(max-content, max(min-content,
available))`: a label that fits is its max-content box rounded up; a string that
does not fit wraps at the available width exactly as it does without the fact.
`max-inline-size: 100%` removes the one thing rounding can still do to a wrapped
box — push a fractional available width (120.5 px) up by the remaining sub-pixel.
A browser without `calc-size()` drops the `inline-size` declaration at parse (a
stylesheet) or ignores the assignment (the CSSOM, i.e. the inline surface) and
keeps today's fractional box, under 1 px narrower — never wider and never a wrap
change; no `@supports` guard is needed and none could be spelled inline. Logical
properties, so a vertical or RTL writing mode rounds the axis the text runs along.
The declaration takes effect because every emitter renders a text part as its own
element inside a parent it lays out as flex or grid (blockified), and an absolutely
positioned one is blockified too; where that is not true the flag is refused (see
below). `text-align` composes (the run is aligned inside the up-to-1-px-wider box,
as Figma aligns it inside its whole-pixel box). Emitted by `generateCss` (both
sites), the web components' `shadowCss` and, as the same declarations with tokens
resolved, the inline surface's style record (`wholePixelTextBoxDecls`,
`packages/core/src/anatomy.ts`); the lowering is registered as
`css.text-box-whole-pixel` with its inverse `carryTextAutoResize`.

**The tracking finding, measured before it was coded.** The first cut rounded the
raw `max-content` and REGRESSED the Altitude Badge from 10 / 10 to 9 / 10: its
label (`Badge`, Public Sans 600 12 px, 1 px letter spacing) is 41 px in Figma and
41.27 px in Chromium, so rounding up gave 42. CSS adds `letter-spacing` after
EVERY glyph, the last included; Figma's box has none after the last. On the
committed REST fixtures rendered in Chromium with the fonts loaded:

| text | Figma box | Chromium max-content | ceil, all spacings | ceil, less the last |
|---|---:|---:|---:|---:|
| Eventz Kicker, Manrope 700 18 px, UPPER, 6 px tracking | 95 | 100.05 | 101 | **95** |
| Eventz Kicker, Manrope 700 16 px, UPPER, 6 px tracking | 87 | 92.94 | 93 | **87** |
| Altitude Badge label, Public Sans 600 12 px, 1 px tracking | 41 | 41.27 | 42 | **41** |

Three of three tracked samples: Figma's box is the run less the trailing spacing,
rounded up. The part's own uniform `letter-spacing` is therefore shed before
rounding — a literal verbatim, a token as its `var()` on the sheets and as its
resolved value inline. A `letter-spacing` that varies by variant or state, or
rides a placeholder token, has no single spelling in the base rule and is refused
beside the flag. On the 23 untracked samples the two forms are the same number.

**The premise, measured on 26 samples.** Every WIDTH_AND_HEIGHT text node in the
committed REST fixtures whose font could be loaded (Inter locally; Manrope, Geist
and Public Sans from Google Fonts): the rule reproduces Figma's box exactly on 18
(7 / 7 Manrope headings, 3 / 3 tracked, 7 / 15 Inter, Geist). The 8 misses are all
Inter and all in the SAME direction — Figma 1 px wider than the rounded Chromium
run, by 1.16–1.77 px before rounding: a different Inter build in Figma than the
one installed here, the font substrate `FC-FONT-SUBSTRATE` already names. On none
of the 26 is the rounded box wider than Figma's. The rule closes the rounding, not
the font.

**Readers (dump v1.36).** Both write `text.textAutoResize` verbatim on every text
node (REST `style.textAutoResize`; plugin `node.textAutoResize`; the four Plugin
API spellings and nothing else). An ABSENT dump field means "not captured" (dump
≤ v1.35, or a canvas that reports nothing — the mock), never auto-width: older
dumps propose the bytes they always did. On the REST route an absent RESPONSE key
is read as `NONE` (see the review, M4). Re-pinned by the previous bump's recipe:
`plugin-engine-check.mjs` ×2, `flowbite-dump-propose-check.ts`,
`sync/fixtures/ledger.fixture.json` ×4, the reader tests, `ui.html` re-embedded
(`npm run plugin:embed-dump`), the engine receipt re-recorded, the door register
re-derived, 69 lowering citations re-located by marker id and exact rule text.

**Proposer** (`carryTextAutoResize`, beside `carryTextAlign`; five doors):
WIDTH_AND_HEIGHT in every captured variant → the flag
(`propose.text-box-absent-is-fractional` and
`propose.text-box-not-auto-width-unchanged` are the two silent no-ops: not
captured, or a fixed / filled box); auto-width in some variants and not others —
including a variant that reports nothing — is NAMED
(`propose.text-box-mixed-refused`); WIDTH_AND_HEIGHT beside
`layoutSizingHorizontal: FILL` is a dump that contradicts itself — Figma turns a
filled text box to HEIGHT — and is NAMED, the part keeping the fill it carries
(`propose.text-box-fill-contradiction-refused`). On every committed REST fixture
(352 text nodes with a sizing field) WIDTH_AND_HEIGHT pairs only with HUG, and
HEIGHT only with FILL or FIXED. A sole root text node named `label` is hoisted into
`anatomy.root.text`; the fact is NAMED there, not carried
(`propose.text-box-hoisted-root-named`): the root's box is padding plus content,
and rounding padding + advance is a different number whenever the padding is
fractional. A flag the finished contract could not honour (the refusals below)
is WITHDRAWN by name (`propose.text-box-unhonourable-withdrawn`, the same function
validateContract uses) rather than proposed into a contract that is then refused.

**Writer.** `core/emit-figma-script.ts` had never set `textAutoResize`;
`figma.createText()` is born `WIDTH_AND_HEIGHT` (measured: 203 of 203 text nodes
with a sizing field in the pipeline-generated census sets read it back, all HUG).
A part carrying the flag compiles it onto its text spec (the bare text, the
`content` text and the text inside a boxed-text wrapper — never inherited by a
nested child) and the runtime writes `node.textAutoResize = 'WIDTH_AND_HEIGHT'`,
feature-gated so a script for any contract without the flag is byte-identical.
Contract → writer → REAL plugin reader → proposer is a fixed point for the flag
(`extract/figma/whole-pixel-text-box.test.ts`, on the mock canvas, where the field
exists only where the writer set it). **It is NOT a fixed point in the other
direction**, stated plainly: `createText` is born `WIDTH_AND_HEIGHT`, so every
hugging text part of a FLAGLESS contract, written to a real canvas and read back,
proposes the flag. code → canvas → code therefore adds the fact. That is the truth
about the canvas (Figma has no fractional text box) and, with `fit-content`, it
changes nothing but the sub-pixel box of a text that fits; checked: it churns no
committed pin — the mock canvas the committed round-trip gates run on does not
model the field, and no live round-trip receipt was re-recorded in this change.

**Refused by name** (`validateContract`): the flag on a top-level root; on a part
that owns no text (`text` / `content` / `textByProp`); beside a `width` /
`inline-size` / `flex` / `flex-grow` / `flex-basis` channel, `layout.grow` or a
truncation channel (`text-overflow`, `-webkit-line-clamp`, `line-clamp`) — a box
that is sized, filled or truncated by a channel is not sized by its text; beside a
per-variant / per-state or placeholder-token `letter-spacing`; beside a literal
`letter-spacing` that is not a px / em / rem length; when the part INHERITS
`letter-spacing` from any ancestor holder (root or part; literal, token or
per-variant) and states none of its own; on an inline-level element (the part
declared `display: inline` / `contents`, or a parent that is not a flex / grid
box, unless the part is absolutely placed or itself block-level). The emitters,
which hold the token VALUES, refuse a letter-spacing TOKEN that resolves to
anything but a px / em / rem length in any mode (a `%`, a unitless `0`, `normal`),
and a token when no values were supplied (the §D.39 shadow precedent). The schema
spells only `"WIDTH_AND_HEIGHT"`.

**Revised after an adversarial review (PR 132, same day; fix-then-merge).** Each
finding was reproduced by the reviewer's probes and each fix re-measured with
them in Chromium:

- **H1 — `max-content` made runtime text non-wrapping.** The first cut spelled
  `calc-size(max-content, …)`, a definite, unwrappable box. On the shipped
  `flowbite.card` the proposer carries the fact onto `label-text` (bound to
  `children`), and a long runtime string grew the card to 596 px inside a 240 px
  container; a fixed-width column or grid parent stopped wrapping the same way —
  while Safari and Firefox, which drop the declaration, wrapped. Now
  `calc-size(fit-content, …)`: the card is back to 240 px with the same three
  lines, the badge unchanged at 50 / 34. `fit-content` alone still rounded a
  WRAPPED box's fractional available width up (a 120.5 px column: 121, 0.5 px
  over), so `max-inline-size: 100%` clamps it — measured 120.5 in a flex column,
  a flex row, a grid and a fit-content card, and unchanged for every label that
  fits. (`min(…, 100%)` inside `calc-size()` collapsed the badge to 0 and was
  rejected.) A part that carries its own `max-width` keeps it and gets no clamp:
  both spell one property in one rule, and ours would override the author's.
  Pinned: long text in a 120.5 px and a 240 px flex column and a 120.5 px grid,
  both React surfaces — the same line count and block size as without the fact,
  no overflow, the component not wider.
- **H2 — code → canvas → code adds the fact.** Stated plainly under **Writer**
  above: not a fixed point in the flagless direction; acceptable only because,
  after H1, the fact changes nothing but the sub-pixel box of a text that fits.
  It churns no committed pin (the round-trip gates run on a mock canvas that
  does not model the field).
- **M1 — "never a different layout" was false.** Under a flex column with no
  cross-axis alignment CSS STRETCHES a text item. With `calc-size()` the
  explicit inline-size stops the stretch (a centred label at x = 0); without it
  the box stretched and the centred run sat at x = 84 in a 200 px column — the
  engines disagreed. **AGENT decision:** a flagged part under such a parent (a
  flex column whose `align` is absent or `stretch`, with no `layoutByProp`, the
  part not absolutely placed and declaring no `align-self`) also gets
  `align-self: flex-start`. It is Figma's own geometry: a text box that sizes
  itself to its text is a HUG child and sits at a MIN-drawn column's start
  edge — a CENTER- or MAX-drawn column already proposes an `align` and is left
  alone. Now both kinds of engine draw x = 0 (pinned, with the calc-size
  declaration stripped to stand in for an engine without it). It is chrome of the
  flag: the proposer never reads it back. **To reverse:** drop the `align-self`
  push in `wholePixelTextBoxDecls`; the M1 split returns as a named limit.
- **M2 — inherited tracking.** A root's per-variant `letter-spacing: 2px`,
  inherited by the flagged label, was neither subtracted nor refused: a 42 px box
  where Figma's is 40. Now refused by name whenever any ancestor holder (root or
  part; literal, token, per-variant or per-state) states `letter-spacing` and the
  part states none of its own.
- **M3 — tracking that cannot be subtracted.** A `%` subtracts against the
  containing block (a `-0.5 %` token gave a box wider than Figma's); a token
  resolving to a unitless `0` or `normal` made `size - var(…)` invalid at
  computed-value time — a silent no-op. Only a px / em / rem length is
  subtracted now; a literal of any other kind is refused by validateContract, a
  token by the emitters from its resolved VALUE in every mode (they hold the
  token trees), and a token with no values supplied is refused too.
- **M4 — does REST omit `NONE`?** Two read-only GETs (Altitude Radio
  `3543:47540`: 9 labels; CBDS Avatar `284:11`: 20 texts) found no `NONE` node to
  settle it: every text reported `WIDTH_AND_HEIGHT` or `HEIGHT` explicitly. REST
  omits defaults elsewhere (`strokesIncludedInLayout`), and `NONE` is this
  field's default. **AGENT decision:** the REST reader reads an absent key as
  `NONE`, and the proposer treats any variant reporting nothing beside
  auto-width ones as the mixed case. Safe under either truth — if REST sends
  `NONE`, absence never happens; if it omits it, a fixed box beside auto-width
  variants is refused by name, never a silent auto-width. **To reverse:** delete
  the `else` branch in `mapText` (`extract/figma/rest/map.ts`). UNVERIFIED on a
  real `NONE` node; named here.
- **Low — inline-level elements.** A part declared `display: inline` /
  `contents`, or one whose parent is not a flex / grid box (a root declared
  `display: block`), made the rule a silent no-op; refused by name. A flag the
  proposer captured but the finished contract could not honour is withdrawn by
  name (`propose.text-box-unhonourable-withdrawn`).

**Measured after** (re-measured after the review fixes, fresh read-only REST reads
under dump v1.36, same unchanged 5 % limit — every row equal to the digit to the
first cut, because every label on these sets fits):

| set | before | after |
|---|---|---|
| CBDS Badge `277:822`, 72 variants | 46 / 72; 0.96–7.29 %, median 3.92 % | **72 / 72**; 0.96–4.43 %, median 3.06 %; every rendered width exactly Figma's (36 × 61, 36 × 48) |
| Altitude Badge `3538:35772`, 10 variants | 10 / 10; 0.00–4.74 % | **10 / 10**; 0.00–4.82 %; the label box now 57 px against Figma's 57 (was 58); the five label rows move by +0.06–0.08 points (Public Sans rendering), the five dots stay 0.00 |
| Altitude Tabs `3558:61955`, 2 variants | 0 / 2; 5.54 % / 5.19 % | 0 / 2; **unchanged to the digit** — its text lives inside child instance stubs the dump does not capture, so no part carries the fact |

| CBDS style × size | pass before | pass after | before (min / median / max) | after (min / median / max) |
|---|---|---|---|---|
| fill × large | 12/12 | 12/12 | 2.66 / 3.42 / 3.42 % | unchanged to the digit |
| fill × small | 2/12 | **12/12** | 4.56 / 5.47 / 5.86 % | 3.39 / 4.23 / 4.30 % |
| tonal × large | 12/12 | 12/12 | 1.91 / 1.91 / 1.91 % | unchanged to the digit |
| tonal × small | 8/12 | **12/12** | 4.43 / 4.69 / 5.73 % | 4.43 / 4.43 / 4.43 % |
| outline × large | 12/12 | 12/12 | 0.96 / 1.23 / 1.50 % | unchanged to the digit |
| outline × small | 0/12 | **12/12** | 5.21 / 6.05 / 7.29 % | 2.08 / 2.67 / 3.26 % |

All 36 large rows are unchanged to the digit (their `Label` rounds to the same
61 either way). The design-to-code census counts the fact: 3,009 carried, 4,065
named, 0 silent (was 2,904 / 3,985 after §D.39; the Flowbite sets' labels are the
hoisted root label and count as named). Evidence:
`recipe/evidence/design-led-consumer/{cbds-badge,altitude-badge,altitude-tabs}/`.

**Named limits.**

- **Browsers without `calc-size()`** keep the fractional box: under 1 px narrower
  than Figma's, never wider and never a wrap change — the defect this closes, not
  a new one. Their POSITION agrees under a stretching column because of
  `align-self` (M1); where that declaration is not written (a column whose
  alignment varies by variant) the two kinds of engine still place a centred
  label differently.
- **A part with its own `max-width`** gets no container clamp, so its WRAPPED box
  in a fractional-width container can overflow by under 1 px.
- **Trailing tracking sits outside the box.** The subtracted letter spacing after
  the last glyph still paints as empty space, so a Range over the text reports it
  past the box edge (0.06 px at 0.05em in a probe); no ink overflows — Figma's box
  has no such spacing. Support is
  not enumerated here; the Chromium `playwright-core` pins has it (asserted by the
  React test), and the consumer check measures in that Chromium only.
- **The font substrate stays.** Where the two engines disagree on the RAW advance
  by more than the rounding slack (8 of 15 Inter samples, 1.16–1.77 px), Figma's
  box is still 1 px wider than the rounded browser run. `FC-FONT-SUBSTRATE`.
- **A flagless contract's text reads the fact back.** `createText` is born
  `WIDTH_AND_HEIGHT` and Figma has no fractional text box, so a set this pipeline
  wrote from a contract without the flag proposes the flag on its re-read — the
  truth about the canvas, additive, and pinned by a test so it cannot become
  silent. This is the one place the fixed point is one-directional: the flag
  round-trips; its absence does not. The census on the pipeline-generated
  figma-ds sets reflects it (carried), and no committed proposal changed (every
  committed dump predates the field).
- **The hoisted root label** (a sole root text node named `label`) is named, not
  carried; the root keeps the fractional advance.
- **A tracked label with per-variant or per-state tracking** is refused beside the
  flag rather than given a private custom property; the proposer never writes
  per-variant tracking (a mixed `letter-spacing` is already named), so the
  refusal reaches only hand-written contracts.
- The mock canvas does not model the field (it reports nothing, which reads as
  "not captured"). The Playground's canvas preview ignores the flag.

**Still open.** `core/emit-html.ts` (the static HTML preview) ignores the flag — no
whole-pixel box, no clamp, no `align-self` — and draws the fractional box:
a preview surface outside the React + WC core scope (the surface the computed
gate scores through); named here, not fixed. Altitude Tabs' labels are inside
child instance stubs and out of reach until stub content is captured. (§D.43: the
import now follows the `Tab` child, which REFUSES on the §D.41 wall and so stays a
named stub.)

**To reverse.** Delete `carryTextAutoResize` and its four doors, the hoisted
note and `settleTextAutoResize`, in `core/propose-figma.ts` (no contract then carries the flag and every
surface emits what it did); or keep the capture and delete the three
`wholePixelTextBoxPlan` pushes (`css.ts` ×2, `emit-wc.ts`) and the
`applyDeclStrings(s, textBoxes…)` line in `emit-react-inline.ts` to fall back to
the fractional box. The two review decisions reverse on their own (above). The schema
field and the dump field are additive and can stay. **Gates:**
`extract/figma/whole-pixel-text-box.test.ts` (`npm run exact-proposal:check` — both
readers, proposer incl. every refusal, writer round trip through the real plugin
reader, the flagless re-read pinned) and `core/react-whole-pixel-text-box.test.ts`
(`npm run react:conformance:check` — all three surfaces, the tracking spellings,
every validator refusal, and the box MEASURED in Chromium: rounded up less the
trailing tracking, the hug root following, a centred run centred, RTL at the right
edge, vertical writing rounding the block dimension).

## D.43 A REST import read one set; every instance of another set became a geometry-only stub with no content — CLOSED for same-file sets; a remote (library) component, a set that refuses to propose and anything past the cap stay stubs, each NAMED

**2026-09-19. A reader decision taken by the agent under the owner's standing
delegation (never a grade, never a tolerance); recorded so it can be reversed.**
`npm run extract:figma:rest -- <url>?node-id=<set>` fetched exactly one node. Every
INSTANCE of another component inside it reached the proposer as an unresolved
reference and was auto-proposed as a STUB contract — a box with the instance's
bounding size and nothing inside — so the generated React rendered empty children.
Measured on designer files: Altitude `Tabs` missed the unchanged 5 % limit at
5.54 % / 5.19 % with every tab label and the tab panel's content inside stubs, and
§D.40 had shown by hand that fetching the CHILD sets together with the parent took
Altitude `Checkbox Group` from 2 / 12 to 12 / 12. The mechanism already existed
(`fetchNodes` takes several ids, `mapRestToDump` maps them all, the proposer
session-links an instance to a set proposed earlier in the same dump); only the
operator knew to pass the child ids.

**Rule.** A REST import follows its instances. After the requested node is fetched,
every INSTANCE the mapper maps (every one inside a variant that is not itself
inside another instance — the mapper never recurses into an instance, so a set
seen only inside an instance subtree has no reference in the dump to resolve) is
read for its `componentId`; the response's own `components` / `componentSets`
metadata gives the owning set (`componentSetId`, else the standalone component's
own id) and `remote`. Every local target not yet in the dump is fetched in a
further `/nodes` round — 30 ids per request (the batching `visual-truth/rest.mjs`
already uses), a 429 retried up to three times after `Retry-After`, each wait
printed to stderr, and a `Retry-After` over 60 s REFUSED by name
(`rate-limit-wait-exceeds-cap`) instead of slept on — and the new
sets are walked the same way until nothing new is referenced (a fixpoint; a cycle
terminates because a set is fetched once). The merged response lists sets
DEPENDENCIES FIRST — a post-order walk from the requested id, targets in sorted id
order — because the proposer session-links a set only to siblings proposed
earlier in the batch; rounds visit targets in sorted order, so the dump is
byte-stable across runs (two live runs of Tabs: identical bytes). Code:
`extract/figma/rest/closure.ts` (`followInstances`), wired through
`importFromUrl({ closure })` in `fetch.ts`; the CLI turns it ON by default and
`--no-closure` turns it off.

**What it records.** `_provenance.closure` = `{ rule: 'follow-instances', cap,
requested: [{nodeId, name, type}], pulled: [{nodeId, name, type, round,
referencedBy}], unresolved: [{targetId, componentIds, name, reason, detail,
referencedFrom}], cycles: [{from, to, fromNodeId, toNodeId}] }`, and one `_degradations` row per referencing instance
path with the new code `instance-closure-unresolved` (message starts with the
reason), so the proposer attaches it to the parent set's notes exactly like every
other capture receipt. The reasons: `remote-library-component` (`remote: true` on
the component or its set), `not-found` (no metadata, or `/nodes` answered null),
`not-a-component`, `utility-slot-set` (a set named `Slot`, which the mapper never
maps), `set-name-collision` (the dump is keyed by set name), `unreadable` (the
request failed), `cap-exceeded`, `set-name-integer-like` (below) and `cycle-cut`
(below). The CLI prints each on stderr; `extract:figma`
prints a "Dependency closure" section in `figma-proposals.md`; the clean-consumer
receipt carries `inputs.closure` and `inputs.contractGraph`.

**The cap.** `CLOSURE_SET_CAP = 64` pulled sets (requested sets not counted). A
target past it is not fetched and every reference to it is named `cap-exceeded`
(targets are admitted in sorted id order per round, so which ones is
deterministic). **AGENT decision:** past the cap the import still writes the dump,
with those references refused BY NAME, rather than refusing the whole import: the
sets inside the cap are real either way, and a whole-import refusal would leave
the operator only `--no-closure`, which makes EVERY child a stub. **To reverse:**
throw in `followInstances` where it now records `cap-exceeded`.

**A closure child that refuses.** The propose CLI writes nothing when any set
refuses. A set the closure pulled in is not one the operator asked for; letting it
refuse the parent would make the closure strictly worse than today on every file
with one unproposable child (Altitude `Tab` and `Text Passage` both refuse — below).
**AGENT decision:** a set named in `_provenance.closure.pulled` that refuses does
not refuse the run. It is not proposed; the parent, proposed after it, finds no
contract for the instance and auto-proposes today's stub; and the fall-back is
named on stderr and in the report as
`closure-child-refused:<set>:<the refusal, verbatim>` (`partitionClosureRefusals`).
A REQUESTED set's refusal — and any refusal in a dump no closure produced — refuses
exactly as before. A closure child's refusal never becomes a stub without that
name. **To reverse:** make `partitionClosureRefusals` return every skip as
`refused` (one line); the closure then refuses any dump holding an unproposable
child, as a hand-assembled multi-set dump always did.

**A closure child that proposes but refuses at GENERATE — a named limit (review
M1).** The partition above sees propose-time refusals only. A pulled child that
proposes and then fails `ds-contracts generate` (an unresolvable token, a schema
refusal) takes its parent down with it through the generator's refusal ledger
(`RefusalLedger.propagate()`: a parent whose child is refused is refused), exactly
as a hand-assembled multi-set run would. Falling back to the stub there is not
contained: `generate` has no closure provenance, and the stub it would need was
never written (the real proposal claimed its id). No measured set hits it (all
seven proposed children of the four sets generate); the operator's recourse is
`--no-closure`. Named, not fixed.

**Integer-like set names (review, low).** The dump is a JSON object keyed by set
name, and JavaScript orders an array-index-like key (`"1"`, `"42"`) ahead of every
other key, so the dependencies-first order could silently break. A pulled set with
such a name is not followed, and a REQUESTED set with such a name follows nothing;
each reference is named `set-name-integer-like`.

**Cycles (review H2).** A cross-set cycle is legal in Figma through different
variants (a Holder's Md variant instances Chip, Chip instances Holder's Sm
variant). The first cut let the proposer link the back reference to the REAL
contract, and `generate` refused the requested set "Circular contract
dependency" — where without the closure it generated. The walk now cuts the edge
where it re-enters a set on its stack (`cycles: [{from, to, …}]`), `from` is
proposed first, and every instance of `to` inside `from` is written by the mapper
as `instanceOf: "<to> (cycle cut)"` with no component keys and listed under
`unresolved` as `cycle-cut`: the proposer gives it a stub with its own id
(`ds.holder-cycle-cut`), so `generate` sees no cycle and emits all three (the
reviewer's probe, and a gate test that runs propose + generate on it).

**Callers of the REST import (review C1).** `extract/figma/census/first-pass-run.ts`
ran the REST CLI (closure on) and then graded "the" contract as the first non-stub
`*.contract.proposed.json` by name — on Tabs that is `button.contract.proposed.json`,
and it would have graded Button as Tabs and recorded `ok`. It now takes the
contract anchored to the requested node (`bindings.figma.anchors.nodeId`,
`pickRequestedContract`) and refuses by name when there is none
(`requested-contract-not-found:<id>`) or more than one
(`requested-contract-ambiguous:<id>`). **AGENT decision:** the exam keeps the
closure on — it runs the product's own documented command, and a followed child
is exactly what a designer running it gets. Every other caller was checked:
`core/emitters-check.ts`, the Playground import, the fidelity matrix,
`state-axis.test.ts` and the sync spine call the library (closure OFF by default)
or `mapRestToDump` directly; the census `design-to-code` pipeline maps committed
fixtures in-process; the design-led README names the mounted contract explicitly;
the documented command lines (`canvas-census-check.ts`, `census/design-to-code.ts`,
`site/src/diagrams.ts`) read a whole file without a node id, where every set is
already requested and the closure adds none. No other caller selects a contract
by position.

**Library callers.** `importFromUrl` follows only when asked (`closure: true`); the
CLI asks. The Playground's URL import, `core/emitters-check.ts`, the fidelity
matrix and every fixture-backed caller keep their bytes and their request count,
and the sync spine maps its own responses (`mapRestToDump` directly) without a
closure, so no ledger baseline moves and the dump grammar stays v1.36 (a closure
adds sets and provenance; it changes no set's projection). With `--no-closure`
the CLI's dump is byte-identical to the one it wrote before this change: measured
against the committed Altitude Tabs and CBDS Badge dumps (`cmp` clean).

**The harness.** `design:consumer:check` already packaged the whole generated
folder, so real children install with the parent. It now finds the mounted set by
the contract's own anchor node id when `--component` is the generated name (the
§D.40 note: `Checkbox Group` generates `CheckboxGroup` and needed an alias key),
and it lists the contract graph — every transitively referenced component, real or
stub, by the generator's OWN edges (`contractDependencyEdges` in the schema, which
`sortByDependencies` now walks too: component refs, slot `accepts`, slot
`defaultContent` — the first cut missed Icon's `defaultContent` glyph and CBDS's
Placeholder, review M3) — naming any reference no generated folder holds
(`dependency-not-packaged:<id>`). A `--component` that names a set by key or name
whose node id contradicts the contract's anchor refuses
(`dump-set-anchor-mismatch`, review M2; the first cut's test asserted the wrong
answer). It copies every contract beside the mounted one and `minted.dtcg.json`
into `inputs/`. And it fails, by name, on interactive content nested in
interactive content (`interactive-content-nested:<cell>:<outer>><inner>`, HTML's
rule for `a` and `button`; a `label` around its own control is not flagged).
It still mounts and scores only the requested set.

**Measured live** (read-only REST, the product's own commands in order, the
unchanged 5 % limit; "before" is the same pipeline with `--no-closure`, the same
day, the same file version):

| set | children followed | within 5 % before → after | check |
|---|---|---|---|
| Altitude `Tabs` `3558:61955` | `Tab Panel`, `Button`, `Icon` real; `Tab`, `Text Passage` refused → named stubs; `ArrowArcLeft` remote → stub | 0 / 2 (5.54 / 5.19 %) → 2 / 2 by the scorer (1.80 / 1.45 %) — **a pass by the scorer with named content gaps, not a content pass** (below) | still exit 1 — NEW: `interactive-content-nested:…:button>button` and `content-size-mismatch` (453 vs 438 px) |
| Altitude `Checkbox Group` `3570:2154` | `Checkbox`, `Field Note` real | 2 / 12 (4.85 / 6.45 / 7.47 %) → **12 / 12** (2.46 / 2.92 / 3.83 %) | still exit 1 — `content-size-mismatch`, `legend` inert, `state` discarded, all present before |
| Altitude `Badge` `3538:35772` | none referenced | 10 / 10 → 10 / 10, every score identical | exit 0 |
| CBDS `Badge` `277:822` | `Icon` (was a stub), `Placeholder` real | 72 / 72 → 72 / 72, every score identical | exit 0 |

Checkbox Group is reproduced WITHOUT passing a child id. (The set id published by
`/component_sets`, `3442:25022`, is an older generation that `/nodes` returns
with no children; the designer's current set is `3570:2154` on the same page.)

**The Tabs headline, caveated (review H1).** Almost all of the 0 / 2 → 2 / 2 gain
is the real `Button` now drawing inside the panel. The tab labels are still bare
text (gap 2 below) and the two `Text Passage` lines are still absent (gap 3). Figma
draws that text near-white, `rgb(241, 240, 234)`, on a TRANSPARENT background; the
scorer flattens both images onto white, so text Figma draws and the consumer omits
barely registers — a **scorer blind spot for near-white-on-transparent references**,
named here and deliberately not changed. The ink coverage is the honest number:
6.79 % in the consumer against 12.72 % / 13.26 % in Figma. Tabs is a pass by the
scorer with named content gaps, not a content pass.

**A new defect the closure made reachable — refused by the check.** The real
`Tab Panel` is emitted as a `<button>` and now contains `Button`'s `<button>`:
invalid HTML (a `button` may hold no interactive content) and a spurious tab stop.
**AGENT decision:** it FAILS the clean-consumer check by name
(`interactive-content-nested:variant-default:button>button`, a DOM query for
interactive descendants of an `a`/`button`/widget-role element in the consumer),
rather than being shipped silently. The emitter does not refuse it yet: the root
cause is the proposer choosing `<button>` for a set whose own description says
`element: <div>` (gap 1), and an emitter-side refusal needs the whole contract
graph at emit time — the next gap, named. **To reverse:** delete the
`interactive-content-nested` push in `scripts/design-consumer-check.ts`.

**Why Tabs still fails, measured — the next gaps, none tuned here.**
1. `Tab Panel` is now a real contract and renders its `Button` and its two text
   blocks' boxes; it is emitted as a `<button>` (the proposer reads its
   `State` axis as interactive although the designer's description says
   `element: <div>`), and the generated CSS zeroes the border and appearance but
   not the user-agent inline padding: 441 px of content + 6 + 6 = the 453 px the
   check measures against Figma's 438.
   **Closed by §D.44** (both halves, as two general rules).
2. `Tab` refuses in exact mode: its `State` axis draws `Active`, a state the
   contract cannot carry (`state-axis-state-not-carried:active`, the §D.41
   wall). Its three instances stay stubs — the labels render as bare text with
   no padding and no active underline (most of the remaining text-masked diff).
3. `Text Passage` refuses because REST returns the set with NO children
   (`/nodes` for `3435:888` answers a COMPONENT_SET with an empty `children`,
   at this version and the previous one), so exact mode has no variant evidence.
   Its two instances stay 441 × 24 stubs with no text.
4. `ArrowArcLeft` (the Button's icon glyph) is a remote library component.

**Limits, named.**
- Remote (library) components stay stubs; this import reads one file.
- `cap-exceeded` past 64 pulled sets (above).
- Instances nested inside another instance are not followed (the mapper does not
  map them); an `INSTANCE_SWAP` value (`fixedSwaps`) is not followed either.
- The closure brings in every child the parent's instances name, including large
  ones (Tabs pulls the 120-variant `Button`; its dump is 1.7 MB), and each is
  proposed and generated.
- A cut cycle edge draws a geometry-only stub (`<to> (cycle cut)`) where the
  designer drew the real set. Tested on synthetic REST bytes only (no measured set
  has a cycle).
- A closure child that fails at `generate` refuses its parent (above).
- The Playground's URL import does not follow instances (library default off).

**Gates:** `extract/figma/rest/closure.test.ts` (`npm run figma:rest:closure:check`,
fast lane — a recorded CBDS response for the transitive + standalone case; synthetic
REST-shaped responses for transitive chains, a cycle, remote refs by component and
by set, a standalone component, a self-reference, the cap, request batching, every
unresolved reason, nested instances, deterministic order and the byte-identical
opt-out; the propose CLI end to end on a refusing closure child and on the same set
requested; after the review: the cycle proposed AND generated, the
cycle-cut stub spelling, the anchor pick with both refusals, integer-like names,
the 429 cap and its announcements) and `scripts/design-consumer-check.test.ts`
(`npm run design:consumer:test` — the anchor lookup and its refusal, the contract
graph through `defaultContent` and `accepts`, and the nesting query in Chromium).

**To reverse (the whole rule).** Make the CLI default `closure = false` in
`extract/figma/rest/cli.ts` (or pass `--no-closure`): the import is the single-set
import, byte-identical; the proposer partition is inert without
`_provenance.closure`; the harness lookup and graph are additive.

## D.44 An inferred `<button>` held a `<button>`, and a `<button>` the canvas pads on one side only kept the user agent's padding on the other three — CLOSED as two general rules (final form after two adversarial reviews); a named nesting, refused padding sides and the dead `:disabled` plane on a non-native root stay NAMED

**2026-09-19. Two AGENT decisions under the owner's standing delegation (never a
grade, never a tolerance), each recorded with its reverse. The first cut was
reviewed adversarially (fix-then-merge) and is revised below; what the review
found is kept, because it is why the rules read as they do.** Measured by the
design-led clean-consumer check on Altitude `Tabs` after §D.43's closure made the
real `Tab Panel` reachable: `interactive-content-nested:…:button>button` × 2 and
`content-size-mismatch` 453 vs 438 px. `Tab Panel` has a `State` axis and no name
signal, so the semantics table's STRUCTURAL row made it a `<button>`; its variants
hold an instance of Altitude's `Button`, itself a `<button>`. And its contract
declares only `padding-top`, so the user agent's `button` padding (1 px 6 px)
stayed on the other three sides: 441 + 6 + 6 = 453.

### Rule A — a state-axis `button` guess never holds interactive content (proposer)

HTML forbids interactive content inside `<button>` and `<a>`.

*What two reviews found.* The first cut demoted genuine buttons on a guess about a
child (an `Icon` with a `State` axis, icons named `Link` / `Dropdown Arrow`) and
depended on dump order. The second cut weighed evidence case by case (which child
is "really" interactive, which side gives way, a "draws text" test, an origin
taxonomy) and each probe found another edge case, including a chain whose outcome
changed with the order the post-pass decided in. **AGENT decision:** replace both
with the conservative rule below. It only ever removes a GUESS.

**Rule** (`settleInteractiveContent`, core/propose-figma.ts, a post-pass over the
whole batch):
1. *Snapshot first.* Every set's ORIGINAL element and how it was decided
   (`name`-match / `structural` / `declared` by a stamp or the caller's scope) are
   read once, before any change. Every decision reads only that snapshot; the
   changes are applied afterwards. A stub (an instance whose set is not in the
   batch) is read by its name with camel / Pascal case split first (`IconButton` →
   `Icon Button` → `button`).
2. *A name-matched or declared element is never changed*, as parent or as child
   (`Icon Button`, `Close Button`, `Radio button-icon`, `Checkbox`, `Link`).
3. *A STRUCTURAL `button` guess is withheld* (→ the default `div`) when its drawing
   contains ANY interactive content by the snapshot: a child instance (slot
   `defaultContent` included), own part, nested part or stub whose element is
   `button` / `a` / `input` / `select` / `textarea` / `summary` / `label`, or which
   carries an ARIA widget role or `tabindex` — name-matched, declared and
   structural guesses alike, transitively. An icon-only `Close Button` inside a
   `Tab Item(State)` makes the tab a `div`; a `Card(State)` around a `Text
   Label(State)` becomes a `div` (a guess withheld because of a guess, noted).
4. *Never nest silently.* A `button` / `a` that is kept and, after step 3, still
   draws interactive content gets a note:
   `semantics: nested interactive content left in place — "Radio button" is a <button> and draws "Radio button-icon" (<button>); HTML forbids this; author one of them`.

Every withhold replaces the inference note and says what a `div` does not give:
`semantics: structural "button" withheld — the set draws interactive content
("Button": <button>); HTML forbids interactive content inside <button>, so the set
is proposed as the default container "div" — a div provides no keyboard access, no
focus and no :disabled behaviour of its own; review …`. Both notes are proposal
notes, so they reach `figma-proposals.md`; the clean-consumer check copies that
report into `inputs/` (machine paths rewritten to `./`, whole occurrences only).
Free-text descriptions are never read. Registered as door
`propose.semantics-interactive-content-withheld`. **To reverse:** delete the
`settleInteractiveContent` call in `proposeBatchFromDump`; nothing else reads the
snapshot origin map.

*Order.* The SEMANTICS decision is a function of the batch's final contracts, not of
the order the post-pass visits them — tested for every expectation below in both
dump orders, and on the real CBDS dump (1,618 sets) in file order and reversed:
every set's `semantics` and every `semantics:` note is identical. The contract
BYTES are not order-free, and were not before §D.44: the proposer links an
instance only to a set proposed EARLIER in the batch (the closure orders
dependencies first for exactly this reason), so 44 of those 1,618 CBDS contracts
differ between the two orders in their component links. And where two sets
sanitize to one id (CBDS `Radio button` and Phosphor `RadioButton`), swapping only
those two keys changes which set an instance links to, and so which note it gets —
the pre-existing id collision (§D.43), not this rule.

*Expected outcomes, all tests (each in both orders):* `Tab Panel(State)` >
Altitude `Button` → `div`; `Tab Panel(State)` > `Button` > `Label` instance →
`div`; `Button` > `Icon(State=Disabled)` → `Button` a button, `Icon` unchanged,
nesting named; `Dropdown Button` > `Dropdown Arrow` → both unchanged, nesting named;
`Split Button` > `Icon Button` and `Toolbar` > `Icon Button` → `Icon Button` a
button, `Split Button` a button with the note, `Toolbar` unchanged; `Tab
Item(State)` > `Close Button` → `div`; `List Row(State)` > `Checkbox` → `div`;
`Card(State)` > `Text Label(State)` → `Card` `div`, `Text Label` unchanged; the
`Alpha Button` ↔ `Beta Button` cycle → both buttons, a note on both; CBDS `Radio
button` ↔ `Radio button-icon` (the real dump's own cycle) → both buttons, a note on
both.

*Churn, measured* over every committed dump (the review's `churnB`: 378 dumps,
5,285 proposed sets): two distinct sets change element — Altitude `Tab Panel`
(1 dump) and Untitled UI `_Dropdown list item` (4 dumps: a structural `button`
around UUI's `Checkbox`, an `<input>`). Six nestings are left in place, every one
NAMED (CBDS `Radio button` > `Radio button-icon` in 4 dumps, the reverse edge in
2), none silent (the pre-§D.44 engine left 2 silent). In the design-to-code census, figma-ds `Chip`
(a structural `button` whose dismissible variants draw the kit's `Button/Icon
default sm`) is now a `div`: its `d2c.json` contract and generated hashes move. Its
committed code PNGs and `verdict.json` were rendered and graded before this change
and are NOT re-rendered here (a re-render also moves Figma's canvas PNGs by bytes,
and a re-grade is not this change's to take) — named. No committed contract or
generated tree is built by re-proposing these: UUI's committed
`dropdown-list-item.contract.json` was proposed before and stays a `button` holding
the `Checkbox` until it is re-proposed — named here.

### Rule B — a padding side the canvas draws as 0 is carried as 0 (proposer)

*What the review found in the first cut (H2).* The first cut put the rule in the
EMITTERS ("an undeclared side is 0") and zeroed padding the designer DREW: Eventz
`Atoms/Tag` draws 6 / 12, the proposer REFUSED its inline padding
(examples/eventz-vars/NOTES.md), and the reset emitted `padding-left/right: 0` — a
visual regression the first churn note called "explained". Undeclared is not zero
whenever a side was refused.

**Rule.** The fact moves to where it is known. When a proposal's root renders (its
element or any `elementByProp` value) as an element the user agent pads, and EVERY
variant draws 0 on a side the contract does not declare, the proposer writes
`padding-<side>: 0px` as a root literal and says so
(`ua-padding: padding-top / padding-bottom = 0px carried as literals — …`). A side
the canvas draws NONZERO that the proposal left undeclared was refused upstream: it
is NOT zeroed, and a note says the user agent's default renders there
(`ua-padding: padding-left is not declared (the value was refused above) although
the canvas draws 8 / 12px there — on a <button> root the user agent's default (6px)
renders on that side in code, not the drawn value; review`; it says `no value
carried` instead unless a refusal note for that side is on record). The per-side
values the note quotes come from ONE table, `UA_PADDING_BY_ELEMENT` in
packages/core `anatomy.ts` (`UA_PADDING_ELEMENTS` is its key set), and the test
re-measures every value in Chromium. The emitters add
nothing; a hand-written `<button>` with partial padding keeps UA padding, exactly as
CSS does. `settleUaPadding` runs at the end of every proposal and again after
Rule A's pass, and takes its own zeros back when that pass withholds the element
(Tab Panel ends a `div` with no zero). Registered as lowering
`propose.ua-padding-drawn-zero-explicit` (the emitter rule
`css.ua-padding-undeclared-side-zero` is withdrawn). **To reverse:** delete the two
`settleUaPadding` calls.

`UA_PADDING_ELEMENTS` (packages/core `anatomy.ts`) is MEASURED with
`getComputedStyle` on bare elements in the repo's Chromium (149.0.7827.55):
`button` 1/6/1/6 px, `input` 1/2/1/2, `textarea` 2/2/2/2, `option` 0/2/1/2,
`fieldset` 5.6/12/10/12, `legend` 0/2/0/2, `ul`/`ol`/`menu` 40 px inline start,
`dialog[open]` 16 px, `td`/`th` 1 px; every other element the emitters render
measured 0. **`select` is 0 in Chromium; Safari and Firefox were NOT measured and
may pad it — it is not listed, named here (L1).** The review's wider probe adds:
`input[type=date]` pads only its left side (1 px) and an RTL `ul` pads the right,
which a physical-side reading sees correctly only for LTR.

*The review's leak cases (M3), under the proposer approach.* A side declared by
only SOME enum values (`literalsByProp`) counts as declared, so no base zero is
written and the other values keep the user agent's padding on that side — still
named, not closed (the proposer would need per-value zeros). A single logical side
(`padding-inline-start`) now counts only its own physical side (LTR). A state-only
or `stylesWhen`-only padding is undeclared at rest, as before. The emitters no
longer add anything, so none of the probe's emitter surfaces leak.

*Churn, measured.* Over every committed dump: 14 distinct set names gain zeros (31
dump occurrences) — Untitled UI `_Avatar add button`, CBDS `Radio button`,
`Text Area`, `GitLab Button / Default`, flowbite `Button` and `ToggleSwitch`,
shadcn `Button`, `Checkbox`, `Switch`, Carbon and first-party `IconButton`, the
`base-instance` Button fixture, two conformance `Case` sets and the two fidelity
`compiled` Buttons; two sets are named as refused (Eventz `Atoms/Tag` inline, MUI
`Button` all four). Committed artifacts that move: the design-to-code census rows
whose contracts are re-proposed in-process — flowbite `Button` (+ top/bottom),
`ToggleSwitch` (+ all four), figma-ds `ButtonContract` (+ top/bottom) and `Chip`
(+ top/bottom), and figma-ds `Button`, whose row carries its `ButtonContract`
child's hashes (contract hash, generated hashes, notes count). Eventz `AtomsTag`
and Untitled UI `AvatarAddButton` are generated from COMMITTED contracts, which this
change does not re-propose: their generated CSS is byte-identical to before §D.44
(the first cut's regression on `AtomsTag` is gone). The Altitude Tabs evidence's
`Button` contract gains `padding-top/bottom: 0px`.

### Measured live

Read-only REST, closure on, the product's own commands; every dump byte-identical
to §D.43's run of the same file version, so "before" is the evidence committed
before §D.44:

| set | within 5 % before → after | check before → after |
|---|---|---|
| Altitude `Tabs` `3558:61955` | 2 / 2 (1.80 / 1.45 %) → 2 / 2 (1.82 / 1.44 %) | `interactive-content-nested` × 2 + `content-size-mismatch` × 2 (453 vs 438 / 439) → `content-size-mismatch` × 1: 441 vs 438 on `variant-default` (`variant-stretch` is 441 vs 439, inside the check's unchanged 2 px slack) |
| Altitude `Checkbox Group` `3570:2154` | 12 / 12 → 12 / 12, every score identical | the same 14 problems |
| Altitude `Badge` `3538:35772` | 10 / 10 → 10 / 10, every score identical | exit 0 → exit 0 |
| CBDS `Badge` `277:822` | 72 / 72 → 72 / 72, every score identical | exit 0 → exit 0 |

On Tabs the 12 px came off with Rule A (the panel is a `<div>`, so no UA padding
applies). Rule B's live effect is Altitude `Button`, whose contract now carries
`padding-top: 0px; padding-bottom: 0px` (the same box as before). What remains is
441 vs 438: the two `Text Passage` STUBS carry the 441 px box observed on `Tab
Panel`'s main component, while the panel instance inside Tabs is 439 px and Figma's
trimmed default render 438 — §D.43's gap 3 (`Text Passage` refuses), not either
rule. Tabs is still a pass by the scorer with named content gaps (§D.43 H1), not a
content pass.

**Limits, named.**
- *A named or declared nesting is kept, not resolved* (step 4 names it): CBDS
  `Radio button` ↔ `Radio button-icon`, a `Split Button` around an `Icon Button`.
- *A void re-root reads as a container.* A `Text Input` whose `input` was re-rooted
  to a `div` (children cannot mount in a void element) is a `div` in the snapshot,
  so a structural parent around it keeps its `button`.
- *The single-set `proposeFromDump` entry* (no batch) applies no Rule A.
- *A stub is read by its name, including a kit's path prefix.* The canvas-to-code
  exam's Altitude `Button` draws a stub of `__button/helper/loading / spinner`
  (contract name `ButtonHelperLoadingSpinner1`), which the table reads as a
  `button`: the Button stays a `button` and gains a nesting note it does not
  deserve (recipe/evidence/canvas-to-code-v1 `receipt.json`: proposal notes 51 →
  52, re-recorded with `tsx recipe/canvas-to-code.ts --write`; the contract is
  unchanged). Under a STRUCTURAL parent the same name would withhold its `button`
  guess. The stub keeps no other trace of its path, and the description is not
  read, so this is named, not fixed.
- *A set that IS the control and wraps a real control* now proposes a `div`; the
  reviewer re-roots it or stamps the element.
- *The dead `:disabled` plane on a non-native root — the next gap, NOT fixed here.*
  A withheld set with a `State=Disabled` axis keeps its `disabled` prop, which a
  `div` renders as `data-disabled`, while its CSS is `.root:disabled { … }`, which
  never matches a `div` (the review's probe A4; the same pre-existing emitter bug
  the review counts on 64 contracts). Rule A can now send ex-button sets into it;
  fixing it (a state selector that matches the rendered attribute on non-form-control
  roots) is emitter churn of its own and is left, named, for the next change.
- *Padding:* only the ROOT is settled; a refused side keeps UA padding (named);
  per-value-only sides and non-LTR directions as above; `select` unmeasured outside
  Chromium.

**Gates:** `extract/figma/interactive-content.test.ts` and
`extract/figma/ua-padding.test.ts` (`npm run exact-proposal:check`): every Rule A
expectation above in both dump orders; the real CBDS dump forward and reversed;
camel-case stubs, own and nested parts, `attrs.role`, `tabindex`, `summary`, slot
`defaultContent`, transitivity and a cycle; the UA padding element list AND its
per-side values re-measured in Chromium; drawn zeros carried and emitted; four drawn
sides and `div` roots untouched; a side with no value named as `no value carried`
and one with a refusal on record as refused; per-value and logical sides; Tab
Panel's zeros taken back.
