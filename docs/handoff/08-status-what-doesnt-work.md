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

> **2026-07-21 (later the same day): §1's three defects are FIXED headlessly
> and gated** — root causes below, each with its mechanism, emitter fix, and a
> mock upgrade so the class fails in Node forever (`plugin-engine-check`).
> §2's two named blind spots (auto-layout sizing, instance-property
> reflection) are now modeled in the mock.
>
> **2026-07-21 (evening): the owner RAN THE LIVE RE-VALIDATION — pass with one
> new finding.** All five components built on a real canvas: 480px dialog,
> scrim behind, the repeated badges carrying their item text, Card title
> applied, correct variant styling. ONE new live defect: the footer ds.button
> instances kept the default "Button" label while their Variant applied.
>
> **2026-07-22: the real mechanism, pinned — and an earlier inference
> CORRECTED.** The 07-21 theory ("a setProperties call mixing VARIANT+TEXT
> keys drops the text") was WRONG — an inference from incomplete data. The
> 07-22 run (fresh engine, now with the named refusal instead of a silent
> skip) produced the decisive evidence: `Instance "Button": component
> property "Label" not found (available: Variant, Size, State)`. Desktop
> Bridge probes then showed the SAME set healthy minutes later — full
> definitions, all variants wired, fresh instances exposing everything, and
> `setProperties` with the full set-level key working. The verified quirk:
> **a freshly created instance's `componentProperties` can LAG behind its
> component set within a session, listing only the VARIANT axes** (why the
> one-prop Badge always worked while the 24-variant, 3-prop Button
> intermittently didn't — and why the Variant always applied while the Label
> silently skipped under the old no-op). Fix: `setInstanceProps` resolves
> keys against the instance FIRST and falls back to the owning set's
> `componentPropertyDefinitions` (always complete), applying with the full
> key — refusing by name only when neither source knows the property. The
> mock models the lag (a set-level `_hideNonVariantOnInstances` harness flag
> exposes the lagged view while `setProperties` accepts full keys, matching
> the probes), and `plugin-engine-check` builds the composite THROUGH the
> simulated lag, pinning the rendered Cancel/Save characters.
>
> **2026-07-22 (LIVE CONFIRMED — §1 is CLOSED):** the owner re-ran the plugin
> with the owner-defs-fallback engine and the composite Modal built
> completely and correctly on a real canvas: 480px dialog, backdrop scrim
> behind, composed Card with title, three badges carrying item text, and
> footer ds.button instances labeled Cancel/Save with a real gap — hosted on
> a named background Section. The advanced-composition exhibit now passes
> BOTH headless gates AND live rendering. The frontier this document opened
> with no longer exists; §2's residual mock looseness and §4–§6 are the
> remaining live list.

## 1. The composite Modal fails to render correctly on a live canvas — FRONTIER

The advanced exhibit `ds.composite-modal` passes every **headless** gate (anatomy
parity, both-journey round-trips), but when built **live** via the plugin on
2026-07-21 it had three real rendering defects. The mock validated the *anatomy*
but cannot *see* layout/text/props, so these passed 146 gates and only surfaced
live. Three distinct bugs:

1. **The dialog collapses to ~3px wide.** Multi-root auto-layout sizing: the
   dialog frame isn't establishing width, so it defaults to near-zero.
   Stretching the container reveals the content is all there — it's a sizing bug
   in the multi-root figma-script emit. **[FIXED 2026-07-21, gated headless —
   root cause: the hug↔fill degenerate. An align-unset flex container compiled
   `stretchChildren` and the runtime forced every child `layoutSizing FILL`
   while the parent hugged (`counterAxisSizingMode AUTO`) — no node
   contributed intrinsic width, so real Figma resolved the frame to its
   auto-layout minimum. Fix: FILL is now a compile-time decision
   (`annotateFillW` in `core/emit-figma-script.ts`) gated on the parent's
   width being established (fixed/literal width, itself filling, or hugging
   ≥1 intrinsic child — the Banner mixed pattern survives); the mock now
   computes auto-layout sizing so collapse is measurable headlessly, and
   `plugin-engine-check` pins the built dialog width.]**
2. **Repeated tag badges show the default "Badge", not the item text
   ("Shipping"/"Gift wrap"/"Priority").** The emitted `depProps` are *correct*
   (`{Label:"Shipping"}`) and `setInstanceProps` handles the `#`-suffixed
   property keys. The tell: the summary **Card is a single COMPONENT and its
   Title applied**; the **Badge is a COMPONENT_SET and its Label did not**.
   **[FIXED 2026-07-21, gated headless — no live read was needed: the
   mechanism was fully visible in source. The create path minted TEXT/BOOLEAN/
   INSTANCE_SWAP properties per-variant BEFORE `combineAsVariants`, producing
   id-suffixed keys real set-instances never surface (the documented model
   puts non-variant properties on the SET — which `amendSet` always did
   right); and `setInstanceProps` silently no-opped on unmatched keys. Fix:
   `syncOne` now mints properties on the property owner (the set) after
   combine, one key per name, wired into every variant — and an unmatched
   instance property is a refusal BY NAME, never a silent skip. The mock no
   longer hoists variant defs, deep-clones instance subtrees, and REFLECTS
   TEXT/BOOLEAN values onto cloned nodes, so `plugin-engine-check` pins the
   actual rendered characters ("Shipping"/"Gift wrap"/"Priority").]**
3. **Footer "Cancel"/"Save" render as bare, crammed text ("CancelSave"), no
   spacing.** Partly a *rough exhibit contract* (the composite authored native
   `<button>` elements with no gap token and no styling) and partly missing
   footer gap application. **[FIXED 2026-07-21 — contract v1.1.0: the footer
   actions are real `ds.button` instances (secondary/primary, Cancel/Save
   labels) with a `{space.gap.control}` gap; the dialog gained a literal
   480px width, surface/radius/padding/gap tokens; and the backdrop is an
   inset-0 scrim painted BEHIND the dialog (anatomy order = paint order).
   Gated: footer label reflection + gap + backdrop stacking pinned in
   `plugin-engine-check`.]**

Owner's verdict (2026-07-21, morning): the individual components are passes;
**the composite is a fail.** Status after the same-day fixes: all three
defects gated headless; the composite awaits its live re-validation run.

## 2. The headless mock has blind spots — STRUCTURAL RISK

`scripts/plugin-engine-mock-figma.mjs` is faithful for structure but not for
rendering semantics. It let a real bug through (see #3 below) because it accepted
anything from `createNodeFromSvg`. It also could not catch the composite's
layout / text-binding failures above, because it did not compute visual layout
or reflect component-property text on nodes. **2026-07-21: both of those named
blind spots are now modeled** — the mock computes auto-layout sizing (FILL
children contribute zero intrinsic size, so the hug↔fill collapse is
measurable) and follows the real component-property contract (set-level
definitions, variant refusals, instance subtree clones with TEXT/BOOLEAN
reflection, unknown-key throws). Remaining known looseness: per-mode variable
resolution (only the default mode resolves), no font-load enforcement, text
measurement is an estimate, and vector geometry is out of scope. **Every time
a bug is found live, the fix must include teaching the mock to catch it
headlessly** — otherwise the gates give false confidence. This is a permanent
discipline, not a one-off.

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

- The composite Modal building correctly on a real canvas (all three live
  defects fixed + gated headless 2026-07-21 — see #1; the live re-validation
  run is the remaining step).
- `canvas → contract` for advanced composition *on real Figma* (only mock-gated).
- `code → contract` at scale on real, foreign codebases beyond the tested set.

## How to read this list

None of these invalidate the core thesis (see `07`): the deterministic pipeline
works and individual components build live. These are the *frontier* — advanced
composition rendering, mock fidelity, and adoption friction. The most valuable
next work is `08#1` (the composite) and `08#2` (mock fidelity). See `11-roadmap`.
