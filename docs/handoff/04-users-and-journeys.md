---
title: "Users and the two journeys"
doc_id: 04-users-and-journeys
audience: "Another AI platform with ZERO prior knowledge of this project"
status: authoritative
last_updated: 2026-07-21
reading_order: 4
prerequisites: [00-readme, 01-concept]
related: [05-architecture, 06-tooling, 07-status-what-works]
---

# Who the users are, and the two journeys

The whole product is two mirror-image journeys. Each serves a person who lives in
*one* tool and should never be forced into the other.

## Persona A — the designer on a **code-led** team

Her team's source of truth is code. She works in Figma. Today she manually mirrors
code changes into the Figma library and constantly falls behind.

**Her journey (code → design):**

```
engineer commits code
      │  (CI, deterministic, no AI)
      ▼
ds-contracts extract  ──▶  contracts/*.contract.json   (committed, reviewable)
      │
      ▼
she opens the Figma plugin (DS Contracts Sync Runner)
      │  paste the contract / receive a bundle → "Generate in this file"
      ▼
her Figma library updates in place — styled, token-bound, variants complete
      │
      └──▶ if she edits on the canvas, the plugin's Propose tab dumps the set,
           diffs it against the contract in plain words, and exports a proposed
           contract change (or opens a PR). Her edit becomes a reviewable diff.
```

She never opens a terminal. The plugin does the deterministic build locally.

## Persona B — the engineer on a **design-led** team

His team's source of truth is Figma. He works in code. Today he re-implements
Figma components by hand and re-checks them against the design constantly.

**His journey (design → code):**

```
designer changes the Figma file
      │
      ▼
a contract is extracted from the Figma component (dump → propose)
      │  (deterministic; the proposal is a reviewable artifact, not final code)
      ▼
he runs the CLI:  ds-contracts generate <contract> --out src/... [--stories]
      │  (deterministic, no AI)
      ▼
React + CSS + a Storybook story land in his repo
      │
      └──▶ he reviews the story beside the Figma frame. Design updates arrive as
           contract diffs that regenerate code as reviewable PRs.
```

He never opens Figma. The CLI does the deterministic generation.

## The tool at each hop (this is the concrete map)

| Hop | Direction | Deterministic tool | Notes |
|-----|-----------|--------------------|-------|
| code → contract | design-led capture | `ds-contracts extract` (CLI) | reads TSX/CEM; recovers a contract |
| contract → code | design-led output | `ds-contracts generate` (CLI) | React/HTML/inline + optional Storybook story |
| contract → canvas | code-led output | **the plugin** (paste → Generate) | engine baked in; emits + builds locally |
| canvas → contract | code-led capture | the plugin (Propose) / `ds-contracts extract --figma` | dump → propose a contract |
| contract diff → PR | either | `ds-contracts propose-pr` / plugin Propose | BYO fine-grained token, session-only |
| CI automation | either | GitHub Action recipes (`examples/ci/`) | on release → extract; on merge → generate |

**Every tool in that table is deterministic. None involves AI in the conversion.**

## Output framework is orthogonal to the component

For the design→code direction, the default output is **React**; **web
components** are a planned second emitter (chosen for the first non-React target).
The choice of framework is independent of the component's difficulty tier (see
`docs/DIFFICULTY-TIERS.md`: T0 primitive / T1 composite / T2 advanced / T3
dynamic). A contract can be emitted to any registered emitter.

## The "reviewable diff" idea is central

In both directions, a change on one surface does not silently overwrite the
other. It becomes a **proposed change to the contract** — a diff a human reviews
and merges. The contract-in-git is canon; CI is the enforcement point; authority
is the layer that can mechanically refuse. This is what keeps a two-way sync from
becoming a two-way overwrite war.

Continue to `05-architecture.md` for how these tools are actually built.
