# 23 — Known Limitations

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
| **G13 — audit trail & loop closure** | OPEN (record shape exists) | no viewer tab, no "resolved by PR #N". |

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

---

# §C — THE MEASURED PRICE OF WHAT WORKS

*Everything in this part is a cost of a working pipeline, not a symptom of a
broken one. It is still a cost, and the numbers are not flattering. The
companion figures — what the same measurements say went right — are in
[24 — What Works](24-what-works.md).*

<a id="1-coverage--how-much-of-a-library-is-actually-captured"></a>

## B.30 State previews are all-or-nothing per set — one override-less state hides every drawn plane

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

## B.31 The pseudo-decor grammar drops a decor's `box-shadow`, and the placeholder plane's ink

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

## C.1 Coverage — how much of a library is actually captured

Seven distinct libraries across eight rounds, five styling architectures, one
pipeline, with engine-change cost per library trending toward zero
([docs/22 §1–§5](22-generality.md)). That claim is about the *engine* and the
evidence supports it. **It is not a claim that your library can be captured.**

### C.1.1 Which component archetypes are proven — the actionable cut

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
| Astryx (`@astryxdesign/core@0.1.6`) | 13 | 222 | PART | yes (`examples/astryx/out/code-extraction.json`) | **5.9%** | **96** *(the package's own capitalised subpath exports, 99)* | **13.5%** | 3 |
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
| canvas constructs | 154 | CARRIED 107 · LEDGERED 38 · REFUSED 9 (154 PASS · 0 RED-EXPECTED — the last two exam silences closed 2026-08-23, §D.29; the slot's interior layout the same day, §D.31) | `extract/figma/conformance/MANIFEST.json` (`npm run conformance:canvas`) |
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

**A named limit that came with it:** the playground's recommended REST import
route is a v1.5 mapper against a v1.13 plugin dump — eight revisions of channels
it cannot see (`strokeAlign`, wrap, constraints, imageFill, textOverrides,
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
# and `Table` alone is 29 of Astryx's 222
node -e "const ext=require('./examples/astryx/out/code-extraction.json');
const pkg=require('./examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/package.json');
const subs=new Set(Object.keys(pkg.exports).filter(k=>/^\.\/[A-Z][^/]*\$/.test(k)).map(k=>k.slice(2)));
const f=new Map();for(const e of ext){const d=e.source.match(/\/src\/([^/]+)\//)[1];f.set(d,(f.get(d)||0)+1)}
console.log(f.size,[...f.keys()].filter(d=>subs.has(d)).length,f.get('Table'))"   # → 98 97 29

# the filtered MUI denominator, by a library-native rule (§C.1.3)
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
npm run conformance:canvas        # → 154 cases · 154 PASS · 0 RED-EXPECTED · 0 FAIL

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
conformance:canvas` (154 cases · CARRIED 107 · LEDGERED 38 · REFUSED 9 ·
154 PASS · 0 RED-EXPECTED); `npm run exact-proposal:check` §49 (now pins
the FULL layout object `{direction, justify, align, grow}` on every shape)
and §50 (the interior facts on their own: the layout block, the three
minted channels, the layoutByProp split); `npm run accuracy:check`
(`accuracy/grammar.json` pins 154 = 107 / 38 / 9); `npm run
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

**Numbers.** polaris Tag re-fuses: offline 81.551 % (6140/7529 cells, 0
unresolved refs) against the committed harness 81.016 % (5996/7401); 128
cells added and 144 more equal, so 16 previously-compared cells changed
verdict to EQUAL — the hugging link. The baseline row drops `refused` and
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
  across 8 libraries gained receipts; the wall itself is §B.30).
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
