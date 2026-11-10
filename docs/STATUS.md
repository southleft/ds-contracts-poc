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
- [ ] The Figma data the classifier reads marks every absolutely placed child (decision
      2; for example TextInput's background and borders on Carbon). Show which sets'
      grammar verdicts change on Carbon, A0 and the fixed 40-set.
- [ ] The grammar classifier under decisions 1 and 2: ignore an argument outside the
      grammar that no story varies; admit a part pinned inside a row or column on both
      sides; refuse grid, wrapping rows and absolutely placed children of a free-form
      parent.
- [ ] The variant matrix rule under decisions 3 and 4: a cap of 128, and the profile's
      declarations of which stories make a component and which axes are real. A
      declaration selects only stories and axes the stories already have.

## Step 1 checklist (2026-11-10 to 2026-11-14): Carbon

Owner:
- [ ] Draw the held-out third of Carbon's in-grammar component sets in each direction,
      from untouched components only (or ask a sealing session to), and commit
      SHA-256(salt + held-out list).
- [ ] Review and commit profile v0 before any run that counts.

Agent:
- [ ] Pin `@carbon/react` to a version, with its public Storybook and the owner's
      draft copy of the Carbon Figma kit. Read-only inventory so far: 1.120.0, the
      Storybook built for it on 2026-11-04, and Figma file version
      2409684134896101954 (receipts in `private/carbon-step1-20261110`).
- [ ] Inventory both sides and run the grammar classifier on both, with no conversion
      attempts. The ten components in `examples/carbon/contracts` (Accordion, Button,
      Checkbox, IconButton, InlineNotification, Modal, Tabs, Tag, TextInput, Toggle)
      and every Carbon set in a practice cell count as touched and go in the tuning
      list.
- [ ] Write profile v0 and its schema from `examples/carbon/ds-library.json` and
      `extract/computed/configs/carbon.json`, holding the decision-4 declarations for
      every component, written from the stories alone before the draw.
- [ ] Commit the tuning list once the owner has drawn the held-out third.
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
