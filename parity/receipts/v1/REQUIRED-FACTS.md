# REQUIRED FACTS PER ARCHETYPE — the measured red scan, and the burn-down queue

Recorded 2026-08-25 on a clean tree by `npm run required-facts:check -- --write`.
The machine half is `parity/receipts/v1/required-facts-baseline.json`; the
referee is `packages/core/src/required-facts.ts`; the gate is
`npm run required-facts:check` (fast lane, with a falsification self-test).

**The rule this round implements** (owner, 2026-08-24): it must be impossible
to mint a set that is missing a load-bearing fact — the tool refuses and names
what is missing. An ugly mint is worse than an honest refusal.

**Posture today: WARN.** `figma bundle` and both `generate` shells NAME every
missing required fact and carry on; `figma bundle --strict` (or
`DS_REQUIRED_FACTS=refuse`) refuses instead and writes nothing, and a bundle
built that way carries `"requiredFacts": "refuse"` so the plugin refuses the
same paste. The default flips to refuse when the queue below is empty enough
that flipping it blocks nobody — the ordering is deliberate: the wave is
visible one full cycle before anything blocks, and the committed baseline makes
regression impossible in the meantime (a NEW red fails CI today).

## 1. The scan — every committed contract in every corpus library

172 contracts across 10 libraries: `contracts/*.contract.json` plus
`examples/<lib>/contracts/*.contract.json`. Wider than the canvas census (which
drops a contract with no committed Figma script) on purpose — a contract that
cannot be minted today can be minted tomorrow, and a fact it lacks is a defect
either way.

| library | red / total | missing facts | archetype declared | unmapped (enforces nothing) |
|---|---|---|---|---|
| first-party | 8 / 56 | 14 | 31 | 25 |
| altitude | 0 / 8 | 0 | 4 | 4 |
| antd | 1 / 12 | 1 | 12 | 0 |
| astryx | 2 / 13 | 3 | 12 | 1 |
| carbon | 1 / 10 | 2 | 10 | 0 |
| fluent | 1 / 11 | 1 | 11 | 0 |
| mui | 6 / 31 | 7 | 28 | 3 |
| polaris | 0 / 12 | 0 | 10 | 2 |
| shadcn | 1 / 11 | 1 | 11 | 0 |
| tailwind | 0 / 8 | 0 | 5 | 3 |
| **total** | **20 / 172** | **29** | **134** | **38** |

Two libraries are clean on every archetype they carry: **altitude (0/8)** and
**tailwind (0/8)**. **polaris (0/12)** joined them in this round — its avatar
was red until the referee learned that the CSS-module shorthand `background` is
a fill; a predicate that reds a contract for its spelling is a defect in the
referee, not in the contract.

## 2. Per archetype

| archetype | red / graded |
|---|---|
| accordion | 0 / 3 |
| avatar | 0 / 8 |
| badge / tag / chip | 1 / 14 |
| banner / alert / toast | 0 / 11 |
| breadcrumb | 0 / 3 |
| button | 1 / 14 |
| card | 3 / 7 |
| checkbox / radio | 4 / 11 |
| input / field | 2 / 11 |
| menu / dropdown | 2 / 3 |
| modal / dialog | 2 / 4 |
| nav (top / side) | 0 / 3 |
| pagination | 0 / 2 |
| progress / spinner | 1 / 10 |
| select / combobox | 1 / 4 |
| slider | 0 / 3 |
| table / data-grid | 4 / 5 |
| tabs | 1 / 6 |
| toggle / switch | 0 / 8 |
| tooltip / popover | 0 / 4 |
| unmapped *(no archetype declared and the name-map does not reach the name — nothing is enforced and the tool warns "declare archetype")* | 0 / 38 |

## 3. Per missing fact — the queue, heaviest first

| missing fact | contracts |
|---|---|
| `table/row-rule` | 4 |
| `table/column-stack` | 3 |
| `card/interior-stack` | 3 |
| `input/box-grammar` | 2 |
| `input/padding-inline` | 2 |
| `table/cell-padding` | 2 |
| `menu/column-stack` | 2 |
| `checkbox/base-border-or-fill` | 2 |
| `progress/geometry` | 1 |
| `tabs/active-indicator` | 1 |
| `select/chevron` | 1 |
| `badge/padding` | 1 |
| `checkbox/glyph` | 1 |
| `menu/surface` | 1 |
| `button/row-layout` | 1 |
| `button/surface-ink` | 1 |
| `dialog/panel-stack` | 1 |
| `dialog/padding` | 1 |
| `checkbox/label-gap` | 1 |

Every class the owner rejected by eye reproduces here as a named absence:
`card/interior-stack` ×3 (astryx, fluent, mui — the card that mints as a pill),
`dialog/panel-stack` (fluent — the dialog that mints as ONE ROW),
`checkbox/glyph` (astryx — "checked" as a filled rectangle),
`menu/column-stack` ×2 (astryx, mui).

## 4. The 20 reds, with the cause of each

### Closed by the census/stack-to-main merge (22 -> 20)

Two rows this receipt pinned as red are FIXED on the merged tree. The gate
found them itself (`FIXED — the baseline pins X but the contract now carries
it`); the baseline was re-recorded with `--write` only after each fix was read
back out of the contract by hand.

- **astryx/astryx.checkbox-input** — was *(ii) extraction loss*: "Phase-A code
  extraction landed only the resting `control` span … the check mark was never
  extracted." The merged contract is the FLOOR-PROMOTED one (v0.1.0 -> v0.3.0,
  computed-enriched from the headless capture rather than the Phase-A code
  read), and it carries `part-0/part-0-0/checkbox/icon/icon-sm` and
  `icon-md`, both with a real `icon`. The glyph exists.
- **fluent/fluent.card** — was *(ii) lowering gap*: "root layout is
  {display:\"flex\"} with no direction, and NO fluent contract in the library
  carries a `direction` key at all." The merged contract's root layout is
  `{display: "flex", direction: "column"}`. The column is declared.

`fluent/fluent.dialog` below still cites fluent.card's lowering gap as "the
same" — that citation is now historical: the gap is closed for Card and the
Dialog's own row is still open on its own evidence (no captured display or
direction on dialogsurface/dialogbody).


Category codes: **(i)** the fact does not exist in the source component — a
re-capture will not help, it needs a ledgered substitute or the contract is a
fragment by design; **(ii)** the fact exists in the source and the capture or
lowering did not carry it — a re-capture or a lowering fix lands it; **(iii)**
the contract is a child/fragment and the fact lives in a named sibling — closes
when the referee follows `slot.accepts` / `component` refs; **(iv)** the
predicate is arguably wrong for this component, and the row is left red
deliberately with the argument written down.

**first-party/ds.field** — *input / field* — missing `input/box-grammar`, `input/padding-inline`  
(iii) fragment — ds.field is the label+description wrapper; its `control` part is an open slot, and the box grammar and inline padding live in the slotted control (ds.text-field carries border-color and padding-inline). Closes when the referee follows slot.accepts.

**first-party/ds.spinner** — *progress / spinner* — missing `progress/geometry`  
(ii) capture/authoring loss — the only child `arc` is icon.asset "spinner" with no `size`, and no part carries width/height; the contract's own description already flags that the size scale needs per-variant icon sizing.

**first-party/ds.tab-list** — *tabs* — missing `tabs/active-indicator`  
(iii) fragment — `props: []` and `states: []`; the selected axis lives on the child ds.tab (state enum + per-part states), reachable only through slot defaultContent.

**first-party/ds.table-cell** — *table / data-grid* — missing `table/column-stack`, `table/row-rule`  
(iii) fragment — a cell is a leaf row with padding/type/min-width and no border channel at all; the column stack and the rules belong to ds.table.

**first-party/ds.table-header-cell** — *table / data-grid* — missing `table/column-stack`, `table/row-rule`  
(iii) fragment — same shape as ds.table-cell: a row with padding/type/font-weight and zero border channels; the stack and rules live in ds.table.

**first-party/ds.table-row** — *table / data-grid* — missing `table/cell-padding`, `table/column-stack`, `table/row-rule`  
(iii) fragment — root is a row styled only by background-color {color.table.row.{state}}; cell padding sits in its slotted ds.table-cell children and nothing draws a top/bottom rule (the striping is a fill, not a rule).

**first-party/ds.table** — *table / data-grid* — missing `table/cell-padding`, `table/row-rule`  
(iii) composed — root IS a column, but the padding lives in the `component`-referenced ds.table-header-cell / ds.table-cell and the referee does not traverse component refs; rows are separated by fills rather than rules.

**first-party/ds.typeahead-item** — *select / combobox* — missing `select/chevron`  
(i) absent by design — this is the listbox option row (role="option"), not a combobox trigger; its iconSlot is an open slot with no `accepts`, and the trigger contract that would carry a chevron does not exist yet.

**antd/antd.badge** — *badge / tag / chip* — missing `badge/padding`  
(ii) capture loss — no part carries any padding channel; the badge-count/badge-dot sups are sized by height + min-width + radius, while sibling antd contracts from the same capture DO carry padding-left.

**astryx/astryx.card** — *card* — missing `card/interior-stack`  
(i) absent in the source — the anatomy is a single root div with display:block and NO parts; Astryx Card is one padded surface whose header/body/footer are consumer children. THE PILL: this is the reject that started the round.

**astryx/astryx.dropdown-menu-item** — *menu / dropdown* — missing `menu/column-stack`, `menu/surface`  
(iii) fragment — its own description calls it "the repeated item of astryx.dropdown-menu", and that sibling's `menu` part carries direction:column and background-color {color-background-surface}.

**carbon/carbon.iconbutton** — *button* — missing `button/row-layout`, `button/surface-ink`  
(ii) capture loss — the anatomy is rooted at the Tooltip WRAPPER (declared display:block, position:relative); the flex row and the background/border ink sit two levels down on `btn`, and both facts are root-scoped. Re-root the capture at `btn`.

**fluent/fluent.dialog** — *modal / dialog* — missing `dialog/panel-stack`  
(ii) same lowering gap as fluent.card — dialogsurface/dialogbody carry row-gap/column-gap (Griffel's grid) but no captured display or direction, so no part declares the column. THE ONE-ROW DIALOG.

**mui/mui.card** — *card* — missing `card/interior-stack`  
(i) absent in the source — the anatomy is the Paper root (display:block) plus one materialized `label` text child; MUI Card owns no interior regions, its stacked content is consumer-supplied.

**mui/mui.checkbox** — *checkbox / radio* — missing `checkbox/base-border-or-fill`  
(iv) arguable predicate, left red deliberately — root carries radii + width/height only, because MUI draws the resting square as the SVG path inside `icon-unchecked`. If that asset is not carried the control IS invisible at rest, so the red is the honest reading until the SVG-asset door is proven for this part.

**mui/mui.drawer** — *modal / dialog* — missing `dialog/padding`  
(i) absent in the source — no part carries padding; MUI's drawer paper (direction column, background + shadow) is deliberately unpadded and the interior padding belongs to the consumer's children.

**mui/mui.input-adornment** — *input / field* — missing `input/box-grammar`, `input/padding-inline`  
(iii) fragment — a piece of mui.text-field, whose outlinedinput-notchedoutline carries border-top-color and inputbase-adornedend the padding-left; the adornment itself is bare.

**mui/mui.menu** — *menu / dropdown* — missing `menu/column-stack`  
(ii) lowering gap — the `list-padding` <ul> stacks by BLOCK FLOW (display:block captured as a channel, `layout` empty). CSS stacks it; the canvas defaults a layout-less frame to HORIZONTAL auto-layout, so it mints as a row. Exactly the silent composition this gate exists for.

**mui/mui.radio** — *checkbox / radio* — missing `checkbox/base-border-or-fill`  
(iv) arguable predicate, left red deliberately — same as mui.checkbox: radii + w/h only, the ring is the SVG circle in `icon`/`icon-2`, and MUI sets no border or background on the control itself.

**shadcn/shadcn.checkbox** — *checkbox / radio* — missing `checkbox/label-gap`  
(i) absent in the source — the contract is Radix Checkbox.Root + Indicator only (root + part-0); the component has no label part, so there is no control/label gap to carry.

## 5. What closes the queue, in the order that pays

1. **The composed-contract door (7 rows, category iii).** `ds.field`,
   `ds.tab-list`, `ds.table` + its three fragments, `astryx.dropdown-menu-item`,
   `mui.input-adornment` are all one defect in the REFEREE, not seven defects in
   the contracts: a fact carried by a slotted child or a `component` ref should
   satisfy its host, and a fragment graded on its own should not be asked for
   its parent's facts at all. One change, seven rows.
2. **Two lowering gaps (4 rows, category ii).** Fluent's Griffel lowering emits
   no `direction` ANYWHERE in the library (zero occurrences across 11
   contracts) — that one fix closes `fluent.card` and `fluent.dialog`. MUI's
   block-flow `<ul>` (`mui.menu`) is the same shape: CSS stacks it, the canvas
   defaults a layout-less frame to HORIZONTAL, and it mints as a row.
   `carbon.iconbutton` is a re-root: the capture starts at the Tooltip wrapper
   instead of the button.
3. **Three capture losses (3 rows, category ii).** `antd.badge` padding,
   `astryx.checkbox-input`'s checked glyph, `ds.spinner`'s icon size.
4. **Six ledgered substitutes (category i).** astryx/mui/shadcn's cards,
   drawer and checkbox genuinely do not carry the fact; each needs a named
   substitute (a default interior stack, a default panel padding) recorded as a
   decision rather than invented silently.
5. **Two arguments to settle (category iv).** `mui.checkbox` / `mui.radio` draw
   their resting ring as an SVG path inside an icon part. If the SVG-asset door
   is proven to carry that ring onto the canvas, `checkbox/base-border-or-fill`
   should accept it; until then the red is the honest reading.

## 6. What is NOT in this round, and why

**The GLOBAL `type-scale/rem-base` fact was designed, written, wired — and
removed.** The design's premise was that polaris's rem primitives
(`/p/font-size-350 = 0.875rem`) mint as the Figma number `0.875`, a broken type
scale nothing names. Measuring the instrument instead of re-reading the report:
`px()` (packages/core/src/tokens.ts) converts rem/em at the CSS root ratio and
carries a dated live-canvas receipt for exactly this defect ("2026-07-22,
Astryx genesis"); `pxOrNull()` types every non-dimension token as a Figma STRING
so it keeps its unit; and `compileLineHeight()` turns a value it cannot spell
into a NAMED channel miss. The first cut of the fact refused **ten astryx and
polaris contracts whose rem type scale mints correctly today.** A gate that
reds a right answer is worse than no gate, so it was deleted rather than
weakened, and the measurement is recorded in the module so the next reader does
not re-derive it from the same stale premise.

**Three other predicate defects were found the same way and fixed**, which is
why this scan reads 22 where the design's draft read 25: `background`
(shorthand) is a fill — polaris's avatar was red for its spelling;
`button/padding-inline` now accepts a fixed W×H root, because an icon button is
sized by its box and demanding padding of `ds.icon-button` reds a contract that
is right; and `accordion/divider` accepts a full box border, because
`ds.accordion-item` draws one and it separates stacked items just as well as a
row rule does.

**The fact table is TypeScript, not the design's `archetype-required-facts.json`.**
The design put the table in `@ds-contracts/schema` beside `contract.schema.json`
as data. It ships instead as a typed `const` in
`packages/core/src/required-facts.ts`, beside the checker that reads it: the
checker lives in `@ds-contracts/core` (which is browser-importable and imports
no `node:*`), so a JSON file there would need import-attribute machinery or a
second generated copy, and a second copy is a thing that drifts. A `const` IS
data — and this one is type-checked against the archetype enum, so a row that
names an archetype the schema does not have fails `tsc` rather than failing
silently at read time.

**38 contracts enforce nothing** — no `archetype` declared and the name-map does
not reach their name (`ds.blockquote`, `ds.chat-message`, `ds.kbd`, …). They
warn "declare archetype" and are graded against nothing. That is the design:
a wrong archetype would demand facts the component does not owe, or mint one
that lies, so the tool never guesses.

