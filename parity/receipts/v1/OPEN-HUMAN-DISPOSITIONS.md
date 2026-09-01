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
- **Calendar** has an offline proof and a named refusal, not a live mint.

These two rows are simply the part of the blocker list that has nothing to do
with the pivot, and they are now the only part still holding the gate.
