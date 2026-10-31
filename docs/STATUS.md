# Status

Updated 2026-10-31 (A0 measured). This is the weekly note that [docs/GOAL.md](GOAL.md) requires.
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
   - Earlier fresh-kit readings (2026-10-14 to 10-19, before GOAL.md): Figma to
     React 177 to 180 of 1,344 variants (about 13%).
4. **Spend against the cap:** nothing recorded since signing. The cap is $2,400
   through 2026-12-23, read from the provider's usage page.
5. **Top three named misses:** in the 223 measured A0 variants, image
   differences (205 on black, 189 on white) and size mismatches (183), which may
   partly come from Google's Inter 4 against Figma's own Inter; refusals before
   measurement (7 of 18 sets); and React to Figma has no library reader.

## Step 1 checklist (2026-11-02 to 2026-11-06)

Owner:
- [x] Choose one provider: Claude Code (2026-10-31). Codex is not used; ending its
      paused bridge goal in the Codex app keeps it from restarting.
- [ ] Get Figma's written go-ahead and settle the IP position.
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
- [ ] Classify the existing never-seen results by cause (missing font, image
      framing, refused as an ambiguous choice between known options, refused as
      unsupported, real conversion miss) and against the grammar, and publish the
      numbers here.
- [ ] Shrink the repository with delete-only PRs (owner request, 2026-10-31): the
      frozen Recipe-IR lineages and their gates, folders nothing imports, npm
      scripts nothing calls, and scheduled workflows that are always red. Each PR
      proves the engine unchanged by byte-identical replay of the known cells.
      First PR done: dead folders, the three LEGACY.md files and the two
      always-red schedules. Next: Recipe-IR.

## Where things live

- The one project: `/Users/tjpitre/Sites/ds-contracts-poc`.
- Scoreboard inputs (git-ignored): `private/beta-kits`, including
  `hill-climb-set.json` and the 204-set references in `full204-1159`.
- Never-seen results (git-ignored): `private/held-out-intake-*`.
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
contract and reported in GOAL.md's separate "assisted" column. Step 1's count of
"refused as an ambiguous choice" says how much it could help. Fonts, image framing
and geometry gaps would not change. Adding it before 2026-12-23 needs a signed entry
in GOAL.md.
