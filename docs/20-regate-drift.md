# 20 — Regate drift: what moved, why, and what is pinned

*Between the harness run that committed a scorecard and today's engine, the
offline re-fuse (`extract/computed/regate.ts`) produces different numbers for
11 of 36 components. This is the triage: every mover named, classified, and
either fixed or left open with its cause located. Defect-first — the fixes
are at the bottom because the findings matter more.*

*Updated by the **GATE-INVENTORY FIX** (task #21): the fix this document
proposed and deliberately did not execute has now LANDED. The gate's inventory
is the token set the SHIPPED contract can actually see, the astryx three moved
55.333 → 90.387, 96.296 → 100.000 and 95.391 → 98.724, and every unresolved ref
across the 36 components is now zero. Start at "GATE-INVENTORY FIX" below.*

*Updated by the **REPAIR WAVE** (task #19): 3 of the 4 open items are closed and
the 4th is falsified — the astryx fix this document prescribed was executed and
does not work, and the real cause is named. Only 5 of 36 components now differ
from their committed receipt, all of them for reasons that are documented
vocabulary changes rather than defects. Start at "REPAIR WAVE" below; the
triage-round sections are kept beneath it, marked where superseded.*

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

## GATE-INVENTORY FIX (task #21) — the proposal landed

The gate exists to measure the fidelity of the **shipped** truth. It was
measuring it against an inventory the shipped contract could not see:
`gate.ts` built both its token inventory AND its rendered custom properties
from `cfg.tokens.dtcg` + the run's FRESH mint, never the library's SHIPPED
minted tree. Every reviewed-layer ref the current mint no longer produces
therefore rendered as an EMPTY custom property — black text, missing fills —
and the percentage fell with no receipt saying why.

**What moved.** All four sweeps re-run before and after; these are the only
rows that changed, and none moved DOWN.

| component | offline before → after | committed receipt before → after | unresolved refs | cellsCompared |
|---|---|---|---|---|
| astryx/Slider | 55.333 → **90.387** | 55.333 → **90.387** | 44 → **0** | 2944 (unchanged) |
| astryx/Badge | 96.296 → **100.000** | 96.296 → **100.000** | 1 → **0** | 1512 (unchanged) |
| astryx/Button | 95.391 → **98.724** | 95.391 → **98.724** | 22 → **0** | 11520 (unchanged) |
| astryx/Card | 98.252 → **98.252** | 98.252 (not re-run) | 54 → **0** | 1144 (unchanged) |
| the other 32 | **byte-identical numbers** | untouched | 0 → 0 | unchanged |

Astryx Card is the counterfactual holding: 54 refs stopped rendering empty and
**not one cell changed**, because those channels were already mismatched or
uncompared. That is precisely why `unresolvedTokenRefs` is pinned SEPARATELY
from `pctEqual` — presence of skew is not impact of skew, in either direction.

The denominator never moved: no vocabulary changed, only what the page could
resolve. And the pixels agree with the computed metric, which is the check
that the gain is real rather than metric-shaped — astryx Badge's mean AA fell
1.674 → 1.315 and Slider's 2.529 → 1.975 (Slider's *max* AA rose 4.782 →
4.990: one row is marginally worse in pixels while the mean improves, named
rather than averaged away). astryx Button's pixels are **identical** to three
decimals — its 22 refs are `outline-color` / `row-rule-color` channels the
gate stage does not paint, so the computed metric moved and the render did
not. Both facts are the same fact stated at two instruments.

**The precedence rule, from first principles: FRESH FIRST, SHIPPED FALLBACK.**
The fresh mint is the run's own measured truth for every leaf it produces —
letting a stale shipped value win would measure the library as it was, not as
it is. The shipped tree exists to fill the leaves the run NO LONGER mints,
which a shipped contract's reviewed layer may still bind (fusion preserves
reviewed bindings by design, so a recapture re-mints *around* them and never
re-creates them). The rule is only safe because collisions are REPORTED:
`Scorecard.shippedMinted.divergent` names every leaf both trees carry with
different values, so a leaf whose fresh value disagrees with the shipped one
is a finding, never a silent choice.

**Divergences found, all four libraries: 134 leaves across the 36 components,
and 133 of them resolve to the identical value.** They are the alias passes'
work — the shipped tree names an equal-valued semantic token where the fresh
mint holds the literal (`#4e606f` vs `{color-text-secondary}` = `#4E606F`).
The receipt carries `resolvedEqual` per row so a REAL disagreement cannot hide
among them.

*Colour notation is not colour, and the first cut of that comparator got it
wrong: string equality called **34** of those pairs "different" — `#ffffff` vs
`{color-white}` = `#fff`, `#00000099` vs `{palette-text-secondary}` =
`rgba(0, 0, 0, 0.6)` — every one of them the same pixel. Colours are now
canonicalized through the same `kindOf` the mint itself uses, so a false alarm
of that size does not ride into the receipts.*

**The one genuine divergence, named: polaris `imported.tag.button.left`.** The
shipped tree carries a per-axis GROUP (`none: 0px`, `large: 53.9219px`); the
current mint produces a UNIFORM leaf `53.9219px`. Fresh wins the path, so the
shipped group's two children become unreachable in the merged tree — the one
case where fresh-first has a cost, and the reason the row is reported rather
than resolved in silence. It costs nothing today, and here is exactly why: the
gate scores the RE-FUSED contract, which binds the new uniform spelling, while
the SHIPPED contract binds `.none`/`.large` and resolves them against the
SHIPPED tree (`shipped-contract-refs-resolve` passes). Both worlds are
self-consistent; the drift is between them, and it is now on a receipt instead
of in nobody's hands.

**Two things had to be fixed alongside it, both named:**

1. `mintedTokenCss` printed a DTCG alias verbatim
   (`--imported-shared-color-0064e0: {color-accent};`) — invalid CSS, i.e. a
   silent empty custom property wherever a shipped tree is rendered. It now
   emits `var(--color-accent)`, which keeps the alias a reference so the
   library's own stylesheet (and its modes) still decide the value. No
   committed artifact contained such a declaration, so nothing regenerated;
   the fresh mint emits literals only, which is why this never fired before a
   shipped tree reached a renderer. **It is load-bearing, measured by
   ablation**: with the shipped tree merged in but the aliases still printed
   raw, astryx Slider scores **79.789**, not 90.387 — 10.6 of the 35 points
   are that one line. (It also has a cost: `core/` is in the Figma plugin's
   engine bundle, so `figma-sync/plugin/engine.receipt.json` needs
   re-recording — see the report for this round.)
2. The apply-time decision check in `run.ts` / `regate.ts` carried the comment
   "the SAME inventory the gate renders with" and was true only by
   coincidence. It is now true by construction — one exported function
   (`gate.ts` `gateInventory`), three callers. Measured no-op today: no
   committed ledger in any of the four libraries targets an `imported.*` ref
   (`decision-ledger-value-check` pins that), so the widened inventory admits
   nothing new — it removes a twin of the same defect before it can fire.

**Config surface.** `tokens.minted` (repo-relative) on the capture config,
added to all five configs. `loadConfig` REFUSES a declared-but-absent path by
name, because the failure mode of this defect is precisely a silent fallback.
The eval `gate-inventory-shipped-minted` pins that every config in
`extract/computed/configs/` names an existing tree, that the gate inventory
resolves the 44 astryx Slider refs the fresh mint alone cannot, and — the
falsification — that withholding the shipped tree brings all 44 back.

**Receipts re-stated, not drifted.** The astryx three were re-run through the
REAL harness (pinned `@astryxdesign/core@0.1.6` sandbox, double-run
byte-identity on `scorecard.json` and `numbers.json`), so the committed
receipts carry the corrected measurement and agree with the offline instrument
to three decimals. `captured-truth.json`, `enriched.contract.json` and
`resolved.contract.json` came back BYTE-IDENTICAL — the recapture changed the
measurement, not the artifact.

**Left open, by name.** astryx **Card** and **Switch** were not re-run (out of
the named scope, and the repair wave did not recapture them either), so their
committed `scorecard.json` still records the pre-fix `unresolvedTokenRefs` (54
and 0). Card's `pctEqual` is proven unmoved by the offline instrument, so a
recapture there is cosmetic — but the 54 in that committed file is a stale
number and this is the sentence that says so.

## Classification

| component | committed → offline | class | cause, located |
|---|---|---|---|
| mui/Chip | 87.705 → **90.164** | (a) engine improved | state-plane projection `53792d3`. Reproduced 87.705 EXACTLY at its own commit `82d312f`. |
| mui/Tooltip | 70.543 → **90.698** | (a) engine improved | organism/table-lowering round `3e14f6f`. Reproduced 70.543 EXACTLY at its own commit `aab937b`. |
| astryx/Switch | 76.302 → **77.344** | (a) engine improved | absolute-positioning round `f52c334`. Reproduced 76.302 EXACTLY at `0078020`. |
| polaris/Button | 91.331 → **85.858** → **91.331** | **(b) engine REGRESSED — FIXED (repair wave)** | state-plane projection `53792d3`. Repaired by the inheritance-aware nested refusal; reproduces the committed number EXACTLY (74088/81120 cells, 320/960 rows). See below. |
| polaris/Checkbox | 84.116 → 80.820 | (c) vocabulary change | live-paste-2 `acb0342` (sr-only hidden inputs carried as hidden). `cellsCompared` 2896 → 2440. |
| polaris/Tag | 82.056 → 80.919 | (c) vocabulary change | same class, `acb0342`. cells 8064 → 7353. |
| polaris/TextField | 81.862 → 81.857 | (c) vocabulary change | same class, `acb0342`. cells 44416 → 40832; % within 0.005. |
| polaris/Badge | 97.327 → 95.159 → **97.327** | **(c) FOREIGN ledger — FIXED (repair wave)** | not "polluted"; the file was the **astryx** Badge ledger, whole. Removed; 2 unresolved refs → 0, committed number reproduced EXACTLY. See below. |
| astryx/Slider | 87.908 → 55.299 → **90.387** | (c) INSTRUMENT SCOPE — **FIXED (task #21)** | 44 unresolved refs, **all 44 present in the shipped minted tree**. The gate now carries that tree: 0 unresolved, 55.333 → 90.387, harness receipt re-run to match. |
| astryx/Button | 98.099 → 95.391 → **98.724** | (c) INSTRUMENT SCOPE — **FIXED (task #21)** | 22 unresolved refs, all 22 in the shipped minted tree → 0. Harness receipt re-run to 98.724. |
| astryx/Badge | 100.000 → 96.296 → **100.000** | (c) INSTRUMENT SCOPE — **FIXED (task #21)** | 1 unresolved ref, present in the shipped minted tree → 0. Back to 100.000 by measurement — the "unreproducible" number was the pre-defect one, and the defect is what made it unreproducible. |
| astryx/Card | 98.252 → **98.252** | — (counterfactual, still exact) | EXACT *despite* 54 unresolved refs, and STILL exact now that all 54 resolve — the affected channels are already mismatched or uncompared. Skew presence ≠ skew impact, which is why `unresolvedTokenRefs` is pinned SEPARATELY from `pctEqual`. |
| mui/Menu | 93.434 → **94.152** | (c) vocabulary change | MOLECULE LIVE-DEFECT ROUND (round 6). The portal capture no longer carries MUI's full-bleed `position:fixed; inset:0` Popover LAYER as the root: the demotion drops 4 non-painting elements (the layer, the INVISIBLE `MuiBackdrop`, two classless focus-trap sentinels) and promotes the PAPER. `cellsCompared` 198 → 171; the surviving parts are the ones that draw, and they score better. Re-baselined with the cause in `regate-baseline.json`. |
| mui/Dialog | 95.604 → **95.402** | (c) vocabulary change | Same round: the two classless focus-trap sentinels are dropped from the captured anatomy (they draw nothing, contain nothing, and lowered to full-bleed invisible frames over the component). `cellsCompared` 455 → 435. Those sentinel rows matched nearly perfectly, so removing them LOWERS the surviving percentage while the canvas strictly improves — the clearest case yet for pinning the denominator separately. |
| **22 others** | **exact** | — | all of mui except Chip/Tooltip/Menu/Dialog, all of tailwind, polaris Avatar/Banner/ProgressBar/RadioButton/Spinner/Text/Thumbnail. |

The bisect was by CAUSE, not by commit count: eleven engine commits were
replayed in a `git worktree` (with `node_modules` symlinked) against the MAIN
repo's committed captured truth, so only the ENGINE varied. Worktrees older
than `2d2098a` lack regate's `--out` flag, so HEAD's runner was overlaid to
reach the mui/astryx out-roots.

## REPAIR WAVE (task #19) — what this round changed

Four items were taken from the triage above. Two were repaired at the engine,
one was a data removal, and one was **falsified**: the fix this document
proposed for astryx does not work, and the real cause is somewhere else.

| item | before → after | outcome |
|---|---|---|
| polaris Button nested-state colour | 85.858 → **91.331** | FIXED — inheritance-aware nested refusal |
| astryx Button/Badge/Slider skew | 22 / 1 / 44 unresolved refs | **NAMED BLOCKED** — recapture executed faithfully and did NOT close it; true cause located (below) |
| orphaned `out/{card,slider,switch}` | 3 dirs | REMOVED |
| polaris Badge ledger | 95.159 → **97.327**, 2 refs → 0 | FIXED — the ledger was astryx's, whole |

Guards added: evals `nested-inheritance-refusal` and
`decision-ledger-value-check` (both Chromium-free, both self-falsifying).

## astryx is an INSTRUMENT SCOPE defect, not contract/mint skew

This document's own §"astryx Slider was never an engine regression" named the
cause as version skew and prescribed a recapture. **The recapture was run — all
three components, real harness, pinned sandbox at `@astryxdesign/core@0.1.6`,
double-run byte-identity IDENTICAL — and it closed nothing.** Numbers before and
after are the same to three decimals, and every unresolved ref survived.

The reason it cannot work, and the actual cause:

- Those refs live in the **reviewed layer** of the shipped contract
  (`anatomy.label.tokens.font-size = {imported.shared.size-14}`), not in the
  fresh enrichment. Fusion preserves reviewed bindings by design — that is the
  whole point of the static layer — so a recapture re-mints around them and
  leaves them exactly where they were.
- Every one of those refs **does resolve**: all 22 of Button's, Badge's 1, and
  Slider's 44 are present in `examples/astryx/tokens/astryx-minted.dtcg.json`
  (237 leaves), which is why the eval `shipped-contract-refs-resolve` passes and
  why the canvas is fine.
- What is actually wrong is the **gate's inventory**. `gate.ts` renders with
  `cfg.tokens.css` + `mintedTokenCss(FRESH mint)` and builds its inventory from
  `cfg.tokens.dtcg` + the FRESH mint. The library's **shipped** minted tree is
  in neither. So the gate scores a contract against a token set the contract was
  never promoted against, and the reviewed layer's leaves render as empty custom
  properties. The premise recorded above — "the harness's contract is freshly
  minted, so it never needed to be" — is false for any contract whose reviewed
  layer carries minted refs from an earlier round.

**Proposed fix — EXECUTED (task #21), and the falsification test it named was
run first.** Give the gate the shipped minted tree as well as the fresh one,
fresh winning on collision, for BOTH `tokenInventoryFromJson` and
`mintedTokenCss`. The prediction held on both halves: astryx's rows went to
zero unresolved refs (44/22/1/54 → 0), and polaris/mui/tailwind did not move a
single digit across 32 components. See "GATE-INVENTORY FIX" at the top for the
numbers, the precedence rule, and what had to be fixed alongside it.

What the recapture DID buy, and why it was kept: the committed astryx receipts
were stale. `astryx/Badge` claimed **100.000**, a number no current engine can
produce. The three components now carry numbers a real harness run actually
measured (96.296 / 95.391 / 55.333), each with double-run byte-identity, so
committed and offline agree and the rows' `gapCause` is empty for the first
time. Card and Switch were NOT recaptured (out of the named scope) and keep
their existing gaps. *(Task #21 superseded those three numbers with
100.000 / 98.724 / 90.387 — same harness, same pinned sandbox, same
double-run byte-identity, this time with the inventory defect fixed. The
sentence above stays because it is what "Badge's 100.000 is unreproducible"
looked like BEFORE the cause was found: the number was real, and the defect
was what made it unreachable.)* `promote-floor` was deliberately NOT re-run for astryx: the
shipped contracts already resolve every ref, so regenerating them would churn
shipped artifacts and the bundle pins without closing anything.

## astryx Slider was never an engine regression

*(Triage-round text, kept for the record. Its headline still holds — this is
not an engine regression and the canvas is untouched — but its CAUSE and its
prescribed fix are **superseded by the section above**: the refs resolve fine
against the shipped minted tree, and a recapture does not close them.)*

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

## polaris Button IS a real regression — FIXED (repair wave)

**Repaired.** The offline gate now reproduces the committed harness scorecard
EXACTLY — 91.331%, 74088/81120 cells, 320/960 rows fully equal — and the
re-fused contract is **byte-identical to the committed
`enriched.contract.json`**, which is why no downstream artifact (shipped
contract, figma script, genesis, bundle) needed regenerating: the engine
produces exactly what was already committed.

The fix, in `fuse.ts`, is an **inheritance-aware refusal** in two halves so
that neither half can drift from the other:

- `prepareMint` MEASURES the fact: for a non-root part and a CSS-inherited
  channel, is the value identical to its nearest ancestor's on EVERY captured
  plane? For Button's `label.color` the answer is yes on all 960 planes — base
  and all four state planes — because the label never had a colour of its own;
  what the capture recorded there IS inheritance. A guard rejects the candidate
  when the ancestor carries the channel nowhere (astryx Slider's `label-3` is
  the live example, receipted).
- `applyMintToContract` APPLIES the policy: refuse the base binding when the
  channel is inheritance-only AND its own state delta goes uncarried. "Uncarried"
  is read from the outcome, because a delta can die at either of two doors —
  the nested-state vocabulary (Button's `label`, a pair ref) or *before minting*
  (Button's `icon`, padding-incompatible coverage → `stateCodeOnly`). Reading
  only the mint bindings repaired the label and left the icon broken: 89.507,
  not 91.331. Both doors were needed.

Why it is never worse: if the child's truth equals the ancestor's on every
plane, an uncarried child renders whatever the ancestor renders and inherits
its accuracy exactly, while a base binding can only be right on the planes that
do not move — and the rule fires only when a plane does move. Round 4 already
refuses a base-plane LITERAL on these same channels for these same reasons
("Button's primary label went dark"); this closes the `tokensByProp` door the
nested-pair lift opened beside it.

Blast radius, measured — and it is not zero elsewhere, so stating it precisely
matters. The refusal fires on **three** components across the 36:

| component | binding refused | pctEqual | cellsCompared |
|---|---|---|---|
| polaris/Button | `label.color`, `icon.color` | 85.858 → **91.331** | unchanged |
| mui/Switch | `switch-thumb.color` | **unchanged** | unchanged |
| polaris/Tag | `icon-3.color` | **unchanged** | unchanged |

The latter two are provably harmless: the refused channel was already rendering
identically (or its cells were already mismatched/uncompared), so the number
does not move — but the binding is gone and the extension receipt says so, which
is why they are listed rather than described as "nothing else changed". mui Chip
and the rest of the state round's wins are untouched, because their nested state
channels are `background-color`, which does not inherit. The check itself ran
everywhere: astryx Button measured 15 inheritance-only channels and refused
none of them; astryx Slider had 17 candidates rejected by the ancestor-carries
guard, which is that guard doing real work rather than decorating.

### The original finding

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

## polaris Badge's ledger was not polluted — it was FOREIGN (FIXED)

The triage called this a *polluted* Polaris ledger with two bad rows. It was
not: **every row in the file was astryx's**, and the file had no Polaris
content at all.

The evidence is exact. `out/badge/decisions.json`'s combo ids are
`blue, cyan, error, green, info, neutral, orange, pink, purple, red, success,
teal, warning, yellow` — precisely the **astryx** Badge combo set. Polaris
Badge's combos are tone×progress (`attention-strong.complete`, `critical.none`,
…) and share not one id. Both rows appear verbatim in
`out/astryx/badge/decisions.md` — same scope, `from`, `to`, `observed`,
`expected`, and the same queue-item counts (28 and 14). Git agrees: the only
commit that ever touched the file is `2f494ab`, an **astryx** round ("badge 42"
decisions), written into the un-namespaced root before `--out` namespacing.

Why the namespacing fix missed it: `b66e5a3` restored the Polaris artifacts
from `5c93c8a`, but `run.ts` deliberately PRESERVES the human-decision
artifacts (`decisions.json`, `decisions.md`, `resolved.contract.json`) from
regeneration — so the restore covered the generated side and left astryx's
ledger sitting in the Polaris directory. That commit's claim that "Polaris
artifacts [were] RESTORED to their pre-astryx state" is therefore incomplete by
exactly three files.

Removed, not rewritten: there is no `{p.*}` spelling to map these rows to,
because they are not Polaris facts. Badge now reproduces its committed 97.327
exactly with 0 unresolved refs.

**A loaded gun came out with it.** `out/badge/resolved.contract.json` was a
pre-promotion contract carrying the same astryx tokens (`{spacing-0}`,
`{font-size-sm}`) and no promoted parts. It was NOT the source of the shipped
contract — shipped matches `enriched.contract.json` — but `promote-floor.ts`
prefers `resolved.contract.json` whenever it exists, so the next promotion
would have silently regressed the shipped Badge contract. Removed; promote-floor
re-run and verified byte-stable (it now reads `enriched.contract.json`, and no
shipped contract changed). An audit of every other `resolved.contract.json`
across all four libraries confirms each one really is
`applyDecisions(enriched, ledger)` — Badge was the only stale promotion source.

**The guardable class** — `applyDecisions` matched on (part, channel, scope)
and never consulted `ids`, so a foreign ledger applied silently. Keying off
`ids` is NOT the fix (measured: 6 of 9 Polaris ledgers carry ids from an older
combo enumeration and are perfectly valid — that check would refuse real rows).
The fix is the **apply-time value check**: a decision whose `to` is a token ref
absent from the library's inventory is now a NAMED skip, never a silent write.
Pinned by `decision-ledger-value-check`, which also asserts that no committed
ledger in any of the four libraries targets a token its own library does not
ship.

### The original finding

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
No eval references them.

**REMOVED (repair wave).** One correction to the paragraph above first: `out/slider`
and `out/switch` are **not** byte-identical duplicates. Their `captured-truth.json`
files are byte-identical to the astryx ones, but their ledgers are an OLDER,
worse generation — both ack `font-size → {spacing-4}` (a spacing token for a
type channel), which the namespaced astryx ledgers later corrected to the
literal `16px`. So all three directories are stale supersets, not duplicates,
and `out/card` additionally carries a lower score (96.853 vs 98.252). Nothing
in `evals/` or `scripts/` referenced any of the three paths; the only textual
hits were this document and `extract/figma/visual-parity/REPORT.md`, whose
`out/switch/...` is a different out-root entirely.

The same `--out` namespacing gap was also live in `.gitignore`: the literal
`extract/computed/out/.orig-shots/` and `extract/computed/out/.regate-probe.html`
spellings matched only the un-namespaced root, so every namespaced library's
transient render surfaces were untracked churn. Both are now `**`-matched at any
depth.

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
- ~~Recapture is owed for: **astryx Button/Badge/Slider** (mint skew — a
  recapture re-promotes the contract against the current mint and closes it),
  and **polaris Button** once the nested-state regression is fixed.~~
  **DONE / FALSIFIED (repair wave).** polaris Button needed no recapture at all
  — the repaired engine re-fuses the committed contract byte-identically. The
  astryx three WERE recaptured (real harness, pinned sandbox, double-run
  byte-identity) and it did **not** close the refs; see the instrument-scope
  section. Their receipts are now honest and gap-free; the refs stay open
  against the proposed gate-inventory fix.

The repair wave re-recorded the baseline. Rows that went exact carry
`gapCause: ""`; the astryx three carry a gapCause naming the INSTRUMENT cause
rather than the disproven skew story.

**Task #21 re-recorded it again**, and this time the astryx receipts were
re-run by a REAL harness (the only instrument allowed to rewrite
`scorecard.json` / `numbers.json`, double-run byte-identity included), so
offline and committed agree to three decimals for all three. Their `gapCause`
is now `repaired: gate now measures shipped inventory …`; astryx Card's names
the one leftover — its committed receipt still records the pre-fix ref count
because it was deliberately not re-run.

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
