# Newly present state paint, iteration 859

**Menu: 49 pass / 15 fail / 0 unverified**, up from 48/64 on the same retained
source and unchanged checker. All 48 prior passes remain. No set-level findings.

`type-avatarLeading_supportingText-false_check-true_state-hover` now passes:
both texts and the icon present, no text-style mismatches, 1.2074% image difference
on white and black. The source-only hover text uses #737373; the other visible
hover observations use #525252. Neither a threshold nor source pixels changed.

The importer previously paired state paint only with resting nodes, missing
paint on a newly present node. It now collects exact visible text paints over a
validated presence domain. Boolean-dependent state paint uses the existing
nested state token receiver. The coverage guard evaluates presenceByState, so
it requires nine visible paint observations rather than all 16 hover cells.
The seven absent cells establish absence, not guessed paint. Missing visible
paint remains a named refusal. Non-text paints remain outside this addition.

An initial replay exposed the old coverage guard and stayed at 48/64; after the
guard correction the second replay gained exactly the targeted variant.
The importer census completed all original 204 sets: 173 imported, zero admission
losses versus census 847, and only request 117 changed. This is an admission
regression check, not rendering qualification for the other sets.

Validation: 30 focused tests; additional negative assertion for missing visible
paint; typecheck; targeted lint; plugin flows and refreshed engine receipt;
lowering register. No push or live source mutation. Native compiler presence is
covered by the preceding integration tests; live native readback is not claimed.

Evidence in V1 private integration directory `state-paint-859/`.
Review: http://127.0.0.1:18771/state859.html.
Historical mixed global forward remains 2112/6312 (33.46%); independent reverse
remains 2203 unqualified. Known-kit gains do not prove the unseen-kit 80% goal.

Next: qualify this new carrier through independent native readback and address
remaining render differences using the current source baseline, rather than
repeating stale-input fixes. Inline React still explicitly refuses state presence.
