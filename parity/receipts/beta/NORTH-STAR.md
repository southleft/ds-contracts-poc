# North Star

The product is a **contract-mediated** hop between a design-system codebase
and a Figma library — props, metadata, variables, structure, specs — and
back. Neither canvas nor React is the source of truth. The contract is.

This page is the checklist. Status is current as of 2026-08-20. "Done" for
this lane is the **eight Flowbite stems**, not a fifty-component kit.

**Unleash bar (not v1):** a design-system team can keep the eight Flowbite
stems in line — edit the contract, generate React, bundle → amend Figma,
dump → recover, and `npm run maintain` fails if a closed hole reopens.
Do not claim v1. Do not open another kit to manufacture coverage.

## The hops that must work

| # | Hop | What success looks like |
|---|---|---|
| 1 | **Authored contract** | Props, events, anatomy, tokens, semantics — one JSON file per stem |
| 2 | **Contract → Figma** | Token-bound component set. Re-apply amends in place. Byte-identical bundle |
| 3 | **Contract → React** | Typed components that **look** like the library and **act** like it where the library is interactive |
| 4 | **Figma → contract** | Recovery of props, stamped tokens, host element. Not an app generator |
| 5 | **Align + name gaps** | Diff authored vs recovered vs canvas. Every miss has a name |
| 6 | **Gates** | A visual or functional hole that we closed cannot silently reopen |

## Priority checklist

### P0 — Functional (authored React)

| Item | Status |
|---|---|
| ToggleSwitch clicks (`onToggle`, `checked` flips, `aria-checked`) | **done** |
| ToggleSwitch is `role="switch"` (Flowbite's host, declared exception) | **done** |
| Alert dismiss is a callback, not a boolean named `onDismiss` | **done** |
| Gate: emit + execute, so click/dismiss cannot regress | **done** — `npm run functional:flowbite` |

### P0 — Visual (Path B canvas vs library)

| Stem | Status |
|---|---|
| Button | **pass** 1.97% AA (bar 5%) |
| Badge | **pass** |
| Alert | **pass** |
| Card | **pass** |
| ToggleSwitch | **fail 6.19%** — named `FC-FONT-SUBSTRATE` (label glyphs). Track/thumb sizes are correct. Do not climb the font wall |
| HelperText | **fail 16.96%** — named `FC-FONT-SUBSTRATE` (text-only). Code-vs-library AA 20/20. Do not climb the font wall |
| Label | **fail 16.03%** — named `FC-FONT-SUBSTRATE` (text-only). Code-vs-library AA 20/20. Do not climb the font wall |
| Kbd | **pass** 0.42% AA (bar 5%). Bridge instrument vs real library orig-shot |
| Gate: those scorecards cannot go silent | **done** — `npm run parity:flowbite` pins Kbd pass + HelperText/Label `FC-FONT-SUBSTRATE` |

### P0 — Handoff (the loop a team actually runs)

| Item | Status |
|---|---|
| Disabled opacity cannot wash to 0.5% on re-apply | **done** — emit unbinds stale OPACITY, then writes the 0–1 literal; `state-previews-bounded-canvas-only` pins the unbind line |
| Catalog Button Disabled restamped on live canvas | **done** — `8nim1d0IPnehMxA7B7SYxC` set `5:21`; visual-parity Primary/Danger Disabled 93.91% → 5.48% (renderer class, same as Default) |
| Standing visual gate locks that close | **done** — Button Disabled locked at 5.48%; Badge/Button/Checkbox/Switch score the live sets the contracts claim; `npm run maintain` is the team command |
| Focus Visible / Inter hug | **named walls** — `FC-GEOMETRY-EXCLUDED` / `FC-FONT-SUBSTRATE`. Do not climb |

### P1 — Recovery and parity (the round trip)

| Item | Status |
|---|---|
| Dump a set **this pipeline drew** → proposed contract | exists (`extract:figma`) |
| Diff authored vs code-capture vs canvas properties | **done** — Flowbite `npm run parity:flowbite` |
| First-party both-sides (Switch) | **done** — [SWITCH-BOTH-SIDES.md](./SWITCH-BOTH-SIDES.md) |
| Name every standing gap | events never live on the canvas; dump cannot invent `onClick`; native `input` not drawn; `FC-FONT-SUBSTRATE`. Switch visual-parity now scores the live set (`BMjUA2ue5CaZXU4kufxL0z` / `4:618`); node-lag vs the contract is pinned by `extract:figma:visual:anchors` |

### P2 — Scale (not this week)

- The other 38 Flowbite stems (coverage is 8/46, 17.4%)
- Other libraries (MUI, Carbon, Polaris, …)
- Geometry fidelity (`FC-GEOMETRY-EXCLUDED` / Option B)

## Named walls — do not reopen

- `FC-GEOMETRY-EXCLUDED` / Option B — do not invent a second geometry impl
- `FC-FONT-SUBSTRATE` — do not chase ToggleSwitch 6.19% → 5% by swapping fonts
- Spinner `icon.fill` — promotion drop; stays off the ship set
- Dump → Storybook will not click unless the **authored** contract declares events
- Do not write Figma file `Y8Jhw6R49wTLuXZ0is2GmV`
- Do not claim v1 shipped
- Do not start another `/goal` ultracode loop

## How we hill-climb

1. Pick the highest open P0 row.
2. Fix it on the **authored contract or emitter**.
3. Prove it (Playwright, visual-truth, or the functional gate).
4. Leave a gate so it cannot come back.
5. Move to the next row. Do not stop for a status report.
