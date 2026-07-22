---
title: "Thesis, success criteria, and the North Star"
doc_id: 02-thesis-and-north-star
audience: "Another AI platform with ZERO prior knowledge of this project"
status: authoritative
last_updated: 2026-07-21
reading_order: 2
prerequisites: [00-readme, 01-concept]
related: [03-determinism, 04-users-and-journeys, 11-roadmap]
---

# What we are proving, and where this is going

## The thesis (what the PoC exists to prove)

> A machine-readable contract can be the deterministic bridge between Figma and
> code, generating **and verifying** both surfaces, so that the burden of keeping
> design and development in sync is carried by the contract — not by people, and
> not by AI.

Proving it means demonstrating, with executable checks, that:

1. **contract → code** is deterministic and faithful (React/HTML).
2. **contract → canvas** is deterministic and faithful (a Figma component set).
3. **canvas → contract** recovers the contract (design→code direction).
4. **code → contract** recovers the contract (code→design direction).
5. The loop **closes**: a component can go all the way around and come back
   consistent.
6. All of the above run as **pure functions** — byte-reproducible, no AI in the
   conversion (this is the point; see `03-determinism.md`).

## Success criteria (how we know it's proven)

- Every claim is backed by an **executable check** (an eval, a gate, a live
  render), never by assertion.
- The full round-trip runs headlessly and is **byte-identical across two runs**
  (the determinism proof; gate `deterministic-roundtrip`).
- Real components **build on a real Figma canvas** from their contracts, via the
  plugin, with no AI (live-validated 2026-07-21 for Avatar, Button, Badge, Card).
- Advanced composition (a component composed of other components + a repeated
  collection) round-trips in both directions (gated headless; live rendering of
  the composite is the current frontier — see `08`).

## The North Star (where this ultimately goes)

The end state the project aims at:

- **The sync burden is non-existent.** A designer on a code-led team opens a
  Figma plugin and her library is current, styled, complete — because CI wrote
  contracts from code. An engineer on a design-led team runs one CLI command and
  gets React + a Storybook story — because a contract was extracted from Figma.
  Neither leaves their tool. Neither does the sync by hand. No AI decides
  anything in between.
- **An official, open spec for components.** The contract format is intended to
  become a shared, open specification that a whole ecosystem (and Figma itself)
  could adopt internally — a common language for "what a component *is*,"
  independent of any one design system or renderer.
- **100% open source, community-supported, never monetized.** This is a
  deliberate, stated constraint on the project, not a business plan. The value is
  the spec and the deterministic tooling being freely available.

## Non-goals (explicitly out of scope)

- **AI-generated designs or code as the conversion.** Using an AI to "draw" the
  Figma component or "write" the React from a screenshot is the *opposite* of
  this project. AI-native design tools already exist; the gap this fills is
  *determinism*.
- **A closed/monetized product.** See above.
- **Pixel-perfect replication of one specific design system as the deliverable.**
  Individual design systems (Polaris, a Meta library, the repo's own tokens) are
  used as *test subjects/exhibits*, not as the product. The product is the
  contract + the deterministic pipeline.

## The two exhibits (test subjects, not the product)

- **The repo's own design system** — 51 component contracts, tokens (DTCG), the
  primary corpus the gates run against.
- **An advanced composite** (`ds.composite-modal`) — the depth-build stress test:
  a multi-root Modal whose body composes a Card instance and a repeated Badge
  collection. It is where advanced composition is proven (headless) and where the
  current live-rendering failures live (see `08`).

Continue to `03-determinism.md` — the principle everything else serves.
