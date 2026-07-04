# 9 · Advanced Components — the DataTable Round

Round 5 (July 3, 2026) pushed composition to compound, data-shaped components — the class that includes data tables and date pickers — and packaged the system as a real npm library. Eight components now generate from contracts to both surfaces; 24/24 evals pass.

## The table family

Four contracts compose three levels deep, exercising every v3 capability:

```
ds.table            Density=Comfortable|Compact
 ├─ header          (fixed refs) 3 × ds.table-header-cell, density MAPPED from the Table's prop
 └─ body            (multi-child slot) accepts ds.table-row, defaultContent = 3 sample rows
     └─ ds.table-row   State=Default|Selected
         └─ cells      (multi-child slot) accepts ds.table-cell, defaultContent = 3 sample cells
```

**What each new capability does across the surfaces:**

| Capability | Contract | Code | Canvas |
|---|---|---|---|
| **Parent→child prop mapping** | `props: { "density": "{density}" }` on a component ref | `<TableHeaderCell density={density}>` | resolved **per variant**: the Comfortable table variant contains `Density=Comfortable` header instances, the Compact variant `Density=Compact` |
| **Ref text override** | `"text": "Name"` on a component ref | JSX children | TEXT property override on the instance |
| **Slot defaultContent** (Curtis's fifth slot property) | 3 sample rows/cells, middle row `state: selected` | recursive story samples — Table stories render `<TableRow><TableCell>…` three levels deep | real instances rendered inside the slot |
| **Data states** | plain enum props (`state: default\|selected`) | class + token (`--color-table-row-selected`) | variant axis — no new machinery needed |

## The round's structural finding: multi-child slots hit the instance-swap ceiling

Predicted in docs/08, now confirmed empirically: **a slot that holds multiple children cannot be expressed as an instance-swap property** (a swap holds exactly one instance). The pipeline handles it honestly:

- A slot whose `defaultContent` has **one** item (or none) → an instance-swap property (+ preferred values from `accepts`), as before.
- **More than one** item → the content renders directly as instances, and **no property is created**. TableRow exposes only `State`; Table exposes only `Density`. The differ knows the rule: for multi-child slots it expects *no* property and instead verifies the content components appear as nested instances (eval-covered).

This is the real-world table experience on a canvas without native slot support (fixed sample rows, structure edited by drilling in), and it is **the strongest concrete argument for migrating to the design tool's native slot property type**, which supports multiple children, min/max-children settings, and a hard only-preferred-values restriction — a one-to-one target for this schema's `accepts`/`acceptsMode`/`min`/`max` fields.

## The npm package: contract → product environment

The repo now builds as a consumable library (`npm run build:lib`):

- `dist/index.js` — 4.5 kB ESM, React externalized, every generated component exported
- `dist/styles.css` — 11 kB: all token custom properties (`:root` + `[data-theme="dark"]`) plus every component's CSS Module output
- `dist/index.d.ts` — full types, contract descriptions carried into JSDoc
- `package.json` `exports` map + `peerDependencies` on React

`npm run verify:package` is the product-environment smoke test: it imports **dist** (exactly what a consumer installs) and server-renders a composed screen — Card, a compact Table with selected row, a loading danger Button — asserting roles, content, data attributes, and CSS Module classes. The chain the PoC set out to prove is now end-to-end: **contract → generated component → packaged library → rendered product UI**, with the same contract simultaneously governing the canvas library.

```tsx
// what a product team writes
import { Table, TableRow, TableCell } from 'ds-contracts-poc';
import 'ds-contracts-poc/styles.css';

<Table density="compact">
  <TableRow state="selected">
    <TableCell>Ada Lovelace</TableCell>
    …
```

## Behavior-heavy components (date pickers): the designed answer

A DateRangePicker's *anatomy* (field, popover, weekday header, day grid) and *API* (`value`, `onChange`, `min`/`max`) are contract territory. Its *date math* is not — and generating fake logic would break "generated files are never edited." The designed pattern (not yet built):

1. **The contract governs the parity surface**: props/events, anatomy, tokens, a11y. A `ds.calendar-day` contract with `state: default|selected|in-range|today|disabled` is just enum props — the machinery already exists (TableRow's `state` proves it).
2. **Behavior lives in a hand-written headless hook** (`useDateRange.ts`) beside the generated shell — listed in the contract (a future `behavior` field naming the hook and the events it services), imported by the generated component, unit-tested like any logic module, and *invisible to the design surface* by design.
3. **Parity is unaffected**: the differ checks API/anatomy/tokens; the hook is code-only surface, exactly like `:hover` is CSS-only surface.

This is the headless-UI industry pattern (Radix/React-Aria) expressed in contract terms: the contract generates the styled shell; humans own the state machine.

## Remaining gaps after this round

- `behavior`/events field and the headless-hook convention — designed above, not in the schema yet.
- Column alignment/width per column (table cells share one fixed width token).
- `acceptsMode: 'restrict'` and `min`/`max` enforcement (waits on SLOT migration).
- Migration to the design tool's native slot property itself — the single highest-value next step for composition fidelity.
- Multi-level parent→child mapping (Table density does not reach slot-provided rows/cells — in code the consumer passes it; a context-based propagation pattern is the candidate design).
