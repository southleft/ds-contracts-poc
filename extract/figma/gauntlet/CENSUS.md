# THE PATTERN GAUNTLET — kit census

Every component set in the owner's kit replayed through the full deterministic receive pipeline — the EXACT playground semantics (proposeBatchFromDump + captured-token layer + child stubs → validateContract + generateCss referee → all four emitters). Reproduce: `npm run extract:figma:gauntlet`.

- Dump: `extract/figma/fixtures/cbds-plugin-all-sets.v14.dump.json` (dump v1.4, recaptured 2026-07-10 — the `_variables` resolved-value channel rides along)
- Captured-token layer: **126 variables** registered (13 shadowed by repo tokens, 1 skipped by name). With the layer in place the census records **zero** "does not exist in tokens/" refusals — on the v1.3 capture (no `_variables`) this would have been the top class.
- Skips at proposal: **0** — the id-sanitize + batch-isolation chain (3982ac2) holds on live data.
- Batch notes: "contract id "ds.radio-button" is claimed by two sets in this dump ("RadioButton" and "Radio button")" (named, never merged).

## Headline

| population | clean | not clean | clean rate |
|---|---:|---:|---:|
| **whole kit** | 1618 | 0 | **100.0%** |
| plain COMPONENTs (icon-class, single variant) | 1542 | 0 | 100.0% |
| **real COMPONENT_SETs (variant axes)** | 76 | 0 | **100.0%** |

CLEAN = proposed, zero referee violations, all 4 surfaces emit. The whole-kit number is icon-inflated: 95.3% of the kit is single-variant COMPONENTs. The honest capability number is the COMPONENT_SET row — the owner's real composites (Menu, Card-Image, Avatar group, Breadcrumb, Dialog…), where the failures used to concentrate, are clean too.

**Refusal-free ≠ pixel-right.** "Clean" is qualified by the facts-carried metric: across the kit the proposals carry **3319 token-bound style facts** (median 1 per proposed set — icons bind one fill; median 15 per COMPONENT_SET), of which 863 are minted provisional (`imported.*` — literal fidelity, machine names), while **5479 named notes**, **23 unbound leftovers**, and **3316 capture degradations** name facts the pipeline read but did not carry. Per-set numbers ride census.json.

**Surface honesty:** all four emitters referee — emit-figma-script calls validateContract (census class-fix batch), so a referee-violating contract refuses BY NAME on the canvas surface exactly like react/html/react-inline. (Before the batch it was the one surface that still emitted sync scripts for violating sets.)

## Failure classes, ranked by set frequency

_None — every set is clean._

## Fixed classes (census class-fix batch) — gone from the ranking

Each fix is replayable offline against the committed class fixture (`fixtures/<class>-<set>.dump.json`) via `tsx extract/figma/gauntlet/class-fix-check.ts`, and the fourth guard rides along: emit-figma-script now calls validateContract, so an invalid contract refuses BY NAME on the canvas surface like the other three emitters.

- `component-ref-unknown-child-prop` (was 12 sets) — when the nested instance's child contract IS in scope, applied props that do not map through the child's `bindings.figma` are DROPPED, each with a named note ('applied prop "X" on nested "Y" does not map through ds.y's bindings — not carried; verify the child contract is current'), never a guessed spelling. "In scope" resolves exactly like the emitted ref id does: by contract name, then by the stubIdFor slug — a slug that lands on a registered contract (ds.list-item, ds.breadcrumb-item, ds.avatar-group) canonicalizes against it, since a stub never overrides a registered contract. Several repo child contracts (ds.avatar, ds.badge, ds.list-item, ds.breadcrumb-item, ds.avatar-group) are STALE against the live kit's current property APIs ("isVisible", "notification", "iconRight", "textBreadcrumb", … exist on the canvas but not in the repo contracts) — dropping with a note is the honest behavior either way; reconcile the child contracts to carry those props again.
- `visiblewhen-value-outside-prop-enum` (was 11 sets) — presence riding a true/false variant axis now spells the truthy form `visibleWhen { prop }` (the axis promotes to a BOOLEAN prop; `equals: "true"` is enum vocabulary the referee refuses). The false side — present exactly where the boolean is false — is inexpressible (visibleWhen has no negated form) and stays a NAMED note, kept unconditional.
- `prop-binding-not-camelcase` (was 1 set) — digit-led property spellings get the componentIdSlug digit-led discipline applied to prop code bindings — the deterministic "p" prefix ("2nd paragraph" → `p2ndParagraph`) with a named note; the figma binding keeps the original spelling.

## Engineering read per top class — where it dies, what the fix likely is

- **`pattern-arrayof-candidate`** — PARTIALLY SHIPPED (P9, schema v12 `repeat`): ≥3 ADJACENT sibling instances with a homogeneous applied-prop shape and ≥1 carriable per-item field now propose as ONE item-template part + arrayOf prop (core/propose-figma.ts repeatRunAt/buildRepeatPart; receipt extract/figma/repeat-collection-check.ts). Candidates WITHOUT a carriable field (constant props, varying enums — P10, or pre-v1.5 TEXT-ambiguous keys) stay N fixed parts with named notes — this fixture pins that residue.

- **`pattern-repeat-collection`** — Not a refusal — P9 SHIPPED (schema v12 `repeat`): the fixture pins a live set whose sibling run proposes as ONE repeat part + arrayOf prop; React maps the live array, the canvas/static surfaces render repeat.sample (the observed drawn siblings).

- **`pattern-slot-placeholder`** — Not a refusal — slot fidelity. `_Slot*`/placeholder/swap-named instances propose as component refs to the Slot utility or stubs rather than slot declarations with `accepts`; INSTANCE_SWAP preferredValues are a declared dump v1 limit (extract/figma/dump.plugin.js header). The seam is the INSTANCE branch of propose (core/propose-figma.ts:1935+) plus the dump capture.

- **`pattern-instance-swap`** — Not a refusal — INSTANCE_SWAP propRefs (`propRefs.mainComponent`) ride the dump but the proposal has no swap-prop vocabulary beyond slots; preferredValues (→ slot `accepts`) are not captured in dump v1 (declared limit). Seam: dump.plugin.js propRefs capture + the slot branch in propose.

- **`pattern-state-axis`** — Not a refusal — state-like axes DO promote to CSS states since the aca43a9 chain (hover→:hover etc.); the fixture pins the behavior on a live set for regression.

- **`pattern-deep-composition`** — Not a refusal — deep anatomies propose, but every level is inlined into one contract unless the child is a component instance; the fixture pins a representative deep set.

## Feature frequency — what the kit is made of

| feature | sets | share of kit | share of COMPONENT_SETs |
|---|---:|---:|---:|
| plain COMPONENT (single variant, mostly icons) | 1542 | 95.3% | 0.0% |
| COMPONENT_SET (variant axes) | 76 | 4.7% | 100.0% |
| composite (≥1 nested instance) | 80 | 4.9% | 92.1% |
| deep composition (anatomy depth ≥ 3) | 46 | 2.8% | 36.8% |
| arrayOf candidates (≥3 same-named siblings) | 23 | 1.4% | 21.1% |
| repeat collections PROPOSED (P9, schema v12) | 2 | 0.1% | 2.6% |
| slot-placeholder names (_Slot*/placeholder/swap) | 12 | 0.7% | 9.2% |
| INSTANCE_SWAP properties | 6 | 0.4% | 7.9% |
| boolean-visibility pairs (Show X) | 60 | 3.7% | 67.1% |
| state-like variant axis | 47 | 2.9% | 61.8% |
| theme/mode/density-like axis | 0 | 0.0% | 0.0% |
| size-like axis | 59 | 3.6% | 77.6% |
| geometry parts (vectors/shapes) | 1523 | 94.1% | 14.5% |
| text-style variety ≥ 2 | 56 | 3.5% | 55.3% |

Composite share: 80 sets (4.9%) nest at least one instance — the kit is primitive-heavy overall (icons), but 92.1% of the real COMPONENT_SETs are composites.

## Capture degradations by code (named, never silent)

| code | receipts |
|---|---:|
| vector-geometry-unsupported | 3109 |
| stroke-style-unsupported | 86 |
| text-channel-unsupported | 53 |
| stroke-weights-nonuniform | 29 |
| paint-unsupported | 16 |
| paint-stack-truncated | 14 |
| rotation-unsupported | 5 |
| radii-nonuniform | 4 |

## Predicted next five

If the owner imports **5 sets at random** from this kit: expected clean count **5.0 of 5** (per-set clean rate 100.0%); probability all five are clean **100.0%** (= 1.000^5). But a random draw is icon-heavy (95.3% of keys are single-variant COMPONENTs) — if the five "random component imports" are the components a person actually reaches for, the COMPONENT_SET population is the honest base: clean rate 100.0%, expected **5.0 of 5** clean, probability all five clean **100.0%** (= 1.000^5). No failure class remains to hit. No usage weighting — pure per-set frequency, both populations shown.

## Class acceptance fixtures

One representative self-contained single-set dump per top failure class, filled to 8 with the kit's top PATTERN classes (capability frontier — nothing refuses, the fixture pins the shape), under `extract/figma/gauntlet/fixtures/`. Each carries its `_variables` slice and its own `_degradations`:

- `pattern-arrayof-candidate-text-area.dump.json` — class `pattern-arrayof-candidate`, set **Text Area**
- `pattern-repeat-collection-navigation-header.dump.json` — class `pattern-repeat-collection`, set **Navigation-Header**
- `pattern-slot-placeholder-card-image.dump.json` — class `pattern-slot-placeholder`, set **Card-Image**
- `pattern-instance-swap-list-item.dump.json` — class `pattern-instance-swap`, set **List item**
- `pattern-state-axis-chip.dump.json` — class `pattern-state-axis`, set **Chip**
- `pattern-deep-composition-variable-list-item.dump.json` — class `pattern-deep-composition`, set **_variable-list-item**

Fixed-class fixtures stay committed for regression replay (`tsx extract/figma/gauntlet/class-fix-check.ts`):

- `component-ref-unknown-child-prop-avatar-group.dump.json` — class `component-ref-unknown-child-prop` (fixed), set **Avatar group**
- `visiblewhen-value-outside-prop-enum-alert.dump.json` — class `visiblewhen-value-outside-prop-enum` (fixed), set **Alert**
- `prop-binding-not-camelcase-note.dump.json` — class `prop-binding-not-camelcase` (fixed), set **Note**

