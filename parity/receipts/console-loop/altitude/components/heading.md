# Heading — altitude console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `altitude.heading`  
**Recorded:** 2026-08-06T05:43:13.859Z

## Generate

Uploaded `examples/altitude/figma/heading.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:3047` (COMPONENT_SET on page **Heading (altitude.heading)**, section `1:3048`)
- **variants:** 12
- **properties:** Content#1:806, Variant, Weight

## Screenshot

Heading COMPONENT_SET 1:3047: 12 variant(s), 3 prop def(s) on page Heading (altitude.heading). Screenshot export of section/node 1:3048 ok (53934 bytes PNG@2x). Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:541267266`
- **lineCount:** 4

## Round-trip

Compared canvas props to `examples/altitude/contracts/heading.contract.json`.

- **MATCH axes:** Variant enum → Display Lg/Display Md/Display Sm/Lg/Md/Sm, Weight enum → Regular/Bold, TEXT Content
- **GAPS:** canvas-absent: no State axis (contract has empty/absent states)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-09T07:30:10.247Z`
- status: **scored-pass**
- matchDeveloped: **true**
- reference: `extract/computed/out/altitude/heading/orig-shots/display-lg.bold__default.png` (REAL library render — altitude-web-components@1.0.2)
- scorecard: `parity/receipts/console-loop/altitude/scores/heading.json` — pctAAMasked **4.95**, compositionOk **true**, canvas 91x24 vs library 91x24
- corroborating instrument: `scripts/visual-truth-run.mjs --lib altitude` (headless Figma REST images API)

### Notes

- FC-FONT-STYLE-PER-FAMILY CLOSED 2026-08-09. The canvas text nodes were rendering in **Inter Semi Bold**, not IBM Plex Sans: core/emit-figma-script.ts compiles the style name from FONT_STYLE_BY_WEIGHT, which is spelled Inter's way ("Semi Bold"), while IBM Plex Sans ships that face as "SemiBold" — figma.listAvailableFontsAsync() on GnQnjSNBXtgtd2Ht0Hs1C8 returns [Bold, Bold Italic, ExtraLight, …, Regular, SemiBold, SemiBold Italic, Thin, …] and no "Semi Bold". loadFontAsync threw and the runtime kept its Inter fallback SILENTLY. The runtime now retries the space-free per-family spelling and, if nothing resolves, names FC-FONT-STYLE-UNRESOLVED on the console instead of substituting in silence (RUNTIME_EMIT_REV rt6-native-slots → rt7-font-style-per-family). The 2026-08-08 revert note that forbade this is DEAD: it was reasoned against contract-render references made by a harness with no @font-face, and the references are now real library renders. Measured advance for "Heading" at 48px: Inter Semi Bold 194px vs IBM Plex Sans SemiBold 185px; the library render inks 182px. pctAAMasked 11.40 → 4.95 on the bridge instrument, 2.39 on the headless REST instrument (visual-truth). No reference was touched — the same orig-shots/display-lg.bold__default.png library render scored both numbers.
