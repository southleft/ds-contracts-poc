# F1, second row — Radix Themes through the product's own command (2026-09-13)

## Current measurement — checkbox follow-up

The checkbox now mints and all six states pass. Current numbers are generated
and re-scored by `npm run recipe:f1:check` in
[`recipe/evidence/f1-v1/README.md`](../../../recipe/evidence/f1-v1/README.md).
The corrected set stays on Scratch page `273:3800`; its raw successful mint is
`recipe/evidence/pointed/checkbox-radix-themes/mint.json`. The obsolete
`mint-refusal.json` was removed after successful minting (its history remains
in git). No owner grade or signoff changed.

The first successful mint, page `272:3725`, exposed a separate generic defect:
the check vector was hidden in indeterminate states, but its empty viewport
still participated in auto-layout and displaced the dash. Both that page and
its exported pixels are preserved. `recipe/checkbox-proof.test.ts` reproduces
the structural defect across existing libraries and Radix; the fix hides the
whole inactive host while retaining its invertible facts. The committed
before/after exports are tested by `recipe/f1-checkbox-regression.test.ts`:
both old indeterminate rows fail, all corrected rows pass, and the four other
states are byte-identical. No fixture value, capture configuration, or seed
changed. The current pointed writers re-derive through
`npx tsx recipe/build-f1-radix-checkbox.ts --check`.

Source-provenance audit: the original dash reviews below mixed source and
computed-channel citations. Their values were independently checked against
`@radix-ui/themes@3.3.0` package files, without changing them:

- `dist/esm/components/icons.js:1`: `ThickDividerHorizontalIcon` uses a 9-unit
  viewBox and a 7.5-by-1.5 path; `styles.css:7795-7798` specifies the size-2
  10px indicator, and `:4551-4552` defines 100% scaling as 1. Thus the recorded
  8.333-by-1.667 dash dimensions come from package geometry, not the score.
- `styles.css:7897-7898`, `:3810`, `:3257`: the enabled surface indicator uses
  accent contrast → indigo contrast → white (`#ffffffff`).
- `styles.css:7910-7911`, `:4405`, `:69`: disabled indicator uses gray-a8 →
  slate-a8 → `#00083046`.
- `dist/esm/components/icons.js:1`: the existing check path is the package's
  `ThickCheckIcon`; both icons use `currentcolor`.

The boilerplate checkbox writer was re-prepared after the structural fix;
its existing live fields remain historical, not a claim of a new boilerplate
mint. The F1 font-residual policy also now requires green glyph-masked geometry
for **both** font classes; negative tests reject an unmeasured font-metrics
excuse. None of the current Radix rows needs an exception.

## Original round — historical, before the follow-up above

**Why a second row.** The first F1 subject, react-day-picker's calendar, is
minted and scored (3.048% against a 5% bar) but calendar is not one of the
thirteen archetypes `recipe:point` ships, so it measures a lineage a stranger
cannot reach. The owner decided on 2026-09-13 to keep that row **and** add a
held-out library through the product path itself. Radix Themes
(`@radix-ui/themes@3.3.0`) had been captured once on 2026-09-04 through the
legacy `onboard` chain and never pointed at by the recipe path; five components
were selected for this exam: avatar, switch, checkbox, badge, tabs. This is
not an exhaustive inventory of Radix Themes.

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
- The calendar row's ink-box caveat was closed from 16px to 2px in a separate
  round the same day (F1-COMPILE-ROUND.md § 2026-09-13), not by this one.
- One gate now holds both rows: `npm run recipe:f1:check` (`recipe/f1-check.ts`,
  fast lane) re-scores the committed calendar canvas against the real render
  and pins its hashes, re-scores every `heldOut: "radix-themes"` manifest row,
  reproduces the badge and tabs role-step refusals from the committed ledgers,
  and carries the checkbox mint refusal as a quoted claim
  (`recipe/evidence/pointed/checkbox-radix-themes/mint-refusal.json`) until the
  archetype mints. Receipt: `recipe/evidence/f1-v1/receipt.json`. It measures;
  it never grades — `overallSuccess` stays false in it by construction.
