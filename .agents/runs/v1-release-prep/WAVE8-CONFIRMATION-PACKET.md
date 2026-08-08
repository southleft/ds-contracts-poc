# Wave 8 confirmation packet — outside design-system team

**Row this closes:** HUMAN-HANDOFF row 2 — "Wave 8 team drift-report
confirmation (Journey C honesty)". Source: `../post-exact-conversion-next-waves/wave8/ledger.md`
("Design-system team confirms a real drift report — Phase 2 exit").
This is a **team confirmation, not a CI gate**: a real design-system team
looks at a reconciliation (drift) report over a code+design pair and confirms
it reflects reality. Do not mark the row closed on automation output.

## What to send the team

Send **Option 1** if the team can run one command; send **Option 2** if the
packet must be self-contained. Either way, include the honesty boundary
section and the three questions below verbatim.

### Option 1 — their own pair (preferred: it is *their* drift)

Ask the team to run the reconcile leg of Journey C over their own code and
their own Figma kit:

```bash
# 1. One-time: point the config at their code (React/TS source or a CEM
#    custom-elements.json) and at a read-only dump of their Figma kit
#    (design.json exported via the DS Contracts plugin's dump, no writes).
npx tsx packages/cli/src/cli.ts init --detect     # or hand-edit ds-contracts.config.json

# 2. The drift report:
npx tsx packages/cli/src/cli.ts extract --reconcile
```

Output: `out/reconciliation.md` + `reconciliation.json` — every property
classified **agree / options-differ / code-only / design-only**, each line a
reconciliation-workshop item. Matching is transparent v0: names normalize by
lowercase-alphanumeric; enum options match on normalized sets with a small
abbreviation table (`sm ⇄ small`); everything else is **reported, not
guessed**. Nothing in this leg writes to their repo or their canvas.

Reference template for the config: `extract/pilots/shoelace/extract.config.json`.

### Option 2 — self-contained: the prepared foreign-library reports

Attach these two committed reports, produced against libraries this project
does not own, byte-reproducible from the pinned inputs beside them:

| Report | Pair | Headline |
|---|---|---|
| `extract/pilots/shoelace/out/reconciliation.md` | Shoelace CEM code ⇄ community Shoelace Figma kit (36 sets, read-only dump) | 28/58 code components matched by name; 42 properties agree, **236 need a human decision** |
| `extract/pilots/eventz/out/reconciliation.md` | Eventz code ⇄ Eventz design kit | 31/53 matched; 27 agree, **220 need a human decision** |

Also attach `extract/pilots/shoelace/README.md` (how the numbers were made,
including the vendor-prefix defect that was found and fixed) so the team can
judge the method, not just the table.

## The honesty boundary (include verbatim — do not oversell)

This report compares **API surfaces only**. Named limits, from
`docs/23-known-limitations.md`:

- **B.12** — reconciliation classifies *properties*; it cannot adjudicate a
  token, spacing, or anatomy disagreement. It will tell you your Button's
  `size` enum differs; it will **not** tell you your Button's padding differs.
- **B.11** — adopting a hand-built Figma set as contract-backed is not a verb
  this tool has; the report does not change that.
- **B.13** — the concurrent-change story (three-way merge UI, silent-revert
  guard completeness) is partial and named.

## The three confirmation questions

Ask the team to answer all three in writing (a sentence each is enough):

1. **Is the drift real?** Looking at 3+ rows you know well: do the matched
   pairs correspond to the components you'd have matched, and are the
   reported disagreements (code-only / design-only / options-differ) true
   statements about your system today — including at least one disagreement
   you already knew about independently?
2. **Is anything invented or wrong?** Did you find any row that is a false
   match, a property that does not exist on the named side, or a
   classification you can demonstrate is incorrect? (List them — a found
   defect is a more valuable outcome than a rubber stamp.)
3. **Is it usable as a Phase 2 input, given the stated boundary?** Knowing it
   covers API surface only (no tokens/spacing/anatomy), would your team use
   this report as the line-item agenda for a reconciliation workshop —
   deciding code-is-right / design-is-right / neither per row? If not, what
   is the smallest missing thing?

## Signature block

| Field | Value |
|---|---|
| Design system / team | |
| Report confirmed (Option 1 own-pair or Option 2 which report) | |
| Q1 — drift is real (answer / examples) | |
| Q2 — inventions or errors found (list or "none found") | |
| Q3 — usable as Phase 2 workshop input (yes/no + gap) | |
| Confirmer name + role | |
| Date | |
| Verdict: CONFIRMED / CONFIRMED-WITH-DEFECTS (listed) / NOT CONFIRMED | |

On receipt: file any Q2 defects as issues, attach this signed packet under
`.agents/runs/post-exact-conversion-next-waves/wave8/`, and only then close
HUMAN-HANDOFF row 2. A "NOT CONFIRMED" verdict keeps the row open and is
recorded as-is — the row exists to be failable.
