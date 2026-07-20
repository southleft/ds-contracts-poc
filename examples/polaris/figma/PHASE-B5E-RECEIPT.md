# Phase B-5e receipt — THE RE-AMEND (Round 5e) in "Polaris Contracts" (fileKey `W33Bzm5U58mcQHSCgEB7X8`)

Run date: 2026-07-20 (bridge session ~15:22–15:45 UTC). Purpose: land the round-5d
fixes (contracts v0.3.2, merged `68c03b5`-era main) on the owner's live canvas — the
canvas he reviewed at 5b and on which he named four visual defects. Mid-run the owner
expanded scope: re-run and re-verify ALL components, not just the four. This receipt
is that full review pack.

Target-file safety: "Polaris Contracts" was the ONLY bridge connection start to
finish (`connectedFiles` length 1, probe 2ms). Target pinned (`figma_navigate
lock:true`); `figma.fileKey` guard (`if (figma.fileKey !== 'W33Bzm5U58mcQHSCgEB7X8')
throw`) opened EVERY executed write batch. Bridge stability: zero drops.

Delivery channel: B-3/B-5 precedent — committed scripts served read-only over
`http://localhost:9230` (CORS, dual-stack `::` bind, `curl -4`/`-6` both 200 before
first batch), fetched in-sandbox and eval'd as async arrows byte-for-byte. Committed
scripts NOT edited. Screenshots rode the channel in reverse (plugin `exportAsync` →
POST `/shot` → disk).

## Script currency

`npx tsx examples/polaris/generate.ts --check` first: **76 generated file(s)
byte-stable** — the committed `figma/*.figma.js` ARE the v0.3.2 emit (5d stage-B/D
regeneration). No re-emit needed.

## 00-tokens.figma.js — verbatim, idempotent

Primitives **403 / 0 created**. Brand 0. Semantic **22 / 0 created** (collection
holds 23 — the 22 upserts + B-3's operator-bridge `color/input/placeholder` alias,
still in force). Text styles **11 / 0 created**.

## Provisional mint audit (the size-8 question answered)

`Imported (provisional)` holds **1004 leaves** = **921 current v0.3.2 names (all
present, zero missing)** + **83 stale leaves** (dead vocabulary from the B-3/5b
eras; the idempotent-by-name upsert never deletes). On the brief's own rule —
delete only orphans carrying our `ds_contracts` identity markers — **zero
deletions**: variables carry NO `ds_contracts` markers in these scripts (verified;
only minted TEXT STYLES carry `ds_contracts/textStyleToken`). The 83 stale names
are recorded residue a human may retire; nothing binds them after the rebuild.
`imported/shared/size-8` itself is NOT stale — it remains a live v0.3.2 name (all
12 scripts reference it for other channels); only Badge's three CORNER BINDINGS to
it were retired, replaced at source by `p/border-radius-200` (verified below).

## Amend ledger — all 12 sets, every node id AND key stable, zero recreations

No skips: every script's specHash changed under v0.3.2, so all 12 amended.

| component | result | node id | variants rebuilt | extras/props |
|---|---|---|---|---|
| Badge | amended in place | 8:1330 | 42 | none |
| Checkbox | amended in place | 4:773 | 3 | none |
| RadioButton | amended in place | 8:543 | 2 | none |
| Banner | amended in place | 1:461 | 8 | none |
| Button | amended in place | 1:689 | 220 | none |
| Tag | amended in place | 4:762 | 4 | none |
| ProgressBar | amended in place | 1:487 | 12 | none |
| TextField | amended in place | 4:1206 | 8 | none |
| Thumbnail | amended in place | 1:447 | 4 | none |
| Avatar | amended in place | 1:441 | 5 | none |
| Spinner | amended in place | 1:415 | 2 | none |
| Text | amended in place | 4:1168 | 55 | none |

## THE OWNER'S FOUR — verified on canvas, with evidence

**(a) Checkbox check = one continuous smooth stroke — VERIFIED.**
Probe: the checked cell's glyph vector is a single path, `strokeCap: ROUND`,
`strokeWeight: 2`, `dashPattern: []` (the 5b capsules were the computed
`stroke-dasharray` of Polaris's draw-on animation, dropped by name in v0.3.2).
Screenshot: `receipts/canvas/zoom-checkbox-checked.png` (4×) — one smooth check.

**(b) Checkbox AND RadioButton control↔label gap = 8px — VERIFIED.**
Probe: every cell's root is HORIZONTAL auto-layout with `itemSpacing: 8` BOUND to
`imported/checkbox/choice-control/margin-right` (3 cells) /
`imported/radio-button/choice-control/margin-right` (2 cells); geometry confirms
(18px control at x=0, label at x=26). Screenshots:
`receipts/canvas/zoom-checkbox-set-gap.png`, `zoom-radiobutton-gap.png` (3×).

**(c) Banner focus ring wraps ALL four sides incl. over the ribbon — VERIFIED.**
Probe: all 4 Focus Visible cells stroke 2px solid #005BD3-class with
`strokeAlign: OUTSIDE`, `clipsContent: false` (5b was inside-aligned; the opaque
ribbon painted over the top arc). Screenshots:
`receipts/canvas/zoom-banner-focus-info.png`, `zoom-banner-focus-warning.png` —
the ring crosses the amber/blue ribbon on top. Named residue: outline-offset is
still not carried.

**(d) Badge radius = ONE bound variable on all four corners + pip bindings —
VERIFIED.** Probe over ALL 42 cells: the corner-binding histogram has exactly ONE
bucket — `p/border-radius-200` on all four corners of every cell (no unbound, no
mixed; the size-8 siblings are gone from the inspector). Every pip's vector paint
binds `imported/badge/icon-3/fill/<tone>` (info pip #0094d5 ≠ text #003a5a — the
captured not-text-colored truth). Pip margins −2/−2/−8 apply as margin-box
wrappers (12×16 box, icon at (−8,−2)); **all 42 pills measure 20px** — gate
parity (146×40 @2x). Screenshots: `receipts/canvas/zoom-badge-info-incomplete.png`,
`zoom-badge-attention-row.png` (4×).

## Named findings this run (engine-side; repo code untouched, canvas corrected to the compiled spec per B/B-2/B-3/B-5 precedent)

1. **NEW — `amendSet` omits `applyMarginBox` for top-level children.** The round-5d
   runtime added CSS margin-box wrapper frames (`applyMarginBox`), but the AMEND
   path's child loop calls `buildNode` + `applyOverlay` only — margin boxes apply
   only to NESTED children (inside `buildNode`'s own loop). Since all 12 sets took
   the amend path, every margins-carrying DIRECT child of a variant root lost its
   margin box. Swept all 12 scripts: exactly three affected specs — Badge `icon`
   (−2/−2/−8, ×42: pill measured 24px, spec/gate say 20px), Button `icon` (−2/−2,
   ×220: visually neutral — symmetric margins, text row taller), TextField
   `labelled__labelwrapper` (+4 bottom, ×8: label gap lost). Canvas-corrected with
   the runtime's EXACT `applyMarginBox` semantics (guards included): 42+220+8
   wrappers; Badge pills now 20px (all 42), Button 28/32/36 heights hold,
   TextField label gap restored. Badge + TextField grids re-packed with the
   script's own math (PAD 40) after the size change.
2. **B-5 finding 1 REGRESSED by the rebuild, re-applied**: the shape branch drops
   `lits.fillColor` — RadioButton's checked dot (`backdrop-before`, the only
   affected node repo-wide, re-swept under v0.3.2) landed with no fill again.
   Canvas-corrected: literal white fill (the spec's own `{r:1,g:1,b:1,a:1}`).
3. **B-5 finding 3 REGRESSED by the rebuild, re-applied**: `applyInsetOverlay`
   lowers the checkbox icon overlay BEHIND its siblings, so the backdrop painted
   over the check glyph. Canvas-corrected: backdrop moved to the bottom of the
   `checkbox` frame in all 3 cells.
   **Standing consequence, named**: amend-in-place REBUILDS variant interiors, so
   canvas-level corrections (findings 1–3 here) will NOT survive the next
   re-amend either — they must be re-applied each session until fixed at the
   emitter.
4. **Presentation moves (recorded)**: 7 Surface frames re-fit to child extents
   after the amend re-grid overflowed the 5b bounds (Tag, RadioButton, Avatar,
   Thumbnail, Banner, Text, TextField — B-3 finding-4 class). TextField restored
   to the 5b presentation-only 2×4 grid (the amend's own math laid it 1×8,
   2808px wide). Text's 5b compact-skeleton arrangement was superseded by the
   amend's grid (the 55 axis cells are EMPTY frames by v0.3.2 design — the wide
   surface reads blank right of the specimen; honest, not a defect).
5. **Note columns**: Badge / Checkbox / RadioButton / Banner NOTE blocks rewritten
   from round-5b to round-5d truth (quoting the 5d gate numbers 0.07 / 3.22 /
   0.00 / 3.17). The other eight notes were already round-5b-true and their claims
   still hold.

## REVIEW PACK — all 12, ordered by how much changed since his 5b look

Composites replaced in `receipts/canvas/` (spinner-set.png and progressbar-set.png
exported byte-identical to 5b — nothing visible changed there). Gate references:
`receipts/canvas-gate/<component>--representative.png` / `--worst.png` (the same
v0.3.2 contracts rendered headless vs real Polaris).

**His four:**

| component | what changed since 5b | look at | still imperfect, by name |
|---|---|---|---|
| Checkbox | check glyph is now ONE smooth stroke (was segmented capsules); 8px gap between box and label, bound to the margin variable | Checkbox page, middle cell (Checked=checked); the gap on all 3 | indeterminate minus reads dark-on-dark (masked, same as gate); state previews still refused by the referee (named 5c) |
| RadioButton | 8px control↔label gap, bound (was 0) | RadioButton page, both cells | dot's white fill is a canvas correction (engine shape-lits gap, named) |
| Banner | focus ring now wraps the WHOLE card incl. the tone ribbon (was swallowed by the ribbon on top) | Banner page, right column (Focus Visible), esp. Warning | outline-offset not carried; Warning glyph tone-on-tone (masked class the gate scores); gate 3.17 |
| Badge | radius inspector: ONE variable (p/border-radius-200) on all four corners (was 3 corners on a minted size-8); pip rides its own per-tone fill variable; pill holds 20px with the pip margins applied | Badge page, any cell — select it and check the radius inspector; info row pip color | pip is NOT text-colored by captured truth (6/13 tones brighter — that IS Polaris, not a defect); gate 0.07 |

**Corner-binding beneficiaries (changed, less visibly):**

| component | what changed since 5b | look at | still imperfect, by name |
|---|---|---|---|
| Button | 220 cells rebuilt under v0.3.2 (margins/gap/radius carriage; icon margin boxes applied — visually neutral, symmetric) | Button page — tone×variant fills, primary bevel, secondary ring | font raster (desktop Inter vs gate Chromium); focus previews draw a stroked ring where runtime Polaris uses an outline; gate 7.02 class |
| Tag | rebuilt under v0.3.2 (radius/margin carriage) | Tag page — Default/Disabled | Active/Focus preview cells read heavier than real Polaris (carried outline channels whose resting style is none; gate 22.55, named) |
| ProgressBar | rebuilt (radius/track carriage) | ProgressBar page — 8/16/32 tracks × 4 tones | bars read fully filled: indicator width is a runtime %, demo width = track width (gate 26.22, named) |
| TextField | label anatomy carries its 4px margin-box gap; re-gridded back to the 5b 2×4 | TextField page | literal `{placeholder}` (prop default empty by contract); label sits left of the input — the emitted root shape, same as 5b; operator bridge alias still in force |
| Thumbnail | rebuilt (radius/size carriage) | Thumbnail page — per-size gray placeholders | 1:1 aspect rides a refused pseudo-element (named); gate 2.16 |

**Unchanged in substance (rebuilt, same visuals):**

| component | what changed since 5b | look at | still imperfect, by name |
|---|---|---|---|
| Avatar | nothing visible (rebuilt; initials/glyph anatomy, palette pair bound) | Avatar page | name-hash palette selection stays runtime; gate EXACT 0.00 |
| Spinner | nothing visible (export byte-identical to 5b) | Spinner page | none named; gate EXACT 0.00 |
| Text | axis cells remain EMPTY by design; specimen + 11 minted text styles are the deliverable | Text page — specimen block + the style panel | the wide blank right side IS the empty 55-cell axis skeleton (v0.3.2 channel-table truth, no pixel scope) |

## Gates

- `npm run eval`: **129/129 passed**, `evals/results.json` byte-unchanged (git-verified).
- `npx tsc --noEmit`: green.
- `git status`: only `examples/polaris/` touched (this receipt + `receipts/canvas/*`:
  10 composites replaced, 2 byte-identical, 7 zoom verifications added). Committed
  scripts and engine untouched. Nothing deployed.
