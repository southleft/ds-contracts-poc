# THE PATTERN GAUNTLET — kit census

Every component set in the owner's kit replayed through the full deterministic receive pipeline — the EXACT playground semantics (proposeBatchFromDump + captured-token layer + child stubs → validateContract + generateCss referee → all four emitters). Reproduce: `npm run extract:figma:gauntlet`.

- Dump: `extract/figma/fixtures/cbds-plugin-all-sets.v14.dump.json` (dump v1.4, recaptured 2026-07-10 — the `_variables` resolved-value channel rides along)
- Captured-token layer: **126 variables** registered (13 shadowed by repo tokens, 1 skipped by name). With the layer in place the census records **zero** "does not exist in tokens/" refusals — on the v1.3 capture (no `_variables`) this would have been the top class.
- Skips at proposal: **0** — the id-sanitize + batch-isolation chain (3982ac2) holds on live data.
- Batch notes: "contract id "ds.radio-button" is claimed by two sets in this dump ("RadioButton" and "Radio button")" (named, never merged).

## Headline

| population | clean | not clean | clean rate |
|---|---:|---:|---:|
| **whole kit** | 1577 | 41 | **97.5%** |
| plain COMPONENTs (icon-class, single variant) | 1529 | 13 | 99.2% |
| **real COMPONENT_SETs (variant axes)** | 48 | 28 | **63.2%** |

CLEAN = proposed, zero referee violations, all 4 surfaces emit. The whole-kit number is icon-inflated: 95.3% of the kit is single-variant COMPONENTs. The honest capability number is the COMPONENT_SET row — the failures concentrate exactly in the owner's real composites (Menu, Card-Image, Avatar group, Breadcrumb, Dialog…).

**Refusal-free ≠ pixel-right.** "Clean" is qualified by the facts-carried metric: across the kit the proposals carry **3234 token-bound style facts** (median 1 per proposed set — icons bind one fill; median 14 per COMPONENT_SET), of which 863 are minted provisional (`imported.*` — literal fidelity, machine names), while **4726 named notes**, **23 unbound leftovers**, and **3316 capture degradations** name facts the pipeline read but did not carry. Per-set numbers ride census.json.

**Surface honesty:** the figma-script emitter does not referee (core/emit-figma-script.ts never calls validateContract) — every one of the 41 violating sets still emits a sync script while react/html/react-inline refuse. That is why "not clean" sets report 1 emitted surface, not 0.

## Failure classes, ranked by set frequency

### 1. `duplicate-part-name` — 32 sets (2.0% of kit, 26.3% of COMPONENT_SETs) — **fix in flight** (concurrent propose-figma dedup branch; ranked, not counted as unknown)

Reported by: html, react, react-inline, referee.

- **_variable-list-item**:

  ```text
  ds.variable-list-item: duplicate anatomy part name "variableName"
  ```
- **_typography-list-item-2**:

  ```text
  ds.typography-list-item-2: duplicate anatomy part name "variableName"
  ```
- **_typography-list-item**:

  ```text
  ds.typography-list-item: duplicate anatomy part name "variableName"
  ```

(all 32: _variable-list-item, _typography-list-item-2, _typography-list-item, _numbers-list-ite, _Elevation, Note, Alert, Accordion, _Text-block-Panel, _Breadcrumb item, Card-Image, _Icon group-card, Dialog, Input Number, _Country code, Input Text, List item, Navigation-Side, _Nav-item-base-open, Navigation-Header, Pagination-2, Pagination-3, Search, Search-MultiSelect, Checkbox, Radio button, Table-Data cell, Accordion Group Test, Navigation / Horizontal Menu, Modal / Confirmation Dialog, Table / Data Grid, Shopify / Entrepreneurs Section)

### 2. `component-ref-unknown-child-prop` — 12 sets (0.7% of kit, 13.2% of COMPONENT_SETs)

Reported by: html, react, react-inline, referee.

- **Note**:

  ```text
  ds.note: part "Badge" sets unknown ds.badge prop "iconRight"
  ```
- **Avatar group**:

  ```text
  ds.avatar-group: part "Avatar" sets unknown ds.avatar prop "isVisible"
  ```
- **Chip**:

  ```text
  ds.chip: part "Avatar" sets unknown ds.avatar prop "isVisible"
  ```

(all 12: Note, Avatar group, Chip, Breadcrumb, Card-Image, Card-Basic, List item, Menu, Navigation-Side, _Footer-Nav, Navigation-Header, Table-Data cell)

### 3. `visiblewhen-value-outside-prop-enum` — 11 sets (0.7% of kit, 14.5% of COMPONENT_SETs)

Reported by: html, react, react-inline, referee.

- **Alert**:

  ```text
  ds.alert: part "linkBlue" visibleWhen.equals "true" is not a value of prop "inlineAction"
  ```
- **Accordion**:

  ```text
  ds.accordion: part "Container" visibleWhen.equals "true" is not a value of prop "expand"
  ```
- **Card-Image**:

  ```text
  ds.card-image: part "titleText" visibleWhen.equals "true" is not a value of prop "imageBottom"
  ```

(all 11: Alert, Accordion, Card-Image, Input Number, _Country code, Navigation-Side, _Nav-item-menu, Pagination-2, Pagination-3, Radio button-icon, Toggle-icon)

### 4. `prop-binding-not-camelcase` — 1 sets (0.1% of kit, 0.0% of COMPONENT_SETs)

Reported by: html, react, react-inline, referee.

- **Note**:

  ```text
  ds.note: prop "2ndParagraph" code binding "2ndParagraph" is not a legal camelCase identifier
  ```


## Engineering read per top class — where it dies, what the fix likely is

- **`duplicate-part-name`** — Dies at the referee: `validateContract` (core/emit-react.ts:180) requires part names to be unique across the WHOLE anatomy (`walkAnatomy` global `seen` set), but the proposer dedupes only among SIBLINGS — `partKey` (core/propose-figma.ts:1777, `taken` is per-sibling-scope). Two same-named parts under different parents (Dialog's two "Title" sections, Table rows' repeated "td") pass proposal and refuse at validation, which also blocks the react/html/react-inline emitters. Likely fix: thread one contract-global `taken` set (or parent-qualified names) through `partKey`, with the rename receipted as a note — this is the in-flight dedup branch.

- **`component-ref-unknown-child-prop`** — Dies at the referee: `validateContract` (core/emit-react.ts:195) refuses component-ref props absent from the child contract's API. Source: `canonicalizeInstanceProps` (core/propose-figma.ts:2069) — when the nested instance's child IS in scope (repo ds.avatar / ds.badge / ds.list-item matched by name) but an applied Figma property does not map through the child's `bindings.figma`, the fallback branch still emits it under `canonicalPropName(property)` ("isVisible", "notification", "iconRight"). Likely fix: when the child contract is in scope, DROP unmappable applied props with a named note (declared fidelity limit) instead of emitting them — and separately reconcile the repo child contracts with the kit's current property APIs, since the mismatch also signals the repo contracts are stale against the live kit.

- **`visiblewhen-value-outside-prop-enum`** — Dies at the referee: `validateContract` (core/emit-react.ts:371) requires `visibleWhen.equals` to be a member of the prop's ENUM values, but the prop the condition points at was promoted to a BOOLEAN (True/False variant axis — "inlineAction", "imageBottom"). Source: presence inversion emits `equals: camel(value)` unconditionally (`visibilityFromPresence`, core/propose-figma.ts:1689-1701, and the hidden-channel path at :1154). Likely fix: when the referenced axis proposes as a boolean prop, spell presence as `visibleWhen { prop }` (truthy form, already legal — see :1139) or negate, instead of `equals: "true"`.

- **`prop-binding-not-camelcase`** — Dies at the referee: `validateContract` (core/emit-react.ts:425) refuses code bindings that are not legal camelCase identifiers. Source: `canonicalPropName`/`camel` (core/propose-figma.ts:34-62) preserve digit-led spellings — the kit's "2nd paragraph" text property becomes prop "2ndParagraph". Likely fix: the digit-led guard `componentIdSlug` already applies to contract ids (prefix rule, core/propose-figma.ts:78) applied to prop code bindings too, with the rename noted.

- **`pattern-arrayof-candidate`** — Not a refusal — a capability frontier. ≥3 same-named siblings (avatar stacks, table rows, pagination numbers) propose as N independent parts; the contract vocabulary has no arrayOf/repeat, so emitted code hard-codes the drawn count. Proposal-side detection would live where merged children are walked (core/propose-figma.ts `partKey`/merge pass); the vocabulary decision is a schema question (scripts/contract-schema.ts).

- **`pattern-slot-placeholder`** — Not a refusal — slot fidelity. `_Slot*`/placeholder/swap-named instances propose as component refs to the Slot utility or stubs rather than slot declarations with `accepts`; INSTANCE_SWAP preferredValues are a declared dump v1 limit (extract/figma/dump.plugin.js header). The seam is the INSTANCE branch of propose (core/propose-figma.ts:1935+) plus the dump capture.

- **`pattern-instance-swap`** — Not a refusal — INSTANCE_SWAP propRefs (`propRefs.mainComponent`) ride the dump but the proposal has no swap-prop vocabulary beyond slots; preferredValues (→ slot `accepts`) are not captured in dump v1 (declared limit). Seam: dump.plugin.js propRefs capture + the slot branch in propose.

- **`pattern-state-axis`** — Not a refusal — state-like axes DO promote to CSS states since the aca43a9 chain (hover→:hover etc.); the fixture pins the behavior on a live set for regression.

## Feature frequency — what the kit is made of

| feature | sets | share of kit | share of COMPONENT_SETs |
|---|---:|---:|---:|
| plain COMPONENT (single variant, mostly icons) | 1542 | 95.3% | 0.0% |
| COMPONENT_SET (variant axes) | 76 | 4.7% | 100.0% |
| composite (≥1 nested instance) | 80 | 4.9% | 92.1% |
| deep composition (anatomy depth ≥ 3) | 46 | 2.8% | 36.8% |
| arrayOf candidates (≥3 same-named siblings) | 23 | 1.4% | 21.1% |
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

If the owner imports **5 sets at random** from this kit: expected clean count **4.9 of 5** (per-set clean rate 97.5%); probability all five are clean **88.0%** (= 0.975^5). But a random draw is icon-heavy (95.3% of keys are single-variant COMPONENTs) — if the five "random component imports" are the components a person actually reaches for, the COMPONENT_SET population is the honest base: clean rate 63.2%, expected **3.2 of 5** clean, probability all five clean **10.0%** (= 0.632^5). Chance at least one of the five hits each top class, by simple frequency: `duplicate-part-name` (10% whole-kit / 78% if he draws COMPONENT_SETs); `component-ref-unknown-child-prop` (4% whole-kit / 51% if he draws COMPONENT_SETs); `visiblewhen-value-outside-prop-enum` (3% whole-kit / 54% if he draws COMPONENT_SETs); `prop-binding-not-camelcase` (0% whole-kit / 0% if he draws COMPONENT_SETs). No usage weighting — pure per-set frequency, both populations shown.

## Class acceptance fixtures

One representative self-contained single-set dump per top failure class, filled to 8 with the kit's top PATTERN classes (capability frontier — nothing refuses, the fixture pins the shape), under `extract/figma/gauntlet/fixtures/`. Each carries its `_variables` slice and its own `_degradations`:

- `duplicate-part-name-accordion.dump.json` — class `duplicate-part-name`, set **Accordion**
- `component-ref-unknown-child-prop-avatar-group.dump.json` — class `component-ref-unknown-child-prop`, set **Avatar group**
- `visiblewhen-value-outside-prop-enum-alert.dump.json` — class `visiblewhen-value-outside-prop-enum`, set **Alert**
- `prop-binding-not-camelcase-note.dump.json` — class `prop-binding-not-camelcase`, set **Note**
- `pattern-arrayof-candidate-text-area.dump.json` — class `pattern-arrayof-candidate`, set **Text Area**
- `pattern-slot-placeholder-card-image.dump.json` — class `pattern-slot-placeholder`, set **Card-Image**
- `pattern-instance-swap-list-item.dump.json` — class `pattern-instance-swap`, set **List item**
- `pattern-state-axis-chip.dump.json` — class `pattern-state-axis`, set **Chip**

