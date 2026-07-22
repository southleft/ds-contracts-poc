---
title: "Status — what works (proven / gated / live-validated)"
doc_id: 07-status-what-works
audience: "Another AI platform with ZERO prior knowledge of this project"
status: authoritative
last_updated: 2026-07-21
reading_order: 7
prerequisites: [03-determinism, 05-architecture]
related: [08-status-what-doesnt-work, 09-testing-and-gates]
---

# What works

Read this together with `08-status-what-doesnt-work.md`. Green gates are **not**
"it works" — they are "these checks pass." Each item below states its evidence
level: **[gated headless]** (an eval/gate proves it in Node against the mock),
**[live]** (validated on a real Figma canvas), **[CLI]** (a command proves it).

## The suite

- **146/146 evals pass** (`npm run eval`). Claim families (indicative counts by
  `claim:` occurrence): `C1-determinism`, `C2-refusal`, `C3-detection` (the
  largest), `C4-convergence`, `C5-extraction` (the largest), `C6-theming`,
  `C7-cli`, `C8-journey`. See `09-testing-and-gates.md` for the breakdown.
- Standing gates: `golden-generated-output` (byte hash of `src/` + `figma-sync/`,
  265 files), the 1,618-set census, `plugin-engine-bundle`, both `tsc`
  (root + `tsconfig.build.json`), `core:browser-check`, `emitters:check`,
  site build byte-reproducible.

## Determinism (the core claim)

- **The full round-trip is a pure function, byte-reproducible.** [gated headless]
  Gate `deterministic-roundtrip`: `contract → canvas` run twice → **byte-identical
  node trees**; `canvas → contract` recovers the anatomy; `contract → code`
  emits. No AI in the conversion.

## contract → code

- **React / HTML / inline-React** emit deterministically from contracts, byte-
  guarded by golden. [gated headless]
- **51 repo contracts** all emit; the differ detects code-ahead/behind/mismatch,
  figma-ahead/behind, token drift. [gated headless] (the `C3-detection` family)
- **Refusals are named**: invalid contracts, unknown token refs, circular deps,
  unknown component refs, enum/default violations — all refuse *by name*.
  [gated headless] (`C2-refusal`)

## contract → canvas

- **The plugin engine builds correct anatomy from a pasted contract.**
  [gated headless] (`plugin-engine-check` / `composite-plugin-path`): the exact
  bundle the plugin loads (`window.DSC`) parses a contract, plans tokens-first +
  dependency-ordered, executes in the mock, and builds the correct node tree.
- **LIVE, on a real Figma canvas (2026-07-21):** pasting a contract into the
  plugin's Generate tab built these components correctly, deterministically, from
  contracts, with no AI: **[live]**
  - **Avatar** — circular avatars (radius from `radius.pill`, correct).
  - **Button** — the **full 24-variant set** (Variant × Size × State), correct
    colors, `loadingSpinner` + `label` per variant.
  - **Badge** — 5 pill variants (Info/Success/Warning/Danger/Error).
  - **Card** — avatar + title header, real body/footer **Slots**.
  These are genuine passes and are the strongest evidence the core PoC is real.

## canvas → contract (design → code capture)

- **Dump + propose recovers a contract** from a drawn set, including advanced
  composition (multi-root, composed instance, repeated collection).
  [gated headless] (`composite-reverse-journey`).
- The recovered contract uses a single `root` wrapper convention (COMPONENT-as-
  root) vs the top-level multi-root author form — same structure, no info lost.
- The 1,618-set census proposes every set with zero skips (after sanitize).
  [gated headless]

## code → contract (design-led capture)

- `extract:code` / `roundtrip:code` recover contracts from TSX/CEM with zero
  round-trip mismatch on the tested components. [CLI]

## Advanced composition (the depth build)

- A **multi-root** component (`{dialog, backdrop}` with no wrapping root) emits on
  all four surfaces and its built canvas anatomy lines up with the contract
  **part-for-part**. [gated headless] (`depth-composite-child-collection`)
- **Both journey directions** for advanced composition are gated headless
  (code→design and design→code). This required generalizing the emitters/validator
  to consume multi-root anatomy — with single-root output byte-identical.
  Notably it needed **zero new emitter code** for the composition itself; the
  `component` + `repeat` channels were already latent in the multi-root work.

## Packaging / distribution

- `@ds-contracts/cli` and `@ds-contracts/schema` are published and stranger-
  verified. The web-components emitter is built (not published). The plugin
  builds to a drift-guarded zip with a clean-install + publishing guide.

## The honest headline

**The deterministic pipeline is real and proven; individual components build
correctly on a live canvas from contracts with no AI.** That is the core thesis,
demonstrated. Now read `08` for exactly where it still fails.
