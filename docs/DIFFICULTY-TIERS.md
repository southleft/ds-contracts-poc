# Component difficulty tiers — and why they are NOT the framework choice

**The owner's ask, and the conflation it hides.** *"Generate React by default and/or web
components based on difficulty level."* Read literally that sentence ties two things that have
nothing to do with each other. This document separates them with evidence from real runs:

- **AXIS 1 — OUTPUT FRAMEWORK** (React by default · web components · future Angular/Swift/Kotlin)
  is an **emitter choice**. It is a *user preference*, orthogonal to how hard the component is.
  One captured contract already drives multiple frameworks at *identical computed truth*
  (`@ds-contracts/emitter-web-components`, `wc-emitter-css-parity` eval: **3 subjects
  badge/button/switch, 165 channel comparisons, 0 mismatches** — one contract, one computed truth
  across emitters; `wc-emitter-roundtrip`: **5 contracts** emitted → CEM-extracted → diffed,
  props/enums/defaults/events survive; both pass inside `npm run eval` 129/129).
- **AXIS 2 — COMPONENT DIFFICULTY TIER** is which *pipeline capture capabilities* a component
  needs. It decides **which journeys work today at what fidelity vs. what the depth build has to
  unlock** — and it decides this *regardless of which framework the emitter targets*.

**The kill statement:** difficulty changes the **CAPTURE strategy** (how we mount and read the
component into a contract), never the **framework** (which emitter renders the contract back out).
A Badge and a Modal both emit to React *and* web components; the difference is that the Badge
already captures at 0.05% pixel delta and the Modal cannot be captured by the shipping floor at
all. Routing "React for easy, web-components for hard" would be a category error.

---

## 1. The tier model

Four tiers, each defined by **measurable signals the pipeline already produces** — anatomy
composition depth, `component`-ref count, `repeat` parts, `overlay`/portal escape, structure-props
(`items`+`renderItem`/`headings`), `optional` adornment count, `meter`/runtime-driven visuals, and
the JSX-root shape recorded by extraction. Every signal below is a real field in the shipped schema
(`packages/schema/src/contract-schema.ts`) or a real receipt.

### Vocabulary these signals map to (already in the schema, no additions)

| Signal | Schema location | Meaning |
|---|---|---|
| composition depth | `Part.parts` nesting | how deep the anatomy tree runs |
| `component`-ref count | `ComponentRefSchema` (`{id, props?, text?}`) | fixed child-contract instances embedded |
| `repeat` | `RepeatSchema` (`itemsProp`, `sample`) v12 | item template repeated over an `arrayOf` prop (menu items, avatar stacks) — **requires** a `component` ref |
| `slot` | `SlotSchema` (`name`, `accepts[]`, `acceptsMode`, `defaultContent`) | constrained insertion point (Curtis model) |
| `optional` adornment | `Part.optional` | part renders conditionally (Show-X boolean in Figma) |
| `overlay` | `OverlaySchema` on `Part.overlay` | out-of-flow edge attachment (tooltip/popover/portal anatomy) |
| `meter` | `Part.meter` (`valueProp`, `maxProp`) | fill width computed live; canvas draws only the defaults' fraction |
| `states` | `Part.states` (state → CSS→token) | interaction-state vocabulary |
| `animation` | `Part.animation` (`spin`/`pulse`) | CSS motion, not representable on canvas |

### The four tiers

| Tier | Defining signals | JSX-root shape | Mounts declaratively? | Shipping today? |
|---|---|---|---|---|
| **T0 PRIMITIVE** | single styled HTML root; enum/bool axes; composition depth ≤1; **0** component-refs, **0** repeat, **0** overlay | single styled host element | yes | **YES — 7/10 pass** |
| **T1 COMPOSITE** | composition depth 2–3; ≥1 `component`-ref **or** `slot` **or** `optional` adornment; still one in-stage root; no portal, no structure-props | single styled host, nested parts | yes | **partial** (styling channel proven on CSS-module systems) |
| **T2 ADVANCED** | portal/`overlay` escape **or** structure-props (`items`+`renderItem`/`headings`) **or** `repeat` children **or** JSX root is Provider/Wrapper/Fragment **or** public-name ≠ impl-name | Provider / Fragment / portal | **no** — needs open-driver + sample-data | **NO — proven in spike only** |
| **T3 DYNAMIC** | runtime-driven visuals that never settle: loading announcers, two-pass ResizeObserver measure, live `meter` width, runtime-conditional anatomy | any | no — never reaches steady state | **NO — out of reach; needs Stage E + honest static-projection boundary** |

### T0 PRIMITIVE — real examples, real numbers

The 12-component Polaris showcase is this tier. Canvas-gate scorecards
(`examples/polaris/receipts/canvas-gate/*.scorecard.json`; contracts v0.3.2 rendered headless vs
`@shopify/polaris@13.9.5` in Chromium 149.0.7827.55 @ deviceScaleFactor 2; `meanAAMasked` =
masked antialias-excluded pixel delta):

| component | cells | meanAAMasked | verdict |
|---|---|---|---|
| **Badge** | 56 | **0.05%** | PASS |
| Avatar | 5 | **0.00%** | PASS |
| Spinner | 2 | **0.00%** (`animation:spin`, one still frame) | PASS |
| RadioButton | 2 | **0.00%** | PASS |
| Thumbnail | 4 | **2.16%** | PASS |
| Checkbox | 3 | 3.22% | PASS |
| **Button** | 220 | **6.46%** mean / 85.35 max | **FAIL — named cause** |

**Button is the honest edge of this tier.** It is primitive-*shaped* (enum axes: tone × variant ×
size × textAlign × state) yet fails at 6.46% because its label renders through the Polaris **Text
primitive at bodyMd (13px/20px), which the contract carries as 12px/16px** — *composition-owned
typography invisible to single-file static promotion* (scorecard `cellsOver10Masked` notes; this is
failure class N3 leaking one level down into a primitive). A primitive with one composite
dependency is still routed T0, but its fidelity gap is a T1 signal the classifier should surface.

### T1 COMPOSITE — real examples

- **Banner** (8 cells, **3.17% PASS**): icon + content + a focus ring that wraps all four sides —
  a multi-part anatomy with `states` and a declared focus channel (PHASE-B5E-RECEIPT §(c)). Ships
  today because it roots at a styled host and mounts declaratively.
- **Card** (schema reference contract `contracts/card.contract.json`): carries a `component`-ref to
  an avatar child — the canonical composite signal.
- **Dialog** (non-portal dialog surface): header + body + footer parts, `slot` body.
- **ProgressBar** (12 cells, **26.22% FAIL**): composite-*shaped* (a `meter` part) but its
  indicator width is a **runtime percentage**; the canvas draws the defaults' fraction while real
  Polaris fills to the live value (scorecard note: "bars read fully filled; indicator width is a
  runtime %"). ProgressBar is the honest edge between T1 and T3: composite anatomy, dynamic fill.

T1 is where the **only-CSS-module systems produce real bindings**: Polaris posted **109 anatomy
proposals** with parts + states + token bindings — the sole gauntlet system with an author-time
styling channel (ENTERPRISE-GAUNTLET §1 scoreboard; §3 Polaris row).

### T2 ADVANCED — real examples, both halves of the pipeline run

`examples/polaris/ADVANCED-PROBE.md` pushed the four hardest Polaris components through code-side
extraction *and* the computed-floor mount. **On the shipping floor, none produces an acceptable
contract; two produce a *misleading* one:**

| component | shipping-floor verdict | code side |
|---|---|---|
| **Modal** | **DOES NOT MOUNT — capture throws.** 100% portal render; `stage.firstElementChild` absent (`bareStageChildEls=0`), dialog is a 1200px viewport overlay `insideStage:false` | 6 files + 1 skip (`FadeUp`, react-transition-group); 15 props, 1 inferred enum, **zero token bindings** (root is `<WithinContentContext.Provider>`) |
| **Popover** | **MOUNTS THE WRONG ELEMENT (silent false-success).** Captures the activator `<button>`; the real `.Polaris-Popover` overlay is portaled outside the stage | `preferredPosition`/`preferredAlignment` (the defining axes) → `kind:"other"`, no enum values |
| **ResourceList** | **MOUNTS EMPTY.** recipe-only renders `0×0px` shell — `items`/`renderItem` are arrays/functions the capture config cannot express | 20 props, 0 enum, anatomy empty (`<ResourceListContext.Provider>` root) |
| **IndexTable** | **MOUNTS A LOADING SKELETON.** text stays `"Loading orders…"` after 2s; real rows buried under a two-pass ResizeObserver measure scaffold | public `IndexTable` **0 props** (Fragment); `IndexTableBase` 17 props under a name no consumer imports |

The seven depth failure classes (ADVANCED-PROBE §Synthesis), of which **N1–N7 only surface at this
tier**: N1 portal/overlay defeats the mount, N2 structure-creating props inexpressible, N3
Provider/Fragment root → 0 anatomy, N4 public ≠ impl, N5 component-family fragmentation, N6
runtime-settling, N7 multi-combo overlay collision.

**These are proven capturable — in the spike, not the shipping floor.** `extract/depth-spike/
DEPTH-BUILD.md` de-risked three mechanics on the same components (double-run byte-identical):

| component | depth-reader result (was → is) |
|---|---|
| **Modal** | **0 → 17 parts, tree depth 7, two real roots {`div.Modal-Dialog`, `div.Backdrop`}**; 4097 B of portaled DOM the current reader throws on |
| **Popover** | overlay **2671 B** captured (`button.Button` activator + `div.Popover`), 11 parts — wrong-element trap closed |
| **ResourceList** | captures as **`{ ul.ResourceList + repeat(li.ResourceItem)×3 → component-ref ds.resource-item }`**, 10 parts — was a `0×0` shell |
| **IndexTable** | 70 parts, depth 8, Fragment multi-root (table wrapper + portaled announcer) |

**Headline finding: no schema additions are required** — `repeat`, `component`-ref, `slot`, and
multi-root `anatomy` already exist and are already emitted by the design side; the gap is entirely
in the FLOOR (`capture.ts` reads one `stage.firstElementChild`; `anatomy.ts` hard-codes a single
root). See §5 for the staged build.

### T3 DYNAMIC — real examples

Runtime-driven visuals that never reach a captureable steady state, even with the T2 depth build:

- **IndexTable's *settled* table** (not the skeleton): N6 — permanent dual sticky-header +
  loading announcers + two-pass ResizeObserver measure; captures a scaffold, never the real table
  (ADVANCED-PROBE §IndexTable).
- **Live data tables**: rows are runtime state, not props.
- **ProgressBar / any `meter`**: fill is `valueProp/maxProp` computed live; the canvas is
  *definitionally* a static projection (schema `Part.meter` doc: "Code computes live; the canvas
  renders the defaults' fraction — its honest static state").

T3 is not "captured badly"; it is **out of scope for a static contract's visual layer by
construction**. The pipeline's honest move is to carry the runtime binding (`meter`, `repeat.sample`)
and *declare* the canvas as one frame — which the schema already does. Closing the capture gap needs
Stage E (component-aware readiness) *and* accepting the static-projection boundary.

---

## 2. Journey × tier matrix — what works TODAY (with receipts) vs what the depth build unlocks

Two journeys:

- **Journey A — code → contract → Figma** (the dev/CI journey: extract from npm/source, propose a
  contract, emit a Figma component set).
- **Journey B — Figma → contract → code** (the designer journey: a contract sourced from Figma,
  emit React + a Storybook story; `core/propose-figma.ts` is the design-side proposer).

Fidelity is stated honestly and grounded in a named receipt. "Depth build unlocks" references the
DEPTH-BUILD stage that closes the gap.

| Tier | Journey A (code→contract→Figma) TODAY | Journey B (Figma→contract→code) TODAY | Depth build unlocks |
|---|---|---|---|
| **T0 PRIMITIVE** | **WORKS.** 7/10 Polaris primitives PASS the canvas gate (Badge 0.05%, Avatar/Spinner/Radio 0.00%, Thumbnail 2.16%, Checkbox 3.22%, Banner 3.17%); 12 sets amended on the live canvas, every node id stable (PHASE-B5E-RECEIPT ledger). Button/Tag/ProgressBar fail with *named* causes. | **WORKS.** design side already emits `repeat`/`component`/`slot`/multi-root anatomy (`core/propose-figma.ts`); React + CSS-module emit is round-trip-identical (`extract/roundtrip-code.ts`). | — (this tier is done; the 3 fails are static-promotion gaps, not tier gaps) |
| **T1 COMPOSITE** | **WORKS on CSS-module systems.** Polaris = 109 anatomy proposals with parts+states+bindings (ENTERPRISE-GAUNTLET §1). Banner/Card/Dialog capture their multi-part anatomy. Non-CSS-module systems carry structure but **0 styling** (griffel/StyleX/shadow-CSS have no static channel — §1E). | **WORKS.** `component`-ref threading (card avatar), `slot` `defaultContent`, `optional` adornments all emit to React + story. | Stage B root-descending anatomy lets composite roots that are Providers/wrappers carry styling (today they return 0 — N3). |
| **T2 ADVANCED** | **DOES NOT WORK on the shipping floor** — Modal throws, Popover captures the wrong element, ResourceList empty, IndexTable skeleton (ADVANCED-PROBE verdicts). **PROVEN in the spike** (Modal 0→17 parts, ResourceList repeat×3). | **PARTIAL.** the *vocabulary* to describe these (multi-root, repeat, slot, component-ref) exists and the design side can emit it; but there is no captured code-side truth to reconcile against — so a Figma-authored advanced contract is unverified against code. | **Stages A–D**: A portal-aware capture (N1/N7), B multi-root anatomy (N3), C `renderChildren` sample-data grammar (N2), D forward-to-base + compound contracts (N4/N5). North-star eval: `polaris-modal-composite-reproducible`. |
| **T3 DYNAMIC** | **OUT OF REACH.** IndexTable settled table never captures (N6); `meter` fills are runtime (ProgressBar 26.22% FAIL). | **PARTIAL, honestly bounded.** the runtime binding is carried (`meter`, `repeat.sample`) and the canvas is *declared* one static frame — correct by construction, not a fidelity miss. | **Stage E** component-aware readiness + adequate stage; plus the standing acceptance that live visuals are declared-not-drawn. |

**Ground-truth anchors** (every "works today" cited): canvas-gate scorecards
(`examples/polaris/receipts/canvas-gate/`), live-canvas amend ledger (PHASE-B5E-RECEIPT), 129/129
eval pass with `evals/results.json` byte-unchanged, `extract/roundtrip-code.ts` round-trip
identity, ENTERPRISE-GAUNTLET §1 scoreboard for the 109 anatomy proposals.

---

## 3. `ds-contracts classify` — command sketch

**Purpose:** given a component's *existing extraction output* (static contract + optional
computed-floor capture), report its **tier**, **expected fidelity**, and **ready output targets** —
so both journeys route intelligently without a human guessing.

**Input:** the enriched contract JSON already produced by `npm run extract:code` (and, if present,
the computed-floor capture / the extraction skip-receipts that record the JSX-root shape).

**Detection (pure function over the contract — no new capture):**

```
classify(contract, extractionReceipt?):
  # T2/T3 hard signals first (any one triggers)
  if part.overlay exists OR extractionReceipt.rootKind in {Provider, Wrapper, Fragment}
     OR extractionReceipt.publicName != implName          → ADVANCED  (portal / N3 / N4)
  if any part.repeat  OR any structure-prop (arrayOf + renderItem/headings)
                                                            → ADVANCED  (N2 / repeat)
  # T3 runtime signals
  if any part.meter with runtime valueProp
     OR extractionReceipt.settling (loading-announcer / ResizeObserver measure)
                                                            → DYNAMIC
  # T1 composite signals
  if componentRefCount >= 1 OR slotCount >= 1
     OR optionalAdornmentCount >= 1 OR compositionDepth >= 2
                                                            → COMPOSITE
  else                                                      → PRIMITIVE
```

**Output (one report per component):**

```
$ ds-contracts classify polaris.badge
  tier:            PRIMITIVE
  signals:         depth 1 · 0 refs · 0 repeat · 0 overlay · enum axes 2 (tone, progress)
  expected fidelity: ~0.1% masked-AA  (basis: canvas-gate badge.scorecard meanAAMasked 0.05, 56 cells)
  ready targets:   ✅ react  ✅ web-components  ✅ figma-set   (all emitters; contract fully captured)

$ ds-contracts classify polaris.modal
  tier:            ADVANCED
  signals:         portal escape · Provider root (N3) · public≠impl (N4) · family of 6 files (N5)
  expected fidelity: NOT CAPTURABLE on shipping floor  (basis: ADVANCED-PROBE — capture throws)
                     PROVEN in depth-spike: 17 parts, dialog+backdrop multi-root
  ready targets:   ⛔ all emitters blocked until Stage A+B land  (needs portal capture + multi-root anatomy)

$ ds-contracts classify polaris.progress-bar
  tier:            DYNAMIC (composite anatomy, runtime meter)
  signals:         meter valueProp/maxProp · depth 2
  expected fidelity: static-projection only  (basis: progress-bar.scorecard 26.22% — canvas draws defaults' fraction)
  ready targets:   ✅ react  ✅ web-components (runtime fill correct in code) · ⚠️ figma-set draws one frame
```

**Key property:** the *ready targets* column is **per-emitter and per-tier**, and for a fully
captured contract **all frameworks are ready** — that is the classifier proving Axis 1 ⟂ Axis 2.
A blocked row is blocked by a *capture* gap (Stage A/B/C/E), never by the framework.

---

## 4. Framework-routing recommendation — kill the conflation

**React is the default emitter.** It is the one framework the computed floor's mount recipe
supports today (SECOND-SYSTEM-ASSESSMENT §5: "the floor's mount adapter is React-only"), it is the
tier-0 shipping path (7/10 Polaris), and it is what the round-trip and canvas gates are pinned
against.

**Web components fit — as a parallel emitter, chosen by the user, for standards / shadow-DOM /
framework-agnostic distribution.** This is proven, not aspirational:
`@ds-contracts/emitter-web-components` compiles the *same* contract to shadow-scoped
`[part=…]`/`:where()` CSS at **identical specificity** as the HTML emitter, so both emitters resolve
one computed truth — `wc-emitter-css-parity`: 3 subjects, 165 channel comparisons, **0 mismatches**;
`wc-emitter-roundtrip`: 5 contracts emit → CEM-extract → diff, **props/enums/defaults/events
survive** (both green in 129/129). Choose web components when the target is standards-based,
needs shadow-DOM style isolation, or must run framework-agnostically — a *distribution* decision.

**Future targets** (Angular / Swift / Kotlin) are the same story: more emitters over the one
contract. The contract is the framework-neutral asset; emitters are leaves.

**Difficulty changes CAPTURE, not framework.** The evidence is direct:

- Extraction-*readiness* varies by **system architecture**, not by our framework choice: Nord (CEM
  / shadow DOM) posted the **best median ever, 100%**; Polaris (React / CSS modules) 57%; Carbon 78%;
  SWC 73% (SECOND-SYSTEM §3, ENTERPRISE-GAUNTLET §1). A high-difficulty component is hard to *read*
  no matter which emitter we later target.
- The web-components emitter renders a **Badge** (T0) and would render a **Modal** (T2) from the
  same contract shape — the blocker on Modal is that the *floor cannot capture it* (portal, N1),
  not that web components can't express it.

**So the routing rule is two independent dials, never one:**

```
emit target   = user preference          (react | web-components | figma | future)   ← Axis 1
capture plan  = classify(contract).tier  (primitive → … → dynamic)                    ← Axis 2
```

"Generate React for easy and web components for hard" collapses these two dials into one and is
wrong: it would emit a hard component to web components *and still fail to capture it*, and it would
deny an easy component the web-components target for no reason.

---

## 5. Honest gaps — what is out of reach today, and the build sequence

**Out of reach on the shipping pipeline right now:**

- **All of T2 ADVANCED.** The floor cannot mount a portal/overlay (Modal throws, Popover captures
  the activator), cannot supply structure-props (ResourceList empty), cannot root anatomy past a
  Provider/Fragment (Modal/IndexTable carry 0 styling), and models one file = one component
  (N5). *Proven closeable* in the spike, *not shipped*.
- **T3 DYNAMIC visual layer.** Runtime-settling (IndexTable) and live `meter` fills are a static
  projection by construction; even the depth build only reaches the *first settled frame* (Stage E).

**Build sequence (DEPTH-BUILD §Staged productionization — dependency order, each independently
gated by root `tsc` + evals-unchanged + double-run byte-identity, no schema change):**

1. **Stage A — portal-aware, baseline-diff capture** (`extract/computed/capture.ts`). Fixes N1/N7.
   Two-phase mount (empty baseline → spec), diff, capture every new root in-stage *or* portaled;
   reset stage per overlay combo. *Unblocks the whole overlay tier* (Modal/Popover/Dialog/Tooltip/
   Sheet/Toast). Proven: Modal 0→4097 B, Popover 2671 B.
2. **Stage B — root-descending, multi-root anatomy** (`extract/computed/anatomy.ts` + `lib.ts`).
   Fixes N3. Descend through Provider/wrapper/`display:contents` roots to real styled host(s), seed
   the union from an *array* of roots. Proven: Modal 0→17 parts, dialog+backdrop. This is what makes
   the floor carry *any* styling for composite/advanced roots.
3. **Stage C — sample-data `renderChildren` channel** (`ComponentConfig` + `buildHarnessPage`).
   Fixes N2. Declares `itemsProp` + representative `sample` records + the per-record child component;
   output is existing `repeat`+`component` vocabulary. Proven: ResourceList `{ ul + repeat×3 →
   ds.resource-item }`.
4. **Stage D — HOC/forwardRef unwrap + compound-component contracts** (code side,
   `core/extract-react-tsx.ts`/`extract/propose.ts`, *not* the floor). Fixes N4/N5. Attribute
   `IndexTableBase`+`IndexProviderProps` → `IndexTable`; model `IndexTable.Row`/`Modal.Section` as
   declared sub-parts. Sequenced last — the floor already mounts the public component.
5. **Stage E — component-aware readiness** (`capture.ts` steady-state probe). Fixes N6. Per-component
   settle signal (wait for loading-announcer text to clear) + a stage large enough for IndexTable's
   two-pass measure. Cheap once A–C land; the T3 boundary (live fills declared-not-drawn) remains by
   design.

**Definition of done** (DEPTH-BUILD north star): the `polaris-modal-composite-reproducible` eval —
capture Modal with the Stage-A open-driver + Stage-C `renderChildren`, emit a multi-root
`{dialog, backdrop}` contract with `slot` body and `component`-ref footer actions, `emit-html`
matches the captured anatomy part-for-part, `emit-figma-script` builds the nested set, both operating
points quoted, never widened. Passing it on Modal clears the overlay tier *and* the collection tier
(ResourceList/IndexTable share mechanics A–C).

**Separately (Axis-1 breadth, not difficulty):** the web-components mount adapter for the *floor* is
designed but not built (SECOND-SYSTEM §8) — building it once (against SWC) also covers Nord,
Shoelace, and every Lit/FAST shop. This widens which *systems* the floor can read; it is orthogonal
to the tier work above.

---

*Sources, all real runs: `examples/polaris/ADVANCED-PROBE.md` (7 depth failure classes),
`extract/depth-spike/DEPTH-BUILD.md` (3 proven mechanics + staged plan),
`examples/astryx/extraction/CENSUS.md`, `extract/pilots/ENTERPRISE-GAUNTLET.md`,
`extract/pilots/SECOND-SYSTEM-ASSESSMENT.md`, `examples/polaris/figma/PHASE-B5E-RECEIPT.md`,
`examples/polaris/receipts/canvas-gate/*.scorecard.json`,
`packages/schema/src/contract-schema.ts` (composition vocabulary),
`packages/emitter-web-components/` (WC parity + round-trip evals). This document is READ-ONLY over
those sources — it adds no capability and changes no engine code.*
