# Phase 2 exam — the hand-built "Figma Design System" kit, canvas → code, held out

Date 2026-08-22 · tree `ec74da7b` (origin/main, Phase 1 merged) in a detached worktree · file `aekVseUceg35tVn62knRrj` · read-only against Figma (REST GET + one Console-MCP variables read) · nothing in the engine was developed against this kit (ZERO `ds_contracts` stamps).

Pass condition: SILENT = 0. **Result: SILENT ≠ 0.** Across the 15 component sets, 3,556 canvas facts were read off the REST node documents: **1,502 carried · 1,759 named · 295 silent** (76 of the 295 are render-inert at the drawn size; 219 are not). 8 further rows are named with a wrong reason; 25 rows are named but should have carried (the Button's and the Badge's background). Every silent construct is now a pinned red case in `extract/figma/conformance/` (19 cases, gate GREEN with 19 RED-EXPECTED) — nothing in the engine was fixed.

Artifacts (scratch, not in the patch; the exam worktree's `out/` directory): `out/figma-ds.dump.json`, `out/rest-cli.log`, `out/proposed/` (80 proposals, `figma-proposals.md`, `minted.dtcg.json`), `out/proposed/generated/` (76 components + `tokens.css`), `out/figma-png/`, `out/react-png/`, `out/side-by-side/`, `out/accounting.json`, `out/probes/`.

## 1. REST dump — `npx tsx extract/figma/rest/cli.ts <url> --out out/figma-ds.dump.json`

```
✔ 77 set(s) [...] → out/figma-ds.dump.json            (15 COMPONENT_SETs + 62 single COMPONENTs; 332,960 bytes; dump v1.5)
note: variables response not provided — every bound fact degrades to its resolved literal
1748 degraded lines on stderr:  1595 variable-unresolved · 94 vector-geometry-unsupported · 36 stroke-style-unsupported
                                 · 14 text-channel-unsupported · 6 stroke-weights-nonuniform · 3 rotation-unsupported
_provenance.captureGaps: 8 (multi-mode values, absolute placement, image fills, fixed rectangle sizes, instance text
                          overrides, strokeAlign, layout wrap, constraints)
```

Facts about the instrument, not the kit:

- **`GET /v1/files/:key/variables/local` → 403 `Invalid scope(s) … This endpoint requires the file_variables:read scope`.** User-fixable (tick one scope on the PAT). `fetch.ts` classifies exactly this (`classifyVariablesRefusal`) but **`cli.ts` never passes `onVariablesUnavailable`**, so the CLI prints the generic `unresolvable — variables endpoint unavailable (Enterprise) or not provided` 1,595 times and the one-checkbox fix is never shown. Named, wrong reason. Consequence: every one of the kit's ~1,600 variable bindings on these 15 sets degrades to a resolved literal; the proposals mint `imported.*` tokens from literals and none of the kit's 1,025 variable names survives.
- **The 1,748 receipts live only on stderr.** The dump file carries no `_degradations` (REST route) — `propose.ts` cannot see them and `figma-proposals.md` does not repeat them (e.g. the Card Content slot's per-side bottom stroke is named once, on a terminal, and nowhere downstream).
- Exact-mode refusal for an unstamped kit, verbatim (all 15 sets): `Set "Button" could not be proposed: Exact proposal requires structured propertyDefinitions and variantProperties evidence.` Plus one crash-class refusal: `Card Grid … did not fit the contract schema — field "anatomy.root.parts.Section.component.props.sectionFooter": … Unrecognized key: "guid"` (a nested instance's SLOT-typed property value copied as a prop value).

## 2. Propose — `npx tsx extract/figma/propose.ts out/figma-ds.dump.json --out out/proposed --tokens out/kit.dtcg.json --contracts out/empty-contracts --reviewable-inversion`

The kit has no DTCG twin (its variables were refused above), so the corpus is an empty file and the contracts dir is empty — the foreign-kit shape. Without `--tokens` the CLI warns, correctly, that the repo's demo tokens would bind "wrong by construction".

```
77 sets proposed (+1 stub ds.button-icon-default-sm), 0 skipped; figma-proposals.md 1,468 lines; minted.dtcg.json 50,249 bytes
- no captured variables: the dump carries no `_variables` channel (REST transport …) — recapture with the plugin (dump v1.4+)
captured.dtcg.json: NOT WRITTEN (the receipt above is the only trace of the 1,025 variables / 11 collections / 6-mode Appearance)
Button 53 notes, 1 unbound · Badge 40 notes, 1 unbound · Card 30 notes, 2 unbound · Toast 49 notes, 0 unbound
```

## 3. Generate, type-check, render

`npx ds-contracts generate <80 files> --out out/proposed/generated --stories --tokens out/kit.dtcg.json,out/proposed/minted.dtcg.json` (the printed next step):

```
✖ Contract validation failed:
  - ds.section-header: part "root" carries channel "height" as BOTH a token binding and a literal — ambiguous, refused by name
  - ds.section-footer: … (same)                                   → exit 1, NOTHING generated for any of the 80
minus those two:  ✘ Refused — ds.section: slot "children" defaultContent references unknown contract "ds.section-header"
minus section + card-grid as well:  76 components generated, tokens.css beside them (exit 0)
```

The double spelling is the proposer's: a GRID root whose single row is `{fit}` (REST `layoutSizingVertical: HUG`) is mapped `primarySizing: FIXED` with a bbox, so propose emits `literals.height: fit-content` (G8) **and** `tokens.height: {imported.section-header.root.height} = 95px`. Named by the emitter, but one set's contradiction blocks the whole batch. Case: `grid-root-hug-height-fixed-conflict`.

Type-check (`tsc --noEmit`, strict, react-jsx, `*.css` declared): **1 error** — `Card.tsx(10,18) TS2430: Interface 'CardProps' incorrectly extends interface 'HTMLAttributes<HTMLDivElement>'` — the Card's second slot is named `content`, which collides with the HTML `content` attribute (string). Generated code does not compile as-is.

Render (esbuild bundle of the generated components + Playwright, deviceScaleFactor 2, white ground) vs Figma's own `/v1/images?scale=2` of the same cells — `out/side-by-side/<cell>.png` (Figma left, React right):

| cell | Figma node | verdict | what is off |
|---|---|---|---|
| `button-primary-default` | 53:2776 | **NOT recognisable** | React has no fill: white label on white inside a 1px grey rounded border. The root `fill` is `UNBOUND … no token invented` ("fill differs in state hover but is absent in some variants — a state override cannot unset a channel; NAMED, not proposed"). Figma: solid #8f8781 pill, white text. |
| `badge-sm-success` | 91:4929 | recognisable | an 8×8 green dot on both sides (ELLIPSE decor + opacity 0.8 carried). |
| `badge-default-success` | 91:4941 | same shape, missing fill | both sides are "Badge" struck through by a green line — the kit binds line-height to a variable whose value is **1.5 (PIXELS)**, so Figma itself collapses the pill to ~2px; the React side additionally has no background (`UNBOUND Badge:root fill = #b7e9c5`). The proposal's default is `size=sm` (first variant); the set's declared default is `Size=Default`. |
| `card-default` | 53:1778 | **NOT recognisable** | Figma: light-grey card, image placeholder with glyph, kicker/heading/dek (overlapping — the same 1.5px line height), a Chip, an arrow button. React: a near-transparent box (`#00000001`, the REST-resolved fill under a GLASS effect) holding one grey square. The Content slot's drawn content (Title frame → Kicker+Heading, Footer frame → Chip+Button Group) vanished — only the bare `Dek` instance survived as `defaultContent`, and the Default story does not even pass it. Vector glyphs are named unsupported. |
| `toast-default` | 86:2196 | recognisable as a toast | same grey bar, 1px border, drop shadow, 600×48, title/body (overlapping on both sides — kit line height). React has no icon glyph and no close glyph (vector geometry named unsupported; the nested Button (Icon)'s fixed `Icon` swap value is dropped silently). |

PNGs: `out/side-by-side/{button-primary-default,badge-sm-success,badge-default-success,card-default,toast-default}.png`; sources `out/figma-png/*.png`, `out/react-png/*.png`.

## 4. Accounting — the four sampled sets

Denominator: every fact on the REST node documents of the set (variants walked; instance internals counted once as the instance; set-container node excluded). Classification verified against `map.ts`, `figma-proposals.md` and the proposed contract. Full rows: `out/accounting.json`; script `out/account.mjs`.

| set | carried | named | silent | of which render-inert | wrong-name | named-but-should-carry |
|---|---|---|---|---|---|---|
| Button | 426 | 549 | 109 | 65 (50 targetAspectRatio, 15 itemReverseZIndex) | 0 | 20 (root fill, every variant) |
| Badge | 88 | 96 | 6 | 0 | 0 | 5 (root fill, Size=Default) |
| Card | 34 | 34 | 10 | 0 | 2 | 0 |
| Toast | 127 | 156 | 30 | 5 | 1 | 0 |

Per-channel (carried / named / silent) — `out/four-set-table.md` has the full table; the rows that are not all-carried:

**Button** (axes Variant×State, props Text/Slot Before/Slot After/Icon Before/Icon After): State axis → NAMED (promoted to hover/focus-visible/disabled; Active "renders identically" — true, REST Default≡Active) · boundVariables 515 NAMED (stderr) + 5 SILENT · fills 25 carried-as-value / 20 NAMED-UNBOUND (channel dropped) · swap accepts 2 NAMED (keys with no in-scope contract) · strokeAlign OUTSIDE 6 NAMED · Focus Outline ABSOLUTE 5 NAMED → inverted to `outline-*` (carried) · minHeight (bound 884:4650) 25 carried · opacity 0.5 bound (Disabled) carried · **SILENT:** `interactions` ON_HOVER→CHANGE_TO (2: `Button:Variant=Primary, State=Default`, `Variant=Danger, State=Default`; `transitionNodeID`/`transitionDuration`/`transitionEasing`) · `styles.effect` 53:3846 on the 5 Hover roots · `boundVariables.effects` (5 roots × radius/spread/color/offsetX/offsetY → VariableID:1112:1561…1565) · `overrides[].fills` on every Icon Before/Icon After instance (32; the icon colour per variant) · `itemReverseZIndex` (15, inert) · `targetAspectRatio` 16:16 on 50 icon instances (inert at fixed size).

**Badge** (Size×Variant, Text): Size=sm rows 8×8 Dot (ELLIPSE, opacity .8) carried · Size=Default rows fill NAMED-UNBOUND → no background · border-color carried per cell with the "SATURATED pair" note · **SILENT:** `propertyDefinitions.Size.defaultValue = "Default"` vs proposed default `sm` · `style.textAlignHorizontal = CENTER` on the 5 Text nodes.

**Card** (Variant Default|Inline, SLOT props Image/Content): SLOT nodes carried as slot parts; SLOT property definitions (REST `defaultValue: {guid}`, Image `preferredValues: [{COMPONENT_SET de1d1f4d…}]`) dropped by `map.ts` (typeof string check) and then **named with the wrong reason** ("REST returns componentPropertyDefinitions EMPTY for SLOT properties") · effects `[DROP_SHADOW, GLASS, BACKGROUND_BLUR]` NAMED not proposed · minWidth/maxWidth 416 (Default only) NAMED + UNBOUND · clipsContent NAMED · per-side bottom stroke on `Container/Content` (individualStrokeWeights 0/0/1/0) NAMED on stderr only, stroke absent from the dump · Inline `layoutByProp` carried · **SILENT:** `styles.effect` 55:9749 (2) · `boundVariables.effects` (2; DROP_SHADOW radius/spread/color/offsets + BACKGROUND_BLUR radius) · SLOT child FRAMEs `Content/Title` (Kicker+Heading) and `Content/Footer` (Chip+Button Group) in both variants (4) · `Inline/Container/Image` `layoutSizingVertical: FILL` (1) · `Inline/Container/Image` FIXED width 308 on a SLOT (1).

**Toast** (Variant, INSTANCE_SWAP Icon): width FIXED 600 (size.x bound 53:310) minted · minHeight 48 (bound) minted · DROP_SHADOW → box-shadow · `Content` grow carried · nested Button (Icon) `State` NAMED ("does not map through ds.button-icon's bindings") · Icon `preferredValues: []` named as "not captured in dump v1" (**wrong reason**: REST returned an empty list) · **SILENT:** `styles.effect` 53:3846 (5) · `boundVariables.effects` (5) · `overrides[].fills` on Icon/Icon (10) · `componentProperties.Icon#21315:0 = 53:3841` (INSTANCE_SWAP fixed value) on the nested Button (Icon) (5) · `targetAspectRatio` 20:20 (5, inert).

### All 15 sets — counts

| set | carried | named | silent (inert) | wrong-name | should-carry |
|---|---|---|---|---|---|
| Badge | 88 | 96 | 6 (0) | 0 | 5 |
| Button | 426 | 549 | 109 (65) | 0 | 20 |
| Button (Icon) | 31 | 43 | 8 (5) | 0 | 0 |
| Button (contract) | 225 | 290 | 60 (0) | 0 | 0 |
| Chip | 153 | 194 | 15 (0) | 1 | 0 |
| Dek | 19 | 14 | 0 | 0 | 0 |
| Heading | 296 | 294 | 44 (0) | 0 | 0 |
| Image | 9 | 9 | 0 | 0 | 0 |
| Kicker | 17 | 16 | 4 (0) | 0 | 0 |
| Button Group | 15 | 7 | 0 | 1 | 0 |
| Section Header | 27 | 30 | 4 (1) | 0 | 0 |
| Section Footer | 16 | 14 | 2 (0) | 0 | 0 |
| Toast | 127 | 156 | 30 (5) | 1 | 0 |
| Card | 34 | 34 | 10 (0) | 2 | 0 |
| Section | 19 | 13 | 3 (0) | 3 | 0 |
| **total** | **1,502** | **1,759** | **295 (76)** | **8** | **25** |

SILENT constructs across the 15 (set · channel · rows · first path):

```
Badge            axis default (Size: Default, first variant sm)                1   set.propertyDefinitions.Size.defaultValue
Badge            text textAlignHorizontal=CENTER                               5   Badge:Size=Default, Variant=Success/Text
Button           itemReverseZIndex (inert)                                    15   Button:Variant=Primary, State=Default
Button           interactions ON_HOVER→CHANGE_TO (+transitionNodeID)           2   Button:Variant=Primary, State=Default
Button           overrides[].fills (host override of icon vector fill)        32   Button:Variant=Primary, State=Default/Icon Before
Button           targetAspectRatio 16:16 (inert)                              50   Button:Variant=Primary, State=Default/Icon Before
Button           boundVariables.effects                                        5   Button:Variant=Primary, State=Hover
Button           styles.effect 53:3846                                         5   Button:Variant=Primary, State=Hover
Button (Icon)    targetAspectRatio (inert) 5 · boundVariables.effects 1 · styles.effect 1 · overrides[].fills 1
Button (contract) layoutSizingHorizontal=FIXED child FRAME 20px               30   Button (contract):…/slot-before, slot-after, icon
Button (contract) layoutSizingVertical=FIXED child FRAME 20px                 30   (same nodes)
Chip             axis default (Dismissible: True, first variant False)          1   set.propertyDefinitions.Dismissible.defaultValue
Chip             componentProperties.Icon#21315:6 INSTANCE_SWAP fixed value   10   Chip:State=Default, Dismissible=False/Button (Icon)
Chip             boundVariables.effects 2 · styles.effect 2                         Chip:State=Hover, Dismissible=False
Heading          axis default (Tag: h1 vs h6; Variant: xxl vs xs)               2   set.propertyDefinitions.{Tag,Variant}.defaultValue
Heading          text fontFamily Manrope                                      42   Heading:Tag=h6, Variant=xs/Text
Kicker           text fontFamily Manrope 2 · textAlignHorizontal=CENTER 2          Kicker:Size=Default/Kicker
Section Header   componentProperties.Items#5624:28 SLOT value {guid}           2   Section Header:Alignment=Default/Container/Button Group
Section Header   itemReverseZIndex 1 (inert) · overrides[].fills 1
Section Footer   textAlignHorizontal=CENTER 1 · Items#5624:28 SLOT value 1
Toast            boundVariables.effects 5 · styles.effect 5 · overrides[].fills 10 · targetAspectRatio 5 (inert)
Toast            componentProperties.Icon#21315:0 INSTANCE_SWAP fixed value    5   Toast:Variant=Default/Button (Icon)
Card             boundVariables.effects 2 · styles.effect 2
Card             SLOT child FRAME as design-time content                        4   Card:Variant=Default/Container/Content/Title (+Footer)
Card             layoutSizingVertical=FILL 1 · FIXED SLOT width 308px 1            Card:Variant=Inline/Container/Image
Section          SLOT child FRAME as design-time content                        3   Section:Layout=Default/Container/Section Content/Stacked
```

Wrong-name rows (8): the 6 SLOT property definitions (Card Image/Content, Button Group Items, Section Header/Content/Footer) named as "REST returns componentPropertyDefinitions EMPTY" when REST returned them; the 2 empty INSTANCE_SWAP preferredValues (Chip Icon, Toast Icon) named "not captured in dump v1" when the list is empty by design.

Named-but-should-carry (25): Button root fill (20 variants; Ghost has none → `UNBOUND`, hover differs → "cannot unset") and Badge root fill (5 Size=Default variants; Size=sm has none → `UNBOUND`). The stroke path already mints `#00000000` for absent variants ("a strokeless node is a zero-width transparent stroke"); the fill path does not, and the component loses its background.

Not counted as facts (inert REST bookkeeping, listed so nobody asks): `complexStrokeProperties: {strokeType: BASIC}` (306), `scrollBehavior`, `absoluteRenderBounds`, `background`/`backgroundColor` (legacy duplicates of `fills`), `exportSettings` (3), `constraints` on vectors (named by captureGap), `layoutAlign/layoutGrow` (duplicates of layoutSizing*). `cornerSmoothing` is 0 everywhere; `lineTypes`, `characterStyleOverrides`, `textTruncation` are empty/disabled everywhere.

## 5. Modes

Ground truth (read-only Console-MCP `figma_get_variables`, Desktop bridge, 2026-08-22): **1,025 variables in 11 collections** (the brief says 1,072/12 — the canvas today has 1,025/11; STRING 109 · FLOAT 623 · COLOR 287 · BOOLEAN 6):

```
Tier 1 | Primitive 368 vars, 1 mode (Default)         Tier 2 | Semantic 154, 1 mode          Tier 3 | Typography 138, 1 mode
Tier 1 | Theme 190, 3 modes (Default, Southleft, Brutalist)
Tier 2 | Color Scheme 51, 3 modes (Light, Dark, Accent)          Tier 2 | Shape 14, 3 (Default, Pill, Sharp)
Tier 2 | Motion 3, 3 (Default, Expressive, Reduced)               Tier 2 | Density 26, 3 (Default, Compact, Comfortable)
Tier 2 | Text Size 20, 3 (Default, Small, Large)                  Tier 2 | Depth 36, 3 (Default, Flat, Deep)
Tier 3 | Appearance 25, 6 modes (Default, Outlined, Surface, Elevated, Glass, Gradient)
```

What `captured.dtcg.json` carries per mode: **nothing — the file was not written.** The CLI receipt: `no captured variables: the dump carries no _variables channel (REST transport or a pre-v1.4 plugin dump) — the designer's variables are not in this folder; recapture with the plugin (dump v1.4+) to carry them`, and per set the read-limit note `multi-mode variable values (dump v1.6 modes): not captured on this route — only one mode's resolved values are readable, so a theme/mode axis resolves single-mode and the other modes' values are absent`. What it does not say: that the route *could* have named every binding (the REST variables endpoint answers with `file_variables:read`), that the resolved literals are the **Default** mode of each collection (Light / Default appearance / Default theme) with no mode recorded anywhere, and that Southleft/Brutalist/Dark/Accent/Pill/Sharp/Compact/Comfortable/Small/Large/Flat/Deep/Outlined/Surface/Elevated/Glass/Gradient are not merely "absent" but indistinguishable from never having existed. `minted.dtcg.json` (50 KB) is single-mode literals under `imported.*`.

## 6. Conformance cases authored (before any fix) — `extract/figma/conformance/`

`conformance/cases/` is the CSS/DOM fixture (every case needs `Case.tsx` + `case.css`; its canvas direction is declared via `dumpSnippet` and measured by `extract/figma/conformance`). The canvas-side constructs above have no CSS spelling to mount, so the cases live in the canvas-side twin, `extract/figma/conformance/` (manifest-driven, one construct each, `MANIFEST.json` is the denominator). Fourteen of the silences are in `extract/figma/rest/map.ts`, which the dump grammar cannot reach, so the runner gained one thing: a case may enter at the REST boundary as `cases/<id>.rest.json` (a `/v1/files/:key/nodes` response) and is mapped through the real `mapRestToDump`, its MapReport joining the naming union exactly as the CLI prints it. Expectations were written from the documentation model before the engine ran; observed behaviour is pinned in `observedCheck`.

| case | boundary | expect | observed (pinned) |
|---|---|---|---|
| rest-effect-style-identity | REST | LEDGERED | SILENT |
| rest-effect-bound-variables | REST | LEDGERED | SILENT |
| rest-prototype-reaction | REST | LEDGERED | SILENT |
| rest-slot-property-definition | REST | LEDGERED | WRONG-NAME ("REST returns … EMPTY") |
| rest-swap-preferred-values-empty | REST | LEDGERED | WRONG-NAME ("not captured in dump v1") |
| rest-layout-sizing-vertical-fill | REST | CARRIED (`align: stretch`) | SILENT |
| rest-child-frame-fixed-size | REST | CARRIED | SILENT |
| rest-instance-fill-override | REST | LEDGERED | SILENT |
| rest-instance-swap-fixed-value | REST | LEDGERED | SILENT |
| rest-instance-slot-prop-value | REST | LEDGERED | whole-set schema refusal |
| rest-text-font-family | REST | LEDGERED | SILENT |
| rest-text-align-center | REST | CARRIED | SILENT |
| rest-item-reverse-z-index | REST | LEDGERED | SILENT (inert) |
| rest-instance-target-aspect-ratio | REST | LEDGERED | SILENT (inert) |
| axis-default-from-set | dump | CARRIED | SILENT (first variant wins) |
| fill-absent-on-axis-value | dump | CARRIED | named UNBOUND, channel dropped |
| fill-unset-by-state | dump | CARRIED | named "cannot unset", channel dropped |
| slot-frame-child-default-content | dump | LEDGERED | SILENT |
| grid-root-hug-height-fixed-conflict | dump | CARRIED (one spelling) | double spelling → emitter refusal |

`npx tsx extract/figma/conformance/run.ts` → `135 case(s): 116 PASS, 19 RED-EXPECTED (pinned findings), 0 FAIL, 0 UNEXPECTED-GREEN, 0 UNLISTED, 0 MISSING — CANVAS CONFORMANCE: GREEN` (baseline before the cases: 116/116 PASS).

Not fixtured (no manifest can exercise HTTP): `cli.ts` dropping `classifyVariablesRefusal`'s user-fixable diagnosis; the stderr-only transport of the 1,748 map receipts.

## 7. Defects, in the order a designer would hit them

1. Button and Badge render with **no background** — the root fill is refused ("UNBOUND", "cannot unset") when one variant lacks a fill; the stroke path has the transparent-for-absent rule, the fill path does not. (`fill-absent-on-axis-value`, `fill-unset-by-state`)
2. Card content is **gone** — a SLOT's drawn content survives only when it is a bare INSTANCE; FRAME children (Title, Footer) vanish silently. (`slot-frame-child-default-content`)
3. `generate` refuses the **whole batch** because a GRID root with a fit row is spelled both `height: fit-content` and `height: {token}`. (`grid-root-hug-height-fixed-conflict`)
4. A nested instance's SLOT-typed prop value crashes exact mode (Card Grid) and is dropped in reviewable mode. (`rest-instance-slot-prop-value`)
5. The kit's 1,025 variables are unnameable on this route because the PAT lacks one scope — and the CLI calls it "Enterprise".
6. Effect styles, effect variable bindings, prototype reactions, icon-colour overrides, fixed swap values on nested instances, vertical FILL, fixed child-frame sizes, non-Inter families, text-align, declared axis defaults: silent (14 cases).
7. Generated `Card.tsx` does not type-check (slot named `content`).
8. `lineHeight: 1.5 (PIXELS)` — the kit binds line height to a variable valued 1.5; Figma renders it as 1.5px too (text overlaps on both sides). Faithful, not a defect of the engine; worth telling the kit's author.

---

## RE-MEASURED after fix rounds 1+2 — 2026-08-23

Tree: `phase-2/fix-round-1` at `4a711b55` with F4 (the dump v1.31 REST/plugin fields) applied — the commit that carries this section. Same file `aekVseUceg35tVn62knRrj`, same read-only REST route, same PAT (still without `file_variables:read`, deliberately — the comparison is like-for-like with 2026-08-22). Nothing in the engine was changed during the re-measure; the two silences it found are pinned red below, not fixed.

Artifacts (scratch, outside the tree): `…/scratchpad/f4-exam-out/` — `figma-ds.dump.json` (1,113,196 bytes, dump v1.31), `rest-cli.log`, `rest-raw-15sets.json` (re-fetched, not copied), `proposed/` (80 proposals, `figma-proposals.md`), `proposed/generated/` (78 components + `tokens.css`, generated with THIS tree's `packages/cli/dist/cli.js`; the first pass went through the mirrored `node_modules/.bin` and ran the main tree's pre-F3 CLI — kept as `proposed/generated.main-cli-pre-f3/` + `typecheck.main-cli-pre-f3.log`, renders byte-identical), `figma-png/`, `react-png/`, `side-by-side/`, `accounting.json`, `account2.mjs`, `accounting2.txt`, `four-set-table2.md`. PNGs: `side-by-side/{button-primary-default,badge-sm-success,badge-default-success,card-default,toast-default}.png`.

**Result: SILENT = 2 of 3,556** (was 295). 1,594 carried · 1,960 named · 2 silent (0 render-inert) · 0 wrong-name (was 8) · 0 named-but-should-carry (was 25). Both silences are one node — `Card:Variant=Inline/Container/Image` — and are new findings with cases; the 102 effect-binding receipts (77 on the 15 sets) are NAMED behind the token scope as predicted.

### 1. Dump — what changed on the same route

```
✔ 77 set(s) → figma-ds.dump.json          dump v1.31 · 1,113,196 bytes (was 332,960 at v1.5)
1,908 receipts, now IN the dump (`_degradations`) and repeated per set in figma-proposals.md — no longer stderr-only:
  1746 variable-unresolved · 94 vector-geometry-unsupported · 36 stroke-style-unsupported · 14 text-channel-unsupported
  · 8 instance-prop-unsupported (new: the SLOT-typed {guid} prop values) · 6 stroke-weights-nonuniform · 3 rotation-unsupported
  · 1 variables-unavailable (new, file-level, once): "/v1/files/:key/variables/local refused with HTTP 403: the token lacks the
    file_variables:read scope (NOT a plan limit — the same token reads the file). FIX: regenerate the token with file_variables:read"
_provenance.captureGaps: 7 (was 8 — instance text overrides now carry)
```

The 1,595 "Enterprise" lines are gone; the one user-fixable diagnosis is printed first, and every `variable-unresolved` row repeats it. Every binding still degrades to its Default-mode literal (the PAT was not changed).

### 2. Propose — `--reviewable-inversion`, empty corpus, empty contracts dir

```
77 sets proposed (+1 stub), 0 skipped
Button 596 notes (was 53), 0 unbound (was 1) · Badge 143 / 0 (was 1) · Card 126 / 2 (minWidth, maxWidth 416 — unchanged) · Toast 213 / 0
```

The note counts grew because the dump's receipts ride the report now; the unbound counts fell because the root fills carry (`Button:root fill: drawn in 4/5 variant(s) — the ABSENT variants mint #00000000`; Badge `5/10`). Badge's proposed default is `size=default`, the set's declared default (was the first variant, `sm`); Heading `tag=h1, variant=xxl`; Chip `dismissible=true`.

### 3. Generate, type-check, render

`npx ds-contracts generate <all 80 files> …` → **78 components generated, exit 0, first try** (was: the whole batch refused on the section-header/footer double spelling, 76 after dropping two by hand). `tokens.css`: 456 custom properties, 0 unreferenced.

Type-check: **0 errors** (was 1). `CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'content'>` — F3's prop-collision rule (`packages/core/src/prop-collision.ts`, slot names included) carries 08-22's defect #7. Instrument note: the first re-measure pass ran `npx ds-contracts generate` through the worktree's mirrored `.bin`, which resolves to the MAIN tree's pre-F3 `packages/cli/dist` — it reproduced TS2430 and a case was authored for it before the instrument was checked; re-run with this tree's CLI, the error is gone and the case was retracted. Component count (78), `tokens.css` (456) and every React PNG are byte-identical between the two CLIs.

Render (same harness as 08-22: esbuild bundle + Playwright @2x, Figma `/v1/images?scale=2` left, React right; 0 page errors):

| cell | 08-22 | 08-23 | what changed / what is still off |
|---|---|---|---|
| `button-primary-default` | **NOT recognisable** (no fill) | **recognisable** | solid #8f8781 rounded fill, white label; React 90×28 vs Figma 88×28. Nothing visibly off at this cell. |
| `badge-sm-success` | recognisable | recognisable | 8×8 green dot both sides (unchanged). |
| `badge-default-success` | same shape, missing fill | **same as Figma** | the #b7e9c5 pill fill carries; both sides still collapse to a ~2px bar under the kit's 1.5 px line height (faithful). |
| `card-default` | **NOT recognisable** | **still NOT recognisable** — but every loss is named | Figma: light-grey GLASS surface, image glyph, Kicker/Heading/Dek, Chip, arrow. React: near-white box (`#00000001` — the REST-resolved fill under GLASS; `[DROP_SHADOW, GLASS, BACKGROUND_BLUR] … channel NAMED, not proposed`) holding one grey square (vector glyph named). The Content slot's Title/Footer FRAMEs are now NAMED (`design-time content that is not a bare INSTANCE … a FRAME child has no carrier and is NAMED`); the harness passes only the Image child and the Default story passes no `content`, as on 08-22. The picture is the same; the silence is not. |
| `toast-default` | recognisable | recognisable | grey bar, 1px border, shadow, 600×48; title/body overlap on both sides (kit line height). Icon glyph absent (vector, named); close glyph absent — the nested Button (Icon)'s fixed swap is now NAMED: `fixes INSTANCE_SWAP "Icon" = "close" (53:3841, key cc1cced5…) in 5/5 variant(s) (dump v1.31 fixedSwaps)`. |

### 4. Accounting — the four sampled sets (same denominator rules; `account2.mjs` re-authors only the classification of constructs a fix moved, each rule quoting the note it now matches)

| set | carried | named | silent (inert) | wrong-name | should-carry |
|---|---|---|---|---|---|
| Button | 426 → **446** | 549 → **638** | 109 (65) → **0** | 0 | 20 → **0** |
| Badge | 88 → **99** | 96 → **91** | 6 → **0** | 0 | 5 → **0** |
| Card | 34 → **34** | 34 → **42** | 10 → **2** | 2 → **0** | 0 |
| Toast | 127 → **127** | 156 → **186** | 30 (5) → **0** | 1 → **0** | 0 |

Where each 08-22 silence went (construct · rows on the four sets · disposition now · the note):

- `interactions` ON_HOVER→CHANGE_TO (Button 2) → NAMED: `prototype reaction(s) ON_HOVER → CHANGE_TO "Variant=Primary, State=Hover" (53:2786); SMART_ANIMATE 300ms … prototype-reactions-unsupported` (dump v1.31 `reactions`).
- `styles.effect` (Button 5, Card 2, Toast 5) → NAMED: `effects ride the EFFECT STYLE "drop-shadow/default" (key a7ba60f2…) in 5/5 variant(s) — the style's resolved layers carry as box-shadow; the style IDENTITY has no token class` (`effectStyle`/`effectStyleKey`).
- `boundVariables.effects` (Button 5, Card 2, Toast 5 nodes; 48 aliases) → NAMED: `dump variable-unresolved: … effects[0].radius/spread/color/offsetX/offsetY` — behind the token scope, as every other binding.
- `overrides[].fills` (Button 32, Toast 10) → NAMED: `host override(s) on nested "arrow-left" internals — "Vector" fills = #f7f6f5 in 1/5 variant(s) [Variant=Primary] …` (`hostOverrides`).
- `targetAspectRatio` (Button 50, Toast 5; inert) → NAMED: `aspect-ratio lock 16 / 16 … on a nested instance — … the lock acts on resize`.
- `itemReverseZIndex` (Button 15; inert) → NAMED: `itemReverseZIndex is true in 3/5 variant(s) — paint order reversed … render-inert unless children overlap … NAMED, not carried`.
- Badge `propertyDefinitions.Size.defaultValue` → CARRIED (`prop size: the set's DECLARED default for "Size" is "Default" … the proposal's default follows the declared default`).
- Badge `textAlignHorizontal=CENTER` (5) → CARRIED (`carried as declared text-align: center`; `text.textAlign`).
- Card SLOT child FRAMEs Title/Footer (4) → NAMED (quoted above).
- Toast `componentProperties.Icon#21315:0` fixed swap (5) → NAMED (quoted above).
- Card `Inline/Container/Image` `layoutSizingVertical: FILL` (1) → **still SILENT** — the dump now carries `fillHeight: true` on the SLOT, but the proposed slot part has no layout block, no `height: 100%`, no note. Cause (core/propose-figma.ts `carryCrossAxisFill`): the Container is a COLUMN in Default and a ROW in Inline, so the function returns at `mixed parent modes — crossAxisFillByProp's door`, and `crossAxisFillByProp` requires every occurrence to be `fillWidth` (it spells WIDTH per variant only). Case `layout-fill-height-parent-mode-by-variant`.
- Card `Inline/Container/Image` FIXED width 308 on a SLOT (1) → **still SILENT** — `nameFixedChildGeometry` (the FC-GEOMETRY-EXCLUDED receipt, which does fire for Button (contract)'s 20×20 frames, 60 rows) skips the width axis when ANY occurrence has `fillWidth` (`if (dim === 'width' && m.occ.some((o) => o.node.fillWidth === true)) continue;`); the Default variant fills, so the Inline occurrence's FIXED px is never receipted. Case `slot-fixed-width-by-variant`.

Wrong-name (was 8) → 0: the six SLOT definitions are read and named by content (`slot "Image" preferredValues name 1 component key(s) with no in-scope contract …`; `slot "Content" SLOT preferredValues is EMPTY ([]) — an UNCONSTRAINED swap by the designer's own declaration`); the two empty INSTANCE_SWAP lists say `EMPTY ([]) — UNCONSTRAINED` instead of "not captured in dump v1". Named-but-should-carry (was 25) → 0: both root fills carry, the absent variants minting `#00000000`.

### All 15 sets — counts (08-22 → 08-23)

| set | carried | named | silent (inert) | wrong-name | should-carry |
|---|---|---|---|---|---|
| Badge | 88 → 99 | 96 → 91 | 6 → 0 | 0 | 5 → 0 |
| Button | 426 → 446 | 549 → 638 | 109 (65) → 0 | 0 | 20 → 0 |
| Button (Icon) | 31 → 31 | 43 → 51 | 8 (5) → 0 | 0 | 0 |
| Button (contract) | 225 → 225 | 290 → 350 | 60 → 0 | 0 | 0 |
| Chip | 153 → 154 | 194 → 208 | 15 → 0 | 1 → 0 | 0 |
| Dek | 19 | 14 | 0 | 0 | 0 |
| Heading | 296 → 340 | 294 → 294 | 44 → 0 | 0 | 0 |
| Image | 9 | 9 | 0 | 0 | 0 |
| Kicker | 17 → 21 | 16 → 16 | 4 → 0 | 0 | 0 |
| Button Group | 15 | 7 | 0 | 1 → 0 | 0 |
| Section Header | 27 → 37 | 30 → 24 | 4 (1) → 0 | 0 | 0 |
| Section Footer | 16 → 18 | 14 → 14 | 2 → 0 | 0 | 0 |
| Toast | 127 → 127 | 156 → 186 | 30 (5) → 0 | 1 → 0 | 0 |
| Card | 34 → 34 | 34 → 42 | 10 → 2 | 2 → 0 | 0 |
| Section | 19 → 19 | 13 → 16 | 3 → 0 | 3 → 0 | 0 |
| **total** | **1,502 → 1,594** | **1,759 → 1,960** | **295 (76) → 2 (0)** | **8 → 0** | **25 → 0** |

Every 08-22 row was re-classified by one of: a landed fix (293 SILENT rows: 56 → CARRIED — axis defaults 4, fontFamily Manrope 44, textAlign 8; 237 → NAMED — FIXED child frames 60, targetAspectRatio 60, host overrides 44, itemReverseZIndex 16, effect bindings 15, effect styles 15, fixed swaps 15, SLOT child frames 7, SLOT-typed prop values 3, reactions 2), the fill rule (25 NAMED → CARRIED), or — 11 rows in Section Header, an instrument note — `componentProperties` on nested Kicker/Heading/Dek/Button Group that 08-22's heuristic flagged NAMED because one "does not map through" note (the Button Group's SLOT-typed `Items`) mentioned the node; that prop is now an `instance-prop-unsupported` receipt and the others `canonicalized through ds.*'s bindings`. `account2.mjs` also stops the min/max-width heuristics from matching the binding receipts that now ride the report (they read notes, not receipts). Denominator unchanged at 3,556.

### 5. Modes — unchanged

Still 1,025 variables / 11 collections on the canvas; `captured.dtcg.json` still not written; every literal is still the Default mode of its collection with no mode recorded. What changed is only that the refusal now names its cause and its fix once, at file level, instead of calling it Enterprise 1,595 times.

### 6. Cases

The 19 cases authored on 08-22 are all green (re-recorded by F1–F4 and the propose rounds; their `observed` fields carry the closure). This re-measure adds two, pinned red (`status: "red"`, `observedCheck` pins the silence):

| case | boundary | expect | observed (pinned) |
|---|---|---|---|
| slot-fixed-width-by-variant | dump | LEDGERED (FC-GEOMETRY-EXCLUDED receipt on the FIXED occurrence) | SILENT — `nameFixedChildGeometry` skips the axis when any occurrence fills |
| layout-fill-height-parent-mode-by-variant | dump | LEDGERED (the HUG-parent FILL-height note, per variant) | SILENT — `carryCrossAxisFill` returns on mixed parent modes; `crossAxisFillByProp` spells width only |

`npx tsx extract/figma/conformance/run.ts` → `150 case(s): 148 PASS, 2 RED-EXPECTED (pinned findings), 0 FAIL, 0 UNEXPECTED-GREEN, 0 UNLISTED, 0 MISSING` (before this re-measure: 148/148 PASS). `accuracy/grammar.json` canvas denominator: 150 (CARRIED 103 · LEDGERED 38 · REFUSED 9).

### 7. What remains, in the order a designer hits it

1. The kit's 1,025 variables are still unnameable on this route until the PAT gains `file_variables:read` — the CLI now says exactly that, once, with the fix. The 102 effect-binding receipts dump-wide (77 on these 15 sets) sit behind the same scope.
2. Card is still not recognisable in the harness cell: the GLASS/BACKGROUND_BLUR surface is named-not-proposed (the resolved fill is `#00000001`), the vector glyphs are named, and the Default story passes no content. All named; none carried.
3. The Card Inline Image SLOT's `fillHeight` and FIXED 308px are the two silences left on the 15 sets (cases above).
4. `lineHeight: 1.5 (PIXELS)` — the kit's own authoring; faithful on both sides.

---

**Addendum 2026-08-23 (`phase-2/exam-close`, r9 round 2 + r10).** The two
silences named above (the Card Inline Image SLOT's FIXED 308px and its
`fillHeight` under mixed parent modes) are closed — both hold green in
`npm run conformance:canvas` (152 cases · 152 PASS · 0 RED-EXPECTED; two
cases added for the same SLOT's primary-axis FILL, now carried as
`layout.grow`). The numbers in this receipt are the last re-measure and are
not re-run here; docs/23 §D.29 carries the closes and their gates, §B.24 the
one fact left named on that node (the slot's interior auto-layout).
