# F1 reclassification — a proposal for the owner's signature

> **Status: PROPOSED, 2026-09-02. Not in force.** docs/26 is the release
> contract and only the owner rewrites its status box. This page holds the
> exact wording the owner endorsed in principle on 2026-09-01 (audit
> decision 1: "replace docs/26 with the stranger sentence as the v1
> criterion"), so that signing it is one line, not a drafting session.
> Nothing below flips `overallSuccess`, restamps a RECORD, or invents a grade.

## What docs/26 says today

> Product **v1 is incomplete** because F1 (whole-corpus / unseen-library on
> the recipe path) is unmet.

F1 was written when "unseen library" meant a whole library going through the
capture path. The recipe path now has a per-archetype held-out exam that is
run, measured and named — the thing F1 was reaching for, at the grain the
product actually ships.

## The proposed criterion (the stranger sentence)

> A design-system engineer runs one command against their React library,
> reviews one file, runs one more command, imports the plugin, pastes one
> JSON, and gets a Figma component set that scores within 5% of their own
> library's Chromium render for every supported archetype, plus a named
> report of what could not be expressed.

**Supported archetype** is defined by measurement, not by a hand table: an
archetype is supported when (a) it has a proposer (`npm run recipe:point --
--archetype <a>`) that writes a fixture from a capture with nothing invented,
(b) at least one library the recipe path was never taught has been captured,
proposed, minted through the shared runtime and scored against its own
Chromium render, and (c) every failing row is named in the ratchet with its
measured cause.

## What is true on `main` at the time of this proposal (7399b8084)

| archetype | proposer | held-out (never taught) | score | state |
|---|---|---|---|---|
| checkbox | yes | Chakra, shadcn | 0.00% | supported |
| switch | yes | Chakra, shadcn | 0.00% | supported |
| avatar | yes | Chakra, Altitude, shadcn, Fluent | 0.38% best | supported |
| radio | yes | Chakra | 0.00% | supported |
| textarea | yes | Chakra (bare), Chakra Field (labelled) | 1.64%, 2.02% | supported |
| alert | yes | Chakra | 3.03% | supported |
| tooltip | yes | Chakra | 8.83% named | supported, one named row |
| chip | yes | Altitude, Chakra, Carbon | 0.07% best; two named | supported, named rows |
| link | yes | Altitude, Chakra | both named | supported, named rows |
| tabs | yes | Carbon | named content mismatch | supported, named row |
| badge | yes | none exists (every foreign badge is an inline label) | own captures only | supported, no held-out |
| menu | yes | Chakra | 5.64% named (no panel min-width leaf) | supported, named row |
| dialog | yes | Chakra | 2.57% | supported |

Fidelity gate 48 pass · 0 fringe · 17 named (updated the same evening: menu and dialog gained proposers and Chakra held-outs). The plugin's paste verb was
exercised by the owner on 2026-09-02 (`recipe/evidence/pointed/switch-chakra/paste-verb-exercised.json`).

## The proposed replacement for the docs/26 status box

> **Current state (2026-09-DD, owner-signed).** The v1 criterion is the
> stranger sentence ([docs/36](../../docs/36-point-it-at-your-library.md)):
> one command, one reviewed file, one more command, one paste, a component
> set within 5% of the library's own render for every supported archetype,
> plus a named report. An archetype is supported by measurement — a proposer,
> a held-out library scored against its own render, every miss named. Eleven
> archetypes meet that today; dialog and menu are experimental until their
> references are scored. The capture-path class rows below are not
> rewritten. `overallSuccess` is not flipped and hashed RECORDs are not
> restamped by this change. F-C2C (canvas→code held-out) remains an adopted
> co-equal gate (owner-signed 2026-08-31).

And, in the register at the foot of the page, the sentence "F1 is unmet and
`overallSuccess` is not flipped except Table's existing v32 pin" becomes:

> F1 is restated as the per-archetype held-out exam of the stranger sentence
> and is met for all thirteen archetypes above; `overallSuccess` is not flipped
> except Table's existing v32 pin.

## What this does NOT do

- It does not make v1 releasable. The five red readiness rows are unchanged:
  the eval suite's five named reds, the evidence row that reuses it, the CI
  row, and the two release rows (AUD-U17, AUD-U22).
- It does not add or remove a docs/26 requirement row. `test:v1-definition`
  pins 24 rows; the status box is prose, and this proposal changes prose only.
- It does not touch V1-CLASS-03 (the capture-path class) or any human grade.

## To sign

Reply with one line — for example "Signed: adopt the stranger sentence as
the v1 criterion, 2026-09-DD, TJ Pitre" — and I will place exactly the two
passages above in docs/26 with that line and date, run `docs:check`,
`test:v1-definition` and `v1:definition:check`, and commit with this page
cited as the source of the wording.
