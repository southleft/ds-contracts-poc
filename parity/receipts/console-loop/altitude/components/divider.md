# Divider — altitude console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `altitude.divider`  
**Recorded:** 2026-08-06T05:43:13.347Z

## Generate

Uploaded `examples/altitude/figma/divider.figma.js` via clientStorage chunks.

- **nodeId:** `1:3020` (COMPONENT on page **Divider (altitude.divider)**)
- **note:** isSet=false standalone (single Vertical variant)

## Screenshot

Screenshot export reviewed; thin vertical divider looks sane.

## Fingerprint (v6)

- **hash:** `v6:1673250268`
- **lineCount:** 2

## Round-trip

- **MATCH axes:** n/a (standalone)
- **GAPS:** canvas-absent: no State axis (contract has empty/absent states); canvas-absent: VARIANT Variant not exposed — generator emitted standalone COMPONENT (isSet=false); single-enum contract axis collapses off the prop surface
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-09T07:30:10.247Z`
- status: **scored-pass**
- matchDeveloped: **true**
- reference: `extract/computed/out/altitude/divider/orig-shots/unset__default.png` (REAL library render — altitude-web-components@1.0.2)
- scorecard: `parity/receipts/console-loop/altitude/scores/divider.json` — pctAAMasked **0.00**, compositionOk **true**, canvas 288x1 vs library 288x1
- corroborating instrument: `scripts/visual-truth-run.mjs --lib altitude` (headless Figma REST images API)

### Notes

- Unchanged this round. Re-scored after the regeneration at RUNTIME_EMIT_REV rt7-font-style-per-family: pctAAMasked 0.00, unchanged.
