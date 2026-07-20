# Advanced-component depth probe — what the pipeline returns beyond the simple 12

**The owner's concern, verbatim:** *"This feels like a relatively simple set of components.
I'm concerned about what a more advanced one might return."*

This document answers it with real runs. Four of Polaris's hardest components — **Modal,
Popover, ResourceList + ResourceItem, IndexTable** — were pushed through **both halves** of the
pipeline (the react-tsx code-side extraction *and* the computed-floor browser mount), chosen to
stress distinct hard dimensions the simple 12 never touch: portal/overlay, imperative open,
positioning, repeated children, per-item media, and selection.

Every number below is from a run, not an estimate. A component that will not mount is stated
as a finding, not skipped.

## Provenance

- **Source (code side):** `Shopify/polaris` git tag `@shopify/polaris@13.9.5`, sparse-checked-out
  `polaris-react/src/components`. `polaris-react/package.json` reads `"version": "13.9.5"` — the
  **same version as the npm build** used for the mount, so no version-parity caveat applies.
  (The npm package ships only compiled `build/esm/*.js` + `build/ts/*.d.ts`; the react-tsx adapter
  needs `.tsx`, so genuine code-side extraction requires the source checkout — itself a finding:
  the adapter cannot run against an installed npm dependency, only against a source tree.)
- **Code side:** `npx tsx extract/run.ts code <config>` per component (react-tsx adapter over the
  component's source dir, DTCG tokens = `examples/polaris/tokens/polaris-light.dtcg.json`). All
  five runs exited 0; all proposed contracts schema-valid.
- **Mount side:** the real `@shopify/polaris@13.9.5` npm package, mounted inside `<AppProvider
  i18n={en}>` on the capture-floor's own stage recipe (`extract/computed/capture.ts`: a
  320×96 `display:flex; overflow:hidden` div, `stage.firstElementChild` is what the floor reads),
  bundled with the repo's esbuild, driven in the repo's pinned **headless Chromium 149.0.7827.55**
  via `chromiumExecutable()`. Each component mounted at two levels: **recipe-only** (only props the
  capture config grammar can express — enum axes + JSON `fixedProps` + `$callback`/`$import`
  markers) and **hand-authored** (a human supplies the real structural props). Each also rendered
  bare and inside a `<Frame>`.

---

## Per-component findings

### Modal — verdict: **DOES NOT MOUNT on the floor (capture throws)**

**Code side** (`root = Modal/`): 6 components extracted + **1 named skip**. The "Modal" a designer
means is really a *family* of files, each a separate proposed contract with nothing linking them:

| extracted | props | enum | bool | node | w/default | anatomy |
|---|---|---|---|---|---|---|
| `Modal` | 15 | **1** `size[small,large,fullScreen]` (inferred) | 7 | 2 | 2 | none — root is `<WithinContentContext.Provider>` |
| `Dialog` | 8 | 0 | 4 | 1 | 0 | empty |
| `Header` | 4 | 0 | 2 | 1 | 0 | none |
| `Footer` | 3 | 0 | 0 | 1 | 0 | none |
| `Section` | 4 | 0 | 0 | 1 | 3 | empty |
| `CloseButton` | 1 | 0 | 1 | 0 | 0 | none |
| ~~`FadeUp`~~ | — | **SKIPPED** | | | | `props type "CSSTransitionProps" resolves only to named reference(s) [React.ComponentProps<typeof CSSTransition>] whose members are outside module scope — 0 readable props` |

- The only style axis, `size`, resolved (same-file `type ModalSize`) but marked `inferred`.
- **Anatomy carried: zero token bindings.** Modal's JSX root is `<WithinContentContext.Provider>`
  — a component, not an HTML element — so the anatomy extractor refuses by name.
- The skip (`FadeUp`) is the **third-party-typed-props class**: props typed from
  `react-transition-group` are outside module scope → 0 readable props → skipped rather than
  proposing a hollow contract.

**Mount side:** `stage.firstElementChild` is **absent** for both recipe-only and hand-authored
mounts — `bareStageChildEls = 0`. The Modal renders **100% into a portal**: all
`.Polaris-Modal-Dialog` and `.Polaris-Backdrop` nodes are `portaledOutsideStage`. Measured, the
dialog is a **1200px-wide viewport overlay** (`insideStage:false`), and the Backdrop blacks out
the whole page. Because `capture.ts` does `if (!stage || !stage.firstElementChild) return null`
then `throw new Error('capture failed')`, **the floor sweep aborts on Modal** — it can never
enumerate its combos. The mount screenshot shows only *one* dialog surviving even though four were
mounted: every Modal shares one portal target and stacks.

**Contract would carry vs. what Modal is:** the contract carries a flat 15-prop API + a `size`
enum and *no styling*; the component is an imperatively-opened, portal-rendered overlay whose
anatomy (header / scrollable body / sectioned content / footer action row / backdrop) lives in
five sibling files and only exists in the DOM after `open` and a portal mount.

### Popover — verdict: **MOUNTS THE WRONG ELEMENT (silent false-success)**

**Code side** (`root = Popover/`): 3 extracted, **0 skips**, but the public name is not the impl:

| extracted | props | enum | note |
|---|---|---|---|
| `PopoverComponent` | 19 | **0** | the real surface; `preferredPosition` & `preferredAlignment` → `kind:"other"`, no values |
| `Pane` | 8 | 0 | |
| `Section` | 1 | 0 | |

- **The two positioning axes — the defining behavior of a Popover —** are typed from an imported
  union (`PositionedOverlay`), a cross-file/indexed-access type the single-file adapter cannot
  resolve, so both land as `kind:"other"` with **no enum values**. The floor's `propSpaceFor`
  only enumerates enum props → Popover has **nothing to sweep**.
- Anatomy: zero bindings — root is `<WrapperComponent>` (a component).

**Mount side:** `stage.firstElementChild` **is present**, but it is the **activator wrapper** (the
`<span>`/`<Button>`), *not the popover*. The overlay (`.Polaris-Popover`,
`.Polaris-PositionedOverlay`, measured 16×21, `position:absolute`) is **portaled outside the
stage**. So the floor would capture the activator's computed styles, believe it succeeded, and
mint a "Popover contract" that actually describes a button — the most dangerous outcome, because
nothing errors.

### ResourceList + ResourceItem — verdict: **MOUNTS EMPTY (recipe grammar cannot supply items)**

**Code side:** `ResourceList` → 20 props, **0 enum**, 4 node, 6 bool; `ResourceItem` → 17 props,
**1 enum** (`verticalAlignment[leading,trailing,center,fill,baseline]`, inferred), 2 events, 6
string. Both anatomies empty — roots are `<ResourceListContext.Provider>` and `<BaseResourceItem>`
(components). A second extracted "component," `UseId` (0 props), is a hook the PascalCase discovery
misfired on — a minor **false-positive-component class**.

**Mount side:**
- **recipe-only** (`items=[]`, `renderItem=()=>null` — the closest the config grammar gets, since
  arrays and render-prop functions are not expressible): renders
  `.Polaris-ResourceList__ResourceListWrapper` with **0 children, 0×0px** — an empty shell.
- **hand-authored** (2 items, per-item `Avatar` media, real `renderItem`): renders **inline
  (no portal)**, 2 `.Polaris-ResourceItem` nodes, "AdaGrace", 102×105px — correct.

The gap is not rendering; it is that the entire content (`items`, `renderItem`, per-item media and
shortcut-actions, selection state) is supplied through **arrays and functions the capture config
has no way to express**. The floor can only ever see the empty state.

### IndexTable — verdict: **MOUNTS A LOADING/MEASURING SKELETON (never the settled table)**

**Code side** (`root = IndexTable/`): 7 extracted, **0 skips**, and the **public export carries no
API**:

| extracted | props | enum | note |
|---|---|---|---|
| `IndexTable` (public) | **0** | 0 | Fragment wrapper — `component returns a Fragment — contract anatomy needs a single root element` |
| `IndexTableBase` (impl) | 17 | 2 (`sortDirection`, `defaultSortDirection`) | the real surface, under a name no consumer imports |
| `Row` | 10 | 2 (`tone[4]`, `rowType[3]`) | |
| `Cell` | 8 | 1 (`as[2]`) | |
| `Checkbox`, `CheckboxWrapper`, `ScrollContainer` | 1/1/2 | 0 | internal plumbing |

**Mount side:** recipe-only (`headings`, `itemCount=0`) renders the empty state ("No Items found").
Hand-authored (2 headings, selection, 2 Rows × 2 Cells) mounts **inline** and the DOM does contain
2 `<tbody>` rows — but even after a 2000ms settle in a 1200px viewport the text still reads
`"Loading orders…Loading orders…Select all orders…"`. IndexTable permanently renders a
**dual sticky-header table + loading announcers + a two-pass ResizeObserver measure scaffold**;
on the floor's clipped 96px stage it shows only that scaffold. Its real anatomy is deeper and more
runtime-conditional than any static part tree.

---

## Synthesis: the failure classes, ranked

### Known simple-set classes that RECUR at depth
1. **Sibling / cross-file union types drop to un-enumerable** (simple set: Badge `tone`, Tag
   `size`). At depth it hits the *load-bearing* axis: Popover `preferredPosition`/`preferredAlignment`
   → `kind:"other"`. Same class, higher stakes.
2. **Third-party-typed props skipped** (Modal `FadeUp` / `react-transition-group`). Same as the
   simple set's "Icon-typed props," now on a structural sub-component.
3. **Composition-owned styling invisible to single-file extraction** (simple set: Button label via
   Text primitive). At depth the *entire* component is composition (see class N3).

### NEW classes that ONLY surface on advanced components — the owner's answer
These cannot appear in a simple, single-HTML-root, declaratively-mountable component, so the
12-component showcase could never have revealed them:

| # | Failure class | Evidence | Pipeline location | Fix difficulty |
|---|---|---|---|---|
| **N1** | **Portal / overlay defeats the mount recipe.** Real surface renders outside `stage.firstElementChild`; capture returns null → **sweep throws** (Modal) or captures the **wrong element** (Popover activator). | Modal `bareStageChildEls=0`, dialog 1200px `insideStage:false`; Popover overlay `portaledOutsideStage`, only activator on stage. | `extract/computed/capture.ts` (stage read + one-page-many-combos mount) | **Hard** — needs per-component portal-root targeting, isolated pages per overlay combo, and an open-driver. |
| **N2** | **Structure-creating props aren't expressible in the config grammar.** `items`/`renderItem`/`headings`/`Row` children / a ReactElement `activator` are arrays, functions, and elements; the capture config only carries enum axes + JSON + callback markers. | ResourceList recipe-only renders 0×0px empty; IndexTable recipe-only renders "No Items found". | `extract/computed/capture.ts` config schema (`ComponentConfig`) | **Hard** — the grammar has no slot/render-prop concept; presence-props (Round 4) only toggle booleans. |
| **N3** | **Anatomy extraction returns zero when the JSX root is a Provider / wrapper / Fragment.** Every advanced component roots this way, so **no token bindings are carried** despite huge CSS modules (IndexTable 1633 lines, ResourceList 321). The simple set's 185 carried facts all came from HTML-rooted components. | Notes: `<WithinContentContext.Provider>` (Modal), `<WrapperComponent>` (Popover), `<ResourceListContext.Provider>` (ResourceList), `<BaseResourceItem>` (ResourceItem), `returns a Fragment` (IndexTable). | `extract/computed/anatomy.ts` / css-module adapter (single-root requirement) | **Medium-hard** — must descend through context/wrapper roots to the first styled host, matching JSX to CSS-module classes across composition. |
| **N4** | **Public export ≠ implementation surface.** The name a consumer imports carries 0 props; the real API is under an internal name. | `IndexTable` 0 props (Fragment) vs `IndexTableBase` 17; Popover public vs `PopoverComponent` 19; Modal vs `Dialog`. | `core/extract-react-tsx.ts` (HOC/forwardRef/re-export unwrapping) | **Medium** — follow `forwardRef`/re-export chains and attribute the impl's props to the public name. |
| **N5** | **Component-family fragmentation.** One design-system "component" = many extracted files with no relation recorded (Modal→6, IndexTable→7, Popover→3). A designer's "Modal" contract does not exist; six disconnected ones do. | Extraction counts above. | `extract/propose.ts` (one contract per file; no compound/sub-component model) | **Hard** — needs a compound-component contract shape (`Modal.Section`, `IndexTable.Row` as declared sub-parts). |
| **N6** | **Runtime-settling / measuring components never reach a captureable steady state.** Two-pass measure + sticky-header duplication + loading announcers mean the floor captures a skeleton. | IndexTable text stays `"Loading orders…"` after 2s in a 1200px viewport; 2 real `<tbody>` rows buried under scaffold. | `extract/computed/capture.ts` steady-state probe (paint-only, 600ms bound) | **Medium-hard** — needs component-aware readiness signals and a stage large enough to satisfy the measure pass. |
| **N7** | **Multi-combo page collision for overlays.** The floor mounts every combo on one page; portal/overlay components stack in one shared portal and one Backdrop blacks out all others. | Screenshot: 4 Modals → 1 visible dialog; 4 Popovers → 1 visible overlay. | `extract/computed/capture.ts` `buildHarnessPage` | **Medium** — one isolated page per overlay combo (throughput cost). |

### Honest bottom line

**On the current pipeline, none of these four advanced components produces a contract a designer
would accept — and two (Modal, Popover) produce a *misleading* one (an aborted sweep, or a
button's styles labeled as a Popover).** The distance is not a matter of tolerance-tuning the way
the simple set's 14 named mismatches were; it is **four architectural assumptions that quietly hold
for the simple 12 and quietly break at depth**:

1. the component mounts *declaratively* with JSON-ish props,
2. its real DOM lands *inside its own stage element*,
3. its JSX roots at a *single styled HTML element*, and
4. one *file* equals one *component*.

Advanced components violate all four. The code-side extraction is the healthier half — it honestly
proposes API surfaces and names its skips — but it, too, mis-attributes the public name (N4),
fragments the family (N5), and carries no styling (N3).

**The 3–5 highest-leverage builds to close the gap** (in dependency order):

1. **Portal-aware, per-combo mount + capture** (fixes N1, N7). Give `capture.ts` a per-component
   "portal root" selector and mount overlay combos on isolated pages driven to `open`. Without this,
   Modal/Popover/Dialog/Tooltip/Sheet/Toast are all uncaptureable — this unblocks a whole tier.
2. **Root-descending anatomy** (fixes N3). Walk through Provider/wrapper/Fragment roots to the first
   styled host element and map JSX→CSS-module classes across composition. This is what makes the
   floor carry *any* styling for advanced components; today it carries none.
3. **A slot / render-prop / child-rows grammar in the capture config** (fixes N2). A way to declare
   `items`, `renderItem`, `headings`, and child subtrees (`IndexTable.Row`, `Modal.Section`) so the
   floor can render a populated, not empty, component.
4. **HOC/forwardRef unwrapping + compound-component contracts** (fixes N4, N5). Attribute
   `IndexTableBase`→`IndexTable` and model `Modal.Section`/`IndexTable.Row` as declared sub-parts so
   the "component" a designer names actually exists as one contract.
5. **Component-aware readiness** (fixes N6) — a smaller, cheaper follow-on once 1–3 land: a
   per-component settle signal + adequate stage so measuring components reach the real table.

Builds 1 and 2 are the fork in the road: until the floor can *mount* an advanced component with its
*real content* and *read its real DOM*, the computed-truth half of the pipeline — the half that
produced the simple set's 262/276 match — contributes nothing at depth.

---

*Runs are reproducible from the scratchpad harness (extraction configs + `mount/entry.jsx` +
`mount/drive.mts`); no Polaris source is vendored into this repo. Polaris is MIT © Shopify.*
