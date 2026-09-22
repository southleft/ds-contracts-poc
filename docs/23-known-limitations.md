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

## B.40 A revoked update write can still execute late

*The landed-write recovery was shown live on 2026-09-19; the untouched and late-execution interleavings below remain synthetic.* A native update write runs only after the companion asks the app to
`begin` it. If that companion then dies, an operator can **attest the companion
is gone** (`…/update/<proposal>/attest-dead`). The journal records
`update-attempt-attested-dead`, revokes the attempt, and a canvas read dispatched
afterwards settles the write like any other unknown write. [CURRENT](CURRENT.md)
row 3 lists the refusals.

**When it is accepted.** Only when the latest write was begun and is unresolved,
and only while no companion for this update has polled within the transport's
15-second liveness window (`native-update-attest-dead-companion-connected`
otherwise). The review page also waits one minute after `begin` before offering
it. Neither check proves the companion is gone: a companion busy executing a
program does not poll. The operator's statement is the proof.

**What the attestation guarantees.** The revoked attempt may never `begin`
again. Its result is journaled as `late-result-after-revocation` and is never
the outcome. Before the settling read, the result is evidence only: the read
decides. After the read, the result is judged by the same allow-list as any
late write result. After an untouched settlement, anything but `no-op` or
`refused` stops the update. After a landed settlement, anything but `updated`
or `no-op` stops it. A stopped update is `update-recovery-required` with
`native-update-late-write-result-contradicts-canvas`, and every chain guard
treats it as a written, unverified correction. The settling read is final
only until such a result arrives.

**Live recovery and a corrected inference (AGENT decision, 2026-09-19).** In
Evaluations, Switch update `b5b224ff…` began its reviewed 0.5 → 0.4 correction
before the local server was interrupted and the companion closed. The journal
contained `begin` without a result. After restart, the operator attested through
the application, reopened the companion and chose **Resolve by reading the
canvas**. The companion replayed its saved result after revocation; it was kept
as evidence only. The settling canvas read found all three existing disabled
variants and their owned variable at float32 0.4, and a separate read verified
the update. A late delivery therefore does not prove a companion was alive at
attestation time or establish when its write ran. The review copy now describes
that uncertainty and directs an unresolved write to its canvas read. The alarm
and conservative settlement rules are unchanged. Reversal: revert the copy and
comment correction; no journal migration is needed. Evidence:
`private/begun-write-recovery-2026-09-19-kg6h29ab/`, original append-only update
journal, and the visible application review. This qualifies this recovery path,
not the complete product or visual fidelity.
The source was then restored byte-for-byte; reverse update `4b663716…` verified
the same three components and variable back at 0.5. With the plugin closed, the
nine native Switch variants were inspected on the live canvas. No native node
was created by this trial. Three checked-state source/native pairs still lack
alignment metadata, so their displayed exports remain diagnostic.

**What it does not guarantee.** It cannot stop a companion that is in fact alive
and already past `begin`. The companion runs inside the Figma plugin sandbox,
and its program cannot reach the app synchronously before it assigns a value.
Such a program can land after the settling read. What bounds the damage:

- The pinned program writes only when each node holds the exact saved or
  proposed value and everything else matches the saved baseline. Over a
  verified canvas it is a `no-op`; over a designer's edit it refuses.
- If it reports back, its result is judged as above.
- If it writes without reporting after an untouched settlement, detection
  happens only if a later preflight runs on this operation, which means the
  operator re-arms. The first preflight that actually reads the canvas after
  the settlement names `native-update-canvas-moved-after-revoked-settlement`
  when the canvas is not the saved baseline, or when the program refused after
  reading it. A preflight that never returned, or that ran in another file,
  concludes nothing, and the next one is checked instead. The name stays on the
  record.
- If nobody re-arms, nothing in this operation detects it. A design read is
  offered only on a verified update. A later proposal's preflight on the same
  nodes sees the changed values as a conflict.
- **The P3 interleave is benign.** The revoked write can land after the
  re-armed write's preflight and before its execution. Both programs write the
  same proposed values, so the re-armed program finds them already there,
  reports `no-op`, and the independent readback verifies. No preflight saw the
  canvas move, so nothing is named, and nothing needs to be.
- The one case it can still write unseen is a later reverse correction that
  has returned every node to this write's saved values. There the late program
  lands its proposed values again, and only a design read or the next
  correction notices.

**Why there is no canvas-side revocation token (AGENT decision, 2026-09-19).**
One stronger design was considered: a per-attempt token in plugin data that the
settling read overwrites and the write program checks just before it assigns.
It was rejected for three reasons:

1. The write program is pinned byte for byte in every saved update journal.
   Adding a check would change every program and make every prepared update
   report `source-or-compiler-changed`.
2. Stamping the token would turn the read-only settling read into a canvas
   write. That write could itself be interrupted, which is the problem it is
   meant to solve.
3. Two Figma clients do not share a transaction. A check followed by a write in
   one client is not atomic against a stamp from another client, so the token
   would narrow the window without closing it.

*Reverse:* add a plugin-data stamp phase and a token check to the update
program, re-record every open update journal under the new program, and re-record
the plugin engine receipt.

## B.41 Declared React workspaces no longer require unused sandbox CSS inputs

**AGENT decision (2026-09-19).** The first Radix Themes application load failed
before bundling because `buildReactReference` always opened `src/index.css`
and `capture-input.css`. Those names belong to the original sandbox, not the
declared-cohort contract. Declared workspaces may omit them. If present they
remain pinned exactly as before, preserving existing reference identities;
adding or removing one invalidates a saved reference. A dangling symlink or
unreadable present file still refuses. The built-in preset continues to
require both. Imported CSS, installed dependencies, the declaration, project
metadata and source witnesses remain authenticated.

Evidence: the minimal declared-workspace test failed on the old reader, then
passed without either unused file. The original seven-case family still builds
reference `77c5af2d963eb1aa40c46e2fa4f283ebcebe364863eefe10c35bf1b93050575c`;
the new four-case Radix workspace builds without placeholder files. This is
source intake, not proof of conversion or visual fidelity. Reverse by removing
the conditional omission and presence check; old evidence needs no rewrite.

## B.42 Source succession requires the same module and exported component

**AGENT decision (2026-09-19).** Loading the second, Radix workspace showed
an unrelated shadcn Switch as a candidate for **Follow the current source**:
both declarations used `switch-unchecked`. The case-name guard did not prove
component identity. No cross-workspace adoption was performed.

The application now authenticates the journal-pinned ownership inventory,
report and source program, selects the unique component owning the case root,
and compares its absolute module path and export name with the successor.
Source bytes and declaration spans may change during an ordinary edit. A
matching relative filename in another workspace, or another export in the same
file, is insufficient. An authenticated old module absent from the loaded
reference is not offered. Missing or altered identity evidence stays visible
with Follow disabled and refuses the action. The historical archive need not
match current source bytes, and its files are never rewritten.

This deliberately does not migrate a component after a module/workspace move.
That needs an explicit identity migration design. Probes cover changed bytes,
foreign workspaces, replaced exports, ambiguous roots, altered archives and the
HTTP refusal without a succession write. A read-only probe of the real Switch
archive accepted all four existing successions and the restored family, while
excluding the Radix reference. The earlier same-node update and
recovery evidence remains historical; this extra guard does not re-grade it.
Reverse by removing the route identity guard and candidate filter, restoring
case-name-only succession. No schema, native writer or old journal changes.

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
  refuses `EXACT_MATRIX_RAGGED`, with `stamps-not-observable` in its technical detail.

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

**AGENT decision — enforce the bound at the first exactness check.** A further
bounded probe found that `validateExactVariantProjection` still enumerated the
full product before the proposer reached the bound above. Thirteen binary axes
with fourteen drawn rows allocated 8,192 tuples; larger sparse inputs could
exhaust memory before refusing. The validator now validates the observed rows
and multiplies their axis cardinalities first. Above 4,096, a ragged source is
refused with counts and no enumerated missing-tuple list. A fully observed large
product still verifies from valid, unique rows whose count equals the product;
its returned rows must remain complete. The declaration limit and exactness
requirements are unchanged. To reverse, remove this cardinality branch from
`core/exact-projection.ts` and the two boundary probes; that restores expansion
before refusal. Evidence is synthetic, in `extract/figma/absent-variants.test.ts`.

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
"unstamped" proves nothing: the receipt stays `refused-by-name` at propose. Its
historical message and all four frozen evidence files remain byte-identical to
main. The additional `stamps-not-observable` explanation rides the existing
technical-detail channel on the batch refusal. The tally stays **5 accounting-clean,
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
  **The dead plane is closed by §D.45** (re-measured there on `Link` and both
  Toggles); the unfocusable root is not.
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

**Consumer observation correction (AGENT decision, 2026-09-19).** A browser
probe changed only the font size of a fixed-size control on real hover. Its
pixels changed, but the check reported `state-inert` because its computed paint
snapshot omitted font size. The same gap affected font family and line height.
The snapshot now includes those three properties; a browser regression checks
each with different before/after screenshots and unchanged control dimensions.
The pixel scorer, 5% limit, source pairing and frozen evidence are unchanged.
This corrects a measurement failure, not a product fidelity result. Reversal:
remove the three computed properties from `paintOf` and the typography probe;
the rest of the state-axis rule is independent.


### D.41 follow-up — variant effects include descendants

**AGENT measurement decision, 2026-09-19.** The clean-consumer variant probe
previously compared only root styles, bounds and class names. A parent prop
forwarded to a child could visibly work while the check reported
`variant-prop-discarded`; an unused root class could imply an effect with no
changed drawing. The probe now records subtree paint, rendered text and exact
geometry relative to the root. It excludes class names. Browser probes verify
changed descendant color, rearrangement at fixed root bounds, and equal-width
text replacement against actual different screenshots; an unused class stays
inert. This does not change the image scorer or its 5% limit. Existing receipts
remain historical until remeasured. Reversal: restore the former root-only
observer in `scripts/design-consumer-check.ts`, retaining these known false
positive and false negative cases in the limitation ledger.


## D.42 A Figma text box that sizes itself to its text is a whole number of pixels wide; the browser's is fractional — CLOSED for React, React inline and web components where `calc-size()` is supported; OPEN on static HTML and in browsers without it

**Historical integration measurement, 2026-09-19.** After merging the current
state-axis and consumer-check changes, fresh REST reads and newly generated,
installed consumers measure Altitude Badge **10/10**, CBDS Badge **66/72** and
Altitude Tabs **0/2** on both white and black. All 72 CBDS rows pass white
(maximum 4.427%); six small rounded outline rows fail black (maximum 6.120%).
Altitude Badge's maximum is 4.825% on either background. Tabs retains missing
child content, an ineffective variant change and a 40px versus 176px content
height mismatch; its maxima are 7.081% white and 9.030% black. These are CLI
consumer measurements, not a full application or semantic qualification.
No source design, scorer or 5% limit changed. The 72/72 table below is the
historical white-only result, retained with its original receipts. Both sides
of the integration and the fresh measurements are preserved privately in
`pr135-main-integration-c93fqc91/`; the new observation does not rewrite them.

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
inline-size: calc-size(max-content, round(up, size - <letter-spacing>, 1px));  /* an owned tracked label */
max-inline-size: 100%;        /* unless the part carries its own max-width */
align-self: flex-start;       /* only under a flex column that would stretch it */
```

**2026-09-21 tracked-text revision:** the tracked box also carries a private
tracking variable and a block text run whose inline size is
`calc-size(100%, size + var(--_dsc-text-box-tracking))`. It keeps the final
advance available for line breaking without including it in the layout box.
An absent or empty text value contributes zero width. A default minimum of
zero allows grid tracks to shrink; authored minimums remain authoritative.
Untracked text retains the earlier `fit-content` rule. See D.93 for the
measured wrapping defect, bounded enum support and remaining image failures.

`calc-size()` is the only CSS that can round an INTRINSIC size (a plain `round()`
cannot take `fit-content`). `fit-content` is `min(max-content, max(min-content,
available))`: a label that fits is its max-content box rounded up; a string that
does not fit wraps at the available width exactly as it does without the fact.
`max-inline-size: 100%` removes the one thing rounding can still do to a wrapped
box — push a fractional available width (120.5 px) up by the remaining sub-pixel.
A browser without `calc-size()` drops both outer and inner sizing declarations
at parse or assignment. It retains the fractional, untrimmed browser advance;
tracking and rounding can make this differ from Figma by more than a subpixel.
The existing clamp and conditional start alignment still apply. No fallback
Figma fidelity is claimed; both declarations use the same feature boundary. Logical
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
resolved value inline. Per-value variant or state overrides remain refused.
Complete enum-placeholder tokens now select a matching box and run rule as
described in D.93. On the 23 untracked samples the two forms are the same number.

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
per-variant / per-state `letter-spacing` overrides, or a placeholder token
without one to three distinct enum axes and explicit defaults; beside a literal
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
- **Per-value tracking overrides** remain refused. D.93 now carries complete
  captured enum-placeholder tracking with a selected box/run rule; ambiguous
  axes or missing values still refuse.
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
CLI and Playground URL import ask. The Playground fixture demo uses that same
option. `core/emitters-check.ts`, the fidelity matrix and the other
fixture-backed callers keep their bytes and their request count,
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

**Historical white-only measurement** (read-only REST, the product's own commands in order, the
unchanged 5 % limit; "before" is the same pipeline with `--no-closure`, the same
day, the same file version). These receipts predate D.51; the fresh integration
results below supersede their qualification claims:

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
- The Playground retains at most 30 imported components in a session. A larger
  family refuses atomically instead of evicting a child during import; the REST
  walk still has its separate 64-child cap.

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

**Same-set cycle correction (AGENT decision, 2026-09-19).** A variant can
contain an instance of another main in its own component set. The closure walk
previously discarded that self-edge; the proposer then named the self-reference
but emitted an empty part, with no child contract or geometry stub. Self-edges
now enter the existing cycle walk and produce the same `cycle-cut` record and
distinct stub as a cross-set cycle. They fetch no additional set. The bounded
probe runs both shapes through proposal and generation; neither produces a
circular contract graph. This preserves the named geometry fallback, not the
nested variant's full content. Reversal: restore the `targetId !== setId` filter
in `followInstances` and the previous self-reference expectation.

**Application family retention (AGENT decision, 2026-09-19).** The URL import
now opts into the same closure walk. A closure-backed REST result or pasted
REST dump is saved as one atomic workspace family, including each component's
own minted/captured token layer and any named provisional stubs. The initially
selected parent is found by its requested Figma node id; dependency-first
ordering must not silently open the first child. A missing, ambiguous or refused
requested parent leaves the workspace unchanged. A refused dependency remains a
named stub. The existing 30-component workspace cap applies to the whole family.

A recorded CBDS Icon/Placeholder replay exercises the application transport,
storage, parent selection and React/HTML emission from the restored session
graph, plus repeats, refused children, oversized batches and requested-parent
refusals. This is integration evidence, not a new live fidelity measurement or
a clean-consumer application proof. Reverse by removing the application closure
option and family recording calls; the CLI rule and old evidence stay intact.


**Historical main integration measurement (2026-09-20).** Fresh REST GET-only reads of all
four sets, followed by proposal, dependency generation, clean package installation
and transparent captures on white and black, retain the unchanged 5% limit.
Altitude Badge passes 10/10 (maximum 4.825% on either background). CBDS Badge
passes 66/72: every white comparison passes (maximum 4.427%), while six small
rounded outlines fail black (maximum 6.120%). Tabs passes both image comparisons
at 2/2 (maximum 1.812% white / 3.525% black), but its consumer visibly omits text,
contains nested buttons, discards the variant change and measures 453px wide
against 438/439px native. Its checker still fails. Checkbox Group passes 12/12
on white (maximum 4.011%) and 0/12 on black (maximum 10.364%); its hidden legend
still renders, its legend axis is inert and nine content-size checks fail.

The black triptychs were inspected. Their visible missing and incorrect content
prevents treating a small whole-canvas difference as a completed journey. Both
conflict versions and all new dumps, proposals, generated packages, receipts,
images and built review consumers are retained under private
`pr136-main-integration-s0jph0cm/`. No old receipt was rewritten. These are CLI
integration measurements, not a new application acceptance or a visual grade.


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
- *Stub names remain provisional semantic evidence.* The in-memory observed name
  retains slash-delimited namespaces; only the final component segment and the observed instance layer leaf
  enter the control-name inference. A main ending in variant values such as
  `Button (Icon)/Default/sm` retains the actual `Button (Icon)` layer signal. A namespace such as `Button / Decoration` does
  not make its `Chevron` leaf interactive, while `Controls / CloseButton`
  remains a control signal. The generated stub contract and its serialized name
  are unchanged. External stubs without that observation retain the existing
  serialized-name inference. This AGENT correction removes a false nesting note
  and keeps the frozen canvas-to-code-v1 receipt byte-identical to main; no
  receipt is regenerated. Reverse by removing the private observed-name map and
  restoring whole-identifier inference, preserving the historical evidence.
- *A set that IS the control and wraps a real control* now proposes a `div`; the
  reviewer re-roots it or stamps the element.
- *The dead `:disabled` plane on a non-native root* (the review's probe A4): a
  withheld set keeps its `disabled` prop, rendered as `data-disabled` on a `div`.
  **Closed by §D.45** — the state selector is now the attribute the component renders.
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


**Historical main integration measurement (2026-09-20).** After integrating the
landed dependency-closure PR, fresh REST GET-only captures and isolated packaged
consumers retain the unchanged white-and-black 5% criterion. Tabs has no nested
interactive-content finding; its width is 441px rather than 453px. Both images
pass (maximum 1.824% white / 3.593% black), but the variant change remains
discarded, the default content width remains 441px versus 438px, and the two
Text Passage lines are visibly missing. The tab labels also have incorrect
color and spacing, and the native active indicator is absent. This is not a
completed Tabs journey.
Altitude Badge remains 10/10, CBDS Badge 66/72, and Checkbox Group 0/12 on the
joint criterion (all 12 white comparisons pass; all 12 black comparisons fail).
The six CBDS small rounded outlines, hidden Group legends and nine Group
content-size failures remain. Private evidence `pr137-main-integration-tbx6mgdq/`
preserves the actual merge conflicts, both sides, fresh inputs, generated
packages, receipts and visible review. These are CLI integration measurements;
they do not newly qualify the app workflow or independent child components.
The frozen recipe lineages, owner results and OS-specific drift pins have no
differences from landed main.

## D.45 A disabled state on a root that is not a form control compiled to `:disabled`, which never matches it — CLOSED on React CSS modules, web components and static HTML; behaviour (focus, handlers) and a no-prop disabled state stay NAMED

**2026-09-19. One AGENT emitter rule under the owner's standing delegation (never a
grade, never a tolerance), and one AGENT accessibility decision, each recorded with
its reverse.** `:disabled` matches only a form control (`button`, `input`, `select`,
`textarea`, `fieldset`, `optgroup`, `option`, a form-associated custom element). The
generated TSX renders the `disabled` prop as the native attribute only on those; on
every other root (`div`, `span`, `a`, `label`, `li`, `section`, …) it renders
`data-disabled`. The CSS shipped beside it said `.root:disabled { … }`, so the
disabled look never rendered, and `.root:hover:not(:disabled)` never excluded the
disabled state (a disabled `div` still took its hover paint). §D.44's Rule A made it
reachable from new sets: a withheld `button` guess keeps its `disabled` prop.

**Rule** (lowering `css.disabled-state-rendered-attribute`): *a disabled state styles
what the element actually exposes — `:disabled` for a native form control, and the
attribute the component renders for every other root and part.*

| surface | native root (`button`, `input`, `textarea`, `select`, `fieldset`) | every other root | `elementByProp` root |
|---|---|---|---|
| React CSS module (`generateCss`, `reactRootDisabledSelector`) | `:disabled`, `:hover:not(:disabled)` — byte-identical | `[data-disabled]`, `:hover:not([data-disabled])`, `:active:not([data-disabled])` | `[data-disabled]`: the TSX types the ref `HTMLElement` and renders `data-disabled` on every value, `<button>` included |
| web components (`shadowCss`, `wcRootDisabledSelector`) | `:disabled` — byte-identical | `[data-disabled]` (the internal root renders `data-disabled=""`) | per rendered tag: `:is(:disabled, [data-disabled])` when the map mixes both kinds |
| static HTML (`core/emit-html.ts`, `htmlRootDisabledSelector`) | `:disabled` — byte-identical | `[data-disabled]` (the showcase renders `data-disabled="true"`) | per rendered tag, counting a root projected to a `div` (`textarea` / void / structural `select` with parts) as a `div` |
| React inline | unchanged — its disabled plane rides the prop (`DISABLED_STYLE`), no selector | | |

`packages/core` `anatomy.ts` `disabledStateSelector` + `stateSelectorsFor` build the
table; a native root gets `STATE_SELECTORS` itself, so its bytes cannot move. Every
rule that selects the disabled state reads it: `states`, `declaredStates`,
`statesByProp`, a `{disabled}` bool placeholder, the button-only `cursor:
not-allowed` rule and the React `stylesWhen` `disabled` condition. **Parts:** a part's
state rule is a descendant of the ROOT's state selector (`.root[data-disabled]
.label`), because the disabled state is the root's; the part's own element never
decides. **Specificity is unchanged** (an attribute selector weighs what a
pseudo-class does; `:is()` takes its heaviest argument), so no rule moves in the
cascade. **The inverse:** the code → contract reader (`core/extract-css-module.ts`
`rootDisabledAsPseudo`) reads `[data-disabled]` / `:not([data-disabled])` on the root
class and its enum modifier classes back as the disabled / hover states, exactly
as it reads `:disabled`; without it a generated `div` component re-extracted with
neither.

**Adversarial review, 2026-09-19.** The first inverse recognised only the root's
base class. A generated enum-dependent state (`.tone-a[data-disabled]`,
`.tone-a:hover:not([data-disabled])`) lost both state bindings on re-extraction;
the same contract preserved both on the parent branch and on a native `button`.
**AGENT decision:** use the reader's existing enum-class identity resolver for
this inverse too, including JSX-discovered BEM modifiers. An unrelated part's
`[data-disabled]` remains a named unsupported selector and cannot become a root
state. The regression probe failed before the fix and passes afterwards with
both generated and BEM class spellings and the native control. Emitted files
are unchanged by this reader fix. **To reverse:** restrict
`rootDisabledAsPseudo` to the root's base class again; enum-dependent disabled
and guarded hover/active states will be lost by name on re-extraction.

**AGENT decision — no `aria-disabled`.** Neither React surface nor web components
renders `aria-disabled` for the prop; this change does not add it. In the committed
corpus no affected root is interactive: none of the 52 has a role, a root click event
or a `tabindex` — they are wrappers (`label`, `span`, `div`) around an inner native
control, which carries its own `disabled`. `aria-disabled` on a role-less element is
not supported in ARIA 1.2, and on a root whose handlers still fire it would announce
a state the element does not honour. The honest fix for an interactive non-native
root is behaviour and announcement together (guard the handlers, drop the tab stop,
`aria-disabled="true"` where the role supports it) — a separate rule. **To reverse:**
push `aria-disabled={disabled || undefined}` beside `data-disabled` for a non-native
root in `core/emit-react.ts` and `core/emit-react-inline.ts`, and `aria-disabled="true"`
beside `data-disabled=""` in `emit-wc.ts` `generateElement`; native roots keep the
native attribute only.

**Measured on the committed corpus** (all 984 tracked `*.contract.json`, the React
module sheet with every token admitted): 128 declare a disabled state, **64** on a
root that is not a form control (none under `elementByProp`); **52 emitted a dead
`:disabled` before, 0 after** — the other 12 declare the state with no rule to
select. The same 64 after, on the other sheets: web components 0 `:disabled` (64
of 64 emitted); static HTML 0 on its own rules (45 emitted — 19 refuse to emit for
reasons unrelated to this rule, e.g. unresolved component refs). Of the 52, 26 have a `disabled` prop (the look now renders when it is set)
and 26 do not (Carbon, Fluent, shadcn, Astryx wrappers): their state is reachable
only by passing `data-disabled` through the rest props — unreachable before, named
below. One tracked contract uses `elementByProp`; it has no `disabled` prop.

**Churn, every file** (regenerated with the repo's own commands):
- `examples/polaris/generated/react/{Checkbox,RadioButton,Tag,TextField}.module.css`
  and `…/html/{checkbox,radio-button,tag,text-field}.css` (`npx tsx
  examples/polaris/generate.ts`, the command `figma:fresh` checks): `span` / `div`
  roots with a `disabled` prop and state, and part states under it. **These now
  render a disabled look they never rendered.** The committed Polaris receipts
  render the default combo only (`receipts/*/default.png`, rest state), so no
  committed PNG shows a disabled cell; nothing re-rendered.
- `examples/eventz-vars/storybook/src/generated/AtomsInput/AtomsInput.module.css`
  (the `generated:fresh` command): a `div` root with a hover part state and no
  disabled state or prop — the guard's spelling only; nothing renders differently.
- `parity/receipts/v1/census/design-to-code/figma-ds/ds.chip/d2c.json` (`npm run
  census:d2c:record`): `Chip`, a `div` since §D.44, with `hover` + `disabled` states
  and a `disabled` prop — React and WC sheet hashes move; **its disabled look now
  renders**. Its committed PNGs are `state-default` cells only and are not
  re-rendered (a re-render also moves Figma's canvas PNGs by bytes, §D.44).
- `parity/receipts/v1/census/design-to-code/flowbite/flowbite.badge/d2c.json`: a
  `span` root with `hover` / `active` states and no disabled state or prop — the
  guard's spelling only.
- `figma-sync/plugin/engine.receipt.json` re-recorded; `spec/lowering.json` +
  `spec/LOWERING.md` (64 rules; the three `css.*` rules the insertion displaced
  follow).
- Unchanged: `generated:fresh` (astryx, untitled-ui), every other `figma:fresh` row,
  frozen lineages, the fidelity lane, the drift pins, `evals/`.

**Measured live** (read-only REST, closure on, the product's own commands, the
unchanged 5 % limit). The four design-led sets are **unchanged to the byte**: every
generated file hashes as committed and every score and problem is identical (only
the consumer's npm lockfile hash differs), so their evidence folders are not
re-recorded. None of them carries a disabled state on a non-native root: Tabs'
`Tab Panel` draws `Default | Focus` only (the reviewer's A4 was a withheld probe
with `State=Disabled`), Tabs' `Button` is a native `button`, and Checkbox Group's
`State` axis is an enum prop (`default | disabled | error`, not an interaction axis),
so its `variant-prop-discarded:state` is the group not forwarding `state` to its
children — untouched by this rule. The sets §D.41 named with the dead plane,
re-measured before (the pre-change engine on the same dumps and proposals) and after
(`--reviewable-inversion`, as §D.41):

| set | disabled cells | `state-inert:disabled` before → after | disabled cells' difference before → after | problems |
|---|---|---|---|---|
| Altitude `Link` `3543:47075` (`a`) | 1 | 1 → **0** | 8.83 % → 7.99 % | 12 → 11 |
| Altitude `Toggle` `3543:48094` (`div`) | 2 | 2 → **0** | 56.52 / 44.02 % → 25.65 / 25.65 % | 15 → 13 |
| CBDS `Toggle` `272:730` (`div`, a part state) | 4 | 4 → **0** | 21.48 / 18.43 / 21.00 / 16.10 % → 19.07 / 17.43 / 18.92 / 12.90 % | 42 → 38 |

Every disabled cell is now reached through the prop AND paints differently; no
other row moved. None of the three passes: they still fail on other axes (hover not
carried, unfocusable roots, size, the rest images), as §D.41 recorded. No evidence
committed for them.

**Limits, named.**
- *Behaviour.* A `div` / `span` with `data-disabled` still takes focus if focusable
  and still fires its handlers: the generated component guards no handler. The
  disabled look now renders on an element that still acts; before, it neither looked
  nor acted disabled.
- *A disabled state with no `disabled` prop* (26 contracts) is reachable only by the
  consumer passing `data-disabled`.
- *The mirror image on native roots.* Web components and static HTML select a
  `disabled` `stylesWhen` (or a `{disabled}` placeholder's `false` side) on a NATIVE
  root as `[data-disabled]`, which those surfaces do not render there (they render
  `disabled`). Two tracked contracts (antd `Button`, both copies). Left: native roots
  stay byte-identical in this change.
- *The attribute name is the prop's.* Only a boolean prop named `disabled` renders
  `data-disabled`; a contract whose disabled boolean is named otherwise gets a state
  the prop never reaches (none in the corpus).

**Gates:** `core/react-disabled-state-selector.test.ts` (`npm run
react:conformance:check`): the selector table; a `div` root → `[data-disabled]` and
the TSX's `data-disabled`; a `button` root unchanged; `span` / `a` / `label` / `li` /
`section`; `elementByProp` on all three sheets; web components and static HTML, root
and part; React inline untouched; the reader's inverse; and **the paint MEASURED in
Chromium on a mounted `div`** (disabled background and part colour apply, hover no
longer overrides them; the `button` root behaves as before).
`extract/figma/state-axis.test.ts` (`npm run exact-proposal:check`): a designer's
`State` axis on a `div` emits `[data-disabled]` and guards on it. **To reverse:**
make `reactRootDisabledSelector`, `wcRootDisabledSelector` and
`htmlRootDisabledSelector` return `':disabled'`, delete `rootDisabledAsPseudo`, and
regenerate.

## D.46 Declared-family fidelity is additive; incomplete alignment stays visible

**AGENT decision (2026-09-19).** Record workspace-declared families in a new
`recipe/evidence/react-native-declared-family/` directory. The historical V1
fixture remains byte-identical. The recorder accepts explicit operation/read
event and sealed source references, verifies the complete journal chains and
correlation, and refuses a readback whose plan revision differs from the source
operation. Every native image and source observation must pair uniquely. It
records only after authentication; existing output directories refuse. The
shared source crop, native text geometry and typography routines are the same
ones used by the historical recorder. No component-name conversion rule is added.

The committed denominator is Switch 9, Alert 1 and Badge 1. The unchanged
historical 5% score passes Switch and Alert; Badge stays at 6.25%, with all 55
aligned differing pixels inside its text box (aligned 2.546296%, masked 0%).
The existing font-substrate classification names that residual; it does not
turn the historical score into a pass. Computed typography agrees, but the
source ownership archive did not record the actual Chromium font. All Switch
aligned scores refuse: six need fractional translation and three exports are
36×23 despite recorded render bounds spanning 36×24. No resampling or widened
tolerance is used. Low-contrast thumb placement still needs separate geometry
and live visual evidence. This lane qualifies evidence integrity, not V1.

**Reverse/reproduce.** Run `npm run react:native:declared:record` with the checked-in
specification, private archive and a NEW output directory; compare every image
and manifest byte. Run `npm run react:native:declared:check` offline. Remove the
Badge named residual to make its historical failure red again. Replace a pair
only with a new authenticated observation and reviewed denominator; never
rewrite the frozen historical lineage to fit a new measurement.


**Source-pairing guard (AGENT measurement decision, 2026-09-20).** The final
integration review planted two contradictory inputs: a contract anchored to a
different file with the same node id, and two dump sets claiming one anchor.
The consumer checker previously accepted the first and selected the first match
for the second. It now refuses conflicting captured file identities, duplicate
set anchors or names, and a named set that cannot verify the contract's node
anchor. A legacy input without anchors retains its unique name lookup; absent
file provenance is not invented. Four genuine captures retain all 96 variant
names and input combinations and agree on file/set identity. No image, scorer
or tolerance changed. Reversal: restore the first-match lookup in
`findDumpSet`; doing so restores the demonstrated source-pairing ambiguity.


## D.47 Re-imports keep the anchored Figma component identity

**AGENT decision (2026-09-19).** The live JSON import walkthrough loaded
Altitude Badge, then CBDS Badge with its two children. The second Badge
correctly received a collision suffix, but the workspace replaced the first
library's entry by display name. Repeating CBDS then silently changed its id
from `ds.badge-2` to `ds.badge`. A displayed single entry was not repeat safety.

Anchored Figma imports now refresh by file and node (set key when no node was
captured), across JSON and URL entry paths. Different files with the same label
coexist. Before allocating a name-derived id, the proposer reuses one uniquely
matching session contract's component key and compatible file, or its file/node
when the key was not captured. A conflicting file cannot borrow that identity;
ambiguous claims refuse. A valid canvas-stamped contract id retains precedence.
Unanchored entries keep the existing source/name rule. No source filename or
component name receives a special case.

The bounded probes reproduce the old failure and cover alternating imports,
removing the original collision, renaming the set, different input doors,
missing keys and conflicting file evidence. They qualify identity behavior,
not visual fidelity. Existing sessions cannot recover an entry already evicted
by the old rule; import that capture again. To reverse, restore the workspace's
source/name identity and remove the proposer's anchored-id reuse and file guard.


## D.48 Text visibility follows complete captured evidence

**AGENT decision (2026-09-19).** The proposer now applies the existing
hidden-pattern rule to TEXT parts present in every captured variant. A complete
pattern that matches a single enum value or a truthy boolean axis becomes the
existing `visibleWhen` predicate. A uniform explicit BOOLEAN visibility binding
uses the captured property default through the existing binding rule. No new
schema vocabulary or visual tolerance is introduced.

The concrete defect was Altitude Checkbox Group: its Label exists in all twelve
variants but is marked hidden in the six Legend=Hidden variants. The proposal
previously emitted it unconditionally because only shape parts consumed this
channel. A synthetic unrelated Notice set demonstrates the same shared rule in
actual generated React: its caption disappears and returns as the prop changes.

Partial presence can require a conjunction of conditions. That extra visibility
channel remains named and uncarried, preserving the existing presence result.
Inconsistent or partially missing property references are named rather than
choosing the first reference. Always-hidden helpers and uncorrelated or inverted
boolean patterns remain named limitations. The variant probe separately observes
descendant paint, text and geometry (D.41 follow-up); that measurement correction
does not establish that the component's size or visibility is correct.

Reversal: remove the TEXT visibility block in `buildPart` and its test entry.
The prior unconditional text behavior returns; shape visibility remains intact.
Keep the before/after consumer receipts as historical evidence. This rule is
engineering behavior, not V1 acceptance or an owner grade.


## D.49 Painted wrappers remain local to their drawn variants

**AGENT decision (2026-09-19).** Wrapper union may synthesize an unpainted
structural wrapper around matching flat children to preserve their identity.
It now excludes wrappers that carry fills, strokes, image fills, effects,
non-unit opacity or bound paint. Copying their channels into a variant that
never drew the wrapper fabricated paint. The wrapper and flat paths remain
separate; the existing presence projection gates them from the actual source
variant observations. Unpredictable presence still follows its existing named
limitations rather than implying full support.

Altitude Checkbox's focus-only wrapper exposed this defect: its blue focus ring
appeared in the generated Default variant. A separate Notice probe with one
caption directly in Plain and inside a painted Ring in Ring proves the generic
rule in generated React: exactly one caption remains visible, and the wrapper
exists only in Ring. Fill and opacity probes establish the same boundary; an
unpainted structural wrapper still folds. No new schema or tolerance is used.

Reversal: remove the painted-candidate guard from `foldWrapperUnion` and the
wrapper-paint probe. Preserve existing receipts; do not rewrite historical
results. This addresses fabricated wrapper paint only; fixed geometry capture
and other design-led content gaps remain separate.


## D.50 REST carries explicit fixed manual-box dimensions

**AGENT decision (2026-09-19).** REST dump grammar 1.37 fills a capture gap
using the existing `fixedSize` channel. Only in-flow children of an auto-layout
parent that are not themselves auto-layout, text, instances, roots or captured
shapes qualify. An axis must explicitly declare FIXED sizing; absent, HUG and
FILL dimensions are not inferred. A rotated box requires both axes fixed.
Finite nonnegative bounding-box dimensions are carried exactly, without rounding
or an epsilon that erases a small rotation. The existing proposer and token
lowering consume these facts; no component-specific behavior is added.

The live read-only REST response for Altitude Checkbox's manual indicator
explicitly declares FIXED on both axes and an 18 by 18 box. Previously REST
captured neither dimension, leaving a border-sized box in the generated React.
The plugin route captures the same class and now also writes grammar 1.37,
carrying fractions exactly and rejecting incomplete fixed axes at any nonzero
rotation. Old observations must not be treated as comparable 1.37 observations
without a fresh read. Fixed auto-layout child geometry remains its separately
named limitation; this rule does not admit arbitrary observed dimensions.

Reversal: remove the fixedSize mapping block and restore the REST capture-gap
note, then bump the grammar for that changed projection and re-observe affected
sync baselines. Preserve old dumps and consumer receipts. This is an engineering
capture rule, not an owner qualification or a widened fidelity tolerance.


## D.51 Comparable node alpha and contrasting-background measurement

**AGENT measurement decision (2026-09-19).** Clean-consumer captures now exclude
the review page background, matching Figma's node-export alpha. A screenshot-only
style makes html/body transparent and is restored immediately afterward. The
component's own backgrounds and geometry are untouched. Previously the opaque
white React page could never trim its transparent margins, while Figma did:
identical 148px layouts were reported as 148 versus 142 content pixels. A browser
probe checks transparent margins, restoration of the white review page and a
planted geometry change that remains detectable.

Both source and consumer are then compared on white **and black**, using the same
alignment, antialias-aware pixel metric and unchanged 5% limit on each. The
existing default white comparator is byte-identical; black is an additional
required check, never a replacement or an excuse. Masked text remains diagnostic.
A planted missing pale block passes the white comparison and fails on black.

This check found a real remaining defect in the app's CheckboxGroup archive:
white comparison passed12/12 at at most3.18%, but black comparison exceeded5%
in9/12. The split wrapper's default indicator lost its border-color and rendered
black. The archive remains unqualified. Old opaque captures and their receipts
are preserved as historical measurements; current acceptance must cite the
capture metadata and both background scores. The work does not change frozen
recipe receipts or OS-specific visual baselines.

Reversal: restore ordinary opaque screenshots and remove the additional black
comparison in `design-consumer-check.ts`; the original white-default scorer
remains available. Such a reversal restores the known measurement errors and
must not turn those historical results into acceptance evidence.


## D.52 Paint coverage on visibility-gated parts

**AGENT decision (2026-09-19).** A part's absent variants can close token
coverage only when the emitted part's own `visibleWhen` predicate excludes
those variants. The Figma proposer attaches complete canonical tuples after
building that predicate. Unconditional majority-presence fallbacks and unknown
or incomplete conditions supply no absence proof.

The token classifier admits single-axis or two-axis values only when every
drawn tuple is observed or proven absent. Partial tuples, contradictory absence
claims and missing visible observations retain the refusal. Fully measured pairs
still take precedence. Supplied leaves use the lowest declared observed tuple,
independent of source order, and receipts distinguish absent parts from variant
combinations the set never drew. No threshold, schema or component-specific
conversion rule changes.

The defect appeared in Altitude Checkbox: its flat indicator is absent in Focus,
where a separate focus wrapper contains the indicator. Requiring a border color
on the absent flat part discarded the measured Default/Disabled/Hover/Error
colors and React painted its default black border. A separate synthetic Signal
family proves the same rule through generated React, including four distinct
border colors across two axes. Adversarial probes remove visible observations,
truncate an absence tuple, omit a third-axis plane, contradict an absence and
reverse input order. A missing visible tuple initially passed and caused the
complete-account requirement above.

Reversal: remove the post-build absence annotation in `buildPart` and restore the
previous token coverage rule. Preserve before/after app archives and measurements.
This engineering rule alone does not establish visual acceptance of the family.

## D.53 Direct React forwardRef source declarations

**AGENT decision (2026-09-19).** The static reader recognizes an immutable
component export initialized by a direct imported React `forwardRef` call with
one inline function or arrow callback. Its complete export declaration remains
the source identity; public props come from the installed wrapper signature,
and root/children facts come from that callback. It records the wrapper by name.
The source is never executed by the reader. The existing renderer observer joins
the real exported object to its host; a Chromium probe verifies that the ref
reaches the host and caller content remains caller-owned without changing pixels.

Lookalike factories, computed factory accesses, mutable exports, indirect factory
or callback aliases, escaped namespaces and reassigned factories remain refused.
Type-only exports and interfaces are excluded from runtime component discovery;
unsupported value exports retain their named refusals. Existing ordinary
function declarations and arrows retain their original representation.

This reads installed Radix Button, BaseButton and Switch declarations, but does
not qualify their native conversion. Runtime JavaScript still needs an
authenticated relationship to its separately distributed TypeScript source;
BaseButton's transformed/conditional children and Switch's authored primitive
remain unresolved by the existing content rules. No runtime-module alias,
component-specific override, ownership relaxation or native write is introduced.

Reversal: remove the direct-wrapper reader and optional wrapper fact, restoring
`component-function-unresolved` for these declarations. The type-only filter can
be reverted separately, restoring the incorrect runtime-component refusals for
interfaces. Preserve the diagnostic and live journey evidence; these source
facts are not release acceptance.


## D.54 Workspace discovery follows configured paths

**AGENT decision (2026-09-19).** Lane discovery walks only paths that can still
match a configured workspace pattern. A single star matches one directory;
a double star explicitly permits recursion. Symbolic links, node_modules and
.git remain outside traversal, and parent-directory escapes are rejected.
Explicit workflow prefixes continue to load their own package manifest.

The integration lane previously recursed into an unrelated preserved consumer
review tree and failed four checks with ENAMETOOLONG. The configured packages/*
workspace never includes that evidence. Bounding discovery by the configuration
preserves every configured package and avoids reading unrelated content; it
adds no gate exclusion and changes no protected private artifact.

Reversal: restore recursive manifest discovery in lane-map.ts and filter its
results afterward. Preserve private evidence even if that traversal fails.


## D.55 Consumer images align by recorded layout origins

**AGENT measurement decision (2026-09-19).** The clean-consumer instrument
records the browser root's document bounds and PNG hash, plus Figma layout and
render bounds with PNG hashes. REST node snapshots bracket image retrieval and
must retain the same file version, modification time, node identity and node
contents. Missing or changed facts, unexpected image spans, non-unit scale and
fractional required translations refuse by name. A native render extending
beyond the browser's captured layout box remains unqualified.

After integer translation by those origins, both images use one common crop
covering every nonzero-alpha pixel on either side. There is no image search,
resampling, independent ink alignment or added transparent padding. Both
unmasked white and black comparisons must satisfy the unchanged 5% limit with
the existing pixelmatch threshold 0.1. Historical independent alpha-trim scores
and text-mask diagnostics remain in every receipt; frozen scorers and evidence
are unchanged.

Evidence: the app-delivered CheckboxGroup package remains byte-identical at
SHA256 d38a3829fc911ea8e26d1fba2ffbcb6ed6e66bc0e69e3ea323d3d72b02716ab1.
Its browser's first ink begins at y=3 and Figma's at y=4, although both recorded
layout origins are integral and matching checkbox geometry shares the same y.
Independent trims move that geometry. Fresh bracketing REST snapshots are
byte-identical. The common-crop measurement passes all 12 variants on both
backgrounds (maximum black 4.263799%), while the three historical shown-column
black scores remain 5.455–5.749%. The common crop, dimensions and translations
are recorded per case; no font substitution was used.

Adversarial controls keep a real one-pixel geometry shift over the limit, prove
transparent padding cannot dilute a score, preserve faint paint in the crop,
expose missing white paint on black, and reject stale hashes, changed file
versions, changed nodes, missing bounds, fractional origins and impossible PNG
spans. These controls establish the instrument, not complete V1 acceptance.

Reversal: remove the recorded-frame instrument and restore historical
independent-trim verdicts. Preserve both measurements and their immutable
receipts. Do not reclassify earlier frozen evidence using this decision.


## D.56 Native exports need an explicit raster coordinate model

**AGENT measurement decision (2026-09-19).** A controlled Scratch experiment
exported four identical editable 32 by 18.390625 frames at canvas phases 0,
0.25, 0.5 and 0.75. All eight scale-one PNGs (default export and explicit
useAbsoluteBounds) were byte-identical 32 by 19 images. Thus floor/ceil of
absolute canvas bounds does not describe these node-local exports. The probe
contains no shadows, text or rotation and does not establish those mappings
or the REST image route. Native structure and the unobstructed Desktop canvas
were inspected; no existing product node changed.

The declared Switch cohort's existing aligned refusals remain. Its browser
captures also have genuinely fractional layout origins, so correcting only the
native origin would not establish an integer alignment. New comparison work
must measure each producer's raster origin explicitly; it may not resample old
PNGs or search for a better alignment. The earlier images, scores and refusals
are retained. D.55's successful consumer comparisons use integral recorded
origins; this experiment does not replace their source evidence.

Reversal: retain the original absolute-span interpretation only if broader
controlled exports establish it for the actual capture route. Preserve the
probe and require matching capture-phase evidence before qualification.


## D.57 Non-layout stroke compositing still has a measured residual

**AGENT engineering decision (2026-09-19).** The CBDS Badge consumer remains
66/72 under both unmasked comparison backgrounds. Six small rounded outline
variants exceed 5% on black. The inset-shadow spelling preserves layout but
composites stroke and fill edges differently from native Figma. A controlled
browser-only substitution of a real border, subtracting its width from all
four paddings, preserved root and label geometry exactly for all 72 cases and
measured all 72 below 5% (maximum black 4.427083%). That diagnostic is not the
delivered component and does not qualify the product.

Do not replace the shared stroke rule with that substitution without proving
the general behavior: padding smaller than a stroke, caller width overrides,
token changes and code-to-contract recovery can invalidate the compensation.
An isolated pseudo-element paint layer also improved the worst measured case
without changing its geometry, but introduces containing-block and stacking
semantics that likewise need independent qualification. An additional inset
fill layer did not change the residual; clipping the root did not pass both
backgrounds. These experiments justify continued implementation work, not a
tolerance change or a component-specific exception.

A later closed-text-only probe did not establish a safe pseudo-element rule.
Adding `position: relative` activated a caller's previously inert `left: 8px`
and `top: 3px`, moving both the root and its text. A caller's explicit
`position: static` instead left the 180 × 100 ancestor as the stroke's
containing block, although the component remained about 76 × 20. Limiting
the content tree to text does not solve these override semantics. No lowering
was adopted; evidence: `private/closed-stroke-boundary-18t8o8z2/`.

Reversal: replace the inset stroke only with a shared lowering whose layout,
paint, caller overrides and reverse extraction are demonstrated by adversarial
cases and a fresh app-delivered consumer. Keep the diagnostic and original
archive measurements separate.


## D.58 Visually identical source variants cannot prove a prop was discarded

**AGENT measurement decision (2026-09-19).** The clean-consumer check still
switches every variant-bearing cell and records every changed subtree. An
unchanged cell is no longer called a discarded prop when exactly one source
counterpart holds all other props and the interaction fixed, both distinct
native nodes have identical PNG bytes, their recorded layout sizes and relative
render bounds match exactly, and both PNG hashes match the authenticated frame
records. File-version and node snapshots must remain unchanged across export.

The receipt names these source-equivalent transitions separately. They prove
only that unchanged paint is expected; they do not prove that the component
consumed the prop or implements interaction semantics. Missing or ambiguous
counterparts, missing frames, stale hashes, different dimensions or offsets,
invalid images, and even a one-pixel low-alpha source difference preserve the
discarded-prop failure. No tolerant image score participates in equivalence.

Evidence: all six standalone Checkbox Hover/Default source pairs are
byte-identical. The unchanged app-delivered archive (SHA256
88ad4959448f4d41d71d16e562d5d9b04953d4f914f5e9af8f14d00fbc5a7cfc)
changes all 14 remaining state transitions and retains all six equivalent ones.
Its fresh consumer remains unqualified: 13 hidden-label comparisons refuse the
native export-span assumption and 13 shown-label comparisons exceed 5% on black.
The older seven passing historical comparisons remain in their receipt.

Reversal: remove the exact-equivalence adjudication, restoring the unconditional
change assertion and its known false positives. Preserve original receipts,
source PNGs and all failing visual comparisons.


## D.59 Explicit full-bounds REST exports carry a local raster origin

**AGENT measurement decision (2026-09-19).** New consumer comparisons request
scale-one PNGs with contents_only=true and use_absolute_bounds=true. The
[Figma endpoint documentation](https://developers.figma.com/docs/rest-api/file-endpoints/)
defines the latter as retaining the node's full dimensions, including empty
space. The receipt records those settings and a versioned raster model. Its
native layout origin is (0,0), with PNG dimensions ceil(width) by ceil(height).
This is an explicit producer contract, never inferred from a convenient image
size. Earlier receipts without the model retain their original interpretation.

The Scratch control in D.56 was repeated through REST: all eight PNGs across
four canvas phases and two bounds settings were byte-identical within that
route, with unchanged before/after node snapshots. REST and plugin pixels
differ, so their bytes remain separate evidence. Both routes demonstrated
phase invariance for the controlled frame; neither result licenses resampling.

Adversarial controls preserve a real one-pixel content shift despite empty
layout space and reject fractional browser origins, unexpected pixel spans,
unknown raster models and native render bounds extending outside the captured
layout. The common nonzero-alpha crop and both unmasked 5% comparisons stay
unchanged. No image search, translation selected by score, or threshold change
is introduced.

Fresh app-archive consumers retain Altitude Badge 10/10, CBDS Badge 66/72 and
Checkbox Group 12/12. Standalone Checkbox now measures all 26 cases without a
framing refusal; 7/26 pass both backgrounds. Its glyph and rendering failures
remain visible. Every archive hash matches the earlier app delivery.

Reversal: remove the explicit export request and raster model together, keeping
the old absolute-span refusals. Preserve both sets of receipts and their source
images; do not reinterpret historical PNGs as explicit full-bounds exports.


## D.60 Closed filled paths retain variant geometry; qualification remains pending

**AGENT decision, 2026-09-19.** The standalone designer Checkbox loses its
check and minus glyphs because arbitrary VECTOR geometry had no carrier.
REST GET with `geometry=paths` established that these are single-solid filled
paths, with no stroke or effect. Dump v1.38 captures that bounded class through
both REST and the plugin. It preserves path bytes, winding rule, intrinsic
size and unrotated relative-transform placement; unsupported syntax, missing
geometry, multiple fills, effects, strokes and non-identity transform axes
keep the vector-geometry refusal.

The additive `shape.kind: path` grammar carries one compound closed absolute M/L/C/Q/Z
path and NONZERO/EVENODD winding rules. A complete enum-conditioned geometry
map keeps differing glyphs and dimensions explicit. Code surfaces share an
encoded SVG mask with the existing fill/opacity channels. Native output uses
editable VECTOR nodes and refuses an unexpected intrinsic size before any
resize; it does not approximate curves. Input length, command count and
coordinates are bounded. XML, relative commands, arcs and open contours are
refused. A geometry map cannot silently freeze an observed differing path.
Unobserved values receive a base geometry only when an exact ancestor presence
gate makes that value unreachable; the proposal names this non-rendered
completion. Responsive SCALE constraints are not established by this work.

Nested presence is evaluated within the domain of an exactly gated parent.
Previously a child present in four of its parent's six variants was counted
against all twenty-six variants, including twenty where that parent did not
exist. An unconditional approximation cannot narrow this domain. This is a
structural rule, with no component-name branch. Fractional path placement is
carried without the older parametric-shape two-decimal rounding.

Synthetic tests exercise malformed paths, incomplete maps, both React surfaces,
evenodd paths and nested presence. In authorized Scratch, native VECTOR nodes
323:4368 and 323:4370 preserve the source dimensions exactly; the bridge was
closed and the live canvas inspected. Figma normalizes path serialization on
readback, so byte-identical path round-trip is not claimed. Evidence:
`private/filled-path-native-probe-2026-09-19-2056/`. This probe is engineering
evidence; full application delivery and family fidelity remain unqualified.

The consumer observer now includes masks and clip paths: a same-size path-only
change must be observable. A browser control proves changed pixels at unchanged
bounds. The image scorer, raster framing and 5% threshold are unchanged.

**Reversal:** remove the path shape fields, both capture branches, shared mask
lowering, native VECTOR branch and path-specific tests; restore dump v1.37.
Reverse the parent-domain presence rule separately if needed, retaining the
omission as a named limitation. Preserve all historical source and consumer
receipts. The additive source-citation writer (`lowering:check -- --rederive`)
updates only source locations/text after auditing the result; it refuses
removed or ambiguous sites and does not alter registered decisions.


The first clean-consumer diagnostic retained only 6/26 passing variants:
the captured glyph was shifted exactly 2px right and down by a CSS border.
A free Figma FRAME/COMPONENT has no auto-layout stroke inset, so dump v1.38
now records its effective `strokesIncludedInLayout: false` too (REST omits
the default NONE layout mode). The existing ring lowering preserves its child
origin. This is an extension of §D.39, not a padding rewrite. With that rule,
a second diagnostic passes **13/26**, including every label-hidden variant;
all thirteen label-shown variants still exceed the black-background limit.
Both receipts remain in `private/filled-path-consumer-diagnostic-2026-09-19-*`.
These were direct engine diagnostics, not yet the application delivery journey.
To reverse this extension separately, remove the non-auto-layout branches in
both readers and restore their earlier regression expectations; the two-pixel
child displacement becomes a named limitation again.

The actual generated writer also created a two-variant synthetic set in Scratch
(page 323:4371, section 323:4372, set 323:4377, editable vectors 323:4374 and
323:4376). Both native leaves read back at exactly 12×10, including an EVENODD
cutout. Repeating the same script returned unchanged with no new node IDs;
the unobstructed canvas was inspected. Evidence:
`private/filled-path-generated-native-2026-09-19-YSOMnY/`.

Adversarial review found that parent scoping initially removed redundant global
child gates from a frozen historical contract. Global gates that already explain
presence now retain precedence; the parent domain is used only when it expands
expressibility. This preserves the historical contract bytes without rewriting
the frozen receipt. Bounded controls also refuse a partial geometry capture and
two-axis XOR geometry, and prevent an unconditional majority parent from narrowing
the child domain. The native runtime size guard accepts exact/float32 dimensions
and refuses mismatches without resizing.

A diagnostic on the unchanged labeled consumer localized its 8.515% black score
to the text box: masking that box leaves 0.309%. Explicit installed Regular font
bytes leave the score unchanged; antialiased smoothing still exceeds 5% (5.692%).
Neither is an adopted override. This isolates the remaining rendering gap but
does not excuse it or establish the source font bytes. Evidence:
`private/filled-path-label-raster-probe-2026-09-19-8CPGmR/`.

The subsequent application journey imported a fresh v1.38 REST capture, prepared
the React library, and installed the exact downloaded archive in a clean consumer
(SHA256 `826073b06963e22fe255ad042255d3c3cbb2d080e7e73569133ed7e34c8d0595`).
It reproduces **13/26** passing variants: all label-hidden variants pass, while
all thirteen labeled variants fail on black at 5.503–8.561%; every white comparison
and framing check passes. Repeat import preserves identical contract bytes and
the same seven workspace entries. Text and declared prop changes were observed;
form interaction and accessibility are not qualified by those observations.
The installed consumer and source/before/after comparison were inspected visibly.
An initial stale-server schema refusal required restarting the sole Vite server;
that refusal remains in the evidence. The application journey is preserved in
`private/design-led-app-2026-09-19-D75s7P2Q/checkbox-filled-path-app.AH5c7m/`.
No threshold, scorer, source-image bytes or font smoothing override was changed.

Sync REST observations also request <code>geometry=paths</code>; otherwise a
path-only edit with unchanged dimensions and canvas stamp would be invisible to
the observed dump fingerprint. A bounded transport probe demonstrates this
failure without the query and detection with it. Live REST GET re-observation
refreshes 25 baselines to grammar 1.38, preserving all 128 record identities,
53 historical adoptions and six unresolved pending dispositions. The four-row
synthetic drift fixture retains its intentional mismatches. Migration inputs,
prior ledgers and CLI logs are retained in `private/filled-path-sync-138-4chmmd31/`.
Reversal must restore the prior observation grammar and baseline records together;
never compare fingerprints across grammar versions or relabel unresolved drift
as a successful reconciliation.


## D.61 Used CSS sizes retain their exact browser layout units

**AGENT decision, 2026-09-19.** Component-owned fixed width and height in an
observed React initial-state or owned-child draft now recover the exact browser
layout unit before token minting. Chromium serializes the 1177/64 px layout size
as `18.3906px`; writing that rounded string back into CSS produces `18.375px`.
The native value previously carried that serialization as a float32 number.
The draft now emits `18.390625px` and native 18.390625 for that observation.

This is exact reconstruction, not a numeric tolerance. The reader accepts only a
unique 1/64 px value with the observed six-significant-digit serialization; it
refuses ambiguous large values and strings that cannot establish such a unit.
Only sizes already proved component-owned and fixed are eligible. Sampled,
content-derived and unproved descendant sizes keep their existing boundaries.
The compiler works on copies; sealed captures and source-variable observations
retain their original bytes. Each recovered size receives a named receipt.

Focused tests cover native values, emitted browser dimensions, descendants,
ambiguous inputs and immutable observations. Recompiling the authenticated
nine-state independent Switch archive produces exact 32 by 18.390625 native
plans. A fresh observation of the declared checked case completed creation
through the application and companion in Evaluations (`7f0b10e4…`): all nine
editable mains read back at those exact dimensions. Repeating inspection
returned the identical 29-node, nine-image result without another creation.
The plugin was closed and the native canvas inspected. This establishes size
delivery; the separate guarded visual measurement and its remaining limits
are recorded in D.62. Evidence is retained in
`private/native-matched-capture-2026-09-19-uOSM5Q/`.

The older unchecked operation cannot yet receive this correction in place:
its height variable is bound, and update review refuses
`native-update-bound-token-change-unsupported`. Re-observation retained its
existing operation and the duplicate-preparation guard. Fresh creation of a
different already-declared case does not close that update gap.

Reverse by removing `exactUsedLayoutLength` and the owned-size copy adapter in
`compileObservedContentSweep`; retain archived receipts and restore the named
CSSOM replay defect. No pixel threshold or scorer is changed.

## D.62 Guarded matched frames preserve source phase and original evidence

**AGENT measurement decision, 2026-09-19.** A supplemental capture instrument
now measures a fresh app-created initial-state set without reusing the old
exports' ambiguous raster origins. `captureTransparentSourceFrame` first
authenticates the full original PNG. It refuses ancestor opacity, transforms,
clipping and paint, and component or ancestor blend, filter, backdrop and mask
dependencies. Only the plain html/body backgrounds are made transparent.
External siblings are hidden only when the entire component crop remains
byte-identical; overlapping paint refuses. Component geometry, markup and
computed styles, including pseudo-elements, must remain exact. Two captures
must match, paint must fit strictly inside the crop, and the original render
must return byte-exactly after restoring the capture context.

Native components are copied into persistent transparent frames at the
source-derived fractional offsets. The original and clone snapshots, bindings,
resolved modes and root dimensions match exactly; native render bounds stay
inside integer-origin frames. Exports explicitly use scale one, absolute
bounds and contents only. Current original readback matches the authenticated
operation both before and after capture. These are Plugin API frame exports;
no REST raster model is attributed to them.

The new `recipe/evidence/react-native-matched-capture/` records all nine states
of operation `7f0b10e4…`: maximum white mismatch 4.167%, black 2.399%, all below
the unchanged 5% limit. `npm run react:native:declared:check` recomputes the new
measurements alongside the unchanged historical family evidence. The new
recorder authenticates the complete operation chain, source inventory and
state-to-native pairing without inventing origins for the earlier unframed
PNGs. It only writes a new output directory. Instrument and image hashes are
pinned; changed geometry, coverage, bytes, capture spans or sibling contribution
refuse. A one-pixel movement can pass the existing pixel score, so exact root
geometry remains an independent gate. This does not establish pixel identity:
transparent compositing can differ from direct opaque rasterization by one
channel value.

The application’s **Review recorded matched frames** reauthenticates the
operation and source pin, recomputes the scores, and shows both backgrounds at
original image size. The nine-row view was inspected live. It describes a
recorded baseline and performs no Figma write or current canvas inspection.
Frame preparation remains operator-run. Runtime behavior, the rest of the
independent family, and bound height-variable updates remain unqualified.
Live evidence is in `private/native-matched-capture-2026-09-19-uOSM5Q/`.

**Caller-content extension, same AGENT decision.** The recorded app review also
supports an authenticated comparison operation and its neutral presentation
frame. It joins the sealed source PNG and ownership pin to the operation's
readback and checks the image-to-node pairing. The wrapper must contain exactly
one unchanged instance at the same origin and size, with no paint, clipping,
padding, extra children, transform or variable-mode change. The existing
slot-identity resolver handles Figma's settled descendant IDs; metadata,
topology, properties and images remain exact. Text properties and instance
properties are included in clone validation.

The composed Alert (`59f1c1b7…`) measured **3.064% on white / 3.100% on black**,
360 × 68 on both sides. New evidence lives in
`recipe/evidence/react-native-matched-content/`; the app's one-pair review was
inspected live. Its first clone check refused while Figma settled layout.
No recapture allocation was made: a later read-only check found identical
snapshots, and two exports matched exactly. Original readback was unchanged
before and after. The preserved private evidence is
`private/native-family-remaining-2026-09-19-owpib5w3/`.

The same source instrument recorded the current Badge and its actual painted
Inter font. Its 43.875 px source width disagrees exactly with the historical
44 px native width; that old operation also belongs to an earlier source
reference. Neither a passing pixel score nor identical PNG bytes authorize
borrowing a new source pin or rounding the width. This remains unqualified.
The review's date names when the baseline operation was observed, not when
its later supplemental frame was captured.

Reverse by removing the supplemental capture instrument, its application
review and its added check invocation; retain the new and historical evidence
and restore the named measurement gap. The existing scorer, tolerance and
historical refusal receipts are unchanged.


## D.63 Native auto-width text and fractional source width

**AGENT decision, 2026-09-19: preserve editable auto-width behavior and keep the
exact-dimension refusal.** The retained Badge comparison has a 26px native text
box and a 44px root, while the current React source root is 43.875px. An isolated
clone in Evaluations tested a fixed 25.875px text box, preserving font, size,
line height, paint, spacing and bindings. Its root became exactly 43.875px, but
its rendered label clipped from “New” to “Ne”. A longer text edit kept the same
root width and clipped too. Restoring native auto-width restored the complete
label and 44px root. Matching the observed dimensions by fixing this text box
would therefore lose both content and its intrinsic resizing behavior.

A separate source-font probe on 2026-09-20 used a uniquely named local font
whose glyph, metric, shaping and variation tables match the pinned source
WOFF2; only naming and the font checksum changed. Chromium rendered the
original and renamed fonts identically. In Figma, both the existing Inter
face and the source-table copy still gave “New” a 26px auto-width box, against
25.875px in Chromium. For “New message”, the source-table copy measured 82px
in Figma and 81px in Chromium. Matching font tables alone therefore does not
establish exact native text layout. Only a new diagnostic page in Evaluations
was written; the original font, source and native operations were unchanged.
No font mapping or converter rule was adopted. The font manifest, native IDs,
matched frame exports and unobstructed canvas are retained in
`private/source-font-probe-msuhjmza/`. Direct text exports cropped to ink were
excluded from cross-surface pixel comparison; identical 100 × 32 frame crops
replaced that diagnostic measurement.

No converter rule or tolerance changed. The original component, variables and
operation journal were untouched; the clone was restored, its native structure
recorded and the unobstructed canvas inspected. Private evidence:
`badge-text-width-probe-kap69tf2/` (script, four snapshots/exports and canvas
screenshot). This diagnostic uses the retained older-reference comparison;
it does not authenticate a new comparison against the current React reference.
The Badge remains unqualified. To revisit the decision, demonstrate a general
native text rule that preserves the complete label, exact source dimensions and
subsequent text edits, then remeasure through a current authenticated operation.


## D.64 A later parent read must not strand a verified correction

**AGENT decision, 2026-09-19: recover the correction's pinned parent observation
from its validated journal, then require a fresh contextual read before reuse.**
Earlier versions allowed reading an operation's creation plan after a correction
had changed its native nodes. That read correctly disagreed with the old plan,
but also replaced the journal fingerprint used to authenticate the correction.
The retained Button family was stranded despite its intact correction records.

Only written correction history may select a saved parent fingerprint. The
reader validates the complete current journal and then retrieves the matching
prefix; the original input and receipt must pass their normal checks. A missing
pin, unfinished read, malformed chain or suffix containing anything beyond
component readbacks and their results/abandonments refuses. Unapplied proposals
still authenticate against the latest parent. Current source, desired
compilation, correction predecessors and write preflight remain independently
checked. No historical file is rewritten.

Recovering a prefix alone is insufficient: a later parent read may reveal real
canvas changes. Before a corrected component can be reused, a new independent
update read must match the verified correction and record the current parent
journal revision in its host-owned dispatch. Another parent change during or
after that read invalidates reuse. A differing native value refuses normally.
Old readbacks remain historical until refreshed. The application uses its
existing **Inspect update again** action; this never repeats the write.

The real Button parent `e9bd4394…` has twelve events. Its first ten reproduce
the correction's exact saved fingerprint; the last two are a later read and
result. A read-only host probe recovered input and baseline receipt byte-exactly,
without changing any parent file, and authenticated the unchanged shadcn source
`0907e10c…`. Adversarial probes cover corrupted headers and later events,
unavailable pins, pending reads, source drift, stale unapplied plans, changed
native values and a parent changing while readback is in flight. Private
evidence: `native-parent-baseline-recovery-tsv6lvyo/`.

Reverse by removing historical parent selection and the contextual read marker
from update planning and reuse authentication. Keep all journal events and
restore the named recovery gap. Do not delete later observations or replace the
original correction baseline.

Live application verification used **Inspect update again** on correction
`c620c0e9…` in Evaluations. Its contextual read returned **191 nodes and 63
images**, matching all previous node values, token data and PNG bytes. The
new image records add export bounds. The current source and correction
authenticate again. The update still has one write dispatch; recovery appended
only two read/result pairs. The parent remains twelve unchanged events.
The companion was reconnected after the development server reloaded, and the
source page's expensive refresh delayed requests; both interventions are
recorded. The plugin was closed and the existing 63-component set inspected
on the live canvas. This restores the correction chain's supported read/reuse
path, not the family's still-missing image and interaction qualification.


## D.65 Native review reuses evidence only within one response

**AGENT decision, 2026-09-19: combine the moved/current operation display scopes
and reuse their checked proposal lists and source-content records.** CPU
profiling found repeated journal verification, canonical hashing and sealed
content reads in a native listing. A synchronous display may share isolated
copies of those results until it returns. Nothing is retained for a subsequent
request; prepare, dispatch, acknowledgement and redelivery refuse within that
scope and independently authenticate outside it. No verification, source file,
journal entry or operation is omitted.

With filesystem writes denied, the same retained shadcn listing returned
424,024 identical bytes before and after: 32.7 seconds initially, 22.7 after
combining scopes, and 17.4 after reusing proposal/content reads. The independent
family returned the same 80,333 bytes in 7.8 versus 7.0 seconds. These single
local measurements include the existing private history and are not a latency
guarantee. The server remains synchronous and can delay companion requests.
The app's existing Alert review was reopened and visually inspected after the
change; its historical scores and qualifications are unchanged. Private evidence:
`source-review-read-cost-3c5oumcb/` (write-denying harness, CPU profiles, response
hashes and app screenshot).

Adversarial checks mutate caller copies, source files and proposal records,
verify refusal after the response ends, and reject mutation inside either
snapshot scope. Reverse by separating the two route scopes and removing the
proposal-list/source-content wrappers; retain the freshness and write guards.

**AGENT refinement, 2026-09-20:** the same display scope now also retains a
plain `Error` refusal from a checked read. Historical operations otherwise
repeat the same unsuccessful source authentication within one response. Each
caller receives an isolated error; custom exception fields, subclasses,
causes and uncloneable values are not reused. Both evidence and journal scopes
discard successful and failed reads on return or error. Write authorization
still runs outside either scope and reads fresh evidence.

The later independent-family history returned the same 112,792 bytes in two
uncontended probes: 11.59/11.55 seconds before and 9.71/9.84 after. Initial
requests overlapping source reload or tests are retained separately, not
included in that comparison. This remains a synchronous request, not a latency
guarantee or a new companion-recovery result. Evidence:
`review-failure-reuse-c8g88f1b/`. Reversal: stop retaining failed reads in the
shared snapshot helper; keep successful-value isolation and all write guards.


## D.66 Returning native fixed controls preserves dimensions and independent axes

**AGENT decision, 2026-09-19:** preserve an existing singleton token map when
expanding an omitted-prop token placeholder, and preserve a bound root width
when every observed plane is FIXED and non-FILL. A separate maxWidth binding
remains a separate maximum. Horizontal, vertical, grid and non-auto-layout
frames use their own width axis. HUG, FILL, mixed or unknown sizing retains the
historical max-width mapping with a review note; this change does not qualify
those cases.

**AGENT correction, 2026-09-20:** the fixed-width rule also requires a finite,
positive measured width on every plane. A legacy capture with no bounding box
does not establish that evidence. The reference-site replay exposed the missing
guard as two Card width/max-width disagreements; the same failure reproduced on
the unchanged preceding commit. Requiring the measurement restores all three
legacy round-trip rows without rewriting their receipts and leaves the measured
fixed-control rule intact. Missing, zero, negative and nonfinite widths retain
the review path. Reverse by removing this measurement guard and its negative
cases; the legacy replay will report the disagreement again.

The app-created independent Switch exposed both general defects on return.
Its bound on-state paint disappeared when disabled opacity expanded into a
second map. Its fixed 32px width became max-width, shrinking the installed
consumer to 18px. The same unchanged plugin dump, reimported through the app
and prepared as a fresh React archive, now mounts all nine planes at exactly
32 × 18.390625 and carries both state maps. Two three-cell variant probes
change actual paint/geometry. The package is installed in an isolated consumer;
no component style is overridden. Native nodes and variables are unchanged.

The clean-consumer case reader now mounts an explicitly declared omission
plane with an absent prop, rather than reporting it as unmapped. A label alone
does not declare omission. The image verdict remains refused on all nine rows:
the native shadow extends outside the current layout-only consumer capture.
No scorer or 5% threshold changed. The generated button also has no switch role
or recovered click behavior, so this is not a qualified stateful return journey.
The REST capture cannot recover the bound thumb dimensions with the existing
token scope; the plugin capture retains eleven resolved variables. Capture
execution and file upload remain manual engineering steps.

A separate matched-frame consumer check includes the shadows: **9/9** corrected
rows pass the unchanged 5% image limit (maximum **4.167% white / 2.273% black**),
versus **0/9** before the fixes (maximum 42.929%). Actual app archives are
installed in separate clean consumers. Host frames retain the previously
recorded native root phase; repeat full-page screenshots are identical and no
consumer paint lies outside each frame. A fresh native read proves original
mains, capture clones, frame bounds and PNGs identical to the earlier record.
The live review and installed consumer were both inspected.

This does not establish exact descendant geometry: native thumb y is
1.1953125, while the returned browser thumb is 1.1875. The invisible root-after
rectangle also differs in offset and rounded height. These are named geometry
gaps; passing images does not excuse them. Root size and phase alone match
exactly. Captures and comparison remain operator-run, and stateful semantics
remain unqualified.

Adversarial checks cover singleton/array collisions, shared and independent
axes, nested parts, reversed native row order, two omitted boolean axes,
separate maximums and FILL/HUG/mixed/unknown nonpromotion. Evidence:
`independent-native-return-qz7pgw9f/` (unchanged native captures, original/fixed
app contracts, exact archives, clean-consumer receipts and closed-plugin canvas).
Reverse by restoring the previous map expansion, bound-width translation and
consumer omission handling; retain these records and name the restored losses.


## D.67 Callback inspection retains restored candidate refusals

**AGENT decision, 2026-09-19:** a type-compatible input that removes the
selected root or prevents keyboard focus no longer stops every later input
from being inspected. The probe registry must be present and empty, and the
host must independently verify original source, render and ownership before
continuing. A failed restoration, changed role or identity, unsupported state
or instrument failure still stops the sweep. Both activation paths must finish
before a value contributes relationship rows.

This is diagnostic continuation, not behavior qualification. Every recovered
refusal remains in the overall problems list and has its callback, input,
value and reason displayed in the app. The contract projector still rejects
an incomplete observation. No input is excluded by its name.

The independent Switch app rerun retained **42 activation trials** across
twelve compatible properties, versus two trials before this change. It
observed `checked` as controlled and `defaultChecked` as initial-only.
`asChild=true` removed the root; `hidden=true` and `inert=true` prevented
keyboard focus. All three remain refusals. Every one of 68 independent
restoration checks matched the original same-mount image, and source and
ownership were restored. The report was inspected in the application.

The complete behavior inspection remains failed. Generating and installing
the behavior, qualifying its appearance and label composition, and preserving
it through native metadata remain unfinished. Private evidence:
`callback-candidate-isolation-nmtqn4yw/` (sealed report identity, summary and
visible app result). Bounded probes cover disappearance during live and fresh
mounts, inert focus, failed restoration, role changes and incomplete projection.
Reverse by restoring the whole-sweep abort and removing the refusal display;
keep these records and report the lost observation coverage.


## D.68 A separate check observes simultaneous state inputs

**AGENT decision — bounded source observation, not full API qualification.** A
restored callback sweep can identify one controlled input and one initial-only
input even when an inherited input cannot be rendered or focused. The broad
sweep stays failed. Its identified relationships only propose another,
independently recorded experiment; a refusal involving a selected input,
identity, instrumentation or restoration cannot authorize that experiment.

The application now offers **Verify state inputs together**. For the observed
Boolean state pair and, when present, one behaviorally observed disabled input,
it tests every combination of omitted, false and true. Other compatible inputs
are explicitly listed and held omitted. Each combination exercises a live
input update, fresh-mount precedence, two keyboard activations and two actual
associated-label activations. Callback arguments, controlled-state retention,
uncontrolled transitions and disabled suppression must agree. Every probe
requires exact original tree, ownership and screenshot restoration on the same
mount before replaying and verifying the unchanged original again.

The independent Switch app run completed **54 activation trials and 81 exact
restoration checks** across 27 combinations. Its nine excluded inputs are
listed in the UI; the earlier three refusals remain visible. Repeating the app
action returned the same sealed record and left one job directory. Evidence:
private `callback-candidate-isolation-nmtqn4yw/`, including the first/repeat
record hashes and `state-api-app-complete.png`. This qualifies the recorded
source-input experiment only. Generated behavior, all excluded inputs, native
behavior metadata, interruption recovery and the stateful round trip remain
unqualified.

Each request pins the source archive, both input records, the derived matrix
and observer files. Reopening authenticates all files, live source, complete
transition semantics and restoration counts. Tampering, duplicate trials,
altered callback history, changed source and caller-supplied request bodies
refuse. Earlier records are immutable. Reverse by removing this separate
inspection action and store; retain its saved evidence and the original broad
callback refusals. Do not relabel those earlier observations as successful.


## D.69 Observed Boolean state inputs project into the existing toggle model

**AGENT decision — preserve typed inputs and predicates.** The separate,
authenticated simultaneous-input experiment in D.68 can supply a generated
state draft. It must match its authenticated appearance record, source instance,
complete transition matrix and restoration count. This does not promote the
failed broad callback sweep or admit its excluded inputs.

The appearance's Boolean initializer becomes an enum with canonical `false` and
`true` options mapped to actual Boolean code values. The observed controlled
and initial-only public names remain distinct. Boolean visibility and style
conditions become explicit `equals: "true"` membership, so the string `false`
cannot become truthy. An observed disabled input uses the model's canonical
`disabled` semantic while retaining its source public name and appearance
references. Existing role/attribute conflicts, unsupported composition, missing
input evidence and corrupted transitions refuse. No schema or emitter rule is
changed by this projection.

The app's **Try the generated state control** embeds only emitted React and a
normal consumer. Controlled, initial and disabled values can each be omitted,
false or true. In the independent Switch app run, all **54 input/action trials**
matched the recorded source states and callback values. Additional live actions
confirmed that changing an initializer leaves mounted state unchanged, an
uncontrolled control toggles, a caller can hold its value while receiving the
next value, and a caller can accept that callback as a new controlled value.
The current source experiment completed 81 exact restorations; repeating it
reused one sealed record. Private `callback-candidate-isolation-nmtqn4yw/`
contains the immutable input, live trial rows, additional actions, repeat hashes
and inspected `state-api-generated-live.png`.

This is **embedded generated-consumer behavior evidence**. It is not an isolated
package-install result or a visual qualification. The consumer supplies its own
label; source fonts, excluded inputs and native behavior remain unqualified.
The earlier private native compile dropped the initializer binding and retained
the callback toggle only as a code-only fact. D.70 adds a bounded metadata return,
but the live stateful native journey remains an explicit product gap. Reverse by removing this projector and preview; retain
the source experiment and all earlier broad refusals.

## D.70 Retained state inputs survive a bounded native metadata return

**AGENT decision — version the existing typed-axis envelope.** Checked controls
with one typed controlled/initial input, one root next-value callback and an
optional Boolean disabled variant retain those declarations inside version 2
of `codeValueAxes`. The reader checks the non-executable contract fragment,
semantic stamp, typed values, native property definitions and every Cartesian
variant before restoring the initializer and callback. This is retained API
metadata; drawn variants do not establish native interaction behavior.

Malformed metadata, a changed or missing state, conflicting native semantics,
unsupported composition and disagreement between the typed-axis and state
fragments refuse. A writer with this metadata refuses any in-place removal or
reinterpretation before touching the target. A matching version 1 typed axis
can acquire the declaration. Older writers already refuse unknown versions, so
they cannot silently erase the retained behavior. Use a fresh lineage for an
intentional API change until an explicit migration exists.

`core/figma-state-api.test.ts` executes the shared writer and dump in the Figma
mock, returns a contract, then executes emitted React in a separate browser.
It covers all 27 Boolean input combinations, initializer changes, callback
values, checkbox indeterminate state, repeat identity and bounded corruption
and retirement probes. The independent nine-variant source draft also returns
its actual public API through that mock. All 54 existing repository component
scripts are byte-identical in a before/after engine comparison; the committed
Figma and Storybook freshness checks pass. Detailed records are under private
`callback-candidate-isolation-nmtqn4yw/`.

The engine proof alone does not qualify a live journey. D.71 records the later
app creation and installed native return; the earlier appearance-only operation
remains unchanged. Reverse by removing the version 2 producer and reader
integration; retain the prior metadata refusal so existing version 2 targets
stay protected.

**AGENT compatibility decision — 2026-09-20.** Retained API eligibility must
not block an existing native appearance projection. A control with additional
text/identity inputs, a non-variant disabled input, or a callback without a
declared next-value argument keeps version 1 typed-axis metadata. That metadata
does not claim to return its initializer or callback. The full conformance lane
exposed this boundary in an existing composed-control initializer case; its
nine caller variants now compile again, and the broader-controls regression
check repeats native generation without replacing identities. The strict
version 2 reader still rejects an unsupported fragment, and changing an existing
version 2 target to either broader form refuses before mutation. Reverse this
eligibility guard only with support for the additional semantics, or an explicit
decision to retire the older native appearance path.


## D.71 A separate app operation preserves the observed state API through native return

**AGENT decision — authenticate a separate state experiment.** The app's
**Prepare … state API for Figma** action combines the current sealed state
experiment with its separately authenticated initial-state observation. The
request accepts no arbitrary contract, script or file selector. It reserves one
operation for that source/case, independently of the earlier appearance-only
operation. Changing the experiment cannot allocate a duplicate under that
reservation. The existing companion, token writer, component writer and
independent readback perform the four native phases.

The independent Switch journey was exercised through the application in
Evaluations. Its source experiment records 54 activation trials and 81 exact
restorations. The new native operation creates nine editable component mains
with exact 32 × 18.390625 roots and retained checked/defaultChecked/disabled/
onCheckedChange declarations. Independent readback reports no problems. A
fresh native instance visits all nine variant combinations, then restores
identical properties and PNG bytes. The plugin is closed for canvas inspection.
Repeated preparation retains the same operation and eight journal events; all
358 earlier operation files remain unchanged.

Two canonical native dumps agree byte-for-byte. Loading that capture into the
app's JSON importer and choosing **Prepare React library** produces an archive
installed in a clean npm consumer. All 54 input/action trials match the source's
initial state, live-input changes, two keyboard or associated-label activations,
disabled behavior and callback arguments. Additional caller-held and
caller-accepted controlled callbacks pass. The installed app was also operated
visibly; it imports only its generated package and React dependencies.

Separate guarded frames preserve the source's recorded fractional origin.
Source → native images pass 9/9 on both backgrounds, maximum 4.167% white /
2.399% black. Native → installed React also passes 9/9, maximum 4.167% white /
2.273% black. The 5% limit and scorer are unchanged. Capture clones match their
original native snapshots; repeated exports and browser captures are identical.
No component CSS overrides supply missing geometry. Standard layout-only crops
still refuse shadow overflow, and exact descendant geometry remains different:
the thumb's local y is 1.1953125 in Figma and 1.1875 in the browser; the invisible
hit-area decoration also differs. These are measured initial images, not pixel
identity or all-state visual qualification.

**Still unqualified:** broader live updates of this operation (the bounded opacity
cycle is now demonstrated in D.73), hover/focus, responsive and dark states, the
nine excluded source inputs, deeper composition
and the complete independent family. Figma retains behavior declarations; it
does not execute React interactions. The earlier bound-height update refusal
is unchanged. Detailed app journals, captures, exact package hash, lockfile,
source-matched trials and visible review are preserved under private
`stateful-native-return-1e6l8my3/`.

The nine initial image pairs now have a separate committed denominator in
`recipe/evidence/react-native-matched-state-api/`. The declared fidelity lane
recomputes them with the same scorer. The app's **Review recorded matched
frames** authenticates both the immutable initial observation and the pinned
state experiment, including its exact projected draft, before displaying the
images. New readbacks bracketed the frame exports and matched the operation
journal exactly, with no node allocation or mutation. Source capture files are
the unchanged, hash-verified historical capture of that same initial observation;
they are not relabeled as a fresh source run. The recorded review does not use a
newer experiment pointer or grant write authority. Root size and capture-position
checks do not qualify the differing descendant geometry. Evidence and the
source-capture selection refusal are retained in private
`stateful-matched-record-xb0m61io/`.

Adversarial checks cover changed input seals, a newer failed observation,
wrong-file delivery, stale source, altered metadata readback, operation reopen,
repeat reservation and unsupported updates. Reverse the new app route and
adapter to stop preparing these operations; preserve existing journals and the
metadata reader/refusal so previously created targets remain recoverable.

## D.72 A native height edit returns as a package update without changing the state API

**AGENT measurement decision — separate manual package replacement from automatic
two-way repair.** The existing state-API set from D.71 was edited in Evaluations:
its owned height variable changed from 18.390625 to 20 px. A fresh whole-file
binding check found 19 consumers on the operation and capture pages, with no
variable aliases. The edit affected 38 existing nodes through those bindings;
nothing was created. A canonical native capture was loaded through the app's
JSON importer, then exported with **Prepare React library**.

The returned archive differs from the previous archive only in one token CSS
value. Its package identity, JavaScript and type declarations are byte-identical.
The clean consumer passes all 54 recorded state/callback trials. Replacing the
package in the original consumer, without editing its source, also passes 54/54.
All nine updated roots are exactly 32 × 20 px. Recorded-origin image comparison
passes 9/9 on both backgrounds at the unchanged 5% limit, with maxima 2.662%
white and 2.083% black. The installed control was activated visibly and emitted
the expected callback.

Restoring the native variable produces identical snapshots across both pages,
identical bindings and ten identical PNGs. Restoring the original package passes
54/54 again; consumer source and installed token bytes return exactly. npm
normalizes the equivalent archive path from `file:./library.tgz` to
`file:library.tgz`, so its package and lock files are not byte-identical.

This is a measured designer edit → app import → installed package update and
rollback. It requires manual capture transfer and package installation. It does
not update the original hand-written React source, authorize a stale source
observation, or qualify guarded source-to-native bound-height updates. Exact
descendant geometry, hover/focus, dark/responsive states and excluded inputs
remain outside this receipt. The native operation journal remains historical
evidence; the temporary edit was restored before further work. Detailed captures,
archive hashes, same-consumer tests, restoration checks and the visible review
are retained in private `stateful-design-update-s__b4c11/`.

To reverse this measurement decision, remove this bounded acceptance claim while
preserving its private evidence. No converter, scorer or tolerance changed.

## D.73 State-API operations follow fresh source evidence without replacing their native set

**AGENT identity and update decision.** State-API operations previously had no
source-succession or compiler-update path. They now follow a complete, freshly
authenticated state experiment on the same source module/export and case. The
original creation pin remains immutable. Its exact sealed archive supplies only
the initial contract's allocation identity; it grants no authority over current
source. The current initial draft and state experiment are checked independently,
then projected once under that original namespace. API, initializer, callback and
value-map changes still refuse through the shared update planner. An observer
change can require a new experiment even when source bytes are unchanged.

**Measured through the app, 2026-09-20.** The existing nine-main state-API Switch
from D.71 completed a guarded opacity cycle in Evaluations. A coherent source,
stylesheet and declared exact-witness change from 0.5 to 0.4 was freshly observed:
nine initial states and 54 simultaneous-input trials with 81 exact restorations.
The app followed that evidence, reviewed three root corrections and one owned
unbound variable, then ran preflight, one guarded write and independent readback.
All four values were exactly `Math.fround(0.4)`. A repeat review planned and wrote
nothing; all 197 saved update/plan files were unchanged. The original set, main
identities, state API metadata and surrounding native structure stayed intact.

Restoring all three source files byte-for-byte and refreshing the observations
produced a reverse proposal on the same objects. Before applying it, a bounded
native edit changed one root to `Math.fround(0.45)`. Preflight named
`native-update-opacity-conflict:87:1077` and issued no write command. Independent
before/after snapshots, variables and 19 PNGs were identical. Restoring that one
test edit allowed **Inspect update again** to re-run preflight and complete the
same proposal. The three roots and variable returned to 0.5. Both native pages,
all 30 owned variables, API metadata and all 19 PNGs exactly match the original
baseline. All 610 earlier creation files are unchanged; no native node was
allocated. A final unchanged review leaves all 209 update/plan files identical.
Plugin windows were closed for each canvas inspection.

This qualifies this operation's bounded source-to-native opacity update,
conflict refusal, retry and rollback. It does not qualify bound-height changes,
broader state inputs, exact descendant geometry, hover/focus/dark/responsive
states, or automatic two-way source editing. Updated exports are diagnostic;
this cycle adds no new image-fidelity score. Historical correction exports now
omit current-source pairing and alignment: only a current, unsuperseded correction
can display those source images. The separately authenticated D.71 matched review
retains its original evidence. A fresh whole-file check found no consumers or
aliases of this opacity variable. This cycle used the earlier page-scoped write
guard; new variable proposals use the document guard described in D.74.

Reproducers: `native-source-succession.test.ts`, `native-source-identity.test.ts`,
`react-state-api-inspection.test.ts`, `react-state-api-native.test.ts` and
`react-cohort.test.ts` under `source-reference/` cover full experiment pins,
historical identity, pending/failed evidence, API refusals, same-node updates,
repeat and restoration. The in-flight experiment refusal was also observed in
the app before this cycle. Detailed source captures, immutable journals, native
snapshots, refusal, restoration and UI checks are retained in private
`state-api-source-update-x9yrm26v/`. No emitter, scorer or tolerance changed.

To reverse this decision, remove state-API succession/update eligibility and its
UI actions while preserving existing creation, succession and correction
journals, historical readers and shared write guards.

## D.74 Variable updates inspect document bindings before writing

**AGENT decision, 2026-09-20:** new owned, unbound number-variable updates carry
`tokenBindingScope: 'document-v1'`. Loading only the operation's page could miss
a consumer elsewhere in the file. The new program loads every page, then checks
all nodes, including hidden instance children, text ranges, vector-region paints,
component-property definitions and instance properties. It also checks local
paint, text, effect and grid styles and every local variable's aliases. A bound
variable refuses before assignment. The 10,000-node limit now applies across the
document; an oversized or unavailable scan refuses instead of claiming coverage.

After the last asynchronous read, the program obtains synchronous inventories
and reads live binding properties. No asynchronous pause separates those checks
from the existing exact-value checks and assignments. This requires the Sync
Runner's static document-access mode. The Desktop Bridge's dynamic-page mode
rejects these synchronous APIs and cannot perform this write. The guard never
changes access mode or disables hidden-instance filtering to make a check pass.

Historical plans and programs keep their original bytes. Only authenticated
written history can reconstruct the old plan shape for read-only recovery,
verification and unchanged-repeat review. Unapplied legacy proposals are
obsolete. Dispatch, pending-command delivery, re-arm and the begin handshake
refuse new authority for a legacy variable writer, including an idempotent begin
request. This does not stop a companion already executing past its old begin
handshake; the residual risk in B.40 remains.

**API feasibility:** a read-only plugin with Sync Runner's
manifest mode scanned Evaluations' 63 pages, 1,465 nodes and 135 text nodes in
319 ms, with 1,075 local variables and no local styles. It found no bindings or
aliases of the opacity variable and found consumers of the height variable.
The first probe exposed Figma's throwing property-definition getter on variant
components; the implemented scan reads definitions only on component sets and
standalone components. The plugin was closed and the canvas inspected. Evidence
is retained in private `whole-file-binding-readonly-v2-k3p0xiqa/` and
`sync-binding-api-probe-v2-nutrwyz9/`. The application then exercised the guard on the existing state-API Switch in
Evaluations. A temporary consumer bound to its opacity variable on a separate
page caused preflight to refuse `native-update-token-bound:VariableID:87:1059`
after scanning 64 pages / 1,468 nodes. No apply claim or begin was recorded;
independent readback found both owned pages, 30 variables and 19 PNGs unchanged.
After removing the three recorded probe nodes, retrying the same proposal scanned
63 pages / 1,465 nodes and changed exactly three disabled-root literals and their
unbound allocated variable from 0.5 to `Math.fround(0.4)`. Only the three affected
main exports changed. Restoring the source produced a separately verified reverse
update to 0.5. Both owned pages, all 30 variables, 19 PNGs, three source files and
17 original creation records restored exactly; the first refusal remains the
forward journal's prefix. Plugins were closed and the before, changed and
restored canvases inspected. Evidence and a visual review are retained in private
`document-binding-live-lwtcu999/`. This is a bounded live refusal, retry and
restoration proof; it adds no fidelity qualification.

Adversarial coverage in `core/native-contract-token-update.test.ts` checks
cross-page, hidden-instance, text, style, grid and property consumers, including
aliases or styles inserted after the final asynchronous inventory, unavailable
APIs and oversized scopes. `source-reference/native-update-legacy-scope.test.ts`
checks old unapplied, pending, begun, landed and partial journals;
`core/native-contract-update-bytes.test.ts` pins the historical programs.

To reverse this decision, disable new variable-value proposals while retaining
the legacy write-authority refusal and historical readers. Do not restore
page-only variable writes or rewrite saved journals.

## D.75 Stateful source identity does not depend on the archive anchor

**AGENT decision, 2026-09-20:** an initial-state or state-API operation may follow
fresh evidence whose saved root anchor is another case in the cohort. The anchor
locates and authenticates the complete source archive; the stateful case selects
the component. Requiring both case names to stay equal incorrectly refused a
Switch observation anchored through Badge when its previous archive was anchored
through Alert (`native-source-succession-case-mismatch`). The live refusal is
preserved in private `document-binding-live-lwtcu999/`.

The target stateful case, request shape and independently authenticated source
module/export must still match. Every initial-state and callback experiment pin
is checked and retained. Nested positional instances remain unsupported. This
changes succession eligibility only; it grants no native write authority and
rewrites no historical record. The changed-source adoption and the verified
forward/reverse updates in D.74 demonstrate this path live.

State inspectors also keep a common recorded anchor when another saved root
becomes current. Within the exact same reference, ownership and inventory,
selection prefers an anchor with both initial-state and callback records, then
one with initial-state records. Both original and followed root pins are
considered because historical keys retain their original compilation marker.
Pointer presence selects a request only; readers still authenticate every seal
and source file. Corrupt evidence refuses rather than silently selecting another
record. A live repeat initially exposed this second defect and refused without
changing any of 231 plan/update files. With the selection repair, the original
Alert-anchored callback evidence reappeared, including its three broad-input
refusals. Fresh observations completed nine initial states and 54 combined-state
activation trials with 81 exact restorations. The existing native operation
followed this evidence without creating another Figma component. Because the
observation revision changed, review produced a zero-property proposal. The
companion reported `no-op` and independent readback verified all 29 nodes,
token data and nine main images exactly against the restored result. The app
showed **update verified / pinned inputs match**. This advances evidence without
assigning a native property; the earlier refusal and corrections remain intact.
A subsequent review reused that verified result: no new plan, update event or
succession, and all 269 plan/update/succession files remained byte-identical.

Tests exercise alternate anchors, unchanged repeats, reversal, foreign-module
refusal, immutable journal prefixes and exclusion of another reference, ownership,
inventory or stateful case from anchor selection.

To reverse, restore the anchor-case equality checks in
`source-reference/native-source-succession.ts` and remove recorded-anchor
selection from `source-reference/react-reference.ts`; keep existing succession entries
readable and refuse only new adoptions with another anchor. Rejecting the saved
entries would strand otherwise authenticated operations.

## D.76 Declared JSX entry points need not live under src

**AGENT decision (2026-09-20).** API inspection and structure tracing selected
only bundled `.tsx` files beneath the workspace's `src/` directory. A valid
declaration mounting original JSX from another directory could render and
validate, yet expose no component modules to those readers.

Both readers now retain that historical selection and additionally inspect
explicitly mounted `.tsx` or `.jsx` files resolved by the same bundler run.
Each declared entry must already be pinned by the declaration's witnesses and
read into the reference. Resolution metadata stays on the host; the reference
identity, entry, bundle and provenance format are unchanged. This does not
discover package internals, follow source-map guesses or equate a compiled
package export with a neighboring original source file.

A separate workspace explicitly mounted Radix Themes 3.3.0's shipped Theme,
Button and Switch JSX. Through the app, all four cases validated against
network-isolated replay, with five negative controls rejected for each of the
two representative subjects. API inspection recorded three component definitions
and 202 source/declaration files, but remained incomplete:
`ThemeContext:component-function-unresolved`. Structure tracing refused before
matching any of the four cases with `react-ownership-source-changed-or-unreadable`.
Native preparation remained disabled. The source facts also retain Button's
delegation to BaseButton, Switch's replacement of caller children and Theme's
unresolved return control flow. No native conversion is qualified by this run.

Private evidence `radix-source-intake-umz12j_6/` retains the explicit declaration,
the initial host-configuration refusal, its correction, the original library
bytes, app records, DOM and inspected screenshot. All 1,244 existing native
journal files remained identical. The earlier compiled-package workspace and its
refusals remain separate evidence; no runtime-equivalence claim is made.

The regression exercises an extensionless declared JSX import outside `src`,
the actual HTTP API inspection, source changes and missing witnesses. A nearby
unimported JSX file cannot stand in for a compiled package entry. To reverse,
remove the additional mounted-file selection and its host-only metadata from
`react-reference.ts`, retaining the historical `src` selection in both readers.

## D.77 Textless originals require an explicit absence witness

**AGENT decision, 2026-09-20: admit declared text absence only after independently
observing it.** Source readiness previously required rendered text and an actual
painted font for every root. The unmodified Radix Themes Separator therefore
failed both declared cases with `text-witness-missing`, despite matching its
source dimensions and styling. An unrelated nearby caption did not establish
component text.

A workspace can now declare `witness.textContent: "absent"`, without a font-path
or associated-label witness. The observer checks up to 10,000 ordinary HTML/SVG
DOM nodes, including hidden text, and requires no non-whitespace text, generated
content, list markers or painted glyphs. Custom elements, shadow roots, slots,
opaque rendering and native text surfaces refuse this proof. A root disappearing
before the protocol read is unavailable evidence, never a zero-glyph result. Missing evidence,
an oversized scope, missing/hidden/zero-size roots, wrong styles or tokens,
resource failures and runtime errors still refuse. Existing declarations retain
their visible-text and actual-font requirements and observation field shape.

An explicitly textless representative must reject five corruptions: missing CSS,
theme, root, hidden root and injected unexpected text. The authenticated
declaration selects this set; recorded rows cannot exempt themselves from the
original missing-font control. Font-bearing cases still reject that original
five-control set. No fidelity threshold, scorer or original source styling changed.

**Measured through the application:** a separate Radix Themes 3.3.0 Separator
cohort now validates **2/2** original/replay cases, with all five applicable
corruptions rejected and source inputs unchanged. Structure observation matches
both original renders. Native conversion remains unqualified: the API read
retains `unresolved-prop-type:inlist`, child ownership remains unresolved through
the source spread, and both native roots refuse
`react-root-visual-source-content-unqualified`. Native preparation stayed disabled;
all 1,244 earlier native journal files remained identical. An empty observed
sample does not prove that a component owns or discards arbitrary caller content.

Private evidence `radix-separator-intake-fauiyy9s/` preserves the initial refused
declaration, before/after application screenshots, final observer hashes,
validation, ownership and API records. The final validation is `87c04d50…`;
an earlier successful run against a superseded observer remains separate evidence.
Browser regressions cover hidden/generated text, glyph disagreement, unavailable
scope, disappearing roots, node bounds and both five-control sets. Reverse by removing the opt-in
absence witness and its admission/control rules; preserve all receipts and
restore the named textless-source limitation.

## D.78 Vector masks must not become ordinary filled paths

**AGENT decision, 2026-09-20: keep mask composition outside the filled-path
projection.** Adversarial review found that both readers accepted a vector
with `isMask: true` as an ordinary painted path. A [Figma mask](https://developers.figma.com/docs/plugins/api/properties/nodes-ismask/)
changes its subsequent siblings; carrying its outline alone cannot preserve
that meaning.

REST grammar 1.39 and the canonical plugin dump now require an absent or
explicitly false mask flag before carrying vector path geometry. True or
malformed flags retain `vector-geometry-unsupported` and add
`vector-mask-unsupported`. This is a named capture degradation, not support
for mask composition or a claim that the remaining imported tree is faithful.
The packaged companion embeds the same canonical reader. Alpha, vector and
luminance mask cases, malformed flags and unchanged ordinary vectors are
covered by bounded probes; source capture bytes remain unchanged.

The sync CLI refreshed comparable baselines from new REST GET observations
under the new grammar. All 128 record identities and historical adoptions
remain intact; pending decisions stay unresolved. Previous ledger bytes and
CLI logs are preserved in `private/filled-path-sync-139-m040ae9n/`. No canvas
write, adoption or owner grade is part of this migration. The before-fix
reproduction and validation are in `private/filled-path-mask-refusal-wvt9lspr/`.
Reverse the reader guard only with a demonstrated mask-composition model;
restore observation baselines with their matching grammar, never by relabeling
an older fingerprint.


## D.79 Transparent captures must inspect closed shadow boundaries

**AGENT measurement decision, 2026-09-20:** new matched-frame recordings require
version 2 of the source capture instrument. A closed shadow root on an ordinary
span hid a backdrop-dependent child from the original light-DOM inspection.
The capture accepted a black source pixel turning white when the backdrop was
removed, despite restoring the original screenshot exactly afterward.

The new instrument inspects the target light tree and each ancestor through
Chromium's DOM protocol. Open, closed and browser-owned shadow roots, embedded
documents, incomplete protocol evidence and scopes exceeding 10,000 nodes
refuse before measurement. The check repeats during capture and restoration.
Independent sibling content retains the existing exact crop-exclusion proof.
This is a bounded refusal, not shadow-content support. Pixel scoring, geometry
requirements and the 5% limit are unchanged.

The original instrument and 19 recorded source/native pairs remain byte-frozen
historical evidence. Their existing scores still recompute against their pinned
instrument, and application review names their missing closed-shadow inspection.
New recordings cannot reuse those version-1 receipts as current capture proof.
No old manifest receives a new code hash or an invented scope witness.

A separate private recapture of all nine authenticated state-API Switch planes
passed the new guard and recorder. All five PNGs per pair, native geometry,
previous receipt fields and the derived scorecard stayed byte-identical. Fresh
Evaluations exports and bracketed independent readbacks also matched the saved
native baseline; no nodes changed, and the unobstructed canvas was inspected.
The real recorder refused the old capture before creating an output directory.
This verifies the strengthened measurement path, not the remaining V1 gaps.

The same recorder has now registered those nine new receipts separately in
`recipe/evidence/react-native-matched-state-api-scope/`. Application review opens
the capture with shadow-boundary checks and retains the original capture in an
expandable history, including its limitation. Both receipts are authenticated
and scored before either is returned; a duplicate instrument generation,
mixed-version rows or invalid historical evidence refuses the whole review.
The lane now checks 28 pairs across four records, representing the same 19
distinct state/content comparisons. This recapture adds inspection evidence,
not additional component coverage. Opening the review still performs no canvas
inspection or write. To reverse this presentation decision, remove the new
catalog entry and multiple-record view while preserving both capture folders.

Adversarial evidence is retained in
`private/transparent-closed-shadow-nlayfc6h/`: the before/after pixel probe,
open/closed target and ancestor refusals, unchanged ordinary and sibling pixels,
and source restoration checks. Reversal: restore the prior recorder admission
and current-instrument choice while retaining all evidence and naming the
closed-shadow measurement gap. Do not relabel historical captures as remeasured.


## D.80 Native change review retains numeric precision

**AGENT presentation decision, 2026-09-20:** the application displays numeric
proposal endpoints and observed design values using their round-trippable
JavaScript spelling. Four-decimal formatting previously made 0.40001 and
0.40002 appear identical. Shadow color channels and opacity likewise retain
their recorded values on the labeled 0–1 scale; byte and percentage rounding
could conceal those changes. Long structured design values can be expanded to
read the complete value instead of losing the tail after 120 characters.

This changes review presentation only. Plans, authority checks, stored values,
float32 verification, source identity, Figma writes and fidelity scores are
unchanged. Regression checks render the actual review formatters and verify
numeric round trips, distinguish small color/opacity changes, and retain escaped
structured content beyond the preview. Reversal: restore the old formatters
only alongside another visible way to inspect exact values before applying a
correction; rounded labels alone are insufficient.


## D.81 Three-state checked inputs require a separate complete experiment

**AGENT decision, 2026-09-20:** the simultaneous-input adapter accepts an
observed checkbox with the exact public domain `false`, `true`,
`"indeterminate"`. Its plan and observation use version 2; existing Boolean
checkbox/switch plans retain version 1 and their original serialized meaning.
The contract's existing enum and checked-toggle model already represents this
domain. The projection retains the appearance enum keys and typed code values,
derives the off/on event endpoints from those values, and retains the observed
initial default. Neither a component name nor a source property spelling
selects this rule. No schema, emitter or Figma write protocol changes.

A three-state callback type does not include an unrelated Boolean-only input.
When the appearance draft has exactly one additional optional Boolean input,
the plan may propose it as a disabled candidate. This is not an observed
relationship. The full experiment must prove its disabled state, focus and
activation suppression, callback silence, controlled precedence, initial-only
updates, and restoration for every input combination. With that input present,
there are 48 contexts, 96 activation trials and 144 restoration checks. A
failure prevents the generated draft; a switch claiming mixed state refuses.

Adversarial test-source probes reject incorrect mixed transitions, an ignored
disabled input and incorrect simultaneous precedence, with source restoration.
Generated React in those probes is independently exercised against the observed trials, and
the preview retains mixed initial and controlled values. Nine existing
historical plans and projected drafts remain byte-identical. These checks do
not qualify native pixels, the returned installed package, excluded inputs or
broader visual states. Those require separate application evidence.

Reversal: refuse new version-2 plans while preserving their immutable records
and native allocation identities. Keep the historical reader and enum metadata
support for any already-created output; do not reinterpret a three-state
record as a Boolean experiment or rewrite prior evidence.

## D.82 Three-state native delivery passes appearance but the return loses stroked vectors

Historical first return. The later stroked-path implementation and fresh application
return are measured in [D.84](#d84-open-stroked-paths-retain-their-centerline-and-parent-viewport); the original failed archive and captures remain unchanged.

**Measured through the application, 2026-09-20.** The built-in Checkbox's
three-state experiment completes 96 activation trials and 144 restorations.
The generated preview and the app-delivered archive installed in a clean React
consumer each match all 96 source trials, including held mixed state, accepted
callbacks, disabled suppression and controlled precedence. Visible browser
interaction confirms mixed initial activation and controlled hold/accept.
These are bounded behavior results, not complete interaction qualification.

The companion creates twelve variants and fifty variables in Evaluations.
Independent readback verifies all 44 native nodes. A new instance selects all
twelve variant combinations and restores its properties, main identity and
PNG exactly; original mains remain unchanged and a fresh readback equals the
operation's final readback. The plugin is closed for canvas inspection.

Fresh version-2 source captures and native clones preserve exact root bounds,
offsets, geometry and bindings. All **12/12 source-to-native appearances** pass
the unchanged 5% comparison on both backgrounds: maximum **0% white / 2.25%
black**. The authenticated twelve-row cohort is committed under
`recipe/evidence/react-native-matched-three-state-api/` and available through
**Review recorded matched frames**. Earlier captures remain immutable.

The canonical native dump is imported through the application's JSON tab and
exported using **Prepare React library**. That first return was visually
unqualified: **6/12 appearances** pass, with maximum **10.75% white / 8% black**,
despite exact outer bounds on all twelve. Every checked or mixed state loses
its checkmark. The reader explicitly reports unsupported stroked-vector
geometry, centered stroke lowering and proportional (`SCALE`) placement.
Recovered state metadata and passing behavior cannot override these named
losses. This code-originated return is not designer-authored coverage.

The first source experiment stopped after 40 trials and 60 restorations on a
restoration capture timeout. Its refusal is preserved; final verification
found the source restored. An unchanged retry completed. During that retry,
the operator navigated away from Sources to stop expensive progress polling;
normal unattended performance is not qualified. No source, scorer, threshold
or conversion rule was changed to obtain these measurements.

Private journal: `tristate-api-intake-d00ej81o/`, operation `1f12ad4e…`, source
experiment `7ff5cbac…`, returned archive SHA-256
`56cc91481c28afc9457d09c29e3e942bd64d0e15efdc6a7e0add652949bebd60`.
It preserves the failed attempt, source/preview/consumer trials, exact package,
native IDs, repeat capture, editability proof, screenshots and both visual
directions. No owner grade or V1 release qualification is assigned.

**AGENT decision:** register this separate twelve-row cohort with the existing
exact-geometry and 5% checks; do not replace historical Checkbox evidence or
count the failed return as success. Reversal removes this cohort from active
selection while retaining its immutable evidence and reported return losses.

## D.83 Running state API progress cannot certify a result

**AGENT decision, 2026-09-20.** Repeated status reads previously performed the
expensive source and saved-evidence authentication while the observer was
running. The state-API GET route now uses an in-memory progress snapshot only
for an exact active reference/case pair. An ambiguous pair refuses. It clones
the plan and returns the experiment identity and restoration count, always as
`running`, with `sourceUnchanged: false` and no observation or draft. That rule
also applies while a terminal producer closes its browser and seals the saved
record. Once the job leaves the active map, the existing authoritative reader
authenticates the result. Start/reuse, preview and native preparation keep
their authenticated paths.

A fresh application experiment completed **96/96 activation trials and 144
exact restorations** with Sources continuously open and normal polling active.
The final authenticated result confirms the original source restored. An
unchanged repeat through the application reused the same experiment; all 85
files across twelve saved experiments remained byte-identical.

This is bounded progress evidence, not a general performance qualification.
Of 28 sampled running reads, the first took **50.65 seconds**; the following 27
took **1.05–192.64 ms** (median **1.38 ms**). Final authentication took **29.10
seconds**. A separate PR validation lane ran concurrently, so these samples do
not establish a controlled before/after speed comparison. Cold startup,
terminal reads and other inspection routes remain unqualified. The earlier
failed trial and navigation workaround in D.82 remain historical evidence.

Adversarial checks cover target isolation, ambiguous jobs, mutation of the
returned plan, terminal producer state before sealing and a changed source at
authoritative read. Progress cannot authorize generation or a Figma write.
Private evidence: `state-api-progress-20260920-1212/`, experiment `a50e83ba…`,
including response timings, the completed app view and unchanged-repeat hashes.
No native operation was created or modified for this change. Reversal removes
the progress shortcut from the GET route and retains all sealed observations;
no evidence rewrite or migration is required.


## D.84 Open stroked paths retain their centerline and parent viewport

**AGENT decision, 2026-09-20.** A decorative `shape.kind: "stroked-path"`
retains one original open absolute M/L/C/Q path, its uniform cap, join and miter
limit, and the exact local position and size of its free-layout parent viewport.
The canonical Plugin API dump is version 1.40. REST remains 1.39 and refuses
stroked vectors: its outlined stroke geometry is not the original centerline.
Use the canonical desktop capture and import its JSON through the application.

The supported native subset has one solid centered stroke, no fill, no dash,
no effect, no mask or transform, zero corner radius, a uniform width profile,
and SCALE constraints on both axes. The parent must be an unpadded, unclipped
free-layout frame. The contract requires a fixed, undecorated relative parent
containing only stroked-path leaves. Width and parent dimensions must be positive
pixel measures; relative units, percentages, negative or zero values, and
inherited stroke paint refuse. Native compilation also checks resolved token
dimensions. Nonpositive bounds, incompatible parent
channels or content, malformed geometry, changing geometry across variants,
partial capture and nonmatching parent dimensions refuse by name. Polynomial
extrema must agree with the declared local origin and bounds, exactly or as
float32; no sampled approximation or tolerance is used. Only SVG space, tab,
carriage return and line feed separators are accepted. A browser probe found
that broader JavaScript whitespace accepted NBSP and vertical tabs while
Chromium rendered an empty path; both parsers now refuse those characters.

React, React inline, HTML and Web Component projections paint the original
path in an SVG covering the parent viewport, with `non-scaling-stroke`.
The existing border-color and border-width channels become SVG stroke paint
and width only on code surfaces. Native emission creates editable VECTORs
with those stroke bindings, cap, join and proportional constraints. It never
resizes a mismatched path to conceal a geometry error. Parent dimensions are
checked during compilation, then checked again against live Figma values.
The browser canvas previews use the same viewport projection.

A fresh canonical capture of the twelve-state native set from D.82 retained
all six stroked vectors and reported no degradations. Importing that dump and
choosing **Prepare React library** produced a new, unmodified archive. A clean
consumer passed **96/96 behavior trials** and **12/12 visual pairs**, with all
twelve root boxes exact and maximum **0% white / 2.25% black** mismatch under
the unchanged 5% scorer. Visible interaction confirms the glyph, caller-held
mixed state and callback acceptance. The older 6/12 return remains preserved.

An independent generated native probe covers a polyline, cubic curve and
quadratic curve with all three supported caps and joins. All nine combinations
across three parent sizes have exact geometry and unchanged stroke width;
all nine image pairs pass on both backgrounds (maximum **2.28%**). Color and
width bindings survive native creation and resizing. A native centerline edit
was restored exactly. Repeating the generated script created no nodes and
retained the same component identity. Figma normalizes path serialization and
converts quadratic segments to cubic segments; original string identity is
not claimed. The bridge was closed before inspecting the native canvas.

This qualifies a bounded code-originated return and the generic stroke rule,
not designer-authored coverage, automatic source repair or complete V1.
Source variable identity is retained where the existing inverse binding rules
can represent it; variant-presence gaps can still produce named provisional
paint tokens. Path-edit reconciliation and the older canvas fingerprint's
geometry exclusion remain outside this evidence. HTML and Web Component
markup conformance is checked; their interactive consumer journeys are not
part of React V1. Development hot reload can clear session import tokens;
reloading the saved dump restores that session layer.

Private evidence: `stroked-path-implementation-20260920-1248/`, including the
actual app contract and archive `d5163d72…`, 96 behavior rows, twelve image
pairs, the original failed uniform-profile capture probe, nine generic pairs,
editable-node readbacks and screenshots. Native probe writes are confined to
Evaluations page `89:1364`, sections `89:1365` and `89:1376`, component
`89:1369`, and their recorded descendants; its two probe variables are
`89:1367` and `89:1368`. The earlier source-generated set is unchanged.

Reversal removes the stroked-path schema, capture and emitter branches and
restores an explicit unsupported-vector refusal. Preserve both archives,
all earlier failures, canonical readbacks and native probe records; do not
rewrite old results or substitute an outlined silhouette for the stroke.

## D.85 Transparent pseudo geometry needs independent box evidence

**AGENT finding and decision, 2026-09-20.** The earlier unpainted absolute pseudo
reader treated computed CSS dimensions and offsets as native geometry.
That is insufficient even when the surrounding control passes its image test.
In the retained state-API Switch, the native transparent box is 54 ×
32.39059829711914 at approximately (-12, -8). An independent browser fixture
with the recorded source rules has a 54 × 32.390625 box at (-11, -7): the
computed height string loses precision, and absolute offsets start at the
host's padding edge rather than its outer border edge. Changing the source
height to 20 makes this box 34 high; changing only the native height variable
leaves the old box height. The earlier image results remain valid measurements,
but neither exact descendant geometry nor a complete source height update is
qualified.

The investigation covers twelve browser cases with zero, uniform and
asymmetric borders, both writing directions, and fixed versus inset sizing.
Adding the near border matches all six left-to-right cases; two overconstrained
right-to-left cases choose the opposite inset and disagree. Seven fractional
inset cases also show that computed offsets are not already used layout lengths.
More decisively, authored offsets 1.0156249 px and 1.015625 px both serialize as
`1.01562px`, while their actual local positions are 1 px and 1.015625 px.
The negative pair has the same ambiguity. No decoder of that CSS string alone
can recover both results correctly.

Fresh React initial-state observations now join each unpainted pseudo-element
to its actual host and read exact border quads. Scalar protocol sizes are rounded
integers and are not used. The reader checks the complete source styles, element
path, stable native browser identities and repeated geometry; shadow/slot/frame
boundaries, transformed or zoomed ancestors, and ambiguous roots refuse. Older
inspections without this evidence must be observed again before candidate assembly.
Saved source observations remain unchanged.

The fixed observed rectangle uses the existing contract dimensions and CSS
padding-edge offsets. The native compiler adds the parent's resolved border
insets; the inverse proposal subtracts the CSS border insets. Outlines and strokes
excluded from layout use zero insets. Uncarried or contradictory parent stroke
facts refuse. Rectangle dimensions and offsets retain their original precision;
unrotated native placement uses local coordinates directly. An off-center native
CENTER constraint keeps its measured offset and names the loss of center tracking.
Centered CSS placement with asymmetric borders remains refused. Bordered inset
overlays use the same padding-edge translation. Synthetic background planes and stroked-path viewports keep their
own native coordinate basis.

The regression probes cover 24 independently measured browser cases and 52 generated
React layouts across rectangles/ellipses, near/far/center constraints, uniform and
asymmetric borders, state-varying border sides, outlines and inset stroke rings. Initial-state assembly and
native writer/readback checks also cover the measured pseudo box. These are bounded
implementation checks. The application then observed all nine original Switch
states with the new reader: each transparent hit area measured 54 × 32.390625 px,
at −11, −7 relative to the host's outer edge. Its existing initial-state operation
explicitly followed the newer authenticated observation without allocating another
component. Initial-state listings now compare full observation pins, as state-API
listings already did, and refresh after observation completes.

The initial application review refused the unsupported child geometry channel.
A subsequent bounded writer now corrects fixed, absolute rectangle/ellipse leaves
with near-edge constraints, without changing their identities or other observed
facts. Bindings, size limits, aspect locks, rotation, nonleaf topology and mixed
channels refuse. The first live write used Figma's `resize()`, which silently kept
32.39059829711914 instead of 32.390625. Exact readback rejected that result and
restored all nine original tuples. An isolated native rectangle/ellipse probe
showed that `resizeWithoutConstraints()` writes and restores these values exactly.
New plans use that API and refuse when aspect-ratio evidence is unavailable;
historical program bytes remain unchanged.

The application then applied 27 scalar corrections to the same nine native nodes.
Independent readback and a second inspection both matched −11, −7 and
54 × 32.390625 exactly, with fixed sizing, near-edge constraints and no aspect lock.
All nine pre/post PNGs and export bounds are byte-identical; the corrected boxes
are transparent. The plugin was closed and the live component set inspected.
The failed attempt remains in its journal. An answered failed write now closes
only after independent readback proves the entire saved baseline was restored;
uncertain outcomes and unrelated edits remain blocked. Polling does not retry it.
The separate retained state-API operation then repeated the same application
journey with a fresh source experiment: 54 activation trials and 81 exact
restorations, with the nine excluded inputs preserved. Its new version-7 plan uses
`without-constraints-v2` and strict version-3 aspect-ratio evidence. The application
applied 27 corrections to its nine existing leaves. Two independent plugin reads
verified the update, and a separate Console read matched the entire saved baseline
apart from those reviewed geometries. All nine PNGs, export bounds and the variable
inventory stayed identical. Repeating the compiler review reused the same plan and
operation. The plugin was closed and the editable nine-variant set inspected on the
live canvas. The original 37 source files and all 2,007 prior journal files in the
two recorded inventories remained unchanged.

Fresh creation is now measured through the application on the separate
`switch-unchecked` state-API cohort. A new source observation and a separate
54-trial experiment with 81 exact restorations prepared operation `62e0264f…`.
The broad callback inspection still records its three refusals. The companion
created nine editable variants and 30 variables, and two application readbacks
agreed. An independent Console read confirmed all nine new hit areas at
−11, −7 and 54 × 32.390625, with fixed sizing, near-edge constraints and no aspect
lock. Repeating preparation left all 677 existing native-app files identical;
repeating inspection returned the same complete snapshot and nine PNGs. Both
earlier corrected sets, their variables and images remained identical. The
plugin was closed and the new set inspected on the live canvas. All 37 source
files stayed unchanged; only the initial-inspection latest pointer advanced
among 2,033 previous journal/index files. Evidence is retained under
`fresh-state-api-geometry-20260920-1633/`.

This qualifies the measured fresh hit-area geometry, not the complete component.
The separate thumb geometry mismatch remains unqualified.
The separate static-HTML emitter still adds a border in the inset-ring probe;
that surface is not qualified by the React checks.

Measured boxes do not establish authored sizing or responsive behavior. A future
height update must account for every changed descendant and every variable consumer,
or refuse. The current bound-variable guard remains unchanged.

Private evidence: `bound-size-pseudo-geometry-investigation-20260920/`, with
sealed source/native comparisons, the complete browser matrices and the
protocol prototype. Integration probes and failed adversarial cases are retained
in `pseudo-box-reader-20260920-1407/`; update journals `09048c90…` (rolled back)
and `c8c24f72…` (verified twice) retain the complete native observations. The
separate `state-api-geometry-20260920-1606/` comparison and `aba2e971…` update
journal retain the state-API repeat. Only the nine reviewed leaf geometries in
each operation changed; original source and historical receipts
remain intact. The AGENT decision is to use independently measured boxes, preserve
the two coordinate bases, and apply exact leaf resizes without constraints. No
public schema field or responsive rule is inferred. Reversal disables new plans
and removes the reader/coordinate lowering while preserving historical program
support and journals; it never changes the scorer or rewrites earlier measurements.

## D.86 A fixed native width cannot recover a lost CSS maximum

The historical Card REST fixture records a 320px, FIXED root whose `size.x`
is bound to `size/card/width`. It has no `maxWidth` field or binding. The
shipping source contract instead declares `max-width`. The emitter's existing
unmeasured-root lowering bakes that maximum into a fixed native width; the
original responsive meaning is absent from the fixture. The older plugin dump
also lacks a bounding box, so its historical reviewable inversion cannot
establish measured fixed sizing. Neither input proves a lossless source return.

**AGENT decision, 2026-09-20.** Keep the measured fixed-root reader: a uniformly
FIXED, non-FILL root retains its width binding, independently of any maximum.
Correct the REST receipt's expected target to an independent native contract
fixture carrying that width. Retain a separate, unmodified comparison against
the shipping source, which explicitly reports both mismatches: missing
`max-width` and added `width`. The comparator, original REST bytes, plugin dump,
shipping contract, emitter lowering and frozen evaluation record are unchanged.
Erasing the bounding box, changing the root to HUG, or replacing the width
binding with a maximum must each fail native agreement. This changes a stale
test expectation; it does not repair the historical emitter's responsive loss
or qualify the composed source round trip.

Reversal restores the old receipt expectation and its failing source-width
comparison. Do not reverse by discarding measurements, restoring the guessed
maximum in the converter, changing a tolerance, or rewriting historical evidence.

## D.87 Pixel-dimension value history does not authorize a bound-size write

The existing token update history only admits `number` leaves. A measured root
height is a `dimension` leaf, so the history protocol could not retain its new
value while preserving its original allocation identity.

**AGENT decision, 2026-09-20.** A new explicit `px-dimension-v1` history protocol
permits requested dimension leaves whose old and current values are finite
literal `px` strings. Both compile to one FLOAT variable. Relative units,
structured values, aliases, other types, unknown protocols and an unnecessary
dimension-protocol marker refuse. Inputs without the marker keep the historical
number-only behavior. The allocation revision is independently re-derived from
the saved original values; variable identity and ownership metadata do not change.

This is value-history support, not write authority. The existing scalar writer
still refuses dimension changes and every bound token change. A bound-size
writer must separately prove all document consumers, layout preconditions,
derived child movement, explicit leaf corrections, complete postconditions and
recovery. The version-9 writer described below is now integrated; its application
journey remains unqualified.

The token-history and historical-program checks pass. An offline replay also
verifies the sealed native probe's original 18.390625px value and both observed
20px states against the same allocation identity; a neighboring invented value
refuses. No new Figma write was made for this replay. Independent predictor,
structural matcher and document-scope checks now feed the version-9 writer below.
The read-only scope prototype observed exactly nine consumers among 1,954 nodes
on 68 pages in Evaluations. These measurements do not qualify a product update.

A separate opt-in `fixedCrossSizeReadback` version 1 collects constraints,
aspect ratio, alignment, growth and stroke-layout participation on pinned
owned components and leaves. Missing APIs or missing returned facts refuse;
historical readback inputs retain their exact programs. A live read of 27 owned
nodes added 126 observed facts and nine export bounds. Projecting those newly
requested channels away leaves the complete prior 29-node, token and nine-PNG
readback identical. The plugin was closed and the unchanged native set inspected.
The application now offers **Inspect sizing details** on an existing, observed
React draft. Its journal pins the owned node IDs, requires the new facts on
every subsequent read, and preserves older journal prefixes unchanged. The
same parent-read guard blocks it after a written correction. It does not
authorize a size update or clear a stale-source warning.

The live companion delivered this read for the existing nine-variant set:
27 strict layers, 126 added facts, and the complete prior 29-node, token and
nine-PNG observation unchanged. The new facts also matched the independent
Console read. Closing the companion, requesting another read, abandoning that
undelivered attempt, and reconnecting produced an identical second result.
This measured interruption was before delivery, not during a native write.
All 37 source files, 9,662 prior journal files and 34,326 protected recipe/parity
and evaluation files stayed byte-identical. The app's stale-source warning and
the unqualified bound-size writer remain explicit.

The version-9 planner recognizes one pixel-dimension variable in one mode
driving fixed flex cross-axis roots, with optional fixed absolute-leaf
corrections. It reuses existing correction validation and preserves allocation
history on reversal. Its predicted nine-root/eighteen-derived/nine-leaf
transition matches the saved live probe, including its incomplete variable-only
state. Production update dispatch now selects this planner for its bounded scope.

A separate synchronous final reader reuses the complete observation fields and
static token APIs after asynchronous page/registry loading. It refuses instances
and absent APIs; its emitted program contains no await. In a live read-only
plugin, the whole-document scope guard and this reader matched all 29 native
nodes, 30 variables and 27 strict layers exactly against the app's baseline.
This closes the measured read gap; it does not qualify a writer or recovery.

The scope prototype also checks every instance's resolved main component.
Instances of a changed main refuse even when their size binding is overridden:
they could still inherit absolute-child corrections. Missing or inaccessible
main-component evidence refuses the whole scan. This conservative restriction
also covers instances nested below invisible nodes and additions during the
last registry warmup; unrelated instances with resolved mains remain admissible.
The earlier read-only scope measurement predates this additional guard.
A second live read resolved 164 unrelated instances across the same 68 pages;
the stricter scope passed and the full app-owned baseline still matched exactly.
That read-only run did not introduce a new instance; the writer probes below
separately measure the resulting refusal.

The version-9 writer consumes that plan. Its final whole-document
scan and full native read share one uninterrupted turn with the assignments.
Recovery reruns both checks and restores the actual pre-attempt state only
while all recorded facts remain within the declared transition. Independent
edits, new consumers or unknown propagation states require recovery without
overwriting them. Synthetic failure tests exercise these branches.

In a bounded live Evaluations experiment, this writer applied one variable,
nine component sizes, nine derived flow positions and nine absolute-leaf
heights. A repeat made no writes. Guarded reversal returned the full original
29-node and 30-variable observation and all nine PNG exports byte-identically.
The independent host matcher and verifier accepted each measured state. The
runner was restored and the native set inspected with its window closed.
Further native probes inserted controlled exceptions after the variable and
first complete leaf assignments. Both rolled back to the exact original
observation, including all nine PNGs. A controlled independent name edit was
preserved with `recovery-required`; after the probe restored only its own name
edit, the unmodified guarded reverse recovered the geometry. An instance on
another page with its height binding removed still refused through resolved
main-component identity. The earlier owned-page instance probe correctly hit
the page-child baseline guard first; that evidence is retained separately.

These are controlled native exception probes, not an interrupted application
delivery. The measured writer is now routed through native update planning,
independent verification and companion dispatch. The application measurement
below covers a bounded update and before-delivery interruption; lost-write
transport recovery and React fidelity remain unqualified.

The first application preflight exposed a companion integration defect: the
version-8 reader assigned `skipInvisibleInstanceChildren=false`, which the
unchanged read-only guard refused before any document write. **AGENT decision,
2026-09-20:** version 9 requires the traversal setting to already be false and
never assigns it. The new plan version keeps the failed proposal and its pinned
programs immutable. A regression runs preflight through the actual companion
guard: complete traversal passes; hidden-child exclusion refuses without changing
the setting. The native version-8 exception measurements above remain separate
evidence. Reversal removes version-9 admission while retaining both journals.

The corrected application journey followed the changed source with the existing
nine-state set. Fresh source observations retained all seven structure cases,
nine initial combinations, 54 combined-input activation trials and 81 exact
restorations; the broad callback refusals remained visible. The review displayed
one variable, eighteen property corrections and nine derived thumb movements.
Preflight, one write and a separate readback verified 20px roots, 2px thumb
positions and 34px hit-area heights on the same native IDs. An unchanged review
planned and wrote nothing. All nine source root and pseudo-box measurements
agreed; the selected original thumb's live DOM measurement also agreed. These
are geometry observations, not a new pixel-fidelity grade.

Restoring all 37 source-file hashes and refreshing the bounded state experiment
produced a reverse proposal. The companion was closed after pairing and before
start; the saved start request had no dispatched command. Reconnecting resumed
that same request, dispatched one write, and independently verified the complete
original 29-node and 30-variable observation plus nine byte-identical PNGs. The
reverse removed the temporary dimension history while preserving allocation
identity. A further review planned nothing. Both native canvases were inspected
with the companion closed. Earlier 9,662 journal files and 34,326 protected
recipe/parity/evaluation files stayed unchanged. The initial refused preflight,
its old program bytes and both successful update journals remain recorded in
`private/bound-cross-size-20260920-1656/application-update-v1/`.

A separate disposable native probe exercised horizontal and vertical fixed
cross-axis roots inside fixed, non-layout component sets. At 16, 32, 256 and
16,384 pixels, the root size and centered child position matched the predictor;
both parent sets and the containing section kept their exact bounds. Synchronous
observations matched those after export, and restoring 20px returned the entire
probe baseline. Its eleven nodes, variable and collection were removed, the
original page-child list restored, and the original application canvas inspected.
This bounds the parent-extent concern; it does not expand supported layout scope
or provide a pixel-fidelity grade.

Reversal removes admission of the new protocol. If a prior write has used it,
first retain read-only verification of that authenticated history; never rewrite
allocation stamps or discard its recorded original values.


### D.88 Native text rendering and explicit consumer fonts

**AGENT decision, 2026-09-20.** A contract root with captured auto-width text
(`textAutoResize: "WIDTH_AND_HEIGHT"`) now receives an inherited
`text-rendering: geometricPrecision` default on the code surfaces. This is a
browser rendering policy, not a recovered Figma property or a font identity.
It changes no font family, size, tracking or box declaration. Roots without that
captured text retain their emitted bytes. A root containing any component
reference or slot receives no default, because its descendants include content
owned elsewhere. Any authored text-rendering channel anywhere under the root,
including a state channel, also suppresses the default. An ordinary caller
`style={{ textRendering: 'auto' }}` overrides it on either React surface.

The bounded **macOS Chromium** geometry probe covered 1,200 cases across five
fonts, sizes, tracking, kerning, wrapping and RTL; every measured element and
text-line box was unchanged. That result does not hold on Linux. Linux CI and
a separate Linux ARM64 reproduction both measured different Inter advances for
`auto` and `geometricPrecision` (94 versus 94.09375px and 12 versus 13.21875px).
Chromium deliberately changes Linux font hinting and subpixel metrics for this
policy. A caller switching policy may change text geometry and wrapping.

**AGENT correction, 2026-09-20.** Retain this explicit output rendering policy
within the existing ownership guards; withdraw the cross-platform paint-only
assumption. Generated-component checks now compare the default and caller
override with explicitly authored contracts using the **same** rendering policy.
They require exact element and text-line geometry across fonts, runtime strings,
wrapping and RTL on both React surfaces, after verifying font loading. They do
not equate two different browser policies, loosen numerical comparison or qualify
native-image fidelity. The original failing test/log remains preserved.

The identical app-delivered Checkbox archive also ran in an isolated consumer
using Linux Chromium and the same hashed font. It passes **13/26**, with maximum
black difference **10.701%**, at the unchanged 5% limit. Its native PNG hashes and
root dimensions match the macOS run. A research-only control removing the inferred
hint also passes 13/26 (maximum black 11.969%); it is not a delivered library.
Linux fidelity remains open. This policy is neither recovered Figma metadata nor
a guarantee of identical geometry or rasterization across platforms. Evidence,
the unmodified CI failure and the explicit control are in
`native-text-linux-20260920/`.

The clean-consumer command accepts an explicit hashed local-font manifest
through `--fonts`; [the journey guide](USER-JOURNEYS.md) shows the format. The
assets and loaded-face descriptors are retained with the receipt. A family and
style name alone cannot authenticate source font bytes, and a loaded font can
still lack particular glyphs. No font is embedded in a generated library or
installed on the host by this option. Component CSS and the existing 5% image
limit are not changed by font provisioning.

The fresh macOS Chromium app journey is retained in `native-text-app-20260920/`: JSON import,
React archive preparation, exact app-endpoint bytes, clean installation with
the pinned Public Sans asset, unchanged repeat import and visible source/before/
after inspection. All 26 variants pass on both backgrounds (maximum black
difference 3.279%), improving the preserved historical 13/26 result. All native
PNG hashes and root dimensions are unchanged between runs. App archive and
installed package hashes agree. The browser download event timed out; retrieving
the exact displayed link recovered the archive, with no browser save-path claim.
The repeated import kept identical contract bytes and two workspace entries.

Prototype and adversarial evidence is in `native-text-prototype-1cgl5_8q/` and
`public-sans-source-fingerprint-20260920/`. The initial broad inherited hint also
affected composed roots; that prototype is not the supported rule. The ownership
guard deliberately excludes such roots. Guarded reruns retain Altitude Badge
10/10, Checkbox Group 12/12 and CBDS Badge 66/72. All CBDS generated bytes are
unchanged in that run; its six outline failures remained open. D.90 records the
subsequent owned-leaf rule and fresh app delivery. The app result qualifies this
bounded visual comparison, not interaction semantics, other families or V1.
No owner grade was written.

To reverse the rendering decision, remove `nativeTextRenderingRoots` and its
emitter calls; retain the independent font-input support and all prior receipts.
Do not change historical contracts, font files, crop rules or fidelity limits.


### D.90 Owned terminal text can keep a local rendering default

**AGENT decision, 2026-09-20.** D.88 continues to exclude mixed roots from its
inherited rendering default. A direct terminal child of such a root can now
receive `text-rendering: geometricPrecision` when it carries captured
`textAutoResize: "WIDTH_AND_HEIGHT"` and owns scalar contract text or a literal
string. The hint stays on that child. Slots, component references, repeated
parts, deeper wrappers, shapes and non-text content do not gain this fallback.
Any authored text-rendering channel in the root's tree suppresses inference.
No component names participate in this rule.

Both React outputs forward an explicit caller `style.textRendering` to these
owned leaves. Measured generated-component probes show that caller and component
siblings keep their prior rendering and explicit `auto`, `optimizeSpeed` and
`optimizeLegibility` overrides win. The macOS geometry observations do not imply
that switching policies preserves Linux metrics; see D.88's correction. A contract
that owns the code prop `style` keeps that API; the inline
emitter now omits its extra HTML-style binding, avoiding a duplicate parameter
and preserving the enum-driven variant. Web Components receive the equivalent
owned-leaf declaration; this does not expand their V1 qualification or promise
new host-style override behavior.
The separate omitted-plane metadata guard still refuses reserved `style`
aliases; ordinary style-enum emission does not expand that native admission.

Private evidence in `cbds-owned-text-leaf-probe-20260920/` preserves the original
66/72 control, a label-only diagnostic, source snapshots and a reproduced invalid
app-copied inline export. `cbds-owned-text-engine-20260920/` retains the actual
engine-generated family: only the Badge label's CSS declaration differs from
the control; all three inline outputs parse and typecheck. With the explicitly
supplied, hashed Inter asset, the clean consumer passes 72/72 on both backgrounds
at the unchanged 5% limit. These engine checks alone do not qualify an app
journey. The separate `cbds-owned-text-app-20260920/` run restores the imported
family in the app, copies its valid inline output, prepares a new archive and
installs a byte-identical package in an isolated consumer. It passes 72/72
(maximum 2.214% white / 4.557% black); all 72 native PNGs, exact root dimensions
and recorded layout frames agree with the control. Before/after source snapshots
are identical. Repeat JSON import preserves contract bytes and all five current
workspace entries. Live browser inspection covers both comparison backgrounds
and the retained installed consumer. This closes the six bounded **macOS Chromium**
CBDS visual failures, while its reverse journey and broader V1 acceptance remain open.

The same app archive and font measured in Linux Chromium pass **36/72**, with
maximum differences **6.967% white / 8.333% black**. Native PNG hashes, root
dimensions and bracketing source snapshots match the macOS evidence. A separate
research-only control removing the owned-leaf hint passes **37/72**, with maxima
9.115% white / 10.026% black. Thus the default does not improve every Linux pair,
and neither policy qualifies Linux fidelity. These failures remain open in the
acceptance ledger; no scorer, limit or OS-specific pin changed. The private
`native-text-linux-20260920/` journal retains both runs and the original CI failure.

To reverse, remove `nativeTextRenderingLeafParts` and its emitter calls/explicit
caller override forwarding. Keep the independent inline `style` collision fix,
font-input support, D.88 root guard and all historical evidence. Do not alter
source designs, crops, scorer thresholds or owner grades.

### D.91 Pressed root paint can equal rest while still needing a hover reset

**AGENT decision, 2026-09-20.** A pointer press also matches `:hover`. Reading
pressed paint only as a difference from rest loses a necessary override when
the pressed drawing restores the resting background or border color. The
proposer now compares these root paint channels with the uniquely matched
hover cells too. It retains the captured pressed value, including a bound
reference equal to the base reference, through the existing state vocabulary.
It requires a hover peer for every compared pressed cell and at most one
remaining variant axis. Multiple-axis hover selectors can outrank a uniform
pressed selector and remain outside this bounded reset rule. No state, paint,
property axis or component-specific behavior is invented. Other root channels,
part-level resets, simultaneous keyboard focus and states with no recoverable
override retain their existing limits and refusals.

Root token-state CSS follows the declared interaction vocabulary order across
uniform, substituted and per-value bindings. Stable ordering keeps per-value
overrides after uniform bindings within each state. A browser counterexample
showed a per-value hover rule overriding a uniform pressed rule at equal
specificity; the corrected order restores the captured paint during a real
pointer press. The synthetic native preview round trip retains the active
state and its token references.

A state need not change paint if the source explicitly draws the same paint
at rest. The consumer check retains its `state-inert` finding unless a unique
rest cell has exactly the same non-state props, a distinct native node ID,
byte-identical valid PNG data, authenticated full-bounds scale-one captures,
and exactly matching relative render geometry and layout size. The receipt
names both nodes and their image hash. This only resolves the paint-change
expectation: undeclared states and unreachable interactions still fail, and
the consumer's own size and both unmasked image comparisons remain required.
The scorer, crop rules and 5% limit are unchanged. Disabled-state equivalence
is not admitted by this rule.

Read-only native evidence on Altitude Tab confirms both Active/Default pairs
are byte-identical, with stable bracketing source snapshots. The application
now imports Tab as a real child instead of its former state-refusal stub and
prepares its React archive. A clean consumer installs a byte-identical package
and reaches both pressed states. It still reports 16 image/content-size
problems: only 3/10 image pairs meet both background limits, selected text is
93px wide against 101px in the source, and focus reaches a 27.47% black-background
mismatch. The press proof does not excuse those failures. The same JSON import
repeated with exactly five workspace entries and an identical Tab contract.
The visible comparison and installed consumer were inspected on both
backgrounds; evidence is retained in
`private/tab-active-reset-app-20260920/`. Text Passage and ArrowArcLeft remain
unresolved dependencies. This failed application journey does not qualify V1.

To reverse, remove the concurrent-hover root-paint comparison and restore the
prior root token-rule ordering. Restore unconditional `state-inert` reporting
if withdrawing the independent source-equivalence adjudication; keep its
receipts and negative controls. Preserve the failed consumer and all native
source evidence. Do not adjust tolerances or replace historical results.

### D.92 A uniform state border can replace different resting side widths

**AGENT decision, 2026-09-20.** A resting bottom-only border and a uniform
focused border use existing contract channels, but the proposer previously
named every state-width change involving resting side widths as unsupported.
It now carries this bounded case as `border-width` and solid `border-style`:
every compared root has a captured stroke, INSIDE alignment and an explicit
`strokesIncludedInLayout: true`; resting widths are complete finite
nonnegative numbers, and all state cells have one equal finite nonnegative
uniform width that changes at least one resting side. Unbound widths need
minting; uniformly bound widths retain their references, including distinct
identities represented through the existing per-value state maps. A failed
width recovery cannot leave a style-only override. Unequal state-side widths,
missing layout evidence and other alignment policies remain outside this rule.
No schema field, component-name branch or inferred width is added.

Native state previews remove replaced resting side literals and bindings
before applying the state shorthand. These transitions explicitly include
strokes in layout on the resting and state frames; the public outside-layout
flag still wins. Native layout settings differ across retained and freshly
created nodes, so an explicit write avoids relying on their prior state.
Other generated library scripts
remain byte-fresh. Synthetic browser and native round trips cover common and
per-value bound width identities and twelve unsupported input controls.

The generated program was executed in a new isolated Evaluations page and
collection. Its ten editable variants retain the bottom-only resting stroke
and the two uniform 2px focus strokes. The canonical native dump and exact
proposal recover the width references and solid style. Existing page and
collection inventories and variable values are unchanged. The plugin window
was closed before inspecting the live canvas. This is a bounded native engine
probe, not a claim that the application completed the reverse journey.

The actual Playground imported the same preserved source, prepared a React
archive, and a clean consumer installed the byte-identical package. Tab now
passes **4/10 image pairs on both backgrounds**, with **12 named problems**
remaining. Unselected focus is 96 × 40 on both surfaces and measures 0% on
white / 2.421875% on black. Selected focus is still 97 × 40 against native
105 × 40 and fails on black. Text sizing and other text image differences
remain unresolved; the two composed dependency gaps in D.91 also remain.
Explicit Public Sans consumer assets do not authenticate Figma's font bytes.
The original pixels, frame checks and 5% limit are unchanged. Repeating the
import retains five entries and an identical Tab contract. A normal browser
reload restores a schema-valid contract and an available package action.
The comparison and installed consumer were inspected visibly on both
backgrounds. Tab and V1 remain unqualified.

To reverse, remove the uniform-state-width exception and its solid-style
carrier, restore the native state-preview side handling and remove this
transition's explicit layout policy. Preserve the outside-layout behavior,
D.91 pressed paint reset, all source captures and the failed app consumer.


**AGENT review correction, 2026-09-21.** The explicit layout policy also
covers token-bound resting side widths. The initial rule detected only literal
sides, so an existing native outside-layout setting could survive reconciliation
of an otherwise identical bound contract. A new isolated Evaluations control
first created two 120 × 32 native mains with the expected setting already true;
that fresh result is preserved. The controlled existing-node case then set the
layout setting false and cleared only this fixture's stamp to require a real
amend. The prior generated program left both values false. The corrected
program set both true while preserving the set key, both main IDs, dimensions,
side widths, bindings, variable values and PNG bytes. A repeat allocated nothing
and retained the complete readback. The plugin was closed and the canvas
inspected. This measures a native reconciliation policy, not a new application
or pixel-fidelity result. The contradictory outside-layout plus border-style
contract still refuses. Reverse this extension by limiting the explicit policy
to literal sides again; keep the controlled before/after evidence in
`private/uniform-state-bound-review-20260921/`.

**AGENT review correction — alignment and binding order, 2026-09-21.**
The uniform replacement requires an explicit captured `INSIDE` value on both
resting and state roots. Absence means unknown. The earlier exception incorrectly
accepted missing alignment; the later bound-width reader could also reintroduce
a refused width. Common and per-value bindings now obey the same qualification
as unbound widths. The existing explicitly outside focus-ring path remains
separate. A qualified common width stays a border even when the resting paint
is awaiting token minting; previously that ordering could remap it to an outline.
Browser and mock-native round trips cover common and per-value width identities,
and 45 controls retain missing/unsupported alignment, layout and width refusals.
A fresh canonical read of the retained two-main Evaluations fixture still
recovers `{two}` with solid border style. Removing either alignment field from
an offline copy makes exact projection refuse; no native node was changed.
The bridge was closed and the retained canvas inspected. This is a bounded
compiler/capture check, not a new application journey or fidelity qualification.
To reverse, restore the absent-alignment fallback, independent bound-width
recovery and early outline remap together; preserve the failing controls and
readback in the same private review directory.

### D.93 Complete observed tracking can vary by prop

**AGENT decision — 2026-09-20.** Both readers now retain explicitly observed
zero letter spacing (REST dump 1.40, plugin dump 1.41). Missing or mixed data
still means uncaptured. Fully observed, finite tracking that differs across
variants uses the existing provisional-token axis classifier when minting is
allowed. Uniform nonzero values retain the existing literal spelling; uniform
zero adds no declaration. Missing cells, nonfinite values and varying input
with minting disabled keep named limits. No component-specific rule was added.

The actual JSON-import and React-package workflow produced an archive that
matches the isolated installed package byte for byte. At the unchanged 5%
limit, **8/10** native/React pairs pass on both backgrounds. All five selected
appearances now pass. Unselected rest and pressed remain **15.38%** on black;
the run is still refused. The source version and bracketing geometry hashes
are identical before and after capture. Repeat import retains five workspace
entries; normal reload restores the identical contract and package action.
The comparison and installed consumer were inspected in the application.

A generated update in Evaluations preserved the existing component set key
and all ten variant IDs, rebuilt the contract-owned text interiors, and read
back 0px or 1px on every label. The unchanged repeat created nothing. Existing
page, collection and variable inventories and values did not change. Native
tracking is a resolved value; this does not establish variable-binding
identity for letter spacing. Only the owned Evaluations probe was amended.

**AGENT decision — tracked text boxes, 2026-09-21.** A base tracking token
with one to three distinct enum placeholders and explicit defaults now retains
the auto-width fact. Every expanded light/dark token value must be a finite scalar
px/em/rem string. Object-shaped dimensions refuse because the scalar emitters
do not serialize that format; even zero percent is invalid tracking. Missing cells, boolean/defaultless/repeated axes, a competing
literal, and per-value tracking overrides refuse. The text must be an owned
leaf in ordinary text flow; caller children, structured content, raw-text hosts
and authored style attributes cannot acquire the inner run. Even an explicitly
empty style attribute refuses: accepting it produced duplicate JSX style
attributes and an uncompilable React component in an adversarial control.

An adversarial browser check found that subtracting tracking from `fit-content`
could subtract twice when a content-sized parent fed its rounded width back
as available space. A 14px Arial label, “Updated label”, with 1px tracking
became a 98px box on two lines despite a 99.40625px run. The revised shared
rule uses a 99px layout box and an inner 100px line-breaking box, keeping one
line. Static tracking and selected enum tracking use the same rule. Negative
tracking, empty text, replacement, restoration, constrained columns/grid, RTL,
vertical text and fallback without `calc-size()` are measured separately.
No font, scorer or image threshold was changed.
A separate static-tracking regression consumer retains all ten passing Badge
image pairs on both backgrounds. It uses environment fonts; their bytes are
not authenticated. This check does not replace its prior application evidence.

A fresh engineering consumer from the preserved Tab capture matches all ten
native root dimensions exactly. A subsequent actual application import,
archive download and isolated installation reproduces that result: **8/10**
image pairs pass; unselected rest and pressed fail at **12.56%** on black.
The downloaded archive and clean consumer's installed archive share SHA256
`5866d6e8042f596c1178671628353edc0ae0e91cf0c05973269d6ec72627d508`.
The app refuses a tracking reference to a color value. Restoring the original
contract produces a byte-identical archive; normal reload and workspace
selection restore the exact contract and delivery action, with one saved
entry. This is same-tab recovery; browser restart is not established.
The earlier app archive and its 15.38% failures remain intact. Font assets are
explicitly supplied and hashed; Figma's font bytes remain unverified. The
earlier Public Sans 1.007 control also remains failed.

A generated native update, using that app contract with only its identity
retargeted to the existing owned Evaluations fixture, preserves the set key
and all ten main IDs. The existing amend rule rebuilds ten editable text
interiors; all retain `WIDTH_AND_HEIGHT` and the expected 0px/1px tracking.
Root dimensions, native image bytes, pages, collections and variable values
are exact before and after. An unchanged repeat allocates nothing and preserves
the complete readback. Canonical capture and inverse proposal retain the
auto-width field and both tracking values. The bridge was closed and the
canvas inspected. This is a generated-program update of the owned fixture,
not a new source-workflow operation or fidelity qualification.

**AGENT decision — editor token values, 2026-09-21.** The editor passed only
token names to its CSS validation layer. That falsely refused the imported
tracked label with “no token VALUES were supplied” even though the app held
all 17 minted values. Validation now receives the same active token tree as
generation. The positive app import and negative color-as-length check both
exercise this path. Reversal means restoring inventory-only validation and
documenting the resulting refusal of valid tracked text imports; never skip
the shared value-dependent guard. The new app archive, failed comparison,
reload and refusal evidence are preserved in the private
`variant-tracking-text-box-20260921/` journal.

Reversing this sizing revision means restoring the placeholder-token refusal
and the prior tracked-box declarations and markup together, removing its
private run variable and empty-text handling, then rebuilding the plugin
receipt and derived registers through their scripts. Keep the newly exposed
short-label wrapping defect documented and preserve every failed consumer.

Evidence and the adversarial review remain in the append-only private
`variant-letter-spacing-20260920/` journal, including eleven bounded controls,
source captures, actual archive, clean-consumer receipts, native IDs and visible
comparisons. Earlier D.91/D.92 failures remain intact. Tab and V1 remain
unqualified. Reversal: revert the reader-version/capture and proposer changes
together, rebuild the embedded dump and plugin receipt through their scripts,
and retain all old captures and failed consumers. This restores the named
varying-tracking loss rather than inventing zero for missing observations.

## D.94 Local default components keep their export identity

**AGENT decision — 2026-09-20.** Source inspection previously filtered exports
by an uppercase first character and silently skipped `default`. It now admits
a local `const` whose initializer is a supported function or direct React
`forwardRef` call. The module/export/hash/span identity remains unchanged:
`default` is never replaced by the local variable name or `displayName`.

Const alone is insufficient for a wrapper object: an adversarial probe replaced
its `render` method with `Object.assign` while the initial reader still reported
forwarded children. New default admission therefore also refuses local value
mutations and escapes. Only declaration, local export, type query
and literal `displayName` assignment uses are admitted. Anonymous export
expressions, default function declarations, mutable bindings, indirect wrappers,
external definitions and unsupported calls remain named refusals. Existing
named-export behavior is unchanged. This is a bounded local proof, not analysis
of every possible future consumer mutation.

Tests retain true default import identity, direct children, callback/default
metadata and non-execution of source. Two modules with the same local name and
`default` export join distinct renderer owners; a substituted module identity
and duplicate runtime alias refuse. The initial six wrapper mutation/escape
controls refuse.
The cohort still groups negative controls by the declared export-name subject;
multiple default-exported modules do not automatically receive separate groups.

**Adversarial correction — 2026-09-21.** A local JSX element retains the actual
wrapper object in its `type` field. Both an assigned element and an element
returned from a local factory allowed `Object.assign(element.type, ...)` to
replace the render while inspection incorrectly reported forwarded children.
Direct `eval` reached the binding without a checked symbol reference. Controlled
runtime probes confirmed all three changed caller content to replacement text.
Default admission now refuses local JSX references and modules containing an
`eval` identifier. This deliberately includes harmless local JSX uses until an
element-alias proof exists. Runtime regression controls verify the changed
output and refusal; immutable export-only components retain admission. Private
before/after evidence is in `default-export-adversarial-20260921/`.
To reverse this correction, first prove that the produced element and any
returned aliases cannot expose a mutable implementation, and that dynamic
evaluation cannot alter it. Do not restore the unconditional JSX exemption.

The unchanged React DaisyUI 5.0.5 Badge source matches both npm source-map text
and release `94869ab436cb72aea944972a8f931cb9b60e725e`. In the app, two declared
cases pass source/replay checks and all five representative corruption controls.
The published compiled entry independently matches both cases' exact DOM,
computed styles, root bounds and PNG bytes. These finite observations do not
establish package-wide semantics. The host declares DaisyUI's light theme and
pinned Inter bytes under the standard `Inter Variable` CSS alias; the earlier
`Inter` alias failed the missing-font control and remains preserved. The API
read still names `unresolved-prop-type:inlist`; native fidelity and the complete
second-library journey remain unqualified. Private evidence is retained in
`daisyui-source-intake-20260920/`.

To reverse, restore the uppercase-only export filter and remove the default-only
binding/use guard and documentation. Preserve original source, declined cases,
all private observations and the existing runtime identity/refusal checks.

## D.95 Root style drafts retain binding refusals

**AGENT decision — 2026-09-20.** A token being minted does not establish that
its binding can be expressed in the contract. The observed-root adapter kept
the mint preparation's residuals but dropped the shared fuser's binding
refusals. It could therefore label a draft `native-compiled` after losing a
captured paint channel. Both the combined and single-property adapters now
retain each refused channel, token reference and reason. They keep the prepared
contract and captured tokens available for inspection, but stop before native
compilation with `react-root-matrix-unprojected-bindings` or
`react-root-variants-unprojected-bindings`. Existing diagnostic operations and
their original receipts remain unchanged; this guard applies to fresh assembly.

The live React DaisyUI Badge matrix exposed the defect. Its background, text
and four border colors depend jointly on `color` and `variant`, both optional
without defaults. The shared fuser explicitly refuses that two-omission mapping.
The prior application run nevertheless created 100 editable mains with empty
native slots, all 1 px tall and without fills or strokes. A separate native
instance with editable `New` text measured 49.01599884033203 × 20 px, against
49.921875 × 20 px in the unchanged source, and visibly omitted the badge paint.
No fidelity pass is claimed. Independently, source height provenance remains
unresolved at a cascade-order tie; this change does not substitute the measured
sample height for an authored constraint.

The app's fresh source trace and synthetic full-matrix checks exercise the
refusal. Independently factored colors over the same optional axes remain
eligible. Source files, prior Figma objects, token names, the shared fusion
grammar and visual thresholds are unchanged. The retained evidence is in private
`daisyui-source-intake-20260920/` and `react-root-overflow-20260920/`.

To reverse, remove the adapter's overflow forwarding and native-compilation
guard, together with these outcome claims. Preserve every source observation,
native operation and failed visual comparison. Supporting the refused mapping
requires a separate contract/emitter change and measured round-trip evidence.

## D.96 CSS rule order requires stylesheet and tree-scope evidence

**AGENT decision — 2026-09-20.** Equal-priority declarations in separate rules
of the same stylesheet previously remained a `cascade-order-tie`. The reader
now uses valid, non-overlapping sheet-relative `CSSStyle.range` positions after
importance, inline, layer and specificity ranking. Every tied candidate must
identify the same stylesheet and a captured tree scope. Duplicate reports of
one rule are deduplicated by numeric range; neither CDP array order, selector
names nor equal computed colors choose a source declaration. Conflicting
declarations within one rule, separate stylesheets, missing or invalid positions
or scope IDs, overlapping ranges and nested rules remain unresolved.

An adversarial browser probe reused one constructed stylesheet in both the
document and a shadow root. Source order incorrectly chose the inner rule even
though the outer rule painted the host. Rules from different recorded origin
tree scopes now refuse as `encapsulation-cascade-unsupported` before ranking.
The probe covers equal and unequal specificity, and the reversal for important
declarations. The rule follows [CSS Cascade 5](https://www.w3.org/TR/css-cascade-5/#cascade-order)
and the [CDP CSS protocol](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/json/browser_protocol.json);
it does not infer cross-context order from selector spelling.

The unchanged DaisyUI source demonstrates the bounded improvement: its regular
badge height is authored as `1.25rem` (20 px), and the later small-badge rule
declares `1rem` (16 px). The app trace retains height across the 100 observed
property combinations for each declared case. Both original/observed pairs
match and the source is unchanged. Width remains unresolved because the
`fit-content` expression is outside the supported source-size grammar. The six
paint bindings still refuse under D.95, so native preparation remains disabled;
no new native output or fidelity pass is claimed. Private evidence is retained
in `daisyui-source-intake-20260920/` and `css-source-order-20260920/`.

To reverse, remove the source-position tiebreaker and restore the named tie
expectations. Keep the independent cross-encapsulation refusal and all source,
failed-probe, interrupted-run and native evidence. Do not replace authored
constraints with measured sample dimensions or weaken visual thresholds.

## D.97 Complete joint paint tables preserve both omitted planes

**AGENT decision — 2026-09-20.** A complete `tokensByCombination` table now
represents resting root paint that depends jointly on two optional defaultless
enums. Each row contains two canonical values or `null` for omission, and plain
token references. Both properties retain their existing public API and explicit
native omitted planes. The shared referee requires every Cartesian tuple,
identical channel sets, and no competing base, per-property, state or conditional
binding. It admits background, text and border color only on one ordinary root.
It refuses interaction states, nested anatomy, component/shape/icon/meter/repeat
roots, outside-layout strokes, overrides and other channels. This is an optional
schema field; existing contracts and their generated output keep their meaning.

The shared source fuser can carry an observed pair through this table instead
of returning an overflow. D.95 still names every unsupported binding and stops
native preparation. CSS Modules, inline React, static CSS, shadow CSS and the
native compiler use the same tuple semantics. Resource scoping rewrites all
row references, and canvas projection removes entire tuples when it narrows a
domain. A runtime `null`, `false` or `0` mapped to a named enum value stays
distinct from omission.

The first return probe exposed a real defect: emitted native fills were correct
but their identities disappeared from the proposed contract. Native inversion
now retains the actual bound references when complete observations prove a
function of two corroborated optional axes; independent extra axes must be fully
observed. Root text hoisting retains the same identity table. The proposal
refuses an unsupported final table rather than emitting one that the shared
referee cannot carry. Missing tuples, duplicate observations, missing omission
metadata, unbound paint and unexplained paint opacity cannot certify a lossless
table.

Bounded browser tests exercise all nine set/omitted combinations, repeated
transitions, typed mappings, and the actual static/shadow stylesheets. The emitted
native program and canonical dump preserve the nine references and unchanged
repeat. Native edits override the original binding; equal-color variables keep
their distinct identities. A 27-variant probe verifies an independent third
axis and refuses a paint that depends on all three. These are compiler and
browser proofs, not complete live application acceptance.

A fresh unchanged DaisyUI source trace matches both representatives and restores
all 100 observed combinations per case. Through the application, operation
`12d70613-cd2a-4543-958a-6d9926a20852` creates 100 painted native mains in
Evaluations set `89:2590` and 153 variables. Independent readbacks pass. Separate
caller operation `e607320a-2c9c-4654-a9d9-a1e9acedf378` creates instance `89:2609`
with visible purple fill, border and editable “New” text. Its native width is
**51.01599884033203 px**, versus the unchanged source's **49.921875 px**; both
heights are 20 px. The original text advances 29.92 px while the native text box
is 31 px. This remains a fidelity gap. No sample extent, font or tolerance was
changed to hide it. The prior 71 page identities/top-level child lists, 1,352
variable records and 49 collection records remain unchanged in the captured
inventory fields; that inventory does not certify every historical deep node.

The canonical native return first refused the omitted/outline tuple because
the new inverse admitted only opaque paints. Figma represents a solid paint's
alpha in its [opacity field](https://developers.figma.com/docs/plugins/api/Paint/).
The corrected shared check admits the bound reference only when paint opacity
equals the captured variable's alpha exactly or its float32 representation.
A full capture's variable layer is authoritative; missing entries refuse. A
set-only caller may supply an explicit token corpus instead. Separate opacity
changes and alpha values lost by capture quantization remain unsupported.
The retained capture now imports through the application with 20 color/variant
tuples for background and border. Repeating the import keeps the identical
contract and one workspace entry; repeated archive preparation produces
byte-identical packages. An isolated consumer installs the app-delivered
archive unchanged and matches captured background, border and height through
all 100 runtime combinations, including omission and caller-text replacement.
Its empty slots contain no text-color or typography bindings to return. With
the original Inter asset loaded at the host's 16 px default, the returned
primary is 54.1875 × 20 px and the small secondary is 50.1875 × 16 px; both
inherit black text. The source cases use 14 px and 12 px text, respectively.
The first review harness had a broken font URL; that failed instrument and its
measurements are preserved separately, and the corrected run requires a loaded
font before measuring. Visible fidelity and the complete returned React journey
remain unqualified. Evidence is retained in
`joint-optional-token-bindings-20260920/` and
`daisyui-source-intake-20260920/`.

A live adversarial edit changes the primary main's bound fill opacity from 1
to 0.5 without changing its variable reference. The canonical capture of that
edit is refused by the application. Restoring the paint restores the exact
original PNG bytes, native caller dimensions and successful app import. This
proves the bounded opacity refusal and restoration; it does not qualify general
native update synchronization.

**AGENT decision — selected variable modes, 2026-09-21.** A live four-swatch
control shares one bound color between two mains. Changing only the second
main's collection mode changes its drawn color from `#141e28` to `#c80ab4`,
while the current canonical dump still gives that variable one default value.
Before this correction, both captures produced the same accepted joint paint
table. The inverse now refuses a joint table whose referenced captured colors
have differing or unavailable mode values with
`FIGMA_JOINT_PAINT_MODE_UNCORROBORATED`. Identical captured mode values remain
supported. The check runs before simplifying repeated bindings into a single
reference or axis, so rebinding rows cannot hide the same uncertainty. Raw mode
evidence cannot be erased by an explicit value index.
This conservative refusal also applies when all observed consumers happen to
use the base mode: the capture does not corroborate their individual choices.
Set-only callers must supply known mode conflicts alongside their corpus.
The actual application accepts the prior single-mode capture, then refuses
the captured mode-change control while preserving the editor contract byte for
byte. Its earlier accepted, incorrect import remains separate evidence.
The probe's original binding, mode and PNG were restored exactly; the new
page, IDs, failed first fixture setup and both captures remain in
`joint-paint-mode-review-20260921/`. Revisit this refusal only when the capture
and inverse preserve each consuming mode, including aliases and theme
interactions. Removing it without that evidence repeats the measured loss.

A same-tab reload retains both saved Workspace entries but returns the editor
to its default example. Manually selecting the saved import restores identical
contract bytes and all 58 captured tokens. React archive preparation succeeds
and the downloaded archive is byte-identical to the installed package above;
there are still two Workspace entries and no source reimport. The measured
receipt and inspected screenshot are in
`joint-paint-mode-review-20260921/recovery-result-v1.json` and
`recovery-restored-v1.png`. A separate fresh-tab check shows no saved imports,
while the original tab retains both entries and identical contract bytes
(`fresh-tab-result-v1.json`). Workspace storage is scoped to one tab; cross-tab
recovery is unavailable. These observations do not prove browser-restart
recovery or automatic editor selection restoration. Fidelity remains unqualified.

To reverse, remove the optional schema field, shared resolver/referee, fuser and
inverse admission, and all emitter/resource consumers together; restore the
D.95 overflow expectation for these pairs. Preserve the failed native run,
return regression and all journals. Do not widen fidelity thresholds or collapse
omission into an invented default to obtain a pass.

## D.98 Native capture records the consuming variable mode

**AGENT decision, 2026-09-21.** Plugin dump 1.42 records each resolved binding's
variable ID, collection, inherited consuming mode, native resolved value and raw
selected mode value on its consuming node. It preserves float32 color channels
and numeric precision. Missing or invalid consuming evidence produces
`variable-consumer-unresolved`; it does not substitute the collection's first
mode. A selected alias edge is recorded, but this is not a complete alias graph
or proof that a theme can be inverted without loss. The existing global variable
table and D.97 conservative mode refusal remain unchanged.

Both readers now capture a uniform native line-height variable binding. It
overrides a conflicting legacy emitter stamp with `text-binding-conflict`.
Mixed, malformed or unresolved native bindings name the loss and do not reuse
the stamp. Unbound text keeps the legacy fallback. REST dump 1.41 retains the
binding name when variable metadata is available; it does not capture inherited
consumer modes or claim `resolveForConsumer` evidence.

The retained Evaluations hidden-text probe has Small and Large mains using the
same three variable IDs. The new canonical capture matches the independent
native readback: 12/20 px font size, 18/28 px line height, and distinct native
color values, with inherited mode selections and no explicit TEXT modes. Six
consumer records are captured without degradations or node changes. Unit
controls cover alias targets in another collection, native precision, missing
and unreadable mode evidence, non-finite values, and stamp conflicts. Evidence
is retained in `native-text-consumers-20260921/`.
Root-slot readback accepts the new evidence field while retaining its existing
content, layout, paint and behavior guards. The initial metadata rejection and
the corrected flex/grid readback checks are preserved in that journal.

This capture improvement alone does not preserve root typography through the
return journey. D.99 describes the subsequent bounded template projection and
its remaining application gaps. Neither qualifies the second-library journey
or V1.
To reverse, remove the additive consumer records and native line-height capture
together with their tests, regenerate the embedded dump and plugin receipt, and
rederive sync baselines under an explicitly new grammar. Preserve live journals
and the previous failed consumer; never relabel old evidence as a new capture.

## D.99 Native root text templates still need an application journey

Native fidelity remains unqualified. The live application caller measures
**8.4314%** against the unchanged 5% limit. Color-only template updates now pass
through the application, including conflict refusal, exact reverse and a live
delivery interruption before `begin` followed by canvas settlement and an explicit
fresh write. The current [acceptance ledger](CURRENT.md#v1-acceptance-evidence-2026-09-21)
records that bounded evidence. Geometry-affecting updates, broader recovery cases
and full visual qualification remain open. The following creation and return
evidence does not qualify those gaps.

**AGENT decision, integration review 2026-09-21:** when multiple typography
properties share one source token, each observed property must match its
independently captured consuming value, exactly or as float32. Review reproduced
an accepted line-height contradiction because the previous guard checked only
the font-size field for that shared token. The same canonical capture now
preserves the valid shared reference and refuses either field's independent
drift. The before/after checks remain in private
`native-template-integration-20260921/`. Reversing this guard must also refuse
shared typography references until every consuming channel can be corroborated;
checking one property cannot establish the others. No fidelity threshold changed.

The application source adapter now derives the explicit
`slot.bindings.figma.textTemplate` marker from newly captured direct caller text.
Fresh observation `a34b7769-50af-4c36-94b1-03dac7eac993` matches both unchanged
source cases, authenticating 200 property planes and 418 sealed files. Application
operation `0bab5d79-eb95-45fb-92f5-5820fbdc43c4` creates 100 mains, 153 source
variables and 54 routing variables in Evaluations; separate token and component
readbacks verify the complete graph and all 302 native nodes. The plugin was
closed and the complete canvas inspected. The main set is `90:4384`, on page
`90:4083`; allocation IDs, independent review and screenshots remain in private
`native-root-text-template-20260921/app-graph-review-v1.json` and neighboring files.
The connection needed an explicit second paste into the native field; the same
operation resumed without allocating a second family.
Repeating preparation afterward reuses that operation: all 37 existing operation
and plan files remain byte-identical, event counts do not change, and the app
offers inspection rather than another creation.

The reusable mains retain empty editable content. Application comparison
`4555d258-9f47-4fc3-a417-d6dd5d2f19da` creates a separate primary/omitted-size/
omitted-variant caller on page `90:4401`, instance `90:4403`, using main
`90:4264`. Independent readback verifies its editable text and unchanged parent
graph; the closed-plugin canvas was inspected. Its native width is
51.01599884033203 px against 49.921875 px in the source, with both heights 20 px.
The original scorer reports 8.4314%; the recorded-origin diagnostic uses a
different denominator and retains five mismatching pixels outside text. It is
not a replacement pass. The app measures source text advance at 29.92 px and
native text box width at 31 px. Read-only font inspection finds different
variation-axis sets despite the same Inter family name; exact native font bytes
are not established, and that difference does not explain away the geometry or
outside-text residual. No source font or threshold was changed. Evidence remains
in private `native-root-text-template-20260921/app-caller-v1/`.

The same native family returns through canonical capture 1.45 and the app's
JSON import. Its proposed contract and archive input match an independent
inverse, preserving 400 original typography references and 500 explicit fields
across 100 variants. Both legacy unresolved carrier-mode notes remain visible.
The downloaded archive installs in an isolated consumer with all ten package
files byte-identical. With the original source font supplied by the host, all
100 combinations match the original React width, height, font size, weight,
line height, tracking, paint, padding, border width and four corner radii.
Changing caller text changes all 100 labels and widths; the visible selected
variant also changes typography and paint. This compares returned React with
original React, not with the failing native caller. The archive SHA-256 is
`93a0a1c077e6e53220ab45882ae607a5712c15bb48fb17b5735cc983b1d3b813`;
private evidence includes `app-graph-inverse-v3.json`,
`app-consumer-v1/verification-v2.json` and the inspected consumer screenshot.
Lossless pixel comparison now passes **100/100** on white at the unchanged 5%
limit, using the existing application source-validation PNG capture and scorer.
Maximum antialiasing-aware difference is **0%**; exact-pixel difference reaches
**29.3860%**. All 100 origins and dimensions agree, and each network-isolated
replay PNG is byte-identical. The original font asset is supplied by the host;
the package remains unchanged. This measures returned React against original
React and does not qualify the failing native caller.

Two declared cohorts of fifty retain all combinations within the declaration's
existing case cap. The first family-only readiness reports remain archived at
**0/50 qualified**: their missing-font control could not distinguish local
Inter fallback. Fresh reports with the explicit web-font witness now pass
**50/50 each**, with all five corruption controls rejected per representative
([D.101](#d101-web-font-witnesses-reject-same-family-system-fallback)). All 200
source/replay PNGs are byte-identical to the previously scored images, and
all 100 dimensions and painted-font origin witnesses pass. The unchanged pixel
report and earlier refusal remain in `app-consumer-v1/visual-score-v2.json`
and `app-consumer-v1/source-validation-v1/`; the new verified receipt is
`app-consumer-v1/source-validation-v2/cohort-readiness-receipt-v1.json`.
The visible review includes all pairs and the current readiness result.
Earlier browser screenshot interfaces returned JPEG data; their failed
measurement remains in `app-consumer-v1/visual-measurement-refusal-v2.json`.

Reloading the same tab retains one Workspace entry. Manually restoring it and
preparing the library again produces identical contract and archive bytes.
One earlier import with Preview selected accepted the contract, then stalled
during an attempt to clear its 2.6 MB raw textarea; reload and close commands
also failed. A fresh tab in the same browser, with React output selected before
import and the raw input subsequently hidden, completed the return. The cause
of the earlier stall remains unresolved; Preview itself renders and remains
responsive after restoring the saved import. This intervention is recorded in
`app-return-recovery-v1.json`; it does not qualify interrupted native recovery,
cross-tab or browser-restart recovery. Template updates, composed graphs,
states and complete family fidelity remain unqualified.

**AGENT decision, 2026-09-21.** Property capture version two records each full-page
image's measured bounds and digest, including fractional origins, and requires
the bounds to restore after every probe. It rechecks bounds alongside the tree
and image before sealing a plane. Older archives keep their original capture
and compilation; the adapter never backfills an origin or infers a template
marker for them. New complete single-property or matrix observations may add
the marker only for one direct caller text run with authenticated painted-font
evidence and typography accepted by the shared compiler. Nested caller elements,
pseudo content and unsupported typography retain named limitations. Original
caller text remains absent from the reusable main.

The candidate operation host pins the complete graph in its plan, persists all
returned allocation IDs before a separate graph read, and provides a component
writer context only after that read verifies the source and every selector and
route. Component observation retains the graph input and identities for later
comparisons. The real companion client has exercised all four phases with a
native API mock and journal restarts; repeated preparation reuses its reservation
and changed routing refuses. Partial allocations remain in their immutable
events and cannot be blindly retried or exposed as verified contexts. Graph
sizing inspections, updates and interrupted component recovery remain refused.
The live application run above exercises those four phases with the actual
companion. The mock interruption probes do not qualify native recovery or visual
fidelity. Reversal: remove version-two template admission and the optional graph branch of the
React plan and operation host; preserve existing operation journals and images.

**AGENT decision, 2026-09-21.** An explicit template marker is admitted only for
one hidden empty TEXT inside the root SLOT, with complete bound font size,
weight, line height and color. Family, slant, tracking, case and alignment must
remain invariant. The scoped writer retains the original source variables and
adds four shared aliases whose targets are selected by the main's native mode.
It deduplicates identical binding tuples, never merely equal values. This rule
replaces a failed live projection: separate bindings on each main left edited
slot text using its former variant's typography. Unscoped writers now refuse
the marker before allocation. Unsupported mode capacity retains the partial
allocation identities rather than reporting a successful write.
The admitted projection selects variants inside one collection. Large source
matrices can therefore exceed the file's available mode capacity. A separate
experimental graph transport factors source-binding tuples across two-mode
selector collections. It retains source aliases and identities, requires the
complete selector vector for each public variant, and refuses unobserved binary
addresses. Generated creation and separate ID-based readback have been checked
in Evaluations for 31 source variables, seven selectors and 54 routing variables;
an unchanged rerun refuses before allocation. Source and routing picker scopes
are derived from their text consumers. Variable allocation remains separate from
component creation. The factored graph now participates in the bounded
application operation above; repairs and updates remain refused.
Independent operation scopes can use the same compiler alias names in separate
collections. A second native allocation and separate readback preserve the first
graph exactly; names never authorize adopting or updating existing variables.

A subsequent candidate uses the shared component renderer with a separately
verified graph receipt. The engine re-derives the graph from the fresh contract
and original token tree; supplied component data or a graph hash grants no write
authority. Root and text consumers determine picker categories, including alias
closure; unsupported binding fields refuse. Every main selects the complete
source and selector mode vector, while its SLOT and hidden TEXT inherit it.
Independent observation reads the graph before and after the node inventory and
checks identities, all routing edges, ownership, mode vectors and template
structure. A routing change during asynchronous font preflight refuses before
node allocation. Unchanged ordinary writer programs retain their bytes.

In Evaluations, candidate `10f0d730-9f43-44ae-a130-29bb74d104a7` creates 100 mains,
153 original variables, seven selectors and 54 routing variables. Independent
readback verifies all 302 native nodes; repeat refuses before allocation. The
unobstructed canvas shows the empty editable mains. Its source is the unchanged
DaisyUI observation with the template marker explicitly added for this engineering
probe. This is not application source admission or a clean consumer/fidelity
result. That engineering probe did not establish application admission; the
separate live operation above does. Updates and recovery remain unqualified.
The subsequent caller and return candidates are described below. The fresh
application font observation independently verifies 200
property planes across two cases and all 418 sealed files; it does not infer the
marker or certify native font metrics.

A graph-backed caller candidate now uses the same comparison renderer and an
independently verified parent graph. It derives the complete source and selector
vector from the public variant, proves the direct caller text and all four
bound typography values against the archived source, and edits the inherited
TEXT. No new text binding or explicit child mode replaces the main's graph.
Parent observation runs after asynchronous font loading and before the final
synchronous duplicate-page check. Missing selectors, substituted aliases, stale
parent graphs and competing pages refuse before allocation.

Live candidate `3092dfe9-075d-4ada-a5fb-1aa3d71f2e42` uses the sealed original
`New` text for the info/large/outline variant. Separate readback verifies its
five native nodes and unchanged parent graph. Switching the same instance to
primary/small/unset preserves the text and all four carrier IDs while changing
font size from 16 to 12 and line height from 24 to 16; restoration passes a fresh
independent read despite Figma assigning the text a new descendant ID. Repeat
refuses before allocation. The first image pair **fails** the existing 5% bar at
6.8503%; its native layout width is 59.01599884 against the source's computed
58.1875 px, with both heights 24 px. This is one engineering comparison, not
application admission, clean return, or family fidelity qualification. The sealed
property plane has no layout origin, so an origin-aligned score is not claimed.

**AGENT decision, 2026-09-21.** Verify every required source/selector resolved
mode and every explicit mode independently. Live Figma omits the unused caller
collection from resolved modes even when it is explicitly set on the instance;
that one unused entry may be absent, but must match when present. Extra foreign
entries, missing selectors and incorrect values refuse. Reversal: remove graph
caller admission and its `modeVector` from the caller planner, runtime and
observer. Preserve the failed image pair and original source bytes.

**AGENT decision, 2026-09-21.** Keep the original single-mode source-token identity
and authenticate routing with a separate graph receipt. Do not represent multiple
collections as one token identity or replace the shared renderer. Reversal: remove
the optional `templateGraph` context, engine graph compilation entry point and
matching observation branch; existing single-collection paths remain unchanged.

The seven-level native research graph exposed a capture gap: selected chains
were retained, but the global variable collector could not resolve two carrier
modes. Capture 1.45 adds a separate raw graph for explicit text templates across
multiple collections: complete member inventories, every raw mode value and
alias edge, and each main/SLOT/TEXT mode vector. It rereads those facts and names
a degradation instead of publishing a partial graph when they change. The
legacy global collector and its unresolved-mode notes remain intact.

The graph inverse reconstructs deterministic routing from original source
identities and public binding tuples. It checks every selector address, including
unselected edges, original alias closure and all consumer vectors, then removes
only verified routing variables from the returned token projection. Source value
edits remain design data. In the live 100-main capture, all eight collections,
207 variables and 300 consumer vectors match separate readback. The returned
contract preserves all 400 typography references and the five compared typography
fields per variant without minting replacement typography tokens. The separate
application capture, import and clean consumer described above now exercise
that bounded return; native fidelity and update qualification remain open.

**AGENT decision, 2026-09-21.** Require complete raw cross-collection evidence for
this inverse; a selected alias chain or a raised depth limit cannot prove all
routing edges. Structural inversion does not authorize updates or authenticate
a rewritten graph against an earlier operation; those require the separately
persisted host baseline. Preserve optional enum typography bindings through
`tokensByProp` for verified root text templates, including omission and equal-valued references. The first live
inverse reminted font size and line height because it discarded a verified
per-value reference function; the template typography reader now retains it.
The ordinary historical typography reader keeps its prior representation.
Expanding the new behavior to ordinary text parts also changed a frozen held-out
return's token identities and generated CSS. That broader change is outside this
template admission; its failed comparison remains recorded without rewriting
the historical fixture or adding a component-specific rule.
Reversal: remove `templateVariableGraph` capture and its inverse dispatch, and
restore the string-only stamped typography reader. Keep the earlier failed
return and image evidence.

New source property observations seal painted-font evidence on every plane and require the
original font witness to return after each probe. Matrix and single-property
assembly validate each witness against its raw tree and observation digest,
then map the actual family on a private compilation clone. Mixed evidence,
changed witnesses and default/omission family disagreements refuse. Older
archives retain their original CSS-family interpretation and cannot establish
painted-font identity for template admission. The source CSS and font bytes are
unchanged; neither this mapping nor a CSS family spelling certifies native font
metrics, font asset delivery to a clean React consumer or the fidelity limit.

Plugin capture 1.44 records numeric native weight and complete selected alias
chains up to 16 edges, including target consuming modes and native values.
Unverifiable chains name a degradation and are omitted as a whole. REST 1.42
captures weight identity without inventing consumer-mode evidence. The bounded
inverse validates all four compiler aliases, corroborates the selected edges,
and requires original source definitions to agree across modes. It restores
source token references, including original aliases, without mutating the dump.
Its source-chain limit remains 10 entries to match the existing token resolver.
The 1.42 REST grammar transition was re-observed with REST GETs: 25 current
baselines and six existing pending decisions retain their native fingerprints
and unresolved status. Historical receipts remain archived. Census regeneration
changes only named capture-note counts; its generated-code hashes are unchanged.

Caller text may use the template only when the host authenticates a direct DOM
text run and recompiles its observed content. Equal paint on a descendant
element is insufficient. The planner checks every typography channel before
the writer edits the existing template. It leaves parent mode selection on the
main, records actual slot descendants, and independently verifies inherited
bindings and modes. Nested content, measured text boxes, stale source evidence,
comparison recovery and repairs requiring template migration refuse by name.

The retained Evaluations engineering fixture uses the generated token, main,
caller and readback programs. Its caller switches Small → Large → Small:
12/20/12 px size, 18/28/18 px line height, 400/700/400 weight and red/blue/red
paint, retaining the same four binding IDs. The restored independent readback
passes, the parent remains unchanged, and a rerun refuses before duplicate
allocation. A canonical main capture produces one return proposal with the
original source references. Canvas screenshots and all operation IDs are in
`native-root-text-template-20260921/`. These are synthetic engineering probes,
not authenticated application journeys or visual-fidelity scores.

Adversarial checks run in `runtime:check` and `source:reference:check`: they
cover missing and mixed bindings, changed mode/alias identity, inconsistent
source definitions, unsafe token paths, stale direct-text evidence, altered
readbacks, mode-allocation failures and duplicate writes. Graph transport checks
also reject same-valued alias substitution, incomplete selector vectors,
unowned variables, scope drift and collisions during asynchronous preflight;
partial failures retain allocation IDs. To reverse, remove
the optional marker and its planner, scoped writer, inverse and caller support
together; restore named refusal for nonempty root slots, regenerate derived
artifacts and retain all failed and successful journals. Do not loosen the
fidelity threshold or rewrite historical receipts.

## D.100 Source capture must preserve CSS Module imports

Loading an installed React library through source inspection previously treated
its `.module.css` files as global CSS. That discarded the imported class map:
the component mounted without its styles and source validation refused it.
The loader now retains local CSS semantics while hashing the original input
bytes. Ordinary CSS remains global. The installed package is unchanged.

The application reproduced the failure using its own downloaded React archive;
after correction, the mounted component matches the original style witnesses.
The independent regression probe also covers colliding local class names,
cross-file composition, global CSS, deterministic reference identity and stale
source detection. Private evidence is in
`native-root-text-template-20260921/app-consumer-v1/source-validation-v1/`.

A family-only witness cannot distinguish fallback to a local font with the
same painted family name. Those archived references retain
`negative-control-not-proven:missing-font`. D.101 adds an explicit web-font
origin witness and demonstrates fresh passing readiness reports; neither
pixel similarity nor web origin authenticates font bytes in Figma.

**AGENT decision, 2026-09-21.** Select esbuild's `local-css` loader for
`.module.css`, preserving the byte-recording hook and all other loader rules.
This is a source-bundling correction, without a component-specific branch or
change to the scorer. Reversal: revert the loader selection and its regression
probe; preserve the failed and corrected reference archives. Existing archived
references are never rewritten.

## D.101 Web-font witnesses reject same-family system fallback

A family-name check cannot distinguish a required web font from an installed
system font with the same name. A case may now author `fontOrigin: "web"` in
its source witness. Every font that paints glyphs must match the declared family
and report `isCustomFont: true`; system, mixed or missing origin evidence refuses
with `font-substitution`. The optional witness follows the existing text target,
including a declared shadow font path or associated label. It is incompatible
with an explicit text-absence witness. Other declarations retain their original
family-only semantics and observation shape.

The application probe against the unchanged installed return now finishes
**1/1 valid**, with all five negative controls rejected. Its missing-font record
shows Inter painting three glyphs from a custom font before corruption and
Inter painting three glyphs from a system font afterward. The baseline and
isolated replay PNGs remain identical to the prior measured image. The old
family-only refusal is retained. Evidence is in private
`react-source-validations/27fc7ddeb884d3d14086a18ecfd3cca5b6ca51eab7cbbbada89f4abd782d1b5e/67408aed-771b-4642-8b9a-e3faca0e7e80/`.
The subsequent complete cohort passes **100/100**, split into two fifty-case
declarations. Both representatives reject all five corruption controls; their
font records show the same custom-to-system transition. Every before/after
source and replay observation reports Inter glyphs painted by a web font, all
root dimensions match the original, and all 200 PNGs are byte-identical to the
images already measured at 100/100 under the unchanged 5% pixel limit. Source
inputs remained unchanged during both captures. The reports and independent
hash verification are indexed in private
`native-root-text-template-20260921/app-consumer-v1/source-validation-v2/cohort-readiness-receipt-v1.json`.
This qualifies source readiness for the installed return, not native Figma
fonts, the failing native caller, or V1.

**AGENT decision, 2026-09-21.** Use Chromium's painted-font origin evidence only
when the source declaration explicitly requires web-font rendering. Preserve
the before/after font records for its missing-font control, keep absence of
evidence as a refusal, and authenticate the changed witness through the existing
reference identity. The [Chromium protocol](https://chromium.googlesource.com/devtools/devtools-frontend/+/main/third_party/blink/public/devtools_protocol/browser_protocol.json)
distinguishes custom from locally resolved fonts; this does not identify a
particular downloaded font file. No family substitution, source-font change,
scorer change or tolerance change is introduced. Reversal: remove the optional
witness, conditional observation and check, and its control evidence; retain
all archived references and failed or passing reports.

### D.102 Source repair previews check the complete recorded finite domain

**AGENT decision — 2026-09-21.** A bounded root-opacity repair can propose
exact utility-class edits in an authenticated original React declaration. The
host rebuilds its CSS in a new private workspace, then exercises every initial
state mapped to the existing native component. Exactly one candidate must
produce the requested opacity in every changed state while preserving every
other recorded tree, ownership, font, geometry and content fact. Unchanged
states must retain identical PNG bytes. Auxiliary observations authenticate
their own tree and style revisions before comparing their measured facts;
a changed class token necessarily changes those input revisions.

A fresh twelve-state source probe rejects the group-conditioned utility and
selects the disabled utility: four disabled states change opacity from 0.5 to
0.6, and eight other states preserve identical images. Original source and CSS
remain unchanged. The earlier sealed observation lacked
pseudo-box geometry and correctly refused. The fresh successor was explicitly
adopted through the application. Compiler review then refused four newly
requested number tokens; the original source, canvas and historical records
remained unchanged. D.103 addresses that allocation gap.

**Application preview shown on 2026-09-21:** after the allocation and separate
geometry corrections, four disabled variants were edited to 60% opacity through
Figma's Design UI. The app independently read exactly those four values and
prepared preview `d99ee880…`. It rejected the group-conditioned candidate and
selected `disabled:opacity-50` → `disabled:opacity-60` across all 12 states,
preserving the 8 unchanged PNGs and other recorded facts. Original files remained
unchanged. A separate engineering probe then checked all 10 configured examples:
60 finite states across 5 caller contexts, including the nested Card, plus 10
mounted interaction trials per source version; unchanged caller PNGs match.
This wider probe is not yet part of application admission. Evidence lives under
private `react-source-repair-previews/d99ee880…/` in the live app worktree and
`react-design-source-repair-20260921/cohort-render-4EkKB7/` in the repair worktree.

The preview service and UI accept only an existing source/native pair and its
current recorded design read. The host must configure relative
`DS_CONTRACTS_REACT_SOURCE_CSS_INPUT` and
`DS_CONTRACTS_REACT_SOURCE_CSS_OUTPUT` paths for a supported CSS rebuild.
Original CSS must reproduce byte for byte before staging. Source project
build scripts are not executed. Competing edits, changed inputs, incomplete
states and zero or multiple matching candidates refuse. Preview evidence is
preserved privately; after a server restart a new preview is required.

Automatic original-file application, application admission of the wider caller
and interaction checks, interrupted source-write recovery and live two-way
acceptance remain undone.
The preview offers no apply action. Reversal removes the repair routes, UI and
source-repair modules together, retaining the native design-read and source
succession journals and every failed or successful private probe.

### D.103 Additive token allocation is a separate correction

**AGENT decision, 2026-09-21.** A compiler may newly track a literal number
without changing its rendered value. An existing native draft must be able to
add that variable while retaining its original collection, modes, existing
variable IDs, component nodes and ownership metadata. Dropping requested paths
or creating another component would hide the missing update behavior.

The new allocation correction checks the whole verified component baseline and
the complete collection inventory. It supports additional literal number tokens
in one existing mode; existing token definitions, mode changes, aliases and
other token types cannot change in the same step. Its append-only collection
ledger records intent before allocation and actual IDs immediately after each
create call. Independent readback verifies the exact additions and every old
variable. Repeats of a completed allocation create nothing. Source repair stays
unavailable until a subsequent compiler review settles the remaining component
changes. This step alone does not update the component's appearance.

Bounded engine probes cover old-ID preservation, subsequent value updates,
repeated extensions, forged identity/ledger/value refusals, concurrent component
edits and interrupted allocation. An interruption before intent can retry. A
complete allocation whose final ledger stamp was interrupted can settle after
all IDs and values match. An unknown allocation, missing recorded ID or partial
value assignment refuses without creating another variable; automatic recovery
from those ambiguous states remains unqualified. No variable is deleted as
cleanup.

**Shown through the application on 2026-09-21:** correction `2a9e18cb…` added
four requested number variables to the retained twelve-state Checkbox collection
in Evaluations. Preflight, one begun write and independent readback completed
through the companion. All 46 original variable records and all 44 native node
records are unchanged; the collection now has 50 variables. Twelve native PNGs
were collected and the canvas was inspected with the companion closed. Evidence:
`private/react-design-source-repair-20260921/allocation-live-readback-v1.json`.
The separate pseudo-box correction `82a7eec0…` then moved the existing twelve
transparent hit-area shapes by 1 px on each axis. All 44 node IDs, all 50 variables
and all 12 PNGs with their export bounds are unchanged; the app independently
verified the correction and the canvas was inspected with the companion closed.
Evidence: `geometry-live-readback-v1.json` and `geometry-ui-completion-v1.json`
in the same private directory. D.102 records the subsequent source preview.
These steps do not qualify automatic source writes or V1.

Reversal removes the allocation route and writer while preserving the extended
token reader, original ownership stamps, allocation ledger and journals for
already written corrections. Never erase those records to imitate an old
allocation or reassign variables by name.

### D.104 Preview images carry immutable evidence rather than current write authority

**AGENT decision, 2026-09-21.** A live source-preview image request took 88.26 seconds
because each image re-derived the full native correction chain. A twelve-state
comparison requests 24 images. Image delivery now verifies the exact preview,
selected candidate, row and content hash without repeating that history read.
Completed preview metadata and preview preparation still reauthenticate the
source/native pair; the HTTP route also retains its original-source identity
and file checks. Running and refused progress reports are explicitly noncurrent
and do not replay history. The worker checks original source identities during
observation and reauthenticates the complete input before reporting completion.
A saved image is evidence of that preview, never current write authority.

After the change, a second application preview delivered the same 5,733-byte
image in 0.16 seconds, with the identical SHA-256. All 24 comparison images
loaded in the live application. Before/after timing receipts and the inspected
application screenshot are preserved in private
`react-design-source-repair-20260921/preview-image-{before,after}-v1.json` and
`preview-images-fixed-ui-v1.png` in the application worktree.

Bounded checks show that a changed design plan makes preview metadata stale
while its pinned image bytes remain the same, and reject different proposal
IDs, unselected candidates, invalid rows and modified image bytes. New previews
are still required after restart. Reversal restores per-image derivation without
changing any saved preview, image hash or source-write checks.

### D.105 Source repair must check the other configured callers

**AGENT decision, 2026-09-21.** An edit to a component module affects every
configured caller of that module. A matching isolated state set is insufficient.
The preview now requires a second observation of every configured example,
including examples that do not use the edited component. Module/export identity
selects the affected instances; no named-component exception is used. The
unmodified and ownership-instrumented bundles must first produce identical
trees and images in each context.

The original witnesses remain immutable. Candidate root-opacity expectations
are derived from the independently read native edit and the caller's actual
properties. Other styles, content, ownership, fonts and geometry remain exact.
Each affected instance must cover the complete recorded finite domain. For the
supported checked-control class, associated-label and Space actions must pass
in both versions and restore the original view. Missing cases, states, actions,
ambiguous property mappings, source drift and unrelated pixel changes refuse.
The observer bounds work to 64 cases, 32 affected instances and 512 observed
states across both versions.

A production-observer engineering run covers all ten configured examples,
60 initial states and ten interaction trials per source version in five caller
contexts, including the nested Card. A separate replay of the final verifier
checks all twenty saved initial-image hashes. Evidence is private
`react-design-source-repair-20260921/production-cohort-KMCPRm/verified-v2.json`
in the repair worktree. The subsequent application preview `b52cefe0…` completes
the same ten examples, sixty initial states and ten interaction trials per
version. All twenty caller images served by the application match their recorded
hashes. The caller table, changed disabled view, unchanged composed Card and
finite-state comparisons were inspected in the live app. Original module and
stylesheet hashes remain unchanged. The application receipt and screenshots are
in private `react-design-source-repair-20260921/caller-preview-live-proof-v1.json`
in the application worktree. Images are served only for the exact reviewed
preview, case, side and hash, using the D.104 evidence boundary.

This check covers configured examples and the named finite/action domain only.
It does not establish arbitrary caller coverage or authorize an original-file
write. Source/CSS transactions, witness succession, fresh canvas preconditions
and interrupted-write recovery remain unfinished. Reversal removes the cohort
observer and its preview integration together, restoring the narrower preview
limitation while preserving every saved observation and original witness.


### D.106 Original source writes need durable file recovery

**AGENT decision, 2026-09-21.** A filesystem transaction helper now retains the
selected source/CSS before and after bytes, hashes, permissions and complete
input pins before changing an original. It is not connected to an application
Apply action. It cannot approve a preview or establish canvas agreement.

Each file moves into recovery storage before the candidate is installed with
an exclusive hard link. A destination recreated by another editor is never
replaced. Immutable before/after blobs remain separate from the held originals
and installation links, which can retain concurrent edits. The journal and
lock records publish only fully written, synced bytes. Lock generations are
append-only: simultaneous recovery processes compete for one new generation
without deleting or replacing an earlier writer's lock.

Checks exercise source/CSS application, unchanged repeat, reversal, every
persisted file boundary, conflicting bytes and permissions, missing authority,
corrupted evidence, outside paths, symlinks and concurrent destination creation.
Actual child processes are killed between moving a source file and installing
its replacement, then a fresh process resumes application and rollback. A
separate two-process barrier probe proves only one abandoned-writer recovery
can acquire the next lock. An asynchronous authority callback refuses before
writing; asynchronous canvas preflight must finish before the final synchronous
assertion. All probes use disposable source fixtures, not the user's originals.

This is a recoverable sequence of file operations, not an atomic multi-file
filesystem transaction. Another reader can observe a missing file or a mixed
source/CSS version during application. Only regular files on the same filesystem
as the private journal are supported. Unexpected edits are preserved and refuse;
unknown journals or a lock owned by a live/reused process ID also refuse. Power
loss and every operating-system/filesystem combination are not qualified.
The witness succession mechanism in D.107 reopens completed transactions in
source loading. Fresh native preconditions, the original-source application UI
and independent post-write source/native verification remain unfinished. The
complete two-way journey is still unqualified.

Reversal removes the helper and its gate entry together. Preserve any existing
transaction directories, held originals, before/after blobs and lock history;
removing code must never remove recovery evidence or overwrite source files.

### D.107 Reviewed source edits need versioned validation witnesses

**AGENT decision, 2026-09-21.** An intended original-source repair must not
rewrite the frozen source witnesses or accept its new rendering as its own
independent expectation. A host-only succession store now derives the changed
root-opacity expectation from the pinned native design intent, original caller
props and the complete reviewed caller proof. Every unrelated profile field
remains exact. The original profiles and earlier source references stay intact.

The preview retains its selected stage and in-memory result revision. Its
identity now includes the original witness profiles, and its caller result pins
both complete observation sets. Preparing a successor replays the caller checks
and authenticates the stage, source/CSS transitions, initial and finite-state
images, full compiler inputs and original reference inventory. The selected CSS
must be the CSS recorded in the reviewed preview. Browser requests cannot supply
paths, profiles or executable commands to this store.

A successor enters normal source loading only through a matching completed
source-file transaction. Its provenance enters the new reference identity and
saved provenance; historical references without succession retain their exact
identity. Loading replays the proof and transaction history. It refuses an
incomplete write, changed evidence, missing ancestor or multiple unrelated
histories matching the current bytes. A reviewed reverse edit creates a new
record; a completed transaction rollback restores the earlier witnesses.

Disposable-fixture checks cover reload through the actual source-loading HTTP
handler, forward/reverse chains, repeated values, file-boundary interruption,
rollback, altered images and observations, replaced CSS pins, changed original
profiles, foreign transaction selections and conflicting histories. They also
verify that damaged evidence invalidates an already built reference. These are
engineering and HTTP integration results, not a live original-source Apply
journey. No production original has been changed through this mechanism.

The mechanism currently carries the existing bounded root-opacity repair and
its configured finite/control-action domain. It requires the retained private
evidence, supports at most 128 linked transactions per source root and grants
no fresh canvas authority. The application still needs its Apply/recovery
controller, fresh companion preflight and independent post-write source/native
validation before this closes any two-way acceptance gap. Earlier previews
without the new witness and observation pins remain historical evidence and
cannot be promoted into source-write selections.

Reversal removes the succession store, source-loading integration and its gate
entry together. Preserve all private selections, links, preview evidence and
source transaction journals. Sources already changed by an applied transaction
must be recovered or explicitly re-witnessed before removing the loader;
silently falling back to stale expectations is not a valid rollback.

### D.108 Source application requires fresh canvas reads and verified recovery

**AGENT decision, 2026-09-21.** The reviewed root-opacity preview now has an
original-source Apply controller and persistent application recovery controls.
The first live application run now changes the original Checkbox module from
`disabled:opacity-50` to `disabled:opacity-60` and regenerates its CSS. It resumes
after a host restart before the source write, using a new canvas-read attempt.
All ten configured examples pass normal source validation, and a second fresh
read verifies the unchanged 44-node Figma set. The unobstructed canvas shows the
same four disabled native variants at 60% opacity. A repeated completed Apply
request leaves all 69 source and retained operation files byte-identical.
Evidence is in `private/react-design-source-repair-20260921/live-apply-v1.json`
and `live-apply-repeat-v1.json`. Explicit restoration through the app then
restores both original files byte-for-byte, validates all ten examples again
and obtains fresh pre/post reads with the complete native snapshot unchanged.
Figma remains at the designer's 60% edit, as the recovery UI explains. That
result and the unobstructed canvas inspection are retained in
`live-apply-restore-v1.json`. D.104–D.107's earlier previews and engineering
tests remain separate evidence; these bounded results do not qualify V1.

A later live review demonstrates both conflict boundaries on the same retained
application. A non-rendering source comment added after the review was sealed
and its canvas read requested survives the resumed run: the fresh read passes,
but the file transaction refuses before writing source or CSS. After removing
only that probe, changing the four native disabled variants to 70% makes the
next fresh read refuse `react-source-apply-native-intent-changed`; both source
files stay original and the four canvas edits remain intact. Full readback
comparison finds no native change beyond those four opacity values. Evidence,
probe restoration steps and the visible refusal are retained under
`private/react-design-source-repair-20260921/live-conflict-v1/`.
Restoring the probe values to 60% lets that same application resume with another
fresh preflight, apply the reviewed source, validate all ten examples and pass
its final native read. Both refusals remain in its immutable journal.

The applied source now completes normal source succession through the app.
A fresh structure observation matches all ten examples; initial-state inspection
restores all twelve Checkbox combinations. Following the existing initial-state
operation retains its component identity. Compiler review finds the four native
literals already at float32 0.6, but the owned opacity variable still at 0.5.
The guarded correction scans 86 pages and 3,205 nodes, changes that one variable
to 0.6 and writes no component values. Independent readback retains all 44 node
snapshots, all twelve PNGs and every other variable exactly. The same 37 native
operation IDs remain; no replacement is prepared. An unchanged review reuses
the verified correction, leaving its journal and succession files unchanged.
The unobstructed canvas was inspected at 60%. Evidence is retained under
`private/react-design-source-repair-20260921/native-succession-v1/`.

A live partial-file failure now exercises the same controller. After a reviewed
60% → 70% design edit, temporarily denying writes to the source root lets the
nested module installation finish but makes the later CSS installation fail.
The app retains that refusal and shows the module as changed while CSS remains
original. Once permissions are restored, resuming the same application reads
the canvas again, keeps the already installed module and completes the CSS.
Its first source validation fails because a required capture control did not
complete; that failure remains recorded. A second explicit resume writes no
source bytes, passes all ten examples and obtains an identical full native
readback. Both installed files retain their original installation inodes and
single installation records across that validation retry.

The app then restores both pre-test source files byte-for-byte, validates all
ten examples and independently verifies the unchanged native set. Restoring
only the four temporary canvas opacity edits to 60% and reading again returns
all 44 nodes, 50 variables and twelve images exactly to the pre-test snapshot.
The app reports no remaining design changes, and the unobstructed editable
canvas was inspected. Evidence, including both failures, is retained under
`private/react-design-source-repair-20260921/partial-write-v1/`. This demonstrates
recovery from an actual partial-file IO failure; it does not demonstrate process
termination during a file replacement or remove the non-atomic write limitation.

Apply accepts only the host's current selected preview. It seals that selection,
prepares the exact source/CSS transaction and requests a new read from the
existing Sync Runner operation. The full observed content must match the
reviewed design intent and verified baseline. An old pending read is superseded
when a run starts; a cached result from before restart cannot authorize a new
source write. Recovery reads remain read-only even when original source is
partially changed, and grant no authority to the ordinary source-dependent
design reader.

After writing, the controller builds the original workspace through its normal
versioned witness loader. The application's normal browser validation must pass
every configured example and all required corruption controls for that exact
reference. A second fresh canvas read, unchanged source inputs and retained
validation evidence are required before completion. The source record persists
independently of the old reference, so recovery remains accessible after reload
or an interrupted file replacement. A closed service stops its pending run;
run identities prevent its late completion from changing a newer run's journal.
Completed historical records remain identified as previously completed when
a later source change stops matching their result. That history is separate
from current verification and grants no new write authority. During a running
operation, displayed file states are explicitly the latest checked states;
the transaction checks again before writing.

The first live run exposed a clipboard wait that left recovery controls busy.
Connection preparation now finishes before the separate copy action, with a
masked field for ordinary keyboard copying. Pairing authenticates the retained
journal without recompiling source history; start and native write delivery
still perform their existing source checks. Pairing alone cannot authorize a
write. This also lets a partially changed source reconnect for read-only recovery.

Engineering checks cover apply, unchanged repeat, source restoration, partial
file recovery, changed source and canvas, wrong-reference or incomplete
validation, changed retained evidence, unavailable companions and request bodies
attempting to supply paths or programs. These checks use disposable sources.
The controller does not qualify the entire two-way journey, arbitrary CSS or
callers outside the preview's recorded domain.

**AGENT decision, 2026-09-21 — source directory revalidation.** A disposable
filesystem probe redirected the selected source directory to an unselected
directory between transaction inspection and file replacement. The earlier
implementation wrote there before its later check refused. Apply and restoration
now recheck the real source, destination parent and recovery directory immediately
around replacement writes. The same probe now refuses before changing the
redirected destination, and restoring the original directory lets the retained
transaction resume. Both directions are checked before moving the source and
after retaining it. These checks do not make path-based filesystem operations
atomic. Evidence is retained in
`private/source-preview-integration-20260921/directory-race-before-v1.log` and
`directory-race-after-v1.log`. Reversal must retain these refusal and recovery
cases or replace the checks with an equally restrictive filesystem mechanism;
removing the checks alone reintroduces the demonstrated write defect.

Restoring source restores the selected module and CSS only; it leaves the
reviewed Figma design unchanged. It requires another canvas read and validates
the restored original. Source and Figma are not locked together, so a later
design edit can invalidate agreement. File replacement retains D.106's
non-atomic multi-file limitation. Unexpected source edits refuse without being
overwritten. Missing preview or transaction proof refuses; stale validation
evidence requires verification again. The measured normal succession retains
the existing component and closes this bounded source-application loop. Broader
repair channels remain unqualified. The demonstrated host interruption precedes
the write; the separate partial-file failure and recovery above are now live
evidence. Termination during file replacement remains unmeasured.

Reversal removes the Apply endpoints, recovery UI and controller together.
Keep the source transaction helper and witness loader for already applied
changes until those sources have been recovered or explicitly re-witnessed.
Never remove private journals, selections, held files or validation evidence.

## D.109 Observed child content remains provisional

**AGENT decision, 2026-09-21.** A REST import can retain a bounded static
FRAME/GROUP/TEXT subtree observed inside an unresolved child instance, even when
the authored child definition is empty. The content stays in a separate draft
child contract. It does not become parent anatomy or establish the complete
child API. Only the observed applied variant values are admitted; unobserved
variants remain unknown.

Every use of that child identity in the imported batch must have matching
captured content and matching exact anatomy/token projections. Missing or
conflicting observations, dynamic text bindings, mutable exposed properties,
nested instances, additional projected API, unresolved values, or observations
exceeding 128 nodes or depth 8 keep the geometry-only stub and produce a named
`observed-instance-content-refused` note. Existing real child definitions retain
priority. Reimport can refresh an older provisional stub. Authoritative VARIANT
types keep string boolean spellings as enum values. The additive optional
`instanceContent` field is REST-only; plugin dumps do not provide it. Admission uses
the field's presence; older dumps keep the geometry-only path.

The fresh Altitude Tabs installed React consumer now renders two body-copy lines
that the previous empty stub lost. It still fails the unchanged 5% black-background
fidelity limit, loses the active tab appearance and the stretch variant's visible
effect, and has a measured content-width mismatch. The authored Text Passage set
is still empty, and its unobserved width variant is not recovered. The running
application now imports the captured family through its JSON file chooser,
shows both body-copy lines, and prepares a seven-component React package. The
clean consumer installs an archive byte-identical to that application download,
without repository source paths. It reproduces the same failures. This does not
qualify interactive Tabs behavior, the independent-family requirement, or V1.

`core/observed-instance-content.test.ts` covers later-host content conflicts,
missing observations, mutable API refusal, typography/paint/visibility drift,
static bounds, real-child precedence, a forged narrowed census, and session
stub refresh. The review caught and fixed an exposed TEXT control being turned
into inert content. Original failures and fresh consumer evidence are retained
in `private/observed-instance-content-20260921/`; the application import, package
identity and consumer failures are retained in
`private/observed-content-app-20260921/app-delivery-v1.json`.

To reverse, remove the optional REST observation and its provisional projection
route together, returning unresolved children to geometry-only stubs. Preserve
the captured source, failure receipts and consumer comparisons. Do not relabel
observed usage content as a complete child definition or change fidelity limits.

## D.110 Repeated items retain known child enum choices

**AGENT decision, 2026-09-21.** A repeated collection may carry a typed enum
field when the referenced child contract supplies that enum's domain and design
binding. The proposer canonicalizes observed design labels, validates every
item against the child domain, and records canonical choices in `repeat.sample`.
React exposes a string union and applies the child's code-value binding for
each item. The inline React and maintained Web Components emitter types accept
the same additive schema. Static projections continue to render the observed
sample; there is no new native list-of-records property or inferred interaction.

An unmappable choice or a choice changing across parent variants prevents the
collection collapse and retains individual child instances for existing prop
threading. Repeated siblings must also agree on captured child identity across
their occurrences. A shared display name cannot override different captured
keys. Older observations with no identity retain their existing name fallback.
Schema validation rejects enum fields outside the child's domain and samples
outside the field's declared choices. Scalar repeat fields retain their prior
behavior.

The fresh CLI-generated Tabs consumer restores the first tab's active underline
and text styling. Its default black-background difference decreases from 6.24%
to **5.24%**, and stretch measures **5.78%**. Both still fail the unchanged 5%
limit. Stretch remains visually discarded, and default content width remains
441 px against 438 px in Figma. Both source PNGs are byte-identical to those used
before the change. Supplied consumer fonts still lack a verified source-font
byte identity. The application now imports the same captured family through its
JSON file chooser, displays the active underline and body content, and prepares
the seven-component React package. The clean consumer installs an archive
byte-identical to that download and reproduces the same failures. This result
does not qualify interaction, the independent-family requirement, or V1.

`core/repeated-enum-fields.test.ts` covers canonical labels, code-value aliases
in rendered React, invalid fields/samples, parent-dependent choices, unknown
labels and same-name identity conflicts. The identity probe failed before the
guard and passed afterward. The existing repeat check exercises all maintained
surfaces. Original failures and the installed consumer evidence remain in
`private/observed-instance-content-20260921/`, including `consumer-enum-v1/`.
Application delivery and the installed package identity are recorded separately
in `private/observed-content-app-20260921/enum-app-delivery-v1.json`. Integration
required restarting the development server after its engine receipt changed
and opening a fresh tab after the earlier tab retained a connection error.

To reverse, remove enum fields from the array schema, proposer, validator and
emitter type projections together. Restore named refusal of unsupported
per-item enum choices and preserve all comparison evidence. Do not strip
existing enum fields from saved contracts without reporting the incompatibility.


## D.111 Primary-axis fill can vary with a prop

**AGENT decision, 2026-09-21.** Primary-axis fill is item placement owned by
its parent. The proposer reads each occurrence against that occurrence's parent
direction. Complete enum-correlated differences become `layoutByProp.grow` on
ordinary parts, slots and generated child instances, including repeated items.
A filling default remains an explicit variant entry; other variants retain
their intrinsic size. Siblings with different placement observations remain
individual references. Unknown parent directions, uncorrelated observations,
a conflicting layout axis and out-of-flow placement keep named refusals.

The additive `growBasis: "zero"` fact distinguishes equal Figma fill allocation
from existing contracts' content-basis growth. New captured primary-axis fill
carries it with `grow: true`. React, inline React and HTML emit `flex: 1 1 0px`;
the maintained Web Components projection applies it to the child host. Existing
contracts with no basis keep their previous CSS. Native compilation resolves
growth per variant before building each frame or instance. A legacy content
basis still has no separate native ratio representation; this change does not
qualify that historical approximation or arbitrary CSS flex shorthand.

Placement on a child reference requires an ordinary generated single root.
Retained runtimes, multiple roots, style/className API collisions and existing
placement wrappers refuse. Zero-basis placement also refuses competing minimum
size and flex declarations, preserving those facts rather than overriding them.
Grid children, overlays and whole-pixel text boxes retain their existing
conflict guards for the new per-variant channel. Component internals remain
owned by the child contract.

`core/variant-primary-fill.test.ts` checks real generated React and inline React:
three intrinsically different labels occupy equal 200 px shares of a 600 px
parent along either row or column, then return to their exact original sizes. It also checks native
instance specifications, default variants, optional boolean selectors, differing
sibling placement and refusals. These are engineering probes; they do not
establish a live Figma or application outcome. The original captured Tabs family
and successive consumer comparisons remain in
`private/variant-primary-fill-20260921/`. The corrected CLI consumer now responds
to Stretch; the discarded-variant failure is gone. The app then imported the
unchanged captured family, visibly rendered its content and equal Stretch
allocation, and prepared the seven-component archive. An isolated consumer
installed byte-identical archive bytes and reproduced the CLI result: default
black difference **5.24%**, Stretch **5.36%**, and a 441 px root against 439 px
in Figma. These failed measurements used supplied Public Sans 2.001. A later
controlled font-input check, with the same package, passes both image pairs
and exact root dimensions; see D.112 for selection evidence and its limits.
Application delivery is recorded in private
`observed-content-app-20260921/grow-app-delivery-v1.json`. Interactive Tabs
behavior and live native execution of this placement rule remain unqualified.
No threshold, scorer, source asset or protected evidence is changed.

To reverse, remove the optional placement fields, their proposer carriage and
all emitter projections together, restoring named refusal of partial fill.
Reject saved contracts using the removed fields by name. Preserve the recorded
failed and corrected consumers; do not silently drop the explicit zero basis
or reinterpret older contracts.

## D.112 Font names do not identify font bytes

**AGENT decision, 2026-09-21.** A consumer may explicitly supply fonts selected
from independently captured source names and weights. Selection must be recorded
before scoring. A lower image difference cannot select the font or authenticate
the bytes Figma used. Keep every earlier measurement and report the supplied
assets as inputs, including their hashes and the remaining identity uncertainty.

The Tabs source REST observation names PublicSans-Regular (400),
PublicSans-Medium (500) and PublicSans-SemiBold (600). The locally installed
static files match those three PostScript names and weights and report version
1.007. The earlier consumer used a variable Public Sans 2.001 asset. REST does
not expose the source font version or bytes. Exactly the three matching static
files were selected and hashed before the new run; no score-based font search
was performed.

The same application-generated archive, SHA-256
`8825be77486fb6fbe5ff011111e8b6104c8db07747d4ef336ebb7ecca7e58023`, installs
unchanged in a clean consumer with these explicitly supplied fonts. Default
measures **0.4142% white / 3.7404% black**; Stretch measures
**0.0155% white / 3.3392% black**. Both pairs pass the unchanged 5% limit with
recorded origins and a common unmasked crop. Both root boxes match Figma
exactly at **439 × 176 px**. The default's nonzero-alpha content width still
differs by one pixel (439 versus 438); exact pixel identity is not claimed.
Stretch changes geometry, and the array-content probe renders all three items.
Native PNGs and the captured file version are identical to the prior failed run;
the generated package and scorer are unchanged.

This is a bounded macOS consumer result for two captured appearances. It does
not qualify keyboard interaction, tab-panel switching, accessibility, instance
swaps, Linux rendering, source-font byte identity, live native placement or the
complete independent-family journey. No other component's failing score is
superseded by this result. Raw source metadata, the pre-measurement selection,
hashed font manifest, failed and successful receipts, and visible comparisons
remain in private `tabs-font-provenance-20260921-v1/` and
`tabs-font-review-20260921-v1/`.

To reverse the consumer input choice, rerun the same archive with the preserved
2.001 manifest and keep the new receipt separately. Do not change generated CSS,
source designs, image framing or the scorer to imitate the alternate font.
If the source's actual font bytes later become available, compare their hashes
and create a fresh measurement; never rewrite these receipts as authenticated
source-font evidence.

A separate check of the final app-delivered standalone Tab archive
(`5866d6e8…627d508`) selected its two source-named static faces before scoring.
All ten source PNGs and package bytes remain unchanged. The new consumer still
passes only **8/10** image pairs: unselected rest and pressed remain at
**12.5641% black**, with exact root dimensions. The changed font inputs alter
glyph pixels but do not resolve this failure. The earlier static-font probe
used an older package and remains preserved separately. Evidence is in private
`tab-font-provenance-20260921-v1/`; this result rules out the specific supplied
font-version substitution as a fix, not every possible font or shaping cause.

## D.113 A larger caller inventory needs a larger observation

**AGENT decision, 2026-09-21.** A template update's independent reader covers
exactly the caller operations recorded in its proposal. Adding another caller
cannot make that old reader current for the larger inventory. A fresh caller
journal revision for the same members may still be verified by another read;
a change in membership requires a new proposal containing every current caller.
When source values are unchanged, this successor performs no variable writes
but still requires combined preflight and independent observation.

A regression created and observed a second native caller against an updated
parent using the production compiler and readers in the simulated native host.
Before this guard, re-reading the original update incorrectly restored
`sourceCurrent` even though its reader did not contain the new caller. The
guard now refuses that authority with
`native-update-template-consumer-inventory-refresh-required`. A new proposal
includes both callers, verifies without another value assignment, survives
journal restart, and carries both callers through the reverse update. A local
edit on the added caller refuses its combined preflight before any write.
Original proposals, programs and observations remain historical evidence.

This is a host lifecycle regression proof, not a live application birth proof.
The application still needs authenticated caller preparation after a source
succession, safe creation and restart, and a visible combined verification.
It does not qualify native pixels, arbitrary instances or full V1 recovery.
Evidence: `source-reference/native-template-app-update.test.ts` and private
`native-template-app-integration-20260921/caller-inventory-*.log`.

To replace this rule, provide an independently verified reader that covers the
entire new inventory with exact source, parent and caller pins. Preserve the
old proposal and journal bytes. Removing the membership check or marking the
old reader with a newer inventory revision is not an equivalent observation.

## D.114 A new caller pins the verified parent update

**AGENT decision, 2026-09-21.** New root-text callers after a source succession
use a versioned request containing the effective source, the parent's latest
verified update proposal and the exact parent observation revision. Their
content inspection has its own source-derived scope. Historical requests and
content pointers are retained. Existing cases reuse their saved operation;
another source revision cannot silently replace that operation.

During this caller's preparation and creation, only its own new journal may
be excluded when reauthenticating the preceding parent update. That journal is
still fully validated and must contain the matching versioned parent pin and
compiled observation. Every other caller remains in the inventory. A forged
pin, an unrelated pending caller, an already-recorded caller, changed source,
or a superseded parent update cannot use this creation scope. Ordinary update
planning and verification never exclude the new caller. After its independent
observation, D.113 requires a combined successor covering the larger inventory.

A verified parent read cannot be replaced while its caller inventory is
unavailable: the pending caller still needs that evidence to finish. Reads for
unknown-write recovery retain their existing path. The application reports
`native-update-caller-context-unavailable-before-refresh` and leaves the
verified journal intact until caller inspection is complete or recovered.

The simulated native journal test covers creation after a color update,
restart after token allocation, repeat operation selection, independent caller
observation and the combined successor. It also probes forged pins, unknown
and previously recorded caller IDs, a corrupt current caller event, competing
caller preparation and parent refresh during creation. These are lifecycle
tests, not evidence of live geometry, fidelity or complete V1 recovery. Live
application qualification remains pending.

To reverse this decision, stop admitting new version-4 comparison requests and
retain every existing operation, program and observation as historical data.
Do not reinterpret them as version-3 requests or relax normal inventory checks.
An alternative must demonstrate creation, restart, conflicts and subsequent
combined updates with the same complete evidence and immutable history.

## D.115 Caller source succession preserves the main's original provenance

**AGENT decision, 2026-09-21.** A live post-update caller preparation refused
`native-contract-comparison-source-changed` before publishing an operation or
issuing a native command. The current caller source had advanced, while the
retained main correctly kept its original source projection. The first journal
fixture changed token values and request pins without changing the source
revision and program hash; advancing those too reproduces the live refusal.

Version-4 callers now carry a separate source-succession record: the verified
parent proposal, the hash of its exact input and independent observation, and
the current caller source. The host authenticates the written update chain,
effective source and complete caller inventory before deriving this record.
The compiler checks its shape, source equality, exact parent observation and
bounded root-text-template scope. The new caller records the current source;
the retained main keeps its original projection. This record alone does not
authenticate a proposal: only the host's verified update path grants authority.
HTTP callers cannot supply it. Nested compositions remain outside this scope.

The stronger journal regression covers changed source revision and program,
creation, restart, independent observation and the next combined update. Missing
or changed proof, mismatched source, altered parent, malformed proposal, unknown
fields and unsupported scope refuse. The failed live run preserves all 161
prior evidence files and creates no new caller operation.

The application subsequently created caller `fda385a6…` against the verified
updated source. Its independent read passed supported comparison structure:
instance `103:4999` retains main `98:4808`, with a native slot and text layer.
All 161 earlier evidence files stayed byte-identical. With the plugin closed,
the canvas showed the blue caller; editing its text and restoring `New` showed
native text editability. A subsequent app-dispatched combined update
`89d54a3d…` passed preflight, returned a no-op with no variable assignments and
completed its independent read. It covers both the original caller and the
new one: all 302 main records, 100 main images, both caller records and images,
and 180 prior evidence files remain unchanged. With the companion closed, the
restored `New` text was inspected on the unobstructed canvas. After a restart,
the app visibly reports the combined correction as verified for current inputs
and both callers. The newer caller's creation row initially reported unavailable
source evidence after its birth update became historical. Caller rows now name
their current parent correction only when that settled, current, unsuperseded
verification includes the caller. Original creation exports remain historical;
image presence alone never establishes current verification. An unchanged
compiler review through the app now reuses this verified correction and leaves
all 1,535 retained journal files unchanged, with no new proposal, operation or
native write. Private evidence is
`private/native-template-app-integration-20260921/combined-callers-verified-v1.json`,
`combined-callers-canvas-v1.json`, `combined-callers-app-v1.json` and
`combined-repeat-verified-v1.json`.

A subsequent real source update `12873186…` now completes preflight, an explicit
begin, 11 intended color assignments and independent readback across both callers.
All 302 main records, variables, graph receipt and 100 main images restore the
preserved purple baseline. Both caller images match the original purple pixels;
the new caller retains its own variables and every non-paint record. Comparing
against the preceding blue read identifies only resolved paint changes: 20 main
nodes and two nodes in each caller, with all node identities retained. All 1,535
earlier files stay byte-identical. The application shows current verification,
and both purple instances were inspected with the companion closed. Evidence:
`combined-purple-verified-v2.json`, `combined-purple-changed-nodes-v1.json` and
`combined-purple-visible-v1.json` in the same private directory.

The journal spans 684.06 seconds from preflight dispatch to final receipt,
excluding preparation, pairing and terminal UI refresh. This is an observed
operation duration, not a controlled performance comparison. Broader recovery
and usable performance remain open. The app still reports 49.92 px source versus
51.02 px native width; the verified color update does not qualify fidelity or V1.

To reverse, refuse post-succession caller preparation and preserve existing
version-4 plans as historical evidence. Do not replace the current source with
the main's old identity or rewrite the main's recorded provenance.

## D.116 Native hashing preserves portable revision bytes

**AGENT decision, 2026-09-21.** Reading retained native evidence repeatedly
hashes large canonical values. Node hosts with `process.getBuiltinModule` now
use the synchronous built-in SHA-256 implementation. Browser, plugin and older
Node hosts retain the existing portable implementation. Canonicalization,
UTF-8 encoding, revision format and all evidence checks remain unchanged. No
revision or evidence is cached by this change.

The existing provenance gate runs the shipped implementation in five isolated
host shapes, including absent and throwing built-in lookups and native crypto.
It compares 279 values with Node's digest, including Unicode, malformed UTF-16,
SHA padding boundaries and a large value, and checks mutation and restoration.
The browser bundle also executes without Node globals. The actual saved
post-update caller plan, writer and independent reader reproduce exactly.

A local nine-sample comparison of the same saved values reduced the median
complete revision calculation from 73.77 to 33.80 ms for the 1.80 MB caller
plan and from 84.55 to 40.33 ms for the 2.07 MB combined update input. These
are isolated measurements, not an application latency result or V1 evidence.
The local application subsequently adopted the candidate with an official
engine rebuild. A read-only service-handler comparison over the same 1,535
retained journal files returned byte-identical 166,152-byte responses and left
the journals unchanged. The first warm read fell from 115.48 to 84.65 seconds
(26.7%). The before cold sample overlapped server shutdown, and the second
before warm sample briefly overlapped another check; neither is used for that
comparison. This sequential measurement is not a browser latency study, and
an approximately 85-second history read remains a product performance gap.
Private evidence is under `private/post-update-callers-20260922/native-hash-*`
and `private/native-template-app-integration-20260921/native-hash-list-*-v1.json`.

To reverse, remove the optional native branch and keep the existing portable
SHA-256 implementation. Every historical revision and generated program must
remain byte-identical; never migrate journals or relax a verification check.

## D.117 Delivery progress is separate from result verification

**AGENT decision, 2026-09-22.** Sources previously requested the complete native
inspection every four seconds while delivery was active. Each request could
reconstruct source and correction history synchronously, delaying the companion's
next request. Native creation and update progress now use a read-only journal
route that returns only whether delivery remains pending. It validates operation
identity and the retained journal; it does not report source freshness or grant
verification or write authority. Existing write checks are unchanged.

Completion, unavailable or malformed progress, and running source inspections
still require the full listing. Pending commands receive a full status read after
one minute so interruption and recovery controls remain available. That read can
itself be slow. An action's fully checked response resets this interval. A
discarded development-mode mount no longer starts a duplicate initial read.
No result or source evidence is cached across progress requests.

Against the retained two-caller update, the existing full listing took 96.01
seconds. The new update progress route took 2.13 seconds on its first request
and 0.61–0.65 seconds on four subsequent requests. All 1,549 existing native
journal, plan and succession files stayed byte-identical. The first creation
progress request spent 251.57 seconds including queued reload work; it is not a
clean endpoint benchmark. The app subsequently showed the existing correction
as verified through its full listing. These measurements compare different
read operations, not equivalent full verification or complete update latency.
Startup, final verification and overall usable performance remain unqualified.

The reference HTTP, transport, update-journal and frontend polling tests cover
wrong references, unknown operations/proposals, non-GET requests, journal damage,
stale-source write refusal, completion races, reinspection, malformed progress
and interrupted-delivery fallback. Private measurements and the bounded review
are under `private/native-progress-polling-20260922/` in the live worktree.

Existing-update actions also resolve their target ID from the checked journal
before entering the transport. They no longer construct a full display result
solely to obtain that ID. Missing or corrupt journals still refuse, and each
transport action retains its existing source and phase authorization. This
removes redundant verification work; end-to-end latency is still unqualified.

To reverse, restore full-list polling and remove the progress routes. Preserve
the existing journal format, write authorization and terminal verification.


## D.118 A result response has its own bounded evidence read

**AGENT decision, 2026-09-22.** Full native inspection listings already share
checked evidence within one synchronous response. Standalone update results
and replay responses now use the same read scope. A focused probe previously
observed two source derivations while constructing one verified update view;
it now observes one. The next view performs a fresh derivation.

The scope closes before the response returns and never survives a request.
Source changes between views still invalidate current-source authority. Result
objects remain isolated from callers, and journal writes, command delivery and
write authorization remain outside the read scope. No source, native program,
recorded result, fidelity rule or comparison threshold changes.

Focused update, transport, caller-inventory, correction-chain and evidence-scope
checks pass. This reduces demonstrated duplicate work; live result latency and
complete operation performance remain unqualified. Private before/after probe
logs are under `private/post-update-callers-qualification-20260922/`.

To reverse, remove the standalone `withEvidenceReadSnapshot` wrappers from the
update view and getter. Preserve the existing full-list read scope, journal
format, write guards and historical result files.
