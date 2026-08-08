# Console-loop corpora — finish-line inventory

Structural generate→fingerprint→round-trip loops and **developed-visual** acceptance are tracked separately. A foreign stem's visual pass is real **only** when its pixel scorecard (`<lib>/scores/<stem>.json`, written by `console-loop-developed-score.mjs`) passes the one bar: `pctAAMasked ≤ 5` **and** `compositionOk`. The gates read scorecards, never receipt booleans — a receipt pass-claim without a passing scorecard fails CI by name. Receipts with no pass-claim and named defects are **honest fail-closed**: counted, printed, and legal while the visual hill-climb proceeds. Per-lib scorecard-pass floors are pinned in [`RATCHET.json`](./RATCHET.json) so honesty cannot decay.

**Hill-climb plan:** [`CODE-TO-CANVAS-HILLCLIMB.md`](./CODE-TO-CANVAS-HILLCLIMB.md) — failure-class traps, measurement stack, wave order. Canvas→code stays deferred until the frozen code→canvas corpus is green.

| Corpus | File | Structural stems | Scorecard-passed (pixel bar) | Gate |
|---|---|---:|---:|---|
| First-party | DS-Contracts-Testing `GnQnjSNBXtgtd2Ht0Hs1C8` | **49/49** (skip native inline/stack) | 0 — all 49 visual claims **attested-only** (no scorecards yet; pixel-score job pending) | `console-loop:evidence:check` |
| MUI denominator | MUI Test 1 `59mLQlOMiD5w5za6SUcoO5` | **31/31** | 0 — all 31 visual claims **attested-only** | `console-loop:mui:evidence:check` |
| Tailwind | Testing | **5/5** | **2/5** (`badge`, `button`) | `console-loop:tailwind:evidence:check` |
| Altitude | Testing | **8/8** | **4/8** (`button`, `divider`, `heading`, `icon-close`) | `console-loop:altitude:evidence:check` |
| Astryx | Testing | **13/13** | **0/13** | `console-loop:astryx:evidence:check` |
| Carbon | Testing | **10/10** | **2/10** (`icon-button`, `text-input`) | `console-loop:carbon:evidence:check` |
| Polaris | Testing | **12/12** | **0/12** | `console-loop:polaris:evidence:check` |
| **Totals** | | **128** structural | **8/48** foreign scorecard-passed; the other 40 are honest fail-closed with named defects | see `VISUAL-AUDIT.md` |

A 2026-08-07 audit found 22 receipts flagged `matchDeveloped:true` whose own scorecards said fail (e.g. carbon/button 75.41% masked AA); those flips were **revoked** to fail-closed (each receipt carries a `visual.revoked` audit note). The earlier "31/48 visual" claim was built on those self-attested booleans and is dead. The near-pass (≤6.5 AA) flip path in `console-loop-batch-score.mjs` is deleted; passes relying on the scorer's `framingTolerant` relaxation are marked on the scorecard and surfaced by the gates. Scorecards pin `sha256` of the reference + canvas PNGs they scored; gates verify the pins against disk.

`console-loop:all:evidence:check` runs **all seven lanes** (no short-circuit) and aggregates failures.

## Visual audit

- Narrative: [`VISUAL-AUDIT.md`](./VISUAL-AUDIT.md)
- Machine: [`visual-audit.json`](./visual-audit.json)
- Method: Console MCP `figma_capture_screenshot` + property inspection vs `examples/*/receipts` and `extract/computed/out/*/receipts/pair--*.png`
- Review surface: cream `#F8F4ED` on foreign COMPONENT_SETs (translucent fills on black canvas were false negatives)

## Not looped (agent stop — no ready figma scripts / foreign kit)

| Corpus | Why |
|---|---|
| eventz-vars | No `examples/eventz-vars/figma/*.figma.js` emit yet |
| untitled-ui | Storybook contracts anchored to Untitled UI kit file (not a blank Testing sandpit) |
| Remaining polaris/carbon/altitude contract files without matching `.figma.js` | No committed Plugin script to execute |

Human/release/second-impl rows remain in `HUMAN-HANDOFF.md` — packaging + loops ≠ v1 shipped / Phase 3 Candidate.
