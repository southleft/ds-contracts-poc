# Link — altitude console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `altitude.link`  
**Recorded:** 2026-08-06T05:43:14.695Z

## Generate

Uploaded `examples/altitude/figma/link.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:3092` (COMPONENT_SET on page **Link**, section `1:3096`)
- **variants:** 9
- **properties:** Content#1:819, Variant, State

## Screenshot

Link COMPONENT_SET 1:3092: 9 variant(s), 3 prop def(s) on page Link. Screenshot export of section/node 1:3096 ok (8734 bytes PNG@2x). Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:2052539233`
- **lineCount:** 109

## Round-trip

Compared canvas props to `examples/altitude/contracts/link.contract.json`.

- **MATCH axes:** Variant enum → Xs/Sm/Lg, TEXT Content
- **GAPS:** none
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- reference: extract/computed/out/altitude/link/receipts
- defect: Not verified vs altitude link computed pairs — fail closed.

## 2026-08-08 — Track-2 hill-climb round 1

- regenerated (nodeId=60:10102). font-family carried; fill exact #4375FF both sides; 14.96 AA glyph-body — FC-FONT-SUBSTRATE, fail-closed.

## 2026-08-08 — FC-FONT-SUBSTRATE closure (font-loading harness)

- reference re-pinned (refs/link.png ← gate-shots/lg__default.png rendered with IBM Plex Sans loaded via cfg.fonts). SAME canvas cell shot. 14.96 → **2.01 AA, scored-pass** (headless REST instrument agrees: 2.01).
