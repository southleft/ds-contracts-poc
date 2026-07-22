---
title: "Roadmap — what's left, prioritized"
doc_id: 11-roadmap
audience: "Another AI platform with ZERO prior knowledge of this project"
status: living
last_updated: 2026-07-21
reading_order: 11
prerequisites: [07-status-what-works, 08-status-what-doesnt-work]
related: [03-determinism, 09-testing-and-gates]
---

# Roadmap

Ordered by impact toward the North Star (`02`). Every item preserves determinism
(`03`) — none introduces AI into the conversion.

> **2026-07-21 (later the same day): P0 sub-tasks 1–3 are DONE headlessly and
> gated** (see `08#1` for root causes and fixes; the proven fix→mock→gate
> pattern was followed for each). P0.5 landed for the two named blind spots
> (auto-layout sizing, instance-property reflection). **The remaining P0 step
> is the owner's live re-validation run** — paste
> `examples/depth-composite/composite-modal.contract.json` into the plugin's
> Generate tab on a fresh file and confirm the modal renders (480px dialog,
> scrim behind, "Shipping"/"Gift wrap"/"Priority" badges, Cancel/Save
> buttons with a gap).

## P0 — Fix the composite Modal live rendering (the frontier)

The advanced composite is the flagship stress test and it fails live (`08#1`).
Three sub-tasks, in order:

1. **Multi-root dialog sizing.** The dialog collapses to ~3px. Fix the multi-root
   auto-layout sizing in `core/emit-figma-script.ts` so the dialog establishes a
   real width. *Add a headless check* — e.g. assert the built dialog width is
   non-trivial in the mock (extend the mock to track auto-layout sizing enough to
   catch collapse).
2. **COMPONENT_SET instance text binding.** Repeated Badge instances show the
   default "Badge" not the item text, though the emitted `depProps` are correct.
   The Card (single COMPONENT) worked; the Badge (COMPONENT_SET) didn't — the
   set-instance Label wiring diverges. **Requires a live read** of a tag
   instance's `componentProperties` (Desktop Bridge open in the target file) to
   pin the exact break, then fix the emitter's set text-property wiring, then add
   a mock check that reflects component-property text on instances so it's caught
   headlessly.
3. **Footer button styling + spacing.** Partly the rough exhibit contract (native
   `<button>`s, no gap token, no styling). Either style them in the contract or
   swap them to `ds.button` instances; apply the footer gap.

**Method (proven pattern):** fix the emitter → teach the mock to catch the class
→ re-gate → re-validate live. See `10` (the SVG bug) for the template.

## P0.5 — Harden mock fidelity (systemic)

The composite bugs and the SVG bug all slipped past the mock. Invest in the mock
(`scripts/plugin-engine-mock-figma.mjs`) to reflect: component-property text on
instances, auto-layout sizing (enough to catch collapse), and SVG validity
(done). This raises the floor so "green headless" means more.

## P1 — Make the plugin the frictionless deterministic path

- **Publish to the Figma Community** (human-driven Figma flow; kit ready in
  `figma-sync/plugin/PUBLISHING.md` + icon). This turns dev-import into one-click.
- ~~**Wrap generated sets in a named Section** on canvas~~ **DONE 2026-07-21**:
  every generated component lands on an identity-marked SECTION with a light
  background (`ensureHostSection` in the runtime; create + amend re-fit the
  same section; gated in `plugin-engine-check`).
- **CLI `figma push` → plugin auto-receive** for unattended CI → plugin sync.

## P1 — Complete the two-journey CI recipes

- Code-led: on release → `ds-contracts extract` → commit `contracts/` + a bundle
  artifact → notify.
- Design-led: on merged proposal → `ds-contracts generate` → Storybook build +
  story screenshots in the PR.
- Live in `examples/ci/`; certification gains CLI-from-fresh-clone rows.

## P2 — Publish and expand emitters

- Publish `@ds-contracts/emitter-web-components`.
- The authoring guide (emitter interface, WC as the worked example) as the
  extensibility story.

## P2 — The engine runtime/spec split (enables a leaner future)

The Figma emit is ~90% embedded data (a ~6KB spec per component) and ~10% shared
runtime (~34KB, largely identical across components). Splitting `emit-figma-
script` into `{runtime, spec}` would let the deterministic engine be delivered
more compactly. **Caveat learned:** it does NOT unlock agent-driven delivery
(`use_figma`/`figma_execute` are stateless per call, so the runtime can't persist
across calls). It only helps a Figma-side runtime (the plugin) or a future
Figma-native integration. Do not resurrect the "agent shuttles the emitter" idea.

## P3 — Toward the open spec

- Formalize the contract schema as a versioned, documented open specification
  (the spec site already generates a schema reference from the Zod schema with a
  branch-coverage drift guard).
- Governance (an RFC template exists); community process.

## Owner-only / external actions (flagged, non-blocking to start)

- Figma Community plugin submission (owner's Figma account).
- Publishing `@ds-contracts/emitter-web-components` (needs an npm OTP).
- Any live validation requires the owner to open the plugin / Desktop Bridge in
  the target file.

## What NOT to do

- Do **not** try to run the deterministic emitter through an AI MCP tool
  (`use_figma`/`figma_execute`) — the payload/stateless walls make it a dead end
  (proven repeatedly). See `08#4`.
- Do **not** add a second, AI-driven renderer "for convenience" — it forks the
  source of truth and breaks determinism. See `03`.
- Do **not** report a capability as working without an executable check.

Continue to `12-reference.md`.
