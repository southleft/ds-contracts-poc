# Status

Updated 2026-10-31 (A0 measured, earlier kits classified). This is the weekly note that [docs/GOAL.md](GOAL.md) requires.
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
     sets): headline 24.6%, raw 19 of 79. The classification is below.
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

## Step 1 checklist (2026-11-02 to 2026-11-06)

Owner:
- [x] Choose one provider: Claude Code (2026-10-31). Codex is not used; ending its
      paused bridge goal in the Codex app keeps it from restarting.
- [x] Figma's go-ahead: not needed. The owner's contract allows this work and keeps
      the IP with them, and Figma knows about it (signed entry in GOAL.md, 2026-10-31).
- [x] Merge PR #287 (the goal, the rules and this page).
- [x] Compile the candidate list, commit the salted hashes, and draw A0. A
      sealing agent did this at the owner's request on 2026-10-31 (see the
      signed entry in GOAL.md). A0 is Sanity UI v2 (Figma) and the Agriculture
      Design System (React).
- [x] Delete the extra checkouts. `~/Sites/ds-contracts-poc` is the only one. Old
      commits are in this repository as `archive/*` branches and tags, and old
      evidence is in `~/ds-contracts-archive-2026-10-31`.

Agent, one lane, in this order (A0 and the classification come first because
Decision 1 needs them):
- [x] Close PR #286 (23,725 lines, too big to review, red benchmark). Its branch is kept.
- [x] Retire the old Cursor and Claude mailbox loop (its stop hook and mailbox are
      archived) and add the `/next` command.
- [x] Run today's engine once on A0 in both directions, and publish the numbers here.
      Results are above; receipts are in `private/a0-20261031` (git-ignored).
- [x] Classify the existing never-seen results by cause (missing font, image
      framing, refused as an ambiguous choice between known options, refused as
      unsupported, real conversion miss) and against the grammar, and publish the
      numbers here. Receipts and rules are in `private/never-seen-classification-20261031`
      (git-ignored). The 1,344 variants in 56 sets are Semi 848, Arco 127 plus a
      second Arco sample of 212, CollegeTown 96 and Orbit 61.
      - By cause: 177 pass, 57 missing font (Orbit's Circular), 39 image framing,
        88 refused as unsupported (paint stacks, a mask, instance identity, an
        affine host, a per-variant layout), 0 refused as an ambiguous choice, and
        150 real conversion misses. 833 have no recorded cause: the per-variant
        ledgers for Semi and the first Arco sample were in `/private/tmp` and are
        gone, and CollegeTown's Alert has no first-pass receipt.
      - Against the grammar: a provisional check of the engine's own dump (the
        Step 2 classifier does not exist yet) covers the 24 sets whose dump was
        kept. 13 are in grammar (54%). 11 are out, most often for absolutely
        placed children (7 sets); 2 are out only because an icon sits in a box
        without auto layout.
      - Top named misses on measured variants: size mismatch (149), image
        difference on black (144), missing text or icons (130). Inside the
        grammar: image difference (28 on black, 26 on white), missing font (23)
        and size mismatch (22).
- [x] Shrink the repository with delete-only PRs (owner request, 2026-10-31).
      First PR: dead folders, the three LEGACY.md files and the two always-red
      schedules. Second PR: the frozen Recipe-IR lineage (18,276 files, 261 npm
      scripts, 73 fast-lane steps and the recipe-history job). The six recipe
      files the engine uses, their tests and the evidence that live gates read
      stay. Further shrinking continues under AGENTS.md rule 11.

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

## Open question for Decision 1 (2026-11-09)

The owner asked whether a small decision model (TypeSafe's Jev, already used in
Southleft's Disposition and Component Charades) could help where pure rules stall.
In that role, deterministic code would list the candidate answers. Jev would only
pick among them, behind a confidence gate. Each decision would be frozen into the
contract and reported in GOAL.md's separate "assisted" column. Step 1 counted the
refusals that name an ambiguous choice: 6 of A0's 287 variants (the "scheme" axis)
and 0 of the earlier 1,344. One earlier refusal (Arco menu, 50 variants) reads
"unlinked-or-conflicting-owner" and may be one. Fonts, image framing and geometry
gaps would not change. Adding it before 2026-12-23 needs a signed entry
in GOAL.md.
