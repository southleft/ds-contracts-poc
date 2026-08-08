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

- **hash:** `v6:3593476120`
- **lineCount:** 139

## Round-trip

Compared canvas props to `examples/altitude/contracts/heading.contract.json`.

- **MATCH axes:** Variant enum → Display Lg/Display Md/Display Sm/Lg/Md/Sm, Weight enum → Regular/Bold, TEXT Content
- **GAPS:** canvas-absent: no State axis (contract has empty/absent states)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- reference: extract/computed/out/altitude/heading/receipts
- defect: Type scale not verified vs altitude heading computed pairs — fail closed.
