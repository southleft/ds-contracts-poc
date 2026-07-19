# Phase B-3 receipt — floor-contract rebuild (Round 3) in "Polaris Contracts" (fileKey `W33Bzm5U58mcQHSCgEB7X8`)

Run date: 2026-07-19 (~18:26–18:50 UTC bridge session). Purpose: rebuild the owner's
canvas from the Round-2 floor-promoted v0.2.0 contracts — the pass that must read as
POLARIS by eye. First landing for Text (55-cell curated sample + 11 minted text styles)
and TextField (curated projection); first live run of the amend-capable per-component
scripts (#60) that Round 2 re-emitted.

Target-file safety: the owner closed every other Figma project before this run —
"Polaris Contracts" was the ONLY bridge connection start to finish (`connectedFiles`
length 1 on every status check; the Altitude flip risk of Phases B/B-2 was eliminated at
the source). Discipline kept anyway: target pinned (`figma_navigate lock:true`),
`figma_get_status` checked across the run, and EVERY executed batch opened with the
in-sandbox guard `if (figma.fileKey !== 'W33Bzm5U58mcQHSCgEB7X8') throw` before any
write. **Bridge stability: zero drops.**

Delivery channel: same as B-2 — committed scripts served read-only over
`http://localhost:9230` (CORS, both IP stacks this time; the plugin's fetch resolves
`localhost` to IPv6, which silently failed against a v4-only bind), fetched and eval'd
as async arrows byte-for-byte. Committed scripts were NOT edited. Screenshot export rode
the channel in reverse (plugin `exportAsync` → POST → disk).

## Script currency

`npx tsx examples/polaris/generate.ts` re-run first: **zero drift** — the 13 committed
`figma/*.figma.js` are byte-identical to a fresh emit of the Round-2 engine.

## 00-tokens.figma.js — verbatim

Primitives **403 total / 0 created** (idempotent). Brand 0. **Semantic 22 / 22 created**
(the new `font/<role>/size|weight` alias layer feeding the type scale — Round 2's
addition, first landing). **Text styles 11 / 11 created** — the Polaris type scale is
now minted as named Figma text styles (`ds_contracts/textStyleToken` identity markers:
body-xs…lg, heading-xs…3xl), exactly the COMPILE-RECEIPT list.

## Amend-vs-recreate ledger

The headline receipt: the Round-2 scripts amend in place for real. Nine of ten
pre-existing components kept their node ids AND component keys; the two exceptions are
shape *promotions* (standalone COMPONENT → COMPONENT_SET), where the script's own named
policy refuses to convert and defers retirement to a human/operator.

| component | script result | node id (B-2 → B-3) | key stable | detail |
|---|---|---|---|---|
| Spinner | **amended in place** | 1:415 → 1:415 | YES | 2 variants rebuilt |
| Badge | **amended in place (standalone)** | 2:231 → 2:231 | YES | B-2 finding 2 (no standalone amend) retired — `amendComponent` works |
| Tag | **recreated** (named: standalone→set promotion) | 2:233 → 4:762 | no (new key) | floor promoted Tag to a set (State-preview axis + boolean props); script skipped with "a human retires the old node" — operator retired 2:233, re-ran verbatim, reparented into Surface at old coordinates. 2 variants |
| Checkbox | **recreated** (same named cause) | 1:425 → 4:773 | no (new key) | 5-state set (Default/Hover/Active/Focus Visible/Disabled) + boolean props |
| RadioButton | **amended in place (standalone)** | 1:428 → 1:428 | YES | spec deltas only |
| Thumbnail | **amended in place** | 1:447 → 1:447 | YES | 4 variants rebuilt |
| Avatar | **amended in place** | 1:441 → 1:441 | YES | 5 variants rebuilt |
| Banner | **amended in place** | 1:461 → 1:461 | YES | 4 rebuilt, 4 renamed to `State=Default`, **4 Focus Visible variants added** → 8 |
| ProgressBar | **amended in place** | 1:487 → 1:487 | YES | 12 variants rebuilt, 8/16/32 heights hold |
| Button | **amended in place** | 1:689 → 1:689 | YES | **200 variants rebuilt + renamed** (`State=Default` suffix) **+ 20 state-preview variants added** (Hover/Active/Focus Visible/Disabled × 5 variants on the Medium·Center·Critical block) → 220 |
| Text | **NEW** | — → 4:1168 | — | 55-cell curated projection (11 variants × 5 tones), 4 boolean props + 5 axes |
| TextField | **NEW** | — → 4:1206 | — | 8-cell projection (variant 2 × size 2 + 4 state previews), 29 props + 6 axes |

A 220-variant Button set was updated under its own identity — same node id and key as
Phase B — while gaining a state axis. That is the amend capability proven at scale.

## Named findings (all engine-side; repo code untouched, canvas corrected to the compiled spec per the B/B-2 precedent)

1. **`color/input/placeholder` vocabulary leak** (`core/emit-figma-script.ts:1230`,
   `formControlSpec`): the form-control emit hardcodes the REPO's semantic variable name
   for placeholder text; the Polaris example never mints it, so text-field.figma.js
   threw `Missing variable` on first run. OPERATOR BRIDGE: upserted
   `color/input/placeholder` in the Semantic collection as an ALIAS to
   `p/color-text-secondary` — the color Polaris's own `.Input::placeholder` rule uses
   (`::placeholder` itself is a named refusal in PROMOTION.md) — then re-ran the
   committed script verbatim. The variable carries a `ds_contracts/operatorBridge`
   plugin-data note naming this.
2. **Amend-seed drops variable alpha** (emitted `boundPaint` seed: resolves r/g/b,
   discards `a`): on an amended (pre-existing) node Figma renders the reassigned bound
   paint's BASE, so Badge's `p/color-bg-fill-transparent-secondary` (rgba 0,0,0,.06)
   rendered as an OPAQUE BLACK pill. Sweep of all 453 bound paints across the 12 sets
   found exactly ONE affected paint (Badge root — the only amended node binding an
   alpha-carrying variable). Canvas-corrected: paint re-set with resolved rgb + alpha.
3. **Shape branch drops `effectStack`** (emitted shape builder applies fill/stroke/
   bindings but not effects; frame branch applies them — same class as Phase B
   deviation 2): the Checkbox backdrop's inset ring (INNER_SHADOW spread 0.66,
   #8a8a8a — Polaris draws the checkbox border as a box-shadow, and the floor carries
   it as a literal effect stack) was silently dropped, leaving near-invisible boxes.
   Canvas-corrected: the spec's exact effect applied to all 5 state backdrops.
   Banner's frame-level focus effect landed fine by itself.
4. **`amendSet` re-grids children but never resizes the set container**: after adding
   variants, Banner's set kept its stale bounds (new Focus column clipped by the
   Surface), Button needed 7400×312, ProgressBar had stale height. Canvas-corrected:
   sets resized to child extents + grid pad; Surface frames refit.
5. **Overlay anatomy has no absolute-position lowering** (B-2 finding-4 class):
   TextField's `backdrop` — declared in the contract as an inset-0 overlay
   (`top/right/bottom/left: {imported.shared.size-0}`, root `position: relative`) —
   flowed as a SIBLING next to the input, so the border box rendered beside the
   placeholder text. Canvas-corrected: backdrop set `layoutPositioning:'ABSOLUTE'`,
   inset 0 behind the input, STRETCH constraints — matching the contract's declared
   anatomy and the floor's own paired HTML render.
6. **Shadow lowering asymmetry** (informational, drives the Button gap): LITERAL-valued
   computed shadows lower to `effectStack` (checkbox ring, banner focus), but
   TOKEN-REFERENCED shadows (`box-shadow: {p.shadow-button-primary}` etc.) bind
   variable-excluded tokens and are dropped entirely — no effects, no annotation
   channel. The floor's own HTML pair DOES render these (CSS carries the string), so
   this is a canvas-only loss. Verdict on canvas: ANNOTATE (done — Button note).

Also retired this run: the first text-field attempt's three partial orphan nodes
(4:1170–4:1172, debris of the missing-variable throw) were deleted from the Button page.

## Per-component: B-2 verdict → B-3 verdict (vs the floor's paired receipts in `receipts/<component>/`)

| component | B-2 verdict | B-3 verdict |
|---|---|---|
| button | MATCH on carried channels | **MATCH on carried channels, state axis now drawn** — 220 cells; Primary = brand-dark + white label, per-corner radii bound, paddings/minWidth bound; Disabled/Hover/Active/Focus previews render. NAMED GAPS: `p.shadow-button*` ring/bevel (secondary's border look — the HTML pair shows it, canvas cannot; finding 6); tone-specific PRIMARY bg (Critical/Success primary render brand dark); plain 13px two-axis upgrade (named refusal, receipts) |
| badge | MATCH (12px/lh16) | **MATCH** — after finding-2 correction the transparent-secondary pill renders exactly like the paired receipt |
| tag | MATCH | **MATCH + state axis** — 12px/lh16 label holds at source; Disabled preview drawn |
| checkbox | MATCH (live shim, source-backed) | **MATCH + 5-state axis** — after finding-3 correction the 0.66 inset ring reads like the paired receipt; NAMED ranked loss: check glyph / indeterminate inner detailing (state-dependent vector anatomy, not carried) |
| radio-button | MATCH | **MATCH** — amended in place; NAMED ranked loss: selected-dot inner detailing |
| spinner | MATCH (divergence B) | **MATCH** — divergence B stands (#000 vs #303030 glyph) |
| avatar | MATCH on carried channels | **MATCH on carried channels** — magenta palette pair bound and visible; NAMED gaps unchanged: hash palette selection is runtime, placeholder string "Avatar" overflows the hugged width (paired receipts supply "TP" render-time), 1:1 aspect not carried |
| thumbnail | MATCH on carried channels | **MATCH on carried channels** — per-size widths/radii bound; honest white-on-white (`p/color-bg-surface` on white surface; the real Polaris border rides a refused pseudo-element) — annotated |
| banner | MATCH (title/body typography) | **MATCH + state axis** — white card + 13px/lh20 title/body per the base-scope resolution; 4 Focus Visible cells with the carried focus effect. NAMED TOP GAP (annotated on canvas): the tone-colored RIBBON anatomy (icon row over the card) is a computed-only loss — tone cells are visually identical white cards by design of the resolution |
| progress-bar | MATCH on carried channels | **MATCH on carried channels** — 8/16/32 tracks × 4 tones; indicator at fixed 100px demo width (runtime-% gap, annotated); indicator height follows track |
| text | not built | **NEW: MATCH on carried channels** — real Polaris type-scale specimen, 11 sizes × 5 tones re-gridded for reading; 11 minted text styles ship alongside. NAMED LIMITS (annotated): cells keep raw font props (honest `p.text-*` binding, no style attachment); 450/550/650 weights render the Inter-Medium fallback, so heading weights read lighter than real Polaris |
| text-field | not built | **NEW: MATCH on carried channels** — bordered input box wrapping placeholder text, borderless/slim variants, 4 state previews (disabled fill, hover/active/focus tints). NAMED: `{placeholder}` template literal renders (no prop default; paired receipt supplies "Jaded Pixel" render-time); geometry-class width (cells hug content); label/help-text/prefix anatomy not drawn |

## Presentation

- New light Surface frames for Text (2,636×734) and TextField, matching the existing
  chrome (white card, 12px radius, Semi Bold 20 title, gray sub, 11px note column).
- Text set re-gridded (presentation-only cell positions): 5 tone rows × 11 scale
  columns instead of the emitted 12,380px single row.
- Annotations refreshed to Round-2 truth: Button (1:722) and ProgressBar (1:723) notes
  rewritten; NEW notes on Banner (tone-ribbon top gap), Checkbox + RadioButton (inner-
  detailing ranked loss, recreate/amend provenance), Tag (promotion provenance), Text
  and TextField (curation, named limits, operator bridge). Avatar (1:720) and
  Thumbnail (1:721) notes remain accurate and stand.
- All Surface frames refit to their (grown) sets; no clipped cells remain.

## Screenshots

`receipts/canvas/` recreated (Round 2 had deleted it as stale): 12 surface-composite
exports, one per page, ~344KB total (button at 0.5×, everything else 1×) — each is the
full "Surface — <Set>" frame (title, note, set): avatar, badge, banner, button,
checkbox, progressbar, radiobutton, spinner, tag, text, textfield, thumbnail.

## What the owner will SEE, including the honest imperfections

1. **Button**: 220 real Polaris buttons incl. a drawn state row. Primary/Secondary read
   right at a glance; the MISS a designer will spot: secondary/tertiary have NO border
   ring (shadow-token loss, finding 6) so they float borderless on white, and primary
   lacks the bevel.
2. **Text**: the page most likely to read instantly as Polaris — the full type scale
   with tone colors; heading weights render Medium (fallback), slightly lighter than
   Shopify's 650s.
3. **TextField**: real-looking input boxes with states; literal `{placeholder}` label.
4. **Checkbox/Radio/Tag/Badge**: crisp and Polaris-correct at these sizes; no check
   glyph / dot inner detailing (empty controls only).
5. **Banner**: correct card typography + focus previews, but NO tone ribbon — the four
   tones look identical; this is the loudest known anatomy gap and is annotated on the
   canvas in front of the cells.
6. **Avatar**: right palette, but "Avatar" text overflows the pill (placeholder-string
   vs render-time initials).
7. **Thumbnail**: honest white-on-white — reads as an empty page without the note.
8. **ProgressBar/Spinner**: correct geometry; indicator stuck at demo width.

## Gates

- `npm run eval`: **110/110 passed**, `evals/results.json` byte-unchanged (git-verified).
- `npx tsc --noEmit`: green.
- `git status`: only `examples/polaris/` touched (this receipt + `receipts/canvas/*`).
  Committed scripts and engine untouched. Nothing deployed.
