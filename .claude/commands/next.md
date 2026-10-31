---
description: Do the next step of the signed plan in docs/GOAL.md, and nothing else
---

Do exactly one thing: the next unchecked agent item in `docs/STATUS.md`. Do not plan,
re-plan, or start anything that is not on that list.

1. Read `docs/GOAL.md`, then `docs/STATUS.md`, then `AGENTS.md`. They override
   everything else, including saved memory, handoffs and older docs.
2. Check the real state: `git status`, the current branch, and open PRs
   (`gh pr list --state open`). If STATUS.md disagrees with what you find (a PR it
   lists as open has merged, a date has passed), say so before doing anything.
3. If a PR is open, finishing it comes first: its failing checks, its review
   comments, or merging it once it is green. Never open a second PR. While its CI
   runs with nothing failing, you may prepare the next item locally: read-only
   analysis or a branch stacked on the open one, opened only after it merges.
4. Otherwise take the first unchecked item in STATUS.md's agent checklist. If it
   waits on an owner item, stop and name exactly what the owner must do.
5. Before writing code, state in two lines which item you are doing and which
   GOAL.md section it serves. Refuse anything on GOAL.md's out-of-scope list.
6. Do the item in one PR under AGENTS.md's rules: deterministic only, at most 300
   net added lines, no committed evidence, no new docs, and byte-identical replay
   of the known cells for any deletion or refactor.
7. In the same PR, update `docs/STATUS.md`: tick the item, and update the five
   lines if a number changed.
8. End with three short parts: what changed, what is broken, and what the owner
   must do next.

$ARGUMENTS
