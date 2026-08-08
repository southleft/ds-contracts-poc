# Modal — carbon console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `carbon.modal`  
**Recorded:** 2026-08-06T05:47:06.733Z

## Generate

Uploaded `examples/carbon/figma/modal.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:5911` (COMPONENT_SET on page **Modal**, section `1:5912`)
- **variants:** 4
- **properties:** Content#1:1207, Size

## Screenshot

Modal COMPONENT_SET 1:5911: 4 variant(s), 2 prop def(s) on page Modal. Screenshot export of section/node 1:5912 ok (82870 bytes PNG@2x). First root fill bound to imported/modal/root/background-color. Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:2103121654`
- **lineCount:** 578

## Round-trip

Compared canvas props to `examples/carbon/contracts/modal.contract.json`.

- **MATCH axes:** Size enum → Xs/Sm/Md/Lg, TEXT Content, first-variant fill bound: imported/modal/root/background-color
- **GAPS:** canvas-absent: no State axis (contract has empty/absent states)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- reference: extract/computed/out/carbon/modal/receipts/pair--unset__default.png
- defect: Dialog surface/footer button-set strip proportions not verified as match to pair--unset__default — fail closed.
