# Button — altitude console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `altitude.button`  
**Recorded:** 2026-08-06T05:43:11.810Z

## Generate

Uploaded `examples/altitude/figma/button.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:2990` (COMPONENT_SET on page **Button (altitude.button)**, section `1:2995`)
- **variants:** 12
- **properties:** Content#1:782, Variant, State

## Screenshot

Button COMPONENT_SET 1:2990: 12 variant(s), 3 prop def(s) on page Button (altitude.button). Screenshot export of section/node 1:2995 ok (26421 bytes PNG@2x). First root fill bound to imported/button/root/background-color/secondary. Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:3313935822`
- **lineCount:** 4

## Round-trip

Compared canvas props to `examples/altitude/contracts/button.contract.json`.

- **MATCH axes:** Variant enum → Secondary/Tertiary/Bare/Danger, TEXT Content, first-variant fill bound: imported/button/root/background-color/secondary
- **GAPS:** none
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-09T07:30:10.247Z`
- status: **scored-pass**
- matchDeveloped: **true**
- reference: `extract/computed/out/altitude/button/orig-shots/secondary__default.png` (REAL library render — altitude-web-components@1.0.2)
- scorecard: `parity/receipts/console-loop/altitude/scores/button.json` — pctAAMasked **2.98**, compositionOk **true**, canvas 83x40 vs library 82x40
- corroborating instrument: `scripts/visual-truth-run.mjs --lib altitude` (headless Figma REST images API)

### Notes

- FC-FONT-STYLE-PER-FAMILY CLOSED 2026-08-09. The canvas text nodes were rendering in **Inter Semi Bold**, not IBM Plex Sans: core/emit-figma-script.ts compiles the style name from FONT_STYLE_BY_WEIGHT, which is spelled Inter's way ("Semi Bold"), while IBM Plex Sans ships that face as "SemiBold" — figma.listAvailableFontsAsync() on GnQnjSNBXtgtd2Ht0Hs1C8 returns [Bold, Bold Italic, ExtraLight, …, Regular, SemiBold, SemiBold Italic, Thin, …] and no "Semi Bold". loadFontAsync threw and the runtime kept its Inter fallback SILENTLY. The runtime now retries the space-free per-family spelling and, if nothing resolves, names FC-FONT-STYLE-UNRESOLVED on the console instead of substituting in silence (RUNTIME_EMIT_REV rt6-native-slots → rt7-font-style-per-family). The 2026-08-08 revert note that forbade this is DEAD: it was reasoned against contract-render references made by a harness with no @font-face, and the references are now real library renders. Button was already a scored pass; the true face improved it: pctAAMasked 4.70 → 2.98, and the cell width moved 84 → 83 against the library render's 82.
