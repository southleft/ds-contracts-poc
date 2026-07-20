# Astryx extraction census — before → after the Phase-A adapter fixes

**Status: PROPOSALS ONLY. Nothing here is promoted or adopted** — the
`static-contracts/` are the pipeline's mechanical proposals, committed as
evidence; `proposals.md` is the full run report with every inference receipt
and every named skip. Promotion is a later, human-owned step (the Polaris
`PROMOTION.md` discipline).

Subject: `@astryxdesign/core@0.1.6` (PINNED — see `../PROVENANCE.md`),
extracted from the npm-shipped TSX source. Same 25-category census and the
same facts-carried construction as the enterprise gauntlet
(`extract/pilots/ENTERPRISE-GAUNTLET.md` §1): **facts-carried = (contract
props + events) / (extracted props minus platform props)**, platform-prop
exclusion applied uniformly. Judgment calls kept identical to the assessment
for comparability: menu→`MoreMenu`, select→`Typeahead`, tag→`Token`,
accordion→`CollapsibleGroup`; stepper does not ship.

Reproduce: `npm run extract:code -- examples/astryx/extract.config.json`,
then `npx tsx examples/astryx/scripts/census.ts examples/astryx/out`. The
BEFORE column is the same command at the stage-1 commit (pre-fix adapter);
it reproduces the second-system assessment's measured numbers exactly
(23/24 @ 57% median, Slider named-skip).

## Headline

| | BEFORE (stage-1 adapter) | AFTER (keyof + union fixes) |
|---|---|---|
| Whole library: extracted → proposed | 216 → 216 (all schema-valid) | **222 → 222** (all schema-valid) |
| Whole library: named skips | 21 | **15** (every one receipted by name) |
| Census attempted | 24 | 24 |
| Census proposed | 23 (Slider named-skip) | **24/24** |
| Census hollow (0 facts, receipted) | 2 (Badge 0/3, Table 0/0) | **1** (Table 0/0, receipted) |
| **Median facts-carried (census)** | **57%** | **65%** |
| Enum props, library-wide | 88 | **117** (+29; 25 `keyof` resolutions receipted, 0 keyof refusals — every `keyof` in the corpus resolved) |
| Union-of-refs merges, library-wide | 0 | 6 (each carrying the merge receipt) |

## Per-component (census set)

| category | component | BEFORE | AFTER |
|---|---|---|---|
| button | Button | 12/20 (60%) | **14/20 (70%)** |
| checkbox | CheckboxInput | 13/19 (68%) | **14/19 (74%)** |
| switch | Switch | 16/20 (80%) | 16/20 (80%) |
| badge | Badge | 0/3 (0%, hollow) | **1/3 (33%)** |
| tooltip | Tooltip | 6/12 (50%) | 6/12 (50%) |
| dialog | Dialog | 4/9 (44%) | **5/9 (56%)** |
| menu | MoreMenu | 4/8 (50%) | 4/8 (50%) |
| tabs | TabList | 4/6 (67%) | 4/6 (67%) |
| accordion | CollapsibleGroup | 3/6 (50%) | 3/6 (50%) |
| table | Table | 0/0 (hollow, receipted) | 0/0 (hollow, receipted) |
| text-field | TextInput | 18/23 (78%) | **19/23 (83%)** |
| select/combobox | Typeahead | 19/25 (76%) | 19/25 (76%) |
| toast | Toast | 4/7 (57%) | 4/7 (57%) |
| pagination | Pagination | 11/14 (79%) | **12/14 (86%)** |
| breadcrumb | Breadcrumbs | 1/3 (33%) | **2/3 (67%)** |
| avatar | Avatar | 4/6 (67%) | 4/6 (67%) |
| card | Card | 1/6 (17%) | 1/6 (17%) |
| popover | Popover | 9/14 (64%) | 9/14 (64%) |
| progress | ProgressBar | 7/9 (78%) | **8/9 (89%)** |
| slider | Slider | **named-skip** | **18/22 (82%)** |
| tag/chip | Token | 9/11 (82%) | 9/11 (82%) |
| banner | Banner | 3/9 (33%) | **5/9 (56%)** |
| skeleton | Skeleton | 1/4 (25%) | **2/4 (50%)** |
| stepper | — | absent | absent |
| link | Link | 11/20 (55%) | 11/20 (55%) |

Note on Card/Badge: their `variant` axes were the `keyof` class (Card lands
a 13-value enum, Badge a 14-value enum — both recovered); their remaining
losses are `node` props (slot candidates, receipted) and platform-adjacent
`other` props, see residual classes below.

## Union-of-refs recoveries (6 of the 21 named skips)

`Calendar`, `ContextMenu`, `DropdownMenu`, `NumberInput`, `Slider`,
`ToggleButtonGroup` — all previously skipped as unions of named refs, now
merged across readable branches with the union receipt and branch-specific
members forced optional. The assessment estimated 7 including `Selector`;
**`Selector` correctly stays a named skip**: its branches are GENERIC
(`SelectorPropsNonClearable<T>`), and generic references transform their
target's members — expanding them would claim more than the type says.

## Remaining named skips (15, whole library — every one receipted)

| component | class |
|---|---|
| `Selector` | union of GENERIC refs (`<T>`) — correctly refused |
| `LazyXDSTooltip` (×3: Heading, Text, Timestamp) | cross-file props type |
| `EditorOverride`, `PowerSearchFilterEditor`, `PowerSearchToken` | PowerSearch internals, cross-file props types |
| `RowComponent`, `CellComponent`, `HeaderCellComponent`, `SelectAllCheckbox` | BaseTable row/cell renderers, cross-file props types |
| `ImagePlaceholder` (Thumbnail) | cross-file props type |
| `FallbackCapture` (useToast) | cross-file props type |
| `DrawerMegaMenu` (TopNav) | `Pick<…>` generic transform |
| `ALL_SYNTAX_KEYS` (theme/syntax) | not a component (SCREAMING_CASE const caught by PascalCase discovery) — false positive, skipped, named |

## Residual facts-carried losses, diagnosed (the Phase A-2 / later menu)

1. **`on*` props typed via NAMED handler types** — `onClick?:
   React.MouseEventHandler<T>` is a type reference, not a function type
   node, so it classifies `other` and never becomes a contract event
   (Button, Tooltip, Link all lose one+ here). Bounded rule: `on[A-Z]` +
   a `*Handler`/`*EventHandler` reference → event. NOT built this round.
2. **`node` props** (icon, label, content, endContent) — slot candidates,
   receipted by propose; they resolve in the anatomy step (the computed
   floor), not in static extraction.
3. **Imported positioning/responsive types** (`Placement`, `Alignment`,
   responsive width/height unions) — outside module scope, correctly
   refused; cross-file resolution is a named non-goal of the single-file
   adapter.
4. `Table` stays legitimately hollow: `TableProps<T>` composes generic
   references; the contract carries the receipt naming them.

## What's in this directory

- `proposals.md` — the full run report (222 proposals, every receipt, all 15 named skips)
- `static-contracts/` — the 24 census proposals + the 5 non-census union recoveries (29 files), copied verbatim from the run output. **Proposals, not adopted contracts.**
