# Phase B receipt — live sync into "Polaris Contracts" (fileKey `W33Bzm5U58mcQHSCgEB7X8`)

Run date: 2026-07-18 (bridge session connected 2026-07-19T01:50Z UTC). Target file verified by
fileKey via `figma_get_status` before every write batch AND by an in-script guard
(`figma.fileKey`/`figma.root.name` check) prepended to every executed script. The bridge target
was pinned (`figma_navigate lock:true`) after one mid-session reconnect flipped the active file
to an unrelated file; no write ever ran while the wrong file was active.

Delivery channel: scripts served read-only over `http://localhost:9230` (a port the Desktop
Bridge plugin manifest allows) with CORS headers; each `figma_execute` call fetches the
committed script byte-for-byte and evaluates it. Committed scripts were NOT edited.

## Pre-state

Blank file confirmed by probe before any write: 1 page ("Page 1", 0 children), 0 variable
collections, 0 local variables.

## 00-tokens.figma.js — token variable upsert

| check | expected | actual |
|---|---|---|
| Primitives collection (mode "Value") | 403 variables | 403 |
| Brand collection | 0 variables (empty, emitted by script) | 0 |
| Semantic collection | 0 variables (empty, emitted by script) | 0 |
| Text styles | 0 | 0 |
| Total local variables | 403 | 403 |

403 = 453 wrapped tokens − 50 named exclusions (COMPILE-RECEIPT.md lists all 50 by name).

Spot-checks (resolved Figma value vs. `tokens/polaris-light.dtcg.json`, rem×16 per the
documented conversion):

| variable | tokens JSON value | Figma resolved | match |
|---|---|---|---|
| `p/border-radius-100` | `0.25rem` | FLOAT 4 | yes |
| `p/color-bg-fill` | `rgba(255, 255, 255, 1)` | COLOR {1,1,1,1} | yes |
| `p/color-backdrop-bg` | `rgba(0, 0, 0, 0.71)` | COLOR {0,0,0,0.71} | yes |
| `p/space-400` | `1rem` | FLOAT 16 | yes |
| `p/font-size-325` | `0.8125rem` | FLOAT 13 | yes |
| `p/height-2000` | `5rem` | FLOAT 80 | yes |

### NAMED DEVIATION — hexToRgb execution shim (engine bug, filed, script not edited)

The emitted script's `hexToRgb` parses only `#rrggbb`, but all 224 COLOR primitives in the
committed script carry Polaris values verbatim as `rgba(r, g, b, a)` strings. First live run
failed on `setValueForMode` with NaN r/b (the headless gates cover the referee and the canvas
compile of component scripts — the token upsert had never touched the real Variables API).
Fix applied as an **in-flight shim**: the execute wrapper string-replaces the `hexToRgb`
function in the fetched source with a parser accepting both `rgba()` and hex (alpha
preserved), verified-applied or the run aborts before eval. The committed file is untouched;
all 224 COLOR values parsed (validated locally against `rgba()`/hex regex, 0 unparseable).
**Engine finding to file**: `core/emit-figma-script.ts` `buildTokensScript` emits a hex-only
color parser while DTCG-wrapped sets may carry `rgba()` strings. (Engine is out of scope for
this run per owner instruction.)

The first (failed) run had already created 21 variables before throwing; the upsert is
idempotent by name and the successful re-run completed the set (created 382, total 403).

## Component sync runs

All 10 committed component scripts executed. Each run: fileKey guard → fetch committed script
byte-for-byte from localhost → eval → probe (set exists, variant count vs COMPILE-RECEIPT.md,
bound-variable names resolved) → screenshot export → commit. Node ids/keys are from the live
file.

| script | set name | page | node id | set key | variants expected/actual | distinct bound names expected/actual | screenshot |
|---|---|---|---|---|---|---|---|
| spinner.figma.js | Spinner | Spinner | 1:415 | 64a68888dff779bf1e9b812f59d7b053521a4eb6 | 2 / 2 | 0 / 0 | spinner-set.png |
| badge.figma.js | Badge | Badge | 1:417 | 8de44e9aeda2d39d0d3ba73356c74508a3139729 | 1 / 1 | 5 / 5 | badge-set.png |
| tag.figma.js | Tag | Tag | 1:420 | de18cd6ace2063f7ffbfad6ded24a734b496332d | 1 / 1 | 3 / 3 | tag-set.png |
| checkbox.figma.js | Checkbox | Checkbox | 1:425 (retry) | f932cd0efafe7bce30894a4d5e45ff3360abe456 | 1 / 1 | 2 / 2 | checkbox-set.png |
| radio-button.figma.js | RadioButton | RadioButton | 1:428 | a4166d93901bb499f42a2336e874b1904fb0d899 | 1 / 1 | 4 / 4 | radiobutton-set.png |
| avatar.figma.js | Avatar | Avatar | 1:441 | 6d9ee0dca8941ac890ddd298262ae44a64de4105 | 5 / 5 | 1 / 1 | avatar-set.png |
| thumbnail.figma.js | Thumbnail | Thumbnail | 1:447 | 51049763237181843849b916a54c757f00b499e6 | 4 / 4 | 2 / 2 | thumbnail-set.png |
| banner.figma.js | Banner | Banner | 1:461 | 311a064e79a7a7434a21d0c2322d9f283eb74682 | 4 / 4 | 8 / 8 | banner-set.png |
| progress-bar.figma.js | ProgressBar | ProgressBar | 1:487 | e9a57a982c434dee1d4cc7313b4bf90128da123f | 12 / 12 | 6 / 6 | progressbar-set.png |
| button.figma.js | Button | Button | 1:689 | 022d0b95282749f126f180014103debc7055bfe5 | 200 / 200 | 3 / 3 (sampled over 20 variants) | button-set.png |

Text and TextField were NOT run (variant explosion — axis-curation owner decision pending,
per COMPILE-RECEIPT.md).

### NAMED DEVIATION 2 — shape-branch stroke shim (checkbox + radio-button only)

First checkbox run built silently WITHOUT its spec'd stroke: the emitted `buildNode` shape
branch applies `spec.fill` but ignores `spec.stroke` and `spec.bindings` (strokeWeight,
radii). Verification caught it (0 bound names vs 2 expected). Fix-and-retry once: the broken
node (1:423) was deleted and the script re-run with an in-flight shim that adds the two
missing lines to the shape branch (same `boundPaint`/`need` helpers the script itself uses for
frames — no new semantics). A local scan proved exactly two scripts carry stroked shapes
(checkbox, radio-button); the shim was applied to those two runs only. Committed scripts
untouched. **Engine finding to file**: shape branch of the emitted `buildNode` in
`core/emit-figma-script.ts` drops `spec.stroke`/`spec.bindings`.

### NAMED DEVIATION 3 — checkbox backdrop default-fill artifact cleared

`figma.createRectangle()` ships a default gray (#D9D9D9) fill; the checkbox contract carries
NO fill channel for the backdrop (truth table rows: border-width, border-color only), so the
default gray was a canvas artifact, not contract data. Cleared to no-fill on the live node to
match the contract's carried channel set. Same engine finding (shape branch should clear
default paint when `spec.fill` is absent).

## Presentation layer

Owner mid-run requirement: Polaris components must read against a light surface, not the dark
canvas. Each component page received a labeled "Surface — <Set>" frame placed BEHIND the set
(z-index 0, never reparenting the set): fill bound to `p/color-bg-fill` (white), title text
bound to `p/color-text`, subtitle bound to `p/color-text-secondary` — the surface chrome
itself rides the imported Polaris variables. Surface node ids: Spinner 1:690, Badge 1:693,
Tag 1:696, Checkbox 1:699, RadioButton 1:702, Avatar 1:705, Thumbnail 1:708, Banner 1:711,
ProgressBar 1:714, Button 1:717.

## Canvas resolution vs Phase A truth table (receipts/truth-table.json)

Default/first variant of every set probed on canvas; resolved values compared to the
truth-table "ours" values (the Phase A verified rendering). Figma floats ×255, rounded.

| component | channel checks (canvas resolved vs truth-table ours) | verdict |
|---|---|---|
| badge | bg rgba(0,0,0,0.06) ✓, radius 8 ✓, padding 2/8 ✓, label rgb(97,97,97) ✓ | MATCH |
| tag | bg rgb(227,227,227) ✓, radius 8 ✓, label rgb(48,48,48) ✓ | MATCH |
| checkbox | strokeWeight 0.66 ✓ (contract value; Phase A browser rounds to 1px), stroke rgb(138,138,138) ✓ | MATCH (contract side) |
| radio-button | bg rgb(253,253,253) ✓, radius 9999 ✓, strokeWeight 0.66 ✓, stroke rgb(138,138,138) ✓ | MATCH |
| avatar | initials fill rgb(255,255,255) ✓, font-size 16 ✓ — root bg NOT carried (see divergence A) | PARTIAL — named |
| spinner | glyph vector #000 vs truth-table ours rgb(48,48,48) (see divergence B) | DIVERGES — named |
| thumbnail | bg rgb(255,255,255) ✓, radius 8 ✓ (radius-150 on XS variant per spec) | MATCH |
| banner (Tone=Info) | bg rgb(145,208,255) ✓, title rgb(0,33,51) ✓ (all 8 tone bindings verified by name) | MATCH |
| progress-bar | track bg rgb(227,227,227) ✓, radius 4 ✓, indicator rgb(145,208,255) ✓ | MATCH |
| button (default variant) | radius 8 ✓, gap 2 ✓, bg white (default paint, coincides with `p.color-bg-fill`; only primary variants carry a bound fill — 3 distinct names by design) | MATCH (carried channels) — see divergence C |

### Named canvas divergences vs Phase A rendering

- **(A) avatar root background**: the Figma script carries exactly 1 binding (initials text
  fill) per COMPILE-RECEIPT; the root has no bg fill (Polaris derives avatar bg from a
  name-hash palette — refused by name in PROMOTION.md; Phase A HTML carried the base
  `p.color-avatar-bg-fill` and STILL mismatched Shopify 2 rows for the same reason). On the
  white surface the white initials are invisible. Faithful to the committed compile; visually
  divergent from Phase A ours.
- **(B) spinner glyph color**: the SVG glyphs bake `#000`; the script declares 0 bound
  variables (per COMPILE-RECEIPT), so the canvas cannot carry `p.color-bg-fill-brand`
  (#303030) the way Phase A HTML did. Visually near-identical (black vs near-black), but the
  channel is not variable-driven on canvas.
- **(C) button labels/size**: button variants have NO children in the committed spec
  (composition-owned typography refused; size paddings named-lost to the one-tokensByProp
  schema limit). The 200 variants render as empty rounded rectangles hugging their auto-layout
  defaults — the honest compile of what the contract carries. Phase A HTML screenshots show
  labeled buttons because HTML verification supplies slot content at render time.

## Screenshot review loop — canvas vs Phase A "ours" (receipts/<component>/*.png)

Every set was exported OVER its light surface (composite: surface + label + set) to
`receipts/canvas/<component>-set.png` and compared against the Phase A generated-HTML
screenshots. Note: the sets were reparented INTO their surface frames for this (component/set
keys are stable under reparenting — keys recorded above were re-confirmed after the move).

| component | canvas-vs-Phase-A verdict |
|---|---|
| spinner | MATCH — both glyph sizes render; glyph is #000 vs Phase A #303030 (divergence B, ~invisible) |
| badge | MATCH — gray pill, rounded, secondary text, correct paddings |
| tag | MATCH — gray "Wholesale" pill, radius, primary text |
| checkbox | MATCH — bordered 20×20 box (after deviation 3 cleared the default-gray artifact) |
| radio-button | MATCH — bordered circle, near-white input surface |
| avatar | NAMED DIVERGENCE (A) — canvas has no root bg (white initials invisible on light surface); Phase A HTML carried `p.color-avatar-bg-fill`. Cross-generator carry gap: the HTML generator carries a channel the Figma emitter does not (COMPILE-RECEIPT says 1 bound name for avatar — the emit-time carry set differs from the HTML generator's). Engine finding to file. Annotated on canvas. |
| thumbnail | MATCH on carried channels (white bg + radius render; invisible against white surface — Phase A's gray block is the empty image slot placeholder, not a carried channel). Annotated on canvas. |
| banner | MATCH on carried channels — all 4 tone bg/text pairs correct; no padding/stacked layout on canvas (padding was never a carried channel in Phase A either) |
| progress-bar | PARTIAL — all tone colors + radius correct and bound; geometry diverges by name: track heights are `--pc-*` literal refusals and the indicator renders full-width (progress % is a runtime prop). Annotated on canvas. |
| button | MATCH on carried channels — radius 8, gap 2, primary variants dark `p/color-bg-fill-brand`; labels are composition-owned typography (named refusal) so variants render as empty rounded rects; secondary/tertiary are white-on-white (`p.shadow-button` is a named token exclusion). Annotated on canvas. |

Canvas annotations: Avatar, Thumbnail, Button, ProgressBar surfaces carry an 11px
"refusal-note" text (bound to `p/color-text-secondary`) naming the refusal that explains
their appearance, so the canvas is self-documenting.

## Token determinism ruling (owner question, answered mid-run)

The MCP's own `figma_import_tokens`/`figma_setup_design_tokens` tools were NOT used. The
committed `00-tokens.figma.js` is the deterministic import: 453 wrapped tokens → 403
variables (50 named exclusions), identity-marker upsert (re-runnable, byte-derived from
`tokens/polaris-light.dtcg.json`). The MCP stayed transport-only (`figma_execute`,
screenshots, status).

## Final file state

- Pages: "Page 1" (empty), then one page per component (Spinner, Badge, Tag, Checkbox,
  RadioButton, Avatar, Thumbnail, Banner, ProgressBar, Button), each containing exactly one
  "Surface — <Set>" frame with the component set inside. No stray Utilities sections, no
  orphaned nodes.
- Variables panel: Primitives (mode "Value") 403 · Brand (mode "Default") 0 · Semantic
  (modes "Light"/"Dark") 0 — 403 local variables total. (Brand/Semantic are empty collections
  the generic token script emits; noted, not removed.)
- File version (REST): latest autosave id `2377701369387317215` at 2026-07-19T01:58:46Z
  (user TJ Pitre) — mid-run save; run completed ~02:09Z.
- Screenshots committed under `receipts/canvas/` (10 files, ~200KB total): avatar-set.png,
  badge-set.png, banner-set.png, button-set.png, checkbox-set.png, progressbar-set.png,
  radiobutton-set.png, spinner-set.png, tag-set.png, thumbnail-set.png — each is the
  composite surface+set export.

## Gates

- `npm run eval`: **103/103 passed**, `evals/results.json` byte-unchanged (verified via git).
  (A first eval attempt in the worktree failed environmentally — no `node_modules` symlink —
  and was discarded; nothing in engine/contracts/evals was modified by this run.)
- `npx tsc --noEmit`: green (exit 0).
- Nothing deployed. All changes confined to `examples/polaris/` (this receipt + canvas
  screenshots) and the live Figma file.

## Bridge stability log

The Desktop Bridge dropped 4 times during the run (before tokens; before spinner; before
avatar; during the final screenshot pass). Twice on reconnect the active file flipped to an
unrelated open file ("Altitude Design System") — the pin (`figma_navigate lock:true`) was
re-applied and NO write was issued while the wrong file was active; every executed script
additionally carried the fileKey guard. All landed work verified after each reconnect.

