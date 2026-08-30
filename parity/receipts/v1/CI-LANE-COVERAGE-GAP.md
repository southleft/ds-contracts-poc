# V1-CI-01 — the 330 unlaned per-version scripts

Measured 2026-08-29. `npm run ci:lanes` refuses any gate-shaped script that no
workflow runs and that `EXCLUDED` gives no reason for. It names **330**, and they
are one family: superseded per-version live lineage.

| family                      | versions                           | gate-shaped scripts each | unlaned |
| --------------------------- | ---------------------------------- | ------------------------ | ------- |
| `recipe:combobox:live:vN:*` | v1–v40 (v41 is current, now laned) | 5                        | 200     |
| `recipe:table:live:vN:*`    | v1–v26 (v27 is current, now laned) | 5                        | 130     |

The five per version are `generated:check`, `authorization-template:check`,
`authorization:self-test`, `smoke`, `lifecycle:simulate`.

## What has already been fixed

- `recipe:table:check` and `recipe:calendar:check` — new or never-laned offline
  gates — now run in the fast lane.
- `recipe:combobox:live:v41:check` and `recipe:table:live:v27:check`, the two
  **current** lineages, now run in the fast lane. Those are the versions a
  regression could actually reach.

343 → 330. Every remaining entry is a superseded version.

## The decision, with numbers

The repo already contains **both** sanctioned answers, and they disagree on cost:

**A — lane every composite.** This is what `input-field` does: all 84 of its
per-version `:check` composites are steps in `fast.yml`. Applying it to combobox
and table means 66 more steps.
_Measured cost:_ one composite takes **15–17s** (`table:live:v27:check` 15s,
`combobox:live:v41:check` 17s). 66 × ~16s ≈ **+18 minutes** on a lane that
already carries 84 input-field composites (~21 min of the same work).

**B — exclude them with a stated reason.** This is what `input-field` v6 does,
and its reason is already written in `.github/scripts/lane-coverage.ts`:

> "V6 bytes are held by `recipe:pivot-status:check`; v7 replaces the lifecycle in
> the fast lane."

That reason is true for every superseded version here: `recipe:pivot-status:check`
hash-verifies every historical artifact and **is** in the fast lane, and a
superseded version cannot be re-run anyway — its authorization is spent, its run
identity is on the forbidden list, and the protocol forbids restarting a failed
attempt as-is. Re-running v18's smoke tests frozen history.
_Cost:_ `EXCLUDED` matches by **exact key**, so B needs either 330 hand-written
entries or a small pattern mechanism added to `lane-coverage.ts` itself.

## Recommendation

**B, with a pattern mechanism.** Option A spends ~18 minutes of every PR
re-verifying immutable history whose bytes `pivot-status` already hash-checks in
the same lane, and the audit ledger separately reports both CI lanes red and slow
since 2026-08-08 — adding 18 minutes to that is the wrong direction.

If B is taken, the pattern should be narrow and loud: match only
`recipe:(combobox|table):live:v<N>:(generated:check|authorization-template:check|authorization:self-test|smoke|lifecycle:simulate)`
for N **below** the current version, carry the reason above, and print every
excluded script by name so the exclusion stays visible rather than silent.

**Not taken here.** Either option changes what CI claims to cover for 330
scripts, and B changes the gate's own matching logic. That is an owner call.

## The root cause underneath

The architecture copies 12–15 npm scripts and ~19 TypeScript files per live
version. The repo carries **1,932 npm scripts** and **4,026 TypeScript files**,
of which **2,734 under `recipe/` are per-version live scaffolding** — 95% of that
directory. The same duplication is why `npm run typecheck` cannot complete: it
exhausts TypeScript's binder stack at the default size and runs past 10 minutes
with `--stack-size=16000`.

Fixing the duplication — parameterising the version instead of copying it —
would close `V1-CI-01`, `AUD-V06`/`AUD-U37` (typecheck) and this page at once.
That is a much larger change and is named here, not attempted.
