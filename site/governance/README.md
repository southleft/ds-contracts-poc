# Spec governance — RFC index

How the contract schema changes: a lightweight RFC convention modeled on the
repository's receipts culture. One file per proposal, numbered, committed
under this directory; the index below is the record.

The bar, in one line: **fixture first, eval second, claim last** — the same
claims rule that governs the rest of the repository
([CONTRIBUTING.md](../../CONTRIBUTING.md)).

## Process

1. Open a GitHub issue describing the field case (the real component a real
   system cannot express honestly today).
2. Copy [`TEMPLATE.md`](./TEMPLATE.md) to `RFC-NNNN-<slug>.md` (next free
   number), fill every section — projections for **all four emitters** and
   refusal rules are not optional — and open a PR adding it with status
   `draft`.
3. Review happens on the PR. Acceptance means the receipts plan is credible,
   not that the code exists yet.
4. Implementation lands as its own PR(s): schema change + fixtures + evals +
   the spec-site reference section (the site's coverage guard fails the build
   until the new branch is documented — the documentation step is mechanical,
   not optional).
5. The RFC's status is updated to `accepted` (or `rejected` / `withdrawn`,
   both of which are kept — a rejected proposal with named reasons is a
   receipt too).

## Index

| RFC | Title | Status | Schema round |
|---|---|---|---|
| _none yet_ | — | — | — |

No RFCs predate this index. The schema's v2–v13 history was built before this
convention existed and is documented as such — in the schema source's own
commentary, [MILESTONES.md](../../MILESTONES.md), and the spec site's
versioning page (`/spec/versioning/`) — not retro-fitted into RFC files.
