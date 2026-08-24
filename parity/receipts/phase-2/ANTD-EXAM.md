# Phase 2 exam — Ant Design v5, code → canvas, held out

Date 2026-08-23 · tree `fa88dbf1` (origin/main at the start; rebased onto `ef16e161`, #29 + #30, before the PR) · branch `exam/antd-code-to-canvas` · sandbox `antd@5.29.3` · `@ant-design/cssinjs@1.24.0` · `@ant-design/icons@5.6.1` · `react@18.3.1` · `esbuild@0.28.x` (`examples/antd/.antd-sandbox`, git-ignored; recipe in `examples/antd/README.md`) · **held out — zero `antd` mentions anywhere in docs/ parity/ core/ extract/ evals/ scripts/ examples/ before the recon** · canvas file `byMp6lt0Ij9b2QbkDGFwBh` ("Scratch Project", the ONLY file written; blank before the first mint: 1 page, 0 nodes, 0 collections).

**Pass condition: SILENT = 0.** Capture side (the 12 promoted contracts against the captured truth): **6,007 facts · 1,347 carried · 4,552 named · 108 render-inert · 0 silent** — before this round's fixes the same denominator read **44 silent** (46 width/height facts on five components that FC-GEOMETRY-EXCLUDED dropped with no receipt anywhere, see §4). Canvas side (the bundle the engine pasted): **501 code-only facts named** (248 declared · 130 channel · 122 capture · 1 meter) across the 12 sets, stamped as `ds_contracts/codeOnlyFacts` on every set; conformance's canvas round trip `54 cases · 0 SILENT`. Recognisability: **12 of 12 sets pass "I can tell what this is"** after five heal iterations (§6), with six walls named by code (§5).

Mirror of [FIGMA-DS-EXAM.md](FIGMA-DS-EXAM.md) (canvas → code). The recon that sized this round is `examples/antd/RECON.md`; every `__note` in `extract/computed/configs/antd.json` quotes its probe.

Artifacts: `examples/antd/` (tokens · seeds · contracts · generated React + web components · figma scripts · bundle · receipts), `extract/computed/out/antd/` (captured truth, enriched contracts + extensions, LEDGER.md, scorecards, orig-shots), `parity/receipts/phase-2/antd/` (every set's canvas PNG, the default-cell PNGs, `*.triptych.png` canvas | library | diff, `visual-parity.json`, `iter1/`–`iter4/` the superseded mints), scratch (not committed): the plugin dump (`antd-plugin.dump.json`, dump v1.31, 466,297 chars, 159 degradations), the REST dump, the proposals and `ANTD-ROUNDTRIP.md`.

## 1. Commands (exact)

```bash
# sandbox — the only network step (examples/antd/README.md)
mkdir -p examples/antd/.antd-sandbox && cp examples/antd/probe/sandbox-package.json examples/antd/.antd-sandbox/package.json
(cd examples/antd/.antd-sandbox && npm install --no-audit --no-fund)       # antd 5.29.3 — run.ts refuses drift
node examples/antd/scripts/build-tokens.mjs                                 # 350 global + 152 component leaves = 502; 290 differ in dark; drift check 0
npm run seed:gen -- extract/computed/configs/antd.json                      # dry run (W1): Button 7 axes, Progress 5, Tooltip 1 — the curated seeds prune them
for C in Button Tag Badge Switch Checkbox Radio Input Alert Avatar Progress Card Tooltip; do
  npm run extract:computed -- --harness examples/antd/.antd-sandbox --config extract/computed/configs/antd.json --component $C --out extract/computed/out/antd --keep-originals
done                                                                         # pass 1 with tokens.mintedBootstrap; promote; flag deleted; passes 2–4 as the heal loop moved the engine; pass 4 = the committed scorecards
npx tsx examples/antd/scripts/promote-floor.mjs                             # 91 source-aliased + 1,204 literal leaves; 3 authored rows; statePreviews 2 ON / 5 refused by name
npm run extract:computed:scorecard -- --dir extract/computed/out/antd --config extract/computed/configs/antd.json --write
npm run extract:computed:regate -- --config extract/computed/configs/antd.json --out extract/computed/out/antd --write-enriched   # the heal loop re-fused offline (5×)
npm run extract:computed:drift -- --write --config extract/computed/configs/antd.json
npx tsx packages/cli/src/cli.ts generate examples/antd/contracts --target react --out examples/antd/generated --icons examples/antd/assets/icons --tokens examples/antd/tokens/antd.dtcg.json,examples/antd/tokens/antd-minted.dtcg.json
npx tsx packages/cli/src/cli.ts generate examples/antd/contracts --target web-components --emitter @ds-contracts/emitter-web-components --out examples/antd/generated-wc --icons examples/antd/assets/icons --tokens …
npx tsx packages/cli/src/cli.ts figma examples/antd/contracts --out examples/antd/figma --icons examples/antd/assets/icons --tokens …
node examples/antd/scripts/build-figma-tokens.mjs && node examples/antd/scripts/figma-compile-receipt.mjs && node examples/antd/scripts/build-genesis-batch.mjs
npx tsx packages/cli/src/cli.ts figma bundle examples/antd/contracts/*.contract.json --out examples/antd/figma/antd.bundle.json --tokens … --modes examples/antd/tokens/modes/antd.light.dtcg.json,examples/antd/tokens/modes/antd.dark.dtcg.json --name "Ant Design" --icons examples/antd/assets/icons
# sha256 2fefba105ca34db9fa779cd24809e286202389b8ff33775901225c81a150b836 — byte-identical on rebuild
# canvas leg: the bundle planned by the REAL plugin engine (scripts/build-plugin-zip.mjs buildEngineBundle → DSC.parseIncomingText → DSC.planGenerate(fileKey byMp6lt0Ij9b2QbkDGFwBh)) → 25 steps
# served on localhost:9231 (scripts/console-loop-stem-serve.mjs) → fetched + eval'd inside figma_execute, file key asserted before EVERY write
npx tsx extract/figma/rest/cli.ts https://www.figma.com/design/byMp6lt0Ij9b2QbkDGFwBh/Scratch-Project --out <scratch>/antd-rest.dump.json
npx tsx extract/figma/propose.ts <scratch>/antd-plugin.dump.json --out <scratch>/antd-proposed --contracts examples/antd/contracts --tokens …
npx tsx extract/figma/roundtrip.ts --fixtures <scratch>/antd-plugin.dump.json --contracts examples/antd/contracts --out <scratch>/ANTD-ROUNDTRIP.md
```

## 2. Per-subject stanzas

| set | combos × planes | seed | double-run | replay eq | gate eq | src-facts | parts carried (svg) | refusals | minted vars | canvas set (node, variants) | parity AA (canvas vs library, default cell) | recognisable |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Button | 240 × 4 | ✔ curated (type×size×danger; seed-gen proposes 7 axes) | IDENTICAL | 99.930% | 83.9% | 1,164 | 6 (2) | 29 | — | `33:5066`, 30 | 17.4% (74×32 vs 73×34 — text AA + the library's 2px shadow) | ✔ |
| Tag | 32 × 4 | ✔ | IDENTICAL | — | 97.5% | 124 | 2 (1) | 2 | — | `33:5408`, 14 | 1.9% ✔ (36×22) | ✔ |
| Badge | 8 × 4 | ✔ | IDENTICAL | — | 93.4% | 103 | 8 | 16 | — | `33:4823`, 6 | 5.4% (43×43 vs 42×42 — the "5" glyph AA) | ✔ |
| Switch | 8 × 4 | ✔ | IDENTICAL | — | 94.3% | 140 | 5 (+knob) | 10 | — | `33:5345`, 12 (4 + 8 State previews) | 9.1% (44×22 vs 45×25 — the knob's box-shadow, named) | ✔ |
| Checkbox | 6 × 4 | ✔ | IDENTICAL | — | 85.0% | 51 | 5 (+tick) | 8 | — | `33:5114`, 3 | 18.8% (85×17 vs 85×16 — text AA) | ✔ |
| Radio | 4 × 4 | ✔ | IDENTICAL | — | 74.8% | 26 | 5 (+dot) | 8 | — | `33:5252`, 2 | 16.2% (59×17 vs 59×16 — text AA) | ✔ |
| Input | 72 × 4 | ✔ | IDENTICAL (after the probe fix, §4) | — | 79.9% | 162 | 1 | 1 | — | `33:5197`, 40 (36 + 4 previews) | 1.1% ✔ (288×32) | ✔ |
| Alert | 32 × 4 | ✔ | IDENTICAL | — | 86.6% | 200 | 9 (4 glyphs + close) | 16 | — | `33:4769`, 8 | 0.8% ✔ (288×40) | ✔ |
| Avatar | 6 × 4 | ✔ | IDENTICAL | — | 91.9% | 30 | 2 | 3 | — | `33:4784`, 6 | 0.0% ✔ (32×32) | ✔ |
| Progress | 4 × 4 | ✔ (+ percent/max number props, heal loop) | IDENTICAL (after the unset fix, §4) | — | 93.1% | 18 | 8 (2 glyphs) | 9 | — | `33:5238`, 4 | 3.4% ✔ (287×12) | ✔ |
| Card | 4 × 4 | ✔ | IDENTICAL | — | 91.4% | 20 | 5 | 6 | — | `33:5093`, 4 | 1.5% ✔ (288×128 vs 288×127) | ✔ |
| Tooltip | 1 × 1 (portal, B.2) | ✔ | IDENTICAL | — | 95.0% | 0 (B.1) | 4 (+arrow) | 5 | — | `33:5419`, standalone | 11.5% (92×50 vs 86×34 — the arrow sits outside the portal root's box in the library shot) | ✔ |

Library floor 85.3% computed equality over 134,068 cells (the committed scorecards are the harness re-measure under the FINAL engine — pass 4; the drift baseline's 12 antd rows agree EXACTLY with them) · 113 named refusals in the extension sidecars · 0 open review-queue items. Tokens on the canvas: one "Ant Design" collection, Light/Dark, **1,781 variables** (1,075 colour · 509 float · 106 string · 91 Figma-native aliases to antd's own token names). Parity: `extract/figma/visual-parity/img.ts` (ink-trim, white-flatten, pixelmatch AA) over the canvas DEFAULT cell vs the sandbox's real render of the same combo (`orig-shots/`, `--keep-originals`); no text mask, so the text-bearing small components carry the font-substrate AA in their number — the triptychs show the residue is glyph edges. The ±2px content-box gate holds on 10 of 12 (Switch: the knob shadow; Tooltip: the arrow).

## 3. Accounting — SILENT before → after

Denominator (`scratchpad antd-account.mts`, the conformance gate's rules): every computed channel on a part that differs from its tag-matched control (the delta-from-control door), plus per-combo default deltas, plus interaction-plane deltas against the SAME combo's default plane, plus the disabled plane against the enabled twin, minus -webkit-/logical aliases/synthetic. CARRIED = the contract spells it (tokens/declared/literals/byProp/layout/states/declaredStates/shape/asset/shorthand cover/fold). NAMED = Part.codeOnly, the extension's codeOnlyChannels/stateOverflow/overflowBindings/pairwise/pseudoParts/frontier/styled-channel receipts, LEDGER.md or the run's stdout name the (part, channel). INERT = perspective-origin/transform-origin (derived from the box). SILENT = none of those.

| subject | facts | carried | named | inert | silent (before → after) |
|---|---|---|---|---|---|
| Button | 361 | 71 | 274 | 16 | 0 → 0 |
| Tag | 45 | 36 | 7 | 2 | 2 → 0 |
| Badge | 244 | 208 | 22 | 14 | 0 → 0 |
| Switch | 612 | 166 | 436 | 10 | 0 → 0 |
| Checkbox | 992 | 166 | 816 | 10 | 0 → 0 |
| Radio | 1,005 | 175 | 820 | 10 | 0 → 0 |
| Input | 68 | 37 | 29 | 2 | 4 → 0 |
| Alert | 162 | 84 | 66 | 12 | 0 → 0 |
| Avatar | 73 | 58 | 11 | 4 | 8 → 0 |
| Progress | 556 | 124 | 422 | 10 | 20 → 0 |
| Card | 962 | 102 | 850 | 10 | 10 → 0 |
| Tooltip | 927 | 120 | 799 | 8 | 0 → 0 |
| **total** | **6,007** | **1,347** | **4,552** | **108** | **44 → 0** |

The 44 (verbatim class): `width`/`height` (+ `inline-size`/`block-size` aliases) on Tag root, Input root, Avatar root + label, Progress root/outer/inner/bg/label, Card root/head/wrapper/title/body — FC-GEOMETRY-EXCLUDED drops that nothing ledgered per part (the Option B obligation, unmet until `styledChannels` grew the `geometry-excluded:` receipt, §4). Everything the accounting script first flagged beyond those was the instrument: svg `fill`/`d`/`fill-rule` on glyph paths ride the promoted svg ASSET (the capture parts are absent at base when the icon presence is off); interaction deltas are stored against the BASE combo, not the combo's own default.

## 4. The S-cases (authored BEFORE capture) and what they found

`conformance/cases/antd-*` — nine cases, CSS/DOM frontier 82 → 91, canvas round trip 46 → 54 (`npm run conformance` · `npm run conformance:roundtrip` both GREEN, 0 SILENT).

| case | boundary | expect | observed (pinned) → now |
|---|---|---|---|
| antd-focus-outline-ring (root `outline: 0 → 3px solid`) | capture | CARRIED | CARRIED (root states carry outline-width/color/offset) |
| antd-focus-outline-ring-child-part (the ring on a nested box — Checkbox/Radio inner) | capture | REFUSED by name | REFUSED `v13 Part.states carries plain color-kind refs only on non-root parts` — and, W4, the refusal now rides the CONTRACT as `Part.codeOnly` and the bundle as `capture`-kind codeOnlyFacts (122 on the 12 sets) |
| antd-focus-outline-ring-ua-width (antd's real idiom: rest `outline-style: none`, focus `3px solid` where 3px = Chromium's own `medium`) | capture + canvas | CARRIED | **SILENT** → CARRIED: the width never differed between planes and was "not a fact"; the outline PAIR rule in fusion carries the plane's width whenever its style/colour changed. On the canvas the state plane was then **still SILENT** (no State preview without `bindings.figma.statePreviews`) → NAMED by FC-STATE-PLANE-UNDRAWN (19 facts on the antd sets; 18 committed contracts across 8 libraries gained the same receipt) |
| antd-forwarded-root-attrs (className/data-* land on the hidden input) | capture | CARRIED root = label | CARRIED |
| antd-presence-times-axis-glyph (icon presence × type glyph) | capture | CARRIED, no phantom | CARRIED (first fixture used UA-default black, which the delta-from-control door rightly refuses as a fact — fixture corrected to antd's `rgba(0,0,0,.88)`) |
| antd-component-scoped-custom-property (token declared on `.antd.ant-btn`, consumed by a descendant) | capture | CARRIED `{scoped-pad}` | CARRIED |
| antd-part-transition-channel | capture | CARRIED declared | CARRIED |
| antd-empty-margin-only-parts (Switch inner-checked/unchecked) | capture + canvas | first authored REFUSED — the schema DRAWS margin-left (manifest corrected); canvas PRESENT | capture CARRIED; canvas **SILENT** → NAMED: `applyMarginBox` returned without a word on FILL / grow / out-of-flow / the empty-frame #60 default — FC-EMIT-MARGIN-BOX-SKIPPED (5 committed contracts in 3 libraries gained receipts) |
| antd-overlay-digit-depth-three (Badge's `5` under sup>bdi>span>span.current) | capture + canvas | CARRIED | CARRIED both ways (the digit survives the round trip under `b/part-1-0/c/label-2`) |

Instrument defects found by measuring (each closed in this round's engine commits):
1. `seed-gen` (W1): the recon blamed the `readonly [...]` tuple grammar; re-measured, tuples resolve — the lookup was case-sensitive and basename-first, so `Button` resolved to `skeleton/Button.d.ts` (size only), `Progress` to `spin/Indicator/Progress.d.ts`, `Tooltip` to nothing. Fixed (directory-name match first); corpus-neutral by `seed:verify` (carbon 11/14 · mui 28/43 · tailwind 10/15, byte-identical before/after).
2. The closed-shadow-root suspect fired 720× on Button and 64× on Tag — every svg `<path>` (a childless painted leaf by design). SVG-namespace elements skipped.
3. The settle probe polled `outline-color` but not `outline-width/style/offset`: Input's underlined focus ring transitioned under the reader (`0px` vs `1px` double-run witness). The three longhands joined the probe; Input's double run is byte-identical.
4. The unset-axis materialization grew the enum and not the figma VARIANT values map → Progress quarantined whole ("figma values map is missing enum value unset"). The display name joins in the same breath.
5. FC-GEOMETRY-EXCLUDED dropped width/height with no per-part receipt (the 44 above) → `geometry-excluded:` per part, beside the `-webkit-` census.
6. A root carrying prop-bound text (`content`) BESIDE parts drew no text node — Tag's label. `rootTextSpecs` hosts the bound label like a child part (only the compile receipt's text pin noticed).
7. Defaultless axes: the canvas enumerates enum values only; the unset plane (antd's red Badge, its neutral Tag) had no cell and the round trip called the first value the default, with nothing saying so → FC-UNSET-PLANE-UNDRAWN (3 antd sets; corpus-wide receipts on altitude/carbon/polaris/fluent defaultless axes).

## 5. Walls, by code (named, with "Cause, located:")

- **FC-STATE-PLANE-UNDRAWN (named-but-should-carry #1).** `statePreviews` refused on Button, Tag, Checkbox, Radio, Alert because ONE declared state has no root override (Button's hover/active are `type × danger` two-placeholder refs — S3 residue; Checkbox/Radio focus rings live on the inner part — v13; Tag/Alert hover on the close icon). The referee is all-or-nothing per set, so Button's focus-visible and disabled planes, which DO carry, get no preview cell either. Cause, located: `packages/cli/src/promote.ts` statePreviewProbe + `core/emit-react.ts` validateContract (a state without overrides refuses the whole flag). Every dropped state binding is now a named fact on the set; drawing the states that have overrides is the next engine round.
- **FC-PSEUDO-SHADOW (named).** The Switch knob's `box-shadow` on `::before` is dropped by the decor grammar (bg alpha + border rings only) — now `pseudo-decor-shadow-uncarried` beside the carriage. Cause, located: `extract/computed/anatomy.ts` pseudo-decor fold.
- **Placeholder ink (docs/23 §B.5, named).** `::placeholder` is read and not carried: the Input's placeholder draws in the root's text colour (`rgba(0,0,0,.88)`) instead of `.25`. Cause, located: no registry channel for a pseudo-plane colour.
- **The tooltip arrow (named, faithful).** antd's clip-path arrow `::before` carries as a 16×8 rect (clip-path named `pseudo-decor-outside-grammar` for `::after`); it sits ABOVE the bubble because the captured popup flipped (placement `top` with no room above in the stage) — the canvas reproduces the capture, and the library's own screenshot clips the arrow outside the portal root's box.
- **FC-FONT-SUBSTRATE (named).** Roboto 600 (`fontWeightStrong`) is synthesised on Card titles; the text-AA residue on Button/Checkbox/Radio/Badge triptychs is glyph rasterisation, not geometry.
- **B.1 / B.2 (named).** Tooltip: 0 source facts in the portal sweep; no state planes.
- **Radio dot (W5, carried with a 1px residue).** The uniform `scale(.375)` now folds into a 6×6 centred ellipse; the canvas dot sits at 4,4 of the 16px inner (the host border is folded only for bubbled decor) — within the ±2px gate.
- **Input `status × variant` border (FIXED, was a wrong fact).** The pair-with-unset carriage wrote the unset-plane map AFTER the named-plane map and `resolveTokens` merges in order → every Status=Error cell drew the unset grey. Defaultless-axis maps now sort last. Cause, located: `extract/computed/fuse.ts` applyMintToContract.

## Self-heal log

*(§6 — owner bar: put the canvas beside the sandbox render; only the named walls may differ.)*

Every iteration: mint by the engine (25 planned steps), screenshot every set + default cell (`exportAsync` scale 1 → `parity/receipts/phase-2/antd/iterN/`), triptych against the sandbox render, diagnose, fix at the cause in the repo, re-fuse offline (`regate --write-enriched`), promote, emit, delete the superseded pages, re-mint.

| iter | what was wrong (screenshot) | cause | change | after |
|---|---|---|---|---|
| 1 → 2 | Button 18px tall (`iter1/button.png`); Input a 24×10 box with no text (`iter1/input.png`); Avatar 12×24 ovals (`iter1/avatar.png`); Alert text on the border, no icon gap (`iter1/alert.png`); Progress label only (`iter1/progress.png`); Tag label missing (iter 0, caught by the compile receipt) | `height: var(--ant-control-height)` / `--ant-avatar-container-size` refused as geometry; Input `width:100%` root hugging; presence-driven padding/margin dropped whole; root `content` text not hosted; the track/fill geometry | token-named geometry admission; stage-fill root door; presence-OFF plane carried; `rootTextSpecs` hosts `content`; placeholder label from the text prop; Progress `percent`/`max` + authored meter | `iter2/*.png`: Button 32/24/40, Input 288×32 with "Input" (centred), Avatar 32×32, Alert padded with the icon gap, Progress bar still a sliver |
| 2 → 3 | Progress fill a 2px sliver (`iter2/progress.png`); Radio checked a solid disc (`iter2/radio.png`); dashed Button SOLID (`iter2/button.png`); Input placeholder centred | `flex-grow` minted as an annotated token, never `layout.grow`; the dot's `scale()` outside the grammar; border-style varies by axis → declared residue; root default CENTER | `layout.grow` from flex-grow ≥ 1 and root-width-fill; uniform-scale fold; stylesWhen border-style → dashPattern; MIN-justified placeholder | `iter3/*.png`: dashed strokes, placeholder at the start, the dot present but at 12,12, the bar present with a sliver fill |
| 3 → 4 | Dot off-centre; fill still 40% of a 2px hug | the pseudo's own margins not folded; `pct` applied before the track laid out | margins fold into top/left; meter re-applied in a root post-pass (`ds_meter` stamp) | `iter4/progress.png`: 40% fill on the track; `iter4/radio.png`: dot centred |
| 4 → 5 | Input Status=Error cell grey (`iter4/input.triptych.png`) | unset-plane map merged after the error map | defaultless-axis maps sort last | finals (`*.png`, `*.triptych.png`): Input 1.1% |

Final verdicts (the canvas DEFAULT cell beside the sandbox render of the same combo): Button ✔ (types/sizes/danger/dashed; 17% AA is glyph edges + the library's shadow) · Tag ✔ 1.9% · Badge ✔ 5.4% (the "5") · Switch ✔ (knob shadow named) · Checkbox ✔ (tick and indeterminate square) · Radio ✔ (white dot) · Input ✔ 1.1% · Alert ✔ 0.8% · Avatar ✔ 0.0% · Progress ✔ 3.4% · Card ✔ 1.5% · Tooltip ✔ (arrow side = the capture's flipped placement). The engine mints one page per component; the finals were moved onto page `antd exam 2026-08-23` (12 sections) and the per-component pages removed — every superseded mint deleted before the next.

## Screenshots

The pair per set: `canvas` is the minted set's DEFAULT cell exported from the
Figma file (`exportAsync` scale 1), `reference` is the sandbox's real render of
the same combo (the orig-shot the parity scorer read, copied beside this
receipt from `extract/computed/out/antd/<component>/orig-shots/`). The scored
numbers and the ±2px content-box verdicts are `antd/visual-parity.json`; the
`*.triptych.png` files show canvas | library | diff.

| set | canvas | reference | note |
|---|---|---|---|
| Button | antd/button-cell.png | antd/button-library.png | default cell `default.middle.safe.off.off.enabled__default`, 17.37% AA; diff in `antd/button.triptych.png` |
| Tag | antd/tag-cell.png | antd/tag-library.png | default cell `blue.bordered.off__default`, 1.89% AA; diff in `antd/tag.triptych.png` |
| Badge | antd/badge-cell.png | antd/badge-library.png | default cell `count.blue__default`, 5.35% AA; diff in `antd/badge.triptych.png` |
| Switch | antd/switch-cell.png | antd/switch-library.png | default cell `default.unchecked.enabled__default`, 9.07% AA; diff in `antd/switch.triptych.png` |
| Checkbox | antd/checkbox-cell.png | antd/checkbox-library.png | default cell `unchecked.enabled__default`, 18.82% AA; diff in `antd/checkbox.triptych.png` |
| Radio | antd/radio-cell.png | antd/radio-library.png | default cell `unchecked.enabled__default`, 16.15% AA; diff in `antd/radio.triptych.png` |
| Input | antd/input-cell.png | antd/input-library.png | default cell `middle.error.outlined.enabled__default`, 1.11% AA; diff in `antd/input.triptych.png` |
| Alert | antd/alert-cell.png | antd/alert-library.png | default cell `info.noIcon.off.off__default`, 0.8% AA; diff in `antd/alert.triptych.png` |
| Avatar | antd/avatar-cell.png | antd/avatar-library.png | default cell `default.circle__default`, 0% AA; diff in `antd/avatar.triptych.png` |
| Progress | antd/progress-cell.png | antd/progress-library.png | default cell `unset__default`, 3.44% AA; diff in `antd/progress.triptych.png` |
| Card | antd/card-cell.png | antd/card-library.png | default cell `default.outlined__default`, 1.48% AA; diff in `antd/card.triptych.png` |
| Tooltip | antd/tooltip.png | antd/tooltip-library.png | default cell `__default`, 11.5% AA; diff in `antd/tooltip.triptych.png` |

## 7. Round trip (the idempotence measure)

Plugin dump (`dump.plugin.js` run inside the file via `figma_execute`, dump v1.31): 12 sets, 159 degradations (89 vector-geometry-unsupported · 44 text-channel-unsupported · 8 radii-nonuniform · 6 stroke-style-unsupported · 6 prototype-reactions-unsupported · 4 stroke-weights-nonuniform · 1 rotation-unsupported · 1 stroke-align-unsupported). REST dump (`rest/cli.ts`): 12 sets; 2,240 `variable-unresolved` behind the PAT's missing `file_variables:read` scope (named once, by cause), 90 geometry-unsupported, 15 weights-nonuniform, 10 style-unsupported, 9 radii-nonuniform.

`propose.ts` on the plugin dump: 12/12 proposed, 0 skipped; 131 provisional minted tokens; 404 captured variables in 2 mode trees; unbound values: Badge 2 · Checkbox 1 · Tooltip 1. `roundtrip.ts` (the repo's structural comparator): MATCHED 221 · CANVAS-ABSENT 127 · MISMATCH 537 across the 12 — the mismatch classes by census: 322 contract facts missing from the proposal (declared display/box-sizing/text-rendering/min-width facts the canvas does not read back), 85 proposal-only spellings (`padding-block`/`border-radius` shorthands over the contract's longhands), 28 root text hoists, 25 + 5 enum ORDER/case (`noIcon` → `noicon`: the proposer lowercases camelCase values — a real loss of spelling, named here), 19 proposal-only parts (margin boxes / hoisted labels), 18 value differences (`#fff` vs `#ffffff`, font stacks vs `Roboto`), 8 props missing (presence booleans), 6 proposal-only props. The comparator predates the floor grammar (declared facts, literalsByProp, shape parts); its numbers are recorded, not waived.

## 8. What was NOT done

- The referee still refuses `statePreviews` per set (the next engine round, §5 #1).
- `::placeholder` colour, the pseudo shadow, the 1px Radio dot offset, the tooltip arrow side: named, not fixed.
- `examples/fluent/receipts/figma/COMPILE-RECEIPT.md` was already red on origin/main (two stale Tooltip pins); untouched.
- The console-loop lane (manifest + RATCHET) was not opened for antd; parity lives here under `parity/receipts/phase-2/antd/` with the repo's scorer.
- The REST route's variables stay unnamed until the PAT gains `file_variables:read`.

## 9. Engine files changed (the generality number; the recon predicted 1)

`extract/computed/fuse.ts` (token-named geometry, stage-fill root, presence-OFF plane, outline pair, geometry census, layout.grow, stylesWhen border-style, tokensByProp order, Part.codeOnly) · `extract/computed/anatomy.ts` (unset values map, uniform scale + margin fold, shadow receipt) · `extract/computed/capture.ts` (svg suspect, settle probe) · `extract/computed/seed-gen.ts` (W1) · `core/emit-figma-script.ts` (Part.codeOnly facts, margin-box receipt, undrawn-state receipt, unset-plane receipt, root content text, placeholder label, dashPattern, meter post-pass) · `packages/schema/src/contract-schema.ts` (Part.codeOnly, stylesWhen border-style) · `scripts/plugin-engine-mock-figma.mjs` (pluginData) · `conformance/canvas.ts` (dump-out hook). Corpus re-emitted under the final emitter: mui, carbon, tailwind, astryx, shadcn, fluent, altitude, polaris (dagger census re-recorded; every new receipt is a loss that was silent).

## 10. Gates

On the rebased tree (origin/main `ef16e161`, #29 + #30 merged), every gate exit 0: `typecheck` · `lint` · `format:check` · `docs:check` (every gated number agrees, 116 components / 11.1%) · `ci:lanes` · `schema:fresh` · `conformance` (91 cases · 88 pass · 3 red-expected, the pre-existing HARMFUL trio) · `conformance:roundtrip` (54 cases · 0 SILENT · 0 DRIFTED · 0 HARMFUL) · `conformance:canvas` · `accuracy:check` · `code-only-facts:check` · `figma:fresh` (9/9 libraries byte-fresh) · `generated:fresh` · `maintain` · `extract:computed:drift` (116 rows agree; the 12 antd rows EXACT). Full suite: `npm run eval` on the clean commit `94d07217` → **225/225**, `evals/results.json` stamped clean (`npm run eval:record:check` green). The first full run (219/225) found five stale library bundles (the new receipts ride them), two antd fixtures with non-neutral class names, and two antd baseline rows nobody had recorded — each fixed and re-run, never waived.
