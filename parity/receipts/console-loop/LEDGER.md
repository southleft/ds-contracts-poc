# Console-loop ledger — DS-Contracts-Testing

File: https://www.figma.com/design/GnQnjSNBXtgtd2Ht0Hs1C8/DS-Contracts-Testing  
Transport: Figma Console MCP `figma_execute` + `clientStorage` chunk upload  
Recorded: 2026-08-06

| Result | Count |
|---|---|
| Completed receipts | **49** |
| Failed | 0 |
| Skipped (native) | 2 (`inline`, `stack`) |
| First-party contracts | 51 |

Gate: `npm run console-loop:evidence:check` (requires all 49).  
Eval: `console-loop-evidence-receipt` (191/191 suite).  
Emit: `npm run console-loop:emit` → `emitted/` (gitignored scripts).

Per-component evidence: `components/<stem>.json` + `.md`.

## 2026-08-08 — REFERENCE-TRUTH round: this lane's basis, stated explicitly

**Reference basis for the first-party lane: OWN SOURCE — and it is the only lane
where that is the correct answer.** There is no npm package to render: the truth
of a first-party contract is `src/components/<Comp>`, so every reference under
`parity/receipts/console-loop/refs/` is produced by
`scripts/console-loop-render-ref.mts` (contract-default props, `src/styles/tokens.css`
light mode, the Inter v20 latin face pinned from `extract/computed/fonts/inter/`)
or, for the five layout stems, `scripts/console-loop-render-composition-ref.mts`.

This lane was therefore **not** re-pointed by this round and **not** re-scored:
its 10 scorecard passes stand on the same basis they always had. Recorded here
because after this round "developed reference" is no longer a phrase anyone may
use without saying which of three things it means — a library render, a contract
render, or own source. This lane is the third.

The verified state is unchanged: 10 scorecard passes (avatar, badge, banner,
divider, switch + the five layout compositions), floor 5, five honest
fail-closed stems (button, card, checkbox, text-field, token).

### Board-wide repair found by doing the re-measure: C5 had a silent kill switch

`scripts/console-loop-capture-framing-check.mjs` ran the C5 REFERENCE SWEEP only
when the receipt's `referenceSource` resolved into a directory literally named
`gate-shots`. So the moment a lane was re-pointed at the library render —
`orig-shots/`, the entire point of this round — **C5 went inert for that lane while
still reporting itself as enabled**. astryx hit this at `f26c1205`, and the
`console-loop-reference-content-checks` eval was already **red on the committed
tree** naming it exactly ("C5 no longer fires on astryx/badge — the sweep is
enabled but inert"). Nothing surfaced it because that eval is **absent from the
committed `evals/results.json`** (216 rows recorded, 217 registered), so the "213/216,
three named reds" summary never counted it.

Both `gate-shots/` and `orig-shots/` are per-combo sibling sets keyed
`<combo>__<interaction>.png`, so both now sweep. With the fix C5 is live again on
`astryx/badge` (pinned `blue__default` 88.6% vs sibling `neutral__default` 7.6%,
gap 81.0pt over 14 siblings), still named-open as `FC-REF-SWEEP-DECOY`, and the pin
stays green board-wide at 54 named-open findings with no stem red. Without this
one-line change, this round would have disabled C5 on all six retargeted lanes.
