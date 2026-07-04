# Enterprise Components — Spec-Gap Report

*Research round, July 3, 2026. Sources, stated honestly: the Design Systems Assistant knowledge base was queried exhaustively (search_design_knowledge + search_chunks; ~400K chars of retrieved content read in full via subagents). It yielded **pattern-level and standards evidence** — the designsystems.surf component survey across ~70 systems (component taxonomy: "Alert banner" vs "Snackbar" vs "Inline message" as distinct families; Text field / Help text / Label as separate concerns), the W3C ARIA Authoring Practices Guide pattern definitions (alert, table vs grid), and the WCAG 3.0 Working Draft's form/error/notification requirements (quoted inline below) — but **no per-system API documentation**. The per-system prop/anatomy tables below therefore come from the five systems' published, stable component APIs (Carbon `TextInput`/`InlineNotification`/`DataTable`, React Spectrum `TextField`/`InLineAlert`/`TableView`, Polaris `TextField`/`Banner`/`IndexTable`, Atlassian `Textfield`+`Form`/`SectionMessage`/`DynamicTable`, MUI `TextField`/`Alert`/table components) as known to the author; each row should be treated as verified-by-convergence (five systems agreeing) rather than by live citation. Current schema baseline: `scripts/contract-schema.ts` (v2/v3), docs/02, docs/08, docs/09.*

**The question this answers:** what do enterprise-grade components — TextField, InlineNotification, DataTable — demand of the contract schema that Button/Card/Table v1 did not, and what is the minimal schema addition for each demand.

**The headline:** the big systems agree on structure to a remarkable degree, and almost every "missing feature" reduces to one of **six schema gaps**: conditional part visibility, prop→HTML/ARIA attribute bindings, part-level (not root-only) state tokens, icon-by-enum-value asset handling, structured a11y relationships (label/describedby/live-region), and a declared behavior/events boundary. No gap requires rethinking the model — all six are additive fields on existing schema objects.

## 1 · Text input / TextField

The classic complexity benchmark. Every surveyed system converges on the same five-zone anatomy; the differences are naming and how validation messaging is switched.

### 1a · Consolidated inventory across systems

**Props** (canonical name → per-system spellings):

| Canonical | Carbon `TextInput` | Spectrum `TextField` | Polaris `TextField` | Atlassian `Textfield`+`Field` | Material (MUI) `TextField` | Type |
|---|---|---|---|---|---|---|
| `label` | `labelText` (required) | `label` | `label` | `label` (on Field) | `label` | text, required |
| `hideLabel` | `hideLabel` | `aria-label` fallback | `labelHidden` | — | — | boolean |
| `helperText` | `helperText` | `description` | `helpText` | `HelperMessage` child | `helperText` | text, optional |
| `placeholder` | `placeholder` | `placeholder` (discouraged) | `placeholder` | `placeholder` | `placeholder` | text → **HTML attribute** |
| `value` / `defaultValue` | `value` | `value`/`defaultValue` | `value` | `value` | `value` | text → attribute |
| `invalid` | `invalid` | `validationState="invalid"` | `error` (string doubles as flag) | `isInvalid` | `error` | boolean/data-state |
| `invalidText` | `invalidText` | `errorMessage` | `error` (string) | `ErrorMessage` child | `helperText` swap | text, conditional |
| `warn` / `warnText` | `warn`, `warnText` | — | — | — | `color="warning"` | boolean + text (Carbon 3-tier: error > warning > helper) |
| `required` | `required` + label asterisk | `isRequired` + `necessityIndicator` | `requiredIndicator` | `isRequired` | `required` | boolean → attribute + indicator part |
| `disabled` | `disabled` | `isDisabled` | `disabled` | `isDisabled` | `disabled` | boolean → attribute |
| `readonly` | `readOnly` | `isReadOnly` | `readOnly` | `isReadOnly` | `InputProps.readOnly` | boolean → attribute |
| `size` | `sm \| md \| lg` | `size` (RSP: `S/M/L` via scale) | — (fixed) | `appearance` axis instead | `size="small\|medium"` | enum |
| `prefix` / `suffix` | — (icon via `slug`/decorator) | `icon` (start) | `prefix`, `suffix` | `elemBeforeInput`, `elemAfterInput` | `InputAdornment` start/end | slots |
| `maxLength` + counter | `enableCounter` + `maxCount` | — | `maxLength` + `showCharacterCount` | `maxLength` | `inputProps.maxLength` + manual counter | number → attribute + computed part |
| `type` | `type` (text/password/email…) | `type` | `type` | `type` | `type` | enum → attribute |
| `inputMode`/`autocomplete` | pass-through | pass-through | `autoComplete`, `inputMode` | pass-through | pass-through | text → attribute |
| `clearButton` | — | — | `clearButton` + `onClearButtonClick` | — | — | boolean part + event |
| `onChange` | `onChange` | `onChange` | `onChange` | `onChange` | `onChange` | **event** (behavior) |

**Anatomy parts** (union; every system has the first five):

```
textfield
├─ labelRow
│  ├─ label                  (text ← label prop)
│  └─ requiredIndicator      (visible when required)
├─ fieldWrapper              (the visual "box"; carries border/background tokens & state styling)
│  ├─ prefix / startAdornment  (slot, optional)
│  ├─ input                  (the <input> element — attributes bind HERE, not on root)
│  ├─ validationIcon         (Carbon/Polaris: error/warning icon inside the box, per status)
│  └─ suffix / endAdornment  (slot, optional; Polaris clearButton lives here)
└─ messageRow
   ├─ helperText             (visible when NOT invalid/warn — Carbon, Polaris, Spectrum all REPLACE)
   ├─ errorText              (visible when invalid; icon + text in Atlassian/Spectrum)
   ├─ warnText               (Carbon only: visible when warn && !invalid)
   └─ counter                (Carbon enableCounter, Polaris showCharacterCount: "12/100")
```

**States.** Two distinct axes that the systems are careful to keep apart:
- *Interaction states* (pseudo-class-like): `hover`, `focus-within` (the wrapper shows the focus ring, not the input), `disabled`, `readonly`.
- *Validation status* (data states, mutually exclusive): `default | invalid | warning | success` — Carbon's precedence rule is normative: **invalid > warn > helper**. These are enum-prop territory (TableRow's `state` prop already proved the mechanism), *but they must restyle a nested part* (`fieldWrapper` border) *and switch message parts* — which is where the current schema stops.

**Conditional visibility rules stated by the systems:**
1. `errorText` renders **only when** `invalid`; it **replaces** `helperText` (Carbon, Polaris, Spectrum, Atlassian — unanimous).
2. `warnText` renders only when `warn && !invalid` (Carbon).
3. `requiredIndicator` renders only when `required` (all; Spectrum makes the indicator style itself a prop).
4. `counter` renders only when `enableCounter/showCharacterCount` **and** `maxLength` present (Carbon, Polaris).
5. `validationIcon` swaps per status and hides at `default`.

**A11y requirements** (ARIA APG "names and descriptions"; WCAG 3.0 Working Draft, retrieved via KB; all five systems implement these):
- `<label for>`/`htmlFor` → input `id` (or `aria-labelledby`). WCAG 3.0: *"Check that each input in the source code has a programmatically associated label using for/id attributes"*; *"The programmatic name includes the visual label."*
- `aria-describedby` on the input pointing at helper **or** error text (whichever is visible); Carbon and Polaris chain counter in too. WCAG 3.0 on constraints: *"confirm that the constraint is programmatically listed in the code and associated with the input."*
- `aria-invalid="true"` when invalid; `aria-required` when required.
- Error association is normative, not stylistic — WCAG 3.0: *"When input validation fails, the errors are visually and programmatically associated with the element that caused the error or that can resolve it"*, and *"Error messages persist at least until the error is resolved or the user dismisses them."*
- The `validationIcon` part is likewise standards-backed — WCAG 3.0: *"Error messages are visually indicated using at least two of the following: A symbol… Color… Text…"* — i.e. icon + color + text is the compliance floor, which is why every system bakes the status icon into the anatomy.
- Error message announced on appearance — Polaris/Atlassian wrap the message row in a polite live region.

### 1b · What the current schema already covers

| Need | Covered by |
|---|---|
| `label`, `helperText`, `invalidText` as text props | `type: "text"` props + `content: { prop }` parts |
| `size` enum with token substitution | enum prop + `{size}` placeholders |
| `disabled` boolean → native attribute on root | boolean prop rule in docs/02 |
| prefix/suffix slots with `accepts` | `slot` parts (`accepts: ["ds.icon", "ds.button"]`) |
| validation status as enum | plain enum prop (TableRow `state` pattern) |
| label/wrapper/message anatomy tree | nested `parts` |
| focus ring styling | root `states` (focus-visible) — but see gap G3 |

### 1c · Specific gaps

**G1 — Conditional part visibility.** `optional: true` only means "visible when the slot prop is provided." TextField needs *prop-predicated* visibility: `errorText` when `invalid === true`, `counter` when `showCounter === true`, and the replace semantics (helper hidden when error shown).

> Proposed addition — `visibleWhen` on `Part`:
> ```ts
> visibleWhen?: Array<{ prop: string; equals: string | boolean }>  // AND semantics
> ```
> - **Code:** `{invalid && <span className={s.errorText}>{invalidText}</span>}` — and the generator derives the "replace" rule mechanically when two sibling parts have complementary predicates (`equals: true` / `equals: false`).
> - **Canvas:** for boolean props, bind node visibility to the boolean component property (a native design-tool visibility binding, zero new machinery); for enum props, show/hide the node per variant combo during variant generation (the generator already iterates combos for token substitution).
> - **Differ:** for each `visibleWhen` part, assert the canvas node's visibility binding / per-variant visibility matches.

**G2 — Prop→HTML-attribute bindings on a *part*.** `placeholder`, `maxLength`, `type`, `autocomplete`, `readonly`, `value` are attributes **of the nested `input` part**, not of the root, and not classes/tokens. The current code binding (`code: { prop }`) can only surface a prop as a React prop; nothing routes it to an attribute on an inner element.

> Proposed addition — `attrs` on `Part`:
> ```ts
> attrs?: Record<string, { prop: string } | { const: string }>
> // e.g. input part: { placeholder: { prop: "placeholder" }, maxlength: { prop: "maxLength" }, type: { const: "text" } }
> ```
> - **Code:** rendered as JSX attributes on that part's element.
> - **Canvas:** placeholder is *display content* — cover it with a text property bound to the placeholder text node (`content: { prop: "placeholder" }` on a ghost-text part); the rest (`maxlength`, `autocomplete`) are **code-only surface**, exactly like `:hover` is CSS-only — the differ ignores them on the canvas side by rule.

**G3 — Part-level states (docs/08 known gap, now load-bearing).** The focus ring and invalid border live on `fieldWrapper`, not root; `focus-within` (not `focus-visible`) is the correct pseudo-class for composite fields. Additionally, *data-state token overrides* are needed: `fieldWrapper` border-color per validation status.

> Proposed addition — two parts:
> 1. Lift the root-only restriction: allow `states` on any part; add `"focus-within"` and `"readonly"` to the state enum. (Schema already permits `states` on `Part` — this is a *generator* lift plus enum widening.)
> 2. `tokensWhen` on `Part` for data states:
> ```ts
> tokensWhen?: Array<{ when: { prop: string; equals: string | boolean }; tokens: Record<string, TokenRef> }>
> // fieldWrapper: [{ when: { prop: "status", equals: "invalid" }, tokens: { "border-color": "{color.border.danger}" } }]
> ```
> - **Code:** emits `.status-invalid .fieldWrapper { … }` (or data-attribute selector `[data-status="invalid"]`).
> - **Canvas:** the status enum is a variant axis; `tokensWhen` styles that part in the matching variant combos — same per-combo machinery as `{placeholder}` substitution, generalized to parts whose token *path* doesn't encode the prop.

**G4 — A11y relationships.** The current `a11y` block (`focusVisible`/`minHitArea`/`contrast`) can't express label-for, describedby chains, or aria-invalid.

> Proposed addition — `a11y.relationships` + attribute-level ARIA via G2:
> ```ts
> a11y: {
>   relationships?: Array<{
>     type: 'labels' | 'describes';
>     from: string;            // part path, e.g. "labelRow.label"
>     to: string;              // part path, e.g. "fieldWrapper.input"
>     when?: { prop: string; equals: string | boolean };  // conditional describedby (error vs helper)
>   }>;
> }
> ```
> - **Code:** generator mints stable ids (`${componentId}-label`) and emits `htmlFor`/`aria-describedby`; conditional relationships follow the same predicate as G1 so the describedby always points at the *visible* message.
> - **Canvas:** no-op (code-only surface); recorded for documentation/annotations.
> - `aria-invalid`/`aria-required` route through G2 `attrs`: `{ "aria-invalid": { prop: "invalid" } }`.

**G5 — Prop relevance rules (small, deferrable).** `invalidText` is meaningless without `invalid`; `counter` requires `maxLength`. A `relevantWhen?: { prop, equals }` field on `PropSchema` would let generators order Storybook controls and canvas property visibility (the design tool's conditional property visibility maps 1:1). Low cost, low urgency — G1 predicates already prevent wrong *rendering*.

## 2 · Inline notification / Alert / Banner

### 2a · Consolidated inventory

**Props:**

| Canonical | Carbon `InlineNotification` | Spectrum `InLineAlert` | Polaris `Banner` | Atlassian `SectionMessage` | Material `Alert` |
|---|---|---|---|---|---|
| `kind` | `kind: info \| success \| warning \| error` (+`info-square`, `warning-alt`) | `variant: neutral \| info \| positive \| notice \| negative` | `tone: info \| success \| warning \| critical` | `appearance: information \| success \| warning \| error \| discovery` | `severity: info \| success \| warning \| error` |
| `title` | `title` | `Heading` slot | `title` | `title` | `AlertTitle` |
| `subtitle`/body | `subtitle` | `Content` slot | children | children | children |
| `dismissible` | `hideCloseButton` (inverted) + `onClose` | — | `onDismiss` presence | — (compose) | `onClose` presence |
| `action` | `ActionableNotification` variant: `actionButtonLabel` | — | `action` + `secondaryAction` | `actions` (1–n links) | `action` slot |
| `lowContrast` | `lowContrast` | — | `hideIcon`/within-card variants | — | `variant: standard \| filled \| outlined` |
| `icon` | derived from `kind`; `statusIconDescription` | derived from `variant` | derived from `tone`, `icon` override, `hideIcon` | derived, `icon` override | derived from `severity`, `icon` override, `iconMapping` |
| a11y role | `role: status \| alert \| log` (prop!) | — | `role` derived from tone (critical → alert) | — | `role` (default `alert`) |

The consensus is total: **the status icon is derived from the kind enum** (with optional override), and **the ARIA live-region role is part of the component's public contract** — Carbon literally exposes `role` as a prop with `status`/`alert`/`log` values; ARIA APG: *"An alert is an element that displays a brief, important message in a way that attracts the user's attention without interrupting the user's task"* — `role="alert"` implies `aria-live="assertive"`, `role="status"` implies polite. WCAG 3.0 makes the announcement requirement explicit, listing *"Notifications, status or error messages appear"* under *"Meaningful changes in visual content are conveyed programmatically."* Two further standards constraints the contract should record: dismissal must return focus somewhere meaningful (WCAG 3.0: *"When removing interactive elements… actively place the focus back on the element that led to that element, the previous element within the focus order, or another meaningful location"*), and the component family split matters — the designsystems.surf survey shows "Alert banner" (inline, this contract) and "Snackbar" (transient toast) as **separate components** across the ~70 systems indexed; do not conflate them in one contract.

**Anatomy** (Carbon's names, all systems isomorphic):

```
notification
├─ icon            (fixed per kind — asset selected BY the enum value)
├─ textWrapper
│  ├─ title        (text ← title)
│  └─ subtitle     (text ← subtitle, optional)
├─ actionArea      (slot: accepts ds.button; optional)
└─ closeButton     (visible when dismissible; emits onDismiss)
```

**States:** none beyond hover/focus on the close button and action. The `kind` enum drives all styling — border/background/icon color per kind (Carbon low-contrast adds a second styling dimension). This is pure token-substitution territory the schema already handles.

### 2b · What the current schema covers

`kind` enum with `{kind}` token substitution; `title`/`subtitle` text props with `content` parts; `actionArea` as a constrained slot (`accepts: ["ds.button"]`, `optional`); nested anatomy; semantics.role. Nearly the whole component — which is what makes it the cheapest enterprise pathfinder.

### 2c · Specific gaps

**G6 — Icon/asset handling: instance selected by enum value.** The icon is not a slot (consumer-provided) and not a fixed component ref — it is a **ref whose target/variant is a function of an enum prop**. Parent-prop mapping (`props: { density: "{density}" }`) already maps a parent prop into a *child prop*; what's missing is mapping a parent prop to *which icon* renders.

> Proposed addition — extend `ComponentRefSchema`:
> ```ts
> // Option A (preferred): one ds.icon contract with a `name` enum; reuse existing machinery
> component: { id: "ds.icon", props: { name: "{kind}" } }   // works TODAY if ds.icon has name: enum
> // Option B: per-value ref switching for genuinely different components
> componentByValue?: { prop: string; refs: Record<string, ComponentRef> }
> ```
> - **Code:** Option A: `<Icon name={kind} />`; Option B: a switch on the prop.
> - **Canvas:** Option A: per-variant instance with `Name` variant set (the Table density machinery, verbatim). Option B: different instances per variant combo.
> - **Recommendation:** build `ds.icon` as an enum-prop contract (name axis) and ship Option A now; record Option B as a schema extension only if icon sets outgrow one component set. **Prerequisite:** an `assets` convention for the SVG bodies — a `ds.icon` contract whose `name` enum values map to SVG files (code) and to variants of an Icon component set (canvas). This is the one genuinely new *pipeline* piece (asset ingestion), though schema-wise it is just a contract.

**G7 — Live-region a11y.** Nothing in `a11y` or `semantics` can say "this is a polite/assertive live region," and Carbon shows the role must be *prop-controllable* in the general case.

> Proposed addition — `a11y.liveRegion`:
> ```ts
> a11y: {
>   liveRegion?: {
>     role: 'status' | 'alert' | 'log';
>     roleProp?: string;        // optional prop name that overrides the default role
>     atomic?: boolean;         // → aria-atomic
>   };
> }
> ```
> - **Code:** emits `role`/`aria-live`/`aria-atomic` on the root element; if `roleProp` is set, generates the enum prop pass-through.
> - **Canvas:** no-op; flows into the component description ("announces politely on appear").
> - **Differ:** asserts the role attribute in the rendered output (the `verify:package` harness already asserts roles).

**G8 — Dismissible → close button + event.** `closeButton` visibility is G1 (`visibleWhen: [{ prop: "dismissible", equals: true }]`). The *event* (`onDismiss`) is the first concrete instance of the docs/09 `behavior` field:

> Proposed addition — contract-level `events` (subset of the designed `behavior` block):
> ```ts
> events?: Array<{ name: string; description?: string; payloadType?: string }>
> // [{ name: "onDismiss" }]
> ```
> - **Code:** typed callback prop on the generated component; the generated close button calls it. No state machine needed — dismissal state lives with the consumer (all five systems agree: the notification does not hide itself).
> - **Canvas:** no-op (code-only surface).

## 3 · Data table, enterprise tier

### 3a · What Carbon and Polaris add beyond basic rows

Carbon `DataTable` (the maximal case) and Polaris `IndexTable`/`DataTable`, with Spectrum `TableView` and Atlassian `DynamicTable` corroborating:

| Feature | Carbon | Polaris | Structural or behavioral? |
|---|---|---|---|
| **Zebra striping** | `useZebraStyles` | `hasZebraStripingOnData` | **Structural** — boolean prop + `tokensWhen` on row part (nth-child token flip) |
| **Density/size** | `size: xs\|sm\|md\|lg\|xl` | `increasedTableDensity` | **Structural** — already shipped (`ds.table` density) |
| **Sticky header** | `stickyHeader` | `stickyHeader` | **Structural** prop (code: position:sticky — code-only surface, like :hover) |
| **Selection column** | `TableSelectAll` + `TableSelectRow` (checkbox col; radio option) | `selectable` + per-row checkbox, `selectedItemsCount`, `allResourcesSelected` | **Split**: the checkbox *column parts* are structural (header-cell checkbox part + row checkbox part, `visibleWhen selectable`); which rows are selected is **behavioral** (selection state machine, `indeterminate` on select-all) |
| **Sortable headers** | `isSortable`, per-header `isSortable`; header renders sort-direction icon | `sortable: boolean[]`, `sortDirection`, `defaultSortDirection`, `onSort` | **Split**: header-cell needs a `sortState: none\|ascending\|descending` enum prop + sort icon part (structural, pure TableRow-state pattern) + `aria-sort` attr (G2); the comparator/toggle cycle is **behavioral** (`onSort` event + hook) |
| **Toolbar / batch actions** | `TableToolbar`, `TableToolbarSearch`, `TableBatchActions` (slides in when selection > 0), `TableBatchAction` | Bulk actions: `promotedBulkActions`, `bulkActions` on IndexTable | **Split**: toolbar is a *slot* (`accepts: [ds.search, ds.button, ds.menu]`); batch-action bar is a *part* whose visibility depends on **runtime state, not a prop** → behavioral trigger, structural container. Contract models the bar + its slot; the show/hide belongs to the hook |
| **Pagination** | separate `Pagination` component composed under the table (`pageSizes`, `page`, `totalItems`, `onChange`) | `Pagination` (`hasNext`, `hasPrevious`, `onNext`, `onPrevious`); IndexTable `pagination` prop | **Split**: `ds.pagination` is its own contract (buttons, page-size select, range text — all structural); page state is behavioral. Table gets an optional `footer` slot accepting `ds.pagination` |
| **Expandable rows** | `TableExpandHeader`, `TableExpandRow`, `TableExpandedRow` | — (IndexTable rows can't expand; Polaris says use different pattern) | **Split**: expand-toggle cell part + `expanded: boolean` prop on row + expanded-content slot (structural); open/close state per row is behavioral |
| **Row states** | selected, expanded, hover | selected, subdued, hover | **Structural** — enum/boolean props (shipped pattern) |
| **Empty/loading states** | skeleton components | `emptyState` slot, `loading` | **Structural** — slots + boolean prop |
| **Column widths/alignment** | via header props | `columnContentTypes: text\|numeric` | **Structural** — per-column props (docs/09 known gap: per-column width/alignment) |

ARIA APG draws the same line at the semantics level: a **table** is "a static tabular structure … not an interactive widget," while a **grid** "enables users to navigate … using directional navigation keys" — i.e., the moment sorting/selection arrives, `aria-sort`, `aria-selected`, and (for full grids) roving tabindex enter the contract's a11y surface, while the key-handling itself is behavior.

### 3b · The structural/behavioral split, stated as a rule

**Everything that has a visual anatomy or a prop-addressable state is contract territory** (checkbox column, sort icons + `aria-sort`, batch-action bar container, expand chevron, expanded-content slot, pagination anatomy, zebra/sticky/density). **Everything that is a transition function is hook territory** (selection set + indeterminate derivation, sort cycling + comparator, batch-bar activation from selection count, expand toggling, page navigation). This is exactly the docs/09 date-picker pattern — the table is its second, larger instance, which is strong evidence the `behavior` field design generalizes.

### 3c · Specific gaps (beyond G1–G8, which the table also consumes)

**G9 — `behavior` block (formalizing docs/09).** The table needs named events *and* a named hook boundary:

> ```ts
> behavior?: {
>   hook?: { name: string; path: string };   // "useTableSelection", hand-written, imported by the shell
>   events?: Array<{ name: string; payloadType?: string }>;  // onSort, onSelect, onSelectAll, onExpand, onPageChange
> }
> ```
> - **Code:** generated shell imports the hook; events become typed callback props. Hook file is human-owned, never generated over.
> - **Canvas:** invisible by design. **Differ:** checks the events appear in the generated prop types; ignores hook internals.

**G10 — Selection/expansion column parts need `visibleWhen` on *component refs inside repeated children*.** `ds.table-row` gains a `selectable` context: the checkbox cell renders only when the *table* is selectable. Today parent→child mapping passes *values*; combined with G1 this works (`selectable` mapped down, checkbox cell `visibleWhen selectable`) — but note the docs/09 multi-level mapping gap: mapped props don't reach slot-provided rows. **The context-propagation design flagged in docs/09 becomes a prerequisite for enterprise table** (code: React context; canvas: per-variant nested overrides).

**G11 — Per-column configuration.** Already logged in docs/09 (column alignment/width). Minimal fix: `align`/`width` props on `ds.table-header-cell`/`ds.table-cell` with `tokensWhen`/substitution — no new schema field required, just contracts. The `columnContentTypes` idea (Polaris) stays out of the contract: it is instance data, not component API.

**A11y additions the table consumes from earlier gaps:** `aria-sort` via G2 `attrs` (`{ "aria-sort": { prop: "sortState" } }` on header cell), `aria-selected`/`aria-expanded` via G2 on row, select-all checkbox `aria-label` via G4.

## 4 · Consolidated schema additions (minimal set)

| # | Field | Where | Shape (abbreviated) | Code output | Canvas output |
|---|---|---|---|---|---|
| G1 | `visibleWhen` | `Part` | `[{ prop, equals }]` | conditional JSX | boolean prop → visibility binding; enum → per-variant visibility |
| G2 | `attrs` | `Part` | `Record<attr, { prop } \| { const }>` | JSX attributes (incl. `aria-*`) | code-only (placeholder via TEXT-bound ghost part) |
| G3 | part-level `states` + `tokensWhen` | `Part` | enum widened (`focus-within`, `readonly`); `[{ when, tokens }]` | nested selectors / data-attr rules | per-variant part styling |
| G4 | `relationships` | `a11y` | `[{ type, from, to, when? }]` | generated ids + `htmlFor`/`aria-describedby` | annotation only |
| G5 | `relevantWhen` | `Prop` | `{ prop, equals }` | Storybook control gating | design-tool conditional property visibility |
| G6 | icon-by-value | (none — convention) | `ds.icon` contract, `props: { name: "{kind}" }` | `<Icon name={kind}/>` | per-variant icon instance |
| G7 | `liveRegion` | `a11y` | `{ role, roleProp?, atomic? }` | `role`/`aria-live` on root | description text |
| G8/G9 | `behavior` | contract root | `{ hook?, events? }` | typed callbacks + hook import | invisible |

Ordering constraint: G1 and G3 are consumed by all three components; G2/G4 by TextField and Table; G6/G7/G8 by Notification; G9/G10 only by Table.

## 5 · Build order (prioritized)

**1. InlineNotification first.** Smallest gap set (G1 close-button visibility, G6 icon-by-value, G7 live region, G8 first event) and *zero* behavioral machinery — every gap it opens is a pure schema/generator addition, and three of them (G1, G6, the events shape) are prerequisites the other two components consume. It also forces the `ds.icon` asset pipeline early, which everything downstream (validation icons, sort chevrons, expand carets, pagination arrows) reuses. Ship it and the schema has conditional visibility, asset handling, and an a11y story — the three most-cited enterprise gaps — validated end-to-end on a component simple enough to review in one sitting.

**2. TextField second.** The benchmark. Consumes G1/G6 from round 1 and adds the two deep ones: G2 (attribute bindings — the first time the contract drives an inner element's HTML surface) and G3 (part-level interaction + data states — the docs/08 known gap, now unavoidable). Plus G4 relationships, which make the a11y block executable rather than declarative. After TextField, the schema can express essentially any *form* control (Select, Checkbox, TextArea are strict subsets of its gap profile).

**3. Enterprise DataTable third.** Deliberately last: it consumes everything above *plus* the two hard items — G9 `behavior` (the headless-hook boundary, first real state machines: selection, sort) and G10 context propagation (a known v3 gap). Doing it after TextField means every structural piece (checkbox cell, sort-icon header, batch bar, pagination contract) is assembled from already-proven fields, and the round can focus on the one genuinely novel boundary: contract-governed shell + human-owned state machine, parity-checked on the API surface only.

**Explicitly deferred:** G5 (prop relevance — nice-to-have), Option B componentByValue (until icon sets outgrow one component set), full grid keyboard-navigation semantics (APG grid pattern — belongs to the hook, revisit when `behavior` exists).
