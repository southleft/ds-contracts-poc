# The canvas→code exam on a designer's file — Altitude and CBDS, 2026-09-13

**What this closes.** OWNER-PARKED **P1**: "a canvas→code exam on artwork nobody
here drew." Until today the only canvas→code held-out exam ran on a Card that
this repository had minted itself. This one ran on the **Altitude Design System**
Figma file (`y83n4o9LOGs74oAoguFcGS`), drawn by Southleft's design team, rebuilt
by them on 2026-09-08, and never written by this repository (its only prior
references here are a focus-ring diagnosis receipt and docs/32). The file was
opened by the owner in Figma Desktop with the Desktop Bridge plugin and **read
only**: every observe program is read-only by construction (a static guard
refuses any mutating Plugin API), every run reports `figmaWrites: 0`, and the
file's REST `version` was pinned before and after each batch.

Gate: `npm run recipe:canvas-to-code:held-out:v2:check` (fast lane, beside the
v1 exam, which is untouched). Evidence: `recipe/evidence/canvas-to-code-held-out-v2/`.
Manifest: `recipe/canvas-to-code-held-out-v2-manifest.ts`.

## The census — Altitude (eleven published sets)

Each subject is one of two outcomes — **accounting
clean** (zero silent losses at the bridge, zero silent and zero unexplained
deltas at the Chromium render, every variant mounted) or **refused by name**
(the stage and the exact message). There is no third outcome; a crash is a
defect in this exam, not a result.

| set | variants | file version | outcome | where it stopped, verbatim |
| --- | ---: | --- | --- | --- |
| Badge | 10 | …461242 | **accounting clean** | bridge 238 named · 93 carried · 34 receipted · 0 silent; render 97 matched · 15 named deltas · 231 carried · 22 receipted · 0 silent · 0 unexplained; 10 cells mounted; proposal verified-exact, 0 stubs |
| Menu | 2 | …461242 | **accounting clean** | zero silent, zero unexplained, 2 cells |
| Tabs | 2 | …206865 | **accounting clean** | zero silent, zero unexplained, 2 cells; the nested Tab instances are child stubs, each a named "part omitted" |
| Chip | 40 | …461242 | refused · render | `variant axis State has no contract prop — cannot mount State=Default, Variant=Bare, Dismissible=No, Shape=Default` |
| Link | 4 | …461242 | refused · render | `variant axis State has no contract prop — cannot mount State=Default` |
| Checkbox | 26 | …461242 | refused · bridge | `root/children/0/children/0/children/0/children/0 ("al-c-checkbox__custom-check") has layoutMode NONE — a frame nested inside variant root/children/0 without auto-layout (free-form placement) is outside this bridge's vocabulary` |
| Radio | 18 | …461242 | refused · bridge | same class: `("al-c-radio__input") has layoutMode NONE` |
| Toggle | 8 | …206865 | refused · bridge | `root/children/0 ("Checked=Off, State=Default") has layoutMode NONE — a variant root without auto-layout` |
| Textarea | 6 | …461242 | refused · render | `the generated Textarea never mounted a cell — the page reported: Use the defaultValue or value props instead of setting children on <textarea>` |
| Avatar | — | …461242 | refused · observe | `set-not-on-canvas`: the published set is a stub with zero children; no Playground page exists among the file's 54 pages |
| Alert | — | …461242 | refused · observe | same |

Three of eleven are accounting clean. That is the number, and it is the first
honest one for this direction on a stranger's artwork. Read the eight refusals
as a map of what the canvas→code path cannot yet say — not as failures of the
exam, which did exactly its job: nothing landed nowhere.

## What a designer's file exposed, and what was changed (language, not answers)

Each of these was found because a file this repository never drew was put
through the pipeline. None changes what the engine *answers*; each widens what
it can *say*.

1. **A `fontStyle` binding crashed canvas-facts with a schema error.** The IR
   already spelled `type.fontStyle` as a STRING binding; the scene reader's map
   from Figma's API spelling did not — and the reader (`scene-readback.ts`) is
   byte-frozen by the v7/v8 signed lineages, so it cannot learn. `canvas-facts`
   now respells `fontStyle`/`fontFamily` (with the `.0` range suffix) to the IR
   field before projection (`text-style-binding-spelled`); the reader passes it
   through verbatim. And a general rule: any binding the IR cannot spell is
   **receipted by name** (`binding-field-unspelled-receipted`) and dropped from
   the projection, never thrown.
2. **The set's own placement refused the bridge.** A designer parks the set
   inside a prop-sheet frame, so the root is ABSOLUTE and the projection emits
   `layout.offset` + `layout.constraints` for it. Neither has a dump spelling;
   both are now receipted as sheet chrome on the root, and as the existing v1
   gap on an absolute child.
3. **A designer's VECTOR (the check glyph) crashed the reader** with an empty
   asset reference. `canvas-facts` now names it `unresolved-vector` before the
   frozen reader sees it (`vector-asset-unresolved-named`); the bridge refuses
   vector nodes by name downstream.
4. **Nested instances were unexplained deltas.** The bridge stops at instance
   boundaries and the proposer emits child stubs, but nothing said so where the
   render diff looks. Every child stub now carries a `part omitted` note, so the
   delta is explained. Tabs went from 16 unexplained to clean.
5. **A zero-size render timed the harness out.** It waited for a *visible*
   cell; a Menu that hugs nothing the emitter could draw is attached but not
   visible. It now waits for attachment and reads visibility as a fact. Menu
   went from timeout to clean.
6. **A mount crash was a bare timeout.** The harness now records the page's
   console errors and `pageerror`s and puts them in the refusal. Textarea went
   from "Timeout 30000ms" to React's own message.
7. **The auto-layout refusal called a nested frame a "variant root".** It now
   names which container, with the node's own name.

One instrument change in the observe: two consecutive observes of Tabs differed
by 73 bytes; the receiver now records such a subject as a per-subject observe
refusal with both scenes kept, instead of failing the batch. Tabs settled on
re-observe at the next file version.

## The second file: CBDS UI Kit Demo (all thirteen archetypes, hand-drawn)

`WofZT8xaxXuc2Q6Je9S4XE`, TJ Pitre's workshop kit; no reference to it exists
anywhere in this repository. Observed the same way, file version
`2398771318774433853`. (Figma re-stamped the file's `version` during the
session while `lastModified` moved from `2026-09-10T14:45:03Z` to `:04Z` — a
date three days before the observe. The receiver now records that as a
re-stamp and keeps the evidence; a `lastModified` inside the observe window
would still refuse.)

| set | variants | outcome | where it stopped, verbatim |
| --- | ---: | --- | --- |
| Checkbox | 20 | **accounting clean** | zero silent, zero unexplained, 20 cells |
| Badge | 72 | **accounting clean** | zero silent, zero unexplained, 72 cells |
| Toggle | 16 | refused · render | `variant axis state has no contract prop — cannot mount alignment=left, size=large, state=default` |
| Radio button | 20 | refused · render | `20 UNEXPLAINED render delta(s): … text-align (label) expected left got center — NO proposal note explains this delta` |
| Link | 72 | refused · bridge | `node type RECTANGLE at root/children/2/children/3 is outside this bridge's vocabulary — refuse rather than approximate` |
| Text Area | 14 | refused · bridge | same class: bare RECTANGLE |
| Chip | 80 | refused · bridge | same class: bare RECTANGLE |
| Dialog | 4 | refused · bridge | same class: bare RECTANGLE |
| Menu | 3 | refused · bridge | same class: bare RECTANGLE |
| Tab-Line | 6 | refused · emit | `generate refused: ds.tab-line: prop "TabItemVerticalRight4Items" code binding "TabItemVerticalRight4Items" is not a legal camelCase identifier` |
| Alert | 30 | refused · propose | `Set "Alert" could not be proposed: Source matrix has 30 rows; Cartesian definitions require 40` |
| Avatar | 36 | refused · bridge | `root/children/0 ("round=true, size=xsmall(24x24), type=image") has layoutMode NONE — a variant root without auto-layout` |
| Tooltip | — | refused · observe | `UNSUPPORTED-SCENE-NODE-TYPE:POLYGON@695:310` — the pointer is a polygon; refused inside the sandbox on both runs |

Two of thirteen are accounting clean. Across both files: **5 of 24 designer-drawn
sets are accounting clean, 19 refused by name, 0 silent.** Four refusal classes
appear only here: a bare RECTANGLE drawn directly in a variant (five sets), a
variant matrix that is not Cartesian (Alert: 30 of 40 cells drawn), a designer's
variant name the emitter cannot turn into an identifier (`TabItemVerticalRight4Items`),
and a label alignment the render diff cannot explain (Radio: the generated
label centres where the canvas left-aligns — an **unexplained** delta, which is
the one outcome this exam treats as its own defect to close, not the file's).

## What is still owed, in order of what it would unlock

- **State axes.** Every Altitude set carries `State=Default|Hover|Focus|Disabled`.
  The proposer maps State to states, not a prop, and the mount step cannot drive
  a state, so Chip and Link stop at render. Driving pseudo-states in the harness
  (`CSS.forcePseudoState`) plus attribute-driven disabled would turn both into
  measured rows. This is the widest gap.
- **Free-form frames.** Checkbox, Radio and Toggle draw their controls with
  frames that have no auto-layout. The dump vocabulary has no absolute
  placement (v1's own named gap). A lowering for a fixed-size frame with
  absolutely placed children would unlock all three.
- **`<textarea>` in the React emitter** must take `defaultValue`, not children.
- **Vector glyphs** are refused at the bridge; carrying a glyph's path would
  turn the checkbox's check into a fact.
- **Non-VARIANT component properties** (Badge's `Text` TEXT prop) are named
  from the observe meta, not carried.
- **Bare shapes.** A RECTANGLE drawn directly inside a variant (CBDS Link,
  Text Area, Chip, Dialog, Menu) refuses at the bridge. Lowering a rectangle to
  a frame with a fill and a stroke would unlock five CBDS sets at once.
- **Non-Cartesian variant matrices** (CBDS Alert: 30 of 40 cells) refuse at
  propose; a sparse-matrix proposal with the absent cells named would unlock it.
- **Designer variant names as identifiers** (`TabItemVerticalRight4Items`): the
  emitter's identifier rule refuses digits in a segment; a lossless rename with
  the original kept as metadata would unlock Tab-Line.
- **Label alignment** (CBDS Radio): the emitted label centres where the canvas
  left-aligns and no note explains it — an unexplained delta, this exam's own
  defect class.

## What this does not claim

- It does not flip `overallSuccess`; the owner grades and signs.
- It is not a fidelity score: the v2 gate measures accounting, not pixels. The
  optional two-sided comparison against Altitude's real `al-badge` render
  (already captured in this repo) is designed and not yet wired.
- The two files were observed at different file versions each (Altitude
  `…461242`/`…206865`, CBDS `…433853`); every receipt pins its own.
