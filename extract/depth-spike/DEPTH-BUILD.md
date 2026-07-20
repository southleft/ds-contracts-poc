# DEPTH-BUILD — the validated architecture for advanced-component capture

**Status: working spike, three mechanics PROVEN on real Polaris (no engine edits).** This is to
advanced-component CAPTURE what `extract/computed-spike/DESIGN.md` was to the computed FLOOR: a
standalone harness that de-risks the architecture on the hardest real components before any change
lands in `extract/computed/`.

Everything below is from a run of `extract/depth-spike/run.ts` against `@shopify/polaris@13.9.5` in
the repo's pinned headless **Chromium 149.0.7827.55**, double-run byte-identical. Receipts:
`receipts/{numbers,capture.<c>,anatomy.<c>}.json`.

## The reframe this spike validates

`ADVANCED-PROBE.md` established that on the current pipeline none of Modal / Popover / ResourceList /
IndexTable produces a contract a designer would accept, and named four architectural assumptions
that quietly break at depth: (1) the component mounts declaratively, (2) its DOM lands inside its own
stage element, (3) its JSX roots at a single styled HTML element, (4) one file = one component.

The thesis this spike proves: **the contract VOCABULARY already expresses composition** — `repeat`,
`component`-refs, `slot`, and a multi-part `anatomy` map are all in the shipped schema and are
already produced by the design side (`core/propose-figma.ts`). **The gap is entirely on the code
side's computed FLOOR: it cannot MOUNT an advanced component with its real content, cannot CAPTURE
DOM that portals away, and cannot ROOT its anatomy anywhere but a single in-stage element.** Close
those three capture gaps and the advanced component maps onto vocabulary that already exists.

---

## The three mechanics — verdicts with numbers

Per-component numbers (from `receipts/numbers.json`). "Current reader" = what `capture.ts` reads
today: `stage.firstElementChild`. "Depth reader" = the spike's portal-aware, root-descending reader.

| component | M1 portal capture | current reader | M2 depth anatomy | M3 repeat |
|---|---|---|---|---|
| **Modal** | 1 root, **portaled**, 4097 B | **absent (0 parts)** | **2 real roots {`div.Modal-Dialog`, `div.Backdrop`}, 17 parts, depth 7** | none (correct) |
| **Popover** | 2 roots (1 in-stage activator + 1 **portaled** overlay, 2671 B) | present but **wrong element** (`div`, 2 descendants = the activator) | 2 real roots {`button.Button`, `div.Popover`}, 11 parts, depth 5 | none (correct) |
| **ResourceList** | 1 root, **in-stage** (0 portaled — correctly not a portal) | present, `ResourceListWrapper`, 49 descendants | 1 real root `ul.ResourceList`, 10 parts, depth 7 | **3× `li.ResourceItem__ListItem` → component-ref `ds.resource-item`** |
| **IndexTable** | 2 roots (1 in-stage + 1 portaled announcer, 101 B) | present, `IndexTable`, 134 descendants | **2 real roots** (Fragment multi-root: `IndexTableWrapper` + portal), 70 parts, depth 8 | 3× `IndexTable__TableHeading` |

### M1 — whole-document, portal-aware capture. **PROVEN.**

Mechanic: mark the element set present with the stage EMPTY (a two-phase React mount: baseline →
spec), then diff. Every element NOT in the baseline whose parent IS in the baseline is a **new root**
the component added — captured wherever React put it, classified `in-stage` vs `portaled`. One clean
mount per component (the stage is reset to empty between components), so overlays never stack (N7).

Evidence:
- **Modal** renders 100 % into a portal: the current reader (`stage.firstElementChild`) is **absent →
  the floor sweep throws today**. The depth reader captures a **4097-byte** portaled subtree — the
  real `.Polaris-Modal-Dialog` with title, body, footer, and close affordance. `0 → 4097 B`.
- **Popover** is the dangerous silent-false-success case: the current reader IS present but it is the
  **activator wrapper** (`div`, 2 descendants), not the popover. The depth reader captures **both**
  the activator (in-stage) AND the **2671-byte portaled overlay** (`.Polaris-Popover` → ActionList
  Import/Export). The wrong-element trap is closed.
- **ResourceList** renders inline: **0 portaled** roots — the mechanic correctly reports it is not a
  portal component (no false portal escape).

The baseline-diff read means the capture needs **no per-component portal-root selector** — it finds
the portaled DOM wherever React sends it (Modal's `document.body` theme container, IndexTable's
announcer). That is a simpler, more general fix than the "per-component portal root" `ADVANCED-PROBE`
sketched.

### M2 — root-descending, multi-root anatomy. **PROVEN** (the load-bearing class N3).

Mechanic: normalize each new root THROUGH transparent wrappers — `display:contents` (Fragment idiom),
box-less ThemeProvider / class-less positioning containers, and single-child box-less passthroughs —
to the component's REAL root(s), supporting **multi-root** (a box-less container or Fragment with
several children yields several real roots).

Evidence — **Modal**, the exact case that returned zero before (`<WithinContentContext.Provider>`
root, "none — root is a component"):

```
dialog <div.Modal-Dialog>  role=dialog          ← rooted at the DIALOG, not AppProvider
  Modal-Dialog__Modal
    Box → InlineGrid → title <h2> "Order details" + close-icon <path>   ← header → title + close
    label <p> "Body copy inside a sectioned modal."                     ← body / section
    Box → InlineStack → InlineStack
      button <button.Button> "Cancel"                                   ← footer → actions
      button <button.Button> "Save"
backdrop <div.Backdrop>                          ← SECOND real root (multi-root, real not an error)
```

**17 parts, tree depth 7, two real roots — versus the current reader's 0.** The header→title,
body, footer→actions, and close affordance are all present. The backdrop is a legitimate second root
(Modal genuinely renders a dialog AND a backdrop). This is the decisive N3 result: the floor carries
zero styling for advanced components today precisely because it cannot get past the Provider/wrapper
root; descending reaches a real styled tree.

`IndexTable` additionally exercises the **Fragment multi-root**: its public export is
`<><IndexProvider><IndexTableBase>…</IndexTableBase></IndexProvider></>` (see M4), and the depth
reader returns two real roots (the in-stage table wrapper + the portaled announcer) — 70 parts,
depth 8. A Fragment rendering several top nodes is handled as multi-root, not an error.

Subtlety found and fixed (recorded so productionization inherits it): Polaris draws a **divider
`border-top`** on ResourceList items after the first, so a naïve box-less test unwraps item 1 but not
items 2–3, breaking sibling homogeneity. The reader therefore detects repeats on the **raw** sibling
signature (tag + class stems — stable under the divider) BEFORE collapsing passthroughs, and keeps
the repeated wrapper as the component boundary.

### M3 — sample-data composition → repeat + component-ref. **PROVEN.**

Mechanic: the mount recipe gains a **sample-data channel** — representative `items` (three records,
to clear the proposer's ≥3-adjacent repeat threshold) and a `renderItem` that renders `ResourceItem`
with per-item `Avatar` media. The anatomy reader detects the repeated `ResourceItem` subtree as a
REPEAT part and recognizes `ResourceItem` (by its `Polaris-ResourceItem__…` class block) as a
composed child → a **component-ref** to its own contract.

Evidence — **ResourceList** captures as exactly `{list container + repeat(ResourceItem)}` with real
rendered structure (was a `0×0px` empty shell before):

```
listWrapper <ul.ResourceList>
  resourceitem <li.ResourceItem__ListItem>  REPEAT ×3  → component-ref ds.resource-item
    <a.ResourceItem__Link>
    InlineGrid → avatar <span.Avatar> → <svg.Avatar__Svg> → path,path
                 title <h3> "Ada Grace"
```

This maps directly onto the **existing** schema vocabulary the design side already emits
(`core/propose-figma.ts` `buildRepeatPart`, `contracts/table.contract.json`):

```jsonc
"items": { "type": { "arrayOf": { } }, "bindings": { "figma": { "kind": "NONE" }, "code": { "prop": "items" } } },
"item": {
  "component": { "id": "ds.resource-item" },
  "repeat": { "itemsProp": "items", "sample": [ {}, {}, {} ] }
}
```

**Sample-data authoring the config needs** (named, per the deliverable): a `renderChildren` channel
on `ComponentConfig` declaring, for a collection prop, (a) the collection prop name (`items`), (b) a
small set of representative records (the `arrayOf` fields + values that become `repeat.sample`), and
(c) the child component to render per record (`ResourceItem`) plus its per-item props (`media`,
`accessibilityLabel`, children text). For IndexTable the same channel supplies `headings` +
`IndexTable.Row`/`IndexTable.Cell` children. This is the one genuinely new authoring surface; it
carries no new schema — its OUTPUT is `repeat` + `component`, both already shipped.

### M4 — forward-to-base prop resolution. **CHARACTERIZED** (not built).

Confirmed in the source (`polaris-react/src/components/IndexTable/IndexTable.tsx`): the public export
carries no API of its own — it partitions its props and forwards the remainder to the impl:

```tsx
export function IndexTable({ children, selectable = true, itemCount, selectedItemsCount = 0,
    resourceName, loading, hasMoreItems, condensed, onSelectionChange, paginatedSelectAllText,
    ...indexTableBaseProps }: IndexTableProps) {
  return (<>
    <IndexProvider … {the partitioned props} >
      <IndexTableBase {...indexTableBaseProps}>{children}</IndexTableBase>
    </IndexProvider>
  </>);
}
IndexTable.Cell = Cell; IndexTable.Row = Row;   // compound sub-components (N5)
```

`interface IndexTableProps extends IndexTableBaseProps, IndexProviderProps` — the public prop type is
the UNION of the provider's and the impl's. The N4 pattern is therefore: **the public export's props
= (props consumed by a wrapper Provider) ∪ (props spread onto an internal Base impl)**, and the
declared API lives on `IndexTableBase` (17 props) + `IndexProviderProps`, under names no consumer
imports.

**Adapter rule (sketch, for the react-tsx side, not this floor):** when a public component's body is
a `forwardRef`/function that returns a wrapper chain terminating in `<XBase {...rest}>` (or a
`forwardRef(XBase)` / re-export), resolve the public API as the UNION of every prop TYPE the public
signature declares (here `extends IndexTableBaseProps, IndexProviderProps`) and attribute it to the
public name — the "lineage of cast-transparency / sibling-file resolution" `ADVANCED-PROBE` named.
The compound assignments (`IndexTable.Row`, `IndexTable.Cell`) declare the sub-part component-refs
(N5) — the same `component`-ref vocabulary M3 emits. This is a code-side (static-extraction) build,
sequenced AFTER the floor mechanics because the floor can already MOUNT the public `IndexTable` and
capture its real DOM regardless of where the props are declared.

---

## The schema-change question — ANSWERED: no schema additions required.

This is the headline finding. Every shape the three mechanics need **already exists in the shipped
schema** (`packages/schema/src/contract-schema.ts`) and is already produced by the design side:

| need | already in schema? | where |
|---|---|---|
| **multi-root anatomy** (Modal = dialog + backdrop) | **YES** | `anatomy` is `Record<string, Part>`; `walkAnatomy` iterates ALL top-level entries. Multiple roots are already legal. |
| **repeat** (ResourceList items) | **YES** | `RepeatSchema { itemsProp, sample }` + `arrayOf` prop (`bindings.figma.kind:'NONE'`). |
| **component-ref** (ResourceItem, Modal.Section) | **YES** | `ComponentRefSchema { id, props?, text? }` — e.g. `contracts/card.contract.json` avatar, `contracts/table.contract.json` header threading. |
| **slot** (Modal body accepts arbitrary content) | **YES** | `SlotSchema { name, accepts[], acceptsMode, defaultContent }`. |
| **session-linking** child → own contract | **YES** | `contractIdByKey` (componentSetKey → contract id), `resolveChildContract` — key-first. |

**The multi-root capability is blocked only in the FLOOR, not the schema.** `extract/computed/
anatomy.ts` hard-codes a single root: `const rootPart = contract.anatomy['root']; if (!rootPart)
throw` (promoteAnatomy), and `buildUnion` seeds from one `base.root`. `capture.ts` reads a single
`stage.firstElementChild`. So multi-root is a **capture.ts + anatomy.ts change**, not a schema
change. Likewise the sample-data channel is a **`ComponentConfig` change** (a `renderChildren`
field), and its OUTPUT (`repeat`/`component`) is existing vocabulary.

The one place a schema *touch* may later be wanted is not a mechanic gap but a fidelity nicety
(deferred, named): a `Part` today has no first-class "this element is a portal escape" flag — the
floor would record that as provenance, and if it ever needs to travel in the contract it is a small
additive field. It is **not required** for any of the three mechanics.

---

## Staged productionization plan (into `extract/computed/`, dependency order)

Each stage is independently landable and independently gated (root `tsc`, evals unchanged, the
existing computed-floor double-run byte-identity). No stage needs a schema change.

**Stage A — portal-aware, baseline-diff capture (fixes N1, N7).** `extract/computed/capture.ts`.
- Replace the single `stage.firstElementChild` read with the two-phase **baseline-diff**: mount the
  component's providers with the slot EMPTY, snapshot the element set, mount the combo, and capture
  every new root (in-stage + portaled), classifying each. The `captureJs` in this spike is the
  reference; it slots into `sweep()` in place of `captureJs(stageSel)`.
- `ComponentConfig` gains an **open-driver channel**: the prop(s) that make the overlay content exist
  (`{ open: true }` / `{ active: true }`), driven on mount. Marker grammar reuses the existing
  `$callback`/`$import` resolver (`onClose` → `$callback`).
- Overlay combos mount on a **reset stage** between combos (the spike resets to empty via
  `__setSpec(null)`) so portaled overlays never stack (N7). Throughput cost: overlay components lose
  the one-page-many-combos batching — named, bounded (advanced components are few).
- Determinism gate unchanged (this spike is double-run byte-identical).

**Stage B — root-descending, multi-root anatomy (fixes N3).** `extract/computed/anatomy.ts` +
`lib.ts`.
- `buildUnion` seeds from a single `base.root`; generalize to **seed from the array of real roots**
  returned by `realRootsOf(newRoot)` (this spike's `descendToRealRoots`). The union alignment,
  presence factorization, and SVG reconstruction machinery are per-node and carry over unchanged once
  the root set is plural.
- `promoteAnatomy`'s `const rootPart = contract.anatomy['root']` becomes **per-root** — one promoted
  top-level part per real root (Modal → `dialog` + `backdrop`). `walkAnatomy` already supports the
  multi-entry `anatomy` map, so the enriched contract validates unchanged.
- Port the transparent-wrapper predicate (`isBoxless` + `display:contents` + theme/anon unwrap) and
  the **raw-signature-before-collapse** repeat rule (the divider-border subtlety) verbatim.

**Stage C — sample-data `renderChildren` channel (fixes N2).** `ComponentConfig` +
`buildHarnessPage`.
- Add `renderChildren?: { itemsProp; sample: Record<string,…>[]; child: { importName; props; text } }`
  to `ComponentConfig`. `buildHarnessPage` materializes it into a real `items`/`renderItem` (or
  `headings` + `Row`/`Cell` children) at mount — the spike's `SPECS.resourcelist` is the reference.
- `anatomy.ts` gains a **repeat-promotion path**: a run of ≥3 raw-homogeneous siblings under a union
  parent promotes to one `repeat` part `{ itemsProp, sample }` + a sibling `component` ref; the child
  contract id comes from session-linking (`contractIdByKey` by componentSetKey; by class-block stem
  as the spike's stand-in). The `arrayOf` prop is added to the enriched contract's prop list.

**Stage D — HOC/forwardRef unwrap + compound-component contracts (fixes N4, N5).** Code side
(`core/extract-react-tsx.ts` / `extract/propose.ts`), NOT the floor — sequenced last because the
floor already mounts and captures the public component regardless. Attribute
`IndexTableBase`+`IndexProviderProps` → `IndexTable`; model `IndexTable.Row`/`Modal.Section` as
declared sub-part component-refs (the `component` vocabulary M3 already emits).

**Stage E — component-aware readiness (fixes N6), smaller follow-on.** `capture.ts` steady-state
probe: a per-component settle signal (e.g. wait for the loading announcer text to clear) + a stage
large enough to satisfy IndexTable's two-pass ResizeObserver measure. Cheap once A–C land.

---

## North-star acceptance test spec

The definition-of-done for the productionized capability, phrased as a re-runnable eval
(`polaris-modal-composite-reproducible`, sibling of `polaris-showcase-reproducible`):

1. **Capture.** Run the floor over `Modal` with the Stage-A open-driver and Stage-C `renderChildren`
   (a `Modal.Section` body + `primaryAction`/`secondaryActions`). Assert double-run byte-identity.
2. **Linked composite contract.** The emitted contract is a multi-root anatomy `{ dialog, backdrop }`
   with `dialog → { header → { title, closeButton }, section (slot accepts arbitrary), footer →
   actions }`; the footer actions are `component`-refs to `ds.button`; the body is a `slot` with
   `accepts`. Validate with `ContractSchema.parse` (no schema change) and `sortByDependencies` (no
   cycles; `ds.button` resolves).
3. **emit-html renders.** `emit-html` over the linked contract produces a DOM whose anatomy signature
   (tag + class-stem tree) **matches the captured anatomy** part-for-part (the `verify.ts`
   computed-equality discipline extended to the multi-root tree).
4. **figma-script builds the nested set.** `emit-figma-script` builds a Figma component SET whose
   node tree mirrors the anatomy (dialog frame with header/body/footer, nested Button instances for
   the actions), and `figma_check_design_parity` matches the captured tree.
5. **Gate.** Both operating points quoted (exact + AA), never widened; any mismatch carries a
   committed named cause or the eval fails.

Passing this on Modal (portal + multi-root + slot + nested component-refs in one component) clears the
whole overlay tier and the whole collection tier (ResourceList/IndexTable share mechanics A–C).

---

## Risks, with confidence

| # | risk | confidence it holds | mitigation / note |
|---|---|---|---|
| **R1** | **Baseline-diff mis-attributes shared portal chrome.** Polaris routes portals through a shared `PortalsManager`; a second overlay combo could reuse a portal container the baseline already saw, so its new subtree attaches under a NON-baseline parent and is missed. | **Medium-high (0.7)** that the reset-stage-per-combo approach avoids it (proven here: each component captured against a fresh empty baseline). Residual risk is multi-combo overlay sweeps. | Stage A resets the stage to empty between combos; if a shared portal container persists, mark the whole `document.body` delta as new-roots and de-dupe by identity (the spike already diffs by element identity, not position). |
| **R2** | **Role/part naming is heuristic.** M2 names parts from Polaris class stems + tag/role; a component whose classes don't encode role (or a non-Polaris library) yields weaker names, and the static layer must win names (the floor's existing `rejoinStaticParts` discipline). | **Medium (0.6)**. Structure (part COUNT, nesting, repeat) is robust and library-agnostic; NAMES are not. | Productionization keeps `rejoinStaticParts` (static wins names); the depth reader supplies EXISTENCE + structure, exactly the existing floor split. Names are provisional until the static join. |
| **R3** | **Sample-data authoring is manual and can bias the capture.** `renderChildren` records are human-authored; a too-small/too-uniform sample under-covers the repeat (e.g. never exercises an item's `shortcutActions`), and the floor captures only what the sample renders. | **Medium (0.55)**. The mechanic is proven; its COMPLETENESS depends on sample quality, which the config author controls — the same honest boundary the whole floor has (it captures what it mounts). | Record the sample verbatim in provenance (it already becomes `repeat.sample`); a reviewer sees exactly what was exercised. ≥3 records is the floor for repeat detection; per-item optional subtrees ride the existing presence-factorization (`visibleWhen`/`stylesWhen`). |

**Top-3 in one line:** R1 shared-portal attribution (mitigated by reset-per-combo, 0.7), R2 heuristic
part names (structure robust, names deferred to the static join, 0.6), R3 sample-data completeness
bounds capture completeness (recorded in provenance, 0.55).

## Honest bottom line

All three mechanics are proven with captured-tree receipts, not asserted: Modal goes from **0 →
17 parts (depth 7, dialog+backdrop multi-root)** with **4097 B** of portaled DOM the current reader
throws on; Popover's overlay (**2671 B**) is captured instead of the wrong activator; ResourceList
captures as **`{ ul + repeat(li.ResourceItem)×3 → component-ref ds.resource-item }`** instead of a
`0×0` shell. **No schema additions are required** — the vocabulary already exists; the work is three
staged, independently-gated changes to `capture.ts`/`anatomy.ts` plus one new config channel
(`renderChildren`). The code-side N4/N5 unwrap is a separable later stage the floor does not block.
