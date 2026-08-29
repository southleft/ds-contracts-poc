# Open-human audit rows — what each one needs from the owner

Prepared 2026-08-29. Two P1 rows in `parity/receipts/v1/audit-ledger.json` are
`open-human`. Together they are the whole of `V1-REL-01` being RED, and
`V1-REL-01` RED is a v1 blocker under docs/26's own blocker list. Neither can be
closed by automation — both are recorded human approvals under `V1-REL-02`.

This page states what was verified, what the choice is, and what I recommend. It
does not take either action.

---

## AUD-U17 — the premature `v1.0.0-rc.1` tag

**Ledger title.** *"v1.0.0-rc.1 tag exists on origin (34d92c08, unsigned) while
the checklist's 'Signed RC tag approved' row is empty."*

**Verified 2026-08-29, on this branch:**

| fact | value |
| --- | --- |
| tag object | `e3bd2f5205926d93004bdc2ed40bb6116107d10b` (annotated) |
| tagged commit | `34d92c0800d1316a5eeca609af0e7bd8ccfdb72d` |
| tagged on | 2026-08-08 |
| commits from the tag to HEAD | **1054** |
| ancestor of HEAD | yes |
| signed | **no** — `git tag -v` finds no signature |
| present on origin | yes |

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

**Ledger title.** *"Hosted no-clone plugin zip carries a third engine (3de67ce4 ·
716832B) matching neither HEAD's receipt nor the working tree."*

**What the ledger says the close is.** *"The hosted zip is a deployment; a
deployment is a recorded human approval (V1-REL-02) and `npm run deploy:check` is
red by construction until it happens. docs/00 offers the hosted zip as the
no-clone path without saying which engine it carries — the deploy (or a pinned
engine stamp on that page) is the close."*

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

Closing both rows turns `V1-REL-01` green. It does **not** make v1 releasable:
the recipe-IR archetypes are the substance of v1 and they are still open —
Data Table is blocked on an authoring decision, Calendar carries two named
refusals, and Button's signoff is pending. These two rows are simply the part of
the blocker list that has nothing to do with the pivot and has been sitting RED
underneath it.
