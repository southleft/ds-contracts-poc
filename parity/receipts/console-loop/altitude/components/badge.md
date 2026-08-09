# Badge — altitude console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `altitude.badge`  
**Recorded:** 2026-08-06T05:43:10.768Z  
**Re-synced:** 2026-08-06T15:23:00.000Z

## Generate

Fetched `examples/altitude/figma/badge.figma.js` via `http://localhost:9228/stem/altitude-badge` into `ds_loop_script` (67617 bytes), then eval’d.

- **nodeId:** `1:2963` (COMPONENT_SET on page **Badge (altitude.badge)**, section `1:2964`)
- **mode:** amended (rebuiltVariants: 8)
- **properties:** Content, Variant, Dot

## Screenshot

COMPONENT_SET `1:2963` — 8 variants in 2 columns (Default | Dot) × 4 rows (Info/Success/Warning/Danger).

- **Dot=Default:** pill with visible label text `Badge`
- **Dot=Dot:** 8×8 circle only; no label text

## Fingerprint (v6)

- **hash:** `v6:3977245456`

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-09T07:30:10.247Z`
- status: **fail-closed**
- matchDeveloped: **false**
- reference: `extract/computed/out/altitude/badge/orig-shots/info.default__default.png` (REAL library render — altitude-web-components@1.0.2)
- scorecard: `parity/receipts/console-loop/altitude/scores/badge.json` — pctAAMasked **16.82**, compositionOk **true**, canvas 44x20 vs library 43x20
- corroborating instrument: `scripts/visual-truth-run.mjs --lib altitude` (headless Figma REST images API)

### Notes

- FC-FONT-STYLE-PER-FAMILY CLOSED 2026-08-09. The canvas text nodes were rendering in **Inter Semi Bold**, not IBM Plex Sans: core/emit-figma-script.ts compiles the style name from FONT_STYLE_BY_WEIGHT, which is spelled Inter's way ("Semi Bold"), while IBM Plex Sans ships that face as "SemiBold" — figma.listAvailableFontsAsync() on GnQnjSNBXtgtd2Ht0Hs1C8 returns [Bold, Bold Italic, ExtraLight, …, Regular, SemiBold, SemiBold Italic, Thin, …] and no "Semi Bold". loadFontAsync threw and the runtime kept its Inter fallback SILENTLY. The runtime now retries the space-free per-family spelling and, if nothing resolves, names FC-FONT-STYLE-UNRESOLVED on the console instead of substituting in silence (RUNTIME_EMIT_REV rt6-native-slots → rt7-font-style-per-family). The 2026-08-08 revert note that forbade this is DEAD: it was reasoned against contract-render references made by a harness with no @font-face, and the references are now real library renders. Badge's typeface is now correct and its cell narrowed 45 → 44 against the library's 43. The pixel number moved 15.44 → 16.82 because the Inter fallback happened to sit one row higher inside the 20px pill than IBM Plex Sans does — a luckier accident with the wrong face. The number is reported as measured; it was not chosen.

### Named defects (fail-closed)

- FC-CANVAS-TEXT-METRICS: with the correct face (IBM Plex Sans SemiBold 12px) Figma advances "Badge" to 36px where Chromium advances it to 35px, and places the glyphs one row lower inside the 12px line box (canvas cap-top at row 6, library at row 5). Cell 44x20 vs library 43x20, pctAAMasked 16.82. Both residuals are rasterizer facts, not contract facts: there is no px channel to carry and the pill is small enough (43x20, ink 88%) that a 1px shift is 4.6% of its width.
