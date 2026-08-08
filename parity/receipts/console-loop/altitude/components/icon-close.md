# IconClose — altitude console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `altitude.iconclose`  
**Recorded:** 2026-08-06T05:43:14.336Z

## Generate

Uploaded `examples/altitude/figma/icon-close.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:3071` (COMPONENT_SET on page **IconClose**, section `1:3072`)
- **variants:** 7
- **properties:** Size

## Screenshot

IconClose COMPONENT_SET 1:3071: 7 variant(s), 1 prop def(s) on page IconClose. Screenshot export of section/node 1:3072 ok (8852 bytes PNG@2x). Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:163654327`
- **lineCount:** 96

## Round-trip

Compared canvas props to `examples/altitude/contracts/iconclose.contract.json`.

- **MATCH axes:** Size enum → Xs/Sm/Md/Lg/Xl/Xxl/Xxxl
- **GAPS:** canvas-absent: no State axis (contract has empty/absent states)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- reference: extract/computed/out/altitude/iconclose/receipts
- defect: Not verified vs altitude icon-close computed pairs — fail closed.
