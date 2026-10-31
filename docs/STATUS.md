# Status

Updated 2026-10-31 (Step 1 closed, Decision 1: continue, Step 2 started). This is the weekly note that [docs/GOAL.md](GOAL.md) requires.
It is overwritten every week; git history keeps the old ones. Read GOAL.md first,
then this page, then choose work. It is written for any agent or provider.

## This week's five lines

1. **What reached users:** nothing since `@ds-contracts/cli` 0.5.0-rc.1 on
   2026-08-05, which lacks `figma-to-react`. The hosted plugin zip and sites are
   August builds.
2. **Outside users:** 0. The repository has never had a GitHub issue.
3. **The four numbers per direction**, from A0 (today's engine, run once on
   2026-10-31 with fonts supplied and no edits):
   - Figma to React, Sanity UI v2 (18 sets, 287 variants): headline 8.8% (mean
     of per-set pass rates); raw 8 of 287 variants (2.8%); 1 of 18 sets whole
     (TextArea); 0 font-blocked. Coverage waits for the grammar classifier in
     Step 2. Seven sets (64 variants) were refused before measurement: masks
     (Popover, Tooltip), a "scheme" axis that could be a variant or a theme mode
     (KBD, Radio, Autocomplete), a layout table over its size limit (TextInput)
     and generated TypeScript that does not compile (Chip).
   - React to Figma, Agriculture Design System (648 stories, 127 components):
     0 of 127. The engine has no reader for a library's stories; every case
     needs a hand-written declaration, which first pass does not allow.
   - Earlier fresh kits (2026-10-14 to 10-19, before GOAL.md), Figma to React:
     headline 16.3%; raw 177 of 1,344 variants (13.2%); 5 of 56 sets whole;
     57 font-blocked. Inside the grammar, where it can be checked (13 of 24
     sets): headline 24.6%, raw 19 of 79. The full breakdown is in this page's
     2026-10-31 Step 1 version (git history) and in
     `private/never-seen-classification-20261031`.
4. **Spend against the cap:** nothing recorded since signing. The cap is $2,400
   through 2026-12-23, read from the provider's usage page.
5. **Top three named misses** on A0, after a labeled rerun with Inter 3.19 gave
   identical results (so the font version is not the cause):
   - Figma's vertical text trim (`leadingTrim: CAP_HEIGHT`) is never read, so
     single-line text boxes render 10 to 12 px too tall. This one missing fact
     explains all 183 size mismatches (Button, Badge, Select, MenuItem).
   - Icons inside components are missing from the output (checkmark, spinner,
     close, select chevron): 36 variants.
   - Seven of 18 sets were refused before measurement, and React to Figma has
     no library reader.

## Step 2 checklist (2026-10-31 to 2026-12-11)

Step 1 closed on 2026-10-31: A0 measured both ways, the earlier 1,344 variants
classified, and Decision 1 taken early by the owner (continue; signed entry in
GOAL.md). Git history keeps the Step 1 checklist.

Owner:
- [x] Decision 1: continue (2026-10-31, signed entry in GOAL.md).
- [ ] Duplicate each drawn Figma kit into drafts, for plugin captures.
- [ ] Draw A1 after the 2026-11-20 freeze (a sealing agent can do it at the owner's
      request), and A2 on 2026-12-04.
- [ ] Run `npm publish` for the CLI under `next` when the agent says it is ready. No
      outside approval is needed.
- [ ] Recruit 5 to 8 outside testers. Paste weekly AI spend into this page.

Agent, ruler first. All of it must be built and frozen by SHA-256 on 2026-11-20
(AGENTS.md rule 6; never put a checker change and a converter change in the same PR):
- [ ] Grammar classifier (ACG-1), deterministic. It marks each Figma component set
      and each story in or out of the grammar, with a named reason, and replaces the
      provisional check used in the classification. Publish coverage for A0 and the
      earlier kits.
- [ ] Font preflight: refuse missing fonts by name before work starts, reported in
      their own column, both directions.
- [ ] Variant matrix rule: the cartesian product of enumerated story arguments,
      capped at 64 per set.
- [ ] Plugin capture: a PNG per variant at whole-pixel bounds, SVG for icons and
      vectors, the font list and variables, all from a draft the owner duplicated.
      REST dumps stay a frozen input format.
- [ ] Storybook reader: read story arguments, render with the package's own fonts in
      pinned Chromium, and write `ds-contracts.react.json` with no hand-written
      declaration. Widen the React pin to a tested 18.3 and 19.x range.
- [ ] Freeze on 2026-11-20: commit the SHA-256 of the checker, the grammar
      classifier and the variant matrix rule.

Agent, climb (practice kits only, one named miss class per PR, shared rules only).
Rule 8: each fix must also help a practice kit other than the one that motivated it
and break no known cell. A0 is now practice and regression only.
- [ ] Figma's vertical text trim (`leadingTrim: CAP_HEIGHT`, the CSS
      `text-box-trim` equivalent): all 183 A0 size misses. Before writing code,
      check which other practice kits use it. Semi and Orbit use none, so rule 8
      needs a second kit. If none qualifies, say so and do not ship it as an
      A0-only fix.
- [ ] Icons inside components (checkmark, spinner, close, select chevron): 36 A0
      variants.
- [ ] A0's refusals that are plain defects, not grammar: Chip's generated
      TypeScript does not compile, and TextInput's layout table is over its size
      limit.
- [ ] Carry each variant's observed values (a full default plus per-variant
      differences) instead of refusing them.

## Where things live

- The one project: `/Users/tjpitre/Sites/ds-contracts-poc`.
- Scoreboard inputs (git-ignored): `private/beta-kits`, including
  `hill-climb-set.json` and the 204-set references in `full204-1159`.
- Never-seen results (git-ignored): `private/held-out-intake-*`, classified in
  `private/never-seen-classification-20261031`.
- Sample React workspaces (git-ignored): `private/workspaces`.
- Sealed kit pool, outside the repository: `~/ds-contracts-sealed`. Agents never read
  it; only the owner or a sealing agent reveals a slot at its draw.
- Archive outside the repository: `~/ds-contracts-archive-2026-10-31` (git bundles,
  experiment edits, compressed receipts).
- In Claude Code, `/next` (`.claude/commands/next.md`) does the next unchecked agent
  item above and nothing else.
