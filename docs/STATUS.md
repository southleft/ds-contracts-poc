# Status

Updated 2026-11-01 (Step 2 started; grammar classifier, Figma to React font preflight, variant matrix rule, plugin capture and Storybook reader part 1 in). This is the weekly note that [docs/GOAL.md](GOAL.md) requires.
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
     (TextArea); 0 font-blocked. Coverage 10 of 18 sets (55.6%); inside the
     grammar, headline 13.3% and raw 3 of 198. Seven sets (64 variants) were refused before measurement: masks
     (Popover, Tooltip), a "scheme" axis that could be a variant or a theme mode
     (KBD, Radio, Autocomplete), a layout table over its size limit (TextInput)
     and generated TypeScript that does not compile (Chip).
   - React to Figma, Agriculture Design System (648 stories, 127 components):
     0 of 127 converted. The Storybook reader (part 1) reads all 648 stories:
     coverage 85 of 127 components (66.9%); out for object (33, often
     `children`), color (8) and number (6) arguments. Only 4 enumerate a
     variant axis; 41 show variants as separate stories instead.
   - Earlier fresh kits (2026-10-14 to 10-19, before GOAL.md), Figma to React:
     headline 16.3%; raw 177 of 1,344 variants (13.2%); 5 of 56 sets whole;
     57 font-blocked. On the 24 sets with a kept dump, coverage 16 of 24
     (66.7%); inside the grammar, headline 22.1% and raw 20 of 119 (Orbit's 28
     in-grammar variants are all font-blocked). The full breakdown is in this page's
     2026-10-31 Step 1 version (git history) and in
     `private/never-seen-classification-20261031`.
4. **Spend against the cap:** $0 extra usage; the Claude Code plan showed 4% of its
   weekly limit used on 2026-11-01. The cap is $2,400 through 2026-12-23, read from
   the provider's usage page.
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
- [x] React to Figma is judged only by GOAL.md's checks against the library's own
      render, with no hand-written witnesses (owner, 2026-10-31). The witnessed
      source-reference intake is regression only.
- [ ] Duplicate each drawn Figma kit into drafts, for plugin captures.
- [ ] Draw A1 after the 2026-11-20 freeze (a sealing agent can do it at the owner's
      request), and A2 on 2026-12-04.
- [ ] Run `npm publish` for the CLI under `next` when the agent says it is ready. No
      outside approval is needed.
- [ ] Recruit 5 to 8 outside testers. Paste weekly AI spend into this page.

Agent, ruler first. All of it must be built and frozen by SHA-256 on 2026-11-20
(AGENTS.md rule 6; never put a checker change and a converter change in the same PR):
- [x] Grammar classifier (ACG-1), deterministic. It marks each Figma component set
      and each story in or out of the grammar, with a named reason, and replaces the
      provisional check used in the classification. Publish coverage for A0 and the
      earlier kits. `extract/figma/grammar.ts`; coverage is in the five lines above,
      receipts in `private/grammar-coverage-20261031` (git-ignored). The most common
      reason out is an absolutely placed child (6 A0 sets, 4 earlier). A subtree with
      no text and no auto layout counts as a drawing (SVG) wherever it sits.
- [x] Font preflight, Figma to React: `scripts/font-preflight.ts` lists every face
      the design's text draws and refuses, by name and before anything is packaged,
      each one `--fonts` does not supply (exit 3, `<out>/font-preflight.json` with the
      variants for the font-blocked column).
- [ ] Font preflight, React to Figma: hold the faces a story renders with against
      Figma's font list using the same comparison, once the Storybook reader and the
      plugin capture supply them.
- [x] Variant matrix rule: the cartesian product of enumerated story arguments,
      capped at 64 per set. `extract/figma/variant-matrix.ts`: option-list arguments
      are the axes (true/false and text arguments are properties, not axes); a product
      over 64 or a repeated option is refused by name, never cut; `matchesMatrix`
      names every missing or extra axis, option and variant in a set read back from Figma.
- [x] Plugin capture, part 1: a PNG per variant at its whole-pixel layout box (and
      the painted extent when paint reaches past it), the font list with what this
      Figma can load, and variables (already in the dump), from a draft the owner
      duplicated. `extract/figma/capture.plugin.js`, run by the Sync Runner's
      "Capture reference images" button. Live on the A0 draft: Button's 150 variants
      in 0.7 s. REST dumps stay a frozen input format.
- [x] Plugin capture, part 2a: the check reads `<set>.capture.json` (`--capture`)
      instead of Figma's REST images, through the same framing proofs, for both
      directions (`scripts/design-consumer-capture.ts`).
- [ ] Plugin capture, part 2b: SVG for icons and vectors. On the A0 draft the first
      SVG export of a session took 61 s and a whole-variant export did not return;
      exporting each icon's main component once (Button: 300 slots, 1 icon, 37 ms)
      is the next try.
- [x] Storybook reader, part 1: `scripts/storybook-reader.ts` reads every story's
      arguments through Storybook's own preview API in pinned Chromium and holds
      each component against the grammar and the variant matrix rule.
- [ ] Storybook reader, part 2: render each variant with the package's own fonts in
      pinned Chromium (the reference image, never through the engine), write the
      cases with no hand-written declaration, and widen the React pin to a tested
      18.3 and 19.x range. Owner call first: do variants shown as separate stories
      count toward the matrix?
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
