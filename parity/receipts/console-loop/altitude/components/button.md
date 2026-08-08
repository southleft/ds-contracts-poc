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

- **hash:** `v6:3196882528`
- **lineCount:** 299

## Round-trip

Compared canvas props to `examples/altitude/contracts/button.contract.json`.

- **MATCH axes:** Variant enum → Secondary/Tertiary/Bare/Danger, TEXT Content, first-variant fill bound: imported/button/root/background-color/secondary
- **GAPS:** none
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- reference: extract/computed/out/altitude/button/receipts
- defect: Khaki/orange/blue matrix present on cream surface but not claimed match to altitude button computed pairs — fail closed.
