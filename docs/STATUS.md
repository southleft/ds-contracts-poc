# Status

Updated 2026-11-09 (the pivot: owner, 2026-11-09, signed entries in GOAL.md; one design system at a time, Carbon first, and grammar decisions 1 to 4). This is the weekly note that [docs/GOAL.md](GOAL.md) requires.
It is overwritten every week; git history keeps the old ones. Read GOAL.md first,
then this page, then choose work. It is written for any agent or provider.

## This week's five lines

1. **What reached users:** nothing since `@ds-contracts/cli` 0.5.0-rc.1 on
   2026-08-05, which lacks `figma-to-react`. The hosted plugin zip and sites are
   August builds.
2. **Outside users:** 0. The repository has never had a GitHub issue.
3. **The four numbers per direction**, from the capped A0 AI test (2026-11-08). A0 is a
   practice kit: these numbers are decision input, never progress and never a first
   pass. Receipts and the full report are in `private/a0-ai-test-20261109`.
   - Figma to React, Sanity UI v2 (18 sets, 287 variants): coverage 10 of 18 sets
     (55.6%), 198 in-grammar variants. The engine alone: in-grammar headline 13.3%,
     raw 3 of 198 (8 of 287 over all 18 sets). With AI fixing the checker's named
     misses for 3 rounds: in-grammar headline 60.3% to 76.9% (engine's code plus
     repairs 60.3% and 70.0% over two runs; AI with only the contract's prop map 70.3%,
     76.9% keeping each set's best round). 0 font-blocked. Seven sets can't be judged
     today: four have no contract and three are refused on framing.
   - React to Figma, Agriculture (10 in-grammar components with a variant axis, 52
     variants): the engine converted none at the test. Since then it writes a contract for each
     in-grammar component; of 7 written and checked, 5 count as sets, 9 of 35 variants pass
     (2026-11-09). AI with the reader's measurements: 27.3%
     after 3 rounds (15 of 52, 1 set whole), 34.0% keeping each set's best round over
     6; AI without them 8.6%. 0 font-blocked. 26 of A0's 62 in-grammar components have
     no options and could never count before the no-option fix.
4. **Spend against the cap:** $39.67 of AI spend for the A0 test (275 calls, plus one
   stopped call that reported no cost), against the $2,400 cap through 2026-12-23.
5. **Top three named misses** on A0 after the test:
   - Figma to React: Button's image differences on white and on black remain in every
     arm, and repairs broke passing variants (Button 104 to 5 of 150 in one round).
   - React to Figma: image differences on 8 of 10 components even with the reader's
     measurements, and content missing on SkeletonBox, StatusBadge and
     TableHeaderSortable.
   - The ruler: seven Figma to React sets can't be judged, ComboboxRenderItem's
     references are unreadable, and the 5% whole-image limit let a thinner border
     pass on a mostly empty image.

## Step 0 checklist (2026-11-09 to 2026-11-19)

The universal climb stopped on 2026-11-09 (owner, signed entry "One design system at a
time" in GOAL.md). Git history keeps the old plan's Step 2 checklist.

Owner:
- [x] Sign the pivot: one engine, one profile per system, Carbon first (2026-11-09).
- [x] Sign grammar decisions 1 to 4 (2026-11-09, "Sign all four").
- [x] Cancel the A1, A2 and B draws. `~/ds-contracts-sealed` stays sealed and unread,
      kept for a later North Star reading.

Agent, one PR at a time, all merged before 2026-11-20 (rule 6). Each checker PR shows
the before and after grammar and matrix counts on Carbon, A0 and this repository, with
nothing in-grammar lost unless a decision says so, plus the Figma to React practice
baseline and the fast lane.
- [x] The Figma snapshot refresh lands, so main stays green (#357, 2026-11-10).
- [x] The form-field box: a form field's box holds its text in Figma. In the page an
      input or textarea has no child nodes, so its box is an empty painted box; in
      Figma the same box holds its placeholder or value as text, and the check
      accepted only empty Figma boxes. A painted Figma box holding only text may now
      stand for an input or textarea, and nothing else; geometry and the text checks
      are unchanged. Stored captures, old check against new: A0 202 variants, 8
      change (SearchBox fail to pass; Field and TimeInput lose only that miss), this
      repository 92, 3 change (TextField loses only that miss); 0 move to fail.
      Grammar and matrix counts are unchanged (no classifier or matrix code).
- [x] The Figma data the classifier reads marks every absolutely placed child (decision
      2): the classifier now reads a shape's own placement (`shape.x`) as well as `abs`,
      so Carbon TextInput's background and borders count. Landed with the next item.
- [x] The grammar classifier under decisions 1 and 2: an argument outside the grammar
      that no story varies refuses nothing; a part pinned inside a row or column is in on
      both sides (in code, read from each story's render: a drawn absolutely placed
      element whose containing block is flex or block flow); grid, wrapping rows and a
      placed child of a free-form parent stay out. In grammar before, then after: Figma
      Carbon 109 to 156 of 196 sets, the fixed 40-set 98 to 105, A0 24 to 25; code
      Carbon 38 to 96 of 132 titles, A0 85 to 81 (9 out for wrapping rows, grids and one
      overlay placed outside the component), this repository 25 to 52. No Figma set leaves
      the grammar. Receipts in `private/grammar-decisions-20261110` (git-ignored).
- [x] The variant matrix rule under decisions 3 and 4: a cap of 128, and the profile's
      declarations of which stories make a component and which axes are real. The reader
      takes a profile (`--profile`, its `components`: name, stories, axes); a declared
      story must exist and belong to one component, a declared axis must be one the
      stories have, and an undeclared argument stays at the story's value. In a declared
      title every story is assigned or left out with a fixed reason (test, playground,
      repeat, left-out-variant; reviewer, 2026-11-10). Decision 3's signed examples were
      wrong (the working session's arguments-only inventory): under the cap alone Button
      stays out (its icon stories' own option lists are 1,008 and 504) and the feature-flag
      FileUploader gives no variants (own renders); PasswordInput (96) and MultiSelect (96)
      come in. Button comes in at 84 only through a declaration.
- [x] A story that adds no variant is named as a repeat, never dropped silently: under
      declared axes (it differs only in undeclared values, such as IconButton's badge
      story) and without them (it differs only in an object argument, such as a
      with-ai-label story); no verdict or count moves. The grammar-only output lists
      each component's repeats.
- [x] A profile's `excluded` titles, with fixed reasons (`feature-flag-copy`, `deprecated`,
      `preview`, `non-visual-utility`), kept in the denominator in their own column
      (reviewer, 2026-11-10): the reader refuses any other reason, an unknown title, or a
      title both excluded and declared, by name; an excluded title never becomes a
      component and is reported with what it would have been; coverage is printed with
      it counted (the headline) and without.
- [x] Grammar decision 5 in the variant matrix rule and the reader, before 2026-11-20
      (owner, 2026-11-10, "Sign decision 5"): each instance a story draws of its own
      component is a variant, named by its declared axes read from React's tree; what
      the story draws beside it is context. A story the profile assigns to a component
      matches the stories file's own `subcomponents` entry by that name, else the file's
      component; an unset axis reads the default the stories file documents, else
      `(default)`, named per component. Read with profile v0: 100 of 164 in grammar, 90
      with an accepted matrix (918 variants), 10 with none; without the 37 skeleton-only
      components, 64 of 91, 59 (887 variants), 5 (receipt in `private/decision-5-20261110`).
- [x] Skeleton-only components and sets in their own column, before 2026-11-20 (owner,
      2026-11-10, "Own column"): a `skeleton` mark in the profile, which the reviewer
      session checks against what each marked component renders; the reader carries it;
      Figma sets whose every variant is a skeleton are tagged from data, never a name in
      code; the headline leaves both out and coverage keeps them. The scorer is now
      committed (`extract/figma/scoreboard.ts`; the readings so far were scored by private
      scripts), with icon-only and glyph-only read from what each set draws, the same test
      on both sides, and font-blocked variants in no rate (reviewer rulings, 2026-11-10).
- [x] Carbon's Figma kit is its public sets, before 2026-11-20 (owner, 2026-11-10, "Public
      only"): the internal marker is profile data (`figmaInternal`, the "_" prefix), never in
      code; an internal set is in no number, coverage included, and is counted beside the
      reading (the scorer, PR #370); the draw takes public sets only.

## Step 1 checklist (2026-11-10 to 2026-11-14): Carbon

Owner:
- [x] Draw the held-out third of Carbon's in-grammar component sets in each direction,
      from untouched components only (or ask a sealing session to), a third of each
      group separately (the rest, icon-only, glyph-only, skeleton-only; 2026-11-10), from
      Carbon's public Figma sets only (2026-11-10, "Public only"), in paired units (a code
      component and its Figma sets are drawn together; a unit with a touched member is
      tuning on both sides; reviewer, 2026-11-10), and commit SHA-256(salt + held-out
      list), with the Figma scope "public".
      Drawn 2026-11-10 by the reviewer session at the owner's request, from `eligible.json`
      (SHA-256 21304c69b70b72e0…cbca12b876) with `draw.py` (6356d95e1a42e2b2…1495761f).
      SHA-256(salt + held-out list): 5c830b342c9c1727f46ecd6e3508936a6cc0157e829c690fcbdd684fb7992d9e.
      Figma scope: public (56 internal in-grammar sets left out). Held out:
      rest 23 of 68 units (28 of 69 code, 30 of 74 Figma members); skeleton-only 3 of 9
      units (3 of 9 code, 0 of 0 Figma members);
      icon-only and glyph-only 0 of 0. Touched units, tuning on both sides: 19.
      If the DataTable unit is held out, the reading also reports "sensitivity: without the
      DataTable unit" (`private/carbon-draw-20261110/README.md`).
      The tuning list (63 code components, 70 Figma sets); from this commit on, work
      only on these (AGENTS.md rule 5):
      Code: AILabel, AISkeletonIcon, AISkeletonText, Accordion, AccordionSkeleton,
      AspectRatio, Button, ButtonSkeleton, Checkbox, CheckboxSkeleton, CodeSnippet,
      ComboButton, ContainedList, CopyButton, DefinitionTooltip, Dropdown, DropdownSkeleton,
      FileUploaderSkeleton, FluidComboBox, FluidComboBoxSkeleton, FluidDatePicker,
      FluidDatePickerSkeleton, FluidDropdown, FluidDropdownSkeleton, FluidMultiSelect,
      FluidMultiSelectSkeleton, FluidNumberInput, FluidNumberInputSkeleton,
      FluidPasswordInput, FluidSelect, FluidSelectSkeleton, FluidTextArea,
      FluidTextAreaSkeleton, FluidTimePicker, FluidTimePickerSkeleton, FormLabel, Heading,
      IconButton, IdPrefix, InlineLoading, Loading, MenuButton, MultiSelect, OrderedList,
      OverflowMenu, Pagination, PaginationNav, ProgressIndicator, ProgressIndicatorSkeleton,
      Select, SelectSkeleton, SkeletonIcon, SkeletonPlaceholder, SliderSkeleton,
      StructuredList, Tag, TextInputSkeleton, Theme, Tile, TimePicker, ToastNotification,
      TreeView, UnorderedList.
      Figma: 103045:4335 Badge indicator, 104376:11673 Breadcrumb, 11797:285083 Structured
      list, 11828:285325 Branch node item, 11948:286738 Tree view, 12652:263145 Icon shell,
      129078:468147 Status notification, 14032:290635 Dropdown - Default, 14032:291311
      Dropdown - Multi-select - Default, 14032:291673 Dropdown - Filterable multi-select -
      Default, 14505:302528 Dropdown - Fluid, 14505:304219 Dropdown - Combo box - Fluid,
      14530:300220 Dropdown - Multi-select  - Fluid, 148071:8767 Tag - Operational,
      15784:271032 Text input - Default, 16031:269750 Tag - Read-only, 16193:272726
      Contained list, 16827:270697 Form modal - Fluid, 17422:270657 Checkbox group,
      17544:266768 Time picker items - Fluid, 17544:266804 Time picker items - Clock -
      Fluid, 17544:266925 Time picker items - Timezone - Fluid, 17544:267989 Date picker -
      Single calendar - Fluid, 17544:268235 Date picker - Range calendar - Fluid,
      17544:268301 Time picker - Default, 17544:268399 Time picker - Fluid, 1830:2341 Screen
      + Grid influencers, 1854:1776 Button, 18791:274643 Text area - Fluid, 19893:290998
      Number input - Default, 19893:291117 Number input - Fluid, 20125:279432 Tile,
      2133:10716 UI shell - Header actions, 2154:8478 Accordion item, 2213:15047 UI shell -
      Header menu, 2799:20761 Pagination - Nav, 3038:25739 Toggle, 31131:96397 Menu,
      31420:317548 Menu button, 31753:68447 Combo button, 3193:29303 Checkbox, 3238:28455
      Inline loading, 3284:27542 List item, 3284:27553 List, 3673:40574 Slider, 3717:45725
      Overflow, 3889:50204 Pagination - Table bar, 3890:50605 Tabs, 3925:58667 Progress
      indicator, 4080:55366 Modal, 41061:1531 Slider - Range, 4120:66497 Slot group – 10,
      4179:105911 Notification - Inline, 4260:102550 Form modal - Default, 4266:103999 Code
      snippet - Single line, 4266:104904 Code snippet - Inline, 45988:11486 Dropdown -
      Filterable multi-select - Fluid, 46254:7550 Tag - Selectable, 49956:2376 Status icon,
      49975:12573 Status shape, 51447:2035 AI label - Inline, 61653:7458 Structured list -
      Selectable, 68771:7312 Password input - Fluid, 78017:897920 Loading, 83808:100856 Slot
      group – 2, 83808:101101 Slot group – 4, 84336:35011 Notification - Toast, 86528:9674
      Cursor blink animation, 92123:1663 UI shell - Header, 9506:402924 Progress bar.

Reviewer session (owner, 2026-11-09):
- [ ] Review and commit profile v0 before any run that counts.

Agent:
- [x] Pin `@carbon/react` to a version, with its public Storybook and the owner's
      draft copy of the Carbon Figma kit: 1.120.0, the Storybook built for it on
      2026-11-04, and Figma file version 2409684134896101954 (`examples/carbon/profile.json`).
- [x] Inventory both sides and run the grammar classifier on both, with no conversion
      attempts (grammar-only reader and REST classification; receipts in
      `private/carbon-step1-20261110`, git-ignored). The ten components in
      `examples/carbon/contracts` and the 12 Carbon sets in practice cells are touched
      and form the profile's tuning list.
- [x] Write profile v0 and its schema (`examples/carbon/profile.json`, checked by
      `SystemProfile` when the reader loads it), with the decision-4 declarations for
      every component, written from the stories alone before the draw: 128 components,
      36 titles excluded with fixed reasons, 85 stories left out with reasons (80 of them
      left-out variants, each with what it would add: a decoration, icon or other content
      drawn inside the component, or a value no axis carries). Read with it: 109 of 164
      in grammar (109 of 128 without the excluded titles), 54 with an accepted matrix
      (899 variants); 55 in grammar have no variants because every story shows several
      instances or content beside it. Each of the 11 stories the reader names as a repeat
      is shown genuine by the instance's own props and its rendered subtree (receipt in
      `private/profile-v0-20261110`, git-ignored). AI-drafted; the reviewer session
      approves it by merging.
- [x] Profile v0.1, before the eligible list is recomputed (reviewer, 2026-11-10): Tag
      `type` and RadioButton `checked`, `disabled` (the axes their showcase instances draw);
      SelectableTag, DismissibleTag and OperationalTag as their own components, marked
      `subcomponent` (refused by name: their stories file lists none); one layout-flagged
      story each left out as a left-out variant (Checkbox, RadioButton, Dropdown,
      ContainedList and Tag, all in grammar); the 37 skeleton-only marks, the Figma
      skeleton data and the internal-set marker (`figmaInternal`: the "_" prefix). Read with
      it: 107 of 167 in grammar, 94 with an accepted matrix (957 variants); without the
      skeleton marks, 71 of 94, 63 (926). AI-drafted; the reviewer session approves it by
      merging (receipts in `private/profile-v01-20261110`).
- [x] Profile v0.2, before the draw (reviewer, 2026-11-10): `pairs`, each code component's
      public Figma sets with its basis (the set's page, its name, a State=Skeleton variant;
      an internal part a practice cell touched carries the touch), written from names and
      structure alone; 65 entries, DataTable one unit (every DataTable story title is the
      same React DataTable, sharing the table's parts), with 28 code components and 24
      public sets left unpaired and named.
      AI-drafted; the reviewer session approves it by merging (receipt in
      `private/profile-v02-20261110/pairs.txt`).
- [x] Commit the tuning list once the owner has drawn the held-out third (above, under the draw).
- [x] The reader's `--only <file>`, so a tuned run renders reference images for the tuning
      list only (reviewer, 2026-11-10): pass 1 reads every story as before; a listed name
      that is not a component refuses the run. On this repository's Storybook, the 5 listed
      components' entries and 38 reference images are byte-identical to a full run's.
- [x] The reading harness (`scripts/reading.ts`; reviewer, 2026-11-10), so the Dec 7 reading
      runs from committed code: each value from its run receipt, never guessed, and a set
      missing one refused by name; the committed scorer's first line per direction, and the
      sensitivity line without the largest paired unit when the reading holds it (from the
      profile's pairs). It reproduces all 380 numbers of the A0 AI test from the same
      receipts (`private/reading-harness-20261110`).
- [ ] Take a tuned baseline reading with the unchanged engine.

Next dates: 2026-11-20, the checker, the grammar classifier and the variant matrix
rule freeze by SHA-256. Step 2, the climb on the tuning sets, runs 2026-11-15 to
2026-12-04.

## Where things live

- The one project: `/Users/tjpitre/Sites/ds-contracts-poc`.
- Scoreboard inputs (git-ignored): `private/beta-kits`, including
  `hill-climb-set.json` and the 204-set references in `full204-1159`.
- Never-seen results (git-ignored): `private/held-out-intake-*`, classified in
  `private/never-seen-classification-20261031`.
- Sample React workspaces (git-ignored): `private/workspaces`.
- Practice fonts (git-ignored): `private/beta-kits/practice-fonts-20261105`, 8 public
  faces from pinned sources, each with its SHA-256 and license. Rebuilt on 2026-11-05:
  the September manifest lived in `/tmp` and was lost (rule 12).
- Practice baseline on this Mac, regression only (git-ignored):
  `private/beta-kits/baseline-20261105`, and `-b` with the painted-font check.
- Sealed kit pool, outside the repository: `~/ds-contracts-sealed`. Agents never read
  it; only the owner or a sealing agent reveals a slot at its draw.
- Archive outside the repository: `~/ds-contracts-archive-2026-10-31` (git bundles,
  experiment edits, compressed receipts).
- In Claude Code, `/next` (`.claude/commands/next.md`) does the next unchecked agent
  item above and nothing else.
