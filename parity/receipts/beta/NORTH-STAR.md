# North Star

The product is a **contract-mediated** hop between a design-system codebase
and a Figma library — props, metadata, variables, structure, specs — and
back. Neither canvas nor React is the source of truth. The contract is.

This page is the checklist. Status is current as of 2026-08-23 (after PRs #18–#24: one truth, named or carried, the held-out exam and its fix rounds, `@ds-contracts/core`, schema 17). "Done" for
this lane is the **eight Flowbite stems**, not a fifty-component kit.

**Unleash bar (not v1):** a design-system team can keep the eight Flowbite
stems in line — edit the contract, generate React, bundle → amend Figma,
dump → recover, and `npm run maintain` (fifteen steps, every one a fast- or
full-lane step; `maintain:visual` in the catalog-visual lane) fails if a
closed hole reopens.
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
| ToggleSwitch | **fail 6.19%** (gate-shot) / 6.15% vs the real Flowbite render — named `FC-FONT-SUBSTRATE` (label glyphs dominate; `FC-TOGGLE-THUMB` receipt says track/thumb pixels are clean). Do not climb the font wall. The 2026-08-22 NOTE (the *recovered* ToggleSwitch drew its thumb outside the track) is CLOSED — the holder declares `position: relative`; thumb 68–88 px inside a 46–90 px track (`46029a88`, `exact-proposal:check` §31, docs/23 §D.15) |
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
| Hop-2 Apply plugin can go stale vs core | **done** — engine receipt re-recorded on every core move, last at `2f6bd6aa8a9d` · 808189 B (schema 17, dump v1.31 embed); `npm run plugin:check` is on `maintain` and in the full lane so a drifted Apply bundle fails the team command, and `plugin:zip` refuses to package a stale engine — the reason a clean clone could not build the plugin on 2026-08-22 until the receipt was re-recorded (docs/23 §D.25). Selecting a Card/Kbd host Section now names the hosted COMPONENT (`FC-PLUGIN-SECTION-SELECTION`). Check Drift now names WHAT changed on those standalone COMPONENTs (`FC-PLUGIN-STANDALONE-DRIFT-SNAPSHOT`) |
| Hop-4 dump→propose of a pipeline-drawn set | **done** — all eight demo stems propose; recovers every dump-stamped name (186 on the fixture), dump `_degradations` (Alert VECTOR receipts + Button/Badge CHANGE_TO reactions named, not invented as `onClick`), dump `specHash` + `version` stamps (authored `0.2.0`, not invented `0.1.0`), dump v1.30 omits Figma-default min/max `0` (does not mint `min-width: 0`), hop-4 fixture sizing is `AUTO`|`FIXED` not invented `HUG` (`FC-HOP4-SIZING-HUG-INVENTED`), VERTICAL hug-height + fixed-width stacks are AUTO×FIXED not swapped FIXED×AUTO (`FC-HOP4-SIZING-AXES-SWAPPED`), the only remaining dump-slug remints are Button `root.height.{size}` (`FC-HOP4-GEOMETRY-REMINTS-ONLY`; live FIXED height stays `FC-GEOMETRY-EXCLUDED`), live dump extras (lineHeight px / strokeWeight 0 / INSIDE / sibling minWidth and cornerRadius) do not add dump-slug mints (`FC-HOP4-LIVE-EXTRAS-SAME-AS-ABSENT`), unbound Card label-text fill as a literal, props/host, layout/paint/stroke, Badge/Button State-preview paints + shadows, Card default DROP_SHADOW, Alert Vector/dismiss nested paints, type stamps, hoisted Button hover ink, and ToggleSwitch thumb ellipse; does not invent canvas-absent events or a `disabled` BOOLEAN from `State=Disabled` preview cells (`FC-DUMP-PROPOSE-DISABLED-INVENTED`); recovers authored names from emit's `Name (id)` collision suffix (`FC-DUMP-PROPOSE-NAME-PARENTHETICAL`); recovers unbound Disabled `opacity: 0.5` as the stamped authored token, not a dump-slug mint (`FC-DUMP-PROPOSE-DISABLED-OPACITY-MINTED`); recovers unbound Alert icon/dismiss padding as the stamped authored literals, not dump-slug mints (`FC-DUMP-PROPOSE-PADDING-LITERAL-MINTED`); recovers unbound Card / Button DROP_SHADOW stacks as the stamped authored tokens, not dump-slug mints (`FC-DUMP-PROPOSE-SHADOW-MINTED`); `npm run flowbite-dump-propose:check` + `exact-proposal:check` |
| Catalog Button Disabled restamped on live canvas | **done** — `8nim1d0IPnehMxA7B7SYxC` set `5:21`; visual-parity Primary/Danger Disabled 93.91% → 5.48% (renderer class, same as Default) |
| Demo ToggleSwitch specHash lagged current emit | **done** — `59mLQlOMiD5w5za6SUcoO5` set `120:2047`; root `counterAxisAlignItems` MIN→CENTER and semantics.role=switch; specHash 3674674594→2132716802; restamped again by the `version` stamp (FC-DUMP-PROPOSE-VERSION-INVENTED) — live and engine now agree at 3428288900 (measured 2026-08-22) |
| Demo sets have a Figma identity in the contracts | **done** (r9 exam 2, 2026-08-23) — the eight `examples/tailwind/contracts/*.contract.json` carried `bindings.figma.anchors.fileKey: null` (the `*.anchors.json` sidecars are token provenance, not identity), so nothing could address the live demo sets by id. Now `bindings.figma.anchors = { fileKey: 59mLQlOMiD5w5za6SUcoO5, nodeId, componentSetKey }` on all eight — Alert `120:1979`, Badge `120:2098`, Button `120:2203`, Card `120:1999` (a standalone COMPONENT; the key is its component key), HelperText `120:2014`, Kbd `120:1982` (standalone COMPONENT), Label `120:1996`, ToggleSwitch `120:2047` — each verified READ-ONLY against the live file (REST `nodes?ids=…&plugin_data=shared`): the node is that set, its `key` is the key written, and `ds_contracts/contractId` equals the contract id; the keys also equal the `key` field of `extract/figma/fixtures/flowbite-eight.dump.json`. What moved: the eight `*.figma.js`, `GENESIS-BATCH.figma.js` and `tailwind.bundle.json` re-emitted per the hop-2 recipe (`flowbite-bundle-fresh:check` green) — per script exactly two lines: `anchorKey` (was `null`) and `EXPECTED_FILE_KEY` (was `null`). **specHash moves for all eight** (`anchorKey` is inside the compiled spec the hash covers): mock-generate through the engine gives e.g. Button 41443591 → 2941065026, ToggleSwitch 1041764168 → 612723347. Measured honestly: the engine at this tree already hashed all eight differently from the live stamps BEFORE the anchors (live Button 3792380235 / ToggleSwitch 3428288900 were stamped by the 2026-08-20/22 emit; `core/emit-figma-script.ts` changed on 2026-08-22 after that), so the demo canvas is stale against HEAD either way and the next Apply re-reconciles all eight IN PLACE (same node id + key; identity resolves by the `ds_contracts/contractId` stamp first, then by `anchorKey`) and restamps the new hash — a redraw, not a fork. The two surfaces that read `fileKey` differ: the plugin passes the OPEN file's key into the plan (`ui.html` → `planGenerate({ fileKey: currentFileKey })` overrides the contract's), so Journey A (paste the bundle into a new file) is unchanged; the standalone console scripts carry `EXPECTED_FILE_KEY = "59mLQ…"` as a hard guard and now refuse any other file BY NAME (`WRONG FILE`). Not moved: `src/` + golden (first-party contracts only), `extract:figma:visual:anchors` (its subjects are `contracts/` only), the engine receipt's inputs (`scripts/build-plugin-zip.mjs` bakes `contracts/`, not `examples/tailwind`; the receipt was re-recorded in the same change for the propose fix, not for the anchors). Propose links stayed verified-exact (`exact-proposal:check` 102, `flowbite-dump-propose:check` 8 stems) — the dump fixture's `key` already resolved by name; the contract-side `componentSetKey` now resolves the same id by key. |
| Standing visual gate locks that close | **done** — Button Disabled locked at 5.48%; Badge/Button/Checkbox/Switch score the live sets the contracts claim; since 2026-08-22 the gate also holds GEOMETRY (both content boxes within ±4 device px of a per-platform baseline; it had passed a 39%-wider Badge on pixels alone) — `npm run maintain:visual`, catalog-visual lane, `-- --self-test` |
| Every code-only fact named where a person reads it | **done** — `codeOnlyFacts` {part, channel, value, reason, variants} ride the bundle, the plugin data, the plugin run report and `figma bundle` stdout (54 on the eight stems; the bare `†` used to be all that survived); `npm run code-only-facts:check` |
| Root `attrs` reach React / WC / HTML; `tokens.css` lands beside the components | **done** — `root-attrs:check` (321 pins), `css-vars:check`; the generated Button paints `rgb(26,86,219)` from the sheet instead of an undefined custom property |
| Focus Visible / Inter hug | **named walls** — `FC-GEOMETRY-EXCLUDED` / `FC-FONT-SUBSTRATE`. Do not climb |

### P1 — Recovery and parity (the round trip)

| Item | Status |
|---|---|
| Dump a set **this pipeline drew** → proposed contract | **done** — all eight demo stems propose; recovers props, host, layout/paint/stroke/type names, Badge/Button State-preview paints, and hoisted Button hover ink; does not invent canvas-absent events; `npm run flowbite-dump-propose:check` |
| Diff authored vs code-capture vs canvas properties | **done** — Flowbite `npm run parity:flowbite` |
| First-party both-sides (Switch) | **done** — [SWITCH-BOTH-SIDES.md](./SWITCH-BOTH-SIDES.md) |
| Name every standing gap | events never live on the canvas; dump cannot invent `onClick`; native `input` not drawn; `FC-FONT-SUBSTRATE`. Switch visual-parity now scores the live set (`BMjUA2ue5CaZXU4kufxL0z` / `4:618`); node-lag vs the contract is pinned by `extract:figma:visual:anchors`. The conformance fixture's canvas round trip is at **0 SILENT** (`conformance:roundtrip`, 46 cases, decrease-only) |
| Held-out kit (not Flowbite — the Phase 2 exam) | **0 SILENT** — the exam's last 2 of 3,556 canvas facts (was 295), both on one Card SLOT, closed 2026-08-23 and hold green in `conformance:canvas` (152 cases · 152 PASS · 0 RED-EXPECTED; docs/23 §D.29); a native SLOT's primary-axis FILL now carries as `layout.grow`, its interior auto-layout is still named not carried (docs/23 §B.24). Button recognisable, Card not, every Card loss named — [FIGMA-DS-EXAM.md](../phase-2/FIGMA-DS-EXAM.md), docs/23 §B.26. Not this lane's ship set; listed so nobody reads the eight stems as the whole story |

### P2 — Scale (not this week)

- The other 38 Flowbite stems (coverage is 8/46, 17.4%)
- Other libraries (MUI, Carbon, Polaris, …)
- Geometry fidelity (`FC-GEOMETRY-EXCLUDED` / Option B)

## Named walls — do not reopen

- `FC-GEOMETRY-EXCLUDED` / Option B — do not invent a second geometry impl; the exam's last two silences were RECEIPT gaps on that wall and closed as receipts (docs/23 §D.29), not by relaxing it
- `FC-FONT-SUBSTRATE` — do not chase ToggleSwitch 6.19% → 5% by swapping fonts (unchanged; `text.fontFamily` is now carried as a declared `font-family` and the wall is named on it)
- Spinner `icon.fill` — promotion drop; stays off the ship set
- Dump → Storybook will not click unless the **authored** contract declares events
- The REST route's `file_variables:read` scope is the user's PAT, not an engine wall — name it once with the fix, do not "degrade" around it (docs/23 §B.25)
- Card on the held-out kit — GLASS / BACKGROUND_BLUR has no contract spelling; do not invent a blur vocabulary to make one cell recognisable (docs/23 §B.26)
- Token prune stays opt-in (`DS_PRUNE_TOKENS`); designer value edits stay unless `DS_OVERWRITE_TOKENS` (docs/23 §B.23)
- Do not write Figma file `Y8Jhw6R49wTLuXZ0is2GmV`
- Do not claim v1 shipped
- Do not start another `/goal` ultracode loop

## How we hill-climb

1. Pick the highest open P0 row.
2. Fix it on the **authored contract or emitter**.
3. Prove it (Playwright, visual-truth, or the functional gate).
4. Leave a gate so it cannot come back.
5. Move to the next row. Do not stop for a status report.
