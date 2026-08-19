# Eventz whole-file Path A — 2026-08-19

File: [DEMO Eventz Design System](https://www.figma.com/design/E7oXr98i91HYQGZxA2USOQ/DEMO-Eventz-Design-System) (`E7oXr98i91HYQGZxA2USOQ`).
Transport: Figma REST → dump → `proposeFromDump` (`reviewable-inversion`, `mintUnbound`) → `generateCss` / `generateTsx`.
This is an inversion of a hand-built kit, not a round trip of sets this tool drew.

## Verdict

| | n |
|---|---|
| Library + section pages fetched | 50 (0 failed) |
| COMPONENT_SETs on those pages (icons excluded) | **64** |
| Icon glyphs counted, not inverted | 1 standalone + 56 sets |
| Proposed | **75** |
| Schema-valid | **75** |
| Generated React + CSS | **71** |
| Propose threw | 0 |

Prior receipts on this same file: Eventz pilot dumped **68** library components (API only, icons/templates omitted); `examples/eventz-vars` inverted **7** sets. This run is the file-scale Path A test.

## By tier

| tier | proposed | schema-ok | generated |
|---|---:|---:|---:|
| atom | 12 | 12 | 11 |
| molecule | 22 | 22 | 20 |
| organism | 33 | 33 | 32 |
| section | 8 | 8 | 8 |

## Named omissions

- **Icons page** — counted, not inverted. Same decision as the 2026 Eventz pilot.
- **Cover / foundations / templates / eval / shader / motion pages** — out of scope. They are documentation and test debris, not the library.
- **Adopt-in-place** — this run does not stamp the hand-built sets as contract-backed. Generated React is a starting point.
- **Geometry / font walls** — not opened. REST already degrades variable names when the token lacks `file_variables:read`.

## REST degradations

**19,518** named mapping notes on the live fetch (2026-08-19). Nearly all are `variable-unresolved`: this PAT cannot read `/variables/local`, so every bound Eventz variable arrives as a resolved hex/px and mints as `imported.*`. That is not a kit defect. The 7-set `examples/eventz-vars` run used a plugin dump and recovered real names. First 12 from the fetch:

- [variable-unresolved] Atoms/Badge itemSpacing / padding / radius — variable id unresolvable; resolved value used
- [variable-unresolved] Atoms/Badge Label fill — same class, kit-wide

- none

## Sets

| set | tier | notes | status | note classes |
|---|---|---:|---|---|
| .Calendar | atom | 71 | schema-ok, generate refused | DEFAULTED, NOTE, STUB, MINTED |
| .Day | atom | 55 | generated | NOTE, MINTED |
| Atoms/Badge | atom | 38 | generated | DEFAULTED, MINTED, NOTE, STUB |
| Atoms/Button | atom | 65 | generated | NOTE, STUB, MINTED |
| Atoms/Checkbox | atom | 38 | generated | NOTE, STUB, MINTED, REFUSED |
| Atoms/Controls | atom | 36 | generated | NOTE, MINTED, REFUSED |
| Atoms/Icon Button | atom | 52 | generated | NOTE, MINTED, UNBOUND |
| Atoms/Input | atom | 65 | generated | NOTE, STUB, MINTED, REFUSED |
| Atoms/Radio Button | atom | 33 | generated | NOTE, STUB, MINTED, REFUSED |
| Atoms/Tag | atom | 53 | generated | NOTE, MINTED, REFUSED, UNBOUND |
| Atoms/Text Link | atom | 46 | generated | NOTE, MINTED, REFUSED |
| Atoms/Textarea | atom | 57 | generated | NOTE, MINTED, UNBOUND |
| .avatar | molecule | 26 | generated | NOTE, MINTED, REFUSED |
| .comboboxDropdown | molecule | 20 | schema-ok, generate refused | DEFAULTED, STUB, NOTE, MINTED |
| .comboChip | molecule | 28 | generated | NOTE, MINTED, STUB |
| .Dropdown-insert | molecule | 86 | schema-ok, generate refused | NOTE, STUB, MINTED, UNBOUND |
| .fileThumbnail | molecule | 13 | generated | DEFAULTED, MINTED, NOTE |
| .Menu item | molecule | 47 | generated | NOTE, MINTED, REFUSED, UNBOUND |
| .Search terms | molecule | 48 | generated | NOTE, MINTED, STUB |
| .tabTrigger | molecule | 62 | generated | NOTE, MINTED, REFUSED, UNBOUND |
| .toggleGroupItem | molecule | 17 | generated | NOTE, MINTED, REFUSED |
| Molecules/Accordion | molecule | 71 | generated | DEFAULTED, NOTE, MINTED, STUB |
| Molecules/Alert | molecule | 41 | generated | DEFAULTED, REFUSED, NOTE, STUB |
| Molecules/Avatar Group | molecule | 48 | generated | DEFAULTED, NOTE, MINTED, REFUSED |
| Molecules/Breadcrumbs | molecule | 47 | generated | DEFAULTED, NOTE, STUB, MINTED |
| Molecules/Combobox | molecule | 66 | generated | DEFAULTED, NOTE, MINTED |
| Molecules/Dialog | molecule | 30 | generated | DEFAULTED, NOTE, MINTED |
| Molecules/Dropdown | molecule | 48 | generated | NOTE, MINTED, STUB, UNBOUND |
| Molecules/Expandable Content | molecule | 18 | generated | DEFAULTED, NOTE, MINTED |
| Molecules/File Upload | molecule | 70 | generated | NOTE, MINTED, REFUSED, UNBOUND |
| Molecules/Interactive List Item | molecule | 52 | generated | NOTE, MINTED, REFUSED |
| Molecules/Search | molecule | 53 | generated | DEFAULTED, NOTE, STUB, MINTED |
| Molecules/Select | molecule | 62 | generated | NOTE, MINTED, STUB, UNBOUND |
| Molecules/Tabs | molecule | 19 | generated | DEFAULTED, NOTE, MINTED |
| .carousel-rail | organism | 60 | schema-ok, generate refused | DEFAULTED, NOTE, STUB, MINTED |
| .dotIndicator | organism | 21 | generated | NOTE, MINTED, UNBOUND |
| .Field label | organism | 22 | generated | DEFAULTED, MINTED, NOTE, STUB |
| .hero-carousel | organism | 69 | generated | DEFAULTED, NOTE, MINTED |
| .Inline danger | organism | 20 | generated | DEFAULTED, STUB, NOTE, MINTED |
| .Inline hint | organism | 14 | generated | DEFAULTED, MINTED, NOTE |
| .Map controls | organism | 44 | generated | NOTE, STUB, MINTED, REFUSED |
| .Map marker | organism | 49 | generated | DEFAULTED, NOTE, STUB, MINTED |
| .Month | organism | 217 | generated | DEFAULTED, NOTE, MINTED |
| .Popover | organism | 14 | generated | DEFAULTED, NOTE, MINTED |
| .Progress bar | organism | 14 | generated | DEFAULTED, NOTE, MINTED |
| .scrollableControls | organism | 21 | generated | DEFAULTED, MINTED, STUB, NOTE |
| .Search dropdown | organism | 35 | generated | NOTE, MINTED |
| .Segmented map controls | organism | 28 | generated | NOTE, STUB, MINTED |
| .Stepper number item | organism | 49 | generated | DEFAULTED, NOTE, STUB, MINTED |
| .Stepper number rail | organism | 17 | generated | DEFAULTED, NOTE, MINTED |
| .Stepper text item | organism | 43 | generated | NOTE, MINTED |
| Atoms/Checkbox Group | organism | 23 | generated | DEFAULTED, NOTE, MINTED |
| Atoms/Radio Group | organism | 23 | generated | DEFAULTED, NOTE, MINTED |
| Molecules/Toggle Group | organism | 31 | generated | DEFAULTED, NOTE, MINTED |
| Organisms/Ad | organism | 180 | generated | DEFAULTED, NOTE, MINTED, REFUSED |
| Organisms/Card | organism | 239 | generated | NOTE, MINTED, UNBOUND |
| Organisms/Carousel | organism | 171 | generated | DEFAULTED, NOTE, STUB, MINTED |
| Organisms/Countdown | organism | 17 | generated | DEFAULTED, MINTED, NOTE |
| Organisms/Footer | organism | 200 | generated | DEFAULTED, NOTE, REFUSED, MINTED |
| Organisms/Map | organism | 40 | generated | DEFAULTED, NOTE, MINTED |
| Organisms/Media Player | organism | 68 | generated | DEFAULTED, NOTE, MINTED, UNBOUND |
| Organisms/Navigation | organism | 72 | generated | DEFAULTED, NOTE, MINTED, UNBOUND |
| Organisms/Selection Card | organism | 35 | generated | NOTE, MINTED, REFUSED, UNBOUND |
| Organisms/Stepper | organism | 43 | generated | DEFAULTED, NOTE, MINTED |
| Organisms/Sticky Nav | organism | 53 | generated | DEFAULTED, NOTE, MINTED, UNBOUND |
| Organisms/Subscription Card | organism | 53 | generated | DEFAULTED, NOTE, MINTED, UNBOUND |
| Sections/Section Title | organism | 22 | generated | DEFAULTED, NOTE, MINTED |
| Sections/Event Hero | section | 71 | generated | DEFAULTED, NOTE, STUB, MINTED |
| Sections/Hero Image | section | 71 | generated | DEFAULTED, NOTE, MINTED |
| Sections/Icon List | section | 104 | generated | DEFAULTED, NOTE, MINTED |
| Sections/Listing | section | 18 | generated | DEFAULTED, NOTE, MINTED |
| Sections/Location | section | 23 | generated | DEFAULTED, NOTE, STUB, MINTED |
| Sections/Marquee | section | 30 | generated | DEFAULTED, NOTE, MINTED, UNBOUND |
| Sections/Page Filter | section | 102 | generated | DEFAULTED, NOTE, MINTED, UNBOUND |
| Sections/Section Icon List | section | 13 | generated | DEFAULTED, NOTE, MINTED |

## Generate refusals

### .Calendar

- ds.atoms-button: applied value "false" for prop "isDisabled" is a string but the dependency types it boolean — coerce at composition ('False' → false), never pass the spelling through

### .comboboxDropdown

- ds.menu-item: applied value "false" for prop "isSelected" is a string but the dependency types it boolean — coerce at composition ('False' → false), never pass the spelling through

### .Dropdown-insert

- ds.molecules-search: applied value "true" for prop "isFilled" is a string but the dependency types it boolean — coerce at composition ('False' → false), never pass the spelling through

### .carousel-rail

- ds.dot-indicator: applied value "false" for prop "active" is a string but the dependency types it boolean — coerce at composition ('False' → false), never pass the spelling through
