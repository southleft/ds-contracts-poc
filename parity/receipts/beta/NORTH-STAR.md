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
| ToggleSwitch | **fail 6.19%** (gate-shot) / 6.15% vs the real Flowbite render — named `FC-FONT-SUBSTRATE` (label glyphs dominate; `FC-TOGGLE-THUMB` receipt says track/thumb pixels are clean). Do not climb the font wall. NOTE 2026-08-22: the *recovered* (dump→propose→React) ToggleSwitch draws its thumb outside the track — a Phase 1 P0, not this row's wall |
| HelperText | **fail 16.96%** — named `FC-FONT-SUBSTRATE` (text-only). Code-vs-library AA 20/20. Do not climb the font wall |
| Label | **fail 16.03%** — named `FC-FONT-SUBSTRATE` (text-only). Code-vs-library AA 20/20. Do not climb the font wall |
| Kbd | **pass** 0.42% AA (bar 5%). Bridge instrument vs real library orig-shot |
| Gate: those scorecards cannot go silent | **done** — `npm run parity:flowbite` pins Kbd pass + HelperText/Label `FC-FONT-SUBSTRATE` |

### P0 — Handoff (the loop a team actually runs)

| Item | Status |
|---|---|
| Disabled opacity cannot wash to 0.5% on re-apply | **done** — emit unbinds stale OPACITY, then writes the 0–1 literal; `state-previews-bounded-canvas-only` pins the unbind line |
| Apply leftover tokens stay forever | **named, prune opt-in** — token apply NAMES unreferenced leftovers in owned collections (bundle `Tokens` and first-party Primitives/Brand/Semantic) in the step result and Build log; removal only behind `globalThis.DS_PRUNE_TOKENS = true`, which also keeps style-bound leftovers and skips (by name) on a runtime missing a style reader. Cross-file consumers stay invisible (docs/23 §B.23). `npm run token-set-prune:check` pins all three doors |
| Hop-2 paste artifact can go stale | **done** — committed `tailwind.bundle.json` and the eight `*.figma.js` scripts must match a fresh emit; bundle carries Alert `dismissable`+`onDismiss` and ToggleSwitch `role=switch`+`onToggle`; button script unbinds stale OPACITY; `npm run flowbite-bundle-fresh:check` |
| Hop-2 Apply plugin can go stale vs core | **done** — engine receipt re-recorded (`7d3448d54b1a`, 737991 B) after FC-DUMP-PROPOSE-SHADOW-MINTED; `npm run plugin:check` is on `maintain` so a drifted Apply bundle fails the team command. Selecting a Card/Kbd host Section now names the hosted COMPONENT (`FC-PLUGIN-SECTION-SELECTION`). Check Drift now names WHAT changed on those standalone COMPONENTs (`FC-PLUGIN-STANDALONE-DRIFT-SNAPSHOT`) |
| Hop-4 dump→propose of a pipeline-drawn set | **done** — all eight demo stems propose; recovers every dump-stamped name (186 on the fixture), dump `_degradations` (Alert VECTOR receipts + Button/Badge CHANGE_TO reactions named, not invented as `onClick`), dump `specHash` + `version` stamps (authored `0.2.0`, not invented `0.1.0`), dump v1.30 omits Figma-default min/max `0` (does not mint `min-width: 0`), hop-4 fixture sizing is `AUTO`|`FIXED` not invented `HUG` (`FC-HOP4-SIZING-HUG-INVENTED`), VERTICAL hug-height + fixed-width stacks are AUTO×FIXED not swapped FIXED×AUTO (`FC-HOP4-SIZING-AXES-SWAPPED`), the only remaining dump-slug remints are Button `root.height.{size}` (`FC-HOP4-GEOMETRY-REMINTS-ONLY`; live FIXED height stays `FC-GEOMETRY-EXCLUDED`), live dump extras (lineHeight px / strokeWeight 0 / INSIDE / sibling minWidth and cornerRadius) do not add dump-slug mints (`FC-HOP4-LIVE-EXTRAS-SAME-AS-ABSENT`), unbound Card label-text fill as a literal, props/host, layout/paint/stroke, Badge/Button State-preview paints + shadows, Card default DROP_SHADOW, Alert Vector/dismiss nested paints, type stamps, hoisted Button hover ink, and ToggleSwitch thumb ellipse; does not invent canvas-absent events or a `disabled` BOOLEAN from `State=Disabled` preview cells (`FC-DUMP-PROPOSE-DISABLED-INVENTED`); recovers authored names from emit's `Name (id)` collision suffix (`FC-DUMP-PROPOSE-NAME-PARENTHETICAL`); recovers unbound Disabled `opacity: 0.5` as the stamped authored token, not a dump-slug mint (`FC-DUMP-PROPOSE-DISABLED-OPACITY-MINTED`); recovers unbound Alert icon/dismiss padding as the stamped authored literals, not dump-slug mints (`FC-DUMP-PROPOSE-PADDING-LITERAL-MINTED`); recovers unbound Card / Button DROP_SHADOW stacks as the stamped authored tokens, not dump-slug mints (`FC-DUMP-PROPOSE-SHADOW-MINTED`); `npm run flowbite-dump-propose:check` + `exact-proposal:check` |
| Catalog Button Disabled restamped on live canvas | **done** — `8nim1d0IPnehMxA7B7SYxC` set `5:21`; visual-parity Primary/Danger Disabled 93.91% → 5.48% (renderer class, same as Default) |
| Demo ToggleSwitch specHash lagged current emit | **done** — `59mLQlOMiD5w5za6SUcoO5` set `120:2047`; root `counterAxisAlignItems` MIN→CENTER and semantics.role=switch; specHash 3674674594→2132716802; restamped again by the `version` stamp (FC-DUMP-PROPOSE-VERSION-INVENTED) — live and engine now agree at 3428288900 (measured 2026-08-22) |
| Standing visual gate locks that close | **done** — Button Disabled locked at 5.48%; Badge/Button/Checkbox/Switch score the live sets the contracts claim; `npm run maintain` is the team command |
| Focus Visible / Inter hug | **named walls** — `FC-GEOMETRY-EXCLUDED` / `FC-FONT-SUBSTRATE`. Do not climb |

### P1 — Recovery and parity (the round trip)

| Item | Status |
|---|---|
| Dump a set **this pipeline drew** → proposed contract | **done** — all eight demo stems propose; recovers props, host, layout/paint/stroke/type names, Badge/Button State-preview paints, and hoisted Button hover ink; does not invent canvas-absent events; `npm run flowbite-dump-propose:check` |
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
