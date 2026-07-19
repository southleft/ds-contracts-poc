# Phase B-2 receipt — enriched-contract rebuild in "Polaris Contracts" (fileKey `W33Bzm5U58mcQHSCgEB7X8`)

Run date: 2026-07-19 (~13:00–14:10 UTC bridge session). Purpose: land the coverage round
(carried facts 114→185) on the live canvas the owner is watching — the pass that must fix
what he judged "not acceptable stylistically": Button labels/backgrounds, Avatar visibility,
ProgressBar heights, Banner typography, Badge/Tag/Thumbnail enrichment.

Target-file safety, same discipline as Phase B: fileKey verified via `figma_get_status`
before the first write and inside EVERY executed batch (`figma.fileKey !==
'W33Bzm5U58mcQHSCgEB7X8'` throws before any write); target pinned with `figma_navigate
lock:true` (the Altitude file was again connected in parallel — the flip risk from Phase B
is real). **Bridge stability: zero drops this run** (Phase B had 4).

Delivery channel: scripts served read-only over `http://localhost:9230` (CORS); every
`figma_execute` fetched bytes and eval'd them (`AsyncFunction` constructor is blocked in the
plugin sandbox — wrapped as an eval'd async arrow instead; source bytes unmodified).
Committed scripts were NOT edited. Screenshot export rode the same channel in reverse
(plugin `exportAsync` → POST to localhost, no bytes hand-copied).

## Script currency

`npx tsx examples/polaris/generate.ts` re-run before anything else: **zero drift** — the
committed `figma/*.figma.js` are byte-identical to a fresh emit of the coverage-round
engine (COMPILE-RECEIPT.md is current: avatar 2 bound names, button 14, banner 8 — the
enriched counts).

## 00-tokens.figma.js — verbatim, NO shim (Phase B deviation 1 retired)

The committed script now carries the `rgba()`-capable color parser at source. Executed
byte-for-byte: Primitives **403 total / 0 created** (idempotent identity-marker upsert;
the coverage round added no tokens — enrichment was fact carry in component scripts).
Brand 0 / Semantic 0 / text styles 0, unchanged.

## NAMED FINDING 1 — committed per-component scripts are CREATE-ONLY

Every committed `<component>.figma.js` run verbatim first. All 10 returned
`{ skipped: true }` with the existing node — the identity marker resolves perfectly, but
`buildComponentScript`'s emitted runtime returns on identity match; it never amends. The
engine's in-place amend (`amendSet`, 2026-07-08) is only reachable through
`buildBatchScript`. **Engine finding**: `core/emit-figma-script.ts` `buildComponentScript`
skips where `buildBatchScript`→`syncOne` amends — the per-component emit predates the
amend path.

Resolution (repo code unmodified): amend scripts were generated in the session scratchpad
by calling the UNMODIFIED engine — `createFigmaEngine(...).buildBatchScript([data],
'W33Bzm5U58mcQHSCgEB7X8')` per contract, with the exact token/icon plumbing of
`examples/polaris/generate.ts` — and served/executed the same way. Byte-derived from the
committed contracts; nothing hand-written entered the file.

## NAMED FINDING 2 — standalone-component amend unsupported in v1 (Badge, Tag recreated)

`amendSet` v1 supports COMPONENT_SETs only; Badge/Tag/Checkbox/RadioButton are standalone
COMPONENTs (`IS_SET = false`). Badge and Tag carry real coverage-round deltas (label
fontSize 14→12, lineHeight 16 added), so they were **deleted and recreated** via their
committed scripts, then reparented into their Surface frames at the old coordinates —
**their node ids and keys changed** (any instances would rebind; this file has none).
Checkbox/RadioButton specs are unchanged (the coverage round moved Phase B's live-shimmed
stroke/fill-clear fixes to source; the live nodes already carry them) — their verbatim
skip is the correct outcome, verified by probe below.

| component | script result (verbatim) | landed via | node id (Phase B → B-2) | key stable |
|---|---|---|---|---|
| Spinner | skipped | amend in place, 2 rebuilt | 1:415 → 1:415 | YES |
| Avatar | skipped | amend in place, 5 rebuilt | 1:441 → 1:441 | YES |
| Thumbnail | skipped | amend in place, 4 rebuilt | 1:447 → 1:447 | YES |
| Banner | skipped | amend in place, 4 rebuilt | 1:461 → 1:461 | YES |
| ProgressBar | skipped | amend in place, 12 rebuilt | 1:487 → 1:487 | YES |
| Button | skipped | amend in place, 200 rebuilt | 1:689 → 1:689 | YES |
| Badge | skipped | recreate (finding 2) | 1:417 → 2:231 | no (new key) |
| Tag | skipped | recreate (finding 2) | 1:420 → 2:233 | no (new key) |
| Checkbox | skipped (correct — spec unchanged) | — | 1:425 | YES |
| RadioButton | skipped (correct — spec unchanged) | — | 1:428 | YES |

Six sets amended IN PLACE — same node ids and component keys as PHASE-B-RECEIPT.md, 227
variant interiors rebuilt, zero added/extra variants, zero property churn. That is the
amend receipt: a 200-variant set updated under instances' feet without re-minting identity.

## NAMED FINDING 3 — `fillClear` tramples a spec-carried fill (Button, engine bug, live)

Button root specs carry BOTH `fill` (Primary → `p/color-bg-fill-brand`, Secondary →
`p/color-bg-fill`) AND `lits.fillClear: true` (the base `background: transparent` rule).
The emitted lits runtime applies `fillClear` AFTER `spec.fill`, so all 80 Primary/Secondary
variants landed with NO background — precisely the white-on-white the owner flagged.
**Engine finding**: `core/emit-figma-script.ts` litsRuntime — an explicit `spec.fill` must
win over `fillClear` (compile emits both; runtime order decides wrong). Scan: button is the
only committed script carrying both channels, root only. Canvas-corrected per the Phase B
deviation-3 precedent (canvas must match the compiled spec): the spec'd bound fills were
re-applied on the 80 variants (40 `p/color-bg-fill-brand`, 40 `p/color-bg-fill`); the 120
Plain/Tertiary/MonochromePlain variants are transparent BY SPEC and were untouched.

## NAMED FINDING 4 — empty-child default geometry (ProgressBar indicator)

The contract carries no indicator geometry (width is the runtime progress %); the emitted
runtime creates it as an empty frame, which keeps Figma's 100×100 `createFrame` default and
OVERFLOWS the now-carried 8/16/32px fixed-height tracks (clipsContent off) — the first
export showed tall color slabs, not tracks. The HTML surface's equivalent empty block gets
its height from flow; the canvas engine has no such normalization. **Engine finding** (same
class as the retired default-gray-paint artifact). Canvas-corrected:
`layoutSizingVertical = 'FILL'` on the 12 indicators — indicator height now follows the
track; width stays the arbitrary 100px demo width (runtime-% gap, annotated on canvas).

## Per-component verification (probe = live canvas values, bound names resolved)

- **Button** (200 variants): every sampled variant has a real `label` TEXT child — 12px
  Inter Medium, lineHeight 16px, text fill BOUND (`p/color-text`,
  `p/color-text-brand-on-bg-fill` on primary); paddings bound (`p/space-150`/`p/space-300`),
  radius `p/border-radius-200`, minWidth `p/width-800`. Primary = brand dark bg + white
  label; Secondary = white bg + dark label; Plain/Tertiary = transparent + colored label.
- **Avatar** (5): root fill BOUND `p/color-avatar-one-bg-fill` (the cited default palette,
  resolves rgb(197,48,197)); initials BOUND `p/color-avatar-one-text-on-bg-fill`. Never
  invisible again.
- **ProgressBar** (12): track heights **16 / 8 / 32** for Medium/Small/Large (all 12
  verified); track `p/color-bg-fill-tertiary` + 4 tone indicator fills bound.
- **Banner** (4): `title` + `body` TEXT children per tone — 13px Medium, lineHeight 20px,
  4 tone bg + 4 on-bg text fills bound (8 names).
- **Badge**: label 12px (was 14), lineHeight 16, `p/color-text-secondary`; bg
  transparent-secondary (0.06 alpha), radius 8, padding 2/8 — all bound.
- **Tag**: label 12px, lineHeight 16, `p/color-text`; bg `p/color-bg-fill-tertiary`,
  radius 8.
- **Checkbox / RadioButton**: stroke `p/color-input-border` at 0.66, checkbox fills 0
  (deviation-3 state holds), radio near-white surface fill — unchanged, now source-backed.
- **Thumbnail** (4): per-size widths 24/40/60/80 (new carried facts), per-size radius
  (6 on XS), bg `p/color-bg-surface`.

## Canvas vs Phase A "ours" (coverage-round receipts) — before-pass → this-pass

| component | Phase B verdict | Phase B-2 verdict |
|---|---|---|
| button | empty rounded rects; secondary/tertiary white-on-white | **MATCH on carried channels** — labeled, typographed, backgrounded buttons; named gaps: `p.shadow-button*` token exclusions (secondary's border look), tone-specific PRIMARY bg (multi-axis tone×variant compound — Critical/Success primary render brand dark), hover/active runtime states |
| avatar | NAMED DIVERGENCE — no root bg, white-on-white initials | **MATCH on carried channels** — palette pair bound and visible; named gaps: name-hash palette SELECTION (runtime), 1:1 aspect (CSS trick; height hugs initials — canvas default shows the placeholder "Avatar" string overflowing the Md 28px width; Phase A receipts supply "TP" as a render-time prop) |
| progress-bar | PARTIAL — heights refused, auto-height tracks | **MATCH on carried channels** — real 8/16/32 tracks, tone-colored; named gap: indicator width = runtime % |
| banner | MATCH colors only, no text | **MATCH** — title/body typography carried (13/Medium/20); named gap: padding/stacked layout not carried (unchanged from Phase A) |
| badge | MATCH (14px label) | **MATCH** — enriched 12px/lh16 label |
| tag | MATCH (14px label) | **MATCH** — enriched 12px/lh16 label |
| checkbox | MATCH via live shim | **MATCH** — same pixels, now emitted at source |
| radio-button | MATCH via live shim | **MATCH** — same pixels, now emitted at source |
| spinner | MATCH (divergence B: glyph #000 vs #303030) | **MATCH** — divergence B stands (0 bound names by compile; near-invisible visually) |
| thumbnail | MATCH on carried channels | **MATCH** — plus per-size widths; named gap: 1:1 aspect (height renders at frame default; white-on-white is the real `p/color-bg-surface` value) |

## What the owner will SEE differently

1. **Button page**: 200 real buttons — dark Primary with white labels, labeled Secondary,
   colored Plain/Tertiary text buttons — instead of naked rounded squares.
2. **Avatar page**: five magenta palette-filled avatars with visible initials instead of
   invisible white-on-white.
3. **ProgressBar page**: a 3-height × 4-tone grid of real 8/16/32px tracks instead of
   uniform auto-height slabs.
4. **Banner page**: title + body text on every tone instead of bare color bars.
5. **Badge/Tag**: correct 12px Polaris label scale.
6. Stale refusal notes are GONE: the four on-canvas notes (Avatar 1:720, Thumbnail 1:721,
   Button 1:722, ProgressBar 1:723) now state what CARRIES and name only the remaining
   gaps (hash palette selection, pseudo-element/aspect, runtime %, multi-axis tone,
   shadow-token exclusions, runtime states).

## Screenshots

`receipts/canvas/` (deleted as stale by the coverage round) recreated with 10 fresh
surface-composite exports (~268KB total; button at 0.5× for weight): avatar-set, badge-set,
banner-set, button-set, checkbox-set, progressbar-set, radiobutton-set, spinner-set,
tag-set, thumbnail-set. Each is the full "Surface — <Set>" frame (title, annotation, set) —
one per page, so these are also the per-page finals.

## Not run

Text and TextField remain NOT built (23,232 / 1,344-variant cartesians; owner
axis-curation decision still pending, unchanged from COMPILE-RECEIPT.md).

## Gates

- `npm run eval`: **107/107 passed**, `evals/results.json` byte-unchanged (git-verified).
- `npx tsc --noEmit`: green.
- `git status`: only `examples/polaris/` touched (this receipt + `receipts/canvas/*.png`).
  Nothing deployed. Committed scripts and engine untouched.
