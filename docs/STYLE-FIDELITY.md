# STYLE-FIDELITY MATRIX — every style channel, audited end-to-end

The owner mandate behind this document: *"tooltip placement was just an
example — larger styling issues need investigating: pulling from code OR
Figma, we must render styles along with the component."* The alpha bug
(Eventz 5%-black fills minting opaque black) proved the failure mode is
**silent loss in capture**, not pipeline unfaithfulness — the fidelity-matrix
scorecard measured 0 value mismatches across 334 fact-cells *relative to what
the dump carries*. This audit enumerates what the dump (and the code
extractor) do NOT carry, channel by channel, and classifies each one.

**Classification vocabulary** (the only four verdicts):

| verdict | meaning |
|---|---|
| **OK** | captured, proposed as a real binding, rendered on every surface |
| **MINTED** | captured; no token name recoverable, so the value binds to a provisional `imported.*` token at literal fidelity |
| **NAMED-GAP** | dropped, but with a receipt — a degradation entry or a proposal note that names the channel and the node |
| **SILENT-LOSS** | dropped without any receipt — **the enemy**; every entry in this class is a bug |

Surfaces audited per channel: capture (`extract/figma/dump.plugin.js` +
`extract/figma/rest/map.ts`, dump schema `extract/figma/types.ts`), proposal
(`core/propose-figma.ts` + `core/extract-css-module.ts`), minting
(`core/mint-tokens.ts` + `core/mint-code.ts`), and the four render surfaces
(`core/emit-html.ts`, `core/emit-react.ts`, `core/emit-react-inline.ts`,
`core/emit-figma-script.ts` = canvas preview).

Statuses below: **before** = dump v1.1 as scored in
`extract/fidelity-matrix/SCORECARD.md` (2026-07-09 addendum); **after** = this
audit's fix branch. Every SILENT-LOSS either becomes an implementation or a
named degradation — zero remain.

## A. FIGMA side — canvas channels

| # | channel | captured (plugin / REST) | proposed / minted | rendered (html · react · inline · canvas) | before | after |
|---|---------|--------------------------|-------------------|--------------------------------------------|--------|-------|
| A1 | solid fill + alpha | yes (dump v1.1 `{hex, alpha}`) | bound→ref; raw→minted 8-digit hex | all four (canvas: RGBA variable) | OK / MINTED | OK / MINTED |
| A2 | solid stroke + alpha, uniform weight | yes | `border-color` / `border-width` | all four (canvas strokeAlign INSIDE) | OK / MINTED | OK / MINTED |
| A3 | **node opacity** | **no** — Eventz disabled variants ride `opacity: 0.4` on the variant root; dump v1.1 has no field | — | — | **SILENT-LOSS** | **OK / MINTED** — dump v1.2 `opacity` field (both captures); uniform/enum-correlated → minted unitless `number` token on `tokens.opacity`; boolean-axis-correlated → `stylesWhen { prop, styles: { opacity } }` (the existing literal-CSS vocabulary); canvas applies node opacity |
| A4 | gradient fills/strokes | REST: no + `paint-unsupported` degradation; plugin: no, **silent** | — | — | NAMED-GAP (REST) / **SILENT-LOSS** (plugin) | NAMED-GAP — plugin dump gains a `_degradations` channel with the same code |
| A5 | image fills | same as A4 | — | — | NAMED-GAP / **SILENT-LOSS** (plugin) | NAMED-GAP (both captures) |
| A6 | additional paints beyond the first visible solid | **no — silently ignored in both captures** (only the first visible solid is read) | — | — | **SILENT-LOSS** | NAMED-GAP — `paint-stack-truncated` degradation when >1 visible paint |
| A7 | effects: **drop shadow** | **no** | — | — | **SILENT-LOSS** | **MINTED** — dump v1.2 `effects` (single visible drop shadow → `{offsetX, offsetY, radius, spread, color{hex,alpha}}`); minted as a `box-shadow` CSS value token; CSS surfaces render it; canvas names the limit at proposal |
| A8 | effects: inner shadow / layer blur / background blur / multiple shadows | **no** | — | — | **SILENT-LOSS** | NAMED-GAP — `effect-unsupported` degradation naming the effect type |
| A9 | blend modes (node + paint) | **no** | — | — | **SILENT-LOSS** | NAMED-GAP — `blend-mode-unsupported` degradation when ≠ NORMAL/PASS_THROUGH |
| A10 | corner radius, uniform | yes | `border-radius` | all four | OK / MINTED | OK / MINTED |
| A11 | corner radius, per-corner | REST: `radii-nonuniform` degradation; plugin: `figma.mixed` → **silent** | — | — | NAMED-GAP / **SILENT-LOSS** (plugin) | NAMED-GAP (both captures) |
| A12 | per-side stroke weights (literal) | REST: `individualStrokeWeights` unread → **silent**; plugin: `figma.mixed` → **silent** (bound per-side weights ARE mapped; propose requires uniformity, notes otherwise) | — | — | **SILENT-LOSS** | NAMED-GAP — `stroke-weights-nonuniform` degradation |
| A13 | stroke align ≠ INSIDE, dash pattern | **no** (canvas emitter always writes INSIDE) | — | — | **SILENT-LOSS** | NAMED-GAP — `stroke-style-unsupported` degradation |
| A14 | auto-layout (direction/justify/align/spacing/padding/sizing), merged | yes | layout block + padding/gap tokens | all four | OK | OK |
| A15 | **per-variant layout differences** (tooltip placement class) | yes (per-variant trees) | **collapsed to the default variant's** with a note | — | NAMED-GAP (severe — placement inert) | **OK** — axis-correlated differences propose `layoutByProp` (existing v7 vocabulary; reversed child order → `row-reverse`/`column-reverse`); uncorrelated differences keep the note |
| A16 | **per-variant literal padding/spacing/radius/stroke-weight when the DEFAULT variant's value is zero/absent** | yes | **unbound/mint trigger read the default variant only** → Arrow Wrapper 16px inline padding ×6 scored MISSING | — | **SILENT-LOSS** (no receipt on the 6 variants) | **MINTED** — triggers scan all variants; per-axis values mint per-value leaves |
| A17 | fill-width (grow / align:stretch evidence) | yes | `layout.grow` / `align: stretch` | all four | OK | OK |
| A18 | bound min-width / width / height / opacity variables | yes (`bound`) | consumed | all four | OK | OK |
| A19 | other bound variables (maxWidth, minHeight, maxHeight, …) | yes (`bound`, generic) | **dropped without a note** | — | **SILENT-LOSS** | NAMED-GAP — propose notes every unconsumed `bound` field by name |
| A20 | literal min/max sizing | **no** (fields unread in both captures) | — | — | **SILENT-LOSS** | NAMED-GAP — `min-max-size-unsupported` degradation when present |
| A21 | text: characters, fontSize, weight (via Inter style), named TextStyle, fill | yes | token identity match or minted font-size | all four | OK / MINTED | OK / MINTED |
| A22 | text: lineHeight, letterSpacing, textCase, textDecoration, textAlign | **no** | — | — | **SILENT-LOSS** | NAMED-GAP — `text-channel-unsupported` degradation naming each non-default channel |
| A23 | text: font family | no — declared fidelity scope (everything renders Inter) | — | — | NAMED-GAP (documented) | NAMED-GAP |
| A24 | vectors / rotation (#42: tooltip arrows) | type captured, geometry not; rotation unread | leaf part with paint, no shape | arrows invisible | **SILENT-LOSS** (rotation) / NAMED-GAP (#42 documented) | NAMED-GAP — `vector-geometry-unsupported` + `rotation-unsupported` degradations; #42 stays documented, not built |
| A25 | clipping (`clipsContent`) | no | — | — | SILENT-LOSS (benign — frames default to clip; no observed damage) | NAMED-GAP (documented here; no per-node receipt — no observed field case) |
| A26 | instance internals (dump stops at instance boundaries) | declared limit | child contract / STUB owns them | per child contract | NAMED-GAP (documented, scorecard gap 7) | NAMED-GAP |
| A27 | INSTANCE_SWAP preferredValues (slot `accepts`) | no (declared) | noted | — | NAMED-GAP | NAMED-GAP |

## B. CODE side — CSS/JSX channels (`core/extract-css-module.ts`)

| # | channel | read | proposed / minted | before | after |
|---|---------|------|-------------------|--------|-------|
| B1 | `prop: var(--x)` single-var declarations (ANY property) | yes | token ref (unique tokenization) / foreign var → minted | OK / MINTED | OK / MINTED |
| B2 | tokenizable literals (colors, dimensions, numbers) | yes | RawValueFinding + minted | MINTED | MINTED |
| B3 | `padding` / `border` shorthands | expanded to longhands | bound | OK | OK |
| B4 | **`outline` shorthand on `:focus-visible`** (`outline: 2px solid var(--x)`) | **dropped** — "var() inside a shorthand" note; the focus ring vanished from the CBDS convergence diff | — | NAMED-GAP (scorecard punch 4, half) | **OK / MINTED** — outline expands to `outline-width` + `outline-color`; `outline-offset` rides the generator boilerplate |
| B5 | `:hover` / `:focus-visible` / `:disabled` root rules (incl. `:not()` state guards) | yes | `states.*` + state minting | OK / MINTED | OK / MINTED |
| B6 | **`:active` root rules** (`&:active:not(:disabled)`) | **dropped** — "pseudo is not a contract state" note; pressed fills one-sided in the convergence diff | — | NAMED-GAP (scorecard punch 4) | **OK / MINTED** — `active` joins the contract state vocabulary (schema, all emitters `:active:not(:disabled)`, extractor, minting) |
| B7 | state rules on nested parts | no — root-level states only | note | NAMED-GAP | NAMED-GAP |
| B8 | enum-modifier classes (incl. BEM) → substituted refs | yes | template inference / per-value minting | OK / MINTED | OK / MINTED |
| B9 | boolean-modifier classes | no | note (stylesWhen is authored, not inverted) | NAMED-GAP | NAMED-GAP |
| B10 | media queries / @supports / @container | no | named at-rule skip note | NAMED-GAP | NAMED-GAP |
| B11 | transitions, transforms | no | "no inversion rule" note | NAMED-GAP | NAMED-GAP |
| B12 | other shorthands (margin, font, background, inset) | no | var-in-shorthand / no-inversion-rule notes | NAMED-GAP | NAMED-GAP |
| B13 | non-CSS-module classNames (tailwind/plain strings) | no | named note | NAMED-GAP | NAMED-GAP |
| B14 | icon glyph sizing (`.x svg`), inline SVG glyphs | no | named review note | NAMED-GAP | NAMED-GAP |

## C. Render surfaces — where a proposed binding can still die

| # | channel | html | react | inline | canvas (figma-script) | verdict |
|---|---------|------|-------|--------|------------------------|---------|
| C1 | arbitrary token keys (opacity, box-shadow, line-height, min-height…) | generic `prop: var(--path)` | generic | generic (resolved literal) | **whitelist** — `applyTokens` maps ~15 keys; anything else silently skipped | canvas skip is a NAMED-GAP **at proposal** (mint notes name the canvas limit for box-shadow); node opacity joins the whitelist |
| C2 | `layoutByProp` | per-value modifier classes | descendant rules | per-variant style merge | resolved per compiled variant (incl. reversed child order) | OK |
| C3 | `stylesWhen` | data-attr / enum-class rules | same | inline condition | resolved per compiled variant for enum `equals` and boolean defaults (this audit); boolean-true combos are not compiled — documented | OK / NAMED-GAP (canvas booleans) |
| C4 | `states.*` overrides | pseudo rules | pseudo rules | `disabled` only (honest static) | opt-in state previews (figmaStatePreviews) | OK |
| C5 | focus ring (outline pair) | boilerplate + `outline-color` token | same | not rendered (static) | approximated as bound stroke in state previews (documented) | OK / NAMED-GAP |

## Silent-loss census

**Before this audit** (dump v1.1): A3 node opacity, A4–A5 plugin paints,
A6 paint stacks, A7–A8 effects, A9 blend modes, A11 plugin per-corner radius,
A12 per-side stroke weights, A13 stroke align/dash, A16 per-variant literal
triggers, A19 unconsumed bound fields, A20 literal min/max sizing, A22 text
channels, A24 rotation — **13 silent-loss channels**.

**After**: **0**. Four became implementations (A3 opacity, A7 drop shadow,
A15+A16 per-variant layout/values — plus B4/B6 on the code side); the other
nine became named degradations in BOTH captures (`extract/figma/rest/map.ts`
codes, mirrored by the plugin dump's `_degradations` channel).

## Ranked remaining named gaps

1. **Instance boundary** (A26) — nested internals invisible; STUBs keep emit
   alive but child styling needs the child set imported. Largest fidelity
   ceiling left.
2. **#42 vector geometry** (A24) — tooltip arrows still invisible; a
   bounding-box triangle is the cheapest next step, deliberately not built.
3. **Canvas token-key whitelist** (C1) — box-shadow, line-height, min-height
   don't reach the canvas; each is named at proposal.
4. **Multi-shadow / inner-shadow / blur effects** (A8).
5. **Text channels** (A22) — lineHeight/letterSpacing/textCase/decoration;
   dump v1.3 candidates, now receipted.
6. **Gradients & images as CSS values** (A4–A5) — capturable into CSS
   `linear-gradient()` / `url()` mints later; degradations carry the stops.
7. **Nested-part states, boolean-conditional styling, media queries**
   (B7/B9/B10) — authored vocabulary exists (stylesWhen), inversion does not.
8. **Blend modes** (A9) — no contract vocabulary; named only.
9. **Stroke align/dash, min/max literal sizing, rotation** (A13/A20/A24) —
   named; low observed damage.
