# PATTERN-TAXONOMY — the component-pattern space, crossed against the contract vocabulary

Purpose: the contract engine handles primitives well and degrades on composites
(dependencies, slots, structural variation). This document enumerates the
component-pattern space from authoritative sources so the deterministic
proposer (`core/propose-figma.ts`) can be hardened **by class**, not by field
case. Every pattern is crossed against the contract vocabulary
(`scripts/contract-schema.ts`, schema v10) and given one of four statuses:

| Status | Meaning |
|---|---|
| **INFERRED** | Expressible today AND the proposer already produces it (function cited) |
| **EXPRESSIBLE / never proposed** | The schema carries it; no inference rule exists — hand-authoring only |
| **SCHEMA-ONLY** | The schema type admits it but generators refuse/ignore it (named limit) |
| **NOT EXPRESSIBLE** | Missing vocabulary — the smallest bounded addition is named |

Statuses were **verified against the code**, not assumed: `propose-figma.ts`
(3,207 lines, read in full) never emits `overlay`, `arrayOf`, `roleByProp`,
`meter`, `animation`, `events`/`toggles`, `slot.accepts`/`acceptsMode`/
`min`/`max`/`defaultContent`, `icon`, `attrs`, `a11y`, `layout.overlap`,
`figmaRepresentation`, or `"{parentProp}"` child-prop mapping — yet all of
these are hand-authored in the repo's 51 contracts (grep counts:
`acceptsMode` 26 files, `defaultContent` 8, `meter` 4, `events`/`toggles` 4,
`roleByProp` 3, `overlay` 1, `arrayOf` 1). The gap between "authored" and
"proposed" is exactly the composite gap.

## Sources

- **Design Systems Assistant MCP** (explicitly requested). Coverage found:
  designsystems.surf component directory (~60 component types) and per-system
  inventories (Fluent 2, Blueprint/Palantir, Circuit/SumUp, Duet/LocalTapiola,
  Flow/Skoda, LINE); designsystems.surf **Blueprints** with anatomy/states
  aggregated across systems (Tabs — 64 systems, Checkbox — 67, Chip — 27,
  Segmented control — 27, Radio, Slider, Switch); the **WAI-APG patterns
  index** (all 30 patterns with definitions); Radix Primitives and shadcn/ui
  composition docs; Figma component/variant docs and the **Slots (Schema
  2025)** early-access announcement. Note: the KB's own tag index is thin
  (3 tags) but its chunk store is substantive — `search_chunks` is the
  useful entry point, not `get_all_tags`.
- **WAI-APG** (w3.org/WAI/ARIA/apg/patterns/) — role graphs and state
  machines per pattern (via the MCP's indexed copy).
- **Figma Code Connect** (developers.figma.com/docs/code-connect/react/) —
  how Figma itself maps design constructs to code (Appendix A).
- **Competing Figma-to-code tools** — Builder.io Visual Copilot, Anima,
  Locofy (Appendix B, brief; sources listed there).
- **This repo** — `scripts/contract-schema.ts`, `core/propose-figma.ts`,
  `contracts/*.json` (read-only).
- Named design systems cited from their public documentation (Carbon,
  Material 3, Fluent 2, Spectrum, Primer, Polaris, Radix, shadcn/ui,
  Blueprint, Circuit); MCP-sourced claims cite designsystems.surf or the APG.

---

## 1. Pattern taxonomy

Cross-cutting patterns, ordered roughly by how much of the composite space
each unlocks. "Frequency" = how many of the surveyed systems exhibit the
pattern in their kits/APIs. Inference sketches are **deterministic only** —
string/structure tables, zero guessing; anything below the confidence bar is
a named note.

| # | Pattern | Frequency across systems | Figma spelling(s) | Contract mapping status | Deterministic inference sketch |
|---|---|---|---|---|---|
| P1 | Enum variant axes (variant/size/status) | Universal (every system surveyed) | Variant property `Size=Large` | **INFERRED** — `parseAxes` → enum props | shipped |
| P2 | Boolean props | Universal | `true/false` axis or BOOLEAN property | **INFERRED** — `isBoolAxis`, `applyVisibleBinding` | shipped |
| P3 | Interaction-state axis (State=Hover/Pressed/…) | Near-universal in *kits* (CBDS, Eventz field cases; Material/Fluent kits ship state variants) | Enum axis `State=Default\|Hover\|…` | **INFERRED** — `detectStateAxis` → contract `states` + `disabled` boolean; round-trips as `figmaStatePreviews` | shipped |
| P4 | Single slot (icon/action projection) | Universal for Button/Input/Card (Carbon `slot`, Material `content`, Radix `asChild`, shadcn children) | INSTANCE_SWAP property, usually in a wrapper frame; optional via `Show X` BOOLEAN | **INFERRED** — wrapper-frame and bare-swap paths in `buildPart`; default-slot judgment (first non-optional → `children`) | shipped |
| P5 | Slot constraint (what a slot accepts) | Universal in mature systems (Spectrum/Fluent restrict; Subframe "open" escape hatch — the schema doc cites it) | INSTANCE_SWAP `preferredValues`; native Slot `SlotSettings` | **EXPRESSIBLE (`slot.accepts`/`acceptsMode`) / never proposed** — proposer emits the literal note "author `accepts` manually" | Dump v1.5: capture `preferredValues` (componentKey list) per swap property → resolve each key through known contracts' `anchors.figma.componentSetKey` → `accepts: [ids]`, `acceptsMode: 'prefer'`; unresolvable keys become child stubs or named notes |
| P6 | Multi-child slot / default content | Common (Card body, Dialog footer actions, Toolbar groups — Polaris, Primer, shadcn) | Native Figma **Slot** (Schema 2025, early access — MCP source) with min/maxChildren; today: a frame holding N design-time instances | **EXPRESSIBLE (`defaultContent`, `min`/`max` → SlotSettings) / never proposed** (noted: "defaultContent not proposed — dump v1 does not carry configuration") | Dump v1.5: capture slot-node children (id + applied props) → `defaultContent` items drawn from `accepts`; native Slot nodes map min/maxChildren → `slot.min`/`max` |
| P7 | Nested component dependency (composite → child contract) | Universal for composites (every Dialog holds Button; Combobox holds Input + Listbox) | Nested INSTANCE of a library component | **INFERRED** — component refs + auto-proposed `childStubs`; base-instance flattening; self-reference guard | shipped |
| P8 | Parent→child prop threading | Very common (Carbon `size` cascades Button→Icon; CBDS Button→ds.icon sizes) | Child instance's applied variant value co-varies with a parent axis | **EXPRESSIBLE (`component.props: {"size": "{parentProp}"}`) / never proposed** — `canonicalizeInstanceProps` emits fixed values only | For each applied child prop: if its value across parent variants is a **function of exactly one parent enum axis by value with full coverage** (the `unifyRefs` per-value discipline, applied to prop values instead of token paths) → `"{parentAxisProp}"`; constants stay fixed values |
| P9 | Repeated-children collection (menu items, tab items, breadcrumb segments, table rows, pagination pages, avatar group, chip group) | **The defining composite pattern** — Menus/Tabs/Breadcrumbs/Pagination/Table appear in every surveyed inventory (designsystems.surf lists all six across Fluent, Blueprint, Circuit, Duet, Flow, LINE) | N sibling INSTANCEs of the same child component; count varies per variant or via `Show item 3` BOOLEANs; one sibling carries `Selected/Active` applied variant | **NOT EXPRESSIBLE as a canvas-bound fact.** `arrayOf` exists but is code-only by declared fidelity limit (`figma.kind: 'NONE'`); anatomy can only spell N fixed component-ref parts. Smallest bounded addition: `part.repeat: { itemsProp: string }` — an **item-template part** paired with an `arrayOf` prop; code maps over the array; canvas renders `defaultContent`-style fixed instances (its honest static state, the `meter` discipline) | ≥2 (tunable ≥3) adjacent siblings, same `instanceOf`, homogeneous applied-prop *shape* → ONE template part + `repeat` + `arrayOf` prop whose fields are the child's text/enum props; per-sibling differing text becomes the array fields; the drawn siblings become the canvas's static sample |
| P10 | Selected-item state inside a collection | Universal for Tabs/Menu/SegmentedControl (APG: `aria-selected`, `aria-current`; designsystems.surf Tabs blueprint: active indicator part, 64 systems) | The selected sibling instance has `State=Selected` applied; or a per-item boolean | **NOT EXPRESSIBLE** today (would need P9 + a selected-index concept). Smallest addition after P9: `repeat.selectedProp` (number/text prop naming the active item) + the item contract's own `selected` boolean | Do NOT infer from "one sibling differs" alone — receipt it (see DON'T D5) until `repeat` exists; then: exactly one sibling with a deviating boolean/state value → `selectedProp` sketch, still note-gated |
| P11 | Overlay / anchored popup (tooltip bubble, dropdown panel, popover, combobox listbox) | Universal (Tooltip/Popover/Dropdown/Combobox in every inventory; APG combobox = input + popup) | Child frame with `layoutPositioning: ABSOLUTE`, constraints attaching it to a root edge; per-placement variants | **EXPRESSIBLE (`overlay: { placement }`) / never proposed** — authored once (`typeahead-item`/tooltip lineage); the Tooltip field case rode `layoutByProp` + `stylesWhen` instead | An ABSOLUTE-positioned FRAME part whose constraints anchor it wholly outside/at one root edge, consistent across variants (or a function of a `placement` axis) → `overlay.placement: top\|bottom\|start\|end`; placement-axis correlation reuses the `invertNodeShape` per-axis machinery |
| P12 | Open/closed disclosure state machine | Universal (Accordion, Dialog, Drawer, Menu button, Combobox — APG: `aria-expanded` graphs) | BOOLEAN axis/property named `Open`/`Expanded`; or two variants Open/Closed | **EXPRESSIBLE (`events` + `toggles` + aria) / never proposed** — 4 contracts hand-author it (accordion-item, switch, checkbox lineage) | Boolean axis named `open\|expanded\|checked\|selected\|pressed` (bounded name table, the `detectStateAxis` discipline) on a set whose semantics are interactive → propose `events: [{ name, trigger: root-or-header, toggles: { prop, between: [false,true], aria: <matching> } }]`; name mismatch → note only |
| P13 | Conditional part (`Show X`, error/validation parts) | Universal for Field/Input composites (label, help text, error message — designsystems.surf Checkbox blueprint: optional Description; every system's TextField) | BOOLEAN visibility binding; presence correlated with an axis value; `hidden` flag pattern | **INFERRED** — `visibleWhen` via three routes: presence (`visibilityFromPresence`), hidden-pattern (`invertHiddenVisibility`), visibility bindings (`applyVisibleBinding`) | shipped |
| P14 | Element/role driven by a prop | Common (Heading level h1–h6; Banner error→alert; Button as-link) | Enum axis `Level=1..6`; `Status=error\|info` | **elementByProp: INFERRED for headings only** (`inferSemantics` level-axis rule). **roleByProp: EXPRESSIBLE / never proposed** (3 contracts author it — banner lineage) | Bounded table extension: a `status\|severity\|variant` axis with values ⊆ {error, warning, success, info} on a set named `alert\|banner\|toast\|message` → `roleByProp: { error→alert, else→status }` (the APG Alert pattern), note-gated |
| P15 | Per-variant structural variation (direction flip, reversed order, per-size layout) | Common (chat sender flip; toolbar density; Tooltip placement — field cases already in repo) | Auto-layout direction/align/order differing per variant | **INFERRED** — `invertLayoutByProp` (v7, incl. `-reverse` spelling) | shipped |
| P16 | Per-value token functions (size→padding scale) | Universal in scale-stepped vocabularies (CBDS field case) | Same field bound to different variables per axis value | **INFERRED** — `tokensByProp` (v10, `unifyRefs` per-value branch) | shipped |
| P17 | Theme/mode/density axes that are NOT props | Very common in kits (Material/Fluent kits ship `Theme=Light\|Dark`; Carbon: themes are token layers, never component props; DTCG modes) | Enum axis `Theme=Light\|Dark`, `Density=Compact\|…`, `Brand=X\|Y`, `Device=Desktop\|Mobile` | **NOT EXPRESSIBLE as what it is** — today it would be mis-proposed as an enum prop (wrong API). See §3 for the promotion rule (the mirror of state promotion). Smallest addition: a **mode-axis detector** that EXCLUDES the axis from props + a contract-level receipt (`notes`), optionally `modes: string[]` metadata | §3 |
| P18 | Part-level interaction states (menu-item hover, tab hover, row hover) | Universal in composites (APG/blueprints: items carry their own enabled/hover/focus/selected states — Tabs & Chip blueprints enumerate them per item) | Item component's own State axis; or per-part fills differing in root state variants | **SCHEMA-ONLY** — `Part.states` exists in the type but "root-level only in the current generators"; proposer receipts it (STYLE-FIDELITY B7: "part-level state overrides are outside the contract vocabulary") | Two-step: (a) when the item is its OWN contract (tab, list-item — the repo's compound-contract convention), P3 already handles it at the item level — **prefer decomposition over vocabulary**; (b) unlock `Part.states` in emitters for the residue (descendant rules under `.root:hover .part`), then extend `proposeStateDiffs` depth-1 diffs from receipt → proposal |
| P19 | Compound components (Tabs+Tab+TabPanel, Table+Row+Cell, Accordion+Item, List+Item) | Universal (Radix ships every composite as a Root+Parts family; the repo already authors tab/tab-list, table/table-row/table-cell, breadcrumbs/breadcrumb-item, list/list-item, accordion-item) | Separate component sets, instances nested; sometimes only the ITEM is a component and the group is a plain frame | **EXPRESSIBLE as separate contracts + component refs / partially inferred** (each set proposes independently; nesting → refs/stubs). NOT expressible: the cross-contract coordination semantics (selection scope, aria-controls wiring) — receipt, don't infer (D6) | Batch proposal already isolates per set; add a **family note**: sets whose names share a stem (`Tab`, `Tabs`/`Tab List`) and where one instances the other → note "compound family — review as a unit" (pure string/structure, no new vocabulary) |
| P20 | Cross-part ARIA relationships (label→input `for`, `aria-describedby` help text, `aria-controls` panel) | Universal for Field composites (APG requires them; GOV.UK/Carbon Field anatomy) | Not drawable — no canvas spelling | **NOT EXPRESSIBLE** — `attrs` carries literals/`{prop}` only; no way to reference a sibling part's generated id. Smallest bounded addition: `attrs` value micro-grammar `"{#partName}"` → emitter generates a stable id on that part and substitutes it | Never inferred from canvas (nothing to see); authored vocabulary only. Unlocks Field/Input+wrapper, Tabs aria-controls, Accordion header→region |
| P21 | Overlap collections (AvatarGroup) | Common (Avatar group in Fluent/Circuit/LINE inventories) | Negative `itemSpacing` | **EXPRESSIBLE (`layout.overlap`) / never proposed** — negative literal spacing currently mints a negative px token (wrong shape) | `itemSpacing < 0` uniform across variants → `layout: { overlap: true }` + gap token = \|spacing\| (the schema's documented negative-margin projection); axis-correlated negatives → note |
| P22 | Static/decor leaves (divider, arrow, indicator shapes) | Common | VECTOR/POLYGON nodes, absolute placement | **INFERRED** — `part.shape` (#42, dump v1.3) + placement `stylesWhen` | shipped |
| P23 | Value-fraction parts (progress fill, slider track fill, meter) | Universal (Progress bar/indicator in every inventory) | Fill child whose width is a % of the track in the drawn state | **EXPRESSIBLE (`meter`) / never proposed** — 4 contracts author it (progress-bar, slider lineage) | Do NOT infer the fraction from drawn pixels (D8) — a drawn 60% fill is sample data, not API. Name-gated note only: set named `progress\|slider\|meter` with a track/fill child pair → note "meter candidate — author `meter: { valueProp, maxProp }`" |
| P24 | Backdrop/scrim + viewport layering (Dialog, Drawer, Toast stack) | Universal for modal surfaces (APG Dialog: overlay on the page, focus trapped) | A full-bleed dimmed rect behind the panel; or not drawn at all (kit shows panel only) | **NOT EXPRESSIBLE** — `overlay` is root-edge-relative, not viewport-relative; no scrim/portal vocabulary. Smallest bounded addition (if census demands): `overlay.placement: 'center'` + a `backdrop: boolean` part flag projecting `position: fixed; inset: 0` + token. Behavior (focus trap, scroll lock) stays refused (D1) | Receipt for now: a full-bleed low-opacity sibling behind the main panel → note "scrim drawn — no contract vocabulary; panel proposed, scrim named" |
| P25 | Repeated-children order + arity bounds | Common (Toolbar/ButtonGroup min 1; Breadcrumb ≥2) | Native Slot min/maxChildren; otherwise undrawable | **EXPRESSIBLE (`slot.min/max` → Figma SlotSettings) / never proposed** | Rides P6 (native Slot capture); until then authored only |

---

## 2. Composite semantics table

The extension of `inferSemantics`' primitive table to composite classes.
Element+role graphs are **APG-sourced** (via the MCP's indexed APG patterns
page); the repo's own convention is confirmed against authored contracts:
composites use host `div` + ARIA role graphs (`table.contract.json` →
`div[role=table]`, `tab` → `button[role=tab]`, `toolbar` → `div[role=toolbar]`),
and collections decompose into **compound contract families** rather than
deep single-contract anatomies. That convention is the right target for the
proposer: prefer decomposition; the group contract holds a slot whose
`accepts` names the item contract.

Composition depth: how many contract layers a faithful model needs
(root / items / leaf parts).

| Component | Structure (compound family) | Element + role graph (APG) | Variant axes typically drawn (kits) | States beyond hover/focus (APG) | Repo status |
|---|---|---|---|---|---|
| **Dialog / Modal** | dialog → header(title, close:icon-button) + body(slot) + footer(slot accepts button) [+ scrim] | `div[role=dialog][aria-modal=true][aria-labelledby→title]`; alert variant `role=alertdialog` | size, status; `Open` boolean | open/closed; focus-trap (behavior — refused) | not authored; needs P24 receipt + P20 for labelledby |
| **Dropdown / Menu** | menu → item* (icon? + label + shortcut? + submenu-chevron?) + separator* | `div[role=menu]` → `div[role=menuitem\|menuitemcheckbox\|menuitemradio]`, separators `[role=separator]`; trigger = Menu Button pattern (`button[aria-haspopup=menu][aria-expanded]`) | size, density; per-item: destructive, disabled, checked | expanded/collapsed (trigger); checked (items); typeahead (refused) | not authored; the P9 flagship |
| **Select / Listbox** | trigger(input-like) + popup(listbox → option*) | `button/combobox` + `div[role=listbox]` → `[role=option][aria-selected]` | size, status(error), disabled | expanded; selected per option | not authored; P9 + P11 |
| **Combobox** | input + toggle-button + popup(listbox → option*) | `input[role=combobox][aria-expanded][aria-controls→listbox][aria-activedescendant]` | size, status | expanded; active-descendant (refused as behavior) | `typeahead-item` authored (the item leaf); group needs P9+P11+P20 |
| **Tabs** | tab-list → tab* (label + icon? + badge? + active-indicator) ⊕ tab-panel* | `div[role=tablist]` → `button[role=tab][aria-selected][aria-controls→panel]`; `div[role=tabpanel]` | orientation, size, variant(line/contained — Carbon) | selected per tab (P10); disabled per tab | **authored** (`tab`, `tab-list`); tab-list ↔ panel wiring needs P20; items-as-collection needs P9. designsystems.surf Tabs blueprint (64 systems): Container / Tab items / Label / Active indicator / optional Badge+Icon anatomy |
| **Accordion** | accordion → item* (header(button + chevron) + region(slot)) | `h3 > button[aria-expanded][aria-controls→region]`; `div[role=region][aria-labelledby]` | size, flush/bordered | expanded per item (P12) | **authored** (`accordion-item` with events/toggles); group contract needs P9 |
| **Card** | card → media? + header(title+subtitle+avatar?) + body(slot) + footer(actions slot) | `article` (or `div`); interactive card wraps in `a`/`button` | elevation/variant, orientation, interactive | — | **authored** (`card`, slot-based) |
| **Table / DataGrid** | table → header-row(header-cell*) + row*(cell*) [+ toolbar + pagination] | `div[role=table]` → `[role=rowgroup]>[role=row]>[role=columnheader\|cell]`; interactive grid = `role=grid` + `gridcell` (APG distinguishes static table from grid) | size/density, zebra, selectable | sort (aria-sort per header); selected per row; expanded (treegrid) | **authored** (`table`, `table-row`, `table-cell`, `table-header-cell` — the compound convention proven); rows-as-collection = P9's hardest case; sort/selection stay receipted |
| **Input + Field wrapper** | field → label + control-slot + help-text? + error-message? | `label[for→control]`; `input[aria-describedby→help,error][aria-invalid]`; error `[role=alert]` or described-by | size, status(error/warning), disabled, required | invalid/validation (P13 visibleWhen on `error` prop) | **authored** (`field`, `text-field`, `text-area`); the `for`/`describedby` wiring is P20 — the single missing piece |
| **Toast / Alert** | toast → icon(by-status) + content(title+body) + action? + close | `[role=status]` (polite) vs `[role=alert]` (error/assertive) — the roleByProp case (P14) | status(info/success/warning/error), dismissible | auto-dismiss timing (behavior — refused) | **authored** (`toast`, `banner` with roleByProp) |
| **Pagination** | nav → prev + page*(current!) + ellipsis + next | `nav[aria-label]` → `ul>li>a/button[aria-current=page]` | size, sibling-count | current per page item (P10) | **authored** (`pagination`, arrayOf — the one arrayOf contract) |
| **Breadcrumb** | nav → item*(link + separator) | `nav[aria-label=Breadcrumb]>ol>li>a`, last `[aria-current=page]` | size, separator style | current on last item | **authored** (`breadcrumbs` + `breadcrumb-item`) |
| **Navigation (side/top)** | nav → section* → item*(icon+label+badge?) [+ nested tree] | `nav` → `ul>li>a[aria-current=page]`; expandable groups = Disclosure per APG | density, collapsed | expanded per group; current per item | **authored** (`top-nav`/`top-nav-item`, `side-nav-item`) |
| **Avatar group** | group → avatar* (overlapped) + overflow-counter | `div[role=group]` or plain; counter is text | size (threads to avatars — P8), max | — | **authored** (`avatar-group`, `layout.overlap`); overlap inference = P21 |
| **List** | list → item*(leading? + content + trailing?) | `ul>li`; interactive list = `[role=listbox]` or menu depending on use (APG warns the distinction) | density, divider | selected (only if listbox) | **authored** (`list`, `list-item`, `metadata-list*`) |
| **Popover** | trigger + panel(slot) + arrow(shape) | trigger `[aria-expanded][aria-haspopup=dialog]`; panel `role=dialog` (non-modal) | placement (P11), size | open/closed (P12) | not authored; tooltip lineage covers arrow (P22) + placement |
| **Stepper / Progress steps** | stepper → step*(indicator(number/check) + label + connector) | `ol` → `li[aria-current=step]`; or `[role=list]` | orientation, size | complete/current/upcoming per step — an **item enum**, not interaction state | not authored; P9 + item contract with `status` enum |
| **Chip group** | group → chip*(label + leading-icon? + remove-button?) | `div[role=group]` (filter chips: `[role=listbox]>[role=option]` in some systems) | size, variant; per-chip: selected, removable | selected per chip; dismissed (event) | chip authorable today as its own contract; group = P9. designsystems.surf Chip blueprint (27 systems): Container / Label / optional Leading+Trailing icons; states enabled/hovered/focused/pressed/disabled/dragged |
| **Toolbar** | toolbar → group* → (button\|toggle\|separator)* | `div[role=toolbar][aria-orientation]`; roving tabindex (behavior — refused) | density, orientation | pressed per toggle (`aria-pressed`) | **authored** (`toolbar`, slots) |
| **Tooltip** | root + bubble(overlay) + arrow(shape) | `div[role=tooltip]`; trigger `aria-describedby` (P20) | placement (8-way in kits), variant | open (hover/focus-triggered — behavior refused) | **imported + shipped** — the Tooltip field case drove `layoutByProp`/`stylesWhen`/shape; `overlay` remains the cleaner target (P11) |
| **Switch / Checkbox / Radio group** | control(track+thumb / box+checkmark) + label + description? | `input[role=switch][aria-checked]`; checkbox tri-state `aria-checked=mixed` (the `toggles` outside-pair rule already handles mixed); radio group `[role=radiogroup]` | size, label position | checked/unchecked(/indeterminate); error (checkbox — designsystems.surf, 67 systems) | **authored** (`switch`, `checkbox` with events/toggles); radio-group = P9 over radio items |
| **Segmented control** | track → segment*(label+icon?) + active tile | `[role=radiogroup]>[role=radio]` or tablist-like; single-select | size, count | selected per segment (P10) | not authored; P9. designsystems.surf blueprint (27 systems): ≥2 segments + gliding active tile |

---

## 3. Theme/mode-axis promotion rules

The mirror image of interaction-state promotion (`detectStateAxis`): some
drawn axes are **not API** — they are token *modes* (DTCG modes / Figma
variable collection modes). Shipping `theme: 'light' | 'dark'` as a component
prop is the same category error as shipping `state: 'hover'`; Carbon,
Material, and Fluent all model theme/density as token layers or context, never
as per-component props.

**Detection (deterministic, two independent signals — both note-gated):**

1. **Name table** (the `detectStateAxis` discipline): axis property named
   `theme | mode | color-scheme | scheme | appearance` with values ⊆
   `{light, dark, high-contrast, dim, black, white}` → mode-axis candidate.
   `density | spacing` with values ⊆ `{compact, comfortable, spacious, cozy,
   condensed, default, regular}` → density candidate. `device | platform |
   breakpoint | viewport` → responsive candidate (see D7 — always refuse as
   a prop). Near-misses on a named axis: note, never guess.
2. **Structural corroboration** (what makes promotion *safe*, not just
   plausible): partition variants by the candidate axis, holding all other
   axes fixed. The axis is a mode iff for every pair: (a) the merged anatomy
   tree is **identical** (same children, order, types), (b) every bound
   field binds the **same variable name** on both sides (only *resolved*
   values differ — i.e. the variable itself is mode-switched), or the raw
   literals differ **only** on color-kind channels. Any structural or
   binding-name difference → NOT a mode; keep the enum prop and note why.

**Promotion actions:**

- **Theme axis, corroborated** → axis is EXCLUDED from props. Anatomy and
  facts build from the axis's first (default) value's variants only — the
  base-variant discipline of state promotion. Receipt:
  `variant axis "Theme" (Light|Dark) IS a token-mode axis, not API — excluded
  from props; bindings resolve per mode through the variable collection;
  dark-side resolved literals not minted`. Optional bounded metadata:
  `modes: ['light','dark']` on the contract (new field, receipt-grade — it
  changes no emitter output, it names the fact).
- **Theme axis, uncorroborated** (structure differs across themes) → keep as
  enum prop + a WARNING note ("axis named like a token mode but variants
  differ structurally — review; if this is theming, unify the drawn
  structure"). Never silently drop.
- **Density axis** → the split rule: token-only differences → mode treatment
  (or, where the kit's tokens already carry a density mode, exclusion);
  structural differences (Carbon's table density changes row anatomy) →
  a legitimate enum prop, INFERRED as today. The corroboration step decides —
  no name-only promotion for density.
- **Brand/product axes** → same corroboration; brands are almost always
  token collections (multi-brand is DTCG's headline mode case).
- **Minting interaction:** mode-excluded variants must NOT feed the mint
  pass (a dark-mode hex minting `imported.*` tokens would fabricate a
  second palette). Mint from the default mode only; other modes are receipts.

---

## 4. The DON'T list — patterns that stay receipted or refused

| # | Pattern | Why it must not be inferred |
|---|---|---|
| D1 | **Behavior** — focus trap, roving tabindex, typeahead, dismiss-on-esc, drag, auto-dismiss timers, animation choreography | The schema's own charter (EventSchema doc: "Complex behavior … stays a hand-written layer; contracts refuse to pretend otherwise"). The canvas draws none of it; any inference would be invention. APG keyboard tables are *implementation* references, not extractable facts. |
| D2 | **Semantics beyond the bounded tables** — guessing element/role from visual appearance, layer styling, or AI classification | The engine's identity is deterministic + reviewable. Name/axis/structure tables only; every hit is a named note. A `div` hedge with a note beats a confident wrong `nav`. |
| D3 | **`slot.accepts` from observed content** when `preferredValues` is absent | One drawn Button inside a slot is sample data, not a constraint. `accepts` narrows the API (narrowing is a MAJOR version per the schema) — inferring it from a sample silently over-constrains. Capture real `preferredValues` (P5) or leave unconstrained + note. |
| D4 | **Theme axes as enum props** (the inverse of §3) | The current behavior — and the worst outcome: plausible, schema-valid, *wrong* API that every downstream surface then faithfully renders. §3's corroboration gate is the fix; when the gate fails, the WARNING note is mandatory. |
| D5 | **Selected-item inference from "one sibling differs"** (pre-P9) | Without a collection vocabulary, "the second Tab is Selected" inverts to per-part `visibleWhen`/token noise across N fixed parts — structurally true, semantically garbage. Receipt: "collection with one deviating item — repeated-children pattern, no vocabulary (P9)". |
| D6 | **Cross-contract coordination semantics** (Tabs↔TabPanel selection scope, Menu↔MenuButton ownership) | Two separate component sets carry no drawable link. `aria-controls` wiring becomes authorable via P20; the *coordination* (what selects what) is behavior → D1. Family note (P19) is the honest ceiling. |
| D7 | **Responsive/breakpoint axes as props** (`Device=Desktop\|Mobile`) | Neither a prop nor a token mode — it is a layout concern the consuming page owns. Exclude from props, receipt the axis, propose from the first value's variants (mirror of §3), and name the other variants as uncarried. |
| D8 | **Numeric value recovery from drawn fractions** (progress fill %, slider thumb position) | A drawn 60% fill is the canvas's static sample (the `meter` doc says exactly this: "the canvas renders the defaults' fraction — its honest static state"). Inverting pixels → `value default 60` fabricates API from an illustration. Name-gated note only (P23). |
| D9 | **Per-state anatomy** (children that exist only in Hover variants, beyond the focus-ring convention) | Already receipted by `proposeStateDiffs` ("per-state anatomy has no contract vocabulary"). The one principled exception is shipped (stroke-only focus child → outline pair). Everything else stays a receipt — state-conditional DOM is a code-side design decision. |
| D10 | **Detached instances, redline/annotation layers, `_private` helper sets** | Kits ship documentation scaffolding alongside components (CBDS field case: template/private-helper sets). Batch isolation already skips failures; add nothing that tries to "understand" annotation layers. |
| D11 | **Deep instance internals** (recursing into nested instances to extract the child's anatomy from the parent's dump) | Dump v1 stops at instance boundaries *on purpose* — the child contract owns its internals; extracting them from a parent's context would fork identity. Child stubs + "import the real set" is the correct shape. |

---

## 5. Ranked recommendation order

Assumes the census (running in parallel) supplies real frequencies from the
kit; the ranking below orders by (composite classes unlocked) x (wrong-API
risk removed) / (vocabulary growth required). Re-rank the middle when census
numbers land; #1–3 are robust to any plausible census.

1. **Mode/theme-axis promotion (§3, P17)** — zero new emitter vocabulary,
   pure proposer table + corroboration diff, and it removes the one case
   where the proposer currently produces *confidently wrong API* on every
   themed kit. The mirror of `detectStateAxis`, which is already proven.
2. **INSTANCE_SWAP `preferredValues` capture → `slot.accepts` (P5, dump
   v1.5)** — completes the slot story end-to-end (the schema's whole
   two-tier constraint design is waiting on it); resolves through existing
   `componentSetKey` anchors; also unlocks P6 (`defaultContent`) and P25
   (`min`/`max`) from the same capture pass.
3. **Repeated-children collections: `part.repeat` + `arrayOf` pairing
   (P9)** — the single largest composite class (menu, tabs, breadcrumb,
   pagination, chip group, segmented control, stepper, table rows, avatar
   group all reduce to it). One bounded vocabulary addition; canvas
   projection stays honest (fixed sample instances, the `meter` discipline).
4. **Parent→child prop threading `"{parentProp}"` (P8)** — vocabulary
   already exists; the inference is the per-value correlation machinery
   (`unifyRefs`) pointed at applied instance props instead of token paths.
   Small, high-frequency (every size-cascading composite).
5. **Overlay inference (P11)** — vocabulary exists; ABSOLUTE-positioned
   edge-anchored frame is a crisp structural signature; unlocks the
   popup half of Select/Combobox/Popover/Menu and retires the
   stylesWhen-spelled tooltip placement as the only route.
6. **Open/closed → `events.toggles` (P12)** — vocabulary exists; bounded
   name table over boolean axes; brings Accordion/Disclosure/Menu-button
   composites their state machine + ARIA for free.
7. **Part-level states (P18)** — prefer compound-contract decomposition
   first (no vocabulary change; the repo's own convention); then unlock
   `Part.states` in the two CSS emitters + extend `proposeStateDiffs`
   depth-1 receipts into proposals. Retires STYLE-FIDELITY B7.
8. **`roleByProp` inference for status-bearing feedback components (P14)** —
   tiny bounded table (alert/status per APG); high a11y value per line of
   code; 3 contracts already model the target shape.
9. **Cross-part ARIA id references `"{#partName}"` (P20)** — small `attrs`
   micro-grammar + emitter id generation; never canvas-inferred, but it is
   the last missing piece for the Field composite (label/for,
   describedby) and Tabs/Accordion controls wiring, which the census will
   almost certainly rank as top-frequency composites.
10. **`layout.overlap` from negative `itemSpacing` (P21)** — one-line
    detection, fixes an actively wrong current inversion (negative px
    mint), completes AvatarGroup.

---

## Appendix A — how Figma itself maps design→code (Code Connect)

From developers.figma.com/docs/code-connect/react/ — the vocabulary Figma
chose is a useful sanity check on the contract's binding grammar (the schema
already cites Code Connect as its prop-grammar lineage):

| Code Connect helper | Figma construct | Contract equivalent |
|---|---|---|
| `figma.string()` | TEXT property | `bindings.figma.kind: 'TEXT'` |
| `figma.boolean()` | BOOLEAN property (also: conditional rendering) | `'BOOLEAN'` / `visibleWhen` |
| `figma.enum()` | VARIANT property → arbitrary code values | `'VARIANT'` + `values` map |
| `figma.instance()` | INSTANCE_SWAP property | slot (swap-backed) / component ref |
| `figma.slot()` | Native Slot area (freeform content) | `SlotSchema` (native-Slot migration path already noted in schema) |
| `figma.children("Icon*")` | Child instances **by layer name, wildcards, arrays** | no equivalent — this is Figma's own answer to repeated children (P9): match N children by name pattern and project as JSX children |
| `figma.nestedProps()` | Reach into ONE nested instance's properties without connecting it | base-instance flattening / `component.props` (the proposer's flattening is the same move, inverted) |
| `figma.textContent()` | A child text layer's characters by name | `content: { prop }` / `part.text` |
| Variant restrictions | Pin an example to specific variant combos | per-variant compile (subst machinery) |

Notable: Code Connect solves repeated children with **name-pattern matching**
(`"Icon*"`), not a collection type — evidence that a bounded, name/structure-
driven `repeat` detection (P9) is the industry-standard shape, not an exotic
one. `figma.slot()` shipping alongside Schema 2025 native Slots (MCP source:
help.figma.com 35794667554839, early access) confirms the schema's
`min`/`max` → SlotSettings mapping is the right forward bet.

## Appendix B — how competing Figma-to-code tools handle composition (brief)

- **Builder.io Visual Copilot** — AI semantic matching maps Figma components
  to *existing code components* (with a CLI pre-mapping step and manual
  remap control); output reuses your components rather than re-generating
  parallel ones. Closest philosophical cousin to the contract engine's
  anchors — but the mapping is probabilistic where contracts are anchored
  identity.
- **Locofy** — "Lightning Tags": the user marks layers as components,
  **lists**, or buttons, and generation respects the tags. Their "list" tag
  is the human-in-the-loop version of P9 — they made repeated-children a
  first-class *user assertion* because detection alone wasn't reliable.
  The contract engine's note-gated inference + review is the deterministic
  analogue.
- **Anima** — most literal translation: flat structure, absolute/semi-
  absolute positioning, minimal component decomposition; composition is
  essentially not modeled (Frontier extension adds code-component mapping
  in Dev Mode).
- Shared industry finding (2025–26 comparisons): none of the tools fully
  solve nested auto-layout or interactive states — 20–50% of design time
  goes to refining output. Composition is the open problem for everyone;
  the contract engine's compound-contract + receipt discipline is a
  defensible differentiator, not a gap to be embarrassed by.

Sources: [sixtythirtyten 2026 comparison](https://www.sixtythirtyten.co/blog/from-figma-to-code-ai-design-to-dev-workflows-in-2026),
[Builder.io Visual Copilot](https://www.builder.io/blog/figma-to-code-visual-copilot),
[Visual Copilot 1.0](https://www.builder.io/blog/visual-copilot),
[SiteGrade Locofy vs Builder vs Anima](https://sitegrade.io/en/blog/locofy-vs-builder-io-vs-anima-design-to-code-2026/),
[aidesigner tool roundup](https://www.aidesigner.ai/blog/figma-to-code-tools),
[Figma Code Connect React docs](https://developers.figma.com/docs/code-connect/react/),
[WAI-APG patterns](https://www.w3.org/WAI/ARIA/apg/patterns/),
[designsystems.surf blueprints](https://designsystems.surf/blueprints) (via Design Systems Assistant MCP),
[Figma Slots — Schema 2025](https://help.figma.com/hc/en-us/articles/35794667554839) (via MCP).
