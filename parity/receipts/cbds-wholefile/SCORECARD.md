# CBDS whole-file Path A — 2026-08-19

File: [CBDS UI Kit Demo](https://www.figma.com/design/WofZT8xaxXuc2Q6Je9S4XE/CBDS-UI-Kit-Demo) (`WofZT8xaxXuc2Q6Je9S4XE`).
Linked node: [Card-Image](https://www.figma.com/design/WofZT8xaxXuc2Q6Je9S4XE/CBDS-UI-Kit-Demo?node-id=419-763) (`419:763`).
Transport: committed plugin dump → `proposeBatchFromDump` (`reviewable-inversion`, `mintUnbound`) → `generateCss` / `generateTsx`.
This is an inversion of a hand-built kit. It is **not** a first look — the gauntlet already replayed this dump.

## Verdict

| | n |
|---|---|
| Dump | `extract/figma/fixtures/cbds-plugin-all-sets.v16.dump.json` (v1.6, 2026-07-13) |
| Captured variables | 126 |
| Dump entries (all) | 1618 |
| COMPONENT_SETs inverted | **76** |
| Plain COMPONENTs counted, not inverted | 1542 |
| Proposed | **76** |
| Schema-valid | **76** |
| Generated React + CSS | **76** |
| Propose threw | 0 |

Gauntlet census (`extract/figma/gauntlet/CENSUS.md`) is **76/76** COMPONENT_SETs / 1618 dump entries — including underscore-prefixed private sets (`_Tab-item`, `_Avatar Indicator`, …). An earlier Path A runner treated `_…` keys as dump metadata and under-counted 61. This run matches the gauntlet population, then asks the Eventz question: dump tokens + stubs only, then `generateTsx`. Refusal-free ≠ pixel-right.



## Generate refusals

String-boolean composition is climbed (propose + emit coerce). Remaining refusals, if any, are a different class.

## Card-Image (linked)

Dump: `Card-Image` `419:763`, **12** variants.
Live REST: `Card-Image` (COMPONENT_SET) still has **12** COMPONENT children.
Path A status: **generated React + CSS**. Notes: 138 (DEFAULTED, NOTE, INCONSISTENT-BINDING, MINTED, STUB).

Card-Image is the slot/swap fixture class already pinned at `extract/figma/gauntlet/fixtures/pattern-slot-placeholder-card-image.dump.json`. INSTANCE_SWAP preferredValues remain a dump v1 limit.

## Named omissions

- **Plain COMPONENTs** — 1542 icon-class singles counted, not inverted. Same named omission as Eventz.
- **Repo contracts** — not injected. This is inversion of the dump, not receive-into-this-repo. The gauntlet is the repo-composition receipt.
- **Adopt-in-place** — this run does not stamp the hand-built sets as contract-backed.
- **Geometry / font walls** — not opened.

## Sets

| set | node | variants | notes | status | note classes |
|---|---|---:|---:|---|---|
| _Avatar Indicator | 284:179 | 15 | 18 | generated | DEFAULTED, NOTE, MINTED |
| _Breadcrumb item | 497:1126 | 16 | 66 | generated | DEFAULTED, NOTE, INCONSISTENT-BINDING, REFUSED |
| _Button single-card | 392:2089 | 6 | 17 | generated | DEFAULTED, NOTE, MINTED |
| _Controls | 218:791 | 2 | 27 | generated | DEFAULTED, STUB, NOTE, MINTED |
| _Country code | 233:47968 | 4 | 50 | generated | DEFAULTED, NOTE, INCONSISTENT-BINDING, STUB |
| _Nav-item-base-close | 689:5961 | 3 | 23 | generated | DEFAULTED, NOTE, INCONSISTENT-BINDING, MINTED |
| _Nav-item-base-open | 687:635 | 3 | 37 | generated | DEFAULTED, NOTE, INCONSISTENT-BINDING, MINTED |
| _Nav-item-menu | 687:954 | 2 | 15 | generated | DEFAULTED, NOTE, MINTED |
| _pagination-number | 1956:5650 | 8 | 24 | generated | DEFAULTED, NOTE, INCONSISTENT-BINDING, MINTED |
| _Panel-Accordion | 359:8368 | 2 | 50 | generated | DEFAULTED, NOTE, MINTED |
| _Tab-item | 509:1747 | 18 | 36 | generated | NOTE, INCONSISTENT-BINDING, MINTED |
| _Tab-item-pill | 544:1296 | 18 | 46 | generated | NOTE, INCONSISTENT-BINDING, MINTED, REFUSED |
| _Tab-item-vertical-left | 550:1779 | 18 | 38 | generated | NOTE, INCONSISTENT-BINDING, MINTED |
| _Tab-item-vertical-right | 539:1921 | 18 | 38 | generated | NOTE, INCONSISTENT-BINDING, MINTED |
| _Text-block-Panel | 359:7745 | 2 | 37 | generated | DEFAULTED, NOTE, MINTED |
| Accordion | 359:1013 | 21 | 89 | generated | NOTE, INCONSISTENT-BINDING, MINTED, STUB |
| Alert | 438:1401 | 30 | 55 | generated | DEFAULTED, NOTE, MINTED, STUB |
| Avatar | 284:11 | 36 | 43 | generated | DEFAULTED, NOTE, INCONSISTENT-BINDING, STUB |
| Avatar group | 1530:20247 | 6 | 53 | generated | DEFAULTED, NOTE, MINTED |
| Badge | 277:822 | 72 | 73 | generated | DEFAULTED, NOTE, INCONSISTENT-BINDING, MINTED |
| Badge (ds.badge) — resolved values (stub) | 6463:11 | 4 | 24 | generated | DEFAULTED, STUB, MINTED, NOTE |
| Badge (ds.badge) — token-bound | 6465:10 | 5 | 9 | generated | DEFAULTED, NOTE, MINTED |
| Badge Notification | 316:2163 | 60 | 39 | generated | DEFAULTED, INCONSISTENT-BINDING, MINTED, NOTE |
| Breadcrumb | 497:1419 | 2 | 14 | generated | DEFAULTED, NOTE, STUB, MINTED |
| Button-Brand Primary | 258:1838 | 15 | 36 | generated | NOTE, MINTED |
| Button-Brand Secondary | 262:648 | 15 | 37 | generated | NOTE, MINTED |
| Button-Brand Tertiary | 265:1561 | 15 | 36 | generated | NOTE, MINTED |
| Button-Danger Primary | 268:8146 | 15 | 34 | generated | NOTE, MINTED |
| Button-Danger Secondary | 268:8281 | 15 | 37 | generated | NOTE, MINTED |
| Button-Danger Tertiary | 269:776 | 15 | 36 | generated | NOTE, MINTED |
| Button-Neutral Primary | 265:1696 | 15 | 34 | generated | NOTE, MINTED |
| Button-Neutral Secondary | 265:1839 | 15 | 37 | generated | NOTE, MINTED |
| Button-Neutral Tertiary | 265:1973 | 15 | 36 | generated | NOTE, MINTED |
| Card-Basic | 392:2158 | 2 | 53 | generated | DEFAULTED, NOTE, MINTED |
| Card-Image **← linked** | 419:763 | 12 | 138 | generated | DEFAULTED, NOTE, INCONSISTENT-BINDING, MINTED |
| Checkbox | 272:96 | 12 | 50 | generated | NOTE, STUB, MINTED, INCONSISTENT-BINDING |
| Checkbox-icon | 271:2241 | 42 | 41 | generated | NOTE, STUB, MINTED, REFUSED |
| Chip | 279:2861 | 64 | 59 | generated | DEFAULTED, NOTE, INCONSISTENT-BINDING, MINTED |
| Dialog | 599:1333 | 4 | 86 | generated | DEFAULTED, NOTE, MINTED, STUB |
| Dropdown | 214:274 | 14 | 77 | generated | NOTE, STUB, MINTED |
| Dropdown-MutliSelect | 347:3452 | 16 | 77 | generated | NOTE, INCONSISTENT-BINDING, MINTED |
| Icon | 188:894 | 6 | 11 | generated | DEFAULTED, NOTE, STUB, MINTED |
| Icon Button Brand-Primary | 480:4822 | 20 | 17 | generated | NOTE, MINTED |
| Icon Button-Brand Secondary | 480:4999 | 20 | 18 | generated | NOTE, MINTED |
| Icon Button-Brand Tertiary | 480:5063 | 20 | 17 | generated | NOTE, MINTED, REFUSED |
| Icon Button-Danger Primary | 480:5836 | 20 | 17 | generated | NOTE, MINTED |
| Icon Button-Danger Secondary | 480:5900 | 20 | 18 | generated | NOTE, MINTED |
| Icon Button-Danger Tertiary | 480:5990 | 20 | 17 | generated | NOTE, MINTED, REFUSED |
| Icon Button-Neutral Primary | 480:5345 | 20 | 17 | generated | NOTE, MINTED |
| Icon Button-Neutral Secondary | 480:5443 | 20 | 18 | generated | NOTE, MINTED |
| Icon Button-Neutral Tertiary | 480:5507 | 20 | 18 | generated | NOTE, MINTED, REFUSED |
| Input Date | 233:48737 | 14 | 62 | generated | NOTE, MINTED |
| Input Number | 216:187 | 28 | 133 | generated | NOTE, INCONSISTENT-BINDING, MINTED, STUB |
| Input Text | 195:916 | 14 | 69 | generated | NOTE, MINTED |
| Link-Blue | 392:802 | 24 | 36 | generated | NOTE, MINTED |
| Link-Danger | 392:1104 | 24 | 34 | generated | NOTE, MINTED |
| Link-Neutral | 392:953 | 24 | 36 | generated | NOTE, MINTED |
| List item | 303:3743 | 23 | 105 | generated | DEFAULTED, NOTE, INCONSISTENT-BINDING, MINTED |
| Menu | 303:7130 | 3 | 15 | generated | DEFAULTED, NOTE, MINTED |
| Navigation-Header | 681:1689 | 3 | 51 | generated | DEFAULTED, NOTE, MINTED |
| Navigation-Side | 689:5101 | 2 | 155 | generated | DEFAULTED, NOTE, STUB, INCONSISTENT-BINDING |
| Pagination-2 | 1958:174 | 3 | 59 | generated | DEFAULTED, NOTE, STUB, MINTED |
| Pagination-3 | 1958:178 | 3 | 52 | generated | DEFAULTED, NOTE, MINTED |
| Progress bar | 697:322 | 18 | 36 | generated | DEFAULTED, NOTE, MINTED |
| Radio button | 272:346 | 12 | 52 | generated | NOTE, STUB, MINTED, INCONSISTENT-BINDING |
| Radio button-icon | 272:164 | 28 | 37 | generated | NOTE, STUB, MINTED, REFUSED |
| Search | 287:1236 | 12 | 71 | generated | DEFAULTED, NOTE, MINTED |
| Search-MultiSelect | 348:9616 | 14 | 86 | generated | DEFAULTED, NOTE, INCONSISTENT-BINDING, MINTED |
| Tab-Line | 544:1811 | 6 | 131 | generated | DEFAULTED, NOTE, MINTED |
| Tab-Pill | 550:1081 | 4 | 52 | generated | DEFAULTED, NOTE, MINTED |
| Table-Data cell | 1932:5 | 15 | 118 | generated | DEFAULTED, NOTE, INCONSISTENT-BINDING, MINTED |
| Text Area | 199:1428 | 14 | 72 | generated | NOTE, INCONSISTENT-BINDING, MINTED, STUB |
| Title card | 194:935 | 3 | 50 | generated | DEFAULTED, NOTE, INCONSISTENT-BINDING, MINTED |
| Toggle | 272:730 | 8 | 28 | generated | NOTE, STUB, MINTED |
| Toggle-icon | 272:567 | 16 | 34 | generated | NOTE, STUB, MINTED, REFUSED |
| Tooltip | 695:313 | 9 | 18 | generated | NOTE, MINTED |

## Generate refusals

_Every proposed COMPONENT_SET generated._
