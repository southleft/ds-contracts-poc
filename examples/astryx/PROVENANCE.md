# examples/astryx — provenance

The extraction subject for the second-system exhibit (Phase A). Everything in this
directory derives from the **exact npm-shipped artifact** — no clone, no fork, no
patched source.

## Subject

| | |
|---|---|
| System | **Astryx** — Meta's design system (facebook/astryx), open-sourced 2026-06-18 |
| Package | `@astryxdesign/core` — **0.1.6, PINNED** (beta 0.1.x; expect API churn — never float) |
| Theme | `@astryxdesign/theme-neutral` — **0.1.6, PINNED** |
| License | **MIT** (`package.json` `"license": "MIT"`, author "Meta Open Source"; the repo `facebook/astryx` is MIT. The 0.1.6 tarball ships no standalone LICENSE file — the license grant is the package manifest + repo.) |
| Source of truth | `node_modules/@astryxdesign/core/src` — the package **ships its TSX source** (375 `.tsx` files). Extraction provenance = the exact shipped artifact. |
| Vendor ground truth | 196 per-component `.doc.mjs` modules (props table + anatomy table + usage guidance), shipped in the same package — the independent referee for our proposals |
| Docs site | https://astryx.atmeta.com/components |
| Repo | https://github.com/facebook/astryx |
| Styling | React + StyleX (compile-time atomic classes); tokens in `src/theme/tokens.stylex.ts` (186 vars, `light-dark()` value-encoded modes); `theme-neutral/dist/theme.css` ships 178 literal custom properties |
| Assessed | `extract/pilots/SECOND-SYSTEM-ASSESSMENT.md` (2026-07-20) — the hands-on four-way assessment that selected Astryx |

## Design-side leg (future)

The assessment (§6d) records that Astryx's Figma kit is an **unofficial community
kit, v0.14** — there is no official Meta-published Figma library as of 0.1.6. No
community-file URL was pinned in the assessment; the design-side leg of this
exhibit must locate and PIN the exact community file (key + version) before any
reconcile run, and must treat it as third-party, not vendor ground truth.

## Reproduce the sandbox

```bash
cd examples/astryx/.astryx-sandbox   # gitignored, like polaris/.polaris-clone
printf '{\n  "name": "astryx-sandbox",\n  "private": true,\n  "version": "0.0.0"\n}\n' > package.json
npm install --no-audit --no-fund @astryxdesign/core@0.1.6 @astryxdesign/theme-neutral@0.1.6

# then, from the repo root — the SAME pipeline any adopter runs:
npm run extract:code -- examples/astryx/extract.config.json
```

## Minted-literal provenance (the re-anchoring round)

`tokens/astryx-minted.dtcg.json` holds the computed-floor leaves the DTCG wrap
cannot name (`imported.*`). Its values come from browser-computed truth, so
their PROVENANCE IS THE VALUE — StyleX compiles the source token name away
into a literal hex in the atomic class, which is why this example ships **no
`source-bindings.json`** and cannot run MUI's evidence-driven alias pass
(`examples/mui/scripts/promote-floor.mjs`).

Fifty-four of those leaves are no longer literals. Their provenance is a
**human ledger**, not an extraction fact:

| | |
|---|---|
| Pass | `scripts/reanchor-minted.ts` (`--propose` / `--apply`) |
| Anchor plane | `tokens/astryx.dtcg.json` — THEME-NEUTRAL, value-fingerprinted; a re-themed anchor is refused by name |
| Review queue | `tokens/reanchor-proposals.{json,md}` — 21 rows, **RESOLVED**: 0 pending. Every live leaf is either re-anchored or carries a named kept-literal receipt |
| Ledger | `tokens/reanchor-decisions.json` — 19 acked alias rows + 2 `literals` receipt rows, each with rationale/reason, `darkDelta` ack, named cause and the review provenance |
| Receipt | `tokens/MINTED.md` — N aliased / N literal / N kept-literal-by-decision / N named refusals |
| Convergence | `scripts/promote-floor.ts` re-applies the ledger after regenerating the tree, so a re-run cannot silently revert a decision |

The fifty-four are **not vendor facts**. Nine were auto-clean (1 leaf : 1
equal-valued semantic token, corroborated by a committed sibling binding in
the same contract cell). The other 45 came out of the REVIEWED round: the five
ranked value groups were split PER LEAF and each leaf was anchored only where
role-grade evidence existed — a committed sibling binding, a variant axis that
names the role, a channel that names the role, or exactly one candidate in the
leaf's role class. Two leaves were reviewed and DELIBERATELY kept literal,
with receipts. Authority: **orchestrator-reviewed under owner delegation, TJ
2026-07-26**, recorded in every row's `cause`. Two rows carry a `deviation`
field where a committed binding named a different token than the review rubric
predicted — the fact on disk won, and said so. Reverting any row is deleting it
and re-running `promote-floor.ts`.

## License attribution

Astryx is Copyright (c) Meta Platforms, Inc. and affiliates, MIT-licensed.
This directory quotes prop names, enum values, token names/values, and `.doc.mjs`
table contents as extraction evidence, and commits mechanical transformations of
the published token values (verbatim values, DTCG-wrapped). No Astryx source
files are vendored into this repository; the sandbox install is gitignored and
reproduced by the pinned command above.

## Coverage of this library — the denominator

| committed contracts | pinned by the drift instrument | library size | **coverage** |
|---|---|---|---|
| 13 | 5 | 222 | **5.9%** |

Library size: **this repo's own extractor over the whole library** — `extraction/CENSUS.md` (222 extracted, 15 named-skipped).

Every per-component number in this file — floors, `pctEqual`, token counts,
variant cells — is measured over that slice, and the slice was hand-picked for
tractability. The engine generalizing across libraries (`docs/22`) and a
library being *captured* are different claims; this row is the second one, and
it is small. Full table and how to re-derive it: [docs/22 §8.3](../../docs/22-generality.md).

## THE HARNESS RECAPTURE WAVE (task #38) — ASTRYX IS STALE, AND WHY

Every other sandboxed library (carbon, mui, tailwind, altitude) was re-captured and fully
re-promoted in this wave. **Astryx was re-captured successfully and then REVERTED.** Its
`extract/computed/out/astryx/**` and `examples/astryx/contracts/**` are at their previous state.
Its `figma/*.figma.js`, `GENESIS-BATCH.figma.js`, compile receipt and both bundles WERE re-emitted
(the engine moved and the emission is reproducible from the committed contracts — that half is
fresh).

Two blockers, both PRE-EXISTING and both reproducible at HEAD before this round touched anything:

1. **`promote-floor.ts` REFUSES.** `REFUSED: decision RA-ffffff: leaf
   `imported.button.label.color.primary` is not in the minted tree.` The committed
   `tokens/reanchor-decisions.json` ledger acks a leaf the current engine no longer mints — the
   capture mints `imported.button.label.row-rule-color.*` and no `color` leaf at all. Verified
   pre-existing by stashing the fresh capture and re-running against the committed artifacts: it
   fails identically. So astryx's contracts cannot be re-promoted by any command in the repo until
   that ledger entry is re-anchored or retired.

2. **The capture loop is NOT IDEMPOTENT for astryx.** It is the one library whose capture config
   reads its OWN SHIPPED contracts — `extract/computed/configs/astryx.json` points every component
   at `examples/astryx/contracts/<c>.contract.json`, where carbon/mui/tailwind point at a
   `contracts-seed/`. So each capture+promote cycle appends another provenance sentence to every
   `description` and bumps the `version` (observed this round: card `0.1.0` -> `0.3.0`, with
   "COMPUTED-ENRICHED (extract/computed): …" written twice). Committing one turn of that loop would
   ship a self-referential artifact that grows on every future run.

**What the reverted capture measured, recorded so the work is not invisible:** Switch came back
77.344% against a committed 76.302% — exactly the offline regate number, which means the
`ENGINE IMPROVED — absolute-positioning round f52c334 (+1.042)` gap in
`extract/computed/regate-baseline.json` is real and would have closed. Every other astryx
`captured-truth.json` and `enriched.contract.json` came back byte-identical.

**The shorthand ceiling (task #27) is NOT MEASURED for astryx** — and that is not the same as
zero. Astryx's config declares no `varPrefix` (StyleX compiles token names away), so the CSS-vars
source reader never runs and no `source-bindings.json` is written at all. The same is true of
polaris. The instrument's real numbers exist only for the four libraries whose source CSS names
its own tokens: carbon 14, tailwind 16, altitude 16, mui 2.

**Closing it** is a round of its own: re-anchor or retire `RA-ffffff`, then repoint the capture
config at a committed `examples/astryx/contracts-seed/` the way the other libraries do, so the loop
becomes idempotent. Named here rather than carried silently.
