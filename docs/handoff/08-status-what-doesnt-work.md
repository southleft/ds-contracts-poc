---
title: "Status — what does NOT work (failures, frontier, blind spots)"
doc_id: 08-status-what-doesnt-work
audience: "Another AI platform with ZERO prior knowledge of this project"
status: authoritative
last_updated: 2026-07-21
reading_order: 8
prerequisites: [07-status-what-works]
related: [10-history, 11-roadmap]
---

# What does NOT work (yet)

This is the most useful document for continuing the work. It is deliberately
blunt. Do not treat any of these as solved.

## 1. The composite Modal fails to render correctly on a live canvas — FRONTIER

The advanced exhibit `ds.composite-modal` passes every **headless** gate (anatomy
parity, both-journey round-trips), but when built **live** via the plugin on
2026-07-21 it had three real rendering defects. The mock validated the *anatomy*
but cannot *see* layout/text/props, so these passed 146 gates and only surfaced
live. Three distinct bugs:

1. **The dialog collapses to ~3px wide.** Multi-root auto-layout sizing: the
   dialog frame isn't establishing width, so it defaults to near-zero.
   Stretching the container reveals the content is all there — it's a sizing bug
   in the multi-root figma-script emit. **[open]**
2. **Repeated tag badges show the default "Badge", not the item text
   ("Shipping"/"Gift wrap"/"Priority").** The emitted `depProps` are *correct*
   (`{Label:"Shipping"}`) and `setInstanceProps` handles the `#`-suffixed
   property keys. The tell: the summary **Card is a single COMPONENT and its
   Title applied**; the **Badge is a COMPONENT_SET and its Label did not** — so
   the set-instance text-property wiring diverges from single-component wiring.
   **Pinning the exact break needs a live read of a tag instance's
   `componentProperties`** (requires the Desktop Bridge plugin open in the target
   file). **[open — needs live inspection]**
3. **Footer "Cancel"/"Save" render as bare, crammed text ("CancelSave"), no
   spacing.** Partly a *rough exhibit contract* (the composite authored native
   `<button>` elements with no gap token and no styling) and partly missing
   footer gap application. **[open — mix of contract-authoring + emitter]**

Owner's verdict (2026-07-21): the individual components are passes; **the
composite is a fail.**

## 2. The headless mock has blind spots — STRUCTURAL RISK

`scripts/plugin-engine-mock-figma.mjs` is faithful for structure but not for
rendering semantics. It let a real bug through (see #3 below) because it accepted
anything from `createNodeFromSvg`. It also cannot catch the composite's layout /
text-binding failures above, because it does not compute visual layout or reflect
component-property text on nodes. **Every time a bug is found live, the fix must
include teaching the mock to catch it headlessly** — otherwise the gates give
false confidence. This is a permanent discipline, not a one-off.

## 3. A real emitter bug was found ONLY on the live canvas (now fixed, but note the pattern)

Stroke-based icons (`<svg fill="none" stroke="currentColor">`, e.g. the Button's
spinner, `close`) got a **second `fill` attribute injected on the `<svg>` tag**
— invalid XML that the real Figma `createNodeFromSvg` refuses ("Failed to convert
SVG file"). 146 headless gates missed it because the mock was lenient. **Fixed**
2026-07-21 (emitter skips fill-injection when the `<svg>` already has fill; mock
now validates SVG and rejects duplicate attributes). The pattern to remember:
**headless-green does not mean live-correct** for anything the mock renders
loosely.

## 4. Live delivery of the full emitter cannot be agent-driven — ARCHITECTURAL CONSTRAINT

You cannot get an AI agent to run the deterministic emitter on a live canvas. The
full build is ~288KB of interdependent scripts; `figma_execute` and `use_figma`
both cap at ~50KB per call and are stateless, and the agent cannot read/author
that payload (a ~22KB read cap compounds it). Sandbox `fetch` is blocked. This is
*why the plugin exists* — but it means the live path always requires the human to
run the plugin (or a stable Desktop Bridge for inspection). Do not burn time
trying to shuttle the emitter through an MCP; it is a dead end (proven
repeatedly).

## 5. The figma-console Desktop Bridge is unstable — ENVIRONMENTAL

It drops roughly every ~3 calls / on idle, and only connects to whichever file
has the Desktop Bridge plugin open. Live inspection of a specific file requires
the human to open that plugin there. Plan around it; don't rely on long live
sessions.

## 6. Open product-friction items (not bugs, but blockers to adoption)

- The plugin is a **dev-import** today; publishing to the Figma Community (a
  human-driven Figma flow) is prepared (`PUBLISHING.md`, icon) but not done.
- Generated sets are **not wrapped in a Section/frame** on canvas (a nice-to-have
  the owner requested; the plugin could drop each set in a named Section).
- The **web-components emitter** is built but **not published**.
- CI recipes exist but the fully-async "CI → plugin" channel is a named roadmap
  item, not v1.

## 7. Things proven headless but NOT yet validated live

- The composite Modal building correctly on a real canvas (fails — see #1).
- `canvas → contract` for advanced composition *on real Figma* (only mock-gated).
- `code → contract` at scale on real, foreign codebases beyond the tested set.

## How to read this list

None of these invalidate the core thesis (see `07`): the deterministic pipeline
works and individual components build live. These are the *frontier* — advanced
composition rendering, mock fidelity, and adoption friction. The most valuable
next work is `08#1` (the composite) and `08#2` (mock fidelity). See `11-roadmap`.
