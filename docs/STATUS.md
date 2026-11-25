# Status

Updated 2026-11-25. This is the weekly note that [docs/GOAL.md](GOAL.md) requires (AGENTS.md rule 15). It is
overwritten every week; git history keeps the old ones. Read GOAL.md first, then this page, then choose work.

The climb on Carbon's tuning list stopped on 2026-11-25. The owner agreed in chat, through the reviewer session: "I
agree with your recommendation here. Let's go ahead and move on to that." The reason: the tuned gains came almost
entirely from rules written for one named set each, and sets no PR targeted did not move. So more tuning can't raise the
held-out reading. The owner is bringing the reading forward, and the private beta becomes a product milestone, separate
from the score.

## This week's five lines

1. **What reached users:** nothing since 2026-08-05. The last npm release is `@ds-contracts/cli` 0.5.0-rc.1 (published
   2026-08-05), and it lacks `figma-to-react`. The CLI in this repository is 0.5.0-rc.3 and is unpublished.
2. **Outside users:** 0. The repository has no GitHub issue, open or closed.
3. **The four numbers per direction.** These are **tuned** numbers on Carbon's tuning list: regression only, never
   progress, and no guide to the held-out reading.
   - Figma to React, run-29 (`2d558d4db`, profile v0.46.0, 2026-11-24):
     - Coverage: 100 of 124 public sets in grammar. The 72 internal sets are in no number.
     - In-grammar first pass: 87.8% over 36 sets, 23 of them whole.
     - Raw first pass: 1,407 of 2,396 variants over the 80 kept sets.
     - Font-blocked: 8 variants.
     - Earlier tuned readings were scored without `--profile` and printed system coverage 156/196, which counts the
       internal sets. The other numbers don't change.
     - The 6 sets the fetch refused (26 variants) are in no number. That is a named miss in line 5.
   - React to Figma, a41 (`b34b7bbae`, profile v0.45.0, 2026-11-24; the commits after it, up to the tag, change only
     the Figma to React capture):
     - Coverage: 107 of 167 titles in grammar, with the 36 titles the profile excludes counted (107 of 131 without
       them), from the grammar-only read at profile v0.2.0.
     - In-grammar first pass: 88.2% over 41 sets, 33 of them whole.
     - Raw first pass: 455 of 518 variants.
     - Font-blocked: 0.
     - The two named flaky MultiSelect references are out of every claim.
4. **Spend against the cap:** AI spend was last metered at $39.67, for the A0 test (2026-11-08), and nothing has been
   metered since. The owner's plan page shows $683.85 of extra usage. Cap: $2,400 through 2026-12-23, at most $400 a
   week. Spent against the cap: _(owner to fill in)_.
5. **Top three named misses:**
   - Scoring: the Figma to React measure leaves fetch refusals out of `cells.json`, so the scorer never counts them. At
     run-29 that was 6 sets and 26 variants; rated as failures, the tuned headline would be 75.3% over 42. The reviewer
     rules on how the reading counts them.
   - Figma to React: Overflow, 16 of 96 variants failing on `nested-slot-route-not-carried` (parked).
   - React to Figma: TreeView, 0 of 4 variants. The contract step refuses it (`not-one-element`).

## Current step: the reading, then the private beta (from 2026-11-25)

Until the reviewer says otherwise, the engine is frozen at the owner's tag `carbon-reading-1` (`2d558d4db`). No PR
touches capture, the contract step, the proposer, emitters, the writer, the schema, the checker or the Carbon profile.
Product PRs stay in `packages/cli`, docs and release tooling. One PR at a time, at most 300 net added lines, no
auto-merge; the reviewer reviews and merges.

Owner:
- [x] Tag the engine for the reading: `carbon-reading-1` → `2d558d4db` (2026-11-24).
- [ ] Hand the held-out list to a reading session and start the reading.
- [ ] Fill in spend against the cap (line 4).
- [ ] Publish the CLI under `next` and release the plugin build (owner-only actions).

Reviewer:
- [ ] Rule on the reading kit's five open questions: closure scope, fetch refusals, React to Figma system coverage,
      `--profile` for the Figma to React scorer, and which code list React to Figma reads.

Agent:
- [x] Stop the climb: no conventions, profile bumps, fetches, runs or attempts (2026-11-25).
- [x] The reading kit, private and never committed: a runbook and scripts for both directions, with the list passed
      as a file. Rehearsed on a 3-set slice of the tuning list each way, matching run-29 and a41 set for set
      (2026-11-25).
- [x] Rewrite this page (2026-11-25).
- [ ] Clean-machine install test: pack 0.5.0-rc.3, install the tarball into an empty folder under `private/`,
      follow `packages/cli/README.md` literally for `figma-to-react` on one Carbon tuning set with the Carbon profile,
      then `react-to-figma`. Send the reviewer every step that fails or confuses, including how a user gets the
      Carbon profile. No fixes yet.
- [ ] Fix each install failure, one PR each.
- [ ] A Carbon quickstart at the top of the CLI README: the two journeys first, with the old verbs and the "not the
      v1 proof surface" banner moved down or removed.
- [ ] `figma-to-react` on a whole file: a link with no node-id converts every public set and writes one summary, with
      refusals by name.
- [ ] `react-to-figma` without Docker (`--browser local`), labeled not comparable to scored runs.
- [ ] The plugin build a tester needs for `--write`: confirm it builds, and write its install steps into the
      quickstart.
- [ ] Disk: send the reviewer a keep list and a delete list for `private/` (77 GB). Delete nothing until the
      reviewer answers.

## Where things live

- The one project: `/Users/tjpitre/Sites/ds-contracts-poc`.
- Carbon's profile: `examples/carbon/profile.json`. The draw and the committed tuning list (git-ignored):
  `private/carbon-draw-20261110`.
- Tuned runs (git-ignored): Figma to React in `private/tuned-b-20261110` (run-1 to run-29), React to Figma in
  `private/r2f-2026*` (a1 to a41).
- The reading kit (git-ignored): `private/reading-kit-20261125`, starting at `RUNBOOK.md`.
- Practice fonts (git-ignored): `private/beta-kits/practice-fonts-20261105`.
- Never read: the held-out list, and the sealed kit pool `~/ds-contracts-sealed` (AGENTS.md rule 5).
- Archive outside the repository: `~/ds-contracts-archive-2026-10-31`.
- In Claude Code, `/next` (`.claude/commands/next.md`) does the next unchecked agent item above and nothing else.
