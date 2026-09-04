# Open-human audit rows — what each one needs from the owner

Prepared 2026-08-29.

> **Third update — 2026-09-01, and this one is measured rather than argued.**
> The audit ledger now reads **60 rows · closed 56 · refuted 2 · open-human 2 ·
> RED 0**. It was red 7 when this page was written. `v1:readiness` on a frozen
> tree at `9553a6a5` reads **GREEN 19 · RED 5** over 24 rows.
>
> So the two rows below are, at last, *literally* the only thing under
> `V1-REL-01`. Not "the part that has nothing to do with the pivot" — the whole
> of it. Nothing red remains beneath them.
>
> The other four reds are `V1-COMPAT-03` and `V1-EVID-01` (the three astryx /
> carbon evals), `V1-CI-01` (the four signed lineages fail on Linux and pass on
> macOS — see HONEST-SCORECARD §6d), and `V1-REL-02` (deploy). None of those is
> closable without you either, but none of them is *this* page.

> **Second update, same day — and this one is good news.** Data Table minted
> live at **v32** and the mint **stayed** (page `173:48924` on Scratch), which
> closed the four remaining archetype rows. `v1:readiness` on commit `8fab2dff`
> now reports **21 of 22 rows green**, and the single RED row is `V1-REL-01` —
> whose only remaining causes are the two rows on this page. So the claim the
> correction below retracted is now, at last, true: **closing AUD-U17 and
> AUD-U22 turns `V1-REL-01` green, and with it the whole 22-row table.**
>
> That does not by itself make v1 releasable — Table's human signoff is still
> yours to give, Calendar has an offline proof and a named refusal rather than a
> live mint, and Gate 2 (the per-column width model) is an open authoring
> decision now plainly visible in the MUI root. But these two rows are no longer
> sitting underneath a pile of other blockers. They are the last automated gate.

> **Correction, earlier the same day.** This page first said these two rows "are the whole of
> `V1-REL-01` being RED". **That was wrong**, and it was wrong because I read the
> committed `audit-ledger.json` instead of re-running the gate. A full
> `v1:readiness` on the current commit reports **GREEN 17 · RED 5**, not 20/2 —
> and `V1-REL-01` names nine audit rows, not two: AUD-V06, V07, V09, U19, U29,
> U33, U37 RED, plus AUD-U17 and AUD-U22 open-human. The committed ledger marks
> the RED ones `closed`; they regressed after it was written.
>
> The first honest run found 9 rows RED. Four were one defect of mine — the
> plugin engine bundle going stale vs core after the calendar archetype was
> added — and fixing it in `cef8e4e9a` closed V1-JOURNEY-02, V1-COMPAT-04,
> V1-SEC-01 and V1-CI-02, and cleared AUD-V08, AUD-U21 and AUD-U44. The rest are
> pre-existing: typecheck and the CI lanes were already red at `228960d29`,
> verified in a scratch worktree.
>
> The two rows below are still exactly right about themselves — they are
> human-only and no automation closes them. What was wrong was the claim that
> closing them turns `V1-REL-01` green. It does not.

Two P1 rows in `parity/receipts/v1/audit-ledger.json` are `open-human`. Neither
can be closed by automation — both are recorded human approvals under
`V1-REL-02`.

This page states what was verified, what the choice is, and what I recommend. It
does not take either action.

---

## AUD-U17 — the premature `v1.0.0-rc.1` tag

**Ledger title.** _"v1.0.0-rc.1 tag exists on origin (34d92c08, unsigned) while
the checklist's 'Signed RC tag approved' row is empty."_

**Verified 2026-08-29, on this branch:**

| fact                         | value                                                  |
| ---------------------------- | ------------------------------------------------------ |
| tag object                   | `e3bd2f5205926d93004bdc2ed40bb6116107d10b` (annotated) |
| tagged commit                | `34d92c0800d1316a5eeca609af0e7bd8ccfdb72d`             |
| tagged on                    | 2026-08-08                                             |
| commits from the tag to HEAD | **1054**                                               |
| ancestor of HEAD             | yes                                                    |
| signed                       | **no** — `git tag -v` finds no signature               |
| present on origin            | yes                                                    |

The tag predates the recipe-IR pivot entirely. Everything this project now calls
its architecture — the archetype recipes, the canonical Figma-capability IR, the
loss receipts, all five archetypes — landed in those 1054 commits. `34d92c08` is
not a commit anyone would want to be holding if they pulled `v1.0.0-rc.1`.

**The choice.** The ledger states it: sign/retag on the release commit, or delete
the premature tag and record the disposition.

**Recommendation: delete it, and record why.** Retagging `34d92c08` would put a
signature on a commit that does not represent v1 in any sense. And there is no
release commit to move it to — v1 is not complete: Data Table has no live mint,
Calendar has an offline proof and a named refusal, and Button's human signoff is
still pending. A signed RC tag should wait for something to sign.

```
git push --delete origin v1.0.0-rc.1
git tag -d v1.0.0-rc.1
```

Then record the disposition against the "Signed RC tag approved" checklist row so
the ledger closes with an explicit decision rather than a deletion nobody
documented.

**Only you can do this.** It rewrites a published ref, which is outward-facing
and irreversible for anyone who already fetched it. I have not touched the tag.

**Disposition — 2026-09-03.** The owner authorised the deletion in writing
("when it comes to any Git-related things, you have access to the GitHub CLI
so you can push, tag, delete") and endorsed the recommendation. The tag was
deleted on origin (`git push --delete origin v1.0.0-rc.1` → `[deleted]`) and
locally (`git tag -d`, was `e3bd2f520`); `git ls-remote --tags origin
v1.0.0-rc.1` returns nothing. The checklist row "Signed RC tag approved"
records the disposition. `npm run release-tag:check` refuses if a premature
RC tag reappears before a release commit is named. **Closed.**

---

## AUD-U22 — the hosted plugin zip's engine

**Ledger title.** _"Hosted no-clone plugin zip carries a third engine (3de67ce4 ·
716832B) matching neither HEAD's receipt nor the working tree."_

**What the ledger says the close is.** _"The hosted zip is a deployment; a
deployment is a recorded human approval (V1-REL-02) and `npm run deploy:check` is
red by construction until it happens. docs/00 offers the hosted zip as the
no-clone path without saying which engine it carries — the deploy (or a pinned
engine stamp on that page) is the close."_

**The choice, and it is genuinely two options:**

1. **Deploy.** Publish a zip built from the release commit, so the hosted
   artifact and the receipt agree, then record the Cloudflare deployment
   approval. `npm run deploy:check` goes green only after this.

2. **Pin the engine on the page.** Leave the hosted zip where it is and state on
   docs/00 exactly which engine it carries, so the no-clone path stops being an
   unlabelled third artifact. This closes the honesty gap without a deploy.

**Recommendation: option 2 for now, option 1 at release.** The defect the audit
actually names is that docs/00 offers a download without saying what is in it —
a reader following the no-clone path cannot tell which engine they got. That is
fixable today and does not require a deployment decision. The deploy itself
belongs at the release commit, which does not exist yet.

**Only you can do this.** Both branches are a deployment or a published-artifact
decision.

**Disposition — 2026-09-03: option 2, the engine pinned on the page.** The
owner endorsed the recommendation. Fetched that day, the hosted zip is
942,148 bytes (sha256 af19cc985469…) and its `ui.html` carries a plugin
engine block of 716,887 bytes (sha256 e2eea33783b9…); HEAD's engine receipt
records a fresh bundle of 864,984 bytes (input hash e69f31e37278…). They
differ, and docs/00 now says so beside the download. `npm run
deploy:pin:check` re-fetches the hosted zip and refuses if the engine it
carries no longer matches the pin, so the page cannot drift silently. The
deploy itself (option 1, `V1-REL-02`) waits for a release commit. **Closed.**

---

---

## AUD-U?? — the sync spine has been red for 111 consecutive runs

**Not in the v1 definition.** `docs/26-v1-definition.md` names no sync-spine row,
so this does not move the readiness tally. It is here because a lane that is red
on every commit stops being read, and this one has been red on every commit for
ten days.

**Measured 2026-09-04**, from the lane's own output on `a59635b4a` and from
`sync/ledger.json` on this commit:

| fact | value |
| --- | --- |
| last green run | **2026-08-25T02:43:59Z** |
| consecutive failing runs since | **111** |
| rows the spine reports undecided | **117** |
| ledger records | 128 |
| of those, carrying a recorded decision | 59 (53 adopt, 3 pending-reapply, 2 pending-reconcile, 1 pending-restamp) |
| `sync/ledger.json` last changed | **2026-08-23** (`c8c1838db`) |

The 117 split cleanly, and the split is the whole story:

- **61 rows have never had a decision** — 34 conflict, 14 code-ahead, 13
  canvas-ahead.
- **56 rows had one, and the facts moved out from under it.** Against 59
  recorded decisions in the ledger, that is very nearly all of them: the ledger
  has not been touched since 2026-08-23, while captures and contracts have moved
  through the recipe-IR pivot and the re-capture rounds since.

By library: ds 42, mui 31, astryx 13, carbon 10, altitude 8, polaris 8,
flowbite 5.

**The lane is not broken; it is reporting correctly.** Its contract is exactly
this — exit 1 means "a row needs a human decision that is not yet recorded, or
its recorded decision has gone stale". It is doing that 117 times.

**Only you can close these, and not only because they are judgements.** Each
`adopt` / `--decide` is a per-component choice about which side is ahead, and
the pending kinds resolve by **writing to connected Figma files** —
`flowbite.alert` names file `GnQnjSNBXtgtd2Ht0Hs1C8`, not the Scratch file. I am
constrained to the Scratch file `byMp6lt0Ij9b2QbkDGFwBh` and have written
nothing here.

**My recommendation, and it is not "decide 117 things".** Two of these are
different problems wearing one hat:

1. **The 56 stale ones may be mechanical, and that is a HYPOTHESIS, not a
   measurement.** The shape fits — the ledger froze on 2026-08-23 and the
   captures under it moved afterwards — so a decision could be stale because its
   evidence hash changed rather than because anyone changed their mind. I have
   NOT verified that, because verifying it means re-observing against the
   connected Figma files and refreshing a ledger of your decisions, and I will
   not rewrite that unprompted. If the hypothesis holds, most of the 56 are
   ledger maintenance rather than 56 judgements; if it does not, they are 56
   real re-decisions. Nobody knows which until it is run.
2. **The 61 undecided ones are the real backlog**, and 42 of them are `ds.*` —
   this repository's own contracts, not a third-party library.

What I would do, if you want it done without inventing a judgement: refresh the
ledger and re-observe, so the count that reaches you is the number of decisions
you actually still owe rather than 117. Say the word and I will do the refresh
and report the residue; I will not record a decision.

---

## The full lane has produced no green verdict in its last 100 runs

**Measured 2026-09-04** over `gh run list --workflow full.yml --limit 100`,
spanning 2026-09-01T05:08Z to 2026-09-04T06:41Z:

| conclusion | runs |
| --- | ---: |
| success | **0** |
| cancelled (superseded while still pending — no job ever assigned) | 73 |
| failure (ran, and failed) | 25 |
| still running | 2 |

Two separate mechanisms, and only one is a defect:

- **The 73 are a consequence of push cadence, not a bug.** `cancel-in-progress`
  is `false` on main by design, so a full run holds the concurrency group;
  GitHub keeps at most one *pending* run per group, so every push during a long
  run supersedes the one waiting. On a branch pushed every ten minutes against a
  lane that takes about **1h40m**, almost nothing gets a slot.
- **The 25 are real.** The most recent named two failing steps:
  `extract:computed:geometry:census` and `v1:readiness`. The census half is
  closed in this commit. The readiness half is red while any docs/26 row is red.

**A CORRECTION, and it is mine.** An earlier version of this section said that
in the last full run that actually executed, the eval suite ran twice — once as
its own step and again inside `v1:readiness`. That was inferred from the
readiness step's duration (19 minutes, about the length of the suite) and it is
**false**. The run log says the opposite: `--trust-lanes` worked exactly as
designed, and V1-COMPAT-03 ran only `eval:record:check`,
`generation:atomic:check`, `provenance:check` and `verify:catalog` locally,
citing the lane for `eval` and `figma:fresh`, and went GREEN in 1 second.

Where the 19 minutes actually goes, measured from the same log: **`V1-CI-01`
re-runs the whole fast lane locally, `npm run ci:lane fast`, for 795 seconds** —
and that is by design, because that row's acceptance command in docs/26 IS the
lane. It is also the row that failed: `7/186 gate(s) failed in lane "fast"`, and
readiness ended `1 of 24 rows not green: V1-CI-01 RED`.

That last line is worth reading twice. On that commit the tally was **23 of 24**,
with a single red row, and that row was red because the fast lane had seven
failing gates. Several of those were closed tonight — the fusion-geometry census
(`✖ FUSION-SURFACE DRIFT — 7` appears in the same log), `capability:fresh`,
`format:check` and `extract:computed:drift` — and the fast lane is now green on
two consecutive commits. Whether that makes V1-CI-01 green is NOT claimed here:
the full lane running on `a59635b4a` will measure it, and no number should be
quoted until it does.

**What this means for every "the gates are green" claim in this repository:**
it should be read as *the fast lane is green*. Fast, security and catalog-visual
produce verdicts; full has not produced one in three days.

---

## CLOSED — the drift pin recorded on the wrong operating system, and the cause isolated

**The full lane produced a verdict on 2026-09-04 — its first in over 100 runs —
and immediately found a real defect in my own work.** That is the argument for
unblocking it, so it stays written here even though the row is now closed.

`extract:computed:drift:remeasure` replays committed captured truth through the
current fusion **in a real headless Chromium** (its own header says so; only the
VERIFY half is browser-free). It therefore depends on the machine it runs on.
For 138 of 139 components that does not matter. For one it does:

| where | fluent/MessageBar offline pctEqual | equal cells |
| --- | ---: | ---: |
| macOS developer machine (reproduced exactly, twice) | 99.010 | 3,200 / 3,232 |
| ubuntu-latest (full-lane run 33845428922) | 98.020 | 3,168 / 3,232 |

Same cell count, so exactly **32 cell values** differ — not the structure. I had
recorded the pin from the macOS side.

**What I did not do.** Stamp CI's percentage into the tracked scorecard. That
file also carries the declared facts and reapplied decisions the recording
machine produced, so an edited percentage would have made it a number no machine
produced sitting in a file claiming to be one machine's output. Nor did I widen
the row's `tolerance`: the field's own comment justifies itself by noting every
engine-sized move this baseline has recorded (+1.042, +2.459, +20.155, −3.296)
sits an order of magnitude above the tolerance, and the measured noise here is
0.990 against a smallest-real-move of 1.042 — the same size. A tolerance wide
enough to absorb it would swallow the smallest regression the instrument has
ever caught.

**What closed it.** The pin was RE-RECORDED on the operating system the gate
re-measures on, by running the fluent re-measure on ubuntu-latest and taking its
artifact (workflow `pin-fluent`, run 33855345966, since deleted). That run
re-recorded all twelve fluent components and **changed exactly two files** — the
baseline row and `out/fluent/messagebar/regate.scorecard.json`. The other eleven
came back byte-identical on Linux, just as they had on macOS, which is the
cleanest possible confirmation that this is one component's divergence and not a
platform-wide one.

`rerunPctEqual` is now the Linux number. The committed harness scorecard stays at
99.010, because that is what the macOS capture run measured and receipts are not
restamped; the difference between the two is named in the row's `gapCause` with
both runs cited. `extract:computed:drift` is green at 139 components.

**The cause, isolated — and I had it wrong first.** I wrote above that the cause
was not established and that font fallback "does not hold on its own", because
`astryx-core` and `tailwind` lead their stacks the same way and reproduce fine.
The two scorecards were diffable all along: the macOS one is in git history, the
Linux one is committed. Every one of the 32 cells is **the same channel with the
same value pair**:

| | `root.grid-template-columns` |
| --- | --- |
| re-fused on ubuntu-latest | `28px 138.938px 0px 0px` |
| captured on macOS | `28px 118.641px 0px 0px` |

The second track is **content-sized**, so it carries the title text's intrinsic
width as a computed value, and the 20.297px between them is the two platforms'
resolved faces differing. Fluent's stack leads with two Microsoft faces absent
from both, so macOS takes `-apple-system` (San Francisco) and Linux falls
further down. So it WAS font metrics — surfacing as a layout channel, which is
why looking at the font stacks alone did not find it, and why the two libraries
I cited as counter-examples are not counter-examples at all: they have no
content-sized grid track to expose a text width.

Four captures in the corpus record a fractional-px grid track — carbon/Toggle,
fluent/Card, fluent/MessageBar, fluent/TabList — and only this one diverged. The
Linux recording run re-recorded all twelve fluent components and changed exactly
two files.

---

## What this unblocks, and what it does not

Closing both rows **does** now turn `V1-REL-01` green, and it is the last row
that is not: readiness on `8fab2dff` is 21 of 22. That was not true when this
page was written — seven other audit rows were red then — and the Table live
mint at v32 is what changed it.

It still does not make v1 releasable. Three things are open and none of them is
automatable:

- **Table's human signoff.** The mint stays and the probe passes 20 of 20 cells,
  but a live mint is not a grade. `humanSignoff` is `pending` and I have not
  invented one.
- **Gate 2, the per-column width model.** MUI declares no cell min-width, so its
  columns are ragged by 32px, and at v32 that is visible on the canvas rather
  than only in a measurement. Choosing a column model is authoring.
- **Calendar's human signoff.** The sentence here used to read "Calendar has an
  offline proof and a named refusal, not a live mint." That was written
  2026-08-29 and the live mint landed 2026-08-30, one day later:
  `recipe/evidence/calendar-v50-mint-stays-caption-visible.json` records
  **THE MINT STAYS** on Scratch page `181:64873` — all 8 capture cells and 20
  capture responses accepted, broker `main-complete`, extract green, and every
  screenshot verdict true (six-row month, chevrons, circular selected, the
  caption "April 2026" visible between the chevrons, both day and week sets
  painting on and off). What is actually open is the same thing Table's row is
  open on: `humanSignoff` is `pending`, and a live mint is not a grade.

These two rows are simply the part of the blocker list that has nothing to do
with the pivot, and they are now the only part still holding the gate.
