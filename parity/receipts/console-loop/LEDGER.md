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

## 2026-08-09 — CANVAS-DRIFT sweep, first-party: 18 of 18 pinned stems in sync

Snapshot: `canvas-drift/LIVE-SNAPSHOT.json` (Desktop Bridge, two calls — ten
component stems on `BMjUA2ue5CaZXU4kufxL0z`, three older cells on
`GnQnjSNBXtgtd2Ht0Hs1C8`, five compositions on `BMjUA2ue5CaZXU4kufxL0z`).
Probe: `npm run console-loop:canvas-drift first-party`.

**This lane has no `framing.json`, and the first read of that was wrong.** The
probe's original rule — no `framing.json`, no pin, nothing to compare — would
have left all 49 stems un-probed and all **ten** of this lane's scored passes
unmeasured. But the lane *does* pin its cells: `visual-truth/first-party/<stem>.json`
records the same `cellNodeId` / `cellName` pair the foreign lanes keep in
`framing.json`, alongside the `fileKey` and `fileVersion` they were read at.
Reading them is using a pin the lane already keeps, not inventing one.

The five LAYOUT compositions have no headless card at all, so they are pinned a
second way: their receipts record **no variant count**, meaning the script built
ONE standalone COMPONENT, and `generate.nodeId` is that node. Verified live —
`7:1658` / `7:1639` / `7:1674` / `7:1632` / `7:1625` are all type COMPONENT whose
children are SLOTs, with no sibling variants. There is exactly one candidate, so
taking it is not the forbidden move of guessing a cell from a shot. Receipts that
DO record a variant count are left alone: choosing one variant out of a set
without a pin is what C1 exists to forbid.

**Result: 54 stems — 18 in-sync, 0 drifted, 36 CELL-PENDING** (stems with no card
and no sole-node receipt — `accordion-item`, `table`, `toast`, `heading`, … —
honestly un-probed rather than inferred).

**All ten scored passes are in sync**: `avatar`, `badge`, `banner`, `divider`,
`switch`, `bento-grid`, `grid-gallery`, `page-shell`, `sidebar-layout`,
`two-column`. So is every fail-closed stem that carries a pin (`button`, `card`,
`checkbox`, `text-field`, `token`, `progress-bar`, `slider`, `spinner`). Every
binding on all 18 resolved in `Semantic` or `Primitives` — two of the three
collections `emitted/01-tokens.js` creates.

### Two instrument premises died here, and both were the probe's

1. **`first-party/card` read BINDING-DRIFT on `strokeWeight` and was not
   drifted.** The wave-numbered script binds the uniform `strokeWeight`; the live
   node binds the four per-side weights. MEASURED, not assumed: a self-cleaning
   live probe on `BMjUA2ue5CaZXU4kufxL0z` (`createFrame` → `setBoundVariable('strokeWeight', border-width/100)`
   → read back → `remove()`) returned `boundVariables`
   `["strokeTopWeight","strokeBottomWeight","strokeLeftWeight","strokeRightWeight"]`
   with no exception — **Figma never stores `strokeWeight` as a key at all**. The
   probe now lowers it the same way. A sweep of every committed spec in every
   lane finds `strokeWeight` is the only uniform field of its kind (120
   occurrences), so the lowering is complete.

2. **All ten first-party stems read `FC-FONT-STYLE-UNRESOLVED`, and none had
   fallen back.** The old test was "any Inter text node AND the spec declares a
   family somewhere". This lane's contracts declare `fontFamily: "Inter"` and its
   canvas correctly draws Inter — ten false findings on an emitter doing exactly
   its job. It was also blind in the other direction: a spec declaring one family
   whose canvas drew some third face would have passed. The probe now compares the
   **drawn** family against the **declared** set. Narrower where it was wrong,
   wider where it was blind. (astryx keeps its six findings on the same rule, and
   gains two — `progress-bar` and `text-input` draw Figtree against a declared
   `-apple-system`.)

**Floor: first-party holds at 5.** Nothing converted, nothing regressed,
`RATCHET.json` untouched.

### mui is UN-PROBED, and it is named rather than inferred

`59mLQlOMiD5w5za6SUcoO5` is **not connected** to the Desktop Bridge
(`figma_list_open_files` reports three files: `GnQnjSNBXtgtd2Ht0Hs1C8`,
`BMjUA2ue5CaZXU4kufxL0z`, `HherkaLt11JSCFJVAoyWlO`). Its `framing.json` also
records **0 of 31** `cellNodeId`s — C1 was never asserted for this lane, so even
with the file open there would be no pinned cell to compare. **mui's four scored
passes (`accordion`, `checkbox`, `divider`, `table`) are therefore UNMEASURED for
canvas drift.** They are not claimed clean. Unblocking needs a human to open the
MUI file with the bridge plugin and assert C1.
