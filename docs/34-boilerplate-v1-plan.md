# 34 · The boilerplate hill-climb — a corpus plan for a releasable v1

> **Status: ACTIVE — adopted 2026-08-31.** This is the climb, not a draft.
> Nothing here mints, grades, or flips `overallSuccess`. Product **v1
> remains INCOMPLETE** — F1 (whole-corpus / unseen-library on the recipe
> path) is unproven and this plan does not by itself prove it. Written
> against `main` head `e295517a8`; adoption recorded on `main` after
> `dd3bc0afe`. Supersedes only one line of [docs/33](33-post-v1-plan.md):
> "No sixth archetype this cycle."
>
> **Owner decisions adopted 2026-08-31 (do not invent more):**
>
> 1. **Plan is active.** Astryx = “asterisks” unless later corrected.
> 2. **Combobox / Select = fork A.** Proof target stays Combobox
>    (Autocomplete-family). V41 human signoff stands. Do not restamp V41
>    (`f330a082`). Do not remint Combobox now. Human reference pages: MUI
>    Autocomplete + AntD Select-with-search. Select is a *future* Phase 2
>    archetype if/when we get there — not a retarget of signed Combobox.
>    Remint closed: accepted as source-faithful continuation of V41;
>    visual mismatch with Select docs was the wrong official page. Do not
>    invent a new visual grade of v42.
> 3. **F1 stays the v1 gate.** Do not redefine v1 as the three-library
>    matrix. `overallSuccess` stays false until F1 is honestly proven.
>    Finishing boilerplate is necessary corpus, not a silent ship.
> 4. **Start Phase 1 now:** Checkbox → then Radio → Switch, each across
>    Astryx + MUI + Ant Design when the library ships that component. Do
>    not wait for another planning round.

---

## 0 · The assumption you should correct in one line if it is wrong

**"Asterisks" is Astryx** — adopted 2026-08-31 unless later corrected.
`@astryxdesign/core@0.1.6`, the StyleX library documented at
`astryx.atmeta.com/components`, which already backs the Calendar recipe
(page `181:64873`).

The repo evidence for that reading:

- `asterisk` appears in this repo **only** as the required-field indicator
  glyph — an icon asset in `contracts/field.contract.json`,
  `contracts/text-field.contract.json`, `contracts/text-area.contract.json`,
  the matching `src/components/*/`, and a Figma set named `Asterisk` inside
  `extract/figma/gauntlet/census.json`. There is no library, vendor, package,
  or recipe called Asterisk.
- Astryx is a real, pinned, already-climbed library in this corpus: the
  Calendar recipe compiles from it, `examples/astryx/` carries its contracts
  and PROVENANCE, and `docs/24` measures it.

**If "asterisks" meant something else, say so and the three-library axis
changes; everything else in this plan survives the swap.**

---

## 1 · What this plan changes and what it does not

**Changes:** it reopens new archetypes. [docs/33](33-post-v1-plan.md)'s TJ
decision #5 ("No sixth archetype this cycle") is superseded by the owner
message of 2026-08-30 that asked to hill-climb boilerplate.

**Does not change:**

- The Combobox `Select`-vs-`Autocomplete` fork in
  [docs/33](33-post-v1-plan.md#adopted-2026-08-31--combobox-human-reference--fork-a)
  is **closed as fork A** (adopted 2026-08-31). V41 signoff stands. V42 stay
  page `183:70641` stays. No new visual grade of v42 is invented. Remint is
  accepted as a source-faithful continuation of V41; the Select-docs mismatch
  was the wrong official page. Select is a future Phase 2 archetype, not a
  retarget.
- npm publish stays deferred.
- Recipe acquisition stays human-authored and human-reviewed. Nothing in this
  plan infers a recipe from a library.
- Hardening already on `main` is cited, not redone: H1 replay census
  (`recipe:replay-census`, evidence for button and calendar), H2 writer
  preflight (`recipe:writer-preflight`), and the Button perturbation exam
  (`recipe:button:perturbation:check`).
- F1 stays the v1 gate (adopted 2026-08-31). See
  [§8 Question 2](#question-2--f1-or-a-redefined-v1). Do not redefine v1 as
  the three-library matrix.

---

## 2 · The uncomfortable fact this plan has to start from

TJ's confidence target is *MUI + Ant Design + Astryx boilerplate coverage*.
**Not one of the five signed archetypes is proven on that triple.** Each
signed archetype carries exactly two library roots, and the pairs are mostly
not these three:

| signed archetype | library roots actually proven | page |
|---|---|---|
| Button | Altitude + Fluent | `183:69150` |
| Input / Field | MUI + Polaris | `115:295378` |
| Combobox | MUI (Autocomplete) + AntD (Select) | `163:35981` |
| Table | first-party + MUI | `173:48924` |
| Calendar | Astryx **only** (second leg is a named refusal) | `181:64873` |

Combobox is the only archetype with two of the three target libraries. Astryx
appears once. AntD appears once.

So "finish the MUI/AntD/Astryx matrix" is **not** a matter of adding a few new
archetypes on top of a finished base. It also means ten new library legs on
archetypes that already read as done. That is named honestly in the matrix
below rather than hidden, and it is the single biggest input to
[§7 cost](#7--what-this-actually-costs).

---

## 3 · What each library actually ships (measured, not assumed)

Sources, all in-repo:

- **Astryx** — `examples/astryx/extraction/proposals.md` (222 extracted
  components from the npm-shipped TSX of `@astryxdesign/core@0.1.6`),
  `examples/astryx/extraction/CENSUS.md` (the 24-category census with
  Astryx's own names), `docs/research/astryx-coverage.md` (the 93-component
  docs-site index).
- **MUI** — the vendored `@mui/material@9.2.0` under
  `recipe/sandboxes/input-field-mui/node_modules/@mui/material/`, which is
  the authoritative list of what MUI Material actually ships.
- **AntD** — `antd@5.29.3`, vendored by tarball for the Combobox climb
  (`recipe/fixtures/library-comboboxes.ts`), plus `examples/antd/contracts/`.
  Boilerplate AntD legs now cite the local
  `examples/antd/.antd-sandbox/node_modules/antd@5.29.3` install (gitignored;
  recreate via `examples/antd/README.md`). The Combobox fixture still
  *declares* the historical tarball `sourceRoot`.

### Source of truth for minting (2026-08-31)

TJ asked where code→canvas actually gets what it mints. Honest answer:
**compile does not read `node_modules`.** It copies human-reviewed token
tables in `recipe/fixtures/library-*.ts` that *cite* the public npm
packages (`@mui/material@9.2.0`, `antd@5.29.3`,
`@astryxdesign/core@0.1.6`). The installs on disk are real and complete
(MUI `Switch.js` is present — earlier “missing” was a glob false
negative). Computed CSS of those packages is a separate pipeline
(`extract/computed`) used for signed Input, not for boilerplate compile.
Evidence: [`recipe/evidence/compile-source-of-truth-v1.md`](../recipe/evidence/compile-source-of-truth-v1.md).
Does not remint. Does not invent Polar. Does not flip `overallSuccess`.
Product v1 stays INCOMPLETE.

Astryx renames aggressively, and those renames are the part of this plan most
likely to bite. The category → Astryx-name map, from Astryx's own census:

| category | Astryx name |
|---|---|
| checkbox | `CheckboxInput` (+ `CheckboxList` / `CheckboxListItem`) |
| radio | `RadioList` + `RadioListItem` — **no standalone Radio** |
| textarea | `TextArea` |
| select | `Selector` / `MultiSelector` — **a named extraction skip** |
| combobox | `Typeahead` |
| tag / chip | `Token` |
| alert / banner | `Banner` |
| tabs | `TabList` + `Tab` |
| menu | `DropdownMenu` / `MoreMenu` / `ContextMenu` |
| accordion | `CollapsibleGroup` |
| progress | `ProgressBar` / `Spinner` |
| toast | `Toast` |
| text field | `TextInput` |

Three measured absences that constrain the matrix:

1. **MUI Material ships no Calendar.** There is no `date`, `calendar`, or
   `picker` directory in the vendored `@mui/material@9.2.0`, and there is no
   `@mui/x-*` reference anywhere in this repo. MUI's calendar lives in
   `@mui/x-date-pickers`, an unvendored separate package. A MUI Calendar leg
   is a new vendoring decision, not a recipe edit.
2. **Astryx's `Selector` is already a named extraction skip.** Its branches
   are generic (`SelectorPropsNonClearable<T>`), and
   `examples/astryx/extraction/CENSUS.md` refuses to expand them because
   "generic references transform their target's members — expanding them
   would claim more than the type says." An Astryx Select leg starts from a
   refusal that the repo has already written down.
3. **Astryx's `Table` census row is hollow — 0/0 facts, receipted.** An
   Astryx Table leg is not a small addition.

---

## 4 · Coverage matrix

Columns are the three target libraries. Cells are **not-started / signed /
open / blocked / N/A**, and a cell says which component name that library
would actually be.

`signed` means the four-part bar of docs/26 `V1-CLASS-03` (a)–(c): offline
gate green, live Scratch mint stayed with page ids in the RECORD, and an
attributable owner grade citing that page. It does **not** mean
`overallSuccess: true` — criterion (d) is true today only for Table.

### 4a · Already-climbed archetypes, re-scored against this triple

| archetype | Astryx | MUI | AntD | signed elsewhere |
|---|---|---|---|---|
| **Button** | not-started (`Button`) | not-started (`Button`) | not-started (`Button`) | **signed** — Altitude + Fluent, `183:69150` |
| **Input / Field** | not-started (`TextInput`) | **signed** (`TextField`), `115:295378` | not-started (`Input`) | signed — Polaris |
| **Combobox** | not-started (`Typeahead`) | **signed, fork A** (`Autocomplete`) | **signed, fork A** (`Select` with search) | v42 stay `183:70641`; remint accepted, no new v42 grade |
| **Table** | **blocked** (`Table`, census 0/0 hollow) | **signed**, `173:48924` | not-started (`Table`) | signed — first-party |
| **Calendar** | **signed**, `181:64873` | **N/A** — not in `@mui/material@9.2.0`; would need `@mui/x-date-pickers` | not-started (`DatePicker`) | second leg = named refusal (react-day-picker, held blind for F1) |

### 4b · Proposed boilerplate archetypes

| archetype | Astryx | MUI | AntD |
|---|---|---|---|
| **Checkbox** | stayed, waiting-on-TJ (`CheckboxInput`) page `183:74742` | stayed, waiting-on-TJ (`Checkbox`) | stayed, waiting-on-TJ (`Checkbox`) |
| **Radio** | not-started (`RadioList` + `RadioListItem` — list-shaped) | not-started (`Radio` + `RadioGroup`) | not-started (`Radio` + `Radio.Group`) |
| **Switch** | not-started (`Switch`) | not-started (`Switch`) | not-started (`Switch`) |
| **Textarea** | not-started (`TextArea`) | not-started (`TextField multiline` / `TextareaAutosize` — no standalone Textarea) | not-started (`Input.TextArea`) |
| **Select** | **blocked** (`Selector` — generic named skip) | not-started (`Select`) | not-started (`Select`) |
| **Alert / Banner** | not-started (`Banner`) | not-started (`Alert`) | not-started (`Alert`) |
| **Chip / Tag** | not-started (`Token`) | not-started (`Chip`) | not-started (`Tag`) |
| **Badge** | not-started (`Badge`) | not-started (`Badge`) | not-started (`Badge`) |
| **Avatar** | not-started (`Avatar`) | not-started (`Avatar`) | not-started (`Avatar`) |
| **Link** | not-started (`Link`) | not-started (`Link`) | **named absence** — no top-level `Link`; `Typography.Link` |
| **Tooltip** | not-started (`Tooltip`) | not-started (`Tooltip`) | not-started (`Tooltip`) |
| **Tabs** | not-started (`TabList` + `Tab`) | not-started (`Tabs` + `Tab`) | not-started (`Tabs`) |
| **Menu** | not-started (`DropdownMenu` / `MoreMenu`) | not-started (`Menu`) | not-started (`Dropdown`) |
| **Dialog** | not-started (`Dialog` / `AlertDialog`) | not-started (`Dialog`) | not-started (`Modal`) |
| **Icon Button** | not-started (`IconButton`) | not-started (`IconButton`) | **named absence** — `Button` with `icon=` |
| **Slider** | not-started (`Slider`) | not-started (`Slider`) | not-started (`Slider`) |
| **Progress** | not-started (`ProgressBar` / `Spinner`) | not-started (`LinearProgress` / `CircularProgress`) | not-started (`Progress` / `Spin`) |
| **Pagination** | not-started (`Pagination`) | not-started (`Pagination`) | not-started (`Pagination`) |
| **Divider** | not-started (`Divider`) | not-started (`Divider`) | not-started (`Divider`) |
| **Form-field chrome** | not-started (`Field` / `FieldLabel` / `FieldStatus`) | not-started (`FormControl` / `FormLabel` / `FormHelperText`) | not-started (`Form.Item`) |

Checkbox is **stayed, not signed**: extract-structural is green on page
`183:74742` (`Recipe Pivot / Checkbox / e2386e0d-f8e77a54-be0bbae1-checkbox-v1`).
No human visual grade is invented. `overallSuccess` stays false. Product v1
stays INCOMPLETE. Every other 4b cell is still a claim about what the library
ships, not recipe-path evidence.

---

## 5 · The hill-climb order

Ranked on the three criteria in the owner message: present in all three
libraries, layout/token-heavy but not Calendar-complex, and teaches a writer
class the corpus does not already have.

The writer classes already taught, and therefore *not* a reason to pick an
archetype: auto-layout and reflow, variant switching, token binding, effect
and shadow geometry (Button's B3a focus ring), overlay chrome (Combobox), and
grid/column alignment (Table, Calendar).

| # | archetype | 3/3? | new writer class it teaches |
|---|---|---|---|
| 1 | **Checkbox** | yes | selection-control glyph state — a check/dash inside a small bounded box, including indeterminate |
| 2 | **Radio** | yes (Astryx list-shaped) | the same glyph class on circle geometry, plus group-level exclusive selection |
| 3 | **Switch** | yes | track-and-thumb — a child positioned by state rather than by flow |
| 4 | **Textarea** | yes | multiline text growth and auto-height |
| 5 | **Alert / Banner** | yes | none new — deliberately, as the consolidation check that classes 1–4 hold |
| 6 | **Chip / Tag** | yes | dense radius and inline-affordance geometry |
| 7 | **Badge** | yes | anchored overlay — a node positioned against another node's corner |
| 8 | **Avatar** | yes | circle-clipped content and the initials fallback |
| 9 | **Link** | 2 + named AntD absence | inline text decoration and its states |
| 10 | **Tooltip** | yes | the smallest portal — the cheapest possible portal test |
| 11 | **Tabs** | yes | a selection indicator bound to the selected child |
| 12 | **Menu** | yes | reuses Combobox overlay against three new sources |
| 13 | **Dialog** | yes | full-bleed scrim and the largest portal risk — **last on purpose** |

**Deliberately not in the climb order, each for a named reason:**

- **Select** — fork A (adopted 2026-08-31) keeps Combobox on the
  Autocomplete-family. Select is a future Phase 2 archetype if/when we get
  there, not a retarget of signed Combobox. Its Astryx leg still starts from
  an existing named skip.
- **Slider, Pagination, Progress, Divider** — all three libraries ship them
  and they are cheap, but they teach nothing new. They are backfill for
  whenever the climb has spare capacity, not hill-climb targets.
- **Icon Button** — AntD has no distinct component, so it is a 2 + named
  absence at best, and it mostly re-proves Button.
- **Form-field chrome** — the highest-value item on this whole list for real
  adoption, and the one whose three libraries disagree most about anatomy
  (`Field` vs `FormControl` vs `Form.Item`). It deserves its own decision,
  not a slot in a boilerplate queue.

---

## 6 · Phases

Every phase below shares one **live protocol reminder**, which is not
negotiable and is not restated per phase:

> Scratch file `byMp6lt0Ij9b2QbkDGFwBh` only. PREPARE → AUTHORIZE → **one new
> page per attempt** → RECORD. One teaching per PREPARE. Signed pages are
> never edited. A failed attempt fails closed and teaches a named class; it
> does not get restarted as-is.

And one shared **proof bar**, which is docs/26 `V1-CLASS-03` unchanged:

> Offline recipe gate green · live mint **stayed** with page and set node ids
> in the RECORD · **attributable owner human grade** citing that page ·
> zero-silent accounting on a non-zero denominator · every difference **named
> or carried**. `overallSuccess` is not flipped by any phase in this document.

### Phase 0 — Close the Combobox / Select reference fork

- **Status: closed adopted 2026-08-31 as fork A.**
- **Goal:** turn an open fork into a chosen reference. Nothing else.
- **Decision:** Keep Autocomplete-family. Human reference pages are
  [MUI Autocomplete](https://mui.com/material-ui/react-autocomplete/) and
  AntD Select-with-search. V41 signoff stands. Do not restamp V41
  (`f330a082`). Do not remint Combobox now. Remint accepted as
  source-faithful continuation of V41; visual mismatch with Select docs
  was the wrong official page. Do not invent a new visual grade of v42.
  Select is a future Phase 2 archetype if/when we get there — not a
  retarget of signed Combobox.
- **Evidence:**
  `recipe/evidence/combobox-select-vs-autocomplete-owner-decision.json`
  (historical open-fork record; the close lives in this document and
  [docs/33](33-post-v1-plan.md#adopted-2026-08-31--combobox-human-reference--fork-a)).

### Phase H — Finish hardening before spending hills (runs alongside Phase 0)

- **Goal:** make each subsequent hill cheaper, using the mechanism that
  already measurably worked once.
- **Work:** extend the H1 replay census to **Input and Combobox** — it covers
  only `table`, `calendar`, and `button` today
  (`recipe/evidence/replay-census-button-v1.json`,
  `replay-census-calendar-v1.json`). Land **H3** (consolidate taught classes
  into shared host-normalize/observe with per-class provenance), which is
  named in docs/33 §5 and has not landed.
- **Proof bar:** offline only, zero Figma writes. The census must reproduce at
  least one named historical live refusal per newly covered archetype.
- **Why it is worth the delay:** Table took 24 versions of one-refusal-per-
  cycle; after the tail census predicted the v24 refusal exactly, it finished
  in 8 more. That is the only measured order-of-magnitude cost reduction in
  the record, and this plan spends far more hills than any previous one.
- **What would stop the climb:** if the census cannot reproduce a known
  refusal for a new archetype, the census is not general and the cost model
  in §7 is wrong — name that and re-plan the remaining hills. Adopted
  2026-08-31: Phase H is not a gate in front of Phase 1.

### Phase 1 — Selection controls

- **Status: starts now (adopted 2026-08-31).** Checkbox first, then Radio,
  then Switch. Do not wait for another planning round.
- **Goal:** three archetypes, three libraries each, and the first
  three-library-per-page mints in the corpus.
- **Archetypes:** Checkbox, Radio, Switch.
- **Libraries:** Astryx (`CheckboxInput`, `RadioList`/`RadioListItem`,
  `Switch`), MUI (`Checkbox`, `Radio`+`RadioGroup`, `Switch`), AntD
  (`Checkbox`, `Radio`+`Radio.Group`, `Switch`).
- **Named shape difference to carry, not smooth over:** Astryx has **no
  standalone Radio**. `RadioList` is the unit. Either the Radio recipe's
  anatomy admits a list-shaped root, or Astryx's Radio leg is a named
  refusal. Deciding that quietly in code would be exactly the kind of
  invented fact this repo refuses.
- **What would stop the climb:** if Checkbox alone costs more than roughly 20
  hills after Phase H, the three-library unit is too expensive and the plan
  should drop to two libraries per archetype and say so.

### Phase 2 — Text-ish

- **Goal:** extend the Input/Field family across the triple and land the
  multiline class.
- **Archetypes:** Textarea; MUI input variants (`OutlinedInput` /
  `FilledInput` / `Input`, all three present in the vendored package); Select
  **as a new archetype under fork A** (not a Combobox retarget).
- **Libraries:** Astryx `TextArea`, MUI `TextField multiline`, AntD
  `Input.TextArea`. Plus the Input/Field AntD and Astryx legs from §4a, which
  are cheaper here than anywhere else because the recipe already exists.
- **Named risk:** Astryx `Selector` is an existing generic named skip. If
  Select enters this phase, its Astryx leg is expected to be a refusal, and
  that prediction should be **recorded before the run**, the way the
  day-picker prediction was.
- **What would stop the climb:** MUI's three input variants turning out to be
  three separate recipes rather than one recipe's variant axis.

### Phase 3 — Display chrome

- **Goal:** the cheap, high-visibility surface area that makes a component
  library look complete.
- **Archetypes:** Alert/Banner, Chip/Tag, Badge, Avatar, Link.
- **Libraries:** all three, except Link where AntD's absence of a top-level
  `Link` is carried as a named absence against `Typography.Link`.
- **Why this phase is where confidence actually comes from:** five archetypes
  × three libraries is the largest single jump in the matrix, and none of it
  is portal work.
- **What would stop the climb:** Badge's anchored-overlay class failing on the
  writer — it is the one genuinely new geometry in this phase.

### Phase 4 — Simple overlays

- **Goal:** prove the portal class on the cheapest possible cases before
  spending it on the expensive one.
- **Archetypes, in order:** Tooltip → Tabs → Menu → **Dialog last**.
- **Libraries:** all three throughout (AntD `Modal` for Dialog, AntD
  `Dropdown` for Menu).
- **Why Dialog is last:** overlays and portals are entry 2 of docs/26's
  approved post-v1 limitations register. Combobox overlay chrome is now a
  closed remint (fork A, adopted 2026-08-31); Dialog remains the biggest
  portal bet and stays last.
- **What would stop the climb:** Tooltip — the smallest portal there is —
  costing more than a handful of hills. If the cheapest portal is expensive,
  Menu and Dialog should be cut and named, not attempted.

### Phase 5 — F1 / the held-out exam

- **Goal:** the thing that actually blocks product v1.
- **Work:** the react-day-picker held-out Calendar exam (spending the
  blindness is a **[TJ] decision** per docs/33 Phase 4), **or** a held-out
  **fourth** library run against whichever boilerplate archetypes Phases 1–4
  signed. A fourth library exam over ten boilerplate archetypes is a far
  stronger F1 argument than one calendar, and it becomes available only
  because Phases 1–4 happened.
- **Proof bar:** a pre-registered prediction, recorded before the run, scored
  after — the day-picker pattern.
- **This phase does not get dropped.** Question 2 closed adopted
  2026-08-31: F1 stays the v1 gate. Dropping Phase 5 silently would be the
  exact failure mode docs/32's F-checklist exists to prevent.

---

## 7 · What this actually costs

The measured record, in live versions per archetype: **Input 85, Calendar 50,
Combobox 41, Table 32** (24 pre-census + 8 post-census), **Button v5 remint 5
attempts**. Per archetype the offline surface is roughly 1,200–2,300 lines of
recipe, 500–1,000 lines of library fixture, and 700–1,150 lines of Figma
writer.

One page carries all of an archetype's library roots at once — Button's
`183:69150` holds Altitude and Fluent together — so **the unit of cost is the
archetype, not the library leg.** A third library makes an archetype
meaningfully more expensive, not 1.5× more expensive in hills.

Taking Table's post-census 8 as the optimistic floor and Combobox's 41 as the
pessimistic ceiling, thirteen boilerplate archetypes at three libraries is
plausibly **100–350 live hills**, plus the ten backfill legs from §4a.

That is the number that should drive the conversation, and it is why Phase H
comes first and why §5 cuts four archetypes that teach nothing new. **If that
number is unacceptable, the honest lever is fewer libraries per archetype —
not a lower proof bar.**

---

## 8 · The two questions only TJ can answer

### Question 1 — Select or Combobox?

**Adopted 2026-08-31: fork A.** The Combobox proof stays Combobox
(Autocomplete-family). Human reference pages are
[MUI Autocomplete](https://mui.com/material-ui/react-autocomplete/) and AntD
Select-with-search. Select is a future Phase 2 archetype if/when we get
there — not a retarget of signed Combobox. V41 human signoff stands. Do not
restamp V41 (`f330a082`). Do not remint Combobox now. Remint closed:
accepted as source-faithful continuation of V41; visual mismatch with
Select docs was the wrong official page. Do not invent a new visual grade
of v42.

### Question 2 — F1, or a redefined v1?

Finishing the MUI + AntD + Astryx matrix is a **corpus** strategy. It builds
a broad, three-library foundation. It does **not** prove F1, because F1's
clause is *unseen* libraries, and these three are all seen. Adding a fourth
library to the corpus makes the corpus bigger; it does not make the corpus
unseen.

**Adopted 2026-08-31: keep F1 as the v1 gate.** Do not redefine v1 as the
three-library matrix. Phases 1–4 are corpus foundation. Phase 5 is the
gate. `overallSuccess` stays false until F1 is honestly proven. Finishing
boilerplate is necessary corpus, not a silent ship.

The rejected alternative remains named so it cannot happen quietly:
redefining v1 as "the common component set across these three libraries,
owner-graded; F1 becomes v1.1" would require editing docs/26 and docs/32's
F-checklist **in the open**. That edit was not authorized.

Completing every phase in this document still leaves **product v1
INCOMPLETE** until Phase 5 scores.

---

## 9 · What this plan explicitly does not claim

- It does not claim Checkbox is signed. Phase 1 PREPARE is offline compile
  from named package facts; no live page, no human grade, no
  `overallSuccess` flip.
- It does not claim finishing the matrix produces `1.0.0`, an npm publish, or
  a satisfied F1.
- It does not flip `overallSuccess` for any archetype.
- It does not invent a Combobox v42 grade. Fork A closed the reference
  question; it did not mint a new human visual grade.
- It does not invent library facts. Every component name in §3 and §4 is read
  from vendored source under `recipe/sandboxes/`, from
  `examples/*/contracts/`, or from the committed Astryx extraction census.

---

## Next concrete action

**Phase 1 starts now** (adopted 2026-08-31). Checkbox first, then Radio,
then Switch — each across Astryx + MUI + Ant Design when the library ships
that component. Do not wait for another planning round. Do not start
day-picker / F1 until Phase 5. Do not publish npm. Do not flip
`overallSuccess`.

H2 writer preflight and the Button perturbation exam are already on `main`
— use them, do not redo them. Phase H's remaining offline work (H1 Input/
Combobox census, H3) may run alongside the climb; it is not a gate in
front of Checkbox.
