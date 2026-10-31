# Status

Updated 2026-10-31. This is the weekly note that [docs/GOAL.md](GOAL.md) requires.
It is overwritten every week; git history keeps the old ones. Read GOAL.md first,
then this page, then choose work. It is written for any agent or provider.

## This week's five lines

1. **What reached users:** nothing since `@ds-contracts/cli` 0.5.0-rc.1 on
   2026-08-05, which lacks `figma-to-react`. The hosted plugin zip and sites are
   August builds.
2. **Outside users:** 0. The repository has never had a GitHub issue.
3. **The four numbers per direction:** not measured under GOAL.md yet. The
   2026-10-31 audit baseline, on kits nobody had tuned for:
   - Figma to React: raw first pass 177 to 180 of 1,344 variants (about 13%), and
     5 to 6 of 56 sets whole. Coverage, in-grammar first pass and font-blocked
     counts come from Step 1. On Orbit, 57 of 59 failures were missing fonts.
   - React to Figma: no reading exists on any kit nobody tuned for.
4. **Spend against the cap:** nothing recorded since signing. The cap is $2,400
   through 2026-12-23, read from the provider's usage page.
5. **Top three named misses:** missing kit fonts (an input problem, not a
   conversion one); reference images framed from REST exports (562 variants left
   unverified on the 204 corpus); refusals before measurement (29% of the
   Semi and Arco variants).

## Step 1 checklist (2026-11-02 to 2026-11-06)

Owner:
- [ ] End the Codex bridge goal before it resumes on 2026-11-04 at 05:10.
- [ ] Get Figma's written go-ahead and settle the IP position.
- [ ] Merge PR #287 (this goal, the rules and this page).
- [ ] Compile the candidate list, commit the salted hashes, and draw A0.
- [ ] Delete `~/Sites/ds-contracts-poc-delivery`. Its commits are in this repository
      as `archive/delivery/*` branches, and its evidence is in
      `~/ds-contracts-archive-2026-10-31`.

Agent, one lane, in this order after #287 merges:
- [ ] Close PR #286 (23,725 lines, too big to review, red benchmark). Keep its branch.
- [ ] Shrink the repository with delete-only PRs (owner request, 2026-10-31): the
      frozen Recipe-IR lineages and their gates, folders nothing imports, npm
      scripts nothing calls, and scheduled workflows that are always red. Each PR
      proves the engine unchanged by byte-identical replay of the known cells.
- [ ] Classify the existing never-seen results by cause and against the grammar,
      and publish the numbers here.
- [ ] Run today's engine once on A0 in both directions, and publish the numbers here.

## Where things live

- The one project: `/Users/tjpitre/Sites/ds-contracts-poc`.
- Scoreboard inputs (git-ignored): `private/beta-kits`, including
  `hill-climb-set.json` and the 204-set references in `full204-1159`.
- Never-seen results (git-ignored): `private/held-out-intake-*`.
- Sample React workspaces (git-ignored): `private/workspaces`.
- Archive outside the repository: `~/ds-contracts-archive-2026-10-31` (git bundles,
  experiment edits, compressed receipts).
