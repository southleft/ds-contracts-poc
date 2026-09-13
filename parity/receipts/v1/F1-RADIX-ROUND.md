# F1, second row — Radix Themes through the product's own command (2026-09-13)

**Why a second row.** The first F1 subject, react-day-picker's calendar, is
minted and scored (3.735% against a 5% bar) but calendar is not one of the
thirteen archetypes `recipe:point` ships, so it measures a lineage a stranger
cannot reach. The owner decided on 2026-09-13 to keep that row **and** add a
held-out library through the product path itself. Radix Themes
(`@radix-ui/themes@3.3.0`) had been captured once on 2026-09-04 through the
legacy `onboard` chain and never pointed at by the recipe path; five of its
components are shipped archetypes: avatar, switch, checkbox, badge, tabs.

**Blindness held.** The capture config, seeds and sandbox were authored from the
library's documentation before this round (`HELD-OUT-MANIFEST.md`) and were not
edited. Every person-authored leaf below cites the package's own files
(`styles.css`, `dist/esm/components/icons.js`) by line, or the capture's own
computed value where a `<path>` has no channel the schema reads. Nothing was
tuned against a score.

## The rows

| archetype | pointed | reviewed leaves | minted | score (bar 5%) |
| --- | --- | --- | --- | --- |
| Avatar | 13 read · 1 reviewed · 0 invented | `typography.label.resolved` = Roboto/Medium: `-apple-system` resolves to SF Pro in the reference render, which this Figma refuses (`AVATAR-FONT-ZERO-INTRINSIC`: SF Pro paints zero-width); Roboto is the next installed face in the package's `--default-font-family` stack — a FONT-SUBSTRATE fallback, named | Scratch page `267:2366` | **PASS 1.88%** (40×40 both sides, glyph-masked 0%) |
| Switch | 23 read · 2 reviewed · 0 invented | `states.true.enabled.trackFill` = #3e63dd (`styles.css:14012-14016` the track's gradient's first stop `var(--accent-track)` = `--indigo-9`, revealed by `background-position: 0%` at `:13904`); `states.false.enabled.trackFill` = #0000330f (`:13900-13902` position 100% shows the transparent tail over `var(--gray-a3)`, slate: `:64`) | Scratch page `267:2382`, 4 variants | **PASS** unchecked 3.04% · unchecked-disabled 0% · checked 2.59% · checked-disabled 0.27% |
| Checkbox | 30 read · 5 reviewed · 0 invented | `dash.width` 8.333 / `dash.height` 1.667 (icons.js `ThickDividerHorizontalIcon` 7.5×1.5 of a 9-unit viewBox in a 10×10 rendered svg); `states.indeterminate.{enabled,disabled}.dashFill` from the indicator's computed `color` (the icon paints `fill="currentcolor"`; a `<path>` has no background-color) | **refused by name at mint** | — |
| Badge | — | — | refused at the role step, as predicted: an inline `<span class="rt-Badge">` has no anchored pip (docs/36 already names every foreign badge as refused) | — |
| Tabs | — | — | refused at the role step, as predicted: the indicator is `[data-state='active']::before`, the same class as shadcn's named refusal | — |

Fidelity gate after this round: **58 pass · 0 fringe · 13 known**. Every Radix
row carries `heldOut: "radix-themes"` (never `_proposedWhy`), so the plugin-target
proof never sweeps or re-mints its page. The gate's shrink-only ratchet is what
keeps these rows honest: a regression on any of them is red.

## What the held-out library forced the engine to learn (language, not answers)

1. **A pseudo-element track.** Radix's switch track is `.rt-SwitchRoot::before`;
   the host button is transparent. `SwitchRoles.trackPseudo` — the drafter finds
   a pill among a part's `::before`/`::after` when no real part is pill-shaped,
   and every track read carries the pseudo.
2. **A gradient-painted plane.** The checked track's paint is a two-stop
   gradient whose position shifts; its `background-color` is the base tint
   underneath. `trackImagePlanes` names the planes whose track is painted by
   `background-image`; those `trackFill` leaves become **receipts** that need a
   reviewed `--set` cited from the package. Before this the reader would have
   read the base tint as if it were the painted fill.
3. **A stack trace where a stranger deserves a refusal.** `draftCheckboxRoles`
   hardcoded `ledger.capture("unchecked.enabled__default")`; any library with an
   extra axis (Radix: variant × size × checked) threw a `LedgerReadError`.
   `draftCheckboxCombos` now derives the six combo keys from the ledger's
   declared base cell, as the switch drafter already did.
4. **A pseudo-element box.** `CheckboxRoles.boxPseudo`: the box is
   `.rt-BaseCheckboxRoot::before` (fill and an inset ring); the drafter finds a
   square painted by a pseudo when no real part paints, and every box read
   carries it.
5. **A lossy inverse.** `cssBoxShadowFromEffects` printed alpha at two decimals:
   byte 0x32 became 0.2, which re-lowers to 0x33, so the compile → collapse →
   compile fixed point failed on any shadow alpha the rounding missed (shadcn's
   0.05 happened to survive). It now prints the shortest decimal that re-lowers
   to the same byte — every existing output unchanged, proven by a 0..255 sweep.
6. **A shared-runtime defect any inset ring hits.** The writer set
   `showShadowBehindNode` on every shadow; Figma accepts that key on
   `DROP_SHADOW` only, and refuses the paste on an `INNER_SHADOW`:
   `in set_effects: Property "effects" failed validation: Unrecognized key(s)`.
   The fix is one conditional in `recipe/figma-writer-runtime.ts`, carried on
   `fix/writer-inner-shadow` with a test — and because the runtime is the one
   program every boilerplate writer embeds, its text change makes all thirteen
   writers stale, which is a remint round of its own before that branch can
   merge. The Radix checkbox mints the moment it lands.

## What is not claimed

- No grade is minted. `overallSuccess` stays false; the owner grades these rows
  and the calendar row together.
- This is not a first-pass measurement (the library was captured before, on the
  legacy chain); it is the product path's first contact with it.
- The calendar row's named 16px ink-box caveat is untouched by this round.
- A single gate that re-scores both F1 rows together (`recipe:f1:check`, designed
  in the plan of record) is not yet written; today the Radix rows are held by
  the fidelity gate's ratchet and the calendar row by `recipe:f1-held-out:check`.
