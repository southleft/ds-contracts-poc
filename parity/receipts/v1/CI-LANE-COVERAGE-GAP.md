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

### What `typecheck` actually reports, measured 2026-08-29

`npm run typecheck` does **not** fail on a stack limit alone. At
`--stack-size=16000` it completes and reports **8,608 errors**:

| file family                                                      | errors        |
| ---------------------------------------------------------------- | ------------- |
| `recipe/scene-readback-combobox-vN.ts`                           | 1,324         |
| `recipe/scene-readback-vN.ts`                                    | 1,303         |
| `recipe/scene-readback-vNN.test.ts` (one per version, ~103 each) | ~2,800        |
| `recipe/build-table-live-proof-vN.ts`                            | 105           |
| everything else                                                  | the remainder |

By code: 5,043 × `TS2339`, 1,860 × `TS2345`, 1,032 × `TS7006`, 196 × `TS2367`.
The `TS2367`s are the forbidden-identity guards — every writer compares its own
namespace literal against another archetype's, which is statically always false
and deliberately so at runtime.

Nearly every error is one of a handful of patterns, copied once per version.

**A focused config does not work.** Excluding the per-version families and
typechecking only the hand-written core was tried and abandoned: `exclude` only
affects root discovery, not imports, and the core genuinely imports the
versioned modules — `recipe/table-tail-census.ts` imports
`table-live-v24-contract.js` on purpose, to reuse that version's validator
rather than reimplement it. The focused run pulls in the same graph and still
times out past 10 minutes.

So there is currently **no working typecheck of any scope**, and the only fix
that reaches it is removing the duplication.

---

## 2026-09-05 — four `*:live:vN:generated:check` steps are red in CI and green locally

Named while landing the F1 compile round, **not caused by it, and not fixed here.**

`.github/workflows/fast.yml` runs these as individual steps. On `f46e749d2` four
of them failed:

    recipe:combobox:live:v42:generated:check
    recipe:table:live:v38:generated:check
    recipe:calendar:live:v50:generated:check
    recipe:input-field:live:v85:generated:check

Every one of them **also failed on the previous commit `06e1e4244`**, which
failed **23** such steps — so the set shrank rather than grew, and three of the
four name components (combobox, table, input-field) that the F1 commit never
touches.

**What is odd, and still unexplained.** Each of these compares gzipped bytes:

```ts
!existsSync(outputPath) || !readFileSync(outputPath).equals(expected)
```

Locally every one exits 0 with no drift and writes nothing. The pinned `.gz`
files are tracked (17 in `calendar-live-pivot-v50/`), and CI pins the same Node
(20.19.4), so neither a missing input nor a zlib-version difference explains it.
Something environment-dependent feeds the generation, and it is shared across
four unrelated lineages.

**Why it is recorded rather than chased.** `npm run ci:lane fast` — the gate list
this project treats as the fast lane — is **192/192 green** on this commit, and
the local `--check` for each of the four passes. The divergence is between
`fast.yml`'s step list and `ci:lane fast`, which is the same class of gap this
document already names. It needs its own round: a byte-diff of one artifact
generated on `ubuntu-latest` against the committed one, the way
[`drift pins are OS-specific`] was settled.

**Do not read the green local lane as "CI is green."** It is not, and it has not
been since at least 2026-09-04.
