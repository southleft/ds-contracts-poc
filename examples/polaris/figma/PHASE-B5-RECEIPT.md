# Phase B-5 receipt — THE VERDICT BUILD (Round 5b) in "Polaris Contracts" (fileKey `W33Bzm5U58mcQHSCgEB7X8`)

Run date: 2026-07-19 (bridge session ~03:40–04:05 UTC 07-20). Purpose: rebuild the
owner's canvas from the v0.3.1 contracts (Round 5c merge, `1ef9caa`) — the build the
owner judges by eye after the contracts earned their numbers headless (canvas gate
7/10 PASS, Avatar/RadioButton/Spinner EXACT 0.00).

Target-file safety: "Polaris Contracts" was the ONLY bridge connection start to finish
(`connectedFiles` length 1 on every check). Target pinned (`figma_navigate lock:true`),
`figma_get_status` verified before EVERY component write batch, and every executed
batch opened with the in-sandbox guard
`if (figma.fileKey !== 'W33Bzm5U58mcQHSCgEB7X8') throw` before any write.
**Bridge stability: zero drops.**

Delivery channel: B-3 precedent — committed scripts served read-only over
`http://localhost:9230` (CORS, dual-stack `::` bind: both `curl -4` and `curl -6`
verified 200 before the first batch), fetched in-sandbox and **eval'd as async arrows
byte-for-byte** (the sandbox blocks the `AsyncFunction` constructor — "TypeError: Not
available" — but `eval` works; probed before first use). Committed scripts were NOT
edited. Screenshot export rode the channel in reverse (plugin `exportAsync` → POST
`/shot` → disk).

## Script currency

`npx tsx examples/polaris/generate.ts --check` first: **76 generated file(s)
byte-stable** — the committed `figma/*.figma.js` ARE the v0.3.1 emit (5c stage-6
regeneration). No re-emit needed.

## 00-tokens.figma.js — verbatim

Primitives **403 / 0 created** (idempotent). Brand 0. Semantic **22 / 0 created**
(collection holds 23 — the 22 upserts + B-3's operator-bridge
`color/input/placeholder` alias, still in force and still named on the TextField
note). Text styles **11 / 0 created** — the B-3 mint holds. The component scripts'
provisional mint: `Imported (provisional)` now carries **1004 leaves** — the 956
current v0.3.1 names (upserted idempotently, all resolved) **plus 48 stale
B-3-era names** the idempotent-by-name upsert never deletes. Named residue: the 48
stale leaves are dead vocabulary a human may retire; nothing binds them.

## Amend-vs-recreate ledger

| component | script result | node id (B-3 → B-5) | key stable | detail |
|---|---|---|---|---|
| Spinner | **amended in place** | 1:415 → 1:415 | YES | 2 variants rebuilt |
| RadioButton | **recreated** (named: standalone→set promotion) | 1:428 → 8:543 | no (new key) | v0.3.1 promotes to a Checked-axis SET; script skipped with "a human retires the old node" — operator retired 1:428, re-ran verbatim, reparented into Surface at old coordinates. 2 variants |
| Checkbox | **amended in place** | 4:773 → 4:773 | YES | 3 Checked-axis variants ADDED; the 5 round-3 `State=*` cells reported as extras (script never deletes) — operator retired them per policy; set re-packed |
| Tag | **amended in place** | 4:762 → 4:762 | YES | 4 `Size=large, State=*` variants added; 2 round-3 extras operator-retired; +3 boolean props |
| Thumbnail | **amended in place** | 1:447 → 1:447 | YES | 4 variants rebuilt |
| Avatar | **amended in place** | 1:441 → 1:441 | YES | 5 variants rebuilt; +Show WithInitials prop, Initials default edited |
| Banner | **amended in place** | 1:461 → 1:461 | YES | 8 variants rebuilt (4 tones × Default/Focus Visible); +2 props |
| TextField | **amended in place** | 4:1206 → 4:1206 | YES | 8 variants rebuilt; +2 props |
| ProgressBar | **amended in place** | 1:487 → 1:487 | YES | 12 variants rebuilt |
| Badge | **recreated** (named: standalone→set promotion) | 2:231 → 8:1330 | no (new key) | v0.3.1 promotes to the 42-cell curated SET (14 tones × 3 progress); operator retired 2:231, re-ran verbatim, reparented. |
| Text | **amended in place** | 4:1168 → 4:1168 | YES | 55 variants rebuilt — to intentionally EMPTY frames (see below) |
| Button | **amended in place** | 1:689 → 1:689 | YES | 220 variants rebuilt; +Show WithIcon prop |

The two recreates are exactly the script's own named promotion policy (same class as
B-3's Tag/Checkbox); every other set kept node id AND key, including the 220-variant
Button.

## Named findings this run (engine-side; repo code untouched, canvas corrected to the compiled spec per B/B-2/B-3 precedent)

1. **Shape branch drops `lits.fillColor`** (emitted shape builder reads `spec.fill`
   only): RadioButton's checked dot — an ellipse whose spec carries a literal white
   fill — landed with NO fill, so the checked cell read as a solid dark disc. Sweep of
   ALL 12 scripts found exactly ONE affected node (radio-button
   `backdrop-before`). Canvas-corrected: literal white fill applied; checked cell now
   matches the gate render (dark ring + white dot). Same finding class as B-3
   finding 3 (shape branch drops effectStack).
2. **Fully-clipped nodes export blank** (diagnosis, not a defect of the scripts): the
   recreated RadioButton set overflowed its B-3-sized Surface; a node fully outside
   its clipping ancestor has null `absoluteRenderBounds` and `exportAsync` returns an
   empty PNG. Presentation-fit (finding-4 class from B-3: surfaces never auto-refit)
   resolved it; all 12 surfaces were then fit-audited (one further clip found and
   fixed: Banner).
3. **Checkbox glyph z-order**: the emitted anatomy appends `icon` BEFORE `backdrop`
   inside the checkbox frame, so the backdrop painted OVER the white check glyph
   (overlay-lowering class, B-3 finding 5). Canvas-corrected: backdrop moved behind in
   all 3 cells; the check glyph now draws (dash-patterned per the emitted SVG's own
   `stroke-dasharray`). Indeterminate's minus glyph is dark-on-dark — the same masked
   residue the headless gate names; left as emitted.
4. **Extras retirement (policy followed, recorded)**: Checkbox (5 × `State=*`) and Tag
   (2 × round-3 cells) reported `extraVariants` — the script names them and never
   deletes; operator retired them so retired v0.3.1 refusals (checkbox/radio
   focus-visible previews, refused by the 5c referee) are not silently claimed on
   canvas.
5. **Text draws EMPTY cells by design** (v0.3.1 truth, not a defect): since Round 4
   the emit carries Text as a channel-table component with NO pixel scope — all 55
   curated axis cells are empty auto-layout frames; the type scale ships as the 11
   MINTED TEXT STYLES. The round-3 specimen text was round-2 canvas data; the amend
   correctly rebuilt it away. Presentation: a "Type scale — minted text styles
   (presentation only)" block (node 8:2431) now renders one sample line per minted
   style, attached to the REAL `textStyleId`s — labeled presentation-only on the
   canvas note.

## Per-component: B-3 verdict → B-5 verdict (vs the headless canvas-gate renders in `receipts/canvas-gate/`)

| component | B-3 verdict | B-5 verdict vs gate |
|---|---|---|
| button | MATCH on carried channels; NAMED ring/bevel loss | **MATCH + the ring loss RETIRED** — tone×variant paint pairs at source (Critical/Success primaries render real reds/greens), `p.shadow-button*` carried as native inner-shadow effects (bevel visible on primary, ring on secondary), 220 cells. Named residue (gate 7.02): font raster (desktop Inter vs gate Chromium), focus preview outline→stroke, 2 state×tone S3 cells |
| badge | MATCH (standalone pill) | **MATCH, promoted** — 42-cell set, progress glyphs + tone fills bound; gate 0.07 PASS |
| tag | MATCH + state axis | **MATCH** — Default/Disabled EXACT per gate pin; Active/Focus are the gate's named state-preview-vs-resting residue (carried outline channels; real resting outline is none); 'Wholesale' label = the contract's own cascade |
| checkbox | MATCH + 5-state axis | **MATCH on v0.3.1 axis** — Checked axis (3 cells), check glyph DRAWS (finding 3 correction); indeterminate dark-on-dark masked (same as gate); gate 3.06 PASS |
| radio-button | MATCH; dot = named loss | **MATCH, dot RETIRED as a loss** — promoted set; unchecked ring draws (5c per-side border lowering), checked dot draws (finding 1 correction); gate EXACT 0.00 |
| spinner | MATCH (divergence B #000 glyph) | **MATCH, divergence B RETIRED** — per-size arc glyphs in the carried #303030 context color; gate EXACT 0.00 |
| avatar | MATCH; "Avatar" text overflow named | **MATCH, overflow RETIRED** — initials/glyph anatomy with authored viewBox, square 1:1 cells, palette pair bound; gate EXACT 0.00. Named gap: hash palette selection stays runtime |
| thumbnail | MATCH; honest white-on-white | **MATCH, now visible** — carried gray placeholder fill + per-size width/radius; 1:1-aspect pseudo-element still the named gap; gate 2.16 PASS |
| banner | MATCH; tone RIBBON = loudest gap | **MATCH + RIBBON RETIRED** — tone-colored icon row + title over white card, 4 tones × Default/Focus; gate 4.60 PASS. (Warning ribbon's glyph reads tone-on-tone at a glance — same masked class the gate scores.) |
| progress-bar | MATCH on carried channels | **MATCH on carried channels** — 8/16/32 tracks × 4 tones; indicator at the fixed 100px demo width (= demo track width, so cells read fully filled): the gate's own pinned runtime-% residue (26.22, named) |
| text | NEW: specimen + minted styles | **v0.3.1 truth: EMPTY axis cells by design** (finding 5); 11 minted text styles remain the deliverable, presentation-only specimen added |
| text-field | NEW: box + states; label anatomy NOT drawn | **MATCH + label anatomy now DRAWS** ('Store name'); 4 base + 4 state previews re-gridded 2×4; `{placeholder}` literal remains the named residue; operator bridge (placeholder alias) still in force |

## Presentation

- Captions kept in the one-line de-noised form on all 12 pages.
- ALL 11 round-3 NOTE columns rewritten to round-5b truth (no retired refusal is still
  claimed: RadioButton dot, Checkbox glyph, Banner ribbon, Button ring, Avatar
  overflow, Spinner #000 divergence all now read as RETIRED); NEW notes added for
  Badge (8:2443) and Spinner (8:2444), which had none.
- TextField set re-gridded (presentation-only positions): 2 rows × 4 cols instead of
  the emitted single row; Text page arranged note → minted-styles specimen → compact
  empty axis skeleton.
- All 12 Surface frames fit-audited against child extents; RadioButton, Banner, Tag,
  Checkbox, Badge, Text, TextField, Button refit; Avatar/Thumbnail padded/trimmed.

## Screenshots

`receipts/canvas/` replaced in full: 12 surface-composite exports, one per page
(~330KB total; button at 0.5×, everything else 1×) — each is the full
"Surface — <Set>" frame (title, caption, note, set).

## What the owner should LOOK AT first, and the imperfections he WILL see

1. **Button** — 220 real Polaris buttons; primary bevel + secondary ring now render
   (native effects). He'll still see: label rasterization slightly off real Polaris
   (desktop Inter vs browser), and focus cells drawing a stroked ring where runtime
   Polaris uses an outline.
2. **Banner** — the tone ribbons are BACK (the round-3 loudest gap). Warning's glyph
   reads tone-on-tone.
3. **RadioButton / Checkbox / Avatar / Spinner** — the four EXACT-0.00-class pages;
   dot, check glyph, initials glyph, arc color all draw.
4. **ProgressBar** — bars read fully filled: the indicator's real width is a runtime
   %, the demo width equals the track width. Named on the canvas note.
5. **Tag** — Active/Focus preview cells read heavier than real Polaris (carried
   outline channels whose resting style is none). Named on the canvas note.
6. **Text** — the axis set is intentionally empty; the type scale lives in the style
   panel (11 minted styles) and the labeled presentation specimen.
7. **TextField** — literal `{placeholder}` label (prop default is empty by contract).

## Gates

- `npm run eval`: **124/124 passed**, `evals/results.json` byte-unchanged (git-verified).
- `npx tsc --noEmit`: green.
- `git status`: only `examples/polaris/` touched (this receipt + `receipts/canvas/*`).
  Committed scripts and engine untouched. Nothing deployed.
