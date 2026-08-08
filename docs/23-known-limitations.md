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

- **CSS Grid — no longer irreducible, but only half-landed.** The A1 recon
  (docs/research/grid-recon-probes.md) found the canvas grew `layoutMode:
  "GRID"` with byte-exact track readback, and the A2 engine now CARRIES the
  declared-track subset: px/fr/`fit-content(100%)` tracks (fractional ok),
  the row/column gap pair, **explicitly-placed** children (0-based anchors,
  spans, per-cell align), named areas as contract-owned slot anchors,
  absolute overlays inside grids, grids on component variants, instance
  children, and grid-in-flex composition (conformance: `grid-bento-span-matrix`
  and 15 sibling cases green). Two bounded classes remain:
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
  - **NOT BUILT YET — auto-placed grids** (no explicit per-child placement):
    see [§B.22](#b22-auto-placed-grids-g5-placement-from-order-promotion-is-not-built).
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
spelling. `conformance/EXPECTATIONS.md` lines 72/73/98 still show exactly three
🔴 rows, and today's run prints `53 cases · 50 pass · 3 red · 0 yellow` with
`no drift against conformance/BASELINE.json`:

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
    leaking a run-scoped `VariableID:` into the hash. What is still missing is
    the read path: **neither `parity/extract-figma.plugin.js` nor
    `extract/figma/dump.plugin.js` calls `getSharedPluginData`** (0 occurrences
    in both), so the stamp is written to the canvas and never read back out.
    Separately, `parity/extract-code.ts` computes `cssVars` which
    `parity/diff.ts` references **zero** times — the code-side extractor
    already reads the stylesheet and the differ discards the result.

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

- **`slot.acceptsMode: 'restrict'` has no canvas spelling.** Figma's
  `INSTANCE_SWAP` carries `preferredValues`, a picker HINT that sorts entries
  and prevents nothing. So `prefer` maps exactly, `open` maps by carrying
  nothing, and the one tier with teeth cannot be expressed. Proven rather than
  asserted: `npm run slot-constraints:check` §4 drives the real engine over
  `ds.avatar-group` with only `acceptsMode` flipped and the two emitted scripts
  are **byte-identical**. The restriction is enforced on the code surface by
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

## B.22 Auto-placed grids: G5 placement-from-order promotion is not built

The A2 layout landing carries **explicitly-placed** declared-track grids (see
the reclassified grid entry in [§A.1](#a1-css-constructs-with-no-canvas-spelling)).
It deliberately did NOT land G5 of the pinned grammar
(`docs/research/layout-grammar-proposal.md`): a grid whose children carry no
explicit `grid-row`/`grid-column` — the single most common way CSS authors
write a grid — abandons promotion with the named receipt
`grid-promotion-fallback: … auto-placed … (G5) is not promoted from the
computed floor this round` and falls back to the flex-era path: a 2-D grid
refuses (`grid-two-dimensional`), a 1-D grid lowers to a flex row/column from
measured track counts.

**Measured, recorded open** in `conformance/BASELINE.json` (the two-sided
ratchet keeps them visible, never absorbed): `grid-2d`, `grid-two-column`,
`grid-sidebar-px-fr`, `grid-track-fit-content`, `grid-tracks-mixed-fractional`
(WRONG-NAME: declared CARRIED by the manifest per the pinned grammar, engine
lowers instead) and `grid-auto-flow-row` (the flow channel's order fact is
named in the fallback receipt but not carried). The frozen spec subset keeps
`grid-2d` REFUSED until the engine measures it CARRIED — a **staged widen**,
per `spec/README.md`'s no-silent-widen rule.

**What it would take — an engine round, not research.** The grammar is pinned
(G5: placement fact = child order; rows derived `ceil(children / columns)`
declared explicitly by the emitter, never implicit, P9), the canvas half is
probed (`ROW_AUTO_FLOW`, P5/P5b), and the conformance cases already exist and
are red. Implementation is `promoteGridLayout` learning order-derived
placement plus the P9 occupied-vs-declared fence.

---

# §C — THE MEASURED PRICE OF WHAT WORKS

*Everything in this part is a cost of a working pipeline, not a symptom of a
broken one. It is still a cost, and the numbers are not flattering. The
companion figures — what the same measurements say went right — are in
[24 — What Works](24-what-works.md).*

<a id="1-coverage--how-much-of-a-library-is-actually-captured"></a>

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
| CSS / DOM frontier | 53 | CARRIED 22 · LOWERED 2 · REFUSED 11 · UNSUPPORTED 18 | `conformance/MANIFEST.json` (run today) |
| canvas constructs | 91 | CARRIED 72 · LEDGERED 11 · REFUSED 8 | `extract/figma/conformance/MANIFEST.json` |
| dropped-fact receipts (`†`) | 87 across 8 corpora | pinned exactly, in both directions | `extract/figma/dagger-census.json` |

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
# → 53 cases · 50 pass · 3 red · 0 yellow; CARRIED 22 · LOWERED 2 · REFUSED 11 · UNSUPPORTED 18

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

---

*If you find something this document does not name, that is a bug in this
document, and it is the kind worth reporting.*
