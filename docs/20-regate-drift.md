# 20 — Regate drift: what moved, why, and what is pinned

*Between the harness run that committed a scorecard and today's engine, the
offline re-fuse (`extract/computed/regate.ts`) produces different numbers for
11 of 36 components. This is the triage: every mover named, classified, and
either fixed or left open with its cause located. Defect-first — the fixes
are at the bottom because the findings matter more.*

Reproduced at `c9242cc`; the whole 36-component baseline was **re-verified at
`c1ce72d`** after the concurrent re-anchoring round moved
`examples/astryx/tokens/astryx-minted.dtcg.json` under this triage (36/36 still
match, and the astryx Slider canvas claim below was re-checked against the new
tree: 48 refs, 0 missing). The bisect numbers quoted per commit below are the
PRE-fix instrument (they were measured before fix 1); the table's "offline"
column is the post-fix instrument, which is what the baseline pins.

The offline instrument replays each committed
`captured-truth.json` through the CURRENT fusion + emitters and re-renders the
gate; it does not re-capture the library. Runtime: ~5m17s for all 36
components (real Chromium per component), which is why the number-level pin is
an on-demand script and not a 158th eval.

## The two instruments are not the same instrument

Before reading any delta as drift, three differences between the harness
(`run.ts`) and the offline runner have to be on the table. Two were already
documented in `regate.ts`'s header; the third was NOT, and it was a defect:

1. **Pixel pairs are not scored offline** — the original npm-package
   screenshots are session artifacts. Computed-equality is the only quoted
   instrument here.
2. **Carried-binding probes** resolve against the wrapped token stylesheet
   rather than the live library page, so `fusion.contradictions` legitimately
   differs (astryx Slider 30 → 150). The runner prints this as PROBE-CONTEXT
   DRIFT. It does **not** move `pctEqual`.
3. **The runner gated the WRONG contract** (fixed this round). `run.ts` gates
   the decision-applied contract (`resolved.contract.json`, run.ts:440);
   `regate.ts` gated the raw fused one. Every component carrying a
   `decisions.json` ledger was therefore compared against a scorecard produced
   from a *different contract*. Fixed — the runner now mirrors run.ts exactly.

## Classification

| component | committed → offline | class | cause, located |
|---|---|---|---|
| mui/Chip | 87.705 → **90.164** | (a) engine improved | state-plane projection `53792d3`. Reproduced 87.705 EXACTLY at its own commit `82d312f`. |
| mui/Tooltip | 70.543 → **90.698** | (a) engine improved | organism/table-lowering round `3e14f6f`. Reproduced 70.543 EXACTLY at its own commit `aab937b`. |
| astryx/Switch | 76.302 → **77.344** | (a) engine improved | absolute-positioning round `f52c334`. Reproduced 76.302 EXACTLY at `0078020`. |
| polaris/Button | 91.331 → **85.858** | **(b) engine REGRESSED — OPEN** | state-plane projection `53792d3`. See below. |
| polaris/Checkbox | 84.116 → 80.820 | (c) vocabulary change | live-paste-2 `acb0342` (sr-only hidden inputs carried as hidden). `cellsCompared` 2896 → 2440. |
| polaris/Tag | 82.056 → 80.919 | (c) vocabulary change | same class, `acb0342`. cells 8064 → 7353. |
| polaris/TextField | 81.862 → 81.857 | (c) vocabulary change | same class, `acb0342`. cells 44416 → 40832; % within 0.005. |
| polaris/Badge | 97.327 → 95.159 | **(c) polluted ledger — OPEN** | `out/badge/decisions.json` acks `{font-size-sm}` / `{spacing-0}` — REPO-convention names absent from the Polaris inventory (`{p.*}`). Surfaced only once the runner began applying the ledger the harness applies. |
| astryx/Slider | 87.908 → **55.299** | (c) contract/mint SKEW | 44 unresolved refs. See below. |
| astryx/Button | 98.099 → 95.391 | (c) contract/mint SKEW | 22 unresolved refs; measured 94.766 at `0078020` and has since IMPROVED. |
| astryx/Badge | 100.000 → 96.296 | (c) contract/mint SKEW | 1 unresolved ref; measured 96.296 at `0078020`, the commit that committed 100.000. |
| astryx/Card | 98.252 → **98.252** | — (counterfactual) | EXACT *despite* 54 unresolved refs — the affected channels are already mismatched or uncompared. Skew presence ≠ skew impact, which is why `unresolvedTokenRefs` is pinned SEPARATELY from `pctEqual`. |
| **24 others** | **exact** | — | all of mui except Chip/Tooltip, all of tailwind, polaris Avatar/Banner/ProgressBar/RadioButton/Spinner/Text/Thumbnail. |

The bisect was by CAUSE, not by commit count: eleven engine commits were
replayed in a `git worktree` (with `node_modules` symlinked) against the MAIN
repo's committed captured truth, so only the ENGINE varied. Worktrees older
than `2d2098a` lack regate's `--out` flag, so HEAD's runner was overlaid to
reach the mui/astryx out-roots.

## astryx Slider was never an engine regression

The 32-point drop is **contract/mint version skew**, and the canvas is
untouched:

- The gate's token inventory is `cfg.tokens.dtcg` (the library's BASE tree)
  plus the **freshly minted** tree. The shipped minted tree
  (`examples/astryx/tokens/astryx-minted.dtcg.json`, 237 leaves) is deliberately
  not in it — the harness's contract is freshly minted, so it never needed to be.
- The frozen promoted contract still references 14 leaves the current mint no
  longer produces (`imported.shared.color-0064e0`, `imported.slider.label.color`,
  …), because the absolute-positioning round admitted geometry channels and
  reshaped the mint (48 leaves → 111).
- `emit-html` maps ANY `{a.b.c}` to `var(--a-b-c)` with no inventory check, so
  those refs rendered as **empty custom properties** — black text where the
  package paints `rgba(78, 96, 111, 1)` — and the score simply fell, silently.
- Offline it measured **52.853 at `0078020`**, the very commit that committed
  87.908, and has IMPROVED every round since (53.397 → 55.299).

The canvas output is unaffected: `astryx-minted.dtcg.json` carries every leaf
the shipped contract references, and all 44 shipped contracts across the four
libraries resolve every ref (now pinned — see below).

## polaris Button IS a real regression — OPEN

The one class (b) finding. At `53792d3` (state-plane projection) the offline
number fell 91.095 → 85.621, `cellsCompared` unchanged at 81120,
`rowsFullyEqual` 320 → 96, and 0 unresolved refs — so it is neither skew nor a
moved denominator. The mechanism, read off the re-fused contract:

The nested-pair lift (`mintTokens({ nestedPairs: true })`) now mints a BASE
colour on the nested `label` and `icon` parts —

```
label.tokensByProp: [ …, { prop: 'tone', map: { critical: { color: '{imported.button.label.color.{variant}.critical}' } } } ]
```

— where the committed contract bound **no colour on `label` at all**. The
label used to INHERIT the root's `:hover` / `:focus-visible` colour. The new
base binding blocks that inheritance and **no nested per-state binding
replaces it**, so every hover/focus/active row renders the base colour:

```
row plain.none.micro.off.enabled__hover    committed 77/77 → offline 67/77
  label.color   ours rgba(0, 91, 211, 1)   theirs rgba(0, 66, 153, 1)
```

Not fixed here. Carrying per-state bindings on nested parts is the same
machinery the state round was built for, it needs a recapture wave to
validate, and guessing at it inside a triage round is how the state round's
own first cut over-reached (its commit message says so). Left OPEN, located to
the commit, the file, and the ref shape.

## polaris Badge's ledger is polluted — OPEN

`extract/computed/out/badge/decisions.json` carries two human-acked
resolutions to `{font-size-sm}` and `{spacing-0}` — the REPO's token spelling,
not Polaris's `{p.*}`. This is the same cross-library contamination class that
`b66e5a3` fixed for astryx (via `--out` namespacing) and never audited for
polaris. It was invisible while the runner skipped the ledger.

**The SHIPPED contract is clean** — `examples/polaris/contracts/badge.contract.json`
binds `{p.space-050}`. Only the harness-local `resolved.contract.json` is
affected. Not rewritten: a decisions ledger is a human-ack artifact, and
inventing the "right" ack is exactly what the ledger exists to prevent.

## Orphaned artifacts in the un-namespaced out root

`extract/computed/out/{card,slider,switch}/` are **astryx** captures
(`_provenance.config = astryx.json`) sitting in the polaris root — leftovers
from the pre-namespacing run. `b66e5a3` restored the 12 polaris components
from `5c93c8a` but polaris has no Card/Slider/Switch, so these three were
never cleaned. `out/slider` and `out/switch` are byte-identical duplicates of
`out/astryx/{slider,switch}`; `out/card` is a STALE pre-namespacing astryx
Card (96.853 vs the current 98.252).

They are why an astryx regate run that FORGETS `--out` still appears to work.
No eval references them. **Proposed** (not executed — deletion of committed
receipts is the owner's call): remove all three directories.

## Re-baseline policy

**No committed harness receipt is refreshed by this round, and `--write-enriched`
was not run** — the shipped contracts are unchanged, and a harness receipt
(`scorecard.json` / `numbers.json`) may only be rewritten by an actual harness
run with its double-run byte-identity check. Re-baselining a harness number
from an instrument that scores no pixels would be a downgrade wearing a
green tick.

What IS honest to record is what the OFFLINE instrument produces, so the next
round compares like with like:

- `extract/computed/regate-baseline.json` — 36 rows: offline `pctEqual`,
  `cellsCompared`, `unresolvedTokenRefs`, the committed harness number for
  context, and **`gapCause`, a named reason for every one of the 11 gaps**.
- `npm run extract:computed:drift` — re-runs all four sweeps and fails by name
  on: `pctEqual` outside tolerance (default 0.001), ANY change in
  `cellsCompared` (a moved denominator is a vocabulary change and must be
  acknowledged, never averaged into a percentage), ANY change in unresolved-ref
  count, or a component that stops fusing. `-- --write` re-records, deliberately.
- Recapture is owed for: **astryx Button/Badge/Slider** (mint skew — a
  recapture re-promotes the contract against the current mint and closes it),
  and **polaris Button** once the nested-state regression is fixed.

## Fixed this round

1. **`regate.ts` gated the wrong contract** — it now applies `decisions.json`
   exactly as `run.ts` does. Confirmed to move polaris Banner to an EXACT
   reproduction (96.356 → 96.901) and TextField to within 0.005.
2. **The gate rendered unresolvable refs silently** — `gate.ts` now runs the
   emitters' own referee (`generateCss`) over the same inventory the page
   renders with and records `unresolvedTokenRefs` in the scorecard, with a
   console warning. The astryx collapse is now a named number, not a mystery.
   The harness path gets this for free.
3. **polaris Avatar / ProgressBar / Thumbnail had been UNFUSABLE since
   `f52c334`** — `Avatar: re-fused enriched contract fails validateContract`.
   The v14 conflict rule spans `tokensByProp` AND `literalsByProp`, but
   `fuse.ts`'s set-plane-literal block only consulted `literalsByProp` and its
   per-axis merge only consulted `tokensByProp` — neither looked ACROSS the two
   fields. Once the absolute round admitted geometry channels, the mint emitted
   a per-size token for a channel a REVIEWED literal entry already owned and
   the referee refused the whole contract. Same precedence as the same-field
   rule: the reviewed entry wins, the computed value is dropped with a named
   note. All three now re-fuse **and reproduce their committed numbers
   EXACTLY** (70.652 / 92.105 / 100.000) — which is the proof the fix changed
   nothing else.
4. **New eval `shipped-contract-refs-resolve`** — every shipped contract
   resolves every token ref against its own library's trees, using
   `generateCss` as the referee, with a planted cross-library ref proving the
   check is not decorative. 44 contracts, 4 libraries. Chromium-free, so it
   belongs in the suite; the number-level pin does not, and the reason is
   measured (5m17s), not assumed.
