# Button — carbon console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `carbon.button`  
**Recorded:** 2026-08-06T05:47:03.732Z

## Generate

Uploaded `examples/carbon/figma/button.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:5528` (COMPONENT_SET on page **Button (carbon.button)**, section `1:5545`)
- **variants:** 80
- **properties:** Content#1:1126, Kind, Size, State

## Screenshot

Button COMPONENT_SET 1:5528: 80 variant(s), 4 prop def(s) on page Button (carbon.button). Screenshot export of section/node 1:5545 ok (123881 bytes PNG@2x). First root fill bound to imported/button/root/background-color/primary. Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:310064922`
- **lineCount:** 1558

## Round-trip

Compared canvas props to `examples/carbon/contracts/button.contract.json`.

- **MATCH axes:** Kind enum → Primary/Secondary/Tertiary/Ghost/Danger/Danger Primary/Danger Ghost/Danger Tertiary, Size enum → Xs/Sm/Md/Lg/Xl/2XL, TEXT Content, first-variant fill bound: imported/button/root/background-color/primary
- **GAPS:** none
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **true**
- reference: extract/computed/out/carbon/button/receipts/pair--primary.unset.enabled__default.png
- defects: none
