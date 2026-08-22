# Figma Design System whole-file Path A — 2026-08-19

File: [Figma Design System](https://www.figma.com/design/aekVseUceg35tVn62knRrj/Figma-Design-System) (`aekVseUceg35tVn62knRrj`).
Transport: Figma REST → dump → `proposeFromDump` two-pass (`reviewable-inversion`, `mintUnbound`) → `generateCss` / `generateTsx`.
This is an inversion of a hand-built kit, not a round trip of sets this tool drew.

## Verdict

| | n |
|---|---|
| Library pages fetched | 17 (0 failed) |
| COMPONENT_SETs on those pages (icons excluded) | **14** |
| Icon glyphs counted, not inverted | 57 standalone + 0 sets |
| Proposed | **16** |
| Schema-valid | **16** |
| Generated React + CSS | **16** |
| Propose threw | 0 |

## By tier

| tier | proposed | schema-ok | generated |
|---|---:|---:|---:|
| atom | 8 | 8 | 8 |
| molecule | 4 | 4 | 4 |
| layout | 2 | 2 | 2 |
| organism | 2 | 2 | 2 |
| template | 0 | 0 | 0 |

## Named omissions

- **Icons page** — counted, not inverted.
- **Cover / Documentation / Token System / Studio / Deliverables / Branding / harness** — out of scope.
- **Adopt-in-place** — this run does not stamp the hand-built sets as contract-backed.
- **Geometry / font walls** — not opened.



## Hills climbed on this run

- **grid-hug-flex-axis** — Section Header / Footer hug + `{fr}` no longer aborts the whole set. Hug is dropped with a named note; the fraction stands.
- **string-boolean-coercion** — leftover `"true"`/`"false"` spellings coerce at propose and at emit.

## REST degradations

0 named mapping notes (see `out/degradations.json`). First fetch of this file named **1300** `variable-unresolved` notes (PAT cannot read `/variables/local`). Cached re-runs do not re-count them. First 12:

- none

## Sets

| set | tier | notes | status | note classes |
|---|---|---:|---|---|
| Badge | atom | 39 | generated | DEFAULTED, NOTE, MINTED, UNBOUND |
| Button | atom | 46 | generated | NOTE, MINTED, REFUSED, UNBOUND |
| Button (Icon) | atom | 20 | generated | NOTE, MINTED, REFUSED |
| Chip | atom | 35 | generated | NOTE, MINTED, REFUSED |
| Dek | atom | 12 | generated | DEFAULTED, MINTED, NOTE |
| Heading | atom | 20 | generated | DEFAULTED, MINTED |
| Image | atom | 11 | generated | DEFAULTED, NOTE, MINTED |
| Kicker | atom | 12 | generated | DEFAULTED, MINTED, NOTE |
| Button Group | molecule | 10 | generated | DEFAULTED, NOTE, MINTED |
| Section Footer | molecule | 17 | generated | DEFAULTED, MINTED, NOTE |
| Section Header | molecule | 23 | generated | DEFAULTED, REFUSED, NOTE, MINTED |
| Toast | molecule | 48 | generated | DEFAULTED, NOTE, MINTED |
| Card | layout | 30 | generated | DEFAULTED, MINTED, NOTE, UNBOUND |
| Section | layout | 22 | generated | DEFAULTED, NOTE, MINTED |
| Card Grid | organism | 11 | generated | DEFAULTED, NOTE, MINTED |
| Toast Group | organism | 28 | generated | DEFAULTED, NOTE, MINTED |

## Generate refusals

_Every proposed set generated._
