---
title: "ds-contracts-poc — AI Handoff Package"
doc_id: 00-readme
audience: "Another AI platform with ZERO prior knowledge of this project"
status: authoritative
last_updated: 2026-07-21
reading_order: 0
prerequisites: []
related: [01-concept, 02-thesis-and-north-star, 03-determinism]
---

# ds-contracts-poc — read me first

You are being handed a proof-of-concept called **ds-contracts-poc** (repo:
`github.com/southleft/ds-contracts-poc`, PUBLIC, MIT). This directory is a
complete, self-contained briefing. Read it in order. Assume the reader (you)
knows nothing about the project.

## The one sentence

> A machine-readable component **contract** is the single source of truth between
> a Figma canvas and code, and a **deterministic** pipeline generates and verifies
> both surfaces from it — so design and code stay in lockstep with **no AI in the
> conversion**.

## The rule that governs everything (read `03-determinism.md`)

The conversion (`contract → canvas`, `canvas → contract`, `contract → code`) is a
**pure, byte-reproducible function**. AI may *author contracts* or *build the
tooling*, but AI is **NEVER** part of the conversion. If you find yourself
proposing that an AI agent "render" or "interpret" a design, you have
misunderstood the project — stop and re-read `03-determinism.md`.

## 60-second orientation

- **Problem:** design systems drift — the Figma library and the coded components
  fall out of sync, and keeping them aligned is manual, endless, and error-prone.
- **Idea:** put a *contract* (JSON, schema-validated) between them. Generate code
  from it. Generate the Figma component set from it. Extract a contract back from
  either side. The contract carries the sync; humans don't.
- **Two users, two directions** (see `04-users-and-journeys.md`):
  - *Designer on a code-led team:* code is truth → CI writes contracts → a Figma
    plugin builds/updates her library. She never opens a terminal.
  - *Engineer on a design-led team:* Figma is truth → a contract is extracted →
    the CLI generates React + a story into his repo. He never opens Figma.
- **Status in one line:** the deterministic pipeline is proven and gated at
  **146/146** headless checks; individual components are **live-validated on a
  real Figma canvas**; the one advanced exhibit (a composite Modal) has known,
  documented rendering failures. See `07` and `08`.

## Reading order

| # | File | What it gives you |
|---|------|-------------------|
| 00 | `00-README.md` | This orientation |
| 01 | `01-concept.md` | The core idea and the problem it solves |
| 02 | `02-thesis-and-north-star.md` | What we're proving; the ultimate goal; non-goals |
| 03 | `03-determinism.md` | The non-negotiable "no AI in the conversion" principle |
| 04 | `04-users-and-journeys.md` | The two personas and the two end-to-end journeys |
| 05 | `05-architecture.md` | How it's built: schema, tokens, emitters, engine, plugin, CLI |
| 06 | `06-tooling.md` | Concrete tools + commands for each hop |
| 07 | `07-status-what-works.md` | Proven / gated / live-validated capabilities |
| 08 | `08-status-what-doesnt-work.md` | Honest failures, the frontier, blind spots |
| 09 | `09-testing-and-gates.md` | The 146-check suite; how to verify from a clean clone |
| 10 | `10-history.md` | How we got here; the pivots; receipts culture |
| 11 | `11-roadmap.md` | What's left, prioritized |
| 12 | `12-reference.md` | Glossary, file map, command cheat-sheet |

## Culture you must inherit (this matters)

**Defect-first, receipts-only.** Never claim something works without an
executable check. Green gates are *not* "it works" — they are "these specific
checks pass." State failures plainly and first. When the real Figma API caught a
bug that 146 headless checks missed (see `10-history.md`), that was treated as a
*win*, not an embarrassment. Adopt this. Do not smooth over what is broken.

## Provenance of this package

Written 2026-07-21 by the AI that did the work, grounded in the live codebase
(schema, emitters, engine, CLI, plugin, eval suite all verified before writing).
Where a claim is "proven headless" vs "validated live on canvas" vs "not yet
proven," the distinction is stated explicitly. Trust the distinctions.
